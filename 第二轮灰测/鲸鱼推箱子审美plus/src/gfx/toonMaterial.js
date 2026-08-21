/**
 * Toon material used by every solid surface: tree trunks, canopies, stones,
 * fences, the signpost, the crates and the whale.
 *
 * It shares the grass shader's lighting model exactly — the same stepped ramp,
 * the same HDRI probe, the same cloud-shadow field, the same fog — so a crate
 * sitting in the meadow is lit by the same maths as the blades around it.
 *
 * Optional features are compiled in with defines:
 *   DSH_SWAY    per-vertex wind sway around a per-vertex origin, driven by the
 *               same stop-motion clock as the grass (canopies breathe with the
 *               gusts that lay the meadow over)
 *   DSH_VCOLOR  per-vertex palette colour
 *   DSH_MAP     pixel-art atlas with frame selection
 */
import * as THREE from 'three';
import { withShared } from '../core/env.js';
import { GLSL_MATH, GLSL_SHARED_UNIFORMS, GLSL_LIGHTING, GLSL_LIGHTING_FRAG } from './shaderChunks.js';

const VERT = [GLSL_MATH, GLSL_SHARED_UNIFORMS, GLSL_LIGHTING, /* glsl */ `
#ifdef DSH_VCOLOR
attribute vec3 color;
varying vec3 vColor;
#endif
#ifdef DSH_SWAY
attribute vec3 aOrigin;   // world-space anchor the sway pivots around
attribute float aSway;    // 0 at the anchor, 1 at the outermost foliage
attribute float aPhase;
uniform float uSwayStrength;
#endif

varying vec3 vWorld;
varying vec3 vNormal;
varying vec2 vUv;
varying float vSway;

void main(){
  vec4 world = modelMatrix * vec4(position, 1.0);
  vec3 wn = normalize(mat3(modelMatrix) * normal);
  float swayAmt = 0.0;

#ifdef DSH_SWAY
  float t = dshStopTime(aPhase);
  vec2 wDir = normalize(uWindDir + 1e-5);
  vec2 wp = aOrigin.xz * uWindScale;
  float l1 = dshNoise(wp * 0.85 - wDir * (t * uWindSpeed * 0.85));
  float l2 = dshNoise(wp * 2.10 - wDir * (t * uWindSpeed * 1.55) + 9.31);
  float gust = smoothstep(0.42, 0.94, dshNoise(wp * 0.31 - wDir * (t * uWindSpeed * 0.40) + 5.77));
  float wind = (l1 * 0.65 + l2 * 0.35 - 0.47) * 2.1 * (1.0 + gust * uGustStrength * 0.7);
  // A branch tip also flicks on its own, one octave faster than the canopy.
  wind += (dshNoise(vec2(aPhase * 41.0, t * 2.6)) - 0.5) * 0.55 * aSway;

  vec3 up = vec3(0.0, 1.0, 0.0);
  vec3 windDir3 = normalize(vec3(wDir.x, 0.0, wDir.y));
  vec3 bendAxis = normalize(cross(up, windDir3));
  float ang = wind * uWindStrength * uSwayStrength * aSway;
  vec3 local = world.xyz - aOrigin;
  world.xyz = aOrigin + dshRotateAxis(local, bendAxis, ang);
  wn = normalize(dshRotateAxis(wn, bendAxis, ang));
  swayAmt = wind * aSway;
#endif

#ifdef DSH_VCOLOR
  vColor = color;
#endif

  vWorld = world.xyz;
  vNormal = wn;
  vUv = uv;
  vSway = swayAmt;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`].join('\n');

