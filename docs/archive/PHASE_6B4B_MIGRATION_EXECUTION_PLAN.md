# TycoonX — Phase 6B.4B: Controlled Neon Migration Execution Plan

**Status:** Workflow and documentation prepared. **No migration executed. No Neon writes. No `resolve`.
No `_prisma_migrations` created. Nothing pushed.** Awaiting review and explicit approval to dispatch.  
**Date:** 2026-10-17  
**Repository:** https://github.com/magdal7/TycoonX (default branch `master`)  
**Companions:** `docs/PHASE_6B3A_EXECUTION_GATE.md`, `docs/PHASE_6B3B_MIGRATION_EXECUTION_REPORT.md`,
`docs/PHASE_6B4A_GITHUB_ACTIONS_REPORT.md`, `docs/PHASE_6B2D_FINAL_PREFLIGHT.md`.

---

## 1. Purpose and scope

This phase adds a **separate, manually triggered, production-safe migration execution workflow** that applies
the frozen Economy V2 migrations to the production Neon branch and records Prisma migration history
consistently. It builds on the read-only preflight (`.github/workflows/neon-migration-preflight.yml`), which
has passed.

Deliverables of this phase:

| Artifact | Path |
|---|---|
| Execution workflow | `.github/workflows/neon-migration-execute.yml` |
| This plan | `docs/PHASE_6B4B_MIGRATION_EXECUTION_PLAN.md` |

**Not in scope:** gameplay route enablement, purchases, withdrawals, payments, frontend changes, and any
edit to the frozen SQL files or their checksums. No historical migration is replayed.

---

## 2. Guardrails honored in this phase

- No workflow was dispatched; **no database connection was made** from this phase.
- No Neon object was created, altered, or dropped; `_prisma_migrations` remains absent.
- No secret is read, printed, or written to a file; `.env`/`.env.*` stay gitignored.
- Frozen SQL files and `migration_lock.toml` are **unchanged** (checksums below match the freeze).
- `test-ceo.isActive`, catalog rows, and all existing `User`/`CEO` data are untouched.

---

## 3. Preconditions (must all be true before dispatch)

1. The read-only preflight run passed on the same commit that contains this workflow.
2. Repository secret **`DIRECT`** is set to the **direct (non-pooled)** production connection string for
   project `wandering-king-57462138`, branch `br-delicate-butterfly-b4et73g9`, database `neondb`. The runner
   must be able to reach it over TCP `:5432` (the preflight already proved this).
3. The backup branch `backup-before-economy-v2` exists and was verified (data-level) — see
   `docs/PHASE_6B2D_FINAL_PREFLIGHT.md`. The workflow does **not** touch the backup.
4. The two economy migration files are frozen (checksums below) and unchanged in git.
5. No application process is writing to the database during the run (the game is not serving writes; no
   scheduled jobs exist).

### 3.1 Frozen checksums (verified by the workflow before any write)

| Migration | SHA-256 |
|---|---|
| `20240101000000_add_user_model` (historical) | `0cc0af4ab39b025d6953c196485bdfe76225c28729b529d9f3dbb46e6f7d7144` |
| `20240102000000_create_ceo_model` (historical) | `1a0fd8415489877c774f6e0a0c726734afbf773931e6d684be6cf7cfe2ab2107` |
| `20261017000000_phase6b1_economy_foundation` | `1a04a9c5ba3bcc3fb66335c6ce79fbcea73915f106f7160f525da2ed559d7cb3` |
| `20261017010000_phase6b2a_username_case_insensitive` | `f44f174b372e040b694e0c30b2dd2c5d31a921f154cb4399753af992820cce82` |
| `migration_lock.toml` | `d6bae7899f05da956e1070ba5703455503208ef79e161acb18c93bfe3c6cd236` |

---

## 4. Secrets and permissions

- **Secret:** `secrets.DIRECT` only. It is exposed to the job as `DATABASE_URL` and `DIRECT_URL` (the latter
  is what Prisma migrations use as `directUrl`). It is passed via env and never echoed.
- **Permissions:** `permissions: contents: read` (least privilege). The workflow does not need `write`.
- **Concurrency:** `group: neon-migration-execute`, `cancel-in-progress: false` — two executions cannot
  overlap, and an in-flight run cannot be cancelled mid-transaction.
- **Recommended hardening (optional):** bind the job to a GitHub **Environment** (e.g. `production`) with
  required reviewers, so dispatch alone is not sufficient. This is not required by the workflow and can be
  added without code changes.

