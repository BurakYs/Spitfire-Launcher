import Authentication from '$lib/core/authentication';
import LegendaryError from '$lib/exceptions/LegendaryError';
import { ownedApps } from '$lib/stores';
import type { AccountData } from '$types/accounts';
import type { EpicOAuthData } from '$types/game/authorizations';
import type { LegendaryAppInfo, LegendaryInstalledList, LegendaryList, LegendaryStatus } from '$types/legendary';
import { path } from '@tauri-apps/api';
import { invoke } from '@tauri-apps/api/core';
import { readTextFile } from '@tauri-apps/plugin-fs';

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

  static async getStatus(useCache = true) {
    if (useCache && this.caches.status) {
      return this.caches.status;
    }

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

  static async getAppInfo(id: string) {
    return await this.execute<LegendaryAppInfo>(['info', id, '--json']);
  }

  static async getInstalledList() {
    await this.execute(['egl-sync', '-y', '--enable-sync']).catch(console.error);
    return await this.execute<LegendaryInstalledList>(['list-installed', '--json']);
  }

  static async launch(id: string) {
    return await this.execute(['launch', id]);
  }

  static async verify(id: string) {
    const { stderr } = await this.execute<string>(['verify', id, '-y', '--skip-sdl']);

    return {
      requiresRepair: stderr.includes('repair your game installation')
    };
  }

  static async repair(id: string) {
    return await this.execute(['repair', id, '-y', '--skip-sdl']);
  }

  static async uninstall(appId: string) {
    const data = await this.execute(['uninstall', appId, '-y']);

    ownedApps.update(current => {
      const existingGame = current.find(g => g.id === appId);
      if (existingGame) {
        existingGame.installed = false;
      }

      return current;
    });

    return data;
  }
}