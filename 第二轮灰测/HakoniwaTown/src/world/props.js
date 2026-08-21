/**
 * 街道家具与设施：路灯、长椅、喷泉、市集摊位、货箱、栈桥、旗帜、
 * 摩天轮、旋转木马、石桥/木桥、铁轨与高架桥、吊车、雕像、水井 …
 */
import * as THREE from 'three';
import {
  mat, glowMat, mesh, group, box, roundedBox, cyl, cone, sphere, lathe, railing,
  archWall, ribbon, RNG, TAU, clamp, lerp, mergeGeometries,
} from '../lib/utils.js';
import { clothMaterial, swayMaterial, foliageMat, addSway, addZeroSway } from '../lib/wind.js';
import { PAL, LANTERN, SIGN_GLOW, GLASS } from './buildings.js';
import { groundHeight, baseHeight } from './layout.js';

const M = () => ({
  wood: mat(PAL.wood, { rough: 0.88 }),
  woodDark: mat(PAL.woodDark, { rough: 0.88 }),
  stone: mat(PAL.stone, { rough: 0.94 }),
  stoneDark: mat(PAL.stoneDark, { rough: 0.95 }),
  metal: mat('#4a5158', { metal: 0.6, rough: 0.42 }),
  metalLight: mat('#8d949c', { metal: 0.55, rough: 0.45 }),
  iron: mat('#33383d', { metal: 0.5, rough: 0.5 }),
  gold: mat('#d8b44a', { metal: 0.85, rough: 0.3 }),
  lantern: LANTERN(),
  sign: SIGN_GLOW(),
  glass: GLASS(),
  white: mat('#f2ece0', { rough: 0.85 }),
});

/* ------------------------------------------------------------ 路灯 */
export function makeStreetLamp(kind = 'town') {
  const m = M();
  const g = group('lamp');
  if (kind === 'harbor') {
    g.add(mesh(cyl(0.2, 0.3, 0.4, 8), m.stone, {}));
    g.add(mesh(cyl(0.08, 0.11, 3.0, 8), m.iron, { y: 0.4 }));
    g.add(mesh(box(0.9, 0.09, 0.09), m.iron, { y: 3.3, x: 0.35 }));
    g.add(mesh(cone(0.28, 0.3, 8), m.iron, { y: 3.28, x: 0.72 }));
    const bulb = mesh(sphere(0.19, 10, 8), m.lantern, { x: 0.72, y: 3.06 });
    bulb.name = 'bulb'; g.add(bulb);
    g.userData.lightAt = new THREE.Vector3(0.72, 3.0, 0);
    return g;
  }
  g.add(mesh(lathe([[0.34, 0], [0.3, 0.18], [0.2, 0.3], [0.13, 0.45]], 10), m.stoneDark, {}));
  g.add(mesh(cyl(0.075, 0.1, 3.4, 10), m.iron, { y: 0.4 }));
  for (let i = 0; i < 3; i++) g.add(mesh(new THREE.TorusGeometry(0.12, 0.03, 5, 10), m.iron, { y: 1.1 + i * 0.9, rx: Math.PI / 2 }));
  g.add(mesh(box(0.34, 0.1, 0.34), m.iron, { y: 3.75 }));
  const cage = group('cage', 0, 3.85, 0);
  cage.add(mesh(lathe([[0, 0], [0.24, 0.06], [0.26, 0.5], [0.18, 0.62]], 8), m.lantern, {}));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU;
    cage.add(mesh(box(0.045, 0.62, 0.045), m.iron, { x: Math.sin(a) * 0.23, z: Math.cos(a) * 0.23 }));
  }
  cage.add(mesh(cone(0.32, 0.28, 8), m.iron, { y: 0.62 }));
  cage.add(mesh(sphere(0.06, 6, 5), m.gold, { y: 0.92 }));
  g.add(cage);
  g.userData.lightAt = new THREE.Vector3(0, 4.1, 0);
  return g;
}

/* ------------------------------------------------------------ 长椅 / 桌椅 / 花池 */
export function makeBench() {
  const m = M();
  const g = group('bench');
  for (const s of [-1, 1]) {
    g.add(mesh(box(0.12, 0.42, 0.5), m.iron, { x: s * 0.62, y: 0 }));
    g.add(mesh(box(0.1, 0.55, 0.12), m.iron, { x: s * 0.62, y: 0.42, z: -0.2, rx: -0.18 }));
  }
  for (let i = 0; i < 3; i++) g.add(mesh(box(1.5, 0.07, 0.14), m.wood, { y: 0.42, z: -0.16 + i * 0.16 }));
  for (let i = 0; i < 3; i++) g.add(mesh(box(1.5, 0.13, 0.06), m.wood, { y: 0.56 + i * 0.17, z: -0.28, rx: -0.18 }));
  return g;
}

export function makeCafeSet(rng) {
  const m = M();
  const g = group('cafe');
  g.add(mesh(cyl(0.36, 0.4, 0.06, 12), m.white, { y: 0.72 }));
  g.add(mesh(cyl(0.05, 0.06, 0.72, 8), m.metalLight, {}));
  g.add(mesh(cyl(0.24, 0.26, 0.05, 10), m.metalLight, {}));
  for (let i = 0; i < 2; i++) {
    const a = i * Math.PI + rng.range(-0.4, 0.4);
    const cg = group('chair', Math.sin(a) * 0.78, 0, Math.cos(a) * 0.78, -a);
    cg.add(mesh(cyl(0.22, 0.22, 0.05, 8), m.wood, { y: 0.42 }));
    for (let k = 0; k < 3; k++) cg.add(mesh(box(0.04, 0.42, 0.04), m.metalLight, { x: Math.sin((k / 3) * TAU) * 0.15, z: Math.cos((k / 3) * TAU) * 0.15 }));
    cg.add(mesh(box(0.36, 0.34, 0.04), m.wood, { y: 0.47, z: -0.19, rx: -0.14 }));
    g.add(cg);
  }
  // 遮阳伞
  const col = rng.pick(['#c9553f', '#4f8b5a', '#3f6f8f', '#c9a23f']);
  const cloth = clothMaterial(col, { amp: 0.06, speed: 2.2 });
  g.add(mesh(cyl(0.035, 0.04, 2.3, 8), m.wood, {}));
  const umb = new THREE.ConeGeometry(1.15, 0.42, 8);
  g.add(mesh(umb, mat(col, { rough: 0.9 }), { y: 2.1 }));
  g.add(mesh(new THREE.TorusGeometry(1.1, 0.04, 4, 8), mat('#f3e5d0', { rough: 0.9 }), { y: 2.02, rx: Math.PI / 2 }));
  g.add(mesh(sphere(0.07, 6, 5), m.gold, { y: 2.56 }));
  return g;
}

