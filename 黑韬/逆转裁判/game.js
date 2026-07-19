'use strict';
/* ============================================================
   逆转法庭 ～午夜的钟声～
   NDS 风格网页游戏 · 原创剧本 · 致敬经典法庭辩论玩法
   全部图形为程序化像素绘制 / 全部音乐音效为 WebAudio 合成
   ============================================================ */

const W = 256, H = 192, PIX = 2;
const cvTop = document.getElementById('cvTop');
const cvBtm = document.getElementById('cvBtm');
const gT = cvTop.getContext('2d');
const gB = cvBtm.getContext('2d');
cvTop.style.width = (W * PIX) + 'px'; cvTop.style.height = (H * PIX) + 'px';
cvBtm.style.width = (W * PIX) + 'px'; cvBtm.style.height = (H * PIX) + 'px';
gT.imageSmoothingEnabled = false; gB.imageSmoothingEnabled = false;

const FONT = '"SimHei","Microsoft YaHei",sans-serif';
const shellEl = document.getElementById('nds-shell');
const wrapEl = document.getElementById('shell-wrap');
const lcdTop = document.getElementById('lcdTop');
const lcdBtm = document.getElementById('lcdBtm');

function fitShell() {
  wrapEl.style.transform = 'scale(1)';
  const r = shellEl.getBoundingClientRect();
  const s = Math.min(window.innerWidth / r.width, window.innerHeight / r.height) * 0.97;
  wrapEl.style.transform = 'scale(' + Math.min(s, 1.6) + ')';
}
window.addEventListener('resize', fitShell);
setTimeout(fitShell, 30);

/* ============================================================
   AUDIO  —— 全部合成，无采样
   ============================================================ */
let AC = null, master = null, musicBus = null;
function ensureAudio() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  AC = new (window.AudioContext || window.webkitAudioContext)();
  master = AC.createGain(); master.gain.value = 0.5; master.connect(AC.destination);
  musicBus = AC.createGain(); musicBus.gain.value = 0.16; musicBus.connect(master);
}
function tone(freq, dur, type, vol, opts) {
  if (!AC) return; opts = opts || {};
  const t = AC.currentTime + (opts.delay || 0);
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = type || 'square';
  o.frequency.setValueAtTime(freq, t);
  if (opts.to) o.frequency.exponentialRampToValueAtTime(Math.max(1, opts.to), t + dur);
  g.gain.setValueAtTime(vol || 0.2, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, vol, filterFreq, type, delay) {
  if (!AC) return;
  const t = AC.currentTime + (delay || 0);
  const len = Math.max(1, (AC.sampleRate * dur) | 0);
  const buf = AC.createBuffer(1, len, AC.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = AC.createBufferSource(); src.buffer = buf;
  const f = AC.createBiquadFilter(); f.type = type || 'lowpass'; f.frequency.value = filterFreq || 1200;
  const g = AC.createGain();
  g.gain.setValueAtTime(vol || 0.2, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t);
}
const SFX = {
  blip(p) { tone(520 + (p || 0) * 140, 0.045, 'square', 0.055); },
  ok() { tone(660, 0.06, 'square', 0.12); tone(990, 0.09, 'square', 0.10, { delay: 0.06 }); },
  cancel() { tone(330, 0.07, 'square', 0.10); tone(220, 0.10, 'square', 0.09, { delay: 0.06 }); },
  move() { tone(880, 0.035, 'square', 0.07); },
  gavel() { noise(0.12, 0.5, 900); tone(95, 0.22, 'triangle', 0.55, { to: 50 }); },
  gavel3() { for (let i = 0; i < 3; i++) { noise(0.1, 0.45, 900, 'lowpass', i * 0.17); tone(95, 0.2, 'triangle', 0.5, { to: 50, delay: i * 0.17 }); } },
  slam() { noise(0.16, 0.6, 700); tone(70, 0.3, 'triangle', 0.6, { to: 40 }); },
  shout() { // 抗议时的"喊声"合成
    tone(240, 0.28, 'sawtooth', 0.34, { to: 90 });
    tone(180, 0.3, 'square', 0.22, { to: 70 });
    noise(0.22, 0.28, 2400, 'bandpass');
    tone(60, 0.4, 'triangle', 0.4, { to: 34, delay: 0.05 });
  },
  sting() { tone(392, 0.09, 'square', 0.2); tone(370, 0.5, 'square', 0.22, { delay: 0.09, to: 92 }); },
  damage() { tone(200, 0.28, 'sawtooth', 0.3, { to: 60 }); noise(0.2, 0.22, 800); },
  shock() { tone(1200, 0.05, 'square', 0.2); tone(900, 0.05, 'square', 0.2, { delay: 0.05 }); tone(600, 0.16, 'square', 0.2, { delay: 0.1, to: 300 }); },
  item() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.13, 'triangle', 0.16, { delay: i * 0.09 })); },
  murmur() { noise(1.1, 0.10, 420); noise(0.9, 0.06, 800, 'bandpass', 0.15); },
  thunder() { noise(0.9, 0.32, 300); tone(55, 0.8, 'sawtooth', 0.2, { to: 30 }); },
  swish() { noise(0.2, 0.14, 3000, 'highpass'); tone(1400, 0.16, 'sine', 0.06, { to: 300 }); },
  stampBig() { noise(0.2, 0.6, 500); tone(60, 0.5, 'triangle', 0.7, { to: 32 }); },
  breakdown() { tone(320, 0.7, 'sawtooth', 0.26, { to: 40 }); noise(0.6, 0.3, 900); tone(160, 0.8, 'square', 0.18, { to: 30, delay: 0.1 }); },
  typebell() { tone(1568, 0.3, 'triangle', 0.12); },
};

