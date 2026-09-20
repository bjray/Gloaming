import type { ColorToken } from './palette'
import type { LayerId } from './layer'

/**
 * A static element within a scene (§5.1). Declarative only — a prop describes a shape, a
 * colour token and a layer, and carries no behaviour.
 *
 * All coordinates are whole virtual pixels in the 640×360 space (see DECISIONS.md). Author
 * edge-anchored props with **overscan**: a layer translates by `amplitude x parallax`, so art
 * that stops at x=0 or x=640 will slide a bare gap into view as the scene drifts.
 *
 * The rule: **overscan must exceed `amplitude x parallax`, with margin.** At the default 20px
 * amplitude the foreground (factor 1.0) swings ±20px, so ±20px of overscan is exactly flush —
 * correct today and broken the moment the M3 slider is nudged. Author for roughly twice the
 * amplitude you expect: the foreground is the layer that matters, since it has both the largest
 * factor and the job of hiding the window boundary.
 */
interface PropBase {
  readonly id: string
  readonly layer: LayerId
  readonly color: ColorToken
}

/** A closed polygon. Points are flat `[x0, y0, x1, y1, ...]`. */
export interface ShapeProp extends PropBase {
  readonly kind: 'shape'
  readonly points: readonly number[]
}

/** An axis-aligned rectangle. */
export interface RectProp extends PropBase {
  readonly kind: 'rect'
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/** A circle. Used for light emitters — the moon, a pumpkin's glow. */
export interface CircleProp extends PropBase {
  readonly kind: 'circle'
  readonly x: number
  readonly y: number
  readonly radius: number
}

export type Prop = ShapeProp | RectProp | CircleProp
