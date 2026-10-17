# TycoonX — Phase 6B.3A: Controlled Migration Execution Gate

**Status:** Execution gate. **No database writes performed. No migrations applied. No `resolve`. No
`_prisma_migrations` created.** Awaiting explicit authorization for the write phase.  
**Date:** 2026-10-17  
**Scope:** checksum verification, read-only production confirmation, historical baseline reasoning, exact
execution/recovery plan, full SQL inspection.  
**Companions:** `docs/PHASE_6B2D_FINAL_PREFLIGHT.md`, `docs/PHASE_6B2C_CATALOG_FIX_REPORT.md`.

---

## 1. Confirmed branch identity (read-only)

| Field | Value | Matches |
|---|---|---|
| Neon project | `wandering-king-57462138` | ✔ confirmed environment |
| **Production branch id** (`neon.branch_id`) | **`br-delicate-butterfly-b4et73g9`** | ✔ |
| Database | `neondb` | ✔ |
| Schema | `public` | ✔ |
| Role (non-secret) | `neondb_owner` | — |
| Backup branch | `backup-before-economy-v2` (user-verified, data matches) | ✔ |

The active connection unambiguously targets **`br-delicate-butterfly-b4et73g9`** (not the backup). No
credentials or connection strings were displayed.

### 1.1 Read-only production state (this phase)

| Check | Value | Preflight expectation | Match |
|---|---|---|---|
| Tables | `CEO`, `User` only | same | ✔ |
| `User` count | 2 | 2 | ✔ |
| `User` ids | `2, 4` | 2, 4 | ✔ |
| `CEO` count | 8 | 8 | ✔ |
| `CEO` ids | `2,3,4,5,6,7,8,10` | same | ✔ |
| `CEO` slugs | `junior-developer, product-manager, marketing-director, startup-founder, ai-architect, cloud-executive, tech-billionaire, test-ceo` | same | ✔ |
| `AppMeta` | absent | absent | ✔ |
| `_prisma_migrations` | absent | absent | ✔ |
| Economy tables/columns | absent | absent | ✔ |
| Enums | `Role` only | same | ✔ |
| Case-insensitive username/email collisions | 0 / 0 | 0 | ✔ |

**No unexpected schema changes since the last preflight.** All CEOs are `isActive = true`.

---

## 2. Verified file checksums (frozen)

Recalculated this phase; both match the frozen values exactly.

| Migration | Path (relative to repo root) | SHA-256 |
|---|---|---|
| 6B1 | `server/prisma/migrations/20261017000000_phase6b1_economy_foundation/migration.sql` | `1a04a9c5ba3bcc3fb66335c6ce79fbcea73915f106f7160f525da2ed559d7cb3` |
| 6B2A | `server/prisma/migrations/20261017010000_phase6b2a_username_case_insensitive/migration.sql` | `f44f174b372e040b694e0c30b2dd2c5d31a921f154cb4399753af992820cce82` |

Git working tree is clean; freeze commit `6df6c3f`. **Go:** checksums unchanged → proceed.

---

## 3. Actual SQL review