export function makePlanter(rng) {
  const g = group('planter');
  const m = M();
  g.add(mesh(roundedBox(0.9, 0.5, 0.9, 0.08), m.stone, {}));
  g.add(mesh(box(0.78, 0.08, 0.78), mat('#4f3b2a', { rough: 1 }), { y: 0.46 }));
  const leaf = foliageMat(rng.pick(['#5f9c4a', '#4f8b46', '#6faa55']), { amp: 0.05 });
  for (let i = 0; i < 5; i++) {
    const s = rng.range(0.2, 0.32);
    const geo = addSway(sphere(s, 7, 6), 0, s * 2, 1);
    g.add(mesh(geo, leaf, { x: rng.jitter(0.26), y: 0.62 + rng.range(0, 0.2), z: rng.jitter(0.26), sy: 1.2 }));
  }
  const fl = mat(rng.pick(['#e0576a', '#e8a13c', '#d97fb8', '#f0e6a0']), { rough: 0.85 });
  for (let i = 0; i < 6; i++) g.add(mesh(sphere(0.075, 6, 5), fl, { x: rng.jitter(0.34), y: 0.7 + rng.range(0, 0.3), z: rng.jitter(0.34) }));
  return g;
}

/* ------------------------------------------------------------ 喷泉（含水柱锚点） */
export function makeFountain() {
  const m = M();
  const g = group('fountain');
  const water = mat('#7fd0d8', { rough: 0.1, metal: 0.15, opacity: 0.8 });
  g.add(mesh(new THREE.CylinderGeometry(3.0, 3.2, 0.5, 24), m.stone, { y: 0 }));
  g.add(mesh(new THREE.CylinderGeometry(2.72, 2.8, 0.62, 24), mat('#b7ac95', { rough: 0.9 }), { y: 0.5 }));
  g.add(mesh(new THREE.CylinderGeometry(2.5, 2.5, 0.1, 24), water, { y: 0.92 }));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    g.add(mesh(box(0.36, 0.34, 0.36), m.stone, { x: Math.sin(a) * 2.86, y: 1.02, z: Math.cos(a) * 2.86, ry: -a }));
  }
  g.add(mesh(cyl(0.5, 0.7, 1.5, 12), m.stone, { y: 0.9 }));
  g.add(mesh(new THREE.CylinderGeometry(1.35, 1.15, 0.22, 18), m.stone, { y: 2.4 }));
  g.add(mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.06, 18), water, { y: 2.62 }));
  g.add(mesh(cyl(0.24, 0.34, 1.2, 10), m.stone, { y: 2.6 }));
  // 顶端小雕像（举瓶少女的抽象体块）
  const st = group('statue', 0, 3.8, 0);
  st.add(mesh(lathe([[0.34, 0], [0.3, 0.2], [0.2, 0.7], [0.26, 1.0], [0.16, 1.2]], 12), m.white, {}));
  st.add(mesh(sphere(0.17, 10, 8), m.white, { y: 1.34 }));
  st.add(mesh(box(0.1, 0.6, 0.1), m.white, { y: 1.0, x: 0.2, rz: -0.9 }));
  st.add(mesh(lathe([[0.16, 0], [0.2, 0.14], [0.1, 0.3], [0.13, 0.34]], 10), m.white, { y: 1.35, x: 0.5, rz: -0.5 }));
  g.add(st);
  g.userData.jets = [
    { x: 0.52, y: 5.2, z: 0, dir: [0.5, 1, 0] },
  ];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    g.userData.jets.push({ x: Math.sin(a) * 1.0, y: 2.7, z: Math.cos(a) * 1.0, dir: [Math.sin(a) * 0.5, 1, Math.cos(a) * 0.5] });
  }
  return g;
}

/* ------------------------------------------------------------ 市集摊位 */
export function makeStall(rng) {
  const m = M();
  const g = group('stall');
  const [c1, c2] = rng.pick(PAL.awning);
  const W = rng.range(2.4, 3.2), D = 1.9;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    g.add(mesh(box(0.1, 2.3, 0.1), m.woodDark, { x: sx * (W / 2 - 0.1), z: sz * (D / 2 - 0.1) }));
  }
  g.add(mesh(box(W, 0.1, D), m.wood, { y: 0.9 }));
  g.add(mesh(box(W, 0.5, 0.08), m.wood, { y: 0.4, z: -D / 2 + 0.06 }));
  // 条纹顶棚
  const stripes = 8, sw = (W + 0.5) / stripes;
  for (let i = 0; i < stripes; i++) {
    for (const s of [-1, 1]) {
      g.add(mesh(box(sw * 0.98, 0.07, D * 0.78), mat(i % 2 ? c1 : c2, { rough: 0.88 }), {
        x: -(W + 0.5) / 2 + sw * (i + 0.5), y: 2.42 + 0.13, z: s * D * 0.31, rx: -s * 0.34,
      }));
    }
  }
  g.add(mesh(box(W + 0.55, 0.1, 0.12), m.woodDark, { y: 2.36 }));
  // 商品
  const goods = ['#c9553f', '#e0a13c', '#5f9c4a', '#d97fb8', '#f0e6a0', '#8a5a3c'];
  for (let i = 0; i < 10; i++) {
    const gm = mat(rng.pick(goods), { rough: 0.85 });
    if (rng.chance(0.5)) g.add(mesh(sphere(rng.range(0.09, 0.15), 7, 6), gm, { x: rng.jitter(W / 2 - 0.3), y: 1.02, z: rng.jitter(D / 2 - 0.4) }));
    else g.add(mesh(roundedBox(0.26, 0.2, 0.2, 0.04), gm, { x: rng.jitter(W / 2 - 0.3), y: 0.95, z: rng.jitter(D / 2 - 0.4), ry: rng.range(0, 1) }));
  }
  // 挂物
  for (let i = 0; i < 4; i++) g.add(mesh(sphere(0.1, 6, 5), mat(rng.pick(goods), { rough: 0.9 }), { x: -W / 2 + 0.4 + i * 0.6, y: 2.05, z: -D / 2 + 0.14, sy: 1.5 }));
  if (rng.chance(0.6)) g.add(mesh(box(0.6, 0.34, 0.05), m.sign, { y: 1.9, z: D / 2 + 0.02, rx: 0.2 }));
  return g;
}

