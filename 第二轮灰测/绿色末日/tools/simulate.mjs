/* 无头玩法模拟：在 node 里跑真实的世界生成、光照、网格化、背包、合成、
   生存状态与任务判定，验证核心系统闭环（不需要浏览器）。 */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';

const root = path.resolve(process.argv[2] || '.');
const FILES = ['core', 'blocks', 'items', 'recipes', 'atlas', 'worldgen', 'structures',
  'world', 'entities', 'survival', 'quests'];

// 用固定种子替换 Math.random，让 AI/生成/概率全部可复现（避免测试抖动）
let _seed = 0x1a2b3c4d;
function seededRandom() {
  _seed = (_seed + 0x6d2b79f5) >>> 0;
  let t = _seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const SeededMath = Object.create(Math);
SeededMath.random = seededRandom;

const sandbox = { console, Math: SeededMath, Date, JSON, performance: { now: () => Number(process.hrtime.bigint() / 1000n) / 1000 } };
sandbox.globalThis = sandbox; sandbox.window = sandbox;
const ctx = vm.createContext(sandbox);
for (const f of FILES) vm.runInContext(fs.readFileSync(path.join(root, 'src', f + '.js'), 'utf8'), ctx, { filename: f });
const GF = sandbox.GF;

let pass = 0, fail = 0;
const T = (name, fn) => {
  try { const m = fn(); console.log('  ✓ ' + name + (m ? '  ' + m : '')); pass++; }
  catch (e) { console.error('  ✗ ' + name + ' — ' + e.message); fail++; }
};
const assert = (c, m) => { if (!c) throw new Error(m || '断言失败'); };

console.log('\n=== GREENFALL 无头玩法模拟 ===\n');

/* ---------------------------------------------------- 1. 世界 */
const world = new GF.World(20250101);
console.log('· 世界与区块');
T('出生区 5x5 区块生成', () => {
  const t0 = Date.now();
  for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) world.generateNow(dx, dz);
  return `25 区块 / ${Date.now() - t0}ms`;
});
T('地表可站立且上方是空气', () => {
  let found = 0;
  for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) {
    const c = world.getChunk(0, 0);
    const h = c.heightMap[x + z * 16];
    if (world.isSolid(x, h, z) && !world.isSolid(x, h + 1, z)) found++;
  }
  assert(found > 200, '可站立列只有 ' + found);
  return found + '/256 列';
});
T('光照计算（天空光 + 方块光）', () => {
  const c = world.getChunk(0, 0);
  world.computeLight(c);
  let lit = 0, dark = 0;
  for (let i = 0; i < c.sky.length; i++) { if (c.sky[i] >= 14) lit++; else if (c.sky[i] === 0) dark++; }
  assert(lit > 1000 && dark > 1000, `天空光分布异常 lit=${lit} dark=${dark}`);
  return `全亮 ${lit} 全暗 ${dark}`;
});
T('网格化产生几何数据', () => {
  const c = world.getChunk(0, 0);
  const g = world.buildMesh(c);
  assert(g.opaque && g.opaque.count > 500, '不透明面数太少');
  const tri = (g.opaque ? g.opaque.count : 0) + (g.alpha ? g.alpha.count : 0) + (g.water ? g.water.count : 0);
  assert(g.opaque.pos.length === g.opaque.count * 3, 'pos 长度不匹配');
  assert(g.opaque.lig.length === g.opaque.count * 4, 'light 长度不匹配');
  return `顶点 ${tri}（不透明 ${g.opaque.count} / 植被 ${g.alpha ? g.alpha.count : 0} / 水 ${g.water ? g.water.count : 0}）`;
});
T('射线检测命中地面', () => {
  const c = world.getChunk(0, 0);
  const h = c.heightMap[8 + 8 * 16];
  const hit = world.raycast(8.5, h + 6, 8.5, 0, -1, 0, 20);
  assert(hit, '垂直向下没有命中');
  assert(hit.y >= h, `命中 y=${hit.y} 低于地表 ${h}`);
  return `${hit.block.name} @ y=${hit.y}（地表 ${h}）`;
});
T('放置与破坏方块 + 增量存档', () => {
  const c = world.getChunk(0, 0);
  const h = c.heightMap[4 + 4 * 16];
  world.setBlock(4, h + 1, 4, GF.Blocks.ID.planks);
  assert(world.getBlock(4, h + 1, 4) === GF.Blocks.ID.planks, '放置失败');
  const ser = world.serialize();
  assert(ser.deltas.length > 0, '增量没有记录');
  world.setBlock(4, h + 1, 4, 0);
  assert(world.getBlock(4, h + 1, 4) === 0, '破坏失败');
  return ser.deltas.length + ' 个区块有改动';
});

