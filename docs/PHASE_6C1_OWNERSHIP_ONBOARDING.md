# Phase 6C.1 — Ownership Integration & Starter Onboarding

Status: implemented and unit-tested. Integration tests are prepared and **self-skip** because no
isolated test database is configured; none were executed. No migrations were run, no Neon branch was
created or reset, and no production/staging/recovery data was touched.

## 1. Review findings

| # | Area | Issue found | Resolution |
| --- | --- | --- | --- |
| 1 | Transaction correctness | `claimIdempotencyKey` swallowed `P2002` and **continued inside the same interactive transaction**. On PostgreSQL any error aborts the transaction, so the following `ownedCeo.create`/`findFirst` would fail with "current transaction is aborted"; the replay branch was unreachable/wrong. | The claim now throws. A unique violation rolls the whole transaction back cleanly, and the replay is reconciled from committed state **outside** `$transaction`. |
| 2 | Transaction correctness | The inner `try/catch` around `ownedCeo.create` had the same poisoning problem. | Removed; the outer catch in `grantStarterCeo` reconciles the race after rollback. |
| 3 | Concurrency (non-starter) | `assertOwnershipCapacity` is a count-then-insert; safe for the starter (backed by the partial unique index) but **not** serializable for arbitrary templates with no DB constraint. | Documented as a remaining risk; all future acquisition paths must call it inside their write transaction. |
| 4 | Authorization | User identity is taken from `req.user.id`; request bodies are ignored for identity/price. | Confirmed and covered by tests (`owned handler ignores a client-supplied userId`, `onboarding is scoped to the authenticated user`). |
| 5 | Template read outside tx | `cEO.findFirst` runs before the transaction; a concurrent deactivate/delete could make the chosen template stale. | Acceptable: the FK preserves referential integrity and `isActive` is re-checked on the next onboarding. Documented. |

## 2. Starter onboarding

First-time provisioning is now exposed as an authenticated **game** endpoint, kept deliberately
separate from `/api/auth` so registration never depends on the economy service:

- `POST /api/game/onboarding` (auth required): idempotently ensures the free starter (Intern) CEO
  exists, then returns the fleet. Safe to call on every session bootstrap.
- The client calls it fire-and-forget when a session is established (`AuthContext` → `ensureOnboarding`;
  errors are ignored so a game/economy hiccup can never block auth).
- Repeated calls never duplicate: the `IdempotencyKey` unique row and the partial unique index
  `OwnedCeo_starter_user_key` guarantee at most one `STARTER` row per user, even under concurrency.

## 3. Endpoints

### `GET /api/game/ceos/owned` (unchanged)

Lists the caller's `OwnedCeo` instances (see Phase 6C doc).

### `POST /api/game/ceos/starter` (behavior unchanged)

- `201 { ownedCeoId, templateId, created: true }` first grant
- `200 { ownedCeoId, templateId, created: false }` replay
- `409 { error: "ownership limit reached" }`, `503 { error: "starter CEO unavailable" }`

### `POST /api/game/onboarding` (new)

- Auth: required
- Request body: none (ignored)
- `200`:

```json
{
  "onboarded": true,
  "starter": { "ownedCeoId": 12, "templateId": 1, "created": true },
  "owned": [ { "id": 12, "templateId": 1, "templateSlug": "intern-ceo", "acquisitionType": "STARTER", "status": "IDLE", "...": "..." } ]
}
```

- Errors: `409` ownership limit, `503` starter template unavailable, `500` internal error.
- Rate limit: inherits `/api/game` (300 / 15 min).

## 4. PostgreSQL integration tests

File: `server/src/integration/ownership.integration.test.ts`. Covers:

1. starter uniqueness (repeated grants → one `STARTER` row);
2. concurrent grants (`Promise.all` ×5 → one row, one `created:true`, one idempotency key);
3. `maxOwned` enforcement (capacity filled with `ADMIN` rows → `OwnershipLimitError`, no starter);
4. transaction rollback (forced failure → neither owned row nor idempotency key persisted);
5. the DB partial unique index rejects a second `STARTER` row.

