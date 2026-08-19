/**
 * 程序化音频引擎 —— 纯 WebAudio 合成，零外部音频文件、零网络请求。
 *
 * 设计要点：
 * - 所有触发音效在 play() 调用瞬间直接调度（基于 AudioContext.currentTime），
 *   不经过 setTimeout / requestAnimationFrame 排队，保证"调用即发声"，延迟 < 20ms。
 * - 在无 AudioContext 的环境（Node / 测试）中，整个模块退化为 no-op：
 *   import 与 createAudioEngine() 均不抛异常，所有方法安全空转。
 * - 主输出经过"总 GainNode（默认 0.6）→ DynamicsCompressor → destination"，
 *   防止多音叠加爆音。
 */

/** 所有可播放音效的名字（与战斗系统对齐） */
export type SfxName =
  | 'ui_hover' | 'ui_click' | 'ui_back' | 'ui_denied'
  | 'perfect_block'   // 独特的高频金属声 + 短促金属尾音（最重要）
  | 'normal_block'    // 较低沉的撞击声
  | 'block_fail'      // 闷响
  | 'prompt_rise'     // 连协提示出现前的轻微升调音
  | 'hit_physical' | 'hit_fire' | 'hit_ice' | 'hit_lightning' | 'hit_earth' | 'hit_light' | 'hit_dark'
  | 'crit' | 'weakness' | 'heal' | 'shield_break' | 'break_gauge'
  | 'counter_start' | 'counter_hit'
  | 'boss_telegraph' | 'boss_roar' | 'phase_shift'
  | 'aim_shot' | 'weakpoint_break'
  | 'death' | 'revive' | 'victory' | 'defeat' | 'inverted_warn';

/** 音频引擎对外接口（签名不可更改） */
export interface AudioEngine {
  /** 必须在用户手势里调用一次，用于解锁浏览器自动播放限制 */
  unlock(): Promise<void>;
  play(name: SfxName, opts?: { gain?: number; detune?: number }): void;
  /** 循环环境音（低沉风声 + 远处颜料滴落），可随阶段变化 */
  startAmbient(): void;
  stopAmbient(): void;
  setPhase(phase: number): void;
  setMasterVolume(v: number): void;   // 0..1
  getMasterVolume(): number;
  setMuted(m: boolean): void;
  isMuted(): boolean;
  /** 慢动作时整体降调（反击慢镜） */
  setTimeScale(scale: number): void;
  suspend(): void;   // 页面失焦
  resume(): void;
  dispose(): void;
}

/** 各音效的基础响度（相对值，最终再乘 opts.gain） */
const BASE_GAIN: Record<SfxName, number> = {
  ui_hover: 0.16, ui_click: 0.3, ui_back: 0.22, ui_denied: 0.3,
  perfect_block: 0.85, normal_block: 0.6, block_fail: 0.5, prompt_rise: 0.22,
  hit_physical: 0.6, hit_fire: 0.6, hit_ice: 0.6, hit_lightning: 0.65,
  hit_earth: 0.6, hit_light: 0.55, hit_dark: 0.6,
  crit: 0.7, weakness: 0.5, heal: 0.5, shield_break: 0.7, break_gauge: 0.5,
  counter_start: 0.55, counter_hit: 0.85,
  boss_telegraph: 0.55, boss_roar: 0.85, phase_shift: 0.6,
  aim_shot: 0.6, weakpoint_break: 0.8,
  death: 0.7, revive: 0.55, victory: 0.7, defeat: 0.6, inverted_warn: 0.55,
};

/** 极小增益下限，避免指数包络碰到 0（WebAudio 指数斜坡不允许 0） */
const EPS = 1e-4;

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function createAudioEngine(): AudioEngine {
  return new AudioEngineImpl();
}

