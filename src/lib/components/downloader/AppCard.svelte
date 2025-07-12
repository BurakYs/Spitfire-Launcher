<script lang="ts">
  import { goto } from '$app/navigation';
  import Button from '$components/ui/Button.svelte';
  import DataStorage, { DOWNLOADER_FILE_PATH } from '$lib/core/dataStorage';
  import DownloadManager from '$lib/core/managers/download.svelte';
  import { favoritedAppIds, hiddenAppIds, ownedApps, perAppAutoUpdate, runningAppIds } from '$lib/stores';
  import Legendary from '$lib/utils/legendary';
  import { bytesToSize, sleep } from '$lib/utils/util';
  import type { DownloaderSettings } from '$types/settings';
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
  import { get } from 'svelte/store';

  type Props = {
    appId: string;
    globalAutoUpdate: boolean;
  };

  let dropdownOpen = $state(false);
  let isLaunching = $state(false);
  let isStopping = $state(false);
  let isDeleting = $state(false);
  let isVerifying = $state(false);

  let { appId, globalAutoUpdate }: Props = $props();

  const app = $derived.by(() => {
    // Need to explicitly declare $ownedApps because Svelte can't detect $ownedApps store changes for some reason
    const apps = $ownedApps;
    return apps.find(a => a.id === appId)!;
  });

  async function launchApp() {
    isLaunching = true;

    try {
      await Legendary.launch(app.id);
    } catch (error) {
      console.error(error);
      toast.error('Failed to launch app');
    } finally {
      isLaunching = false;
    }
  }

  async function stopApp() {
    isStopping = true;

    try {
      await invoke('stop_app', { appId: app.id });
      toast.success(`Stopped ${app.title}`);
    } catch (error) {
      console.error(error);
      toast.error(`Failed to stop ${app.title}`);
    } finally {
      // A delay to ensure the app is killed properly
      await sleep(2000);
      isStopping = false;
    }
  }

  async function toggleFavorite() {
    if (favoritedAppIds.has(app.id)) {
      favoritedAppIds.delete(app.id);
    } else {
      favoritedAppIds.add(app.id);
    }

    await DataStorage.writeConfigFile<DownloaderSettings>(DOWNLOADER_FILE_PATH, {
      favoriteApps: Array.from(favoritedAppIds)
    });
  }

  async function toggleHidden() {
    if (hiddenAppIds.has(app.id)) {
      hiddenAppIds.delete(app.id);
    } else {
      hiddenAppIds.add(app.id);
    }

    await DataStorage.writeConfigFile<DownloaderSettings>(DOWNLOADER_FILE_PATH, {
      hiddenApps: Array.from(hiddenAppIds)
    });
  }

  async function toggleAutoUpdate() {
    perAppAutoUpdate.update(current => {
      current[app.id] = !(current[app.id] ?? globalAutoUpdate);
      return current;
    });

    await DataStorage.writeConfigFile<DownloaderSettings>(DOWNLOADER_FILE_PATH, {
      perAppAutoUpdate: get(perAppAutoUpdate)
    });
  }

  async function installApp() {
    await DownloadManager.addToQueue(app);
  }

  async function uninstallApp() {
    isDeleting = true;

    try {
      await Legendary.uninstall(app.id);
      toast.success(`Uninstalled ${app.title}`);
    } catch (error) {
      console.error(error);
      toast.error(`Failed to uninstall ${app.title}`);
    } finally {
      isDeleting = false;
    }
  }

  async function verify() {
    isVerifying = true;

    try {
      const { requiresRepair } = await Legendary.verify(app.id);
      toast.success(`Verified ${app.title}`);
    } catch (error) {
      console.error(error);
      toast.error(`Failed to verify ${app.title}`);
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
      alt="App Thumbnail"
      loading="lazy"
      src={app.images.tall}
    />

    <div class="absolute top-2 right-2 flex flex-col space-y-2">
      {#if favoritedAppIds.has(app.id)}
        <button class="bg-black rounded-full p-1.5" onclick={() => toggleFavorite()} title="Unfavorite">
          <HeartIcon class="text-red-500 size-4.5" fill="red"/>
        </button>
      {:else}
        <button class="hidden group-hover:block bg-black rounded-full p-1.5" onclick={() => toggleFavorite()} title="Favorite">
          <HeartIcon class="text-gray-400 size-4.5"/>
        </button>
      {/if}

      {#if hiddenAppIds.has(app.id)}
        <button class="hidden group-hover:block bg-black rounded-full p-1.5" onclick={() => toggleHidden()} title="Unhide">
          <EyeOffIcon class="text-gray-400 size-4.5"/>
        </button>
      {:else}
        <button class="hidden group-hover:block bg-black rounded-full p-1.5" onclick={() => toggleHidden()} title="Hide">
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
      {#if !app.hasUpdate}
        {#if runningAppIds.has(app.id)}
          <Button
            class="flex items-center justify-center flex-1 gap-1 font-medium px-4"
            disabled={isStopping}
            onclick={() => stopApp()}
            size="sm"
            variant="danger"
          >
            {#if isStopping}
              <LoaderCircleIcon class="size-5 animate-spin"/>
            {:else}
              <XIcon class="size-5"/>
            {/if}
            Stop
          </Button>
        {:else}
          <Button
            class="flex items-center justify-center flex-1 gap-1 font-medium px-4"
            disabled={isLaunching || isVerifying || isDeleting}
            onclick={() => launchApp()}
            size="sm"
            variant="epic"
          >
            {#if isLaunching}
              <LoaderCircleIcon class="size-5 animate-spin"/>
            {:else}
              <PlayIcon class="size-5"/>
            {/if}
            Play
          </Button>
        {/if}
      {:else}
        {@const isUpdating = DownloadManager.downloadingAppId === app.id}

        <Button
          class="flex items-center justify-center flex-1 gap-2 font-medium px-4"
          disabled={isVerifying || isDeleting || DownloadManager.downloadingAppId === app.id}
          onclick={() => installApp()}
          size="sm"
          variant="secondary"
        >
          {#if DownloadManager.downloadingAppId === app.id}
            <LoaderCircleIcon class="size-5 animate-spin"/>
          {:else}
            <RefreshCwIcon class="size-5"/>
          {/if}
          Update {isUpdating && DownloadManager.progress.percent ? `(${Math.floor(DownloadManager.progress.percent)}%)` : ''}
        </Button>
      {/if}

      <Button
        class="font-medium ml-auto"
        size="sm"
        variant="ghost"
      >
        <DropdownMenu.Root bind:open={dropdownOpen}>
          {#snippet trigger()}
            <MoreHorizontalIcon class="size-6"/>
          {/snippet}

          {#if app.installed}
            <DropdownMenu.Item onclick={() => toggleAutoUpdate()}>
              {#if $perAppAutoUpdate[app.id] ?? globalAutoUpdate}
                <RefreshCwOffIcon class="size-5"/>
                Disable Auto Update
              {:else}
                <RefreshCwIcon class="size-5"/>
                Enable Auto Update
              {/if}
            </DropdownMenu.Item>

            <DropdownMenu.Item disabled={isVerifying || isDeleting || runningAppIds.has(app.id)} onclick={() => verify()}>
              {#if isVerifying}
                <LoaderCircleIcon class="size-5 animate-spin"/>
              {:else}
                <WrenchIcon class="size-5"/>
              {/if}
              Verify & Repair
            </DropdownMenu.Item>

            <DropdownMenu.Item class="hover:bg-destructive" disabled={isVerifying || isDeleting || runningAppIds.has(app.id)} onclick={() => uninstallApp()}>
              {#if isDeleting}
                <LoaderCircleIcon class="size-5 animate-spin"/>
              {:else}
                <Trash2Icon class="size-5"/>
              {/if}
              Uninstall
            </DropdownMenu.Item>

            <DropdownMenu.Item disabled={true}>
              <HardDriveIcon class="size-5"/>
              Size: {bytesToSize(app.sizeBytes)}
            </DropdownMenu.Item>
          {/if}
        </DropdownMenu.Root>
      </Button>
    {:else}
      {@const isInstalling = DownloadManager.downloadingAppId === app.id}
      {@const isInQueue = DownloadManager.isInQueue(app.id) && !isInstalling}

      {#if isInQueue}
        <Button
          class="flex items-center justify-center flex-1 gap-2 font-medium px-4 py-2"
          onclick={() => DownloadManager.removeFromQueue(app.id)}
          size="sm"
          title="Remove from Queue"
          variant="danger"
        >
          <CircleMinusIcon class="size-5"/>
          Remove
        </Button>
      {:else}
        <Button
          class="flex items-center justify-center flex-1 gap-2 font-medium px-4 py-2"
          disabled={isInstalling}
          onclick={() => isInstalling ? goto('/downloader/downloads') : installApp()}
          size="sm"
          variant="outline"
        >
          {#if isInstalling}
            <LoaderCircleIcon class="size-5 animate-spin"/>
          {:else}
            <DownloadIcon class="size-5"/>
          {/if}
          Install {isInstalling && DownloadManager.progress.percent ? `(${Math.floor(DownloadManager.progress.percent)}%)` : ''}
        </Button>
      {/if}
    {/if}
  </div>
</div>