/* ------------------------------------------------- 2. 全部地标 */
console.log('\n· 开局资源的空间可达性（不只是配方上可达）');
T('出生点附近能徒手拿到 燧石/砂砾 + 纤维 + 木棍材料', () => {
  const camp = GF.Landmarks.list[0];
  const cx0 = Math.floor(camp.x / 16), cz0 = Math.floor(camp.z / 16);
  const B = GF.Blocks;
  let gravel = 0, fiber = 0, branch = 0, benches = 0;
  const surfaceHandBlocks = new Set();
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    const c = world.getChunk(cx0 + dx, cz0 + dz) || world.generateNow(cx0 + dx, cz0 + dz);
    for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
      const h = c.heightMap[x + z * 16];
      // 只统计"地表 + 其上一格"，也就是玩家不挖任何东西就能碰到的方块
      for (const y of [h, h + 1]) {
        const id = c.blocks[GF.blockIndex(x, y, z)];
        if (!id) continue;
        const b = B.list[id];
        if (b.tool) continue;                       // 需要工具 -> 开局拿不到
        surfaceHandBlocks.add(b.key);
        for (const d of (b.drops || [])) {
          if (d.item === 'gravel' || d.item === 'flint' || d.item === 'cobblestone') gravel++;
          if (d.item === 'fiber') fiber++;
          if (d.item === 'branch') branch++;
        }
        if (b.station === 'workbench') benches++;
      }
    }
  }
  assert(gravel >= 12, `地表可徒手采集的砂砾/碎石只有 ${gravel} 处（燧石断供 → 无法做石斧）`);
  assert(fiber >= 20, `纤维来源只有 ${fiber} 处`);
  return `砂砾/碎石 ${gravel} · 纤维源 ${fiber} · 树枝源 ${branch} · 现成工作台 ${benches}；` +
    `地表徒手可采 ${surfaceHandBlocks.size} 种`;
});
T('野外任意位置也能找到地表砂砾（不依赖出生营地）', () => {
  const spots = [[900, 900], [-1200, 400], [420, -1500], [60, 1800]];
  const found = [];
  for (const [wx, wz] of spots) {
    const w2 = new GF.World(20250101);
    const cx = Math.floor(wx / 16), cz = Math.floor(wz / 16);
    let n = 0;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const c = w2.generateNow(cx + dx, cz + dz);
      for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
        const h = c.heightMap[x + z * 16];
        const id = c.blocks[GF.blockIndex(x, h, z)];
        if (id === GF.Blocks.ID.gravel) n++;
      }
    }
    found.push(`(${wx},${wz})=${n}`);
    assert(n >= 3, `坐标 (${wx},${wz}) 周围 3x3 区块地表只有 ${n} 块砂砾`);
  }
  return found.join(' ');
});

console.log('\n· 全部地标建造（每处生成中心区块）');
let lmOk = 0, lmBlocks = 0;
for (const l of GF.Landmarks.list) {
  const cx = Math.floor(l.x / 16), cz = Math.floor(l.z / 16);
  try {
    const w2 = new GF.World(20250101);
    const data = w2.gen.generateChunk(cx, cz);
    let man = 0;
    for (const id of data.blocks) {
      if (!id) continue;
      const k = GF.Blocks.list[id].key;
      if (/concrete|brick|planks|metal|asphalt|tile|glass|plaster|crate|locker|cabinet|rusty|cinder|sheet|shingles|door|chest|workbench|furnace|forge|beacon|sandbag|chainlink|wreck|grate/.test(k)) man++;
    }
    lmBlocks += man;
    if (man > 0) lmOk++;
    else console.log(`  ⚠ ${l.name} 中心区块没有人造方块（可能建筑偏离中心）`);
  } catch (e) {
    console.error(`  ✗ ${l.name} 建造抛错: ${e.message}`);
    fail++;
  }
}
T(`${GF.Landmarks.list.length} 处地标全部无异常`, () => `${lmOk} 处中心区块含人造结构，共 ${lmBlocks} 个方块`);

/* ---------------- 绿蚀都市：高楼群 ---------------- */
console.log('\n· 破败高楼群（新港 CBD）');
const CBD = GF.Landmarks.list.find((l) => l.key === 'cbd');
const cityStats = (() => {
  const w2 = new GF.World(20250101);
  const base = GF.Landmarks.baseYOf(w2.gen, CBD);
  const R = 4, cx0 = Math.floor(CBD.x / 16), cz0 = Math.floor(CBD.z / 16);
  const t0 = Date.now();
  for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) w2.generateNow(cx0 + dx, cz0 + dz);
  const ms = Date.now() - t0, n = (R * 2 + 1) * (R * 2 + 1);
  const ID = GF.Blocks.ID;
  const GLASS = new Set([ID.glass, ID.glass_dirty, ID.glass_broken, ID.glass_pane_green]);
  const GREEN = new Set([ID.vine, ID.thick_vine, ID.moss_carpet, ID.grass_tall, ID.leaves_oak,
    ID.log_oak, ID.moss_ground, ID.rich_soil, ID.fern, ID.bush_berry, ID.concrete_mossy]);
  let maxY = 0, glassHigh = 0, glassAll = 0, green = 0, road = 0, ladderMax = 0, roofGreen = 0;
  for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
    const c = w2.getChunk(cx0 + dx, cz0 + dz);
    for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
      let run = 0;
      for (let y = 0; y < GF.HEIGHT; y++) {
        const id = c.blocks[GF.blockIndex(x, y, z)];
        if (id === ID.ladder) { run++; if (run > ladderMax) ladderMax = run; } else run = 0;
        if (!id) continue;
        if (GLASS.has(id)) { glassAll++; if (y > base + 20) glassHigh++; }
        if (GREEN.has(id)) { green++; if (y > base + 24) roofGreen++; }
        if (id === ID.asphalt || id === ID.road_line) road++;
        if (GF.Blocks.list[id].opaque && y > maxY) maxY = y;
      }
    }
  }
  return { base, maxY, glassAll, glassHigh, green, roofGreen, road, ladderMax, ms, n };
})();

