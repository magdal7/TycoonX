# TycoonX — Phase 6B.1 Implementation Report

**Status:** Implementation of safe foundation pieces complete. **No database migration applied. No production
ownership routes enabled.** Awaiting approval.  
**Date:** 2026-10-17  
**Scope:** Step 1 env fix, Step 2 additive schema, Step 3 offline SQL, Step 4 backup gate (STOP before
writes), Step 5 migration commands, Step 6 services + tests, Step 7 verification.  
**Companions:** `docs/PHASE_6B_FOUNDATION_REPORT.md`, `docs/ECONOMY_V2_IMPLEMENTATION_PLAN.md`,
`docs/TYCOONX_ECONOMY_V2_SPEC.md`.

Phase 5H visuals, the renderer, sprites and layouts were **not** modified.

---

## 0. Guardrails honored

- No `prisma migrate reset`, no `db push`, no `db execute`, no DDL, no data write, no migration applied.
- No historical migration replayed.
- No secret or connection string printed.
- Routes that would query the new (nonexistent) production tables were **not** wired.
- The only commands run against the DB in this phase were **offline**: `prisma validate`,
  `prisma migrate diff` (datamodel→datamodel, no connection), and `prisma generate` (client codegen only).

---

## 1. Files changed

**Modified**

| File | Change |
|---|---|
| `server/src/index.ts` | Step 1 env-loading fix (first-line `import 'dotenv/config'`; removed late `dotenv.config()`). |
| `server/prisma/schema.prisma` | Additive economy models/fields/relations (Step 2). Existing models/fields unchanged. |
| `server/package.json` | Added `"test"` script (`node --import tsx --test ...`). |

**Added**

| File | Purpose |
|---|---|
| `server/prisma/migrations/20261017000000_phase6b1_economy_foundation/migration.sql` | Generated + reviewed additive SQL (NOT applied). |
| `server/prisma/migrations/migration_lock.toml` | Standard Prisma lock file (`provider = "postgresql"`). |
| `server/src/lib/idempotency.ts` | `isUniqueViolation`, `claimIdempotencyKey`. |
| `server/src/lib/idempotency.test.ts` | Unit test. |
| `server/src/services/starterCeo.ts` | Idempotent starter grant service. |
| `server/src/services/referral.ts` | Referral attribution service. |
| `server/src/services/ownership.ts` | Ownership read service. |
| `server/src/services/economy.test.ts` | Service tests with in-memory fake Prisma (no DB). |
| `server/src/validation/game.ts` | Zod schemas (`referralCodeSchema`, `ownedCeoIdParamSchema`, `registerWithReferralSchema`). |
| `docs/PHASE_6B1_IMPLEMENTATION_REPORT.md` | This report. |

**Not committed** (working tree contains the changes above). Prisma Client was regenerated to
`node_modules/@prisma/client` (v5.22.0) — ignored by git.

### 1.1 Step 1 — environment-loading fix (applied)

```ts
// server/src/index.ts (top)
import 'dotenv/config'
import express, { Application } from 'express'
// ... (the previous `import dotenv from 'dotenv'` and the late `dotenv.config()` were removed)
```

**Verification (temporary script, since deleted, secrets never printed):**

```
env-order-check: databaseUrl=true jwtSecret=true ok=true
exit=0
```

Running under `tsx` from `server/` (cwd contains `.env`), `dotenv/config` now executes during ESM
evaluation of the first import — before `./lib/prisma` and `./lib/auth` evaluate — so both
`DATABASE_URL` and `JWT_SECRET` are defined when those modules initialize. No credentials were changed.

---

## 2. Schema additions (Step 2)

Everything is **additive**: no existing column, type or row was altered or removed.

### 2.1 Existing `CEO` — new nullable/defaulted columns (legacy fields untouched)

| Column | Type | Default | Notes |
|---|---|---|---|
| `baseSpPerCycle` | `Int?` | `null` | Fixed SP per cycle (future gameplay). |
| `maxOwned` | `Int` | `1` | Per-template copy cap. |
| `isStarter` | `Boolean` | `false` | Marks the free starter template. |
| `rewardEligible` | `Boolean` | `false` | Reward-CEO eligibility. |
| `category` | `String?` | `null` | Free-form grouping. |
| `displayOrder` | `Int` | `0` | Catalog ordering. |

`dailyRatePercent` (and all legacy columns) is **retained** for Market back-compat.

### 2.2 New models

