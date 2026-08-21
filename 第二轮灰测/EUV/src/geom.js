/**
 * geom.js — 参数化几何工具
 * ==================================================================
 * 所有硬件几何均程序化生成（§1.3 无侵权要求：不使用任何第三方模型）。
 * 关键：镜面的位置与朝向一律从 layout.js 读取，绝不在此处另行摆位，
 * 从而保证「几何朝向 = 光路法线」，不会出现画面与光路各说一套。
 */

import * as THREE from 'three';
import { vec } from './layout.js';

const V3 = (v) => new THREE.Vector3(v.x, v.y, v.z);

/**
 * 曲面镜片：圆形栅格 + 球面矢高。
 * @param radius  口径半径
 * @param sagitta 矢高（正 = 凹面朝 +Z，负 = 凸面）
 * @param seg     径向/环向细分
 * 局部坐标：镜面朝 +Z，圆心在原点。
 */
export function curvedDisc(radius, sagitta, seg = 64, rings = 24, innerRadius = 0) {
  const pos = [], nor = [], uv = [], idx = [];
  const R = sagitta !== 0 ? (radius * radius + sagitta * sagitta) / (2 * sagitta) : Infinity;
  const zAt = (r) => (Number.isFinite(R) ? Math.sign(sagitta) * (Math.abs(R) - Math.sqrt(Math.max(0, R * R - r * r))) : 0);
  for (let i = 0; i <= rings; i++) {
    const r = innerRadius + (radius - innerRadius) * (i / rings);
    for (let j = 0; j <= seg; j++) {
      const a = (j / seg) * Math.PI * 2;
      const x = Math.cos(a) * r, y = Math.sin(a) * r, z = zAt(r);
      pos.push(x, y, z);
      // 解析法线：d z/d r = sign * r / sqrt(R²-r²)
      const dz = Number.isFinite(R) && Math.abs(R) > r ? Math.sign(sagitta) * (r / Math.sqrt(R * R - r * r)) : 0;
      const n = new THREE.Vector3(-Math.cos(a) * dz, -Math.sin(a) * dz, 1).normalize();
      nor.push(n.x, n.y, n.z);
      uv.push(0.5 + 0.5 * Math.cos(a) * (r / radius), 0.5 + 0.5 * Math.sin(a) * (r / radius));
    }
  }
  const stride = seg + 1;
  for (let i = 0; i < rings; i++) for (let j = 0; j < seg; j++) {
    const a = i * stride + j, b = a + 1, c = a + stride, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

/**
 * 分面镜（场面镜 / 光瞳面镜）：口径内排布大量小方形面元，
 * 每个面元有微小倾角 —— 这是照明系统把光斑重排为均匀弧形狭缝的物理原理。
 */
export function facetedDisc(radius, facet = 0.28, tilt = 0.05, seed = 5) {
  const geos = [];
  let s = seed >>> 0 || 1;
  const rnd = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) / 4294967296); };
  const n = Math.floor((radius * 2) / facet);
  const start = -radius + facet * 0.5;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const x = start + i * facet, y = start + j * facet;
    if (Math.hypot(x, y) > radius - facet * 0.5) continue;
    const g = new THREE.PlaneGeometry(facet * 0.86, facet * 0.86);
    const m = new THREE.Matrix4();
    const e = new THREE.Euler((rnd() - 0.5) * tilt * 2, (rnd() - 0.5) * tilt * 2, 0);
    m.makeRotationFromEuler(e);
    m.setPosition(x, y, (rnd() - 0.5) * facet * 0.06);
    g.applyMatrix4(m);
    geos.push(g);
  }
  return mergeGeometries(geos);
}

/** 简易几何合并（避免依赖 BufferGeometryUtils 的额外分支） */
export function mergeGeometries(geos) {
  const posArr = [], norArr = [], uvArr = [], idxArr = [];
  let offset = 0;
  for (const g of geos) {
    const p = g.getAttribute('position'), nr = g.getAttribute('normal'), u = g.getAttribute('uv');
    for (let i = 0; i < p.count; i++) {
      posArr.push(p.getX(i), p.getY(i), p.getZ(i));
      if (nr) norArr.push(nr.getX(i), nr.getY(i), nr.getZ(i));
      if (u) uvArr.push(u.getX(i), u.getY(i));
    }
    const ix = g.getIndex();
    if (ix) for (let i = 0; i < ix.count; i++) idxArr.push(ix.getX(i) + offset);
    else for (let i = 0; i < p.count; i++) idxArr.push(i + offset);
    offset += p.count;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(posArr, 3));
  if (norArr.length) out.setAttribute('normal', new THREE.Float32BufferAttribute(norArr, 3));
  if (uvArr.length) out.setAttribute('uv', new THREE.Float32BufferAttribute(uvArr, 2));
  out.setIndex(idxArr);
  out.computeBoundingSphere();
  return out;
}

/**
 * 椭球集光镜面片：直接由 layout.collectorPoint 采样生成。
 * 因此渲染出来的曲面就是「反射后精确通过中间焦点」的那张曲面 —— 无美术近似。
 * 面法线取自 collectorNormal 的解析解并取反（反射面朝向等离子体）。
 */
