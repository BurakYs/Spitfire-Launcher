import { locales } from '$lib/paraglide/runtime';
import { z } from 'zod';

type SidebarItem = typeof sidebarItems[number];

export const appSettingsSchema = z.object({
  language: z.enum(locales).nullish(),
  gamePath: z.string(),
  launchArguments: z.string(),
  missionCheckInterval: z.number().positive(),
  claimRewardsDelay: z.number().positive(),
  startingPage: z.enum(['autoKick', 'itemShop', 'stwMissionAlerts', 'taxiService', 'dailyQuests', 'library'] satisfies SidebarItem[]),
  discordStatus: z.boolean(),
  hideToTray: z.boolean(),
  checkForUpdates: z.boolean()
}).partial();

export const deviceAuthsSettingsSchema = z.array(z.object({
  deviceId: z.string(),
  customName: z.string()
}));

export const sidebarItems = [
  'vbucksInformation',
  'friendsManagement',
  'redeemCodes',
  'epicGamesWebsite',
  'eula',

  'autoKick',
  'taxiService',
  'customStatus',
  'partyManagement',
  'serverStatus',
  'itemShop',
  'earnedXP',
  'dailyQuests',
  'stwMissionAlerts',
  'lookupPlayers',

  'library',
  'downloads',

  'exchangeCode',
  'accessToken',
  'deviceAuth'
] as const;

export const customizableMenuSettingsSchema = z.object(
  sidebarItems.reduce((acc, item) => {
    acc[item] = z.boolean().optional();
    return acc;
  }, {} as Record<SidebarItem, z.ZodOptional<z.ZodBoolean>>)
).partial();

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
  requiresRepair: z.boolean().optional(),
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
  noHTTPS: z.boolean(),
  autoUpdate: z.boolean(),
  sendNotifications: z.boolean(),
  favoriteApps: z.array(z.string()),
  hiddenApps: z.array(z.string()),
  perAppAutoUpdate: z.record(z.string(), z.boolean()),
  queue: z.record(z.string(), z.array(queueItemSchema))
}).partial();