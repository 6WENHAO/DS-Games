/* =====================================================================
 * lqr.js —— 连续时间 LQR：在浏览器里现场求解代数 Riccati 方程 (ARE)
 * ---------------------------------------------------------------------
 * 目标：min J = ∫₀^∞ (sᵀ Q s + uᵀ R u) dt ，约束 ṡ = A s + B u
 * 最优解：u = -K s ，K = R⁻¹ Bᵀ P ，其中 P 是 ARE 的唯一稳定解：
 *        Aᵀ P + P A - P B R⁻¹ Bᵀ P + Q = 0
 *
 * ── 为什么不用"反向积分 Riccati 微分方程"作为主算法？ ──
 * 当 R 很小（控制很"便宜"）时，P B R⁻¹ Bᵀ P 项非常大，Riccati 微分方程
 * 变成刚性方程，固定步长显式积分会直接发散。本文件因此采用两段式：
 *
 *   第 1 步  Bass 算法：构造一个"保证稳定"的初始增益 K₀（无需调参）
 *            取 β > max Re λ(A)，解 Lyapunov 方程  M S + S Mᵀ = 2 B Bᵀ,  M = A + βI
 *            则 K₀ = Bᵀ S⁻¹ 必使 A - B K₀ 稳定。
 *            证明：令 P=S⁻¹，由上式左右乘 P 得 PA + AᵀP + 2βP = 2PBBᵀP，
 *                  故 (A-BBᵀP)ᵀP + P(A-BBᵀP) = -2βP < 0 ，Lyapunov 定理即得。
 *
 *   第 2 步  Kleinman–Newton 迭代（对 ARE 做牛顿法，二次收敛）
 *            解 (A-BKᵢ)ᵀ P + P (A-BKᵢ) = -(Q + Kᵢᵀ R Kᵢ)，再取 Kᵢ₊₁ = R⁻¹ Bᵀ P
 *            通常 5~8 步残差就到 1e-14。
 *
 * 另外保留自适应步长的值迭代 riccatiValueIteration()，作为独立的
 * "第二种解法"用于交叉验证（自检脚本里会比较两者的一致性）。
 * ===================================================================== */
