import { LAYER_ORDER, type LayerId } from '@schema/layer'
import type { Camera } from '@engine/camera'
import type { Director } from '@engine/director'
import type { LayerSet } from '@engine/layers'
import type { TimeBroker } from '@engine/time-broker'

/**
 * The hidden tuning overlay (BRIEF.md §7, M3).
 *
 * "This is the tool for judging feel, so it matters early." Everything it touches was already
 * driveable from the console after M2 — this wraps that surface in something you can actually
 * hold while watching the scene.
 *
 * **Deliberately DOM, not PixiJS.** The panel is chrome, not scene: rendering it inside the
 * 640×360 virtual canvas would put debug text on the pixel grid, force it through the
 * nearest-neighbour upscale, and make it part of the thing being judged. DOM also means real
 * sliders and checkboxes for free.
 *
 * **It never writes to content.** Pacing changes land in `director.tuning`, an override layer, so
 * the authored numbers in `content/` stay the reviewable source of truth and a reload returns to
 * them. The M4 workflow is: slide until it feels right, then copy the settled values into content
 * as a deliberate edit.
 */

/** Panel refresh rate. Well below the frame rate — DOM text updates are not frame work. */
const REFRESH_HZ = 5

export interface DebugPanelDeps {
  time: TimeBroker
  camera: Camera
  director: Director
  layers: LayerSet
  /** Largest drift amplitude this scene's art can absorb. Bounds the amplitude slider. */
  maxDriftAmplitudePx: number
  /**
   * Called with the width the panel occupies (0 when hidden), so the scene can re-fit beside it
   * rather than be covered by it.
   */
  onReserveChange?: (px: number) => void
}

