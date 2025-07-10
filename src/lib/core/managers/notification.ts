import config from '$lib/config';
import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification';
import { toast } from 'svelte-sonner';

export default class NotificationManager {
  static async requestPermission() {
    if (await isPermissionGranted()) return true;

    const permission = await requestPermission();
    return permission === 'granted';
  }

  static async sendNotification(message: string, title?: string, sendToast?: boolean) {
    if (sendToast) toast.info(message);

    const permissionGranted = await this.requestPermission();
    if (!permissionGranted) return false;

    sendNotification({ title: title || config.name, body: message });

    return true;
  }
}