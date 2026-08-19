/**
 * vehicle.js — 7 自由度整车平顺性 (ride) 动力学模型
 *
 * 自由度：
 *   簧上质量：垂向浮沉 zs、侧倾 φ、俯仰 θ            (3)
 *   簧下质量：4 个车轮垂向 zu[i]                       (4)
 * 状态向量 x (14):
 *   [ zs, φ, θ, zu0..zu3, żs, φ̇, θ̇, żu0..żu3 ]
 *
 * 角标约定 i: 0=左前(FL) 1=右前(FR) 2=左后(RL) 3=右后(RR)
 * 坐标：x 向右为正，y 向上为正，z 向前为正
 *   俯仰 θ > 0 = 车头抬起；侧倾 φ > 0 = 右侧抬起
 *
 * 全部量均为「相对静平衡位置的偏差」，因此重力在方程中自动消去；
 * 轮胎离地判据则单独用静态轮荷判断。
 *
 * 非线性环节：减振器压缩/复原不对称阻尼、缓冲块(bump stop)、
 * 横向稳定杆、轮胎单向接触（可离地）。
 */

export const IDX = { ZS: 0, PHI: 1, THETA: 2, ZU: 3, DZS: 7, DPHI: 8, DTHETA: 9, DZU: 10, N: 14 };
export const CORNER_NAMES = ['左前 FL', '右前 FR', '左后 RL', '右后 RR'];

export function makeParams(over = {}) {
  const p = {
    /* 簧上 */
    ms: 1620,          // 簧上质量 kg
    Ix: 620,           // 侧倾惯量 kg·m²
    Iy: 2760,          // 俯仰惯量 kg·m²
    /* 几何 */
    lf: 1.45, lr: 1.50,   // 质心到前/后轴距离 m
    tf: 1.58, tr: 1.60,   // 前/后轮距 m
    hCG: 0.55,            // 质心高度（可视化用）
    /* 簧下 */
    mu: [46, 46, 49, 49],
    /* 悬架（轮心当量刚度/阻尼） */
    ks: [30000, 30000, 34000, 34000],
    csC: [2300, 2300, 2600, 2600],   // 压缩行程阻尼
    csR: [3600, 3600, 3900, 3900],   // 复原行程阻尼
    /* 缓冲块（行程限位）：压缩 88 mm / 回弹 98 mm，总行程 186 mm（豪华轿车量级） */
    travelBump: 0.088, travelReb: 0.098, kStop: 420000, cStop: 1800,
    /* 横向稳定杆（差动行程刚度 N/m） */
    karb: [15000, 8500],
    /* 轮胎 */
    kt: [235000, 235000, 235000, 235000],
    ct: [420, 420, 420, 420],
    /* 关键测点：驾驶员座椅（相对质心） */
    seat: { lz: 0.28, lx: -0.36 },
    /* 作动器（主动悬架） */
    actMaxF: 4800,        // 最大出力 N（对标量产液压主动悬架 ~5 kN）
    actRate: 110000,      // 力变化率上限 N/s
    actBW: 24,            // 一阶带宽 Hz
    g: 9.81,
  };
  Object.assign(p, over);
  // 派生量
  p.lz = [p.lf, p.lf, -p.lr, -p.lr];
  p.lx = [-p.tf / 2, p.tf / 2, -p.tr / 2, p.tr / 2];
  p.L = p.lf + p.lr;
  const Wf = (p.ms * p.g * p.lr) / p.L / 2;
  const Wr = (p.ms * p.g * p.lf) / p.L / 2;
  p.Wsprung = [Wf, Wf, Wr, Wr];
  p.Wtire = p.Wsprung.map((w, i) => w + p.mu[i] * p.g);
  p.axleOf = [0, 0, 1, 1];
  p.partnerOf = [1, 0, 3, 2];
  // 静态弹簧压缩量（可视化：轮跳零点即静平衡）
  return p;
}

