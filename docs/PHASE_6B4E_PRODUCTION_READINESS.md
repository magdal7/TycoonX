# TycoonX — Phase 6B.4E: Final Production Migration Readiness

**Status:** Documentation and a safety patch prepared. **No migration executed. No Neon changes. Nothing
pushed.**  
**Production verdict:** **NO-GO** — execution readiness is green, but the pre-dispatch gates in §3 are not yet
satisfied (see §1.1).  
**Date:** 2026-10-17  
**Repository:** https://github.com/magdal7/TycoonX (default branch `master`)  
**Companions:** `docs/PHASE_6B4A_GITHUB_ACTIONS_REPORT.md`, `docs/PHASE_6B4B_MIGRATION_EXECUTION_PLAN.md`,
`docs/PHASE_6B4C_STAGING_TEST.md`, `docs/PHASE_6B4D_RECOVERY_DRILL.md`,
`docs/PHASE_6B3A_EXECUTION_GATE.md`, `docs/PHASE_6B2D_FINAL_PREFLIGHT.md`.

---

## 1. Context and evidence

| Item | Value / Status |
|---|---|
| Neon project | `wandering-king-57462138` |
| Production branch | `br-delicate-butterfly-b4et73g9` (not migrated) |
| Staging branch | `br-dawn-cherry-b4dnrhm5` — **staging migration: PASS** |
| Recovery drill branch | `br-long-king-b4s8l0yv` — **recovery migration: PASS** |
| Recovery reset from production | **PASS** |
| Read-only recovery verification | **PASS** |
| Protected backup | `backup-before-economy-v2` (data-presence verified) |
| Production execution workflow | `.github/workflows/neon-migration-execute.yml` |
| Fresh production preflight | `.github/workflows/neon-migration-preflight.yml` |

All four frozen Economy V2 migrations passed on staging and on the isolated recovery drill branch; the drill
proved a migrated branch can be returned to the pre-migration state with data preserved.

### 1.1 Why NO-GO (explicit)

The **execution machinery is ready** (see §3, all code/checks green). The migration is **NO-GO** until these
critical pre-dispatch safety prerequisites are satisfied, because they cannot be verified from code alone:

1. **Fresh read-only production preflight** has not been run **immediately before** dispatch (required by §4).
2. **A production-compatible restore path is not yet verified for production** — the drills proved branch
   reset/restore mechanics on disposable branches, not a restore of production from
   `backup-before-economy-v2`, and the **production PITR retention window is not confirmed** to cover the
   migration (see §5).
3. **Maintenance window / external-writer stop** is not yet confirmed (§6).

When all boxes in §3 are checked, the verdict flips to **GO**.

---

## 2. Safety patch applied (requirement 3)

**Finding:** the production workflow verified the Neon **branch** identity via server-side metadata
(`current_setting('neon.branch_id')`) but did **not** verify the **project** identity. A wrong project with a
colliding branch id is extremely unlikely but is a real gap against "independent server-side branch and
project identity checks".

**Patch (minimal, in `.github/workflows/neon-migration-execute.yml`):**

1. Added `EXPECTED_PROJECT_ID: wandering-king-57462138` to the job env.
2. In the pre-migration (read-only) step, before any write, added:
   ```bash
   PROJECT="$(q "SELECT current_setting('neon.project_id', true)")"
   ...
   if [ -z "$PROJECT" ] || [ "$PROJECT" != "$EXPECTED_PROJECT_ID" ]; then
     echo "::error title=Project mismatch::connected project is not $EXPECTED_PROJECT_ID"
     exit 1
   fi
   ```
   and the summary line now records the project: `branch OK: <branch> (project <project>)`.

The check is read-only and runs in the same step as the branch check, which is the **first** step that
touches the database and precedes every write (baseline `resolve`, both applies, both `resolve`s). It fails
closed if the metadata is empty. No other workflow behavior changed.

---

## 3. Go / No-Go checklist (requirement 2)

| # | Prerequisite | State |
|---|---|---|
| 1 | Staging migration PASS | ✅ |
| 2 | Recovery migration PASS | ✅ |
| 3 | Recovery reset from production PASS | ✅ |
| 4 | Read-only recovery verification PASS | ✅ |
| 5 | Production workflow has **server-side branch AND project** identity checks before any write (patched) | ✅ |
| 6 | Frozen migration checksums unchanged (§7) | ✅ |
| 7 | Pre-migration expected state documented (§7) | ✅ |
| 8 | **Fresh read-only production preflight run immediately before dispatch and PASS** | ⬜ **required** |
| 9 | **Production-compatible restore confirmed** (backup restore drill **or** PITR window covering the migration) | ⬜ **required** |
| 10 | **Maintenance window approved; API server + client stopped; no external writers** | ⬜ **required** |
| 11 | Operator holds `DIRECT` + confirmation token; approval recorded | ⬜ **required** |
| 12 | Post-migration verification owner and rollback owner assigned | ⬜ **required** |

