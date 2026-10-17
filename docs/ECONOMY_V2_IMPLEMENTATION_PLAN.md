# TycoonX — Economy V2 Implementation Plan (Phase 6)

**Status:** Plan for approval. No code, schema, migration or data changes made.  
**Date:** 2026-10-17  
**Companion:** `docs/ECONOMY_V2_AUDIT.md`, target design `docs/TYCOONX_ECONOMY_V2_SPEC.md`.  
**Hard constraints:** server-authoritative economy; no real-money earnings, deposits, withdrawals or
crypto payments; preserve existing CEO catalog values; production stops at cycle end; no double claims;
no negative balances; Phase 5H visuals untouched.

---

## 0. Guiding principles

1. **Server is the only source of truth** for SP, XP, level, Tech Parts, energy, ownership, cycles and
   bonuses. The client only renders server state and requests actions.
2. **Additive-only database changes.** No `migrate reset`, no `db push`, no drops, no column
   retypes/renames, no data rewrites. New tables/enums/columns are created; legacy columns remain.
3. **Every economy mutation is transactional and idempotent.** Unique constraints + request-key rows;
   integer/basis-point math; no floats in accounting.
4. **Financial features are out of scope for Phase 6.** No payment, redemption, USDT or reservation
   funding is implemented before external legal/compliance sign-off (Phase 6H gate).
5. **Small, independently testable phases.** Each phase ships behind existing auth, adds its own
   additive migration and tests, and leaves prior phases working.
6. **Preserve Phase 5H.** No edits to renderer, sprites, flag defaults, layouts or art.

---

## 1. Database safety audit and migration strategy

### 1.1 Verified state (from `ECONOMY_V2_AUDIT.md`)

- Two migration files; **no `migration_lock.toml`**; broken seed in `20240102000000_create_ceo_model`
  (`updatedAt` NOT NULL, omitted).
- `CEO` table reportedly created out-of-band; `_prisma_migrations` **UNVERIFIED**.
- `DIRECT_URL` fails `P1001`; only the pooled `DATABASE_URL` is reliable.
- Not a git repo; no automated tests; Prisma `client`/`prisma` pinned `^5.16.1` (do not upgrade).

### 1.2 Rules (non-negotiable)

- **Never** run `prisma migrate reset`, `prisma db push`, `DROP`, `TRUNCATE`, or any destructive SQL.
- **Never** edit already-recorded migration files. Corrections land as new additive migrations.
- **Never** apply a migration against production without (a) an observed state check, (b) a Neon
  branch/backup, and (c) owner approval.
- **Never** assume schema-history match; always observe first.

### 1.3 Recommended safe migration procedure (to execute only in an approved phase)

1. **Backup first.** Create a Neon branch (or confirm point-in-time-restore window). Record branch id.
2. **Observe, read-only** (no writes):
   - Compare `schema.prisma` to the live DB using Prisma's read-only introspection:
     `npx prisma db pull --print` against `DATABASE_URL` (prints, does not write) **or** a hand-written
     `information_schema` query in the Neon SQL editor. Capture: existing tables, columns, enums,
     indexes, and the presence/contents of `_prisma_migrations`.
   - Reconcile actual `_prisma_migrations` rows against the two files. **Do not** assume they are applied.
3. **Baseline if drift is confirmed.** If tables exist but history does not, mark the existing files as
   applied via `npx prisma migrate resolve --applied <name>` (metadata only, no schema change). If the
   `CEO` table exists with the expected columns, baseline `20240102000000_create_ceo_model`; otherwise
   reconcile manually and record the discrepancy in `PROJECT_STATUS.md`.
4. **Generate additive SQL, review, then apply.** For each new phase, author the migration as **pure
   additive DDL** (new tables, new enums, new nullable/defaulted columns, new indexes/constraints).
   - Preferred generation: `npx prisma migrate diff --from-schema-datasource <schema> --to-schema-datamodel <schema> --script`
     run **locally/generated and reviewed**, then applied through the pooled connection
     (`prisma db execute --url "$DATABASE_URL" --file <migration.sql>`) or the Neon SQL editor, because
     `DIRECT_URL` is unreachable.
   - After applying, mark it with `prisma migrate resolve --applied <name>` so history matches the DB.
