/**
 * Procedural Web Audio SFX engine for the miniature voxel city disaster sandbox.
 *
 * Design notes
 * ------------
 * - ZERO assets: everything is synthesized from oscillators plus two pre-generated
 *   noise AudioBuffers (white + brown). No fetch, no decodeAudioData, no samples.
 * - Lazy context: the AudioContext is only created inside `resume()` (browsers
 *   forbid starting audio outside a user gesture). Every emitter is a no-op until
 *   then, and also while `enabled === false`.
 * - Signal chain: source -> [inner envelope/filter nodes] -> per-voice GainNode
 *   -> master GainNode (~0.5) -> mild DynamicsCompressorNode -> destination.
 * - Voice budget: one-shots share a hard cap (MAX_VOICES). Every one-shot stops
 *   its sources on a schedule, disconnects them in `onended`, and its per-voice
 *   bus is torn down by a tracked timer, so node count can never grow unbounded.
 * - Four sustained beds (wind / quake / water / singularity) are built once and
 *   run forever at gain 0; `update(dt)` lerps their gains toward targets.
 */

/** Minimal structural type so we can reach the prefixed Safari constructor without `any`. */
interface AudioContextCtor {
  new (contextOptions?: AudioContextOptions): AudioContext;
}
interface AudioGlobals {
  AudioContext?: AudioContextCtor;
  webkitAudioContext?: AudioContextCtor;
}

/** A parameter we want to re-tune when slow-motion toggles, plus its normal value. */
interface SlowParam<T> {
  node: T;
  base: number;
}

/** One permanently running sustained texture. */
interface Bed {
  gain: GainNode;
  /** Output trim so beds sit at comparable loudness for the same 0..1 request. */
  scale: number;
  target: number;
  current: number;
  sources: SlowParam<AudioBufferSourceNode>[];
  oscs: SlowParam<OscillatorNode>[];
  filters: SlowParam<BiquadFilterNode>[];
}

const MIN_GAIN = 0.0001;

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function safeDisconnect(node: AudioNode): void {
  try {
    node.disconnect();
  } catch {
    /* already detached - nothing to do */
  }
}

/** Percussive envelope: silent -> peak (attack) -> silent (decay), exponential. */
function percussive(g: GainNode, t: number, peak: number, attack: number, decay: number): void {
  const p = Math.max(MIN_GAIN * 2, peak);
  const a = Math.max(0.001, attack);
  const d = Math.max(0.002, decay);
  g.gain.setValueAtTime(MIN_GAIN, t);
  g.gain.exponentialRampToValueAtTime(p, t + a);
  g.gain.exponentialRampToValueAtTime(MIN_GAIN, t + a + d);
}

/** Swelling envelope: fade in over `rise`, hold, then fade out - used for whooshes. */
function swell(g: GainNode, t: number, peak: number, rise: number, fall: number): void {
  const p = Math.max(MIN_GAIN * 2, peak);
  g.gain.setValueAtTime(MIN_GAIN, t);
  g.gain.linearRampToValueAtTime(p, t + Math.max(0.01, rise));
  g.gain.linearRampToValueAtTime(MIN_GAIN, t + Math.max(0.02, rise + fall));
}

export class AudioEngine {
  /** Hard ceiling on simultaneous one-shot voices. */
  private static readonly MAX_VOICES = 28;

  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private comp: DynamicsCompressorNode | null = null;

  private whiteBuf: AudioBuffer | null = null;
  private brownBuf: AudioBuffer | null = null;

  private beds: Bed[] = [];
  private wind: Bed | null = null;
  private quake: Bed | null = null;
  private water: Bed | null = null;
  private hum: Bed | null = null;

  /** Nodes that live for the whole session (bed graph) - disconnected in dispose(). */
  private permanent: AudioNode[] = [];
  /** Sources that run forever and must be stopped in dispose(). */
  private permanentSources: AudioScheduledSourceNode[] = [];

  private voices = 0;
  private timers = new Set<number>();
  /** Context timestamps of recent impacts, used for the ~14/s throttle. */
  private impactStamps: number[] = [];