**Any unchecked item = NO-GO.** Items 8–12 are operational and cannot be satisfied by code changes.

---

## 4. Fresh read-only production preflight (requirement 4)

Immediately before dispatch, run the read-only preflight on the **same commit** that will run the migration:

1. GitHub → **Actions → "Neon Migration Preflight (read-only)" → Run workflow** → branch `master`.
2. Require: checksums OK, TCP connectivity OK, branch OK (`br-delicate-butterfly-b4et73g9`), `User=2` ids
   `2,4`, `CEO=8` ids `2,3,4,5,6,7,8,10`, 0 collisions, `_prisma_migrations`/`AppMeta`/`OwnedCeo` absent,
   `prisma validate` OK, TypeScript OK, tests OK.
3. If the preflight fails or shows drift, **STOP** — do not dispatch the migration.

The preflight is read-only and safe to re-run. The production migration workflow itself re-runs equivalent
checks (branch, project, state) before its first write, so a preflight pass is necessary but not a substitute
for the in-workflow checks.

---

## 5. Backup and production-compatible restore (requirement 5)

### 5.1 Backup status
- `backup-before-economy-v2` exists and is **data-presence verified**: `User=2` (ids `2,4`), `CEO=8` (ids
  `2,3,4,5,6,7,8,10`), no economy objects, no `_prisma_migrations`. **Preserve it; never reset/delete.**
- **Limitation:** this is a data-presence check, **not a drilled restore**. A production restore from this
  backup has not been performed (doing so would touch production).

### 5.2 Production-compatible restore options

**Option A — Instant restore / PITR of production (preferred if the window is confirmed).**
Restore production to a point in time **just before** the migration.
- **Requirement:** the production branch's **history/retention window must cover** the migration timestamp.
  The duration is **plan-dependent and is not assumed here**. Confirm it in the Neon Console **before**
  dispatch; if it does not cover the required point, this option is unavailable.
