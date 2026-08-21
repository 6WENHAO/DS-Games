/**
 * 动态元素：蒸汽小火车（沿山海环线爬升）、汽车、船、行人、热气球、海鸥，
 * 以及旋转件（风车/水轮/摩天轮/木马/风向标/灯塔光束/望远镜/秋千）的统一驱动。
 */
import * as THREE from 'three';
import {
  mat, glowMat, mesh, group, box, roundedBox, cyl, cone, sphere, lathe,
  RNG, TAU, clamp, lerp, smoothstep, damp,
} from '../lib/utils.js';
import { clothMaterial } from '../lib/wind.js';
import { PAL, LANTERN } from './buildings.js';
import { makeDog } from './nature.js';
import { baseHeight, groundHeight, makeSeaRoute, WALK_PATHS } from './layout.js';

const V3 = new THREE.Vector3();
const V3B = new THREE.Vector3();
const V3C = new THREE.Vector3();

function wheelGeo(r, w, seg = 12) { return new THREE.CylinderGeometry(r, r, w, seg); }

function faceAlong(obj, pos, tan) {
  obj.position.copy(pos);
  V3C.copy(pos).add(tan);
  obj.lookAt(V3C);
}

/* ============================================================ 火车 */
export function makeTrain() {
  const cars = [];
  const wheels = [];
  const black = mat('#2b2f33', { rough: 0.5, metal: 0.35 });
  const red = mat('#9c3a30', { rough: 0.55 });
  const gold = mat('#c9a34a', { metal: 0.8, rough: 0.3 });
  const steel = mat('#7d858c', { metal: 0.75, rough: 0.35 });
  const green = mat('#2f5f4a', { rough: 0.5, metal: 0.2 });
  const cream = mat('#e8dcc0', { rough: 0.7 });
  const roofM = mat('#3f4750', { rough: 0.6 });
  const glass = glowMat('#bcd8ea', '#ffd28a', 2.6, { rough: 0.1 });
  const head = glowMat('#fff6da', '#fff2c0', 4.0, { rough: 0.2, dayIntensity: 0.3 });

  /* 机车：前进方向 +Z */
  const loco = group('locomotive');
  loco.add(mesh(box(1.9, 0.26, 5.6), black, { y: 0.5 }));
  loco.add(mesh(cyl(0.72, 0.72, 3.4, 16), green, { y: 1.5, z: 0.6, rx: Math.PI / 2 }));
  loco.add(mesh(new THREE.TorusGeometry(0.74, 0.06, 6, 16), gold, { y: 1.5, z: 1.1, rz: 0 }));
  loco.add(mesh(new THREE.TorusGeometry(0.74, 0.06, 6, 16), gold, { y: 1.5, z: -0.2 }));
  loco.add(mesh(cyl(0.78, 0.78, 0.3, 16), black, { y: 1.5, z: 2.32, rx: Math.PI / 2 }));
  loco.add(mesh(new THREE.CircleGeometry(0.6, 16), mat('#4a5158', { metal: 0.5, rough: 0.4 }), { y: 1.5, z: 2.49 }));
  // 烟囱 + 汽包
  loco.add(mesh(lathe([[0.16, 0], [0.15, 0.5], [0.26, 0.72], [0.3, 0.8]], 12), black, { y: 2.1, z: 1.85 }));
  loco.add(mesh(lathe([[0.3, 0], [0.28, 0.2], [0.2, 0.34]], 12), gold, { y: 2.15, z: 0.9 }));
  loco.add(mesh(lathe([[0.22, 0], [0.2, 0.16], [0.12, 0.26]], 10), gold, { y: 2.15, z: 0.2 }));
  loco.add(mesh(sphere(0.26, 10, 8), head, { y: 1.62, z: 2.6 }));
  loco.add(mesh(cyl(0.3, 0.34, 0.24, 12), steel, { y: 1.62, z: 2.5, rx: Math.PI / 2 }));
  // 司机室
  loco.add(mesh(roundedBox(1.86, 1.6, 1.9, 0.14), red, { y: 0.72, z: -1.9 }));
  loco.add(mesh(box(2.1, 0.16, 2.2), roofM, { y: 2.32, z: -1.9 }));
  loco.add(mesh(box(2.16, 0.1, 0.5), roofM, { y: 2.42, z: -1.9 }));
  for (const s of [-1, 1]) {
    loco.add(mesh(box(0.06, 0.7, 0.8), glass, { x: s * 0.94, y: 1.5, z: -1.7 }));
  }
  loco.add(mesh(box(1.0, 0.7, 0.06), glass, { y: 1.5, z: -2.86 }));
  loco.add(mesh(box(0.9, 0.7, 0.06), glass, { y: 1.5, z: -0.98 }));
  // 排障器
  loco.add(mesh(box(2.0, 0.3, 0.24), red, { y: 0.36, z: 2.9 }));
  for (let i = 0; i < 7; i++) loco.add(mesh(box(0.1, 0.5, 0.6), black, { x: -0.75 + i * 0.25, y: 0.1, z: 3.1, rx: -0.5 }));
  // 轮
  for (const s of [-1, 1]) {
    for (const [z, r] of [[1.9, 0.42], [0.5, 0.62], [-0.9, 0.62], [-2.2, 0.62]]) {
      const w = mesh(wheelGeo(r, 0.16), black, { x: s * 0.92, y: r * 0.72 + 0.06, z, rz: Math.PI / 2 });
      w.userData.radius = r;
      wheels.push(w); loco.add(w);
      loco.add(mesh(wheelGeo(r * 0.35, 0.2), steel, { x: s * 0.92, y: r * 0.72 + 0.06, z, rz: Math.PI / 2 }));
    }
  }
  cars.push({ obj: loco, offset: 0, smoke: { x: 0, y: 2.95, z: 1.85 } });

  /* 煤水车 */
  const tender = group('tender');
  tender.add(mesh(box(1.8, 0.24, 3.0), black, { y: 0.5 }));
  tender.add(mesh(roundedBox(1.76, 1.1, 2.9, 0.1), red, { y: 0.72 }));
  tender.add(mesh(box(1.6, 0.3, 2.7), mat('#25282b', { rough: 0.95 }), { y: 1.7 }));
  tender.add(mesh(box(1.86, 0.12, 3.0), gold, { y: 1.82 }));
  for (const s of [-1, 1]) {
    for (const z of [0.9, -0.9]) {
      const w = mesh(wheelGeo(0.4, 0.14), black, { x: s * 0.88, y: 0.35, z, rz: Math.PI / 2 });
      w.userData.radius = 0.4; wheels.push(w); tender.add(w);
    }
  }
  cars.push({ obj: tender, offset: -4.6 });

  /* 客车 x3 */
  for (let i = 0; i < 3; i++) {
    const c = group('coach');
    c.add(mesh(box(1.9, 0.22, 5.2), black, { y: 0.46 }));
    c.add(mesh(roundedBox(2.0, 1.9, 5.4, 0.18), i % 2 ? cream : red, { y: 0.66 }));
    c.add(mesh(box(2.06, 0.2, 5.5), gold, { y: 1.5 }));
    c.add(mesh(new THREE.CylinderGeometry(1.02, 1.02, 5.5, 16), roofM, { y: 2.05, rx: Math.PI / 2 }));
    for (const s of [-1, 1]) {
      for (let k = 0; k < 5; k++) {
        c.add(mesh(box(0.06, 0.72, 0.66), glass, { x: s * 1.0, y: 1.66, z: -2.0 + k * 1.0 }));
        c.add(mesh(box(0.04, 0.86, 0.8), i % 2 ? red : cream, { x: s * 0.98, y: 1.6, z: -2.0 + k * 1.0 }));
      }
      c.add(mesh(box(0.05, 1.3, 0.7), mat('#5a4636', { rough: 0.8 }), { x: s * 1.01, y: 0.7, z: 2.4 }));
    }
    for (const s of [-1, 1]) {
      for (const z of [1.7, -1.7]) {
        const w = mesh(wheelGeo(0.36, 0.14), black, { x: s * 0.9, y: 0.32, z, rz: Math.PI / 2 });
        w.userData.radius = 0.36; wheels.push(w); c.add(w);
        c.add(mesh(box(0.3, 0.4, 1.3), mat('#3a3f44', { rough: 0.7 }), { x: s * 0.86, y: 0.3, z }));
      }
    }
    cars.push({ obj: c, offset: -8.6 - i * 5.9 });
  }
  return { cars, wheels };
}