  private _enabled = true;
  private slow = false;
  private masterLevel = 0.5;
  private failed = false;

  constructor() {
    /* Intentionally empty: no AudioContext before a user gesture. */
  }

  get enabled(): boolean {
    return this._enabled;
  }

  /** 'none' before the first gesture, then the AudioContext state. Used by tooling. */
  get contextState(): string {
    return this.ctx ? this.ctx.state : this.failed ? 'failed' : 'none';
  }

  /** Number of one-shot voices currently alive (must stay bounded). */
  get voiceCount(): number {
    return this.voices;
  }

  setEnabled(v: boolean): void {
    this._enabled = v;
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    // Silence instantly (beds keep running at their own gains, just muted here).
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(v ? this.masterLevel : 0, t);
  }

  toggle(): boolean {
    this.setEnabled(!this._enabled);
    return this._enabled;
  }

  /** Safe to call on every click: creates the context once, then just resumes it. */
  resume(): void {
    if (this.failed) return;
    if (!this.ctx) {
      try {
        const g = globalThis as unknown as AudioGlobals;
        const Ctor = g.AudioContext ?? g.webkitAudioContext;
        if (!Ctor) {
          this.failed = true;
          return;
        }
        const ctx = new Ctor({ latencyHint: 'interactive' });
        this.buildGraph(ctx);
        this.ctx = ctx;
      } catch {
        // Autoplay policy, no device, exhausted contexts... stay silent forever.
        this.failed = true;
        this.ctx = null;
        return;
      }
    }
    const ctx = this.ctx;
    if (!ctx) return;
    if (ctx.state !== 'running') {
      try {
        const p: unknown = ctx.resume();
        if (p instanceof Promise) p.catch(() => undefined);
      } catch {
        /* resume can reject if the gesture was not trusted - ignore */
      }
    }
  }

  /** Drops loop pitch/brightness for the slow-motion camera mode. */
  setSlowMotion(slow: boolean): void {
    if (this.slow === slow) return;
    this.slow = slow;
    const ctx = this.ctx;
    if (!ctx) return;
    const f = slow ? 0.62 : 1;
    const t = ctx.currentTime;
    const tau = 0.3;
    for (const bed of this.beds) {
      for (const s of bed.sources) s.node.playbackRate.setTargetAtTime(s.base * f, t, tau);
      for (const o of bed.oscs) o.node.frequency.setTargetAtTime(o.base * f, t, tau);
      for (const b of bed.filters) b.node.frequency.setTargetAtTime(b.base * f, t, tau);
    }
  }

  // ---------------------------------------------------------------- one-shots

  /**
   * Explosion = sine sub dropping ~130Hz -> ~28Hz (the thump) + lowpass-swept
   * white noise body + a very short highpassed transient for the "crack".
   */
  explosion(power = 1): void {
    const v = this.beginVoice();
    if (!v) return;
    const { ctx, t, bus } = v;
    const p = clamp(power, 0.3, 3);
    const dur = 0.5 + 0.6 * p;

    // Sub thump.
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(140 * (1 / Math.sqrt(p)) + 20, t);
    sub.frequency.exponentialRampToValueAtTime(26, t + dur * 0.85);
    const subG = ctx.createGain();
    percussive(subG, t, 0.9, 0.008, dur);
    sub.connect(subG).connect(bus);
    this.playSource(sub, t, t + dur + 0.05);

    // Noise body: broadband debris cloud collapsing to a low roar.
    const body = this.noise(ctx, this.whiteBuf, 0.85 + Math.random() * 0.3);
    if (body) {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.Q.value = 0.7;
      lp.frequency.setValueAtTime(2200, t);
      lp.frequency.exponentialRampToValueAtTime(140, t + dur * 0.7);
      const bodyG = ctx.createGain();
      percussive(bodyG, t, 0.55 * Math.min(1.4, p), 0.012, dur * 0.9);
      body.connect(lp).connect(bodyG).connect(bus);
      this.playSource(body, t, t + dur + 0.05);
    }

    // Bright transient (ignition crack).
    const crack = this.noise(ctx, this.whiteBuf, 1.6);
    if (crack) {
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 1800;
      const crackG = ctx.createGain();
      percussive(crackG, t, 0.3, 0.002, 0.09);
      crack.connect(hp).connect(crackG).connect(bus);
      this.playSource(crack, t, t + 0.16);
    }

    this.endVoice(bus, dur + 0.2);
  }

