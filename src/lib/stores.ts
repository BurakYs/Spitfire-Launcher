import type { BlockedAccountData, FriendData, IncomingFriendRequestData, OutgoingFriendRequestData } from '$types/game/friends';
import type { PartyData } from '$types/game/party';
import type { ParsedApp } from '$types/legendary';
import { SvelteMap, SvelteSet } from 'svelte/reactivity';
import { writable } from 'svelte/store';
import type { AccountData, AccountStoreData } from '$types/accounts';
import type { ParsedWorldInfo } from '$types/game/stw/worldInfo';
import type { EpicOAuthData } from '$types/game/authorizations';
import type { AutomationSetting, DownloaderSettings } from '$types/settings';
import type { AutomationAccount } from '$lib/core/managers/automation/autoKickBase';
import type { SpitfireShop } from '$types/game/shop';
import { type Locale, baseLocale } from './paraglide/runtime';

export const activeAccountId = writable<string | null>();
export const accountsStore = writable<{
  activeAccount: AccountData | null,
  allAccounts: AccountData[]
}>({
  activeAccount: null,
  allAccounts: []
});

activeAccountId.subscribe((activeAccountId) => {
  accountsStore.update((store) => {
    const activeAccount = store.allAccounts.find((account) => account.accountId === activeAccountId) || null;

    return {
      ...store,
      activeAccount
    };
  });
});

// To prevent redirecting the user to the home page in bulk operations if there is a credential error
export const doingBulkOperations = writable<boolean>(false);
export const displayNamesCache = new SvelteMap<string, string>();
export const avatarCache = new SvelteMap<string, string>();
// todo: use a map
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

export const customizableMenuStore = writable<Record<string, boolean>>({});
export const language = writable<Locale>(baseLocale);

export const ownedApps = writable<ParsedApp[]>([]);
export const favoritedAppIds = new SvelteSet<string>();
export const hiddenAppIds = new SvelteSet<string>();
export const runningAppIds = new SvelteSet<string>();
export const perAppAutoUpdate = writable<NonNullable<DownloaderSettings['perAppAutoUpdate']>>({});