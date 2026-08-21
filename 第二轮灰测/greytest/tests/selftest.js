/* =====================================================================
 * tests/selftest.js —— 数值内核自检（Node 环境运行：node tests/selftest.js）
 * ---------------------------------------------------------------------
 * 教学价值：控制仿真最怕"看起来动了，其实模型/求解器是错的"。
 * 这里用 6 组可独立验证的判据把数值内核钉死：
 *   1. 多项式求根（对已知根的多项式）
 *   2. Lyapunov 方程残差
 *   3. 解析线性化 vs 数值雅可比
 *   4. 无摩擦自由摆动的能量守恒（检验 RK4 与动力学一致性）
 *   5. ARE 残差 + 闭环极点全在左半平面
 *   6. 闭环非线性仿真真的把摆稳住了；开环一定倒
 * 另外打印默认参数下的 K、闭环极点等，用于与 Python 参考实现交叉验证。
 * ===================================================================== */
'use strict';
const path = require('path');
require(path.join(__dirname, '..', 'src', 'linalg.js'));
require(path.join(__dirname, '..', 'src', 'model.js'));
require(path.join(__dirname, '..', 'src', 'lqr.js'));
require(path.join(__dirname, '..', 'src', 'controllers.js'));
require(path.join(__dirname, '..', 'src', 'analysis.js'));

const LA = globalThis.LinAlg;
const CP = globalThis.CartPole;
const LQR = globalThis.LQR;
const CTRL = globalThis.Controllers;
const AN = globalThis.Analysis;

let pass = 0, fail = 0;
function check(name, cond, detail) {
  if (cond) { pass++; console.log(`  [PASS] ${name}${detail ? '  ' + detail : ''}`); }
  else { fail++; console.log(`  [FAIL] ${name}${detail ? '  ' + detail : ''}`); }
}
function fmt(x, n) { return Number(x).toExponential(n === undefined ? 3 : n); }
function fmtF(x, n) { return Number(x).toFixed(n === undefined ? 4 : n); }
function fmtZ(z) { return fmtF(z.re, 4) + (Math.abs(z.im) > 1e-9 ? (z.im >= 0 ? '+' : '-') + fmtF(Math.abs(z.im), 4) + 'i' : ''); }

const p = Object.assign({}, CP.DEFAULT_PARAMS);

console.log('=== 1. 多项式求根 (Durand-Kerner) ===');
{
  // (s+1)(s+2)(s+3)(s+4) = s^4 +10s^3 +35s^2 +50s +24
  const roots = LA.polyRoots([24, 50, 35, 10, 1]).map((z) => z.re).sort((a, b) => a - b);
  const err = Math.max(...roots.map((r, i) => Math.abs(r - [-4, -3, -2, -1][i])));
  check('实根多项式误差 < 1e-9', err < 1e-9, `max err=${fmt(err)}`);
  // (s^2+2s+5)(s^2+4) -> 根 -1±2i, ±2i
  const r2 = LA.polyRoots([20, 8, 9, 2, 1]);
  const hasPair = r2.some((z) => Math.abs(z.re + 1) < 1e-8 && Math.abs(Math.abs(z.im) - 2) < 1e-8);
  const hasImag = r2.some((z) => Math.abs(z.re) < 1e-8 && Math.abs(Math.abs(z.im) - 2) < 1e-8);
  check('复根定位正确', hasPair && hasImag, r2.map((z) => `${fmtF(z.re, 3)}${z.im >= 0 ? '+' : '-'}${fmtF(Math.abs(z.im), 3)}i`).join(', '));
}

console.log('=== 2. Lyapunov 方程 AᵀP + PA = -Q ===');
{
  const A = [[-1, 2, 0, 0], [0, -3, 1, 0], [0, 0, -2, 4], [1, 0, 0, -5]].map((r) => Float64Array.from(r));
  const Q = LA.diag([1, 2, 3, 4]);
  const P = LA.lyapunovSolveT(A, Q);
  const res = LA.normF(LA.add(LA.add(LA.mul(LA.transpose(A), P), LA.mul(P, A)), Q));
  check('残差 < 1e-12', res < 1e-12, `‖res‖=${fmt(res)}`);
  check('P 对称正定 (λmin>0)', LA.jacobiEigSym(P).values.every((v) => v > 0),
    'λ(P)=' + LA.jacobiEigSym(P).values.map((v) => fmtF(v, 4)).join(', '));
}

