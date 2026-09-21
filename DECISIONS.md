# Decisions

Running log of choices made between milestone gates, with the reasoning. Newest first.

See `BRIEF.md` §4 for decisions that were locked before implementation started, and §9 for
questions still open.

---

## 2026-09-20 — Motion vocabulary is engine-owned, parameters are content-owned

**Settled by the owner, 2026-09-20: adding a motion kind is an engine primitive, not a missing
abstraction.** Raised because CLAUDE.md instructs stopping when a scene needs engine code; ruled
that the rule targets scene-*specific* special cases, not new generic capability. No further ask
needed before adding kinds.

`src/types/motion.ts` defines a **closed** set of motion kinds (`linear`, `drift`). Content picks
a kind and supplies its numbers; the engine owns which kinds exist. Adding a genuinely new *kind*
of motion is an engine change.

**Why this is the right split.** §5.3 frames motion as a "motion vocabulary" — linear
trajectories across a flat X-plane, sine offsets, noise offsets — not as an open extension point.
A vocabulary is a closed set by definition. The alternative is content supplying behaviour as
code, which `CLAUDE.md` forbids outright ("Declarative only, no logic") and which would make
scene files unreviewable.

**Why it was flagged.** `CLAUDE.md` says "a new scene must be addable with changes only under
`content/` and `assets/`", and instructs that needing engine code means a missing abstraction. A
scene wanting motion outside the vocabulary *does* touch the engine.

**The ruling.** Motion kinds are engine primitives, in the same way the renderer's shape
primitives are. The rule exists to keep scene-specific special cases out of the engine — an
`if (scene === 'graveyard')` — not to forbid new generic capability that any scene can use.

**The alternative, rejected.** A composition system letting content assemble motion from building
blocks (a sine term, a noise term, a ramp, summed) would remove the engine change entirely. It
was rejected because it makes content files substantially harder to read and review, and amounts
to logic-in-content by another name, which CLAUDE.md rules out elsewhere. The cost of being wrong
here is a refactor of two small files, which does not justify the complexity up front.

**Practical consequence.** Adding a scene: content only. Adding an event that reuses existing
motion: content only. Adding an event needing novel motion: one engine addition, then content.
M4's bat-swarm noise offsets and M6's walk cycles are the next two cases that will test it.

## 2026-09-20 — Time Broker and Director

M2. See BRIEF.md §5.2 and §5.3.

### Two clocks, deliberately independent

`dayPhase` (continuous) drives colour. `timeBlock` (named) drives selection — which events are
eligible, and which scene once rotation arrives. §5.2 is emphatic and the reason is concrete:
drive colour from the block and the sky changes in a visible jump at 16:30 every day.

**The Director is paced by real elapsed time, not day-phase time.** Running the broker at 120x to
inspect a sunset must not also make bats swarm at 120x, or there is no way to judge pacing while
scrubbing. Verified: 20 wall seconds at rate 120 advanced 0.67 simulated hours and produced 1
spawn, which is right for an 18-second mean interval in real time.

### The clock is read in exactly one place

Enforced and checked: `grep` for `Date.now()`/`new Date()` outside `time-broker.ts` returns
nothing. The broker polls once a second rather than every frame — ample for a value moving
1/86400 per second, and it keeps the per-frame path free of clock calls.

Override is three controls rather than one: `scrubTo(hours)` positions, `setRate(0)` freezes,
`setRate(n)` runs fast. Overridden time advances from the frame delta, never from the clock, so
`rate: 0` is a true freeze and any other rate is reproducible.

### A floating-point bug worth remembering

The idiom `((x % p) + p) % p`, used to normalise cyclic values, **loses precision**. For
`dayPhase = 5/24 = 0.20833333333333334` it returns `0.20833333333333326` — one ULP smaller. That
was enough for 05:00 to fail `>= from` on its own `sunrise` window and fall through to `night`'s
wrapping window: the wrong event pool, for one instant, once a day, from a rounding error.

