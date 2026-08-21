/* =====================================================================
 * model.js —— 小车-倒立摆（cart-pole）物理模型
 * ---------------------------------------------------------------------
 * 状态量  s = [x, x_dot, theta, theta_dot]
 *   x      : 小车位置 (m)，向右为正
 *   theta  : 摆杆与"竖直向上"方向的夹角 (rad)，theta = 0 即直立平衡点，逆时针为正
 *   u      : 作用在小车上的水平驱动力 (N)
 *
 * 摆杆按"均匀细杆"建模（比集中质量更接近真实实验台）：
 *   总长 L，质量 m，质心距转轴 l = L/2，绕质心转动惯量 I = m L^2 / 12
 *
 * 由拉格朗日方程（含粘性耗散）得到的运动方程：
 *   ┌ M+m            m l cosθ ┐┌ ẍ ┐   ┌ u - b ẋ + m l sinθ θ̇²  ┐
 *   └ m l cosθ     I + m l²   ┘└ θ̈ ┘ = └ m g l sinθ - c θ̇        ┘
 * 详细推导见 docs/理论推导.md 第 1 节。
 * ===================================================================== */
(function (global) {
  'use strict';
  const LA = global.LinAlg;

  const DEFAULT_PARAMS = {
    M: 0.5,      // 小车质量 (kg)
    m: 0.2,      // 摆杆质量 (kg)
    L: 0.6,      // 摆杆总长 (m)
    g: 9.81,     // 重力加速度 (m/s^2)
    b: 0.1,      // 小车粘性摩擦 (N·s/m)
    c: 0.005,    // 转轴粘性摩擦 (N·m·s/rad)
    uMax: 10.0,  // 执行器饱和 (N)
    railHalf: 1.2 // 导轨半长 (m)，超出即"撞限位"
  };

  function derived(p) {
    const l = p.L / 2;                       // 质心到转轴距离
    const I = p.m * p.L * p.L / 12;          // 均匀细杆绕质心转动惯量
    const J = I + p.m * l * l;               // 绕转轴的等效转动惯量 = m L^2 / 3
    const D0 = (p.M + p.m) * J - Math.pow(p.m * l, 2); // 线性化耦合矩阵行列式
    return { l: l, I: I, J: J, D0: D0 };
  }

  /* ---------------- 非线性动力学 ---------------- */
  // 返回 ds/dt。u 已经是限幅后的实际作用力。
  function dynamics(s, u, p) {
    const d = derived(p);
    const l = d.l, I = d.I;
    const th = s[2], thd = s[3], xd = s[1];
    const st = Math.sin(th), ct = Math.cos(th);

    // 2x2 耦合质量矩阵
    const a11 = p.M + p.m;
    const a12 = p.m * l * ct;
    const a21 = a12;
    const a22 = I + p.m * l * l;
    const r1 = u - p.b * xd + p.m * l * st * thd * thd;
    const r2 = p.m * p.g * l * st - p.c * thd;

    const det = a11 * a22 - a12 * a21;   // 恒 > 0（见理论文档：Cauchy-Schwarz）
    const xdd = (a22 * r1 - a12 * r2) / det;
    const tdd = (a11 * r2 - a21 * r1) / det;
    return [xd, xdd, thd, tdd];
  }

  // 固定步长 RK4：教学上强调"积分器精度会影响能量守恒的观测"
  function rk4Step(s, u, p, dt) {
    const k1 = dynamics(s, u, p);
    const s2 = [s[0] + dt / 2 * k1[0], s[1] + dt / 2 * k1[1], s[2] + dt / 2 * k1[2], s[3] + dt / 2 * k1[3]];
    const k2 = dynamics(s2, u, p);
    const s3 = [s[0] + dt / 2 * k2[0], s[1] + dt / 2 * k2[1], s[2] + dt / 2 * k2[2], s[3] + dt / 2 * k2[3]];
    const k3 = dynamics(s3, u, p);
    const s4 = [s[0] + dt * k3[0], s[1] + dt * k3[1], s[2] + dt * k3[2], s[3] + dt * k3[3]];
    const k4 = dynamics(s4, u, p);
    return [
      s[0] + dt / 6 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]),
      s[1] + dt / 6 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]),
      s[2] + dt / 6 * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]),
      s[3] + dt / 6 * (k1[3] + 2 * k2[3] + 2 * k3[3] + k4[3])
    ];
  }

  /* ---------------- 在直立平衡点线性化 ---------------- */
  function linearize(p) {
    const d = derived(p);
    const l = d.l, J = d.J, D0 = d.D0, m = p.m, M = p.M, g = p.g;
    const A = [
      [0, 1, 0, 0],
      [0, -J * p.b / D0, -(m * l) * (m * l) * g / D0, m * l * p.c / D0],
      [0, 0, 0, 1],
      [0, m * l * p.b / D0, (M + m) * m * g * l / D0, -(M + m) * p.c / D0]
    ].map((r) => Float64Array.from(r));
    const B = [[0], [J / D0], [0], [-m * l / D0]].map((r) => Float64Array.from(r));
    return { A: A, B: B, D0: D0, l: l, J: J };
  }

  // 数值雅可比：用于验证解析线性化（教学上"信任但要验证"）
  function numericJacobian(p, s0, u0, h) {
    s0 = s0 || [0, 0, 0, 0]; u0 = u0 || 0; h = h || 1e-6;
    const A = LA.zeros(4, 4), B = LA.zeros(4, 1);
    for (let j = 0; j < 4; j++) {
      const sp = s0.slice(), sm = s0.slice();
      sp[j] += h; sm[j] -= h;
      const fp = dynamics(sp, u0, p), fm = dynamics(sm, u0, p);
      for (let i = 0; i < 4; i++) A[i][j] = (fp[i] - fm[i]) / (2 * h);
    }
    const fp = dynamics(s0, u0 + h, p), fm = dynamics(s0, u0 - h, p);
    for (let i = 0; i < 4; i++) B[i][0] = (fp[i] - fm[i]) / (2 * h);
    return { A: A, B: B };
  }

  /* ---------------- 能量（供摆起控制与能量守恒自检） ---------------- */
  // 势能零点取"摆杆水平"位置，故直立时 E = m g l > 0，下垂时 E = -m g l。
  function energy(s, p) {
    const d = derived(p);
    const l = d.l, I = d.I;
    const th = s[2], thd = s[3], xd = s[1];
    const T = 0.5 * (p.M + p.m) * xd * xd + p.m * l * Math.cos(th) * xd * thd + 0.5 * (I + p.m * l * l) * thd * thd;
    const V = p.m * p.g * l * Math.cos(th);
    return { T: T, V: V, E: T + V, Eup: p.m * p.g * l };
  }

  // 只考虑摆杆自身（小车静止参考系）的能量，摆起控制用这个量
  function pendulumEnergy(s, p) {
    const d = derived(p);
    const J = d.J, l = d.l;
    return 0.5 * J * s[3] * s[3] + p.m * p.g * l * Math.cos(s[2]);
  }

  /* ---------------- 结构性质分析（教学分析面板） ---------------- */
  function analyze(p) {
    const lin = linearize(p);
    const A = lin.A, B = lin.B;
    // 能控性矩阵 [B AB A²B A³B]
    const cols = [];
    let v = B;
    for (let i = 0; i < 4; i++) { cols.push(v); v = LA.mul(A, v); }
    const C = LA.zeros(4, 4);
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) C[i][j] = cols[j][i][0];

    const d = derived(p);
    // 开环极点
    const poles = LA.eigenvalues(A);
    // 解析结果（无摩擦）：不稳定极点 p = sqrt(m g l (M+m) / D0)
    const pUnstable = Math.sqrt(p.m * p.g * d.l * (p.M + p.m) / d.D0);
    // 含摩擦的真实不稳定极点（数值特征值）：摩擦让它略慢，但仍在右半平面
    const pTrue = Math.max(...poles.map((z) => z.re));

    /* u→x 通道的零点。由线性化方程消去 Θ 可得
     *   X(s)/U(s) = (J s² + c s − m g l) / { s[((M+m)s + b)(J s² + c s − m g l) − m²l²s³] }
     * 分子只含 J、c、mgl —— 与小车摩擦 b 无关（Python 侧已数值验证 b=0 与 b=10 零点不变）。
     * 故零点为   s = ( −c ± √(c² + 4 J m g l) ) / (2J)
     * 无摩擦时退化为对称的 ±√(mgl/J) = ±√(3g/2L)（均匀细杆）。
     */
    const mgl = p.m * p.g * d.l;
    const disc = Math.sqrt(p.c * p.c + 4 * d.J * mgl);
    const zRHP = (-p.c + disc) / (2 * d.J);          // 右半平面零点（真正起限制作用的那个）
    const zLHP = (-p.c - disc) / (2 * d.J);          // 左半平面零点
    const zIdeal = Math.sqrt(mgl / d.J);             // 无摩擦解析值 √(3g/2L)
    return {
      A: A, B: B, ctrb: C, rank: LA.rank(C), cond: LA.cond2(C),
      poles: poles, pUnstable: pUnstable, pTrue: pTrue,
      zRHP: zRHP, zLHP: zLHP, zIdeal: zIdeal,
      doublingTime: Math.log(2) / pUnstable,
      doublingTimeTrue: Math.log(2) / Math.max(1e-9, pTrue),
      tau: 1 / pUnstable,
      // p/z 之比（无摩擦）只取决于质量比：p/z = 1/√(1 − 3m/(4(M+m)))
      pzRatio: 1 / Math.sqrt(1 - 3 * p.m / (4 * (p.M + p.m))),
      // 单环 PID 若要稳住角度，积分增益必须超过 Ki > b·g（见 docs/理论推导.md §5.1）
      kiMinAngleLoop: p.b * p.g,
      derived: d
    };
  }

  function clampForce(u, p) {
    if (!isFinite(u)) return 0;
    return Math.max(-p.uMax, Math.min(p.uMax, u));
  }

  // 角度归一化到 (-pi, pi]，用于摆起模式的显示与切换判据
  function wrapPi(a) {
    let r = a;
    while (r > Math.PI) r -= 2 * Math.PI;
    while (r <= -Math.PI) r += 2 * Math.PI;
    return r;
  }

  global.CartPole = {
    DEFAULT_PARAMS, derived, dynamics, rk4Step, linearize, numericJacobian,
    energy, pendulumEnergy, analyze, clampForce, wrapPi
  };
})(typeof window !== 'undefined' ? window : globalThis);
