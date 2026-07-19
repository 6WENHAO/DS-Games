/* audio.js — WebAudio 全程序化音频:引擎变调、胎擦、碰撞、脚步、喇叭、
   三个合成器电台(锁定节拍调度)、海浪/风/城市底噪、海鸥 */
window.G = window.G || {};
(function () {
  const U = G.U;
  const A = { ready: false, muted: false };
  G.AUDIO = A;

  let ctx, master, comp, noiseBuf;

  A.init = function () {
    if (A.ready) return;
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    A.ctx = ctx;
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 22; comp.ratio.value = 8;
    master = ctx.createGain(); master.gain.value = 0.85;
    master.connect(comp); comp.connect(ctx.destination);
    /* 噪声源 */
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    buildEngine(); buildSkid(); buildAmbience(); buildRadio();
    A.ready = true;
  };
  A.resume = function () { if (ctx && ctx.state === 'suspended') ctx.resume(); };

  function noiseSrc() {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf; s.loop = true;
    return s;
  }
  const now = () => ctx.currentTime;

  /* ---------------- 引擎 ---------------- */
  let eng = null;
  function buildEngine() {
    eng = {};
    eng.gain = ctx.createGain(); eng.gain.gain.value = 0;
    eng.lp = ctx.createBiquadFilter(); eng.lp.type = 'lowpass'; eng.lp.frequency.value = 800; eng.lp.Q.value = 1.2;
    eng.o1 = ctx.createOscillator(); eng.o1.type = 'sawtooth'; eng.o1.frequency.value = 50;
    eng.o2 = ctx.createOscillator(); eng.o2.type = 'square'; eng.o2.frequency.value = 25;
    eng.g1 = ctx.createGain(); eng.g1.gain.value = 0.5;
    eng.g2 = ctx.createGain(); eng.g2.gain.value = 0.34;
    eng.exh = noiseSrc();
    eng.exhF = ctx.createBiquadFilter(); eng.exhF.type = 'bandpass'; eng.exhF.frequency.value = 150; eng.exhF.Q.value = 0.8;
    eng.exhG = ctx.createGain(); eng.exhG.gain.value = 0;
    eng.o1.connect(eng.g1).connect(eng.lp);
    eng.o2.connect(eng.g2).connect(eng.lp);
    eng.exh.connect(eng.exhF).connect(eng.exhG).connect(eng.lp);
    eng.lp.connect(eng.gain).connect(master);
    eng.o1.start(); eng.o2.start(); eng.exh.start();
  }
  A.engine = function (on, rpm01, load01) {
    if (!A.ready) return;
    const t = now();
    const f = 42 + rpm01 * 178;
    eng.o1.frequency.setTargetAtTime(f, t, 0.03);
    eng.o2.frequency.setTargetAtTime(f * 0.502, t, 0.03);
    eng.lp.frequency.setTargetAtTime(340 + rpm01 * 2400 + load01 * 500, t, 0.05);
    eng.gain.gain.setTargetAtTime(on ? 0.10 + load01 * 0.13 + rpm01 * 0.05 : 0, t, on ? 0.06 : 0.2);
    eng.exhG.gain.setTargetAtTime(on ? 0.25 + load01 * 0.5 : 0, t, 0.08);
    eng.exhF.frequency.setTargetAtTime(90 + rpm01 * 320, t, 0.05);
  };

  /* ---------------- 胎擦 ---------------- */
  let skid = null;
  function buildSkid() {
    skid = {};
    skid.src = noiseSrc();
    skid.bp = ctx.createBiquadFilter(); skid.bp.type = 'bandpass'; skid.bp.frequency.value = 950; skid.bp.Q.value = 5;
    skid.g = ctx.createGain(); skid.g.gain.value = 0;
    skid.src.connect(skid.bp).connect(skid.g).connect(master);
    skid.src.start();
  }
  A.skid = function (level) {
    if (!A.ready) return;
    const t = now();
    skid.g.gain.setTargetAtTime(U.clamp(level, 0, 1) * 0.22, t, level > 0.01 ? 0.04 : 0.12);
    skid.bp.frequency.setTargetAtTime(800 + level * 500, t, 0.06);
  };

  /* ---------------- 一次性音效 ---------------- */
  A.crash = function (k) {
    if (!A.ready) return;
    k = U.clamp(k, 0.1, 1);
    const t = now();
    const n = noiseSrc();
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(2600 * k + 300, t); f.frequency.exponentialRampToValueAtTime(120, t + 0.4);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.55 * k, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    n.connect(f).connect(g).connect(master);
    n.start(t); n.stop(t + 0.5);
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(34, t + 0.28);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.5 * k, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(og).connect(master);
    o.start(t); o.stop(t + 0.35);
  };
  A.step = function (run) {
    if (!A.ready) return;
    const t = now();
    const n = noiseSrc();
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 300 + Math.random() * 200 + run * 260; f.Q.value = 1.4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.06 + run * 0.09, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    n.connect(f).connect(g).connect(master);
    n.start(t); n.stop(t + 0.12);
  };
  let hornOsc = null;
  A.horn = function (on) {
    if (!A.ready) return;
    if (on && !hornOsc) {
      hornOsc = {};
      hornOsc.g = ctx.createGain(); hornOsc.g.gain.value = 0.0;
      hornOsc.g.gain.setTargetAtTime(0.16, now(), 0.01);
      hornOsc.o1 = ctx.createOscillator(); hornOsc.o1.type = 'square'; hornOsc.o1.frequency.value = 425;
      hornOsc.o2 = ctx.createOscillator(); hornOsc.o2.type = 'square'; hornOsc.o2.frequency.value = 340;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1600;
      hornOsc.o1.connect(f); hornOsc.o2.connect(f);
      f.connect(hornOsc.g).connect(master);
      hornOsc.o1.start(); hornOsc.o2.start();
    } else if (!on && hornOsc) {
      const h = hornOsc; hornOsc = null;
      h.g.gain.setTargetAtTime(0, now(), 0.03);
      setTimeout(() => { try { h.o1.stop(); h.o2.stop(); } catch (e) { } }, 220);
    }
  };
  A.gull = function () {
    if (!A.ready) return;
    const t = now();
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(1250, t);
    o.frequency.exponentialRampToValueAtTime(720, t + 0.28);
    o.frequency.exponentialRampToValueAtTime(980, t + 0.42);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0, t);
    g.gain.linearRampToValueAtTime(0.05, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1500; f.Q.value = 2;
    o.connect(f).connect(g).connect(master);
    o.start(t); o.stop(t + 0.55);
  };
  A.blip = function (freq) {
    if (!A.ready) return;
    const t = now();
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq || 880;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.09, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    o.connect(g).connect(master);
    o.start(t); o.stop(t + 0.2);
  };
  A.cash = function () { A.blip(660); setTimeout(() => A.blip(880), 90); setTimeout(() => A.blip(1320), 180); };

  /* ---------------- 环境 ---------------- */
  let amb = null;
  function buildAmbience() {
    amb = {};
    amb.city = noiseSrc();
    amb.cityF = ctx.createBiquadFilter(); amb.cityF.type = 'lowpass'; amb.cityF.frequency.value = 240;
    amb.cityG = ctx.createGain(); amb.cityG.gain.value = 0.028;
    amb.city.connect(amb.cityF).connect(amb.cityG).connect(master);
    amb.city.start();
    amb.wave = noiseSrc();
    amb.waveF = ctx.createBiquadFilter(); amb.waveF.type = 'lowpass'; amb.waveF.frequency.value = 420;
    amb.waveG = ctx.createGain(); amb.waveG.gain.value = 0;
    amb.wave.connect(amb.waveF).connect(amb.waveG).connect(master);
    amb.wave.start();
    amb.waveLFO = ctx.createOscillator(); amb.waveLFO.frequency.value = 0.14;
    amb.waveLFOG = ctx.createGain(); amb.waveLFOG.gain.value = 130;
    amb.waveLFO.connect(amb.waveLFOG).connect(amb.waveF.frequency);
    amb.waveLFO.start();
    amb.wind = noiseSrc();
    amb.windF = ctx.createBiquadFilter(); amb.windF.type = 'bandpass'; amb.windF.frequency.value = 700; amb.windF.Q.value = 0.5;
    amb.windG = ctx.createGain(); amb.windG.gain.value = 0;
    amb.wind.connect(amb.windF).connect(amb.windG).connect(master);
    amb.wind.start();
  }
  A.ambience = function (shore01, speed01, night) {
    if (!A.ready) return;
    const t = now();
    amb.waveG.gain.setTargetAtTime(shore01 * 0.10, t, 0.4);
    amb.windG.gain.setTargetAtTime(speed01 * 0.06, t, 0.15);
    amb.cityG.gain.setTargetAtTime(0.02 + (night ? -0.006 : 0.012), t, 1);
  };

  /* ---------------- 电台 ---------------- */
  const NOTE = n => 440 * Math.pow(2, (n - 69) / 12);
  let radio = null;
  A.stations = [
    { name: 'VAPOR 88.8 · 合成器之夜', bpm: 100 },
    { name: '海雾 FM · Lofi 慢板', bpm: 74 },
    { name: 'DOCK 105 · 码头电子', bpm: 128 }
  ];
  A.station = -1;
  function buildRadio() {
    radio = { g: ctx.createGain(), step: 0, nextT: 0 };
    radio.g.gain.value = 0;
    radio.lp = ctx.createBiquadFilter(); radio.lp.type = 'lowpass'; radio.lp.frequency.value = 3800;
    radio.g.connect(radio.lp).connect(master);
  }
  A.setStation = function (i) {
    A.station = i;
    if (!A.ready) return;
    radio.step = 0; radio.nextT = now() + 0.08;
    radio.g.gain.setTargetAtTime(i < 0 ? 0 : 0.16, now(), 0.2);
  };
  A.radioGain = function (inCar) {
    if (!A.ready) return;
    radio.g.gain.setTargetAtTime((A.station < 0 || !inCar) ? 0 : 0.16, now(), 0.3);
  };
  function tone(t, freq, dur, type, vol, dest, slide) {
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(dest || radio.g);
    o.start(t); o.stop(t + dur + 0.03);
  }
  function kick(t, vol) {
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.1);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    o.connect(g).connect(radio.g);
    o.start(t); o.stop(t + 0.2);
  }
  function hat(t, vol, open) {
    const n = noiseSrc();
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 6800;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + (open ? 0.2 : 0.05));
    n.connect(f).connect(g).connect(radio.g);
    n.start(t); n.stop(t + 0.25);
  }
  function snare(t, vol) {
    const n = noiseSrc();
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1900; f.Q.value = 0.9;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    n.connect(f).connect(g).connect(radio.g);
    n.start(t); n.stop(t + 0.18);
  }
  /* 和弦进行(小调风) */
  const PROG = [[57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 55, 59]];
  const ARP = [0, 1, 2, 1];
  function schedule() {
    if (A.station < 0) return;
    const st = A.stations[A.station];
    const spb = 60 / st.bpm / 4;             // 16 分音符
    while (radio.nextT < now() + 0.14) {
      const t = radio.nextT, s = radio.step;
      const bar = Math.floor(s / 16) % 4, beat = s % 16;
      const chord = PROG[bar];
      if (A.station === 0) {                  /* Synthwave */
        if (beat % 4 === 0) kick(t, 0.5);
        if (beat % 8 === 4) snare(t, 0.16);
        hat(t, beat % 2 ? 0.05 : 0.02);
        const bass = NOTE(chord[0] - 24);
        if (beat % 2 === 0) tone(t, bass, spb * 1.8, 'sawtooth', 0.16);
        const an = chord[ARP[beat % 4]] + (beat % 8 >= 4 ? 12 : 0);
        tone(t, NOTE(an), spb * 0.9, 'square', 0.05);
        if (beat === 0) chord.forEach(n => tone(t, NOTE(n), spb * 15, 'sawtooth', 0.035));
      } else if (A.station === 1) {           /* Lofi */
        if (beat === 0 || beat === 10) kick(t, 0.4);
        if (beat === 4 || beat === 12) snare(t, 0.10);
        if (beat % 2 === 0) hat(t, 0.018);
        if (beat === 0 || beat === 8) chord.forEach((n, k) => tone(t + k * 0.02, NOTE(n - 12), spb * 7, 'triangle', 0.08));
        if (beat === 6) tone(t, NOTE(chord[2]), spb * 3, 'triangle', 0.06);
        if (Math.random() < 0.06) tone(t, 2200 + Math.random() * 1500, 0.02, 'square', 0.012);
      } else {                                /* Techno */
        if (beat % 4 === 0) kick(t, 0.6);
        if (beat % 4 === 2) hat(t, 0.07, true);
        else hat(t, 0.028);
        if (beat % 8 === 4) snare(t, 0.12);
        const bn = chord[0] - 24 + (beat % 3 === 2 ? 12 : 0);
        tone(t, NOTE(bn), spb * 0.85, 'sawtooth', 0.13, radio.g, NOTE(bn) * (beat % 4 === 3 ? 1.6 : 1));
        if (beat % 16 === 14) tone(t, NOTE(chord[1] + 12), spb * 1.6, 'square', 0.04);
      }
      radio.nextT += spb;
      radio.step++;
    }
  }
  A.update = function (dt) {
    if (!A.ready || !ctx || ctx.state !== 'running') return;
    schedule();
  };
})();
