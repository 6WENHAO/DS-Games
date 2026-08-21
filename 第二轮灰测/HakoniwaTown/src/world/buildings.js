/**
 * 建筑工厂：住宅 / 店铺 / 教堂 / 钟楼 / 市政厅 / 车站 / 灯塔 / 风车 / 水磨 / 谷仓 …
 * 设计要点：基座—腰线—檐口—坡屋顶—烟囱—老虎窗层层收分，
 * 上层外挑（jetty）+ 多种屋顶形制，避免"方块堆砌"的观感。
 */
import * as THREE from 'three';
import {
  mat, glowMat, mesh, group, box, roundedBox, cyl, cone, sphere, lathe,
  gableRoof, gambrelRoof, hipRoof, pyramidRoof, archWall, railing, RNG, TAU, clamp, lerp,
} from '../lib/utils.js';

/* ------------------------------------------------------------ 调色板 */
export const PAL = {
  wall: ['#f0e6d2', '#e8d9bd', '#f2ddc4', '#dfe4d7', '#e3d2c3', '#efe3cf', '#dcd3c0', '#f4e7d3', '#e7dcc9', '#ecd9c6'],
  wallWarm: ['#e6c9a3', '#dfb894', '#e9d3b0', '#d9bfa0'],
  roof: ['#a8483a', '#95412f', '#b35540', '#7d5a4e', '#5f6b74', '#4f5d68', '#8c4636', '#6b4a3f', '#57707a'],
  roofSlate: ['#4a5560', '#3f4a55', '#55616b'],
  trim: ['#8a6a4a', '#6f5540', '#9a7a55', '#7a6248'],
  timber: '#6b4a33',
  stone: '#a79c89',
  stoneDark: '#8c8271',
  wood: '#9c7048',
  woodDark: '#6f4f34',
  metal: '#8d949c',
  copper: '#5f9e86',
  awning: [['#c9553f', '#f3e5d0'], ['#3f6f8f', '#f3e5d0'], ['#4f8b5a', '#f7ecd8'], ['#c9a23f', '#f7ecd8']],
};

export const GLASS = () => glowMat('#bcd8ea', '#ffca7a', 2.1, { rough: 0.1, metal: 0.1, nightBase: '#4a3a24' });
export const GLASS_BIG = () => glowMat('#c8e0ee', '#ffd490', 1.6, { rough: 0.08, metal: 0.1, nightBase: '#54432a' });
export const LANTERN = () => glowMat('#f6e6c0', '#ffd28a', 3.2, { rough: 0.3 });
export const SIGN_GLOW = () => glowMat('#f2e2c4', '#ffb765', 2.4, { rough: 0.5 });

/* ------------------------------------------------------------ 通用构件 */

function windowUnit(parent, x, ySill, dist, o) {
  const ww = o.ww ?? 0.82, wh = o.wh ?? 1.22;
  parent.add(mesh(box(ww + 0.2, wh + 0.22, 0.12), o.trim, { x, y: ySill - 0.08, z: dist - 0.03 }));
  parent.add(mesh(box(ww, wh, 0.1), o.glass, { x, y: ySill, z: dist + 0.02 }));
  parent.add(mesh(box(ww + 0.4, 0.11, 0.3), o.trim, { x, y: ySill - 0.19, z: dist - 0.02 }));
  if (o.arch) {
    const a = new THREE.CylinderGeometry(ww / 2 + 0.1, ww / 2 + 0.1, 0.12, 12, 1, false, 0, Math.PI);
    a.rotateX(Math.PI / 2);
    parent.add(mesh(a, o.trim, { x, y: ySill + wh + 0.14, z: dist - 0.03, rz: 0 }));
    const gd = new THREE.CylinderGeometry(ww / 2, ww / 2, 0.1, 12, 1, false, 0, Math.PI);
    gd.rotateX(Math.PI / 2);
    parent.add(mesh(gd, o.glass, { x, y: ySill + wh + 0.13, z: dist + 0.02 }));
  }
  if (o.shutters) {
    for (const s of [-1, 1]) {
      parent.add(mesh(box(0.22, wh + 0.1, 0.07), o.shutter, { x: x + s * (ww / 2 + 0.16), y: ySill - 0.03, z: dist + 0.05, ry: s * 0.14 }));
    }
  }
  if (o.flowerBox) {
    parent.add(mesh(roundedBox(ww + 0.24, 0.2, 0.26, 0.05), o.trim, { x, y: ySill - 0.28, z: dist + 0.06 }));
    for (let i = 0; i < 3; i++) {
      parent.add(mesh(sphere(0.12, 7, 5), o.flower, { x: x - 0.24 + i * 0.24, y: ySill - 0.06, z: dist + 0.14, sy: 0.8 }));
    }
  }
}

function doorUnit(parent, x, dist, o) {
  parent.add(mesh(box(1.28, 2.16, 0.16), o.trim, { x, y: 0, z: dist - 0.04 }));
  parent.add(mesh(box(1.02, 1.98, 0.12), o.door, { x, y: 0, z: dist + 0.03 }));
  parent.add(mesh(sphere(0.06, 6, 5), mat(PAL.metal, { metal: 0.8, rough: 0.35 }), { x: x + 0.34, y: 1.05, z: dist + 0.11 }));
  // 门前踏步
  parent.add(mesh(box(1.7, 0.14, 0.5), o.stone, { x, y: -0.14, z: dist + 0.22 }));
  parent.add(mesh(box(2.0, 0.14, 0.72), o.stone, { x, y: -0.28, z: dist + 0.32 }));
  if (o.canopy) {
    parent.add(mesh(box(1.9, 0.12, 0.72), o.trim, { x, y: 2.34, z: dist + 0.3, rx: -0.16 }));
    for (const s of [-1, 1]) parent.add(mesh(box(0.09, 0.09, 0.8), o.trim, { x: x + s * 0.8, y: 2.28, z: dist + 0.3, rx: 0.7 }));
  }
  if (o.lamp) parent.add(mesh(sphere(0.14, 8, 6), o.lantern, { x, y: 2.5, z: dist + 0.16 }));
}

function shopFront(parent, span, dist, o, rng) {
  const w = Math.min(span - 0.9, 2.9);
  parent.add(mesh(box(w + 0.24, 1.72, 0.14), o.trim, { x: -0.35, y: 0.42, z: dist - 0.03 }));
  parent.add(mesh(box(w, 1.5, 0.1), o.bigGlass, { x: -0.35, y: 0.52, z: dist + 0.03 }));
  parent.add(mesh(box(w + 0.5, 0.16, 0.36), o.trim, { x: -0.35, y: 0.26, z: dist }));
  doorUnit(parent, span / 2 - 0.75, dist, { ...o, canopy: false, lamp: true });
  // 条纹雨棚
  const [c1, c2] = rng.pick(PAL.awning);
  const stripes = 7, sw = (w + 0.9) / stripes;
  for (let i = 0; i < stripes; i++) {
    parent.add(mesh(box(sw * 0.98, 0.09, 1.15), mat(i % 2 ? c1 : c2, { rough: 0.85 }), {
      x: -0.35 - (w + 0.9) / 2 + sw * (i + 0.5), y: 2.34, z: dist + 0.52, rx: -0.34,
    }));
  }
  parent.add(mesh(box(w + 0.95, 0.1, 0.1), o.trim, { x: -0.35, y: 2.14, z: dist + 1.06 }));
  for (const s of [-1, 1]) parent.add(mesh(box(0.08, 0.5, 0.08), o.trim, { x: -0.35 + s * (w + 0.9) / 2, y: 2.1, z: dist + 1.02 }));
  // 招牌
  parent.add(mesh(box(0.1, 0.62, 1.0), o.trim, { x: span / 2 - 0.1, y: 2.5, z: dist + 0.1, ry: Math.PI / 2 }));
  parent.add(mesh(box(0.06, 0.5, 0.86), o.sign, { x: span / 2 - 0.16, y: 2.56, z: dist + 0.1, ry: Math.PI / 2 }));
}