  /**
   * Nuke = everything explosion does, an octave lower and far longer:
   * 2.4s sub sweep, 3s roaring noise, plus a 6s brown-noise rumble tail.
   */
  nuke(): void {
    const v = this.beginVoice();
    if (!v) return;
    const { ctx, t, bus } = v;
    const total = 6.5;

    // Very deep, slow sub sweep.
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(150, t);
    sub.frequency.exponentialRampToValueAtTime(16, t + 2.4);
    const subG = ctx.createGain();
    subG.gain.setValueAtTime(MIN_GAIN, t);
    subG.gain.exponentialRampToValueAtTime(1.0, t + 0.02);
    subG.gain.exponentialRampToValueAtTime(0.25, t + 1.6);
    subG.gain.exponentialRampToValueAtTime(MIN_GAIN, t + 4.5);
    sub.connect(subG).connect(bus);
    this.playSource(sub, t, t + 4.6);

    // Huge fireball noise: bright flash collapsing into a wide roar.
    const roar = this.noise(ctx, this.whiteBuf, 0.75);
    if (roar) {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.Q.value = 1.1;
      lp.frequency.setValueAtTime(5200, t);
      lp.frequency.exponentialRampToValueAtTime(220, t + 2.2);
      const g = ctx.createGain();
      g.gain.setValueAtTime(MIN_GAIN, t);
      g.gain.exponentialRampToValueAtTime(0.8, t + 0.05);
      g.gain.exponentialRampToValueAtTime(MIN_GAIN, t + 3.0);
      roar.connect(lp).connect(g).connect(bus);
      this.playSource(roar, t, t + 3.1);
    }

    // Long shockwave rumble tail (brown noise is already ~-6dB/oct: pure weight).
    const tail = this.noise(ctx, this.brownBuf, 0.4);
    if (tail) {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(320, t);
      lp.frequency.exponentialRampToValueAtTime(70, t + total);
      const g = ctx.createGain();
      g.gain.setValueAtTime(MIN_GAIN, t);
      g.gain.linearRampToValueAtTime(0.5, t + 0.6);
      g.gain.exponentialRampToValueAtTime(MIN_GAIN, t + total);
      tail.connect(lp).connect(g).connect(bus);
      this.playSource(tail, t, t + total + 0.05);
    }

    this.endVoice(bus, total + 0.2);
  }

  /**
   * Impact = tiny bandpassed brown-noise knock plus a clicky sine body.
   * Throttled to ~14 per second so debris showers cannot flood the graph.
   */
  impact(strength = 0.6): void {
    const ctx = this.ctx;
    if (!ctx || !this._enabled) return;
    const now = ctx.currentTime;
    this.impactStamps = this.impactStamps.filter((s) => now - s < 1);
    if (this.impactStamps.length >= 14) return;
    this.impactStamps.push(now);

    const v = this.beginVoice();
    if (!v) return;
    const { t, bus } = v;
    const s = clamp(strength, 0, 1);
    const dur = 0.06 + 0.1 * s;

    const knock = this.noise(ctx, this.brownBuf, 1.1 + Math.random() * 0.8);
    if (knock) {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 420 + 700 * (1 - s) + Math.random() * 250;
      bp.Q.value = 1.4;
      const g = ctx.createGain();
      percussive(g, t, 0.25 + 0.45 * s, 0.002, dur);
      knock.connect(bp).connect(g).connect(bus);
      this.playSource(knock, t, t + dur + 0.05);
    }

    // Wooden/stony body tone so small hits still read at low volume.
    const body = ctx.createOscillator();
    body.type = 'triangle';
    body.frequency.setValueAtTime(190 - 60 * s, t);
    body.frequency.exponentialRampToValueAtTime(90, t + dur);
    const bg = ctx.createGain();
    percussive(bg, t, 0.16 + 0.24 * s, 0.001, dur * 0.8);
    body.connect(bg).connect(bus);
    this.playSource(body, t, t + dur + 0.05);

    this.endVoice(bus, dur + 0.15);
  }

