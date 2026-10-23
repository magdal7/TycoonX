import 'dotenv/config'
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { Prisma, PrismaClient } from '@prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import { Pool } from '@neondatabase/serverless'
import { grantStarterCeo } from '../services/starterCeo'
import { OwnershipLimitError } from '../services/ownership'
import { startProduction, collectProduction, ProductionError } from '../services/production'
import { buildReconciliationInput, confirmDepositIntent, createDepositInvoice, processWebhook } from '../services/payments'
import type { OxapayConfig, OxapayFetch, OxapayFetchResponse } from '../services/oxapay'

process.env.PAYMENTS_ENABLED = 'true'

/**
 * PostgreSQL integration tests for starter provisioning.
 *
 * These tests write rows. They refuse to run unless TEST_DATABASE_URL points at
 * an isolated, disposable Neon test branch AND the connected server reports the
 * exact expected branch/project identity. They NEVER fall back to
 * DATABASE_URL/DIRECT_URL, never create or reset a branch, and never run
 * migrations. If no safe target is configured the whole suite is skipped. Run
 * with the disposable branch's DIRECT connection string, supplied by the
 * operator at execution time:
 *
 *   $env:TEST_DATABASE_URL = "<operator-supplied direct connection string>"
 *   npm run test:integration --workspace=server
 *
 * Safety (fail-closed, in order):
 *   1. string guard: TEST_DATABASE_URL must not equal DATABASE_URL/DIRECT_URL,
 *      must not reference a protected branch, and must be a Neon host;
 *   2. identity guard: `current_setting('neon.branch_id')` and
 *      `current_setting('neon.project_id')`, queried independently from the
 *      connected server, must equal EXPECTED_BRANCH_ID / EXPECTED_PROJECT_ID;
 *   3. schema guard: the expected Economy V2 tables/columns/indexes must exist.
 * No write happens until all three pass. The target branch must already have the
 * frozen migrations applied (the suite does not apply them). Only rows tagged
 * `itest_` are created and they are removed in `after`.
 */

const EXPECTED_BRANCH_ID = 'br-plain-forest-b4zbd6xf'
const EXPECTED_PROJECT_ID = 'wandering-king-57462138'

const PROTECTED_BRANCHES = [
  'br-delicate-butterfly-b4et73g9', // production
  'br-dawn-cherry-b4dnrhm5', // staging
  'br-long-king-b4s8l0yv', // recovery drill
]

const REQUIRED_TABLES = [
  'User',
  'CEO',
  'OwnedCeo',
  'ReferralAttribution',
  'IdempotencyKey',
  'AppMeta',
  'ProductionCycle',
  'SpAccount',
  'SpLedgerEntry',
  'ProgressAccount',
  'TaskEvent',
  'TaskClaim',
  'AchievementClaim',
  'UserProfile',
  'WithdrawalRequest',
  'SpecialTask',
  'SpecialTaskSubmission',
  'AdminAuditLog',
  'ReferralReward',
  'ReferralPurchaseEvent',
  'PaymentIntent',
  'PaymentWebhookEvent',
  'CeoPurchase',
]

const REQUIRED_CEO_COLUMNS = [
  'baseSpPerCycle',
  'maxOwned',
  'isStarter',
  'rewardEligible',
  'category',
  'displayOrder',
  'nominalSpPer24h',
  'lifetimeCapSp',
  'imageUrl',
  'isForSale',
]

const REQUIRED_INDEXES = [
  'OwnedCeo_starter_user_key',
  'IdempotencyKey_userId_scope_key_key',
  'ProductionCycle_open_owned_key',
  'SpLedgerEntry_userId_sourceType_sourceId_bucket_key',
]

interface Target {
  enabled: boolean
  reason?: string
  url?: string
  isNeon?: boolean
}

