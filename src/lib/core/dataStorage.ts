import { dev } from '$app/environment';
import config from '$lib/config';
import SystemTray from '$lib/core/system/systemTray';
import { accountDataFileSchema } from '$lib/validations/accounts';
import {
  allSettingsSchema,
  automationSettingsSchema,
  deviceAuthsSettingsSchema,
  downloaderSettingsSchema,
  taxiSettingsSchema
} from '$lib/validations/settings';
import type { AccountDataFile } from '$types/accounts';
import type { AllSettings, AutomationSettings, DeviceAuthsSettings, DownloaderSettings, TaxiSettings } from '$types/settings';
import { path } from '@tauri-apps/api';
import { dataDir, homeDir } from '@tauri-apps/api/path';
import { exists, mkdir, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { platform } from '@tauri-apps/plugin-os';
import type { ZodSchema } from 'zod';

export const ACCOUNTS_FILE_PATH = dev ? 'accounts-dev.json' : 'accounts.json';
export const ACCOUNTS_INITIAL_DATA: AccountDataFile = {
  accounts: []
};

export const SETTINGS_FILE_PATH = dev ? 'settings-dev.json' : 'settings.json';
export const SETTINGS_INITIAL_DATA: AllSettings = {
  app: {
    language: null,
    claimRewardsDelay: 1.5,
    missionCheckInterval: 5,
    startingPage: 'stwMissionAlerts',
    startingAccount: 'lastUsed',
    hideToTray: false,
    checkForUpdates: true
  }
};

export const DEVICE_AUTHS_FILE_PATH = dev ? 'device-auths-dev.json' : 'device-auths.json';
export const DEVICE_AUTHS_INITIAL_DATA: DeviceAuthsSettings = [];

export const AUTOMATION_FILE_PATH = dev ? 'automation-dev.json' : 'automation.json';
export const AUTOMATION_INITIAL_DATA: AutomationSettings = [];

export const TAXI_FILE_PATH = dev ? 'taxi-dev.json' : 'taxi.json';
export const TAXI_INITIAL_DATA: TaxiSettings = [];

export const DOWNLOADER_FILE_PATH = dev ? 'downloader-dev.json' : 'downloader.json';
export const DOWNLOADER_INITIAL_DATA: DownloaderSettings = {
  downloadPath: '%HOME%/Games/Spitfire Launcher',
  autoUpdate: true,
  sendNotifications: true,
  favoriteApps: [],
  hiddenApps: [],
  perAppAutoUpdate: {}
};

export default class DataStorage {
  private static dataDirectory: string;
  private static caches: {
    accountsFile?: AccountDataFile;
    settingsFile?: AllSettings;
    deviceAuthsFile?: DeviceAuthsSettings;
    automationFile?: AutomationSettings;
    taxiFile?: TaxiSettings;
    downloaderFile?: DownloaderSettings;
  } = {};

  static async init() {
    const home = await homeDir();
    DOWNLOADER_INITIAL_DATA.downloadPath = DOWNLOADER_INITIAL_DATA.downloadPath!.replace('%HOME%', home.replaceAll('\\', '/'));
    await DataStorage.getDataDirectory();
  }

  static async getAccountsFile(bypassCache = false) {
    if (DataStorage.caches.accountsFile && !bypassCache) return DataStorage.caches.accountsFile;

    return DataStorage.getFile<AccountDataFile>(
      ACCOUNTS_FILE_PATH,
      ACCOUNTS_INITIAL_DATA,
      accountDataFileSchema,
      (data) => { DataStorage.caches.accountsFile = data; }
    );
  }

  static async getSettingsFile(bypassCache = false) {
    if (DataStorage.caches.settingsFile && !bypassCache) return DataStorage.caches.settingsFile;

    const data = await DataStorage.getFile<AllSettings>(
      SETTINGS_FILE_PATH,
      SETTINGS_INITIAL_DATA,
      allSettingsSchema,
      (data) => { DataStorage.caches.settingsFile = data; }
    );

    if (data.app?.hideToTray) {
      await SystemTray.setVisibility(true);
    }

    return data;
  }

  static async getDeviceAuthsFile(bypassCache = false) {
    if (DataStorage.caches.deviceAuthsFile && !bypassCache) return DataStorage.caches.deviceAuthsFile;

    return DataStorage.getFile<DeviceAuthsSettings>(
      DEVICE_AUTHS_FILE_PATH,
      DEVICE_AUTHS_INITIAL_DATA,
      deviceAuthsSettingsSchema,
      (data) => { DataStorage.caches.deviceAuthsFile = data; }
    );
  }

  static async getAutomationFile(bypassCache = false) {
    if (DataStorage.caches.automationFile && !bypassCache) return DataStorage.caches.automationFile;

    return DataStorage.getFile<AutomationSettings>(
      AUTOMATION_FILE_PATH,
      AUTOMATION_INITIAL_DATA,
      automationSettingsSchema,
      (data) => { DataStorage.caches.automationFile = data; }
    );
  }

  static async getTaxiFile(bypassCache = false) {
    if (DataStorage.caches.taxiFile && !bypassCache) return DataStorage.caches.taxiFile;

    return DataStorage.getFile<TaxiSettings>(
      TAXI_FILE_PATH,
      TAXI_INITIAL_DATA,
      taxiSettingsSchema,
      (data) => { DataStorage.caches.taxiFile = data; }
    );
  }

  static async getDownloaderFile(bypassCache = false) {
    if (DataStorage.caches.downloaderFile && !bypassCache) return DataStorage.caches.downloaderFile;

    const data = await DataStorage.getFile<DownloaderSettings>(
      DOWNLOADER_FILE_PATH,
      DOWNLOADER_INITIAL_DATA,
      downloaderSettingsSchema,
      (data) => { DataStorage.caches.downloaderFile = data; }
    );

    const home = await homeDir();
    data.downloadPath = data.downloadPath?.replace('%HOME%', home);
    return data;
  }

  private static async getFile<T>(
    filePath: string,
    initialData: T,
    schema?: ZodSchema,
    setCacheCallback?: (data: T) => void
  ): Promise<T> {
    const file = await DataStorage.getConfigFile<T>(filePath, initialData);

    if (schema) {
      const parseResult = schema.safeParse(file);
      if (parseResult.success && setCacheCallback) {
        setCacheCallback(parseResult.data);
      }

      return parseResult.success ? parseResult.data : initialData;
    }

    return file;
  }

  static async writeConfigFile<T = any>(pathString: string, data: Partial<T>) {
    const configFilePath = await path.join(await DataStorage.getDataDirectory(), pathString);
    const currentData = await DataStorage.getConfigFile(pathString);

    const newData: unknown = !Array.isArray(data) && currentData && typeof currentData === 'object' && !Array.isArray(currentData) ? Object.assign(currentData, data) : data;

    switch (pathString) {
      case ACCOUNTS_FILE_PATH:
        DataStorage.caches.accountsFile = newData as AccountDataFile;
        break;
      case SETTINGS_FILE_PATH:
        DataStorage.caches.settingsFile = newData as AllSettings;
        break;
      case AUTOMATION_FILE_PATH:
        DataStorage.caches.automationFile = newData as AutomationSettings;
        break;
      case TAXI_FILE_PATH:
        DataStorage.caches.taxiFile = newData as TaxiSettings;
        break;
      case DEVICE_AUTHS_FILE_PATH:
        DataStorage.caches.deviceAuthsFile = newData as DeviceAuthsSettings;
        break;
      case DOWNLOADER_FILE_PATH:
        DataStorage.caches.downloaderFile = newData as DownloaderSettings;
        break;
    }

    await writeTextFile(configFilePath, JSON.stringify(newData, null, 4));
  }

  private static async getDataDirectory() {
    if (DataStorage.dataDirectory) return DataStorage.dataDirectory;

    const dataDirectory = platform() === 'android' ? await dataDir() : await path.join(await dataDir(), config.identifier);

    if (!(await exists(dataDirectory))) {
      await mkdir(dataDirectory, { recursive: true });
    }

    DataStorage.dataDirectory = dataDirectory;
    return dataDirectory;
  }

  private static async getConfigFile<T>(pathString: string, initialValue?: T): Promise<T> {
    const configFilePath = await path.join(await DataStorage.getDataDirectory(), pathString);
    let configFileContent: string | null = null;

    try {
      configFileContent = await readTextFile(configFilePath);
    } catch {
      if (initialValue) await writeTextFile(configFilePath, JSON.stringify(initialValue, null, 4));
    }

    let data: T | undefined = initialValue;

    if (configFileContent) {
      try {
        data = JSON.parse(configFileContent);
      } catch {}
    }

    return data && initialValue
      ? DataStorage.mergeWithDefaults(initialValue, data)
      : (data || initialValue) as T;
  }

  private static mergeWithDefaults<T>(defaults: T, data: T): T {
    if (Array.isArray(data)) return data;

    const merged = Object.assign({}, defaults);

    for (const key in data) {
      if (data[key] instanceof Object && defaults[key] instanceof Object && !Array.isArray(defaults[key])) {
        merged[key] = DataStorage.mergeWithDefaults(defaults[key], data[key]) as any;
      } else {
        merged[key] = data[key] as any;
      }
    }

    return merged;
  }
}