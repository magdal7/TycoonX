# TycoonX — Phase 6B.4C: Safe Neon Staging Migration Test

**Status:** Staging workflow and documentation prepared. **No migration executed. No Neon writes. No
production connection. Nothing pushed.** Awaiting the operator to supply the staging branch and secret, then
approve a manual dispatch.  
**Date:** 2026-10-17  
**Repository:** https://github.com/magdal7/TycoonX (default branch `master`)  
**Companions:** `docs/PHASE_6B4B_MIGRATION_EXECUTION_PLAN.md`,
`docs/PHASE_6B3A_EXECUTION_GATE.md`, `docs/PHASE_6B2D_FINAL_PREFLIGHT.md`,
`.github/workflows/neon-migration-execute.yml` (production), `.github/workflows/neon-migration-preflight.yml`.

---

## 1. Purpose and scope

This phase adds a **staging-only** execution workflow so the exact Economy V2 migration sequence can be
validated against an **isolated Neon branch** before it is ever run against production.

| Artifact | Path |
|---|---|
| Staging workflow | `.github/workflows/neon-migration-staging.yml` |
| This document | `docs/PHASE_6B4C_STAGING_TEST.md` |

The **production** workflow (`.github/workflows/neon-migration-execute.yml`) is **unchanged** by this phase;
no defect was found in it (requirement 14). Frozen SQL files and their checksums are **unchanged**
(requirement 7). Gameplay, payment, and withdrawal routes are not touched.

---

## 2. Information the operator MUST provide (not guessed)

The staging branch does not exist yet and its identity is **not** known to this phase. The workflow will
**not** guess it. Before dispatch the operator must provide:

| # | Required item | Where it goes | Notes |
|---|---|---|---|
| 1 | **Staging branch id** (e.g. `br-xxxx`) | `staging_branch` workflow input | The exact `neon.branch_id` of the staging branch. Must differ from production `br-delicate-butterfly-b4et73g9`. |
| 2 | **Staging direct connection string** | repository secret **`STAGING_DIRECT`** | The **direct (non-pooled)** endpoint for the staging branch. Never reuse `DIRECT`. |
| 3 | **Confirmation token** | `confirm` workflow input | Must be exactly `APPLY-ECONOMY-V2-STAGING`. |

If any of these is missing, **do not dispatch**. The workflow fails closed with a clear message:
- missing `STAGING_DIRECT` → `Missing secret` error before any DB access;
- missing/empty `staging_branch` → `Missing staging branch` error;
- `staging_branch` equal to the production branch id → `Refusing production` error.

---

## 3. Create the staging branch (operator, Neon console)

1. In Neon, select project `wandering-king-57462138` and the production branch
   `br-delicate-butterfly-b4et73g9`.
2. Create a **branch from current data** (copy-on-write), e.g. named `staging-economy-6b4c`. This gives an
   isolated copy at the current pre-migration state; writes to it never affect production.
3. Record the new branch's **branch id** (shown in the console / `neon.branch_id`). This is the value for
   the `staging_branch` input.
4. Copy the staging branch's **direct (non-pooled)** connection string and store it as the repository secret
   **`STAGING_DIRECT`** (Settings → Secrets and variables → Actions). Do **not** commit it anywhere.
5. (Recommended) Confirm read-only that the new branch is at the expected pre-migration state:
   `User=2` (ids `2,4`), `CEO=8` (ids `2,3,4,5,6,7,8,10`), `AppMeta`/`_prisma_migrations` absent, no economy
   columns/tables. The workflow re-checks all of this anyway.

---

## 4. Isolation guarantees (requirement 9)

The staging workflow **never** references `secrets.DIRECT` and never connects to production:

1. The only connection string is `secrets.STAGING_DIRECT` (mapped to `DATABASE_URL`/`DIRECT_URL`).
2. The first step refuses to continue if `staging_branch` equals the production branch id.
3. The pre-migration step reads `current_setting('neon.branch_id')` and fails closed if it is:
   - empty (unverified), or
   - equal to the production branch id (`PRODUCTION REACHED` → abort before any write), or
   - different from the supplied `staging_branch`.