---

## 5. Required confirmation input

The workflow is `workflow_dispatch` only and requires a `confirm` input that must exactly equal:

```
APPLY-ECONOMY-V2-br-delicate-butterfly-b4et73g9
```

The token embeds the production branch id, forcing the operator to acknowledge the target. If the input does
not match, the first step fails and **no checkout, no install, and no database access occur**. The input is
passed to the shell via `env:` (not interpolated into the script) to avoid script injection.

---

## 6. Execution sequence (workflow steps, in order)

| # | Step | What it does | Fail-closed behavior |
|---|---|---|---|
| 1 | Confirm intent | Compares `inputs.confirm` to the token | Mismatch → exit 1 before anything else |
| 2 | Checkout / Setup Node / `npm ci` | Reproducible environment | Standard failure |
| 3 | Verify frozen checksums + transaction safety | `sha256sum` on all 4 migrations + lock file; scan the two economy files for transaction-incompatible statements | Any mismatch or unsafe statement → exit 1 before any write |
| 4 | Pre-migration read-only checks | branch id, counts/ids, collisions, pre-migration markers, historical-schema match | Any deviation → exit 1 before any write |
| 5 | Baseline historical migrations | `prisma migrate resolve --applied` ×2 (metadata only); verify rows + checksums | Not exactly the 2 rows, or checksum mismatch → exit 1 |
| 6 | Apply 6B1 | `psql --single-transaction -f <6B1>` (output captured, not streamed) | Error → rollback; exit 1; nothing recorded |
| 7 | Verify 6B1 effects | tables, enums, columns, indexes, FK, CHECK, catalog | Missing/incorrect → exit 1; **history NOT recorded** |
| 8 | Record 6B1 applied | `prisma migrate resolve --applied <6B1>` | Failure → exit 1 (recovery required) |
| 9 | Apply 6B2A | `psql --single-transaction -f <6B2A>` (output captured, not streamed) | Error → rollback; exit 1; nothing recorded |
| 10 | Verify 6B2A effects | functional unique index present; 0 collisions | Missing → exit 1; **history NOT recorded** |
| 11 | Record 6B2A applied | `prisma migrate resolve --applied <6B2A>` | Failure → exit 1 (recovery required) |
| 12 | Final verification | history names + per-row checksums + completion + no failed rows + `prisma migrate status` | Any mismatch → exit 1 |
| 13 | `prisma generate` | client codegen only | Standard failure |
| 14 | Job summary | `if: always()` PASS/FAIL + recovery pointer | — |

### 6.1 Pre-migration expected state (step 4)

- `current_setting('neon.branch_id', true)` == `br-delicate-butterfly-b4et73g9` (empty ⇒ **STOP**, unverified).
- `User` = 2, ids `2,4`; `CEO` = 8, ids `2,3,4,5,6,7,8,10`.
- `_prisma_migrations` **absent**; `AppMeta`/`OwnedCeo` **absent**; economy `CEO` columns **absent**;
  `User_username_lower_key` **absent**.
- 0 case-insensitive username collisions.
- **Historical-schema match** (justifies baselining the two historical migrations, whose recorded effect is
  the schema, not their seed data): `Role` enum present; `User_email_key`, `User_username_key`, `CEO_slug_key`
  present; `User` has all 7 historical columns; `CEO` has all 11 historical columns. If any is missing the
  workflow **stops** — baselining is only safe when the observed schema matches the historical migrations'
  effects.

### 6.1.1 psql output handling (task 3)

- `psql` output (stdout **and** stderr) for the two applies is **captured to files and never streamed**. On
  success only a one-line summary is written; on failure a **redacted, 40-line tail** is printed.
- Every diagnostic path passes through a redactor that replaces `postgres…://…` with `[REDACTED_DSN]` and
  `*.neon.tech` with `[REDACTED_HOST]` before anything reaches the logs.
- `prisma migrate resolve` output is likewise captured and redacted on failure.
- Read-only verification queries intentionally print **schema metadata only** (table/column/index names,
  counts, slugs) — never credentials, DSNs, or row payloads.

### 6.2 6B1 verification (step 7)