/* ============================================================ 汽车 */
export function makeCar(rng, kind) {
  const g = group('car');
  const wheels = [];
  const bodyCol = rng.pick(['#c9553f', '#4a7fae', '#e8b23c', '#5f9c6a', '#e0e0d8', '#8a5ea8', '#d87f4a']);
  const body = mat(bodyCol, { rough: 0.42, metal: 0.32 });
  const dark = mat('#2b2f33', { rough: 0.6 });
  const glass = glowMat('#a8c8dd', '#ffe0a8', 1.2, { rough: 0.08, metal: 0.2 });
  const headM = glowMat('#fff6da', '#fff0c0', 3.4, { rough: 0.2, dayIntensity: 0.25 });
  const tailM = glowMat('#d84a3a', '#ff6a4a', 2.6, { rough: 0.3 });
  const chrome = mat('#c8ccd0', { metal: 0.85, rough: 0.22 });
  if (kind === 'bus') {
    g.add(mesh(roundedBox(2.0, 1.7, 5.6, 0.3), body, { y: 0.6 }));
    g.add(mesh(roundedBox(1.9, 0.5, 5.4, 0.24), mat('#f0e6d2', { rough: 0.6 }), { y: 2.2 }));
    g.add(mesh(box(2.04, 0.24, 5.5), mat('#f0e6d2', { rough: 0.6 }), { y: 1.5 }));
    for (const s of [-1, 1]) for (let k = 0; k < 4; k++) g.add(mesh(box(0.06, 0.62, 0.92), glass, { x: s * 1.01, y: 1.62, z: -1.8 + k * 1.2 }));
    g.add(mesh(box(1.5, 0.7, 0.06), glass, { y: 1.62, z: 2.82 }));
    g.add(mesh(box(1.5, 0.6, 0.06), glass, { y: 1.6, z: -2.82 }));
    for (const s of [-1, 1]) {
      g.add(mesh(sphere(0.13, 8, 6), headM, { x: s * 0.7, y: 0.85, z: 2.82 }));
      g.add(mesh(box(0.22, 0.14, 0.06), tailM, { x: s * 0.72, y: 0.9, z: -2.84 }));
      for (const z of [1.9, -1.7]) {
        const w = mesh(wheelGeo(0.44, 0.26), dark, { x: s * 1.0, y: 0.44, z, rz: Math.PI / 2 });
        w.userData.radius = 0.44; wheels.push(w); g.add(w);
        g.add(mesh(wheelGeo(0.2, 0.3), chrome, { x: s * 1.0, y: 0.44, z, rz: Math.PI / 2 }));
      }
    }
    g.userData.len = 5.6;
    return { group: g, wheels };
  }
  if (kind === 'truck') {
    g.add(mesh(roundedBox(1.9, 1.0, 2.0, 0.2), body, { y: 0.5, z: 1.3 }));
    g.add(mesh(roundedBox(1.7, 0.8, 1.7, 0.16), glass, { y: 1.42, z: 1.2 }));
    g.add(mesh(roundedBox(1.86, 0.16, 1.8), mat('#f0e6d2', { rough: 0.7 }), { y: 2.2, z: 1.2 }));
    g.add(mesh(box(1.9, 0.9, 3.0), mat('#a97f4f', { rough: 0.9 }), { y: 0.62, z: -1.1 }));
    for (let i = 0; i < 4; i++) g.add(mesh(box(1.94, 0.1, 0.1), mat('#7a5a3c', { rough: 0.9 }), { y: 0.8 + i * 0.22, z: -1.1 }));
    g.add(mesh(box(0.7, 0.5, 0.7), mat('#8a6a4a', { rough: 0.9 }), { y: 1.5, z: -1.6, ry: 0.4 }));
  } else {
    const long = kind === 'van' ? 2.4 : 1.9;
    g.add(mesh(roundedBox(1.86, 0.82, 4.3, 0.28), body, { y: 0.42 }));
    g.add(mesh(roundedBox(1.66, 0.78, long, 0.26), kind === 'van' ? body : glass, { y: 1.2, z: kind === 'van' ? -0.3 : -0.1 }));
    if (kind === 'van') {
      for (const s of [-1, 1]) g.add(mesh(box(0.05, 0.5, 1.2), glass, { x: s * 0.84, y: 1.32, z: -0.5 }));
      g.add(mesh(box(1.2, 0.52, 0.05), glass, { y: 1.32, z: 0.92 }));
    }
    g.add(mesh(box(1.9, 0.18, 4.34), chrome, { y: 0.34 }));
  }
  for (const s of [-1, 1]) {
    g.add(mesh(sphere(0.12, 8, 6), headM, { x: s * 0.6, y: 0.7, z: kind === 'truck' ? 2.3 : 2.14 }));
    g.add(mesh(box(0.2, 0.12, 0.06), tailM, { x: s * 0.66, y: 0.72, z: kind === 'truck' ? -2.62 : -2.14 }));
    for (const z of kind === 'truck' ? [1.7, -1.5] : [1.42, -1.4]) {
      const w = mesh(wheelGeo(0.4, 0.24), dark, { x: s * 0.94, y: 0.4, z, rz: Math.PI / 2 });
      w.userData.radius = 0.4; wheels.push(w); g.add(w);
      g.add(mesh(wheelGeo(0.18, 0.28), chrome, { x: s * 0.94, y: 0.4, z, rz: Math.PI / 2 }));
    }
  }
  g.userData.len = 4.3;
  return { group: g, wheels };
}

