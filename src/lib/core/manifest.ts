import { readDir, readTextFile } from '@tauri-apps/plugin-fs';
import * as path from '@tauri-apps/api/path';
import { platform } from '@tauri-apps/plugin-os';

type ManifestData = {
  appVersionString: string;
  launchCommand: string;
  userAgent?: string;
  installLocation: string;
  launchExecutable: string;
  executableLocation: string;
}

const appCatalogIds = {
  fortnite: '4fe75bbc5a674f4f9b356b5c90567da5',
  rocketLeague: '530145df28a24424923f5828cc9031a1',
  fallGuys: '38ec4849ea4f4de6aa7b6fb0f2d278e1',
  unrealEditorForFortnite: '1e8bda5cfbb641b9a9aea8bd62285f73'
} as const;

type AppName = keyof typeof appCatalogIds;

export default class Manifest {
  private static fileCaches = new Map<AppName, ManifestData>();

  static async getFortniteUserAgent() {
    const gameData = await Manifest.getAppData('fortnite');
    return gameData?.userAgent || 'Fortnite/++Fortnite+Release-35.00-CL-41994699-Windows';
  }

  static async getAppData(name: AppName) {
    if (platform() !== 'windows') return null;
    if (Manifest.fileCaches.has(name)) return Manifest.fileCaches.get(name)!;

    try {
      const manifestsDirectory = 'C:\\ProgramData\\Epic\\EpicGamesLauncher\\Data\\Manifests';
      const manifestFiles = await readDir(manifestsDirectory);

      let parsedManifest: ManifestData | null = null;

      for (const dirEntry of manifestFiles) {
        if (dirEntry.name.endsWith('.item')) {
          const fileContent = await readTextFile(await path.join(manifestsDirectory, dirEntry.name));
          const file = JSON.parse(fileContent) as {
            AppVersionString: string;
            LaunchCommand: string;
            DisplayName: string;
            InstallLocation: string;
            LaunchExecutable: string;
            CatalogItemId: string;
          };

          const appVersionString = file.AppVersionString?.trim();

          if (file.CatalogItemId === appCatalogIds[name]) {
            parsedManifest = {
              appVersionString: appVersionString ?? '',
              launchCommand: file.LaunchCommand?.trim() ?? '',
              userAgent: name === 'fortnite' && appVersionString ? `Fortnite/${appVersionString}` : '',
              installLocation: file.InstallLocation,
              launchExecutable: file.LaunchExecutable,
              executableLocation: file.InstallLocation + '\\' + file.LaunchExecutable
            };

            break;
          }
        }
      }

      if (parsedManifest) Manifest.fileCaches.set(name, parsedManifest);
      return parsedManifest;
    } catch (error) {
      console.error(error);
      return null;
    }
  }
}
