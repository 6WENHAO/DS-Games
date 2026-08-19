/**
 * src/audio/audio.js
 * =============================================================================
 * CS:GO 风格网页 FPS —— 100% 程序化合成音效系统（Web Audio API）
 *
 * 设计约束：
 *   - 不加载任何素材（无 mp3 / wav / base64），所有声音由振荡器、噪声缓冲、
 *     滤波器、包络、波形整形器实时合成。
 *   - 顶层无副作用：import 时不创建 AudioContext，必须在首次用户手势中 init()。
 *   - 总线结构：source -> 音效增益 -> (panner) -> bus gain -> compressor
 *               -> master gain -> destination
 *
 * 合成积木（SynthCtx）：
 *   burst()      噪声脉冲（冲击瞬态 / crack / 嘶声）
 *   tone()       振荡器音（body / 下滑音 / 提示音）
 *   room()       房间尾音（噪声 + 反馈延迟）
 *   loopNoise()  持续噪声（风 / 烟雾 / 火焰）
 *   loopTone()   持续音（耳鸣 / 拆弹嗡嗡）
 *   lfo()        低频调制（颤音 / 阵风 / 火焰起伏）
 *   branch()     时间/音高偏移的子上下文（双枪、连击、多段脚步）
 * =============================================================================
 */

/* ===========================================================================
 * 0. 基础工具
 * ========================================================================= */

// 指数包络不允许到 0，用极小值收尾
const EPS = 0.0001;

// 内部伪随机（xorshift32）：不使用 Math.random，也不污染全局
let _rndState = 0x9e3779b9 >>> 0;

/** 内部随机数 [a,b) */
function rnd(a = 0, b = 1) {
  let x = _rndState;
  x ^= x << 13; x >>>= 0;
  x ^= x >>> 17;
  x ^= x << 5; x >>>= 0;
  _rndState = x;
  return a + (b - a) * (x / 4294967296);
}

/** 内部随机整数 [a,b] */
function rndi(a, b) {
  return Math.floor(rnd(a, b + 1 - 1e-9));
}

function clamp(v, lo, hi) {
  return v < lo ? lo : (v > hi ? hi : v);
}

function isFiniteNum(v) {
  return typeof v === 'number' && isFinite(v);
}

/* ===========================================================================
 * 1. 噪声缓冲：所有"噗/嘶/砰"的原料
 * ========================================================================= */

/**
 * 一次性生成整套噪声缓冲：
 *   white   —— 白噪声：瞬态冲击、crack、金属摩擦
 *   pink    —— 粉噪声：气声、布料、风的中层
 *   brown   —— 棕噪声：低频轰鸣、闷响、水声底噪
 *   crackle —— 稀疏冲激（每个冲激带指数尾巴）：火焰爆裂、碎石、玻璃碴
 *   metal   —— 不谐和衰减正弦叠加：金属"叮"、弹壳、护盾
 */
function makeNoiseBuffers(ctx) {
  const sr = ctx.sampleRate;
  const n = Math.max(1, Math.floor(sr * 3));

  // --- 白噪声 ---
  const white = ctx.createBuffer(1, n, sr);
  const w = white.getChannelData(0);
  for (let i = 0; i < n; i++) w[i] = rnd(-1, 1);

  // --- 粉噪声（Paul Kellet 近似滤波器）---
  const pink = ctx.createBuffer(1, n, sr);
  const p = pink.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < n; i++) {
    const v = w[i];
    b0 = 0.99886 * b0 + v * 0.0555179;
    b1 = 0.99332 * b1 + v * 0.0750759;
    b2 = 0.96900 * b2 + v * 0.1538520;
    b3 = 0.86650 * b3 + v * 0.3104856;
    b4 = 0.55000 * b4 + v * 0.5329522;
    b5 = -0.7616 * b5 - v * 0.0168980;
    p[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + v * 0.5362) * 0.15;
    b6 = v * 0.115926;
  }

  // --- 棕噪声（一阶积分 + 泄漏）---
  const brown = ctx.createBuffer(1, n, sr);
  const br = brown.getChannelData(0);
  let last = 0;
  for (let i = 0; i < n; i++) {
    last = (last + 0.02 * w[i]) * 0.998;
    br[i] = clamp(last * 9, -1, 1);
  }

  // --- 稀疏爆裂（火焰 / 碎石）---
  const crackle = ctx.createBuffer(1, n, sr);
  const cr = crackle.getChannelData(0);
  for (let i = 0; i < n; i++) cr[i] = 0;
  let idx = 0;
  while (idx < n) {
    idx += Math.floor(rnd(sr * 0.002, sr * 0.05));
    if (idx >= n) break;
    const amp = rnd(0.25, 1) * (rnd() < 0.12 ? 1 : 0.4);
    const tail = Math.floor(rnd(sr * 0.0008, sr * 0.006));
    for (let k = 0; k < tail && idx + k < n; k++) {
      cr[idx + k] += amp * Math.exp(-k / (tail * 0.35)) * rnd(-1, 1);
    }
  }

  // --- 金属激励（6 个不谐和分音，0.6s 内衰减）---
  const mLen = Math.max(1, Math.floor(sr * 0.6));
  const metal = ctx.createBuffer(1, mLen, sr);
  const me = metal.getChannelData(0);
  const partials = [1, 2.37, 3.41, 4.73, 6.11, 8.29];
  const base = 520;
  for (let i = 0; i < mLen; i++) {
    const t = i / sr;
    let v = 0;
    for (let k = 0; k < partials.length; k++) {
      v += Math.sin(2 * Math.PI * base * partials[k] * t) * Math.exp(-t * (14 + k * 9)) / (k + 1.5);
    }
    me[i] = clamp(v * 0.8, -1, 1);
  }

  return { white, pink, brown, crackle, metal };
}

/** 软削波曲线（WaveShaper）：amount 越大越"炸" */
function makeDriveCurve(amount) {
  const k = Math.max(0.0001, amount) * 30;
  const n = 1024;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
  }
  return curve;
}

/* ===========================================================================
 * 2. SynthCtx —— 单次发声的合成上下文
 *    所有音效函数都拿到一个 SynthCtx，用它的积木搭建声音；
 *    创建的节点自动登记，供 stop() / 回收使用。
 * ========================================================================= */

class SynthCtx {
  constructor(sys, dest, t0, rate, loop, shared) {
    this.sys = sys;
    this.ctx = sys.ctx;
    this.bufs = sys._noise;
    this.dest = dest;
    this.t0 = t0;
    this.rate = clamp(rate || 1, 0.2, 5);
    this.loop = !!loop;
    // 共享登记：branch() 出来的子上下文与父级共用节点表和结束时间
    this.shared = shared || { nodes: [], srcs: [], end: t0 };
  }

  get nodes() { return this.shared.nodes; }
  get srcs() { return this.shared.srcs; }

  /** 相对起始时间（时间轴随 rate 压缩：rate 越高节奏越快） */
  at(offset = 0) { return this.t0 + (offset || 0) / this.rate; }
  /** 时长缩放 */
  dur(sec) { return Math.max(0.001, (sec || 0) / this.rate); }
  /** 频率缩放 */
  frq(hz) { return Math.max(1, (hz || 1) * this.rate); }
  /** 记录本次发声的最晚结束时间 */
  mark(t) { if (!(t <= this.shared.end)) this.shared.end = t; return t; }

  /** 时间/音高偏移的子上下文（共享节点登记） */
  branch(offset = 0, rateMul = 1) {
    return new SynthCtx(this.sys, this.dest, this.at(offset), this.rate * rateMul, this.loop, this.shared);
  }

  keep(node) { this.shared.nodes.push(node); return node; }
  src(node) { this.shared.srcs.push(node); return this.keep(node); }

  gain(v = 1) {
    const g = this.ctx.createGain();
    g.gain.value = v;
    return this.keep(g);
  }

  bq(type, freq, q = 0.8) {
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = clamp(freq, 10, Math.min(20000, this.ctx.sampleRate * 0.48));
    f.Q.value = clamp(q, 0.0001, 40);
    return this.keep(f);
  }

  delayN(time = 0.05) {
    const d = this.ctx.createDelay(Math.max(0.02, time * 4 + 0.1));
    d.delayTime.value = Math.max(0.001, time);
    return this.keep(d);
  }

  shaper(amount = 0.4) {
    const sh = this.ctx.createWaveShaper();
    sh.curve = this.sys._curve(amount);
    sh.oversample = '2x';
    return this.keep(sh);
  }

  osc(type = 'sine', freq = 440) {
    const o = this.ctx.createOscillator();
    try { o.type = type; } catch (e) { o.type = 'sine'; }
    o.frequency.value = clamp(freq, 0.01, 20000);
    return this.src(o);
  }

