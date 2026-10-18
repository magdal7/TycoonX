# PROJECT_STATUS.md — TycoonX

Verified against repository files; prior summaries treated as stale.

## Audit (latest)
- Client build (`npm run build --prefix client`, tsc + vite) — PASS after Phase 5H-2.
- React deps consistent (single `react@18.3.1`). Repo is NOT a git repository.
- Safe-area CSS and dark brand tokens verified in the built bundle. Not browser-runtime-tested.
- Phase 5H-1 (planning only): created `docs/ISOMETRIC_VISUAL_PLAN.md`; no code/deps/backend changes.
- Phase 5H-3 (planning only): created `docs/TYCOONX_ART_DIRECTION_V2.md` (art-direction/world-composition
  reset). No code/deps/backend changes.
- Phase 5H-3B (pipeline): asset folders, typed sprite manifest (39 sprites / 63 files), validator
  (`npm run validate:assets --prefix client`) and optional image rendering behind `VITE_USE_SPRITES`
  (default off, vector fallback). Client build PASS; validator OK (0 required missing, all art pending).

## Implemented
- Auth (server+client): register/login/logout/me; JWT httpOnly cookie; bcrypt; Zod; rate limiting.
- CEO catalog API (server): `GET /api/ceos` (auth), `GET /api/ceos/:id` (auth), CRUD (admin); Decimal→string.
- Prisma models: `User`, `CEO`, `AppMeta`; two migration files.
- CEO Market (Phase 5C, `pages/CEOs.tsx`, `lib/ceos.ts`): real `GET /api/ceos`, typed parsing, search,
  rarity filter, price sort, loading/error/retry/empty; original inline-SVG CEO portraits with rarity
  frames/glows; price/rate/cycle/energy/projected-day; Market vs disabled "My CEOs" tabs; disabled
  "Buy — Coming Soon"; responsive 1/2/3 columns; no demo data, no ownership.
- Responsive Layout (Phase 5A): collapsible sidebar (md/768px+), header, `max-w-6xl` centered content,
  mobile 5-item bottom nav with safe-area; router 404 fallback, path normalization, active-nav, redirects.
- Dashboard (Phase 5B) — game "Command Center": Empire HQ hero (inline isometric SVG, no deps), compact
  Game Status panel (Level/XP/Energy, DEMO-labeled), rarity-themed Executive Roster from real `/api/ceos`
  (no ownership), compact Production Cycles (DEMO, no timers), Daily Missions with simulated "SP" points
  (not money), navigation Quick Actions with disabled "Soon" items. Oversized $0 panels removed.
- Empire (Phase 5D, `pages/Empire.tsx`): interactive isometric SVG HQ scene (Headquarters, Server Farm,
  AI Lab, Data Center) with selectable buildings + details panel; Overview/Buildings/Production tabs;
  locked/unlocked building cards with DEMO/PREVIEW levels and future upgrades; compact DEMO production
  previews (no timers/accrual); no CEO income. Frontend-only local interaction.
- Tasks/Profile/Wallet (Phase 5E): Tasks Missions Center (Daily/Weekly/Achievements tabs, progress cards,
  XP/SP rewards, DEMO labels, no completion/reward logic); Profile uses real auth account data with
  DEMO-labeled level/XP and Wallet/Settings/Referrals/Help + secure logout; Wallet separates simulated
  production credits, game points (SP/XP) and a "Coming Soon" real-money balance (no invented balances).
- Landing (Phase 5G, `pages/Landing.tsx`): premium public site — responsive header (anchor nav + Login/
  Start Playing), cinematic hero with original inline-SVG HQ scene, How It Works with Live/In-development
  badges, illustrative executive previews (reusing market rarity/portrait styling, no public API call),
  Empire preview (buildings + Coming Soon), feature highlights, PWA showcase, FAQ, final CTA and footer.
  SEO meta in `index.html`, reduced-motion-safe smooth scroll. Optional `?ref=` preserved from landing to
  `/register?ref=CODE` (not stored or credited; no auth flow changes).
- Isometric world prototype (Phase 5H-2, `client/src/game/`): renderer-agnostic engine (`engine/iso.ts`
  2:1 projection, `grid` via footprints in `state.ts`, `types.ts`, `selectors.ts`) + DOM/SVG renderer
  (`render/GameCanvas.tsx`) with deterministic depth sorting, selectable HQ/Server and an available plot,
  locked plots (non-interactive), decorative campus, and a compact PREVIEW HUD (`ui/GameHud.tsx`,
  `ui/BuildingPanel.tsx` — desktop side panel / mobile bottom sheet). World-dominant authenticated Home
  (`game/GameHome.tsx`); previous Dashboard preserved at `/dashboard/classic`. No deps added.
- Game art pipeline (Phase 5H-3B): `client/public/assets/game/{buildings,terrain,environment,plots,effects}/`,
  typed `render/spriteManifest.json`+`.ts`, `render/featureFlags.ts`, `scripts/validate-assets.mjs`
  (PNG/WebP dimension checks), `docs/GAME_ART_PIPELINE.md`. `GameCanvas` can render `<image>` sprites when
  `VITE_USE_SPRITES=true`; vector art remains the fallback. No PixiJS yet.

## Completed phases
- Phase 1 scaffold+auth; 2 auth e2e; 3 premium UI; 4A CEO backend; 4B CEO Market; 5A responsive foundation;
  5B premium game Dashboard; 5C premium CEO Marketplace redesign; 5D interactive Empire game UI;
  5E Tasks/Profile/Wallet redesign; 5G premium game landing page; 5H-1 isometric visual direction &
  architecture plan; 5H-2 interactive isometric world prototype (Home); 5H-3 art-direction V2 &
  world-composition reset (docs only); 5H-3B game art pipeline preparation (manifest + validator + flag).

## Known issues
- 5H-2 world art is placeholder vector SVG (documented gap); `docs/TYCOONX_ART_DIRECTION_V2.md` resets the
  look (separate UI vs world palettes, district composition, illustrated WebP sprites). Replace in 5H-4+.
- **No final artwork delivered yet** — pipeline expects 63 sprite files; validator reports them as pending
  (expected). Visual completion is NOT claimed until the §7 gate art lands and is reviewed.
- Runtime behavior not browser-verified since the 5H-2 prototype (build-only verification).
- Not browser-runtime-tested since Phase 5A (verify landing/layout/nav in a browser).
- Tasks/Empire/Wallet use labeled DEMO preview data (missions, buildings, cycles); no real balances,
  rewards or cross-page CEO income.
- Neon direct migrations fail `P1001`; `CEO` table created out-of-band; `prisma migrate` status unverified;
  migration seed omits `updatedAt` (do not reset).
- `server/dist` absent (tsconfig `noEmit`); run server with `tsx`. CEO daily rates are non-withdrawable.

## Next steps
1. Deliver the §7 acceptance-gate artwork into `client/public/assets/game/`, set `available:true`, and confirm
   `npm run validate:assets --prefix client` passes; then enable `VITE_USE_SPRITES` and review.
2. Approve `docs/TYCOONX_ART_DIRECTION_V2.md` palette/composition and continue sprite production.
3. Browser-verify Phase 5A–5H across desktop, tablet and 360px mobile.
4. Wire Empire/Tasks to real data when backend endpoints exist (currently DEMO previews).
5. Later: ownership model, production cycles, energy, upgrades — all simulation-only.
