<script lang="ts">
  import CancelDownloadDialog from '$components/downloader/CancelDownloadDialog.svelte';
  import PageContent from '$components/PageContent.svelte';
  import Button from '$components/ui/Button.svelte';
  import Tooltip from '$components/ui/Tooltip.svelte';
  import DownloadManager, { type DownloadProgress } from '$lib/core/managers/download.svelte';
  import { language } from '$lib/stores';
  import { bytesToSize, formatRemainingDuration, t } from '$lib/utils/util';
  import { Progress } from 'bits-ui';
  import TriangleAlertIcon from 'lucide-svelte/icons/triangle-alert';
  import ClockIcon from 'lucide-svelte/icons/clock';
  import DownloadIcon from 'lucide-svelte/icons/download';
  import HardDriveIcon from 'lucide-svelte/icons/hard-drive';
  import LoaderCircleIcon from 'lucide-svelte/icons/loader-circle';
  import PauseIcon from 'lucide-svelte/icons/pause';
  import PlayIcon from 'lucide-svelte/icons/play';
  import XIcon from 'lucide-svelte/icons/x';
  import ChevronUpIcon from 'lucide-svelte/icons/chevron-up';
  import ChevronDownIcon from 'lucide-svelte/icons/chevron-down';

  let showCancelDialog = $state(false);
  let isCancelling = $state(false);
  let isTogglingPause = $state(false);

  const currentDownload = $derived(DownloadManager.queue.find(({ item }) => item.id === DownloadManager.downloadingAppId));
  const queue = $derived(DownloadManager.queue.filter(item => item.status === 'queued'));
  const completed = $derived(DownloadManager.queue.filter(item => item.status === 'completed' || item.status === 'failed'));
  const progress = $derived(DownloadManager.progress as DownloadProgress);

  async function togglePause() {
    if (!currentDownload) return;

    isTogglingPause = true;

    try {
      if (currentDownload.status === 'paused') {
        await DownloadManager.resumeDownload();
      } else {
        await DownloadManager.pauseDownload();
      }
    } catch (error) {
      console.error(error);
    } finally {
      isTogglingPause = false;
    }
  }

  async function cancelDownload() {
    if (!currentDownload) return;

    isCancelling = true;

    try {
      await DownloadManager.removeFromQueue(currentDownload.item.id);
    } catch (error) {
      console.error(error);
    } finally {
      isCancelling = false;
    }
  }
</script>

