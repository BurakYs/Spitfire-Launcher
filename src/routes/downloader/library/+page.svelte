<script lang="ts" module>
  let fetchedGames = false;
</script>

<script lang="ts">
  import AppCard from '$components/downloader/AppCard.svelte';
  import AppFilter from '$components/downloader/AppFilter.svelte';
  import InstallDialog from '$components/downloader/InstallDialog.svelte';
  import SkeletonAppCard from '$components/downloader/SkeletonAppCard.svelte';
  import UninstallDialog from '$components/downloader/UninstallDialog.svelte';
  import PageContent from '$components/PageContent.svelte';
  import Input from '$components/ui/Input.svelte';
  import DataStorage, { DOWNLOADER_INITIAL_DATA } from '$lib/core/dataStorage';
  import { accountsStore, favoritedAppIds, hiddenAppIds, ownedApps, perAppAutoUpdate } from '$lib/stores';
  import Legendary from '$lib/utils/legendary';
  import { t, nonNull } from '$lib/utils/util';
  import type { AppFilterValue } from '$types/legendary';
  import Fuse from 'fuse.js';
  import { onMount } from 'svelte';
  import { toast } from 'svelte-sonner';

  const activeAccount = $derived(nonNull($accountsStore.activeAccount));

  let searchQuery = $state<string>('');
  let installDialogAppId = $state<string>();
  let uninstallDialogAppId = $state<string>();
  let filters = $state<AppFilterValue[]>([]);
  let globalAutoUpdate = $state(DOWNLOADER_INITIAL_DATA.autoUpdate!);

  const filteredApps = $derived.by(() => {
    const query = searchQuery.trim().toLowerCase();

    let filtered = Object.values($ownedApps).filter(app => {
      if (!filters.includes('hidden') && hiddenAppIds.has(app.id)) return false;
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
      const favoriteA = favoritedAppIds.has(a.id) ? 0 : 1;
      const favoriteB = favoritedAppIds.has(b.id) ? 0 : 1;

      const installedA = a.installed ? 0 : 1;
      const installedB = b.installed ? 0 : 1;

      return favoriteA - favoriteB || installedA - installedB || a.title.localeCompare(b.title);
    });
  });

  onMount(async () => {
    const isLoggedIn = (await Legendary.getStatus()).account;
    if (!isLoggedIn) {
      toast.loading($t('library.loggingIn'));

      try {
        await Legendary.login(activeAccount);
        toast.success($t('library.loggedIn'));
      } catch (error) {
        console.error(error);
        toast.error($t('library.failedToLogin'));
        return;
      }
    }

    const downloaderSettings = await DataStorage.getDownloaderFile();
    globalAutoUpdate = downloaderSettings.autoUpdate!;
    perAppAutoUpdate.set(downloaderSettings.perAppAutoUpdate!);

    favoritedAppIds.clear();
    for (const id of downloaderSettings.favoriteApps || []) {
      favoritedAppIds.add(id);
    }

    hiddenAppIds.clear();
    for (const id of downloaderSettings.hiddenApps || []) {
      hiddenAppIds.add(id);
    }

    if (fetchedGames) return;

    const [list, installedList] = await Promise.all([
      Legendary.getList(),
      Legendary.getInstalledList()
    ]);

    ownedApps.set(list.stdout
      .filter(app => app.metadata.entitlementType === 'EXECUTABLE')
      .map(app => {
        const images = app.metadata.keyImages.reduce<Record<string, string>>((acc, image) => {
          acc[image.type] = image.url;
          return acc;
        }, {});

        const installed = installedList.stdout.find(installed => installed.app_name === app.app_name);

        return {
          id: app.app_name,
          title: app.app_title,
          images: {
            tall: images.DieselGameBoxTall || app.metadata.keyImages[0]?.url,
            wide: images.DieselGameBox || images.Featured || app.metadata.keyImages[0]?.url
          },
          hasUpdate: installed ? installed.version !== app.asset_infos.Windows.build_version : false,
          installSize: installed?.install_size || 0,
          installed: !!installed,
          canRunOffline: installed?.can_run_offline || false
        };
      })
    );

    fetchedGames = true;
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
          {globalAutoUpdate}
          bind:installDialogAppId
          bind:uninstallDialogAppId
        />
      {/each}
    {:else}
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