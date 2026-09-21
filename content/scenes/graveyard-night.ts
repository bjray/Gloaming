import { batFlutter } from '@content/events/bat-flutter'
import { ghostDrift } from '@content/events/ghost-drift'
import type { Scene } from '@schema/scene'

/**
 * Graveyard, night — the V1 scene (§6).
 *
 * Declarative only. Placeholder silhouettes, authored as polygons in the 640×360 virtual space
 * (§6 permits colored rectangles for V1). Coordinates are whole pixels.
 *
 * Composition notes:
 *  - Horizon sits at roughly y=250. Depth reads through the silhouette ramp rather than through
 *    detail: backdrop is lightest, foreground is near-black (§5.7).
 *  - Edge-anchored props overscan well past the frame: the foreground to x=-48 and x=688, the
 *    backdrop and midground to x=-32 and x=672. A layer translates by `amplitude x parallax`, so
 *    at the default 20px amplitude the foreground swings a full ±20px; art stopping at the frame
 *    edge would slide a bare gap into view. The overscan is sized for roughly twice the default
 *    amplitude so the M3 tuning slider has room to be pushed without re-authoring art.
 *  - Detail is reserved for the light emitters: the moon, the mausoleum window, the pumpkin's
 *    face. Everything structural is a solid shape.
 */
