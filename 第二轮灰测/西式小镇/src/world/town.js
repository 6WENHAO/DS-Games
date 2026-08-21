// ---------------------------------------------------------------------------
// 小镇总装：把八个片区一块块「盖」出来
// 每个片区一个 Sculptor（各自合并几何 → 便于视锥剔除）
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { MAT } from '../lib/materials.js';
import * as G from '../lib/geom.js';
import { Rng } from '../lib/rng.js';
import * as P from './props.js';
import * as B from './buildings.js';
import * as M from './motion.js';
import {
  buildRoads,
  riverCenter,
  riverBankSouth,
  riverBankNorth,
  RIVER,
  RAILS,
  heightAt,
} from './terrain.js';
import { DISTRICTS } from './districts.js';

const TAU = Math.PI * 2;
const SHOP_SIGNS = [
  'BÄCKEREI',
  'GASTHAUS',
  'APOTHEKE',
  'BUCHHANDLUNG',
  'UHRMACHER',
  'KÄSEREI',
  'SCHNEIDER',
  'BLUMEN',
  'SPIELZEUG',
  'KAFFEE',
  'METZGEREI',
  'WEINSTUBE',
];

/* -------------------------------------------------------------------------- */
/*                                  工具                                      */
/* -------------------------------------------------------------------------- */

/** 沿折线均匀布置路灯 */
function lampsAlong(s, pts, spacing, offset, o = {}) {
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, z0] = pts[i];
    const [x1, z1] = pts[i + 1];
    const len = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.floor(len / spacing);
    const nx = -(z1 - z0) / len;
    const nz = (x1 - x0) / len;
    for (let k = 0; k <= n; k++) {
      const t = n === 0 ? 0.5 : k / n;
      const px = x0 + (x1 - x0) * t;
      const pz = z0 + (z1 - z0) * t;
      for (const sd of o.both === false ? [1] : [-1, 1]) {
        P.streetLamp(s, px + nx * offset * sd, pz + nz * offset * sd, 0, o);
      }
    }
  }
}

/** 随机撒人（o.avoid = [[x,z,r]…] 会被绕开） */
function crowd(s, rng, n, x0, z0, x1, z1, o = {}) {
  const avoid = o.avoid || [];
  for (let i = 0; i < n; i++) {
    let x = 0;
    let z = 0;
    let tries = 0;
    do {
      x = rng.range(x0, x1);
      z = rng.range(z0, z1);
      tries++;
    } while (tries < 12 && avoid.some(([ax, az, ar]) => Math.hypot(x - ax, z - az) < ar));
    P.person(s, x, z, rng.range(0, TAU), {
      i: rng.int(0, 6),
      skirt: rng.bool(0.45),
      scale: rng.range(0.92, 1.08),
      hat: rng.bool(0.7),
      y: o.y ?? 0,
    });
  }
}

/* -------------------------------------------------------------------------- */
/*                          ①  中央广场区 Marktplatz                          */
/* -------------------------------------------------------------------------- */
function buildPlaza(s) {
  const rng = new Rng(1001);

  // 市政厅（广场北侧偏西）
  s.push(-22, 0, -30, 0);
  B.townHall(s, { w: 32, d: 15 });
  s.pop();
  // 市政厅前的旗阵与雕像
  P.flagPole(s, -34, -18, 0, { flag: MAT.clothRed, h: 9 });
  P.flagPole(s, -22, -18, 0, { flag: MAT.clothBlue, h: 9 });
  P.flagPole(s, -10, -18, 0, { flag: MAT.clothGreen, h: 9 });

  // 东北角：行会馆（荷兰阶梯山墙）
  s.push(22, 0, -32, 0);
  B.house(s, {
    w: 22,
    d: 14,
    floors: 3,
    floorH: 3.6,
    wall: MAT.brickRed,
    wallUp: MAT.brickRed,
    roof: MAT.roofSlate,
    roofType: 'gable',
    ridge: 'z',
    roofH: 6.5,
    stepGable: true,
    shutters: MAT.shutterGreen,
    archWin: true,
    lintel: MAT.stone,
    dormers: 1,
    chimneys: 2,
    rng,
  });
  s.pop();

  // 西侧：银行 / 行会（面朝广场 +X）
  s.push(-40, 0, -16, Math.PI / 2);
  B.house(s, {
    w: 20,
    d: 13,
    floors: 3,
    floorH: 3.3,
    wall: MAT.stoneWarm,
    wallUp: MAT.plasterCream,
    roof: MAT.roofSlate,
    roofType: 'mansard',
    ridge: 'x',
    roofH: 5.2,
    archWin: true,
    lintel: MAT.stone,
    dormers: 2,
    chimneys: 2,
    rng,
  });
  s.pop();

  // 西南：剧院（古典柱廊，面朝广场 +X）
  s.push(-40, 0, 19, Math.PI / 2);
  B.house(s, {
    w: 26,
    d: 14,
    floors: 2,
    floorH: 4.6,
    wall: MAT.stoneWarm,
    roof: MAT.roofSlate,
    roofType: 'hip',
    roofH: 4.4,
    ridge: 'x',
    door: false,
    archWin: true,
    lintel: MAT.stone,
    chimneys: 2,
    rng,
  });
  // 门廊
  for (let i = -3; i <= 3; i++) {
    s.cyl(MAT.white, 0.55, 0.68, 8.2, i * 2.6, 0.5, 8.4, 14, 0, 1.8);
    s.cyl(MAT.white, 0.78, 0.62, 0.5, i * 2.6, 8.7, 8.4, 14, 0, 1);
  }
  s.box(MAT.stoneWarm, 18, 1.5, 4.2, 0, 9.2, 8.0, 0, 2);
  s.gable(MAT.roofSlate, 4.6, 18.4, 2.6, 0, 10.7, 8.0, Math.PI / 2, 1.4, 'slopes');
  s.gable(MAT.stoneWarm, 4.6, 18.4, 2.6, 0, 10.7, 8.0, Math.PI / 2, 2, 'ends');
  s.stairs(MAT.stone, 19, 0.5, 2.2, 0, 0, 10.6, 0, 3, 2);
  s.pop();

  // 南侧两栋（夹住主街）
  for (const sd of [-1, 1]) {
    s.push(sd * 24, 0, 34, Math.PI);
    B.house(s, {
      w: 18,
      d: 13,
      floors: 3,
      floorH: 3.2,
      wall: sd < 0 ? MAT.plasterOchre : MAT.plasterCream,
      wallUp: sd < 0 ? MAT.plasterOchre : MAT.plasterCream,
      halfTimber: true,
      jetty: true,
      roof: sd < 0 ? MAT.roofTerracotta : MAT.roofRust,
      ridge: 'z',
      shop: true,
      sign: sd < 0 ? 'RATSKELLER' : 'HOTEL ADLER',
      awning: sd < 0 ? MAT.clothGreen : MAT.clothRed,
      shutters: MAT.shutterGreen,
      flowers: true,
      attic: true,
      dormers: 1,
      chimneys: 2,
      rng,
    });
    s.pop();
  }

  // 喷泉 + 纪念像
  P.fountain(s, 0, 2, { r: 3.8 });
  P.statue(s, -16, 16, Math.PI * 0.15);
  // 市集摊位
  const clothes = [MAT.clothRed, MAT.clothBlue, MAT.clothGreen, MAT.clothCream];
  for (let i = 0; i < 7; i++) {
    P.marketStall(s, 12 + (i % 2) * 5.5, -14 + Math.floor(i / 2) * 6.5, i % 2 ? 0.2 : -0.15, {
      cloth: clothes[i % 4],
      i,
    });
  }
  for (let i = 0; i < 4; i++) {
    P.marketStall(s, -8 + i * 6.6, 17.5, Math.PI + 0.1, { cloth: clothes[(i + 2) % 4], i: i + 2 });
  }
  // 周边设施
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + 0.3;
    P.streetLamp(s, Math.cos(a) * 22, Math.sin(a) * 19 + 2, 0);
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    P.bench(s, Math.cos(a) * 9.5, 2 + Math.sin(a) * 8.5, -a + Math.PI / 2);
  }
  P.treeRound(s, -26, -8, 0.4, { scale: 1.15, i: 0 });
  P.treeRound(s, 26, 12, 1.1, { scale: 1.2, i: 1 });
  P.treeRound(s, 24, -14, 2.2, { scale: 1.0, i: 2 });
  P.flowerBed(s, -10, 23, 0, { w: 6, d: 1.6 });
  P.flowerBed(s, 10, 23, 0, { w: 6, d: 1.6 });
  P.flowerBed(s, 20, 6, Math.PI / 2, { w: 5, d: 1.6 });
  P.postBox(s, -6, -16, 0.4);
  P.signPost(s, 10, -19, -0.5, ['HAFEN →', '← DOM', 'BAHNHOF ↓']);
  P.handcart(s, -12, -6, 1.2, { load: true });
  crowd(s, rng, 26, -26, -18, 27, 22, {
    avoid: [
      [0, 2, 6.5], // 喷泉
      [-16, 16, 3.2], // 雕像
      [14, -8, 7], // 东侧摊位群
      [2, 17.5, 5], // 南侧摊位群
      [-22, -18, 5], // 市政厅台阶
    ],
  });
  return { name: 'plaza' };
}

