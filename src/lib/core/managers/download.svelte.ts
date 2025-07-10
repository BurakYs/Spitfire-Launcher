import DataStorage from '$lib/core/dataStorage';
import NotificationManager from '$lib/core/managers/notification';
import LegendaryError from '$lib/exceptions/LegendaryError';
import { ownedApps } from '$lib/stores';
import type { StreamEvent } from '$lib/utils/legendary';
import type { ParsedApp } from '$types/legendary';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { toast } from 'svelte-sonner';

type DownloadCallbacks = Partial<{
  onProgress: (progress: Partial<DownloadProgress>) => void;
  onComplete: (success: boolean, code?: number) => void;
  onError: (error: string) => void;
}>;

export type DownloadProgress = {
  installSize: number;
  downloadSize: number;
  percent: number;
  etaMs: number;
  downloaded: number;
  downloadSpeed: number;
  diskWriteSpeed: number;
};

class DownloadManager {
  downloadingAppId = $state<string | null>(null);
  progress = $state<Partial<DownloadProgress>>({});
  queue = $state<ParsedApp[]>([]);

  private activeDownload: {
    streamId: string;
    unlisten: UnlistenFn;
    callbacks: DownloadCallbacks;
    cancelled?: boolean;
  } | null = null;

  async addToQueue(app: ParsedApp) {
    if (this.queue.some(item => item.id === app.id)) {
      throw new Error('App is already in the download queue');
    }

    this.queue.push(app);
    await this.processQueue();
  }

  async removeFromQueue(appId: string) {
    if (this.downloadingAppId === appId) {
      await this.cancelDownload();
    }

    this.queue = this.queue.filter(item => item.id !== appId);
  }

  isInQueue(appId: string): boolean {
    return this.queue.some(item => item.id === appId);
  }

  async processQueue() {
    if (this.downloadingAppId || !this.queue.length) return;

    const [item] = this.queue;

    this.downloadingAppId = item.id;
    this.progress = {};

    try {
      await this.installOrUpdate(item.id, {
        onProgress: (progress: Partial<DownloadProgress>) => {
          this.progress = {
            ...this.progress,
            ...progress
          };
        },
        onComplete: async (success) => {
          const downloaderSettings = await DataStorage.getDownloaderFile();
          const type = item.hasUpdate ? 'update' : 'install';

          if (success) {
            item.installed = true;
            item.hasUpdate = false;

            const notificationMessage = type === 'update' ? `Successfully updated ${item.title}` : `Successfully installed ${item.title}`;
            toast.success(notificationMessage);

            if (downloaderSettings.sendNotifications) {
              NotificationManager.sendNotification(notificationMessage).catch(console.error);
            }

            ownedApps.update((apps) => {
              const appIndex = apps.findIndex(app => app.id === item.id);
              if (appIndex !== -1) {
                apps[appIndex] = item;
              } else {
                apps.push(item);
              }

              return apps;
            });
          } else {
            if (!this.activeDownload?.cancelled) {
              const errorMessage = type === 'update' ? `Failed to update ${item.title}` : `Failed to install ${item.title}`;
              toast.error(errorMessage);

              if (downloaderSettings.sendNotifications) {
                NotificationManager.sendNotification(errorMessage).catch(console.error);
              }
            }
          }

          this.afterInstallCleanup(item.id);
        },
        onError: (error) => {
          const type = item.hasUpdate ? 'update' : 'install';
          toast.error(type === 'update' ? `An error occurred while updating ${item.title}` : `An error occurred while installing ${item.title}`);
          this.afterInstallCleanup(item.id);
        }
      });
    } catch (error) {
      throw new LegendaryError('TODO');
    }
  }

  async installOrUpdate(appId: string, callbacks: DownloadCallbacks = {}) {
    const settings = await DataStorage.getDownloaderFile();
    const streamId = `install_${appId}_${Date.now()}`;
    const args = ['install', appId, '-y', '--skip-sdl', '--skip-dlcs', '--base-path', settings.downloadPath!];

    const unlisten = await listen<StreamEvent>(`legendary_stream:${streamId}`, (event) => {
      const streamEvent = event.payload;
      this.handleStreamEvent(streamEvent, callbacks);
    });

    await invoke('start_legendary_stream', {
      args,
      streamId
    });

    this.activeDownload = {
      streamId,
      unlisten,
      callbacks
    };

    return streamId;
  }

  async cancelDownload() {
    if (!this.activeDownload) return;

    try {
      this.activeDownload.cancelled = true;
      await invoke<boolean>('stop_legendary_stream', {
        streamId: this.activeDownload.streamId,
        forceKillAll: true
      });
    } catch (error) {
      console.error(error);
      throw new LegendaryError(`Failed to cancel download: ${error}`);
    }
  }

  private afterInstallCleanup(appId: string) {
    this.activeDownload?.unlisten();
    this.activeDownload = null;

    this.downloadingAppId = null;
    this.progress = {};
    this.queue = this.queue.filter(item => item.id !== appId);

    this.processQueue().catch(console.error);
  }

  private handleStreamEvent(event: StreamEvent, callbacks: DownloadCallbacks) {
    switch (event.event_type) {
      case 'stdout':
      case 'stderr': {
        const result = this.parseDownloadOutput(event.data);
        if (Object.keys(result).length) {
          callbacks.onProgress?.(result);
        }

        break;
      }

      case 'terminated': {
        callbacks.onComplete?.(event.code === 0, event.code);
        break;
      }

      case 'error': {
        callbacks.onError?.(event.data);
        break;
      }
    }
  }

  private parseDownloadOutput(output: string) {
    const MiBtoBytes = (mib: number) => mib * 1024 * 1024;
    const timeToMs = (timeStr: string) => {
      const [h, m, s] = timeStr.split(':').map(Number);
      return ((h * 3600) + (m * 60) + s) * 1000;
    };

    const result: Partial<DownloadProgress> = {};

    let match = output.match(/Install size: ([\d.]+) MiB/);
    if (match) {
      result.installSize = MiBtoBytes(parseFloat(match[1]));
      return result;
    }

    match = output.match(/Download size: ([\d.]+) MiB/);
    if (match) {
      result.downloadSize = MiBtoBytes(parseFloat(match[1]));
      return result;
    }

    match = output.match(/Progress: ([\d.]+)% .* ETA: (\d{2}:\d{2}:\d{2})/);
    if (match) {
      result.percent = parseFloat(match[1]);
      result.etaMs = timeToMs(match[2]);
      return result;
    }

    match = output.match(/Downloaded: ([\d.]+) MiB/);
    if (match) {
      result.downloaded = MiBtoBytes(parseFloat(match[1]));
      return result;
    }

    match = output.match(/Download\s+- ([\d.]+) MiB\/s \(raw\)/);
    if (match) {
      result.downloadSpeed = MiBtoBytes(parseFloat(match[1]));
      return result;
    }

    match = output.match(/Disk\s+- ([\d.]+) MiB\/s \(write\)/);
    if (match) {
      result.diskWriteSpeed = MiBtoBytes(parseFloat(match[1]));
      return result;
    }

    return {};
  }
}

export default new DownloadManager();