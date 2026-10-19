import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { PrismaClient } from '@prisma/client'
import { AdminError } from './adminErrors'
import { setUserSuspension } from './adminUsers'
import {
  createCatalogEntry,
  deleteCatalogEntry,
  updateCatalogPresentation,
} from './adminCatalog'
import { updateSiteSettings } from './siteSettings'

interface UserRow {
  id: number
  username: string
  role: 'USER' | 'ADMIN'
  isSuspended: boolean
  suspendedAt: Date | null
  suspensionReason: string | null
}

interface CeoRow {
  id: number
  name: string
  slug: string
  rarity: string
  priceUsd: string
  dailyRatePercent: string
  nominalSpPer24h: number | null
  lifetimeCapSp: bigint | null
  cycleHours: number
  energyCost: number
  isActive: boolean
  isForSale: boolean
  category: string | null
  displayOrder: number
  imageUrl: string | null
  isStarter: boolean
  rewardEligible: boolean
  maxOwned: number
  createdAt: Date
  updatedAt: Date
}

function ceoRow(overrides: Partial<CeoRow>): CeoRow {
  return {
    id: 10,
    name: 'Intern',
    slug: 'intern',
    rarity: 'Common',
    priceUsd: '0.00',
    dailyRatePercent: '0.0000',
    nominalSpPer24h: 10,
    lifetimeCapSp: 40n,
    cycleHours: 4,
    energyCost: 2,
    isActive: true,
    isForSale: true,
    category: null,
    displayOrder: 0,
    imageUrl: null,
    isStarter: false,
    rewardEligible: false,
    maxOwned: 1,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  }
}

class FakePrisma {
  users: UserRow[] = [
    { id: 1, username: 'player', role: 'USER', isSuspended: false, suspendedAt: null, suspensionReason: null },
    { id: 2, username: 'boss', role: 'ADMIN', isSuspended: false, suspendedAt: null, suspensionReason: null },
  ]
  ceos: CeoRow[] = [ceoRow({ id: 10 })]
  owned: Array<{ templateId: number }> = [{ templateId: 10 }]
  audits: Array<{ actorId: number; action: string; targetType: string; targetId: string }> = []
  meta: Record<string, string> = {}
  private seq = 100

  user = {
    findUnique: async (args: any): Promise<UserRow | null> =>
      this.users.find((u) => u.id === args?.where?.id) ?? null,
    update: async (args: any): Promise<UserRow> => {
      const row = this.users.find((u) => u.id === args?.where?.id)!
      Object.assign(row, args.data)
      return row
    },
  }

  cEO = {
    findUnique: async (args: any): Promise<any> => {
      const w = args?.where ?? {}
      const row = w.id !== undefined ? this.ceos.find((c) => c.id === w.id) : this.ceos.find((c) => c.slug === w.slug)
      return row ?? null
    },
    update: async (args: any): Promise<CeoRow> => {
      const row = this.ceos.find((c) => c.id === args?.where?.id)!
      Object.assign(row, args.data)
      return row
    },
    create: async (args: any): Promise<CeoRow> => {
      const d = args.data
      const row = ceoRow({
        id: this.seq++,
        name: d.name,
        slug: d.slug,
        rarity: d.rarity,
        priceUsd: d.priceUsd,
        dailyRatePercent: d.dailyRatePercent,
        cycleHours: d.cycleHours,
        energyCost: d.energyCost,
        isActive: d.isActive,
        isForSale: d.isForSale,
        category: d.category ?? null,
        displayOrder: d.displayOrder ?? 0,
        imageUrl: d.imageUrl ?? null,
      })
      this.ceos.push(row)
      return row
    },
    delete: async (args: any): Promise<CeoRow> => {
      const idx = this.ceos.findIndex((c) => c.id === args?.where?.id)
      const [row] = this.ceos.splice(idx, 1)
      return row
    },
  }

  ownedCeo = {
    count: async (args: any): Promise<number> =>
      this.owned.filter((o) => o.templateId === args?.where?.templateId).length,
  }

  adminAuditLog = {
    create: async (args: any): Promise<unknown> => {
      const d = args.data
      this.audits.push({ actorId: d.actorId, action: d.action, targetType: d.targetType, targetId: d.targetId })
      return { id: this.seq++ }
    },
  }

