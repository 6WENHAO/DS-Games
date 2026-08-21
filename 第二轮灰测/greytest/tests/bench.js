/* =====================================================================
 * tests/bench.js —— 生成教学文档里的定量对比表（node tests/bench.js）
 * ---------------------------------------------------------------------
 * 四种控制器 × 五种工况，统一指标：
 *   settle : 最后一次离开"稳定带"(|θ|<0.573°、|x−x_ref|<2 cm) 的时刻
 *   max|θ| : 全程最大倾角
 *   ∫u²dt  : 控制能量
 *   J      : 与 LQR 同一套 Q、R 算出的累积代价（跨控制器可比）
 *   x_end  : 末态位置误差（看静差）
 *   sat    : 执行器饱和采样占比
 * 文档中的表格直接取自本脚本输出，保证"文档数字 = 代码行为"。
 * ===================================================================== */
'use strict';
const path = require('path');
require(path.join(__dirname, '..', 'src', 'linalg.js'));
require(path.join(__dirname, '..', 'src', 'model.js'));
require(path.join(__dirname, '..', 'src', 'lqr.js'));
require(path.join(__dirname, '..', 'src', 'controllers.js'));
require(path.join(__dirname, '..', 'src', 'analysis.js'));
const LA = globalThis.LinAlg, CP = globalThis.CartPole, LQR = globalThis.LQR;
const CTRL = globalThis.Controllers, AN = globalThis.Analysis;

const p = Object.assign({}, CP.DEFAULT_PARAMS);
const lin = CP.linearize(p);
const ana = CP.analyze(p);
const W = Object.assign({}, LQR.DEFAULT_WEIGHTS, { uMax: p.uMax });
const QR = LQR.brysonWeights(W, p);
const lqrOut = LQR.lqr(lin.A, lin.B, QR.Q, QR.R);
const lqiOut = LQR.lqrIntegral(lin.A, lin.B, QR.Q, QR.R, 4 / 0.25);

const Ts = 0.01, dt = 0.002;

function run(makeCtrl, scen) {
  const ctrl = makeCtrl();
  let s = (scen.s0 || [0, 0, 0, 0]).slice(), u = 0, t = 0, next = 0;
  const T = scen.T || 25;
  let maxTh = 0, ue = 0, J = 0, lastBad = 0, sat = 0, ns = 0, dead = null;
  for (let k = 0; k < Math.round(T / dt); k++) {
    const xRef = scen.xRef ? scen.xRef(t) : 0;
    if (ctrl && t >= next - 1e-12) {
      u = ctrl.compute(s, t, { xRef: xRef, thetaRef: 0 });
      next += Ts; ns++;
      if (Math.abs(u) >= p.uMax * 0.999) sat++;
    }
    const w = scen.wind ? scen.wind(t) : 0;
    s = CP.rk4Step(s, CP.clampForce(u + w, p), p, dt); t += dt;
    const th = CP.wrapPi(s[2]);
    maxTh = Math.max(maxTh, Math.abs(th)); ue += u * u * dt;
    const e = [s[0] - xRef, s[1], th, s[3]];
    let q = 0;
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) q += e[i] * QR.Q[i][j] * e[j];
    J += (q + QR.R[0][0] * u * u) * dt;
    if (!(Math.abs(th) < 0.01 && Math.abs(s[0] - xRef) < 0.02)) lastBad = t;
    if (Math.abs(th) > 1.3 || Math.abs(s[0]) > p.railHalf) { dead = t; break; }
  }
  const xRefEnd = scen.xRef ? scen.xRef(t) : 0;
  return dead !== null
    ? { dead: dead }
    : { settle: lastBad, maxTh: maxTh, ue: ue, J: J, xErr: s[0] - xRefEnd, sat: 100 * sat / Math.max(1, ns) };
}

const CTRLS = [
  ['单环 PID', () => new CTRL.AnglePID(CTRL.DEFAULT_PID.inner, p)],
  ['串级 PID', () => new CTRL.CascadePID(CTRL.DEFAULT_PID, p)],
  ['LQR', () => new CTRL.LQRController(lqrOut.K, p)],
  ['LQR+积分', () => new CTRL.LQRController(lqiOut.K, p)]
];
const SCENS = [
  ['初始倾角 0.2 rad', { s0: [0, 0, 0.2, 0], T: 25 }],
  ['位置阶跃 0.4 m', { T: 25, xRef: (t) => (t > 1 ? 0.4 : 0) }],
  ['角速度冲击 2 rad/s', { s0: [0, 0, 0, 2], T: 25 }],
  ['恒定风扰 1 N', { T: 30, wind: (t) => (t > 2 ? 1 : 0) }],
  ['方波跟踪 ±0.3 m', { T: 30, xRef: (t) => ((t % 10) < 5 ? 0.3 : -0.3) }]
];

console.log('============ 控制器定量对比（默认参数，Ts=10 ms，含 ±10 N 饱和）============\n');
console.log('| 工况 | 控制器 | 稳定时间 s | max|θ| ° | ∫u²dt | 代价 J | 末态位置误差 m | 饱和率 % |');
console.log('|---|---|---|---|---|---|---|---|');
for (const [sn, sc] of SCENS) {
  for (const [cn, mk] of CTRLS) {
    const r = run(mk, sc);
    if (r.dead !== undefined) {
      console.log(`| ${sn} | ${cn} | **失败 @ ${r.dead.toFixed(1)}s** | — | — | — | — | — |`);
    } else {
      console.log(`| ${sn} | ${cn} | ${r.settle.toFixed(1)} | ${(r.maxTh * 180 / Math.PI).toFixed(2)} | ${r.ue.toFixed(2)} | ${r.J.toFixed(1)} | ${r.xErr.toFixed(4)} | ${r.sat.toFixed(0)} |`);
    }
  }
}

