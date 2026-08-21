/* 无头一致性检查：在 node 里加载游戏数据层，校验交叉引用是否完整 */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';

const root = path.resolve(process.argv[2] || '.');
const FILES = (process.argv[3] || 'core,blocks,items,recipes,atlas,worldgen,structures,world,survival,entities')
  .split(',').map((s) => s.trim()).filter(Boolean);

const sandbox = { console, Math, Date, JSON, performance: { now: () => Date.now() } };
sandbox.globalThis = sandbox;
sandbox.window = sandbox;
const ctx = vm.createContext(sandbox);

let loaded = [];
for (const f of FILES) {
  const p = path.join(root, 'src', f + '.js');
  if (!fs.existsSync(p)) { console.log(`- skip ${f}.js (缺失)`); continue; }
  const code = fs.readFileSync(p, 'utf8');
  try { vm.runInContext(code, ctx, { filename: p }); loaded.push(f); }
  catch (e) { console.error(`✗ ${f}.js 运行失败:`, e.message); process.exitCode = 1; }
}
const GF = sandbox.GF;
if (!GF) { console.error('✗ GF 未定义'); process.exit(1); }

const fail = [];
const warn = [];
const ok = (m) => console.log('  ✓ ' + m);

console.log(`\n已加载: ${loaded.join(', ')}`);

/* ---------- 方块 ---------- */
if (GF.Blocks) {
  const B = GF.Blocks;
  ok(`方块 ${B.count()} 种`);
  const texNames = new Set(GF.Atlas ? GF.Atlas.names() : []);
  const missTex = new Set(), missDrop = new Set();
  for (const b of B.list) {
    for (const k of Object.keys(b.tex)) {
      const t = b.tex[k];
      if (texNames.size && !texNames.has(t)) missTex.add(`${b.key}.${k}=${t}`);
    }
    for (const d of (b.drops || [])) {
      if (GF.Items && !GF.Items.get(d.item)) missDrop.add(`${b.key} -> ${d.item}`);
    }
  }
  if (missTex.size) fail.push('缺贴图: ' + [...missTex].join(', '));
  else ok('全部方块贴图名有对应图集格');
  if (missDrop.size) fail.push('掉落物不存在: ' + [...missDrop].join(', '));
  else ok('全部方块掉落物都是合法物品');
}

/* ---------- 图集容量 ---------- */
if (GF.Atlas) {
  const n = GF.Atlas.tileCount(), cap = GF.Atlas.COLS * GF.Atlas.ROWS;
  if (n > cap) fail.push(`图集溢出: ${n} > ${cap}`);
  else ok(`图集 ${n}/${cap} 格`);
  const dup = {};
  for (const nm of GF.Atlas.names()) dup[nm] = (dup[nm] || 0) + 1;
  const d = Object.keys(dup).filter((k) => dup[k] > 1);
  if (d.length) warn.push('图集重名: ' + d.join(', '));
}

/* ---------- 物品 ---------- */
if (GF.Items) {
  ok(`物品 ${GF.Items.count()} 种`);
  const badPlace = [];
  for (const k of GF.Items.order) {
    const it = GF.Items.get(k);
    if (it.place && GF.Blocks && !GF.Blocks.byKey[it.place] && !['snare', 'beartrap'].includes(it.place))
      badPlace.push(`${k} -> ${it.place}`);
  }
  if (badPlace.length) fail.push('放置目标方块不存在: ' + badPlace.join(', '));
  else ok('全部可放置物品都指向合法方块');
  const cats = {};
  for (const k of GF.Items.order) cats[GF.Items.get(k).cat] = (cats[GF.Items.get(k).cat] || 0) + 1;
  console.log('    分类分布:', JSON.stringify(cats));
}