5. **Verify** post-migration: row counts unchanged for existing tables, new tables empty, indexes present,
   app `/api/health` returns `ok`, and the two legacy CEO routes/back-compat still respond.
6. **Create `migration_lock.toml`** and commit it once the workflow is re-established.

> If the team prefers, an alternative is to keep all additive DDL in a versioned SQL folder applied via
> the pooler, with `_prisma_migrations` reconciled manually. Either way: **additive, observed, backed up.**

### 1.4 Additive mapping of Economy V2 concepts onto the existing schema

- **Keep `CEO` as the catalog table** and preserve every existing column and value. Add nullable/defaulted
  economy columns (`baseSpPerCycle`, `maxOwned`, `isStarter`, `rewardEligible`, `category`, …) with safe
  defaults, leaving `dailyRatePercent` in place for Market back-compat until an approved display switch.
- **Alternatively (recommended for clean modelling):** introduce `CeoTemplate` as a *new* table and
  backfill from `CEO` in an additive data step, keeping `CEO` readable. This avoids overloading the legacy
  table but requires an explicit, reversible backfill. Decision deferred to Phase 6B kickoff (see §4).
- **New tables** all reference `User.id`; no changes to `User` beyond optional nullable columns.

---

## 2. Cross-cutting engineering requirements (apply to all phases)

- **Transactions:** interactive `prisma.$transaction` (or equivalent) with retry on serialization
  failure; validate Neon-adapter semantics in the Phase 6B spike.
- **Idempotency:** `IdempotencyKey(userId, scope, key)` unique; replay returns the original result.
- **Ledger:** immutable append-only `SpLedgerEntry` (and XP/TechParts/Energy ledgers) with unique
  `(sourceType, sourceId)`; balances are derived/aggregated, never client-supplied.
- **Math:** integer SP; basis points for percentages; `floor` at defined points; no floating point.
- **Validation/authz:** Zod schemas in `server/src/validation/*`; `requireAuth` for player routes,
  `requireAdmin` (+ audit) for admin routes; dedicated rate limits on economy mutations; keep cookie flags.
- **Snapshotting:** freeze config/rate/bonus inputs into a cycle at start; admin changes never
  retroactively alter active cycles or earned balances.
- **Env:** preload dotenv / read env lazily before adding config-reading modules (audit §2.1).
- **Types:** put shared economy DTOs in `shared/` (currently unused) and consume from client.
- **Tests:** introduce a minimal test runner in Phase 6B (e.g. Node's built-in `node:test` + `tsx`, no
  new heavy deps) covering concurrency/idempotency invariants; grow per phase.

---

## 3. Phase roadmap (small, independently testable)

Each phase lists: Goal · Files · DB changes · Backend endpoints · Frontend · Security/validation ·
Acceptance criteria · Dependencies.

---

### Phase 6A — Audit & plan (THIS PHASE)

- **Goal:** Read-only audit + safe migration strategy + roadmap. **Done (docs only).**
- **Files:** `docs/ECONOMY_V2_AUDIT.md`, `docs/ECONOMY_V2_IMPLEMENTATION_PLAN.md`, `PROJECT_STATUS.md`.
- **DB / Backend / Frontend:** none.
- **Acceptance:** both documents exist; no code/schema/data changed.

---

### Phase 6B — Schema foundation, concurrency spike, ownership & starter grant

- **Goal:** Land the additive economy schema foundation and the first server-authoritative feature:
  permanent CEO ownership + idempotent free starter grant. Prove transactions/idempotency work on Neon.