/** 角点簧上垂向位移 / 速度 */
export function cornerZ(p, x, i) { return x[0] + p.lz[i] * x[2] + p.lx[i] * x[1]; }
export function cornerZd(p, x, i) { return x[7] + p.lz[i] * x[9] + p.lx[i] * x[8]; }

/**
 * 状态导数。
 * @param p      参数
 * @param x      状态 Float64Array(14)
 * @param zr     4 轮路面高程
 * @param zrd    4 轮路面高程变化率
 * @param Fa     4 个作动器力（>0 = 顶起车身 / 压下车轮），被动时全 0
 * @param dx     输出导数 Float64Array(14)
 * @param diag   可选诊断对象，写入各分力
 */
export function deriv(p, x, zr, zrd, Fa, dx, diag) {
  const defl = _defl, deflv = _deflv, Fs = _Fs, Ft = _Ft;
  for (let i = 0; i < 4; i++) {
    const zsi = cornerZ(p, x, i), zsdi = cornerZd(p, x, i);
    defl[i] = x[3 + i] - zsi;      // >0 悬架压缩
    deflv[i] = x[10 + i] - zsdi;
  }
  for (let i = 0; i < 4; i++) {
    const ax = p.axleOf[i], j = p.partnerOf[i];
    // 弹簧
    let F = p.ks[i] * defl[i];
    // 缓冲块（压缩 / 复原限位）
    if (defl[i] > p.travelBump) {
      const e = defl[i] - p.travelBump;
      F += p.kStop * e * (1 + 6 * e) + p.cStop * Math.max(0, deflv[i]);
    } else if (defl[i] < -p.travelReb) {
      const e = defl[i] + p.travelReb;
      F += p.kStop * e * (1 + 6 * Math.abs(e)) + p.cStop * Math.min(0, deflv[i]);
    }
    // 不对称阻尼
    F += (deflv[i] > 0 ? p.csC[i] : p.csR[i]) * deflv[i];
    // 横向稳定杆：抵抗左右差动行程（同向行程不产生力）
    F += p.karb[ax] * (defl[i] - defl[j]);
    // 作动器
    F += Fa ? Fa[i] : 0;
    Fs[i] = F;

    // 轮胎（单向接触）
    let ft = p.kt[i] * (zr[i] - x[3 + i]) + p.ct[i] * (zrd[i] - x[10 + i]);
    let contact = 1;
    if (ft + p.Wtire[i] <= 0) { ft = -p.Wtire[i]; contact = 0; }   // 离地
    Ft[i] = ft;
    if (diag) diag.contact[i] = contact;
  }

  let sF = 0, mRoll = 0, mPitch = 0;
  for (let i = 0; i < 4; i++) { sF += Fs[i]; mRoll += p.lx[i] * Fs[i]; mPitch += p.lz[i] * Fs[i]; }

  dx[0] = x[7]; dx[1] = x[8]; dx[2] = x[9];
  dx[3] = x[10]; dx[4] = x[11]; dx[5] = x[12]; dx[6] = x[13];
  dx[7] = sF / p.ms;
  dx[8] = mRoll / p.Ix;
  dx[9] = mPitch / p.Iy;
  for (let i = 0; i < 4; i++) dx[10 + i] = (Ft[i] - Fs[i]) / p.mu[i];

  if (diag) {
    for (let i = 0; i < 4; i++) {
      diag.Fs[i] = Fs[i]; diag.Ftire[i] = Ft[i];
      diag.defl[i] = defl[i]; diag.deflv[i] = deflv[i];
      diag.load[i] = Ft[i] + p.Wtire[i];
    }
    diag.azs = dx[7]; diag.aphi = dx[8]; diag.atheta = dx[9];
    diag.aseat = dx[7] + p.seat.lz * dx[9] + p.seat.lx * dx[8];
  }
  return dx;
}

const _defl = new Float64Array(4), _deflv = new Float64Array(4);
const _Fs = new Float64Array(4), _Ft = new Float64Array(4);

export function makeDiag() {
  return {
    Fs: new Float64Array(4), Ftire: new Float64Array(4), defl: new Float64Array(4),
    deflv: new Float64Array(4), load: new Float64Array(4), contact: new Float64Array(4).fill(1),
    azs: 0, aphi: 0, atheta: 0, aseat: 0,
  };
}