console.log('=== 3. 解析线性化 vs 数值雅可比 ===');
{
  const lin = CP.linearize(p);
  const num = CP.numericJacobian(p, [0, 0, 0, 0], 0, 1e-5);
  const eA = LA.normF(LA.sub(lin.A, num.A));
  const eB = LA.normF(LA.sub(lin.B, num.B));
  check('‖A_analytic - A_numeric‖ < 1e-6', eA < 1e-6, `err=${fmt(eA)}`);
  check('‖B_analytic - B_numeric‖ < 1e-8', eB < 1e-8, `err=${fmt(eB)}`);
  console.log('  A =');
  LA.toRows(lin.A).forEach((r) => console.log('     [' + r.map((v) => fmtF(v, 4).padStart(9)).join(' ') + ' ]'));
  console.log('  B = [' + LA.toRows(lin.B).map((r) => fmtF(r[0], 4)).join(', ') + ']ᵀ');
}

console.log('=== 4. 无摩擦能量守恒 (自由摆动 5 s) ===');
{
  const pf = Object.assign({}, p, { b: 0, c: 0 });
  let s = [0, 0, Math.PI / 2, 0];
  const E0 = CP.energy(s, pf).E;
  const Escale = pf.m * pf.g * CP.derived(pf).l;   // 天然能量尺度 m g l（θ=π/2 时 E0 恰为 0，不能用它归一化）
  const dt = 0.002;
  let maxErr = 0;
  for (let k = 0; k < 2500; k++) {
    s = CP.rk4Step(s, 0, pf, dt);
    maxErr = Math.max(maxErr, Math.abs(CP.energy(s, pf).E - E0));
  }
  const rel = maxErr / Escale;
  check('能量相对漂移 < 1e-6 (以 mgl 为尺度)', rel < 1e-6, `rel=${fmt(rel)}  E0=${fmtF(E0, 6)} J, mgl=${fmtF(Escale, 4)} J`);
  // 无控制时动量方向自检：摆从水平放开，重力使其向下摆 → theta 增大到 pi 附近
  check('自由摆动 θ 落向下垂方向', Math.abs(CP.wrapPi(s[2])) > Math.PI / 2, `θ_end=${fmtF(CP.wrapPi(s[2]), 3)} rad`);
}

