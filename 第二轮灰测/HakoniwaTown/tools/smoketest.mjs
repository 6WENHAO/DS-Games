/**
 * 无头自检：在 Node 里真实构建整个场景图（不需要 WebGL），
 * 检查合批是否成功、有无 NaN、物件是否贴地、动画更新是否报错。
 * 运行：node tools/smoketest.mjs
 */
import * as THREE from 'three';
import { buildTerrain } from '../src/world/terrain.js';
import { buildWater, riverSurfaceAt } from '../src/world/water.js';
import { buildTown } from '../src/world/town.js';
import { buildLife } from '../src/world/life.js';
import { buildSky } from '../src/world/sky.js';
import { makeRailCurve, groundHeight, baseHeight } from '../src/world/layout.js';

const problems = [];
const origError = console.error.bind(console);
const origWarn = console.warn.bind(console);
console.error = (...a) => { problems.push('console.error: ' + a.join(' ')); origError(...a); };
console.warn = (...a) => { problems.push('console.warn: ' + a.join(' ')); origWarn(...a); };

const t0 = Date.now();
const scene = new THREE.Scene();
const railCurve = makeRailCurve();

const terrain = buildTerrain(scene);
const water = buildWater(scene);
const town = buildTown(scene, { railCurve, roadCurve: terrain.roadCurve });
const life = buildLife(scene, { railCurve, roadCurve: terrain.roadCurve, riverSurfaceAt });
const fakeRenderer = { toneMappingExposure: 1 };
const sky = buildSky(scene, fakeRenderer);
const buildMs = Date.now() - t0;

/* ---------- 统计 ---------- */
let meshes = 0, tris = 0, nanMeshes = 0, hugeMeshes = 0;
const mats = new Set();
const box = new THREE.Box3();
scene.updateMatrixWorld(true);
scene.traverse((o) => {
  if (!o.isMesh && !o.isPoints && !o.isLine) return;
  if (o.isMesh) meshes++;
  if (o.material) mats.add(o.material.uuid);
  const g = o.geometry;
  if (!g || !g.attributes.position) return;
  if (o.isMesh) tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
  const arr = g.attributes.position.array;
  let bad = false;
  for (let i = 0; i < arr.length; i++) if (!Number.isFinite(arr[i])) { bad = true; break; }
  if (bad) { nanMeshes++; problems.push(`NaN 顶点: ${o.name || o.type}`); }
  if (!Number.isFinite(o.position.x + o.position.y + o.position.z)) {
    problems.push(`NaN 位置: ${o.name || o.type} @ ${o.position.toArray()}`);
  }
  g.computeBoundingBox();
  box.copy(g.boundingBox).applyMatrix4(o.matrixWorld);
  if (box.max.length() > 900 && !['skyDome', 'sunDisc'].includes(o.name)) hugeMeshes++;
});

/* ---------- 高度场检查：地面是否连续、台地是否成阶 ---------- */
const samples = [
  ['港口 quay', 1, 22.5, 1.95], ['下城 lowtown', -1, 12.5, 3.5], ['广场 plaza', -2, 0.5, 6.7],
  ['集市 market', 17, 2, 5.3], ['车站 station', 24.5, 6.5, 8.7], ['上城 uptown', -8, -14.5, 10.6],
  ['农场 farm', 16, -15, 8.4], ['山肩 shoulder', -19, -19, 13.8], ['山顶 hilltop', -21, -23, 17.2],
  ['游乐场 fair', 22, 20, 2.7],
];
const heightReport = samples.map(([name, x, z, want]) => {
  const got = baseHeight(x, z).h;
  const ok = Math.abs(got - want) < 0.9;
  if (!ok) problems.push(`台地高度异常 ${name}: 期望≈${want} 实得 ${got.toFixed(2)}`);
  return `${ok ? '✓' : '✗'} ${name}: ${got.toFixed(2)} (期望 ${want})`;
});

/* ---------- 建筑是否贴地（悬空 / 埋没检查） ---------- */
let floatCount = 0, sinkCount = 0;
const floatList = [];
for (const p of town.placements) {
  const cx = (p.minX + p.maxX) / 2, cz = (p.minZ + p.maxZ) / 2;
  const hx = ((p.maxX - p.minX) / 2) * 0.45;
  const hz = ((p.maxZ - p.minZ) / 2) * 0.45;
  const pts = [
    [cx, cz],
    [cx - hx, cz - hz], [cx + hx, cz - hz],
    [cx - hx, cz + hz], [cx + hx, cz + hz],
  ];
  let minGap = Infinity, maxSink = -Infinity;
  for (const [x, z] of pts) {
    const g = groundHeight(x, z);
    minGap = Math.min(minGap, p.minY - g);
    maxSink = Math.max(maxSink, g - p.minY);
  }
  if (minGap > 0.55) { floatCount++; floatList.push(`悬空 ${p.name} @(${p.x.toFixed(1)},${p.z.toFixed(1)}) 间隙 ${minGap.toFixed(2)}`); }
  else if (maxSink > 1.7) { sinkCount++; floatList.push(`埋没 ${p.name} @(${p.x.toFixed(1)},${p.z.toFixed(1)}) 深度 ${maxSink.toFixed(2)}`); }
}

/* ---------- 物件互相穿插 / 压占道路 检查 ---------- */
import { ROAD_PTS, RAIL_PTS } from '../src/world/layout.js';
import { distToPolyline } from '../src/lib/utils.js';

