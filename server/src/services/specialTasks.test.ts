import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { PrismaClient } from '@prisma/client'
import {
  SpecialTaskError,
  applySpecialTaskAction,
  claimSpecialTaskReward,
  createSpecialTask,
  listPlayerSpecialTasks,
  reviewSubmission,
  submitSpecialTask,
  updateSpecialTask,
  type SpecialTaskConfigInput,
} from './specialTasks'

type TaskStatus = 'DRAFT' | 'PUBLISHED' | 'PAUSED' | 'EXPIRED' | 'ARCHIVED'
type SubStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CLAIMED'

interface TaskRow {
  id: number
  title: string
  description: string
  link: string | null
  proofInstructions: string | null
  rewardXp: number
  rewardBonusSp: bigint
  status: TaskStatus
  verification: 'MANUAL' | 'AUTO'
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
}
interface SubRow {
  id: number
  taskId: number
  userId: number
  status: SubStatus
  attempt: number
  proofText: string | null
  proofUrl: string | null
  rewardXpSnap: number
  rewardBonusSpSnap: bigint
  reserved: boolean
  reviewNote: string | null
  reviewedBy: number | null
  reviewedAt: Date | null
  claimedAt: Date | null
  createdAt: Date
  updatedAt: Date
}
interface AuditRow {
  id: number
  actorId: number
  action: string
  targetType: string
  targetId: string
  metadata: unknown
  createdAt: Date
}
interface ProgressRow { userId: number; xp: number; level: number }
interface SpAcct { userId: number; earnedSp: bigint; bonusSp: bigint; lifetimeEarnedSp: bigint; version: number }
interface LedgerRow { id: number; userId: number; bucket: string; amountSp: bigint; sourceType: string; sourceId: bigint | null }

function uniqueViolation(): never {
  const err = new Error('unique violation') as Error & { code?: string }
  err.code = 'P2002'
  throw err
}

class FakePrisma {
  tasks: TaskRow[] = []
  subs: SubRow[] = []
  audits: AuditRow[] = []
  progress: ProgressRow[] = []
  accounts: SpAcct[] = []
  ledger: LedgerRow[] = []
  private seq = 1
  private auditSeq = 1

