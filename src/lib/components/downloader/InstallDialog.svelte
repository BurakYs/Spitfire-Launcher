<script lang="ts" module>
  import type { LegendaryAppInfo } from '$types/legendary';

  const appInfoCache = new Map<string, LegendaryAppInfo>();
</script>

<script lang="ts">
  import Button from '$components/ui/Button.svelte';
  import Dialog from '$components/ui/Dialog.svelte';
  import Tooltip from '$components/ui/Tooltip.svelte';
  import DataStorage from '$lib/core/dataStorage';
  import { ownedApps } from '$lib/stores';
  import Legendary from '$lib/utils/legendary';
  import DownloadManager from '$lib/core/managers/download.svelte';
  import { bytesToSize, cn, t } from '$lib/utils/util';
  import { invoke } from '@tauri-apps/api/core';
  import { Progress } from 'bits-ui';
  import DownloadIcon from 'lucide-svelte/icons/download';
  import HardDriveIcon from 'lucide-svelte/icons/hard-drive';
  import AlertTriangleIcon from 'lucide-svelte/icons/alert-triangle';
  import { onMount } from 'svelte';

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
    DownloadManager.addToQueue(app).finally(() => {
      isStartingDownload = false;
      isOpen = false;
    });
  }

  onMount(async () => {
    const [downloaderSettings, appInfo] = await Promise.all([
      DataStorage.getDownloaderFile(),
      appInfoCache.get(app.id) || Legendary.getAppInfo(app.id).then(x => x.stdout)
    ]);

    const diskSpace = await invoke<{ total: number; available: number; }>('get_disk_space', {
      dir: downloaderSettings.downloadPath
    });

    appInfoCache.set(app.id, appInfo);

    totalSpace = diskSpace.total;
    availableSpace = diskSpace.available;

    downloadSize = appInfo.manifest.download_size;
    installSize = appInfo.manifest.disk_size;
  });
</script>

<Dialog onOpenChangeComplete={(open) => !open && (id = '')} title={app.title} bind:open={isOpen}>
  <div class="space-y-4">
    <div class="grid grid-cols-2 gap-4">
      <div class="bg-accent/30 rounded-lg p-4">
        <div class="flex items-center gap-2">
          <DownloadIcon class="size-6 text-epic"/>
          <span class="text-sm font-medium">Download Size</span>
        </div>

        {#if downloadSize === 0}
          <div class="text-2xl text-muted-foreground mt-1 skeleton-loader p-4"></div>
        {:else}
          <div class="text-2xl font-bold mt-1">{bytesToSize(downloadSize)}</div>
        {/if}
        <div class="text-xs text-muted-foreground mt-1">Compressed</div>
      </div>

      <div class="bg-accent/30 rounded-lg p-4">
        <div class="flex items-center gap-2">
          <HardDriveIcon class="size-6 text-epic"/>
          <span class="text-sm font-medium">Install Size</span>
        </div>
        {#if installSize === 0}
          <div class="text-2xl text-muted-foreground mt-1 skeleton-loader p-4"></div>
        {:else}
          <div class="text-2xl font-bold mt-1">{bytesToSize(installSize)}</div>
        {/if}
        <div class="text-xs text-muted-foreground mt-1">After extraction</div>
      </div>
    </div>

    <div class="bg-accent/30 border border-border rounded-lg p-3">
      <div class="flex items-center gap-2 mb-1">
        <HardDriveIcon class="size-5 text-epic"/>
        <span class="font-medium">Storage</span>
      </div>

      <div class="space-y-2">
        <div class="flex justify-between text-xs">
          <span class="text-muted-foreground">
            Current:
            {#if usedSpace === 0 || totalSpace === 0}
              <span class="skeleton-loader py-0.5 px-5 ml-1 rounded"></span>
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

            After:
            {#if usedSpace === 0 || totalSpace === 0 || installSize === 0}
              <span class="skeleton-loader py-2.5 px-5 -ml-0.5 rounded"></span>
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

    <div class="flex gap-2 justify-end mt-2">
      <Button variant="outline">
        {$t('common.cancel')}
      </Button>

      <Tooltip tooltip={afterInstallPercentage >= 100 ? 'Not enough space available' : undefined}>
        <Button
          disabled={!afterInstallPercentage || afterInstallPercentage >= 100 || isStartingDownload}
          loading={isStartingDownload}
          onclick={installApp}
          variant="epic"
        >
          Download
        </Button>
      </Tooltip>
    </div>
  </div>
</Dialog>