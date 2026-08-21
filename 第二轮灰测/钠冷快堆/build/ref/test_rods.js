/* 控制棒模块测试脚本（rods.js） */
'use strict';
const R = require('../js/rods.js');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  const mark = cond ? 'PASS' : 'FAIL';
  if (cond) pass++; else fail++;
  console.log(`[${mark}] ${name}${detail ? '  |  ' + detail : ''}`);
}
function near(a, b, tol) { return Math.abs(a - b) <= tol; }

console.log('==== 1. 价值曲线 worth / dWorth ====');
const Wt = 5800;
ok('W(0)=0', near(R.worth(0, Wt), 0, 1e-9), `W(0)=${R.worth(0, Wt)}`);
ok('W(H)=W_tot', near(R.worth(R.HMM, Wt), Wt, 1e-9), `W(950)=${R.worth(R.HMM, Wt)}`);
ok('W(H/2)=W_tot/2', near(R.worth(R.HMM / 2, Wt), Wt / 2, 1e-9), `W(475)=${R.worth(R.HMM / 2, Wt)}`);
const dmax = 2 * Wt / R.HMM;
ok('dW/dd(H/2)=2W_tot/H', near(R.dWorth(R.HMM / 2, Wt), dmax, 1e-9), `dW/dd(475)=${R.dWorth(R.HMM / 2, Wt).toFixed(6)} 期望 ${dmax.toFixed(6)} pcm/mm`);

console.log('\n==== 2. 落棒动力学 scramODE ====');
const sRef = R.scramODE({ Wtot: 5800 });
const sNoSpring = R.scramODE({ Wtot: 5800, spring: false });
const sNoDash = R.scramODE({ Wtot: 5800, dashpot: false });
ok('90% 插入时间 ∈ [0.3,1.2] s', sRef.t90 > 0.3 && sRef.t90 < 1.2, `t90=${sRef.t90.toFixed(4)} s`);
ok('着底冲击速度 < 0.5 m/s', sRef.vImpact < 0.5, `vImpact=${sRef.vImpact.toFixed(4)} m/s (c_d_dashpot=${sRef.cdDash})`);
ok('无弹簧时更慢', sNoSpring.t100 > sRef.t100, `t100 无弹簧=${sNoSpring.t100.toFixed(4)} s vs 设计=${sRef.t100.toFixed(4)} s`);
ok('无缓冲器时冲击速度显著更大', sNoDash.vImpact > 5 * sRef.vImpact, `无缓冲=${sNoDash.vImpact.toFixed(3)} m/s vs 设计=${sRef.vImpact.toFixed(3)} m/s`);
console.log(`     10%/50%/90%/100% 插入时刻: ${sRef.t10.toFixed(4)} / ${sRef.t50.toFixed(4)} / ${sRef.t90.toFixed(4)} / ${sRef.t100.toFixed(4)} s`);
console.log(`     最大速度=${sRef.vMax.toFixed(3)} m/s；c_d=1400 时冲击=${sRef.vImpactGiven.toFixed(3)} m/s`);

console.log('\n==== 3. 点堆动态 integratePK ====');
// (a) ρ 阶跃 -5800 pcm 瞬发跌落
const rhoStep = -5800 * R.PCM;
const rp = R.integratePK({ tEnd: 5e-3, dt: 1e-5, rhoExt: () => rhoStep, feedback: false });
const ppDrop = rp.P[rp.P.length - 1] / rp.P0;
const expectDrop = R.promptDrop(rhoStep);
const relErr = Math.abs(ppDrop - expectDrop) / expectDrop;
ok('瞬发跌落 P/P0 与 β/(β+|ρ|) 相差 <10%', relErr < 0.10, `P/P0=${ppDrop.toFixed(5)} 期望 ${expectDrop.toFixed(5)} 相对误差 ${(relErr * 100).toFixed(2)}%`);

// (b) ρ=0 功率守恒（1000 步）
const rc = R.integratePK({ tEnd: 1.0, dt: 1e-3, rhoExt: () => 0, feedback: false });
const drift = Math.abs(rc.P[rc.P.length - 1] - 1.0);
ok('ρ=0 功率守恒（1000 步漂移 <0.1%）', drift < 0.001, `P_end=${rc.P[rc.P.length - 1].toFixed(9)} 漂移=${drift.toExponential(2)}`);

// (c) 小正阶跃 +10 pcm 渐近倍增周期 vs in-hour
const rhoPos = 10 * R.PCM;
const rper = R.integratePK({ tEnd: 2000, dt: 5e-3, rhoExt: () => rhoPos, feedback: false });
const t = rper.t, P = rper.P;
const t1 = 1600, t2 = 2000;
function pAt(tt) {
  if (tt <= t[0]) return P[0];
  for (let i = 1; i < t.length; i++) if (t[i] >= tt) {
    const f = (tt - t[i - 1]) / (t[i] - t[i - 1]);
    return P[i - 1] + f * (P[i] - P[i - 1]);
  }
  return P[P.length - 1];
}
const Tmeas = (t2 - t1) / Math.log(pAt(t2) / pAt(t1));
const Thour = R.inHourPeriod(rhoPos);
const perr = Math.abs(Tmeas - Thour) / Thour;
ok('+10 pcm 渐近周期与 in-hour 解相差 <5%', perr < 0.05, `实测 T=${Tmeas.toFixed(1)} s in-hour=${Thour.toFixed(1)} s 误差 ${(perr * 100).toFixed(2)}%`);

console.log('\n==== 4. 反应性需求校核表 ====');
ok('温度缺陷=390 pcm', R.REQ.tempDefect === 390);
ok('功率缺陷=900 pcm', R.REQ.powerDefect === 900);
ok('燃耗摆动=900 pcm', R.REQ.burnup === 900);
ok('不确定裕量=600 pcm', R.REQ.uncertainty === 600);
ok('SR-1 校核 5800-620-2790=2390 ≥2000', R.sr1Check === 2390 && R.sr1Check >= 2000, `sr1Check=${R.sr1Check}`);
ok('SR-2 校核 3200-900=2300 ≥2000', R.sr2Check === 2300 && R.sr2Check >= 2000, `sr2Check=${R.sr2Check}`);

console.log('\n==== 5. 负荷跟踪幅度 / 引入率 ====');
const lf = R.loadFollowAmplitude();
ok('负荷跟踪幅度 ∈ (0,200) mm', lf > 0 && lf < 200, `loadFollowAmplitude=${lf.toFixed(2)} mm`);
const mir = R.maxInsertionRate();
ok('最大反应性引入率 ≤ 3 pcm/s', mir <= 3, `maxInsertionRate=${mir.toFixed(4)} pcm/s`);

console.log('\n==== 结果汇总 ====');
console.log(`PASS=${pass}  FAIL=${fail}`);
if (fail > 0) { console.log('存在 FAIL，退出码 1'); process.exit(1); }
console.log('全部通过。');
