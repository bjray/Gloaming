/**
 * Time vocabulary. See BRIEF.md §5.2.
 *
 * Two distinct notions, deliberately not interchangeable:
 *
 *  - **`dayPhase`** — a continuous 0-to-1 position in the 24-hour cycle. 0 is midnight, 0.5 is
 *    noon. *Lighting reads this.* Sky tint, ambient level and window glow interpolate along it,
 *    so sunset is a gradual shift rather than a switch flipping at a threshold.
 *  - **`timeBlock`** — a named window. *Selection reads this.* It decides which scene is active
 *    and which events are eligible, and it never decides colour.
 *
 * Conflating the two is the specific mistake §5.2 warns about: drive colour from the block and
 * the sky changes in a visible jump at 16:30 every day.
 */
export type TimeBlock = 'day' | 'sunset' | 'night' | 'sunrise'

/** A block's window, in `dayPhase` units. `from` is inclusive, `to` exclusive. */
export interface TimeBlockWindow {
  readonly block: TimeBlock
  readonly from: number
  readonly to: number
}

/**
 * Wrap a value into `[0, period)`, preserving exactness for values already in range.
 *
 * **Do not replace this with `((x % p) + p) % p`.** That idiom loses precision: for
 * `dayPhase = 5/24 = 0.20833333333333334`, adding 1 and taking the modulus again returns
 * `0.20833333333333326` — one ULP smaller. That was enough to make 05:00 fail the `>= from`
 * test on its own `sunrise` window and fall through to `night`'s wrapping window instead. The
 * guard below touches the arithmetic only when the value is actually negative, so in-range
 * values are returned bit-identical.
 */
export function wrap(value: number, period: number): number {
  const wrapped = value % period
  return wrapped < 0 ? wrapped + period : wrapped
}

/** Convert a wall-clock hour (0-24, fractional) to `dayPhase`. */
export function hoursToDayPhase(hours: number): number {
  return wrap(hours, 24) / 24
}

/** Convert `dayPhase` to a wall-clock hour in [0, 24). */
export function dayPhaseToHours(dayPhase: number): number {
  return wrap(dayPhase, 1) * 24
}

/**
 * Block windows from §5.2's table.
 *
 * `night` wraps midnight (18:00 → 05:00), so it is expressed as a single window whose `from` is
 * greater than its `to`. Lookup handles the wrap rather than splitting it into two entries,
 * which would make "how many blocks are there" ambiguous.
 */
export const TIME_BLOCKS: readonly TimeBlockWindow[] = [
  { block: 'sunrise', from: hoursToDayPhase(5), to: hoursToDayPhase(6) },
  { block: 'day', from: hoursToDayPhase(6), to: hoursToDayPhase(16.5) },
  { block: 'sunset', from: hoursToDayPhase(16.5), to: hoursToDayPhase(18) },
  { block: 'night', from: hoursToDayPhase(18), to: hoursToDayPhase(5) },
]

/** The block containing a given `dayPhase`. */
export function blockForDayPhase(dayPhase: number): TimeBlock {
  const phase = wrap(dayPhase, 1)

  for (const window of TIME_BLOCKS) {
    const wraps = window.from > window.to
    const inside = wraps
      ? phase >= window.from || phase < window.to
      : phase >= window.from && phase < window.to
    if (inside) return window.block
  }

  // Unreachable: the windows tile the whole cycle. Falling through would mean the table above
  // has a gap, which is worth failing loudly for rather than defaulting to a plausible block.
  throw new Error(`[gloaming] No time block covers dayPhase ${dayPhase}`)
}