function resolveTarget(): Target {
  const url = process.env.TEST_DATABASE_URL
  if (!url) return { enabled: false, reason: 'TEST_DATABASE_URL is not set' }

  for (const branch of PROTECTED_BRANCHES) {
    if (url.includes(branch)) {
      throw new Error(
        `Refusing integration test: TEST_DATABASE_URL references a protected Neon branch (${branch}).`,
      )
    }
  }
  if (url === process.env.DATABASE_URL || url === process.env.DIRECT_URL) {
    throw new Error(
      'Refusing integration test: TEST_DATABASE_URL must not equal DATABASE_URL or DIRECT_URL.',
    )
  }

  let host: string
  try {
    host = new URL(url).hostname
  } catch {
    throw new Error('Refusing integration test: TEST_DATABASE_URL is not a valid URL.')
  }

  const local = host === 'localhost' || host === '127.0.0.1' || host === '::1'
  const isNeon = host.endsWith('.neon.tech')
  if (!local && !isNeon) {
    throw new Error(`Refusing integration test: host ${host} is neither local nor a Neon branch.`)
  }
  if (local) {
    return {
      enabled: false,
      reason: 'local Postgres requires the pg driver; configure an isolated Neon test branch instead',
    }
  }
  return { enabled: true, url, isNeon }
}

const target = resolveTarget()
const skip = target.enabled ? false : (target.reason ?? 'integration database unavailable')

let db: PrismaClient | null = null
let pool: Pool | null = null
let starterTemplateId: number | null = null
let createdFallbackTemplate = false
let ready = false

const shortId = () => randomBytes(4).toString('hex')

async function createUser(): Promise<number> {
  const stamp = `${Date.now()}_${shortId()}`
  const user = await db!.user.create({
    data: {
      email: `itest_${stamp}@example.com`,
      username: `itest_${stamp}`.slice(0, 30),
      passwordHash: 'x',
    },
    select: { id: true },
  })
  return user.id
}

const ITEST_USERNAME_PREFIX = 'itest_'

async function cleanupUser(userId: number): Promise<void> {
  await db!.productionCycle.deleteMany({ where: { userId } })
  await db!.spLedgerEntry.deleteMany({ where: { userId } })
  await db!.spAccount.deleteMany({ where: { userId } })
  await db!.progressAccount.deleteMany({ where: { userId } })
  await db!.taskEvent.deleteMany({ where: { userId } })
  await db!.taskClaim.deleteMany({ where: { userId } })
  await db!.achievementClaim.deleteMany({ where: { userId } })
  await db!.userProfile.deleteMany({ where: { userId } })
  await db!.idempotencyKey.deleteMany({ where: { userId } })
  await db!.referralAttribution.deleteMany({ where: { referrerId: userId } })
  await db!.referralAttribution.deleteMany({ where: { referredUserId: userId } })
  await db!.paymentIntent.deleteMany({ where: { userId } })
  await db!.ownedCeo.deleteMany({ where: { userId } })
  await db!.user.deleteMany({ where: { id: userId } })
}

/**
 * Best-effort suite-level sweep for rows left behind by an interrupted test or a
 * failed per-test cleanup. It only ever touches `itest_`-tagged users (and their
 * dependent rows) on the already-verified disposable branch.
 */
async function sweepLeftoverTestUsers(): Promise<void> {
  const leftovers = await db!.user.findMany({
    where: { username: { startsWith: ITEST_USERNAME_PREFIX } },
    select: { id: true },
  })
  const ids = leftovers.map((u) => u.id)
  if (ids.length === 0) return
  await db!.productionCycle.deleteMany({ where: { userId: { in: ids } } })
  await db!.spLedgerEntry.deleteMany({ where: { userId: { in: ids } } })
  await db!.spAccount.deleteMany({ where: { userId: { in: ids } } })
  await db!.progressAccount.deleteMany({ where: { userId: { in: ids } } })
  await db!.taskEvent.deleteMany({ where: { userId: { in: ids } } })
  await db!.taskClaim.deleteMany({ where: { userId: { in: ids } } })
  await db!.achievementClaim.deleteMany({ where: { userId: { in: ids } } })
  await db!.userProfile.deleteMany({ where: { userId: { in: ids } } })
  await db!.idempotencyKey.deleteMany({ where: { userId: { in: ids } } })
  await db!.referralAttribution.deleteMany({ where: { referrerId: { in: ids } } })
  await db!.referralAttribution.deleteMany({ where: { referredUserId: { in: ids } } })
  await db!.paymentIntent.deleteMany({ where: { userId: { in: ids } } })
  await db!.ownedCeo.deleteMany({ where: { userId: { in: ids } } })
  await db!.user.deleteMany({ where: { id: { in: ids } } })
}

async function failClosed(message: string): Promise<never> {
  await db?.$disconnect()
  throw new Error(`Refusing integration test: ${message}`)
}

