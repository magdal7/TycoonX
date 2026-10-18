# Phase 6D.1 — SP Production Engine Architecture

**Status:** Architecture and documentation only. No schema, migration, code, or endpoint changes are
made by this document.
**Repo state:** based on `master` at `d7797b2` (Phase 6C.1 complete; ownership + idempotent starter +
onboarding shipped and integration-verified).
**Companions:** `docs/TYCOONX_ECONOMY_V2_SPEC.md` (§4 production, §5 energy, §10 conversion/reserve,
§12 data, §13 API, §15 invariants), `docs/ECONOMY_V2_IMPLEMENTATION_PLAN.md` (Phase 6C/6D).

> **Naming note.** The implementation plan calls the production engine "Phase 6C" and progression
> (XP/upgrades/buildings) "Phase 6D". This brief labels the production engine design "Phase 6D.1".
> This document follows the brief's phase label while staying aligned with the plan's 6C scope.

## 1. Goal and boundaries

Design the server-authoritative SP production engine for the existing TycoonX stack (React/Vite
client, Express/TypeScript server, Prisma 5.22 + Neon PostgreSQL) **before implementation**.

In scope for the eventual implementation (not built here):

- Each `OwnedCeo` runs an **independent** production cycle; cycle duration **4 hours** initially.
- Production **stops at expiry**; **no auto-restart**; the player returns to **collect** and
  **manually restart**.
- **Individual and bulk** start/collect.
- Rewards computed **server-side** from the owned copy's **start-time snapshot**.
- Exactly-once collection and no reward inflation.
- A **transactional SP ledger** with idempotency.
- A **reserve gate** so no redeemable SP is issued without a funding reservation.

Out of scope / explicitly excluded:

- Real-money payments, deposits, withdrawals, USDT transfer, redemption endpoints.
- Altering `OwnedCeo` ownership limits, starter provisioning, or onboarding (must remain intact).
- XP, Tech Parts, upgrades, buildings, missions (later phases; designed to compose, not built here).

## 2. Current state (gap analysis)

| Area | Present today | Gap for production |
| --- | --- | --- |
| Catalog | `CEO` with `baseSpPerCycle Int?`, `cycleHours Int @default(4)`, `energyCost Int`, `maxOwned`, `isStarter`, `rewardEligible`, `category`, `displayOrder` | None; catalog is fixed-SP ready. |
| Ownership | `OwnedCeo` with `level`, `cycleLimit Int?`, `completedRewardCycles`, `status OwnedCeoStatus` | No cycle/ledger linkage. |
| Status enum | `IDLE, PRODUCING, READY_TO_COLLECT, EXHAUSTED, PAUSED, DISABLED` | No transition logic. |
| Idempotency | `IdempotencyKey` `@@unique([userId, scope, key])` | Reusable; needs `cycle_start` / `cycle_collect` scopes. |
| SP | None | No balance, ledger, or reserve. |
| Energy | None | No account; production start requires an energy decision. |
| Time | App/DB time only | Need authoritative server-time rule for cycle boundaries. |

No `ProductionCycle`, `SpAccount`, `SpLedgerEntry`, `RewardReserve`, or `EnergyAccount` exists
(verified: no references in `server/src`).

## 3. Design principles

1. **Server is the only source of truth** for cycles, SP, energy, reserves, and timestamps.
2. **Integer money math.** SP is an integer; bonuses use basis points; `floor` at defined points; no
   floating-point for financial values.
3. **Immutable ledger.** Every SP credit/debit is an append-only `SpLedgerEntry` with a unique source
   event; balances are a cache that must always reconcile to the ledger sum.
4. **Snapshot at start.** The complete reward formula inputs are frozen in the cycle row; admin/config
   changes can never retroactively change an active cycle or earned SP (spec invariant 10).
5. **No unbacked redeemable SP.** A start reserves the maximum reward against a funded pool; the
   reserve either converts to issued liability on claim or is released on cancellation.
6. **Postgres-safe concurrency.** Serialize with row locks + partial unique indexes; never catch a
   unique violation and continue inside an aborted transaction (lesson from Phase 6C.1).
7. **Additive only.** New tables/enums/indexes/constraints; no change to existing columns or rows.