/* ---------- 配方 ---------- */
if (GF.Recipes) {
  ok(`配方 ${GF.Recipes.count()} 条`);
  const bad = [];
  for (const r of GF.Recipes.all) {
    if (!GF.Items.get(r.out)) bad.push(`产物缺失 ${r.out}`);
    for (const [k] of r.ins) if (!GF.Items.get(k)) bad.push(`材料缺失 ${k} (产物 ${r.out})`);
    if (r.needItem && !GF.Items.get(r.needItem)) bad.push(`需求物品缺失 ${r.needItem}`);
    if (r.unlock && !GF.Recipes.UNLOCKS[r.unlock]) bad.push(`未知解锁 ${r.unlock}`);
    if (!GF.Recipes.STATIONS[r.station]) bad.push(`未知工作站 ${r.station}`);
  }
  if (bad.length) fail.push('配方问题: ' + [...new Set(bad)].join(' | '));
  else ok('全部配方的产物/材料/工作站合法');
  // 图纸物品与解锁项对应
  const unlockItems = GF.Items.order.filter((k) => GF.Items.get(k).schematic).map((k) => GF.Items.get(k).schematic);
  const missing = Object.keys(GF.Recipes.UNLOCKS).filter((u) => !unlockItems.includes(u));
  if (missing.length) warn.push('没有对应图纸物品的解锁项: ' + missing.join(', '));
  else ok('每个解锁项都有对应图纸物品');
}

/* ---------- 世界生成 ---------- */
if (GF.WorldGen) {
  const wg = new GF.WorldGen(12345);
  const t0 = Date.now();
  let solid = 0, air = 0, water = 0;
  const CH = GF.CHUNK || 16, H = GF.HEIGHT || 96;
  const hist = {};
  for (let i = 0; i < 6; i++) {
    const cx = [0, 3, -5, 12, 40, -30][i], cz = [0, 4, 7, -9, 25, 60][i];
    const data = wg.generateChunk(cx, cz);
    for (let j = 0; j < data.blocks.length; j++) {
      const id = data.blocks[j];
      if (id === 0) air++; else solid++;
      hist[id] = (hist[id] || 0) + 1;
    }
    water += data.blocks.reduce((a, id) => a + (GF.Blocks.list[id] && GF.Blocks.list[id].liquid ? 1 : 0), 0);
  }
  ok(`生成 6 个区块 用时 ${Date.now() - t0}ms  实心 ${solid} 空气 ${air} 液体 ${water}`);
  const top = Object.entries(hist).sort((a, b) => b[1] - a[1]).slice(0, 12)
    .map(([id, n]) => `${GF.Blocks.list[id].key}:${n}`);
  console.log('    高频方块:', top.join(' '));
  if (solid === 0) fail.push('世界生成没有产生任何实心方块');
}

/* ---------- 地标 ---------- */
if (GF.Landmarks) {
  const L = GF.Landmarks.list;
  ok(`地标 ${L.length} 处`);
  const bad = L.filter((l) => typeof l.build !== 'function');
  if (bad.length) fail.push('地标缺少 build(): ' + bad.map((b) => b.key).join(','));
  const names = L.map((l) => l.name).join('、');
  console.log('    ' + names);
}

/* ---------- 战利品表 ---------- */
if (GF.Loot) {
  const tables = Object.keys(GF.Loot.tables);
  ok(`战利品表 ${tables.length} 个`);
  const bad = [];
  for (const t of tables) for (const e of GF.Loot.tables[t].entries)
    if (!GF.Items.get(e.item)) bad.push(`${t}:${e.item}`);
  if (bad.length) fail.push('战利品表物品缺失: ' + bad.join(', '));
  else ok('全部战利品条目合法');
  // 抽样
  const rnd = GF.util.mulberry32(7);
  const sample = GF.Loot.roll('medical', rnd);
  console.log('    medical 抽样:', sample.map((s) => `${GF.Items.nameOf(s.item)}x${s.n}`).join(', ') || '(空)');
}

/* ---------- 结果 ---------- */
console.log('');
for (const w of warn) console.log('⚠ ' + w);
if (fail.length) { for (const f of fail) console.error('✗ ' + f); process.exitCode = 1; }
else console.log('✅ 全部检查通过');
