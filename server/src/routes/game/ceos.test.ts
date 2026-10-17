import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { PrismaClient } from '@prisma/client'

process.env.JWT_SECRET ??= 'test-secret'
process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'

const { listOwnedCeosHandler, grantStarterCeoHandler } = await import('./ceos')

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
  maxOwned: number
}
interface OwnedRow {
  id: number
  userId: number
  templateId: number
  acquisitionType: Acq
  level: number
  status: string
  cycleLimit: number | null
  completedRewardCycles: number
  acquiredAt: Date
}

function unique(): never {
  const err = new Error('unique violation') as Error & { code?: string }
  err.code = 'P2002'
  throw err
}

class FakePrisma {
  templates: TemplateRow[] = []
  owned: OwnedRow[] = []
  idem: { id: number; userId: number; scope: string; key: string }[] = []
  private seq = 1

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

  ownedCeo = {
    findMany: async (args: any): Promise<Array<OwnedRow & { template: TemplateRow }>> => {
      const w = args?.where ?? {}
      return this.owned
        .filter((o) => w.userId === undefined || o.userId === w.userId)
        .map((o) => ({ ...o, template: this.templates.find((t) => t.id === o.templateId)! }))
    },
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
    create: async (args: any) => {
      const d = args.data
      if (this.idem.some((k) => k.userId === d.userId && k.scope === d.scope && k.key === d.key)) unique()
      const row = { id: this.seq++, userId: d.userId, scope: d.scope, key: d.key }
      this.idem.push(row)
      return row
    },
  }

  $transaction = async <T>(fn: (tx: FakePrisma) => Promise<T>): Promise<T> => fn(this)
}

function seed(f: FakePrisma): void {
  f.templates.push({
    id: 1,
    slug: 'intern-ceo',
    name: 'Intern CEO',
    rarity: 'Common',
    baseSpPerCycle: 10,
    energyCost: 2,
    cycleHours: 4,
    isStarter: true,
    isActive: true,
    maxOwned: 1,
  })
}

function mockRes() {
  const res: any = { statusCode: 200, body: undefined }
  res.status = (code: number) => {
    res.statusCode = code
    return res
  }
  res.json = (body: unknown) => {
    res.body = body
    return res
  }
  return res
}

function mockReq(userId: number, body: unknown = {}) {
  return { user: { id: userId, email: 'user@example.com', role: 'USER' }, body } as any
}

const asClient = (f: FakePrisma): PrismaClient => f as unknown as PrismaClient

test('owned handler returns only the authenticated user fleet', async () => {
  const f = new FakePrisma()
  seed(f)
  const client = asClient(f)
  await grantStarterCeoHandler(client)(mockReq(100), mockRes())
  const res = mockRes()
  await listOwnedCeosHandler(client)(mockReq(100), res)
  assert.equal(res.statusCode, 200)
  assert.equal(res.body.owned.length, 1)
  assert.equal(res.body.owned[0].templateSlug, 'intern-ceo')

  const other = mockRes()
  await listOwnedCeosHandler(client)(mockReq(200), other)
  assert.equal(other.body.owned.length, 0)
})

test('owned handler ignores a client-supplied userId in the body', async () => {
  const f = new FakePrisma()
  seed(f)
  const client = asClient(f)
  await grantStarterCeoHandler(client)(mockReq(100), mockRes())
  const res = mockRes()
  await listOwnedCeosHandler(client)(mockReq(100, { userId: 999 }), res)
  assert.equal(res.body.owned.length, 1)
  assert.equal(f.owned.filter((o) => o.userId === 999).length, 0)
})

test('starter handler creates once, replays idempotently, and never duplicates', async () => {
  const f = new FakePrisma()
  seed(f)
  const handler = grantStarterCeoHandler(asClient(f))

  const first = mockRes()
  await handler(mockReq(100), first)
  assert.equal(first.statusCode, 201)
  assert.equal(first.body.created, true)

  const replay = mockRes()
  await handler(mockReq(100), replay)
  assert.equal(replay.statusCode, 200)
  assert.equal(replay.body.created, false)
  assert.equal(first.body.ownedCeoId, replay.body.ownedCeoId)
  assert.equal(f.owned.filter((o) => o.acquisitionType === 'STARTER').length, 1)
})

test('starter handler returns 409 when the maxOwned capacity is already used', async () => {
  const f = new FakePrisma()
  seed(f)
  f.owned.push({
    id: 900,
    userId: 100,
    templateId: 1,
    acquisitionType: 'ADMIN',
    level: 1,
    cycleLimit: null,
    completedRewardCycles: 0,
    status: 'IDLE',
    acquiredAt: new Date(),
  })
  const res = mockRes()
  await grantStarterCeoHandler(asClient(f))(mockReq(100), res)
  assert.equal(res.statusCode, 409)
  assert.equal(res.body.error, 'ownership limit reached')
  assert.equal(f.owned.filter((o) => o.acquisitionType === 'STARTER').length, 0)
})

test('starter handler returns 503 when no active starter template exists', async () => {
  const f = new FakePrisma()
  const res = mockRes()
  await grantStarterCeoHandler(asClient(f))(mockReq(100), res)
  assert.equal(res.statusCode, 503)
})