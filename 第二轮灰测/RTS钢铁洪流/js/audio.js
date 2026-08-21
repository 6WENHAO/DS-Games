/* ===================================================================
   audio.js — 程序化音频模块（WebAudio 实时合成 / 零外部资源 / 零依赖）

   设计要点
     1) 所有声音都是节点图临时搭建出来的：Oscillator / BufferSource(程序噪声)
        / BiquadFilter / WaveShaper / StereoPanner / Gain。没有任何音频文件。
     2) 合成实现全部写成 `_render(ctx, name, when, opts, dest)` 形式，
        接受"目标 AudioContext"。所以实时播放（AudioContext）与离线校验
        （OfflineAudioContext）共用同一份代码。
     3) 无 AudioContext 的环境（Node 无头测试）里全部方法安全空转，不抛异常。

   母线拓扑
     sfxBus  ─┐
              ├→ master → DynamicsCompressor → destination
     voiceBus ┘
     每次发声再挂一条 voice 头： [gain(音量)] → [StereoPanner(声道)] → 子母线

   限流
     · 每个音效名有最小间隔 GAP[name]（毫秒），密集开火直接丢弃。
     · 全局活跃发声数上限 MAX_VOICES；低优先级音效更早被丢。
     · 每帧新增发声上限 MAX_NEW_PER_FRAME，由 update() 复位。
     · 距离 > MAX_DIST（按缩放放大）的世界音效直接丢弃。

   坐标 / 单位：世界坐标像素，与 util.js 约定一致。
   =================================================================== */
