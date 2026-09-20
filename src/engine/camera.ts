import { LAYER_ORDER, type LayerId } from '@schema/layer'
import type { LayerSet } from './layers'

/** Drift waveform. See `createCamera` for why the default is not a sine. */
export type Waveform = 'triangle' | 'sine'

export interface CameraConfig {
  /** Peak drift in virtual pixels, before the per-layer parallax factor. */
  amplitudePx: number
  /** Seconds for one full left-right-left cycle. */
  periodSeconds: number
  /** Position curve. `triangle` holds a constant speed; `sine` stalls at the extremes. */
  waveform: Waveform
}

/**
 * Starting values only — open question 7 is explicitly deferred (see DECISIONS.md).
 *
 * Amplitude is 20px rather than the 12px first tried, because the drift has to be large enough
 * that the *slowest* layer still has whole pixels to move through. See `DEFAULT_PARALLAX`.
 */
export const DEFAULT_CAMERA: CameraConfig = {
  amplitudePx: 20,
  periodSeconds: 31.4,
  waveform: 'triangle',
}

export interface Camera {
  readonly config: CameraConfig
  /** Advance the drift. `deltaSeconds` comes from the ticker, not from the clock. */
  update(deltaSeconds: number): void
}

/**
 * Normalised drift position in [-1, 1], starting at 0 and rising.
 *
 * The triangle wave is the important part. Layer offsets must round to whole virtual pixels, so
 * a layer does not move continuously — it holds a position, then steps one pixel. What the eye
 * reads as smooth or jumpy is the *regularity of that step cadence*, not the curve's elegance.
 *
 * A sine spends most of its time near its extremes, where velocity approaches zero. Measured on
 * the foreground at 12px amplitude, dwell time between steps ranged from 0.40s at the
 * zero-crossing to 2.87s at the peaks — a 7x swing. The layer glided, stalled, then lurched.
 *
 * A triangle holds constant speed, so every step is evenly spaced and the motion reads as a slow
 * continuous glide. The turnaround is a velocity discontinuity in principle, but at a couple of
 * pixels per second it is imperceptible — far less visible than the stall it replaces.
 *
 * `sine` is kept so the two can be compared directly from the M3 panel; BRIEF.md 5.6 proposes a
 * sine, and that proposal deserves to stay testable rather than be quietly overruled.
 */
function driftPosition(elapsedSeconds: number, config: CameraConfig): number {
  const phase = elapsedSeconds / config.periodSeconds

  if (config.waveform === 'sine') {
    return Math.sin(phase * Math.PI * 2)
  }

  // Shifted by 3/4 of a cycle so the wave starts at 0 and rises, matching the sine's phase.
  const wrapped = (phase + 0.75) % 1
  return 4 * Math.abs(wrapped - 0.5) - 1
}

/**
 * Ambient drift — the only camera motion in the project.
 *
 * No mouse-driven parallax, by decision (BRIEF.md 5.6): the window often sits behind other
 * windows where it receives no mouse events at all, and where it does, the scene lurching as the
 * cursor passes is exactly the attention-pull this project avoids.
 *
 * Each layer's offset is rounded to a whole virtual pixel. Fractional positions cause shimmer
 * during motion that reads as "something feels off" long before it looks visibly wrong
 * (CLAUDE.md).
 *
 * **Why the global drift is quantised before parallax is applied.** Rounding each layer from a
 * continuous drift makes the layers step at different *moments*, not merely at different rates.
 * The foreground steps when the drift crosses k+0.5; the midground, at half the factor, steps
 * when it crosses odd integers. Those instants never coincide. Measured over one period that
 * produced 140 step events, every single one an isolated one-pixel shift in a single layer —
 * roughly four and a half independent twitches per second, scattered across the scene.
 *
 * Rounding the global drift first collapses this. A layer offset is then derived from an integer,
 * so it can only change at an instant the global value changed, and layers step *together* in a
 * nested rhythm. The count of distinct visual events drops by more than half, and each one is a
 * coherent shift of the whole frame rather than one plane flinching on its own. That is the
 * difference between reading as a camera and reading as three unrelated tickers.
 *
 * Allocates nothing per frame.
 */
export function createCamera(layers: LayerSet, config: CameraConfig = DEFAULT_CAMERA): Camera {
  let elapsedSeconds = 0

  return {
    config,
    update(deltaSeconds: number): void {
      elapsedSeconds += deltaSeconds

      // Quantise the *global* drift to whole pixels before applying parallax, so that every
      // layer's step lands on a moment the camera itself stepped. See the note below.
      const globalPx = Math.round(driftPosition(elapsedSeconds, config) * config.amplitudePx)

      for (let i = 0; i < LAYER_ORDER.length; i += 1) {
        const id = LAYER_ORDER[i] as LayerId
        layers.containers[id].x = Math.round(globalPx * layers.parallax[id])
      }
    },
  }
}
