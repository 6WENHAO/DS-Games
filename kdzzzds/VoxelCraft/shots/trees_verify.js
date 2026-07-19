/* shots/trees_verify.js - 树生成规则块级自检（无需浏览器）
 * ① 樱花片区占比上限 ② 树种齐全 ③ 片区单一树种 ④ 树址质检 ⑤ 无巨树 ⑥ LOD 同源 ⑦ 注册完整 */
const fs = require('fs');
const vm = require('vm');
const GEN_MODULE = require('../js/gen.js');
const LOD_MODULE = require('../js/lod.js');
const G = {};
GEN_MODULE(G);
LOD_MODULE(G);
G.setSeed(20260718);

let pass = 0, fail = 0;
function check(name, ok, detail) {
  console.log((ok ? '  ✓ ' : '  ✗ ') + name + (detail ? '  [' + detail + ']' : ''));
  if (ok) pass++; else fail++;
}
const LOGS = { 25: 1, 26: 2, 27: 3, 89: 4, 92: 5, 95: 6, 98: 7, 101: 8 };
const GIANT_IDS = [28, 36, 104, 105, 106, 107, 108, 109];

/* ---------- ①② 树种片区占比（pickTree 面积占比，全域散点） ---------- */
console.log('== ①② 树种片区占比（±8km 散点 25 万）==');
{
  const stats = {};
  for (let i = 0; i < 250000; i++) {
    const x = (((i * 2654435761) >>> 0) % 16000) - 8000, z = (((i * 1103515245 + 12345) >>> 0) % 16000) - 8000;
    const c = G.column(x, z);
    if (c.h <= G.SEA) continue;
    if (c.biome !== G.B_FOREST && c.biome !== G.B_PLAINS && c.biome !== G.B_BASIN) continue;
    const t = G.pickTree(x, z, c.biome, c.h);
    const s = stats[c.biome] || (stats[c.biome] = { total: 0, ty: {} });
    s.total++; s.ty[t] = (s.ty[t] || 0) + 1;
  }
  for (const b of Object.keys(stats)) {
    const s = stats[b];
    console.log(`  [${G.BIOME_NAMES[b]}] n=${s.total}  ` +
      Object.keys(s.ty).sort((a, b2) => a - b2).map(t => t + ':' + (s.ty[t] / s.total * 100).toFixed(1) + '%').join(' '));
  }
  const f = stats[G.B_FOREST], p = stats[G.B_PLAINS], ba = stats[G.B_BASIN];
  check('森林樱花片 ≤14%', (f.ty[3] || 0) / f.total <= 0.14, ((f.ty[3] || 0) / f.total * 100).toFixed(1) + '%');
  check('平原樱花片 ≤10%', (p.ty[3] || 0) / p.total <= 0.10, ((p.ty[3] || 0) / p.total * 100).toFixed(1) + '%');
  check('盆地樱花片 ≤9%', (ba.ty[3] || 0) / ba.total <= 0.09, ((ba.ty[3] || 0) / ba.total * 100).toFixed(1) + '%');
  const seen = new Set();
  for (const b of Object.keys(stats)) for (const t of Object.keys(stats[b].ty)) seen.add(+t);
  check('树种 4/5/6/7/8 全部出现', [4, 5, 6, 7, 8].every(t => seen.has(t)), [...seen].sort((a, b2) => a - b2).join(','));
  // 樱花林群系纯樱花
  let chn = 0, chc = 0;
  for (let x = 1750; x < 1950; x += 2) for (let z = 1550; z < 1750; z += 2) {
    const c = G.column(x, z);
    if (c.biome !== G.B_CHERRY) continue;
    chn++; if (G.pickTree(x, z, c.biome, c.h) === 3) chc++;
  }
  check('樱花林群系纯樱花', chn > 0 && chc === chn, chc + '/' + chn);
}

