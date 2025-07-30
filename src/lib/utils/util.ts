import type { SpitfireShopItem } from '$types/game/shop';
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { ownedItemsStore } from '$lib/stores';
import { derived, get } from 'svelte/store';
import { toast } from 'svelte-sonner';
import { goto } from '$app/navigation';
import EpicAPIError from '$lib/exceptions/EpicAPIError';
import type { EpicAPIErrorData } from '$types/game/authorizations';
import type { FullQueryProfile } from '$types/game/mcp';
import type { AllSettings } from '$types/settings';
import { accountsStorage, activeAccountStore, language, settingsStorage } from '$lib/core/data-storage';
import { m } from '$lib/paraglide/messages';
import { type Locale, setLocale } from '$lib/paraglide/runtime';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export async function checkLogin() {
  const hasAccount = !!get(activeAccountStore);
  if (hasAccount) return true;

  const sidebar = get(await getSidebar());
  const defaultPage = sidebar.flatMap(x => x.items).find(x => x.key === 'stwMissionAlerts')!.href;

  await goto(defaultPage, {
    state: {
      showLoginModal: true
    }
  });

  toast.error(get(t)('errors.notLoggedIn'));

  return false;
}

export function nonNull<T>(value: T): NonNullable<T> {
  return value as NonNullable<T>;
}

export function isEpicApiError(data: any): data is EpicAPIErrorData {
  return (data as EpicAPIErrorData)?.errorCode !== undefined;
}

export function calculateVbucks(queryProfile: FullQueryProfile<'common_core'>) {
  const profile = queryProfile.profileChanges[0].profile;
  const vbucksPlatform = profile.stats.attributes.current_mtx_platform;
  const vbucksItems = Object.values(profile.items).filter(
    (x) => x.templateId.startsWith('Currency:Mtx') && !(vbucksPlatform === 'Nintendo' && x.attributes.platform !== 'Nintendo')
  );

  return vbucksItems.reduce((acc, x) => acc + x.quantity, 0);
}

export function shouldIgnoreError(error: unknown) {
  if (error instanceof EpicAPIError && error.errorCode === 'errors.com.epicgames.account.invalid_account_credentials') {
    console.error(error);
    return true;
  }

  return false;
}

export function handleError(error: unknown, message: string, toastId?: string | number) {
  if (!shouldIgnoreError(error)) {
    console.error(error);
    toast.error(message, { id: toastId });
  }
}

export function isLegendaryOrMythicSurvivor(itemId: string) {
  return itemId.includes('workerbasic_sr') || (itemId.startsWith('Worker:manager') && itemId.includes('_sr_'));
}

export async function getStartingPage(settingsData?: AllSettings) {
  const settings = settingsData || get(settingsStorage);
  const startingPage = settings.app?.startingPage;
  const pages = get(await getSidebar()).flatMap(x => x.items);

  return (pages.find(x => x.key === startingPage) || pages.find(x => x.key === 'stwMissionAlerts')!)?.href;
}

async function getSidebar() {
  const module = await import('$lib/constants/sidebar');
  return module.SidebarCategories;
}

export function calculateDiscountedShopPrice(accountId: string, item: SpitfireShopItem) {
  const isBundle = item.contents.some(item => item.alreadyOwnedPriceReduction != null);
  const ownedItems = get(ownedItemsStore)[accountId];
  if (!ownedItems?.size || !isBundle) return item.price.final;

  return item.contents.reduce((acc, content) => {
    const isOwned = ownedItems.has(content.id?.toLowerCase());
    const reduction = isOwned ? content.alreadyOwnedPriceReduction || 0 : 0;

    return Math.max(acc - reduction, item.price.floor);
  }, item.price.final);
}

export function formatRemainingDuration(ms: number) {
  const translate = get(t);
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);

  const parts = [];

  if (days) {
    const key = days === 1 ? 'one' : 'other' as const;
    parts.push(translate(`times.days.${key}`, { count: days }));
  }

  if (hours) {
    const key = hours === 1 ? 'one' : 'other' as const;
    parts.push(translate(`times.hours.${key}`, { count: hours }));
  }

  if (minutes) {
    const key = minutes === 1 ? 'one' : 'other' as const;
    parts.push(translate(`times.minutes.${key}`, { count: minutes }));
  }

  if (seconds) {
    const key = seconds === 1 ? 'one' : 'other' as const;
    parts.push(translate(`times.seconds.${key}`, { count: seconds }));
  }

  return parts.length ? parts.join(' ') : translate('times.seconds.other', { count: 0 });
}

export async function getResolvedResults<T extends readonly unknown[]>(
  promises: { [K in keyof T]: Promise<T[K]> }
): Promise<{ [K in keyof T]: T[K] | null }> {
  const results = await Promise.allSettled(promises);
  return results.map(result => {
    if (result.status === 'fulfilled') {
      return result.value;
    }

    console.error(result.reason);
    return null;
  }) as { [K in keyof T]: T[K] | null };
}

export function evaluateCurve(keys: { Time: number, Value: number; }[], time: number) {
  if (time < keys[0].Time) {
    return keys[0].Value;
  }

  if (time >= keys[keys.length - 1].Time) {
    return keys[keys.length - 1].Value;
  }

  const index = keys.findIndex((k) => k.Time > time);

  const prev = keys[index - 1];
  const next = keys[index];

  const fac = (time - prev.Time) / (next.Time - prev.Time);
  return prev.Value * (1 - fac) + next.Value * fac;
}

type MessageKey = keyof typeof m;
type MessageFn<K extends MessageKey> = typeof m[K];
type InputsOf<K extends MessageKey> = Parameters<MessageFn<K>>[0];
type OptionsOf<K extends MessageKey> = Parameters<MessageFn<K>>[1];

export const t = derived(language, ($language) => {
  return function t<K extends MessageKey>(
    key: K,
    inputs?: InputsOf<K>,
    options?: OptionsOf<K>
  ): string {
    return m[key](inputs ?? {} as any, {
      locale: $language,
      ...options
    }) as ReturnType<MessageFn<K>>;
  };
});

export function changeLocale(locale: Locale) {
  setLocale(locale, { reload: false });

  settingsStorage.update((settings) => {
    if (!settings.app) {
      settings.app = {};
    }

    settings.app.language = locale;
    return settings;
  });
}

export function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function processChunks<T, R>(
  items: T[],
  chunkSize: number,
  processFn: (chunk: T[]) => Promise<R[]>
): Promise<R[]> {
  const promises = [];

  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    promises.push(processFn(chunk).catch(() => []));
  }

  const results = await Promise.allSettled(promises);
  const processedResults: R[] = [];

  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) {
      processedResults.push(...result.value);
    }
  }

  return processedResults;
}

export function getAccountsFromSelection(selection: string[]) {
  const { accounts } = get(accountsStorage);
  return selection.map((id) => accounts.find((account) => account.accountId === id)).filter((x) => !!x);
}

export function bytesToSize(bytes: number, decimals = 2, unit = 1000) {
  if (bytes <= 0) return '0 B';

  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(unit));
  return `${(bytes / Math.pow(unit, i)).toFixed(decimals)} ${sizes[i]}`;
}