- Tables: `AppMeta, IdempotencyKey, OwnedCeo, ReferralAttribution`.
- Enums: `AcquisitionType, OwnedCeoStatus`.
- `CEO` columns: `baseSpPerCycle, category, displayOrder, isStarter, maxOwned, rewardEligible`.
- Indexes: the 6B1 set (3 `OwnedCeo` indexes, `ReferralAttribution_referredUserId_key`,
  `ReferralAttribution_referrerId_idx`, `IdempotencyKey_userId_scope_key_key`, `OwnedCeo_starter_user_key`,
  `AppMeta_key_key`).
- CHECK `ReferralAttribution_no_self` present; 5 foreign keys present.
- Catalog: `CEO` = 10 rows; existing ids `2,3,4,5,6,7,8,10` preserved; `intern-ceo` = `true:10:1`
  (`isStarter:baseSpPerCycle:maxOwned`); `crypto-whale` = `600:2`; `User` = 2.

### 6.3 6B2A verification (step 10)

- `User_username_lower_key` exists.
- Still 0 case-insensitive username collisions.

### 6.4 Final verification (step 12)

- `_prisma_migrations` contains exactly, in name order:
  `20240101000000_add_user_model, 20240102000000_create_ceo_model,
  20261017000000_phase6b1_economy_foundation, 20261017010000_phase6b2a_username_case_insensitive`.
- **Per-row checksum match:** each row's `checksum` equals the frozen SHA-256 of its migration file (§3.1).
- **Successful completion:** zero rows with `finished_at IS NULL`.
- **No failed/rolled-back records:** zero rows with `finished_at IS NULL OR rolled_back_at IS NOT NULL`.
- `prisma migrate status` reports no pending migrations.

---

## 7. Atomicity and Prisma history consistency

**What is actually guaranteed (per migration):**

1. **Whole-file atomicity within one migration.** Each economy migration is applied with
   `psql -v ON_ERROR_STOP=1 --single-transaction -f <file>`. `--single-transaction` issues `BEGIN` before the
   file and `COMMIT` after it; `ON_ERROR_STOP=1` makes any error abort the script. On abort, psql exits
   without committing, the connection closes, and PostgreSQL rolls back the open transaction. PostgreSQL
   (Neon PG 18) supports transactional DDL, so **a failure leaves no partial schema from that file**. A guard
   in step 3 also refuses to proceed if a frozen file contains `BEGIN`/`COMMIT`/`ROLLBACK`,
   `CREATE INDEX CONCURRENTLY`, `CREATE DATABASE`, `DROP DATABASE`, `VACUUM`, or `REINDEX … CONCURRENTLY`
   (none of which are present in the frozen files), since those would silently break the guarantee.
2. **History recorded only after verification.** `prisma migrate resolve --applied <name>` is
   **metadata-only** (it does not execute SQL) and runs only after that migration's effects are verified
   read-only, preserving the project rule *never mark applied before effects are verified*.
3. **History checksum consistency.** `resolve` computes the checksum from the frozen file; the workflow
   asserts each `_prisma_migrations.checksum` equals the frozen SHA-256 (§6.4), so `migrate status`/future
   `migrate deploy` see no drift.
4. **Fail-closed, never silent.** Any failed check exits non-zero; steps after a failure are skipped; the job
   summary states what was and was not recorded.

**What is NOT guaranteed (explicit):**

- **No atomicity across the SQL commit and the `_prisma_migrations` row.** They are two separate operations
  (a `psql` transaction, then a Prisma `resolve`). A small window exists in which the schema change is
  committed but its history row is not yet written. The workflow does **not** claim cross-boundary atomicity.
- **No exclusion of external writers.** The workflow cannot stop the application, a Neon console session, or
  another client from writing to the database during the run.

### 7.1 Why not `prisma migrate deploy`?

`migrate deploy` would apply migrations and record history in one engine operation (also per-migration
transactional). However, the project's safety posture (`PHASE_6B2A` §9, `PHASE_6B2D` §5, `PHASE_6B3A` §5)
explicitly forbids `migrate deploy` on this database, and the approved execution gate specifies the
baseline → transactional-apply → verify → resolve sequence. This workflow implements that approved sequence.

### 7.2 The commit → resolve window (precise recovery)

There is an unavoidable window between the **commit** of a migration's transaction (step 6/9) and the
**history row** (step 8/11). If the job is interrupted in that window:

- The schema effect is committed; the history row is missing.
- This is **detectable** (`migrate status` shows the migration as pending while its objects exist) and the
  job summary points to recovery. It is **not silent**, and **not partially applied within a migration**.
