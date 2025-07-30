import { derived, writable, type Writable } from 'svelte/store';
import { dev } from '$app/environment';
import config from '$lib/config';
import { accountDataFileSchema } from '$lib/validations/accounts';
import { allSettingsSchema, automationSettingsSchema, deviceAuthsSettingsSchema, downloaderSettingsSchema, taxiSettingsSchema } from '$lib/validations/settings';
import type { AccountDataFile } from '$types/accounts';
import type { AllSettings, AutomationSettings, DeviceAuthsSettings, DownloaderSettings, TaxiSettings } from '$types/settings';
import { path } from '@tauri-apps/api';
import { dataDir, homeDir } from '@tauri-apps/api/path';
import { exists, mkdir, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { platform } from '@tauri-apps/plugin-os';
import type { ZodType } from 'zod';
import { baseLocale, type Locale } from '$lib/paraglide/runtime';

class DataStorage<T> implements Writable<T> {
  private readonly path: string;
  public readonly ready: Promise<void>;
  private configPath?: string;
  private store: Writable<T>;

  subscribe: Writable<T>['subscribe'];
  set: Writable<T>['set'];
  update: Writable<T>['update'];

  constructor(fileName: string, defaultData: T, schema: ZodType<T>) {
    this.path = dev ? `${fileName}-dev.json` : `${fileName}.json`;
    this.store = writable<T>(defaultData);

    this.subscribe = this.store.subscribe;
    this.set = this.store.set;
    this.update = this.store.update;

    this.ready = this.init(defaultData, schema, fileName);

    this.store.subscribe((data) => {
      this.writeConfigFile(data).catch(console.error);
    });
  }

  private async init(defaultData: T, schema: ZodType<T>, fileName: string) {
    const file = await this.getConfigFile(defaultData);

    const parseResult = schema.safeParse(file);
    const data = parseResult.success ? parseResult.data : defaultData;

    if (fileName === 'downloader') {
      const downloaderSettings = data as DownloaderSettings;
      downloaderSettings.downloadPath = downloaderSettings.downloadPath?.replace('%HOME%', await homeDir());
    }

    this.store.set(data);

    this.store.subscribe(async (data) => {
      await this.writeConfigFile(data);
    });
  }

  private async getConfigFile<T>(defaultData: T): Promise<T> {
    const configFilePath = await this.getConfigPath();
    let configFileContent: string | null = null;

    try {
      configFileContent = await readTextFile(configFilePath);
    } catch {
      await writeTextFile(configFilePath, JSON.stringify(defaultData, null, 4));
    }

    let data: T | undefined = defaultData;

    if (configFileContent) {
      try {
        data = JSON.parse(configFileContent);
      } catch { /* empty */ }
    }

    return data && defaultData
      ? this.mergeWithDefaults(defaultData, data)
      : (data || defaultData) as T;
  }

  private async writeConfigFile(data: Partial<T>) {
    const configFilePath = await this.getConfigPath();
    const currentData = await this.getConfigFile<T>(data as T);

    const newData: unknown = !Array.isArray(data) && currentData && typeof currentData === 'object' && !Array.isArray(currentData)
      ? Object.assign(currentData, data)
      : data;

    await writeTextFile(configFilePath, JSON.stringify(newData, null, 4));
  }

  private async getConfigPath() {
    if (this.configPath) return this.configPath;

    const dataDirectory = platform() === 'android' ? await dataDir() : await path.join(await dataDir(), config.identifier);

    if (!(await exists(dataDirectory))) {
      await mkdir(dataDirectory, { recursive: true });
    }

    this.configPath = await path.join(dataDirectory, this.path);
    return this.configPath;
  }

  private mergeWithDefaults<T>(defaults: T, data: T): T {
    if (Array.isArray(data)) return data;

    const merged = Object.assign({}, defaults);

    for (const key in data) {
      if (data[key] instanceof Object && defaults[key] instanceof Object && !Array.isArray(defaults[key])) {
        merged[key] = this.mergeWithDefaults(defaults[key], data[key]) as any;
      } else {
        merged[key] = data[key] as any;
      }
    }

    return merged;
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
    downloadPath: '%HOME%/Games/Spitfire Launcher',
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
  return $accountsStorage.activeAccountId ? $accountsStorage.accounts.find(account => account.accountId === $accountsStorage.activeAccountId) || null : null;
});

// @ts-expect-error - We need to access the store
const language = derived([settingsStorage.store], ([$settingsStorage]) => {
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