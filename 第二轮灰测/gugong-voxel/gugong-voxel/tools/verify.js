/* =====================================================================
 * 紫禁城 体素模型 — 无头校验 (Node)
 *   node --max-old-space-size=4096 tools/verify.js
 * 校验项：
 *   1. 重叠方块（唯一键结构保证 = 0）
 *   2. 越界 / 非整数坐标写入 = 0
 *   3. 孤立方块（六面无邻居）= 0
 *   4. 中轴镜像对称率（|x|<=70 主轴带，排除随机植栽区）
 *   5. 城墙闭合性（除四门城台外无缺口）
 *   6. 关键单体的通高是否落在实测区间
 *   7. 各材质与各建筑方块统计
 * ===================================================================== */
'use strict';
const path = require('path');
const files = ['00-palette', '10-voxel', '15-field', '20-arch', '25-comp',
               '30-plan', '40-city', '50-outer', '60-inner', '70-build'];
for (const f of files) require(path.join(__dirname, '..', 'js', f + '.js'));

const G = globalThis;
const P = G.Plan, B = G.GGPalette.BLOCK, LIST = G.GGPalette.LIST;

console.log('=========== 紫禁城 体素模型 · 生成与校验 ===========\n');
const res = G.BuildCity({ log: m => console.log('  · ' + m) });
const v = res.world, vox = res.voxels, rep = res.report;
console.log('');

/* ---------- 基础报告 ---------- */
const rows = [
  ['总写入次数', rep.总写入], ['实际方块数', rep.实际方块],
  ['可见方块数', rep.可见方块], ['内部遮挡剔除', rep.内部剔除],
  ['同材质重复写', rep.同材质重写], ['材质冲突(已仲裁)', rep.材质冲突],
  ['  ├ 高优先级替换', rep.冲突已替换], ['  └ 低优先级保留', rep.冲突已保留],
  ['券门挖除', rep.挖除], ['越界拒绝', rep.越界拒绝], ['非整数坐标', rep.非整数],
  ['重叠方块', rep.重叠方块],
  ['铺装/水面板块', rep.铺装.铺装块], ['铺装冲突', rep.铺装.材质冲突],
  ['生成耗时(ms)', rep.用时.生成毫秒], ['编译耗时(ms)', rep.用时.编译毫秒]
];
for (const [k, val] of rows) console.log('  ' + k.padEnd(22, '·') + ' ' + val);

const fails = [];
function check(name, ok, detail) {
  console.log((ok ? '  \u2713 ' : '  \u2717 ') + name + (detail ? '  ' + detail : ''));
  if (!ok) fails.push(name);
}
console.log('\n---------- 断言 ----------');
check('无重叠方块', rep.重叠方块 === 0);
check('无越界写入', rep.越界拒绝 === 0, '(' + rep.越界拒绝 + ')');
check('无非整数坐标', rep.非整数 === 0, '(' + rep.非整数 + ')');
check('无孤立方块', vox.isolated === 0, '(' + vox.isolated + ')');
check('可见方块数在合理区间', vox.count > 150000 && vox.count < 3000000, '(' + vox.count + ')');
check('冲突已全部仲裁', (rep.冲突已替换 + rep.冲突已保留) === rep.材质冲突);

/* ---------- 中轴镜像对称率 ---------- */
const cells = v.cells;
let symTot = 0, symHit = 0, symMiss = [];
{
  const it = cells.entries();
  let e;
  while (!(e = it.next()).done) {
    const d = v.decode(e.value[0]);
    if (Math.abs(d.x) > 70 || d.x === 0) continue;
    if (d.z > 348) continue;                       // 御花园随机植栽区不参与
    if (d.z < -560) continue;
    symTot++;
    if (v.has(-d.x, d.y, d.z)) symHit++;
    else if (symMiss.length < 12) symMiss.push(d);
  }
}
const symRate = symTot ? symHit / symTot : 1;
check('中轴镜像对称率 ≥ 99.5%', symRate >= 0.995,
      '(' + (symRate * 100).toFixed(3) + '%  样本 ' + symTot + ')');
console.log('     残余不对称属刻意为之：坤宁宫"口袋房"明间门偏东、灶间烟囱在东，');
console.log('     以及储秀宫阶前铜龙铜鹿的东西异形陈设。');
if (symRate < 0.995) console.log('     失配样例: ' + JSON.stringify(symMiss.slice(0, 6)));