/* ------------------------------------------------------------ 货箱 / 木桶 / 麻袋 */
export function makeCrate(rng, s = 1) {
  const m = M();
  const g = group('crate');
  const c = rng.pick(['#a97f4f', '#96703f', '#b08a55']);
  g.add(mesh(roundedBox(0.8 * s, 0.72 * s, 0.8 * s, 0.04), mat(c, { rough: 0.92 }), {}));
  for (const s2 of [-1, 1]) {
    g.add(mesh(box(0.84 * s, 0.1 * s, 0.05), m.woodDark, { y: 0.16 * s, z: s2 * 0.41 * s }));
    g.add(mesh(box(0.84 * s, 0.1 * s, 0.05), m.woodDark, { y: 0.56 * s, z: s2 * 0.41 * s }));
    g.add(mesh(box(0.05, 0.1 * s, 0.84 * s), m.woodDark, { y: 0.16 * s, x: s2 * 0.41 * s }));
    g.add(mesh(box(0.05, 0.1 * s, 0.84 * s), m.woodDark, { y: 0.56 * s, x: s2 * 0.41 * s }));
  }
  return g;
}

export function makeBarrel(rng) {
  const m = M();
  const g = group('barrel');
  g.add(mesh(lathe([[0.26, 0], [0.32, 0.16], [0.34, 0.42], [0.32, 0.68], [0.26, 0.84]], 12), mat(rng.pick(['#8a5f3c', '#6f4a30', '#96703f']), { rough: 0.9 }), {}));
  for (const y of [0.14, 0.42, 0.7]) g.add(mesh(new THREE.TorusGeometry(0.335, 0.028, 4, 12), m.iron, { y, rx: Math.PI / 2 }));
  return g;
}

export function makeSacks(rng) {
  const g = group('sacks');
  const c = mat('#c9b98c', { rough: 1 });
  for (let i = 0; i < 3; i++) {
    g.add(mesh(lathe([[0.02, 0], [0.26, 0.1], [0.28, 0.34], [0.14, 0.52], [0.06, 0.56]], 9), c, {
      x: (i - 1) * 0.36 + rng.jitter(0.06), z: rng.jitter(0.12), ry: rng.range(0, TAU), sy: rng.range(0.85, 1.1),
    }));
  }
  return g;
}

/* ------------------------------------------------------------ 围栏 / 晾衣绳 / 彩旗 */
export function makeFence(points, o = {}) {
  const m = M();
  const g = group('fence');
  const railMat = o.stone ? m.stone : m.wood;
  const postMat = o.stone ? m.stoneDark : m.woodDark;
  for (let i = 0; i < points.length - 1; i++) {
    const [ax, az] = points[i], [bx, bz] = points[i + 1];
    const len = Math.hypot(bx - ax, bz - az);
    const steps = Math.max(1, Math.round(len / 1.5));
    for (let k = 0; k <= steps; k++) {
      const t = k / steps;
      const x = ax + (bx - ax) * t, z = az + (bz - az) * t;
      const y = groundHeight(x, z);
      g.add(mesh(box(0.13, o.h ?? 1.0, 0.13), postMat, { x, y: y - 0.1, z }));
    }
    for (let k = 0; k < steps; k++) {
      const t0 = k / steps, t1 = (k + 1) / steps;
      const x0 = ax + (bx - ax) * t0, z0 = az + (bz - az) * t0;
      const x1 = ax + (bx - ax) * t1, z1 = az + (bz - az) * t1;
      const y0 = groundHeight(x0, z0), y1 = groundHeight(x1, z1);
      const segLen = Math.hypot(x1 - x0, z1 - z0, y1 - y0);
      const ry = Math.atan2(x1 - x0, z1 - z0);
      const rx = -Math.atan2(y1 - y0, Math.hypot(x1 - x0, z1 - z0));
      for (const hh of o.rails ?? [0.45, 0.85]) {
        g.add(mesh(box(0.07, 0.11, segLen), railMat, {
          x: (x0 + x1) / 2, y: (y0 + y1) / 2 + hh - 0.1, z: (z0 + z1) / 2, ry, rx,
        }));
      }
    }
  }
  return g;
}

export function makeClothesline(x1, y1, z1, x2, y2, z2, rng) {
  const g = group('clothesline');
  const m = M();
  const len = Math.hypot(x2 - x1, z2 - z1);
  const mx = (x1 + x2) / 2, mz = (z1 + z2) / 2, my = (y1 + y2) / 2;
  const ry = Math.atan2(x2 - x1, z2 - z1);
  g.add(mesh(box(0.035, 0.035, len), m.woodDark, { x: mx, y: my - 0.06, z: mz, ry }));
  const cols = ['#f2ece0', '#dfe4d7', '#e8c9a3', '#a8c4d8', '#d9a3a3', '#f0e0b0'];
  const n = Math.max(3, Math.floor(len / 0.85));
  for (let i = 0; i < n; i++) {
    const t = (i + 0.6) / (n + 0.2);
    const x = x1 + (x2 - x1) * t, z = z1 + (z2 - z1) * t, y = y1 + (y2 - y1) * t;
    const w = rng.range(0.5, 0.8), h = rng.range(0.6, 1.0);
    const geo = new THREE.PlaneGeometry(w, h, 5, 3);
    geo.translate(w / 2, -h / 2, 0);
    const cl = mesh(geo, clothMaterial(rng.pick(cols), { amp: 0.22, speed: 3.2, rough: 0.95 }), {
      x, y: y - 0.08, z, ry: ry + Math.PI / 2, cast: true,
    });
    g.add(cl);
  }
  return g;
}