- **Files likely affected:**
  - `server/prisma/schema.prisma` (additive models only), one new migration folder + `migration_lock.toml`.
  - `server/src/lib/prisma.ts` (tx helper/retry), new `server/src/lib/idempotency.ts`, `server/src/lib/money.ts`.
  - New `server/src/routes/game/ceos.ts` (owned fleet + starter), `server/src/validation/game.ts`.
  - `server/src/index.ts` (mount `/api/game`), `server/src/routes/auth.ts` (capture `ref`, call grant).
  - `shared/index.ts` (owned-CEO DTOs).
  - Client (read-only integration later; no UI redesign): `client/src/lib/ceos.ts` add owned fetchers.
  - Tests: `server/src/**/*.test.ts` + npm test script.
- **DB changes (additive):**
  - `OwnedCeo` (id, userId FK, templateId FK→CEO, acquisitionType enum, level default 1, cycleLimit
    nullable, completedRewardCycles default 0, status enum, acquiredAt); unique index as needed.
  - Economy columns on `CEO` (nullable/defaulted) **or** new `CeoTemplate` + backfill (see §1.4).
  - `IdempotencyKey`; `SpLedgerEntry` (foundation, empty); optional `EconomyConfigVersion` seeds.
  - Optional nullable `User.referredBy` / `ReferralAttribution` foundation (attribution only, no rewards).
- **Backend endpoints:**
  - `GET /api/game/ceos/owned` — list owned copies + state.
  - `POST /api/game/ceos/starter` (or grant inside register) — idempotent starter grant.
  - `POST /api/game/ceos/:ownedId/...` placeholders reserved for later phases (not implemented).
- **Frontend:** wire `CEOs.tsx` "My CEOs" tab to `GET /api/game/ceos/owned`; keep existing Market intact;
  no visual redesign. Capture `?ref=` server-side at registration (no reward yet).
- **Security/validation:** Zod on all inputs; ownership always derived from `req.user.id`; enforce
  one starter per user via transaction + unique constraint; rate-limit starter/purchase routes.
- **Acceptance:** audit §15 invariants **1** (single starter incl. concurrent retries) and **13/14**
  (legacy routes + Phase 5H intact); new tables additive; `npm run build --workspace=server` and client
  build pass; concurrency spike demonstrates no double-claim/double-grant.
- **Dependencies:** owner approval of migration strategy + Neon backup; confirmation of catalog/additive
  approach (§1.4); resolved env-loading question.

---

### Phase 6C — Production engine (energy, start/collect, ledger, bulk)

- **Goal:** Server-authoritative 4h cycles: energy spend, start, timed completion, single claim, manual
  restart, bulk start/collect, SP credited exactly once.
- **Files:** `schema.prisma` (additive: `ProductionCycle`, `EnergyAccount`, confirm `SpLedgerEntry`);
  new `server/src/routes/game/production.ts`; `server/src/lib/production.ts` (pure calc), `energy.ts`;
  validation additions; shared DTOs; client `lib` fetchers + minimal wiring in existing pages (no redesign).
- **DB changes (additive):** `ProductionCycle` (userId, ownedCeoId, startsAt, endsAt, status, config
  version/snapshot fields, `rewardSpSnapshot`, `claimedAt`, unique claim constraint); `EnergyAccount`
  (energy, capacity, lastRegeneratedAt, version); optional `RequestKey`/`IdempotencyKey` reuse.
- **Backend endpoints:** `POST /api/game/ceos/:ownedId/start`, `.../collect`,
  `POST /api/game/ceos/bulk-start`, `POST /api/game/ceos/bulk-collect`, `GET /api/game/resources`.
- **Frontend:** replace DEMO cycles in Dashboard/Wallet/Empire read paths with real data; countdown is
  display-only; keep demo fallback if API unavailable. **No visual changes.**
- **Security/validation:** start validates ownership/state/energy/cycle eligibility/rate; atomic
  reserve+energy debit+cycle create; collect requires `now ≥ endsAt`, exactly-once via unique constraint;
  bulk returns per-item `{started|collected|skipped, reason}`; per-user + per-route rate limits.
- **Acceptance:** invariants **3, 4, 5, 6** (no concurrent cycle, no double claim, no accrual past end,
  no negative/over-cap energy, retry-safe bulk).
- **Dependencies:** 6B (ownership, tx/idempotency helpers); approved energy params and cycle policy.

---