/* -------------------------------------------------------------------------- */
/*                          ②  商业街市区 Handelsstraße                        */
/* -------------------------------------------------------------------------- */
function buildMarket(s) {
  const rng = new Rng(2002);
  // 北侧商铺（面朝 +Z）：x 34 → 90
  s.push(62, 0, -8, 0);
  B.terrace(s, {
    length: 56,
    minW: 7,
    maxW: 11,
    minD: 9,
    maxD: 12,
    shops: true,
    signs: SHOP_SIGNS,
    stepGable: true,
    rng,
  });
  s.pop();
  // 南侧商铺（面朝 -Z）：x 34 → 100（push 位置 = 街区中心）
  s.push(67, 0, 8, Math.PI);
  B.terrace(s, {
    length: 66,
    minW: 7,
    maxW: 11,
    minD: 9,
    maxD: 12,
    shops: true,
    signs: SHOP_SIGNS,
    stepGable: true,
    rng: new Rng(2003),
  });
  s.pop();

  // 东端：带顶市场厅
  s.push(104, 0, -20, 0);
  s.box(MAT.stone, 26, 0.6, 18, 0, 0, 0, 0, 2.4);
  s.flat(MAT.cobble, 25, 17, 0, 0.62, 0, 0, 3);
  for (let i = -3; i <= 3; i++) {
    for (const sd of [-1, 1]) {
      s.cyl(MAT.stoneWarm, 0.42, 0.55, 5.4, i * 3.9, 0.6, sd * 7.6, 12, 0, 1.6);
      s.cyl(MAT.stone, 0.6, 0.5, 0.4, i * 3.9, 6.0, sd * 7.6, 12, 0, 1);
    }
    s.boxC(MAT.timber, 0.3, 15.6, 0.3, i * 3.9, 6.4, 0, Math.PI / 2, 0, 0, 1.4);
  }
  s.box(MAT.timber, 25, 0.34, 0.34, 0, 6.4, 7.6, 0, 1.4);
  s.box(MAT.timber, 25, 0.34, 0.34, 0, 6.4, -7.6, 0, 1.4);
  s.gable(MAT.roofTerracotta, 27, 18.6, 4.2, 0, 6.6, 0, 0, 1.4, 'slopes');
  s.gable(MAT.timber, 27, 18.6, 4.2, 0, 6.6, 0, 0, 1.6, 'ends');
  s.box(MAT.roofRust, 27, 0.2, 0.42, 0, 10.7, 0, 0, 1);
  const clothes = [MAT.clothRed, MAT.clothBlue, MAT.clothGreen, MAT.clothCream];
  for (let i = 0; i < 6; i++) {
    P.marketStall(s, -9 + (i % 3) * 9, -4 + Math.floor(i / 3) * 8, 0, {
      cloth: clothes[i % 4],
      i,
      y: 0.62,
    });
  }
  P.barrel(s, 11, 6, 0.3, { y: 0.62 });
  P.barrel(s, 11.9, 5.2, 1.1, { y: 0.62 });
  P.sack(s, -11, 6.4, 0.2, { y: 0.62 });
  s.pop();

  // 街道设施
  lampsAlong(s, [[34, 0], [112, 0]], 15, 7.2, {});
  const street = [];
  for (let x = 36; x < 112; x += 6.5) street.push(x);
  street.forEach((x, i) => {
    if (i % 3 === 0) P.bench(s, x, 7.0, Math.PI);
    if (i % 3 === 1) P.bench(s, x + 2, -7.0, 0);
    if (i % 4 === 0) P.barrel(s, x + 1.4, -8.2, rng.range(0, 3));
    if (i % 4 === 2) P.crate(s, x - 1.2, 8.4, rng.range(0, 3), { w: 0.9, h: 0.7 });
    if (i % 5 === 0) P.bush(s, x, 8.8, 0, { scale: 0.9 });
    if (i % 6 === 3) P.handcart(s, x, -9.4, rng.range(-0.3, 0.3), { load: rng.bool() });
  });
  for (let i = 0; i < 5; i++) P.hangingLantern(s, 40 + i * 16, 3.4, -8.6, 0);
  P.flowerBed(s, 100, 8, 0, { w: 8, d: 1.6 });
  P.treeRound(s, 92, 9.5, 0, { scale: 0.95, i: 1 });
  P.treeRound(s, 62, -10.5, 1.4, { scale: 0.9, i: 2 });
  crowd(s, new Rng(2077), 30, 34, -8.5, 112, 8.5);
  return { name: 'market' };
}

