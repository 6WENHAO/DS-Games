/**
 * RadialGrid.js — 以相机为中心的放射状 LOD 网格。
 *
 * 环向等分、径向按指数增长：脚下每格不到 1 m，地平线附近每格数百米，
 * 一个 draw call 覆盖十几公里，天然实现 LOD（顶点密度随距离指数下降）。
 * 地形与海面共用同一套网格。
 */
import * as THREE from 'three';

/**
 * @param {object} o
 * @param {number} o.rings   径向环数
 * @param {number} o.segs    环向分段（建议 2 的幂）
 * @param {number} o.r0      最内环半径（米）
 * @param {number} o.rMax    最外环半径（米）
 * @returns {THREE.BufferGeometry} 含 position(xz平面) 与 aRadius/aRing 属性
 */
export function makeRadialGrid({ rings = 200, segs = 192, r0 = 1.0, rMax = 12000 }) {
  const growth = Math.pow(rMax / r0, 1 / (rings - 1));
  const vcount = rings * segs + 1;               // +1 = 圆心
  const pos = new Float32Array(vcount * 3);
  const rad = new Float32Array(vcount);
  const ringIdx = new Float32Array(vcount);
  // 圆心
  pos[0] = 0; pos[1] = 0; pos[2] = 0; rad[0] = 0; ringIdx[0] = 0;
  let r = r0;
  for (let i = 0; i < rings; i++) {
    for (let j = 0; j < segs; j++) {
      const a = (j / segs) * Math.PI * 2;
      const k = 1 + i * segs + j;
      pos[k * 3 + 0] = Math.cos(a) * r;
      pos[k * 3 + 1] = 0;
      pos[k * 3 + 2] = Math.sin(a) * r;
      rad[k] = r;
      ringIdx[k] = i / (rings - 1);
    }
    r *= growth;
  }
  const tri = [];
  // 圆心扇形
  for (let j = 0; j < segs; j++) {
    const a = 1 + j;
    const b = 1 + ((j + 1) % segs);
    tri.push(0, b, a);
  }
  // 环带
  for (let i = 0; i < rings - 1; i++) {
    const base = 1 + i * segs;
    const next = 1 + (i + 1) * segs;
    for (let j = 0; j < segs; j++) {
      const j2 = (j + 1) % segs;
      const a = base + j, b = base + j2, c = next + j, d = next + j2;
      tri.push(a, d, c, a, b, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(vcount * 3).fill(0), 3));
  for (let i = 0; i < vcount; i++) g.attributes.normal.setY(i, 1);
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(vcount * 2), 2));
  g.setAttribute('aRadius', new THREE.BufferAttribute(rad, 1));
  g.setAttribute('aRing', new THREE.BufferAttribute(ringIdx, 1));
  g.setIndex(vcount > 65000 ? new THREE.Uint32BufferAttribute(tri, 1) : new THREE.Uint16BufferAttribute(tri, 1));
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), rMax * 1.5);
  return g;
}
