/* ============================================================
   STARFORGE - audio.js
   WebAudio 程序化音效 + 氛围音乐引擎（全部合成，无外部素材）
   ============================================================ */
'use strict';

const Sound = (() => {
  let ctx = null, master = null, sfxBus = null, musBus = null;
  let volume = 0.7;
  let started = false;

  function ensure(){
    if (ctx) return true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = volume; master.connect(ctx.destination);
      sfxBus = ctx.createGain(); sfxBus.gain.value = 0.9; sfxBus.connect(master);
      musBus = ctx.createGain(); musBus.gain.value = 0.45; musBus.connect(master);
      return true;
    } catch(e){ return false; }
  }
  function resume(){ if (ensure() && ctx.state === 'suspended') ctx.resume(); }
  function setVolume(v){ volume = v; if (master) master.gain.value = v; }

  // ---------- 基础合成器 ----------
  function env(g, t, a, d, peak = 1, sustain = 0){
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(sustain, 0.0001), t + a + d);
  }
  function osc(type, freq, t0, dur, gain = 0.3, dest = null, freqEnd = null){
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (freqEnd !== null) o.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 1), t0 + dur);
    env(g, t0, 0.005, dur, gain);
    o.connect(g); g.connect(dest || sfxBus);
    o.start(t0); o.stop(t0 + dur + 0.1);
    return o;
  }
  let noiseBuf = null;
  function getNoise(){
    if (noiseBuf) return noiseBuf;
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return noiseBuf;
  }
  function noise(t0, dur, gain, fType = 'lowpass', f0 = 800, f1 = null, q = 1, dest = null){
    const src = ctx.createBufferSource(); src.buffer = getNoise(); src.loop = true;
    const flt = ctx.createBiquadFilter(); flt.type = fType; flt.Q.value = q;
    flt.frequency.setValueAtTime(f0, t0);
    if (f1 !== null) flt.frequency.exponentialRampToValueAtTime(Math.max(f1, 10), t0 + dur);
    const g = ctx.createGain(); env(g, t0, 0.005, dur, gain);
    src.connect(flt); flt.connect(g); g.connect(dest || sfxBus);
    src.start(t0); src.stop(t0 + dur + 0.1);
    return { src, flt, g };
  }

  // ---------- 单发音效 ----------
  const S = {};
  S.uiClick   = () => { const t = ctx.currentTime; osc('square', 1800, t, 0.04, 0.12); osc('sine', 900, t, 0.06, 0.1); };
  S.uiOpen    = () => { const t = ctx.currentTime; osc('sine', 500, t, 0.12, 0.16, null, 1050); osc('sine', 750, t + 0.05, 0.1, 0.12, null, 1400); };
  S.uiClose   = () => { const t = ctx.currentTime; osc('sine', 1000, t, 0.12, 0.14, null, 420); };
  S.uiError   = () => { const t = ctx.currentTime; osc('square', 220, t, 0.1, 0.14); osc('square', 180, t + 0.11, 0.14, 0.14); };
  S.hover     = () => { const t = ctx.currentTime; osc('sine', 2200, t, 0.025, 0.05); };
  S.pickup    = () => { const t = ctx.currentTime; osc('sine', 620, t, 0.05, 0.14, null, 880); osc('sine', 1240, t + 0.04, 0.07, 0.1, null, 1760); };
  S.craft     = () => { const t = ctx.currentTime;
    osc('square', 440, t, 0.08, 0.1); osc('square', 660, t + 0.07, 0.08, 0.1); osc('sine', 880, t + 0.14, 0.18, 0.16, null, 1320);
    noise(t, 0.12, 0.05, 'highpass', 3000);
  };
  S.place     = () => { const t = ctx.currentTime; noise(t, 0.08, 0.25, 'lowpass', 900, 300); osc('sine', 160, t, 0.07, 0.25, null, 90); };
  S.dig       = (pitch = 1) => { const t = ctx.currentTime; noise(t, 0.06, 0.18, 'lowpass', 1400 * pitch, 500); osc('triangle', 240 * pitch, t, 0.04, 0.12, null, 130); };
  S.breakBlk  = (pitch = 1) => { const t = ctx.currentTime;
    noise(t, 0.16, 0.32, 'lowpass', 2200 * pitch, 300);
    osc('triangle', 300 * pitch, t, 0.1, 0.2, null, 80);
    osc('square', 150 * pitch, t + 0.02, 0.08, 0.08, null, 60);
  };
  S.step      = (p = 1) => { const t = ctx.currentTime; noise(t, 0.05, 0.06, 'lowpass', 700 * p, 250); };
  S.jump      = () => { const t = ctx.currentTime; noise(t, 0.08, 0.06, 'bandpass', 600, 1200); };
  S.land      = () => { const t = ctx.currentTime; noise(t, 0.1, 0.16, 'lowpass', 500, 150); osc('sine', 110, t, 0.08, 0.2, null, 60); };
  S.hurt      = () => { const t = ctx.currentTime; osc('sawtooth', 300, t, 0.15, 0.22, null, 120); noise(t, 0.1, 0.12, 'bandpass', 800, 300); };
  S.hazBeep   = () => { const t = ctx.currentTime; osc('square', 1400, t, 0.07, 0.1); osc('square', 1400, t + 0.14, 0.07, 0.1); };
  S.recharge  = () => { const t = ctx.currentTime; osc('sine', 400, t, 0.3, 0.12, null, 1300); };
  S.questDone = () => { const t = ctx.currentTime;
    [523, 659, 784, 1047].forEach((f, i) => osc('sine', f, t + i * 0.1, 0.28, 0.14));
    noise(t + 0.3, 0.3, 0.03, 'highpass', 5000);
  };
  S.questNew  = () => { const t = ctx.currentTime; osc('sine', 784, t, 0.12, 0.12); osc('sine', 988, t + 0.12, 0.2, 0.12); };
  S.research  = () => { const t = ctx.currentTime;
    [392, 494, 587, 784, 988].forEach((f, i) => osc('triangle', f, t + i * 0.09, 0.34, 0.12));
    noise(t, 0.5, 0.04, 'bandpass', 2000, 4000);
  };
  S.machinePlace = () => { const t = ctx.currentTime;
    noise(t, 0.12, 0.2, 'lowpass', 800, 200); osc('square', 90, t, 0.15, 0.22, null, 55);
    osc('sine', 1200, t + 0.12, 0.1, 0.08, null, 1800);
  };
  S.coin      = () => { const t = ctx.currentTime; osc('square', 1319, t, 0.06, 0.1); osc('square', 1760, t + 0.06, 0.16, 0.1); };
  S.buy       = () => { S.coin(); const t = ctx.currentTime; osc('sine', 880, t + 0.1, 0.15, 0.08, null, 1100); };
  S.laserHit  = () => { const t = ctx.currentTime; noise(t, 0.05, 0.1, 'bandpass', 2500, 1000, 4); };
  S.shipDamage= () => { const t = ctx.currentTime; noise(t, 0.3, 0.3, 'lowpass', 1500, 200); osc('sawtooth', 120, t, 0.25, 0.25, null, 45); };
  S.dock      = () => { const t = ctx.currentTime;
    osc('sine', 220, t, 0.4, 0.16, null, 110); noise(t + 0.25, 0.2, 0.1, 'lowpass', 600, 150);
    osc('sine', 660, t + 0.45, 0.2, 0.1); osc('sine', 880, t + 0.6, 0.3, 0.1);
  };
  S.alarm     = () => { const t = ctx.currentTime; for (let i = 0; i < 3; i++){ osc('square', 880, t + i * 0.3, 0.12, 0.1); osc('square', 660, t + i * 0.3 + 0.13, 0.12, 0.1); } };
  S.takeoff   = () => { const t = ctx.currentTime;
    noise(t, 3.2, 0.4, 'lowpass', 300, 3500, 1);
    osc('sawtooth', 45, t, 3, 0.3, null, 220);
    osc('sine', 60, t, 2.8, 0.25, null, 300);
  };
  S.landShip  = () => { const t = ctx.currentTime;
    noise(t, 2.2, 0.3, 'lowpass', 2800, 250);
    osc('sawtooth', 200, t, 2, 0.2, null, 40);
  };
  S.pulseStart= () => { const t = ctx.currentTime; osc('sine', 150, t, 1.2, 0.2, null, 1200); noise(t, 1.2, 0.18, 'bandpass', 400, 4000, 2); };
  S.pulseEnd  = () => { const t = ctx.currentTime; osc('sine', 1200, t, 0.8, 0.2, null, 100); noise(t, 0.7, 0.2, 'lowpass', 4000, 200); };
  S.shoot     = () => { const t = ctx.currentTime; osc('sawtooth', 900, t, 0.12, 0.14, null, 200); noise(t, 0.08, 0.1, 'highpass', 2000); };
  S.explode   = () => { const t = ctx.currentTime; noise(t, 0.5, 0.4, 'lowpass', 2500, 100); osc('sine', 90, t, 0.4, 0.35, null, 30); };
  S.insert    = () => { const t = ctx.currentTime; osc('sine', 700, t, 0.05, 0.08, null, 1000); };
  S.openChest = () => { const t = ctx.currentTime; noise(t, 0.1, 0.1, 'bandpass', 900, 400); osc('sine', 300, t, 0.08, 0.1, null, 500); };
  S.scan      = () => { const t = ctx.currentTime;
    osc('sine', 400, t, 0.9, 0.12, null, 2400);
    noise(t, 0.9, 0.05, 'bandpass', 1200, 4800, 3);
    osc('sine', 1800, t + 0.9, 0.15, 0.1);
  };
  S.scanHit   = () => { const t = ctx.currentTime; osc('sine', 1560, t, 0.08, 0.07); };
  S.reentry   = () => { const t = ctx.currentTime;
    noise(t, 3.0, 0.35, 'lowpass', 200, 2200, 1);          // 大气摩擦轰鸣
    noise(t + 0.3, 2.4, 0.18, 'bandpass', 600, 1800, 2);
    osc('sawtooth', 38, t, 2.8, 0.22, null, 70);
  };
  // ---- 访客飞船（音量参数化：按与听者距离衰减）----
  S.visitorWhoosh = (v = 0.2) => { const t = ctx.currentTime;   // 掠过/穿盾气流
    noise(t, 1.4, 0.30 * v, 'bandpass', 300, 2400, 1.5);
    osc('sawtooth', 70, t, 1.2, 0.5 * v, null, 180);
  };
  S.visitorLand = (v = 0.2) => { const t = ctx.currentTime;     // 反推着陆
    noise(t, 1.6, 0.5 * v, 'lowpass', 1800, 220);
    osc('sawtooth', 150, t, 1.4, 0.45 * v, null, 42);
    osc('sine', 55, t + 1.15, 0.25, 0.5 * v);                   // 落坪闷响
  };
  S.visitorLift = (v = 0.2) => { const t = ctx.currentTime;     // 引擎拉起
    noise(t, 2.0, 0.4 * v, 'lowpass', 260, 2600, 1);
    osc('sawtooth', 40, t, 1.8, 0.5 * v, null, 190);
  };
  S.enemyShoot = (v = 0.2) => { const t = ctx.currentTime;      // 敌舰开火（距离衰减）
    osc('sawtooth', 760, t, 0.14, 0.5 * v, null, 150);
    noise(t, 0.1, 0.32 * v, 'highpass', 1600);
  };
  S.hullHit = (v = 1) => { const t = ctx.currentTime;           // 船体被击中：金属闷响+警示哔
    noise(t, 0.28, 0.5 * v, 'lowpass', 1400, 160);
    osc('sawtooth', 95, t, 0.3, 0.45 * v, null, 38);
    osc('square', 990, t + 0.05, 0.09, 0.18 * v);
  };

  function play(name, ...args){
    if (!ctx || ctx.state !== 'running') return;
    try { if (S[name]) S[name](...args); } catch(e){}
  }

  // ---------- 持续音效（激光/喷气/引擎）----------
  function makeLoop(build){
    let nodes = null;
    return {
      start(){ if (nodes || !ctx || ctx.state !== 'running') return; nodes = build(); },
      stop(){ if (!nodes) return;
        const t = ctx.currentTime;
        nodes.gain.gain.cancelScheduledValues(t);
        nodes.gain.gain.setValueAtTime(nodes.gain.gain.value, t);
        nodes.gain.gain.linearRampToValueAtTime(0.0001, t + 0.12);
        const list = nodes.stop; setTimeout(() => list.forEach(n => { try{ n.stop(); }catch(e){} }), 200);
        nodes = null;
      },
      set(param, v){ if (nodes && nodes.set) nodes.set(param, v); },
      get active(){ return !!nodes; }
    };
  }
  const loops = {};
  loops.laser = makeLoop(() => {
    const t = ctx.currentTime;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.12, t + 0.08); g.connect(sfxBus);
    const o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 85;
    const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = 170;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 16;
    const lg = ctx.createGain(); lg.gain.value = 26; lfo.connect(lg); lg.connect(o1.frequency);
    const flt = ctx.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = 900;
    o1.connect(flt); o2.connect(flt); flt.connect(g);
    o1.start(); o2.start(); lfo.start();
    return { gain: g, stop: [o1, o2, lfo] };
  });
  loops.jet = makeLoop(() => {
    const t = ctx.currentTime;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.16, t + 0.15); g.connect(sfxBus);
    const src = ctx.createBufferSource(); src.buffer = getNoise(); src.loop = true;
    const flt = ctx.createBiquadFilter(); flt.type = 'bandpass'; flt.frequency.value = 700; flt.Q.value = 0.7;
    src.connect(flt); flt.connect(g); src.start();
    return { gain: g, stop: [src] };
  });
  loops.engine = makeLoop(() => {
    const t = ctx.currentTime;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.14, t + 0.4); g.connect(sfxBus);
    const src = ctx.createBufferSource(); src.buffer = getNoise(); src.loop = true;
    const flt = ctx.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = 400;
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 55;
    const og = ctx.createGain(); og.gain.value = 0.5;
    src.connect(flt); flt.connect(g); o.connect(og); og.connect(g);
    src.start(); o.start();
    return { gain: g, stop: [src, o],
      set(param, v){ if (param === 'speed'){ flt.frequency.value = 300 + v * 2200; o.frequency.value = 45 + v * 90; g.gain.value = 0.08 + v * 0.14; } }
    };
  });
  loops.pulse = makeLoop(() => {
    const t = ctx.currentTime;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.2, t + 0.5);
    const src = ctx.createBufferSource(); src.buffer = getNoise(); src.loop = true;
    const flt = ctx.createBiquadFilter(); flt.type = 'bandpass'; flt.frequency.value = 2000; flt.Q.value = 2;
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 90;
    src.connect(flt); flt.connect(g); o.connect(g); src.start(); o.start();
    return { gain: g, stop: [src, o] };
  });
  // 曲速引擎持续音（厚重低鸣——非脉冲高音啸叫）：跃迁专用，长时间听不刺耳
  loops.warp = makeLoop(() => {
    const t = ctx.currentTime;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.26, t + 1.2); g.connect(sfxBus);
    // 低频轰鸣（~38Hz 锯齿波，缓慢升频至 140Hz 模拟引擎攀升）
    const osc = ctx.createOscillator(); osc.type = 'sawtooth'; osc.frequency.setValueAtTime(38, t);
    osc.frequency.linearRampToValueAtTime(140, t + 5);
    // 气流底噪（低通 + 缓慢升频）
    const src = ctx.createBufferSource(); src.buffer = getNoise(); src.loop = true;
    const flt = ctx.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.setValueAtTime(280, t);
    flt.frequency.linearRampToValueAtTime(1100, t + 5);
    const ng = ctx.createGain(); ng.gain.setValueAtTime(0.12, t);
    src.connect(flt); flt.connect(ng); ng.connect(g);
    osc.connect(g); src.start(); osc.start();
    return { gain: g, stop: [osc, src] };
  });

  // ---------- 氛围音乐引擎 ----------
  // 缓慢琶音 + 长音垫，随场景切换音阶氛围
  const Music = (() => {
    let timer = null, mode = 'planet', step = 0;
    const scales = {
      planet: [130.8, 164.8, 196.0, 261.6, 329.6, 392.0, 523.3],       // C 大调 - 平静
      space:  [110.0, 130.8, 164.8, 220.0, 261.6, 329.6, 440.0],       // A 小调 - 空旷
      station:[146.8, 185.0, 220.0, 293.7, 370.0, 440.0, 587.3],       // D - 商业繁忙
      danger: [103.8, 123.5, 155.6, 207.7, 246.9, 311.1]               // 阴暗
    };
    function padNote(f, t, dur, g0 = 0.05){
      const o1 = ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = f;
      const o2 = ctx.createOscillator(); o2.type = 'triangle'; o2.frequency.value = f * 1.005;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(g0, t + dur * 0.4);
      g.gain.linearRampToValueAtTime(0.0001, t + dur);
      const flt = ctx.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = 1200;
      o1.connect(flt); o2.connect(flt); flt.connect(g); g.connect(musBus);
      o1.start(t); o2.start(t); o1.stop(t + dur + 0.1); o2.stop(t + dur + 0.1);
    }
    function pluck(f, t, g0 = 0.05){
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(g0, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
      o.connect(g); g.connect(musBus); o.start(t); o.stop(t + 1.8);
    }
    function tick(){
      if (!ctx || ctx.state !== 'running') return;
      const t = ctx.currentTime + 0.05;
      const sc = scales[mode] || scales.planet;
      const r = Math.random;
      if (step % 8 === 0) padNote(sc[0] / 2, t, 7.5, 0.045);           // 低音垫
      if (step % 8 === 4 && r() < 0.8) padNote(sc[2] / 2, t, 6, 0.035);
      if (r() < 0.55) pluck(sc[(r() * sc.length) | 0] * (r() < 0.3 ? 2 : 1), t, 0.03 + r() * 0.03);
      if (mode === 'station' && r() < 0.3) pluck(sc[(r() * sc.length) | 0] * 2, t + 0.4, 0.02);
      step++;
    }
    return {
      start(){ if (timer) return; timer = setInterval(tick, 900); },
      stop(){ clearInterval(timer); timer = null; },
      setMode(m){ mode = m; }
    };
  })();

  function begin(){
    if (started) return;
    resume();
    if (!ctx) return;
    started = true;
    Music.start();
  }

  return { play, loops, begin, resume, setVolume, Music, get ctx(){ return ctx; } };
})();