/* ============================================================ 船 */
function warpHull(geo, len, width, depth) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = p.getZ(i);
    const narrow = 1 - 0.78 * Math.pow(Math.max(0, t), 1.5) - 0.42 * Math.pow(Math.max(0, -t), 2.4);
    p.setX(i, p.getX(i) * narrow * (width / 2));
    p.setY(i, p.getY(i) * depth);
    p.setZ(i, t * (len / 2));
  }
  geo.computeVertexNormals();
  return geo;
}

export function makeBoat(kind, rng) {
  const g = group('boat');
  const hullCol = rng.pick(['#a8503c', '#3f6f8f', '#5f7f6a', '#8a6a4a', '#e0dcd0']);
  const hull = mat(hullCol, { rough: 0.7 });
  const deck = mat(PAL.wood, { rough: 0.85 });
  const dark = mat(PAL.woodDark, { rough: 0.88 });
  const white = mat('#f2ece0', { rough: 0.8 });
  const len = kind === 'sail' ? 5.6 : kind === 'fish' ? 4.6 : 2.8;
  const wid = kind === 'row' ? 1.2 : 1.9;
  const dep = kind === 'row' ? 0.4 : 0.62;
  const lower = new THREE.SphereGeometry(1, 18, 9, 0, TAU, Math.PI * 0.5, Math.PI * 0.5);
  g.add(mesh(warpHull(lower, len, wid, dep), hull, {}));
  const rim = new THREE.CircleGeometry(1, 20);
  rim.rotateX(-Math.PI / 2);
  const rimGeo = warpHull(rim, len * 0.99, wid * 0.99, 1);
  g.add(mesh(rimGeo, deck, { y: 0.01 }));
  const gun = new THREE.TorusGeometry(1, 0.055, 5, 30);
  gun.rotateX(Math.PI / 2);
  g.add(mesh(warpHull(gun, len, wid, 1), dark, { y: 0.06 }));
  if (kind === 'sail') {
    g.add(mesh(roundedBox(1.3, 0.62, 1.7, 0.18), white, { y: 0.06, z: -1.2 }));
    g.add(mesh(box(1.36, 0.1, 1.76), dark, { y: 0.68, z: -1.2 }));
    for (const s of [-1, 1]) g.add(mesh(box(0.06, 0.34, 0.5), glowMat('#bcd8ea', '#ffd28a', 2.2, { rough: 0.1 }), { x: s * 0.66, y: 0.24, z: -1.2 }));
    g.add(mesh(cyl(0.07, 0.1, 5.4, 8), dark, { y: 0.1, z: 0.4 }));
    g.add(mesh(box(0.08, 0.08, 2.3), dark, { y: 0.7, z: 1.3, rx: 0.06 }));
    // 主帆 + 前帆
    const sailGeo = new THREE.PlaneGeometry(2.4, 3.6, 6, 6);
    sailGeo.translate(1.2, 0, 0);
    const sailMat = clothMaterial('#f4efe2', { amp: 0.26, speed: 2.4, rough: 0.95 });
    const sail = mesh(sailGeo, sailMat, { y: 2.2, z: 0.5, ry: Math.PI / 2, cast: true });
    sail.name = 'sail';
    g.add(sail);
    const jibGeo = new THREE.PlaneGeometry(1.5, 2.4, 5, 5);
    jibGeo.translate(0.75, 0, 0);
    g.add(mesh(jibGeo, sailMat, { y: 1.7, z: 1.4, ry: -Math.PI / 2, cast: true }));
    const flagGeo = new THREE.PlaneGeometry(0.7, 0.34, 5, 2);
    flagGeo.translate(0.35, 0, 0);
    g.add(mesh(flagGeo, clothMaterial('#d8443a', { amp: 0.2, speed: 5 }), { y: 5.3, z: 0.42, cast: false }));
  } else if (kind === 'fish') {
    g.add(mesh(roundedBox(1.4, 1.1, 1.5, 0.16), white, { y: 0.1, z: -0.9 }));
    g.add(mesh(box(1.5, 0.14, 1.62), dark, { y: 1.2, z: -0.9 }));
    for (const s of [-1, 1]) g.add(mesh(box(0.05, 0.4, 0.62), glowMat('#bcd8ea', '#ffd28a', 2.2, { rough: 0.1 }), { x: s * 0.71, y: 0.62, z: -0.9 }));
    g.add(mesh(cyl(0.06, 0.08, 3.2, 6), dark, { y: 0.4, z: 0.3 }));
    g.add(mesh(box(0.06, 0.06, 1.6), dark, { y: 3.0, z: 0.3, rx: 0.3 }));
    for (let i = 0; i < 3; i++) g.add(mesh(sphere(0.1, 6, 5), mat('#e8b23c', { rough: 0.8 }), { x: rng.jitter(0.5), y: 0.16, z: 1.2 + i * 0.3 }));
    // 渔网
    const net = new THREE.PlaneGeometry(1.2, 1.0, 3, 3);
    g.add(mesh(net, mat('#b8b09c', { rough: 1, opacity: 0.75 }), { x: 0.7, y: 0.5, z: 0.8, ry: 0.6, cast: false }));
    g.add(mesh(sphere(0.12, 7, 6), glowMat('#f6e6c0', '#ffcf87', 3.0, { rough: 0.3 }), { y: 1.5, z: -0.9 }));
  } else {
    for (let i = 0; i < 2; i++) g.add(mesh(box(0.9, 0.07, 0.22), deck, { y: 0.14, z: -0.5 + i * 0.8 }));
    for (const s of [-1, 1]) {
      g.add(mesh(box(0.06, 0.06, 1.7), dark, { x: s * 0.72, y: 0.24, z: 0.1, rz: s * 0.3, ry: s * 0.2 }));
      g.add(mesh(box(0.16, 0.03, 0.42), dark, { x: s * 0.95, y: 0.06, z: 0.9, ry: s * 0.2 }));
    }
  }
  return g;
}

