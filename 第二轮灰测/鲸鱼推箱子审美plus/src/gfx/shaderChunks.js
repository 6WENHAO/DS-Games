/**
 * Shared GLSL library.
 *
 * Every material in the project (grass, ground, foliage, low-poly props, sky,
 * composite) is assembled from these chunks so that the whole frame shares one
 * lighting model, one cloud-shadow field, one fog curve and one palette
 * quantiser. That shared math is what makes the pixel-art grass, the trees, the
 * dirt road and the crates read as a single art style.
 */

/* ------------------------------------------------------------------ *
 * Constants + hashes + value noise
 * ------------------------------------------------------------------ */
export const GLSL_MATH = /* glsl */ `
#ifndef DSH_PI
#define DSH_PI 3.141592653589793
#define DSH_TWO_PI 6.283185307179586
#endif

float dshHash11(float p){
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

float dshHash21(vec2 p){
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec2 dshHash22(vec2 p){
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}

/* Bilinear value noise. Cheap, stable across CPU/GPU, and its soft lobes suit
 * broad wind fronts better than gradient noise. */
float dshNoise(vec2 p){
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = dshHash21(i);
  float b = dshHash21(i + vec2(1.0, 0.0));
  float c = dshHash21(i + vec2(0.0, 1.0));
  float d = dshHash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float dshFbm(vec2 p, int octaves){
  float sum = 0.0;
  float amp = 0.5;
  float norm = 0.0;
  mat2 rot = mat2(1.52, 1.22, -1.22, 1.52);
  for (int i = 0; i < 6; i++){
    if (i >= octaves) break;
    sum += amp * dshNoise(p);
    norm += amp;
    p = rot * p;
    amp *= 0.5;
  }
  return sum / max(norm, 1e-5);
}

/* Rodrigues rotation: used for every world-space bend in the project. */
vec3 dshRotateAxis(vec3 v, vec3 axis, float angle){
  float c = cos(angle);
  float s = sin(angle);
  return v * c + cross(axis, v) * s + axis * (dot(axis, v) * (1.0 - c));
}

vec2 dshRotate2(vec2 v, float a){
  float c = cos(a);
  float s = sin(a);
  return vec2(v.x * c - v.y * s, v.x * s + v.y * c);
}

/* Ordered dithering. Keeps the low-res render target from banding while
 * staying inside the pixel-art idiom. */
float dshBayer2(vec2 a){
  a = floor(a);
  return fract(dot(a, vec2(0.5, a.y * 0.75)));
}
#define DSH_BAYER4(a) (dshBayer2(0.5 * (a)) * 0.25 + dshBayer2(a))
#define DSH_BAYER8(a) (DSH_BAYER4(0.5 * (a)) * 0.25 + dshBayer2(a))
`;

/* ------------------------------------------------------------------ *
 * The shared uniform block. Mirrors src/core/env.js exactly.
 * ------------------------------------------------------------------ */
export const GLSL_SHARED_UNIFORMS = /* glsl */ `
uniform float uTime;
uniform float uStopFps;
uniform float uStopMotion;

uniform vec3  uSunDir;        // world-space direction *towards* the sun
uniform vec3  uSunColor;
uniform vec3  uSkyColor;
uniform vec3  uBounceColor;
uniform vec3  uViewDir;       // camera forward, world space

uniform float uToonSteps;
uniform float uToonSoft;
uniform float uAmbientStrength;

uniform vec2  uCloudDir;
uniform float uCloudScale;
uniform float uCloudSpeed;
uniform float uCloudCover;
uniform float uCloudSoft;
uniform float uCloudDark;

uniform vec3  uFogColor;
uniform vec3  uFogSunColor;
uniform float uFogDensity;
uniform float uFogCurve;
uniform float uFogStart;
uniform float uFogHeight;
uniform float uFogHeightFalloff;
uniform vec3  uFocus;         // what the camera is looking at; fog is measured from here

uniform vec2  uWindDir;
uniform float uWindScale;
uniform float uWindSpeed;
uniform float uWindStrength;
uniform float uGustStrength;
`;

/* The ambient probe sampler lives in the fragment-only block: GLSL ES 1.00
 * offers texture2D() to fragment shaders only, so declaring and using it there
 * keeps every vertex stage inside the spec. */
export const GLSL_PROBE_UNIFORMS = /* glsl */ `
uniform sampler2D uIrradiance;   // equirectangular, pre-blurred from the HDRI
uniform float uIrradianceGain;
`;

/* ------------------------------------------------------------------ *
 * Lighting: stepped diffuse with a soft transition band, HDRI ambient,
 * animated cloud shadows, height-aware fog.
 * ------------------------------------------------------------------ */
