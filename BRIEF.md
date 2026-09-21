# Halloween Ambient Scene — Project Brief

*Last updated: 2026-09-20*

---

## 1. Why

A warm, cozy, spooky-cute animated Halloween scene that runs in a window on an always-on
monitor. It is ambient decoration, not a game and not a screensaver. The goal is a scene that
feels quietly alive: pleasant to glance at, never demanding attention, and rewarding over long
stretches because you occasionally catch something you hadn't seen before.

**Tone:** warm and charming. Autumn-cozy first, spooky second. Nothing scary, gory, or jumpy.

Warmth comes from **light against dark**, not from a warm overall frame. Structural elements are
cool, dark silhouettes; the amber moon, glowing pumpkin eyes, and lit windows are the warm notes
that read as cozy by contrast. This also keeps the window dim enough to sit beside real work for
hours without pulling the eye or causing strain.

**Anti-goals:** not a game, not interactive-first, not busy, not attention-grabbing, not a
performance hog.

---

## 2. Success criteria

- Runs unattended for 8+ hours without memory growth, slowdown, or crashing.
- Stays visually crisp at any integer scale on the target displays.
- Keeps CPU/GPU load low enough that fans stay quiet on an older Intel iMac.
- Events feel like pleasant surprises, not clutter or a metronome.
- Adding a new scene or event means editing data files, not engine code.

---

## 3. Target environment

- **Primary:** 27" Intel iMac (2560×1440 or 5120×2880 Retina).
- **Secondary:** external monitors up to 27", 1080p or 4K.
- Browser window or fullscreen tab. Screen Wake Lock API keeps the display awake.
- No mobile, no touch, no small-screen support needed.

---

## 4. Locked decisions

These are settled. Don't re-open without discussion.

| Decision | Choice |
|---|---|
| Platform | Web (browser) |
| Renderer | PixiJS v8 (WebGL, GPU-accelerated sprites) |
| Language | TypeScript |
| Art style | Pixel art |
| Visual style | Flat, multi-layered 2D silhouette. Solid high-contrast dark shapes; detail reserved for light emitters |
| Layer model | Four named parallax containers (see 5.5) |
| Scaling | Integer-only, nearest-neighbor filtering |
| Frame rate | Capped at 30fps |
| Palette | Limited fall/Halloween set: oranges, purples, deep blues, warm window yellows |
| Architecture | Data-driven — engine and content strictly separated |
| V1 art | Free/placeholder assets only |

**Why Pixi and not Phaser:** Phaser is a full game framework (arcade physics, input systems,
game-object lifecycle, asset pipeline). This project would use a small fraction of it while
inheriting its conventions throughout. Pixi handles sprites, containers, and the render loop,
which is the part that's actually needed. The scene/event/director layer is simple enough to own
directly, and owning it keeps the data-driven structure clean.

---

## 5. Proposed architecture

Starting direction, open to refinement during implementation.

### 5.1 Core concepts

- **Scene** — a backdrop built from parallax layers (sky, far, mid, near, foreground), a set of
  ambient loops, and an event pool. Defined in data.
- **Prop** — a static or looping element within a scene (gravestone, lamp post, tree, window).
  May optionally declare an interaction hook (see 5.5).
- **Event** — a transient thing that happens: a sprite crossing, a ghost rising, a light
  flickering. Defined in data with a weight, cooldown, duration, and conditions.
- **Director** — the scheduler. Decides what happens when, and rotates scenes.
- **Time Broker** — single source of truth for time. Everything time-related reads from here.

### 5.2 Time Broker

Polls the system clock on an interval (roughly once per second is plenty). Exposes two things:

1. **`dayPhase`** — a continuous 0-to-1 value representing position in the 24-hour cycle.
2. **`timeBlock`** — a named block, used to select the active scene and event pool.

**Important:** lighting should be driven by the *continuous* value, not the named block. Sky
tint, ambient light level, and window glow interpolate along a curve so sunset is a gradual
shift rather than a switch flipping at a threshold. The named blocks control *which scene* and
*which events* are eligible, not color.

Proposed blocks:

| Block | Window | Scene |
|---|---|---|
| Day | 06:00 – 16:30 | Daytime downtown Salem |
| Sunset | 16:30 – 18:00 | Salem, transitioning |
| Night | 18:00 – 05:00 | Rotates: graveyard, mansion |
| Sunrise | 05:00 – 06:00 | Transitioning to day |

**Time override is a hard requirement, not a nice-to-have.** If scenes are bound to the wall
clock, it is impossible to develop or review the night scenes during the day. The debug panel
must be able to scrub and freeze the clock from milestone 1 onward.

### 5.3 Spawner logic

- **Do not roll on a fixed grid.** Rolling dice every 30 seconds makes events feel quantized even
  when outcomes are random. Randomize the interval itself (exponential / Poisson-style spacing
  reads as organic).
