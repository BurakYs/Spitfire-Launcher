import { locales } from '$lib/paraglide/runtime';
import type { ParsedApp } from '$types/legendary';
import { z } from 'zod/v4';

export const appSettingsSchema = z.object({
  language: z.enum(locales).nullish(),
  gamePath: z.string(),
  missionCheckInterval: z.number().positive(),
  claimRewardsDelay: z.number().positive(),
  startingPage: z.enum(['autoKick', 'itemShop', 'stwWorldInfo', 'stwMissionAlerts', 'taxiService', 'dailyQuests', 'library']),
  startingAccount: z.enum(['firstInTheList', 'lastUsed']),
  hideToTray: z.boolean(),
  checkForUpdates: z.boolean()
}).partial();

export const deviceAuthsSettingsSchema = z.array(z.object({
  deviceId: z.string(),
  customName: z.string()
}));

export const customizableMenuSettingsSchema = z.object({
  library: z.boolean().default(true),
  downloads: z.boolean().default(true),

  vbucksInformation: z.boolean().default(true),
  friendManagement: z.boolean().default(true),
  redeemCodes: z.boolean().default(true),
  epicGamesSettings: z.boolean().default(true),
  eula: z.boolean().default(true),

  autoKick: z.boolean().default(true),
  taxiService: z.boolean().default(true),
  customStatus: z.boolean().default(true),
  partyManagement: z.boolean().default(true),
  serverStatus: z.boolean().default(true),
  itemShop: z.boolean().default(true),
  earnedXp: z.boolean().default(true),
  dailyQuests: z.boolean().default(true),
  stwMissionAlerts: z.boolean().default(true),
  lookupPlayers: z.boolean().default(true),

  exchangeCode: z.boolean().default(true),
  accessToken: z.boolean().default(true),
  deviceAuth: z.boolean().default(true)
}).partial();

export const allSettingsSchema = z.object({
  app: appSettingsSchema,
  customizableMenu: customizableMenuSettingsSchema
}).partial();

export const automationSettingSchema = z.object({
  accountId: z.string(),
  autoKick: z.boolean().optional(),
  autoClaim: z.boolean().optional(),
  autoTransferMaterials: z.boolean().optional(),
  autoInvite: z.boolean().optional()
});

export const automationSettingsSchema = z.array(automationSettingSchema);

export const taxiSettingSchema = z.object({
  accountId: z.string(),
  availableStatus: z.string().optional(),
  busyStatus: z.string().optional()
});

export const taxiSettingsSchema = z.array(taxiSettingSchema);

export const parsedAppSchema = z.object({
  id: z.string(),
  title: z.string(),
  images: z.object({
    tall: z.string(),
    wide: z.string()
  }),
  hasUpdate: z.boolean().optional(),
  downloadSize: z.number().optional(),
  installSize: z.number(),
  installed: z.boolean().optional(),
  canRunOffline: z.boolean()
});

export const queueItemSchema = z.object({
  status: z.enum(['queued', 'downloading', 'completed', 'failed', 'paused']),
  item: parsedAppSchema,
  addedAt: z.number(),
  startedAt: z.number().optional(),
  completedAt: z.number().optional()
});

export const downloaderSettingsSchema = z.object({
  downloadPath: z.string(),
  autoUpdate: z.boolean(),
  sendNotifications: z.boolean(),
  favoriteApps: z.array(z.string()),
  hiddenApps: z.array(z.string()),
  perAppAutoUpdate: z.record(z.string(), z.boolean()),
  queue: z.record(z.string(), z.array(queueItemSchema))
}).partial();