### Phase 6D — Progression: XP, levels, Tech Parts, upgrades, buildings

- **Goal:** XP/level progression, Tech Parts ledger, per-copy CEO upgrades, building ownership/modifiers,
  energy capacity/regen from buildings.
- **Files:** `schema.prisma` (additive: `ProgressAccount`, `TechPartLedger` or generalize ledger,
  `BuildingTemplate`, `OwnedBuilding`, `CeoUpgrade`/level fields on `OwnedCeo`); `server/src/routes/game/
  upgrades.ts` + `buildings.ts`; calc in `lib/bonuses.ts`; shared DTOs; client wiring.
- **DB changes (additive):** progress + building tables; upgrade bonus columns; ledger source types.
- **Backend endpoints:** `POST /api/game/ceos/:ownedId/upgrade`, `GET /api/game/buildings`,
  `POST /api/game/buildings/:id/unlock`.
- **Frontend:** wire Empire buildings/levels and Profile/Dashboard progression to real endpoints; keep
  existing visuals. No redesign.
- **Security/validation:** prerequisite checks, atomic Tech Parts debit, upgrade affects **future** cycles
  only, declared bonus stacking order + configured global cap.
- **Acceptance:** upgrade/level invariants; frozen-cycle bonus isolation; no negative Tech Parts.
- **Dependencies:** 6C (cycles/snapshots), approved upgrade/building numbers.

---

### Phase 6E — Missions, referral milestones, reward CEOs (manual approval)

- **Goal:** Mission definitions, evidence submission, admin manual review, one-time reward bundles,
  finite/unlimited-cycle reward CEO grants; referral attribution + milestone awards.
- **Files:** `schema.prisma` (additive: `MissionDefinition`, `MissionSubmission`, `MissionRewardGrant`,
  `ReferralAttribution`, `ReferralMilestoneAward`); `server/src/routes/game/missions.ts`,
  `admin/missions.ts`; validation; client Tasks wiring.
- **DB changes (additive):** mission/referral tables with unique idempotency constraints
  (`submissionId/rewardId`, `userId/milestoneId`).
- **Backend endpoints:** spec §13 mission/referral routes; admin review queue + decision endpoint.
- **Frontend:** Tasks page reads real missions/status; Profile referral status. No visual redesign.
- **Security/validation:** only manual admin approval triggers a grant; unique constraints prevent
  double awards; anti-Sybil/self-referral rejection; URL uniqueness; audit every decision.
- **Acceptance:** invariants **7, 8, 9** (reward-CEO allowance consumption, exactly-once grant,
  no duplicate/self referrals).
- **Dependencies:** 6C/6D (cycles, progression); approved reward tables and eligibility rules.

---

### Phase 6F — Admin Economy Control Center

- **Goal:** Versioned admin config (catalog, rates, energy, upgrades, buildings, missions, milestones),
  audit trail, preview tools, review queues, safety switches.
- **Files:** `schema.prisma` (additive: `EconomyConfigVersion`, `AdminAuditLog`); `server/src/routes/
  admin/economy.ts`; new admin UI pages under `client/src/pages/admin/*` (new screens only; no changes
  to Phase 5H visuals).
- **DB changes (additive):** config-version + audit-log tables; `effectiveAt`, `createdBy`, `reason`,
  before/after snapshots.
- **Backend endpoints:** spec §13 admin economy routes (`GET`/`PATCH /api/admin/economy/...`).
- **Security/validation:** admin RBAC (existing), two-person approval where feasible, immutable audit,
  preview impact, emergency stop for **new** issuance/sales only (never alter accrued balances).
- **Acceptance:** invariant **10** (config changes never retroactively change active cycles/earned SP).
- **Dependencies:** 6B–6E (entities to configure); existing admin API pattern.

---

### Phase 6G — Full testing, hardening, reconciliation

- **Goal:** Unit/integration/concurrency tests, ledger reconciliation, PWA mobile workflows, failure
  recovery, abuse simulation, migration-history reconciliation recorded in `PROJECT_STATUS.md`.
