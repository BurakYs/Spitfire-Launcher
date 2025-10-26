import type { BlockedAccountData, FriendData, IncomingFriendRequestData, OutgoingFriendRequestData } from '$types/game/friends';
import type { PartyData } from '$types/game/party';
import type { ParsedApp } from '$types/legendary';
import { SvelteMap, SvelteSet } from 'svelte/reactivity';
import { writable } from 'svelte/store';
import type { AccountStoreData } from '$types/accounts';
import type { ParsedWorldInfo } from '$types/game/stw/world-info';
import type { EpicOAuthData } from '$types/game/authorizations';
import type { AutomationSetting } from '$types/settings';
import type { AutomationAccount } from '$lib/core/managers/autokick/base';
import type { SpitfireShop } from '$types/game/shop';

// Prevents redirecting the user to the home page in bulk operations if a credential error occurs in accounts
export const doingBulkOperations = writable<boolean>(false);
export const automationStore = writable<(AutomationSetting & { status: AutomationAccount['status'] })[]>([]);
export const runningAppIds = new SvelteSet<string>();

export const ownedItemsStore = writable<Record<string, Set<string>>>({});
export const ownedApps = writable<ParsedApp[]>([]);
export const displayNamesCache = new SvelteMap<string, string>();
export const avatarCache = new SvelteMap<string, string>();
export const accessTokenCache = writable<Record<string, EpicOAuthData>>({});
export const worldInfoCache = writable<ParsedWorldInfo>(new Map());
export const brShopStore = writable<SpitfireShop>();
export const accountPartiesStore = new SvelteMap<string, PartyData>();
export const accountDataStore = writable<Record<string, AccountStoreData>>({});
export const friendsStore = writable<Record<string, {
  friends: Map<string, FriendData>;
  incoming: Map<string, IncomingFriendRequestData>;
  outgoing: Map<string, OutgoingFriendRequestData>;
  blocklist: Map<string, BlockedAccountData>;
}>>({});