/** 三角彩旗串（按颜色合并，控制 draw call） */
export function makeBunting(pts, rng) {
  const g = group('bunting');
  const cols = ['#e05a4a', '#e8b23c', '#4f9b5a', '#4a7fae', '#e0e0d0'];
  const buckets = new Map();
  const mtx = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const eul = new THREE.Euler();
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const len = Math.hypot(b[0] - a[0], b[2] - a[2]);
    const n = Math.max(4, Math.round(len / 0.7));
    const ry = Math.atan2(b[0] - a[0], b[2] - a[2]) + Math.PI / 2;
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n;
      const sag = Math.sin(t * Math.PI) * 0.55;
      const x = a[0] + (b[0] - a[0]) * t, z = a[2] + (b[2] - a[2]) * t;
      const y = a[1] + (b[1] - a[1]) * t - sag;
      const tri = new THREE.BufferGeometry();
      tri.setAttribute('position', new THREE.Float32BufferAttribute([-0.16, 0, 0, 0.16, 0, 0, 0, -0.34, 0], 3));
      tri.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 1, 0.5, 0], 2));
      tri.computeVertexNormals();
      eul.set(0, ry, 0);
      q.setFromEuler(eul);
      mtx.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(1, 1, 1));
      tri.applyMatrix4(mtx);
      const key = cols[k % cols.length];
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(tri);
    }
  }
  for (const [color, list] of buckets) {
    const merged = list.length === 1 ? list[0] : mergeGeometries(list, false);
    if (!merged) continue;
    const m = new THREE.Mesh(merged, clothMaterial(color, { amp: 0.12, speed: 3.6 }));
    m.castShadow = false; m.receiveShadow = false;
    g.add(m);
  }
  return g;
}

/** 旗杆（旗面随风飘） */
export function makeFlagPole(h = 5, color = '#d8443a') {
  const m = M();
  const g = group('flagpole');
  g.add(mesh(lathe([[0.28, 0], [0.24, 0.2], [0.12, 0.32]], 10), m.stone, {}));
  g.add(mesh(cyl(0.055, 0.075, h, 8), m.metalLight, { y: 0.3 }));
  g.add(mesh(sphere(0.11, 8, 6), m.gold, { y: h + 0.3 }));
  const fw = 1.5, fh = 0.95;
  const geo = new THREE.PlaneGeometry(fw, fh, 8, 4);
  geo.translate(fw / 2, 0, 0);
  const flag = mesh(geo, clothMaterial(color, { amp: 0.32, speed: 4.2 }), { x: 0.07, y: h - 0.4, z: 0, cast: false });
  flag.name = 'flag';
  g.add(flag);
  return g;
}

/* ------------------------------------------------------------ 码头 / 栈桥 / 浮标 */
export function makePier(len = 8, w = 2.6, dirZ = 1, ox = 0, oz = 0) {
  const m = M();
  const g = group('pier');
  const posts = Math.max(2, Math.round(len / 1.8));
  for (let i = 0; i <= posts; i++) {
    const z = dirZ * (i / posts) * len;
    for (const s of [-1, 1]) {
      const x = s * (w / 2 - 0.15);
      const gy = groundHeight(ox + x, oz + z);
      const hgt = Math.max(0.8, 0.55 - gy);
      g.add(mesh(cyl(0.13, 0.15, hgt + 0.2, 8), m.woodDark, { x, y: gy, z }));
      if (i < posts) g.add(mesh(box(0.1, 0.14, len / posts), m.woodDark, { x, y: 0.42, z: z + dirZ * len / posts / 2 }));
    }
    g.add(mesh(box(w, 0.12, 0.2), m.woodDark, { y: 0.5, z }));
  }
  const planks = Math.round(len / 0.42);
  for (let i = 0; i < planks; i++) {
    g.add(mesh(box(w, 0.1, 0.36), i % 3 ? m.wood : mat('#8f6740', { rough: 0.9 }), { y: 0.6, z: dirZ * (i + 0.5) * (len / planks) }));
  }
  return g;
}

export function makeBuoy(rng) {
  const g = group('buoy');
  const c = rng.chance(0.5) ? '#d84a3a' : '#e8b23c';
  g.add(mesh(lathe([[0, 0], [0.3, 0.16], [0.32, 0.4], [0.2, 0.62], [0.08, 0.7]], 10), mat(c, { rough: 0.7 }), { y: -0.2 }));
  g.add(mesh(cyl(0.03, 0.03, 0.5, 6), mat('#3a3f44', { metal: 0.5, rough: 0.5 }), { y: 0.5 }));
  g.add(mesh(sphere(0.1, 8, 6), glowMat('#f6e6c0', '#ff9a5c', 2.6, { rough: 0.4 }), { y: 1.0 }));
  return g;
}

