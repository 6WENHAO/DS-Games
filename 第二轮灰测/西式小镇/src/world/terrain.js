// ---------------------------------------------------------------------------
// 地形 / 河流 / 街道
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { MAT } from '../lib/materials.js';
import * as G from '../lib/geom.js';
import { hillNoise, smoothstep, Rng } from '../lib/rng.js';

export const MAP_SIZE = 620;

/* --------------------------------- 河流 --------------------------------- */
export const RIVER = { z0: -88, amp: 6.5, freq: 0.0115, width: 26, depth: 3.6, level: -1.0 };

/** 河心线：给定 x 返回 z */
export function riverCenter(x) {
  return RIVER.z0 + RIVER.amp * Math.sin(x * RIVER.freq);
}
/** 河心线切向角（用于摆放码头、船） */
export function riverAngle(x) {
  const d = RIVER.amp * RIVER.freq * Math.cos(x * RIVER.freq);
  return Math.atan(d);
}
/** 南岸（靠镇一侧）岸线 z */
export function riverBankSouth(x) {
  return riverCenter(x) + RIVER.width / 2;
}
export function riverBankNorth(x) {
  return riverCenter(x) - RIVER.width / 2;
}

/* ------------------------------- 地形高度 ------------------------------- */
export function heightAt(x, z) {
  const far = Math.max(Math.abs(x), Math.abs(z));
  const k = smoothstep(165, 300, far); // 镇区平坦，远处起伏
  let h = hillNoise(x, z) * 11 * k;
  const r = Math.hypot(x * 0.85, z);
  h += Math.max(0, (r - 215) * 0.075); // 远山
  // 河谷下切
  const dist = Math.abs(z - riverCenter(x));
  h -= smoothstep(20.5, 12, dist) * RIVER.depth;
  return h;
}

/* ------------------------------- 街道网络 ------------------------------- */
function bankRoad(x0, x1, off, step = 8) {
  const pts = [];
  for (let x = x0; x <= x1 + 0.01; x += step) pts.push([x, riverCenter(x) + off]);
  return pts;
}

export const PLAZA = { w: 58, d: 48 };

export const ROADS = [
  // 南北主街（Königstraße）：北端过桥，南下贯穿住宅区
  { id: 'main-n', pts: [[0, -126], [0, -111]], w: 12, mat: 'cobble' },
  { id: 'main-s', pts: [[0, -65], [0, -24]], w: 12, mat: 'cobble' },
  { id: 'main-s2', pts: [[0, 24], [0, 128]], w: 12, mat: 'cobble' },
  // 东西大街（Kaiserstraße）：西接教堂区，东连集市
  { id: 'cross-w', pts: [[-122, 0], [-29, 0]], w: 11, mat: 'cobble' },
  { id: 'cross-e', pts: [[29, 0], [116, 0]], w: 11, mat: 'cobbleWarm' },
  // 教堂小巷
  { id: 'church', pts: [[-30, -6], [-48, -18], [-64, -24], [-78, -24]], w: 8, mat: 'cobble' },
  // 公园大道
  { id: 'park', pts: [[-30, 8], [-58, 26], [-96, 44], [-132, 58]], w: 9, mat: 'gravel' },
  // 河港滨河路
  { id: 'quay', pts: [[6, -58], [18, -64], ...bankRoad(30, 114, 21, 12)], w: 9, mat: 'cobbleWarm' },
  // 住宅区街巷
  { id: 'res-1', pts: [[-68, 54], [68, 54]], w: 9, mat: 'cobble' },
  { id: 'res-2', pts: [[-58, 94], [58, 94]], w: 8, mat: 'cobble' },
  { id: 'alley-w', pts: [[-42, 36], [-42, 104]], w: 5, mat: 'dirt' },
  { id: 'alley-e', pts: [[42, 36], [42, 104]], w: 5, mat: 'dirt' },
  // 通往车站
  { id: 'station', pts: [[0, 114], [56, 114], [104, 108], [150, 102]], w: 10, mat: 'cobbleWarm' },
  // 通往农庄的土路（过桥往西北）
  { id: 'farm', pts: [[0, -118], [-22, -126], [-52, -140], [-78, -156], [-96, -172]], w: 7, mat: 'dirt' },
  // 农庄内部小路
  { id: 'farm2', pts: [[-52, -140], [-40, -158], [-46, -178]], w: 5, mat: 'dirt' },
];

export const RAILS = [[36, 127], [252, 127]];

/* ------------------------------ 地形网格 -------------------------------- */
export function buildTerrain() {
  const seg = 240;
  const geo = new THREE.PlaneGeometry(MAP_SIZE, MAP_SIZE, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, heightAt(x, z));
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  G.scaleUV(geo, MAP_SIZE / 5, MAP_SIZE / 5);
  const ground = new THREE.Mesh(geo, MAT.grass);
  ground.name = 'ground';
  ground.receiveShadow = true;
  ground.castShadow = false;
  ground.matrixAutoUpdate = false;
  return ground;
}

