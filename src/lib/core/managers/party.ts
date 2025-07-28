import { partyService } from '$lib/core/services';
import Authentication from '$lib/core/authentication';
import EpicAPIError from '$lib/exceptions/EpicAPIError';
import { accountPartiesStore, avatarCache, displayNamesCache } from '$lib/stores';
import defaultPartyMemberMeta from '$lib/data/default-party-member-meta.json';
import defaultPartyMeta from '$lib/data/default-party-meta.json';
import type { AccountData } from '$types/accounts';
import type { FetchPartyResponse, InviterPartyResponse } from '$types/game/party';

export default class PartyManager {
  static async get(account: AccountData) {
    const accessToken = await Authentication.verifyOrRefreshAccessToken(account);

    const data = await partyService.get<FetchPartyResponse>(
      `user/${account.accountId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    ).json();

    const partyData = data.current[0];
    if (partyData) {
      accountPartiesStore.set(account.accountId, partyData);

      for (const member of partyData.members) {
        const name = member.meta['urn:epic:member:dn_s'] || member.connections?.[0]?.meta?.['account_pl_dn'];
        if (name) {
          displayNamesCache.set(member.account_id, name);
        }

        const loadoutJ = member.meta['Default:AthenaCosmeticLoadout_j'];
        if (loadoutJ) {
          const loadout = JSON.parse(loadoutJ).AthenaCosmeticLoadout;
          const equippedCharacterId = loadout?.characterPrimaryAssetId?.split(':')[1];
          if (equippedCharacterId) {
            avatarCache.set(member.account_id, `https://fortnite-api.com/images/cosmetics/br/${equippedCharacterId}/smallicon.png`);
          }
        }
      }
    }

    return data;
  }

  static async kick(account: AccountData, partyId: string, accountToKick: string) {
    const accessToken = await Authentication.verifyOrRefreshAccessToken(account);

    return partyService.delete<any>(
      `parties/${partyId}/members/${accountToKick}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    ).json();
  }

  static async leave(account: AccountData, partyId: string) {
    return PartyManager.kick(account, partyId, account.accountId);
  }

  static async promote(account: AccountData, partyId: string, accountToPromote: string) {
    const accessToken = await Authentication.verifyOrRefreshAccessToken(account);

    return partyService.post(
      `parties/${partyId}/members/${accountToPromote}/promote`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    ).json();
  }

  static async sendPatch(account: AccountData, partyId: string, revision: number, update: Record<string, string>, patchSelf = false): Promise<void> {
    const accessToken = await Authentication.verifyOrRefreshAccessToken(account);

    const body: Record<string, any> = { revision };

    if (patchSelf) {
      body.delete = [];
      body.update = { ...defaultPartyMemberMeta, ...update };
    } else {
      body.meta = {
        deleted: [],
        update: { ...defaultPartyMeta, ...update }
      };
    }

    try {
      await partyService.patch(
        `parties/${partyId}${patchSelf ? `/members/${account.accountId}/meta` : ''}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`
          },
          json: body
        }
      ).json();
    } catch (error) {
      if (error instanceof EpicAPIError && error.errorCode === 'errors.com.epicgames.social.party.stale_revision') {
        const newRevision = Number.parseInt(error.messageVars[1]);
        if (!Number.isNaN(newRevision)) return PartyManager.sendPatch(account, partyId, newRevision, update, patchSelf);
      }

      throw error;
    }
  }

  static async invite(account: AccountData, partyId: string, friendToInvite: string) {
    const accessToken = await Authentication.verifyOrRefreshAccessToken(account);

    return partyService.post(
      `parties/${partyId}/invites/${friendToInvite}?sendPing=true`,
      {
        json: {
          'urn:epic:invite:platformdata_s': ''
        },
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    ).json();
  }

  static async getInviterParty(account: AccountData, senderId: string) {
    const accessToken = await Authentication.verifyOrRefreshAccessToken(account);

    return partyService.get<[InviterPartyResponse]>(
      `user/${account.accountId}/pings/${senderId}/parties`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    ).json();
  }

  static async acceptInvite(account: AccountData, partyId: string, senderId: string, jid: string, meta: Record<string, string> = {}) {
    const accessToken = await Authentication.verifyOrRefreshAccessToken(account);

    await partyService.post(
      `parties/${partyId}/members/${account.accountId}/join`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        },
        json: {
          connection: {
            id: jid,
            meta: {
              'urn:epic:conn:platform_s': 'WIN',
              'urn:epic:conn:type_s': 'game'
            },
            yield_leadership: false
          },
          meta: {
            ...defaultPartyMemberMeta,
            ...meta,
            'urn:epic:member:dn_s': account.displayName,
            'urn:epic:member:joinrequestusers_j': JSON.stringify({
              users: [
                {
                  id: account.accountId,
                  dn: account.displayName,
                  plat: 'WIN',
                  data: JSON.stringify({
                    CrossplayPreference: '1',
                    SubGame_u: '1'
                  })
                }
              ]
            })
          }
        }
      }
    ).json();

    await partyService.delete(
      `user/${account.accountId}/pings/${senderId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    );
  }
}