export function makeCrane() {
  const m = M();
  const g = group('crane');
  g.add(mesh(box(2.4, 0.4, 2.4), m.stoneDark, {}));
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    g.add(mesh(box(0.18, 4.6, 0.18), m.woodDark, { x: sx * 0.85, z: sz * 0.85, rx: -sz * 0.06, rz: sx * 0.06 }));
  }
  for (let i = 1; i <= 3; i++) {
    for (const s of [-1, 1]) {
      g.add(mesh(box(1.8, 0.1, 0.1), m.woodDark, { y: i * 1.1, z: s * 0.8 }));
      g.add(mesh(box(0.1, 0.1, 1.8), m.woodDark, { y: i * 1.1, x: s * 0.8 }));
    }
  }
  g.add(mesh(box(2.0, 0.24, 2.0), m.wood, { y: 4.6 }));
  const jib = group('jib', 0, 4.84, 0);
  jib.rotation.y = -0.5;
  jib.add(mesh(box(0.22, 0.22, 5.4), m.woodDark, { z: 2.0, rx: -0.16 }));
  jib.add(mesh(box(0.18, 1.4, 0.18), m.woodDark, { y: 0.6, z: -0.4 }));
  jib.add(mesh(box(0.14, 0.14, 2.6), m.woodDark, { y: 1.1, z: 1.0, rx: 0.42 }));
  jib.add(mesh(cyl(0.02, 0.02, 2.6, 5), m.iron, { y: -1.3, z: 4.3 }));
  jib.add(mesh(box(0.34, 0.5, 0.34), m.iron, { y: -2.7, z: 4.3 }));
  g.add(jib);
  return g;
}

/* ------------------------------------------------------------ 桥梁 */
export function makeStoneBridge(len = 7, w = 4.6) {
  const m = M();
  const g = group('stoneBridge');
  const seg = 14;
  // 拱券（拱背藏在桥面之下）
  g.add(mesh(archWall(len, 2.5, w * 0.92, len * 0.6, 1.95), m.stone, { y: -2.5 }));
  for (const s of [-1, 1]) {
    g.add(mesh(box(0.5, 2.4, w * 0.96), m.stoneDark, { x: s * (len / 2 - 0.2), y: -2.4 }));
  }
  // 拱背路面（微拱）
  for (let i = 0; i < seg; i++) {
    const t = (i + 0.5) / seg;
    const x = -len / 2 + len * t;
    const camber = Math.sin(t * Math.PI) * 0.32;
    g.add(mesh(box(len / seg + 0.02, 0.3, w), i % 2 ? m.stone : m.stoneDark, { x, y: camber }));
  }
  // 栏板
  for (const s of [-1, 1]) {
    for (let i = 0; i < seg; i++) {
      const t = (i + 0.5) / seg;
      const x = -len / 2 + len * t;
      const camber = Math.sin(t * Math.PI) * 0.32;
      g.add(mesh(box(len / seg + 0.02, 0.62, 0.28), m.stone, { x, y: camber + 0.3, z: s * (w / 2 - 0.14) }));
      g.add(mesh(box(len / seg + 0.02, 0.14, 0.42), mat('#c2b7a0', { rough: 0.86 }), { x, y: camber + 0.92, z: s * (w / 2 - 0.14) }));
    }
    for (const e of [-1, 1]) g.add(mesh(box(0.5, 1.4, 0.5), m.stone, { x: e * (len / 2 - 0.1), y: 0, z: s * (w / 2 - 0.1) }));
  }
  return g;
}

export function makeWoodBridge(len = 6.6, w = 4.2) {
  const m = M();
  const g = group('woodBridge');
  const seg = 16;
  for (let i = 0; i < seg; i++) {
    const t = (i + 0.5) / seg;
    const x = -len / 2 + len * t;
    g.add(mesh(box(len / seg * 0.9, 0.12, w), i % 2 ? m.wood : mat('#8f6740', { rough: 0.9 }), { x, y: 0.1 }));
  }
  for (const s of [-1, 1]) {
    g.add(mesh(box(len, 0.16, 0.2), m.woodDark, { y: 0, z: s * (w / 2 - 0.1) }));
    for (let i = 0; i <= 5; i++) {
      const x = -len / 2 + (len * i) / 5;
      g.add(mesh(box(0.12, 1.0, 0.12), m.woodDark, { x, y: 0.16, z: s * (w / 2 - 0.1) }));
    }
    g.add(mesh(box(len, 0.11, 0.11), m.wood, { y: 1.14, z: s * (w / 2 - 0.1) }));
    g.add(mesh(box(len, 0.09, 0.09), m.wood, { y: 0.72, z: s * (w / 2 - 0.1) }));
  }
  for (const e of [-1, 1]) {
    for (const s of [-1, 1]) {
      g.add(mesh(cyl(0.14, 0.16, 2.6, 8), m.woodDark, { x: e * (len / 2 - 0.5), y: -2.4, z: s * (w / 2 - 0.3) }));
    }
    g.add(mesh(box(0.2, 0.2, w), m.woodDark, { x: e * (len / 2 - 0.5), y: -0.1 }));
  }
  return g;
}

