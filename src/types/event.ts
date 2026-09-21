import type { LayerId } from './layer'
import type { Motion } from './motion'
import type { TimeBlock } from './time'
import type { Visual } from './visual'

/**
 * A transient thing that happens: a sprite crossing, a ghost rising, a light flickering.
 * See BRIEF.md §5.1 and §5.3. Declarative only.
 *
 * Every field the brief asks an event to carry is here: weight, cooldown, min/max duration, max
 * concurrent instances, and eligibility conditions.
 */
export interface EventDef {
  readonly id: string
  /** Human-readable, for the M3 panel. */
  readonly name: string

  /** Relative likelihood of being picked when several events are eligible. */
  readonly weight: number
  /** Minimum seconds between this event's own spawns, regardless of the schedule. */
  readonly cooldownSeconds: number
  /** Lifetime is drawn uniformly from this range. */
  readonly minDurationSeconds: number
  readonly maxDurationSeconds: number
  /** Ceiling on simultaneous instances of *this* event. The director also enforces a global cap. */
  readonly maxConcurrent: number

  /**
   * Blocks in which this event may spawn. Omit to mean "any block".
   *
   * This is the named block doing its proper job — selecting eligibility, never colour.
   */
  readonly blocks?: readonly TimeBlock[]

  /** Which parallax layer the instance is added to. ~90% of events belong on `midground` (§5.5). */
  readonly layer: LayerId

  /**
   * Spawn origin, as a box in virtual pixels. The instance's starting position is drawn
   * uniformly from it, so a crossing does not begin at the same height every time.
   *
   * Author this *outside* the frame for anything that traverses, or the thing pops into
   * existence mid-air.
   */
  readonly origin: {
    readonly xFrom: number
    readonly xTo: number
    readonly yFrom: number
    readonly yTo: number
  }

  readonly motion: Motion

  /** Shapes making up the instance, positioned relative to its origin. */
  readonly visuals: readonly Visual[]

  /**
   * Seconds spent fading in at birth and out at death. Prevents things blinking into existence,
   * which is the main thing that makes a spawned event read as a glitch rather than an event.
   */
  readonly fadeSeconds: number

  /** Peak opacity, 0-1. Ghosts want to be translucent. */
  readonly opacity: number
}

/**
 * A scene's event pool and the pacing that governs it.
 *
 * `meanSpawnIntervalSeconds` is the *mean* of an exponential distribution, not a fixed period.
 * §5.3 is explicit: rolling dice on a fixed grid makes events feel quantised even when the
 * outcomes are random, so the interval itself is randomised.
 */
export interface EventPool {
  readonly meanSpawnIntervalSeconds: number
  /** Ceiling on concurrent instances across all events, so the scene never feels crowded. */
  readonly maxConcurrent: number
  readonly events: readonly EventDef[]
}
