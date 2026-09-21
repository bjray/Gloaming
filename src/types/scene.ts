import type { LayerId } from './layer'
import type { Prop } from './prop'
import type { EventPool } from './event'
import type { SkyRamp } from './sky'

/**
 * A scene: a sky, a set of props distributed across the four layers, and optional parallax
 * retuning. See BRIEF.md §5.1.
 *
 * This is the schema of record. A new scene must be addable by writing one of these under
 * `content/` plus art under `assets/` — nothing under `src/engine/`. If a scene cannot be
 * expressed here, that is a missing abstraction and should be raised, not worked around
 * (see CLAUDE.md).
 */
export interface Scene {
  readonly id: string
  /** Human-readable, for the debug panel. */
  readonly name: string
  readonly sky: SkyRamp
  /** Events eligible in this scene, and their pacing. */
  readonly events: EventPool
  /** Overrides for `DEFAULT_PARALLAX`. Omitted layers keep their default. */
  readonly parallax?: Partial<Record<LayerId, number>>

  /**
   * How much camera drift this scene's art can absorb, in virtual pixels.
   *
   * A scene knows its own overscan; the engine does not. Declaring the budget here is what lets
   * the tuning panel bound its amplitude slider instead of cheerfully sliding a bare gap into
   * view at the frame edge — the exact trap the M1 overscan fix left open (see DECISIONS.md).
   *
   * Set it to the *narrowest* overscan among edge-anchored props, minus a little margin, divided
   * by the largest parallax factor in use.
   */
  readonly maxDriftAmplitudePx: number
  readonly props: readonly Prop[]
}