/* ============================================================ 行人 */
export function makePerson(rng) {
  const g = group('person');
  const skinCols = ['#e8c4a0', '#d8a878', '#b98a5f', '#8a6a4a', '#f0d8bc'];
  const shirtCols = ['#c9553f', '#4a7fae', '#5f9c6a', '#e8b23c', '#8a5ea8', '#e0e0d8', '#d87f4a', '#3f6f8f'];
  const pantCols = ['#3f4a5a', '#5a4636', '#2f3a42', '#6a5a4a', '#4a4f5a'];
  const skin = mat(rng.pick(skinCols), { rough: 0.85 });
  const shirt = mat(rng.pick(shirtCols), { rough: 0.88 });
  const pant = mat(rng.pick(pantCols), { rough: 0.9 });
  const hairCol = mat(rng.pick(['#3a2f26', '#5a4030', '#8a6a3a', '#2b2b2b', '#a89078']), { rough: 0.95 });
  const s = rng.range(0.86, 1.06);
  const skirt = rng.chance(0.35);
  const body = group('body', 0, 0, 0);
  body.scale.setScalar(s);
  // 腿
  const legs = [];
  for (const sx of [-1, 1]) {
    const pivot = group('legPivot', sx * 0.11, 0.78, 0);
    const geo = box(0.15, 0.78, 0.17);
    geo.translate(0, -0.78, 0);
    pivot.add(mesh(geo, pant, {}));
    const shoe = box(0.17, 0.1, 0.28);
    shoe.translate(0, -0.86, 0.04);
    pivot.add(mesh(shoe, mat('#3a3028', { rough: 0.9 }), {}));
    body.add(pivot);
    legs.push(pivot);
  }
  if (skirt) {
    body.add(mesh(cone(0.34, 0.5, 10), shirt, { y: 0.5 }));
  }
  // 躯干
  body.add(mesh(roundedBox(0.44, 0.62, 0.28, 0.12), shirt, { y: 0.78 }));
  body.add(mesh(roundedBox(0.4, 0.16, 0.26, 0.06), mat('#4a4038', { rough: 0.9 }), { y: 0.76 }));
  // 手臂
  const arms = [];
  for (const sx of [-1, 1]) {
    const pivot = group('armPivot', sx * 0.28, 1.32, 0);
    const geo = box(0.12, 0.56, 0.13);
    geo.translate(0, -0.56, 0);
    pivot.add(mesh(geo, shirt, {}));
    const hand = sphere(0.075, 6, 5);
    hand.translate(0, -0.62, 0);
    pivot.add(mesh(hand, skin, {}));
    body.add(pivot);
    arms.push(pivot);
  }
  // 头
  body.add(mesh(cyl(0.07, 0.08, 0.12, 8), skin, { y: 1.4 }));
  body.add(mesh(sphere(0.19, 12, 10), skin, { y: 1.68, sy: 1.1 }));
  const hairType = rng.int(0, 2);
  if (hairType === 0) body.add(mesh(sphere(0.2, 12, 8, 0, TAU, 0, Math.PI * 0.62), hairCol, { y: 1.7 }));
  else if (hairType === 1) {
    body.add(mesh(sphere(0.21, 12, 8, 0, TAU, 0, Math.PI * 0.55), hairCol, { y: 1.7 }));
    body.add(mesh(sphere(0.16, 10, 8), hairCol, { y: 1.62, z: -0.12, sy: 1.5 }));
  } else {
    body.add(mesh(cone(0.3, 0.22, 12), mat(rng.pick(['#c9553f', '#e8dcc0', '#4a7fae', '#5f7f6a']), { rough: 0.9 }), { y: 1.78 }));
    body.add(mesh(new THREE.TorusGeometry(0.26, 0.035, 5, 14), mat('#8a6a4a', { rough: 0.9 }), { y: 1.79, rx: Math.PI / 2 }));
  }
  if (rng.chance(0.25)) {
    // 背包
    body.add(mesh(roundedBox(0.3, 0.36, 0.16, 0.06), mat(rng.pick(['#8a5a3c', '#3f5a6a', '#5f7f4a']), { rough: 0.9 }), { y: 0.9, z: -0.2 }));
  }
  if (rng.chance(0.2)) {
    // 提篮
    const basket = group('basket', 0.3, 0.78, 0.1);
    basket.add(mesh(cyl(0.15, 0.13, 0.2, 8), mat('#b08a55', { rough: 0.95 }), {}));
    basket.add(mesh(new THREE.TorusGeometry(0.14, 0.02, 4, 10), mat('#8a6a4a', { rough: 0.9 }), { y: 0.22, rx: 0 }));
    body.add(basket);
  }
  g.add(body);
  g.userData.legs = legs;
  g.userData.arms = arms;
  g.userData.body = body;
  return g;
}