<PageContent title={$t('downloads.page.title')}>
  <div class="w-full border rounded-md p-3 relative h-36 {!currentDownload && 'bg-surface-alt'}">
    {#if currentDownload}
      <img
        class="absolute inset-0 size-full object-cover rounded-md opacity-10 pointer-events-none"
        alt="Background"
        src={currentDownload.item.images.wide}
      />

      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <h3 class="font-semibold text-lg">{currentDownload.item.title}</h3>
          <div class="flex items-center gap-2">
            <Button class="p-2" disabled={isCancelling || isTogglingPause} onclick={togglePause} size="sm" variant="outline">
              {#if isTogglingPause}
                <LoaderCircleIcon class="size-4 animate-spin"/>
              {:else}
                {#if currentDownload.status === 'paused'}
                  <PlayIcon class="size-4"/>
                {:else}
                  <PauseIcon class="size-4"/>
                {/if}
              {/if}
            </Button>
            <Button class="p-2" disabled={isCancelling || isTogglingPause} onclick={() => showCancelDialog = true} size="sm" variant="outline">
              {#if isCancelling}
                <LoaderCircleIcon class="size-4 animate-spin"/>
              {:else}
                <XIcon class="size-4"/>
              {/if}
            </Button>
          </div>
        </div>

        <div class="space-y-3">
          <div class="flex items-center justify-end space-x-2 text-sm">
            <span>{bytesToSize(progress.downloaded)} / {bytesToSize(progress.downloadSize)}</span>
            <span class="text-muted-foreground">/</span>
            <span>{progress.percent}%</span>
          </div>

          <Progress.Root class="h-2 bg-accent rounded-full overflow-hidden" value={progress.percent}>
            <div
              style={`transform: translateX(-${100 - (100 * (progress.percent ?? 0)) / 100}%)`}
              class="bg-epic flex-1 size-full rounded-full transition-all duration-1000 ease-in-out"
            ></div>
          </Progress.Root>

          <div class="flex items-center justify-between text-sm text-muted-foreground">
            <div class="flex items-center gap-2">
              <span class="flex items-center gap-1">
                <DownloadIcon class="size-4"/>
                {bytesToSize(progress.downloadSpeed, 1)}ps
              </span>
              <span class="flex items-center gap-1 border-l pl-2">
                <HardDriveIcon class="size-4"/>
                {bytesToSize(progress.diskWriteSpeed, 1)}ps
              </span>
            </div>

            <span class="flex items-center gap-1">
              {#if currentDownload.status === 'paused'}
                Paused
              {:else}
                <ClockIcon class="size-4"/>
                {formatRemainingDuration(progress.etaMs)}
              {/if}
            </span>
          </div>
        </div>
      </div>
    {:else}
      <div class="flex items-center justify-center h-full">
        <p class="text-muted-foreground">
          {$t('downloads.noDownloads')}
        </p>
      </div>
    {/if}
  </div>

  {#if queue.length > 0}
    <div class="w-full border rounded-md p-4 mt-2">
      <h3 class="font-semibold text-2xl mb-4">{$t('downloads.queued')}</h3>
      <div class="space-y-4">
        {#each queue as { item }, index (item.id)}
          <div class="flex items-center gap-4 p-3 rounded-lg border bg-surface-alt">
            <img
              class="w-12 h-16 object-cover rounded"
              alt={item.title}
              src={item.images.tall}
            />

            <div class="flex-1">
              <h4 class="font-medium">{item.title}</h4>
              <p class="text-sm text-muted-foreground">{bytesToSize(item.downloadSize || item.installSize, 2)}</p>
            </div>

            <div class="flex items-center gap-2">
              <Button
                class="p-2"
                disabled={index === 0}
                onclick={() => DownloadManager.moveQueueItem(item.id, 'up')}
                size="sm"
                variant="outline"
              >
                <ChevronUpIcon class="size-4"/>
              </Button>

              <Button
                class="p-2"
                disabled={index === queue.length - 1}
                onclick={() => DownloadManager.moveQueueItem(item.id, 'down')}
                size="sm"
                variant="outline"
              >
                <ChevronDownIcon class="size-4"/>
              </Button>

              <Button
                class="p-2"
                onclick={() => DownloadManager.removeFromQueue(item.id)}
                size="sm"
                variant="outline"
              >
                <XIcon class="size-4"/>
              </Button>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  {#if completed.length > 0}
    <div class="w-full border rounded-md p-4 mt-2">
      <div class="flex items-center gap-2 mb-4">
        <h3 class="font-semibold text-2xl">{$t('downloads.completed')}</h3>
        <Button onclick={() => DownloadManager.clearCompleted()} size="sm" variant="outline">
          {$t('downloads.clearAll')}
        </Button>
      </div>
      <div class="space-y-4">
        {#each completed as { status, item, completedAt } (item.id)}
          <div class="flex items-center gap-4 p-3 rounded-lg border bg-surface-alt">
            <img
              class="w-12 h-16 object-cover rounded"
              alt={item.title}
              src={item.images.tall}
            />

            <div class="flex-1">
              <div class="flex items-center gap-2">
                <h4 class="font-medium">{item.title}</h4>
                {#if status === 'failed'}
                  <Tooltip tooltip="Download failed">
                    <TriangleAlertIcon class="size-4 text-red-500"/>
                  </Tooltip>
                {/if}
              </div>
              <p class="text-sm text-muted-foreground">{new Date(completedAt!).toLocaleString($language)}</p>
            </div>

            <div class="flex items-center gap-2">
              <Button onclick={() => DownloadManager.removeFromQueue(item.id)} variant="outline">
                <XIcon class="size-4"/>
              </Button>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <CancelDownloadDialog
    onConfirm={cancelDownload}
    bind:open={showCancelDialog}
  />
</PageContent>