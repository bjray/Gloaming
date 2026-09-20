import type { ColorToken } from '@schema/palette'

/**
 * THE ONLY MODULE PERMITTED HEX COLOUR LITERALS (see CLAUDE.md).
 *
 * Everything else — engine and content alike — refers to colours by token and resolves them
 * through `resolve()`. The `Record<ColorToken, number>` annotation makes an unmapped token a
 * type error rather than a black shape at runtime.
 *
 * Graveyard family: deep purples, mid lavenders, dark indigos (§5.7). The silhouette ramp goes
 * lighter with distance, which is the atmospheric perspective the `salem-day` reference art gets
 * right (see reference/README.md) — near-black in the foreground, lifted and desaturated by the
 * time it reaches the backdrop.
 */
const PALETTE: Readonly<Record<ColorToken, number>> = {
  // Night sky gradient endpoints.
  skyNightHigh: 0x1b1033,
  skyNightLow: 0x4a2b52,

  // Light emitters — the only high-contrast values in the set.
  moonAmber: 0xf2c879,
  moonHalo: 0x7a5c84,
  windowAmber: 0xffc65c,
  pumpkinGlow: 0xff8a3d,

  // Silhouette ramp, far to near.
  silhouetteFar: 0x36214d,
  silhouetteMid: 0x1d1130,
  silhouetteNear: 0x0b0616,

  // Graveyard colour family.
  indigoDeep: 0x120a24,
  purpleDeep: 0x241537,
  purpleMid: 0x3d2454,
  lavenderMid: 0x6b4a7a,
}

/** Resolve a token to a Pixi colour number. */
export function resolve(token: ColorToken): number {
  return PALETTE[token]
}

/**
 * Resolve a token to normalised RGB, for shader uniforms.
 *
 * Writes into `out` when given, so per-frame callers need not allocate (CLAUDE.md forbids
 * allocation in the per-frame loop).
 */
export function resolveRgb(token: ColorToken, out?: Float32Array): Float32Array {
  const hex = PALETTE[token]
  const target = out ?? new Float32Array(3)
  target[0] = ((hex >> 16) & 0xff) / 255
  target[1] = ((hex >> 8) & 0xff) / 255
  target[2] = (hex & 0xff) / 255
  return target
}
