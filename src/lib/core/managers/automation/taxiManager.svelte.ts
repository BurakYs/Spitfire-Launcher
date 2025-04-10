import { EventNotifications } from '$lib/constants/events';
import BotLobbyManager from '$lib/core/managers/automation/botLobbyManager.svelte';
import FriendManager from '$lib/core/managers/friend';
import PartyManager from '$lib/core/managers/party';
import XMPPManager from '$lib/core/managers/xmpp';
import { SvelteSet } from 'svelte/reactivity';
import homebaseRatingMapping from '$lib/data/homebaseRatingMapping.json';
import { accountPartiesStore } from '$lib/stores';
import { toast } from 'svelte-sonner';
import { evaluateCurve } from '$lib/utils/util';
import type { AccountData } from '$types/accounts';
import type {
  ServiceEventFriendRequest,
  ServiceEventMemberJoined,
  ServiceEventMemberKicked,
  ServiceEventMemberLeft,
  ServiceEventMemberNewCaptain,
  ServiceEventMemberStateUpdated,
  ServiceEventPartyPing,
  ServiceEventPartyUpdated
} from '$types/game/events';

const FORT_STATS_KEY = 'Default:FORTStats_j';
const FORT_STATS_KEYS = [
  'fortitude', 'offense', 'resistance', 'tech',
  'teamFortitude', 'teamOffense', 'teamResistance', 'teamTech',
  'fortitude_Phoenix', 'offense_Phoenix', 'resistance_Phoenix', 'tech_Phoenix',
  'teamFortitude_Phoenix', 'teamOffense_Phoenix', 'teamResistance_Phoenix', 'teamTech_Phoenix'
];

export default class TaxiManager {
  private xmpp?: XMPPManager;
  private abortController?: AbortController;
  private partyTimeoutId?: number;
  public static readonly taxiAccountIds: SvelteSet<string> = new SvelteSet();
  public active = $state(false);
  public isStarting = $state(false);
  public isStopping = $state(false);
  public isAvailable = $state(false);
  public level = $state(145);
  public availableStatus = $state('Available for taxi service. Send party invite to join!');
  public busyStatus = $state('Currently in a party. Will be available soon.');
  public autoAcceptFriendRequests = $state(false);
  public partyTimeoutSeconds = $state(90);

  constructor(private account: AccountData) {}

  async start() {
    if (BotLobbyManager.botLobbyAccountIds.has(this.account.accountId)) {
      toast.error('You can\'t start taxi service while bot lobby is active.');
      return;
    }

    this.isStarting = true;
    this.abortController = new AbortController();
    const { signal } = this.abortController;

    try {
      this.xmpp = await XMPPManager.create(this.account, 'taxiService');
      await this.xmpp.connect();

      this.xmpp.addEventListener(EventNotifications.PartyInvite, this.handleInvite.bind(this), { signal });
      this.xmpp.addEventListener(EventNotifications.FriendRequest, this.handleFriendRequest.bind(this), { signal });
      this.xmpp.addEventListener(EventNotifications.MemberNewCaptain, this.handleNewCaptain.bind(this), { signal });
      this.xmpp.addEventListener(EventNotifications.MemberJoined, this.handlePartyStateChange.bind(this), { signal });
      this.xmpp.addEventListener(EventNotifications.MemberLeft, this.handlePartyStateChange.bind(this), { signal });
      this.xmpp.addEventListener(EventNotifications.MemberKicked, this.handlePartyStateChange.bind(this), { signal });
      this.xmpp.addEventListener(EventNotifications.MemberStateUpdated, this.handlePartyStateChange.bind(this), { signal });
      this.xmpp.addEventListener(EventNotifications.PartyUpdated, this.handlePartyStateChange.bind(this), { signal });

      this.setIsAvailable(true);

      await PartyManager.get(this.account);

      this.active = true;
      TaxiManager.taxiAccountIds.add(this.account.accountId);

      await this.handleFriendRequests();
    } catch (error) {
      this.isStarting = false;
      this.active = false;
      TaxiManager.taxiAccountIds.delete(this.account.accountId);

      throw error;
    } finally {
      this.isStarting = false;
    }
  }

  async stop() {
    this.isStopping = true;

    if (this.partyTimeoutId) {
      window.clearTimeout(this.partyTimeoutId);
      this.partyTimeoutId = undefined;
    }

    this.abortController?.abort();
    this.abortController = undefined;

    this.xmpp?.removePurpose('taxiService');
    this.xmpp = undefined;

    this.isStopping = false;
    this.active = false;
    TaxiManager.taxiAccountIds.delete(this.account.accountId);
  }

