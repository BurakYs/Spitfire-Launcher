import Authentication from '$lib/core/authentication';
import { accountsStorage } from '$lib/core/data-storage';
import PartyManager from '$lib/core/managers/party';
import EventEmitter from '$lib/utils/event-emitter';
import { accountPartiesStore, friendsStore } from '$lib/stores';
import { ConnectionEvents, EpicEvents } from '$lib/constants/events';
import { get } from 'svelte/store';
import { type Agent, createClient } from 'stanza';
import type { AccountData } from '$types/accounts';
import type { BlockedAccountData, FriendData, IncomingFriendRequestData, OutgoingFriendRequestData } from '$types/game/friends';
import type { PartyMember } from '$types/game/party';
import type { Presence } from 'stanza/protocol';
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

type AccountOptions = {
  accountId: string;
  accessToken: string;
};

type Purpose = 'autoKick' | 'taxiService' | 'customStatus' | 'partyManagement' | 'friendsManagement';

const MAX_RECONNECT_ATTEMPTS = 50;

export default class XMPPManager extends EventEmitter<EventMap> {
  public static instances = new Map<string, XMPPManager>();
  public connection?: Agent;
  private purposes: Set<Purpose>;
  private heartbeatInterval?: number;

  private reconnectInterval?: number;
  private intentionalDisconnect = false;
  private reconnectAttempts = 0;

  private constructor(private account: AccountOptions, purpose: Purpose) {
    super();
    this.purposes = new Set([purpose]);
  }

  static async create(account: AccountData, purpose: Purpose) {
    const existingInstance = XMPPManager.instances.get(account.accountId);
    if (existingInstance) {
      existingInstance.purposes.add(purpose);
      return existingInstance;
    }

    const accessTokenData = await Authentication.getAccessTokenUsingDeviceAuth(account, false);
    const instance = new XMPPManager({ accountId: account.accountId, accessToken: accessTokenData.access_token }, purpose);
    XMPPManager.instances.set(account.accountId, instance);

    return instance;
  }

