# TycoonX — Phase 6B.4D: Isolated Neon Recovery Drill

**Status:** Drill design and a read-only verification workflow prepared. **No restore executed. No branch
created or deleted. No Neon changes. No production execution. Nothing pushed.** Awaiting the operator to
supply the disposable drill branch and secret, then run the drill manually.  
**Date:** 2026-10-17  
**Repository:** https://github.com/magdal7/TycoonX (default branch `master`)  
**Companions:** `docs/PHASE_6B4B_MIGRATION_EXECUTION_PLAN.md`, `docs/PHASE_6B4C_STAGING_TEST.md`,
`docs/PHASE_6B3A_EXECUTION_GATE.md`.

---

## 1. Context and goal

- **Production branch:** `br-delicate-butterfly-b4et73g9` — **not migrated** (no `_prisma_migrations`, no
  economy objects).
- **Successful staging branch:** `br-dawn-cherry-b4dnrhm5` — all four migrations passed; **preserve as
  evidence, never modify/delete.**
- **Protected backup:** `backup-before-economy-v2` — **never reset, delete, or modify.**
- Production migrations have **not** been executed.

**Goal:** prove, in isolation, that a Neon branch in the **migrated** state can be returned to the
**pre-migration** state with original data preserved — without touching production, the backup, or the
successful staging branch.

Deliverables:

| Artifact | Path | Notes |
|---|---|---|
| This plan | `docs/PHASE_6B4D_RECOVERY_DRILL.md` | Required |
| Read-only verification workflow | `.github/workflows/neon-recovery-verify.yml` | Included (see §6); SELECT-only |

No existing workflow, migration file, or checksum is modified (requirement 11).

---

## 2. Neon capability assessment (requirement 4)

| Capability | Assessment | Basis |
|---|---|---|
| Create a copy-on-write branch from a parent | **Supported** | Neon branching is a core feature; used by 6B4C. |
| **Reset from parent** (discard a branch's changes, return it to the parent's current state) | **Supported and deterministic** | Documented Neon branch operation ("Reset from parent"). This is the drill's **primary** restore method. |
| **Instant restore / PITR** (restore a branch to a past point in time within its history window) | **Supported but time-bounded** | Neon keeps a per-branch history/retention window; restoring is only possible within it. The **duration is plan-dependent and is not assumed here** — the operator must confirm in the console that the window covers the required timestamp. This is the production-mirroring method (conditional). |
| "Reset branch A to the state of branch B" (cross-branch restore) | **Not assumed** | Not relied upon. If the operator needs this, confirm the exact Neon feature/CLI before use; do **not** guess. |

**Decision:** the drill uses **Reset from parent** as the guaranteed restore mechanism. PITR is documented as
an optional production-mirroring method with an explicit "confirm the retention window first" gate. If either
mechanism cannot be confirmed, **stop and do not proceed** rather than guessing.

---

## 3. Drill design (requirements 2 and 3)

Use a **disposable** branch `drill-recovery-6b4d` (name is a suggestion) whose **parent is a pre-migration
branch** — production (`br-delicate-butterfly-b4et73g9`) while it is still un-migrated, or alternatively the
backup `backup-before-economy-v2`.

```
create D from a PRE-MIGRATION parent   -> D is pre-migration
        |
   (verify pre-migration state)         <- read-only workflow (optional baseline)
        |
   migrate D (frozen sequence)          -> D is migrated (simulates production post-migration)
        |
   RESTORE D  (reset from parent, or PITR to before the apply)
        |
   (verify pre-migration state)         <- read-only workflow (the actual drill assertion)
        |
   delete D (cleanup)
```

This demonstrates a **real** migrated → pre-migration restore with data preserved, not a mere inspection of a
backup clone (requirement 3).

**Isolation:** D is the only branch written to or reset. Production, the backup, and the staging branch are
never selected in any write/restore/reset/delete operation (requirement 6).

> **Dependency:** the primary method returns D to its **parent's current state**. Run the drill while the
> parent (production) is still pre-migration. If you instead parent D on `backup-before-economy-v2`, the
> result is independent of production's state.

---

## 4. Information the operator MUST provide (not guessed)

| # | Required item | Where it goes | Notes |
|---|---|---|---|
| 1 | **Drill branch id** (e.g. `br-xxxx`) | `recovery_branch` workflow input | The exact `neon.branch_id` of `drill-recovery-6b4d`. Must differ from production and staging ids. |
| 2 | **Drill branch direct connection string** | repository secret **`RECOVERY_DIRECT`** | Direct (non-pooled) endpoint. **Never** reuse `DIRECT` or `STAGING_DIRECT`. |
| 3 | **Confirmation token** | `confirm` workflow input | Must be exactly `VERIFY-RECOVERY-6B4D`. |

