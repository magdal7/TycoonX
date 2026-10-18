# TycoonX — Phase 6B.2D: Final Preflight (Migration Freeze)

**Status:** Preflight complete. Migration files **FROZEN**. **No SQL applied; no live data changed; no
ownership routes enabled.** Awaiting explicit approval to execute.  
**Date:** 2026-10-17  
**Scope:** final migration audit, transaction/baseline plan, migration freeze, validation, execution package.  
**Companions:** `docs/PHASE_6B2B_MIGRATION_READINESS.md`, `docs/PHASE_6B2C_CATALOG_FIX_REPORT.md`,
`docs/PHASE_6B2A_MIGRATION_REVIEW.md`, `docs/ECONOMY_V2_IMPLEMENTATION_PLAN.md`.

---

## 1. Primary branch identifier observed (read-only)

| Field | Value |
|---|---|
| Database | `neondb` |
| Schema | `public` |
| Role (non-secret) | `neondb_owner` |
| **Primary branch id** (`neon.branch_id`) | **`br-delicate-butterfly-b4et73g9`** |
| Project id (`neon.project_id`) | `wandering-king-57462138` |

This is the branch `DATABASE_URL` currently resolves to. It must be the intended **production/source**
branch, and must be **different** from `backup-before-economy-v2`.

---

## 2. Backup verification evidence (user-provided) and limitations

**User verified via the Neon SQL Editor on the `backup-before-economy-v2` branch:**

| Check | Backup value | Primary value | Match |
|---|---|---|---|
| User IDs | `2, 4` | `2, 4` | ✔ |
| CEO IDs | `2, 3, 4, 5, 6, 7, 8, 10` | `2, 3, 4, 5, 6, 7, 8, 10` | ✔ |
| CEO count | 8 | 8 | ✔ |
| Independently queryable | Yes | Yes | ✔ |

**Assessment:** the backup branch contains the same pre-migration data as the primary. This satisfies the
backup **presence/data** gate.

**Remaining limitations (documented, not blockers for preflight):**
- This is a **data-presence check, not a tested restore**. No full restore/revert drill has been performed.
- The backup branch's source/parent lineage was not queryable from this environment; it is confirmed by the
  user in the Neon console. The primary branch id (`br-delicate-butterfly-b4et73g9`) must be confirmed as
  the backup's source.
- PITR window length was not recorded.

---

## 3. Migration file paths and checksums (SHA-256, frozen)

All under `server/prisma/migrations/`:

| Migration | Relative path | SHA-256 |
|---|---|---|
| add_user_model (historical) | `20240101000000_add_user_model/migration.sql` | `0cc0af4ab39b025d6953c196485bdfe76225c28729b529d9f3dbb46e6f7d7144` |
| create_ceo_model (historical) | `20240102000000_create_ceo_model/migration.sql` | `1a0fd8415489877c774f6e0a0c726734afbf773931e6d684be6cf7cfe2ab2107` |
| **phase6b1 economy foundation** | `20261017000000_phase6b1_economy_foundation/migration.sql` | **`1a04a9c5ba3bcc3fb66335c6ce79fbcea73915f106f7160f525da2ed559d7cb3`** |
| **phase6b2a username case-insensitive** | `20261017010000_phase6b2a_username_case_insensitive/migration.sql` | **`f44f174b372e040b694e0c30b2dd2c5d31a921f154cb4399753af992820cce82`** |
| lock file | `migration_lock.toml` | `d6bae7899f05da956e1070ba5703455503208ef79e161acb18c93bfe3c6cd236` |

**Freeze rule:** these two new migrations must not be edited after this point. Any future change requires
an explicit note in a new report **and** a new checksum. (`prisma migrate resolve` computes a checksum from
the file; editing after baselining causes "migration modified" drift.)

---

## 4. Final migration audit

Reviewed the frozen SQL against the live schema and the historical files.

**Order (both new migrations confirm to the required order):**
1. `20261017000000_phase6b1_economy_foundation`:
   `AppMeta` (`IF NOT EXISTS`) → enums `AcquisitionType`/`OwnedCeoStatus` → additive `ALTER TABLE "CEO"`
   → `OwnedCeo`/`ReferralAttribution`/`IdempotencyKey` → indexes → FKs → business constraints (partial
   starter index, no-self CHECK) → 8 catalog `UPDATE`s → Intern insert → Crypto Whale insert.