  noise(kind = 'white', opts = {}) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.bufs[kind] || this.bufs.white;
    s.playbackRate.value = clamp((opts.rate == null ? 1 : opts.rate) * this.rate, 0.05, 8);
    s.loop = !!opts.loop;
    return this.src(s);
  }

  _pipe(a, b) { a.connect(b); return b; }

  /** 从缓冲随机位置起播，避免每次触发听起来完全一样 */
  startBuf(src, t, dur) {
    const buf = src.buffer;
    if (!buf) return t;
    const pr = clamp(src.playbackRate.value || 1, 0.05, 8);
    // offset/duration 都以缓冲自身的时间轴计量，所以要乘上播放速率
    const need = Math.max(0.005, dur) * pr;
    if (src.loop) {
      const off = buf.duration > 0.05 ? rnd(0, buf.duration * 0.5) : 0;
      src.loopStart = 0;
      src.loopEnd = buf.duration;
      try { src.start(t, off); } catch (e) { /* 已启动过则忽略 */ }
      return t;
    }
    const max = Math.max(0, buf.duration - need - 0.01);
    const off = max > 0.001 ? rnd(0, max) : 0;
    const avail = Math.max(0.005, buf.duration - off);
    try {
      if (need > avail) {
        // 需要的素材超过缓冲余量（超长尾音 / 低 rate）：改为循环取材，靠 stop() 收尾，
        // 否则尾巴会被硬生生截断成静音。
        src.loop = true;
        src.loopStart = 0;
        src.loopEnd = buf.duration;
        src.start(t, off);
      } else {
        src.start(t, off, Math.min(need + 0.02, avail));
      }
    } catch (e) { /* 已启动过则忽略 */ }
    return t;
  }

  /** 参数滑移（默认指数，遇到非正值自动退化为线性） */
  ramp(param, t, v0, v1, dur, kind = 'exp') {
    param.setValueAtTime(v0, t);
    const end = t + Math.max(0.002, dur);
    if (kind === 'exp' && v0 > 0 && v1 > 0) param.exponentialRampToValueAtTime(v1, end);
    else param.linearRampToValueAtTime(v1, end);
    return end;
  }

  /** AHD 包络：线性起攻 -> 保持 -> 指数衰减到 EPS，返回结束时间 */
  adsr(param, o) {
    const t = o.t;
    const peak = Math.max(EPS * 2, o.peak == null ? 0.5 : o.peak);
    const a = Math.max(0.0004, o.a == null ? 0.002 : o.a);
    const h = Math.max(0, o.h || 0);
    const d = Math.max(0.004, o.d == null ? 0.08 : o.d);
    param.setValueAtTime(EPS, t);
    param.linearRampToValueAtTime(peak, t + a);
    if (h > 0) param.setValueAtTime(peak, t + a + h);
    const end = t + a + h + d;
    if (o.curve === 'lin') param.linearRampToValueAtTime(EPS, end);
    else param.exponentialRampToValueAtTime(EPS, end);
    return end;
  }

  /**
   * 噪声脉冲。o: {kind, at, dur, type, freq, freqEnd, q, hp, g, a, h, curve, pr, drive, to}
   */
  burst(o = {}) {
    const t = this.at(o.at || 0);
    const d = this.dur(o.dur == null ? 0.05 : o.dur);
    const a = this.dur(o.a == null ? 0.0015 : o.a);
    const h = this.dur(o.h || 0);
    const src = this.noise(o.kind || 'white', { rate: o.pr || 1 });
    let node = src;
    if (o.type !== 'none') {
      const f = this.bq(o.type || 'lowpass', this.frq(o.freq == null ? 2000 : o.freq), o.q == null ? 0.9 : o.q);
      if (o.freqEnd != null) {
        this.ramp(f.frequency, t, this.frq(o.freq == null ? 2000 : o.freq), this.frq(o.freqEnd), a + h + d);
      }
      node = this._pipe(node, f);
    }
    if (o.hp) node = this._pipe(node, this.bq('highpass', this.frq(o.hp), 0.7));
    if (o.drive) node = this._pipe(node, this.shaper(o.drive));
    const g = this.gain(EPS);
    node.connect(g);
    g.connect(o.to || this.dest);
    const end = this.adsr(g.gain, { t, peak: o.g == null ? 0.5 : o.g, a, h, d, curve: o.curve });
    this.startBuf(src, t, a + h + d);
    try { src.stop(end + 0.02); } catch (e) { /* noop */ }
    return this.mark(end + 0.04);
  }

  /**
   * 振荡器音。o: {type, at, f0, f1, gt, glide, dur, g, a, h, curve, lp, lq, hp, drive, to}
   */
  tone(o = {}) {
    const t = this.at(o.at || 0);
    const d = this.dur(o.dur == null ? 0.1 : o.dur);
    const a = this.dur(o.a == null ? 0.003 : o.a);
    const h = this.dur(o.h || 0);
    const f0 = this.frq(o.f0 == null ? 200 : o.f0);
    const osc = this.osc(o.type || 'sine', f0);
    if (o.f1 != null) {
      this.ramp(osc.frequency, t, f0, this.frq(o.f1), (a + h + d) * (o.gt == null ? 1 : o.gt), o.glide || 'exp');
    }
    let node = osc;
    if (o.lp) node = this._pipe(node, this.bq('lowpass', this.frq(o.lp), o.lq == null ? 0.8 : o.lq));
    if (o.hp) node = this._pipe(node, this.bq('highpass', this.frq(o.hp), 0.7));
    if (o.drive) node = this._pipe(node, this.shaper(o.drive));
    const g = this.gain(EPS);
    node.connect(g);
    g.connect(o.to || this.dest);
    const end = this.adsr(g.gain, { t, peak: o.g == null ? 0.4 : o.g, a, h, d, curve: o.curve });
    osc.start(t);
    try { osc.stop(end + 0.03); } catch (e) { /* noop */ }
    return this.mark(end + 0.05);
  }

  /**
   * 房间尾音：一段带限噪声送进"延迟 + 阻尼反馈"网络，模拟枪声在场景里的反射。
   * o: {at, dur, kind, lp, hp, g, dly, fb, fbLp, to}
   */
  room(o = {}) {
    const t = this.at(o.at || 0);
    const d = this.dur(o.dur == null ? 0.25 : o.dur);
    const dly = clamp(o.dly == null ? 0.055 : o.dly, 0.005, 0.4);
    const fb = clamp(o.fb == null ? 0.3 : o.fb, 0, 0.8);
    const out = o.to || this.dest;
    const src = this.noise(o.kind || 'white', {});
    let node = this._pipe(src, this.bq('lowpass', this.frq(o.lp == null ? 3000 : o.lp), 0.7));
    node = this._pipe(node, this.bq('highpass', this.frq(o.hp == null ? 240 : o.hp), 0.7));
    const g = this.gain(EPS);
    node.connect(g);
    g.connect(out);
    // 反馈环：delay -> 阻尼低通 -> 反馈增益 -> delay（环内含延迟，合法）
    const dn = this.delayN(dly);
    const damp = this.bq('lowpass', this.frq(o.fbLp == null ? 2200 : o.fbLp), 0.7);
    const fbg = this.gain(fb);
    g.connect(dn);
    dn.connect(damp);
    damp.connect(fbg);
    fbg.connect(dn);
    dn.connect(out);
    const end = this.adsr(g.gain, { t, peak: o.g == null ? 0.3 : o.g, a: this.dur(0.006), h: this.dur(o.h || 0.008), d });
    this.startBuf(src, t, d + 0.05);
    try { src.stop(end + 0.03); } catch (e) { /* noop */ }
    return this.mark(end + dly * 8 + 0.15);
  }

  /**
   * 持续噪声层（loop）。life 为 null/Infinity 时无限延续，靠 stop() 收尾。
   * 返回 {gain, src} 便于挂 LFO。
   */
  loopNoise(o = {}) {
    const t = this.at(o.at || 0);
    const peak = Math.max(EPS * 2, o.g == null ? 0.2 : o.g);
    const a = this.dur(o.a == null ? 0.08 : o.a);
    const src = this.noise(o.kind || 'white', { rate: o.pr || 1, loop: true });
    let node = src;
    if (o.type) node = this._pipe(node, this.bq(o.type, this.frq(o.freq == null ? 1200 : o.freq), o.q == null ? 0.8 : o.q));
    if (o.hp) node = this._pipe(node, this.bq('highpass', this.frq(o.hp), 0.7));
    if (o.lp) node = this._pipe(node, this.bq('lowpass', this.frq(o.lp), 0.7));
    if (o.drive) node = this._pipe(node, this.shaper(o.drive));
    const g = this.gain(EPS);
    node.connect(g);
    g.connect(o.to || this.dest);
    g.gain.setValueAtTime(EPS, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    this.startBuf(src, t, 0);
    if (isFiniteNum(o.life)) {
      const life = this.dur(o.life);
      const rel = this.dur(o.rel == null ? 0.3 : o.rel);
      g.gain.setValueAtTime(peak, t + a + life);
      g.gain.exponentialRampToValueAtTime(EPS, t + a + life + rel);
      try { src.stop(t + a + life + rel + 0.03); } catch (e) { /* noop */ }
      this.mark(t + a + life + rel + 0.06);
    } else {
      this.mark(Infinity);
    }
    return { gain: g, src, node };
  }

  /** 持续振荡音（loop）。返回 {gain, osc} */
  loopTone(o = {}) {
    const t = this.at(o.at || 0);
    const peak = Math.max(EPS * 2, o.g == null ? 0.15 : o.g);
    const a = this.dur(o.a == null ? 0.12 : o.a);
    const f0 = this.frq(o.f0 == null ? 440 : o.f0);
    const osc = this.osc(o.type || 'sine', f0);
    let node = osc;
    if (o.lp) node = this._pipe(node, this.bq('lowpass', this.frq(o.lp), o.lq == null ? 0.8 : o.lq));
    if (o.hp) node = this._pipe(node, this.bq('highpass', this.frq(o.hp), 0.7));
    if (o.drive) node = this._pipe(node, this.shaper(o.drive));
    const g = this.gain(EPS);
    node.connect(g);
    g.connect(o.to || this.dest);
    g.gain.setValueAtTime(EPS, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    osc.start(t);
    if (isFiniteNum(o.life)) {
      const life = this.dur(o.life);
      const rel = this.dur(o.rel == null ? 0.3 : o.rel);
      g.gain.setValueAtTime(peak, t + a + life);
      g.gain.exponentialRampToValueAtTime(EPS, t + a + life + rel);
      try { osc.stop(t + a + life + rel + 0.03); } catch (e) { /* noop */ }
      this.mark(t + a + life + rel + 0.06);
    } else {
      this.mark(Infinity);
    }
    return { gain: g, osc };
  }

  /** 低频调制：把一个振荡器接到任意 AudioParam 上（颤音、阵风、火焰起伏） */
  lfo(o = {}) {
    if (!o.target) return null;
    const t = this.at(o.at || 0);
    const osc = this.osc(o.type || 'sine', Math.max(0.01, o.f == null ? 5 : o.f));
    const g = this.gain(o.depth == null ? 1 : o.depth);
    osc.connect(g);
    g.connect(o.target);
    osc.start(t);
    if (isFiniteNum(o.life)) {
      try { osc.stop(t + this.dur(o.life) + 0.05); } catch (e) { /* noop */ }
    }
    return { osc, gain: g };
  }
}

/* ===========================================================================
 * 3. 公共小积木
 * ========================================================================= */

/** 机械"咔嗒"：极短高 Q 带通噪声 + 更高一层的金属边缘 */
function mechClick(s, at, f, g, dur) {
  const d = dur == null ? 0.012 : dur;
  s.burst({ kind: 'white', type: 'bandpass', freq: f, q: 7, dur: d, g: g, a: 0.0005, at: at });
  s.burst({ kind: 'white', type: 'highpass', freq: f * 2.2, dur: d * 0.6, g: g * 0.45, a: 0.0005, at: at + 0.0015 });
}

/** 金属共鸣"叮"：metal 缓冲（不谐和分音）过高 Q 带通 */
function metalRing(s, o) {
  s.burst({
    kind: 'metal', type: 'bandpass', freq: o.f == null ? 1800 : o.f, q: o.q == null ? 8 : o.q,
    dur: o.dur == null ? 0.18 : o.dur, g: o.g == null ? 0.3 : o.g, a: 0.0008,
    at: o.at || 0, pr: o.pr == null ? 1 : o.pr, to: o.to
  });
}

/** 布料/装备摩擦：粉噪声过带通，起攻较软 */
function cloth(s, at, dur, g, freq) {
  s.burst({ kind: 'pink', type: 'bandpass', freq: freq || 1400, q: 0.6, dur: dur || 0.09, g: g == null ? 0.16 : g, a: 0.012, at: at || 0 });
}

/** 短促提示音（UI/电子设备） */
function blip(s, o) {
  s.tone({
    type: o.type || 'square', f0: o.f0, f1: o.f1 == null ? null : o.f1, dur: o.dur == null ? 0.05 : o.dur,
    g: o.g == null ? 0.22 : o.g, a: o.a == null ? 0.002 : o.a, h: o.h == null ? 0.01 : o.h,
    lp: o.lp == null ? 6000 : o.lp, at: o.at || 0
  });
}

/** 爆炸通用体：低频冲击 + 长噪声尾 + 削波失真 + 碎屑 */
function explosion(s, o) {
  const k = o.scale == null ? 1 : o.scale;
  const vol = o.g == null ? 1 : o.g;
  // 冲击瞬态：宽带低通噪声，强削波
  s.burst({ kind: 'white', type: 'lowpass', freq: 3000 * k, dur: 0.055 / k, g: 1.0 * vol, a: 0.0008, drive: 0.85 });
  // 30–60Hz 低频冲击（两层，微错开以获得"推力"）
  s.tone({ type: 'sine', f0: o.sub == null ? 58 : o.sub, f1: (o.sub == null ? 58 : o.sub) * 0.52, dur: 0.7 * k, g: 1.05 * vol, a: 0.004, drive: 0.5 });
  s.tone({ type: 'sine', f0: (o.sub == null ? 58 : o.sub) * 0.68, f1: 26, dur: 1.15 * k, g: 0.75 * vol, a: 0.012, at: 0.02 });
  // 长尾噪声：截止频率从亮到暗扫下去，像声音被空气吞掉
  s.burst({ kind: 'brown', type: 'lowpass', freq: 2400, freqEnd: 240, q: 0.6, dur: 1.0 * k, g: 0.62 * vol, a: 0.01, at: 0.01, drive: 0.45 });
  s.burst({ kind: 'pink', type: 'bandpass', freq: 900, q: 0.5, dur: 0.75 * k, g: 0.3 * vol, a: 0.02, at: 0.03 });
  // 碎屑 / 回落
  s.burst({ kind: 'crackle', type: 'bandpass', freq: 1600, q: 0.9, dur: 0.8 * k, g: 0.26 * vol, a: 0.05, at: 0.07 });
  // 大空间反射
  s.room({ at: 0.03, dur: 0.9 * k, kind: 'brown', lp: 1500, hp: 90, g: 0.3 * vol, dly: 0.12 * k, fb: 0.5 });
}

/* ===========================================================================
 * 4. 枪声：参数表 + 分层引擎
 *
 * 每一枪都由 5 层叠出来，参数表让不同枪差异明显：
 *   tr  冲击瞬态：短促指数衰减的低通噪声（枪口膨胀波）
 *   bd  音调 body：快速下滑的三角/方波/锯齿（腔体与口径感）
 *   sb  亚低频推力：正弦下滑（后坐"顶胸口"的部分）
 *   ck  高频 crack：1–4kHz 带通噪声（弹头激波，决定"脆不脆"）
 *   tl  房间尾音：带限噪声 + 反馈延迟（决定"远不远/闷不闷"）
 *   mech 机械声：枪机/套筒的咔嗒（消音器与手枪尤其明显）
 *   fam  族层：为每类武器再加专属细节（见 GUN_FAMILY）
 * ========================================================================= */

const GUN_TONES = {
  /* --- 步枪：厚 body + 明显 crack --- */
  fire_ak47: {
    fam: 'rifle', vol: 1.00, drive: 0.55, mech: 1.0,
    tr: { dur: 0.030, lp: 2400, g: 1.00 }, bd: { type: 'triangle', f0: 195, f1: 58, dur: 0.090, g: 0.95 },
    sb: { f0: 80, f1: 42, dur: 0.150, g: 0.65 }, ck: { f: 2150, q: 1.0, dur: 0.055, g: 0.60 },
    tl: { dur: 0.32, lp: 3000, hp: 260, g: 0.34, fb: 0.30, dly: 0.055 }
  },
  fire_m4a4: {
    fam: 'rifle', vol: 0.95, drive: 0.42, mech: 0.9,
    tr: { dur: 0.024, lp: 3200, g: 0.92 }, bd: { type: 'sawtooth', f0: 240, f1: 70, dur: 0.070, g: 0.80 },
    sb: { f0: 92, f1: 48, dur: 0.120, g: 0.50 }, ck: { f: 2900, q: 1.2, dur: 0.045, g: 0.66 },
    tl: { dur: 0.26, lp: 3800, hp: 320, g: 0.30, fb: 0.26, dly: 0.048 }
  },
  fire_galil: {
    fam: 'rifle', vol: 0.92, drive: 0.48, mech: 1.1,
    tr: { dur: 0.028, lp: 2700, g: 0.94 }, bd: { type: 'triangle', f0: 210, f1: 64, dur: 0.080, g: 0.86 },
    sb: { f0: 86, f1: 46, dur: 0.130, g: 0.56 }, ck: { f: 2400, q: 1.4, dur: 0.050, g: 0.55 },
    tl: { dur: 0.28, lp: 3200, hp: 280, g: 0.32, fb: 0.28, dly: 0.052 }
  },
  fire_famas: {
    fam: 'rifle', vol: 0.88, drive: 0.40, mech: 1.2,
    tr: { dur: 0.022, lp: 3400, g: 0.86 }, bd: { type: 'sawtooth', f0: 265, f1: 86, dur: 0.060, g: 0.74 },
    sb: { f0: 100, f1: 54, dur: 0.100, g: 0.42 }, ck: { f: 3200, q: 1.6, dur: 0.040, g: 0.62 },
    tl: { dur: 0.22, lp: 4200, hp: 380, g: 0.27, fb: 0.24, dly: 0.042 }
  },
  fire_aug: {
    fam: 'rifle', vol: 0.94, drive: 0.45, mech: 0.8,
    tr: { dur: 0.026, lp: 3000, g: 0.92 }, bd: { type: 'triangle', f0: 225, f1: 72, dur: 0.075, g: 0.82 },
    sb: { f0: 88, f1: 46, dur: 0.120, g: 0.50 }, ck: { f: 2650, q: 1.1, dur: 0.048, g: 0.58 },
    tl: { dur: 0.27, lp: 3400, hp: 300, g: 0.30, fb: 0.27, dly: 0.050 }
  },
  fire_sg553: {
    fam: 'rifle', vol: 0.98, drive: 0.50, mech: 0.9,
    tr: { dur: 0.030, lp: 2600, g: 0.97 }, bd: { type: 'triangle', f0: 205, f1: 60, dur: 0.085, g: 0.90 },
    sb: { f0: 82, f1: 44, dur: 0.140, g: 0.60 }, ck: { f: 2300, q: 1.0, dur: 0.052, g: 0.57 },
    tl: { dur: 0.30, lp: 3100, hp: 270, g: 0.33, fb: 0.29, dly: 0.054 }
  },

  /* --- 狙击枪：更沉、更长、回声更远 --- */
  fire_awp: {
    fam: 'sniper', vol: 1.15, drive: 0.65, mech: 0.5,
    tr: { dur: 0.045, lp: 1900, g: 1.10 }, bd: { type: 'triangle', f0: 150, f1: 40, dur: 0.160, g: 1.00 },
    sb: { f0: 58, f1: 28, dur: 0.400, g: 0.90 }, ck: { f: 1500, q: 0.8, dur: 0.090, g: 0.50 },
    tl: { dur: 0.70, lp: 2200, hp: 140, g: 0.42, fb: 0.45, dly: 0.090 }
  },
  fire_ssg08: {
    fam: 'sniper', vol: 1.00, drive: 0.55, mech: 0.6,
    tr: { dur: 0.034, lp: 2400, g: 1.00 }, bd: { type: 'triangle', f0: 175, f1: 52, dur: 0.110, g: 0.92 },
    sb: { f0: 66, f1: 34, dur: 0.260, g: 0.70 }, ck: { f: 2000, q: 1.0, dur: 0.070, g: 0.55 },
    tl: { dur: 0.50, lp: 2800, hp: 190, g: 0.34, fb: 0.38, dly: 0.075 }
  },
  fire_scar20: {
    fam: 'sniper', vol: 1.05, drive: 0.58, mech: 1.4,
    tr: { dur: 0.038, lp: 2100, g: 1.02 }, bd: { type: 'sawtooth', f0: 160, f1: 48, dur: 0.130, g: 0.94 },
    sb: { f0: 60, f1: 32, dur: 0.300, g: 0.80 }, ck: { f: 1800, q: 0.9, dur: 0.075, g: 0.50 },
    tl: { dur: 0.55, lp: 2500, hp: 165, g: 0.36, fb: 0.40, dly: 0.082 }
  },
  fire_g3sg1: {
    fam: 'sniper', vol: 1.02, drive: 0.56, mech: 1.6,
    tr: { dur: 0.036, lp: 2300, g: 1.00 }, bd: { type: 'triangle', f0: 168, f1: 52, dur: 0.120, g: 0.92 },
    sb: { f0: 64, f1: 34, dur: 0.280, g: 0.74 }, ck: { f: 1950, q: 1.1, dur: 0.070, g: 0.52 },
    tl: { dur: 0.50, lp: 2600, hp: 175, g: 0.35, fb: 0.39, dly: 0.078 }
  },

  /* --- 冲锋枪：更脆、更短、尾音很少 --- */
  fire_mp9: {
    fam: 'smg', vol: 0.80, drive: 0.35, mech: 1.0,
    tr: { dur: 0.016, lp: 3600, g: 0.78 }, bd: { type: 'square', f0: 300, f1: 110, dur: 0.040, g: 0.60 },
    sb: { f0: 120, f1: 70, dur: 0.060, g: 0.30 }, ck: { f: 3600, q: 1.6, dur: 0.030, g: 0.55 },
    tl: { dur: 0.16, lp: 4600, hp: 420, g: 0.22, fb: 0.20, dly: 0.036 }
  },
  fire_mac10: {
    fam: 'smg', vol: 0.85, drive: 0.40, mech: 1.5,
    tr: { dur: 0.018, lp: 3000, g: 0.82 }, bd: { type: 'square', f0: 260, f1: 95, dur: 0.045, g: 0.66 },
    sb: { f0: 105, f1: 60, dur: 0.070, g: 0.35 }, ck: { f: 3100, q: 1.4, dur: 0.034, g: 0.50 },
    tl: { dur: 0.18, lp: 4000, hp: 380, g: 0.24, fb: 0.22, dly: 0.040 }
  },
  fire_mp7: {
    fam: 'smg', vol: 0.80, drive: 0.34, mech: 0.9,
    tr: { dur: 0.015, lp: 3800, g: 0.76 }, bd: { type: 'triangle', f0: 320, f1: 120, dur: 0.038, g: 0.58 },
    sb: { f0: 130, f1: 75, dur: 0.055, g: 0.28 }, ck: { f: 3900, q: 1.8, dur: 0.028, g: 0.52 },
    tl: { dur: 0.15, lp: 5000, hp: 460, g: 0.21, fb: 0.19, dly: 0.034 }
  },
  fire_ump45: {
    fam: 'smg', vol: 0.92, drive: 0.44, mech: 1.2,
    tr: { dur: 0.024, lp: 2500, g: 0.90 }, bd: { type: 'triangle', f0: 220, f1: 80, dur: 0.060, g: 0.76 },
    sb: { f0: 92, f1: 52, dur: 0.100, g: 0.45 }, ck: { f: 2500, q: 1.2, dur: 0.042, g: 0.50 },
    tl: { dur: 0.22, lp: 3300, hp: 320, g: 0.26, fb: 0.25, dly: 0.046 }
  },
  fire_p90: {
    fam: 'smg', vol: 0.82, drive: 0.36, mech: 0.8,
    tr: { dur: 0.016, lp: 3400, g: 0.80 }, bd: { type: 'sawtooth', f0: 290, f1: 105, dur: 0.040, g: 0.62 },
    sb: { f0: 115, f1: 66, dur: 0.060, g: 0.30 }, ck: { f: 3400, q: 2.0, dur: 0.030, g: 0.58 },
    tl: { dur: 0.17, lp: 4700, hp: 430, g: 0.22, fb: 0.21, dly: 0.038 }
  },
  fire_bizon: {
    fam: 'smg', vol: 0.78, drive: 0.32, mech: 1.3,
    tr: { dur: 0.020, lp: 2200, g: 0.74 }, bd: { type: 'triangle', f0: 250, f1: 92, dur: 0.048, g: 0.60 },
    sb: { f0: 100, f1: 58, dur: 0.080, g: 0.36 }, ck: { f: 2100, q: 1.2, dur: 0.036, g: 0.42 },
    tl: { dur: 0.19, lp: 2600, hp: 300, g: 0.23, fb: 0.22, dly: 0.042 }
  },

  /* --- 霰弹枪：更宽更闷，多颗弹丸 --- */
  fire_nova: {
    fam: 'shotgun', vol: 1.05, drive: 0.50, mech: 0.7,
    tr: { dur: 0.050, lp: 1500, g: 1.00 }, bd: { type: 'triangle', f0: 120, f1: 46, dur: 0.120, g: 0.90 },
    sb: { f0: 60, f1: 30, dur: 0.220, g: 0.70 }, ck: { f: 1200, q: 0.6, dur: 0.070, g: 0.35 },
    tl: { dur: 0.38, lp: 1800, hp: 150, g: 0.34, fb: 0.32, dly: 0.070 }
  },
  fire_xm1014: {
    fam: 'shotgun', vol: 1.00, drive: 0.46, mech: 1.0,
    tr: { dur: 0.045, lp: 1800, g: 0.96 }, bd: { type: 'triangle', f0: 135, f1: 52, dur: 0.100, g: 0.86 },
    sb: { f0: 66, f1: 34, dur: 0.180, g: 0.62 }, ck: { f: 1500, q: 0.7, dur: 0.060, g: 0.40 },
    tl: { dur: 0.32, lp: 2100, hp: 170, g: 0.31, fb: 0.30, dly: 0.064 }
  },
  fire_mag7: {
    fam: 'shotgun', vol: 1.00, drive: 0.48, mech: 0.9,
    tr: { dur: 0.042, lp: 1600, g: 0.98 }, bd: { type: 'triangle', f0: 128, f1: 50, dur: 0.095, g: 0.88 },
    sb: { f0: 62, f1: 32, dur: 0.170, g: 0.64 }, ck: { f: 1350, q: 0.7, dur: 0.055, g: 0.36 },
    tl: { dur: 0.28, lp: 1900, hp: 165, g: 0.30, fb: 0.29, dly: 0.060 }
  },
  fire_sawedoff: {
    fam: 'shotgun', vol: 1.08, drive: 0.54, mech: 0.6,
    tr: { dur: 0.055, lp: 1200, g: 1.05 }, bd: { type: 'triangle', f0: 108, f1: 40, dur: 0.130, g: 0.94 },
    sb: { f0: 54, f1: 26, dur: 0.250, g: 0.75 }, ck: { f: 1000, q: 0.5, dur: 0.075, g: 0.30 },
    tl: { dur: 0.40, lp: 1500, hp: 130, g: 0.36, fb: 0.34, dly: 0.076 }
  },

  /* --- 机枪：厚重 + 供弹机构抖动 --- */
  fire_m249: {
    fam: 'mg', vol: 1.00, drive: 0.52, mech: 1.6,
    tr: { dur: 0.030, lp: 2600, g: 0.98 }, bd: { type: 'triangle', f0: 185, f1: 56, dur: 0.085, g: 0.92 },
    sb: { f0: 76, f1: 40, dur: 0.160, g: 0.62 }, ck: { f: 2200, q: 1.0, dur: 0.050, g: 0.55 },
    tl: { dur: 0.30, lp: 3000, hp: 250, g: 0.32, fb: 0.30, dly: 0.056 }
  },
  fire_negev: {
    fam: 'mg', vol: 0.98, drive: 0.50, mech: 1.9,
    tr: { dur: 0.026, lp: 2800, g: 0.94 }, bd: { type: 'sawtooth', f0: 200, f1: 62, dur: 0.075, g: 0.88 },
    sb: { f0: 82, f1: 44, dur: 0.140, g: 0.58 }, ck: { f: 2500, q: 1.2, dur: 0.045, g: 0.58 },
    tl: { dur: 0.26, lp: 3300, hp: 280, g: 0.30, fb: 0.28, dly: 0.050 }
  },

  /* --- 手枪：短、套筒咔嗒明显 --- */
  fire_glock18: {
    fam: 'pistol', vol: 0.72, drive: 0.35, mech: 1.0,
    tr: { dur: 0.018, lp: 3000, g: 0.72 }, bd: { type: 'square', f0: 280, f1: 100, dur: 0.042, g: 0.56 },
    sb: { f0: 110, f1: 62, dur: 0.070, g: 0.30 }, ck: { f: 3000, q: 1.5, dur: 0.030, g: 0.50 },
    tl: { dur: 0.16, lp: 3800, hp: 400, g: 0.20, fb: 0.18, dly: 0.036 }
  },
  fire_p2000: {
    fam: 'pistol', vol: 0.76, drive: 0.36, mech: 1.1,
    tr: { dur: 0.020, lp: 2800, g: 0.74 }, bd: { type: 'triangle', f0: 250, f1: 92, dur: 0.048, g: 0.60 },
    sb: { f0: 100, f1: 56, dur: 0.080, g: 0.32 }, ck: { f: 2700, q: 1.3, dur: 0.034, g: 0.50 },
    tl: { dur: 0.18, lp: 3500, hp: 380, g: 0.21, fb: 0.20, dly: 0.038 }
  },
  fire_p250: {
    fam: 'pistol', vol: 0.80, drive: 0.38, mech: 1.0,
    tr: { dur: 0.022, lp: 2600, g: 0.78 }, bd: { type: 'triangle', f0: 235, f1: 86, dur: 0.052, g: 0.64 },
    sb: { f0: 96, f1: 54, dur: 0.090, g: 0.35 }, ck: { f: 2500, q: 1.2, dur: 0.038, g: 0.50 },
    tl: { dur: 0.19, lp: 3200, hp: 350, g: 0.22, fb: 0.21, dly: 0.040 }
  },
  fire_deagle: {
    fam: 'pistol', vol: 1.10, drive: 0.60, mech: 1.4,
    tr: { dur: 0.034, lp: 2000, g: 1.05 }, bd: { type: 'triangle', f0: 165, f1: 52, dur: 0.100, g: 0.95 },
    sb: { f0: 62, f1: 32, dur: 0.240, g: 0.75 }, ck: { f: 1900, q: 0.9, dur: 0.060, g: 0.55 },
    tl: { dur: 0.34, lp: 2600, hp: 200, g: 0.32, fb: 0.34, dly: 0.066 }
  },
  fire_r8: {
    fam: 'revolver', vol: 1.05, drive: 0.56, mech: 1.2,
    tr: { dur: 0.032, lp: 2100, g: 1.00 }, bd: { type: 'triangle', f0: 175, f1: 56, dur: 0.095, g: 0.92 },
    sb: { f0: 66, f1: 34, dur: 0.220, g: 0.70 }, ck: { f: 2050, q: 1.0, dur: 0.058, g: 0.52 },
    tl: { dur: 0.32, lp: 2700, hp: 210, g: 0.31, fb: 0.33, dly: 0.062 }
  },
  fire_dualberettas: {
    fam: 'pistol', vol: 0.70, drive: 0.34, mech: 0.9, dual: 0.055,
    tr: { dur: 0.018, lp: 2900, g: 0.70 }, bd: { type: 'square', f0: 270, f1: 98, dur: 0.044, g: 0.54 },
    sb: { f0: 106, f1: 60, dur: 0.070, g: 0.28 }, ck: { f: 2850, q: 1.4, dur: 0.032, g: 0.48 },
    tl: { dur: 0.16, lp: 3600, hp: 390, g: 0.19, fb: 0.18, dly: 0.036 }
  },
  fire_fiveseven: {
    fam: 'pistol', vol: 0.74, drive: 0.33, mech: 1.0,
    tr: { dur: 0.017, lp: 3200, g: 0.72 }, bd: { type: 'square', f0: 300, f1: 108, dur: 0.040, g: 0.56 },
    sb: { f0: 112, f1: 64, dur: 0.065, g: 0.28 }, ck: { f: 3300, q: 1.6, dur: 0.028, g: 0.52 },
    tl: { dur: 0.15, lp: 4200, hp: 430, g: 0.20, fb: 0.18, dly: 0.034 }
  },
  fire_tec9: {
    fam: 'pistol', vol: 0.80, drive: 0.40, mech: 1.4,
    tr: { dur: 0.020, lp: 2900, g: 0.78 }, bd: { type: 'sawtooth', f0: 265, f1: 95, dur: 0.046, g: 0.62 },
    sb: { f0: 104, f1: 58, dur: 0.080, g: 0.33 }, ck: { f: 2800, q: 1.3, dur: 0.034, g: 0.54 },
    tl: { dur: 0.18, lp: 3700, hp: 370, g: 0.22, fb: 0.20, dly: 0.038 }
  },
  fire_cz75: {
    fam: 'pistol', vol: 0.78, drive: 0.36, mech: 1.1,
    tr: { dur: 0.018, lp: 3050, g: 0.76 }, bd: { type: 'square', f0: 290, f1: 104, dur: 0.042, g: 0.58 },
    sb: { f0: 108, f1: 60, dur: 0.070, g: 0.30 }, ck: { f: 3050, q: 1.5, dur: 0.030, g: 0.50 },
    tl: { dur: 0.17, lp: 3900, hp: 400, g: 0.21, fb: 0.19, dly: 0.036 }
  },

  /* --- 消音器版本：明显更小更钝，crack 几乎消失，机械声突出 --- */
  fire_m4a1s: {
    fam: 'silenced', vol: 0.62, drive: 0.18, mech: 1.8,
    tr: { dur: 0.026, lp: 1500, g: 0.60 }, bd: { type: 'triangle', f0: 175, f1: 70, dur: 0.060, g: 0.45 },
    sb: { f0: 85, f1: 48, dur: 0.090, g: 0.26 }, ck: { f: 1700, q: 1.0, dur: 0.026, g: 0.16 },
    tl: { dur: 0.16, lp: 2000, hp: 220, g: 0.16, fb: 0.14, dly: 0.030 }
  },
  fire_usp_s: {
    fam: 'silenced', vol: 0.55, drive: 0.15, mech: 2.0,
    tr: { dur: 0.022, lp: 1200, g: 0.52 }, bd: { type: 'triangle', f0: 190, f1: 80, dur: 0.050, g: 0.40 },
    sb: { f0: 90, f1: 50, dur: 0.070, g: 0.22 }, ck: { f: 1400, q: 1.0, dur: 0.020, g: 0.12 },
    tl: { dur: 0.12, lp: 1600, hp: 240, g: 0.12, fb: 0.10, dly: 0.026 }
  },
  fire_mp5sd: {
    fam: 'silenced', vol: 0.58, drive: 0.16, mech: 1.9,
    tr: { dur: 0.020, lp: 1300, g: 0.55 }, bd: { type: 'triangle', f0: 200, f1: 84, dur: 0.050, g: 0.40 },
    sb: { f0: 95, f1: 54, dur: 0.070, g: 0.22 }, ck: { f: 1500, q: 1.1, dur: 0.022, g: 0.14 },
    tl: { dur: 0.13, lp: 1700, hp: 230, g: 0.13, fb: 0.12, dly: 0.028 }
  }
};

/** 族层：在共同 5 层之上，为每类武器补上"辨识指纹" */
const GUN_FAMILY = {
  // 步枪：导气管的尖锐"嘶" + 稍晚的枪机复进
  rifle(s, t, vol) {
    s.burst({ kind: 'white', type: 'bandpass', freq: 5200, q: 2.2, dur: 0.035, g: 0.16 * vol, a: 0.001, at: 0.004 });
    mechClick(s, 0.026 + rnd(0, 0.008), 3200, 0.10 * vol * (t.mech || 1), 0.010);
  },
  // 狙击：二次深冲击 + 远距离双反射，尾巴拖得最长
  sniper(s, t, vol) {
    s.tone({ type: 'sine', f0: 46, f1: 30, dur: 0.42, g: 0.50 * vol, a: 0.008, at: 0.012 });
    s.burst({ kind: 'brown', type: 'bandpass', freq: 1100, q: 0.7, dur: 0.30, g: 0.20 * vol, a: 0.02, at: 0.02 });
    s.room({ at: 0.05, dur: 0.55, kind: 'pink', lp: 1800, hp: 120, g: 0.20 * vol, dly: 0.115, fb: 0.44 });
  },
  // 冲锋枪：6kHz 以上的"啪" + 轻快枪机，尾音极少
  smg(s, t, vol) {
    s.burst({ kind: 'white', type: 'highpass', freq: 6200, dur: 0.018, g: 0.26 * vol, a: 0.0006 });
    mechClick(s, 0.015, 4200, 0.15 * vol * (t.mech || 1), 0.008);
  },
  // 霰弹枪：3 层错开的宽带弹丸散射 + 闷厚低频
  shotgun(s, t, vol) {
    for (let i = 0; i < 3; i++) {
      s.burst({
        kind: 'white', type: 'lowpass', freq: 1300 + i * 480, q: 0.6, dur: 0.06 + i * 0.02,
        g: (0.42 - i * 0.10) * vol, a: 0.0012, at: 0.002 + i * 0.007, drive: 0.30
      });
    }
    s.tone({ type: 'sine', f0: 62, f1: 34, dur: 0.26, g: 0.50 * vol, a: 0.006, at: 0.006 });
    mechClick(s, 0.03, 1800, 0.10 * vol * (t.mech || 1), 0.016);
  },
  // 机枪：弹链/供弹的金属抖动（两三下随机金属声）
  mg(s, t, vol) {
    const m = t.mech || 1;
    metalRing(s, { f: 2400, q: 6, dur: 0.07, g: 0.10 * vol * m, at: 0.012, pr: 1.4 });
    mechClick(s, 0.020, 3400, 0.12 * vol * m, 0.010);
    mechClick(s, 0.040 + rnd(0, 0.01), 2600, 0.09 * vol * m, 0.012);
  },
  // 手枪：套筒往复的两段咔嗒最有辨识度
  pistol(s, t, vol) {
    const m = t.mech || 1;
    mechClick(s, 0.018, 3000, 0.18 * vol * m, 0.012);
    mechClick(s, 0.040 + rnd(0, 0.008), 2300, 0.13 * vol * m, 0.014);
  },
  // 转轮：击锤 + 转轮腔体的金属余韵
  revolver(s, t, vol) {
    metalRing(s, { f: 1750, q: 10, dur: 0.20, g: 0.16 * vol, at: 0.004, pr: 0.9 });
    mechClick(s, 0.0, 2200, 0.14 * vol * (t.mech || 1), 0.014);
  },
  // 消音：低频"噗"取代 crack，机械动作反而成为主角
  silenced(s, t, vol) {
    const m = t.mech || 1;
    s.burst({ kind: 'brown', type: 'lowpass', freq: 700, dur: 0.09, g: 0.34 * vol, a: 0.004, at: 0.002 });
    s.burst({ kind: 'pink', type: 'bandpass', freq: 480, q: 0.8, dur: 0.05, g: 0.18 * vol, a: 0.006 });
    mechClick(s, 0.012, 2600, 0.28 * vol * m, 0.014);
    mechClick(s, 0.034, 2000, 0.20 * vol * m, 0.016);
  }
};

/** 枪声引擎：按参数表把 5 层叠起来，再交给族层加指纹 */
function synthGun(s, tone, isEcho) {
  const vol = tone.vol == null ? 1 : tone.vol;
  const drive = tone.drive || 0;
  // 1) 冲击瞬态
  if (tone.tr) {
    s.burst({
      kind: 'white', type: 'lowpass', freq: tone.tr.lp, q: 0.9, dur: tone.tr.dur,
      g: tone.tr.g * vol, a: 0.0006, drive: drive
    });
  }
  // 2) 音调 body（快速下滑，决定口径与腔体）
  if (tone.bd) {
    s.tone({
      type: tone.bd.type, f0: tone.bd.f0 * rnd(0.985, 1.015), f1: tone.bd.f1, dur: tone.bd.dur,
      g: tone.bd.g * vol, a: 0.001, gt: 0.7, lp: tone.bd.f0 * 9, drive: drive * 0.7
    });
  }
  // 3) 亚低频推力
  if (tone.sb) {
    s.tone({ type: 'sine', f0: tone.sb.f0, f1: tone.sb.f1, dur: tone.sb.dur, g: tone.sb.g * vol, a: 0.004 });
  }
  // 4) 高频 crack（1–4kHz 带通噪声）
  if (tone.ck) {
    s.burst({
      kind: 'white', type: 'bandpass', freq: tone.ck.f * rnd(0.96, 1.04), q: tone.ck.q, dur: tone.ck.dur,
      g: tone.ck.g * vol, a: 0.0008, at: 0.0015
    });
  }
  // 5) 房间尾音
  if (tone.tl) {
    s.room({
      at: 0.004, dur: tone.tl.dur, kind: 'white', lp: tone.tl.lp, hp: tone.tl.hp,
      g: tone.tl.g * vol, dly: tone.tl.dly, fb: tone.tl.fb
    });
  }
  // 6) 族层指纹
  const fam = GUN_FAMILY[tone.fam];
  if (fam) fam(s, tone, vol);
  // 7) 双枪：极近的第二发，音高略偏
  if (tone.dual && !isEcho) {
    synthGun(s.branch(tone.dual + rnd(0, 0.018), rnd(1.01, 1.05)), tone, true);
  }
}

/* ===========================================================================
 * 5. 脚步材质表
 * ========================================================================= */

const STEP_MATS = {
  // lp/hp 决定材质亮度，grains 决定颗粒感，ring 给金属共鸣，tone 给木/混凝土的实心感
  concrete: { kind: 'white', lp: 3200, hp: 260, dur: 0.050, g: 0.50, q: 0.9, tone: 190, toneG: 0.16, grains: 1, drive: 0.12 },
  dirt: { kind: 'brown', lp: 1500, hp: 110, dur: 0.070, g: 0.44, q: 0.7, tone: 105, toneG: 0.10, grains: 1 },
  metal: { kind: 'white', lp: 5400, hp: 700, dur: 0.045, g: 0.40, q: 1.2, ring: 1450, ringG: 0.22, grains: 1 },
  wood: { kind: 'white', lp: 2400, hp: 200, dur: 0.055, g: 0.46, q: 0.8, tone: 320, toneG: 0.24, grains: 1 },
  gravel: { kind: 'white', lp: 4200, hp: 900, dur: 0.035, g: 0.30, q: 1.0, grains: 4 },
  grass: { kind: 'pink', lp: 6500, hp: 1800, dur: 0.075, g: 0.24, q: 0.6, grains: 2 },
  water: { kind: 'white', lp: 2600, hp: 320, dur: 0.090, g: 0.44, q: 0.7, sweep: true, grains: 1 }
};

/** 脚步：总长控制在 120ms 以内，材质差异靠滤波 + 颗粒 + 共鸣区分 */
function synthStep(s, m) {
  const grains = m.grains || 1;
  for (let i = 0; i < grains; i++) {
    const at = i === 0 ? 0 : rnd(0.008, 0.032) * i;
    s.burst({
      kind: m.kind, type: 'bandpass', freq: (m.hp + m.lp) * 0.5 * rnd(0.85, 1.18), q: m.q || 0.9,
      dur: m.dur / (i ? 2.2 : 1), g: (m.g / (i ? 2.4 : 1)) * rnd(0.85, 1.05), a: 0.0012, at: at,
      drive: m.drive || 0, freqEnd: m.sweep ? m.lp * 0.35 : null
    });
  }
  // 低通"落地重量"
  s.burst({ kind: 'brown', type: 'lowpass', freq: m.lp * 0.35, dur: m.dur * 1.2, g: m.g * 0.5, a: 0.002 });
  if (m.tone) s.tone({ type: 'triangle', f0: m.tone * rnd(0.94, 1.06), f1: m.tone * 0.6, dur: 0.045, g: m.toneG, a: 0.002 });
  if (m.ring) metalRing(s, { f: m.ring * rnd(0.9, 1.1), q: 9, dur: 0.09, g: m.ringG, pr: 1.6 });
}

/* ===========================================================================
 * 6. 简易无线电语音引擎
 *    锯齿声源（声带）→ 2~3 个共振峰带通（元音）→ 无线电带限 + 削波（对讲机质感）
 *    音节由振幅包络 + 音高台阶塑造，不追求听懂，只要有"人在说话"的质感。
 * ========================================================================= */

const RADIO_LINES = {
  // syl: [时长, 音高倍率, 之后的间隔]
  radio_go: { f0: 132, fmts: [[600, 5, 1], [1250, 7, 0.65], [2600, 9, 0.30]], syl: [[0.09, 1.00, 0.03], [0.13, 0.88, 0]] },
  radio_enemyspotted: { f0: 124, fmts: [[520, 5, 1], [1500, 7, 0.70], [2500, 9, 0.28]], syl: [[0.08, 1.05, 0.02], [0.07, 0.96, 0.02], [0.08, 1.10, 0.03], [0.14, 0.86, 0]] },
  radio_needbackup: { f0: 138, fmts: [[640, 5, 1], [1150, 7, 0.60], [2400, 8, 0.26]], syl: [[0.09, 1.12, 0.02], [0.08, 1.00, 0.02], [0.16, 0.82, 0]] },
  radio_sectorclear: { f0: 118, fmts: [[480, 4, 1], [1320, 7, 0.62], [2300, 8, 0.24]], syl: [[0.10, 0.98, 0.03], [0.09, 1.04, 0.02], [0.15, 0.84, 0]] },
  radio_fireinthehole: { f0: 152, fmts: [[700, 5, 1], [1600, 8, 0.75], [2800, 9, 0.34]], syl: [[0.07, 1.18, 0.015], [0.06, 1.10, 0.015], [0.06, 1.22, 0.02], [0.12, 0.90, 0]] },
  radio_bombdown: { f0: 108, fmts: [[440, 4, 1], [1050, 6, 0.58], [2200, 8, 0.22]], syl: [[0.11, 0.96, 0.03], [0.16, 0.78, 0]] },
  radio_getout: { f0: 146, fmts: [[680, 5, 1], [1450, 8, 0.72], [2700, 9, 0.32]], syl: [[0.08, 1.16, 0.02], [0.15, 0.88, 0]] }
};

function synthRadio(s, line) {
  // 开头的按键"嘟"（squelch）
  s.burst({ kind: 'white', type: 'highpass', freq: 2600, dur: 0.020, g: 0.16, a: 0.001 });
  blip(s, { type: 'square', f0: 1180, dur: 0.035, g: 0.10, at: 0.004, lp: 4000 });

  const t0 = 0.06;
  const voice = s.gain(1);
  // 无线电带限 + 轻微削波：只留 320Hz–3.2kHz，并把动态压扁
  const hp = s.bq('highpass', s.frq(330), 0.8);
  const lp = s.bq('lowpass', s.frq(3200), 0.9);
  const sh = s.shaper(0.55);
  voice.connect(hp); hp.connect(lp); lp.connect(sh); sh.connect(s.dest);

  const osc = s.osc('sawtooth', s.frq(line.f0));
  osc.start(s.at(0));
  const env = s.gain(EPS);
  for (const f of line.fmts) {
    const bp = s.bq('bandpass', s.frq(f[0]), f[1]);
    const fg = s.gain(f[2]);
    osc.connect(bp); bp.connect(fg); fg.connect(env);
  }
  env.connect(voice);
  // 轻微颤音，避免机械感
  s.lfo({ f: 5.5, depth: s.frq(line.f0) * 0.02, target: osc.frequency, life: 2 });

  let cur = t0;
  env.gain.setValueAtTime(EPS, s.at(0));
  for (const syl of line.syl) {
    const d = syl[0], mul = syl[1], gap = syl[2];
    const a = s.at(cur);
    osc.frequency.setValueAtTime(s.frq(line.f0 * mul), a);
    osc.frequency.linearRampToValueAtTime(s.frq(line.f0 * mul * 0.94), a + s.dur(d));
    env.gain.setValueAtTime(EPS, a);
    env.gain.linearRampToValueAtTime(0.55, a + s.dur(0.018));
    env.gain.setValueAtTime(0.5, a + s.dur(d * 0.75));
    env.gain.exponentialRampToValueAtTime(EPS, a + s.dur(d));
    // 辅音气声
    s.burst({ kind: 'pink', type: 'bandpass', freq: 2100, q: 1.2, dur: 0.022, g: 0.07, a: 0.002, at: cur, to: voice });
    cur += d + gap;
  }
  const end = s.at(cur);
  osc.stop(end + 0.05);
  // 结尾静噪 + 松键"嗒"
  s.burst({ kind: 'white', type: 'bandpass', freq: 2400, q: 0.8, dur: 0.05, g: 0.12, a: 0.003, at: cur + 0.01, to: voice });
  mechClick(s, cur + 0.05, 2000, 0.06, 0.010);
  s.mark(end + 0.15);
}

/* ===========================================================================
 * 7. 音效注册表：name -> (SynthCtx, opts) => void
 * ========================================================================= */

const SOUNDS = {};

/** 循环型音效（opts.loop 未显式给出时默认循环） */
const LOOPING = new Set(['flash_ring', 'smoke_hiss', 'fire_burn', 'ambience_wind', 'c4_defuse_start']);

// --- 枪声（34 把，全部走参数化引擎 + 族层指纹）---
for (const gunName of Object.keys(GUN_TONES)) {
  SOUNDS[gunName] = (function (n) {
    return function (s) { synthGun(s, GUN_TONES[n], false); };
  })(gunName);
}

// --- 武器操作 ---
Object.assign(SOUNDS, {
  // 空仓：击锤打在空膛上，只有两下干瘪金属声
  dryfire(s) {
    mechClick(s, 0, 3400, 0.34, 0.010);
    mechClick(s, 0.028, 2500, 0.20, 0.014);
    s.burst({ kind: 'white', type: 'bandpass', freq: 5200, q: 8, dur: 0.02, g: 0.10, a: 0.0006, at: 0.002 });
  },
  // 换弹起手：手掌拍握把 + 装备布料
  reload_start(s) {
    cloth(s, 0, 0.10, 0.18, 1300);
    s.burst({ kind: 'white', type: 'lowpass', freq: 900, dur: 0.05, g: 0.22, a: 0.003, at: 0.02 });
    mechClick(s, 0.05, 1800, 0.10, 0.014);
  },
  // 卸弹匣：弹匣扣松开 + 金属滑出摩擦（带通中心向下扫）
  reload_magout(s) {
    mechClick(s, 0, 2900, 0.26, 0.010);
    s.burst({ kind: 'white', type: 'bandpass', freq: 2600, freqEnd: 900, q: 1.6, dur: 0.13, g: 0.24, a: 0.006, at: 0.012 });
    metalRing(s, { f: 1200, q: 7, dur: 0.10, g: 0.10, at: 0.10, pr: 1.3 });
  },
  // 上弹匣：实心"咔"（低频撞击 + 高频边缘）+ 弹簧
  reload_magin(s) {
    s.burst({ kind: 'white', type: 'lowpass', freq: 700, dur: 0.045, g: 0.42, a: 0.001 });
    s.tone({ type: 'triangle', f0: 180, f1: 90, dur: 0.055, g: 0.30, a: 0.001 });
    mechClick(s, 0.004, 3100, 0.30, 0.012);
    metalRing(s, { f: 2600, q: 12, dur: 0.07, g: 0.10, at: 0.008, pr: 1.5 });
  },
  // 拉栓：两段式——后拉摩擦，然后前推到位的清脆撞击
  reload_bolt(s) {
    s.burst({ kind: 'white', type: 'bandpass', freq: 1400, freqEnd: 2600, q: 2.0, dur: 0.09, g: 0.26, a: 0.004 });
    mechClick(s, 0.10, 2600, 0.26, 0.012);
    metalRing(s, { f: 1850, q: 11, dur: 0.14, g: 0.18, at: 0.102, pr: 1.1 });
    mechClick(s, 0.16, 3300, 0.18, 0.010);
  },
  // 换弹收尾：拍弹匣底 + 装备归位
  reload_end(s) {
    s.burst({ kind: 'white', type: 'lowpass', freq: 600, dur: 0.05, g: 0.28, a: 0.002 });
    cloth(s, 0.02, 0.08, 0.12, 1100);
    mechClick(s, 0.06, 2100, 0.12, 0.012);
  },
  // 取出武器：布料掠过 + 轻金属
  weapon_draw(s) {
    s.burst({ kind: 'pink', type: 'bandpass', freq: 800, freqEnd: 2200, q: 0.8, dur: 0.14, g: 0.20, a: 0.02 });
    mechClick(s, 0.10, 2400, 0.14, 0.012);
  },
  // 切枪：更快的双击，比 draw 更亮
  weapon_switch(s) {
    mechClick(s, 0, 3600, 0.22, 0.009);
    mechClick(s, 0.045, 2800, 0.16, 0.011);
    cloth(s, 0.01, 0.06, 0.10, 1800);
  },
  // 开镜：橡胶眼罩贴合 + 上滑的机械音
  zoom_in(s) {
    s.tone({ type: 'sine', f0: 420, f1: 900, dur: 0.075, g: 0.14, a: 0.004, lp: 3000 });
    s.burst({ kind: 'pink', type: 'lowpass', freq: 1200, dur: 0.05, g: 0.12, a: 0.004 });
    mechClick(s, 0.055, 2200, 0.08, 0.010);
  },
  // 关镜：下滑
  zoom_out(s) {
    s.tone({ type: 'sine', f0: 880, f1: 380, dur: 0.070, g: 0.13, a: 0.004, lp: 3000 });
    s.burst({ kind: 'pink', type: 'lowpass', freq: 1000, dur: 0.045, g: 0.11, a: 0.004 });
    mechClick(s, 0.05, 1900, 0.07, 0.010);
  },
  // 挥空刀：带通中心快速上扫再回落 = 空气"咻"
  knife_slash(s) {
    s.burst({ kind: 'pink', type: 'bandpass', freq: 600, freqEnd: 2600, q: 1.4, dur: 0.10, g: 0.30, a: 0.02 });
    s.burst({ kind: 'white', type: 'bandpass', freq: 2800, freqEnd: 700, q: 1.8, dur: 0.09, g: 0.16, a: 0.01, at: 0.06 });
  },
  // 砍中肉体：湿闷 thud + 短促"噗"
  knife_hit(s) {
    s.tone({ type: 'sine', f0: 130, f1: 62, dur: 0.10, g: 0.55, a: 0.001, drive: 0.3 });
    s.burst({ kind: 'brown', type: 'lowpass', freq: 800, dur: 0.07, g: 0.42, a: 0.001 });
    s.burst({ kind: 'white', type: 'bandpass', freq: 1600, q: 1.0, dur: 0.045, g: 0.20, a: 0.002, at: 0.004 });
  },
  // 重刺（右键）：更深更长，带撕裂质感
  knife_stab(s) {
    s.tone({ type: 'sine', f0: 96, f1: 44, dur: 0.20, g: 0.70, a: 0.002, drive: 0.4 });
    s.burst({ kind: 'brown', type: 'lowpass', freq: 600, dur: 0.14, g: 0.50, a: 0.002 });
    s.burst({ kind: 'crackle', type: 'bandpass', freq: 1200, q: 0.9, dur: 0.16, g: 0.22, a: 0.006, at: 0.01 });
    s.burst({ kind: 'white', type: 'bandpass', freq: 2400, q: 1.4, dur: 0.05, g: 0.16, a: 0.002 });
  },
  // 砍到墙：高频火花 + 金属刮擦，几乎无低频
  knife_hitwall(s) {
    s.burst({ kind: 'white', type: 'highpass', freq: 4200, dur: 0.035, g: 0.40, a: 0.0006 });
    metalRing(s, { f: 5200, q: 14, dur: 0.16, g: 0.26, pr: 1.8 });
    s.burst({ kind: 'crackle', type: 'bandpass', freq: 6000, q: 1.2, dur: 0.10, g: 0.14, a: 0.003, at: 0.008 });
    s.tone({ type: 'triangle', f0: 220, f1: 140, dur: 0.04, g: 0.10, a: 0.001 });
  },
  // 电枪：高压放电——方波过强削波 + 随机高频爆裂 + 上滑充电嗡
  zeus_fire(s) {
    s.tone({ type: 'square', f0: 70, f1: 40, dur: 0.16, g: 0.35, a: 0.001, drive: 0.9, lp: 2600 });
    s.tone({ type: 'sawtooth', f0: 420, f1: 1800, dur: 0.14, g: 0.16, a: 0.004, drive: 0.6, lp: 5000 });
    for (let i = 0; i < 6; i++) {
      s.burst({ kind: 'white', type: 'bandpass', freq: rnd(2500, 7000), q: 3, dur: rnd(0.008, 0.02), g: rnd(0.12, 0.30), a: 0.0006, at: rnd(0, 0.14) });
    }
    s.burst({ kind: 'crackle', type: 'highpass', freq: 3000, dur: 0.20, g: 0.22, a: 0.004, drive: 0.5 });
  },
  // 弹壳落地：2–3 声极短金属叮，音高随机
  shell_drop(s) {
    const n = rndi(2, 3);
    for (let i = 0; i < n; i++) {
      metalRing(s, { f: rnd(2600, 4600), q: 13, dur: 0.10 - i * 0.02, g: (0.22 - i * 0.06) * rnd(0.8, 1.2), at: i * rnd(0.05, 0.12), pr: rnd(1.4, 2.2) });
      s.burst({ kind: 'white', type: 'highpass', freq: 5000, dur: 0.010, g: 0.08, a: 0.0005, at: i * 0.06 });
    }
  }
});

// --- 命中 / 受伤 ---
Object.assign(SOUNDS, {
  // 血肉：低频闷响 + 湿润中频，无高频
  hit_flesh(s) {
    s.tone({ type: 'sine', f0: 140, f1: 70, dur: 0.09, g: 0.50, a: 0.001, drive: 0.25 });
    s.burst({ kind: 'brown', type: 'lowpass', freq: 900, dur: 0.07, g: 0.40, a: 0.001 });
    s.burst({ kind: 'pink', type: 'bandpass', freq: 1500, q: 1.2, dur: 0.04, g: 0.14, a: 0.002 });
  },
  // 爆头：清脆金属"叮"（高 Q 双分音）+ 闷响，最容易辨认的反馈
  hit_headshot(s) {
    metalRing(s, { f: 3100, q: 18, dur: 0.30, g: 0.42, pr: 1.0 });
    s.tone({ type: 'sine', f0: 4700, f1: 4400, dur: 0.22, g: 0.16, a: 0.0008 });
    s.tone({ type: 'sine', f0: 3120, f1: 3050, dur: 0.28, g: 0.22, a: 0.0008 });
    s.tone({ type: 'sine', f0: 120, f1: 58, dur: 0.10, g: 0.45, a: 0.001, drive: 0.3 });
    s.burst({ kind: 'brown', type: 'lowpass', freq: 700, dur: 0.06, g: 0.32, a: 0.001 });
  },
  // 头盔：中频金属钝响（Q 中等，衰减快）
  hit_helmet(s) {
    metalRing(s, { f: 1650, q: 9, dur: 0.16, g: 0.34, pr: 1.1 });
    s.burst({ kind: 'white', type: 'bandpass', freq: 2600, q: 2.0, dur: 0.03, g: 0.24, a: 0.0008 });
    s.tone({ type: 'sine', f0: 150, f1: 80, dur: 0.07, g: 0.30, a: 0.001 });
  },
  // 护甲：板材被拍中的钝响，带通窄、无余韵
  hit_armor(s) {
    s.burst({ kind: 'white', type: 'bandpass', freq: 1250, q: 2.4, dur: 0.05, g: 0.36, a: 0.001 });
    s.tone({ type: 'triangle', f0: 260, f1: 150, dur: 0.05, g: 0.22, a: 0.001 });
    s.burst({ kind: 'brown', type: 'lowpass', freq: 500, dur: 0.05, g: 0.24, a: 0.001 });
  },
  // 混凝土：干脆的破裂 + 粉尘噪声
  hit_concrete(s) {
    s.burst({ kind: 'white', type: 'highpass', freq: 2200, dur: 0.030, g: 0.42, a: 0.0006 });
    s.burst({ kind: 'white', type: 'bandpass', freq: 4200, freqEnd: 1500, q: 1.2, dur: 0.09, g: 0.22, a: 0.002 });
    s.tone({ type: 'triangle', f0: 200, f1: 110, dur: 0.045, g: 0.16, a: 0.001 });
    s.burst({ kind: 'crackle', type: 'bandpass', freq: 3000, q: 1.0, dur: 0.10, g: 0.10, a: 0.006, at: 0.02 });
  },
  // 金属跳弹：经典下滑"啾" + 火花
  hit_metal(s) {
    s.tone({ type: 'sawtooth', f0: 3400, f1: 900, dur: 0.16, g: 0.20, a: 0.001, lp: 6000, gt: 0.9 });
    metalRing(s, { f: 2800, q: 12, dur: 0.20, g: 0.28, pr: 1.5 });
    s.burst({ kind: 'white', type: 'highpass', freq: 3500, dur: 0.025, g: 0.30, a: 0.0006 });
    s.burst({ kind: 'crackle', type: 'highpass', freq: 4000, dur: 0.09, g: 0.10, a: 0.004, at: 0.01 });
  },
  // 木头：400Hz 上下的木质腔体 + 木屑
  hit_wood(s) {
    s.tone({ type: 'triangle', f0: 420 * rnd(0.9, 1.1), f1: 210, dur: 0.07, g: 0.34, a: 0.001 });
    s.burst({ kind: 'white', type: 'bandpass', freq: 1500, q: 1.4, dur: 0.045, g: 0.26, a: 0.001 });
    s.burst({ kind: 'crackle', type: 'bandpass', freq: 2400, q: 1.1, dur: 0.07, g: 0.12, a: 0.004, at: 0.008 });
  },
  // 泥土：纯低通"噗"，无音调
  hit_dirt(s) {
    s.burst({ kind: 'brown', type: 'lowpass', freq: 900, freqEnd: 320, dur: 0.09, g: 0.40, a: 0.002 });
    s.burst({ kind: 'pink', type: 'bandpass', freq: 700, q: 0.6, dur: 0.06, g: 0.16, a: 0.003 });
  },
  // 玻璃：多片高频碎裂 + 碴子落地
  hit_glass(s) {
    s.burst({ kind: 'white', type: 'highpass', freq: 5000, dur: 0.03, g: 0.34, a: 0.0006 });
    for (let i = 0; i < 5; i++) {
      metalRing(s, { f: rnd(3200, 7200), q: 16, dur: rnd(0.08, 0.22), g: rnd(0.08, 0.20), at: rnd(0, 0.09), pr: rnd(1.5, 2.4) });
    }
    s.burst({ kind: 'crackle', type: 'highpass', freq: 3000, dur: 0.30, g: 0.16, a: 0.006, at: 0.04 });
  },
  // 水：截止频率先上后下的"啪嗒" + 水滴
  hit_water(s) {
    s.burst({ kind: 'white', type: 'lowpass', freq: 600, freqEnd: 3200, q: 0.7, dur: 0.05, g: 0.34, a: 0.002 });
    s.burst({ kind: 'brown', type: 'lowpass', freq: 2200, freqEnd: 400, dur: 0.14, g: 0.24, a: 0.004, at: 0.03 });
    for (let i = 0; i < 3; i++) {
      s.tone({ type: 'sine', f0: rnd(900, 1800), f1: rnd(400, 700), dur: 0.035, g: 0.10, a: 0.001, at: rnd(0.04, 0.16) });
    }
  },
  // 疼痛 1：短促男性闷哼
  player_pain1(s) {
    synthGrunt(s, { f0: 122, f1: 96, dur: 0.24, g: 0.46, fmts: [[620, 6, 1], [1180, 8, 0.55], [2500, 9, 0.20]], breath: 0.10 });
  },
  // 疼痛 2：音高更高、更急，与 pain1 明显不同
  player_pain2(s) {
    synthGrunt(s, { f0: 158, f1: 118, dur: 0.20, g: 0.44, fmts: [[720, 7, 1], [1450, 9, 0.60], [2800, 9, 0.24]], breath: 0.14, a: 0.012 });
  },
  // 死亡 1：长下滑呻吟 + 气声耗尽 + 倒地
  player_death(s) {
    synthGrunt(s, { f0: 128, f1: 62, dur: 0.62, g: 0.44, fmts: [[540, 5, 1], [1050, 7, 0.5], [2200, 8, 0.16]], breath: 0.16, a: 0.02 });
    s.burst({ kind: 'pink', type: 'bandpass', freq: 900, freqEnd: 380, q: 0.7, dur: 0.5, g: 0.16, a: 0.06, at: 0.25 });
    s.tone({ type: 'sine', f0: 70, f1: 40, dur: 0.30, g: 0.40, a: 0.004, at: 0.55, drive: 0.3 });
    s.burst({ kind: 'brown', type: 'lowpass', freq: 500, dur: 0.20, g: 0.30, a: 0.004, at: 0.55 });
  },
  // 死亡 2：短促吸气 + 更高音的断气声
  player_death2(s) {
    s.burst({ kind: 'pink', type: 'bandpass', freq: 1600, q: 1.0, dur: 0.14, g: 0.20, a: 0.03 });
    synthGrunt(s, { f0: 172, f1: 74, dur: 0.48, g: 0.42, fmts: [[760, 6, 1], [1500, 8, 0.55], [3000, 9, 0.22]], breath: 0.12, at: 0.10 });
    s.tone({ type: 'sine', f0: 66, f1: 38, dur: 0.26, g: 0.36, a: 0.004, at: 0.50, drive: 0.3 });
  },
  // 摔落伤：骨感重击 + 低频冲击 + 闷哼
  fall_damage(s) {
    s.tone({ type: 'sine', f0: 72, f1: 34, dur: 0.30, g: 0.75, a: 0.002, drive: 0.45 });
    s.burst({ kind: 'brown', type: 'lowpass', freq: 700, dur: 0.14, g: 0.55, a: 0.001, drive: 0.3 });
    s.burst({ kind: 'white', type: 'bandpass', freq: 1800, q: 1.4, dur: 0.05, g: 0.18, a: 0.001 });
    synthGrunt(s, { f0: 140, f1: 96, dur: 0.28, g: 0.34, fmts: [[600, 6, 1], [1250, 8, 0.5], [2400, 9, 0.2]], breath: 0.12, at: 0.05 });
  }
});

/** 人声引擎：声带锯齿 + 共振峰带通 + 气声（用于受伤/死亡） */
function synthGrunt(s, o) {
  const at = o.at || 0;
  const f0 = o.f0 == null ? 120 : o.f0;
  const f1 = o.f1 == null ? f0 * 0.78 : o.f1;
  const dur = o.dur == null ? 0.28 : o.dur;
  const t = s.at(at);
  const bus = s.gain(1);
  bus.connect(s.dest);
  const osc = s.osc(o.type || 'sawtooth', s.frq(f0));
  s.ramp(osc.frequency, t, s.frq(f0), s.frq(f1), s.dur(dur));
  const env = s.gain(EPS);
  const fmts = o.fmts || [[620, 6, 1], [1180, 8, 0.6], [2600, 9, 0.25]];
  for (const f of fmts) {
    const bp = s.bq('bandpass', s.frq(f[0]), f[1]);
    const g = s.gain(f[2]);
    osc.connect(bp); bp.connect(g); g.connect(env);
  }
  env.connect(bus);
  const end = s.adsr(env.gain, {
    t: t, peak: o.g == null ? 0.5 : o.g, a: s.dur(o.a == null ? 0.02 : o.a),
    h: s.dur(dur * 0.3), d: s.dur(dur)
  });
  osc.start(t);
  try { osc.stop(end + 0.04); } catch (e) { /* noop */ }
  s.burst({ kind: 'pink', type: 'bandpass', freq: 1500, q: 0.7, dur: dur * 0.9, g: o.breath == null ? 0.1 : o.breath, a: 0.02, at: at + 0.01, to: bus });
  s.mark(end + 0.06);
}

// --- 移动 ---
Object.assign(SOUNDS, {
  step_concrete(s) { synthStep(s, STEP_MATS.concrete); },
  step_dirt(s) { synthStep(s, STEP_MATS.dirt); },
  step_metal(s) { synthStep(s, STEP_MATS.metal); },
  step_wood(s) { synthStep(s, STEP_MATS.wood); },
  step_gravel(s) { synthStep(s, STEP_MATS.gravel); },
  step_grass(s) { synthStep(s, STEP_MATS.grass); },
  step_water(s) { synthStep(s, STEP_MATS.water); },
  // 轻落地：布料 + 小低频
  land_soft(s) {
    s.burst({ kind: 'brown', type: 'lowpass', freq: 600, dur: 0.08, g: 0.34, a: 0.002 });
    cloth(s, 0.005, 0.07, 0.14, 1200);
    s.tone({ type: 'sine', f0: 110, f1: 60, dur: 0.07, g: 0.20, a: 0.002 });
  },
  // 重落地：明显低频冲击 + 膝盖/装备撞击 + 轻微削波
  land_hard(s) {
    s.tone({ type: 'sine', f0: 80, f1: 38, dur: 0.20, g: 0.62, a: 0.002, drive: 0.35 });
    s.burst({ kind: 'brown', type: 'lowpass', freq: 800, dur: 0.11, g: 0.48, a: 0.001, drive: 0.25 });
    s.burst({ kind: 'white', type: 'bandpass', freq: 2200, q: 1.2, dur: 0.04, g: 0.16, a: 0.001 });
    cloth(s, 0.02, 0.09, 0.14, 1500);
  },
  // 起跳：布料 + 呼气 + 蹬地
  jump(s) {
    cloth(s, 0, 0.09, 0.16, 1600);
    s.burst({ kind: 'pink', type: 'bandpass', freq: 900, q: 0.7, dur: 0.10, g: 0.12, a: 0.02 });
    s.burst({ kind: 'white', type: 'lowpass', freq: 1200, dur: 0.035, g: 0.20, a: 0.001 });
  },
  // 爬梯：金属横档的手/脚接触声，带短金属余韵
  ladder(s) {
    mechClick(s, 0, 2600, 0.18, 0.012);
    metalRing(s, { f: 1900 * rnd(0.9, 1.15), q: 10, dur: 0.12, g: 0.16, pr: 1.5 });
    s.burst({ kind: 'pink', type: 'bandpass', freq: 1200, freqEnd: 700, q: 0.9, dur: 0.06, g: 0.12, a: 0.006, at: 0.01 });
  }
});

// --- 投掷物 / 炸弹 ---
Object.assign(SOUNDS, {
  // 投掷：布料破风 + 拉环金属
  grenade_throw(s) {
    s.burst({ kind: 'pink', type: 'bandpass', freq: 700, freqEnd: 2000, q: 1.0, dur: 0.13, g: 0.22, a: 0.02 });
    metalRing(s, { f: 3400, q: 14, dur: 0.10, g: 0.12, pr: 2.0 });
  },
  // 弹跳：金属外壳撞硬面，音高随机
  grenade_bounce(s) {
    const f = rnd(750, 1150);
    s.tone({ type: 'triangle', f0: f, f1: f * 0.55, dur: 0.05, g: 0.30, a: 0.0008 });
    metalRing(s, { f: f * 3.1, q: 12, dur: 0.11, g: 0.18, pr: 1.4 });
    s.burst({ kind: 'white', type: 'bandpass', freq: 2600, q: 1.6, dur: 0.02, g: 0.16, a: 0.0006 });
  },
  // 高爆手雷
  he_explode(s) { explosion(s, { scale: 1, sub: 58, g: 1 }); },
  // 闪光弹：极亮的高频爆裂，低频很少（"啪"而不是"轰"）
  flash_explode(s) {
    s.burst({ kind: 'white', type: 'highpass', freq: 3600, dur: 0.05, g: 1.0, a: 0.0005, drive: 0.7 });
    s.burst({ kind: 'white', type: 'bandpass', freq: 7000, freqEnd: 2600, q: 0.8, dur: 0.45, g: 0.40, a: 0.002 });
    s.tone({ type: 'sine', f0: 95, f1: 42, dur: 0.16, g: 0.55, a: 0.002, drive: 0.4 });
    s.room({ at: 0.01, dur: 0.35, lp: 5000, hp: 500, g: 0.24, dly: 0.06, fb: 0.36 });
  },
  // 耳鸣：4–7kHz 正弦叠加 + 轻微颤音，可循环、可淡出
  flash_ring(s) {
    const life = s.loop ? null : 4.0;
    const a = s.loopTone({ type: 'sine', f0: 4650, g: 0.16, a: 0.12, life: life, rel: 1.6 });
    const b = s.loopTone({ type: 'sine', f0: 6180, g: 0.10, a: 0.18, life: life, rel: 1.6 });
    const c = s.loopTone({ type: 'sine', f0: 5320, g: 0.07, a: 0.25, life: life, rel: 1.6 });
    // 颤音：让耳鸣"活"起来，不像纯测试音
    s.lfo({ f: 5.2, depth: 26, target: a.osc.frequency, life: life });
    s.lfo({ f: 3.7, depth: 34, target: b.osc.frequency, life: life });
    s.lfo({ f: 0.7, depth: 0.04, target: c.gain.gain, life: life });
  },
  // 烟雾弹落地释放：小爆响 + 气体喷出
  smoke_deploy(s) {
    s.burst({ kind: 'white', type: 'lowpass', freq: 2200, dur: 0.04, g: 0.55, a: 0.0008, drive: 0.4 });
    s.tone({ type: 'sine', f0: 140, f1: 60, dur: 0.10, g: 0.30, a: 0.002 });
    s.burst({ kind: 'white', type: 'bandpass', freq: 2600, freqEnd: 1400, q: 0.7, dur: 0.55, g: 0.30, a: 0.02, at: 0.02 });
    metalRing(s, { f: 1500, q: 8, dur: 0.10, g: 0.10, at: 0.01, pr: 1.2 });
  },
  // 烟雾持续嘶嘶（loop）：带通噪声 + 缓慢摆动的中心频率
  smoke_hiss(s) {
    const life = s.loop ? null : 3.0;
    const n = s.loopNoise({ kind: 'white', type: 'bandpass', freq: 2400, q: 0.9, g: 0.16, a: 0.15, life: life, rel: 0.6 });
    const f = n.node && n.node.frequency ? n.node.frequency : null;
    if (f) s.lfo({ f: 0.6, depth: s.frq(500), target: f, life: life });
    s.lfo({ f: 0.35, depth: 0.04, target: n.gain.gain, life: life });
  },
  // 燃烧瓶点燃：玻璃破碎 + 燃料轰燃
  molotov_ignite(s) {
    s.burst({ kind: 'white', type: 'highpass', freq: 4500, dur: 0.04, g: 0.34, a: 0.0008 });
    for (let i = 0; i < 4; i++) metalRing(s, { f: rnd(3500, 6800), q: 15, dur: rnd(0.06, 0.16), g: 0.10, at: rnd(0, 0.05), pr: 2.0 });
    s.burst({ kind: 'brown', type: 'lowpass', freq: 1800, freqEnd: 500, dur: 0.45, g: 0.44, a: 0.02, at: 0.03, drive: 0.35 });
    s.tone({ type: 'sine', f0: 90, f1: 45, dur: 0.30, g: 0.30, a: 0.02, at: 0.03 });
  },
  // 火焰持续（loop）：低频轰鸣 + 稀疏爆裂
  fire_burn(s) {
    const life = s.loop ? null : 3.0;
    const roar = s.loopNoise({ kind: 'brown', type: 'lowpass', freq: 420, q: 0.7, g: 0.18, a: 0.3, life: life, rel: 0.8 });
    const crack = s.loopNoise({ kind: 'crackle', type: 'bandpass', freq: 1800, q: 0.8, g: 0.16, a: 0.2, life: life, rel: 0.8, pr: 1.1 });
    s.loopNoise({ kind: 'pink', type: 'bandpass', freq: 900, q: 0.6, g: 0.07, a: 0.4, life: life, rel: 0.8 });
    // 火焰的呼吸感
    s.lfo({ f: 0.45, depth: 0.06, target: roar.gain.gain, life: life });
    s.lfo({ f: 1.3, depth: 0.05, target: crack.gain.gain, life: life });
  },
  // 灭火：蒸汽嘶声由亮到暗迅速收掉
  fire_extinguish(s) {
    s.burst({ kind: 'white', type: 'bandpass', freq: 3200, freqEnd: 700, q: 0.7, dur: 0.55, g: 0.34, a: 0.01 });
    s.burst({ kind: 'brown', type: 'lowpass', freq: 900, freqEnd: 260, dur: 0.40, g: 0.22, a: 0.02, at: 0.02 });
    s.burst({ kind: 'crackle', type: 'bandpass', freq: 1400, q: 0.9, dur: 0.25, g: 0.10, a: 0.02 });
  },
  // 诱饵弹：假枪声 + 暴露它是电子设备的小电子音
  decoy_shot(s) {
    s.burst({ kind: 'white', type: 'lowpass', freq: 2600, dur: 0.016, g: 0.55, a: 0.0006, drive: 0.3 });
    s.tone({ type: 'square', f0: 300, f1: 120, dur: 0.040, g: 0.34, a: 0.001, lp: 2600 });
    s.burst({ kind: 'white', type: 'bandpass', freq: 2900, q: 1.5, dur: 0.028, g: 0.26, a: 0.0008, at: 0.002 });
    s.room({ at: 0.004, dur: 0.14, lp: 3400, hp: 400, g: 0.16, dly: 0.034, fb: 0.18 });
    blip(s, { type: 'square', f0: 2400, dur: 0.02, g: 0.06, at: 0.06 });
  },
  // 拾取 C4：塑料外壳摩擦 + 电子自检音
  c4_pickup(s) {
    cloth(s, 0, 0.10, 0.14, 1000);
    s.burst({ kind: 'white', type: 'bandpass', freq: 1800, q: 1.6, dur: 0.03, g: 0.16, a: 0.001, at: 0.03 });
    blip(s, { type: 'square', f0: 1560, dur: 0.04, g: 0.10, at: 0.07 });
  },
  // 安放 C4：三下键盘滴答 + 上滑确认 + 双短音
  c4_plant(s) {
    for (let i = 0; i < 3; i++) blip(s, { type: 'square', f0: 1400 + i * 120, dur: 0.03, g: 0.13, at: 0.05 + i * 0.13, lp: 5000 });
    s.burst({ kind: 'white', type: 'lowpass', freq: 900, dur: 0.06, g: 0.20, a: 0.003, at: 0.44 });
    s.tone({ type: 'square', f0: 900, f1: 1800, dur: 0.10, g: 0.14, a: 0.004, at: 0.48, lp: 6000 });
    blip(s, { type: 'square', f0: 2100, dur: 0.05, g: 0.16, at: 0.60 });
    blip(s, { type: 'square', f0: 2100, dur: 0.07, g: 0.16, at: 0.70 });
  },
  // 单声滴（倒计时）：方波 + 一点点低通，短且刺
  c4_beep(s) {
    s.tone({ type: 'square', f0: 2650, dur: 0.055, g: 0.26, a: 0.001, h: 0.02, lp: 7000 });
    s.tone({ type: 'sine', f0: 5300, dur: 0.03, g: 0.06, a: 0.001 });
  },
  // C4 起爆：全场最大的爆炸，低频最深、尾巴最长
  c4_explode(s) {
    explosion(s, { scale: 1.9, sub: 44, g: 1.15 });
    s.tone({ type: 'sine', f0: 34, f1: 22, dur: 1.8, g: 0.85, a: 0.02, at: 0.02 });
    s.burst({ kind: 'brown', type: 'lowpass', freq: 400, freqEnd: 90, dur: 2.0, g: 0.42, a: 0.08, at: 0.05 });
  },
  // 拆弹进行中（loop）：剪线器电机嗡嗡 + 高频电流啸叫
  c4_defuse_start(s) {
    const life = s.loop ? null : 3.0;
    const h = s.loopTone({ type: 'sawtooth', f0: 92, g: 0.14, a: 0.10, life: life, rel: 0.3, lp: 900 });
    s.loopTone({ type: 'sawtooth', f0: 184.7, g: 0.07, a: 0.12, life: life, rel: 0.3, lp: 1400 });
    s.loopTone({ type: 'sine', f0: 3120, g: 0.030, a: 0.2, life: life, rel: 0.3 });
    s.loopNoise({ kind: 'pink', type: 'bandpass', freq: 1500, q: 0.8, g: 0.05, a: 0.2, life: life, rel: 0.3 });
    s.lfo({ f: 7.5, depth: 3.5, target: h.osc.frequency, life: life });
  },
  // 拆除成功：上行双音 + 装备扣合
  c4_defuse_done(s) {
    s.tone({ type: 'square', f0: 880, dur: 0.10, g: 0.20, a: 0.002, h: 0.03, lp: 6000 });
    s.tone({ type: 'square', f0: 1320, dur: 0.16, g: 0.20, a: 0.002, h: 0.05, lp: 6000, at: 0.11 });
    mechClick(s, 0.02, 2200, 0.12, 0.012);
  },
  // 拆除中断：下行的失望嗡音
  c4_defuse_abort(s) {
    s.tone({ type: 'sawtooth', f0: 420, f1: 150, dur: 0.22, g: 0.18, a: 0.004, lp: 1800, drive: 0.3 });
    s.burst({ kind: 'white', type: 'bandpass', freq: 1200, q: 1.2, dur: 0.05, g: 0.10, a: 0.003 });
  }
});

// --- UI / 比赛 ---
Object.assign(SOUNDS, {
  ui_click(s) { blip(s, { type: 'square', f0: 1900, dur: 0.030, g: 0.20, lp: 6000 }); },
  ui_hover(s) { blip(s, { type: 'sine', f0: 3000, dur: 0.020, g: 0.07, h: 0.004, lp: 9000 }); },
  // 返回：下行双音
  ui_back(s) {
    blip(s, { type: 'square', f0: 1400, dur: 0.035, g: 0.15 });
    blip(s, { type: 'square', f0: 950, dur: 0.055, g: 0.15, at: 0.04 });
  },
  // 购买成功：大三和弦上行
  buy_success(s) {
    const notes = [784, 988, 1319];
    notes.forEach((f, i) => s.tone({ type: 'sine', f0: f, dur: 0.13, g: 0.16, a: 0.003, h: 0.03, at: i * 0.055 }));
    s.tone({ type: 'triangle', f0: 392, dur: 0.22, g: 0.08, a: 0.006, at: 0.02 });
  },
  // 购买失败：低沉不协和的双音"嗡"
  buy_fail(s) {
    s.tone({ type: 'square', f0: 148, dur: 0.20, g: 0.16, a: 0.003, lp: 1200, drive: 0.3 });
    s.tone({ type: 'square', f0: 139, dur: 0.20, g: 0.14, a: 0.003, lp: 1200, drive: 0.3 });
  },
  // 开局：裁判哨（高频正弦 + 22Hz 颤音模拟哨内软木球 + 气声）+ 低音号提示
  round_start(s) {
    const w = s.loopTone({ type: 'sine', f0: 2250, g: 0.16, a: 0.03, life: 0.42, rel: 0.12 });
    s.lfo({ f: 22, depth: s.frq(90), target: w.osc.frequency, life: 0.6 });
    s.tone({ type: 'sine', f0: 3350, dur: 0.45, g: 0.05, a: 0.03, h: 0.20 });
    s.burst({ kind: 'white', type: 'bandpass', freq: 2400, q: 0.8, dur: 0.5, g: 0.06, a: 0.05 });
    s.tone({ type: 'triangle', f0: 196, dur: 0.5, g: 0.10, a: 0.02, h: 0.2, at: 0.1 });
  },
  // CT 胜：明亮大调号角
  round_win_ct(s) {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => {
      s.tone({ type: 'triangle', f0: f, dur: 0.28, g: 0.13, a: 0.006, h: 0.08, at: i * 0.10, lp: 6000 });
      s.tone({ type: 'sawtooth', f0: f * 0.5, dur: 0.30, g: 0.05, a: 0.01, at: i * 0.10, lp: 2400 });
    });
    s.room({ at: 0.1, dur: 0.6, lp: 4000, hp: 300, g: 0.10, dly: 0.09, fb: 0.4 });
  },
  // T 胜：小调、更暗更厚
  round_win_t(s) {
    const notes = [392, 466, 587, 784];
    notes.forEach((f, i) => {
      s.tone({ type: 'sawtooth', f0: f, dur: 0.32, g: 0.10, a: 0.008, h: 0.09, at: i * 0.11, lp: 3000, drive: 0.25 });
      s.tone({ type: 'sine', f0: f * 0.5, dur: 0.34, g: 0.08, a: 0.01, at: i * 0.11 });
    });
    s.room({ at: 0.1, dur: 0.7, lp: 2600, hp: 200, g: 0.12, dly: 0.11, fb: 0.42 });
  },
  // 炸弹已安放警报：两声上行警笛
  bomb_planted_alarm(s) {
    for (let i = 0; i < 2; i++) {
      s.tone({ type: 'square', f0: 620, f1: 1180, dur: 0.34, g: 0.16, a: 0.01, at: i * 0.40, lp: 4000 });
      s.tone({ type: 'sine', f0: 310, f1: 590, dur: 0.34, g: 0.10, a: 0.01, at: i * 0.40 });
    }
  },
  // 最后十秒：三下渐高的滴答
  ten_seconds(s) {
    for (let i = 0; i < 3; i++) {
      blip(s, { type: 'square', f0: 1500 + i * 260, dur: 0.035, g: 0.16, at: i * 0.16 });
      mechClick(s, i * 0.16, 4200, 0.06, 0.008);
    }
  },
  // 捡钱：两枚硬币的高频叮
  money_pickup(s) {
    s.tone({ type: 'sine', f0: 2200, dur: 0.10, g: 0.14, a: 0.001 });
    s.tone({ type: 'sine', f0: 3300, dur: 0.14, g: 0.10, a: 0.001, at: 0.035 });
    metalRing(s, { f: 4200, q: 16, dur: 0.16, g: 0.10, pr: 2.0 });
  },
  // 捡弹药：弹匣互撞的金属声
  ammo_pickup(s) {
    metalRing(s, { f: 2100, q: 10, dur: 0.12, g: 0.20, pr: 1.3 });
    mechClick(s, 0.03, 2800, 0.14, 0.012);
    s.burst({ kind: 'white', type: 'lowpass', freq: 800, dur: 0.04, g: 0.14, a: 0.002 });
  },
  // 穿护甲：魔术贴撕拉 + 插板落位
  armor_equip(s) {
    s.burst({ kind: 'crackle', type: 'bandpass', freq: 2600, q: 0.8, dur: 0.28, g: 0.24, a: 0.01, pr: 1.4 });
    s.burst({ kind: 'brown', type: 'lowpass', freq: 700, dur: 0.10, g: 0.26, a: 0.004, at: 0.26 });
    mechClick(s, 0.30, 1600, 0.12, 0.016);
  },
  // 捡拆弹器：拉链 + 塑料扣
  kit_pickup(s) {
    s.burst({ kind: 'crackle', type: 'bandpass', freq: 3400, q: 1.2, dur: 0.16, g: 0.16, a: 0.006, pr: 1.8 });
    cloth(s, 0.02, 0.10, 0.12, 1400);
    blip(s, { type: 'square', f0: 1750, dur: 0.03, g: 0.09, at: 0.16 });
  },
  // 连杀提示：四音上行 + 轻微金属光泽
  killstreak(s) {
    const notes = [880, 1108, 1319, 1760];
    notes.forEach((f, i) => s.tone({ type: 'triangle', f0: f, dur: 0.12, g: 0.13, a: 0.002, h: 0.02, at: i * 0.075, lp: 7000 }));
    metalRing(s, { f: 5200, q: 16, dur: 0.30, g: 0.08, at: 0.22, pr: 1.6 });
  },
  // MVP：五音号角 + 房间余韵
  mvp(s) {
    const notes = [523, 659, 784, 1047, 1319];
    notes.forEach((f, i) => {
      s.tone({ type: 'sawtooth', f0: f, dur: 0.30, g: 0.10, a: 0.006, h: 0.06, at: i * 0.13, lp: 5000, drive: 0.2 });
      s.tone({ type: 'sawtooth', f0: f * 1.005, dur: 0.30, g: 0.07, a: 0.008, at: i * 0.13, lp: 5000 });
      s.tone({ type: 'sine', f0: f * 0.5, dur: 0.32, g: 0.07, a: 0.01, at: i * 0.13 });
    });
    s.room({ at: 0.15, dur: 0.9, lp: 3600, hp: 250, g: 0.12, dly: 0.10, fb: 0.45 });
  }
});