/* -------------------------------------------------------------------------- */
/*                       ③  教堂与墓园区 Kathedrale                            */
/* -------------------------------------------------------------------------- */
function buildCathedral(s) {
  const rng = new Rng(3003);
  // 主教座堂
  s.push(-70, 0, -28, 0);
  B.church(s, { naveW: 15, naveD: 34, naveH: 13, towerH: 31, towerW: 8.2 });
  s.pop();
  // 教堂前广场
  s.flat(MAT.stone, 46, 15, -70, 0.1, -4, 0, 4);
  s.flat(MAT.cobble, 40, 10, -70, 0.12, -4, 0, 3);
  P.streetLamp(s, -88, -3, 0);
  P.streetLamp(s, -52, -3, 0);
  P.streetLamp(s, -88, -9, 0);
  P.streetLamp(s, -52, -9, 0);
  P.bench(s, -60, -1, Math.PI);
  P.bench(s, -80, -1, Math.PI);
  // 石十字纪念碑
  s.push(-70, 0, 2, 0);
  s.box(MAT.stoneDark, 3.0, 0.4, 3.0, 0, 0, 0, 0, 2);
  s.box(MAT.stone, 2.2, 0.4, 2.2, 0, 0.4, 0, 0, 1.6);
  s.box(MAT.stone, 1.2, 3.6, 1.2, 0, 0.8, 0, 0, 1.4);
  s.box(MAT.stone, 0.6, 2.4, 0.6, 0, 4.4, 0, 0, 1.2);
  s.box(MAT.stone, 2.4, 0.5, 0.55, 0, 5.6, 0, 0, 1.2);
  s.ball(MAT.gold, 0.16, 0, 6.9, 0, 8);
  s.pop();

  // 回廊庭院（教堂西侧）
  s.push(-100, 0, -30, 0);
  const R = 11;
  s.flat(MAT.grassDark, R - 3, R - 3, 0, 0.09, 0, 0, 4);
  s.flat(MAT.gravel, R + 3, R + 3, 0, 0.06, 0, 0, 4);
  for (let side = 0; side < 4; side++) {
    s.push(0, 0, 0, (side * Math.PI) / 2);
    for (let i = -2; i <= 2; i++) {
      s.arch(MAT.stone, 4.0, 4.4, 2.2, 2.3, 3.4, i * 4.0, 0, R / 2 + 2.6, 0, 9, 2);
      s.cyl(MAT.stone, 0.3, 0.36, 3.0, i * 4.0 - 2.0, 0, R / 2 + 1.5, 10, 0, 1.2);
    }
    s.box(MAT.stone, 20.2, 0.5, 3.4, 0, 4.4, R / 2 + 2.4, 0, 2);
    s.boxC(MAT.roofTerracotta, 20.4, 0.24, 4.0, 0, 5.6, R / 2 + 1.6, 0.4, 0, 0, 1.4);
    s.pop();
  }
  P.well(s, 0, 0, 0.3);
  P.treeCypress(s, -6, -6, 0, { scale: 0.8 });
  P.treeCypress(s, 6, 6, 0, { scale: 0.75 });
  P.bush(s, 6, -6, 0, { scale: 1.1 });
  P.bush(s, -6, 6, 0, { scale: 1.0 });
  s.pop();

  // 神职人员住宅
  s.push(-104, 0, -12, 0);
  B.house(s, {
    w: 13,
    d: 11,
    floors: 2,
    floorH: 3.2,
    wall: MAT.stone,
    wallUp: MAT.plasterCream,
    halfTimber: true,
    roof: MAT.roofBrown,
    ridge: 'z',
    shutters: MAT.shutterGreen,
    flowers: true,
    dormers: 1,
    attic: true,
    chimneys: 2,
    rng,
  });
  s.pop();
  P.fenceLine(s, [
    [-112, -5],
    [-96, -5],
  ], { h: 1.0 });
  P.flowerBed(s, -104, -4, 0, { w: 8, d: 1.5 });

  // 墓园（教堂东侧）
  const g0 = -58;
  const g1 = -34;
  const gz0 = -52;
  const gz1 = -12;
  s.flat(MAT.grassDark, g1 - g0 + 4, gz1 - gz0 + 4, (g0 + g1) / 2, 0.05, (gz0 + gz1) / 2, 0, 5);
  P.ironFence(s, [
    [g0 - 2, gz0 - 2],
    [g1 + 2, gz0 - 2],
    [g1 + 2, gz1 + 2],
  ], { h: 1.7 });
  P.ironFence(s, [
    [g0 - 2, gz1 + 2],
    [g0 - 2, gz0 - 2],
  ], { h: 1.7 });
  // 墓园大门
  for (const sd of [-1, 1]) {
    s.box(MAT.stoneDark, 1.2, 3.4, 1.2, (g0 + g1) / 2 + sd * 2.6, 0, gz1 + 2, 0, 1.6);
    s.cone(MAT.stoneDark, 0.8, 1.2, (g0 + g1) / 2 + sd * 2.6, 3.4, gz1 + 2, 8);
  }
  s.bar(MAT.black, 2.7, 0.14, (g0 + g1) / 2, 3.0, gz1 + 2, 'z', 14, 1);
  let gi = 0;
  for (let x = g0 + 1; x < g1 - 1; x += 4.4) {
    for (let z = gz0 + 2; z < gz1 - 2; z += 5.0) {
      if (rng.bool(0.14)) continue;
      P.gravestone(s, x + rng.jitter(0, 0.6), z + rng.jitter(0, 0.7), rng.jitter(0, 0.14), {
        type: gi % 7 === 0 ? 2 : gi % 3,
      });
      gi++;
    }
  }
  for (let i = 0; i < 7; i++) {
    P.treeCypress(s, g0 + 1.5 + i * 3.6, gz0 - 0.5, 0, { scale: rng.range(0.85, 1.15) });
  }
  P.treeCypress(s, g1 + 0.5, -22, 0, { scale: 1.1 });
  P.treeCypress(s, g1 + 0.5, -40, 0, { scale: 1.0 });
  // 小礼拜堂
  s.push(-46, 0, -47, Math.PI * 0.5);
  B.chapel(s, { w: 8, d: 13, h: 6.4 });
  s.pop();
  // 家族陵墓
  s.push(-52, 0, -18, 0);
  s.box(MAT.stoneDark, 5.4, 0.5, 6.4, 0, 0, 0, 0, 2);
  s.box(MAT.stone, 4.4, 3.6, 5.4, 0, 0.5, 0, 0, 2);
  s.gable(MAT.stoneDark, 6.0, 5.8, 1.8, 0, 4.1, 0, Math.PI / 2, 1.6);
  for (const sd of [-1, 1]) s.cyl(MAT.stone, 0.34, 0.4, 3.4, sd * 1.5, 0.5, 2.75, 10, 0, 1.2);
  B.doorUnit(s, 0, 0.5, 2.7, 0, { w: 1.3, h: 2.4, door: MAT.metalRust, arch: true, frame: MAT.stone, steps: false, transom: false });
  s.pop();
  P.treeRound(s, -34, -8, 0, { scale: 1.3, i: 1 });
  P.treeRound(s, -114, -20, 0, { scale: 1.25, i: 3 });
  P.treeRound(s, -112, -44, 0, { scale: 1.1, i: 2 });
  crowd(s, rng, 10, -92, -12, -50, -2);
  return { name: 'cathedral' };
}

/* -------------------------------------------------------------------------- */
/*                          ④  住宅区 Wohnviertel                             */
/* -------------------------------------------------------------------------- */
function buildResidential(s) {
  const rng = new Rng(4004);
  // 街道：z=54（宽9）与 z=94（宽8）；巷道 x=±42；主街 x=0
  // 立面线：46 / 62 面向 z=54 的街，87.5 / 100 面向 z=94 的街
  // ry=0 的排屋从 x 向 +x 延伸，ry=PI 的排屋从 x 向 -x 延伸
  const rows = [
    { x: -64, z: 46, len: 18, ry: 0, seed: 41 },
    { x: -38, z: 46, len: 30, ry: 0, seed: 42 },
    { x: 8, z: 46, len: 30, ry: 0, seed: 43 },
    { x: 46, z: 46, len: 18, ry: 0, seed: 44 },
    { x: -46, z: 62, len: 18, ry: Math.PI, seed: 45 },
    { x: -8, z: 62, len: 30, ry: Math.PI, seed: 46 },
    { x: 38, z: 62, len: 30, ry: Math.PI, seed: 47 },
    { x: 64, z: 62, len: 18, ry: Math.PI, seed: 48 },
    { x: -56, z: 87.5, len: 20, ry: 0, seed: 49 },
    { x: -30, z: 87.5, len: 22, ry: 0, seed: 50 },
    { x: 10, z: 87.5, len: 26, ry: 0, seed: 51 },
    { x: 48, z: 87.5, len: 16, ry: 0, seed: 52 },
    { x: -36, z: 100, len: 20, ry: Math.PI, seed: 53 },
    { x: -8, z: 100, len: 26, ry: Math.PI, seed: 54 },
    { x: 40, z: 100, len: 30, ry: Math.PI, seed: 55 },
    { x: 66, z: 100, len: 16, ry: Math.PI, seed: 56 },
  ];
  for (const r of rows) {
    s.push(r.x + (r.ry ? -r.len / 2 : r.len / 2), 0, r.z, r.ry);
    B.terrace(s, {
      length: r.len,
      minW: 6.8,
      maxW: 10,
      minD: 8,
      maxD: 10.5,
      rng: new Rng(r.seed),
      shops: false,
    });
    s.pop();
  }

  // 街角小广场：水井 + 长椅（西端空地）
  s.flat(MAT.cobble, 20, 16, -70, 0.1, 72, 0, 3);
  P.well(s, -70, 72, 0.4);
  P.bench(s, -74, 67, 0.6);
  P.bench(s, -64, 77, -2.4);
  P.treeRound(s, -75, 78, 0, { scale: 1.1, i: 0 });
  P.treeRound(s, -63, 66, 0, { scale: 1.0, i: 2 });
  P.streetLamp(s, -70, 64, 0);
  P.handcart(s, -66, 74, 1.1);

  // 后院：菜园、篱笆、晒衣绳、棚屋
  const yards = [
    [-66, 118],
    [-38, 118],
    [30, 118],
    [62, 118],
    [-70, 40],
    [70, 40],
    [-70, 96],
    [70, 84],
  ];
  for (const [yx, yz] of yards) {
    P.fenceLine(s, [
      [yx - 6, yz - 5],
      [yx + 6, yz - 5],
      [yx + 6, yz + 5],
      [yx - 6, yz + 5],
      [yx - 6, yz - 5],
    ], { h: 0.95 });
    // 菜畦
    for (let i = 0; i < 3; i++) {
      s.box(MAT.soil, 9, 0.16, 1.1, yx, 0.06, yz - 3 + i * 2.2, 0, 1.2);
      for (let k = 0; k < 7; k++) {
        s.ball(rng.bool(0.5) ? MAT.cropGreen : MAT.leafC, 0.26, yx - 3.8 + k * 1.28, 0.3, yz - 3 + i * 2.2, 6);
      }
    }
    // 工具棚
    s.push(yx + 4.4, 0, yz + 3.4, rng.range(-0.2, 0.2));
    s.box(MAT.woodGrey, 2.6, 2.2, 2.2, 0, 0, 0, 0, 1.2);
    s.gable(MAT.roofBrown, 3.0, 2.6, 0.9, 0, 2.2, 0, 0, 1, 'slopes');
    s.gable(MAT.woodGrey, 3.0, 2.6, 0.9, 0, 2.2, 0, 0, 1.2, 'ends');
    s.box(MAT.timberDark, 0.9, 1.7, 0.1, 0, 0, 1.15, 0, 0.8);
    s.pop();
    // 晒衣绳
    s.box(MAT.timber, 0.12, 2.4, 0.12, yx - 5, 0, yz - 1);
    s.box(MAT.timber, 0.12, 2.4, 0.12, yx + 1, 0, yz - 1);
    s.bar(MAT.white, 0.03, 6, yx - 2, 2.3, yz - 1, 'x', 5);
    const clothes = [MAT.clothCream, MAT.clothBlue, MAT.white, MAT.clothRed];
    for (let i = 0; i < 4; i++) {
      s.panel(clothes[i % 4], 0.8, 1.0, yx - 4.4 + i * 1.5, 1.25, yz - 1, 0, 1, true);
    }
    P.bush(s, yx - 4.6, yz + 3.6, 0, { scale: 0.9 });
    P.flowerBed(s, yx, yz + 4.2, 0, { w: 5, d: 1.1 });
  }

  // 南城门
  s.push(0, 0, 126, 0);
  B.gatehouse(s, { gap: 12 });
  s.pop();
  P.stoneWallLine(s, [
    [-9, 126],
    [-30, 126],
  ], { h: 5, t: 2.2, posts: true });
  P.stoneWallLine(s, [
    [9, 126],
    [30, 126],
  ], { h: 5, t: 2.2, posts: true });

  lampsAlong(s, [[-60, 54], [60, 54]], 22, 6.6, {});
  lampsAlong(s, [[-50, 94], [50, 94]], 24, 6.0, {});
  lampsAlong(s, [[0, 30], [0, 120]], 26, 7.4, {});
  // 街边行道树（人行道上）
  for (let i = 0; i < 8; i++) {
    P.treeRound(s, -60 + i * 17, 48.2, rng.range(0, TAU), { scale: rng.range(0.75, 0.95), i });
    P.treeRound(s, -52 + i * 17, 60.2, rng.range(0, TAU), { scale: rng.range(0.75, 0.95), i: i + 1 });
  }
  crowd(s, rng, 34, -68, 50, 68, 58);
  crowd(s, new Rng(4111), 16, -50, 90, 50, 98);
  P.handcart(s, -46, 58, 0.2);
  P.handcart(s, 34, 96, 2.9);
  P.postBox(s, 6, 52, -0.3);
  P.signPost(s, -6, 118, 0.2, ['MARKT ↑', 'BAHNHOF →']);
  return { name: 'residential' };
}