export function ellipsoidCollectorGeometry({ collectorPoint, collectorNormal, phiMin, phiMax, uSeg = 72, vSeg = 144 }) {
  const pos = [], nor = [], uv = [], idx = [];
  for (let i = 0; i <= uSeg; i++) {
    const phi = phiMin + (phiMax - phiMin) * (i / uSeg);
    for (let j = 0; j <= vSeg; j++) {
      const theta = (j / vSeg) * Math.PI * 2;
      const p = collectorPoint(phi, theta).point;
      const n = collectorNormal(p);
      pos.push(p.x, p.y, p.z);
      nor.push(-n.x, -n.y, -n.z);              // 内法线：反射面朝等离子体
      uv.push(j / vSeg, i / uSeg);
    }
  }
  const stride = vSeg + 1;
  for (let i = 0; i < uSeg; i++) for (let j = 0; j < vSeg; j++) {
    const a = i * stride + j, b = a + 1, c = a + stride, d = c + 1;
    idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

/** 把物体按「位置 + 法线」摆放：局部 +Z 对齐法线 */
export function orient(obj, position, normal, roll = 0) {
  obj.position.copy(V3(position));
  const n = V3(normal).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
  obj.quaternion.copy(q);
  if (roll) obj.rotateZ(roll);
  return obj;
}

/** 沿两点之间放置一根管/杆（局部 +Y 为轴向的几何，如 CylinderGeometry） */
export function span(obj, from, to) {
  const a = V3(from), b = V3(to);
  const mid = a.clone().add(b).multiplyScalar(0.5);
  obj.position.copy(mid);
  const dir = b.clone().sub(a);
  obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  obj.scale.y = dir.length();
  return obj;
}

/** 圆环阵列布置（如冷却管、法兰螺栓、气帘喷嘴） */
export function ringArray(count, radius, cb) {
  const g = new THREE.Group();
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const o = cb(i, a);
    if (!o) continue;
    o.position.set(Math.cos(a) * radius, Math.sin(a) * radius, o.position.z);
    g.add(o);
  }
  return g;
}

/** 螺栓法兰环 */
export function flange(rIn, rOut, thick, boltCount, mat, boltMat) {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(rOut, rOut, thick, 96, 1, false), mat);
  ring.rotation.x = Math.PI / 2;
  const hole = new THREE.Mesh(new THREE.CylinderGeometry(rIn, rIn, thick * 1.2, 64, 1, true), mat);
  hole.rotation.x = Math.PI / 2;
  g.add(ring, hole);
  for (let i = 0; i < boltCount; i++) {
    const a = (i / boltCount) * Math.PI * 2;
    const r = (rIn + rOut) * 0.5 + (rOut - rIn) * 0.28;
    const b = new THREE.Mesh(new THREE.CylinderGeometry(thick * 0.34, thick * 0.34, thick * 1.5, 12), boltMat || mat);
    b.rotation.x = Math.PI / 2;
    b.position.set(Math.cos(a) * r, Math.sin(a) * r, 0);
    g.add(b);
  }
  return g;
}

/** 桁架框（投影物镜/机架用，开放式便于看到内部） */
export function truss(w, h, d, barR, mat, divX = 2, divY = 3) {
  const geos = [];
  const bar = (x1, y1, z1, x2, y2, z2) => {
    const a = new THREE.Vector3(x1, y1, z1), b = new THREE.Vector3(x2, y2, z2);
    const len = a.distanceTo(b);
    const g = new THREE.CylinderGeometry(barR, barR, len, 8, 1);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    m.makeRotationFromQuaternion(q);
    m.setPosition(a.clone().add(b).multiplyScalar(0.5));
    g.applyMatrix4(m);
    geos.push(g);
  };
  const X = [-w / 2, w / 2], Z = [-d / 2, d / 2];
  for (const x of X) for (const z of Z) bar(x, -h / 2, z, x, h / 2, z);          // 立柱
  for (let i = 0; i <= divY; i++) {
    const y = -h / 2 + (h * i) / divY;
    bar(X[0], y, Z[0], X[1], y, Z[0]); bar(X[0], y, Z[1], X[1], y, Z[1]);
    bar(X[0], y, Z[0], X[0], y, Z[1]); bar(X[1], y, Z[0], X[1], y, Z[1]);
  }
  for (let i = 0; i < divY; i++) {                                                // 斜撑
    const y0 = -h / 2 + (h * i) / divY, y1 = -h / 2 + (h * (i + 1)) / divY;
    bar(X[0], y0, Z[0], X[1], y1, Z[0]);
    bar(X[1], y0, Z[1], X[0], y1, Z[1]);
  }
  return new THREE.Mesh(mergeGeometries(geos), mat);
}

/** 散热鳍片阵列 */
export function fins(count, radius, height, thick, mat, span = Math.PI * 2) {
  const geos = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * span;
    const g = new THREE.BoxGeometry(radius * 0.42, thick, height);
    const m = new THREE.Matrix4();
    m.makeRotationZ(a);
    const p = new THREE.Vector3(Math.cos(a) * radius * 0.79, Math.sin(a) * radius * 0.79, 0);
    m.setPosition(p);
    g.applyMatrix4(m);
    geos.push(g);
  }
  return new THREE.Mesh(mergeGeometries(geos), mat);
}

/** 弧形照明狭缝的截面轮廓（环形场光学的弧形狭缝） */
export function arcSlitShape(arcRadius, arcSpan, slitWidth, seg = 48) {
  const pts = [];
  for (let i = 0; i <= seg; i++) {
    const a = -arcSpan / 2 + (arcSpan * i) / seg;
    pts.push(new THREE.Vector2(Math.sin(a) * (arcRadius + slitWidth / 2), Math.cos(a) * (arcRadius + slitWidth / 2) - arcRadius));
  }
  for (let i = seg; i >= 0; i--) {
    const a = -arcSpan / 2 + (arcSpan * i) / seg;
    pts.push(new THREE.Vector2(Math.sin(a) * (arcRadius - slitWidth / 2), Math.cos(a) * (arcRadius - slitWidth / 2) - arcRadius));
  }
  return new THREE.Shape(pts);
}

export { V3 };
