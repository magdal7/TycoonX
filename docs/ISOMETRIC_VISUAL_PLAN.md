# TycoonX — Isometric Visual Direction & Architecture Plan

**Phase:** 5H-1 (planning only — no implementation)
**Status:** Proposal for approval. No dependencies installed, no UI rewritten, no backend changes.

Preserve: React 18 + Vite + Tailwind + lucide-react, custom history router, `AuthContext`, `Layout`
(sidebar + bottom nav + safe-area), JWT httpOnly-cookie auth, CEO API (`GET /api/ceos`, Decimal→string),
Prisma 5.22 + Neon, PWA (manifest + Workbox), brand tokens, reduced-motion support.

Simulation-only economy: SP and production are game systems; simulated earnings are **non-withdrawable**.
No payments/referrals are implemented in this phase.

---

## A. Creative vision

TycoonX is a **stylized 2.5D isometric tech-empire management game**, not a finance dashboard. The
authenticated **Home** becomes a living isometric world where the player literally *watches the empire
grow*: plots unlock, buildings rise through visual levels, roads and greenery spread, drones and lights
animate. Numbers live in a compact HUD; the world is the star.

Tone: premium, futuristic, calm-confident, cohesive. Think a clean mobile city-builder with a tech-brutalist
palette — not childish, not photorealistic, not generic SaaS.

**Non-goals:** clone an existing game; simulate real money; imply live features that are not built.

---

## B. Art direction specification

**Camera / projection**
- Fixed **2:1 dimetric** ("isometric") projection. Base tile **64×32 px** (2:1), 1× device-pixel baseline.
- No camera rotation. Allowed: **pan** (drag) and **zoom** (pinch/wheel, 0.75×–2.0× clamped).
- World axes: `+gx` screen down-right, `+gy` screen down-left; depth = `gx + gy`.

**Ground grid & footprints**
- Square grid; buildings occupy footprints in tiles (e.g., HQ 3×3, Server Farm 2×2, AI Lab 2×2, Data Center 3×2).
- Footprint corners drawn as a subtle diamond outline; **locked plots** show a dashed pad + lock/padlock tag.
- Grid accent: faint primary lines over `#0B1020`; hovered/selected cell gets a primary ring.

**Sprite perspective, scale, anchors**
- All sprites authored in the **same 2:1 dimetric** perspective, camera-top aligned.
- **Anchor = footprint bottom-center** (ground contact). Metadata carries footprint (w×h), anchor, and
  optional `sortOffset`.
- Height in "levels" of 16 px per half-tile rise, consistent across assets.

**Lighting & shadows**
- Key light from **north-west, high**; top face brightest, left face mid, right face darkest.
- Pre-baked soft **contact shadow** ellipse under each footprint, offset south-east.
- Accent emissive details (windows, cores) use brand blue/purple/green/amber; subtle bloom at higher levels.

**Level visual evolution (L1→L5)** — a level-up changes *appearance*, not just a number:
- L1 base mass → L2 add side wing → L3 taller core + antenna → L4 roof garden/solar + signage → L5 glow
  accents, holo-ring, drones. Footprint may expand at defined stages.

**Palette** (extend Tailwind tokens): `bg #0B1020`, `primary #3478FF`, `accent #8B5CF6`, `success #16A879`,
plus **`warning/gold #F59E0B`** (currently only used via `amber-*` classes). Sky/void gradient: `#0B1020`→`#141b38`.

**Decorations:** roads, trees (pine/round), bushes, street lamps, solar arrays, small drones, holographic
signs, crates, construction scaffolding. Kept low-contrast so buildings read first.

---

## C. Desktop and mobile wireframes

**Desktop (≥1024px) — world-dominant**
```
┌───────────────────────────────────────────────────────────────┐
│ HUD: Lv / XP bar · Energy · SP · Missions · Build ▸   [user]  │
├──────────────────────────────────────────────┬────────────────┤
│                                              │  Context panel │
│              ISOMETRIC WORLD                 │  ────────────  │
│      (buildings, plots, roads, decor)        │  Selected bldg │
│                                              │  level / next  │
│                                              │  [Upgrade ▸]   │
├──────────────────────────────────────────────┴────────────────┤
│ Build bar: HQ · Server · AI Lab · Data · Decor   [Road/House] │
└───────────────────────────────────────────────────────────────┘
```

**Mobile (360–767px) — touch first**
```
┌─────────────────────────┐
│ Lv5 ▓▓▓░ · ⚡78 · ✦SP    │  compact top HUD
│                         │
│     ISOMETRIC WORLD     │  fills screen; drag pan, pinch zoom
│   tap building/plot     │
│                         │
│ [HQ][Server][AI][Data]  │  build bar (horizontal scroll)
│ ┌─────────────────────┐ │
│ │ Building bottom sheet│ │  snap: peek / half / full
│ │ L1 · Next ▸ · Upgrade│ │  drag handle, close
│ └─────────────────────┘ │
└─────────────────────────┘
```