- **`OwnedCeo`** — permanent, individually identifiable copies: `userId`, `templateId`,
  `acquisitionType` (`STARTER|PURCHASE|MISSION|REWARD|ADMIN`), `level`, `cycleLimit` (nullable =
  unlimited), `completedRewardCycles`, `status` (`IDLE|PRODUCING|READY_TO_COLLECT|EXHAUSTED|PAUSED|DISABLED`),
  timestamps. Indexes: `userId`, `templateId`, `(userId, status)`.
- **`ReferralAttribution`** — `referrerId`, `referredUserId @unique`, `code`, `eligible`, timestamps.
- **`IdempotencyKey`** — `userId`, `scope`, `key`, `@@unique([userId, scope, key])`.
- **`AppMeta`** — already in `schema.prisma`; no model change, but the table is **missing in the DB** and
  is created by the new migration.
- **`User`** gained additive back-relations only (`ownedCeos`, `referralsMade`, `referralReceived`,
  `idempotencyKeys`); no columns changed.
- **Enums** added: `AcquisitionType`, `OwnedCeoStatus`. `Role` unchanged.

### 2.3 Database-level constraints

| Constraint | Where | Enforces |
|---|---|---|
| `OwnedCeo_starter_user_key` (partial unique index on `userId WHERE acquisitionType='STARTER'`) | migration raw SQL | **One starter per user** (concurrency backstop) |
| `ReferralAttribution_referredUserId_key` (unique) | Prisma DSL | **One attribution per referred user** |
| `ReferralAttribution_no_self` (`CHECK referrerId <> referredUserId`) | migration raw SQL | **No self-referrals** |
| `IdempotencyKey_userId_scope_key_key` (unique) | Prisma DSL | **Unique idempotency scope/key** |
| `OwnedCeo_userId_fkey`, `OwnedCeo_templateId_fkey` (RESTRICT) | Prisma DSL | **Valid ownership relationships** |
| `ReferralAttribution_*_fkey` (RESTRICT), `IdempotencyKey_userId_fkey` (CASCADE) | Prisma DSL | Referential integrity |

`prisma validate` → **"The schema is valid"**.

---

## 3. Generated SQL (Step 3) — NOT executed

Generated **offline** with:

```
npx prisma migrate diff --from-schema-datamodel <temp: schema_before_6b1.prisma> \
                        --to-schema-datamodel prisma/schema.prisma --script
```

Output was reviewed and written to
`server/prisma/migrations/20261017000000_phase6b1_economy_foundation/migration.sql`, with two deliberate
hand additions: the missing `AppMeta` creation (the datamodel→datamodel diff cannot see it because
`AppMeta` is in both schemas) and the raw-SQL business constraints, plus the approved catalog seed.

Full migration content:

```sql
-- Phase 6B.1 — Economy V2 additive foundation.
-- Generated offline with `prisma migrate diff` (datamodel -> datamodel) and extended by hand.
-- Additive only: new enums, new tables, new nullable/defaulted "CEO" columns, indexes, FKs and seed.
-- Existing "User"/"CEO" columns and rows are preserved; historical migrations are NOT replayed.
-- Apply ONLY after a verified Neon backup exists (see docs/PHASE_6B1_IMPLEMENTATION_REPORT.md).
-- Recommended: apply inside a single transaction.

CREATE TABLE IF NOT EXISTS "AppMeta" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AppMeta_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AppMeta_key_key" ON "AppMeta"("key");

CREATE TYPE "AcquisitionType" AS ENUM ('STARTER', 'PURCHASE', 'MISSION', 'REWARD', 'ADMIN');
CREATE TYPE "OwnedCeoStatus" AS ENUM ('IDLE', 'PRODUCING', 'READY_TO_COLLECT', 'EXHAUSTED', 'PAUSED', 'DISABLED');

ALTER TABLE "CEO" ADD COLUMN     "baseSpPerCycle" INTEGER,
ADD COLUMN     "category" TEXT,
ADD COLUMN     "displayOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "isStarter" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "maxOwned" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "rewardEligible" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "OwnedCeo" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "templateId" INTEGER NOT NULL,
    "acquisitionType" "AcquisitionType" NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "cycleLimit" INTEGER,
    "completedRewardCycles" INTEGER NOT NULL DEFAULT 0,
    "status" "OwnedCeoStatus" NOT NULL DEFAULT 'IDLE',
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OwnedCeo_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ReferralAttribution" (
    "id" SERIAL NOT NULL,
    "referrerId" INTEGER NOT NULL,
    "referredUserId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eligible" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "ReferralAttribution_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IdempotencyKey" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "scope" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OwnedCeo_userId_idx" ON "OwnedCeo"("userId");
CREATE INDEX "OwnedCeo_templateId_idx" ON "OwnedCeo"("templateId");
CREATE INDEX "OwnedCeo_userId_status_idx" ON "OwnedCeo"("userId", "status");
CREATE UNIQUE INDEX "ReferralAttribution_referredUserId_key" ON "ReferralAttribution"("referredUserId");
CREATE INDEX "ReferralAttribution_referrerId_idx" ON "ReferralAttribution"("referrerId");
CREATE UNIQUE INDEX "IdempotencyKey_userId_scope_key_key" ON "IdempotencyKey"("userId", "scope", "key");

ALTER TABLE "OwnedCeo" ADD CONSTRAINT "OwnedCeo_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OwnedCeo" ADD CONSTRAINT "OwnedCeo_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "CEO"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReferralAttribution" ADD CONSTRAINT "ReferralAttribution_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReferralAttribution" ADD CONSTRAINT "ReferralAttribution_referredUserId_fkey" FOREIGN KEY ("referredUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "IdempotencyKey" ADD CONSTRAINT "IdempotencyKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "OwnedCeo_starter_user_key" ON "OwnedCeo"("userId") WHERE "acquisitionType" = 'STARTER';
ALTER TABLE "ReferralAttribution" ADD CONSTRAINT "ReferralAttribution_no_self" CHECK ("referrerId" <> "referredUserId");

-- Seed: map approved development-only values onto EXISTING catalog rows by stable slug.
UPDATE "CEO" SET "baseSpPerCycle" = 20,  "maxOwned" = 10 WHERE "slug" = 'junior-developer';
UPDATE "CEO" SET "baseSpPerCycle" = 40,  "maxOwned" = 8  WHERE "slug" = 'product-manager';
UPDATE "CEO" SET "baseSpPerCycle" = 65,  "maxOwned" = 7  WHERE "slug" = 'marketing-director';
UPDATE "CEO" SET "baseSpPerCycle" = 95,  "maxOwned" = 6  WHERE "slug" = 'startup-founder';
UPDATE "CEO" SET "baseSpPerCycle" = 150, "maxOwned" = 5  WHERE "slug" = 'ai-architect';
UPDATE "CEO" SET "baseSpPerCycle" = 230, "maxOwned" = 4  WHERE "slug" = 'cloud-executive';
UPDATE "CEO" SET "baseSpPerCycle" = 400, "maxOwned" = 3  WHERE "slug" = 'tech-billionaire';
UPDATE "CEO" SET "baseSpPerCycle" = 600, "maxOwned" = 2  WHERE "slug" = 'crypto-whale';

INSERT INTO "CEO" (
    "name", "slug", "rarity", "priceUsd", "dailyRatePercent", "cycleHours", "energyCost", "isActive",
    "baseSpPerCycle", "maxOwned", "isStarter", "rewardEligible", "category", "displayOrder"
) VALUES (
    'Intern CEO', 'intern-ceo', 'Common', 0.00, 0.0000, 4, 2, true,
    10, 1, true, false, 'Starter', 0
)
ON CONFLICT ("slug") DO NOTHING;
```

### 3.1 Catalog mapping (by stable `slug`, never by display name)

| slug (stable) | baseSpPerCycle | maxOwned |
|---|---:|---:|
| `intern-ceo` (new, starter) | 10 | 1 |
| `junior-developer` | 20 | 10 |
| `product-manager` | 40 | 8 |
| `marketing-director` | 65 | 7 |
| `startup-founder` | 95 | 6 |
| `ai-architect` | 150 | 5 |
| `cloud-executive` | 230 | 4 |
| `tech-billionaire` | 400 | 3 |
| `crypto-whale` | 600 | 2 |

**Illustrative values pending sign-off:** the new `intern-ceo` row uses `rarity='Common'`,
`energyCost=2`, `category='Starter'`, `dailyRatePercent=0.0000` (required NOT NULL), since the approved
list specified only price/SP/copies. Existing rows keep their current `name`, `priceUsd`, rarity and
`energyCost` untouched.

---

## 4. Backup status (Step 4) — **STOP GATE: NOT SATISFIED**