### Safety model (fail-closed, layered)

- **Guard 1 — string checks (at import).** The suite reads **only** `TEST_DATABASE_URL`; it never falls
  back to `DATABASE_URL`/`DIRECT_URL`. It refuses (throws) if the value equals either, references a
  protected branch id (production `br-delicate-butterfly-b4et73g9`, staging `br-dawn-cherry-b4dnrhm5`,
  recovery `br-long-king-b4s8l0yv`), or points at a non-local, non-Neon host.
- **Guard 2 — positive identity allowlist (on connect).** After connecting it reads, independently from
  the server, `current_setting('neon.branch_id', true)` and `current_setting('neon.project_id', true)`.
  It fails closed unless `branch_id == br-floral-resonance-b4ruvusw` **and**
  `project_id == wandering-king-57462138`. Missing or mismatched values abort before any write.
- **Guard 3 — schema guard (on connect, before writes).** It verifies the Economy V2 objects exist:
  tables `User`, `CEO`, `OwnedCeo`, `ReferralAttribution`, `IdempotencyKey`, `AppMeta`; indexes
  `OwnedCeo_starter_user_key` and `IdempotencyKey_userId_scope_key_key`; and `CEO` economy columns
  `baseSpPerCycle`, `maxOwned`, `isStarter`, `rewardEligible`, `category`, `displayOrder`. Missing
  objects abort.
- No write happens until all three guards pass. A local host is allowed structurally but skipped,
  because the Neon serverless driver cannot talk to a plain local Postgres (that would need `pg`).
- No migrations, no schema resets, no branch operations. Rows are tagged `itest_` and deleted in
  `after`; only the fallback starter template (created solely if none exists) is removed.

### How to configure and run safely

1. In the Neon console, **manually** create a disposable branch (or use the isolated test branch
   `br-floral-resonance-b4ruvusw`). Do not use production/staging/recovery.
2. Apply the frozen migrations to that branch (its own isolated copy). This is an operator action
   outside `npm test`; the suite never applies migrations.
3. Export the branch's **direct** connection string and run (never paste it into the repo):

```powershell
$env:TEST_DATABASE_URL = "<operator-supplied direct connection string for the disposable branch>"
npm run test:integration --workspace=server
```

4. Delete the disposable branch manually when finished.

If `TEST_DATABASE_URL` is unset, the suite reports the tests as **skipped** and never connects.

## 5. Verification results

| Check | Result |
| --- | --- |
| `npx prisma validate` (server/) | ✅ schema valid |
| `npm run build --workspace=server` (`tsc`) | ✅ clean |
| `npm run test --workspace=server` | ✅ **32/32 pass** |
| `npm run test:integration --workspace=server` | ⏭️ **5 skipped** (`TEST_DATABASE_URL is not set`) — strict positive allowlist added; not executed because no operator-supplied connection was present |
| `npm run build --prefix client` | ⚠️ `tsc` clean; `vite build` fails on a **pre-existing** PWA workbox issue (`hq_level3_reference.png` 2.87 MB > 2 MiB precache limit, no `maximumFileSizeToCacheInBytes` configured). Unrelated to this phase. |

## 6. Remaining risks

- **Integration tests not executed.** No isolated test DB is configured here, so real-Postgres
  concurrency/rollback behavior is prepared but unverified until an operator runs them against a
  disposable Neon branch.
- **Concurrency corroboration.** The exact-once guarantee under true parallelism rests on the DB
  constraints (idempotency unique + partial starter index). The unit fake serializes transactions, so
  it cannot reproduce Postgres lock/abort timing; the integration suite is what proves it.
- **`maxOwned` for non-starter templates** is transaction-scoped and not DB-enforced; concurrent
  acquisitions of the same template could exceed the cap. Future purchase/reward paths must use
  `assertOwnershipCapacity` in the same transaction (and may need row locking).
- **Onboarding on every session.** The client calls onboarding whenever `user` changes; it is idempotent
  and cheap (existing-check short-circuits), but a very large fleet still incurs a list query. Acceptable.
- **Pre-existing client PWA build failure** (asset size) remains and should be tracked separately.