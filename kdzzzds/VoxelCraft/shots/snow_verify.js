/* shots/snow_verify.js - 积雪规则块级自检（无需浏览器）
 * 检查：① 陡坡无雪违例 ② 冰面只在平地 ③ 雪线点抖渐变 ④ LOD 与近景同源 ⑤ 雪地树+树下积雪 */
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

/* ---------- ①② 近景块级：陡坡雪 / 斜坡冰 ---------- */
function surveyChunks(cx0, cz0, n, label) {
  let steepSnow = 0, slopeIce = 0, snowTop = 0, rockTop = 0, iceTop = 0, treeOnSnow = 0, treeGroundSnow = 0;
  for (let cx = cx0; cx < cx0 + n; cx++) for (let cz = cz0; cz < cz0 + n; cz++) {
    const g = G.genChunk(cx, cz);
    const H = g.H;
    for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) {
      const wx = cx * 16 + x, wz = cz * 16 + z;
      const c = G.column(wx, wz);
      const bio = c.biome;
      const mnt = bio === G.B_SNOW || bio === G.B_HIGHSNOW || bio === G.B_HIGHPEAK;
      if (!mnt) continue;
      const top = g.blocks[(x * 16 + z) * H + c.h];
      let dmax = 0;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const d = Math.abs(G.column(wx + dx, wz + dz).h - c.h);
        if (d > dmax) dmax = d;
      }
      if (top === 9) { snowTop++; if (dmax >= G.SNOW_STEEP) steepSnow++; }
      else if (top === 10) { iceTop++; if (dmax > 1) slopeIce++; }
      else if (top === 3 || top === 8 || top === 88) rockTop++;
      // 雪地树：树干在 h+1，地面应保持雪
      const t1 = g.blocks[(x * 16 + z) * H + c.h + 1];
      if (t1 === 25 && c.snow && bio === G.B_SNOW) {
        treeOnSnow++;
        if (top === 9) treeGroundSnow++;
      }
    }
  }
  console.log(`  [${label}] snowTop=${snowTop} rockTop=${rockTop} iceTop=${iceTop} treeOnSnow=${treeOnSnow}`);
  return { steepSnow, slopeIce, snowTop, rockTop, iceTop, treeOnSnow, treeGroundSnow };
}

console.log('== ① 陡坡露岩 / ② 冰面平地（近景 genChunk）==');
const s1 = surveyChunks(-146, -149, 5, '雪山 -2304,-2352');
const s2 = surveyChunks(500, -136, 5, '高雪山 8032,-2144');
const s3 = surveyChunks(-388, -280, 5, '高雪原 -6176,-4448');
check('雪山区陡坡雪违例 = 0', s1.steepSnow === 0, 'steepSnow=' + s1.steepSnow);
check('高雪山区陡坡雪违例 = 0', s2.steepSnow === 0, 'steepSnow=' + s2.steepSnow);
check('高雪原陡坡雪违例 = 0', s3.steepSnow === 0, 'steepSnow=' + s3.steepSnow);
check('斜坡冰违例 = 0', s1.slopeIce + s2.slopeIce + s3.slopeIce === 0, 'slopeIce=' + (s1.slopeIce + s2.slopeIce + s3.slopeIce));
check('高雪山仍有大面积雪盖', s2.snowTop > 400, 'snowTop=' + s2.snowTop);
check('高雪山有露岩', s2.rockTop > 100, 'rockTop=' + s2.rockTop);

/* ---------- ③ 雪线点抖渐变 ---------- */
console.log('== ③ 雪线过渡（点抖渐变而非硬边）==');
{
  const buckets = new Map();   // Δh(整数) -> [snow, total]
  for (let x = -64; x < 448; x++) for (let z = 760; z < 1260; z++) {
    const c = G.column(x, z);
    if (c.biome === G.B_MEADOW || c.biome === G.B_HIGHSNOW || c.biome === G.B_HIGHPEAK) continue;
    if (c.hl > 0.12 && c.h >= 1235) continue;   // 山地带 snw=false 强制区排除
    const f = { temp: c.temp, det: c.det };
    const snowline = 1120 + (f.temp - 0.5) * 50 + (f.det - 0.5) * 12;
    const d = Math.round(c.h - snowline);
    if (d < -10 || d > 10) continue;
    if (!buckets.has(d)) buckets.set(d, [0, 0]);
    const b = buckets.get(d);
    b[1]++; if (c.snow) b[0]++;
  }
  let mixed = 0, mono0 = 0, mono1 = 0, rows = [];
  for (let d = -8; d <= 8; d++) {
    const b = buckets.get(d);
    if (!b || b[1] < 30) continue;
    const fr = b[0] / b[1];
    rows.push(d + ':' + fr.toFixed(2));
    if (fr > 0.1 && fr < 0.9) mixed++;
    else if (fr <= 0.1) mono0++; else mono1++;
  }
  console.log('  Δh:雪占比 ' + rows.join(' '));
  check('过渡带 ≥6 档为混合占比(0.1..0.9)', mixed >= 6, 'mixed=' + mixed);
  check('远端仍单色（低处无雪/高处全雪）', mono0 >= 1 && mono1 >= 1, `mono0=${mono0} mono1=${mono1}`);
}