/** Positive allowlist: both values are read independently from the server. */
async function verifyNeonIdentity(): Promise<void> {
  const rows = await db!.$queryRaw<Array<{ branch: string | null; project: string | null }>>`
    SELECT current_setting('neon.branch_id', true) AS branch,
           current_setting('neon.project_id', true) AS project
  `
  const branch = (rows[0]?.branch ?? '').trim()
  const project = (rows[0]?.project ?? '').trim()

  if (!branch) await failClosed('connected server did not expose neon.branch_id')
  if (!project) await failClosed('connected server did not expose neon.project_id')
  if (branch !== EXPECTED_BRANCH_ID) {
    await failClosed(`branch mismatch: connected "${branch}", expected "${EXPECTED_BRANCH_ID}"`)
  }
  if (project !== EXPECTED_PROJECT_ID) {
    await failClosed(`project mismatch: connected "${project}", expected "${EXPECTED_PROJECT_ID}"`)
  }
}

/** Confirms the Economy V2 tables, economy columns and unique indexes exist. */
async function assertEconomySchema(): Promise<void> {
  // NOTE: catalog fields such as information_schema.columns.column_name are of
  // PostgreSQL's internal "name" type, which the Prisma driver adapter cannot
  // deserialize. Always cast name-typed results (and array elements) to ::text.
  const tables = await db!.$queryRaw<Array<{ name: string; present: boolean }>>`
    SELECT name::text AS name, to_regclass('public.' || quote_ident(name)) IS NOT NULL AS present
    FROM (VALUES ${Prisma.join(REQUIRED_TABLES.map((t) => Prisma.sql`(${t})`))}) AS v(name)
  `
  const missingTables = tables.filter((r) => !r.present).map((r) => r.name)
  if (missingTables.length) {
    await failClosed(`Economy V2 schema incomplete; missing tables: ${missingTables.join(', ')}`)
  }

  const indexes = await db!.$queryRaw<Array<{ name: string; present: boolean }>>`
    SELECT name::text AS name, to_regclass('public.' || quote_ident(name)) IS NOT NULL AS present
    FROM (VALUES ${Prisma.join(
      REQUIRED_INDEXES.map((i) => Prisma.sql`(${i})`),
    )}) AS v(name)
  `
  const missingIndexes = indexes.filter((r) => !r.present).map((r) => r.name)
  if (missingIndexes.length) {
    await failClosed(`Economy V2 schema incomplete; missing indexes: ${missingIndexes.join(', ')}`)
  }

  const columns = await db!.$queryRaw<Array<{ column_name: string }>>`
    SELECT column_name::text AS column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'CEO'
      AND column_name IN (${Prisma.join(REQUIRED_CEO_COLUMNS)})
  `
  const found = new Set(columns.map((c) => c.column_name))
  const missingColumns = REQUIRED_CEO_COLUMNS.filter((c) => !found.has(c))
  if (missingColumns.length) {
    await failClosed(`Economy V2 schema incomplete; missing CEO columns: ${missingColumns.join(', ')}`)
  }

  // pg_enum.enumlabel is also a PostgreSQL "name" column: cast each element to
  // text and verify the Economy V2 AcquisitionType enum exists with its labels.
  const enumRows = await db!.$queryRaw<Array<{ label: string }>>`
    SELECT e.enumlabel::text AS label
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'AcquisitionType'
    ORDER BY e.enumsortorder
  `
  const expectedLabels = ['STARTER', 'PURCHASE', 'MISSION', 'REWARD', 'ADMIN']
  const labels = enumRows.map((r) => r.label)
  if (labels.join(',') !== expectedLabels.join(',')) {
    await failClosed(
      `Economy V2 schema incomplete; AcquisitionType labels = [${labels.join(', ')}]`,
    )
  }
}

before(async () => {
  if (!target.enabled) return

  pool = new Pool({ connectionString: target.url! })
  db = new PrismaClient({ adapter: new PrismaNeon(pool) })

  // Guard 1 already passed at import (string checks). Guards 2 and 3 run here,
  // before any write. Any failure disconnects and stops the suite.
  await verifyNeonIdentity()
  await assertEconomySchema()
  ready = true

  const existing = await db.cEO.findFirst({
    where: { isStarter: true, isActive: true },
    orderBy: { id: 'asc' },
    select: { id: true },
  })
  if (existing) {
    starterTemplateId = existing.id
  } else {
    const created = await db.cEO.create({
      data: {
        name: 'ITest Intern',
        slug: `itest-starter-${shortId()}`,
        rarity: 'Common',
        priceUsd: '0.00',
        dailyRatePercent: '0.0000',
        cycleHours: 4,
        energyCost: 2,
        isActive: true,
        isStarter: true,
        maxOwned: 1,
        nominalSpPer24h: 10,
        lifetimeCapSp: 40,
      },
      select: { id: true },
    })
    starterTemplateId = created.id
    createdFallbackTemplate = true
  }
})

