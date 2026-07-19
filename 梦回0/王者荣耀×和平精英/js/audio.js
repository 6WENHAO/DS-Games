/* ================================================================
   荣耀精英 — 音频系统
   · Web Audio 全程序化合成音效（枪声/技能/爆炸/UI）
   · speechSynthesis 中文战场语音播报（一血/多杀/空投…）
   · 程序化 BGM（大厅氛围 / 战斗鼓点）
   ================================================================ */
HE.Audio = (function () {
  let ctx = null, master, sfxBus, musicBus, inited = false;
  let vols = { master: 0.8, sfx: 0.9, music: 0.55 };
  let voiceOn = true, muted = false;
  let noiseBuf = null;
  const listener = { x: 0, z: 0 };

  function init() {
    if (inited) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.connect(master);
    applyVols();
    // 2秒白噪声缓存
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    inited = true;
  }
  function resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); }
  function applyVols() {
    if (!ctx) return;
    master.gain.value = muted ? 0 : vols.master;
    sfxBus.gain.value = vols.sfx;
    musicBus.gain.value = vols.music;
  }
  function setVol(k, v) { vols[k] = v; applyVols(); }
  function setMuted(m) { muted = m; applyVols(); if (m) speechSynthesis?.cancel(); }
  function setVoice(v) { voiceOn = v; if (!v) speechSynthesis?.cancel(); }

  /* ---------- 合成工具 ---------- */
  function env(t0, a, d, peak = 1, sustain = 0) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + a);
    g.gain.exponentialRampToValueAtTime(Math.max(sustain, 0.0001), t0 + a + d);
    return g;
  }
  function osc(type, f0, t0, dur, f1) {
    const o = ctx.createOscillator();
    o.type = type; o.frequency.setValueAtTime(f0, t0);
    if (f1 !== undefined) o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t0 + dur);
    o.start(t0); o.stop(t0 + dur + 0.05);
    return o;
  }
  function noise(t0, dur) {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf; s.loop = true;
    s.start(t0); s.stop(t0 + dur + 0.05);
    return s;
  }
  function filt(type, f0, q, t0, dur, f1) {
    const f = ctx.createBiquadFilter();
    f.type = type; f.Q.value = q || 1;
    f.frequency.setValueAtTime(f0, t0);
    if (f1 !== undefined) f.frequency.exponentialRampToValueAtTime(Math.max(f1, 10), t0 + dur);
    return f;
  }
  // 距离衰减：战场定位音量
  function spatialVol(at) {
    if (!at) return 1;
    const dx = at.x - listener.x, dz = at.z - listener.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d > 70) return 0;
    return Math.max(0, 1 - d / 70) ** 1.4;
  }

  /* ---------- 音效库 ---------- */
  const LIB = {
    // —— 枪械 ——
    shot_rifle(t, v) { // M416：干脆的步枪声
      const n = noise(t, 0.09), f = filt('bandpass', 1900, 0.9, t, 0.09, 500);
      const g = env(t, 0.002, 0.085, 0.5 * v);
      n.connect(f).connect(g).connect(sfxBus);
      const sub = osc('triangle', 210, t, 0.05, 70), sg = env(t, 0.001, 0.05, 0.35 * v);
      sub.connect(sg).connect(sfxBus);
    },
    shot_smg(t, v) { // UZI/Vector：轻快
      const n = noise(t, 0.06), f = filt('bandpass', 2500, 1.1, t, 0.06, 800);
      const g = env(t, 0.001, 0.055, 0.34 * v);
      n.connect(f).connect(g).connect(sfxBus);
      const o = osc('square', 320, t, 0.03, 120), og = env(t, 0.001, 0.03, 0.12 * v);
      o.connect(og).connect(sfxBus);
    },
    shot_shotgun(t, v) { // S686：轰
      const n = noise(t, 0.25), f = filt('lowpass', 1100, 0.7, t, 0.25, 180);
      const g = env(t, 0.002, 0.24, 0.75 * v);
      n.connect(f).connect(g).connect(sfxBus);
      const sub = osc('sine', 120, t, 0.18, 42), sg = env(t, 0.002, 0.17, 0.6 * v);
      sub.connect(sg).connect(sfxBus);
    },
    shot_sniper(t, v) { // AWM：重炮裂响
      const n = noise(t, 0.4), f = filt('lowpass', 3200, 0.6, t, 0.4, 140);
      const g = env(t, 0.001, 0.38, 0.85 * v);
      n.connect(f).connect(g).connect(sfxBus);
      const sub = osc('sine', 95, t, 0.3, 30), sg = env(t, 0.002, 0.3, 0.7 * v);
      sub.connect(sg).connect(sfxBus);
    },
    shot_launcher(t, v) { // 榴弹：闷响发射
      const o = osc('sine', 150, t, 0.16, 55), g = env(t, 0.004, 0.15, 0.6 * v);
      o.connect(g).connect(sfxBus);
      const n = noise(t, 0.1), f = filt('lowpass', 700, 1, t, 0.1, 200), ng = env(t, 0.002, 0.09, 0.3 * v);
      n.connect(f).connect(ng).connect(sfxBus);
    },
    tower_shot(t, v) { // 哨塔机枪：厚重双连发
      for (let i = 0; i < 2; i++) {
        const tt = t + i * 0.07;
        const n = noise(tt, 0.08), f = filt('bandpass', 1300, 0.8, tt, 0.08, 350);
        const g = env(tt, 0.002, 0.075, 0.5 * v);
        n.connect(f).connect(g).connect(sfxBus);
      }
    },
    // —— 爆炸 / 命中 ——
    explosion(t, v) {
      const n = noise(t, 0.7), f = filt('lowpass', 2800, 0.5, t, 0.7, 90);
      const g = env(t, 0.005, 0.68, 0.8 * v);
      n.connect(f).connect(g).connect(sfxBus);
      const sub = osc('sine', 85, t, 0.55, 26), sg = env(t, 0.004, 0.55, 0.85 * v);
      sub.connect(sg).connect(sfxBus);
    },
    explosion_big(t, v) {
      LIB.explosion(t, v); LIB.explosion(t + 0.09, v * 0.7);
      const sub = osc('sine', 55, t, 1.1, 20), sg = env(t, 0.01, 1.05, 0.9 * v);
      sub.connect(sg).connect(sfxBus);
    },
    hit(t, v) {
      const n = noise(t, 0.04), f = filt('highpass', 2200, 1, t, 0.04);
      const g = env(t, 0.001, 0.035, 0.22 * v);
      n.connect(f).connect(g).connect(sfxBus);
    },
    hit_flesh(t, v) {
      const o = osc('triangle', 160, t, 0.06, 60), g = env(t, 0.002, 0.055, 0.3 * v);
      o.connect(g).connect(sfxBus);
      const n = noise(t, 0.03), f = filt('lowpass', 900, 1, t, 0.03), ng = env(t, 0.001, 0.03, 0.15 * v);
      n.connect(f).connect(ng).connect(sfxBus);
    },
    // —— 经济 / 成长 ——
    coin(t, v) {
      [1320, 1760].forEach((f, i) => {
        const o = osc('sine', f, t + i * 0.05, 0.1), g = env(t + i * 0.05, 0.002, 0.1, 0.16 * v);
        o.connect(g).connect(sfxBus);
      });
    },
    buy(t, v) {
      const n = noise(t, 0.03), f = filt('highpass', 3000, 1, t, 0.03), ng = env(t, 0.001, 0.03, 0.2 * v);
      n.connect(f).connect(ng).connect(sfxBus);
      [880, 1174, 1568].forEach((fr, i) => {
        const o = osc('sine', fr, t + 0.05 + i * 0.06, 0.12), g = env(t + 0.05 + i * 0.06, 0.004, 0.12, 0.18 * v);
        o.connect(g).connect(sfxBus);
      });
    },
    levelup(t, v) {
      [523, 659, 784, 1046].forEach((fr, i) => {
        const o = osc('triangle', fr, t + i * 0.08, 0.25), g = env(t + i * 0.08, 0.005, 0.24, 0.25 * v);
        o.connect(g).connect(sfxBus);
      });
    },
    // —— 技能 ——
    dash(t, v) {
      const n = noise(t, 0.3), f = filt('bandpass', 500, 1.2, t, 0.3, 2600);
      const g = env(t, 0.02, 0.27, 0.4 * v);
      n.connect(f).connect(g).connect(sfxBus);
    },
    heal(t, v) {
      [660, 880, 990].forEach((fr, i) => {
        const o = osc('sine', fr, t + i * 0.07, 0.4), g = env(t + i * 0.07, 0.03, 0.36, 0.16 * v);
        o.connect(g).connect(sfxBus);
      });
    },
    smoke(t, v) {
      const n = noise(t, 0.6), f = filt('lowpass', 1400, 0.7, t, 0.6, 300);
      const g = env(t, 0.03, 0.55, 0.3 * v);
      n.connect(f).connect(g).connect(sfxBus);
    },
    stun(t, v) {
      const o1 = osc('square', 220, t, 0.2, 180), o2 = osc('square', 227, t, 0.2, 185);
      const g = env(t, 0.002, 0.19, 0.3 * v);
      o1.connect(g); o2.connect(g); g.connect(sfxBus);
    },
    poison(t, v) {
      const o = osc('sawtooth', 140, t, 0.25, 90), f = filt('lowpass', 500, 4, t, 0.25);
      const g = env(t, 0.01, 0.24, 0.25 * v);
      o.connect(f).connect(g).connect(sfxBus);
    },
    flash(t, v) {
      const o = osc('sawtooth', 1800, t, 0.18, 200), g = env(t, 0.002, 0.17, 0.35 * v);
      o.connect(g).connect(sfxBus);
      const n = noise(t, 0.1), f = filt('highpass', 2000, 1, t, 0.1), ng = env(t, 0.002, 0.09, 0.2 * v);
      n.connect(f).connect(ng).connect(sfxBus);
    },
    recall(t, v) {
      const o = osc('sine', 300, t, 3.2, 1400), g = env(t, 1.2, 1.9, 0.16 * v);
      o.connect(g).connect(sfxBus);
      for (let i = 0; i < 6; i++) {
        const tt = t + 0.4 + i * 0.45;
        const p = osc('sine', 900 + i * 150, tt, 0.15), pg = env(tt, 0.01, 0.14, 0.08 * v);
        p.connect(pg).connect(sfxBus);
      }
    },
    respawn(t, v) {
      [523, 784, 1046].forEach((fr, i) => {
        const o = osc('sine', fr, t + i * 0.05, 0.5), g = env(t + i * 0.05, 0.02, 0.46, 0.2 * v);
        o.connect(g).connect(sfxBus);
      });
    },
    death(t, v) {
      [440, 349, 261].forEach((fr, i) => {
        const o = osc('triangle', fr, t + i * 0.16, 0.34), g = env(t + i * 0.16, 0.01, 0.32, 0.28 * v);
        o.connect(g).connect(sfxBus);
      });
    },
    kill_hero(t, v) {
      const o = osc('sawtooth', 200, t, 0.3, 600), f = filt('lowpass', 2000, 1, t, 0.3);
      const g = env(t, 0.005, 0.28, 0.3 * v);
      o.connect(f).connect(g).connect(sfxBus);
      LIB.hit_flesh(t, v);
    },
    // —— 警报 / 事件 ——
    tower_alert(t, v) {
      [660, 520].forEach((fr, i) => {
        const o = osc('square', fr, t + i * 0.22, 0.2), f = filt('lowpass', 1500, 1, t, 0.2);
        const g = env(t + i * 0.22, 0.01, 0.19, 0.18 * v);
        o.connect(f).connect(g).connect(sfxBus);
      });
    },
    crystal_alert(t, v) {
      for (let i = 0; i < 3; i++) {
        const o = osc('square', 740, t + i * 0.18, 0.12), f = filt('lowpass', 1800, 1, t, 0.12);
        const g = env(t + i * 0.18, 0.005, 0.11, 0.2 * v);
        o.connect(f).connect(g).connect(sfxBus);
      }
    },
    airdrop_plane(t, v) {
      const o = osc('sawtooth', 52, t, 3.5, 48), f = filt('lowpass', 240, 1, t, 3.5);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.3 * v, t + 1.4);
      g.gain.linearRampToValueAtTime(0.0001, t + 3.5);
      o.connect(f).connect(g).connect(sfxBus);
      const n = noise(t, 3.5), nf = filt('lowpass', 400, 0.6, t, 3.5), ng = ctx.createGain();
      ng.gain.setValueAtTime(0.0001, t);
      ng.gain.linearRampToValueAtTime(0.16 * v, t + 1.4);
      ng.gain.linearRampToValueAtTime(0.0001, t + 3.5);
      n.connect(nf).connect(ng).connect(sfxBus);
    },
    airdrop_land(t, v) {
      const o = osc('sine', 110, t, 0.25, 40), g = env(t, 0.003, 0.24, 0.5 * v);
      o.connect(g).connect(sfxBus);
      const n = noise(t, 0.2), f = filt('lowpass', 600, 1, t, 0.2), ng = env(t, 0.005, 0.18, 0.3 * v);
      n.connect(f).connect(ng).connect(sfxBus);
    },
    pickup(t, v) {
      [988, 1318, 1976].forEach((fr, i) => {
        const o = osc('sine', fr, t + i * 0.07, 0.16), g = env(t + i * 0.07, 0.004, 0.15, 0.22 * v);
        o.connect(g).connect(sfxBus);
      });
    },
    zone_warn(t, v) {
      const o = osc('sine', 1100, t, 0.5, 1050), g = env(t, 0.01, 0.48, 0.22 * v);
      o.connect(g).connect(sfxBus);
      const o2 = osc('sine', 1100, t + 0.6, 0.5, 1050), g2 = env(t + 0.6, 0.01, 0.48, 0.15 * v);
      o2.connect(g2).connect(sfxBus);
    },
    parachute(t, v) {
      const n = noise(t, 2.6), f = filt('bandpass', 700, 0.5, t, 2.6, 350);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.22 * v, t + 0.5);
      g.gain.linearRampToValueAtTime(0.0001, t + 2.6);
      n.connect(f).connect(g).connect(sfxBus);
    },
    monster(t, v) {
      const o = osc('sawtooth', 90, t, 0.4, 45), f = filt('lowpass', 350, 2, t, 0.4);
      const g = env(t, 0.02, 0.38, 0.35 * v);
      o.connect(f).connect(g).connect(sfxBus);
    },
    // —— UI ——
    ui_click(t, v) {
      const o = osc('sine', 1500, t, 0.05, 900), g = env(t, 0.001, 0.05, 0.15 * v);
      o.connect(g).connect(sfxBus);
    },
    ui_confirm(t, v) {
      [784, 1175].forEach((fr, i) => {
        const o = osc('sine', fr, t + i * 0.07, 0.14), g = env(t + i * 0.07, 0.003, 0.13, 0.2 * v);
        o.connect(g).connect(sfxBus);
      });
    },
    select_lock(t, v) {
      const n = noise(t, 0.05), f = filt('lowpass', 1200, 1, t, 0.05), ng = env(t, 0.001, 0.05, 0.35 * v);
      n.connect(f).connect(ng).connect(sfxBus);
      const o = osc('sine', 180, t + 0.02, 0.15, 70), g = env(t + 0.02, 0.002, 0.14, 0.4 * v);
      o.connect(g).connect(sfxBus);
    },
    victory(t, v) {
      [523, 659, 784, 1046, 784, 1046, 1318].forEach((fr, i) => {
        const o = osc('triangle', fr, t + i * 0.16, 0.4), g = env(t + i * 0.16, 0.01, 0.38, 0.3 * v);
        o.connect(g).connect(sfxBus);
      });
    },
    defeat(t, v) {
      [392, 349, 311, 261].forEach((fr, i) => {
        const o = osc('triangle', fr, t + i * 0.3, 0.5), g = env(t + i * 0.3, 0.02, 0.47, 0.28 * v);
        o.connect(g).connect(sfxBus);
      });
    },
  };

  function sfx(name, opts = {}) {
    if (!inited || muted) return;
    resume();
    const fn = LIB[name]; if (!fn) return;
    const v = (opts.vol ?? 1) * spatialVol(opts.at);
    if (v <= 0.01) return;
    try { fn(ctx.currentTime + (opts.delay || 0), v); } catch (e) { /* ignore */ }
  }

  /* ---------- 中文语音播报 ---------- */
  let zhVoice = null, voiceReady = false;
  function pickVoice() {
    if (!window.speechSynthesis) return;
    const vs = speechSynthesis.getVoices();
    zhVoice = vs.find(v => /Xiaoxiao|Yunxi|Huihui|Yaoyao/i.test(v.name))
      || vs.find(v => v.lang && v.lang.startsWith('zh'))
      || null;
    voiceReady = true;
  }
  if (window.speechSynthesis) {
    pickVoice();
    speechSynthesis.onvoiceschanged = pickVoice;
  }
  function announce(text, opts = {}) {
    if (!voiceOn || muted || !window.speechSynthesis) return;
    if (!voiceReady) pickVoice();
    if (opts.interrupt !== false) speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    if (zhVoice) u.voice = zhVoice;
    u.lang = 'zh-CN'; u.rate = opts.rate || 1.08; u.pitch = opts.pitch || 1.0;
    u.volume = Math.min(1, vols.master * 1.2);
    speechSynthesis.speak(u);
    duckMusic();
  }
  function duckMusic() {
    if (!inited) return;
    const t = ctx.currentTime;
    musicBus.gain.cancelScheduledValues(t);
    musicBus.gain.setValueAtTime(vols.music * 0.3, t);
    musicBus.gain.linearRampToValueAtTime(vols.music, t + 2.2);
  }

  /* ---------- 程序化 BGM ---------- */
  const CHORDS = [
    [110.0, 130.81, 164.81],   // Am
    [87.31, 110.0, 174.61],    // F
    [98.0, 123.47, 196.0],     // G
    [110.0, 130.81, 164.81],   // Am
  ];
  let musicMode = null, schedTimer = null, nextBarTime = 0, barIdx = 0;
  const BPM = 92, BAR = (60 / BPM) * 4;

  function playPad(chord, t) {
    chord.forEach(fr => {
      [fr, fr * 1.005].forEach(f => {
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
        const flt = ctx.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = 480; flt.Q.value = 0.6;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.05, t + BAR * 0.35);
        g.gain.linearRampToValueAtTime(0.0001, t + BAR * 1.02);
        o.connect(flt).connect(g).connect(musicBus);
        o.start(t); o.stop(t + BAR * 1.1);
      });
    });
  }
  function playDrums(t) {
    for (let b = 0; b < 4; b++) {
      const bt = t + b * (BAR / 4);
      // 军鼓底鼓
      if (b === 0 || b === 2) {
        const k = osc('sine', 130, bt, 0.14, 40), kg = env(bt, 0.002, 0.13, 0.5);
        k.connect(kg).connect(musicBus);
      } else {
        const n = noise(bt, 0.1), f = filt('bandpass', 1800, 1, bt, 0.1), ng = env(bt, 0.002, 0.095, 0.16);
        n.connect(f).connect(ng).connect(musicBus);
        const tm = osc('triangle', 200, bt, 0.1, 120), tg = env(bt, 0.002, 0.095, 0.2);
        tm.connect(tg).connect(musicBus);
      }
      // 军帽镲
      for (let h = 0; h < 2; h++) {
        const ht = bt + h * (BAR / 8);
        const n = noise(ht, 0.03), f = filt('highpass', 8000, 1, ht, 0.03), ng = env(ht, 0.001, 0.028, 0.05);
        n.connect(f).connect(ng).connect(musicBus);
      }
    }
    // 低音脉冲
    const root = CHORDS[barIdx % 4][0] / 2;
    for (let b = 0; b < 8; b++) {
      const bt = t + b * (BAR / 8);
      const o = osc('sine', root, bt, 0.1), g = env(bt, 0.005, 0.09, 0.14);
      o.connect(g).connect(musicBus);
    }
  }
  function schedule() {
    if (!musicMode) return;
    while (nextBarTime < ctx.currentTime + 0.3) {
      const chord = CHORDS[barIdx % 4];
      playPad(chord, nextBarTime);
      if (musicMode === 'battle') playDrums(nextBarTime);
      barIdx++;
      nextBarTime += BAR;
    }
  }
  function music(mode) {
    if (!inited) { musicMode = mode; return; }
    resume();
    if (mode === musicMode && schedTimer) return;
    musicMode = mode;
    if (schedTimer) { clearInterval(schedTimer); schedTimer = null; }
    if (!mode) return;
    nextBarTime = ctx.currentTime + 0.1; barIdx = 0;
    schedTimer = setInterval(schedule, 120);
  }

  return {
    init, resume, sfx, announce, music, setVol, setMuted, setVoice,
    get muted() { return muted; },
    listener,
    afterInit() { if (musicMode) music(musicMode); },
  };
})();
