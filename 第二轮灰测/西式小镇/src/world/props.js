// ---------------------------------------------------------------------------
// 小镇配件库：路灯、长椅、水井、喷泉、树木、篱笆、墓碑、摊位、小人、船……
// 所有函数签名统一为 (s, x, z, ry = 0, o = {})：
//   s  —— Sculptor
//   x,z—— 当前坐标系中的位置；o.y 可指定地面高度
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { MAT } from '../lib/materials.js';
import * as G from '../lib/geom.js';
import { signTexture } from '../lib/textures.js';

const TAU = Math.PI * 2;

/* -------------------------------- 路灯 ---------------------------------- */
export function streetLamp(s, x, z, ry = 0, o = {}) {
  const h = o.h ?? 4.3;
  s.push(x, o.y ?? 0, z, ry);
  s.cyl(MAT.stoneDark, 0.3, 0.36, 0.42, 0, 0, 0, 8);
  s.cyl(MAT.black, 0.09, 0.13, h, 0, 0.4, 0, 8);
  s.torus(MAT.black, 0.17, 0.045, 0, h * 0.34, 0, Math.PI / 2, 0, 0, 10);
  s.cyl(MAT.black, 0.24, 0.18, 0.14, 0, h + 0.4, 0, 8);
  s.cyl(MAT.lampGlass, 0.2, 0.26, 0.62, 0, h + 0.52, 0, 8);
  s.cone(MAT.black, 0.34, 0.3, 0, h + 1.14, 0, 8);
  s.ball(MAT.gold, 0.075, 0, h + 1.5, 0, 8);
  s.anchor('glow', 0, h + 0.82, 0, { size: 2.6, color: 0xffc46b });
  s.pop();
}

/* ------------------------------- 长椅 ----------------------------------- */
export function bench(s, x, z, ry = 0, o = {}) {
  s.push(x, o.y ?? 0, z, ry);
  s.box(MAT.timberDark, 0.14, 0.44, 0.62, -0.78, 0, 0);
  s.box(MAT.timberDark, 0.14, 0.44, 0.62, 0.78, 0, 0);
  s.box(MAT.woodPlank, 1.9, 0.11, 0.62, 0, 0.44, 0, 0, 1.2);
  s.boxR(MAT.woodPlank, 1.9, 0.52, 0.1, 0, 0.5, -0.26, -0.22, 0, 0, 1.2);
  s.pop();
}

/* ------------------------- 木桶 / 木箱 / 麻袋 --------------------------- */
export function barrel(s, x, z, ry = 0, o = {}) {
  const r = o.r ?? 0.36;
  const h = o.h ?? 0.92;
  s.push(x, o.y ?? 0, z, ry);
  s.cyl(MAT.woodPlankV, r * 0.88, r * 0.88, h, 0, 0, 0, 12, 0, 1.1);
  s.cyl(MAT.metalRust, r * 0.94, r * 0.94, 0.09, 0, h * 0.18, 0, 12);
  s.cyl(MAT.metalRust, r * 0.94, r * 0.94, 0.09, 0, h * 0.72, 0, 12);
  if (o.lying) {
    // 躺倒的桶
  }
  s.pop();
}

export function crate(s, x, z, ry = 0, o = {}) {
  const w = o.w ?? 0.8;
  const h = o.h ?? 0.6;
  s.push(x, o.y ?? 0, z, ry);
  s.box(MAT.woodPlank, w, h, w * 0.9, 0, 0, 0, 0, 0.55);
  s.pop();
}

export function sack(s, x, z, ry = 0, o = {}) {
  s.push(x, o.y ?? 0, z, ry);
  s.cyl(MAT.clothCream, 0.22, 0.3, 0.6, 0, 0, 0, 8);
  s.ball(MAT.clothCream, 0.2, 0, 0.62, 0, 8);
  s.pop();
}

/* -------------------------------- 水井 ---------------------------------- */
export function well(s, x, z, ry = 0, o = {}) {
  s.push(x, o.y ?? 0, z, ry);
  s.cyl(MAT.stone, 1.15, 1.25, 1.0, 0, 0, 0, 14, 0, 1.6);
  s.cyl(MAT.waterStill, 1.0, 1.0, 0.04, 0, 0.86, 0, 14);
  s.torus(MAT.stone, 1.16, 0.09, 0, 1.0, 0, Math.PI / 2, 0, 0, 16);
  s.box(MAT.timber, 0.16, 2.3, 0.16, -1.0, 0.95, 0);
  s.box(MAT.timber, 0.16, 2.3, 0.16, 1.0, 0.95, 0);
  s.gable(MAT.roofTerracotta, 2.9, 1.9, 0.75, 0, 3.15, 0, Math.PI / 2, 0.9);
  s.bar(MAT.timber, 0.08, 2.0, 0, 2.95, 0, 'x', 8);
  s.box(MAT.woodPlankV, 0.34, 0.34, 0.34, 0, 2.1, 0, 0.3, 0.4);
  s.box(MAT.black, 0.03, 0.55, 0.03, 0, 2.45, 0);
  s.pop();
}