/* ---------- 音乐音序器（原创小曲） ---------- */
const NOTE_BASE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function nf(tok) { // 'A#3' -> freq
  const m = /^([A-G])(#?)(\d)$/.exec(tok); if (!m) return 0;
  const semi = NOTE_BASE[m[1]] + (m[2] ? 1 : 0) + (parseInt(m[3]) + 1) * 12;
  return 440 * Math.pow(2, (semi - 69) / 12);
}
function seqTokens(s) { return s.trim().split(/\s+/); }

const TRACKS = {
  title: { bpm: 92, tracks: [
    { wave: 'triangle', vol: 0.5, seq: seqTokens(
      'A4 . C5 . E5 . C5 . A4 . C5 . E5 . C5 . ' +
      'G4 . B4 . D5 . B4 . G4 . B4 . D5 . B4 . ' +
      'F4 . A4 . C5 . A4 . F4 . A4 . C5 . A4 . ' +
      'E4 . G4 . B4 . G4 . E4 . G4 . B4 . C5 . ') },
    { wave: 'square', vol: 0.22, seq: seqTokens(
      'A2 . . . . . . . A2 . . . . . . . ' +
      'G2 . . . . . . . G2 . . . . . . . ' +
      'F2 . . . . . . . F2 . . . . . . . ' +
      'E2 . . . . . . . E2 . . . E2 . . . ') },
  ] },
  lobby: { bpm: 100, tracks: [
    { wave: 'triangle', vol: 0.5, seq: seqTokens(
      'E4 . G4 . C5 . . . B4 . G4 . A4 . . . ' +
      'G4 . E4 . D4 . . . E4 . . . . . . . ' +
      'E4 . G4 . C5 . . . D5 . B4 . A4 . . . ' +
      'G4 . A4 . G4 . E4 . C4 . . . . . . . ') },
    { wave: 'square', vol: 0.2, seq: seqTokens(
      'C3 . . . G2 . . . A2 . . . E2 . . . ' +
      'F2 . . . G2 . . . C3 . . . C3 . . . ' +
      'C3 . . . G2 . . . A2 . . . E2 . . . ' +
      'F2 . . . G2 . . . C3 . . . G2 . . . ') },
  ] },
  court: { bpm: 116, tracks: [
    { wave: 'triangle', vol: 0.5, seq: seqTokens(
      'E4 . . . E4 . F4 . G4 . . . F4 . E4 . ' +
      'D4 . . . D4 . E4 . F4 . . . E4 . D4 . ' +
      'E4 . . . E4 . F4 . G4 . A4 . B4 . . . ' +
      'C5 . B4 . A4 . G4 . F4 . E4 . D4 . . . ') },
    { wave: 'square', vol: 0.22, seq: seqTokens(
      'A2 . A2 . E3 . E3 . A2 . A2 . E3 . E3 . ' +
      'G2 . G2 . D3 . D3 . G2 . G2 . D3 . D3 . ' +
      'A2 . A2 . E3 . E3 . F2 . F2 . C3 . C3 . ' +
      'F2 . G2 . A2 . B2 . E2 . E2 . E3 . E3 . ') },
    { wave: 'noise', vol: 0.12, seq: seqTokens(
      'x . . . x . . . x . . . x . x . ' +
      'x . . . x . . . x . . . x . x . ' +
      'x . . . x . . . x . . . x . x . ' +
      'x . . . x . . . x . x . x . x . ') },
  ] },
  cross: { bpm: 138, tracks: [
    { wave: 'square', vol: 0.36, seq: seqTokens(
      'D3 . D3 D3 . D3 . . F3 . F3 F3 . F3 . . ' +
      'G3 . G3 G3 . G3 . . A3 . A3 A3 . G3 F3 . ' +
      'D3 . D3 D3 . D3 . . F3 . F3 F3 . F3 . . ' +
      'A#2 . A#2 A#2 . A#2 . . A2 . A2 A2 . A2 . . ') },
    { wave: 'triangle', vol: 0.42, seq: seqTokens(
      '. . . . D5 . . . . . . . C5 . D5 . ' +
      '. . . . A4 . . . . . . . . . . . ' +
      '. . . . D5 . . . . . . . F5 . D5 . ' +
      '. . . . E5 . . . C5 . A4 . . . . . ') },
    { wave: 'noise', vol: 0.14, seq: seqTokens(
      'K . x . K . x . K . x . K . x x ' +
      'K . x . K . x . K . x . K . x . ' +
      'K . x . K . x . K . x . K . x x ' +
      'K . x . K . x . K K x . K . x . ') },
  ] },
  cornered: { bpm: 160, tracks: [
    { wave: 'square', vol: 0.34, seq: seqTokens(
      'E3 E3 E3 E3 E3 E3 G3 G3 A3 A3 A3 A3 G3 G3 F3 F3 ' +
      'E3 E3 E3 E3 E3 E3 G3 G3 A3 A3 B3 B3 C4 C4 D4 D4 ' +
      'E3 E3 E3 E3 E3 E3 G3 G3 A3 A3 A3 A3 G3 G3 F3 F3 ' +
      'C3 C3 C3 C3 D3 D3 D3 D3 B2 B2 B2 B2 E3 E3 E3 E3 ') },
    { wave: 'sawtooth', vol: 0.2, seq: seqTokens(
      'E5 . B4 . E5 . D5 . C5 . B4 . C5 . D5 . ' +
      'E5 . B4 . E5 . D5 . E5 . F5 . G5 . . . ' +
      'A5 . G5 . E5 . D5 . C5 . B4 . C5 . D5 . ' +
      'E5 . . . D5 . . . B4 . . . E5 . . . ') },
    { wave: 'noise', vol: 0.16, seq: seqTokens(
      'K . x . K . x . K . x . K . x . ' +
      'K . x . K . x . K . x . K x x x ' +
      'K . x . K . x . K . x . K . x . ' +
      'K . x . K . x . K K . . K . x x ') },
  ] },
  victory: { bpm: 126, tracks: [
    { wave: 'triangle', vol: 0.5, seq: seqTokens(
      'G4 . C5 . E5 . G5 . . . E5 . G5 . . . ' +
      'F5 . E5 . D5 . C5 . D5 . . . . . . . ' +
      'G4 . C5 . E5 . G5 . . . A5 . G5 . E5 . ' +
      'D5 . E5 . C5 . . . . . . . . . . . ') },
    { wave: 'square', vol: 0.22, seq: seqTokens(
      'C3 . . . G2 . . . C3 . . . G2 . . . ' +
      'F2 . . . G2 . . . C3 . . . C3 . . . ' +
      'C3 . . . G2 . . . F2 . . . F2 . . . ' +
      'G2 . G2 . C3 . . . C3 . . . . . . . ') },
    { wave: 'noise', vol: 0.12, seq: seqTokens(
      'K . x . x . x . K . x . x . x . ' +
      'K . x . x . x . K . x . x . x . ' +
      'K . x . x . x . K . x . x . x . ' +
      'K . x . K . x . K . . . . . . . ') },
  ] },
};

const Music = {
  cur: null, timer: null, step: 0, nextT: 0,
  play(id) {
    this.stop();
    if (!id || !AC || !TRACKS[id]) { this.cur = id || null; return; }
    this.cur = id; this.step = 0; this.nextT = AC.currentTime + 0.06;
    const self = this;
    this.timer = setInterval(() => { self.tick(); }, 42);
  },
  stop() { if (this.timer) { clearInterval(this.timer); this.timer = null; } this.cur = null; },
  tick() {
    if (!AC || !this.cur) return;
    const pat = TRACKS[this.cur]; if (!pat) return;
    const stepDur = 60 / pat.bpm / 4;
    while (this.nextT < AC.currentTime + 0.18) {
      const t = this.nextT, st = this.step;
      for (const tr of pat.tracks) {
        const tok = tr.seq[st % tr.seq.length];
        if (!tok || tok === '.') continue;
        if (tr.wave === 'noise') {
          if (tok === 'x') this._hat(t, tr.vol);
          else if (tok === 'K') this._kick(t, tr.vol);
        } else {
          const f = nf(tok); if (!f) continue;
          this._note(f, t, stepDur * 0.92, tr.wave, tr.vol);
        }
      }
      this.step++; this.nextT += stepDur;
    }
  },
  _note(f, t, dur, wave, vol) {
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = wave; o.frequency.value = f;
    g.gain.setValueAtTime(vol * 0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + dur + 0.02);
  },
  _hat(t, vol) {
    const len = (AC.sampleRate * 0.03) | 0;
    const buf = AC.createBuffer(1, len, AC.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const s = AC.createBufferSource(); s.buffer = buf;
    const f = AC.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 6000;
    const g = AC.createGain(); g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
    s.connect(f); f.connect(g); g.connect(musicBus); s.start(t);
  },
  _kick(t, vol) {
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(130, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.09);
    g.gain.setValueAtTime(vol * 2.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + 0.12);
  }
};

/* ============================================================
   绘图工具
   ============================================================ */
function rc(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(x | 0, y | 0, w | 0, h | 0); }
function ol(g, x, y, w, h, c, lw) { g.strokeStyle = c; g.lineWidth = lw || 1; g.strokeRect((x | 0) + .5, (y | 0) + .5, w | 0, h | 0); }
function ci(g, x, y, r, c) { g.fillStyle = c; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
function tri(g, a, b, c2, col) { g.fillStyle = col; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(c2[0], c2[1]); g.closePath(); g.fill(); }
function poly(g, pts, col) { g.fillStyle = col; g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.closePath(); g.fill(); }
function txt(g, s, x, y, font, col, align, base) {
  g.font = font; g.fillStyle = col; g.textAlign = align || 'left'; g.textBaseline = base || 'alphabetic';
  g.fillText(s, x, y);
}
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, gg = (n >> 8) & 255, b = n & 255;
  r = Math.min(255, Math.max(0, r * f)) | 0; gg = Math.min(255, Math.max(0, gg * f)) | 0; b = Math.min(255, Math.max(0, b * f)) | 0;
  return 'rgb(' + r + ',' + gg + ',' + b + ')';
}

/* ============================================================
   背景绘制
   ============================================================ */
const BG = {
  dark(g, t) {
    rc(g, 0, 0, W, H, '#05060e');
    // 钟楼剪影
    rc(g, 104, 38, 48, 130, '#0d1020');
    tri(g, [104, 38], [152, 38], [128, 14], '#0d1020');
    ci(g, 128, 62, 15, '#141a30');
    g.strokeStyle = '#232c4e'; g.lineWidth = 1;
    g.beginPath(); g.arc(128, 62, 15, 0, Math.PI * 2); g.stroke();
    // 指向 12 点的针
    g.beginPath(); g.moveTo(128, 62); g.lineTo(128, 50); g.stroke();
    g.beginPath(); g.moveTo(128, 62); g.lineTo(128, 53); g.stroke();
    rc(g, 118, 100, 8, 12, '#1a2138'); rc(g, 130, 100, 8, 12, '#1a2138');
    rc(g, 0, 168, W, 24, '#080a14');
    // 雨
    g.strokeStyle = 'rgba(120,140,200,0.35)'; g.lineWidth = 1;
    for (let i = 0; i < 46; i++) {
      const x = ((i * 53 + t * 3.1) % (W + 30)) - 15;
      const y = ((i * 97 + t * 6.7) % (H + 20)) - 10;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x - 2, y + 9); g.stroke();
    }
  },
  lobby(g) {
    rc(g, 0, 0, W, 136, '#cfc4ae');
    for (let x = 0; x < W; x += 42) { rc(g, x, 0, 2, 136, '#bdb098'); }
    rc(g, 0, 44, W, 3, '#bdb098');
    // 窗
    rc(g, 168, 16, 64, 66, '#7f97ad'); ol(g, 168, 16, 64, 66, '#6b6252', 3);
    rc(g, 198, 16, 3, 66, '#6b6252'); rc(g, 168, 46, 64, 3, '#6b6252');
    rc(g, 172, 20, 24, 24, '#93a9bd');
    // 门
    rc(g, 22, 22, 46, 108, '#7a5c3c'); ol(g, 22, 22, 46, 108, '#513a22', 2);
    rc(g, 28, 30, 34, 42, '#8d6b46'); rc(g, 28, 80, 34, 42, '#8d6b46');
    ci(g, 62, 78, 2.5, '#e5c860');
    // 地板
    rc(g, 0, 136, W, 56, '#9c7850');
    for (let x = -20; x < W; x += 34) { g.strokeStyle = '#8a6842'; g.lineWidth = 2; g.beginPath(); g.moveTo(x + 20, 136); g.lineTo(x, 192); g.stroke(); }
    rc(g, 0, 133, W, 4, '#6b5232');
    // 长椅
    rc(g, 150, 118, 92, 10, '#8f3a30'); ol(g, 150, 118, 92, 10, '#5c221c', 2);
    rc(g, 154, 128, 8, 22, '#5c3a28'); rc(g, 230, 128, 8, 22, '#5c3a28');
    rc(g, 150, 96, 92, 8, '#8f3a30'); ol(g, 150, 96, 92, 8, '#5c221c', 2);
    rc(g, 154, 104, 6, 14, '#7a3028'); rc(g, 232, 104, 6, 14, '#7a3028');
    // 盆栽
    rc(g, 96, 118, 18, 16, '#a35c34'); ol(g, 96, 118, 18, 16, '#6b3a1c', 2);
    ci(g, 105, 108, 12, '#3f7a3a'); ci(g, 97, 114, 8, '#356b30'); ci(g, 113, 113, 8, '#468748');
  },
  judge(g) {
    rc(g, 0, 0, W, H, '#5c4128');
    for (let x = 0; x < W; x += 36) { rc(g, x, 0, 3, 110, '#4c3520'); }
    rc(g, 0, 0, W, 8, '#3d2a17');
    // 法官席
    rc(g, 0, 108, W, 84, '#6e4e2e'); rc(g, 0, 108, W, 5, '#8a6438');
    rc(g, 0, 118, W, 3, '#59401f');
    for (let x = 12; x < W; x += 48) { rc(g, x, 126, 30, 52, '#5d4326'); ol(g, x, 126, 30, 52, '#453117', 2); }
    // 徽记
    ci(g, 128, 148, 21, '#c9a53f'); ci(g, 128, 148, 17, '#e0bd55');
    g.strokeStyle = '#8a6b1e'; g.lineWidth = 2;
    g.beginPath(); g.arc(128, 148, 21, 0, Math.PI * 2); g.stroke();
    // 天平图形
    rc(g, 126, 138, 4, 16, '#8a6b1e');
    rc(g, 116, 140, 24, 3, '#8a6b1e');
    g.beginPath(); g.arc(117, 147, 4, 0, Math.PI); g.stroke();
    g.beginPath(); g.arc(139, 147, 4, 0, Math.PI); g.stroke();
  },
  defense(g) {
    rc(g, 0, 0, W, H, '#39445c');
    for (let x = 0; x < W; x += 44) { rc(g, x, 0, 3, 140, '#2e3850'); }
    rc(g, 0, 30, W, 3, '#2e3850'); rc(g, 0, 0, W, 6, '#242c42');
    // 旁听席影
    rc(g, 0, 96, W, 10, 'rgba(0,0,0,0.22)');
    // 辩护席桌
    rc(g, 0, 138, W, 54, '#3d2b18');
    rc(g, 0, 138, W, 6, '#5d4326');
    rc(g, 0, 146, W, 3, '#291c0e');
    rc(g, 0, 152, W, 40, '#31384e');
    rc(g, 0, 152, W, 3, '#c9a53f');
    // 文件
    rc(g, 30, 128, 34, 10, '#e8e2d0'); ol(g, 30, 128, 34, 10, '#a8a291', 1);
    rc(g, 36, 124, 30, 8, '#d8d2c0');
  },
  prosecution(g) {
    rc(g, 0, 0, W, H, '#54313a');
    for (let x = 0; x < W; x += 44) { rc(g, x, 0, 3, 140, '#452830'); }
    rc(g, 0, 30, W, 3, '#452830'); rc(g, 0, 0, W, 6, '#361f25');
    rc(g, 0, 96, W, 10, 'rgba(0,0,0,0.22)');
    rc(g, 0, 138, W, 54, '#3d2b18');
    rc(g, 0, 138, W, 6, '#5d4326');
    rc(g, 0, 146, W, 3, '#291c0e');
    rc(g, 0, 152, W, 40, '#4e2b33');
    rc(g, 0, 152, W, 3, '#c9a53f');
    rc(g, 186, 126, 36, 12, '#e8e2d0'); ol(g, 186, 126, 36, 12, '#a8a291', 1);
  },
  witness(g) {
    rc(g, 0, 0, W, H, '#68503a');
    for (let x = 0; x < W; x += 40) { rc(g, x, 0, 3, 130, '#57422e'); }
    rc(g, 0, 0, W, 6, '#443322');
    // 背后大门
    rc(g, 92, 14, 72, 116, '#4a3826'); ol(g, 92, 14, 72, 116, '#33261a', 3);
    g.fillStyle = '#4a3826'; g.beginPath(); g.arc(128, 20, 36, Math.PI, 0); g.fill();
    g.strokeStyle = '#33261a'; g.lineWidth = 3; g.beginPath(); g.arc(128, 20, 36, Math.PI, 0); g.stroke();
    rc(g, 126, 14, 4, 116, '#33261a');
    rc(g, 100, 40, 20, 30, '#5c4630'); rc(g, 136, 40, 20, 30, '#5c4630');
    rc(g, 100, 84, 20, 30, '#5c4630'); rc(g, 136, 84, 20, 30, '#5c4630');
    // 证人台
    rc(g, 0, 140, W, 52, '#5d4326');
    rc(g, 0, 140, W, 6, '#7a5a32');
    rc(g, 0, 148, W, 3, '#3d2c16');
    for (let x = 8; x < W; x += 30) { rc(g, x, 154, 18, 34, '#523a20'); ol(g, x, 154, 18, 34, '#3a2a14', 2); }
  },
  court(g) {
    rc(g, 0, 0, W, H, '#4a3624');
    rc(g, 0, 0, W, 8, '#33251a');
    rc(g, 58, 16, 140, 64, '#5c4630'); ol(g, 58, 16, 140, 64, '#3a2c1c', 2);
    ci(g, 128, 42, 15, '#c9a53f');
    g.strokeStyle = '#8a6b1e'; g.lineWidth = 2; g.beginPath(); g.arc(128, 42, 15, 0, Math.PI * 2); g.stroke();
    // 法官席（远景）
    rc(g, 84, 66, 88, 42, '#6e4e2e'); ol(g, 84, 66, 88, 42, '#43301a', 2);
    rc(g, 88, 70, 80, 12, '#7d5a36');
    // 两侧席位
    rc(g, 4, 96, 62, 62, '#3d2b18'); ol(g, 4, 96, 62, 62, '#241a0e', 2);
    rc(g, 8, 100, 54, 8, '#31384e');
    rc(g, 190, 96, 62, 62, '#3d2b18'); ol(g, 190, 96, 62, 62, '#241a0e', 2);
    rc(g, 194, 100, 54, 8, '#4e2b33');
    // 证人台
    rc(g, 102, 118, 52, 34, '#5d4326'); ol(g, 102, 118, 52, 34, '#382812', 2);
    rc(g, 106, 122, 44, 8, '#7a5a32');
    // 地板
    rc(g, 0, 160, W, 32, '#8a6a44');
    for (let x = 0; x < W; x += 26) { rc(g, x, 160, 2, 32, '#77582f'); }
  },
};

/* ============================================================
   角色绘制（程序化像素画）
   pose 说明见各函数；talking = 嘴部动画
   ============================================================ */
function eyesBlink(t) { return (t % 220) > 212; }

function chLin(g, o) { // 辩护律师 林诚
  const t = o.t, talk = o.talking && (t >> 3) % 2 === 0;
  const px = 128, deskY = o.pose === 'desk' ? 5 : 0;
  const suit = '#1d3f96', suitD = '#152e70';
  // ---- 身体 ----
  poly(g, [[px - 46, 192], [px - 40, 128 + deskY], [px - 20, 116 + deskY], [px + 20, 116 + deskY], [px + 40, 128 + deskY], [px + 46, 192]], suit);
  poly(g, [[px - 20, 116 + deskY], [px, 132 + deskY], [px - 14, 150 + deskY], [px - 26, 128 + deskY]], suitD);
  poly(g, [[px + 20, 116 + deskY], [px, 132 + deskY], [px + 14, 150 + deskY], [px + 26, 128 + deskY]], suitD);
  // 衬衫 + 领带
  poly(g, [[px - 12, 118 + deskY], [px + 12, 118 + deskY], [px, 148 + deskY]], '#f2efe6');
  poly(g, [[px - 4, 120 + deskY], [px + 4, 120 + deskY], [px + 2, 146 + deskY], [px - 2, 146 + deskY]], '#c8322e');
  // 徽章
  ci(g, px - 26, 128 + deskY, 3.4, '#e5c34a'); ci(g, px - 26, 128 + deskY, 1.6, '#b8922e');
  // 手臂姿势
  if (o.pose === 'point') {
    poly(g, [[px + 26, 126], [px + 78, 102], [px + 80, 110], [px + 30, 136]], suit);
    rc(g, px + 76, 98, 12, 12, '#f0cfa0'); rc(g, px + 86, 100, 10, 4, '#f0cfa0');
    g.strokeStyle = '#111'; g.lineWidth = 1; ol(g, px + 76, 98, 20, 12, 'rgba(0,0,0,0.35)', 1);
  } else if (o.pose === 'desk') {
    poly(g, [[px - 40, 132 + deskY], [px - 58, 168], [px - 46, 172], [px - 30, 140 + deskY]], suit);
    poly(g, [[px + 40, 132 + deskY], [px + 58, 168], [px + 46, 172], [px + 30, 140 + deskY]], suit);
    rc(g, px - 60, 164, 12, 9, '#f0cfa0'); rc(g, px + 48, 164, 12, 9, '#f0cfa0');
  }
  // ---- 头 ----
  const hy = 88 + deskY;
  rc(g, px - 7, hy + 14, 14, 16, '#f0cfa0'); // 颈
  ci(g, px, hy, 21, '#f0cfa0');
  // 发型：向后的尖刺
  poly(g, [[px - 22, hy - 2], [px - 24, hy - 22], [px - 6, hy - 25], [px + 12, hy - 26], [px + 26, hy - 18], [px + 34, hy - 22], [px + 27, hy - 8], [px + 38, hy - 8], [px + 25, hy + 2], [px + 20, hy - 6]], '#18181e');
  poly(g, [[px - 22, hy - 6], [px - 13, hy - 16], [px - 4, hy - 8], [px - 15, hy - 2]], '#18181e');
  tri(g, [px - 24, hy - 22], [px - 34, hy - 30], [px - 12, hy - 26], '#18181e');
  tri(g, [px + 4, hy - 24], [px + 6, hy - 38], [px + 18, hy - 24], '#18181e');
  tri(g, [px - 8, hy - 24], [px - 14, hy - 36], [px + 2, hy - 25], '#18181e');
  // 眉眼
  const blink = eyesBlink(t);
  g.fillStyle = '#111';
  rc(g, px - 14, hy - 8, 10, 2.5, '#111'); rc(g, px + 4, hy - 8, 10, 2.5, '#111');
  if (blink) { rc(g, px - 12, hy - 2, 8, 2, '#111'); rc(g, px + 5, hy - 2, 8, 2, '#111'); }
  else {
    rc(g, px - 12, hy - 4, 8, 6, '#fff'); rc(g, px + 5, hy - 4, 8, 6, '#fff');
    rc(g, px - 9, hy - 3, 4, 5, '#111'); rc(g, px + 8, hy - 3, 4, 5, '#111');
  }
  // 鼻
  rc(g, px - 1, hy + 4, 2, 3, '#c99d6e');
  // 嘴
  if (talk) rc(g, px - 5, hy + 10, 10, 5, '#7a3020');
  else if (o.pose === 'smile') { g.strokeStyle = '#7a3020'; g.lineWidth = 2; g.beginPath(); g.arc(px, hy + 8, 6, 0.2, Math.PI - 0.2); g.stroke(); }
  else rc(g, px - 5, hy + 11, 10, 2, '#7a3020');
  // 汗
  if (o.pose === 'sweat') {
    ci(g, px + 26, hy - 12, 3, '#9fd8ff'); tri(g, [px + 23, hy - 13], [px + 29, hy - 13], [px + 26, hy - 20], '#9fd8ff');
  }
}

function chShuang(g, o) { // 检察官 霜月薰
  const t = o.t, talk = o.talking && (t >> 3) % 2 === 0;
  const px = 128;
  const suit = '#6e1430', suitD = '#540e24';
  // 身后长发
  rc(g, px - 34, 96, 14, 80, '#dfe2ee'); rc(g, px + 20, 96, 14, 80, '#dfe2ee');
  poly(g, [[px - 34, 176], [px - 20, 176], [px - 24, 190], [px - 34, 186]], '#dfe2ee');
  poly(g, [[px + 20, 176], [px + 34, 176], [px + 34, 186], [px + 24, 190]], '#dfe2ee');
  // 身体
  poly(g, [[px - 42, 192], [px - 36, 130], [px - 18, 118], [px + 18, 118], [px + 36, 130], [px + 42, 192]], suit);
  poly(g, [[px - 18, 118], [px, 134], [px - 12, 154], [px - 24, 130]], suitD);
  poly(g, [[px + 18, 118], [px, 134], [px + 12, 154], [px + 24, 130]], suitD);
  poly(g, [[px - 10, 120], [px + 10, 120], [px, 142]], '#f4f2ec');
  // 领口饰
  ci(g, px, 128, 3.2, '#e5c34a');
  // 手臂
  if (o.pose === 'point') {
    poly(g, [[px - 26, 128], [px - 78, 104], [px - 80, 112], [px - 30, 138]], suit);
    rc(g, px - 88, 100, 12, 12, '#f6d8bc'); rc(g, px - 96, 102, 10, 4, '#f6d8bc');
  } else {
    // 抱臂
    poly(g, [[px - 36, 138], [px + 30, 148], [px + 30, 158], [px - 36, 148]], suitD);
    poly(g, [[px + 36, 138], [px - 30, 148], [px - 30, 158], [px + 36, 148]], suit);
    rc(g, px + 24, 144, 12, 9, '#f6d8bc'); rc(g, px - 36, 148, 12, 9, '#f6d8bc');
  }
  // 头
  const hy = 90;
  rc(g, px - 6, hy + 14, 12, 14, '#f6d8bc');
  ci(g, px, hy, 20, '#f6d8bc');
  // 银发
  poly(g, [[px - 24, hy + 6], [px - 26, hy - 18], [px - 10, hy - 27], [px + 10, hy - 27], [px + 26, hy - 18], [px + 24, hy + 6], [px + 18, hy - 4], [px + 12, hy - 16], [px - 2, hy - 12], [px - 16, hy - 16], [px - 18, hy - 2]], '#e8eaf4');
  poly(g, [[px - 2, hy - 12], [px + 12, hy - 16], [px + 8, hy - 6]], '#d4d7e6');
  // 侧发
  rc(g, px - 26, hy - 6, 8, 34, '#e8eaf4'); rc(g, px + 18, hy - 6, 8, 34, '#e8eaf4');
  // 眼睛（锐利）
  const blink = eyesBlink(t + 60);
  rc(g, px - 15, hy - 7, 11, 2, '#5a4a6a'); rc(g, px + 4, hy - 7, 11, 2, '#5a4a6a');
  if (o.pose === 'smirk') {
    g.strokeStyle = '#333'; g.lineWidth = 2;
    g.beginPath(); g.arc(px - 9, hy - 1, 4, Math.PI + 0.4, -0.4); g.stroke();
    g.beginPath(); g.arc(px + 9, hy - 1, 4, Math.PI + 0.4, -0.4); g.stroke();
  } else if (o.pose === 'shock') {
    rc(g, px - 14, hy - 4, 9, 8, '#fff'); rc(g, px + 5, hy - 4, 9, 8, '#fff');
    rc(g, px - 11, hy - 2, 3, 5, '#111'); rc(g, px + 8, hy - 2, 3, 5, '#111');
  } else if (blink) {
    rc(g, px - 13, hy - 1, 8, 2, '#333'); rc(g, px + 5, hy - 1, 8, 2, '#333');
  } else {
    rc(g, px - 13, hy - 3, 9, 5, '#fff'); rc(g, px + 4, hy - 3, 9, 5, '#fff');
    rc(g, px - 10, hy - 3, 4, 5, '#3a2a55'); rc(g, px + 7, hy - 3, 4, 5, '#3a2a55');
  }
  rc(g, px - 1, hy + 4, 2, 3, '#d8b090');
  // 嘴
  if (talk) rc(g, px - 4, hy + 10, 9, 4, '#a3403a');
  else if (o.pose === 'smirk') { g.strokeStyle = '#a3403a'; g.lineWidth = 2; g.beginPath(); g.moveTo(px - 4, hy + 11); g.lineTo(px + 5, hy + 9); g.stroke(); }
  else if (o.pose === 'shock') ci(g, px, hy + 11, 3.4, '#7a3020');
  else rc(g, px - 4, hy + 11, 9, 2, '#a3403a');
  if (o.pose === 'sweat') { ci(g, px + 25, hy - 14, 3, '#9fd8ff'); tri(g, [px + 22, hy - 15], [px + 28, hy - 15], [px + 25, hy - 22], '#9fd8ff'); }
}

function chGuard(g, o) { // 证人 保安·陈大山
  const t = o.t, talk = o.talking && (t >> 3) % 2 === 0;
  let px = 128;
  if (o.pose === 'breakdown') px += Math.round(Math.sin(t * 0.9) * 3);
  const uni = '#223055', uniD = '#182342';
  // 身体（壮）
  poly(g, [[px - 52, 192], [px - 46, 132], [px - 24, 118], [px + 24, 118], [px + 46, 132], [px + 52, 192]], uni);
  poly(g, [[px - 24, 118], [px - 4, 132], [px - 16, 152], [px - 30, 130]], uniD);
  poly(g, [[px + 24, 118], [px + 4, 132], [px + 16, 152], [px + 30, 130]], uniD);
  rc(g, px - 8, 120, 16, 20, '#e8e4d8');
  // 肩章
  rc(g, px - 46, 126, 18, 6, '#c9a53f'); rc(g, px + 28, 126, 18, 6, '#c9a53f');
  // 徽章 + 口袋
  ci(g, px - 22, 146, 4, '#c9a53f'); ci(g, px - 22, 146, 2, '#8a6b1e');
  rc(g, px + 12, 150, 18, 12, uniD); ol(g, px + 12, 150, 18, 12, '#0f1730', 1);
  if (o.pose === 'salute') {
    poly(g, [[px + 30, 130], [px + 52, 96], [px + 58, 102], [px + 38, 136]], uni);
    rc(g, px + 48, 88, 14, 10, '#e8c9a0');
  }
  // 头（方脸）
  const hy = 88;
  rc(g, px - 9, hy + 14, 18, 14, '#e8c9a0');
  rc(g, px - 19, hy - 14, 38, 34, '#e8c9a0');
  rc(g, px - 21, hy - 6, 42, 18, '#e8c9a0');
  // 胡茬
  rc(g, px - 15, hy + 8, 30, 9, '#c7a67c');
  // 帽子
  const capT = o.pose === 'breakdown' ? Math.round(-4 - Math.abs(Math.sin(t * 0.4)) * 5) : 0;
  rc(g, px - 22, hy - 26 + capT, 44, 14, '#182342');
  rc(g, px - 24, hy - 13 + capT, 48, 5, '#0f1730');
  rc(g, px - 20, hy - 18 + capT, 40, 3, '#c9a53f');
  // 眉眼
  if (o.pose === 'angry') {
    rc(g, px - 16, hy - 9, 11, 3, '#2c2418'); rc(g, px + 5, hy - 9, 11, 3, '#2c2418');
    rc(g, px - 13, hy - 4, 8, 5, '#fff'); rc(g, px + 6, hy - 4, 8, 5, '#fff');
    rc(g, px - 11, hy - 3, 4, 4, '#111'); rc(g, px + 8, hy - 3, 4, 4, '#111');
  } else if (o.pose === 'nervous') {
    rc(g, px - 16, hy - 10, 11, 2, '#2c2418'); rc(g, px + 5, hy - 10, 11, 2, '#2c2418');
    rc(g, px - 14, hy - 5, 9, 7, '#fff'); rc(g, px + 5, hy - 5, 9, 7, '#fff');
    const dx = Math.sin(t * 0.15) * 2;
    rc(g, px - 11 + dx, hy - 3, 3, 4, '#111'); rc(g, px + 8 + dx, hy - 3, 3, 4, '#111');
    // 汗
    ci(g, px + 26, hy - 16, 3, '#9fd8ff'); tri(g, [px + 23, hy - 17], [px + 29, hy - 17], [px + 26, hy - 24], '#9fd8ff');
    ci(g, px - 27, hy - 8, 2.6, '#9fd8ff');
  } else if (o.pose === 'breakdown') {
    // 漩涡眼
    g.strokeStyle = '#111'; g.lineWidth = 1.6;
    for (const ex of [px - 10, px + 10]) {
      g.beginPath();
      for (let a = 0; a < 12; a++) { const r = a * 0.45, ang = a * 0.9 + t * 0.2; const xx = ex + Math.cos(ang) * r, yy = hy - 2 + Math.sin(ang) * r; if (a === 0) g.moveTo(xx, yy); else g.lineTo(xx, yy); }
      g.stroke();
    }
    // 大量汗
    for (let i = 0; i < 6; i++) {
      const sx = px - 30 + i * 12, sy = hy - 24 - Math.abs(Math.sin(t * 0.25 + i)) * 7;
      ci(g, sx, sy, 2.6, '#9fd8ff');
    }
  } else {
    rc(g, px - 16, hy - 10, 11, 2.5, '#2c2418'); rc(g, px + 5, hy - 10, 11, 2.5, '#2c2418');
    if (eyesBlink(t + 130)) { rc(g, px - 13, hy - 2, 8, 2, '#111'); rc(g, px + 6, hy - 2, 8, 2, '#111'); }
    else {
      rc(g, px - 14, hy - 4, 9, 6, '#fff'); rc(g, px + 5, hy - 4, 9, 6, '#fff');
      rc(g, px - 11, hy - 3, 4, 5, '#111'); rc(g, px + 8, hy - 3, 4, 5, '#111');
    }
  }
  rc(g, px - 2, hy + 3, 4, 4, '#c79a6a');
  // 嘴
  if (o.pose === 'breakdown') ci(g, px, hy + 13, 6, '#5c1c14');
  else if (talk) rc(g, px - 6, hy + 10, 12, 6, '#5c1c14');
  else if (o.pose === 'angry') rc(g, px - 7, hy + 11, 14, 3, '#5c1c14');
  else rc(g, px - 6, hy + 12, 12, 2, '#5c1c14');
}

function chJudge(g, o) { // 审判长
  const t = o.t, talk = o.talking && (t >> 3) % 2 === 0;
  const px = 128, hy = 74;
  // 法袍肩部
  poly(g, [[px - 52, 160], [px - 44, 112], [px - 20, 100], [px + 20, 100], [px + 44, 112], [px + 52, 160]], '#2b2b33');
  poly(g, [[px - 20, 100], [px, 116], [px - 12, 136], [px - 26, 112]], '#1e1e26');
  poly(g, [[px + 20, 100], [px, 116], [px + 12, 136], [px + 26, 112]], '#1e1e26');
  rc(g, px - 10, 102, 20, 16, '#f2efe6');
  // 手 + 木槌
  if (o.pose === 'slam') {
    poly(g, [[px + 30, 116], [px + 62, 78], [px + 70, 84], [px + 40, 124]], '#2b2b33');
    rc(g, px + 58, 66, 8, 22, '#8a6438');
    rc(g, px + 50, 58, 24, 12, '#6b4a26'); ol(g, px + 50, 58, 24, 12, '#3f2c16', 2);
  }
  // 颈 + 头
  rc(g, px - 7, hy + 16, 14, 14, '#ecd3ac');
  ci(g, px, hy, 22, '#ecd3ac');
  // 光头 + 侧发
  rc(g, px - 24, hy - 10, 6, 22, '#cfcbc2'); rc(g, px + 18, hy - 10, 6, 22, '#cfcbc2');
  // 大胡子
  g.fillStyle = '#d9d4c8';
  g.beginPath(); g.arc(px, hy + 16, 19, -0.15, Math.PI + 0.15); g.fill();
  rc(g, px - 19, hy + 12, 38, 12, '#d9d4c8');
  g.beginPath(); g.arc(px, hy + 30, 12, -0.2, Math.PI + 0.2); g.fill();
  // 髭
  rc(g, px - 12, hy + 8, 24, 5, '#c9c4b6');
  // 眉毛（浓）
  rc(g, px - 17, hy - 12, 12, 4, '#cfcbc2'); rc(g, px + 5, hy - 12, 12, 4, '#cfcbc2');
  // 眼
  if (o.pose === 'shock') {
    rc(g, px - 14, hy - 7, 9, 8, '#fff'); rc(g, px + 5, hy - 7, 9, 8, '#fff');
    rc(g, px - 11, hy - 5, 3, 5, '#111'); rc(g, px + 8, hy - 5, 3, 5, '#111');
    ci(g, px, hy + 13, 5, '#4a2418');
  } else {
    rc(g, px - 13, hy - 5, 8, 2.4, '#111'); rc(g, px + 5, hy - 5, 8, 2.4, '#111');
  }
  rc(g, px - 2, hy + 1, 4, 4, '#cfa87a');
  if (talk && o.pose !== 'shock') rc(g, px - 5, hy + 13, 10, 5, '#4a2418');
}

function chYu(g, o) { // 助手 小雨
  const t = o.t, talk = o.talking && (t >> 3) % 2 === 0;
  const px = 128;
  // 身体
  poly(g, [[px - 34, 192], [px - 30, 136], [px - 16, 124], [px + 16, 124], [px + 30, 136], [px + 34, 192]], '#d9a23a');
  poly(g, [[px - 16, 124], [px + 16, 124], [px + 10, 150], [px - 10, 150]], '#f2efe6');
  rc(g, px - 3, 130, 6, 16, '#c8322e');
  // 头
  const hy = 96;
  rc(g, px - 5, hy + 14, 10, 14, '#f8ddc0');
  ci(g, px, hy, 19, '#f8ddc0');
  // 栗色头发
  poly(g, [[px - 22, hy + 8], [px - 23, hy - 14], [px - 8, hy - 24], [px + 8, hy - 24], [px + 23, hy - 14], [px + 22, hy + 8], [px + 16, hy - 6], [px + 6, hy - 14], [px - 6, hy - 14], [px - 16, hy - 6]], '#7a4a26');
  // 侧马尾
  poly(g, [[px + 20, hy - 8], [px + 34, hy + 2], [px + 30, hy + 34], [px + 22, hy + 30], [px + 26, hy + 6]], '#7a4a26');
  ci(g, px + 22, hy - 6, 4, '#c8322e');
  // 眼睛（大）
  if (o.pose === 'happy') {
    g.strokeStyle = '#3a2a18'; g.lineWidth = 2;
    g.beginPath(); g.arc(px - 8, hy - 1, 4.5, Math.PI + 0.3, -0.3); g.stroke();
    g.beginPath(); g.arc(px + 8, hy - 1, 4.5, Math.PI + 0.3, -0.3); g.stroke();
  } else if (eyesBlink(t + 40)) {
    rc(g, px - 12, hy - 1, 8, 2, '#3a2a18'); rc(g, px + 4, hy - 1, 8, 2, '#3a2a18');
  } else {
    rc(g, px - 13, hy - 5, 10, 9, '#fff'); rc(g, px + 3, hy - 5, 10, 9, '#fff');
    rc(g, px - 10, hy - 4, 5, 7, '#5a3a20'); rc(g, px + 6, hy - 4, 5, 7, '#5a3a20');
    rc(g, px - 9, hy - 4, 2, 2, '#fff'); rc(g, px + 7, hy - 4, 2, 2, '#fff');
  }
  // 眉
  if (o.pose === 'worried') { rc(g, px - 13, hy - 11, 9, 2, '#5a3a20'); rc(g, px + 5, hy - 9, 9, 2, '#5a3a20'); }
  else { rc(g, px - 12, hy - 10, 8, 2, '#5a3a20'); rc(g, px + 4, hy - 10, 8, 2, '#5a3a20'); }
  // 嘴
  if (talk) rc(g, px - 4, hy + 9, 8, 5, '#c86a5c');
  else if (o.pose === 'happy') { g.strokeStyle = '#c86a5c'; g.lineWidth = 2; g.beginPath(); g.arc(px, hy + 8, 5, 0.2, Math.PI - 0.2); g.stroke(); }
  else if (o.pose === 'worried') { g.strokeStyle = '#c86a5c'; g.lineWidth = 2; g.beginPath(); g.arc(px, hy + 13, 4, Math.PI + 0.3, -0.3); g.stroke(); }
  else rc(g, px - 4, hy + 10, 8, 2, '#c86a5c');
}

const CHARS = {
  lin:   { draw: chLin,   name: '林诚',   bg: 'defense',     blip: 0 },
  shuang:{ draw: chShuang,name: '霜月 薰', bg: 'prosecution', blip: 2 },
  guard: { draw: chGuard, name: '陈大山', bg: 'witness',     blip: -2 },
  judge: { draw: chJudge, name: '审判长', bg: 'judge',       blip: -3 },
  yu:    { draw: chYu,    name: '小雨',   bg: 'lobby',       blip: 4 },
};

/* 前景（席位桌板，绘制在角色之后） */
function drawForeground(g, bg) {
  if (bg === 'defense') {
    rc(g, 0, 158, W, 34, '#31384e'); rc(g, 0, 154, W, 5, '#5d4326');
    rc(g, 0, 152, W, 3, '#7a5a32'); rc(g, 0, 159, W, 2, '#c9a53f');
  } else if (bg === 'prosecution') {
    rc(g, 0, 158, W, 34, '#4e2b33'); rc(g, 0, 154, W, 5, '#5d4326');
    rc(g, 0, 152, W, 3, '#7a5a32'); rc(g, 0, 159, W, 2, '#c9a53f');
  } else if (bg === 'witness') {
    rc(g, 28, 158, 200, 34, '#5d4326');
    rc(g, 28, 154, 200, 5, '#7a5a32'); rc(g, 28, 152, 200, 3, '#8f6c3e');
    for (let x = 36; x < 220; x += 26) { rc(g, x, 164, 16, 28, '#523a20'); ol(g, x, 164, 16, 28, '#3a2a14', 2); }
  } else if (bg === 'judge') {
    rc(g, 0, 150, W, 42, '#6e4e2e'); rc(g, 0, 146, W, 5, '#8a6438');
    rc(g, 0, 144, W, 3, '#a5793f');
    ci(g, 128, 172, 16, '#c9a53f'); ci(g, 128, 172, 12, '#e0bd55');
  }
}

/* ============================================================
   证物数据
   ============================================================ */
const EVIDENCE = {
  badge:  { name: '律师徽章', short: '身份的证明', model: 'badge',
    desc: '辩护律师的身份证明。新人律师林诚的骄傲，每天都擦得锃亮。' },
  report: { name: '尸检报告', short: '死亡时间 23:30', model: 'report',
    desc: '死者：白川守（钟楼管理人）。死亡推定时刻：案发当晚 23:30 前后。死因：头部遭钝器重击。' },
  wrench: { name: '扳手', short: '凶器·有指纹', model: 'wrench',
    desc: '在顶层钟室发现的凶器。检出被告高木翔的指纹。是被告平时检修用的工具。' },
  repair: { name: '维修记录', short: '大钟停摆中', model: 'paper',
    desc: '钟楼管理处记录：大钟因齿轮故障，于案发三天前完全停摆。修理预定在下周。' },
  weather:{ name: '气象记录', short: '当晚特大暴雨', model: 'paper',
    desc: '案发当晚，全市特大暴雨。乌云整夜未散——没有一丝月光。' },
  keybook:{ name: '钥匙登记簿', short: '23:20 领取记录', model: 'book',
    desc: '钟楼钥匙的领取记录：案发当晚 23:20，保安陈大山领取了"顶层钟室"的钥匙。没有归还记录。' },
};

/* 证物小图标（程序化） */
function drawEvIcon(g, id, x, y, s) {
  const u = s / 24;
  rc(g, x, y, s, s, '#20263e'); ol(g, x, y, s, s, '#3c4668', 1);
  g.save(); g.translate(x, y); g.scale(u, u);
  if (id === 'badge') {
    ci(g, 12, 12, 8.5, '#e5c34a'); ci(g, 12, 12, 6.5, '#f2d868');
    g.strokeStyle = '#a8842a'; g.lineWidth = 1.4;
    g.beginPath(); g.arc(12, 12, 8.5, 0, Math.PI * 2); g.stroke();
    rc(g, 11, 7, 2, 8, '#a8842a'); rc(g, 7, 8, 10, 1.6, '#a8842a');
    g.beginPath(); g.arc(8, 12, 2.2, 0, Math.PI); g.stroke();
    g.beginPath(); g.arc(16, 12, 2.2, 0, Math.PI); g.stroke();
  } else if (id === 'report') {
    rc(g, 5, 3, 14, 18, '#eee9dc'); ol(g, 5, 3, 14, 18, '#b0a890', 1);
    for (let i = 0; i < 4; i++) rc(g, 7, 6 + i * 3.4, 10, 1.4, '#8a8272');
    ci(g, 15.6, 17, 2.6, '#c8322e');
  } else if (id === 'wrench') {
    g.save(); g.translate(12, 12); g.rotate(-Math.PI / 4);
    rc(g, -2, -8, 4, 15, '#9aa4b4');
    ci(g, 0, -8, 4.4, '#9aa4b4'); ci(g, 0, -10.6, 3, '#20263e');
    ci(g, 0, 8, 4.4, '#9aa4b4'); ci(g, 0, 10.4, 3, '#20263e');
    g.restore();
  } else if (id === 'repair') {
    rc(g, 5, 4, 14, 17, '#d8cfb8'); ol(g, 5, 4, 14, 17, '#a0977e', 1);
    rc(g, 9, 2, 6, 4, '#8a8272');
    for (let i = 0; i < 3; i++) rc(g, 7, 9 + i * 3.4, 10, 1.4, '#7a725e');
    // 小齿轮
    ci(g, 16, 17, 3, '#7a725e'); ci(g, 16, 17, 1.3, '#d8cfb8');
  } else if (id === 'weather') {
    ci(g, 10, 10, 5, '#c3cddd'); ci(g, 15, 9, 4.2, '#c3cddd'); rc(g, 6, 10, 13, 4, '#c3cddd');
    g.strokeStyle = '#7fa7d0'; g.lineWidth = 1.6;
    for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(8 + i * 4, 16); g.lineTo(7 + i * 4, 20); g.stroke(); }
  } else if (id === 'keybook') {
    rc(g, 4, 4, 16, 16, '#7a4a26'); ol(g, 4, 4, 16, 16, '#4d2e16', 1);
    rc(g, 6, 4, 2, 16, '#e5c34a');
    ci(g, 14, 10, 2.6, '#e5c34a'); rc(g, 13, 12, 2, 6, '#e5c34a'); rc(g, 15, 15, 2, 1.6, '#e5c34a');
  }
  g.restore();
}