after(async () => {
  if (!target.enabled) return
  if (ready && db) {
    // Safety net (runs even when a test/cleanup failed): remove any leftover
    // itest_ users and their dependent rows before removing the fallback template.
    await sweepLeftoverTestUsers()
    if (createdFallbackTemplate && starterTemplateId !== null) {
      await db.ownedCeo.deleteMany({ where: { templateId: starterTemplateId } })
      await db.cEO.deleteMany({ where: { id: starterTemplateId } })
    }
  }
  await db?.$disconnect()
  await pool?.end()
})

test('starter uniqueness: repeated grants produce exactly one STARTER row', { skip }, async () => {
  const userId = await createUser()
  try {
    const first = await grantStarterCeo(db!, userId)
    const second = await grantStarterCeo(db!, userId)
    assert.equal(first.created, true)
    assert.equal(second.created, false)
    assert.equal(first.ownedCeoId, second.ownedCeoId)
    const rows = await db!.ownedCeo.findMany({
      where: { userId, acquisitionType: 'STARTER' },
    })
    assert.equal(rows.length, 1)
  } finally {
    await cleanupUser(userId)
  }
})

test('concurrent grants never create a duplicate starter', { skip }, async () => {
  const userId = await createUser()
  try {
    for (let round = 0; round < 3; round += 1) {
      const results = await Promise.all(
        Array.from({ length: 5 }, () => grantStarterCeo(db!, userId)),
      )

      // Every caller converges on the same row.
      assert.equal(new Set(results.map((r) => r.ownedCeoId)).size, 1)
      // Exactly one grant creates; all later rounds are pure replays.
      assert.equal(results.filter((r) => r.created).length, round === 0 ? 1 : 0)

      assert.equal(await db!.ownedCeo.count({ where: { userId, acquisitionType: 'STARTER' } }), 1)
      assert.equal(await db!.idempotencyKey.count({ where: { userId, scope: 'starter_ceo' } }), 1)
    }
  } finally {
    await cleanupUser(userId)
  }
})

test('maxOwned is enforced for the starter template', { skip }, async () => {
  const userId = await createUser()
  try {
    const template = await db!.cEO.findUniqueOrThrow({
      where: { id: starterTemplateId! },
      select: { id: true, maxOwned: true },
    })
    for (let i = 0; i < template.maxOwned; i += 1) {
      await db!.ownedCeo.create({
        data: { userId, templateId: template.id, acquisitionType: 'ADMIN', status: 'IDLE' },
      })
    }
    await assert.rejects(() => grantStarterCeo(db!, userId), OwnershipLimitError)
    assert.equal(await db!.ownedCeo.count({ where: { userId, acquisitionType: 'STARTER' } }), 0)
  } finally {
    await cleanupUser(userId)
  }
})

test('a failing transaction rolls back the owned row and the idempotency key', { skip }, async () => {
  const userId = await createUser()
  try {
    await assert.rejects(() =>
      db!.$transaction(async (tx) => {
        await tx.ownedCeo.create({
          data: { userId, templateId: starterTemplateId!, acquisitionType: 'ADMIN', status: 'IDLE' },
        })
        await tx.idempotencyKey.create({
          data: { userId, scope: 'itest_rollback', key: 'v1' },
        })
        throw new Error('forced rollback')
      }),
    )
    assert.equal(await db!.ownedCeo.count({ where: { userId } }), 0)
    assert.equal(await db!.idempotencyKey.count({ where: { userId } }), 0)
  } finally {
    await cleanupUser(userId)
  }
})

test('the partial unique index rejects a second STARTER row', { skip }, async () => {
  const userId = await createUser()
  try {
    await db!.ownedCeo.create({
      data: { userId, templateId: starterTemplateId!, acquisitionType: 'STARTER', status: 'IDLE' },
    })
    await assert.rejects(() =>
      db!.ownedCeo.create({
        data: { userId, templateId: starterTemplateId!, acquisitionType: 'STARTER', status: 'IDLE' },
      }),
    )
    assert.equal(await db!.ownedCeo.count({ where: { userId, acquisitionType: 'STARTER' } }), 1)
  } finally {
    await cleanupUser(userId)
  }
})

