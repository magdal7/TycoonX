# TycoonX — Implementation Status (PROGRESS)

Canonical status file. Product rules live in `docs/TYCOONX_V2_MASTER_SPEC.md` (do not duplicate rules here).
Last updated: 2026-10-19.

## Verified current state
- **Repo:** git repository, default branch `master` (V2.5 economy/progression backend, UI redesign,
  migration workflows, plus Step 1 registration and Step 2 missions fixes). Monorepo `client` / `server` / `shared`.
- **Auth (implemented):** register/login/logout/me; JWT httpOnly `token` cookie (7d); bcrypt (12); Zod;
  `/api/auth` rate limit. Username validation matches the approved rule (3–20 chars, `[A-Za-z0-9_]`).
  Email verification/password recovery **deferred** (MVP decision).
- **Registration (V2.5 Step 1, implemented):** confirm-password matching (client), optional **Referral
  Code** auto-populated from `?ref=CODE` and editable, mandatory ToS/Privacy acceptance with working
  `/terms` + `/privacy` pages. Server-side: consent recorded atomically with account creation
  (`PolicyConsent` rows with server-authoritative policy versions + DB acceptance timestamp); referral
  codes validated server-side with **self-referrals rejected** (code cannot equal the new username) and
  valid attribution stored; referral rewards stay **disabled**. New client policy pages use the existing
  responsive dark theme. Migration `20261019000000_v25_registration_policy_consent` (additive
  `PolicyConsent` table) **applied to the isolated test branch only** (`br-cold-star-b4bbaq8u`; identity
  verified, `User` count unchanged); **not applied** to production or staging.
- **Referral rules (V2.5, documented in Master Spec §0/§8):** 10 Bonus SP per qualified referral; 10%
  recurring commission on every confirmed eligible paid CEO purchase by a referred user; permanent
  attribution; no rewards for self-referrals, duplicate, failed, or refunded purchases. Commission
  currency, qualification criteria, and refund handling remain **unresolved**; rewards stay disabled.
- **CEO catalog API (implemented):** `GET/POST/PUT/DELETE /api/ceos`; Decimal→string serialization;
  active-row reads via `GET /api/ceos?isActive=true`.
- **Ownership backend (implemented, unit + integration tested):** `GET /api/game/ceos/owned`,
  `POST /api/game/ceos/starter`, `POST /api/game/onboarding`; idempotent, concurrency-safe starter.
  Routes are mounted under `/api/game` and align with the client API layer (`client/src/lib/game.ts`).
- **Economy foundation (implemented; migration applied to production):**
  - Separate **Earned SP / Bonus SP** accounts + immutable `SpLedgerEntry` (Bonus spent first).
  - **Lifetime Earned-SP caps** on `OwnedCeo` (archived/`EXHAUSTED` on exhaustion).
  - **Equipment** tiers Standard 4h / Extended 6h (500 SP) / Advanced 8h (1,500 SP), SP-priced, level-gated.
  - **Production cycles**: `POST /api/game/ceos/:id/start`, `/collect`, `/equipment`, `/bulk-start`,
    `/bulk-collect`; server-authoritative, snapshot reward, exactly-once claim, concurrency guards.
  - **XP/levels/ranks** (`ProgressAccount`, approved formula, 224,420 XP to level 50) and `GET /resources`,
    `GET /sp/ledger`.
  - Pure game math in `server/src/lib/gameMath.ts`.
- **Progression & retention (implemented; migration applied to production):**
  - **Daily/weekly tasks** via an append-only `TaskEvent` log + idempotent `TaskClaim`; approved XP values
    (165 XP/day, 1,250 XP/week), UTC 00:00 / Monday-00:00 periods, manual Claim / Claim All.
    **Step 2 hardening:** the board now returns per-task `claimed` state; Claim / Claim All are
    concurrency-safe (per-user `pg_advisory_xact_lock` + P2002 catch) and return the refreshed board so
    the UI updates in one round trip; duplicate/already-claimed claims are idempotent successes.
  - **Achievements**: 5 tracks × 4 stages, derived lifetime counters, XP-only one-time claims.
  - **Leaderboard + public profiles** (`/api/public/leaderboard`, `/api/public/profile/:username`; no
    private data) + featured badges/avatar (`UserProfile`).
  - **Referral rewards**: rules/amounts present (10 Bonus SP, 10% commission) but **disabled**
    (`REFERRAL_REWARDS_ENABLED=false`) pending approved qualification.
  - **Withdrawal request/review states** (gross Earned-SP lock, min 3,000 SP, 0.30 USDT fee) with
    **payouts disabled**; admin review queue never transfers crypto.