(function (global) {
  'use strict';
  const LA = global.LinAlg;

  function BBt(B) { return LA.mul(B, LA.transpose(B)); }

  /* ---------- Bass 算法：保证稳定的初始增益 ---------- */
  function bassGain(A, B) {
    const n = A.length;
    // β 必须大于 A 的谱横坐标；用 Frobenius 范数做安全上界
    const beta = LA.normF(A) + 1;
    const M = LA.add(A, LA.eye(n, beta));
    // 解 M S + S Mᵀ = 2 B Bᵀ  ⇔  lyapunovSolveT(Mᵀ, -2BBᵀ)
    const S = LA.lyapunovSolveT(LA.transpose(M), LA.scale(BBt(B), -2));
    return LA.mul(LA.transpose(B), LA.inv(S));   // K₀ = Bᵀ S⁻¹
  }

  /* ---------- 自适应步长的 Riccati 值迭代（教学用第二解法） ----------
   * 两个关键工程细节（缺一个就会发散，值得在课上强调）：
   *   1) 初值取 P(0)=0（对应"终端代价为零的有限时域问题"）。若取 P(0)=Q，
   *      当 R 很小时二次项 P B R⁻¹ Bᵀ P 一开始就是 1e8 量级，极其刚性。
   *   2) 步长同时受两个条件约束：单步相对变化 ≤ 2%，且 dt·‖A-BR⁻¹BᵀP‖ ≤ 0.4
   *      （显式 RK4 的稳定域要求；Lyapunov 算子的特征值是 λᵢ+λⱼ，故留两倍余量）。
   */
  function riccatiValueIteration(A, B, Q, R, opts) {
    opts = opts || {};
    const maxSteps = opts.maxSteps || 400000;
    const Rinv = LA.inv(R);
    const At = LA.transpose(A), Bt = LA.transpose(B);
    const BRB = LA.mul(LA.mul(B, Rinv), Bt);   // B R⁻¹ Bᵀ
    const RiBt = LA.mul(Rinv, Bt);             // R⁻¹ Bᵀ
    // f(P) = AᵀP + PA - P (B R⁻¹ Bᵀ) P + Q
    const f = (P) => LA.add(LA.sub(LA.add(LA.mul(At, P), LA.mul(P, A)), LA.mul(LA.mul(P, BRB), P)), Q);

    let P = LA.zeros(A.length, A.length);
    let steps = 0;
    for (let k = 0; k < maxSteps; k++) {
      const k1 = f(P);
      const nf = LA.normF(k1), nP = Math.max(1.0, LA.normF(P));
      if (nf < 1e-13 * nP) { steps = k; break; }
      const Acl = LA.sub(A, LA.mul(B, LA.mul(RiBt, P)));     // 当前策略下的闭环矩阵
      const dtStab = 0.4 / Math.max(1e-9, LA.normF(Acl));
      const dt = Math.min(opts.dtMax || 0.05, 0.02 * nP / nf, dtStab);
      const k2 = f(LA.add(P, LA.scale(k1, dt / 2)));
      const k3 = f(LA.add(P, LA.scale(k2, dt / 2)));
      const k4 = f(LA.add(P, LA.scale(k3, dt)));
      const inc = LA.scale(LA.add(LA.add(k1, LA.scale(k2, 2)), LA.add(LA.scale(k3, 2), k4)), dt / 6);
      const Pn = LA.symmetrize(LA.add(P, inc));
      if (!LA.isFiniteMat(Pn)) throw new Error('Riccati 值迭代发散：请检查 Q/R 是否合理');
      P = Pn; steps = k + 1;
      if (LA.normF(inc) < 1e-14 * nP) break;
    }
    P.__steps = steps;
    return P;
  }

  function areResidual(A, B, Q, R, P) {
    const Rinv = LA.inv(R);
    const term = LA.mul(LA.mul(LA.mul(LA.mul(P, B), Rinv), LA.transpose(B)), P);
    const res = LA.add(LA.sub(LA.add(LA.mul(LA.transpose(A), P), LA.mul(P, A)), term), Q);
    return { residual: res, norm: LA.normF(res) };
  }

  function gainFromP(B, R, P) {
    return LA.mul(LA.mul(LA.inv(R), LA.transpose(B)), P);   // K = R⁻¹ Bᵀ P
  }

  function isStable(A, B, K) {
    const poles = LA.eigenvalues(LA.sub(A, LA.mul(B, K)));
    return poles.every((z) => z.re < -1e-12);
  }

  function newtonKleinman(A, B, Q, R, K0, opts) {
    opts = opts || {};
    const iters = opts.iters || 60;
    const Rinv = LA.inv(R);
    let K = LA.clone(K0);
    let best = Infinity, bestP = null, bestK = null, used = 0;
    for (let i = 0; i < iters; i++) {
      const Ac = LA.sub(A, LA.mul(B, K));                         // A - B K
      const W = LA.add(Q, LA.mul(LA.mul(LA.transpose(K), R), K));  // Q + Kᵀ R K
      let P;
      try { P = LA.lyapunovSolveT(Ac, W); } catch (e) { break; }
      if (!LA.isFiniteMat(P)) break;
      K = LA.mul(LA.mul(Rinv, LA.transpose(B)), P);
      const r = areResidual(A, B, Q, R, P).norm;
      used = i + 1;
      if (r < best) { best = r; bestP = P; bestK = LA.clone(K); }
      if (r < 1e-12 * Math.max(1, LA.normF(P))) break;
    }
    return { P: bestP, K: bestK, residual: best, iters: used };
  }

  /* ---------- 主入口 ---------- */
  function lqr(A, B, Q, R, opts) {
    opts = opts || {};
    let K0, init = 'bass';
    try {
      K0 = bassGain(A, B);
      if (!LA.isFiniteMat(K0) || !isStable(A, B, K0)) throw new Error('bass 失败');
    } catch (e) {
      // 退路：用值迭代得到初始增益（例如 A 数值上极端病态时）
      init = 'value-iteration';
      K0 = gainFromP(B, R, riccatiValueIteration(A, B, Q, R));
    }
    let out = newtonKleinman(A, B, Q, R, K0, opts);
    if (!out.P || !(out.residual < 1e-6 * Math.max(1, LA.normF(out.P)))) {
      // 二次退路：值迭代 → 再牛顿
      const Pv = riccatiValueIteration(A, B, Q, R);
      const alt = newtonKleinman(A, B, Q, R, gainFromP(B, R, Pv), opts);
      if (alt.P && (!out.P || alt.residual < out.residual)) { out = alt; init = 'value-iteration+newton'; }
      if (!out.P) out = { P: Pv, K: gainFromP(B, R, Pv), residual: areResidual(A, B, Q, R, Pv).norm, iters: 0 };
    }

    const Acl = LA.sub(A, LA.mul(B, out.K));
    const poles = LA.eigenvalues(Acl);
    const eigP = LA.jacobiEigSym(out.P).values;
    return {
      K: out.K, P: out.P, Acl: Acl, poles: poles,
      stable: poles.every((z) => z.re < -1e-9),
      residual: out.residual, iters: out.iters, init: init,
      Pdefinite: eigP.every((v) => v > -1e-10), eigP: eigP,
      // 最优代价 J* = s₀ᵀ P s₀：从当前状态出发能达到的理论最小代价
      cost: (s0) => {
        let sum = 0;
        for (let i = 0; i < A.length; i++) for (let j = 0; j < A.length; j++) sum += s0[i] * out.P[i][j] * s0[j];
        return sum;
      }
    };
  }

  /* ---------- Bryson 定则：把"物理允许偏差"翻译成 Q、R ----------
   *   Q = diag( qᵢ / xᵢ,max² ),  R = ρ / u_max²
   * 好处：qᵢ、ρ 都是无量纲的"相对重视程度"，量纲问题交给 max 值处理。
   */
  function brysonWeights(w, p) {
    const xMax = w.xMax || 0.5, vMax = w.vMax || 1.0;
    const thMax = w.thMax || (10 * Math.PI / 180), wMax = w.wMax || 1.0;
    const uMax = w.uMax || (p && p.uMax) || 10;
    const Q = LA.diag([
      w.qx / (xMax * xMax),
      w.qv / (vMax * vMax),
      w.qth / (thMax * thMax),
      w.qw / (wMax * wMax)
    ]);
    const R = [Float64Array.from([w.r / (uMax * uMax)])];
    return { Q: Q, R: R };
  }

  const DEFAULT_WEIGHTS = {
    qx: 1, qv: 0.1, qth: 10, qw: 0.5, r: 1, qi: 0,
    xMax: 0.5, vMax: 1.0, thMax: 10 * Math.PI / 180, wMax: 1.0, zMax: 0.5
  };

  /* ---------- 带积分作用的 LQR（LQI / 增广 LQR） ----------
   * 为什么需要它：本系统对小车的常值干扰 d（例如恒定风）**必然**留下静差。
   *   平衡态要求 θ=0 且 u_总 = 0 ⇒ u_控制 = -d，
   *   而 u_控制 = -K_x (x - x_ref) ⇒ x - x_ref = d / K_x ≠ 0。
   *   默认参数下 K_x = -20 N/m、d = 1 N ⇒ 静差 -0.05 m（仿真实测完全吻合）。
   *
   * 正确做法不是"手工外挂一个积分项"（符号极易搞错：注意 K_x < 0，
   * 意味着积分项也必须是 +kᵢ∫e 而不是 -kᵢ∫e），而是把积分器并入状态：
   *   ż = x - x_ref,   增广状态 [z, x, ẋ, θ, θ̇]
   * 再对增广系统做标准 LQR，让 Riccati 方程自己给出正确符号的 kᵢ。
   * 当积分权重 q_I = 0 时解出的 kᵢ 恰好为 0，自动退化为普通 LQR。
   */
  function augment(A, B) {
    const n = A.length;
    const A5 = LA.zeros(n + 1, n + 1);
    A5[0][1] = 1;                                  // ż = x
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) A5[i + 1][j + 1] = A[i][j];
    const B5 = LA.zeros(n + 1, 1);
    for (let i = 0; i < n; i++) B5[i + 1][0] = B[i][0];
    return { A: A5, B: B5 };
  }

  function lqrIntegral(A, B, Q, R, qz) {
    const aug = augment(A, B);
    const n = Q.length;
    const Q5 = LA.zeros(n + 1, n + 1);
    Q5[0][0] = qz;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) Q5[i + 1][j + 1] = Q[i][j];
    const out = lqr(aug.A, aug.B, Q5, R);
    out.ki = out.K[0][0];                          // 积分增益
    out.Kx = [Float64Array.from(Array.from(out.K[0]).slice(1))];  // 状态反馈部分 (1x4)
    out.augmented = true;
    return out;
  }

  global.LQR = {
    lqr, bassGain, riccatiValueIteration, newtonKleinman, areResidual,
    gainFromP, isStable, brysonWeights, DEFAULT_WEIGHTS, augment, lqrIntegral
  };
})(typeof window !== 'undefined' ? window : globalThis);
