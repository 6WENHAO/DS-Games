// Seeded value-noise shared *bit-for-bit* between CPU and GPU.
//
// The GPU samples a 256x256 8-bit noise texture with NEAREST filtering and does its
// own bilinear blend; the CPU reads the very same bytes with the very same blend.
// That means gameplay (petal height, flower planting) always agrees with what the
// vertex shaders draw, without ever reading pixels back from the GPU.

import * as THREE from 'three';
import { WORLD } from './config.js';

export const NSIZE = 256;
let DATA = null;

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeNoiseTexture(seed = 1337) {
  const rnd = mulberry32(seed);
  const n = NSIZE * NSIZE;
  DATA = new Uint8Array(n);
  for (let i = 0; i < n; i++) DATA[i] = (rnd() * 256) | 0;

  const rgba = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) {
    // R: white noise (value-noise grid).  G/B: two decorrelated shuffles, handy for
    // cheap extra variation inside shaders.  A: unused.
    rgba[i * 4 + 0] = DATA[i];
    rgba[i * 4 + 1] = DATA[(i * 7 + 13) % n];
    rgba[i * 4 + 2] = DATA[(i * 31 + 101) % n];
    rgba[i * 4 + 3] = 255;
  }
  const tex = new THREE.DataTexture(rgba, NSIZE, NSIZE, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

function nval(ix, iy) {
  const x = ((ix % NSIZE) + NSIZE) % NSIZE;
  const y = ((iy % NSIZE) + NSIZE) % NSIZE;
  return DATA[y * NSIZE + x] / 255;
}

// bilinear + smoothstep value noise (mirrors vnoise() in GLSL)
export function vnoise(px, py) {
  const ix = Math.floor(px), iy = Math.floor(py);
  const fx = px - ix, fy = py - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = nval(ix, iy), b = nval(ix + 1, iy), c = nval(ix, iy + 1), d = nval(ix + 1, iy + 1);
  return (a + (b - a) * ux) + ((c + (d - c) * ux) - (a + (b - a) * ux)) * uy;
}

// [freq, amp, offsetX, offsetY, rotation] — single source of truth for both languages
export const TERRAIN_OCTAVES = [
  [0.00420, 1.000, 11.3, 5.70, 0.00],
  [0.00980, 0.470, 53.1, 17.9, 0.91],
  [0.02260, 0.205, 3.70, 91.2, 2.13],
  [0.05100, 0.082, 71.4, 33.8, 3.77],
  [0.11700, 0.034, 22.9, 64.1, 5.31],
];

export function terrainHeight(x, z) {
  let h = 0;
  for (let i = 0; i < TERRAIN_OCTAVES.length; i++) {
    const [f, a, ox, oy, r] = TERRAIN_OCTAVES[i];
    const c = Math.cos(r), s = Math.sin(r);
    const rx = (x * c - z * s) * f + ox;
    const rz = (x * s + z * c) * f + oy;
    h += (vnoise(rx, rz) * 2 - 1) * a;
  }
  // gentle shaping: broad soft valleys, crisper ridges
  h = Math.sign(h) * Math.pow(Math.abs(h), 1.18);
  return h * WORLD.terrainAmp;
}

const _n = { x: 0, y: 1, z: 0 };
export function terrainNormal(x, z, out = _n) {
  const e = 0.75;
  const hl = terrainHeight(x - e, z), hr = terrainHeight(x + e, z);
  const hd = terrainHeight(x, z - e), hu = terrainHeight(x, z + e);
  let nx = hl - hr, ny = 2 * e, nz = hd - hu;
  const l = Math.hypot(nx, ny, nz) || 1;
  out.x = nx / l; out.y = ny / l; out.z = nz / l;
  return out;
}

/* ------------------------------------------------------------------ GLSL side */

export const GLSL_NOISE = /* glsl */ `
  uniform sampler2D uNoiseTex;

  vec4 nvalRaw(vec2 c){ return texture2D(uNoiseTex, (floor(c) + 0.5) / ${NSIZE}.0); }
  float nval(vec2 c){ return nvalRaw(c).r; }

  float vnoise(vec2 p){
    vec2 i = floor(p);
    vec2 f = p - i;
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = nval(i);
    float b = nval(i + vec2(1.0, 0.0));
    float c = nval(i + vec2(0.0, 1.0));
    float d = nval(i + vec2(1.0, 1.0));
    float ab = mix(a, b, u.x);
    float cd = mix(c, d, u.x);
    return mix(ab, cd, u.y);
  }

  float fbm2(vec2 p){
    float s = 0.0, a = 0.5;
    mat2 rot = mat2(0.8, -0.6, 0.6, 0.8);
    for (int i = 0; i < 4; i++){
      s += a * vnoise(p);
      p = rot * p * 2.03 + 7.13;
      a *= 0.5;
    }
    return s / 0.9375;
  }

  float fbm3(vec2 p){
    float s = 0.0, a = 0.5;
    mat2 rot = mat2(0.8, -0.6, 0.6, 0.8);
    for (int i = 0; i < 3; i++){
      s += a * vnoise(p);
      p = rot * p * 2.11 + 3.31;
      a *= 0.5;
    }
    return s / 0.875;
  }

  float hash12(vec2 p){
    return nvalRaw(p * 1.0).g;
  }
`;

function terrainGLSLBody(withGrad) {
  let src = '';
  for (const [f, a, ox, oy, r] of TERRAIN_OCTAVES) {
    const c = Math.cos(r).toFixed(6), s = Math.sin(r).toFixed(6);
    const M = `mat2(${c}, ${s}, ${-s}, ${c})`;
    const MT = `mat2(${c}, ${-s}, ${s}, ${c})`;
    if (!withGrad) {
      src += `    h += (vnoise(${M} * p * ${f.toFixed(6)} + vec2(${ox.toFixed(2)}, ${oy.toFixed(2)})) * 2.0 - 1.0) * ${a.toFixed(4)};\n`;
    } else {
      src += `    nd = vnoiseD(${M} * p * ${f.toFixed(6)} + vec2(${ox.toFixed(2)}, ${oy.toFixed(2)}));\n`;
      src += `    h += (nd.x * 2.0 - 1.0) * ${a.toFixed(4)};\n`;
      src += `    g += (2.0 * ${a.toFixed(4)} * ${f.toFixed(6)}) * (${MT} * nd.yz);\n`;
    }
  }
  return src;
}

// NOTE: mat2(a,b,c,d) in GLSL is column-major: first column (a,b), second (c,d).
// JS rotates (x,z) -> (x*c - z*s, x*s + z*c), i.e. matrix rows [c,-s; s,c],
// which as GLSL columns is mat2(c, s, -s, c). That is what terrainGLSLBody emits.
export const GLSL_TERRAIN = /* glsl */ `
  uniform float uTerrainAmp;

  // value noise with analytic gradient: (value, d/dx, d/dy)
  vec3 vnoiseD(vec2 p){
    vec2 i = floor(p);
    vec2 f = p - i;
    vec2 u = f * f * (3.0 - 2.0 * f);
    vec2 du = 6.0 * f * (1.0 - f);
    float a = nval(i);
    float b = nval(i + vec2(1.0, 0.0));
    float c = nval(i + vec2(0.0, 1.0));
    float d = nval(i + vec2(1.0, 1.0));
    float ab = mix(a, b, u.x);
    float cd = mix(c, d, u.x);
    float v = mix(ab, cd, u.y);
    float dx = du.x * ((b - a) + ((d - c) - (b - a)) * u.y);
    float dy = du.y * (cd - ab);
    return vec3(v, dx, dy);
  }

  float terrainH(vec2 p){
    float h = 0.0;
${terrainGLSLBody(false)}
    h = sign(h) * pow(abs(h), 1.18);
    return h * uTerrainAmp;
  }

  // height + slope in one go: 20 texture fetches instead of 100
  vec3 terrainHD(vec2 p){
    float h = 0.0;
    vec2 g = vec2(0.0);
    vec3 nd;
${terrainGLSLBody(true)}
    float ah = abs(h);
    float sh = sign(h) * pow(ah, 1.18);
    vec2 dg = 1.18 * pow(max(ah, 1e-4), 0.18) * g;
    return vec3(sh, dg) * uTerrainAmp;
  }

  vec3 terrainNormalOf(vec3 hd){ return normalize(vec3(-hd.y, 1.0, -hd.z)); }

  vec3 terrainN(vec2 p){ return terrainNormalOf(terrainHD(p)); }

  // cheap slope measure (0 flat .. 1 steep)
  float terrainSlope(vec3 n){ return clamp(1.0 - n.y, 0.0, 1.0); }
`;
