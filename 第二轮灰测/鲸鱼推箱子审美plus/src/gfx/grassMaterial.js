/**
 * Grass / wildflower billboard material.
 *
 * Vertex pipeline, in order:
 *   1. stop-motion clock with a per-blade phase offset (12 fps by default, each
 *      blade snapping on its own sub-frame so the field never ticks in lockstep)
 *   2. three octaves of drifting value noise plus a slow gust envelope and a
 *      per-blade flutter
 *   3. world-space bend about the axis orthogonal to the wind direction, with
 *      the rotation weighted by a power of the blade's height so the spine
 *      curves instead of hinging
 *   4. push-away from up to DSH_MAX_ACTORS moving bodies, each with its own
 *      radius, rotating the spine about the axis orthogonal to the escape
 *      direction
 *   5. Y-axis billboard using the camera's horizontal right vector, with a small
 *      per-blade yaw jitter
 *
 * Fragment pipeline:
 *   - the sprite is sampled on a quantised 8x16 texel grid, so the blade is
 *     always drawn as pixel art regardless of how many screen pixels it covers
 *   - flatten compensation: the vertex stage measures how much shorter the bent
 *     spine is in screen space (exact under an orthographic projection) and the
 *     fragment stage stretches the sampled V range by that factor, keeping the
 *     texels square while the quad foreshortens
 *   - the alpha channel of each sprite row is a half-width profile which becomes
 *     a quantised silhouette, then an alpha clip
 *   - hybrid shading: stepped diffuse with a soft transition band, HDRI probe
 *     ambient, cloud shadow, plus two continuous terms (light transmitted
 *     through the blade, and a wind-driven sheen)
 */
import * as THREE from 'three';
import { PALETTE, GRASS } from '../core/config.js';
import { withShared } from '../core/env.js';
import { GLSL_MATH, GLSL_SHARED_UNIFORMS, GLSL_LIGHTING, GLSL_LIGHTING_FRAG } from './shaderChunks.js';
import { textures } from './textures.js';

const BLADE_UNIFORMS = /* glsl */ `
uniform vec2  uViewRight;
uniform vec4  uActors[DSH_MAX_ACTORS];
uniform int   uActorCount;
uniform float uPushStrength;
uniform float uPushRadiusScale;
uniform float uUvCompensate;
uniform float uUvSquashFloor;
uniform float uCurvePow;
uniform float uBaseLean;
uniform float uYawJitter;
uniform float uSpriteW;
uniform float uSpriteH;
uniform float uVariants;
`;

