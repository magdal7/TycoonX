# TycoonX — Production Deployment Notes

Operational reference only. Product rules live in `docs/TYCOONX_V2_MASTER_SPEC.md`; status in
`docs/PROGRESS.md`. As of 2026-10-27 production runs with the financial features **activated**
(`PAYMENTS_ENABLED=true`, `PAYOUTS_ENABLED=true`, `REFERRAL_REWARDS_ENABLED=true`,
`DEPOSIT_ACCESS_MODE=all`, `OXAPAY_SANDBOX=false`). This document describes deployment mechanics; it does
not authorize changing production flags, and local development sandbox defaults stay fail-closed.

## Environment variables (server)
| Variable | Required | Purpose |
|---|---|---|
| `NODE_ENV` | prod | `production` makes auth cookies `Secure` by default. |
| `PORT` | no | Express listen port (default `4000`). |
| `DATABASE_URL` | yes | Pooled Neon connection (app runtime). |
| `DIRECT_URL` | migrations | Direct Neon endpoint (Prisma CLI only). |
| `JWT_SECRET` | yes | Token signing; server refuses to start without it. |
| `REFERRAL_FINGERPRINT_SALT` | recommended | Salt for hashed referral fingerprints (falls back to `JWT_SECRET`). |
| `CORS_ORIGINS` | prod cross-origin | Comma-separated allowlist of credentialed browser origins. Empty blocks cross-origin browsers. |
| `COOKIE_SECURE` | no | Override `Secure` flag (`true`/`false`); defaults to `NODE_ENV==='production'`. |
| `COOKIE_SAMESITE` | no | `lax` (default), `strict`, or `none`. `none` forces `Secure`; use only for a genuinely cross-site frontend/API. |
| `TRUST_PROXY` | no | Opt-in trusted proxy hops (e.g. `1`) or Express string (`loopback`). No default — no edge topology is assumed. |

Client needs no API base URL: all calls use relative `/api/*` with `credentials: 'include'`
(`client/src/lib/*.ts`).

## Same-origin /api requirement
The frontend calls `/api/*` on its own origin. The API therefore must be reachable at the same
origin via one of:
- A reverse proxy on the same host (e.g. Caddy/nginx `handle /api/*` → Express), or
- An edge route (Cloudflare Worker route / Tunnel) that forwards `/api/*` to the backend.

The SPA fallback is provided **natively by Cloudflare Pages**: because the build has no top-level
`404.html`, Pages serves the root (`/index.html`) for any incoming path that does not match a static
asset. `client/public/_redirects` therefore contains no rules — the old `/* /index.html 200` proxy
rule was removed because Cloudflare rejects it as an infinite loop (the `*` also matches
`/index.html`). The `/api/*` route must be intercepted **before** Pages (Worker route / Tunnel) so
API calls never reach the static fallback. `client/public/_headers` sets static security headers and
keeps `sw.js`/manifest uncached for PWA updates.

## Cloudflare Pages (frontend hosting — verified)
| Setting | Value |
|---|---|
| Project | `tycoonx` |
| Repository | `magdal7/TycoonX` |
| Build command | `npm run build --workspace=client` |
| Output directory | `client/dist` |
| Last observed deployed commit | `bc0ef50` |
| Build + asset publishing | SUCCESS |

Cloudflare Pages serves the public frontend; the VPS serves the backend API. The production branch and
automatic-deployment trigger are confirmed at the Cloudflare project settings (not stored in the repo).
Direct navigation/refresh on `/login`, `/dashboard`, and other routes works via the native SPA
fallback above (no `404.html` is emitted by the Vite build).

## Runtime options

### A. Node host / VPS (current code runs as-is)
- Run `server` with Node 20 (`tsx src/index.ts` in prod, or compile and run).
- Set `TRUST_PROXY=1` when a single reverse proxy terminates TLS, so rate limiting and `req.ip`
  are correct. Not required if Express is exposed directly.
- Set `CORS_ORIGINS` to the site origin(s) if the frontend is on a different origin.

### B. Cloudflare Workers only — NOT yet supported (blockers)
The current backend is **not** Worker-compatible without a rewrite:
- **Express 4** depends on Node's `http`/`net` and `app.listen`; Workerd has no Node HTTP server.
  A Worker must expose a `fetch` handler (Express would need an adapter or replacement router).
- **Prisma 5.22** must use the edge/WASM client (`@prisma/client/edge`) with `@prisma/adapter-neon`;
  the Node client bundles a native engine. Verify Worker runtime support before relying on it.
- **`@neondatabase/serverless`** works on Workers (HTTP/WebSocket), so Neon connectivity itself is fine.
- **`jsonwebtoken`** relies on Node `crypto`; prefer a WebCrypto-based library (e.g. `jose`) on Workers.
- **`express-rate-limit`** uses an in-memory store per isolate — ineffective across Workers' many
  isolates. Use Cloudflare's Rate Limiting binding or Durable Objects.
- **`cors`/`cookie-parser`/`dotenv`** are Express/Node middleware; Workers use `env` bindings and
  manual header handling.
- Cookies (`Secure`/`HttpOnly`/`SameSite`) are settable via headers on Workers; same-site rules still apply.

Migrating to Workers is an HTTP-layer rewrite, not a configuration change.

## Verification commands
- `npm run build --workspace=server` (tsc typecheck, no emit)
- `npm test --workspace=server` (unit)
- `npm run build --prefix client` (tsc + vite build; emits `dist/` with `_redirects`/`_headers`)

## Release automation (prepared; not yet enabled end-to-end)

