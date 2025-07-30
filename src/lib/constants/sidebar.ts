import type { sidebarItems } from '$lib/validations/settings';
import { platform as getPlatform } from '@tauri-apps/plugin-os';
import { derived, get } from 'svelte/store';
import { t } from '$lib/utils/util';

const platform = getPlatform();

type Category = {
  key: string;
  name: string;
  items: {
    key: typeof sidebarItems[number];
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
        key: 'vbucksInformation' as const,
        name: $t('vbucksInformation.page.title'),
        href: '/account-management/vbucks-information'
      },
      {
        key: 'friendsManagement' as const,
        name: $t('friendsManagement.page.title'),
        href: '/account-management/friends-management'
      },
      {
        key: 'redeemCodes' as const,
        name: $t('redeemCodes.page.title'),
        href: '/account-management/redeem-codes'
      },
      {
        key: 'epicGamesWebsite' as const,
        name: $t('epicGamesWebsite.page.title'),
        href: '/account-management/epic-games-website'
      },
      {
        key: 'eula' as const,
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
        key: 'autoKick' as const,
        name: $t('autoKick.page.title'),
        href: '/br-stw/auto-kick'
      },
      {
        key: 'taxiService' as const,
        name: $t('taxiService.page.title'),
        href: '/br-stw/taxi-service'
      },
      {
        key: 'customStatus' as const,
        name: $t('customStatus.page.title'),
        href: '/br-stw/custom-status'
      },
      {
        key: 'partyManagement' as const,
        name: $t('partyManagement.page.title'),
        href: '/br-stw/party-management'
      },
      {
        key: 'serverStatus' as const,
        name: $t('serverStatus.page.title'),
        href: '/br-stw/server-status'
      },
      {
        key: 'itemShop' as const,
        name: $t('itemShop.page.title'),
        href: '/br-stw/item-shop'
      },
      {
        key: 'earnedXP' as const,
        name: $t('earnedXP.page.title'),
        href: '/br-stw/earned-xp'
      },
      {
        key: 'dailyQuests' as const,
        name: $t('dailyQuests.page.title'),
        href: '/br-stw/daily-quests'
      },
      {
        key: 'stwMissionAlerts' as const,
        name: $t('stwMissionAlerts.page.title'),
        href: '/br-stw/stw-mission-alerts'
      },
      {
        key: 'lookupPlayers' as const,
        name: $t('lookupPlayers.page.title'),
        href: '/br-stw/lookup-players'
      }
    ]
  },
  platform === 'windows' && {
    key: 'downloader',
    name: $t('sidebar.categories.downloader'),
    items: [
      {
        key: 'library' as const,
        name: $t('library.page.title'),
        href: '/downloader/library'
      },
      {
        key: 'downloads' as const,
        name: $t('downloads.page.title'),
        href: '/downloader/downloads'
      }
    ]
  },
  {
    key: 'authentication',
    name: $t('sidebar.categories.authentication'),
    items: [
      {
        key: 'exchangeCode' as const,
        name: $t('exchangeCode.page.title'),
        href: '/authentication/exchange-code'
      },
      {
        key: 'accessToken' as const,
        name: $t('accessToken.page.title'),
        href: '/authentication/access-token'
      },
      {
        key: 'deviceAuth' as const,
        name: $t('deviceAuth.page.title'),
        href: '/authentication/device-auth'
      }
    ]
  }
].filter(x => !!x), [] as Category[]);