import type { Prisma, PrismaClient } from '@prisma/client'
import { isUniqueViolation } from '../lib/idempotency'
import {
  MAX_PROOF_ATTEMPTS,
  derivePlayerState,
  isOpenForNewSubmissions,
  nextStatus,
  rewardRequiresConfirmation,
  type PlayerSpecialTaskState,
  type SpecialTaskAction,
  type SpecialTaskStatusName,
  type SubmissionStatusName,
} from '../lib/specialTasks'
import { getProgress, awardXp } from './progress'
import { creditSp } from './spLedger'

type Tx = Prisma.TransactionClient

export type SpecialTaskErrorCode =
  | 'not_found'
  | 'invalid_state'
  | 'not_published'
  | 'expired'
  | 'ineligible'
  | 'full'
  | 'max_attempts'
  | 'pending_exists'
  | 'already_completed'
  | 'high_reward_confirmation_required'
  | 'already_reviewed'
  | 'not_approved'

export class SpecialTaskError extends Error {
  constructor(public code: SpecialTaskErrorCode, message?: string) {
    super(message ?? code)
    this.name = 'SpecialTaskError'
  }
}

export interface SpecialTaskConfigInput {
  title: string
  description: string
  link?: string | null
  proofInstructions?: string | null
  rewardXp: number
  rewardBonusSp: number
  verification: 'MANUAL' | 'AUTO'
  minLevel: number
  maxCompletions?: number | null
  startsAt?: string | null
  expiresAt?: string | null
  confirmHighReward?: boolean
}

function audit(
  tx: Tx,
  actorId: number,
  action: string,
  targetType: string,
  targetId: string,
  metadata?: Prisma.InputJsonValue,
) {
  return tx.adminAuditLog.create({
    data: { actorId, action, targetType, targetId, metadata },
  })
}

function assertHighRewardAllowed(input: Pick<SpecialTaskConfigInput, 'rewardXp' | 'rewardBonusSp' | 'confirmHighReward'>) {
  const bonus = BigInt(input.rewardBonusSp)
  if (rewardRequiresConfirmation(input.rewardXp, bonus) && !input.confirmHighReward) {
    throw new SpecialTaskError('high_reward_confirmation_required')
  }
}

function configData(input: SpecialTaskConfigInput) {
  return {
    title: input.title,
    description: input.description,
    link: input.link ?? null,
    proofInstructions: input.proofInstructions ?? null,
    rewardXp: input.rewardXp,
    rewardBonusSp: BigInt(input.rewardBonusSp),
    verification: input.verification,
    minLevel: input.minLevel,
    maxCompletions: input.maxCompletions ?? null,
    startsAt: input.startsAt ? new Date(input.startsAt) : null,
    expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
  }
}

// ---------------------------------------------------------------------------
// Admin: campaign management
// ---------------------------------------------------------------------------

export interface AdminTaskFilter {
  status?: SpecialTaskStatusName
}

export async function listSpecialTasksAdmin(db: PrismaClient, filter: AdminTaskFilter = {}) {
  const rows = await db.specialTask.findMany({
    where: filter.status ? { status: filter.status } : undefined,
    orderBy: { id: 'desc' },
    take: 200,
    include: {
      _count: { select: { submissions: true } },
    },
  })
  return rows.map(serializeAdminTask)
}

export function serializeAdminTask(row: {
  id: number
  title: string
  description: string
  link: string | null
  proofInstructions: string | null
  rewardXp: number
  rewardBonusSp: bigint
  status: SpecialTaskStatusName
  verification: string
  minLevel: number
  maxCompletions: number | null
  completionsCount: number
  startsAt: Date | null
  expiresAt: Date | null
  createdBy: number
  publishedAt: Date | null
  archivedAt: Date | null
  createdAt: Date
  updatedAt: Date
  _count?: { submissions: number }
}) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    link: row.link,
    proofInstructions: row.proofInstructions,
    rewardXp: row.rewardXp,
    rewardBonusSp: row.rewardBonusSp.toString(),
    status: row.status,
    verification: row.verification,
    minLevel: row.minLevel,
    maxCompletions: row.maxCompletions,
    completionsCount: row.completionsCount,
    startsAt: row.startsAt ? row.startsAt.toISOString() : null,
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    createdBy: row.createdBy,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    archivedAt: row.archivedAt ? row.archivedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    submissionCount: row._count?.submissions ?? 0,
  }
}

