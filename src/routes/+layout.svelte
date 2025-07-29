<script lang="ts">
  import '../app.css';
  import Sidebar from '$components/Sidebar.svelte';
  import Header from '$components/header/Header.svelte';
  import AvatarManager from '$lib/core/managers/avatar';
  import FriendManager from '$lib/core/managers/friend';
  import LookupManager from '$lib/core/managers/lookup';
  import DownloadManager from '$lib/core/managers/download.svelte';
  import SystemTray from '$lib/core/system/tray';
  import Legendary from '$lib/utils/legendary';
  import { getVersion } from '@tauri-apps/api/app';
  import { listen } from '@tauri-apps/api/event';
  import LoaderCircleIcon from 'lucide-svelte/icons/loader-circle';
  import { Toaster } from 'svelte-sonner';
  import { onMount } from 'svelte';
  import ky from 'ky';
  import config from '$lib/config';
  import type { GitHubRelease } from '$types/github';
  import Button from '$components/ui/Button.svelte';
  import ExternalLinkIcon from 'lucide-svelte/icons/external-link';
  import { Dialog } from '$components/ui/Dialog';
  import { accountsStorage, activeAccountStore as activeAccount, settingsStorage } from '$lib/core/data-storage';
  import { Tooltip } from 'bits-ui';
  import WorldInfoManager from '$lib/core/managers/worldInfo';
  import { runningAppIds, worldInfoCache } from '$lib/stores';
  import AutoKickBase from '$lib/core/managers/automation/autokick-base';
  import { t } from '$lib/utils/util';

  const { children } = $props();

  const allAccounts = $derived($accountsStorage.accounts);

  let hasNewVersion = $state(false);
  let newVersionData = $state<{ tag: string; downloadUrl: string }>();

  async function handleWorldInfo() {
    const worldInfoData = await WorldInfoManager.getWorldInfoData();
    const parsedWorldInfo = WorldInfoManager.parseWorldInfo(worldInfoData);
    worldInfoCache.set(parsedWorldInfo);
  }

  async function checkForUpdates() {
    if (!$settingsStorage.app?.checkForUpdates) return;

    const { owner, name } = config.repository;

    const currentVersion = await getVersion();
    const latestVersion = await ky.get<GitHubRelease>(`https://api.github.com/repos/${owner}/${name}/releases/latest`).json();

    if (latestVersion.tag_name.replace('v', '') !== currentVersion) {
      hasNewVersion = true;
      newVersionData = {
        tag: latestVersion.tag_name.replace('v', ''),
        downloadUrl: latestVersion.html_url
      };
    }
  }

  async function syncAccountNames() {
    if (!$activeAccount) return;

    const accounts = await LookupManager.fetchByIds($activeAccount, allAccounts.map(account => account.accountId));
    accountsStorage.set({
      activeAccountId: $accountsStorage.activeAccountId,
      accounts: allAccounts.map(account => ({
        ...account,
        displayName: accounts.find(acc => acc.id === account.accountId)?.displayName || account.displayName
      }))
    });
  }

  async function autoUpdateApps() {
    const { account } = await Legendary.getStatus();
    if (!account) return;

    await Legendary.cacheApps();
    await Legendary.autoUpdateApps();
  }

  onMount(() => {
    settingsStorage.subscribe((data) => {
      SystemTray.setVisibility(data.app?.hideToTray || false).catch(console.error);
    });

    Promise.allSettled([
      AutoKickBase.init(),
      DownloadManager.init(),
      handleWorldInfo(),
      checkForUpdates(),
      syncAccountNames(),
      autoUpdateApps(),
      $activeAccount && FriendManager.getSummary($activeAccount),
      allAccounts.map(account => AvatarManager.fetchAvatars(account, [account.accountId]))
    ]);

    listen<{
      pid: number;
      app_id: string;
      state: 'running' | 'stopped';
    }>('app_state_changed', async (event) => {
      if (event.payload.state === 'running') {
        runningAppIds.add(event.payload.app_id);
      } else {
        runningAppIds.delete(event.payload.app_id);
      }
    });
  });
</script>

<div class="flex min-h-[100dvh]">
  <Tooltip.Provider>
    <Toaster
      position="bottom-center"
      toastOptions={{
        duration: 3000,
        unstyled: true,
        classes: {
          toast: 'bg-secondary flex items-center px-4 py-4 border rounded-lg gap-3 min-w-96 max-xs:min-w-80',
          title: 'text-sm'
        }
      }}
    >
      {#snippet loadingIcon()}
        <LoaderCircleIcon class="animate-spin size-5"/>
      {/snippet}
    </Toaster>
    <Sidebar/>
    <div class="flex flex-col flex-1">
      <Header/>
      <div>
        <main class="px-5 py-5 xs:px-10 sm:py-10 sm:px-20 flex-1 overflow-auto bg-background h-[calc(100dvh-4rem)]">
          {@render children()}
        </main>
      </div>
    </div>
  </Tooltip.Provider>
</div>

<Dialog.Root bind:open={hasNewVersion}>
  {#snippet title()}
    {$t('newVersionAvailable.title')}
  {/snippet}

  {#snippet description()}
    {$t('newVersionAvailable.description', { version: newVersionData!.tag })}
  {/snippet}

  <Button
    class="flex gap-2 justify-center items-center w-fit"
    href={newVersionData?.downloadUrl}
  >
    <ExternalLinkIcon class="size-5"/>
    {$t('newVersionAvailable.download')}
  </Button>
</Dialog.Root>
