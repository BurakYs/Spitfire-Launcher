<script lang="ts">
  import '../app.css';
  import 'webrtc-adapter';
  import Sidebar from '$components/Sidebar.svelte';
  import Header from '$components/header/Header.svelte';
  import AvatarManager from '$lib/core/managers/avatar';
  import FriendManager from '$lib/core/managers/friend';
  import LookupManager from '$lib/core/managers/lookup';
  import type { AccountDataFile } from '$types/accounts';
  import { getVersion } from '@tauri-apps/api/app';
  import LoaderCircleIcon from 'lucide-svelte/icons/loader-circle';
  import { Toaster } from 'svelte-sonner';
  import { onMount } from 'svelte';
  import ky from 'ky';
  import config from '$lib/config';
  import type { GitHubRelease } from '$types/github';
  import Button from '$components/ui/Button.svelte';
  import ExternalLinkIcon from 'lucide-svelte/icons/external-link';
  import Dialog from '$components/ui/Dialog.svelte';
  import DataStorage, { ACCOUNTS_FILE_PATH } from '$lib/core/dataStorage';
  import { Tooltip } from 'bits-ui';
  import WorldInfoManager from '$lib/core/managers/worldInfo';
  import { accountsStore, worldInfoCache } from '$lib/stores';
  import AutoKickBase from '$lib/core/managers/automation/autoKickBase';
  import { t } from '$lib/utils/util';

  const { children } = $props();

  const { activeAccount, allAccounts } = $derived($accountsStore);
  let hasNewVersion = $state(false);
  let newVersionData = $state<{ tag: string; downloadUrl: string }>();

  function disableF5(e: KeyboardEvent) {
    // Using CTRL + R to refresh the page is allowed
    if (e.key === 'F5') e.preventDefault();
  }

  async function handleWorldInfo() {
    const worldInfoData = await WorldInfoManager.getWorldInfoData();
    const parsedWorldInfo = WorldInfoManager.parseWorldInfo(worldInfoData);
    worldInfoCache.set(parsedWorldInfo);
  }

  async function checkForUpdates() {
    const settings = await DataStorage.getSettingsFile();
    if (!settings.app?.checkForUpdates) return;

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
    if (!activeAccount) return;

    const accounts = await LookupManager.fetchByIds(activeAccount, allAccounts.map(account => account.accountId));
    await DataStorage.writeConfigFile<AccountDataFile>(ACCOUNTS_FILE_PATH, {
      accounts: allAccounts.map(account => ({
        ...account,
        displayName: accounts.find(acc => acc.id === account.accountId)?.displayName || account.displayName
      }))
    });
  }

  onMount(() => {
    document.addEventListener('keydown', disableF5);

    Promise.allSettled([
      AutoKickBase.loadAccounts(),
      DataStorage.init(),
      handleWorldInfo(),
      checkForUpdates(),
      syncAccountNames(),
      activeAccount && FriendManager.getSummary(activeAccount),
      allAccounts.map(account => AvatarManager.fetchAvatars(account, [account.accountId]))
    ]);
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

<Dialog bind:open={hasNewVersion}>
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
</Dialog>
