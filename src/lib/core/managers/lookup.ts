import { publicAccountService, userSearchService } from '$lib/core/services';
import { displayNamesCache } from '$lib/stores';
import { processChunks } from '$lib/utils/util';
import type { AccountData } from '$types/accounts';
import Authentication from '$lib/core/authentication';
import type { EpicAccountById, EpicAccountByName, EpicAccountSearch } from '$types/game/lookup';

export default class LookupManager {
  static async fetchById(account: AccountData, accountId: string) {
    const accessToken = await Authentication.verifyOrRefreshAccessToken(account);

    const data = await publicAccountService.get<EpicAccountById>(
      `${accountId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    ).json();

    displayNamesCache.update(cache => ({
      ...cache,
      [data.id]: data.displayName
    }));

    return data;
  }

  static async fetchByIds(account: AccountData, accountIds: string[]) {
    const MAX_IDS_PER_REQUEST = 100;
    const accessToken = await Authentication.verifyOrRefreshAccessToken(account);

    const accounts = await processChunks(
      accountIds,
      MAX_IDS_PER_REQUEST,
      async (ids) => {
        return publicAccountService.get<EpicAccountById[]>(
          `?${ids.map((x) => `accountId=${x}`).join('&')}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`
            }
          }
        ).json();
      }
    );

    displayNamesCache.update(cache => {
      for (const account of accounts) {
        const name = account.displayName || Object.values(account.externalAuths).map(x => x.externalDisplayName)?.[0];
        if (name) {
          cache[account.id] = name;
        }
      }

      return cache;
    });

    return accounts;
  }

  static async fetchByName(account: AccountData, displayName: string) {
    const accessToken = await Authentication.verifyOrRefreshAccessToken(account);

    const data = await publicAccountService.get<EpicAccountByName>(
      `displayName/${displayName.trim()}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    ).json();

    displayNamesCache.update(cache => ({
      ...cache,
      [data.id]: data.displayName
    }));

    return data;
  }

  static async searchByName(account: AccountData, namePrefix: string) {
    const accessToken = await Authentication.verifyOrRefreshAccessToken(account);

    return userSearchService.get<EpicAccountSearch[]>(
      `${account.accountId}?prefix=${namePrefix.trim()}&platform=epic`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    ).json();
  }

  static async fetchByNameOrId(account: AccountData, nameOrId: string) {
    const isAccountId = nameOrId.length === 32;

    if (isAccountId) {
      const data = await LookupManager.fetchById(account, nameOrId);
      return {
        accountId: data.id,
        displayName: data.displayName
      };
    } else {
      const data = (await LookupManager.searchByName(account, nameOrId))?.[0];
      return data ? {
        accountId: data.accountId,
        displayName: data.matches[0].value
      } : null;
    }
  }
}