const VERT = [GLSL_MATH, GLSL_SHARED_UNIFORMS, GLSL_LIGHTING, BLADE_UNIFORMS, /* glsl */ `
attribute vec3 aBase;     // blade root in world space
attribute vec4 aParams;   // x width, y height, z stop-motion phase, w random
attribute vec4 aTint;     // rgb baked tint (includes ambient occlusion), a sprite index
attribute vec2 aSway;     // x stiffness, y static lean bias

varying vec2  vUv;
varying vec3  vWorld;
varying vec3  vNormal;
varying float vSquash;
varying float vWind;
varying float vPush;
varying float vVariant;
varying vec3  vTint;

/* Spine of the blade at normalised height h, after wind bend and actor push. */
vec3 dshSpine(float h, float bladeH, float bend, vec3 bendAxis,
              float pushAmt, vec3 pushAxis, float pushK, float curvePow){
  vec3 p = vec3(0.0, h * bladeH, 0.0);
  p = dshRotateAxis(p, bendAxis, bend * pow(h, curvePow));
  if (pushAmt > 0.0001){
    p = dshRotateAxis(p, pushAxis, pushAmt * pushK * pow(h, 0.62));
  }
  return p;
}

void main(){
  float bladeW = aParams.x;
  float bladeH = aParams.y;
  float phase  = aParams.z;
  float rnd    = aParams.w;
  float stiff  = aSway.x;

  /* --- 1. stop-motion clock, staggered per blade --------------------- */
  float t = dshStopTime(phase);

  /* --- 2. layered noise wind ---------------------------------------- */
  vec2 wDir = normalize(uWindDir + 1e-5);
  vec2 wp = aBase.xz * uWindScale;
  float l1 = dshNoise(wp * 1.00 - wDir * (t * uWindSpeed * 1.00));
  float l2 = dshNoise(wp * 2.37 - wDir * (t * uWindSpeed * 1.85) + 17.13);
  float l3 = dshNoise(wp * 5.90 - wDir * (t * uWindSpeed * 3.40) + 71.41);
  float gustN = dshNoise(wp * 0.31 - wDir * (t * uWindSpeed * 0.40) + 5.77);
  float gust = smoothstep(0.42, 0.94, gustN);

  float wind = l1 * 0.56 + l2 * 0.30 + l3 * 0.14;
  wind = (wind - 0.47) * 2.15;
  wind *= 1.0 + gust * uGustStrength;
  wind += (dshNoise(vec2(rnd * 37.0, t * 3.1)) - 0.5) * 0.40;   // per-blade flutter

  float bend = (wind * uWindStrength + (rnd - 0.5) * uBaseLean + aSway.y) * stiff;

  /* --- 3. world-space bend about the axis orthogonal to the wind ----- */
  vec3 up = vec3(0.0, 1.0, 0.0);
  vec3 windDir3 = normalize(vec3(wDir.x, 0.0, wDir.y));
  vec3 bendAxis = normalize(cross(up, windDir3));

  /* --- 4. push-away from moving bodies (fixed capacity) -------------- */
  vec3 pushVec = vec3(0.0);
  float pushAmt = 0.0;
  for (int i = 0; i < DSH_MAX_ACTORS; i++){
    if (i >= uActorCount) break;
    vec4 act = uActors[i];
    vec3 d = aBase - act.xyz;
    float vertical = 1.0 - smoothstep(bladeH * 0.9, bladeH * 2.5, abs(d.y));
    d.y = 0.0;
    float r = max(act.w * uPushRadiusScale, 1e-3);
    float dist = length(d);
    float infl = (1.0 - smoothstep(r * 0.22, r, dist)) * vertical;
    if (infl <= 0.0) continue;
    pushVec += (dist > 1e-4 ? d / dist : vec3(1.0, 0.0, 0.0)) * infl;
    pushAmt = max(pushAmt, infl);
  }
  vec3 pushAxis = bendAxis;
  if (pushAmt > 0.0){
    vec2 pd = pushVec.xz;
    float pl = length(pd);
    vec3 pdir = pl > 1e-4 ? vec3(pd.x / pl, 0.0, pd.y / pl) : windDir3;
    pushAxis = normalize(cross(up, pdir));
  }

  float h = clamp(position.y, 0.0, 1.0);
  vec3 spine   = dshSpine(h,   bladeH, bend, bendAxis, pushAmt, pushAxis, uPushStrength, uCurvePow);
  vec3 tipBent = dshSpine(1.0, bladeH, bend, bendAxis, pushAmt, pushAxis, uPushStrength, uCurvePow);

  /* --- 5. Y-axis billboard ------------------------------------------ */
  vec2 vr = normalize(uViewRight + 1e-5);
  vec2 vrj = dshRotate2(vr, (rnd - 0.5) * uYawJitter);
  vec3 right = vec3(vrj.x, 0.0, vrj.y);

  vec3 world = aBase + spine + right * (position.x * bladeW);

  /* Flatten metric: ratio between the bent and upright spine lengths measured
   * in screen space. With no perspective divide this is exact. */
  vec3 o  = (viewMatrix * vec4(aBase, 1.0)).xyz;
  vec3 pb = (viewMatrix * vec4(aBase + tipBent, 1.0)).xyz;
  vec3 pr = (viewMatrix * vec4(aBase + vec3(0.0, bladeH, 0.0), 1.0)).xyz;
  float ratio = length((pb - o).xy) / max(length((pr - o).xy), 1e-4);

  vUv = uv;
  vWorld = world;
  vNormal = normalize(normal);          // uniformly up: the field lights as one surface
  vSquash = clamp(ratio, uUvSquashFloor, 1.0);
  vWind = wind;
  vPush = pushAmt;
  vVariant = aTint.a;
  vTint = aTint.rgb;

  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}
`].join('\n');

