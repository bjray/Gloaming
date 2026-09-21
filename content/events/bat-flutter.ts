import type { EventDef } from '@schema/event'

/**
 * A bat cutting across the sky. Declarative only.
 *
 * §5.3 describes a bat swarm as "a rapid diagonal vector with small chaotic noise offsets
 * layered on". This is the vector without the noise: the inlined simplex implementation the
 * brief calls for belongs with the rest of the ambient motion work at M4, and adding a noise
 * motion kind now would be speculative. Plain `linear` is honest about what M2 built.
 *
 * Fast on purpose — 46 px/s, well clear of the quantisation floor, and a bat that dawdles looks
 * like a moth.
 */
export const batFlutter: EventDef = {
  id: 'bat-flutter',
  name: 'Bat flutter',

  weight: 5,
  cooldownSeconds: 12,
  minDurationSeconds: 14,
  maxDurationSeconds: 18,
  maxConcurrent: 3,
  blocks: ['night', 'sunset', 'sunrise'],

  layer: 'midground',

  origin: { xFrom: -30, xTo: 20, yFrom: 54, yTo: 112 },

  motion: {
    kind: 'linear',
    velocityX: 46,
    velocityY: 13,
  },

  // Two wings and a body, small enough to read as a bat only by shape and motion — which at
  // this size is all a silhouette can do.
  visuals: [
    { kind: 'shape', color: 'silhouetteNear', points: [0, 2, 4, 0, 5, 3, 3, 4] },
    { kind: 'shape', color: 'silhouetteNear', points: [10, 2, 6, 0, 5, 3, 7, 4] },
    { kind: 'rect', color: 'silhouetteNear', x: 4, y: 2, width: 2, height: 3 },
  ],

  fadeSeconds: 1.5,
  opacity: 1,
}
