import { z } from 'zod'

export const ceoQuerySchema = z.object({
  isActive: z.coerce.boolean().optional(),
  rarity: z.string().optional(),
  search: z.string().optional(),
})

export const ceoCreateSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  rarity: z.string().min(1).max(50),
  priceUsd: z.string().regex(/^\d+(\.\d{1,2})?$/),
  dailyRatePercent: z.string().regex(/^\d+(\.\d{1,4})?$/),
  cycleHours: z.coerce.number().int().min(1).max(24).default(4),
  energyCost: z.coerce.number().int().min(0).max(1000),
  isActive: z.coerce.boolean().default(true),
})

export const ceoUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  rarity: z.string().min(1).max(50).optional(),
  priceUsd: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  dailyRatePercent: z.string().regex(/^\d+(\.\d{1,4})?$/).optional(),
  cycleHours: z.coerce.number().int().min(1).max(24).optional(),
  energyCost: z.coerce.number().int().min(0).max(1000).optional(),
  isActive: z.coerce.boolean().optional(),
})

export type CEOCreateInput = z.infer<typeof ceoCreateSchema>
export type CEOUpdateInput = z.infer<typeof ceoUpdateSchema>
