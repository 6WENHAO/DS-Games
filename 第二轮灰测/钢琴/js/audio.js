/* =============================================================
 * audio.js —— 纯 WebAudio 合成的三角钢琴音源
 * 加法合成（基频 + 6 个泛音，含微失谐）+ 击弦噪声 + 卷积混响
 * ============================================================= */
(function (global) {
  'use strict';

  let ctx = null;
  let master, comp, dry, wet, conv, ready = false;
  let volume = 0.85;
  let sustain = false;
  let soft = false;
  const voices = new Map();   // midi -> voice
  const holding = new Set();  // 手指按住的键

  const PARTIALS = [
    { h: 1.000, a: 1.00, d: 1.00 },
    { h: 2.002, a: 0.44, d: 0.62 },
    { h: 3.004, a: 0.22, d: 0.42 },
    { h: 4.008, a: 0.12, d: 0.30 },
    { h: 5.014, a: 0.07, d: 0.22 },
    { h: 6.022, a: 0.04, d: 0.16 },
    { h: 8.04,  a: 0.02, d: 0.10 },
  ];

  function freq(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }

  function makeIR(seconds, decay) {
    const rate = ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const buf = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay);
      }
      // 少量早期反射，让空间感更像琴房
      [0.011, 0.019, 0.031, 0.047, 0.062].forEach((tt, k) => {
        const idx = Math.floor(tt * rate) + (ch ? 37 : 0);
        if (idx < len) d[idx] += (k % 2 ? -1 : 1) * (0.42 - k * 0.06);
      });
    }
    return buf;
  }

  function init() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }
    const AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();

    master = ctx.createGain();
    master.gain.value = volume;

    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 26;
    comp.ratio.value = 3.2;
    comp.attack.value = 0.004;
    comp.release.value = 0.30;

    conv = ctx.createConvolver();
    conv.buffer = makeIR(2.6, 2.4);

    dry = ctx.createGain(); dry.gain.value = 0.82;
    wet = ctx.createGain(); wet.gain.value = 0.26;

    dry.connect(master);
    wet.connect(conv); conv.connect(master);
    master.connect(comp);
    comp.connect(ctx.destination);
    ready = true;
    return ctx;
  }

  function connectVoice(node) {
    node.connect(dry);
    node.connect(wet);
  }

  function stopVoice(v, when, fast) {
    const t = when === undefined ? ctx.currentTime : when;
    const rel = fast ? 0.02 : 0.16;
    try {
      v.gain.gain.cancelScheduledValues(t);
      v.gain.gain.setTargetAtTime(0.0001, t, rel / 3);
    } catch (e) { /* noop */ }
    v.oscs.forEach((o) => { try { o.stop(t + rel + 0.06); } catch (e) {} });
    v.dead = true;
  }

  function noteOn(midi, vel) {
    if (!init()) return;
    vel = Math.max(0.05, Math.min(1, vel === undefined ? 0.8 : vel));
    if (soft) vel *= 0.65;
    const t = ctx.currentTime;
    const old = voices.get(midi);
    if (old && !old.dead) stopVoice(old, t, true);

    const f = freq(midi);
    const i = midi - 21;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(vel * 0.28, t + 0.005);

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    const bright = soft ? 8 : 13;
    lp.frequency.setValueAtTime(Math.min(17000, f * bright + 900), t);
    lp.frequency.exponentialRampToValueAtTime(Math.max(320, f * 3.2), t + 1.4);
    lp.Q.value = 0.55;

    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (pan) pan.pan.value = Math.max(-0.62, Math.min(0.62, ((midi - 62) / 46) * 0.6));

    gain.connect(lp);
    if (pan) { lp.connect(pan); connectVoice(pan); } else connectVoice(lp);

    // 整体衰减时长：低音绵长、高音短促
    const decay = 13.5 * Math.pow(0.5, i / 26) + 0.5;
    const oscs = [];
    PARTIALS.forEach((p, k) => {
      const hf = f * p.h;
      if (hf > 17500) return;
      const o = ctx.createOscillator();
      o.type = k === 0 ? 'triangle' : 'sine';
      o.frequency.value = hf;
      o.detune.value = (Math.random() - 0.5) * 3.5;
      const pg = ctx.createGain();
      const amp = p.a * (k === 0 ? 0.85 : 1) * (0.55 + vel * 0.6);
      pg.gain.setValueAtTime(0.0001, t);
      pg.gain.linearRampToValueAtTime(amp, t + 0.006 + k * 0.002);
      pg.gain.exponentialRampToValueAtTime(0.0002, t + Math.max(0.22, decay * p.d));
      o.connect(pg); pg.connect(gain);
      o.start(t);
      o.stop(t + decay + 0.4);
      oscs.push(o);
    });

    // 击弦瞬态噪声
    const nLen = 0.055;
    const nb = ctx.createBuffer(1, Math.max(64, Math.floor(ctx.sampleRate * nLen)), ctx.sampleRate);
    const nd = nb.getChannelData(0);
    for (let s = 0; s < nd.length; s++) {
      nd[s] = (Math.random() * 2 - 1) * Math.pow(1 - s / nd.length, 3.2);
    }
    const ns = ctx.createBufferSource();
    ns.buffer = nb;
    const nf = ctx.createBiquadFilter();
    nf.type = 'bandpass';
    nf.frequency.value = Math.min(9000, f * 5.5);
    nf.Q.value = 0.9;
    const ng = ctx.createGain();
    ng.gain.value = 0.045 * vel * (1 + (108 - midi) / 160);
    ns.connect(nf); nf.connect(ng); ng.connect(gain);
    ns.start(t);

    const voice = { midi, gain, oscs, start: t, decay, dead: false };
    voices.set(midi, voice);
    holding.add(midi);

    // 声部限制
    if (voices.size > 26) {
      let oldest = null;
      voices.forEach((v) => {
        if (v.dead) return;
        if (!oldest || v.start < oldest.start) oldest = v;
      });
      if (oldest && oldest.midi !== midi) { stopVoice(oldest); voices.delete(oldest.midi); }
    }
    return voice;
  }

  function noteOff(midi) {
    holding.delete(midi);
    if (!ctx) return;
    const v = voices.get(midi);
    if (!v || v.dead) return;
    if (sustain) return;               // 延音踏板按下：让它继续自然衰减
    stopVoice(v);
    voices.delete(midi);
  }

  function setSustain(on) {
    sustain = !!on;
    if (!ctx) return;
    if (!sustain) {
      // 抬起踏板：所有未按住的音收束
      voices.forEach((v, midi) => {
        if (!holding.has(midi) && !v.dead) { stopVoice(v); voices.delete(midi); }
      });
    }
  }

  function setSoft(on) { soft = !!on; }

  function panic() {
    if (!ctx) return;
    voices.forEach((v) => stopVoice(v, ctx.currentTime, true));
    voices.clear();
    holding.clear();
  }

  function setVolume(v) {
    volume = Math.max(0, Math.min(1.4, v));
    if (master) master.gain.setTargetAtTime(volume, ctx.currentTime, 0.02);
  }

  function setReverb(v) {
    if (!wet) return;
    wet.gain.setTargetAtTime(Math.max(0, Math.min(0.85, v)), ctx.currentTime, 0.03);
    dry.gain.setTargetAtTime(0.95 - Math.min(0.5, v * 0.6), ctx.currentTime, 0.03);
  }

  global.PianoAudio = {
    init, noteOn, noteOff, setSustain, setSoft, setVolume, setReverb, panic, freq,
    get isReady() { return ready; },
    get context() { return ctx; },
    get activeVoices() { return voices.size; },
  };
})(typeof window !== 'undefined' ? window : globalThis);
