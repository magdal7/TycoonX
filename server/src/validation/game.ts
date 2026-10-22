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

/**
 * Registration payload with an optional referral code and mandatory policy
 * acceptance. The client sends a single checkbox state; the server records the
 * authoritative policy versions from `lib/policies` (never client-supplied).
 */
export const registerWithReferralSchema = registerSchema.extend({
  ref: referralCodeSchema.optional(),
  acceptTerms: z.literal(true),
})

export const equipmentTargetSchema = z.enum(['STANDARD', 'EXTENDED', 'ADVANCED'])

export const equipmentUpgradeSchema = z.object({
  target: equipmentTargetSchema,
})

export const bulkIdsSchema = z.object({
  ownedIds: z.array(z.number().int().positive()).min(1).max(50),
})

export const claimTaskSchema = z.object({
  taskKey: z.string().trim().min(1).max(64),
})

export const achievementClaimSchema = z.object({
  trackKey: z.string().trim().min(1).max(64),
  stage: z.enum(['BRONZE', 'SILVER', 'GOLD', 'DIAMOND']),
})

export const featuredBadgesSchema = z.object({
  badges: z.array(z.string().trim().min(1).max(64)).max(3),
})

export const avatarSchema = z.object({
  avatarKey: z.string().trim().min(1).max(64),
})

export const usernameParamSchema = z.object({
  username: z.string().trim().min(3).max(20),
})

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
})

export const withdrawalCreateSchema = z.object({
  grossSp: z
    .string()
    .trim()
    .regex(/^[0-9]+$/, 'grossSp must be an integer string')
    .transform((s) => BigInt(s)),
  address: z.string().trim().min(10).max(100),
})

export const withdrawalReviewSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED', 'ON_HOLD']),
  note: z.string().trim().max(500).optional(),
})

export const depositCreateSchema = z.object({
  amountUsdt: z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,6})?$/, 'amountUsdt must be a decimal string'),
  // Optional verified asset/network selection (validated server-side).
  asset: z.string().trim().min(1).max(20).optional(),
  network: z.string().trim().min(1).max(50).optional(),
  confirm: z.boolean().optional(),
})

export const purchaseCreateSchema = z.object({
  ceoId: z.coerce.number().int().positive(),
  idempotencyKey: z.string().trim().min(8).max(100),
})

const oxapayAmount = z.union([z.string(), z.number()])

/**
 * OxaPay callback body (v1). Only the fields needed for verification and audit
 * are declared; unknown fields are stripped. The body is authenticated by
 * HMAC-SHA512 before it is parsed or validated.
 */
export const oxapayCallbackSchema = z.object({
  track_id: z.union([z.string(), z.number()]),
  status: z.string().trim().min(1).max(50),
  type: z.string().trim().max(50).optional(),
  amount: oxapayAmount.optional(),
  currency: z.string().trim().max(50).optional(),
  order_id: z.string().trim().max(200).optional(),
  txs: z
    .array(
      z.object({
        tx_hash: z.string().trim().max(200).optional(),
        status: z.string().trim().max(50).optional(),
        network: z.string().trim().max(100).optional(),
        currency: z.string().trim().max(50).optional(),
        amount: oxapayAmount.optional(),
      }),
    )
    .max(50)
    .optional(),
})

export type OxapayCallbackInput = z.infer<typeof oxapayCallbackSchema>

export type OwnedCeoIdParam = z.infer<typeof ownedCeoIdParamSchema>
export type RegisterWithReferralInput = z.infer<typeof registerWithReferralSchema>
export type EquipmentUpgradeInput = z.infer<typeof equipmentUpgradeSchema>
export type BulkIdsInput = z.infer<typeof bulkIdsSchema>
export type ClaimTaskInput = z.infer<typeof claimTaskSchema>
export type AchievementClaimInput = z.infer<typeof achievementClaimSchema>