export interface DebugPanel {
  readonly visible: boolean
  toggle(): void
  /** Count a rendered frame. Wired to the ticker; a bare increment, so it allocates nothing. */
  countFrame(): void
  destroy(): void
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

function formatClock(hours: number): string {
  const h = Math.floor(hours)
  const m = Math.floor((hours - h) * 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function createDebugPanel(deps: DebugPanelDeps): DebugPanel {
  const { time, camera, director, layers, maxDriftAmplitudePx, onReserveChange } = deps

  const root = el('aside', 'panel')
  root.hidden = true
  root.setAttribute('aria-label', 'Tuning panel')

  // --- readouts updated on the refresh tick ---------------------------------------------
  const readouts = {
    clock: el('span', 'panel__value'),
    block: el('span', 'panel__value'),
    fps: el('span', 'panel__value'),
    heap: el('span', 'panel__value'),
    active: el('span', 'panel__value'),
    spawned: el('span', 'panel__value'),
    nextSpawn: el('span', 'panel__value'),
    amplitude: el('span', 'panel__value'),
    period: el('span', 'panel__value'),
    interval: el('span', 'panel__value'),
    cap: el('span', 'panel__value'),
  }
  const eventRows = new Map<string, { active: HTMLElement; spawned: HTMLElement; scale: HTMLElement }>()

  function section(title: string): HTMLElement {
    const box = el('section', 'panel__section')
    box.append(el('h2', 'panel__heading', title))
    return box
  }

  function row(label: string, ...controls: (HTMLElement | string)[]): HTMLElement {
    const line = el('div', 'panel__row')
    line.append(el('span', 'panel__label', label))
    for (const control of controls) line.append(control)
    return line
  }

  function slider(
    min: number,
    max: number,
    step: number,
    value: number,
    onInput: (v: number) => void,
  ): HTMLInputElement {
    const input = el('input', 'panel__slider')
    input.type = 'range'
    input.min = String(min)
    input.max = String(max)
    input.step = String(step)
    input.value = String(value)
    input.addEventListener('input', () => onInput(Number(input.value)))
    return input
  }

  function button(label: string, onClick: () => void): HTMLButtonElement {
    const b = el('button', 'panel__button', label)
    b.type = 'button'
    b.addEventListener('click', onClick)
    return b
  }

  // --- Time -----------------------------------------------------------------------------
  const timeBox = section('Time')
  timeBox.append(row('clock', readouts.clock, readouts.block))

  const scrub = slider(0, 24, 0.25, time.hours, (v) => {
    time.scrubTo(v)
  })
  timeBox.append(row('scrub', scrub))

  const rateRow = el('div', 'panel__row')
  rateRow.append(el('span', 'panel__label', 'rate'))
  for (const [label, rate] of [
    ['freeze', 0],
    ['1x', 1],
    ['60x', 60],
    ['300x', 300],
  ] as const) {
    rateRow.append(button(label, () => time.setRate(rate)))
  }
  rateRow.append(button('live', () => time.clearOverride()))
  timeBox.append(rateRow)

  // --- Camera ---------------------------------------------------------------------------
  const cameraBox = section('Camera drift')
  cameraBox.append(
    row(
      'amplitude',
      slider(0, maxDriftAmplitudePx, 1, camera.config.amplitudePx, (v) => {
        camera.config.amplitudePx = v
      }),
      readouts.amplitude,
    ),
  )
  cameraBox.append(
    row(
      'period',
      slider(5, 180, 1, camera.config.periodSeconds, (v) => {
        camera.config.periodSeconds = v
      }),
      readouts.period,
    ),
  )
  const waveRow = el('div', 'panel__row')
  waveRow.append(el('span', 'panel__label', 'waveform'))
  waveRow.append(
    button('triangle', () => {
      camera.config.waveform = 'triangle'
    }),
    button('sine', () => {
      camera.config.waveform = 'sine'
    }),
  )
  cameraBox.append(waveRow)
  cameraBox.append(
    el(
      'p',
      'panel__note',
      `amplitude capped at ${maxDriftAmplitudePx}px by this scene's overscan`,
    ),
  )

  // --- Events ---------------------------------------------------------------------------
  const eventsBox = section('Events')
  eventsBox.append(row('active', readouts.active, readouts.spawned))
  eventsBox.append(
    row(
      'mean gap',
      slider(2, 120, 1, director.tuning.meanSpawnIntervalSeconds, (v) => {
        director.tuning.meanSpawnIntervalSeconds = v
      }),
      readouts.interval,
    ),
  )
  eventsBox.append(
    row(
      'global cap',
      slider(0, 12, 1, director.tuning.maxConcurrent, (v) => {
        director.tuning.maxConcurrent = v
      }),
      readouts.cap,
    ),
  )
  eventsBox.append(row('next in', readouts.nextSpawn))

  const pauseButton = button('pause spawning', () => {
    director.tuning.paused = !director.tuning.paused
    pauseButton.textContent = director.tuning.paused ? 'resume spawning' : 'pause spawning'
    pauseButton.classList.toggle('panel__button--on', director.tuning.paused)
  })
  const eventControls = el('div', 'panel__row')
  eventControls.append(el('span', 'panel__label', ''))
  eventControls.append(pauseButton, button('reset', () => resetTuningAndControls()))
  eventsBox.append(eventControls)

  for (const def of director.events) {
    const line = el('div', 'panel__event')
    line.append(el('span', 'panel__event-name', def.name))

    const active = el('span', 'panel__value')
    const spawned = el('span', 'panel__value')
    const scaleOut = el('span', 'panel__value')
    eventRows.set(def.id, { active, spawned, scale: scaleOut })

    line.append(
      slider(0, 3, 0.1, 1, (v) => {
        director.tuning.weightScale[def.id] = v
      }),
      scaleOut,
      active,
      spawned,
      button('fire', () => director.trigger(def.id)),
    )
    eventsBox.append(line)
  }

  // --- Layers ---------------------------------------------------------------------------
  const layersBox = section('Layers')
  const layerInputs = new Map<LayerId, HTMLInputElement>()
  for (const id of LAYER_ORDER) {
    const label = el('label', 'panel__check')
    const input = el('input')
    input.type = 'checkbox'
    input.checked = true
    input.addEventListener('change', () => layers.setVisible(id, input.checked))
    layerInputs.set(id, input)
    label.append(input, el('span', undefined, `${id}  ×${layers.parallax[id]}`))
    layersBox.append(label)
  }

  // --- Performance ----------------------------------------------------------------------
  const perfBox = section('Performance')
  perfBox.append(row('fps', readouts.fps))
  perfBox.append(row('heap', readouts.heap))

  root.append(
    el('h1', 'panel__title', 'Gloaming — tuning'),
    timeBox,
    cameraBox,
    eventsBox,
    layersBox,
    perfBox,
    el('p', 'panel__note', 'toggle with ` (backtick)'),
  )
  document.body.append(root)

  function resetTuningAndControls(): void {
    director.resetTuning()
    pauseButton.textContent = 'pause spawning'
    pauseButton.classList.remove('panel__button--on')
    for (const input of root.querySelectorAll<HTMLInputElement>('.panel__slider')) {
      // Event weight sliders are the only ones whose authored value is 1.
      if (input.max === '3') input.value = '1'
    }
  }

  // --- refresh ---------------------------------------------------------------------------
  let frames = 0
  let lastRefresh = 0
  let refreshTimer: number | undefined
  let scrubFocused = false
  scrub.addEventListener('pointerdown', () => {
    scrubFocused = true
  })
  scrub.addEventListener('pointerup', () => {
    scrubFocused = false
  })

  function refresh(): void {
    const now = performance.now()
    const elapsed = (now - lastRefresh) / 1000
    lastRefresh = now

    // Measured over a window, deliberately. PixiJS's `ticker.FPS` is an instantaneous reading
    // taken from the last frame pair: with the 30fps cap in place it reported 123 while the real
    // rate was 29.5. A window is the only honest number here.
    if (elapsed > 0) readouts.fps.textContent = `${(frames / elapsed).toFixed(1)}`
    frames = 0

    const memory = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory
    readouts.heap.textContent = memory
      ? `${(memory.usedJSHeapSize / 1048576).toFixed(1)} MB`
      : 'unavailable'

    readouts.clock.textContent = formatClock(time.hours)
    readouts.block.textContent = `${time.timeBlock}${time.isOverridden ? ` · override ×${time.rate}` : ' · live'}`
    // Don't fight the user's thumb while they are dragging it.
    if (!scrubFocused) scrub.value = String(time.hours)

    readouts.amplitude.textContent = `${camera.config.amplitudePx}px`
    readouts.period.textContent = `${camera.config.periodSeconds}s`

    const stats = director.stats
    readouts.active.textContent = `${stats.activeCount}/${director.tuning.maxConcurrent}`
    readouts.spawned.textContent = `· ${stats.spawnedTotal} spawned`
    readouts.nextSpawn.textContent = `${stats.nextSpawnInSeconds}s`
    readouts.interval.textContent = `${director.tuning.meanSpawnIntervalSeconds}s`
    readouts.cap.textContent = `${director.tuning.maxConcurrent}`

    for (const def of director.events) {
      const cells = eventRows.get(def.id)
      const perEvent = stats.perEvent[def.id]
      if (!cells || !perEvent) continue
      cells.active.textContent = `${perEvent.active}/${def.maxConcurrent}`
      cells.spawned.textContent = `${perEvent.spawned} fired`
      const scale = director.tuning.weightScale[def.id] ?? 1
      cells.scale.textContent = `w${(def.weight * scale).toFixed(1)}`
    }
  }

  function startRefresh(): void {
    lastRefresh = performance.now()
    frames = 0
    refresh()
    refreshTimer = window.setInterval(refresh, 1000 / REFRESH_HZ)
  }

  function stopRefresh(): void {
    if (refreshTimer !== undefined) window.clearInterval(refreshTimer)
    refreshTimer = undefined
  }

  const panel: DebugPanel = {
    get visible(): boolean {
      return !root.hidden
    },
    toggle(): void {
      root.hidden = !root.hidden
      // The scene hides the cursor for an always-on display; the panel needs it back.
      document.body.classList.toggle('has-panel', !root.hidden)
      if (root.hidden) {
        stopRefresh()
        onReserveChange?.(0)
      } else {
        startRefresh()
        // Measured rather than assumed: the width is set in rem and follows the root font size.
        onReserveChange?.(root.offsetWidth)
      }
    },
    countFrame(): void {
      frames += 1
    },
    destroy(): void {
      stopRefresh()
      document.removeEventListener('keydown', onKeyDown)
      document.body.classList.remove('has-panel')
      onReserveChange?.(0)
      root.remove()
    },
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (event.key === '`' || event.key === '~') {
      event.preventDefault()
      panel.toggle()
    }
  }
  document.addEventListener('keydown', onKeyDown)

  return panel
}
