import { accountsStorage, automationStorage } from '$lib/core/data-storage';
import { get } from 'svelte/store';
import { automationStore, doingBulkOperations } from '$lib/stores';
import AutoKickManager from '$lib/core/managers/autokick/manager';
import type { AccountData } from '$types/accounts';
import type { AutomationSetting } from '$types/settings';

export type AutomationAccount = {
  status: 'LOADING' | 'ACTIVE' | 'INVALID_CREDENTIALS' | 'DISCONNECTED';
  account: AccountData;
  settings: Partial<Omit<AutomationSetting, 'accountId'>>;
  manager?: AutoKickManager;
};

export default class AutoKickBase {
  private static accounts = new Map<string, AutomationAccount>();

  static async init() {
    const accounts = get(automationStorage);
    if (!accounts?.length) return;

    doingBulkOperations.set(true);

    const userAccounts = get(accountsStorage).accounts;
    await Promise.allSettled(accounts.map(async automationAccount => {
      const account = userAccounts.find(a => a.accountId === automationAccount.accountId);
      const isAnySettingEnabled = Object.entries(automationAccount).filter(([key]) => key !== 'accountId').some(([, value]) => value);

      if (!account || !isAnySettingEnabled) {
        automationStorage.update(s => s.filter(a => a.accountId !== automationAccount.accountId));
        return;
      }

      await AutoKickBase.addAccount(account, automationAccount, false);
    }));

    doingBulkOperations.set(false);
  }

  static async addAccount(account: AccountData, settings: AutomationAccount['settings'] = {}, writeToFile = true) {
    if (AutoKickBase.accounts.has(account.accountId)) return;

    const data: AutomationAccount = {
      status: 'LOADING',
      account,
      settings
    };

    AutoKickBase.accounts.set(account.accountId, data);
    await AutoKickBase.updateSettings(account.accountId, settings, writeToFile);

    data.manager = await AutoKickManager.create(account);
  }

  static removeAccount(accountId: string) {
    AutoKickBase.accounts.get(accountId)?.manager?.destroy();
    AutoKickBase.accounts.delete(accountId);

    automationStore.update(s => s.filter(a => a.accountId !== accountId));
    automationStorage.set(Array.from(AutoKickBase.accounts.values()).map((x) => ({
      accountId: x.account.accountId,
      ...x.settings
    })));
  }

  static async updateSettings(accountId: string, settings: Partial<AutomationSetting>, writeToFile = true) {
    const account = AutoKickBase.getAccountById(accountId);
    if (!account) return;

    account.settings = {
      ...account.settings,
      ...settings
    };

    const newSettings = Array.from(AutoKickBase.accounts.values()).map((x) => ({
      accountId: x.account.accountId,
      ...x.settings
    }));

    automationStore.set(newSettings.map((x) => ({
      ...x,
      status: AutoKickBase.getAccountById(x.accountId)?.status ?? 'LOADING'
    })));

    if (writeToFile) {
      automationStorage.set(newSettings);
    }
  }

  static getAccountById(accountId: string) {
    return AutoKickBase.accounts.get(accountId);
  }
}