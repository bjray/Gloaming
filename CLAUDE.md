# CLAUDE.md

Read `BRIEF.md` before starting work. It holds the goal, scope, milestones, and the reasoning
behind the decisions below. This file holds only how to work in this repo.

---

## Structure

Engine code and scene content are strictly separated.

```
src/engine/     Rendering, director, time broker, spawner, motion. Scene-agnostic.
  stage.ts        Renderer, virtual canvas size, integer scaling, frame cap
  layers.ts       The four parallax containers
  camera.ts       Ambient sinusoidal drift
  sky.ts          Dithered gradient (inlined GLSL) + the Sky interface
  palette.ts      Token -> hex. The ONLY module with colour literals
  scene-builder.ts  Instantiates a Scene's props into the layers
  display.ts      Wake lock, fullscreen, click-to-begin overlay
src/types/      Scene, event, and prop type definitions. The schema of record.
  scene.ts  layer.ts  prop.ts  sky.ts  palette.ts
src/main.ts     Boot. Wires engine to one scene; deliberately thin
content/        Scene and event data. Declarative only, no logic.
  scenes/graveyard-night.ts
assets/         Art. Mirrors content/ structure. Empty so far — M1's placeholder
                silhouettes are declarative shapes in content, not files
reference/      Direction material, NOT shippable assets. See reference/README.md
```

Aliases: `@engine/*` -> `src/engine/*`, `@schema/*` -> `src/types/*`, `@content/*` -> `content/*`.
`@schema` rather than `@types`, which would collide with the `node_modules/@types` convention.

**A new scene must be addable with changes only under `content/` and `assets/`.** If a scene
needs something in `src/engine/`, that's a missing abstraction — stop and say so rather than
adding the special case.

---

## Invariants

These break silently and are painful to trace later.

### Pixel rendering
- Round sprite positions to whole virtual pixels before rendering. Fractional positions cause
  shimmer during motion that reads as "something feels off" long before it's visibly wrong.
- Nearest-neighbor filtering on every texture. No exceptions.
- No hex color literals outside the palette module. All colors resolve through it.

### Time
- **Only the Time Broker reads the system clock.** Everything else queries the broker.
- A single `Date.now()` call elsewhere silently breaks the debug time override, which is the only
  way to work on night scenes during the day.

### Lifecycle
- This runs unattended for 8+ hours. Leaks are the primary failure mode.
- Every spawned event destroys its display objects and textures when it completes.
- No allocation inside the per-frame loop.
- Pool anything that spawns frequently (bats, leaves).

---

## Conventions

- TypeScript, strict mode.
- Types in `src/types/` are the schema of record. Content files validate against them.
- **Adding a colour** is two edits: the token name in `src/types/palette.ts`, then its hex in
  `src/engine/palette.ts`. The `Record<ColorToken, number>` there makes a missing mapping a
  compile error. Content refers to tokens only. Prefer reusing a token — the palette is a
  *limited* set, and a new scene is expected to select from it (`BRIEF.md` §5.7).
- Motion is procedural (vectors, sine, noise) wherever it works. Sprite-sheet animation only for
  things that genuinely need it, like walk cycles.

---

## Commands

| | |
|---|---|
| Dev server | `npm run dev` — Vite on http://127.0.0.1:5173 |
| Build | `npm run build` — static output to `dist/` |
| Preview build | `npm run preview` |
| Typecheck | `npm run typecheck` — `tsc --noEmit`, strict |
| Lint | none installed — adding one needs a dependency decision (see `BRIEF.md` §8) |

Toolchain is Vite + TypeScript + `pixi.js` and nothing else; see `DECISIONS.md`.
`tsc` is TypeScript 7, which **removed `baseUrl`** — path aliases in `tsconfig.json` must be
relative (`./src/engine/*`), and the same aliases are mirrored in `vite.config.ts`.

There is no test runner yet. M1 was verified by driving the real page in a browser and asserting
the invariants from the console (renderer size, integer scale ladder, whole-pixel layer offsets,
measured frame rate). Anything that needs a harness should be raised rather than assumed.

---

## Process

- **Stop at each milestone gate** (see `BRIEF.md` §7). Don't continue past a gate without review.
- **Ask before adding any dependency.** Pixi and its ecosystem are the expected footprint. Small
  utilities (e.g. simplex noise) should be inlined rather than installed.
- **Log decisions in `DECISIONS.md`** as they're made, with the reasoning. This is what makes the
  work reviewable between gates without reading diffs.
- **Record every asset's source and license in `ASSETS.md`** at the time it's added.
- **Raise open questions** (see `BRIEF.md` §9) rather than settling them alone.

---

<!--
Still to document, at the milestone that creates it:
  - M2: how to add an event (files, type requirements, weights/cooldowns); the time override
  - M3: how to open the debug/tuning panel
Keep it under a page. This file loads into context every session — length is a real cost.
Anything explaining *why* belongs in BRIEF.md or DECISIONS.md, not here.
-->
