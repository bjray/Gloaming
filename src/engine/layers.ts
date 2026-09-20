import { Container } from 'pixi.js'
import { DEFAULT_PARALLAX, LAYER_ORDER, type LayerId } from '@schema/layer'

export interface LayerSet {
  readonly containers: Readonly<Record<LayerId, Container>>
  readonly parallax: Readonly<Record<LayerId, number>>
  /** Toggle a layer's visibility. Used by the M3 debug panel. */
  setVisible(layer: LayerId, visible: boolean): void
  destroy(): void
}

/**
 * Create the four parallax containers and add them to `world` in back-to-front order.
 *
 * Layer assignment comes from content, never from the filesystem or from engine constants — see
 * reference/README.md on why the `layer<#>` in an art filename must stay advisory.
 */
export function createLayers(
  world: Container,
  overrides?: Partial<Record<LayerId, number>>,
): LayerSet {
  const containers = {} as Record<LayerId, Container>
  const parallax = {} as Record<LayerId, number>

  for (const id of LAYER_ORDER) {
    const container = new Container({ label: id })
    containers[id] = container
    parallax[id] = overrides?.[id] ?? DEFAULT_PARALLAX[id]
    world.addChild(container)
  }

  return {
    containers,
    parallax,
    setVisible(layer, visible): void {
      containers[layer].visible = visible
    },
    destroy(): void {
      for (const id of LAYER_ORDER) {
        // Children are NOT cascaded. Whatever added a child owns it and destroys it — the scene
        // instance owns its props, the sky owns its gradient quad. Cascading from here would
        // double-destroy them, which is how ownership quietly becomes everyone's and then
        // nobody's. This module created the containers, so it destroys exactly those.
        containers[id].removeChildren()
        containers[id].destroy({ children: false })
      }
    },
  }
}
