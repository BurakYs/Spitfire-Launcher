<script lang="ts">
  import DataStorage from '$lib/core/dataStorage';
  import DownloadManager from '$lib/core/managers/download.svelte';
  import { getCurrentWindow } from '@tauri-apps/api/window';
  import { platform } from '@tauri-apps/plugin-os';
  import LaunchGame from '$components/header/LaunchGame.svelte';
  import SettingsModal from '$components/settings/SettingsModal.svelte';
  import SidebarBurger from '$components/header/SidebarBurger.svelte';
  import LanguageSwitcher from '$components/header/LanguageSwitcher.svelte';
  import MinusIcon from 'lucide-svelte/icons/minus';
  import XIcon from 'lucide-svelte/icons/x';

  const appWindow = getCurrentWindow();
  const currentPlatform = platform();
  const isMobile = currentPlatform === 'android' || currentPlatform === 'ios';

  async function minimizeOrHide() {
    const settings = await DataStorage.getSettingsFile();

    if (settings.app?.hideToTray) {
      await appWindow.hide();
    } else {
      await appWindow.minimize();
    }
  }

  async function close() {
    await DownloadManager.pauseDownload();
    await appWindow.close();
  }
</script>

<header
  class="h-16 bg-surface-alt border-b border-border flex items-center justify-between md:justify-end px-4 select-none sticky top-0 z-10"
  data-tauri-drag-region
>
  <SidebarBurger/>

  <div class="flex items-center gap-x-2">
    <div class="flex items-center gap-x-2">
      {#if currentPlatform === 'windows'}
        <LaunchGame/>
      {/if}

      <SettingsModal/>
      <LanguageSwitcher/>
    </div>

    {#if !isMobile}
      <div class="flex items-center space-x-2 max-sm:hidden">
        <button class="p-2 hover:bg-accent rounded transition-colors duration-200" onclick={minimizeOrHide}>
          <MinusIcon/>
        </button>
        <button class="p-2 hover:bg-red-500/80 hover:text-white rounded transition-colors duration-200" onclick={close}>
          <XIcon/>
        </button>
      </div>
    {/if}
  </div>
</header>