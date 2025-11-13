import { readDir, readTextFile } from '@tauri-apps/plugin-fs';
import * as path from '@tauri-apps/api/path';
import { platform } from '@tauri-apps/plugin-os';

type ManifestData = {
  appVersionString: string;
  namespace: string;
  launchCommand: string;
  userAgent?: string;
  installLocation: string;
  launchExecutable: string;
  executableLocation: string;
};

export default class Manifest {
  private static fortniteManifestCache: ManifestData | null = null;

  static async getFortniteUserAgent() {
    const gameData = await Manifest.getFortniteManifest().catch(() => null);
    return gameData?.userAgent || 'Fortnite/++Fortnite+Release-38.10-CL-47888945-Windows';
  }

  static async getFortniteManifest() {
    if (platform() !== 'windows') return null;
    if (Manifest.fortniteManifestCache) return Manifest.fortniteManifestCache;

    const manifestsDirectory = 'C:/ProgramData/Epic/EpicGamesLauncher/Data/Manifests';
    const manifestFiles = await readDir(manifestsDirectory);

    let parsedManifest: ManifestData | null = null;

    for (const dirEntry of manifestFiles) {
      if (dirEntry.name.endsWith('.item')) {
        const fileContent = await readTextFile(await path.join(manifestsDirectory, dirEntry.name));
        const file = JSON.parse(fileContent) as {
          AppVersionString: string;
          CatalogNamespace: string;
          LaunchCommand: string;
          DisplayName: string;
          InstallLocation: string;
          LaunchExecutable: string;
          CatalogItemId: string;
        };

        if (file.DisplayName.toLowerCase() === 'fortnite') {
          const appVersionString = file.AppVersionString?.trim();

          parsedManifest = {
            appVersionString: appVersionString ?? '',
            namespace: file.CatalogNamespace,
            launchCommand: file.LaunchCommand?.trim() ?? '',
            userAgent: appVersionString ? `Fortnite/${appVersionString}` : '',
            installLocation: file.InstallLocation,
            launchExecutable: file.LaunchExecutable,
            executableLocation: file.LaunchExecutable
          };

          break;
        }
      }
    }

    Manifest.fortniteManifestCache = parsedManifest;
    return parsedManifest;
  }
}
