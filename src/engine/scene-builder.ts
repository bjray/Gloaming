import type { Graphics } from 'pixi.js'
import type { Scene } from '@schema/scene'
import type { LayerSet } from './layers'
import { drawVisual } from './visual'

export interface SceneInstance {
  readonly scene: Scene
  destroy(): void
}

/**
 * Instantiate a scene's props into the layer containers.
 *
 * M1 draws props as vector `Graphics` rather than sprites. That is deliberate placeholder art
 * (§6 permits "colored rectangles") and it keeps the graveyard addable as pure data with no
 * binary assets yet. A `sprite` prop kind joins the schema when real art lands; the switch above
 * will demand it be handled.
 */
export function buildScene(scene: Scene, layers: LayerSet): SceneInstance {
  const drawn: Graphics[] = []

  for (const prop of scene.props) {
    const g = drawVisual(prop, prop.id)
    layers.containers[prop.layer].addChild(g)
    drawn.push(g)
  }

  return {
    scene,
    destroy(): void {
      // Every display object this built is destroyed here. Over an 8-hour run with scene
      // rotation (M7) this is the difference between flat memory and a slow leak (CLAUDE.md).
      for (const g of drawn) {
        g.destroy()
      }
      drawn.length = 0
    },
  }
}
