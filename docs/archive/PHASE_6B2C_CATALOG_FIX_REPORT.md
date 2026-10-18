# TycoonX — Phase 6B.2C: Catalog Drift Fix Report

**Status:** Catalog drift resolved in the pending SQL. **Migration remains BLOCKED** (backup not yet
verified). No SQL applied, no live data changed, no ownership route enabled, no frontend design change.  
**Date:** 2026-10-17  
**Scope:** add Crypto Whale additively, preserve all existing CEOs and IDs, leave `test-ceo` untouched,
analyze public catalog filtering, review transaction safety/ordering/baselining, run checks.  
**Companions:** `docs/PHASE_6B2B_MIGRATION_READINESS.md`, `docs/PHASE_6B2A_MIGRATION_REVIEW.md`,
`docs/ECONOMY_V2_IMPLEMENTATION_PLAN.md`.

---

## 1. Approved catalog decision — implemented in the pending SQL

Decision applied to
`server/prisma/migrations/20261017000000_phase6b1_economy_foundation/migration.sql`:

1. All 8 existing CEO records and their IDs are preserved (no deletes, no ID changes).
2. **Crypto Whale is added only if its slug is absent** (`ON CONFLICT ("slug") DO NOTHING`).
3. Approved illustrative config: `priceUsd = 1000.00`, `baseSpPerCycle = 600`, `maxOwned = 2`.
4. All required legacy fields + timestamps are included (`createdAt`, `updatedAt`).
5. `test-ceo` is **unchanged** in the database (no data operation targets it).
6. Catalog filtering analyzed (§3); a hide strategy is **proposed, not activated**.
7. Intern CEO remains free, `baseSpPerCycle = 10`, `maxOwned = 1`.
8. All seed operations are duplicate-safe (§4).
9. Transaction safety / ordering / baselining reviewed (§5).
10. Prisma validation, TypeScript, and tests run (§6).

**File status:** the migration was committed in `ec87104` and amended in `8dce84f` (updatedAt fix). This
phase adds the Crypto Whale insert. The migration has **never been applied**, so amending it is safe (no
`_prisma_migrations` checksum exists). **Freeze it before baselining** (see §5).

---

## 2. Exact proposed SQL changes

Only one block was added, after the Intern CEO insert. No existing statement was changed.

