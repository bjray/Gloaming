/**
 * The motion vocabulary. See BRIEF.md §5.3.
 *
 * Motion is procedural: a velocity vector plus a sinusoidal offset gives a ghost natural drift
 * for almost no cost and no art. Sprite-sheet animation is reserved for things that genuinely
 * need it, like walk cycles.
 *
 * **This is a closed set, and that is deliberate.** Content supplies the *parameters*; the engine
 * owns the *kinds*. §5.3 frames motion as a vocabulary rather than an open extension point, so a
 * new kind is a considered engine addition, not something a scene brings with it. That is a real
 * qualification of "a new scene must be addable with changes only under content/" — a scene
 * needing genuinely novel motion does touch the engine. Raised rather than assumed; see
 * DECISIONS.md.
 *
 * **A speed floor applies to every kind.** Positions round to whole virtual pixels, so anything
 * moving slower than roughly 10 px/s steps visibly rather than glides — the same quantisation
 * floor that shaped the camera drift (DECISIONS.md, "Camera drift"). A ghost meant to read as
 * drifting should still cross at 12-18 px/s; slower looks broken, not calmer.
 */

/** Constant velocity in both axes. A bat's rapid diagonal. */
export interface LinearMotion {
  readonly kind: 'linear'
  readonly velocityX: number
  readonly velocityY: number
}

/**
 * Linear in X with Y oscillating on a sine — §5.3's ghost, exactly.
 *
 * `sinePeriodSeconds` is the time for one full bob. Keep it well above the frame budget; a period
 * near the frame interval aliases into jitter.
 */
export interface DriftMotion {
  readonly kind: 'drift'
  readonly velocityX: number
  readonly sineAmplitudePx: number
  readonly sinePeriodSeconds: number
}

export type Motion = LinearMotion | DriftMotion
