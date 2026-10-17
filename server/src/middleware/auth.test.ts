import { test } from 'node:test'
import assert from 'node:assert/strict'

process.env.JWT_SECRET ??= 'test-secret'
process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'

const { requireAuth, requireAdmin } = await import('./auth')

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

test('requireAuth rejects a request with no token cookie', async () => {
  const res = mockRes()
  let nextCalled = false
  await requireAuth({ cookies: {} } as any, res, () => {
    nextCalled = true
  })
  assert.equal(res.statusCode, 401)
  assert.equal(res.body.error, 'unauthenticated')
  assert.equal(nextCalled, false)
})

test('requireAuth rejects a malformed token without touching the database', async () => {
  const res = mockRes()
  let nextCalled = false
  await requireAuth({ cookies: { token: 'not-a-jwt' } } as any, res, () => {
    nextCalled = true
  })
  assert.equal(res.statusCode, 401)
  assert.equal(res.body.error, 'unauthenticated')
  assert.equal(nextCalled, false)
})

test('requireAdmin rejects an unauthenticated request', () => {
  const res = mockRes()
  let nextCalled = false
  requireAdmin({} as any, res, () => {
    nextCalled = true
  })
  assert.equal(res.statusCode, 401)
  assert.equal(nextCalled, false)
})

test('requireAdmin rejects a non-admin user', () => {
  const res = mockRes()
  let nextCalled = false
  requireAdmin({ user: { id: 1, email: 'u@example.com', role: 'USER' } } as any, res, () => {
    nextCalled = true
  })
  assert.equal(res.statusCode, 403)
  assert.equal(nextCalled, false)
})

test('requireAdmin allows an admin user', () => {
  const res = mockRes()
  let nextCalled = false
  requireAdmin({ user: { id: 1, email: 'a@example.com', role: 'ADMIN' } } as any, res, () => {
    nextCalled = true
  })
  assert.equal(nextCalled, true)
  assert.equal(res.statusCode, 200)
})