const FRAG = [GLSL_MATH, GLSL_SHARED_UNIFORMS, GLSL_LIGHTING, GLSL_LIGHTING_FRAG, BLADE_UNIFORMS, /* glsl */ `
uniform sampler2D uBlades;
uniform float uBaseAO;
uniform float uTransmission;
uniform float uSheen;
uniform float uAlphaCutoff;
uniform vec3  uPushTint;

varying vec2  vUv;
varying vec3  vWorld;
varying vec3  vNormal;
varying float vSquash;
varying float vWind;
varying float vPush;
varying float vVariant;
varying vec3  vTint;

void main(){
  /* Flatten compensation. vSquash < 1 means the quad lost screen height to the
   * bend; shrinking the sampled V range by the same factor magnifies the sprite
   * vertically, so its texels stay square and the blade reads as foreshortened
   * rather than squashed. */
  float squash = mix(1.0, vSquash, clamp(uUvCompensate, 0.0, 1.0));

  float colIdx  = min(floor(vUv.x * uSpriteW), uSpriteW - 1.0);
  float rowGeom = min(floor(vUv.y * uSpriteH), uSpriteH - 1.0);
  float rowTex  = min(floor(vUv.y * squash * uSpriteH), uSpriteH - 1.0);

  float colU = (colIdx + 0.5) / uSpriteW;
  vec2 auv = vec2((vVariant + colU) / uVariants, (rowTex + 0.5) / uSpriteH);
  vec4 sprite = texture2D(uBlades, auv);

  /* Silhouette. Alpha stores the half-width profile of the sprite row; reading
   * it at the geometric row keeps a pointed tip at the top of the quad even
   * while the colour bands are magnified. */
  vec2 profUv = vec2((vVariant + 0.5 / uSpriteW) / uVariants, (rowGeom + 0.5) / uSpriteH);
  float halfWidth = texture2D(uBlades, profUv).a;

  float dx = abs(colU - 0.5) * 2.0;
  float alpha = step(dx, halfWidth + 1e-4);
  if (alpha < uAlphaCutoff) discard;

  vec3 albedo = sprite.rgb * vTint;

  vec3 N = normalize(vNormal);
  float ndl = max(dot(N, uSunDir), 0.0);
  float cloud = dshCloudShadow(vWorld.xz);
  float toon = dshToonRamp(ndl * cloud, uToonSteps, uToonSoft);

  float heightF = (rowGeom + 0.5) / uSpriteH;
  float ao = mix(uBaseAO, 1.0, pow(heightF, 0.55));

  vec3 ambient = dshAmbient(N) * ao;
  vec3 color = albedo * (ambient + uSunColor * toon * ao);

  /* Continuous term 1: sunlight transmitted through the blade when the sun sits
   * behind it. This is what stops the stepped ramp from looking like cardboard. */
  float back = pow(clamp(dot(normalize(uViewDir), uSunDir), 0.0, 1.0), 2.2);
  color += albedo * uSunColor * (back * uTransmission * heightF * cloud);

  /* Continuous term 2: sheen on blades laid over by the wind. */
  float sheen = smoothstep(0.5, 1.0, heightF) * clamp(abs(vWind) * 0.9, 0.0, 1.0);
  color += uSunColor * (sheen * uSheen * toon);

  /* Blades that have just been shouldered aside show their pale undersides. */
  color = mix(color, color * 0.88 + uPushTint * 0.10, clamp(vPush, 0.0, 1.0) * 0.6);

  color = dshApplyFog(color, vWorld);
  gl_FragColor = vec4(color, 1.0);
}
`].join('\n');

export function createGrassMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    defines: { DSH_MAX_ACTORS: GRASS.maxActors },
    uniforms: withShared({
      uBlades: { value: textures.blade },
      uBaseAO: { value: 0.42 },
      uTransmission: { value: 0.95 },
      uSheen: { value: 0.11 },
      uAlphaCutoff: { value: 0.5 },
      uPushTint: { value: PALETTE.grassTip.clone() },
    }, true),
    side: THREE.DoubleSide,
    transparent: false,
    depthWrite: true,
    toneMapped: false,
  });
}
