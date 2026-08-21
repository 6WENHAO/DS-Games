/* =====================================================================
 * analysis.js —— 线性闭环分析（让 PID 和 LQR 能放在同一张极点图上比较）
 * ---------------------------------------------------------------------
 * 教学动机：学生常有的困惑是"PID 我会调，但它到底把极点放到哪儿了？"
 * 只要把 PID 的积分器当成状态，PID 闭环也是一个线性系统，于是：
 *   · 单环 PID → 5 阶闭环（4 个物理状态 + 1 个积分器）
 *   · 串级 PID → 6 阶闭环（4 个物理状态 + 内环积分器 + 外环积分器）
 *   · LQR      → 4 阶闭环
 *   · LQI      → 5 阶闭环
 * 这样就能在同一张复平面图上比较四种控制器的极点位置，并用统一的方法算：
 *   · 增益裕度（把回路增益乘 α，找 α 的稳定区间）
 *   · 零阶保持采样下的临界采样周期 Ts_crit
 * 注意：分析时忽略微分项的一阶滤波（τ_D）与限幅/饱和，属于小信号线性近似。
 * ===================================================================== */
(function (global) {
  'use strict';
  const LA = global.LinAlg;

  /* 单环 PID 的线性闭环：状态 [x, ẋ, θ, θ̇, Iᵢ]，Iᵢ = ∫θ dt
   *   u = Kp θ + Ki Iᵢ + Kd θ̇      （符号见 controllers.js 文件头）
   */
  function closedLoopAnglePID(A, B, g) {
    const n = 5;
    const M = LA.zeros(n, n);
    // 反馈行向量：u = F · z
    const F = [0, 0, g.Kp, g.Kd, g.Ki];
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) M[i][j] = A[i][j];
      for (let j = 0; j < 5; j++) M[i][j] += B[i][0] * F[j];
    }
    M[4][2] = 1;   // İᵢ = θ
    return { A: M, F: F, labels: ['x', 'ẋ', 'θ', 'θ̇', 'Iᵢ'] };
  }

  /* 串级 PID 的线性闭环：状态 [x, ẋ, θ, θ̇, Iᵢ, Iₒ]
   *   θ_ref = -Kpₒ x - Kdₒ ẋ + Kiₒ Iₒ ,  Iₒ = ∫(x_ref - x)dt
   *   e     = θ - θ_ref = θ + Kpₒ x + Kdₒ ẋ - Kiₒ Iₒ
   *   u     = Kp e + Ki Iᵢ + Kd θ̇
   */
  function closedLoopCascadePID(A, B, gi, go) {
    const n = 6;
    const M = LA.zeros(n, n);
    const F = [gi.Kp * go.Kp, gi.Kp * go.Kd, gi.Kp, gi.Kd, gi.Ki, -gi.Kp * go.Ki];
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) M[i][j] = A[i][j];
      for (let j = 0; j < 6; j++) M[i][j] += B[i][0] * F[j];
    }
    // İᵢ = e = Kpₒ x + Kdₒ ẋ + θ - Kiₒ Iₒ
    M[4][0] = go.Kp; M[4][1] = go.Kd; M[4][2] = 1; M[4][5] = -go.Ki;
    // İₒ = -x
    M[5][0] = -1;
    return { A: M, F: F, labels: ['x', 'ẋ', 'θ', 'θ̇', 'Iᵢ', 'Iₒ'] };
  }

  /* LQR / LQI 的线性闭环 */
  function closedLoopLQR(A, B, K) {
    const row = Array.from(K[0]);
    if (row.length === 4) {
      const F = row.map((v) => -v);
      const M = LA.zeros(4, 4);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) M[i][j] = A[i][j] + B[i][0] * F[j];
      return { A: M, F: F, labels: ['x', 'ẋ', 'θ', 'θ̇'] };
    }
    // LQI：状态 [z, x, ẋ, θ, θ̇]，ż = x
    const aug = global.LQR.augment(A, B);
    const F = row.map((v) => -v);
    const M = LA.zeros(5, 5);
    for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) M[i][j] = aug.A[i][j] + aug.B[i][0] * F[j];
    return { A: M, F: F, labels: ['z=∫e', 'x', 'ẋ', 'θ', 'θ̇'], aug: aug };
  }

  // 按当前模式构造线性闭环（统一接口）
  function closedLoop(mode, lin, ctrlCfg) {
    const A = lin.A, B = lin.B;
    switch (mode) {
      case 'pid': return closedLoopAnglePID(A, B, ctrlCfg.pid.inner);
      case 'cascade': return closedLoopCascadePID(A, B, ctrlCfg.pid.inner, ctrlCfg.pid.outer);
      case 'lqr': case 'lqi': case 'swingup': return closedLoopLQR(A, B, ctrlCfg.K);
      default: return { A: LA.clone(A), F: [0, 0, 0, 0], labels: ['x', 'ẋ', 'θ', 'θ̇'] };
    }
  }

  /* 增益裕度：把执行器增益乘 α（模拟电机推力标定误差 / 负载变化），
   * 扫描 α 找出闭环保持稳定的区间。LQR 理论保证区间包含 [0.5, ∞)。 */
  function gainMarginInterval(cl, B) {
    const n = cl.A.length;
    const nb = B.length;               // 物理状态维数（B 只作用在物理状态上）
    // 把 A_cl 拆成 A0 + α·B·F 的形式：A0 = A_cl - B·F（B 需按闭环状态排布补零）
    const Bc = LA.zeros(n, 1);
    if (n === nb) {
      for (let i = 0; i < nb; i++) Bc[i][0] = B[i][0];
    } else if (cl.labels[0] === 'z=∫e') {
      for (let i = 0; i < nb; i++) Bc[i + 1][0] = B[i][0];   // LQI：第 0 个状态是积分器
    } else {
      for (let i = 0; i < nb; i++) Bc[i][0] = B[i][0];       // PID：积分器排在后面
    }
    const F = LA.zeros(1, n);
    for (let j = 0; j < n; j++) F[0][j] = cl.F[j] || 0;
    const BF = LA.mul(Bc, F);
    const A0 = LA.sub(cl.A, BF);
    // 容差取 1e-6 而不是 0：单环 PID 的小车位置模态本来就在原点（结构性的临界稳定），
    // 不该因为这个"注定存在"的零极点就把增益裕度判成"不存在"。
    const stableAt = (a) => LA.eigenvalues(LA.add(A0, LA.scale(BF, a))).every((z) => z.re < 1e-6);
    if (!stableAt(1)) return { lo: NaN, hi: NaN, stable: false };
    // 向下、向上二分搜索稳定边界
    const findEdge = (dir) => {
      let good = 1, bad = null;
      for (let k = 0; k < 60; k++) {
        const next = dir < 0 ? good * 0.85 : good / 0.85;
        if (dir < 0 && next < 1e-3) return 0;
        if (dir > 0 && next > 1e4) return Infinity;
        if (stableAt(next)) good = next; else { bad = next; break; }
      }
      if (bad === null) return dir < 0 ? 0 : Infinity;
      for (let k = 0; k < 40; k++) {
        const mid = 0.5 * (good + bad);
        if (stableAt(mid)) good = mid; else bad = mid;
      }
      return good;
    };
    return { lo: findEdge(-1), hi: findEdge(1), stable: true };
  }

  /* 零阶保持采样下的临界采样周期：
   * 物理部分用精确 ZOH 离散化（矩阵指数），控制器积分器用前向欧拉离散，
   * 然后检查离散闭环谱半径何时越过 1。这解释了"为什么倒立摆必须高频采样"：
   * 不稳定极点 p 越大，允许的采样周期越小（经验上 Ts·p ≲ 0.3~0.5）。
   */
  function stateOffset(cl, nb) {
    // 闭环状态里物理状态的起始下标（LQI 把积分器放在最前面，PID 放在后面）
    return (cl.labels[0] === 'z=∫e') ? 1 : 0;
  }

  function discreteClosedLoop(lin, cl, Ts, go) {
    const A = lin.A, B = lin.B;
    const nb = A.length, n = cl.A.length, off = stateOffset(cl, nb);
    const { Ad, Bd } = LA.c2dZoh(A, B, Ts);
    const M = LA.zeros(n, n);
    for (let i = 0; i < nb; i++) {
      for (let j = 0; j < nb; j++) M[i + off][j + off] = Ad[i][j];
      for (let j = 0; j < n; j++) M[i + off][j] += Bd[i][0] * (cl.F[j] || 0);
    }
    if (off === 1) {                       // LQI: z[k+1] = z[k] + Ts·x[k]
      M[0][0] = 1; M[0][1] = Ts;
    } else if (n === 5) {                  // 单环 PID: Iᵢ[k+1] = Iᵢ + Ts·θ
      M[4][4] = 1; M[4][2] = Ts;
    } else if (n === 6) {                  // 串级 PID
      go = go || { Kp: 0, Ki: 0, Kd: 0 };
      M[4][4] = 1; M[4][0] = Ts * go.Kp; M[4][1] = Ts * go.Kd; M[4][2] = Ts; M[4][5] = -Ts * go.Ki;
      M[5][5] = 1; M[5][0] = -Ts;
    }
    return M;
  }

  function criticalSampling(lin, cl, go) {
    // 先判断连续域闭环本身的性质：临界稳定（含原点极点）时"临界采样周期"没有意义
    const cpoles = LA.eigenvalues(cl.A);
    const maxRe = Math.max(...cpoles.map((z) => z.re));
    if (maxRe > 1e-3) return { Ts: NaN, note: '连续域闭环本身不稳定' };
    if (maxRe > -1e-4) return { Ts: NaN, note: '闭环临界稳定（含原点极点）：位置模态不收敛，Ts 不是限制因素' };

    const specRadius = (Ts) => {
      const M = discreteClosedLoop(lin, cl, Ts, go);
      if (!LA.isFiniteMat(M)) return Infinity;
      return LA.spectralRadius(M);
    };
    const TH = 1 + 2e-4;                 // Gelfand 估计的偏差余量
    if (specRadius(0.0005) >= TH) return { Ts: NaN, note: '即使 0.5 ms 采样也不稳定' };
    let lo = 0.0005, hi = null;
    for (let Ts = 0.001; Ts <= 0.5; Ts *= 1.06) {
      if (specRadius(Ts) >= TH) { hi = Ts; break; }
      lo = Ts;
    }
    if (hi === null) return { Ts: Infinity, note: 'Ts ≤ 500 ms 内均稳定', specRadius: specRadius };
    for (let k = 0; k < 30; k++) {
      const mid = 0.5 * (lo + hi);
      if (specRadius(mid) >= TH) hi = mid; else lo = mid;
    }
    return { Ts: lo, specRadius: specRadius };
  }

  global.Analysis = {
    closedLoop, closedLoopAnglePID, closedLoopCascadePID, closedLoopLQR,
    gainMarginInterval, criticalSampling, discreteClosedLoop
  };
})(typeof window !== 'undefined' ? window : globalThis);