console.log('=== 5. 结构性质与 ARE 求解 ===');
let lqrOut = null, ana = null;
{
  ana = CP.analyze(p);
  check('能控性矩阵满秩 (rank=4)', ana.rank === 4, `rank=${ana.rank}, cond=${fmtF(ana.cond, 1)}`);
  const openMax = Math.max(...ana.poles.map((z) => z.re));
  check('开环存在右半平面极点（本质不稳定）', openMax > 0.1,
    '开环极点: ' + ana.poles.map((z) => fmtZ(z)).join(', '));
  // 解析式 p = sqrt(m g l (M+m)/D0) 是"无摩擦"结论，故与无摩擦模型的特征值比较
  {
    const pf = Object.assign({}, p, { b: 0, c: 0 });
    const anaF = CP.analyze(pf);
    const openMaxF = Math.max(...anaF.poles.map((z) => z.re));
    check('解析不稳定极点 = 无摩擦模型数值特征值', Math.abs(openMaxF - anaF.pUnstable) < 1e-9,
      `解析 p=${fmtF(anaF.pUnstable, 6)} rad/s, 数值=${fmtF(openMaxF, 6)}`);
    console.log(`  含摩擦时不稳定极点 = ${fmtF(openMax, 4)} rad/s，倍增时间 ln2/p = ${fmtF(Math.log(2) / openMax, 4)} s`);
  }
  console.log(`  u→x 通道右半平面零点 z = ${fmtF(ana.zRHP, 4)} rad/s （非最小相位，见理论文档 §3）`);
  // 传输零点的独立验证：z 应使 det([[A−sI, B],[C, 0]]) = 0（C = [1,0,0,0]，取 x 为输出）
  {
    const detAt = (s, C) => {
      const Mc = LA.zeros(5, 5);
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) Mc[i][j] = ana.A[i][j] - (i === j ? s : 0);
        Mc[i][4] = ana.B[i][0];
      }
      for (let j = 0; j < 4; j++) Mc[4][j] = C[j];
      let det = 1;
      for (let c = 0; c < 5; c++) {
        let piv = c, best = Math.abs(Mc[c][c]);
        for (let r = c + 1; r < 5; r++) if (Math.abs(Mc[r][c]) > best) { best = Math.abs(Mc[r][c]); piv = r; }
        if (best < 1e-300) return 0;
        if (piv !== c) { const t = Mc[piv]; Mc[piv] = Mc[c]; Mc[c] = t; det = -det; }
        det *= Mc[c][c];
        for (let r = c + 1; r < 5; r++) {
          const f = Mc[r][c] / Mc[c][c];
          for (let j = c; j < 5; j++) Mc[r][j] -= f * Mc[c][j];
        }
      }
      return det;
    };
    const Cx = [1, 0, 0, 0], Cth = [0, 0, 1, 0];
    const off = Math.abs(detAt(ana.zRHP * 1.15, Cx));
    const atZ = Math.abs(detAt(ana.zRHP, Cx)), atZL = Math.abs(detAt(ana.zLHP, Cx));
    check('解析零点 z 确实是 u→x 的传输零点 (det ≈ 0)', atZ < 1e-9 * off,
      `|det(z)|=${fmt(atZ)}，|det(1.15z)|=${fmt(off)}，比值=${fmt(atZ / off)}`);
    check('左半平面零点同样满足 det ≈ 0', atZL < 1e-9 * off, `|det(z_LHP)|=${fmt(atZL)}`);
    // u→θ 通道：未约简时分子恒 ∝ s²（原点双重零点），有无摩擦都一样；
    // 真正的区别在**分母**原点极点的重数：b=0 时二重（s² 全部约掉 ⇒ 无原点零点），
    // b≠0 时只有一重（只约掉一个 s ⇒ 剩一个原点零点）。这才是"纯 PD 不可稳"的来源。
    {
      const r1 = detAt(1e-3, Cth) / 1e-6, r2 = detAt(1e-4, Cth) / 1e-8;
      check('u→θ 未约简分子 ∝ s²（原点双重零点）', Math.abs(detAt(0, Cth)) < 1e-12 && Math.abs(r1 - r2) < 1e-3 * Math.abs(r2),
        `N(0)=${fmt(Math.abs(detAt(0, Cth)))}，N(1e-3)/1e-6=${fmtF(r1, 6)}，N(1e-4)/1e-8=${fmtF(r2, 6)}（= −ml/D₀，比值恒定 ⇒ 二重零点）`);
      const zeroPoles = (pp) => CP.analyze(pp).poles.filter((z) => Math.hypot(z.re, z.im) < 1e-8).length;
      const nb0 = zeroPoles(Object.assign({}, p, { b: 0 })), nb1 = zeroPoles(p);
      check('分母原点极点重数：b=0 为 2、b≠0 为 1', nb0 === 2 && nb1 === 1,
        `b=0 ⇒ ${nb0} 个零极点（s² 全约掉，无原点零点，约简后 2 阶）；b=${p.b} ⇒ ${nb1} 个（只约掉一个 s，剩 1 个原点零点，约简后 3 阶）`);
    }
    const pf2 = CP.analyze(Object.assign({}, p, { b: 0, c: 0 }));
    check('p/z = 1/√(1−3m/(4(M+m))) 与数值一致（与 L、g 无关）',
      Math.abs(pf2.pUnstable / pf2.zRHP - pf2.pzRatio) < 1e-12,
      `解析 ${fmtF(pf2.pzRatio, 6)}, 数值 ${fmtF(pf2.pUnstable / pf2.zRHP, 6)}`);
    const pb = CP.analyze(Object.assign({}, p, { b: 10 }));
    check('小车摩擦 b 不影响 u→x 零点', Math.abs(pb.zRHP - ana.zRHP) < 1e-12,
      `b=0.1 ⇒ z=${fmtF(ana.zRHP, 6)}；b=10 ⇒ z=${fmtF(pb.zRHP, 6)}`);
  }


  const w = Object.assign({}, LQR.DEFAULT_WEIGHTS, { uMax: p.uMax });
  const QR = LQR.brysonWeights(w, p);
  console.log('  Q = diag(' + LA.toRows(QR.Q).map((r, i) => fmtF(r[i], 3)).join(', ') + '),  R = [' + fmt(QR.R[0][0]) + ']');
  // Bass 初始增益必须是稳定的（这是牛顿迭代收敛的前提）
  const K0 = LQR.bassGain(ana.A, ana.B);
  check('Bass 算法给出的初始增益已使闭环稳定', LQR.isStable(ana.A, ana.B, K0),
    'K0 = [' + LA.toRows(K0)[0].map((v) => fmtF(v, 3)).join(', ') + ']');
  const t0 = Date.now();
  lqrOut = LQR.lqr(ana.A, ana.B, QR.Q, QR.R);
  const ms = Date.now() - t0;
  check('ARE 残差 < 1e-8', lqrOut.residual < 1e-8,
    `绝对 ‖res‖=${fmt(lqrOut.residual)}，归一化 res/(1+‖P‖F)=${fmt(lqrOut.residual / (1 + LA.normF(lqrOut.P)))}（初值=${lqrOut.init}, 牛顿 ${lqrOut.iters} 步, 耗时 ${ms} ms）`);
  check('归一化 ARE 残差 < 1e-12', lqrOut.residual / (1 + LA.normF(lqrOut.P)) < 1e-12,
    '注：绝对残差的量级由 ‖Q‖ 决定（此处 Q_θθ=328），谈精度必须归一化');
  // 精确不变量：K_x = −√(q_x/R)。由 Kalman 谱分解恒等式在 A 的零特征值方向取 s→0 极限可得，
  // 与 m、L、g、摩擦全都无关 —— 是可以手算校验 LQR 求解器的"标尺"。
  {
    let worst = 0, detail = [];
    for (const [qx, r] of [[1, 1], [4, 1], [1, 4], [100, 0.5]]) {
      const w2 = Object.assign({}, LQR.DEFAULT_WEIGHTS, { uMax: p.uMax, qx: qx, r: r });
      const QR2 = LQR.brysonWeights(w2, p);
      const o2 = LQR.lqr(ana.A, ana.B, QR2.Q, QR2.R);
      const pred = -Math.sqrt(QR2.Q[0][0] / QR2.R[0][0]);
      worst = Math.max(worst, Math.abs(o2.K[0][0] - pred));
      detail.push(`q_x/R=${fmtF(QR2.Q[0][0] / QR2.R[0][0], 0)}⇒${fmtF(o2.K[0][0], 4)}`);
    }
    check('精确不变量 K_x = −√(q_x/R)（4 组权重）', worst < 1e-9, `最大偏差 ${fmt(worst)}；${detail.join(', ')}`);
  }
  check('P 对称半正定', lqrOut.Pdefinite, 'λ(P)=' + lqrOut.eigP.map((v) => fmtF(v, 3)).join(', '));
  check('闭环极点全部在左半平面', lqrOut.stable,
    '闭环极点: ' + lqrOut.poles.map((z) => fmtZ(z)).join(', '));
  console.log('  K = [' + LA.toRows(lqrOut.K)[0].map((v) => fmtF(v, 4)).join(', ') + ']');
  console.log('  P =');
  LA.toRows(lqrOut.P).forEach((r) => console.log('     [' + r.map((v) => fmtF(v, 4).padStart(10)).join(' ') + ' ]'));
  // 与完全独立的第二种解法（自适应值迭代）对比：验证解的唯一性/正确性
  const Pvi = LQR.riccatiValueIteration(ana.A, ana.B, QR.Q, QR.R);
  const dP = LA.normF(LA.sub(Pvi, lqrOut.P)) / LA.normF(lqrOut.P);
  check('值迭代解 ≈ 牛顿解 (相对差 < 1e-6)', dP < 1e-6, `rel diff=${fmt(dP)}, 值迭代步数=${Pvi.__steps}`);
}

