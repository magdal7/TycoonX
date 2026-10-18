import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { PrismaClient } from '@prisma/client'
import { grantStarterCeo } from './starterCeo'
import { attributeReferral } from './referral'
import { listOwnedCeos, countOwnedByTemplate, assertOwnershipCapacity, OwnershipLimitError } from './ownership'
import { findRegistrationConflict } from './registration'

type Acq = 'STARTER' | 'PURCHASE' | 'MISSION' | 'REWARD' | 'ADMIN'

interface TemplateRow {
  id: number
  slug: string
  name: string
  rarity: string
  baseSpPerCycle: number | null
  nominalSpPer24h: number | null
  lifetimeCapSp: number | null
  priceUsd: number
  energyCost: number
  cycleHours: number
  isStarter: boolean
  isActive: boolean
  maxOwned: number
}
interface UserRow { id: number; username: string; email: string }
interface OwnedRow {
  id: number
  userId: number
  templateId: number
  acquisitionType: Acq
  level: number
  cycleLimit: number | null
  completedRewardCycles: number
  status: string
  equipment: string
  lifetimeEarnedSp: bigint
  archivedAt: Date | null
  acquiredAt: Date
}
interface ReferralRow { id: number; referrerId: number; referredUserId: number; code: string }
interface IdemRow { id: number; userId: number; scope: string; key: string }

function unique(): never {
  const err = new Error('unique violation') as Error & { code?: string }
  err.code = 'P2002'
  throw err
}

class FakePrisma {
  templates: TemplateRow[] = []
  users: UserRow[] = []
  owned: OwnedRow[] = []
  referrals: ReferralRow[] = []
  idem: IdemRow[] = []
  private seq = 1
  private queue: Promise<unknown> = Promise.resolve()

  cEO = {
    findFirst: async (args: any): Promise<TemplateRow | null> => {
      const w = args?.where ?? {}
      const rows = this.templates.filter(
        (t) =>
          (w.isStarter === undefined || t.isStarter === w.isStarter) &&
          (w.isActive === undefined || t.isActive === w.isActive),
      )
      if (args?.orderBy?.id === 'asc') rows.sort((a, b) => a.id - b.id)
      return rows[0] ?? null
    },
  }

  user = {
    findUnique: async (args: any): Promise<UserRow | null> => {
      return this.users.find((u) => u.username === args?.where?.username) ?? null
    },
    findFirst: async (args: any): Promise<UserRow | null> => {
      const w = args?.where ?? {}
      const match = this.users.find((u) => {
        if (w.username) {
          const { equals, mode } = w.username as { equals: string; mode?: string }
          const a = mode === 'insensitive' ? u.username.toLowerCase() : u.username
          const b = mode === 'insensitive' ? equals.toLowerCase() : equals
          if (a !== b) return false
        }
        if (w.email) {
          const { equals, mode } = w.email as { equals: string; mode?: string }
          const a = mode === 'insensitive' ? u.email.toLowerCase() : u.email
          const b = mode === 'insensitive' ? equals.toLowerCase() : equals
          if (a !== b) return false
        }
        return true
      })
      return match ?? null
    },
  }

  ownedCeo = {
    findFirst: async (args: any): Promise<OwnedRow | null> => {
      const w = args?.where ?? {}
      return (
        this.owned.find(
          (o) =>
            (w.userId === undefined || o.userId === w.userId) &&
            (w.acquisitionType === undefined || o.acquisitionType === w.acquisitionType),
        ) ?? null
      )
    },
    findMany: async (args: any): Promise<Array<OwnedRow & { template: TemplateRow; cycles: any[] }>> => {
      const w = args?.where ?? {}
      return this.owned
        .filter((o) => w.userId === undefined || o.userId === w.userId)
        .map((o) => ({ ...o, template: this.templates.find((t) => t.id === o.templateId)!, cycles: [] }))
    },
    count: async (args: any): Promise<number> => {
      const w = args?.where ?? {}
      return this.owned.filter(
        (o) =>
          (w.userId === undefined || o.userId === w.userId) &&
          (w.templateId === undefined || o.templateId === w.templateId),
      ).length
    },
    create: async (args: any): Promise<OwnedRow> => {
      const d = args.data
      if (
        d.acquisitionType === 'STARTER' &&
        this.owned.some((o) => o.userId === d.userId && o.acquisitionType === 'STARTER')
      ) {
        unique()
      }
      const row: OwnedRow = {
        id: this.seq++,
        userId: d.userId,
        templateId: d.templateId,
        acquisitionType: d.acquisitionType,
        level: 1,
        cycleLimit: null,
        completedRewardCycles: 0,
        status: d.status ?? 'IDLE',
        equipment: 'STANDARD',
        lifetimeEarnedSp: BigInt(0),
        archivedAt: null,
        acquiredAt: new Date(),
      }
      this.owned.push(row)
      return row
    },
  }

