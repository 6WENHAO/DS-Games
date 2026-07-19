// ============ Web Audio 程序化音效引擎 ============
const Sfx = (() => {
  let ctx = null, master = null, musicBus = null, sfxBus = null;
  const loops = {};

  function init() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0.55; master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 1.0; sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.5; musicBus.connect(master);
  }
  function now() { return ctx ? ctx.currentTime : 0; }

  function env(g, t, a, peak, d, sustain = 0) {
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0001), t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(sustain, 0.0001), t + a + d);
  }

  function osc(type, freq, t0, dur, gain, dest, detune = 0) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0); o.detune.value = detune;
    o.connect(g); g.connect(dest || sfxBus);
    env(g, t0, 0.005, gain, dur);
    o.start(t0); o.stop(t0 + dur + 0.1);
    return { o, g };
  }

  function noiseBuffer(dur = 1) {
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  function noiseBurst(t0, dur, gain, filterFreq, q = 1, type = 'lowpass') {
    const src = ctx.createBufferSource(); src.buffer = noiseBuffer(dur + 0.1);
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = filterFreq; f.Q.value = q;
    const g = ctx.createGain();
    src.connect(f); f.connect(g); g.connect(sfxBus);
    env(g, t0, 0.005, gain, dur);
    src.start(t0); src.stop(t0 + dur + 0.15);
    return { src, f, g };
  }

  // ---------- 单发音效 ----------
  const S = {
    init,
    resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); },

    uiHover() { if (!ctx) return; osc('sine', 1400, now(), 0.05, 0.06); },
    uiClick() {
      if (!ctx) return; const t = now();
      osc('sine', 900, t, 0.06, 0.12);
      osc('sine', 1800, t + 0.04, 0.08, 0.08);
    },
    uiOpen() {
      if (!ctx) return; const t = now();
      const { o } = osc('sine', 500, t, 0.18, 0.1);
      o.frequency.exponentialRampToValueAtTime(1200, t + 0.15);
      noiseBurst(t, 0.1, 0.03, 4000, 1, 'highpass');
    },
    uiClose() {
      if (!ctx) return; const t = now();
      const { o } = osc('sine', 1100, t, 0.15, 0.09);
      o.frequency.exponentialRampToValueAtTime(400, t + 0.13);
    },
    notify() {
      if (!ctx) return; const t = now();
      osc('sine', 660, t, 0.3, 0.14);
      osc('sine', 990, t + 0.12, 0.35, 0.12);
      osc('sine', 1320, t + 0.24, 0.5, 0.1);
    },
    missionDone() {
      if (!ctx) return; const t = now();
      [523, 659, 784, 1047].forEach((f, i) => osc('triangle', f, t + i * 0.12, 0.4, 0.13));
      noiseBurst(t, 0.5, 0.03, 6000, 1, 'highpass');
    },
    pickup(pitch = 1) {
      if (!ctx) return; const t = now();
      const { o } = osc('square', 700 * pitch, t, 0.07, 0.05);
      o.frequency.setValueAtTime(1050 * pitch, t + 0.045);
    },
    craft() {
      if (!ctx) return; const t = now();
      osc('triangle', 440, t, 0.12, 0.12);
      osc('triangle', 587, t + 0.08, 0.12, 0.12);
      osc('triangle', 880, t + 0.16, 0.3, 0.14);
      noiseBurst(t + 0.16, 0.2, 0.05, 5000, 1, 'highpass');
    },
    repair() {
      if (!ctx) return; const t = now();
      noiseBurst(t, 0.25, 0.1, 2400, 3, 'bandpass');
      osc('sawtooth', 220, t, 0.2, 0.06);
      osc('triangle', 880, t + 0.22, 0.35, 0.12);
      osc('triangle', 1174, t + 0.34, 0.4, 0.1);
    },
    error() {
      if (!ctx) return; const t = now();
      osc('square', 200, t, 0.12, 0.1);
      osc('square', 160, t + 0.13, 0.16, 0.1);
    },

    blockBreak(hard = false) {
      if (!ctx) return; const t = now();
      noiseBurst(t, 0.14, 0.28, hard ? 900 : 500, 1.5);
      const { o } = osc('triangle', hard ? 320 : 200, t, 0.1, 0.14);
      o.frequency.exponentialRampToValueAtTime(60, t + 0.1);
    },
    blockPlace() {
      if (!ctx) return; const t = now();
      noiseBurst(t, 0.08, 0.18, 700, 2);
      osc('triangle', 260, t, 0.08, 0.12);
    },
    crunch(i) {
      if (!ctx) return; const t = now();
      noiseBurst(t, 0.05, 0.1, 800 + (i % 3) * 300, 2);
    },
    footstep(surface = 0) {
      if (!ctx) return; const t = now();
      const freqs = [420, 340, 550];
      noiseBurst(t, 0.07, 0.055 + Math.random() * 0.02, freqs[surface % 3] + Math.random() * 120, 1.2);
    },
    jump() { if (!ctx) return; noiseBurst(now(), 0.12, 0.07, 600, 1); },
    land(hard = false) {
      if (!ctx) return; const t = now();
      noiseBurst(t, hard ? 0.22 : 0.12, hard ? 0.25 : 0.12, 400, 1);
      if (hard) osc('sine', 80, t, 0.18, 0.2);
    },
    hurt() {
      if (!ctx) return; const t = now();
      const { o } = osc('sawtooth', 300, t, 0.25, 0.16);
      o.frequency.exponentialRampToValueAtTime(90, t + 0.22);
      noiseBurst(t, 0.15, 0.1, 1200, 2);
    },
    warning() {
      if (!ctx) return; const t = now();
      osc('square', 880, t, 0.14, 0.06);
      osc('square', 880, t + 0.25, 0.14, 0.06);
    },
    launch() {
      if (!ctx) return; const t = now();
      const nb = noiseBurst(t, 3.2, 0.5, 300, 0.7);
      nb.f.frequency.exponentialRampToValueAtTime(2500, t + 2.6);
      const { o } = osc('sawtooth', 45, t, 3, 0.3);
      o.frequency.exponentialRampToValueAtTime(160, t + 2.8);
    },
    landingThud() {
      if (!ctx) return; const t = now();
      noiseBurst(t, 0.5, 0.35, 500, 1);
      osc('sine', 60, t, 0.4, 0.3);
      noiseBurst(t + 0.15, 1.2, 0.14, 1800, 1, 'highpass'); // 蒸汽声
    },
    pulseEngage() {
      if (!ctx) return; const t = now();
      const { o } = osc('sawtooth', 120, t, 1.4, 0.2);
      o.frequency.exponentialRampToValueAtTime(900, t + 1.2);
      const nb = noiseBurst(t, 1.5, 0.2, 800, 1);
      nb.f.frequency.exponentialRampToValueAtTime(5000, t + 1.3);
    },
    pulseDisengage() {
      if (!ctx) return; const t = now();
      const { o } = osc('sawtooth', 800, t, 1.0, 0.18);
      o.frequency.exponentialRampToValueAtTime(100, t + 0.9);
      noiseBurst(t, 0.8, 0.15, 2000, 1);
    },
    entryBoom() {
      if (!ctx) return; const t = now();
      noiseBurst(t, 2.5, 0.45, 220, 0.6);
      osc('sine', 42, t, 2.2, 0.35);
    },
    scanPing() {
      if (!ctx) return; const t = now();
      const { o } = osc('sine', 1200, t, 0.6, 0.1);
      o.frequency.exponentialRampToValueAtTime(2400, t + 0.5);
    },

    // ---------- 循环音效 ----------
    startLoop(name, build) {
      if (!ctx || loops[name]) return;
      loops[name] = build();
    },
    stopLoop(name, fade = 0.15) {
      const l = loops[name];
      if (!l) return;
      const t = now();
      l.gain.gain.cancelScheduledValues(t);
      l.gain.gain.setValueAtTime(Math.max(l.gain.gain.value, 0.0001), t);
      l.gain.gain.exponentialRampToValueAtTime(0.0001, t + fade);
      setTimeout(() => { l.nodes.forEach(n => { try { n.stop(); } catch (e) {} }); }, fade * 1000 + 80);
      delete loops[name];
    },
    setLoopParam(name, fn) { if (loops[name]) fn(loops[name]); },
    hasLoop(name) { return !!loops[name]; },

    mineLoop() {
      S.startLoop('mine', () => {
        const t = now();
        const o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 85;
        const o2 = ctx.createOscillator(); o2.type = 'square'; o2.frequency.value = 170.5;
        const lfo = ctx.createOscillator(); lfo.frequency.value = 22;
        const lfoG = ctx.createGain(); lfoG.gain.value = 30;
        lfo.connect(lfoG); lfoG.connect(o1.frequency);
        const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 800; f.Q.value = 2;
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.12, t + 0.08);
        o1.connect(f); o2.connect(f); f.connect(g); g.connect(sfxBus);
        o1.start(); o2.start(); lfo.start();
        return { gain: g, filter: f, nodes: [o1, o2, lfo] };
      });
    },
    jetLoop() {
      S.startLoop('jet', () => {
        const t = now();
        const src = ctx.createBufferSource(); src.buffer = noiseBuffer(2); src.loop = true;
        const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1200; f.Q.value = 0.8;
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.16, t + 0.12);
        src.connect(f); f.connect(g); g.connect(sfxBus);
        src.start();
        return { gain: g, filter: f, nodes: [src] };
      });
    },
    shipLoop() {
      S.startLoop('ship', () => {
        const t = now();
        const o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 55;
        const o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = 55.7;
        const src = ctx.createBufferSource(); src.buffer = noiseBuffer(2); src.loop = true;
        const nf = ctx.createBiquadFilter(); nf.type = 'lowpass'; nf.frequency.value = 600;
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500;
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.18, t + 0.4);
        o1.connect(f); o2.connect(f); src.connect(nf); nf.connect(g); f.connect(g); g.connect(sfxBus);
        o1.start(); o2.start(); src.start();
        return { gain: g, filter: f, o1, o2, nodes: [o1, o2, src] };
      });
    },
    shipThrottle(v) { // v: 0~1
      S.setLoopParam('ship', l => {
        const t = now();
        l.o1.frequency.setTargetAtTime(55 + v * 90, t, 0.2);
        l.o2.frequency.setTargetAtTime(55.7 + v * 91, t, 0.2);
        l.filter.frequency.setTargetAtTime(500 + v * 2200, t, 0.2);
        l.gain.gain.setTargetAtTime(0.12 + v * 0.14, t, 0.2);
      });
    },
    windLoop(intensity = 1) {
      S.startLoop('wind', () => {
        const src = ctx.createBufferSource(); src.buffer = noiseBuffer(4); src.loop = true;
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 320; f.Q.value = 0.4;
        const g = ctx.createGain(); g.gain.value = 0.0001;
        g.gain.setTargetAtTime(0.05 * intensity, now(), 1.5);
        const lfo = ctx.createOscillator(); lfo.frequency.value = 0.13;
        const lfoG = ctx.createGain(); lfoG.gain.value = 130;
        lfo.connect(lfoG); lfoG.connect(f.frequency);
        src.connect(f); f.connect(g); g.connect(musicBus);
        src.start(); lfo.start();
        return { gain: g, filter: f, nodes: [src, lfo] };
      });
    },
    spaceLoop() {
      S.startLoop('space', () => {
        const g = ctx.createGain(); g.gain.value = 0.0001;
        g.gain.setTargetAtTime(0.06, now(), 2);
        const nodes = [];
        [55, 82.4, 110, 164.8].forEach((f0, i) => {
          const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f0;
          const og = ctx.createGain(); og.gain.value = 0.5 / (i + 1);
          const lfo = ctx.createOscillator(); lfo.frequency.value = 0.05 + i * 0.03;
          const lg = ctx.createGain(); lg.gain.value = 0.25 / (i + 1);
          lfo.connect(lg); lg.connect(og.gain);
          o.connect(og); og.connect(g);
          o.start(); lfo.start();
          nodes.push(o, lfo);
        });
        g.connect(musicBus);
        return { gain: g, nodes };
      });
    },
    stopAllLoops() { Object.keys(loops).forEach(k => S.stopLoop(k)); },
  };
  return S;
})();