/* -------------------------------------------------------------------------- */
/*                        ⑤  河港与磨坊区 Hafen & Mühle                        */
/* -------------------------------------------------------------------------- */
function buildHarbor(s) {
  const rng = new Rng(5005);
  // 石砌码头（沿南岸）
  const quayPts = [];
  const wallPts = [];
  for (let x = 20; x <= 116; x += 8) {
    quayPts.push([x, riverBankSouth(x) + 5]);
    wallPts.push([x, riverBankSouth(x) + 0.6]);
  }
  s.ribbon(MAT.cobbleWarm, quayPts, 13, 0.45, 4);
  // 岸壁
  for (let i = 0; i < wallPts.length - 1; i++) {
    const [x0, z0] = wallPts[i];
    const [x1, z1] = wallPts[i + 1];
    const len = Math.hypot(x1 - x0, z1 - z0) + 0.6;
    const ang = Math.atan2(x1 - x0, z1 - z0);
    s.push((x0 + x1) / 2, 0, (z0 + z1) / 2, ang);
    s.box(MAT.stoneDark, 1.6, 5.6, len, 0, -5.0, 0, 0, 2.2);
    s.box(MAT.stone, 2.2, 0.4, len, 0, 0.45, 0, 0, 2);
    s.pop();
  }
  // 系船柱与台阶
  for (let x = 26; x < 114; x += 9) {
    const z = riverBankSouth(x) + 1.4;
    s.cyl(MAT.stoneDark, 0.34, 0.42, 0.85, x, 0.85, z, 8, 0, 1);
    s.ball(MAT.stoneDark, 0.34, x, 1.7, z, 8);
  }
  s.stairs(MAT.stoneDark, 4, 1.4, 3.4, 40, -0.9, riverBankSouth(40) + 1.6, 0, 4, 2);

  // 水车磨坊
  s.push(30, 0, -62, Math.PI / 2);
  B.watermill(s, { w: 12, d: 9 });
  s.pop();
  // 磨坊水道（连到河里）
  s.box(MAT.waterStill, 12, 0.1, 3.0, 24, 1.2, -70);
  s.box(MAT.stoneDark, 1.2, 2.6, 13, 24, -1.2, -76, 0, 2);
  s.box(MAT.stoneDark, 1.2, 2.6, 13, 30, -1.2, -76, 0, 2);
  s.box(MAT.waterStill, 4.8, 0.1, 13, 27, 1.0, -76);
  P.logPile(s, 20, -56, 0.4);
  P.barrel(s, 36, -56, 0.2);
  P.barrel(s, 37, -55.2, 1.1);
  P.sack(s, 34.4, -55, 0);

  // 木栈桥 + 船
  const piers = [52, 74, 96];
  piers.forEach((px, i) => {
    const z0 = riverBankSouth(px) + 3;
    const z1 = riverCenter(px) + 2;
    P.pier(s, [
      [px, z0],
      [px, z1],
    ], { w: 3.4, y: 0.5 });
    // 栈桥上的灯与货物
    P.streetLamp(s, px + 2.4, z0 - 1, 0, { h: 3.4, y: 0.5 });
    P.crate(s, px - 1.0, z1 + 3, 0.4, { w: 0.9, h: 0.7, y: 0.55 });
    P.barrel(s, px + 1.0, z1 + 5, 0.9, { y: 0.55 });
    // 停泊的船
    P.boat(s, px + 5.5, z1 - 2, Math.PI / 2 + 0.08, {
      scale: 1.05,
      y: RIVER.level + 0.35,
      sail: i !== 1,
      cabin: i === 1,
      crates: i === 1,
      phase: i * 2.1,
    });
  });
  // 河中航行的帆船（在石桥以西的河面上往复）
  const sailing = new THREE.Group();
  {
    const sub = new G.Sculptor('ship');
    P.boat(sub, 0, 0, 0, { scale: 1.25, sail: true, cabin: true, mast: 1.15 });
    sailing.add(sub.finalize());
    s.onUpdate((dt, t) => {
      sub.updates.forEach((f) => f(dt, t));
    });
  }
  s.attach(sailing, -60, RIVER.level + 0.4, riverCenter(-60), 0);
  s.onUpdate((dt, t) => {
    const period = 150;
    const p = (t % period) / period;
    const fwd = p < 0.5;
    const u = fwd ? p * 2 : (1 - p) * 2;
    const x = -150 + u * 118;
    sailing.position.x = x;
    sailing.position.z = riverCenter(x) - 2.5;
    sailing.rotation.y = fwd ? Math.PI / 2 : -Math.PI / 2;
  });

  // 仓库（面朝河）
  [[52, -50], [76, -50], [100, -50]].forEach(([x, z], i) => {
    s.push(x, 0, z, Math.PI);
    B.warehouse(s, {
      w: 17,
      d: 11,
      h: 8.4,
      wall: i === 1 ? MAT.brickTan : MAT.brickRed,
      roof: i === 2 ? MAT.roofBrown : MAT.roofSlate,
    });
    s.pop();
  });
  // 港口吊车
  P.harborCrane(s, 62, riverBankSouth(62) + 4, -Math.PI / 2, { y: 0.45 });
  P.harborCrane(s, 88, riverBankSouth(88) + 4, -Math.PI / 2, { y: 0.45 });
  // 鱼市棚
  s.push(36, 0, -48, Math.PI);
  s.box(MAT.stone, 12, 0.4, 8, 0, 0, 0, 0, 2);
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) s.cyl(MAT.timber, 0.16, 0.2, 3.4, sx * 5.2, 0.4, sz * 3.4, 8);
  s.gable(MAT.thatch, 13, 9, 2.4, 0, 3.8, 0, 0, 1.4, 'slopes');
  s.gable(MAT.timber, 13, 9, 2.4, 0, 3.8, 0, 0, 1.4, 'ends');
  for (let i = -1; i <= 1; i++) {
    s.box(MAT.woodPlank, 3.0, 0.1, 1.6, i * 3.6, 1.0, 0.6, 0, 1);
    s.box(MAT.timber, 0.12, 1.0, 0.12, i * 3.6 - 1.3, 0, 0.6);
    s.box(MAT.timber, 0.12, 1.0, 0.12, i * 3.6 + 1.3, 0, 0.6);
    s.ball(MAT.plasterBlue, 0.2, i * 3.6, 1.2, 0.4, 8);
    s.ball(MAT.plasterBlue, 0.17, i * 3.6 + 0.5, 1.2, 0.8, 8);
  }
  s.pop();
  // 灯塔式信标
  s.push(114, 0, riverBankSouth(114) + 2, 0);
  s.cyl(MAT.stoneDark, 2.6, 3.2, 1.2, 0, 0, 0, 14, 0, 2);
  s.cyl(MAT.white, 1.5, 2.2, 9, 0, 1.2, 0, 14, 0, 2.4);
  s.cyl(MAT.doorRed, 1.6, 1.6, 1.0, 0, 6.2, 0, 14, 0, 1.4);
  s.cyl(MAT.metal, 1.7, 1.7, 0.3, 0, 10.2, 0, 14);
  s.cyl(MAT.lampGlass, 1.2, 1.2, 1.6, 0, 10.5, 0, 12);
  s.cone(MAT.metal, 1.6, 1.4, 0, 12.1, 0, 12);
  s.ball(MAT.gold, 0.2, 0, 13.5, 0, 8);
  s.anchor('glow', 0, 11.2, 0, { size: 8, color: 0xffd9a0 });
  s.pop();
  // 木质人行小桥（东端过河）
  P.woodBridge(s, 108, riverCenter(108), 0, { span: 34, w: 3.6, y: 1.4 });

  // 港口杂物与人
  for (let i = 0; i < 16; i++) {
    const x = rng.range(24, 112);
    const z = riverBankSouth(x) + rng.range(3, 9);
    if (rng.bool(0.5)) P.barrel(s, x, z, rng.range(0, 3), { y: 0.45 });
    else P.crate(s, x, z, rng.range(0, 3), { w: rng.range(0.7, 1.1), h: rng.range(0.5, 0.9), y: 0.45 });
  }
  for (let i = 0; i < 5; i++) P.streetLamp(s, 30 + i * 20, riverBankSouth(30 + i * 20) + 9.5, 0, { y: 0.45 });
  crowd(s, rng, 20, 24, -60, 112, -46, { y: 0.45 });
  P.handcart(s, 68, -56, 1.6);
  P.logPile(s, 104, -58, 1.2);
  return { name: 'harbor' };
}