console.log('\n============ 关键设计数据 ============');
console.log(`不稳定极点 p             = ${ana.pUnstable.toFixed(4)} rad/s  (无摩擦解析值)`);
console.log(`含摩擦最大特征值         = ${Math.max(...ana.poles.map((z) => z.re)).toFixed(4)} rad/s`);
console.log(`误差倍增时间 ln2/p       = ${(Math.log(2) / ana.pUnstable).toFixed(4)} s`);
console.log(`u→x 右半平面零点 z       = ${ana.zRHP.toFixed(4)} rad/s`);
console.log(`能控性矩阵 rank / cond   = ${ana.rank} / ${ana.cond.toFixed(1)}`);
console.log(`Q = diag(${LA.toRows(QR.Q).map((r, i) => r[i].toFixed(3)).join(', ')}),  R = ${QR.R[0][0].toExponential(3)}`);
console.log(`LQR  K  = [${Array.from(lqrOut.K[0]).map((v) => v.toFixed(4)).join(', ')}]`);
console.log(`LQR  闭环极点 = ${lqrOut.poles.map((z) => z.re.toFixed(4) + (Math.abs(z.im) > 1e-9 ? (z.im >= 0 ? '+' : '-') + Math.abs(z.im).toFixed(4) + 'i' : '')).join(', ')}`);
console.log(`LQR  ARE 残差 = ${lqrOut.residual.toExponential(3)}  (牛顿 ${lqrOut.iters} 步)`);
console.log(`LQI  K  = [${Array.from(lqiOut.K[0]).map((v) => v.toFixed(4)).join(', ')}]  (首项为积分增益 kᵢ)`);
console.log(`PID  内环 Kp/Ki/Kd = ${CTRL.DEFAULT_PID.inner.Kp} / ${CTRL.DEFAULT_PID.inner.Ki} / ${CTRL.DEFAULT_PID.inner.Kd}`);
console.log(`PID  外环 Kp/Ki/Kd = ${CTRL.DEFAULT_PID.outer.Kp} / ${CTRL.DEFAULT_PID.outer.Ki} / ${CTRL.DEFAULT_PID.outer.Kd}`);

const cfg = { pid: CTRL.DEFAULT_PID, K: lqrOut.K };
for (const [name, mode] of [['单环 PID', 'pid'], ['串级 PID', 'cascade'], ['LQR', 'lqr']]) {
  const cl = AN.closedLoop(mode, lin, cfg);
  const poles = LA.eigenvalues(cl.A);
  const gm = AN.gainMarginInterval(cl, lin.B);
  const cs = AN.criticalSampling(lin, cl, CTRL.DEFAULT_PID.outer);
  console.log(`\n[${name}] 闭环 ${cl.A.length} 阶`);
  console.log(`  极点     : ${poles.map((z) => z.re.toFixed(4) + (Math.abs(z.im) > 1e-9 ? (z.im >= 0 ? '+' : '-') + Math.abs(z.im).toFixed(4) + 'i' : '')).join(', ')}`);
  console.log(`  增益裕度 : α ∈ [${gm.lo.toFixed(3)}, ${gm.hi === Infinity ? '∞' : gm.hi.toFixed(2)}]`);
  console.log(`  Ts_crit  : ${isFinite(cs.Ts) ? (cs.Ts * 1000).toFixed(1) + ' ms (' + (1 / cs.Ts).toFixed(0) + ' Hz), p·Ts_crit = ' + (ana.pUnstable * cs.Ts).toFixed(3) : cs.note}`);
}

console.log('\n============ 摆长对控制难度的影响 ============');
console.log('结论：z < p 恒成立。无摩擦时 p/z = 1/√(1−3m/(4(M+m)))，只取决于质量比，与 L、g 无关；');
console.log('      转轴摩擦 c 会把零点稍微往左推（z 变小），使实际分离比略大于解析值。');
console.log('|  L (m) | p (rad/s) | z 含摩擦 | z 无摩擦 | p/z 无摩擦 | 内环建议 ≥2p | 外环上限 z/2 | 时标分离比 |');
console.log('|---|---|---|---|---|---|---|---|');
for (const L of [0.2, 0.3, 0.6, 0.9, 1.2, 1.6]) {
  const pp = Object.assign({}, p, { L: L });
  const a = CP.analyze(pp);
  const af = CP.analyze(Object.assign({}, pp, { b: 0, c: 0 }));
  const inner = 2 * a.pUnstable, outer = a.zRHP / 2;
  console.log(`| ${L.toFixed(2)} | ${a.pUnstable.toFixed(3)} | ${a.zRHP.toFixed(3)} | ${af.zRHP.toFixed(3)} | ${(af.pUnstable / af.zRHP).toFixed(4)} | ${inner.toFixed(2)} | ${outer.toFixed(2)} | ${(inner / outer).toFixed(1)}× |`);
}
const anaF = CP.analyze(Object.assign({}, p, { b: 0, c: 0 }));
console.log(`\n解析式校验（无摩擦）：p/z = 1/√(1−3m/(4(M+m))) = ${anaF.pzRatio.toFixed(6)}，数值 = ${(anaF.pUnstable / anaF.zRHP).toFixed(6)}`);
console.log(`含摩擦时零点解析式 z = (−c+√(c²+4Jmgl))/(2J) = ${ana.zRHP.toFixed(6)} rad/s（与 b 无关）`);
