import { z } from 'zod';

export const accountDataSchema = z.object({
  displayName: z.string(),
  accountId: z.string(),
  deviceId: z.string(),
  secret: z.string()
});

export const accountDataFileSchema = z.object({
  activeAccountId: z.string().optional(),
  accounts: z.array(accountDataSchema)
});