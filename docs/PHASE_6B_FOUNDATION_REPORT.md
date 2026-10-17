# TycoonX — Phase 6B.0 Foundation Report

**Status:** Preparation/audit only. No gameplay code written. No `schema.prisma`, migration or database
change made. Phase 5H visuals untouched.  
**Date:** 2026-10-17  
**Scope:** Safe foundation preparation for Economy V2 (approved decisions 1–9 in the Phase 6B.0 brief).  
**Companions:** `docs/ECONOMY_V2_AUDIT.md`, `docs/ECONOMY_V2_IMPLEMENTATION_PLAN.md`,
`docs/TYCOONX_ECONOMY_V2_SPEC.md`.

---

## A. Git status

| Item | Result |
|---|---|
| Git installed | Yes — `git 2.50.0.windows.1` |
| Was repository initialized | **No** (`git rev-parse --is-inside-work-tree` → exit 128) |
| Action taken | `git init` at repo root, then baseline commit |
| Baseline commit | `1ae53e3` — *"chore: baseline repository snapshot before Economy V2 implementation"* |
| Files in baseline | 81 tracked files |
| Remote | **None added; nothing pushed** |
| Working tree after commit | Clean |

**`.gitignore` review (root `.gitignore`):** originally covered `node_modules`, `dist`, `build`,
`.env`, `.env.local`, `*.log`, `coverage`, `.turbo`, `.vercel`. It did **not** cover env variants such as
`.env.production`. I added two additive lines (committed in the baseline):

```
.env.*
!.env.example
```

**Secret-safety verification performed before committing:**
- `git check-ignore -v server/.env` → ignored by `.gitignore:4:.env`.
- `git check-ignore -v node_modules` → ignored; `git check-ignore -v client/dist` → ignored.
- Staged-name scan for `node_modules/`, `dist/`, `.env`, `.env.*`, `*.pem`, `*.key` returned only
  `client/.env.example` and `server/.env.example` (intended placeholders — no real secrets).
- `server/.env` (the only real secret file) is **not** tracked.

**Note:** the commit emitted LF→CRLF warnings. This is cosmetic; no `.gitattributes` was added. If
consistent line endings are desired later, add `.gitattributes` in a separate, approved change.

---

## B. Environment-loading findings

**Finding (confirmed by inspection).** `server/src/index.ts` calls `dotenv.config()` in the module body
(line 11), but ESM evaluates all imported modules first. Two modules read `process.env` **at import time**:

- `server/src/lib/prisma.ts:5` — `new Pool({ connectionString: process.env.DATABASE_URL! })`
- `server/src/lib/auth.ts:5` — `const JWT_SECRET = process.env.JWT_SECRET ?? throw`

Because those imports are evaluated before `dotenv.config()` runs, `.env` is **not guaranteed to be
applied** when `DATABASE_URL`/`JWT_SECRET` are read. In practice this means the server only works if those
variables are already present in the shell environment (or `dotenv` is preloaded externally).

**Verification performed:**
- `tsx` version `4.23.15`; no auto `.env` loading found in its CLI (no `--env-file`/`dotenv` handling in
  `node_modules/tsx/dist/cli.mjs`).
- The server dev script is `tsx watch src/index.ts` (no `--env-file`).
- No `.npmrc`, no `NODE_OPTIONS`, and no repo-level dotenv preload.
- Only one `dotenv` usage exists (`server/src/index.ts`).

**Smallest safe fix (proposed, NOT applied).**
Replace the default import + late call with a side-effect import placed **before** the local imports:

```ts
import 'dotenv/config'   // line 1: runs config() during ESM evaluation, before ./lib/prisma and ./lib/auth
import express from 'express'
// ...
// (remove the later `dotenv.config()` call, or leave it as a harmless no-op)
```

Why this is the smallest fix: `dotenv/config` executes `config()` while its (first) import is being
evaluated, which happens before `./lib/prisma` and `./lib/auth` are evaluated. No credentials change, no
new dependency, one-line behavioural fix.

**Alternatives considered:** (a) `tsx watch --env-file=.env src/index.ts` (Node ≥20.6; changes the npm
script); (b) lazy/`function`-based env reads (larger refactor). Option (a) is acceptable but depends on
the Node/tsx version; the side-effect import is the least invasive and runtime-independent.

**Constraint respected:** no `.env` content or connection string was printed during this investigation.