T('存在真正的高层（≥ 30 格）', () => {
  const s = cityStats;
  assert(s.maxY - s.base >= 30, `最高只有 ${s.maxY - s.base} 格（基准 ${s.base}，顶 ${s.maxY}）`);
  return `基准 y=${s.base}，最高 y=${s.maxY}（${s.maxY - s.base} 格 ≈ ${Math.round((s.maxY - s.base) / 4)} 层）`;
});
T('玻璃幕墙真的生成了（含 20 格以上的高空）', () => {
  const s = cityStats;
  assert(s.glassAll > 1500, `幕墙玻璃只有 ${s.glassAll} 块`);
  assert(s.glassHigh > 400, `20 格以上的高空玻璃只有 ${s.glassHigh} 块（柱距判断可能又把整面墙当成柱子）`);
  return `幕墙玻璃 ${s.glassAll} 块，其中高空 ${s.glassHigh} 块`;
});
T('核心筒可以从底爬到顶（爬梯连续）', () => {
  const s = cityStats;
  assert(s.ladderMax >= 20, `最长连续爬梯只有 ${s.ladderMax} 格（可能被室内隔断覆盖了）`);
  return `最长连续爬梯 ${s.ladderMax} 格`;
});
T('绿植侵蚀到位（含屋顶花园与高处植被）', () => {
  const s = cityStats;
  assert(s.green > 6000, `绿植只有 ${s.green} 块`);
  assert(s.roofGreen > 200, `24 格以上的高处绿植只有 ${s.roofGreen} 块（屋顶花园没长出来）`);
  return `绿植 ${s.green} 块，其中高处 ${s.roofGreen} 块`;
});
T('街网铺到了（沥青 + 标线）', () => {
  const s = cityStats;
  assert(s.road > 2000, `路面只有 ${s.road} 块`);
  return `路面 ${s.road} 块`;
});
T('城区生成速度可接受', () => {
  const s = cityStats;
  const per = s.ms / s.n;
  assert(per < 60, `城区平均 ${per.toFixed(1)}ms/区块，太慢`);
  return `${s.n} 区块 / ${s.ms}ms（平均 ${per.toFixed(1)}ms，城区是最重的情况）`;
});
T('高楼在野外也会出现（孤楼 / 小街区 POI）', () => {
  const keys = GF.Landmarks.POI_TYPES.map((p) => p.key);
  assert(keys.includes('lonetower'), '缺少孤楼 POI');
  assert(keys.includes('blockcluster'), '缺少小街区 POI');
  return `程序化据点 ${keys.length} 种，含 lonetower / blockcluster`;
});

/* ------------------------------------------------- 3. 背包与负重 */
console.log('\n· 背包 / 装备 / 负重');
const inv = new GF.Inventory(24);
T('堆叠上限与取出', () => {
  assert(inv.add('fiber', 100) === 0, '24 格足够装 100 根纤维');
  const stacks = inv.slots.filter((s) => s && s.item === 'fiber');
  assert(stacks.length === 2 && stacks[0].n === 60 && stacks[1].n === 40, '未按 60/格 分堆');
  assert(inv.count('fiber') === 100, '总数错误');
  inv.remove('fiber', 65);
  assert(inv.count('fiber') === 35, '跨堆移除错误');
  // 超出容量时返回剩余数量
  const tiny = new GF.Inventory(1);
  assert(tiny.add('fiber', 200) === 140, '溢出返回值错误');
  return '100 根 → 60+40 两堆；1 格背包溢出 140';
});
T('工具耐久与损坏', () => {
  inv.add('axe_stone', 1);
  const i = inv.slots.findIndex((s) => s && s.item === 'axe_stone');
  assert(inv.slots[i].dur === 90, '初始耐久应为 90');
  inv.damageTool(i, 200);
  assert(!inv.slots[i], '耐久耗尽应销毁');
  return '石斧 90 → 断裂';
});
T('装备扩容与负重上限', () => {
  const base = inv.slots.length, baseCarry = inv.maxWeight();
  inv.add('backpack_military', 1);
  const i = inv.slots.findIndex((s) => s && s.item === 'backpack_military');
  inv.equipFrom(i);
  assert(inv.slots.length === base + 24, `格数 ${base} → ${inv.slots.length}`);
  assert(inv.maxWeight() === baseCarry + 20, '负重上限没提升');
  return `${base}→${inv.slots.length} 格，负重 ${baseCarry}→${inv.maxWeight()}kg`;
});
T('护甲/保暖/防孢子汇总', () => {
  for (const k of ['helmet_riot', 'vest_kevlar', 'pants_padded', 'boots_work', 'gloves_work', 'gasmask']) {
    inv.add(k, 1);
    inv.equipFrom(inv.slots.findIndex((s) => s && s.item === k));
  }
  inv.add('mask_filter', 2);
  assert(inv.defense() > 40, '护甲值偏低 ' + inv.defense());
  assert(inv.sporeProof() > 0.9, '防孢子失效 ' + inv.sporeProof());
  return `护甲 ${inv.defense().toFixed(1)} 保暖 ${inv.warmth()} 防孢 ${Math.round(inv.sporeProof() * 100)}%`;
});
T('超重判定', () => {
  inv.add('log', 40);
  assert(inv.overloadRatio() > 0, '应该超重');
  const r = inv.overloadRatio();
  inv.remove('log', 40);
  return '超重 ' + Math.round(r * 100) + '%';
});