- **Files:** `server/src/**/*.test.ts`, CI/test scripts, docs.
- **DB:** none (verification only). Repo-wide: initialize version control if still absent.
- **Acceptance:** invariant **15**; all §15 invariants green; builds pass; no regressions to legacy paths.
- **Dependencies:** 6B–6F.

---

### Phase 6H — Financial readiness (OUT OF SCOPE; external sign-off required)

- **Goal:** Legal/regulatory, custody/payment providers, reserve reconciliation, KYC/AML, secure
  redemption state machine, disclosures, monitoring.
- **Rule:** Nothing in this plan authorizes payments, deposits, withdrawals, crypto or live USDT. No
  redemption endpoints are implemented in Phase 6.

---

## 4. Open decisions requiring owner approval (blockers)

1. **Catalog modelling:** extend `CEO` with economy columns vs introduce `CeoTemplate` + additive
   backfill (recommended). Both preserve existing values; the choice affects later migrations.
2. **Numeric catalogue & rates** (spec §2.2): SP/cycle, energy costs, max copies, starter eligibility,
   upgrade costs/bonuses, building costs/bonuses, mission/referral rewards, energy cap/regen.
3. **Cycle allowance policy:** confirm consumption on successful claim; treatment of abandoned/cancelled
   cycles.
4. **Conversion baseline:** confirm 10,000 SP = 1 USDT and minimum 50,000 SP are *illustrative only* for
   now (no implementation in Phase 6).
5. **Bulk semantics:** confirm deterministic partial success with per-item results.
6. **Migration execution window + Neon backup/branch** permission, and whether to create
   `migration_lock.toml` and baseline existing migrations now.
7. **Version control:** approve initializing a repository before implementation (strongly recommended).

---

## 5. Proposed first implementation phase

**Phase 6B — Schema foundation, concurrency/idempotency spike, ownership & starter grant.**

Rationale: ownership and an idempotent starter are the smallest server-authoritative slice that
exercises the riskiest unknowns (Neon interactive transactions, unique-constraint idempotency, additive
migration workflow) while touching no financial logic and no Phase 5H visuals. It de-risks every later
phase and makes invariant tests 1/13/14 executable immediately.

Definition of done (summary): additive schema lands via the safe procedure (§1.3); `GET
/api/game/ceos/owned` works; starter grant is exactly-once including concurrent retries; referrals are
captured but unrewarded; server + client builds pass; a concurrency test proves no double grant.

---

## 6. Test matrix (introduced 6B, grown per phase)

| Area | Test |
|---|---|
| Starter grant | concurrent register/retry → exactly one owned CEO |
| Ownership caps | simultaneous purchases do not exceed `maxOwned` (from 6C) |
| Cycle exclusivity | cannot start two cycles on one copy |
| Claim idempotency | same/duplicate collect credits once |
| Time boundary | no SP accrues past `endsAt`; collect before `endsAt` rejected |
| Energy | never negative; regen never exceeds capacity |
| Bulk | per-item results correct; whole op retry-safe |
| Reward CEOs | finite allowance −1 per successful claim; owned after exhaustion |
| Mission grants | repeated admin approval → one grant |
| Referrals | milestone once; self/fake rejected |
| Config snapshot | admin change mid-cycle does not alter active cycle/earned SP |
| Legacy | auth, `/api/ceos`, `/dashboard/classic`, Phase 5H assets unchanged |

---

## 7. Appendix — proposed `PROJECT_STATUS.md` addendum (not applied this phase)

```md
## Phase 6A (planning only)
- Read-only Economy V2 audit + implementation plan:
  `docs/ECONOMY_V2_AUDIT.md`, `docs/ECONOMY_V2_IMPLEMENTATION_PLAN.md`.
- No code, schema, migration or data changes; Phase 5H visuals untouched.
- Key risks recorded: Prisma/Neon drift (no migration_lock.toml; broken CEO seed; out-of-band table),
  no transactions/idempotency/ledger, unreachable DIRECT_URL, no version control, env-load ordering.
- Next: owner approval of Phase 6B (schema foundation + ownership & idempotent starter grant).
```