## 4. Proposed additive data model

All models below are **proposals**; none are applied. Prisma DSL cannot express partial unique
indexes or `CHECK` constraints, so those are added as raw SQL in the same additive migration
(same pattern as `OwnedCeo_starter_user_key` in Phase 6B.1).

### 4.1 `ProductionCycle` (required)

One row per production run of one `OwnedCeo`. Open cycle is `status = 'PRODUCING'`.

```
model ProductionCycle {
  id                   BigInt   @id @default(autoincrement())
  userId               Int
  ownedCeoId           Int
  status               ProductionCycleStatus @default(PRODUCING)
  startsAt             DateTime @default(now())
  endsAt               DateTime
  // Frozen reward inputs (snapshot)
  baseSpPerCycleSnap   Int
  bonusBpsSnap         Int      @default(0)
  rewardSpSnap         BigInt   // exact SP credited on claim
  cycleHoursSnap       Int      @default(4)
  energyCostSnap       Int      @default(0)
  ownedLevelSnap       Int      @default(1)
  formulaVersion       String   @default("v1")
  configVersionLabel   String?
  // Reserve + claim bookkeeping
  reserveEntryId       BigInt?
  claimedAt            DateTime?
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt

  user                 User     @relation(fields: [userId], references: [id], onDelete: Restrict)
  ownedCeo             OwnedCeo @relation(fields: [ownedCeoId], references: [id], onDelete: Restrict)

  @@index([userId, status])
  @@index([ownedCeoId])
  @@index([status, endsAt])
}
```

Raw SQL constraints (in-migration):

```sql
-- At most one open cycle per owned copy (concurrency backstop for start).
CREATE UNIQUE INDEX "ProductionCycle_open_owned_key"
  ON "ProductionCycle"("ownedCeoId")
  WHERE "status" = 'PRODUCING';
```

- `status` is `PRODUCING` (open) → `CLAIMED` (collected) or `CANCELLED` (admin/policy only).
- "Ready to collect" is **derived** from `now >= endsAt`, not stored — no scheduler needed. The
  `OwnedCeo.status` display value (`READY_TO_COLLECT`) is computed on read (or set lazily on collect).
- `rewardSpSnap` is the exact credit; production does not accrue beyond `endsAt` by rule because no
  accrual is stored — collection is all-or-nothing after `endsAt`.

### 4.2 `SpAccount` (required — balance cache)

```
model SpAccount {
  userId          Int      @id
  balanceSp       BigInt   @default(0)
  lifetimeEarnedSp BigInt  @default(0)
  version         Int      @default(0)
  updatedAt       DateTime @updatedAt

  user            User     @relation(fields: [userId], references: [id], onDelete: Restrict)
}
```

- `balanceSp` is a **cache** of `SUM(SpLedgerEntry.amountSp)` for the user; it exists for O(1) reads
  and atomic increments. A reconciliation job/test must prove `balanceSp == ledger sum`.
- `version` supports optimistic concurrency if needed, but the ledger + reserve row locks are the
  primary serialization. Row creation is lazy (`upsert`) for users without an account.

### 4.3 `SpLedgerEntry` (required — immutable source of truth)

```
model SpLedgerEntry {
  id            BigInt   @id @default(autoincrement())
  userId        Int
  amountSp      BigInt   // signed: + credit, - debit
  balanceAfterSp BigInt
  sourceType    SpLedgerSourceType
  sourceId      BigInt?  // e.g. productionCycle.id for CYCLE_CLAIM
  reserveEntryId BigInt?
  metadata      Json?
  createdAt     DateTime @default(now())

  user          User     @relation(fields: [userId], references: [id], onDelete: Restrict)

  @@unique([userId, sourceType, sourceId]) // unique source event => exactly-once credit
  @@index([userId, createdAt])
}
```

- The unique `(userId, sourceType, sourceId)` is the **final anti-double-credit guard**: a cycle can
  credit SP at most once even under concurrent collects. Postgres treats `NULL sourceId` as distinct,
  so unkeyed adjustments are still allowed.
- Append-only by convention and by app policy (no UPDATE/DELETE paths); optionally enforce with a
  DB trigger or `REVOKE UPDATE/DELETE`.
