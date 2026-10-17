# TycoonX — Phase 6B.2B: Neon Backup Verification & Migration Readiness

**Status:** Readiness review. **Migration is BLOCKED. No SQL applied. No ownership routes enabled. No live
data modified.** Awaiting approval.  
**Date:** 2026-10-17  
**Scope:** backup verification, primary-DB verification, final migration review, baseline strategy,
rollback plan, tests, exact later migration commands.  
**Companions:** `docs/PHASE_6B2A_MIGRATION_REVIEW.md`, `docs/PHASE_6B1_IMPLEMENTATION_REPORT.md`,
`docs/ECONOMY_V2_IMPLEMENTATION_PLAN.md`, `docs/TYCOONX_ECONOMY_V2_SPEC.md`.

Frontend visuals, Phase 5H art, PixiJS/isometric prototypes, gameplay features and live data were **not**
modified.

---

## 1. Backup verification status — **INCOMPLETE (BLOCKED)**

**How this was checked (names only, never values):**
- `server/.env` contains exactly these keys: `PORT`, `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`.
- No `BACKUP_DATABASE_URL`, no `NEON_API_KEY`, no `NEON_*`/`PG*` variables in the process environment.
- Therefore there is **no configured credential or API access to the backup branch**, and no Neon API key
  to list branches.

**Result:** the existence, source, and recoverability of the branch `backup-before-economy-v2` **cannot be
verified from this environment**. Connecting to `DATABASE_URL` only proves the *primary* connection works;
it does **not** prove the backup exists (and per instruction we do **not** assume `DATABASE_URL` points at
the backup — see §2).

**Per the task rule — "If backup verification is incomplete, mark the migration as BLOCKED" — the
migration is BLOCKED.**

**What the user must verify manually (Neon console):**
1. Open project `wandering-king-57462138` → **Branches**.
2. Confirm a branch named **`backup-before-economy-v2`** exists.
3. Confirm its **source/parent branch** is the intended production branch. The primary `DATABASE_URL`
   currently resolves to branch **`br-delicate-butterfly-b4et73g9`** (from `current_setting('neon.branch_id')`)
   in database `neondb`. Confirm this is the production/source branch and that the backup is a **different**
   branch derived from it.
4. Record non-sensitive metadata: branch name, branch id, source branch id, creation timestamp, PITR window.
5. Verify recoverability by connecting to the **backup branch's own** connection string (read-only) and
   confirming: `User=2`, `CEO=8`, slugs = the 8 listed in §2, `AppMeta` absent, `_prisma_migrations` absent.
6. Confirm the backup is **not** the primary: its branch id must differ from `br-delicate-butterfly-b4et73g9`.

**Optional automated verification (if the user adds credentials):** provide the backup connection string as
`BACKUP_DATABASE_URL` (env only, never committed) and/or a `NEON_API_KEY`, and a read-only script can verify
it programmatically. No such secret should be placed in the repo or this document.

---

## 2. Primary database observations (read-only)

Queried read-only via the app's serverless driver over `DATABASE_URL`. No writes.

| Item | Value |
|---|---|
| Server | PostgreSQL 18.6 (Neon) |
| Database / schema | `neondb` / `public` |
| Role (non-secret) | `neondb_owner` |
| Primary `neon.branch_id` | `br-delicate-butterfly-b4et73g9` |
| `neon.project_id` | `wandering-king-57462138` |
| Tables in `public` | `CEO`, `User` **only** |
| `User` count | 2 |
| `CEO` count | 8 |
| `_prisma_migrations` | **absent** |
| `AppMeta` | **absent** |
| Enums | `Role` only (`AcquisitionType`/`OwnedCeoStatus` absent) |
| Economy columns (`CEO.baseSpPerCycle`, `CEO.maxOwned`) | **absent** |
| Economy tables (`OwnedCeo`, `ReferralAttribution`, `IdempotencyKey`) | **absent** |
| `User_username_lower_key` | **absent** |
| Case-insensitive username collisions | **0** |
| Case-insensitive email collisions | **0** |
| `User` ids | `2`, `4` (ids 1 and 3 no longer present) |