/* ============================================================
   低面数 3D 模型（还原 NDS 检查证物的质感）
   ============================================================ */
function boxMesh(cx, cy, cz, sx, sy, sz, col) {
  const v = [], f = [];
  const xs = [cx - sx, cx + sx], ys = [cy - sy, cy + sy], zs = [cz - sz, cz + sz];
  for (const z of zs) for (const y of ys) for (const x of xs) v.push([x, y, z]);
  const q = [[0, 1, 3, 2], [4, 6, 7, 5], [0, 4, 5, 1], [2, 3, 7, 6], [0, 2, 6, 4], [1, 5, 7, 3]];
  for (const qq of q) f.push({ v: qq, c: col });
  return { v, f };
}
function mergeMesh(list) {
  const v = [], f = [];
  for (const m of list) {
    const off = v.length;
    for (const p of m.v) v.push(p);
    for (const ff of m.f) f.push({ v: ff.v.map(i => i + off), c: ff.c });
  }
  return { v, f };
}
const MODELS = {
  wrench: mergeMesh([
    boxMesh(0, 0, 0, 5, 30, 4, '#98a2b3'),
    boxMesh(-7, 34, 0, 4, 9, 4, '#8b95a6'),
    boxMesh(7, 34, 0, 4, 9, 4, '#8b95a6'),
    boxMesh(0, 28, 0, 10, 4, 4, '#98a2b3'),
    boxMesh(-7, -34, 0, 4, 9, 4, '#8b95a6'),
    boxMesh(7, -34, 0, 4, 9, 4, '#8b95a6'),
    boxMesh(0, -28, 0, 10, 4, 4, '#98a2b3'),
  ]),
  badge: (function () {
    const v = [], f = [], N = 10, R = 34, D = 5;
    for (let i = 0; i < N; i++) {
      const a = Math.PI * 2 * i / N;
      v.push([Math.cos(a) * R, Math.sin(a) * R, -D], [Math.cos(a) * R, Math.sin(a) * R, D]);
    }
    v.push([0, 0, -D - 2], [0, 0, D + 2]);
    for (let i = 0; i < N; i++) {
      const j = (i + 1) % N;
      f.push({ v: [i * 2, j * 2, j * 2 + 1, i * 2 + 1], c: '#caa63d' });
      f.push({ v: [i * 2, j * 2, N * 2], c: '#e0bd55' });
      f.push({ v: [i * 2 + 1, j * 2 + 1, N * 2 + 1], c: '#b8922e' });
    }
    return { v, f };
  })(),
  report: mergeMesh([
    boxMesh(0, 0, 0, 30, 40, 2, '#e8e3d4'),
    boxMesh(0, 30, 2.4, 22, 3, 1, '#8a8272'),
    boxMesh(0, 18, 2.4, 22, 2.4, 1, '#a09880'),
    boxMesh(0, 8, 2.4, 22, 2.4, 1, '#a09880'),
    boxMesh(0, -2, 2.4, 22, 2.4, 1, '#a09880'),
    boxMesh(14, -26, 2.4, 8, 8, 1, '#c8322e'),
  ]),
  paper: mergeMesh([
    boxMesh(0, 0, 0, 32, 42, 1.6, '#ded6c0'),
    boxMesh(0, 30, 2, 24, 3.4, 1, '#7a725e'),
    boxMesh(0, 16, 2, 24, 2.4, 1, '#96907c'),
    boxMesh(0, 6, 2, 24, 2.4, 1, '#96907c'),
    boxMesh(0, -4, 2, 24, 2.4, 1, '#96907c'),
    boxMesh(0, -14, 2, 16, 2.4, 1, '#96907c'),
  ]),
  book: mergeMesh([
    boxMesh(0, 0, 0, 30, 40, 6, '#7a4a26'),
    boxMesh(-26, 0, 0, 4, 40, 7, '#5a3418'),
    boxMesh(2, 0, 6.4, 26, 38, 1, '#e8e0cc'),
    boxMesh(6, 20, 8, 16, 2.4, 1, '#8a8272'),
    boxMesh(6, 10, 8, 16, 2.4, 1, '#8a8272'),
    boxMesh(6, 0, 8, 16, 2.4, 1, '#c8322e'),
  ]),
};
/* 低分辨率离屏渲染 → 放大，模拟 NDS 低分辨率 3D */
const m3dCanvas = document.createElement('canvas');
m3dCanvas.width = 128; m3dCanvas.height = 96;
const m3dCtx = m3dCanvas.getContext('2d');
function render3D(modelId, rotY, rotX, t) {
  const g = m3dCtx, mw = 128, mh = 96;
  g.fillStyle = '#101426'; g.fillRect(0, 0, mw, mh);
  // 网格地台
  g.strokeStyle = 'rgba(90,110,180,0.25)'; g.lineWidth = 1;
  for (let i = 0; i <= 8; i++) {
    g.beginPath(); g.moveTo(i * 16, 60); g.lineTo(64 + (i * 16 - 64) * 2.2, 96); g.stroke();
  }
  for (let i = 0; i < 4; i++) { const y = 62 + i * i * 3.2; g.beginPath(); g.moveTo(0, y); g.lineTo(mw, y); g.stroke(); }
  const model = MODELS[modelId] || MODELS.badge;
  const cy2 = Math.cos(rotY), sy2 = Math.sin(rotY), cx2 = Math.cos(rotX), sx2 = Math.sin(rotX);
  const proj = model.v.map(p => {
    let x = p[0] * cy2 + p[2] * sy2;
    let z = -p[0] * sy2 + p[2] * cy2;
    let y = p[1] * cx2 - z * sx2;
    z = p[1] * sx2 + z * cx2;
    const d = 210, s = d / (d + z + 120);
    return [64 + x * s * 0.72, 48 - y * s * 0.72, z, x, y];
  });
  const L = [0.5, 0.6, -0.62];
  const faces = model.f.map(f => {
    let zs = 0; for (const vi of f.v) zs += proj[vi][2];
    // 法线（粗略）
    const a = proj[f.v[0]], b = proj[f.v[1]], c = proj[f.v[2]];
    const u = [b[3] - a[3], b[4] - a[4], b[2] - a[2]];
    const w2 = [c[3] - a[3], c[4] - a[4], c[2] - a[2]];
    const n = [u[1] * w2[2] - u[2] * w2[1], u[2] * w2[0] - u[0] * w2[2], u[0] * w2[1] - u[1] * w2[0]];
    const nl = Math.hypot(n[0], n[1], n[2]) || 1;
    let li = (n[0] * L[0] + n[1] * L[1] + n[2] * L[2]) / nl;
    li = 0.72 + Math.abs(li) * 0.55;
    return { z: zs / f.v.length, f, li };
  });
  faces.sort((p, q) => q.z - p.z);
  for (const fc of faces) {
    g.fillStyle = shade(fc.f.c, fc.li);
    g.beginPath();
    const pts = fc.f.v.map(vi => proj[vi]);
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.closePath(); g.fill();
    g.strokeStyle = 'rgba(10,12,24,0.45)'; g.lineWidth = 0.7; g.stroke();
  }
  return m3dCanvas;
}

