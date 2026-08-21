const C = require('../src/cube4.js');
const S = require('../src/solver.js');
const I = S._internal;
let fails = 0;
const ok = (c, m) => { if (!c) { console.log('FAIL: ' + m); fails++; } else console.log('ok  : ' + m); };

// 1. 三阶模型 vs 四阶引擎 一致性（含 M 中层）
{
  const names = I.MOVE3_ALL.map(m => m.name);
  let allOk = true, bad = '';
  for (let t = 0; t < 200; t++) {
    const seq = [];
    for (let i = 0; i < 25; i++) seq.push(names[(Math.random() * names.length) | 0]);
    const st4 = C.applySeq(C.solvedState(), seq);
    const r4 = C.reduce(st4);
    let s3 = I.solved3();
    for (const n of seq) s3 = I.apply3(s3, I.M3_BY_NAME.get(n), new Int8Array(I.S_LEN));
    let same = true;
    for (let i = 0; i < 8; i++) if (s3[i] !== r4.cp[i] || s3[8 + i] !== r4.co[i]) same = false;
    for (let i = 0; i < 12; i++) if (s3[16 + i] !== r4.ep[i] || s3[28 + i] !== r4.eo[i]) same = false;
    if (!same) { allOk = false; bad = seq.join(' '); break; }
  }
  ok(allOk, '三阶模型与四阶引擎一致（200 组随机序列, 含 M）' + (allOk ? '' : ' 反例: ' + bad));
}

// 2. M 层偏移追踪：M4 = 复原
{
  let s3 = I.solved3();
  for (let i = 0; i < 4; i++) s3 = I.apply3(s3, I.M3_BY_NAME.get('M'), new Int8Array(I.S_LEN));
  ok(I.isSolved3(s3), 'M×4 回到复原态（中心块偏移归零）');
  let s4 = I.applySeq3(I.solved3(), [I.M3_BY_NAME.get('M')]);
  ok(!I.isSolved3(s4), '单个 M 不算复原（中心块偏移非零）');
}

// 3. 距离表健全性
{
  const t0 = Date.now();
  const tab = I.tabFace();
  const cross = tab.cross();
  ok(cross[((4 * 2) * 24 + 5 * 2) * 576 + (6 * 2) * 24 + 7 * 2] === 0, '十字表：目标态距离 0');
  let mx = 0, unreach = 0;
  for (let i = 0; i < cross.length; i++) { if (cross[i] < 0) unreach++; else if (cross[i] > mx) mx = cross[i]; }
  ok(mx >= 7 && mx <= 9, '十字表最大距离 = ' + mx + '（理论 8）');
  console.log('  十字表构建 + 单块表: ' + (Date.now() - t0) + 'ms, 不可达索引 ' + unreach);
  const pd = tab.pair(4, 8);
  ok(pd[(4 * 3) * 24 + 8 * 2] === 0, '块对表：目标态距离 0');
}

// 4. LSE 表
{
  const t0 = Date.now();
  const d = I.lseTable();
  let mx = 0, cnt = 0;
  for (let i = 0; i < d.length; i++) if (d[i] >= 0) { cnt++; if (d[i] > mx) mx = d[i]; }
  console.log('  LSE 表: ' + (Date.now() - t0) + 'ms, 可达状态 ' + cnt + ', 最大距离 ' + mx);
  ok(cnt > 10000 && mx >= 10, 'LSE 完全 BFS 有效（可达 ' + cnt + ' 态, 最长 ' + mx + ' 步）');
}

// 5. 子目标搜索：随机三阶态解十字
{
  const tab = I.tabFace();
  const names = ['U', "U'", 'U2', 'R', "R'", 'R2', 'F', "F'", 'F2', 'D', "D'", 'D2', 'L', "L'", 'L2', 'B', "B'", 'B2'];
  let allOk = true, tot = 0, worst = 0;
  const t0 = Date.now();
  for (let t = 0; t < 20; t++) {
    let s = I.solved3();
    for (let i = 0; i < 25; i++) s = I.apply3(s, I.M3_BY_NAME.get(names[(Math.random() * names.length) | 0]), new Int8Array(I.S_LEN));
    const r = I.solveSub(s, { cross: true }, tab, { maxDepth: 9 });
    if (!r) { allOk = false; break; }
    const after = I.applySeq3(s, r);
    for (let e = 4; e <= 7; e++) if (after[16 + e] !== e || after[28 + e] !== 0) allOk = false;
    tot += r.length; worst = Math.max(worst, r.length);
  }
  ok(allOk, '十字求解 20 次全部正确, 平均 ' + (tot / 20).toFixed(1) + ' 步, 最长 ' + worst + ' 步, ' + (Date.now() - t0) + 'ms');
}
console.log(fails === 0 ? '\n全部通过' : '\n失败 ' + fails + ' 项');
process.exit(fails ? 1 : 0);
