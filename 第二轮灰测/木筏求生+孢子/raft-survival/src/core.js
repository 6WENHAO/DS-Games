/* ==========================================================================
   RAFT SURVIVAL · core.js
   基础工具 / 伪随机 / 程序化贴图 / WebAudio 音效引擎
   全部离线自给：没有任何外部图片或音频文件
   ========================================================================== */
window.RS = window.RS || {};

/* ------------------------------------------------------------------ 工具 */
RS.U = (function () {
  const TAU = Math.PI * 2;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function damp(a, b, l, dt) { return lerp(a, b, 1 - Math.exp(-l * dt)); }
  function smooth(t) { return t * t * (3 - 2 * t); }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function randi(a, b) { return Math.floor(a + Math.random() * (b - a + 1)); }
  function choice(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function chance(p) { return Math.random() < p; }
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = randi(0, i); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  /* 确定性随机（岛屿生成用） */
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function Rng(seed) {
    const f = mulberry32(seed);
    return {
      next: f,
      range: (a, b) => a + f() * (b - a),
      int: (a, b) => Math.floor(a + f() * (b - a + 1)),
      pick: (arr) => arr[Math.floor(f() * arr.length)],
      chance: (p) => f() < p
    };
  }

  /* 2D 值噪声（岛屿高度场） */
  function makeNoise2D(seed) {
    const rng = mulberry32(seed);
    const P = new Uint8Array(512);
    const perm = [];
    for (let i = 0; i < 256; i++) perm.push(i);
    for (let i = 255; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = perm[i]; perm[i] = perm[j]; perm[j] = t; }
    for (let i = 0; i < 512; i++) P[i] = perm[i & 255];
    const grad = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];
    function dot(g, x, y) { return g[0] * x + g[1] * y; }
    return function (x, y) {
      const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
      const xf = x - Math.floor(x), yf = y - Math.floor(y);
      const u = smooth(xf), v = smooth(yf);
      const a = P[P[X] + Y], b = P[P[X + 1] + Y];
      const c = P[P[X] + Y + 1], d = P[P[X + 1] + Y + 1];
      const n00 = dot(grad[a & 7], xf, yf);
      const n10 = dot(grad[b & 7], xf - 1, yf);
      const n01 = dot(grad[c & 7], xf, yf - 1);
      const n11 = dot(grad[d & 7], xf - 1, yf - 1);
      return lerp(lerp(n00, n10, u), lerp(n01, n11, u), v);
    };
  }
  function fbm(noise, x, y, oct, lac, gain) {
    let s = 0, amp = .5, f = 1, norm = 0;
    for (let i = 0; i < oct; i++) { s += noise(x * f, y * f) * amp; norm += amp; amp *= gain; f *= lac; }
    return s / norm;
  }

  /* 存档（file:// 下 localStorage 可能抛错，做内存兜底） */
  const memStore = {};
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return memStore[k] || null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { memStore[k] = v; } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { delete memStore[k]; } }
  };

  /* 简易事件总线 */
  function Bus() {
    const map = {};
    return {
      on(k, f) { (map[k] = map[k] || []).push(f); return this; },
      off(k, f) { if (map[k]) map[k] = map[k].filter(x => x !== f); },
      emit(k, ...a) { (map[k] || []).forEach(f => { try { f(...a); } catch (e) { console.error(e); } }); }
    };
  }

  function fmtTime(t) {
    const h = Math.floor(t) % 24, m = Math.floor((t % 1) * 60);
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  }
  function dirName(a) {
    const d = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    return d[Math.round(((a % TAU) + TAU) % TAU / (TAU / 8)) % 8];
  }

  return { TAU, clamp, lerp, damp, smooth, rand, randi, choice, chance, shuffle, Rng, mulberry32, makeNoise2D, fbm, store, Bus, fmtTime, dirName };
})();