/* -------------------------------------------------------------------------- */
/*                        ⑥  农田与牧场区 Bauernhof                            */
/* -------------------------------------------------------------------------- */
function buildFarm(s) {
  const rng = new Rng(6006);
  // 谷仓 + 粮仓
  s.push(-58, 0, -152, 0.18);
  B.barn(s, { w: 15, d: 21, h: 7.4 });
  s.pop();
  s.push(-42, 0, -158, 0);
  B.silo(s, { r: 3.1, h: 15 });
  s.pop();
  // 农舍
  s.push(-80, 0, -132, 0.1);
  B.house(s, {
    w: 13,
    d: 11,
    floors: 2,
    floorH: 3.0,
    wall: MAT.plasterWhite,
    wallUp: MAT.plasterWhite,
    halfTimber: true,
    roof: MAT.thatch,
    roofType: 'gable',
    ridge: 'x',
    roofH: 5.4,
    shutters: MAT.shutterRed,
    flowers: true,
    dormers: 2,
    chimneys: 1,
    chimneySize: 0.3,
    rng,
  });
  s.pop();
  P.fenceLine(s, [
    [-90, -124],
    [-70, -124],
    [-70, -140],
  ], { h: 1.0, rails: true });
  P.flowerBed(s, -80, -124.5, 0, { w: 9, d: 1.4 });
  P.well(s, -70, -128, 0.5);
  P.handcart(s, -66, -136, 1.1);
  P.logPile(s, -88, -140, 0.3);

  // 风车（田间高处）
  s.push(-126, 0, -136, 0.4);
  B.windmill(s, { h: 14.5, rBottom: 4.7, rTop: 3.1 });
  s.pop();
  s.flat(MAT.dirt, 22, 22, -126, 0.08, -136, 0.4, 4);
  // 第二座：柱式小风车（车身会随风转向）
  s.push(-94, 0, -160, -0.5);
  M.postMill(s, { h: 6.6, speed: 0.75 });
  s.pop();
  s.flat(MAT.dirt, 13, 13, -94, 0.08, -160, -0.5, 3);
  P.fenceLine(s, [
    [-100, -154],
    [-88, -154],
  ], { h: 0.9, rails: true });

  // 农田：麦田 / 菜畦 / 犁沟
  const cropGeo = (() => {
    const a = G.makeQuad(0.5, 0.85, 1, true);
    const b = G.makeQuad(0.5, 0.85, 1, true);
    b.rotateY(Math.PI / 2);
    return G.mergeMany([a, b]);
  })();
  const fields = [
    { x0: -140, z0: -196, x1: -96, z1: -152, mat: MAT.crop, n: 1100 },
    { x0: -92, z0: -196, x1: -52, z1: -168, mat: MAT.cropGreen, n: 900 },
    { x0: -34, z0: -186, x1: -6, z1: -140, mat: MAT.crop, n: 800 },
  ];
  for (const f of fields) {
    s.flat(MAT.soil, f.x1 - f.x0, f.z1 - f.z0, (f.x0 + f.x1) / 2, 0.07, (f.z0 + f.z1) / 2, 0, 6);
    const ms = [];
    for (let i = 0; i < f.n; i++) {
      const x = rng.range(f.x0 + 1, f.x1 - 1);
      const z = rng.range(f.z0 + 1, f.z1 - 1);
      ms.push(G.trs(x, heightAt(x, z) + 0.05, z, rng.range(0, TAU), rng.range(0.8, 1.35)));
    }
    const im = G.instanced(cropGeo, f.mat, ms, false);
    im.receiveShadow = false;
    s.dynamic.add(im);
    // 田埂
    P.fenceLine(s, [
      [f.x0, f.z0],
      [f.x1, f.z0],
      [f.x1, f.z1],
      [f.x0, f.z1],
      [f.x0, f.z0],
    ], { h: 0.8, rails: true });
  }
  // 犁沟
  for (let i = 0; i < 14; i++) {
    s.box(MAT.soil, 30, 0.18, 0.8, -70, 0.1, -138 - i * 1.7, 0, 2);
  }
  // 牧场与动物
  P.fenceLine(s, [
    [-52, -140],
    [-14, -140],
    [-14, -112],
    [-52, -112],
    [-52, -140],
  ], { h: 1.1, rails: true, mat: MAT.woodGrey });
  for (let i = 0; i < 7; i++) {
    const x = rng.range(-50, -16);
    const z = rng.range(-138, -114);
    P.sheep(s, x, z, rng.range(0, TAU), { scale: rng.range(0.85, 1.1), y: heightAt(x, z) });
  }
  for (let i = 0; i < 4; i++) {
    const x = rng.range(-48, -20);
    const z = rng.range(-136, -116);
    P.cow(s, x, z, rng.range(0, TAU), { scale: rng.range(0.95, 1.1), y: heightAt(x, z) });
  }
  P.horse(s, -60, -122, 1.2, { scale: 1.05 });
  P.waterTrough(s, -30, -142, 0);
  // 干草
  P.haystack(s, -44, -144, 0, { scale: 1.1 });
  P.haystack(s, -38, -146, 0.6, { scale: 0.9 });
  for (let i = 0; i < 5; i++) P.hayBale(s, -62 + i * 3.4, -156, rng.range(-0.2, 0.2));
  P.scarecrow(s, -20, -170, 0.6);
  P.scarecrow(s, -110, -186, -0.4);
  // 果园
  for (let i = 0; i < 5; i++) {
    for (let k = 0; k < 4; k++) {
      const x = -104 + i * 6.5;
      const z = -134 + k * 6.5;
      P.treeRound(s, x, z, rng.range(0, TAU), { scale: rng.range(0.62, 0.78), i: k, y: heightAt(x, z) });
    }
  }
  // 农庄池塘
  const pondC = [-24, -186];
  s.disc(MAT.waterStill, 9, pondC[0], 0.16, pondC[1], 22);
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * TAU;
    s.ball(MAT.stoneDark, rng.range(0.5, 0.95), pondC[0] + Math.cos(a) * 9.3, 0.1, pondC[1] + Math.sin(a) * 9.3, 6);
  }
  for (let i = 0; i < 5; i++) {
    P.duck(s, pondC[0] + rng.range(-6, 6), pondC[1] + rng.range(-6, 6), rng.range(0, TAU), { y: 0.16 });
  }
  P.bush(s, -16, -180, 0, { scale: 1.2 });
  P.treePine(s, -8, -196, 0, { scale: 1.2 });
  P.treePine(s, -132, -128, 0, { scale: 1.4 });
  P.treeRound(s, -128, -140, 0, { scale: 1.3, i: 1 });
  crowd(s, rng, 8, -100, -150, -30, -120);
  return { name: 'farm' };
}

