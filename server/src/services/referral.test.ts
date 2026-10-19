import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { PrismaClient } from '@prisma/client'
import { attributeReferral } from './referral'

interface FakeUser {
  id: number
  username: string
}
interface FakeAttribution {
  id: number
  referrerId: number
  referredUserId: number
  code: string
}

class FakePrisma {
  users: FakeUser[] = []
  attributions: FakeAttribution[] = []
  private seq = 1

  user = {
    findFirst: async (args: any): Promise<{ id: number } | null> => {
      const where = args?.where?.username
      const equals = typeof where === 'object' && where ? where.equals : where
      const target = String(equals).toLowerCase()
      const row = this.users.find((u) => u.username.toLowerCase() === target)
      return row ? { id: row.id } : null
    },
  }

  referralAttribution = {
    create: async (args: any): Promise<{ id: number }> => {
      const d = args.data
      if (this.attributions.some((a) => a.referredUserId === d.referredUserId)) {
        const err = new Error('unique violation') as Error & { code?: string }
        err.code = 'P2002'
        throw err
      }
      const row: FakeAttribution = { id: this.seq++, ...d }
      this.attributions.push(row)
      return { id: row.id }
    },
  }
}

const asClient = (f: FakePrisma): PrismaClient => f as unknown as PrismaClient

test('attributeReferral ignores a missing or blank code', async () => {
  const f = new FakePrisma()
  assert.equal((await attributeReferral(asClient(f), { referredUserId: 2, code: undefined })).reason, 'no_code')
  assert.equal((await attributeReferral(asClient(f), { referredUserId: 2, code: '   ' })).reason, 'no_code')
  assert.equal(f.attributions.length, 0)
})

test('attributeReferral reports an unknown referrer without writing', async () => {
  const f = new FakePrisma()
  const result = await attributeReferral(asClient(f), { referredUserId: 2, code: 'ghost' })
  assert.equal(result.attributed, false)
  assert.equal(result.reason, 'referrer_not_found')
  assert.equal(f.attributions.length, 0)
})

test('attributeReferral rejects a code equal to the new username (self-referral)', async () => {
  const f = new FakePrisma()
  const result = await attributeReferral(asClient(f), {
    referredUserId: 5,
    referredUsername: 'Founder',
    code: 'founder',
  })
  assert.equal(result.reason, 'self_referral')
  assert.equal(f.attributions.length, 0)
})

test('attributeReferral rejects a code resolving to the referred user id', async () => {
  const f = new FakePrisma()
  f.users.push({ id: 7, username: 'selfy' })
  const result = await attributeReferral(asClient(f), { referredUserId: 7, referredUsername: 'other', code: 'selfy' })
  assert.equal(result.reason, 'self_referral')
  assert.equal(f.attributions.length, 0)
})

test('attributeReferral stores valid attribution case-insensitively', async () => {
  const f = new FakePrisma()
  f.users.push({ id: 1, username: 'Alice' })
  const result = await attributeReferral(asClient(f), {
    referredUserId: 2,
    referredUsername: 'Bob',
    code: 'alice',
    signupIpHash: 'iphash',
  })
  assert.equal(result.attributed, true)
  assert.equal(result.reason, 'attributed')
  const row = f.attributions[0] as unknown as { referrerId: number; referredUserId: number; code: string; status: string; signupIpHash: string }
  assert.equal(row.referrerId, 1)
  assert.equal(row.referredUserId, 2)
  assert.equal(row.code, 'alice')
  assert.equal(row.status, 'PENDING')
  assert.equal(row.signupIpHash, 'iphash')
})

test('attributeReferral reports already-attributed on a duplicate referred user', async () => {
  const f = new FakePrisma()
  f.users.push({ id: 1, username: 'Alice' })
  await attributeReferral(asClient(f), { referredUserId: 2, code: 'alice' })
  const again = await attributeReferral(asClient(f), { referredUserId: 2, code: 'alice' })
  assert.equal(again.attributed, false)
  assert.equal(again.reason, 'already_attributed')
  assert.equal(f.attributions.length, 1)
})