- `balanceAfterSp` is stored for auditability; it must equal the running balance at insert.

### 4.4 `RewardReserve` (required — reserve gate)

A funded issuance pool. Phase 6D uses **test-only funded balances** (no USDT). Minimum: one row per
`poolKey` (start with a single `default` pool).

```
model RewardReserve {
  id                      Int      @id @default(autoincrement())
  poolKey                 String   @unique
  fundedSp                BigInt   @default(0) // test-funded issuance budget (SP units)
  reservedSp              BigInt   @default(0) // max liability of open cycles
  issuedSp                BigInt   @default(0) // liability already credited
  lockedForRedemptionSp   BigInt   @default(0) // future: redemption locks
  redeemedSp              BigInt   @default(0) // future: settled redemptions
  rateVersion             String   @default("v1")
  updatedAt               DateTime @updatedAt
}
```

Raw SQL invariant (in-migration):

```sql
ALTER TABLE "RewardReserve"
  ADD CONSTRAINT "RewardReserve_backed_check"
  CHECK ("fundedSp" >= "reservedSp" + "issuedSp" + "lockedForRedemptionSp" + "redeemedSp");
```

- This single-row `CHECK` makes "no unbacked redeemable SP" a **database-enforced** invariant, not
  just application logic.
- Recommended companion (audit): `RewardReserveEntry` append-only log of `FUNDING | RESERVE | RELEASE
  | ISSUE | ...` events, each linked to its cause (cycle, admin action). Not strictly required for the
  engine but needed for reconciliation reporting.

### 4.5 `EnergyAccount` (recommended companion — decision required)

The spec's start step deducts energy (§4.1, §5.1) and `CEO.energyCost` already exists, but this brief
does not list energy among the explicit minimums. Options:

- **(A) Include now:** `EnergyAccount { userId @id, energy Int, capacity Int @default(100),
  lastRegeneratedAt DateTime, version Int }` with atomic debits and elapsed-interval regeneration.
- **(B) Defer:** start enforces ownership/eligibility/reserve only; energy is added in a later phase.
  Production math is unaffected; the API reserves `energyCostSnap` either way.

Recommendation: **A**, but gate it behind an explicit decision (§12), because starting production
without any energy sink changes the intended economy pacing.

### 4.6 Not required now (deferred)

- `EconomyConfigVersion`: snapshots live inline on `ProductionCycle`, so a config table is not needed
  for invariant 10. Add in Phase 6F (admin control center).
- `ProgressAccount`, buildings, upgrades, missions, redemption — later phases.

### 4.7 Enum additions (proposed)

```
enum ProductionCycleStatus { PRODUCING CLAIMED CANCELLED }

enum SpLedgerSourceType {
  CYCLE_CLAIM
  MISSION_REWARD
  REFERRAL_REWARD
  ADMIN_ADJUSTMENT
  REDEMPTION_LOCK
  REDEMPTION_SETTLE
}
```

Only `CYCLE_CLAIM` is used in this phase; the rest are reserved so later phases never need to alter
an enum in a money path. `OwnedCeoStatus` is unchanged; `PRODUCING`/`READY_TO_COLLECT` become the
active display states, `EXHAUSTED` is used for finite reward CEOs whose allowance is spent.

## 5. Lifecycle and state machine

```
        start (atomic)                 now >= endsAt                collect (atomic)
IDLE ───────────────────▶ PRODUCING ───────────────────▶ (READY*) ───────────────────▶ IDLE / EXHAUSTED
   │                          │                              │
   │                    no auto-restart                claim once only
   └── rejection (owned/limit/energy/reserve)          * derived from server time, not stored
```

1. **Start.** Validate ownership and eligible state; check finite-cycle allowance; reserve the
   maximum reward; (optionally) debit energy; insert `ProductionCycle` with frozen snapshot;
   set `OwnedCeo.status = PRODUCING`. All-or-nothing.
2. **Time.** Duration = `cycleHours` (4 default). No accrual beyond `endsAt`. No background job.
3. **Collect.** After `endsAt`, transition the cycle to `CLAIMED` once, append the `CYCLE_CLAIM`
   ledger entry, update `SpAccount`, settle reserve (`reserved → issued`), and consume one finite
   reward cycle. All-or-nothing.
