import { z } from 'zod'
import { registerSchema } from './auth'

export const referralCodeSchema = z
  .string()
  .trim()
  .min(3)
  .max(64)
  .regex(/^[a-zA-Z0-9_]+$/, 'referral code must be alphanumeric or underscore')

export const ownedCeoIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
})

/** Registration payload with optional referral code (wiring lands in Phase 6B.2). */
export const registerWithReferralSchema = registerSchema.extend({
  ref: referralCodeSchema.optional(),
})

export type OwnedCeoIdParam = z.infer<typeof ownedCeoIdParamSchema>
export type RegisterWithReferralInput = z.infer<typeof registerWithReferralSchema>