/* ============================================================
   剧本数据（原创故事）
   ============================================================ */
function S_(who, text, opt) {
  const o = opt || {};
  return { t: 'say', who, text, pose: o.pose, color: o.color, bg: o.bg, name: o.name };
}
function TH(text, opt) { const o = opt || {}; return { t: 'say', who: 'lin', text, pose: o.pose || 'idle', color: 'think', bg: o.bg }; }

const CROSS_DATA = {
  t1: {
    title: '证人证词', sub: '案发当晚看到的东西',
    stmts: [
      { text: '那天晚上，我像平常一样在钟楼里值夜班。',
        press: [S_('guard', '我的班是晚上十点到早上六点。那晚和平时没什么两样……本来是。'),
                TH('（中规中矩……继续听下去吧。）')] },
      { text: '午夜十二点，钟声响了。当时我正在楼下巡逻。',
        ev: 'repair', to: 'obj1',
        press: [S_('lin', '你确定听到了钟声？', { pose: 'idle', color: 'normal' }),
                S_('guard', '当、当然！那口大钟一响，整条街都听得见！咚——咚——足足十二下！', { pose: 'angry' }),
                TH('（钟声……总觉得有哪里不对劲。去证物里找找看。）', { pose: 'idle' })] },
      { text: '钟声一停，顶层就传来了惨叫！',
        ev: 'repair', to: 'obj1',
        press: [S_('guard', '那声惨叫太吓人了，我现在想起来还发抖……'),
                TH('（"钟声一停"……这句话也很可疑。）')] },
      { text: '我立刻冲上顶层，正好看到被告从馆长身边跑开！',
        press: [S_('lin', '从一楼跑到顶层要多久？'),
                S_('guard', '呃……全力跑的话，两三分钟吧。', { pose: 'nervous' }),
                TH('（两三分钟……凶手有充分的时间逃走。为什么偏偏被撞个正着？）')] },
      { text: '他手里还攥着那把扳手！我绝对不会看错！',
        press: [S_('guard', '我当保安二十年了！这双眼睛比监控还好使！', { pose: 'angry' }),
                S_('shuang', '呵。辩护人，请不要浪费法庭的时间。', { pose: 'smirk' })] },
    ],
    failText: '（唔……这个证物和这句证词之间，好像没有矛盾。）',
  },
  t2: {
    title: '证人证词', sub: '目击时的详细情况',
    stmts: [
      { text: '钟、钟没响也一样！我看了手表，那会儿确实是午夜十二点！',
        press: [S_('lin', '什么样的手表？'),
                S_('guard', '喏……普通的指针表。没什么好看的吧！', { pose: 'nervous' }),
                TH('（黑暗中的"指针表"……记住这一点。）')] },
      { text: '当时钟楼停电了，楼道里一片漆黑。',
        press: [S_('guard', '那栋老楼一下暴雨就跳闸，常有的事。'),
                TH('（停电……一片漆黑……）')] },
      { text: '但是借着窗外的月光，我清清楚楚看到了被告的脸！',
        ev: 'weather', to: 'obj2',
        press: [S_('guard', '月光很亮！那张脸我这辈子都忘不了！', { pose: 'angry' }),
                TH('（月光……那天晚上的天气是——！)')] },
      { text: '那家伙随后从西侧楼梯，慌慌张张地逃了下去。',
        press: [S_('lin', '西侧楼梯通向哪里？'),
                S_('guard', '通后门。不过后门常年上锁，钥匙只有管理处才有。'),
                TH('（上锁的后门……他倒是很清楚。）')] },
    ],
    failText: '（不对……这份证物打不中这句证词的要害。）',
  },
};