4. **Restart.** Requires a new explicit start; a stale unclaimed cycle blocks a new start until
   claimed (or cancelled by policy).
5. **Errors.** A failed start leaves no cycle/reserve/energy change. A retried collect with the same
   idempotency key never credits twice.

## 6. Reward formula, snapshots, precision, server time

### 6.1 Formula

```
rewardSp = floor( baseSpPerCycle * (10000 + bonusBps) / 10000 )
           clamped to globalBonusCap and to available reserve
```

- `baseSpPerCycle` is the template value at start (Phase 6D: `bonusBps = 0`; upgrades/buildings
  contribute later). `10000` bps = 100%.
- All arithmetic in integer/BigInt; `floor` once, at the end. No floats.
- Theoretical daily output (`cycleSp × min(6, runnable cycles)`) is **display-only**, never a payout
  guarantee.

### 6.2 Snapshot

The cycle stores every input needed to reproduce `rewardSpSnap` (`baseSpPerCycleSnap`, `bonusBpsSnap`,
`ownedLevelSnap`, `cycleHoursSnap`, `energyCostSnap`, `formulaVersion`, `configVersionLabel`). Config
or catalog edits after start never change an active cycle or its credited amount (invariant 10).

### 6.3 Precision and types

- **SP:** integer. Internally `BigInt` (int8) for account balances and ledger amounts; serialized to
  **strings** in JSON/DTOs (mirrors the existing `Decimal → string` rule for CEO prices).
- **Bonus/percentages:** basis points as `Int`.
- **USD/catalog:** keep existing `Decimal(12,2)` / `Decimal(5,4)` untouched.
- **Conversion (future only):** integer micro-units with a versioned rate; out of scope here.

### 6.4 Server time

- Use **database time** (`now()` / `CURRENT_TIMESTAMP`) for `startsAt`, `endsAt`, and the
  `endsAt <= now()` readiness check, so app clock skew and multiple instances cannot disagree.
- Document NTP-backed DB time; never trust client time or client-supplied timestamps.
- `endsAt = startsAt + cycleHoursSnap` computed in SQL to avoid JS/DB drift.

## 7. Reserve-gate accounting (no unbacked redeemable SP)

Counters live on the single `RewardReserve` row. Define:

```
available = fundedSp - reservedSp - issuedSp - lockedForRedemptionSp - redeemedSp   (must be >= 0)
```

Rules:

- **Grant funding (admin, test-only now):** `fundedSp += x` (audited; Phase 6F UI).
- **Start:** requires `available >= rewardSpSnap`; atomically `reservedSp += rewardSpSnap`. If
  `available` is insufficient, **reject the start** (do not block ownership or earned balances).
- **Collect:** atomically `reservedSp -= rewardSpSnap; issuedSp += rewardSpSnap` (a transfer: the
  invariant total is unchanged) and credit the ledger.
- **Cancel (policy/admin only):** `reservedSp -= rewardSpSnap` (release).
- The `RewardReserve_backed_check` constraint guarantees the invariant at the database level.
- Existing **earned** SP is never destroyed by lack of future funding; only **new** production is
  gated (spec §10.2, invariant 11).
- Phase 6D seeds a **test-funded** budget explicitly labelled non-monetary; there is no deposit,
  withdrawal, or USDT path.

## 8. API contracts (proposed; not implemented)

