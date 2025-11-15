import { derived, writable, type Writable } from 'svelte/store';
import { dev } from '$app/environment';
import { accountDataFileSchema } from '$lib/validations/accounts';
import { allSettingsSchema, automationSettingsSchema, deviceAuthsSettingsSchema, downloaderSettingsSchema, taxiSettingsSchema } from '$lib/validations/settings';
import type { AccountDataFile } from '$types/accounts';
import type { AllSettings, AutomationSettings, DeviceAuthsSettings, DownloaderSettings, TaxiSettings } from '$types/settings';
import { path } from '@tauri-apps/api';
import { dataDir, homeDir } from '@tauri-apps/api/path';
import { exists, mkdir, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { platform } from '@tauri-apps/plugin-os';
import debounce from '$lib/utils/debounce';
import type { ZodType } from 'zod';
import { baseLocale, type Locale } from '$lib/paraglide/runtime';

export default class DataStorage<T> implements Writable<T> {
  private readonly path: string;
  private readonly defaults: T;

  private readonly debouncedWrite: (data: Partial<T>) => Promise<void>;
  public readonly ready: Promise<void>;
  private static dataDirectory?: string;

  subscribe: Writable<T>['subscribe'];
  set: Writable<T>['set'];
  update: Writable<T>['update'];

  constructor(fileName: string, defaults: T, schema: ZodType<T>) {
    const store = writable<T>(defaults);

    this.path = dev ? `${fileName}-dev.json` : `${fileName}.json`;
    this.defaults = defaults;

    this.subscribe = store.subscribe;
    this.set = store.set;
    this.update = store.update;

    this.debouncedWrite = debounce(this.writeConfigFile.bind(this), 500);
    this.ready = this.init(schema);
  }

  private async init(schema: ZodType<T>) {
    const file = await this.getConfigFile();

    const parseResult = schema.safeParse(file);
    const data = parseResult.success ? parseResult.data : this.defaults;

    this.set(data);
    this.subscribe(async (data) => {
      await this.debouncedWrite(data);
    });
  }

  private async getConfigFile() {
    const configFilePath = await this.getConfigPath();
    let configFileContent: string | null = null;

    try {
      configFileContent = await readTextFile(configFilePath);
    } catch {
      await writeTextFile(configFilePath, JSON.stringify(this.defaults, null, 4));
    }

    let data: T | undefined = this.defaults;

    if (configFileContent) {
      try {
        data = JSON.parse(configFileContent);
      } catch { /* empty */ }
    }

    return this.mergeWithDefaults(this.defaults, data);
  }

  private async writeConfigFile(data: Partial<T>) {
    const configFilePath = await this.getConfigPath();
    await writeTextFile(configFilePath, JSON.stringify(data, null, 4));
  }

  private async getConfigPath() {
    const dataDirectory = await DataStorage.getDataDirectory();
    return path.join(dataDirectory, this.path);
  }

  private mergeWithDefaults<T>(defaults: T, data: T): T {
    if (Array.isArray(data)) return data;

    const merged = Object.assign({}, defaults);

    for (const key in data) {
      if (data[key] === undefined) {
        // @ts-expect-error - idk
        merged[key] = defaults[key];
      } else if (data[key] instanceof Object && defaults[key] instanceof Object && !Array.isArray(defaults[key])) {
        merged[key] = this.mergeWithDefaults(defaults[key], data[key]) as any;
      } else {
        merged[key] = data[key] as any;
      }
    }

    return merged;
  }

  public static async getDataDirectory() {
    if (DataStorage.dataDirectory) return DataStorage.dataDirectory;

    const dataDirectory = platform() === 'android' ? await dataDir() : await path.join(await dataDir(), 'spitfire-launcher');

    if (!(await exists(dataDirectory))) {
      await mkdir(dataDirectory, { recursive: true });
    }

    DataStorage.dataDirectory = dataDirectory;
    return dataDirectory;
  }
}

const accountsStorage = new DataStorage<AccountDataFile>(
  'accounts',
  { accounts: [] },
  accountDataFileSchema
);

const settingsStorage = new DataStorage<AllSettings>(
  'settings',
  {
    app: {
      language: null,
      claimRewardsDelay: 1.5,
      missionCheckInterval: 5,
      startingPage: 'stwMissionAlerts',
      discordStatus: true,
      hideToTray: false,
      checkForUpdates: true
    }
  },
  allSettingsSchema
);

const deviceAuthsStorage = new DataStorage<DeviceAuthsSettings>(
  'device-auths',
  [],
  deviceAuthsSettingsSchema
);

const automationStorage = new DataStorage<AutomationSettings>(
  'automation',
  [],
  automationSettingsSchema
);

const taxiStorage = new DataStorage<TaxiSettings>(
  'taxi',
  [],
  taxiSettingsSchema
);

const downloaderStorage = new DataStorage<DownloaderSettings>(
  'downloader',
  {
    downloadPath: await path.join(await homeDir(), 'Games', 'Spitfire Launcher'),
    noHTTPS: false,
    autoUpdate: true,
    sendNotifications: true,
    favoriteApps: [],
    hiddenApps: [],
    perAppAutoUpdate: {},
    queue: {}
  },
  downloaderSettingsSchema
);

await Promise.all([
  accountsStorage.ready,
  settingsStorage.ready,
  deviceAuthsStorage.ready,
  automationStorage.ready,
  taxiStorage.ready,
  downloaderStorage.ready
]);

const activeAccountStore = derived([accountsStorage], ([$accountsStorage]) => {
  return $accountsStorage.activeAccountId ? $accountsStorage.accounts.find((account) => account.accountId === $accountsStorage.activeAccountId) || null : null;
});

const language = derived([settingsStorage], ([$settingsStorage]) => {
  return $settingsStorage.app?.language || baseLocale;
}, baseLocale as Locale);

export {
  accountsStorage,
  activeAccountStore,
  settingsStorage,
  language,
  deviceAuthsStorage,
  automationStorage,
  taxiStorage,
  downloaderStorage
};