  async connect() {
    if (this.connection?.jid) return;

    this.intentionalDisconnect = false;
    this.reconnectAttempts = 0;

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
        clearTimeout(timeout);
        XMPPManager.instances.set(this.account.accountId, this);
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

    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
      this.reconnectInterval = undefined;
    }

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
    }

    this.dispatchEvent(ConnectionEvents.Disconnected, undefined);
    this.connection?.removeAllListeners();
    this.connection?.disconnect();
    this.connection = undefined;
    this.clearListeners();

    XMPPManager.instances.delete(this.account.accountId);
    this.account = undefined!;
  }

  get accountId() {
    return this.account?.accountId;
  }

  removePurpose(purpose: Purpose) {
    this.purposes.delete(purpose);

    if (!this.purposes.size) this.disconnect();
  }

  private async tryReconnect() {
    if (this.intentionalDisconnect || this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) return;

    try {
      await this.connect();

      if (this.reconnectInterval) {
        clearInterval(this.reconnectInterval);
        this.reconnectInterval = undefined;
      }

      this.reconnectAttempts = 0;
    } catch (error) {
      console.error(error);
      this.reconnectAttempts++;
    }
  }

  private setupEvents() {
    if (!this.connection) return;

    this.connection.on('session:started', () => {
      this.dispatchEvent(ConnectionEvents.SessionStarted, undefined);
    });

    this.connection.on('connected', () => {
      this.dispatchEvent(ConnectionEvents.Connected, undefined);

      this.reconnectAttempts = 0;
      if (this.reconnectInterval) {
        clearInterval(this.reconnectInterval);
        this.reconnectInterval = undefined;
      }
    });

    this.connection.on('disconnected', async () => {
      this.dispatchEvent(ConnectionEvents.Disconnected, undefined);

      if (!this.intentionalDisconnect && !this.reconnectInterval) {
        this.reconnectInterval = window.setInterval(() => this.tryReconnect(), 5000);
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

      switch (body.type) {
        case EpicEvents.MemberStateUpdated: {
          const data = body as EpicEventMemberStateUpdated;
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

          break;
        }
        case EpicEvents.PartyUpdated: {
          const data = body as EpicEventPartyUpdated;
          const parties = Array.from(accountPartiesStore.entries()).filter(([, party]) => party.id === data.party_id);
          if (!parties.length) break;

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

          break;
        }
        case EpicEvents.MemberExpired:
        case EpicEvents.MemberLeft:
        case EpicEvents.MemberKicked: {
          const data = body as EpicEventMemberLeft | EpicEventMemberKicked | EpicEventMemberExpired;

          accountPartiesStore.delete(data.account_id);

          const parties = Array.from(accountPartiesStore.entries()).filter(([, party]) => party.id === data.party_id);
          for (const [accountId, party] of parties) {
            party.members = party.members.filter(member => member.account_id !== data.account_id);
            party.revision = data.revision || party.revision;

            accountPartiesStore.set(accountId, { ...party });
          }

          break;
        }
        case EpicEvents.MemberJoined: {
          const data = body as EpicEventMemberJoined;
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

          const joiningAccount = get(accountsStorage).accounts.find(account => account.accountId === data.account_id);
          if (joiningAccount) {
            const partyData = await PartyManager.get(joiningAccount).catch(() => null);
            if (!partyData) accountPartiesStore.delete(data.account_id);
          }

          break;
        }
        case EpicEvents.MemberNewCaptain: {
          const data = body as EpicEventMemberNewCaptain;
          const parties = Array.from(accountPartiesStore.entries()).filter(([, party]) => party.id === data.party_id);

          for (const [accountId, party] of parties) {
            party.members = party.members.map((member) => ({
              ...member,
              role: member.account_id === data.account_id ? 'CAPTAIN' : 'MEMBER'
            }));

            party.revision = data.revision || party.revision;
            accountPartiesStore.set(accountId, { ...party });
          }

          break;
        }
        case EpicEvents.FriendRequest: {
          const data = body as EpicEventFriendRequest;

          friendsStore.update((friends) => {
            const account = friends[data.to] || {
              friends: new Map<string, FriendData>(),
              incoming: new Map<string, IncomingFriendRequestData>(),
              outgoing: new Map<string, OutgoingFriendRequestData>(),
              blocklist: new Map<string, BlockedAccountData>()
            };

            if (data.status === 'PENDING') {
              account.incoming.set(data.from, {
                accountId: data.from,
                mutual: 0,
                favorite: false,
                created: data.timestamp
              });
            } else if (data.status === 'ACCEPTED') {
              account.friends.set(data.from, {
                accountId: data.from,
                mutual: 0,
                alias: '',
                note: '',
                favorite: false,
                created: data.timestamp
              });
            }

            return {
              ...friends,
              [data.to]: account
            };
          });

          break;
        }
        case EpicEvents.FriendRemove: {
          const data = body as EpicEventFriendRemoved;

          friendsStore.update((friends) => {
            const account = friends[data.to] || {
              friends: new Map<string, FriendData>(),
              incoming: new Map<string, IncomingFriendRequestData>(),
              outgoing: new Map<string, OutgoingFriendRequestData>(),
              blocklist: new Map<string, BlockedAccountData>()
            };

            account.friends.delete(data.from);
            account.incoming.delete(data.from);
            account.outgoing.delete(data.from);

            return {
              ...friends,
              [data.to]: account
            };
          });

          break;
        }
      }

      this.dispatchEvent(type, body);
    });
  }

  setStatus(status: string, onlineType: 'online' | 'away' | 'chat' | 'dnd' | 'xa' = 'online') {
    if (!this.connection) throw new Error('Connection not established');

    const presenceData: Presence = {
      status: JSON.stringify({
        Status: status,
        bIsPlaying: false,
        bIsJoinable: false
      }),
      show: onlineType === 'online' ? undefined : onlineType
    };

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = window.setInterval(() => {
      if (!this.connection) {
        clearInterval(this.heartbeatInterval!);
        this.heartbeatInterval = undefined;
        return;
      }

      this.connection.sendPresence(presenceData);
    }, 15000);

    return this.connection.sendPresence(presenceData);
  }

  resetStatus() {
    if (!this.connection) throw new Error('Connection not established');

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
    }

    return this.connection.sendPresence({
      status: JSON.stringify({
        Status: '',
        bIsPlaying: false,
        bIsJoinable: false
      })
    });
  }
}