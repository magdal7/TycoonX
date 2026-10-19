import 'dotenv/config'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { Pool } from '@neondatabase/serverless'

/**
 * HTTP end-to-end smoke test for the TycoonX API.
 *
 * This is a black-box companion to ownership.integration.test.ts: it boots the
 * real Express server against a disposable Neon test branch and exercises the
 * full public API surface (auth -> onboarding -> owned fleet -> production ->
 * tasks -> achievements -> leaderboard -> referrals -> withdrawals).
 *
 * Safety (fail-closed, mirrors the integration suite):
 *   1. string guard: TEST_DATABASE_URL must be set, must not reference a
 *      protected branch, and must not equal DATABASE_URL/DIRECT_URL;
 *   2. host guard: the target must be a Neon host (or localhost);
 *   3. identity guard: `current_setting('neon.branch_id'/'neon.project_id')`
 *      read from the connected server must equal the expected isolated branch.
 * It never applies migrations, never creates/resets a branch, and only creates
 * rows tagged `itest_smoke_` that are removed in the final block. If no safe
 * target is configured the run is skipped (exit 0).
 *
 * The server is spawned directly with the current Node binary and `--import tsx`
 * (no shell), so `child.pid` is the real server process and can be terminated
 * deterministically. Startup, per-request, shutdown and a global watchdog all
 * have explicit timeouts so this script can never hang indefinitely.
 *
 *   $env:TEST_DATABASE_URL = "<isolated branch direct connection string>"
 *   npm run test:smoke --workspace=server
 */

const EXPECTED_BRANCH_ID = 'br-cold-star-b4bbaq8u'
const EXPECTED_PROJECT_ID = 'wandering-king-57462138'

const PROTECTED_BRANCHES = [
  'br-delicate-butterfly-b4et73g9', // production
  'br-dawn-cherry-b4dnrhm5', // staging
  'br-long-king-b4s8l0yv', // recovery drill
]

const STARTUP_TIMEOUT_MS = 30_000
const REQUEST_TIMEOUT_MS = 15_000
const SHUTDOWN_GRACE_MS = 5_000
const OVERALL_TIMEOUT_MS = 300_000

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

const testUrl = process.env.TEST_DATABASE_URL
if (!testUrl) {
  console.log(JSON.stringify({ skipped: true, reason: 'TEST_DATABASE_URL is not set' }))
  process.exit(0)
}
for (const branch of PROTECTED_BRANCHES) {
  if (testUrl.includes(branch)) {
    console.error(`Refusing smoke test: TEST_DATABASE_URL references a protected Neon branch (${branch}).`)
    process.exit(1)
  }
}
if (testUrl === process.env.DATABASE_URL || testUrl === process.env.DIRECT_URL) {
  console.error('Refusing smoke test: TEST_DATABASE_URL must not equal DATABASE_URL or DIRECT_URL.')
  process.exit(1)
}

let testHost
try {
  testHost = new URL(testUrl).hostname
} catch {
  console.error('Refusing smoke test: TEST_DATABASE_URL is not a valid URL.')
  process.exit(1)
}
const isLocal = testHost === 'localhost' || testHost === '127.0.0.1' || testHost === '::1'
if (!isLocal && !testHost.endsWith('.neon.tech')) {
  console.error(`Refusing smoke test: host ${testHost} is neither local nor a Neon branch.`)
  process.exit(1)
}

const PORT = 4100 + Math.floor(Math.random() * 500)
const BASE = `http://localhost:${PORT}`
const pool = new Pool({ connectionString: testUrl })

const results = []
const step = (name, ok, detail) => results.push({ name, ok, ...(detail !== undefined ? { detail } : {}) })

let server = null
let serverLog = ''

const watchdog = setTimeout(() => {
  step('global watchdog', false, `exceeded ${OVERALL_TIMEOUT_MS} ms`)
  if (serverLog) console.error('--- server log (tail) ---\n' + serverLog.slice(-3000))
  try { server?.kill('SIGKILL') } catch { /* ignore */ }
  const pass = results.every((r) => r.ok)
  console.log(JSON.stringify({ allPass: pass, timedOut: true, passed: results.filter((r) => r.ok).length, total: results.length, results }, null, 2))
  process.exit(1)
}, OVERALL_TIMEOUT_MS)

function cookieFrom(res) {
  const all = res.headers.getSetCookie ? res.headers.getSetCookie() : []
  const token = all.find((c) => c.startsWith('token='))
  return token ? token.split(';')[0] : ''
}

