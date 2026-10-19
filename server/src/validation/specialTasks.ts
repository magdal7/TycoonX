import { z } from 'zod'

export const specialTaskIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
})

const dateString = z
  .string()
  .trim()
  .refine((v) => !Number.isNaN(Date.parse(v)), 'invalid date')

/**
 * Admin campaign configuration. Rewards are bounded and high values require an
 * explicit `confirmHighReward` flag (anti-abuse guardrail, Master Spec §8).
 */
export const specialTaskConfigSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(1).max(2000),
  link: z.string().trim().url().max(500).nullish(),
  proofInstructions: z.string().trim().max(2000).nullish(),
  rewardXp: z.number().int().min(0).max(1_000_000).default(0),
  rewardBonusSp: z.number().int().min(0).max(1_000_000).default(0),
  verification: z.enum(['MANUAL', 'AUTO']).default('MANUAL'),
  minLevel: z.number().int().min(1).max(50).default(1),
  maxCompletions: z.number().int().min(1).max(1_000_000).nullish(),
  startsAt: dateString.nullish(),
  expiresAt: dateString.nullish(),
  confirmHighReward: z.boolean().optional(),
})

export const specialTaskActionSchema = z.object({
  action: z.enum(['publish', 'pause', 'expire', 'archive']),
})

export const submissionCreateSchema = z
  .object({
    proofText: z.string().trim().max(2000).optional(),
    proofUrl: z.string().trim().url().max(500).optional(),
  })
  .refine((d) => Boolean(d.proofText) || Boolean(d.proofUrl), {
    message: 'proofText or proofUrl is required',
  })

export const submissionReviewSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT']),
  note: z.string().trim().max(500).optional(),
})

export type SpecialTaskConfigBody = z.infer<typeof specialTaskConfigSchema>
export type SubmissionCreateBody = z.infer<typeof submissionCreateSchema>