  /**
   * Crumble = ~1.2s of brown noise through a slowly opening lowpass plus a
   * wandering bandpass layer: grinding masonry rather than a clean hit.
   */
  crumble(): void {
    const v = this.beginVoice();
    if (!v) return;
    const { ctx, t, bus } = v;
    const dur = 1.2;

    const rubble = this.noise(ctx, this.brownBuf, 0.85);
    if (rubble) {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.Q.value = 0.9;
      lp.frequency.setValueAtTime(260, t);
      lp.frequency.linearRampToValueAtTime(900, t + 0.45);
      lp.frequency.exponentialRampToValueAtTime(180, t + dur);
      const g = ctx.createGain();
      swell(g, t, 0.6, 0.09, dur - 0.09);
      rubble.connect(lp).connect(g).connect(bus);
      this.playSource(rubble, t, t + dur + 0.05);
    }

    // Gritty upper layer: sliding bandpass reads as scraping stone fragments.
    const grit = this.noise(ctx, this.whiteBuf, 1.25);
    if (grit) {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = 1.8;
      bp.frequency.setValueAtTime(1500, t);
      bp.frequency.exponentialRampToValueAtTime(520, t + dur);
      const g = ctx.createGain();
      swell(g, t, 0.22, 0.05, dur - 0.05);
      grit.connect(bp).connect(g).connect(bus);
      this.playSource(grit, t, t + dur + 0.05);
    }

    this.endVoice(bus, dur + 0.2);
  }

  /**
   * Thunder = distance-morphing pair. distance 0: hard highpassed crack plus a
   * short body. distance 1: no crack, slow attack, heavily lowpassed long roll.
   */
  thunder(distance = 0.5): void {
    const v = this.beginVoice();
    if (!v) return;
    const { ctx, t, bus } = v;
    const d = clamp(distance, 0, 1);
    const dur = 1.1 + 2.6 * d;
    const cutoff = 4200 * (1 - d) + 260 * d;

    const roll = this.noise(ctx, this.brownBuf, 0.55 + 0.4 * (1 - d));
    if (roll) {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.Q.value = 1.0;
      lp.frequency.setValueAtTime(cutoff, t);
      lp.frequency.exponentialRampToValueAtTime(Math.max(60, cutoff * 0.18), t + dur);
      const g = ctx.createGain();
      // Close strikes slam, far ones roll in; rise + fall always spans `dur`.
      const rise = 0.01 + 0.35 * d;
      swell(g, t, 0.75 - 0.25 * d, rise, dur - rise);
      roll.connect(lp).connect(g).connect(bus);
      this.playSource(roll, t, t + dur + 0.1);
    }

    if (d < 0.55) {
      const crack = this.noise(ctx, this.whiteBuf, 1.5);
      if (crack) {
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 1200 + 2600 * (1 - d);
        const g = ctx.createGain();
        percussive(g, t, 0.42 * (1 - d / 0.55), 0.002, 0.18);
        crack.connect(hp).connect(g).connect(bus);
        this.playSource(crack, t, t + 0.26);
      }
    }

    this.endVoice(bus, dur + 0.25);
  }

  /**
   * Zap = two detuned sawtooths falling fast through a resonant highpass plus a
   * hissing noise sliver. Very bright, very short (~0.15s).
   */
  zap(): void {
    const v = this.beginVoice();
    if (!v) return;
    const { ctx, t, bus } = v;
    const dur = 0.15;

    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 900;
    hp.Q.value = 0.8;
    hp.connect(bus);

    for (let i = 0; i < 2; i++) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      const f0 = i === 0 ? 2600 : 3350;
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(f0 * 0.22, t + dur);
      const g = ctx.createGain();
      percussive(g, t, i === 0 ? 0.3 : 0.18, 0.001, dur);
      o.connect(g).connect(hp);
      this.playSource(o, t, t + dur + 0.05);
    }

