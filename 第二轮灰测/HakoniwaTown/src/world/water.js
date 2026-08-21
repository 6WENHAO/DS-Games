/**
 * 水系：海面（波浪 + 岸边浪花）、河流（顺流条纹 + 瀑布白沫）、水花粒子锚点。
 * 用 onBeforeCompile 注入 MeshStandardMaterial，保留 PBR 光照与日夜高光。
 */
import * as THREE from 'three';
import { clamp, smoothstep, curveFrom, ribbon, mesh, mat } from '../lib/utils.js';
import { SLAB, RIVER_PTS, groundHeight, riverDist } from './layout.js';

export const waterUniforms = {
  uTime: { value: 0 },
  uShallow: { value: new THREE.Color('#63c6c9') },
  uDeep: { value: new THREE.Color('#0e4a6b') },
  uFoam: { value: new THREE.Color('#eaf7ff') },
};

export const riverUniforms = {
  uTime: { value: 0 },
  uShallow: { value: new THREE.Color('#8fd9d2') },
  uDeep: { value: new THREE.Color('#2f7f8e') },
  uFoam: { value: new THREE.Color('#ffffff') },
};

const SEA_COMMON = /* glsl */`
  uniform float uTime;
  attribute float aShore;
  attribute float aRim;
  varying float vShore;
  varying float vWaveH;
  varying vec2 vFlowP;
  vec3 seaWave(vec2 p){
    float t = uTime;
    float h = 0.0, dx = 0.0, dz = 0.0;
    h += sin(p.x*0.42 + t*1.05)*0.105;      dx += cos(p.x*0.42 + t*1.05)*0.044;
    h += sin(p.y*0.63 - t*0.87 + 1.7)*0.08; dz += cos(p.y*0.63 - t*0.87 + 1.7)*0.050;
    float s3 = (p.x+p.y)*0.28 + t*0.62;
    h += sin(s3)*0.06; dx += cos(s3)*0.017; dz += cos(s3)*0.017;
    float s4 = (p.x-p.y)*0.95 - t*1.8;
    h += sin(s4)*0.022; dx += cos(s4)*0.021; dz -= cos(s4)*0.021;
    return vec3(h, dx, dz);
  }
`;

