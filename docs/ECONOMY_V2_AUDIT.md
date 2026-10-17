# TycoonX — Economy V2 Audit (Phase 6A)

**Status:** Read-only audit. Planning/documentation only — no code, schema, migration or data changes.  
**Date:** 2026-10-17  
**Author:** Lead software architect  
**Target spec:** `docs/TYCOONX_ECONOMY_V2_SPEC.md` (V2.3)  
**Companion:** `docs/ECONOMY_V2_IMPLEMENTATION_PLAN.md`

> Method: every claim below is derived from inspected repository files. Where a fact could not be
> verified without touching the database, it is explicitly marked **UNVERIFIED**. No live DB query,
> migration, `push` or data write was executed during this audit.

---

## 1. Documents reviewed

| File | Present | Notes |
|---|---|---|
| `AGENTS.md` | Yes | Architectural constraints, Windows/PowerShell and Neon/Prisma rules. |
| `PROJECT_STATUS.md` | Yes | Prior phase history; treats earlier summaries as stale. |
| `PROJECT_REVIEW.md` | Yes | Pre-design review; subsystem status markers. |
| `docs/TYCOONX_ECONOMY_V2_SPEC.md` | Yes | Target product design (V2.3); includes its own Phase 6 plan. |
| `docs/ECONOMY_V2_AUDIT.md` | This file | Created in this phase. |
| `docs/ECONOMY_V2_IMPLEMENTATION_PLAN.md` | Yes | Created in this phase. |

No required document was missing. `PROJECT_STATUS.md` was **left unchanged** in this phase pending
approval (see Implementation Plan §Appendix for the proposed status addendum).

---

## 2. Architecture summary (verified)

- **Monorepo** (npm workspaces): `client`, `server`, `shared`. Root `package.json` scripts are `dev`,
  `dev:client`, `dev:server`, `install:all`. Repo is **not** a git repository (no history/diff/branch safety net).
- **Client**: React 18.3.1 + Vite 5 + Tailwind 3 + `lucide-react` + `vite-plugin-pwa`. Custom history
  router (`client/src/components/router.tsx`), **not** react-router. Auth via
  `client/src/context/AuthContext.tsx`. Pages: Landing, Login, Register, Dashboard, GameHome, CEOs,
  Empire, Tasks, Wallet, Profile.
- **Server**: Express 4 + TypeScript ESM, executed with `tsx` (tsconfig `noEmit`, no `dist`), port 4000.
  Entry `server/src/index.ts`. Routes: `auth`, `ceo`. Middleware: `middleware/auth.ts`
  (`requireAuth`, `requireAdmin`). Validation: Zod in `server/src/validation/*`.
- **DB**: Neon PostgreSQL via Prisma 5.22 + `@prisma/adapter-neon` + `@neondatabase/serverless` `Pool`.
  `DATABASE_URL` = pooled connection; `DIRECT_URL` = direct (used for migrations).
- **Vite dev**: `:5173` proxies `/api` → `:4000`; `resolve.dedupe: ['react','react-dom']`.
- **Shared**: `shared/index.ts` exports a single `HealthResponse` type; **not imported anywhere** (unused).

Server request pipeline (`server/src/index.ts`): CORS (reflects any origin, `credentials:true`),
`cookieParser`, `express.json`, rate-limit on `/api/auth` only (20 / 15 min), then routes.
`/api/health` performs `SELECT 1` with a 5s timeout.

### 2.1 Known latent environment issue (new finding)

`server/src/index.ts` calls `dotenv.config()` in the module body (line 11), but ESM evaluates imported
modules first. `server/src/lib/prisma.ts` (reads `DATABASE_URL`) and `server/src/lib/auth.ts` (reads
`JWT_SECRET`, throws if absent) read `process.env` **at import time**, i.e. potentially **before**
`.env` is loaded. Any future module that reads economy config from `process.env` at import time inherits
the same hazard. **Recommend:** preload dotenv (or read env lazily) before adding economy modules.
Must be verified against the actual run behaviour; treat as a risk to confirm in Phase 6B.

---

## 3. Subsystem classification

Legend: **[1] Implemented**, **[2] Partial**, **[3] UI/demo only**, **[4] Missing**, **[5] Requires refactor**.

