/**
 * controllers.js — 悬架控制算法
 *
 * ┌ 被动 (passive)      : Fa ≡ 0，仅靠螺旋弹簧 + 液压减振器
 * └ 主动 (active)       : 以下 4 种可选
 *     skyhook   天棚阻尼 + 地棚阻尼混合
 *     modal     浮沉/侧倾/俯仰 模态解耦 PD（经典「魔毯」姿态控制）
 *     lqr       整车 14 状态 LQR 最优状态反馈（在线求解 DARE）
 *     lqrpv     LQR 反馈 + 路面预瞄前馈  ★默认 = 魔毯系统 (Magic Body Control)
 *
 * ── 预瞄前馈的推导 ─────────────────────────────────────────────
 *  若希望车轮完全「贴合」路面而车身完全不动 (zs≡0)，则由簧下质量方程
 *        mu·z̈u = Ft − Fs ,  期望 zu = zr ,  轮胎不产生动载 Ft ≈ 0
 *  得到需要的悬架总力      Fs* = −mu·z̈r
 *  而 Fs = ks·(zu−zs) + cs·(żu−żs) + Fa = ks·zr + cs·żr + Fa
 *  ⇒  Fa_ff = −( ks·zr + cs·żr + mu·z̈r )
 *  即：遇坑主动伸长（把车轮压进坑里），遇包主动回缩（让车轮抬起）。
 *  路面信号先经二阶低通（模拟摄像头/激光扫描 + 抗高频），
 *  并用预瞄超前 τ 抵消滤波器与作动器相位滞后。
 * ───────────────────────────────────────────────────────────────
 */

import { linearize, cornerZ, cornerZd } from './vehicle.js';
import { mat, diag, mT, mmul, c2d, dare } from './linalg.js';

export const ALGOS = {
  off: { label: '关闭主动（等同被动）', tag: 'OFF' },
  skyhook: { label: '天棚阻尼 Skyhook', tag: 'SKY' },
  modal: { label: '模态解耦 PD（浮沉/侧倾/俯仰）', tag: 'MODAL' },
  lqr: { label: '整车 LQR 最优反馈', tag: 'LQR' },
  lqrpv: { label: 'LQR + 路面预瞄前馈（魔毯 MBC）', tag: 'LQR+PV' },
};

/** LQR 权重（由 tools/simcheck.mjs 离线扫描调校） */
export const LQR_WEIGHTS = {
  wZs: 1.2e5,      // 车身浮沉位移
  wPhi: 2.2e6,     // 侧倾角
  wTheta: 1.8e6,   // 俯仰角
  wDzs: 7.0e5,     // 车身浮沉速度（舒适性主项）
  wDphi: 5.0e5,
  wDtheta: 4.5e5,
  wTravel: 3.0e3,  // 悬架行程（防打限位，权重要小，否则车身会跟随路面）
  wTire: 2.5e2,    // 轮胎动变形（接地性，权重要小）
  ru: 2.2e-3,      // 作动器出力代价
};

/**
 * 构造整车 LQR 增益。返回 { K: 4x14, info }
 * Q = Cᵀ W C，输出 y = [zs, φ, θ, żs, φ̇, θ̇, 行程×4, 轮胎变形×4]
 */
export function buildLQR(p, W = LQR_WEIGHTS, dt = 0.004) {
  W = { ...LQR_WEIGHTS, ...W };
  const { A, B } = linearize(p);
  const n = 14, m = 4, ny = 14;
  const C = mat(ny, n);
  const set = (i, j, v) => { C.d[i * n + j] = v; };
  set(0, 0, 1); set(1, 1, 1); set(2, 2, 1);
  set(3, 7, 1); set(4, 8, 1); set(5, 9, 1);
  for (let i = 0; i < 4; i++) {
    // 行程 = zu_i − (zs + lz·θ + lx·φ)
    set(6 + i, 3 + i, 1); set(6 + i, 0, -1); set(6 + i, 2, -p.lz[i]); set(6 + i, 1, -p.lx[i]);
    // 轮胎动变形（设计工况 zr = 0）
    set(10 + i, 3 + i, -1);
  }
  const Wd = diag([
    W.wZs, W.wPhi, W.wTheta, W.wDzs, W.wDphi, W.wDtheta,
    W.wTravel, W.wTravel, W.wTravel, W.wTravel,
    W.wTire, W.wTire, W.wTire, W.wTire,
  ]);
  const Q = mmul(mT(C), mmul(Wd, C));
  const R = diag([W.ru, W.ru, W.ru, W.ru]);
  const { Ad, Bd } = c2d(A, B, dt);
  const t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const sol = dare(Ad, Bd, Q, R, { iters: 6000, tol: 1e-12 });
  const t1 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  return { K: sol.K, info: { iters: sol.iters, err: sol.err, ms: t1 - t0, dt } };
}