- **Recovery (exact):**
  1. Stop the API server and the client; ensure no writer is active.
  2. Confirm the migration's effects are fully present using the step-7 / step-10 checks
     (`docs/PHASE_6B3A_EXECUTION_GATE.md` §6).
  3. If the effect is fully present, complete the metadata step for the exact migration name:
     `npx prisma migrate resolve --schema server/prisma/schema.prisma --applied <migration_name>`.
  4. If the effect is **not** fully present (should not happen with a transactional apply), **restore** from
     `backup-before-economy-v2` or PITR to just before the apply, then re-verify the pre-migration state.
- **Re-dispatch is refused:** the step-4 pre-migration check fails if `_prisma_migrations`, `AppMeta`,
     `OwnedCeo`, economy columns, or `User_username_lower_key` already exist. Therefore a re-run of this
     workflow after any partial success **cannot** automatically retry or reapply — recovery is always an
     explicit manual action.

---

## 8. Rollback and recovery

- **Preserve `backup-before-economy-v2`; never reset or delete it.** Production is
  `br-delicate-butterfly-b4et73g9` (project `wandering-king-57462138`, db `neondb`).
- **Failure inside a transaction (steps 6/9):** PostgreSQL rolls back automatically; the database is
  unchanged; re-verify and retry. Nothing was recorded.
- **Failure after a migration commits but before it is recorded (between 6→8 or 9→11):**
  1. Stop the API server and client (no writes during recovery).
  2. Inspect read-only; the effect should be fully present (transactional apply).
  3. **Complete** the metadata step: `npx prisma migrate resolve --schema server/prisma/schema.prisma
     --applied <migration_name>`.
  4. If the state is not the expected full effect, **restore**: reset the production branch to
     `backup-before-economy-v2` (or PITR to just before the apply), then re-verify the pre-migration state.
  5. Do **not** `DROP`/`TRUNCATE` to "clean up"; restore instead.
- **Incorrect history (e.g. a failed `resolve`):** re-run `resolve --applied` once; if it still fails, STOP
  and inspect. Manual `_prisma_migrations` edits require explicit approval.
- **Post-recovery verification:** `User`=2 (ids 2,4), `CEO`=8 (ids 2–8,10), `AppMeta`/`_prisma_migrations`
  absent, no economy tables/columns.

---

## 9. Risks and limitations

### 9.1 Concurrency, cancellation, timeout, and external writers (task 8)

| Concern | What the workflow provides | What it **cannot** guarantee |
|---|---|---|
| **Concurrency** | `concurrency: group: neon-migration-execute`, `cancel-in-progress: false`. A second dispatch queues behind the running one; a newer run cannot cancel the running one. | It only serializes *this workflow*. It cannot stop the application, a Neon SQL editor session, or any other client from connecting/writing. |
| **Manual cancellation** | `cancel-in-progress: false` blocks automatic supersede-cancel. | A human can still click **Cancel workflow**. If cancelled while a `psql --single-transaction` apply is running, the connection closes and the open transaction rolls back (uncommitted). If cancelled **between** a migration's commit and its `resolve`, the commit→resolve window applies (§7.2). |
| **Timeout** | `timeout-minutes: 20` bounds the run; a hung step cannot run indefinitely. | On timeout, GitHub terminates the job. A termination during an apply rolls back the open transaction; a termination between commit and resolve leaves the §7.2 window. The timeout does not guarantee a graceful `resolve`. |
| **External database writers** | The pre-migration step asserts the expected pre-migration state immediately before writes. | There is **no locking** that excludes external writers. The application must be stopped / put in a maintenance window by the operator; the workflow cannot enforce this. |
| **Cross-boundary atomicity** | Per-migration transactional apply (see §7). | No atomicity across SQL commit and `_prisma_migrations` row (§7, "What is NOT guaranteed"). |

**Operational recommendation:** run during an announced maintenance window with the API server and client
stopped, and do not interact with the Neon console for the target branch while the workflow runs.

### 9.2 Remaining limitations

1. **`DIRECT` endpoint reachability:** the workflow depends on the runner reaching the direct endpoint over
   TCP `:5432`. The preflight proved this for the read-only path; the write path uses the same host. If the
   secret is a pooled endpoint, `prisma migrate resolve` may fail through PgBouncer — the workflow fails
   closed and no SQL is applied.