const overlaps = [];
const pl = town.placements;
for (let i = 0; i < pl.length; i++) {
  for (let j = i + 1; j < pl.length; j++) {
    const a = pl[i], b = pl[j];
    const ox = Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX);
    const oz = Math.min(a.maxZ, b.maxZ) - Math.max(a.minZ, b.minZ);
    if (ox <= 0.15 || oz <= 0.15) continue;
    const areaA = (a.maxX - a.minX) * (a.maxZ - a.minZ);
    const areaB = (b.maxX - b.minX) * (b.maxZ - b.minZ);
    const frac = (ox * oz) / Math.max(0.01, Math.min(areaA, areaB));
    if (frac > 0.32) {
      overlaps.push(`${a.name}@(${a.x.toFixed(1)},${a.z.toFixed(1)}) ∩ ${b.name}@(${b.x.toFixed(1)},${b.z.toFixed(1)}) 重叠 ${(frac * 100).toFixed(0)}%`);
    }
  }
}

const onRoad = [];
const railXZ = RAIL_PTS.map((p) => [p[0], p[1]]);
for (const p of pl) {
  const cx = (p.minX + p.maxX) / 2, cz = (p.minZ + p.maxZ) / 2;
  const rad = Math.max(0.5, Math.min((p.maxX - p.minX), (p.maxZ - p.minZ)) / 2 - 0.45);
  const dRoad = distToPolyline(cx, cz, ROAD_PTS).dist;
  if (dRoad < rad + 1.55) onRoad.push(`${p.name}@(${p.x.toFixed(1)},${p.z.toFixed(1)}) 距路 ${dRoad.toFixed(2)} (需 >${(rad + 1.55).toFixed(2)})`);
  const dRail = distToPolyline(cx, cz, railXZ).dist;
  if (dRail < rad + 2.2) onRoad.push(`${p.name}@(${p.x.toFixed(1)},${p.z.toFixed(1)}) 距铁轨 ${dRail.toFixed(2)}`);
}

/* ---------- 铁路是否被地形埋没 ---------- */
const railProblems = [];
let minRailClear = Infinity;
{
  const N = 300;
  for (let i = 0; i < N; i++) {
    const u = i / N;
    const p = railCurve.getPointAt(u);
    if (Math.hypot(p.x - 2.0, p.z + 27.6) < 8) continue; // 隧道段
    const clear = p.y - groundHeight(p.x, p.z);
    if (clear < minRailClear) minRailClear = clear;
    if (clear < 0.4) railProblems.push(`轨道埋入地形 @(${p.x.toFixed(1)},${p.z.toFixed(1)}) 净空 ${clear.toFixed(2)}`);
  }
}

/* ---------- 动画：跑若干帧，覆盖白天与夜晚 ---------- */
let elapsed = 0;
for (let i = 0; i < 90; i++) {
  const dt = 1 / 60;
  elapsed += dt;
  const hours = (i / 90) * 24;
  sky.apply(hours, elapsed);
  sky.update(dt, elapsed);
  water.update(elapsed);
  town.update(dt, elapsed, sky.state.night, hours);
  life.update(dt, elapsed, sky.state.night);
}

/* ---------- 动态物体是否仍然有限 ---------- */
let badDyn = 0;
life.root.traverse((o) => {
  if (!Number.isFinite(o.position.x + o.position.y + o.position.z)) { badDyn++; problems.push(`动态物件 NaN: ${o.name}`); }
});

/* ---------- 关键内容清单 ---------- */
const names = new Set();
scene.traverse((o) => { if (o.name) names.add(o.name); });
const required = ['ground', 'slab', 'roads', 'stonework', 'sea', 'river', 'town', 'townLive', 'life', 'sky', 'railway'];
for (const r of required) if (!names.has(r)) problems.push(`缺少关键节点: ${r}`);

console.log('──────── 箱庭小镇 无头自检 ────────');
console.log(`构建耗时      : ${buildMs} ms`);
console.log(`Mesh 数量     : ${meshes}（材质 ${mats.size}）`);
console.log(`三角面        : ${(tris / 1000).toFixed(1)}k`);
console.log(`炊烟锚点      : ${town.chimneys.length}`);
console.log(`路灯光晕      : ${town.lampSpots.length}`);
console.log(`喷泉水柱      : ${town.jets.length}`);
console.log(`瀑布落点      : ${water.falls.length}`);
console.log(`旋转件        : ${town.spinners.length}  钟面: ${town.clocks.length}`);
console.log(`行人          : ${life.people.length}  车辆: ${life.cars.length}  海鸥: ${life.birds.length}`);
console.log(`超远物件      : ${hugeMeshes}   NaN 几何: ${nanMeshes}  动态 NaN: ${badDyn}`);
console.log('台地高度：');
for (const line of heightReport) console.log('  ' + line);
console.log(`贴地检查      : ${town.placements.length} 个物件，悬空 ${floatCount}，埋没 ${sinkCount}`);
for (const l of floatList.slice(0, 25)) console.log('  ! ' + l);
console.log(`互相穿插      : ${overlaps.length}`);
for (const l of overlaps.slice(0, 20)) console.log('  ! ' + l);
console.log(`压占道路/铁轨 : ${onRoad.length}`);
for (const l of onRoad.slice(0, 20)) console.log('  ! ' + l);

if (problems.length) {
  console.log(`\n⚠ 发现 ${problems.length} 个问题：`);
  for (const p of problems.slice(0, 40)) console.log('  - ' + p);
  process.exitCode = 1;
} else {
  console.log('\n✅ 全部检查通过');
}
