/* 批量随机求解压力测试：报告失败、平均/最差耗时、慢例的阶段明细 */
const C = require('../src/cube4.js');
const S = require('../src/solver.js');

const N = parseInt(process.argv[2] || '100', 10);
const only = process.argv[3];           // 可选：cfop / roux
let slow = 0, worst = 0, tot = 0, fail = 0, totMoves = 0;
for (let t = 0; t < N; t++) {
  const method = only || (t % 2 ? 'roux' : 'cfop');
  const st = C.applySeq(C.solvedState(), C.randomScramble(40));
  let res;
  try { res = S.solve(st, method); } catch (e) { fail++; console.log('#' + t + ' [' + method + '] 求解失败: ' + e.message); continue; }
  let chk = st.slice();
  for (const s of res.steps) chk = C.applySeq(chk, s.moves.join(' '));
  if (!C.isSolved(chk)) { fail++; console.log('#' + t + ' [' + method + '] 独立校验失败'); }
  tot += res.ms; worst = Math.max(worst, res.ms); totMoves += res.moves.length;
  if (res.ms > 3000) {
    slow++;
    console.log(`#${t} [${method}] 慢 ${res.ms}ms : ` + res.steps.filter(s => s.ms > 600).map(s => s.name + '=' + s.ms).join(' | '));
  }
}
console.log(`N=${N} 失败 ${fail} | 平均 ${(tot / N).toFixed(0)}ms / ${(totMoves / N).toFixed(0)} 步 | 最差 ${worst}ms | >3s 比例 ${slow}/${N}`);
process.exit(fail ? 1 : 0);
