/* ===================================================================
   audio.js — 全程序化音频（无任何外部音源文件）
   WebAudio 合成：剑风、砍中血肉、骨裂、怪物咆哮、地牢环境低鸣…
   用法： G.Audio.init() -> G.Audio.play('hitFlesh', {x,z,vol,pitch})
   位置音效需要 G.Audio.setListener(x,z,yaw)
   =================================================================== */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const U = G.U;

  const A = {
    ctx: null,
    master: null,
    busSfx: null,
    busAmb: null,
    verb: null,
    ready: false,
    muted: false,
    noise: null,       // 白噪声 buffer
    lis: { x: 0, z: 0, yaw: 0 },
    _budget: 0,
    _budgetT: 0,
    _ambNodes: [],
    _lowpassAmt: 0,    // 狂气/受伤时的闷响
  };

  /* --------------------------- 初始化 --------------------------- */
  A.init = function () {
    if (A.ctx) { A.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = A.ctx = new AC();

    A.master = ctx.createGain();
    A.master.gain.value = 0.85;

    // 轻压缩，避免血肉横飞时爆音
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 12;
    comp.ratio.value = 5; comp.attack.value = 0.004; comp.release.value = 0.18;

    A.master.connect(comp);
    comp.connect(ctx.destination);

    // 地牢混响（程序生成脉冲响应）
    A.verb = ctx.createConvolver();
    A.verb.buffer = makeIR(ctx, 1.9, 2.6);
    const verbGain = ctx.createGain();
    verbGain.gain.value = 0.34;
    A.verb.connect(verbGain);
    verbGain.connect(A.master);

    A.busSfx = ctx.createGain(); A.busSfx.gain.value = 1.0;
    A.busSfx.connect(A.master);
    A.busSfx.connect(A.verb);

    A.busAmb = ctx.createGain(); A.busAmb.gain.value = 0.0;
    A.busAmb.connect(A.master);

    // 白噪声
    const n = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = n.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + w * 0.6) * 0.72;      // 略微染色，别那么刺耳
      d[i] = U.clamp(w * 0.55 + last * 0.9, -1, 1);
    }
    A.noise = n;
    A.ready = true;
  };

  A.resume = function () { if (A.ctx && A.ctx.state === 'suspended') A.ctx.resume(); };
  A.setMuted = function (m) { A.muted = m; if (A.master) A.master.gain.value = m ? 0 : 0.85; };
  A.setListener = function (x, z, yaw) { A.lis.x = x; A.lis.z = z; A.lis.yaw = yaw; };

  function makeIR(ctx, seconds, decay) {
    const rate = ctx.sampleRate, len = (rate * seconds) | 0;
    const buf = ctx.createBuffer(2, len, rate);
    for (let c = 0; c < 2; c++) {
      const ch = buf.getChannelData(c);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        // 早期反射 + 指数衰减噪声 → 石室感
        let v = (Math.random() * 2 - 1) * Math.pow(1 - t, decay);
        if (i < rate * 0.09 && Math.random() < 0.02) v += (Math.random() * 2 - 1) * 0.6;
        ch[i] = v * 0.7;
      }
    }
    return buf;
  }

  /* --------------------------- 内部构件 --------------------------- */
  function tNow() { return A.ctx.currentTime; }

  // 位置 → {gain, pan}
  function spatial(o) {
    if (!o || o.x === undefined) return { g: 1, p: 0 };
    const dx = o.x - A.lis.x, dz = o.z - A.lis.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    const g = 1 / (1 + d * d * 0.055);
    // 相对听者朝向的左右
    const c = Math.cos(-A.lis.yaw), s = Math.sin(-A.lis.yaw);
    const rx = dx * c - dz * s;
    const p = U.clamp(rx / (d + 0.6), -0.92, 0.92);
    return { g: g, p: p };
  }

  function chain(o, vol) {
    const ctx = A.ctx;
    const sp = spatial(o);
    const g = ctx.createGain();
    g.gain.value = Math.max(0, (vol === undefined ? 1 : vol) * sp.g * ((o && o.vol) || 1));
    let out = g;
    if (ctx.createStereoPanner) {
      const pan = ctx.createStereoPanner();
      pan.pan.value = sp.p;
      g.connect(pan); out = pan;
    }
    out.connect(A.busSfx);
    return g;
  }

  // 噪声源：dur 秒，带通/低通扫频
  function noiseBurst(opt) {
    const ctx = A.ctx, t = tNow();
    const src = ctx.createBufferSource();
    src.buffer = A.noise;
    src.loop = true;
    src.playbackRate.value = opt.rate || 1;
    const f = ctx.createBiquadFilter();
    f.type = opt.filter || 'bandpass';
    f.Q.value = opt.q === undefined ? 1.2 : opt.q;
    f.frequency.setValueAtTime(Math.max(40, opt.f0), t);
    f.frequency.exponentialRampToValueAtTime(Math.max(40, opt.f1 || opt.f0), t + opt.dur);
    const env = ctx.createGain();
    const peak = opt.gain === undefined ? 0.5 : opt.gain;
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(peak, t + (opt.atk === undefined ? 0.006 : opt.atk));
    env.gain.exponentialRampToValueAtTime(0.0001, t + opt.dur);
    src.connect(f); f.connect(env);
    env.connect(opt.dest);
    src.start(t);
    src.stop(t + opt.dur + 0.03);
    return env;
  }

  function tone(opt) {
    const ctx = A.ctx, t = tNow() + (opt.delay || 0);
    const o = ctx.createOscillator();
    o.type = opt.type || 'sine';
    o.frequency.setValueAtTime(opt.f0, t);
    if (opt.f1 && opt.f1 !== opt.f0) {
      if (opt.linear) o.frequency.linearRampToValueAtTime(Math.max(1, opt.f1), t + opt.dur);
      else o.frequency.exponentialRampToValueAtTime(Math.max(1, opt.f1), t + opt.dur);
    }
    if (opt.detune) o.detune.value = opt.detune;
    const env = ctx.createGain();
    const peak = opt.gain === undefined ? 0.3 : opt.gain;
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(peak, t + (opt.atk === undefined ? 0.005 : opt.atk));
    env.gain.exponentialRampToValueAtTime(0.0001, t + opt.dur);
    let node = o;
    if (opt.lp) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = opt.lp;
      o.connect(f); node = f;
    }
    node.connect(env);
    env.connect(opt.dest);
    o.start(t); o.stop(t + opt.dur + 0.03);
    return env;
  }

  /* --------------------------- 音效表 --------------------------- */
  const SFX = {
    // 巨剑横扫：低沉沉重的风声
    swing(dest, o) {
      const p = (o && o.pitch) || 1;
      noiseBurst({ dest, dur: 0.34, f0: 260 * p, f1: 1500 * p, q: 0.7, gain: 0.30, atk: 0.05 });
      noiseBurst({ dest, dur: 0.26, f0: 1400 * p, f1: 180 * p, q: 1.6, gain: 0.16, atk: 0.02 });
      tone({ dest, type: 'sine', f0: 120 * p, f1: 52 * p, dur: 0.22, gain: 0.10 });
    },
    swingHeavy(dest) {
      noiseBurst({ dest, dur: 0.58, f0: 150, f1: 900, q: 0.6, gain: 0.42, atk: 0.14 });
      noiseBurst({ dest, dur: 0.34, f0: 900, f1: 90, q: 2.0, gain: 0.22, atk: 0.03 });
      tone({ dest, type: 'sine', f0: 90, f1: 34, dur: 0.5, gain: 0.20 });
    },
    charge(dest) {
      tone({ dest, type: 'sawtooth', f0: 40, f1: 190, dur: 0.85, gain: 0.06, lp: 700, atk: 0.3 });
      noiseBurst({ dest, dur: 0.85, f0: 300, f1: 2600, q: 3.5, gain: 0.07, atk: 0.4 });
    },
    // 砍中血肉：湿、闷、带碎裂
    hitFlesh(dest, o) {
      const p = (o && o.pitch) || 1;
      noiseBurst({ dest, dur: 0.17, f0: 900 * p, f1: 120, q: 0.9, gain: 0.55, atk: 0.002 });
      tone({ dest, type: 'sine', f0: 150 * p, f1: 44, dur: 0.20, gain: 0.42 });
      tone({ dest, type: 'triangle', f0: 320 * p, f1: 70, dur: 0.09, gain: 0.16 });
    },
    hitCrit(dest) {
      noiseBurst({ dest, dur: 0.30, f0: 1500, f1: 90, q: 0.7, gain: 0.7, atk: 0.001 });
      tone({ dest, type: 'sine', f0: 110, f1: 30, dur: 0.42, gain: 0.6 });
      noiseBurst({ dest, dur: 0.12, f0: 3600, f1: 1800, q: 4, gain: 0.22, atk: 0.001 });
    },
    // 尸块爆开
    gib(dest) {
      noiseBurst({ dest, dur: 0.42, f0: 420, f1: 70, q: 0.5, gain: 0.72, atk: 0.001 });
      tone({ dest, type: 'sine', f0: 96, f1: 26, dur: 0.5, gain: 0.62 });
      for (let i = 0; i < 4; i++)
        noiseBurst({ dest, dur: 0.07, f0: 2200 + Math.random() * 2600, f1: 700, q: 6, gain: 0.14, atk: 0.001 });
    },
    bone(dest) {
      for (let i = 0; i < 3; i++)
        noiseBurst({ dest, dur: 0.05 + Math.random() * 0.05, f0: 2600 + Math.random() * 2400, f1: 900, q: 9, gain: 0.2, atk: 0.001 });
    },
    // 砍在墙上：铁与石
    hitWall(dest) {
      noiseBurst({ dest, dur: 0.2, f0: 5200, f1: 1400, q: 3, gain: 0.3, atk: 0.001 });
      tone({ dest, type: 'triangle', f0: 1600, f1: 420, dur: 0.16, gain: 0.16 });
      tone({ dest, type: 'sine', f0: 130, f1: 60, dur: 0.2, gain: 0.2 });
    },
    parry(dest) {
      tone({ dest, type: 'square', f0: 2400, f1: 900, dur: 0.22, gain: 0.16, lp: 5200 });
      noiseBurst({ dest, dur: 0.3, f0: 6000, f1: 2200, q: 2, gain: 0.24, atk: 0.001 });
    },
    // 怪物
    growl(dest, o) {
      const p = (o && o.pitch) || 1;
      tone({ dest, type: 'sawtooth', f0: 92 * p, f1: 62 * p, dur: 0.6, gain: 0.16, lp: 620 });
      tone({ dest, type: 'sawtooth', f0: 71 * p, f1: 48 * p, dur: 0.7, gain: 0.13, lp: 400, detune: 22 });
      noiseBurst({ dest, dur: 0.55, f0: 300 * p, f1: 130 * p, q: 1.4, gain: 0.10, atk: 0.1 });
    },
    scream(dest, o) {
      const p = (o && o.pitch) || 1;
      tone({ dest, type: 'sawtooth', f0: 420 * p, f1: 105 * p, dur: 0.72, gain: 0.17, lp: 2600 });
      tone({ dest, type: 'square', f0: 634 * p, f1: 150 * p, dur: 0.6, gain: 0.07, lp: 2200, detune: -18 });
      noiseBurst({ dest, dur: 0.6, f0: 1500 * p, f1: 300, q: 1.1, gain: 0.16, atk: 0.02 });
    },
    hurtEnemy(dest, o) {
      const p = (o && o.pitch) || 1;
      tone({ dest, type: 'sawtooth', f0: 260 * p, f1: 120 * p, dur: 0.2, gain: 0.13, lp: 1800 });
      noiseBurst({ dest, dur: 0.16, f0: 700, f1: 200, q: 1, gain: 0.12, atk: 0.005 });
    },
    bossRoar(dest) {
      tone({ dest, type: 'sawtooth', f0: 62, f1: 38, dur: 2.2, gain: 0.3, lp: 380, atk: 0.35 });
      tone({ dest, type: 'sawtooth', f0: 47, f1: 29, dur: 2.4, gain: 0.26, lp: 260, detune: 30, atk: 0.5 });
      tone({ dest, type: 'square', f0: 150, f1: 74, dur: 1.6, gain: 0.06, lp: 700, atk: 0.4 });
      noiseBurst({ dest, dur: 2.2, f0: 220, f1: 90, q: 0.8, gain: 0.16, atk: 0.6 });
    },
    // 玩家
    hurt(dest) {
      noiseBurst({ dest, dur: 0.3, f0: 700, f1: 120, q: 0.7, gain: 0.4, atk: 0.002 });
      tone({ dest, type: 'sine', f0: 190, f1: 62, dur: 0.35, gain: 0.3 });
      tone({ dest, type: 'sawtooth', f0: 240, f1: 130, dur: 0.24, gain: 0.09, lp: 900 });
    },
    dash(dest) {
      noiseBurst({ dest, dur: 0.3, f0: 420, f1: 2400, q: 0.9, gain: 0.2, atk: 0.03 });
    },
    jump(dest) { noiseBurst({ dest, dur: 0.16, f0: 320, f1: 1200, q: 1.2, gain: 0.1, atk: 0.02 }); },
    land(dest, o) {
      tone({ dest, type: 'sine', f0: 110, f1: 40, dur: 0.16, gain: 0.22 });
      noiseBurst({ dest, dur: 0.12, f0: 500, f1: 120, q: 1, gain: 0.14, atk: 0.002 });
    },
    step(dest, o) {
      const p = 0.85 + Math.random() * 0.4;
      noiseBurst({ dest, dur: 0.09, f0: 380 * p, f1: 110, q: 1.4, gain: 0.10, atk: 0.002 });
      tone({ dest, type: 'sine', f0: 96 * p, f1: 52, dur: 0.09, gain: 0.07 });
    },
    stepBlood(dest) {
      noiseBurst({ dest, dur: 0.14, f0: 900, f1: 250, q: 1.8, gain: 0.13, atk: 0.004 });
    },
    heart(dest) {
      tone({ dest, type: 'sine', f0: 62, f1: 34, dur: 0.2, gain: 0.5 });
      tone({ dest, type: 'sine', f0: 58, f1: 30, dur: 0.24, gain: 0.34, delay: 0.24 });
    },
    // 物品 / UI
    pickup(dest) {
      tone({ dest, type: 'triangle', f0: 880, f1: 1320, dur: 0.14, gain: 0.14 });
      tone({ dest, type: 'sine', f0: 1320, f1: 1760, dur: 0.22, gain: 0.09, delay: 0.06 });
    },
    soul(dest) {
      tone({ dest, type: 'sine', f0: 1500 + Math.random() * 500, f1: 2400, dur: 0.12, gain: 0.05 });
    },
    heal(dest) {
      tone({ dest, type: 'sine', f0: 420, f1: 700, dur: 0.5, gain: 0.12, atk: 0.05 });
      tone({ dest, type: 'sine', f0: 630, f1: 1050, dur: 0.6, gain: 0.07, atk: 0.12 });
    },
    relic(dest) {
      [130, 196, 261, 392].forEach((f, i) =>
        tone({ dest, type: 'sine', f0: f, f1: f * 1.005, dur: 2.2, gain: 0.11, atk: 0.5, delay: i * 0.09 }));
      noiseBurst({ dest, dur: 1.6, f0: 2200, f1: 600, q: 2, gain: 0.05, atk: 0.6 });
    },
    portal(dest) {
      tone({ dest, type: 'sawtooth', f0: 55, f1: 220, dur: 2.0, gain: 0.1, lp: 900, atk: 0.7 });
      noiseBurst({ dest, dur: 2.0, f0: 200, f1: 3000, q: 2.5, gain: 0.1, atk: 0.9 });
    },
    doorSeal(dest) {
      tone({ dest, type: 'sine', f0: 140, f1: 40, dur: 1.0, gain: 0.3, atk: 0.02 });
      noiseBurst({ dest, dur: 0.9, f0: 700, f1: 90, q: 0.8, gain: 0.26, atk: 0.01 });
    },
    berserk(dest) {
      tone({ dest, type: 'sawtooth', f0: 70, f1: 210, dur: 1.4, gain: 0.26, lp: 1600, atk: 0.06 });
      tone({ dest, type: 'square', f0: 105, f1: 315, dur: 1.2, gain: 0.1, lp: 900, atk: 0.1 });
      noiseBurst({ dest, dur: 1.5, f0: 400, f1: 2800, q: 1.2, gain: 0.24, atk: 0.05 });
    },
    ui(dest) { tone({ dest, type: 'square', f0: 620, f1: 460, dur: 0.06, gain: 0.05, lp: 2600 }); },
    uiBig(dest) {
      tone({ dest, type: 'triangle', f0: 220, f1: 110, dur: 0.4, gain: 0.14 });
      noiseBurst({ dest, dur: 0.35, f0: 1200, f1: 200, q: 1.5, gain: 0.1, atk: 0.004 });
    },
    death(dest) {
      tone({ dest, type: 'sawtooth', f0: 130, f1: 24, dur: 3.0, gain: 0.24, lp: 500, atk: 0.1 });
      tone({ dest, type: 'sine', f0: 66, f1: 20, dur: 3.4, gain: 0.3, atk: 0.2 });
      noiseBurst({ dest, dur: 2.6, f0: 800, f1: 60, q: 0.8, gain: 0.18, atk: 0.05 });
    },
    victory(dest) {
      [261, 329, 392, 523].forEach((f, i) =>
        tone({ dest, type: 'triangle', f0: f, f1: f, dur: 2.4 - i * 0.2, gain: 0.11, atk: 0.15, delay: i * 0.22 }));
    },
  };

  /* --------------------------- 对外接口 --------------------------- */
  A.play = function (name, o) {
    if (!A.ready || A.muted || !SFX[name]) return;
    // 声音预算：每 60ms 最多 14 个新声音，避免血肉横飞时炸掉
    const t = U.now();
    if (t - A._budgetT > 60) { A._budgetT = t; A._budget = 0; }
    if (A._budget++ > 14) return;
    try {
      const dest = chain(o, 1);
      SFX[name](dest, o);
    } catch (e) { /* 音频失败不该影响游戏 */ }
  };

  // 环境音：低鸣 + 随机远处哀嚎
  A.startAmbience = function (intensity) {
    if (!A.ready) return;
    A.stopAmbience();
    const ctx = A.ctx, t = tNow();
    A.busAmb.gain.cancelScheduledValues(t);
    A.busAmb.gain.setValueAtTime(0.0001, t);
    A.busAmb.gain.linearRampToValueAtTime(0.5, t + 3);

    const mk = (f, type, g, det) => {
      const o = ctx.createOscillator();
      o.type = type; o.frequency.value = f; if (det) o.detune.value = det;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260;
      const gn = ctx.createGain(); gn.gain.value = g;
      // 缓慢起伏
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.05 + Math.random() * 0.08;
      const lg = ctx.createGain(); lg.gain.value = g * 0.55;
      lfo.connect(lg); lg.connect(gn.gain);
      o.connect(lp); lp.connect(gn); gn.connect(A.busAmb);
      o.start(); lfo.start();
      A._ambNodes.push(o, lfo);
    };
    const base = 38 + (intensity || 0) * 3;
    mk(base, 'sawtooth', 0.07);
    mk(base * 1.5, 'sine', 0.05, 8);
    mk(base * 0.5, 'sine', 0.09, -6);

    // 远处的哀嚎
    A._ambTimer = setInterval(() => {
      if (!A.ready || A.muted) return;
      if (Math.random() < 0.4) {
        const dest = A.busAmb;
        const p = 0.5 + Math.random() * 0.5;
        tone({ dest, type: 'sawtooth', f0: 180 * p, f1: 90 * p, dur: 2.4, gain: 0.05, lp: 520, atk: 0.9 });
      }
    }, 7000);
  };
  A.stopAmbience = function () {
    if (A._ambTimer) { clearInterval(A._ambTimer); A._ambTimer = null; }
    A._ambNodes.forEach(n => { try { n.stop(); } catch (e) { } });
    A._ambNodes = [];
    if (A.busAmb) A.busAmb.gain.value = 0.0001;
  };

  // 狂气状态：整体闷+失真的听感（用简单的低通+增益模拟）
  A.setBerserk = function (on) {
    if (!A.ready) return;
    const t = tNow();
    A.busSfx.gain.cancelScheduledValues(t);
    A.busSfx.gain.linearRampToValueAtTime(on ? 1.25 : 1.0, t + 0.4);
    if (A.busAmb) A.busAmb.gain.linearRampToValueAtTime(on ? 1.0 : 0.5, t + 0.4);
  };

  G.Audio = A;
})();