/* ------------------------------------------------------------ 铁道 */
/** 沿曲线的竖向墙带（高架桥腹板 / 挡墙） */
export function wallRibbon(curve, top, bottom, offset, segments = 260) {
  const pos = [], idx = [], uv = [];
  const p = new THREE.Vector3(), t = new THREE.Vector3();
  for (let i = 0; i <= segments; i++) {
    const u = Math.min(0.999999, i / segments);
    curve.getPointAt(u, p);
    curve.getTangentAt(u, t);
    const nx = t.z, nz = -t.x;
    const nl = Math.hypot(nx, nz) || 1;
    const x = p.x + (nx / nl) * offset, z = p.z + (nz / nl) * offset;
    pos.push(x, p.y + top, z, x, p.y + bottom, z);
    uv.push(u * 20, 1, u * 20, 0);
  }
  for (let i = 0; i < segments; i++) {
    const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function buildRailway(railCurve) {
  const m = M();
  const g = group('railway');
  const ballast = mat('#6f6a63', { rough: 1 });
  const sleeper = mat('#5a4636', { rough: 0.95 });
  const rail = mat('#8a8f94', { metal: 0.8, rough: 0.35 });
  const deck = mat('#9c9282', { rough: 0.94 });
  const deckDark = mat('#84796a', { rough: 0.95 });

  // 桥面板 + 腹墙
  const deckGeo = ribbon(railCurve, 4.3, { segments: 420, useCurveY: true, yOffset: -0.42 });
  g.add(mesh(deckGeo, deck, { cast: true, receive: true }));
  for (const s of [-1, 1]) {
    g.add(mesh(wallRibbon(railCurve, -0.28, -1.25, s * 2.15, 420), deckDark, {}));
    g.add(mesh(ribbon(railCurve, 0.34, { segments: 420, useCurveY: true, yOffset: -0.2, offset: s * 2.16 }), mat('#b3a894', { rough: 0.9 }), {}));
  }
  // 道砟 + 枕木 + 钢轨
  g.add(mesh(ribbon(railCurve, 3.3, { segments: 420, useCurveY: true, yOffset: -0.34 }), ballast, {}));
  const len = railCurve.getLength();
  const ties = Math.floor(len / 0.72);
  const tieGeos = [];
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < ties; i++) {
    const u = i / ties;
    const p = railCurve.getPointAt(u);
    const t = railCurve.getTangentAt(u);
    const geo = box(0.28, 0.14, 2.5);
    geo.translate(0, -0.14, 0);
    const mtx = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.atan2(t.x, t.z) + Math.PI / 2, 0));
    mtx.compose(new THREE.Vector3(p.x, p.y - 0.16, p.z), q, new THREE.Vector3(1, 1, 1));
    geo.applyMatrix4(mtx);
    tieGeos.push(geo.toNonIndexed());
  }
  g.add(mesh(mergeGeometries(tieGeos, false), sleeper, {}));
  for (const s of [-1, 1]) {
    g.add(mesh(ribbon(railCurve, 0.16, { segments: 640, useCurveY: true, yOffset: -0.02, offset: s * 0.72 }), rail, {}));
    g.add(mesh(wallRibbon(railCurve, -0.02, -0.16, s * 0.8, 640), rail, {}));
  }
  // 桥墩
  const piers = [];
  const step = 2.9;
  const count = Math.floor(len / step);
  for (let i = 0; i < count; i++) {
    const u = i / count;
    const p = railCurve.getPointAt(u);
    const gh = groundHeight(p.x, p.z);
    const h = p.y - 1.3 - gh;
    if (h < 0.5) continue;
    const t = railCurve.getTangentAt(u);
    piers.push({ x: p.x, y: gh, z: p.z, h, ry: Math.atan2(t.x, t.z) });
  }
  return { group: g, piers };
}

/* ------------------------------------------------------------ 摩天轮 / 旋转木马 */
export function makeFerrisWheel() {
  const m = M();
  const g = group('ferris');
  const R = 6.4;
  const frame = mat('#d8d2c4', { rough: 0.6, metal: 0.25 });
  const accent = mat('#c9553f', { rough: 0.7 });
  g.add(mesh(roundedBox(7.0, 0.5, 5.0, 0.1), m.stoneDark, { y: -0.2 }));
  for (const s of [-1, 1]) {
    for (const s2 of [-1, 1]) {
      g.add(mesh(box(0.28, 8.4, 0.28), frame, { x: s2 * 2.4, z: s * 1.5, rz: -s2 * 0.27, rx: -s * 0.05 }));
    }
    g.add(mesh(box(4.4, 0.16, 0.16), frame, { y: 3.4, z: s * 1.4 }));
    g.add(mesh(box(4.9, 0.16, 0.16), frame, { y: 1.6, z: s * 1.45 }));
  }
  g.add(mesh(cyl(0.22, 0.22, 3.4, 10), frame, { y: 8.1, rx: Math.PI / 2, z: 0 }));
  // 轮体（keep）
  const rotor = group('ferrisRotor', 0, 8.1, 0);
  rotor.userData.keep = true;
  rotor.userData.spin = 0.16;
  rotor.add(mesh(cyl(0.5, 0.5, 2.0, 12), accent, { rx: Math.PI / 2, z: -1.0 }));
  const cabinCol = ['#e05a4a', '#e8b23c', '#4f9b5a', '#4a7fae', '#e0e0d0', '#d97fb8'];
  const cabins = [];
  const bulb = glowMat('#fff0c8', '#ffd48a', 3.4, { rough: 0.4 });
  for (const s of [-1, 1]) {
    rotor.add(mesh(new THREE.TorusGeometry(R, 0.11, 6, 40), frame, { z: s * 0.95 }));
    rotor.add(mesh(new THREE.TorusGeometry(R * 0.55, 0.08, 5, 30), frame, { z: s * 0.95 }));
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      rotor.add(mesh(new THREE.BoxGeometry(0.08, R * 2, 0.08), frame, { rz: a, z: s * 0.95 }));
    }
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * TAU;
      rotor.add(mesh(sphere(0.11, 6, 5), bulb, { x: Math.cos(a) * R, y: Math.sin(a) * R, z: s * 1.05 }));
    }
  }
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU;
    const arm = group('arm');
    arm.position.set(Math.cos(a) * R, Math.sin(a) * R, 0);
    const cab = group('cabin');
    cab.userData.upright = true;
    cab.add(mesh(box(0.1, 0.5, 0.1), frame, { y: -0.25 }));
    cab.add(mesh(roundedBox(1.15, 0.95, 1.5, 0.22), mat(cabinCol[i % cabinCol.length], { rough: 0.72 }), { y: -1.25 }));
    cab.add(mesh(roundedBox(1.0, 0.42, 1.34, 0.16), mat('#3f4a52', { rough: 0.5, metal: 0.2 }), { y: -0.9 }));
    cab.add(mesh(cone(0.85, 0.42, 8), mat('#f2ece0', { rough: 0.8 }), { y: -0.32 }));
    arm.add(cab);
    cab.userData.baseAngle = a;
    cabins.push(cab);
    rotor.add(arm);
  }
  rotor.userData.cabins = cabins;
  g.add(rotor);
  // 售票亭
  const booth = group('booth', 4.6, 0, 2.6, -0.4);
  booth.add(mesh(roundedBox(1.6, 2.0, 1.4, 0.1), mat('#f0e6d2', { rough: 0.9 }), {}));
  booth.add(mesh(cone(1.5, 0.9, 8), accent, { y: 2.0 }));
  booth.add(mesh(box(0.9, 0.7, 0.1), m.glass, { y: 0.9, z: 0.72 }));
  booth.add(mesh(box(1.1, 0.12, 0.34), m.wood, { y: 0.8, z: 0.85 }));
  g.add(booth);
  return { group: g, rotors: [rotor], height: 15 };
}