/* ============================================================ 热气球 */
export function makeBalloon(rng) {
  const g = group('balloon');
  const cols = [['#d8443a', '#f2ece0'], ['#3f6f9f', '#f6e6c0'], ['#4f9b6a', '#f2ece0'], ['#e8a13c', '#f6e6c0']];
  const [c1, c2] = rng.pick(cols);
  const profile = [[0.05, 0], [0.9, 0.5], [1.8, 1.5], [2.25, 2.9], [2.1, 4.3], [1.3, 5.3], [0.5, 5.7], [0.12, 5.85]];
  const gores = 10;
  for (let i = 0; i < gores; i++) {
    const geo = new THREE.LatheGeometry(
      profile.map((p) => new THREE.Vector2(p[0], p[1])), 4, (i / gores) * TAU, TAU / gores
    );
    geo.computeVertexNormals();
    g.add(mesh(geo, mat(i % 2 ? c1 : c2, { rough: 0.8, side: THREE.DoubleSide }), { y: 0.6 }));
  }
  const basket = group('basket', 0, -1.5, 0);
  basket.add(mesh(roundedBox(1.0, 0.8, 1.0, 0.12), mat('#b08a55', { rough: 0.95 }), {}));
  for (let i = 0; i < 3; i++) basket.add(mesh(new THREE.TorusGeometry(0.56, 0.03, 4, 12), mat('#8a6a4a', { rough: 0.9 }), { y: 0.2 + i * 0.26, rx: Math.PI / 2 }));
  basket.add(mesh(sphere(0.18, 8, 6), glowMat('#ffd9a0', '#ff9a4a', 3.6, { rough: 0.4, dayIntensity: 0.4 }), { y: 0.9 }));
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    basket.add(mesh(box(0.05, 1.5, 0.05), mat('#6f5540', { rough: 0.9 }), { x: sx * 0.44, y: 0.75, z: sz * 0.44, rx: -sz * 0.12, rz: sx * 0.12 }));
  }
  g.add(basket);
  return g;
}

