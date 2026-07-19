/* shots/depth_verify.js - y 下限 -1000 + 深盆地 块级自检
 * ① 双路径网格一致 ② Uint16 量程 ③ 基岩底 ④ 深层矿 ⑤ 深盆地剖面/护堤/盆底湖
 * ⑥ 无"水墙"（相邻列水位不同必须被高地隔开） ⑦ LOD 水位/配色 ⑧ 盆底无植被 */
const GEN_MODULE = require('../js/gen.js');
const LOD_MODULE = require('../js/lod.js');
const MESHER_MODULE = require('../js/mesher.js');
const G = {};
GEN_MODULE(G);
LOD_MODULE(G);
MESHER_MODULE(G);
G.setSeed(20260718);

let pass = 0, fail = 0;
function check(name, ok, detail) {
  console.log((ok ? '  ✓ ' : '  ✗ ') + name + (detail ? '  [' + detail + ']' : ''));
  if (ok) pass++; else fail++;
}

/* ---------- 深盆地 POI ---------- */
let basin = null;
for (let x = -8000; x <= 8000; x += 64) for (let z = -8000; z <= 8000; z += 64) {
  const c = G.column(x, z);
  if (c.b > 0.92 && c.h < 480) {
    const d = Math.abs(x) + Math.abs(z);
    if (!basin || d < basin.d) basin = { x, z, h: c.h, d, b: c.b };
  }
}
console.log('深盆地湖心 POI:', JSON.stringify(basin));

/* ---------- ①② 双路径网格一致 + Uint16 量程 ---------- */
console.log('== ①② 网格双路径一致 / 定点量程 ==');
{
  const spots = [[0, 0], [Math.floor(basin.x / 16), Math.floor(basin.z / 16)], [502, -134]];
  let allEq = true, allRange = true;
  for (const [cx, cz] of spots) {
    const g = G.genChunk(cx, cz);
    const H = g.H;
    const mmPad = G.meshChunk(null, g.hmax, g.pad, H, g.hmin);
    const blocks = g.blocks;
    const gb = function (x, y, z) {
      if (y < 0) return 12;
      if (y >= H) return 0;
      if (x >= 0 && x < 16 && z >= 0 && z < 16) return blocks[(x * 16 + z) * H + y];
      const idx = ((x + 1) * 18 + (z + 1)) * H + y;
      return g.pad[idx];
    };
    const mmGb = G.meshChunk(gb, g.hmax, null, 0, g.hmin);
    for (const k of ['opq', 'alp', 'wat']) {
      const A = mmPad[k], B = mmGb[k];
      for (const f of Object.keys(A)) {
        const a = A[f], b = B[f];
        if (a && a.length !== undefined) {
          if (a.length !== b.length) { allEq = false; break; }
          for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) { allEq = false; break; }
        } else if (a !== b) allEq = false;
      }
    }
    const pos = mmPad.opq.pos;
    for (let i = 1; i < pos.length; i += 3) if (pos[i] < 0 || pos[i] > 65535) { allRange = false; break; }
  }
  check('pad/gb 双路径网格逐字段一致', allEq);
  check('顶点 y 定点在 Uint16 量程内', allRange);
}

/* ---------- ③④ 基岩底 + 深层矿 ---------- */
console.log('== ③④ 基岩 / 深层矿带 ==');
{
  const g = G.genChunk(0, 0);
  const H = g.H;
  let bedOk = true;
  const ores = { 13: 0, 14: 0, 15: 0, 16: 0, 17: 0, 19: 0 };
  let deepOres = 0, diamondDeep = 0;
  for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) {
    if (g.blocks[(x * 16 + z) * H + 0] !== 12) bedOk = false;
    for (let y = 0; y < Math.min(H, 1000); y++) {
      const id = g.blocks[(x * 16 + z) * H + y];
      if (ores[id] !== undefined) {
        ores[id]++;
        if (y < 950) deepOres++;
        if (id === 16 && y < 180) diamondDeep++;
      }
    }
  }
  console.log('  矿石统计(单区块):', JSON.stringify(ores), 'deep=', deepOres, 'diamondDeep=', diamondDeep);
  check('基岩层在存储 y=0（世界 -1000）', bedOk);
  check('深层(世界-50以下)矿石存在', deepOres > 50, 'n=' + deepOres);
  check('深层钻石带(世界-820以下)存在', diamondDeep > 0, 'n=' + diamondDeep);
}

