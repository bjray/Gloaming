import { Container, Graphics } from 'pixi.js'
import type { EventDef, EventPool } from '@schema/event'
import type { TimeBlock } from '@schema/time'
import type { LayerSet } from './layers'
import { applyMotion, fadeAlpha } from './motion'
import { drawVisual } from './visual'

/**
 * The scheduler (§5.1, §5.3). Decides what happens when.
 *
 * Two properties matter more than the rest:
 *
 *  - **Spawn intervals are exponentially distributed, not a fixed grid.** §5.3 is explicit that
 *    rolling dice every 30 seconds makes events feel quantised even when the outcomes are
 *    random. Randomising the interval itself gives Poisson-style spacing, which reads as
 *    organic: sometimes two things happen close together, sometimes nothing for a while.
 *  - **Every instance owns and destroys its own display objects.** Leaks are the primary failure
 *    mode over an 8-hour run, and an event system is where they accumulate (CLAUDE.md).
 *
 * **The director is paced by real elapsed time, not by day-phase time.** `update` takes the
 * ticker's delta, so running the Time Broker at 120x to review a sunset does not also make bats
 * swarm at 120x. The two clocks are deliberately independent: the broker's override exists to
 * inspect *lighting* at an arbitrary hour, and event pacing has to stay honest while you do it
 * or there is no way to judge it. The block passed in is the only thing the broker contributes
 * here, and it governs eligibility alone.
 */

/** A live instance of an event. */
interface Instance {
  readonly def: EventDef
  readonly container: Container
  readonly parts: Graphics[]
  readonly originX: number
  readonly originY: number
  readonly durationSeconds: number
  elapsedSeconds: number
}

export interface DirectorStats {
  readonly activeCount: number
  readonly spawnedTotal: number
  readonly nextSpawnInSeconds: number
  readonly perEvent: Readonly<Record<string, { active: number; spawned: number; cooldownRemaining: number }>>
}

export interface Director {
  update(deltaSeconds: number, timeBlock: TimeBlock): void
  /**
   * Spawn an event immediately, bypassing the schedule and its cooldown.
   *
   * For the M3 panel's force-trigger. Still respects concurrency caps — a forced spawn that
   * overflowed the scene would misrepresent how the event actually looks in place.
   */
  trigger(eventId: string): boolean
  readonly stats: DirectorStats
  destroy(): void
}

/** Exponentially distributed interval with the given mean. Poisson-style spacing. */
function exponentialInterval(meanSeconds: number): number {
  // Math.random() can return 0, whose log is -Infinity; nudge it off zero.
  const u = 1 - Math.random()
  return -Math.log(u) * meanSeconds
}

