import AsyncLock from '$lib/utils/async-lock';
import Authentication from '$lib/core/authentication';
import { accountsStorage } from '$lib/core/data-storage';
import PartyManager from '$lib/core/managers/party';
import FriendsManager from '$lib/core/managers/friends';
import EventEmitter from '$lib/utils/event-emitter';
import { accountPartiesStore, friendsStore } from '$lib/stores';
import { ConnectionEvents, EpicEvents } from '$lib/constants/events';
import { get } from 'svelte/store';
import { type Agent, createClient } from 'stanza';
import type { AccountData } from '$types/accounts';
import type { PartyMember } from '$types/game/party';
import type {
  EpicEventFriendRemoved,
  EpicEventFriendRequest,
  EpicEventInteractionNotification,
  EpicEventMemberConnected,
  EpicEventMemberDisconnected,
  EpicEventMemberExpired,
  EpicEventMemberJoined,
  EpicEventMemberKicked,
  EpicEventMemberLeft,
  EpicEventMemberNewCaptain,
  EpicEventMemberStateUpdated,
  EpicEventPartyPing,
  EpicEventPartyUpdated
} from '$types/game/events';

type EventMap = {
  [EpicEvents.MemberConnected]: EpicEventMemberConnected;
  [EpicEvents.MemberDisconnected]: EpicEventMemberDisconnected;
  [EpicEvents.MemberExpired]: EpicEventMemberExpired;
  [EpicEvents.MemberJoined]: EpicEventMemberJoined;
  [EpicEvents.MemberKicked]: EpicEventMemberKicked;
  [EpicEvents.MemberLeft]: EpicEventMemberLeft;
  [EpicEvents.MemberStateUpdated]: EpicEventMemberStateUpdated;
  [EpicEvents.MemberNewCaptain]: EpicEventMemberNewCaptain;
  [EpicEvents.PartyUpdated]: EpicEventPartyUpdated;
  [EpicEvents.PartyInvite]: EpicEventPartyPing;
  [EpicEvents.FriendRequest]: EpicEventFriendRequest;
  [EpicEvents.FriendRemove]: EpicEventFriendRemoved;
  [EpicEvents.InteractionNotification]: EpicEventInteractionNotification;

  [ConnectionEvents.SessionStarted]: void;
  [ConnectionEvents.Connected]: void;
  [ConnectionEvents.Disconnected]: void;
};

type AccountOptions = AccountData & {
  accessToken: string;
};

type Purpose = 'autoKick' | 'taxiService' | 'customStatus' | 'partyManagement' | 'friendsManagement';

const MAX_RECONNECT_ATTEMPTS = 50;

const connectionLocks = new Map<string, AsyncLock>();

export default class XMPPManager extends EventEmitter<EventMap> {
  public static instances = new Map<string, XMPPManager>();
  public connection?: Agent;
  private purposes = new Set<Purpose>();

  private reconnectTimeout?: number;
  private intentionalDisconnect = false;
  private reconnectAttempts = 0;

  private constructor(private account: AccountOptions, purpose: Purpose) {
    super();
    this.purposes.add(purpose);
  }

  get accountId() {
    return this.account?.accountId;
  }

  static create(account: AccountData, purpose: Purpose) {
    let lock = connectionLocks.get(account.accountId);
    if (!lock) {
      lock = new AsyncLock();
      connectionLocks.set(account.accountId, lock);
    }

    return lock.withLock(async () => {
      const existingInstance = XMPPManager.instances.get(account.accountId);
      if (existingInstance) {
        existingInstance.purposes.add(purpose);
        return existingInstance;
      }

      const accessTokenData = await Authentication.getAccessTokenUsingDeviceAuth(account, false);
      const instance = new XMPPManager({ ...account, accessToken: accessTokenData.access_token }, purpose);
      XMPPManager.instances.set(account.accountId, instance);

      return instance;
    });
  }

  async connect() {
    if (this.connection?.sessionStarted) return;

    const server = 'prod.ol.epicgames.com';

    const resourceHash = window.crypto.getRandomValues(new Uint8Array(16))
      .reduce((hex, byte) => hex + byte.toString(16).padStart(2, '0'), '')
      .toUpperCase();

    this.connection = createClient({
      jid: `${this.account.accountId}@${server}`,
      server,
      transports: {
        websocket: `wss://xmpp-service-${server}`,
        bosh: false
      },
      credentials: {
        host: server,
        username: this.account.accountId,
        password: this.account.accessToken
      },
      resource: `V2:Fortnite:WIN::${resourceHash}`
    });

    this.connection.enableKeepAlive({
      interval: 30
    });

    this.setupEvents();

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 15000);

      this.connection!.once('session:started', () => {
        this.intentionalDisconnect = false;
        this.reconnectAttempts = 0;

        if (this.reconnectTimeout) {
          clearTimeout(this.reconnectTimeout);
          this.reconnectTimeout = undefined;
        }

        clearTimeout(timeout);
        resolve();
      });

