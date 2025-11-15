import { downloaderStorage } from '$lib/core/data-storage';
import NotificationManager from '$lib/core/managers/notification';
import { ownedApps } from '$lib/stores';
import Legendary, { type StreamEvent } from '$lib/core/legendary';
import { t } from '$lib/utils/util';
import type { queueItemSchema } from '$lib/validations/settings';
import type { ParsedApp } from '$types/legendary';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { toast } from 'svelte-sonner';
import { get } from 'svelte/store';
import type { z } from 'zod';

type DownloadType = 'install' | 'update' | 'repair';
type QueueItem = z.infer<typeof queueItemSchema>;
type DownloadCallbacks = Partial<{
  onProgress: (progress: Partial<DownloadProgress>) => void;
  onComplete: (success: boolean, code?: number) => void;
  onError: (error: string) => void;
}>;

export type DownloadProgress = {
  actualDownloadSize: number;
  currentDownloadSize: number;
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
    const downloaderSettings = get(downloaderStorage);
    const accountId = await Legendary.getAccount();
    const queue = accountId ? downloaderSettings.queue?.[accountId] : null;

    if (!downloaderSettings.queue || !accountId || !queue?.length) {
      return;
    }

    for (const item of queue) {
      if (item.status === 'downloading') {
        item.status = 'paused';
      }
    }

    this.queue = downloaderSettings.queue[accountId];
    await this.processQueue(true);
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
    return this.processQueue();
  }

  async removeFromQueue(appId: string) {
    if (this.downloadingAppId === appId) {
      await this.cancelDownload();
    }

    this.queue = this.queue.filter(({ item }) => item.id !== appId);
    await this.saveQueueToFile();
  }

  async moveQueueItem(appId: string, direction: 'up' | 'down') {
    const queueIndexes = this.queue
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item.status === 'queued')
      .map(({ index }) => index);

    const currentQueuePosition = queueIndexes.findIndex((i) => this.queue[i].item.id === appId);
    if (currentQueuePosition === -1) return;

    const newQueuePosition = direction === 'up'
      ? currentQueuePosition - 1
      : currentQueuePosition + 1;

    if (newQueuePosition < 0 || newQueuePosition >= queueIndexes.length) {
      return;
    }

    const currentIndex = queueIndexes[currentQueuePosition];
    const targetIndex = queueIndexes[newQueuePosition];

    [this.queue[currentIndex], this.queue[targetIndex]] = [this.queue[targetIndex], this.queue[currentIndex]];

    await this.saveQueueToFile();
  }

  isInQueue(appId: string): boolean {
    return this.queue.some(({ item, status }) => item.id === appId && ['queued', 'downloading', 'paused'].includes(status));
  }

  async processQueue(processPaused = false) {
    const pausedItem = this.queue.find(({ status }) => status === 'paused');

    let item: QueueItem | undefined;
    if (pausedItem) {
      item = processPaused ? pausedItem : undefined;
    } else {
      item = this.queue.find(({ status }) => status === 'queued');
    }

    if (!item || (this.downloadingAppId && item.status !== 'paused')) return;

    const app = item.item;
    const type: DownloadType = app.requiresRepair ? 'repair' : app.hasUpdate ? 'update' : 'install';

    this.downloadingAppId = app.id;

    if (item.status !== 'paused') {
      this.progress = {
        actualDownloadSize: 0,
        currentDownloadSize: 0,
        percent: 0,
        etaMs: 0,
        downloaded: 0,
        downloadSpeed: 0,
        diskWriteSpeed: 0
      };
    }

    item.startedAt = Date.now();
    await this.setItemStatus(item, 'downloading');

    try {
      await this.startInstallation(app, {
        onProgress: (progress: Partial<DownloadProgress>) => {
          this.progress = {
            ...this.progress,
            ...progress
          };
        },
        onComplete: async (success) => {
          const downloaderSettings = get(downloaderStorage);

          if (success) {
            app.installed = true;
            app.hasUpdate = false;
            app.requiresRepair = false;

            item.completedAt = Date.now();

            const notificationMessage = get(t)(
              type === 'repair' ? 'library.app.repaired' : type === 'update' ? 'library.app.updated' : 'library.app.installed',
              { name: app.title }
            );

            toast.success(notificationMessage);

            if (downloaderSettings.sendNotifications) {
              NotificationManager.sendNotification(notificationMessage).catch(console.error);
            }

            ownedApps.update((apps) => {
              const appIndex = apps.findIndex((x) => x.id === app.id);
              if (appIndex !== -1) {
                apps[appIndex] = app;
              } else {
                apps.push(app);
              }

              return apps;
            });

            await this.setItemStatus(item, 'completed');
          } else if (!this.activeDownload?.cancelled && !this.activeDownload?.paused) {
            await this.handleDownloadError(item, type);
          }

          if (!this.activeDownload?.paused) {
            this.cleanupActiveDownload();
          }
        },
        onError: async (error) => {
          await this.handleDownloadError(item, type, error);
          this.cleanupActiveDownload();
        }
      });
    } catch (error) {
      await this.handleDownloadError(item, type, error);
      this.cleanupActiveDownload();
    }
  }

  async cancelDownload() {
    if (!this.activeDownload) return;

    this.activeDownload.cancelled = true;

    // If it was paused, the stream is already stopped so we just clean up
    if (this.activeDownload.paused) {
      this.queue = this.queue.filter((q) => q.item.id !== this.downloadingAppId);
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
    await this.processQueue(true);
  }

  async clearCompleted() {
    this.queue = this.queue.filter(({ status }) => status !== 'completed' && status !== 'failed');
    await this.saveQueueToFile();
  }

  private async handleDownloadError(item: QueueItem, type: DownloadType, error?: unknown) {
    if (error) console.error(error);

    const app = item.item;
    const errorMessage = get(t)(
      type === 'repair' ? 'library.app.failedToRepair' : type === 'update' ? 'library.app.failedToUpdate' : 'library.app.failedToInstall',
      { name: app.title }
    );

    toast.error(errorMessage);

    item.completedAt = Date.now();
    await this.setItemStatus(item, 'failed');
  }

  private async startInstallation(app: ParsedApp, callbacks: DownloadCallbacks = {}) {
    const settings = get(downloaderStorage);
    const streamId = `install_${app.id}_${Date.now()}`;
    const args = [app.requiresRepair ? 'repair' : 'install', app.id, '-y', '--skip-sdl', '--skip-dlcs', '--base-path', settings.downloadPath!];

    if (settings.noHTTPS) {
      args.push('--no-https');
    }

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
      configPath: await Legendary.getConfigPath(),
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
    return downloaderStorage.update((settings) => {
      settings.queue = {
        ...settings.queue,
        [accountId]: $state.snapshot(this.queue)
      };

      return settings;
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
    const result: Partial<DownloadProgress> = {};

    let match = output.match(/Download size: ([\d.]+) MiB/);
    if (match) {
      result.currentDownloadSize = MiBtoBytes(match[1]);

      if (!this.progress.actualDownloadSize) {
        result.actualDownloadSize = result.currentDownloadSize;
      }

      return result;
    }

    match = output.match(/ETA: (\d{2}:\d{2}:\d{2})/);
    if (match) {
      const [h, m, s] = match[1].split(':').map(Number);
      result.etaMs = ((h * 3600) + (m * 60) + s) * 1000;
      return result;
    }

    match = output.match(/Downloaded: ([\d.]+) MiB/);
    if (match) {
      const downloaded = MiBtoBytes(match[1]);
      const totalDownloaded = downloaded + this.progress.actualDownloadSize! - this.progress.currentDownloadSize!;

      result.percent = totalDownloaded / this.progress.actualDownloadSize! * 100;
      result.downloaded = totalDownloaded;
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