/* ============================================================ 海鸥 */
export function makeBird(rng) {
  const g = group('bird');
  const c = mat(rng.chance(0.5) ? '#f2ece0' : '#dfe4e8', { rough: 0.85 });
  const dark = mat('#5a5f66', { rough: 0.8 });
  const bodyGeo = sphere(0.13, 8, 6);
  bodyGeo.scale(0.8, 0.8, 1.8);
  g.add(mesh(bodyGeo, c, { cast: false }));
  g.add(mesh(cone(0.05, 0.16, 5), mat('#e8a13c', { rough: 0.7 }), { z: 0.28, rx: Math.PI / 2, cast: false }));
  g.add(mesh(sphere(0.09, 7, 6), c, { z: 0.16, y: 0.05, cast: false }));
  g.add(mesh(box(0.06, 0.03, 0.28), dark, { z: -0.28, cast: false }));
  const wings = [];
  for (const s of [-1, 1]) {
    const pivot = group('wing', s * 0.08, 0.04, 0);
    const wg = new THREE.PlaneGeometry(0.62, 0.24, 3, 1);
    wg.translate((s * 0.62) / 2, 0, 0);
    const wm = mesh(wg, new THREE.MeshStandardMaterial({ color: 0xf2ece0, roughness: 0.85, side: THREE.DoubleSide }), { cast: false });
    pivot.add(wm);
    pivot.add(mesh(box(0.6, 0.03, 0.1), dark, { x: s * 0.3, z: -0.08, cast: false }));
    g.add(pivot);
    wings.push(pivot);
  }
  g.userData.wings = wings;
  return g;
}