  specialTask = {
    findUnique: async (args: any): Promise<TaskRow | null> =>
      this.tasks.find((t) => t.id === args?.where?.id) ?? null,
    create: async (args: any): Promise<TaskRow> => {
      const d = args.data
      const row: TaskRow = {
        id: this.seq++,
        title: d.title,
        description: d.description,
        link: d.link ?? null,
        proofInstructions: d.proofInstructions ?? null,
        rewardXp: d.rewardXp,
        rewardBonusSp: d.rewardBonusSp,
        status: d.status,
        verification: d.verification,
        minLevel: d.minLevel,
        maxCompletions: d.maxCompletions ?? null,
        completionsCount: 0,
        startsAt: d.startsAt ?? null,
        expiresAt: d.expiresAt ?? null,
        createdBy: d.createdBy,
        publishedAt: null,
        archivedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      this.tasks.push(row)
      return row
    },
    update: async (args: any): Promise<TaskRow> => {
      const row = this.tasks.find((t) => t.id === args?.where?.id)!
      this.applyPatch(row as unknown as Record<string, unknown>, args.data)
      return row
    },
    updateMany: async (args: any): Promise<{ count: number }> => {
      const w = args.where
      const row = this.tasks.find((t) => t.id === w.id)
      if (!row) return { count: 0 }
      if (w.completionsCount?.lt !== undefined && !(row.completionsCount < w.completionsCount.lt)) return { count: 0 }
      if (w.completionsCount?.gt !== undefined && !(row.completionsCount > w.completionsCount.gt)) return { count: 0 }
      this.applyPatch(row as unknown as Record<string, unknown>, args.data)
      return { count: 1 }
    },
    findMany: async (args: any): Promise<TaskRow[]> => {
      let rows = [...this.tasks]
      const w = args?.where
      if (w?.status?.in) rows = rows.filter((t) => w.status.in.includes(t.status))
      else if (typeof w?.status === 'string') rows = rows.filter((t) => t.status === w.status)
      return rows.sort((a, b) => b.id - a.id)
    },
    count: async (args: any): Promise<number> =>
      this.tasks.filter((t) => !args?.where?.status || t.status === args.where.status).length,
  }

  specialTaskSubmission = {
    findUnique: async (args: any): Promise<SubRow | null> =>
      this.subs.find((s) => s.id === args?.where?.id) ?? null,
    findUniqueOrThrow: async (args: any): Promise<SubRow> => {
      const row = this.subs.find((s) => s.id === args?.where?.id)
      if (!row) throw new Error('not found')
      return row
    },
    findMany: async (args: any): Promise<SubRow[]> => {
      const w = args?.where ?? {}
      let rows = this.subs.filter(
        (s) =>
          (w.taskId === undefined || s.taskId === w.taskId) &&
          (w.userId === undefined || s.userId === w.userId) &&
          (w.status === undefined || s.status === w.status),
      )
      if (args?.orderBy?.attempt === 'asc') rows = [...rows].sort((a, b) => a.attempt - b.attempt)
      return rows
    },
    create: async (args: any): Promise<SubRow> => {
      const d = args.data
      if (this.subs.some((s) => s.taskId === d.taskId && s.userId === d.userId && s.attempt === d.attempt)) {
        uniqueViolation()
      }
      const row: SubRow = {
        id: this.seq++,
        taskId: d.taskId,
        userId: d.userId,
        status: d.status,
        attempt: d.attempt,
        proofText: d.proofText ?? null,
        proofUrl: d.proofUrl ?? null,
        rewardXpSnap: d.rewardXpSnap,
        rewardBonusSpSnap: d.rewardBonusSpSnap,
        reserved: d.reserved ?? false,
        reviewNote: null,
        reviewedBy: null,
        reviewedAt: null,
        claimedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      this.subs.push(row)
      return row
    },
    update: async (args: any): Promise<SubRow> => {
      const row = this.subs.find((s) => s.id === args?.where?.id)!
      Object.assign(row, args.data)
      return row
    },
    updateMany: async (args: any): Promise<{ count: number }> => {
      const w = args.where
      const rows = this.subs.filter(
        (s) =>
          s.id === w.id &&
          (w.userId === undefined || s.userId === w.userId) &&
          (w.status === undefined || s.status === w.status),
      )
      for (const r of rows) Object.assign(r, args.data)
      return { count: rows.length }
    },
    count: async (args: any): Promise<number> =>
      this.subs.filter((s) => !args?.where?.status || s.status === args.where.status).length,
  }

  adminAuditLog = {
    create: async (args: any): Promise<AuditRow> => {
      const d = args.data
      const row: AuditRow = {
        id: this.auditSeq++,
        actorId: d.actorId,
        action: d.action,
        targetType: d.targetType,
        targetId: d.targetId,
        metadata: d.metadata ?? null,
        createdAt: new Date(),
      }
      this.audits.push(row)
      return row
    },
    findMany: async (): Promise<AuditRow[]> => [...this.audits].sort((a, b) => b.id - a.id),
  }

  progressAccount = {
    findUnique: async (args: any): Promise<ProgressRow | null> =>
      this.progress.find((p) => p.userId === args?.where?.userId) ?? null,
    upsert: async (args: any): Promise<ProgressRow> => {
      const userId = args.where.userId
      let row = this.progress.find((p) => p.userId === userId)
      if (!row) {
        row = { userId, xp: args.create.xp, level: 1 }
        this.progress.push(row)
      } else if (args.update.xp?.increment) {
        row.xp += args.update.xp.increment
      }
      return row
    },
    update: async (args: any): Promise<ProgressRow> => {
      const row = this.progress.find((p) => p.userId === args?.where?.userId)!
      Object.assign(row, args.data)
      return row
    },
  }

  spAccount = {
    upsert: async (args: any): Promise<SpAcct> => {
      const userId = args.where.userId
      let row = this.accounts.find((a) => a.userId === userId)
      if (!row) {
        row = {
          userId,
          earnedSp: args.create.earnedSp ?? 0n,
          bonusSp: args.create.bonusSp ?? 0n,
          lifetimeEarnedSp: args.create.lifetimeEarnedSp ?? 0n,
          version: 0,
        }
        this.accounts.push(row)
      } else {
        if (args.update.earnedSp?.increment) row.earnedSp += BigInt(args.update.earnedSp.increment)
        if (args.update.bonusSp?.increment) row.bonusSp += BigInt(args.update.bonusSp.increment)
        if (args.update.lifetimeEarnedSp?.increment) row.lifetimeEarnedSp += BigInt(args.update.lifetimeEarnedSp.increment)
        if (args.update.version?.increment) row.version += args.update.version.increment
      }
      return row
    },
  }

  spLedgerEntry = {
    create: async (args: any): Promise<LedgerRow> => {
      const d = args.data
      if (
        d.sourceId !== null &&
        d.sourceId !== undefined &&
        this.ledger.some(
          (l) => l.userId === d.userId && l.sourceType === d.sourceType && l.sourceId === d.sourceId && l.bucket === d.bucket,
        )
      ) {
        uniqueViolation()
      }
      const row: LedgerRow = {
        id: this.seq++,
        userId: d.userId,
        bucket: d.bucket,
        amountSp: d.amountSp,
        sourceType: d.sourceType,
        sourceId: d.sourceId ?? null,
      }
      this.ledger.push(row)
      return row
    },
  }

  $executeRaw = async (): Promise<number> => 1
  $transaction = async <T>(fn: (tx: FakePrisma) => Promise<T>): Promise<T> => fn(this)

  private applyPatch(target: Record<string, unknown>, data: Record<string, unknown>): void {
    for (const [key, value] of Object.entries(data)) {
      if (value && typeof value === 'object' && 'increment' in (value as object)) {
        target[key] = (target[key] as number) + (value as { increment: number }).increment
      } else if (value && typeof value === 'object' && 'decrement' in (value as object)) {
        target[key] = (target[key] as number) - (value as { decrement: number }).decrement
      } else {
        target[key] = value
      }
    }
  }
}

const asClient = (f: FakePrisma): PrismaClient => f as unknown as PrismaClient

const ADMIN = 1
const PLAYER = 100

function config(overrides: Partial<SpecialTaskConfigInput> = {}): SpecialTaskConfigInput {
  return {
    title: 'Follow our socials',
    description: 'Follow and submit your handle.',
    rewardXp: 50,
    rewardBonusSp: 25,
    verification: 'MANUAL',
    minLevel: 1,
    ...overrides,
  }
}

async function makePublished(f: FakePrisma, overrides: Partial<SpecialTaskConfigInput> = {}): Promise<TaskRow> {
  const client = asClient(f)
  const created = (await createSpecialTask(client, ADMIN, config(overrides))) as unknown as TaskRow
  await applySpecialTaskAction(client, ADMIN, created.id, 'publish')
  return created
}

function expectCode(code: string) {
  return (error: unknown) => {
    assert.ok(error instanceof SpecialTaskError, `expected SpecialTaskError, got ${String(error)}`)
    assert.equal((error as SpecialTaskError).code, code)
    return true
  }
}

test('createSpecialTask starts as DRAFT and audits the action', async () => {
  const f = new FakePrisma()
  const task = await createSpecialTask(asClient(f), ADMIN, config())
  assert.equal(task.status, 'DRAFT')
  assert.equal(f.tasks.length, 1)
  assert.equal(f.audits[0].action, 'special_task.create')
})

test('createSpecialTask rejects unusually high rewards without confirmation', async () => {
  const f = new FakePrisma()
  await assert.rejects(
    () => createSpecialTask(asClient(f), ADMIN, config({ rewardXp: 100000 })),
    expectCode('high_reward_confirmation_required'),
  )
  await assert.rejects(
    () => createSpecialTask(asClient(f), ADMIN, config({ rewardBonusSp: 100000 })),
    expectCode('high_reward_confirmation_required'),
  )
  const ok = await createSpecialTask(asClient(f), ADMIN, config({ rewardXp: 100000, confirmHighReward: true }))
  assert.equal(ok.rewardXp, 100000)
})

test('campaign lifecycle enforces legal transitions', async () => {
  const f = new FakePrisma()
  const client = asClient(f)
  const task = (await createSpecialTask(client, ADMIN, config())) as unknown as TaskRow
  await applySpecialTaskAction(client, ADMIN, task.id, 'publish')
  assert.equal(f.tasks[0].status, 'PUBLISHED')
  await assert.rejects(() => applySpecialTaskAction(client, ADMIN, task.id, 'publish'), expectCode('invalid_state'))
  await applySpecialTaskAction(client, ADMIN, task.id, 'pause')
  assert.equal(f.tasks[0].status, 'PAUSED')
  await applySpecialTaskAction(client, ADMIN, task.id, 'archive')
  assert.equal(f.tasks[0].status, 'ARCHIVED')
  await assert.rejects(() => applySpecialTaskAction(client, ADMIN, task.id, 'publish'), expectCode('invalid_state'))
})

test('rewards cannot be edited once a submission exists (snapshot immutability)', async () => {
  const f = new FakePrisma()
  const client = asClient(f)
  const task = await makePublished(f)
  await submitSpecialTask(client, PLAYER, task.id, { proofText: 'done' })
  await assert.rejects(
    () => updateSpecialTask(client, ADMIN, task.id, config({ rewardXp: 999 })),
    expectCode('invalid_state'),
  )
  // Non-reward edits still work.
  const updated = await updateSpecialTask(client, ADMIN, task.id, config({ title: 'Updated title' }))
  assert.equal(updated.title, 'Updated title')
})

test('submit reserves a slot and creates a PENDING submission', async () => {
  const f = new FakePrisma()
  const client = asClient(f)
  const task = await makePublished(f)
  const result = await submitSpecialTask(client, PLAYER, task.id, { proofUrl: 'https://x.example/proof' })
  assert.equal(result.status, 'PENDING')
  assert.equal(result.attempt, 1)
  assert.equal(f.tasks[0].completionsCount, 1)
})

test('duplicate pending submission is rejected', async () => {
  const f = new FakePrisma()
  const client = asClient(f)
  const task = await makePublished(f)
  await submitSpecialTask(client, PLAYER, task.id, { proofText: 'first' })
  await assert.rejects(
    () => submitSpecialTask(client, PLAYER, task.id, { proofText: 'second' }),
    expectCode('pending_exists'),
  )
  assert.equal(f.subs.length, 1)
})

test('capped campaigns reject new entrants when full', async () => {
  const f = new FakePrisma()
  const client = asClient(f)
  const task = await makePublished(f, { maxCompletions: 1 })
  await submitSpecialTask(client, PLAYER, task.id, { proofText: 'a' })
  await assert.rejects(
    () => submitSpecialTask(client, 200, task.id, { proofText: 'b' }),
    expectCode('full'),
  )
})

test('eligibility below the minimum level is rejected', async () => {
  const f = new FakePrisma()
  const client = asClient(f)
  const task = await makePublished(f, { minLevel: 5 })
  await assert.rejects(
    () => submitSpecialTask(client, PLAYER, task.id, { proofText: 'a' }),
    expectCode('ineligible'),
  )
})

test('approval then claim awards XP and Bonus SP exactly once', async () => {
  const f = new FakePrisma()
  const client = asClient(f)
  const task = await makePublished(f)
  const { submissionId } = await submitSpecialTask(client, PLAYER, task.id, { proofText: 'a' })

  const reviewed = await reviewSubmission(client, ADMIN, submissionId, 'APPROVE')
  assert.equal(reviewed.status, 'APPROVED')
  assert.equal(f.audits.some((a) => a.action === 'special_task.approve'), true)

  const claim = await claimSpecialTaskReward(client, PLAYER, submissionId)
  assert.equal(claim.xpAwarded, 50)
  assert.equal(claim.bonusSpAwarded, '25')
  assert.equal(f.progress.find((p) => p.userId === PLAYER)!.xp, 50)
  assert.equal(f.accounts.find((a) => a.userId === PLAYER)!.bonusSp, 25n)
  assert.equal(f.ledger.filter((l) => l.sourceType === 'SPECIAL_TASK_REWARD').length, 1)

  await assert.rejects(() => claimSpecialTaskReward(client, PLAYER, submissionId), expectCode('not_approved'))
  assert.equal(f.accounts.find((a) => a.userId === PLAYER)!.bonusSp, 25n)
})

test('a player cannot claim another player’s submission', async () => {
  const f = new FakePrisma()
  const client = asClient(f)
  const task = await makePublished(f)
  const { submissionId } = await submitSpecialTask(client, PLAYER, task.id, { proofText: 'a' })
  await reviewSubmission(client, ADMIN, submissionId, 'APPROVE')
  await assert.rejects(() => claimSpecialTaskReward(client, 999, submissionId), expectCode('not_found'))
})

test('concurrent approvals award the review exactly once', async () => {
  const f = new FakePrisma()
  const client = asClient(f)
  const task = await makePublished(f)
  const { submissionId } = await submitSpecialTask(client, PLAYER, task.id, { proofText: 'a' })

  const results = await Promise.allSettled([
    reviewSubmission(client, ADMIN, submissionId, 'APPROVE'),
    reviewSubmission(client, ADMIN, submissionId, 'APPROVE'),
  ])
  const ok = results.filter((r) => r.status === 'fulfilled')
  const failed = results.filter((r) => r.status === 'rejected')
  assert.equal(ok.length, 1)
  assert.equal(failed.length, 1)
  assert.equal(f.subs[0].status, 'APPROVED')
  assert.equal(f.audits.filter((a) => a.action === 'special_task.approve').length, 1)
})

test('concurrent claims credit the reward exactly once', async () => {
  const f = new FakePrisma()
  const client = asClient(f)
  const task = await makePublished(f)
  const { submissionId } = await submitSpecialTask(client, PLAYER, task.id, { proofText: 'a' })
  await reviewSubmission(client, ADMIN, submissionId, 'APPROVE')

  const results = await Promise.allSettled([
    claimSpecialTaskReward(client, PLAYER, submissionId),
    claimSpecialTaskReward(client, PLAYER, submissionId),
  ])
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1)
  assert.equal(f.progress.find((p) => p.userId === PLAYER)!.xp, 50)
  assert.equal(f.accounts.find((a) => a.userId === PLAYER)!.bonusSp, 25n)
  assert.equal(f.ledger.filter((l) => l.sourceType === 'SPECIAL_TASK_REWARD').length, 1)
})

test('final rejection releases the reserved slot; earlier rejections allow retry', async () => {
  const f = new FakePrisma()
  const client = asClient(f)
  const task = await makePublished(f, { maxCompletions: 1 })

  const first = await submitSpecialTask(client, PLAYER, task.id, { proofText: 'a' })
  await reviewSubmission(client, ADMIN, first.submissionId, 'REJECT')
  assert.equal(f.tasks[0].completionsCount, 1) // still reserved while retries remain

  const second = await submitSpecialTask(client, PLAYER, task.id, { proofText: 'b' })
  assert.equal(second.attempt, 2)
  await reviewSubmission(client, ADMIN, second.submissionId, 'REJECT')

  const third = await submitSpecialTask(client, PLAYER, task.id, { proofText: 'c' })
  assert.equal(third.attempt, 3)
  await reviewSubmission(client, ADMIN, third.submissionId, 'REJECT')

  // Final rejection releases the slot so a new entrant can participate.
  assert.equal(f.tasks[0].completionsCount, 0)
  await submitSpecialTask(client, 200, task.id, { proofText: 'd' })
  assert.equal(f.tasks[0].completionsCount, 1)

  await assert.rejects(
    () => submitSpecialTask(client, PLAYER, task.id, { proofText: 'e' }),
    expectCode('max_attempts'),
  )
})

test('AUTO-verified campaigns approve on submission and still require a manual claim', async () => {
  const f = new FakePrisma()
  const client = asClient(f)
  const task = await makePublished(f, { verification: 'AUTO' })
  const { submissionId, status } = await submitSpecialTask(client, PLAYER, task.id, { proofText: 'a' })
  assert.equal(status, 'APPROVED')
  const claim = await claimSpecialTaskReward(client, PLAYER, submissionId)
  assert.equal(claim.xpAwarded, 50)
})

test('listPlayerSpecialTasks surfaces derived states', async () => {
  const f = new FakePrisma()
  const client = asClient(f)
  const task = await makePublished(f)
  const before = await listPlayerSpecialTasks(client, PLAYER)
  assert.equal(before[0].state, 'AVAILABLE')

  const { submissionId } = await submitSpecialTask(client, PLAYER, task.id, { proofText: 'a' })
  const pending = await listPlayerSpecialTasks(client, PLAYER)
  assert.equal(pending[0].state, 'PENDING')

  await reviewSubmission(client, ADMIN, submissionId, 'APPROVE')
  const approved = await listPlayerSpecialTasks(client, PLAYER)
  assert.equal(approved[0].state, 'APPROVED')

  await claimSpecialTaskReward(client, PLAYER, submissionId)
  const done = await listPlayerSpecialTasks(client, PLAYER)
  assert.equal(done[0].state, 'COMPLETED')
  assert.equal(done[0].attemptsUsed, 1)
})
