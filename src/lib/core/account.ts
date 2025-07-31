import { accountsStorage } from '$lib/core/data-storage';
import AvatarManager from '$lib/core/managers/avatar';
import XMPPManager from '$lib/core/managers/xmpp';
import Legendary from '$lib/core/legendary';
import { get } from 'svelte/store';
import type { AccountData } from '$types/accounts';
import DeviceAuthManager from '$lib/core/managers/device-auth';
import AutoKickBase from '$lib/core/managers/autokick/base';

export default class Account {
  static async addAccount(account: AccountData, setActive = true) {
    accountsStorage.update(settings => {
      settings.activeAccountId = setActive ? account.accountId : settings.activeAccountId || undefined;
      settings.accounts.push(account);
      return settings;
    });

    AvatarManager.fetchAvatars(account, [account.accountId]).catch(console.error);
  }

  static async removeAccount(accountId: string, deleteAuth = true) {
    const storage = get(accountsStorage);

    const oldAccounts = storage.accounts || [];
    const oldActiveAccount = oldAccounts.find(account => account.accountId === accountId);

    const newAccounts = oldAccounts.filter(account => account.accountId !== accountId);

    let newAccountId = storage.activeAccountId || null;
    if (accountId === newAccountId) {
      newAccountId = newAccounts[0]?.accountId || null;
    }

    accountsStorage.update(settings => {
      settings.activeAccountId = newAccountId || undefined;
      settings.accounts = newAccounts;
      return settings;
    });

    AutoKickBase.removeAccount(accountId);
    XMPPManager.instances.get(accountId)?.disconnect();

    if (oldActiveAccount) {
      if (deleteAuth) {
        DeviceAuthManager.delete(oldActiveAccount, oldActiveAccount.deviceId).catch(console.error);
      }

      Account.logoutLegendary(oldActiveAccount.accountId).catch(console.error);
    }
  }

  private static async logoutLegendary(accountId: string) {
    const legendaryId = await Legendary.getAccount();
    if (legendaryId === accountId) {
      await Legendary.logout();
    }
  }
}