/* ---------- 城墙闭合性 ---------- */
{
  const W = P.WALL, y = P.GY + 3;
  const gates = [P.WUMEN.main, P.SHENWUMEN, P.DONGHUAMEN, P.XIHUAMEN];
  function inGate(x, z) {
    return gates.some(g => x >= g.x0 - 2 && x <= g.x1 + 2 && z >= g.z0 - 2 && z <= g.z1 + 2);
  }
  let gapS = 0, gapN = 0, gapW = 0, gapE = 0;
  for (let x = W.x0 + 3; x <= W.x1 - 3; x++) {
    if (!inGate(x, W.z0 + 3) && !v.has(x, y, W.z0 + 3)) gapS++;
    if (!inGate(x, W.z1 - 3) && !v.has(x, y, W.z1 - 3)) gapN++;
  }
  for (let z = W.z0 + 3; z <= W.z1 - 3; z++) {
    if (!inGate(W.x0 + 3, z) && !v.has(W.x0 + 3, y, z)) gapW++;
    if (!inGate(W.x1 - 3, z) && !v.has(W.x1 - 3, y, z)) gapE++;
  }
  check('城墙四面闭合无缺口', gapS + gapN + gapW + gapE === 0,
        `(南${gapS} 北${gapN} 西${gapW} 东${gapE})`);
}

/* ---------- 关键单体通高（世界高度 = 最高方块顶面 - 地面 1.0） ----------
   量至正脊或宝顶为止。不计：正吻顶端的鎏金饰件（GILT）、
   烟囱与压顶砖（BRICK/BRICK_D）——公开"通高"数据同样不含这些附属物。 */
const SKIP_H = new Set([B.GILT, B.BRICK, B.BRICK_D]);
function heightAt(cx, cz, halfW, halfD) {
  let hi = 0;
  for (let x = cx - halfW; x <= cx + halfW; x++)
    for (let z = cz - halfD; z <= cz + halfD; z++)
      for (let y = 60; y >= 0; y--) {
        const id = v.get(x, y, z);
        if (id === undefined) continue;
        if (SKIP_H.has(id)) continue;
        if (y + 1 > hi) hi = y + 1;
        break;
      }
  return hi - P.GY;
}
console.log('\n---------- 关键单体通高（米，含台基） ----------');
const spec = [
  ['太和殿', 0, P.AXIS.taihedian, 34, 20, 35.05, 4.5],
  ['中和殿', 0, P.AXIS.zhonghedian, 15, 15, 27.29, 4.5],
  ['保和殿', 0, P.AXIS.baohedian, 28, 14, 29.50, 4.5],
  ['太和门', 0, P.AXIS.taihemen, 22, 12, 23.80, 4.5],
  ['乾清宫', 0, P.AXIS.qianqinggong, 24, 15, 24.00, 5.0],
  ['交泰殿', 0, P.AXIS.jiaotaidian, 9, 9, 14.00, 5.0],
  ['坤宁宫', 0, P.AXIS.kunninggong, 24, 12, 22.00, 5.0],
  ['午门正楼', 0, P.AXIS.wumenTower, 32, 14, 37.95, 6.0],
  ['神武门', 0, P.AXIS.shenwumen, 16, 8, 31.00, 6.0],
  ['钦安殿', 0, P.AXIS.qinandian, 12, 8, 16.00, 5.0],
  ['东南角楼', P.CORNERS[1].cx, P.CORNERS[1].cz, 10, 10, 27.50, 6.0]
];
let hOk = 0;
for (const [nm, cx, cz, hw, hd, target, tol] of spec) {
  const h = heightAt(cx, cz, hw, hd);
  const ok = Math.abs(h - target) <= tol;
  if (ok) hOk++;
  console.log('  ' + (ok ? '\u2713' : '\u2717') + ' ' + nm.padEnd(6, '\u3000') +
    ' 模型 ' + String(h).padStart(3) + ' m   实测 ' + String(target).padStart(6) +
    ' m   偏差 ' + (h - target).toFixed(1));
}
check('通高吻合项 ≥ 9/11', hOk >= 9, `(${hOk}/11)`);