---

## C. Database observations (read-only)

Performed with the same driver the app uses (`@neondatabase/serverless` `Pool` over the pooled
`DATABASE_URL`) against the live database. Only `SELECT`/`information_schema`/`pg_catalog` reads were
executed. **No writes, no migrations, no `resolve`, no `db push`, no DDL.** The temporary inspection
script was deleted immediately; working tree is clean.

**Connectivity:** pooled `DATABASE_URL` reachable. (`DIRECT_URL` remains unreachable per prior
`P1001`; not re-tested here.)

### C.1 Tables (public schema)

| Table | Present in DB | Present in `schema.prisma` | Present in migration files |
|---|---|---|---|
| `User` | **Yes** | Yes | Yes |
| `CEO` | **Yes** | Yes | Yes |
| `AppMeta` | **No** | Yes | **No** |
| `_prisma_migrations` | **No** | (n/a) | (n/a) |

### C.2 `User` columns — match `schema.prisma`

`id` (int, PK, serial default), `email` (text, NOT NULL), `username` (text, NOT NULL),
`passwordHash` (text, NOT NULL), `role` (`Role` enum, NOT NULL, default `'USER'`),
`createdAt` (timestamp, NOT NULL, default `CURRENT_TIMESTAMP`), `updatedAt` (timestamp, NOT NULL, no
default). Unique indexes present: `User_email_key`, `User_username_key`. PK present.

### C.3 `CEO` columns — match `schema.prisma`

`id` (int, PK, serial), `name` (text, NOT NULL), `slug` (text, NOT NULL, unique), `rarity` (text, NOT NULL),
`priceUsd` (numeric(12,2), NOT NULL), `dailyRatePercent` (numeric(5,4), NOT NULL),
`cycleHours` (int, NOT NULL, default `4`), `energyCost` (int, NOT NULL), `isActive` (bool, NOT NULL,
default `true`), `createdAt` (timestamp, NOT NULL, default `CURRENT_TIMESTAMP`), `updatedAt` (timestamp,
NOT NULL, **no default**). Unique index `CEO_slug_key`; PK present.

### C.4 Constraints & indexes

Only PRIMARY KEY constraints (`User_pkey`, `CEO_pkey`) and NOT NULL constraints were found in
`pg_constraint`. Uniqueness for `email`, `username`, `slug` is enforced by **unique indexes**
(`User_email_key`, `User_username_key`, `CEO_slug_key`) rather than table constraints — consistent with the
migration SQL, which uses `CREATE UNIQUE INDEX`. **No foreign keys exist** (expected — no relations yet).

### C.5 Row counts

| Table | Rows |
|---|---:|
| `User` | 2 |
| `CEO` | 8 |

### C.6 Prisma migration history

`_prisma_migrations` table is **absent**. This means **no Prisma migration has ever been recorded** against
this database, confirming the previously documented out-of-band creation.

---

## D. Migration drift risks (confirmed, not assumed)

| # | Finding | Impact | Safe handling |
|---|---|---|---|
| D1 | `_prisma_migrations` **does not exist** | `prisma migrate deploy/status` treats DB as unmigrated; a deploy would try to run both migrations and fail (`User` already exists) | Baseline with `migrate resolve --applied` for both existing migrations |
| D2 | `AppMeta` in `schema.prisma` but **missing in DB** and absent from migration files | Prisma schema ≠ DB ≠ history (triple drift); `prisma migrate diff` reports a missing table | Add `AppMeta` job in the first **additive** migration (it is unused by app code today) |
| D3 | `20240102000000_create_ceo_model` seed **omits `updatedAt`** (NOT NULL, no default) | Running that migration fresh fails with a not-null violation | Never re-run it; do not edit the applied file |
| D4 | `DIRECT_URL` unreachable (`P1001`); `prisma migrate*` uses `directUrl` | Prisma CLI migration commands likely **cannot run** on this host | Generate SQL **offline** via `migrate diff` between schema datamodels; apply via pooled driver/SQL editor; reconcile history manually |
| D5 | No `migration_lock.toml` | Non-standard migrate state | Create it when history is re-baselined (optional if applying SQL manually) |
| D6 | Prisma version skew (`@prisma/client`/`prisma` `^5.16.1` vs adapter `^5.22.0`) | Possible client/engine mismatch | Do not upgrade Prisma during economy work |
| D7 | No version control (now fixed) | No rollback safety net | Git baseline `1ae53e3` now exists (local only) |

