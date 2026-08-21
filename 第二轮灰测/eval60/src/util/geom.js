/**
 * 几何构建工具：放样(loft)、剖面、镜像、堆料(greeble)。
 * 战舰的“精致感”主要来自这里 —— 用放样做出连续变截面的舰体，
 * 而不是简单堆方块。
 */
import * as THREE from 'three';
import { TAU, clamp01, lerp } from './math.js';

/** 超椭圆剖面：|x|^e + |y|^e = 1 */
export function superellipse(segments = 24, exp = 2.5, w = 1, h = 1) {
  const pts = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * TAU;
    const c = Math.cos(a), s = Math.sin(a);
    const p = 2 / exp;
    pts.push(new THREE.Vector2(
      w * Math.sign(c) * Math.pow(Math.abs(c), p),
      h * Math.sign(s) * Math.pow(Math.abs(s), p),
    ));
  }
  return pts;
}

/**
 * 舰体剖面：上圆下平、带侧棱的硬朗轮廓。
 * keel 底部压平量, chine 侧棱外扩, crown 顶部隆起
 */
export function hullProfile(segments = 28, { keel = 0.55, chine = 1.12, crown = 0.92 } = {}) {
  const pts = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * TAU;
    let x = Math.cos(a), y = Math.sin(a);
    const side = Math.pow(Math.abs(x), 1.6);
    x *= lerp(1, chine, side);
    y = y > 0 ? y * crown : y * keel;
    const k = 0.22; // 轻微方形化 → 折面感
    x = x * (1 - k) + Math.sign(x) * Math.pow(Math.abs(x), 0.55) * k;
    y = y * (1 - k) + Math.sign(y) * Math.pow(Math.abs(y), 0.6) * k;
    pts.push(new THREE.Vector2(x, y));
  }
  return pts;
}

/** 机翼翼型剖面（x=弦向, y=厚度），闭合环、逆时针 */
export function airfoilProfile(segments = 22, thickness = 0.16, camber = 0.02) {
  const pts = [];
  const n = Math.max(6, Math.floor(segments / 2));
  const t = (x) =>
    (thickness / 0.2) *
    (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1015 * x ** 4);
  for (let i = 0; i <= n; i++) {
    const x = i / n;
    pts.push(new THREE.Vector2(x - 0.5, t(x) + camber * Math.sin(Math.PI * x)));
  }
  for (let i = n - 1; i >= 1; i--) {
    const x = i / n;
    pts.push(new THREE.Vector2(x - 0.5, -t(x) * 0.72 + camber * Math.sin(Math.PI * x)));
  }
  pts.reverse(); // 上表面→下表面的顺序是顺时针，反转成逆时针
  return pts;
}

/**
 * 放样：2D 闭合剖面沿 +Z 按站位缩放/偏移，生成连续外壳。
 * station: { z, sx, sy, ox, oy, roll }
 */
