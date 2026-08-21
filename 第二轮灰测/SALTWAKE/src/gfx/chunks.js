/**
 * SALTWAKE — shared GLSL.
 *
 * The three effects that actually date a renderer to 1997 are all here:
 *
 *  1. Affine texture mapping. Hardware of the period interpolated UVs linearly
 *     in screen space instead of dividing by w, so textures swim as geometry
 *     turns. swAffineUv() reproduces it exactly: passing uv*w and w as separate
 *     varyings and dividing them back in the fragment stage cancels the
 *     rasteriser's perspective correction and leaves screen-linear UVs.
 *
 *  2. Vertex snapping. Vertices were transformed to integer screen coordinates,
 *     so surfaces jitter and seams open as the camera moves. swSnapVertex()
 *     quantises clip-space XY to the low-resolution pixel lattice.
 *
 *  3. Per-vertex lighting. There were no per-pixel lights; illumination was
 *     baked into vertex colours and a small number of dynamic lights were
 *     evaluated per vertex. That is what gives the era its blotchy, soft
 *     falloff.
 *
 * Fog is layered rather than a single distance curve: a squared distance term
 * for the wall of sea fog, a height term for the ground layer that pools in the
 * streets, and a directional bleed towards the dominant light.
 */

/* ------------------------------------------------------------------ *
 * Math, hashes, dithering
 * ------------------------------------------------------------------ */
export const SW_MATH = /* glsl */ `
#ifndef SW_PI
#define SW_PI 3.141592653589793
#endif

float swHash11(float p){
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

float swHash21(vec2 p){
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float swNoise(vec2 p){
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = swHash21(i);
  float b = swHash21(i + vec2(1.0, 0.0));
  float c = swHash21(i + vec2(0.0, 1.0));
  float d = swHash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float swFbm(vec2 p){
  float s = 0.0;
  float a = 0.5;
  float n = 0.0;
  mat2 r = mat2(1.62, 1.18, -1.18, 1.62);
  for (int i = 0; i < 4; i++){
    s += a * swNoise(p);
    n += a;
    p = r * p;
    a *= 0.5;
  }
  return s / max(n, 1e-4);
}

/* Ordered dither, period-correct: a 4x4 Bayer pattern built without lookups. */
float swBayer2(vec2 a){
  a = floor(a);
  return fract(dot(a, vec2(0.5, a.y * 0.75)));
}
#define SW_BAYER4(a) (swBayer2(0.5 * (a)) * 0.25 + swBayer2(a))
#define SW_BAYER8(a) (SW_BAYER4(0.5 * (a)) * 0.25 + swBayer2(a))
`;

/* ------------------------------------------------------------------ *
 * Vertex-stage retro transforms
 * ------------------------------------------------------------------ */
/** Per-frame values every stage of every material needs. */
export const SW_FRAME_UNIFORMS = /* glsl */ `
uniform float uTime;
uniform vec3  uCameraPos;
uniform vec2  uResolution;     // internal render target size, in pixels
`;

export const SW_RETRO_VERT = /* glsl */ `
uniform float uVertexJitter;   // 0 = smooth, 1 = full lattice snapping

/**
 * Quantise clip-space XY onto the low-resolution pixel lattice. Geometry behind
 * the eye is left alone so the guard band still clips correctly.
 */
vec4 swSnapVertex(vec4 clip){
  if (uVertexJitter <= 0.0001 || clip.w < 0.02) return clip;
  vec2 half_ = uResolution * 0.5;
  vec2 ndc = clip.xy / clip.w;
  vec2 snapped = floor(ndc * half_ + 0.5) / half_;
  return vec4(mix(ndc, snapped, uVertexJitter) * clip.w, clip.z, clip.w);
}
`;

/**
 * Affine UV plumbing. Include SW_AFFINE_VARY in both stages, call
 * swAffineSetup() in the vertex stage after gl_Position is known, and
 * swAffineUv() in the fragment stage.
 */
export const SW_AFFINE_VARY = /* glsl */ `
varying vec2 vUvPersp;   // perspective-correct
varying vec2 vUvOverW;   // uv * w, which the rasteriser un-divides
varying float vClipW;    // w, likewise
`;

