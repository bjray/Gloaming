import { Filter, Graphics } from 'pixi.js'
import type { SkyGradient } from '@schema/sky'
import type { LayerSet } from './layers'
import { resolveRgb } from './palette'
import { VIRTUAL_HEIGHT, VIRTUAL_WIDTH } from './stage'

/**
 * Ordered (Bayer 4×4) dithered gradient. See DECISIONS.md, "Sky architecture".
 *
 * The Bayer value is computed arithmetically rather than from a lookup table. The recursive
 * `bayer2` → `bayer4` construction needs no array indexing, which keeps the shader valid whether
 * PixiJS compiles it as GLSL ES 3.0 or injects its WebGL1 compatibility macros — dynamic
 * indexing into a local array is not reliably supported in the latter.
 *
 * Verify `bayer2` by hand: fract(x/2 + y²·0.75) over the 2×2 grid gives
 * (0,0)→0, (1,0)→0.5, (0,1)→0.75, (1,1)→0.25, i.e. the standard [[0,2],[3,1]]/4 matrix.
 *
 * The dither is applied *before* quantisation, so it perturbs which band a pixel falls into
 * rather than tinting it afterwards. That is what turns a hard boundary into a stippled
 * transition instead of a blurred one — the stipple stays on the pixel grid, which is what reads
 * as intentional within the pixel idiom.
 */
/**
 * PixiJS's own default filter vertex shader, inlined.
 *
 * It is not re-exported from the `pixi.js` root, and `GlProgramOptions` requires a vertex stage
 * even though the docs describe fragment-only filters — so it is spelled out here rather than
 * reached for through an internal subpath that may move between versions.
 */
const DITHER_VERTEX = /* glsl */ `
in vec2 aPosition;
out vec2 vTextureCoord;

uniform highp vec4 uInputSize;
uniform highp vec4 uOutputFrame;
uniform highp vec4 uOutputTexture;

vec4 filterVertexPosition(void) {
    vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
    position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
    position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
    return vec4(position, 0.0, 1.0);
}

vec2 filterTextureCoord(void) {
    return aPosition * (uOutputFrame.zw * uInputSize.zw);
}

void main(void) {
    gl_Position = filterVertexPosition();
    vTextureCoord = filterTextureCoord();
}
`

/**
 * Ordered (Bayer 4x4) dithered gradient. See DECISIONS.md, "Sky architecture".
 *
 * The Bayer value is computed arithmetically rather than from a lookup table. The recursive
 * `bayer2` -> `bayer4` construction needs no array indexing, which keeps the shader valid whether
 * PixiJS compiles it as GLSL ES 3.0 or injects its WebGL1 compatibility macros - dynamic
 * indexing into a local array is not reliably supported in the latter.
 *
 * Verify `bayer2` by hand: fract(x/2 + y^2*0.75) over the 2x2 grid gives
 * (0,0)->0, (1,0)->0.5, (0,1)->0.75, (1,1)->0.25, i.e. the standard [[0,2],[3,1]]/4 matrix.
 *
 * Two coordinate spaces matter here and conflating them is the easy mistake:
 *  - `vTextureCoord` is normalised against the *input texture*, which PixiJS may size larger
 *    than the filter area. Dividing by `uOutputFrame.zw * uInputSize.zw` recovers a true 0-1
 *    across the quad, which is what the gradient position must be measured in.
 * `uInputSize` and `uOutputFrame` carry an explicit `highp` in *both* stages. PixiJS injects a
 * default precision per stage - highp for vertex, mediump for fragment - so a uniform declared
 * in both without a qualifier links with mismatched precision and the program is rejected
 * outright ("Precisions of uniform 'uInputSize' differ between VERTEX and FRAGMENT shaders").
 *
 *  - The dither grid must instead be indexed in real texels (`vTextureCoord * uInputSize.xy`),
 *    so the 4x4 pattern lands on whole virtual pixels. That is the entire point of dithering at
 *    pixel scale (BRIEF.md 5.4); measuring it in normalised space would smear the pattern.
 *
 * The dither is applied *before* quantisation, so it perturbs which band a pixel falls into
 * rather than tinting it afterwards. That is what turns a hard boundary into a stippled
 * transition instead of a blurred one - the stipple stays on the pixel grid, which is what reads
 * as intentional within the pixel idiom.
 */