| Subsystem | Class | Evidence |
|---|---|---|
| Auth (register/login/logout/me) | **[1]** | `routes/auth.ts`; JWT httpOnly cookie 7d, bcrypt 12, Zod, role USER/ADMIN. |
| Auth UI | **[1]** | `Login.tsx`, `Register.tsx`; client validation, error/loading. |
| Health + admin ping | **[1]** | `/api/health`, `/api/admin/ping` (admin-only). |
| CEO catalog API (read) | **[1]** | `GET /api/ceos`, `GET /api/ceos/:id`, Decimal→string. |
| CEO catalog admin CRUD | **[2]** | POST/PUT/DELETE exist and are admin-guarded; **no admin UI**. |
| CEO Market UI | **[1]** | `pages/CEOs.tsx` + `lib/ceos.ts`; real API, search/filter/sort; "Buy — Coming Soon". |
| Layout / nav / router | **[2]** | `components/Layout.tsx`, `router.tsx`; 404 added in App, but router still fragile. |
| Dashboard | **[2]** | Real CEO *preview* + demo level/XP/energy/cycles/tasks (`data/demo.ts`). |
| GameHome isometric world | **[2]** | `game/*` DOM/SVG prototype; PREVIEW HUD; no gameplay logic. |
| Empire page | **[3]** | `pages/Empire.tsx` derives "owned-style" income from `DEMO_CEOS`; no real data. |
| Tasks/Missions | **[3]** | `pages/Tasks.tsx`; hardcoded missions, XP/SP labels, no completion/reward logic. |
| Wallet | **[3]** | `pages/Wallet.tsx`; $0 balances, "Coming Soon" real-money card, demo cycles. |
| Ownership / purchases | **[4]** | No `UserCEO`/`OwnedCeo`; no purchase endpoint; buy disabled. |
| Production cycles / reward collect | **[4]** | Timers/accrual only demo; no server engine. |
| Energy system | **[3]** | `DEMO_PLAYER.energy` bar only; no regen/spend. |
| XP / levels | **[3]** | Demo values only; no progression store. |
| Tech Parts | **[4]** | Not present anywhere. |
| SP ledger / balances | **[4]** | SP only appears as demo mission labels. |
| Buildings / upgrades | **[3]** | Empire visual preview/levels; no ownership or persistence. |
| Referrals | **[2/4]** | `?ref=` carried Landing→`/register?ref=` **visually only**; `Register.tsx` never reads it; no attribution stored. |
| Missions submission/approval | **[4]** | None; Tasks is static. |
| Admin Economy Control Center | **[4]** | No admin screens; only API-level CRUD exists. |
| Audit logs | **[4]** | None. |
| Reward reserve / funding ledger | **[4]** | None. |
| Redemption / payments | **[4]** | Explicitly out of scope; Wallet shows "Coming Soon". |
| Automated tests | **[4]** | No test framework/scripts anywhere. |
| Version control | **[4]** | Not a git repo — no rollback safety net. |
| `shared/` package | **[5]** | Exists but unused; consider for economy DTO types. |

---

## 4. Database schema and migration history

### 4.1 Current Prisma schema (`server/prisma/schema.prisma`)

Models: `AppMeta`, `User`, `CEO`; enum `Role { USER, ADMIN }`.
Generator uses `previewFeatures = ["driverAdapters"]`. Datasource has no `shadowDatabaseUrl`.

**`CEO` fields:** `id`, `name`, `slug @unique`, `rarity String`, `priceUsd Decimal(12,2)`,
`dailyRatePercent Decimal(5,4)`, `cycleHours Int @default(4)`, `energyCost Int`, `isActive Bool`,
`createdAt`, `updatedAt`.

There is **no** table for ownership, production cycles, energy, XP/progress, buildings, SP ledger,
missions, referrals, reserves or audit logs. The schema is a catalog + auth schema only.

### 4.2 Migration files

| Migration | Contents |
|---|---|
| `20240101000000_add_user_model` | `CREATE TYPE "Role"`, `CREATE TABLE "User"`, unique indexes. |
| `20240102000000_create_ceo_model` | `CREATE TABLE "CEO"`, unique `slug`, idempotent seed of 8 CEOs (`ON CONFLICT ("slug") DO NOTHING`). |

**Critical gaps / drift indicators (verified from files):**

1. **No `prisma/migrations/migration_lock.toml`.** Prisma normally writes this on first migrate. Its
   absence indicates migrations may not have been applied through the normal Prisma workflow.
2. **Broken seed in `20240102000000_create_ceo_model`.** `CREATE TABLE "CEO"` declares `"updatedAt"`
   `TIMESTAMP(3) NOT NULL` **with no default**, but the seed `INSERT` omits `updatedAt`. Applying this
   migration fresh would raise a **not-null violation**. (Matches `PROJECT_REVIEW.md §7`.)
