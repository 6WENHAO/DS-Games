/**
 * 自然要素：多种树木（阔叶/针叶/白桦/柳/果树/古橡）、灌木、花丛、
 * 岩石、草簇、麦田、菜畦、羊群等。树冠使用风摆材质。
 */
import * as THREE from 'three';
import {
  mat, mesh, group, box, roundedBox, cyl, cone, sphere, lathe, RNG, TAU, clamp, lerp,
  mergeGeometries, distToPolyline,
} from '../lib/utils.js';
import { foliageMat, addSway } from '../lib/wind.js';
import { PAL } from './buildings.js';
import { groundHeight, slopeAt, riverDist, ROAD_PTS, RAIL_PTS, WALK_PATHS } from './layout.js';

const LEAF_COLORS = ['#4f8b46', '#5f9c4a', '#69a552', '#3f7a3f', '#6faa55', '#7fae4f'];
const LEAF_AUTUMN = ['#c98a3a', '#b06a35', '#d9a83c'];

function trunkMat() { return mat('#6b4f38', { rough: 0.95 }); }

/* ------------------------------------------------------------ 树 */
/** 阔叶树：分叉树干 + 多团树冠 */
export function makeBroadleaf(rng, scale = 1) {
  const g = group('tree');
  const h = rng.range(3.0, 4.6) * scale;
  const tm = trunkMat();
  const trunk = lathe([[0.34, 0], [0.26, 0.5], [0.2, h * 0.55], [0.15, h]], 8);
  trunk.scale(scale, 1, scale);
  g.add(mesh(trunk, tm, { ry: rng.range(0, TAU) }));
  // 侧枝
  const branches = rng.int(2, 3);
  for (let i = 0; i < branches; i++) {
    const a = rng.range(0, TAU);
    const bl = rng.range(0.9, 1.5) * scale;
    g.add(mesh(cyl(0.06 * scale, 0.11 * scale, bl, 6), tm, {
      x: Math.sin(a) * 0.2, y: h * rng.range(0.45, 0.72), z: Math.cos(a) * 0.2,
      rz: Math.cos(a) * 0.9, rx: -Math.sin(a) * 0.9,
    }));
  }
  const col = rng.chance(0.12) ? rng.pick(LEAF_AUTUMN) : rng.pick(LEAF_COLORS);
  const fm = foliageMat(col, { amp: 0.16, flat: rng.chance(0.4) });
  const blobs = rng.int(3, 5);
  const top = h + rng.range(1.1, 1.9) * scale;
  for (let i = 0; i < blobs; i++) {
    const r = rng.range(0.85, 1.4) * scale;
    const bx = rng.jitter(0.95 * scale), bz = rng.jitter(0.95 * scale);
    const by = h * rng.range(0.82, 1.0) + rng.range(0.2, 1.1) * scale;
    const geo = sphere(r, 8, 6);
    geo.scale(1, rng.range(0.72, 1.0), 1);
    geo.translate(bx, by, bz);
    addSway(geo, h * 0.5, top, 1);
    g.add(mesh(geo, fm, {}));
  }
  g.userData.radius = 1.7 * scale;
  return g;
}

/** 针叶树 */
export function makeConifer(rng, scale = 1) {
  const g = group('conifer');
  const h = rng.range(4.5, 7.0) * scale;
  g.add(mesh(cyl(0.16 * scale, 0.32 * scale, h * 0.5, 7), trunkMat(), {}));
  const col = rng.pick(['#2f6b45', '#37784a', '#43855a', '#2b5f3f']);
  const fm = foliageMat(col, { amp: 0.07, flat: true });
  const tiers = rng.int(4, 6);
  for (let i = 0; i < tiers; i++) {
    const t = i / tiers;
    const r = lerp(1.5, 0.32, t) * scale * rng.range(0.92, 1.08);
    const y = h * (0.18 + t * 0.78);
    const geo = cone(r, h * 0.34, 9);
    geo.translate(rng.jitter(0.06), y, rng.jitter(0.06));
    addSway(geo, h * 0.2, h * 1.05, 1);
    g.add(mesh(geo, fm, {}));
  }
  g.userData.radius = 1.5 * scale;
  return g;
}