function buildScript() {
  return [
    /* ---------- 序章 ---------- */
    { t: 'music', v: null }, { t: 'bg', v: 'dark' },
    { t: 'card', text: '午夜 0 时过后', sub: '旧城区 · 钟楼', style: 'dark' },
    { t: 'sfx', v: 'thunder' }, { t: 'flash' },
    S_(null, '……今晚，钟依然没有响。', { name: '？？？' }),
    S_(null, '坏掉的大钟，说谎的黑夜。\n只要钟不响，就没有人知道"正确的时刻"。', { name: '？？？' }),
    { t: 'sfx', v: 'thunder' }, { t: 'flash' },
    S_(null, '——对不起了。\n接下来的一切，就拜托这个"午夜十二点"了。', { name: '？？？' }),
    { t: 'card', text: '逆转法庭', sub: '第 1 章 「午夜的钟声」', style: 'title' },

    /* ---------- 开庭前 ---------- */
    { t: 'music', v: 'lobby' }, { t: 'bg', v: 'lobby' },
    { t: 'card', text: '7月16日 上午 9:40', sub: '地方法院 · 第2候审室', style: 'dark' },
    S_('yu', '前辈！开、开庭时间快到了！', { pose: 'worried' }),
    TH('（事务所的后辈——小雨。从早上开始就一直处于恐慌状态。）', { bg: 'lobby' }),
    S_('lin', '深呼吸，小雨。委托人可比你冷静多了。', { bg: 'lobby' }),
    S_('yu', '可是被告是翔哥啊！我从小认识的翔哥，被当成了杀人犯！', { pose: 'worried' }),
    TH('（被告——高木翔，钟楼的检修学徒。三天前深夜，钟楼管理人白川馆长被人杀害，而在现场发现的凶器上，检出了翔的指纹。）', { bg: 'lobby' }),
    S_('yu', '这是这次案件的资料。前辈，拿好了！'),
    { t: 'ev', v: 'report' }, { t: 'ev', v: 'wrench' }, { t: 'ev', v: 'repair' },
    S_('yu', '还有还有！我顺手把案发当晚的气象记录也调来了。说不定用得上！', { pose: 'happy' }),
    { t: 'ev', v: 'weather' },
    S_('lin', '干得漂亮。……不过，对面可是那位"零败诉的冰之女王"，霜月薰检察官。', { bg: 'lobby' }),
    S_('yu', '呜呜，光听名字就好可怕……', { pose: 'worried' }),
    TH('（没问题。只要抓住证词里的矛盾，真相一定会浮出水面——）', { bg: 'lobby' }),
    S_('lin', '走吧。委托人在等我们。', { bg: 'lobby' }),

    /* ---------- 开庭 ---------- */
    { t: 'card', text: '同日 上午 10:00', sub: '地方法院 第2法庭', style: 'dark' },
    { t: 'music', v: 'court' }, { t: 'bg', v: 'judge' },
    { t: 'sfx', v: 'gavel3' }, { t: 'shake' },
    S_('judge', '现在开庭。被告人高木翔的审理，正式开始。'),
    S_('shuang', '控方准备完毕。……随时可以让辩方"见识现实"。', { pose: 'smirk' }),
    S_('lin', '辩、辩方也准备完毕！', { pose: 'sweat' }),
    S_('judge', '那么霜月检察官，请陈述案情。'),
    S_('shuang', '案发于三天前的深夜，旧城区钟楼的顶层"钟室"。被害人是管理人白川馆长——死因是头部遭钝器重击。'),
    S_('shuang', '凶器是现场遗留的扳手，上面检出了被告的指纹。并且——有证人在案发时刻，亲眼目击了被告！', { pose: 'point' }),
    { t: 'sfx', v: 'murmur' },
    S_('judge', '肃静！……原来如此，物证与人证俱全。', { pose: 'slam' }),
    { t: 'sfx', v: 'gavel' },
    TH('（指纹加上目击证言……正面突破是不可能的。只能从证词里找出突破口了……！）'),
    S_('judge', '控方，请传唤证人出庭。'),
    S_('guard', '本人陈大山！钟楼的夜班保安！这行干了整整二十年！', { pose: 'salute' }),
    S_('shuang', '证人，请就案发当晚"你所看到的东西"，进行证言。'),
    S_('guard', '包在我身上！我这双眼睛，比监控摄像头还好使！'),

    /* ---------- 证词 1 ---------- */
    { t: 'cross', v: 't1' },

    /* ---------- 异议 1 ---------- */
    { t: 'label', v: 'obj1' },
    { t: 'music', v: null },
    { t: 'bubble', v: '异议!', who: 'lin' },
    S_('lin', '证人！你刚才说，你听到了"午夜十二点的钟声"——', { pose: 'point' }),
    S_('guard', '没、没错。那又怎么了？', { pose: 'idle' }),
    S_('lin', '请看这份钟楼的维修记录！', { pose: 'desk' }),
    { t: 'sfx', v: 'slam' }, { t: 'shake' },
    S_('lin', '大钟因为齿轮故障，三天前就已经完全停摆——案发当晚，钟根本不可能响！', { pose: 'point' }),
    { t: 'sfx', v: 'shock' }, { t: 'flash' },
    S_('guard', '什……什么？！', { pose: 'nervous' }),
    { t: 'sfx', v: 'murmur' },
    S_('judge', '停摆的钟……当然不会响。证人！这是怎么回事！', { pose: 'shock' }),
    S_('shuang', '（这个证人……！）', { pose: 'sweat', color: 'think' }),
    S_('guard', '是、是我记错了！对！我是看了手表，才知道是午夜十二点的！', { pose: 'nervous' }),
    TH('（慌慌张张地改口了……这家伙，绝对有问题。）'),
    S_('shuang', '……哼。钟响没响，不过是无关紧要的细节。"目击到被告"这一事实并不动摇。', { pose: 'idle' }),
    S_('judge', '唔……那么证人，请就"目击时的详细情况"，重新证言！'),
    { t: 'music', v: 'cross' },

    /* ---------- 证词 2 ---------- */
    { t: 'cross', v: 't2' },

    /* ---------- 异议 2 ---------- */
    { t: 'label', v: 'obj2' },
    { t: 'music', v: null },
    { t: 'bubble', v: '异议!', who: 'lin' },
    S_('lin', '证人。你说你是借着"月光"，看清了被告的脸？', { pose: 'point' }),
    S_('guard', '对！月光特别亮！'),
    S_('lin', '很遗憾。请看这份气象记录——', { pose: 'desk' }),
    { t: 'sfx', v: 'slam' }, { t: 'shake' },
    S_('lin', '案发当晚是特大暴雨！乌云整夜没有散开。那晚的天空，连一丝月光都不存在！', { pose: 'point' }),
    { t: 'sfx', v: 'shock' }, { t: 'flash' }, { t: 'sfx', v: 'murmur' },
    S_('guard', '呜哇？！', { pose: 'nervous' }),
    S_('judge', '暴雨之夜的月光……！证人，你到底在说什么？！', { pose: 'shock' }),
    S_('guard', '手、手电筒！对，是手电筒！我是用手电筒照到他的脸的！', { pose: 'nervous' }),
    S_('lin', '哦？可是你自己作证说，停电的楼道里"一片漆黑"，而你是靠"指针手表"确认的时间。', { pose: 'idle' }),
    S_('lin', '一片漆黑里看不见表盘。也就是说——在"看到被告"之前，你的手电筒就一直亮着。', { pose: 'point' }),
    S_('lin', '亮着手电筒的你，为什么没有被"凶手"发现？还是说……你根本就不在那里！', { pose: 'desk' }),
    { t: 'sfx', v: 'slam' }, { t: 'shake' },
    S_('shuang', '反对！辩护人在进行毫无根据的想象！', { pose: 'point' }),
    S_('judge', '不……检察官。证人的证词，确实已经前后矛盾了。'),
    S_('judge', '辩护人。你主张证人的这些证词，究竟意味着什么？'),
    { t: 'label', v: 'ask_claim' },
    { t: 'choice', q: '证人的证词意味着什么？', opts: [
      { text: '证人只是记错了细节', to: 'claim_wrong1' },
      { text: '证人从头到尾都在说谎', to: 'claim_right' },
      { text: '（其实我也没搞懂）', to: 'claim_wrong2' },
    ] },
    { t: 'label', v: 'claim_wrong1' },
    S_('shuang', '呵……"记错了"？那不正是控方的主张吗。多谢辩方的赞同。', { pose: 'smirk' }),
    { t: 'damage' },
    TH('（不对不对！要是只是记错，他不会一次次编出新的细节来！）'),
    { t: 'jump', v: 'ask_claim' },
    { t: 'label', v: 'claim_wrong2' },
    S_('judge', '……辩护人。你是来干什么的？', { pose: 'shock' }),
    { t: 'damage' },
    TH('（冷静……！把证词的变化串起来想！）'),
    { t: 'jump', v: 'ask_claim' },

    /* ---------- 指认 ---------- */
    { t: 'label', v: 'claim_right' },
    { t: 'bubble', v: '且慢!', who: 'lin' },
    S_('lin', '证人陈大山——在这个法庭上，从头到尾都在说谎！', { pose: 'point' }),
    { t: 'sfx', v: 'murmur' },
    S_('guard', '你、你说什么？！我为什么要说谎！', { pose: 'angry' }),
    S_('shuang', '有趣。那就请辩方拿出"证人在说谎"的证据吧。拿不出来的话——', { pose: 'smirk' }),
    S_('shuang', '就以侮辱证人罪，当庭收下你的律师徽章。', { pose: 'point' }),
    TH('（呜……！证据、证据……眼下的证物里没有决定性的——）'),
    { t: 'sfx', v: 'shock' },
    S_('yu', '前辈——！！找到了！法院资料室刚刚调出来的东西！', { pose: 'happy', bg: 'defense' }),
    S_('lin', '这是……钟楼大门的"钥匙登记簿"！干得漂亮，小雨！', { pose: 'smile' }),
    { t: 'ev', v: 'keybook' },
    S_('judge', '辩护人！请出示能够证明"证人当晚行动可疑"的证物！'),
    { t: 'present', ev: 'keybook', to: 'final1',
      fail: '（不……这份证物证明不了他当晚的行动。）' },

    /* ---------- 终局 ---------- */
    { t: 'label', v: 'final1' },
    { t: 'music', v: 'cornered' },
    { t: 'bubble', v: '看招!', who: 'lin' },
    S_('lin', '钥匙登记簿。案发当晚 23:20——保安陈大山，领取了"顶层钟室"的钥匙！', { pose: 'point' }),
    S_('guard', '！！', { pose: 'nervous' }),
    S_('lin', '而尸检报告写明：馆长的死亡时刻，是 23:30 前后！', { pose: 'desk' }),
    { t: 'sfx', v: 'slam' }, { t: 'shake' },
    S_('lin', '案发时刻，手握钥匙、能够进入顶层钟室的人——从头到尾，只有一个！', { pose: 'point' }),
    S_('lin', '就是你——证人，陈！大！山！', { pose: 'point' }),
    { t: 'sfx', v: 'shock' }, { t: 'flash' }, { t: 'sfx', v: 'murmur' },
    S_('judge', '肃静！肃静——！', { pose: 'slam' }),
    { t: 'sfx', v: 'gavel3' }, { t: 'shake' },
    S_('guard', '啊……啊、啊啊……', { pose: 'nervous' }),
    { t: 'sfx', v: 'breakdown' }, { t: 'shake' },
    S_('guard', '呜哇啊啊啊啊啊——！！', { pose: 'breakdown' }),
    { t: 'wait', v: 40 },
    S_('guard', '……是馆长先发现的。我在偷偷倒卖钟楼里的古董零件……那天晚上，他把我叫到钟室对质。', { pose: 'breakdown' }),
    S_('guard', '争执中，我抄起了小翔忘在那里的扳手……回过神来的时候，馆长已经……', { pose: 'nervous' }),
    S_('guard', '钟坏了，不会响……我以为，只要把时间说成"钟声响起的午夜"，就没人会怀疑我……', { pose: 'nervous' }),
    { t: 'music', v: null },
    S_('shuang', '…………本席，撤回对被告高木翔的全部指控。', { pose: 'sweat' }),
    S_('judge', '……真相大白了。那么，本庭宣判——'),
    { t: 'verdict', v: '无罪' },
    { t: 'music', v: 'victory' },
    S_('judge', '被告人高木翔——无罪。退庭！', { pose: 'slam' }),
    { t: 'sfx', v: 'gavel3' },

    /* ---------- 尾声 ---------- */
    { t: 'card', text: '同日 下午 1:24', sub: '地方法院 · 第2候审室', style: 'dark' },
    { t: 'music', v: 'lobby' }, { t: 'bg', v: 'lobby' },
    S_('yu', '我们赢啦——！前辈你刚才超帅的！翔哥都哭了，说一定要请我们吃大餐！', { pose: 'happy' }),
    S_('lin', '呼……总算是撑下来了。', { bg: 'lobby', pose: 'smile' }),
    S_('yu', '话说前辈，最后那一下"就是你——！"，你练过多少遍呀？', { pose: 'happy' }),
    S_('lin', '咳、咳咳。那是临场发挥。', { bg: 'lobby', pose: 'sweat' }),
    TH('（守护相信你的人，直到最后一刻。——这就是，律师的工作。）', { bg: 'lobby' }),
    S_('yu', '对了对了！下一份委托书已经寄到事务所了哦！'),
    S_('lin', '…………先让我睡一天再说。', { bg: 'lobby', pose: 'sweat' }),
    S_('yu', '啊哈哈哈！', { pose: 'happy' }),
    { t: 'card', text: '第 1 章 「午夜的钟声」', sub: '—— 完 ——', style: 'title' },
    { t: 'credits' },
  ];
}