- **Production database (verified 2026-10-18, read-only):** production branch
  `br-delicate-butterfly-b4et73g9` / project `wandering-king-57462138` has **six `_prisma_migrations`
  rows**: the four baseline migrations plus both V2.5 migrations recorded applied at
  `2026-10-18T18:38:47Z` (`20261018000000_v25_economy_sp_production`) and `2026-10-18T18:38:52Z`
  (`20261018010000_v25_progression`). V2.5 tables/columns/enums present; catalog shows **8 active CEO
  tiers** (10 rows total; `crypto-whale` and `test-ceo` inactive); `User=3` / `OwnedCeo=2` preserved.
- **UI redesign (V2.5):** new design system (tokens, glass panels, animations), app shell with sidebar +
  mobile bottom nav, and API-connected pages: Landing (marketing), Home (production: start/collect/bulk,
  equipment, lifetime caps, archived state), Market (active tiers), Collection (owned fleet), Tasks
  (daily/weekly + Claim All), Achievements, Leaderboard + public profiles, Profile (referrals, featured
  badges), Wallet (balances, SP ledger, withdrawal requests with payouts disabled). Legacy demo pages
  removed. Client API layer in `client/src/lib/game.ts`.
- **Tests:**
  - `npm test --workspace=server` — **78/78 unit pass** (incl. task claimed-state + concurrent-duplicate-claim
    regression tests, referral-attribution, and registration consent/validation tests).
  - `npm run test:integration --workspace=server` — **8/8 pass** against isolated branch
    `br-cold-star-b4bbaq8u` (identity-guarded + schema-guarded; ownership + production start/collect,
    duplicate-collection prevention, lifetime-cap exhaustion).
  - `npm run test:smoke --workspace=server` — **28/28 pass** (HTTP end-to-end against the isolated
    branch; now also asserts claim→`claimed`, idempotent duplicate claim, concurrent duplicate claim
    awards once, and claim-all replay; fail-closed branch/project identity checks; deterministic child
    shutdown with startup, request, shutdown and global-watchdog timeouts).
  - Integration/smoke self-skip when `TEST_DATABASE_URL` is unset and refuse to run against protected
    (production/staging/recovery) branches.
  - Re-verified 2026-10-19 after applying the consent migration to the isolated branch: integration
    **8/8** and smoke **28/28** (registration now sends `acceptTerms`; smoke cleans up `PolicyConsent`).
- **Builds:** server `tsc` typecheck **passes**; client production PWA build **passes** (workbox precache
  limit raised).

## Docs layout (reconciled 2026-10-18)
- `docs/TYCOONX_V2_MASTER_SPEC.md` — canonical product rules.
- `docs/PROGRESS.md` — this file.
- `docs/ARCHITECTURE.md` — current system map.
- `docs/archive/` — superseded docs retained for reference (see `docs/archive/README.md`).

## Blockers (owner action required)
1. **Resolved: V2.5 migrations applied.** Both V2.5 migrations are recorded applied on production
   (see Verified current state). No re-apply is needed; the execution workflow is fail-closed against a
   second apply.
2. **Execution workflows** (`neon-migration-preflight.yml`, `neon-migration-execute.yml`) remain the
   standard production path: branch/project identity, frozen checksums, confirmation token, single-
   transaction applies, history recording, final verification. Do not re-dispatch for this migration set.
3. **Backup/PITR gate** should be confirmed with the owner for any future migration window (no Neon API
   credential is available here).
4. **Application deployment not configured.** No hosting/deployment config exists in the repository; the
   server and client are not deployed by any tracked config. Production currently means the migrated
   database only.
5. **Payments disabled.** OxaPay is planning only; deposits, withdrawals, payouts and referral rewards
   remain **disabled** pending owner approval and go-live gates.
6. **Registration consent migration — applied to test only (owner action for prod).**
   `20261019000000_v25_registration_policy_consent` (additive `PolicyConsent` table) is **applied to the
   isolated test branch** (`br-cold-star-b4bbaq8u`) and is **not applied** to production or staging.
   Registration records consent in the same transaction as the account, so the table must exist before
   the feature runs in any environment; apply to production via the standard guarded migration workflow
   (preflight + execute) after a verified backup and owner approval.
7. **Referral economics unresolved (owner action).** Before referral rewards can be activated, the owner
   must confirm: the **commission currency**, the **qualification criteria**, and **refund/chargeback
   handling**. Rewards stay disabled (`REFERRAL_REWARDS_ENABLED=false`) until then.

