/**
 * iso2631.js — ISO 2631-1:1997 垂向振动 Wk 频率加权滤波器
 *
 * 为什么必须加权？
 *   人体对 4–12.5 Hz 的垂向振动最敏感，对 >25 Hz 的振动几乎不敏感。
 *   未加权的加速度均方根会被路面高频纹理主导 —— 而任何作动器都不可能
 *   在车轮跳动频率(≈12 Hz)以上做功。用未加权 RMS 评价主动悬架是不公平的，
 *   汽车行业统一采用 ISO 2631 Wk 加权后的 a_w,rms 作为乘坐舒适性判据。
 *
 * Wk 由 4 个环节级联（ISO 2631-1 Annex A，Table 3）：
 *   Hh 高通  f1 = 0.4 Hz,  Q1 = 1/√2
 *   Hl 低通  f2 = 100 Hz,  Q2 = 1/√2
 *   Ht 加速度—速度过渡  f3 = 12.5 Hz, f4 = 12.5 Hz, Q4 = 0.63
 *   Hs 上升台阶         f5 = 2.37 Hz, f6 = 3.35 Hz, Q5 = Q6 = 0.91
 * 各环节以双线性变换 (Tustin) 离散为二阶节。
 */

/** s 域二阶节 (b2 s²+b1 s+b0)/(a2 s²+a1 s+a0) --> z 域双线性离散 */
function bilinear(b2, b1, b0, a2, a1, a0, fs) {
  const K = 2 * fs, K2 = K * K;
  const B0 = b2 * K2 + b1 * K + b0;
  const B1 = 2 * b0 - 2 * b2 * K2;
  const B2 = b2 * K2 - b1 * K + b0;
  const A0 = a2 * K2 + a1 * K + a0;
  const A1 = 2 * a0 - 2 * a2 * K2;
  const A2 = a2 * K2 - a1 * K + a0;
  return { b0: B0 / A0, b1: B1 / A0, b2: B2 / A0, a1: A1 / A0, a2: A2 / A0, x1: 0, x2: 0, y1: 0, y2: 0 };
}
function biqRun(s, x) {
  const y = s.b0 * x + s.b1 * s.x1 + s.b2 * s.x2 - s.a1 * s.y1 - s.a2 * s.y2;
  s.x2 = s.x1; s.x1 = x; s.y2 = s.y1; s.y1 = y;
  return y;
}
const TAU = 2 * Math.PI;

export class ISO2631Wk {
  constructor(fs = 1000) {
    this.fs = fs;
    const w = (f) => TAU * f;
    const w1 = w(0.4), Q1 = Math.SQRT1_2;
    const w2 = w(100), Q2 = Math.SQRT1_2;
    const w3 = w(12.5), w4 = w(12.5), Q4 = 0.63;
    const w5 = w(2.37), w6 = w(3.35), Q5 = 0.91, Q6 = 0.91;
    this.sec = [
      // Hh = s² / (s² + (w1/Q1)s + w1²)
      bilinear(1, 0, 0, 1, w1 / Q1, w1 * w1, fs),
      // Hl = w2² / (s² + (w2/Q2)s + w2²)
      bilinear(0, 0, w2 * w2, 1, w2 / Q2, w2 * w2, fs),
      // Ht = (w4²/w3)(s + w3) / (s² + (w4/Q4)s + w4²)
      bilinear(0, (w4 * w4) / w3, w4 * w4, 1, w4 / Q4, w4 * w4, fs),
      // Hs = (s² + (w5/Q5)s + w5²) / (s² + (w6/Q6)s + w6²)
      //   DC 增益 = w5²/w6² = 0.5，高频增益 = 1 —— 标准以 4~12.5 Hz 平台为 1.0 归一化
      bilinear(1, w5 / Q5, w5 * w5, 1, w6 / Q6, w6 * w6, fs),
    ];
  }
  reset() { for (const s of this.sec) { s.x1 = s.x2 = s.y1 = s.y2 = 0; } }
  /** 输入未加权加速度 (m/s²)，输出 Wk 加权加速度 */
  filter(a) { let y = a; for (const s of this.sec) y = biqRun(s, y); return y; }
  /** 幅频响应 |Wk(f)|（用于自检 / 绘图） */
  mag(f) {
    const th = TAU * f / this.fs;
    const cr = Math.cos(th), ci = -Math.sin(th);            // z⁻¹ = e^{-jθ}
    const c2r = Math.cos(2 * th), c2i = -Math.sin(2 * th);
    let mr = 1, mi = 0;
    for (const s of this.sec) {
      const nr = s.b0 + s.b1 * cr + s.b2 * c2r, ni = s.b1 * ci + s.b2 * c2i;
      const dr = 1 + s.a1 * cr + s.a2 * c2r, di = s.a1 * ci + s.a2 * c2i;
      const dd = dr * dr + di * di;
      const hr = (nr * dr + ni * di) / dd, hi = (ni * dr - nr * di) / dd;
      const t = mr * hr - mi * hi; mi = mr * hi + mi * hr; mr = t;
    }
    return Math.hypot(mr, mi);
  }
}

/** ISO 2631-1 舒适性主观评价等级（依据加权加速度均方根 a_w） */
export function comfortRating(aw) {
  if (aw < 0.315) return { txt: '无不适', cls: 'good', idx: 0 };
  if (aw < 0.5) return { txt: '略有不适', cls: 'good', idx: 1 };
  if (aw < 0.8) return { txt: '有些不适', cls: 'ok', idx: 2 };
  if (aw < 1.25) return { txt: '不舒适', cls: 'warn', idx: 3 };
  if (aw < 2.0) return { txt: '很不舒适', cls: 'bad', idx: 4 };
  return { txt: '极不舒适', cls: 'bad', idx: 5 };
}