/* ============================================================
   引擎状态
   ============================================================ */
const G = {
  mode: 'title',      // title, talk, cross, record, detail, choice, present, verdict, gameover, credits, card
  tick: 0,
  script: [], labels: {},
  frames: [],          // [{nodes, pc, onDone}]
  bg: 'dark', charId: null, pose: 'idle', nameOverride: null,
  text: '', textColor: 'normal', textName: '', textShown: 0, typing: false,
  waitTimer: 0,
  court: ['badge'],    // 持有证物
  health: 5, inTrial: false,
  // cross-exam
  cross: null, crossIdx: 0, crossPhase: 'testify',
  // record overlay
  recReturn: 'talk', recSel: 0, recPresent: false,
  // detail 3d
  rotY: 0.6, rotX: -0.35, dragging: false, dragSX: 0, dragSY: 0, dragRY: 0, dragRX: 0,
  // choice
  choice: null, choiceSel: 0,
  // present (standalone)
  present: null,
  // card
  card: null, cardT: 0,
  // bubble
  bubble: null, bubbleT: 0,
  // effects
  flashT: 0, shakeT: 0, penaltyT: 0,
  toast: null, toastT: 0,
  confetti: [], verdictT: 0, verdictText: '',
  checkpoint: null,
  creditsT: 0,
  started: false,
};

function topFrame() { return G.frames[G.frames.length - 1]; }
function pushFrame(nodes, onDone) { G.frames.push({ nodes, pc: 0, onDone }); }

function startGame() {
  G.script = buildScript();
  G.labels = {};
  G.script.forEach((n, i) => { if (n.t === 'label') G.labels[n.v] = i; });
  G.frames = [{ nodes: G.script, pc: 0, onDone: null }];
  G.court = ['badge']; G.health = 5; G.inTrial = false;
  G.mode = 'talk'; G.charId = null; G.bg = 'dark';
  G.started = true;
  step();
}

function jumpTo(label) {
  G.frames = [{ nodes: G.script, pc: G.labels[label] !== undefined ? G.labels[label] : 0, onDone: null }];
  G.cross = null;
  G.mode = 'talk';
  step();
}

/* 执行剧本，直到需要等待 */
function step() {
  for (let guard = 0; guard < 400; guard++) {
    const fr = topFrame();
    if (!fr) return;
    if (fr.pc >= fr.nodes.length) {
      G.frames.pop();
      const cb = fr.onDone;
      if (cb) { cb(); return; }
      if (!G.frames.length) { G.mode = 'credits'; G.creditsT = 0; return; }
      continue;
    }
    const n = fr.nodes[fr.pc++];
    switch (n.t) {
      case 'say': {
        if (n.bg) G.bg = n.bg;
        if (n.who && CHARS[n.who]) {
          G.charId = n.who;
          if (!n.bg) G.bg = CHARS[n.who].bg;
          G.pose = n.pose || 'idle';
          G.textName = n.name || CHARS[n.who].name;
        } else {
          G.charId = null; G.pose = 'idle';
          G.textName = n.name || '';
        }
        G.text = n.text; G.textShown = 0; G.typing = true;
        G.textColor = n.color || 'normal';
        G.mode = 'talk';
        return;
      }
      case 'bg': G.bg = n.v; break;
      case 'music': Music.play(n.v); break;
      case 'sfx': if (SFX[n.v]) SFX[n.v](); break;
      case 'wait': G.waitTimer = n.v; G.mode = 'wait'; return;
      case 'flash': G.flashT = 10; break;
      case 'shake': G.shakeT = 14; shakeShell(); break;
      case 'card':
        G.card = n; G.cardT = 0; G.mode = 'card'; SFX.swish();
        return;
      case 'ev':
        if (G.court.indexOf(n.v) < 0) G.court.push(n.v);
        G.toast = n.v; G.toastT = 999; SFX.item();
        G.mode = 'toast';
        return;
      case 'label': break;
      case 'jump': jumpTo(n.v); return;
      case 'bubble':
        G.bubble = n; G.bubbleT = 0; G.mode = 'bubble';
        SFX.shout(); G.flashT = 8; G.shakeT = 16; shakeShell();
        return;
      case 'damage': applyPenalty(); if (G.health <= 0) return; break;
      case 'gameover': G.mode = 'gameover'; return;
      case 'choice':
        G.choice = n; G.choiceSel = 0; G.mode = 'choice';
        G.text = n.q; G.typing = false; G.textShown = n.q.length;
        G.textName = ''; G.textColor = 'normal';
        return;
      case 'cross': startCross(n.v, fr.pc - 1); return;
      case 'present':
        G.present = n; G.checkpoint = { pc: fr.pc - 1, music: Music.cur };
        G.inTrial = true;
        openRecord('present-standalone');
        return;
      case 'verdict':
        G.mode = 'verdict'; G.verdictT = 0; G.verdictText = n.v;
        G.confetti = [];
        Music.stop();
        return;
      case 'credits': G.mode = 'credits'; G.creditsT = 0; Music.play('title'); return;
    }
  }
}

function shakeShell() {
  shellEl.classList.remove('shakeX'); void shellEl.offsetWidth; shellEl.classList.add('shakeX');
}

function applyPenalty() {
  G.health--; G.penaltyT = 40; G.flashT = 8; G.shakeT = 14;
  SFX.damage(); shakeShell();
  if (G.health <= 0) {
    Music.stop();
    G.frames = [{ nodes: [
      S_('judge', '……辩方的主张，已经完全失去了说服力。', { pose: 'idle' }),
      S_('shuang', '呵。看来结果早已注定了呢。', { pose: 'smirk' }),
      S_('judge', '本庭宣判——被告人高木翔，有罪。', { pose: 'slam' }),
      { t: 'sfx', v: 'gavel3' },
      { t: 'verdict', v: '有罪' },
      { t: 'gameover' },
    ], pc: 0, onDone: null }];
    G.mode = 'talk';
    step();
  }
}

/* ---------- 对质询问 ---------- */
function startCross(id, nodeIdx) {
  const data = CROSS_DATA[id];
  G.cross = { id, data, };
  G.crossIdx = 0; G.crossPhase = 'testify';
  G.inTrial = true;
  G.checkpoint = { pc: nodeIdx, music: Music.cur || 'cross' };
  Music.play('cross');
  // 证词标题卡
  G.card = { t: 'card', text: data.title, sub: '～ ' + data.sub + ' ～', style: 'testimony' };
  G.cardT = 0; G.mode = 'card'; SFX.swish();
}
function crossShowStmt() {
  const st = G.cross.data.stmts[G.crossIdx];
  G.charId = 'guard'; G.bg = 'witness'; G.pose = 'idle';
  G.textName = CHARS.guard.name;
  G.text = st.text; G.textShown = 0; G.typing = true;
  G.textColor = 'green';
  G.mode = 'cross';
}
function crossNext(dir) {
  const n = G.cross.data.stmts.length;
  G.crossIdx = (G.crossIdx + dir + n) % n;
  SFX.move();
  crossShowStmt();
}
function crossPress() {
  const st = G.cross.data.stmts[G.crossIdx];
  SFX.sting();
  const nodes = [{ t: 'bubble', v: '且慢!', who: 'lin' }].concat(st.press);
  pushFrame(nodes, () => { G.mode = 'cross'; crossShowStmt(); });
  step();
}
function crossPresent(evId) {
  const st = G.cross.data.stmts[G.crossIdx];
  closeRecord();
  if (st.ev && st.ev === evId) {
    const to = st.to;
    G.cross = null;
    jumpTo(to);
  } else {
    const nodes = [
      S_('shuang', '……哦？辩护人，你想用那个证明什么？', { pose: 'smirk' }),
      S_('judge', '辩护人，请不要提出无关的证物。'),
      { t: 'damage' },
      TH(G.cross.data.failText),
    ];
    pushFrame(nodes, () => { if (G.health > 0) { G.mode = 'cross'; crossShowStmt(); } });
    step();
  }
}

/* ---------- 法庭记录 ---------- */
function openRecord(returnMode) {
  G.recReturn = returnMode || G.mode;
  G.recSel = 0; G.recPresent = (returnMode === 'present-cross' || returnMode === 'present-standalone');
  G.mode = 'record';
  SFX.ok();
}
function closeRecord() {
  if (G.recReturn === 'present-cross') G.mode = 'cross';
  else if (G.recReturn === 'present-standalone') G.mode = 'present';
  else G.mode = G.recReturn;
}
function recordConfirmPresent() {
  const evId = G.court[G.recSel];
  if (G.recReturn === 'present-cross') { crossPresent(evId); return; }
  if (G.recReturn === 'present-standalone') {
    const pr = G.present;
    G.mode = 'talk';
    if (evId === pr.ev) {
      SFX.ok(); G.present = null; jumpTo(pr.to);
    } else {
      const nodes = [
        S_('shuang', '……就这？辩方的底牌，未免太让人失望了。', { pose: 'smirk' }),
        { t: 'damage' },
        TH(pr.fail),
      ];
      pushFrame(nodes, () => { if (G.health > 0) openRecord('present-standalone'); });
      step();
    }
  }
}

/* ============================================================
   渲染 —— 上屏
   ============================================================ */
function wrapText(g, text, maxW) {
  const out = []; let line = '';
  for (const ch of text) {
    if (ch === '\n') { out.push(line); line = ''; continue; }
    if (g.measureText(line + ch).width > maxW) { out.push(line); line = ch; }
    else line += ch;
  }
  if (line) out.push(line);
  return out;
}

function drawTextboxTop(g) {
  if (!G.text) return;
  const bx = 3, by2 = 138, bw = 250, bh = 51;
  g.fillStyle = 'rgba(8,10,28,0.88)'; g.fillRect(bx, by2, bw, bh);
  g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 1; g.strokeRect(bx + 1.5, by2 + 1.5, bw - 3, bh - 3);
  g.strokeStyle = 'rgba(120,140,220,0.5)'; g.strokeRect(bx + 3.5, by2 + 3.5, bw - 7, bh - 7);
  if (G.textName) {
    const nw = Math.max(G.textName.length * 11 + 14, 46);
    g.fillStyle = '#232b56'; g.fillRect(bx + 2, by2 - 13, nw, 14);
    g.strokeStyle = 'rgba(255,255,255,0.7)'; g.strokeRect(bx + 2.5, by2 - 12.5, nw - 1, 13);
    txt(g, G.textName, bx + 8, by2 - 3, 'bold 10px ' + FONT, '#fff');
  }
  const colMap = { normal: '#f5f5f5', green: '#7dfa8c', think: '#87c9ff' };
  g.font = '11px ' + FONT;
  const shown = G.text.slice(0, Math.floor(G.textShown));
  const lines = wrapText(g, shown, 234);
  g.fillStyle = colMap[G.textColor] || '#f5f5f5';
  g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  for (let i = 0; i < Math.min(lines.length, 3); i++) g.fillText(lines[i], bx + 9, by2 + 16 + i * 15);
  if (!G.typing && (G.tick >> 4) % 2 === 0) {
    tri(g, [bx + bw - 14, by2 + bh - 9], [bx + bw - 6, by2 + bh - 9], [bx + bw - 10, by2 + bh - 4], '#ffd75e');
  }
}

function drawHealth(g) {
  if (!G.inTrial) return;
  const x = 168, y = 6;
  txt(g, '辩护', x - 24, y + 8, 'bold 9px ' + FONT, '#cfd6ff');
  g.fillStyle = 'rgba(0,0,10,0.6)'; g.fillRect(x - 2, y - 2, 84, 12);
  g.strokeStyle = '#9aa4d4'; g.lineWidth = 1; g.strokeRect(x - 1.5, y - 1.5, 83, 11);
  for (let i = 0; i < 5; i++) {
    const on = i < G.health;
    const flash = G.penaltyT > 0 && i === G.health && (G.tick >> 2) % 2 === 0;
    g.fillStyle = flash ? '#ff5040' : (on ? '#4fe06a' : '#26304a');
    g.fillRect(x + i * 16, y, 14, 8);
  }
}

function drawBubbleFX(g) {
  const bt = G.bubbleT;
  // 速度线
  if (bt < 26) {
    g.fillStyle = 'rgba(255,255,255,' + Math.max(0, 0.85 - bt * 0.033) + ')';
    g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(20,20,30,0.7)'; g.lineWidth = 2;
    for (let i = 0; i < 22; i++) {
      const a = i / 22 * Math.PI * 2 + 0.13;
      g.beginPath();
      g.moveTo(128 + Math.cos(a) * 46, 96 + Math.sin(a) * 36);
      g.lineTo(128 + Math.cos(a) * 220, 96 + Math.sin(a) * 180);
      g.stroke();
    }
  }
  const sc = bt < 5 ? 1.6 - bt * 0.12 : 1 + Math.sin(bt * 0.5) * 0.02;
  const ox = (bt < 12) ? (Math.random() * 6 - 3) : 0;
  const oy = (bt < 12) ? (Math.random() * 4 - 2) : 0;
  g.save(); g.translate(128 + ox, 88 + oy); g.scale(sc, sc);
  // 锯齿气泡
  g.beginPath();
  const spikes = 14;
  for (let i = 0; i < spikes * 2; i++) {
    const a = i / (spikes * 2) * Math.PI * 2;
    const r = i % 2 === 0 ? 1 : 0.82;
    const rx = 86 * r, ry = 44 * r;
    const x = Math.cos(a) * rx, y = Math.sin(a) * ry;
    if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
  }
  g.closePath();
  g.fillStyle = '#fff'; g.fill();
  g.lineWidth = 4; g.strokeStyle = '#16161c'; g.stroke();
  g.lineWidth = 2; g.strokeStyle = '#c81e14'; g.stroke();
  txt(g, G.bubble.v, 0, 12, 'bold 34px ' + FONT, '#c81e14', 'center');
  g.lineWidth = 1.4; g.strokeStyle = '#5c0a06';
  g.strokeText(G.bubble.v, 0, 12);
  g.restore();
}