/** 白桦：细白树干 + 稀疏树冠 */
export function makeBirch(rng, scale = 1) {
  const g = group('birch');
  const h = rng.range(4.2, 6.0) * scale;
  const bark = mat('#e2ddd2', { rough: 0.9 });
  const dark = mat('#5a5850', { rough: 0.9 });
  g.add(mesh(cyl(0.1 * scale, 0.17 * scale, h, 7), bark, { rz: rng.jitter(0.04) }));
  for (let i = 0; i < 6; i++) {
    g.add(mesh(box(0.19 * scale, 0.07, 0.05), dark, { y: h * rng.range(0.15, 0.9), z: 0.14 * scale, ry: rng.range(0, TAU) }));
  }
  const fm = foliageMat(rng.pick(['#8fbb55', '#9fc95f', '#7fae4f']), { amp: 0.2, flat: false });
  for (let i = 0; i < 3; i++) {
    const r = rng.range(0.7, 1.05) * scale;
    const geo = sphere(r, 8, 6);
    geo.scale(1, 1.15, 1);
    geo.translate(rng.jitter(0.6), h * rng.range(0.86, 1.06), rng.jitter(0.6));
    addSway(geo, h * 0.4, h * 1.2, 1.1);
    g.add(mesh(geo, fm, {}));
  }
  g.userData.radius = 1.2 * scale;
  return g;
}

/** 柳树：垂枝 */
export function makeWillow(rng, scale = 1) {
  const g = group('willow');
  const h = rng.range(2.6, 3.6) * scale;
  g.add(mesh(lathe([[0.42, 0], [0.3, 0.6], [0.24, h]], 8), trunkMat(), {}));
  const fm = foliageMat(rng.pick(['#7fae4f', '#8fbb55', '#6faa55']), { amp: 0.24 });
  for (let i = 0; i < 5; i++) {
    const r = rng.range(1.0, 1.5) * scale;
    const geo = sphere(r, 9, 6);
    geo.scale(1.15, 0.62, 1.15);
    geo.translate(rng.jitter(1.0), h + rng.range(0.1, 0.7), rng.jitter(1.0));
    addSway(geo, h * 0.4, h + 1.4, 1);
    g.add(mesh(geo, fm, {}));
  }
  // 垂条
  for (let i = 0; i < 16; i++) {
    const a = rng.range(0, TAU), rr = rng.range(0.7, 1.7) * scale;
    const len = rng.range(0.9, 1.9) * scale;
    const geo = box(0.07, len, 0.07);
    geo.translate(Math.sin(a) * rr, h + 0.5 - len, Math.cos(a) * rr);
    addSway(geo, h + 0.6 - len, h + 0.6, 1.4);
    g.add(mesh(geo, fm, {}));
  }
  g.userData.radius = 1.8 * scale;
  return g;
}

/** 果树 */
export function makeFruitTree(rng, scale = 1) {
  const g = group('fruit');
  const h = rng.range(1.5, 2.1) * scale;
  g.add(mesh(lathe([[0.26, 0], [0.2, 0.4], [0.16, h]], 7), trunkMat(), {}));
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU + rng.range(0, 1);
    g.add(mesh(cyl(0.05, 0.09, 0.8 * scale, 5), trunkMat(), { y: h * 0.8, rz: Math.cos(a), rx: -Math.sin(a) }));
  }
  const fm = foliageMat(rng.pick(['#4f8b46', '#5f9c4a']), { amp: 0.13, flat: true });
  const geo = sphere(1.15 * scale, 9, 7);
  geo.scale(1, 0.82, 1);
  geo.translate(0, h + 0.75 * scale, 0);
  addSway(geo, h * 0.5, h + 1.9 * scale, 1);
  g.add(mesh(geo, fm, {}));
  const fruit = mat(rng.chance(0.5) ? '#d9483a' : '#e8a13c', { rough: 0.7 });
  for (let i = 0; i < 7; i++) {
    const a = rng.range(0, TAU), rr = rng.range(0.5, 1.05) * scale;
    g.add(mesh(sphere(0.11 * scale, 6, 5), fruit, {
      x: Math.sin(a) * rr, y: h + rng.range(0.35, 1.2) * scale, z: Math.cos(a) * rr,
    }));
  }
  g.userData.radius = 1.2 * scale;
  return g;
}

