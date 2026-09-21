# Reference

Visual reference and direction material. **Not shippable assets.**

Anything in here exists to inform a decision — palette values, composition, gradient direction,
mood — and is not loaded by the running scene. Files here are deliberately *not* tracked in
`ASSETS.md`, which records only art that ships (see `BRIEF.md` §8).

Shippable art lives in `assets/`, mirroring `content/` structure, and is recorded in `ASSETS.md`
with its source and license at the time it is added.

Reference files may be any format and any resolution — vector, full-res mockups, photos, palette
swatches. They are not held to the 640×360 pixel density that `assets/` is.

---

## Naming convention

```
<scene>-<role>-layer<#>.svg
```

- **`<scene>`** — scene slug, matching the scene's id in `content/` (e.g. `salem-day`,
  `graveyard-night`).
- **`<role>`** — human-readable role, tracking the layer names in `BRIEF.md` §5.5
  (`sky`, `skyline`, `midground`, `foreground`).
- **`layer<#>`** — the 1–4 layer index from §5.5, back to front.

Scene-first sorts all of a scene's layers together and in back-to-front order, which is the
order they are composited and the order they are reviewed in.

**The layer number here is a convenience for humans, not a source of truth.** For art that
ships, layer assignment is declared in the scene's data file under `content/` — that is what the
engine reads. Keeping the index in the reference filename is useful redundancy; it must not
become the thing the loader parses, or layer assignment has leaked out of content and into the
filesystem.

---

## `salem-day` set — review notes (2026-09-20)

Reviewed as direction material. These are **M6** content; captured here so they are not
rediscovered later. None of it blocks M1.

**What is already right:** layer 2 is a clean solid silhouette in one warm family. The depth ramp
across layers is correct atmospheric perspective — distant layer 2 is lighter and warmer
(`#8C4732`), midground drops to `#221C1D`, foreground bottoms out near `#020201`. No strokes, no
opacity, no `fill="none"` anywhere across 1,442 filled paths, which is close to ideal input for a
pixel pipeline. Layer 4 masks three of the four window edges, which is the job §5.5 gives it.

**Follow-ups:**

1. **Geometry does not land on the grid.** Sky is 1024×572; layers 2–4 are 1024×585; 16:9 at
   1024 wide is 576. So the sky is 13px short of the others and does not register with them, and
   1024 is 1.6× of 640 — not an integer ratio, so a downsample resamples every edge. Re-export at
   640×360 native or a clean multiple (1280×720, 1920×1080, 2560×1440).
2. **Treat these as tracing reference, not as assets to downsample.** Downsampled vector art is
   anti-aliased small vector art, which collides with the nearest-neighbor invariant. Composition,
   palette and layer split carry over; the rasterization needs a hand at 640×360.
3. **Layers 3 and 4 are neutral greyscale** (layer 4 is literally R=G=B throughout) while layer 2
   and the sky are warm. Against a coral sky, neutral darks read as desaturated rather than
   backlit. A hue shift toward deep warm plum or brown, not a redraw — layer 2 already shows the
   target.
4. **Two details will not survive 640×360.** The cobblestone course along the bottom of layer 3
   becomes ~1px of noise and should probably go. Layer 3's window muntins land ~1px in a ~10×14px
   window — legible, but at the limit.
5. **Jack-o'-lantern faces in layer 4 are cut-outs, not fills.** Fine against a bright day sky;
   against a night sky they read as dark holes rather than glowing. §5.7 makes pumpkin eyes one of
   the few things permitted high-contrast detail, so they want a warm emitter fill.

**Bearing on open question 6** (does the silhouette style extend to daylight): this set is
evidence *for* the brief's proposed answer — layer 2's warm silhouette against the banded coral
sky works. Not treated as settled; it remains the owner's call at M6, and follow-up 3 should be
resolved before judging it.

---

## `graveyard-night` set — review notes (2026-09-20)

Authored art for the V1 scene, to be consumed at **M3.5**. Four layers, same naming convention.

| Layer | Content | Verdict |
|---|---|---|
| 1 `night-sky` | Smooth gradient `#071030`→`#302871`, cream moon `#FCF6EF`, 3 stars `#758BC2`, far hill `#1C0B3B` | Colours yes, gradient no |
| 2 `low-rollers` | Two paths, pale lavender `#B9BCF3` | Use directly |
| 3 `silhouette-panorama` | Tombstones, leaning crosses, wrought-iron gate. `#231533` + grey accents | Use directly — the big win |
| 4 `vignette-spooky-frame` | Gnarled tree, jack-o'-lanterns, mist. `#020202`, faces `#B5613A` | Flatten alpha first |

**Layer 3 is a large upgrade** on M1's placeholder rectangles, and `#231533` already sits in the
graveyard's purple family. Prioritise it.

**Layer 4 fixes the cut-out problem** flagged in the `salem-day` notes: the jack-o'-lantern faces
are filled with a warm emitter colour rather than left transparent, so they read as glowing
rather than as holes.

**Follow-ups:**

1. **The layer 1 gradient must not ship as art.** It is a smooth vertical gradient, and
   rasterising one at 640×360 produces exactly the banding §5.4 requires dithering to avoid — and
   which the engine already generates procedurally. Its value is the two stop colours becoming
   sky-ramp keys, replacing the invented night palette in `src/engine/palette.ts` with the
   authored one. The moon, stars and far hill ship separately as props.
2. **Layer 4 carries 159 distinct opacity values and 28 gradients** — the mist tendrils. Soft
   alpha ramps are the opposite of the flat nearest-neighbour idiom and will band and crawl at
   pixel scale. Flatten to a few alpha steps, or drop the mist and let drifting fog arrive as an
   M4 event instead. The silhouette underneath is sound.
3. **Geometry, again.** Layers 1-3 are 1024×572 / 1024×585; layer 4 is 1792×1024. None match each
   other, none are 16:9, none are an integer multiple of 640×360. Re-export all four at
   **1280×720**, which halves cleanly.
4. **Layer 2's brightness was reviewed and accepted.** At `#B9BCF3` the hills are the largest
   high-contrast area after the moon, which tensions with §5.7's "stay dark and desaturated
   overall so the window remains peripheral". The owner judged the composition — dark tombstones
   silhouetted against pale moonlit hills — worth it. Recorded so it is not re-raised as a defect;
   revisit only if it pulls the eye during M8's soak.