function drawCardFX(g) {
  const n = G.card, t2 = G.cardT;
  g.fillStyle = n.style === 'testimony' ? 'rgba(6,8,20,0.94)' : '#04050c';
  g.fillRect(0, 0, W, H);
  const slide = Math.min(1, t2 / 16);
  const lw = W * slide;
  if (n.style === 'testimony') {
    g.fillStyle = '#d88a1e';
    g.fillRect(128 - lw / 2, 62, lw, 2); g.fillRect(128 - lw / 2, 128, lw, 2);
    txt(g, n.text, 128, 100, 'bold 24px ' + FONT, '#f5b942', 'center');
    g.strokeStyle = '#7a4a08'; g.lineWidth = 1; g.strokeText(n.text, 128, 100);
    if (n.sub) txt(g, n.sub, 128, 120, '11px ' + FONT, '#e8d5a8', 'center');
  } else if (n.style === 'title') {
    g.fillStyle = '#c9a53f';
    g.fillRect(128 - lw / 2, 56, lw, 2); g.fillRect(128 - lw / 2, 134, lw, 2);
    txt(g, n.text, 128, 96, 'bold 26px ' + FONT, '#e8cf7a', 'center');
    if (n.sub) txt(g, n.sub, 128, 120, 'bold 12px ' + FONT, '#fff', 'center');
  } else {
    txt(g, n.text, 128, 90, 'bold 14px ' + FONT, '#e8e8f0', 'center');
    if (n.sub) txt(g, n.sub, 128, 110, '11px ' + FONT, '#9aa4c4', 'center');
  }
  if (t2 > 30 && (G.tick >> 4) % 2 === 0) txt(g, '▼', 128, 176, '10px ' + FONT, '#8890b8', 'center');
}

function drawVerdictFX(g) {
  const t2 = G.verdictT;
  g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(0, 0, W, H);
  const chars = G.verdictText.split('');
  const isGood = G.verdictText === '无罪';
  chars.forEach((ch, i) => {
    const at = t2 - i * 18;
    if (at < 0) return;
    const sc = at < 8 ? 3 - at * 0.25 : 1;
    const alpha = Math.min(1, at / 6);
    g.save();
    g.translate(88 + i * 82, 96);
    g.scale(sc, sc);
    g.globalAlpha = alpha;
    g.font = 'bold 56px ' + FONT; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = isGood ? '#ffffff' : '#d42a1e';
    g.fillText(ch, 0, 0);
    g.lineWidth = 2.5; g.strokeStyle = isGood ? '#3a6bd4' : '#5c0a06';
    g.strokeText(ch, 0, 0);
    g.restore();
  });
  // 彩带（无罪）
  if (isGood && t2 > chars.length * 18 + 8) {
    if (G.confetti.length === 0) {
      for (let i = 0; i < 70; i++) G.confetti.push({
        x: Math.random() * W, y: -Math.random() * 120,
        vx: (Math.random() - 0.5) * 1.2, vy: 0.8 + Math.random() * 1.6,
        c: ['#ff5c5c', '#ffd75e', '#63e06a', '#5eb8ff', '#d78cff', '#fff'][(Math.random() * 6) | 0],
        w: 3 + Math.random() * 3, ph: Math.random() * 6
      });
      SFX.item();
    }
    for (const p of G.confetti) {
      p.x += p.vx + Math.sin(G.tick * 0.1 + p.ph) * 0.6; p.y += p.vy;
      if (p.y > H) { p.y = -6; p.x = Math.random() * W; }
      g.fillStyle = p.c; g.fillRect(p.x, p.y, p.w, p.w * 0.6);
    }
  }
  if (t2 > chars.length * 18 + 30 && (G.tick >> 4) % 2 === 0)
    txt(g, '▼ 点击继续', 128, 180, '10px ' + FONT, '#cfd6ff', 'center');
}

function drawToastFX(g) {
  const ev = EVIDENCE[G.toast];
  if (!ev) return;
  const y = 50;
  g.fillStyle = 'rgba(10,12,30,0.94)'; g.fillRect(38, y, 180, 64);
  g.strokeStyle = '#ffd75e'; g.lineWidth = 1.6; g.strokeRect(39, y + 1, 178, 62);
  txt(g, '收到证物', 128, y + 15, 'bold 11px ' + FONT, '#ffd75e', 'center');
  drawEvIcon(g, G.toast, 52, y + 24, 30);
  txt(g, ev.name, 92, y + 38, 'bold 12px ' + FONT, '#fff');
  txt(g, ev.short, 92, y + 53, '9px ' + FONT, '#9aa4c4');
  if ((G.tick >> 4) % 2 === 0) txt(g, '▼', 204, y + 56, '9px ' + FONT, '#ffd75e');
}

function drawRecordTop(g) {
  // 背景暗化场景
  drawScene(g, true);
  g.fillStyle = 'rgba(4,6,16,0.82)'; g.fillRect(0, 0, W, H);
  const evId = G.court[G.recSel];
  const ev = EVIDENCE[evId];
  if (!ev) return;
  // 证物大卡
  g.fillStyle = 'rgba(20,26,54,0.95)'; g.fillRect(18, 14, 220, 164);
  g.strokeStyle = '#8890c8'; g.lineWidth = 1.4; g.strokeRect(19, 15, 218, 162);
  txt(g, ev.name, 128, 34, 'bold 15px ' + FONT, '#ffd75e', 'center');
  drawEvIcon(g, evId, 36, 46, 56);
  txt(g, ev.short, 104, 62, 'bold 10px ' + FONT, '#9adcff');
  g.font = '10px ' + FONT;
  const lines = wrapText(g, ev.desc, 192);
  g.fillStyle = '#e8e8f0';
  lines.forEach((ln, i) => { if (i < 5) g.fillText(ln, 32, 118 + i * 13); });
}

function drawDetailTop(g) {
  const evId = G.court[G.recSel];
  const ev = EVIDENCE[evId];
  g.fillStyle = '#080a18'; g.fillRect(0, 0, W, H);
  const c3d = render3D(ev.model, G.rotY, G.rotX, G.tick);
  g.imageSmoothingEnabled = false;
  g.drawImage(c3d, 0, 0, 128, 96, 4, 18, 248, 186 - 30);
  g.strokeStyle = '#3c4668'; g.lineWidth = 1; g.strokeRect(4.5, 18.5, 247, 155);
  txt(g, ev.name + ' 〔证物检视〕', 128, 12, 'bold 10px ' + FONT, '#ffd75e', 'center');
  txt(g, '拖动下屏旋转 · 点击返回', 128, 184, '9px ' + FONT, '#8890b8', 'center');
}

function drawScene(g, noBox) {
  const shake = G.shakeT > 0 ? Math.round(Math.sin(G.tick * 1.7) * Math.min(4, G.shakeT * 0.4)) : 0;
  g.save();
  g.translate(shake, 0);
  (BG[G.bg] || BG.court)(g, G.tick);
  if (G.charId && CHARS[G.charId]) {
    CHARS[G.charId].draw(g, { pose: G.pose, talking: G.typing, t: G.tick });
  }
  drawForeground(g, G.bg);
  g.restore();
  if (!noBox) drawTextboxTop(g);
}

function renderTop() {
  const g = gT;
  g.clearRect(0, 0, W, H);
  if (G.mode === 'title') { drawTitleTop(g); return; }
  if (G.mode === 'credits') { drawCreditsTop(g); return; }
  if (G.mode === 'card') { drawCardFX(g); return; }
  if (G.mode === 'record' || G.mode === 'present') { drawRecordTop(g); drawHealth(g); return; }
  if (G.mode === 'detail') { drawDetailTop(g); return; }

  drawScene(g);
  drawHealth(g);

  if (G.mode === 'bubble') drawBubbleFX(g);
  if (G.mode === 'toast') drawToastFX(g);
  if (G.mode === 'verdict') drawVerdictFX(g);
  if (G.mode === 'gameover') drawGameoverTop(g);

  if (G.flashT > 0) { g.fillStyle = 'rgba(255,255,255,' + (G.flashT / 10 * 0.75) + ')'; g.fillRect(0, 0, W, H); }
  if (G.penaltyT > 20) { g.fillStyle = 'rgba(200,30,20,' + ((G.penaltyT - 20) / 20 * 0.3) + ')'; g.fillRect(0, 0, W, H); }
}

function drawTitleTop(g) {
  const t = G.tick;
  // 夜空渐变
  const gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, '#0a0c22'); gr.addColorStop(0.7, '#141838'); gr.addColorStop(1, '#232b56');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  // 星
  for (let i = 0; i < 40; i++) {
    const x = (i * 67) % W, y = (i * 41) % 110;
    const tw = (Math.sin(t * 0.05 + i) + 1) / 2;
    g.fillStyle = 'rgba(220,230,255,' + (0.2 + tw * 0.5) + ')';
    g.fillRect(x, y, 1.6, 1.6);
  }
  // 钟楼剪影
  rc(g, 106, 60, 44, 132, '#080a18');
  tri(g, [106, 60], [150, 60], [128, 34], '#080a18');
  ci(g, 128, 82, 13, '#141a30');
  g.strokeStyle = '#4a5688'; g.lineWidth = 1;
  g.beginPath(); g.arc(128, 82, 13, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.moveTo(128, 82); g.lineTo(128, 72); g.stroke();
  g.beginPath(); g.moveTo(128, 82); g.lineTo(133, 82); g.stroke();
  // 月
  ci(g, 205, 40, 17, '#f2ecd0'); ci(g, 199, 36, 15, gr);
  // 地面
  rc(g, 0, 176, W, 16, '#0a0c1c');
  // LOGO
  g.save();
  g.translate(128, 0);
  txt(g, '逆转法庭', 0, 106, 'bold 34px ' + FONT, '#e8cf7a', 'center');
  g.lineWidth = 2; g.strokeStyle = '#6b5310'; g.strokeText('逆转法庭', 0, 106);
  g.restore();
  rc(g, 58, 116, 140, 2, '#c9a53f');
  txt(g, '～ 午夜的钟声 ～', 128, 134, 'bold 13px ' + FONT, '#fff', 'center');
  txt(g, 'NDS STYLE COURTROOM GAME', 128, 150, '8px ' + FONT, '#8890b8', 'center');
  if ((t >> 5) % 2 === 0) txt(g, '- 触摸下屏开始 -', 128, 170, 'bold 11px ' + FONT, '#ffd75e', 'center');
}

function drawCreditsTop(g) {
  g.fillStyle = '#04050c'; g.fillRect(0, 0, W, H);
  const items = [
    ['逆转法庭 ～午夜的钟声～', 'bold 16px', '#e8cf7a'],
    ['', '', ''],
    ['原创剧本 / 程序 / 美术 / 音乐', '10px', '#cfd6ff'],
    ['全部图形 · Canvas 程序化像素绘制', '10px', '#9aa4c4'],
    ['全部音频 · WebAudio 实时合成', '10px', '#9aa4c4'],
    ['低面数证物 · 软件 3D 渲染', '10px', '#9aa4c4'],
    ['', '', ''],
    ['玩法致敬经典法庭辩论游戏', '10px', '#cfd6ff'],
    ['', '', ''],
    ['—— 感谢游玩 ——', 'bold 13px', '#ffd75e'],
  ];
  const scrollY = Math.max(0, 150 - G.creditsT * 0.5);
  items.forEach((it, i) => {
    if (!it[0]) return;
    txt(g, it[0], 128, 40 + i * 17 + scrollY, it[1] + ' ' + FONT, it[2], 'center');
  });
  if (G.creditsT > 200 && (G.tick >> 4) % 2 === 0)
    txt(g, '▼ 点击返回标题', 128, 184, '9px ' + FONT, '#8890b8', 'center');
}

function drawGameoverTop(g) {
  g.fillStyle = 'rgba(0,0,0,0.72)'; g.fillRect(0, 0, W, H);
  txt(g, 'GAME OVER', 128, 78, 'bold 24px ' + FONT, '#d42a1e', 'center');
  txt(g, '辩护失败……被告被判有罪。', 128, 104, '11px ' + FONT, '#e8e8f0', 'center');
  txt(g, '但是——放弃的话，审判就真的结束了。', 128, 122, '10px ' + FONT, '#9aa4c4', 'center');
}

/* ============================================================
   渲染 —— 下屏（触摸 UI）
   ============================================================ */
let BTNS = [];
function btn(g, x, y, w, h, label, opts) {
  opts = opts || {};
  const base = opts.color || '#2a3158';
  const gr = g.createLinearGradient(0, y, 0, y + h);
  gr.addColorStop(0, shade(base, 1.35)); gr.addColorStop(0.5, base); gr.addColorStop(1, shade(base, 0.7));
  g.fillStyle = gr; g.fillRect(x, y, w, h);
  g.strokeStyle = opts.border || '#8890c8'; g.lineWidth = 1.4; g.strokeRect(x + 1, y + 1, w - 2, h - 2);
  g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 1; g.strokeRect(x + 3, y + 3, w - 6, h - 6);
  txt(g, label, x + w / 2, y + h / 2 + 1, (opts.font || 'bold 12px') + ' ' + FONT, opts.text || '#fff', 'center', 'middle');
  if (opts.id) BTNS.push({ x, y, w, h, id: opts.id });
}
function drawBtmBase(g) {
  const gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, '#181c34'); gr.addColorStop(1, '#0a0c1c');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(120,140,220,0.16)'; g.lineWidth = 1;
  for (let y = 0; y < H; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
}
function sideButtons(g, showRecord) {
  if (showRecord) btn(g, 198, 6, 52, 20, '证物', { id: 'record', color: '#3d3358', font: 'bold 10px' });
  btn(g, 6, 6, 52, 20, lcdTop.classList.contains('on') ? '滤镜:开' : '滤镜:关', { id: 'lcd', color: '#22283e', font: '9px', text: '#9aa4c4' });
}

