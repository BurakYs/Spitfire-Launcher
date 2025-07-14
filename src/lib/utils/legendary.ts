import Authentication from '$lib/core/authentication';
import DataStorage from '$lib/core/dataStorage';
import DownloadManager from '$lib/core/managers/download.svelte';
import LegendaryError from '$lib/exceptions/LegendaryError';
import { ownedApps, perAppAutoUpdate } from '$lib/stores';
import { t } from '$lib/utils/util';
import type { AccountData } from '$types/accounts';
import type { EpicOAuthData } from '$types/game/authorizations';
import type { LegendaryAppInfo, LegendaryInstalledList, LegendaryLaunchData, LegendaryList, LegendaryStatus } from '$types/legendary';
import { path } from '@tauri-apps/api';
import { invoke } from '@tauri-apps/api/core';
import { readTextFile } from '@tauri-apps/plugin-fs';
import { toast } from 'svelte-sonner';
import { get } from 'svelte/store';

type ExecuteResult<T = any> = {
  code: number | null;
  signal: number | null;
  stdout: T;
  stderr: string;
}

export type StreamEvent = {
  stream_id: string;
  event_type: 'stdout' | 'stderr' | 'terminated' | 'error';
  data: string;
  code?: number;
  signal?: number;
}

export default class Legendary {
  private static cachedApps = false;
  private static caches: {
    status?: LegendaryStatus;
    account?: string;
  } = {};

  static async execute<T>(args: string[]): Promise<ExecuteResult<T>> {
    const json = args.includes('--json');

    try {
      const result: ExecuteResult = await invoke('run_legendary', { args });

      if (json) {
        result.stdout = JSON.parse(result.stdout) as T;
      }

      if (result.code !== 0) {
        throw new Error(result.stderr);
      }

      return result;
    } catch (error) {
      if (error instanceof Error) {
        throw new LegendaryError(error.message);
      } else {
        throw new LegendaryError(String(error));
      }
    }
  }

  static async login(account: AccountData) {
    const accessToken = await Authentication.verifyOrRefreshAccessToken(account);
    const { code: exchange } = await Authentication.getExchangeCodeUsingAccessToken(accessToken);

    const data = await this.execute<string>(['auth', '--token', exchange]);
    this.caches.account = account.accountId;
    if (this.caches.status) this.caches.status.account = account.accountId;

    return data;
  }

  static async logout() {
    const data = await this.execute<string>(['auth', '--delete']);
    this.caches.account = undefined;
    if (this.caches.status) this.caches.status.account = null;

    return data;
  }

  static async getList() {
    return await this.execute<LegendaryList>(['list', '--json']);
  }

  static async getStatus() {
    if (this.caches.status) return this.caches.status;

    const { stdout } = await this.execute<LegendaryStatus>(['status', '--json']);

    if (stdout.account === '<not logged in>') {
      stdout.account = null;
    }

    this.caches.status = stdout;
    return stdout;
  }

  static async getAccount() {
    if (this.caches.account) {
      return this.caches.account;
    }

    const status = await this.getStatus();
    if (!status.account) {
      return null;
    }

    try {
      const userConfig = await path.join(status.config_directory, 'user.json');
      const file = await readTextFile(userConfig);
      const data: EpicOAuthData = JSON.parse(file);
      return data.account_id;
    } catch (error) {
      return null;
    }
  }

  static async getAppInfo(appId: string) {
    return await this.execute<LegendaryAppInfo>(['info', appId, '--json']);
  }

  static async getInstalledList() {
    await this.execute(['egl-sync', '-y', '--enable-sync']).catch(console.error);
    return await this.execute<LegendaryInstalledList>(['list-installed', '--json']);
  }

  static async launch(appId: string) {
    const { stdout: launchData } = await this.execute<LegendaryLaunchData>(['launch', appId, '--dry-run', '--json']);
    return await invoke<number>('launch_app', {
      launchData: {
        ...launchData,
        game_id: appId
      }
    });
  }

  static async verify(appId: string) {
    const { stderr } = await this.execute<string>(['verify', appId, '-y', '--skip-sdl']);
    const requiresRepair = stderr.includes('repair your game installation');
    const requiredRepair = get(ownedApps).find(app => app.id === appId)?.requiresRepair || false;

    if (requiresRepair !== requiredRepair) {
      ownedApps.update(current => {
        return current.map(app =>
          app.id === appId
            ? { ...app, requiresRepair }
            : app
        );
      });
    }

    return { requiresRepair };
  }

  static async uninstall(appId: string) {
    const data = await this.execute(['uninstall', appId, '-y']);

    ownedApps.update(current => {
      return current.map(app =>
        app.id === appId
          ? { ...app, installed: false }
          : app
      );
    });

    return data;
  }

  static async cacheApps() {
    if (Legendary.cachedApps) return;

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
          requiresRepair: installed && installed.needs_verification,
          hasUpdate: installed ? installed.version !== app.asset_infos.Windows.build_version : false,
          installSize: installed?.install_size || 0,
          installed: !!installed,
          canRunOffline: installed?.can_run_offline || false
        };
      }));

    Legendary.cachedApps = true;
  }

  static async autoUpdateApps() {
    const settings = await DataStorage.getDownloaderFile();

    const updatableApps = get(ownedApps).filter(app => app.hasUpdate);
    const appAutoUpdate = get(perAppAutoUpdate);

    let sentFirstNotification = false;

    for (const app of updatableApps) {
      if (appAutoUpdate[app.id] ?? settings.autoUpdate) {
        await DownloadManager.addToQueue(app);

        if (!sentFirstNotification) {
          sentFirstNotification = true;
          toast.info(get(t)('library.app.startedUpdate', { name: app.title }));
        }
      }
    }
  }
}