/* -------------------------------------------------------------- 程序化贴图 */
RS.Tex = (function () {
  const cache = {};

  function cv(size) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    return { c, x: c.getContext('2d') };
  }
  function tex(canvas, rx, ry) {
    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(rx || 1, ry || 1);
    t.anisotropy = 4;
    if (THREE.sRGBEncoding !== undefined) t.encoding = THREE.sRGBEncoding;
    return t;
  }
  function noiseOver(x, size, n, alpha, dark) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * alpha;
      x.fillStyle = (dark ? 'rgba(0,0,0,' : 'rgba(255,255,255,') + a.toFixed(3) + ')';
      const r = 1 + Math.random() * 3;
      x.fillRect(Math.random() * size, Math.random() * size, r, r);
    }
  }
  function get(name, maker, rx, ry) {
    const key = name + '|' + (rx || 1) + 'x' + (ry || 1);
    if (!cache[key]) cache[key] = tex(maker(), rx, ry);
    return cache[key];
  }

  /* --- 木板（木筏地板 / 墙） --- */
  function plankCanvas(base, dark, rows) {
    const S = 256, o = cv(S), x = o.x;
    x.fillStyle = base; x.fillRect(0, 0, S, S);
    const h = S / (rows || 4);
    for (let r = 0; r < (rows || 4); r++) {
      const y = r * h;
      // 每块板不同明度
      const sh = (Math.random() - .5) * 22;
      x.fillStyle = shade(base, sh); x.fillRect(0, y + 1, S, h - 2);
      // 木纹
      for (let i = 0; i < 26; i++) {
        x.strokeStyle = 'rgba(0,0,0,' + (.04 + Math.random() * .09).toFixed(3) + ')';
        x.lineWidth = .6 + Math.random() * 1.6;
        x.beginPath();
        const yy = y + 2 + Math.random() * (h - 4);
        x.moveTo(0, yy);
        x.bezierCurveTo(S * .3, yy + (Math.random() - .5) * 5, S * .7, yy + (Math.random() - .5) * 5, S, yy + (Math.random() - .5) * 3);
        x.stroke();
      }
      // 缝隙阴影
      const g = x.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, 'rgba(0,0,0,.34)'); g.addColorStop(.14, 'rgba(0,0,0,0)');
      g.addColorStop(.86, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.42)');
      x.fillStyle = g; x.fillRect(0, y, S, h);
      // 钉子
      for (let k = 0; k < 2; k++) {
        const nx = 14 + k * (S - 30) + Math.random() * 6, ny = y + h / 2;
        x.fillStyle = dark; x.beginPath(); x.arc(nx, ny, 2.4, 0, 6.3); x.fill();
        x.fillStyle = 'rgba(255,255,255,.28)'; x.beginPath(); x.arc(nx - .7, ny - .7, 1.1, 0, 6.3); x.fill();
      }
    }
    noiseOver(x, S, 600, .07, true);
    return o.c;
  }
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) + amt, g = ((n >> 8) & 255) + amt, b = (n & 255) + amt;
    r = Math.max(0, Math.min(255, r | 0)); g = Math.max(0, Math.min(255, g | 0)); b = Math.max(0, Math.min(255, b | 0));
    return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
  }

  /* --- 棕榈叶 / 茅草 --- */
  function thatchCanvas() {
    const S = 256, o = cv(S), x = o.x;
    x.fillStyle = '#8a6a35'; x.fillRect(0, 0, S, S);
    for (let i = 0; i < 260; i++) {
      const y = Math.random() * S, w = 30 + Math.random() * 70;
      x.strokeStyle = 'hsl(' + (38 + Math.random() * 22) + ',' + (32 + Math.random() * 28) + '%,' + (26 + Math.random() * 34) + '%)';
      x.lineWidth = 3 + Math.random() * 5;
      x.beginPath(); x.moveTo(Math.random() * S, y);
      x.lineTo(Math.random() * S + w, y + (Math.random() - .5) * 8); x.stroke();
    }
    noiseOver(x, S, 900, .1, true);
    return o.c;
  }

  /* --- 帆布 --- */
  function sailCanvas() {
    const S = 256, o = cv(S), x = o.x;
    x.fillStyle = '#efe4cd'; x.fillRect(0, 0, S, S);
    for (let i = 0; i < S; i += 4) {
      x.strokeStyle = 'rgba(0,0,0,.045)'; x.beginPath(); x.moveTo(i, 0); x.lineTo(i, S); x.stroke();
      x.strokeStyle = 'rgba(0,0,0,.035)'; x.beginPath(); x.moveTo(0, i); x.lineTo(S, i); x.stroke();
    }
    x.fillStyle = '#c8543f'; x.fillRect(0, S * .40, S, S * .09);
    x.fillStyle = '#2f7f8f'; x.fillRect(0, S * .56, S, S * .05);
    // 缝线
    x.strokeStyle = 'rgba(90,70,40,.55)'; x.setLineDash([5, 5]); x.lineWidth = 1.6;
    [.36, .52, .64].forEach(p => { x.beginPath(); x.moveTo(0, S * p); x.lineTo(S, S * p); x.stroke(); });
    x.setLineDash([]);
    noiseOver(x, S, 700, .08, true);
    return o.c;
  }

  /* --- 沙滩 --- */
  function sandCanvas() {
    const S = 256, o = cv(S), x = o.x;
    x.fillStyle = '#e6d3a3'; x.fillRect(0, 0, S, S);
    for (let i = 0; i < 4200; i++) {
      x.fillStyle = 'hsla(' + (40 + Math.random() * 14) + ',' + (36 + Math.random() * 22) + '%,' + (62 + Math.random() * 28) + '%,' + (.25 + Math.random() * .5) + ')';
      x.fillRect(Math.random() * S, Math.random() * S, 1.6, 1.6);
    }
    for (let i = 0; i < 26; i++) { // 贝壳/小石
      x.fillStyle = 'rgba(255,255,255,' + (.2 + Math.random() * .4) + ')';
      x.beginPath(); x.ellipse(Math.random() * S, Math.random() * S, 2 + Math.random() * 3, 1.5 + Math.random() * 2, Math.random() * 3, 0, 6.3); x.fill();
    }
    return o.c;
  }

  /* --- 岩石 --- */
  function rockCanvas() {
    const S = 256, o = cv(S), x = o.x;
    x.fillStyle = '#78787e'; x.fillRect(0, 0, S, S);
    for (let i = 0; i < 130; i++) {
      x.fillStyle = 'hsla(' + (200 + Math.random() * 30) + ',' + (3 + Math.random() * 9) + '%,' + (30 + Math.random() * 36) + '%,' + (.3 + Math.random() * .5) + ')';
      x.beginPath();
      const cx0 = Math.random() * S, cy0 = Math.random() * S, r = 8 + Math.random() * 30;
      x.moveTo(cx0 + r, cy0);
      for (let a = 0; a < 6.28; a += .5) x.lineTo(cx0 + Math.cos(a) * r * (.6 + Math.random() * .6), cy0 + Math.sin(a) * r * (.6 + Math.random() * .6));
      x.closePath(); x.fill();
    }
    noiseOver(x, S, 2200, .14, true);
    noiseOver(x, S, 900, .1, false);
    return o.c;
  }

  /* --- 树皮 --- */
  function barkCanvas() {
    const S = 128, o = cv(S), x = o.x;
    x.fillStyle = '#7d5a34'; x.fillRect(0, 0, S, S);
    for (let i = 0; i < 60; i++) {
      x.strokeStyle = 'rgba(0,0,0,' + (.08 + Math.random() * .18) + ')';
      x.lineWidth = 1 + Math.random() * 4;
      x.beginPath(); const xx = Math.random() * S;
      x.moveTo(xx, 0);
      x.bezierCurveTo(xx + (Math.random() - .5) * 12, S * .33, xx + (Math.random() - .5) * 12, S * .66, xx + (Math.random() - .5) * 8, S);
      x.stroke();
    }
    for (let i = 0; i < 18; i++) {
      x.strokeStyle = 'rgba(255,225,180,.12)'; x.lineWidth = 1 + Math.random() * 2;
      x.beginPath(); const xx = Math.random() * S; x.moveTo(xx, 0); x.lineTo(xx + (Math.random() - .5) * 8, S); x.stroke();
    }
    return o.c;
  }

  /* --- 叶片（带 alpha 的棕榈叶） --- */
  function leafCanvas() {
    const S = 256, o = cv(S), x = o.x;
    x.clearRect(0, 0, S, S);
    const cx0 = S * .06;
    // 主脉
    x.strokeStyle = '#3f7a2e'; x.lineWidth = 7; x.beginPath();
    x.moveTo(cx0, S / 2); x.quadraticCurveTo(S * .55, S * .40, S * .98, S * .5); x.stroke();
    // 羽片
    for (let i = 0; i < 34; i++) {
      const t = i / 33;
      const px = cx0 + (S * .92) * t;
      const py = S / 2 + (Math.sin(t * 3.1) * -12) * 1;
      const len = 46 * Math.sin(Math.PI * Math.min(1, t * 1.15)) + 8;
      for (const s of [-1, 1]) {
        const g = x.createLinearGradient(px, py, px + 12, py + s * len);
        g.addColorStop(0, '#63b344'); g.addColorStop(1, '#2e6b26');
        x.strokeStyle = g; x.lineWidth = 5.5; x.lineCap = 'round';
        x.beginPath(); x.moveTo(px, py);
        x.quadraticCurveTo(px + 10, py + s * len * .6, px + 22, py + s * len); x.stroke();
      }
    }
    return o.c;
  }

  /* --- 金属 --- */
  function metalCanvas() {
    const S = 128, o = cv(S), x = o.x;
    const g = x.createLinearGradient(0, 0, 0, S);
    g.addColorStop(0, '#b9c2c9'); g.addColorStop(.5, '#8d979f'); g.addColorStop(1, '#6d767d');
    x.fillStyle = g; x.fillRect(0, 0, S, S);
    for (let i = 0; i < 400; i++) {
      x.strokeStyle = 'rgba(255,255,255,' + (Math.random() * .10).toFixed(3) + ')';
      x.beginPath(); const y = Math.random() * S; x.moveTo(0, y); x.lineTo(S, y + (Math.random() - .5) * 2); x.stroke();
    }
    for (let i = 0; i < 16; i++) { // 锈斑
      x.fillStyle = 'rgba(150,80,30,' + (.06 + Math.random() * .2) + ')';
      x.beginPath(); x.arc(Math.random() * S, Math.random() * S, 3 + Math.random() * 12, 0, 6.3); x.fill();
    }
    return o.c;
  }

  /* --- 泡沫 / 云 / 星 圆形贴图 --- */
  function blobCanvas(color, soft) {
    const S = 128, o = cv(S), x = o.x;
    const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0, color);
    g.addColorStop(soft || .35, color.replace(/[\d.]+\)$/, '.45)'));
    g.addColorStop(1, color.replace(/[\d.]+\)$/, '0)'));
    x.fillStyle = g; x.fillRect(0, 0, S, S);
    return o.c;
  }
  function cloudCanvas() {
    const S = 256, o = cv(S), x = o.x;
    for (let i = 0; i < 26; i++) {
      const r = 18 + Math.random() * 52;
      const cx0 = 40 + Math.random() * (S - 80), cy0 = 70 + Math.random() * (S - 150);
      const g = x.createRadialGradient(cx0, cy0, 0, cx0, cy0, r);
      g.addColorStop(0, 'rgba(255,255,255,.72)');
      g.addColorStop(.6, 'rgba(255,255,255,.28)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.beginPath(); x.arc(cx0, cy0, r, 0, 6.3); x.fill();
    }
    return o.c;
  }
  /* --- 水面细节法线（用作扰动灰度） --- */
  function waterDetailCanvas() {
    const S = 256, o = cv(S), x = o.x;
    x.fillStyle = '#808080'; x.fillRect(0, 0, S, S);
    for (let i = 0; i < 900; i++) {
      const r = 3 + Math.random() * 22;
      const cx0 = Math.random() * S, cy0 = Math.random() * S;
      const g = x.createRadialGradient(cx0, cy0, 0, cx0, cy0, r);
      const l = Math.random() > .5 ? 255 : 0;
      g.addColorStop(0, 'rgba(' + l + ',' + l + ',' + l + ',.10)');
      g.addColorStop(1, 'rgba(' + l + ',' + l + ',' + l + ',0)');
      x.fillStyle = g; x.beginPath(); x.arc(cx0, cy0, r, 0, 6.3); x.fill();
    }
    return o.c;
  }
  /* --- 塑料桶 --- */
  function barrelCanvas() {
    const S = 128, o = cv(S), x = o.x;
    x.fillStyle = '#2f76b5'; x.fillRect(0, 0, S, S);
    x.fillStyle = '#e8eef2'; x.fillRect(0, S * .30, S, S * .16);
    x.fillStyle = '#1d537f'; x.fillRect(0, S * .08, S, S * .05); x.fillRect(0, S * .84, S, S * .05);
    x.fillStyle = '#c8452f'; x.font = 'bold 26px sans-serif'; x.textAlign = 'center';
    x.fillText('⚠', S / 2, S * .43);
    noiseOver(x, S, 400, .09, true);
    const g = x.createLinearGradient(0, 0, S, 0);
    g.addColorStop(0, 'rgba(0,0,0,.35)'); g.addColorStop(.35, 'rgba(255,255,255,.18)');
    g.addColorStop(.7, 'rgba(0,0,0,.05)'); g.addColorStop(1, 'rgba(0,0,0,.4)');
    x.fillStyle = g; x.fillRect(0, 0, S, S);
    return o.c;
  }

  return {
    plank: (rx, ry) => get('plank', () => plankCanvas('#a9773d', '#4d3318', 4), rx, ry),
    plankDark: (rx, ry) => get('plankd', () => plankCanvas('#82562b', '#3a2512', 5), rx, ry),
    plankLight: (rx, ry) => get('plankl', () => plankCanvas('#c79a5c', '#5e421f', 3), rx, ry),
    thatch: (rx, ry) => get('thatch', thatchCanvas, rx, ry),
    sail: (rx, ry) => get('sail', sailCanvas, rx, ry),
    sand: (rx, ry) => get('sand', sandCanvas, rx, ry),
    rock: (rx, ry) => get('rock', rockCanvas, rx, ry),
    bark: (rx, ry) => get('bark', barkCanvas, rx, ry),
    metal: (rx, ry) => get('metal', metalCanvas, rx, ry),
    barrel: (rx, ry) => get('barrel', barrelCanvas, rx, ry),
    leaf: () => get('leaf', leafCanvas),
    cloud: () => get('cloud', cloudCanvas),
    waterDetail: (rx, ry) => get('wdetail', waterDetailCanvas, rx, ry),
    foam: () => get('foam', () => blobCanvas('rgba(255,255,255,.95)', .3)),
    glow: () => get('glow', () => blobCanvas('rgba(255,240,190,1)', .12)),
    bubble: () => get('bubble', () => blobCanvas('rgba(210,245,255,.9)', .5)),
    blood: () => get('blood', () => blobCanvas('rgba(190,30,40,.85)', .4)),
    shade
  };
})();

