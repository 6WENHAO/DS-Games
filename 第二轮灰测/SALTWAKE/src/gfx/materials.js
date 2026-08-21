/**
 * SALTWAKE — materials.
 *
 * Four of them, all sharing the same uniform bus and the same retro vertex
 * pipeline so nothing in the frame looks like it came from a different engine:
 *
 *   world      — level geometry. One atlas, per-face tile rects, baked vertex
 *                light plus the dynamic list, affine UVs, vertex snapping.
 *   billboard  — instanced camera-facing quads for vegetation, fire, smoke and
 *                distant figures. Yaw is quantised into buckets and refreshed at
 *                a low rate, so sprites visibly snap as you circle them.
 *   actor      — flat-shaded low-poly enemies and props with vertex colours.
 *   viewmodel  — the weapon in hand, drawn last with its own near projection so
 *                it never clips into a wall.
 */
import * as THREE from 'three';
import { WORLD, ANIM, RENDER } from '../core/config.js';
import { withShared } from '../core/env.js';
import {
  SW_MATH, SW_FRAME_UNIFORMS, SW_AFFINE_VARY, SW_AFFINE_VERT, SW_AFFINE_FRAG,
  SW_RETRO_VERT, SW_SKY_UNIFORMS, SW_LIGHT_ARRAY_UNIFORMS, SW_LIGHT_VERT,
  SW_FOG_UNIFORMS, SW_FOG_FRAG,
} from './chunks.js';
import { textures } from './textures.js';

const DEFINES = { SW_MAX_LIGHTS: WORLD.maxDynamicLights };

/* ================================================================== *
 * World geometry
 * ================================================================== */

const WORLD_VERT = [
  SW_MATH, SW_FRAME_UNIFORMS, SW_AFFINE_VARY, SW_AFFINE_VERT, SW_RETRO_VERT,
  SW_SKY_UNIFORMS, SW_LIGHT_ARRAY_UNIFORMS, SW_LIGHT_VERT, /* glsl */ `
attribute vec4 aTile;    // atlas rect: offsetU, offsetV, scaleU, scaleV
attribute vec3 color;    // baked light, computed on the CPU at load

varying vec3 vLight;
varying vec3 vWorld;
varying vec4 vTile;

void main(){
  vec3 worldPos = position;                 // level geometry is pre-transformed
  vec3 worldNormal = normalize(normal);

  vec4 clip = projectionMatrix * viewMatrix * vec4(worldPos, 1.0);
  clip = swSnapVertex(clip);
  gl_Position = clip;

  swAffineSetup(uv, clip);

  // Baked bounce plus the live light list, exactly as the era layered them.
  vec3 lit = color + swDynamicLight(worldPos, worldNormal);
  vLight = lit;
  vWorld = worldPos;
  vTile = aTile;
}
`].join('\n');

const WORLD_FRAG = [
  SW_MATH, SW_FRAME_UNIFORMS, SW_AFFINE_VARY, SW_AFFINE_FRAG, SW_SKY_UNIFORMS,
  SW_FOG_UNIFORMS, SW_FOG_FRAG, /* glsl */ `
uniform sampler2D uAtlas;

varying vec3 vLight;
varying vec3 vWorld;
varying vec4 vTile;

void main(){
  // Tiling happens here, not in the sampler: the atlas cannot wrap, so the
  // repeat is taken with fract() inside the face's own rect.
  vec2 uvRaw = swAffineUv();
  vec2 tiled = fract(uvRaw) * vTile.zw + vTile.xy;
  vec3 albedo = texture2D(uAtlas, tiled).rgb;

  vec3 color = albedo * vLight;
  color = swApplyFog(color, vWorld);
  gl_FragColor = vec4(color, 1.0);
}
`].join('\n');

export function createWorldMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader: WORLD_VERT,
    fragmentShader: WORLD_FRAG,
    defines: { ...DEFINES },
    uniforms: withShared({ uAtlas: { value: textures.world.texture } }),
    side: THREE.FrontSide,
    toneMapped: false,
  });
}

/* ================================================================== *
 * Billboards
 * ================================================================== */

