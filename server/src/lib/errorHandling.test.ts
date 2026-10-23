import 'express-async-errors'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { installErrorHandling } from './errorHandling'

test('an async route rejection returns 500 JSON and does not crash the process', async () => {
  const app = express()
  app.get('/boom', async () => {
    throw new Error('boom — must not leak to the client')
  })
  installErrorHandling(app)

  const server = app.listen(0)
  const address = server.address()
  if (address === null || typeof address === 'string') throw new Error('no port')
  try {
    const res = await fetch(`http://127.0.0.1:${address.port}/boom`)
    assert.equal(res.status, 500)
    assert.deepEqual(await res.json(), { error: 'internal error' })
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})