If any is missing, do not run. The verification workflow fails closed with `Missing secret`,
`Missing recovery branch`, `Refusing production`, or `Refusing staging`.

---

## 5. Exact Neon Console steps (requirement 9)

> Console labels may vary slightly by Neon release. The **branch id** — not the display name — is the
> authoritative identity; always confirm it.

### 5.1 Create the disposable drill branch
1. Neon Console → project `wandering-king-57462138` → **Branches** → **Create branch** (New branch).
2. Parent = **production `br-delicate-butterfly-b4et73g9`** (pre-migration), or `backup-before-economy-v2`.
3. Name it `drill-recovery-6b4d`; create. This is a copy-on-write branch; the parent is unchanged.
4. Open the branch and record its **branch id** (`br-…`). This is the `recovery_branch` value.

### 5.2 Configure the dedicated secret
5. Open the drill branch → **Connection details**; select role `neondb_owner`, database `neondb`, and the
   **direct (non-pooled)** connection string. Copy it.
6. GitHub → Settings → Secrets and variables → Actions → set secret **`RECOVERY_DIRECT`** to that string.
   Do not commit it anywhere.

### 5.3 (Optional) Baseline verification
7. Dispatch the read-only workflow (§6) with `recovery_branch = <drill id>` and confirm it reports
   **pre-migration state**. This proves the drill branch starts clean.

### 5.4 Migrate the drill branch (simulate post-migration)
Run the frozen sequence against **D only**. Set the connection string in the shell without echoing it
(PowerShell): `$env:DIRECT_URL = "<drill direct connection string>"`; run from the repo root:

```bash
npx prisma migrate resolve --schema server/prisma/schema.prisma --applied 20240101000000_add_user_model
npx prisma migrate resolve --schema server/prisma/schema.prisma --applied 20240102000000_create_ceo_model
psql "$DIRECT_URL" -v ON_ERROR_STOP=1 --single-transaction -f server/prisma/migrations/20261017000000_phase6b1_economy_foundation/migration.sql
npx prisma migrate resolve --schema server/prisma/schema.prisma --applied 20261017000000_phase6b1_economy_foundation
psql "$DIRECT_URL" -v ON_ERROR_STOP=1 --single-transaction -f server/prisma/migrations/20261017010000_phase6b2a_username_case_insensitive/migration.sql
npx prisma migrate resolve --schema server/prisma/schema.prisma --applied 20261017010000_phase6b2a_username_case_insensitive
```

This is the same sequence the staging/production workflows use; the frozen files are unchanged. D is now in
the migrated state (`_prisma_migrations` present, economy objects present).

### 5.5 Restore D to the pre-migration state

**Pre-reset checklist (requirement 5) — all must be true before any restore:**
- The selected branch in the console is exactly `drill-recovery-6b4d`, and its **branch id equals the value
  supplied to the verification workflow**.
- The selected branch is **not** `br-delicate-butterfly-b4et73g9`, **not** `br-dawn-cherry-b4dnrhm5`, and
  **not** `backup-before-economy-v2`.

**Method 1 — Reset from parent (guaranteed):**
- Open branch `drill-recovery-6b4d` → branch actions → **Reset from parent** → confirm. D is returned to the
  parent's current (pre-migration) state; the parent is untouched.

**Method 2 — Instant restore / PITR (production-mirroring; conditional):**
- First confirm the branch's **history/retention window** in the console covers a timestamp taken **before**
  §5.4.
- Open branch `drill-recovery-6b4d` → **Restore** (instant restore) → choose a point in time before §5.4 →
  confirm.
- If the retention window does **not** cover the required point, **stop** and use Method 1 instead; do not
  guess or attempt a partial restore.

### 5.6 Verify the restored state (requirement 7 and 8)
8. Dispatch the read-only workflow (§6) again with the same `recovery_branch`. It must report **pre-migration
   state** (see §7). Alternatively, run the same read-only SQL manually.

### 5.7 Safe cleanup
9. After the drill, **delete only** the disposable branch `drill-recovery-6b4d` (Branches → branch → Delete).
10. Remove or rotate the `RECOVERY_DIRECT` secret.
11. **Never** delete/reset production, the backup, or `br-dawn-cherry-b4dnrhm5`.

---

## 6. Read-only verification workflow (requirement 10)

`.github/workflows/neon-recovery-verify.yml` — manual `workflow_dispatch` only, `contents: read`,
non-cancelling concurrency group `neon-recovery-verify`, 10-minute timeout.