### CI (active)
`.github/workflows/ci.yml` runs on push/PR: install, `prisma generate`, server unit tests, server build,
client build, `prisma validate`. It never deploys and never enables a financial flag.

### Guarded production migrations (manual)
- `neon-migration-referral-provenance.yml` — `20261025000000_v25_referral_provenance` (additive).
  **Already applied in production** (verified 2026-10-27; production history = 15 rows). Do not re-run it.
- `neon-migration-withdrawal-payout-fields.yml` — `20261024000000_v25_withdrawal_payout_fields`.
- `neon-migration-withdrawal-wallet.yml` — applies the single additive migration
  `20261023000000_v25_withdrawal_wallet` (production is on 12 rows; 13 after).
- `neon-migration-execute-steps.yml`, `neon-migration-ceo-purchase-source.yml` — earlier V2.5 migrations.
- Every workflow requires a typed confirmation token, verifies the Neon branch/project identity, freezes
  migration checksums, scans SQL for transaction-unsafe statements, asserts the three financial gates are
  env-driven/fail-closed, applies in one transaction, records history only after the effect is verified,
  and re-verifies the full history/checksums.
- **Never** run `prisma db push`, reset, or `prisma migrate deploy` against production.

### Production deploy (manual, environment-protected)
`.github/workflows/deploy-production.yml` SSHes to the VPS, fast-forwards `master` (no reset/force),
installs deps, regenerates the Prisma client, builds server + client, restarts `tycoonx.service`, and runs
public smoke tests. It does **not** run on push and does **not** apply migrations. Requires the GitHub
Environment `production` with required reviewers.

### Required GitHub secrets (names only — set in GitHub, never in chat/source)
- `DIRECT` — production Neon direct connection string (used by the migration workflows).
- `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY` — deploy target (SSH private key).
- Optional: `VPS_PORT`, `VPS_KNOWN_HOSTS` (else `ssh-keyscan`).
- GitHub Environment `production` protection/approvers.

### Deploy sequence
1. Confirm CI is green on the intended `master` commit.
2. If migrations are pending: create/verify a Neon recovery checkpoint, then dispatch the matching guarded
   migration workflow with its exact confirmation token; verify the new columns and the final row count
   (the referral-provenance workflow records 15 rows). **Migration first, deploy second** for any code
   that reads new columns.
3. Dispatch **Deploy Production** with `DEPLOY-TYCOONX-PRODUCTION` (optionally `expected_sha`) after
   environment approval.
4. Run smoke tests (below). Preserve the production `server/.env` on the VPS: the deploy workflow fast-forwards
   the working tree only and never overwrites it, so the activated flags
   (`PAYMENTS_ENABLED`/`PAYOUTS_ENABLED`/`REFERRAL_REWARDS_ENABLED=true`) remain in effect. Never copy a local
   `.env` to production.
5. Frontend: Cloudflare Pages publishes `client/dist` from the configured production branch; verify
   `/login` and `/dashboard` direct navigation/refresh after publish.
6. Referral rewards (`REFERRAL_REWARDS_ENABLED`) are enabled only after the migration, deploy, and
   integration/accounting checks all pass.

### Smoke tests
- `GET https://api.tycoonx.top/api/health` → `{"status":"ok"}` (DB connected).
- `GET https://api.tycoonx.top/api/auth/me` → **401** (unauthenticated is expected).
- `GET https://tycoonx.top/` → **200**.
- Optional login with an operator-provided safe test account → 200. Do not use real user credentials here.

### Rollback
- **App:** redeploy the previous known-good commit via **Deploy Production** with its `expected_sha`
  (fast-forward only). If the VPS tree has diverged, an operator performs a controlled checkout of the
  known-good SHA, rebuilds, and restarts — never `git reset --hard` on the deploy path.
- **Database:** migrations are additive-only with no automated down-migration. Recovery uses the Neon
  recovery branch / point-in-time workflows (`neon-recovery-*.yml`) with operator approval. Do not drop
  columns without explicit owner review.

### Current status (2026-10-27)
- **Production is live.** VPS `/opt/tycoonx` ran commit `a64ada2` (equal to committed local HEAD at
  reconciliation time) from TypeScript source via `tsx` (`tycoonx.service`), cwd `/opt/tycoonx/server`.
  The production `server/.env` is preserved and must never be overwritten by a deploy.
- **Financial features activated in production:** `PAYMENTS_ENABLED=true`, `PAYOUTS_ENABLED=true`,
  `REFERRAL_REWARDS_ENABLED=true`, `DEPOSIT_ACCESS_MODE=all`, `OXAPAY_SANDBOX=false`. Local development
  sandbox defaults remain fail-closed and must not be changed to match production.
- **Migrations:** production history = 15 rows, matching the repo, including
  `20261025000000_v25_referral_provenance` (already applied). No pending migration.
- **CEO economy is database-configured** in production and differs from the applied
  `20261018000000_v25_economy_sp_production` seed; see Master Spec §3 and `DECISIONS.md`. Do not edit or re-run
  that migration.
- **Payout fee semantics (deploy-safe).** Production does not set `OXAPAY_PAYOUT_FEE_SEMANTICS`. The code
  resolves a missing/blank value to the owner-verified `merchant` default, so **deploying this code does not
  disable payouts**. Optionally set the non-secret value `OXAPAY_PAYOUT_FEE_SEMANTICS="merchant"` in
  `server/.env` (before or after the deploy — there is no required ordering). Only an unrecognized explicit
  value fails closed. Local sandbox defaults stay fail-closed.
- Cloudflare Pages serves the frontend (native SPA fallback; no top-level `404.html`).