2. **`resolve` creates `_prisma_migrations`:** the project's prior reports assert this. The workflow verifies
   the table, its two baseline rows, and their checksums immediately after, and fails closed otherwise. If
   `resolve` cannot create it, the fallback (manual `_prisma_migrations` creation) is **approval-required**
   and is not automated here.
3. **Prisma checksum algorithm assumption:** the workflow asserts `_prisma_migrations.checksum` equals the
   file SHA-256. This matches Prisma's documented checksum (SHA-256 of the migration file) and the project's
   prior reports. If a future Prisma version changed the algorithm, this check would fail **closed** (blocking
   dispatch) rather than risk drift; the operator would then investigate rather than bypass.
4. **`resolve` metadata window** (§7.2) — documented, detectable, and recoverable; **not** claimed atomic.
5. **Restore not drilled:** the backup was verified by data presence, not a tested restore.
6. **`test-ceo` remains** until the separate approved follow-up (`isActive=false` + Market filter).
7. **Frozen-file discipline:** any later edit to a migration file invalidates the checksums and the recorded
   checksum; the workflow's checksum step would fail closed.
8. **No automatic retry/reapply** by design; any partial success requires an explicit manual recovery action
   (§7.2, §8).
9. **Baseline is schema-only:** the two historical migrations are recorded for their **schema** effect; their
   original seed data is intentionally not asserted (live data drifted: `crypto-whale` was absent and
   `test-ceo` present before this phase). The workflow never replays them.

---

## 10. Forbidden commands (never run against this database)

`prisma migrate reset`, `prisma migrate dev`, `prisma migrate deploy`, `prisma db push`, and any
`DROP`/`TRUNCATE`/`DELETE`/destructive `ALTER`. The workflow contains none of these.

---

## 11. How to execute (manual, after approval)

1. Confirm §3 preconditions (preflight green, `DIRECT` set, backup verified, files frozen).
2. GitHub → **Actions → "Neon Migration Execute (guarded, write)" → Run workflow**.
3. Select branch **`master`**.
4. In `confirm`, type exactly: `APPLY-ECONOMY-V2-br-delicate-butterfly-b4et73g9`.
5. Run and read the **Job Summary** and step logs.
6. On success: all four migrations are applied/recorded and `prisma migrate status` reports no pending.
7. On failure: do not re-dispatch blindly; follow §8 and the job summary.

---

## 12. Local validation performed (this phase)

- YAML parsed with Python `yaml.safe_load`: 1 job, 16 steps, trigger `workflow_dispatch` only,
  `permissions: contents: read`, non-cancelling concurrency group.
- Every `run:` block syntax-checked with Git Bash `bash -n` → all exit 0.
- The transaction-safety scan pattern was checked against both economy migration files → both **clean**
  (no `BEGIN`/`COMMIT`/`ROLLBACK`, `CREATE INDEX CONCURRENTLY`, `CREATE DATABASE`, `DROP DATABASE`, `VACUUM`,
  or `REINDEX … CONCURRENTLY`).
- Frozen checksums recomputed on disk and matched the freeze values (§3.1); no migration file was modified.
- Server type-check (`npm run build --workspace=server`) and tests (15/15) remain green; no source files were
  changed in this phase.

---

## 13. Verdict

# **PREPARED — awaiting approval to dispatch**

The workflow is dispatch-only, confirmation-gated, least-privilege, concurrency-protected, checksum- and
branch-verified, transaction-safe, and fail-closed. **Per-migration atomicity is guaranteed** by
`psql --single-transaction` plus the transaction-safety guard. **Atomicity across a migration's SQL commit
and its `_prisma_migrations` row is explicitly NOT guaranteed**; that window is documented with a precise
manual recovery procedure (§7.2), and automatic retry/reapply is refused by the pre-migration check.

**Remaining production blockers to acknowledge before dispatch:**

1. **No exclusion of external writers** — the operator must stop the application / use a maintenance window.
   The workflow cannot enforce this (§9.1).
2. **No drilled restore** — the backup is verified by data presence only, not by a tested restore (§9.2).
3. **`DIRECT` must be the direct (non-pooled) endpoint** — otherwise `resolve` may fail closed (§9.2).

None of these are code defects; they are operational preconditions. There is **no blocker that prevents
preparing the workflow**, and none of these conditions is silently ignored by it.

**STOP.** No migration executed, no Neon writes, no `resolve`, no `_prisma_migrations`, nothing pushed.
Awaiting explicit approval to run the workflow.
