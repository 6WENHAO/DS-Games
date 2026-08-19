/**
 * road.js — 路面激励模型
 *
 * 提供解析路面高程函数：
 *   height(s, side)      —— 真实路面几何（用于 3D 路面网格绘制）
 *   sample(s, side, out) —— 经「轮胎接地印迹包络滤波」后的等效激励 + 斜率
 *                           （用于动力学与预瞄，物理上正确：轮胎不会
 *                            把波长远小于印迹长度的路面细节传给车身）
 *
 * 路面 = 宏观事件（坑洼/减速带/搓板/长波起伏/对角扭曲）+ ISO 8608 随机不平度。
 * 左右轮可有不同激励以激发侧倾。s 为里程 (m)，赛道环形循环。
 *
 * 纯解析、可在任意 s 求值 —— 这是主动悬架「预瞄 (preview)」得以实现的前提。
 */

/* ---------- 确定性伪随机（保证两台车看到完全相同的路面） ---------- */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const smoothstep = (u) => u * u * (3 - 2 * u);
/** 平滑凹坑 / 凸包：u∈[0,1] -> 0..1..0 */
const hump = (u) => 0.5 * (1 - Math.cos(2 * Math.PI * u));
/** 带陡边的平底坑（真实沥青坑洞） */
function trench(u, edge) {
  if (u <= 0 || u >= 1) return 0;
  if (u < edge) return smoothstep(u / edge);
  if (u > 1 - edge) return smoothstep((1 - u) / edge);
  return 1;
}

/* ---------- 路面事件库 ---------- */
// side: 0=双轮 -1=仅左轮 +1=仅右轮
function potholeCourse() {
  return {
    name: '综合坑洼路面',
    length: 190,
    desc: '双轮坑 / 左右错位坑 / 减速带 / 尖锐坑洞 / 搓板 / 长波起伏 / 对角扭曲',
    features: [
      { k: 'trench', s: 14, len: 1.5, amp: -0.075, side: 0, note: '双轮坑洼 −75 mm' },
      { k: 'trench', s: 27, len: 1.0, amp: -0.065, side: -1, note: '左单侧坑（激发侧倾）' },
      { k: 'trench', s: 34, len: 1.0, amp: -0.065, side: 1, note: '右单侧坑' },
      { k: 'hump', s: 45, len: 3.6, amp: 0.10, side: 0, note: '减速带 +100 mm' },
      { k: 'trench', s: 57, len: 0.8, amp: -0.095, side: 0, edge: 0.16, note: '尖锐坑洞 −95 mm' },
      { k: 'hump', s: 66, len: 0.35, amp: 0.028, side: 0, note: '窄凸棱 cleat' },
      { k: 'wash', s: 76, len: 16, amp: 0.014, waves: 9, side: 0, note: '搓板路' },
      { k: 'hump', s: 100, len: 26, amp: 0.085, side: 0, note: '长波起伏（车身浮沉）' },
      { k: 'trench', s: 134, len: 1.2, amp: -0.070, side: -1, note: '对角扭曲 · 左' },
      { k: 'trench', s: 137.6, len: 1.2, amp: -0.070, side: 1, note: '对角扭曲 · 右' },
      { k: 'hump', s: 150, len: 2.0, amp: 0.055, side: 0, note: '缓凸包' },
      { k: 'trench', s: 160, len: 1.4, amp: -0.10, side: 0, edge: 0.18, note: '深坑 −100 mm' },
      { k: 'hump', s: 172, len: 1.2, amp: 0.045, side: -1, note: '左单侧凸包' },
    ],
    rough: { amp: 0.0045, seed: 20240517 },
  };
}
function bumpCourse() {
  const f = [];
  for (let i = 0; i < 9; i++) {
    f.push({ k: 'hump', s: 12 + i * 12, len: 3.4, amp: 0.085 + 0.006 * (i % 3), side: 0, note: `减速带 #${i + 1}` });
  }
  return { name: '连续减速带', length: 120, desc: '9 条标准减速带，考察俯仰与冲击抑制', features: f, rough: { amp: 0.003, seed: 7717 } };
}
function roughCourse() {
  return {
    name: 'ISO 8608 D 级粗糙路',
    length: 150,
    desc: '宽频随机不平度，考察加权加速度均方根与轮胎接地性',
    features: [],
    rough: { amp: 0.019, seed: 991137 },
  };
}
function twistCourse() {
  const f = [];
  for (let i = 0; i < 10; i++) {
    f.push({ k: 'trench', s: 14 + i * 11, len: 1.5, amp: -0.075, side: i % 2 ? 1 : -1, note: `扭曲坑 · ${i % 2 ? '右' : '左'}` });
    f.push({ k: 'hump', s: 19.5 + i * 11, len: 1.6, amp: 0.055, side: i % 2 ? -1 : 1, note: '反向凸包' });
  }
  return { name: '交替扭曲路', length: 125, desc: '左右交替坑包，强侧倾激励', features: f, rough: { amp: 0.0035, seed: 4242 } };
}

