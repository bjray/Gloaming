import { Application, Container, TextureSource } from 'pixi.js'

/**
 * Virtual canvas size. See DECISIONS.md, "Base resolution: 640×360".
 *
 * Everything is authored against this and upscaled by a whole-number factor. Changing it
 * invalidates every asset in the project, which is why it lives in exactly one place.
 */
export const VIRTUAL_WIDTH = 640
export const VIRTUAL_HEIGHT = 360

/** Frame cap from §4. Low enough to keep fans quiet on an older Intel iMac. */
export const TARGET_FPS = 30

export interface Stage {
  readonly app: Application
  /** Parent of the four layer containers. */
  readonly world: Container
  /**
   * Reserve horizontal space and re-fit the canvas beside it.
   *
   * Used by the M3 panel: a tool for judging feel is useless while it covers the thing being
   * judged. Stepping the integer scale down is the honest fix — the alternative, overlapping the
   * canvas, hides part of the scene, and scaling it fractionally to fit would break the
   * integer-only invariant to save a debug overlay.
   */
  setHorizontalReserve(px: number): void
  destroy(): void
}

/**
 * Largest whole-number scale that fits the virtual canvas in the given viewport.
 *
 * Integer-only is a locked decision (§4): a fractional scale resamples every pixel and the whole
 * frame goes soft. Never returns less than 1 — a viewport too small to fit one whole pixel per
 * virtual pixel is out of scope (§3, no small-screen support), and clamping beats vanishing.
 */
export function integerScaleFor(viewportWidth: number, viewportHeight: number): number {
  const fit = Math.min(viewportWidth / VIRTUAL_WIDTH, viewportHeight / VIRTUAL_HEIGHT)
  return Math.max(1, Math.floor(fit))
}

/**
 * Create the renderer and the world container.
 *
 * The renderer runs at the virtual resolution and the *browser* does the upscale via CSS with
 * `image-rendering: pixelated`. That means only 640×360 pixels are ever shaded — about 7M
 * fragments per second at 30fps — which is what keeps this cheap on integrated graphics. It also
 * guarantees the dither pattern lands on the virtual grid rather than on output pixels, which is
 * the whole point of dithering at pixel scale (§5.4).
 */
export async function createStage(host: HTMLElement): Promise<Stage> {
  // Nearest-neighbour on every texture, no exceptions (CLAUDE.md). Set before anything loads so
  // it applies to sources created later.
  TextureSource.defaultOptions.scaleMode = 'nearest'

  const app = new Application()
  await app.init({
    width: VIRTUAL_WIDTH,
    height: VIRTUAL_HEIGHT,
    antialias: false,
    resolution: 1,
    autoDensity: false,
    preference: 'webgl',
    powerPreference: 'low-power',
    backgroundAlpha: 1,
  })

  app.ticker.maxFPS = TARGET_FPS

  const canvas = app.canvas
  canvas.style.imageRendering = 'pixelated'
  canvas.style.display = 'block'
  host.appendChild(canvas)

  const world = new Container({ label: 'world' })
  app.stage.addChild(world)

  let horizontalReserve = 0

  const applyScale = (): void => {
    const available = Math.max(1, window.innerWidth - horizontalReserve)
    const scale = integerScaleFor(available, window.innerHeight)
    canvas.style.width = `${VIRTUAL_WIDTH * scale}px`
    canvas.style.height = `${VIRTUAL_HEIGHT * scale}px`
  }

  window.addEventListener('resize', applyScale)
  applyScale()

  return {
    app,
    world,
    setHorizontalReserve(px: number): void {
      horizontalReserve = Math.max(0, px)
      applyScale()
    },
    destroy(): void {
      window.removeEventListener('resize', applyScale)
      // Tears down the renderer, the ticker, and the one container this module created.
      //
      // Deliberately *not* `texture: true, textureSource: true`. Those cascade into shared
      // globals — `Texture.WHITE` backs every solid Graphics fill — and destroying them from
      // here produced "a 'textureSource' was destroyed while still bound to a shader" on
      // teardown. Leaks are the primary failure mode over an 8-hour run (CLAUDE.md), but the
      // discipline that prevents them is per-owner: whatever loads a texture destroys it, the
      // way `sky.destroy()` releases its own filter. A blanket sweep from the stage papers over
      // missing ownership and breaks anything that outlives one renderer. Children are not
      // cascaded here for the same reason (see layers.ts).
      world.destroy({ children: false })
      app.destroy(true, { children: false })
    },
  }
}
