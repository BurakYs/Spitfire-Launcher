import FriendsManager from '$lib/core/managers/friends';
import XMPPManager from '$lib/core/managers/xmpp';
import { getResolvedResults, sleep } from '$lib/utils/util';
import type { AccountData } from '$types/accounts';
import MatchmakingManager from '$lib/core/managers/matchmaking';
import { ConnectionEvents, EpicEvents } from '$lib/constants/events';
import AutoKickBase from '$lib/core/managers/autokick/base';
import PartyManager from '$lib/core/managers/party';
import claimRewards from '$lib/core/managers/autokick/claim-rewards';
import transferBuildingMaterials from '$lib/core/managers/autokick/transfer-building-materials';
import { accountsStorage, settingsStorage } from '$lib/core/data-storage';
import { get } from 'svelte/store';
import type { PartyData } from '$types/game/party';

type State = 'lobby' | 'pregame' | 'mission' | 'endgame';

export default class AutoKickManager {
  private abortController = new AbortController();

  private scheduleTimeout?: number;
  private checkerInterval?: number;

  private currentState: State = 'lobby';
  private previousStarted = false;
  private lastKick?: Date;

  private constructor(private account: AccountData, private xmpp: XMPPManager) {}

  static async create(account: AccountData) {
    const accountId = account.accountId;
    AutoKickBase.updateStatus(accountId, 'LOADING');

    const xmpp = await XMPPManager.create(account, 'autoKick').catch(() => null);
    if (!xmpp) {
      AutoKickBase.updateStatus(accountId, 'INVALID_CREDENTIALS');
      throw new Error('Invalid XMPP credentials');
    }

    const manager = new AutoKickManager(account, xmpp);
    const signal = manager.abortController.signal;

    xmpp.on(ConnectionEvents.SessionStarted, async () => {
      AutoKickBase.updateStatus(accountId, 'ACTIVE');

      const state = await manager.checkMissionState();
      manager.currentState = state;

      if (state === 'pregame') {
        manager.scheduleMissionChecker(60_000);
      }

      if (state === 'mission') {
        manager.startMissionChecker();
      }

      if (state === 'endgame') {
        manager.resetState();
        await manager.postMissionActions();
      }
    }, { signal });

    xmpp.on(ConnectionEvents.Disconnected, () => {
      AutoKickBase.updateStatus(accountId, 'DISCONNECTED');
      manager.resetState();
    }, { signal });

    xmpp.on(EpicEvents.MemberDisconnected, (data) => {
      if (data.account_id !== accountId) return;

      manager.resetState();
    }, { signal });

    xmpp.on(EpicEvents.MemberExpired, (data) => {
      if (data.account_id !== accountId) return;

      manager.resetState();
    }, { signal });

    xmpp.on(EpicEvents.MemberJoined, async (data) => {
      if (data.account_id !== accountId) return;

      AutoKickBase.updateStatus(accountId, 'ACTIVE');

      if (!manager.lastKick || (Date.now() - manager.lastKick.getTime()) > 20_000) {
        manager.scheduleMissionChecker(20_000);
      }
    }, { signal });

    xmpp.on(EpicEvents.PartyUpdated, async (data) => {
      const partyState = data.party_state_updated?.['Default:PartyState_s'];
      if (partyState === 'PostMatchmaking') {
        manager.scheduleMissionChecker(60_000);
      }
    }, { signal });

    try {
      await xmpp.connect();
      AutoKickBase.updateStatus(accountId, 'ACTIVE');
    } catch (error) {
      console.error(error);
      AutoKickBase.updateStatus(accountId, 'DISCONNECTED');
    }

    return manager;
  }

  scheduleMissionChecker(timeoutMs: number) {
    clearTimeout(this.scheduleTimeout);
    this.scheduleTimeout = window.setTimeout(async () => {
      this.startMissionChecker();
    }, timeoutMs);
  }

  startMissionChecker() {
    const settings = get(settingsStorage);
    const intervalMs = (settings.app?.missionCheckInterval || 5) * 1000;

    clearInterval(this.checkerInterval);
    this.checkerInterval = window.setInterval(async () => {
      const state = await this.checkMissionState();
      const previousState = this.currentState;
      this.currentState = state;

      if (state === 'endgame') {
        this.resetState();
        await this.postMissionActions();
        return;
      }

      if (state === 'lobby') {
        this.resetState();

        // If the user was kicked, previousState would be 'mission'
        if (previousState === 'mission') {
          await this.postMissionActions();
        }
      }
    }, intervalMs);
  }

