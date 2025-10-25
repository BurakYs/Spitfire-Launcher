import FriendsManager from '$lib/core/managers/friends';
import type XMPPManager from '$lib/core/managers/xmpp';
import { getResolvedResults, sleep } from '$lib/utils/util';
import type { AccountData } from '$types/accounts';
import MatchmakingManager from '$lib/core/managers/matchmaking';
import { EpicEvents } from '$lib/constants/events';
import AutoKickBase from '$lib/core/managers/autokick/base';
import PartyManager from '$lib/core/managers/party';
import claimRewards from '$lib/core/managers/autokick/claim-rewards';
import transferBuildingMaterials from '$lib/core/managers/autokick/transfer-building-materials';
import { accountsStorage, settingsStorage } from '$lib/core/data-storage';
import type { PartyData } from '$types/game/party';
import { get } from 'svelte/store';

type MatchmakingState = {
  partyState: 'Matchmaking' | 'PostMatchmaking' | null;
  previousStarted: boolean;
  started: boolean;
};

export default class AutokickManager {
  private scheduleTimeout?: number;
  private checkerInterval?: number;

  public matchmakingState: MatchmakingState = {
    partyState: null,
    previousStarted: false,
    started: false
  };

  constructor(private account: AccountData, private xmpp: XMPPManager) {}

  scheduleMissionChecker(timeoutMs?: number) {
    if (this.scheduleTimeout) {
      clearTimeout(this.scheduleTimeout);
      this.scheduleTimeout = undefined;
    }

    this.scheduleTimeout = window.setTimeout(async () => {
      this.startMissionChecker();
    }, timeoutMs || 10000);
  }

  startMissionChecker() {
    if (this.checkerInterval) {
      clearInterval(this.checkerInterval);
      this.checkerInterval = undefined;
    }

    const settings = get(settingsStorage);

    this.checkerInterval = window.setInterval(async () => {
      const automationSettings = AutoKickBase.getAccountById(this.account.accountId)?.settings;
      const isAnySettingEnabled = Object.values(automationSettings || {}).some(x => x);
      if (!automationSettings || !isAnySettingEnabled) return;

      const matchmakingResponse = await MatchmakingManager.findPlayer(this.account, this.account.accountId);
      const matchmakingData = matchmakingResponse?.[0];

      if (matchmakingData?.started == null && matchmakingResponse.length > 0) return;

      const started = matchmakingData?.started || false;
      if (this.matchmakingState.previousStarted && !started) {
        this.dispose();

        if (automationSettings.autoKick) {
          PartyManager.get(this.account).then(async (partyData) => {
            const party = partyData.current[0];
            if (party) {
              await this.kick(party);
            }
          }).catch(console.error);
        }

        if (automationSettings.autoClaim) {
          claimRewards(this.account).catch(console.error);
        }

        if (automationSettings.autoKick && automationSettings.autoInvite) {
          const newPartyData = await PartyManager.get(this.account);
          const newParty = newPartyData.current[0];

          if (newParty?.members.find(x => x.account_id === this.account.accountId)?.role === 'CAPTAIN') {
            this.invite(newParty.members).catch(console.error);
          }
        }

        if (automationSettings.autoTransferMaterials) {
          transferBuildingMaterials(this.account).catch(console.error);
        }
      }

      this.matchmakingState.previousStarted = started;

      if (started !== this.matchmakingState.started) {
        this.matchmakingState.started = started;
        this.matchmakingState.partyState = started ? 'PostMatchmaking' : 'Matchmaking';
      }
    }, (settings.app?.missionCheckInterval || 5) * 1000);
  }

  async checkMissionOnStartup() {
    const settings = AutoKickBase.getAccountById(this.account.accountId)?.settings;
    const isAnySettingEnabled = Object.values(settings || {}).some(x => x);
    if (!settings || !isAnySettingEnabled) return;

    const matchmakingResponse = await MatchmakingManager.findPlayer(this.account, this.account.accountId);
    const matchmakingData = matchmakingResponse?.[0];

    if (matchmakingData?.started == null && matchmakingResponse.length > 0) return;

    const started = matchmakingData?.started || false;
    this.matchmakingState = {
      partyState: started ? 'PostMatchmaking' : 'Matchmaking',
      started,
      previousStarted: started
    };

    this.startMissionChecker();
  }

  dispose() {
    if (this.checkerInterval) {
      clearInterval(this.checkerInterval);
      this.checkerInterval = undefined;
    }

    if (this.scheduleTimeout) {
      clearTimeout(this.scheduleTimeout);
      this.scheduleTimeout = undefined;
    }

    this.matchmakingState = {
      partyState: null,
      previousStarted: false,
      started: false
    };
  }

  private async kick(party: PartyData) {
    const { accounts } = get(accountsStorage);
    const partyMemberIds = party.members.map(x => x.account_id);
    const partyLeaderId = party.members.find(x => x.role === 'CAPTAIN')!.account_id;
    const partyLeaderAccount = accounts.find(x => x.accountId === partyLeaderId);

    const membersWithAutoKick = partyMemberIds.filter((id) => AutoKickBase.getAccountById(id)?.settings.autoKick);
    const membersWithoutAutoKick = partyMemberIds.filter((id) => !membersWithAutoKick.includes(id));

    if (partyLeaderAccount) {
      const accountsWithNoAutoKick = membersWithoutAutoKick.filter((id) => id !== this.account.accountId);
      await Promise.allSettled(accountsWithNoAutoKick.map((id) => PartyManager.kick(partyLeaderAccount, party.id, id)));

      await PartyManager.leave(this.account, party.id);
    } else {
      const accountsWithNoAutoKick = membersWithoutAutoKick
        .map((id) => accounts.find(x => x.accountId === id))
        .filter(x => !!x);

      accountsWithNoAutoKick.push(this.account);

      await Promise.allSettled(accountsWithNoAutoKick.map((account) => PartyManager.leave(account, party.id)));
    }
  }

  private async invite(members: PartyData['members']) {
    await this.xmpp.waitForEvent(EpicEvents.MemberJoined, (data) => data.account_id === this.account.accountId, 20000);
    await sleep(1000);

    const [partyData, friends] = await getResolvedResults([
      PartyManager.get(this.account),
      FriendsManager.getFriends(this.account)
    ]);

    const party = partyData?.current[0];
    if (!party || !friends?.length) return;

    const partyMemberIds = members.map(x => x.account_id).filter(x => x !== this.account.accountId);
    const friendsInParty = friends.filter((friend) => partyMemberIds.includes(friend.accountId));

    await Promise.allSettled(friendsInParty.map((friend) => PartyManager.invite(this.account, party.id, friend.accountId)));
  }
}