/* -------------------------------- 喷泉 ---------------------------------- */
export function fountain(s, x, z, o = {}) {
  const R = o.r ?? 3.6;
  s.push(x, o.y ?? 0, z, 0);
  // 外圈台阶
  s.cyl(MAT.stone, R + 0.9, R + 1.1, 0.22, 0, 0, 0, 24, 0, 3);
  s.cyl(MAT.stone, R, R + 0.25, 0.92, 0, 0.2, 0, 24, 0, 2.4);
  s.cyl(MAT.stoneDark, R - 0.3, R - 0.3, 0.5, 0, 0.24, 0, 24, 0, 2.4);
  s.disc(MAT.water, R - 0.32, 0, 0.8, 0, 24);
  // 中心柱与水盘
  s.cyl(MAT.stone, 0.55, 0.72, 1.5, 0, 0.8, 0, 14, 0, 1.6);
  s.cyl(MAT.stone, 1.5, 0.7, 0.36, 0, 2.3, 0, 18, 0, 1.6);
  s.disc(MAT.water, 1.42, 0, 2.6, 0, 18);
  s.cyl(MAT.stone, 0.32, 0.42, 1.1, 0, 2.6, 0, 12, 0, 1.2);
  s.cyl(MAT.stone, 0.95, 0.42, 0.28, 0, 3.7, 0, 16, 0, 1.2);
  s.disc(MAT.water, 0.9, 0, 3.94, 0, 16);
  // 顶部小天使像
  s.ball(MAT.stone, 0.22, 0, 4.16, 0, 10);
  s.cyl(MAT.stone, 0.1, 0.16, 0.5, 0, 4.2, 0, 8);
  s.ball(MAT.stone, 0.17, 0, 4.82, 0, 10);
  s.panel(MAT.stone, 0.5, 0.42, -0.16, 4.3, 0, 0.5, 2, true);
  s.panel(MAT.stone, 0.5, 0.42, 0.16, 4.3, 0, -0.5, 2, true);
  s.anchor('fountain', 0, 4.1, 0, { r: R });
  s.pop();
}

/* -------------------------------- 树木 ---------------------------------- */
const LEAVES = [MAT.leafA, MAT.leafB, MAT.leafC, MAT.leafD];

export function treeRound(s, x, z, ry = 0, o = {}) {
  const k = o.scale ?? 1;
  const leaf = o.leaf ?? LEAVES[(o.i ?? 0) % LEAVES.length];
  s.push(x, o.y ?? 0, z, ry, k);
  s.cyl(MAT.trunk, 0.2, 0.34, 2.5, 0, 0, 0, 8, 0, 1.4);
  s.box(MAT.trunk, 0.14, 1.0, 0.14, 0.28, 1.9, 0.1, 0.5);
  s.ball(leaf, 1.55, 0, 4.0, 0, 12);
  s.ball(leaf, 1.15, -1.1, 3.3, 0.35, 10);
  s.ball(leaf, 1.05, 0.95, 3.5, -0.5, 10);
  s.ball(leaf, 0.92, 0.15, 5.0, 0.25, 10);
  s.pop();
}

export function treePine(s, x, z, ry = 0, o = {}) {
  const k = o.scale ?? 1;
  s.push(x, o.y ?? 0, z, ry, k);
  s.cyl(MAT.trunk, 0.16, 0.3, 1.6, 0, 0, 0, 8);
  s.cone(MAT.pine, 1.7, 2.6, 0, 1.2, 0, 10);
  s.cone(MAT.pine, 1.35, 2.4, 0, 2.7, 0, 10);
  s.cone(MAT.pine, 0.95, 2.2, 0, 4.2, 0, 10);
  s.pop();
}

export function treeCypress(s, x, z, ry = 0, o = {}) {
  const k = o.scale ?? 1;
  s.push(x, o.y ?? 0, z, ry, k);
  s.cyl(MAT.trunk, 0.14, 0.22, 0.9, 0, 0, 0, 8);
  s.cone(MAT.pine, 0.95, 6.2, 0, 0.6, 0, 10);
  s.cone(MAT.pine, 0.6, 2.2, 0, 5.4, 0, 8);
  s.pop();
}

export function treePoplar(s, x, z, ry = 0, o = {}) {
  const k = o.scale ?? 1;
  s.push(x, o.y ?? 0, z, ry, k);
  s.cyl(MAT.trunk, 0.18, 0.3, 3.4, 0, 0, 0, 8);
  s.ball(MAT.leafC, 1.15, 0, 4.2, 0, 10);
  s.ball(MAT.leafC, 0.95, 0, 5.6, 0, 10);
  s.ball(MAT.leafD, 0.75, 0, 6.7, 0, 8);
  s.pop();
}

export function bush(s, x, z, ry = 0, o = {}) {
  const k = o.scale ?? 1;
  s.push(x, o.y ?? 0, z, ry, k);
  s.ball(o.mat ?? MAT.hedge, 0.62, 0, 0.45, 0, 8);
  s.ball(o.mat ?? MAT.hedge, 0.45, 0.5, 0.32, 0.2, 8);
  s.ball(o.mat ?? MAT.hedge, 0.4, -0.42, 0.3, -0.2, 8);
  s.pop();
}

/* ------------------------------ 花坛 / 绿篱 ------------------------------ */
export function flowerBed(s, x, z, ry = 0, o = {}) {
  const w = o.w ?? 3;
  const d = o.d ?? 1.4;
  const flowers = [MAT.flowerRed, MAT.flowerPink, MAT.flowerYellow, MAT.flowerWhite];
  s.push(x, o.y ?? 0, z, ry);
  s.box(MAT.stoneWarm, w, 0.32, d, 0, 0, 0, 0, 1.2);
  s.box(MAT.soil, w - 0.3, 0.06, d - 0.3, 0, 0.32, 0, 0, 1);
  let i = 0;
  for (let ix = -w / 2 + 0.4; ix < w / 2 - 0.2; ix += 0.42) {
    for (let iz = -d / 2 + 0.35; iz < d / 2 - 0.2; iz += 0.42) {
      s.ball(MAT.hedge, 0.12, ix, 0.4, iz, 6);
      s.ball(flowers[i++ % 4], 0.11, ix, 0.56, iz, 6);
    }
  }
  s.pop();
}

export function hedgeRow(s, x, z, len, ry = 0, o = {}) {
  s.push(x, o.y ?? 0, z, ry);
  s.box(MAT.hedge, len, o.h ?? 1.1, o.d ?? 0.8, 0, 0, 0, 0, 1);
  s.box(MAT.hedge, len - 0.3, 0.2, (o.d ?? 0.8) - 0.25, 0, o.h ?? 1.1, 0, 0, 1);
  s.pop();
}