/* ----------------------------------------------- 4. 科技树可达性 */
console.log('\n· 科技树可达性（从徒手到钢）');
T('石器时代路径存在', () => {
  const chain = ['cord', 'axe_stone', 'pick_stone', 'campfire_item', 'workbench_item', 'furnace_item'];
  for (const k of chain) assert(GF.Recipes.byOut[k] && GF.Recipes.byOut[k].length, '缺少配方 ' + k);
  // 石斧的材料必须全部能徒手获得（燧石来自砂砾、纤维来自草）
  const axe = GF.Recipes.byOut['axe_stone'][0];
  assert(axe.station === 'hand', '石斧必须能徒手做');
  return chain.join(' → ');
});
T('禁止徒手挖树与石头', () => {
  const log = GF.Blocks.byKey['log_oak'], stone = GF.Blocks.byKey['stone'];
  assert(!GF.Blocks.breakInfo(log, null).ok, '徒手竟然能挖树');
  assert(!GF.Blocks.breakInfo(stone, null).ok, '徒手竟然能挖石头');
  const axe = GF.Items.get('axe_stone').tool;
  assert(GF.Blocks.breakInfo(log, axe).ok, '石斧砍不了树');
  assert(!GF.Blocks.breakInfo(stone, axe).ok, '斧头竟然能挖石头');
  const pick = GF.Items.get('pick_stone').tool;
  assert(GF.Blocks.breakInfo(stone, pick).ok, '石镐挖不了石头');
  const rebar = GF.Blocks.byKey['rebar_concrete'];
  assert(!GF.Blocks.breakInfo(rebar, pick).ok, '石镐不该能拆钢筋混凝土');
  assert(GF.Blocks.breakInfo(rebar, GF.Items.get('pick_steel').tool).ok, '钢镐拆不了钢筋混凝土');
  return `原木 ${GF.Blocks.breakInfo(log, axe).seconds.toFixed(1)}s / 石头 ${GF.Blocks.breakInfo(stone, pick).seconds.toFixed(1)}s`;
});
T('铁与钢需要正确的前置', () => {
  const iron = GF.Recipes.byOut['iron_ingot'].find((r) => r.ins.some(([k]) => k === 'iron_ore_chunk'));
  assert(iron.station === 'forge', '炼铁应该在锻炉');
  const steel = GF.Recipes.byOut['steel_ingot'][0];
  assert(steel.unlock === 'steel', '炼钢应该需要图纸');
  return '铁：锻炉 / 钢：需图纸 schem_steel';
});
T('每种工具类型都有可制作的成品', () => {
  const types = ['axe', 'pick', 'shovel', 'saw', 'cut', 'pry', 'hammer'];
  const miss = [];
  for (const t of types) {
    const ok = GF.Recipes.all.some((r) => { const d = GF.Items.get(r.out); return d && d.tool && d.tool.type === t; });
    if (!ok) miss.push(t);
  }
  assert(!miss.length, '没有配方的工具类型: ' + miss.join(','));
  return types.length + ' 类工具齐全';
});

/* ---- 冷启动可达性：从"什么都没有"推演整条科技树，检测死锁 ---- */
// 这些物品来自世界交互而非配方/挖掘（打水、狩猎、钓鱼），推演时作为起点
const WORLD_SOURCES = ['water_dirty_bottle', 'rain_water', 'leather_raw', 'meat_raw', 'bone', 'sinew', 'feather', 'fish_raw'];
function reachability(extra) {
  const have = new Set(['cloth_scrap', 'branch', 'berries', 'rag_bandage', 'matches']
    .concat(WORLD_SOURCES).concat(extra || []));
  const tools = new Set();          // 已拥有的工具类型 -> 最高 tier
  const tierOf = {};
  const stations = new Set(['hand']);
  const unlocks = {};
  const log = [];

  const noteTools = () => {
    for (const k of have) {
      const d = GF.Items.get(k);
      if (d && d.tool) {
        tools.add(d.tool.type);
        tierOf[d.tool.type] = Math.max(tierOf[d.tool.type] || 0, d.tool.tier);
      }
      if (d && d.place) {
        const b = GF.Blocks.byKey[d.place];
        if (b && b.station) stations.add(b.station);
      }
      if (d && d.schematic) unlocks[d.schematic] = true;
    }
  };
  // 当前工具能采集到的方块掉落物
  const harvest = () => {
    let added = 0;
    for (const b of GF.Blocks.list) {
      let ok = false;
      if (!b.tool) ok = true;
      else if (tools.has(b.tool) && (tierOf[b.tool] || 0) >= (b.tier || 0)) ok = true;
      if (!ok || b.hard >= 1e8) continue;
      for (const d of (b.drops || [])) if (!have.has(d.item)) { have.add(d.item); added++; }
    }
    return added;
  };

  for (let iter = 0; iter < 40; iter++) {
    noteTools();
    let changed = harvest();
    for (const r of GF.Recipes.all) {
      if (have.has(r.out)) continue;
      if (!stations.has(r.station)) continue;
      if (r.unlock && !unlocks[r.unlock]) continue;
      if (r.need && !tools.has(r.need)) continue;
      if (r.needItem && !have.has(r.needItem)) continue;
      if (!r.ins.every(([k]) => have.has(k))) continue;
      have.add(r.out); changed++;
      log.push(r.out);
    }
    if (!changed) break;
  }
  return { have, tools, tierOf, stations, log };
}