function timberFrame(parent, span, height, dist, o, rng) {
  const t = mat(PAL.timber, { rough: 0.9 });
  parent.add(mesh(box(span, 0.16, 0.1), t, { x: 0, y: 0.02, z: dist + 0.02 }));
  parent.add(mesh(box(span, 0.18, 0.1), t, { x: 0, y: height - 0.2, z: dist + 0.02 }));
  const bays = Math.max(2, Math.round(span / 1.15));
  for (let i = 0; i <= bays; i++) {
    const x = -span / 2 + (span * i) / bays;
    parent.add(mesh(box(0.14, height - 0.2, 0.1), t, { x, y: 0.1, z: dist + 0.02 }));
  }
  for (let i = 0; i < bays; i++) {
    if (!rng.chance(0.55)) continue;
    const x = -span / 2 + (span * (i + 0.5)) / bays;
    const len = Math.hypot(span / bays, height - 0.5);
    parent.add(mesh(box(0.11, len, 0.09), t, {
      x, y: 0.2, z: dist + 0.02, rz: (rng.chance(0.5) ? 1 : -1) * Math.atan2(span / bays, height - 0.5),
    }));
  }
}

function chimney(parent, x, z, baseY, h, o, rng) {
  const w = 0.44 + rng.range(0, 0.16);
  parent.add(mesh(roundedBox(w, h, w, 0.05), o.brick, { x, y: baseY, z }));
  parent.add(mesh(box(w + 0.22, 0.14, w + 0.22), o.stone, { x, y: baseY + h, z }));
  parent.add(mesh(box(w * 0.42, 0.16, w * 0.42), mat('#3a3430', { rough: 1 }), { x: x - w * 0.2, y: baseY + h + 0.14, z }));
  parent.add(mesh(box(w * 0.42, 0.22, w * 0.42), mat('#3a3430', { rough: 1 }), { x: x + w * 0.2, y: baseY + h + 0.14, z }));
  return { x, y: baseY + h + 0.32, z };
}

function dormer(parent, x, roofY, dist, o) {
  const g = group('dormer', x, roofY, dist);
  g.add(mesh(roundedBox(0.95, 0.85, 0.9, 0.06), o.wall, { y: 0 }));
  g.add(mesh(gableRoof(0.95, 0.9, 0.42, 0.14), o.roof, { y: 0.85, ry: 0 }));
  g.add(mesh(box(0.5, 0.62, 0.08), o.glass, { y: 0.16, z: 0.47 }));
  g.add(mesh(box(0.62, 0.08, 0.16), o.trim, { y: 0.1, z: 0.5 }));
  parent.add(g);
  return g;
}

function shingleRows(parent, w, d, h, roofMat, ridgeAlongX = true) {
  const rows = 4;
  const slope = Math.hypot(d / 2, h);
  for (let s of [-1, 1]) {
    for (let i = 0; i < rows; i++) {
      const t = (i + 0.5) / rows;
      const y = h * (1 - t);
      const z = s * (d / 2) * t;
      const ang = Math.atan2(h, d / 2) * -s;
      parent.add(mesh(box(w + 0.5, 0.05, slope / rows * 0.92), roofMat, {
        x: 0, y: y + 0.035, z, rx: ang,
      }));
    }
  }
}

function roofGeo(kind, w, d, h, overhang) {
  switch (kind) {
    case 'hip': return hipRoof(w, d, h, 0.42, overhang);
    case 'gambrel': return gambrelRoof(w, d, h, overhang);
    case 'pyramid': return pyramidRoof(w, d, h, overhang);
    case 'flat': return box(w + overhang, 0.22, d + overhang);
    default: return gableRoof(w, d, h, overhang);
  }
}

/* ------------------------------------------------------------ 通用房屋 */
/**
 * @returns {{group: THREE.Group, chimneys: Array, height: number}}
 */
export function makeHouse(o = {}) {
  const rng = o.rng ?? new RNG(7);
  const w = o.w ?? rng.range(3.6, 5.4);
  const d = o.d ?? rng.range(3.2, 4.6);
  const floors = o.floors ?? rng.int(1, 3);
  const fh = o.floorH ?? rng.range(2.3, 2.75);
  const jetty = o.jetty ?? (rng.chance(0.35) ? rng.range(0.18, 0.42) : 0);
  const roofKind = o.roofKind ?? rng.pick(['gable', 'gable', 'hip', 'gambrel', 'gable']);
  const ridgeAlongZ = o.ridgeAlongZ ?? (d > w * 1.15);

  const g = group(o.name ?? 'house');
  const M = {
    wall: mat(o.wall ?? rng.pick(PAL.wall), { rough: 0.93 }),
    wall2: mat(o.wall2 ?? o.wall ?? rng.pick(PAL.wallWarm), { rough: 0.93 }),
    roof: mat(o.roof ?? rng.pick(PAL.roof), { rough: 0.8 }),
    trim: mat(o.trim ?? rng.pick(PAL.trim), { rough: 0.85 }),
    stone: mat(o.stone ?? PAL.stone, { rough: 0.95 }),
    brick: mat(o.brick ?? '#a5644f', { rough: 0.95 }),
    door: mat(o.doorColor ?? rng.pick(['#5a7f6b', '#7a4b3c', '#4a5f7f', '#8a6a3a', '#6b4a5f']), { rough: 0.7 }),
    glass: GLASS(),
    bigGlass: GLASS_BIG(),
    shutter: mat(o.shutterColor ?? rng.pick(['#5f7f6a', '#7a5a45', '#4a6480', '#8a6a45']), { rough: 0.8 }),
    lantern: LANTERN(),
    sign: SIGN_GLOW(),
    flower: mat(rng.pick(['#d9576a', '#e0a13c', '#c96fa8', '#e3e0a0']), { rough: 0.8 }),
  };

  // 基座
  g.add(mesh(roundedBox(w + 0.42, 0.4, d + 0.42, 0.1), M.stone, { y: -0.16 }));
  let y = 0.24;
  const chimneys = [];
  for (let f = 0; f < floors; f++) {
    const ex = jetty * f;
    const fw = w + ex, fd = d + ex;
    const wallMat = f === 0 && o.stoneGround ? M.stone : (f % 2 && o.twoTone ? M.wall2 : M.wall);
    g.add(mesh(roundedBox(fw, fh, fd, 0.16), wallMat, { y }));
    // 腰线 / 挑檐
    g.add(mesh(box(fw + (f < floors - 1 ? jetty * 2 + 0.2 : 0.2), 0.16, fd + (f < floors - 1 ? jetty * 2 + 0.2 : 0.2)), M.trim, { y: y + fh - 0.08 }));
    if (o.timber && f > 0) {
      for (const face of faceList(fw, fd)) {
        const sub = group('tf'); sub.rotation.y = face.ry; g.add(sub);
        sub.position.y = y;
        timberFrame(sub, face.span - 0.3, fh - 0.1, face.dist, M, rng);
      }
    }
    // 窗
    for (const face of faceList(fw, fd)) {
      const sub = group('face'); sub.rotation.y = face.ry; sub.position.y = y; g.add(sub);
      const isFront = Math.abs(face.ry) < 0.01;
      const count = Math.max(1, Math.floor((face.span - 0.5) / 1.5));
      if (f === 0 && isFront && o.shop) { shopFront(sub, face.span, face.dist, M, rng); continue; }
      for (let i = 0; i < count; i++) {
        const x = -face.span / 2 + (face.span * (i + 0.5)) / count;
        if (f === 0 && isFront && count > 1 && i === Math.floor(count / 2)) continue;
        if (f === 0 && isFront && count === 1) continue;
        if (!isFront && rng.chance(0.18)) continue;
        windowUnit(sub, x, 0.72, face.dist, {
          ...M, shutters: o.shutters ?? rng.chance(0.5), arch: o.archWindows && f === 0,
          flowerBox: f > 0 && rng.chance(0.35), ww: o.ww, wh: o.wh,
        });
      }
      if (f === 0 && isFront && !o.shop) {
        doorUnit(sub, count > 1 ? 0 : 0, face.dist, { ...M, canopy: rng.chance(0.6), lamp: rng.chance(0.7) });
      }
    }
    y += fh;
  }
  // 檐口
  g.add(mesh(box(w + jetty * (floors - 1) * 2 + 0.4, 0.2, d + jetty * (floors - 1) * 2 + 0.4), M.trim, { y: y - 0.1 }));

  const tw = w + jetty * (floors - 1), td = d + jetty * (floors - 1);
  const rh = o.roofH ?? (roofKind === 'flat' ? 0.2 : Math.min(tw, td) * rng.range(0.5, 0.72));
  const rg = group('roof', 0, y, 0);
  if (ridgeAlongZ) rg.rotation.y = Math.PI / 2;
  const rw = ridgeAlongZ ? td : tw, rd = ridgeAlongZ ? tw : td;
  rg.add(mesh(roofGeo(roofKind, rw, rd, rh, o.overhang ?? 0.34), M.roof, {}));
  if (roofKind === 'gable' || roofKind === 'hip') {
    shingleRows(rg, rw, rd + 0.5, rh, mat(o.roofTile ?? o.roof ?? '#8f3f30', { rough: 0.85 }));
    rg.add(mesh(box(rw + 0.7, 0.13, 0.26), M.trim, { y: rh - 0.02 }));
  }
  g.add(rg);
  // 老虎窗
  const dormers = o.dormers ?? (floors >= 2 && rh > 1.1 && rng.chance(0.55) ? rng.int(1, 2) : 0);
  for (let i = 0; i < dormers; i++) {
    const dx = dormers === 1 ? 0 : -0.9 + i * 1.8;
    const sub = group('dm'); sub.rotation.y = ridgeAlongZ ? Math.PI / 2 : 0; g.add(sub);
    dormer(sub, dx, y + rh * 0.32, (ridgeAlongZ ? tw : td) / 2 * 0.55, M);
  }
  // 烟囱
  const nCh = o.chimneys ?? rng.int(1, 2);
  for (let i = 0; i < nCh; i++) {
    const cx = (i === 0 ? -1 : 1) * tw * rng.range(0.18, 0.34);
    const cz = td * rng.range(-0.2, 0.2);
    chimneys.push(chimney(g, cx, cz, y + rh * 0.35, rng.range(0.9, 1.5), M, rng));
  }
  // 阳台
  if (o.balcony) {
    const by = 0.24 + fh * (floors - 1) + 0.1;
    g.add(mesh(box(w * 0.7, 0.14, 1.0), M.trim, { y: by, z: td / 2 + 0.4 }));
    const rl = railing(w * 0.7, 0.52, 0.34, 0.06);
    g.add(mesh(rl, M.trim, { y: by + 0.14, z: td / 2 + 0.88 }));
    for (const s of [-1, 1]) g.add(mesh(railing(1.0, 0.52, 0.34, 0.06), M.trim, { y: by + 0.14, z: td / 2 + 0.4, x: s * w * 0.35, ry: Math.PI / 2 }));
    for (const s of [-1, 1]) g.add(mesh(box(0.12, 0.7, 0.12), M.trim, { x: s * w * 0.3, y: by - 0.7, z: td / 2 + 0.8, rz: s * 0.2 }));
  }
  g.userData.height = y + rh;
  return { group: g, chimneys, height: y + rh, roofY: y };
}