```sql
-- Crypto Whale: approved catalog row. Added ONLY if the slug is absent, so an
-- existing Crypto Whale row (and its id) is never recreated. Values are the
-- approved illustrative development defaults (price $1000, 600 SP/cycle, 2 copies).
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

**Why this is safe:**
- `ON CONFLICT ("slug") DO NOTHING` uses the existing `CEO_slug_key` unique index → **only inserts when the
  slug is absent**, so an existing Crypto Whale row/ID is never touched or recreated.
- Legacy NOT NULL columns (`name`, `slug`, `rarity`, `priceUsd`, `dailyRatePercent`, `cycleHours`,
  `energyCost`, `isActive`) and `updatedAt` (NOT NULL, no default) are all supplied.
- `createdAt`/`updatedAt` are set to `CURRENT_TIMESTAMP`.

**Unchanged surrounding seed (context):** the eight `UPDATE "CEO" ... WHERE "slug" = '<slug>'` statements
remain; the `crypto-whale` UPDATE is a no-op when the row is absent and the INSERT then creates it with the
approved values. If the row already exists, the UPDATE applies the values and the INSERT does nothing —
both paths converge.

**Not changed:** no `test-ceo` statement exists anywhere. The historical `20240102000000_create_ceo_model`
seed is not replayed.

---

## 3. Public CEO catalog filtering — analysis and proposal (not activated)

**How the public listing is produced today:**
- Server: `GET /api/ceos` (`server/src/routes/ceo.ts`) → `prisma.cEO.findMany({ where, orderBy })` where
  `where` only includes `isActive` if the client passes `?isActive=`. With no query param, **all** rows are
  returned.
- Client: `client/src/lib/ceos.ts` `fetchCeos()` calls `/api/ceos` with **no query params**, and
  `pages/CEOs.tsx` (Market) applies only rarity/search/sort filters — **no `isActive` filter**.
- `pages/Dashboard.tsx:164` **already** filters `c.isActive` for its featured preview.

**Consequence:** `test-ceo` currently appears in the Market only because the Market omits the `isActive`
filter. All eight current rows (including `test-ceo`) have `isActive = true` (verified read-only in 6B.2B),
so no legitimate CEO is currently inactive.

**Recommended hide strategy (proposed; do NOT activate yet):**
1. **Data step (later, approved):** mark the development row inactive — non-destructive, preserves the row
   and ID:
   ```sql
   UPDATE "CEO" SET "isActive" = false WHERE "slug" = 'test-ceo';
   ```
2. **Read-path step (later, approved), minimal & targeted:** make the Market request only active rows by
   having `fetchCeos()` call `/api/ceos?isActive=true` (one-line client change, no redesign). This is
   preferred over changing the server default because it is explicit and leaves the admin/other consumers
   unchanged. (Alternative: default `GET /api/ceos` to `isActive=true` when unspecified — broader blast
   radius; not recommended.)

**Safety check before activation:** re-verify every legitimate CEO has `isActive = true` so the filter
cannot hide a real template. `Dashboard` already benefits from the same flag.

**Rejected alternatives:** filtering by a hard-coded slug deny-list (brittle) or a new `category='dev'`
marker (requires an extra data write and a brittle value check) — both are less robust than the existing
`isActive` field.

**This phase activates nothing.** No client or server filtering change was made.

---

## 4. Seed idempotency review

| Seed operation | Idempotent? | Mechanism |
|---|---|---|
| 8 × `UPDATE "CEO" ... WHERE slug = ...` | Yes | Setting fixed values is naturally idempotent; absent slug → 0-row no-op |
| Intern CEO `INSERT` | Yes | `ON CONFLICT ("slug") DO NOTHING` (unique `CEO_slug_key`) |
| Crypto Whale `INSERT` | Yes | `ON CONFLICT ("slug") DO NOTHING` |
| `AppMeta` DDL | Yes | `CREATE TABLE IF NOT EXISTS` + `CREATE UNIQUE INDEX IF NOT EXISTS` |
| Enums / new tables / indexes / FKs / partial index / CHECK | **No** | Standard `CREATE`/`ALTER ADD CONSTRAINT` → must run once, inside a transaction |

Because several DDL statements are not idempotent, the whole migration must be applied **as a single
transaction** so a mid-file failure rolls back cleanly (see §5).

---

## 5. Transaction safety, ordering, and baselining review

**Ordering (within `20261017000000_phase6b1_economy_foundation`):** AppMeta → enums → `ALTER TABLE "CEO"` →
new tables → indexes → FKs → business constraints (partial starter index, no-self CHECK) → catalog `UPDATE`s
→ Intern insert → Crypto Whale insert. This order is correct (enums precede tables that use them; columns
exist before inserts).

**Transaction safety:**
- Apply the file between explicit `BEGIN;` … `COMMIT;` (Neon SQL editor, or a small `@neondatabase/serverless`
  runner). `prisma db execute --file` does **not** wrap in a transaction and some statements are
  non-idempotent, so it is not the first choice.
- On any error the transaction rolls back → no partial DDL.

**Migration-history baselining (unchanged from 6B.2B):**
- `_prisma_migrations` is absent → DB is unbaselined.
- Baseline the two historical migrations as applied (**metadata only**) after confirming their schema
  effects exist (`User`, `CEO`), then apply the SQL, then mark the two new migrations applied with
  `prisma migrate resolve --applied`.
- **Never** run `prisma migrate dev/deploy/reset` or `prisma db push` — they could replay the historical
  CEO migration (which fails its seed) or attempt destructive reconciliation.

**Cannot mark anything applied until verified.** After applying, verify read-only that all objects exist and
existing rows/IDs are unchanged, then record history.

---

## 6. Checks run

| Check | Command | Result |
|---|---|---|
| Prisma schema validation | `npx prisma validate` (in `server/`) | **PASS** — schema is valid |
| Server TypeScript check | `npm run build --workspace=server` | **PASS** — exit 0 |
| Automated tests | `npm test --workspace=server` | **PASS** — 15/15, 0 fail |
| Destructive-statement scan | regex over the migration | **Empty** (no DROP/TRUNCATE/DELETE) |

Tests use an in-memory fake Prisma and do **not** write to the live Neon database.

**Note:** the first `prisma validate` invocation in this phase was mistakenly run from the repo root and
reported a schema-location hint; the corrected run from `server/` passed.

---

## 7. Remaining blockers

1. **Backup verification (BLOCKING):** `backup-before-economy-v2` still cannot be verified from this
   environment (no backup credentials/API). Per policy, the migration stays BLOCKED until the owner confirms
   the branch exists, is derived from the production branch (`br-delicate-butterfly-b4et73g9`), and is
   recoverable. — resolved status: **unchanged from 6B.2B**.
2. **Primary-branch confirmation:** confirm `br-delicate-butterfly-b4et73g9` (project
   `wandering-king-57462138`, db `neondb`) is production.
3. **Apply-method approval:** approve the pooled single-transaction apply + `migrate resolve` baselining.
4. **`test-ceo` hide decision:** approve the §3 strategy (mark inactive + Market requests `?isActive=true`).
   Not activated in this phase.
5. **Migration file freeze:** no further edits after approval, before baselining.
6. **Route enablement:** deferred to a later phase (after DB is verified).

The **catalog-drift blocker is now resolved in the SQL** (§2); the only hard blocker is the **backup
verification**.

---

## 8. Expected post-apply state (for later verification)

- `CEO` rows: the 7 remaining approved rows + `test-ceo` + `intern-ceo` + `crypto-whale` = **10 rows**
  (8 existing preserved incl. `test-ceo`, plus Intern, plus Crypto Whale). Existing IDs unchanged; new rows
  get new IDs.
- `intern-ceo`: free, `baseSpPerCycle = 10`, `maxOwned = 1`, `isStarter = true`.
- `crypto-whale`: `$1000`, `baseSpPerCycle = 600`, `maxOwned = 2`, `rarity = 'Mythic'`, energy 40.
- `AppMeta`, `OwnedCeo`, `ReferralAttribution`, `IdempotencyKey`, `AcquisitionType`, `OwnedCeoStatus`,
  `User_username_lower_key`, `OwnedCeo_starter_user_key`, `ReferralAttribution_no_self` all present.
- `User` count still 2 (ids 2, 4).

---

## 9. Verdict

# **BLOCKED** (backup verification pending)

Catalog drift is resolved safely in the pending SQL (Crypto Whale added only if absent; all existing CEOs
and IDs preserved; `test-ceo` untouched; all seeds duplicate-safe). All static checks and tests pass. The
sole hard blocker remains **verified Neon backup**, plus the two pending approvals (§7.3, §7.4).

**Working tree:** the migration SQL is modified and this report is added (untracked). No commit made in this
phase unless requested.

**STOP.** No migration applied, no live data changed, no routes activated. Awaiting approval.
