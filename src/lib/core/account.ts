import DataStorage, { ACCOUNTS_FILE_PATH } from '$lib/core/data-storage';
import AvatarManager from '$lib/core/managers/avatar';
import XMPPManager from '$lib/core/managers/xmpp';
import Legendary from '$lib/utils/legendary';
import { get } from 'svelte/store';
import { accountsStore, activeAccountId } from '$lib/stores';
import type { AccountData, AccountDataFile } from '$types/accounts';
import DeviceAuthManager from '$lib/core/managers/device-auth';
import AutoKickBase from '$lib/core/managers/automation/autokick-base';

export default class Account {
  static async changeActiveAccount(id: string | null) {
    activeAccountId.set(id);
    await DataStorage.writeConfigFile<AccountDataFile>(ACCOUNTS_FILE_PATH, { activeAccountId: id || undefined });
  }

  static async addAccount(account: AccountData, setActive = true) {
    const { allAccounts } = get(accountsStore);
    allAccounts.push(account);

    if (setActive) {
      activeAccountId.set(account.accountId);
      accountsStore.set({
        activeAccount: account,
        allAccounts
      });
    }

    await DataStorage.writeConfigFile<AccountDataFile>(ACCOUNTS_FILE_PATH, {
      activeAccountId: setActive ? account.accountId : get(activeAccountId) || undefined,
      accounts: allAccounts
    });

    AvatarManager.fetchAvatars(account, [account.accountId]).catch(console.error);
  }

  static async logout(accountId: string, deleteAuth = true) {
    const oldAccounts = get(accountsStore).allAccounts;
    const oldActiveAccount = oldAccounts.find(account => account.accountId === accountId);

    const newAccounts = oldAccounts.filter(account => account.accountId !== accountId);

    let newAccountId = get(activeAccountId);
    if (accountId === newAccountId) {
      newAccountId = newAccounts[0]?.accountId || null;
      await Account.changeActiveAccount(newAccountId);
    }

    await DataStorage.writeConfigFile<AccountDataFile>(ACCOUNTS_FILE_PATH, {
      activeAccountId: newAccountId || undefined,
      accounts: newAccounts
    });

    accountsStore.set({
      activeAccount: newAccounts.find(account => account.accountId === newAccountId) || null,
      allAccounts: newAccounts
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
