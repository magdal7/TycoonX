# TycoonX — CEO Artwork Manifest

Local, owner-facing CEO portrait artwork for the eight existing tiers. Artwork is
**bundled with the client** (never fetched from a third party), so it works with
CSP `img-src 'self'` and PWA offline caching.

## Status

- **Locally bundled portraits: present and verified** for all eight active tiers.
- Served optimized JPEGs: `client/public/assets/game/ceos/*.jpg` (~25–37 KB each,
  512×768 portrait crop).
- Raw master PNGs archived (not served): `client/art-source/ceos/*.png`.
- The generated **SVG avatar** remains the fallback for any unknown/unmapped slug.

## Architecture

1. `client/src/lib/ceoArt.ts` maps each catalog slug (and marketing display-name
   alias) to its bundled portrait file. Unknown slugs resolve to `undefined`.
2. `CeoAvatar` (`client/src/components/CeoAvatar.tsx`) prefers, in order:
   explicit `imageUrl` (catalog), the bundled portrait for the slug/name, then
   the hand-drawn SVG avatar. Images use `loading="lazy"` / `decoding="async"`
   and fall back to the SVG if the file fails to load.
3. The server exposes `imageUrl` through `GET /api/ceos`,
   `GET /api/ceos/:id`, `GET /api/public/ceos`, and the owned-fleet response
   (`templateImageUrl`). Bundled art is used when `imageUrl` is empty.

## Manifest

| Tier | Slug | Rarity | Bundled file | Source master |
|---|---|---|---|---|
| Intern CEO | `intern-ceo` | Common | `intern.jpg` | `intern.png` |
| CEO 2 | `junior-developer` | Common | `junior-developer.jpg` | `junior-developer.png` |
| CEO 3 | `product-manager` | Common | `product-manager.jpg` | `product-manager.png` |
| CEO 4 | `marketing-director` | Rare | `marketing-director.jpg` | `marketing-director.png` |
| CEO 5 | `startup-founder` | Rare | `startup-founder.jpg` | `startup-founder.png` |
| CEO 6 | `ai-architect` | Epic | `ai-architect.jpg` | `ai-architect.png` |
| CEO 7 | `cloud-executive` | Epic | `cloud-executive.jpg` | `cloud-executive.png` |
| CEO 8 | `tech-billionaire` | Legendary | `tech-billionaire.jpg` | `tech-billionaire.png` |

## Generation / regeneration prompts

Shared style base (prepend to every prompt): *"Professional studio headshot of a
tech executive, upper body, centered, looking at camera, calm confident
expression, deep emerald-green (#091916–#122A25) seamless backdrop, soft key
light with subtle gold rim light, shallow depth of field, cinematic, premium
mobile-game character card, 512×768 portrait crop, no text, no watermark."*

| Tier | Character prompt |
|---|---|
| Intern CEO | young junior intern, early 20s, simple dark shirt, friendly eager expression |
| CEO 2 | junior software developer, late 20s, casual dark tee with lanyard |
| CEO 3 | product manager, early 30s, smart-casual shirt |
| CEO 4 | marketing director, 30s, tailored blazer |
| CEO 5 | startup founder, 30s–40s, blazer with open collar, driven expression |
| CEO 6 | AI architect, 40s, crisp dark suit, technical confidence |
| CEO 7 | cloud executive, 50s, premium dark suit |
| CEO 8 | tech billionaire, distinguished 50s–60s, luxury suit, subtle gold accents |

## Notes

- Artwork is presentation-only; it does not affect pricing, production, caps, or
  any economy parameter (Master Spec §10).
- The Admin catalog exposes an editable `imageUrl`; a non-bundled URL may be set
  there without code changes, and the bundled portrait is the fallback.
</content>
