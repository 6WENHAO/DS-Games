/* ============================================================
 * BLOCKROOMS - audio.js
 * 全程序化 WebAudio 音效合成引擎
 * ============================================================ */
(function () {
  'use strict';
  const S = {};
  window.BRAudio = S;

  let ctx = null;
  let master, sfxBus, ambBus, uiBus, musBus;
  let noiseBuf = null;
  S.volumes = { master: 0.8, sfx: 1.0, amb: 0.8, music: 0.6 };

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain(); master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.connect(master);
    ambBus = ctx.createGain(); ambBus.connect(master);
    uiBus = ctx.createGain(); uiBus.connect(master);
    musBus = ctx.createGain(); musBus.connect(master);
    applyVolumes();
    // 白噪声缓冲
    const len = ctx.sampleRate * 2;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }
  S.init = ensure;
  function applyVolumes() {
    if (!ctx) return;
    master.gain.value = S.volumes.master;
    sfxBus.gain.value = S.volumes.sfx;
    ambBus.gain.value = S.volumes.amb * 0.9;
    uiBus.gain.value = S.volumes.sfx;
    musBus.gain.value = S.volumes.music;
  }
  S.applyVolumes = applyVolumes;

  /* ---------- 基础合成工具 ---------- */
  function env(node, t0, a, peak, d, sustain, r, end) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + a);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, sustain), t0 + a + d);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d + r);
    node.connect(g);
    return g;
  }
  function osc(type, freq, t0, dur) {
    const o = ctx.createOscillator();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    o.start(t0); o.stop(t0 + dur + 0.05);
    return o;
  }
  function noise(t0, dur) {
    const n = ctx.createBufferSource();
    n.buffer = noiseBuf; n.loop = true;
    n.playbackRate.value = 0.9 + Math.random() * 0.2;
    n.start(t0); n.stop(t0 + dur + 0.05);
    return n;
  }
  function filt(type, freq, q) {
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q || 1;
    return f;
  }
  // 位置声像：根据相对摄像机位置计算音量与声像
  let listener = { x: 0, y: 0, z: 0, fx: 0, fz: -1 };
  S.setListener = function (x, y, z, fx, fz) { listener = { x, y, z, fx, fz }; };
  function spatial(x, y, z, range) {
    const dx = x - listener.x, dy = y - listener.y, dz = z - listener.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const vol = Math.max(0, 1 - dist / (range || 20));
    // 右向量 = forward × up
    const rx = -listener.fz, rz = listener.fx;
    const pan = dist < 0.01 ? 0 : Math.max(-1, Math.min(1, (dx * rx + dz * rz) / dist));
    return { vol: vol * vol, pan };
  }
  function panNode(pan) {
    if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; return p; }
    const g = ctx.createGain(); return g;
  }
  function out(node, bus, vol, pan) {
    const g = ctx.createGain(); g.gain.value = vol;
    const p = panNode(pan || 0);
    node.connect(g); g.connect(p); p.connect(bus);
    return g;
  }

  /* ---------- UI ---------- */
  S.uiClick = function () {
    if (!ensure()) return;
    const t = ctx.currentTime;
    const o = osc('square', 620, t, 0.08);
    out(env(o, t, 0.002, 0.16, 0.03, 0.02, 0.05), uiBus, 1);
    const o2 = osc('square', 930, t + 0.03, 0.06);
    out(env(o2, t + 0.03, 0.002, 0.1, 0.02, 0.02, 0.04), uiBus, 1);
  };
  S.uiHover = function () {
    if (!ensure()) return;
    const t = ctx.currentTime;
    const o = osc('sine', 480, t, 0.05);
    out(env(o, t, 0.004, 0.06, 0.02, 0.01, 0.03), uiBus, 1);
  };
  S.uiOpen = function () {
    if (!ensure()) return;
    const t = ctx.currentTime;
    [340, 452, 566].forEach((f, i) => {
      const o = osc('triangle', f, t + i * 0.04, 0.12);
      out(env(o, t + i * 0.04, 0.004, 0.12, 0.06, 0.03, 0.08), uiBus, 1);
    });
  };
  S.uiClose = function () {
    if (!ensure()) return;
    const t = ctx.currentTime;
    [566, 452, 340].forEach((f, i) => {
      const o = osc('triangle', f, t + i * 0.03, 0.1);
      out(env(o, t + i * 0.03, 0.004, 0.1, 0.05, 0.02, 0.06), uiBus, 1);
    });
  };

  /* ---------- 脚步 ---------- */
  S.footstep = function (surface, run) {
    if (!ensure()) return;
    const t = ctx.currentTime;
    const vol = run ? 0.75 : 0.5;
    if (surface === 'carpet') {
      const n = noise(t, 0.12);
      const f = filt('bandpass', 300 + Math.random() * 160, 0.8);
      n.connect(f);
      out(env(f, t, 0.005, vol * 0.5, 0.07, 0.02, 0.05), sfxBus, 1);
      const th = osc('sine', 70 + Math.random() * 20, t, 0.08);
      out(env(th, t, 0.004, vol * 0.35, 0.05, 0.02, 0.04), sfxBus, 1);
    } else {
      const n = noise(t, 0.1);
      const f = filt('bandpass', 900 + Math.random() * 500, 1.2);
      n.connect(f);
      out(env(f, t, 0.002, vol * 0.4, 0.04, 0.02, 0.05), sfxBus, 1);
      const th = osc('sine', 95 + Math.random() * 25, t, 0.09);
      out(env(th, t, 0.002, vol * 0.5, 0.05, 0.02, 0.05), sfxBus, 1);
      if (surface === 'wood') {
        const o = osc('triangle', 180 + Math.random() * 40, t, 0.08);
        out(env(o, t, 0.002, vol * 0.3, 0.05, 0.02, 0.04), sfxBus, 1);
      }
    }
  };

  /* ---------- 挖掘 / 放置 ---------- */
  function digTone(mat) {
    switch (mat) {
      case 'wood': return { f: 240, type: 'triangle', nf: 800 };
      case 'stone': return { f: 150, type: 'square', nf: 1800 };
      case 'cloth': return { f: 190, type: 'sine', nf: 500 };
      case 'glass': return { f: 700, type: 'triangle', nf: 3200 };
      default: return { f: 200, type: 'triangle', nf: 900 };
    }
  }
  S.dig = function (mat) { // 挖掘中的敲击声
    if (!ensure()) return;
    const t = ctx.currentTime, p = digTone(mat);
    const o = osc(p.type, p.f * (0.9 + Math.random() * 0.25), t, 0.08);
    out(env(o, t, 0.002, 0.22, 0.04, 0.02, 0.04), sfxBus, 1);
    const n = noise(t, 0.06);
    const f = filt('bandpass', p.nf, 1.5); n.connect(f);
    out(env(f, t, 0.002, 0.14, 0.03, 0.01, 0.03), sfxBus, 1);
  };
  S.breakBlock = function (mat) {
    if (!ensure()) return;
    const t = ctx.currentTime, p = digTone(mat);
    for (let i = 0; i < 3; i++) {
      const tt = t + i * 0.035;
      const o = osc(p.type, p.f * (1.15 - i * 0.18) * (0.95 + Math.random() * 0.1), tt, 0.1);
      out(env(o, tt, 0.002, 0.26, 0.06, 0.02, 0.06), sfxBus, 1);
    }
    const n = noise(t, 0.22);
    const f = filt('bandpass', p.nf * 0.8, 0.9); n.connect(f);
    out(env(f, t, 0.003, 0.3, 0.14, 0.03, 0.1), sfxBus, 1);
  };
  S.place = function (mat) {
    if (!ensure()) return;
    const t = ctx.currentTime, p = digTone(mat);
    const o = osc(p.type, p.f * 0.8, t, 0.1);
    out(env(o, t, 0.002, 0.3, 0.06, 0.03, 0.06), sfxBus, 1);
    const th = osc('sine', 85, t, 0.08);
    out(env(th, t, 0.002, 0.28, 0.05, 0.02, 0.05), sfxBus, 1);
  };
  S.swing = function () {
    if (!ensure()) return;
    const t = ctx.currentTime;
    const n = noise(t, 0.16);
    const f = filt('bandpass', 600, 1.4);
    f.frequency.setValueAtTime(400, t);
    f.frequency.exponentialRampToValueAtTime(1400, t + 0.12);
    n.connect(f);
    out(env(f, t, 0.01, 0.08, 0.08, 0.02, 0.05), sfxBus, 1);
  };

  /* ---------- 物品 ---------- */
  S.pop = function () {
    if (!ensure()) return;
    const t = ctx.currentTime;
    const o = osc('sine', 420, t, 0.14);
    o.frequency.exponentialRampToValueAtTime(880, t + 0.09);
    out(env(o, t, 0.003, 0.22, 0.08, 0.02, 0.05), sfxBus, 1);
  };
  S.drink = function () {
    if (!ensure()) return;
    const t = ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const tt = t + i * 0.22;
      const o = osc('sine', 300 - i * 30, tt, 0.15);
      o.frequency.exponentialRampToValueAtTime(140, tt + 0.12);
      out(env(o, tt, 0.01, 0.2, 0.09, 0.03, 0.06), sfxBus, 1);
      const n = noise(tt, 0.1);
      const f = filt('lowpass', 900, 1); n.connect(f);
      out(env(f, tt, 0.01, 0.1, 0.06, 0.02, 0.05), sfxBus, 1);
    }
    const ah = osc('sine', 250, t + 0.72, 0.2);
    ah.frequency.exponentialRampToValueAtTime(180, t + 0.9);
    out(env(ah, t + 0.72, 0.03, 0.12, 0.12, 0.03, 0.08), sfxBus, 1);
  };
  S.craft = function () {
    if (!ensure()) return;
    const t = ctx.currentTime;
    [150, 220, 180].forEach((f, i) => {
      const tt = t + i * 0.09;
      const o = osc('triangle', f, tt, 0.1);
      out(env(o, tt, 0.002, 0.25, 0.06, 0.02, 0.05), sfxBus, 1);
    });
    const n = noise(t + 0.05, 0.15);
    const f = filt('bandpass', 1100, 1.4); n.connect(f);
    out(env(f, t + 0.05, 0.005, 0.1, 0.1, 0.02, 0.07), sfxBus, 1);
  };
  S.equip = function () {
    if (!ensure()) return;
    const t = ctx.currentTime;
    const n = noise(t, 0.08);
    const f = filt('bandpass', 2200, 2); n.connect(f);
    out(env(f, t, 0.002, 0.1, 0.04, 0.01, 0.04), sfxBus, 1);
  };
  S.bandage = function () {
    if (!ensure()) return;
    const t = ctx.currentTime;
    for (let i = 0; i < 2; i++) {
      const n = noise(t + i * 0.25, 0.2);
      const f = filt('bandpass', 1500, 1); n.connect(f);
      out(env(f, t + i * 0.25, 0.02, 0.12, 0.14, 0.03, 0.08), sfxBus, 1);
    }
  };

  /* ---------- 玩家 ---------- */
  S.hurt = function () {
    if (!ensure()) return;
    const t = ctx.currentTime;
    const o = osc('square', 260, t, 0.2);
    o.frequency.exponentialRampToValueAtTime(120, t + 0.16);
    const f = filt('lowpass', 900, 1); o.connect(f);
    out(env(f, t, 0.003, 0.35, 0.12, 0.04, 0.08), sfxBus, 1);
    const n = noise(t, 0.1);
    const nf = filt('bandpass', 500, 1); n.connect(nf);
    out(env(nf, t, 0.003, 0.15, 0.07, 0.02, 0.05), sfxBus, 1);
  };
  S.death = function () {
    if (!ensure()) return;
    const t = ctx.currentTime;
    const o = osc('sawtooth', 200, t, 1.4);
    o.frequency.exponentialRampToValueAtTime(45, t + 1.2);
    const f = filt('lowpass', 700, 1); o.connect(f);
    out(env(f, t, 0.01, 0.3, 0.9, 0.05, 0.4), sfxBus, 1);
    const o2 = osc('sine', 100, t, 1.2);
    o2.frequency.exponentialRampToValueAtTime(35, t + 1.0);
    out(env(o2, t, 0.01, 0.3, 0.8, 0.04, 0.3), sfxBus, 1);
  };
  S.heartbeat = function (intensity) {
    if (!ensure()) return;
    const t = ctx.currentTime;
    [0, 0.16].forEach((d, i) => {
      const o = osc('sine', i === 0 ? 55 : 48, t + d, 0.12);
      out(env(o, t + d, 0.004, 0.4 * intensity * (i === 0 ? 1 : 0.7), 0.07, 0.03, 0.06), sfxBus, 1);
    });
  };
  S.jump = function () {
    if (!ensure()) return;
    const t = ctx.currentTime;
    const n = noise(t, 0.07);
    const f = filt('bandpass', 500, 1); n.connect(f);
    out(env(f, t, 0.003, 0.1, 0.04, 0.01, 0.03), sfxBus, 1);
  };
  S.land = function (hard) {
    if (!ensure()) return;
    const t = ctx.currentTime;
    const o = osc('sine', 80, t, 0.1);
    out(env(o, t, 0.002, hard ? 0.4 : 0.2, 0.06, 0.02, 0.05), sfxBus, 1);
    const n = noise(t, 0.08);
    const f = filt('lowpass', 500, 1); n.connect(f);
    out(env(f, t, 0.002, hard ? 0.2 : 0.1, 0.05, 0.02, 0.04), sfxBus, 1);
  };

  /* ---------- 怪物（带位置） ---------- */
  S.houndGrowl = function (x, y, z) {
    if (!ensure()) return;
    const sp = spatial(x, y, z, 18); if (sp.vol < 0.01) return;
    const t = ctx.currentTime;
    const o = osc('sawtooth', 65 + Math.random() * 15, t, 0.8);
    const lfo = osc('sine', 22, t, 0.8);
    const lg = ctx.createGain(); lg.gain.value = 20;
    lfo.connect(lg); lg.connect(o.frequency);
    const f = filt('lowpass', 350, 2); o.connect(f);
    out(env(f, t, 0.08, 0.5 * sp.vol, 0.5, 0.1, 0.25), sfxBus, 1, sp.pan);
  };
  S.houndBark = function (x, y, z) {
    if (!ensure()) return;
    const sp = spatial(x, y, z, 24); if (sp.vol < 0.01) return;
    const t = ctx.currentTime;
    for (let i = 0; i < 2; i++) {
      const tt = t + i * 0.18;
      const o = osc('sawtooth', 180, tt, 0.14);
      o.frequency.exponentialRampToValueAtTime(90, tt + 0.12);
      const f = filt('bandpass', 600, 1.5); o.connect(f);
      out(env(f, tt, 0.005, 0.55 * sp.vol, 0.08, 0.03, 0.07), sfxBus, 1, sp.pan);
    }
  };
  S.houndBite = function () {
    if (!ensure()) return;
    const t = ctx.currentTime;
    const n = noise(t, 0.1);
    const f = filt('bandpass', 1800, 2); n.connect(f);
    out(env(f, t, 0.002, 0.3, 0.05, 0.02, 0.04), sfxBus, 1);
    const o = osc('square', 140, t + 0.02, 0.1);
    o.frequency.exponentialRampToValueAtTime(70, t + 0.1);
    out(env(o, t + 0.02, 0.002, 0.3, 0.06, 0.02, 0.05), sfxBus, 1);
  };
  S.houndDie = function (x, y, z) {
    if (!ensure()) return;
    const sp = spatial(x, y, z, 24);
    const t = ctx.currentTime;
    const o = osc('sawtooth', 200, t, 0.7);
    o.frequency.exponentialRampToValueAtTime(50, t + 0.6);
    const f = filt('lowpass', 800, 1); o.connect(f);
    out(env(f, t, 0.01, 0.4 * Math.max(0.3, sp.vol), 0.45, 0.06, 0.2), sfxBus, 1, sp.pan);
  };
  S.smilerWhisper = function (x, y, z, vol) {
    if (!ensure()) return;
    const sp = spatial(x, y, z, 22);
    const v = (vol !== undefined ? vol : 1) * sp.vol;
    if (v < 0.02) return;
    const t = ctx.currentTime;
    const n = noise(t, 0.9);
    const f = filt('bandpass', 2400 + Math.random() * 1400, 6); n.connect(f);
    const f2 = filt('bandpass', 3200, 8); f.connect(f2);
    out(env(f2, t, 0.2, 0.35 * v, 0.5, 0.08, 0.35), sfxBus, 1, sp.pan);
  };
  S.smilerSting = function () {
    if (!ensure()) return;
    const t = ctx.currentTime;
    [660, 699, 745, 932].forEach(fq => {
      const o = osc('sawtooth', fq, t, 1.1);
      const f = filt('highpass', 500, 1); o.connect(f);
      out(env(f, t, 0.25, 0.06, 0.6, 0.02, 0.3), sfxBus, 1);
    });
  };
  S.smilerScream = function () {
    if (!ensure()) return;
    const t = ctx.currentTime;
    const o = osc('sawtooth', 900, t, 0.9);
    o.frequency.setValueAtTime(900, t);
    o.frequency.exponentialRampToValueAtTime(400, t + 0.7);
    const dist = ctx.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) { const x = i / 128 - 1; curve[i] = Math.tanh(x * 6); }
    dist.curve = curve;
    o.connect(dist);
    const f = filt('bandpass', 1400, 1.2); dist.connect(f);
    out(env(f, t, 0.01, 0.5, 0.6, 0.05, 0.25), sfxBus, 1);
    const n = noise(t, 0.8);
    const nf = filt('highpass', 1200, 1); n.connect(nf);
    out(env(nf, t, 0.01, 0.3, 0.55, 0.04, 0.25), sfxBus, 1);
  };
  S.smilerFlee = function (x, y, z) {
    if (!ensure()) return;
    const sp = spatial(x, y, z, 24);
    const t = ctx.currentTime;
    const o = osc('sine', 800, t, 0.4);
    o.frequency.exponentialRampToValueAtTime(2400, t + 0.3);
    out(env(o, t, 0.01, 0.25 * Math.max(0.3, sp.vol), 0.2, 0.03, 0.15), sfxBus, 1, sp.pan);
  };
  S.facelingMurmur = function (x, y, z) {
    if (!ensure()) return;
    const sp = spatial(x, y, z, 12); if (sp.vol < 0.02) return;
    const t = ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const tt = t + i * 0.14;
      const o = osc('sine', 160 + Math.random() * 60, tt, 0.12);
      const f = filt('lowpass', 500, 1); o.connect(f);
      out(env(f, tt, 0.02, 0.12 * sp.vol, 0.07, 0.02, 0.06), sfxBus, 1, sp.pan);
    }
  };
  S.hitFlesh = function () {
    if (!ensure()) return;
    const t = ctx.currentTime;
    const o = osc('sine', 160, t, 0.09);
    o.frequency.exponentialRampToValueAtTime(70, t + 0.07);
    out(env(o, t, 0.002, 0.35, 0.05, 0.02, 0.04), sfxBus, 1);
    const n = noise(t, 0.06);
    const f = filt('bandpass', 700, 1); n.connect(f);
    out(env(f, t, 0.002, 0.2, 0.04, 0.01, 0.03), sfxBus, 1);
  };

  /* ---------- 特殊事件 ---------- */
  S.noclip = function () { // 穿模转场
    if (!ensure()) return;
    const t = ctx.currentTime;
    const n = noise(t, 1.6);
    const f = filt('bandpass', 300, 2);
    f.frequency.setValueAtTime(200, t);
    f.frequency.exponentialRampToValueAtTime(4200, t + 1.2);
    n.connect(f);
    out(env(f, t, 0.05, 0.5, 1.0, 0.06, 0.4), sfxBus, 1);
    const o = osc('sawtooth', 60, t, 1.6);
    o.frequency.exponentialRampToValueAtTime(280, t + 1.3);
    const of = filt('lowpass', 500, 2); o.connect(of);
    out(env(of, t, 0.1, 0.3, 1.0, 0.05, 0.4), sfxBus, 1);
    setTimeout(() => S.impact(), 1500);
  };
  S.impact = function () {
    if (!ensure()) return;
    const t = ctx.currentTime;
    const o = osc('sine', 70, t, 0.5);
    o.frequency.exponentialRampToValueAtTime(30, t + 0.4);
    out(env(o, t, 0.004, 0.7, 0.3, 0.05, 0.2), sfxBus, 1);
    const n = noise(t, 0.3);
    const f = filt('lowpass', 400, 1); n.connect(f);
    out(env(f, t, 0.004, 0.4, 0.2, 0.03, 0.15), sfxBus, 1);
  };
  S.win = function () {
    if (!ensure()) return;
    const t = ctx.currentTime;
    [262, 330, 392, 523].forEach((fq, i) => {
      const o = osc('triangle', fq, t + i * 0.14, 0.5);
      out(env(o, t + i * 0.14, 0.01, 0.22, 0.3, 0.06, 0.25), sfxBus, 1);
    });
    const o = osc('triangle', 784, t + 0.6, 0.8);
    out(env(o, t + 0.6, 0.01, 0.18, 0.5, 0.04, 0.35), sfxBus, 1);
  };
  S.doorOpen = function () {
    if (!ensure()) return;
    const t = ctx.currentTime;
    const o = osc('square', 90, t, 0.5);
    o.frequency.linearRampToValueAtTime(120, t + 0.4);
    const f = filt('lowpass', 400, 2); o.connect(f);
    out(env(f, t, 0.02, 0.25, 0.35, 0.05, 0.2), sfxBus, 1);
    const n = noise(t, 0.4);
    const nf = filt('bandpass', 900, 2); n.connect(nf);
    out(env(nf, t, 0.02, 0.15, 0.3, 0.03, 0.15), sfxBus, 1);
  };
  S.questDone = function () {
    if (!ensure()) return;
    const t = ctx.currentTime;
    [523, 659, 784].forEach((fq, i) => {
      const o = osc('sine', fq, t + i * 0.1, 0.25);
      out(env(o, t + i * 0.1, 0.005, 0.16, 0.15, 0.03, 0.12), uiBus, 1);
    });
  };
  S.glitchNear = function (x, y, z, prox) { // 靠近 noclip 点时的电流声
    if (!ensure()) return;
    const sp = spatial(x, y, z, 22);
    const v = sp.vol * prox;
    if (v < 0.02) return;
    const t = ctx.currentTime;
    const o = osc('square', 100 + Math.random() * 900, t, 0.07);
    const f = filt('bandpass', 1200, 3); o.connect(f);
    out(env(f, t, 0.002, 0.2 * v, 0.04, 0.01, 0.03), sfxBus, 1, sp.pan);
  };
  S.drip = function () {
    if (!ensure()) return;
    const t = ctx.currentTime;
    const pan = Math.random() * 2 - 1;
    const o = osc('sine', 1200 + Math.random() * 600, t, 0.15);
    o.frequency.exponentialRampToValueAtTime(400, t + 0.1);
    out(env(o, t, 0.002, 0.1, 0.09, 0.02, 0.06), ambBus, 1, pan);
  };
  S.whisperHallucination = function () {
    if (!ensure()) return;
    const t = ctx.currentTime;
    const n = noise(t, 1.2);
    const f = filt('bandpass', 900 + Math.random() * 800, 9); n.connect(f);
    const lfo = osc('sine', 7, t, 1.2);
    const lg = ctx.createGain(); lg.gain.value = 350;
    lfo.connect(lg); lg.connect(f.frequency);
    out(env(f, t, 0.3, 0.16, 0.6, 0.04, 0.35), sfxBus, 1, Math.random() * 2 - 1);
  };
  S.flashlightClick = function (on) {
    if (!ensure()) return;
    const t = ctx.currentTime;
    const o = osc('square', on ? 1400 : 1000, t, 0.03);
    out(env(o, t, 0.001, 0.12, 0.015, 0.01, 0.02), sfxBus, 1);
  };

  /* ---------- 循环环境音 ---------- */
  let ambient = null;
  S.stopAmbient = function () {
    if (!ambient) return;
    const t = ctx.currentTime;
    ambient.gains.forEach(g => {
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.linearRampToValueAtTime(0.0001, t + 1.2);
    });
    const nodes = ambient.nodes;
    setTimeout(() => nodes.forEach(n => { try { n.stop(); } catch (e) { } }), 1500);
    if (ambient.interval) clearInterval(ambient.interval);
    ambient = null;
  };
  S.startAmbient = function (level) {
    if (!ensure()) return;
    S.stopAmbient();
    const t = ctx.currentTime;
    const nodes = [], gains = [];
    function loopGain(v) {
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(v, t + 2);
      g.connect(ambBus); gains.push(g);
      return g;
    }
    if (level === 0) {
      // 荧光灯双频嗡鸣
      const o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 100;
      const f1 = filt('lowpass', 300, 4); o1.connect(f1); f1.connect(loopGain(0.045));
      o1.start(t); nodes.push(o1);
      const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = 120;
      o2.connect(loopGain(0.05)); o2.start(t); nodes.push(o2);
      const o3 = ctx.createOscillator(); o3.type = 'sine'; o3.frequency.value = 240;
      o3.connect(loopGain(0.018)); o3.start(t); nodes.push(o3);
      // 空调风噪
      const n = ctx.createBufferSource(); n.buffer = noiseBuf; n.loop = true;
      const nf = filt('lowpass', 260, 0.7); n.connect(nf); nf.connect(loopGain(0.05));
      n.start(t); nodes.push(n);
      // 高频灯管嘶声
      const n2 = ctx.createBufferSource(); n2.buffer = noiseBuf; n2.loop = true;
      const nf2 = filt('bandpass', 6200, 12); n2.connect(nf2); nf2.connect(loopGain(0.008));
      n2.start(t); nodes.push(n2);
      ambient = { nodes, gains, humGain: gains[0] };
    } else {
      // 深层隆隆
      const o1 = ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = 42;
      o1.connect(loopGain(0.09)); o1.start(t); nodes.push(o1);
      const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = 63;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.13;
      const lg = ctx.createGain(); lg.gain.value = 6;
      lfo.connect(lg); lg.connect(o2.frequency); lfo.start(t);
      o2.connect(loopGain(0.05)); o2.start(t); nodes.push(o1, o2, lfo);
      const n = ctx.createBufferSource(); n.buffer = noiseBuf; n.loop = true;
      const nf = filt('lowpass', 150, 0.6); n.connect(nf); nf.connect(loopGain(0.06));
      n.start(t); nodes.push(n);
      // 随机水滴
      const interval = setInterval(() => { if (Math.random() < 0.4) S.drip(); }, 2600);
      ambient = { nodes, gains, interval };
    }
  };
  // 灯光闪烁时嗡鸣抖动
  S.humFlicker = function () {
    if (!ambient || !ambient.humGain || !ctx) return;
    const g = ambient.humGain, t = ctx.currentTime;
    const base = 0.045;
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(base, t);
    for (let i = 0; i < 5; i++) {
      g.gain.linearRampToValueAtTime(base * (Math.random() * 0.5), t + 0.04 + i * 0.05);
      g.gain.linearRampToValueAtTime(base, t + 0.06 + i * 0.05);
    }
  };

  /* ---------- 菜单音乐（幽暗氛围垫） ---------- */
  let music = null;
  S.stopMusic = function () {
    if (!music) return;
    const t = ctx.currentTime;
    music.gain.gain.cancelScheduledValues(t);
    music.gain.gain.setValueAtTime(music.gain.gain.value, t);
    music.gain.gain.linearRampToValueAtTime(0.0001, t + 1.6);
    const nodes = music.nodes;
    setTimeout(() => nodes.forEach(n => { try { n.stop(); } catch (e) { } }), 2000);
    if (music.interval) clearInterval(music.interval);
    music = null;
  };
  S.startMusic = function () {
    if (!ensure() || music) return;
    const t = ctx.currentTime;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.5, t + 3);
    g.connect(musBus);
    const nodes = [];
    [[110, 0.05], [110.7, 0.04], [164.8, 0.03], [220.5, 0.018]].forEach(([fq, v]) => {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = fq;
      const og = ctx.createGain(); og.gain.value = v;
      o.connect(og); og.connect(g); o.start(t); nodes.push(o);
    });
    const n = ctx.createBufferSource(); n.buffer = noiseBuf; n.loop = true;
    const nf = filt('lowpass', 200, 0.5);
    const ng = ctx.createGain(); ng.gain.value = 0.04;
    n.connect(nf); nf.connect(ng); ng.connect(g); n.start(t); nodes.push(n);
    // 偶发钟声
    const interval = setInterval(() => {
      if (!music || Math.random() > 0.4) return;
      const tt = ctx.currentTime;
      const scale = [220, 246.9, 261.6, 329.6, 349.2];
      const fq = scale[Math.floor(Math.random() * scale.length)] * (Math.random() < 0.3 ? 0.5 : 1);
      const o = osc('sine', fq, tt, 4);
      const og = env(o, tt, 0.8, 0.05, 2.2, 0.01, 1.5);
      og.connect(g);
    }, 3500);
    music = { nodes, gain: g, interval };
  };
})();
