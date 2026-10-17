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
| 3 | Verify frozen checksums | `sha256sum` on all 4 migrations + lock file | Any mismatch → exit 1 before any write |
| 4 | Pre-migration read-only checks | branch id, counts/ids, collisions, pre-migration markers | Any deviation → exit 1 before any write |
| 5 | Baseline historical migrations | `prisma migrate resolve --applied` ×2 (metadata only) | `_prisma_migrations` not exactly the 2 rows → exit 1 |
| 6 | Apply 6B1 | `psql --single-transaction -f <6B1>` | Error → rollback; exit 1; nothing recorded |
| 7 | Verify 6B1 effects | tables, enums, columns, indexes, FK, CHECK, catalog | Missing/incorrect → exit 1; **history NOT recorded** |
| 8 | Record 6B1 applied | `prisma migrate resolve --applied <6B1>` | Failure → exit 1 |
| 9 | Apply 6B2A | `psql --single-transaction -f <6B2A>` | Error → rollback; exit 1; nothing recorded |
| 10 | Verify 6B2A effects | functional unique index present; 0 collisions | Missing → exit 1; **history NOT recorded** |
| 11 | Record 6B2A applied | `prisma migrate resolve --applied <6B2A>` | Failure → exit 1 |
| 12 | Final verification | history set + no failed rows + `prisma migrate status` | Unexpected history → exit 1 |
| 13 | `prisma generate` | client codegen only | Standard failure |
| 14 | Job summary | `if: always()` PASS/FAIL + recovery pointer | — |

### 6.1 Pre-migration expected state (step 4)

- `current_setting('neon.branch_id', true)` == `br-delicate-butterfly-b4et73g9` (empty ⇒ **STOP**, unverified).
- `User` = 2, ids `2,4`; `CEO` = 8, ids `2,3,4,5,6,7,8,10`.
- `_prisma_migrations` **absent**; `AppMeta`/`OwnedCeo` **absent**; economy `CEO` columns **absent**;
  `User_username_lower_key` **absent**.
- 0 case-insensitive username collisions.

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
- Zero rows with `finished_at IS NULL`.
- `prisma migrate status` reports no pending migrations.

---

## 7. Atomicity and Prisma history consistency

**Can atomic execution and history consistency be guaranteed? Yes** — with the following construction, so the
workflow is implemented rather than blocked.

1. **Per-migration atomicity:** each economy migration is applied with
   `psql -v ON_ERROR_STOP=1 --single-transaction -f <file>`. PostgreSQL (Neon PG 18) supports transactional
   DDL, so a failure in any statement aborts and rolls back the whole file. No partial schema.
2. **History recorded only after verification:** `prisma migrate resolve --applied <name>` is a
   **metadata-only** operation (it does not execute SQL). It is invoked only after the migration's effects
   have been verified read-only. This preserves the project rule *never mark applied before effects are
   verified*.
3. **History checksums are consistent:** `resolve` computes the checksum from the frozen file, which matches
   the workflow-verified SHA-256, so `prisma migrate status`/future `migrate deploy` see no drift.
4. **Fail-closed, never silent:** if a step fails, the job fails and the job summary states exactly what was
   and was not recorded. Steps after a failure are skipped.

### 7.1 Why not `prisma migrate deploy`?

`migrate deploy` would apply migrations and record history in one engine operation (also per-migration
transactional). However, the project's safety posture (`PHASE_6B2A` §9, `PHASE_6B2D` §5, `PHASE_6B3A` §5)
explicitly forbids `migrate deploy` on this database, and the approved execution gate specifies the
baseline → transactional-apply → verify → resolve sequence. This workflow implements that approved sequence.

### 7.2 Residual window (documented, not silent)

There is an unavoidable window between the **commit** of a migration's transaction (step 6/9) and the
**history row** (step 8/11). If the job dies in that window:

- The schema effect is committed; the history row is missing.
- This is **detectable** (`migrate status` shows the migration as pending while its objects exist) and the
  job summary points to recovery. It is **not silent** and **not partially applied within a migration**.
- Recovery is a re-run of the metadata step (`resolve --applied`), or a restore (see §8).

This window is the same one the approved manual gate accepts; the workflow narrows it by running apply,
verify, and resolve as consecutive steps.

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

1. **`DIRECT` endpoint reachability:** the workflow depends on the runner reaching the direct endpoint over
   TCP `:5432`. The preflight proved this for the read-only path; the write path uses the same host. If the
   secret is a pooled endpoint, `prisma migrate resolve` may fail through PgBouncer — the workflow fails
   closed and no SQL is applied.
2. **`resolve` creates `_prisma_migrations`:** the project's prior reports assert this. The workflow verifies
   the table and its two baseline rows immediately after and fails closed otherwise. If `resolve` cannot
   create it, the fallback (manual `_prisma_migrations` creation) is **approval-required** and is not
   automated here.
3. **`resolve` metadata window** (§7.2) — documented and recoverable.
4. **Restore not drilled:** the backup was verified by data presence, not a tested restore.
5. **`test-ceo` remains** until the separate approved follow-up (`isActive=false` + Market filter).
6. **Frozen-file discipline:** any later edit to a migration file invalidates the checksums and the recorded
   checksum; the workflow's checksum step would fail closed.
7. **Concurrency:** the game must not be writing during the run; the concurrency group prevents overlapping
   workflow runs but cannot stop the application. Operators should coordinate a maintenance window.

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
- Frozen checksums recomputed on disk and matched the freeze values (§3.1).
- Server type-check (`npm run build --workspace=server`) and tests remain green from prior phases; no source
  files were changed in this phase.

---

## 13. Verdict

# **PREPARED — awaiting approval to dispatch**

The workflow is dispatch-only, confirmation-gated, least-privilege, concurrency-protected, checksum- and
branch-verified, transactional per migration, history-consistent, and fail-closed. Atomic execution and
Prisma history consistency **can** be guaranteed by this construction, so no blocker prevents preparing it.

**STOP.** No migration executed, no Neon writes, no `resolve`, no `_prisma_migrations`, nothing pushed.
Awaiting explicit approval to run the workflow.