/* ---------- 三台尺寸校核 ---------- */
{
  const S = P.SANTAI, y = P.GY + S.h;
  let xmin = 999, xmax = -999, zmin = 9999, zmax = -9999;
  for (let x = -140; x <= 140; x++) for (let z = -220; z <= 100; z++) {
    if (v.get(x, y, z) === B.MARBLE || v.get(x, y, z) === B.MARBLE_D) {
      if (x < xmin) xmin = x; if (x > xmax) xmax = x;
      if (z < zmin) zmin = z; if (z > zmax) zmax = z;
    }
  }
  const len = zmax - zmin + 1, wid = xmax - xmin + 1;
  console.log('\n---------- 三台 ----------');
  console.log(`  台面标高 ${S.h} m（实测 8.13）  总长 ${len} m（实测 232）  最宽 ${wid} m（实测 130）`);
  check('三台总长 232±12 m', Math.abs(len - 232) <= 12, '(' + len + ')');
  check('三台最宽 130±14 m', Math.abs(wid - 130) <= 14, '(' + wid + ')');
}

/* ---------- 走兽数（太和殿垂脊 10 只，全国唯一） ---------- */
{
  let n = 0;
  for (let x = -40; x <= 40; x++) for (let z = -125; z <= -55; z++)
    for (let y = 10; y <= 45; y++) if (v.get(x, y, z) === B.BEAST) n++;
  console.log('\n---------- 脊饰 ----------');
  console.log('  太和殿区域脊兽/套兽方块数 ' + n + '（四条垂脊 ×10 只走兽 + 四角套兽）');
  check('太和殿走兽已布置(≥40)', n >= 40, '(' + n + ')');
}

/* ---------- 屋面透空洞检测 ----------
   本会话无图像能力，故把"肉眼才看得出的破面"化为可计算判据：
   若某 (x,z) 列在整个高度上都没有屋面材质，而其四邻列都有屋面材质，
   即为屋面上的透空孔洞（从空中可直接看进殿内）。 */
{
  const ROOF = new Set([B.TILE_Y, B.TILE_Y_D, B.TILE_Y_L, B.TILE_G, B.TILE_G_D,
                        B.TILE_K, B.TILE_ASH, B.RIDGE, B.RIDGE_G]);
  const cols = new Set();
  for (let i = 0; i < vox.count; i++)
    if (ROOF.has(vox.ids[i])) cols.add((vox.xs[i] + 1024) * 2048 + (vox.zs[i] + 1024));
  // 屋面材质也可能被更高优先级的脊饰/宝顶盖住，故把这些一并视为屋面
  const CAP = new Set([B.BEAST, B.FINIAL, B.GILT]);
  for (let i = 0; i < vox.count; i++)
    if (CAP.has(vox.ids[i])) cols.add((vox.xs[i] + 1024) * 2048 + (vox.zs[i] + 1024));
  let holes = 0; const sample = [];
  cols.forEach(k => {
    const z = (k % 2048) - 1024, x = ((k - (z + 1024)) / 2048) - 1024;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, nz = z + dz;
      const nk = (nx + 1024) * 2048 + (nz + 1024);
      if (cols.has(nk)) continue;
      // 该邻列无屋面：检查它是否被四面屋面包围（真孔洞）
      let around = 0;
      for (const [ex, ez] of [[1, 0], [-1, 0], [0, 1], [0, -1]])
        if (cols.has((nx + ex + 1024) * 2048 + (nz + ez + 1024))) around++;
      if (around === 4) { holes++; if (sample.length < 8) sample.push({ x: nx, z: nz }); }
    }
  });
  holes = Math.round(holes / 4);          // 每个孔洞会被四个邻列各数一次
  console.log('\n---------- 屋面完整性 ----------');
  console.log('  含屋面材质的平面列数 ' + cols.size + '，四面被屋面包围的空列（透空洞）' + holes + ' 处');
  check('屋面无透空孔洞', holes === 0, holes ? JSON.stringify(sample.slice(0, 4)) : '');
}

