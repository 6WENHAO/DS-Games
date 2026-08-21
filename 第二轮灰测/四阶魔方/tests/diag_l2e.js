/* 诊断"最后两组棱"卡点：捕获收尾搜索失败的状态并分析其结构与可解路径 */
const C = require('../src/cube4.js');
const S = require('../src/solver.js');
const I = S._internal;
const base = I.macroMoves(), ext = I.macroMovesL2E();
const smooth = (b, o) => I.wingDistSum(b, o) * 2 + I.nUnpaired(b, o);
const costT = t => (b, o) => { const u = I.nUnpaired(b, o); return u > t ? I.wingDistSum(b, o) * 2 + u : 0; };
const pairT = t => (b, o) => { const u = I.nUnpaired(b, o); return u > t ? (u - t) * 8 + I.wingDistSum(b, o) : 0; };

function mismatchInfo(st) {
  const out = [];
  C.EDGE_SLOTS.forEach((s, i) => {
    const w = s.wings;
    if (st[w[0][0]] !== st[w[1][0]] || st[w[0][1]] !== st[w[1][1]])
      out.push(s.name + '[' + st[w[0][0]] + st[w[0][1]] + '|' + st[w[1][0]] + st[w[1][1]] + ']');
  });
  return out;
}
function wingSign(st) {
  // 24 个棱片位置 -> 块编号（颜色对 + 排列朝向唯一确定是哪一个棱片）
  const pos = [];
  C.EDGE_SLOTS.forEach((s, si) => s.wings.forEach((w, wi) => {
    const a = st[w[0]], b = st[w[1]];
    const home = C.EDGE_SLOTS.findIndex(x => x.homeColors.slice().sort().join() === [a, b].sort().join());
    const flip = a === C.EDGE_SLOTS[home].homeColors[0] ? 0 : 1;
    pos.push(home * 2 + flip);
  }));
  let p = 0;
  for (let i = 0; i < pos.length; i++) for (let j = i + 1; j < pos.length; j++) if (pos[i] > pos[j]) p ^= 1;
  return p;
}

let found = 0;
for (let t = 0; t < 60 && found < 3; t++) {
  let st = C.applySeq(C.solvedState(), C.randomScramble(40));
  st = C.applySeq(st, S.beamSolveStage(st, I.centerCost, { widths: [1500, 5000], maxDepth: 30, proj: I.PROJ_CEN }));
  let u = C.unpairedEdges(st), guard = 0;
  while (u > 4 && guard++ < 20) {
    let r = null;
    for (const step of [2, 3, 1]) { for (const w of [150, 600]) { r = S.beamSearch(st, base, pairT(Math.max(0, u - step)), { width: w, maxDepth: 8, proj: I.PROJ_RED }); if (r) break; } if (r) break; }
    if (!r) break;
    st = C.applySeq(st, r); u = C.unpairedEdges(st);
  }
  // 廉价收尾尝试
  let r = null;
  for (const [w, d, e] of [[300, 8, 0], [200, 5, 1]]) {
    r = S.beamSearch(st, e ? ext : base, smooth, { width: w, maxDepth: d, proj: I.PROJ_RED });
    if (r) break;
  }
  if (r) continue;
  found++;
  console.log('=== 卡点 #' + found + ' u=' + u + ' 棱片置换奇偶=' + wingSign(st) + ' 中心错=' + C.centerErrors(st));
  console.log('    未配对槽: ' + mismatchInfo(st).join(' '));
  // 1) 单个宏能否直接解决
  let single = 0;
  for (const m of ext) { const ns = C.applySeq(st, m.seq); if (C.unpairedEdges(ns) === 0) single++; }
  console.log('    单个扩展宏可直接完成配对的数量: ' + single + ' / ' + ext.length);
  // 2) 逐级目标是否更容易
  const t1 = Date.now();
  const rr = S.beamSearch(st, ext, costT(Math.max(0, u - 2)), { width: 300, maxDepth: 6, proj: I.PROJ_RED });
  console.log('    逐级目标(u-2, ext, w300 d6): ' + (rr ? rr.length + ' 步 ' : '失败 ') + (Date.now() - t1) + 'ms');
  // 3) 大搜索是否可行
  const t2 = Date.now();
  const r2 = S.beamSearch(st, base, smooth, { width: 2500, maxDepth: 14, proj: I.PROJ_RED });
  console.log('    大搜索(base, w2500 d14): ' + (r2 ? r2.length + ' 步 ' : '失败 ') + (Date.now() - t2) + 'ms');
  // 4) 先插奇偶公式再廉价搜索
  const st2 = C.applySeq(st, "2R2 B2 U2 2L U2 2R' U2 2R U2 F2 2R F2 2L' B2 2R2");
  const t3 = Date.now();
  let r3 = null;
  for (const [w, d, e] of [[300, 8, 0], [200, 5, 1]]) { r3 = S.beamSearch(st2, e ? ext : base, smooth, { width: w, maxDepth: d, proj: I.PROJ_RED }); if (r3) break; }
  console.log('    插 OLL 奇偶后廉价搜索: ' + (r3 ? r3.length + ' 步 ' : '失败 ') + (Date.now() - t3) + 'ms  (奇偶变为 ' + wingSign(st2) + ')');
}
console.log('捕获卡点 ' + found + ' 个');
