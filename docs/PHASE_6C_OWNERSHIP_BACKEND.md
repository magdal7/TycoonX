# Phase 6C — CEO Ownership Backend

Status: implemented and tested (no production cycles, purchases, deposits, withdrawals, or SP
production). No database migrations were executed and no Neon data was modified.

## Scope

Expose the Economy V2 ownership primitives that already existed as services (Phase 6B) through
authenticated HTTP endpoints, enforce per-template ownership caps (`maxOwned`), and keep the free
starter ("Intern") CEO exactly-once per user. CEO catalog templates remain distinct from individual
`OwnedCeo` instances.

## Endpoints

Both endpoints require the existing auth: JWT in the httpOnly `token` cookie. The acting user is
always taken from the verified session (`req.user.id`); any client-supplied `userId`, price, or
ownership state is ignored.

### `GET /api/game/ceos/owned`

List the authenticated user's owned CEO copies.

- Auth: required (`requireAuth`)
- Request body: none
- Response `200`:

```json
{
  "owned": [
    {
      "id": 12,
      "templateId": 1,
      "templateSlug": "intern-ceo",
      "templateName": "Intern CEO",
      "rarity": "Common",
      "acquisitionType": "STARTER",
      "level": 1,
      "status": "IDLE",
      "cycleLimit": null,
      "completedRewardCycles": 0,
      "baseSpPerCycle": 10,
      "energyCost": 2,
      "cycleHours": 4,
      "acquiredAt": "2026-10-17T00:00:00.000Z"
    }
  ]
}
```

- Response `401` when unauthenticated.
- Ordering: `acquiredAt` ascending. Multiple copies of the same template are listed individually
  (`id` is the `OwnedCeo` row id, `templateId`/`templateSlug` identify the catalog template).

### `POST /api/game/ceos/starter`

Idempotently provision the one free starter (Intern) CEO for the authenticated user.

- Auth: required (`requireAuth`)
- Request body: none (any `userId`/price in the body is ignored)
- Behavior: finds the active `isStarter` template; if the user already has a `STARTER` copy, returns
  it; otherwise, inside a transaction, checks `maxOwned`, claims the `IdempotencyKey`
  (`scope = "starter_ceo"`, `key = "v1"`), and creates one `OwnedCeo` with
  `acquisitionType = "STARTER"`. The partial unique index `OwnedCeo_starter_user_key`
  (`userId WHERE acquisitionType = 'STARTER'`) is the concurrency backstop.
- Response `201` (first grant):

```json
{ "ownedCeoId": 12, "templateId": 1, "created": true }
```

- Response `200` (idempotent replay / already owned):

```json
{ "ownedCeoId": 12, "templateId": 1, "created": false }
```

- Response `409` `{ "error": "ownership limit reached" }` when the user's copies of the starter
  template already equal its `maxOwned`.
- Response `503` `{ "error": "starter CEO unavailable" }` when no active `isStarter` template exists
  (server configuration issue).
- Response `500` `{ "error": "internal error" }` for unexpected failures.

### Rate limiting

`/api/game` is protected by `express-rate-limit` (300 requests / 15 min). Existing `/api/auth`
(20 / 15 min) and `/api/ceos` behavior are unchanged.

## Files

| File | Change |
| --- | --- |
| `server/src/routes/game/ceos.ts` | New. Handler factories + `createGameCeoRouter(db)`. |
| `server/src/index.ts` | Mounts `/api/game` with a rate limit, injecting the `prisma` client. |
| `server/src/services/starterCeo.ts` | Selects `maxOwned`; enforces capacity inside the transaction; exports `STARTER_TEMPLATE_MISSING`. |
| `server/src/services/ownership.ts` | Adds `OwnershipLimitError` and `assertOwnershipCapacity`. |
| `server/src/routes/game/ceos.test.ts` | New handler-level tests. |
| `server/src/middleware/auth.test.ts` | New unauthorized/authorization tests. |
| `server/src/services/economy.test.ts` | Adds `maxOwned` to the fake and capacity/per-user tests. |
| `server/package.json` | `test` script includes the new test files. |

## Design decisions

- **Templates vs. instances preserved.** `CEO` is the catalog template; `OwnedCeo` is one concrete
  copy. The list endpoint returns instance state plus the template's economy fields; it never mutates
  the catalog.
- **Server-authoritative ownership.** The user id comes from `req.user.id`; capacity is computed from
  the persisted `OwnedCeo` count and the template's own `maxOwned` inside the same transaction as the
  insert.
- **Idempotency.** The free starter uses the existing `IdempotencyKey` table (`@@unique([userId,
  scope, key])`) plus the partial unique index. There is no stored result payload by design; the
  replay result is derived from existing `STARTER` state.
- **Injectable db.** `createGameCeoRouter(db)` / handler factories take the `PrismaClient`, so routes
  are testable without a real database and without new dependencies (no `supertest`).
- **No client-supplied identity/price.** No request field is trusted for identity or economy values;
  the starter endpoint ignores the body entirely.

## Non-goals (explicitly not implemented)

Production cycles (start/collect/bulk), upgrades, real-money purchases/deposits/withdrawals, SP
production, reward milestone grants, and registration-side automatic starter/referral wiring.

## Verification

- `npx prisma validate` (from `server/`): schema valid.
- `npm run build --workspace=server` (`tsc`): clean.
- `npm run test --workspace=server`: **28/28 pass**, including:
  - duplicate provisioning (idempotent replay returns the same `ownedCeoId`);
  - concurrent requests (started grant is exactly-once under `Promise.all`);
  - ownership limits (`assertOwnershipCapacity`, starter `409`, per-template cap);
  - unauthorized access (missing/malformed token → `401`; non-admin → `403`).

## Unresolved risks / follow-ups

- **Registration not wired.** Starter provisioning is currently reachable only via the endpoint. If
  automatic on-register provisioning is desired, it should reuse `grantStarterCeo` and stay
  failure-isolated so economy setup never blocks registration.
- **Eligibility definition.** "Eligible user" currently means any authenticated non-anonymous user;
  there is no Sybil/anti-abuse eligibility signal yet (spec §3.2/§8.3). Until then, one starter per
  account is enforced, not one per real human.
- **Rate-limit value.** 300/15 min for `/api/game` is a conservative default and may need tuning once
  the client polls the owned list.
- **DB-level capacity.** `maxOwned` is enforced in application code within a transaction; unlike the
  starter, there is no per-template partial index for arbitrary `maxOwned`. Non-starter acquisition
  paths (future phases) must keep using `assertOwnershipCapacity` inside their transactions.
- **Test isolation.** Service/handler tests use an in-memory fake; the real partial index and
  `IdempotencyKey` unique constraint are exercised only against Neon. No live DB was touched here.