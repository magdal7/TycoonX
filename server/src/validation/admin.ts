import { z } from 'zod'

export const adminUserIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
})

export const adminUserSearchSchema = z.object({
  q: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
})

/** Sensitive: suspending/reactivating an account requires an explicit confirm flag. */
export const userSuspensionSchema = z.object({
  suspend: z.boolean(),
  reason: z.string().trim().max(300).optional(),
  confirm: z.boolean(),
})

/**
 * Catalog presentation/visibility edits only. `.strict()` rejects any attempt to
 * send production/economy fields (price, rates, caps, cycle hours).
 */
export const catalogUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    rarity: z.string().trim().min(1).max(50).optional(),
    category: z.string().trim().max(50).nullish(),
    displayOrder: z.coerce.number().int().min(0).max(100000).optional(),
    imageUrl: z.string().trim().url().max(500).nullish(),
    isActive: z.boolean().optional(),
    isForSale: z.boolean().optional(),
  })
  .strict()

/** Creating a tier is an economy decision; it is created hidden and inactive. */
export const catalogCreateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  slug: z.string().trim().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  rarity: z.string().trim().min(1).max(50),
  priceUsd: z.string().regex(/^\d+(\.\d{1,2})?$/),
  dailyRatePercent: z.string().regex(/^\d+(\.\d{1,4})?$/),
  cycleHours: z.coerce.number().int().min(1).max(24).default(4),
  energyCost: z.coerce.number().int().min(0).max(1000),
  category: z.string().trim().max(50).nullish(),
  displayOrder: z.coerce.number().int().min(0).max(100000).default(0),
  imageUrl: z.string().trim().url().max(500).nullish(),
  confirmNewTier: z.boolean(),
})

export const confirmSchema = z.object({ confirm: z.boolean() })

export const settingsUpdateSchema = z.object({
  registrationEnabled: z.boolean().optional(),
  maintenance: z
    .object({ enabled: z.boolean().optional(), message: z.string().trim().max(500).optional() })
    .optional(),
  announcement: z
    .object({
      enabled: z.boolean().optional(),
      message: z.string().trim().max(500).optional(),
      level: z.enum(['info', 'warning', 'critical']).optional(),
    })
    .optional(),
  features: z
    .object({
      market: z.boolean().optional(),
      collection: z.boolean().optional(),
      tasks: z.boolean().optional(),
      achievements: z.boolean().optional(),
      leaderboard: z.boolean().optional(),
      wallet: z.boolean().optional(),
      specialTasks: z.boolean().optional(),
    })
    .optional(),
  confirm: z.boolean(),
})

export type CatalogUpdateBody = z.infer<typeof catalogUpdateSchema>
export type CatalogCreateBody = z.infer<typeof catalogCreateSchema>
