import type { ColorToken } from './palette'

/**
 * A drawable shape. Shared by static props and by spawned events, so the engine has exactly one
 * place that turns declarative geometry into a display object.
 *
 * Coordinates are whole virtual pixels in the 640×360 space. For a prop they are absolute; for
 * an event's visual they are relative to the instance's own origin, which the director places.
 */
interface VisualBase {
  readonly color: ColorToken
}

/** A closed polygon. Points are flat `[x0, y0, x1, y1, ...]`. */
export interface ShapeVisual extends VisualBase {
  readonly kind: 'shape'
  readonly points: readonly number[]
}

/** An axis-aligned rectangle. */
export interface RectVisual extends VisualBase {
  readonly kind: 'rect'
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/** A circle. Used for light emitters — the moon, a pumpkin's glow. */
export interface CircleVisual extends VisualBase {
  readonly kind: 'circle'
  readonly x: number
  readonly y: number
  readonly radius: number
}

export type Visual = ShapeVisual | RectVisual | CircleVisual