/* ------------------------------------------------------------------ */
/*  RK4 积分器（零阶保持作动器力，等效数字控制器）                     */
/* ------------------------------------------------------------------ */
export class Integrator {
  constructor(p) {
    this.p = p;
    this.k1 = new Float64Array(14); this.k2 = new Float64Array(14);
    this.k3 = new Float64Array(14); this.k4 = new Float64Array(14);
    this.xt = new Float64Array(14);
    this.zr = new Float64Array(4); this.zrd = new Float64Array(4);
  }
  /**
   * 前进一步。roadAt(sOffsetArray) 通过回调采样，保证各 RK 级都用正确里程。
   * @param x     状态（就地更新）
   * @param dt    步长
   * @param s     当前里程
   * @param v     车速 m/s
   * @param road  Road 实例
   * @param Fa    作动器力（本步恒定）
   * @param diag  诊断（用最终状态重算一次）
   */
  step(x, dt, s, v, road, Fa, diag) {
    const p = this.p, { k1, k2, k3, k4, xt } = this;
    const o = this._o || (this._o = new Float64Array(2));
    const sample = (ds) => {
      for (let i = 0; i < 4; i++) {
        const side = (i % 2 === 0) ? -1 : 1;
        road.sample(s + ds + p.lz[i], side, o);
        this.zr[i] = o[0];
        this.zrd[i] = o[1] * v;      // dz/dt = dz/ds · v
      }
    };
    sample(0);           deriv(p, x, this.zr, this.zrd, Fa, k1);
    for (let i = 0; i < 14; i++) xt[i] = x[i] + 0.5 * dt * k1[i];
    sample(0.5 * dt * v); deriv(p, xt, this.zr, this.zrd, Fa, k2);
    for (let i = 0; i < 14; i++) xt[i] = x[i] + 0.5 * dt * k2[i];
    deriv(p, xt, this.zr, this.zrd, Fa, k3);
    for (let i = 0; i < 14; i++) xt[i] = x[i] + dt * k3[i];
    sample(dt * v);      deriv(p, xt, this.zr, this.zrd, Fa, k4);
    for (let i = 0; i < 14; i++) x[i] += (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]);
    // 用更新后的状态生成诊断量
    sample(dt * v);
    deriv(p, x, this.zr, this.zrd, Fa, k1, diag);
    if (diag) { diag.zr = Array.from(this.zr); }
  }
}

/* ------------------------------------------------------------------ */
/*  线性化：用有限差分从 deriv 中提取 A、B —— 保证与仿真模型完全一致    */
/* ------------------------------------------------------------------ */
export function linearize(p) {
  const n = 14, m = 4;
  const A = { r: n, c: n, d: new Float64Array(n * n) };
  const B = { r: n, c: m, d: new Float64Array(n * m) };
  const zr = new Float64Array(4), zrd = new Float64Array(4);
  const Fa = new Float64Array(4);
  const f1 = new Float64Array(n), f2 = new Float64Array(n);
  const xp = new Float64Array(n), xm = new Float64Array(n);
  const h = 1e-6;
  for (let j = 0; j < n; j++) {
    xp.fill(0); xm.fill(0); xp[j] = h; xm[j] = -h;
    deriv(p, xp, zr, zrd, Fa, f1);
    deriv(p, xm, zr, zrd, Fa, f2);
    for (let i = 0; i < n; i++) A.d[i * n + j] = (f1[i] - f2[i]) / (2 * h);
  }
  const x0 = new Float64Array(n);
  for (let j = 0; j < m; j++) {
    Fa.fill(0); Fa[j] = 1;
    deriv(p, x0, zr, zrd, Fa, f1);
    Fa[j] = -1;
    deriv(p, x0, zr, zrd, Fa, f2);
    for (let i = 0; i < n; i++) B.d[i * m + j] = (f1[i] - f2[i]) / 2;
  }
  return { A, B };
}