export const GLSL_LIGHTING = /* glsl */ `
/* Stop-motion clock. A per-element phase in [0,1) staggers which sub-frame
 * each element snaps on, so the field animates at a low frame rate without the
 * whole world ticking in lockstep. */
float dshStopTime(float phase){
  float fps = max(uStopFps, 1.0);
  float stepped = floor(uTime * fps + phase) / fps;
  return mix(uTime, stepped, clamp(uStopMotion, 0.0, 1.0));
}

/* Quantised light response: N plateaus joined by a soft band whose width
 * is uToonSoft. soft -> 0 gives hard cel shading, soft -> 0.5 gives a smooth
 * ramp; the default sits between the two for the hybrid look. */
float dshToonRamp(float x, float steps, float soft){
  float s = clamp(x, 0.0, 1.0) * steps;
  float f = floor(s);
  float k = s - f;
  float band = clamp(soft, 0.001, 0.5);
  float e = smoothstep(0.5 - band, 0.5 + band, k);
  return clamp((f + e) / steps, 0.0, 1.0);
}

/* three.js equirectangular convention, so the same texture can be used as
 * scene.background and as our ambient probe. */
vec2 dshDirToEquirect(vec3 dir){
  dir = normalize(dir);
  float u = atan(dir.z, dir.x) / DSH_TWO_PI + 0.5;
  float v = asin(clamp(dir.y, -1.0, 1.0)) / DSH_PI + 0.5;
  return vec2(u, v);
}

vec3 dshAmbientTint(vec3 normal){
  float upness = clamp(normal.y * 0.5 + 0.5, 0.0, 1.0);
  return mix(uBounceColor, uSkyColor, upness);
}

/* Cloud layer sampled in world XZ and drifting slowly: returns a light
 * multiplier in [uCloudDark, 1]. Grass, ground, trees and props all call this
 * with the same coordinates, so a shadow sweeps across the whole scene as one
 * continuous shape. */
float dshCloudShadow(vec2 worldXZ){
  vec2 drift = normalize(uCloudDir + 1e-5) * (uTime * uCloudSpeed);
  vec2 p = worldXZ * uCloudScale + drift;
  float base = dshFbm(p, 3);
  float detail = dshNoise(p * 2.37 - drift * 0.35 + 13.7);
  float c = base * 0.72 + detail * 0.28;
  float cover = smoothstep(uCloudCover - uCloudSoft, uCloudCover + uCloudSoft, c);
  return mix(1.0, uCloudDark, cover);
}

/* Aerial-perspective fog measured from the camera's focus point rather than the
 * camera plane. Under an orthographic projection every fragment sits at roughly
 * the same distance from the camera, so focus-relative depth is what actually
 * separates the foreground from the treeline. */
vec3 dshApplyFog(vec3 color, vec3 worldPos){
  float dist = length(worldPos - uFocus);
  float d = max(dist - uFogStart, 0.0) * uFogDensity;
  float f = 1.0 - exp(-pow(d, uFogCurve));
  float heightFade = exp(-max(worldPos.y - uFogHeight, 0.0) * uFogHeightFalloff);
  f = clamp(f * mix(0.40, 1.0, heightFade), 0.0, 1.0);
  float sunLobe = pow(clamp(dot(normalize(uViewDir), uSunDir), 0.0, 1.0), 4.0);
  vec3 fogCol = mix(uFogColor, uFogSunColor, sunLobe * 0.75);
  return mix(color, fogCol, f);
}
`;

/**
 * Fragment-only additions: the HDRI probe lookup. Kept separate because
 * texture2D() is not available to vertex shaders in GLSL ES 1.00.
 */
export const GLSL_LIGHTING_FRAG = [GLSL_PROBE_UNIFORMS, /* glsl */ `
/* Diffuse ambient from the pre-blurred radiance map, mixed with a hemisphere
 * tint so the bounce colour stays readable even with a flat probe. */
vec3 dshAmbient(vec3 normal){
  vec3 probe = texture2D(uIrradiance, dshDirToEquirect(normal)).rgb * uIrradianceGain;
  return (probe * 0.75 + dshAmbientTint(normal) * 0.25) * uAmbientStrength;
}
`].join('\n');

/** Assemble a shader from the shared library plus a body. */
export function buildShader(body, { stage = 'fragment', uniforms = true, lighting = true } = {}) {
  return [
    GLSL_MATH,
    uniforms ? GLSL_SHARED_UNIFORMS : '',
    lighting ? GLSL_LIGHTING : '',
    lighting && stage === 'fragment' ? GLSL_LIGHTING_FRAG : '',
    body,
  ].join('\n');
}
