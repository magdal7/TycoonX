# TycoonX — Art Direction V2 (World Composition Reset)

**Phase:** 5H-3 (planning only — no UI or backend changes, no dependencies)
**Owner:** Art Direction / Environment Design / Game UI-UX
**Supersedes:** the visual assumptions in `docs/ISOMETRIC_VISUAL_PLAN.md` (that plan stays valid for
projection math, module boundaries and the renderer recommendation; V2 resets *look & composition*).

Preserve unchanged: React/Vite/Tailwind/lucide, custom router, `AuthContext`, JWT cookie auth, CEO API
(Decimal→string), `Layout` global nav, PWA, Prisma/Neon, simulation-only economy (non-withdrawable).

---

## A. Critique of the 5H-2 prototype

Technically sound, visually unacceptable as finished art. Concrete issues found by inspecting
`client/src/game/`:

1. **Tiny world in a void.** An 8×8 grid inside a `760×560` viewBox with `ORIGIN (380,168)` leaves
   ~25–35% near-empty dark space at the top and corners. The `groundGlow` ellipse is the only filler.
2. **Primitive vector buildings.** HQ is 3 polygons (`#7aa8ff/#16224a/#2d4fa0`) + window quads + an
   antenna; Server Farm is a shorter teal box. No silhouette variety, no material story, no authored
   detail — it reads as "shapes", not architecture.
3. **Excessive dark blue.** Ground tiles are near-black (`#101830` / `#0d1428`), the SVG backdrop is
   `#0e1530 → #0B1020`, and building sides are navy (`#16224a`). The whole scene collapses into one dark
   blue note; nothing pops.
4. **Oversized empty details panel.** `BuildingPanel` desktop `aside` is a `lg:w-96` bordered gray card
   holding ~5 short rows → mostly empty space; it dominates more than the world.
5. **Administrative dashboard framing.** `Layout` chrome + `GameHud` are dashboard chips
   (`gray-900/40`, `rounded-xl`, `border-gray-800/60`); "Classic view" invites the finance-dashboard feel
   we are trying to leave.
6. **Little environmental richness or progression.** Decor is 15 static sprites; no level-driven visual
   change beyond a minor height bump (`heightFor`); no plaza, water, or district boundaries.

Root cause: the prototype optimized for *correct* iso math, not for *readable, colorful, characterful*
game art. **Do not fix this by adding more SVG polygons/gradients/neon outlines** — fix it with a proper
world palette, composition, and real illustrated sprites.

---

## B. Separate UI and world color systems

Two palettes, deliberately different jobs. The dark navy is the **frame**; the world is **lighter and
colorful** so it dominates.

**UI / chrome (dark navy framing)**
| Token | Hex | Use |
|---|---|---|
| `ui-void` | `#0B1020` | App background behind panels |
| `ui-panel` | `#101827` | Cards, rails, bottom sheets |
| `ui-primary` | `#397BFF` | Primary actions, XP, focus |
| `ui-accent` | `#8859ED` | Secondary/progression |
| `ui-cyan` | `#42D6E8` | Info, glass, energy accents |
| `ui-gold` | `#F4B544` | Currency/SP, locked, highlights |

**World (lighter materials)**
| Token | Hex | Use |
|---|---|---|
| `w-grass` | `#78B986` | Lawn / island base |
| `w-concrete` | `#C8D2DB` | Pads, plaza, paths |
| `w-wall` | `#E4E9ED` | Building walls (reads light, not navy) |
| `w-glass` | `#6AC9DE` | Windows/glass volumes |
| `w-steel` | `#526778` | Roofs/metal, shadow side |

Rules: world surfaces use light values (walls near-white/teal); **dark navy appears only at contact
shadows, silhouettes, and UI**. Contrast comes from value (light buildings on textured grass), not neon.
Add small amounts of `ui-primary`/`ui-accent`/`ui-gold` as *functional* accents (status lights, signs).

**Current `tailwind.config.js`** only defines `bg/primary/accent/success`; V2 requires adding
`ui.*`/`w.*` tokens (a config change, listed in §J — not done in this planning phase).

---

## C. World composition and camera framing

**Projection (unchanged from 5H-1):** fixed **2:1 dimetric**, no rotation, tile `64×32`, depth `gx+gy`.

Composition changes vs 5H-2:
- **Fill the frame.** Move from a square 8×8 to a **district**: an irregular landmass (grass) with a
  concrete **central plaza**, bounded by foliage/water so there is no empty void. Camera crops the
  district so ground touches (or passes) all four viewport edges.
