import 'dotenv/config'
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import { Pool } from '@neondatabase/serverless'
import { grantStarterCeo } from '../services/starterCeo'
import { OwnershipLimitError } from '../services/ownership'

/**
 * PostgreSQL integration tests for starter provisioning.
 *
 * These tests write rows. They refuse to run unless TEST_DATABASE_URL points at
 * an isolated, disposable Neon test branch. They NEVER fall back to
 * DATABASE_URL/DIRECT_URL, never reference the production/staging/recovery
 * branches, and never create or reset a branch. If no safe target is configured
 * the whole suite is skipped. Run with:
 *
 *   TEST_DATABASE_URL="postgresql://...@ep-xxx-pooler.<region>.aws.neon.tech/neondb?sslmode=require" \
 *     npm run test:integration --workspace=server
 *
 * The target branch must already have the frozen migrations applied. The suite
 * only inserts/deletes rows it creates, tagged with an "itest_" prefix, and
 * removes them in `after`.
 */

const PROTECTED_BRANCHES = [
  'br-delicate-butterfly-b4et73g9', // production
  'br-dawn-cherry-b4dnrhm5', // staging
  'br-long-king-b4s8l0yv', // recovery drill
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

async function cleanupUser(userId: number): Promise<void> {
  await db!.idempotencyKey.deleteMany({ where: { userId } })
  await db!.referralAttribution.deleteMany({ where: { referrerId: userId } })
  await db!.referralAttribution.deleteMany({ where: { referredUserId: userId } })
  await db!.ownedCeo.deleteMany({ where: { userId } })
  await db!.user.deleteMany({ where: { id: userId } })
}

before(async () => {
  if (!target.enabled) return

  pool = new Pool({ connectionString: target.url! })
  db = new PrismaClient({ adapter: new PrismaNeon(pool) })

  if (target.isNeon) {
    const rows = await db.$queryRaw<Array<{ branch: string | null }>>`
      SELECT current_setting('neon.branch_id', true) AS branch
    `
    const branch = rows[0]?.branch ?? ''
    if (!branch) {
      await db.$disconnect()
      throw new Error(
        'Refusing integration test: could not verify the Neon branch id (neon.branch_id is empty). Use an isolated test branch.',
      )
    }
    if (PROTECTED_BRANCHES.includes(branch)) {
      await db.$disconnect()
      throw new Error(`Refusing integration test: connected branch ${branch} is protected.`)
    }
  }

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
      },
      select: { id: true },
    })
    starterTemplateId = created.id
    createdFallbackTemplate = true
  }
})

after(async () => {
  if (!target.enabled) return
  if (createdFallbackTemplate && starterTemplateId !== null) {
    await db!.ownedCeo.deleteMany({ where: { templateId: starterTemplateId } })
    await db!.cEO.deleteMany({ where: { id: starterTemplateId } })
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
    const results = await Promise.all(
      Array.from({ length: 5 }, () => grantStarterCeo(db!, userId)),
    )
    assert.equal(new Set(results.map((r) => r.ownedCeoId)).size, 1)
    assert.equal(results.filter((r) => r.created).length, 1)

    assert.equal(await db!.ownedCeo.count({ where: { userId, acquisitionType: 'STARTER' } }), 1)
    assert.equal(await db!.idempotencyKey.count({ where: { userId, scope: 'starter_ceo' } }), 1)
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