import LookupManager from '$lib/core/managers/lookup';
import { matchmakingService } from '$lib/core/services';
import Authentication from '$lib/core/authentication';
import { displayNamesCache } from '$lib/stores';
import type { MatchmakingTrackResponse } from '$types/game/matchmaking';
import type { AccountData } from '$types/accounts';

export default class MatchmakingManager {
  static async findPlayer(account: AccountData, accountToFind: string) {
    const accessToken = await Authentication.verifyOrRefreshAccessToken(account);

    const data = await matchmakingService.get<MatchmakingTrackResponse>(
      `findPlayer/${accountToFind}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    ).json();

    const notCachedPlayers = data?.[0]?.publicPlayers.filter((x) => !displayNamesCache.has(x));
    if (notCachedPlayers?.length) {
      LookupManager.fetchByIds(account, notCachedPlayers).catch(console.error);
    }

    return data;
  }
}