export async function createSpecialTask(
  db: PrismaClient,
  actorId: number,
  input: SpecialTaskConfigInput,
) {
  assertHighRewardAllowed(input)
  return db.$transaction(async (tx) => {
    const task = await tx.specialTask.create({
      data: { ...configData(input), status: 'DRAFT', createdBy: actorId },
    })
    await audit(tx, actorId, 'special_task.create', 'SpecialTask', String(task.id), {
      title: task.title,
      rewardXp: task.rewardXp,
      rewardBonusSp: task.rewardBonusSp.toString(),
    })
    return task
  })
}

export async function updateSpecialTask(
  db: PrismaClient,
  actorId: number,
  id: number,
  input: SpecialTaskConfigInput,
) {
  assertHighRewardAllowed(input)
  return db.$transaction(async (tx) => {
    const task = await tx.specialTask.findUnique({ where: { id } })
    if (!task) throw new SpecialTaskError('not_found')
    if (task.status === 'ARCHIVED') throw new SpecialTaskError('invalid_state')

    const submissions = await tx.specialTaskSubmission.count({ where: { taskId: id } })
    const rewardChanged =
      task.rewardXp !== input.rewardXp || task.rewardBonusSp !== BigInt(input.rewardBonusSp)
    // Snapshot immutability: rewards cannot change once players have submitted.
    if (submissions > 0 && rewardChanged) throw new SpecialTaskError('invalid_state')

    const updated = await tx.specialTask.update({ where: { id }, data: configData(input) })
    await audit(tx, actorId, 'special_task.update', 'SpecialTask', String(id), {
      title: updated.title,
      rewardXp: updated.rewardXp,
      rewardBonusSp: updated.rewardBonusSp.toString(),
    })
    return updated
  })
}

export async function applySpecialTaskAction(
  db: PrismaClient,
  actorId: number,
  id: number,
  action: SpecialTaskAction,
) {
  return db.$transaction(async (tx) => {
    const task = await tx.specialTask.findUnique({ where: { id } })
    if (!task) throw new SpecialTaskError('not_found')
    const target = nextStatus(task.status, action)
    if (!target) throw new SpecialTaskError('invalid_state')

    const updated = await tx.specialTask.update({
      where: { id },
      data: {
        status: target,
        publishedAt: target === 'PUBLISHED' ? task.publishedAt ?? new Date() : task.publishedAt,
        archivedAt: target === 'ARCHIVED' ? new Date() : task.archivedAt,
      },
    })
    await audit(tx, actorId, `special_task.${action}`, 'SpecialTask', String(id), {
      from: task.status,
      to: target,
    })
    return updated
  })
}

export interface SubmissionFilter {
  taskId?: number
  status?: SubmissionStatusName
}

export async function listSubmissionsAdmin(db: PrismaClient, filter: SubmissionFilter = {}) {
  const rows = await db.specialTaskSubmission.findMany({
    where: {
      ...(filter.taskId ? { taskId: filter.taskId } : {}),
      ...(filter.status ? { status: filter.status } : {}),
    },
    orderBy: { id: 'asc' },
    take: 200,
    include: {
      user: { select: { username: true } },
      task: { select: { title: true } },
    },
  })
  return rows.map((r) => ({
    id: r.id,
    taskId: r.taskId,
    taskTitle: r.task.title,
    userId: r.userId,
    username: r.user.username,
    status: r.status,
    attempt: r.attempt,
    proofText: r.proofText,
    proofUrl: r.proofUrl,
    rewardXpSnap: r.rewardXpSnap,
    rewardBonusSpSnap: r.rewardBonusSpSnap.toString(),
    reviewNote: r.reviewNote,
    reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null,
    claimedAt: r.claimedAt ? r.claimedAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
  }))
}

/**
 * Approves or rejects a pending submission. The status transition is guarded by a
 * conditional update so concurrent reviews cannot both succeed.
 */
export async function reviewSubmission(
  db: PrismaClient,
  actorId: number,
  submissionId: number,
  decision: 'APPROVE' | 'REJECT',
  note?: string,
) {
  return db.$transaction(async (tx) => {
    const submission = await tx.specialTaskSubmission.findUnique({ where: { id: submissionId } })
    if (!submission) throw new SpecialTaskError('not_found')
    if (submission.status !== 'PENDING') throw new SpecialTaskError('already_reviewed')

    const now = new Date()
    const target = decision === 'APPROVE' ? 'APPROVED' : 'REJECTED'
    const guard = await tx.specialTaskSubmission.updateMany({
      where: { id: submissionId, status: 'PENDING' },
      data: { status: target, reviewedBy: actorId, reviewedAt: now, reviewNote: note ?? null },
    })
    if (guard.count !== 1) throw new SpecialTaskError('already_reviewed')

    // Final rejection releases the reserved slot (Master Spec §8).
    if (decision === 'REJECT' && submission.attempt >= MAX_PROOF_ATTEMPTS) {
      await tx.specialTaskSubmission.update({ where: { id: submissionId }, data: { reserved: false } })
      await tx.specialTask.updateMany({
        where: { id: submission.taskId, completionsCount: { gt: 0 } },
        data: { completionsCount: { decrement: 1 } },
      })
    }

    await audit(
      tx,
      actorId,
      decision === 'APPROVE' ? 'special_task.approve' : 'special_task.reject',
      'SpecialTaskSubmission',
      String(submissionId),
      { taskId: submission.taskId, userId: submission.userId, note: note ?? null },
    )
    return tx.specialTaskSubmission.findUniqueOrThrow({ where: { id: submissionId } })
  })
}