const FRAG = [GLSL_MATH, GLSL_SHARED_UNIFORMS, GLSL_LIGHTING, GLSL_LIGHTING_FRAG, /* glsl */ `
uniform vec3  uColor;
uniform float uRim;
uniform float uSpecular;
uniform float uSpecularSteps;
uniform float uTranslucency;
uniform float uShadeFloor;

#ifdef DSH_MAP
uniform sampler2D uMap;
uniform float uFrame;
uniform float uFrames;
uniform float uMapTexels;
uniform float uAlphaTest;
#endif
#ifdef DSH_VCOLOR
varying vec3 vColor;
#endif

varying vec3 vWorld;
varying vec3 vNormal;
varying vec2 vUv;
varying float vSway;

void main(){
  vec3 albedo = uColor;
#ifdef DSH_VCOLOR
  albedo *= vColor;
#endif
#ifdef DSH_MAP
  // Snap to the atlas texel grid, then offset into the requested frame.
  float cols = max(uMapTexels, 1.0);
  float cx = min(floor(vUv.x * cols), cols - 1.0);
  float cy = min(floor(vUv.y * cols), cols - 1.0);
  vec2 fuv = vec2((uFrame + (cx + 0.5) / cols) / uFrames, (cy + 0.5) / cols);
  vec4 texel = texture2D(uMap, fuv);
  if (texel.a < uAlphaTest) discard;
  albedo *= texel.rgb;
#endif

  vec3 N = normalize(vNormal);
  float ndl = dot(N, uSunDir);
  float cloud = dshCloudShadow(vWorld.xz);
  float lit = dshToonRamp(max(ndl, 0.0) * cloud, uToonSteps, uToonSoft);
  lit = max(lit, uShadeFloor);

  vec3 ambient = dshAmbient(N);
  vec3 color = albedo * (ambient + uSunColor * lit);

  // Light through thin foliage: the far side of a canopy glows instead of
  // going black, which is what keeps stepped shading from reading as plastic.
  float wrap = clamp(-ndl * 0.5 + 0.5, 0.0, 1.0);
  color += albedo * uSunColor * (pow(wrap, 2.5) * uTranslucency * cloud);

  // Quantised highlight.
  vec3 V = -normalize(uViewDir);
  vec3 H = normalize(uSunDir + V);
  float spec = pow(max(dot(N, H), 0.0), 26.0);
  color += uSunColor * dshToonRamp(spec, uSpecularSteps, 0.12) * uSpecular * cloud;

  // Rim light picks the silhouette out of the fogged distance.
  float rim = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 3.2);
  color += uSunColor * rim * uRim * mix(0.35, 1.0, lit);

  color = dshApplyFog(color, vWorld);
  gl_FragColor = vec4(color, 1.0);
}
`].join('\n');

/**
 * @param {object} opts
 * @param {boolean} [opts.sway] compile the wind-sway path (needs aOrigin/aSway/aPhase)
 * @param {boolean} [opts.vertexColors] compile per-vertex colour
 * @param {THREE.Texture} [opts.map] pixel-art atlas
 * @param {number} [opts.frames] atlas frame count
 * @param {number} [opts.mapTexels] atlas cell resolution in texels
 */
export function createToonMaterial({
  sway = false,
  vertexColors = false,
  map = null,
  frames = 1,
  mapTexels = 16,
  alphaTest = 0,
  color = 0xffffff,
  rim = 0.16,
  specular = 0.0,
  specularSteps = 2.0,
  translucency = 0.0,
  swayStrength = 0.22,
  shadeFloor = 0.0,
  side = THREE.FrontSide,
  depthWrite = true,
  polygonOffset = 0,
} = {}) {
  const defines = {};
  if (sway) defines.DSH_SWAY = '';
  if (vertexColors) defines.DSH_VCOLOR = '';
  if (map) defines.DSH_MAP = '';

  const uniforms = withShared({
    uColor: { value: new THREE.Color(color) },
    uRim: { value: rim },
    uSpecular: { value: specular },
    uSpecularSteps: { value: specularSteps },
    uTranslucency: { value: translucency },
    uShadeFloor: { value: shadeFloor },
  });
  if (sway) uniforms.uSwayStrength = { value: swayStrength };
  if (map) {
    uniforms.uMap = { value: map };
    uniforms.uFrame = { value: 0 };
    uniforms.uFrames = { value: frames };
    uniforms.uMapTexels = { value: mapTexels };
    uniforms.uAlphaTest = { value: alphaTest };
  }

  return new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    defines,
    uniforms,
    side,
    depthWrite,
    polygonOffset: polygonOffset !== 0,
    polygonOffsetFactor: polygonOffset,
    polygonOffsetUnits: polygonOffset * 2,
    toneMapped: false,
  });
}