/** 山顶古橡（带树屋与秋千） */
export function makeGreatOak(rng) {
  const g = group('greatOak');
  const tm = mat('#5f4530', { rough: 0.96 });
  const h = 5.6;
  g.add(mesh(lathe([[1.5, 0], [1.1, 0.7], [0.8, 2.2], [0.62, 4.0], [0.5, h]], 10), tm, {}));
  // 板根
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + 0.3;
    g.add(mesh(cone(0.42, 1.5, 6), tm, { x: Math.sin(a) * 1.1, z: Math.cos(a) * 1.1, rz: -Math.sin(a) * 0.5, rx: Math.cos(a) * 0.5 }));
  }
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU + 0.7;
    g.add(mesh(cyl(0.14, 0.3, 2.6, 6), tm, {
      x: Math.sin(a) * 0.4, y: h * 0.62, z: Math.cos(a) * 0.4,
      rz: Math.cos(a) * 1.0, rx: -Math.sin(a) * 1.0,
    }));
  }
  const fm = foliageMat('#3f7a3f', { amp: 0.11, flat: true });
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TAU + rng.range(0, 0.6);
    const rr = i === 0 ? 0 : rng.range(1.1, 2.5);
    const r = rng.range(1.5, 2.4);
    const geo = sphere(r, 9, 7);
    geo.scale(1, 0.78, 1);
    geo.translate(Math.sin(a) * rr, h + rng.range(0.2, 1.9), Math.cos(a) * rr);
    addSway(geo, h * 0.5, h + 4, 1);
    g.add(mesh(geo, fm, {}));
  }
  // 树屋
  const th = group('treehouse', 1.0, 3.1, 0.6, 0.5);
  const wood = mat(PAL.wood, { rough: 0.9 });
  const woodDark = mat(PAL.woodDark, { rough: 0.9 });
  th.add(mesh(box(2.3, 0.14, 2.0), woodDark, {}));
  th.add(mesh(roundedBox(1.7, 1.3, 1.5, 0.08), wood, { y: 0.14 }));
  th.add(mesh(cone(1.4, 0.8, 4), mat('#8a4a38', { rough: 0.85 }), { y: 1.44, ry: Math.PI / 4 }));
  th.add(mesh(box(0.5, 0.5, 0.06), mat('#3a2f26', { rough: 0.8 }), { y: 0.55, z: 0.78 }));
  for (let i = 0; i < 5; i++) th.add(mesh(box(0.6, 0.07, 0.07), woodDark, { x: -1.4, y: -0.3 - i * 0.55, z: 0.2, rz: 0.1 }));
  g.add(th);
  g.userData.radius = 3.2;
  return g;
}

/* ------------------------------------------------------------ 灌木 / 花 / 草 / 石头 */
export function makeBush(rng) {
  const g = group('bush');
  const fm = foliageMat(rng.pick(['#4f8b46', '#5f9c4a', '#43855a']), { amp: 0.09, flat: rng.chance(0.5) });
  const n = rng.int(2, 4);
  for (let i = 0; i < n; i++) {
    const r = rng.range(0.4, 0.72);
    const geo = sphere(r, 7, 5);
    geo.scale(1.15, 0.85, 1.15);
    geo.translate(rng.jitter(0.4), r * 0.7, rng.jitter(0.4));
    addSway(geo, 0, r * 1.7, 0.7);
    g.add(mesh(geo, fm, {}));
  }
  if (rng.chance(0.4)) {
    const fl = mat(rng.pick(['#e0576a', '#e8a13c', '#d97fb8', '#f0e6a0', '#a87fd8']), { rough: 0.85 });
    for (let i = 0; i < 5; i++) g.add(mesh(sphere(0.09, 5, 4), fl, { x: rng.jitter(0.6), y: rng.range(0.5, 1.0), z: rng.jitter(0.6) }));
  }
  return g;
}

export function makeFlowerPatch(rng) {
  const g = group('flowers');
  const stem = foliageMat('#5f9c4a', { amp: 0.16 });
  const cols = ['#e0576a', '#e8c13c', '#d97fb8', '#f2ede0', '#a87fd8', '#e88a4a'];
  const fm = mat(rng.pick(cols), { rough: 0.85 });
  const n = rng.int(6, 12);
  for (let i = 0; i < n; i++) {
    const x = rng.jitter(0.7), z = rng.jitter(0.7);
    const h = rng.range(0.22, 0.42);
    const st = box(0.035, h, 0.035);
    st.translate(x, 0, z);
    addSway(st, 0, h, 1);
    g.add(mesh(st, stem, {}));
    const head = sphere(0.075, 5, 4);
    head.translate(x, h, z);
    addSway(head, 0, h, 1);
    g.add(mesh(head, fm, {}));
  }
  return g;
}

