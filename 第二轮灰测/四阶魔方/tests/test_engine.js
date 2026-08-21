const C = require('../src/cube4.js');
let fails = 0;
function ok(cond, msg) { if (!cond) { console.log('FAIL: ' + msg); fails++; } else console.log('ok  : ' + msg); }

// 1. 恒等性
{
  let allOk = true;
  for (const m of C.MOVES) {
    let st = C.solvedState();
    const n = m.turns === 2 ? 2 : 4;
    for (let t = 0; t < n; t++) st = C.applyMove(st, m);
    if (!C.isSolved(st)) { allOk = false; console.log('  bad move cycle: ' + m.name); }
  }
  ok(allOk, '所有招式满足 4 次（或 2 次×2）回归原状');
}

// 2. U 转动方向：F 顶行 -> L 顶行
{
  const st = C.applySeq(C.solvedState(), 'U');
  const Lrow0 = [0, 1, 2, 3].map(c => st[4 * 16 + 0 * 4 + c]);
  ok(Lrow0.every(v => v === 2), 'U 顺时针：F(绿=2) 顶行 -> L 顶行, 实际=' + Lrow0);
  const Frow0 = [0, 1, 2, 3].map(c => st[2 * 16 + 0 * 4 + c]);
  ok(Frow0.every(v => v === 1), 'U 顺时针：R(红=1) -> F 顶行, 实际=' + Frow0);
}

// 3. R 转动方向：F 右列 -> U 右列
{
  const st = C.applySeq(C.solvedState(), 'R');
  const Ucol3 = [0, 1, 2, 3].map(r => st[0 * 16 + r * 4 + 3]);
  ok(Ucol3.every(v => v === 2), 'R 顺时针：F(2) -> U 右列, 实际=' + Ucol3);
}

// 4. 打乱 + 逆序列 = 复原
{
  let allOk = true;
  for (let t = 0; t < 30; t++) {
    const sc = C.randomScramble(40);
    let st = C.applySeq(C.solvedState(), sc);
    st = C.applySeq(st, C.invertSeq(sc));
    if (!C.isSolved(st)) allOk = false;
  }
  ok(allOk, '随机打乱 + 逆序列 = 复原');
}

// 5. 外层/宽层/中层 对配对性的影响
{
  const st0 = C.solvedState();
  let outerOk = true, sliceBreaks = true, midOk = true;
  for (const m of C.MOVES) {
    const st = C.applyMove(st0, m);
    const up = C.unpairedEdges(st);
    if (/^[URFDLB]['2]?$/.test(m.name) && up !== 0) outerOk = false;
    if (/^[MES]['2]?$/.test(m.name) && up !== 0) midOk = false;
    if (/^2[URFDLB]$/.test(m.name) && up === 0) sliceBreaks = false;
  }
  ok(outerOk, '外层转动保持复合棱配对');
  ok(midOk, 'M/E/S 中层双层转动保持复合棱配对');
  ok(sliceBreaks, '单内层转动会打散复合棱配对');
  ok(C.centerErrors(C.applySeq(st0, 'M')) === 16, 'M 搬走 4 个中心块(16 贴纸), 实际=' + C.centerErrors(C.applySeq(st0, 'M')));
  ok(C.centerErrors(C.applySeq(st0, 'U R F')) === 0, '外层转动不影响中心块');
}

// 6. 块结构统计
{
  ok(C.CORNER_SLOTS.length === 8 && C.EDGE_SLOTS.length === 12 && C.CENTER_FIDS.length === 24,
    '结构统计: 8 角 / 12 复合棱 / 24 中心贴纸');
  const facelets = new Set();
  C.CORNER_SLOTS.forEach(s => s.facelets.forEach(f => facelets.add(f)));
  C.EDGE_SLOTS.forEach(s => s.wings.forEach(w => w.forEach(f => facelets.add(f))));
  C.CENTER_FIDS.forEach(f => facelets.add(f));
  ok(facelets.size === 96, '所有 96 个贴纸被结构完整覆盖, 实际=' + facelets.size);
  console.log('  角块槽: ' + C.CORNER_SLOTS.map(s => s.key).join(' '));
  console.log('  棱块槽: ' + C.EDGE_SLOTS.map(s => s.name).join(' '));
}

// 7. reduce() 在复原态给出单位 3x3 状态
{
  const r = C.reduce(C.solvedState());
  ok(r && r.cp.every((v, i) => v === i) && r.co.every(v => v === 0) &&
    r.ep.every((v, i) => v === i) && r.eo.every(v => v === 0), 'reduce(复原态) = 单位 3x3 状态');
  const r2 = C.reduce(C.applySeq(C.solvedState(), 'R U'));
  ok(r2 !== null, 'reduce(外层转动后) 有效');
  ok(C.reduce(C.applySeq(C.solvedState(), '2R')) === null, 'reduce(未配对状态) = null');
}
console.log(fails === 0 ? '\n全部通过' : '\n失败 ' + fails + ' 项');
process.exit(fails ? 1 : 0);
