import DataStorage from '$lib/core/data-storage';
import { accountsStore, activeAccountId, customizableMenuStore, language } from '$lib/stores';
import { changeLocale } from '$lib/utils/util';
import { baseLocale, locales } from '$lib/paraglide/runtime';
import { invoke } from '@tauri-apps/api/core';
import { get } from 'svelte/store';

export const prerender = true;
export const ssr = false;

export async function load() {
  const accountsFile = await DataStorage.getAccountsFile();
  const settings = await DataStorage.getSettingsFile();

  const systemLocale = await invoke<string>('get_locale');
  let locale = settings.app?.language || systemLocale || baseLocale;

  if (!locales.includes(locale as any)) {
    locale = baseLocale;
  }

  if (get(language) !== locale) {
    await changeLocale(locale as typeof locales[number]).catch(console.error);
  }

  const startingAccount = settings.app?.startingAccount;

  let accountId: string | null | undefined = startingAccount === 'lastUsed'
    ? accountsFile.activeAccountId
    : accountsFile.accounts[0]?.accountId;

  let activeAccount = accountsFile.accounts.find((account) => account.accountId === accountId) || null;

  if (accountId && !activeAccount) {
    accountId = accountsFile.accounts?.[0]?.accountId || null;
    activeAccount = accountsFile.accounts?.[0] || null;
  }

  accountsStore.set({
    activeAccount: activeAccount,
    allAccounts: accountsFile.accounts
  });

  activeAccountId.set(accountId || null);

  if (settings.customizableMenu) {
    customizableMenuStore.set(settings.customizableMenu);
  }
}