> **Principle reaffirmed:** the DB is **not** synchronized with `schema.prisma` or the migration folder.
> All changes will be **additive**, **observed before/after**, and **backed up** first. No reset, no push,
> no drops, no destructive SQL.

---

## E. Backup readiness

**No backup has been created.** This section documents the procedure only; a backup must be created and
verified in the implementation step **before** any DDL.

**Neon capabilities available (recommended order):**
1. **Neon branch (primary, fastest, safest).** Create a copy-on-write branch of the current database from
   the console or CLI. A branch is an independent, isolated copy that can be used to restore or to stage
   migrations. Verify it by connecting and counting `User`/`CEO`.
2. **Point-in-time restore (PITR).** Neon retains a restore window (plan-dependent, e.g. days). Confirm
   the current window before changes; this is the fallback for accidental data loss.
3. **Logical dump (`pg_dump`).** Optional. Neon recommends a **direct** connection for `pg_dump`; because
   `DIRECT_URL` is unreachable here, this may fail over the pooler. Treat dump as best-effort, not the
   primary backup.

**Safe backup/restore procedure:**
1. Record current branch id/name and PITR window.
2. Create a Neon branch (e.g. `pre-economy-6b`) from the current data.
3. Verify the branch: connect (read-only) and confirm `Table` counts (`User=2`, `CEO=8`) and presence of
   `User`/`CEO`, absence of `_prisma_migrations`.
4. Proceed with additive DDL only after verification passes.
5. **Restore path (if needed):** reset the working branch to the backup branch point, or restore via PITR
   to a timestamp before the change. Verify counts again.

**Rule:** the report will not claim a backup exists until it is actually created and verified. Backup
creation requires owner approval (console access) and is listed as a blocker below.

---

## F. Proposed additive Prisma schema (PROPOSAL — not applied)

Design rules: existing `User`/`CEO` columns and values remain **unchanged and preserved**; all new fields
are nullable or defaulted; new tables reference `User.id`. `dailyRatePercent` is retained for Market
back-compat; `baseSpPerCycle` is introduced for future gameplay (approved decision 4) and is nullable so
legacy rows are valid until values are approved.

### F.1 Enums and additive columns

```prisma
enum AcquisitionType { STARTER PURCHASE MISSION REWARD ADMIN }
enum OwnedCeoStatus   { IDLE PRODUCING READY_TO_COLLECT EXHAUSTED PAUSED DISABLED }

model CEO {
  // ... existing fields (id, name, slug, rarity, priceUsd, dailyRatePercent,
  //     cycleHours, energyCost, isActive, createdAt, updatedAt) UNCHANGED ...
  baseSpPerCycle Int?      // null until approved; fixed SP per cycle (decision 4)
  maxOwned       Int      @default(1)
  isStarter      Boolean  @default(false)
  rewardEligible Boolean  @default(false)
  category       String?
  displayOrder   Int      @default(0)
  owned          OwnedCeo[]
}

model User {
  // ... existing fields UNCHANGED ...
  ownedCeos        OwnedCeo[]
  referralsMade    ReferralAttribution[] @relation("ReferralReferrer")
  referralReceived ReferralAttribution?  @relation("ReferralReferred")
  idempotencyKeys  IdempotencyKey[]
}
```

### F.2 New tables

```prisma
model OwnedCeo {
  id                    Int             @id @default(autoincrement())
  userId                Int
  templateId            Int
  acquisitionType       AcquisitionType
  level                 Int             @default(1)
  cycleLimit            Int?            // null = unlimited (reward CEOs)
  completedRewardCycles Int             @default(0)
  status                OwnedCeoStatus  @default(IDLE)
  acquiredAt            DateTime        @default(now())
  updatedAt             DateTime        @updatedAt
  user                  User            @relation(fields: [userId], references: [id], onDelete: Restrict)
  template              CEO             @relation(fields: [templateId], references: [id], onDelete: Restrict)
  @@index([userId])
  @@index([templateId])
  @@index([userId, status])
}

model ReferralAttribution {
  id             Int      @id @default(autoincrement())
  referrerId     Int
  referredUserId Int      @unique            // one attribution per referred user
  code           String
  createdAt      DateTime @default(now())
  eligible       Boolean  @default(false)
  referrer       User     @relation("ReferralReferrer", fields: [referrerId], references: [id], onDelete: Restrict)
  referredUser   User     @relation("ReferralReferred", fields: [referredUserId], references: [id], onDelete: Restrict)
  @@index([referrerId])
}

model IdempotencyKey {
  id        Int      @id @default(autoincrement())
  userId    Int
  scope     String
  key       String
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([userId, scope, key])
}
```

