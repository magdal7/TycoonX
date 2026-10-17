import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { PrismaClient } from '@prisma/client'
import { grantStarterCeo } from './starterCeo'
import { attributeReferral } from './referral'
import { listOwnedCeos, countOwnedByTemplate } from './ownership'

type Acq = 'STARTER' | 'PURCHASE' | 'MISSION' | 'REWARD' | 'ADMIN'

interface TemplateRow {
  id: number
  slug: string
  name: string
  rarity: string
  baseSpPerCycle: number | null
  energyCost: number
  cycleHours: number
  isStarter: boolean
  isActive: boolean
}
interface UserRow { id: number; username: string }
interface OwnedRow {
  id: number
  userId: number
  templateId: number
  acquisitionType: Acq
  level: number
  cycleLimit: number | null
  completedRewardCycles: number
  status: string
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
    findMany: async (args: any): Promise<Array<OwnedRow & { template: TemplateRow }>> => {
      const w = args?.where ?? {}
      return this.owned
        .filter((o) => w.userId === undefined || o.userId === w.userId)
        .map((o) => ({ ...o, template: this.templates.find((t) => t.id === o.templateId)! }))
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
    const run = this.queue.then(() => fn(this))
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
      energyCost: 2,
      cycleHours: 4,
      isStarter: true,
      isActive: true,
    },
    {
      id: 2,
      slug: 'junior-developer',
      name: 'Junior Developer',
      rarity: 'Common',
      baseSpPerCycle: 20,
      energyCost: 10,
      cycleHours: 4,
      isStarter: false,
      isActive: true,
    },
  )
  f.users.push({ id: 100, username: 'alice' }, { id: 200, username: 'bob' })
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
  f.users.push({ id: 1, username: 'x' })
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
