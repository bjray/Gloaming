import { graveyardNight } from '@content/scenes/graveyard-night'
import { createCamera } from '@engine/camera'
import { createDisplayController } from '@engine/display'
import { createLayers } from '@engine/layers'
import { buildScene } from '@engine/scene-builder'
import { createSky } from '@engine/sky'
import { createStage } from '@engine/stage'

/**
 * M1 boot. See BRIEF.md §7.
 *
 * Deliberately thin: it wires engine pieces to one scene from content and starts the ticker.
 * Nothing here knows anything about graveyards beyond the import, which is the property M5 has
 * to prove — standing up a second scene should touch this file only to change which scene is
 * imported, and eventually not even that once the Director arrives at M2.
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
  const sky = createSky(scene.sky, layers)
  const instance = buildScene(scene, layers)
  const camera = createCamera(layers)

  const display = createDisplayController({
    overlay,
    target: document.documentElement,
  })

  // The only per-frame work in M1. Allocates nothing (CLAUDE.md).
  const tick = (): void => {
    camera.update(stage.app.ticker.deltaMS / 1000)
  }
  stage.app.ticker.add(tick)

  // Explicit teardown path. Nothing calls this yet, but every spawned thing owning its own
  // destroy is the discipline that makes an 8-hour run survivable, and it is much harder to
  // retrofit than to establish.
  const dispose = (): void => {
    stage.app.ticker.remove(tick)
    sky.detach()
    display.destroy()
    instance.destroy()
    sky.destroy()
    layers.destroy()
    stage.destroy()
  }
  window.addEventListener('pagehide', dispose, { once: true })

  Object.assign(globalThis, {
    // Handle for poking at things from the console until the M3 panel exists.
    __gloaming: { stage, layers, sky, camera, instance, display, dispose },
  })
}

void boot().catch((error: unknown) => {
  console.error('[gloaming] Boot failed:', error)
})