export async function getAdminDashboard(db: PrismaClient) {
  const [draft, published, paused, expired, archived, pending, approved, rejected, claimed, users, recentAudit] =
    await Promise.all([
      db.specialTask.count({ where: { status: 'DRAFT' } }),
      db.specialTask.count({ where: { status: 'PUBLISHED' } }),
      db.specialTask.count({ where: { status: 'PAUSED' } }),
      db.specialTask.count({ where: { status: 'EXPIRED' } }),
      db.specialTask.count({ where: { status: 'ARCHIVED' } }),
      db.specialTaskSubmission.count({ where: { status: 'PENDING' } }),
      db.specialTaskSubmission.count({ where: { status: 'APPROVED' } }),
      db.specialTaskSubmission.count({ where: { status: 'REJECTED' } }),
      db.specialTaskSubmission.count({ where: { status: 'CLAIMED' } }),
      db.user.count(),
      db.adminAuditLog.findMany({ orderBy: { id: 'desc' }, take: 10 }),
    ])
  return {
    tasks: { draft, published, paused, expired, archived, total: draft + published + paused + expired + archived },
    submissions: { pending, approved, rejected, claimed, total: pending + approved + rejected + claimed },
    users,
    recentAudit: recentAudit.map((a) => ({
      id: a.id,
      actorId: a.actorId,
      action: a.action,
      targetType: a.targetType,
      targetId: a.targetId,
      createdAt: a.createdAt.toISOString(),
    })),
  }
}

export async function listAuditLog(db: PrismaClient, take = 200) {
  const rows = await db.adminAuditLog.findMany({ orderBy: { id: 'desc' }, take })
  return rows.map((a) => ({
    id: a.id,
    actorId: a.actorId,
    action: a.action,
    targetType: a.targetType,
    targetId: a.targetId,
    metadata: a.metadata,
    createdAt: a.createdAt.toISOString(),
  }))
}

// ---------------------------------------------------------------------------
// Player: list, submit, claim
// ---------------------------------------------------------------------------

const PLAYER_VISIBLE_STATUSES: SpecialTaskStatusName[] = ['PUBLISHED', 'PAUSED', 'EXPIRED']

export async function listPlayerSpecialTasks(db: PrismaClient, userId: number) {
  const [tasks, submissions, progress] = await Promise.all([
    db.specialTask.findMany({
      where: { status: { in: PLAYER_VISIBLE_STATUSES as never } },
      orderBy: [{ id: 'desc' }],
      take: 100,
    }),
    db.specialTaskSubmission.findMany({
      where: { userId },
      orderBy: { attempt: 'asc' },
    }),
    getProgress(db as unknown as Tx, userId),
  ])

  const latestByTask = new Map<number, (typeof submissions)[number]>()
  for (const s of submissions) latestByTask.set(s.taskId, s)

  const now = new Date()
  return tasks.map((task) => {
    const sub = latestByTask.get(task.id) ?? null
    const state: PlayerSpecialTaskState = derivePlayerState({
      status: task.status as SpecialTaskStatusName,
      minLevel: task.minLevel,
      maxCompletions: task.maxCompletions,
      completionsCount: task.completionsCount,
      startsAt: task.startsAt,
      expiresAt: task.expiresAt,
      submission: sub ? { status: sub.status as SubmissionStatusName, attempt: sub.attempt } : null,
      playerLevel: progress.level,
      now,
    })
    const attemptsUsed = submissions.filter((s) => s.taskId === task.id).length
    return {
      id: task.id,
      title: task.title,
      description: task.description,
      link: task.link,
      proofInstructions: task.proofInstructions,
      rewardXp: task.rewardXp,
      rewardBonusSp: task.rewardBonusSp.toString(),
      state,
      minLevel: task.minLevel,
      expiresAt: task.expiresAt ? task.expiresAt.toISOString() : null,
      startsAt: task.startsAt ? task.startsAt.toISOString() : null,
      attemptsUsed,
      maxAttempts: MAX_PROOF_ATTEMPTS,
      submissionId: sub?.id ?? null,
      submissionStatus: sub?.status ?? null,
      submissionAttempt: sub?.attempt ?? null,
      reviewNote: sub?.reviewNote ?? null,
    }
  })
}