Replaced everywhere by `wrap()` in `src/types/time.ts`, which touches the arithmetic only when
the value is actually negative and so returns in-range values bit-identical. Four call sites had
the bug. Verified: all 14 boundary cases pass, and a 1440-minute sweep tiles §5.2's table exactly
(night 660, day 630, sunset 90, sunrise 60) with nothing thrown.

### Scheduling

Intervals are exponentially distributed, never a fixed grid — §5.3 warns that rolling dice on a
grid feels quantised even with random outcomes. Measured over two simulated hours: 289 spawns,
gaps from 0.03s to 114s, coefficient of variation 0.75. A fixed grid would be ~0.

The observed mean gap (24.8s) exceeds the configured 18s because a scheduled attempt that finds
nothing eligible redraws its interval and skips rather than queueing. That is intentional: the
alternative is a burst the instant eligibility returns. It does mean **`meanSpawnIntervalSeconds`
is a floor on spacing, not the achieved average** — worth knowing when tuning pacing at M4.

Verified: eligibility (600s in `day` produced 0 spawns, as neither event lists that block),
per-event and global concurrency caps (peak 3 against a cap of 4, 0 violations), `trigger()`
refusing an over-cap spawn and an unknown id, and **zero leaked display objects across 150
spawn/retire cycles** on all four layers.

### Known gap: only the sky responds to time

§5.2 wants "sky tint, ambient light level, and window glow" all interpolating. Only the sky ramp
does. Props are static, so scrubbing to midday leaves stars visible against a bright sky and the
mausoleum window lit at noon. Not built because M2's scope is the broker and the director, and
§7 puts sunset/sunrise interpolation at **M7**. Flagged so it is not mistaken for finished.

## 2026-09-20 — Camera drift: triangle wave, quantised globally, backdrop factor raised

Prompted by review feedback at the M1 gate: "the drift back and forth is a little jumping,
making the parallax effect look strange."

**Two of these changes deviate from `BRIEF.md` and need explicit sign-off** — flagged below.

### Diagnosis

A layer's offset must round to a whole virtual pixel, so a layer never moves continuously: it
holds a position, then steps one pixel. What the eye reads as smooth or jumpy is the
**regularity of that step cadence**. Three faults compounded, all measured over one drift period:

1. **The backdrop was not parallaxing at all.** At factor 0.08 x 12px amplitude its entire travel
   was ±0.96px, rounding to three positions. It held still for 5.5-10.2 seconds, jumped a pixel,
   and held again — while the foreground took 48 steps. Not depth; a twitch.
2. **The sine stalled at its extremes.** A sine spends most of its time where velocity approaches
   zero. Foreground dwell between steps ranged 0.40s to 2.87s — a 7.2x swing. Glide, stall, lurch.
3. **Layers stepped at different *moments*, not just different rates.** Rounding each layer from a
   continuous drift means the foreground steps when the drift crosses k+0.5 while the midground
   steps when it crosses odd integers. Those instants never coincide. Measured: 140 step events
   per period, every one an isolated single-layer shift — about 4.5 independent twitches per
   second scattered across the scene.

### Changes

| | Before | After |
|---|---|---|
| Waveform | sine | **triangle** (constant speed) |
| Amplitude | 12px | **20px** |
| `backdrop` parallax | 0.08 | **0.25** |
| Layer offset derived from | continuous drift | **globally quantised** drift |

### Results, same measurement

| | Before | After |
|---|---|---|
| Cadence irregularity (foreground) | 7.2x | **1.1x** |
| Backdrop distinct positions | 3 | **11** |
| Step events per period | 140 | **80** |
| Of those, multi-layer (coherent) | 0 | **60** |

### Why each