2. `20261017010000_phase6b2a_username_case_insensitive`: `lower(username)` unique index.

**Audit results:**

| Check | Verdict |
|---|---|
| Correct execution order | Yes (enums before tables; columns before seeds) |
| Required columns/constraints | Yes — all `OwnedCeo`/`ReferralAttribution`/`IdempotencyKey` fields, PKs, uniques, FKs, partial starter index, no-self CHECK |
| Existing table compatibility | Yes — `User`/`CEO` untouched except additive `CEO` columns |
| Destructive statements | None (regex scan for `DROP TABLE|TRUNCATE|DROP COLUMN|DROP TYPE|DELETE FROM|ALTER TABLE ... DROP` empty) |
| Existing CEO records | Preserved — no deletes; only additive `UPDATE`s of new columns by `slug` |
| Idempotent seed inserts | Yes — both inserts use `ON CONFLICT ("slug") DO NOTHING`; `AppMeta` uses `IF NOT EXISTS` |
| Case-insensitive username index safety | Yes — 0 case-insensitive collisions (re-confirmed read-only); `lower(text)` is IMMUTABLE |
| Intern CEO | Free (`priceUsd 0.00`), `baseSpPerCycle 10`, `maxOwned 1`, `isStarter true`, `updatedAt` set |
| Crypto Whale | Added only if `slug` absent; `$1000`, `baseSpPerCycle 600`, `maxOwned 2`, `Mythic`, energy 40 |
| `test-ceo` | Untouched |
| Historical replay risk | None from these files; only `migrate dev/deploy/reset`/`db push` could replay (forbidden) |
| No `_prisma_migrations` present | Confirmed — DB is unbaselined |

**Non-idempotent statements** (enums, `CREATE TABLE`, `CREATE INDEX`, `ALTER ADD CONSTRAINT`) → the 6B1 file
must be applied as **one transaction**.

---

## 5. SQL execution plan (to run only after explicit approval)

Run from `server/`. **Never echo `$env:DATABASE_URL`.**

1. **Confirm the intended primary branch** (§1) via the Neon console: production branch is
   `br-delicate-butterfly-b4et73g9`, project `wandering-king-57462138`, and differs from
   `backup-before-economy-v2`.
2. **Confirm the backup** (§2) still exists and is queryable.
3. **Establish historical baseline** (metadata only; §6). This creates `_prisma_migrations` and records the
   two historical migrations as applied **without executing their SQL**.
4. **Apply `20261017000000_phase6b1_economy_foundation` as a single transaction.** Preferred: Neon SQL
   editor with an explicit wrapper:
   ```sql
   BEGIN;
   -- full contents of prisma/migrations/20261017000000_phase6b1_economy_foundation/migration.sql
   COMMIT;
   ```
   (Do not use `prisma db execute --file` as the primary method: it does not wrap in a transaction and some
   statements are non-idempotent.)
5. **Apply `20261017010000_phase6b2a_username_case_insensitive` as a single transaction:**
   ```sql
   BEGIN;
   CREATE UNIQUE INDEX "User_username_lower_key" ON "User" (lower("username"));
   COMMIT;
   ```
6. **Record the two new migrations as applied** (metadata only; §6).
7. **Verify** (§9) read-only; then `npx prisma generate`.

**Never run:** `prisma migrate reset`, `prisma migrate dev`, `prisma migrate deploy`, `prisma db push`, or
any destructive SQL.

---

## 6. Migration history baseline plan

**Is `prisma migrate resolve` appropriate for each file?**