- Each event carries: weight, cooldown, min/max duration, max concurrent instances, and
  eligibility conditions (time block, scene, other events active).
- The director enforces a global cap on concurrent events so the scene never feels crowded.
- Prefer **procedural motion over animation files** where it works: velocity vectors plus
  sinusoidal offsets give ghosts and bats natural drift for almost no cost and no art. Reserve
  sprite-sheet animation for things that genuinely need it (walk cycles).
- **Motion vocabulary:** linear trajectories across a flat X-plane, never pathfinding. A ghost is
  linear X with Y oscillating on a sine wave. A bat swarm is a rapid diagonal vector with small
  chaotic noise offsets layered on.
- **Noise:** inline a small 2D simplex implementation (~40 lines) rather than adding a package.

### 5.4 Rendering

- Fixed virtual canvas, upscaled by an integer factor to fill the window.
- **Proposed base resolution: 640×360.** Scales cleanly to all targets (4× to 1440p, 8× to 5K,
  3× to 1080p, 6× to 4K) and leaves room for detail across multiple scenes. 320×180 is the
  chunkier alternative. Confirm this at milestone 1 with real art in frame.
- All sprite scales consistent with the chosen base. Mixed pixel densities are the most common
  thing that makes a pixel scene look wrong.
- **Sky gradients must be dithered.** A smooth gradient bands visibly at pixel scale. Ordered
  (Bayer) dithering is the standard fix and reads as intentional within the pixel idiom. The sky
  appears in every scene, so solve this at M1.

### 5.5 Layer model

Four rendering containers, back to front. Every scene uses the same four.

| # | Layer | Contents | Parallax factor | Behavior |
|---|---|---|---|---|
| 1 | **Sky & Luminescence Anchor** | Sky gradient, stars, the dominant light source (full moon, low sun) | 0 | Static. Defines the light vector everything else is colored against |
| 2 | **Distant Backdrop** | Hills, far town silhouettes, rooftops, steeples, low ambient clouds | 0.05 – 0.1 | Establishes scale and setting |
| 3 | **Midground & Spawner Plane** | Primary structures: mansion, fences, tombstones. **~90% of dynamic sprites spawn and traverse here** | ~0.5 | The action plane |
| 4 | **Foreground Framing** | Heavy silhouettes at the left/right edges: tree trunks, overhanging branches, spiderwebs, tall grass, near jack-o'-lanterns | ~1.0 or viewport-locked | Frames the scene and masks the hard edges of the browser window |

Layer 4 is doing real work beyond decoration: it hides the window boundary, which is what keeps
the scene from reading as "a video playing in a box."

### 5.6 Camera and parallax

- **Ambient drift only.** A microscopic continuous sinusoidal camera drift keeps the scene from
  looking frozen while idle:
  `camera.x = Math.sin(timestamp * 0.0002) * maxDriftPixels`
- **No mouse-driven parallax.** This window will often sit behind other windows where it won't
  receive mouse events at all, and where it does, the scene shifting as the cursor passes is the
  kind of attention-pull this project is specifically avoiding. Drift alone carries the depth.
- Layers transform by `delta_X_layer = delta_X_global * P_factor`. The factors above are what
  turn the drift into perceived depth, so they matter even without mouse input.
- Drift amplitude belongs in the tuning panel. Too much is nauseating over hours; too little is
  invisible.

### 5.7 Palette and contrast rules

- **One color family per scene.** Graveyard: deep purples, mid lavenders, dark indigos. Mansion:
  dark blues and teals. Salem daytime: ambers and dusty roses.
- **Structures are solid silhouettes.** No intricate texture, no busy internal pattern. A
  gravestone is a shape, not a rendering of granite.
- **High-contrast detail is reserved for light emitters** and nothing else. Moon, pumpkin eyes,
  a window switching on. This is what makes those elements read as light rather than as
  brightly-colored objects.
- **Stay dark and desaturated overall** so the window remains peripheral over long uptime.
- Practical benefit: silhouettes are far less art than detailed pixel scenes and cohere
  automatically, which makes self-made V1 art realistic and may remove the need for paid packs.

### 5.8 Interaction (deferred feature, designed for now)

Clickable easter eggs are **out of scope for V1**, but the hook should exist in the data model so
adding them later is an addition rather than a retrofit.

Props may optionally declare an interaction. Pixi hit areas on container elements handle this
cleanly. Later examples: clicking a dark mansion window flashes a silhouette; clicking the
graveyard tree releases a crow or a flurry of leaves.

---

## 6. Scope

### V1 — in scope

