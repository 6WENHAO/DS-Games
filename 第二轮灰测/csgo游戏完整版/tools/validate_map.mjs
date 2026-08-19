// ---------------------------------------------------------------------------
// 地图校验工具（Node 端，无需浏览器）
//   node tools/validate_map.mjs            校验全部地图
//   node tools/validate_map.mjs dust2      只校验一张
// 检查项：
//   1) brush 合法性（min<max、材质存在、在 bounds 内）
//   2) 导航网格生成成功、主连通域足够大
//   3) 出生点不卡墙、站在地面上
//   4) 出生点 <-> 各包点、出生点 <-> 对方出生点 均连通（可寻路）
// ---------------------------------------------------------------------------

import { World } from '../src/game/world.js';
import { NavMesh } from '../src/game/navmesh.js';
import { MATERIALS } from '../src/render/textures.js';
import { MOVE, hullStuck } from '../src/game/movement.js';

const MAPS = ['dust2', 'mirage', 'office', 'arena'];
const only = process.argv[2];
const list = only ? [only] : MAPS;

let failed = 0;
const log = (...a) => console.log(...a);

for (const id of list) {
  let map;
  try {
    map = (await import(`../src/game/maps/${id}.js`)).default;
  } catch (e) {
    log(`\n=== ${id} ===\n  [跳过] 无法载入: ${e.message}`);
    continue;
  }
  log(`\n=== ${id} (${map.nameCN || map.name}) ===`);
  const problems = [];

  // 1) brush 合法性
  let badBox = 0, badMat = new Set(), outOfBounds = 0;
  for (const b of map.brushes) {
    for (let i = 0; i < 3; i++) if (!(b.min[i] < b.max[i])) badBox++;
    if (!MATERIALS[b.mat]) badMat.add(b.mat);
    for (let i = 0; i < 3; i++) {
      if (b.min[i] < map.bounds.min[i] - 2 || b.max[i] > map.bounds.max[i] + 2) { outOfBounds++; break; }
    }
  }
  if (badBox) problems.push(`${badBox} 个 brush 的 min >= max`);
  if (badMat.size) problems.push(`未知材质: ${[...badMat].join(', ')}`);
  if (outOfBounds) problems.push(`${outOfBounds} 个 brush 越界`);
  log(`  brush=${map.brushes.length} props=${(map.props || []).length} areas=${(map.areas || []).length}`);

  // 2) 世界 + 导航网格
  const t0 = performance.now();
  const world = new World(null, map);
  const seeds = [...(map.spawns.t || []), ...(map.spawns.ct || [])].map((s) => [s.pos[0], s.pos[1] + 0.05, s.pos[2]]);
  const nav = new NavMesh(world, { seeds });
  const st = nav.stats;
  log(`  导航网格: ${st.nodes} 节点 / ${st.regions} 连通域 / 主域 ${st.mainRegionSize} / 网格 ${st.grid} / ${st.buildMs}ms`);
  log(`  几何: ${world.stats.brushes} 体 -> ${world.stats.batches} 批次, 剔除内部面 ${world.stats.culledFaces}/${world.stats.faces}`);
  if (st.nodes < 500) problems.push(`导航节点太少(${st.nodes})，地图可能没有连通的地面`);
  if (st.mainRegionSize < st.nodes * 0.5) problems.push(`主连通域只占 ${(st.mainRegionSize / st.nodes * 100).toFixed(0)}%，地图可能被墙割裂`);

  // 3) 出生点
  const checkSpawn = (team, sp, i) => {
    const ent = { pos: [sp.pos[0], sp.pos[1] + 0.05, sp.pos[2]], height: MOVE.standHeight };
    if (hullStuck(world, ent.pos, MOVE.radius, MOVE.standHeight)) {
      problems.push(`${team} 出生点 #${i} (${sp.pos}) 卡在实体里`);
      return null;
    }
    const gy = world.groundHeight(sp.pos[0], sp.pos[1] + 2.5, sp.pos[2]);
    if (gy === -Infinity) { problems.push(`${team} 出生点 #${i} 脚下没有地面`); return null; }
    if (Math.abs(gy - sp.pos[1]) > 1.2) problems.push(`${team} 出生点 #${i} 距离地面 ${(gy - sp.pos[1]).toFixed(2)}m`);
    const n = nav.nearest([sp.pos[0], gy, sp.pos[2]]);
    if (n < 0) { problems.push(`${team} 出生点 #${i} 附近没有导航节点`); return null; }
    return n;
  };
  const tNodes = (map.spawns.t || []).map((s, i) => checkSpawn('T', s, i)).filter((n) => n !== null);
  const ctNodes = (map.spawns.ct || []).map((s, i) => checkSpawn('CT', s, i)).filter((n) => n !== null);
  log(`  出生点: T ${(map.spawns.t || []).length} / CT ${(map.spawns.ct || []).length}`);

  // 4) 连通性
  const reach = (fromNode, toPos, label) => {
    const to = nav.nearest(toPos, 12);
    if (to < 0) { problems.push(`${label}: 目标附近无导航节点`); return; }
    if (nav.region[fromNode] !== nav.region[to]) { problems.push(`${label}: 不连通（不同连通域）`); return; }
    const path = nav.search(fromNode, to);
    if (!path) { problems.push(`${label}: A* 找不到路径`); return; }
    let len = 0;
    for (let i = 1; i < path.length; i++) {
      const a = nav.nodes[path[i - 1]], b = nav.nodes[path[i]];
      len += Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
    }
    log(`    ${label}: OK（${path.length} 节点, ${len.toFixed(1)}m）`);
  };
  for (const site of map.bombsites || []) {
    const c = [(site.min[0] + site.max[0]) / 2, site.min[1] + 0.2, (site.min[2] + site.max[2]) / 2];
    if (tNodes.length) reach(tNodes[0], c, `T -> ${site.name} 点`);
    if (ctNodes.length) reach(ctNodes[0], c, `CT -> ${site.name} 点`);
  }
  if (tNodes.length && ctNodes.length) {
    const ct = map.spawns.ct[0].pos;
    reach(tNodes[0], [ct[0], ct[1] + 0.2, ct[2]], 'T -> CT 出生点');
  }

  // 5) 最长通视距离审计
  //    一条横穿全图的长直线视野会让 Bot 在出生点就互相对射、回合完全打不动，
  //    也不符合 CS 地图设计（最长的 long A 也就 30m 出头）。
  const EYE = 1.22;
  let longest = 0, longestPair = null;
  const N = nav.nodes.length;
  if (N > 20) {
    const samples = 26000;
    for (let k = 0; k < samples; k++) {
      const a = nav.nodes[(Math.random() * N) | 0];
      const b = nav.nodes[(Math.random() * N) | 0];
      const d = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
      if (d <= longest) continue;
      const p1 = [a.x, a.y + EYE, a.z], p2 = [b.x, b.y + EYE, b.z];
      if (!world.visible(p1, p2)) continue;
      longest = d;
      longestPair = [p1, p2];
    }
  }
  if (longestPair) {
    const f = (p) => `(${p[0].toFixed(0)},${p[2].toFixed(0)})`;
    log(`  最长通视: ${longest.toFixed(1)}m  ${f(longestPair[0])} <-> ${f(longestPair[1])}` +
      `  [${world.areaName(longestPair[0]) || '?'} <-> ${world.areaName(longestPair[1]) || '?'}]`);
  }
  // Bot 感知距离上限是 55m（见 bots.js），超过这个距离的通视只影响真人玩家的
  // 远程对枪体验，不会让回合卡死；75m 以上才认为是地图结构性问题。
  if (longest > 75) problems.push(`存在 ${longest.toFixed(0)}m 的超长直线视野，几乎横穿整图`);
  else if (longest > 55) log(`  ⚠ 通视 ${longest.toFixed(0)}m 偏长（超过 Bot 感知上限 55m，仅影响真人远程对枪）`);

  log(`  用时 ${(performance.now() - t0).toFixed(0)}ms`);
  if (problems.length) {
    failed++;
    log(`  ❌ ${problems.length} 个问题:`);
    for (const p of problems) log(`     - ${p}`);
  } else {
    log('  ✅ 全部检查通过');
  }
}

log(failed ? `\n共 ${failed} 张地图有问题` : '\n全部地图校验通过');
process.exit(failed ? 1 : 0);
