# TycoonX — Phase 6B.2A: Migration Review & Referral Architecture

**Status:** Foundation finalized for review. **No migration applied. No ownership route enabled.
No live data changed.** Awaiting explicit approval.  
**Date:** 2026-10-17  
**Scope:** referral architecture (username-based), case-insensitive uniqueness, schema/SQL review, backup &
migration-history procedure, env verification, tests.  
**Companions:** `docs/PHASE_6B1_IMPLEMENTATION_REPORT.md`, `docs/ECONOMY_V2_IMPLEMENTATION_PLAN.md`,
`docs/TYCOONX_ECONOMY_V2_SPEC.md`.

Frontend, Phase 5H art, PixiJS/isometric prototypes and all production cycles/purchases/SP/USDT remain
untouched.

---

## 1. Files changed (Phase 6B.2A)

**Modified**

| File | Change |
|---|---|
| `server/prisma/migrations/20261017000000_phase6b1_economy_foundation/migration.sql` | Fixed the `intern-ceo` seed: added `"updatedAt" = CURRENT_TIMESTAMP` (column is NOT NULL with no DB default). Migration was never applied, so amending it is safe (no baseline checksum exists). |
| `server/src/routes/auth.ts` | Registration now uses case-insensitive duplicate detection via `findRegistrationConflict`. |
| `server/src/services/referral.ts` | Referral resolution now case-insensitive (`findFirst` + `mode: 'insensitive'`). |
| `server/src/services/economy.test.ts` | Fake `User` gains `email` + case-insensitive `findFirst`; 6 new tests added. |

**Added**

| File | Purpose |
|---|---|
| `server/src/services/registration.ts` | `findRegistrationConflict` (case-insensitive email/username). |
| `server/prisma/migrations/20261017010000_phase6b2a_username_case_insensitive/migration.sql` | Additive functional unique index `lower(username)` (NOT applied; gated). |
| `docs/PHASE_6B2A_MIGRATION_REVIEW.md` | This report. |

No new database columns were added. No unrelated files were modified.

---

## 2. Git commit IDs and working tree status

| Commit | Description |
|---|---|
| `1ae53e3` | `chore: baseline repository snapshot before Economy V2 implementation` |
| `ec87104` | `feat(6b1): additive economy schema, ownership/referral/starter services, env fix` |

- Phase 6B.1 was reviewed against the reported implementation and committed as **`ec87104`** (14 files:
  schema, migration + lock, env fix, `package.json` test script, `lib/idempotency`, `services/*`,
  `validation/game.ts`, both reports). Commit secret-scan (`node_modules|dist|.env|.pem|.key|secret|
  credential`) returned **empty**.
- **Working tree:** Phase 6B.2A changes are **uncommitted** and will be committed separately (see §12 for
  the recommended commit command). No remote configured; **nothing pushed**.
- `.gitignore` verified: `node_modules`, `dist`, `build`, `.env`, `.env.local`, `.env.*` (with
  `!.env.example`), `*.log`, `coverage`, `.turbo`, `.vercel`. `server/.env` is ignored; only
  `client/.env.example` and `server/.env.example` are tracked (placeholders).

---

## 3. Referral architecture decisions (final)

1. **The existing `User.username` is the permanent referral identifier.** No `referralCode` column is
   added (per the final decision, and to avoid unnecessary schema).
2. Referral link shape: `https://tycoonx.example/register?ref=CryptoKing`.
3. Usernames are **unique** (existing `User_username_key`), **immutable** (no update path — verified), and
   **preserved** (existing records untouched).
4. `?ref=` is resolved **case-insensitively** against `username`.
5. Self-referrals and duplicate attributions are prevented (service + DB constraints).
6. Attribution is stored in `ReferralAttribution` (no rewards issued).
7. No referral commissions/rewards are issued; manual reward approval remains a later phase.

**Application-level change implemented (no migration needed):**
- `services/referral.ts` resolves with
  `prisma.user.findFirst({ where: { username: { equals: code, mode: 'insensitive' } } })`.
- `services/registration.ts::findRegistrationConflict` rejects case-insensitive email/username duplicates
  at registration (closes the "Alice" vs "alice" gap left by the case-sensitive unique indexes).

---

## 4. Username immutability verification

Searched the server source for any mutation of `User`:

- `prisma.user.create` — only in `routes/auth.ts` (registration).
- **No `prisma.user.update` / `updateMany` exists anywhere.**
- No profile/settings route modifies `username` (Profile is frontend-only; settings are "Soon").
- `loginSchema`/`registerSchema` accept username only at creation; no change endpoint exists.

