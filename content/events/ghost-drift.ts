import type { EventDef } from '@schema/event'

/**
 * A ghost drifting across the graveyard. Declarative only.
 *
 * §5.3's motion example, literally: "A ghost is linear X with Y oscillating on a sine wave."
 *
 * The 14 px/s crossing speed is chosen against the quantisation floor, not for realism. Positions
 * round to whole virtual pixels, so anything under roughly 10 px/s steps visibly instead of
 * gliding (DECISIONS.md, "Camera drift"). A slower, more spectral drift would read as broken
 * rather than calmer — 14 px/s steps every 71ms, which fuses into motion.
 */
export const ghostDrift: EventDef = {
  id: 'ghost-drift',
  name: 'Ghost drift',

  weight: 3,
  cooldownSeconds: 45,
  minDurationSeconds: 50,
  maxDurationSeconds: 58,
  maxConcurrent: 1,
  blocks: ['night', 'sunset'],

  layer: 'midground',

  // Starts well off the left edge so it arrives rather than appears. Height varies so repeated
  // crossings do not trace the same line.
  origin: { xFrom: -40, xTo: -28, yFrom: 176, yTo: 226 },

  motion: {
    kind: 'drift',
    velocityX: 14,
    sineAmplitudePx: 6,
    sinePeriodSeconds: 5.5,
  },

  // A simple shrouded silhouette: rounded crown, tapering tattered hem.
  visuals: [
    {
      kind: 'shape',
      color: 'ghostPale',
      points: [
        4, 0, 9, 0, 12, 3, 13, 9, 13, 19, 11, 24, 12, 29, 9, 26, 7, 30, 5, 26, 2, 29, 3, 24, 0, 19,
        0, 9, 1, 3,
      ],
    },
  ],

  fadeSeconds: 4,
  opacity: 0.5,
}
