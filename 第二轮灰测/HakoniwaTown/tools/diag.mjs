/** 诊断：打印指定位置的地形与放置信息 */
import * as THREE from 'three';
import { buildTerrain } from '../src/world/terrain.js';
import { buildWater, riverSurfaceAt } from '../src/world/water.js';
import { buildTown } from '../src/world/town.js';
import { makeRailCurve, groundHeight, baseHeight, riverDist } from '../src/world/layout.js';

const scene = new THREE.Scene();
const terrain = buildTerrain(scene);
buildWater(scene);
const town = buildTown(scene, { railCurve: makeRailCurve(), roadCurve: terrain.roadCurve });

const targets = [
  ['house', -12.6, 19.6], ['watermill', -7.6, 13.4], ['church', -2.5, -14.0],
  ['house', -18.6, -8.0], ['waterTower', -7.2, -21.2], ['swing', -11.4, -22.6],
];

for (const [name, x, z] of targets) {
  const p = town.placements.find((q) => q.name === name && Math.abs(q.x - x) < 0.3 && Math.abs(q.z - z) < 0.3);
  console.log(`\n== ${name} @(${x},${z})`);
  if (!p) { console.log('   未找到 placement'); continue; }
  console.log(`   放置 y=${p.y.toFixed(2)}  minY=${p.minY.toFixed(2)}  bbox x[${p.minX.toFixed(1)},${p.maxX.toFixed(1)}] z[${p.minZ.toFixed(1)},${p.maxZ.toFixed(1)}]`);
  const cx = (p.minX + p.maxX) / 2, cz = (p.minZ + p.maxZ) / 2;
  const hx = ((p.maxX - p.minX) / 2) * 0.45, hz = ((p.maxZ - p.minZ) / 2) * 0.45;
  for (const [sx, sz] of [[cx, cz], [cx - hx, cz - hz], [cx + hx, cz - hz], [cx - hx, cz + hz], [cx + hx, cz + hz]]) {
    console.log(`   sample (${sx.toFixed(2)},${sz.toFixed(2)}) base=${baseHeight(sx, sz).h.toFixed(2)} ground=${groundHeight(sx, sz).toFixed(2)} river=${riverDist(sx, sz).dist.toFixed(2)}`);
  }
}