- Exact operator steps (console; labels may vary): production branch → **Restore** (instant restore) → choose
  a timestamp before the migration → confirm. Then run the read-only verification (the preflight's DB checks)
  to confirm the pre-migration state.

**Option B — Branch from the backup (preserves the backup).**
Create a new branch from `backup-before-economy-v2`, verify it is at the pre-migration state (read-only), then
repoint the application's connection string to the new branch. This does **not** modify the backup.
- This is a "recover by switching target", not an in-place restore; it requires an application connection
  change and a verification pass.

**Not assumed:** a Neon "reset branch A to branch B" cross-branch restore. Do not rely on it without
confirming the exact feature/CLI.

### 5.3 Restore limitations (documented)
- PITR availability/retention for production is **unconfirmed**; if it cannot be confirmed, the restore path
  is Option B.
- No production restore has been drilled (cannot be, without touching production); the recovery drill
  validated the mechanics on a disposable branch only.
- Restoring returns DB state, not application state; the app must be restarted/repointed as needed.

---

## 6. Maintenance window, writer controls, monitoring, failure handling (requirement 6)

### 6.1 Maintenance window
- Announce a short window; **stop the API server and the client** so nothing writes during the run.
- No scheduled jobs exist, but confirm none are running. The migration workflow's concurrency group prevents
  overlapping workflow runs, not application writes.

### 6.2 External-writer controls (guarantees that cannot be provided)
- The workflow **cannot** exclude external writers (app, Neon console, other clients). This is an operator
  responsibility during the window.

### 6.3 Monitoring
- Watch the workflow **Job Summary** and step logs (credentials/SQL output are redacted).
- Watch the app: `GET /api/health` = `ok`; `GET /api/ceos` returns the catalog.
- Watch `_prisma_migrations`: 4 rows, all `finished_at` set, no `rolled_back_at`.

### 6.4 Failure handling
- **Before a write:** nothing changed; fix and re-dispatch after a fresh preflight.
- **Inside a `psql --single-transaction` apply:** rolled back automatically; no partial schema.
- **After a migration commits but before its `resolve` (commit→resolve window):** the schema effect is
  present, the history row is missing. Recover by completing the metadata step for that exact migration:
  `npx prisma migrate resolve --schema server/prisma/schema.prisma --applied <name>`; if the state is
  unexpected, restore per §5.
- **Never** run `prisma migrate reset`/`dev`/`deploy`, `db push`, `DROP`, `TRUNCATE`, or delete/reset
  production or the backup to "fix" a failure.
- **No automatic retry/reapply:** re-dispatching after partial success is refused by the pre-migration check;
  recovery is always an explicit manual action.

---

## 7. Frozen checksums and expected state (requirement 7)

### 7.1 Frozen SHA-256 (verified by the workflow before any write)

| Migration | SHA-256 |
|---|---|
| `20240101000000_add_user_model` (historical) | `0cc0af4ab39b025d6953c196485bdfe76225c28729b529d9f3dbb46e6f7d7144` |
| `20240102000000_create_ceo_model` (historical) | `1a0fd8415489877c774f6e0a0c726734afbf773931e6d684be6cf7cfe2ab2107` |
| `20261017000000_phase6b1_economy_foundation` | `1a04a9c5ba3bcc3fb66335c6ce79fbcea73915f106f7160f525da2ed559d7cb3` |
| `20261017010000_phase6b2a_username_case_insensitive` | `f44f174b372e040b694e0c30b2dd2c5d31a921f154cb4399753af992820cce82` |
| `migration_lock.toml` | `d6bae7899f05da956e1070ba5703455503208ef79e161acb18c93bfe3c6cd236` |

These match the Phase 6B.2D freeze; the frozen files are unmodified.

### 7.2 Expected pre-migration state
`User=2` (ids `2,4`), `CEO=8` (ids `2,3,4,5,6,7,8,10`), 0 case-insensitive username collisions, only
`Role` enum, `User`/`CEO` tables present with historical columns/indexes, `_prisma_migrations`/`AppMeta`/
`OwnedCeo`/economy columns/`User_username_lower_key` **absent**.

### 7.3 Expected post-migration state
- `_prisma_migrations`: exactly 4 rows (2 historical baselined + 2 economy), all finished, checksums match.
- Tables `AppMeta`, `OwnedCeo`, `ReferralAttribution`, `IdempotencyKey`; enums `AcquisitionType`,
  `OwnedCeoStatus`; six additive `CEO` columns; indexes and `ReferralAttribution_no_self` constraint present.
- Catalog: `CEO=10`; existing ids `2,3,4,5,6,7,8,10` preserved; `intern-ceo` (`true:10:1`), `crypto-whale`
  (`600:2`); `User=2` preserved; `prisma migrate status` reports no pending migrations.

---

## 8. Exact manual production execution procedure (requirement 8)

> Preparation only. **Do not run this until §3 is fully green.**

1. **Freeze window:** announce maintenance; stop the API server and client; confirm no writers.
2. **Fresh preflight:** run `neon-migration-preflight.yml` (§4) → require PASS. If not, STOP.
3. **Confirm restore path:** confirm the production PITR window covers the migration, or approve Option B
   (§5). If neither is confirmed, STOP.
4. **Dispatch:** GitHub → **Actions → "Neon Migration Execute (guarded, write)" → Run workflow** → branch
   `master` → `confirm` = `APPLY-ECONOMY-V2-br-delicate-butterfly-b4et73g9` → Run.
5. **Monitor:** watch the Job Summary; the workflow verifies branch **and project** server metadata before its
   first write, then baselines historical migrations, applies 6B1 and 6B2A each in one transaction, verifies
   effects, records history, and runs final verification + `migrate status`.
6. **Post-migration verification:** confirm the Job Summary PASS; `GET /api/health` = `ok`; `GET /api/ceos`
   returns the catalog; `_prisma_migrations` has 4 finished rows.
7. **On failure:** follow §6.4. Do not re-dispatch blindly. If a restore is required, use §5.
8. **Close the window:** restart the API server and client; keep `backup-before-economy-v2` and the staging
   branch intact.

---

## 9. Guardrails and remaining limitations

- No migration, restore, reset, or branch deletion was performed in this phase; no Neon change; nothing
  pushed (requirement 9, 10).
- **Cross-boundary atomicity** between a migration's SQL commit and its `_prisma_migrations` row is **not**
  guaranteed (§6.4).
- **External writers** cannot be excluded by the workflow (§6.2).
- **`DIRECT` must be the direct (non-pooled)** production endpoint.
- **Restore is not production-drilled** and the **PITR window is unconfirmed** (§5) — the primary reason for
  NO-GO.
- **`test-ceo`** remains visible until the separate approved follow-up.

---

## 10. Validation performed (this phase)

- Production workflow YAML parses (16 steps); all `run:` blocks pass Git Bash `bash -n`.
- Patch confirmed: `EXPECTED_PROJECT_ID` env present and the project check runs in the pre-migration
  (read-only) step before any write; fails closed if `neon.project_id` is empty.
- Frozen checksums recomputed and unchanged; no migration file modified.
- No production migration, restore, reset, or deletion executed.

---

## 11. Verdict

# **NO-GO** — execution machinery ready; pre-dispatch safety gates open

All code, checks, and drills are green, and the project-identity safety gap has been patched. The production
migration must **not** be dispatched until every item in §3 is checked — specifically the fresh read-only
production preflight (§4), a confirmed production-compatible restore path (§5), and a confirmed maintenance
window with writers stopped (§6).

**STOP.** No migration executed, no restore/reset, no Neon change, nothing pushed.
