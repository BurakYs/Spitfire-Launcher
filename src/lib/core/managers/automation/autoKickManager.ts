import FriendManager from '$lib/core/managers/friend';
import type XMPPManager from '$lib/core/managers/xmpp';
import { getResolvedResults, sleep } from '$lib/utils/util';
import type { AccountData } from '$types/accounts';
import MatchmakingManager from '$lib/core/managers/matchmaking';
import { EpicEvents } from '$lib/constants/events';
import AutoKickBase from '$lib/core/managers/automation/autoKickBase';
import PartyManager from '$lib/core/managers/party';
import claimRewards from '$lib/utils/autoKick/claimRewards';
import transferBuildingMaterials from '$lib/utils/autoKick/transferBuildingMaterials';
import DataStorage from '$lib/core/dataStorage';
import type { PartyData } from '$types/game/party';
import { get } from 'svelte/store';
import { accountsStore } from '$lib/stores';

type MatchmakingState = {
  partyState: 'Matchmaking' | 'PostMatchmaking' | null;
  started: boolean;
};

export default class AutoKickManager {
  private missionCheckerIntervalInitTimeout?: number;
  private missionCheckerInterval?: number;

  public matchmakingState: MatchmakingState = {
    partyState: null,
    started: false
  };

  constructor(private account: AccountData, private xmpp: XMPPManager) {}

  initMissionCheckerIntervalTimeout(timeoutMs?: number) {
    if (this.missionCheckerIntervalInitTimeout) {
      clearTimeout(this.missionCheckerIntervalInitTimeout);
      this.missionCheckerIntervalInitTimeout = undefined;
    }

    this.missionCheckerIntervalInitTimeout = window.setTimeout(async () => {
      await this.initMissionCheckerInterval();
    }, timeoutMs || 10000);
  }

  async initMissionCheckerInterval() {
    if (this.missionCheckerInterval) {
      clearInterval(this.missionCheckerInterval);
      this.missionCheckerInterval = undefined;
    }

    const settings = await DataStorage.getSettingsFile();

    this.missionCheckerInterval = window.setInterval(async () => {
      const automationSettings = AutoKickBase.getAccountById(this.account.accountId)?.settings;
      const isAnySettingEnabled = Object.values(automationSettings || {}).some(x => x);
      if (!automationSettings || !isAnySettingEnabled) return;

      const matchmakingResponse = await MatchmakingManager.findPlayer(this.account, this.account.accountId);
      const matchmakingData = matchmakingResponse[0];
      const matchmakingState = this.matchmakingState;

      if (!matchmakingData) {
        const wasInMatch = matchmakingState.partyState === 'Matchmaking' || matchmakingState.partyState === 'PostMatchmaking';
        if (!wasInMatch) {
          this.dispose();
        }

        return;
      }

      if (matchmakingData.started == null) return;

      if (matchmakingData.started && matchmakingState.partyState !== 'PostMatchmaking') {
        this.matchmakingState.partyState = 'PostMatchmaking';
        return;
      }

      if (
        matchmakingState.partyState !== 'PostMatchmaking'
        || !matchmakingState.started
        || matchmakingData.started
      ) {
        this.matchmakingState.started = matchmakingData.started;
        return;
      }

      this.dispose();

      const partyData = await PartyManager.get(this.account);
      const party = partyData.current[0];

      if (automationSettings.autoKick) {
        await this.kick(party).catch(console.error);
      }

      if (automationSettings.autoTransferMaterials) {
        transferBuildingMaterials(this.account).catch(console.error);
      }

      if (
        automationSettings.autoKick
        && automationSettings.autoInvite
        && party.members.find(x => x.account_id === this.account.accountId)?.role === 'CAPTAIN'
        && party.members.filter(x => x.account_id !== this.account.accountId).length
      ) {
        this.invite(party.members).catch(console.error);
      }

      if (automationSettings.autoClaim) {
        await claimRewards(this.account).catch(console.error);
      }
    }, (settings.app?.missionCheckInterval || 5) * 1000);
  }

  async checkMissionOnStartup() {
    const settings = AutoKickBase.getAccountById(this.account.accountId)?.settings;
    const isAnySettingEnabled = Object.values(settings || {}).some(x => x);
    if (!settings || !isAnySettingEnabled) return;

    const matchmakingResponse = await MatchmakingManager.findPlayer(this.account, this.account.accountId);
    const matchmakingData = matchmakingResponse[0];

    if (matchmakingData?.started == null) return;

    this.matchmakingState.started = matchmakingData.started;
    this.matchmakingState.partyState = matchmakingData.started ? 'PostMatchmaking' : 'Matchmaking';

    await this.initMissionCheckerInterval();
  }

  dispose() {
    if (this.missionCheckerInterval) {
      clearInterval(this.missionCheckerInterval);
      this.missionCheckerInterval = undefined;
    }

    if (this.missionCheckerIntervalInitTimeout) {
      clearTimeout(this.missionCheckerIntervalInitTimeout);
      this.missionCheckerIntervalInitTimeout = undefined;
    }

    this.matchmakingState = {
      partyState: null,
      started: false
    };
  }

  private async kick(party: PartyData) {
    const { allAccounts } = get(accountsStore);

    const partyMemberIds = party.members.map(x => x.account_id);
    const partyLeaderId = party.members.find(x => x.role === 'CAPTAIN')!.account_id;
    const partyLeaderAccount = allAccounts.find(x => x.accountId === partyLeaderId);

    const membersWithAutoKick = partyMemberIds.filter((id) => AutoKickBase.getAccountById(id)?.settings.autoKick);
    const membersWithNoAutoKick = partyMemberIds.filter((id) => !membersWithAutoKick.includes(id));

    if (partyLeaderAccount) {
      const accountsWithNoAutoKick = membersWithNoAutoKick.filter((id) => id !== this.account.accountId);

      await Promise.allSettled(accountsWithNoAutoKick.map(async (id) =>
        await PartyManager.kick(partyLeaderAccount, party.id, id)
      ));

      await PartyManager.leave(this.account, party.id);
    } else {
      const accountsWithNoAutoKick = membersWithNoAutoKick
        .map((id) => allAccounts.find(x => x.accountId === id))
        .filter(x => !!x);

      accountsWithNoAutoKick.push(this.account);

      await Promise.allSettled(accountsWithNoAutoKick.map(async (account) =>
        await PartyManager.leave(account, party.id)
      ));
    }
  }

  private async invite(members: PartyData['members']) {
    await this.xmpp.waitForEvent(EpicEvents.MemberJoined, (data) => data.account_id === this.account.accountId, 20000);
    await sleep(1000);

    const [partyData, friends] = await getResolvedResults([
      PartyManager.get(this.account),
      FriendManager.getFriends(this.account)
    ]);

    const party = partyData?.current[0];
    if (!party || !friends?.length) return;

    const partyMemberIds = members.map(x => x.account_id).filter(x => x !== this.account.accountId);
    const friendsInParty = friends.filter((friend) => partyMemberIds.includes(friend.accountId));

    await Promise.allSettled(friendsInParty.map(async (friend) => {
      await PartyManager.invite(this.account, party.id, friend.accountId);
    }));
  }
}