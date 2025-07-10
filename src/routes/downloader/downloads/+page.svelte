<script lang="ts">
  import PageContent from '$components/PageContent.svelte';
  import Button from '$components/ui/Button.svelte';
  import DownloadManager, { type DownloadProgress } from '$lib/core/managers/download.svelte';
  import { bytesToSize, formatRemainingDuration, t } from '$lib/utils/util';
  import { Progress } from 'bits-ui';
  import ClockIcon from 'lucide-svelte/icons/clock';
  import DownloadIcon from 'lucide-svelte/icons/download';
  import HardDriveIcon from 'lucide-svelte/icons/hard-drive';
  import LoaderCircleIcon from 'lucide-svelte/icons/loader-circle';
  import PauseIcon from 'lucide-svelte/icons/pause';
  import PlayIcon from 'lucide-svelte/icons/play';
  import XIcon from 'lucide-svelte/icons/x';

  const paused = false;
  let cancelling = $state(false);

  const currentDownload = $derived(DownloadManager.downloadingAppId && DownloadManager.queue[0]);

  const progress = $derived<DownloadProgress>({
    installSize: DownloadManager.progress.installSize || 0,
    downloadSize: DownloadManager.progress.downloadSize || 0,
    percent: DownloadManager.progress.percent || 0,
    etaMs: DownloadManager.progress.etaMs || 0,
    downloaded: DownloadManager.progress.downloaded || 0,
    downloadSpeed: DownloadManager.progress.downloadSpeed || 0,
    diskWriteSpeed: DownloadManager.progress.diskWriteSpeed || 0
  });

  function togglePause() {
    // todo
  }

  function cancel() {
    if (!currentDownload) return;

    cancelling = true;
    DownloadManager.removeFromQueue(currentDownload.id)
      .finally(() => {
        cancelling = false;
      });
  }
</script>

<PageContent title={$t('downloads.page.title')}>
  <div class="w-full border rounded-md p-3 relative h-36 {!currentDownload && 'bg-surface-alt'}">
    {#if currentDownload}
      <img
        class="absolute inset-0 size-full object-cover rounded-md opacity-10 pointer-events-none"
        alt="Background"
        src={currentDownload.images.wide}
      />

      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <h3 class="font-semibold text-lg">{currentDownload.title}</h3>
          <div class="flex items-center gap-2">
            <Button class="p-2" onclick={togglePause} size="sm" variant="outline" disabled={cancelling}>
              {#if paused}
                <PlayIcon class="size-4"/>
              {:else}
                <PauseIcon class="size-4"/>
              {/if}
            </Button>
            <Button class="p-2" onclick={() => cancel()} size="sm" variant="outline" disabled={cancelling}>
              {#if cancelling}
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
              {#if paused}
                Paused
              {:else}
                <ClockIcon class="size-4"/>
                {formatRemainingDuration((progress.downloadSize - progress.downloaded) / progress.downloadSpeed * 1000)}
              {/if}
            </span>
          </div>
        </div>
      </div>
    {:else}
      <div class="flex items-center justify-center h-full">
        <p class="text-muted-foreground">No downloads in progress</p>
      </div>
    {/if}
  </div>

  {#if DownloadManager.queue.length > 1}
    <div class="w-full border rounded-md p-3 mt-2">
      <h3 class="font-semibold text-3xl mb-4">Queue</h3>
      <div class="space-y-4">
        {#each DownloadManager.queue.slice(1) as item (item.id)}
          <div class="flex items-center gap-4 p-3 rounded-lg border bg-surface-alt">
            <img
              class="w-12 h-16 object-cover rounded"
              alt={item.title}
              src={item.images.tall}
            />

            <div class="flex-1">
              <h4 class="font-medium">{item.title}</h4>
              <p class="text-sm text-muted-foreground">{bytesToSize(item.sizeBytes, 2)}</p>
            </div>

            <div class="flex items-center gap-2">
              <Button variant="outline">
                <PlayIcon class="size-4"/>
              </Button>
              <Button onclick={() => DownloadManager.removeFromQueue(item.id)} variant="outline">
                <XIcon class="size-4"/>
              </Button>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</PageContent>