# TycoonX — CEO Character & Brand Art Generation Pack

Status: **PROVISIONAL artwork pack.** The current bundled CEO portraits are placeholder-quality
professional headshots and are **not** final. This document is the production-ready specification for
generating the approved **Premium Illustrated Sci-Fi Tycoon** character set. Generation could not be
performed inside this environment; this pack is the handoff so an operator or asset pipeline can produce
consistent, original artwork. Until approved artwork exists, the app keeps the bundled placeholder
portraits and the SVG avatar fallback (see `CEO_ARTWORK.md`).

> Original fictional characters only. Do **not** depict real people or imply endorsement by any real CEO
> or company. Do not imitate a specific copyrighted game's distinctive identity.

## 1. Shared style base (prepend to every prompt)

```
Premium illustrated sci-fi tycoon character portrait, original fictional technology leader, upper body,
centered, three-quarter turn to camera, confident expression, strong readable silhouette, deep emerald
gradient backdrop (#091916 to #122A25) with subtle volumetric light, cinematic key light with restrained
gold rim light (#D4AF65), emerald accent palette (#10B981 / #14B8A6), rich painted materials, collector
card character art, clean edges, shallow depth of field, premium mobile-game character card, 3:4 portrait
crop, consistent eye-line at ~38% from the top, no text, no watermark, no logo.
```

**Aspect / crop:** 3:4 portrait. Head occupies ~34% of frame height; feet/hands may crop. Reserve the
bottom ~22% for the name/rarity band (kept visually calm).

## 2. Negative constraints (always apply)

```
no photorealistic stock-photo look, no corporate headshot, no necktie-office cliché alone,
no childish cartoon, no chibi, no excessive neon, no heavy bloom/glow, no cluttered gradients,
no distorted anatomy, no extra fingers/limbs, no duplicated faces, no inconsistent lighting between
characters, no real logos, no brand marks, no real people, no political symbols, no text/watermark,
no collage or split-panel, no weapons.
```

## 3. Character bible & prompts

Tier order is the **prestige arc**: ambitious newcomer → confident builder → organized strategist →
charismatic growth leader → determined entrepreneur → visionary technologist → powerful infrastructure
leader → legendary empire leader. Rarity drives frame material and glow, not the drawing style.

| # | Tier | Slug | Filename (served) | Master (archived) |
|---|---|---|---|---|
| 1 | Intern | `intern-ceo` | `intern.avif` / `intern.webp` / `intern.jpg` | `intern.png` |
| 2 | Junior Developer | `junior-developer` | `junior-developer.*` | `junior-developer.png` |
| 3 | Product Manager | `product-manager` | `product-manager.*` | `product-manager.png` |
| 4 | Marketing Director | `marketing-director` | `marketing-director.*` | `marketing-director.png` |
| 5 | Startup Founder | `startup-founder` | `startup-founder.*` | `startup-founder.png` |
| 6 | AI Architect | `ai-architect` | `ai-architect.*` | `ai-architect.png` |
| 7 | Cloud Executive | `cloud-executive` | `cloud-executive.*` | `cloud-executive.png` |
| 8 | Tech Billionaire | `tech-billionaire` | `tech-billionaire.*` | `tech-billionaire.png` |

**1. Intern — ambitious newcomer.** Young, slight build, oversized dark hoodie, lanyard, paper coffee cup,
sticky-note-covered desk edge. Candid lean-in, eager grin, bright eyes. Mint accent light, single gold pin.
*Silhouette:* rounded, forward-leaning.

**2. Junior Developer — confident builder.** Hoodie with headphones around the neck, mechanical keyboard on
the desk, dual-monitor glow behind. Arms crossed, knowing smirk. Teal accent. Two gold pins.
*Silhouette:* relaxed but squared shoulders.

**3. Product Manager — organized strategist.** Smart-casual shirt, tablet and stylus, roadmap/kanban wall
behind. Half-turn presentation pose, poised. Emerald accent. Engineer-ID badge upgrade.
*Silhouette:* upright, one hand presenting.

**4. Marketing Director — charismatic growth leader.** Tailored blazer, ring light and rising analytics arcs
behind. Pointing up at a growth curve, warm confident smile. Amber/gold accent. Statement watch.
*Silhouette:* dynamic diagonal.

**5. Startup Founder — determined entrepreneur.** Rolled sleeves, well-worn blazer, garage-to-boardroom
energy. Mid-stride, determined. City skyline at dawn behind. Sunset-to-emerald rim light. Founder jacket.
*Silhouette:* motion, one hand in pocket.

**6. AI Architect — visionary technologist.** Monochrome techwear, holographic schematic lattice orbiting one
hand. Calm, hands framing a neural lattice. Lab with cyan volumetric light. Cyan accent. Halo HUD.
*Silhouette:* still, symmetric, futuristic.

**7. Cloud Executive — powerful infrastructure leader.** Premium tailored suit, data-center aisle behind, a
globe of glowing nodes. Composed, hands clasped. Cool emerald light. Platinum/emerald. Commemorative lapel.
*Silhouette:* grounded, authoritative.

**8. Tech Billionaire — legendary empire leader.** Bespoke suit with subtle gold circuitry, penthouse
panorama crowning the frame, signet and orbit-ring motif. Serene authority, chin slightly up. Rich gold
accents. *Silhouette:* regal, widest presence.

## 4. Formats, sizes & performance budgets

- Served: **AVIF** (primary) + **WebP** (fallback) + **JPEG** (last resort). Keep all three for maximum
  compatibility; `CeoAvatar` currently serves JPEG and will switch to the preferred format once generated.
- Display crops: master portrait **768×1024**, served **512×683** and a small **160×213** avatar variant.
- Budgets: portrait ≤ 90 KB (AVIF), ≤ 160 KB (WebP), ≤ 220 KB (JPEG); avatar variant ≤ 25 KB.
- Backgrounds: **opaque emerald** (no alpha needed) for cards; a transparent-background master may be kept
  in `client/art-source/` for marketing compositing.
- Vector branding/frames stay SVG.

## 5. Consistency workflow

1. Lock the shared style base + palette + silhouette rules (section 1–3).
2. Generate **Intern** and **Tech Billionaire** first as the style anchors (the arc extremes).
3. Review each against: style coherence, anatomy, distinct identity, card readability at 160px, framing,
   color coherence, originality (no real-person likeness).
4. Generate the remaining six using the approved anchors as image references for continuity.
5. Optimize (AVIF/WebP/JPEG), register filenames, and run `npm run validate:assets --prefix client`.

## 6. Integration

- Files land in `client/public/assets/game/ceos/`; the mapping lives in `client/src/lib/ceoArt.ts`.
- `CeoAvatar` already prefers catalog `imageUrl`, then the bundled portrait, then the SVG fallback, and
  degrades gracefully on load error — so replacing files requires **no code change**.
- Artwork is presentation-only and never affects pricing, production, caps, or any economy parameter
  (Master Spec §10).

## 7. Brand marks

The approved logo is the **TX rising technology tower** (see `client/src/components/Logo.tsx`,
`client/public/icon.svg`, `client/public/favicon.svg`; PWA PNGs are generated by
`client/scripts/generate-icons.mjs`). Optional marketing variants (stacked lockup, monochrome, inverted,
social 1200×630) are not yet produced and should follow the same emerald/gold system.