/* -------------------------------------------------------------------------- */
/*                     ⑦  火车站与工业区 Bahnhof & Industrie                   */
/* -------------------------------------------------------------------------- */
function buildStation(s) {
  const rng = new Rng(7007);
  // 铁轨（主线 + 侧线）
  P.railway(s, [[36, 127], [252, 127]], { gauge: 1.6 });
  P.railway(s, [[120, 137], [214, 137]], { gauge: 1.6 });
  // 车站主楼（正面朝镇里 = -Z）
  s.push(150, 0, 110, Math.PI);
  B.station(s, { w: 26, d: 12 });
  s.pop();
  // 站台雨棚
  s.push(150, 0, 121, 0);
  B.platform(s, { len: 46, w: 9 });
  s.pop();
  for (let i = 0; i < 4; i++) {
    P.bench(s, 134 + i * 11, 119.5, Math.PI, { y: 1.12 });
    P.streetLamp(s, 132 + i * 12, 123.4, 0, { h: 3.2, y: 1.12 });
  }
  P.handcart(s, 141, 118, 1.6, { y: 1.12, load: true });
  P.crate(s, 160, 118.6, 0.4, { y: 1.12, w: 1.0, h: 0.8 });
  P.crate(s, 161, 119.2, 1.2, { y: 1.92, w: 0.8, h: 0.6 });
  P.sack(s, 163, 118.4, 0, { y: 1.12 });
  crowd(s, rng, 14, 130, 117, 172, 124, { y: 1.12 });

  // 水塔
  s.push(196, 0, 118, 0);
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      s.box(MAT.timberDark, 0.5, 8.4, 0.5, sx * 2.4, 0, sz * 2.4, 0, 1.4);
      s.boxC(MAT.timber, 0.3, 7.2, 0.3, sx * 1.2, 4.2, sz * 2.4, 0, 0, sx * 0.32, 1.2);
    }
  s.box(MAT.timber, 6.0, 0.3, 0.3, 0, 4.2, 2.4);
  s.box(MAT.timber, 6.0, 0.3, 0.3, 0, 4.2, -2.4);
  s.cyl(MAT.woodPlankV, 3.6, 3.6, 5.0, 0, 8.4, 0, 16, 0, 2);
  for (let i = 0; i < 3; i++) s.torus(MAT.metalRust, 3.65, 0.12, 0, 9.4 + i * 1.6, 0, Math.PI / 2, 0, 0, 18);
  s.cone(MAT.roofSlate, 4.2, 1.8, 0, 13.4, 0, 16);
  s.bar(MAT.metal, 0.28, 4.4, -2.2, 8.0, 0, 'x', 10);
  s.cyl(MAT.metal, 0.28, 0.28, 1.8, -4.4, 6.4, 0, 10);
  s.pop();

  // 货棚
  s.push(116, 0, 116, Math.PI);
  B.warehouse(s, { w: 20, d: 12, h: 7.6, wall: MAT.brickTan, roof: MAT.roofSlate });
  s.pop();
  // 煤堆与货场
  for (let i = 0; i < 3; i++) {
    s.push(206 + i * 9, 0, 132, 0);
    s.box(MAT.stoneDark, 8, 0.9, 7, 0, 0, 0, 0, 2);
    s.cone(MAT.coal, 3.4, 2.6, 0, 0.9, 0, 10);
    s.cone(MAT.coal, 2.2, 1.8, 2.2, 0.9, 1.6, 8);
    s.pop();
  }
  // 信号与电线杆
  for (let i = 0; i < 7; i++) {
    const x = 60 + i * 26;
    s.cyl(MAT.timberDark, 0.16, 0.22, 7.4, x, 0, 134, 8);
    s.box(MAT.timber, 2.6, 0.16, 0.16, x, 6.6, 134);
    s.box(MAT.timber, 2.0, 0.16, 0.16, x, 5.8, 134);
    for (const sd of [-1, 1]) {
      s.cyl(MAT.glass, 0.09, 0.09, 0.22, x + sd * 1.1, 6.76, 134, 6);
      s.cyl(MAT.glass, 0.09, 0.09, 0.22, x + sd * 0.8, 5.96, 134, 6);
    }
  }
  s.push(178, 0, 132, 0);
  s.cyl(MAT.metal, 0.2, 0.28, 8.0, 0, 0, 0, 10);
  s.box(MAT.doorRed, 0.3, 1.6, 0.14, 0, 6.2, 0.2, 0.4);
  s.cyl(MAT.lampGlass, 0.26, 0.26, 0.5, 0, 5.6, 0.4, 8);
  s.box(MAT.metal, 1.4, 0.16, 0.16, 0.7, 7.6, 0);
  s.pop();

  // 工厂
  s.push(186, 0, 74, Math.PI);
  B.factory(s, { w: 24, d: 15, h: 9.5 });
  s.pop();
  s.flat(MAT.gravel, 46, 26, 176, 0.07, 92, 0, 5);
  P.fenceLine(s, [
    [154, 62],
    [154, 88],
  ], { h: 1.6, mat: MAT.woodGrey });
  P.logPile(s, 160, 66, 0);
  P.barrel(s, 166, 88, 0.4);
  P.barrel(s, 167, 89, 1.4);
  P.crate(s, 200, 96, 0.3, { w: 1.2, h: 0.9 });

  /* ---- 蒸汽机车（往复行驶，会在站台停车） ---- */
  const { group: loco } = B.train(s);
  s.attach(loco, 60, 0.42, 127, Math.PI / 2);
  const X0 = 52;
  const X1 = 246;
  const STOP = 150;
  s.onUpdate((dt, t) => {
    const cycle = 96;
    const p = (t % cycle) / cycle;
    let x;
    let dir = 1;
    if (p < 0.34) {
      // 进站
      const u = p / 0.34;
      x = X0 + (STOP - X0) * (1 - Math.pow(1 - u, 2.2));
      dir = 1;
    } else if (p < 0.46) {
      x = STOP;
      dir = 1;
    } else if (p < 0.8) {
      const u = (p - 0.46) / 0.34;
      x = STOP + (X1 - STOP) * Math.pow(u, 1.6);
      dir = 1;
    } else {
      const u = (p - 0.8) / 0.2;
      x = X1 - (X1 - X0) * u;
      dir = -1;
    }
    loco.position.x = x;
    loco.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  });
  return { name: 'station' };
}