  idempotencyKey = {
    create: async (args: any): Promise<IdemRow> => {
      const d = args.data
      if (this.idem.some((k) => k.userId === d.userId && k.scope === d.scope && k.key === d.key)) unique()
      const row: IdemRow = { id: this.seq++, userId: d.userId, scope: d.scope, key: d.key }
      this.idem.push(row)
      return row
    },
  }

  referralAttribution = {
    create: async (args: any): Promise<ReferralRow> => {
      const d = args.data
      if (this.referrals.some((r) => r.referredUserId === d.referredUserId)) unique()
      const row: ReferralRow = {
        id: this.seq++,
        referrerId: d.referrerId,
        referredUserId: d.referredUserId,
        code: d.code,
      }
      this.referrals.push(row)
      return row
    },
  }

  $transaction = async <T>(fn: (tx: FakePrisma) => Promise<T>): Promise<T> => {
    const run = this.queue.then(async () => {
      const snapshot = {
        owned: [...this.owned],
        referrals: [...this.referrals],
        idem: [...this.idem],
        seq: this.seq,
      }
      try {
        return await fn(this)
      } catch (error) {
        this.owned = snapshot.owned
        this.referrals = snapshot.referrals
        this.idem = snapshot.idem
        this.seq = snapshot.seq
        throw error
      }
    })
    this.queue = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }
}

function seed(f: FakePrisma): void {
  f.templates.push(
    {
      id: 1,
      slug: 'intern-ceo',
      name: 'Intern CEO',
      rarity: 'Common',
      baseSpPerCycle: 10,
      nominalSpPer24h: 10,
      lifetimeCapSp: 40,
      priceUsd: 0,
      energyCost: 2,
      cycleHours: 4,
      isStarter: true,
      isActive: true,
      maxOwned: 1,
    },
    {
      id: 2,
      slug: 'junior-developer',
      name: 'Junior Developer',
      rarity: 'Common',
      baseSpPerCycle: 20,
      nominalSpPer24h: 100,
      lifetimeCapSp: 1200,
      priceUsd: 5,
      energyCost: 10,
      cycleHours: 4,
      isStarter: false,
      isActive: true,
      maxOwned: 2,
    },
  )
  f.users.push(
    { id: 100, username: 'alice', email: 'alice@example.com' },
    { id: 200, username: 'Bob', email: 'bob@example.com' },
  )
}

const asClient = (f: FakePrisma): PrismaClient => f as unknown as PrismaClient

test('starter grant is exactly-once under concurrent retries', async () => {
  const f = new FakePrisma()
  seed(f)
  const [a, b] = await Promise.all([grantStarterCeo(asClient(f), 100), grantStarterCeo(asClient(f), 100)])
  const starters = f.owned.filter((o) => o.userId === 100 && o.acquisitionType === 'STARTER')
  assert.equal(starters.length, 1)
  assert.equal(a.ownedCeoId, b.ownedCeoId)
  assert.equal([a.created, b.created].filter(Boolean).length, 1)
})

test('subsequent starter grant is idempotent', async () => {
  const f = new FakePrisma()
  seed(f)
  const first = await grantStarterCeo(asClient(f), 100)
  const second = await grantStarterCeo(asClient(f), 100)
  assert.equal(first.created, true)
  assert.equal(second.created, false)
  assert.equal(first.ownedCeoId, second.ownedCeoId)
  assert.equal(f.owned.filter((o) => o.acquisitionType === 'STARTER').length, 1)
})

test('starter grant fails without a configured starter template', async () => {
  const f = new FakePrisma()
  f.users.push({ id: 1, username: 'x', email: 'x@example.com' })
  await assert.rejects(() => grantStarterCeo(asClient(f), 1), /starter CEO template/)
})