async function expireCycle(cycleId: string): Promise<void> {
  await db!.productionCycle.update({
    where: { id: BigInt(cycleId) },
    data: { endsAt: new Date(Date.now() - 1000) },
  })
}

test('production start -> collect credits exactly once; duplicate collect is a no-op', { skip }, async () => {
  const userId = await createUser()
  try {
    const { ownedCeoId } = await grantStarterCeo(db!, userId)
    const started = await startProduction(db!, userId, ownedCeoId)
    assert.equal(started.cycle.rewardSp, '1') // floor(10 SP/24h * 4h / 24) = 1
    assert.equal(started.cycle.cycleHours, 4)
    assert.equal((await db!.ownedCeo.findUniqueOrThrow({ where: { id: ownedCeoId } })).status, 'PRODUCING')

    await expireCycle(started.cycle.id)
    const first = await collectProduction(db!, userId, ownedCeoId)
    assert.equal(first.rewardSp, '1')
    assert.equal(first.alreadyCollected, false)

    const acct = await db!.spAccount.findUniqueOrThrow({ where: { userId } })
    assert.equal(acct.earnedSp, 1n)
    assert.equal(acct.lifetimeEarnedSp, 1n)
    assert.equal(await db!.spLedgerEntry.count({ where: { userId, sourceType: 'CYCLE_CLAIM' } }), 1)

    // Duplicate collection must not credit again.
    const replay = await collectProduction(db!, userId, ownedCeoId)
    assert.equal(replay.alreadyCollected, true)
    assert.equal((await db!.spAccount.findUniqueOrThrow({ where: { userId } })).earnedSp, 1n)
    assert.equal(await db!.spLedgerEntry.count({ where: { userId, sourceType: 'CYCLE_CLAIM' } }), 1)

    // A copy can start a fresh cycle after collecting the previous one.
    const restarted = await startProduction(db!, userId, ownedCeoId)
    assert.equal(restarted.replayed, false)
    assert.equal(restarted.cycle.rewardSp, '1')
  } finally {
    await cleanupUser(userId)
  }
})

test('collect before the cycle ends is rejected', { skip }, async () => {
  const userId = await createUser()
  try {
    const { ownedCeoId } = await grantStarterCeo(db!, userId)
    await startProduction(db!, userId, ownedCeoId)
    await assert.rejects(
      () => collectProduction(db!, userId, ownedCeoId),
      (e: unknown) => e instanceof ProductionError && e.code === 'not_ready',
    )
    assert.equal(await db!.spLedgerEntry.count({ where: { userId, sourceType: 'CYCLE_CLAIM' } }), 0)
  } finally {
    await cleanupUser(userId)
  }
})

test('reaching the lifetime cap archives the copy and blocks further starts', { skip }, async () => {
  const userId = await createUser()
  try {
    const { ownedCeoId } = await grantStarterCeo(db!, userId)
    // Intern cap is 40 SP; leave 1 SP of headroom.
    await db!.ownedCeo.update({ where: { id: ownedCeoId }, data: { lifetimeEarnedSp: 39n } })

    const started = await startProduction(db!, userId, ownedCeoId)
    await expireCycle(started.cycle.id)
    const result = await collectProduction(db!, userId, ownedCeoId)
    assert.equal(result.status, 'EXHAUSTED')

    const owned = await db!.ownedCeo.findUniqueOrThrow({ where: { id: ownedCeoId } })
    assert.equal(owned.status, 'EXHAUSTED')
    assert.ok(owned.archivedAt)
    assert.equal(owned.lifetimeEarnedSp, 40n)
    const acct = await db!.spAccount.findUniqueOrThrow({ where: { userId } })
    assert.equal(acct.earnedSp, 1n) // only the 1 SP of remaining headroom was produced

    await assert.rejects(
      () => startProduction(db!, userId, ownedCeoId),
      (e: unknown) => e instanceof ProductionError && e.code === 'exhausted',
    )
  } finally {
    await cleanupUser(userId)
  }
})