function faceList(fw, fd) {
  return [
    { ry: 0, dist: fd / 2, span: fw },
    { ry: Math.PI, dist: fd / 2, span: fw },
    { ry: Math.PI / 2, dist: fw / 2, span: fd },
    { ry: -Math.PI / 2, dist: fw / 2, span: fd },
  ];
}

/* ------------------------------------------------------------ 教堂 */
export function makeChurch(rng = new RNG(33)) {
  const g = group('church');
  const M = {
    stone: mat('#d6cdb6', { rough: 0.92 }),
    stone2: mat('#c2b8a0', { rough: 0.94 }),
    roof: mat('#4c5a66', { rough: 0.7 }),
    trim: mat('#9a8f78', { rough: 0.85 }),
    glass: glowMat('#7fa8c9', '#ffbe6a', 2.6, { rough: 0.1 }),
    rose: glowMat('#8fb4d4', '#ffd08a', 3.0, { rough: 0.1 }),
    metal: mat(PAL.copper, { metal: 0.5, rough: 0.4 }),
    gold: mat('#d8b44a', { metal: 0.85, rough: 0.3 }),
  };
  const chimneys = [];
  // 中殿
  const NW = 6.4, ND = 12.4, NH = 6.2;
  g.add(mesh(roundedBox(NW + 0.5, 0.5, ND + 0.5, 0.12), M.stone2, { y: -0.2 }));
  g.add(mesh(roundedBox(NW, NH, ND, 0.18), M.stone, { y: 0.2 }));
  g.add(mesh(box(NW + 0.4, 0.24, ND + 0.4), M.trim, { y: NH + 0.1 }));
  const nr = group('naveRoof', 0, NH + 0.34, 0); nr.rotation.y = Math.PI / 2;
  nr.add(mesh(gableRoof(ND, NW, 3.1, 0.4), M.roof, {}));
  shingleRows(nr, ND, NW + 0.6, 3.1, mat('#3f4c58', { rough: 0.7 }));
  nr.add(mesh(box(ND + 0.8, 0.16, 0.3), M.metal, { y: 3.1 }));
  g.add(nr);
  // 扶壁 + 高窗
  for (const s of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      const z = -ND / 2 + 1.6 + i * 2.4;
      g.add(mesh(box(0.5, NH * 0.82, 0.7), M.stone2, { x: s * (NW / 2 + 0.2), y: 0.2, z }));
      g.add(mesh(box(0.62, 0.4, 0.85), M.trim, { x: s * (NW / 2 + 0.2), y: NH * 0.82, z, rz: s * 0.5 }));
      const sub = group('cw'); sub.rotation.y = s * Math.PI / 2; g.add(sub);
      windowUnit(sub, z * -s, 2.1, NW / 2, { ...M, ww: 0.7, wh: 2.4, arch: true, trim: M.trim });
    }
  }
  // 耳堂
  const TW = 10.6, TD = 4.2;
  g.add(mesh(roundedBox(TW, NH - 0.4, TD, 0.18), M.stone, { y: 0.2, z: -1.4 }));
  const tr = group('transRoof', 0, NH - 0.1, -1.4);
  tr.add(mesh(gableRoof(TW, TD, 2.0, 0.38), M.roof, {}));
  g.add(tr);
  for (const s of [-1, 1]) {
    const sub = group('tw'); sub.rotation.y = s * Math.PI / 2; sub.position.z = -1.4; g.add(sub);
    windowUnit(sub, 0, 1.8, TW / 2, { ...M, ww: 1.0, wh: 2.2, arch: true, trim: M.trim });
  }
  // 后殿（半圆）
  const apse = new THREE.CylinderGeometry(2.5, 2.5, 5.4, 16, 1, false, -Math.PI / 2, Math.PI);
  apse.translate(0, 2.7, 0);
  g.add(mesh(apse, M.stone, { y: 0.2, z: -ND / 2 - 0.1, ry: Math.PI }));
  const apseRoof = new THREE.ConeGeometry(2.8, 1.9, 16, 1, false, -Math.PI / 2, Math.PI);
  g.add(mesh(apseRoof, M.roof, { y: 6.9, z: -ND / 2 - 0.1, ry: Math.PI }));
  // 正面山墙 + 玫瑰窗 + 门廊
  g.add(mesh(box(NW + 0.3, 3.0, 0.55), M.stone2, { y: NH, z: ND / 2 + 0.1 }));
  const rose = new THREE.TorusGeometry(1.05, 0.14, 6, 22);
  g.add(mesh(rose, M.trim, { y: NH + 1.5, z: ND / 2 + 0.42, rx: 0 }));
  g.add(mesh(new THREE.CircleGeometry(1.0, 20), M.rose, { y: NH + 1.5, z: ND / 2 + 0.4 }));
  for (let i = 0; i < 6; i++) g.add(mesh(new THREE.BoxGeometry(0.09, 2.0, 0.1), M.trim, { y: NH + 1.5, z: ND / 2 + 0.44, rz: (i * Math.PI) / 6 }));
  const porch = group('porch', 0, 0.2, ND / 2 + 0.3);
  porch.add(mesh(archWall(3.4, 4.4, 1.2, 1.9, 3.2), M.stone2, { z: 0.6 }));
  porch.add(mesh(gableRoof(3.6, 1.6, 1.1, 0.3), M.roof, { y: 4.4, z: 0.6 }));
  porch.add(mesh(box(4.2, 0.2, 1.4), M.stone2, { y: -0.2, z: 1.0 }));
  porch.add(mesh(box(4.6, 0.18, 1.7), M.stone2, { y: -0.38, z: 1.2 }));
  g.add(porch);
  // 钟塔
  const TWD = 3.6, TH = 15.5;
  const tower = group('tower', -NW / 2 - 1.5, 0, ND / 2 - 1.2);
  tower.add(mesh(roundedBox(TWD + 0.6, 0.6, TWD + 0.6, 0.12), M.stone2, { y: -0.25 }));
  tower.add(mesh(roundedBox(TWD, TH, TWD, 0.2), M.stone, { y: 0.2 }));
  for (let i = 1; i <= 3; i++) tower.add(mesh(box(TWD + 0.24, 0.16, TWD + 0.24), M.trim, { y: 0.2 + i * 3.6 }));
  for (const face of faceList(TWD, TWD)) {
    const sub = group('tf2'); sub.rotation.y = face.ry; tower.add(sub);
    windowUnit(sub, 0, 4.4, face.dist, { ...M, ww: 0.6, wh: 1.5, arch: true, trim: M.trim });
    // 钟室百叶
    sub.add(mesh(box(1.1, 1.9, 0.14), M.trim, { y: TH - 3.0, z: face.dist - 0.02 }));
    for (let i = 0; i < 5; i++) sub.add(mesh(box(0.95, 0.14, 0.2), M.stone2, { y: TH - 2.9 + i * 0.36, z: face.dist + 0.04, rx: 0.4 }));
  }
  tower.add(mesh(box(TWD + 0.7, 0.3, TWD + 0.7), M.trim, { y: TH - 0.7 }));
  // 八角尖顶
  const spire = cone(TWD * 0.8, 6.6, 8);
  tower.add(mesh(spire, M.roof, { y: TH - 0.4, ry: Math.PI / 8 }));
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    tower.add(mesh(cone(0.28, 1.5, 6), M.stone2, { x: sx * TWD * 0.46, y: TH - 0.4, z: sz * TWD * 0.46 }));
  }
  tower.add(mesh(cyl(0.09, 0.09, 1.2, 6), M.gold, { y: TH + 6.2 }));
  const vane = group('vane', 0, TH + 7.2, 0);
  vane.userData.keep = true;
  vane.userData.spin = 0.25;
  vane.add(mesh(box(1.0, 0.5, 0.05), M.gold, { x: 0.2 }));
  vane.add(mesh(box(0.5, 0.05, 0.05), M.gold, { x: -0.45 }));
  vane.add(mesh(sphere(0.13, 8, 6), M.gold, { y: -0.42 }));
  tower.add(vane);
  g.add(tower);
  return { group: g, chimneys: [], height: TH + 8, spinners: [vane] };
}