- **Horizon in the upper third.** Keep ground ambient/shadow top ~25–30% of the frame; no big dead sky.
  A subtle atmospheric band (light `w-glass`→`ui-void` vignette) sits behind, never a flat dark field.
- **Camera anchor:** hero (HQ) slightly left-of-centre and low; Server Farm right; expansion plots at
  the front-right and back-left edges; the main path leads from the bottom edge to the HQ entrance
  (guides the eye, invites touch).
- **Mobile:** portrait framing tightens around the HQ + front plots; the plaza and one plot always
  visible; pinch/drag reveals the rest. **Desktop (≥1024):** landscape framing shows the whole district
  with the HQ hero and room for the side card.
- **Layers (unchanged algorithm, richer content):** terrain → water → paths/plaza → plots → decor-back →
  buildings (depth-sorted) → decor-front → overlays (selection, FX) → HTML HUD.

---

## D. Building art specs

All buildings: 2:1 dimetric, **bottom-center anchor** at footprint centre, soft contact shadow + baked AO,
NW key light. Footprints below are in tiles; art shown at **2× (retina)** then scaled.

**Startup HQ** — hero. A modern glass tech campus.
- Silhouette: lifted central atrium (glass, `w-glass`) with two flanking wings (`w-wall`), a low
  podium/entrance with a canopy, rooftop garden + signage pylon.
- Level variants: **L1** single block + entrance; **L2** + side wing; **L3** + glass atrium + roof garden
  (footprint 3×3); **L4** + north wing, holo-sign, drones (footprint grows to 4×3); **L5** + sky bridge,
  terrace, animated holo-ring, light trails.
- Accent: `ui-primary` signage, `ui-gold` details.

**Server Farm** — industrial, cool teal.
- Silhouette: long low hall with banked cooling fins, rooftop AC banks, pipe runs, a glowing teal
  server-core strip along the facade.
- L1→L5: add a second hall, external chillers, cooling towers, cable trays, then a raised mezzanine.
- Accent: `ui-cyan` + `w-glass`; must stay distinct from AI Lab.

**AI Research Lab** — futuristic, violet.
- Silhouette: a glass **dome/observatory** on a plinth, floating hologram ring, side lab block.
- L1→L5: bigger dome, antenna array, holo-projectors, sky-lift pad, orbiting drone lights.
- Accent: `ui-accent`.

**Data Center** — long, low, calm, cyan coolant.
- Silhouette: wide reinforced slab, row of service doors, rooftop cooling loops, subtle cyan light band.
- L1→L5: extra bays, exterior coolant loops, redundant power hall, satellite uplink dishes.
- Unlockable (locked plot in the prototype becomes this).

Each spec ships as an **art sheet** (see §G) before production, with the L1 and L5 variants drawn together
so progression reads clearly.

---

## E. Materials, lighting, silhouettes, level variants

- **Materials:** matte painted walls (`w-wall`), semi-gloss glass (`w-glass` with a baked diagonal
  reflection), painted metal (`w-steel`), rubber/asphalt pads (`w-concrete`). No photorealism, no noise;
  flat-ish stylized shading with one highlight plane.
- **Lighting:** single key from **NW, high**, warm-neutral; top face brightest, camera-facing faces mid,
  shadow sides into `w-steel`/navy. **Baked** contact shadows (soft ellipse) + 1px dark base line so
  buildings "sit". A very light global vignette only at frame edges.
- **Silhouettes:** each building must be identifiable as a **black shape** at 96px height — test at
  thumbnail size. Differentiate by roofline (atrium vs fins vs dome vs slab), not by colour alone.
- **Level variants:** progression is *visual first*: footprint growth (documented steps), added volume,
  roof features, signage, greenery, then emissive accents + drones. Numbers in the HUD are secondary.
- **Plots:** grass default; available plot = concrete pad + survey stakes + holographic footprint ghost;
  locked plot = overgrown grass + fence/stakes + `ui-gold` lock tag. Never a bare neon diamond.

---

## F. Starter asset manifest (names, sizes, anchors)

Format: transparent **WebP** (primary) + **PNG** fallback; authored at 2×. Anchor = **bottom-center** of
footprint; every asset has metadata `{ id, footprint:{w,h}, anchor, sortOffset, bytes }`.
Path: `client/public/game/` (streamed, cacheable) with a JSON manifest; optional atlas in 5H-4.

