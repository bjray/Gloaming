import { Graphics } from 'pixi.js'
import type { Visual } from '@schema/visual'
import { resolve } from './palette'

/**
 * The single place declarative geometry becomes a display object.
 *
 * Both static props and spawned event instances come through here, so there is one switch to
 * extend when a visual kind is added — and `noFallthroughCasesInSwitch` plus the exhaustive
 * union make forgetting a kind a compile error rather than an invisible missing shape.
 */
export function drawVisual(visual: Visual, label?: string): Graphics {
  const g = label === undefined ? new Graphics() : new Graphics({ label })
  const color = resolve(visual.color)

  switch (visual.kind) {
    case 'shape':
      g.poly(visual.points as number[]).fill({ color })
      break
    case 'rect':
      g.rect(visual.x, visual.y, visual.width, visual.height).fill({ color })
      break
    case 'circle':
      g.circle(visual.x, visual.y, visual.radius).fill({ color })
      break
  }

  return g
}