/* ------------------------------------------------------------ 钟楼（指针跟随时间） */
export function makeClockTower() {
  const g = group('clockTower');
  const M = {
    stone: mat('#cfc4ab', { rough: 0.92 }),
    stone2: mat('#b6a98f', { rough: 0.94 }),
    trim: mat('#8f8069', { rough: 0.88 }),
    roof: mat('#3f5a5f', { rough: 0.6, metal: 0.25 }),
    face: glowMat('#f6efdc', '#ffe0a8', 2.2, { rough: 0.4 }),
    hand: mat('#2b2b2b', { rough: 0.5 }),
    gold: mat('#d8b44a', { metal: 0.85, rough: 0.28 }),
    glass: glowMat('#9dc0d8', '#ffc978', 2.2, { rough: 0.12 }),
  };
  const W = 4.0, H = 13.0;
  g.add(mesh(roundedBox(W + 1.0, 0.7, W + 1.0, 0.16), M.stone2, { y: -0.3 }));
  g.add(mesh(roundedBox(W + 0.5, 1.4, W + 0.5, 0.14), M.stone2, { y: 0.3 }));
  g.add(mesh(roundedBox(W, H, W, 0.2), M.stone, { y: 1.6 }));
  for (let i = 1; i <= 3; i++) g.add(mesh(box(W + 0.26, 0.18, W + 0.26), M.trim, { y: 1.6 + i * 3.2 }));
  const hands = [];
  for (const face of faceList(W, W)) {
    const sub = group('cf'); sub.rotation.y = face.ry; g.add(sub);
    windowUnit(sub, 0, 3.0, face.dist, { ...M, ww: 0.66, wh: 1.6, arch: true });
    // 钟面
    const y = 1.6 + H - 2.6;
    sub.add(mesh(new THREE.CylinderGeometry(1.16, 1.16, 0.2, 24), M.trim, { y, z: face.dist - 0.02, rx: Math.PI / 2 }));
    sub.add(mesh(new THREE.CircleGeometry(1.02, 24), M.face, { y, z: face.dist + 0.1 }));
    for (let i = 0; i < 12; i++) {
      sub.add(mesh(box(0.07, 0.18, 0.03), M.hand, {
        x: Math.sin((i / 12) * TAU) * 0.84, y: y + Math.cos((i / 12) * TAU) * 0.84 - 0.09, z: face.dist + 0.12,
        rz: -(i / 12) * TAU,
      }));
    }
    const hub = group('hands', 0, y, face.dist + 0.16);
    hub.userData.keep = true;
    const hh = group('hour'); const mm = group('minute');
    hh.add(mesh(box(0.1, 0.62, 0.04), M.hand, { y: 0 }));
    mm.add(mesh(box(0.07, 0.92, 0.04), M.hand, { y: 0 }));
    hub.add(hh); hub.add(mm);
    hub.add(mesh(sphere(0.08, 8, 6), M.gold, { z: 0.03 }));
    hub.userData.clock = { hour: hh, minute: mm };
    sub.add(hub);
    hands.push(hub);
  }
  g.add(mesh(box(W + 0.9, 0.34, W + 0.9), M.trim, { y: 1.6 + H - 0.5 }));
  // 钟亭
  const bel = group('belfry', 0, 1.6 + H - 0.2, 0);
  bel.add(mesh(cyl(1.5, 1.7, 2.1, 8), M.stone2, {}));
  for (let i = 0; i < 8; i++) {
    bel.add(mesh(box(0.2, 2.0, 0.2), M.trim, { x: Math.sin((i / 8) * TAU) * 1.5, z: Math.cos((i / 8) * TAU) * 1.5 }));
  }
  bel.add(mesh(sphere(0.55, 10, 8), M.gold, { y: 1.0, sy: 0.9 }));
  bel.add(mesh(cone(2.0, 2.6, 8), M.roof, { y: 2.1, ry: Math.PI / 8 }));
  bel.add(mesh(cyl(0.07, 0.07, 1.3, 6), M.gold, { y: 4.6 }));
  bel.add(mesh(sphere(0.16, 8, 6), M.gold, { y: 5.9 }));
  g.add(bel);
  return { group: g, height: 1.6 + H + 6.5, clocks: hands, chimneys: [] };
}

