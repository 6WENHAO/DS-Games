// ============================================================
//  audio.js  -  synthesized SFX via Web Audio (no assets).
// ============================================================
export class Audio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noiseBuf = null;
    this.enabled = true;
  }
  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    // white noise buffer
    const len = this.ctx.sampleRate * 1.0;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
  }
  resume() { if (this.ctx && this.ctx.state === "suspended") this.ctx.resume(); }

  _now() { return this.ctx.currentTime; }

  _noise(dur, vol, filterType, freq, q = 1) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = filterType; f.frequency.value = freq; f.Q.value = q;
    const g = this.ctx.createGain();
    const t = this._now();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t); src.stop(t + dur + 0.02);
    return { g, f };
  }

  _tone(freq, dur, vol, type = "sine", slideTo = null) {
    const o = this.ctx.createOscillator();
    o.type = type; o.frequency.value = freq;
    const g = this.ctx.createGain();
    const t = this._now();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  gunshot(weapon, dist = 0) {
    if (!this.ctx) return;
    const vol = Math.max(0.04, 0.55 * Math.pow(0.5, dist / 22));
    const cat = weapon ? weapon.cat : "rifle";
    let freq = 900, dur = 0.12, base = vol;
    if (cat === "pistol") { freq = 1200; dur = 0.09; }
    else if (cat === "smg") { freq = 1400; dur = 0.07; base *= 0.8; }
    else if (cat === "sniper") { freq = 500; dur = 0.28; base *= 1.3; }
    else if (cat === "heavy") { freq = 700; dur = 0.13; }
    if (weapon && weapon.silenced) { freq *= 1.6; base *= 0.5; dur *= 0.7; }
    this._noise(dur, base, "bandpass", freq, 0.8);
    this._noise(dur * 1.4, base * 0.6, "lowpass", 220, 1);
    this._tone(freq * 0.5, dur * 0.5, base * 0.3, "square", freq * 0.2);
  }

  reload() { if (!this.ctx) return;
    this._tone(400, 0.05, 0.2, "square");
    setTimeout(() => this._tone(300, 0.05, 0.18, "square"), 250);
    setTimeout(() => this._tone(600, 0.06, 0.2, "square"), 900);
  }
  empty() { if (!this.ctx) return; this._tone(2200, 0.03, 0.15, "square"); }
  knife() { if (!this.ctx) return; this._noise(0.12, 0.25, "highpass", 1800, 1); }

  hit() { if (!this.ctx) return; this._tone(500, 0.05, 0.25, "square", 300); }
  hitFlesh(dist = 0) { if (!this.ctx) return; this._noise(0.08, 0.25 * Math.pow(0.5, dist / 20), "lowpass", 400); }
  headshot() { if (!this.ctx) return; this._tone(1500, 0.08, 0.3, "sine", 900); this._noise(0.05, 0.2, "highpass", 2000); }
  hurt() { if (!this.ctx) return; this._tone(180, 0.18, 0.3, "sawtooth", 90); }
  death() { if (!this.ctx) return; this._tone(300, 0.4, 0.3, "sawtooth", 60); }

  footstep(dist = 0) { if (!this.ctx) return; this._noise(0.05, 0.08 * Math.pow(0.5, dist / 14), "lowpass", 300); }

  plantBeep() { if (!this.ctx) return; this._tone(1000, 0.06, 0.2, "square"); }
  defuseBeep() { if (!this.ctx) return; this._tone(1400, 0.05, 0.18, "square"); }
  planted() { if (!this.ctx) return; this._tone(800, 0.15, 0.3, "square"); }
  bombBeep(fast) { if (!this.ctx) return; this._tone(fast ? 2400 : 1800, 0.05, 0.25, "square"); }
  explosion() { if (!this.ctx) return;
    this._noise(0.8, 0.7, "lowpass", 200, 1);
    this._tone(80, 0.7, 0.5, "sawtooth", 30);
  }

  win() { if (!this.ctx) return;
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this._tone(f, 0.2, 0.25, "square"), i * 110));
  }
  lose() { if (!this.ctx) return;
    [400, 330, 260, 200].forEach((f, i) => setTimeout(() => this._tone(f, 0.25, 0.22, "sawtooth"), i * 130));
  }
  buy() { if (!this.ctx) return; this._tone(880, 0.06, 0.15, "sine"); }
  flash() { if (!this.ctx) return; this._noise(1.2, 0.4, "highpass", 3000, 0.5); }
}