export function loft(profile, stations, { capStart = true, capEnd = true, uvScale = [1, 1] } = {}) {
  const P = profile.length;
  const S = stations.length;
  const ring = P + 1; // 复制首点用于 UV 接缝
  const verts = [];
  const uvs = [];
  const idx = [];

  let vLen = 0;
  const vAt = [0];
  for (let s = 1; s < S; s++) {
    vLen += Math.abs(stations[s].z - stations[s - 1].z);
    vAt.push(vLen);
  }
  const vNorm = vLen || 1;

  for (let s = 0; s < S; s++) {
    const st = stations[s];
    const sx = st.sx ?? 1, sy = st.sy ?? st.sx ?? 1;
    const ox = st.ox ?? 0, oy = st.oy ?? 0, roll = st.roll ?? 0;
    const cr = Math.cos(roll), sr = Math.sin(roll);
    for (let p = 0; p < ring; p++) {
      const pp = profile[p % P];
      const x = pp.x * sx, y = pp.y * sy;
      verts.push(x * cr - y * sr + ox, x * sr + y * cr + oy, st.z);
      uvs.push((p / P) * uvScale[0], (vAt[s] / vNorm) * uvScale[1]);
    }
  }

  for (let s = 0; s < S - 1; s++) {
    for (let p = 0; p < P; p++) {
      const a = s * ring + p, b = a + 1, c = a + ring, d = c + 1;
      // 逆时针剖面 + 递增 z ⇒ (a,b,c)/(b,d,c) 才是朝外的法线
      idx.push(a, b, c, b, d, c);
    }
  }

  const capOf = (s, flip) => {
    const base = verts.length / 3;
    const st = stations[s];
    verts.push(st.ox ?? 0, st.oy ?? 0, st.z);
    uvs.push(0.5, 0.5);
    for (let p = 0; p < ring; p++) {
      const src = (s * ring + p) * 3;
      verts.push(verts[src], verts[src + 1], verts[src + 2]);
      const a = (p / P) * TAU;
      uvs.push(0.5 + 0.5 * Math.cos(a), 0.5 + 0.5 * Math.sin(a));
    }
    for (let p = 0; p < P; p++) {
      const a = base, b = base + 1 + p, c = base + 2 + p;
      if (flip) idx.push(a, c, b); else idx.push(a, b, c);
    }
  };
  if (capStart) capOf(0, true);
  if (capEnd) capOf(S - 1, false);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();

  // 修补 UV 接缝法线（首末点同位置）
  const nrm = geo.attributes.normal;
  for (let s = 0; s < S; s++) {
    const a = s * ring, b = s * ring + P;
    const nx = (nrm.getX(a) + nrm.getX(b)) * 0.5;
    const ny = (nrm.getY(a) + nrm.getY(b)) * 0.5;
    const nz = (nrm.getZ(a) + nrm.getZ(b)) * 0.5;
    const l = Math.hypot(nx, ny, nz) || 1;
    nrm.setXYZ(a, nx / l, ny / l, nz / l);
    nrm.setXYZ(b, nx / l, ny / l, nz / l);
  }
  nrm.needsUpdate = true;
  return geo;
}

/** 沿 X 轴镜像（自动修正绕序） */
export function mirroredX(geo) {
  const g = geo.clone();
  g.applyMatrix4(new THREE.Matrix4().makeScale(-1, 1, 1));
  const index = g.getIndex();
  if (index) {
    const a = index.array;
    for (let i = 0; i < a.length; i += 3) {
      const t = a[i];
      a[i] = a[i + 2];
      a[i + 2] = t;
    }
    index.needsUpdate = true;
  }
  return g;
}

/** 变换后的副本，便于合并 */
export function xform(geo, { pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1] } = {}) {
  const g = geo.clone();
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rot[0], rot[1], rot[2]));
  m.compose(
    new THREE.Vector3(pos[0], pos[1], pos[2]),
    q,
    new THREE.Vector3(scale[0], scale[1], scale[2]),
  );
  g.applyMatrix4(m);
  return g;
}