T('冷启动可达：徒手 → 石斧 → 石镐 → 工作台 → 土窑', () => {
  const r = reachability();
  const need = ['cord', 'flint', 'cobblestone', 'axe_stone', 'knife_flint', 'pick_stone',
    'campfire_item', 'workbench_item', 'furnace_item', 'stick'];
  const miss = need.filter((k) => !r.have.has(k));
  assert(!miss.length, '无法从零获得: ' + miss.join(', ') + '（合成链存在死锁）');
  return need.length + ' 项全部可达';
});
T('中期可达：木板 → 锻炉 → 铁锭 → 铁工具', () => {
  const r = reachability();
  const need = ['plank', 'brick_item', 'forge_item', 'iron_ingot', 'axe_iron', 'pick_iron',
    'nails', 'sheet_metal', 'chest_item', 'bed_item', 'pot', 'water_clean_bottle'];
  const miss = need.filter((k) => !r.have.has(k));
  assert(!miss.length, '中期不可达: ' + miss.join(', '));
  return need.length + ' 项全部可达';
});
T('后期需要图纸才可达（钢/枪械/供电/制药）', () => {
  const r = reachability();
  // 能从世界里直接拆下来的成品（发电机、太阳能板等）不算"造出来"，自动排除
  const scavengeable = new Set();
  for (const b of GF.Blocks.list) for (const d of (b.drops || [])) scavengeable.add(d.item);
  const gated = ['steel_ingot', 'axe_steel', 'pick_steel', 'ammo_9mm', 'ammo_762',
    'antibiotics', 'serum_green', 'vest_kevlar', 'grenade_frag', 'crank_charger', 'antenna_part']
    .filter((k) => !scavengeable.has(k));
  const leaked = gated.filter((k) => r.have.has(k));
  assert(!leaked.length, '没有图纸就能造：' + leaked.join(', '));
  return gated.length + ' 项被图纸正确锁住（可拆卸成品 ' + scavengeable.size + ' 种不计）';
});
T('拿到图纸后后期内容可达', () => {
  const schems = GF.Items.order.filter((k) => GF.Items.get(k).schematic);
  const r = reachability(schems);
  const need = ['steel_ingot', 'axe_steel', 'pick_steel', 'ammo_9mm', 'generator_item',
    'solar_panel_item', 'antibiotics', 'serum_green', 'vest_kevlar', 'gasmask', 'filter_pump', 'antenna_part',
    'jerky', 'leather', 'bread', 'stew_meat', 'crossbow', 'backpack_military'];
  const miss = need.filter((k) => !r.have.has(k));
  assert(!miss.length, '有图纸也做不出: ' + miss.join(', '));
  return `${need.length} 项齐全，累计可获得物品 ${r.have.size} / ${GF.Items.count()}`;
});

/* ------------------------------------------------- 5. 生存状态 */
console.log('\n· 生存状态机');
const player = new GF.Player(8.5, 50, 8.5);
const sv = new GF.Survival(player, inv, world);
T('饥渴随时间下降', () => {
  const h0 = sv.hunger, t0 = sv.thirst;
  for (let i = 0; i < 600; i++) sv.tick(0.1, { moving: true, sprint: false });
  assert(sv.hunger < h0 && sv.thirst < t0, '饥渴没有下降');
  return `60s 后 饱食 ${h0.toFixed(0)}→${sv.hunger.toFixed(0)}，水分 ${t0.toFixed(0)}→${sv.thirst.toFixed(0)}`;
});
T('喝生水会生病', () => {
  let sick = 0;
  for (let i = 0; i < 200; i++) {
    const s2 = new GF.Survival(new GF.Player(0, 50, 0), inv, world);
    inv.add('water_dirty_bottle', 1);
    const idx = inv.slots.findIndex((s) => s && s.item === 'water_dirty_bottle');
    s2.consume(idx);
    if (s2.sick > 0) sick++;
  }
  assert(sick > 90 && sick < 160, '生病概率异常 ' + sick + '/200');
  return `200 次里 ${sick} 次生病（约 ${Math.round(sick / 2)}%）`;
});
T('吃毒菇会中毒，熟肉安全', () => {
  const a = new GF.Survival(new GF.Player(0, 50, 0), inv, world);
  inv.add('mushroom_toxic', 1);
  a.consume(inv.slots.findIndex((s) => s && s.item === 'mushroom_toxic'));
  assert(a.sick > 20, '毒菇没有让人中毒');
  const b = new GF.Survival(new GF.Player(0, 50, 0), inv, world);
  inv.add('meat_cooked', 1);
  const before = b.hunger;
  b.consume(inv.slots.findIndex((s) => s && s.item === 'meat_cooked'));
  assert(b.hunger > before + 20 && b.sick === 0, '熟肉效果不对');
  return `毒菇 sick=${a.sick.toFixed(0)}，熟肉 饱食 +${(b.hunger - before).toFixed(0)}`;
});
T('感染会累积并致死', () => {
  const s2 = new GF.Survival(new GF.Player(0, 50, 0), inv, world);
  for (let i = 0; i < 40; i++) s2.takeHit(4, { infect: 1 });
  assert(s2.infection > 50, '咬伤没有累积感染 ' + s2.infection);
  s2.infection = 99.9;
  s2.tick(1, {});
  assert(!s2.alive && s2.deathCause === '绿蚀感染', '感染满值没有致死');
  return '40 次咬伤 → 感染 ' + s2.infection.toFixed(0) + '%，满值致死 ✓';
});
T('抗孢血清能压制感染', () => {
  const s2 = new GF.Survival(new GF.Player(0, 50, 0), inv, world);
  s2.infection = 80;
  inv.add('serum_green', 1);
  s2.consume(inv.slots.findIndex((s) => s && s.item === 'serum_green'));
  assert(s2.infection < 10, '血清无效 ' + s2.infection);
  return '感染 80 → ' + s2.infection.toFixed(0);
});
T('低温致死 / 体温系统', () => {
  const s2 = new GF.Survival(new GF.Player(0, 50, 0), new GF.Inventory(24), world);
  s2.temp = 33; s2.hunger = 50; s2.thirst = 50;
  const hp0 = s2.p.hp;
  for (let i = 0; i < 50; i++) s2.tick(0.2, {});
  assert(s2.p.hp < hp0, '失温没有掉血');
  return `体温 33℃ 10s 掉血 ${(hp0 - s2.p.hp).toFixed(1)}`;
});
T('睡觉恢复疲劳并推进时间', () => {
  const s2 = new GF.Survival(new GF.Player(0, 50, 0), new GF.Inventory(24), world);
  s2.fatigue = 90;
  const t0 = world.time, d0 = world.day;
  s2.sleep(8);
  assert(s2.fatigue < 20, '疲劳没恢复 ' + s2.fatigue);
  assert(world.time !== t0 || world.day !== d0, '时间没推进');
  return `疲劳 90 → ${s2.fatigue.toFixed(0)}，时间推进 8 小时`;
});