function makeSeaMaterial() {
  const m = new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 0.14, metalness: 0.06,
    transparent: true, opacity: 0.93,
  });
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, waterUniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${SEA_COMMON}`)
      .replace('#include <beginnormal_vertex>', /* glsl */`
        vec3 w0 = seaWave(position.xz);
        vec3 objectNormal = normalize(vec3(-w0.y*aRim, 1.0, -w0.z*aRim));
      `)
      .replace('#include <begin_vertex>', /* glsl */`
        vec3 wv = seaWave(position.xz);
        vec3 transformed = vec3(position);
        transformed.y += wv.x * aRim;
        vShore = aShore; vWaveH = wv.x; vFlowP = position.xz;
      `);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', /* glsl */`#include <common>
        uniform float uTime; uniform vec3 uShallow; uniform vec3 uDeep; uniform vec3 uFoam;
        varying float vShore; varying float vWaveH; varying vec2 vFlowP;`)
      .replace('#include <color_fragment>', /* glsl */`#include <color_fragment>
        float depthT = smoothstep(0.0, 0.62, vShore);
        diffuseColor.rgb = mix(uShallow, uDeep, depthT);
        float band = sin(vFlowP.x*1.55 + vFlowP.y*1.15 + uTime*1.5)*0.5+0.5;
        float ripple = sin(vFlowP.x*5.5 - uTime*2.2)*0.5+0.5;
        float shoreFoam = smoothstep(0.115, 0.0, vShore) * (0.35 + 0.4*band + 0.25*ripple);
        diffuseColor.rgb = mix(diffuseColor.rgb, uFoam, clamp(shoreFoam, 0.0, 0.9));
        diffuseColor.rgb += uFoam * smoothstep(0.08, 0.135, vWaveH) * 0.22;
      `);
  };
  m.customProgramCacheKey = () => 'sea-v1';
  return m;
}

function makeRiverMaterial() {
  const m = new THREE.MeshStandardMaterial({
    color: 0xffffff, roughness: 0.16, metalness: 0.04,
    transparent: true, opacity: 0.94, side: THREE.DoubleSide,
  });
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, riverUniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', /* glsl */`#include <common>
        uniform float uTime; attribute float aFlow;
        varying float vFlowA; varying vec2 vUvR;`)
      .replace('#include <begin_vertex>', /* glsl */`
        vec3 transformed = vec3(position);
        float rip = sin(uv.x*3.2 - uTime*3.4) * 0.02 * (1.0 - aFlow);
        transformed.y += rip;
        vFlowA = aFlow; vUvR = uv;
      `);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', /* glsl */`#include <common>
        uniform float uTime; uniform vec3 uShallow; uniform vec3 uDeep; uniform vec3 uFoam;
        varying float vFlowA; varying vec2 vUvR;`)
      .replace('#include <color_fragment>', /* glsl */`#include <color_fragment>
        float edge = smoothstep(0.0, 0.22, vUvR.y) * smoothstep(1.0, 0.78, vUvR.y);
        diffuseColor.rgb = mix(uShallow, uDeep, edge*0.85);
        float stripes = sin(vUvR.x*7.0 - uTime*5.5 + sin(vUvR.y*7.0)*1.4)*0.5+0.5;
        float rapids = smoothstep(0.22, 0.75, vFlowA);
        float foam = clamp(rapids*(0.45+0.55*stripes) + (1.0-edge)*0.35 + stripes*0.10, 0.0, 1.0);
        diffuseColor.rgb = mix(diffuseColor.rgb, uFoam, foam*0.92);
      `);
  };
  m.customProgramCacheKey = () => 'river-v1';
  return m;
}

/** 河面高度：用河心投影点的河床高度，保证横截面水平 */
export function riverSurfaceAt(x, z) {
  const r = riverDist(x, z);
  return groundHeight(r.px, r.pz) + 0.46;
}

const RIVER_WIDTH_KEYS = [
  [0.00, 1.8], [0.10, 2.3], [0.22, 2.0], [0.30, 4.4], [0.40, 2.2],
  [0.52, 2.7], [0.62, 2.4], [0.70, 6.2], [0.78, 3.0], [0.88, 4.2], [1.0, 6.6],
];
function riverWidth(u) {
  for (let i = 0; i < RIVER_WIDTH_KEYS.length - 1; i++) {
    const [a, wa] = RIVER_WIDTH_KEYS[i], [b, wb] = RIVER_WIDTH_KEYS[i + 1];
    if (u <= b) return wa + (wb - wa) * smoothstep((u - a) / (b - a));
  }
  return RIVER_WIDTH_KEYS[RIVER_WIDTH_KEYS.length - 1][1];
}

export function buildWater(scene) {
  const root = new THREE.Group();
  root.name = 'water';
  scene.add(root);

  /* ---------------- 海面 ---------------- */
  const SEG = 148, size = SLAB * 2 - 0.14;
  const geo = new THREE.PlaneGeometry(size, size, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const shore = new Float32Array(pos.count);
  const rim = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = groundHeight(x, z);
    shore[i] = clamp(-h / 3.1);
    const r = Math.max(Math.abs(x), Math.abs(z));
    rim[i] = 1 - smoothstep((r - (SLAB - 3.0)) / 2.6);
  }
  geo.setAttribute('aShore', new THREE.BufferAttribute(shore, 1));
  geo.setAttribute('aRim', new THREE.BufferAttribute(rim, 1));
  const sea = new THREE.Mesh(geo, makeSeaMaterial());
  sea.name = 'sea';
  sea.receiveShadow = true;
  sea.renderOrder = 1;
  root.add(sea);

  /* ---------------- 河流 ---------------- */
  const riverCurve = curveFrom(RIVER_PTS.map(([x, z]) => [x, 0, z]), false, 0.45);
  const sampleY = (u) => {
    const p = riverCurve.getPointAt(clamp(u, 0, 0.999999));
    return riverSurfaceAt(p.x, p.z);
  };
  const rgeo = ribbon(riverCurve, riverWidth, {
    segments: 300,
    heightFn: (x, z) => riverSurfaceAt(x, z) - 0.46,
    yOffset: 0.46,
    uvScale: 0.11,
    extraAttr: (u) => {
      const y0 = sampleY(Math.max(0, u - 0.006));
      const y1 = sampleY(Math.min(1, u + 0.006));
      return clamp((y0 - y1) / 0.85);
    },
  });
  const river = new THREE.Mesh(rgeo, makeRiverMaterial());
  river.name = 'river';
  river.receiveShadow = true;
  river.renderOrder = 2;
  root.add(river);

  /* ---------------- 瀑布落点（供水雾粒子使用） ---------------- */
  const falls = [];
  for (let i = 0; i <= 60; i++) {
    const u = i / 60;
    const y0 = sampleY(Math.max(0, u - 0.012));
    const y1 = sampleY(Math.min(1, u + 0.012));
    if (y0 - y1 > 0.75) {
      const p = riverCurve.getPointAt(clamp(u + 0.012, 0, 0.999));
      falls.push({ x: p.x, z: p.z, y: sampleY(u + 0.012), drop: y0 - y1 });
    }
  }
  // 合并相邻落点
  const merged = [];
  for (const f of falls) {
    const near = merged.find((m) => Math.hypot(m.x - f.x, m.z - f.z) < 3.2);
    if (near) { near.drop = Math.max(near.drop, f.drop); continue; }
    merged.push(f);
  }

  /* ---------------- 水潭涟漪贴面（磨坊潭 / 港池静水） ---------------- */
  const ripple = mat('#bfe9ef', { rough: 0.1, metal: 0.1, opacity: 0.25 });
  for (const p of [{ x: -10.4, z: 15.0, r: 3.1 }]) {
    const disc = new THREE.CircleGeometry(p.r, 26);
    disc.rotateX(-Math.PI / 2);
    const m = mesh(disc, ripple, { x: p.x, y: riverSurfaceAt(p.x, p.z) + 0.03, z: p.z, cast: false });
    m.renderOrder = 3;
    root.add(m);
  }

  return {
    root, sea, river, falls: merged, riverCurve,
    update(elapsed) {
      waterUniforms.uTime.value = elapsed;
      riverUniforms.uTime.value = elapsed;
    },
  };
}