4. Because a Neon branch is copy-on-write, even a mistaken write could not alter production data.

---

## 5. Reused production sequence and safety checks (requirement 6)

The staging workflow mirrors the hardened production workflow (Phase 6B.4B):

| Step | Behavior |
|---|---|
| Confirm intent | Token `APPLY-ECONOMY-V2-STAGING` + non-empty `staging_branch` + `staging_branch != production` + `STAGING_DIRECT` present |
| Frozen checksums | SHA-256 on all 4 migrations + `migration_lock.toml` |
| Transaction-safety scan | Refuses `BEGIN/COMMIT/ROLLBACK`, `CREATE INDEX CONCURRENTLY`, `CREATE DATABASE`, `DROP DATABASE`, `VACUUM`, `REINDEX … CONCURRENTLY` |
| Pre-migration checks | branch isolation, counts/ids, collisions, pre-migration markers, historical-schema match |
| Historical baseline | `prisma migrate resolve --applied` ×2 (metadata only) + row/checksum verification |
| Apply 6B1 | `psql --single-transaction -f <6B1>` (output captured, redacted) |
| Verify 6B1 | tables, enums, columns, indexes, FK, CHECK, catalog |
| Record 6B1 | `prisma migrate resolve --applied <6B1>` |
| Apply/Verify/Record 6B2A | same pattern for the functional unique index |
| Final verification | history names + per-row checksums + completion + no failed rows + `prisma migrate status` |
| Report | writes `staging-migration-report.md` and uploads it as an artifact |

Credentials and SQL output are never streamed; captured output is redacted (`[REDACTED_DSN]`,
`[REDACTED_HOST]`).

---

## 6. Post-migration verification report (requirement 10)

The workflow produces a **`staging-migration-report.md`** artifact and a Job Summary covering:

- **Schema:** `AppMeta`, `OwnedCeo`, `ReferralAttribution`, `IdempotencyKey` tables; `AcquisitionType`,
  `OwnedCeoStatus` enums; the six additive `CEO` columns.
- **Constraints:** `ReferralAttribution_no_self` CHECK; 5 foreign keys.
- **Indexes:** `AppMeta_key_key`, `IdempotencyKey_userId_scope_key_key`, `OwnedCeo_starter_user_key`,
  `OwnedCeo_templateId_idx`, `OwnedCeo_userId_idx`, `OwnedCeo_userId_status_idx`,
  `ReferralAttribution_referredUserId_key`, `ReferralAttribution_referrerId_idx`, `User_username_lower_key`.
- **CEO catalog:** 10 rows; existing ids `2,3,4,5,6,7,8,10` preserved; `intern-ceo` = `true:10:1`;
  `crypto-whale` = `600:2`.
- **Existing User records:** `User=2`, ids `2,4` preserved.
- **Prisma history:** exactly the four migrations, each with `checksum` == frozen SHA-256, `finished_at`
  set, no `rolled_back_at`/failed rows; `prisma migrate status` clean.

---

## 7. Recovery testing on staging (requirement 11)

Staging is **disposable**, so recovery can be exercised safely without touching production. All commands use
the staging connection only; never export or echo a connection string.

> Set the connection string once in the shell without printing it (PowerShell example):
> `$env:DIRECT_URL = "<staging direct connection string>"` — do **not** paste it into logs.

### Drill A — pre-flight refusal (no auto-reapply)
After a successful staging run, **re-dispatch** the workflow. It must fail the pre-migration check
(`_prisma_migrations` / economy objects already present) and make no writes. Confirms reapply is refused.

### Drill B — transaction rollback
On a **copy** of the 6B1 SQL (never edit the frozen file), inject a deliberate error near the end, then:
```bash
psql "$DIRECT_URL" -v ON_ERROR_STOP=1 --single-transaction -f /tmp/6b1_broken.sql
```
Expect a non-zero exit and **no partial objects** (verify `AppMeta`/`OwnedCeo`/economy columns absent).
This proves the whole-file rollback guarantee.

