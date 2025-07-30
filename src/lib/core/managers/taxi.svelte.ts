import { ConnectionEvents, EpicEvents } from '$lib/constants/events';
import FriendsManager from '$lib/core/managers/friends';
import PartyManager from '$lib/core/managers/party';
import XMPPManager from '$lib/core/managers/xmpp';
import { SvelteSet } from 'svelte/reactivity';
import homebaseRatingMapping from '$lib/data/homebase-rating-mapping.json';
import { accountPartiesStore } from '$lib/stores';
import { evaluateCurve, t } from '$lib/utils/util';
import { get } from 'svelte/store';
import type { AccountData } from '$types/accounts';
import type {
  EpicEventFriendRequest,
  EpicEventMemberJoined,
  EpicEventMemberKicked,
  EpicEventMemberLeft,
  EpicEventMemberNewCaptain,
  EpicEventMemberStateUpdated,
  EpicEventPartyPing,
  EpicEventPartyUpdated
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
  public availableStatus = $state(get(t)('taxiService.settings.availableStatus.default'));
  public busyStatus = $state(get(t)('taxiService.settings.busyStatus.default'));
  public autoAcceptFriendRequests = $state(false);
  public partyTimeoutSeconds = $state(180);

  constructor(private account: AccountData) { }

  async start() {
    this.isStarting = true;
    this.abortController = new AbortController();
    const { signal } = this.abortController;

    try {
      this.xmpp = await XMPPManager.create(this.account, 'taxiService');
      await this.xmpp.connect();

      this.xmpp.addEventListener(EpicEvents.PartyInvite, this.handleInvite.bind(this), { signal });
      this.xmpp.addEventListener(EpicEvents.FriendRequest, this.handleFriendRequest.bind(this), { signal });
      this.xmpp.addEventListener(EpicEvents.MemberNewCaptain, this.handleNewCaptain.bind(this), { signal });
      this.xmpp.addEventListener(EpicEvents.MemberJoined, this.handlePartyStateChange.bind(this), { signal });
      this.xmpp.addEventListener(EpicEvents.MemberLeft, this.handlePartyStateChange.bind(this), { signal });
      this.xmpp.addEventListener(EpicEvents.MemberKicked, this.handlePartyStateChange.bind(this), { signal });
      this.xmpp.addEventListener(EpicEvents.MemberStateUpdated, this.handlePartyStateChange.bind(this), { signal });
      this.xmpp.addEventListener(EpicEvents.PartyUpdated, this.handlePartyStateChange.bind(this), { signal });
      this.xmpp.addEventListener(ConnectionEvents.Disconnected, () => {
        this.stop();
      }, { signal });

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

    const incomingRequests = await FriendsManager.getIncoming(this.account);
    if (incomingRequests.length) await FriendsManager.acceptAllIncomingRequests(this.account, incomingRequests.map(x => x.accountId));
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

  setPowerLevel(partyId: string, revision: number) {
    return PartyManager.sendPatch(this.account, partyId, revision, this.getFortStats(), true);
  }

  private async handleInvite(invite: EpicEventPartyPing) {
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

  private async handlePartyStateChange(event: EpicEventMemberJoined | EpicEventMemberLeft | EpicEventMemberKicked | EpicEventMemberStateUpdated | EpicEventPartyUpdated) {
    if ('connection' in event && event.account_id === this.account.accountId) {
      return PartyManager.sendPatch(this.account, event.party_id, event.revision, {}, true);
    }

    if ('member_state_updated' in event) {
      const packedState = JSON.parse(event.member_state_updated['Default:PackedState_j']?.replaceAll('True', 'true') || '{}')?.PackedState;
      if (packedState?.location === 'Lobby')
        return PartyManager.leave(this.account, event.party_id);
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

  private async handleNewCaptain(data: EpicEventMemberNewCaptain) {
    if (data.account_id === this.account.accountId) {
      await PartyManager.leave(this.account, data.party_id);
    }
  }

  private async handleFriendRequest(request: EpicEventFriendRequest) {
    if (!this.autoAcceptFriendRequests || request.status !== 'PENDING') return;

    await FriendsManager.addFriend(this.account, request.from);
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