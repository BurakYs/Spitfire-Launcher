<script lang="ts">
  import Button from '$components/ui/Button.svelte';
  import { launcherAppClient2 } from '$lib/constants/clients';
  import Authentication from '$lib/core/authentication';
  import DataStorage from '$lib/core/dataStorage';
  import Manifest from '$lib/core/manifest';
  import { accountsStore, runningAppIds } from '$lib/stores';
  import { shouldErrorBeIgnored, t } from '$lib/utils/util';
  import type { LegendaryLaunchData } from '$types/legendary';
  import { path } from '@tauri-apps/api';
  import { invoke } from '@tauri-apps/api/core';
  import { Command } from '@tauri-apps/plugin-shell';
  import GamePad2Icon from 'lucide-svelte/icons/gamepad-2';
  import CircleStopIcon from 'lucide-svelte/icons/circle-stop';
  import { toast } from 'svelte-sonner';

  const activeAccount = $derived($accountsStore.activeAccount);

  const fortniteAppId = 'Fortnite';
  const launchData: LegendaryLaunchData & { game_id: string } = {
    game_id: fortniteAppId,
    game_parameters: [],
    game_executable: 'FortniteGame/Binaries/Win64/FortniteLauncher.exe',
    game_directory: '',
    egl_parameters: [],
    launch_command: [],
    working_directory: '',
    user_parameters: [],
    environment: {},
    pre_launch_command: '',
    pre_launch_wait: false
  };

  let isLoading = $state(false);

  async function launchFortnite() {
    if (runningAppIds.has(fortniteAppId)) {
      toast.error($t('launchGame.alreadyRunning'));
      return;
    }

    isLoading = true;
    const toastId = toast.loading($t('launchGame.launching'));

    try {
      const userSettings = await DataStorage.getSettingsFile();
      const manifestData = await Manifest.getFortniteManifest();
      const customPath = userSettings?.app?.gamePath;

      let gameDirectory = manifestData?.installLocation;
      if (customPath) {
        const [customInstallDir] = customPath.replaceAll('\\', '/').split('/FortniteGame/Binaries/Win64');
        gameDirectory = customInstallDir;
      }

      if (!gameDirectory) {
        toast.error($t('launchGame.notInstalled'), { id: toastId });
        return;
      }

      launchData.game_directory = gameDirectory;
      launchData.working_directory = await path.join(gameDirectory, 'FortniteGame/Binaries/Win64');

      const deviceAuthResponse = await Authentication.getAccessTokenUsingDeviceAuth(activeAccount!);
      const oldExchangeData = await Authentication.getExchangeCodeUsingAccessToken(deviceAuthResponse.access_token);
      const launcherAccessTokenData = await Authentication.getAccessTokenUsingExchangeCode(oldExchangeData.code, launcherAppClient2);
      const launcherExchangeData = await Authentication.getExchangeCodeUsingAccessToken(launcherAccessTokenData.access_token);

      launchData.game_parameters = manifestData?.launchCommand.split(' ') || [];
      launchData.egl_parameters = [
        '-AUTH_LOGIN=unused',
        `-AUTH_PASSWORD=${launcherExchangeData.code}`,
        '-AUTH_TYPE=exchangecode',
        '-epicapp=Fortnite',
        '-epicenv=Prod',
        '-EpicPortal',
        `-epicusername=${deviceAuthResponse.displayName}`,
        `-epicuserid=${activeAccount!.accountId}`,
        `-epicsandboxid=${manifestData?.namespace || 'fn'}`
      ];

      await invoke<number>('launch_app', { launchData });
    } catch (error) {
      if (shouldErrorBeIgnored(error)) {
        toast.dismiss(toastId);
        return;
      }

      console.error(error);

      if (typeof error === 'string' && error.toLowerCase().includes('executable not found')) {
        toast.error($t('launchGame.notInstalled'), { id: toastId });
      } else {
        toast.error($t('launchGame.failedToLaunch'), { id: toastId });
      }
    } finally {
      isLoading = false;
    }
  }

  async function stopFortnite() {
    const toastId = toast.loading($t('launchGame.stopping'));

    try {
      const { code } = await Command.create('kill-fortnite').execute();
      if (code !== 0) {
        throw new Error(`Command exited with code ${code}`);
      }

      await invoke<number>('stop_app', { appId: fortniteAppId });

      toast.success($t('launchGame.stopped'), { id: toastId });
    } catch (error) {
      console.error(error);
      toast.error($t('launchGame.failedToStop'), { id: toastId });
    }
  }

  async function launchOrStop() {
    if (runningAppIds.has(fortniteAppId)) {
      await stopFortnite();
    } else {
      await launchFortnite();
    }
  }
</script>

<Button
  class="flex items-center justify-between gap-x-2 shrink-0"
  disabled={!activeAccount || (isLoading && !runningAppIds.has(fortniteAppId))}
  onclick={launchOrStop}
  variant={runningAppIds.has(fortniteAppId) ? 'danger' : 'epic'}
>
  {#if runningAppIds.has(fortniteAppId)}
    <span class="hidden xs:block">{$t('launchGame.stop')}</span>
    <CircleStopIcon class="size-6 xs:hidden block"/>
  {:else}
    <span class="hidden xs:block">{$t('launchGame.launch')}</span>
    <GamePad2Icon class="size-6 xs:hidden block"/>
  {/if}
</Button>