test('referral: blank code is ignored', async () => {
  const f = new FakePrisma()
  seed(f)
  const r = await attributeReferral(asClient(f), { referredUserId: 200, code: '   ' })
  assert.equal(r.attributed, false)
  assert.equal(r.reason, 'no_code')
})

test('referral: unknown referrer', async () => {
  const f = new FakePrisma()
  seed(f)
  const r = await attributeReferral(asClient(f), { referredUserId: 200, code: 'ghost' })
  assert.equal(r.attributed, false)
  assert.equal(r.reason, 'referrer_not_found')
})

test('referral: self-referral rejected', async () => {
  const f = new FakePrisma()
  seed(f)
  const r = await attributeReferral(asClient(f), { referredUserId: 100, code: 'alice' })
  assert.equal(r.attributed, false)
  assert.equal(r.reason, 'self_referral')
})

test('referral: valid attribution then duplicate rejected', async () => {
  const f = new FakePrisma()
  seed(f)
  const r1 = await attributeReferral(asClient(f), { referredUserId: 200, code: 'alice' })
  assert.equal(r1.attributed, true)
  assert.equal(r1.reason, 'attributed')
  const r2 = await attributeReferral(asClient(f), { referredUserId: 200, code: 'alice' })
  assert.equal(r2.attributed, false)
  assert.equal(r2.reason, 'already_attributed')
  assert.equal(f.referrals.length, 1)
})

test('ownership read maps template economy fields', async () => {
  const f = new FakePrisma()
  seed(f)
  const client = asClient(f)
  await grantStarterCeo(client, 100)
  const list = await listOwnedCeos(client, 100)
  assert.equal(list.length, 1)
  assert.equal(list[0].templateSlug, 'intern-ceo')
  assert.equal(list[0].baseSpPerCycle, 10)
  assert.equal(list[0].acquisitionType, 'STARTER')
  assert.equal(await countOwnedByTemplate(client, 100, 1), 1)
  assert.equal(await countOwnedByTemplate(client, 100, 2), 0)
})

test('referral resolves the referrer case-insensitively', async () => {
  const f = new FakePrisma()
  seed(f)
  const r = await attributeReferral(asClient(f), { referredUserId: 200, code: 'ALICE' })
  assert.equal(r.attributed, true)
  assert.equal(f.referrals[0].referrerId, 100)
})

test('referral resolves a mixed-case stored username from a lower-case code', async () => {
  const f = new FakePrisma()
  seed(f)
  const r = await attributeReferral(asClient(f), { referredUserId: 100, code: 'bob' })
  assert.equal(r.attributed, true)
  assert.equal(f.referrals[0].referrerId, 200)
})

test('registration conflict: case-insensitive username', async () => {
  const f = new FakePrisma()
  seed(f)
  assert.equal(
    await findRegistrationConflict(asClient(f), { email: 'new@example.com', username: 'ALICE' }),
    'username',
  )
})

test('registration conflict: case-insensitive email', async () => {
  const f = new FakePrisma()
  seed(f)
  assert.equal(
    await findRegistrationConflict(asClient(f), { email: 'ALICE@example.com', username: 'fresh' }),
    'email',
  )
})

test('registration conflict: none for a new identity', async () => {
  const f = new FakePrisma()
  seed(f)
  assert.equal(
    await findRegistrationConflict(asClient(f), { email: 'new@example.com', username: 'fresh' }),
    null,
  )
})

test('multiple owned CEO copies are listed individually', async () => {
  const f = new FakePrisma()
  seed(f)
  const client = asClient(f)
  await grantStarterCeo(client, 100)
  await f.ownedCeo.create({
    data: { userId: 100, templateId: 2, acquisitionType: 'PURCHASE', status: 'IDLE' },
  })
  const list = await listOwnedCeos(client, 100)
  assert.equal(list.length, 2)
  assert.equal(list.filter((o) => o.acquisitionType === 'STARTER').length, 1)
  assert.equal(await countOwnedByTemplate(client, 100, 2), 1)
})

