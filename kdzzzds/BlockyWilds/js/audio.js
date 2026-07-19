/* =========================================================
   audio.js — 全部程序化生成：音效 + 原创乡村风拨弦配乐
   ========================================================= */
const Audio2 = (() => {
  let ctx = null, master = null, musicBus = null, sfxBus = null;
  let started = false;

  function init() {
    if (started) return;
    started = true;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.9; sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.55; musicBus.connect(master);
  }
  const now = () => ctx ? ctx.currentTime : 0;

  /* ---------- 基础合成器 ---------- */
  function noiseBuffer(dur) {
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }
  function envGain(t0, a, d, peak, dest) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
    g.connect(dest || sfxBus);
    return g;
  }
  function burst(dur, fLo, fHi, peak, type, t0) {
    if (!ctx) return;
    t0 = t0 || now();
    const src = ctx.createBufferSource(); src.buffer = noiseBuffer(dur + 0.05);
    const f = ctx.createBiquadFilter(); f.type = type || 'bandpass';
    f.frequency.setValueAtTime(fHi, t0);
    f.frequency.exponentialRampToValueAtTime(Math.max(40, fLo), t0 + dur);
    f.Q.value = 1.2;
    const g = envGain(t0, 0.004, dur, peak);
    src.connect(f); f.connect(g);
    src.start(t0); src.stop(t0 + dur + 0.1);
  }
  function tone(freq, dur, peak, type, t0, dest, slideTo) {
    if (!ctx) return;
    t0 = t0 || now();
    const o = ctx.createOscillator(); o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    const g = envGain(t0, 0.005, dur, peak, dest);
    o.connect(g); o.start(t0); o.stop(t0 + dur + 0.1);
  }

  /* ---------- Karplus-Strong 拨弦（班卓/吉他质感） ---------- */
  function pluck(freq, dur, vol, t0, bright) {
    if (!ctx) return;
    t0 = t0 || now();
    const sr = ctx.sampleRate;
    const len = Math.floor(sr * dur);
    const buf = ctx.createBuffer(1, len, sr);
    const out = buf.getChannelData(0);
    const N = Math.max(2, Math.round(sr / freq));
    const ring = new Float32Array(N);
    for (let i = 0; i < N; i++) ring[i] = Math.random() * 2 - 1;
    const damp = bright ? 0.996 : 0.992;
    let idx = 0;
    for (let i = 0; i < len; i++) {
      const cur = ring[idx];
      const nxt = ring[(idx + 1) % N];
      ring[idx] = (cur + nxt) * 0.5 * damp;
      out[i] = cur;
      idx = (idx + 1) % N;
    }
    const src = ctx.createBufferSource(); src.buffer = buf;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(g); g.connect(musicBus);
    src.start(t0);
  }

  /* ---------- 音效库 ---------- */
  const stepMats = {
    grass: () => burst(0.09, 500, 1400, 0.16, 'bandpass'),
    dirt: () => burst(0.1, 300, 900, 0.16, 'bandpass'),
    stone: () => burst(0.07, 800, 2400, 0.13, 'bandpass'),
    sand: () => burst(0.12, 900, 2600, 0.1, 'highpass'),
    wood: () => { burst(0.06, 400, 1200, 0.14); tone(180, 0.05, 0.06, 'triangle'); },
    metal: () => { burst(0.05, 1500, 4000, 0.1); tone(520, 0.08, 0.05, 'triangle'); },
  };
  let lastStep = 0;
  const SFX = {
    step(mat) {
      if (!ctx) return;
      const t = performance.now();
      if (t - lastStep < 280) return;
      lastStep = t;
      (stepMats[mat] || stepMats.grass)();
    },
    dig(mat, prog) {
      const base = { grass: 700, dirt: 550, stone: 1600, sand: 1000, wood: 900, metal: 2200 }[mat] || 800;
      burst(0.06, base * 0.5, base * (1 + prog * 0.6), 0.14, 'bandpass');
    },
    breakBlock(mat) {
      const base = { grass: 600, dirt: 450, stone: 1200, sand: 900, wood: 700, metal: 1800 }[mat] || 700;
      burst(0.18, base * 0.3, base * 1.4, 0.3, 'bandpass');
      burst(0.24, 120, 400, 0.2, 'lowpass');
    },
    place(mat) {
      const t0 = now();
      burst(0.06, 300, 900, 0.22, 'bandpass', t0);
      tone(140, 0.08, 0.12, 'triangle', t0);
    },
    jump() { burst(0.08, 300, 800, 0.08); },
    land() { burst(0.1, 100, 500, 0.18, 'lowpass'); },
    hurt() { tone(220, 0.18, 0.22, 'sawtooth', now(), sfxBus, 110); },
    click() { tone(1400, 0.03, 0.12, 'square'); tone(900, 0.05, 0.08, 'square', now() + 0.04); },
    open() { burst(0.15, 200, 700, 0.2); tone(320, 0.12, 0.1, 'triangle', now() + 0.05, sfxBus, 420); },
    pickup() { tone(880, 0.07, 0.14, 'square'); tone(1320, 0.09, 0.12, 'square', now() + 0.07); },
    craft() { const t0 = now(); tone(520, 0.08, 0.12, 'square', t0); tone(660, 0.08, 0.12, 'square', t0 + 0.09); tone(880, 0.14, 0.14, 'square', t0 + 0.18); },
    quest() { const t0 = now(); [660, 880, 990, 1320].forEach((f, i) => tone(f, 0.16, 0.13, 'triangle', t0 + i * 0.11)); },
    translate() { const t0 = now(); for (let i = 0; i < 5; i++) tone(1000 + i * 220, 0.05, 0.07, 'sine', t0 + i * 0.07); },
    signalFound() { const t0 = now(); tone(740, 0.3, 0.12, 'sine', t0); tone(1110, 0.4, 0.1, 'sine', t0 + 0.2); },
    codes() { const t0 = now(); [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.22, 0.13, 'triangle', t0 + i * 0.13)); },
    death() { const t0 = now(); tone(330, 0.5, 0.25, 'sawtooth', t0, sfxBus, 60); burst(0.6, 60, 300, 0.25, 'lowpass', t0); },
    warp() { const t0 = now(); tone(200, 1.2, 0.15, 'sine', t0, sfxBus, 1600); burst(1.2, 400, 4000, 0.08, 'bandpass', t0); },
  };

  /* ---------- 持续声源（引擎/喷气/篝火/风） ---------- */
  function makeLoop(build) {
    let nodes = null;
    return {
      set(active, param) {
        if (!ctx) return;
        if (active && !nodes) nodes = build();
        if (nodes) nodes.update(active ? (param === undefined ? 1 : param) : 0);
        if (!active && nodes && nodes.silent && nodes.silent()) { nodes.stop(); nodes = null; }
      },
      stop() { if (nodes) { nodes.stop(); nodes = null; } },
    };
  }

  const jetLoop = makeLoop(() => {
    const src = ctx.createBufferSource(); src.buffer = noiseBuffer(1); src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 0.8;
    const g = ctx.createGain(); g.gain.value = 0;
    src.connect(f); f.connect(g); g.connect(sfxBus); src.start();
    return {
      update(v) { g.gain.setTargetAtTime(v * 0.25, now(), 0.06); f.frequency.setTargetAtTime(700 + v * 600, now(), 0.1); },
      silent() { return g.gain.value < 0.005; },
      stop() { try { src.stop(); } catch (e) {} },
    };
  });

  const engineLoop = makeLoop(() => {
    const o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 55;
    const o2 = ctx.createOscillator(); o2.type = 'square'; o2.frequency.value = 110.5;
    const src = ctx.createBufferSource(); src.buffer = noiseBuffer(1); src.loop = true;
    const nf = ctx.createBiquadFilter(); nf.type = 'lowpass'; nf.frequency.value = 400;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 200;
    const g = ctx.createGain(); g.gain.value = 0;
    o1.connect(f); o2.connect(f); src.connect(nf); nf.connect(g); f.connect(g); g.connect(sfxBus);
    o1.start(); o2.start(); src.start();
    return {
      update(v) {
        g.gain.setTargetAtTime(0.04 + v * 0.22, now(), 0.15);
        f.frequency.setTargetAtTime(150 + v * 900, now(), 0.2);
        o1.frequency.setTargetAtTime(50 + v * 40, now(), 0.3);
        nf.frequency.setTargetAtTime(300 + v * 1400, now(), 0.2);
      },
      silent() { return g.gain.value < 0.045; },
      stop() { try { o1.stop(); o2.stop(); src.stop(); } catch (e) {} },
    };
  });

  const fireLoop = makeLoop(() => {
    const src = ctx.createBufferSource(); src.buffer = noiseBuffer(2); src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
    const g = ctx.createGain(); g.gain.value = 0;
    src.connect(f); f.connect(g); g.connect(sfxBus); src.start();
    const crackle = setInterval(() => {
      if (g.gain.value > 0.01 && Math.random() < 0.6) burst(0.03, 1500, 4500, g.gain.value * 2.2, 'highpass');
    }, 220);
    return {
      update(v) { g.gain.setTargetAtTime(v * 0.12, now(), 0.3); },
      silent() { return g.gain.value < 0.005; },
      stop() { clearInterval(crackle); try { src.stop(); } catch (e) {} },
    };
  });

  const windLoop = makeLoop(() => {
    const src = ctx.createBufferSource(); src.buffer = noiseBuffer(3); src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 300; f.Q.value = 0.4;
    const g = ctx.createGain(); g.gain.value = 0;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.13;
    const lg = ctx.createGain(); lg.gain.value = 120;
    lfo.connect(lg); lg.connect(f.frequency);
    src.connect(f); f.connect(g); g.connect(sfxBus); src.start(); lfo.start();
    return {
      update(v) { g.gain.setTargetAtTime(v * 0.05, now(), 0.8); },
      silent() { return g.gain.value < 0.003; },
      stop() { try { src.stop(); lfo.stop(); } catch (e) {} },
    };
  });

  /* ---------- 超新星 ---------- */
  function supernova() {
    if (!ctx) return;
    const t0 = now();
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(30, t0);
    o.frequency.exponentialRampToValueAtTime(160, t0 + 5);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, t0);
    g.gain.exponentialRampToValueAtTime(0.5, t0 + 4);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 8);
    o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + 8.2);
    const src = ctx.createBufferSource(); src.buffer = noiseBuffer(8);
    const f = ctx.createBiquadFilter(); f.type = 'lowpass';
    f.frequency.setValueAtTime(100, t0);
    f.frequency.exponentialRampToValueAtTime(6000, t0 + 4.5);
    f.frequency.exponentialRampToValueAtTime(200, t0 + 8);
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.001, t0);
    g2.gain.exponentialRampToValueAtTime(0.65, t0 + 4.2);
    g2.gain.exponentialRampToValueAtTime(0.0001, t0 + 8);
    src.connect(f); f.connect(g2); g2.connect(master);
    src.start(t0); src.stop(t0 + 8.2);
    // 回响钟声
    [880, 660, 440].forEach((fr, i) => tone(fr, 2.5, 0.06, 'sine', t0 + 4.5 + i * 0.8, master));
  }

  /* ---------- 原创乡村风配乐（拨弦音序器） ---------- */
  // D 大调五声音阶的原创旋律主题「篝火谣」
  const NOTE = {};
  (() => {
    const names = ['C', 'Cs', 'D', 'Ds', 'E', 'F', 'Fs', 'G', 'Gs', 'A', 'As', 'B'];
    for (let oct = 2; oct <= 6; oct++) names.forEach((n, i) => {
      NOTE[n + oct] = 440 * Math.pow(2, (oct - 4) + (i - 9) / 12);
    });
  })();
  // 和弦进行: D - G - Bm - A （原创谱写）
  const CHORDS = [
    ['D3', 'A3', 'D4', 'Fs4'], ['G2', 'D3', 'G3', 'B3'],
    ['B2', 'Fs3', 'B3', 'D4'], ['A2', 'E3', 'A3', 'Cs4'],
  ];
  const MELODY = [ // [拍位, 音名, 时值权重] 每小节4拍 × 4小节，原创五声旋律
    [0, 'A4'], [1, 'B4'], [1.5, 'D5'], [2.5, 'A4'], [3, 'Fs4'],
    [4, 'G4'], [5, 'B4'], [6, 'D5'], [6.5, 'B4'], [7, 'G4'],
    [8, 'Fs4'], [8.5, 'D4'], [9, 'Fs4'], [10, 'B4'], [11, 'A4'],
    [12, 'E4'], [13, 'Fs4'], [13.5, 'A4'], [14, 'D4'], [15, null],
  ];
  const MELODY_B = [
    [0, 'D5'], [1, 'E5'], [1.5, 'D5'], [2, 'B4'], [3, 'A4'],
    [4, 'B4'], [4.5, 'D5'], [5, 'G4'], [6, 'B4'], [7, null],
    [8, 'A4'], [8.5, 'Fs4'], [9, 'D4'], [10, 'Fs4'], [11, 'A4'],
    [12, 'E4'], [13, 'D4'], [14, 'D4'], [15, null],
  ];
  let musicTimer = null, musicMode = null, barCount = 0;

  function scheduleBar(mode) {
    if (!ctx) return;
    const bpm = mode === 'space' ? 54 : 88;
    const beat = 60 / bpm;
    const t0 = now() + 0.08;
    const barLen = beat * 16;
    if (mode === 'camp' || mode === 'menu') {
      // 拨弦分解和弦 + 主旋律
      for (let bar = 0; bar < 4; bar++) {
        const ch = CHORDS[bar];
        for (let b = 0; b < 4; b++) {
          const t = t0 + (bar * 4 + b) * beat;
          pluck(NOTE[ch[0]], 1.6, 0.16, t, false); // 低音
          if (b % 2 === 1) pluck(NOTE[ch[1 + (b >> 1)]], 0.9, 0.09, t + beat * 0.5, true);
          pluck(NOTE[ch[2]], 0.7, 0.06, t + beat * 0.25, true);
        }
      }
      const mel = (barCount % 4 < 2) ? MELODY : MELODY_B;
      for (const [pos, n] of mel) {
        if (!n) continue;
        pluck(NOTE[n] * 2, 1.1, 0.11, t0 + pos * beat, true);
      }
      barCount++;
      musicTimer = setTimeout(() => scheduleBar(musicMode), barLen * 1000 - 60);
    } else if (mode === 'space') {
      // 太空氛围：缓慢正弦垫 + 偶发泛音拨弦
      const pads = [['D3', 'A3', 'D4'], ['G2', 'D3', 'B3'], ['B2', 'Fs3', 'D4'], ['A2', 'E3', 'A3']][barCount % 4];
      pads.forEach((n, i) => {
        const t = t0 + i * 0.4;
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = NOTE[n];
        const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = NOTE[n] * 1.005;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.035, t + 2.5);
        g.gain.linearRampToValueAtTime(0.0001, t + beat * 16);
        o.connect(g); o2.connect(g); g.connect(musicBus);
        o.start(t); o2.start(t); o.stop(t + beat * 16 + 0.1); o2.stop(t + beat * 16 + 0.1);
      });
      if (barCount % 2 === 1) {
        const mel = MELODY.filter((m, i) => i % 3 === 0);
        for (const [pos, n] of mel) if (n) pluck(NOTE[n] * 2, 2.2, 0.05, t0 + pos * beat * 0.5, true);
      }
      barCount++;
      musicTimer = setTimeout(() => scheduleBar(musicMode), beat * 16 * 1000 - 60);
    } else if (mode === 'danger') {
      // 末日临近：低音脉冲
      for (let b = 0; b < 8; b++) {
        const t = t0 + b * beat;
        tone(NOTE['D2'], 0.5, 0.12, 'sine', t, musicBus);
        if (b % 2 === 0) tone(NOTE['Ds2'], 0.4, 0.07, 'sine', t + beat * 0.5, musicBus);
      }
      barCount++;
      musicTimer = setTimeout(() => scheduleBar(musicMode), beat * 8 * 1000 - 60);
    }
  }

  function playMusic(mode) {
    if (!ctx || musicMode === mode) return;
    stopMusic();
    musicMode = mode; barCount = 0;
    if (mode) scheduleBar(mode);
  }
  function stopMusic() {
    if (musicTimer) clearTimeout(musicTimer);
    musicTimer = null; musicMode = null;
  }

  return {
    init, SFX, supernova, playMusic, stopMusic,
    jet: (a, v) => jetLoop.set(a, v),
    engine: (a, v) => engineLoop.set(a, v),
    fire: (a, v) => fireLoop.set(a, v),
    wind: (a, v) => windLoop.set(a, v),
    stopLoops() { jetLoop.stop(); engineLoop.stop(); fireLoop.stop(); windLoop.stop(); },
    get ctx() { return ctx; },
  };
})();