const BILLBOARD_VERT = [
  SW_MATH, SW_FRAME_UNIFORMS, SW_AFFINE_VARY, SW_AFFINE_VERT, SW_RETRO_VERT,
  SW_SKY_UNIFORMS, SW_LIGHT_ARRAY_UNIFORMS, SW_LIGHT_VERT, /* glsl */ `
attribute vec3 aPos;      // world anchor, at the base of the sprite
attribute vec2 aSize;     // width, height in metres
attribute vec4 aRect;     // atlas rect
attribute vec3 aTint;
attribute vec2 aFlags;    // x: sway amount, y: animation phase

uniform float uYawSteps;
uniform float uSnapFps;
uniform float uWobble;
uniform float uEmissive;

varying vec3 vLight;
varying vec3 vWorld;
varying vec4 vRect;
varying vec3 vTint;

void main(){
  // Face the camera about Y, but only in discrete buckets, refreshed at a low
  // rate. Both quantisations are deliberate: continuous billboarding is the
  // single biggest giveaway of a modern renderer.
  vec3 toCam = uCameraPos - aPos;
  float yaw = atan(toCam.x, toCam.z);
  float step_ = 6.2831853 / max(uYawSteps, 1.0);
  float snapClock = floor(uTime * uSnapFps + aFlags.y * 7.0);
  // A one-bucket dither on alternate snap frames keeps the facing restless.
  float dither = (swHash11(snapClock + aFlags.y * 31.0) - 0.5) * step_ * 0.55;
  yaw = floor(yaw / step_ + 0.5) * step_ + dither;

  float cy = cos(yaw);
  float sy = sin(yaw);
  vec3 right = vec3(cy, 0.0, -sy);

  // Sway: a slow lean that reads as wind, held on the stop-motion clock.
  float swayClock = floor(uTime * uSnapFps) / uSnapFps;
  float sway = sin(swayClock * 1.7 + aFlags.y * 6.2831853) * aFlags.x;

  vec3 local = right * (position.x * aSize.x) + vec3(0.0, position.y * aSize.y, 0.0);
  local.x += sway * position.y * aSize.y * 0.35;
  local.z += sway * position.y * aSize.y * 0.18;
  vec3 worldPos = aPos + local;

  vec4 clip = projectionMatrix * viewMatrix * vec4(worldPos, 1.0);
  // Extra sub-pixel wobble on top of the shared snapping: sprites were the
  // worst offenders for this on real hardware.
  if (uWobble > 0.0001){
    vec2 half_ = uResolution * 0.5;
    vec2 ndc = clip.xy / max(clip.w, 0.001);
    float w = swHash11(aFlags.y * 91.0 + snapClock) - 0.5;
    ndc += vec2(w, -w) * (uWobble / half_);
    clip.xy = ndc * clip.w;
  }
  clip = swSnapVertex(clip);
  gl_Position = clip;

  swAffineSetup(uv, clip);

  vec3 worldNormal = normalize(vec3(right.x * 0.3, 0.85, right.z * 0.3));
  vec3 lit = swAmbientLight(worldNormal) + swDynamicLight(aPos + vec3(0.0, aSize.y * 0.5, 0.0), worldNormal);
  vLight = mix(lit, vec3(1.0), uEmissive);
  vWorld = worldPos;
  vRect = aRect;
  vTint = aTint;
}
`].join('\n');

const BILLBOARD_FRAG = [
  SW_MATH, SW_FRAME_UNIFORMS, SW_AFFINE_VARY, SW_AFFINE_FRAG, SW_SKY_UNIFORMS,
  SW_FOG_UNIFORMS, SW_FOG_FRAG, /* glsl */ `
uniform sampler2D uAtlas;
uniform float uFogged;     // 0 for fire, 1 for everything the fog should eat

varying vec3 vLight;
varying vec3 vWorld;
varying vec4 vRect;
varying vec3 vTint;

void main(){
  vec2 uvRaw = clamp(swAffineUv(), 0.0, 1.0);
  vec2 uvAtlas = uvRaw * vRect.zw + vRect.xy;
  vec4 texel = texture2D(uAtlas, uvAtlas);
  // Hard alpha cut: no blending, so sprites keep a crisp pixel silhouette.
  if (texel.a < 0.5) discard;

  vec3 color = texel.rgb * vLight * vTint;
  color = mix(color, swApplyFog(color, vWorld), uFogged);
  gl_FragColor = vec4(color, 1.0);
}
`].join('\n');

/**
 * @param {object} opts
 * @param {number} [opts.emissive] 1 for fire, which ignores scene light
 * @param {number} [opts.fogged] 0 keeps a sprite bright through fog
 */
export function createBillboardMaterial({ emissive = 0, fogged = 1, wobble = RENDER.billboardWobble } = {}) {
  return new THREE.ShaderMaterial({
    vertexShader: BILLBOARD_VERT,
    fragmentShader: BILLBOARD_FRAG,
    defines: { ...DEFINES },
    uniforms: withShared({
      uAtlas: { value: textures.sprites.texture },
      uYawSteps: { value: ANIM.billboardYawSteps },
      uSnapFps: { value: ANIM.billboardSnapFps },
      uWobble: { value: wobble },
      uEmissive: { value: emissive },
      uFogged: { value: fogged },
    }),
    side: THREE.DoubleSide,
    transparent: false,
    depthWrite: true,
    toneMapped: false,
  });
}