### 2.1 Unexpected data difference — catalog drift (must be resolved)

The 8 `CEO` rows do **not** match the historical seed / approved catalog:

| CEO id | slug | priceUsd | dailyRatePercent | energyCost |
|---:|---|---:|---:|---:|
| 2 | `junior-developer` | 5.00 | 0.1500 | 10 |
| 3 | `product-manager` | 15.00 | 0.1800 | 12 |
| 4 | `marketing-director` | 30.00 | 0.2000 | 15 |
| 5 | `startup-founder` | 50.00 | 0.2200 | 18 |
| 6 | `ai-architect` | 100.00 | 0.2500 | 22 |
| 7 | `cloud-executive` | 200.00 | 0.2800 | 25 |
| 8 | `tech-billionaire` | 500.00 | 0.3000 | 30 |
| 10 | **`test-ceo`** | 10.00 | 0.1000 | 5 |

- **`crypto-whale` is MISSING** (it was in the historical seed: id ~9, `$1000`, `0.3500`, energy 40).
- **`test-ceo` is unexpected** (not in any migration or the approved catalog).
- CEO ids are non-contiguous (`1` and `9` absent), indicating rows were deleted/re-created out-of-band.

**Impact on the pending migration:** the 6B.1 seed does
`UPDATE "CEO" SET ... WHERE "slug"='crypto-whale'`, which is safe but becomes a **no-op** because the row
does not exist. After migration the approved catalog will still lack **Crypto Whale**, and `test-ceo` will
remain. This is a **product/data decision**, not something to silently "fix":

- **Option A:** add a second idempotent `INSERT ... ON CONFLICT (slug) DO NOTHING` for `crypto-whale`
  (with the approved price/SP/copies) so the approved catalog is complete.
- **Option B:** accept the DB as the source of truth and update the approved catalog list (drop Crypto
  Whale, decide what `test-ceo` is).
- **`test-ceo`:** do **not** delete (no destructive ops). Decide whether to keep, rename, or set
  `isActive=false` via an approved data step.

**This discrepancy is a second blocker** and must be resolved before applying the seed.

---

## 3. Migration SQL review (against the actual primary DB)

Reviewed both pending migrations against the live schema (not only `schema.prisma`).

| Check | Verdict |
|---|---|
| Additive-only | Yes — `ALTER TABLE "CEO" ADD COLUMN` (nullable/defaulted), `CREATE TABLE`/`CREATE TYPE`, indexes, FKs, `UPDATE`, one `INSERT` |
| Existing `User`/`CEO` records preserved | Yes — no `UPDATE` of legacy columns, no deletes, no drops |
| `AppMeta` created if missing | Yes — `CREATE TABLE IF NOT EXISTS` + `CREATE UNIQUE INDEX IF NOT EXISTS` (currently missing → will be created) |
| `OwnedCeo`, `ReferralAttribution`, `IdempotencyKey` created | Yes — with FKs and indexes |
| Case-insensitive username uniqueness | Yes — `CREATE UNIQUE INDEX "User_username_lower_key" ON "User" (lower("username"))`; 0 collisions → safe |
| Intern CEO insertion incl. `updatedAt` | **Yes** — the `updatedAt` NOT NULL defect from 6B.1 was fixed (line sets `CURRENT_TIMESTAMP`) |
| Foreign keys | Yes — RESTRICT for ownership/referral, CASCADE for idempotency keys |
| Unique indexes | Yes — referral `referredUserId`, idempotency `(userId,scope,key)`, partial starter `(userId) WHERE STARTER`, `lower(username)` |
| No destructive operations | Yes — scan for `DROP TABLE|TRUNCATE|DROP COLUMN|DROP TYPE|DELETE FROM|ALTER TABLE ... DROP` returned empty |
| Ordering | 6B.1 (enums → columns → tables → indexes → FKs → constraints → seed) then 6B.2A index; correct |
| Idempotency assumptions | AppMeta guarded by `IF NOT EXISTS`; intern seed by `ON CONFLICT`; **enums/`CREATE TABLE`/`CREATE INDEX` are NOT idempotent** → must be applied in a single transaction (see §4) |
| Historical migration replay | Not triggered by these files; risk is only from `migrate dev/deploy/reset` (see §5) |
| Crypto Whale | UPDATE becomes no-op — discrepancy in §2.1 |
| Missing `updatedAt` on `OwnedCeo` INSERTs | N/A — `OwnedCeo` is written by the Prisma client (`@updatedAt`), not raw SQL |