/** 合并几何（只保留 position/normal/uv，Node 环境亦可用） */
export function mergeAll(geos) {
  const list = [];
  for (const src of geos) {
    if (!src) continue;
    const g = src;
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) {
      const n = g.attributes.position.count;
      g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', g.attributes.position.clone());
    out.setAttribute('normal', g.attributes.normal.clone());
    out.setAttribute('uv', g.attributes.uv.clone());
    if (g.index) out.setIndex(g.index.clone());
    else {
      const n = g.attributes.position.count;
      const seq = new Uint32Array(n);
      for (let i = 0; i < n; i++) seq[i] = i;
      out.setIndex(new THREE.BufferAttribute(seq, 1));
    }
    list.push(out);
  }
  if (!list.length) return new THREE.BufferGeometry();

  let vCount = 0, iCount = 0;
  for (const g of list) {
    vCount += g.attributes.position.count;
    iCount += g.index.count;
  }
  const pos = new Float32Array(vCount * 3);
  const nor = new Float32Array(vCount * 3);
  const uv = new Float32Array(vCount * 2);
  const ind = vCount > 65535 ? new Uint32Array(iCount) : new Uint16Array(iCount);
  let vo = 0, io = 0;
  for (const g of list) {
    pos.set(g.attributes.position.array, vo * 3);
    nor.set(g.attributes.normal.array, vo * 3);
    uv.set(g.attributes.uv.array, vo * 2);
    const ia = g.index.array;
    for (let i = 0; i < ia.length; i++) ind[io + i] = ia[i] + vo;
    vo += g.attributes.position.count;
    io += ia.length;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setIndex(new THREE.BufferAttribute(ind, 1));
  return out;
}

/** 倒角盒：比 BoxGeometry 更有工业感 */
export function bevelBox(w, h, d, bevel = 0.08) {
  const b = Math.min(bevel, Math.min(w, h, d) * 0.32);
  const prof = [
    new THREE.Vector2(-w / 2 + b, -h / 2),
    new THREE.Vector2(w / 2 - b, -h / 2),
    new THREE.Vector2(w / 2, -h / 2 + b),
    new THREE.Vector2(w / 2, h / 2 - b),
    new THREE.Vector2(w / 2 - b, h / 2),
    new THREE.Vector2(-w / 2 + b, h / 2),
    new THREE.Vector2(-w / 2, h / 2 - b),
    new THREE.Vector2(-w / 2, -h / 2 + b),
  ];
  const shrinkX = 1 - (b / w) * 1.4;
  const shrinkY = 1 - (b / h) * 1.4;
  return loft(prof, [
    { z: -d / 2, sx: shrinkX, sy: shrinkY },
    { z: -d / 2 + b, sx: 1, sy: 1 },
    { z: d / 2 - b, sx: 1, sy: 1 },
    { z: d / 2, sx: shrinkX, sy: shrinkY },
  ]);
}

/**
 * 在“表面采样函数”上撒细节零件（greeble）。
 * sampler(u, v, rng) → { pos:[x,y,z], normal:[x,y,z], tangent:[x,y,z] }
 */
export function greebleField(sampler, rng, count, opts = {}) {
  const {
    sizeRange = [0.06, 0.3],
    heightRange = [0.02, 0.12],
    kinds = ['box', 'box', 'plate', 'pipe', 'dome'],
  } = opts;
  const geos = [];
  const pos = new THREE.Vector3();
  const nrm = new THREE.Vector3();
  const tan = new THREE.Vector3();
  const bin = new THREE.Vector3();
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const basis = new THREE.Matrix4();
  const one = new THREE.Vector3(1, 1, 1);

  for (let i = 0; i < count; i++) {
    const s = sampler(rng(), rng(), rng);
    if (!s) continue;
    const kind = rng.pick(kinds);
    const sx = rng.range(sizeRange[0], sizeRange[1]);
    const sy = rng.range(sizeRange[0], sizeRange[1]) * (kind === 'plate' ? 1.6 : 1);
    const hh = rng.range(heightRange[0], heightRange[1]) * (kind === 'plate' ? 0.35 : 1);
    let g;
    if (kind === 'pipe') {
      // 管路沿表面切向铺设（局部 +Y = 切向）
      g = new THREE.CylinderGeometry(hh * 0.5, hh * 0.5, sy * 2.4, 7, 1);
    } else if (kind === 'dome') {
      g = new THREE.SphereGeometry(hh * 1.2, 8, 5, 0, TAU, 0, Math.PI / 2);
      g.rotateX(Math.PI / 2);
    } else {
      g = bevelBox(sx, sy, hh * 2, hh * 0.35);
    }

    nrm.fromArray(s.normal).normalize();
    tan.fromArray(s.tangent ?? [1, 0, 0]);
    if (Math.abs(tan.dot(nrm)) > 0.95) tan.set(0, 1, 0);
    bin.copy(nrm).cross(tan).normalize();
    tan.copy(bin).cross(nrm).normalize();
    basis.makeBasis(tan, bin, nrm); // 零件 +Z 对齐法线
    q.setFromRotationMatrix(basis);
    q.premultiply(new THREE.Quaternion().setFromAxisAngle(nrm, rng() * TAU));
    pos.fromArray(s.pos).addScaledVector(nrm, hh * 0.3);
    m.compose(pos, q, one);
    g.applyMatrix4(m);
    geos.push(g);
  }
  return mergeAll(geos);
}

/** 不规则岩石（小行星） */
export function rockGeometry(radius, detail, rng) {
  const g = new THREE.IcosahedronGeometry(radius, detail);
  const pos = g.attributes.position;
  const v = new THREE.Vector3();
  const a = rng() * 10, b = rng() * 10;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = Math.sin(v.x * 1.7 + a) * Math.cos(v.y * 1.9 + b) * Math.sin(v.z * 1.3 + a * 0.5);
    v.multiplyScalar(1 + n * 0.26 + (rng() - 0.5) * 0.12);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

/** 行星环几何，UV.x = 径向归一化 */
export function ringGeometry(inner, outer, segments = 220) {
  const g = new THREE.RingGeometry(inner, outer, segments, 3);
  const pos = g.attributes.position;
  const uv = g.attributes.uv;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    uv.setXY(i, clamp01((v.length() - inner) / (outer - inner)), 0.5);
  }
  uv.needsUpdate = true;
  return g;
}