All routes authenticated (`requireAuth`), Zod-validated, under the existing `/api/game` rate-limited
mount. User identity always from `req.user.id`; bodies never carry identity, prices, or rewards.

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/game/ceos/owned` | Existing; **additively** include current `cycle` (status, startsAt, endsAt, rewardSpSnap) and `canStart`/`canCollect`. |
| GET | `/api/game/resources` | `{ sp: { balance, lifetimeEarned }, energy?: {...} }`. |
| POST | `/api/game/ceos/:ownedId/start` | Start one cycle. |
| POST | `/api/game/ceos/:ownedId/collect` | Collect one completed cycle (idempotent). |
| POST | `/api/game/ceos/bulk-start` | Start selected copies; per-item results. |
| POST | `/api/game/ceos/bulk-collect` | Collect selected ready cycles; per-item results. |
| GET | `/api/game/sp/ledger` | Paginated immutable SP history. |

**Start** — request `{ idempotencyKey?: string }` (UUID; server also derives an internal key).
Response `200`:
```json
{
  "ownedId": 12,
  "cycle": { "id": "9001", "status": "PRODUCING", "startsAt": "...", "endsAt": "...", "rewardSp": "20" },
  "resources": { "energy": 98 }
}
```
Errors: `401` unauth; `403` not owner; `404` owned unknown; `409` already producing / exhausted /
finite allowance spent; `422` insufficient reserve or energy. Replay of the same idempotency key
returns the same cycle with `replayed: true`.

**Collect** — response `200`:
```json
{
  "ownedId": 12,
  "cycleId": "9001",
  "status": "CLAIMED",
  "rewardSp": "20",
  "balanceSp": "140",
  "alreadyCollected": false
}
```
Errors: `409` not ready (`now < endsAt`); replay after claim returns `alreadyCollected: true` with the
original amount (never double-credits).

**Bulk** — request `{ ownedIds: number[], idempotencyKey?: string }`, max size enforced (e.g. 50).
Response:
```json
{
  "results": [
    { "ownedId": 12, "ok": true, "cycle": { "...": "..." } },
    { "ownedId": 13, "ok": false, "reason": "not_ready" }
  ],
  "summary": { "succeeded": 1, "skipped": 1 }
}
```
Deterministic partial success; the client is told exactly what succeeded (invariant 6).

## 9. Transaction boundaries and concurrency

### 9.1 Start (single) — one transaction

1. `SELECT ... FOR UPDATE` the `OwnedCeo` row (serialize per copy) and verify `userId`, status,
   template active, finite allowance.
2. Compute `rewardSpSnap` (integer math).
3. Atomic reserve:
   `UPDATE "RewardReserve" SET "reservedSp" = "reservedSp" + :sp WHERE "poolKey" = 'default' AND
   "fundedSp" - "reservedSp" - "issuedSp" - "lockedForRedemptionSp" - "redeemedSp" >= :sp`; require
   `affected = 1`, else `422 insufficient_reserve`.
4. (Optional) atomic energy debit with the same `WHERE energy >= cost` guard.
5. `INSERT ProductionCycle (...snapshot..., endsAt = now() + interval)`; the partial unique index
   rejects a second open cycle for the same copy.
6. `UPDATE OwnedCeo SET status = 'PRODUCING'`.
7. Claim the request `IdempotencyKey` (`scope = 'cycle_start'`).

Any failure rolls back everything (invariant: no partial energy/reserve/cycle).

### 9.2 Collect (single) — one transaction

1. Load the open cycle for `(ownedCeoId, userId)`; if `now() < endsAt` → `409 not_ready`.
2. **Atomic claim transition:**
   `UPDATE "ProductionCycle" SET status = 'CLAIMED', claimedAt = now() WHERE id = :id AND status =
   'PRODUCING'`; require `affected = 1`. This is the duplicate-collection guard.
3. `INSERT SpLedgerEntry (sourceType = 'CYCLE_CLAIM', sourceId = cycleId, amountSp = rewardSpSnap)`.
   The unique `(userId, sourceType, sourceId)` is the final anti-double-credit backstop.
4. `UPDATE SpAccount` increment (upsert if missing).
5. `UPDATE RewardReserve SET reservedSp -= sp, issuedSp += sp`.
6. Finite allowance: `completedRewardCycles += 1`; set `OwnedCeo.status = EXHAUSTED` if the limit is
   reached, else `IDLE`.
7. Claim the request `IdempotencyKey` (`scope = 'cycle_collect'`).

If step 2 affects 0 rows because another request already claimed it, treat it as a **replay**: read
the ledger entry for `(userId, CYCLE_CLAIM, cycleId)` and return `already_collected`.

### 9.3 Concurrency guarantees

| Race | Guard |
| --- | --- |
| Two simultaneous starts on one copy | Row lock on `OwnedCeo` + partial unique `ProductionCycle_open_owned_key` (P2002 backstop). |
| Two simultaneous collects | Atomic `UPDATE ... WHERE status = 'PRODUCING'` (single winner). |
| Same collect retried (double credit) | Ledger unique `(userId, sourceType, sourceId)`. |
| Reserve oversubscription | Conditional `UPDATE` with `available >= :sp` and `affected = 1`, plus the `CHECK` constraint. |
| Deadlock in bulk | Process items in a **consistent order** (ascending `ownedCeoId`), each item in its own transaction. |
| Aborted transaction reuse | Never catch a unique violation and continue in the same transaction; reconcile outside (pattern proven in Phase 6C.1). |

### 9.4 Idempotency keys

- Reuse `IdempotencyKey` with `scope` values `cycle_start`, `cycle_collect`, `bulk_start`,
  `bulk_collect`; unique `(userId, scope, key)`, claimed as the first write of the transaction.
- A unique violation ripples out, rolls back cleanly, and the replay result is derived from committed
  state **outside** the transaction (bounded retry only if no winner is visible yet).

### 9.5 Bulk semantics

- Validate request size (e.g. ≤ 50 items) and ownership of every id.
- Per-item transaction (deterministic partial success); never report overall success when some items
  failed.
- Optional overall idempotency key; per-item keys derived from it.
- Return per-item `{ ownedId, ok, reason?, cycle? }` and a summary.

## 10. Tests

### 10.1 Unit (pure, no DB)

- `computeCycleSp(baseSp, bonusBps, cap)` — flooring, cap clamp, zero/overflow edges.
- Reserve `available` math and rejection when negative.
- Cycle state derivation from `(status, startsAt, endsAt, now)`.
- DTO serialization of `BigInt` → string; no precision loss.
- Bulk result assembly and ordering.

### 10.2 Real-PostgreSQL integration (extend the Phase 6C.1 harness)

Reuse the fail-closed harness (isolated disposable Neon branch; `TEST_DATABASE_URL` only; positive
`neon.branch_id`/`neon.project_id` allowlist; schema guard before writes; `itest_` tagged rows;
suite-level cleanup sweep). New cases:

1. **Start exactly-once:** repeated start with same key → one open cycle; retry returns the same cycle.
2. **Concurrent start:** `Promise.all` starts on one copy → exactly one `PRODUCING` cycle.
3. **Collect timing:** collect before `endsAt` → `409`; no ledger entry.
4. **Collect exactly-once:** `Promise.all` collects after `endsAt` → exactly one `CYCLE_CLAIM` entry,
   one `SpAccount` credit, `reserved → issued` once.
5. **Sequential double collect:** second call is a replay with `alreadyCollected`, zero extra credit.
6. **Reserve gate:** start rejected when `available < rewardSp`; `reservedSp`/`issuedSp` invariants
   hold after start+claim; `CHECK` never violated.
7. **Snapshot freeze:** change catalog `baseSpPerCycle` (or bonus) after start → claim credits the
   snapshot, not the new value.
8. **Rollback:** force a failure mid-start (e.g. reserve passes, cycle insert fails) → no cycle, no
   reserve change, no energy change.
9. **Bulk partial success:** mixed eligible/ineligible ids → correct per-item results; retry-safe.
10. **Reconciliation:** `SpAccount.balanceSp` equals `SUM(SpLedgerEntry.amountSp)`; reserve counters
    equal ledger-derived totals.
11. **Energy (if included):** no negative energy; regeneration never exceeds capacity.

## 11. Migration strategy, backward compatibility, risks

### 11.1 Strategy

- **Additive only:** new tables, enums, indexes, and `CHECK` constraints; no changes to `User`,
  `CEO`, `OwnedCeo`, `IdempotencyKey`, `ReferralAttribution` columns or rows.
- **Frozen migration:** hand-written `migration.sql` including the partial unique index and the
  `CHECK` constraint (Prisma DSL cannot express them), checksum-frozen like Phase 6B.1.
- Apply only via the approved isolated-branch procedure (`docs/PHASE_6B4*`). Do **not** run from this
  design phase.
- Seed only a **test-funded** `RewardReserve` row (`poolKey = 'default'`) with an explicit
  non-monetary budget; no production data touched.

### 11.2 Risks

| Risk | Severity | Mitigation |
| --- | --- | --- |
| Migration history is unbaselined / direct migrations fail `P1001` | High | Use the established isolated-branch migration workflow; never reset; verify drift first. |
| Partial unique index + `CHECK` not expressible in Prisma DSL | Medium | Hand-written SQL mirroring the Phase 6B.1 pattern; schema tests assert their presence. |
| `BigInt` serialization through Express/JSON | Medium | Central serializer to strings; integration test asserts `typeof === 'string'`. |
| Reserve model too coarse (single pool) | Medium | Start with `poolKey`; allow per-source pools later without schema rewrite. |
| Clock/timezone drift | Medium | Use DB time only; NTP; never client time. |
| No background scheduler for `READY_TO_COLLECT` | Low | Derive readiness from `now >= endsAt`; no job needed. |
| Energy omitted changes pacing | Medium | Open decision §12; either include `EnergyAccount` or explicitly defer. |
| Ledger mutable by mistake | Medium | Append-only policy + optional trigger/`REVOKE`; unique source event. |
| Bulk partial failures confuse clients | Low | Deterministic per-item results + request size limit. |

### 11.3 Backward-compatibility requirements

- Existing routes `GET /api/game/ceos/owned`, `POST /api/game/ceos/starter`,
  `POST /api/game/onboarding`, `/api/auth/*`, `/api/ceos*` keep working unchanged.
- Ownership limits (`maxOwned`) and starter provisioning (partial index + idempotency) are untouched.
- `dailyRatePercent` remains a legacy display field; `baseSpPerCycle` drives production.
- The `OwnedCeo` DTO change is **additive** (new `cycle`/`canStart`/`canCollect` fields); existing
  fields and consumers keep working.
- No client visual redesign; wiring is read-path only.

## 12. Open decisions (need owner sign-off)

1. **Energy now vs later** — include `EnergyAccount` in this phase (recommended) or defer.
2. **SP numeric type** — `BigInt` (recommended, string-serialized) vs `Int`.
3. **Cycle status modeling** — store only `PRODUCING/CLAIMED/CANCELLED` with time-derived readiness
   (recommended) vs a materialized `READY_TO_COLLECT`.
4. **Reserve scope** — single `default` pool (recommended to start) vs per-template/per-source pools.
5. **Test-funded reserve value** — how much test SP is seeded, and whether start is gated on it from
   day one or behind a dev override.
6. **Bulk limits/semantics** — max items per request and whether an overall idempotency key is
   required.
7. **Finite reward-CEO allowance** — confirm consumption on **successful claim** (spec recommendation)
   and the treatment of abandoned cycles.
8. **Cancellation policy** — who may cancel an open/abandoned cycle and how the reserve is released.
9. **Rate limits** — per-user/per-route values for start/collect/bulk.
10. **Config table** — confirm inline snapshots now and `EconomyConfigVersion` deferred to Phase 6F.

## 13. Invariant mapping (spec §15)

| Invariant | How this design satisfies it |
| --- | --- |
| 3 — one cycle per copy, no double claim | Row lock + partial unique index; atomic claim `UPDATE`. |
| 4 — no SP before claim, no accrual past end | Reward frozen at start; credited only on claim after `endsAt`. |
| 5 — energy non-negative / cap (if included) | Conditional energy `UPDATE` + elapsed-interval regen. |
| 6 — bulk correctness / retry-safe | Per-item transactions, per-item results, idempotency keys. |
| 10 — config change cannot alter active cycle | Full snapshot on `ProductionCycle`. |
| 11 — no unbacked redeemable SP | Reserve gate + `RewardReserve_backed_check`. |
| 12 — ledgers reconcile | Immutable `SpLedgerEntry`; `SpAccount` balances reconcile to ledger sum. |
| 13 — legacy routes still function | Additive-only changes; existing endpoints untouched. |

## 14. Proposed implementation order (for a later, approved phase)

1. Additive migration + schema guard tests (no routes).
2. `lib/production.ts` pure calc + unit tests.
3. Reserve + ledger services with real-PostgreSQL integration tests (extend the 6C.1 harness).
4. Start/collect services + single endpoints.
5. Bulk endpoints + DTOs + owned-view `cycle` fields.
6. Client read-path wiring (no visual redesign).
7. Reconciliation test + docs.

No migration, endpoint, or code changes are performed by Phase 6D.1.