/* -------------------------------- 水面 ---------------------------------- */
export function buildWater() {
  const group = new THREE.Group();
  group.name = 'water';
  // 河道
  const pts = [];
  for (let x = -MAP_SIZE / 2; x <= MAP_SIZE / 2; x += 10) pts.push([x, riverCenter(x)]);
  const geo = G.makeRibbon(pts, RIVER.width + 3, 26, RIVER.level);
  const river = new THREE.Mesh(geo, MAT.water);
  river.receiveShadow = true;
  group.add(river);
  // 第二层：制造波光
  const geo2 = G.makeRibbon(pts, RIVER.width + 1.5, 17, RIVER.level + 0.12);
  const mat2 = MAT.water.clone();
  mat2.opacity = 0.35;
  mat2.color = new THREE.Color(0xcfe6f2);
  mat2.map = MAT.water.map.clone();
  mat2.map.needsUpdate = true;
  const shimmer = new THREE.Mesh(geo2, mat2);
  group.add(shimmer);

  const updates = [
    (dt, t) => {
      if (MAT.water.map) {
        MAT.water.map.offset.y = (t * 0.035) % 1;
        MAT.water.map.offset.x = Math.sin(t * 0.08) * 0.04;
      }
      mat2.map.offset.y = (-t * 0.021) % 1;
      mat2.map.offset.x = (t * 0.012) % 1;
      mat2.opacity = 0.26 + Math.sin(t * 0.7) * 0.07;
    },
  ];
  return { group, updates };
}

/* ------------------------------ 街道铺装 -------------------------------- */
export function buildRoads(s) {
  const matOf = {
    cobble: MAT.cobble,
    cobbleWarm: MAT.cobbleWarm,
    gravel: MAT.gravel,
    dirt: MAT.dirt,
  };
  for (const r of ROADS) {
    s.ribbon(matOf[r.mat] ?? MAT.cobble, r.pts, r.w, 0.07, 4.5);
    // 路缘石
    if (r.mat === 'cobble' || r.mat === 'cobbleWarm') {
      for (const sd of [-1, 1]) {
        const off = r.pts.map(([x, z], i, arr) => {
          const j = Math.min(i, arr.length - 2);
          const dx = arr[j + 1][0] - arr[j][0];
          const dz = arr[j + 1][1] - arr[j][1];
          const l = Math.hypot(dx, dz) || 1;
          return [x + (-dz / l) * sd * (r.w / 2 + 0.35), z + (dx / l) * sd * (r.w / 2 + 0.35)];
        });
        s.ribbon(MAT.stone, off, 0.8, 0.13, 2);
      }
    }
  }
  // 中央广场铺装
  s.flat(MAT.cobbleWarm, PLAZA.w, PLAZA.d, 0, 0.09, 0, 0, 4);
  s.flat(MAT.stone, PLAZA.w - 8, PLAZA.d - 8, 0, 0.11, 0, 0, 5);
  s.flat(MAT.cobble, 22, 22, 0, 0.13, 0, Math.PI / 4, 3);
  // 广场四周台阶边界
  for (const sd of [-1, 1]) {
    s.box(MAT.stone, PLAZA.w + 1.6, 0.22, 0.8, 0, 0, (sd * PLAZA.d) / 2, 0, 2);
    s.box(MAT.stone, 0.8, 0.22, PLAZA.d + 1.6, (sd * PLAZA.w) / 2, 0, 0, 0, 2);
  }
}

/* ------------------------- 远景森林（实例化） ---------------------------- */
export function buildForest(rng = new Rng(4242)) {
  const group = new THREE.Group();
  group.name = 'forest';
  const trunkGeo = G.makeCyl(0.22, 0.4, 3.0, 6, 1.4);
  const pineGeo = (() => {
    const parts = [];
    for (let i = 0; i < 3; i++) {
      const g = G.makeCone(2.0 - i * 0.42, 3.2 - i * 0.2, 8, 2);
      g.translate(0, 1.6 + i * 2.1, 0);
      parts.push(g);
    }
    return G.mergeMany(parts);
  })();
  const ballGeo = (() => {
    const parts = [];
    const a = G.makeBall(1.9, 8, 2);
    a.translate(0, 4.4, 0);
    const b = G.makeBall(1.35, 8, 2);
    b.translate(-1.2, 3.5, 0.4);
    const c = G.makeBall(1.2, 8, 2);
    c.translate(1.1, 3.7, -0.5);
    parts.push(a, b, c);
    return G.mergeMany(parts);
  })();

  const trunks = [];
  const pines = [];
  const broad = [[], [], []];
  const leafMats = [MAT.leafA, MAT.leafB, MAT.leafC];
  const inTown = (x, z) =>
    (Math.abs(x) < 130 && Math.abs(z) < 145) ||
    (x > 90 && x < 210 && z > 30 && z < 145) ||
    (x > -150 && x < 0 && z > -200 && z < -100) ||
    Math.abs(z - riverCenter(x)) < 26;

  for (let i = 0; i < 1500; i++) {
    const x = rng.range(-MAP_SIZE / 2 + 20, MAP_SIZE / 2 - 20);
    const z = rng.range(-MAP_SIZE / 2 + 20, MAP_SIZE / 2 - 20);
    if (inTown(x, z)) continue;
    const y = heightAt(x, z);
    if (y < -1.2) continue;
    const s = rng.range(0.75, 1.5);
    const ry = rng.range(0, Math.PI * 2);
    trunks.push(G.trs(x, y - 0.2, z, ry, s));
    if (rng.bool(0.45)) pines.push(G.trs(x, y - 0.2, z, ry, s));
    else broad[rng.int(0, 2)].push(G.trs(x, y - 0.2, z, ry, s));
  }
  group.add(G.instanced(trunkGeo, MAT.trunk, trunks));
  if (pines.length) group.add(G.instanced(pineGeo, MAT.pine, pines));
  broad.forEach((list, i) => {
    if (list.length) group.add(G.instanced(ballGeo, leafMats[i], list));
  });
  return group;
}
