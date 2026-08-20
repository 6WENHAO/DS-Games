// Shared uniform objects + shared GLSL chunks.
//
// Every material references the *same* uniform objects, so the weather system can
// write one value and have terrain, grass, flowers, petals, sky and post-processing
// all agree about sun, wind, clouds and fog.

import * as THREE from 'three';
import { WORLD } from './config.js';

const c = (hex) => ({ value: new THREE.Color(hex) });
const f = (v) => ({ value: v });

export const U = {
  // time & camera
  uTime: f(0),
  uCamPos: { value: new THREE.Vector3() },
  uCamXZ: { value: new THREE.Vector2() },
  uCamFwd: { value: new THREE.Vector3(0, 0, -1) },

  // world
  uNoiseTex: { value: null },
  uTerrainAmp: f(WORLD.terrainAmp),

  // wind
  uWindDir: { value: new THREE.Vector2(0.86, 0.51) },
  uWindSpeed: f(1.0),
  uWindStrength: f(0.55),

  // sun / sky ("sun" doubles as the moon at night, just cooler and dimmer)
  uSunDir: { value: new THREE.Vector3(0.4, 0.45, 0.8).normalize() },
  uSunColor: c(0xffe8c0),
  uSunIntensity: f(1.6),
  uSkyTop: c(0x2f6fb8),
  uSkyHorizon: c(0xbfd9e8),
  uSkyHaze: c(0xd8e4e8),
  uSunGlow: f(1.0),
  uStars: f(0.0),
  uAmbSky: c(0x8fb4d8),
  uAmbGround: c(0x5d6b46),

  // clouds (one field drives the volumetric dome *and* the ground shadows)
  uCloudWind: { value: new THREE.Vector2() },
  uCloudFreq: f(0.0030),
  uCloudThresh: f(0.50),
  uCloudDensity: f(1.0),
  uCloudBase: f(WORLD.cloudBase),
  uCloudThick: f(WORLD.cloudThick),
  uCloudShadow: f(0.62),
  uCloudAbsorb: f(1.0),

  // baked cloud-shadow map (camera relative, refreshed each frame)
  uShadowMap: { value: null },
  uShadowCenter: { value: new THREE.Vector2() },
  uShadowSize: f(1800),

  // life field (where the petals have been)
  uLifeMap: { value: null },
  uLifeCenter: { value: new THREE.Vector2() },
  uLifeSize: f(WORLD.lifeSize),

  // ground palette
  uGrassDry: c(0xa89258),
  uGrassLush: c(0x5e9b3e),
  uGrassDeep: c(0x27502a),
  uGrassTip: c(0xd9e08a),
  uEarth: c(0x6b5a41),
  uWet: f(0.0),
  uFlowerGlow: f(0.0),
  uPetalTint: c(0xffd9e6),

  // fog / atmosphere (consumed by the post pass)
  uFogColor: c(0xcfe0e6),
  uFogDensity: f(0.9),
  uFogHeight: f(26.0),
  uFogGround: f(1.0),
  uMistColor: c(0xe8f2f2),
  uRain: f(0.0),
  uFlash: f(0.0),
};

/* ------------------------------------------------------------- shared GLSL */

export const GLSL_WIND = /* glsl */ `
  uniform float uTime;
  uniform vec2 uWindDir;
  uniform float uWindSpeed;
  uniform float uWindStrength;

  // Travelling wave + slow gust bands => "wind over wheat" (风吹麦浪).
  float windWave(vec2 wp, float t){
    float phase = dot(wp, uWindDir) * 0.150 - t * uWindSpeed * 1.15;
    float gust  = vnoise(wp * 0.0115 - uWindDir * t * uWindSpeed * 0.42);
    float band  = smoothstep(0.28, 0.84, gust);
    float w = sin(phase) * 0.62
            + sin(phase * 2.17 + 1.7) * 0.24
            + sin(phase * 0.47 - 0.9) * 0.44;
    return w * (0.32 + 1.02 * band);
  }

  float windGust(vec2 wp, float t){
    return smoothstep(0.25, 0.85, vnoise(wp * 0.0115 - uWindDir * t * uWindSpeed * 0.42));
  }

  vec2 windBend(vec2 wp, float t){
    return uWindDir * windWave(wp, t) * uWindStrength;
  }
`;

export const GLSL_CLOUD_FIELD = /* glsl */ `
  uniform vec2 uCloudWind;
  uniform float uCloudFreq;
  uniform float uCloudThresh;
  uniform float uCloudDensity;
  uniform float uCloudBase;
  uniform float uCloudThick;
  uniform float uCloudShadow;
  uniform float uCloudAbsorb;

  float cloudField(vec2 p){
    return fbm3(p * uCloudFreq + uCloudWind);
  }

  float cloudCover(vec2 p){
    return smoothstep(uCloudThresh, uCloudThresh + 0.16, cloudField(p));
  }

  // Ground shadow of the very same cloud field, projected along the sun ray.
  float cloudShadowAt(vec3 wp, vec3 sunDir){
    float sy = max(abs(sunDir.y), 0.14);
    float t = (uCloudBase + uCloudThick * 0.3 - wp.y) / sy;
    vec2 sp = wp.xz + sunDir.xz * t;
    // 3 slightly offset taps => soft penumbra without a blur pass
    float c = cloudCover(sp) * 0.5
            + cloudCover(sp + vec2(26.0, -14.0)) * 0.25
            + cloudCover(sp + vec2(-19.0, 23.0)) * 0.25;
    return 1.0 - clamp(c, 0.0, 1.0) * uCloudShadow;
  }
`;