/* ---------- ③ 片区单一树种（一片林子一种树） ---------- */
console.log('== ③ 片区单一树种 ==');
{
  let win = 0, mono = 0;
  for (let wx = -4000; wx <= 4000; wx += 200) for (let wz = -4000; wz <= 4000; wz += 200) {
    const cnt = {}; let n = 0, bio = -1, mixedBio = false;
    for (let x = wx; x < wx + 80; x += 2) for (let z = wz; z < wz + 80; z += 2) {
      const c = G.column(x, z);
      const t = G.treeAt(x, z, c.biome, c.h, c.snow);
      if (!t) continue;
      if (bio < 0) bio = c.biome; else if (bio !== c.biome) mixedBio = true;
      cnt[t] = (cnt[t] || 0) + 1; n++;
    }
    if (n < 4 || mixedBio) continue;
    win++;
    const mx = Math.max(...Object.values(cnt));
    if (mx / n >= 0.8) mono++;
  }
  check('80m 窗口单一树种率 ≥90%（≥80%同种为单一）', win > 100 && mono / win >= 0.90,
    `${mono}/${win} = ${(mono / win * 100).toFixed(1)}%`);
}

/* ---------- ④ 树址质检（genChunk 实际输出） ---------- */
console.log('== ④ 树址质检：水缘/悬空/贴壁/切冠 ==');
{
  let trees = 0, vioWater = 0, vioDrop = 0, vioRise = 0, vioCut = 0;
  const areas = [[0, 0], [188, 94], [-144, -148], [94, -219], [8, 60], [-40, 20]];
  for (const [cx0, cz0] of areas) {
    for (let cx = cx0; cx < cx0 + 6; cx++) for (let cz = cz0; cz < cz0 + 6; cz++) {
      const g = G.genChunk(cx, cz);
      const H = g.H;
      for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) {
        const wx = cx * 16 + x, wz = cz * 16 + z;
        const c = G.column(wx, wz);
        const ty = LOGS[g.blocks[(x * 16 + z) * H + c.h + 1]];
        if (!ty) continue;
        trees++;
        const mnt = c.biome === G.B_SNOW || c.biome === G.B_HIGHSNOW || c.biome === G.B_HIGHPEAK;
        let drop = 0, rise = 0, water = false;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const hn = G.column(wx + dx, wz + dz).h;
          if (c.h - hn > drop) drop = c.h - hn;
          if (hn - c.h > rise) rise = hn - c.h;
          if (hn < G.SEA) water = true;
        }
        const lim = mnt ? G.SNOW_STEEP : 4;
        if (rise >= lim) vioRise++;
        if (drop >= (ty === 2 ? 8 : lim)) vioDrop++;
        if (ty !== 2 && c.h <= G.SEA + 1 && water) vioWater++;
        let rise2 = 0;
        for (let rdx = -2; rdx <= 2; rdx++) for (let rdz = -2; rdz <= 2; rdz++) {
          const hn = G.column(wx + rdx, wz + rdz).h - c.h;
          if (hn > rise2) rise2 = hn;
        }
        if (rise2 >= 5) vioCut++;
      }
    }
  }
  check('树数量 > 100', trees > 100, 'n=' + trees);
  check('水缘违例 = 0', vioWater === 0, 'n=' + vioWater);
  check('悬空(崖边)违例 = 0', vioDrop === 0, 'n=' + vioDrop);
  check('贴壁违例 = 0', vioRise === 0, 'n=' + vioRise);
  check('切冠(2格内高墙)违例 = 0', vioCut === 0, 'n=' + vioCut);
}

/* ---------- ⑤ 无巨树 ---------- */
console.log('== ⑤ 巨树移除 ==');
{
  check('giantIn/giantsNear API 已移除', G.giantIn === undefined && G.giantsNear === undefined);
  // 旧巨树点位 + 大范围区块扫描：不再出现巨树方块
  let giantBlocks = 0;
  const spots = [[8, 60], [2, 2], [59, -20], [-144, -148], [0, 0], [188, 94]];
  for (const [cx0, cz0] of spots) {
    for (let cx = cx0; cx < cx0 + 3; cx++) for (let cz = cz0; cz < cz0 + 3; cz++) {
      const g = G.genChunk(cx, cz);
      for (let i = 0; i < g.blocks.length; i++) if (GIANT_IDS.includes(g.blocks[i])) giantBlocks++;
    }
  }
  check('区块中巨树方块 = 0（含旧巨木/红杉/巨橡/榕树）', giantBlocks === 0, 'n=' + giantBlocks);
  // LOD：旧红杉中心不再有巨冠
  const out = G.makeLodOut();
  G.lodSample(141, 973, 2, out, null);
  const c = G.column(141, 973);
  check('旧巨树点 LOD 无巨冠残留', out.fh === 0 || out.fh <= c.h + G.treeTop(8, 141, 973) + 3, 'fh=' + out.fh + ' h=' + c.h);
}