/* ------------------------------------------------------------ 市政厅（穹顶 + 柱廊） */
export function makeTownHall() {
  const g = group('townHall');
  const M = {
    wall: mat('#efe4cc', { rough: 0.9 }),
    stone: mat('#cdc2a8', { rough: 0.92 }),
    trim: mat('#a3957a', { rough: 0.86 }),
    roof: mat('#5c6b73', { rough: 0.7 }),
    dome: mat('#6aa88f', { rough: 0.42, metal: 0.35 }),
    gold: mat('#d8b44a', { metal: 0.85, rough: 0.3 }),
    glass: glowMat('#a8c8dd', '#ffcc84', 2.0, { rough: 0.1 }),
  };
  const W = 11.0, D = 6.2, H = 6.4;
  g.add(mesh(roundedBox(W + 0.8, 0.6, D + 0.8, 0.14), M.stone, { y: -0.25 }));
  g.add(mesh(roundedBox(W, H, D, 0.2), M.wall, { y: 0.3 }));
  g.add(mesh(box(W + 0.5, 0.3, D + 0.5), M.trim, { y: H + 0.1 }));
  g.add(mesh(hipRoof(W, D, 1.9, 0.5, 0.42), M.roof, { y: H + 0.4 }));
  // 二层窗（带三角楣）
  for (const face of faceList(W, D)) {
    const sub = group('thf'); sub.rotation.y = face.ry; g.add(sub);
    const count = Math.max(2, Math.floor(face.span / 2.2));
    for (let i = 0; i < count; i++) {
      const x = -face.span / 2 + (face.span * (i + 0.5)) / count;
      windowUnit(sub, x, 3.9, face.dist, { ...M, ww: 0.9, wh: 1.6 });
      sub.add(mesh(box(1.4, 0.14, 0.34), M.trim, { x, y: 5.66, z: face.dist }));
      if (Math.abs(face.ry) < 0.01) windowUnit(sub, x, 1.1, face.dist, { ...M, ww: 0.9, wh: 1.9, arch: true });
    }
  }
  // 柱廊
  const por = group('portico', 0, 0.3, D / 2 + 1.2);
  por.add(mesh(box(6.8, 0.5, 2.6), M.stone, { y: -0.5 }));
  por.add(mesh(box(7.2, 0.22, 3.0), M.stone, { y: -0.72 }));
  for (let i = 0; i < 5; i++) {
    const x = -2.6 + i * 1.3;
    por.add(mesh(cyl(0.26, 0.3, 4.4, 12), M.stone, { x }));
    por.add(mesh(box(0.72, 0.24, 0.72), M.trim, { x, y: 4.4 }));
    por.add(mesh(box(0.8, 0.2, 0.8), M.stone, { x, y: -0.02 }));
  }
  por.add(mesh(box(7.0, 0.6, 2.8), M.trim, { y: 4.64 }));
  const ped = group('ped', 0, 5.24, 0); ped.rotation.y = Math.PI / 2;
  ped.add(mesh(gableRoof(2.8, 7.0, 1.4, 0.2), M.roof, {}));
  por.add(ped);
  por.add(mesh(new THREE.CircleGeometry(0.56, 20), M.gold, { y: 5.72, z: 1.42 }));
  g.add(por);
  // 穹顶
  const dm = group('dome', 0, H + 2.1, 0);
  dm.add(mesh(cyl(2.5, 2.8, 1.5, 20), M.stone, { y: -0.4 }));
  for (let i = 0; i < 12; i++) dm.add(mesh(box(0.16, 1.3, 0.16), M.trim, { x: Math.sin((i / 12) * TAU) * 2.5, y: -0.3, z: Math.cos((i / 12) * TAU) * 2.5 }));
  dm.add(mesh(lathe([[2.55, 0], [2.5, 0.6], [2.1, 1.6], [1.4, 2.4], [0.6, 2.9], [0.18, 3.05], [0, 3.1]], 22), M.dome, { y: 1.1 }));
  dm.add(mesh(cyl(0.55, 0.62, 1.0, 12), M.stone, { y: 4.2 }));
  dm.add(mesh(lathe([[0.62, 0], [0.5, 0.5], [0.24, 0.85], [0, 0.95]], 14), M.dome, { y: 5.2 }));
  dm.add(mesh(cyl(0.07, 0.07, 1.4, 6), M.gold, { y: 6.15 }));
  dm.add(mesh(sphere(0.2, 10, 8), M.gold, { y: 7.55 }));
  g.add(dm);
  return { group: g, height: H + 12, chimneys: [], flagAnchor: { x: 0, y: H + 9.5, z: 0 } };
}

/* ------------------------------------------------------------ 车站 */
export function makeStation() {
  const g = group('station');
  const M = {
    wall: mat('#e9d6bb', { rough: 0.92 }),
    brick: mat('#b06a52', { rough: 0.94 }),
    trim: mat('#7a5a42', { rough: 0.85 }),
    roof: mat('#5b4a44', { rough: 0.8 }),
    metal: mat('#6f7a80', { metal: 0.6, rough: 0.4 }),
    glass: glowMat('#bcd8ea', '#ffcf87', 2.3, { rough: 0.1 }),
    lantern: LANTERN(),
    stone: mat(PAL.stone, { rough: 0.94 }),
    sign: SIGN_GLOW(),
  };
  // 站房
  g.add(mesh(roundedBox(7.4, 0.4, 5.0, 0.1), M.stone, { y: -0.2 }));
  g.add(mesh(roundedBox(6.8, 3.5, 4.4, 0.16), M.wall, { y: 0.16 }));
  g.add(mesh(box(6.9, 0.6, 4.5), M.brick, { y: 0.16 }));
  g.add(mesh(box(7.1, 0.2, 4.7), M.trim, { y: 3.56 }));
  g.add(mesh(hipRoof(6.8, 4.4, 1.5, 0.4, 0.45), M.roof, { y: 3.7 }));
  for (const face of faceList(6.8, 4.4)) {
    const sub = group('sf'); sub.rotation.y = face.ry; g.add(sub);
    const count = Math.max(1, Math.floor(face.span / 2.0));
    for (let i = 0; i < count; i++) {
      const x = -face.span / 2 + (face.span * (i + 0.5)) / count;
      windowUnit(sub, x, 1.2, face.dist, { ...M, ww: 0.9, wh: 1.5, arch: true });
    }
  }
  const front = group('sfront'); g.add(front);
  doorUnit(front, -1.8, 2.2, { ...M, door: M.trim, canopy: true, lamp: true, stone: M.stone });
  front.add(mesh(box(2.0, 0.7, 0.12), M.sign, { x: 1.6, y: 2.5, z: 2.28 }));
  // 钟
  g.add(mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.16, 18), M.trim, { y: 4.3, z: 2.0, rx: Math.PI / 2 }));
  g.add(mesh(new THREE.CircleGeometry(0.5, 18), glowMat('#f6efdc', '#ffe0a8', 2.0, { rough: 0.4 }), { y: 4.3, z: 2.1 }));
  // 站台 + 雨棚
  const plat = group('platform', 0, 0, -4.3);
  plat.add(mesh(box(16.0, 0.5, 3.4), M.stone, { y: -0.3 }));
  plat.add(mesh(box(16.2, 0.16, 3.6), mat('#b9ae97', { rough: 0.9 }), { y: 0.2 }));
  plat.add(mesh(box(16.2, 0.14, 0.3), mat('#e8dcc0', { rough: 0.85 }), { y: 0.28, z: 1.6 }));
  for (let i = 0; i < 6; i++) {
    const x = -6.6 + i * 2.65;
    plat.add(mesh(cyl(0.11, 0.13, 3.2, 10), M.metal, { x, y: 0.2, z: -1.1 }));
    plat.add(mesh(box(0.4, 0.2, 0.4), M.metal, { x, y: 3.2, z: -1.1 }));
    plat.add(mesh(sphere(0.14, 8, 6), M.lantern, { x, y: 3.05, z: -0.82 }));
  }
  const canopy = group('canopy', 0, 3.4, -0.2);
  canopy.add(mesh(box(16.4, 0.16, 4.6), M.roof, { rx: 0.09 }));
  canopy.add(mesh(box(16.4, 0.34, 0.2), M.trim, { z: 2.3, y: 0.24 }));
  for (let i = 0; i < 26; i++) canopy.add(mesh(box(0.28, 0.3, 0.06), M.trim, { x: -8.0 + i * 0.64, y: 0.06, z: 2.38, rz: 0.4 }));
  plat.add(canopy);
  g.add(plat);
  return { group: g, height: 5.6, chimneys: [] };
}