async function api(route, { method = 'GET', body, cookie } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const res = await fetch(BASE + route, {
      method,
      headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })
    let json = null
    try { json = await res.json() } catch { /* empty */ }
    return { status: res.status, json, cookie: cookieFrom(res) }
  } finally {
    clearTimeout(timer)
  }
}

// Identity guard: confirm the connected server is the expected isolated branch
// before the server is started or any row is written.
async function verifyNeonIdentity() {
  const r = await pool.query(
    "SELECT current_setting('neon.branch_id', true) AS branch, current_setting('neon.project_id', true) AS project",
  )
  const branch = (r.rows[0]?.branch ?? '').trim()
  const project = (r.rows[0]?.project ?? '').trim()
  if (!branch || !project) throw new Error('connected server did not expose neon identity settings')
  if (branch !== EXPECTED_BRANCH_ID) throw new Error(`branch mismatch: connected "${branch}", expected "${EXPECTED_BRANCH_ID}"`)
  if (project !== EXPECTED_PROJECT_ID) throw new Error(`project mismatch: connected "${project}", expected "${EXPECTED_PROJECT_ID}"`)
}

async function waitForHealth() {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS
  while (Date.now() < deadline) {
    if (server?.exitCode !== null) return false
    try {
      const r = await fetch(BASE + '/api/health', { signal: AbortSignal.timeout(2_000) })
      if (r.ok) return true
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 500))
  }
  return false
}

async function stopServer() {
  const child = server
  if (!child || child.exitCode !== null) return
  child.kill('SIGTERM')
  await new Promise((resolve) => {
    const grace = setTimeout(() => {
      try { child.kill('SIGKILL') } catch { /* ignore */ }
      resolve()
    }, SHUTDOWN_GRACE_MS)
    child.once('exit', () => { clearTimeout(grace); resolve() })
  })
}

const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
const email = `itest_smoke_${stamp}@example.com`
const username = `itsmk_${stamp.replace(/_/g, '')}`.slice(0, 20)
const email2 = `itest_smoke_p2_${stamp}@example.com`
const username2 = `itsmk2${stamp.replace(/_/g, '')}`.slice(0, 20)
const email3 = `itest_smoke_p3_${stamp}@example.com`
const username3 = `itsmk3${stamp.replace(/_/g, '')}`.slice(0, 20)
const password = 'Passw0rd!123'