export function makeCarousel() {
  const m = M();
  const g = group('carousel');
  const base = mat('#e8dcc4', { rough: 0.9 });
  const accent = mat('#c9553f', { rough: 0.75 });
  const gold = m.gold;
  g.add(mesh(new THREE.CylinderGeometry(4.0, 4.3, 0.5, 24), m.stoneDark, { y: -0.2 }));
  g.add(mesh(new THREE.CylinderGeometry(3.8, 3.8, 0.24, 24), base, { y: 0.3 }));
  const rotor = group('carRotor', 0, 0.54, 0);
  rotor.userData.keep = true;
  rotor.userData.spin = 0.42;
  rotor.add(mesh(cyl(0.34, 0.4, 3.6, 12), gold, {}));
  rotor.add(mesh(new THREE.CylinderGeometry(3.5, 3.5, 0.18, 24), base, { y: 3.2 }));
  // 条纹顶棚
  for (let i = 0; i < 16; i++) {
    const a0 = (i / 16) * TAU;
    const geo = new THREE.CylinderGeometry(0.1, 3.6, 1.5, 3, 1, true, a0, TAU / 16);
    rotor.add(mesh(geo, i % 2 ? accent : mat('#f6ecd8', { rough: 0.85 }), { y: 4.1 }));
  }
  rotor.add(mesh(cone(0.7, 1.1, 10), gold, { y: 4.85 }));
  rotor.add(mesh(sphere(0.2, 10, 8), gold, { y: 6.0 }));
  const bulb = glowMat('#fff0c8', '#ffcf7a', 3.2, { rough: 0.4 });
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU;
    rotor.add(mesh(sphere(0.1, 6, 5), bulb, { x: Math.sin(a) * 3.5, y: 3.16, z: Math.cos(a) * 3.5 }));
  }
  // 木马
  const horseCol = ['#f2ece0', '#e8c9a3', '#d8a3a3', '#c9b98c'];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    const hx = Math.sin(a) * 2.6, hz = Math.cos(a) * 2.6;
    rotor.add(mesh(cyl(0.05, 0.05, 3.2, 6), gold, { x: hx, y: 0.2, z: hz }));
    const h = group('horse', hx, 1.5 + (i % 2) * 0.3, hz, -a);
    h.userData.bob = i * 0.9;
    const c = mat(horseCol[i % horseCol.length], { rough: 0.8 });
    h.add(mesh(roundedBox(1.1, 0.6, 0.42, 0.16), c, {}));
    h.add(mesh(roundedBox(0.32, 0.62, 0.3, 0.12), c, { x: 0.5, y: 0.42, rz: -0.5 }));
    h.add(mesh(box(0.24, 0.3, 0.24), c, { x: 0.78, y: 0.82, rz: -0.9 }));
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      h.add(mesh(box(0.11, 0.62, 0.11), c, { x: sx * 0.36, y: -0.5, z: sz * 0.13, rz: sx * 0.24 }));
    }
    h.add(mesh(box(0.42, 0.22, 0.46), accent, { y: 0.34 }));
    h.add(mesh(box(0.1, 0.5, 0.1), mat('#8a6a4a', { rough: 0.9 }), { x: -0.55, y: 0.3, rz: 0.6 }));
    rotor.add(h);
  }
  g.add(rotor);
  return { group: g, rotors: [rotor], height: 7 };
}

/* ------------------------------------------------------------ 杂项 */
export function makeWell() {
  const m = M();
  const g = group('well');
  g.add(mesh(new THREE.CylinderGeometry(1.05, 1.15, 0.9, 16), m.stone, {}));
  g.add(mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.1, 16), mat('#2f4a52', { rough: 0.2, metal: 0.2 }), { y: 0.62 }));
  g.add(mesh(new THREE.TorusGeometry(1.05, 0.1, 5, 18), mat('#b7ac95', { rough: 0.88 }), { y: 0.9, rx: Math.PI / 2 }));
  for (const s of [-1, 1]) g.add(mesh(box(0.16, 1.9, 0.16), m.woodDark, { x: s * 0.9, y: 0.9 }));
  g.add(mesh(box(2.3, 0.14, 1.3), mat('#8a4a38', { rough: 0.85 }), { y: 2.8, rx: 0 }));
  g.add(mesh(gableRoofSmall(2.3, 1.5, 0.6), mat('#8a4a38', { rough: 0.85 }), { y: 2.7 }));
  g.add(mesh(cyl(0.1, 0.1, 1.7, 8), m.wood, { y: 2.4, rz: Math.PI / 2 }));
  g.add(mesh(cyl(0.03, 0.03, 0.9, 5), m.iron, { y: 1.95 }));
  g.add(mesh(cyl(0.2, 0.17, 0.3, 10), m.woodDark, { y: 1.4 }));
  return g;
}
function gableRoofSmall(w, d, h) {
  const s = new THREE.Shape();
  s.moveTo(-d / 2, 0); s.lineTo(d / 2, 0); s.lineTo(0, h); s.lineTo(-d / 2, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: w, bevelEnabled: false, curveSegments: 1 });
  g.rotateY(Math.PI / 2); g.translate(-w / 2, 0, 0);
  g.computeVertexNormals();
  return g;
}