class AudioEngineImpl implements AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private comp: DynamicsCompressorNode | null = null;

  private masterVolume = 0.6;
  private muted = false;
  private timeScale = 1;
  /** dispose() 之后彻底停用：不再新建上下文，所有方法退化为 no-op */
  private disposed = false;

  // 环境音状态
  private ambientRunning = false;
  private ambientTimer: ReturnType<typeof setInterval> | null = null;
  private ambientPhase = 0;
  private windSource: AudioBufferSourceNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private windGain: GainNode | null = null;
  private windLfo: OscillatorNode | null = null;
  private windLfoGain: GainNode | null = null;

  // 噪声缓存（白色 / 粉色 / 棕色），构造后按需惰性生成、复用
  private noiseCache: Record<'white' | 'pink' | 'brown', AudioBuffer | null> = {
    white: null, pink: null, brown: null,
  };

  // ------------------------------------------------------------------
  // 生命周期 / 主链路
  // ------------------------------------------------------------------

  /** 惰性创建 AudioContext 与主链路；无音频环境时返回 null */
  private ensureContext(): AudioContext | null {
    if (this.disposed) return null;
    if (this.ctx) return this.ctx;
    const ctor = detectAudioContextCtor();
    if (!ctor) return null;

    const ctx = new ctor();
    this.ctx = ctx;

    // 总输出：master(0.6) → compressor → destination
    const master = ctx.createGain();
    master.gain.value = this.muted ? 0 : this.masterVolume;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.knee.value = 20;
    comp.ratio.value = 6;
    comp.attack.value = 0.003;
    comp.release.value = 0.25;
    master.connect(comp);
    comp.connect(ctx.destination);

    this.master = master;
    this.comp = comp;
    this.noiseCache = { white: null, pink: null, brown: null };
    return ctx;
  }

  async unlock(): Promise<void> {
    const ctx = this.ensureContext();
    if (!ctx) return;
    try {
      if (ctx.state !== 'running') await ctx.resume();
    } catch {
      /* 忽略解锁失败：下次 play 会再次尝试 resume */
    }
  }

  play(name: SfxName, opts?: { gain?: number; detune?: number }): void {
    // 惰性建上下文并尽量立即恢复（浏览器自动播放可能仍处于 suspended）
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (ctx.state !== 'running') {
      ctx.resume().catch(() => {});
    }

    const gain = (opts?.gain ?? 1) * BASE_GAIN[name];
    const det = opts?.detune ?? 0;
    this.runSfx(name, gain, det);
  }

  startAmbient(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (this.ambientRunning) return; // 只能有一份实例，重复调用不叠加
    this.ambientRunning = true;

    // 低沉风声：棕色噪声 → 低通（LFO 缓慢扫频） → windGain
    const wind = this.noiseBuffer('brown');
    const src = ctx.createBufferSource();
    src.buffer = wind;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 240 * this.pitch();
    filter.Q.value = 0.6;
    const g = ctx.createGain();
    g.gain.value = 0;
    // 淡入，避免突兀
    g.gain.setTargetAtTime(this.ambientLevel(), ctx.currentTime, 1.5);

    // LFO 驱动风声起伏
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.08 * this.timeScale;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 140;

    src.connect(filter);
    filter.connect(g);
    g.connect(this.master!);
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    src.start();
    lfo.start();

    this.windSource = src;
    this.windFilter = filter;
    this.windGain = g;
    this.windLfo = lfo;
    this.windLfoGain = lfoGain;

    // 远处颜料滴落：用固定节拍 + 前瞻调度（lookahead），不依赖主线程精确计时
    const DROP_INTERVAL = 420;   // ms
    const LOOKAHEAD = 1.3;       // 秒
    let nextDrop = ctx.currentTime + 0.6;
    this.ambientTimer = setInterval(() => {
      const c = this.ctx;
      if (!c || !this.ambientRunning) return;
      while (nextDrop < c.currentTime + LOOKAHEAD) {
        this.paintDrop(nextDrop);
        nextDrop += (DROP_INTERVAL / 1000) * (0.65 + Math.random() * 0.9);
      }
    }, DROP_INTERVAL);
  }

  stopAmbient(): void {
    this.teardownAmbient(false);
  }

  /**
   * 关闭环境音。immediate=false 时淡出 0.4s 再停（避免咔哒）；
   * immediate=true（dispose）时立刻停止并断开全部风声节点。
   */
  private teardownAmbient(immediate: boolean): void {
    if (this.ambientTimer !== null) {
      clearInterval(this.ambientTimer);
      this.ambientTimer = null;
    }
    const ctx = this.ctx;
    const now = ctx ? ctx.currentTime : 0;
    if (ctx && this.windGain && !immediate) {
      const g = this.windGain;
      g.gain.cancelScheduledValues(now);
      g.gain.setValueAtTime(g.gain.value, now);
      g.gain.setTargetAtTime(0, now, 0.4);
    }
    const stopAt = immediate ? now : now + 1.2;
    if (ctx && this.windSource) {
      try { this.windSource.stop(stopAt); } catch {}
    }
    if (ctx && this.windLfo) {
      try { this.windLfo.stop(stopAt); } catch {}
    }
    if (immediate) {
      // 立即拆链，确保 dispose 后没有残留连接
      for (const n of [this.windSource, this.windFilter, this.windGain, this.windLfo, this.windLfoGain]) {
        if (n) { try { n.disconnect(); } catch {} }
      }
    }
    this.windSource = null;
    this.windFilter = null;
    this.windGain = null;
    this.windLfo = null;
    this.windLfoGain = null;
    this.ambientRunning = false;
  }

  setPhase(phase: number): void {
    this.ambientPhase = phase;
    if (this.ctx && this.windGain) {
      this.windGain.gain.setTargetAtTime(this.ambientLevel(), this.ctx.currentTime, 1.0);
    }
  }

  setMasterVolume(v: number): void {
    this.masterVolume = clamp(v, 0, 1);
    this.applyMasterGain();
  }

  getMasterVolume(): number {
    return this.masterVolume;
  }

  setMuted(m: boolean): void {
    this.muted = m;
    this.applyMasterGain();
  }

  isMuted(): boolean {
    return this.muted;
  }

  /**
   * 慢动作降调：不改变已在播放的节点，而是给之后所有合成统一乘一个音高系数。
   * scale < 1（慢镜）=> 频率整体下移、噪声播放速率变慢，听感"沉下去"；
   * 环境音的风声 LFO 与低通中心频率也同步跟随。
   */
  setTimeScale(scale: number): void {
    this.timeScale = clamp(scale, 0.05, 4);
    const ctx = this.ctx;
    if (ctx) {
      if (this.windLfo) {
        this.windLfo.frequency.setTargetAtTime(0.08 * this.timeScale, ctx.currentTime, 0.1);
      }
      if (this.windFilter) {
        this.windFilter.frequency.setTargetAtTime(240 * this.pitch(), ctx.currentTime, 0.15);
      }
    }
  }

  /** 当前音高系数（慢镜降调，限制在合理范围内避免过度失真） */
  private pitch(): number {
    return clamp(this.timeScale, 0.25, 2);
  }

  suspend(): void {
    if (this.ctx && this.ctx.state === 'running') {
      this.ctx.suspend().catch(() => {});
    }
  }

  resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  dispose(): void {
    this.teardownAmbient(true);
    this.disposed = true;
    if (this.master) {
      try { this.master.disconnect(); } catch {}
    }
    if (this.comp) {
      try { this.comp.disconnect(); } catch {}
    }
    if (this.ctx) {
      const ctx = this.ctx;
      this.ctx = null;
      if (ctx.state !== 'closed') {
        ctx.close().catch(() => {});
      }
    }
    this.master = null;
    this.comp = null;
    this.noiseCache = { white: null, pink: null, brown: null };
  }

  // ------------------------------------------------------------------
  // 内部工具
  // ------------------------------------------------------------------

  private applyMasterGain(): void {
    if (this.master && this.ctx) {
      const target = this.muted ? 0 : this.masterVolume;
      this.master.gain.setTargetAtTime(target, this.ctx.currentTime, 0.02);
    }
  }

  /** 阶段越高风声越强（压迫感） */
  private ambientLevel(): number {
    return 0.05 + clamp(this.ambientPhase, 0, 5) * 0.02;
  }

  private paintDrop(when: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    // 远处"颜料滴落"：短促低频正弦，频率轻微下坠 + 快速衰减
    const k = this.pitch();
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime((520 + Math.random() * 420) * k, when);
    o.frequency.exponentialRampToValueAtTime(180 * k, when + 0.16);
    const g = ctx.createGain();
    g.gain.setValueAtTime(EPS, when);
    g.gain.exponentialRampToValueAtTime(0.06, when + 0.012);
    g.gain.exponentialRampToValueAtTime(EPS, when + 0.22);
    o.connect(g);
    g.connect(this.master);
    o.start(when);
    o.stop(when + 0.26);
  }

  private noiseBuffer(kind: 'white' | 'pink' | 'brown'): AudioBuffer {
    const ctx = this.ctx!;
    const cached = this.noiseCache[kind];
    if (cached) return cached;
    const len = Math.floor(ctx.sampleRate * 2); // 2 秒循环缓冲
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    if (kind === 'white') {
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    } else if (kind === 'pink') {
      // Paul Kellet 近似粉噪
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.969 * b2 + w * 0.153852;
        b3 = 0.8665 * b3 + w * 0.3104856;
        b4 = 0.55 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.016898;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
        b6 = w * 0.115926;
      }
    } else {
      // 棕噪：白噪积分（低通）
      let last = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        last = (last + 0.02 * w) / 1.02;
        data[i] = last * 3.5;
      }
    }
    this.noiseCache[kind] = buf;
    return buf;
  }

  /**
   * 通用振荡器：type + 频率（可选指数滑到 endFreq）+ 包络。
   * detuneCents 单位音分（100 = 一个半音）。
   */
  private tone(o: {
    type: OscillatorType;
    freq: number;
    endFreq?: number;
    detuneCents?: number;
    gain: number;
    attack: number;
    decay: number;
    when?: number;
    pan?: number;
  }): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const t0 = o.when ?? ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = o.type;
    const k = this.pitch();
    const f = clamp(o.freq * k, 1, 20000) * Math.pow(2, (o.detuneCents ?? 0) / 1200);
    osc.frequency.setValueAtTime(f, t0);
    if (o.endFreq !== undefined && o.endFreq !== o.freq) {
      osc.frequency.exponentialRampToValueAtTime(clamp(o.endFreq * k, 1, 20000), t0 + o.attack + o.decay);
    }
    const g = ctx.createGain();
    g.gain.setValueAtTime(EPS, t0);
    g.gain.exponentialRampToValueAtTime(clamp(o.gain, EPS, 2), t0 + o.attack);
    g.gain.exponentialRampToValueAtTime(EPS, t0 + o.attack + o.decay);
    osc.connect(g);
    let out: AudioNode = g;
    if (o.pan !== undefined) {
      const p = ctx.createStereoPanner();
      p.pan.value = clamp(o.pan, -1, 1);
      g.connect(p);
      out = p;
    }
    out.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + o.attack + o.decay + 0.03);
  }

  /** 通用噪声：缓冲 → 滤波器 → 包络 */
  private noise(o: {
    kind: 'white' | 'pink' | 'brown';
    filterType?: BiquadFilterType;
    filterFreq?: number;
    filterQ?: number;
    filterEndFreq?: number;
    gain: number;
    attack: number;
    decay: number;
    rate?: number;
    when?: number;
  }): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const t0 = o.when ?? ctx.currentTime;
    const k = this.pitch();
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(o.kind);
    src.playbackRate.value = (o.rate ?? 1) * k;
    let node: AudioNode = src;
    if (o.filterType) {
      const f = ctx.createBiquadFilter();
      f.type = o.filterType;
      f.frequency.setValueAtTime(clamp((o.filterFreq ?? 1000) * k, 1, 20000), t0);
      f.Q.value = o.filterQ ?? 1;
      if (o.filterEndFreq !== undefined && o.filterEndFreq !== o.filterFreq) {
        f.frequency.exponentialRampToValueAtTime(clamp(o.filterEndFreq * k, 1, 20000), t0 + o.attack + o.decay);
      }
      src.connect(f);
      node = f;
    }
    const g = ctx.createGain();
    g.gain.setValueAtTime(EPS, t0);
    g.gain.exponentialRampToValueAtTime(clamp(o.gain, EPS, 2), t0 + o.attack);
    g.gain.exponentialRampToValueAtTime(EPS, t0 + o.attack + o.decay);
    node.connect(g);
    g.connect(this.master);
    src.start(t0);
    src.stop(t0 + o.attack + o.decay + 0.03);
  }

  /** 简单 FM 音色：carrier 被 modulator 调频，产生金属 / 钟类泛音 */
  private fm(o: {
    carrierFreq: number;
    modFreq: number;
    modDepth: number;
    gain: number;
    attack: number;
    decay: number;
    when?: number;
  }): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const t0 = o.when ?? ctx.currentTime;
    const k = this.pitch();
    const carrier = ctx.createOscillator();
    carrier.type = 'sine';
    carrier.frequency.value = clamp(o.carrierFreq * k, 1, 20000);
    const mod = ctx.createOscillator();
    mod.type = 'sine';
    mod.frequency.value = clamp(o.modFreq * k, 1, 20000);
    const modGain = ctx.createGain();
    modGain.gain.setValueAtTime(o.modDepth * k, t0);
    modGain.gain.exponentialRampToValueAtTime(EPS, t0 + o.attack + o.decay);
    mod.connect(modGain);
    modGain.connect(carrier.frequency);

    const g = ctx.createGain();
    g.gain.setValueAtTime(EPS, t0);
    g.gain.exponentialRampToValueAtTime(clamp(o.gain, EPS, 2), t0 + o.attack);
    g.gain.exponentialRampToValueAtTime(EPS, t0 + o.attack + o.decay);
    carrier.connect(g);
    g.connect(this.master);

    const stop = t0 + o.attack + o.decay + 0.03;
    carrier.start(t0); carrier.stop(stop);
    mod.start(t0); mod.stop(stop);
  }

  private runSfx(name: SfxName, gain: number, det: number): void {
    switch (name) {
      case 'perfect_block': this.perfectBlock(gain, det); break;
      case 'normal_block': this.normalBlock(gain, det); break;
      case 'block_fail': this.blockFail(gain, det); break;
      case 'prompt_rise': this.promptRise(gain, det); break;
      case 'ui_hover': this.uiHover(gain, det); break;
      case 'ui_click': this.uiClick(gain, det); break;
      case 'ui_back': this.uiBack(gain, det); break;
      case 'ui_denied': this.uiDenied(gain, det); break;
      case 'hit_physical': this.hitPhysical(gain, det); break;
      case 'hit_fire': this.hitFire(gain, det); break;
      case 'hit_ice': this.hitIce(gain, det); break;
      case 'hit_lightning': this.hitLightning(gain, det); break;
      case 'hit_earth': this.hitEarth(gain, det); break;
      case 'hit_light': this.hitLight(gain, det); break;
      case 'hit_dark': this.hitDark(gain, det); break;
      case 'crit': this.crit(gain, det); break;
      case 'weakness': this.weakness(gain, det); break;
      case 'heal': this.heal(gain, det); break;
      case 'shield_break': this.shieldBreak(gain, det); break;
      case 'break_gauge': this.breakGauge(gain, det); break;
      case 'counter_start': this.counterStart(gain, det); break;
      case 'counter_hit': this.counterHit(gain, det); break;
      case 'boss_telegraph': this.bossTelegraph(gain, det); break;
      case 'boss_roar': this.bossRoar(gain, det); break;
      case 'phase_shift': this.phaseShift(gain, det); break;
      case 'aim_shot': this.aimShot(gain, det); break;
      case 'weakpoint_break': this.weakpointBreak(gain, det); break;
      case 'death': this.death(gain, det); break;
      case 'revive': this.revive(gain, det); break;
      case 'victory': this.victory(gain, det); break;
      case 'defeat': this.defeat(gain, det); break;
      case 'inverted_warn': this.invertedWarn(gain, det); break;
      default: break;
    }
  }

  // ------------------------------------------------------------------
  // 各音效合成（音色彼此区分）
  // ------------------------------------------------------------------

  /**
   * perfect_block —— 高频金属格挡。
   * 手法：多个高频正弦按"非谐波比例"(1, 2.76, 5.4, 8.3)叠加 + 各自失谐，
   * 产生钟 / 金属条特有的 inharmonic 泛音；再加一对 FM(carrier≈4.2kHz, mod≈1.5kHz)
   * 提供"嘶嘶"的金属调制感；开头叠一个高 Q bandpass 白噪声 transient 模拟"叮"的起音。
   * 整体极快 attack + 快速指数衰减，留一段短促高频尾音，与 normal_block 的钝击完全区分。
   */
  private perfectBlock(g: number, det: number): void {
    const parts: Array<{ ratio: number; gain: number; detune: number }> = [
      { ratio: 1.0, gain: 1.0, detune: 0 },
      { ratio: 2.76, gain: 0.55, detune: 7 },
      { ratio: 5.4, gain: 0.32, detune: -9 },
      { ratio: 8.3, gain: 0.16, detune: 13 },
    ];
    const base = 4300;
    for (const p of parts) {
      this.tone({
        type: 'sine',
        freq: base * p.ratio,
        detuneCents: p.detune + det,
        gain: 0.9 * p.gain * g,
        attack: 0.002,
        decay: 0.5,
      });
    }
    this.fm({ carrierFreq: 4200, modFreq: 1500, modDepth: 900, gain: 0.35 * g, attack: 0.002, decay: 0.35 });
    this.noise({ kind: 'white', filterType: 'bandpass', filterFreq: 7000, filterQ: 12, gain: 0.8 * g, attack: 0.001, decay: 0.07 });
  }

  /** normal_block —— 较低沉的撞击：中低频正弦下坠 + 棕噪低通身体 + 一丝锯波质感 */
  private normalBlock(g: number, det: number): void {
    this.tone({ type: 'sine', freq: 400, endFreq: 170, detuneCents: det, gain: 0.7 * g, attack: 0.004, decay: 0.22 });
    this.tone({ type: 'sawtooth', freq: 210, endFreq: 120, detuneCents: det, gain: 0.18 * g, attack: 0.004, decay: 0.16 });
    this.noise({ kind: 'brown', filterType: 'lowpass', filterFreq: 900, filterQ: 0.7, gain: 0.6 * g, attack: 0.002, decay: 0.18 });
  }

  /** block_fail —— 闷响：极低频正弦 + 棕噪低通 */
  private blockFail(g: number, det: number): void {
    this.tone({ type: 'sine', freq: 130, endFreq: 60, detuneCents: det, gain: 0.8 * g, attack: 0.004, decay: 0.28 });
    this.noise({ kind: 'brown', filterType: 'lowpass', filterFreq: 300, filterQ: 0.6, gain: 0.5 * g, attack: 0.003, decay: 0.22 });
  }

  /** prompt_rise —— 连协提示前的轻微升调 */
  private promptRise(g: number, det: number): void {
    this.tone({ type: 'sine', freq: 520, endFreq: 960, detuneCents: det, gain: 0.5 * g, attack: 0.05, decay: 0.22 });
  }

  private uiHover(g: number, det: number): void {
    this.tone({ type: 'sine', freq: 1400, detuneCents: det, gain: 0.4 * g, attack: 0.004, decay: 0.05 });
  }

  private uiClick(g: number, det: number): void {
    this.tone({ type: 'square', freq: 900, endFreq: 500, detuneCents: det, gain: 0.35 * g, attack: 0.001, decay: 0.05 });
    this.noise({ kind: 'white', filterType: 'highpass', filterFreq: 4000, gain: 0.2 * g, attack: 0.001, decay: 0.02 });
  }

  private uiBack(g: number, det: number): void {
    this.tone({ type: 'sine', freq: 700, endFreq: 420, detuneCents: det, gain: 0.45 * g, attack: 0.006, decay: 0.1 });
  }

  private uiDenied(g: number, det: number): void {
    this.tone({ type: 'square', freq: 170, endFreq: 140, detuneCents: det, gain: 0.5 * g, attack: 0.004, decay: 0.12 });
    this.tone({ type: 'square', freq: 150, detuneCents: det, gain: 0.4 * g, attack: 0.004, decay: 0.1, when: (this.ctx?.currentTime ?? 0) + 0.08 });
  }

  private hitPhysical(g: number, det: number): void {
    this.tone({ type: 'sine', freq: 320, endFreq: 140, detuneCents: det, gain: 0.75 * g, attack: 0.003, decay: 0.2 });
    this.noise({ kind: 'white', filterType: 'bandpass', filterFreq: 950, filterQ: 1.5, gain: 0.6 * g, attack: 0.001, decay: 0.12 });
  }

  /** hit_fire —— 火：白噪声 + 低通扫频(高→低) + 上翘锯波暖色 */
  private hitFire(g: number, det: number): void {
    this.noise({ kind: 'white', filterType: 'lowpass', filterFreq: 3800, filterEndFreq: 320, filterQ: 0.8, gain: 0.7 * g, attack: 0.002, decay: 0.42 });
    this.tone({ type: 'sawtooth', freq: 160, endFreq: 320, detuneCents: det, gain: 0.3 * g, attack: 0.02, decay: 0.36 });
    this.noise({ kind: 'pink', filterType: 'highpass', filterFreq: 3000, gain: 0.2 * g, attack: 0.001, decay: 0.06 });
  }

  /** hit_ice —— 冰：高频脆响 + 短颤音 + 高频噪声 transient */
  private hitIce(g: number, det: number): void {
    this.tone({ type: 'sine', freq: 2900, endFreq: 2100, detuneCents: det, gain: 0.6 * g, attack: 0.002, decay: 0.18 });
    this.noise({ kind: 'white', filterType: 'bandpass', filterFreq: 5600, filterQ: 8, gain: 0.55 * g, attack: 0.001, decay: 0.07 });
    // 短颤音：三角波 LFO 调制一个高音振荡器
    const ctx = this.ctx;
    if (ctx && this.master) {
      const t0 = ctx.currentTime;
      const k = this.pitch();
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(3300 * k, t0);
      const lfo = ctx.createOscillator();
      lfo.type = 'triangle';
      lfo.frequency.value = 38;
      const lg = ctx.createGain();
      lg.gain.value = 60 * k;
      lfo.connect(lg);
      lg.connect(o.frequency);
      const gv = ctx.createGain();
      gv.gain.setValueAtTime(EPS, t0);
      gv.gain.exponentialRampToValueAtTime(0.25 * g, t0 + 0.008);
      gv.gain.exponentialRampToValueAtTime(EPS, t0 + 0.2);
      o.connect(gv);
      gv.connect(this.master);
      const stop = t0 + 0.24;
      o.start(t0); o.stop(stop);
      lfo.start(t0); lfo.stop(stop);
    }
  }

  /** hit_lightning —— 雷：方波快速下坠 + 极短白噪爆 */
  private hitLightning(g: number, det: number): void {
    this.tone({ type: 'square', freq: 260, endFreq: 80, detuneCents: det, gain: 0.5 * g, attack: 0.001, decay: 0.16 });
    this.noise({ kind: 'white', filterType: 'highpass', filterFreq: 1500, gain: 0.8 * g, attack: 0.001, decay: 0.05 });
    this.tone({ type: 'sine', freq: 4200, detuneCents: det, gain: 0.3 * g, attack: 0.001, decay: 0.04 });
  }

  /** hit_earth —— 土：低频闷响 */
  private hitEarth(g: number, det: number): void {
    this.tone({ type: 'sine', freq: 100, endFreq: 45, detuneCents: det, gain: 0.85 * g, attack: 0.005, decay: 0.4 });
    this.noise({ kind: 'brown', filterType: 'lowpass', filterFreq: 220, filterQ: 0.6, gain: 0.6 * g, attack: 0.003, decay: 0.3 });
  }

  /** hit_light —— 光：明亮正弦叠加（基频+高次谐波） */
  private hitLight(g: number, det: number): void {
    const fund = 900;
    const ratios = [1, 1.5, 2, 3];
    const gains = [0.7, 0.3, 0.25, 0.12];
    ratios.forEach((r, i) => {
      this.tone({ type: 'sine', freq: fund * r, detuneCents: det + (i - 1) * 5, gain: gains[i] * g, attack: 0.004, decay: 0.4 });
    });
  }

  /** hit_dark —— 暗：失谐低音 + 噪声 */
  private hitDark(g: number, det: number): void {
    this.tone({ type: 'sine', freq: 110, endFreq: 70, detuneCents: det, gain: 0.7 * g, attack: 0.006, decay: 0.4 });
    this.tone({ type: 'sawtooth', freq: 116, endFreq: 74, detuneCents: det + 12, gain: 0.25 * g, attack: 0.006, decay: 0.35 });
    this.noise({ kind: 'brown', filterType: 'lowpass', filterFreq: 500, filterQ: 0.7, gain: 0.5 * g, attack: 0.004, decay: 0.3 });
  }

  /** crit —— 会心：上行明亮滑音 + 高音火花 + 细碎噪声 */
  private crit(g: number, det: number): void {
    this.tone({ type: 'sine', freq: 1300, endFreq: 2500, detuneCents: det, gain: 0.6 * g, attack: 0.008, decay: 0.28 });
    this.tone({ type: 'sine', freq: 5200, detuneCents: det + 20, gain: 0.3 * g, attack: 0.002, decay: 0.18 });
    this.noise({ kind: 'white', filterType: 'highpass', filterFreq: 6000, gain: 0.18 * g, attack: 0.001, decay: 0.05 });
  }

  /** weakness —— 弱点：上行三连音琶音 */
  private weakness(g: number, det: number): void {
    const ctx = this.ctx;
    const t0 = ctx ? ctx.currentTime : 0;
    const notes = [660, 880, 1320];
    notes.forEach((f, i) => {
      this.tone({ type: 'sine', freq: f, detuneCents: det, gain: 0.5 * g, attack: 0.006, decay: 0.16, when: t0 + i * 0.07 });
    });
  }

  /** heal —— 治疗：温暖大三和弦柔和 swell */
  private heal(g: number, det: number): void {
    const chord = [392, 494, 587, 784];
    chord.forEach((f, i) => {
      this.tone({ type: i === 0 ? 'triangle' : 'sine', freq: f, detuneCents: det, gain: (i === 0 ? 0.55 : 0.3) * g, attack: 0.15, decay: 0.9 });
    });
  }

  /** shield_break —— 破盾：玻璃碎裂噪声 + 高音金属余韵 */
  private shieldBreak(g: number, det: number): void {
    this.noise({ kind: 'white', filterType: 'highpass', filterFreq: 2500, gain: 0.85 * g, attack: 0.001, decay: 0.2 });
    this.noise({ kind: 'pink', filterType: 'bandpass', filterFreq: 4000, filterQ: 4, gain: 0.4 * g, attack: 0.001, decay: 0.1 });
    this.tone({ type: 'sine', freq: 2600, endFreq: 1800, detuneCents: det, gain: 0.5 * g, attack: 0.004, decay: 0.7 });
    this.tone({ type: 'sine', freq: 3900, detuneCents: det + 9, gain: 0.25 * g, attack: 0.004, decay: 0.5 });
  }

  /** break_gauge —— 破绽计量：上升张力锯波 + 噪声裂缝 */
  private breakGauge(g: number, det: number): void {
    this.tone({ type: 'sawtooth', freq: 400, endFreq: 1100, detuneCents: det, gain: 0.35 * g, attack: 0.1, decay: 0.4 });
    this.noise({ kind: 'white', filterType: 'bandpass', filterFreq: 2000, filterQ: 3, gain: 0.3 * g, attack: 0.05, decay: 0.2 });
    this.tone({ type: 'square', freq: 880, detuneCents: det, gain: 0.2 * g, attack: 0.01, decay: 0.08, when: (this.ctx?.currentTime ?? 0) + 0.12 });
  }

  /** counter_start —— 反击启动：whoosh 噪声扫频 + 金属 ping */
  private counterStart(g: number, det: number): void {
    this.noise({ kind: 'pink', filterType: 'bandpass', filterFreq: 600, filterEndFreq: 3200, filterQ: 2, gain: 0.6 * g, attack: 0.03, decay: 0.3 });
    this.tone({ type: 'sine', freq: 1500, detuneCents: det, gain: 0.45 * g, attack: 0.003, decay: 0.25 });
    this.tone({ type: 'sine', freq: 520, endFreq: 1100, detuneCents: det, gain: 0.3 * g, attack: 0.04, decay: 0.24 });
  }

  /** counter_hit —— 反击命中：强力撞击 + 金属回响 + 高频起音 */
  private counterHit(g: number, det: number): void {
    this.tone({ type: 'sine', freq: 200, endFreq: 60, detuneCents: det, gain: 0.85 * g, attack: 0.003, decay: 0.4 });
    this.tone({ type: 'sine', freq: 960, detuneCents: det, gain: 0.5 * g, attack: 0.002, decay: 0.45 });
    this.tone({ type: 'sine', freq: 960 * 2.3, detuneCents: det + 12, gain: 0.22 * g, attack: 0.002, decay: 0.35 });
    this.noise({ kind: 'white', filterType: 'bandpass', filterFreq: 3000, filterQ: 2, gain: 0.6 * g, attack: 0.001, decay: 0.08 });
    this.noise({ kind: 'pink', filterType: 'lowpass', filterFreq: 2000, gain: 0.25 * g, attack: 0.002, decay: 0.12 });
  }

  /** boss_telegraph —— Boss 前摇：深重不祥长音 */
  private bossTelegraph(g: number, det: number): void {
    this.tone({ type: 'sawtooth', freq: 74, endFreq: 60, detuneCents: det, gain: 0.6 * g, attack: 0.3, decay: 1.3 });
    this.tone({ type: 'sine', freq: 84, detuneCents: det + 6, gain: 0.35 * g, attack: 0.3, decay: 1.3 });
    this.noise({ kind: 'brown', filterType: 'lowpass', filterFreq: 180, filterQ: 0.6, gain: 0.45 * g, attack: 0.25, decay: 1.2 });
  }

  /** boss_roar —— Boss 咆哮：失谐锯齿 + 低通下坠 + 次低频 + 棕噪身体 */
  private bossRoar(g: number, det: number): void {
    this.tone({ type: 'sawtooth', freq: 66, endFreq: 50, detuneCents: det, gain: 0.5 * g, attack: 0.06, decay: 1.4 });
    this.tone({ type: 'sawtooth', freq: 70, endFreq: 53, detuneCents: det + 15, gain: 0.4 * g, attack: 0.06, decay: 1.4 });
    this.tone({ type: 'sine', freq: 42, endFreq: 33, detuneCents: det, gain: 0.7 * g, attack: 0.04, decay: 1.5 });
    this.noise({ kind: 'brown', filterType: 'lowpass', filterFreq: 900, filterEndFreq: 220, filterQ: 0.8, gain: 0.6 * g, attack: 0.04, decay: 1.2 });
  }

  /** phase_shift —— 阶段切换：粉噪扫频上行 + 三角波上行 + 余韵 */
  private phaseShift(g: number, det: number): void {
    this.noise({ kind: 'pink', filterType: 'bandpass', filterFreq: 300, filterEndFreq: 4200, filterQ: 2, gain: 0.55 * g, attack: 0.2, decay: 0.9 });
    this.tone({ type: 'triangle', freq: 220, endFreq: 880, detuneCents: det, gain: 0.45 * g, attack: 0.25, decay: 0.9 });
    this.tone({ type: 'sine', freq: 1760, detuneCents: det + 10, gain: 0.2 * g, attack: 0.6, decay: 0.8 });
  }

  /** aim_shot —— 瞄准：上扬再俯冲的"咻"声 */
  private aimShot(g: number, det: number): void {
    this.tone({ type: 'sine', freq: 500, endFreq: 2000, detuneCents: det, gain: 0.5 * g, attack: 0.08, decay: 0.22 });
    this.tone({ type: 'sine', freq: 2000, endFreq: 700, detuneCents: det, gain: 0.35 * g, attack: 0.03, decay: 0.24, when: (this.ctx?.currentTime ?? 0) + 0.3 });
    this.noise({ kind: 'pink', filterType: 'bandpass', filterFreq: 1500, filterQ: 2, gain: 0.2 * g, attack: 0.05, decay: 0.3 });
  }

  /** weakpoint_break —— 弱点破碎：碎裂噪声 + 高音金属长尾 */
  private weakpointBreak(g: number, det: number): void {
    this.noise({ kind: 'white', filterType: 'highpass', filterFreq: 2200, gain: 0.8 * g, attack: 0.001, decay: 0.16 });
    this.tone({ type: 'sine', freq: 2800, endFreq: 1900, detuneCents: det, gain: 0.55 * g, attack: 0.003, decay: 0.7 });
    this.tone({ type: 'sine', freq: 2800 * 2.4, detuneCents: det + 14, gain: 0.25 * g, attack: 0.003, decay: 0.5 });
    this.noise({ kind: 'white', filterType: 'bandpass', filterFreq: 5200, filterQ: 10, gain: 0.4 * g, attack: 0.001, decay: 0.07 });
  }

  /** death —— 阵亡：长下行 + 噪声消退 */
  private death(g: number, det: number): void {
    this.tone({ type: 'sawtooth', freq: 240, endFreq: 42, detuneCents: det, gain: 0.55 * g, attack: 0.02, decay: 2.0 });
    this.tone({ type: 'sine', freq: 120, endFreq: 38, detuneCents: det, gain: 0.5 * g, attack: 0.02, decay: 2.1 });
    this.noise({ kind: 'brown', filterType: 'lowpass', filterFreq: 400, filterEndFreq: 120, filterQ: 0.6, gain: 0.35 * g, attack: 0.02, decay: 1.6 });
  }

  /** revive —— 复活：温暖上行 + 和弦 swell */
  private revive(g: number, det: number): void {
    this.tone({ type: 'triangle', freq: 220, endFreq: 780, detuneCents: det, gain: 0.5 * g, attack: 0.3, decay: 1.0 });
    this.tone({ type: 'sine', freq: 523, detuneCents: det, gain: 0.3 * g, attack: 0.6, decay: 0.9 });
    this.tone({ type: 'sine', freq: 659, detuneCents: det, gain: 0.25 * g, attack: 0.7, decay: 0.9 });
  }

  /** victory —— 胜利：大调号角琶音 + 尾音和弦 */
  private victory(g: number, det: number): void {
    const ctx = this.ctx;
    const t0 = ctx ? ctx.currentTime : 0;
    const notes: Array<[number, number]> = [[523.25, 0], [659.25, 0.16], [783.99, 0.32], [1046.5, 0.48]];
    notes.forEach(([f, d]) => {
      this.tone({ type: 'sine', freq: f, detuneCents: det, gain: 0.5 * g, attack: 0.02, decay: 0.7, when: t0 + d });
      this.tone({ type: 'triangle', freq: f * 2, detuneCents: det, gain: 0.2 * g, attack: 0.02, decay: 0.5, when: t0 + d });
    });
    // 结尾大调和弦 + 高音余韵
    [523.25, 659.25, 783.99, 1046.5].forEach((f) => {
      this.tone({ type: 'sine', freq: f, detuneCents: det, gain: 0.3 * g, attack: 0.08, decay: 1.1, when: t0 + 1.1 });
    });
    this.tone({ type: 'sine', freq: 2093, detuneCents: det + 15, gain: 0.15 * g, attack: 0.05, decay: 1.0, when: t0 + 1.2 });
  }

  /** defeat —— 战败：小调下行 + 低音 drone */
  private defeat(g: number, det: number): void {
    const ctx = this.ctx;
    const t0 = ctx ? ctx.currentTime : 0;
    const notes: Array<[number, number]> = [[392, 0], [330, 0.4], [262, 0.8], [196, 1.2]];
    notes.forEach(([f, d]) => {
      this.tone({ type: 'sine', freq: f, detuneCents: det, gain: 0.45 * g, attack: 0.03, decay: 0.9, when: t0 + d });
      this.tone({ type: 'triangle', freq: f / 2, detuneCents: det, gain: 0.2 * g, attack: 0.03, decay: 0.9, when: t0 + d });
    });
    this.tone({ type: 'sine', freq: 65, detuneCents: det, gain: 0.35 * g, attack: 0.4, decay: 2.0 });
    this.noise({ kind: 'brown', filterType: 'lowpass', filterFreq: 200, gain: 0.2 * g, attack: 0.4, decay: 1.6 });
  }

  /** inverted_warn —— 反转警告：急促双音警报 */
  private invertedWarn(g: number, det: number): void {
    const ctx = this.ctx;
    const t0 = ctx ? ctx.currentTime : 0;
    for (let i = 0; i < 4; i++) {
      const f = i % 2 === 0 ? 1760 : 1320;
      this.tone({ type: 'square', freq: f, detuneCents: det, gain: 0.4 * g, attack: 0.004, decay: 0.1, when: t0 + i * 0.16 });
      this.tone({ type: 'sine', freq: f * 1.5, detuneCents: det + 8, gain: 0.15 * g, attack: 0.004, decay: 0.09, when: t0 + i * 0.16 });
    }
  }
}

/** 运行时探测 AudioContext 构造器（Node / 无音频环境返回 undefined） */
function detectAudioContextCtor(): (new () => AudioContext) | undefined {
  try {
    if (typeof AudioContext !== 'undefined') {
      return AudioContext as unknown as new () => AudioContext;
    }
  } catch {
    /* 忽略 */
  }
  try {
    const w = globalThis as unknown as { webkitAudioContext?: new () => AudioContext };
    if (typeof w.webkitAudioContext === 'function') {
      return w.webkitAudioContext;
    }
  } catch {
    /* 忽略 */
  }
  return undefined;
}