**Review conclusion:** the SQL is additive and correct for the *current* schema, **except** the
catalog-composition issue (§2.1) which is a data decision. No changes to the SQL were made in this phase.

---

## 4. Baselining sequence (do NOT run in this phase)

The database is unbaselined (`_prisma_migrations` absent) and `DIRECT_URL` is expected to fail `P1001`.
The safe sequence (to run only after the backup is verified and the §2.1 catalog decision is made):

1. **Verify backup** (§1) and the primary branch identity.
2. **Create/record history metadata only** (does not execute SQL). `migrate resolve` uses `directUrl`, so
   point it at the pooled URL for this metadata step:
   ```powershell
   $env:DIRECT_URL = $env:DATABASE_URL
   npx prisma migrate resolve --applied 20240101000000_add_user_model
   npx prisma migrate resolve --applied 20240102000000_create_ceo_model
   ```
   This is justified only because the observed schema matches those migrations' effects (User/CEO tables
   and their columns exist; the historical CEO seed defect is irrelevant because it is not replayed).
3. **Apply the 6B.1 SQL inside a single transaction** over the pooled connection. Preferred: Neon SQL
   editor with an explicit transaction around the file contents:
   ```sql
   BEGIN;
   -- ... full contents of 20261017000000_phase6b1_economy_foundation/migration.sql ...
   COMMIT;
   ```
   (Equivalently, a small Node script using `@neondatabase/serverless` that runs the file between
   `BEGIN;` and `COMMIT;`. `prisma db execute --file` does **not** wrap in a transaction and some
   statements are non-idempotent, so it is not the first choice.)
4. **Apply the 6B.2A index** the same way (single statement):
   ```sql
   BEGIN;
   CREATE UNIQUE INDEX "User_username_lower_key" ON "User" (lower("username"));
   COMMIT;
   ```
5. **Mark both new migrations applied** (metadata only):
   ```powershell
   npx prisma migrate resolve --applied 20261017000000_phase6b1_economy_foundation
   npx prisma migrate resolve --applied 20261017010000_phase6b2a_username_case_insensitive
   ```
6. **Verify** (read-only, §8.4) then `npx prisma generate`.

**Never run:** `prisma migrate reset`, `prisma migrate dev`, `prisma migrate deploy`, `prisma db push`, or
any destructive SQL. Do not mark a migration applied until its effects are verified.

---

## 5. Rollback and recovery plan (do NOT execute)

- **Preserve the backup:** keep `backup-before-economy-v2` intact; never reset/delete it. Keep its
  connection string in env only (not committed).
- **Identify the correct production branch:** primary `DATABASE_URL` → branch
  `br-delicate-butterfly-b4et73g9` in project `wandering-king-57462138`. Confirm in the console that this
  is production and that it differs from the backup.
- **If SQL execution fails mid-file:** because the apply is wrapped in `BEGIN … COMMIT`, a failure rolls
  back automatically → no partial state. Re-verify and retry.
- **If a partially applied migration is somehow reached** (e.g. applied statement-by-statement):
  1. Stop the server and client immediately (no writes).
  2. Inspect what exists read-only (tables/columns/indexes completed).
  3. Prefer completing the remaining idempotent steps over dropping anything.
  4. If completion is unsafe, **restore**: reset the production branch to `backup-before-economy-v2` (or
     PITR to just before the apply), then re-verify §5 verification.
  5. Do not run DROP/TRUNCATE to "clean up"; restore instead.
- **Verify original data after recovery:** `User=2` (ids 2,4), `CEO=8` (slugs per §2.1), `AppMeta` absent,
  `_prisma_migrations` absent, no economy tables/columns.