- Graveyard scene (night), built end to end.
- Placeholder art (self-made silhouettes, free packs, or colored rectangles).
- Four-layer parallax model with ambient camera drift.
- Dithered sky gradient.
- Time Broker with continuous day phase and override control.
- Director with weighted, cooldown-aware random event scheduling.
- 4–6 events: ghost rising, bat flutter, cat crossing, lantern flicker, drifting fog, falling leaves.
- Debug/tuning panel.
- Wake lock, frame cap, fullscreen.

### Out of scope for V1

- Sound and music.
- Click interactions and easter eggs.
- Packaging as a desktop app or screensaver.
- Paid art assets.
- Any scene other than the graveyard.

---

## 7. Milestones

Each milestone ends at a **review gate**. Complete it end to end, then stop for review before
starting the next.

**M1 — Foundation**
Canvas, integer scaling, nearest-neighbor filtering, frame cap, wake lock, fullscreen. Four-layer
graveyard backdrop with placeholder silhouettes. Dithered sky gradient. Ambient camera drift with
per-layer parallax factors. Confirms base resolution choice. Completes the TODO sections of
`CLAUDE.md` with the real structure and commands.

**M2 — Time and Director**
Time Broker with continuous day phase and named blocks. Debug time override. Director scheduling
two events with weights and cooldowns.

**M3 — Tuning panel**
Hidden debug overlay: time scrub and freeze, event frequency sliders, force-trigger any event,
concurrency cap, FPS/memory readout, layer toggles. This is the tool for judging feel, so it
matters early.

**M3.5 — Art pipeline**
Replace the graveyard's placeholder shapes with the authored SVG art in `reference/`. Adds a
`sprite` visual kind to the schema, texture loading, and an offline SVG-to-PNG rasterisation step
feeding `assets/`. Records every asset's source and licence in `ASSETS.md`. Conversion is by
**alpha-threshold** — see `DECISIONS.md`.

Slotted *after* M3 and *before* M4 deliberately: M3's panel and M4's pacing pass both exist to
judge feel, and tuning against placeholder rectangles then swapping in real art at the end would
invalidate the tuning. The art is graveyard art, so it wants to land before the graveyard is
called complete.

**M4 — Graveyard complete**
Full event set. Ambient loops. Procedural drift motion. Pacing tuned through the panel until the
scene feels right over a long session.

**M5 — Scene framework**
Extract everything scene-specific into data. Prove it by standing up a second scene (mansion,
night) from data plus art alone, with no engine changes. This is the real test of the
architecture.

**M6 — Daytime Salem**
Daytime scene with its own event pool: kids in costumes, falling leaves, shop lights. Exercises
daytime lighting and a busier composition. **Resolves open question 6** — whether the silhouette
style extends to daylight as backlit golden-hour shapes.

**M7 — Transitions and rotation**
Sunset/sunrise interpolation. Scene rotation during the night block. Crossfade or other handoff
between scenes.

**M8 — Soak and polish**
Multi-hour unattended run. Memory and performance profiling. Final pacing pass.

---

## 8. Guardrails

- **Stop at every milestone gate.** Don't run ahead.
- **Engine and content stay separate.** If adding a scene requires touching engine code, the
  abstraction is wrong. Say so rather than working around it.
- **Ask before adding any dependency.** Pixi and its ecosystem are the expected footprint.
- **No placeholder art in the repo that can't be legally shipped.** Track asset sources and
  licenses in `ASSETS.md` from the start.
- **Keep a running `DECISIONS.md`** recording choices made between gates and why, so the
  reasoning is reviewable without re-reading diffs.
- **Raise open questions rather than settling them alone** (see below).
- **Never delete files without explicit confirmation.**
- **Don't fabricate.** If something is uncertain, say so.

---

## 9. Open questions

For discussion at the relevant gate, not for unilateral decision.

1. **Base resolution: 640×360 or 320×180?** The silhouette style strengthens the case for
   320×180, since solid shapes need far less pixel detail than rendered scenes and the chunkier
   canvas suits the look. Decide at M1 with art in frame.
2. **How literal should Salem be?** Recognizable landmarks, or generic New England fall downtown?
3. **Scene rotation cadence at night.** Hourly, or driven by an event/lull in activity?
4. **Does the daytime scene need a different event density than night?** Daytime likely supports
   more traffic (people, cars) while night is sparser and slower.
5. **Fog and weather as ambient state** — worth a shared system across scenes, or per-scene?
6. **Does the silhouette style extend to daytime Salem?** The style is built for night. Proposed
   answer: yes, as backlit golden-hour silhouettes against an amber and rose sky, keeping the
   structure identical and changing only the palette. Kids in costume become small dark shapes
   against warm light. The alternative is a second visual mode for daylight, which roughly
   doubles the style work. Decide at M6, or earlier if it affects M5's abstractions.
7. **Camera drift amplitude and period.** Needs tuning against hours of real uptime, not a
   glance. Too much is nauseating; too little is invisible.