/* ================================================================== *
 * Actors: flat-shaded low-poly enemies and props
 * ================================================================== */

const ACTOR_VERT = [
  SW_MATH, SW_FRAME_UNIFORMS, SW_RETRO_VERT, SW_SKY_UNIFORMS, SW_LIGHT_ARRAY_UNIFORMS, SW_LIGHT_VERT, /* glsl */ `
attribute vec3 color;

uniform vec3  uTint;

varying vec3 vLight;
varying vec3 vWorld;
varying vec3 vColor;

void main(){
  vec4 world = modelMatrix * vec4(position, 1.0);
  vec3 worldNormal = normalize(mat3(modelMatrix) * normal);

  vec4 clip = projectionMatrix * viewMatrix * world;
  clip = swSnapVertex(clip);
  gl_Position = clip;

  vec3 lit = swAmbientLight(worldNormal) + swDynamicLight(world.xyz, worldNormal);
  vLight = lit;
  vWorld = world.xyz;
  vColor = color * uTint;
}
`].join('\n');

const ACTOR_FRAG = [
  SW_MATH, SW_FRAME_UNIFORMS, SW_SKY_UNIFORMS, SW_FOG_UNIFORMS, SW_FOG_FRAG, /* glsl */ `
uniform float uHurt;
uniform float uSilhouette;   // pushes towards flat dark, for the boss in fog

varying vec3 vLight;
varying vec3 vWorld;
varying vec3 vColor;

void main(){
  vec3 color = vColor * vLight;
  // Hit flash: blows out to bone white for two or three frames.
  color = mix(color, vec3(1.0, 0.94, 0.86), clamp(uHurt, 0.0, 1.0) * 0.85);
  // Silhouette mode: the shape reads, the detail does not.
  color = mix(color, vec3(0.035, 0.055, 0.055), clamp(uSilhouette, 0.0, 1.0));
  color = swApplyFog(color, vWorld);
  gl_FragColor = vec4(color, 1.0);
}
`].join('\n');

export function createActorMaterial({ tint = 0xffffff, silhouette = 0 } = {}) {
  return new THREE.ShaderMaterial({
    vertexShader: ACTOR_VERT,
    fragmentShader: ACTOR_FRAG,
    defines: { ...DEFINES },
    uniforms: withShared({
      uHurt: { value: 0 },
      uTint: { value: new THREE.Color(tint) },
      uSilhouette: { value: silhouette },
    }),
    side: THREE.FrontSide,
    toneMapped: false,
  });
}

/* ================================================================== *
 * Viewmodel
 * ================================================================== */

const VIEWMODEL_VERT = [
  SW_MATH, SW_FRAME_UNIFORMS, SW_RETRO_VERT, SW_SKY_UNIFORMS, SW_LIGHT_ARRAY_UNIFORMS, SW_LIGHT_VERT, /* glsl */ `
attribute vec3 color;

uniform vec3 uMuzzleColor;
uniform float uMuzzle;      // 0..1 flash strength

varying vec3 vLight;
varying vec3 vColor;

void main(){
  // The viewmodel lives in view space already, so no view matrix is applied.
  vec4 clip = projectionMatrix * modelMatrix * vec4(position, 1.0);
  clip = swSnapVertex(clip);
  gl_Position = clip;

  vec3 n = normalize(mat3(modelMatrix) * normal);
  // Lit by the world at the camera plus the muzzle when it fires.
  vec3 lit = swAmbientLight(n) + swDynamicLight(uCameraPos, n);
  lit += uMuzzleColor * (uMuzzle * max(-n.z, 0.25) * 2.2);
  vLight = lit;
  vColor = color;
}
`].join('\n');

const VIEWMODEL_FRAG = /* glsl */ `
varying vec3 vLight;
varying vec3 vColor;
void main(){
  gl_FragColor = vec4(vColor * vLight, 1.0);
}
`;

export function createViewmodelMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader: VIEWMODEL_VERT,
    fragmentShader: VIEWMODEL_FRAG,
    defines: { ...DEFINES },
    uniforms: withShared({
      uMuzzleColor: { value: new THREE.Color('#ffd08a') },
      uMuzzle: { value: 0 },
    }),
    side: THREE.FrontSide,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
}
