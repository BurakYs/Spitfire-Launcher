import FriendsManager from '$lib/core/managers/friends';
import XMPPManager from '$lib/core/managers/xmpp';
import { getResolvedResults, sleep } from '$lib/utils/util';
import type { AccountData } from '$types/accounts';
import MatchmakingManager from '$lib/core/managers/matchmaking';
import { ConnectionEvents, EpicEvents } from '$lib/constants/events';
import AutoKickBase, { type AutomationAccount } from '$lib/core/managers/autokick/base';
import PartyManager from '$lib/core/managers/party';
import claimRewards from '$lib/core/managers/autokick/claim-rewards';
import transferBuildingMaterials from '$lib/core/managers/autokick/transfer-building-materials';
import { accountsStorage, settingsStorage } from '$lib/core/data-storage';
import { automationStore } from '$lib/stores';
import { get } from 'svelte/store';
import type { PartyData } from '$types/game/party';

type MatchmakingState = {
  partyState: 'Matchmaking' | 'PostMatchmaking' | null;
  started: boolean;
};

export default class AutoKickManager {
  private abortController = new AbortController();

  private scheduleTimeout?: number;
  private checkerInterval?: number;

  private lastKick?: Date;
  private matchmakingState: MatchmakingState = {
    partyState: null,
    started: false
  };

  private constructor(private account: AccountData, private xmpp: XMPPManager) {}

  static async create(account: AccountData) {
    const accountId = account.accountId;
    AutoKickManager.updateXMPPStatus(accountId, 'LOADING');

    const xmpp = await XMPPManager.create(account, 'autoKick').catch(() => null);
    if (!xmpp) {
      AutoKickManager.updateXMPPStatus(accountId, 'INVALID_CREDENTIALS');
      throw new Error('Invalid XMPP credentials');
    }

    const manager = new AutoKickManager(account, xmpp);
    const signal = manager.abortController.signal;

    xmpp.addEventListener(ConnectionEvents.SessionStarted, async () => {
      AutoKickManager.updateXMPPStatus(accountId, 'ACTIVE');
      await manager.checkMissionOnStartup();
    }, { signal });

    xmpp.addEventListener(ConnectionEvents.Disconnected, () => {
      AutoKickManager.updateXMPPStatus(accountId, 'DISCONNECTED');
      manager.resetState();
    }, { signal });

    xmpp.addEventListener(EpicEvents.MemberDisconnected, (data) => {
      if (data.account_id !== accountId) return;

      manager.resetState();
    }, { signal });

    xmpp.addEventListener(EpicEvents.MemberExpired, (data) => {
      if (data.account_id !== accountId) return;

      manager.resetState();
    }, { signal });

    xmpp.addEventListener(EpicEvents.MemberKicked, (data) => {
      if (data.account_id !== account.accountId) return;

      if (manager.matchmakingState.partyState === 'PostMatchmaking' && manager.matchmakingState.started) {
        const automationAccount = AutoKickBase.getAccountById(account.accountId);

        if (automationAccount?.settings.autoClaim) {
          claimRewards(account).catch(console.error);
        }

        if (automationAccount?.settings.autoTransferMaterials) {
          transferBuildingMaterials(account).catch(console.error);
        }
      }
    }, { signal });

    xmpp.addEventListener(EpicEvents.MemberJoined, async (data) => {
      if (data.account_id !== accountId) return;

      AutoKickManager.updateXMPPStatus(accountId, 'ACTIVE');

      if (!manager.lastKick || (Date.now() - manager.lastKick.getTime()) > 30_000) {
        manager.scheduleMissionChecker();
      }
    }, { signal });

    xmpp.addEventListener(EpicEvents.PartyUpdated, async (data) => {
      const partyState = data.party_state_updated?.['Default:PartyState_s'];
      if (!partyState) return;

      if (partyState === 'PostMatchmaking') {
        manager.scheduleMissionChecker();
      }
    }, { signal });

    manager.xmpp = xmpp;

    try {
      await xmpp.connect();
      AutoKickManager.updateXMPPStatus(accountId, 'ACTIVE');
    } catch (error) {
      console.error(error);
      AutoKickManager.updateXMPPStatus(accountId, 'DISCONNECTED');
    }

    return manager;
  }

  scheduleMissionChecker(timeoutMs?: number) {
    if (this.scheduleTimeout) {
      clearTimeout(this.scheduleTimeout);
      this.scheduleTimeout = undefined;
    }

    this.scheduleTimeout = window.setTimeout(async () => {
      this.startMissionChecker();
    }, timeoutMs || 20_000);
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
      const matchmakingData = matchmakingResponse[0];
      const matchmakingState = this.matchmakingState;

      if (!matchmakingData) {
        const wasInMatch = matchmakingState.partyState === 'Matchmaking' || matchmakingState.partyState === 'PostMatchmaking';
        if (!wasInMatch) {
          this.resetState();
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

      this.resetState();

      const partyData = await PartyManager.get(this.account);
      const party = partyData.current[0];

      if (automationSettings.autoKick) {
        await this.kick(party).catch(console.error);
      }

      if (automationSettings.autoClaim) {
        claimRewards(this.account).catch(console.error);
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

    this.startMissionChecker();
  }

  resetState() {
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
      started: false
    };
  }

  destroy() {
    this.abortController.abort();
    this.resetState();
    this.xmpp?.removePurpose('autoKick');
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

      return PartyManager.leave(this.account, party.id);
    }

    const accountsWithNoAutoKick = membersWithoutAutoKick
      .map((id) => accounts.find(x => x.accountId === id))
      .filter(x => !!x);

    accountsWithNoAutoKick.push(this.account);

    return Promise.allSettled(accountsWithNoAutoKick.map((account) => PartyManager.leave(account, party.id)));
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

    return Promise.allSettled(friendsInParty.map((friend) => PartyManager.invite(this.account, party.id, friend.accountId)));
  }

  private static updateXMPPStatus(accountId: string, status: AutomationAccount['status']) {
    const account = AutoKickBase.getAccountById(accountId);
    if (!account) return;

    account.status = status;
    automationStore.update(s => s.map(a => a.accountId === accountId ? { ...a, status } : a));
  }
}