      this.connection!.once('stream:error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });

      this.connection!.connect();
    });
  }

  disconnect() {
    this.intentionalDisconnect = true;

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = undefined;
    }

    this.emit(ConnectionEvents.Disconnected, undefined);
    this.connection?.removeAllListeners();
    this.connection?.disconnect();
    this.connection = undefined;
    this.removeAllListeners();

    XMPPManager.instances.delete(this.account.accountId);
    this.account = undefined!;
  }

  removePurpose(purpose: Purpose) {
    this.purposes.delete(purpose);

    if (!this.purposes.size) {
      this.disconnect();
    }
  }

  setStatus(status: string, onlineType: 'online' | 'away' | 'chat' | 'dnd' | 'xa' = 'online') {
    if (!this.connection?.sessionStarted) throw new Error('Connection not established');

    return this.connection.sendPresence({
      status: JSON.stringify({
        Status: status,
        bIsPlaying: false,
        bIsJoinable: false
      }),
      show: onlineType === 'online' ? undefined : onlineType,
      delay: {
        timestamp: new Date('9999-12-31T23:59:59.999Z')
      }
    });
  }

  resetStatus() {
    if (!this.connection?.sessionStarted) throw new Error('Connection not established');

    return this.connection.sendPresence({
      status: JSON.stringify({
        Status: '',
        bIsPlaying: false,
        bIsJoinable: false
      })
    });
  }

  private getReconnectDelay() {
    return Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30_000);
  }

  private async tryReconnect() {
    if (this.intentionalDisconnect || this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) return;

    try {
      await this.connect();
    } catch (error) {
      console.error(error);
      this.reconnectAttempts++;

      if (!this.intentionalDisconnect && this.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        const delay = this.getReconnectDelay();
        this.reconnectTimeout = window.setTimeout(() => this.tryReconnect(), delay);
      }
    }
  }

  private setupEvents() {
    if (!this.connection) return;

    this.connection.on('session:started', () => {
      this.emit(ConnectionEvents.SessionStarted, undefined);
    });

    this.connection.on('connected', () => {
      this.emit(ConnectionEvents.Connected, undefined);

      this.reconnectAttempts = 0;
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = undefined;
      }
    });

    this.connection.on('disconnected', async () => {
      this.emit(ConnectionEvents.Disconnected, undefined);

      if (!this.intentionalDisconnect && !this.reconnectTimeout) {
        const delay = this.getReconnectDelay();
        this.reconnectTimeout = window.setTimeout(() => this.tryReconnect(), delay);
        await this.tryReconnect();
      }
    });

    this.connection.on('message', async (message) => {
      if (
        (message.type && message.type !== 'normal')
        || !message.body
        || message.from !== 'xmpp-admin@prod.ol.epicgames.com'
      ) return;

      let body: any;
      try {
        body = JSON.parse(message.body);
      } catch {
        return;
      }

      const { type } = body;
      if (!type) return;

      switch (type) {
        case EpicEvents.MemberStateUpdated: {
          this.handleMemberStateUpdated(body as EpicEventMemberStateUpdated);
          break;
        }
        case EpicEvents.PartyUpdated: {
          this.handlePartyUpdated(body as EpicEventPartyUpdated);
          break;
        }
        case EpicEvents.MemberJoined: {
          await this.handleMemberJoin(body as EpicEventMemberJoined);
          break;
        }
        case EpicEvents.MemberExpired:
        case EpicEvents.MemberLeft:
        case EpicEvents.MemberKicked: {
          this.handleMemberLeave(body as EpicEventMemberLeft | EpicEventMemberKicked | EpicEventMemberExpired);
          break;
        }
        case EpicEvents.MemberNewCaptain: {
          this.handleMemberNewCaptain(body as EpicEventMemberNewCaptain);
          break;
        }
        case EpicEvents.FriendRequest: {
          this.handleFriendRequest(body as EpicEventFriendRequest);
          break;
        }
        case EpicEvents.FriendRemove: {
          this.handleFriendRemoved(body as EpicEventFriendRemoved);
          break;
        }
      }

      this.emit(type, body);
    });
  }

  private handleMemberStateUpdated(data: EpicEventMemberStateUpdated) {
    const parties = Array.from(accountPartiesStore.entries()).filter(([, party]) => party.id === data.party_id);

    for (const [accountId, party] of parties) {
      const partyMember = party.members.find((member) => member.account_id === data.account_id);
      if (!partyMember) continue;

      party.revision = data.revision;
      party.updated_at = data.updated_at;
      partyMember.joined_at = data.joined_at;
      partyMember.updated_at = data.updated_at;

      if (data.member_state_removed) {
        for (const state of data.member_state_removed) {
          delete partyMember.meta[state];
        }
      }

      if (data.member_state_updated) {
        partyMember.meta = { ...partyMember.meta, ...data.member_state_updated };
      }

      if (data.member_state_overridden) {
        partyMember.meta = { ...partyMember.meta, ...data.member_state_overridden };
      }

      accountPartiesStore.set(accountId, { ...party });
    }
  }

  private handlePartyUpdated(data: EpicEventPartyUpdated) {
    const parties = Array.from(accountPartiesStore.entries()).filter(([, party]) => party.id === data.party_id);
    if (!parties.length) return;

    for (const [accountId, party] of parties) {
      party.id = data.party_id;
      party.revision = data.revision;
      party.updated_at = data.updated_at;
      party.config = {
        ...party.config,
        type: data.party_type,
        intention_ttl: data.intention_ttl_seconds,
        invite_ttl: data.invite_ttl_seconds,
        max_size: data.max_number_of_members,
        sub_type: data.party_sub_type,
        joinability: data.party_privacy_type
      };

      party.members = party.members.map((member) => ({
        ...member,
        role: member.account_id === data.captain_id ? 'CAPTAIN' : 'MEMBER'
      }));

      if (data.party_state_removed) {
        for (const state of data.party_state_removed) {
          delete party.meta[state];
        }
      }

      if (data.party_state_updated) {
        party.meta = { ...party.meta, ...data.party_state_updated };
      }

      if (data.party_state_overridden) {
        party.meta = { ...party.meta, ...data.party_state_overridden };
      }

      accountPartiesStore.set(accountId, { ...party });
    }
  }

  private handleMemberLeave(data: EpicEventMemberLeft | EpicEventMemberKicked | EpicEventMemberExpired) {
    accountPartiesStore.delete(data.account_id);

    const parties = Array.from(accountPartiesStore.entries()).filter(([, party]) => party.id === data.party_id);
    for (const [accountId, party] of parties) {
      party.members = party.members.filter((member) => member.account_id !== data.account_id);
      party.revision = data.revision || party.revision;

      accountPartiesStore.set(accountId, { ...party });
    }
  }

  private async handleMemberJoin(data: EpicEventMemberJoined) {
    const parties = Array.from(accountPartiesStore.entries()).filter(([, party]) => party.id === data.party_id);

    const newMember: PartyMember = {
      account_id: data.account_id,
      revision: data.revision,
      connections: [data.connection],
      meta: data.member_state_updated,
      joined_at: data.joined_at,
      updated_at: data.updated_at,
      role: 'MEMBER'
    };

    for (const [accountId, party] of parties) {
      party.members = [...party.members, newMember];
      party.revision = data.revision;
      party.updated_at = data.updated_at || party.updated_at;

      accountPartiesStore.set(accountId, { ...party });
    }

    const joiningAccount = get(accountsStorage).accounts.find((account) => account.accountId === data.account_id);
    if (joiningAccount) {
      const partyData = await PartyManager.get(joiningAccount).catch(() => null);
      if (!partyData) accountPartiesStore.delete(data.account_id);
    }
  }

  private handleMemberNewCaptain(data: EpicEventMemberNewCaptain) {
    const parties = Array.from(accountPartiesStore.entries()).filter(([, party]) => party.id === data.party_id);

    for (const [accountId, party] of parties) {
      party.members = party.members.map((member) => ({
        ...member,
        role: member.account_id === data.account_id ? 'CAPTAIN' : 'MEMBER'
      }));

      party.revision = data.revision || party.revision;
      accountPartiesStore.set(accountId, { ...party });
    }
  }

  private handleFriendRequest(data: EpicEventFriendRequest) {
    friendsStore.update((friends) => {
      const newFriends = friends[this.accountId] || {
        friends: new Map(),
        incoming: new Map(),
        outgoing: new Map(),
        blocklist: new Map()
      };

      if (data.status === 'PENDING') {
        if (data.from === this.accountId) {
          FriendsManager.cacheAccountNameAndAvatar(this.account, data.to);
          newFriends.outgoing.set(data.to, {
            accountId: data.to,
            mutual: 0,
            favorite: false,
            created: data.timestamp
          });
        } else {
          FriendsManager.cacheAccountNameAndAvatar(this.account, data.from);
          newFriends.incoming.set(data.from, {
            accountId: data.from,
            mutual: 0,
            favorite: false,
            created: data.timestamp
          });
        }
      } else if (data.status === 'ACCEPTED') {
        const friendId = data.from === this.accountId ? data.to : data.from;

        FriendsManager.cacheAccountNameAndAvatar(this.account, friendId);
        newFriends.incoming.delete(friendId);
        newFriends.outgoing.delete(friendId);
        newFriends.friends.set(friendId, {
          accountId: friendId,
          mutual: 0,
          alias: '',
          note: '',
          favorite: false,
          created: data.timestamp
        });
      }

      return {
        ...friends,
        [this.accountId]: newFriends
      };
    });
  }

  private handleFriendRemoved(data: EpicEventFriendRemoved) {
    friendsStore.update((friends) => {
      const newFriends = friends[this.accountId] || {
        friends: new Map(),
        incoming: new Map(),
        outgoing: new Map(),
        blocklist: new Map()
      };

      const friendId = data.from === this.accountId ? data.to : data.from;
      newFriends.friends.delete(friendId);
      newFriends.incoming.delete(friendId);
      newFriends.outgoing.delete(friendId);

      return {
        ...friends,
        [this.accountId]: newFriends
      };
    });
  }
}