/* ------------------------------ 栅栏 / 石墙 ----------------------------- */
export function fenceLine(s, pts, o = {}) {
  const h = o.h ?? 1.0;
  const mat = o.mat ?? MAT.woodPlankV;
  const postMat = o.postMat ?? MAT.timber;
  const y = o.y ?? 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, z0] = pts[i];
    const [x1, z1] = pts[i + 1];
    const dx = x1 - x0;
    const dz = z1 - z0;
    const len = Math.hypot(dx, dz);
    if (len < 0.05) continue;
    const ang = Math.atan2(dx, dz);
    const mx = (x0 + x1) / 2;
    const mz = (z0 + z1) / 2;
    s.push(mx, y, mz, ang);
    s.box(mat, 0.07, h, len, 0, 0, 0, 0, 0.9);
    s.box(postMat, 0.14, h + 0.16, 0.14, 0, 0, -len / 2);
    const n = Math.max(1, Math.round(len / 2.4));
    for (let k = 1; k <= n; k++) {
      s.box(postMat, 0.14, h + 0.16, 0.14, 0, 0, -len / 2 + (len / n) * k);
    }
    if (o.rails) {
      s.box(postMat, 0.1, 0.1, len, 0.06, h * 0.32, 0);
      s.box(postMat, 0.1, 0.1, len, 0.06, h * 0.72, 0);
    }
    s.pop();
  }
}

export function stoneWallLine(s, pts, o = {}) {
  const h = o.h ?? 1.3;
  const t = o.t ?? 0.45;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, z0] = pts[i];
    const [x1, z1] = pts[i + 1];
    const dx = x1 - x0;
    const dz = z1 - z0;
    const len = Math.hypot(dx, dz);
    if (len < 0.05) continue;
    const ang = Math.atan2(dx, dz);
    s.push((x0 + x1) / 2, o.y ?? 0, (z0 + z1) / 2, ang);
    s.box(o.mat ?? MAT.stone, t, h, len + 0.1, 0, 0, 0, 0, 1.8);
    s.box(o.capMat ?? MAT.stoneDark, t + 0.16, 0.16, len + 0.1, 0, h, 0, 0, 1.8);
    if (o.posts) {
      const n = Math.max(1, Math.round(len / 8));
      for (let k = 0; k <= n; k++) {
        s.box(MAT.stoneDark, t + 0.4, h + 0.7, t + 0.4, 0, 0, -len / 2 + (len / n) * k, 0, 1.5);
      }
    }
    s.pop();
  }
}

/** 铁艺围栏（教堂、公园用） */
export function ironFence(s, pts, o = {}) {
  const h = o.h ?? 1.6;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, z0] = pts[i];
    const [x1, z1] = pts[i + 1];
    const dx = x1 - x0;
    const dz = z1 - z0;
    const len = Math.hypot(dx, dz);
    if (len < 0.05) continue;
    const ang = Math.atan2(dx, dz);
    s.push((x0 + x1) / 2, o.y ?? 0, (z0 + z1) / 2, ang);
    s.box(MAT.stoneDark, 0.5, 0.3, len, 0, 0, 0, 0, 1.5);
    s.box(MAT.black, 0.07, 0.07, len, 0, h * 0.85, 0);
    s.box(MAT.black, 0.07, 0.07, len, 0, h * 0.35, 0);
    const n = Math.max(2, Math.round(len / 0.5));
    for (let k = 0; k <= n; k++) {
      const zz = -len / 2 + (len / n) * k;
      s.box(MAT.black, 0.05, h, 0.05, 0, 0.3, zz);
      s.cone(MAT.black, 0.07, 0.17, 0, h + 0.3, zz, 4);
    }
    s.pop();
  }
}

/* -------------------------------- 墓碑 ---------------------------------- */
export function gravestone(s, x, z, ry = 0, o = {}) {
  const t = o.type ?? 0;
  s.push(x, o.y ?? 0, z, ry);
  if (t === 0) {
    s.box(MAT.stoneDark, 0.9, 0.16, 0.5, 0, 0, 0, 0, 1);
    s.box(MAT.stone, 0.7, 0.95, 0.16, 0, 0.16, 0, 0, 1);
    s.cyl(MAT.stone, 0.35, 0.35, 0.16, 0, 1.11, 0, 10, Math.PI / 2, 1);
  } else if (t === 1) {
    s.box(MAT.stoneDark, 0.6, 0.2, 0.5, 0, 0, 0, 0, 1);
    s.box(MAT.stone, 0.18, 1.3, 0.16, 0, 0.2, 0, 0, 1);
    s.box(MAT.stone, 0.75, 0.18, 0.16, 0, 1.05, 0, 0, 1);
  } else {
    s.box(MAT.stoneDark, 0.8, 0.25, 0.8, 0, 0, 0, 0, 1);
    s.box(MAT.stone, 0.5, 1.5, 0.5, 0, 0.25, 0, 0, 1.2);
    s.pyramid(MAT.stone, 0.56, 0.56, 0.5, 0, 1.75, 0, 0, 1);
  }
  s.pop();
}