console.log('=== 6. 闭环非线性仿真 ===');
{
  const s0 = [0, 0, 0.2, 0];
  // (a) 开环必倒
  {
    let s = s0.slice();
    for (let k = 0; k < 1500; k++) s = CP.rk4Step(s, 0, p, 0.002);
    check('开环 3 s 后摆已倒下 (|θ| > 1 rad)', Math.abs(s[2]) > 1, `|θ|=${fmtF(Math.abs(s[2]), 3)} rad`);
  }
  // (b) LQR 闭环（含 10 ms 零阶保持采样）
  {
    const ctrl = new CTRL.LQRController(lqrOut.K, p);
    let s = s0.slice(), u = 0, t = 0;
    const dt = 0.002, Ts = 0.01;
    let nextSample = 0, uEnergy = 0;
    for (let k = 0; k < 5000; k++) {
      if (t >= nextSample - 1e-12) { u = ctrl.compute(s, t, { xRef: 0 }); nextSample += Ts; }
      s = CP.rk4Step(s, u, p, dt); t += dt; uEnergy += u * u * dt;
    }
    check('LQR: |θ| < 1e-3 rad', Math.abs(s[2]) < 1e-3, `|θ|=${fmt(Math.abs(s[2]))}`);
    check('LQR: |x| < 5e-3 m 且近似静止', Math.abs(s[0]) < 5e-3 && Math.abs(s[1]) < 5e-3,
      `x=${fmt(s[0])} m, ẋ=${fmt(s[1])} m/s, ∫u²dt=${fmtF(uEnergy, 4)}`);
  }
  // (c) 串级 PID 闭环
  {
    const ctrl = new CTRL.CascadePID(CTRL.DEFAULT_PID, p);
    let s = s0.slice(), u = 0, t = 0;
    const dt = 0.002, Ts = 0.01;
    let nextSample = 0;
    for (let k = 0; k < 7500; k++) {
      if (t >= nextSample - 1e-12) { u = ctrl.compute(s, t, { xRef: 0 }); nextSample += Ts; }
      s = CP.rk4Step(s, u, p, dt); t += dt;
    }
    check('串级 PID: |θ| < 0.02 rad', Math.abs(s[2]) < 0.02, `|θ|=${fmt(Math.abs(s[2]))}`);
    check('串级 PID: |x| < 0.05 m（位置也被拉回）', Math.abs(s[0]) < 0.05, `x=${fmtF(s[0], 5)} m`);
  }
  // (d) 单环 PID：角度稳、但小车必然漂移（教学核心结论）
  {
    const gains = JSON.parse(JSON.stringify(CTRL.DEFAULT_PID));
    const ctrl = new CTRL.AnglePID(gains.inner, p);
    let s = [0, 0, 0.1, 0], u = 0, t = 0;
    const dt = 0.002, Ts = 0.01;
    let nextSample = 0;
    for (let k = 0; k < 7500; k++) {
      if (t >= nextSample - 1e-12) { u = ctrl.compute(s, t, { thetaRef: 0 }); nextSample += Ts; }
      s = CP.rk4Step(s, u, p, dt); t += dt;
    }
    check('单环 PID: 角度被稳住 (|θ| < 0.02 rad)', Math.abs(s[2]) < 0.02, `|θ|=${fmt(Math.abs(s[2]))}`);
    check('单环 PID: 小车明显漂移 (|x| > 0.1 m)', Math.abs(s[0]) > 0.1, `x=${fmtF(s[0], 4)} m （这不是 bug，是自由度不足，见 §5.2）`);
  }
  // (e) 摆起 + LQR 接管
  {
    const su = new CTRL.SwingUpController(lqrOut.K, p);
    let s = [0, 0, Math.PI, 0], u = 0, t = 0;
    const dt = 0.002, Ts = 0.005;
    let nextSample = 0, maxX = 0;
    for (let k = 0; k < 15000; k++) {   // 30 s
      if (t >= nextSample - 1e-12) { u = su.compute(s, t, { xRef: 0 }); nextSample += Ts; }
      s = CP.rk4Step(s, u, p, dt); t += dt;
      maxX = Math.max(maxX, Math.abs(s[0]));
    }
    check('摆起: 成功切换到 LQR 并稳定在直立位', su.mode === 'lqr' && Math.abs(CP.wrapPi(s[2])) < 0.01 && Math.abs(s[0]) < 0.05,
      `切换时刻 t=${su.switchTime === null ? 'n/a' : fmtF(su.switchTime, 2) + ' s'}, 末态 |θ|=${fmt(Math.abs(CP.wrapPi(s[2])))} rad, x=${fmtF(s[0], 4)} m`);
    check('摆起: 全程未撞限位 (|x| < railHalf)', maxX < p.railHalf, `max|x|=${fmtF(maxX, 3)} m < ${p.railHalf} m`);
  }
  // (f) LQI（增广 LQR）：常值风扰下静差应被消除，而普通 LQR 必然留下 d/K_x 的静差
  {
    const wq = Object.assign({}, LQR.DEFAULT_WEIGHTS, { uMax: p.uMax });
    const QR2 = LQR.brysonWeights(wq, p);
    const lqi = LQR.lqrIntegral(ana.A, ana.B, QR2.Q, QR2.R, 4 / (0.5 * 0.5));  // q_I = 4/zMax²
    const zeroI = LQR.lqrIntegral(ana.A, ana.B, QR2.Q, QR2.R, 0);
    // q_I = 0 时 z 方向在代价函数中无权重，ARE 在该方向退化，数值上得到 |kᵢ| ~ 1e-5（物理上可忽略）
    check('q_I = 0 时增广 LQR 自动退化为普通 LQR (kᵢ≈0)', Math.abs(zeroI.ki) < 1e-4, `kᵢ=${fmt(zeroI.ki)}（数值退化残留，50 s 内贡献 < 1e-4 N）`);
    check('LQI 闭环稳定且 ARE 残差小', lqi.stable && lqi.residual < 1e-8,
      `kᵢ=${fmtF(lqi.ki, 3)}, ‖res‖=${fmt(lqi.residual)}, 极点: ` + lqi.poles.map((z) => fmtZ(z)).join(', '));

    const wind = 1.0;   // N，恒定风扰
    const runWind = (ctrl) => {
      let s = [0, 0, 0, 0], u = 0, t = 0, next = 0;
      const dt = 0.002, Ts = 0.01;
      for (let k = 0; k < 25000; k++) {   // 50 s
        if (t >= next - 1e-12) { u = ctrl.compute(s, t, { xRef: 0 }); next += Ts; }
        s = CP.rk4Step(s, CP.clampForce(u + (t > 2 ? wind : 0), p), p, dt); t += dt;
      }
      return s;
    };
    const sPlain = runWind(new CTRL.LQRController(lqrOut.K, p));
    const sLqi = runWind(new CTRL.LQRController(lqi.K, p));
    const predicted = wind / lqrOut.K[0][0];   // 理论静差 x_ss = d / K_x
    check('普通 LQR 静差 = 解析预测值 d/K_x', Math.abs(sPlain[0] - predicted) < 2e-3,
      `实测 x=${fmtF(sPlain[0], 5)} m, 解析 ${fmtF(predicted, 5)} m`);
    check('LQI 把静差消除到 < 2 mm', Math.abs(sLqi[0]) < 2e-3, `x=${fmt(sLqi[0])} m`);
  }
}