  appMeta = {
    findMany: async (args: any): Promise<Array<{ key: string; value: string }>> => {
      const keys: string[] = args?.where?.key?.in ?? []
      return Object.entries(this.meta)
        .filter(([k]) => keys.includes(k))
        .map(([key, value]) => ({ key, value }))
    },
    upsert: async (args: any): Promise<unknown> => {
      this.meta[args.where.key] = args.create.value ?? args.update.value
      return { key: args.where.key, value: this.meta[args.where.key] }
    },
  }

  $transaction = async <T>(fn: (tx: FakePrisma) => Promise<T>): Promise<T> => fn(this)
}

const asClient = (f: FakePrisma): PrismaClient => f as unknown as PrismaClient

function expectCode(code: string) {
  return (error: unknown) => {
    assert.ok(error instanceof AdminError, `expected AdminError, got ${String(error)}`)
    assert.equal((error as AdminError).code, code)
    return true
  }
}

test('suspension requires explicit confirmation', async () => {
  const f = new FakePrisma()
  await assert.rejects(
    () => setUserSuspension(asClient(f), 2, 1, { suspend: true, confirm: false }),
    expectCode('confirmation_required'),
  )
})

test('admins cannot be suspended', async () => {
  const f = new FakePrisma()
  await assert.rejects(
    () => setUserSuspension(asClient(f), 2, 2, { suspend: true, confirm: true }),
    expectCode('cannot_suspend_admin'),
  )
})

test('suspend and reactivate update the account and audit the action', async () => {
  const f = new FakePrisma()
  const suspended = await setUserSuspension(asClient(f), 2, 1, { suspend: true, reason: 'abuse', confirm: true })
  assert.equal(suspended.isSuspended, true)
  assert.equal(f.users[0].suspensionReason, 'abuse')
  assert.equal(f.audits.at(-1)?.action, 'user.suspend')

  const reactivated = await setUserSuspension(asClient(f), 2, 1, { suspend: false, confirm: true })
  assert.equal(reactivated.isSuspended, false)
  assert.equal(f.users[0].suspendedAt, null)
  assert.equal(f.audits.at(-1)?.action, 'user.reactivate')
})

test('catalog update changes presentation fields only and audits', async () => {
  const f = new FakePrisma()
  const ceo = await updateCatalogPresentation(asClient(f), 2, 10, {
    name: 'Intern II',
    isForSale: false,
    imageUrl: 'https://cdn.example/intern.png',
  })
  assert.equal(ceo.name, 'Intern II')
  assert.equal(ceo.isForSale, false)
  assert.equal(f.audits.at(-1)?.action, 'catalog.update')
})

test('catalog create requires confirmation and starts hidden/not-for-sale', async () => {
  const f = new FakePrisma()
  const client = asClient(f)
  const base = {
    name: 'New Tier',
    slug: 'new-tier',
    rarity: 'Rare',
    priceUsd: '1.00',
    dailyRatePercent: '0.0100',
    cycleHours: 4,
    energyCost: 2,
    displayOrder: 0,
    confirmNewTier: false,
  }
  await assert.rejects(() => createCatalogEntry(client, 2, base), expectCode('confirmation_required'))

  const created = await createCatalogEntry(client, 2, { ...base, confirmNewTier: true })
  assert.equal(created.isActive, false)
  assert.equal(created.isForSale, false)
  assert.equal(f.audits.at(-1)?.action, 'catalog.create')
})

test('catalog delete is blocked while copies are owned', async () => {
  const f = new FakePrisma()
  await assert.rejects(() => deleteCatalogEntry(asClient(f), 2, 10, true), expectCode('owned_exists'))
  await assert.rejects(() => deleteCatalogEntry(asClient(f), 2, 10, false), expectCode('confirmation_required'))
})

test('catalog delete succeeds when no copies are owned', async () => {
  const f = new FakePrisma()
  f.owned = []
  const result = await deleteCatalogEntry(asClient(f), 2, 10, true)
  assert.equal(result.ok, true)
  assert.equal(f.ceos.length, 0)
  assert.equal(f.audits.at(-1)?.action, 'catalog.delete')
})

test('settings update merges sections, persists keys and audits', async () => {
  const f = new FakePrisma()
  const next = await updateSiteSettings(asClient(f), 2, {
    registrationEnabled: false,
    maintenance: { enabled: true },
    features: { wallet: false },
  })
  assert.equal(next.registrationEnabled, false)
  assert.equal(next.maintenance.enabled, true)
  assert.equal(next.features.wallet, false)
  assert.equal(next.features.market, true)
  assert.equal(f.meta['site.registrationEnabled'], 'false')
  assert.equal(f.audits.at(-1)?.action, 'settings.update')
})
