# Assets

Source and licence for every piece of art that ships, recorded at the time it is added
(`BRIEF.md` §8). No exceptions — an asset with no row here cannot be shipped.

---

## Status: no shipped assets yet

M1's graveyard is built from **declarative shapes in `content/scenes/graveyard-night.ts`** —
polygons, rects and circles referencing palette tokens — not from image files. `assets/` is
therefore empty and this table is deliberately blank rather than missing.

That was a deliberate choice for M1: it keeps the scene addable as pure data, needs no binary
files, and sidesteps licensing entirely for placeholder work. `§6` permits colored rectangles for
V1 placeholder art.

## Table

| File | Scene / layer | Source | Licence | Added |
|---|---|---|---|---|
| *(none yet)* | | | | |

---

## Not assets

`reference/` holds direction material — the `salem-day` SVG layers, palette studies — which is
**not** loaded by the running scene and is intentionally absent from the table above. See
`reference/README.md`.

## When real art lands

- Author at 640×360 density, or at a clean integer multiple. See `DECISIONS.md` on base
  resolution, and `reference/README.md` on why downsampled vector art is not pixel art.
- A `sprite` prop kind will need adding to `src/types/prop.ts`; the switch in
  `src/engine/scene-builder.ts` is exhaustive and will fail to compile until it is handled.
- Nearest-neighbour is applied globally via `TextureSource.defaultOptions` in `stage.ts`, so
  individual textures need no per-asset configuration.
