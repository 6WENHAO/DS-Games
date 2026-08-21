/* 城区检视工具：生成指定地标周围的区块，输出天际线、方块统计与 ASCII 剖面图。
   用法：node tools/inspect-city.mjs [地标key=cbd] [半径区块=6] */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';

const root = path.resolve('.');
const key = process.argv[2] || 'cbd';
const R = Number(process.argv[3] || 6);

let _seed = 0x1a2b3c4d;
const SeededMath = Object.create(Math);
SeededMath.random = () => {
  _seed = (_seed + 0x6d2b79f5) >>> 0;
  let t = _seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const sandbox = { console, Math: SeededMath, Date, JSON, performance: { now: () => Date.now() } };
sandbox.globalThis = sandbox; sandbox.window = sandbox;
const ctx = vm.createContext(sandbox);
for (const f of ['core', 'blocks', 'items', 'recipes', 'atlas', 'worldgen', 'structures', 'world', 'entities', 'survival', 'quests'])
  vm.runInContext(fs.readFileSync(path.join(root, 'src', f + '.js'), 'utf8'), ctx, { filename: f });
const GF = sandbox.GF;

const L = GF.Landmarks.list.find((x) => x.key === key);
if (!L) { console.error('没有这个地标：' + key); process.exit(1); }

const world = new GF.World(20250101);
const cx0 = Math.floor(L.x / 16), cz0 = Math.floor(L.z / 16);
console.log(`\n=== ${L.icon} ${L.name}  (${L.x}, ${L.z})  r=${L.r} baseY=${GF.Landmarks.baseYOf(world.gen, L)} ===\n`);

const t0 = Date.now();
let nch = 0;
for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) { world.generateNow(cx0 + dx, cz0 + dz); nch++; }
const ms = Date.now() - t0;
console.log(`生成 ${nch} 区块 / ${ms}ms（平均 ${(ms / nch).toFixed(1)}ms，城区是最重的情况）\n`);

/* ---------- 方块统计 ---------- */
const count = {};
let maxY = 0, maxAt = null;
for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
  const c = world.getChunk(cx0 + dx, cz0 + dz);
  for (let i = 0; i < c.blocks.length; i++) {
    const id = c.blocks[i];
    if (!id) continue;
    count[GF.Blocks.list[id].key] = (count[GF.Blocks.list[id].key] || 0) + 1;
  }
  for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
    const h = c.heightMap[x + z * 16];
    if (h > maxY) { maxY = h; maxAt = [c.cx * 16 + x, c.cz * 16 + z]; }
  }
}
const interesting = ['glass', 'glass_dirty', 'glass_broken', 'glass_pane_green', 'concrete', 'concrete_cracked',
  'concrete_mossy', 'rebar_concrete', 'cinderblock', 'asphalt', 'road_line', 'tile_dirty', 'tile_white',
  'vine', 'thick_vine', 'moss_carpet', 'grass_tall', 'leaves_oak', 'log_oak', 'rich_soil', 'rubble',
  'ladder', 'metal_grate', 'rusty_metal', 'metal_panel', 'wreck_metal', 'lamp_off', 'water_dirty', 'plaster'];
console.log('主要方块：');
for (const k of interesting) if (count[k]) console.log(`  ${(GF.Blocks.byKey[k].name + '').padEnd(8)} ${String(count[k]).padStart(7)}`);
const glass = ['glass', 'glass_dirty', 'glass_broken', 'glass_pane_green'].reduce((a, k) => a + (count[k] || 0), 0);
const green = ['vine', 'thick_vine', 'moss_carpet', 'grass_tall', 'leaves_oak', 'log_oak', 'moss_ground', 'rich_soil', 'fern', 'bush_berry']
  .reduce((a, k) => a + (count[k] || 0), 0);
console.log(`\n幕墙玻璃 ${glass} 块 · 绿植相关 ${green} 块 · 最高点 y=${maxY} @ (${maxAt})`);

