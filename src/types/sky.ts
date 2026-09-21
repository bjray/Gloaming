import type { ColorToken } from './palette'

/** One keyframe in the sky ramp, pinned to a `dayPhase` position. */
export interface SkyKey {
  /** `dayPhase` at which these colours are exact. 0 is midnight, 0.5 noon. */
  readonly at: number
  readonly top: ColorToken
  readonly bottom: ColorToken
}

/**
 * The sky's procedural gradient across the whole day. See DECISIONS.md, "Sky architecture".
 *
 * The gradient interpolates between two colours and is quantised into `bands`, with ordered
 * (Bayer) dithering across band boundaries. §5.4 requires the dither: a smooth gradient bands
 * visibly at pixel scale, and ordered dithering is the standard fix.
 *
 * `bands` and `dither` together span both idioms seen in the reference art:
 *   - `dither: 0` gives hard-edged bands, the look of the hand-authored `salem-day` sky.
 *   - `dither: 1` blends fully across boundaries, the smoother classic dither.
 * Neither is more correct; it is a per-scene aesthetic choice.
 *
 * **Why keyframes rather than one pair of colours.** §5.2 requires lighting to interpolate along
 * a continuous curve so sunset is gradual. A single pair cannot express a day; a ramp sampled at
 * `dayPhase` can. Keys wrap, so the last interpolates back into the first across midnight and
 * there is no discontinuity at 00:00.
 */
export interface SkyRamp {
  /** Keys in ascending `at` order. At least one. */
  readonly keys: readonly SkyKey[]
  /** Number of quantisation steps between top and bottom. Higher is smoother. */
  readonly bands: number
  /** Dither strength across band boundaries, 0 (hard bands) to 1 (fully dithered). */
  readonly dither: number
}
