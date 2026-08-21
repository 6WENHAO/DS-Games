/* ============ 声音：全部用 WebAudio 合成，无外部资源 ============ */
(function (D) {
  "use strict";

  var ctx = null, master = null, noiseBuf = null;
  var enabled = true, rainGain = null, rainSrc = null, windGain = null, windSrc = null;
  var lastStep = 0;

  function makeNoise() {
    var n = Math.floor(ctx.sampleRate * 2);
    noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  }

  function init() {
    if (ctx) return ctx;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.6;
      master.connect(ctx.destination);
      makeNoise();
      startLoops();
    } catch (e) { ctx = null; }
    return ctx;
  }

  function startLoops() {
    try {
      rainSrc = ctx.createBufferSource(); rainSrc.buffer = noiseBuf; rainSrc.loop = true;
      var lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2400;
      rainGain = ctx.createGain(); rainGain.gain.value = 0;
      rainSrc.connect(lp); lp.connect(rainGain); rainGain.connect(master); rainSrc.start();

      windSrc = ctx.createBufferSource(); windSrc.buffer = noiseBuf; windSrc.loop = true;
      var lp2 = ctx.createBiquadFilter(); lp2.type = "lowpass"; lp2.frequency.value = 420;
      windGain = ctx.createGain(); windGain.gain.value = 0.03;
      windSrc.connect(lp2); lp2.connect(windGain); windGain.connect(master); windSrc.start();
    } catch (e) { /* ignore */ }
  }

  function resume() {
    if (!ctx) init();
    if (ctx && ctx.state === "suspended") { try { ctx.resume(); } catch (e) {} }
  }

  function ok() { return enabled && ctx && ctx.state !== "suspended"; }

  function env(node, gain, attack, decay) {
    var g = ctx.createGain();
    var t = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    node.connect(g); g.connect(master);
    return { g: g, stop: t + attack + decay + 0.02 };
  }

  function tone(type, f0, f1, gain, attack, decay, detune) {
    if (!ok()) return;
    try {
      var o = ctx.createOscillator();
      o.type = type;
      var t = ctx.currentTime;
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + attack + decay);
      if (detune) o.detune.value = detune;
      var e = env(o, gain, attack, decay);
      o.start(t); o.stop(e.stop);
    } catch (e) {}
  }

  function noise(gain, attack, decay, type, freq, q) {
    if (!ok()) return;
    try {
      var s = ctx.createBufferSource();
      s.buffer = noiseBuf;
      s.playbackRate.value = 0.8 + Math.random() * 0.5;
      var f = ctx.createBiquadFilter();
      f.type = type || "bandpass"; f.frequency.value = freq || 900; f.Q.value = q || 1;
      s.connect(f);
      var e = env(f, gain, attack, decay);
      s.start(ctx.currentTime); s.stop(e.stop);
    } catch (e) {}
  }

  var A = {
    init: init,
    resume: resume,
    setEnabled: function (v) { enabled = !!v; if (enabled) resume(); if (windGain) windGain.gain.value = enabled ? 0.03 : 0; },
    isEnabled: function () { return enabled; },
    bite: function (size) {
      noise(0.24, 0.005, 0.12, "bandpass", 500 / (size || 1), 1.2);
      tone("triangle", 180 / (size || 1), 60, 0.14, 0.005, 0.14);
    },
    chomp: function () { noise(0.16, 0.01, 0.16, "lowpass", 700, 0.8); },
    roar: function (size) {
      if (!ok()) return;
      size = size || 1;
      var base = 150 / Math.pow(size, 0.7);
      tone("sawtooth", base * 1.5, base * 0.6, 0.3, 0.09, 0.75);
      tone("square", base * 0.75, base * 0.4, 0.16, 0.12, 0.8, 12);
      noise(0.1, 0.08, 0.7, "lowpass", 900, 0.7);
    },
    hurt: function () { tone("square", 420, 120, 0.16, 0.005, 0.2); noise(0.12, 0.005, 0.14, "highpass", 1600, 0.6); },
    die: function () { tone("sawtooth", 260, 50, 0.22, 0.04, 1.0); },
    drink: function () { tone("sine", 620 + Math.random() * 250, 300, 0.09, 0.01, 0.12); },
    eat: function () { noise(0.14, 0.01, 0.13, "lowpass", 520, 0.9); },
    level: function () {
      tone("triangle", 520, 520, 0.18, 0.02, 0.22);
      setTimeout(function () { tone("triangle", 780, 780, 0.18, 0.02, 0.3); }, 110);
      setTimeout(function () { tone("triangle", 1040, 1040, 0.14, 0.02, 0.4); }, 220);
    },
    egg: function () { tone("sine", 900, 1500, 0.12, 0.02, 0.2); },
    hatch: function () { tone("square", 700, 1200, 0.1, 0.02, 0.18); setTimeout(function () { tone("square", 1100, 900, 0.1, 0.02, 0.2); }, 90); },
    blip: function () { tone("sine", 800, 800, 0.07, 0.005, 0.06); },
    thunder: function () {
      noise(0.42, 0.02, 1.7, "lowpass", 380, 0.6);
      tone("sine", 70, 30, 0.2, 0.05, 1.4);
    },
    boom: function () { noise(0.4, 0.01, 0.9, "lowpass", 300, 0.5); tone("sine", 110, 34, 0.24, 0.02, 0.8); },
    step: function (t, size) {
      if (!ok() || t - lastStep < 0.12) return;
      lastStep = t;
      noise(0.05 * (size || 1), 0.004, 0.07, "lowpass", 260, 0.8);
    },
    splash: function () { noise(0.16, 0.01, 0.25, "highpass", 1200, 0.5); },
    breath: function (kind) {
      if (!ok()) return;
      if (kind === "fire") {
        noise(0.3, 0.06, 0.55, "lowpass", 1100, 0.7);
        tone("sawtooth", 220, 90, 0.12, 0.05, 0.5);
      } else if (kind === "frost") {
        noise(0.22, 0.05, 0.5, "highpass", 2600, 0.6);
        tone("sine", 1200, 420, 0.08, 0.04, 0.45);
      } else if (kind === "bolt") {
        noise(0.3, 0.005, 0.22, "bandpass", 2400, 0.9);
        tone("square", 900, 180, 0.14, 0.005, 0.28);
      } else {
        noise(0.34, 0.02, 0.6, "lowpass", 240, 0.6);
        tone("sine", 90, 38, 0.22, 0.03, 0.55);
      }
    },
    throwSpear: function (isFire) {
      if (isFire) { noise(0.16, 0.02, 0.28, "lowpass", 1400, 0.7); tone("sawtooth", 420, 260, 0.08, 0.02, 0.25); }
      else noise(0.12, 0.005, 0.16, "highpass", 1800, 0.7);
    },
    heal: function () { tone("sine", 660, 990, 0.1, 0.03, 0.3); },
    blink: function () { tone("triangle", 1400, 300, 0.1, 0.01, 0.22); noise(0.1, 0.01, 0.2, "highpass", 2200, 0.6); },
    magic: function () { tone("sine", 520, 1300, 0.1, 0.04, 0.35); },
    setRain: function (v) {
      if (!rainGain) return;
      var g = enabled ? Math.min(0.16, v * 0.16) : 0;
      try { rainGain.gain.setTargetAtTime(g, ctx.currentTime, 0.6); } catch (e) { rainGain.gain.value = g; }
    },
    setWind: function (v) {
      if (!windGain) return;
      var g = enabled ? 0.02 + v * 0.05 : 0;
      try { windGain.gain.setTargetAtTime(g, ctx.currentTime, 0.8); } catch (e) { windGain.gain.value = g; }
    }
  };

  D.Audio = A;
})(window.DINO);
