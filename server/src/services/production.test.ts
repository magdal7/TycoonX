import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { PrismaClient } from '@prisma/client'
import { startProduction, collectProduction, upgradeEquipment, ProductionError } from './production'
import { InsufficientSpError } from './spLedger'

type Acq = 'STARTER' | 'PURCHASE' | 'MISSION' | 'REWARD' | 'ADMIN'

interface Template {
  id: number
  nominalSpPer24h: number | null
  baseSpPerCycle: number | null
  lifetimeCapSp: number | null
}
interface Owned {
  id: number
  userId: number
  templateId: number
  acquisitionType: Acq
  status: string
  equipment: string
  lifetimeEarnedSp: bigint
  archivedAt: Date | null
}
interface Cycle {
  id: bigint
  userId: number
  ownedCeoId: number
  status: string
  startsAt: Date
  endsAt: Date
  nominalSpPer24hSnap: number
  equipmentSnap: string
  cycleHoursSnap: number
  rewardSpSnap: bigint
  lifetimeCapSnap: bigint
  claimedAt: Date | null
}
interface SpAcct {
  userId: number
  earnedSp: bigint
  bonusSp: bigint
  lifetimeEarnedSp: bigint
  version: number
}
interface Ledger {
  id: number
  userId: number
  bucket: string
  amountSp: bigint
  sourceType: string
  sourceId: bigint | null
}
interface Idem { userId: number; scope: string; key: string }
interface Progress { userId: number; xp: number; level: number }

function unique(): never {
  const err = new Error('unique violation') as Error & { code?: string }
  err.code = 'P2002'
  throw err
}

const inc = (value: bigint, delta: unknown): bigint =>
  value + (typeof delta === 'object' && delta && 'increment' in delta ? BigInt((delta as any).increment) : 0n)

class FakePrisma {
  templates: Template[] = []
  owned: Owned[] = []
  cycles: Cycle[] = []
  accounts: SpAcct[] = []
  ledger: Ledger[] = []
  idem: Idem[] = []
  progress: Progress[] = []
  private seq = 1
  private cycleSeq = 1000n

  cEO = {}

  ownedCeo = {
    findFirst: async (args: any): Promise<(Owned & { template: Template }) | null> => {
      const w = args?.where ?? {}
      const row = this.owned.find((o) => o.id === w.id && o.userId === w.userId)
      if (!row) return null
      return { ...row, template: this.templates.find((t) => t.id === row.templateId)! }
    },
    findUniqueOrThrow: async (args: any): Promise<Owned> => {
      const row = this.owned.find((o) => o.id === args?.where?.id)
      if (!row) throw new Error('not found')
      return row
    },
    update: async (args: any): Promise<Owned> => {
      const row = this.owned.find((o) => o.id === args?.where?.id)!
      Object.assign(row, args.data)
      return row
    },
  }

  productionCycle = {
    findFirst: async (args: any): Promise<Cycle | null> => {
      const w = args?.where ?? {}
      let rows = this.cycles.filter(
        (c) =>
          (w.ownedCeoId === undefined || c.ownedCeoId === w.ownedCeoId) &&
          (w.userId === undefined || c.userId === w.userId) &&
          (w.status === undefined || c.status === w.status),
      )
      if (args?.orderBy?.claimedAt === 'desc') {
        rows = [...rows].sort((a, b) => (b.claimedAt?.getTime() ?? 0) - (a.claimedAt?.getTime() ?? 0))
      }
      return rows[0] ?? null
    },
    create: async (args: any): Promise<Cycle> => {
      const d = args.data
      const row: Cycle = {
        id: this.cycleSeq++,
        userId: d.userId,
        ownedCeoId: d.ownedCeoId,
        status: d.status,
        startsAt: d.startsAt,
        endsAt: d.endsAt,
        nominalSpPer24hSnap: d.nominalSpPer24hSnap,
        equipmentSnap: d.equipmentSnap,
        cycleHoursSnap: d.cycleHoursSnap,
        rewardSpSnap: d.rewardSpSnap,
        lifetimeCapSnap: d.lifetimeCapSnap,
        claimedAt: null,
      }
      // Partial unique index: one open (PRODUCING) cycle per owned copy.
      if (row.status === 'PRODUCING' && this.cycles.some((c) => c.ownedCeoId === row.ownedCeoId && c.status === 'PRODUCING')) {
        unique()
      }
      this.cycles.push(row)
      return row
    },
    updateMany: async (args: any): Promise<{ count: number }> => {
      const w = args?.where ?? {}
      const hits = this.cycles.filter((c) => c.id === w.id && (w.status === undefined || c.status === w.status))
      for (const c of hits) Object.assign(c, args.data)
      return { count: hits.length }
    },
  }