export interface SubmitProofInput {
  proofText?: string
  proofUrl?: string
}

export async function submitSpecialTask(
  db: PrismaClient,
  userId: number,
  taskId: number,
  proof: SubmitProofInput,
) {
  try {
    return await db.$transaction(async (tx) => {
      const task = await tx.specialTask.findUnique({ where: { id: taskId } })
      if (!task) throw new SpecialTaskError('not_found')
      const now = new Date()

      if (!isOpenForNewSubmissions(task, now)) {
        throw new SpecialTaskError(task.expiresAt && now > task.expiresAt ? 'expired' : 'not_published')
      }

      const existing = await tx.specialTaskSubmission.findMany({
        where: { taskId, userId },
        orderBy: { attempt: 'asc' },
      })
      const latest = existing[existing.length - 1]
      if (latest) {
        if (latest.status === 'PENDING') throw new SpecialTaskError('pending_exists')
        if (latest.status === 'APPROVED' || latest.status === 'CLAIMED') {
          throw new SpecialTaskError('already_completed')
        }
      }
      const attemptsUsed = existing.length
      if (attemptsUsed >= MAX_PROOF_ATTEMPTS) throw new SpecialTaskError('max_attempts')

      const progress = await getProgress(tx, userId)
      if (progress.level < task.minLevel) throw new SpecialTaskError('ineligible')

      // Reserve a slot atomically on the first attempt (compare-and-swap when capped).
      if (attemptsUsed === 0) {
        if (task.maxCompletions != null) {
          const guard = await tx.specialTask.updateMany({
            where: { id: taskId, completionsCount: { lt: task.maxCompletions } },
            data: { completionsCount: { increment: 1 } },
          })
          if (guard.count !== 1) throw new SpecialTaskError('full')
        } else {
          await tx.specialTask.update({
            where: { id: taskId },
            data: { completionsCount: { increment: 1 } },
          })
        }
      }

      const submission = await tx.specialTaskSubmission.create({
        data: {
          taskId,
          userId,
          attempt: attemptsUsed + 1,
          proofText: proof.proofText ?? null,
          proofUrl: proof.proofUrl ?? null,
          rewardXpSnap: task.rewardXp,
          rewardBonusSpSnap: task.rewardBonusSp,
          reserved: attemptsUsed === 0,
          status: task.verification === 'AUTO' ? 'APPROVED' : 'PENDING',
        },
      })
      return {
        submissionId: submission.id,
        status: submission.status,
        attempt: submission.attempt,
      }
    })
  } catch (error) {
    // A concurrent first/retry submission collides on (taskId, userId, attempt).
    if (isUniqueViolation(error)) throw new SpecialTaskError('pending_exists')
    throw error
  }
}

export interface ClaimRewardResult {
  submissionId: number
  xpAwarded: number
  bonusSpAwarded: string
}

/**
 * Claims an approved reward exactly once. The APPROVED -> CLAIMED transition is
 * guarded by a conditional update, and the SP ledger's unique source key is a
 * second backstop, so concurrent claims can never double-award.
 */
export async function claimSpecialTaskReward(
  db: PrismaClient,
  userId: number,
  submissionId: number,
): Promise<ClaimRewardResult> {
  return db.$transaction(async (tx) => {
    const submission = await tx.specialTaskSubmission.findUnique({ where: { id: submissionId } })
    if (!submission || submission.userId !== userId) throw new SpecialTaskError('not_found')
    if (submission.status !== 'APPROVED') throw new SpecialTaskError('not_approved')

    const guard = await tx.specialTaskSubmission.updateMany({
      where: { id: submissionId, userId, status: 'APPROVED' },
      data: { status: 'CLAIMED', claimedAt: new Date() },
    })
    if (guard.count !== 1) throw new SpecialTaskError('not_approved')

    if (submission.rewardXpSnap > 0) {
      await awardXp(tx, userId, submission.rewardXpSnap)
    }
    if (submission.rewardBonusSpSnap > 0n) {
      await creditSp(tx, {
        userId,
        bucket: 'BONUS',
        amountSp: submission.rewardBonusSpSnap,
        sourceType: 'SPECIAL_TASK_REWARD',
        sourceId: BigInt(submissionId),
        metadata: { taskId: submission.taskId },
      })
    }
    return {
      submissionId,
      xpAwarded: submission.rewardXpSnap,
      bonusSpAwarded: submission.rewardBonusSpSnap.toString(),
    }
  })
}