| Migration | `resolve --applied` appropriate? | When | Why |
|---|---|---|---|
| `20240101000000_add_user_model` | **Yes** | Before applying new SQL | Its effect (`Role` enum + `User` table + unique indexes) is verified present and matches. Recording it prevents replay. It is **not** executed. |
| `20240102000000_create_ceo_model` | **Yes** | Before applying new SQL | Its effect (`CEO` table + columns + the 8 seed slugs) is verified present. It must **not** be replayed (its seed omits `updatedAt`). Recording it prevents replay. |
| `20261017000000_phase6b1_economy_foundation` | **Yes — only AFTER applying and verifying its SQL** | After step 4 | `resolve` marks it applied; it does not run the SQL. It must be true that the SQL already ran. |
| `20261017010000_phase6b2a_username_case_insensitive` | **Yes — only AFTER applying and verifying** | After step 5 | Same rule. |

**Exact baseline commands (metadata-only; `resolve` uses `directUrl`, so point it at the pooled URL for
this step):**
```powershell
$env:DIRECT_URL = $env:DATABASE_URL
npx prisma migrate resolve --applied 20240101000000_add_user_model
npx prisma migrate resolve --applied 20240102000000_create_ceo_model
# ... apply 6B1 SQL in a transaction ...
npx prisma migrate resolve --applied 20261017000000_phase6b1_economy_foundation
# ... apply 6B2A index in a transaction ...
npx prisma migrate resolve --applied 20261017010000_phase6b2a_username_case_insensitive
npx prisma migrate status
```

**Rule:** never mark a migration applied before its effects are verified. The historical two are baselined
on the basis of the verified live schema; the two new ones only after their SQL has actually run.

---

## 7. Expected post-migration CEO catalog

| ID | slug | priceUsd | baseSpPerCycle | maxOwned | isActive | Notes |
|---:|---|---:|---:|---:|---|---|
| 2 | `junior-developer` | 5.00 | 20 | 10 | true | existing, preserved |
| 3 | `product-manager` | 15.00 | 40 | 8 | true | existing |
| 4 | `marketing-director` | 30.00 | 65 | 7 | true | existing |
| 5 | `startup-founder` | 50.00 | 95 | 6 | true | existing |
| 6 | `ai-architect` | 100.00 | 150 | 5 | true | existing |
| 7 | `cloud-executive` | 200.00 | 230 | 4 | true | existing |
| 8 | `tech-billionaire` | 500.00 | 400 | 3 | true | existing |
| 10 | `test-ceo` | 10.00 | (unchanged/null) | (default 1) | true | **unchanged**; may be set `false` later (approved) |
| new | `intern-ceo` | 0.00 | 10 | 1 | true | new, `isStarter true` |
| new | `crypto-whale` | 1000.00 | 600 | 2 | true | new, `Mythic`, energy 40 |

Total **10 rows**. Existing IDs (2–8, 10) unchanged; two new IDs assigned by the `CEO_id_seq` sequence.
`test-ceo` is not filtered out by this phase.

---

## 8. Expected new tables and constraints

**Tables:** `AppMeta`, `OwnedCeo`, `ReferralAttribution`, `IdempotencyKey`.
**Enums:** `AcquisitionType`, `OwnedCeoStatus` (plus existing `Role`).
**Additive `CEO` columns:** `baseSpPerCycle`, `maxOwned`, `isStarter`, `rewardEligible`, `category`,
`displayOrder`.
**Indexes:** `OwnedCeo_userId_idx`, `OwnedCeo_templateId_idx`, `OwnedCeo_userId_status_idx`,
`ReferralAttribution_referredUserId_key` (unique), `ReferralAttribution_referrerId_idx`,
`IdempotencyKey_userId_scope_key_key` (unique), `OwnedCeo_starter_user_key` (partial unique),
`User_username_lower_key` (unique functional), `AppMeta_key_key` (unique).
**Foreign keys:** `OwnedCeo.userId→User` (RESTRICT), `OwnedCeo.templateId→CEO` (RESTRICT),
`ReferralAttribution.referrerId→User` (RESTRICT), `ReferralAttribution.referredUserId→User` (RESTRICT),
`IdempotencyKey.userId→User` (CASCADE).
**CHECK:** `ReferralAttribution_no_self`.

---

## 9. Verification queries (read-only, post-apply)