export const graveyardNight: Scene = {
  id: 'graveyard-night',
  name: 'Graveyard — Night',

  // Foreground art overscans to x=-48/688 at parallax 1.0, so 48px of drift is exactly flush.
  // 40 keeps 8px of margin at the extreme.
  maxDriftAmplitudePx: 40,

  /**
   * Sky ramp across the day, sampled continuously from `dayPhase` (§5.2).
   *
   * The keys stay inside the graveyard's colour family — deep purples and indigos — except at
   * the warm ends of the cycle, which is where a night scene legitimately sees dawn and dusk.
   * §5.7's "one colour family per scene" is respected by covering the hours this scene is
   * actually shown; the daytime keys exist so scrubbing the clock has somewhere to go, and once
   * scene rotation arrives at M7 the graveyard will simply not be on screen at noon.
   *
   * The key at 0.78 reproduces M1's exact night look, so nightfall is where the scene settles.
   */
  sky: {
    bands: 14,
    dither: 1,
    keys: [
      { at: 0.0, top: 'indigoDeep', bottom: 'purpleDeep' }, // 00:00 deepest night
      { at: 0.21, top: 'purpleDeep', bottom: 'skyDawnLow' }, // 05:00 horizon warming
      { at: 0.29, top: 'skyDayHigh', bottom: 'skyDayLow' }, // 07:00 day
      { at: 0.69, top: 'skyDuskHigh', bottom: 'skyDuskLow' }, // 16:30 sunset
      { at: 0.78, top: 'skyNightHigh', bottom: 'skyNightLow' }, // 18:45 nightfall — the M1 look
    ],
  },

  /**
   * Event pool. `meanSpawnIntervalSeconds` is the mean of an exponential distribution, not a
   * period: §5.3 warns that a fixed grid feels quantised even with random outcomes.
   *
   * `maxConcurrent: 4` is the global cap that keeps the scene from feeling crowded. Two events
   * is all M2 calls for; the rest of the set arrives at M4.
   */
  events: {
    meanSpawnIntervalSeconds: 18,
    maxConcurrent: 4,
    events: [ghostDrift, batFlutter],
  },

  props: [
    // ---- Layer 1: sky & luminescence anchor (parallax 0) -------------------------------
    // Halo first so the moon draws over it.
    { kind: 'circle', id: 'moon-halo', layer: 'sky', color: 'moonHalo', x: 478, y: 74, radius: 24 },
    { kind: 'circle', id: 'moon', layer: 'sky', color: 'moonAmber', x: 478, y: 74, radius: 20 },

    { kind: 'rect', id: 'star-01', layer: 'sky', color: 'lavenderMid', x: 48, y: 34, width: 2, height: 2 },
    { kind: 'rect', id: 'star-02', layer: 'sky', color: 'lavenderMid', x: 112, y: 62, width: 1, height: 1 },
    { kind: 'rect', id: 'star-03', layer: 'sky', color: 'lavenderMid', x: 168, y: 26, width: 2, height: 2 },
    { kind: 'rect', id: 'star-04', layer: 'sky', color: 'lavenderMid', x: 214, y: 88, width: 1, height: 1 },
    { kind: 'rect', id: 'star-05', layer: 'sky', color: 'lavenderMid', x: 266, y: 44, width: 2, height: 2 },
    { kind: 'rect', id: 'star-06', layer: 'sky', color: 'lavenderMid', x: 322, y: 70, width: 1, height: 1 },
    { kind: 'rect', id: 'star-07', layer: 'sky', color: 'lavenderMid', x: 372, y: 30, width: 2, height: 2 },
    { kind: 'rect', id: 'star-08', layer: 'sky', color: 'lavenderMid', x: 402, y: 118, width: 1, height: 1 },
    { kind: 'rect', id: 'star-09', layer: 'sky', color: 'lavenderMid', x: 552, y: 52, width: 2, height: 2 },
    { kind: 'rect', id: 'star-10', layer: 'sky', color: 'lavenderMid', x: 596, y: 100, width: 1, height: 1 },
    { kind: 'rect', id: 'star-11', layer: 'sky', color: 'lavenderMid', x: 90, y: 138, width: 1, height: 1 },
    { kind: 'rect', id: 'star-12', layer: 'sky', color: 'lavenderMid', x: 292, y: 150, width: 1, height: 1 },

    // ---- Layer 2: distant backdrop (parallax 0.08) ------------------------------------
    // Low ambient cloud bands, per §5.5. Flat and wide — they read as haze, not as objects.
    {
      kind: 'shape', id: 'cloud-high', layer: 'backdrop', color: 'purpleMid',
      points: [-32, 196, 120, 190, 260, 198, 300, 194, 340, 200, 260, 206, 120, 202, -32, 206],
    },
    {
      kind: 'shape', id: 'cloud-low', layer: 'backdrop', color: 'purpleMid',
      points: [300, 222, 430, 216, 560, 224, 672, 220, 672, 232, 540, 234, 420, 228, 300, 232],
    },

    // Far hills. One continuous mass; the depth cue is tone, not outline detail.
    {
      kind: 'shape', id: 'far-hills', layer: 'backdrop', color: 'silhouetteFar',
      points: [-32, 258, 80, 246, 180, 252, 280, 242, 380, 250, 480, 240, 580, 248, 672, 244, 672, 360, -32, 360],
    },

    // A far steeple on the hill line — Salem in the distance, seen from the graveyard.
    { kind: 'rect', id: 'far-tower', layer: 'backdrop', color: 'silhouetteFar', x: 204, y: 214, width: 14, height: 42 },
    {
      kind: 'shape', id: 'far-spire', layer: 'backdrop', color: 'silhouetteFar',
      points: [201, 216, 211, 184, 221, 216],
    },
    {
      kind: 'shape', id: 'far-roof-a', layer: 'backdrop', color: 'silhouetteFar',
      points: [228, 240, 246, 226, 264, 240, 264, 256, 228, 256],
    },
    {
      kind: 'shape', id: 'far-roof-b', layer: 'backdrop', color: 'silhouetteFar',
      points: [494, 238, 510, 226, 526, 238, 526, 252, 494, 252],
    },

    // ---- Layer 3: midground & spawner plane (parallax 0.5) ----------------------------
    // The action plane. ~90% of dynamic sprites will traverse here from M2 on (§5.5).
    {
      kind: 'shape', id: 'ground', layer: 'midground', color: 'purpleDeep',
      points: [-32, 270, 160, 266, 340, 272, 520, 265, 672, 269, 672, 360, -32, 360],
    },

    // Mausoleum — carries the one lit window, which is the scene's second warm note.
    { kind: 'rect', id: 'mausoleum-body', layer: 'midground', color: 'silhouetteMid', x: 258, y: 214, width: 56, height: 58 },
    {
      kind: 'shape', id: 'mausoleum-roof', layer: 'midground', color: 'silhouetteMid',
      points: [250, 216, 286, 194, 322, 216],
    },
    { kind: 'rect', id: 'mausoleum-window', layer: 'midground', color: 'windowAmber', x: 280, y: 230, width: 11, height: 15 },

    // Tombstones. Solid shapes, varied heights, deliberately uneven spacing.
    { kind: 'rect', id: 'stone-01', layer: 'midground', color: 'silhouetteMid', x: 42, y: 240, width: 18, height: 30 },
    { kind: 'rect', id: 'stone-02', layer: 'midground', color: 'silhouetteMid', x: 78, y: 248, width: 13, height: 22 },
    { kind: 'rect', id: 'cross-post', layer: 'midground', color: 'silhouetteMid', x: 124, y: 230, width: 6, height: 42 },
    { kind: 'rect', id: 'cross-arm', layer: 'midground', color: 'silhouetteMid', x: 116, y: 240, width: 22, height: 6 },
    { kind: 'rect', id: 'stone-03', layer: 'midground', color: 'silhouetteMid', x: 170, y: 244, width: 20, height: 27 },
    { kind: 'rect', id: 'stone-04', layer: 'midground', color: 'silhouetteMid', x: 206, y: 252, width: 12, height: 19 },
    { kind: 'rect', id: 'stone-05', layer: 'midground', color: 'silhouetteMid', x: 344, y: 236, width: 16, height: 35 },
    { kind: 'rect', id: 'stone-06', layer: 'midground', color: 'silhouetteMid', x: 376, y: 250, width: 12, height: 21 },
    { kind: 'rect', id: 'stone-07', layer: 'midground', color: 'silhouetteMid', x: 410, y: 242, width: 21, height: 29 },
    { kind: 'rect', id: 'stone-08', layer: 'midground', color: 'silhouetteMid', x: 556, y: 246, width: 15, height: 25 },
    { kind: 'rect', id: 'stone-09', layer: 'midground', color: 'silhouetteMid', x: 588, y: 252, width: 11, height: 19 },

    // Iron railing on the right. Rail plus posts — a shape, not a rendering of wrought iron.
    { kind: 'rect', id: 'rail', layer: 'midground', color: 'silhouetteMid', x: 452, y: 250, width: 220, height: 3 },
    { kind: 'rect', id: 'rail-post-1', layer: 'midground', color: 'silhouetteMid', x: 454, y: 246, width: 3, height: 25 },
    { kind: 'rect', id: 'rail-post-2', layer: 'midground', color: 'silhouetteMid', x: 476, y: 248, width: 3, height: 23 },
    { kind: 'rect', id: 'rail-post-3', layer: 'midground', color: 'silhouetteMid', x: 498, y: 248, width: 3, height: 23 },
    { kind: 'rect', id: 'rail-post-4', layer: 'midground', color: 'silhouetteMid', x: 520, y: 248, width: 3, height: 23 },
    { kind: 'rect', id: 'rail-post-5', layer: 'midground', color: 'silhouetteMid', x: 542, y: 248, width: 3, height: 23 },
    { kind: 'rect', id: 'rail-post-6', layer: 'midground', color: 'silhouetteMid', x: 620, y: 248, width: 3, height: 23 },
    { kind: 'rect', id: 'rail-post-7', layer: 'midground', color: 'silhouetteMid', x: 642, y: 246, width: 3, height: 25 },

    // ---- Layer 4: foreground framing (parallax 1.0) ----------------------------------
    // This layer's real job is hiding the window boundary, which is what stops the scene
    // reading as a video in a box (§5.5). Hence the heavy masses on both edges and the branch
    // across the top.
    {
      kind: 'shape', id: 'tree-trunk-left', layer: 'foreground', color: 'silhouetteNear',
      points: [-48, -20, 34, -20, 44, 64, 33, 148, 48, 244, 28, 306, 40, 380, -48, 380],
    },
    {
      kind: 'shape', id: 'branch-upper', layer: 'foreground', color: 'silhouetteNear',
      points: [-48, -20, 300, -20, 356, 12, 318, 20, 262, 34, 196, 28, 128, 40, 58, 30, -48, 36],
    },
    {
      kind: 'shape', id: 'branch-twig', layer: 'foreground', color: 'silhouetteNear',
      points: [196, 28, 232, 46, 258, 72, 250, 74, 224, 50, 190, 34],
    },
    {
      kind: 'shape', id: 'tree-mass-right', layer: 'foreground', color: 'silhouetteNear',
      points: [604, -20, 688, -20, 688, 380, 598, 380, 614, 282, 602, 162, 618, 46],
    },
    {
      kind: 'shape', id: 'branch-right', layer: 'foreground', color: 'silhouetteNear',
      points: [688, 30, 688, 60, 592, 70, 524, 52, 470, 56, 476, 44, 528, 40, 594, 56],
    },

    // Near ground lip, and grass blades breaking the bottom edge.
    {
      kind: 'shape', id: 'near-ground', layer: 'foreground', color: 'silhouetteNear',
      points: [-48, 350, 180, 344, 380, 352, 560, 346, 688, 350, 688, 380, -48, 380],
    },
    { kind: 'shape', id: 'grass-a', layer: 'foreground', color: 'silhouetteNear', points: [214, 350, 220, 328, 226, 350] },
    { kind: 'shape', id: 'grass-b', layer: 'foreground', color: 'silhouetteNear', points: [232, 350, 240, 334, 246, 350] },
    { kind: 'shape', id: 'grass-c', layer: 'foreground', color: 'silhouetteNear', points: [396, 352, 402, 330, 410, 352] },
    { kind: 'shape', id: 'grass-d', layer: 'foreground', color: 'silhouetteNear', points: [418, 352, 427, 338, 434, 352] },
    { kind: 'shape', id: 'grass-e', layer: 'foreground', color: 'silhouetteNear', points: [498, 348, 505, 326, 513, 348] },

    // Jack-o'-lantern. The face is *filled* with an emitter colour rather than cut out — a
    // cut-out shows the sky through it and reads as a hole, not a glow (reference/README.md).
    { kind: 'circle', id: 'pumpkin-body', layer: 'foreground', color: 'silhouetteNear', x: 104, y: 336, radius: 17 },
    { kind: 'shape', id: 'pumpkin-eye-l', layer: 'foreground', color: 'pumpkinGlow', points: [95, 330, 102, 330, 98, 337] },
    { kind: 'shape', id: 'pumpkin-eye-r', layer: 'foreground', color: 'pumpkinGlow', points: [107, 330, 114, 330, 111, 337] },
    { kind: 'shape', id: 'pumpkin-mouth', layer: 'foreground', color: 'pumpkinGlow', points: [96, 342, 113, 342, 109, 348, 100, 348] },
  ],
}