3. **Out-of-band table creation.** Documented in `PROJECT_STATUS.md`/`PROJECT_REVIEW.md`: the `CEO`
   table was created via a temporary pooler script because `DIRECT_URL` failed with `P1001`. Therefore
   the physical DB likely **does not match the migration history**, and `_prisma_migrations` state is
   **UNVERIFIED**.
4. **`DIRECT_URL` unreachable (`P1001`)** on this Windows host (documented, recurring). `prisma migrate`
   / `migrate diff` against the direct host may fail; the pooled `DATABASE_URL` works for the app.
5. **Prisma version skew:** `@prisma/client` and `prisma` are pinned `^5.16.1`, while `AGENTS.md` calls
   the stack "Prisma 5.22" and the adapter is `^5.22.0`. Do **not** upgrade as part of economy work.

> **Conclusion:** the DB is **not** assumed synchronized with `schema.prisma` or the migration folder.
> Any migration strategy must first *observe* actual DB state (read-only) and must never reset.

### 4.3 Prisma/Neon runtime behaviour relevant to economy

- App uses `PrismaNeon(new Pool(...))` (serverless driver). Interactive transactions
  (`prisma.$transaction(async tx => ...)`) and row-level locks (`SELECT ... FOR UPDATE`) are the intended
  tools for atomic start/collect, but their exact semantics through the **Neon HTTP/WS pool** must be
  validated before relying on them. **UNVERIFIED** in this repo (no transactions are used anywhere today).
- No transaction, isolation-level, retry or lock-helper utilities exist. Only `/api/health` uses a
  `withTimeout` race.

---

## 5. Authentication and user model

- **Good:** JWT in httpOnly, SameSite=Lax cookie (`secure` in production), 7-day expiry; bcrypt cost 12;
  Zod on register/login; `requireAuth` re-validates the user against the DB on every request (handles
  deleted/promoted users); `requireAdmin` checks `role`.
- **Thin registrations:** `auth.ts` register creates the user and auto-issues a cookie — **no place to
  hook an idempotent starter-CEO grant or referral attribution transactionally**. Economy V2 requires the
  starter grant to be idempotent and traceable, so registration must become transactional or the grant
  must be a separate idempotent operation keyed on `userId`.
- **No email verification / anti-Sybil signals**, which the spec (§3.2, §8.3, §9) flags for starter,
  referral and creator eligibility.
- **Rate limiting only on `/api/auth`** (20/15 min). Economy write endpoints (start/collect/bulk/purchase)
  will need their own limits.
- **CSRF:** cookie auth with `SameSite=Lax` mitigates cross-site POST but is not a full CSRF strategy;
  add an explicit token/origin check for authenticated mutations if threat model requires.
- CORS reflects **any** origin with credentials — acceptable for local dev, flagged for production.

---

## 6. CEO catalog and prices (actual vs Economy V2)

**Actual seeded catalog** (`20240102000000_create_ceo_model`, prices USD-equivalent, simulation only):

| slug | name | rarity | priceUsd | dailyRatePercent | cycleHours | energyCost |
|---|---|---|---:|---:|---:|---:|
| junior-developer | Junior Developer | Common | 5 | 0.1500 | 4 | 10 |
| product-manager | Product Manager | Common | 15 | 0.1800 | 4 | 12 |
| marketing-director | Marketing Director | Rare | 30 | 0.2000 | 4 | 15 |
| startup-founder | Startup Founder | Rare | 50 | 0.2200 | 4 | 18 |
| ai-architect | AI Architect | Epic | 100 | 0.2500 | 4 | 22 |
| cloud-executive | Cloud Executive | Epic | 200 | 0.2800 | 4 | 25 |
| tech-billionaire | Tech Billionaire | Legendary | 500 | 0.3000 | 4 | 30 |
| crypto-whale | Crypto Whale | Mythic | 1000 | 0.3500 | 4 | 40 |

**Economy V2 sample catalog (§3.1)** differs materially:

- 9 templates, adding a **free `Intern CEO`** (starter).
- Reward currency is **fixed `baseSpPerCycle`** (10–600), **not** a percentage of price.
- `energyCost` 2–15 (current is 10–40, i.e. much higher).
- Adds `maxOwned` copy caps (1–10) and theoretical SP/day.
- New rarities/roles implied.

**Implication:** the two are **not field-compatible**. `dailyRatePercent` has no Economy-V2 equivalent,
and `baseSpPerCycle`/`maxOwned` do not exist yet. The client (`lib/ceos.ts`) computes
`dailyProjected = priceUsd × dailyRatePercent / 100`, so any change to this field impacts the live Market.