```sql
-- Identity / environment
SELECT current_database(), current_schema(), current_setting('neon.branch_id', true);

-- Row counts (expect User=2, CEO=10)
SELECT count(*) FROM "User";
SELECT count(*) FROM "CEO";

-- New catalog rows present
SELECT id, slug, "priceUsd", "baseSpPerCycle", "maxOwned", "isStarter"
FROM "CEO" WHERE slug IN ('intern-ceo','crypto-whale','test-ceo') ORDER BY slug;

-- Economy columns added
SELECT column_name FROM information_schema.columns
WHERE table_schema='public' AND table_name='CEO'
  AND column_name IN ('baseSpPerCycle','maxOwned','isStarter','rewardEligible','category','displayOrder')
ORDER BY column_name;

-- New tables/enums present
SELECT table_name FROM information_schema.tables
WHERE table_schema='public' AND table_name IN ('AppMeta','OwnedCeo','ReferralAttribution','IdempotencyKey');
SELECT typname FROM pg_type WHERE typtype='e' AND typnamespace='public'::regnamespace ORDER BY typname;

-- Constraints/indexes present
SELECT indexname FROM pg_indexes WHERE schemaname='public'
  AND indexname IN ('User_username_lower_key','OwnedCeo_starter_user_key','ReferralAttribution_referredUserId_key','IdempotencyKey_userId_scope_key_key')
ORDER BY indexname;
SELECT conname FROM pg_constraint WHERE conname = 'ReferralAttribution_no_self';

-- Migration history
SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY started_at;
```

Also: `GET /api/health` = `ok`; `GET /api/ceos` lists the catalog.

---

## 10. Recovery procedure

- **Preserve** `backup-before-economy-v2` intact; never reset/delete it.
- **Production branch** = `br-delicate-butterfly-b4et73g9` (confirm in console).
- **If apply fails inside a transaction:** automatic rollback → no changes; re-verify and retry.
- **If a partial state is somehow reached:** stop the server/client (no writes); inspect read-only; prefer
  completing the remaining idempotent steps; otherwise **restore** by resetting the production branch to
  `backup-before-economy-v2` (or PITR to just before the apply). **Do not** drop/truncate to clean up.
- **Post-recovery verification:** `User=2` (ids 2,4); `CEO=8` (ids 2,3,4,5,6,7,8,10); `AppMeta` and
  `_prisma_migrations` absent; no economy tables/columns.
- **Prevent writes during recovery:** stop the API server and the client; no scheduled jobs exist.

---

## 11. Git commit hashes

| Commit | Description |
|---|---|
| `1ae53e3` | baseline repository snapshot |
| `ec87104` | Phase 6B.1 economy foundation |
| `8dce84f` | Phase 6B.2A case-insensitive referral + review |
| **`6df6c3f`** | **Phase 6B.2D freeze: economy migration SQL + 6B2B/6B2C reports** |

No remote configured; nothing pushed. This preflight report is committed as a follow-up doc commit.

---

## 12. Test results

| Check | Command | Result |
|---|---|---|
| Prisma validation | `npx prisma validate` (in `server/`) | **PASS** |
| TypeScript check | `npm run build --workspace=server` | **PASS** — exit 0 |
| Automated tests | `npm test --workspace=server` | **PASS** — 15/15, 0 fail |
| Destructive-statement scan | regex over migration SQL | **empty** |

Read-only DB inspection used only (no writes, no live test data).

---

## 13. Remaining blockers

1. **Explicit execution approval** — the only remaining gate. All preparation is complete.
2. **Branch identity confirmation** (owner, console): production = `br-delicate-butterfly-b4et73g9`;
   backup `backup-before-economy-v2` is a different branch derived from it.
3. **Post-execution `test-ceo` hide step** (separate, approved follow-up): set `isActive=false` and have the
   Market request `/api/ceos?isActive=true`.
4. **Ownership route enablement** — a later phase, only after the DB is verified.

---

## 14. Final verdict

# **READY** (pending explicit approval to execute)

The backup branch is verified at the data level, the catalog drift is resolved in frozen SQL, all checks
pass, and a complete execution/baseline/verification/recovery package is prepared. The only reason to hold
is the standing instruction to **not execute without explicit approval**.

**Caveat:** the backup was verified by data presence, not by a tested restore. If a restore drill is
required before execution, it should be completed first.

**STOP.** No migration applied, no live data changed, no routes activated. Awaiting approval to execute.
