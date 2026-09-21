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
  // Sky ramp. The four warm values are lifted *verbatim* from the hand-authored
  // reference/salem-day-sky-layer1.svg rather than invented, so the palette agrees with the art
  // direction that already exists. See reference/README.md.
  skyNightHigh: 0x1b1033,
  skyNightLow: 0x4a2b52,
  skyDawnLow: 0xc98a7a,
  skyDayHigh: 0xe8865f, // salem-day sky, mid coral
  skyDayLow: 0xf0e7dd, // salem-day sky, pale cream
  skyDuskHigh: 0xd3571e, // salem-day sky, deepest orange
  skyDuskLow: 0xfba989, // salem-day sky, salmon

  // Light emitters — the only high-contrast values in the set.
  moonAmber: 0xf2c879,
  moonHalo: 0x7a5c84,
  windowAmber: 0xffc65c,
  pumpkinGlow: 0xff8a3d,
  ghostPale: 0xbfa8d9,

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

/**
 * Linearly interpolate between two tokens' RGB, writing into `out`.
 *
 * Used to sample the sky ramp every frame, so it must not allocate.
 */
export function lerpRgb(
  fromToken: ColorToken,
  toToken: ColorToken,
  t: number,
  out: Float32Array,
): Float32Array {
  const from = PALETTE[fromToken]
  const to = PALETTE[toToken]
  const k = t < 0 ? 0 : t > 1 ? 1 : t

  const fr = (from >> 16) & 0xff
  const fg = (from >> 8) & 0xff
  const fb = from & 0xff
  const tr = (to >> 16) & 0xff
  const tg = (to >> 8) & 0xff
  const tb = to & 0xff

  out[0] = (fr + (tr - fr) * k) / 255
  out[1] = (fg + (tg - fg) * k) / 255
  out[2] = (fb + (tb - fb) * k) / 255
  return out
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