// --- 无线电语音 ---
for (const radioName of Object.keys(RADIO_LINES)) {
  SOUNDS[radioName] = (function (n) {
    return function (s) { synthRadio(s, RADIO_LINES[n]); };
  })(radioName);
}

// --- 环境 ---
Object.assign(SOUNDS, {
  // 风（loop）：棕噪声过缓慢摆动的带通，极低音量；阵风由两个错拍 LFO 叠加
  ambience_wind(s) {
    const life = s.loop ? null : 6.0;
    const n = s.loopNoise({ kind: 'brown', type: 'bandpass', freq: 420, q: 0.5, g: 0.055, a: 1.2, life: life, rel: 1.5 });
    const hiss = s.loopNoise({ kind: 'pink', type: 'bandpass', freq: 1800, q: 0.6, g: 0.016, a: 1.5, life: life, rel: 1.5 });
    const f = n.node && n.node.frequency ? n.node.frequency : null;
    if (f) s.lfo({ f: 0.07, depth: s.frq(180), target: f, life: life });
    s.lfo({ f: 0.05, depth: 0.025, target: n.gain.gain, life: life });
    s.lfo({ f: 0.11, depth: 0.010, target: hiss.gain.gain, life: life });
  },
  // 鸟叫：2–4 声快速上下扫的正弦啾鸣
  bird(s) {
    const n = rndi(2, 4);
    let at = 0;
    for (let i = 0; i < n; i++) {
      const f = rnd(2600, 4200);
      s.tone({ type: 'sine', f0: f * 0.7, f1: f, dur: 0.035, g: 0.10, a: 0.004, at: at, gt: 0.6 });
      s.tone({ type: 'sine', f0: f, f1: f * 0.78, dur: 0.045, g: 0.08, a: 0.004, at: at + 0.03 });
      s.tone({ type: 'sine', f0: f * 2, dur: 0.03, g: 0.02, a: 0.004, at: at + 0.01 });
      at += rnd(0.10, 0.22);
    }
  }
});

