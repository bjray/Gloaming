/**
 * Wake lock, fullscreen, and the click-to-begin overlay.
 * See DECISIONS.md, "Wake lock and fullscreen entry".
 *
 * Both the Screen Wake Lock API and the Fullscreen API require a user activation, so neither can
 * be acquired on load. The overlay is that activation. It re-shows whenever the wake lock is lost
 * — the browser releases it automatically when the tab is backgrounded — or when fullscreen is
 * exited, so recovery needs no permanent on-screen chrome.
 */

interface WakeLockSentinelLike extends EventTarget {
  readonly released: boolean
  release(): Promise<void>
}

interface WakeLockLike {
  request(type: 'screen'): Promise<WakeLockSentinelLike>
}

function wakeLockApi(): WakeLockLike | undefined {
  return (navigator as Navigator & { wakeLock?: WakeLockLike }).wakeLock
}

export interface DisplayController {
  /** True once the wake lock is held. */
  readonly locked: boolean
  destroy(): void
}

export interface DisplayOptions {
  /** The click-to-begin element. Hidden while the scene is running. */
  overlay: HTMLElement
  /** Element to make fullscreen. */
  target: HTMLElement
  /** Request fullscreen as well as the wake lock. */
  fullscreen?: boolean
}

export function createDisplayController(options: DisplayOptions): DisplayController {
  const { overlay, target, fullscreen = true } = options
  let sentinel: WakeLockSentinelLike | undefined
  let destroyed = false

  const showOverlay = (): void => {
    if (!destroyed) overlay.hidden = false
  }

  const hideOverlay = (): void => {
    overlay.hidden = true
  }

  const onRelease = (): void => {
    sentinel = undefined
    showOverlay()
  }

  const acquire = async (): Promise<void> => {
    const api = wakeLockApi()
    if (!api) {
      // Unsupported (Safari has historically not shipped this). The scene still runs; the
      // display may sleep. Surfaced rather than swallowed, but not fatal.
      console.warn('[gloaming] Screen Wake Lock API unavailable — display may sleep.')
      return
    }
    try {
      sentinel = await api.request('screen')
      sentinel.addEventListener('release', onRelease, { once: true })
    } catch (error) {
      console.warn('[gloaming] Wake lock request rejected:', error)
    }
  }

  const onBegin = (): void => {
    hideOverlay()
    void acquire()
    if (fullscreen && !document.fullscreenElement) {
      void target.requestFullscreen?.().catch((error: unknown) => {
        console.warn('[gloaming] Fullscreen request rejected:', error)
      })
    }
  }

  const onFullscreenChange = (): void => {
    // Esc leaves fullscreen and re-entry needs a fresh gesture, so put the overlay back rather
    // than carrying a permanent affordance for it.
    if (fullscreen && !document.fullscreenElement) showOverlay()
  }

  const onVisibilityChange = (): void => {
    // The lock is dropped when the tab is hidden; reacquire on return if we still have a gesture
    // in credit, otherwise the overlay asks for one.
    if (document.visibilityState === 'visible' && !sentinel && overlay.hidden) {
      void acquire()
    }
  }

  overlay.addEventListener('click', onBegin)
  document.addEventListener('fullscreenchange', onFullscreenChange)
  document.addEventListener('visibilitychange', onVisibilityChange)

  return {
    get locked(): boolean {
      return sentinel !== undefined && !sentinel.released
    },
    destroy(): void {
      destroyed = true
      overlay.removeEventListener('click', onBegin)
      document.removeEventListener('fullscreenchange', onFullscreenChange)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      void sentinel?.release()
      sentinel = undefined
    },
  }
}
