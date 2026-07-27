// ---------------------------------------------------------------------------
// Diegetic response sounds are the game's voice. Synthesised here so the risk
// slice carries no audio payload; production would stream Opus stems and drive
// their gains from elevation, speed and response density.
// Chimes are pentatonic, so any random collision is consonant.
// ---------------------------------------------------------------------------

export class Audio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.windGain = null;
    this.enabled = false;
    this._lastChime = 0;
  }

  // must be called from a user gesture (also satisfies the autoplay policy)
  start() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(this.ctx.destination);

    // wind bed: filtered noise, slowly breathing
    const len = this.ctx.sampleRate * 3;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    let v = 0;
    for (let i = 0; i < len; i++) {
      v = v * 0.97 + (Math.random() * 2 - 1) * 0.03;
      d[i] = v;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 620; lp.Q.value = 0.4;
    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = 0.12;
    src.connect(lp).connect(this.windGain).connect(this.master);
    src.start();

    this.enabled = true;
  }

  _now() { return this.ctx.currentTime; }

  chime(semitone) {
    if (!this.enabled) return;
    const t = this._now();
    if (t - this._lastChime < 0.02) return;         // never a machine-gun
    this._lastChime = t;
    const f = 261.63 * Math.pow(2, (semitone + 12) / 12);
    const o = this.ctx.createOscillator();
    const o2 = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sine'; o.frequency.value = f;
    o2.type = 'sine'; o2.frequency.value = f * 2.01;
    const g2 = this.ctx.createGain(); g2.gain.value = 0.22;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.30, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
    o.connect(g); o2.connect(g2).connect(g);
    g.connect(this.master);
    o.start(t); o2.start(t);
    o.stop(t + 2.5); o2.stop(t + 2.5);
  }

  call() {
    if (!this.enabled) return;
    const t = this._now();
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(392, t);
    o.frequency.exponentialRampToValueAtTime(261.63, t + 0.9);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.20, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + 1.7);
  }

  // the "air" stem rises with speed and altitude
  setWind(intensity) {
    if (!this.enabled) return;
    const g = this.windGain.gain;
    g.setTargetAtTime(0.08 + intensity * 0.22, this._now(), 0.35);
  }
}