/* ------------------------------ 集市摊位 -------------------------------- */
export function marketStall(s, x, z, ry = 0, o = {}) {
  const cloth = o.cloth ?? MAT.clothRed;
  const w = o.w ?? 2.8;
  const d = o.d ?? 1.9;
  s.push(x, o.y ?? 0, z, ry);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      s.box(MAT.timber, 0.09, 2.3, 0.09, (sx * w) / 2 - sx * 0.1, 0, (sz * d) / 2 - sz * 0.1);
    }
  }
  s.box(MAT.woodPlank, w, 0.09, d * 0.75, 0, 0.95, 0, 0, 1);
  s.panel(MAT.clothCream, w, 0.85, 0, 0.1, d * 0.375, 0, 1, true);
  // 双坡布篷
  s.boxR(cloth, w + 0.5, 0.05, d * 0.75, 0, 2.5, d * 0.29, 0.42, 0, 0, 1);
  s.boxR(cloth, w + 0.5, 0.05, d * 0.75, 0, 2.5, -d * 0.29, -0.42, 0, 0, 1);
  s.box(MAT.timber, w + 0.5, 0.08, 0.08, 0, 2.78, 0);
  // 货物
  const goods = [MAT.flowerRed, MAT.flowerYellow, MAT.crop, MAT.leafA, MAT.flowerPink];
  for (let i = 0; i < 5; i++) {
    const gx = -w / 2 + 0.4 + i * (w / 5.2);
    s.box(MAT.woodPlank, 0.42, 0.16, 0.42, gx, 1.04, 0, 0, 0.5);
    s.ball(goods[(i + (o.i ?? 0)) % goods.length], 0.17, gx, 1.32, 0, 8);
    s.ball(goods[(i + 1 + (o.i ?? 0)) % goods.length], 0.14, gx + 0.1, 1.5, 0.1, 8);
  }
  s.pop();
}

/* ------------------------------ 招牌 / 路牌 ----------------------------- */
export function shopSign(s, x, y, z, ry, text, o = {}) {
  const tex = signTexture(text, o.bg ?? '#2f4858', o.fg ?? '#f2e3bd');
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.7,
    side: THREE.DoubleSide,
  });
  mat.name = 'sign:' + text;
  const w = o.w ?? 1.5;
  const h = o.h ?? 0.56;
  const geo = new THREE.PlaneGeometry(w, h);
  geo.translate(0, -h / 2, 0); // 支点移到上沿，好让它晃
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = false;
  s.attach(mesh, x, y + h / 2, z, ry);
  // 随风轻晃
  const ph = x * 0.83 + z * 0.41;
  s.onUpdate((dt, t) => {
    mesh.rotation.z = Math.sin(t * 0.85 + ph) * 0.06 + Math.sin(t * 1.9 + ph) * 0.015;
  });
  // 铁支架
  s.push(x, 0, z, ry);
  s.box(MAT.black, 0.05, 0.05, (o.arm ?? 0.7) * 2, 0, y + h / 2 + 0.16, 0);
  s.box(MAT.black, 0.04, 0.2, 0.04, 0, y + h / 2, (o.arm ?? 0.7) * 0.8);
  s.pop();
  return mesh;
}

export function signPost(s, x, z, ry, texts, o = {}) {
  s.push(x, o.y ?? 0, z, ry);
  s.cyl(MAT.stoneDark, 0.24, 0.3, 0.3, 0, 0, 0, 8);
  s.box(MAT.timber, 0.13, 2.6, 0.13, 0, 0.2, 0);
  s.ball(MAT.gold, 0.09, 0, 2.9, 0, 8);
  s.pop();
  texts.forEach((t, i) => {
    const tex = signTexture(t, '#3b3a38', '#f0e2c0');
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, side: THREE.DoubleSide });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.4), mat);
    s.attach(m, x + Math.cos(ry + i * 1.7) * 0.75, 2.35 - i * 0.5, z + Math.sin(ry + i * 1.7) * 0.75, ry + i * 1.7 + Math.PI / 2);
  });
}

/* ------------------------------- 小镇居民 ------------------------------- */
const COATS = [MAT.doorRed, MAT.doorBlue, MAT.doorGreen, MAT.clothBlue, MAT.trimDark, MAT.woodRed, MAT.plasterBlue];
const SKIN = MAT.plasterRose;

export function person(s, x, z, ry = 0, o = {}) {
  const k = o.scale ?? 1;
  const coat = o.coat ?? COATS[(o.i ?? 0) % COATS.length];
  s.push(x, o.y ?? 0, z, ry, k);
  s.box(MAT.trimDark, 0.16, 0.72, 0.18, -0.11, 0, 0, 0, 0.5);
  s.box(MAT.trimDark, 0.16, 0.72, 0.18, 0.11, 0, 0, 0, 0.5);
  if (o.skirt) {
    s.cyl(coat, 0.34, 0.16, 0.66, 0, 0.6, 0, 10, 0, 0.6);
    s.box(coat, 0.42, 0.5, 0.26, 0, 0.9, 0, 0, 0.6);
  } else {
    s.box(coat, 0.46, 0.7, 0.28, 0, 0.7, 0, 0, 0.6);
  }
  s.box(coat, 0.12, 0.6, 0.14, -0.28, 0.7, 0, 0, 0.5);
  s.box(coat, 0.12, 0.6, 0.14, 0.28, 0.7, 0, 0, 0.5);
  s.cyl(SKIN, 0.09, 0.09, 0.1, 0, 1.38, 0, 8);
  s.ball(SKIN, 0.145, 0, 1.58, 0, 10);
  if (o.hat !== false) {
    s.cyl(MAT.trimDark, 0.26, 0.26, 0.03, 0, 1.66, 0, 10);
    s.cyl(MAT.trimDark, 0.14, 0.15, 0.22, 0, 1.68, 0, 10);
  }
  s.pop();
}

/* --------------------------------- 手推车 ------------------------------- */
export function handcart(s, x, z, ry = 0, o = {}) {
  s.push(x, o.y ?? 0, z, ry);
  s.box(MAT.woodPlank, 1.9, 0.5, 1.1, 0, 0.55, 0, 0, 0.7);
  s.box(MAT.woodPlank, 1.9, 0.07, 1.1, 0, 0.5, 0, 0, 0.7);
  s.torus(MAT.timberDark, 0.44, 0.08, -0.4, 0.44, 0.6, 0, Math.PI / 2, 0, 12);
  s.torus(MAT.timberDark, 0.44, 0.08, -0.4, 0.44, -0.6, 0, Math.PI / 2, 0, 12);
  s.box(MAT.timber, 1.2, 0.08, 0.08, 1.4, 0.62, 0.35);
  s.box(MAT.timber, 1.2, 0.08, 0.08, 1.4, 0.62, -0.35);
  if (o.load !== false) {
    s.box(MAT.hay, 1.5, 0.5, 0.9, 0, 0.9, 0, 0, 0.8);
  }
  s.pop();
}