  spAccount = {
    findUnique: async (args: any): Promise<SpAcct | null> =>
      this.accounts.find((a) => a.userId === args?.where?.userId) ?? null,
    findUniqueOrThrow: async (args: any): Promise<SpAcct> => {
      const row = this.accounts.find((a) => a.userId === args?.where?.userId)
      if (!row) throw new Error('not found')
      return row
    },
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
        row.earnedSp = inc(row.earnedSp, args.update.earnedSp)
        row.bonusSp = inc(row.bonusSp, args.update.bonusSp)
        row.lifetimeEarnedSp = inc(row.lifetimeEarnedSp, args.update.lifetimeEarnedSp)
        if (args.update.version?.increment) row.version += args.update.version.increment
      }
      return row
    },
    updateMany: async (args: any): Promise<{ count: number }> => {
      const w = args?.where ?? {}
      const row = this.accounts.find((a) => a.userId === w.userId)
      if (!row) return { count: 0 }
      if (w.bonusSp && row.bonusSp < BigInt(w.bonusSp.gte)) return { count: 0 }
      if (w.earnedSp && row.earnedSp < BigInt(w.earnedSp.gte)) return { count: 0 }
      if (args.data.bonusSp?.decrement) row.bonusSp -= BigInt(args.data.bonusSp.decrement)
      if (args.data.earnedSp?.decrement) row.earnedSp -= BigInt(args.data.earnedSp.decrement)
      if (args.data.version?.increment) row.version += args.data.version.increment
      return { count: 1 }
    },
  }

  spLedgerEntry = {
    create: async (args: any): Promise<Ledger> => {
      const d = args.data
      if (
        d.sourceId !== null &&
        d.sourceId !== undefined &&
        this.ledger.some(
          (l) => l.userId === d.userId && l.sourceType === d.sourceType && l.sourceId === d.sourceId && l.bucket === d.bucket,
        )
      ) {
        unique()
      }
      const row: Ledger = {
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

  progressAccount = {
    findUnique: async (args: any): Promise<Progress | null> =>
      this.progress.find((p) => p.userId === args?.where?.userId) ?? null,
    upsert: async (args: any): Promise<Progress> => {
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
    update: async (args: any): Promise<Progress> => {
      const row = this.progress.find((p) => p.userId === args?.where?.userId)!
      Object.assign(row, args.data)
      return row
    },
  }

  taskEvent = {
    create: async (_args: any): Promise<{ id: number }> => ({ id: this.seq++ }),
  }

  idempotencyKey = {
    create: async (args: any): Promise<Idem> => {
      const d = args.data
      if (this.idem.some((k) => k.userId === d.userId && k.scope === d.scope && k.key === d.key)) unique()
      const row = { userId: d.userId, scope: d.scope, key: d.key }
      this.idem.push(row)
      return row
    },
  }

  $transaction = async <T>(fn: (tx: FakePrisma) => Promise<T>): Promise<T> => fn(this)
}

function seed(f: FakePrisma): void {
  f.templates.push({ id: 1, nominalSpPer24h: 10, baseSpPerCycle: 10, lifetimeCapSp: 40 })
  f.owned.push({
    id: 1,
    userId: 100,
    templateId: 1,
    acquisitionType: 'STARTER',
    status: 'IDLE',
    equipment: 'STANDARD',
    lifetimeEarnedSp: 0n,
    archivedAt: null,
  })
}

const asClient = (f: FakePrisma): PrismaClient => f as unknown as PrismaClient

test('start creates a PRODUCING cycle with the snapshot reward', async () => {
  const f = new FakePrisma()
  seed(f)
  const { cycle, replayed } = await startProduction(asClient(f), 100, 1)
  assert.equal(replayed, false)
  assert.equal(cycle.rewardSp, '1') // floor(10 * 4 / 24)
  assert.equal(cycle.cycleHours, 4)
  assert.equal(f.owned[0].status, 'PRODUCING')
  assert.equal(f.cycles.length, 1)
})

test('a second start while producing is rejected', async () => {
  const f = new FakePrisma()
  seed(f)
  await startProduction(asClient(f), 100, 1)
  await assert.rejects(() => startProduction(asClient(f), 100, 1), (e: unknown) => {
    assert.ok(e instanceof ProductionError)
    assert.equal((e as ProductionError).code, 'already_producing')
    return true
  })
  assert.equal(f.cycles.length, 1)
})

test('collect before the cycle ends is rejected', async () => {
  const f = new FakePrisma()
  seed(f)
  await startProduction(asClient(f), 100, 1)
  await assert.rejects(() => collectProduction(asClient(f), 100, 1), (e: unknown) => {
    assert.equal((e as ProductionError).code, 'not_ready')
    return true
  })
  assert.equal(f.accounts.length, 0)
})

test('collect credits exactly once and returns the copy to IDLE', async () => {
  const f = new FakePrisma()
  seed(f)
  await startProduction(asClient(f), 100, 1)
  f.cycles[0].endsAt = new Date(Date.now() - 1000)

  const first = await collectProduction(asClient(f), 100, 1)
  assert.equal(first.rewardSp, '1')
  assert.equal(first.alreadyCollected, false)
  assert.equal(first.status, 'IDLE')
  assert.equal(f.accounts[0].earnedSp, 1n)
  assert.equal(f.owned[0].status, 'IDLE')
  assert.equal(f.ledger.filter((l) => l.sourceType === 'CYCLE_CLAIM').length, 1)

  const replay = await collectProduction(asClient(f), 100, 1)
  assert.equal(replay.alreadyCollected, true)
  assert.equal(f.accounts[0].earnedSp, 1n)
  assert.equal(f.ledger.filter((l) => l.sourceType === 'CYCLE_CLAIM').length, 1)
})

test('reaching the lifetime cap archives the copy and blocks further starts', async () => {
  const f = new FakePrisma()
  seed(f)
  f.owned[0].lifetimeEarnedSp = 39n // cap is 40; next 1 SP collection exhausts it
  await startProduction(asClient(f), 100, 1)
  f.cycles[0].endsAt = new Date(Date.now() - 1000)
  const result = await collectProduction(asClient(f), 100, 1)
  assert.equal(result.status, 'EXHAUSTED')
  assert.equal(f.owned[0].status, 'EXHAUSTED')
  assert.ok(f.owned[0].archivedAt)
  await assert.rejects(() => startProduction(asClient(f), 100, 1), (e: unknown) => {
    assert.equal((e as ProductionError).code, 'exhausted')
    return true
  })
})

test('an owned copy whose cap is already reached cannot start', async () => {
  const f = new FakePrisma()
  seed(f)
  f.owned[0].lifetimeEarnedSp = 40n
  await assert.rejects(() => startProduction(asClient(f), 100, 1), (e: unknown) => {
    assert.equal((e as ProductionError).code, 'exhausted')
    return true
  })
})

test('equipment upgrade spends Bonus SP first and advances the tier', async () => {
  const f = new FakePrisma()
  seed(f)
  f.accounts.push({ userId: 100, earnedSp: 1000n, bonusSp: 600n, lifetimeEarnedSp: 1000n, version: 0 })
  f.progress.push({ userId: 100, xp: 0, level: 5 })
  const result = await upgradeEquipment(asClient(f), 100, 1, 'EXTENDED')
  assert.equal(result.equipment, 'EXTENDED')
  assert.equal(f.owned[0].equipment, 'EXTENDED')
  assert.equal(f.accounts[0].bonusSp, 100n) // 600 - 500
  assert.equal(f.accounts[0].earnedSp, 1000n) // untouched
  assert.equal(f.ledger.filter((l) => l.sourceType === 'EQUIPMENT_PURCHASE' && l.bucket === 'BONUS').length, 1)
})

test('equipment upgrade is blocked below the required player level', async () => {
  const f = new FakePrisma()
  seed(f)
  f.accounts.push({ userId: 100, earnedSp: 5000n, bonusSp: 0n, lifetimeEarnedSp: 5000n, version: 0 })
  f.progress.push({ userId: 100, xp: 0, level: 1 })
  await assert.rejects(() => upgradeEquipment(asClient(f), 100, 1, 'EXTENDED'), (e: unknown) => {
    assert.equal((e as ProductionError).code, 'not_ready')
    return true
  })
})

test('equipment upgrade rejects an insufficient SP balance', async () => {
  const f = new FakePrisma()
  seed(f)
  f.accounts.push({ userId: 100, earnedSp: 10n, bonusSp: 0n, lifetimeEarnedSp: 10n, version: 0 })
  f.progress.push({ userId: 100, xp: 0, level: 5 })
  await assert.rejects(() => upgradeEquipment(asClient(f), 100, 1, 'EXTENDED'), InsufficientSpError)
})
