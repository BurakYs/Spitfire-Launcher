<script lang="ts">
  import Button from '$components/ui/Button.svelte';
  import { downloaderStorage } from '$lib/core/data-storage';
  import DownloadManager from '$lib/core/managers/download.svelte';
  import { ownedApps, runningAppIds } from '$lib/stores';
  import Legendary from '$lib/core/legendary';
  import { bytesToSize, handleError, sleep, t } from '$lib/utils/util';
  import { invoke } from '@tauri-apps/api/core';
  import CircleMinusIcon from 'lucide-svelte/icons/circle-minus';
  import RefreshCwOffIcon from 'lucide-svelte/icons/refresh-cw-off';
  import WrenchIcon from 'lucide-svelte/icons/wrench';
  import DownloadIcon from 'lucide-svelte/icons/download';
  import EyeIcon from 'lucide-svelte/icons/eye';
  import EyeOffIcon from 'lucide-svelte/icons/eye-off';
  import HardDriveIcon from 'lucide-svelte/icons/hard-drive';
  import HeartIcon from 'lucide-svelte/icons/heart';
  import LoaderCircleIcon from 'lucide-svelte/icons/loader-circle';
  import MoreHorizontalIcon from 'lucide-svelte/icons/more-horizontal';
  import PlayIcon from 'lucide-svelte/icons/play';
  import { DropdownMenu } from '$components/ui/DropdownMenu';
  import RefreshCwIcon from 'lucide-svelte/icons/refresh-cw';
  import Trash2Icon from 'lucide-svelte/icons/trash-2';
  import XIcon from 'lucide-svelte/icons/x';
  import { toast } from 'svelte-sonner';

  type Props = {
    appId: string;
    installDialogAppId?: string;
    uninstallDialogAppId?: string;
  };

  let dropdownOpen = $state(false);
  let isLaunching = $state(false);
  let isStopping = $state(false);
  let isDeleting = $state(false);
  let isVerifying = $state(false);

  let {
    appId,
    installDialogAppId = $bindable(),
    uninstallDialogAppId = $bindable()
  }: Props = $props();

  const app = $derived($ownedApps.find(x => x.id === appId)!);

  async function launchApp() {
    isLaunching = true;

    try {
      await Legendary.launch(app.id);
    } catch (error) {
      handleError(error, $t('library.app.failedToLaunch', { name: app.title }));
    } finally {
      isLaunching = false;
    }
  }

  async function stopApp() {
    isStopping = true;

    try {
      await invoke('stop_app', { appId: app.id });
      toast.success($t('library.app.stopped', { name: app.title }));
    } catch (error) {
      handleError(error, $t('library.app.failedToStop', { name: app.title }));
    } finally {
      // A delay to ensure the app is killed properly
      await sleep(2000);
      isStopping = false;
    }
  }

  async function toggleFavorite() {
    downloaderStorage.update(current => {
      current.favoriteApps ??= [];

      if (current.favoriteApps.includes(app.id)) {
        current.favoriteApps = current.favoriteApps.filter(id => id !== app.id);
      } else {
        current.favoriteApps.push(app.id);
      }

      return current;
    });
  }

  async function toggleHidden() {
    downloaderStorage.update(current => {
      current.hiddenApps ??= [];

      if (current.hiddenApps.includes(app.id)) {
        current.hiddenApps = current.hiddenApps.filter(id => id !== app.id);
      } else {
        current.hiddenApps.push(app.id);
      }

      return current;
    });
  }

  async function toggleAutoUpdate() {
    downloaderStorage.update(current => {
      current.perAppAutoUpdate ??= {};
      current.perAppAutoUpdate[app.id] = !(current.perAppAutoUpdate[app.id] ?? current.autoUpdate);
      return current;
    });
  }

  async function installApp() {
    await DownloadManager.addToQueue(app);
  }

  async function verifyAndRepair() {
    isVerifying = true;

    try {
      const { requiresRepair } = await Legendary.verify(app.id);
      if (!requiresRepair) {
        return toast.success($t('library.app.verified', { name: app.title }));
      }

      toast.success($t('library.app.requiresRepair', { name: app.title }));
      await DownloadManager.addToQueue(app);
    } catch (error) {
      handleError(error, $t('library.app.failedToVerify', { name: app.title }));
    } finally {
      isVerifying = false;
    }
  }