/* ============================================================ 统一驱动 */
export function buildLife(scene, ctx) {
  const rng = new RNG(20240611);
  const root = group('life');
  scene.add(root);

  /* --- 火车 --- */
  const train = makeTrain();
  const railLen = ctx.railCurve.getLength();
  for (const c of train.cars) root.add(c.obj);
  const trainState = { u: 0.12, speed: 3.6 };

  /* --- 汽车 --- */
  const roadLen = ctx.roadCurve.getLength();
  const cars = [];
  const kinds = ['sedan', 'van', 'bus', 'truck', 'sedan', 'van'];
  for (let i = 0; i < 6; i++) {
    const dir = i < 4 ? 1 : -1;
    const c = makeCar(rng, kinds[i]);
    root.add(c.group);
    cars.push({
      ...c, u: (i / 6) + rng.range(0, 0.05), dir,
      speed: rng.range(2.4, 4.0) * (kinds[i] === 'bus' ? 0.8 : 1),
      lateral: dir > 0 ? 0.92 : -0.92,
    });
  }

  /* --- 船 --- */
  const seaRoute = makeSeaRoute();
  const sail = makeBoat('sail', rng);
  root.add(sail);
  const moored = [];
  for (const p of [
    { x: -3.4, z: 30.6, ry: 0.4, kind: 'fish' },
    { x: 5.2, z: 31.4, ry: -0.25, kind: 'fish' },
    { x: 10.6, z: 29.4, ry: 1.1, kind: 'row' },
    { x: -10.2, z: 15.2, ry: 0.6, kind: 'row' },
  ]) {
    const b = makeBoat(p.kind, rng);
    b.position.set(p.x, 0.1, p.z);
    b.rotation.y = p.ry;
    if (p.z < 20) b.position.y = ctx.riverSurfaceAt(p.x, p.z) - 0.1;
    root.add(b);
    moored.push({ obj: b, baseY: b.position.y, phase: rng.range(0, TAU) });
  }

  /* --- 行人 --- */
  const people = [];
  for (const path of WALK_PATHS) {
    const n = path.name === 'plaza' ? 5 : path.name === 'promenade' ? 4 : 2;
    for (let i = 0; i < n; i++) {
      const p = makePerson(rng);
      root.add(p);
      people.push({
        obj: p, pts: path.pts, t: rng.next(), dir: rng.chance(0.5) ? 1 : -1,
        speed: rng.range(0.5, 0.95) / polyLen(path.pts), phase: rng.range(0, TAU),
      });
    }
  }
  // 跟着行人的小狗
  const dog = makeDog(rng);
  root.add(dog);
  const dogHost = people[0];

  /* --- 热气球 --- */
  const balloon = makeBalloon(rng);
  root.add(balloon);

  /* --- 海鸥 --- */
  const birds = [];
  for (let i = 0; i < 9; i++) {
    const b = makeBird(rng);
    root.add(b);
    birds.push({
      obj: b, r: rng.range(9, 26), h: rng.range(9, 20), phase: rng.range(0, TAU),
      speed: rng.range(0.12, 0.24), cx: rng.range(-8, 6), cz: rng.range(4, 26), flap: rng.range(4, 7),
    });
  }

  const pos = new THREE.Vector3(), tan = new THREE.Vector3();

  function update(dt, elapsed, night) {
    /* 火车 */
    trainState.u = (trainState.u + (trainState.speed * dt) / railLen) % 1;
    for (const c of train.cars) {
      const u = (trainState.u + (c.offset || 0) / railLen + 1) % 1;
      ctx.railCurve.getPointAt(u, pos);
      ctx.railCurve.getTangentAt(u, tan);
      faceAlong(c.obj, pos, tan);
    }
    for (const w of train.wheels) w.rotation.x += (trainState.speed * dt) / (w.userData.radius || 0.4);

    /* 汽车 */
    for (const c of cars) {
      c.u = (c.u + (c.dir * c.speed * dt) / roadLen + 1) % 1;
      ctx.roadCurve.getPointAt(c.u, pos);
      ctx.roadCurve.getTangentAt(c.u, tan);
      const nx = tan.z, nz = -tan.x, nl = Math.hypot(nx, nz) || 1;
      const x = pos.x + (nx / nl) * c.lateral, z = pos.z + (nz / nl) * c.lateral;
      const y = baseHeight(x, z).h;
      V3.set(x, y + 0.02, z);
      V3B.copy(tan).multiplyScalar(c.dir);
      // 用前后取样求俯仰
      const u2 = (c.u + c.dir * 0.004 + 1) % 1;
      const p2 = ctx.roadCurve.getPointAt(u2);
      const y2 = baseHeight(p2.x, p2.z).h;
      V3B.y = (y2 - y) / 0.9;
      c.group.position.copy(V3);
      faceAlong(c.group, V3, V3B);
      for (const w of c.wheels) w.rotation.x += (c.speed * dt) / (w.userData.radius || 0.4);
    }

    /* 帆船 */
    const su = (elapsed * 0.0085) % 1;
    seaRoute.getPointAt(su, pos);
    seaRoute.getTangentAt(su, tan);
    pos.y = 0.12 + Math.sin(elapsed * 1.1) * 0.09;
    faceAlong(sail, pos, tan);
    sail.rotation.z += Math.sin(elapsed * 0.9) * 0.035;
    sail.rotation.x += Math.sin(elapsed * 1.3 + 1) * 0.02;

    for (const b of moored) {
      b.obj.position.y = b.baseY + Math.sin(elapsed * 1.3 + b.phase) * 0.055;
      b.obj.rotation.z = Math.sin(elapsed * 0.9 + b.phase) * 0.055;
      b.obj.rotation.x = Math.cos(elapsed * 1.1 + b.phase) * 0.04;
    }

    /* 行人 */
    for (const p of people) {
      p.t += p.dir * p.speed * dt;
      if (p.t > 1) { p.t = 1; p.dir = -1; }
      if (p.t < 0) { p.t = 0; p.dir = 1; }
      const a = samplePoly(p.pts, p.t);
      const b = samplePoly(p.pts, clamp(p.t + p.dir * 0.02, 0, 1));
      const y = groundHeight(a.x, a.z);
      p.obj.position.set(a.x, y, a.z);
      const dx = b.x - a.x, dz = b.z - a.z;
      if (Math.abs(dx) + Math.abs(dz) > 1e-4) p.obj.rotation.y = Math.atan2(dx, dz);
      const w = elapsed * 6.5 + p.phase;
      const legs = p.obj.userData.legs, arms = p.obj.userData.arms, body = p.obj.userData.body;
      legs[0].rotation.x = Math.sin(w) * 0.62;
      legs[1].rotation.x = -Math.sin(w) * 0.62;
      arms[0].rotation.x = -Math.sin(w) * 0.5;
      arms[1].rotation.x = Math.sin(w) * 0.5;
      body.position.y = Math.abs(Math.sin(w)) * 0.045;
      body.rotation.z = Math.sin(w) * 0.028;
    }

    /* 小狗跟着第一位行人 */
    if (dogHost) {
      const a = samplePoly(dogHost.pts, clamp(dogHost.t - dogHost.dir * 0.05, 0, 1));
      const ax = a.x + Math.sin(elapsed * 1.7) * 0.35, az = a.z + Math.cos(elapsed * 1.5) * 0.35;
      dog.position.set(ax, groundHeight(ax, az), az);
      dog.rotation.y = damp(dog.rotation.y, dogHost.obj.rotation.y + Math.sin(elapsed * 2) * 0.3, 4, dt);
      dog.position.y += Math.abs(Math.sin(elapsed * 8)) * 0.06;
    }

    /* 热气球 */    const bt = elapsed * 0.035;
    balloon.position.set(
      Math.sin(bt) * 22 - 4,
      17 + Math.sin(elapsed * 0.22) * 3.4,
      Math.cos(bt * 0.82) * 20 + 2
    );
    balloon.rotation.y = -bt * 1.4;
    balloon.rotation.z = Math.sin(elapsed * 0.4) * 0.045;

    /* 海鸥 */
    for (const b of birds) {
      b.phase += b.speed * dt;
      const x = b.cx + Math.cos(b.phase) * b.r;
      const z = b.cz + Math.sin(b.phase * 1.05) * b.r * 0.72;
      const y = b.h + Math.sin(b.phase * 2.2) * 1.4;
      V3.set(x, y, z);
      V3B.set(-Math.sin(b.phase) * b.r, Math.cos(b.phase * 2.2) * 1.4 * 0.4, Math.cos(b.phase * 1.05) * b.r * 0.72);
      faceAlong(b.obj, V3, V3B.normalize());
      const f = Math.sin(elapsed * b.flap + b.phase * 3) * 0.75;
      b.obj.userData.wings[0].rotation.z = f;
      b.obj.userData.wings[1].rotation.z = -f;
    }
  }

  return { root, update, train, cars, people, balloon, birds, sail };
}

function polyLen(pts) {
  let l = 0;
  for (let i = 0; i < pts.length - 1; i++) l += Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
  return Math.max(1, l);
}

function samplePoly(pts, t) {
  const total = polyLen(pts);
  let target = clamp(t, 0, 1) * total, acc = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const seg = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
    if (acc + seg >= target || i === pts.length - 2) {
      const k = clamp((target - acc) / seg, 0, 1);
      return { x: lerp(pts[i][0], pts[i + 1][0], k), z: lerp(pts[i][1], pts[i + 1][1], k) };
    }
    acc += seg;
  }
  return { x: pts[0][0], z: pts[0][1] };
}