/* ------------------------------------------------------------ 风车（转动） */
export function makeWindmill() {
  const g = group('windmill');
  const M = {
    body: mat('#e6dcc4', { rough: 0.92 }),
    stone: mat('#a89c86', { rough: 0.95 }),
    wood: mat(PAL.wood, { rough: 0.85 }),
    woodDark: mat(PAL.woodDark, { rough: 0.85 }),
    roof: mat('#7d5a45', { rough: 0.8 }),
    glass: GLASS(),
    trim: mat('#6f5540', { rough: 0.85 }),
  };
  g.add(mesh(lathe([[3.4, 0], [3.2, 0.5], [2.9, 2.2], [2.5, 5.0], [2.25, 7.4], [2.2, 8.0]], 20), M.body, {}));
  g.add(mesh(lathe([[3.6, 0], [3.5, 0.55], [3.45, 0.6]], 20), M.stone, {}));
  for (let i = 0; i < 3; i++) g.add(mesh(new THREE.TorusGeometry(2.62 - i * 0.16, 0.08, 5, 20), M.trim, { y: 2.6 + i * 2.1, rx: Math.PI / 2 }));
  // 环廊
  g.add(mesh(new THREE.CylinderGeometry(3.5, 3.3, 0.2, 20), M.wood, { y: 3.3 }));
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * TAU;
    g.add(mesh(box(0.1, 0.6, 0.1), M.wood, { x: Math.sin(a) * 3.3, y: 3.5, z: Math.cos(a) * 3.3 }));
  }
  g.add(mesh(new THREE.TorusGeometry(3.34, 0.07, 5, 22), M.wood, { y: 4.1, rx: Math.PI / 2 }));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + 0.4;
    g.add(mesh(box(0.14, 3.4, 0.14), M.wood, { x: Math.sin(a) * 3.2, y: 0, z: Math.cos(a) * 3.2, rx: Math.cos(a) * 0.1, rz: -Math.sin(a) * 0.1 }));
  }
  // 窗与门
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU;
    const sub = group('wmw'); sub.rotation.y = a; g.add(sub);
    windowUnit(sub, 0, i % 2 ? 5.2 : 1.4, i % 2 ? 2.35 : 3.05, { ...M, ww: 0.6, wh: 0.85, shutters: true, shutter: M.woodDark });
  }
  const sub = group('wmd'); sub.rotation.y = Math.PI * 0.5; g.add(sub);
  doorUnit(sub, 0, 2.95, { ...M, door: M.woodDark, stone: M.stone, lamp: true, lantern: LANTERN() });
  // 帽顶
  const cap = group('cap', 0, 8.0, 0);
  cap.add(mesh(lathe([[2.3, 0], [2.5, 0.35], [2.2, 1.5], [1.4, 2.4], [0.5, 2.9], [0, 3.0]], 18), M.roof, {}));
  cap.add(mesh(box(0.5, 0.5, 3.6), M.woodDark, { y: 1.0, z: 0.9 }));
  g.add(cap);
  // 风轮（keep：由动画驱动）
  const rotor = group('rotor', 0, 9.1, 2.6);
  rotor.userData.keep = true;
  rotor.userData.spin = 0.75;
  rotor.add(mesh(cyl(0.34, 0.34, 0.6, 10), M.woodDark, { rx: Math.PI / 2, y: 0 }));
  rotor.add(mesh(sphere(0.36, 10, 8), M.trim, {}));
  for (let b = 0; b < 4; b++) {
    const blade = group('blade');
    blade.rotation.z = (b / 4) * TAU;
    blade.add(mesh(box(0.22, 6.6, 0.16), M.woodDark, { y: 0 }));
    blade.add(mesh(box(1.5, 0.14, 0.12), M.woodDark, { y: 6.1 }));
    for (let i = 0; i < 7; i++) {
      blade.add(mesh(box(1.35, 0.08, 0.09), M.wood, { x: 0.55, y: 0.9 + i * 0.75 }));
    }
    blade.add(mesh(box(1.2, 5.4, 0.05), mat('#f2ead6', { rough: 0.9, opacity: 0.92 }), { x: 0.62, y: 0.5, z: -0.09 }));
    rotor.add(blade);
  }
  g.add(rotor);
  return { group: g, height: 11, rotors: [rotor], chimneys: [] };
}

/* ------------------------------------------------------------ 水磨（水轮转动） */
export function makeWatermill() {
  const g = group('watermill');
  const M = {
    wall: mat('#e3d3b6', { rough: 0.93 }),
    stone: mat('#9c9280', { rough: 0.95 }),
    wood: mat(PAL.wood, { rough: 0.86 }),
    woodDark: mat(PAL.woodDark, { rough: 0.86 }),
    roof: mat('#8a4a38', { rough: 0.8 }),
    trim: mat('#6f5540', { rough: 0.85 }),
    glass: GLASS(),
    lantern: LANTERN(),
    door: mat('#6a4a35', { rough: 0.8 }),
    brick: mat('#a5644f', { rough: 0.95 }),
    flower: mat('#d9576a', { rough: 0.8 }),
    shutter: mat('#5f7f6a', { rough: 0.8 }),
    sign: SIGN_GLOW(),
    bigGlass: GLASS_BIG(),
  };
  const rng = new RNG(91);
  g.add(mesh(roundedBox(5.6, 0.7, 5.0, 0.12), M.stone, { y: -0.35 }));
  g.add(mesh(roundedBox(5.0, 2.6, 4.4, 0.16), M.stone, { y: 0.3 }));
  g.add(mesh(roundedBox(5.3, 2.5, 4.7, 0.18), M.wall, { y: 2.9 }));
  for (const face of faceList(5.3, 4.7)) {
    const sub = group('mf'); sub.rotation.y = face.ry; sub.position.y = 2.9; g.add(sub);
    timberFrame(sub, face.span - 0.4, 2.4, face.dist, M, rng);
    windowUnit(sub, 0, 0.7, face.dist, { ...M, ww: 0.7, wh: 1.1, shutters: true });
  }
  const f0 = group('mf0'); g.add(f0);
  doorUnit(f0, 1.2, 2.25, { ...M, canopy: true, lamp: true });
  windowUnit(f0, -1.4, 1.0, 2.25, { ...M, ww: 0.8, wh: 1.2, arch: true });
  g.add(mesh(box(5.7, 0.2, 5.1), M.trim, { y: 5.3 }));
  const rf = group('mroof', 0, 5.5, 0);
  rf.add(mesh(gableRoof(5.3, 4.7, 2.3, 0.45), M.roof, {}));
  shingleRows(rf, 5.3, 5.2, 2.3, mat('#743d2d', { rough: 0.85 }));
  g.add(rf);
  chimney(g, 1.7, -1.2, 6.4, 1.3, M, rng);
  // 引水槽
  const flume = group('flume', -3.4, 3.6, 0.6);
  flume.add(mesh(box(4.6, 0.16, 1.1), M.wood, { rz: 0.12 }));
  for (const s of [-1, 1]) flume.add(mesh(box(4.6, 0.5, 0.12), M.woodDark, { z: s * 0.55, y: 0.2, rz: 0.12 }));
  for (let i = 0; i < 4; i++) flume.add(mesh(box(0.14, 1.8, 0.14), M.woodDark, { x: -2.0 + i * 1.3, y: -1.0 }));
  g.add(flume);
  // 水轮（keep）
  const wheel = group('wheel', -3.2, 1.9, 0.6);
  wheel.userData.keep = true;
  wheel.userData.spin = -0.6;
  const R = 2.35;
  wheel.add(mesh(cyl(0.22, 0.22, 1.5, 10), M.woodDark, { rx: Math.PI / 2, z: -0.75 }));
  for (const s of [-1, 1]) {
    wheel.add(mesh(new THREE.TorusGeometry(R, 0.11, 5, 26), M.wood, { z: s * 0.62 }));
    wheel.add(mesh(new THREE.TorusGeometry(R * 0.55, 0.09, 5, 20), M.wood, { z: s * 0.62 }));
  }
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU;
    wheel.add(mesh(new THREE.BoxGeometry(0.12, R * 2 - 0.1, 0.12), M.wood, { rz: a }));
    wheel.add(mesh(box(0.9, 0.1, 1.3), M.woodDark, { x: Math.cos(a) * (R - 0.35), y: Math.sin(a) * (R - 0.35), rz: a }));
  }
  g.add(wheel);
  return { group: g, height: 8, rotors: [wheel], chimneys: [{ x: 1.7, y: 7.9, z: -1.2 }] };
}