### Drill C — commit → resolve interruption
1. Apply the real 6B1 on staging **outside** the workflow:
   `psql "$DIRECT_URL" -v ON_ERROR_STOP=1 --single-transaction -f server/prisma/migrations/20261017000000_phase6b1_economy_foundation/migration.sql`
2. Do **not** run `resolve`. Observe the interruption state:
   `npx prisma migrate status --schema server/prisma/schema.prisma` → the migration appears **pending** while
   its objects exist.
3. Recover by completing the metadata step:
   `npx prisma migrate resolve --schema server/prisma/schema.prisma --applied 20261017000000_phase6b1_economy_foundation`
4. Re-check `migrate status` → clean.
This validates the exact recovery procedure documented in `PHASE_6B4B` §7.2.

### Drill D — restore path
1. In the Neon console, **reset the staging branch from its parent** (production state), or delete and
   recreate it.
2. Verify the pre-migration state returns read-only: `User=2` (ids 2,4), `CEO=8` (ids 2–8,10),
   `AppMeta`/`_prisma_migrations` absent, no economy tables/columns.
This exercises the same restore mechanism production would use (without drilling against production).

### Cleanup
After testing, **delete the staging branch** in Neon to avoid unnecessary cost. Never delete the production
branch or `backup-before-economy-v2`.

---

## 8. How to dispatch (after the operator provides §2 items)

1. Ensure the `STAGING_DIRECT` secret is set and the staging branch exists (§3).
2. GitHub → **Actions → "Neon Migration Execute — STAGING (guarded, write)" → Run workflow**.
3. Select branch **`master`**.
4. `confirm`: `APPLY-ECONOMY-V2-STAGING`; `staging_branch`: the exact staging branch id.
5. Run and read the Job Summary; download the `staging-migration-report` artifact.
6. On success, run §7 Drills A–D to validate refusal/rollback/recovery/restore before production execution.

---

## 9. Limitations (what cannot be guaranteed)

1. **Cross-boundary atomicity is NOT guaranteed** — same as production: a small window exists between a
   migration's SQL commit and its `_prisma_migrations` row. The workflow fails closed and requires manual
   recovery (§7 Drill C). It does **not** claim full atomicity across SQL and Prisma history.
2. **No exclusion of external writers** — the operator must ensure nothing else writes to the staging branch
   during the run.
3. **`STAGING_DIRECT` must be the direct (non-pooled) endpoint**, or `prisma migrate resolve` may fail
   closed.
4. **`neon.branch_id` must be exposed** on the staging connection for isolation checks; if not, the workflow
   stops as *unverified* rather than guessing.
5. **Prisma checksum algorithm assumption** — the workflow asserts `_prisma_migrations.checksum` equals the
   file SHA-256 (Prisma's documented checksum). A future algorithm change would fail closed.
6. **No automatic retry/reapply** by design.
7. **Staging ≠ production guarantees** — passing on staging validates the sequence and SQL, but does not
   drill a production restore (the production backup remains data-presence verified only).

---

## 10. Validation performed (this phase)

- YAML parsed with Python `yaml.safe_load`: 1 job, 18 steps (15 `run:` blocks), trigger
  `workflow_dispatch` only, `permissions: contents: read`, non-cancelling concurrency group
  `neon-migration-staging`.
- Every `run:` block syntax-checked with Git Bash `bash -n` → all exit 0.
- Confirmed the workflow references **only** `secrets.STAGING_DIRECT` (no `secrets.DIRECT`); the production
  branch id appears only as an isolation guard constant.
- Frozen checksums unchanged; no migration file modified; production workflow unmodified.

---

## 11. Verdict

# **PREPARED — awaiting operator-supplied staging branch/secret**

The staging workflow is isolated, confirmation-gated, least-privilege, concurrency-protected, checksum- and
transaction-safe, and fail-closed, and it reuses the production migration sequence. It cannot connect to
production by construction.

**Blocked only on operator input:** the exact staging branch id and the `STAGING_DIRECT` secret (§2). These
are intentionally not guessed.

**STOP.** No migration executed, no Neon changes, no production connection, nothing pushed. Awaiting the
staging branch details and explicit approval to dispatch.
