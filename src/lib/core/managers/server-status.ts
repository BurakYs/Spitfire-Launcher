import { lightswitchService, tauriKy } from '$lib/core/services';
import type { AccountData } from '$types/accounts';
import Authentication from '$lib/core/authentication';
import type { LightswitchData, ServerStatusSummaryData, WaitingRoomData } from '$types/game/server-status';

export default class ServerStatusManager {
  static async getLightswitch(account?: AccountData) {
    const accessToken = account
      ? await Authentication.verifyOrRefreshAccessToken(account)
      : (await Authentication.getAccessTokenUsingClientCredentials()).access_token;

    return lightswitchService.get<LightswitchData>(
      'Fortnite/status',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    ).json();
  }

  static async getWaitingRoom() {
    return tauriKy.get<WaitingRoomData>('https://fortnitewaitingroom-public-service-prod.ol.epicgames.com/waitingroom/api/waitingroom').json().catch(() => null);
  }

  static async getStatusPage() {
    return tauriKy.get<ServerStatusSummaryData>('https://status.epicgames.com/api/v2/summary.json').json();
  }
}