/* ------------------------------------------------------------------ */
/*  作动器模型：饱和 + 变化率限制 + 一阶带宽滞后                       */
/* ------------------------------------------------------------------ */
class Actuators {
  constructor(p) {
    this.p = p;
    this.cmd = new Float64Array(4);   // 限幅/限速后的指令
    this.out = new Float64Array(4);   // 实际出力
    this.power = 0;                   // 瞬时液压功率估计 W
    this.satFrac = 0;                 // 本步饱和程度 0..1
  }
  reset() { this.cmd.fill(0); this.out.fill(0); this.power = 0; this.satFrac = 0; }
  apply(raw, dt, deflv) {
    const p = this.p;
    const alpha = 1 - Math.exp(-dt * 2 * Math.PI * p.actBW);
    let pw = 0, sat = 0;
    for (let i = 0; i < 4; i++) {
      let t = raw[i];
      if (Math.abs(t) >= p.actMaxF * 0.995) sat++;
      t = Math.max(-p.actMaxF, Math.min(p.actMaxF, t));
      const dmax = p.actRate * dt;
      const d = Math.max(-dmax, Math.min(dmax, t - this.cmd[i]));
      this.cmd[i] += d;
      this.out[i] += (this.cmd[i] - this.out[i]) * alpha;
      // 作动器功率：出力 × 相对运动速度
      pw += Math.abs(this.out[i] * (deflv ? deflv[i] : 0));
    }
    this.power = pw;
    this.satFrac = sat / 4;
    return this.out;
  }
}

/* ------------------------------------------------------------------ */
/*  主控制器                                                          */
/* ------------------------------------------------------------------ */
export class SuspensionController {
  /**
   * @param p     车辆参数
   * @param mode  'passive' | 'active'
   * @param lqr   buildLQR() 的结果（active 时必需）
   */
  constructor(p, mode, lqr) {
    this.p = p;
    this.mode = mode;
    this.lqr = lqr;
    this.algo = mode === 'passive' ? 'off' : 'lqrpv';
    this.act = new Actuators(p);
    this.raw = new Float64Array(4);
    this.ff = new Float64Array(4);
    this.fb = new Float64Array(4);
    this.es = new Float64Array(4);
    this.esActive = 0;
    // 预瞄二阶低通状态（每轮独立）
    this.pvZ = new Float64Array(4);
    this.pvV = new Float64Array(4);
    this.pvA = new Float64Array(4);
    this.pvRaw = new Float64Array(4);   // 未夹紧的原始预瞄路面高程
    this.err = new Float64Array(14);    // LQR 误差状态
    this.refZ = 0; this.refV = 0;       // 规划出的车身高度参考轨迹
    // 可调
    this.gains = {
      cSky: 5200, cGnd: 900,           // skyhook
      kpH: 26000, kdH: 9500,           // 模态 PD：浮沉
      kpR: 190000, kdR: 62000,         // 侧倾
      kpP: 210000, kdP: 78000,         // 俯仰
      ffGain: 0.95,                    // 预瞄前馈总权重
      ffInertia: 0.0,                  // 簧下惯性项 mu·z̈r 权重（经扫描验证 ∝v²，取 0 最优）
      ffSoftSat: 0.72,                 // 前馈软饱和阈值（× 作动器上限）：tanh 限幅，保相位
      pvLambda: 1.2,                   // 预瞄低通「空间」截止波长 m（与车速无关，鲁棒）
      pvZeta: 0.95,
      pvFmax: 11.0,                    // 时域截止上限 Hz（受作动器带宽约束，经扫描调校）
      pvLeadScale: 0.33,               // 群延迟补偿系数（经扫描调校：过度超前反而恶化）
      pvLeadTime: 0.012,               // 附加超前时间 s（补偿作动器一阶滞后）
      scanDistance: 15.0,              // 前视扫描（可视化）距离 m
      envMargin: 0.006,                // 预瞄轨迹的行程包络余量 m（经扫描调校）
      refMargin: 0.022,                // 车身高度参考轨迹的触发余量 m
      refGain: 0.0,                    // 车身参考轨迹权重（实测：短波障碍下强制车身跟随反而更差，故默认关闭）
      /* 主动限位保护（production active suspension 必备功能）
       * 车身隔振做得越好，车轮就必须走越多行程；高速通过深坑/减速带时
       * 若不加干预会硬撞缓冲块（420 kN/m），反而产生比被动更大的冲击。
       * 因此在接近限位前渐进介入，牺牲少量隔振换取不撞限位。 */
      endStopMargin: 0.026,            // 提前介入余量 m
      endStopK: 240000,                // 主动「软限位」刚度 N/m
      endStopC: 5200,                  // 主动「软限位」阻尼 N·s/m
    };
    this.enabled = mode === 'active';
  }