  resetState() {
    this.currentState = 'lobby';
    this.previousStarted = false;

    clearInterval(this.checkerInterval);
    clearTimeout(this.scheduleTimeout);
  }

  destroy() {
    this.abortController.abort();
    this.resetState();
    this.xmpp?.removePurpose('autoKick');
  }

  async checkMissionState(): Promise<State> {
    // todo: instead of spamming findPlayer, we could use the PackedState changes from XMPP, but the event doesn't fire reliably
    const matchmakingResponse = await MatchmakingManager.findPlayer(this.account, this.account.accountId);
    if (!matchmakingResponse?.length) {
      this.previousStarted = false;
      return 'lobby';
    }

    const matchmakingData = matchmakingResponse[0];
    const started = matchmakingData.started || false;

    let state: State;

    if (this.previousStarted && !started) {
      state = 'endgame';
    } else if (started) {
      state = 'mission';
    } else {
      // If Auto-Kick starts while the user is in endgame, this will think it’s pregame
      // We can ignore this for now. But might change it later
      state = 'pregame';
    }

    this.previousStarted = started;
    return state;
  }

  async postMissionActions() {
    const automationSettings = AutoKickBase.accounts.get(this.account.accountId)?.settings || {};

    const partyData = await PartyManager.get(this.account);
    const party = partyData.current[0] as PartyData | undefined;

    this.lastKick = new Date();

    let kickPromise = Promise.resolve();
    if (automationSettings.autoKick && party) {
      kickPromise = this.kick(party).catch(console.error);
    }

    if (automationSettings.autoClaim) {
      claimRewards(this.account).catch(console.error);
    }

    if (automationSettings.autoTransferMaterials) {
      kickPromise.finally(() => {
        transferBuildingMaterials(this.account).catch(console.error);
      });
    }

    if (
      party
      && automationSettings.autoKick
      && automationSettings.autoInvite
      && party.members.find((x) => x.account_id === this.account.accountId)?.role === 'CAPTAIN'
      && party.members.filter((x) => x.account_id !== this.account.accountId).length
    ) {
      kickPromise.finally(() => {
        this.invite(party.members).catch(console.error);
      });
    }
  }

  private async kick(party: PartyData) {
    const { accounts } = get(accountsStorage);

    const partyMemberIds = party.members.map((x) => x.account_id);
    const partyLeaderId = party.members.find((x) => x.role === 'CAPTAIN')!.account_id;
    const partyLeaderAccount = accounts.find((x) => x.accountId === partyLeaderId);

    const membersWithAutoKick = partyMemberIds.filter((id) => AutoKickBase.accounts.get(id)?.settings.autoKick);
    const membersWithoutAutoKick = partyMemberIds.filter((id) => !membersWithAutoKick.includes(id));

    if (partyLeaderAccount) {
      const accountsWithNoAutoKick = membersWithoutAutoKick.filter((id) => id !== this.account.accountId);
      await Promise.allSettled(accountsWithNoAutoKick.map((id) => PartyManager.kick(partyLeaderAccount, party.id, id)));

      return PartyManager.leave(this.account, party.id);
    }

    const accountsWithNoAutoKick = membersWithoutAutoKick
      .map((id) => accounts.find((x) => x.accountId === id))
      .filter((x) => !!x);

    accountsWithNoAutoKick.push(this.account);

    return Promise.allSettled(accountsWithNoAutoKick.map((account) => PartyManager.leave(account, party.id)));
  }

  private async invite(members: PartyData['members']) {
    await this.xmpp.waitForEvent(EpicEvents.MemberJoined, (data) => data.account_id === this.account.accountId, 20000);
    await sleep(5000);

    const [partyData, friends] = await getResolvedResults([
      PartyManager.get(this.account),
      FriendsManager.getFriends(this.account)
    ]);

    const party = partyData?.current[0];
    if (!party || !friends?.length) return;

    const partyMemberIds = members.map((x) => x.account_id).filter((x) => x !== this.account.accountId);
    const friendsInParty = friends.filter((friend) => partyMemberIds.includes(friend.accountId));

    return Promise.allSettled(friendsInParty.map((friend) => PartyManager.invite(this.account, party.id, friend.accountId)));
  }
}