### F.3 Raw-SQL extras (in the same migration, not expressible in Prisma DSL)

```sql
-- Reconcile missing AppMeta (present in schema.prisma, absent in DB)
CREATE TABLE "AppMeta" (
  "id" SERIAL NOT NULL,
  "key" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AppMeta_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AppMeta_key_key" ON "AppMeta"("key");

-- One starter CEO per user (partial unique index = idempotency backstop)
CREATE UNIQUE INDEX "OwnedCeo_starter_user_key"
  ON "OwnedCeo"("userId") WHERE "acquisitionType" = 'STARTER';

-- No self-referral
ALTER TABLE "ReferralAttribution"
  ADD CONSTRAINT "ReferralAttribution_no_self" CHECK ("referrerId" <> "referredUserId");
```

### F.4 Keys, constraints and transaction boundaries

| Entity | Unique / key | FK | Notes |
|---|---|---|---|
| `OwnedCeo` | PK `id`; partial unique `(userId) WHERE STARTER` | `userId→User`, `templateId→CEO` (Restrict) | Backstop for starter idempotency; one starter per user |
| `ReferralAttribution` | PK `id`; unique `referredUserId`; CHECK no-self | `referrerId→User`, `referredUserId→User` (Restrict) | One attribution per referred user |
| `IdempotencyKey` | PK `id`; unique `(userId, scope, key)` | `userId→User` (Cascade) | Generic replay protection |
| `CEO` economy cols | — | — | Additive; legacy columns untouched |
| `AppMeta` | PK `id`; unique `key` | — | Drift reconciliation; unused by app today |

**Transaction boundaries:**
1. **Starter grant (idempotent):** in one transaction, `INSERT` `IdempotencyKey(userId,'starter','v1')`;
   if the unique key already exists → return the user's existing starter (no second copy); otherwise
   create `OwnedCeo{acquisitionType:STARTER}`. The partial unique index `OwnedCeo_starter_user_key` is the
   concurrency backstop. Register flow may call this after user creation; a client retry must be safe.
2. **Referral attribution:** capture `ref` server-side at registration; in the same transaction as (or
   immediately after) user creation, insert `ReferralAttribution`; `referredUserId` uniqueness prevents
   duplicates; self-referral rejected by CHECK + app check. **No rewards are granted in 6B.**
3. **All economy mutations** (later phases) follow the same pattern: transaction + idempotency key +
   unique constraint; balances derived from ledgers, never client-supplied.

**Deferred to later phases (not in 6B schema):** `ProductionCycle`, `EnergyAccount`, `ProgressAccount`,
`SpLedgerEntry`, buildings, missions, config versions, reserve/funding. The SP ledger and reservations
land in 6C per the implementation plan; including them now would add unused, unreviewed surface.

---

## G. Exact Phase 6B.1 implementation steps (for approval)

**Objective:** land the additive schema foundation safely, re-establish migration hygiene, and add the
idempotency/referral primitives — **no gameplay endpoints yet** (those are 6B.2).

1. **Preconditions / approval:** owner approves this report, the proposed schema, and creation of a Neon
   backup/branch.
2. **Backup:** create and **verify** a Neon branch (see §E). Record branch id and PITR window.
3. **Env fix (small, safe):** change `server/src/index.ts` to `import 'dotenv/config'` as the first import
   (remove the later `dotenv.config()`); confirm `npm run dev:server` still starts and `/api/health`
   returns `ok`. No credential changes.
4. **Edit `schema.prisma` additively:** add enums, `OwnedCeo`, `ReferralAttribution`, `IdempotencyKey`,
   the new `CEO` economy columns, and the `User` back-relations. **Do not touch** existing fields/tables.
5. **Generate SQL offline (no DB):**
   `npx prisma migrate diff --from-schema-datamodel <old-copy>.prisma --to-schema-datamodel server/prisma/schema.prisma --script`
   (keep a pre-edit copy of the schema to diff against). Review the script for additive-only statements;
   append the §F.3 raw-SQL extras.
