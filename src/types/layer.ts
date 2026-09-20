/**
 * The four rendering containers, back to front. See BRIEF.md §5.5.
 *
 * Every scene uses all four. The names are fixed by the layer model, which is a locked
 * decision (§4) — a scene may retune a layer's parallax factor but may not add or rename one.
 */
export type LayerId = 'sky' | 'backdrop' | 'midground' | 'foreground'

/** Back to front. Index is z-order within the world container. */
export const LAYER_ORDER = ['sky', 'backdrop', 'midground', 'foreground'] as const

/**
 * Default parallax factors. A scene may override any of these.
 *
 * `sky` is 0 by definition: it is the luminescence anchor and does not move, which is why the
 * sky needs its own motion (drifting clouds) rather than borrowing the camera's.
 *
 * **`backdrop` is 0.25, not the 0.05-0.1 that §5.5 proposes.** That range cannot work on a pixel
 * grid at ambient amplitudes, and the brief's figures were written without accounting for the
 * rounding. At 0.08 with a 12px drift the backdrop's entire travel is ±0.96px, which rounds to
 * three positions: it sat still for 5-10 seconds, jumped a pixel, and sat again, while the
 * foreground took 48 steps over the same period. The result read as unrelated layers twitching
 * rather than as depth.
 *
 * The floor is arithmetic, not taste: a layer needs `amplitude x factor` to be a healthy number
 * of whole pixels before it can glide at all. At 20px amplitude, 0.25 gives ±5px — eleven
 * positions — which is enough. Anything under ~0.15 does not move convincingly at any amplitude
 * this project can afford, so the choice is a raised factor or a static backdrop.
 */
export const DEFAULT_PARALLAX: Readonly<Record<LayerId, number>> = {
  sky: 0,
  backdrop: 0.25,
  midground: 0.5,
  foreground: 1,
}