/* ===========================================================================
 * 8. 音效名清单（供调试 / 自测枚举）
 * ========================================================================= */

export const SOUND_NAMES = [
  // 枪声
  'fire_ak47', 'fire_m4a4', 'fire_m4a1s', 'fire_galil', 'fire_famas', 'fire_aug', 'fire_sg553',
  'fire_awp', 'fire_ssg08', 'fire_scar20', 'fire_g3sg1',
  'fire_mp9', 'fire_mac10', 'fire_mp7', 'fire_mp5sd', 'fire_ump45', 'fire_p90', 'fire_bizon',
  'fire_nova', 'fire_xm1014', 'fire_mag7', 'fire_sawedoff',
  'fire_m249', 'fire_negev',
  'fire_glock18', 'fire_usp_s', 'fire_p2000', 'fire_p250', 'fire_deagle', 'fire_r8',
  'fire_dualberettas', 'fire_fiveseven', 'fire_tec9', 'fire_cz75',
  // 武器操作
  'dryfire', 'reload_start', 'reload_magout', 'reload_magin', 'reload_bolt', 'reload_end',
  'weapon_draw', 'weapon_switch', 'zoom_in', 'zoom_out',
  'knife_slash', 'knife_hit', 'knife_stab', 'knife_hitwall', 'zeus_fire', 'shell_drop',
  // 命中 / 受伤
  'hit_flesh', 'hit_headshot', 'hit_helmet', 'hit_armor', 'hit_concrete', 'hit_metal',
  'hit_wood', 'hit_dirt', 'hit_glass', 'hit_water',
  'player_pain1', 'player_pain2', 'player_death', 'player_death2', 'fall_damage',
  // 移动
  'step_concrete', 'step_dirt', 'step_metal', 'step_wood', 'step_gravel', 'step_grass', 'step_water',
  'land_soft', 'land_hard', 'jump', 'ladder',
  // 投掷物 / 炸弹
  'grenade_throw', 'grenade_bounce', 'he_explode', 'flash_explode', 'flash_ring',
  'smoke_deploy', 'smoke_hiss', 'molotov_ignite', 'fire_burn', 'fire_extinguish', 'decoy_shot',
  'c4_pickup', 'c4_plant', 'c4_beep', 'c4_explode', 'c4_defuse_start', 'c4_defuse_done', 'c4_defuse_abort',
  // UI / 比赛
  'ui_click', 'ui_hover', 'ui_back', 'buy_success', 'buy_fail', 'round_start',
  'round_win_ct', 'round_win_t', 'bomb_planted_alarm', 'ten_seconds',
  'money_pickup', 'ammo_pickup', 'armor_equip', 'kit_pickup', 'killstreak', 'mvp',
  // 无线电语音
  'radio_go', 'radio_enemyspotted', 'radio_needbackup', 'radio_sectorclear',
  'radio_fireinthehole', 'radio_bombdown', 'radio_getout',
  // 环境
  'ambience_wind', 'bird'
];