6. **Create the migration folder** `server/prisma/migrations/<timestamp>_phase6b_owned_ceo_foundation/migration.sql`
   containing the reviewed script; add `server/prisma/migrations/migration_lock.toml`
   (`provider = "postgresql"`).
7. **Apply via pooled connection** (because `DIRECT_URL` is unreachable):
   `npx prisma db execute --url "$env:DATABASE_URL" --file <migration.sql>` **or** paste the reviewed SQL
   into the Neon SQL editor. Never use `migrate reset`/`db push`.
8. **Re-baseline migration history (manual or resolve):** create/record `_prisma_migrations` rows for the
   two existing migrations and the new one. Prefer `prisma migrate resolve --applied <name>` (both
   legacy files, then the new one); if the CLI fails over the pooler, create `_prisma_migrations` with the
   Prisma-standard shape and insert the rows via the pooled connection, and document the limitation.
9. **Generate client:** `npx prisma generate` (Windows EPERM mitigation: stop any process holding the
   engine DLL first).
10. **Verify (read-only):** re-run the `information_schema`/`pg_catalog` inspection; confirm new tables,
    columns, indexes (incl. the partial unique index), FKs, unchanged `User`/`CEO` rows (`User=2`, `CEO=8`),
    and `AppMeta` now present. Confirm `/api/health` = `ok` and `GET /api/ceos` still returns 8 rows.
11. **Idempotency/referral lib + tests (small):** add `server/src/lib/idempotency.ts` (transaction +
    retry helper) and a Node `node:test`/`tsx` test proving: concurrent starter grant yields exactly one
    `OwnedCeo`; duplicate `IdempotencyKey` replays without duplication.
12. **Commit** the additive change set (schema, migration, lib, tests) as a focused commit. No push.

**Phase 6B.2 (next, after 6B.1 verification):** `GET /api/game/ceos/owned`, starter grant wired into
registration, server-side `ref` capture, ownership derived from `req.user.id`, Zod schemas, rate limits,
and client "My CEOs" tab wiring — still no UI redesign.

---

## H. Blockers requiring approval

1. **Neon backup/branch creation** — needs owner access/approval to create and verify a backup before DDL.
2. **Migration execution method** — approve the offline-`migrate diff` + pooled-apply + manual/`resolve`
   history reconciliation (because `DIRECT_URL` `P1001` likely blocks normal `prisma migrate`).
3. **`AppMeta` reconciliation** — approve creating the missing `AppMeta` table in the first additive
   migration.
4. **Starter CEO data** — approve adding one free Intern CEO catalog row (`isStarter=true`,
   `baseSpPerCycle` value) as an additive seed. Numeric values remain illustrative.
5. **Economy column values** — approve initial `baseSpPerCycle`, `maxOwned`, `rewardEligible`, `category`
   (or leave defaults/nullable until 6C).
6. **Prisma CLI/history policy** — confirm whether to create `migration_lock.toml` and re-baseline now, or
   track DDL manually.
7. **Env fix** — approve the one-line `dotenv/config` change (recommended).
8. **Retention of `dailyRatePercent`** — confirm it stays (for Market back-compat) while `baseSpPerCycle`
   is the future gameplay field (approved decision 4 implies yes; confirming to avoid Market regressions).

---

## I. Summary

- **Git:** initialized locally; baseline commit `1ae53e3`; no remote; secrets excluded; tree clean.
- **Env:** confirmed load-order bug; smallest fix is a first-line `import 'dotenv/config'` (proposed, not applied).
- **DB (read-only):** only `User` and `CEO` exist; `_prisma_migrations` and `AppMeta` are **absent**;
  row counts `User=2`, `CEO=8`; columns match the Prisma schema; no FKs.
- **Drift:** triple drift (schema vs DB vs history) confirmed; migration CLI likely blocked by `P1001`.
- **Backup:** procedure documented; **none created yet**.
- **Schema:** concrete additive proposal provided with keys, FKs and transaction boundaries; nothing applied.
- **Next:** on approval, execute Phase 6B.1 (backup → env fix → additive schema → offline-generated SQL →
  pooled apply → history baseline → verify → idempotency/referral lib + tests → commit).

Awaiting approval before implementation.