/* --------------------------------- 雕像 --------------------------------- */
export function statue(s, x, z, ry = 0, o = {}) {
  s.push(x, o.y ?? 0, z, ry);
  s.box(MAT.stoneDark, 2.6, 0.35, 2.6, 0, 0, 0, 0, 2);
  s.box(MAT.stone, 2.0, 1.9, 2.0, 0, 0.35, 0, 0, 1.8);
  s.box(MAT.stoneDark, 2.2, 0.2, 2.2, 0, 2.25, 0, 0, 1.8);
  // 骑士 / 名人像
  s.box(MAT.stone, 0.5, 1.1, 0.34, 0, 2.45, 0, 0, 1);
  s.box(MAT.stone, 0.7, 1.1, 0.5, 0, 3.0, -0.05, 0, 1);
  s.ball(MAT.stone, 0.24, 0, 4.3, 0, 10);
  s.box(MAT.stone, 0.16, 1.0, 0.16, 0.42, 3.1, 0.1, -0.5);
  s.box(MAT.stone, 0.16, 0.9, 0.16, -0.4, 3.1, 0.05, 0.3);
  s.panel(MAT.stone, 0.9, 1.5, 0, 2.6, -0.3, 0, 1.5, true);
  s.pop();
}

/* -------------------------------- 旗杆 ---------------------------------- */
export function flagPole(s, x, z, ry = 0, o = {}) {
  const h = o.h ?? 9;
  s.push(x, o.y ?? 0, z, ry);
  s.cyl(MAT.stone, 0.5, 0.62, 0.5, 0, 0, 0, 10, 0, 1.4);
  s.cyl(MAT.white, 0.08, 0.12, h, 0, 0.5, 0, 8);
  s.ball(MAT.gold, 0.14, 0, h + 0.62, 0, 8);
  // 会飘动的旗子
  const geo = new THREE.PlaneGeometry(2.6, 1.6, 12, 4);
  geo.translate(1.3, 0, 0);
  const mat = (o.flag ?? MAT.clothRed).clone();
  mat.name = 'flagCloth';
  const flag = new THREE.Mesh(geo, mat);
  flag.castShadow = false;
  const base = geo.attributes.position.array.slice();
  s.attach(flag, 0, h - 1.4, 0, 0);
  s.onUpdate((dt, t) => {
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const bx = base[i * 3];
      const by = base[i * 3 + 1];
      p.setZ(i, Math.sin(bx * 1.6 - t * 5.2) * 0.22 * (bx / 2.6 + 0.15));
      p.setY(i, by + Math.sin(bx * 1.1 - t * 4.4) * 0.08 * (bx / 2.6));
    }
    p.needsUpdate = true;
  });
  s.pop();
  return flag;
}

/* -------------------------------- 船 ------------------------------------ */
export function boat(s, x, z, ry = 0, o = {}) {
  const k = o.scale ?? 1;
  const g = new THREE.Group();
  const sub = new G.Sculptor('boat');
  sub.push(0, 0, 0, 0, k);
  // 船体：由三段渐窄的盒子近似
  sub.box(MAT.woodPlankV, 1.9, 0.95, 4.4, 0, 0, 0, 0, 1.1);
  sub.box(MAT.woodPlankV, 1.4, 0.85, 1.6, 0, 0.05, 2.7, 0, 1.1);
  sub.box(MAT.woodPlankV, 0.7, 0.75, 1.2, 0, 0.1, 3.9, 0, 1.1);
  sub.box(MAT.woodPlankV, 1.3, 0.8, 1.2, 0, 0.05, -2.5, 0, 1.1);
  sub.box(MAT.woodPlank, 1.7, 0.08, 4.2, 0, 0.95, 0, 0, 1);
  sub.box(MAT.woodRed, 2.0, 0.16, 4.6, 0, 0.86, 0, 0, 1.4);
  if (o.cabin) {
    sub.box(MAT.plasterCream, 1.5, 0.9, 1.6, 0, 1.03, -1.4, 0, 0.9);
    sub.gable(MAT.roofSlate, 1.7, 1.8, 0.4, 0, 1.93, -1.4, Math.PI / 2, 0.8);
  }
  if (o.sail !== false) {
    sub.cyl(MAT.timber, 0.09, 0.13, 7.5 * (o.mast ?? 1), 0, 1.0, 0.4, 8);
    sub.bar(MAT.timber, 0.07, 3.2, 0, 5.6, 0.4, 'z', 8);
    sub.panel(MAT.clothCream, 3.0, 4.2, 0, 1.5, 0.42, Math.PI / 2, 2.2, true);
    sub.panel(MAT.clothCream, 2.2, 2.4, 0, 5.6, 0.42, Math.PI / 2, 2.2, true);
  } else {
    for (let i = -1; i <= 1; i++) sub.box(MAT.woodPlank, 1.6, 0.1, 0.3, 0, 0.94, i * 1.3, 0, 0.6);
  }
  if (o.crates) {
    sub.box(MAT.woodPlank, 0.7, 0.6, 0.7, -0.35, 1.03, 1.2, 0.3, 0.5);
    sub.box(MAT.woodPlank, 0.6, 0.5, 0.6, 0.4, 1.03, 0.4, -0.2, 0.5);
  }
  sub.pop();
  g.add(sub.finalize());
  s.attach(g, x, o.y ?? 0, z, ry);
  // 随波起伏
  const ph = (o.phase ?? 0) + x * 0.1;
  const y0 = o.y ?? 0;
  s.onUpdate((dt, t) => {
    g.position.y = y0 + Math.sin(t * 0.9 + ph) * 0.09;
    g.rotation.z = Math.sin(t * 0.7 + ph) * 0.035;
    g.rotation.x = Math.cos(t * 0.55 + ph) * 0.025;
  });
  return g;
}