---

## D. World coordinate & asset architecture

Projection (world → screen), `tileW=64`, `tileH=32`:
```
sx = (gx - gy) * (tileW / 2)
sy = (gx + gy) * (tileH / 2)
screenX = origin.x + sx * zoom + camera.x
screenY = origin.y + sy * zoom + camera.y
```
Inverse transform maps pointer → nearest `(gx, gy)` for hit-testing.

Render layers (painter's algorithm, depth = `gx + gy`, then layer):
1. `ground` (terrain tiles) → 2. `roads` → 3. `plots` (empty/locked) → 4. `decorBack` →
5. `buildings` (sorted by depth) → 6. `decorFront` → 7. `overlays` (selection ring, build FX) → 8. `ui`.

Data (renderer-agnostic; local demo, not persisted):
```
Building { id, type, gx, gy, footprint, level, unlocked, state }
Plot     { gx, gy, size, unlocked, priceTag? }
Decor    { id, asset, gx, gy, layer }
WorldState { grid, buildings[], plots[], decor[], camera, selectedId }
```

---

## E. Technology comparison

| Option | Mobile perf | Bundle | Interaction | React integration | Maintenance | PWA | Scale |
|---|---|---|---|---|---|---|---|
| **A. DOM/CSS/SVG + sprites** | Poor at scale (layout/paint) | ~0 | Manual hit-test, CSS transform pan/zoom | Native | Easy | Great | Limited |
| **B. PixiJS v8 + React** | Excellent (WebGL/Canvas batching) | ~small (tree-shaken) | Built-in events, filters, atlas | Good (`@pixi/react` or imperative) | Active | Great | High |
| **C. Phaser + React** | Very good | Large (~1MB) | Full framework, physics | Awkward (two trees) | Active | Good | High (overkill) |
| **D. Three.js** | Good (GPU) | Large | 3D scene graph | Good (`@react-three/fiber`) | Active | Good | Only if true 3D |

Notes: A is today's stack (zero deps) but will not hold many sprites or smooth pan/zoom; C is overkill and
fights React; D is justified only if we go fully 3D (not the target — we are 2.5D sprites).

---

## F. Recommended renderer

**Recommend B: PixiJS v8** as the production renderer, with a **renderer-agnostic game core**.

- Why: WebGL-batched sprites with excellent mobile performance, texture atlases, built-in pointer events,
  filters for glows, small tree-shakeable bundle, first-class PWA fit, and a clean separation from React.
- Integration: React owns HUD/DOM (accessibility, Tailwind); a `<GameCanvas>` mounts the Pixi app; a thin
  **bridge** syncs `selectedId` and command events both ways. No game logic in React or in the renderer.
- Pragmatic sequencing: build the **5H-2 prototype with the existing DOM/CSS/SVG stack (no new deps)** to
  lock UX and art rules; adopt PixiJS in **5H-4** once approved to add the dependency. The `iso.ts`,
  `grid.ts`, `state.ts`, `types.ts` core is written once and reused by both renderers.

---

## G. Starter asset manifest

Format: transparent **WebP** primary, **PNG fallback**; authors at 2×.
Naming: `bld_<type>_l<level>@2x.webp`, `env_<name>@2x.webp`, `plot_empty@2x.png`, `plot_locked@2x.png`,
`fx_<name>@2x.png`.
Metadata (JSON per sprite): `{ footprint:{w,h}, anchor:'bottom-center', sortOffset, bytes }`.

Initial list:
- Ground: `tile_ground_a/b`, `tile_ground_accent`, `road_straight`, `road_corner`, `road_junction`.
- Buildings: `bld_hq_l1..l5`, `bld_server_l1..l5`, `bld_ailab_l1..l5`, `bld_datacenter_l1..l5`.
- Plots: `plot_empty`, `plot_locked`, `fx_build_scaffold`.
- Decor: `env_tree_pine`, `env_tree_round`, `env_bush`, `env_lamp`, `env_solar`, `env_drone`,
  `env_sign_holo`, `env_crate`.
- FX: `fx_select_ring`, `fx_levelup_burst`, `fx_glow`.

Budgets (targets): initial scene atlas ≤ 512 KB; total first-load game art ≤ 1.5 MB; single sprite ≤ 150 KB.
Loading: manifest preload with skeleton; **sprite fallback** = flat colored iso box + label if an asset fails.
Atlas (optional): pack related sprites into a 2048×2048 atlas in 5H-4.

External art workflow: art spec sheet (per asset) → 2× PNG source → optimize (WebP/PNG) → atlas pack →
place under `client/src/game/assets/` (bundled) or `client/public/game/` (streamed). **No unlicensed art.**

---

## H. React module structure

```
client/src/game/
  engine/        iso.ts        projection + inverse hit-test
                 grid.ts       footprints, occupancy, plot states
                 types.ts      WorldState, Building, Plot, Decor, Camera
                 state.ts      deterministic DEMO world builder (no persistence)
                 selectors.ts  derived stats (level, unlocked count, etc.)
  render/
                 GameCanvas.tsx  React wrapper; mounts active renderer
                 dom/            DOM/SVG prototype renderer (5H-2)
                 pixi/           PixiJS renderer (5H-4)
                 sprites.ts      manifest, anchors, atlas config
  ui/            Hud.tsx         Lv/XP · Energy · SP · Missions · Build
                 BuildBar.tsx    build/decor palette
                 BuildingSheet.tsx  bottom sheet (mobile) / side panel (desktop)
                 PreviewBadge.tsx   "PREVIEW / DEMO" labels
  hooks/         useSelection.ts
                 useCamera.ts    pan/zoom + reduced-motion aware easing
                 useReducedMotion.ts
  assets/        iso/*.webp|png + manifest.json
```
`engine/` has **no React and no renderer imports** (pure, unit-testable). Renderers are swappable.

---

## I. Mouse / touch interaction model

- **Select:** tap/click a building or plot → highlight (ground ring + outline) → open details (side panel
  desktop, bottom sheet mobile). Tap empty ground clears selection.
- **Pan:** drag (finger/mouse). **Zoom:** pinch (touch) / wheel + `+`/`−` (desktop); clamped 0.75×–2.0×.
- **Hit-testing:** inverse projection → grid cell; building tested by footprint (occupied cells). Never
  rely on DOM element hitboxes.
- **Keyboard (a11y):** `Tab` focuses world; arrows pan; `+`/`−` zoom; `[`/`]` or `Tab` cycle buildings;
  `Enter`/`Space` opens details; `Esc` closes. Visible focus ring; screen-reader announces selected building
  (name, level, state via `aria-live`).
- **Reduced motion:** disable camera easing, ambient bounce and pulse; snap selection instantly.
- **Gestures:** long-press reserved for future move/upgrade; no conflicting browser gestures
  (`touch-action: none` on the canvas region only).

---

## J. Performance & accessibility targets

Performance
- 60 fps target; **≥30 fps floor** on low-end Android; selection response < 100 ms.
- Keep the React commit tree stable: HUD updates via throttled/sampled selectors; renderer runs in RAF loop.
- Bundle: game core code-split; initial game art ≤ 1.5 MB; atlas ≤ 512 KB; lazy-load later districts.
- Textures: power-of-two where practical, `resolution` aware, capped canvas DPR (≤2).
- PWA: precache the shell + first scene; SW already managed by `vite-plugin-pwa`.

Accessibility
- Native DOM HUD (semantic buttons, labels, `aria-live` for selection/energy/SP).
- ≥44×44 px touch targets; WCAG AA contrast on text (lift `gray-500` where needed).
- Full keyboard path for select/pan/zoom/details; focus-visible retained (global style exists).
- `prefers-reduced-motion` honored everywhere (no ambient loops).
- Provide a text/structured fallback of the selected building for screen readers.

---

## K. Milestones 5H-2 → 5H-7

- **5H-2 — Dependency-free prototype (no new packages):** `engine/*` + DOM/SVG renderer; isometric ground,
  one polished HQ, empty/locked plots, decor, selection, responsive details panel, PREVIEW labels.
- **5H-3 — Home becomes world-dominant:** local demo world on authenticated Home; compact HUD (Lv/XP,
  Energy, SP, Missions, Build) replacing large dashboard cards; build/upgrade actions shown as preview.
- **5H-4 — PixiJS adoption:** install PixiJS (approved), sprite atlas pipeline, pan/zoom, migrate prototype,
  keep `engine/` unchanged; sprite-failure fallbacks.
- **5H-5 — Progression visuals:** building L1→L5 art + upgrade flow (local, non-persistent), decor/road
  placement, level-up FX.
- **5H-6 — Character & marketing art:** rarity CEO portraits (Common→Mythic); Market + Landing use the same
  world/character art; Landing hero = real world scene, no false "live" claims.
- **5H-7 — Hardening:** performance pass, accessibility audit, reduced-motion QA, PWA offline assets,
  responsive QA at 360/768/1440.

---

## L. Measurable acceptance criteria

- Renders correctly at **360px, 768px, 1440px** with **no horizontal overflow**.
- Touch: select/pan/zoom all work; targets ≥44px; no scroll-jank over the canvas.
- Keyboard: every interactive control reachable and operable; focus visible; Esc closes panels.
- Asset failure: with an image 404'd, a labeled fallback renders and the app does not crash.
- PWA: offline reload shows the shell + first scene; assets cached.
- Reduced-motion: no ambient animation; camera snaps; content still fully usable.
- Performance: ≥30 fps floor on a mid/low mobile profile; first interactive < 2 s on Fast 3G (shell).
- Safety: all game values labeled DEMO/PREVIEW; nothing withdrawable; no payments/referrals.

**Test matrix:** 360 mobile / 768 tablet / 1440 desktop × {touch, mouse, keyboard}; plus asset-failure,
PWA offline, and reduced-motion runs.

---

## M. Risks & open decisions

Risks
- Art production cost/time is the biggest risk (sprites for 4 building types × 5 levels + decor).
- Bundle/memory growth on low-end mobile; depth-sort correctness; keeping React ↔ renderer in sync.
- WebGL availability in some PWA/embedded browsers → need Canvas fallback (Pixi provides one).
- Scope creep into 3D; iOS memory limits with large atlases.

Open decisions (need sign-off)
- PixiJS **v8 vs v7**, and `@pixi/react` vs imperative mounting.
- Grid size & zoom limits; whether level-up expands footprints.
- Art source: commission vs in-house; atlas tooling.
- HUD: keep DOM HUD (recommended) vs canvas HUD.
- Onboarding/generation scope (single starter HQ vs multiple districts).
- Referral concept remains **documentation only** (L1 10% / L2 2% / L3 1% of qualifying real deposits + SP,
  subject to funding, verification, compliance) — **not implemented**.

---

## N. Existing systems to preserve

- React 18 + Vite + Tailwind + lucide-react; custom history router (`components/router.tsx`) and 404.
- `AuthContext` + JWT httpOnly `token` cookie; server routes `/api/auth/*`, `/api/ceos*`, `/api/health`,
  `/api/admin/ping`; admin CRUD; Decimal→string serialization.
- Prisma 5.22 + `@prisma/adapter-neon` + `@neondatabase/serverless`; **no schema/DB changes**.
- `Layout` (sidebar + 5-item bottom nav, safe-area), Phase 5A routing/redirects, PWA manifest + Workbox.
- Brand tokens and dark identity; simulation-only economy (non-withdrawable); demo/preview labeling.
- Reduced-motion and keyboard-focus foundations already in `index.css`.

---

### 5H-2 implementation note (prototype landed)

Delivered a dependency-free prototype (no PixiJS yet):
- `client/src/game/engine/` — `types.ts`, `iso.ts` (2:1 projection, tile/anchor math), `state.ts`
  (deterministic demo world), `selectors.ts` (selection → display model). Renderer-agnostic, no React.
- `client/src/game/render/GameCanvas.tsx` — DOM/SVG renderer with deterministic depth sorting
  (`gx+gy`, then footprint), x-ray-free painter's algorithm, selection + keyboard focus rings.
- `client/src/game/ui/` — `GameHud.tsx` (Lv/XP/Energy/SP, PREVIEW), `BuildingPanel.tsx`
  (desktop side panel + mobile bottom sheet).
- `client/src/game/GameHome.tsx` — world-dominant authenticated Home; old Dashboard kept at
  `/dashboard/classic` (recoverable). `App.tsx` routes only.

What is real vs placeholder:
- **Real**: projection/grid/footprint/depth math, selection state, keyboard/touch/mouse selection,
  responsive layout, HUD wiring, a11y (roles, labels, focus, Esc), reduced-motion on ambient pulses.
- **Placeholder art (documented gap)**: buildings/decor are **parameterized vector (SVG) geometry**, not
  final premium sprites. They read as clean 2.5D blocks but lack texture, detailed windows/roofs and
  authored shading. This is intentional and replaceable: each entity renders from metadata
  (`palette`, footprint, level); swapping to WebP sprites = render `<image href>` in `sprites.ts`
  with the same anchor/footprint metadata. **No primitive SVG is treated as final art.**

Replace path (next): author HQ/Server L1–L5 + decor as transparent WebP per §G, pack to an atlas, and
render as images in the 5H-4 PixiJS pass behind the same engine interfaces.

### Approval gate
§E–F (renderer), §G (asset pipeline) and §K (milestones) remain the plan of record. 5H-2 has been built
as approved scope; **5H-3/5H-4 require explicit approval before implementation** (5H-4 needs the PixiJS
dependency, which is not installed).
