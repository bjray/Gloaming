import type { Container } from 'pixi.js'
import type { Motion } from '@schema/motion'

/**
 * Implementations of the motion vocabulary (§5.3). The kinds live here; the parameters come from
 * content.
 *
 * Positions round to whole virtual pixels, per the pixel-rendering invariant. Note the
 * consequence, learned the hard way on the camera drift: a thing moving slower than roughly
 * 10 px/s does not glide, it steps. See `src/types/motion.ts`.
 *
 * Allocates nothing. Called for every active instance every frame.
 */
export function applyMotion(
  target: Container,
  motion: Motion,
  originX: number,
  originY: number,
  elapsedSeconds: number,
): void {
  switch (motion.kind) {
    case 'linear':
      target.x = Math.round(originX + motion.velocityX * elapsedSeconds)
      target.y = Math.round(originY + motion.velocityY * elapsedSeconds)
      break

    case 'drift': {
      const phase = (elapsedSeconds / motion.sinePeriodSeconds) * Math.PI * 2
      target.x = Math.round(originX + motion.velocityX * elapsedSeconds)
      target.y = Math.round(originY + Math.sin(phase) * motion.sineAmplitudePx)
      break
    }
  }
}

/**
 * Opacity over an instance's lifetime: fade in, hold, fade out.
 *
 * Without this, instances blink into existence, which reads as a rendering glitch rather than as
 * something happening. Alpha is deliberately *not* quantised — it is not a position, so it
 * causes no pixel shimmer, and smooth alpha is what sells the fade at these short durations.
 */
export function fadeAlpha(
  elapsedSeconds: number,
  durationSeconds: number,
  fadeSeconds: number,
  peak: number,
): number {
  if (fadeSeconds <= 0) return peak

  const fade = Math.min(fadeSeconds, durationSeconds / 2)
  if (elapsedSeconds < fade) return peak * (elapsedSeconds / fade)

  const remaining = durationSeconds - elapsedSeconds
  if (remaining < fade) return peak * Math.max(0, remaining / fade)

  return peak
}