(function () {
  'use strict';

  const root = (typeof window !== 'undefined') ? window
    : ((typeof globalThis !== 'undefined') ? globalThis : {});
  const R = (root.R = root.R || {});

  /* R.U / R.rng 由 util.js 提供；这里留极小兜底，保证任何加载顺序下都不炸。 */
  const U = R.U || {
    clamp(v, a, b) { return v < a ? a : (v > b ? b : v); },
    clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); },
  };
  const mkRng = R.rng || function (s) {
    let a = (s >>> 0) || 1;
    const f = function () { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; };
    f.range = (lo, hi) => lo + (hi - lo) * f();
    f.int = (lo, hi) => Math.floor(lo + (hi - lo + 1) * f());
    f.pick = (arr) => arr[Math.floor(f() * arr.length) % arr.length];
    return f;
  };

  /* ============================ 常量 ============================ */

  /** gain 不能指数衰减到 0，用这个当"静音底"。 */
  const EPS = 0.0001;

  /** 世界音效最远可听距离（像素，缩放 1 时）。 */
  const MAX_DIST = 1600;
  /** 声道展开的半宽：|x-camX| 达到这个值时 pan 打满。 */
  const PAN_SPAN = 620;
  /** 同时活跃的发声上限。 */
  const MAX_VOICES = 24;
  /** 单帧最多新增的发声数（防止一帧几十个单位齐射）。 */
  const MAX_NEW_PER_FRAME = 10;
  /** 调度提前量，避免"就在当前时刻"起音导致的爆音。 */
  const LOOKAHEAD = 0.006;

  /** 每个音效名的最小间隔（毫秒）。缺省 DEF_GAP。 */
  const GAP = {
    /* 武器 */
    mg: 45, sniper: 90, flame: 110, rocket: 80,
    cannonLight: 55, cannon: 70, cannonHeavy: 90, artillery: 140,
    flak: 70, ion: 1200,
    /* 命中 / 爆炸 */
    hitSmall: 40, hitFlesh: 45,
    boomSmall: 45, boomMedium: 70, boomLarge: 110, boomBuilding: 320, powerDown: 700,
    /* 经济 / 建造 */
    build: 55, buildDone: 140, place: 130, sell: 130, oreDump: 420, credit: 95,
    /* UI */
    click: 30, deny: 150, select: 45, order: 60, tab: 55,
  };
  const DEF_GAP = 30;

  /** 出厂电平微调：把各音效的单发峰值压到 1.0 以内，留够混战余量。
      （离线校验读的是同一份数值，所以量表就是实际听到的电平） */
  const TRIM = {
    cannonLight: 0.80, cannon: 0.60, cannonHeavy: 0.58, artillery: 0.62, ion: 0.62,
    boomSmall: 0.78, boomMedium: 0.58, boomLarge: 0.54, boomBuilding: 0.58,
    place: 0.92, rocket: 0.95, sniper: 0.95, mg: 0.95,
  };

  /** 优先级：>=2 的音效在拥挤时保留更多配额（0/1 会更早被丢弃）。 */
  const PRIO = {
    ion: 3, boomBuilding: 3, powerDown: 3, boomLarge: 2, buildDone: 2,
    place: 2, sell: 2, deny: 2, order: 2, click: 2, oreDump: 2,
  };
  const DEF_PRIO = 1;

  /** 播报音的独立限流：同名冷却 & 全局播报间隔（毫秒）。 */
  const VO_GAP = 1400;
  const VO_GLOBAL_GAP = 320;

  /* ==================== 程序生成的噪声 buffer ==================== */
  /* 每个 AudioContext 只生成一次（离线 ctx 也各自缓存），用 R.rng 保证可复现。 */
  const bufCache = (typeof WeakMap !== 'undefined') ? new WeakMap() : null;
  const bufFallback = [];

  function buffers(ctx) {
    if (bufCache && bufCache.has(ctx)) return bufCache.get(ctx);
    if (!bufCache) {
      for (let i = 0; i < bufFallback.length; i++) if (bufFallback[i].ctx === ctx) return bufFallback[i].b;
    }
    const sr = ctx.sampleRate || 44100;
    const n = Math.max(256, Math.floor(sr * 2));

    /* --- 白噪声 --- */
    const white = ctx.createBuffer(1, n, sr);
    const wd = white.getChannelData(0);
    const r1 = mkRng(0x51F7A1);
    for (let i = 0; i < n; i++) wd[i] = r1() * 2 - 1;

    /* --- 粉噪（低频更足，用于轰鸣/风声） --- */
    const pink = ctx.createBuffer(1, n, sr);
    const pd = pink.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, mx = 0;
    for (let i = 0; i < n; i++) {
      const w = wd[i];
      b0 = 0.99765 * b0 + w * 0.0990460;
      b1 = 0.96300 * b1 + w * 0.2965164;
      b2 = 0.57000 * b2 + w * 1.0526913;
      const v = b0 + b1 + b2 + w * 0.1848;
      pd[i] = v;
      const a = v < 0 ? -v : v;
      if (a > mx) mx = a;
    }
    if (mx > 0) for (let i = 0; i < n; i++) pd[i] /= mx;

    /* --- 颗粒噪声（碎裂 / 倾泻 / 弹壳） --- */
    const grain = ctx.createBuffer(1, n, sr);
    const gd = grain.getChannelData(0);
    const r2 = mkRng(0x9E3779);
    let p = 0;
    while (p < n) {
      const len = Math.floor(r2.range(sr * 0.0006, sr * 0.004));
      const amp = r2.range(0.35, 1);
      for (let j = 0; j < len && p + j < n; j++) {
        const e = 1 - j / len;
        gd[p + j] += (r2() * 2 - 1) * amp * e * e;
      }
      p += Math.floor(r2.range(sr * 0.0016, sr * 0.012));
    }
    let gmx = 0;
    for (let i = 0; i < n; i++) { const a = gd[i] < 0 ? -gd[i] : gd[i]; if (a > gmx) gmx = a; }
    if (gmx > 0) for (let i = 0; i < n; i++) gd[i] /= gmx;

    const b = { white, pink, grain };
    if (bufCache) bufCache.set(ctx, b); else bufFallback.push({ ctx, b });
    return b;
  }

  /* ==================== WaveShaper 曲线（可跨 ctx 复用） ==================== */
  const curves = {};
  function driveCurve(amount) {
    const key = amount.toFixed(2);
    if (curves[key]) return curves[key];
    const n = 1024, c = new Float32Array(n), k = 1 + amount * 8;
    const norm = Math.tanh(k);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      c[i] = Math.tanh(x * k) / norm;   // 奇对称 → 不引入 DC 偏移
    }
    curves[key] = c;
    return c;
  }

  /* ==================== 包络（永远 0 起 0 收） ==================== */
  function shapeEnv(param, t, peak, atk, dec, hold, curve) {
    peak = Math.max(peak, 0.0006);
    atk = Math.max(atk, 0.0008);
    hold = hold || 0;
    dec = Math.max(dec, 0.004);
    param.setValueAtTime(EPS, t);
    param.linearRampToValueAtTime(peak, t + atk);
    if (hold > 0) param.setValueAtTime(peak, t + atk + hold);
    const tEnd = t + atk + hold + dec;
    if (curve === 'lin') param.linearRampToValueAtTime(0, tEnd);
    else param.exponentialRampToValueAtTime(EPS, tEnd);
    param.setValueAtTime(0, tEnd + 0.0008);
    return tEnd + 0.0008;
  }

  /* ===================================================================
     Kit：一次发声的临时节点图搭建器
     所有合成函数都只跟 Kit 打交道，因此天然支持任意 BaseAudioContext。
     =================================================================== */
  function Kit(ctx, out, t0, rnd, rate) {
    this.ctx = ctx;
    this.out = out;            // 该次发声的输出头（已含音量/声道）
    this.t0 = t0;              // 起始时刻（ctx 时间轴）
    this.rnd = rnd;            // R.rng 流
    this.rate = rate || 1;     // 全局音高缩放
    this.nodes = [];           // 结束后统一 disconnect
    this.srcs = [];            // 需要 start/stop 的源
    this.end = t0;             // 预计结束时刻
  }

  Kit.prototype._reg = function (n) { this.nodes.push(n); return n; };

  Kit.prototype.gain = function (v) {
    const g = this.ctx.createGain();
    g.gain.value = (v == null ? 1 : v);
    return this._reg(g);
  };

  Kit.prototype.bq = function (type, f, q) {
    const b = this.ctx.createBiquadFilter();
    b.type = type;
    b.frequency.value = Math.max(20, f);
    if (q != null) b.Q.value = q;
    return this._reg(b);
  };

  Kit.prototype.shaper = function (amount) {
    const s = this.ctx.createWaveShaper();
    s.curve = driveCurve(amount);
    if ('oversample' in s) s.oversample = '2x';
    return this._reg(s);
  };

  Kit.prototype.sched = function (node, a, b, off) {
    if (b > this.end) this.end = b;
    this.srcs.push({ n: node, a, b, off });
    return node;
  };

  /** 低频调制：把一个振荡器接到某个 AudioParam 上（做颤音 / 颗粒感）。 */
  Kit.prototype.lfo = function (freq, depth, param, t, dur, type) {
    const o = this.ctx.createOscillator();
    o.type = type || 'sine';
    o.frequency.value = Math.max(0.01, freq);
    this._reg(o);
    const g = this.gain(depth);
    o.connect(g);
    g.connect(param);
    this.sched(o, t, t + dur + 0.02);
    return g;
  };

  /**
   * 单个振荡器音层。
   * o: { t, dur, f0, f1, type, peak, atk, hold, curve, lin,
   *      sweepDur, filter, ff0, ff1, fq, drive, dest }
   */
  Kit.prototype.tone = function (o) {
    const ctx = this.ctx;
    const t = this.t0 + (o.t || 0);
    const dur = Math.max(0.01, o.dur);
    const peak = (o.peak == null ? 0.3 : o.peak);
    const hold = o.hold || 0;
    const atk = Math.min(o.atk == null ? 0.004 : o.atk, dur * 0.6);
    const rate = this.rate;

    const osc = ctx.createOscillator();
    osc.type = o.type || 'sine';
    const f0 = Math.max(8, (o.f0 == null ? 440 : o.f0) * rate);
    osc.frequency.setValueAtTime(f0, t);
    if (o.f1 != null) {
      const f1 = Math.max(8, o.f1 * rate);
      const tEnd = t + (o.sweepDur == null ? dur : o.sweepDur);
      if (o.lin) osc.frequency.linearRampToValueAtTime(f1, tEnd);
      else osc.frequency.exponentialRampToValueAtTime(f1, tEnd);
    }
    if (o.detune) osc.detune.value = o.detune;
    this._reg(osc);

    let node = osc;
    if (o.filter) {
      const f = this.bq(o.filter, (o.ff0 == null ? f0 * 2 : o.ff0 * rate), o.fq);
      if (o.ff1 != null) {
        f.frequency.setValueAtTime(Math.max(20, (o.ff0 == null ? f0 * 2 : o.ff0 * rate)), t);
        f.frequency.exponentialRampToValueAtTime(Math.max(20, o.ff1 * rate), t + dur);
      }
      node.connect(f); node = f;
    }
    if (o.drive) { const s = this.shaper(o.drive); node.connect(s); node = s; }

    const g = this.gain(0);
    const dec = Math.max(0.005, dur - atk - hold);
    shapeEnv(g.gain, t, peak, atk, dec, hold, o.curve);
    node.connect(g);
    g.connect(o.dest || this.out);

    this.sched(osc, t, t + atk + hold + dec + 0.02);
    return g;
  };

  /**
   * 噪声层。
   * o: { t, dur, peak, atk, hold, curve, buf:'white'|'pink'|'grain',
   *      rate, type(滤波类型/'none'), f0, f1, fdur, q, hp, drive,
   *      am:{freq,depth,type}, dest }
   */
  Kit.prototype.nz = function (o) {
    const ctx = this.ctx;
    const t = this.t0 + (o.t || 0);
    const dur = Math.max(0.01, o.dur);
    const peak = (o.peak == null ? 0.3 : o.peak);
    const hold = o.hold || 0;
    const atk = Math.min(o.atk == null ? 0.004 : o.atk, dur * 0.6);
    const rate = this.rate;

    const bank = buffers(ctx);
    const src = ctx.createBufferSource();
    src.buffer = bank[o.buf || 'white'] || bank.white;
    src.loop = true;
    src.playbackRate.value = U.clamp(o.rate == null ? 1 : o.rate, 0.05, 8);
    this._reg(src);

    let node = src;
    if (o.type !== 'none') {
      const f0 = Math.max(20, (o.f0 == null ? 1200 : o.f0) * rate);
      const f = this.bq(o.type || 'lowpass', f0, o.q == null ? 0.8 : o.q);
      if (o.f1 != null) {
        f.frequency.setValueAtTime(f0, t);
        f.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1 * rate), t + (o.fdur == null ? dur : o.fdur));
      }
      node.connect(f); node = f;
    }
    if (o.hp) { const h = this.bq('highpass', o.hp * rate, 0.7); node.connect(h); node = h; }
    if (o.drive) { const s = this.shaper(o.drive); node.connect(s); node = s; }

    const g = this.gain(0);
    const dec = Math.max(0.005, dur - atk - hold);
    shapeEnv(g.gain, t, peak, atk, dec, hold, o.curve);
    node.connect(g);
    if (o.am) this.lfo(o.am.freq, peak * (o.am.depth == null ? 0.5 : o.am.depth), g.gain, t, atk + hold + dec, o.am.type);
    g.connect(o.dest || this.out);

    /* 每次从 buffer 的随机位置起播，避免机械重复感 */
    this.sched(src, t, t + atk + hold + dec + 0.03, this.rnd.range(0, 1.4));
    return g;
  };

  /** 启动全部源 + 结束时自动断开，避免节点泄漏。 */
  Kit.prototype.finish = function () {
    const list = this.srcs;
    let last = null, lastT = -1;
    for (let i = 0; i < list.length; i++) {
      const s = list[i];
      try { if (s.off != null && s.n.buffer) s.n.start(s.a, s.off); else s.n.start(s.a); } catch (e) { /* 已启动/参数越界，忽略 */ }
      try { if (s.n.stop) s.n.stop(s.b); } catch (e) { /* 忽略 */ }
      if (s.b > lastT) { lastT = s.b; last = s.n; }
    }
    const nodes = this.nodes;
    const kill = function () {
      for (let i = 0; i < nodes.length; i++) { try { nodes[i].disconnect(); } catch (e) { /* 忽略 */ } }
      nodes.length = 0;
    };
    if (last) { try { last.onended = kill; } catch (e) { kill(); } } else kill();
    return this.end;
  };

  /* ===================================================================
     音效合成表：SFX[name](kit, opts)
     每个函数只描述"声音长什么样"，与上下文无关。
     =================================================================== */
  const SFX = {

    /* ------------------------- 武器 ------------------------- */

    /** 机枪连射的单发：短促清脆的"哒"，尾巴带一点金属回响 */
    mg(k) {
      const r = k.rnd;
      k.nz({ dur: 0.06, peak: 0.5, atk: 0.0012, type: 'highpass', f0: 1500, f1: 700, q: 0.7 });
      k.nz({ dur: 0.028, peak: 0.3, atk: 0.001, type: 'bandpass', f0: r.range(2500, 3500), q: 1.1 });
      k.tone({ dur: 0.07, f0: r.range(180, 235), f1: 62, type: 'square', peak: 0.2, atk: 0.001 });
      k.tone({
        t: 0.014, dur: 0.14, f0: r.range(1100, 1500), type: 'triangle', peak: 0.06,
        atk: 0.003, filter: 'bandpass', ff0: 1700, fq: 5,
      });
    },

    /** 狙击枪：尖锐高频爆响 + 多次反射的长尾回声 */
    sniper(k) {
      const r = k.rnd;
      k.nz({ dur: 0.05, peak: 0.8, atk: 0.0008, type: 'bandpass', f0: r.range(3100, 3900), f1: 1700, q: 0.9 });
      k.nz({ dur: 0.1, peak: 0.4, atk: 0.001, type: 'highpass', f0: 2100, f1: 950, q: 0.7, drive: 0.6 });
      k.tone({ dur: 0.15, f0: 265, f1: 58, type: 'triangle', peak: 0.3, atk: 0.001 });
      const taps = [[0.10, 0.24], [0.21, 0.14], [0.37, 0.075], [0.56, 0.04]];
      for (let i = 0; i < taps.length; i++) {
        k.nz({
          t: taps[i][0] + r.range(0, 0.018), dur: 0.22, peak: taps[i][1], atk: 0.005,
          type: 'bandpass', f0: 1400, f1: 560, q: 0.8,
        });
      }
      k.nz({ t: 0.12, dur: 0.72, peak: 0.055, atk: 0.03, buf: 'pink', type: 'lowpass', f0: 700, f1: 190 });
    },

    /** 喷火：持续白噪 + 低频喷气，短促 */
    flame(k) {
      const r = k.rnd;
      k.nz({ dur: 0.34, peak: 0.34, atk: 0.03, buf: 'white', type: 'lowpass', f0: 1500, f1: 700, q: 0.8, curve: 'lin' });
      k.nz({ dur: 0.32, peak: 0.28, atk: 0.02, buf: 'pink', type: 'lowpass', f0: 240, f1: 120, q: 1.1, drive: 0.8 });
      k.nz({
        t: 0.01, dur: 0.3, peak: 0.14, atk: 0.015, type: 'bandpass', f0: r.range(380, 520), f1: 1100, q: 1.4,
        am: { freq: r.range(26, 38), depth: 0.55 },
      });
      k.nz({ t: 0.0, dur: 0.09, peak: 0.2, atk: 0.002, type: 'highpass', f0: 2600 });  // 点火"呲"
    },

    /** 火箭发射：上升扫频的"嗖" + 尾焰噪声 */
    rocket(k) {
      const r = k.rnd;
      k.tone({ dur: 0.2, f0: 130, f1: 42, type: 'triangle', peak: 0.4, atk: 0.002, drive: 0.7 });   // 发射冲击
      k.nz({ dur: 0.08, peak: 0.4, atk: 0.001, type: 'highpass', f0: 1800, f1: 800 });
      k.nz({
        t: 0.02, dur: 0.5, peak: 0.32, atk: 0.06, buf: 'white',
        type: 'bandpass', f0: r.range(280, 360), f1: r.range(2200, 2800), q: 3.2, curve: 'lin',
      });                                                                                            // 上升扫频
      k.nz({ t: 0.02, dur: 0.55, peak: 0.22, atk: 0.05, buf: 'pink', type: 'lowpass', f0: 900, f1: 260 });
      k.tone({ t: 0.02, dur: 0.45, f0: 90, f1: 320, type: 'sawtooth', peak: 0.1, atk: 0.08, filter: 'lowpass', ff0: 500, ff1: 1600, fq: 3 });
    },

    /** 轻型炮：干脆的中频炮响 */
    cannonLight(k) {
      const r = k.rnd;
      k.tone({ dur: 0.22, f0: r.range(200, 245), f1: 66, type: 'triangle', peak: 0.75, atk: 0.0015, drive: 1.0 });
      k.nz({ dur: 0.24, peak: 0.5, atk: 0.001, type: 'lowpass', f0: 2600, f1: 420, q: 0.9 });
      k.nz({ dur: 0.05, peak: 0.3, atk: 0.001, type: 'highpass', f0: 2400 });
      k.tone({ t: 0.02, dur: 0.18, f0: r.range(820, 1000), type: 'triangle', peak: 0.08, atk: 0.004, filter: 'bandpass', ff0: 950, fq: 6 });
    },

    /** 坦克炮：厚实低频炮响 + 金属余震 */
    cannon(k) {
      const r = k.rnd;
      k.tone({ dur: 0.45, f0: r.range(125, 148), f1: 36, type: 'sine', peak: 0.9, atk: 0.002, drive: 1.4 });
      k.tone({ dur: 0.3, f0: 78, f1: 28, type: 'triangle', peak: 0.45, atk: 0.004 });
      k.nz({ dur: 0.5, peak: 0.55, atk: 0.0015, buf: 'pink', type: 'lowpass', f0: 1700, f1: 200, q: 0.9 });
      k.nz({ dur: 0.06, peak: 0.35, atk: 0.001, type: 'highpass', f0: 2000, f1: 900 });
      k.nz({ t: 0.05, dur: 0.35, peak: 0.1, atk: 0.006, type: 'bandpass', f0: r.range(1500, 2000), q: 6 });  // 炮膛金属震
      k.nz({ t: 0.08, dur: 0.4, peak: 0.09, atk: 0.01, buf: 'grain', type: 'bandpass', f0: 1200, f1: 500, q: 1.2 });
    },

    /** 双联重炮：更低更沉，带二次冲击 */
    cannonHeavy(k) {
      const r = k.rnd;
      const hit = (t, v) => {
        k.tone({ t, dur: 0.6, f0: r.range(92, 108), f1: 26, type: 'sine', peak: 0.95 * v, atk: 0.003, drive: 1.6 });
        k.tone({ t, dur: 0.4, f0: 56, f1: 20, type: 'sine', peak: 0.55 * v, atk: 0.005 });
        k.nz({ t, dur: 0.62, peak: 0.5 * v, atk: 0.002, buf: 'pink', type: 'lowpass', f0: 1300, f1: 110, q: 0.9 });
        k.nz({ t, dur: 0.07, peak: 0.3 * v, atk: 0.001, type: 'highpass', f0: 1600, f1: 700 });
      };
      hit(0, 1);
      hit(0.14 + r.range(0, 0.02), 0.72);
      k.nz({ t: 0.2, dur: 0.5, peak: 0.1, atk: 0.02, buf: 'grain', type: 'bandpass', f0: 900, f1: 380, q: 1.1 });
    },

    /** 榴弹炮：极低频闷响 + 长衰减 */
    artillery(k) {
      const r = k.rnd;
      k.tone({ dur: 1.1, f0: r.range(66, 78), f1: 19, type: 'sine', peak: 1.0, atk: 0.004, drive: 1.2 });
      k.tone({ dur: 0.8, f0: 44, f1: 16, type: 'sine', peak: 0.6, atk: 0.008 });
      k.nz({ dur: 1.2, peak: 0.45, atk: 0.004, buf: 'pink', type: 'lowpass', f0: 520, f1: 60, q: 1.0 });
      k.nz({ dur: 0.12, peak: 0.3, atk: 0.002, type: 'bandpass', f0: 900, f1: 300, q: 0.8 });
      k.nz({ t: 0.05, dur: 0.9, peak: 0.06, atk: 0.05, buf: 'pink', type: 'lowpass', f0: 200, f1: 70 });  // 余荡
    },

    /** 高炮：连续的噗噗爆响（一次调用给一小串） */
    flak(k) {
      const r = k.rnd;
      const n = r.int(3, 4);
      let t = 0;
      for (let i = 0; i < n; i++) {
        const v = 1 - i * 0.13;
        k.nz({ t, dur: 0.1, peak: 0.42 * v, atk: 0.0015, type: 'bandpass', f0: r.range(600, 820), f1: 300, q: 1.5 });
        k.tone({ t, dur: 0.09, f0: r.range(150, 190), f1: 55, type: 'square', peak: 0.22 * v, atk: 0.001 });
        k.nz({ t, dur: 0.05, peak: 0.16 * v, atk: 0.001, type: 'highpass', f0: 2200 });
        t += r.range(0.062, 0.085);
      }
      k.nz({ t: 0.02, dur: 0.35, peak: 0.07, atk: 0.02, buf: 'pink', type: 'lowpass', f0: 400, f1: 140 });
    },

    /** 离子炮：充能上升扫频 → 撕裂白噪 → 巨大低频轰鸣（超级武器分量） */
    ion(k) {
      const r = k.rnd;
      const cd = 0.62;                                  // 充能时长
      const g1 = k.tone({
        dur: cd, f0: 52, f1: 760, type: 'sawtooth', peak: 0.3, atk: 0.3, curve: 'lin',
        filter: 'lowpass', ff0: 380, ff1: 4200, fq: 4,
      });
      const g2 = k.tone({
        dur: cd, f0: 79, f1: 1160, type: 'sawtooth', peak: 0.16, atk: 0.34, curve: 'lin',
        detune: 14, filter: 'bandpass', ff0: 600, ff1: 3600, fq: 2,
      });
      k.lfo(17, 0.08, g1.gain, k.t0, cd);               // 充能颤动
      k.lfo(23, 0.05, g2.gain, k.t0, cd);
      k.nz({ dur: cd, peak: 0.1, atk: 0.3, type: 'bandpass', f0: 900, f1: 5200, q: 2.5, curve: 'lin' });

      /* 撕裂 */
      k.nz({ t: 0.5, dur: 0.34, peak: 0.5, atk: 0.02, type: 'highpass', f0: 3200, f1: 700, q: 0.9, drive: 1.2 });
      k.nz({ t: 0.52, dur: 0.3, peak: 0.3, atk: 0.01, type: 'bandpass', f0: 5200, f1: 1100, q: 1.5, drive: 2.5 });
      k.tone({ t: 0.5, dur: 0.28, f0: 2600, f1: 180, type: 'sawtooth', peak: 0.16, atk: 0.006, filter: 'bandpass', ff0: 3000, ff1: 500, fq: 3 });

      /* 轰鸣 */
      const bt = 0.66;
      k.tone({ t: bt, dur: 1.0, f0: r.range(130, 150), f1: 25, type: 'sine', peak: 1.0, atk: 0.005, drive: 1.8 });
      k.tone({ t: bt, dur: 1.1, f0: 60, f1: 16, type: 'sine', peak: 0.7, atk: 0.01 });
      k.nz({ t: bt, dur: 1.0, peak: 0.55, atk: 0.006, buf: 'pink', type: 'lowpass', f0: 1500, f1: 85, q: 0.9 });
      k.nz({ t: bt + 0.06, dur: 0.85, peak: 0.2, atk: 0.02, buf: 'grain', type: 'bandpass', f0: 2200, f1: 520, q: 1.2 });
      k.nz({ t: bt + 0.2, dur: 0.8, peak: 0.08, atk: 0.1, buf: 'pink', type: 'lowpass', f0: 260, f1: 70 });
    },

    /* ------------------------- 命中 / 爆炸 ------------------------- */

    /** 弹药打在装甲上的"叮" */
    hitSmall(k) {
      const r = k.rnd;
      k.nz({ dur: 0.03, peak: 0.4, atk: 0.0008, type: 'bandpass', f0: r.range(3000, 4200), q: 1.2 });
      k.nz({ dur: 0.05, peak: 0.18, atk: 0.001, type: 'highpass', f0: 5200 });
      k.tone({ dur: 0.11, f0: r.range(2100, 2800), type: 'triangle', peak: 0.14, atk: 0.001, filter: 'bandpass', ff0: 2600, fq: 8 });
      k.tone({ dur: 0.05, f0: 320, f1: 120, type: 'square', peak: 0.1, atk: 0.001 });
    },

    /** 打中步兵的闷响 */
    hitFlesh(k) {
      const r = k.rnd;
      k.tone({ dur: 0.13, f0: r.range(140, 180), f1: 52, type: 'sine', peak: 0.4, atk: 0.0015, drive: 0.8 });
      k.nz({ dur: 0.1, peak: 0.28, atk: 0.001, type: 'lowpass', f0: 500, f1: 160, q: 1.2 });
      k.nz({ dur: 0.04, peak: 0.1, atk: 0.001, type: 'bandpass', f0: 1200, q: 1.0 });
    },

    boomSmall(k) {
      const r = k.rnd;
      k.tone({ dur: 0.32, f0: r.range(150, 180), f1: 42, type: 'sine', peak: 0.8, atk: 0.002, drive: 1.3 });
      k.nz({ dur: 0.36, peak: 0.55, atk: 0.0015, buf: 'pink', type: 'lowpass', f0: 2100, f1: 260, q: 0.9 });
      k.nz({ dur: 0.06, peak: 0.32, atk: 0.001, type: 'highpass', f0: 2200, f1: 900 });
      k.nz({ t: 0.04, dur: 0.28, peak: 0.1, atk: 0.01, buf: 'grain', type: 'bandpass', f0: 1800, f1: 700, q: 1.2 });
    },

    boomMedium(k) {
      const r = k.rnd;
      k.tone({ dur: 0.55, f0: r.range(100, 122), f1: 32, type: 'sine', peak: 0.95, atk: 0.003, drive: 1.6 });
      k.tone({ dur: 0.35, f0: 62, f1: 22, type: 'sine', peak: 0.5, atk: 0.006 });
      k.nz({ dur: 0.6, peak: 0.6, atk: 0.002, buf: 'pink', type: 'lowpass', f0: 1500, f1: 170, q: 0.9 });
      k.nz({ dur: 0.08, peak: 0.35, atk: 0.001, type: 'highpass', f0: 1800, f1: 700 });
      k.nz({ t: 0.06, dur: 0.45, peak: 0.14, atk: 0.012, buf: 'grain', type: 'bandpass', f0: 1500, f1: 480, q: 1.1 });
    },

    boomLarge(k) {
      const r = k.rnd;
      k.tone({ dur: 0.85, f0: r.range(78, 92), f1: 23, type: 'sine', peak: 1.0, atk: 0.004, drive: 1.9 });
      k.tone({ dur: 0.6, f0: 48, f1: 17, type: 'sine', peak: 0.65, atk: 0.008 });
      k.nz({ dur: 0.9, peak: 0.6, atk: 0.002, buf: 'pink', type: 'lowpass', f0: 1100, f1: 100, q: 0.9 });
      k.nz({ dur: 0.1, peak: 0.4, atk: 0.001, type: 'highpass', f0: 1500, f1: 600 });
      k.nz({ t: 0.07, dur: 0.7, peak: 0.18, atk: 0.015, buf: 'grain', type: 'bandpass', f0: 1300, f1: 380, q: 1.1 });
      k.nz({ t: 0.15, dur: 0.7, peak: 0.08, atk: 0.08, buf: 'pink', type: 'lowpass', f0: 280, f1: 80 });
    },

    /** 建筑倒塌：低频轰鸣 + 长长的碎裂噪声 */
    boomBuilding(k) {
      const r = k.rnd;
      k.tone({ dur: 1.3, f0: r.range(58, 70), f1: 17, type: 'sine', peak: 1.0, atk: 0.006, drive: 1.6 });
      k.tone({ dur: 0.9, f0: 38, f1: 14, type: 'sine', peak: 0.6, atk: 0.012 });
      k.nz({ dur: 1.2, peak: 0.5, atk: 0.004, buf: 'pink', type: 'lowpass', f0: 900, f1: 80, q: 0.9 });
      k.nz({ dur: 0.12, peak: 0.35, atk: 0.002, type: 'highpass', f0: 1400, f1: 500 });
      /* 碎裂：颗粒噪声 + 慢速调制，持续到 1.6s */
      k.nz({
        t: 0.08, dur: 1.5, peak: 0.24, atk: 0.05, buf: 'grain', type: 'bandpass', f0: 2000, f1: 420, q: 1.0,
        am: { freq: r.range(6, 10), depth: 0.6 },
      });
      k.nz({ t: 0.3, dur: 1.2, peak: 0.12, atk: 0.15, buf: 'grain', type: 'highpass', f0: 2600, q: 0.7 });
      k.nz({ t: 0.4, dur: 1.1, peak: 0.09, atk: 0.2, buf: 'pink', type: 'lowpass', f0: 240, f1: 60 });
    },

    /** 电力不足：下行扫频，像机器停转 */
    powerDown(k) {
      const r = k.rnd;
      const g = k.tone({
        dur: 0.95, f0: r.range(380, 430), f1: 38, type: 'sawtooth', peak: 0.3, atk: 0.02,
        filter: 'lowpass', ff0: 1800, ff1: 180, fq: 3,
      });
      k.lfo(7, 0.06, g.gain, k.t0, 0.95);
      k.tone({ dur: 1.0, f0: 190, f1: 24, type: 'triangle', peak: 0.2, atk: 0.03 });
      k.nz({ dur: 1.0, peak: 0.16, atk: 0.02, buf: 'pink', type: 'lowpass', f0: 1200, f1: 90, q: 1.1 });
      k.tone({ t: 0.9, dur: 0.16, f0: 90, f1: 40, type: 'sine', peak: 0.25, atk: 0.004 });   // 停机闷响
    },

    /* ------------------------- 经济 / 建造 ------------------------- */

    /** 建造中的一下敲击（逻辑层按节奏反复调用） */
    build(k) {
      const r = k.rnd;
      k.nz({ dur: 0.05, peak: 0.3, atk: 0.001, type: 'bandpass', f0: r.range(1000, 1400), q: 2 });
      k.tone({ dur: 0.09, f0: r.range(280, 340), f1: 130, type: 'triangle', peak: 0.28, atk: 0.001, drive: 0.6 });
      k.tone({ t: 0.006, dur: 0.16, f0: r.range(1900, 2400), type: 'triangle', peak: 0.07, atk: 0.002, filter: 'bandpass', ff0: 2200, fq: 9 });
      k.nz({ dur: 0.02, peak: 0.14, atk: 0.0008, type: 'highpass', f0: 3200 });
    },

    /** 落成：清亮上行三音 */
    buildDone(k) {
      const notes = [523.25, 659.25, 880];
      for (let i = 0; i < notes.length; i++) {
        const t = i * 0.095;
        k.tone({ t, dur: 0.2, f0: notes[i], type: 'triangle', peak: 0.3, atk: 0.006, filter: 'lowpass', ff0: 4200, fq: 0.9 });
        k.tone({ t, dur: 0.14, f0: notes[i] * 2, type: 'sine', peak: 0.09, atk: 0.005 });
      }
      k.tone({ t: 0.19, dur: 0.5, f0: 1760, type: 'sine', peak: 0.06, atk: 0.02 });      // 尾部微光
      k.nz({ t: 0, dur: 0.1, peak: 0.05, atk: 0.004, type: 'highpass', f0: 4000 });
    },

    /** 放置建筑：夯实闷响 + 扬尘 */
    place(k) {
      const r = k.rnd;
      k.tone({ dur: 0.28, f0: r.range(86, 100), f1: 36, type: 'sine', peak: 0.7, atk: 0.003, drive: 1.1 });
      k.nz({ dur: 0.22, peak: 0.35, atk: 0.002, type: 'lowpass', f0: 650, f1: 150, q: 1.2 });
      k.nz({ t: 0.02, dur: 0.4, peak: 0.1, atk: 0.03, buf: 'grain', type: 'bandpass', f0: 1400, f1: 500, q: 1.0 });
      k.nz({ t: 0.03, dur: 0.35, peak: 0.07, atk: 0.05, type: 'highpass', f0: 2600 });
    },

    /** 卖出：下行金属音 */
    sell(k) {
      const notes = [880, 660, 440];
      for (let i = 0; i < notes.length; i++) {
        const t = i * 0.075;
        k.tone({ t, dur: 0.16, f0: notes[i], type: 'square', peak: 0.16, atk: 0.003, filter: 'bandpass', ff0: notes[i] * 1.5, fq: 2.2 });
        k.tone({ t, dur: 0.1, f0: notes[i] * 0.5, type: 'triangle', peak: 0.08, atk: 0.003 });
      }
      k.nz({ t: 0.16, dur: 0.3, peak: 0.08, atk: 0.01, buf: 'grain', type: 'bandpass', f0: 1600, f1: 700, q: 1.4 });
    },

    /** 矿车卸矿：颗粒倾泻 */
    oreDump(k) {
      const r = k.rnd;
      k.nz({
        dur: 0.75, peak: 0.34, atk: 0.06, buf: 'grain', type: 'bandpass', f0: r.range(1400, 1800), f1: 600, q: 0.9,
        am: { freq: r.range(22, 30), depth: 0.5 }, curve: 'lin',
      });
      k.nz({ dur: 0.7, peak: 0.18, atk: 0.05, buf: 'pink', type: 'lowpass', f0: 420, f1: 130, q: 1.0 });
      k.nz({ t: 0.05, dur: 0.6, peak: 0.12, atk: 0.08, type: 'highpass', f0: 3000 });
      k.tone({ t: 0.55, dur: 0.25, f0: 110, f1: 45, type: 'sine', peak: 0.3, atk: 0.004 });   // 斗底砸落
    },

    /** 进账：小清脆音（高频调用，已限流） */
    credit(k) {
      const r = k.rnd;
      const f = r.range(1350, 1500);
      k.tone({ dur: 0.075, f0: f, type: 'sine', peak: 0.2, atk: 0.002 });
      k.tone({ t: 0.028, dur: 0.09, f0: f * 1.5, type: 'sine', peak: 0.14, atk: 0.002 });
      k.nz({ dur: 0.02, peak: 0.05, atk: 0.001, type: 'highpass', f0: 5000 });
    },

    /* ------------------------- UI ------------------------- */

    click(k) {
      k.tone({ dur: 0.045, f0: 900, f1: 700, type: 'square', peak: 0.2, atk: 0.001, filter: 'bandpass', ff0: 1400, fq: 1.6 });
      k.nz({ dur: 0.018, peak: 0.1, atk: 0.0008, type: 'highpass', f0: 3000 });
    },

    /** 不可用：低沉否定音（两声） */
    deny(k) {
      for (let i = 0; i < 2; i++) {
        const t = i * 0.11;
        k.tone({ t, dur: 0.1, f0: 165, f1: 132, type: 'sawtooth', peak: 0.26, atk: 0.003, filter: 'lowpass', ff0: 700, fq: 2.5 });
        k.tone({ t, dur: 0.09, f0: 82, type: 'sine', peak: 0.14, atk: 0.003 });
      }
      k.nz({ dur: 0.22, peak: 0.05, atk: 0.01, type: 'lowpass', f0: 400, f1: 180 });
    },

    /** 选中单位：短促电子音 */
    select(k) {
      k.tone({ dur: 0.045, f0: 1180, type: 'square', peak: 0.13, atk: 0.001, filter: 'bandpass', ff0: 1600, fq: 2 });
      k.tone({ t: 0.05, dur: 0.06, f0: 1620, type: 'square', peak: 0.12, atk: 0.001, filter: 'bandpass', ff0: 2100, fq: 2 });
      k.nz({ dur: 0.015, peak: 0.05, atk: 0.0008, type: 'highpass', f0: 4200 });
    },

    /** 下达命令：上行确认音 */
    order(k) {
      k.tone({ dur: 0.14, f0: 700, f1: 1050, type: 'triangle', peak: 0.2, atk: 0.004, filter: 'lowpass', ff0: 3000, fq: 1 });
      k.tone({ t: 0.02, dur: 0.1, f0: 1400, f1: 2100, type: 'sine', peak: 0.07, atk: 0.004 });
      k.nz({ dur: 0.02, peak: 0.05, atk: 0.001, type: 'highpass', f0: 4000 });
    },

    /** 切换分类 */
    tab(k) {
      k.tone({ dur: 0.06, f0: 820, f1: 560, type: 'triangle', peak: 0.17, atk: 0.002, filter: 'bandpass', ff0: 1200, fq: 1.4 });
      k.nz({ dur: 0.02, peak: 0.06, atk: 0.001, type: 'highpass', f0: 3400 });
    },
  };

  /* ===================================================================
     播报（vo）：无线电静电 + 不同音高音型，靠音型区分紧急程度
     seq 里每个元素 { f, f1?, d?, gap?, v? }
     =================================================================== */
  function radio(k, seq, o) {
    o = o || {};
    const timbre = o.type || 'square';
    const peak = o.peak == null ? 0.3 : o.peak;
    const dGap = o.gap == null ? 0.045 : o.gap;

    /* 开启无线电的静电小爆 */
    k.nz({ dur: 0.05, peak: 0.1, atk: 0.002, type: 'bandpass', f0: 2600, q: 1.1 });
    k.nz({ dur: 0.03, peak: 0.05, atk: 0.001, type: 'highpass', f0: 4000 });

    let t = 0.055;
    for (let i = 0; i < seq.length; i++) {
      const n = seq[i];
      const d = n.d == null ? (o.d == null ? 0.12 : o.d) : n.d;
      const v = n.v == null ? 1 : n.v;
      k.tone({
        t, dur: d, f0: n.f, f1: n.f1, type: timbre, peak: peak * v, atk: 0.006,
        filter: 'bandpass', ff0: n.f * 1.25, fq: 1.6,
      });
      k.tone({ t, dur: d * 0.85, f0: n.f * 2, type: 'sine', peak: peak * 0.16 * v, atk: 0.006 });
      k.nz({ t, dur: d, peak: 0.028, atk: 0.004, type: 'bandpass', f0: 1800, q: 0.8, curve: 'lin' });
      t += d + (n.gap == null ? dGap : n.gap);
    }
    /* 收尾静电 */
    k.nz({ t: t + 0.01, dur: 0.07, peak: 0.075, atk: 0.003, type: 'highpass', f0: 2200, f1: 1400 });
    return t;
  }

  const VO = {
    /** 单位就绪：平稳上行两音 */
    unitReady(k) { radio(k, [{ f: 659 }, { f: 880 }]); },
    /** 建筑落成：明亮上行三音 */
    buildingReady(k) { radio(k, [{ f: 523 }, { f: 659 }, { f: 784, d: 0.18 }]); },
    /** 电力不足：下行两音 + 低沉音色 */
    needPower(k) { radio(k, [{ f: 440, d: 0.14 }, { f: 311, d: 0.22 }], { type: 'triangle', peak: 0.3 }); },
    /** 资金不足：两短一低 */
    needCredits(k) { radio(k, [{ f: 392, d: 0.1 }, { f: 392, d: 0.1 }, { f: 294, d: 0.2 }], { gap: 0.04 }); },
    /** 基地受袭：紧急下行警报（锯齿音色 + 快节奏 + 更响） */
    baseAttack(k) {
      radio(k, [
        { f: 988, d: 0.1 }, { f: 659, d: 0.1 }, { f: 988, d: 0.1 }, { f: 659, d: 0.18 },
      ], { type: 'sawtooth', peak: 0.34, gap: 0.02 });
      k.nz({ t: 0.02, dur: 0.6, peak: 0.05, atk: 0.05, buf: 'pink', type: 'lowpass', f0: 500, f1: 180 });
    },
    /** 单位损失：低沉下行两音 */
    unitLost(k) { radio(k, [{ f: 330, d: 0.13 }, { f: 247, d: 0.22 }], { type: 'triangle', peak: 0.24 }); },
    /** 离子炮就绪：高亮上行三音 + 充能微光 */
    ionReady(k) {
      radio(k, [{ f: 784, d: 0.1 }, { f: 988, d: 0.1 }, { f: 1319, d: 0.26 }], { peak: 0.3, gap: 0.03 });
      k.tone({ t: 0.5, dur: 0.5, f0: 1319, f1: 2637, type: 'sine', peak: 0.07, atk: 0.06 });
    },
    /** 胜利：上行凯歌音型 */
    victory(k) {
      radio(k, [
        { f: 523, d: 0.14 }, { f: 659, d: 0.14 }, { f: 784, d: 0.14 }, { f: 1047, d: 0.36 },
      ], { gap: 0.02, peak: 0.32, type: 'square' });
      k.tone({ t: 0.55, dur: 0.6, f0: 1568, type: 'sine', peak: 0.07, atk: 0.05 });
    },
    /** 失败：缓慢下行低沉音型 */
    defeat(k) {
      radio(k, [
        { f: 392, d: 0.18 }, { f: 330, d: 0.18 }, { f: 262, d: 0.2 }, { f: 196, d: 0.42 },
      ], { gap: 0.03, peak: 0.3, type: 'triangle' });
      k.tone({ t: 0.8, dur: 0.6, f0: 98, f1: 62, type: 'sine', peak: 0.18, atk: 0.05 });
    },
  };

  /* ===================================================================
     运行时状态与母线
     =================================================================== */
  const AC = root.AudioContext || root.webkitAudioContext || null;

  let ctx = null;                 // 实时 AudioContext
  let master = null, comp = null, sfxBus = null, voiceBus = null;
  let muted = false;
  const vols = { master: 0.85, sfx: 0.9, voice: 1.0 };

  const rnd = mkRng(0xC0FFEE);

  /* 限流状态 */
  const lastAt = Object.create(null);   // 音效名 → 上次发声时刻(ms)
  const voLastAt = Object.create(null);
  let voLastAny = -1e9;
  let voices = [];                      // 活跃发声的结束时刻（ctx 时间）
  let frameNew = 0;                     // 本帧已新增的发声数
  let frameStamp = -1;                   // 本帧计数的时间戳（ctx 时间）

  /* 监听状态 */
  let camX = 0, camY = 0, zoom = 1;

  function nowMs() {
    if (ctx) return ctx.currentTime * 1000;
    return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  }

  function buildBus() {
    master = ctx.createGain();
    master.gain.value = muted ? 0 : vols.master;
    sfxBus = ctx.createGain();
    sfxBus.gain.value = vols.sfx;
    voiceBus = ctx.createGain();
    voiceBus.gain.value = vols.voice;
    sfxBus.connect(master);
    voiceBus.connect(master);
    if (ctx.createDynamicsCompressor) {
      comp = ctx.createDynamicsCompressor();
      try {
        comp.threshold.value = -14;
        comp.knee.value = 22;
        comp.ratio.value = 3.5;
        comp.attack.value = 0.004;
        comp.release.value = 0.22;
      } catch (e) { /* 部分实现只读，忽略 */ }
      master.connect(comp);
      comp.connect(ctx.destination);
    } else {
      comp = null;
      master.connect(ctx.destination);
    }
  }

  function pruneVoices() {
    if (!ctx || voices.length === 0) return;
    const t = ctx.currentTime;
    let w = 0;
    for (let i = 0; i < voices.length; i++) if (voices[i] > t) voices[w++] = voices[i];
    voices.length = w;
  }

  /* ===================================================================
     核心：把一个音效渲染到任意 BaseAudioContext（实时 or 离线）
     name  : SFX 或 VO 里的名字
     when  : ctx 时间轴上的起始时刻
     opts  : { vol, rate, pan, dest }
     返回  : 该次发声的预计时长（秒），未知名字返回 null
     =================================================================== */
  function _render(ctx2, name, when, opts, dest) {
    if (!ctx2 || !name) return null;
    const fn = SFX[name] || VO[name];
    if (!fn) return null;
    opts = opts || {};

    const t = Math.max(0, when == null ? 0 : when);
    const trim = TRIM[name] == null ? 1 : TRIM[name];
    const head = ctx2.createGain();
    head.gain.value = U.clamp((opts.vol == null ? 1 : opts.vol) * trim, 0, 4);

    let tail = head;
    if (opts.pan != null && ctx2.createStereoPanner) {
      const p = ctx2.createStereoPanner();
      p.pan.value = U.clamp(opts.pan, -1, 1);
      head.connect(p);
      tail = p;
    }
    const out = dest || opts.dest || ctx2.destination;
    try { tail.connect(out); } catch (e) { return null; }

    const kit = new Kit(ctx2, head, t, rnd, U.clamp(opts.rate == null ? 1 : opts.rate, 0.25, 4));
    kit.nodes.push(head);
    if (tail !== head) kit.nodes.push(tail);
    try {
      fn(kit, opts);
    } catch (e) {
      try { head.disconnect(); tail.disconnect(); } catch (e2) { /* 忽略 */ }
      return null;
    }
    kit.finish();
    return Math.max(0.02, kit.end - t);
  }

  /** 限流判定：通过返回 true 并记账 */
  function allow(name, prio) {
    const ms = nowMs();
    const gap = GAP[name] == null ? DEF_GAP : GAP[name];
    const last = lastAt[name];
    if (last != null && ms - last < gap) return false;

    /* 兜底：万一主程序忘了每帧调 update()，也不能永久哑掉 —— 50ms 后自动复位。 */
    const nowSec = ms * 0.001;
    if (frameStamp < 0 || nowSec - frameStamp > 0.05) { frameNew = 0; frameStamp = nowSec; }

    pruneVoices();
    /* 低优先级留出余量给重要音效 */
    const cap = MAX_VOICES - (prio >= 3 ? 0 : (prio >= 2 ? 3 : 7));
    if (voices.length >= cap) return false;
    if (frameNew >= MAX_NEW_PER_FRAME && prio < 3) return false;

    lastAt[name] = ms;
    return true;
  }

  function fire(name, opts, bus) {
    const dur = _render(ctx, name, ctx.currentTime + LOOKAHEAD, opts, bus);
    if (dur == null) return false;
    voices.push(ctx.currentTime + dur + LOOKAHEAD);
    frameNew++;
    return true;
  }

  /* ===================================================================
     公开 API
     =================================================================== */
  const Audio = {
    /** AudioContext 就绪标记；无 WebAudio 的环境恒为 false */
    ready: false,

    /** 全部可用的音效名（play/ui） */
    names() { return Object.keys(SFX); },
    /** 全部播报名（vo） */
    voNames() { return Object.keys(VO); },
    /** 名字是否有实现（音效或播报） */
    has(name) { return !!(SFX[name] || VO[name]); },

    /**
     * 首次用户手势时调用。创建 AudioContext + 母线；可重复调用。
     * 返回是否可用。
     */
    init() {
      if (!AC) { this.ready = false; return false; }
      try {
        if (!ctx) {
          ctx = new AC({ latencyHint: 'interactive' });
          buildBus();
        }
        if (ctx.state === 'suspended' && ctx.resume) {
          const p = ctx.resume();
          if (p && p.catch) p.catch(function () { /* 仍未获得手势授权，忽略 */ });
        }
        /* 预生成噪声 buffer，避免第一枪时卡顿 */
        buffers(ctx);
        this.ready = true;
        this.ctx = ctx;
        return true;
      } catch (e) {
        ctx = null; master = null; comp = null; sfxBus = null; voiceBus = null;
        this.ready = false;
        return false;
      }
    },

    /** 每帧调用：更新监听中心 / 缩放，复位每帧限流，回收过期发声记录。 */
    update(dt, cx, cy, zm) {
      frameNew = 0;
      frameStamp = nowMs() * 0.001;
      if (typeof cx === 'number' && isFinite(cx)) camX = cx;
      if (typeof cy === 'number' && isFinite(cy)) camY = cy;
      if (typeof zm === 'number' && isFinite(zm) && zm > 0) zoom = U.clamp(zm, 0.25, 4);
      pruneVoices();
      return this;
    },

    /**
     * 世界坐标音效：按与摄像机中心的距离衰减 + 左右声道；太远直接丢弃。
     * opts: { vol, rate, pan }
     */
    play(name, x, y, opts) {
      if (!this.ready || !ctx || muted) return false;
      const fn = SFX[name] || VO[name];
      if (!fn) return false;

      const prio = PRIO[name] == null ? DEF_PRIO : PRIO[name];
      const zk = 1 / zoom;
      const maxD = MAX_DIST * zk;
      let att = 1, pan = 0;
      if (typeof x === 'number' && typeof y === 'number' && isFinite(x) && isFinite(y)) {
        const dx = x - camX, dy = y - camY;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > maxD) return false;                       // 屏幕外很远：丢弃
        att = 1 - d / maxD;
        att = att * att * 0.85 + att * 0.15;              // 近处更饱满，远处更快掉
        pan = U.clamp(dx / (PAN_SPAN * zk), -1, 1) * 0.85;
      }
      if (!allow(name, prio)) return false;

      const o = opts || {};
      const vol = U.clamp01((o.vol == null ? 1 : o.vol) * att) * rnd.range(0.9, 1.05);
      if (vol <= 0.0015) return false;
      return fire(name, {
        vol,
        rate: (o.rate == null ? 1 : o.rate) * rnd.range(0.955, 1.05),
        pan: (o.pan == null ? pan : U.clamp(o.pan, -1, 1)),
      }, sfxBus);
    },

    /** 无位置的 UI / 播报音（不做距离衰减） */
    ui(name, opts) {
      if (!this.ready || !ctx || muted) return false;
      if (!(SFX[name] || VO[name])) return false;
      const prio = PRIO[name] == null ? DEF_PRIO : PRIO[name];
      if (!allow(name, prio)) return false;
      const o = opts || {};
      return fire(name, {
        vol: U.clamp01(o.vol == null ? 0.9 : o.vol) * rnd.range(0.96, 1.02),
        rate: (o.rate == null ? 1 : o.rate) * rnd.range(0.985, 1.015),
        pan: o.pan == null ? 0 : U.clamp(o.pan, -1, 1),
      }, sfxBus);
    },

    /** 语音播报（合成无线电提示音） */
    vo(name) {
      if (!this.ready || !ctx || muted) return false;
      if (!VO[name]) return false;
      const ms = nowMs();
      if (ms - voLastAny < VO_GLOBAL_GAP) return false;
      const last = voLastAt[name];
      if (last != null && ms - last < VO_GAP) return false;
      pruneVoices();
      if (voices.length >= MAX_VOICES) return false;
      voLastAt[name] = ms;
      voLastAny = ms;
      return fire(name, { vol: 1, rate: 1 }, voiceBus);
    },

    /** 音量 0..1；参数可缺省（只改传入的那几个） */
    setVolume(m, s, v) {
      if (typeof m === 'number' && isFinite(m)) vols.master = U.clamp01(m);
      if (typeof s === 'number' && isFinite(s)) vols.sfx = U.clamp01(s);
      if (typeof v === 'number' && isFinite(v)) vols.voice = U.clamp01(v);
      if (!ctx) return this;
      const t = ctx.currentTime;
      try {
        master.gain.setTargetAtTime(muted ? 0 : vols.master, t, 0.02);
        sfxBus.gain.setTargetAtTime(vols.sfx, t, 0.02);
        voiceBus.gain.setTargetAtTime(vols.voice, t, 0.02);
      } catch (e) { /* 忽略 */ }
      return this;
    },

    get muted() { return muted; },
    set muted(v) {
      muted = !!v;
      if (!ctx || !master) return;
      try { master.gain.setTargetAtTime(muted ? 0 : vols.master, ctx.currentTime, 0.02); } catch (e) { /* 忽略 */ }
    },

    /** 当前音量快照（调试/存档用） */
    volumes() { return { master: vols.master, sfx: vols.sfx, voice: vols.voice }; },
    /** 当前活跃发声数（调试用） */
    get activeVoices() { return voices.length; },

    /**
     * 把某个音效渲染进指定的 BaseAudioContext（含 OfflineAudioContext）。
     * 离线校验与实时播放共用同一份合成代码。
     */
    render(ctx2, name, when, opts, dest) { return _render(ctx2, name, when, opts, dest); },
    /** 同 render（内部名，便于测试脚本直呼） */
    _render,
  };

  R.Audio = Audio;

})();
