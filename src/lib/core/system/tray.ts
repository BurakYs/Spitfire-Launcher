import { dev } from '$app/environment';
import DownloadManager from '$lib/core/managers/download.svelte';
import { Menu } from '@tauri-apps/api/menu/menu';
import { TrayIcon } from '@tauri-apps/api/tray';
import { defaultWindowIcon } from '@tauri-apps/api/app';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { type } from '@tauri-apps/plugin-os';

export default class SystemTray {
  private static trayIconId: string;

  static async setVisibility(visible: boolean) {
    const isMobile = type() === 'android' || type() === 'ios';
    // Old tray icons remain after HMR reloads, causing duplicates. So we disable tray icons in dev mode
    if (dev || isMobile) return;

    if (visible) {
      await SystemTray.addTrayIcon();
    } else {
      await SystemTray.removeTrayIcon();
    }
  }

  private static async addTrayIcon() {
    if (SystemTray.trayIconId) {
      const icon = await TrayIcon.getById(SystemTray.trayIconId);
      if (icon) {
        await icon.setVisible(true);
        return;
      }
    }

    const menu = await Menu.new({
      items: [
        {
          id: 'open',
          text: 'Open',
          action: async () => {
            await getCurrentWindow().show();
          }
        },
        {
          id: 'quit',
          text: 'Quit',
          action: async () => {
            await DownloadManager.pauseDownload();
            await getCurrentWindow().close();
          }
        }
      ]
    });

    const tray = await TrayIcon.new({
      icon: (await defaultWindowIcon())!,
      menu,
      action: async (event) => {
        if (event.type === 'Click' || event.type === 'DoubleClick') {
          await getCurrentWindow().show();
        }
      },
      showMenuOnLeftClick: false
    });

    SystemTray.trayIconId = tray.id;
  }

  private static async removeTrayIcon() {
    if (!SystemTray.trayIconId) return;

    const icon = await TrayIcon.getById(SystemTray.trayIconId);
    await icon?.setVisible(false);
  }
}