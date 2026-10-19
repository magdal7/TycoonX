# TycoonX — Implementation Status (PROGRESS)

Canonical status file. Product rules live in `docs/TYCOONX_V2_MASTER_SPEC.md` (do not duplicate rules here).
Last updated: 2026-10-19.

## Verified current state
- **Repo:** git repository, default branch `master`, HEAD `d95f94e` (V2.5 economy/progression backend,
  UI redesign, V2.5 migration workflows). Monorepo `client` / `server` / `shared`.
- **Auth (implemented):** register/login/logout/me; JWT httpOnly `token` cookie (7d); bcrypt (12); Zod;
  `/api/auth` rate limit. Username validation matches the approved rule (3–20 chars, `[A-Za-z0-9_]`).
  Email verification/password recovery **deferred** (MVP decision).
- **Registration (V2.5 Step 1, implemented):** confirm-password matching (client), optional **Referral
  Code** auto-populated from `?ref=CODE` and editable, mandatory ToS/Privacy acceptance with working
  `/terms` + `/privacy` pages. Server-side: consent recorded atomically with account creation
  (`PolicyConsent` rows with server-authoritative policy versions + DB acceptance timestamp); referral
  codes validated server-side with **self-referrals rejected** (code cannot equal the new username) and
  valid attribution stored; referral rewards stay **disabled**. New client policy pages use the existing
  responsive dark theme. New migration `20261019000000_v25_registration_policy_consent` created but
  **NOT applied** to any database (dev-only; additive `PolicyConsent` table).
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
  - `npm test --workspace=server` — **73/73 unit pass** (incl. new referral-attribution + registration
    consent/validation tests).
  - `npm run test:integration --workspace=server` — **8/8 pass** against isolated branch
    `br-cold-star-b4bbaq8u` (identity-guarded + schema-guarded; ownership + production start/collect,
    duplicate-collection prevention, lifetime-cap exhaustion).
  - `npm run test:smoke --workspace=server` — **23/23 pass** (HTTP end-to-end against the isolated
    branch; fail-closed branch/project identity checks; deterministic child shutdown with startup,
    request, shutdown and global-watchdog timeouts).
  - Integration/smoke self-skip when `TEST_DATABASE_URL` is unset and refuse to run against protected
    (production/staging/recovery) branches.
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
6. **Registration consent migration pending (owner action).** `20261019000000_v25_registration_policy_consent`
   (additive `PolicyConsent` table) is created locally and **not applied** to any database. Registration
   records consent in the same transaction as the account, so the table must exist before this feature is
   run against a database; apply via the standard guarded migration workflow after a verified backup.

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
7. **V2.5 Step 1 (registration)** — **done** (confirm password, referral prefill/manual entry, ToS/Privacy
   consent + pages, server-side referral validation and consent recording; unit + build verified). The
   `PolicyConsent` migration still needs owner-approved application to any environment.