- **No backup branch exists and none was created.** No Neon console/API access is available to this
  implementation step, and no recoverable backup identity could be verified.
- Per the Phase 6B.1 instruction — *"If backup verification is unavailable, STOP before database writes"* —
  **no database write was performed**, and the migration was **not** applied.
- Required before any apply (owner action): create a Neon branch from current data (e.g.
  `pre-economy-6b1`), record its id, confirm its restore window, and verify it by connecting (read-only)
  and checking `User`/`CEO` presence and counts (`User=2`, `CEO=8`). Record non-sensitive metadata only
  (branch name/id, timestamp, row counts) — **never** a connection string.
- Restore procedure: reset the working branch to the backup branch point, or Neon PITR to a timestamp
  before the change, then re-verify counts.

**Result:** Step 4 gate is **OPEN/BLOCKED**; Step 5 commands are prepared but must not be run.

---

## 5. Migration status (Step 5)

### 5.1 Current (observed in Phase 6B.0, unchanged)

- `_prisma_migrations`: **absent** → database is **unbaselined**; migration drift is real.
- Present: `User` (2 rows), `CEO` (8 rows). Missing: `AppMeta`.
- `DIRECT_URL` `P1001` → normal `prisma migrate*` (which uses `directUrl`) is expected to fail.

### 5.2 History-baseline justification (checked against actual schema, per instruction)

| Historical migration | Actual DB effect observed | Baseline as applied? |
|---|---|---|
| `20240101000000_add_user_model` | `Role` enum + `User` table exist and match the migration SQL. | Justified |
| `20240102000000_create_ceo_model` | `CEO` table exists with matching columns; 8 seed slugs present. | Justified (file is **not** replayed; its `updatedAt` seed omission is irrelevant to baselining) |

### 5.3 Exact proposed commands (FOR REVIEW — do not run until backup is verified)

> Run from `server/`. Do not print `$env:DATABASE_URL`. Prefer running the SQL inside a single transaction.

1. **Verify backup** (owner): record branch id + counts; require explicit go-ahead.

2. **Apply the additive migration via the pooled connection** (atomic where possible):
   ```powershell
   # Option A — Neon SQL editor: paste migration.sql and execute as one transaction.
   # Option B — Prisma CLI over the pooled URL (does not auto-wrap; run after a fresh backup):
   npx prisma db execute --url "$env:DATABASE_URL" --schema "prisma\schema.prisma" --file "prisma\migrations\20261017000000_phase6b1_economy_foundation\migration.sql"
   # Option C — if psql is available, single-transaction apply:
   psql "$env:DATABASE_URL" --single-transaction -f "prisma\migrations\20261017000000_phase6b1_economy_foundation\migration.sql"
   ```

3. **Baseline history + mark the new migration applied.** Normal `migrate resolve` uses `directUrl`
   (`P1001`), so either (a) temporarily point `DIRECT_URL` at the pooled URL for this metadata-only step,
   or (b) reconcile `_prisma_migrations` directly. Preferred (a):
   ```powershell
   $env:DIRECT_URL = $env:DATABASE_URL
   npx prisma migrate resolve --applied 20240101000000_add_user_model
   npx prisma migrate resolve --applied 20240102000000_create_ceo_model
   npx prisma migrate resolve --applied 20261017000000_phase6b1_economy_foundation
   ```
   Fallback (b): create `_prisma_migrations` with Prisma's standard shape and insert one row per
   migration (`migration_name`, `checksum` = SHA-256 hex of the migration file, `finished_at = now()`,
   `applied_steps_count = 0`), then confirm the checksum matches what Prisma computes so `migrate status`
   does not report drift. **Do not** mark anything applied without the schema check in §5.2.

4. **Confirm state (read-only):**
   ```powershell
   $env:DIRECT_URL = $env:DATABASE_URL
   npx prisma migrate status
   ```
   Expected: all three migrations reported applied; schema in sync.

5. **Regenerate client** (already done this phase, repeat after apply):
   ```powershell
   npx prisma generate
   ```

6. **Post-apply verification:** re-run the read-only `information_schema`/`pg_catalog` inspection; confirm
   new tables/columns/indexes (incl. `OwnedCeo_starter_user_key`), FKs, `AppMeta` present, unchanged
   `User`/`CEO` column definitions, and row counts `User=2`, `CEO=9` (8 + Intern). Then `GET /api/health`
   = `ok` and `GET /api/ceos` returns 9 rows.