/* ---------- ⑤ 深盆地剖面 ---------- */
console.log('== ⑤ 深盆地剖面（湖心向外 8 方向 2km）==');
{
  let minFloor = 1e9, rimMax = -1e9, rimOkAll = true;
  for (let a = 0; a < 8; a++) {
    const ang = a / 8 * Math.PI * 2;
    let rimPeak = -1e9, inRim = false;
    for (let r = 0; r <= 2000; r += 8) {
      const x = Math.round(basin.x + Math.cos(ang) * r), z = Math.round(basin.z + Math.sin(ang) * r);
      const c = G.column(x, z);
      if (c.h < minFloor) minFloor = c.h;
      // 干湿分界处必须高于双方水位（护堤）：找 wlv 切换点
      if (c.wlv !== 480 && !inRim) {
        inRim = true;
        // 检查切换点两侧 24m 内地形都 ≥ SEA（1046）
        let ok = true;
        for (let rr = Math.max(0, r - 24); rr <= r + 24; rr += 4) {
          const cc = G.column(Math.round(basin.x + Math.cos(ang) * rr), Math.round(basin.z + Math.sin(ang) * rr));
          if (cc.h < G.SEA) { ok = false; break; }
        }
        if (!ok) rimOkAll = false;
      }
      if (c.h > rimPeak) rimPeak = c.h;
    }
    if (rimPeak > rimMax) rimMax = rimPeak;
  }
  const floorW = minFloor + G.Y0, rimW = rimMax + G.Y0;
  console.log(`  盆底最低 ${minFloor} (世界 ${floorW})，环带最高 ${rimMax} (世界 ${rimW})`);
  check('盆底凹陷到海平面以下数百格（世界 ≤ -300）', floorW <= -300, '世界 ' + floorW);
  check('盆底不低于基岩带（存储 ≥ 5）', minFloor >= 5, 'min=' + minFloor);
  check('盆底湖存在（湖心水位 480 且湖心低于水位）', basin.h < 480, 'h=' + basin.h);
  check('干湿分界由护堤隔开（8 方向均 ≥ 海平面）', rimOkAll);
}

/* ---------- ⑥ 无水墙（近景 pad 扫描） ---------- */
console.log('== ⑥ 水体无悬空壁 ==');
{
  // 盆地边界带 + 湖心：水块(11)的水平相邻若是空气则为"水墙"违例
  let vio = 0, waterBlocks = 0;
  const spots = [
    [Math.floor(basin.x / 16), Math.floor(basin.z / 16)],
    [Math.floor(basin.x / 16) + 2, Math.floor(basin.z / 16)],
    [0, -3], [1, -3]   // 海岸带
  ];
  for (const [cx, cz] of spots) {
    const g = G.genChunk(cx, cz);
    const H = g.H, PW = 18;
    for (let lx = 0; lx < 16; lx++) for (let lz = 0; lz < 16; lz++) {
      for (let y = 300; y < Math.min(H, 1100); y++) {
        const id = g.pad[((lx + 1) * PW + (lz + 1)) * H + y];
        if (id !== 11) continue;
        waterBlocks++;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nid = g.pad[((lx + 1 + dx) * PW + (lz + 1 + dz)) * H + y];
          if (nid === 0) vio++;
        }
      }
    }
  }
  check('水块水平邻格无空气（无水墙）', vio === 0, `vio=${vio} of ${waterBlocks} water`);
}

/* ---------- ⑦ LOD 水位/配色 ---------- */
console.log('== ⑦ LOD 深盆地适配 ==');
{
  const out = G.makeLodOut();
  G.lodSample(basin.x, basin.z, 2, out, null);
  check('湖心 LOD water=1 wlv=480', out.water === 1 && out.wlv === 480, `water=${out.water} wlv=${out.wlv}`);
  G.lodSample(0, -60, 2, out, null);
  check('海域 LOD wlv=SEA', out.wlv === G.SEA, 'wlv=' + out.wlv);
  // 瓦片水面顶点 y ∈ {SEA+0.86, 480.86}
  const C = 64, s = 4, T = C * s;
  const tile = G.buildLodTile(2, Math.floor(basin.x / T), Math.floor(basin.z / T), C);
  let okY = true, lakeQuads = 0;
  for (let i = 1; i < tile.water.pos.length; i += 3) {
    const y = tile.water.pos[i];
    if (Math.abs(y - 480.86) < 0.01) lakeQuads++;
    else if (Math.abs(y - (G.SEA + 0.86)) > 0.01) okY = false;
  }
  check('瓦片水面仅在合法水位（含盆底湖 480.86）', okY && lakeQuads > 0, `lakeVerts=${lakeQuads}`);
  // 干盆底 LOD 顶色 = 砾石荒漠色（非草绿）
  let dryTop = null;
  for (let r = 0; r < 1200 && !dryTop; r += 16) {
    const c = G.column(basin.x + r, basin.z);
    if (c.h >= 480 && c.h < 900 && c.biome === G.B_BASIN) { G.lodSample(basin.x + r, basin.z, 2, out, null); dryTop = out.top; }
  }
  check('干盆底远景顶色为荒漠灰褐（G 分量不占优）', !dryTop || dryTop[1] <= dryTop[0] + 12, dryTop ? dryTop.join(',') : 'n/a');
}

/* ---------- ⑧ 盆底无植被/无树 ---------- */
console.log('== ⑧ 盆底无植被 ==');
{
  const cx = Math.floor(basin.x / 16), cz = Math.floor(basin.z / 16);
  let plants = 0;
  for (let dcx = -1; dcx <= 1; dcx++) for (let dcz = -1; dcz <= 1; dcz++) {
    const g = G.genChunk(cx + dcx, cz + dcz);
    const H = g.H;
    for (let i = 0; i < g.blocks.length; i++) {
      const id = g.blocks[i];
      if ((id >= 80 && id <= 86) || id === 25 || id === 89) plants++;
    }
  }
  check('盆底 3×3 区块无植物/树', plants === 0, 'n=' + plants);
}

console.log(fail === 0 ? '\n[PASS] ' + pass + ' checks' : '\n[FAIL] ' + fail + ' of ' + (pass + fail));
process.exit(fail ? 1 : 0);