test('ownership capacity is enforced against the template maxOwned', async () => {
  const f = new FakePrisma()
  seed(f)
  const client = asClient(f)
  await grantStarterCeo(client, 100)

  await assert.rejects(
    () => assertOwnershipCapacity(client, 100, { id: 1, maxOwned: 1 }),
    OwnershipLimitError,
  )
  await assertOwnershipCapacity(client, 100, { id: 2, maxOwned: 2 })
  await f.ownedCeo.create({
    data: { userId: 100, templateId: 2, acquisitionType: 'PURCHASE', status: 'IDLE' },
  })
  await f.ownedCeo.create({
    data: { userId: 100, templateId: 2, acquisitionType: 'PURCHASE', status: 'IDLE' },
  })
  await assert.rejects(
    () => assertOwnershipCapacity(client, 100, { id: 2, maxOwned: 2 }),
    (error: unknown) => {
      assert.ok(error instanceof OwnershipLimitError)
      assert.equal(error.templateId, 2)
      assert.equal(error.maxOwned, 2)
      return true
    },
  )
})

test('starter provisioning respects maxOwned when capacity is exhausted', async () => {
  const f = new FakePrisma()
  seed(f)
  f.owned.push({
    id: 500,
    userId: 100,
    templateId: 1,
    acquisitionType: 'ADMIN',
    level: 1,
    cycleLimit: null,
    completedRewardCycles: 0,
    status: 'IDLE',
    equipment: 'STANDARD',
    lifetimeEarnedSp: BigInt(0),
    archivedAt: null,
    acquiredAt: new Date(),
  })
  await assert.rejects(() => grantStarterCeo(asClient(f), 100), OwnershipLimitError)
  assert.equal(f.owned.filter((o) => o.userId === 100 && o.acquisitionType === 'STARTER').length, 0)
})

test('starter grant is scoped per user and does not leak across users', async () => {
  const f = new FakePrisma()
  seed(f)
  const client = asClient(f)
  const a = await grantStarterCeo(client, 100)
  const b = await grantStarterCeo(client, 200)
  assert.equal(a.ownedCeoId === b.ownedCeoId, false)
  assert.equal(f.owned.filter((o) => o.acquisitionType === 'STARTER').length, 2)
  const listA = await listOwnedCeos(client, 100)
  const listB = await listOwnedCeos(client, 200)
  assert.equal(listA.length, 1)
  assert.equal(listB.length, 1)
  assert.equal(listA[0].id, a.ownedCeoId)
  assert.equal(listB[0].id, b.ownedCeoId)
})

test('starter grant replays when the capacity count sees a concurrent STARTER (READ COMMITTED interleaving)', async () => {
  const concurrent = { id: 777, templateId: 1 }
  const calls: string[] = []
  let starterLookups = 0

  const client = {
    cEO: { findFirst: async () => ({ id: 1, maxOwned: 1 }) },
    ownedCeo: {
      findFirst: async () => {
        starterLookups += 1
        // First lookup (pre-claim existence check) misses; the later lookup
        // (inside the capacity conflict) sees the concurrently committed row.
        return starterLookups === 1 ? null : concurrent
      },
      count: async () => {
        calls.push('count')
        return 1
      },
      create: async () => {
        throw new Error('must not create when a concurrent STARTER already exists')
      },
    },
    idempotencyKey: {
      create: async () => {
        calls.push('claim')
        return { id: 1 }
      },
    },
    $transaction: async <T>(fn: (tx: unknown) => Promise<T>): Promise<T> => fn(client),
  } as unknown as PrismaClient

  const result = await grantStarterCeo(client, 100)
  assert.equal(result.created, false)
  assert.equal(result.ownedCeoId, concurrent.id)
  // The idempotency claim must precede the capacity check (serialization point).
  assert.deepEqual(calls, ['claim', 'count'])
})

test('a failed provisioning transaction leaves no starter and no idempotency row', async () => {
  const f = new FakePrisma()
  seed(f)
  await assert.rejects(() =>
    f.$transaction(async (tx) => {
      await tx.ownedCeo.create({
        data: { userId: 100, templateId: 1, acquisitionType: 'STARTER', status: 'IDLE' },
      })
      await tx.idempotencyKey.create({
        data: { userId: 100, scope: 'starter_ceo', key: 'v1' },
      })
      throw new Error('forced failure')
    }),
  )
  assert.equal(f.owned.length, 0)
  assert.equal(f.idem.length, 0)
})