/**
 * 名称别名：SOUND_NAMES 严格按规范清单，但项目里已经写好的调用方
 * （src/game/weapondata.js 的 zeus 条目写的是 'fire_zeus'）用了另一种拼法。
 * 这里做无损转发，既不改动其它文件，也不污染清单。
 */
const SOUND_ALIASES = {
  fire_zeus: 'zeus_fire'
};

/** 把外部名字解析成实际实现名；解析不出来返回 null */
export function resolveSoundName(name) {
  if (typeof name !== 'string') return null;
  if (Object.prototype.hasOwnProperty.call(SOUNDS, name)) return name;
  if (Object.prototype.hasOwnProperty.call(SOUND_ALIASES, name)) {
    const target = SOUND_ALIASES[name];
    if (Object.prototype.hasOwnProperty.call(SOUNDS, target)) return target;
  }
  return null;
}

/** 自测：清单里没有实现的名字（应为空数组） */
export function listMissingSounds() {
  return SOUND_NAMES.filter((n) => typeof SOUNDS[n] !== 'function');
}

/** 自测：实现了但没写进清单的名字（应为空数组） */
export function listExtraSounds() {
  const set = new Set(SOUND_NAMES);
  return Object.keys(SOUNDS).filter((n) => !set.has(n));
}

/** 循环型音效名（调用方可用来决定是否保存句柄） */
export function isLoopingSound(name) {
  return LOOPING.has(resolveSoundName(name) || name);
}

