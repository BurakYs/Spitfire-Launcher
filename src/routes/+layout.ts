import { language, settingsStorage } from '$lib/core/data-storage';
import { changeLocale } from '$lib/utils/util';
import { baseLocale, locales } from '$lib/paraglide/runtime';
import { invoke } from '@tauri-apps/api/core';
import { get } from 'svelte/store';

export const prerender = true;
export const ssr = false;

export async function load() {
  const settings = get(settingsStorage);

  const systemLocale = await invoke<string>('get_locale');
  let locale = settings.app?.language || systemLocale || baseLocale;

  if (!locales.includes(locale as any)) {
    locale = baseLocale;
  }

  if (get(language) !== locale) {
    changeLocale(locale as typeof locales[number]);
  }
}