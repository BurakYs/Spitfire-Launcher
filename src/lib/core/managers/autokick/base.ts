import { accountsStorage, automationStorage } from '$lib/core/data-storage';
import { get } from 'svelte/store';
import { SvelteMap } from 'svelte/reactivity';
import { doingBulkOperations } from '$lib/stores';
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
  static accounts = new SvelteMap<string, AutomationAccount>();

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
    AutoKickBase.updateSettings(account.accountId, settings, writeToFile);

    const manager = await AutoKickManager.create(account);
    AutoKickBase.accounts.set(account.accountId, {
      ...AutoKickBase.accounts.get(account.accountId)!,
      manager
    });
  }

  static removeAccount(accountId: string) {
    AutoKickBase.accounts.get(accountId)?.manager?.destroy();
    AutoKickBase.accounts.delete(accountId);

    automationStorage.set(Array.from(AutoKickBase.accounts.values()).map((x) => ({
      accountId: x.account.accountId,
      ...x.settings
    })));
  }

  static updateSettings(accountId: string, settings: Partial<AutomationSetting>, writeToFile = true) {
    const account = AutoKickBase.accounts.get(accountId);
    if (!account) return;

    AutoKickBase.accounts.set(accountId, {
      ...account,
      settings: {
        ...account.settings,
        ...settings
      }
    });

    if (writeToFile) {
      const newSettings = Array.from(AutoKickBase.accounts.values()).map((x) => ({
        accountId: x.account.accountId,
        ...x.settings
      }));

      automationStorage.set(newSettings);
    }
  }

  static updateStatus(accountId: string, status: AutomationAccount['status']) {
    const account = AutoKickBase.accounts.get(accountId);
    if (!account) return;

    AutoKickBase.accounts.set(accountId, {
      ...account,
      status
    });
  }
}