export { GUN_TONES, STEP_MATS };

/* ===========================================================================
 * 9. AudioSystem
 * ========================================================================= */

const BUS_NAMES = ['sfx', 'ui', 'voice', 'music'];
const THROTTLE_WINDOW = 0.04; // 同名音效限流窗口（秒）
const THROTTLE_MAX = 4;       // 窗口内最多触发次数

/** 兼容写法：新实现用 AudioParam，旧实现只有 setPosition() */
function applyPannerPos(panner, pos, t) {
  const x = pos[0] || 0, y = pos[1] || 0, z = pos[2] || 0;
  try {
    if (panner.positionX && typeof panner.positionX.setValueAtTime === 'function') {
      panner.positionX.setValueAtTime(x, t);
      panner.positionY.setValueAtTime(y, t);
      panner.positionZ.setValueAtTime(z, t);
    } else if (typeof panner.setPosition === 'function') {
      panner.setPosition(x, y, z);
    }
  } catch (e) { /* 极端旧实现直接忽略定位 */ }
}

export class AudioSystem {
  /** 构造函数只保存配置，绝不创建 AudioContext（顶层/构造期零副作用） */
  constructor(options = {}) {
    this.config = {
      master: options.master == null ? 0.9 : clamp(options.master, 0, 1),
      hrtf: options.hrtf !== false,
      maxVoices: Math.max(8, options.maxVoices || 48),
      refDistance: options.refDistance == null ? 3 : options.refDistance,
      maxDistance: options.maxDistance == null ? 120 : options.maxDistance,
      rolloffFactor: options.rolloffFactor == null ? 1.2 : options.rolloffFactor,
      volumes: {
        sfx: 1.0, ui: 0.8, voice: 0.9, music: 0.6,
        ...(options.volumes || {})
      }
    };

    this.ctx = null;
    this.master = null;
    this.compressor = null;
    this.buses = {};
    this._noise = null;
    this._curves = null;
    this._initPromise = null;
    this._voices = new Map();
    this._triggers = new Map();
    this._warned = new Set();
    this._nextId = 1;
    this._listener = { pos: [0, 0, 0], forward: [0, 0, -1], up: [0, 1, 0] };
  }