**Buildings** (`bld_<type>_l<level>@2x.webp`)
| id | footprint | approx size @2x |
|---|---|---|
| `bld_hq_l1..l5` | 3×3 → 4×3 | 384×448 |
| `bld_server_l1..l5` | 2×2 → 3×2 | 288×288 |
| `bld_ailab_l1..l5` | 2×2 → 3×2 | 288×352 |
| `bld_datacenter_l1..l5` | 3×2 → 4×2 | 352×288 |

**Terrain / ground**
| id | footprint | size @2x |
|---|---|---|
| `ter_grass_a/b/c/d` (auto-tile) | 1×1 | 128×64 |
| `ter_grass_edge_n/e/s/w` | 1×1 | 128×64 |
| `ter_pad_concrete` | 1×1 | 128×64 |
| `ter_path_straight/corner/t/junction/end` | 1×1 | 128×64 |
| `ter_water_a/b` | 1×1 | 128×64 |

**Decor** (bottom-center anchor, 1×1 unless noted)
`env_tree_broad`, `env_tree_pine`, `env_hedge`, `env_bush`, `env_flowers`, `env_lamp_modern`,
`env_lamp_globe`, `env_bench`, `env_planter`, `env_crate`, `env_drone_pad` (2×2), `env_sign_holo`,
`env_stakes_survey` (1×1), `env_fence_seg`, `env_rock`.

**Plots / FX**
`plot_available_pad` (per footprint variant), `plot_locked_overgrown`, `fx_footprint_ghost`,
`fx_select_ring`, `fx_build_scaffold`, `fx_levelup_burst`, `fx_glow_soft`.

**HUD art**
`ui_frame_corner`, `ui_level_ring` (9-slice), `ui_xp_track`, `ui_energy_icon`, `ui_sp_icon`,
`ui_currency_icon`, `ui_build_thumb_*` (4), `ui_tab_*` (4).

Sizes are authoring guidance (±10%); keep power-of-two-ish for atlas packing. Budgets: total first-load
world art ≤ 2.0 MB; atlas ≤ 768 KB; single sprite ≤ 200 KB.

---

## G. Real illustrated sprite production pipeline

1. **Art sheets** (per building/decor): front iso reference, L1 & L5 variants, palette swatches, footprint,
   anchor, silhouette test at 96px.
2. **Creation:** commission or in-house (vector paint or raster). Sources 2×, transparent background,
   same camera as §C. **No unlicensed assets**; keep source files in a non-shipped `art-src/` folder.
3. **Export:** PNG 2× → trim → optimize (WebP q~80, PNG fallback) with a consistent naming scheme.
4. **Metadata:** JSON per asset (`id, footprint, anchor, sortOffset, bytes`) — the engine already consumes
   `footprint`/palette from `state.ts`; the sprite layer adds `image` + `anchor`.
5. **Atlas (5H-4):** pack related sprites into `game_<district>@2x.{webp,png}` (≤2048²) + `.json` atlas.
6. **Load/fallback:** manifest preload with skeleton; if an image 404s, render the existing vector fallback
   (`GameCanvas` primitive) so the app never breaks — the SVG we have becomes the **fallback**, not the art.
7. **Review gate:** every asset passes the silhouette test and the §I acceptance gate before integration.

Directory: `art-src/` (sources, git-ignored or LFS) → `client/public/game/` (shipped sprites + manifest).

---

## H. Desktop / mobile game HUD redesign

Principle: **the world is the interface.** Chrome is dark navy and minimal; content lives in the world.

**Shared**
- **Top HUD (floating over world):** player avatar + `ui_level_ring`, XP track, Energy, SP, Gold — compact,
  pill/segmented, `ui-panel` with 70–80% opacity + blur. A single `PREVIEW` tag.
- **Bottom build dock:** horizontal thumbnails (HQ/Server/AI Lab/Data Center + Decor) with costs; the
  active tool highlights. On mobile this scrolls; no dashboard cards.
- **Contextual building card:** appears on selection — art thumbnail header + level/state + one primary
  action (Build/Upgrade — disabled "Coming Soon"). Desktop: narrow right card (**280–320px, not 384**)
  with the art thumbnail filling its header so it feels game-like, not an empty form. Mobile: a
  **bottom sheet** above the global nav, ~40% height, swipe-dismissible.

**Desktop (≥1024)**
- World fills the area right of the global nav; HUD floats top-left; build dock bottom-centre; contextual
  card top-right. No `max-w-6xl` letterboxing for this view (full-bleed world area) — requires a
  full-width variant of the layout container (a small `Layout`/`GameHome` change in 5H-4, listed in §J).

**Mobile (360–767)**
- World is full-width and tall (≥55vh). Top HUD is a single compact row; build dock pinned above the
  bottom nav; contextual sheet slides from the bottom. Touch targets ≥44px.