**Conclusion:** usernames are immutable at the application level today. No DB-level trigger is added
(over-scoped). If a username-change feature is ever introduced, the `lower(username)` unique index
(§5) must exist first, and any change must be explicitly out of scope for referrals.

---

## 5. Case-insensitive uniqueness findings (read-only)

Live DB queried read-only with the app's serverless driver (no writes):

| Check | Result |
|---|---|
| `_prisma_migrations` present | **No** (still unbaselined) |
| `AppMeta` present | **No** |
| Row counts | `User = 2`, `CEO = 8` (unchanged) |
| `User_username_key` definition | `CREATE UNIQUE INDEX ... USING btree (username)` → **case-sensitive** |
| `User_email_key` definition | `CREATE UNIQUE INDEX ... USING btree (email)` → **case-sensitive** |
| Case-insensitive **username** collisions (`GROUP BY lower(username) HAVING count>1`) | **0** |
| Case-insensitive **email** collisions | **0** |

**Because there are zero collisions, a case-insensitive unique index can be safely proposed.** It is
prepared as an additive, non-destructive migration:

```sql
-- 20261017010000_phase6b2a_username_case_insensitive/migration.sql
CREATE UNIQUE INDEX "User_username_lower_key" ON "User" (lower("username"));
```

`lower(text)` is IMMUTABLE, so the functional index is valid. The existing `User_username_key` remains
(case-sensitive). If collisions had existed, this step would have **stopped** and reported them; none were
found.

---

## 6. Prisma schema review (Step 5)

Schema additions (unchanged from 6B.1; `prisma validate` passes):

| Entity | Supports |
|---|---|
| `CEO.baseSpPerCycle Int?`, `maxOwned Int @default(1)`, `isStarter`, `rewardEligible`, `category`, `displayOrder` | Configurable fixed-SP templates, ownership caps, starter marker |
| `OwnedCeo` (unique `id`, `userId`, `templateId`, `acquisitionType`, `level`, `cycleLimit?`, `completedRewardCycles`, `status`, indexes) | Permanent ownership; **multiple individually identifiable copies**; finite/unlimited reward-cycle allowance; concurrency-friendly reads |
| `ReferralAttribution` (`referredUserId @unique`, `referrerId`, `code`, `eligible`) | One attribution per referred user; safe referral storage |
| `IdempotencyKey` (`@@unique([userId, scope, key])`) | Idempotent starter grants and future mutation replay protection |
| `User` back-relations | Relations only; **no columns changed** |
| `AppMeta` | Drift reconciliation target |
| Enums `AcquisitionType`, `OwnedCeoStatus` | Origin and lifecycle states |

Checklist against requirements:
- Permanent ownership — **yes** (`OwnedCeo` rows persist independently of catalog).
- Multiple copies — **yes** (per-`OwnedCeo` rows; `maxOwned` caps later).
- One starter per user — **yes** (partial unique index + service).
- Configurable max ownership — **yes** (`CEO.maxOwned`).
- Individually identifiable instances — **yes** (`OwnedCeo.id`).
- Idempotent starter — **yes** (`IdempotencyKey` + partial index).
- Safe referral attribution — **yes**.
- DB-level uniqueness — **yes** (constraints table below).
- Safe transaction boundaries — **yes** (starter/registration run in transactions; ownership reads are plain).

All existing `User`/`CEO` fields (including `dailyRatePercent`) are preserved. `dailyRatePercent` is
**not** used for fixed-SP production; `baseSpPerCycle` is the future gameplay field.

---

## 7. SQL migration review (Step 7, against the actual DB)

Reviewed both offline migrations against the live schema (not only `schema.prisma`).

| Requirement | Verdict |
|---|---|
| Existing User/CEO records preserved | Yes — only `ALTER TABLE ... ADD COLUMN` (nullable/defaulted) and `UPDATE` of new columns; no column/row removal |
| Missing `AppMeta` created safely | Yes — `CREATE TABLE IF NOT EXISTS` + `CREATE UNIQUE INDEX IF NOT EXISTS` |
| New CEO fields additive | Yes — all nullable or defaulted |
| New tables have FKs | Yes — `OwnedCeo`→`User`/`CEO` (RESTRICT), `ReferralAttribution`→`User` (RESTRICT), `IdempotencyKey`→`User` (CASCADE) |
| One starter per user (DB level) | Yes — partial unique index `OwnedCeo_starter_user_key` |
| Referral uniqueness + no-self | Yes — unique `referredUserId` + `CHECK (referrerId <> referredUserId)` |
| Idempotency uniqueness | Yes — unique `(userId, scope, key)` |
| Idempotent seed | Yes — `UPDATE ... WHERE slug` and `INSERT ... ON CONFLICT (slug) DO NOTHING` |
| No DROP/TRUNCATE/destructive ALTER/reset | Yes — scan for `DROP TABLE|TRUNCATE|DROP COLUMN|DROP TYPE|DELETE FROM|ALTER TABLE ... DROP` returned **empty** |
| Historical CEO migration not replayed | Yes — neither migration executes or references it |

