import type { BlockedAccountData, FriendData, IncomingFriendRequestData, OutgoingFriendRequestData } from '$types/game/friends';
import type { PartyData } from '$types/game/party';
import type { ParsedApp } from '$types/legendary';
import { SvelteMap, SvelteSet } from 'svelte/reactivity';
import { writable } from 'svelte/store';
import type { AccountStoreData } from '$types/accounts';
import type { ParsedWorldInfo } from '$types/game/stw/worldInfo';
import type { EpicOAuthData } from '$types/game/authorizations';
import type { AutomationSetting } from '$types/settings';
import type { AutomationAccount } from '$lib/core/managers/autokick-base';
import type { SpitfireShop } from '$types/game/shop';

// To prevent redirecting the user to the home page in bulk operations if there is a credential error
export const doingBulkOperations = writable<boolean>(false);
export const displayNamesCache = new SvelteMap<string, string>();
export const avatarCache = new SvelteMap<string, string>();
export const accessTokenCache = writable<Record<string, EpicOAuthData>>();
export const worldInfoCache = writable<ParsedWorldInfo>();
export const brShopStore = writable<SpitfireShop>();

export const automationStore = writable<(AutomationSetting & { status: AutomationAccount['status'] })[]>([]);
export const accountPartiesStore = new SvelteMap<string, PartyData>();
export const accountDataStore = writable<Record<string, AccountStoreData>>({});
export const ownedItemsStore = writable<Record<string, Set<string>>>({});
export const friendsStore = writable<Record<string, {
  friends: Map<string, FriendData>;
  incoming: Map<string, IncomingFriendRequestData>;
  outgoing: Map<string, OutgoingFriendRequestData>;
  blocklist: Map<string, BlockedAccountData>;
}>>({});

export const ownedApps = writable<ParsedApp[]>([]);
export const favoritedAppIds = new SvelteSet<string>();
export const hiddenAppIds = new SvelteSet<string>();
export const runningAppIds = new SvelteSet<string>();