function renderBtm() {
  const g = gB;
  BTNS = [];
  g.clearRect(0, 0, W, H);

  if (G.mode === 'title') {
    drawBtmBase(g);
    txt(g, 'TOUCH SCREEN', 128, 34, '9px ' + FONT, '#5a6288', 'center');
    btn(g, 48, 62, 160, 40, '开始游戏', { id: 'start', color: '#3d3358', font: 'bold 16px' });
    btn(g, 48, 116, 160, 30, (lcdTop.classList.contains('on') ? '液晶滤镜：开' : '液晶滤镜：关'), { id: 'lcd', color: '#22283e', font: 'bold 11px' });
    txt(g, '耳机/音箱体验更佳 · 全程合成音频', 128, 168, '9px ' + FONT, '#5a6288', 'center');
    return;
  }
  if (G.mode === 'credits') {
    drawBtmBase(g);
    btn(g, 58, 76, 140, 36, '返回标题', { id: 'to-title', color: '#3d3358' });
    return;
  }
  if (G.mode === 'gameover') {
    drawBtmBase(g);
    txt(g, '要从询问开始重新挑战吗？', 128, 46, 'bold 12px ' + FONT, '#e8e8f0', 'center');
    btn(g, 48, 70, 160, 38, '重新挑战', { id: 'retry', color: '#58332a', font: 'bold 14px' });
    btn(g, 48, 120, 160, 30, '回到标题', { id: 'to-title', color: '#22283e', font: 'bold 11px' });
    return;
  }
  if (G.mode === 'card' || G.mode === 'toast' || G.mode === 'verdict' || G.mode === 'bubble' || G.mode === 'wait') {
    drawBtmBase(g);
    if (G.mode !== 'bubble' && G.mode !== 'wait') {
      btn(g, 58, 76, 140, 40, '▼ 继续', { id: 'advance', color: '#2a3158' });
    } else {
      txt(g, '……', 128, 96, 'bold 14px ' + FONT, '#5a6288', 'center');
    }
    return;
  }
  if (G.mode === 'talk') {
    drawBtmBase(g);
    sideButtons(g, true);
    const pulse = (G.tick >> 5) % 2 === 0;
    btn(g, 48, 66, 160, 52, G.typing ? '▼▼' : '▼ 继续', { id: 'advance', color: pulse ? '#2a3158' : '#242a4c' });
    txt(g, '空格/回车 也可以推进对话', 128, 150, '9px ' + FONT, '#5a6288', 'center');
    return;
  }
  if (G.mode === 'cross') {
    drawBtmBase(g);
    sideButtons(g, false);
    const n = G.cross.data.stmts.length;
    txt(g, '对质询问', 128, 17, 'bold 12px ' + FONT, '#f5b942', 'center', 'middle');
    // 证词指示点
    for (let i = 0; i < n; i++) {
      const x = 128 - n * 8 + i * 16 + 4;
      g.fillStyle = i === G.crossIdx ? '#ffd75e' : '#3c4668';
      ci(g, x, 32, i === G.crossIdx ? 4 : 3, g.fillStyle);
    }
    btn(g, 8, 44, 74, 34, '◀ 上一句', { id: 'prev', color: '#22283e', font: 'bold 10px' });
    btn(g, 174, 44, 74, 34, '下一句 ▶', { id: 'next', color: '#22283e', font: 'bold 10px' });
    btn(g, 90, 44, 76, 34, G.typing ? '▼▼' : '继续 ▼', { id: 'advance', color: '#2a3158', font: 'bold 10px' });
    // 大按钮
    btn(g, 8, 92, 116, 56, '追  问', { id: 'press', color: '#1e4a7a', border: '#7ab8ff', font: 'bold 17px' });
    btn(g, 132, 92, 116, 56, '出示证物', { id: 'present', color: '#7a1e1e', border: '#ff8a7a', font: 'bold 16px' });
    txt(g, '发现矛盾时，选中证词并「出示证物」！', 128, 166, '9px ' + FONT, '#8890b8', 'center');
    txt(g, '←→切换证词  Z追问  X出示  R证物', 128, 180, '8px ' + FONT, '#5a6288', 'center');
    return;
  }
  if (G.mode === 'record' || G.mode === 'present') {
    drawBtmBase(g);
    const isPresent = G.recPresent || G.mode === 'present';
    txt(g, isPresent ? '出示哪个证物？' : '法庭记录', 128, 16, 'bold 12px ' + FONT, isPresent ? '#ff9a8a' : '#ffd75e', 'center', 'middle');
    // 网格
    const cols = 4, cs = 46, gap = 12, sx = 128 - (cols * cs + (cols - 1) * gap) / 2, sy = 30;
    G.court.forEach((id, i) => {
      const x = sx + (i % cols) * (cs + gap), y = sy + Math.floor(i / cols) * (cs + 10);
      g.fillStyle = i === G.recSel ? '#3c4668' : '#20263e';
      g.fillRect(x - 3, y - 3, cs + 6, cs + 6);
      g.strokeStyle = i === G.recSel ? '#ffd75e' : '#3c4668'; g.lineWidth = i === G.recSel ? 2 : 1;
      g.strokeRect(x - 2.5, y - 2.5, cs + 5, cs + 5);
      drawEvIcon(g, id, x, y, cs);
      BTNS.push({ x: x - 3, y: y - 3, w: cs + 6, h: cs + 6, id: 'ev-' + i });
    });
    // 名称条
    const ev = EVIDENCE[G.court[G.recSel]];
    g.fillStyle = '#141a30'; g.fillRect(20, 138, 216, 18);
    g.strokeStyle = '#3c4668'; g.strokeRect(20.5, 138.5, 215, 17);
    txt(g, ev ? (ev.name + ' — ' + ev.short) : '', 128, 148, 'bold 10px ' + FONT, '#fff', 'center', 'middle');
    // 按钮
    if (isPresent) {
      btn(g, 12, 162, 72, 24, '返回', { id: 'rec-back', color: '#22283e', font: 'bold 10px' });
      btn(g, 92, 162, 72, 24, '检视', { id: 'rec-detail', color: '#2a3158', font: 'bold 10px' });
      btn(g, 172, 162, 72, 24, '出示！', { id: 'rec-present', color: '#7a1e1e', border: '#ff8a7a', font: 'bold 11px' });
    } else {
      btn(g, 32, 162, 88, 24, '返回', { id: 'rec-back', color: '#22283e', font: 'bold 10px' });
      btn(g, 136, 162, 88, 24, '检视 (3D)', { id: 'rec-detail', color: '#2a3158', font: 'bold 10px' });
    }
    return;
  }
  if (G.mode === 'detail') {
    drawBtmBase(g);
    txt(g, '· 证物检视 ·', 128, 20, 'bold 12px ' + FONT, '#ffd75e', 'center', 'middle');
    g.strokeStyle = '#3c4668'; g.lineWidth = 1;
    g.strokeRect(28.5, 34.5, 199, 108);
    txt(g, '在此区域拖动 → 旋转模型', 128, 88, '10px ' + FONT, '#8890b8', 'center', 'middle');
    BTNS.push({ x: 28, y: 34, w: 200, h: 108, id: 'drag-zone' });
    btn(g, 78, 154, 100, 26, '返回', { id: 'detail-back', color: '#22283e', font: 'bold 11px' });
    return;
  }
  if (G.mode === 'choice') {
    drawBtmBase(g);
    txt(g, '—— 请选择 ——', 128, 18, 'bold 12px ' + FONT, '#ffd75e', 'center', 'middle');
    G.choice.opts.forEach((o, i) => {
      const y = 34 + i * 48;
      btn(g, 20, y, 216, 38, o.text, {
        id: 'choice-' + i,
        color: i === G.choiceSel ? '#3d3358' : '#22283e',
        border: i === G.choiceSel ? '#ffd75e' : '#3c4668',
        font: 'bold 12px'
      });
    });
    return;
  }
  drawBtmBase(g);
}

/* ============================================================
   输入
   ============================================================ */
function advance() {
  if (G.typing) { G.textShown = G.text.length; G.typing = false; return; }
  switch (G.mode) {
    case 'talk': SFX.blip(1); step(); break;
    case 'cross': {
      // 证词推进
      if (G.crossPhase === 'testify') {
        if (G.crossIdx < G.cross.data.stmts.length - 1) { G.crossIdx++; crossShowStmt(); }
        else {
          G.crossPhase = 'exam'; G.crossIdx = 0;
          G.card = { t: 'card', text: '对质询问', sub: '～ 找出证词中的矛盾 ～', style: 'testimony' };
          G.cardT = 0; G.mode = 'card'; SFX.swish();
        }
      } else {
        crossNext(1);
      }
      break;
    }
    case 'card':
      if (G.cardT < 20) { G.cardT = 30; return; }
      SFX.ok();
      if (G.cross && G.mode === 'card') {
        // 回到询问
        if (G.crossPhase === 'testify' || G.crossPhase === 'exam') { G.card = null; crossShowStmt(); return; }
      }
      G.card = null; G.mode = 'talk'; step();
      break;
    case 'toast': G.toast = null; G.mode = 'talk'; SFX.ok(); step(); break;
    case 'verdict':
      if (G.verdictT > G.verdictText.length * 18 + 30) { G.mode = 'talk'; step(); }
      break;
  }
}

function onBtn(id) {
  ensureAudio();
  if (id === 'start') { SFX.ok(); Music.stop(); startGame(); return; }
  if (id === 'lcd') { lcdTop.classList.toggle('on'); lcdBtm.classList.toggle('on'); SFX.move(); return; }
  if (id === 'to-title') { SFX.cancel(); Music.play('title'); G.mode = 'title'; G.started = false; return; }
  if (id === 'retry') {
    SFX.ok();
    G.health = 5; G.penaltyT = 0;
    const cp = G.checkpoint;
    G.frames = [{ nodes: G.script, pc: cp.pc, onDone: null }];
    G.cross = null; G.mode = 'talk';
    if (cp.music) Music.play(cp.music);
    step();
    return;
  }
  if (id === 'advance') { advance(); return; }
  if (id === 'record') { openRecord(G.mode === 'cross' ? 'cross' : 'talk'); return; }
  if (id === 'prev') { if (!G.typing) crossNext(-1); return; }
  if (id === 'next') { if (!G.typing) crossNext(1); return; }
  if (id === 'press') { if (G.crossPhase === 'exam') crossPress(); else advance(); return; }
  if (id === 'present') {
    if (G.crossPhase === 'exam') openRecord('present-cross');
    else advance();
    return;
  }
  if (id.startsWith('ev-')) {
    const i = parseInt(id.slice(3));
    if (G.recSel === i) { G.mode = 'detail'; SFX.ok(); }
    else { G.recSel = i; SFX.move(); }
    return;
  }
  if (id === 'rec-back') {
    SFX.cancel();
    if (G.recReturn === 'present-standalone') {
      // 不允许逃避出示——仍留在出示界面
      G.mode = 'record';
      return;
    }
    closeRecord();
    return;
  }
  if (id === 'rec-detail') { G.mode = 'detail'; SFX.ok(); return; }
  if (id === 'rec-present') { recordConfirmPresent(); return; }
  if (id === 'detail-back') { G.mode = 'record'; SFX.cancel(); return; }
  if (id.startsWith('choice-')) {
    const i = parseInt(id.slice(7));
    if (G.choiceSel !== i) { G.choiceSel = i; SFX.move(); return; }
    SFX.ok();
    const opt = G.choice.opts[i];
    G.choice = null; G.mode = 'talk';
    jumpTo(opt.to);
    return;
  }
}

function canvasPos(e, cv) {
  const r = cv.getBoundingClientRect();
  const cx = (e.touches ? e.touches[0].clientX : e.clientX);
  const cy = (e.touches ? e.touches[0].clientY : e.clientY);
  return [(cx - r.left) / r.width * W, (cy - r.top) / r.height * H];
}

cvBtm.addEventListener('pointerdown', e => {
  ensureAudio();
  const [x, y] = canvasPos(e, cvBtm);
  if (G.mode === 'detail') {
    G.dragging = true; G.dragSX = x; G.dragSY = y; G.dragRY = G.rotY; G.dragRX = G.rotX;
  }
  for (let i = BTNS.length - 1; i >= 0; i--) {
    const b = BTNS[i];
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
      if (b.id !== 'drag-zone') { onBtn(b.id); return; }
    }
  }
  // 空白区域：等同继续
  if (['talk', 'card', 'toast', 'verdict'].indexOf(G.mode) >= 0) advance();
});
cvBtm.addEventListener('pointermove', e => {
  if (G.dragging && G.mode === 'detail') {
    const [x, y] = canvasPos(e, cvBtm);
    G.rotY = G.dragRY + (x - G.dragSX) * 0.03;
    G.rotX = Math.max(-1.2, Math.min(1.2, G.dragRX + (y - G.dragSY) * 0.02));
  }
});
window.addEventListener('pointerup', () => { G.dragging = false; });

cvTop.addEventListener('pointerdown', e => {
  ensureAudio();
  if (G.mode === 'title') { SFX.ok(); Music.stop(); startGame(); return; }
  if (G.mode === 'detail') { G.mode = 'record'; SFX.cancel(); return; }
  if (['talk', 'card', 'toast', 'verdict', 'cross'].indexOf(G.mode) >= 0) advance();
});

document.addEventListener('keydown', e => {
  ensureAudio();
  const k = e.key;
  if (k === 'f' || k === 'F') { lcdTop.classList.toggle('on'); lcdBtm.classList.toggle('on'); return; }
  if (G.mode === 'title') { if (k === 'Enter' || k === ' ') { SFX.ok(); Music.stop(); startGame(); } return; }
  if (G.mode === 'gameover') { if (k === 'Enter' || k === ' ') onBtn('retry'); return; }
  if (G.mode === 'credits') { if (k === 'Enter' || k === ' ') onBtn('to-title'); return; }
  switch (k) {
    case ' ': case 'Enter':
      e.preventDefault();
      if (G.mode === 'choice') {
        SFX.ok();
        const opt = G.choice.opts[G.choiceSel];
        G.choice = null; G.mode = 'talk';
        jumpTo(opt.to);
      }
      else if (G.mode === 'record' || G.mode === 'present') {
        if (G.recPresent) onBtn('rec-present'); else onBtn('rec-detail');
      }
      else if (G.mode === 'detail') onBtn('detail-back');
      else advance();
      break;
    case 'ArrowLeft':
      if (G.mode === 'cross' && G.crossPhase === 'exam' && !G.typing) crossNext(-1);
      else if (G.mode === 'record' || G.mode === 'present') { G.recSel = Math.max(0, G.recSel - 1); SFX.move(); }
      break;
    case 'ArrowRight':
      if (G.mode === 'cross' && G.crossPhase === 'exam' && !G.typing) crossNext(1);
      else if (G.mode === 'record' || G.mode === 'present') { G.recSel = Math.min(G.court.length - 1, G.recSel + 1); SFX.move(); }
      break;
    case 'ArrowUp':
      if (G.mode === 'choice') { G.choiceSel = (G.choiceSel + G.choice.opts.length - 1) % G.choice.opts.length; SFX.move(); }
      break;
    case 'ArrowDown':
      if (G.mode === 'choice') { G.choiceSel = (G.choiceSel + 1) % G.choice.opts.length; SFX.move(); }
      break;
    case 'z': case 'Z':
      if (G.mode === 'cross' && G.crossPhase === 'exam' && !G.typing) crossPress();
      break;
    case 'x': case 'X':
      if (G.mode === 'cross' && G.crossPhase === 'exam' && !G.typing) openRecord('present-cross');
      break;
    case 'r': case 'R':
      if (G.mode === 'talk' || G.mode === 'cross') openRecord(G.mode === 'cross' ? 'cross' : 'talk');
      break;
    case 'Escape': case 'b': case 'B':
      if (G.mode === 'detail') onBtn('detail-back');
      else if (G.mode === 'record') onBtn('rec-back');
      break;
  }
});

/* ============================================================
   主循环
   ============================================================ */
let blipGate = 0;
function loop() {
  G.tick++;
  // 打字机
  if (G.typing) {
    G.textShown += 0.55;
    if (G.textShown >= G.text.length) { G.textShown = G.text.length; G.typing = false; }
    else if (--blipGate <= 0) {
      blipGate = 4;
      const ch = G.text[Math.floor(G.textShown)];
      if (ch && !'，。、！？…—\n 「」（）'.includes(ch)) {
        const bp = G.charId && CHARS[G.charId] ? CHARS[G.charId].blip : 0;
        SFX.blip(bp);
      }
    }
  }
  if (G.mode === 'card') G.cardT++;
  if (G.mode === 'bubble') {
    G.bubbleT++;
    if (G.bubbleT > 52) { G.bubble = null; G.mode = 'talk'; step(); }
  }
  if (G.mode === 'wait') { if (--G.waitTimer <= 0) { G.mode = 'talk'; step(); } }
  if (G.mode === 'verdict') G.verdictT++;
  if (G.mode === 'credits') G.creditsT++;
  if (G.mode === 'detail' && !G.dragging) G.rotY += 0.012;
  if (G.flashT > 0) G.flashT--;
  if (G.shakeT > 0) G.shakeT--;
  if (G.penaltyT > 0) G.penaltyT--;

  renderTop();
  renderBtm();
  requestAnimationFrame(loop);
}

/* 标题音乐在首次交互时启动 */
let titleMusicStarted = false;
function tryTitleMusic() {
  if (!titleMusicStarted && G.mode === 'title') {
    ensureAudio(); Music.play('title'); titleMusicStarted = true;
  }
}
document.addEventListener('pointerdown', tryTitleMusic, { once: false });
document.addEventListener('keydown', tryTitleMusic, { once: false });

loop();