> **Constraint from briefs:** *preserve existing CEO catalog values.* Therefore the catalog must migrate
> **additively** (new fields defaulted/nullable; existing rows and values untouched) and the eventual
> switch from percentage-yield to SP/cycle must be an explicit, approved, reversible display decision —
> not a silent data rewrite.

---

## 7. Balances: SP, XP, energy

- **All balances are demo only.** `client/src/data/demo.ts` defines `DEMO_PLAYER`
  (`level 5, xp 1240, energy 78/100`), `DEMO_CEOS`, `DEMO_PRODUCTION_CYCLES`, `DEMO_DAILY_TASKS`.
- `Tasks.tsx` hardcodes missions with SP/XP rewards; `Wallet.tsx` shows `0 SP · 0 XP` and "Unavailable"
  real-money balance; `Dashboard.tsx` renders a DEMO-labeled Level/XP/Energy panel.
- **No server-side balance store, no ledger, no regeneration, no spend.** Economy V2 requires
  server-authoritative energy (100 cap, +1 / 5 min) and server-only XP/SP/Tech Parts accounting.

---

## 8. CEO ownership and purchases

- **Missing entirely.** No ownership relation, no quantity/copy cap, no purchase endpoint, no price
  debit, no starter grant. The Market "Buy" button is disabled ("Coming Soon").
- `Empire.tsx` derives an "owned-style" income from `DEMO_CEOS`; `PROJECT_REVIEW.md` explicitly flags
  this as needing migration once ownership exists.
- Economy V2 needs: `CeoTemplate` (or extended `CEO`), `OwnedCeo` (unique copy id, level, origin,
  `cycleLimit` nullable, `completedRewardCycles`, status), idempotent starter grant, per-template copy
  limits affecting only *future* acquisitions.

---

## 9. Production cycles and reward collection

- **Missing.** No start/collect, no timers, no accrual, no snapshots, no claims.
- Demo cycles exist only in `demo.ts`/`Wallet.tsx` (progress bars).
- Economy V2 requires a strict server state machine
  `IDLE → PRODUCING → READY_TO_COLLECT → IDLE`, exactly-one-claim semantics, energy debit at start,
  allowance consumption at claim (finite reward CEOs), frozen formula inputs at start, and no accrual
  after end time — all inside atomic transactions with idempotency keys.

---

## 10. API validation and transaction safety

- **Validation:** Zod is used consistently on auth and CEO routes; query/body parsed with `safeParse`;
  admin routes guarded. **Good baseline.**
- **Transactions / concurrency:** *none.* No `$transaction`, no advisory locks, no optimistic version
  columns, no unique idempotency constraints. Every economy write operation (purchase, start, collect,
  bulk, upgrade, grant) requires these and they do not exist.
- **Idempotency:** no request-key table or unique-event design. The spec's invariants (§15) depend on it.
- **Money/points math:** no fixed-point/rational helpers; client uses floating point for demo only. The
  spec requires integer SP and basis-point math server-side.
- **Error handling:** routes return ad-hoc JSON errors; no central error handler; no logging of security
  events. (No token/password logging observed — good.)

---

## 11. Gap analysis vs Economy V2

### 11.1 Confirmed product decisions (spec §2.1) — treat as requirements

| ID | Decision | Current state | Gap |
|---|---|---|---|
| D01 | Fixed 10,000 SP = 1 USDT (numeric baseline) | No SP, no conversion | Missing; numeric rate needs final sign-off |
| D02 | Fixed SP output per 4h cycle (not % of price) | `dailyRatePercent` model | Schema/field mismatch |
| D03 | Manual start → wait → collect → restart | None | Missing |
| D04 | Individual + bulk start/collect | None | Missing |
| D05 | One free starter CEO | None | Missing |
| D06 | Multiple copies, configurable per-template caps | None | Missing |
| D07 | Permanent ownership | None | Missing |
| D08 | Reward CEOs: unlimited or finite cycles | None | Missing |
| D09 | Manual admin approval for missions | None | Missing |
| D10 | Mission categories incl. referrals/creator | None | Missing |
| D11 | Admin-configurable params + audit + effective dates | None | Missing |
| D12 | SP redeemable; XP/TechParts/Energy not | None | Missing |
| D13 | No CEO trading | N/A | Policy only |
| D14 | Server-authoritative, duplicate-protected | No transactions/ledger | Missing (foundational) |

