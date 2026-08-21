/* =====================================================================
 * controllers.js —— 四类控制器
 * ---------------------------------------------------------------------
 * 符号约定（非常重要，是本项目的第一个教学要点）：
 *   θ > 0 表示摆杆向 +x（右）倾倒；线性化后 ∂θ̈/∂u = -m l / D0 < 0，
 *   也就是"向右推小车 → 摆杆向左转"。因此角度环的输出必须与 θ **同号**
 *   才能把摆杆推回来：u = Kp·(θ-θ_ref) + Ki∫ + Kd·θ̇。
 *   而位置环相反：想让小车往右走，必须先让摆杆往右倒一点（θ_ref > 0），
 *   这正是"欲进先退"的非最小相位特性（u→x 通道有右半平面零点）。
 *
 * 所有控制器都实现同一接口：
 *   compute(sMeas, t, ref) -> u   （内部完成限幅与抗积分饱和）
 *   reset()                        （清零积分器与内部状态）
 *   info()                         （返回可视化用的内部量，如内环给定 θ_ref）
 * ===================================================================== */
(function (global) {
  'use strict';
  const CP = global.CartPole;

  // 经过解析设计 + 全场景扫描确定的默认 PID 参数（设计过程见 docs/理论推导.md §5.4）
  //   内环：ωn = 12 rad/s, ζ = 0.9  →  Kp = (ωn²+p²)/g0, Kd = 2ζωn/g0   （p = 5.59, g0 = 4.5455）
  //   外环：ωo = 1.2 rad/s, ζ = 0.7 →  Kp = ωo²/g,      Kd = 2ζωo/g
  //   outMax 用于积分限幅：内环 = 力限幅，外环 = 倾角给定限幅
  const DEFAULT_PID = {
    inner: { Kp: 38.55, Ki: 4.0, Kd: 4.75, tauD: 0.02 },   // 角度环带宽 12 rad/s > 不稳定极点 5.59 rad/s
    outer: { Kp: 0.147, Ki: 0.05, Kd: 0.171, tauD: 0.05, thetaMax: 0.18 } // 位置环带宽 1.2 rad/s < z/2 ≈ 2.5 rad/s
  };

  /* -------- PID 内核：带一阶滤波微分 + 条件积分抗饱和 -------- */
  // 抗积分饱和采用"条件积分(clamping) + 积分限幅"，而不是"反计算(back-calculation)"：
  // 反计算会强行让输出贴住限幅值，当比例项本身就远超限幅时（例如位置误差
  // 达到数米），反计算会把积分器推到一个巨大的反向值，误差回落后积分项接管
  // 造成反向飞车——这是教学中很典型的"看似正确却致命"的实现陷阱。
  class PIDCore {
    constructor(g) {
      this.g = Object.assign({ Kp: 0, Ki: 0, Kd: 0, tauD: 0.02, outMax: Infinity }, g);
      this.reset();
    }
    reset() { this.I = 0; this.dFilt = 0; this.ePrev = null; this.satBlocked = false; this.satSign = 0; }
    // err: 误差; rate: 误差的导数（可由外部直接给出，如陀螺仪测得的角速度）
    step(err, dt, rate) {
      const g = this.g;
      let d;
      if (rate !== undefined && rate !== null) {
        d = rate;                                     // 直接用测得的速率（更抗噪）
      } else if (this.ePrev === null || dt <= 0) {
        d = 0;
      } else {
        d = (err - this.ePrev) / dt;                  // 差分求导
      }
      // 一阶低通滤波：τ ḋ_f = d - d_f （教学要点：微分放大噪声，必须滤波）
      if (dt > 0 && g.tauD > 0) {
        const a = dt / (g.tauD + dt);
        this.dFilt += a * (d - this.dFilt);
      } else {
        this.dFilt = d;
      }
      this.ePrev = err;
      // 条件积分：已饱和且误差还在把输出往同一方向推时，停止积分
      const pushesFurther = (this.satSign !== 0) && (Math.sign(err) === this.satSign);
      if (dt > 0 && Math.abs(g.Ki) > 1e-12 && !pushesFurther) {
        this.I += err * dt;
        // 积分限幅：让积分项单独最多贡献 outMax（防止长期误差把积分器撑爆）
        if (isFinite(g.outMax)) {
          const lim = g.outMax / Math.abs(g.Ki);
          this.I = Math.max(-lim, Math.min(lim, this.I));
        }
      }
      return g.Kp * err + g.Ki * this.I + g.Kd * this.dFilt;
    }
    // 由外部在限幅后回报饱和状态（供下一步的条件积分判断）
    reportSaturation(raw, clamped) {
      this.satSign = (Math.abs(raw - clamped) > 1e-12) ? Math.sign(raw - clamped) : 0;
    }
    setGains(g) { Object.assign(this.g, g); }
  }

  /* ================= 1. 单环 PID：只管角度 ================= */
  // 教学结论：能把摆稳住，但小车会持续漂移 —— 一个执行器无法同时定住两个自由度。
  class AnglePID {
    constructor(gains, p, opts) {
      this.p = p; this.opts = Object.assign({ dMode: 'rate' }, opts);
      this.pid = new PIDCore(Object.assign({ outMax: p.uMax }, gains)); this.name = '单环 PID（仅角度）';
      this.reset();
    }
    reset() { this.pid.reset(); this.tPrev = null; this.thetaRef = 0; this.uLast = 0; this.rawLast = 0; }
    setGains(g) { this.pid.setGains(g.inner || g); this.pid.g.outMax = this.p.uMax; }
    compute(s, t, ref) {
      const dt = (this.tPrev === null) ? 0 : Math.max(0, t - this.tPrev);
      this.tPrev = t;
      const thRef = (ref && ref.thetaRef) || 0;
      this.thetaRef = thRef;
      const e = CP.wrapPi(s[2] - thRef);            // 误差 = 实测 - 给定（符号约定见文件头）
      const raw = this.pid.step(e, dt, this.opts.dMode === 'rate' ? s[3] : undefined);
      const u = CP.clampForce(raw, this.p);
      this.pid.reportSaturation(raw, u);
      this.uLast = u; this.rawLast = raw;
      return u;
    }
    info() { return { mode: 'pid', thetaRef: this.thetaRef, saturated: Math.abs(this.rawLast - this.uLast) > 1e-9 }; }
  }

  /* ================= 2. 串级 PID：外环位置 → 内环角度 ================= */
  class CascadePID {
    constructor(gains, p, opts) {
      this.p = p; this.opts = Object.assign({ dMode: 'rate' }, opts);
      gains = gains || DEFAULT_PID;
      this.thetaMax = (gains.outer && gains.outer.thetaMax) || 0.18;
      this.inner = new PIDCore(Object.assign({ outMax: p.uMax }, gains.inner));
      this.outer = new PIDCore(Object.assign({ outMax: this.thetaMax }, gains.outer));
      this.name = '串级 PID（位置→角度）';
      this.reset();
    }
    reset() { this.inner.reset(); this.outer.reset(); this.tPrev = null; this.thetaRef = 0; this.uLast = 0; this.rawLast = 0; }
    setGains(g) {
      if (g.inner) { this.inner.setGains(g.inner); this.inner.g.outMax = this.p.uMax; }
      if (g.outer) {
        this.outer.setGains(g.outer);
        if (g.outer.thetaMax !== undefined) this.thetaMax = g.outer.thetaMax;
        this.outer.g.outMax = this.thetaMax;
      }
    }
    compute(s, t, ref) {
      const dt = (this.tPrev === null) ? 0 : Math.max(0, t - this.tPrev);
      this.tPrev = t;
      const xRef = (ref && ref.xRef) || 0;
      // --- 外环（慢）：位置误差 → 期望倾角。想往右走就先往右倒。
      const ex = xRef - s[0];
      const thRefRaw = this.outer.step(ex, dt, -s[1]);   // 误差导数 = -ẋ
      const thRef = Math.max(-this.thetaMax, Math.min(this.thetaMax, thRefRaw));
      this.outer.reportSaturation(thRefRaw, thRef);
      this.thetaRef = thRef;
      // --- 内环（快）：跟踪倾角给定
      const e = CP.wrapPi(s[2] - thRef);
      const raw = this.inner.step(e, dt, this.opts.dMode === 'rate' ? s[3] : undefined);
      const u = CP.clampForce(raw, this.p);
      this.inner.reportSaturation(raw, u);
      this.uLast = u; this.rawLast = raw;
      return u;
    }
    info() { return { mode: 'cascade', thetaRef: this.thetaRef, saturated: Math.abs(this.rawLast - this.uLast) > 1e-9 }; }
  }

  /* ================= 3. LQR：全状态反馈 ================= */
  // u = -K (s - s_ref)。若传入的 K 是 1x5（增广 LQI 增益），则第一个元素是
  // 积分增益，控制器内部维护积分状态 z = ∫(x - x_ref)dt：
  //   u = -(kᵢ z + K_x e_x + K_v ẋ + K_θ θ + K_ω θ̇)
  // 积分增益由 Riccati 方程给出，符号自动正确（见 lqr.js 中的说明）。
  class LQRController {
    constructor(K, p, opts) {
      this.p = p;
      this.opts = Object.assign({ zMax: 2.0 }, opts);
      this.name = 'LQR（全状态反馈）';
      this.setK(K);
      this.reset();
    }
    reset() { this.z = 0; this.tPrev = null; this.uLast = 0; this.rawLast = 0; }
    setK(K) {
      const row = Array.from(K[0]);
      if (row.length === 5) { this.ki = row[0]; this.k = row.slice(1); this.hasI = true; }
      else { this.ki = 0; this.k = row; this.hasI = false; }
      this.K = K;
    }
    compute(s, t, ref) {
      const dt = (this.tPrev === null) ? 0 : Math.max(0, t - this.tPrev);
      this.tPrev = t;
      const xRef = (ref && ref.xRef) || 0;
      const e = [s[0] - xRef, s[1], CP.wrapPi(s[2]), s[3]];
      const k = this.k;
      let raw = -(this.ki * this.z + k[0] * e[0] + k[1] * e[1] + k[2] * e[2] + k[3] * e[3]);
      // 条件积分抗饱和：饱和时冻结积分器
      if (this.hasI && dt > 0 && Math.abs(this.rawLast) < this.p.uMax * 0.99) {
        this.z = Math.max(-this.opts.zMax, Math.min(this.opts.zMax, this.z + e[0] * dt));
      }
      const u = CP.clampForce(raw, this.p);
      this.uLast = u; this.rawLast = raw;
      return u;
    }
    info() {
      return {
        mode: this.hasI ? 'lqi' : 'lqr', thetaRef: 0, integ: this.z,
        saturated: Math.abs(this.rawLast - this.uLast) > 1e-9
      };
    }
  }

  /* ================= 4. 能量摆起 + LQR 接管 ================= */
  // 给定期望小车加速度 a，反解需要的驱动力（精确反馈线性化，用到完整非线性模型）
  function forceForCartAccel(s, a, p) {
    const d = CP.derived(p);
    const l = d.l, J = d.J;
    const th = s[2], thd = s[3], xd = s[1];
    const ct = Math.cos(th), st = Math.sin(th);
    const mlc = p.m * l * ct;
    return a * ((p.M + p.m) - mlc * mlc / J)
      + (mlc / J) * (p.m * p.g * l * st - p.c * thd)
      - p.m * l * st * thd * thd
      + p.b * xd;
  }

  class SwingUpController {
    constructor(K, p, opts) {
      this.p = p; this.lqr = new LQRController(K, p);
      this.opts = Object.assign({
        kE: 4.0,          // 能量泵浦增益（实测：2.5 s 完成摆起，小车行程 0.87 m）
        kx: 1.0, kv: 1.5, // 摆起阶段的小车回中增益
        aMax: 14,         // 期望小车加速度限幅 (m/s²)
        eMargin: 0.04,    // 泵浦目标能量的过冲比例（补偿摩擦损耗，否则会"差一点上不去"）
        thetaCatch: 0.45, // 进入 LQR 的角度门限 (rad)
        rateCatch: 2.5,   // 进入 LQR 的角速度门限 (rad/s)
        vCatch: 0.5,      // 进入 LQR 的小车速度门限 (m/s)：实测这一条最关键
        xCatch: 0.7,      // 进入 LQR 的小车位置门限 (m)
        thetaDrop: 0.75,  // 退出 LQR 的角度门限（滞环，防抖）
        refSlew: 0.25     // 捕获后位置给定回中的斜坡速率 (m/s)，实现无扰接管
      }, opts);
      this.name = '摆起 + LQR 捕获';
      this.reset();
    }
    reset() {
      this.mode = 'swing'; this.switchTime = null; this.lqr.reset();
      this.tPrev = null; this.uLast = 0; this.energyGap = 0; this.xRefEff = 0;
    }
    setK(K) { this.lqr.setK(K); }
    compute(s, t, ref) {
      const dt = (this.tPrev === null) ? 0 : Math.max(0, t - this.tPrev);
      this.tPrev = t;
      const p = this.p, o = this.opts;
      const th = CP.wrapPi(s[2]), thd = s[3];
      const d = CP.derived(p);
      const Ed = p.m * p.g * d.l;                    // 直立静止时的摆杆能量
      const Etar = Ed * (1 + o.eMargin);             // 泵浦目标（略微过冲以补偿摩擦）
      const E = CP.pendulumEnergy(s, p);
      this.energyGap = E - Ed;
      const xRef = (ref && ref.xRef) || 0;

      /* --- 模式切换：捕获判据必须同时满足 4 个条件（实测吸引域，见 §7.3） --- */
      if (this.mode === 'swing') {
        if (Math.abs(th) < o.thetaCatch && Math.abs(thd) < o.rateCatch &&
            Math.abs(s[1]) < o.vCatch && Math.abs(s[0] - xRef) < o.xCatch) {
          this.mode = 'lqr'; this.switchTime = t; this.lqr.reset();
          this.xRefEff = s[0];                       // 无扰接管：先把给定放在当前位置
        }
      } else if (Math.abs(th) > o.thetaDrop) {
        this.mode = 'swing';
      }

      if (this.mode === 'lqr') {
        // 位置给定按限速斜坡从"接管瞬间的位置"平滑滑向真正的目标位置
        const step = o.refSlew * (dt > 0 ? dt : 0);
        if (this.xRefEff < xRef) this.xRefEff = Math.min(xRef, this.xRefEff + step);
        else this.xRefEff = Math.max(xRef, this.xRefEff - step);
        this.uLast = this.lqr.compute(s, t, { xRef: this.xRefEff });
        return this.uLast;
      }

      /* --- 能量泵浦：a = kE (E - E_tar) θ̇ cosθ ---
       * 由 Ė = -c θ̇² - m l a θ̇ cosθ 可知：取 a = -k θ̇ cosθ (k>0) 必使 Ė > 0。
       * 令 k = kE (E_tar - E) 即得下式，且当能量过多时自动反向抽走能量。 */
      let a = o.kE * (E - Etar) * thd * Math.cos(th);
      // 起步踢一脚：正好静止在下垂点时 θ̇ = 0，泵浦项恒为 0，需要人为激励
      if (Math.abs(thd) < 0.05 && Math.cos(th) < -0.9) a += 3.0;
      // 叠加小车回中（弱于泵浦，避免打断摆起；同时保证不会撞限位）
      a += -o.kx * (s[0] - xRef) - o.kv * s[1];
      a = Math.max(-o.aMax, Math.min(o.aMax, a));
      const raw = forceForCartAccel(s, a, p);
      this.uLast = CP.clampForce(raw, p);
      return this.uLast;
    }
    info() {
      return {
        mode: this.mode === 'lqr' ? 'LQR 捕获' : '能量摆起', rawMode: this.mode,
        thetaRef: 0, energyGap: this.energyGap, switchTime: this.switchTime,
        xRefEff: this.xRefEff
      };
    }
  }

  global.Controllers = { DEFAULT_PID, PIDCore, AnglePID, CascadePID, LQRController, SwingUpController, forceForCartAccel };
})(typeof window !== 'undefined' ? window : globalThis);
