import AvatarManager from '$lib/core/managers/avatar';
import LookupManager from '$lib/core/managers/lookup';
import { friendService } from '$lib/core/services';
import EpicAPIError from '$lib/exceptions/EpicAPIError';
import { friendsStore } from '$lib/stores';
import { processChunks } from '$lib/utils/util';
import type { AccountData } from '$types/accounts';
import Authentication from '$lib/core/authentication';
import type { BlockedAccountData, FriendData, FriendsSummary, IncomingFriendRequestData, OutgoingFriendRequestData } from '$types/game/friends';
import { get } from 'svelte/store';

export default class FriendManager {
  static async getFriend(account: AccountData, friendId: string) {
    const accessToken = await Authentication.verifyOrRefreshAccessToken(account);

    try {
      const friendData = await friendService.get<FriendData>(`${account.accountId}/friends/${friendId}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }).json();

      this.updateFriendStore(account.accountId, 'friends', friendId, friendData);

      return friendData;
    } catch (error) {
      if (error instanceof EpicAPIError) {
        if (error.errorCode === 'errors.com.epicgames.friends.friendship_not_found') {
          this.updateFriendStore(account.accountId, 'friends', friendId);
        }
      }

      throw error;
    }
  }

  static async addFriend(account: AccountData, friendId: string) {
    const accessToken = await Authentication.verifyOrRefreshAccessToken(account);

    try {
      const data = await friendService.post(`${account.accountId}/friends/${friendId}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }).json();

      const incomingRequest = get(friendsStore)[account.accountId]?.incoming.get(friendId);
      if (incomingRequest) {
        this.updateFriendStore(account.accountId, 'incoming', friendId);
        this.updateFriendStore(account.accountId, 'friends', friendId, {
          accountId: friendId,
          alias: '',
          note: '',
          favorite: false,
          created: new Date().toISOString(),
          mutual: 0
        });
      } else {
        this.updateFriendStore(account.accountId, 'outgoing', friendId, {
          accountId: friendId,
          mutual: 0,
          favorite: false,
          created: new Date().toISOString()
        });
      }

      return data;
    } catch (error) {
      if (error instanceof EpicAPIError) {
        if (error.errorCode === 'errors.com.epicgames.friends.duplicate_friendship') {
          const friend = get(friendsStore)[account.accountId]?.friends.get(friendId);
          if (!friend) this.updateFriendStore(account.accountId, 'friends', friendId, {
            accountId: friendId,
            alias: '',
            note: '',
            favorite: false,
            created: new Date().toISOString(),
            mutual: 0
          });
        }
      }

      throw error;
    }
  }

  static async removeFriend(account: AccountData, friendId: string) {
    const accessToken = await Authentication.verifyOrRefreshAccessToken(account);

    try {
      const data = await friendService.delete(`${account.accountId}/friends/${friendId}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });

      this.updateFriendStore(account.accountId, 'friends', friendId);
      this.updateFriendStore(account.accountId, 'incoming', friendId);
      this.updateFriendStore(account.accountId, 'outgoing', friendId);

      return data;
    } catch (error) {
      if (error instanceof EpicAPIError) {
        if (error.errorCode === 'errors.com.epicgames.friends.friendship_not_found') {
          this.updateFriendStore(account.accountId, 'friends', friendId);
          this.updateFriendStore(account.accountId, 'incoming', friendId);
          this.updateFriendStore(account.accountId, 'outgoing', friendId);
        }
      }

      throw error;
    }
  }

  static async removeAll(account: AccountData) {
    const accessToken = await Authentication.verifyOrRefreshAccessToken(account);

    const data = await friendService.delete(`${account.accountId}/friends`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    friendsStore.update((store) => {
      const accountFriends = store[account.accountId] || {
        friends: new Map<string, FriendData>(),
        incoming: new Map<string, IncomingFriendRequestData>(),
        outgoing: new Map<string, OutgoingFriendRequestData>(),
        blocklist: new Map<string, BlockedAccountData>()
      };

      accountFriends.friends.clear();

      return {
        ...store,
        [account.accountId]: accountFriends
      };
    });

    return data;
  }

  static async getSummary(account: AccountData) {
    const accessToken = await Authentication.verifyOrRefreshAccessToken(account);

    const data = await friendService.get<FriendsSummary>(`${account.accountId}/summary`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }).json();

    const allAccountIds = [
      ...data.friends.map(friend => friend.accountId),
      ...data.incoming.map(request => request.accountId),
      ...data.outgoing.map(request => request.accountId),
      ...data.blocklist.map(block => block.accountId)
    ];

    await Promise.allSettled([
      LookupManager.fetchByIds(account, allAccountIds),
      AvatarManager.fetchAvatars(account, allAccountIds)
    ]);

    friendsStore.update((store) => ({
      ...store,
      [account.accountId]: {
        friends: new Map(data.friends.map(friend => [friend.accountId, friend])),
        incoming: new Map(data.incoming.map(request => [request.accountId, request])),
        outgoing: new Map(data.outgoing.map(request => [request.accountId, request])),
        blocklist: new Map(data.blocklist.map(block => [block.accountId, block]))
      }
    }));

    return data;
  }

  static async getFriends(account: AccountData) {
    const accessToken = await Authentication.verifyOrRefreshAccessToken(account);

    const data = await friendService.get<FriendData[]>(`${account.accountId}/friends`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }).json();

    friendsStore.update((store) => ({
      ...store,
      [account.accountId]: {
        ...store[account.accountId],
        friends: new Map(data.map(friend => [friend.accountId, friend]))
      }
    }));

    return data;
  }

  static async getIncoming(account: AccountData) {
    const accessToken = await Authentication.verifyOrRefreshAccessToken(account);

    const data = await friendService.get<IncomingFriendRequestData[]>(`${account.accountId}/incoming`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }).json();

    friendsStore.update((store) => ({
      ...store,
      [account.accountId]: {
        ...store[account.accountId],
        incoming: new Map(data.map(request => [request.accountId, request]))
      }
    }));

    return data;
  }

  static async getOutgoing(account: AccountData) {
    const accessToken = await Authentication.verifyOrRefreshAccessToken(account);

    const data = await friendService.get<OutgoingFriendRequestData[]>(`${account.accountId}/outgoing`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }).json();

    friendsStore.update((store) => ({
      ...store,
      [account.accountId]: {
        ...store[account.accountId],
        outgoing: new Map(data.map(request => [request.accountId, request]))
      }
    }));

    return data;
  }

  static async getBlocklist(account: AccountData) {
    const accessToken = await Authentication.verifyOrRefreshAccessToken(account);

    const data = await friendService.get<BlockedAccountData[]>(`${account.accountId}/blocklist`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }).json();

    friendsStore.update((store) => ({
      ...store,
      [account.accountId]: {
        ...store[account.accountId],
        blocklist: new Map(data.map(block => [block.accountId, block]))
      }
    }));

    return data;
  }

  static async block(account: AccountData, friendId: string) {
    const accessToken = await Authentication.verifyOrRefreshAccessToken(account);

    const data = await friendService.post(`${account.accountId}/blocklist/${friendId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }).json();

    this.updateFriendStore(account.accountId, 'incoming', friendId);
    this.updateFriendStore(account.accountId, 'outgoing', friendId);
    this.updateFriendStore(account.accountId, 'friends', friendId);
    this.updateFriendStore(account.accountId, 'blocklist', friendId, {
      accountId: friendId,
      created: new Date().toISOString()
    });

    return data;
  }

  static async unblock(account: AccountData, friendId: string) {
    const accessToken = await Authentication.verifyOrRefreshAccessToken(account);

    const data = friendService.delete(`${account.accountId}/blocklist/${friendId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    this.updateFriendStore(account.accountId, 'blocklist', friendId);

    return data;
  }

  static async changeNickname(account: AccountData, friendId: string, nickname: string) {
    const accessToken = await Authentication.verifyOrRefreshAccessToken(account);

    const data = await friendService.put(`${account.accountId}/friends/${friendId}/alias`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'text/plain',
        Authorization: `Bearer ${accessToken}`
      },
      body: nickname
    });

    const friend = get(friendsStore)[account.accountId]?.friends.get(friendId) || {
      accountId: friendId,
      alias: '',
      note: '',
      favorite: false,
      created: new Date().toISOString(),
      mutual: 0
    };

    this.updateFriendStore(account.accountId, 'friends', friendId, {
      ...friend,
      alias: nickname
    });

    return data;
  }

  static async acceptAllIncomingRequests(account: AccountData, accountIds: string[]) {
    const MAX_IDS_PER_REQUEST = 100;
    const accessToken = await Authentication.verifyOrRefreshAccessToken(account);

    const acceptedRequests = new Set(await processChunks(
      accountIds,
      MAX_IDS_PER_REQUEST,
      async (ids) => {
        return friendService.post<string[]>(
          `${account.accountId}/incoming/accept?targetIds=${ids.join(',')}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`
            },
            json: {}
          }
        ).json();
      }
    ));

    for (const friendId of acceptedRequests) {
      this.updateFriendStore(account.accountId, 'incoming', friendId);
      this.updateFriendStore(account.accountId, 'friends', friendId, {
        accountId: friendId,
        alias: '',
        note: '',
        favorite: false,
        created: new Date().toISOString(),
        mutual: 0
      });
    }

    return acceptedRequests;
  }

  private static updateFriendStore<K extends 'friends' | 'incoming' | 'outgoing' | 'blocklist'>(
    accountId: string,
    collection: K,
    friendId: string,
    data?: K extends 'friends' ? FriendData
      : K extends 'incoming' ? IncomingFriendRequestData
        : K extends 'outgoing' ? OutgoingFriendRequestData
          : K extends 'blocklist' ? BlockedAccountData
            : never
  ) {
    friendsStore.update((store) => {
      const accountFriends = store[accountId] || {
        friends: new Map<string, FriendData>(),
        incoming: new Map<string, IncomingFriendRequestData>(),
        outgoing: new Map<string, OutgoingFriendRequestData>(),
        blocklist: new Map<string, BlockedAccountData>()
      };

      if (data) {
        accountFriends[collection].set(friendId, data as never);
      } else {
        accountFriends[collection].delete(friendId);
      }

      return {
        ...store,
        [accountId]: accountFriends
      };
    });
  }
}