**Defect found and fixed during this review:** the `intern-ceo` `INSERT` omitted `"updatedAt"`, which is
`NOT NULL` **with no database default** (confirmed read-only), so the insert would have failed. Fixed by
adding `"updatedAt" = CURRENT_TIMESTAMP`. (The same class of bug exists in the historical
`20240102000000_create_ceo_model` seed; it is not replayed.)

**New additive migration (6B.2A):** `lower(username)` unique index. It is independent of the 6B.1
migration and must be applied **after** it.

---

## 8. Neon backup status (Step 8)

- **No backup exists and none was created.** No Neon console/API access is available to this step, and no
  recoverable backup identity could be verified. Per policy, **no database write was performed** and no
  migration was applied.
- **Exact backup-branch procedure (owner action):**
  1. In the Neon console, select the project/branch/DB used by `DATABASE_URL`.
  2. Create a branch from **current data**, e.g. `pre-economy-6b2` (copy-on-write; no downtime).
  3. Record non-sensitive metadata only: branch name/id, timestamp, source branch.
- **How to verify recoverability:** connect to the backup branch with a **read-only** session and confirm
  `User=2`, `CEO=8`, `User`/`CEO` tables present, `AppMeta`/`_prisma_migrations` absent. Record those
  counts. Confirm the branch appears in the branch list and that the project's PITR window covers "now".
- **Restore path:** reset the working branch to the backup point, or PITR to a timestamp before changes,
  then re-verify counts.
- **Claim discipline:** a backup will not be described as existing until it is created **and** verified.

---

## 9. Migration history risks (Step 8)

| Risk | Detail |
|---|---|
| Unbaselined DB | `_prisma_migrations` absent → Prisma treats all migrations as pending |
| Historical replay hazard | `prisma migrate deploy`/`dev` would try `20240101000000_add_user_model` (`CREATE TABLE "User"` → already exists error) and `20240102000000_create_ceo_model` (seed omits `updatedAt` → not-null error) |
| `db push` hazard | Would diff schema→DB and may attempt destructive reconciliation; **forbidden** |
| `DIRECT_URL` P1001 | Normal `prisma migrate*` (uses `directUrl`) is expected to fail |
| Checksum drift | Editing a migration after it is baselined causes "migration modified" errors — so the 6B.1/6B.2A files must be **frozen before** baselining |

**Commands that could incorrectly replay history (do not run):** `prisma migrate dev`,
`prisma migrate deploy`, `prisma migrate reset`, `prisma db push`.
**Safe/read-only or metadata-only:** `prisma migrate status`, `prisma migrate diff` (datamodel→datamodel),
`prisma validate`, `prisma generate`, `prisma migrate resolve --applied` (records history; **does not**
execute SQL).

**Recommended safest apply sequence (after backup + explicit approval):**
1. Verify the backup branch (read-only counts).
2. **Baseline the two historical migrations as applied** (metadata only), matching the observed schema
   (both verified to match their SQL effects):
   ```powershell
   $env:DIRECT_URL = $env:DATABASE_URL   # metadata step only; pooled URL
   npx prisma migrate resolve --applied 20240101000000_add_user_model
   npx prisma migrate resolve --applied 20240102000000_create_ceo_model
   ```
3. **Apply the 6B.1 additive SQL in a single transaction** via the pooled connection (Neon SQL editor, or
   `npx prisma db execute --url "$env:DATABASE_URL" --schema prisma\schema.prisma --file <file>`, or
   `psql "$env:DATABASE_URL" --single-transaction -f <file>`).
4. **Apply the 6B.2A `lower(username)` index** the same way.
5. **Mark the two new migrations applied:**
   ```powershell
   npx prisma migrate resolve --applied 20261017000000_phase6b1_economy_foundation
   npx prisma migrate resolve --applied 20261017010000_phase6b2a_username_case_insensitive
   ```
6. **Verify read-only:** new tables/columns/indexes/FKs present; `AppMeta` present; `User`/`CEO` column
   definitions unchanged; counts `User=2`, `CEO=9`; `/api/health` = `ok`; `GET /api/ceos` returns 9.
7. `npx prisma generate` if not current.