export function makeGrassTuft(rng) {
  const g = group('tuft');
  const fm = foliageMat(rng.pick(['#6faa55', '#7fae4f', '#5f9c4a']), { amp: 0.14 });
  for (let i = 0; i < 4; i++) {
    const a = rng.range(0, TAU);
    const h = rng.range(0.3, 0.55);
    const geo = cone(0.055, h, 4);
    geo.translate(Math.sin(a) * 0.1, 0, Math.cos(a) * 0.1);
    addSway(geo, 0, h, 1);
    g.add(mesh(geo, fm, { rz: Math.cos(a) * 0.24, rx: -Math.sin(a) * 0.24, cast: false }));
  }
  return g;
}

export function makeRock(rng, scale = 1) {
  const g = group('rock');
  const c = rng.pick(['#8b8478', '#7a7367', '#948d80', '#6f6a5f']);
  const m = mat(c, { rough: 0.98, flat: true });
  const n = rng.int(1, 3);
  for (let i = 0; i < n; i++) {
    const geo = new THREE.IcosahedronGeometry(rng.range(0.4, 0.95) * scale, 0);
    const p = geo.attributes.position;
    for (let k = 0; k < p.count; k++) {
      p.setXYZ(k, p.getX(k) * rng.range(0.75, 1.3), p.getY(k) * rng.range(0.5, 1.0), p.getZ(k) * rng.range(0.75, 1.3));
    }
    geo.computeVertexNormals();
    g.add(mesh(geo, m, {
      x: rng.jitter(0.5 * scale), y: rng.range(0.05, 0.25) * scale, z: rng.jitter(0.5 * scale), ry: rng.range(0, TAU),
    }));
  }
  return g;
}

/* ------------------------------------------------------------ 农田 */
export function makeWheatField(w, d, rng) {
  const g = group('wheat');
  const stalk = foliageMat('#d9c05c', { amp: 0.09 });
  const ear = foliageMat('#e8cf6a', { amp: 0.09 });
  const rows = Math.floor(d / 0.55);
  const perRow = Math.floor(w / 0.42);
  const geos = [], geos2 = [];
  for (let r = 0; r < rows; r++) {
    for (let i = 0; i < perRow; i++) {
      const x = -w / 2 + (w * (i + 0.5)) / perRow + rng.jitter(0.08);
      const z = -d / 2 + (d * (r + 0.5)) / rows + rng.jitter(0.06);
      const h = rng.range(0.6, 0.9);
      const s = box(0.045, h, 0.045);
      s.translate(x, 0, z);
      addSway(s, 0, h, 1);
      geos.push(s);
      const e = sphere(0.075, 5, 4);
      e.scale(1, 1.9, 1);
      e.translate(x, h + 0.06, z);
      addSway(e, 0, h, 1.05);
      geos2.push(e);
    }
  }
  g.add(mesh(mergeGeometries(geos, false), stalk, { cast: false }));
  g.add(mesh(mergeGeometries(geos2, false), ear, { cast: false }));
  return g;
}

export function makeVeggiePatch(w, d, rng) {
  const g = group('veggie');
  const soil = mat('#5f4632', { rough: 1 });
  const leafM = foliageMat('#5f9c4a', { amp: 0.06 });
  const rows = Math.max(2, Math.floor(d / 0.9));
  for (let r = 0; r < rows; r++) {
    const z = -d / 2 + (d * (r + 0.5)) / rows;
    g.add(mesh(box(w, 0.18, 0.55), soil, { z, y: -0.02 }));
    const n = Math.floor(w / 0.5);
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + (w * (i + 0.5)) / n;
      const geo = sphere(rng.range(0.14, 0.22), 6, 5);
      geo.scale(1.2, 0.8, 1.2);
      geo.translate(x, 0.2, z);
      addSway(geo, 0.1, 0.45, 0.6);
      g.add(mesh(geo, leafM, { cast: false }));
    }
  }
  return g;
}

