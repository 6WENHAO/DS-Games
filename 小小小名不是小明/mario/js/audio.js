// audio.js - Web Audio 合成音效（全部程序生成，非原版音频采样）
(function () {
  "use strict";

  var ctx = null;
  var muted = false;
  var musicTimer = null;
  var musicOn = false;

  function ac() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function beep(type, freq, dur, vol, slide, delay) {
    var c = ac();
    if (!c || muted) return;
    var t0 = c.currentTime + (delay || 0);
    var o = c.createOscillator();
    var g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g);
    g.connect(c.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  function noise(dur, vol, delay) {
    var c = ac();
    if (!c || muted) return;
    var t0 = c.currentTime + (delay || 0);
    var len = Math.floor(c.sampleRate * dur);
    var buf = c.createBuffer(1, len, c.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = c.createBufferSource();
    var g = c.createGain();
    src.buffer = buf;
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(g);
    g.connect(c.destination);
    src.start(t0);
  }

  var SFX = {
    jumpSmall: function () { beep("square", 320, 0.18, 0.12, 340); },
    jumpBig: function () { beep("square", 210, 0.22, 0.13, 300); },
    stomp: function () { beep("square", 300, 0.1, 0.12, -180); noise(0.06, 0.06); },
    bump: function () { beep("square", 110, 0.08, 0.12, -30); },
    breakBlock: function () { noise(0.18, 0.16); beep("square", 90, 0.12, 0.1, -40); },
    coin: function () { beep("square", 988, 0.08, 0.12); beep("square", 1319, 0.35, 0.12, 0, 0.08); },
    powerupAppear: function () {
      var seq = [523, 659, 784, 1047, 880, 988];
      for (var i = 0; i < seq.length; i++) beep("square", seq[i], 0.07, 0.1, 0, i * 0.055);
    },
    powerup: function () {
      var seq = [392, 523, 659, 784, 1047, 1319];
      for (var i = 0; i < seq.length; i++) beep("square", seq[i], 0.08, 0.11, 0, i * 0.06);
    },
    pipe: function () { beep("square", 500, 0.3, 0.13, -420); },
    fireball: function () { beep("square", 700, 0.09, 0.09, -500); },
    kick: function () { beep("square", 520, 0.09, 0.12, 200); },
    oneUp: function () {
      var seq = [660, 784, 1320, 1056, 1188, 1584];
      for (var i = 0; i < seq.length; i++) beep("square", seq[i], 0.09, 0.11, 0, i * 0.08);
    },
    die: function () {
      stopMusic();
      var seq = [494, 523, 587, 0, 494, 0, 392, 330, 262];
      for (var i = 0; i < seq.length; i++) if (seq[i]) beep("square", seq[i], 0.12, 0.12, 0, 0.15 + i * 0.12);
    },
    flagpole: function () {
      var seq = [392, 440, 494, 523, 587, 659, 740, 784];
      for (var i = 0; i < seq.length; i++) beep("square", seq[i], 0.1, 0.1, 0, i * 0.09);
    },
    clear: function () {
      stopMusic();
      var seq = [392, 523, 659, 784, 659, 784, 988, 1047];
      for (var i = 0; i < seq.length; i++) beep("triangle", seq[i], 0.16, 0.13, 0, i * 0.14);
    },
    timeWarn: function () { beep("square", 880, 0.07, 0.1); beep("square", 880, 0.07, 0.1, 0, 0.12); beep("square", 880, 0.07, 0.1, 0, 0.24); },
    pause: function () { beep("square", 660, 0.06, 0.1); beep("square", 880, 0.06, 0.1, 0, 0.08); }
  };

  // 简易自创背景循环（原创旋律，仅营造氛围，非原曲）
  var bgm = [
    [659, 0.12], [659, 0.12], [0, 0.12], [659, 0.12], [0, 0.12], [523, 0.12], [659, 0.24], [784, 0.24], [0, 0.24], [392, 0.24], [0, 0.24],
    [523, 0.18], [0, 0.12], [392, 0.18], [0, 0.12], [330, 0.18], [0, 0.12], [440, 0.18], [494, 0.18], [466, 0.12], [440, 0.18],
    [392, 0.16], [659, 0.16], [784, 0.16], [880, 0.2], [698, 0.12], [784, 0.16], [0, 0.08], [659, 0.16], [523, 0.12], [587, 0.12], [494, 0.2], [0, 0.2]
  ];

  function startMusic() {
    if (musicOn || muted) return;
    var c = ac();
    if (!c) return;
    musicOn = true;
    var idx = 0;
    function step() {
      if (!musicOn) return;
      var note = bgm[idx % bgm.length];
      idx++;
      if (note[0] > 0 && !muted) beep("square", note[0], note[1] * 0.9, 0.055);
      musicTimer = setTimeout(step, note[1] * 1000);
    }
    step();
  }

  function stopMusic() {
    musicOn = false;
    if (musicTimer) { clearTimeout(musicTimer); musicTimer = null; }
  }

  window.MarioAudio = {
    sfx: SFX,
    startMusic: startMusic,
    stopMusic: stopMusic,
    unlock: function () { ac(); },
    toggleMute: function () {
      muted = !muted;
      if (muted) stopMusic();
      return muted;
    },
    isMuted: function () { return muted; }
  };
})();