> The pooled-URL override for `migrate resolve` is metadata-only and does not touch application data; it is
> the pragmatic workaround for the unreachable `DIRECT_URL`. If it fails over the pooler, the fallback is
> to create `_prisma_migrations` and insert baseline rows manually with checksums = SHA-256 of each
> migration file — only after the schema check in §7.

---

## 10. Tests and results

- **Type-check:** `npm run build --workspace=server` (`tsc`) → **exit 0** (after fixing one fake row that
  was missing the new `email` field).
- **Tests:** `npm test --workspace=server` → **15/15 pass, 0 fail**.

| Test | Result |
|---|---|
| `isUniqueViolation` detects P2002 only | ✔ |
| starter grant exactly-once under concurrent retries | ✔ |
| subsequent starter grant is idempotent | ✔ |
| starter grant fails without configured template | ✔ |
| one starter per user (partial-index backstop via fake) | ✔ (covered by concurrency test) |
| referral: blank code ignored | ✔ |
| referral: unknown referrer | ✔ |
| referral: self-referral rejected | ✔ |
| referral: valid attribution then duplicate rejected | ✔ |
| **referral resolves referrer case-insensitively** | ✔ (new) |
| **referral resolves mixed-case stored username from lower-case code** | ✔ (new) |
| **registration conflict: case-insensitive username** | ✔ (new) |
| **registration conflict: case-insensitive email** | ✔ (new) |
| **registration conflict: none for a new identity** | ✔ (new) |
| **multiple owned CEO copies listed individually** | ✔ (new) |
| ownership read maps template economy fields | ✔ |

Tests use an in-memory fake Prisma with serialized transactions and enforced unique constraints; **no live
database records were written**.

---

## 11. Remaining blockers

1. **Backup gate (blocking):** create + verify a Neon backup branch and record non-sensitive metadata.
2. **Apply approval:** approve the §9 sequence (baseline → pooled additive apply → mark applied → verify).
3. **Migration file freeze:** confirm no further edits to the two migration files before baselining.
4. **Route enablement (6B.2B):** approval to wire `GET /api/game/ceos/owned` and registration
   starter+referral, after the DB is verified.
5. **Commit policy:** confirm the recommended 6B.2A commit (below) or hold.

---

## 12. Recommended Phase 6B.2B implementation steps (after migration approval)

1. **Apply migrations** per §9 and verify.
2. **Ownership route:** `GET /api/game/ceos/owned` (`requireAuth`) → `listOwnedCeos(req.user.id)`;
   serialize via the ownership view; add a game-route rate limit. Mount under `/api/game`.
3. **Starter + referral in registration:** extend `registerSchema` with the optional `ref`
   (`registerWithReferralSchema`), create the user and call `grantStarterCeo` and `attributeReferral`
   inside/after a transaction. Return only non-sensitive fields; never log tokens/secrets.
4. **Failure isolation:** registration must succeed even if starter/referral side-effects fail
   (log safe errors, retry-safe via idempotency key) — a user is never blocked by economy setup.
5. **Frontend (no redesign):** wire the existing "My CEOs" tab in `pages/CEOs.tsx` to the owned endpoint;
   add typed fetchers in `lib/ceos.ts`.
6. **Tests:** add route-level tests (supertest or handler-level with the fake), plus an optional isolated
   test DB run for the real constraints; keep the live Neon DB out of the test path.
7. **Commit** each step separately; no push.

**Recommended 6B.2A commit (separate from 6B.1):**
```
git add server/prisma/migrations docs/PHASE_6B2A_MIGRATION_REVIEW.md server/src/services/registration.ts \
        server/src/services/referral.ts server/src/services/economy.test.ts server/src/routes/auth.ts
git commit -m "feat(6b2a): case-insensitive username referral handling and migration review"
```

---

## 13. Summary

- Referral architecture finalized on the immutable, case-insensitively resolved `username`; app-level
  case-insensitive uniqueness + referral resolution implemented; no new columns.
- Username immutability verified (no update path exists).
- Live DB confirmed read-only: `User=2`, `CEO=8`, unbaselined, `AppMeta` missing, `User_username_key`
  case-sensitive, **0 case-insensitive collisions** → safe to propose the additive `lower(username)` index.
- Schema satisfies ownership/starter/cap/idempotency/referral requirements; existing fields preserved.
- SQL reviewed against the actual DB; **seed `updatedAt` defect fixed**; no destructive statements;
  historical migration not replayed.
- Backup **not created/verified** → **no DB writes performed**.
- `tsc` passes; **15/15 tests pass**.
- Phase 6B.1 committed as `ec87104`; 6B.2A changes pending a separate commit.

**STOP.** No migration applied and no ownership route enabled. Awaiting explicit approval.