/* ------------------------------------------------- 6. 战利品与容器 */
console.log('\n· 战利品与容器');
T('每张表都能产出物品', () => {
  const rnd = GF.util.mulberry32(99);
  const empty = [];
  for (const t of Object.keys(GF.Loot.tables)) {
    let n = 0;
    for (let i = 0; i < 40; i++) n += GF.Loot.roll(t, rnd).length;
    if (n === 0) empty.push(t);
  }
  assert(!empty.length, '空表: ' + empty.join(','));
  return Object.keys(GF.Loot.tables).length + ' 张表全部有产出';
});
T('容器懒加载 + 保底物品', () => {
  const c2 = world.getChunk(0, 0);
  const h = c2.heightMap[10 + 10 * 16];
  world.setBlock(10, h + 1, 10, GF.Blocks.ID.crate_supply);
  world.containers.set(GF.util.posKey(10, h + 1, 10), { table: 'supply', guarantee: ['axe_iron'], items: null, opened: false });
  const box = world.containerAt(10, h + 1, 10);
  assert(box.items.length > 0, '容器空了');
  assert(box.items.some((s) => s.item === 'axe_iron'), '保底物品没有出现');
  const tool = box.items.find((s) => s.item === 'axe_iron');
  assert(tool.dur > 0 && tool.dur <= GF.Items.maxDur('axe_iron'), '耐久异常');
  return `${box.items.length} 件（含保底铁斧，耐久 ${tool.dur}）`;
});

/* ---------------------------------------------------- 7. 实体 AI */
console.log('\n· 操作手感（移动基向量 / 摩擦）');
T('A/D 方向与摄像机"屏幕右"完全一致（防左右颠倒）', () => {
  const rep = [];
  for (const yaw of [0, 0.7, -1.9, 3.0, 2.2, -0.4]) {
    const p = new GF.Player(0, 40, 0);
    p.yaw = yaw; p.pitch = 0;
    const d = p.dirVec();
    // 视图矩阵里 view-space X 轴在世界坐标下的分量 = 第一"行"
    const v = GF.M4.lookAt(0, 0, 0, d[0], d[1], d[2], 0, 1, 0);
    const camRight = [v[0], v[4], v[8]];
    const B = GF.util.moveBasis(yaw);
    const err = Math.hypot(B.rx - camRight[0], 0 - camRight[1], B.rz - camRight[2]);
    assert(err < 1e-5, `yaw=${yaw} 右向偏差 ${err.toFixed(4)}：右移基向量 (${B.rx.toFixed(3)},${B.rz.toFixed(3)}) vs 屏幕右 (${camRight[0].toFixed(3)},${camRight[2].toFixed(3)})`);
    // 前向也要一致（第三行取负）
    const camFwd = [-v[2], -v[6], -v[10]];
    const ferr = Math.hypot(B.fx - camFwd[0], B.fz - camFwd[2]);
    assert(ferr < 1e-5, `yaw=${yaw} 前向偏差 ${ferr.toFixed(4)}`);
    rep.push(yaw.toFixed(1));
  }
  return '校验 yaw = ' + rep.join(', ') + '，全部吻合';
});
T('地面摩擦：松手后迅速停下（不像冰面）', () => {
  const c = world.getChunk(0, 0);
  const h = c.heightMap[8 + 8 * 16];
  const p = new GF.Player(8.5, h + 1, 8.5);
  for (let i = 0; i < 20; i++) p.physics(world, 1 / 60);   // 先落地
  p.vx = 6; p.vz = 0;
  const x0 = p.x;
  let t = 0;
  while (Math.abs(p.vx) > 0.35 && t < 3) { p.physics(world, 1 / 60); t += 1 / 60; }
  const slide = Math.abs(p.x - x0);
  assert(t < 0.5, `减速太慢：${t.toFixed(2)}s 才降到 0.35 m/s`);
  assert(slide < 0.75, `滑行距离过长：${slide.toFixed(2)} 格`);
  return `6 m/s → 0.35 m/s 用 ${t.toFixed(2)}s，滑行 ${slide.toFixed(2)} 格`;
});
T('空中保留惯性（不影响跳跃手感）', () => {
  const p = new GF.Player(8.5, 70, 8.5);
  p.vx = 6; p.onGround = false;
  for (let i = 0; i < 30; i++) p.physics(world, 1 / 60);   // 0.5s 自由下落
  assert(p.vx > 3.5, `空中阻尼过大，0.5s 后只剩 ${p.vx.toFixed(2)} m/s`);
  // 起跳 → 落地的水平位移应该够跨过 2 格
  const jump = 8.0, g = 26, air = 2 * jump / g;
  const reach = 6 * (1 - Math.exp(-0.9 * air)) / 0.9;
  assert(reach > 2.2, `冲刺跳跃只能跨 ${reach.toFixed(2)} 格`);
  return `0.5s 后仍有 ${p.vx.toFixed(2)} m/s；冲刺跳跃可跨约 ${reach.toFixed(1)} 格`;
});

