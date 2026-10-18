# TycoonX — Implementation Status (PROGRESS)

Canonical status file. Product rules live in `docs/TYCOONX_V2_MASTER_SPEC.md` (do not duplicate rules here).
Last updated: 2026-10-18.

## Verified current state
- **Repo:** git repository, default branch `master`. Monorepo `client` / `server` / `shared`.
- **Auth (implemented):** register/login/logout/me; JWT httpOnly `token` cookie (7d); bcrypt (12); Zod;
  `/api/auth` rate limit. Email verification/password recovery **deferred** (MVP decision).
- **CEO catalog API (implemented):** `GET/POST/PUT/DELETE /api/ceos`; Decimal→string serialization.
- **Economy schema foundation (implemented in code + frozen migration, NOT applied to production):**
  `OwnedCeo`, `ReferralAttribution`, `IdempotencyKey`, `AppMeta`; additive `CEO` economy columns
  (`baseSpPerCycle`, `maxOwned`, `isStarter`, `rewardEligible`, `category`, `displayOrder`).
- **Ownership backend (implemented, unit-tested):** `GET /api/game/ceos/owned`,
  `POST /api/game/ceos/starter`, `POST /api/game/onboarding`; idempotent, concurrency-safe starter.
- **Economy foundation (implemented in code + frozen migration, NOT applied):**
  - Separate **Earned SP / Bonus SP** accounts + immutable `SpLedgerEntry` (Bonus spent first).
  - **Lifetime Earned-SP caps** on `OwnedCeo` (archived/`EXHAUSTED` on exhaustion).
  - **Equipment** tiers Standard 4h / Extended 6h (500 SP) / Advanced 8h (1,500 SP), SP-priced, level-gated.
  - **Production cycles**: `POST /api/game/ceos/:id/start`, `/collect`, `/equipment`, `/bulk-start`,
    `/bulk-collect`; server-authoritative, snapshot reward, exactly-once claim, concurrency guards.
  - **XP/levels/ranks** (`ProgressAccount`, approved formula, 224,420 XP to level 50) and `GET /resources`,
    `GET /sp/ledger`.
  - Pure game math in `server/src/lib/gameMath.ts`; migration
    `20261018000000_v25_economy_sp_production` (catalog seed block flagged REVIEW REQUIRED).
- **Progression & retention (implemented in code + frozen migration, NOT applied):**
  - **Daily/weekly tasks** via an append-only `TaskEvent` log + idempotent `TaskClaim`; approved XP values
    (165 XP/day, 1,250 XP/week), UTC 00:00 / Monday-00:00 periods, manual Claim / Claim All.
  - **Achievements**: 5 tracks × 4 stages, derived lifetime counters, XP-only one-time claims.
  - **Leaderboard + public profiles** (`/api/public/leaderboard`, `/api/public/profile/:username`; no
    private data) + featured badges/avatar (`UserProfile`).
  - **Referral rewards**: rules/amounts present (10 Bonus SP, 10% commission) but **disabled**
    (`REFERRAL_REWARDS_ENABLED=false`) pending approved qualification.
  - **Withdrawal request/review states** (gross Earned-SP lock, min 3,000 SP, 0.30 USDT fee) with
    **payouts disabled**; admin review queue never transfers crypto.
  - Migrations `20261018000000_v25_economy_sp_production`, `20261018010000_v25_progression`.
  - Client API layer extended in `client/src/lib/game.ts`.
- **Tests:** `npm test --workspace=server` — **65/65 unit pass**. Integration tests exist but **self-skip**
  without `TEST_DATABASE_URL` (skipped ≠ verified).
- **Catalog migration (owner-approved 2026-10-18):** `20261018000000_v25_economy_sp_production` maps the
  eight approved tiers onto existing slugs (junior-developer→CEO2 … tech-billionaire→CEO8), retires the
  surplus `crypto-whale` row (inactive, not deleted), and preserves ids/ownership. Catalog reads/UI now
  request active rows only (`GET /api/ceos?isActive=true`). **Not applied to any database.**
- **UI redesign (V2.5):** new design system (tokens, glass panels, animations), app shell with sidebar +
  mobile bottom nav, and API-connected pages: Landing (marketing), Home (production: start/collect/bulk,
  equipment, lifetime caps, archived state), Market (active tiers), Collection (owned fleet), Tasks
  (daily/weekly + Claim All), Achievements, Leaderboard + public profiles, Profile (referrals, featured
  badges), Wallet (balances, SP ledger, withdrawal requests with payouts disabled). Legacy demo pages
  removed. Client API layer in `client/src/lib/game.ts`.
- **Client:** Landing/Login/Register; real Market (`pages/CEOs.tsx` + `lib/ceos.ts`); new typed game API
  layer `client/src/lib/game.ts`. Dashboard/Empire/Tasks/Wallet/Profile still **demo-only**. Production PWA
  build **now passes** (workbox precache limit raised); `game/` remains a visual-only prototype.

## Docs layout (reconciled 2026-10-18)
- `docs/TYCOONX_V2_MASTER_SPEC.md` — canonical product rules.
- `docs/PROGRESS.md` — this file.
- `docs/ARCHITECTURE.md` — current system map.
- `docs/archive/` — superseded docs retained for reference (see `docs/archive/README.md`).

## Blockers (owner action required)
1. **Two V2.5 migrations pending on production.** Production
   (`br-delicate-butterfly-b4et73g9` / `wandering-king-57462138`) is baselined at 4 migration rows
   (through Phase 6B.2A). Pending: `20261018000000_v25_economy_sp_production` and
   `20261018010000_v25_progression`. **Do not apply without owner approval.**
2. **Production execution workflows rewritten for V2.5** (`neon-migration-preflight.yml`,
   `neon-migration-execute.yml`): current-baseline pre-checks, 6-file checksums, two transactional
   applies, history recording, 6-row final verification. YAML parses; a local read-only preflight
   mirroring the workflow passed all 13 checks (branch/project/baseline/counts/V2.5-objects-absent).
3. **Backup/PITR gate unverified (owner).** No Neon API credential is available here, so a fresh
   production backup branch and the PITR/restore window for this migration window could not be
   confirmed. Required before dispatch.
4. **Isolated validation done:** branch `br-cold-star-b4bbaq8u`; both migrations applied; real-Postgres
   integration suite **8/8** (starter/ownership + production start/collect, duplicate-collection
   prevention, lifetime-cap exhaustion); 8 active tiers; `crypto-whale`/`test-ceo` inactive;
   `User=3`/`CEO=10`/`OwnedCeo=2` preserved. Note: Prisma CLI cannot reach Neon over TCP:5432 from this
   host (`P1001`), so the isolated apply used the serverless (HTTPS) driver and did not record
   `_prisma_migrations`; production uses the standard workflow (records history).
5. **Client production build passes** (PWA precache limit raised); no build blocker.

## Not implemented yet (see Master Spec §0/§3–§9)
Admin-created **special tasks**; **OxaPay** integration (planning only, not activated); admin UI; real
purchases; production deployment.

## Next
1. Documentation reconciliation — **done**.
2. Economy foundation + production-cycle engine + XP/levels — **done (unit-tested; migration not applied)**.
3. Tasks, achievements, leaderboard, public profiles, referral rewards, withdrawal requests — **done**.
4. Catalog mapping + full UI redesign wired to real APIs — **done**.
5. **Apply migrations to an isolated PostgreSQL branch and run the integration harness** (needs operator
   credentials), then production execution with explicit owner approval.
