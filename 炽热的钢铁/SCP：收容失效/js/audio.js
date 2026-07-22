window.SCP = window.SCP || {};
(function (S) {
  const A = {};
  S.audio = A;
  let ctx = null, master, sfxBus, musBus;
  A.volume = 0.8;

  A.init = function () {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = A.volume;
    master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.connect(master);
    musBus = ctx.createGain(); musBus.gain.value = 0.5; musBus.connect(master);
    A.ctx = ctx;
  };
  A.setVolume = function (v) {
    A.volume = v;
    if (master) master.gain.value = v;
  };
  A.resume = function () { if (ctx && ctx.state === 'suspended') ctx.resume(); };

  function noiseBuffer(sec) {
    const len = Math.floor(ctx.sampleRate * sec);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }
  let sharedNoise = null;
  function getNoise() {
    if (!sharedNoise) sharedNoise = noiseBuffer(2);
    return sharedNoise;
  }
  function env(g, t0, a, peak, d, sustain, r, end) {
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + a);
    g.gain.exponentialRampToValueAtTime(Math.max(sustain, 0.0001), t0 + a + d);
    if (r !== undefined) g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d + r);
    if (end !== undefined) { }
  }
  function burst(opts) {
    if (!ctx) return;
    const t = ctx.currentTime + (opts.delay || 0);
    const src = ctx.createBufferSource();
    src.buffer = getNoise();
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = opts.type || 'bandpass';
    f.frequency.setValueAtTime(opts.f0 || 800, t);
    if (opts.f1) f.frequency.exponentialRampToValueAtTime(opts.f1, t + (opts.dur || 0.2));
    f.Q.value = opts.q || 1;
    const g = ctx.createGain();
    env(g, t, opts.a || 0.005, opts.vol || 0.3, (opts.dur || 0.2) * 0.6, 0.001, (opts.dur || 0.2) * 0.4);
    src.connect(f); f.connect(g); g.connect(sfxBus);
    src.start(t);
    src.stop(t + (opts.dur || 0.2) + 0.4);
  }
  function tone(opts) {
    if (!ctx) return;
    const t = ctx.currentTime + (opts.delay || 0);
    const o = ctx.createOscillator();
    o.type = opts.wave || 'sine';
    o.frequency.setValueAtTime(opts.f0 || 440, t);
    if (opts.f1) o.frequency.exponentialRampToValueAtTime(opts.f1, t + (opts.dur || 0.3));
    const g = ctx.createGain();
    env(g, t, opts.a || 0.01, opts.vol || 0.2, (opts.dur || 0.3) * 0.7, 0.001, (opts.dur || 0.3) * 0.3);
    o.connect(g); g.connect(sfxBus);
    o.start(t); o.stop(t + (opts.dur || 0.3) + 0.3);
  }
  A.burst = burst; A.tone = tone;

  A.footstep = function (sprint, zone) {
    const base = zone === 'HCZ' ? 300 : 500;
    burst({ f0: base + Math.random() * 200, q: 1.2, vol: sprint ? 0.16 : 0.09, dur: 0.09, type: 'lowpass' });
    burst({ f0: 1500 + Math.random() * 600, q: 3, vol: sprint ? 0.05 : 0.03, dur: 0.05 });
  };
  A.pickup = function () { tone({ wave: 'triangle', f0: 660, f1: 990, vol: 0.12, dur: 0.09 }); };
  A.uiClick = function () { tone({ wave: 'square', f0: 300, vol: 0.05, dur: 0.04 }); };
  A.beepOk = function () { tone({ wave: 'sine', f0: 880, vol: 0.14, dur: 0.1 }); tone({ wave: 'sine', f0: 1320, vol: 0.12, dur: 0.12, delay: 0.1 }); };
  A.beepDeny = function () { tone({ wave: 'square', f0: 220, vol: 0.14, dur: 0.16 }); tone({ wave: 'square', f0: 180, vol: 0.14, dur: 0.2, delay: 0.16 }); };
  A.doorMove = function (big) {
    burst({ f0: big ? 120 : 200, f1: big ? 90 : 160, q: 2, vol: big ? 0.34 : 0.22, dur: big ? 1.0 : 0.5, type: 'lowpass', a: 0.03 });
    burst({ f0: 2600, q: 8, vol: 0.05, dur: big ? 0.9 : 0.45 });
    tone({ wave: 'sawtooth', f0: big ? 70 : 110, f1: big ? 55 : 90, vol: 0.06, dur: big ? 0.9 : 0.4 });
  };
  A.doorThud = function () { burst({ f0: 90, q: 1, vol: 0.3, dur: 0.15, type: 'lowpass' }); };
  A.doorBreak = function () {
    burst({ f0: 300, f1: 80, q: 1, vol: 0.5, dur: 0.4, type: 'lowpass' });
    burst({ f0: 2000, q: 2, vol: 0.25, dur: 0.3 });
  };
  A.neckSnap = function () {
    burst({ f0: 900, f1: 300, q: 2, vol: 0.6, dur: 0.07 });
    burst({ f0: 600, f1: 200, q: 2, vol: 0.6, dur: 0.09, delay: 0.07 });
    burst({ f0: 150, q: 1, vol: 0.4, dur: 0.3, delay: 0.12, type: 'lowpass' });
  };
  A.sting = function () {
    tone({ wave: 'sawtooth', f0: 110, f1: 108, vol: 0.22, dur: 1.6, a: 0.02 });
    tone({ wave: 'sawtooth', f0: 116.5, f1: 113, vol: 0.2, dur: 1.6, a: 0.02 });
    tone({ wave: 'triangle', f0: 440, f1: 220, vol: 0.1, dur: 1.2, a: 0.01 });
    burst({ f0: 3000, f1: 500, q: 1, vol: 0.12, dur: 1.0 });
  };
  A.rumble = function (dur, vol) {
    burst({ f0: 60, f1: 45, q: 1, vol: vol || 0.4, dur: dur || 2, type: 'lowpass', a: 0.2 });
  };
  A.zap = function () {
    burst({ f0: 4000, f1: 800, q: 0.5, vol: 0.5, dur: 0.35, type: 'highpass' });
    tone({ wave: 'square', f0: 120, f1: 60, vol: 0.3, dur: 0.3 });
    burst({ f0: 8000, q: 1, vol: 0.3, dur: 0.15 });
  };
  A.teslaCharge = function () { tone({ wave: 'sawtooth', f0: 200, f1: 1400, vol: 0.15, dur: 0.4, a: 0.02 }); };
  A.flicker = function () {
    burst({ f0: 3500, q: 6, vol: 0.08, dur: 0.06 });
    tone({ wave: 'square', f0: 100, vol: 0.05, dur: 0.05, delay: 0.03 });
  };
  A.crack106 = function () {
    burst({ f0: 200, f1: 60, q: 1, vol: 0.45, dur: 1.4, type: 'lowpass', a: 0.05 });
    tone({ wave: 'sawtooth', f0: 55, f1: 38, vol: 0.25, dur: 2.2, a: 0.1 });
  };
  A.laugh106 = function () {
    for (let i = 0; i < 4; i++)
      tone({ wave: 'sawtooth', f0: 160 - i * 18, f1: 110 - i * 14, vol: 0.12, dur: 0.24, delay: i * 0.26, a: 0.02 });
  };
  A.pdMoan = function () {
    tone({ wave: 'sine', f0: 90, f1: 60, vol: 0.3, dur: 2.4, a: 0.4 });
    tone({ wave: 'sine', f0: 135, f1: 92, vol: 0.18, dur: 2.4, a: 0.4 });
  };
  A.scream096Start = function () {
    for (let i = 0; i < 6; i++) {
      tone({ wave: 'sawtooth', f0: 700 + i * 60, f1: 500 + i * 40, vol: 0.1, dur: 1.6, delay: i * 0.05, a: 0.02 });
    }
    burst({ f0: 1800, f1: 900, q: 1, vol: 0.3, dur: 1.8 });
  };
  A.heartbeat = function () {
    burst({ f0: 70, q: 1, vol: 0.4, dur: 0.1, type: 'lowpass' });
    burst({ f0: 60, q: 1, vol: 0.3, dur: 0.09, delay: 0.16, type: 'lowpass' });
  };
  A.elevator = function () {
    burst({ f0: 90, f1: 70, q: 1, vol: 0.3, dur: 4.5, type: 'lowpass', a: 0.5 });
    tone({ wave: 'triangle', f0: 55, vol: 0.12, dur: 4.5, a: 0.5 });
  };
  A.alarmPing = function () {
    tone({ wave: 'sine', f0: 1100, vol: 0.1, dur: 0.4 });
    tone({ wave: 'sine', f0: 880, vol: 0.1, dur: 0.5, delay: 0.45 });
  };

  A.loop = function (build) {
    if (!ctx) return { stop: () => { }, set: () => { } };
    const g = ctx.createGain();
    g.gain.value = 0;
    g.connect(sfxBus);
    const nodes = build(g);
    return {
      set(v, t) { g.gain.setTargetAtTime(v, ctx.currentTime, t || 0.1); },
      stop() {
        g.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
        setTimeout(() => { try { nodes.forEach(n => n.stop && n.stop()); } catch (e) { } }, 800);
      }
    };
  };

  A.makeAmbience = function () {
    return A.loop(g => {
      const src = ctx.createBufferSource();
      src.buffer = getNoise(); src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = 140; f.Q.value = 0.5;
      const hum = ctx.createOscillator();
      hum.type = 'sine'; hum.frequency.value = 50;
      const hg = ctx.createGain(); hg.gain.value = 0.25;
      src.connect(f); f.connect(g);
      hum.connect(hg); hg.connect(g);
      src.start(); hum.start();
      return [src, hum];
    });
  };
  A.makeScrape = function () {
    return A.loop(g => {
      const src = ctx.createBufferSource();
      src.buffer = getNoise(); src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 2.5;
      const f2 = ctx.createBiquadFilter();
      f2.type = 'bandpass'; f2.frequency.value = 210; f2.Q.value = 2;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 11;
      const lg = ctx.createGain(); lg.gain.value = 300;
      lfo.connect(lg); lg.connect(f.frequency);
      src.connect(f); f.connect(g);
      src.connect(f2); f2.connect(g);
      src.start(); lfo.start();
      return [src, lfo];
    });
  };
  A.makeSob = function () {
    return A.loop(g => {
      const o = ctx.createOscillator();
      o.type = 'sine'; o.frequency.value = 300;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.7;
      const lg = ctx.createGain(); lg.gain.value = 90;
      lfo.connect(lg); lg.connect(o.frequency);
      const trem = ctx.createOscillator(); trem.frequency.value = 5;
      const tg = ctx.createGain(); tg.gain.value = 0.5;
      const tbase = ctx.createGain(); tbase.gain.value = 0.5;
      const vg = ctx.createGain();
      trem.connect(tg);
      const sum = ctx.createGain();
      tg.connect(sum.gain); 
      o.connect(sum); sum.connect(g);
      o.start(); lfo.start(); trem.start();
      return [o, lfo, trem];
    });
  };
  A.makeScream = function () {
    return A.loop(g => {
      const nodes = [];
      for (let i = 0; i < 5; i++) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = 480 + i * 130 + Math.random() * 40;
        const og = ctx.createGain(); og.gain.value = 0.16;
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 4 + i;
        const lg = ctx.createGain(); lg.gain.value = 30;
        lfo.connect(lg); lg.connect(o.frequency);
        o.connect(og); og.connect(g);
        o.start(); lfo.start();
        nodes.push(o, lfo);
      }
      const src = ctx.createBufferSource();
      src.buffer = getNoise(); src.loop = true;
      const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1200;
      const ng = ctx.createGain(); ng.gain.value = 0.4;
      src.connect(f); f.connect(ng); ng.connect(g);
      src.start(); nodes.push(src);
      return nodes;
    });
  };
  A.makeGasHiss = function () {
    return A.loop(g => {
      const src = ctx.createBufferSource();
      src.buffer = getNoise(); src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = 'highpass'; f.frequency.value = 3000;
      src.connect(f); f.connect(g);
      src.start();
      return [src];
    });
  };
  A.makePdDrone = function () {
    return A.loop(g => {
      const o1 = ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = 48;
      const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = 49.3;
      const o3 = ctx.createOscillator(); o3.type = 'triangle'; o3.frequency.value = 96.5;
      const g3 = ctx.createGain(); g3.gain.value = 0.25;
      o1.connect(g); o2.connect(g);
      o3.connect(g3); g3.connect(g);
      o1.start(); o2.start(); o3.start();
      return [o1, o2, o3];
    });
  };
  A.makeAlarm = function () {
    return A.loop(g => {
      const o = ctx.createOscillator();
      o.type = 'square';
      const lfo = ctx.createOscillator();
      lfo.type = 'square'; lfo.frequency.value = 1.1;
      const lg = ctx.createGain(); lg.gain.value = 160;
      o.frequency.value = 620;
      lfo.connect(lg); lg.connect(o.frequency);
      const og = ctx.createGain(); og.gain.value = 0.25;
      o.connect(og); og.connect(g);
      o.start(); lfo.start();
      return [o, lfo];
    });
  };
  A.makeRadioMusic = function () {
    return A.loop(g => {
      const nodes = [];
      const chords = [[110, 130.8, 164.8], [98, 116.5, 146.8], [87.3, 110, 130.8], [103.8, 123.5, 155.6]];
      let ci = 0;
      const oscs = chords[0].map(fq => {
        const o = ctx.createOscillator();
        o.type = 'triangle'; o.frequency.value = fq;
        const og = ctx.createGain(); og.gain.value = 0.13;
        o.connect(og); og.connect(g);
        o.start();
        nodes.push(o);
        return o;
      });
      const iv = setInterval(() => {
        ci = (ci + 1) % chords.length;
        oscs.forEach((o, i) => o.frequency.setTargetAtTime(chords[ci][i], ctx.currentTime, 1.5));
      }, 7000);
      nodes.push({ stop: () => clearInterval(iv) });
      return nodes;
    });
  };
  A.makeStatic = function () {
    return A.loop(g => {
      const src = ctx.createBufferSource();
      src.buffer = getNoise(); src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass'; f.frequency.value = 1600; f.Q.value = 0.4;
      src.connect(f); f.connect(g);
      src.start();
      return [src];
    });
  };

  let voiceOn = true;
  A.setVoice = function (v) { voiceOn = v; };
  A.speak = function (text, opts) {
    if (!voiceOn || !window.speechSynthesis) return;
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US';
      u.rate = (opts && opts.rate) || 0.88;
      u.pitch = (opts && opts.pitch) || 0.45;
      u.volume = Math.min(1, A.volume + 0.1);
      const vs = speechSynthesis.getVoices();
      const en = vs.find(v => /en[-_]US/i.test(v.lang)) || vs.find(v => /^en/i.test(v.lang));
      if (en) u.voice = en;
      speechSynthesis.speak(u);
    } catch (e) { }
  };
  A.stopSpeak = function () { try { speechSynthesis.cancel(); } catch (e) { } };
})(window.SCP);