// Cheap consumer side of the baked cloud-shadow map: one texture fetch.
export const GLSL_SHADOW = /* glsl */ `
  uniform sampler2D uShadowMap;
  uniform vec2 uShadowCenter;
  uniform float uShadowSize;

  float cloudShade(vec2 wxz){
    vec2 uv = (wxz - uShadowCenter) / uShadowSize + 0.5;
    float s = texture2D(uShadowMap, clamp(uv, vec2(0.001), vec2(0.999))).r;
    vec2 d = abs(uv - 0.5) * 2.0;
    float inside = 1.0 - smoothstep(0.86, 1.0, max(d.x, d.y));
    return mix(1.0, s, inside);
  }
`;

export const GLSL_LIFE = /* glsl */ `
  uniform sampler2D uLifeMap;
  uniform vec2 uLifeCenter;
  uniform float uLifeSize;

  vec2 lifeUV(vec2 wxz){ return (wxz - uLifeCenter) / uLifeSize + 0.5; }

  // r = life (grass turns lush), g = bloom (flowers), b = sparkle seed
  vec4 lifeAt(vec2 wxz){
    vec2 uv = lifeUV(wxz);
    vec2 cl = clamp(uv, vec2(0.0), vec2(1.0));
    if (cl != uv) return vec4(0.0);
    return texture2D(uLifeMap, uv);
  }
`;

export const GLSL_LIGHT = /* glsl */ `
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;
  uniform float uSunIntensity;
  uniform vec3 uAmbSky;
  uniform vec3 uAmbGround;
  uniform float uWet;
  uniform float uFlash;

  vec3 hemiAmbient(vec3 n){
    return mix(uAmbGround, uAmbSky, clamp(n.y * 0.5 + 0.5, 0.0, 1.0));
  }

  float wrapDiffuse(vec3 n, vec3 l, float w){
    return clamp((dot(n, l) + w) / (1.0 + w), 0.0, 1.0);
  }

  float hg(float mu, float g){
    float g2 = g * g;
    return (1.0 - g2) / (12.566370614 * pow(1.0 + g2 - 2.0 * g * mu, 1.5));
  }
`;

export const GLSL_SKY = /* glsl */ `
  uniform vec3 uSkyTop;
  uniform vec3 uSkyHorizon;
  uniform vec3 uSkyHaze;
  uniform float uSunGlow;

  vec3 skyGradient(vec3 rd){
    float h = clamp(rd.y, -1.0, 1.0);
    float t = pow(clamp(1.0 - abs(h), 0.0, 1.0), 3.2);
    vec3 col = mix(uSkyTop, uSkyHorizon, t);
    col = mix(col, uSkyHaze, smoothstep(0.02, -0.28, h));
    float mu = clamp(dot(rd, uSunDir), 0.0, 1.0);
    col += uSunColor * uSunGlow * (pow(mu, 6.0) * 0.16 + pow(mu, 40.0) * 0.35);
    return col;
  }
`;

/** Named uniform groups matching the GLSL chunks above. */
export const UG = {
  noise: ['uNoiseTex'],
  terrain: ['uNoiseTex', 'uTerrainAmp'],
  wind: ['uTime', 'uWindDir', 'uWindSpeed', 'uWindStrength'],
  cloudField: ['uCloudWind', 'uCloudFreq', 'uCloudThresh', 'uCloudDensity', 'uCloudBase', 'uCloudThick', 'uCloudShadow', 'uCloudAbsorb'],
  shadow: ['uShadowMap', 'uShadowCenter', 'uShadowSize'],
  life: ['uLifeMap', 'uLifeCenter', 'uLifeSize'],
  light: ['uSunDir', 'uSunColor', 'uSunIntensity', 'uAmbSky', 'uAmbGround', 'uWet', 'uFlash'],
  sky: ['uSkyTop', 'uSkyHorizon', 'uSkyHaze', 'uSunGlow', 'uStars'],
  palette: ['uGrassDry', 'uGrassLush', 'uGrassDeep', 'uGrassTip', 'uEarth', 'uFlowerGlow', 'uPetalTint'],
  cam: ['uCamPos', 'uCamXZ', 'uCamFwd'],
  fog: ['uFogColor', 'uFogDensity', 'uFogHeight', 'uFogGround', 'uMistColor', 'uRain'],
  time: ['uTime'],
};

/** Build a uniforms object out of shared uniform objects: pick('terrain','light', {uFoo:...}) */
export function pick(...groups) {
  const out = {};
  for (const g of groups) {
    if (typeof g === 'string') {
      const keys = UG[g];
      if (!keys) throw new Error('unknown uniform group: ' + g);
      for (const k of keys) out[k] = U[k];
    } else if (Array.isArray(g)) {
      for (const k of g) out[k] = U[k];
    } else if (g && typeof g === 'object') {
      Object.assign(out, g);
    }
  }
  return out;
}

export function shared(...extra) {
  return Object.assign({}, ...extra);
}
