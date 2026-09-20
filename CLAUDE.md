# CLAUDE.md

Read `BRIEF.md` before starting work. It holds the goal, scope, milestones, and the reasoning
behind the decisions below. This file holds only how to work in this repo.

---

## Structure

Engine code and scene content are strictly separated.

```
src/engine/     Rendering, director, time broker, spawner, motion. Scene-agnostic.
src/types/      Scene, event, and prop type definitions. The schema of record.
content/        Scene and event data. Declarative only, no logic.
assets/         Art. Mirrors content/ structure.
```

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
- Motion is procedural (vectors, sine, noise) wherever it works. Sprite-sheet animation only for
  things that genuinely need it, like walk cycles.

---

## Commands

<!-- TODO(M1): fill in once the project is scaffolded -->

| | |
|---|---|
| Dev server | `TBD` |
| Build | `TBD` |
| Typecheck | `TBD` |
| Lint | `TBD` |

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
TODO(M1): once scaffolded, this file should also cover:
  - Real directory tree, replacing the proposed one above
  - Working commands in the table above
  - How to run the debug/tuning panel and toggle the time override
  - Where the palette module lives and how to add a color
  - How to add a new event: which files, what the type requires, how weights/cooldowns are set
  - Any project-specific lint or formatting rules
Keep it under a page. This file loads into context every session — length is a real cost.
Anything explaining *why* belongs in BRIEF.md, not here.
-->
