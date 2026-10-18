# PROJECT_REVIEW.md — TycoonX

Pre-design review. Based only on inspected repository code; no invented functionality.
Status markers: **[Implemented]**, **[Partial]**, **[Planned]**.

## 1. Current architecture and implemented features

**Architecture**
- npm workspaces monorepo: `client`, `server`, `shared` (root `package.json`).
- `client/`: React 18.3.1, Vite 5, Tailwind 3, `lucide-react`, `vite-plugin-pwa`. Custom history router
  (`components/router.tsx`), not react-router. Auth via `context/AuthContext.tsx`.
- `server/`: Express 4 + TypeScript ESM, run with `tsx` (tsconfig `noEmit`, no `dist`), port 4000.
  Entry `src/index.ts`; routes `src/routes/{auth,ceo}.ts`; middleware `src/middleware/auth.ts`.
- DB: Neon PostgreSQL via Prisma 5.22 + `@prisma/adapter-neon` + `@neondatabase/serverless` Pool
  (`DATABASE_URL` pooler; `DIRECT_URL` for migrations).
- Vite dev server :5173 proxies `/api` → :4000. `resolve.dedupe: ['react','react-dom']`.
- `shared/index.ts` exists (`HealthResponse`) but is **[Planned]** — not imported anywhere.

**Implemented features**
- Auth API **[Implemented]**: register/login/logout/me; JWT httpOnly `token` cookie (7d); bcrypt(12);
  Zod validation; rate limit on `/api/auth`. Roles USER/ADMIN.
- Auth UI **[Implemented]**: `Login.tsx`, `Register.tsx` (validation, show/hide password, loading).
- Health/admin **[Implemented]**: `GET /api/health`, `GET /api/admin/ping` (admin-only).
- CEO catalog API **[Implemented]**: `GET /api/ceos` (auth), `GET /api/ceos/:id` (auth),
  `POST`/`PUT`/`DELETE` (admin-only); Zod; Decimal→string serialization; slug-conflict 409.
- Prisma models **[Implemented]**: `User`, `CEO`, `AppMeta`; two migration files present.
- CEO Market UI **[Implemented]** (Phase 4B): `pages/CEOs.tsx` + `lib/ceos.ts` fetch `GET /api/ceos`,
  typed parsing, search/rarity-filter/price-sort, cards, loading/error/retry/empty, disabled "Coming Soon".
- Authenticated Layout **[Implemented]**: desktop sidebar + mobile bottom nav (5 items); custom router.
- Dashboard **[Partial]**: real CEO preview from API; level/energy/XP bars, production cycles, daily tasks,
  quick actions use `data/demo.ts`.
- PWA **[Partial]**: manifest + Workbox SW; icons present (`icon-192`, `icon-512`); `orientation: portrait`.

## 2. Planned features still missing (from vision)
- CEO ownership / purchase flow **[Planned]** — no purchase, no `UserCEO` ownership model.
- 4-hour production cycle engine (timers, accrual) **[Planned]** — UI shows demo cycles only.
- Energy system (spend/regen) **[Planned]** — only a demo progress bar.
- Offices / buildings / upgrades **[Planned]**.
- Missions/daily-task logic **[Planned]** — `Tasks.tsx` is static demo.
- Referrals **[Planned]**; Leaderboards **[Planned]**.
- Wallet/earnings **[Planned]** — `Wallet.tsx` is a $0 placeholder; explicitly non-withdrawable.
- Admin UI for CEO CRUD **[Planned]** — API exists, no admin screen.
- Real financial separation is **by design** (simulation only) **[Implemented as policy]**.

## 3. UI/UX issues (desktop, tablet, mobile PWA)
- **Router robustness [Partial]**: `RouterProvider` renders `null` for unknown paths → blank page; no 404.
  `App.navigate` dispatches `popstate` as a workaround; desktop sidebar always highlights "Dashboard".
- **Deep links**: unauthenticated `/dashboard/*` falls back via `page` state; entry behaviour is fragile.
- **Mobile PWA**: bottom nav is fixed; only `Dashboard.tsx` adds `pb-20`, so Empire/Tasks/Wallet/Profile
  content can sit behind the nav. `orientation: portrait` may be undesirable on desktop installs.