try {
  await verifyNeonIdentity()

  server = spawn(process.execPath, ['--import', 'tsx', 'src/index.ts'], {
    cwd: serverRoot,
    env: { ...process.env, DATABASE_URL: testUrl, DIRECT_URL: testUrl, PORT: String(PORT), NODE_ENV: 'development' },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  server.stdout.on('data', (d) => (serverLog += d.toString()))
  server.stderr.on('data', (d) => (serverLog += d.toString()))
  server.on('error', (e) => (serverLog += `spawn error: ${e.message}\n`))

  const up = await waitForHealth()
  step('server starts (health ok)', up, up ? undefined : serverLog.slice(-300))
  if (!up) throw new Error('server did not start')

  // Registration (policy acceptance is mandatory)
  const reg = await api('/api/auth/register', { method: 'POST', body: { email, username, password, acceptTerms: true } })
  step('register', reg.status === 201 && !!reg.json?.user, { status: reg.status })
  const cookie = reg.cookie
  step('register sets auth cookie', cookie.startsWith('token='))

  // Onboarding -> starter CEO
  const onb = await api('/api/game/onboarding', { method: 'POST', cookie })
  step('onboarding grants starter', onb.status === 200 && onb.json?.owned?.length === 1, { status: onb.status, owned: onb.json?.owned?.length })
  const ownedId = onb.json?.owned?.[0]?.id

  // Resources
  const res0 = await api('/api/game/resources', { cookie })
  step('resources (Earned/Bonus/XP)', res0.status === 200 && res0.json?.sp?.earnedSp === '0' && res0.json?.progress?.level === 1, res0.json)

  // Owned fleet view
  const fleet = await api('/api/game/ceos/owned', { cookie })
  step('owned fleet readable', fleet.status === 200 && fleet.json?.owned?.length === 1 && fleet.json.owned[0].canStart === true, { status: fleet.status, owned: fleet.json?.owned?.length, canStart: fleet.json?.owned?.[0]?.canStart })

  // Start production
  const start = await api(`/api/game/ceos/${ownedId}/start`, { method: 'POST', cookie })
  step('production start', start.status === 200 && start.json?.cycle?.rewardSp === '1', start.json)
  const cycleId = start.json?.cycle?.id

  // Duplicate start rejected
  const start2 = await api(`/api/game/ceos/${ownedId}/start`, { method: 'POST', cookie })
  step('duplicate start rejected (409)', start2.status === 409)

  // Collect before end rejected
  const early = await api(`/api/game/ceos/${ownedId}/collect`, { method: 'POST', cookie })
  step('early collect rejected (409)', early.status === 409)

  // Expire the cycle directly on the isolated branch, then collect
  await pool.query(`UPDATE "ProductionCycle" SET "endsAt" = now() - interval '1 second' WHERE id = $1`, [cycleId])
  const collect = await api(`/api/game/ceos/${ownedId}/collect`, { method: 'POST', cookie })
  step('production collect credits 1 SP', collect.status === 200 && collect.json?.rewardSp === '1' && collect.json?.alreadyCollected === false, collect.json)

  const collect2 = await api(`/api/game/ceos/${ownedId}/collect`, { method: 'POST', cookie })
  step('duplicate collect is a no-op', collect2.status === 200 && collect2.json?.alreadyCollected === true)

  const res1 = await api('/api/game/resources', { cookie })
  step('SP balance updated to 1', res1.json?.sp?.earnedSp === '1' && res1.json?.sp?.lifetimeEarnedSp === '1')

  // Tasks
  const tasks = await api('/api/game/tasks', { cookie })
  const loginDone = tasks.json?.daily?.find((t) => t.key === 'daily_login')?.completed === true
  step('daily login task completed', tasks.status === 200 && loginDone)
  const claim = await api('/api/game/tasks/claim', { method: 'POST', cookie, body: { taskKey: 'daily_login' } })
  step('claim daily task awards XP', claim.status === 200 && claim.json?.xpAwarded === 10, claim.json)
  step(
    'claim response surfaces claimed state (button -> Done)',
    claim.json?.board?.daily?.find((t) => t.key === 'daily_login')?.claimed === true,
  )

  // Re-claiming the same task must be an idempotent success, never a duplicate reward.
  const reclaim = await api('/api/game/tasks/claim', { method: 'POST', cookie, body: { taskKey: 'daily_login' } })
  step(
    'duplicate claim is idempotent (already claimed, 0 XP)',
    reclaim.status === 200 && reclaim.json?.alreadyClaimed === true && reclaim.json?.xpAwarded === 0,
    reclaim.json,
  )

  // Concurrent duplicate claims (distinct task) must award exactly once.
  const [cc1, cc2] = await Promise.all([
    api('/api/game/tasks/claim', { method: 'POST', cookie, body: { taskKey: 'daily_start_1' } }),
    api('/api/game/tasks/claim', { method: 'POST', cookie, body: { taskKey: 'daily_start_1' } }),
  ])
  const concurrentAwarded = [cc1, cc2].filter((r) => r.status === 200 && r.json?.xpAwarded === 15)
  const concurrentIdempotent = [cc1, cc2].filter((r) => r.status === 200 && r.json?.xpAwarded === 0)
  step(
    'concurrent duplicate claims award exactly once',
    concurrentAwarded.length === 1 && concurrentIdempotent.length === 1,
    { cc1: cc1.json, cc2: cc2.json },
  )

  const res2 = await api('/api/game/resources', { cookie })
  step('XP/level reflected', res2.json?.progress?.xp === 25 && res2.json?.progress?.rank === 'Rookie', res2.json)

  // Claim All is idempotent and returns the refreshed board.
  const claimAll = await api('/api/game/tasks/claim-all', { method: 'POST', cookie })
  step(
    'claim-all returns claimed list and board',
    claimAll.status === 200 && Array.isArray(claimAll.json?.claimed) && !!claimAll.json?.board,
    { xpAwarded: claimAll.json?.xpAwarded, claimed: claimAll.json?.claimed },
  )
  const claimAllAgain = await api('/api/game/tasks/claim-all', { method: 'POST', cookie })
  step(
    'claim-all replay awards nothing',
    claimAllAgain.status === 200 && claimAllAgain.json?.xpAwarded === 0 && claimAllAgain.json?.claimed?.length === 0,
    claimAllAgain.json,
  )

  // Achievements
  const ach = await api('/api/game/achievements', { cookie })
  step('achievements listed (5 tracks)', ach.status === 200 && ach.json?.tracks?.length === 5)

  // Leaderboard + public profile
  const lb = await api('/api/public/leaderboard')
  step('leaderboard includes player', lb.status === 200 && lb.json?.entries?.some((e) => e.username === username))
  const me = await api('/api/game/leaderboard/me', { cookie })
  step('player rank returned', me.status === 200 && typeof me.json?.rank === 'number')
  const prof = await api(`/api/public/profile/${username}`)
  step('public profile (no private data)', prof.status === 200 && prof.json?.username === username && prof.json?.email === undefined)

  // Referrals + withdrawals (disabled)
  const ref = await api('/api/game/referrals', { cookie })
  step('referrals: rewards disabled', ref.status === 200 && ref.json?.rewardsEnabled === false)
  const wd = await api('/api/game/withdrawals', { cookie })
  step('withdrawals: payouts disabled', wd.status === 200 && wd.json?.payoutsEnabled === false && Array.isArray(wd.json?.withdrawals))

  // ---- Special tasks (admin foundation) ----
  // Register a second player for the submission side.
  const reg2 = await api('/api/auth/register', { method: 'POST', body: { email: email2, username: username2, password, acceptTerms: true } })
  step('register second player', reg2.status === 201 && !!reg2.json?.user, { status: reg2.status })
  const cookie2 = reg2.cookie
  await api('/api/game/onboarding', { method: 'POST', cookie: cookie2 })

  // Non-admin access to admin endpoints is forbidden (server-side authorization).
  const denied = await api('/api/admin/special-tasks', { cookie: cookie2 })
  step('non-admin denied admin endpoint (403)', denied.status === 403, { status: denied.status })

  // Promote the primary smoke user to ADMIN on the isolated branch only.
  await pool.query(`UPDATE "User" SET role = 'ADMIN' WHERE email = $1`, [email])

  const created = await api('/api/admin/special-tasks', {
    method: 'POST',
    cookie,
    body: { title: 'Smoke special task', description: 'Automated smoke-test campaign', rewardXp: 30, rewardBonusSp: 5, verification: 'MANUAL', minLevel: 1 },
  })
  step('admin creates special task (DRAFT)', created.status === 201 && created.json?.task?.status === 'DRAFT', created.json)
  const taskId = created.json?.task?.id

  const published = await api(`/api/admin/special-tasks/${taskId}/status`, { method: 'POST', cookie, body: { action: 'publish' } })
  step('admin publishes special task', published.status === 200 && published.json?.task?.status === 'PUBLISHED', published.json)

  const specialList = await api('/api/game/special-tasks', { cookie: cookie2 })
  step('player sees available special task', specialList.status === 200 && specialList.json?.tasks?.some((t) => t.id === taskId && t.state === 'AVAILABLE'), specialList.json)

  const submit = await api(`/api/game/special-tasks/${taskId}/submit`, { method: 'POST', cookie: cookie2, body: { proofText: 'smoke proof' } })
  step('player submits special task (PENDING)', submit.status === 201 && submit.json?.status === 'PENDING', submit.json)
  const submissionId = submit.json?.submissionId

  const submitDup = await api(`/api/game/special-tasks/${taskId}/submit`, { method: 'POST', cookie: cookie2, body: { proofText: 'again' } })
  step('duplicate pending submission rejected (409)', submitDup.status === 409 && submitDup.json?.error === 'pending_exists', submitDup.json)

  const review = await api(`/api/admin/submissions/${submissionId}/review`, { method: 'POST', cookie, body: { decision: 'APPROVE' } })
  step('admin approves submission', review.status === 200 && review.json?.submission?.status === 'APPROVED', review.json)

  const claimS = await api(`/api/game/special-tasks/submissions/${submissionId}/claim`, { method: 'POST', cookie: cookie2 })
  step('player claims special reward', claimS.status === 200 && claimS.json?.xpAwarded === 30 && claimS.json?.bonusSpAwarded === '5', claimS.json)
  const claimS2 = await api(`/api/game/special-tasks/submissions/${submissionId}/claim`, { method: 'POST', cookie: cookie2 })
  step('duplicate special claim rejected (409)', claimS2.status === 409, claimS2.json)

  const res3 = await api('/api/game/resources', { cookie: cookie2 })
  step('special reward credited exactly once', res3.json?.progress?.xp === 30 && res3.json?.sp?.bonusSp === '5', res3.json)

  const audit = await api('/api/admin/audit', { cookie })
  step('admin audit log records actions', audit.status === 200 && audit.json?.entries?.some((e) => e.action === 'special_task.create'), { entries: audit.json?.entries?.length })

  // ---- Step 4: admin management ----
  const player2Id = reg2.json?.user?.id

  const found = await api(`/api/admin/users?q=${encodeURIComponent(username2)}`, { cookie })
  step('admin searches users', found.status === 200 && found.json?.users?.some((u) => u.id === player2Id), found.json)

  const detail = await api(`/api/admin/users/${player2Id}`, { cookie })
  step('admin reads user detail', detail.status === 200 && detail.json?.user?.id === player2Id && !!detail.json?.balances, { status: detail.status })

  const suspended = await api(`/api/admin/users/${player2Id}/suspension`, { method: 'POST', cookie, body: { suspend: true, reason: 'smoke', confirm: true } })
  step('admin suspends user', suspended.status === 200 && suspended.json?.user?.isSuspended === true)
  const blocked = await api('/api/game/resources', { cookie: cookie2 })
  step('suspended user blocked from gameplay (403)', blocked.status === 403 && blocked.json?.error === 'account_suspended', blocked.json)
  const unblocked = await api(`/api/admin/users/${player2Id}/suspension`, { method: 'POST', cookie, body: { suspend: false, confirm: true } })
  const afterReactivate = await api('/api/game/resources', { cookie: cookie2 })
  step('reactivated user can access gameplay', unblocked.status === 200 && afterReactivate.status === 200)

  const noConfirm = await api(`/api/admin/users/${player2Id}/suspension`, { method: 'POST', cookie, body: { suspend: true, confirm: false } })
  step('suspension without confirmation rejected (422)', noConfirm.status === 422, noConfirm.json)

  const catalog = await api('/api/admin/catalog', { cookie })
  step('admin lists catalog', catalog.status === 200 && Array.isArray(catalog.json?.ceos))
  const ownedCeo = catalog.json?.ceos?.find((c) => c.ownedCount > 0)
  if (ownedCeo) {
    const delOwned = await api(`/api/admin/catalog/${ownedCeo.id}`, { method: 'DELETE', cookie, body: { confirm: true } })
    step('catalog delete blocked when owned (409)', delOwned.status === 409 && delOwned.json?.error === 'owned_exists', delOwned.json)
    const econEdit = await api(`/api/admin/catalog/${ownedCeo.id}`, { method: 'PUT', cookie, body: { priceUsd: '99.99' } })
    step('catalog economy edit rejected (400)', econEdit.status === 400, econEdit.json)
    const presEdit = await api(`/api/admin/catalog/${ownedCeo.id}`, { method: 'PUT', cookie, body: { isForSale: false } })
    const revert = await api(`/api/admin/catalog/${ownedCeo.id}`, { method: 'PUT', cookie, body: { isForSale: true } })
    step('catalog presentation edit allowed', presEdit.status === 200 && revert.status === 200)
  } else {
    step('catalog delete blocked when owned (409)', false, 'no owned tier found')
  }

  const economy = await api('/api/admin/economy', { cookie })
  step('admin economy overview', economy.status === 200 && !!economy.json?.totals && !!economy.json?.suspicious, { status: economy.status })

  const withdrawals = await api('/api/admin/withdrawals', { cookie })
  step('admin withdrawal review list', withdrawals.status === 200 && withdrawals.json?.payoutsEnabled === false)

  const settingsUpdate = await api('/api/admin/settings', { method: 'PUT', cookie, body: { announcement: { enabled: true, message: 'Smoke announcement', level: 'info' }, confirm: true } })
  step('admin updates site settings', settingsUpdate.status === 200 && settingsUpdate.json?.settings?.announcement?.enabled === true, settingsUpdate.json)
  const publicSettings = await api('/api/public/settings')
  step('public settings expose announcement', publicSettings.status === 200 && publicSettings.json?.announcement?.enabled === true)

  await api('/api/admin/settings', { method: 'PUT', cookie, body: { announcement: { enabled: false }, confirm: true } })
  const closeReg = await api('/api/admin/settings', { method: 'PUT', cookie, body: { registrationEnabled: false, confirm: true } })
  const blockedReg = await api('/api/auth/register', { method: 'POST', body: { email: `itest_smoke_blocked_${stamp}@example.com`, username: `itsmkblk${stamp.replace(/_/g, '')}`.slice(0, 20), password, acceptTerms: true } })
  step('registration disabled blocks signup (403)', closeReg.status === 200 && blockedReg.status === 403 && blockedReg.json?.error === 'registration_disabled', blockedReg.json)
  await api('/api/admin/settings', { method: 'PUT', cookie, body: { registrationEnabled: true, confirm: true } })

  // ---- Step 5: referral system ----
  const reg3 = await api('/api/auth/register', { method: 'POST', body: { email: email3, username: username3, password, acceptTerms: true, ref: username } })
  step('register referred user', reg3.status === 201 && !!reg3.json?.user, { status: reg3.status })

  const refSummary = await api('/api/game/referrals', { cookie })
  step(
    'referrer summary shows attribution',
    refSummary.status === 200 && (refSummary.json?.total ?? 0) >= 1 && refSummary.json?.history?.some((h) => h.referredUsername === username3) && refSummary.json?.rewardsEnabled === false,
    { total: refSummary.json?.total },
  )

  const adminRefs = await api(`/api/admin/referrals?q=${encodeURIComponent(username3)}`, { cookie })
  const referral = adminRefs.json?.referrals?.find((r) => r.referredUsername === username3)
  step('admin lists referral', adminRefs.status === 200 && !!referral && referral.status === 'PENDING', { status: adminRefs.status })

  if (referral) {
    const noConfirm = await api(`/api/admin/referrals/${referral.id}/review`, { method: 'POST', cookie, body: { decision: 'QUALIFY', confirm: false } })
    step('referral review requires confirmation (422)', noConfirm.status === 422, noConfirm.json)
    const qualify = await api(`/api/admin/referrals/${referral.id}/review`, { method: 'POST', cookie, body: { decision: 'QUALIFY', confirm: true } })
    step('admin qualifies referral', qualify.status === 200 && qualify.json?.referral?.status === 'QUALIFIED', qualify.json)

    const rewards = await api('/api/admin/referral-rewards', { cookie })
    step(
      'reward record created (pending, rewards disabled)',
      rewards.status === 200 && rewards.json?.rewards?.some((r) => r.kind === 'REGISTRATION_BONUS' && r.status === 'PENDING' && r.amountSp === '10'),
      { count: rewards.json?.rewards?.length },
    )

    const refSummary2 = await api('/api/game/referrals', { cookie })
    step('referrer qualified + pending reward', (refSummary2.json?.qualified ?? 0) >= 1 && refSummary2.json?.pendingRewardsSp === '10', { qualified: refSummary2.json?.qualified })
  } else {
    step('admin qualifies referral', false, 'referral not found')
  }

  // Login + logout
  const login = await api('/api/auth/login', { method: 'POST', body: { email, password } })
  step('login', login.status === 200 && !!login.json?.user)
  const logout = await api('/api/auth/logout', { method: 'POST', cookie })
  step('logout', logout.status === 200)
} catch (e) {
  step('smoke run', false, String(e?.name === 'AbortError' ? `request timeout after ${REQUEST_TIMEOUT_MS} ms` : e?.message || e))
} finally {
  clearTimeout(watchdog)
  // Clean up the isolated-branch test rows only.
  try {
    const users = await pool.query(`SELECT id FROM "User" WHERE email LIKE 'itest_smoke_%'`)
    const ids = users.rows.map((r) => r.id)
    if (ids.length) {
      for (const t of ['ProductionCycle', 'SpLedgerEntry', 'SpAccount', 'ProgressAccount', 'TaskEvent', 'TaskClaim', 'AchievementClaim', 'UserProfile', 'PolicyConsent', 'IdempotencyKey']) {
        await pool.query(`DELETE FROM "${t}" WHERE "userId" = ANY($1)`, [ids])
      }
      await pool.query(`DELETE FROM "ReferralAttribution" WHERE "referrerId" = ANY($1) OR "referredUserId" = ANY($1)`, [ids])
      await pool.query(`DELETE FROM "AdminAuditLog" WHERE "actorId" = ANY($1)`, [ids])
      await pool.query(`DELETE FROM "SpecialTask" WHERE "createdBy" = ANY($1)`, [ids])
      await pool.query(`DELETE FROM "OwnedCeo" WHERE "userId" = ANY($1)`, [ids])
      await pool.query(`DELETE FROM "User" WHERE id = ANY($1)`, [ids])
    }
  } catch (e) {
    step('cleanup', false, String(e?.message || e))
  }
  await pool.end().catch(() => {})
  await stopServer()
}

const allPass = results.every((r) => r.ok)
if (!allPass && serverLog) console.error('--- server log (tail) ---\n' + serverLog.slice(-3000))
console.log(JSON.stringify({ allPass, passed: results.filter((r) => r.ok).length, total: results.length, results }, null, 2))
process.exit(allPass ? 0 : 1)
