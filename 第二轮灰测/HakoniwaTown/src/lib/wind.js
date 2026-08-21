/**
 * 风：树冠摆动 / 旗帜布料 / 麦浪，用共享 uniform 驱动的顶点动画。
 */
import * as THREE from 'three';

export const windUniforms = {
  uTime: { value: 0 },
  uStrength: { value: 1.0 },
};

const SWAY_CHUNK = /* glsl */`
  uniform float uTime;
  uniform float uStrength;
  attribute float aSway;
`;

/** 树冠 / 灌木 / 麦子：按 aSway（0 根部 → 1 顶端）横向摆动 */
export function swayMaterial(color, o = {}) {
  const m = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    roughness: o.rough ?? 0.88,
    metalness: 0,
    flatShading: !!o.flat,
    side: o.side ?? THREE.FrontSide,
    transparent: (o.opacity ?? 1) < 1,
    opacity: o.opacity ?? 1,
  });
  const amp = o.amp ?? 0.13;
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, windUniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${SWAY_CHUNK}`)
      .replace('#include <begin_vertex>', /* glsl */`
        vec3 transformed = vec3(position);
        float ph = position.x * 0.31 + position.z * 0.27;
        float s = aSway * uStrength;
        transformed.x += sin(uTime * 1.35 + ph) * ${amp.toFixed(3)} * s;
        transformed.z += cos(uTime * 1.05 + ph * 1.3) * ${(amp * 0.75).toFixed(3)} * s;
        transformed.y -= abs(sin(uTime * 1.2 + ph)) * ${(amp * 0.25).toFixed(3)} * s;
      `);
  };
  m.customProgramCacheKey = () => `sway-${color}-${amp}-${o.flat ? 1 : 0}-${o.opacity ?? 1}`;
  return m;
}

/** 布料：沿 uv.x 展开的旗帜 / 雨棚 / 晾衣绳 */
export function clothMaterial(color, o = {}) {
  const m = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    roughness: o.rough ?? 0.9,
    side: THREE.DoubleSide,
    transparent: (o.opacity ?? 1) < 1,
    opacity: o.opacity ?? 1,
  });
  const amp = o.amp ?? 0.4;
  const speed = o.speed ?? 4.0;
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, windUniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', /* glsl */`#include <common>
        uniform float uTime; uniform float uStrength;`)
      .replace('#include <beginnormal_vertex>', /* glsl */`
        float ph0 = uv.x * 5.2 - uTime * ${speed.toFixed(2)};
        vec3 objectNormal = normalize(vec3(-cos(ph0) * ${(amp * 0.9).toFixed(3)} * uv.x, 0.0, 1.0));
      `)
      .replace('#include <begin_vertex>', /* glsl */`
        vec3 transformed = vec3(position);
        float ph = uv.x * 5.2 - uTime * ${speed.toFixed(2)};
        float k = uv.x * uStrength;
        transformed.z += sin(ph) * ${amp.toFixed(3)} * k;
        transformed.y += cos(ph * 0.8) * ${(amp * 0.22).toFixed(3)} * k;
        transformed.x -= ${(amp * 0.12).toFixed(3)} * k * k;
      `);
  };
  m.customProgramCacheKey = () => `cloth-${color}-${amp}-${speed}-${o.opacity ?? 1}`;
  return m;
}

/** 给几何体加上 aSway（按局部 y 归一化） */
export function addSway(geo, y0, y1, scale = 1) {
  const p = geo.attributes.position;
  const a = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) {
    const t = (p.getY(i) - y0) / Math.max(0.001, y1 - y0);
    a[i] = Math.max(0, Math.min(1, t)) * scale;
  }
  geo.setAttribute('aSway', new THREE.BufferAttribute(a, 1));
  return geo;
}

/** 零摆动（供需要与摆动材质合批的静态件使用） */
export function addZeroSway(geo) {
  const p = geo.attributes.position;
  geo.setAttribute('aSway', new THREE.BufferAttribute(new Float32Array(p.count), 1));
  return geo;
}

/** 缓存的摆动材质：同色共用，保证合批后 draw call 很少 */
const swayCache = new Map();
export function foliageMat(color, o = {}) {
  const key = `${color}|${o.amp ?? 0.13}|${o.flat ? 1 : 0}|${o.rough ?? 0.88}|${o.opacity ?? 1}`;
  let m = swayCache.get(key);
  if (!m) { m = swayMaterial(color, o); swayCache.set(key, m); }
  return m;
}