/* ---------- 天际线（沿 X 取每列最高点） ---------- */
const z0 = L.z;
const H = GF.HEIGHT;
const skyRows = 26;
const base = GF.Landmarks.baseYOf(world.gen, L);
const grid = [];
for (let r = 0; r < skyRows; r++) grid.push(new Array(120).fill(' '));
for (let i = 0; i < 120; i++) {
  const wx = L.x - 60 + i;
  let top = 0;
  for (let dz = -2; dz <= 2; dz++) {
    for (let y = H - 1; y > 0; y--) {
      const id = world.getBlock(wx, y, z0 + dz);
      if (id > 0 && GF.Blocks.list[id].opaque) { if (y > top) top = y; break; }
    }
  }
  const hgt = Math.round((top - base) / 2);            // 每行 2 格
  for (let r = 0; r < Math.min(skyRows, Math.max(0, hgt)); r++) {
    grid[skyRows - 1 - r][i] = r * 2 + base > base + 4 ? '█' : '▄';
  }
}
console.log('\n天际线剖面（沿 z=' + z0 + '，横跨 120 格，每字符 1 格宽 / 2 格高）：');
for (const row of grid) console.log('  ' + row.join(''));
console.log('  ' + '‾'.repeat(120));

/* ---------- 一栋楼的竖向剖面 ---------- */
// 找最高的那一列，围绕它切一刀
const tx = maxAt[0], tz = maxAt[1];
console.log(`\n最高建筑竖剖面 @ x=${tx}（z ${tz - 12}..${tz + 12}，y ${base - 2}..${maxY + 3}）`);
const legend = { air: '·', vine: 'v', thick_vine: 'V', moss_carpet: ',', grass_tall: '"' };
for (let y = maxY + 3; y >= base - 2; y--) {
  let line = '';
  for (let z = tz - 12; z <= tz + 12; z++) {
    const id = world.getBlock(tx, y, z);
    if (id <= 0) { line += ' '; continue; }
    const k = GF.Blocks.list[id].key;
    let ch = '?';
    if (k.startsWith('glass')) ch = ':';
    else if (k === 'vine') ch = 'v';
    else if (k === 'thick_vine') ch = 'V';
    else if (k.startsWith('leaves')) ch = '#';
    else if (k.startsWith('log')) ch = 'T';
    else if (k === 'ladder') ch = 'H';
    else if (k === 'moss_carpet' || k === 'fern' || k === 'grass_tall') ch = '"';
    else if (k === 'rebar_concrete') ch = 'R';
    else if (k === 'concrete_mossy') ch = 'm';
    else if (k.startsWith('concrete') || k === 'cinderblock' || k.startsWith('tile')) ch = '#';
    else if (k === 'rubble' || k === 'trash_pile') ch = '%';
    else if (k.startsWith('metal') || k === 'rusty_metal' || k === 'sheet_roof') ch = '=';
    else if (k === 'plaster' || k === 'wallpaper' || k === 'plaster_broken') ch = '-';
    else if (k === 'rich_soil' || k === 'dirt' || k === 'grass' || k === 'moss_ground') ch = '.';
    else if (k === 'water' || k === 'water_dirty') ch = '~';
    else ch = 'o';
    line += ch;
  }
  console.log(String(y).padStart(3) + ' |' + line + '|');
}
console.log('    图例  # 混凝土/砖  R 钢筋  m 苔化混凝土  : 玻璃幕墙  v/V 藤蔓  " 苔草  H 爬梯  T/# 树  = 金属  % 瓦砾');

/* ---------- 可达性：能否从底层爬到屋顶 ---------- */
let ladders = 0;
for (let y = base; y < maxY; y++) if (world.getBlockSafe(tx, y, tz) === GF.Blocks.ID.ladder) ladders++;
console.log(`\n该列爬梯格数 ${ladders}（核心筒贯通说明能爬上去）`);