/* ------------------------------- 码头栈桥 -------------------------------- */
export function pier(s, pts, o = {}) {
  const w = o.w ?? 3;
  const y = o.y ?? 0.5;
  s.ribbon(MAT.woodPlank, pts, w, y, 1.2);
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, z0] = pts[i];
    const [x1, z1] = pts[i + 1];
    const len = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.max(1, Math.round(len / 3.2));
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      const px = x0 + (x1 - x0) * t;
      const pz = z0 + (z1 - z0) * t;
      const nx = -(z1 - z0) / len;
      const nz = (x1 - x0) / len;
      for (const sd of [-1, 1]) {
        s.cyl(MAT.timberDark, 0.16, 0.2, y + 2.4, px + nx * sd * (w / 2 - 0.25), y - 2.4, pz + nz * sd * (w / 2 - 0.25), 8);
      }
    }
  }
}

/* ------------------------------- 港口起重机 ------------------------------ */
export function harborCrane(s, x, z, ry = 0, o = {}) {
  s.push(x, o.y ?? 0, z, ry);
  s.box(MAT.stone, 2.6, 0.5, 2.6, 0, 0, 0, 0, 1.6);
  s.cyl(MAT.timberDark, 0.9, 1.1, 5.4, 0, 0.5, 0, 10, 0, 1.4);
  s.cyl(MAT.woodPlankV, 1.5, 1.6, 2.6, 0, 5.5, 0, 12, 0, 1.4);
  s.cone(MAT.roofSlate, 2.0, 1.2, 0, 8.1, 0, 12);
  // 吊臂
  s.boxR(MAT.timber, 0.4, 7.6, 0.4, 2.2, 5.8, 0, 0, 0, -0.72);
  s.box(MAT.black, 0.06, 3.2, 0.06, 4.9, 3.4, 0);
  s.box(MAT.metalRust, 0.35, 0.5, 0.35, 4.9, 3.0, 0);
  s.pop();
}

/* -------------------------------- 干草堆 -------------------------------- */
export function haystack(s, x, z, ry = 0, o = {}) {
  const k = o.scale ?? 1;
  s.push(x, o.y ?? 0, z, ry, k);
  s.cyl(MAT.hay, 1.5, 1.7, 1.5, 0, 0, 0, 12, 0, 1.4);
  s.cone(MAT.hay, 1.75, 1.7, 0, 1.5, 0, 12);
  s.box(MAT.timber, 0.08, 3.6, 0.08, 0, 0, 0);
  s.pop();
}

export function hayBale(s, x, z, ry = 0, o = {}) {
  s.push(x, o.y ?? 0, z, ry);
  s.bar(MAT.hay, 0.7, 1.5, 0, 0.7, 0, 'x', 12, 1.2);
  s.pop();
}

/* -------------------------------- 稻草人 -------------------------------- */
export function scarecrow(s, x, z, ry = 0, o = {}) {
  s.push(x, o.y ?? 0, z, ry);
  s.box(MAT.timber, 0.12, 2.4, 0.12, 0, 0, 0);
  s.box(MAT.timber, 1.7, 0.1, 0.1, 0, 1.75, 0);
  s.box(MAT.clothRed, 0.7, 0.8, 0.35, 0, 1.25, 0, 0, 0.7);
  s.ball(MAT.hay, 0.26, 0, 2.3, 0, 8);
  s.cyl(MAT.hay, 0.55, 0.55, 0.04, 0, 2.5, 0, 10);
  s.cone(MAT.hay, 0.3, 0.35, 0, 2.52, 0, 10);
  s.cyl(MAT.hay, 0.1, 0.14, 0.4, -0.78, 1.5, 0, 6);
  s.cyl(MAT.hay, 0.1, 0.14, 0.4, 0.78, 1.5, 0, 6);
  s.pop();
}

/* -------------------------------- 动物 ---------------------------------- */
export function sheep(s, x, z, ry = 0, o = {}) {
  s.push(x, o.y ?? 0, z, ry, o.scale ?? 1);
  s.box(MAT.trimDark, 0.08, 0.42, 0.08, -0.22, 0, 0.28);
  s.box(MAT.trimDark, 0.08, 0.42, 0.08, 0.22, 0, 0.28);
  s.box(MAT.trimDark, 0.08, 0.42, 0.08, -0.22, 0, -0.28);
  s.box(MAT.trimDark, 0.08, 0.42, 0.08, 0.22, 0, -0.28);
  s.ball(MAT.sheep, 0.52, 0, 0.72, 0, 10);
  s.ball(MAT.sheep, 0.34, 0, 0.72, 0.5, 8);
  s.ball(MAT.trimDark, 0.2, 0, 0.78, 0.78, 8);
  s.pop();
}

export function cow(s, x, z, ry = 0, o = {}) {
  s.push(x, o.y ?? 0, z, ry, o.scale ?? 1);
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) s.box(MAT.trimDark, 0.12, 0.7, 0.12, sx * 0.32, 0, sz * 0.5);
  s.box(MAT.cow, 0.9, 0.85, 1.9, 0, 0.65, 0, 0, 1);
  s.ball(MAT.cowWhite, 0.3, 0.3, 0.95, 0.4, 8);
  s.ball(MAT.cowWhite, 0.26, -0.32, 0.8, -0.5, 8);
  s.box(MAT.cow, 0.55, 0.55, 0.6, 0, 0.85, 1.15, 0, 0.8);
  s.box(MAT.cowWhite, 0.4, 0.28, 0.2, 0, 0.9, 1.48, 0, 0.6);
  s.cyl(MAT.white, 0.06, 0.08, 0.24, -0.22, 1.32, 1.05, 6);
  s.cyl(MAT.white, 0.06, 0.08, 0.24, 0.22, 1.32, 1.05, 6);
  s.box(MAT.cow, 0.08, 0.5, 0.08, 0, 0.9, -1.0, 0.35);
  s.pop();
}