### 11.2 Illustrative values requiring explicit approval (spec §2.2)

These must **not** be treated as final and must not be encoded before approval:

- Catalog prices, `baseSpPerCycle`, `energyCost`, `maxOwned`, free-unit eligibility (§3.1).
- Energy capacity 100 / regen 1 per 5 min.
- 5 CEO levels with 0/10/20/35/50% cumulative bonuses.
- Tech Parts costs 100/300/800/2,000 and level requirements 2/5/10/20.
- Building list, costs and bonus caps.
- Mission/referral reward tables.
- Redemption minimum 50,000 SP and network/fees.
- Bulk partial-execution, allowance-consumption and budget-reservation policies.

### 11.3 Required new entities vs current schema

Spec §12 conceptual entities — **none exist**: `EconomyConfigVersion`, `CeoTemplate`/`OwnedCeo`,
`ProductionCycle`, `EnergyAccount`, `ProgressAccount`, `BuildingTemplate`/`OwnedBuilding`,
`SpLedgerEntry`, `RewardReserveLedger`, `MissionDefinition`/`MissionSubmission`/`MissionRewardGrant`,
`ReferralAttribution`/`ReferralMilestoneAward`, `AdminAuditLog`, and (future) `PaymentOrder`/`RedemptionRequest`.

---

## 12. Risks

| # | Risk | Severity | Mitigation direction |
|---|---|---|---|
| R1 | DB not synchronized with migrations; `_prisma_migrations` unverified; `CEO` created out-of-band | High | Read-only state inspection; baseline with `migrate resolve`; additive-only migrations; Neon backup/branch first |
| R2 | Broken seed (`updatedAt` NOT NULL, omitted) makes fresh migrate fail | High | Never re-apply that file; fix only via a new additive migration if needed |
| R3 | `DIRECT_URL` P1001 blocks normal `prisma migrate` | High | Apply additive SQL via pooled connection / SQL editor; mark applied with `migrate resolve` |
| R4 | No version control → no safe rollback for schema/code | High | Initialize git (or equivalent) before implementation; take a Neon branch/backup |
| R5 | No transactions/row-locks proven on Neon adapter → double-claim / race risk | High | Validate interactive transactions + unique constraints early (Phase 6B spike) |
| R6 | No idempotency/ledger → duplicate grants/claims | High | Unique constraints + request-key table + immutable `SpLedgerEntry` |
| R7 | Field mismatch `dailyRatePercent` vs `baseSpPerCycle` could break live Market | Medium | Additive fields; keep legacy field; approved display switch only |
| R8 | env loaded after ESM imports (`dotenv.config()` timing) | Medium | Preload dotenv / lazy env reads before adding economy modules |
| R9 | Registration not transactional → non-idempotent starter grant / lost referral | Medium | Idempotent grant keyed by `userId`; capture `ref` server-side |
| R10 | Financial/regulatory exposure if fixed-rate SP redemption implied | High (future) | Keep all payment/redemption out of Phase 6; external legal/compliance sign-off |
| R11 | Financial floats in ledger | Medium | Integer SP + basis-point math server-side only |
| R12 | No tests / no admin UI / unused `shared` | Medium | Introduce test harness in 6B; admin UI in 6F; type economy DTOs in `shared` |

---

## 13. Acceptance-invariant readiness (spec §15)

Current codebase satisfies invariants **13** (auth/CEO/legacy routes functional) and **14** (Phase 5H
untouched) only. Invariants **1–12** and **15** require the ownership, production, ledger, reserve and
test infrastructure that does not yet exist. The Implementation Plan sequences these so each invariant
becomes testable in a small, independently verifiable phase.

---

## 14. Audit conclusions

1. The codebase is a **clean auth + catalog + UI-preview foundation** with no economy logic; all
   balances/cycles/energy/progression are demo-only.
2. **Server-side correctness infrastructure (transactions, idempotency, ledger, locks) is entirely
   absent** and is the true prerequisite for every Economy V2 feature.
3. The **database is the highest-risk area**: drift, a broken seed, an unreachable direct host, no lock
   file and no version control. Migration must be additive, observed and backed up — never reset.
4. The Economy V2 spec is coherent as a target, but its **numeric catalogue and rates are illustrative**
   and conflict with the current catalog; they require approval before encoding, and the existing catalog
   values must be preserved via additive migration.
5. Recommended first implementation phase: **Phase 6B — schema foundation + concurrency/idempotency
   spike + ownership & starter grant** (details in the plan).