### 3.1 Full contents — 6B1 (`20261017000000_phase6b1_economy_foundation/migration.sql`)

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
    "baseSpPerCycle", "maxOwned", "isStarter", "rewardEligible", "category", "displayOrder", "updatedAt"
) VALUES (
    'Intern CEO', 'intern-ceo', 'Common', 0.00, 0.0000, 4, 2, true,
    10, 1, true, false, 'Starter', 0, CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "CEO" (
    "name", "slug", "rarity", "priceUsd", "dailyRatePercent", "cycleHours", "energyCost", "isActive",
    "baseSpPerCycle", "maxOwned", "isStarter", "rewardEligible", "category", "displayOrder",
    "createdAt", "updatedAt"
) VALUES (
    'Crypto Whale', 'crypto-whale', 'Mythic', 1000.00, 0.3500, 4, 40, true,
    600, 2, false, false, NULL, 0,
    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;
```

(Comment-only lines omitted above for brevity; the file on disk is authoritative and matches checksum
`1a04a9c5…cb3`.)

### 3.2 Full contents — 6B2A (`20261017010000_phase6b2a_username_case_insensitive/migration.sql`)

```sql
-- Phase 6B.2A — case-insensitive username uniqueness (additive, non-destructive).
-- Preconditions verified read-only: zero case-insensitive username collisions; lower(text) is IMMUTABLE.
-- Do NOT apply before a verified backup.
CREATE UNIQUE INDEX "User_username_lower_key" ON "User" (lower("username"));
```

### 3.3 Flags

| Item | Location | Note |
|---|---|---|
| **Non-idempotent DDL** | `CREATE TYPE` (×2), `CREATE TABLE` (×3), `CREATE INDEX`/`CREATE UNIQUE INDEX` (×7), `ALTER TABLE ADD CONSTRAINT` (×6) | Cannot be safely re-run after partial apply → apply each migration as **one transaction** |
| Idempotent DDL | `CREATE TABLE IF NOT EXISTS "AppMeta"`, `CREATE UNIQUE INDEX IF NOT EXISTS "AppMeta_key_key"` | Safe to re-run |
| **Unique indexes** | `AppMeta_key_key`, `ReferralAttribution_referredUserId_key`, `IdempotencyKey_userId_scope_key_key`, `OwnedCeo_starter_user_key` (partial), `User_username_lower_key` (functional) | Enforce one-attribution/referred user, idempotency scope/key, one starter per user, case-insensitive username |
| **Foreign keys** | `OwnedCeo_userId_fkey`/`_templateId_fkey` (RESTRICT), `ReferralAttribution_referrerId_fkey`/`_referredUserId_fkey` (RESTRICT), `IdempotencyKey_userId_fkey` (CASCADE) | RESTRICT prevents orphaning; CASCADE only on idempotency keys |
| **Check constraints** | `ReferralAttribution_no_self` (`referrerId <> referredUserId`) | Blocks self-referrals at DB level |
| **Seed updates** | 8 `UPDATE "CEO" … WHERE slug = …` | Touch only new columns (`baseSpPerCycle`, `maxOwned`); no legacy column change; naturally idempotent; `crypto-whale` update is a no-op (row absent) |
| **Seed inserts** | `intern-ceo`, `crypto-whale` | `ON CONFLICT ("slug") DO NOTHING`; full legacy columns + `createdAt`/`updatedAt` supplied |
| **Data loss** | none | No `DROP`, `TRUNCATE`, `DELETE`, or column removal. `test-ceo` untouched |
| **Locking** | `ALTER TABLE "CEO" ADD COLUMN … DEFAULT` | PG 11+ metadata-only default; brief `ACCESS EXCLUSIVE` lock. `CREATE INDEX` (non-concurrent) takes a `SHARE` lock; negligible at 2/8 rows. `CREATE INDEX CONCURRENTLY` is intentionally not used (cannot run inside a transaction) |
| **New-id sequence** | `intern-ceo` / `crypto-whale` inserts | Assigned by `CEO_id_seq` (expected new ids ~11/12); existing ids unaffected |

---

## 4. Historical migration inspection and baseline reasoning

| Migration | SQL effect | Live DB state | Safe to mark applied? | Why |
|---|---|---|---|---|
| `20240101000000_add_user_model` | `CREATE TYPE "Role"`, `CREATE TABLE "User"` + 2 unique indexes | `Role` enum exists; `User` table + `User_email_key`/`User_username_key` exist and match | **Yes** | Schema effect verified present; **not executed**, only recorded |
| `20240102000000_create_ceo_model` | `CREATE TABLE "CEO"` + `CEO_slug_key` + seed of 8 rows | `CEO` table + `CEO_slug_key` exist and match | **Yes** | Schema effect verified present; its seed is **not** replayed (it omits `updatedAt` and would fail). Note: live **data** drifted from the original seed (`crypto-whale` deleted, `test-ceo` added) — recorded history asserts the **schema** effect, not the original data |

**Do not assume every historical migration is safe to replay** — neither is replayable (objects already
exist; the CEO seed would error). They are therefore **baselined, never executed**.

**When/why each is recorded in `_prisma_migrations`:**
- **Historical two:** recorded **before** applying new SQL, to create `_prisma_migrations` and prevent any
  future `migrate deploy` from attempting to replay them.
- **6B1 / 6B2A:** recorded **after** their SQL has actually been applied and verified, because
  `prisma migrate resolve` writes history metadata only and does **not** execute the SQL.

---

## 5. Exact proposed execution sequence (for the authorized write phase)

Run from `server/`. Never echo `$env:DATABASE_URL`. Halt on any failed verification.

**Step 1 — Final read-only production checks** (§1.1). If branch/counts/markers differ → **STOP**.

**Step 2 — Historical baseline (metadata only):**
```powershell
$env:DIRECT_URL = $env:DATABASE_URL   # resolve uses directUrl; pooled override for metadata step
npx prisma migrate resolve --applied 20240101000000_add_user_model
npx prisma migrate resolve --applied 20240102000000_create_ceo_model
```
*Failure:* if `resolve` errors (e.g., `_prisma_migrations` partially created, or pooler rejects), **STOP**
and inspect; do not hand-edit history without approval.

**Step 3 — Apply 6B1 as one transaction.** Preferred: Neon SQL editor, paste file contents wrapped:
```sql
BEGIN;
-- <contents of server/prisma/migrations/20261017000000_phase6b1_economy_foundation/migration.sql>
COMMIT;
```
*Failure:* error inside the transaction → `ROLLBACK`; DB unchanged; **STOP** and investigate.

**Step 4 — Verify 6B1 effects** (read-only; §6). If any expected object/row is missing → **STOP** (DDL is
already committed; recovery may be required, see §7).

**Step 5 — Record 6B1 applied:** `npx prisma migrate resolve --applied 20261017000000_phase6b1_economy_foundation`
*Failure:* history row missing → retry once; if still failing, **STOP**.

**Step 6 — Apply 6B2A as one transaction:**
```sql
BEGIN;
CREATE UNIQUE INDEX "User_username_lower_key" ON "User" (lower("username"));
COMMIT;
```
*Failure:* rollback; **STOP**.

**Step 7 — Verify 6B2A** (`User_username_lower_key` present, still 0 collisions). If missing → **STOP**.

**Step 8 — Record 6B2A applied:** `npx prisma migrate resolve --applied 20261017010000_phase6b2a_username_case_insensitive`

**Step 9 — Final integrity checks and `prisma migrate status`; then `npx prisma generate`.**

**Rollback vs separate recovery:**
- **Transactionally reversible:** anything before the `COMMIT` of steps 3/6 (rollback restores prior state).
- **Requires separate recovery (after `COMMIT`):** committed DDL changes; a missing/incorrect
  `_prisma_migrations` row; anything discovered in steps 4/7/9. These need either targeted completion or a
  restore from `backup-before-economy-v2` (§7).
- Historical baselining (step 2) is **not** part of the DDL transaction; each `resolve` commits its own
  metadata row.

**Forbidden at all times:** `prisma migrate reset`, `prisma migrate dev`, `prisma migrate deploy`,
`prisma db push`.

---

## 6. Post-migration verification queries (read-only)

```sql
-- Identity
SELECT current_database(), current_schema(), current_setting('neon.branch_id', true);

-- Counts (expect User=2, CEO=10)
SELECT count(*) FROM "User";
SELECT count(*) FROM "CEO";

-- New/changed catalog rows
SELECT id, slug, "priceUsd", "baseSpPerCycle", "maxOwned", "isStarter"
FROM "CEO" WHERE slug IN ('intern-ceo','crypto-whale','test-ceo','junior-developer') ORDER BY slug;

-- New economy columns
SELECT column_name FROM information_schema.columns
WHERE table_schema='public' AND table_name='CEO'
  AND column_name IN ('baseSpPerCycle','maxOwned','isStarter','rewardEligible','category','displayOrder')
ORDER BY column_name;

-- New tables + enums
SELECT table_name FROM information_schema.tables
WHERE table_schema='public' AND table_name IN ('AppMeta','OwnedCeo','ReferralAttribution','IdempotencyKey') ORDER BY table_name;
SELECT typname FROM pg_type WHERE typtype='e' AND typnamespace='public'::regnamespace ORDER BY typname;

-- Indexes + constraints
SELECT indexname FROM pg_indexes WHERE schemaname='public'
  AND indexname IN ('User_username_lower_key','OwnedCeo_starter_user_key','ReferralAttribution_referredUserId_key','IdempotencyKey_userId_scope_key_key') ORDER BY indexname;
SELECT conname FROM pg_constraint WHERE conname='ReferralAttribution_no_self';

-- Foreign keys present
SELECT conname FROM pg_constraint
WHERE contype='f' AND conrelid IN ('"OwnedCeo"'::regclass,'"ReferralAttribution"'::regclass,'"IdempotencyKey"'::regclass) ORDER BY conname;

-- Migration history
SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations ORDER BY started_at;
```

Also: `GET /api/health` = `ok`; `GET /api/ceos` returns the catalog (expect 10 active rows).

---

## 7. Recovery instructions

- **Preserve** `backup-before-economy-v2`; never reset/delete it.
- **Production** = `br-delicate-butterfly-b4et73g9` (project `wandering-king-57462138`, db `neondb`).
- **Failure inside a transaction (steps 3/6):** rollback; DB unchanged; no recovery needed.
- **Failure after commit (steps 4/5/7/8/9):**
  1. Stop the API server and client (no writes during recovery).
  2. Prefer **completing** remaining idempotent steps.
  3. If unsafe, **restore**: reset the production branch to `backup-before-economy-v2` (or PITR to just
     before the apply).
  4. **Do not** `DROP`/`TRUNCATE` to clean up.
  5. Re-run §6 verification; expect `User=2` (ids 2,4), `CEO=8` (ids 2–8,10), `AppMeta`/`_prisma_migrations`
     absent, no economy tables/columns.
- **Partial `_prisma_migrations`:** if history is wrong after recovery, re-baseline carefully; manual table
  edits require explicit approval.

---

## 8. Remaining risks

1. **Restore not drilled** — backup verified by data presence, not a tested restore.
2. **`directUrl` P1001** — `migrate resolve` uses `directUrl`; the pooled override may behave differently
   through PgBouncer. Fallback: record history via pooled SQL (approval required).
3. **New-id sequence values** — `intern-ceo`/`crypto-whale` ids depend on `CEO_id_seq` state (expected
   ~11/12); no existing ids change.
4. **Index build locks** — negligible at current row counts; non-concurrent is intentional for
   transactional apply.
5. **Frozen-file discipline** — any later edit invalidates the checksums and any baselined checksum.
6. **`test-ceo`** remains visible in the Market until the separate approved follow-up
   (`isActive=false` + Market `?isActive=true`).

---

## 9. Final execution readiness

# **READY for the authorized write phase**

- Frozen checksums **verified and unchanged**.
- Production branch/counts/schema **verified read-only** and matching preflight.
- Backup **present and data-verified** (limitation: no restore drill).
- Execution, baseline, verification, and recovery steps fully specified; failure handling defined at every
  step.

**No further preparatory work is required.** Execution must not begin without explicit authorization.

**STOP.** No SQL applied, no `resolve`, no `_prisma_migrations`, no data changed. Requesting explicit
authorization to proceed with the database-write phase.

### Migration SQL file paths (exact)

```
C:\Users\VISION\Desktop\TycoonX\server\prisma\migrations\20261017000000_phase6b1_economy_foundation\migration.sql
C:\Users\VISION\Desktop\TycoonX\server\prisma\migrations\20261017010000_phase6b2a_username_case_insensitive\migration.sql
```