console.log('');
console.log('=== 7. 线性闭环分析 (analysis.js) ===');
{
  const lin = CP.linearize(p);
  // (a) 矩阵指数与 ZOH 离散化：与逐步 RK4 积分线性系统的结果对比
  {
    const Ts = 0.02;
    const { Ad, Bd } = LA.c2dZoh(lin.A, lin.B, Ts);
    // 用极小步长 RK4 积分 ẋ = Ax + Bu（u 恒定）作为参考
    const ref = (x0, u) => {
      let x = x0.slice();
      const h = 1e-6, N = Math.round(Ts / h);
      const f = (v) => { const r = LA.matVec(lin.A, v); for (let i = 0; i < 4; i++) r[i] += lin.B[i][0] * u; return r; };
      for (let k = 0; k < N; k++) {
        const k1 = f(x);
        const k2 = f(x.map((v, i) => v + h / 2 * k1[i]));
        const k3 = f(x.map((v, i) => v + h / 2 * k2[i]));
        const k4 = f(x.map((v, i) => v + h * k3[i]));
        x = x.map((v, i) => v + h / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
      }
      return x;
    };
    const x0 = [0.1, -0.2, 0.05, 0.3], u0 = 2.5;
    const exact = ref(x0, u0);
    const disc = LA.matVec(Ad, x0).map((v, i) => v + Bd[i][0] * u0);
    let err = 0;
    for (let i = 0; i < 4; i++) err = Math.max(err, Math.abs(exact[i] - disc[i]));
    check('ZOH 离散化 (expm) 与精细积分一致 (< 1e-9)', err < 1e-9, `max err=${fmt(err)}`);
  }
  // (b) 四种控制器的闭环极点
  const cfg = { pid: CTRL.DEFAULT_PID, K: lqrOut.K };
  const clPid = AN.closedLoop('pid', lin, cfg);
  const clCas = AN.closedLoop('cascade', lin, cfg);
  const clLqr = AN.closedLoop('lqr', lin, cfg);
  const pol = (cl) => LA.eigenvalues(cl.A);
  check('单环 PID 闭环: 角度稳定但存在零极点（小车自由漂移）',
    pol(clPid).filter((z) => z.re > 1e-6).length === 0 && pol(clPid).some((z) => Math.abs(z.re) < 1e-6),
    '极点: ' + pol(clPid).map(fmtZ).join(', '));
  check('串级 PID 闭环: 全部极点严格在左半平面',
    pol(clCas).every((z) => z.re < -1e-9), '极点: ' + pol(clCas).map(fmtZ).join(', '));
  check('LQR 闭环极点与 §5 一致', Math.abs(Math.max(...pol(clLqr).map((z) => z.re)) - Math.max(...lqrOut.poles.map((z) => z.re))) < 1e-9,
    '极点: ' + pol(clLqr).map(fmtZ).join(', '));
  /* b≠0 时 u→θ 通道出现原点零点（DC 增益为 0），由此可证纯 PD 角度环恒不可稳：
   * 约简后闭环特征方程为
   *   D₀s³ + [(M+m)c + bJ + mlK_d]s² + [mlK_p − (M+m)mgl + bc]s + (mlK_i − b·mgl) = 0
   * 常数项 mlK_i − b·mgl 必须为正，故必须 K_i > b·g。这是 Python 参考实现交叉验证时发现的。 */
  {
    const kiMin = p.b * p.g;
    const maxReAt = (b, Ki) => {
      const lin2 = CP.linearize(Object.assign({}, p, { b: b }));
      const cl2 = AN.closedLoopAnglePID(lin2.A, lin2.B, Object.assign({}, CTRL.DEFAULT_PID.inner, { Ki: Ki }));
      return Math.max(...LA.eigenvalues(cl2.A).map((z) => z.re));
    };
    check('b>0 时纯 PD（Ki=0）角度环不可稳', maxReAt(p.b, 0) > 1e-3,
      `b=${p.b} 时 max Re = +${fmtF(maxReAt(p.b, 0), 5)}（Ki=0.5 时 +${fmtF(maxReAt(p.b, 0.5), 5)}，仍不稳）`);
    check('积分门限 Ki > b·g 与数值一致', maxReAt(p.b, kiMin * 1.1) < 1e-4 && maxReAt(p.b, kiMin * 0.5) > 1e-4,
      `b·g = ${fmtF(kiMin, 4)}；Ki=0.5×门限 ⇒ +${fmtF(maxReAt(p.b, kiMin * 0.5), 5)}，Ki=1.1×门限 ⇒ ${fmtF(maxReAt(p.b, kiMin * 1.1), 6)}`);
    check('无摩擦 (b=0) 时纯 PD 可稳住角度', maxReAt(0, 0) < 1e-6,
      `b=0, Ki=0 时 max Re = ${fmtF(maxReAt(0, 0), 6)}（仅剩原点极点）`);
  }
  // (c) 线性闭环 vs 非线性仿真（小信号一致性）：验证 analysis.js 的建模没写错
  {
    const z0 = [0, 0, 0.01, 0, 0, 0];      // 小角度 0.01 rad
    let z = z0.slice();
    const h = 0.0005;
    for (let k = 0; k < Math.round(3 / h); k++) {   // 线性闭环积分 3 s
      const dz = LA.matVec(clCas.A, z);
      const z2 = z.map((v, i) => v + h / 2 * dz[i]);
      const dz2 = LA.matVec(clCas.A, z2);
      z = z.map((v, i) => v + h * dz2[i]);
    }
    // 非线性：同样的串级 PID，连续控制（Ts 极小以逼近连续域），关闭微分滤波
    const gains = JSON.parse(JSON.stringify(CTRL.DEFAULT_PID));
    gains.inner.tauD = 0; gains.outer.tauD = 0;
    const ctrl = new CTRL.CascadePID(gains, p);
    let s = [0, 0, 0.01, 0], t = 0, u = 0, next = 0;
    const dt = 0.0005, Ts = 0.0005;
    for (let k = 0; k < Math.round(3 / dt); k++) {
      if (t >= next - 1e-12) { u = ctrl.compute(s, t, { xRef: 0 }); next += Ts; }
      s = CP.rk4Step(s, u, p, dt); t += dt;
    }
    const errTh = Math.abs(z[2] - s[2]), errX = Math.abs(z[0] - s[0]);
    check('线性闭环 ≈ 非线性仿真（0.01 rad 小信号，3 s 后）', errTh < 2e-4 && errX < 2e-4,
      `Δθ=${fmt(errTh)} rad, Δx=${fmt(errX)} m  (线性 x=${fmtF(z[0], 6)}, 非线性 x=${fmtF(s[0], 6)})`);
  }
  // (d) 增益裕度：LQR 理论保证 α ∈ [0.5, ∞) 内闭环稳定
  {
    const gmL = AN.gainMarginInterval(clLqr, lin.B);
    check('LQR 增益裕度区间包含 [0.5, ∞)（LQR 的理论保证）',
      gmL.lo <= 0.5 + 1e-6 && gmL.hi === Infinity,
      `α ∈ [${fmtF(gmL.lo, 3)}, ${gmL.hi === Infinity ? '∞' : fmtF(gmL.hi, 2)}]`);
    const gmC = AN.gainMarginInterval(clCas, lin.B);
    check('串级 PID 增益裕度为有限区间（对比：无 LQR 那样的普适保证）',
      gmC.stable && isFinite(gmC.hi), `α ∈ [${fmtF(gmC.lo, 3)}, ${isFinite(gmC.hi) ? fmtF(gmC.hi, 2) : '∞'}]`);
  }
  // (e) 临界采样周期：用非线性 ZOH 仿真验证解析预测
  {
    const cs = AN.criticalSampling(lin, clLqr);
    const simStable = (Ts) => {
      const c = new CTRL.LQRController(lqrOut.K, Object.assign({}, p, { uMax: 1e6 })); // 去掉饱和以纯粹检验线性稳定性
      let s = [0, 0, 0.01, 0], u = 0, t = 0, next = 0;
      const dt = Math.min(2e-4, Ts / 20);
      for (let k = 0; k < Math.round(6 / dt); k++) {
        if (t >= next - 1e-12) { u = c.compute(s, t, { xRef: 0 }); next += Ts; }
        s = CP.rk4Step(s, u, Object.assign({}, p, { uMax: 1e6 }), dt); t += dt;
        if (!isFinite(s[2]) || Math.abs(s[2]) > 1) return false;
      }
      return Math.abs(s[2]) < 0.01;
    };
    const below = simStable(cs.Ts * 0.8), above = simStable(cs.Ts * 1.25);
    check('临界采样周期预测正确（0.8×稳定、1.25×失稳）', below && !above,
      `Ts_crit = ${fmtF(cs.Ts * 1000, 1)} ms  (采样频率 ${fmtF(1 / cs.Ts, 0)} Hz, 不稳定极点 p=${fmtF(ana.pUnstable, 2)} rad/s ⇒ p·Ts_crit=${fmtF(ana.pUnstable * cs.Ts, 3)})`);
    // 判据：Ts_crit ≈ (1~2)/|λ|max（最快闭环极点），比 p·Ts_crit 稳定得多。
    // 跨 4000 倍控制代价 ρ 检验这个乘积是否始终落在 [0.8, 2.5]。
    {
      const prods = [], pTs = [];
      for (const r of [0.05, 1, 30]) {
        const QR3 = LQR.brysonWeights(Object.assign({}, LQR.DEFAULT_WEIGHTS, { uMax: p.uMax, r: r }), p);
        const o3 = LQR.lqr(lin.A, lin.B, QR3.Q, QR3.R);
        const cl3 = AN.closedLoop('lqr', lin, { pid: CTRL.DEFAULT_PID, K: o3.K });
        const cs3 = AN.criticalSampling(lin, cl3, CTRL.DEFAULT_PID.outer);
        const absMax = Math.max(...o3.poles.map((z) => Math.hypot(z.re, z.im)));
        prods.push(cs3.Ts * absMax); pTs.push(cs3.Ts * ana.pUnstable);
      }
      const inBand = prods.every((v) => v > 0.8 && v < 2.5);
      const spreadP = Math.max(...pTs) / Math.min(...pTs);
      check('判据 Ts_crit·|λ|max ∈ [0.8, 2.5]（比 p·Ts_crit 稳定）', inBand,
        `乘积 = ${prods.map((v) => fmtF(v, 3)).join(', ')}；同时 p·Ts_crit = ${pTs.map((v) => fmtF(v, 3)).join(', ')}（跨度 ${fmtF(spreadP, 1)}×，说明 p 不是好判据）`);
    }
  }
}

console.log('');
console.log(`===== 自检结果: ${pass} 通过, ${fail} 失败 =====`);
if (fail > 0) process.exitCode = 1;