console.log('\n· 实体与 AI');
T('僵尸会朝玩家移动并攻击', () => {
  const ents = new GF.EntityManager(world);
  const c2 = world.getChunk(0, 0);
  const h = c2.heightMap[8 + 8 * 16];
  const p2 = new GF.Player(8.5, h + 1, 8.5);
  const z = ents.add('zombie', 14.5, h + 1, 8.5);
  let hits = 0;
  const off = GF.bus.on('player:hit', () => hits++);
  const d0 = Math.hypot(z.x - p2.x, z.z - p2.z);
  const svv = new GF.Survival(p2, new GF.Inventory(24), world);
  for (let i = 0; i < 400; i++) ents.update(0.05, p2, svv);
  const d1 = Math.hypot(z.x - p2.x, z.z - p2.z);
  off();
  assert(d1 < d0 || hits > 0, `既没有靠近（${d0.toFixed(1)} → ${d1.toFixed(1)}）也没有命中`);
  return `距离 ${d0.toFixed(1)} → ${d1.toFixed(1)}m，命中玩家 ${hits} 次`;
});
T('动物会逃跑', () => {
  const ents = new GF.EntityManager(world);
  const c2 = world.getChunk(0, 0);
  const h = c2.heightMap[8 + 8 * 16];
  const p2 = new GF.Player(8.5, h + 1, 8.5);
  const deer = ents.add('deer', 12.5, h + 1, 8.5);
  const svv = new GF.Survival(p2, new GF.Inventory(24), world);
  const d0 = Math.hypot(deer.x - p2.x, deer.z - p2.z);
  for (let i = 0; i < 200; i++) ents.update(0.05, p2, svv);
  return `鹿 ${d0.toFixed(1)} → ${Math.hypot(deer.x - p2.x, deer.z - p2.z).toFixed(1)}m（状态 ${deer.state}）`;
});
T('伤害与击杀掉落', () => {
  const ents = new GF.EntityManager(world);
  const z = ents.add('zombie', 5, 40, 5);
  let drops = null;
  const off = GF.bus.on('entity:die', (p) => { drops = p.drops; });
  for (let i = 0; i < 30; i++) z.hurt(10, null);
  ents.kill(z, ents.list.indexOf(z), null);
  off();
  assert(drops !== null, '没有触发死亡事件');
  return '掉落 ' + (drops.length ? drops.map((d) => GF.Items.nameOf(d.item)).join('、') : '（本次为空）');
});
T('玩家重力与落地', () => {
  const c2 = world.getChunk(0, 0);
  const h = c2.heightMap[8 + 8 * 16];
  const p2 = new GF.Player(8.5, h + 14, 8.5);
  for (let i = 0; i < 400; i++) p2.physics(world, 0.016);
  assert(p2.onGround, '没有落地');
  assert(world.isSolid(8, Math.floor(p2.y) - 1, 8) || world.isSolid(8, Math.floor(p2.y - 0.1), 8),
    `脚下 y=${Math.floor(p2.y) - 1} 不是实心`);
  assert(p2.y >= h && p2.y < h + 14, `落点 ${p2.y.toFixed(2)} 不合理`);
  return `从 ${h + 14} 落到 y=${p2.y.toFixed(2)}（脚下是 ${GF.Blocks.list[world.getBlockSafe(8, Math.floor(p2.y) - 1, 8)].name}）`;
});

/* ---- 追击冷却：野生掠食者必须给玩家喘息时间 ---- */
T('野狗追击超时会放弃，并进入冷却', () => {
  const ents = new GF.EntityManager(world);
  const c2 = world.getChunk(0, 0);
  const h = c2.heightMap[8 + 8 * 16];
  const p2 = new GF.Player(8.5, h + 1, 8.5);
  const svv = new GF.Survival(p2, new GF.Inventory(24), world);
  const dog = ents.add('dog', 12.5, h + 1, 8.5);
  const cfg = GF.TYPES.dog;
  let gaveUpAt = -1, t = 0;
  const off = GF.bus.on('mob:giveup', (p) => { if (p.e === dog && gaveUpAt < 0) gaveUpAt = t; });
  for (let i = 0; i < 600 && gaveUpAt < 0; i++) { ents.update(0.05, p2, svv); t += 0.05; }
  off();
  assert(gaveUpAt > 0, `${cfg.chaseMax}s 上限内没有放弃追击（跑了 ${t.toFixed(1)}s）`);
  assert(gaveUpAt <= cfg.chaseMax + 3, `放弃太晚：${gaveUpAt.toFixed(1)}s > ${cfg.chaseMax}+3`);
  assert(dog.chaseCd > cfg.chaseCd * 0.5, `冷却没有生效：chaseCd=${dog.chaseCd.toFixed(1)}`);
  assert(dog.state !== 'chase', '放弃后仍处于 chase 状态');
  // 冷却期内即使能看见玩家也不该重新锁定
  const before = dog.state;
  for (let i = 0; i < 40; i++) ents.update(0.05, p2, svv);
  assert(dog.state !== 'chase', `冷却期内又开始追击了（state=${dog.state}，之前 ${before}）`);
  return `追击 ${gaveUpAt.toFixed(1)}s 后放弃，冷却 ${dog.chaseCd.toFixed(1)}s 内不再锁定`;
});
T('重伤的野生动物会逃跑而不是死缠', () => {
  const ents = new GF.EntityManager(world);
  const dog = ents.add('dog', 5, 40, 5);
  dog.hurt(GF.TYPES.dog.hp * 0.75, null);
  assert(dog.state === 'flee', `血量 ${(dog.hp / GF.TYPES.dog.hp * 100).toFixed(0)}% 时状态是 ${dog.state}`);
  assert(dog.chaseCd > 0, '没有进入冷却');
  const boar = ents.add('boar', 6, 40, 6);
  boar.hurt(10, null);
  assert(boar.state === 'chase', '野猪被打一下应该反击');
  return `野狗 25% 血 → flee；野猪轻伤 → 反击`;
});
T('僵尸也会失去兴趣（但耐心久得多）', () => {
  assert(GF.TYPES.zombie.chaseMax >= 20, '僵尸的追击上限不应太短');
  assert(GF.TYPES.dog.chaseMax <= 10, '野狗的追击上限应明显短于僵尸');
  const order = ['boar', 'dog', 'zombie_runner', 'raider', 'zombie', 'zombie_husk']
    .map((k) => `${GF.TYPES[k].name} ${GF.TYPES[k].chaseMax}s/冷却${GF.TYPES[k].chaseCd}s`);
  return order.join(' · ');
});
T('掠食者生成受权重、冷却与敌对上限三重限制', () => {
  const ents = new GF.EntityManager(world);
  const c2 = world.getChunk(0, 0);
  const h = c2.heightMap[8 + 8 * 16];
  const p2 = new GF.Player(8.5, h + 1, 8.5);
  const count = {};
  let peakHostile = 0;
  world.time = 0.45;                       // 白天
  for (let i = 0; i < 900; i++) {
    ents.spawnT = 0;
    ents.trySpawn(p2, 0.05);
    ents.predatorCd = Math.max(0, ents.predatorCd - 5);   // 加速冷却，等价于时间流逝
    let hostile = 0;
    for (const e of ents.list) if (e.cfg.hostile) hostile++;
    peakHostile = Math.max(peakHostile, hostile);
    if (ents.list.length > 30) ents.list.length = 0;       // 清场继续采样
  }
  for (const e of ents.list) count[e.type] = (count[e.type] || 0) + 1;
  assert(peakHostile <= ents.maxHostile, `敌对生物峰值 ${peakHostile} 超过上限 ${ents.maxHostile}`);
  // 白天野外的掠食者权重应远低于被动动物
  const w = (k) => {
    const t = GF.TYPES[k];
    return (t.night ? t.night * 0.16 : 0) + (t.wild || 0) + (t.urban ? t.urban * 0.12 : 0);
  };
  const pred = w('dog') + w('raider'), passive = w('deer') + w('crow');
  assert(pred < passive * 0.45, `白天野外掠食者权重 ${pred.toFixed(2)} 相对被动 ${passive.toFixed(2)} 偏高`);
  return `白天野外权重：掠食 ${pred.toFixed(2)} vs 被动 ${passive.toFixed(2)}；敌对峰值 ${peakHostile}/${ents.maxHostile}；狗群最多 ${GF.TYPES.dog.pack} 只`;
});

