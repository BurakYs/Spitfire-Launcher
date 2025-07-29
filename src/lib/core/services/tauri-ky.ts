import Authentication from '$lib/core/authentication';
import { accountsStorage } from '$lib/core/data-storage';
import { accessTokenCache } from '$lib/stores';
import ky from 'ky';
import { fetch } from '@tauri-apps/plugin-http';
import Manifest from '$lib/core/manifest';
import { isEpicApiError } from '$lib/utils/util';
import EpicAPIError from '$lib/exceptions/EpicAPIError';
import { get } from 'svelte/store';

const MAX_AUTH_RETRIES = 1;
let userAgent: string;

// Used to avoid any CORS issues
const tauriKy = ky.create({
  fetch: async (input, options: (RequestInit & { _authRetryCount?: number; }) | undefined) => {
    const request = new Request(input, options);
    const headers = new Headers(request.headers);

    options ??= {};
    options._authRetryCount ??= 0;

    if (!headers.has('x-user-agent')) {
      userAgent ??= await Manifest.getFortniteUserAgent();
      headers.set('User-Agent', userAgent);
    } else {
      headers.set('User-Agent', request.headers.get('x-user-agent')!);
      headers.delete('x-user-agent');
    }

    let textReqBody = request.body ? await request.arrayBuffer() : undefined;

    const response = await fetch(request.url, {
      method: request.method,
      headers,
      body: textReqBody
    });

    let data: unknown;
    const isJsonResponse = response.headers.get('Content-Type')?.includes('application/json');

    if (isJsonResponse) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (isEpicApiError(data)) {
      const isInvalidTokenError = [
        'errors.com.epicgames.common.authentication.token_verification_failed',
        'errors.com.epicgames.common.oauth.invalid_token'
      ].includes(data.errorCode);

      if (isInvalidTokenError && options._authRetryCount < MAX_AUTH_RETRIES) {
        options._authRetryCount++;

        const account = getAccountFromRequest(request);
        if (!account) {
          throw new EpicAPIError(data, request, response.status);
        }

        accessTokenCache.update(cache => {
          delete cache[account.accountId];
          return cache;
        });

        const accessTokenData = await Authentication.getAccessTokenUsingDeviceAuth(account, false);
        if (options.headers instanceof Headers) {
          options.headers.set('Authorization', `Bearer ${accessTokenData.access_token}`);
        } else {
          options.headers = {
            ...options.headers,
            Authorization: `Bearer ${accessTokenData.access_token}`
          };
        }

        return tauriKy(input, options);
      }

      throw new EpicAPIError(data, request, response.status);
    }

    return new Response(data && typeof data === 'object' ? JSON.stringify(data) : data ? String(data) : null, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    });
  },
  retry: 0,
  timeout: 30000
});

function getAccountFromRequest(request: Request) {
  const tokenCache = get(accessTokenCache);
  const accounts = get(accountsStorage).accounts;
  const token = request.headers.get('Authorization')?.split(' ')[1];
  const accountId = Object.keys(tokenCache).find(accountId => tokenCache[accountId]?.access_token === token);

  return accounts.find(account => account.accountId === accountId);
}

export default tauriKy;