    const hiss = this.noise(ctx, this.whiteBuf, 1.9);
    if (hiss) {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 3800;
      bp.Q.value = 0.9;
      const g = ctx.createGain();
      percussive(g, t, 0.3, 0.001, 0.07);
      hiss.connect(bp).connect(g).connect(bus);
      this.playSource(hiss, t, t + 0.14);
    }

    this.endVoice(bus, dur + 0.15);
  }

  /**
   * Meteor whoosh = white noise through a bandpass climbing 220Hz -> 2.4kHz,
   * with a doppler-ish sine sweep underneath, over the requested duration.
   */
  meteorWhoosh(duration: number): void {
    const v = this.beginVoice();
    if (!v) return;
    const { ctx, t, bus } = v;
    const dur = clamp(duration, 0.15, 12);

    const air = this.noise(ctx, this.whiteBuf, 1.0);
    if (air) {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = 2.2;
      bp.frequency.setValueAtTime(220, t);
      bp.frequency.exponentialRampToValueAtTime(2400, t + dur);
      const g = ctx.createGain();
      swell(g, t, 0.5, dur * 0.72, dur * 0.28);
      air.connect(bp).connect(g).connect(bus);
      this.playSource(air, t, t + dur + 0.05);
    }

    const tone = ctx.createOscillator();
    tone.type = 'sine';
    tone.frequency.setValueAtTime(90, t);
    tone.frequency.exponentialRampToValueAtTime(420, t + dur);
    const tg = ctx.createGain();
    swell(tg, t, 0.16, dur * 0.8, dur * 0.2);
    tone.connect(tg).connect(bus);
    this.playSource(tone, t, t + dur + 0.05);

    this.endVoice(bus, dur + 0.2);
  }

  /**
   * Implosion = the reverse gesture: rising suction (bandpass sweeping up while
   * a saw falls) that snaps into silence, then one compact burst.
   */
  implosion(): void {
    const v = this.beginVoice();
    if (!v) return;
    const { ctx, t, bus } = v;
    const collapse = 0.9;
    const burstAt = t + collapse;
    const total = collapse + 0.7;

    // Collapsing pitch.
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(760, t);
    o.frequency.exponentialRampToValueAtTime(38, burstAt);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(3000, t);
    lp.frequency.exponentialRampToValueAtTime(200, burstAt);
    const og = ctx.createGain();
    og.gain.setValueAtTime(MIN_GAIN, t);
    og.gain.linearRampToValueAtTime(0.32, burstAt - 0.05);
    og.gain.exponentialRampToValueAtTime(MIN_GAIN, burstAt);
    o.connect(lp).connect(og).connect(bus);
    this.playSource(o, t, burstAt + 0.02);

    // Air being sucked inward: bandpass rises as gain rises.
    const suck = this.noise(ctx, this.whiteBuf, 0.9);
    if (suck) {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = 3;
      bp.frequency.setValueAtTime(300, t);
      bp.frequency.exponentialRampToValueAtTime(3200, burstAt);
      const g = ctx.createGain();
      g.gain.setValueAtTime(MIN_GAIN, t);
      g.gain.linearRampToValueAtTime(0.3, burstAt - 0.03);
      g.gain.exponentialRampToValueAtTime(MIN_GAIN, burstAt);
      suck.connect(bp).connect(g).connect(bus);
      this.playSource(suck, t, burstAt + 0.02);
    }

    // Release burst.
    const boom = ctx.createOscillator();
    boom.type = 'sine';
    boom.frequency.setValueAtTime(110, burstAt);
    boom.frequency.exponentialRampToValueAtTime(30, burstAt + 0.55);
    const bg = ctx.createGain();
    percussive(bg, burstAt, 0.85, 0.004, 0.6);
    boom.connect(bg).connect(bus);
    this.playSource(boom, burstAt, burstAt + 0.68);

    const shrap = this.noise(ctx, this.whiteBuf, 1.3);
    if (shrap) {
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 700;
      const g = ctx.createGain();
      percussive(g, burstAt, 0.35, 0.002, 0.3);
      shrap.connect(hp).connect(g).connect(bus);
      this.playSource(shrap, burstAt, burstAt + 0.4);
    }

    this.endVoice(bus, total + 0.2);
  }

  /** UI blip = one quiet, quickly falling sine - deliberately tiny. */
  uiClick(): void {
    const v = this.beginVoice();
    if (!v) return;
    const { ctx, t, bus } = v;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(1180, t);
    o.frequency.exponentialRampToValueAtTime(720, t + 0.05);
    const g = ctx.createGain();
    percussive(g, t, 0.09, 0.002, 0.05);
    o.connect(g).connect(bus);
    this.playSource(o, t, t + 0.09);
    this.endVoice(bus, 0.12);
  }

  // ------------------------------------------------------------ sustained beds

  windLevel(v: number): void {
    if (this.wind) this.wind.target = clamp(v, 0, 1);
  }

  quakeLevel(v: number): void {
    if (this.quake) this.quake.target = clamp(v, 0, 1);
  }

  waterLevel(v: number): void {
    if (this.water) this.water.target = clamp(v, 0, 1);
  }

  singularity(v: number): void {
    if (this.hum) this.hum.target = clamp(v, 0, 1);
  }

  /** Frame hook: exponential approach (time constant ~1/4s) toward each target. */
  update(dt: number): void {
    if (this.beds.length === 0) return;
    const step = clamp(dt, 0, 0.25);
    const k = 1 - Math.exp(-4 * step);
    for (const bed of this.beds) {
      const diff = bed.target - bed.current;
      if (Math.abs(diff) < 0.0005) {
        if (bed.current !== bed.target) {
          bed.current = bed.target;
          bed.gain.gain.value = bed.current * bed.scale;
        }
        continue;
      }
      bed.current += diff * k;
      bed.gain.gain.value = bed.current * bed.scale;
    }
  }

  // ---------------------------------------------------------------- teardown

  dispose(): void {
    for (const id of this.timers) clearTimeout(id);
    this.timers.clear();

    for (const src of this.permanentSources) {
      try {
        src.stop();
      } catch {
        /* never started or already stopped */
      }
      safeDisconnect(src);
    }
    this.permanentSources = [];

    for (const node of this.permanent) safeDisconnect(node);
    this.permanent = [];

    for (const bed of this.beds) safeDisconnect(bed.gain);
    this.beds = [];
    this.wind = null;
    this.quake = null;
    this.water = null;
    this.hum = null;

    if (this.master) safeDisconnect(this.master);
    if (this.comp) safeDisconnect(this.comp);
    this.master = null;
    this.comp = null;
    this.whiteBuf = null;
    this.brownBuf = null;
    this.voices = 0;
    this.impactStamps = [];

    const ctx = this.ctx;
    this.ctx = null;
    if (ctx) {
      try {
        const p: unknown = ctx.close();
        if (p instanceof Promise) p.catch(() => undefined);
      } catch {
        /* already closed */
      }
    }
  }

  // ---------------------------------------------------------------- internals

  /** Build master chain, noise buffers and the four beds. Called once. */
  private buildGraph(ctx: AudioContext): void {
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 24;
    comp.ratio.value = 3;
    comp.attack.value = 0.004;
    comp.release.value = 0.22;
    comp.connect(ctx.destination);

    const master = ctx.createGain();
    master.gain.value = this._enabled ? this.masterLevel : 0;
    master.connect(comp);

    this.comp = comp;
    this.master = master;

    this.whiteBuf = makeWhiteNoise(ctx);
    this.brownBuf = makeBrownNoise(ctx);

    const wind = this.buildWind(ctx, master);
    const quake = this.buildQuake(ctx, master);
    const water = this.buildWater(ctx, master);
    const hum = this.buildSingularity(ctx, master);
    this.wind = wind;
    this.quake = quake;
    this.water = water;
    this.hum = hum;
    this.beds = [wind, quake, water, hum];
  }

  private newBed(ctx: AudioContext, dest: AudioNode, scale: number): Bed {
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(dest);
    return { gain, scale, target: 0, current: 0, sources: [], oscs: [], filters: [] };
  }

  /** Wind: band-passed white noise, LFO on cutoff (whistle) and gain (gusts). */
  private buildWind(ctx: AudioContext, dest: AudioNode): Bed {
    const bed = this.newBed(ctx, dest, 0.3);

    const gust = ctx.createGain();
    gust.gain.value = 0.62;
    gust.connect(bed.gain);

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 520;
    bp.Q.value = 0.75;
    bp.connect(gust);

    const src = this.loopNoise(ctx, this.whiteBuf, 0.9);
    if (src) {
      src.connect(bp);
      bed.sources.push({ node: src, base: 0.9 });
    }

    const sweepLfo = ctx.createOscillator();
    sweepLfo.type = 'sine';
    sweepLfo.frequency.value = 0.07;
    const sweepAmt = ctx.createGain();
    sweepAmt.gain.value = 260;
    sweepLfo.connect(sweepAmt).connect(bp.frequency);
    this.startPermanentOsc(sweepLfo);

    const gustLfo = ctx.createOscillator();
    gustLfo.type = 'sine';
    gustLfo.frequency.value = 0.13;
    const gustAmt = ctx.createGain();
    gustAmt.gain.value = 0.3;
    gustLfo.connect(gustAmt).connect(gust.gain);
    this.startPermanentOsc(gustLfo);

    bed.filters.push({ node: bp, base: bp.frequency.value });
    bed.oscs.push({ node: sweepLfo, base: 0.07 }, { node: gustLfo, base: 0.13 });
    this.permanent.push(gust, bp, sweepAmt, gustAmt);
    return bed;
  }

  /** Quake: brown noise at 1/4 speed through a 42Hz lowpass + a 21Hz sub sine. */
  private buildQuake(ctx: AudioContext, dest: AudioNode): Bed {
    const bed = this.newBed(ctx, dest, 0.75);

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 46;
    lp.Q.value = 1.2;
    lp.connect(bed.gain);

    const src = this.loopNoise(ctx, this.brownBuf, 0.22);
    if (src) {
      src.connect(lp);
      bed.sources.push({ node: src, base: 0.22 });
    }

    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.value = 21;
    const subAmt = ctx.createGain();
    subAmt.gain.value = 0.45;
    sub.connect(subAmt).connect(bed.gain);
    this.startPermanentOsc(sub);

    bed.filters.push({ node: lp, base: lp.frequency.value });
    bed.oscs.push({ node: sub, base: 21 });
    this.permanent.push(lp, subAmt);
    return bed;
  }

  /** Water: fast white noise, wandering bandpass + highpass = burbling flow. */
  private buildWater(ctx: AudioContext, dest: AudioNode): Bed {
    const bed = this.newBed(ctx, dest, 0.26);

    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 380;
    hp.connect(bed.gain);

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1500;
    bp.Q.value = 0.6;
    bp.connect(hp);

    const src = this.loopNoise(ctx, this.whiteBuf, 1.35);
    if (src) {
      src.connect(bp);
      bed.sources.push({ node: src, base: 1.35 });
    }

    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.31;
    const amt = ctx.createGain();
    amt.gain.value = 620;
    lfo.connect(amt).connect(bp.frequency);
    this.startPermanentOsc(lfo);

    bed.filters.push({ node: bp, base: bp.frequency.value }, { node: hp, base: hp.frequency.value });
    bed.oscs.push({ node: lfo, base: 0.31 });
    this.permanent.push(hp, bp, amt);
    return bed;
  }

  /** Singularity: inharmonic low drone + resonant band on a square = metal hum. */
  private buildSingularity(ctx: AudioContext, dest: AudioNode): Bed {
    const bed = this.newBed(ctx, dest, 0.34);

    const body = ctx.createBiquadFilter();
    body.type = 'lowpass';
    body.frequency.value = 520;
    body.Q.value = 0.9;
    body.connect(bed.gain);

    const ring = ctx.createBiquadFilter();
    ring.type = 'bandpass';
    ring.frequency.value = 330;
    ring.Q.value = 7;
    ring.connect(bed.gain);

    const drone = ctx.createOscillator();
    drone.type = 'triangle';
    drone.frequency.value = 43.7;
    const droneAmt = ctx.createGain();
    droneAmt.gain.value = 0.55;
    drone.connect(droneAmt).connect(body);
    this.startPermanentOsc(drone);

    const beat = ctx.createOscillator();
    beat.type = 'sawtooth';
    beat.frequency.value = 65.9; // slightly off 1.5x -> slow beating
    const beatAmt = ctx.createGain();
    beatAmt.gain.value = 0.22;
    beat.connect(beatAmt).connect(body);
    this.startPermanentOsc(beat);

    const metal = ctx.createOscillator();
    metal.type = 'square';
    metal.frequency.value = 174.3;
    const metalAmt = ctx.createGain();
    metalAmt.gain.value = 0.16;
    metal.connect(metalAmt).connect(ring);
    this.startPermanentOsc(metal);

    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.09;
    const amt = ctx.createGain();
    amt.gain.value = 70;
    lfo.connect(amt).connect(ring.frequency);
    this.startPermanentOsc(lfo);

    bed.filters.push({ node: body, base: body.frequency.value }, { node: ring, base: ring.frequency.value });
    bed.oscs.push(
      { node: drone, base: 43.7 },
      { node: beat, base: 65.9 },
      { node: metal, base: 174.3 },
      { node: lfo, base: 0.09 },
    );
    this.permanent.push(body, ring, droneAmt, beatAmt, metalAmt, amt);
    return bed;
  }

  private startPermanentOsc(osc: OscillatorNode): void {
    try {
      osc.start();
    } catch {
      /* ignore double start */
    }
    this.permanentSources.push(osc);
  }

  /** Looping noise source for a bed (never stopped until dispose). */
  private loopNoise(ctx: AudioContext, buf: AudioBuffer | null, rate: number): AudioBufferSourceNode | null {
    if (!buf) return null;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.playbackRate.value = rate;
    try {
      src.start();
    } catch {
      return null;
    }
    this.permanentSources.push(src);
    return src;
  }

  /** One-shot noise voice: random offset into the buffer keeps repeats varied. */
  private noise(ctx: AudioContext, buf: AudioBuffer | null, rate: number): AudioBufferSourceNode | null {
    if (!buf) return null;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.loopEnd = buf.duration;
    src.playbackRate.value = rate;
    return src;
  }

  /** Start + hard-stop a one-shot source and drop its connections when it ends. */
  private playSource(src: AudioScheduledSourceNode, start: number, stop: number): void {
    src.onended = () => {
      src.onended = null;
      safeDisconnect(src);
    };
    try {
      if (src instanceof AudioBufferSourceNode) {
        // Random read offset for noise variety (buffers are 2s long).
        const buf = src.buffer;
        src.start(start, buf ? Math.random() * buf.duration : 0);
      } else {
        src.start(start);
      }
      src.stop(Math.max(stop, start + 0.01));
    } catch {
      safeDisconnect(src);
    }
  }

  /** Reserve a one-shot voice slot and hand back its per-voice bus. */
  private beginVoice(): { ctx: AudioContext; t: number; bus: GainNode } | null {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master || !this._enabled) return null;
    if (this.voices >= AudioEngine.MAX_VOICES) return null;
    const bus = ctx.createGain();
    bus.gain.value = 1;
    bus.connect(master);
    this.voices++;
    return { ctx, t: ctx.currentTime + 0.005, bus };
  }

  /** Scheduled cleanup: tear down the bus and free the voice slot. */
  private endVoice(bus: GainNode, lifetime: number): void {
    const ms = Math.max(30, lifetime * 1000 + 150);
    const id = setTimeout(() => {
      this.timers.delete(id);
      safeDisconnect(bus);
      this.voices = this.voices > 0 ? this.voices - 1 : 0;
    }, ms) as unknown as number;
    this.timers.add(id);
  }
}

/** 2s of flat white noise: the source for cracks, hiss, air and debris. */
function makeWhiteNoise(ctx: AudioContext): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * 2);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

/** 2s of brown-ish noise (leaky integrated white, ~-6dB/oct): rumble material. */
function makeBrownNoise(ctx: AudioContext): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * 2);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    last = (last + 0.02 * w) / 1.02;
    data[i] = clamp(last * 3.5, -1, 1);
  }
  return buf;
}