const DITHER_FRAGMENT = /* glsl */ `
in vec2 vTextureCoord;
out vec4 finalColor;

uniform highp vec4 uInputSize;
uniform highp vec4 uOutputFrame;

uniform vec3 uTopColor;
uniform vec3 uBottomColor;
uniform float uBands;
uniform float uDither;

float bayer2(vec2 a) {
    a = floor(a);
    return fract(a.x / 2.0 + a.y * a.y * 0.75);
}

float bayer4(vec2 a) {
    return bayer2(0.5 * a) * 0.25 + bayer2(a);
}

void main(void) {
    vec2 span = uOutputFrame.zw * uInputSize.zw;
    vec2 uv = vTextureCoord / max(span, vec2(1e-6));
    float t = clamp(uv.y, 0.0, 1.0);

    // Dither threshold centred on zero so it nudges evenly in both directions.
    vec2 texel = vTextureCoord * uInputSize.xy;
    float threshold = bayer4(texel) - 0.5;

    float bands = max(uBands, 1.0);
    float dithered = t + threshold * (uDither / bands);
    float banded = clamp(floor(dithered * bands + 0.5) / bands, 0.0, 1.0);

    finalColor = vec4(mix(uTopColor, uBottomColor, banded), 1.0);
}
`

export interface Sky {
  /**
   * Retint the gradient. M1 calls this once with fixed night colours; M2 will call it from the
   * Time Broker's continuous `dayPhase`, with no change needed here — which is the entire
   * reason the gradient is procedural rather than an authored texture.
   */
  setGradient(gradient: SkyGradient): void
  /**
   * Unbind the filter, leaving the quad in place.
   *
   * The primitive scene rotation will want at M7: swap what the sky is showing without
   * destroying and rebuilding the renderer.
   *
   * Note on a known, benign warning. Tearing the *renderer* down emits two PixiJS warnings —
   * "a 'textureSource'/'textureSampler' was destroyed while still bound to a shader" — because
   * the filter system leaves the pooled render texture from the last filtered frame bound in
   * its bind group, and `app.destroy()` then sweeps the texture pool. Established by bisecting
   * the teardown chain: the warnings come from `app.destroy()` alone, after every resource this
   * project owns has already been released, and they do not reproduce in a minimal app with
   * either a built-in or an equivalent custom filter. Detaching clears it only once PixiJS's
   * texture GC has run (~600ms of frames), which a synchronous teardown cannot guarantee, so it
   * is not worth contorting `dispose()` for. It costs nothing at runtime: the only caller of
   * `app.destroy()` is page unload, and M7's scene rotation swaps scenes without destroying the
   * renderer, so rotation will not hit this path at all.
   */
  detach(): void
  destroy(): void
}

/**
 * Build the sky's base gradient into the `sky` layer.
 *
 * Cloud striations are *not* part of this: per the hybrid decision they arrive as ordinary
 * sprite or shape props on the `sky` and `backdrop` layers, composited over this gradient and
 * tinted from the same day phase. Keeping them separate is what lets the gradient interpolate
 * continuously while the clouds stay hand-authored.
 */
export function createSky(gradient: SkyGradient, layers: LayerSet): Sky {
  const topColor = resolveRgb(gradient.top)
  const bottomColor = resolveRgb(gradient.bottom)

  const filter = Filter.from({
    gl: { vertex: DITHER_VERTEX, fragment: DITHER_FRAGMENT },
    resources: {
      skyUniforms: {
        uTopColor: { value: topColor, type: 'vec3<f32>' },
        uBottomColor: { value: bottomColor, type: 'vec3<f32>' },
        uBands: { value: gradient.bands, type: 'f32' },
        uDither: { value: gradient.dither, type: 'f32' },
      },
    },
  })

  // Padding would expand the filter area beyond the quad and skew vTextureCoord off the 0–1
  // range the gradient depends on.
  filter.padding = 0

  // A plain quad exactly covering the virtual canvas. The filter ignores its colour entirely and
  // computes the gradient from vTextureCoord, so this is purely a surface to shade.
  //
  // Graphics rather than Sprite(Texture.WHITE) on purpose: `Texture.WHITE` is a shared global
  // that PixiJS also uses internally to back solid fills, so holding it here entangles this
  // module's teardown with the renderer's. Graphics owns its own geometry and releases it on
  // destroy, which keeps ownership local.
  const quad = new Graphics({ label: 'sky-gradient' })
  quad.rect(0, 0, VIRTUAL_WIDTH, VIRTUAL_HEIGHT).fill({ color: 0xffffff })
  quad.filters = [filter]

  layers.containers.sky.addChild(quad)

  const uniforms = filter.resources['skyUniforms'] as {
    uniforms: {
      uTopColor: Float32Array
      uBottomColor: Float32Array
      uBands: number
      uDither: number
    }
  }

  return {
    setGradient(next: SkyGradient): void {
      // Written in place: no allocation, so this stays safe to call at day-phase cadence.
      resolveRgb(next.top, topColor)
      resolveRgb(next.bottom, bottomColor)
      uniforms.uniforms.uTopColor = topColor
      uniforms.uniforms.uBottomColor = bottomColor
      uniforms.uniforms.uBands = next.bands
      uniforms.uniforms.uDither = next.dither
    },
    detach(): void {
      quad.filters = []
    },
    destroy(): void {
      // Detach before destroying: a filter torn down while still bound to a display object
      // leaves PixiJS holding a reference to dead GPU resources.
      quad.filters = []
      quad.destroy()
      filter.destroy()
    },
  }
}
