/* =========================================================================
 * physics.js — 核爆物理模型（标准大气 / 当量标定律 / 冲击波 / 热辐射 / 双闪光）
 *
 * 所有量取国际单位：m, s, K, Pa（超压另给 bar / psi）。
 * 模型出处见 README.md「物理模型」一节。核心是三条：
 *   1) Sedov–Taylor 点爆炸自相似解  R = ξ(E/ρ)^(1/5) t^(2/5)          —— 早期强激波
 *   2) 经验超压–缩放距离幂律 + Rankine–Hugoniot 关系 → 数值积分得 R(t) —— 全程激波
 *   3) 分层大气(ISA)中的浮力羽流 → 蘑菇云自然在对流层顶铺开             —— 见 sim.js
 * ========================================================================= */
(function (root) {
  'use strict';
  var NK = root.NUKE = root.NUKE || {};
  var U = NK.util;
  var P = NK.physics = {};

  /* ============================ 常数 ============================ */
  var KT_J = 4.184e12;          // 1 kt TNT (J)
  var P0 = 101325;              // 海平面气压 Pa
  var P0_BAR = 1.01325;
  var T0 = 288.15;              // 海平面温度 K
  var RHO0 = 1.225;             // 海平面密度 kg/m^3
  var G = 9.80665;
  var RGAS = 287.053;
  var GAMMA = 1.4;
  var SIGMA_SB = 5.670374e-8;   // Stefan–Boltzmann
  var CAL_CM2 = 4.184e4;        // 1 cal/cm^2 = 4.184e4 J/m^2
  var LAPSE = 0.0065;           // 对流层温度梯度 K/m
  var CP_AIR = 1005;            // 空气定压比热 J/(kg·K)
  P.K = {
    KT_J: KT_J, P0: P0, T0: T0, RHO0: RHO0, G: G, GAMMA: GAMMA,
    SIGMA_SB: SIGMA_SB, CAL_CM2: CAL_CM2, LAPSE: LAPSE, RGAS: RGAS, CP: CP_AIR
  };

  /* ============================ 标准大气 ISA ============================ */
  /** 温度 (K) */
  P.atmT = function (z) {
    if (z < 11000) { return T0 - LAPSE * z; }
    if (z < 20000) { return 216.65; }
    if (z < 32000) { return 216.65 + 0.001 * (z - 20000); }
    if (z < 47000) { return 228.65 + 0.0028 * (z - 32000); }
    return 270.65;
  };
  /** 气压 (Pa) */
  P.atmP = function (z) {
    if (z < 11000) { return P0 * Math.pow(P.atmT(z) / T0, G / (RGAS * LAPSE)); }
    var p11 = P0 * Math.pow(216.65 / T0, G / (RGAS * LAPSE));
    if (z < 20000) { return p11 * Math.exp(-G * (z - 11000) / (RGAS * 216.65)); }
    var p20 = p11 * Math.exp(-G * 9000 / (RGAS * 216.65));
    if (z < 32000) {
      return p20 * Math.pow(P.atmT(z) / 216.65, -G / (RGAS * 0.001));
    }
    var p32 = p20 * Math.pow(228.65 / 216.65, -G / (RGAS * 0.001));
    return p32 * Math.exp(-G * (z - 32000) / (RGAS * 240));
  };
  /** 密度 (kg/m^3) */
  P.atmRho = function (z) { return P.atmP(z) / (RGAS * P.atmT(z)); };
  /** 声速 (m/s) */
  P.atmC = function (z) { return Math.sqrt(GAMMA * RGAS * P.atmT(z)); };
  /** 位温 (K)：判断浮力稳定性用（Θ = T (p0/p)^(R/cp)） */
  P.atmTheta = function (z) { return P.atmT(z) * Math.pow(P0 / P.atmP(z), 0.2857); };
  /**
   * 含混合层的位温剖面：日间边界层被充分混合 → 中性（θ 常数），
   * ISA 的均匀 3.3 K/km 稳定层结在近地面并不成立。zBL 默认 1200 m。
   */
  P.atmThetaMixed = function (z, zBL) {
    zBL = zBL == null ? 1200 : zBL;
    return z < zBL ? P.atmTheta(zBL) : P.atmTheta(z);
  };
  /** Brunt–Väisälä 频率平方 N² = (g/θ)dθ/dz（层结强度，平流层内陡增一个量级） */
  P.bruntN2 = function (z, zBL) {
    var d = 25;
    var t1 = P.atmThetaMixed(z + d, zBL), t0 = P.atmThetaMixed(Math.max(z - d, 0), zBL);
    var th = P.atmThetaMixed(z, zBL);
    return Math.max(G / th * (t1 - t0) / (2 * d), 0);
  };
  /**
   * 卷入空气抬升到抬升凝结高度以上后的潜热增温（等效位温增量 K）：
   *   δθ_L = (L_v/c_p)·q_v(z)·RH ，  q_v 随高度约 2.2 km e 折减。
   * 这是真实蘑菇云能顶到对流层顶的关键项（也是云体呈白色的原因）。
   */
  P.latentDeltaTheta = function (z, humidity, lcl) {
    lcl = lcl == null ? 800 : lcl;
    if (z < lcl) { return 0; }
    var Lv = 2.5e6, qs0 = 0.0127;  // 288K 海平面饱和混合比 ≈ 12.7 g/kg
    return (Lv / CP_AIR) * qs0 * U.clamp(humidity, 0, 1) * Math.exp(-z / 2200);
  };
  /**
   * 凝结水存活效率 η：小云团被干空气卷入后凝结水会再次蒸发（吸热），
   * 潜热增益要打折 —— 这是积云物理里限制小对流单体发展的标准机制。
   *   η = Rc/(Rc + R_evap)
   * 于是 1 kt 级小云团 η≈0.5、兆吨级 η≈0.9，自然压出正确的当量标度。
   */
  P.latentEfficiency = function (Rc, Revap) {
    return Rc / (Rc + (Revap == null ? 900 : Revap));
  };
  /**
   * 浮力上限自检：热气泡的浮力不可能超过同体积真空泡 g·V。
   * F ≤ g·V·(1 − T_env/T) —— 用于校验 F₀ 的物理合法性。
   */
  P.buoyancyCap = function (V, Tenv, Tbubble) {
    return G * V * Math.max(1 - Tenv / Math.max(Tbubble, Tenv), 0);
  };
  /**
   * 初始浮力通量 F₀ = g·f_heat·E/(ρ c_p θ)   [m⁴/s²]
   * 由「残余热能」而非任意初始体积决定 —— 与初始半径无关，物理上更稳。
   * f_heat：爆炸能量中最终以火球内能形式留下的分额（辐射掉 ~35%、
   * 激波耗散一部分），取 0.30。CAL 为标定系数，见 README「标定」。
   */
  P.buoyancyFlux0 = function (Wkt, z0, fheat, cal) {
    fheat = fheat == null ? 0.50 : fheat;
    cal = cal == null ? 1.0 : cal;
    var E = Wkt * KT_J * fheat * cal;
    var Vfb = 4.18879 * Math.pow(P.fireballMaxR(Wkt), 3);
    var p = P.atmP(z0);
    // 定压下把体积 V 的空气加热到 T 所需能量 E = pV·γ/(γ−1)·(1−T₀/T)
    //   ⇒ 1−T₀/T = E(γ−1)/(γ p V)，浮力 F = g·V·(1−T₀/T)
    // 该式对小当量会给出 >1（意味着气泡温度极高、密度趋于 0），
    // 于是被 Archimedes 真空泡上限 F ≤ g·V 截断 —— 物理硬约束，非拟合。
    var frac = E * (GAMMA - 1) / (GAMMA * p * Vfb);
    return G * Vfb * Math.min(frac, 1);
  };
  /** F₀ 是否被真空泡上限截断（诊断用） */
  P.buoyancySaturated = function (Wkt, z0, fheat) {
    fheat = fheat == null ? 0.50 : fheat;
    var Vfb = 4.18879 * Math.pow(P.fireballMaxR(Wkt), 3);
    return (Wkt * KT_J * fheat) * (GAMMA - 1) / (GAMMA * P.atmP(z0) * Vfb) >= 1;
  };

  /* ============================ 当量标定律 ============================ */
  /** 火球最大半径 (m)：R ≈ 70 W^0.4（Glasstone 量级：20kt→232m，1Mt→1.1km） */
  P.fireballMaxR = function (Wkt) { return 70 * Math.pow(Wkt, 0.4); };
  /** 稳定云顶高度经验值 (m)：H ≈ 21.6 (W/Mt)^0.2 km（1Mt→21.6km，20kt→9.9km） */
  P.cloudTopEmpirical = function (Wkt) { return 21600 * Math.pow(Wkt / 1000, 0.2); };
  /**
   * 云盘半径经验值 (m)。半径/高度比并非常数：小当量云细高，
   * 兆吨级云在对流层顶铺成宽扁的砧状。这里取 R/H 从 0.20 增到 0.45。
   */
  P.cloudRadiusEmpirical = function (Wkt) {
    var f = 0.20 + 0.25 * U.smoothstep(0, 4, Math.log(Math.max(Wkt, 0.05)) / Math.LN10 + 1);
    return f * P.cloudTopEmpirical(Wkt);
  };
  /** 上升到稳定高度所需时间 (s) */
  P.stabilizeTime = function (Wkt) { return 60 * (1.5 + 3.5 * Math.pow(Wkt / 1000, 0.1)); };
  /** 表面爆炸视觉弹坑半径/深度 (m)，干土 */
  P.craterR = function (Wkt) { return 40 * Math.pow(Wkt, 0.3); };
  P.craterD = function (Wkt) { return 0.2 * P.craterR(Wkt); };
  /** 双闪光时标 (s)：极小值 / 第二极大值，∝ W^0.5 */
  P.tMin = function (Wkt) { return 0.0025 * Math.sqrt(Wkt); };
  P.t2Max = function (Wkt) { return 0.032 * Math.sqrt(Wkt); };

  /* ============================ 超压 ============================ */
  /**
   * 自由场峰值超压 (bar)，缩放距离 Z = R[km] / Weff[kt]^(1/3)。
   * 幂律 Δp = 0.345 (Z/0.64)^-1.9 锚定 5 psi @ Z=0.64；
   * 该拟合同时复现 20 psi @ Z≈0.31、1 psi @ Z≈1.49（与公开数据一致）。
   * Z < 0.08 改用强激波立方律 Δp ∝ R^-3 保持物理性（火球内部）。
   */
  P.overpressureBar = function (R, Weff) {
    var Z = (Math.max(R, 1e-3) / 1000) / Math.pow(Weff, 1 / 3);
    var dp;
    var Zb = 0.08;
    if (Z >= Zb) {
      dp = 0.345 * Math.pow(Z / 0.64, -1.9);
    } else {
      var dpb = 0.345 * Math.pow(Zb / 0.64, -1.9);
      dp = dpb * Math.pow(Z / Zb, -3);
    }
    return Math.min(dp, 1e6);
  };
  P.barToPsi = function (bar) { return bar * 14.5038; };
  P.psiToBar = function (psi) { return psi / 14.5038; };
  /** 由超压反解半径 (m)（幂律解析反演，含立方律分支） */
  P.radiusForOverpressure = function (dpBar, Weff) {
    var Zb = 0.08, dpb = 0.345 * Math.pow(Zb / 0.64, -1.9);
    var Z;
    if (dpBar <= dpb) {
      Z = 0.64 * Math.pow(dpBar / 0.345, -1 / 1.9);
    } else {
      Z = Zb * Math.pow(dpBar / dpb, -1 / 3);
    }
    return Z * 1000 * Math.pow(Weff, 1 / 3);
  };
  /** 激波马赫数（Rankine–Hugoniot） */
  P.machFromOverpressure = function (dpBar) {
    return Math.sqrt(1 + (GAMMA + 1) / (2 * GAMMA) * (dpBar / P0_BAR));
  };
  /** 峰值动压 q = 2.5Δp²/(7p0+Δp)（bar） */
  P.dynamicPressureBar = function (dpBar) {
    return 2.5 * dpBar * dpBar / (7 * P0_BAR + dpBar);
  };
  /** 激波后质点速度 (m/s)：u = (2/(γ+1)) (M²-1)/M · c0 */
  P.particleVelocity = function (dpBar, c0) {
    var M = P.machFromOverpressure(dpBar);
    return (2 / (GAMMA + 1)) * (M * M - 1) / M * c0;
  };
  /** 正压相持续时间 (s)，经验：t+ ≈ 0.18 W^(1/3) (Z/1)^0.3 量级 */
  P.positivePhase = function (R, Weff) {
    var Z = (Math.max(R, 1) / 1000) / Math.pow(Weff, 1 / 3);
    return 0.18 * Math.pow(Weff, 1 / 3) * Math.pow(U.clamp(Z, 0.05, 20), 0.3);
  };

  /* ============================ 冲击波 R(t) 数值表 ============================ */
  /**
   * 由 Δp(R) → M(R) → dR/dt = c·M 积分得到到达时间 t(R)，再反查 R(t)。
   * 起点用 Sedov 解给出的 t(R0)，避免 R→0 的奇点。
   */
  P.Blast = function (Wkt, opts) {
    opts = opts || {};
    var gf = opts.groundFactor == null ? 1.0 : opts.groundFactor; // 地面反射对当量的放大
    var hob = opts.hob || 0;
    this.Wkt = Wkt;
    this.Weff = Wkt * gf;
    this.E = this.Weff * KT_J;
    this.hob = hob;
    this.rhoB = P.atmRho(hob);
    this.cB = P.atmC(hob);
    this.Rfb = P.fireballMaxR(this.Weff);
    // Sedov 常数 C = (E/ρ)^(1/5)，ξ = 1.033 (γ=1.4)
    this.sedovC = Math.pow(this.E / this.rhoB, 0.2);
    this.xi = 1.033;

    var R0 = 0.10 * this.Rfb;
    var Rmax = Math.max(3e5, 40 * this.Rfb);
    var ratio = 1.012;
    var n = Math.ceil(Math.log(Rmax / R0) / Math.log(ratio)) + 1;
    var Rs = new Float64Array(n), ts = new Float64Array(n);
    // Sedov 反解 t(R0)
    var t = Math.pow(R0 / (this.xi * this.sedovC), 2.5);
    Rs[0] = R0; ts[0] = t;
    var R = R0;
    for (var i = 1; i < n; i++) {
      var Rn = R * ratio;
      var zm = Math.max(0, hob * 0.5); // 传播路径上的代表高度（简化）
      var c = P.atmC(zm);
      var v1 = c * P.machFromOverpressure(P.overpressureBar(R, this.Weff));
      var v2 = c * P.machFromOverpressure(P.overpressureBar(Rn, this.Weff));
      // 梯形积分 dt = dR / v
      t += (Rn - R) * 0.5 * (1 / v1 + 1 / v2);
      R = Rn; Rs[i] = R; ts[i] = t;
    }
    this._Rs = Rs; this._ts = ts; this._n = n;
    this.tEnd = ts[n - 1];
  };

  /** 激波半径 (m) at 时间 t (s) */
  P.Blast.prototype.radius = function (t) {
    if (!(t > 0)) { return 0; }
    var ts = this._ts, Rs = this._Rs, n = this._n;
    if (t <= ts[0]) {
      // Sedov 自相似段
      return this.xi * this.sedovC * Math.pow(t, 0.4);
    }
    if (t >= ts[n - 1]) {
      return Rs[n - 1] + (t - ts[n - 1]) * this.cB;
    }
    var lo = 0, hi = n - 1;
    while (hi - lo > 1) {
      var mid = (lo + hi) >> 1;
      if (ts[mid] <= t) { lo = mid; } else { hi = mid; }
    }
    var f = (t - ts[lo]) / (ts[hi] - ts[lo]);
    return Rs[lo] + f * (Rs[hi] - Rs[lo]);
  };
  /** 到达时间 (s) at 半径 R */
  P.Blast.prototype.arrival = function (R) {
    var ts = this._ts, Rs = this._Rs, n = this._n;
    if (R <= Rs[0]) { return Math.pow(Math.max(R, 1e-3) / (this.xi * this.sedovC), 2.5); }
    if (R >= Rs[n - 1]) { return ts[n - 1] + (R - Rs[n - 1]) / this.cB; }
    var lo = 0, hi = n - 1;
    while (hi - lo > 1) {
      var mid = (lo + hi) >> 1;
      if (Rs[mid] <= R) { lo = mid; } else { hi = mid; }
    }
    var f = (R - Rs[lo]) / (Rs[hi] - Rs[lo]);
    return ts[lo] + f * (ts[hi] - ts[lo]);
  };
  P.Blast.prototype.dpBar = function (R) { return P.overpressureBar(R, this.Weff); };
  P.Blast.prototype.mach = function (R) { return P.machFromOverpressure(this.dpBar(R)); };
  P.Blast.prototype.speed = function (R) { return this.cB * this.mach(R); };
  P.Blast.prototype.qBar = function (R) { return P.dynamicPressureBar(this.dpBar(R)); };
  /** 半径对应的超压环（psi → m） */
  P.Blast.prototype.radiusForPsi = function (psi) {
    return P.radiusForOverpressure(P.psiToBar(psi), this.Weff);
  };

  /**
   * 火球半径 (m)：早期紧贴激波，随后在 Rfb 处饱和（激波脱离）。
   * R_fb = Rmax (1 - exp(-R_shock/Rmax))：R_shock≪Rmax 时 ≈ R_shock，之后渐近饱和。
   */
  P.Blast.prototype.fireballR = function (t) {
    var Rs = this.radius(t);
    var Rm = this.Rfb;
    return Rm * (1 - Math.exp(-Rs / Rm));
  };

  /* ============================ 火球表面温度 & 双闪光 ============================ */
  /**
   * 经验双闪光曲线：极小值 t_min（激波front不透明度最低点）→ 第二极大 t_2max。
   * 用 log-log 分段插值，锚点取自 Glasstone《核武器效应》定性曲线的量级。
   */
  P.Blast.prototype.fireballT = function (t) {
    var tm = P.tMin(this.Wkt), t2 = P.t2Max(this.Wkt);
    // 锚点标定依据：第一极大的峰值功率应为第二极大的 ~20 倍（P∝R²T⁴，
    // 而其持续时间极短，仅携带约 1% 热辐射能量 —— Glasstone 的定性结论）。
    var A = [
      [tm * 0.004, 7.0e4],
      [tm * 0.06, 4.2e4],
      [tm * 0.30, 1.1e4],
      [tm * 1.00, 2600],
      [t2 * 1.00, 7700],
      [t2 * 8.00, 3400],
      [t2 * 60.0, 1700],
      [t2 * 600.0, 900]
    ];
    if (t <= A[0][0]) { return A[0][1]; }
    for (var i = 1; i < A.length; i++) {
      if (t <= A[i][0]) {
        return U.logLerp(t, A[i - 1][0], A[i][0], A[i - 1][1], A[i][1]);
      }
    }
    return A[A.length - 1][1] * Math.pow(A[A.length - 1][0] / t, 0.6);
  };
  /** 辐射功率 P = 4πR²σT⁴ (W) */
  P.Blast.prototype.power = function (t) {
    var R = Math.max(this.fireballR(t), 1);
    var T = this.fireballT(t);
    return 4 * Math.PI * R * R * SIGMA_SB * Math.pow(T, 4);
  };
  /** 归一化亮度（以第二极大为 1），驱动曝光与闪光照明 */
  P.Blast.prototype.relPower = function (t) {
    if (!(t > 0)) { return 0; }
    if (this._pRef == null) { this._pRef = this.power(P.t2Max(this.Wkt)); }
    return this.power(t) / this._pRef;
  };

  /* ============================ 热辐射 ============================ */
  /**
   * 热辐射剂量 (cal/cm²)：Q = f·E/(4πR²)·exp(-R/λ)
   * f=0.35（空爆热分额），λ=20km（能见度衰减）。
   * 校验：1 Mt 在 12.5 km 处 ≈ 9.5 cal/cm²，正好在三度烧伤阈值 8–10 附近。
   */
  P.thermalFluence = function (R, Wkt, opts) {
    opts = opts || {};
    var f = opts.thermalFraction == null ? 0.35 : opts.thermalFraction;
    var lam = opts.visibility == null ? 20000 : opts.visibility;
    var E = Wkt * KT_J * f;
    R = Math.max(R, 1);
    return (E / (4 * Math.PI * R * R)) * Math.exp(-R / lam) / CAL_CM2;
  };
  /** 反解剂量对应半径 (m)，二分法（含大气衰减，无解析解） */
  P.radiusForFluence = function (Q, Wkt, opts) {
    var lo = 1, hi = 1e6, i, mid;
    if (P.thermalFluence(lo, Wkt, opts) < Q) { return 0; }
    for (i = 0; i < 80; i++) {
      mid = 0.5 * (lo + hi);
      if (P.thermalFluence(mid, Wkt, opts) > Q) { lo = mid; } else { hi = mid; }
    }
    return 0.5 * (lo + hi);
  };
  P.BURN = { first: 2.5, second: 5.0, third: 8.0, ignition: 20.0 }; // cal/cm²

  /* ============================ 威尔逊凝结云 ============================ */
  /**
   * 激波负压相导致空气膨胀降温 → 过饱和 → 短暂白色球壳（Wilson cloud）。
   * 出现窗口：负压相扫过之后 ~ 0.3–3 个正压相时长，湿度越高越明显。
   */
  P.Blast.prototype.wilson = function (t, humidity) {
    var R = this.radius(t);
    if (R <= 0) { return { r: 0, a: 0 }; }
    var dp = this.dpBar(R);
    // 只在超压落到中等强度后才可见（此前被火球亮度淹没）
    var vis = U.smoothstep(6.0, 1.2, dp) * U.smoothstep(0.02, 0.12, dp);
    var hum = U.clamp((humidity - 0.35) / 0.65, 0, 1);
    return { r: R * 0.92, a: vis * hum };
  };

  /* ============================ 预设场景 ============================ */
  P.scenarios = [
    { name: 'Trinity 1945 · 21 kt 塔爆', W: 21, hob: 30, surface: 1, hum: 0.5, era: 0, city: 0.5 },
    { name: '广岛 Little Boy · 15 kt 空爆 580 m', W: 15, hob: 580, surface: 0, hum: 0.55, era: 0, city: 1 },
    { name: '长崎 Fat Man · 21 kt 空爆 503 m', W: 21, hob: 503, surface: 0, hum: 0.6, era: 0, city: 1 },
    { name: '现代城市 · 100 kt 空爆 900 m', W: 100, hob: 900, surface: 0, hum: 0.6, era: 2, city: 1.1 },
    { name: 'Castle Bravo · 15 Mt 地爆', W: 15000, hob: 2, surface: 1, hum: 0.8, era: 1, city: 0.35 },
    { name: 'Tsar Bomba · 50 Mt 空爆 4 km', W: 50000, hob: 4000, surface: 0, hum: 0.5, era: 1, city: 0.3 },
    { name: '战术当量 · 1 kt 低空', W: 1, hob: 120, surface: 0, hum: 0.5, era: 2, city: 1.4 }
  ];

  /* ============================ 汇总读数 ============================ */
  P.report = function (blast, t, opts) {
    var W = blast.Wkt;
    var R = blast.radius(t);
    return {
      t: t,
      fireballR: blast.fireballR(t),
      fireballT: blast.fireballT(t),
      shockR: R,
      mach: blast.mach(R),
      dpBar: blast.dpBar(R),
      dpPsi: P.barToPsi(blast.dpBar(R)),
      qBar: blast.qBar(R),
      r20psi: blast.radiusForPsi(20),
      r5psi: blast.radiusForPsi(5),
      r1psi: blast.radiusForPsi(1),
      rBurn3: P.radiusForFluence(P.BURN.third, W, opts),
      rBurn2: P.radiusForFluence(P.BURN.second, W, opts),
      cloudTopEmp: P.cloudTopEmpirical(W),
      relPower: blast.relPower(t)
    };
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