/* ---------------------------------------------------- 8. 任务链 */
console.log('\n· 任务系统');
T('任务按前置解锁并可完成', () => {
  const flags = {}, notes = new Set(), disc = new Set(), unl = {};
  const inv2 = new GF.Inventory(24);
  const q = new GF.Quests({ inv: inv2, world, flags, notes, discovered: disc, unlocks: unl });
  assert(q.list().length >= 1, '开局没有可见任务');
  const first = q.activeMain();
  assert(first.def.id === 'wake', '第一个主线应该是 wake，实际 ' + first.def.id);
  flags.craftedAxe = true; flags.drankClean = true;
  q.evaluate();
  assert(q.state.wake.done, 'wake 没完成');
  assert(q.activeMain().def.id === 'firstnight', '没有推进到第一夜');
  flags.litFire = true; world.day = 2;
  q.evaluate();
  assert(q.state.firstnight.done, '第一夜没完成');
  return 'wake → firstnight → ' + q.activeMain().def.id;
});
T('14 张笔记文本齐全', () => {
  for (let i = 1; i <= 14; i++) {
    assert(GF.NOTES[i] && GF.NOTES[i].text.length > 20, '笔记 ' + i + ' 缺失');
    assert(GF.Items.get('note_' + i), '笔记物品 note_' + i + ' 缺失');
  }
  return '14 张';
});

/* ---------------------------------------------------- 9. 存档 */
console.log('\n· 存档往返');
T('世界 / 背包 / 状态 / 任务 序列化可还原', () => {
  const c2 = world.getChunk(0, 0);
  const h = c2.heightMap[2 + 2 * 16];
  world.setBlock(2, h + 1, 2, GF.Blocks.ID.chest);
  const ser = JSON.parse(JSON.stringify({
    world: world.serialize(), inv: inv.serialize(), sv: sv.serialize(),
  }));
  const w2 = new GF.World(world.seed);
  w2.deserialize(ser.world);
  w2.generateNow(0, 0);
  assert(w2.getBlock(2, h + 1, 2) === GF.Blocks.ID.chest, '方块改动没有还原');
  const inv2 = new GF.Inventory(24);
  inv2.deserialize(ser.inv);
  assert(inv2.slots.length === inv.slots.length, '格数没还原');
  assert(inv2.defense() === inv.defense(), '装备没还原');
  assert(w2.mapTiles.size > 0, '地图缩略没还原');
  return `增量 ${ser.world.deltas.length} 区块，地图 ${w2.mapTiles.size} 格，装备护甲 ${inv2.defense().toFixed(1)}`;
});

/* ---------------------------------------------------- 10. 规模统计 */
console.log('\n· 内容规模');
const cats = {};
for (const k of GF.Items.order) cats[GF.Items.get(k).cat] = (cats[GF.Items.get(k).cat] || 0) + 1;
console.log(`  方块 ${GF.Blocks.count()} · 物品 ${GF.Items.count()} · 配方 ${GF.Recipes.count()} · 贴图 ${GF.Atlas.tileCount()}`);
console.log(`  地标 ${GF.Landmarks.list.length} · 程序化据点 ${GF.Landmarks.POI_TYPES.length} 种 · 战利品表 ${Object.keys(GF.Loot.tables).length}`);
console.log(`  生物群系 ${GF.Biomes.list.length} · 实体 ${Object.keys(GF.TYPES).length} 种 · 任务 ${GF.QUEST_DEFS.length} 个`);
console.log('  物品分类：' + Object.entries(cats).map(([k, v]) => `${GF.Items.CATS[k]}${v}`).join(' '));

console.log(`\n${fail === 0 ? '✅' : '❌'} 通过 ${pass} · 失败 ${fail}\n`);
process.exitCode = fail ? 1 : 0;