- Inputs: `confirm = VERIFY-RECOVERY-6B4D`, `recovery_branch = <drill branch id>`.
- Connection: **`secrets.RECOVERY_DIRECT` only** — it never references `DIRECT` or `STAGING_DIRECT`.
- Guards: fails if `recovery_branch` equals production or staging; fails if the connected
  `current_setting('neon.branch_id')` is empty, equals production, equals staging, or differs from the
  supplied `recovery_branch`.
- **SELECT-only**: no DDL, no DML, no `prisma migrate*`, no restore/reset. It cannot modify any branch.
- Emits a `recovery-verification-report` artifact and a Job Summary.

This is genuinely useful because it makes the post-restore verification repeatable, credential-safe, and
branch-id-enforced, removing the need for ad-hoc SQL.

---

## 7. Post-restore verification checks (requirements 7 and 8)

All read-only `SELECT`s, asserted by the workflow:

| Check | Expected |
|---|---|
| Branch identity | equals `recovery_branch`; not production; not staging |
| `User` count / ids | `2` / `2,4` |
| `User` data preserved | 2 rows with non-null `email`, `username`, `passwordHash` |
| `CEO` count / ids | `8` / `2,3,4,5,6,7,8,10` |
| Case-insensitive username collisions | `0` |
| Economy tables | `AppMeta`, `OwnedCeo`, `ReferralAttribution`, `IdempotencyKey` **absent** |
| Economy `CEO` columns | `baseSpPerCycle`, `maxOwned`, `isStarter`, `rewardEligible`, `category`, `displayOrder` **absent** |
| Economy enums | `AcquisitionType`, `OwnedCeoStatus` **absent** |
| `_prisma_migrations` | **absent** |
| `User_username_lower_key` | **absent** |
| Catalog drift markers | `crypto-whale` absent, `intern-ceo` absent, `test-ceo` present |

---

## 8. Risks and remaining limitations (requirement 15)

1. **PITR retention is not assumed.** Method 2 works only within the branch's history window; its duration is
   plan-dependent. The operator must confirm it covers the target timestamp in the console. If unconfirmed,
   use Method 1.
2. **Reset-from-parent depends on the parent's state.** It returns D to the parent's *current* state. Run the
   drill while the parent is pre-migration (production) or parent D on the backup.
3. **The drill validates DB state, not the application.** It proves the schema/data return to pre-migration;
   it does not exercise the app, auth, or API behavior after a restore.
4. **Operator mis-selection risk.** The verification workflow is read-only and cannot prevent a wrong branch
   selection in the console. The §5.5 pre-reset checklist is the control; the workflow's branch-id assertion
   catches a wrong `RECOVERY_DIRECT`.
5. **Production PITR coverage is not drilled.** This drill runs on a fresh branch; it does not prove that
   production's retention window would cover a real migration timestamp. That must be confirmed separately
   before production execution.
6. **Backup remains data-presence verified only.** This drill does not restore from or modify
   `backup-before-economy-v2`; it does not add a drilled production restore.
7. **Staging branch is evidence.** `br-dawn-cherry-b4dnrhm5` is preserved untouched; the drill does not read
   or modify it.
8. **Cost/resource hygiene.** Neon branches consume storage; delete `drill-recovery-6b4d` after the drill.
9. **External writers.** D is disposable and isolated, so external-writer risk is low; still, avoid other
   sessions on D during the drill.

---

## 9. Validation performed (this phase)

- YAML parsed with Python `yaml.safe_load`: 1 job, 5 steps (4 `run:` blocks), trigger `workflow_dispatch`
  only, `permissions: contents: read`, non-cancelling concurrency group.
- Every `run:` block syntax-checked with Git Bash `bash -n` → all exit 0.
- Confirmed the workflow references **only** `secrets.RECOVERY_DIRECT` (no `DIRECT`, no `STAGING_DIRECT`).
- No migration file, production workflow, or staging workflow was modified.

---

## 10. Verdict

# **PREPARED — awaiting operator-supplied drill branch/secret**

The drill is isolated (disposable branch only), uses a read-only verification workflow with a dedicated
secret, and asserts the exact pre-migration state with original data preserved. The guaranteed restore
mechanism is Neon **Reset from parent**; **Instant restore/PITR** is documented as a conditional
production-mirroring method that must be confirmed in-console.

**Blocked only on operator input:** the drill branch id and the `RECOVERY_DIRECT` secret (§4), and — for
Method 2 — confirmation of the branch's retention window. None of these are guessed.

**STOP.** No restore, no branch creation/deletion, no database writes, no production connection, nothing
pushed. Awaiting the drill branch details and explicit approval to run the drill manually.
