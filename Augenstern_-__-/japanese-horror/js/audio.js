// ============ 程序化恐怖音效引擎 (Web Audio) ============
const Sfx = (() => {
  let ctx = null, master = null, ambBus = null;
  let inited = false;
  let loops = {};

  function init() {
    if (inited) return;
    inited = true;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0.85; master.connect(ctx.destination);
    ambBus = ctx.createGain(); ambBus.gain.value = 1; ambBus.connect(master);
  }
  function resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); }
  const now = () => ctx.currentTime;

  function env(g, t0, a, peak, d, r = 0.08) {
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d + r);
  }
  function osc(type, freq, t0, dur, gainNode) {
    const o = ctx.createOscillator();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    o.connect(gainNode);
    o.start(t0); o.stop(t0 + dur + 0.15);
    return o;
  }
  function noiseBuffer(dur = 1) {
    const len = Math.max(1, (ctx.sampleRate * dur) | 0);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }
  function playNoise(t0, dur, peak, fType, f0, f1, q = 1, out = master) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(Math.min(dur + 0.3, 3));
    src.loop = dur > 2.5;
    const filt = ctx.createBiquadFilter();
    filt.type = fType; filt.Q.value = q;
    filt.frequency.setValueAtTime(f0, t0);
    if (f1 !== undefined) filt.frequency.exponentialRampToValueAtTime(Math.max(f1, 20), t0 + dur);
    const g = ctx.createGain();
    env(g, t0, Math.min(0.02, dur * 0.2), peak, dur * 0.7, dur * 0.3);
    src.connect(filt); filt.connect(g); g.connect(out);
    src.start(t0); src.stop(t0 + dur + 0.4);
  }

  // ---------- UI ----------
  function uiSelect() {
    if (!ctx) return;
    const t0 = now(), g = ctx.createGain();
    env(g, t0, 0.005, 0.1, 0.1);
    g.connect(master);
    osc('square', 660, t0, 0.12, g);
  }

  // ---------- 环境底噪 ----------
  function ambientLoop() {
    if (!ctx || loops.amb) return;
    const t0 = now();
    // 低频房间轰鸣
    const o1 = ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = 41;
    const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = 47.3;
    const g1 = ctx.createGain();
    g1.gain.setValueAtTime(0.0001, t0);
    g1.gain.linearRampToValueAtTime(0.05, t0 + 3);
    o1.connect(g1); o2.connect(g1); g1.connect(ambBus);
    // 风声 (墙外)
    const src = ctx.createBufferSource(); src.buffer = noiseBuffer(3); src.loop = true;
    const filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 240; filt.Q.value = 0.4;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
    const lfoG = ctx.createGain(); lfoG.gain.value = 110;
    lfo.connect(lfoG); lfoG.connect(filt.frequency);
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.0001, t0);
    g2.gain.linearRampToValueAtTime(0.028, t0 + 4);
    src.connect(filt); filt.connect(g2); g2.connect(ambBus);
    o1.start(); o2.start(); src.start(); lfo.start();
    loops.amb = { nodes: [o1, o2, src, lfo], gains: [g1, g2] };
    scheduleCreaks();
  }

  // 随机木质吱呀声 / 远处声响
  let creakTimer = null;
  function scheduleCreaks() {
    const fire = () => {
      if (!ctx) return;
      const r = Math.random();
      if (r < 0.4) woodCreak(0.02 + Math.random() * 0.03);
      else if (r < 0.6) distantThud(0.05);
      else if (r < 0.75) pipeKnock();
      creakTimer = setTimeout(fire, 9000 + Math.random() * 22000);
    };
    creakTimer = setTimeout(fire, 8000);
  }

  function woodCreak(vol = 0.05) {
    if (!ctx) return;
    const t0 = now(), g = ctx.createGain();
    const dur = 0.5 + Math.random() * 0.7;
    env(g, t0, dur * 0.4, vol, dur * 0.5);
    g.connect(master);
    const o = osc('sawtooth', 130 + Math.random() * 160, t0, dur, g);
    o.frequency.linearRampToValueAtTime(90 + Math.random() * 120, t0 + dur);
    const filt = ctx.createBiquadFilter();
    filt.type = 'bandpass'; filt.frequency.value = 400; filt.Q.value = 7;
    o.disconnect(); o.connect(filt); filt.connect(g);
  }

  function distantThud(vol = 0.08) {
    if (!ctx) return;
    const t0 = now();
    playNoise(t0, 0.35, vol, 'lowpass', 160, 60);
    const g = ctx.createGain();
    env(g, t0, 0.01, vol * 0.8, 0.3);
    g.connect(master);
    osc('sine', 55, t0, 0.35, g);
  }

  function pipeKnock() {
    if (!ctx) return;
    const t0 = now();
    const n = 2 + ((Math.random() * 3) | 0);
    for (let i = 0; i < n; i++) {
      const t = t0 + i * (0.24 + Math.random() * 0.12);
      const g = ctx.createGain();
      env(g, t, 0.004, 0.035, 0.12);
      g.connect(master);
      osc('triangle', 620 + Math.random() * 200, t, 0.15, g);
    }
  }

  // ---------- 荧光灯 ----------
  function fluorescentBuzz(x = 0) {
    if (!ctx || loops.buzz) return;
    const t0 = now();
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 118;
    const filt = ctx.createBiquadFilter(); filt.type = 'highpass'; filt.frequency.value = 900;
    const g = ctx.createGain(); g.gain.value = 0.012;
    o.connect(filt); filt.connect(g); g.connect(master);
    o.start();
    loops.buzz = { nodes: [o], g };
  }
  function buzzFlicker() {
    if (!loops.buzz) return;
    const g = loops.buzz.g, t0 = now();
    g.gain.cancelScheduledValues(t0);
    for (let i = 0; i < 6; i++) {
      g.gain.setValueAtTime(Math.random() < 0.5 ? 0.002 : 0.02, t0 + i * 0.05);
    }
    g.gain.setValueAtTime(0.012, t0 + 0.32);
  }

  // ---------- 脚步 ----------
  let lastStep = 0;
  function footstep(running = false) {
    if (!ctx) return;
    const t = performance.now();
    if (t - lastStep < (running ? 300 : 480)) return;
    lastStep = t;
    const t0 = now();
    const vol = running ? 0.11 : 0.06;
    playNoise(t0, 0.09, vol, 'lowpass', 300 + Math.random() * 120, 100);
    const g = ctx.createGain();
    env(g, t0, 0.005, vol * 0.5, 0.08);
    g.connect(master);
    osc('sine', 70 + Math.random() * 25, t0, 0.1, g);
    // 木地板偶尔吱呀
    if (Math.random() < 0.14) woodCreak(0.02);
  }

  // ---------- 手电筒 ----------
  function torchClick(on) {
    if (!ctx) return;
    const t0 = now(), g = ctx.createGain();
    env(g, t0, 0.002, 0.12, 0.05);
    g.connect(master);
    osc('square', on ? 1800 : 1200, t0, 0.06, g);
  }

  // ---------- 门 ----------
  function doorCreak(open) {
    if (!ctx) return;
    const t0 = now();
    const dur = 1.1 + Math.random() * 0.4;
    const g = ctx.createGain();
    env(g, t0, 0.15, 0.09, dur * 0.7);
    g.connect(master);
    const o = osc('sawtooth', open ? 170 : 240, t0, dur, g);
    const target = open ? 260 : 140;
    o.frequency.linearRampToValueAtTime(target, t0 + dur * 0.8);
    const filt = ctx.createBiquadFilter();
    filt.type = 'bandpass'; filt.frequency.value = 500; filt.Q.value = 9;
    o.disconnect(); o.connect(filt); filt.connect(g);
    // 门闩
    const g2 = ctx.createGain();
    env(g2, t0 + (open ? 0 : dur * 0.8), 0.004, 0.1, 0.09);
    g2.connect(master);
    osc('triangle', 340, t0 + (open ? 0 : dur * 0.8), 0.1, g2);
  }
  function doorLocked() {
    if (!ctx) return;
    const t0 = now();
    for (let i = 0; i < 2; i++) {
      const g = ctx.createGain();
      env(g, t0 + i * 0.14, 0.004, 0.13, 0.08);
      g.connect(master);
      osc('triangle', 200, t0 + i * 0.14, 0.1, g);
      playNoise(t0 + i * 0.14, 0.06, 0.08, 'highpass', 1500, 2500);
    }
  }

  // ---------- 拾取 / 纸张 ----------
  function paperRustle() {
    if (!ctx) return;
    const t0 = now();
    for (let i = 0; i < 3; i++) {
      playNoise(t0 + i * 0.07, 0.09, 0.05, 'highpass', 2600 + Math.random() * 800, 3400, 0.6);
    }
  }
  function itemGet() {
    if (!ctx) return;
    const t0 = now(), g = ctx.createGain();
    env(g, t0, 0.01, 0.08, 0.4);
    g.connect(master);
    osc('sine', 520, t0, 0.5, g);
    const g2 = ctx.createGain();
    env(g2, t0 + 0.12, 0.01, 0.06, 0.4);
    g2.connect(master);
    osc('sine', 780, t0 + 0.12, 0.5, g2);
  }

  // ---------- 恐怖刺激音 ----------
  function heartbeatLoop(rate = 1) {
    stopHeartbeat();
    const beat = () => {
      if (!ctx) return;
      const t0 = now();
      [0, 0.32 / rate].forEach((dt, i) => {
        const g = ctx.createGain();
        env(g, t0 + dt, 0.012, i === 0 ? 0.14 : 0.1, 0.16);
        g.connect(master);
        osc('sine', i === 0 ? 58 : 48, t0 + dt, 0.22, g);
      });
    };
    beat();
    loops.heart = { timer: setInterval(beat, 900 / rate) };
  }
  function stopHeartbeat() {
    if (loops.heart) { clearInterval(loops.heart.timer); delete loops.heart; }
  }

  function whisper() {
    if (!ctx) return;
    const t0 = now();
    // 气声窃语: 带通白噪 + 颤动
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(2.2);
    const filt = ctx.createBiquadFilter();
    filt.type = 'bandpass'; filt.Q.value = 5;
    filt.frequency.setValueAtTime(1400, t0);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 7 + Math.random() * 5;
    const lfoG = ctx.createGain(); lfoG.gain.value = 550;
    lfo.connect(lfoG); lfoG.connect(filt.frequency);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(0.055, t0 + 0.5);
    g.gain.linearRampToValueAtTime(0.0001, t0 + 2.1);
    // 立体声漂移
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    src.connect(filt); filt.connect(g);
    if (pan) {
      pan.pan.setValueAtTime(Math.random() < 0.5 ? -0.8 : 0.8, t0);
      pan.pan.linearRampToValueAtTime(0, t0 + 2);
      g.connect(pan); pan.connect(master);
    } else g.connect(master);
    src.start(t0); src.stop(t0 + 2.3);
    lfo.start(t0); lfo.stop(t0 + 2.3);
  }

  function stinger(intensity = 1) {
    if (!ctx) return;
    const t0 = now();
    // 不和谐弦乐骤响
    [220, 233, 466, 699].forEach(f => {
      const g = ctx.createGain();
      env(g, t0, 0.02, 0.07 * intensity, 1.1);
      g.connect(master);
      const o = osc('sawtooth', f * (0.98 + Math.random() * 0.04), t0, 1.3, g);
      o.frequency.linearRampToValueAtTime(f * 1.06, t0 + 1.2);
    });
    playNoise(t0, 0.7, 0.1 * intensity, 'highpass', 2000, 5000);
  }

  function droneRise(dur = 3) {
    if (!ctx) return;
    const t0 = now();
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(0.09, t0 + dur);
    g.gain.linearRampToValueAtTime(0.0001, t0 + dur + 0.4);
    g.connect(master);
    const o = osc('sawtooth', 55, t0, dur + 0.5, g);
    o.frequency.exponentialRampToValueAtTime(190, t0 + dur);
    const o2 = osc('sawtooth', 57, t0, dur + 0.5, g);
    o2.frequency.exponentialRampToValueAtTime(196, t0 + dur);
  }

  function staticBurst(dur = 0.8, vol = 0.22) {
    if (!ctx) return;
    playNoise(now(), dur, vol, 'highpass', 800, 1200, 0.4);
  }

  function monsterGroan() {
    if (!ctx) return;
    const t0 = now();
    const g = ctx.createGain();
    const dur = 1.6 + Math.random() * 0.8;
    env(g, t0, 0.3, 0.1, dur * 0.7);
    g.connect(master);
    const o = osc('sawtooth', 82, t0, dur, g);
    o.frequency.linearRampToValueAtTime(56, t0 + dur);
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass'; filt.frequency.value = 260;
    o.disconnect(); o.connect(filt); filt.connect(g);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 11;
    const lfoG = ctx.createGain(); lfoG.gain.value = 14;
    lfo.connect(lfoG); lfoG.connect(o.frequency);
    lfo.start(t0); lfo.stop(t0 + dur);
  }

  function caughtScream() {
    if (!ctx) return;
    const t0 = now();
    // 高频不和谐 + 撕裂噪声
    [880, 932, 1245, 1865].forEach(f => {
      const g = ctx.createGain();
      env(g, t0, 0.01, 0.12, 0.9);
      g.connect(master);
      const o = osc('sawtooth', f, t0, 1, g);
      o.frequency.linearRampToValueAtTime(f * 0.6, t0 + 0.9);
    });
    playNoise(t0, 1.4, 0.3, 'highpass', 600, 300);
    const g2 = ctx.createGain();
    env(g2, t0, 0.01, 0.2, 1.2);
    g2.connect(master);
    osc('sine', 48, t0, 1.3, g2);
  }

  function bellToll() {
    if (!ctx) return;
    const t0 = now();
    [392, 466, 587].forEach((f, i) => {
      const g = ctx.createGain();
      env(g, t0 + i * 0.02, 0.01, 0.05, 3.5);
      g.connect(master);
      osc('sine', f * 0.5, t0 + i * 0.02, 4, g);
    });
  }

  function setAmbLevel(v, ramp = 2) {
    if (ambBus) ambBus.gain.linearRampToValueAtTime(v, now() + ramp);
  }

  return {
    init, resume,
    uiSelect, ambientLoop, fluorescentBuzz, buzzFlicker,
    footstep, torchClick, doorCreak, doorLocked, paperRustle, itemGet,
    heartbeatLoop, stopHeartbeat, whisper, stinger, droneRise, staticBurst,
    monsterGroan, caughtScream, bellToll, woodCreak, distantThud, pipeKnock,
    setAmbLevel,
  };
})();
