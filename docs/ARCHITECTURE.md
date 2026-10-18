# TycoonX — Architecture

Current system map. Product rules are in `docs/TYCOONX_V2_MASTER_SPEC.md`; status in `docs/PROGRESS.md`.

## Monorepo
- `client/` — React 18 + TS + Vite + Tailwind + `lucide-react` + `vite-plugin-pwa`. Custom history router
  (`src/components/router.tsx`, not react-router). Auth via `src/context/AuthContext.tsx`.
- `server/` — Express 4 + TS, ESM, run with `tsx` (`noEmit`). Entry `src/index.ts`, port 4000.
- `shared/` — shared TS types.
- DB — Neon PostgreSQL via Prisma 5.22 + `@prisma/adapter-neon` + `@neondatabase/serverless` Pool
  (`DATABASE_URL`; `DIRECT_URL` for migrations).

## Server layout
- Routes: `src/routes/{auth,ceo}.ts`, `src/routes/game/ceos.ts`.
- Services: `src/services/{ownership,starterCeo,referral,registration}.ts`.
- Lib: `src/lib/{prisma,idempotency,auth}.ts`.
- Middleware: `src/middleware/auth.ts` (`requireAuth`, `requireAdmin`).
- Validation: `src/validation/{auth,ceo,game}.ts` (Zod).
- Tests: `src/**/*.test.ts` (`npm test`), `src/integration/*` (`npm run test:integration`, gated).

## Client layout
- Pages: `src/pages/*` (Landing, Login, Register, Dashboard, CEOs, Empire, Tasks, Wallet, Profile).
- Game prototype: `src/game/{engine,render,ui}` (isometric, presentational only).
- API helpers: `src/lib/ceos.ts`; demo data: `src/data/demo.ts`.
- UI primitives: `src/components/ui/{button,input,card,badge}.tsx`.

## Data model (current `schema.prisma`)
`AppMeta`, `User`, `CEO` (catalog + economy columns), `OwnedCeo`, `ReferralAttribution`, `IdempotencyKey`;
enums `Role`, `AcquisitionType`, `OwnedCeoStatus`.

## Security invariants
JWT httpOnly cookie; roles USER/ADMIN; bcrypt 12; server-authoritative economy mutations; idempotency via
`IdempotencyKey`; PostgreSQL-safe concurrency (never catch a unique violation and continue in an aborted
transaction). See Master Spec §11 and `AGENTS.md`.