/* ------------------------------------------------------------ 灯塔（夜间旋转光束） */
export function makeLighthouse() {
  const g = group('lighthouse');
  const M = {
    white: mat('#f2ece0', { rough: 0.85 }),
    red: mat('#c9503f', { rough: 0.85 }),
    stone: mat('#8f8574', { rough: 0.95 }),
    metal: mat('#5f6a72', { metal: 0.6, rough: 0.4 }),
    glass: glowMat('#dff0ff', '#fff0b8', 4.5, { rough: 0.05 }),
    trim: mat('#4a5a62', { rough: 0.7 }),
    wood: mat(PAL.wood, { rough: 0.85 }),
    door: mat('#3f5a6a', { rough: 0.8 }),
    lantern: LANTERN(),
  };
  g.add(mesh(lathe([[3.2, 0], [3.0, 0.6], [2.85, 1.0]], 18), M.stone, {}));
  const H = 11.5;
  for (let i = 0; i < 6; i++) {
    const y0 = 1.0 + i * (H / 6), r0 = 2.1 - i * 0.19, r1 = 2.1 - (i + 1) * 0.19;
    g.add(mesh(cyl(r1, r0, H / 6 + 0.02, 18), i % 2 ? M.red : M.white, { y: y0 }));
  }
  for (let i = 0; i < 3; i++) {
    const sub = group('lhw'); sub.rotation.y = (i / 3) * TAU + 0.6; g.add(sub);
    windowUnit(sub, 0, 3.0 + i * 3.0, 1.85 - i * 0.3, { ...M, ww: 0.5, wh: 0.7, trim: M.trim });
  }
  const dsub = group('lhd'); dsub.rotation.y = 0.3; g.add(dsub);
  doorUnit(dsub, 0, 2.0, { ...M, stone: M.stone, lamp: true });
  // 观景平台
  g.add(mesh(new THREE.CylinderGeometry(2.5, 2.0, 0.28, 18), M.trim, { y: H + 1.0 }));
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU;
    g.add(mesh(box(0.08, 0.62, 0.08), M.metal, { x: Math.sin(a) * 2.3, y: H + 1.28, z: Math.cos(a) * 2.3 }));
  }
  g.add(mesh(new THREE.TorusGeometry(2.32, 0.06, 5, 20), M.metal, { y: H + 1.9, rx: Math.PI / 2 }));
  // 灯室
  g.add(mesh(cyl(1.5, 1.5, 1.9, 12, true), M.glass, { y: H + 1.28 }));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    g.add(mesh(box(0.12, 1.9, 0.12), M.metal, { x: Math.sin(a) * 1.5, y: H + 1.28, z: Math.cos(a) * 1.5 }));
  }
  g.add(mesh(cone(1.9, 1.5, 12), M.trim, { y: H + 3.18 }));
  g.add(mesh(sphere(0.22, 8, 6), M.metal, { y: H + 4.8 }));
  // 旋转光束（keep）
  const beacon = group('beacon', 0, H + 2.2, 0);
  beacon.userData.keep = true;
  beacon.userData.beacon = true;
  const beamGeo = new THREE.ConeGeometry(1.5, 26, 14, 1, true);
  beamGeo.rotateZ(Math.PI / 2);
  beamGeo.translate(13, 0, 0);
  const beamMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color('#ffeeb4'), transparent: true, opacity: 0.0,
    side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.castShadow = false; beam.receiveShadow = false;
  beam.name = 'beam';
  beacon.add(beam);
  const core = new THREE.Mesh(sphere(0.55, 12, 10), new THREE.MeshBasicMaterial({ color: 0xfff4cf }));
  core.name = 'beaconCore';
  beacon.add(core);
  g.add(beacon);
  return { group: g, height: H + 5, beacons: [beacon], chimneys: [] };
}

/* ------------------------------------------------------------ 谷仓 + 筒仓 */
export function makeBarn() {
  const g = group('barn');
  const M = {
    wall: mat('#a8503c', { rough: 0.9 }),
    trim: mat('#f0e6d2', { rough: 0.88 }),
    roof: mat('#54606b', { rough: 0.8 }),
    wood: mat(PAL.woodDark, { rough: 0.88 }),
    stone: mat(PAL.stoneDark, { rough: 0.95 }),
    metal: mat('#8d949c', { metal: 0.55, rough: 0.45 }),
    glass: GLASS(),
    hay: mat('#d9b45c', { rough: 1 }),
  };
  g.add(mesh(roundedBox(9.2, 0.5, 6.4, 0.1), M.stone, { y: -0.25 }));
  g.add(mesh(roundedBox(8.6, 4.2, 5.8, 0.14), M.wall, { y: 0.2 }));
  // 白色木饰带
  for (const face of faceList(8.6, 5.8)) {
    const sub = group('bf'); sub.rotation.y = face.ry; g.add(sub);
    sub.add(mesh(box(face.span, 0.18, 0.08), M.trim, { y: 0.3, z: face.dist + 0.02 }));
    sub.add(mesh(box(face.span, 0.18, 0.08), M.trim, { y: 4.2, z: face.dist + 0.02 }));
    for (let i = 0; i <= 4; i++) sub.add(mesh(box(0.16, 4.0, 0.07), M.trim, { x: -face.span / 2 + (face.span * i) / 4, y: 0.3, z: face.dist + 0.02 }));
  }
  g.add(mesh(gambrelRoof(8.6, 5.8, 3.4, 0.42), M.roof, { y: 4.4 }));
  // 大门 + 干草吊臂
  g.add(mesh(box(3.2, 3.2, 0.16), M.wood, { y: 0.24, z: 2.95 }));
  g.add(mesh(box(0.14, 3.2, 0.1), M.trim, { y: 0.24, z: 3.03 }));
  g.add(mesh(box(3.4, 0.16, 0.12), M.trim, { y: 3.44, z: 3.03 }));
  g.add(mesh(box(1.4, 1.3, 0.14), M.wood, { y: 5.2, z: 2.9 }));
  g.add(mesh(box(0.24, 0.24, 1.4), M.wood, { y: 6.8, z: 3.4 }));
  g.add(mesh(cyl(0.06, 0.06, 0.9, 6), M.metal, { y: 6.0, z: 3.95 }));
  // 筒仓
  const silo = group('silo', 6.4, 0, -0.6);
  silo.add(mesh(cyl(2.0, 2.1, 0.5, 18), M.stone, {}));
  silo.add(mesh(cyl(1.85, 1.95, 8.6, 18), mat('#cdc3ad', { rough: 0.9 }), { y: 0.5 }));
  for (let i = 0; i < 7; i++) silo.add(mesh(new THREE.TorusGeometry(1.9 - i * 0.012, 0.06, 5, 20), M.metal, { y: 1.3 + i * 1.1, rx: Math.PI / 2 }));
  silo.add(mesh(lathe([[2.05, 0], [1.9, 0.5], [1.2, 1.3], [0.4, 1.7], [0, 1.8]], 18), M.metal, { y: 9.1 }));
  silo.add(mesh(cyl(0.3, 0.3, 0.6, 8), M.metal, { y: 10.9 }));
  for (let i = 0; i < 10; i++) silo.add(mesh(box(0.5, 0.06, 0.06), M.metal, { x: 1.9, y: 0.8 + i * 0.8, z: 0 }));
  g.add(silo);
  return { group: g, height: 11, chimneys: [] };
}