**None of the above was executed.**

---

## 6. Implemented services (Step 6)

All services are type-checked, take a `PrismaClient` by injection, and are **not** mounted on any route.

| Service | File | Behavior |
|---|---|---|
| Idempotency lib | `src/lib/idempotency.ts` | `isUniqueViolation` (P2002); `claimIdempotencyKey(tx,…)` returns `false` on replay. |
| Starter grant | `src/services/starterCeo.ts` | Finds active `isStarter` template; inside a transaction returns existing STARTER if present, else claims the idempotency key and creates one `OwnedCeo`, catching the partial-index unique violation as a concurrency backstop. |
| Referral attribution | `src/services/referral.ts` | Resolves referrer by username (see assumption), rejects blank/unknown/self/already-attributed; creates `ReferralAttribution`. **No reward.** |
| Ownership read | `src/services/ownership.ts` | `listOwnedCeos` (fleet view with template economy fields), `countOwnedByTemplate` (for later `maxOwned` enforcement). |
| Validation | `src/validation/game.ts` | `referralCodeSchema`, `ownedCeoIdParamSchema`, `registerWithReferralSchema` (registration wiring deferred to 6B.2). |

**Assumptions / limits (flagged):**
- Referral `code` is matched against the referrer's **username**, because no dedicated referral-code
  column is approved. If a dedicated code field is added later, only the resolver in `referral.ts` changes.
- Idempotency has no stored result payload by design; replay results are derived from domain state
  (starter) or from the unique constraint (referral).
- `baseSpPerCycle` is nullable, so the ownership view exposes `number | null`.

**Explicitly NOT implemented:** CEO purchases, production cycles, energy, SP ledger, upgrades, missions,
USDT/deposits/withdrawals, and any route that would query the new tables.

---

## 7. Tests and results (Step 7)

- **Server type-check:** `npm run build --workspace=server` (`tsc`) → **exit 0**.
- **Tests:** `npm test --workspace=server` → **9/9 pass, 0 fail** (≈594 ms).

| Test | Result |
|---|---|
| `isUniqueViolation` detects P2002 only | ✔ |
| starter grant exactly-once under concurrent retries | ✔ |
| subsequent starter grant is idempotent | ✔ |
| starter grant fails without configured template | ✔ |
| referral: blank code ignored | ✔ |
| referral: unknown referrer | ✔ |
| referral: self-referral rejected | ✔ |
| referral: valid attribution then duplicate rejected | ✔ |
| ownership read maps template economy fields | ✔ |

Tests use an **in-memory fake Prisma** with a serialized `$transaction` and enforced unique constraints
(P2002), so **no database connection is required** and no production data is touched. Client build was
not run because the client was not modified.

Failures reported honestly: none.

---

## 8. Remaining blockers (require owner approval/action)

1. **Backup gate (blocking):** create and verify a Neon backup branch (or equivalent) and provide its
   non-sensitive metadata. Without this, the migration must not be applied.
2. **Migration apply + history baseline:** approve §5.3, including the `DIRECT_URL`→pooled-URL override
   for the metadata-only `migrate resolve` (or its manual fallback).
3. **Referral code semantics:** confirm that `?ref=CODE` means a **username**; otherwise a dedicated
   referral-code column/decision is needed before wiring registration.
4. **Intern CEO illustrative values:** confirm `rarity='Common'`, `energyCost=2`, `category='Starter'`,
   `dailyRatePercent=0.0000`.
5. **Route enablement (Phase 6B.2):** approval to wire `GET /api/game/ceos/owned`, the starter grant into
   registration, and server-side `ref` capture — only after the migration is applied and verified.
6. **Commit policy:** whether to commit this 6B.1 change set now (schema/migration/services/tests) or wait
   until after the database apply is approved.

---

## 9. Summary

- Step 1 env fix applied and verified; no credentials changed or printed.
- Step 2 additive schema valid; existing `User`/`CEO` definitions untouched.
- Step 3 additive SQL generated offline, reviewed, and saved; **not executed**.
- Step 4 backup gate **not satisfied** → **stopped before any database write**.
- Step 5 exact apply/baseline commands provided for review; **not executed**.
- Step 6 three services + validation implemented, type-checked, and unit-tested without a database.
- Step 7 `tsc` passes; 9/9 tests pass; client and Phase 5H untouched.

**STOP.** No migration applied and no production ownership route enabled. Awaiting explicit approval.