export const SW_AFFINE_VERT = /* glsl */ `
void swAffineSetup(vec2 texcoord, vec4 clip){
  vUvPersp = texcoord;
  vUvOverW = texcoord * clip.w;
  vClipW = clip.w;
}
`;

export const SW_AFFINE_FRAG = /* glsl */ `
uniform float uAffine;

/**
 * Screen-linear UVs. Interpolating uv*w and w perspective-correctly and then
 * dividing yields sum(lambda_i * uv_i): exactly what a 1997 rasteriser without
 * perspective correction produced.
 */
vec2 swAffineUv(){
  vec2 affine = vUvOverW / max(vClipW, 1e-4);
  return mix(vUvPersp, affine, clamp(uAffine, 0.0, 1.0));
}
`;

/* ------------------------------------------------------------------ *
 * Lighting: baked vertex colour plus a small dynamic light array
 * ------------------------------------------------------------------ */
/** Sky and moon. Needed by both stages: the vertex bake and the fog bleed. */
export const SW_SKY_UNIFORMS = /* glsl */ `
uniform vec3  uAmbient;
uniform vec3  uSkyColor;
uniform vec3  uMoonDir;
uniform vec3  uMoonColor;
`;

/** The dynamic light array is evaluated per vertex, so only that stage sees it. */
export const SW_LIGHT_ARRAY_UNIFORMS = /* glsl */ `
uniform int   uLightCount;
uniform vec4  uLightPos[SW_MAX_LIGHTS];    // xyz position, w radius
uniform vec3  uLightColor[SW_MAX_LIGHTS];
`;

export const SW_LIGHT_VERT = /* glsl */ `
/**
 * Dynamic contribution at a world position, evaluated per vertex the way the
 * period's software and early hardware pipelines did. Inverse-square falloff
 * with a windowed cutoff so a light never reaches past its radius.
 */
vec3 swDynamicLight(vec3 worldPos, vec3 worldNormal){
  vec3 sum = vec3(0.0);
  for (int i = 0; i < SW_MAX_LIGHTS; i++){
    if (i >= uLightCount) break;
    vec4 L = uLightPos[i];
    vec3 d = L.xyz - worldPos;
    float dist2 = dot(d, d);
    float radius = max(L.w, 0.001);
    if (dist2 > radius * radius) continue;
    float dist = sqrt(dist2);
    float atten = 1.0 - dist / radius;
    atten = atten * atten / (1.0 + dist * 0.35);
    float lambert = max(dot(worldNormal, d / max(dist, 1e-4)), 0.0);
    // Half-lambert: the era's lights wrapped rather than falling to black.
    lambert = lambert * 0.72 + 0.28;
    sum += uLightColor[i] * (atten * lambert);
  }
  return sum;
}

/** Ambient plus moon, for surfaces the bake could not see. */
vec3 swAmbientLight(vec3 worldNormal){
  float up = clamp(worldNormal.y * 0.5 + 0.5, 0.0, 1.0);
  vec3 sky = mix(uAmbient, uSkyColor, up);
  float moon = max(dot(worldNormal, uMoonDir), 0.0);
  return sky + uMoonColor * (moon * 0.55 + 0.12);
}
`;

/* ------------------------------------------------------------------ *
 * Fog
 * ------------------------------------------------------------------ */
export const SW_FOG_UNIFORMS = /* glsl */ `
uniform vec3  uFogNear;
uniform vec3  uFogFar;
uniform float uFogDensity;
uniform float uFogStart;
uniform float uFogPower;
uniform float uFogLayerY;
uniform float uFogLayerFalloff;
uniform float uFogBleed;
uniform float uFogBreath;
`;