**Navigation feel:** keep the global sidebar/bottom nav (auth, Market, Empire, Tasks, Profile) but restyle
active states as game chrome (`ui-primary` glow, rounded game tabs). Remove "Classic view" from the main
HUD (keep `/dashboard/classic` reachable by URL as the recoverable fallback).

---

## I. First visual acceptance gate

One **polished HQ drawn with final art** in a **coherent environment** must pass, at **360 / 768 / 1440**:
1. Frame is filled — no large empty dark regions; ground reaches all edges.
2. HQ reads as a real illustrated building (silhouette test at 96px passes); light materials, glass, canopy,
   roof detail visible.
3. Color balance: world dominates; dark navy only as framing/shadows; at least 4 world hues present.
4. Coherent ground: grass + concrete pad under HQ + a path leading to the entrance + ≥6 decor pieces + ≥1 plot.
5. Lighting consistent (NW key, baked shadows, one warm accent).
6. HUD floats over the world; contextual card is compact and shows the HQ thumbnail.
7. ≥30 fps floor on a mid mobile profile (static scene), no layout overflow at any breakpoint.
Only after this gate do we mass-produce the remaining buildings/environment.

---

## J. Implementation sequence (post-approval)

1. **Palette + tokens:** add `ui.*`/`w.*` to `tailwind.config.js` (world colors), keeping existing tokens.
2. **Art production:** produce the §I gate assets (HQ L1/L3/L5 + ground/path/decor set) via §G.
3. **Sprite integration (no Pixi yet):** extend `engine/state.ts` metadata with `image`/`anchor`; update
   `render/GameCanvas.tsx` to draw `<image href>` sprites with the existing depth sort; keep the current
   vector drawing as the **fallback**.
4. **Composition:** enlarge/crop the district, add water/plaza/edge foliage, relocate plots.
5. **HUD redesign:** floating top HUD + bottom build dock + compact contextual card (desktop) / sheet
   (mobile); full-bleed world container for the Home view.
6. **5H-4 (separate approval):** install PixiJS, adopt the atlas, add pan/zoom + subtle ambient motion.
7. **5H-5:** remaining buildings, L1→L5 variants, level-up FX, plot unlock visuals.

Each step is independently shippable and keeps `engine/` interfaces stable.

---

## K. Performance, accessibility, PWA constraints

- **Budgets:** first-load world art ≤ 2.0 MB; per-atlas ≤ 768 KB; sprite ≤ 200 KB; HUD DOM stays minimal.
- **Textures:** author 2×, cap canvas DPR at 2, prefer atlas batching (5H-4); lazy-load later districts.
- **Motion:** ambient loops (drones, holo, pulses) are `motion-safe` only; honor `prefers-reduced-motion`
  (already enabled in `index.css` for smooth scroll — extend the same discipline to world FX).
- **Accessibility:** world entities keep `role="button"`, `aria-label`, `aria-pressed`, keyboard select
  (Enter/Space), Esc to clear, visible focus ring; the selected building has a text equivalent in the
  contextual card (screen-reader friendly). Contrast: HUD text meets WCAG AA on `ui-panel`.
- **PWA:** sprites are static, cache-first via the existing Workbox config (extend `globPatterns` to
  `webp/png`); offline shows the shell + last district; manifest icons unchanged.
- **No regressions:** auth, router, CEO API, Empire/Tasks/Profile/Wallet/Landing untouched.

---

## Decisions (this phase)

- **Do** separate UI (dark navy) vs world (light, colorful) palettes.
- **Do** fill/crop the frame and build a district, not a grid-in-a-void.
- **Do** replace primitive vectors with **illustrated WebP sprites**; keep vectors only as fallback.
- **Do not** attempt to fix art with more polygons, gradients or neon outlines.
- Keep the 2:1 dimetric projection, depth-sort algorithm and `engine/` interfaces from 5H-1/5H-2.

## Required assets (immediate, for the §I gate)

`bld_hq_l1/l3/l5`, `ter_grass_a..d`, `ter_grass_edge_*`, `ter_pad_concrete`, `ter_path_straight/corner`,
`ter_water_a,b`, `env_tree_broad`, `env_tree_pine`, `env_hedge`, `env_lamp_modern`, `env_flowers`,
`env_stakes_survey`, `plot_available_pad`, `plot_locked_overgrown`, `fx_footprint_ghost`, `fx_select_ring`.

## Next step

Await approval, then execute §J steps 1–3 (palette tokens → gate art → sprite integration with vector
fallback). **No implementation starts before approval.**
