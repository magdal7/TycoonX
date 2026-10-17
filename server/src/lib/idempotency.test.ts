import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isUniqueViolation } from './idempotency'

test('isUniqueViolation detects Prisma P2002 only', () => {
  assert.equal(isUniqueViolation({ code: 'P2002' }), true)
  assert.equal(isUniqueViolation({ code: 'P2003' }), false)
  assert.equal(isUniqueViolation(new Error('boom')), false)
  assert.equal(isUniqueViolation(null), false)
  assert.equal(isUniqueViolation(undefined), false)
})
