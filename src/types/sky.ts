import type { ColorToken } from './palette'

/**
 * The sky's procedural gradient. See DECISIONS.md, "Sky architecture".
 *
 * The gradient interpolates between two tokens and is quantised into `bands`, with ordered
 * (Bayer) dithering applied across band boundaries. §5.4 requires the dither: a smooth gradient
 * bands visibly at pixel scale, and ordered dithering is the standard fix.
 *
 * `bands` and `dither` together span both idioms seen in the reference art:
 *   - `dither: 0` gives hard-edged bands, the look of the hand-authored `salem-day` sky.
 *   - `dither: 1` blends fully across boundaries, the smoother classic dither.
 * Neither is more correct; it is a per-scene aesthetic choice.
 */
export interface SkyGradient {
  readonly top: ColorToken
  readonly bottom: ColorToken
  /** Number of quantisation steps between `top` and `bottom`. Higher is smoother. */
  readonly bands: number
  /** Dither strength across band boundaries, 0 (hard bands) to 1 (fully dithered). */
  readonly dither: number
}
