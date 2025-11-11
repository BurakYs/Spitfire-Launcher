<script lang="ts" module>
  import type { LegendaryAppInfo } from '$types/legendary';

  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- This is not a reactive store
  const appInfoCache = new Map<string, LegendaryAppInfo>();
</script>

<script lang="ts">
  import { Dialog } from '$components/ui/Dialog';
  import Tooltip from '$components/ui/Tooltip.svelte';
  import { downloaderStorage } from '$lib/core/data-storage';
  import { ownedApps } from '$lib/stores';
  import Legendary from '$lib/core/legendary';
  import DownloadManager from '$lib/core/managers/download.svelte';
  import { bytesToSize, cn, t } from '$lib/utils/util';
  import { invoke } from '@tauri-apps/api/core';
  import { Progress } from 'bits-ui';
  import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle';
  import PackageIcon from '@lucide/svelte/icons/package';
  import DownloadIcon from '@lucide/svelte/icons/download';
  import HardDriveIcon from '@lucide/svelte/icons/hard-drive';
  import AlertTriangleIcon from '@lucide/svelte/icons/alert-triangle';
  import { onMount } from 'svelte';
  import { toast } from 'svelte-sonner';
  import DownloadStartedToast from '$components/downloader/DownloadStartedToast.svelte';

  type Props = {
    id: string;
  };

  let { id = $bindable() }: Props = $props();

  const app = $ownedApps.find(x => x.id === id)!;

  let isOpen = $state(true);
  let isStartingDownload = $state(false);

  let downloadSize = $state(0);
  let installSize = $state(0);
  let totalSpace = $state(0);
  let availableSpace = $state(0);

  const usedSpace = $derived(totalSpace - availableSpace);
  const usedPercentage = $derived((usedSpace / totalSpace) * 100);
  const afterInstallPercentage = $derived(((usedSpace + installSize) / totalSpace) * 100);

  async function installApp() {
    isStartingDownload = true;

    try {
      await DownloadManager.addToQueue(app);
      if (DownloadManager.downloadingAppId === app.id) {
        toast.info(DownloadStartedToast);
      }
    } catch (error) {
      console.error(error);
    } finally {
      isStartingDownload = false;
      isOpen = false;
    }
  }

  onMount(async () => {
    const appInfo = appInfoCache.get(app.id) || (await Legendary.getAppInfo(app.id).then(x => x.stdout))!;

    const diskSpace = await invoke<{ total: number; available: number; }>('get_disk_space', {
      dir: $downloaderStorage.downloadPath
    });

    appInfoCache.set(app.id, appInfo);

    totalSpace = diskSpace.total;
    availableSpace = diskSpace.available;

    downloadSize = appInfo.manifest.download_size;
    installSize = appInfo.manifest.disk_size;

    app.downloadSize = downloadSize;
    ownedApps.update(current => {
      return current.map(app =>
        app.id === id
          ? { ...app, downloadSize }
          : app
      );
    });
  });
</script>

<Dialog.Root
  contentProps={{ class: 'sm:max-w-xl' }}
  onOpenChangeComplete={(open) => !open && (id = '')}
  title={app.title}
  bind:open={isOpen}
>
  <div class="space-y-4">
    <div class="grid grid-cols-2 gap-4">
      <div class="bg-accent/30 border rounded-lg p-4">
        <div class="flex items-center gap-2 mb-1">
          <DownloadIcon class="size-6 text-epic"/>
          <span class="font-medium">{$t('library.installConfirmation.downloadSize')}</span>
        </div>

        {#if downloadSize === 0}
          <div class="text-2xl text-muted-foreground skeleton-loader p-4"></div>
        {:else}
          <div class="text-2xl font-bold">{bytesToSize(downloadSize)}</div>
        {/if}
        <div class="text-xs text-muted-foreground">{$t('library.installConfirmation.compressed')}</div>
      </div>

      <div class="bg-accent/30 border rounded-lg p-4">
        <div class="flex items-center gap-2 mb-1">
          <PackageIcon class="size-6 text-epic"/>
          <span class="font-medium">{$t('library.installConfirmation.installSize')}</span>
        </div>

        {#if installSize === 0}
          <div class="text-2xl text-muted-foreground skeleton-loader p-4"></div>
        {:else}
          <div class="text-2xl font-bold">{bytesToSize(installSize)}</div>
        {/if}
        <div class="text-xs text-muted-foreground">{$t('library.installConfirmation.afterExtraction')}</div>
      </div>
    </div>

    <div class="bg-accent/30 border rounded-lg p-4">
      <div class="flex items-center gap-2 mb-1">
        <HardDriveIcon class="size-6 text-epic"/>
        <span class="font-medium">{$t('library.installConfirmation.storage.title')}</span>
      </div>

      <div class="space-y-2">
        <div class="flex justify-between text-xs">
          <span class="text-muted-foreground">
            {$t('library.installConfirmation.storage.current')}:
            {#if usedSpace === 0 || totalSpace === 0}
              <span class="skeleton-loader px-5 ml-1 rounded"></span>
            {:else}
              {bytesToSize(usedSpace)} / {bytesToSize(totalSpace)}
            {/if}
          </span>

          <span
            class={cn(
              'flex items-center gap-1.5',
              afterInstallPercentage >= 100
                ? 'text-red-500'
                : afterInstallPercentage >= 85
                ? 'text-yellow-500'
                : 'text-muted-foreground'
            )}
          >
            {#if afterInstallPercentage >= 85}
              <AlertTriangleIcon class="size-4"/>
            {/if}

            {$t('library.installConfirmation.storage.after')}:
            {#if usedSpace === 0 || totalSpace === 0 || installSize === 0}
              <span class="skeleton-loader py-2 px-5 -ml-0.5 rounded"></span>
            {:else}
              {bytesToSize(usedSpace + installSize)} / {bytesToSize(totalSpace)}
            {/if}
          </span>
        </div>

        <Progress.Root class="h-2 bg-accent rounded-full overflow-hidden relative" value={usedPercentage}>
          <div
            style={`transform: translateX(-${100 - ((100 * usedPercentage) / 100) || 100}%)`}
            class="bg-epic flex-1 size-full rounded-full absolute top-0 left-0"
          ></div>
          <div
            style={`transform: translateX(-${100 - ((100 * afterInstallPercentage) / 100) || 100}%)`}
            class="bg-epic/50 flex-1 size-full rounded-full absolute top-0 left-0"
          ></div>
        </Progress.Root>
      </div>
    </div>

    <div class="flex w-full items-center justify-center gap-2">
      <Dialog.Button buttonType="cancel" onclick={() => isOpen = false}>
        {$t('cancel')}
      </Dialog.Button>

      <Tooltip
        class="w-full"
        message={afterInstallPercentage >= 100 ? $t('library.installConfirmation.notEnoughSpace') : undefined}
      >
        <Dialog.Button
          class="flex items-center gap-2"
          buttonType="action"
          color="epic"
          disabled={!afterInstallPercentage || afterInstallPercentage >= 100 || isStartingDownload}
          onclick={installApp}
        >
          {#if isStartingDownload}
            <LoaderCircleIcon class="size-5 animate-spin"/>
          {/if}

          {$t('library.installConfirmation.download')}
        </Dialog.Button>
      </Tooltip>
    </div>
  </div>
</Dialog.Root>