export const SW_FOG_FRAG = /* glsl */ `
/**
 * Layered sea fog. A squared distance term gives the hard wall the harbour has,
 * a height term pools the mist in the streets, and a slow breathing noise keeps
 * the wall from looking like a fixed radius.
 */
float swFogAmount(vec3 worldPos){
  float dist = length(worldPos - uCameraPos);
  float breath = 1.0 + (swFbm(worldPos.xz * 0.045 + uTime * 0.02) - 0.5) * uFogBreath;
  float d = max(dist - uFogStart, 0.0) * uFogDensity * breath;
  float f = 1.0 - exp(-pow(d, uFogPower));
  float layer = exp(-max(worldPos.y - uFogLayerY, 0.0) * uFogLayerFalloff);
  return clamp(f * mix(0.62, 1.0, layer), 0.0, 1.0);
}

/** Fog colour, warmed towards whatever light is bleeding through it. */
vec3 swFogColor(vec3 worldPos, vec3 viewDir){
  float height = clamp((worldPos.y - uFogLayerY) * 0.12 + 0.5, 0.0, 1.0);
  vec3 base = mix(uFogNear, uFogFar, height);
  float bleed = pow(clamp(dot(normalize(viewDir), uMoonDir) * 0.5 + 0.5, 0.0, 1.0), 3.0);
  return mix(base, uMoonColor * 0.55 + base * 0.6, bleed * uFogBleed);
}

vec3 swApplyFog(vec3 color, vec3 worldPos){
  vec3 viewDir = normalize(worldPos - uCameraPos);
  return mix(color, swFogColor(worldPos, viewDir), swFogAmount(worldPos));
}
`;

/* ------------------------------------------------------------------ *
 * Composite-stage grading. Used by the post pass only.
 * ------------------------------------------------------------------ */
export const SW_GRADE_FRAG = /* glsl */ `
uniform vec3  uGradeShadow;
uniform vec3  uGradeMid;
uniform vec3  uGradeHigh;
uniform float uGradeTint;
uniform float uGradeLift;
uniform float uGradeGamma;
uniform float uGradeGain;
uniform float uSaturation;
uniform float uContrast;

/**
 * Three-point tint: shadows cool, mid-tones damp, highlights sickly.
 *
 * Each anchor is normalised to unit luminance first so it carries only its hue.
 * Multiplying the image by an anchor directly would crush the frame: a mid-grey
 * anchor has a luminance near 0.08 in linear light, which is a 12x darkening.
 */
vec3 swNormaliseTint(vec3 t){
  float l = max(dot(t, vec3(0.299, 0.587, 0.114)), 1e-4);
  return t / l;
}

vec3 swGrade(vec3 c){
  float luma = dot(c, vec3(0.299, 0.587, 0.114));
  float shadowW = 1.0 - smoothstep(0.0, 0.45, luma);
  float highW = smoothstep(0.45, 1.0, luma);
  float midW = max(0.0, 1.0 - shadowW - highW);

  vec3 tint = swNormaliseTint(uGradeShadow) * shadowW
            + swNormaliseTint(uGradeMid) * midW
            + swNormaliseTint(uGradeHigh) * highW;
  c *= mix(vec3(1.0), tint, clamp(uGradeTint, 0.0, 1.0));

  c = (c - 0.5) * uContrast + 0.5;
  c = pow(max(c + uGradeLift, 0.0), vec3(uGradeGamma)) * uGradeGain;

  float g = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(vec3(g), c, uSaturation);
  return c;
}

vec3 swToneMap(vec3 x){
  // A blunt filmic curve. The era clipped hard; this clips almost as hard.
  x = max(x, vec3(0.0));
  return x / (x + 0.72) * 1.38;
}

vec3 swLinearToSrgb(vec3 c){
  c = max(c, vec3(0.0));
  return mix(c * 12.92, pow(c, vec3(0.41666667)) * 1.055 - 0.055, step(vec3(0.0031308), c));
}
`;

/** Assemble a world-surface fragment shader from the standard blocks. */
export function worldFragmentPrelude() {
  return [SW_MATH, SW_FRAME_UNIFORMS, SW_AFFINE_VARY, SW_AFFINE_FRAG, SW_SKY_UNIFORMS, SW_FOG_UNIFORMS, SW_FOG_FRAG].join('\n');
}

/** Assemble a world-surface vertex shader from the standard blocks. */
export function worldVertexPrelude() {
  return [SW_MATH, SW_FRAME_UNIFORMS, SW_AFFINE_VARY, SW_AFFINE_VERT, SW_RETRO_VERT, SW_SKY_UNIFORMS, SW_LIGHT_ARRAY_UNIFORMS, SW_LIGHT_VERT].join('\n');
}
