// Procedural audio engine using WebAudio. No external files needed.
class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.ambientGain = null;
    this.started = false;
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(this.ctx.destination);
  }

  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }

  now() { return this.ctx.currentTime; }

  // ---- reusable noise buffer ----
  noiseBuffer(seconds = 1) {
    const len = this.ctx.sampleRate * seconds;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  // ---- Ambient room tone: low hum + fluorescent buzz + air ----
  startAmbience() {
    if (this.started) return;
    this.started = true;
    const t = this.now();

    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.value = 0.0;
    this.ambientGain.gain.linearRampToValueAtTime(0.5, t + 4);
    this.ambientGain.connect(this.master);

    // deep hum
    const hum = this.ctx.createOscillator();
    hum.type = 'sine'; hum.frequency.value = 55;
    const humG = this.ctx.createGain(); humG.gain.value = 0.10;
    hum.connect(humG).connect(this.ambientGain); hum.start();

    // fluorescent 100hz buzz
    const buzz = this.ctx.createOscillator();
    buzz.type = 'sawtooth'; buzz.frequency.value = 100;
    const buzzF = this.ctx.createBiquadFilter();
    buzzF.type = 'bandpass'; buzzF.frequency.value = 2600; buzzF.Q.value = 4;
    const buzzG = this.ctx.createGain(); buzzG.gain.value = 0.02;
    buzz.connect(buzzF).connect(buzzG).connect(this.ambientGain); buzz.start();
    this.buzzGain = buzzG;

    // airy noise bed
    const air = this.ctx.createBufferSource();
    air.buffer = this.noiseBuffer(2); air.loop = true;
    const airF = this.ctx.createBiquadFilter();
    airF.type = 'lowpass'; airF.frequency.value = 500;
    const airG = this.ctx.createGain(); airG.gain.value = 0.05;
    air.connect(airF).connect(airG).connect(this.ambientGain); air.start();
  }

  setDread(x) { // 0..1 raise tension bed
    if (!this.ambientGain) return;
    const t = this.now();
    if (this.buzzGain) this.buzzGain.gain.setTargetAtTime(0.02 + x * 0.05, t, 0.5);
  }

  // fluorescent flicker zap
  lightFlicker() {
    const t = this.now();
    const o = this.ctx.createOscillator();
    o.type = 'square'; o.frequency.value = 120 + Math.random() * 60;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0, t);
    g.gain.linearRampToValueAtTime(0.06, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    o.connect(g).connect(this.master); o.start(t); o.stop(t + 0.2);
  }

  footstep(running = false) {
    const t = this.now();
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer(0.2);
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = running ? 900 : 550;
    const g = this.ctx.createGain();
    const vol = running ? 0.18 : 0.11;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    src.connect(f).connect(g).connect(this.master); src.start(t); src.stop(t + 0.15);
  }

  // UI blip
  blip(freq = 660, dur = 0.08, vol = 0.12) {
    const t = this.now();
    const o = this.ctx.createOscillator();
    o.type = 'square'; o.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master); o.start(t); o.stop(t + dur);
  }

  taskComplete() {
    this.blip(523, 0.09, 0.1);
    setTimeout(() => this.blip(784, 0.14, 0.1), 90);
  }

  doorCreak() {
    const t = this.now();
    const o = this.ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(90, t);
    o.frequency.linearRampToValueAtTime(180, t + 1.2);
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 400; f.Q.value = 8;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0, t);
    g.gain.linearRampToValueAtTime(0.09, t + 0.2);
    g.gain.setValueAtTime(0.09, t + 0.9);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.3);
    o.connect(f).connect(g).connect(this.master); o.start(t); o.stop(t + 1.3);
  }

  // konbini entrance chime (piroriro)
  doorChime() {
    const seq = [784, 988, 1319, 988];
    seq.forEach((fr, i) => {
      const t = this.now() + i * 0.14;
      const o = this.ctx.createOscillator();
      o.type = 'sine'; o.frequency.value = fr;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0, t);
      g.gain.linearRampToValueAtTime(0.12, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      o.connect(g).connect(this.master); o.start(t); o.stop(t + 0.3);
    });
  }

  heartbeat() {
    const t = this.now();
    const beat = (tt, v) => {
      const o = this.ctx.createOscillator();
      o.type = 'sine'; o.frequency.setValueAtTime(60, tt);
      o.frequency.exponentialRampToValueAtTime(35, tt + 0.15);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(v, tt);
      g.gain.exponentialRampToValueAtTime(0.001, tt + 0.22);
      o.connect(g).connect(this.master); o.start(tt); o.stop(tt + 0.25);
    };
    beat(t, 0.3); beat(t + 0.28, 0.22);
  }

  whisper() {
    const t = this.now();
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer(1.4);
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 1500; f.Q.value = 2;
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 6;
    const lfoG = this.ctx.createGain(); lfoG.gain.value = 800;
    lfo.connect(lfoG).connect(f.frequency); lfo.start(t); lfo.stop(t + 1.4);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.06, t + 0.4);
    g.gain.linearRampToValueAtTime(0, t + 1.4);
    src.connect(f).connect(g).connect(this.master); src.start(t); src.stop(t + 1.4);
  }

  // big jumpscare: violin-ish screech + boom
  scare() {
    const t = this.now();
    // boom
    const bo = this.ctx.createOscillator();
    bo.type = 'sine';
    bo.frequency.setValueAtTime(140, t);
    bo.frequency.exponentialRampToValueAtTime(30, t + 1.6);
    const bg = this.ctx.createGain();
    bg.gain.setValueAtTime(0.9, t);
    bg.gain.exponentialRampToValueAtTime(0.001, t + 1.8);
    bo.connect(bg).connect(this.master); bo.start(t); bo.stop(t + 1.8);
    // screech
    const sc = this.ctx.createOscillator();
    sc.type = 'sawtooth';
    sc.frequency.setValueAtTime(1800, t);
    sc.frequency.linearRampToValueAtTime(2600, t + 0.3);
    const scf = this.ctx.createBiquadFilter();
    scf.type = 'highpass'; scf.frequency.value = 1200;
    const scg = this.ctx.createGain();
    scg.gain.setValueAtTime(0.35, t);
    scg.gain.linearRampToValueAtTime(0.0, t + 1.0);
    sc.connect(scf).connect(scg).connect(this.master); sc.start(t); sc.stop(t + 1.0);
    // noise burst
    const n = this.ctx.createBufferSource();
    n.buffer = this.noiseBuffer(0.8);
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.5, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
    n.connect(ng).connect(this.master); n.start(t); n.stop(t + 0.8);
  }

  drone(on) {
    const t = this.now();
    if (on && !this._drone) {
      const o = this.ctx.createOscillator();
      o.type = 'sawtooth'; o.frequency.value = 47;
      const o2 = this.ctx.createOscillator();
      o2.type = 'sawtooth'; o2.frequency.value = 48.5;
      const f = this.ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=300;
      const g = this.ctx.createGain(); g.gain.value = 0;
      g.gain.linearRampToValueAtTime(0.25, t + 3);
      o.connect(f); o2.connect(f); f.connect(g).connect(this.master);
      o.start(); o2.start();
      this._drone = { o, o2, g };
    } else if (!on && this._drone) {
      this._drone.g.gain.setTargetAtTime(0, t, 1);
      const d = this._drone; this._drone = null;
      setTimeout(() => { try { d.o.stop(); d.o2.stop(); } catch(e){} }, 3000);
    }
  }
}