export function duck(s, x, z, ry = 0, o = {}) {
  s.push(x, o.y ?? 0, z, ry, o.scale ?? 1);
  s.ball(MAT.duck, 0.22, 0, 0.16, 0, 8);
  s.ball(MAT.duck, 0.13, 0, 0.34, 0.2, 8);
  s.cone(MAT.flowerYellow, 0.06, 0.16, 0, 0.34, 0.34, 6);
  s.pop();
}

export function horse(s, x, z, ry = 0, o = {}) {
  s.push(x, o.y ?? 0, z, ry, o.scale ?? 1);
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) s.box(MAT.trimDark, 0.13, 0.95, 0.13, sx * 0.3, 0, sz * 0.55);
  s.box(MAT.horse, 0.8, 0.85, 2.0, 0, 0.9, 0, 0, 1);
  s.box(MAT.horse, 0.42, 0.8, 0.45, 0, 1.35, 1.05, -0.35, 0.8);
  s.box(MAT.horse, 0.36, 0.5, 0.7, 0, 1.85, 1.3, 0.4, 0.7);
  s.box(MAT.trimDark, 0.1, 0.7, 0.1, 0, 1.2, -1.0, -0.4);
  s.pop();
}

/* ------------------------------ 八角凉亭 -------------------------------- */
export function gazebo(s, x, z, ry = 0, o = {}) {
  const R = o.r ?? 3.6;
  s.push(x, o.y ?? 0, z, ry);
  s.cyl(MAT.stone, R + 0.7, R + 0.9, 0.55, 0, 0, 0, 8, Math.PI / 8, 2);
  s.cyl(MAT.woodPlank, R, R, 0.16, 0, 0.55, 0, 8, Math.PI / 8, 1.6);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + Math.PI / 8;
    const px = Math.cos(a) * (R - 0.35);
    const pz = Math.sin(a) * (R - 0.35);
    s.cyl(MAT.white, 0.14, 0.18, 3.4, px, 0.7, pz, 8, 0, 1.2);
    // 栏杆（留出入口）
    if (i !== 0 && i !== 1) {
      const a2 = ((i + 1) / 8) * TAU + Math.PI / 8;
      const qx = Math.cos(a2) * (R - 0.35);
      const qz = Math.sin(a2) * (R - 0.35);
      const len = Math.hypot(qx - px, qz - pz);
      const ang = Math.atan2(qx - px, qz - pz);
      s.push((px + qx) / 2, 0, (pz + qz) / 2, ang);
      s.box(MAT.white, 0.09, 0.1, len, 0, 1.5, 0);
      s.box(MAT.white, 0.09, 0.1, len, 0, 0.85, 0);
      const n = Math.round(len / 0.32);
      for (let k = 1; k < n; k++) s.box(MAT.white, 0.06, 0.65, 0.06, 0, 0.9, -len / 2 + (len / n) * k);
      s.pop();
    }
  }
  s.cyl(MAT.white, R + 0.2, R + 0.2, 0.22, 0, 4.1, 0, 8, Math.PI / 8, 1.6);
  s.cone(MAT.roofSlate, R + 0.8, 2.4, 0, 4.3, 0, 8);
  s.cyl(MAT.gold, 0.12, 0.16, 0.7, 0, 6.7, 0, 8);
  s.ball(MAT.gold, 0.22, 0, 7.5, 0, 10);
  s.pop();
}

/* ------------------------------- 铁轨 ----------------------------------- */
export function railway(s, pts, o = {}) {
  const gauge = o.gauge ?? 1.5;
  s.ribbon(MAT.gravel, pts, gauge + 2.6, o.y ?? 0.08, 3);
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, z0] = pts[i];
    const [x1, z1] = pts[i + 1];
    const len = Math.hypot(x1 - x0, z1 - z0);
    const ang = Math.atan2(x1 - x0, z1 - z0);
    const n = Math.max(1, Math.round(len / 1.3));
    s.push((x0 + x1) / 2, o.y ?? 0.08, (z0 + z1) / 2, ang);
    for (let k = 0; k < n; k++) {
      s.box(MAT.timberDark, gauge + 1.4, 0.16, 0.5, 0, 0.1, -len / 2 + (len / n) * (k + 0.5), 0, 0.8);
    }
    s.box(MAT.metal, 0.14, 0.18, len, -gauge / 2, 0.26, 0);
    s.box(MAT.metal, 0.14, 0.18, len, gauge / 2, 0.26, 0);
    s.pop();
  }
}