- **Tablet**: breakpoints jump from single-column to `lg` (1024px); no tablet-specific layout; bottom nav
  persists until `lg`, leaving wide empty space on tablets.
- **Desktop**: authed content is not width-constrained (no `max-w` container); reads stretched on wide screens.
- **Consistency**: Landing shows a bare "Idle" card; loading states differ across pages; low-contrast
  `text-gray-500` on `#0B1020`; disabled buttons rely on opacity.
- **A11y**: selects/inputs are labelled; no global focus-visible styling on `<select>`; no error boundary.

## 4. Recommended navigation and page structure
- Bottom nav (5, mobile): **Home/Dashboard, Market, Empire, Tasks, Profile**.
- Desktop sidebar mirrors the 5; secondary items under Profile.
- Pages:
  - **CEO Market** (catalog, filters, Coming Soon) — `pages/CEOs.tsx`.
  - **My CEOs** (owned; separate tab/section) — **[Planned]**.
  - **Empire** (offices/buildings, production cycles, upgrades) — split Overview / Production.
  - **Tasks/Missions**; **Leaderboard** (top-level later); **Referrals** (under Profile).
  - **Profile** bundles Wallet, Settings, Notifications, Help.
- Keep Wallet/NOT a source of real money; label all game economy as simulation.

## 5. CEO Market vs owned CEOs separation
- **Market** = global catalog (`CEO` table; `GET /api/ceos`). **[Implemented]**.
- **Owned** = per-user relation (`User`↔`CEO` join, quantity/level). **[Planned]** — no schema yet.
- Dashboard correctly shows a *market preview*, not "owned" assets (fixed in Phase 4B); `Empire.tsx`
  still derives an "owned"-style demo income from `DEMO_CEOS` and should be migrated later.
- Keep the two visually distinct: Market (price/purchase) vs Owned (yield/upgrade).

## 6. Demo data vs real API data; Phase 4B state
- **Real API**: Auth, CEO Market (`CEOs.tsx`), Dashboard CEO preview.
- **Demo (`data/demo.ts`)**: `DEMO_PLAYER`, `DEMO_PRODUCTION_CYCLES`, `DEMO_DAILY_TASKS`,
  `DEMO_QUICK_ACTIONS`, and `DEMO_CEOS` (still referenced by `Empire.tsx`).
- **Phase 4B**: the *CEO Market* is **Implemented** (wired to `GET /api/ceos`). Remaining gaps:
  `Empire.tsx` demo data, no ownership/purchase, no admin UI, and no browser-runtime verification.
- A "DEMO DATA"/"SIMULATION DATA" badge is shown on relevant screens.

## 7. Technical risks
- **Migration state unverified [Risk]**: `DIRECT_URL` unreachable (`P1001`); `CEO` table created
  out-of-band via a temporary pooler script; `prisma migrate` status unknown.
- **Unsafe migration file [Risk]**: `20240102000000_create_ceo_model/migration.sql` seed omits `updatedAt`
  (NOT NULL, no default) → re-applying via Prisma would fail. Do not reset; reconcile manually.
- **No version control [Risk]**: directory is not a git repository (no history/diff).
- **No automated tests**; no `dist` (server runs via `tsx`); Windows Prisma DLL EPERM flakiness.
- **Shared workspace unused**; router fragility; no 404/error boundary.
- Financial safety is preserved: no payments, no withdrawable balances; rates are simulations.

## 8. Prioritized frontend redesign roadmap
- **P0 — Stability**: initialize version control; browser-verify auth + Market; harden router (404 +
  active-nav state); add consistent mobile bottom-nav padding to all pages.
- **P1 — Responsive layout**: desktop `max-w` content container; tablet breakpoints (md); unify
  cards/loading/empty/error; improve contrast and focus states.
- **P2 — Separation & structure**: introduce My CEOs (owned) vs Market; wire admin CEO CRUD screen;
  reorganize nav per §4.
- **P3 — Data integration**: migrate `Empire.tsx`/`Tasks.tsx` off demo data as endpoints appear.
- **P4 — Game systems (later)**: production cycles, energy, upgrades, referrals, leaderboards — all
  simulation-only, non-withdrawable.