  /* ---------------------------- 生命周期 ---------------------------- */

  /** 在首次用户手势中调用：创建/恢复 AudioContext，构建噪声缓冲与总线。幂等。 */
  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        return Promise.resolve(this.ctx.resume()).then(() => this).catch(() => this);
      }
      return Promise.resolve(this);
    }
    if (this._initPromise) return this._initPromise;

    const AC = (typeof globalThis !== 'undefined')
      ? (globalThis.AudioContext || globalThis.webkitAudioContext)
      : null;
    if (!AC) {
      this._warnOnce('noctx', '[audio] 当前环境不支持 Web Audio，音效已禁用');
      return Promise.resolve(this);
    }

    this._initPromise = new Promise((resolve) => {
      let ctx;
      try {
        ctx = new AC({ latencyHint: 'interactive' });
      } catch (e) {
        try { ctx = new AC(); } catch (e2) {
          this._warnOnce('noctx2', '[audio] AudioContext 创建失败：' + e2);
          resolve(this);
          return;
        }
      }
      this.ctx = ctx;
      this._curves = new Map();
      this._noise = makeNoiseBuffers(ctx);

      // master gain -> destination
      this.master = ctx.createGain();
      this.master.gain.value = this.config.master;
      this.master.connect(ctx.destination);

      // compressor -> master（统一压住连发与爆炸的峰值，避免爆音）
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.knee.value = 26;
      comp.ratio.value = 7;
      comp.attack.value = 0.003;
      comp.release.value = 0.22;
      comp.connect(this.master);
      this.compressor = comp;

      // bus gain -> compressor
      for (const b of BUS_NAMES) {
        const g = ctx.createGain();
        g.gain.value = clamp(this.config.volumes[b] == null ? 1 : this.config.volumes[b], 0, 1);
        g.connect(comp);
        this.buses[b] = g;
      }

      // 应用一次已保存的听者姿态
      this.setListener(this._listener.pos, this._listener.forward, this._listener.up);

      const done = () => resolve(this);
      if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
        Promise.resolve(ctx.resume()).then(done, done);
      } else {
        done();
      }
    });

    return this._initPromise;
  }

  get ready() {
    return !!(this.ctx && this.master && this.ctx.state !== 'closed');
  }

  suspend() {
    if (!this.ctx || typeof this.ctx.suspend !== 'function') return Promise.resolve(this);
    return Promise.resolve(this.ctx.suspend()).then(() => this).catch(() => this);
  }

  resume() {
    if (!this.ctx) return this.init();
    if (typeof this.ctx.resume !== 'function') return Promise.resolve(this);
    return Promise.resolve(this.ctx.resume()).then(() => this).catch(() => this);
  }

  /* ---------------------------- 音量 / 听者 ---------------------------- */

  setMasterVolume(v) {
    const val = clamp(Number(v) || 0, 0, 1);
    this.config.master = val;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(val, this.ctx.currentTime, 0.02);
    }
    return this;
  }

  setVolume(bus, v) {
    if (BUS_NAMES.indexOf(bus) < 0) {
      this._warnOnce('bus:' + bus, '[audio] 未知总线 "' + bus + '"（可用：' + BUS_NAMES.join(', ') + '）');
      return this;
    }
    const val = clamp(Number(v) || 0, 0, 1);
    this.config.volumes[bus] = val;
    const g = this.buses[bus];
    if (g && this.ctx) g.gain.setTargetAtTime(val, this.ctx.currentTime, 0.02);
    return this;
  }

  /** pos/forward/up 均为 [x,y,z]，右手系、Y 轴向上、单位米 */
  setListener(pos, forward, up) {
    if (pos) this._listener.pos = [pos[0] || 0, pos[1] || 0, pos[2] || 0];
    if (forward) this._listener.forward = [forward[0] || 0, forward[1] || 0, forward[2] || 0];
    if (up) this._listener.up = [up[0] || 0, up[1] || 0, up[2] || 0];
    if (!this.ready) return this;

    const L = this.ctx.listener;
    const t = this.ctx.currentTime;
    const p = this._listener.pos, f = this._listener.forward, u = this._listener.up;
    try {
      if (L.positionX && typeof L.positionX.setValueAtTime === 'function') {
        L.positionX.setValueAtTime(p[0], t);
        L.positionY.setValueAtTime(p[1], t);
        L.positionZ.setValueAtTime(p[2], t);
        if (L.forwardX) {
          L.forwardX.setValueAtTime(f[0], t);
          L.forwardY.setValueAtTime(f[1], t);
          L.forwardZ.setValueAtTime(f[2], t);
          L.upX.setValueAtTime(u[0], t);
          L.upY.setValueAtTime(u[1], t);
          L.upZ.setValueAtTime(u[2], t);
        } else if (typeof L.setOrientation === 'function') {
          L.setOrientation(f[0], f[1], f[2], u[0], u[1], u[2]);
        }
      } else {
        if (typeof L.setPosition === 'function') L.setPosition(p[0], p[1], p[2]);
        if (typeof L.setOrientation === 'function') L.setOrientation(f[0], f[1], f[2], u[0], u[1], u[2]);
      }
    } catch (e) { /* 忽略个别浏览器的实现差异 */ }
    return this;
  }

  /* ---------------------------- 播放 ---------------------------- */

  /**
   * 播放一个音效。
   * opts: {pos, volume, rate, loop, bus, delay}
   * 返回 {id, name, stop(fade), setPos(pos), setVolume(v)}；被限流/未知音效时返回 null。
   */
  play(name, opts = {}) {
    if (!this.ready) {
      this._warnOnce('notready', '[audio] 需要先在用户手势中调用 init()，play() 已忽略');
      return null;
    }
    const key = resolveSoundName(name);
    const fn = key ? SOUNDS[key] : null;
    if (typeof fn !== 'function') {
      this._warnOnce('unknown:' + name, '[audio] 未知音效名 "' + name + '"，已忽略');
      return null;
    }

    const ctx = this.ctx;
    const now = ctx.currentTime;
    // 并发限流：同名 40ms 内最多 4 次
    if (!this._throttle(key, now)) return null;
    // 全局活跃源上限
    if (this._voices.size >= this.config.maxVoices && !this._cull()) return null;

    const busName = (opts.bus && this.buses[opts.bus]) ? opts.bus : 'sfx';
    const vGain = ctx.createGain();
    vGain.gain.value = clamp(opts.volume == null ? 1 : Number(opts.volume), 0, 8);

    let panner = null;
    if (opts.pos) {
      panner = this._makePanner(opts.pos, now);
      vGain.connect(panner);
      panner.connect(this.buses[busName]);
    } else {
      vGain.connect(this.buses[busName]);
    }

    const rate = clamp(opts.rate == null ? 1 : Number(opts.rate) || 1, 0.25, 4);
    const loop = opts.loop == null ? LOOPING.has(key) : !!opts.loop;
    const t0 = now + Math.max(0, Number(opts.delay) || 0) + 0.005;

    const s = new SynthCtx(this, vGain, t0, rate, loop);
    const id = this._nextId++;
    const voice = {
      id, name: key, bus: busName, gain: vGain, panner, loop,
      pos: opts.pos ? [opts.pos[0] || 0, opts.pos[1] || 0, opts.pos[2] || 0] : null,
      start: t0, end: t0, shared: s.shared, timer: null, dead: false, handle: null
    };
    this._voices.set(id, voice);

    try {
      fn(s, opts);
    } catch (err) {
      console.warn('[audio] 合成 "' + name + '" 时出错：', err);
      this._killVoice(voice, 0);
      return null;
    }

    voice.end = loop ? Infinity : s.shared.end;
    if (!loop && isFiniteNum(voice.end) && typeof setTimeout === 'function') {
      const ms = Math.max(40, (voice.end - ctx.currentTime) * 1000 + 120);
      voice.timer = setTimeout(() => this._killVoice(voice, 0), ms);
    }

    const self = this;
    const handle = {
      id: id,
      name: name,
      get active() { return !voice.dead; },
      stop(fade) { self._stopVoice(voice, fade); return this; },
      setPos(p) {
        if (!p) return this;
        voice.pos = [p[0] || 0, p[1] || 0, p[2] || 0];
        if (voice.panner && !voice.dead && self.ctx) applyPannerPos(voice.panner, voice.pos, self.ctx.currentTime);
        return this;
      },
      setVolume(v) {
        if (voice.dead || !self.ctx) return this;
        const val = clamp(Number(v) || 0, 0, 8);
        try { voice.gain.gain.setTargetAtTime(val, self.ctx.currentTime, 0.015); } catch (e) { /* noop */ }
        return this;
      }
    };
    voice.handle = handle;
    return handle;
  }

  /** 停止 play() 返回的句柄（也接受 id） */
  stop(handle, fade) {
    if (handle == null) return this;
    const id = typeof handle === 'object' ? handle.id : handle;
    const voice = this._voices.get(id);
    if (voice) this._stopVoice(voice, fade);
    return this;
  }

  /** 停止所有正在发声的音效 */
  stopAll(fade) {
    for (const voice of Array.from(this._voices.values())) this._stopVoice(voice, fade == null ? 0.02 : fade);
    this._triggers.clear();
    return this;
  }

  /** 当前活跃发声数（调试用） */
  get activeVoices() {
    return this._voices.size;
  }

  /* ---------------------------- 内部实现 ---------------------------- */

  _warnOnce(key, msg) {
    if (this._warned.has(key)) return;
    this._warned.add(key);
    if (typeof console !== 'undefined' && console.warn) console.warn(msg);
  }

  _curve(amount) {
    const key = Math.round(clamp(amount, 0, 4) * 20) / 20;
    if (!this._curves) return makeDriveCurve(key);
    let c = this._curves.get(key);
    if (!c) {
      c = makeDriveCurve(key);
      this._curves.set(key, c);
    }
    return c;
  }

  _throttle(name, now) {
    let arr = this._triggers.get(name);
    if (!arr) {
      arr = [];
      this._triggers.set(name, arr);
    }
    // 丢掉窗口外的记录
    while (arr.length && now - arr[0] > THROTTLE_WINDOW) arr.shift();
    if (arr.length >= THROTTLE_MAX) return false;
    arr.push(now);
    return true;
  }

  /** 超过上限时淘汰一个发声：优先最远的非循环音，其次最旧的 */
  _cull() {
    let victim = null;
    let bestScore = -Infinity;
    const lp = this._listener.pos;
    for (const v of this._voices.values()) {
      if (v.dead) continue;
      let score = 0;
      if (v.loop) score -= 1e6;          // 循环音（耳鸣/火焰）尽量保留
      score -= v.start * 0.001;          // 越旧越容易被淘汰
      if (v.pos) {
        const dx = v.pos[0] - lp[0], dy = v.pos[1] - lp[1], dz = v.pos[2] - lp[2];
        score += Math.sqrt(dx * dx + dy * dy + dz * dz);
      }
      if (score > bestScore) {
        bestScore = score;
        victim = v;
      }
    }
    if (!victim) return false;
    this._killVoice(victim, 0.012);
    return true;
  }

  _makePanner(pos, t) {
    const p = this.ctx.createPanner();
    try { p.panningModel = this.config.hrtf ? 'HRTF' : 'equalpower'; } catch (e) {
      try { p.panningModel = 'equalpower'; } catch (e2) { /* noop */ }
    }
    try {
      p.distanceModel = 'inverse';
      p.refDistance = this.config.refDistance;
      p.maxDistance = this.config.maxDistance;
      p.rolloffFactor = this.config.rolloffFactor;
      p.coneInnerAngle = 360;
      p.coneOuterAngle = 360;
      p.coneOuterGain = 1;
    } catch (e) { /* noop */ }
    applyPannerPos(p, pos, t);
    return p;
  }

  /** 淡出后回收 */
  _stopVoice(voice, fade) {
    if (!voice || voice.dead) return;
    const f = Math.max(0.005, fade == null ? 0.03 : Number(fade) || 0.03);
    if (!this.ctx) {
      this._killVoice(voice, 0);
      return;
    }
    const now = this.ctx.currentTime;
    try {
      const g = voice.gain.gain;
      const cur = Math.max(EPS, g.value);
      g.cancelScheduledValues(now);
      g.setValueAtTime(cur, now);
      g.exponentialRampToValueAtTime(EPS, now + f);
    } catch (e) { /* noop */ }
    this._killVoice(voice, f);
  }

  /** 停源 + 断开 + 从活跃表移除 */
  _killVoice(voice, fade) {
    if (!voice || voice.dead) return;
    voice.dead = true;
    if (voice.timer != null && typeof clearTimeout === 'function') {
      clearTimeout(voice.timer);
      voice.timer = null;
    }
    const ctx = this.ctx;
    const stopAt = ctx ? ctx.currentTime + Math.max(0, fade || 0) : 0;
    const srcs = voice.shared ? voice.shared.srcs : [];
    for (const src of srcs) {
      try { src.stop(stopAt); } catch (e) { /* 未 start 或已结束 */ }
    }
    const cleanup = () => {
      const nodes = voice.shared ? voice.shared.nodes : [];
      for (const n of nodes) {
        try { n.disconnect(); } catch (e) { /* noop */ }
      }
      try { voice.gain.disconnect(); } catch (e) { /* noop */ }
      if (voice.panner) {
        try { voice.panner.disconnect(); } catch (e) { /* noop */ }
      }
      if (voice.shared) {
        voice.shared.nodes = [];
        voice.shared.srcs = [];
      }
    };
    this._voices.delete(voice.id);
    if (typeof setTimeout === 'function') setTimeout(cleanup, Math.max(30, (fade || 0) * 1000 + 60));
    else cleanup();
  }
}