/* ------------------------------------------------------------ 动物 */
export function makeSheep(rng) {
  const g = group('sheep');
  const wool = mat(rng.chance(0.15) ? '#4a4a48' : '#f0ece0', { rough: 1 });
  const skin = mat('#3a3530', { rough: 0.9 });
  const body = sphere(0.44, 9, 7);
  body.scale(1.35, 0.95, 1);
  g.add(mesh(body, wool, { y: 0.62 }));
  for (let i = 0; i < 5; i++) {
    g.add(mesh(sphere(rng.range(0.16, 0.24), 6, 5), wool, { x: rng.jitter(0.45), y: 0.62 + rng.jitter(0.2), z: rng.jitter(0.3) }));
  }
  const head = group('head', 0.62, 0.78, 0);
  head.add(mesh(sphere(0.19, 8, 6), skin, { sx: 1.2 }));
  head.add(mesh(sphere(0.12, 6, 5), wool, { x: -0.1, y: 0.08 }));
  for (const s of [-1, 1]) head.add(mesh(sphere(0.07, 5, 4), skin, { x: -0.02, y: 0.06, z: s * 0.17, sx: 0.7, sy: 0.6 }));
  g.add(head);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    g.add(mesh(box(0.1, 0.42, 0.1), skin, { x: sx * 0.3, y: 0.2, z: sz * 0.22 }));
  }
  g.add(mesh(sphere(0.09, 5, 4), wool, { x: -0.62, y: 0.66 }));
  return g;
}

export function makeDog(rng) {
  const g = group('dog');
  const c = mat(rng.pick(['#b4844a', '#8a6a4a', '#e0dcd0', '#4a4038']), { rough: 0.95 });
  const body = sphere(0.24, 8, 6);
  body.scale(1.5, 0.9, 0.9);
  g.add(mesh(body, c, { y: 0.42 }));
  g.add(mesh(sphere(0.17, 8, 6), c, { x: 0.36, y: 0.56, sx: 1.1 }));
  g.add(mesh(box(0.13, 0.1, 0.1), c, { x: 0.52, y: 0.5 }));
  for (const s of [-1, 1]) g.add(mesh(box(0.05, 0.13, 0.09), c, { x: 0.3, y: 0.7, z: s * 0.11, rz: 0.2 }));
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    g.add(mesh(box(0.08, 0.3, 0.08), c, { x: sx * 0.2, y: 0.14, z: sz * 0.14 }));
  }
  g.add(mesh(box(0.07, 0.3, 0.07), c, { x: -0.36, y: 0.52, rz: -0.9 }));
  return g;
}

export function makeCat(rng) {
  const g = group('cat');
  const c = mat(rng.pick(['#d8a04a', '#4a4038', '#e0dcd0', '#8a7a6a']), { rough: 0.95 });
  const body = sphere(0.17, 7, 6);
  body.scale(1.5, 0.9, 0.9);
  g.add(mesh(body, c, { y: 0.26 }));
  g.add(mesh(sphere(0.13, 7, 6), c, { x: 0.26, y: 0.36 }));
  for (const s of [-1, 1]) g.add(mesh(cone(0.06, 0.11, 4), c, { x: 0.24, y: 0.46, z: s * 0.07 }));
  g.add(mesh(box(0.05, 0.42, 0.05), c, { x: -0.28, y: 0.3, rz: -0.5 }));
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(mesh(box(0.06, 0.2, 0.06), c, { x: sx * 0.14, y: 0.06, z: sz * 0.1 }));
  return g;
}

/* ------------------------------------------------------------ 自然散布 */
/**
 * @param {Array<{x:number,z:number,r:number}>} occupied 已被建筑占用的圆
 */
export function makeScatterHelper(occupied) {
  const walkPts = WALK_PATHS.map((p) => p.pts);
  function free(x, z, r, o = {}) {
    if (Math.hypot(x, z) > 41) return false;
    const y = groundHeight(x, z);
    if (y < (o.minY ?? 0.85) || y > (o.maxY ?? 22)) return false;
    if (slopeAt(x, z) > (o.maxSlope ?? 0.62)) return false;
    if (distToPolyline(x, z, ROAD_PTS).dist < r + (o.roadClear ?? 2.4)) return false;
    if (distToPolyline(x, z, RAIL_PTS.map((p) => [p[0], p[1]])).dist < r + 1.8) return false;
    for (const w of walkPts) if (distToPolyline(x, z, w).dist < r + 1.1) return false;
    const rd = riverDist(x, z).dist;
    if (rd < r + (o.riverClear ?? 2.6)) return false;
    for (const c of occupied) {
      if (Math.hypot(x - c.x, z - c.z) < r + c.r) return false;
    }
    return true;
  }
  return { free };
}
