import { blockForDayPhase, dayPhaseToHours, hoursToDayPhase, wrap, type TimeBlock } from '@schema/time'

/**
 * THE ONLY MODULE PERMITTED TO READ THE SYSTEM CLOCK (see CLAUDE.md).
 *
 * A single stray `Date.now()` anywhere else silently breaks the time override, which is the only
 * way to work on night scenes during the day — and it breaks it *quietly*, by making one part of
 * the scene disagree with the rest. Everything time-related queries this broker.
 *
 * Per §5.2 the clock is polled on an interval rather than read every frame. Roughly once a
 * second is plenty for a value that moves 1/86400 per second, and it keeps the per-frame path
 * free of clock calls entirely.
 */

/** How often the wall clock is sampled while not overridden. */
const POLL_INTERVAL_SECONDS = 1

export interface TimeBroker {
  /** Continuous 0-to-1 position in the 24-hour cycle. **Lighting reads this.** */
  readonly dayPhase: number
  /** Named window. **Selection reads this** — which scene, which events. Never colour. */
  readonly timeBlock: TimeBlock
  /** Current time of day in hours, 0-24. Convenience for the debug panel. */
  readonly hours: number
  /** True while the wall clock is being ignored. */
  readonly isOverridden: boolean
  /** Rate of time passage while overridden. 0 is frozen, 1 is real time. */
  readonly rate: number

  /** Advance the broker. `deltaSeconds` is real elapsed time from the ticker. */
  update(deltaSeconds: number): void

  /**
   * Take over from the wall clock and hold at `hours` (0-24, fractional).
   *
   * §5.2 calls this a hard requirement rather than a nice-to-have: bound to the wall clock, the
   * night scenes are impossible to develop or review during the day.
   */
  scrubTo(hours: number): void
  /** Set the override's rate. 0 freezes; 60 runs a day in 24 minutes. Implies an override. */
  setRate(multiplier: number): void
  /** Resume following the wall clock. */
  clearOverride(): void
}

export function createTimeBroker(): TimeBroker {
  // Seeded from the wall clock so the first frame is already correct rather than showing
  // midnight for up to a poll interval.
  let dayPhase = readWallClockDayPhase()
  let sincePoll = 0

  let overrideHours: number | null = null
  let rate = 1

  function readWallClockDayPhase(): number {
    const now = new Date()
    const hours =
      now.getHours() +
      now.getMinutes() / 60 +
      now.getSeconds() / 3600 +
      now.getMilliseconds() / 3_600_000
    return hoursToDayPhase(hours)
  }

  return {
    get dayPhase(): number {
      return dayPhase
    },
    get timeBlock(): TimeBlock {
      return blockForDayPhase(dayPhase)
    },
    get hours(): number {
      return dayPhaseToHours(dayPhase)
    },
    get isOverridden(): boolean {
      return overrideHours !== null
    },
    get rate(): number {
      return rate
    },

    update(deltaSeconds: number): void {
      if (overrideHours !== null) {
        // Overridden time advances from the delta, never from the clock, so `rate: 0` is a true
        // freeze and any other rate is reproducible.
        if (rate !== 0) {
          overrideHours = wrap(overrideHours + (deltaSeconds * rate) / 3600, 24)
        }
        dayPhase = hoursToDayPhase(overrideHours)
        return
      }

      sincePoll += deltaSeconds
      if (sincePoll >= POLL_INTERVAL_SECONDS) {
        sincePoll = 0
        dayPhase = readWallClockDayPhase()
      }
    },

    scrubTo(hours: number): void {
      overrideHours = wrap(hours, 24)
      dayPhase = hoursToDayPhase(overrideHours)
    },

    setRate(multiplier: number): void {
      rate = multiplier
      if (overrideHours === null) overrideHours = dayPhaseToHours(dayPhase)
    },

    clearOverride(): void {
      overrideHours = null
      rate = 1
      sincePoll = POLL_INTERVAL_SECONDS
    },
  }
}