**Triangle over sine (deviates from §5.6).** Constant speed makes every step evenly spaced, so
the motion reads as a slow continuous glide instead of a stall-and-lurch. The turnaround is a
velocity discontinuity in principle, but at ~2.5px/s it is imperceptible — far less visible than
the stall it replaces. `waveform` is a config field and `sine` is retained, so the brief's
proposal stays directly comparable from the M3 panel rather than being quietly overruled.

**Backdrop 0.25 (deviates from §5.5's 0.05-0.1).** This floor is arithmetic, not taste: a layer
needs `amplitude x factor` to be a healthy number of whole pixels before it can glide. The
brief's range was written without accounting for pixel quantisation. Anything under ~0.15 cannot
move convincingly at any amplitude this project can afford, so the real choice is a raised factor
or a deliberately static backdrop. Raised, because a static backdrop throws away a depth plane.
Cost: a compressed depth spread — less dramatic parallax, but coherent, which matters more.

**Quantising the global drift before applying parallax.** A layer offset derived from an integer
can only change when that integer changes, so layers step *together* in a nested rhythm. This is
what halved the event count and made 75% of shifts coherent. `Math.round` was chosen over
`Math.floor` by measurement: floor produces true three-layer nesting but twice as many isolated
single-layer twitches (40 vs 20), which is the thing being eliminated.

### Consequence for content

Overscan is now sized against `amplitude x parallax`. At 20px amplitude the foreground swings
±20px, and the original ±20px overscan was exactly flush — correct on the day and broken the
moment the M3 slider moves. Foreground art now overscans to x=-48/688, backdrop and midground to
-32/672, verified to expose no bare canvas at either extreme at up to 40px amplitude. The rule is
recorded in `src/types/prop.ts`.

**Still open.** Amplitude and period remain open question 7, deferred to M3 and M8. This change
addresses the *character* of the motion, not its magnitude.

### Addendum, same day: residual judder is a quantisation floor

Reviewed again after the fix — "looks better, still a bit jumping, but tolerable." Accepted as
tolerable for M1, but the residual should not be mistaken for something tuning will fix.

Offsets step in whole virtual pixels. At 20px amplitude over 31.4s the foreground travels
2.55 px/s, so it makes about 2.5 one-pixel shifts per second — each 4 screen pixels at 4x on a
1440p 27". Motion fuses into apparent continuity somewhere above ~10-15 px/s, which at this
amplitude needs roughly a 7-second period: well past ambient and into distracting. **No
combination of amplitude and period within "microscopic drift" removes it.** Tuning relocates
the judder; it cannot eliminate it.

Three paths, none to be settled before M4:

1. **Accept it.** One-pixel camera steps are idiomatic in pixel art.
2. **Raise amplitude** until steps are frequent enough to read as motion — trades calm for
   smoothness, in the direction §5.6 warns about for long sessions.
3. **Reconsider whether camera drift is the right instrument.** Most likely the right answer.
   §5.6 wants drift because it "keeps the scene from looking frozen while idle" — but M4 adds
   fog, falling leaves, drifting ghosts, bats and a flickering lantern. Once genuine ambient
   motion exists, the drift is doing redundant work while contributing the only *unpleasant*
   motion in the frame. Taking amplitude toward zero at M4 may beat every non-zero setting.

**Revisit at M4**, once there is real ambient motion to compare against. Judging drift in a
still scene overstates how much work it needs to do.

## 2026-09-20 — Lifecycle: per-owner teardown, not a cascade

Taken during M1 implementation, after a teardown bug. Worth recording because the alternative is
superficially tidier and will keep looking tempting.

**Rule: whatever creates a display object or texture destroys exactly that, and nothing else.**
`buildScene` destroys its props. `createSky` destroys its quad and filter. `createLayers`
destroys the four containers but *not* their children. `createStage` destroys the world container
and the renderer.

**What this replaced.** The first cut cascaded: props were destroyed by the scene instance, then
again by `layers.destroy({ children: true })`, then again by
`app.destroy(true, { children: true, texture: true, textureSource: true })`. Triple ownership.
It also destroyed *shared globals* — `Texture.WHITE` backs every solid Graphics fill — which
would break anything outliving one renderer, exactly what M7's scene rotation is.

**Why per-owner wins.** A blanket sweep at the top papers over missing ownership lower down: it
makes leaks invisible during single-scene work and then fails when scenes start being built and
torn down repeatedly mid-run. Cascade also cannot express "this resource is shared." §5 of
CLAUDE.md already states the rule per-event; this generalises it to every module.

**Related change.** The sky's gradient quad is a `Graphics`, not a `Sprite(Texture.WHITE)`.
Holding the shared white texture entangled this module's teardown with the renderer's for no
benefit — the filter ignores the quad's colour entirely.

**Known benign warning.** Destroying the *renderer* emits two PixiJS warnings about a
`textureSource`/`textureSampler` "destroyed while still bound to a shader". Bisected to
`app.destroy()` itself, firing after every resource this project owns is already released; it
does not reproduce in a minimal app with either a built-in or an equivalent custom filter. The
cause is PixiJS's filter system leaving the last frame's pooled render texture bound. It clears
only after PixiJS's texture GC runs (~600ms of frames), which a synchronous teardown cannot
guarantee, so `dispose()` is not contorted around it. Currently reachable only on page unload.
**Recheck at M7**, where scene rotation begins — rotation swaps scenes without destroying the
renderer, so it should not hit this path, but that assumption should be verified rather than
trusted.

## 2026-09-20 — Toolchain: Vite + TypeScript + pixi.js

Approved under the brief's "ask before adding any dependency" guardrail (§8). Three direct
dependencies, two of them dev-only:

| Package | Kind | Why |
|---|---|---|
| `pixi.js` | runtime | Named in §4 as the expected footprint |
| `vite` | dev | Dev server with HMR, integer-friendly static build |
| `typescript` | dev | Locked in §4 |

**Why a bundler at all.** The alternative considered was no bundler — ES modules from a CDN plus
`tsc`. Fewer moving parts, but no hot reload, and iterating on a scene's *feel* without it is
slow. M3 exists precisely because judging feel needs fast iteration, so HMR earns its place.

**What stays out.** Simplex noise is inlined per §5.3 rather than installed. The Bayer dither is
inlined GLSL. Neither adds a package. Anything beyond this table needs a fresh ask.

## 2026-09-20 — Sky architecture: procedural dithered gradient + authored cloud sprites

**Resolves the M1 sky question.** Not an open question in the brief; surfaced while scoping M1
and settled after reviewing the `salem-day` reference layers.

The sky is built in two parts:

1. **Base gradient — procedural.** A small custom Pixi filter doing ordered (Bayer 4×4)
   dithering, with the gradient stop colors as uniforms. Runs at virtual resolution, so the
   dither cells land on the 640×360 pixel grid rather than on output pixels. M1 passes it fixed
   night colors; M2 drives the same uniforms from `dayPhase` with no engine change.
2. **Cloud striations — authored sprites.** Lifted off the sky art as separate sprites
   composited over the gradient, tinted from the same `dayPhase` value, drifting slowly
   horizontally.

**Why the hybrid.** Two alternatives were considered. Fully procedural interpolates perfectly but
discards the authored cloud character and leaves the sky generic. Fully authored — banded art per
time block, crossfaded — preserves the look exactly but reintroduces the threshold flip that
§5.2 explicitly rules out ("a gradual shift rather than a switch flipping at a threshold"), and
multiplies art across every time block × every scene.

The hybrid is the only option that keeps both the continuous-time requirement and the authored
character. It also buys motion the sky otherwise lacks: layer 1 has parallax factor 0, so
nothing else animates it, and slowly drifting clouds cost almost nothing.

**What the reference art contributed.** The `salem-day` sky is already hard-banded across nine
flat colors, with deliberate speckling along the band boundaries — hand-dithering. The authored
taste already points at ordered dithering, which is what §5.4 requires anyway. The single
`linearGradient` in that file is a decoy: its coordinates run y 629→871, outside the 572-tall
viewBox.

**Consequence.** The dither filter is a custom inlined GLSL shader — no dependency, consistent
with the brief's preference for inlining small utilities over installing them. It is engine code
and must stay scene-agnostic: colors and cloud sprites arrive from content, never hardcoded.

## 2026-09-20 — Wake lock and fullscreen entry: click-to-begin overlay

Not an open question in the brief; surfaced while scoping M1.

**Constraint (browser, not a choice).** The Screen Wake Lock API and the Fullscreen API both
require a user activation, so neither can be acquired on page load. Something must be clicked
before the display is held awake. For a product whose pitch is passive ambient decoration, that
affordance becomes the first thing seen on every reboot or tab reload.

**Decision.** A full-bleed click-anywhere-to-begin overlay, in palette, over the already-running
scene. Reviewed against two alternatives — start without wake lock until an incidental click, and
a small permanent corner control. Both were acceptable to the owner; the overlay was chosen.

**Why.** The scene renders behind the overlay, so the first thing on screen is the artwork rather
than a splash. One click at boot buys a display that reliably stays awake, versus the silent
degradation of deferring the lock. And it leaves no permanent chrome, which matters in a scene
whose foreground layer exists specifically to hide its own edges (§5.5).

**Folded in from the alternative.** Pressing Esc exits fullscreen, and re-entry needs a fresh
gesture. Rather than carry a permanent affordance for that, the overlay re-shows when fullscreen
is exited or the wake lock is lost (it is released automatically when the tab is backgrounded).
The overlay therefore does the corner control's job without the corner control existing.

## 2026-09-20 — Base resolution: 640×360

**Resolves `BRIEF.md` open question 1.** Supersedes the brief's lean toward 320×180.

The virtual canvas is **640×360**, upscaled by an integer factor (4× to 1440p, 8× to 5K,
3× to 1080p, 6× to 4K). All sprite art is authored at this density.

**Why, primarily: the pixel grid sets the slowest possible motion.** Sprite positions round to
whole virtual pixels, so frame width ÷ crossing duration *is* the step size — there is no
sub-pixel smoothing available to soften it. A ghost drifting across the frame over 40 seconds
steps every 125ms at 320×180 versus every 62ms at 640×360. At 8× on a 27" 1440p display one
virtual pixel is roughly 1.9mm on glass, so the coarser grid turns slow drift into something
that visibly teleports several times a second. Slow ambient motion is the product, not a detail.

**Secondary reasons:**

- **Parallax granularity.** Layer 2 sits at factor 0.05, so global drift must reach 20px before
  that layer moves a single pixel. At 320×180 that is 6% of frame width — far past "microscopic,"
  forcing a choice between a distant layer that never moves and a drift too large to be ambient.
  640×360 halves the tension and doubles the stepping granularity on the midground action plane
  (factor ~0.5), which is where the eye actually rests.
- **Light emitters need pixels to read as light.** "High-contrast detail is reserved for light
  emitters" (§5.7) is what makes the aesthetic work. At 320×180 a lit window is ~2×3px and a
  pumpkin eye ~2×2 — no room for the falloff that separates "emitting light" from "brightly
  colored rectangle."

**What this costs.** 320×180 has more character and genuinely suits the silhouette style, and it
is 4× less pixel area to author. For solid silhouettes the effort scales well below area (an
outline and a fill, not rendered texture), so the real cost is estimated at 1.5–2× the art work,
not 4×. Accepted. If the composition were static, 320×180 would have won; motion decided it.

**Consequence.** Base resolution lives in one place as a constant. Mixed pixel densities are the
most common way a pixel scene looks wrong (§5.4), so every asset added from here is checked
against this density at the time it lands.
