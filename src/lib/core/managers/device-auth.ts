import { publicAccountService } from '$lib/core/services';
import type { EpicDeviceAuthData } from '$types/game/authorizations';
import type { AccountData } from '$types/accounts';
import Authentication from '$lib/core/authentication';

export default class DeviceAuthManager {
  static async create(account: AccountData | { accountId: string; accessToken: string }) {
    let token = 'accessToken' in account ? account.accessToken : null;

    if ('deviceId' in account && 'secret' in account) {
      token = await Authentication.verifyOrRefreshAccessToken(account);
    }

    return publicAccountService.post<EpicDeviceAuthData>(
      `${account.accountId}/deviceAuth`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    ).json();
  }

  static async get(account: AccountData, deviceId: string) {
    const accessToken = await Authentication.verifyOrRefreshAccessToken(account);

    return publicAccountService.get<EpicDeviceAuthData>(
      `${account.accountId}/deviceAuth/${deviceId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    ).json();
  }

  static async getAll(account: AccountData) {
    const accessToken = await Authentication.verifyOrRefreshAccessToken(account);

    return publicAccountService.get<EpicDeviceAuthData[]>(
      `${account.accountId}/deviceAuth`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    ).json();
  }

  static async delete(account: AccountData, deviceId: string) {
    const accessToken = await Authentication.verifyOrRefreshAccessToken(account);

    return publicAccountService.delete(
      `${account.accountId}/deviceAuth/${deviceId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    );
  }
}