  async handleFriendRequests() {
    if (!this.active || !this.autoAcceptFriendRequests) return;

    const incomingRequests = await FriendManager.getIncoming(this.account);
    if (incomingRequests.length) await FriendManager.acceptAllIncomingRequests(this.account, incomingRequests.map(x => x.accountId));
  }

  setIsAvailable(available: boolean) {
    if (available) {
      this.xmpp?.setStatus(this.availableStatus, 'online');
      this.isAvailable = true;
    } else {
      this.xmpp?.setStatus(this.busyStatus, 'away');
      this.isAvailable = false;
    }
  }

  async setPowerLevel(partyId: string, revision: number) {
    return await PartyManager.sendPatch(this.account, partyId, revision, this.getFortStats(), true);
  }

  private async handleInvite(invite: ServiceEventPartyPing) {
    const currentParty = accountPartiesStore.get(this.account.accountId);
    if (currentParty?.members.length === 1) {
      await PartyManager.leave(this.account, currentParty.id);
      accountPartiesStore.delete(this.account.accountId);
    }

    const [inviterPartyData] = await PartyManager.getInviterParty(this.account, invite.pinger_id);
    await PartyManager.acceptInvite(this.account, inviterPartyData.id, invite.pinger_id, this.xmpp!.connection!.jid, this.getFortStats());
    await PartyManager.get(this.account);

    this.setIsAvailable(false);

    if (this.partyTimeoutId) {
      window.clearTimeout(this.partyTimeoutId);
    }

    this.partyTimeoutId = window.setTimeout(async () => {
      const currentParty = accountPartiesStore.get(this.account.accountId);
      if (currentParty) {
        await PartyManager.leave(this.account, currentParty.id);
        accountPartiesStore.delete(this.account.accountId);
        this.setIsAvailable(true);
      }

      this.partyTimeoutId = undefined;
    }, this.partyTimeoutSeconds * 1000);
  }

  private async handlePartyStateChange(event: ServiceEventMemberJoined | ServiceEventMemberLeft | ServiceEventMemberKicked | ServiceEventMemberStateUpdated | ServiceEventPartyUpdated) {
    if ('connection' in event && event.account_id === this.account.accountId) {
      return await PartyManager.sendPatch(this.account, event.party_id, event.revision, {}, true);
    }

    if ('member_state_updated' in event) {
      const packedState = JSON.parse(event.member_state_updated['Default:PackedState_j']?.replaceAll('True', 'true') || '{}')?.PackedState;
      if (packedState?.location === 'Lobby')
        return await PartyManager.leave(this.account, event.party_id);
    }

    const currentParty = accountPartiesStore.get(this.account.accountId);
    const isInParty = (currentParty?.members.length || 0) > 1;

    if (isInParty) {
      this.setIsAvailable(false);
    } else {
      this.setIsAvailable(true);

      if (this.partyTimeoutId) {
        window.clearTimeout(this.partyTimeoutId);
        this.partyTimeoutId = undefined;
      }
    }
  }

  private async handleNewCaptain(data: ServiceEventMemberNewCaptain) {
    if (data.account_id === this.account.accountId) {
      await PartyManager.leave(this.account, data.party_id);
    }
  }

  private async handleFriendRequest(request: ServiceEventFriendRequest) {
    if (!this.autoAcceptFriendRequests) return;

    const { payload } = request;
    if (payload.status !== 'PENDING' || payload.direction !== 'INBOUND') return;

    await FriendManager.addFriend(this.account, payload.accountId);
  }

  private getFortStats() {
    return {
      [FORT_STATS_KEY]: JSON.stringify({
        FORTStats: FORT_STATS_KEYS.reduce<Record<string, number>>((acc, key) => {
          acc[key] = this.getFORTFromPowerLevel(this.level);
          return acc;
        }, {})
      })
    };
  }

  private getFORTFromPowerLevel(powerLevel: number) {
    const lastTime = homebaseRatingMapping.at(-1)!.Time;
    const minPowerLevel = Math.round(evaluateCurve(homebaseRatingMapping, 0));
    const maxPowerLevel = Math.round(evaluateCurve(homebaseRatingMapping, lastTime));
    if (powerLevel < minPowerLevel || powerLevel > maxPowerLevel) return 0;

    let low = 0;
    let high = lastTime;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const currentPowerLevel = Math.round(evaluateCurve(homebaseRatingMapping, mid));

      if (currentPowerLevel === powerLevel) return Math.round(mid / 16);
      if (currentPowerLevel < powerLevel) low = mid + 1;
      else high = mid - 1;
    }

    return 0;
  }
}