/* ---------- ⑥ LOD 树冠与近景同源 ---------- */
console.log('== ⑥ LOD 树冠配色/形态同源 ==');
{
  const out = G.makeLodOut();
  let cells = 0, colorOk = 0;
  for (let i = 0; i < 6000; i++) {
    const x = -1600 + (i * 37) % 3200, z = -1600 + Math.floor(i / 53) * 41 % 3200;
    const c = G.column(x, z);
    if (c.biome !== G.B_FOREST || c.h <= G.SEA) continue;
    G.lodSample(x, z, 8, out, null);
    if (!out.fh) continue;
    cells++;
    const fc = G.FOL[G.pickTree(x, z, c.biome, c.h)];
    if (Math.abs(out.fcol[0] - fc[0]) <= 24 && Math.abs(out.fcol[1] - fc[1]) <= 24 && Math.abs(out.fcol[2] - fc[2]) <= 24) colorOk++;
  }
  check('L3 树冠色与 pickTree 同源 ≥95%', cells > 50 && colorOk / cells >= 0.95, colorOk + '/' + cells);
  // 近景树 → L1 瓦片树冠覆盖对应
  const C = 64, s = 2, T = C * s;
  const tx = Math.floor(350 / T), tz = Math.floor(650 / T);
  const tile = G.buildLodTile(1, tx, tz, C);
  let nearTrees = 0;
  for (let x = tx * T; x < tx * T + T; x++) for (let z = tz * T; z < tz * T + T; z++) {
    const c = G.column(x, z);
    if (G.treeAt(x, z, c.biome, c.h, c.snow)) nearTrees++;
  }
  const pos = tile.solid.pos;
  let canopyQuads = 0;
  for (let i = 0; i < pos.length; i += 12) {
    const y = pos[i + 1];
    const c = G.column(Math.floor(tx * T + pos[i]), Math.floor(tz * T + pos[i + 2]));
    if (y > c.h + 5) canopyQuads++;
  }
  check('L1 瓦片存在树冠面（近景树有远景对应）', nearTrees === 0 || canopyQuads > nearTrees * 0.5,
    `nearTrees=${nearTrees} canopyQuads=${canopyQuads}`);
}

/* ---------- ⑦ 注册完整性 ---------- */
console.log('== ⑦ 方块/贴图/物品注册 ==');
{
  check('TILE_LIST ≤ 256（图集容量）', G.TILE_LIST.length <= 256, 'n=' + G.TILE_LIST.length);
  let missing = [];
  for (let id = 89; id <= 109; id++) {
    const b = G.BLOCKS[id];
    if (!b || !b.n) { missing.push(id); continue; }
    for (const t of b.t) if (t === undefined || G.TILE_LIST[t] === undefined) missing.push(id + ':tile');
  }
  check('方块 89..109 注册完整（保留为建材）', missing.length === 0, missing.join(',') || 'ok');
  const src = fs.readFileSync(__dirname + '/../js/textures.js', 'utf-8');
  const sandbox = vm.createContext({ console });
  vm.runInContext(src, sandbox);
  const TEX = vm.runInContext('TEXGEN', sandbox);
  TEX.init(G);
  let magenta = [];
  for (const name of G.TILE_LIST) {
    if (TEX.tileIcon(name).indexOf('%23ff00ff') >= 0) magenta.push(name);
  }
  check('全部 tile painter 存在（无洋红占位）', magenta.length === 0, magenta.join(',') || 'ok');
}

console.log(fail === 0 ? '\n[PASS] ' + pass + ' checks' : '\n[FAIL] ' + fail + ' of ' + (pass + fail));
process.exit(fail ? 1 : 0);