// ---------------------------------------------------------------------------
// Deposits (OxaPay) — reuse the same guarded disposable-branch setup. The
// provider is mocked; no live provider calls are made. Settlement accounting
// stays as production (credits the verified invoice amount as Bonus SP).
// ---------------------------------------------------------------------------

function depositConfig(accepted: string[], trackId: string): OxapayConfig {
  const json = (body: unknown): OxapayFetchResponse => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify(body),
  })
  const fetch: OxapayFetch = async (url) => {
    if (url.endsWith('/payment/accepted-currencies')) return json({ status: 200, data: { list: accepted } })
    if (url.endsWith('/payment/invoice')) {
      return json({
        status: 200,
        data: { track_id: trackId, payment_url: 'https://pay.oxapay.test/x', expired_at: 1700000000 },
      })
    }
    return json({ status: 404, error: { type: 'not_found' } })
  }
  return {
    merchantApiKey: 'itest-oxapay-key',
    baseUrl: 'https://api.oxapay.com/v1',
    sandbox: true,
    timeoutMs: 1000,
    fetch,
  }
}

test('deposit invoice creation persists track id, order ref and expectations', { skip }, async () => {
  const userId = await createUser()
  try {
    const trackId = `itest_track_${shortId()}`
    const view = await createDepositInvoice(db!, depositConfig(['USDT'], trackId), userId, '10.00', {
      asset: 'USDT',
      network: 'BEP20',
    })
    assert.equal(view.externalId, trackId)
    assert.equal(view.expectedAsset, 'USDT')
    assert.equal(view.expectedNetwork, 'BSC')

    const row = await db!.paymentIntent.findUniqueOrThrow({ where: { id: view.id } })
    assert.equal(row.status, 'CREATED')
    assert.equal(row.creditedSp, 10000n)
    const meta = row.metadata as Record<string, unknown>
    assert.match(String(meta.orderId), /^dep_/)
    assert.equal(meta.asset, 'USDT')
    assert.equal(meta.network, 'BSC')
  } finally {
    await cleanupUser(userId)
  }
})

test('deposit confirmation credits Bonus SP exactly once under concurrency', { skip }, async () => {
  const userId = await createUser()
  try {
    const view = await createDepositInvoice(db!, depositConfig(['USDT'], `itest_track_${shortId()}`), userId, '10.00', {
      asset: 'USDT',
      network: 'BEP20',
    })
    await db!.paymentIntent.update({ where: { id: view.id }, data: { status: 'PENDING' } })

    const results = await Promise.allSettled([
      confirmDepositIntent(db!, view.id),
      confirmDepositIntent(db!, view.id),
    ])
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1)

    const acct = await db!.spAccount.findUniqueOrThrow({ where: { userId } })
    assert.equal(acct.bonusSp, 10000n)
    assert.equal(acct.earnedSp, 0n)
    assert.equal(await db!.spLedgerEntry.count({ where: { userId, sourceType: 'DEPOSIT_CREDIT' } }), 1)
  } finally {
    await cleanupUser(userId)
  }
})

test('reconciliation input settles exactly once and is replay-guarded', { skip }, async () => {
  const userId = await createUser()
  let eventId: string | null = null
  try {
    const view = await createDepositInvoice(db!, depositConfig(['USDT'], `itest_track_${shortId()}`), userId, '10.00', {
      asset: 'USDT',
      network: 'BEP20',
    })
    const input = buildReconciliationInput(view.externalId, {
      trackId: view.externalId,
      status: 'paid',
      rawStatus: 'Paid',
      amount: '10.00',
      currency: 'USDT',
      expiredAt: null,
      createdAt: null,
      transactions: [{ txHash: `itest_${shortId()}`, currency: 'USDT', network: 'BSC', status: 'confirmed' }],
    })
    eventId = input.eventId

    const result = await processWebhook(db!, input)
    assert.equal(result.confirmed, true)
    const evt = await db!.paymentWebhookEvent.findFirstOrThrow({ where: { eventId } })
    assert.equal(evt.status, 'PROCESSED')
    assert.equal(await db!.spLedgerEntry.count({ where: { userId, sourceType: 'DEPOSIT_CREDIT' } }), 1)

    const again = await processWebhook(db!, input)
    assert.equal(again.reason, 'duplicate')
  } finally {
    if (eventId) await db!.paymentWebhookEvent.deleteMany({ where: { eventId } })
    await cleanupUser(userId)
  }
})