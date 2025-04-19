import type { AllSettings } from '$types/settings';
import { derived } from 'svelte/store';
import { t } from '$lib/utils/util';

type Category = {
  key: string;
  name: string;
  items: {
    key: keyof NonNullable<AllSettings['customizableMenu']>;
    name: string;
    href: string;
  }[];
};

export const SidebarCategories = derived(t, ($t) => [
  {
    key: 'account',
    name: $t('sidebar.categories.account'),
    items: [
      {
        key: 'vbucksInformation',
        name: $t('vbucksInformation.page.title'),
        href: '/account-management/vbucks'
      },
      {
        key: 'friendManagement',
        name: $t('friendManagement.page.title'),
        href: '/account-management/friends'
      },
      {
        key: 'redeemCodes',
        name: $t('redeemCodes.page.title'),
        href: '/account-management/redeem-codes'
      },
      {
        key: 'epicGamesSettings',
        name: $t('epicGamesSettings.page.title'),
        href: '/account-management/epic-games-settings'
      },
      {
        key: 'eula',
        name: $t('eula.page.title'),
        href: '/account-management/eula'
      }
    ]
  },
  {
    key: 'brStw',
    name: $t('sidebar.categories.brStw'),
    items: [
      {
        key: 'autoKick',
        name: $t('autoKick.page.title'),
        href: '/br-stw/auto-kick'
      },
      {
        key: 'taxiService',
        name: $t('taxiService.page.title'),
        href: '/br-stw/taxi-service'
      },
      {
        key: 'botLobby',
        name: $t('botLobby.page.title'),
        href: '/br-stw/bot-lobby'
      },
      {
        key: 'customStatus',
        name: $t('customStatus.page.title'),
        href: '/br-stw/custom-status'
      },
      {
        key: 'partyManagement',
        name: $t('partyManagement.page.title'),
        href: '/br-stw/party'
      },
      {
        key: 'serverStatus',
        name: $t('serverStatus.page.title'),
        href: '/br-stw/server-status'
      },
      {
        key: 'itemShop',
        name: $t('itemShop.page.title'),
        href: '/br-stw/item-shop'
      },
      {
        key: 'earnedXp',
        name: $t('earnedXP.page.title'),
        href: '/br-stw/earned-xp'
      },
      {
        key: 'dailyQuests',
        name: $t('dailyQuests.page.title'),
        href: '/br-stw/daily-quests'
      },
      {
        key: 'stwWorldInfo',
        name: $t('stwMissionAlerts.page.title'),
        href: '/br-stw/stw-world-info'
      },
      {
        key: 'lookupPlayers',
        name: $t('lookupPlayers.page.title'),
        href: '/br-stw/lookup-players'
      }
    ]
  },
  {
    key: 'authentication',
    name: $t('sidebar.categories.authentication'),
    items: [
      {
        key: 'exchangeCode',
        name: $t('exchangeCodeManagement.page.title'),
        href: '/authentication/generate-exchange-code'
      },
      {
        key: 'accessToken',
        name: $t('accessTokenManagement.page.title'),
        href: '/authentication/generate-access-token'
      },
      {
        key: 'deviceAuth',
        name: $t('deviceAuthManagement.page.title'),
        href: '/authentication/device-auth'
      }
    ]
  }
] satisfies Category[]);