## Not implemented yet (see Master Spec §0/§3–§9)
Admin-created **special tasks**; **OxaPay** integration (planning only, not activated); admin UI; real
purchases; application (server/client) deployment.

## Next
1. Documentation reconciliation — **done**.
2. Economy foundation + production-cycle engine + XP/levels — **done (unit + integration tested; migration applied)**.
3. Tasks, achievements, leaderboard, public profiles, referral rewards, withdrawal requests — **done**.
4. Catalog mapping + full UI redesign wired to real APIs — **done**.
5. Production migration execution — **done** (both V2.5 migrations applied; six migration records).
6. **Remaining:** application deployment (server + client hosting) and admin UI are not configured;
   OxaPay integration and all real-money flows stay disabled pending explicit owner approval.
7. **V2.5 Step 1 (registration) — done and branch-verified.** Confirm password, referral prefill/manual
   entry, ToS/Privacy consent + pages, server-side referral validation and consent recording. Unit
   **78/78**, integration **8/8**, smoke **28/28** (consent migration applied to the isolated test branch
   only). Production application of the migration and the unresolved referral rules below remain owner
   decisions.
8. **V2.5 Step 2 (missions & rewards) — done.** See "Missions — Step 2 fixes" below. Special tasks
   (Step 3) are intentionally **not** implemented.

## Missions — Step 2 fixes (2026-10-19)
Reported bug: **Claim did not reliably change to Done.** Root causes and fixes:
1. **No claimed state was surfaced.** `GET /api/game/tasks` only returned `completed` (derived from
   events), never the `TaskClaim` rows. After claiming, `completed` stayed true, so the button never
   changed and a second click hit a 409. Fix: `computeTaskBoard` now takes the user's claims and returns
   a `claimed` flag per task/bonus (`server/src/lib/tasks.ts`, `services/tasks.ts`).
2. **Concurrent duplicate claims raised an unhandled unique violation (P2002) → 500/hang.** Fix: claim
   writes are serialized per user with `pg_advisory_xact_lock` inside the transaction, plus a defensive
   P2002 catch that reports "already claimed" instead of erroring (`services/tasks.ts`). Uses
   `$executeRaw` (not `$queryRaw`) to avoid deserializing the lock's `void` result.
3. **Task/achievement routes had no async error handling.** Fix: try/catch with explicit status codes;
   already-claimed is a **200 success** (idempotent), only truly incomplete tasks are 409
   (`routes/game/progression.ts`).
4. **UI could not show Done / distinguish already-claimed / update immediately.** Fix: `Tasks.tsx` now
   tracks claimed state from the server-returned board, updates state from the claim response (no page
   refresh), shows per-task loading, success/info/error notices, and disables claimed buttons ("Done").
   Claim All returns the refreshed board and is disabled when nothing is claimable.
5. **XP balance did not refresh.** Fix: new `client/src/lib/resources.ts` (`useResources` +
   `notifyResourcesChanged`) so a shared resources view (Tasks XP stat, Layout, Home, Profile, Wallet)
   refetches immediately after a claim.
6. **Reset/availability verified** by regression tests: stale previous-period claims never leak into the
   current board; current-day/week completion is unchanged.

Verification: unit **78/78**, integration **8/8**, smoke **28/28** (isolated branch only); server `tsc`
and client PWA build pass. No schema/migration change and no economy/reward value was altered.

Remaining (out of Step 2 scope): Special Tasks (Step 3); admin UI; application deployment.


## Registration — remaining requirements before production-ready
Registration code and schema are complete and verified on the isolated branch. It is **not production-ready**
until the following owner/environment actions are completed (none are code bugs):
1. **Apply migration `20261019000000_v25_registration_policy_consent` to production** via the guarded
   preflight/execute workflow after a verified backup. The consent write is inside the account-creation
   transaction, so registration **fails closed** in any environment lacking the `PolicyConsent` table.
2. **Legal review + owner sign-off on the Terms of Service and Privacy Policy text** (currently concise
   product summaries at `/terms` and `/privacy`, version `1.0`, effective `2026-10-19`). Bump the policy
   versions in `server/src/lib/policies.ts` and the client policy pages if the text changes.
3. **Owner confirmation of the unresolved referral economics** (commission currency, qualification
   criteria, refund/chargeback handling) and approval of anti-abuse rules; rewards stay disabled until
   then. No referral rewards are granted at registration.
4. **Confirm the `consent` data-retention / privacy handling** (audit rows use `ON DELETE RESTRICT`) with
   the owner and, if required, an applicable data-minimization policy.
5. **Application deployment not configured** — the server and client are not hosted by any tracked config;
   production currently means the migrated database only.
