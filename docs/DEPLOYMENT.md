# TycoonX — Production Deployment Notes

Operational reference only. Product rules live in `docs/TYCOONX_V2_MASTER_SPEC.md`; status in
`docs/PROGRESS.md`. Real payments/payouts remain **disabled** (`PAYMENTS_ENABLED=false`,
`REFERRAL_REWARDS_ENABLED=false`); do not enable them here.

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

`client/public/_redirects` provides the SPA fallback (`/* /index.html 200`). The `/api/*` route must
be intercepted **before** Pages so API calls never reach that catch-all. `client/public/_headers`
sets static security headers and keeps `sw.js`/manifest uncached for PWA updates.

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
