const C = require('../src/cube4.js');
const S = require('../src/solver.js');

const n = parseInt(process.argv[2] || '5', 10);
const method = process.argv[3] || 'cfop';
let okCount = 0, totMs = 0, totMoves = 0, worstMs = 0, worstMoves = 0;
const phaseMoves = {};
for (let t = 0; t < n; t++) {
  const scr = C.randomScramble(40);
  const st = C.applySeq(C.solvedState(), scr);
  const t0 = Date.now();
  let res;
  try { res = S.solve(st, method); } catch (e) {
    console.log('#' + t + ' 失败: ' + e.message + '  打乱: ' + C.seqToString(scr));
    continue;
  }
  const ms = Date.now() - t0;
  // 独立校验：把解法逐步应用回打乱态
  let chk = st.slice();
  for (const s of res.steps) chk = C.applySeq(chk, s.moves.join(' '));
  const good = C.isSolved(chk);
  if (good) okCount++;
  totMs += ms; totMoves += res.moves.length;
  worstMs = Math.max(worstMs, ms); worstMoves = Math.max(worstMoves, res.moves.length);
  for (const s of res.steps) phaseMoves[s.phase] = (phaseMoves[s.phase] || 0) + s.moves.length;
  console.log(`#${t} ${good ? 'OK ' : 'BAD'} ${String(ms).padStart(6)}ms  ${String(res.moves.length).padStart(4)} 步  阶段数=${res.steps.length}`);
  if (t === 0) {
    for (const s of res.steps) console.log('    ' + s.phase.padEnd(4) + ' | ' + s.name.padEnd(24) + ' (' + String(s.moves.length).padStart(3) + ') ' + s.moves.join(' '));
  }
}
console.log(`\n[${method}] 成功 ${okCount}/${n}  平均 ${(totMs / n).toFixed(0)}ms / ${(totMoves / n).toFixed(0)} 步  最差 ${worstMs}ms / ${worstMoves} 步`);
console.log('各阶段平均步数: ' + Object.entries(phaseMoves).map(([k, v]) => k + '=' + (v / n).toFixed(0)).join('  '));
