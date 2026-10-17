# AGENTS.md — TycoonX

Standalone mobile-first PWA tech-CEO tycoon game. npm workspaces monorepo: `client`, `server`, `shared`.
No Telegram, purchases, real earnings, or OxaPay integration yet. CEO daily rates are simulation-only.

## Architecture
- `client/` React 18 + TS + Vite + Tailwind + lucide-react + vite-plugin-pwa. Routing is a custom history
  router (`src/components/router.tsx`), NOT react-router. Auth via `src/context/AuthContext.tsx`.
- `server/` Express + TS, ESM (`"type":"module"`), run with `tsx` (tsconfig `noEmit`). Entry `src/index.ts`, port 4000.
- `shared/` shared TS types (`index.ts`).
- DB: Neon PostgreSQL via Prisma 5.22 + `@prisma/adapter-neon` + `@neondatabase/serverless` Pool using
  `DATABASE_URL`; `DIRECT_URL` is used for migrations.

## Commands (repo root)
- `npm run dev` — client + server; `npm run dev:client` / `npm run dev:server`
- `npm run build --workspace=server` — tsc typecheck (no emit)
- `npm run build --prefix client` — tsc + vite build
- Client dev http://localhost:5173 (Vite proxies `/api` → `http://localhost:4000`)

## Conventions
- Routes `server/src/routes/*`, Zod schemas `server/src/validation/*`, middleware `server/src/middleware/auth.ts`.
- Auth: JWT in httpOnly `token` cookie (7d); roles USER/ADMIN; `requireAuth`, `requireAdmin`.
- Prisma model `CEO` → client property `prisma.cEO` (Prisma lowercases the first letter).
- Serialize Prisma `Decimal` to strings before JSON (see `serializeCEO`).
- Frontend: reuse `src/components/ui/{button,input,card,badge}.tsx`; Tailwind tokens `bg` #0B1020,
  `primary` #3478FF, `accent` #8B5CF6, `success` #16A879; mobile-first from 360px.
- Match existing style; no comments unless asked; minimal, focused changes; no unnecessary refactors.

## Security
- Never commit `.env` or secrets; use `.env.example` placeholders. Never place real secrets in docs.
- Never log tokens/passwords. Passwords hashed with bcryptjs (12 rounds).
- Do not weaken auth, CORS, cookie flags, or rate limits.

## Prisma + Neon (Windows)
- Direct migrations currently fail `P1001` (direct host unreachable). Inspect actual migration state;
  do NOT assume the DB is synchronized with migration files.
- Generate client with `npx prisma generate`. On Windows EPERM renaming the engine DLL, stop the process
  holding `node_modules/.prisma/client/query_engine-windows.dll.node`, then regenerate.
- Never reset migrations or run destructive DB ops; preserve data; do not upgrade Prisma.
- Server `build` script guards against redundant `prisma generate` (EPERM mitigation).

## Windows / PowerShell
- Shell is Windows PowerShell 5.1. No `head`, `tail`, `||`, `&&`, `ls -la`, `rm -f`.
- Use `Select-Object`, `Remove-Item -Force`, `Test-Path`, and `;` chaining.
- Use full cmdlet names; one logical step per shell call; parallelize independent calls.

## Minimal-token workflow
- Inspect only relevant files; prefer Grep/Glob over reading whole trees; batch parallel reads.
- Avoid re-reading unchanged files. Run focused checks once; fix only confirmed errors.
- Keep replies concise; report changed files, tests, and blockers.
