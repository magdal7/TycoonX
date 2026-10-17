# TycoonX — Game Art Pipeline

**Phase:** 5H-3B (pipeline preparation — no artwork supplied yet)
**Companion:** `docs/TYCOONX_ART_DIRECTION_V2.md` (look & composition), `docs/ISOMETRIC_VISUAL_PLAN.md`
(projection, architecture, renderer).

This documents how to drop professionally illustrated isometric sprites into TycoonX. The final artwork
will be supplied separately; until then the game renders the **vector fallback** and the validator reports
the missing files as **expected**.

---

## 1. Folder structure

```
client/public/assets/game/
  buildings/     bld_<type>_l<level>@2x.webp (+ .png fallback)
  terrain/       ter_grass_*, ter_path_*, ter_pad_concrete, ter_water_*
  environment/   env_tree_*, env_lamp_*, env_bush, env_hedge, ...
  plots/         plot_available_pad, plot_locked_overgrown
  effects/       fx_*
client/scripts/validate-assets.mjs
client/src/game/render/spriteManifest.json     (data)
client/src/game/render/spriteManifest.ts       (types + lookups)
client/src/game/render/featureFlags.ts         (render toggle)
```

Folders are tracked with `.gitkeep`. Sprites are served from `/assets/game/<category>/<file>` (static,
cacheable by the PWA).

---

## 2. Sprite manifest

Single source of truth: `client/src/game/render/spriteManifest.json`, typed by `spriteManifest.ts`.

```
SpriteEntry {
  id          unique key used by the game      e.g. "bld_hq"
  category    buildings|terrain|environment|plots|effects
  file        default sprite file              "bld_hq_l1@2x.webp"
  width       intrinsic px (2x)                384
  height      intrinsic px (2x)                448
  footprint   { w, h } in isometric tiles      { w: 3, h: 3 }
  anchor      "bottom-center" | "center"
  available   false until the art is delivered/verified
  variants[]  optional: { id, file, width, height, footprint, level? }
}
```

- **Buildings** use `variants` for level art (`level: 1..5`); each variant may change **footprint**
  (e.g. HQ grows 3×3 → 4×3 at L4). The renderer picks the variant by building level.
- **Terrain** (grass) uses `variants` for auto-tile alternates (a/b/c/d).
- **available** is the gate: while `false`, the renderer keeps the vector fallback and the validator
  treats a missing file as *pending* (not an error). Set `available: true` only once the file exists and
  passes verification.

---

## 3. Render toggle (feature flag)

`featureFlags.ts`:
```
export const FEATURE_FLAGS = { imageSprites: import.meta.env.VITE_USE_SPRITES === 'true' }
```
- Default **off** → vector fallback everywhere (current state, no art required).
- Enable per environment: `VITE_USE_SPRITES=true npm run dev` / `build`.
- `GameCanvas` renders an `<image>` sprite only when the flag is on **and** the manifest entry is
  `available` and a file decodes; an `onError` handler falls back to the vector drawing for that entity.
  **Missing assets are never silently substituted with fake art** — they stay vector and are reported.

---

## 4. Import requirements (contract for the artist)

- **Format:** transparent **WebP** primary, **PNG** fallback (same basename, `.png`). True transparency,
  no matte/baked background.
- **Perspective:** strict **2:1 dimetric**, same camera as the game (no rotation). A 1-tile surface is
  authored **128×64 px** (2×); the engine draws at 64×32, so sprites scale by **0.5**.
- **Scale:** author at **2×**. Keep a consistent height ruler: 16 px (2×) per half-tile rise.
- **Anchor:** `bottom-center` at the **footprint centre** (ground contact). Terrain tiles use `center`.
  Document any sprite whose visible base differs so `sortOffset` can be tuned.
- **Lighting:** single key from **NW, high**; baked contact shadow included; no scene-wide vignette.
- **Naming:** `bld_<type>_l<level>@2x.<ext>`, `ter_<name>@2x.<ext>`, `env_<name>@2x.<ext>`,
  `plot_<name>@2x.<ext>`, `fx_<name>@2x.<ext>`.
- **Silhouette test:** each building must be identifiable as a black shape at ~96 px height.

---

## 5. Compression & budgets

- Export from 2× sources; trim transparent margins (keep a small uniform pad).
- WebP quality ~80 (`cwebp -q 80 -alpha_q 100`); PNG fallback via `oxipng`/`pngquant`.
- Budgets: single sprite ≤ **200 KB**; first-load world art ≤ **2.0 MB**; optional atlas ≤ **768 KB**.
- No remote images. All assets are local and cache-first (extend the PWA `globPatterns` with
  `webp`/`png` when the first sprites land).

---

## 6. Verification

Run:
```
npm run validate:assets --prefix client
# or: node client/scripts/validate-assets.mjs
```
The script (`client/scripts/validate-assets.mjs`, no dependencies):
- checks every referenced file exists under `client/public/assets/game/<category>/`;
- reads intrinsic **PNG** and **WebP** dimensions from file headers and compares to the manifest;
- reports: files present, **pending (not supplied)**, **missing (required)**, **dimension mismatches**;
- **exit 0** while artwork is simply not delivered yet (`available:false` + missing);
- **exit 1** if a sprite is marked `available:true` but missing, mis-sized, or a category folder is absent.

Expected current output: a **pending** count equal to the manifest file count and `RESULT: OK`.

Manual spot-checks: open a sprite next to a neighbour to confirm shared perspective/scale; verify
transparency in an image viewer; confirm the on-screen footprint matches the grid.

---

## 7. First visual acceptance gate

Before mass-producing the rest, deliver and review this minimal coherent set:
**one polished HQ + grass ground + a path + trees + a believable district.**
Pass criteria (at 360 / 768 / 1440):
1. HQ reads as real illustrated architecture (silhouette test passes; light materials, glass, canopy).
2. Frame is filled — grass reaches the edges; no large empty dark regions.
3. Ground: grass + concrete pad under the HQ + a path to the entrance + ≥6 decor pieces + ≥1 plot.
4. Consistent 2:1 perspective, shared scale, NW lighting, baked shadows.
5. World palette dominates; dark navy only frames the UI.
6. `npm run validate:assets` → all gate sprites present and correctly sized.
Turn the flag on (`VITE_USE_SPRITES=true`) and verify the world at all breakpoints; only then produce the
remaining buildings/environment.

Gate assets: `bld_hq_l1/l3/l5`, `ter_grass_a..d`, `ter_grass_edge_*`, `ter_pad_concrete`,
`ter_path_straight/corner`, `ter_water_a/b`, `env_tree_broad`, `env_tree_pine`, `env_hedge`,
`env_lamp_modern`, `env_flowers`, `env_stakes_survey`, `plot_available_pad`, `plot_locked_overgrown`,
`fx_footprint_ghost`, `fx_select_ring`.

---

## 8. Status

- Pipeline, manifest (60 sprites / 4 terrain auto-tiles), validator and optional image rendering: **ready**.
- **No artwork has been delivered yet.** The validator reports all files as *pending* (expected) and the
  game continues to use the vector fallback. Visual completion is **not** claimed until the §7 gate art is
  produced, validated and reviewed.