/* ---------- ④ LOD 与近景同源（L1 s=2 瓦片顶色 vs 近景顶块） ---------- */
console.log('== ④ LOD 顶色 vs 近景顶块（雪/岩二分一致率）==');
function lodAgree(tx, tz, label) {
  const C = 64, s = 2, T = C * s;
  const tile = { tx: Math.floor(tx / T), tz: Math.floor(tz / T) };
  const r = G.buildLodTile(1, tile.tx, tile.tz, C);
  // 重采样：直接用 lodSample+后处理不可得，改从 gen 侧逐格对照
  const W = C + 2;
  const out = G.makeLodOut();
  let agree = 0, total = 0, mism = 0;
  for (let j = 0; j < C; j++) for (let i = 0; i < C; i++) {
    const x = tile.tx * T + i * s + 1, z = tile.tz * T + j * s + 1;
    const c = G.column(x, z);
    const bio = c.biome;
    if (bio !== G.B_SNOW && bio !== G.B_HIGHSNOW && bio !== G.B_HIGHPEAK) continue;
    if (c.h <= G.SEA) continue;
    // 近景预测顶块
    let dmax = 0;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const d = Math.abs(G.column(x + dx, z + dz).h - c.h);
      if (d > dmax) dmax = d;
    }
    const steep = dmax >= G.SNOW_STEEP;
    let nearSnowy;
    if (bio === G.B_HIGHSNOW) nearSnowy = !steep;
    else if (bio === G.B_HIGHPEAK) nearSnowy = c.snow && !steep;
    else nearSnowy = c.snow && !steep;
    total++;
    // LOD 侧：用同一套 buildLodTile 的网格（L1 s=2 的格点重算 dmax 用格点 H）
    G.lodSample(x, z, s, out, null);
    let lodSnowy = out.top[0] >= 200 && out.top[2] >= 200 && !out.ice;
    // 格点陡坡后处理复算
    let gdmax = 0;
    for (const [dx, dz] of [[s, 0], [-s, 0], [0, s], [0, -s]]) {
      const o2 = G.makeLodOut();
      G.lodSample(x + dx, z + dz, s, o2, null);
      const d = Math.abs(o2.h - out.h);
      if (d > gdmax) gdmax = d;
    }
    if (out.snw && gdmax >= G.SNOW_STEEP * s) lodSnowy = false;
    if (nearSnowy === lodSnowy) agree++;
    else if (mism++ < 3) console.log(`    mismatch @${x},${z} h=${c.h} near=${nearSnowy} lod=${lodSnowy} dmax=${dmax} gdmax=${gdmax}`);
  }
  const rate = total ? agree / total : 1;
  check(label + ' 一致率 ≥ 90%', rate >= 0.90, (rate * 100).toFixed(1) + '% of ' + total);
}
lodAgree(-2304, -2352, '雪山瓦片');
lodAgree(8032, -2144, '高雪山瓦片');

/* ---------- ⑤ 雪地树 ---------- */
console.log('== ⑤ 雪地杉树 + 树下积雪 ==');
{
  const all = s1.treeOnSnow + s2.treeOnSnow + s3.treeOnSnow;
  const ok = s1.treeGroundSnow + s2.treeGroundSnow + s3.treeGroundSnow;
  let found = 0;
  for (let x = -2500; x < -2100; x++) for (let z = -2500; z < -2200; z += 1) {
    const c = G.column(x, z);
    if (c.biome === G.B_SNOW && c.snow && G.treeAt(x, z, c.biome, c.h, c.snow)) found++;
  }
  check('雪区存在杉树（treeAt 抽样）', found > 0, 'found=' + found);
  check('雪地树下地面保持雪块', all === 0 || ok === all, ok + '/' + all);
}

console.log(fail === 0 ? '\n[PASS] ' + pass + ' checks' : '\n[FAIL] ' + fail + ' of ' + (pass + fail));
process.exit(fail ? 1 : 0);