/* ------------------------------ 拱形石桥 -------------------------------- */
export function stoneBridge(s, x, z, ry, o = {}) {
  const span = o.span ?? 26;
  const w = o.w ?? 9;
  const rise = o.rise ?? 2.2;
  const deckY = o.deckY ?? 1.6;
  s.push(x, o.y ?? 0, z, ry);
  // 桥面（微拱）
  const seg = 14;
  for (let i = 0; i < seg; i++) {
    const t0 = i / seg - 0.5;
    const t1 = (i + 1) / seg - 0.5;
    const y0 = deckY + Math.cos(t0 * Math.PI) * rise;
    const y1 = deckY + Math.cos(t1 * Math.PI) * rise;
    const zz = ((t0 + t1) / 2) * span;
    const len = (span / seg) * 1.06;
    const ang = Math.atan2(y1 - y0, span / seg);
    s.boxR(MAT.cobbleWarm, w, 0.55, len, 0, (y0 + y1) / 2 - 0.55, zz, -ang, 0, 0, 1.4);
    // 栏杆
    for (const sd of [-1, 1]) {
      s.boxR(MAT.stone, 0.42, 0.95, len, (sd * (w - 0.5)) / 2, (y0 + y1) / 2, zz, -ang, 0, 0, 1.4);
      s.boxR(MAT.stoneDark, 0.56, 0.16, len, (sd * (w - 0.5)) / 2, (y0 + y1) / 2 + 0.95, zz, -ang, 0, 0, 1.4);
    }
  }
  // 桥墩与拱洞
  const arches = o.arches ?? 3;
  const aw = span / arches;
  for (let i = 0; i < arches; i++) {
    const cz = -span / 2 + aw * (i + 0.5);
    const t = cz / span;
    const topY = deckY + Math.cos(t * Math.PI) * rise - 0.55;
    s.arch(MAT.stone, aw + 0.1, topY + 1.2, w - 0.1, aw * 0.62, topY * 0.78, 0, -1.2, cz, Math.PI / 2, 9, 2);
  }
  for (let i = 0; i <= arches; i++) {
    const cz = -span / 2 + aw * i;
    s.box(MAT.stoneDark, w + 0.5, 1.6, 1.8, 0, -1.4, cz, 0, 2);
  }
  // 引桥坡道：把 1.7m 高的桥面接回地面
  const rl = o.ramp ?? 14;
  const n = 7;
  for (const sd of [-1, 1]) {
    for (let i = 0; i < n; i++) {
      const t0 = i / n;
      const t1 = (i + 1) / n;
      const y0 = deckY * (1 - t0) + 0.1 * t0;
      const y1 = deckY * (1 - t1) + 0.1 * t1;
      const zz = sd * (span / 2 + (rl * (t0 + t1)) / 2);
      const len = (rl / n) * 1.1;
      const ang = sd * Math.atan2(y0 - y1, rl / n);
      s.boxC(MAT.cobbleWarm, w, 0.5, len, 0, (y0 + y1) / 2 - 0.25, zz, ang, 0, 0, 1.4);
      for (const sx of [-1, 1]) {
        s.boxC(MAT.stone, 0.42, 0.85, len, (sx * (w - 0.5)) / 2, (y0 + y1) / 2 + 0.2, zz, ang, 0, 0, 1.4);
        s.boxC(MAT.stoneDark, 0.56, 0.14, len, (sx * (w - 0.5)) / 2, (y0 + y1) / 2 + 0.7, zz, ang, 0, 0, 1.4);
      }
      // 路堤侧壁
      if (y0 > 0.4) {
        for (const sx of [-1, 1]) {
          s.box(MAT.stoneDark, 0.5, y0, len, (sx * w) / 2, 0, zz, 0, 1.8);
        }
      }
    }
  }
  s.pop();
}

/* ------------------------------ 木桥 ------------------------------------ */
export function woodBridge(s, x, z, ry, o = {}) {
  const span = o.span ?? 20;
  const w = o.w ?? 4.5;
  const y = o.y ?? 1.2;
  s.push(x, 0, z, ry);
  s.box(MAT.woodPlank, w, 0.22, span, 0, y, 0, 0, 1.1);
  for (const sd of [-1, 1]) {
    s.box(MAT.timber, 0.12, 0.9, span, (sd * (w - 0.3)) / 2, y + 0.22, 0);
    const n = Math.round(span / 2.5);
    for (let k = 0; k <= n; k++) {
      const zz = -span / 2 + (span / n) * k;
      s.box(MAT.timber, 0.16, 1.1, 0.16, (sd * (w - 0.3)) / 2, y + 0.2, zz);
      if (k < n) s.cyl(MAT.timberDark, 0.15, 0.18, y + 2.2, (sd * (w - 0.6)) / 2, y - 2.2, zz + span / n / 2, 8);
    }
  }
  s.pop();
}

/* --------------------------- 挂灯 / 火盆 -------------------------------- */
export function hangingLantern(s, x, y, z, ry = 0) {
  s.push(x, 0, z, ry);
  s.box(MAT.black, 0.05, 0.05, 0.9, 0, y + 0.5, 0.45);
  s.box(MAT.black, 0.04, 0.3, 0.04, 0, y + 0.2, 0.85);
  s.cyl(MAT.lampGlass, 0.16, 0.2, 0.4, 0, y, 0.85, 8);
  s.cone(MAT.black, 0.26, 0.22, 0, y + 0.4, 0.85, 8);
  s.anchor('glow', 0, y + 0.2, 0.85, { size: 1.8, color: 0xffc46b });
  s.pop();
}

/* -------------------------------- 木堆 ---------------------------------- */
export function logPile(s, x, z, ry = 0, o = {}) {
  s.push(x, o.y ?? 0, z, ry);
  for (let r = 0; r < 3; r++) {
    for (let i = 0; i < 4 - r; i++) {
      s.bar(MAT.trunk, 0.22, 2.4, (i - (3 - r) / 2) * 0.48 + 0.24, 0.24 + r * 0.42, 0, 'z', 8, 1.2);
    }
  }
  s.pop();
}

/* ------------------------------ 邮筒 / 消防栓 --------------------------- */
export function postBox(s, x, z, ry = 0, o = {}) {
  s.push(x, o.y ?? 0, z, ry);
  s.cyl(MAT.doorRed, 0.28, 0.3, 1.3, 0, 0, 0, 10, 0, 0.9);
  s.cyl(MAT.black, 0.32, 0.32, 0.08, 0, 1.3, 0, 10);
  s.cone(MAT.doorRed, 0.3, 0.25, 0, 1.38, 0, 10);
  s.box(MAT.black, 0.22, 0.06, 0.04, 0, 1.05, 0.29);
  s.pop();
}

export function waterTrough(s, x, z, ry = 0, o = {}) {
  s.push(x, o.y ?? 0, z, ry);
  s.box(MAT.stone, 1.2, 0.6, 3.0, 0, 0, 0, 0, 1.4);
  s.box(MAT.waterStill, 0.9, 0.06, 2.7, 0, 0.55, 0);
  s.pop();
}