/* -------------------------------------------------------------------------- */
/*                          ⑧  公园与林地 Stadtpark                            */
/* -------------------------------------------------------------------------- */
function buildPark(s) {
  const rng = new Rng(8008);
  // 草坪与砾石小径
  s.flat(MAT.grassDark, 104, 108, -136, 0.05, 76, 0, 8);
  const paths = [
    [[-132, 58], [-120, 70], [-124, 90], [-140, 104], [-158, 108]],
    [[-124, 90], [-104, 96], [-96, 116]],
    [[-140, 62], [-158, 72], [-170, 92], [-166, 116]],
    [[-120, 70], [-140, 62]],
  ];
  for (const p of paths) s.ribbon(MAT.gravel, p, 4.2, 0.09, 3);

  // 八角音乐亭
  s.push(-134, 0, 66, 0);
  P.gazebo(s, 0, 0, 0, { r: 4.0 });
  s.pop();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    P.bench(s, -134 + Math.cos(a) * 8.5, 66 + Math.sin(a) * 8.5, -a + Math.PI / 2);
  }
  // 法式对称花坛
  s.push(-116, 0, 78, 0);
  s.flat(MAT.gravel, 26, 26, 0, 0.08, 0, 0, 4);
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      P.hedgeRow(s, sx * 6, sz * 6, 9, sz > 0 ? 0 : 0, { h: 0.75, d: 0.7 });
      P.hedgeRow(s, sx * 6, sz * 6, 9, Math.PI / 2, { h: 0.75, d: 0.7 });
      P.flowerBed(s, sx * 6, sz * 6, 0, { w: 6.4, d: 6.4 });
    }
  P.fountain(s, 0, 0, { r: 2.6 });
  s.pop();
  // 湖 + 小舟 + 野鸭
  const lake = [-160, 100];
  for (const [dx, dz, r] of [[0, 0, 13], [10, -6, 8], [-9, 6, 7.5]]) {
    s.disc(MAT.waterStill, r, lake[0] + dx, 0.14, lake[1] + dz, 26);
  }
  for (let i = 0; i < 34; i++) {
    const a = (i / 34) * TAU;
    const rr = 13.4 + Math.sin(a * 3) * 1.2;
    s.ball(MAT.stone, rng.range(0.5, 1.0), lake[0] + Math.cos(a) * rr, 0.1, lake[1] + Math.sin(a) * rr, 6);
  }
  P.boat(s, lake[0] - 3, lake[1] + 2, 0.7, { scale: 0.55, sail: false, y: 0.2, phase: 1.1 });
  for (let i = 0; i < 7; i++) {
    P.duck(s, lake[0] + rng.range(-9, 9), lake[1] + rng.range(-8, 8), rng.range(0, TAU), { y: 0.16 });
  }
  // 玻璃温室
  s.push(-104, 0, 112, 0);
  s.box(MAT.stone, 14, 1.0, 9, 0, 0, 0, 0, 2.2);
  s.box(MAT.brickRed, 14, 1.4, 9, 0, 1.0, 0, 0, 1.6);
  for (let i = -3; i <= 3; i++) {
    s.box(MAT.white, 0.2, 4.0, 0.2, i * 2.2, 2.4, 4.4);
    s.box(MAT.white, 0.2, 4.0, 0.2, i * 2.2, 2.4, -4.4);
  }
  s.panel(MAT.glass, 13.6, 3.9, 0, 2.4, 4.42, 0, 2.4);
  s.panel(MAT.glass, 13.6, 3.9, 0, 2.4, -4.42, Math.PI, 2.4);
  s.panel(MAT.glass, 8.8, 3.9, 6.95, 2.4, 0, Math.PI / 2, 2.4);
  s.panel(MAT.glass, 8.8, 3.9, -6.95, 2.4, 0, -Math.PI / 2, 2.4);
  s.gable(MAT.glass, 14.2, 9.4, 3.0, 0, 6.4, 0, 0, 2.4, 'slopes');
  s.gable(MAT.white, 14.2, 9.4, 3.0, 0, 6.4, 0, 0, 2, 'ends');
  s.box(MAT.white, 14.4, 0.24, 0.24, 0, 9.3, 0);
  s.box(MAT.white, 14.4, 0.2, 0.2, 0, 6.4, 4.6);
  s.box(MAT.white, 14.4, 0.2, 0.2, 0, 6.4, -4.6);
  B.doorUnit(s, 0, 1.0, 4.5, 0, { w: 1.6, h: 2.6, door: MAT.white, arch: true, frame: MAT.white, steps: true, transom: false });
  for (let i = 0; i < 4; i++) {
    P.bush(s, -5 + i * 3.4, 2.0, 0, { scale: 0.7, mat: MAT.leafC });
    P.bush(s, -5 + i * 3.4, -2.0, 0, { scale: 0.6, mat: MAT.leafA });
  }
  s.pop();
  // 雕像与拱廊
  P.statue(s, -112, 42, Math.PI);
  s.push(-150, 0, 60, 0.3);
  for (let i = 0; i < 6; i++) {
    s.arch(MAT.white, 4.2, 3.6, 0.6, 2.6, 3.0, 0, 0, i * 4.2 - 10.5, Math.PI / 2, 8, 1.6);
    s.box(MAT.leafB, 4.4, 0.5, 1.0, 0, 3.6, i * 4.2 - 10.5, 0, 1);
  }
  s.pop();
  // 树木与设施
  for (let i = 0; i < 70; i++) {
    const x = rng.range(-188, -86);
    const z = rng.range(22, 130);
    if (Math.hypot(x - lake[0], z - lake[1]) < 16) continue;
    if (Math.hypot(x + 134, z - 66) < 12) continue;
    if (Math.abs(x + 116) < 15 && Math.abs(z - 78) < 15) continue;
    const y = heightAt(x, z);
    const k = rng.f();
    if (k < 0.5) P.treeRound(s, x, z, rng.range(0, TAU), { scale: rng.range(0.9, 1.4), i, y });
    else if (k < 0.72) P.treePine(s, x, z, rng.range(0, TAU), { scale: rng.range(0.9, 1.3), y });
    else if (k < 0.9) P.treePoplar(s, x, z, rng.range(0, TAU), { scale: rng.range(0.9, 1.25), y });
    else P.bush(s, x, z, rng.range(0, TAU), { scale: rng.range(0.9, 1.6) });
  }
  for (const p of paths[0]) P.streetLamp(s, p[0] + 3, p[1], 0);
  for (let i = 0; i < 8; i++) {
    const a = paths[1][i % 3];
    P.bench(s, a[0] + rng.range(-4, 4), a[1] + rng.range(-4, 4), rng.range(0, TAU));
  }
  P.flowerBed(s, -132, 52, 0, { w: 8, d: 1.6 });
  P.flowerBed(s, -144, 88, Math.PI / 2, { w: 7, d: 1.6 });
  crowd(s, rng, 22, -180, 30, -92, 126);
  return { name: 'park' };
}

