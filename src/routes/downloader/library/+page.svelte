<script lang="ts">
  import AppCard from '$components/downloader/AppCard.svelte';
  import AppFilter from '$components/downloader/AppFilter.svelte';
  import InstallDialog from '$components/downloader/InstallDialog.svelte';
  import SkeletonAppCard from '$components/downloader/SkeletonAppCard.svelte';
  import UninstallDialog from '$components/downloader/UninstallDialog.svelte';
  import PageContent from '$components/PageContent.svelte';
  import Input from '$components/ui/Input/Input.svelte';
  import { activeAccountStore, downloaderStorage } from '$lib/core/data-storage';
  import { ownedApps } from '$lib/stores';
  import Legendary from '$lib/core/legendary';
  import DownloadManager from '$lib/core/managers/download.svelte';
  import { handleError, nonNull, t } from '$lib/utils/util';
  import type { AppFilterValue } from '$types/legendary';
  import Fuse from 'fuse.js';
  import { onMount } from 'svelte';
  import { toast } from 'svelte-sonner';

  const activeAccount = $derived(nonNull($activeAccountStore));

  let searchQuery = $state<string>('');
  let installDialogAppId = $state<string>();
  let uninstallDialogAppId = $state<string>();
  let filters = $state<AppFilterValue[]>([]);

  const filteredApps = $derived.by(() => {
    const query = searchQuery.trim().toLowerCase();

    let filtered = Object.values($ownedApps).filter(app => {
      if (!filters.includes('hidden') && $downloaderStorage.hiddenApps?.includes(app.id)) return false;
      if (filters.includes('installed') && !app.installed) return false;
      if (filters.includes('updatesAvailable') && !app.hasUpdate) return false;
      return true;
    });

    if (query) {
      const fuse = new Fuse(filtered, {
        keys: ['title'],
        threshold: 0.4
      });

      filtered = fuse.search(query).map(result => result.item);
    }

    return filtered.sort((a, b) => {
      const favoriteA = $downloaderStorage.favoriteApps?.includes(a.id) ? 0 : 1;
      const favoriteB = $downloaderStorage.favoriteApps?.includes(b.id) ? 0 : 1;

      const installedA = a.installed ? 0 : 1;
      const installedB = b.installed ? 0 : 1;

      const installingA = DownloadManager.downloadingAppId === a.id ? 0 : 1;
      const installingB = DownloadManager.downloadingAppId === b.id ? 0 : 1;

      const inQueueA = DownloadManager.isInQueue(a.id) ? 0 : 1;
      const inQueueB = DownloadManager.isInQueue(b.id) ? 0 : 1;

      return favoriteA - favoriteB
        || installedA - installedB
        || installingA - installingB
        || inQueueA - inQueueB
        || a.title.localeCompare(b.title);
    });
  });

  onMount(async () => {
    const isLoggedIn = (await Legendary.getStatus()).account;
    if (!isLoggedIn) {
      const toastId = toast.loading($t('library.loggingIn'), { duration: Number.POSITIVE_INFINITY });

      try {
        await Legendary.login(activeAccount);
        toast.success($t('library.loggedIn'), { id: toastId, duration: 3000 });
      } catch (error) {
        handleError(error, $t('library.failedToLogin'), toastId);
        return;
      }
    }

    await Legendary.cacheApps();
  });
</script>

<PageContent title={$t('library.page.title')}>
  <div class="flex items-center gap-2">
    <Input
      class="max-w-64 max-xs:max-w-full w-full"
      placeholder={$t('library.searchPlaceholder')}
      type="search"
      bind:value={searchQuery}
    />
    <AppFilter bind:selected={filters}/>
  </div>

  <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
    {#if Object.keys($ownedApps).length}
      {#each filteredApps as app (app.id)}
        <AppCard
          appId={app.id}
          bind:installDialogAppId
          bind:uninstallDialogAppId
        />
      {/each}
    {:else}
      <!-- eslint-disable-next-line @typescript-eslint/no-unused-vars -->
      {#each Array(8) as _, i (i)}
        <SkeletonAppCard/>
      {/each}
    {/if}
  </div>

  {#if installDialogAppId}
    <InstallDialog bind:id={installDialogAppId}/>
  {/if}

  {#if uninstallDialogAppId}
    <UninstallDialog bind:id={uninstallDialogAppId}/>
  {/if}
</PageContent>