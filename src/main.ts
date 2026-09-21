import { graveyardNight } from '@content/scenes/graveyard-night'
import { createCamera } from '@engine/camera'
import { createDirector } from '@engine/director'
import { createDisplayController } from '@engine/display'
import { createLayers } from '@engine/layers'
import { buildScene } from '@engine/scene-builder'
import { createSky } from '@engine/sky'
import { createStage } from '@engine/stage'
import { createTimeBroker } from '@engine/time-broker'

/**
 * Boot. See BRIEF.md §7.
 *
 * Deliberately thin: it wires engine pieces to one scene from content and starts the ticker.
 * Nothing here knows anything about graveyards beyond the import, which is the property M5 has
 * to prove — standing up a second scene should touch this file only to change which scene is
 * imported, and eventually not even that once scene rotation arrives.
 */
async function boot(): Promise<void> {
  const host = document.querySelector<HTMLElement>('#stage')
  const overlay = document.querySelector<HTMLElement>('#overlay')

  if (!host || !overlay) {
    throw new Error('[gloaming] Missing #stage or #overlay in the document.')
  }

  const scene = graveyardNight

  const stage = await createStage(host)
  const layers = createLayers(stage.world, scene.parallax)
  const time = createTimeBroker()
  const sky = createSky(scene.sky, layers)
  const instance = buildScene(scene, layers)
  const camera = createCamera(layers)
  const director = createDirector(scene.events, layers)

  const display = createDisplayController({
    overlay,
    target: document.documentElement,
  })

  /**
   * The per-frame path. Allocates nothing (CLAUDE.md).
   *
   * Order matters in one place: the broker advances first, so the sky and the director both see
   * the same day phase within a frame rather than one of them lagging by one.
   */
  const tick = (): void => {
    const deltaSeconds = stage.app.ticker.deltaMS / 1000
    time.update(deltaSeconds)
    sky.update(time.dayPhase)
    camera.update(deltaSeconds)
    director.update(deltaSeconds, time.timeBlock)
  }
  stage.app.ticker.add(tick)

  // Paint one frame's worth of state before anything is shown, so the sky is already the right
  // colour behind the overlay rather than resolving a frame later.
  tick()

  const dispose = (): void => {
    stage.app.ticker.remove(tick)
    sky.detach()
    display.destroy()
    director.destroy()
    instance.destroy()
    sky.destroy()
    layers.destroy()
    stage.destroy()
  }
  window.addEventListener('pagehide', dispose, { once: true })

  Object.assign(globalThis, {
    // Handle for driving things from the console until the M3 panel exists. The time override is
    // the important one: `__gloaming.time.scrubTo(21)` puts the scene at 9pm regardless of the
    // wall clock, which is the only way to review a night scene during the day (§5.2).
    __gloaming: { stage, layers, time, sky, camera, director, instance, display, tick, dispose },
  })
}

void boot().catch((error: unknown) => {
  console.error('[gloaming] Boot failed:', error)
})