- **Prevent writes during recovery:** stop the Node/API server and do not open the app; the DB is the only
  writer, and no scheduled jobs exist. Announce a short maintenance window if needed.

---

## 6. Tests and validation results

| Check | Command | Result |
|---|---|---|
| Prisma schema validation | `npx prisma validate` (in `server/`) | **PASS** — "The schema is valid" |
| Server TypeScript check | `npm run build --workspace=server` | **PASS** — exit 0 |
| Automated tests | `npm test --workspace=server` | **PASS** — 15/15, 0 fail |

Tests use an in-memory fake Prisma and **do not write to the live Neon database**.

---

## 7. Remaining blockers

1. **Backup unverifiable (blocking):** no backup-branch credentials/API available; `backup-before-economy-v2`
   existence/recoverability must be confirmed manually (§1). Migration stays BLOCKED until then.
2. **Primary branch confirmation:** confirm `br-delicate-butterfly-b4et73g9` is production (not the backup).
3. **Catalog drift decision (blocking):** `crypto-whale` missing and `test-ceo` present — choose Option A/B
   in §2.1 and decide the fate of `test-ceo`; if Option A, the migration must add an idempotent
   `crypto-whale` INSERT (freeze the file before baselining).
4. **Apply method approval:** approve the §4 pooled single-transaction apply + `migrate resolve` baselining.
5. **Route enablement:** deferred to Phase 6B.2B-2 (after DB verified).

---

## 8. Exact commands proposed for a later approved migration

> Prepared for review only. Do not run until the backup is verified and the catalog decision is made.
> Run from `server/`. Never echo `$env:DATABASE_URL`.

```powershell
# 0) Preconditions: backup verified; primary branch is production; catalog decision made.
npx prisma validate

# 1) Baseline historical migrations as applied (metadata only; pooled URL workaround).
$env:DIRECT_URL = $env:DATABASE_URL
npx prisma migrate resolve --applied 20240101000000_add_user_model
npx prisma migrate resolve --applied 20240102000000_create_ceo_model

# 2) Apply 6B.1 SQL as ONE transaction (Neon SQL editor or a BEGIN/COMMIT-wrapped runner).
#    File: prisma/migrations/20261017000000_phase6b1_economy_foundation/migration.sql

# 3) Apply 6B.2A index as ONE transaction.
#    File: prisma/migrations/20261017010000_phase6b2a_username_case_insensitive/migration.sql

# 4) Record the two new migrations as applied (metadata only).
npx prisma migrate resolve --applied 20261017000000_phase6b1_economy_foundation
npx prisma migrate resolve --applied 20261017010000_phase6b2a_username_case_insensitive

# 5) Verify.
npx prisma migrate status
npx prisma generate
```

**Post-apply read-only verification (expected):** `User`/`CEO` column definitions unchanged; `CEO` has
`baseSpPerCycle`/`maxOwned`/`isStarter`/`rewardEligible`/`category`/`displayOrder`; `AppMeta`, `OwnedCeo`,
`ReferralAttribution`, `IdempotencyKey`, `AcquisitionType`, `OwnedCeoStatus` present;
`User_username_lower_key`, `OwnedCeo_starter_user_key`, `ReferralAttribution_no_self` present;
`User=2`; `CEO=8` (or `9` if the `crypto-whale` insert option is approved); IDs unchanged for existing rows;
`GET /api/health` = `ok`; `GET /api/ceos` lists the catalog.

---

## 9. Final readiness verdict

# **BLOCKED**

Two independent blockers:
1. **Backup verification is incomplete** — `backup-before-economy-v2` cannot be confirmed (no credentials/API).
2. **Live catalog drift** — `crypto-whale` is missing and `test-ceo` is present; the approved catalog cannot
   be guaranteed after the seed without an explicit decision.

Everything else is ready: schema valid, SQL reviewed as additive/non-destructive, `updatedAt` defect fixed,
15/15 tests pass, and the apply/baseline/rollback plan is prepared.

**STOP.** No migration applied, no routes activated, no live data changed. Awaiting approval.