export function createDirector(pool: EventPool, layers: LayerSet): Director {
  const instances: Instance[] = []
  const lastSpawnAt = new Map<string, number>()
  const spawnedCount = new Map<string, number>()

  let clock = 0
  let spawnedTotal = 0
  let nextSpawnIn = exponentialInterval(pool.meanSpawnIntervalSeconds)

  const byId = new Map(pool.events.map((def) => [def.id, def]))

  const activeOf = (id: string): number => {
    let n = 0
    for (const instance of instances) if (instance.def.id === id) n += 1
    return n
  }

  const cooldownRemaining = (def: EventDef): number => {
    const last = lastSpawnAt.get(def.id)
    if (last === undefined) return 0
    return Math.max(0, def.cooldownSeconds - (clock - last))
  }

  const isEligible = (def: EventDef, timeBlock: TimeBlock): boolean => {
    if (def.blocks && !def.blocks.includes(timeBlock)) return false
    if (cooldownRemaining(def) > 0) return false
    if (activeOf(def.id) >= def.maxConcurrent) return false
    return true
  }

  function spawn(def: EventDef): void {
    const container = new Container({ label: `event:${def.id}` })
    const parts: Graphics[] = []

    for (const visual of def.visuals) {
      const g = drawVisual(visual)
      container.addChild(g)
      parts.push(g)
    }

    const { xFrom, xTo, yFrom, yTo } = def.origin
    const originX = Math.round(xFrom + Math.random() * (xTo - xFrom))
    const originY = Math.round(yFrom + Math.random() * (yTo - yFrom))

    const durationSeconds =
      def.minDurationSeconds + Math.random() * (def.maxDurationSeconds - def.minDurationSeconds)

    container.x = originX
    container.y = originY
    container.alpha = 0
    layers.containers[def.layer].addChild(container)

    instances.push({
      def,
      container,
      parts,
      originX,
      originY,
      durationSeconds,
      elapsedSeconds: 0,
    })

    lastSpawnAt.set(def.id, clock)
    spawnedCount.set(def.id, (spawnedCount.get(def.id) ?? 0) + 1)
    spawnedTotal += 1
  }

  /** Weighted pick among eligible events. Returns undefined when nothing may spawn. */
  function pick(timeBlock: TimeBlock): EventDef | undefined {
    let totalWeight = 0
    for (const def of pool.events) {
      if (isEligible(def, timeBlock)) totalWeight += def.weight
    }
    if (totalWeight <= 0) return undefined

    let roll = Math.random() * totalWeight
    for (const def of pool.events) {
      if (!isEligible(def, timeBlock)) continue
      roll -= def.weight
      if (roll <= 0) return def
    }
    return undefined
  }

  function retire(index: number): void {
    const instance = instances[index] as Instance
    // The instance owns these, so it destroys these. Nothing above it cascades.
    for (const part of instance.parts) part.destroy()
    instance.parts.length = 0
    instance.container.destroy({ children: false })
    instances.splice(index, 1)
  }

  return {
    update(deltaSeconds: number, timeBlock: TimeBlock): void {
      clock += deltaSeconds

      // Advance and retire. Backwards so splicing does not skip an entry.
      for (let i = instances.length - 1; i >= 0; i -= 1) {
        const instance = instances[i] as Instance
        instance.elapsedSeconds += deltaSeconds

        if (instance.elapsedSeconds >= instance.durationSeconds) {
          retire(i)
          continue
        }

        applyMotion(
          instance.container,
          instance.def.motion,
          instance.originX,
          instance.originY,
          instance.elapsedSeconds,
        )
        instance.container.alpha = fadeAlpha(
          instance.elapsedSeconds,
          instance.durationSeconds,
          instance.def.fadeSeconds,
          instance.def.opacity,
        )
      }

      // Schedule. The interval is redrawn on every spawn *and* on every blocked attempt, so a
      // blocked attempt does not queue up a burst the moment eligibility returns.
      nextSpawnIn -= deltaSeconds
      if (nextSpawnIn > 0) return

      nextSpawnIn = exponentialInterval(pool.meanSpawnIntervalSeconds)

      if (instances.length >= pool.maxConcurrent) return
      const def = pick(timeBlock)
      if (def) spawn(def)
    },

    trigger(eventId: string): boolean {
      const def = byId.get(eventId)
      if (!def) return false
      if (instances.length >= pool.maxConcurrent) return false
      if (activeOf(def.id) >= def.maxConcurrent) return false
      spawn(def)
      return true
    },

    get stats(): DirectorStats {
      const perEvent: Record<string, { active: number; spawned: number; cooldownRemaining: number }> = {}
      for (const def of pool.events) {
        perEvent[def.id] = {
          active: activeOf(def.id),
          spawned: spawnedCount.get(def.id) ?? 0,
          cooldownRemaining: Math.round(cooldownRemaining(def) * 10) / 10,
        }
      }
      return {
        activeCount: instances.length,
        spawnedTotal,
        nextSpawnInSeconds: Math.round(nextSpawnIn * 10) / 10,
        perEvent,
      }
    },

    destroy(): void {
      for (let i = instances.length - 1; i >= 0; i -= 1) retire(i)
    },
  }
}