export function makeStatue() {
  const m = M();
  const g = group('statue');
  const stone = mat('#c2b8a4', { rough: 0.9 });
  g.add(mesh(roundedBox(1.9, 0.4, 1.9, 0.06), m.stoneDark, {}));
  g.add(mesh(roundedBox(1.5, 1.5, 1.5, 0.08), stone, { y: 0.4 }));
  g.add(mesh(box(1.7, 0.16, 1.7), mat('#b3a891', { rough: 0.9 }), { y: 1.9 }));
  const f = group('figure', 0, 2.06, 0);
  f.add(mesh(lathe([[0.42, 0], [0.36, 0.4], [0.3, 1.2], [0.36, 1.5], [0.2, 1.7]], 12), stone, {}));
  f.add(mesh(sphere(0.24, 10, 8), stone, { y: 1.86 }));
  f.add(mesh(box(0.14, 0.9, 0.14), stone, { y: 1.2, x: 0.34, rz: -1.1 }));
  f.add(mesh(box(0.14, 0.8, 0.14), stone, { y: 1.1, x: -0.3, rz: 0.4 }));
  f.add(mesh(box(0.1, 1.5, 0.1), mat('#8a8272', { rough: 0.8 }), { y: 1.0, x: 0.72, rz: -0.1 }));
  g.add(f);
  return g;
}

export function makeTelescope() {
  const m = M();
  const g = group('telescope');
  g.add(mesh(new THREE.CylinderGeometry(0.5, 0.62, 0.3, 12), m.stoneDark, {}));
  g.add(mesh(cyl(0.09, 0.11, 1.1, 8), m.metal, { y: 0.3 }));
  const tube = group('tube', 0, 1.4, 0);
  tube.userData.keep = true;
  tube.userData.scan = true;
  tube.add(mesh(cyl(0.16, 0.2, 1.7, 12), m.metalLight, { rz: Math.PI / 2.6, y: 0 }));
  tube.add(mesh(cyl(0.1, 0.1, 0.3, 8), m.iron, { rz: Math.PI / 2.6, x: 0.72, y: 0.5 }));
  g.add(tube);
  return g;
}

export function makeSwing() {
  const m = M();
  const g = group('swing');
  for (const s of [-1, 1]) {
    g.add(mesh(box(0.14, 2.4, 0.14), m.woodDark, { x: s * 1.1, rz: s * 0.16 }));
  }
  g.add(mesh(box(2.6, 0.14, 0.14), m.woodDark, { y: 2.35 }));
  const sw = group('seat', 0, 2.3, 0);
  sw.userData.keep = true;
  sw.userData.swing = true;
  for (const s of [-1, 1]) sw.add(mesh(box(0.04, 1.5, 0.04), m.iron, { x: s * 0.28, y: -1.5 }));
  sw.add(mesh(box(0.7, 0.08, 0.3), m.wood, { y: -1.5 }));
  g.add(sw);
  return g;
}

export function makeSignpost(rng) {
  const m = M();
  const g = group('signpost');
  g.add(mesh(cyl(0.08, 0.1, 2.2, 8), m.woodDark, {}));
  const cols = ['#f2ece0', '#e8d9bd'];
  for (let i = 0; i < 2; i++) {
    const dir = rng.chance(0.5) ? 1 : -1;
    g.add(mesh(box(1.2, 0.28, 0.07), mat(cols[i % 2], { rough: 0.9 }), { x: dir * 0.55, y: 1.5 + i * 0.42, ry: rng.range(-0.5, 0.5) }));
  }
  return g;
}

export function makeHaystack(rng) {
  const g = group('haystack');
  const hay = foliageMat('#d9b45c', { amp: 0.03, rough: 1 });
  const geo = addSway(lathe([[1.3, 0], [1.35, 0.3], [1.1, 1.1], [0.6, 1.7], [0, 2.0]], 12), 0, 2.0, 0.5);
  g.add(mesh(geo, hay, { ry: rng.range(0, TAU) }));
  g.add(mesh(cyl(0.05, 0.05, 2.6, 5), mat(PAL.woodDark, { rough: 0.9 }), { y: 0 }));
  return g;
}

export function makeScarecrow() {
  const m = M();
  const g = group('scarecrow');
  g.add(mesh(box(0.12, 2.2, 0.12), m.woodDark, {}));
  g.add(mesh(box(1.5, 0.1, 0.1), m.woodDark, { y: 1.55 }));
  g.add(mesh(roundedBox(0.55, 0.8, 0.4, 0.14), mat('#a8503c', { rough: 0.9 }), { y: 1.05 }));
  g.add(mesh(sphere(0.26, 10, 8), mat('#d9b45c', { rough: 1 }), { y: 1.95 }));
  g.add(mesh(cone(0.44, 0.4, 10), mat('#8a6a4a', { rough: 0.95 }), { y: 2.14 }));
  g.add(mesh(new THREE.TorusGeometry(0.34, 0.05, 5, 12), mat('#8a6a4a', { rough: 0.95 }), { y: 2.14, rx: Math.PI / 2 }));
  for (const s of [-1, 1]) g.add(mesh(box(0.14, 0.3, 0.14), mat('#d9b45c', { rough: 1 }), { x: s * 0.72, y: 1.4 }));
  return g;
}

export function makeTractor() {
  const m = M();
  const g = group('tractor');
  const body = mat('#3f7f5a', { rough: 0.6, metal: 0.2 });
  const dark = mat('#2f3a42', { rough: 0.7 });
  g.add(mesh(roundedBox(2.4, 0.8, 1.2, 0.14), body, { y: 0.55 }));
  g.add(mesh(roundedBox(1.0, 0.7, 1.0, 0.12), body, { x: -0.5, y: 1.3 }));
  g.add(mesh(box(0.9, 0.5, 0.9), dark, { x: -0.5, y: 1.5 }));
  g.add(mesh(cyl(0.09, 0.11, 0.5, 8), dark, { x: 0.95, y: 1.3 }));
  for (const s of [-1, 1]) {
    g.add(mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.34, 14), dark, { x: -0.7, y: 0.62, z: s * 0.72, rx: Math.PI / 2 }));
    g.add(mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.3, 12), dark, { x: 0.95, y: 0.36, z: s * 0.66, rx: Math.PI / 2 }));
  }
  g.add(mesh(box(0.6, 0.1, 1.3), dark, { x: 0.3, y: 1.02 }));
  return g;
}

export { M as propMaterials };
