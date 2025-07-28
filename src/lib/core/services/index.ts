import { defaultClient } from '$lib/constants/clients';
import tauriKy from '$lib/core/services/tauri-ky';

export { tauriKy };

export const baseGameService = tauriKy.extend({
  prefixUrl: 'https://fngw-mcp-gc-livefn.ol.epicgames.com/fortnite/api/game/v2'
});

export const friendService = tauriKy.extend({
  prefixUrl: 'https://friends-public-service-prod.ol.epicgames.com/friends/api/v1'
});

export const fulfillmentService = tauriKy.extend({
  prefixUrl: 'https://fulfillment-public-service-prod.ol.epicgames.com/fulfillment/api/public'
});

export const lightswitchService = tauriKy.extend({
  prefixUrl: 'https://lightswitch-public-service-prod.ol.epicgames.com/lightswitch/api/service'
});

export const matchmakingService = tauriKy.extend({
  prefixUrl: 'https://fngw-mcp-gc-livefn.ol.epicgames.com/fortnite/api/matchmaking/session'
});

export const oauthService = tauriKy.extend({
  prefixUrl: 'https://account-public-service-prod.ol.epicgames.com/account/api/oauth',
  hooks: {
    beforeRequest: [
      async (request) => {
        if (!request.headers.has('Authorization')) {
          request.headers.set('Authorization', `Basic ${defaultClient.base64}`);
        }

        request.headers.set('Content-Type', 'application/x-www-form-urlencoded');
      }
    ]
  }
});

export const partyService = tauriKy.extend({
  prefixUrl: 'https://party-service-prod.ol.epicgames.com/party/api/v1/Fortnite'
});

export const publicAccountService = tauriKy.extend({
  prefixUrl: 'https://account-public-service-prod.ol.epicgames.com/account/api/public/account'
});

export const eulaService = tauriKy.extend({
  prefixUrl: 'https://eulatracking-public-service-prod.ol.epicgames.com/eulatracking/api/public/agreements/fn'
});

export const userSearchService = tauriKy.extend({
  prefixUrl: 'https://user-search-service-prod.ol.epicgames.com/api/v1/search'
});

export const avatarService = tauriKy.extend({
  prefixUrl: 'https://avatar-service-prod.identity.live.on.epicgames.com/v1/avatar/fortnite/ids'
});