export const COURSES = { pothole: potholeCourse(), bump: bumpCourse(), rough: roughCourse(), twist: twistCourse() };
export const COURSE_KEYS = Object.keys(COURSES);

/** 轮胎接地印迹半长 (m)：235/45 R18 约 ±80 mm */
const PATCH_A = 0.080;

export class Road {
  constructor(courseKey = 'pothole') { this.setCourse(courseKey); }

  setCourse(key) {
    this.key = COURSES[key] ? key : 'pothole';
    this.course = COURSES[this.key];
    const L = this.length = this.course.length;

    /* 事件展开：归一化到 [0,L) 并为跨接事件补一份副本，再做 1 m 分桶加速查询 */
    const feats = [];
    for (const f of this.course.features) {
      const base = { ...f, edge: f.edge ?? 0.22 };
      let s0 = base.s % L; if (s0 < 0) s0 += L;
      feats.push({ ...base, s: s0 });
      if (s0 + base.len > L) feats.push({ ...base, s: s0 - L });
      if (s0 < 0.001) feats.push({ ...base, s: s0 + L });
    }
    this.feats = feats;
    const nb = Math.ceil(L) + 1;
    this.buckets = Array.from({ length: nb }, () => []);
    feats.forEach((f, idx) => {
      const a = Math.floor(f.s) - 1, b = Math.ceil(f.s + f.len) + 1;
      for (let i = a; i <= b; i++) {
        let bi = i % nb; if (bi < 0) bi += nb;
        if (!this.buckets[bi].includes(idx)) this.buckets[bi].push(idx);
      }
    });

    /* 随机不平度：波长 30 m → 0.57 m（更短的波长由轮胎印迹滤除，不必建模） */
    const rnd = mulberry32(this.course.rough.seed);
    this.harm = [];
    for (let i = 0; i < 10; i++) {
      const waveLen = 30 / Math.pow(1.55, i);
      this.harm.push({
        w: (2 * Math.PI) / waveLen,
        a: this.course.rough.amp * Math.pow(waveLen / 30, 0.92),
        pL: rnd() * Math.PI * 2, pR: rnd() * Math.PI * 2,
      });
    }
    this.nb = nb;
  }

  /** 真实路面高程 (m)。side: -1 左轮 / +1 右轮 */
  height(s, side) {
    const L = this.length;
    let u = s % L; if (u < 0) u += L;
    let z = 0;
    const bk = this.buckets[Math.floor(u) % this.nb];
    for (let n = 0; n < bk.length; n++) {
      const f = this.feats[bk[n]];
      if (f.side !== 0 && f.side !== side) continue;
      const t = (u - f.s) / f.len;
      if (t <= 0 || t >= 1) continue;
      if (f.k === 'hump') z += f.amp * hump(t);
      else if (f.k === 'trench') z += f.amp * trench(t, f.edge);
      else if (f.k === 'wash') {
        const env = Math.min(1, Math.min(t, 1 - t) / 0.05);
        z += f.amp * env * Math.sin(2 * Math.PI * f.waves * t);
      }
    }
    const seam = Math.min(1, Math.min(u, L - u) / 3);
    const H = this.harm;
    for (let i = 0; i < H.length; i++) z += seam * H[i].a * Math.sin(H[i].w * u + (side < 0 ? H[i].pL : H[i].pR));
    return z;
  }

  /**
   * 轮胎印迹包络后的等效激励与斜率（5 次原始求值同时得到两者）。
   * 3 点加权平均 (¼,½,¼) 跨 ±80 mm ≈ 接地印迹低通。
   * out[0] = 等效高程 z_eff, out[1] = dz_eff/ds
   */
  sample(s, side, out) {
    const a = PATCH_A;
    const z0 = this.height(s - 2 * a, side);
    const z1 = this.height(s - a, side);
    const z2 = this.height(s, side);
    const z3 = this.height(s + a, side);
    const z4 = this.height(s + 2 * a, side);
    out[0] = 0.25 * z1 + 0.5 * z2 + 0.25 * z3;
    out[1] = (0.25 * z4 + 0.5 * z3 - 0.5 * z1 - 0.25 * z0) / (2 * a);
    return out;
  }

  /** 便捷：仅取包络高程 */
  sampleZ(s, side) { const o = _tmp; this.sample(s, side, o); return o[0]; }

  /** 当前里程附近的事件（HUD 提示 / 3D 标注） */
  nearestFeature(s, window = 8) {
    const L = this.length;
    let u = s % L; if (u < 0) u += L;
    let best = null, bd = Infinity;
    for (const f of this.course.features) {
      const c = f.s + f.len / 2;
      let d = u - c;
      if (d > L / 2) d -= L; if (d < -L / 2) d += L;
      const ad = Math.abs(d) - f.len / 2;
      if (ad < bd) { bd = ad; best = { f, dist: d, gap: ad }; }
    }
    return best && bd < window ? best : null;
  }
}
const _tmp = new Float64Array(2);