/* ------------------------------------------------------------ 温室 / 水塔 / 亭子 */
export function makeGreenhouse() {
  const g = group('greenhouse');
  const frame = mat('#e8e4d8', { rough: 0.6, metal: 0.2 });
  const glass = glowMat('#cfe8e2', '#ffe2a8', 0.9, { rough: 0.05, metal: 0.1, opacity: 0.42 });
  const stone = mat(PAL.stone, { rough: 0.94 });
  const soil = mat('#5c4632', { rough: 1 });
  g.add(mesh(roundedBox(5.2, 0.6, 3.6, 0.08), stone, { y: -0.3 }));
  g.add(mesh(box(5.0, 0.5, 3.4), mat('#b3a58c', { rough: 0.95 }), { y: 0 }));
  g.add(mesh(roundedBox(4.8, 2.2, 3.2, 0.06), glass, { y: 0.5 }));
  const rr = group('ghRoof', 0, 2.7, 0); rr.rotation.y = Math.PI / 2;
  rr.add(mesh(gableRoof(3.2, 4.8, 1.1, 0.14), glass, {}));
  g.add(rr);
  for (let i = 0; i <= 6; i++) g.add(mesh(box(0.08, 2.2, 3.3), frame, { x: -2.4 + i * 0.8, y: 0.5, sz: 1 }));
  for (const s of [-1, 1]) g.add(mesh(box(4.9, 2.25, 0.08), frame, { y: 0.5, z: s * 1.6 }));
  g.add(mesh(box(4.9, 0.12, 0.12), frame, { y: 2.7, z: 0 }));
  for (let i = 0; i <= 6; i++) {
    const x = -2.4 + i * 0.8;
    for (const s of [-1, 1]) g.add(mesh(box(0.07, 1.95, 0.07), frame, { x, y: 2.7, z: s * 0.8, rx: s * 0.62 }));
  }
  g.add(mesh(box(0.9, 1.9, 0.1), frame, { y: 0.5, z: 1.63 }));
  for (let i = 0; i < 2; i++) {
    g.add(mesh(box(4.2, 0.34, 0.7), soil, { y: 0.5, z: -1.0 + i * 2.0 }));
    for (let k = 0; k < 9; k++) g.add(mesh(sphere(0.16, 6, 5), mat(k % 3 ? '#5f9c4a' : '#c9553f', { rough: 0.85 }), { x: -1.9 + k * 0.48, y: 0.95, z: -1.0 + i * 2.0, sy: 1.3 }));
  }
  return { group: g, height: 3.9, chimneys: [] };
}

export function makeWaterTower() {
  const g = group('waterTower');
  const wood = mat(PAL.wood, { rough: 0.88 });
  const dark = mat(PAL.woodDark, { rough: 0.88 });
  const metal = mat('#7d858c', { metal: 0.6, rough: 0.45 });
  const H = 5.4;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    g.add(mesh(box(0.24, H, 0.24), dark, { x: sx * 1.5, z: sz * 1.5, rx: -sz * 0.06, rz: sx * 0.06 }));
  }
  for (let i = 1; i <= 2; i++) {
    const y = (H / 3) * i;
    for (const s of [-1, 1]) {
      g.add(mesh(box(3.2, 0.12, 0.12), dark, { y, z: s * 1.4 }));
      g.add(mesh(box(0.12, 0.12, 3.2), dark, { y, x: s * 1.4 }));
    }
    g.add(mesh(box(4.2, 0.1, 0.1), wood, { y: y - 0.55, z: -1.4, rz: 0.32 }));
  }
  g.add(mesh(box(3.6, 0.2, 3.6), wood, { y: H }));
  g.add(mesh(lathe([[1.7, 0], [1.72, 0.4], [1.7, 2.6], [1.6, 2.8]], 16), wood, { y: H + 0.2 }));
  for (let i = 0; i < 3; i++) g.add(mesh(new THREE.TorusGeometry(1.74, 0.07, 5, 18), metal, { y: H + 0.6 + i * 0.9, rx: Math.PI / 2 }));
  g.add(mesh(cone(1.9, 1.1, 14), mat('#5c6b73', { rough: 0.8 }), { y: H + 3.0 }));
  g.add(mesh(cyl(0.18, 0.18, 1.2, 8), metal, { y: H - 1.0, x: 0.0, z: 1.5 }));
  return { group: g, height: H + 4.1, chimneys: [] };
}

export function makeGazebo() {
  const g = group('gazebo');
  const wood = mat('#f0e6d2', { rough: 0.88 });
  const dark = mat('#8a6a4a', { rough: 0.85 });
  const stone = mat(PAL.stone, { rough: 0.95 });
  const R = 2.5;
  g.add(mesh(new THREE.CylinderGeometry(R + 0.5, R + 0.7, 0.42, 8), stone, { y: -0.2 }));
  g.add(mesh(new THREE.CylinderGeometry(R + 0.2, R + 0.2, 0.2, 8), mat('#c9b997', { rough: 0.9 }), { y: 0.2 }));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    g.add(mesh(cyl(0.12, 0.15, 2.7, 8), wood, { x: Math.sin(a) * R, y: 0.3, z: Math.cos(a) * R }));
    const a2 = ((i + 0.5) / 8) * TAU;
    if (i !== 0 && i !== 7) g.add(mesh(railing(1.9, 0.55, 0.32, 0.06), wood, { x: Math.sin(a2) * R, y: 0.3, z: Math.cos(a2) * R, ry: -a2 }));
  }
  g.add(mesh(new THREE.CylinderGeometry(R + 0.3, R + 0.3, 0.16, 8), dark, { y: 3.0 }));
  g.add(mesh(cone(R + 0.75, 1.7, 8), mat('#8a4a38', { rough: 0.82 }), { y: 3.1, ry: Math.PI / 8 }));
  g.add(mesh(sphere(0.22, 8, 6), dark, { y: 4.9 }));
  g.add(mesh(cyl(0.08, 0.08, 0.7, 6), dark, { y: 4.85 }));
  return { group: g, height: 5.5, chimneys: [] };
}

/* ------------------------------------------------------------ 隧道口 + 高架桥墩 */
export function makeTunnelPortal() {
  const g = group('tunnel');
  const stone = mat('#8f8778', { rough: 0.95 });
  const stone2 = mat('#7a7365', { rough: 0.96 });
  const rock = mat('#6f6a5f', { rough: 1, flat: true });
  // 两侧洞门
  for (const s of [-1, 1]) {
    const f = group('portal', 0, 0, s * 4.6);
    f.add(mesh(archWall(10.0, 9.0, 1.3, 5.0, 6.4), stone, { y: -1.8 }));
    f.add(mesh(box(10.6, 0.5, 2.0), stone2, { y: 6.9 }));
    for (const s2 of [-1, 1]) f.add(mesh(box(1.1, 7.4, 1.7), stone2, { x: s2 * 4.6, y: -1.8 }));
    g.add(f);
  }
  // 岩体
  const rng = new RNG(555);
  for (let i = 0; i < 22; i++) {
    const a = rng.range(-1, 1);
    g.add(mesh(sphere(rng.range(1.8, 3.6), 7, 5), rock, {
      x: a * 7.0, y: rng.range(0.2, 5.2), z: rng.range(-4.4, 4.4),
      sx: rng.range(0.8, 1.5), sy: rng.range(0.5, 0.9), sz: rng.range(0.8, 1.6),
      ry: rng.range(0, TAU),
    }));
  }
  return { group: g, height: 9, chimneys: [] };
}

/** 高架桥墩（含拱券） */
export function makeViaductPier(h, w = 2.6, d = 3.4) {
  const g = group('pier');
  const stone = mat('#a09684', { rough: 0.94 });
  const stone2 = mat('#8d8371', { rough: 0.95 });
  if (h < 1.6) {
    g.add(mesh(box(w + 0.6, Math.max(0.3, h), d + 0.3), stone, {}));
    return g;
  }
  const taperTop = w * 0.86;
  g.add(mesh(box(w + 0.8, 0.5, d + 0.7), stone2, { y: 0 }));
  const seg = Math.max(1, Math.ceil(h / 3.2));
  for (let i = 0; i < seg; i++) {
    const y0 = 0.4 + (h - 0.4) * (i / seg);
    const hh = (h - 0.4) / seg;
    const s = lerp(w, taperTop, i / seg);
    g.add(mesh(box(s, hh + 0.02, d * lerp(1, 0.9, i / seg)), i % 2 ? stone : stone2, { y: y0 }));
    g.add(mesh(box(s + 0.34, 0.18, d * lerp(1, 0.9, i / seg) + 0.34), stone2, { y: y0 + hh - 0.09 }));
  }
  g.add(mesh(box(taperTop + 0.9, 0.4, d + 0.5), stone, { y: h - 0.1 }));
  return g;
}
