/* ============================================================
   audio.js — 全实时合成音效（无任何音频素材）
   风噪 / 低频轰鸣 / 等离子啸叫 / 开伞爆响 / 伞布拍打 / 雷 / 入水 / 心跳 / 呼吸 / 告警
   ============================================================ */
(function (glob) {
  'use strict';

  function noiseBuffer(ctx, secs, kind) {
    const len = Math.floor(ctx.sampleRate * secs);
    const b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      let last = 0, l2 = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        if (kind === 'brown') { last = (last + 0.021 * w) / 1.021; d[i] = last * 3.4; }
        else if (kind === 'pink') { l2 = (l2 + 0.13 * w) / 1.13; d[i] = (l2 * 1.6 + w * 0.35) * 0.6; }
        else d[i] = w * 0.55;
      }
    }
    return b;
  }

  function impulseBuffer(ctx, secs, decay, bright) {
    const len = Math.floor(ctx.sampleRate * secs);
    const b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const t = i / len;
        const w = Math.random() * 2 - 1;
        lp = lp + (w - lp) * bright;
        d[i] = lp * Math.pow(1 - t, decay);
      }
      // 几个早期反射
      for (let k = 0; k < 5; k++) {
        const idx = Math.floor(len * (0.01 + 0.05 * k * Math.random()));
        if (idx < len) d[idx] += (Math.random() * 2 - 1) * 0.5;
      }
    }
    return b;
  }

  function SoundEngine() {
    this.ok = false; this.muted = false;
    this.stress = 0; this.nextBeat = 0; this.nextBreath = 0; this.beatPhase = 0;
    this.nextBubble = 0; this.under = false; this.nextAlarm = 0; this.alarmLevel = 0;
    this.qn = 0; this.heat = 0;
  }
  const P = SoundEngine.prototype;

  P.init = function () {
    if (this.ok) { if (this.ctx.state === 'suspended') this.ctx.resume(); return true; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      const ctx = new AC();
      this.ctx = ctx;
      const g = () => ctx.createGain();

      this.master = g(); this.master.gain.value = 0.0;
      this.comp = ctx.createDynamicsCompressor();
      this.comp.threshold.value = -14; this.comp.knee.value = 16;
      this.comp.ratio.value = 5; this.comp.attack.value = 0.004; this.comp.release.value = 0.2;
      this.muffle = ctx.createBiquadFilter();
      this.muffle.type = 'lowpass'; this.muffle.frequency.value = 20000; this.muffle.Q.value = 0.4;
      this.master.connect(this.muffle); this.muffle.connect(this.comp); this.comp.connect(ctx.destination);

      /* 头盔混响 */
      this.verb = ctx.createConvolver();
      this.verb.buffer = impulseBuffer(ctx, 1.1, 4.0, 0.35);
      this.verbGain = g(); this.verbGain.gain.value = 0.30;
      this.verb.connect(this.verbGain); this.verbGain.connect(this.master);
      /* 远场大混响（雷 / 撞击） */
      this.bigVerb = ctx.createConvolver();
      this.bigVerb.buffer = impulseBuffer(ctx, 3.4, 2.2, 0.12);
      this.bigGain = g(); this.bigGain.gain.value = 0.55;
      this.bigVerb.connect(this.bigGain); this.bigGain.connect(this.master);

      this.white = noiseBuffer(ctx, 5, 'white');
      this.brown = noiseBuffer(ctx, 7, 'brown');
      this.pink = noiseBuffer(ctx, 5, 'pink');

      const loop = (buf, rate) => {
        const s = ctx.createBufferSource();
        s.buffer = buf; s.loop = true; s.playbackRate.value = rate || 1;
        return s;
      };
      const bq = (type, f, q) => {
        const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f;
        if (q !== undefined) b.Q.value = q; return b;
      };

      /* --- 风：低频体感层 --- */
      this.wLowG = g(); this.wLowG.gain.value = 0;
      this.wLowF = bq('lowpass', 220, 0.9);
      const wl = loop(this.brown, 1);
      wl.connect(this.wLowF); this.wLowF.connect(this.wLowG); this.wLowG.connect(this.master);
      wl.start();

      /* --- 风：中频主体 --- */
      this.wMidG = g(); this.wMidG.gain.value = 0;
      this.wMidF = bq('bandpass', 700, 0.55);
      const wm = loop(this.pink, 1);
      wm.connect(this.wMidF); this.wMidF.connect(this.wMidG);
      this.wMidG.connect(this.master); this.wMidG.connect(this.verb);
      wm.start();

      /* --- 风：高频嘶声 --- */
      this.wHiG = g(); this.wHiG.gain.value = 0;
      this.wHiF = bq('highpass', 2600, 0.7);
      const wh = loop(this.white, 1);
      wh.connect(this.wHiF); this.wHiF.connect(this.wHiG); this.wHiG.connect(this.master);
      wh.start();

      /* --- 面罩缝隙啸叫（高 Q 共振） --- */
      this.whistleG = g(); this.whistleG.gain.value = 0;
      this.whistleF = bq('bandpass', 1400, 14);
      const ws = loop(this.white, 1);
      ws.connect(this.whistleF); this.whistleF.connect(this.whistleG);
      this.whistleG.connect(this.master); this.whistleG.connect(this.verb);
      ws.start();

      /* --- 低频轰鸣 / 湍流 --- */
      this.rumG = g(); this.rumG.gain.value = 0;
      this.rumF = bq('lowpass', 70, 1.1);
      const rl = loop(this.brown, 0.6);
      rl.connect(this.rumF); this.rumF.connect(this.rumG); this.rumG.connect(this.master);
      rl.start();

      /* --- 等离子鞘 --- */
      this.plasG = g(); this.plasG.gain.value = 0;
      this.plasF = bq('bandpass', 320, 2.6);
      const sh = ctx.createWaveShaper();
      const cur = new Float32Array(1024);
      for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; cur[i] = Math.tanh(x * 3.2) * 0.8; }
      sh.curve = cur; sh.oversample = '2x';
      const pl = loop(this.white, 1);
      pl.connect(sh); sh.connect(this.plasF); this.plasF.connect(this.plasG);
      this.plasG.connect(this.master); this.plasG.connect(this.bigVerb);
      pl.start();

      /* --- 伞布拍打 --- */
      this.flapG = g(); this.flapG.gain.value = 0;
      this.flapF = bq('bandpass', 380, 1.0);
      const fl = loop(this.brown, 1.6);
      fl.connect(this.flapF); this.flapF.connect(this.flapG);
      this.flapG.connect(this.master); this.flapG.connect(this.verb);
      fl.start();
      this.flapLfo = ctx.createOscillator(); this.flapLfo.type = 'triangle'; this.flapLfo.frequency.value = 5.5;
      this.flapLfoG = g(); this.flapLfoG.gain.value = 0;
      this.flapLfo.connect(this.flapLfoG); this.flapLfoG.connect(this.flapG.gain);
      this.flapLfo.start();

      /* --- 次声（气态巨行星 / 火山） --- */
      this.infraG = g(); this.infraG.gain.value = 0;
      this.infraG.connect(this.master);
      this.infra = [];
      [28.5, 31.2, 44.7].forEach((f, i) => {
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
        const og = g(); og.gain.value = i === 2 ? 0.25 : 0.6;
        o.connect(og); og.connect(this.infraG); o.start();
        this.infra.push(o);
      });

      /* --- 环境泛音床 --- */
      this.droneG = g(); this.droneG.gain.value = 0;
      this.droneF = bq('lowpass', 520, 0.9);
      this.droneF.connect(this.droneG); this.droneG.connect(this.master);
      this.drones = [];
      for (let i = 0; i < 3; i++) {
        const o = ctx.createOscillator();
        o.type = i === 2 ? 'triangle' : 'sawtooth';
        o.frequency.value = 55;
        const og = g(); og.gain.value = 0.10;
        o.connect(og); og.connect(this.droneF); o.start();
        this.drones.push(o);
      }

      /* --- 水下气泡床 --- */
      this.bubG = g(); this.bubG.gain.value = 0; this.bubG.connect(this.master);

      this.master.gain.setTargetAtTime(0.95, ctx.currentTime, 0.6);
      this.ok = true;
      return true;
    } catch (e) {
      console.warn('audio init failed', e);
      return false;
    }
  };

  P.setMute = function (m) {
    this.muted = m;
    if (this.ok) this.master.gain.setTargetAtTime(m ? 0.0 : 0.95, this.ctx.currentTime, 0.08);
  };
  P.at = function (v, target, tc) {
    if (v) v.setTargetAtTime(target, this.ctx.currentTime, tc === undefined ? 0.12 : tc);
  };

  /* -------- 每帧更新 -------- */
  P.update = function (s, dt) {
    if (!this.ok) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const A = s.audio;
    const qn = Math.min(1, Math.pow(s.q / 5200, 0.62));   // 动压归一
    const vn = Math.min(1, s.speed / 260);
    this.qn = qn; this.heat = s.heat;
    const turb = 0.25 + 0.75 * s.turb;
    const wm = A.windMul * (s.under ? 0.12 : 1);

    this.at(this.wLowG.gain, 0.80 * Math.pow(qn, 0.5) * wm * turb, 0.10);
    this.at(this.wLowF.frequency, A.windLow + 420 * qn, 0.2);
    this.at(this.wMidG.gain, 0.42 * Math.pow(qn, 0.85) * wm, 0.10);
    this.at(this.wMidF.frequency, 330 + 2500 * vn, 0.18);
    this.at(this.wHiG.gain, 0.16 * Math.pow(qn, 1.5) * wm, 0.12);
    this.at(this.wHiF.frequency, 2200 + 3200 * vn, 0.2);
    this.at(this.whistleG.gain, 0.085 * Math.pow(Math.max(0, vn - 0.28) / 0.72, 1.6) * wm, 0.15);
    this.at(this.whistleF.frequency, 900 + 1900 * vn, 0.25);
    this.at(this.rumG.gain, A.rumble * (0.10 + 0.70 * turb) * Math.pow(qn, 0.35) * (s.under ? 0.5 : 1), 0.15);
    this.at(this.plasG.gain, 0.85 * Math.pow(s.heat, 1.25), 0.12);
    this.at(this.plasF.frequency, 200 + 1500 * s.heat * (0.85 + 0.3 * Math.sin(t * 3.1)), 0.1);
    this.at(this.infraG.gain, (A.ambience === 'infra' ? 0.55 : 0.10) * (0.35 + 0.65 * qn), 0.4);
    this.at(this.droneG.gain, 0.055 * (0.5 + 0.5 * (1 - qn)), 0.9);
    this.drones.forEach((o, i) => {
      const f = A.drone * (i === 0 ? 1 : i === 1 ? 1.005 : 1.4983);
      o.frequency.setTargetAtTime(f, t, 1.2);
    });
    this.at(this.flapG.gain, s.chute > 0 ? 0.16 * s.chute * (0.35 + 0.65 * qn) : 0, 0.15);
    this.flapLfoG.gain.value = s.chute > 0 ? 0.09 * s.chute : 0;
    this.flapLfo.frequency.value = 3.2 + 7 * qn + 3 * s.turb;
    this.at(this.muffle.frequency, s.under ? 380 : 20000, 0.4);
    this.at(this.bubG.gain, s.under ? 0.5 : 0, 0.3);
    this.at(this.verbGain.gain, s.under ? 0.05 : 0.30, 0.3);

    /* 心跳 */
    this.stress = s.stress;
    const bpm = 58 + 108 * s.stress;
    if (t > this.nextBeat) {
      const amp = 0.10 + 0.34 * s.stress;
      this.thump(48, amp, 0.16);
      setTimeout(() => { if (this.ok) this.thump(40, amp * 0.55, 0.13); }, 190);
      this.nextBeat = t + 60 / bpm;
    }
    /* 呼吸 */
    if (t > this.nextBreath && !s.dead) {
      const rate = 3.4 - 1.8 * s.stress;
      this.breath(0.5 + 0.5 * s.stress);
      this.nextBreath = t + rate;
    }
    /* 水下气泡 */
    if (s.under && t > this.nextBubble) { this.bubble(); this.nextBubble = t + 0.05 + Math.random() * 0.35; }
    /* 告警蜂鸣 */
    if (this.alarmLevel > 0 && t > this.nextAlarm) {
      this.beep(this.alarmLevel > 1 ? 1180 : 820, 0.07, this.alarmLevel > 1 ? 0.16 : 0.10);
      this.nextAlarm = t + (this.alarmLevel > 1 ? 0.34 : 0.9);
    }
  };

  P.setAlarm = function (lv) { this.alarmLevel = lv; };

  /* -------- 一次性音效 -------- */
  P.burst = function (o) {
    if (!this.ok) return;
    const ctx = this.ctx, t = ctx.currentTime + (o.delay || 0);
    const src = ctx.createBufferSource();
    src.buffer = o.buf || this.white;
    src.playbackRate.value = o.rate || 1;
    const f = ctx.createBiquadFilter();
    f.type = o.type || 'lowpass';
    f.frequency.value = o.f0 || 800; f.Q.value = o.q === undefined ? 0.8 : o.q;
    if (o.f1) { f.frequency.setValueAtTime(o.f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), t + o.dur); }
    const gn = ctx.createGain();
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.gain), t + (o.atk || 0.006));
    gn.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    src.connect(f); f.connect(gn);
    gn.connect(this.master);
    if (o.verb) { const vg = ctx.createGain(); vg.gain.value = o.verb; gn.connect(vg); vg.connect(o.big ? this.bigVerb : this.verb); }
    const off = Math.random() * 3;
    src.start(t, off, o.dur + 0.2);
    src.stop(t + o.dur + 0.25);
  };
  P.tone = function (freq, gain, dur, type, f2, delay) {
    if (!this.ok) return;
    const ctx = this.ctx, t = ctx.currentTime + (delay || 0);
    const o = ctx.createOscillator(); o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.05);
  };
  P.thump = function (f, gain, dur) { this.tone(f, gain, dur, 'sine', f * 0.55); };
  P.beep = function (f, dur, gain) { this.tone(f, gain || 0.12, dur || 0.07, 'square'); };
  P.breath = function (intensity) {
    this.burst({ buf: this.pink, type: 'bandpass', f0: 420, f1: 900, q: 1.1, gain: 0.05 + 0.09 * intensity, dur: 0.55, atk: 0.18, verb: 0.5 });
    this.burst({ buf: this.pink, type: 'bandpass', f0: 700, f1: 300, q: 1.3, gain: 0.035 + 0.07 * intensity, dur: 0.7, atk: 0.25, delay: 0.75, verb: 0.5 });
  };
  P.bubble = function () {
    const f = 380 + Math.random() * 1500;
    this.tone(f, 0.03 + Math.random() * 0.05, 0.05 + Math.random() * 0.09, 'sine', f * (1.6 + Math.random()));
  };
  P.thunder = function (dist) {
    // dist 0 近 1 远
    const d = u.clamp(dist, 0, 1);
    this.burst({ buf: this.brown, type: 'lowpass', f0: 900 - 700 * d, f1: 60, q: 0.7, gain: 0.75 * (1 - 0.55 * d), dur: 1.4 + 2.6 * d, atk: 0.004 + 0.09 * d, verb: 0.9, big: true, delay: d * 0.4 });
    if (d < 0.45) this.burst({ buf: this.white, type: 'highpass', f0: 2600, q: 0.6, gain: 0.30 * (1 - d), dur: 0.28, atk: 0.001, verb: 0.5, big: true });
  };
  P.chuteCrack = function () {
    this.burst({ buf: this.white, type: 'bandpass', f0: 2200, f1: 300, q: 0.8, gain: 0.62, dur: 0.35, atk: 0.001, verb: 0.6 });
    this.burst({ buf: this.brown, type: 'lowpass', f0: 300, f1: 70, q: 0.9, gain: 0.55, dur: 0.9, atk: 0.004, verb: 0.5, big: true });
    this.tone(140, 0.22, 0.5, 'sine', 46);
  };
  P.chuteTear = function () {
    this.burst({ buf: this.white, type: 'bandpass', f0: 3400, f1: 900, q: 0.5, gain: 0.5, dur: 0.7, atk: 0.002, verb: 0.4 });
    this.beep(240, 0.5, 0.10);
  };
  P.splash = function (v) {
    const s = u.clamp(v / 60, 0.25, 1);
    this.burst({ buf: this.white, type: 'lowpass', f0: 7000, f1: 220, q: 0.6, gain: 0.9 * s, dur: 1.1, atk: 0.002, verb: 0.7, big: true });
    this.burst({ buf: this.brown, type: 'lowpass', f0: 240, f1: 50, q: 0.8, gain: 0.85 * s, dur: 1.8, atk: 0.006, verb: 0.8, big: true });
    for (let i = 0; i < 14; i++) setTimeout(() => this.bubble(), 90 + i * 55 + Math.random() * 60);
  };
  P.impact = function (v) {
    const s = u.clamp(v / 45, 0.2, 1);
    this.burst({ buf: this.brown, type: 'lowpass', f0: 420, f1: 40, q: 0.9, gain: 1.0 * s, dur: 1.5, atk: 0.001, verb: 0.9, big: true });
    this.burst({ buf: this.white, type: 'bandpass', f0: 1800, f1: 200, q: 0.5, gain: 0.55 * s, dur: 0.5, atk: 0.001, verb: 0.6, big: true });
    this.tone(62, 0.4 * s, 1.2, 'sine', 24);
    if (s > 0.6) this.tone(3200, 0.10, 2.6, 'sine', 2400);   // 耳鸣
  };
  P.breach = function () {
    this.burst({ buf: this.white, type: 'highpass', f0: 1200, q: 0.5, gain: 0.8, dur: 2.4, atk: 0.002, verb: 0.6 });
    this.tone(90, 0.3, 1.6, 'sawtooth', 30);
    for (let i = 0; i < 5; i++) this.beep(1400 - i * 120, 0.09, 0.14);
  };
  P.machBoom = function () {
    this.burst({ buf: this.brown, type: 'lowpass', f0: 700, f1: 60, q: 0.8, gain: 0.55, dur: 0.8, atk: 0.001, verb: 0.7, big: true });
  };
  P.gust = function (str) {
    this.burst({ buf: this.brown, type: 'bandpass', f0: 180 + 300 * Math.random(), q: 0.6, gain: 0.32 * str, dur: 0.8 + Math.random(), atk: 0.15, verb: 0.4 });
  };
  P.beacon = function () {
    this.tone(1320, 0.13, 0.09, 'sine');
    this.tone(1980, 0.10, 0.13, 'sine', 2640, 0.07);
  };
  P.uiClick = function () { this.tone(660, 0.09, 0.05, 'square'); };
  P.hit = function (str) {
    this.burst({ buf: this.white, type: 'bandpass', f0: 900, f1: 180, q: 0.7, gain: 0.4 * str, dur: 0.3, atk: 0.001, verb: 0.5 });
    this.tone(110, 0.2 * str, 0.35, 'sine', 44);
  };
  P.success = function () {
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.11, 0.5, 'sine', f, i * 0.14));
  };
  P.fail = function () {
    [330, 262, 196, 147].forEach((f, i) => this.tone(f, 0.13, 0.8, 'triangle', f * 0.98, i * 0.2));
  };

  glob.SoundEngine = SoundEngine;
})(window);