  reset() {
    this.act.reset();
    this.pvZ.fill(0); this.pvV.fill(0); this.pvA.fill(0); this.pvRaw.fill(0);
    this.raw.fill(0); this.ff.fill(0); this.fb.fill(0); this.es.fill(0);
    this.refZ = 0; this.refV = 0;
    this.esActive = 0;
  }

  setAlgo(a) { this.algo = a; this.reset(); }

  /**
   * 计算作动器力。
   * @param x     状态 (14)
   * @param dt    控制周期
   * @param s     里程
   * @param v     车速 m/s
   * @param road  Road
   * @param defl  当前 4 轮悬架行程
   * @param deflv 行程速度
   */
  compute(x, dt, s, v, road, defl, deflv) {
    const p = this.p, g = this.gains;
    this.raw.fill(0); this.ff.fill(0); this.fb.fill(0); this.es.fill(0);

    if (!this.enabled || this.algo === 'off') {
      return this.act.apply(this.raw, dt, deflv);
    }

    /* ================================================================
     *  第 1 步：预瞄（魔毯核心）—— 前视扫描 + 轨迹规划
     * ================================================================ */
    if (this.algo === 'lqrpv') {
      // 空间域截止：ωn = 2πv/λc  ⇒ 滤波形状与车速无关，群延迟折算成固定「超前距离」
      let fc = v / g.pvLambda;
      if (fc > g.pvFmax) fc = g.pvFmax;
      let wn = 2 * Math.PI * fc;
      if (wn * dt > 0.3) wn = 0.3 / dt;                  // 显式积分稳定性护栏
      const ze = g.pvZeta;
      /* 预瞄超前量 = 自动补偿「二阶低通群延迟 + 作动器一阶滞后」
       * 二阶低通群延迟 ≈ 2ζ/ωn。ωn 随车速变化（且受 pvFmax 限幅），
       * 因此超前量必须由 ωn 反算，而不能写死成固定距离 —— 否则高速段相位错配，
       * 前馈会在错误相位上「帮倒忙」。 */
      const groupDelay = 2 * ze / wn;
      const lead = v * (g.pvLeadScale * groupDelay + g.pvLeadTime);
      this.previewLeadM = lead;

      /* 行程可用性约束：
       * 若车身完全不动 (zs=0) 而车轮完全贴合路面 (zu=zr)，所需悬架行程恰为 |zr|。
       * 因此把预瞄目标限制在「可用行程包络」内，等价于在轨迹规划阶段就满足行程约束
       * —— 遇到 100 mm 深坑而只有 98 mm 回弹行程时，系统「部分隔振」而不是把
       * 减振器拉到底硬撞限位（那会比被动更差）。
       * 用 tanh 软限幅而非硬截断：硬截断会产生平顶折角，其导数尖峰会让前馈的
       * cs·ż 项在障碍顶部剧烈跳变，实测反而恶化 —— 软限幅保持波形光滑。 */
      const upLim = p.travelBump - g.envMargin;
      const dnLim = p.travelReb - g.envMargin;
      for (let i = 0; i < 4; i++) {
        const side = (i % 2 === 0) ? -1 : 1;
        road.sample(s + p.lz[i] + lead, side, _o);
        const zr = _o[0];
        this.pvRaw[i] = zr;
        const lim = zr >= 0 ? upLim : dnLim;
        const zTarget = lim * Math.tanh(zr / lim);
        // 二阶低通（等效前视扫描 + 抗高频）：状态即 z、ż、z̈
        const a = wn * wn * (zTarget - this.pvZ[i]) - 2 * ze * wn * this.pvV[i];
        this.pvV[i] += a * dt;
        this.pvZ[i] += this.pvV[i] * dt;
        this.pvA[i] = a;
        const csEq = 0.5 * (p.csC[i] + p.csR[i]);
        const f = -g.ffGain * (p.ks[i] * this.pvZ[i] + csEq * this.pvV[i] + g.ffInertia * p.mu[i] * this.pvA[i]);
        // 软饱和：tanh 限幅而非硬截断，避免削顶破坏前馈相位
        const fsat = g.ffSoftSat * p.actMaxF;
        this.ff[i] = fsat * Math.tanh(f / fsat);
      }

      /* 车身高度参考轨迹规划（关键）：
       * 「魔毯」并不是把车身绝对压平 —— 当障碍幅值超出可用行程时，绝对压平
       * 必然导致减振器打到底，冲击反而比被动更大。正确做法是：由预瞄提前算出
       *  「必须让车身跟随的最小量」，生成一条平滑的车身高度参考 z_ref，
       *  让 LQR 去跟踪 z_ref 而不是跟踪 0。
       *  需求：travel_i = zr_i − zs_i 必须落在 [−refDn, +refUp] 内
       *     ⇒ zs ≥ zr_i − refUp  （凸包过高，车身必须抬起）
       *     ⇒ zs ≤ zr_i + refDn  （深坑过深，车身必须下沉） */
      const refUp = p.travelBump - g.refMargin;
      const refDn = p.travelReb - g.refMargin;
      let need = 0, needDn = 0;
      for (let i = 0; i < 4; i++) {
        const over = this.pvRaw[i] - refUp;
        if (over > need) need = over;
        const under = this.pvRaw[i] + refDn;
        if (under < needDn) needDn = under;
      }
      const refTarget = g.refGain * (need + needDn);
      const ra = wn * wn * (refTarget - this.refZ) - 2 * ze * wn * this.refV;
      this.refV += ra * dt;
      this.refZ += this.refV * dt;
    } else {
      this.refZ = 0; this.refV = 0;
    }

    /* ================================================================
     *  第 2 步：状态反馈
     * ================================================================ */
    if (this.algo === 'skyhook') {
      for (let i = 0; i < 4; i++) {
        const zsd = cornerZd(p, x, i);
        this.fb[i] = -g.cSky * zsd + g.cGnd * x[10 + i];
      }
    } else if (this.algo === 'modal') {
      const Fh = -(g.kpH * x[0] + g.kdH * x[7]);
      const Mr = -(g.kpR * x[1] + g.kdR * x[8]);
      const Mp = -(g.kpP * x[2] + g.kdP * x[9]);
      let sz = 0, sx = 0;
      for (let i = 0; i < 4; i++) { sz += p.lz[i] * p.lz[i]; sx += p.lx[i] * p.lx[i]; }
      for (let i = 0; i < 4; i++) {
        this.fb[i] = Fh / 4 + (Mp * p.lz[i]) / sz + (Mr * p.lx[i]) / sx;
      }
    } else if (this.algo === 'lqr' || this.algo === 'lqrpv') {
      // 误差状态：车身浮沉相对「参考轨迹」而非绝对零位
      const e = this.err;
      for (let j = 0; j < 14; j++) e[j] = x[j];
      e[0] -= this.refZ;
      e[7] -= this.refV;
      const K = this.lqr.K;                 // 4 x 14
      for (let i = 0; i < 4; i++) {
        let u = 0;
        const row = i * 14;
        for (let j = 0; j < 14; j++) u -= K.d[row + j] * e[j];
        this.fb[i] = u;
      }
    }

    for (let i = 0; i < 4; i++) this.raw[i] = this.fb[i] + this.ff[i];

    /* ================================================================
     *  第 3 步：主动限位保护 —— 接近缓冲块时渐进介入
     * ================================================================ */
    this.esActive = 0;
    if (defl) {
      const limC = p.travelBump - g.endStopMargin;
      const limR = p.travelReb - g.endStopMargin;
      for (let i = 0; i < 4; i++) {
        const d = defl[i], dv = deflv ? deflv[i] : 0;
        if (d > limC) {
          // 压缩即将到底：正向出力把车轮往下推，抵抗继续压缩
          const e = d - limC;
          this.es[i] = g.endStopK * e + g.endStopC * Math.max(0, dv);
          this.esActive = Math.max(this.esActive, Math.min(1, e / g.endStopMargin));
        } else if (d < -limR) {
          const e = d + limR;
          this.es[i] = g.endStopK * e + g.endStopC * Math.min(0, dv);
          this.esActive = Math.max(this.esActive, Math.min(1, -e / g.endStopMargin));
        } else this.es[i] = 0;
        this.raw[i] += this.es[i];
      }
    }
    return this.act.apply(this.raw, dt, deflv);
  }

  get force() { return this.act.out; }
  get powerW() { return this.act.power; }
  get satFrac() { return this.act.satFrac; }
}

const _o = new Float64Array(2);