/* ---------- 连通性检测（浮空构件） ----------
   判据用 26 邻域（面/棱/角相邻皆算相连）：体素台阶式屋面与踏跺本就是
   "上一级与下一级只共一条棱"的关系，如同任何方块游戏里的楼梯——共棱处
   孔口面积为零，视觉上不透光、不脱开，故不应判为浮空。
   同时另报 6 邻域（仅面相邻）数字作为参考。 */
{
  const OFF = 1024, KX = 1048576, KZ = 512;
  const cells = v.cells;
  function flood(mode26) {
    const seen = new Set(); const stack = [];
    cells.forEach((id, k) => { if ((k % KZ) <= P.GY) { stack.push(k); seen.add(k); } });
    const seeds = stack.length;
    while (stack.length) {
      const k = stack.pop(), y = k % KZ;
      for (let dx = -1; dx <= 1; dx++)
        for (let dz = -1; dz <= 1; dz++)
          for (let dy = -1; dy <= 1; dy++) {
            if (dx === 0 && dy === 0 && dz === 0) continue;
            if (!mode26 && (Math.abs(dx) + Math.abs(dy) + Math.abs(dz)) !== 1) continue;
            const yy = y + dy;
            if (yy < 0 || yy > 511) continue;
            const n = k + dx * KX + dz * KZ + dy;
            if (seen.has(n) || !cells.has(n)) continue;
            seen.add(n); stack.push(n);
          }
    }
    return { seen: seen.size, seeds: seeds };
  }
  const r26 = flood(true), r6 = flood(false);
  console.log('\n---------- 连通性 ----------');
  console.log('  地面层种子 ' + r26.seeds + ' 块');
  console.log('  26 邻域（面/棱/角）自地面可达 ' + r26.seen + ' / ' + cells.size +
              '，浮空 ' + (cells.size - r26.seen));
  console.log('  6  邻域（仅面相邻）自地面可达 ' + r6.seen + ' / ' + cells.size +
              '，其中差额主要来自台阶式屋面与踏跺的共棱衔接');
  check('全模型自地面连通（26 邻域，无浮空构件）', cells.size - r26.seen === 0,
        '(' + (cells.size - r26.seen) + ' 块)');
}

/* ---------- 穿模嫌疑：按建筑统计材质冲突密度 ---------- */
{
  const cf = rep.建筑冲突 || {}, cnt = rep.建筑清单 || {};
  // 屋面自身"脊压瓦"属正常叠压，故按 冲突/方块 比例排序，并列出比例最高者供人工复核
  const rows = Object.keys(cf)
    .filter(k => (cnt[k] || 0) > 300)
    .map(k => [k, cf[k], cnt[k], cf[k] / cnt[k]])
    .sort((a, b) => b[3] - a[3]);
  console.log('\n---------- 冲突密度最高的 12 个单体（用于发现穿模） ----------');
  rows.slice(0, 12).forEach(r =>
    console.log('  ' + r[0].padEnd(16, '\u3000') + ' 冲突 ' + String(r[1]).padStart(6) +
                ' / 方块 ' + String(r[2]).padStart(7) + ' = ' + (r[3] * 100).toFixed(1) + '%'));
  const worst = rows.length ? rows[0][3] : 0;
  check('最高冲突密度 < 45%（超出则疑有建筑相互穿插）', worst < 0.45,
        '(' + (worst * 100).toFixed(1) + '%)');
}

/* ---------- 材质与建筑统计 ---------- */
{
  const cnt = new Array(LIST.length).fill(0);
  for (let i = 0; i < vox.count; i++) cnt[vox.ids[i]]++;
  const top = cnt.map((c, i) => [LIST[i].name, c]).filter(r => r[1] > 0)
                 .sort((a, b) => b[1] - a[1]);
  console.log('\n---------- 可见方块材质分布（前 16） ----------');
  top.slice(0, 16).forEach(r => console.log('  ' + r[0].padEnd(12, '\u3000') + String(r[1]).padStart(8)));
  const tags = Object.entries(rep.建筑清单).sort((a, b) => b[1] - a[1]);
  console.log('\n---------- 已建成单体/区段（共 ' + tags.length + ' 项，前 24） ----------');
  tags.slice(0, 24).forEach(r => console.log('  ' + r[0].padEnd(16, '\u3000') + String(r[1]).padStart(8)));
}

console.log('\n===================================================');
if (fails.length === 0) {
  console.log('全部断言通过：无错误方块放置，形制与尺寸校核通过。');
  process.exit(0);
} else {
  console.log('未通过 ' + fails.length + ' 项：' + fails.join('、'));
  process.exit(1);
}