/* -------------------------------------------------------------------------- */
/*                         桥梁 / 河岸 / 收尾设施                              */
/* -------------------------------------------------------------------------- */
function buildInfra(s) {
  const rng = new Rng(9009);
  // 主街石拱桥
  P.stoneBridge(s, 0, riverCenter(0), 0, { span: 46, w: 13, rise: 2.0, deckY: 1.7, arches: 3 });
  // 桥头堡与雕像
  for (const sd of [-1, 1]) {
    for (const sz of [-1, 1]) {
      s.push(sd * 7.4, 0, riverCenter(0) + sz * 23.5, 0);
      s.box(MAT.stoneDark, 2.4, 3.4, 2.4, 0, 0, 0, 0, 1.8);
      s.cyl(MAT.stone, 0.9, 1.0, 0.6, 0, 3.4, 0, 12, 0, 1.2);
      s.ball(MAT.stoneDark, 0.85, 0, 4.4, 0, 12);
      s.pop();
    }
  }
  P.streetLamp(s, -7.6, riverCenter(0) - 12, 0);
  P.streetLamp(s, 7.6, riverCenter(0) - 12, 0);
  P.streetLamp(s, -7.6, riverCenter(0) + 12, 0);
  P.streetLamp(s, 7.6, riverCenter(0) + 12, 0);

  // 河岸绿化与芦苇
  for (let i = 0; i < 150; i++) {
    const x = rng.range(-300, 300);
    if (Math.abs(x) < 22) continue;
    if (x > 18 && x < 118) continue; // 港区已有码头
    const side = rng.bool() ? 1 : -1;
    const z = riverCenter(x) + side * (RIVER.width / 2 + rng.range(0.5, 4));
    const y = heightAt(x, z);
    const k = rng.f();
    if (k < 0.4) {
      // 芦苇丛
      for (let j = 0; j < 5; j++) {
        s.box(MAT.cropGreen, 0.08, rng.range(1.0, 1.8), 0.08, x + rng.range(-0.8, 0.8), y, z + rng.range(-0.8, 0.8), rng.range(0, TAU), 1);
      }
    } else if (k < 0.75) P.bush(s, x, z, rng.range(0, TAU), { scale: rng.range(0.8, 1.3), y });
    else P.treeRound(s, x, z, rng.range(0, TAU), { scale: rng.range(0.9, 1.4), i, y });
  }
  // 西面山岗上的塔式风车（天际线地标）
  {
    const wx = -212;
    const wz = 40;
    const wy = heightAt(wx, wz);
    s.push(wx, wy, wz, 0.9);
    B.windmill(s, { h: 13, rBottom: 4.4, rTop: 3.0, speed: 0.33 });
    s.pop();
    s.flat(MAT.dirt, 20, 20, wx, wy + 0.08, wz, 0.9, 4);
    P.fenceLine(s, [
      [wx - 9, wz + 8],
      [wx + 9, wz + 8],
    ], { h: 0.9, y: wy, rails: true });
    P.logPile(s, wx + 7, wz + 5, 0.3, { y: wy });
  }
  return { name: 'infra' };
}

/* -------------------------------------------------------------------------- */
/*                      会动的：镇民 / 车马 / 牲畜 / 小船                      */
/* -------------------------------------------------------------------------- */

/** 镇民的散步路线（沿街道；y 用于站台、码头等高台） */
const WALK_ROUTES = [
  // 主街北段：进广场后绕开喷泉
  { pts: [[0, -56], [0, -14], [-8, -6], [-8, 10], [0, 18], [0, 26]], n: 6, spread: 3.0 },
  { pts: [[0, 28], [0, 118]], n: 6, spread: 3.6 }, // 主街南段
  { pts: [[-116, 0], [-30, 0]], n: 5, spread: 3.2 }, // 东西大街西段
  { pts: [[32, 0], [110, 0]], n: 9, spread: 3.2, speed: 0.9 }, // 商业街
  { pts: [[-18, -13], [18, -13], [18, 15], [-18, 15], [-18, -13]], n: 7, spread: 1.3 }, // 广场环
  { pts: [[-60, 54], [60, 54]], n: 6, spread: 3.0 },
  { pts: [[-52, 94], [52, 94]], n: 5, spread: 2.8 },
  { pts: [[-30, -6], [-48, -18], [-64, -24], [-80, -26], [-92, -22]], n: 4, spread: 2.4 }, // 教堂巷
  { pts: [[-90, -3], [-52, -3]], n: 4, spread: 2.0 }, // 教堂前广场
  { pts: [[26, -63], [44, -64], [64, -66], [86, -64], [106, -62]], y: 0.45, n: 6, spread: 3.0 }, // 码头
  { pts: [[-132, 58], [-120, 70], [-124, 90], [-140, 104], [-156, 108]], n: 5, spread: 1.7 }, // 公园小径
  { pts: [[-124, 90], [-104, 96], [-96, 114]], n: 3, spread: 1.6 },
  { pts: [[132, 119], [170, 119]], y: 1.12, n: 5, spread: 1.5 }, // 站台
  { pts: [[-24, -127], [-52, -141], [-76, -156]], n: 3, spread: 2.2 }, // 农庄土路
  { pts: [[-84, -122], [-56, -122]], n: 2, spread: 1.6 }, // 农舍门前
];

/** 马车 / 板车 */
const VEHICLES = [
  { kind: 'coach', pts: [[36, 3.4], [106, 3.4]], speed: 3.4, phase: 0.1 }, // 商业街
  { kind: 'coach', pts: [[3.4, 116], [3.4, 30]], speed: 3.9, phase: 0.55 }, // 主街
  { kind: 'wagon', pts: [[-24, -128], [-52, -142], [-76, -157]], speed: 2.1, phase: 0.3 }, // 农庄
  { kind: 'cart', pts: [[28, -56], [48, -62], [68, -64], [90, -62], [104, -60]], speed: 2.5, y: 0.45, phase: 0.8 }, // 码头
  { kind: 'coach', pts: [[10, 111], [56, 111], [104, 105], [144, 99]], speed: 4.4, phase: 0.4 }, // 车站路
];

function buildMotion(root, updates) {
  // 镇民
  const walkers = M.createWalkers(WALK_ROUTES, 20240607);
  root.add(walkers.group);
  updates.push(walkers.update);
  // 车马
  for (const v of VEHICLES) {
    const veh = M.createVehicle(v);
    root.add(veh.group);
    updates.push(veh.update);
  }
  // 牧场羊群
  const flock = M.createFlock([{ x: -33, z: -126, r: 15, n: 9 }]);
  root.add(flock.mesh);
  updates.push(flock.update);
  // 野鸭
  const ducks = M.createDucks([
    { x: -24, z: -186, r: 8, n: 5 },
    { x: -160, z: 100, r: 12, n: 6, y: 0.16 },
  ]);
  root.add(ducks.mesh);
  updates.push(ducks.update);
  // 公园湖上的划桨小船
  const row = M.createRowBoat({
    pts: [[-168, 94], [-156, 105], [-149, 97], [-158, 88], [-168, 94]],
    speed: 0.55,
    y: 0.2,
  });
  root.add(row.group);
  updates.push(row.update);
  return { walkers: walkers.count, vehicles: VEHICLES.length };
}

/* -------------------------------------------------------------------------- */
/*                                  总装                                      */
/* -------------------------------------------------------------------------- */
const BUILDERS = {
  plaza: buildPlaza,
  market: buildMarket,
  cathedral: buildCathedral,
  residential: buildResidential,
  harbor: buildHarbor,
  farm: buildFarm,
  station: buildStation,
  park: buildPark,
};

export function buildTown() {
  const root = new THREE.Group();
  root.name = 'town';
  const updates = [];
  const anchors = { smoke: [], glow: [], fountain: [] };
  const stats = { pieces: 0, meshes: 0 };

  // 街道单独一个 Sculptor
  const roadS = new G.Sculptor('roads');
  buildRoads(roadS);
  root.add(roadS.finalize());
  stats.pieces += roadS.pieces;

  for (const d of DISTRICTS) {
    const fn = BUILDERS[d.id];
    if (!fn) continue;
    const s = new G.Sculptor(d.id);
    fn(s);
    const g = s.finalize();
    g.userData.district = d.id;
    root.add(g);
    updates.push(...s.updates);
    for (const k of Object.keys(s.anchors)) {
      if (!anchors[k]) anchors[k] = [];
      anchors[k].push(...s.anchors[k]);
    }
    stats.pieces += s.pieces;
  }

  const infra = new G.Sculptor('infra');
  buildInfra(infra);
  root.add(infra.finalize());
  updates.push(...infra.updates);
  for (const k of Object.keys(infra.anchors)) {
    if (!anchors[k]) anchors[k] = [];
    anchors[k].push(...infra.anchors[k]);
  }
  stats.pieces += infra.pieces;

  // 会动的东西（镇民、车马、牲畜、小船）
  const motion = buildMotion(root, updates);
  stats.walkers = motion.walkers;
  stats.vehicles = motion.vehicles;

  root.traverse((o) => {
    if (o.isMesh) stats.meshes++;
  });
  return { group: root, updates, anchors, stats };
}