/* ------------------------------------------------------------- 音频引擎 */
RS.Audio = (function () {
  let ctx = null, master = null, sfxBus = null, ambBus = null, musBus = null;
  let noiseBuf = null, started = false, muffle = null;
  const amb = {};
  let vol = .7;

  function init() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = vol;
    muffle = ctx.createBiquadFilter(); muffle.type = 'lowpass'; muffle.frequency.value = 20000;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 6; comp.attack.value = .004; comp.release.value = .25;
    master.connect(muffle); muffle.connect(comp); comp.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 1; sfxBus.connect(master);
    ambBus = ctx.createGain(); ambBus.gain.value = .55; ambBus.connect(master);
    musBus = ctx.createGain(); musBus.gain.value = .34; musBus.connect(master);

    // 噪声缓冲
    const len = ctx.sampleRate * 3;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + .02 * w) / 1.02; d[i] = last * 3.2; }
  }
  function resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); }
  function setVolume(v) { vol = v; if (master) master.gain.value = v; }
  function now() { return ctx ? ctx.currentTime : 0; }

  /* 基础发声件 */
  function tone(o) {
    if (!ctx) return;
    const t = now() + (o.delay || 0);
    const osc = ctx.createOscillator();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f0, t);
    if (o.f1 != null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f1), t + o.dur);
    const g = ctx.createGain();
    const peak = (o.gain == null ? .2 : o.gain);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + (o.atk || .008));
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    let node = osc;
    if (o.filter) {
      const bq = ctx.createBiquadFilter();
      bq.type = o.filter; bq.frequency.value = o.fc || 900; bq.Q.value = o.q || 1;
      osc.connect(bq); node = bq;
    }
    node.connect(g); g.connect(o.bus || sfxBus);
    osc.start(t); osc.stop(t + o.dur + .05);
  }
  function noise(o) {
    if (!ctx || !noiseBuf) return;
    const t = now() + (o.delay || 0);
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf; src.loop = true;
    src.playbackRate.value = o.rate || 1;
    const bq = ctx.createBiquadFilter();
    bq.type = o.filter || 'bandpass';
    bq.frequency.setValueAtTime(o.fc || 900, t);
    if (o.fc1) bq.frequency.exponentialRampToValueAtTime(Math.max(30, o.fc1), t + o.dur);
    bq.Q.value = o.q || 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.gain == null ? .2 : o.gain, t + (o.atk || .006));
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    src.connect(bq); bq.connect(g); g.connect(o.bus || sfxBus);
    src.start(t); src.stop(t + o.dur + .05);
  }

  /* 音效库 */
  const LIB = {
    ui_hover: () => tone({ type: 'sine', f0: 900, f1: 1150, dur: .07, gain: .05 }),
    ui_click: () => { tone({ type: 'triangle', f0: 620, f1: 940, dur: .09, gain: .12 }); tone({ type: 'sine', f0: 1500, dur: .05, gain: .05, delay: .02 }); },
    ui_open: () => { tone({ type: 'sine', f0: 400, f1: 800, dur: .16, gain: .1 }); noise({ fc: 2200, fc1: 900, dur: .18, gain: .05 }); },
    ui_close: () => tone({ type: 'sine', f0: 700, f1: 320, dur: .14, gain: .09 }),
    ui_deny: () => { tone({ type: 'square', f0: 180, f1: 120, dur: .16, gain: .09, filter: 'lowpass', fc: 700 }); },

    hammer: () => { noise({ fc: 1400, fc1: 320, dur: .13, gain: .3, q: .8 }); tone({ type: 'triangle', f0: 260, f1: 130, dur: .12, gain: .16 }); },
    place: () => { noise({ fc: 900, fc1: 260, dur: .16, gain: .26, q: .7 }); tone({ type: 'sine', f0: 190, f1: 96, dur: .18, gain: .14 }); },
    remove: () => { noise({ fc: 600, fc1: 1600, dur: .14, gain: .2 }); tone({ type: 'triangle', f0: 150, f1: 300, dur: .12, gain: .1 }); },
    craft: () => { [0, .07, .14].forEach((d, i) => tone({ type: 'triangle', f0: 520 + i * 190, dur: .12, gain: .11, delay: d })); noise({ fc: 3000, fc1: 1200, dur: .2, gain: .06 }); },
    unlock: () => { [523, 659, 784, 1046].forEach((f, i) => tone({ type: 'sine', f0: f, dur: .5, gain: .1, delay: i * .09 })); },
    pickup: () => { tone({ type: 'sine', f0: 780, f1: 1240, dur: .1, gain: .1 }); tone({ type: 'sine', f0: 1560, dur: .06, gain: .04, delay: .04 }); },
    chop: () => { noise({ fc: 800, fc1: 200, dur: .2, gain: .3, q: .6 }); tone({ type: 'triangle', f0: 210, f1: 90, dur: .2, gain: .13 }); },
    mine: () => { noise({ fc: 2600, fc1: 500, dur: .16, gain: .28, q: 1.4 }); tone({ type: 'square', f0: 420, f1: 150, dur: .1, gain: .07, filter: 'lowpass', fc: 900 }); },
    treefall: () => { noise({ fc: 420, fc1: 90, dur: 1.5, gain: .3, q: .5 }); tone({ type: 'sine', f0: 90, f1: 40, dur: 1.4, gain: .12 }); },

    step_wood: () => { noise({ fc: 500 + Math.random() * 300, fc1: 200, dur: .1, gain: .12, q: .8 }); tone({ type: 'sine', f0: 130, f1: 80, dur: .07, gain: .05 }); },
    step_sand: () => noise({ fc: 1800 + Math.random() * 900, fc1: 700, dur: .16, gain: .08, q: .5 }),
    step_water: () => noise({ fc: 900 + Math.random() * 700, fc1: 2400, dur: .22, gain: .1, q: .5 }),
    jump: () => tone({ type: 'sine', f0: 300, f1: 460, dur: .12, gain: .07 }),
    land: () => { noise({ fc: 380, fc1: 130, dur: .14, gain: .16 }); },

    splash_in: () => { noise({ fc: 700, fc1: 2600, dur: .5, gain: .34, q: .5 }); noise({ fc: 2400, fc1: 600, dur: .7, gain: .16, delay: .05 }); },
    splash_out: () => { noise({ fc: 1600, fc1: 500, dur: .45, gain: .26, q: .6 }); },
    swim: () => noise({ fc: 480 + Math.random() * 300, fc1: 1500, dur: .38, gain: .1, q: .4 }),
    dive: () => { tone({ type: 'sine', f0: 420, f1: 90, dur: .6, gain: .12 }); noise({ fc: 1200, fc1: 200, dur: .7, gain: .12 }); },
    bubble: () => tone({ type: 'sine', f0: 500 + Math.random() * 700, f1: 1400, dur: .12, gain: .06 }),
    gasp: () => { noise({ fc: 700, fc1: 2000, dur: .35, gain: .2, q: .7 }); noise({ fc: 1500, fc1: 400, dur: .5, gain: .12, delay: .3 }); },

    drink: () => { [0, .18, .36].forEach(d => tone({ type: 'sine', f0: 220 + Math.random() * 90, f1: 150, dur: .16, gain: .12, delay: d })); },
    eat: () => { [0, .16, .32].forEach(d => noise({ fc: 900, fc1: 380, dur: .14, gain: .16, q: .6, delay: d })); },
    heal: () => { [660, 880, 1100].forEach((f, i) => tone({ type: 'sine', f0: f, dur: .45, gain: .07, delay: i * .1 })); },

    cast: () => { noise({ fc: 2600, fc1: 900, dur: .35, gain: .14, q: .4 }); tone({ type: 'sine', f0: 900, f1: 400, dur: .3, gain: .05 }); },
    plop: () => { tone({ type: 'sine', f0: 700, f1: 180, dur: .16, gain: .16 }); noise({ fc: 1400, fc1: 500, dur: .2, gain: .1 }); },
    reel: () => noise({ fc: 2200 + Math.random() * 500, dur: .12, gain: .07, q: 3 }),
    bite: () => { tone({ type: 'triangle', f0: 340, f1: 620, dur: .14, gain: .14 }); tone({ type: 'sine', f0: 900, dur: .1, gain: .07, delay: .08 }); },
    fish_caught: () => { [523, 784, 1046].forEach((f, i) => tone({ type: 'triangle', f0: f, dur: .3, gain: .1, delay: i * .08 })); noise({ fc: 1400, fc1: 3000, dur: .3, gain: .1 }); },
    fish_lost: () => tone({ type: 'sawtooth', f0: 300, f1: 110, dur: .35, gain: .09, filter: 'lowpass', fc: 800 }),

    hook_throw: () => { noise({ fc: 1800, fc1: 700, dur: .28, gain: .12, q: .5 }); },
    hook_hit: () => { tone({ type: 'triangle', f0: 500, f1: 240, dur: .12, gain: .12 }); noise({ fc: 1200, fc1: 400, dur: .16, gain: .12 }); },

    shark_bite: () => { noise({ fc: 300, fc1: 90, dur: .55, gain: .42, q: .5 }); tone({ type: 'sawtooth', f0: 130, f1: 55, dur: .5, gain: .16, filter: 'lowpass', fc: 400 }); },
    shark_growl: () => { tone({ type: 'sawtooth', f0: 80, f1: 46, dur: 1.4, gain: .2, filter: 'lowpass', fc: 260 }); noise({ fc: 220, fc1: 100, dur: 1.4, gain: .16 }); },
    shark_hurt: () => { noise({ fc: 700, fc1: 200, dur: .4, gain: .3, q: .6 }); tone({ type: 'square', f0: 200, f1: 80, dur: .3, gain: .1, filter: 'lowpass', fc: 500 }); },
    spear: () => { noise({ fc: 2400, fc1: 800, dur: .18, gain: .16, q: .7 }); tone({ type: 'triangle', f0: 600, f1: 200, dur: .16, gain: .1 }); },

    hurt: () => { tone({ type: 'square', f0: 260, f1: 110, dur: .22, gain: .14, filter: 'lowpass', fc: 700 }); noise({ fc: 500, fc1: 180, dur: .25, gain: .18 }); },
    die: () => { [330, 262, 196, 131].forEach((f, i) => tone({ type: 'sine', f0: f, f1: f * .6, dur: 1.1, gain: .12, delay: i * .22 })); },
    warn: () => { [0, .22].forEach(d => tone({ type: 'square', f0: 720, f1: 520, dur: .18, gain: .1, filter: 'lowpass', fc: 1400, delay: d })); },

    fire: () => noise({ fc: 420 + Math.random() * 300, dur: .3, gain: .05, q: .5 }),
    steam: () => noise({ fc: 3200, fc1: 1400, dur: .8, gain: .07, q: .4 }),
    thunder: () => { noise({ fc: 220, fc1: 60, dur: 2.4, gain: .4, q: .4 }); tone({ type: 'sine', f0: 60, f1: 28, dur: 2.2, gain: .18, delay: .05 }); },
    seagull: () => { [0, .18, .4].forEach((d, i) => tone({ type: 'sawtooth', f0: 1400 - i * 120, f1: 900, dur: .16, gain: .05, filter: 'bandpass', fc: 1600, q: 3, delay: d })); },
    whale: () => { tone({ type: 'sine', f0: 150, f1: 90, dur: 2.6, gain: .1 }); tone({ type: 'sine', f0: 226, f1: 140, dur: 2.2, gain: .05, delay: .3 }); },
    island: () => { [392, 494, 587, 784].forEach((f, i) => tone({ type: 'triangle', f0: f, dur: .8, gain: .08, delay: i * .12 })); }
  };

  function play(name, gainScale) {
    if (!ctx) return;
    resume();
    const f = LIB[name];
    if (!f) return;
    if (gainScale != null && gainScale !== 1) {
      const g = sfxBus.gain.value; sfxBus.gain.value = g * gainScale;
      f(); setTimeout(() => { sfxBus.gain.value = g; }, 0);
    } else f();
  }

  /* 环境音：海浪 / 风 / 雨 / 水下 */
  function makeLoop(cfg) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf; src.loop = true; src.playbackRate.value = cfg.rate || 1;
    const bq = ctx.createBiquadFilter(); bq.type = cfg.filter || 'lowpass';
    bq.frequency.value = cfg.fc; bq.Q.value = cfg.q || .7;
    const g = ctx.createGain(); g.gain.value = 0;
    // 慢速 LFO 制造浪涌
    const lfo = ctx.createOscillator(); lfo.frequency.value = cfg.lfo || .12;
    const lg = ctx.createGain(); lg.gain.value = cfg.lfoAmt || .35;
    lfo.connect(lg); lg.connect(g.gain);
    src.connect(bq); bq.connect(g); g.connect(ambBus);
    src.start(); lfo.start();
    return { g, bq, target: 0 };
  }
  function startAmbient() {
    if (!ctx || started) return;
    started = true;
    amb.ocean = makeLoop({ fc: 560, filter: 'lowpass', rate: .55, lfo: .1, lfoAmt: .30, q: .5 });
    amb.wind = makeLoop({ fc: 1400, filter: 'bandpass', rate: 1.4, lfo: .07, lfoAmt: .22, q: .6 });
    amb.rain = makeLoop({ fc: 4200, filter: 'highpass', rate: 1.9, lfo: .3, lfoAmt: .08, q: .4 });
    amb.under = makeLoop({ fc: 240, filter: 'lowpass', rate: .35, lfo: .16, lfoAmt: .2, q: .5 });
    setAmbient('ocean', .55); setAmbient('wind', .18);
  }
  function setAmbient(k, v) {
    if (!amb[k]) return;
    amb[k].target = v;
    amb[k].g.gain.setTargetAtTime(v, now(), .8);
  }
  function setUnderwater(on) {
    if (!ctx) return;
    muffle.frequency.setTargetAtTime(on ? 460 : 20000, now(), .25);
    setAmbient('ocean', on ? .12 : .55);
    setAmbient('under', on ? .6 : 0);
  }

  /* 轻音乐：五声音阶柔和琶音，随机触发 */
  const SCALE = [0, 2, 4, 7, 9, 12, 14, 16];
  let musicTimer = 0, musicOn = true;
  function musicTick(dt, mood) {
    if (!ctx || !musicOn) return;
    musicTimer -= dt;
    if (musicTimer > 0) return;
    musicTimer = 7 + Math.random() * 12;
    const root = mood === 'tense' ? 110 : mood === 'night' ? 146.83 : 196;
    const n = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const semi = SCALE[Math.floor(Math.random() * SCALE.length)];
      const f = root * Math.pow(2, semi / 12);
      tone({ type: 'triangle', f0: f, dur: 2.2 + Math.random(), gain: .06, atk: .4, delay: i * .55, bus: musBus, filter: 'lowpass', fc: 1600 });
      tone({ type: 'sine', f0: f * 2, dur: 1.6, gain: .022, atk: .5, delay: i * .55 + .12, bus: musBus });
    }
  }
  function setMusic(on) { musicOn = on; }

  return { init, resume, play, setVolume, startAmbient, setAmbient, setUnderwater, musicTick, setMusic, get ctx() { return ctx; } };
})();