</script>

<div
  class="w-44 bg-surface-alt mt-3 rounded-md hover:scale-[102%] transition-transform group flex flex-col"
  oncontextmenu={(e) => {
    e.preventDefault();
    dropdownOpen = true;
  }}
  role="button"
  tabindex="0"
>
  <div class="relative">
    <img
      class="size-full h-60 object-cover rounded-t-md group-hover:grayscale-0"
      class:grayscale={!app.installed}
      alt="Thumbnail"
      loading="lazy"
      src={app.images.tall}
    />

    <div class="absolute top-2 right-2 flex flex-col space-y-2">
      {#if $downloaderStorage.favoriteApps?.includes(app.id)}
        <button class="bg-black rounded-full p-1.5" onclick={toggleFavorite} title={$t('library.app.unfavorite')}>
          <HeartIcon class="text-red-500 size-4.5" fill="red"/>
        </button>
      {:else}
        <button class="hidden group-hover:block bg-black rounded-full p-1.5" onclick={toggleFavorite} title={$t('library.app.favorite')}>
          <HeartIcon class="text-gray-400 size-4.5"/>
        </button>
      {/if}

      {#if $downloaderStorage.hiddenApps?.includes(app.id)}
        <button class="hidden group-hover:block bg-black rounded-full p-1.5" onclick={toggleHidden} title={$t('library.app.show')}>
          <EyeOffIcon class="text-gray-400 size-4.5"/>
        </button>
      {:else}
        <button class="hidden group-hover:block bg-black rounded-full p-1.5" onclick={toggleHidden} title={$t('library.app.hide')}>
          <EyeIcon class="text-gray-400 size-4.5"/>
        </button>
      {/if}
    </div>

    <div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
      <h3 class="font-semibold text-white mt-6">
        {app.title}
      </h3>
    </div>
  </div>

  <div class="flex gap-1 p-3 grow">
    {#if app.installed && !DownloadManager.isInQueue(app.id)}
      {#if app.hasUpdate}
        {@render UpdateButton()}
      {:else if app.requiresRepair}
        {@render RepairButton()}
      {:else}
        {#if runningAppIds.has(app.id)}
          {@render StopButton()}
        {:else}
          {@render PlayButton()}
        {/if}
      {/if}

      <DropdownMenu.Root
        contentProps={{
          class: 'w-fit'
        }}
        bind:open={dropdownOpen}
      >
        {#snippet trigger()}
          <Button
            class="font-medium ml-auto"
            size="sm"
            variant="ghost"
          >
            <MoreHorizontalIcon class="size-6"/>
          </Button>
        {/snippet}

        {#if app.installed}
          <DropdownMenu.Item onclick={toggleAutoUpdate}>
            {#if ($downloaderStorage.perAppAutoUpdate || {})[app.id] ?? $downloaderStorage.autoUpdate}
              <RefreshCwOffIcon class="size-5"/>
              {$t('library.app.dropdown.autoUpdate.disable')}
            {:else}
              <RefreshCwIcon class="size-5"/>
              {$t('library.app.dropdown.autoUpdate.enable')}
            {/if}
          </DropdownMenu.Item>

          <DropdownMenu.Item disabled={isVerifying || isDeleting || runningAppIds.has(app.id)} onclick={verifyAndRepair}>
            {#if isVerifying}
              <LoaderCircleIcon class="size-5 animate-spin"/>
            {:else}
              <WrenchIcon class="size-5"/>
            {/if}
            {$t('library.app.dropdown.verifyAndRepair')}
          </DropdownMenu.Item>

          <DropdownMenu.Item
            class="hover:bg-destructive"
            disabled={isVerifying || isDeleting || runningAppIds.has(app.id) || !!DownloadManager.downloadingAppId}
            onclick={() => setTimeout(() => uninstallDialogAppId = app.id)}
          >
            {#if isDeleting}
              <LoaderCircleIcon class="size-5 animate-spin"/>
            {:else}
              <Trash2Icon class="size-5"/>
            {/if}
            {$t('library.app.dropdown.uninstall')}
          </DropdownMenu.Item>

          <DropdownMenu.Item disabled={true}>
            <HardDriveIcon class="size-5"/>
            {$t('library.app.dropdown.size')}: {bytesToSize(app.installSize)}
          </DropdownMenu.Item>
        {/if}
      </DropdownMenu.Root>
    {:else}
      {@const isInstalling = DownloadManager.downloadingAppId === app.id}

      {#if DownloadManager.isInQueue(app.id) && !isInstalling}
        {@render RemoveFromQueueButton()}
      {:else}
        {@render InstallButton(isInstalling)}
      {/if}
    {/if}
  </div>
</div>

{#snippet StopButton()}
  <Button
    class="flex items-center justify-center flex-1 gap-2 text-sm"
    disabled={isStopping}
    onclick={() => stopApp()}
    variant="danger"
  >
    {#if isStopping}
      <LoaderCircleIcon class="size-5 animate-spin"/>
    {:else}
      <XIcon class="size-5"/>
    {/if}
    {$t('library.app.stop')}
  </Button>
{/snippet}

{#snippet PlayButton()}
  <Button
    class="flex items-center justify-center flex-1 gap-2 text-sm"
    disabled={isLaunching || isVerifying || isDeleting}
    onclick={() => launchApp()}
    variant="epic"
  >
    {#if isLaunching}
      <LoaderCircleIcon class="size-5 animate-spin"/>
    {:else}
      <PlayIcon class="size-5"/>
    {/if}
    {$t('library.app.play')}
  </Button>
{/snippet}

{#snippet UpdateButton()}
  <Button
    class="flex items-center justify-center flex-1 gap-2 text-sm"
    disabled={isVerifying || isDeleting}
    onclick={installApp}
    variant="secondary"
  >
    <RefreshCwIcon class="size-5"/>
    {$t('library.app.update')}
  </Button>
{/snippet}

{#snippet RepairButton()}
  <Button
    class="flex items-center justify-center flex-1 gap-2 text-sm"
    disabled={isVerifying || isDeleting}
    onclick={verifyAndRepair}
    variant="secondary"
  >
    <WrenchIcon class="size-5"/>
    {$t('library.app.repair')}
  </Button>
{/snippet}

{#snippet RemoveFromQueueButton()}
  <Button
    class="flex items-center justify-center flex-1 gap-2 text-sm"
    onclick={() => DownloadManager.removeFromQueue(app.id)}
    title={$t('library.app.removeFromQueue.long')}
    variant="danger"
  >
    <CircleMinusIcon class="size-5"/>
    {$t('library.app.removeFromQueue.short')}
  </Button>
{/snippet}

{#snippet InstallButton(isInstalling: boolean)}
  {@const percent = isInstalling && DownloadManager.progress.percent ? `(${Math.floor(DownloadManager.progress.percent)}%)` : ''}

  <Button
    class="flex items-center justify-center flex-1 gap-2 text-sm"
    disabled={isInstalling}
    onclick={() => installDialogAppId = app.id}
    variant="outline"
  >
    {#if isInstalling}
      <LoaderCircleIcon class="size-5 animate-spin"/>
    {:else}
      <DownloadIcon class="size-5"/>
    {/if}
    {app.hasUpdate ? $t('library.app.update') : app.requiresRepair ? $t('library.app.repair') : $t('library.app.install')} {percent}
  </Button>
{/snippet}