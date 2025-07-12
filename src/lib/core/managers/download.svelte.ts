import DataStorage, { DOWNLOADER_FILE_PATH } from '$lib/core/dataStorage';
import NotificationManager from '$lib/core/managers/notification';
import { ownedApps } from '$lib/stores';
import Legendary, { type StreamEvent } from '$lib/utils/legendary';
import type { queueItemSchema } from '$lib/validations/settings';
import type { ParsedApp } from '$types/legendary';
import type { DownloaderSettings } from '$types/settings';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { toast } from 'svelte-sonner';
import type { z } from 'zod/v4';

type QueueItem = z.infer<typeof queueItemSchema>;
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
  queue = $state<QueueItem[]>([]);

  private activeDownload: {
    streamId: string;
    unlisten: UnlistenFn;
    callbacks: DownloadCallbacks;
    cancelled?: boolean;
    paused?: boolean;
  } | null = null;

  async init() {
    const [downloaderSettings, accountId] = await Promise.all([
      DataStorage.getDownloaderFile(),
      Legendary.getAccount()
    ]);

    if (!downloaderSettings.queue || !Object.keys(downloaderSettings.queue).length || !accountId) {
      return;
    }

    this.queue = downloaderSettings.queue[accountId];
    await this.processQueue();
  }

  async addToQueue(app: ParsedApp) {
    const existingItem = this.queue.find(({ item }) => item.id === app.id);

    if (existingItem && ['queued', 'downloading', 'paused'].includes(existingItem.status)) {
      throw new Error('App is already in the download queue');
    }

    this.queue = [
      // To remove queue items with completed or failed status
      ...this.queue.filter(({ item }) => item.id !== app.id),
      {
        status: 'queued',
        item: app,
        addedAt: Date.now()
      }
    ];

    await this.saveQueueToFile();
    await this.processQueue();
  }

  async removeFromQueue(appId: string) {
    if (this.downloadingAppId === appId) {
      await this.cancelDownload();
    }

    this.queue = this.queue.filter(({ item }) => item.id !== appId);
    await this.saveQueueToFile();
  }

  isInQueue(appId: string): boolean {
    return this.queue.some(({ item, status }) => item.id === appId && ['queued', 'downloading', 'paused'].includes(status));
  }

  async processQueue() {
    const item = this.queue.find(({ status }) => status === 'paused') || this.queue.find(({ status }) => status === 'queued');
    if (!item || (this.downloadingAppId && item.status !== 'paused')) return;

    const app = item.item;
    this.downloadingAppId = app.id;
    this.progress = {
      installSize: 0,
      downloadSize: 0,
      percent: 0,
      etaMs: 0,
      downloaded: 0,
      downloadSpeed: 0,
      diskWriteSpeed: 0
    };

    item.startedAt = Date.now();
    await this.setItemStatus(item, 'downloading');

    try {
      await this.installOrUpdate(app.id, {
        onProgress: (progress: Partial<DownloadProgress>) => {
          this.progress = {
            ...this.progress,
            ...progress
          };
        },
        onComplete: async (success) => {
          const downloaderSettings = await DataStorage.getDownloaderFile();
          const type = app.hasUpdate ? 'update' : 'install';

          if (success) {
            app.installed = true;
            app.hasUpdate = false;
            item.completedAt = Date.now();

            const notificationMessage = type === 'update' ? `Successfully updated ${app.title}` : `Successfully installed ${app.title}`;
            toast.success(notificationMessage);

            if (downloaderSettings.sendNotifications) {
              NotificationManager.sendNotification(notificationMessage).catch(console.error);
            }

            ownedApps.update((apps) => {
              const appIndex = apps.findIndex(x => x.id === app.id);
              if (appIndex !== -1) {
                apps[appIndex] = app;
              } else {
                apps.push(app);
              }

              return apps;
            });

            await this.setItemStatus(item, 'completed');
          } else if (!this.activeDownload?.cancelled && !this.activeDownload?.paused) {
            await this.handleDownloadError(item);
          }

          if (!this.activeDownload?.paused) {
            this.cleanupActiveDownload();
          }
        },
        onError: async (error) => {
          await this.handleDownloadError(item, error);
          this.cleanupActiveDownload();
        }
      });
    } catch (error) {
      await this.handleDownloadError(item, error);
      this.cleanupActiveDownload();
    }
  }

  async cancelDownload() {
    if (!this.activeDownload) return;

    this.activeDownload.cancelled = true;

    // If it was paused, the stream is already stopped so we just clean up
    if (this.activeDownload.paused) {
      this.queue = this.queue.filter(q => q.item.id !== this.downloadingAppId);
      this.cleanupActiveDownload();
    } else {
      await invoke<boolean>('stop_legendary_stream', {
        streamId: this.activeDownload.streamId,
        forceKillAll: true
      });
    }
  }

  async pauseDownload() {
    const activeDownload = this.activeDownload;
    if (!activeDownload || activeDownload.paused) return;

    activeDownload.paused = true;

    await invoke<boolean>('stop_legendary_stream', {
      streamId: activeDownload.streamId,
      forceKillAll: true
    });

    activeDownload.unlisten();
    activeDownload.streamId = '';

    const item = this.queue.find(({ item }) => item.id === this.downloadingAppId);
    if (item) {
      await this.setItemStatus(item, 'paused');
    }
  }

  async resumeDownload() {
    await this.processQueue();
  }

  async clearCompleted() {
    this.queue = this.queue.filter(({ status }) => status !== 'completed' && status !== 'failed');
    await this.saveQueueToFile();
  }

  private async handleDownloadError(item: QueueItem, error?: unknown) {
    if (error) console.error(error);

    const app = item.item;
    const type = app.hasUpdate ? 'update' : 'install';
    const errorMessage = type === 'update' ? `An error occurred while updating ${app.title}` : `An error occurred while installing ${app.title}`;
    toast.error(errorMessage);

    await this.setItemStatus(item, 'failed');
  }

  private async installOrUpdate(appId: string, callbacks: DownloadCallbacks = {}) {
    const settings = await DataStorage.getDownloaderFile();
    const streamId = `install_${appId}_${Date.now()}`;
    const args = ['install', appId, '-y', '--skip-sdl', '--skip-dlcs', '--base-path', settings.downloadPath!];

    const unlisten = await listen<StreamEvent>(`legendary_stream:${streamId}`, (event) => {
      const payload = event.payload;

      switch (payload.event_type) {
        case 'stdout':
        case 'stderr': {
          const result = this.parseDownloadOutput(payload.data);
          if (Object.keys(result).length) {
            callbacks.onProgress?.(result);
          }
          break;
        }

        case 'terminated': {
          callbacks.onComplete?.(payload.code === 0, payload.code);
          break;
        }

        case 'error': {
          callbacks.onError?.(payload.data);
          break;
        }
      }
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

  private setItemStatus(item: QueueItem, status: QueueItem['status']) {
    item.status = status;
    this.queue = [...this.queue];

    return this.saveQueueToFile();
  }

  private async saveQueueToFile() {
    const accountId = (await Legendary.getAccount())!;
    return DataStorage.writeConfigFile<DownloaderSettings>(DOWNLOADER_FILE_PATH, {
      queue: { [accountId]: $state.snapshot(this.queue) }
    });
  }

  private cleanupActiveDownload() {
    if (!this.activeDownload?.paused) {
      this.activeDownload?.unlisten();
    }

    this.activeDownload = null;
    this.downloadingAppId = null;
    this.progress = {};

    this.processQueue().catch(console.error);
  }

  private parseDownloadOutput(output: string) {
    const MiBtoBytes = (mib: string) => Number.parseFloat(mib) * 1024 * 1024;
    const timeToMs = (time: string) => {
      const [h, m, s] = time.split(':').map(Number);
      return ((h * 3600) + (m * 60) + s) * 1000;
    };

    const result: Partial<DownloadProgress> = {};

    let match = output.match(/Install size: ([\d.]+) MiB/);
    if (match) {
      result.installSize = MiBtoBytes(match[1]);
      return result;
    }

    match = output.match(/Download size: ([\d.]+) MiB/);
    if (match) {
      result.downloadSize = MiBtoBytes(match[1]);
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
      result.downloaded = MiBtoBytes(match[1]);
      return result;
    }

    match = output.match(/Download\s+- ([\d.]+) MiB\/s \(raw\)/);
    if (match) {
      result.downloadSpeed = MiBtoBytes(match[1]);
      return result;
    }

    match = output.match(/Disk\s+- ([\d.]+) MiB\/s \(write\)/);
    if (match) {
      result.diskWriteSpeed = MiBtoBytes(match[1]);
      return result;
    }

    return {};
  }
}

export default new DownloadManager();