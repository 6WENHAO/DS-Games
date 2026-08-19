/* ==========================================================================
   SPORE 五阶段复刻 · core.js
   SP.U   工具与伪随机
   SP.Tex 程序化贴图（canvas 生成，零外部资源）
   SP.Audio WebAudio 合成音效与自适应配乐
   ========================================================================== */
window.SP = window.SP || {};

/* ================================================================ 工具 */
SP.U = (function () {
  const TAU = Math.PI * 2;
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function damp(a, b, l, dt) { return lerp(a, b, 1 - Math.exp(-l * dt)); }
  function smooth(t) { return t * t * (3 - 2 * t); }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function randi(a, b) { return Math.floor(a + Math.random() * (b - a + 1)); }
  function choice(a) { return a[Math.floor(Math.random() * a.length)]; }
  function chance(p) { return Math.random() < p; }
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = randi(0, i); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
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
  function makeNoise2D(seed) {
    const rng = mulberry32(seed);
    const P = new Uint8Array(512), perm = [];
    for (let i = 0; i < 256; i++) perm.push(i);
    for (let i = 255; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = perm[i]; perm[i] = perm[j]; perm[j] = t; }
    for (let i = 0; i < 512; i++) P[i] = perm[i & 255];
    const G = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];
    const dot = (g, x, y) => g[0] * x + g[1] * y;
    return function (x, y) {
      const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
      const xf = x - Math.floor(x), yf = y - Math.floor(y);
      const u = smooth(xf), v = smooth(yf);
      const a = P[P[X] + Y], b = P[P[X + 1] + Y], c = P[P[X] + Y + 1], d = P[P[X + 1] + Y + 1];
      return lerp(lerp(dot(G[a & 7], xf, yf), dot(G[b & 7], xf - 1, yf), u),
        lerp(dot(G[c & 7], xf, yf - 1), dot(G[d & 7], xf - 1, yf - 1), u), v);
    };
  }
  function fbm(noise, x, y, oct, lac, gain) {
    let s = 0, amp = .5, f = 1, n = 0;
    for (let i = 0; i < (oct || 4); i++) { s += noise(x * f, y * f) * amp; n += amp; amp *= (gain || .5); f *= (lac || 2); }
    return s / n;
  }
  const mem = {};
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return mem[k] || null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { mem[k] = v; } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { delete mem[k]; } }
  };
  function Bus() {
    const m = {};
    return {
      on(k, f) { (m[k] = m[k] || []).push(f); return this; },
      off(k, f) { if (m[k]) m[k] = m[k].filter(x => x !== f); },
      emit(k) { const a = Array.prototype.slice.call(arguments, 1); (m[k] || []).forEach(f => { try { f.apply(null, a); } catch (e) { console.error(e); } }); }
    };
  }
  function dirName(a) {
    const d = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];
    return d[Math.round(((a % TAU) + TAU) % TAU / (TAU / 8)) % 8];
  }
  function fmt(n) {
    n = Math.round(n);
    if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2) + 'M';
    if (Math.abs(n) >= 1e4) return (n / 1e3).toFixed(1) + 'K';
    return String(n);
  }
  return { TAU, clamp, lerp, damp, smooth, rand, randi, choice, chance, shuffle, mulberry32, Rng, makeNoise2D, fbm, store, Bus, dirName, fmt };
})();

/* ============================================================ 程序化贴图 */
SP.Tex = (function () {
  const cache = {};
  function cv(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h || w;
    return { c, x: c.getContext('2d') };
  }
  function mk(canvas, rx, ry) {
    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(rx || 1, ry || 1);
    t.anisotropy = 4;
    if (THREE.sRGBEncoding !== undefined) t.encoding = THREE.sRGBEncoding;
    return t;
  }
  function get(key, maker, rx, ry) {
    const k = key + '|' + (rx || 1) + 'x' + (ry || 1);
    if (!cache[k]) cache[k] = mk(maker(), rx, ry);
    return cache[k];
  }
  function speckle(x, S, n, hue, sat, li, a) {
    for (let i = 0; i < n; i++) {
      x.fillStyle = 'hsla(' + (hue + Math.random() * 24 - 12) + ',' + (sat + Math.random() * 20 - 10) + '%,' +
        (li + Math.random() * 26 - 13) + '%,' + (a || .5) + ')';
      const r = 1 + Math.random() * 3.4;
      x.fillRect(Math.random() * S, Math.random() * S, r, r);
    }
  }
  function blobs(x, S, n, hue, sat, li, rmin, rmax, alpha) {
    for (let i = 0; i < n; i++) {
      const cx = Math.random() * S, cy = Math.random() * S, r = rmin + Math.random() * (rmax - rmin);
      const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
      const col = 'hsla(' + (hue + Math.random() * 30 - 15) + ',' + sat + '%,' + (li + Math.random() * 20 - 10) + '%,';
      g.addColorStop(0, col + (alpha || .55) + ')');
      g.addColorStop(1, col + '0)');
      x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r, 0, 6.3); x.fill();
    }
  }

  /* ---- 地形类 ---- */
  function ground(base, hue, sat, li, tuft) {
    return function () {
      const S = 256, o = cv(S), x = o.x;
      x.fillStyle = base; x.fillRect(0, 0, S, S);
      blobs(x, S, 40, hue, sat, li, 8, 40, .4);
      speckle(x, S, 2600, hue, sat, li, .45);
      if (tuft) for (let i = 0; i < 130; i++) {
        x.strokeStyle = 'hsla(' + (hue + Math.random() * 26 - 13) + ',' + (sat + 12) + '%,' + (li + Math.random() * 16) + '%,.55)';
        x.lineWidth = 1 + Math.random() * 2;
        const bx = Math.random() * S, by = Math.random() * S;
        x.beginPath(); x.moveTo(bx, by);
        x.quadraticCurveTo(bx + (Math.random() - .5) * 8, by - 6, bx + (Math.random() - .5) * 12, by - 12);
        x.stroke();
      }
      return o.c;
    };
  }
  function rockCanvas() {
    const S = 256, o = cv(S), x = o.x;
    x.fillStyle = '#7b7a78'; x.fillRect(0, 0, S, S);
    for (let i = 0; i < 120; i++) {
      x.fillStyle = 'hsla(' + (30 + Math.random() * 30) + ',' + (4 + Math.random() * 8) + '%,' + (28 + Math.random() * 38) + '%,.55)';
      x.beginPath();
      const cx = Math.random() * S, cy = Math.random() * S, r = 6 + Math.random() * 30;
      x.moveTo(cx + r, cy);
      for (let a = 0; a < 6.28; a += .55) x.lineTo(cx + Math.cos(a) * r * (.6 + Math.random() * .6), cy + Math.sin(a) * r * (.6 + Math.random() * .6));
      x.closePath(); x.fill();
    }
    speckle(x, S, 2400, 30, 6, 40, .35);
    return o.c;
  }
  function waterCanvas() {
    const S = 256, o = cv(S), x = o.x;
    const g = x.createLinearGradient(0, 0, 0, S);
    g.addColorStop(0, '#1f7fa8'); g.addColorStop(1, '#0d4f70');
    x.fillStyle = g; x.fillRect(0, 0, S, S);
    for (let i = 0; i < 120; i++) {
      x.strokeStyle = 'rgba(255,255,255,' + (.03 + Math.random() * .1) + ')';
      x.lineWidth = 1 + Math.random() * 3;
      const y = Math.random() * S;
      x.beginPath(); x.moveTo(0, y);
      x.bezierCurveTo(S * .3, y + (Math.random() - .5) * 12, S * .7, y + (Math.random() - .5) * 12, S, y);
      x.stroke();
    }
    return o.c;
  }
  function barkCanvas() {
    const S = 128, o = cv(S), x = o.x;
    x.fillStyle = '#6f4e30'; x.fillRect(0, 0, S, S);
    for (let i = 0; i < 70; i++) {
      x.strokeStyle = 'rgba(0,0,0,' + (.07 + Math.random() * .2) + ')';
      x.lineWidth = 1 + Math.random() * 4;
      const bx = Math.random() * S;
      x.beginPath(); x.moveTo(bx, 0);
      x.bezierCurveTo(bx + (Math.random() - .5) * 10, S / 3, bx + (Math.random() - .5) * 10, S * 2 / 3, bx + (Math.random() - .5) * 6, S);
      x.stroke();
    }
    return o.c;
  }
  function woodCanvas() {
    const S = 256, o = cv(S), x = o.x;
    x.fillStyle = '#a9793f'; x.fillRect(0, 0, S, S);
    for (let r = 0; r < 5; r++) {
      const y = r * S / 5;
      x.fillStyle = 'hsl(30,' + (36 + Math.random() * 14) + '%,' + (38 + Math.random() * 14) + '%)';
      x.fillRect(0, y + 1, S, S / 5 - 2);
      for (let i = 0; i < 22; i++) {
        x.strokeStyle = 'rgba(0,0,0,' + (.05 + Math.random() * .1) + ')';
        x.lineWidth = .6 + Math.random() * 1.6;
        const yy = y + 3 + Math.random() * (S / 5 - 6);
        x.beginPath(); x.moveTo(0, yy);
        x.bezierCurveTo(S * .3, yy + (Math.random() - .5) * 4, S * .7, yy + (Math.random() - .5) * 4, S, yy);
        x.stroke();
      }
    }
    return o.c;
  }
  function metalCanvas() {
    const S = 128, o = cv(S), x = o.x;
    const g = x.createLinearGradient(0, 0, 0, S);
    g.addColorStop(0, '#c2ccd4'); g.addColorStop(.5, '#8e99a2'); g.addColorStop(1, '#6b757d');
    x.fillStyle = g; x.fillRect(0, 0, S, S);
    for (let i = 0; i < 400; i++) {
      x.strokeStyle = 'rgba(255,255,255,' + (Math.random() * .09).toFixed(3) + ')';
      const y = Math.random() * S;
      x.beginPath(); x.moveTo(0, y); x.lineTo(S, y + (Math.random() - .5) * 2); x.stroke();
    }
    return o.c;
  }
  function hullCanvas() {
    const S = 256, o = cv(S), x = o.x;
    x.fillStyle = '#d8e2ea'; x.fillRect(0, 0, S, S);
    x.strokeStyle = 'rgba(40,60,80,.35)'; x.lineWidth = 2;
    for (let i = 0; i <= S; i += 32) {
      x.beginPath(); x.moveTo(i, 0); x.lineTo(i, S); x.stroke();
      x.beginPath(); x.moveTo(0, i); x.lineTo(S, i); x.stroke();
    }
    for (let i = 0; i < 26; i++) {
      x.fillStyle = 'rgba(60,90,120,' + (.06 + Math.random() * .12) + ')';
      x.fillRect(Math.random() * S, Math.random() * S, 10 + Math.random() * 40, 8 + Math.random() * 24);
    }
    x.fillStyle = '#3fd0e8';
    for (let i = 0; i < 12; i++) x.fillRect(Math.random() * S, Math.random() * S, 4 + Math.random() * 14, 3);
    return o.c;
  }
  function hologramCanvas() {
    const S = 128, o = cv(S), x = o.x;
    x.fillStyle = 'rgba(0,0,0,0)'; x.clearRect(0, 0, S, S);
    x.strokeStyle = 'rgba(90,230,255,.75)'; x.lineWidth = 1.4;
    for (let i = 0; i <= S; i += 16) {
      x.beginPath(); x.moveTo(i, 0); x.lineTo(i, S); x.stroke();
      x.beginPath(); x.moveTo(0, i); x.lineTo(S, i); x.stroke();
    }
    x.strokeStyle = 'rgba(180,255,255,.35)';
    for (let i = 0; i <= S; i += 4) { x.beginPath(); x.moveTo(0, i); x.lineTo(S, i); x.stroke(); }
    return o.c;
  }
  function blobTex(color, soft) {
    const S = 128, o = cv(S), x = o.x;
    const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0, color);
    g.addColorStop(soft || .3, color.replace(/[\d.]+\)$/, '.4)'));
    g.addColorStop(1, color.replace(/[\d.]+\)$/, '0)'));
    x.fillStyle = g; x.fillRect(0, 0, S, S);
    return o.c;
  }
  function cloudCanvas() {
    const S = 256, o = cv(S), x = o.x;
    for (let i = 0; i < 24; i++) {
      const r = 16 + Math.random() * 54, cx = 40 + Math.random() * (S - 80), cy = 60 + Math.random() * (S - 130);
      const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, 'rgba(255,255,255,.72)');
      g.addColorStop(.6, 'rgba(255,255,255,.26)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r, 0, 6.3); x.fill();
    }
    return o.c;
  }
  function nebulaCanvas() {
    const S = 256, o = cv(S), x = o.x;
    x.clearRect(0, 0, S, S);
    const hues = [280, 200, 320, 180, 250];
    for (let i = 0; i < 22; i++) {
      const h = hues[i % hues.length];
      const cx = Math.random() * S, cy = Math.random() * S, r = 30 + Math.random() * 90;
      const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, 'hsla(' + h + ',80%,62%,.30)');
      g.addColorStop(.5, 'hsla(' + h + ',75%,45%,.13)');
      g.addColorStop(1, 'hsla(' + h + ',70%,30%,0)');
      x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r, 0, 6.3); x.fill();
    }
    for (let i = 0; i < 400; i++) {
      x.fillStyle = 'rgba(255,255,255,' + (Math.random() * .8) + ')';
      x.fillRect(Math.random() * S, Math.random() * S, 1.2, 1.2);
    }
    return o.c;
  }

  /* ---- 生物皮肤：底色 + 花纹 ---- */
  function skinCanvas(h, s, l, pattern) {
    const S = 256, o = cv(S), x = o.x;
    x.fillStyle = 'hsl(' + h + ',' + s + '%,' + l + '%)';
    x.fillRect(0, 0, S, S);
    // 腹部渐亮（生物普遍腹白）
    const g = x.createLinearGradient(0, 0, 0, S);
    g.addColorStop(0, 'rgba(0,0,0,.22)');
    g.addColorStop(.55, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(255,255,255,.3)');
    x.fillStyle = g; x.fillRect(0, 0, S, S);
    if (pattern === 'spots') {
      for (let i = 0; i < 46; i++) {
        const r = 6 + Math.random() * 20;
        x.fillStyle = 'hsla(' + ((h + 190) % 360) + ',' + (s * .8) + '%,' + Math.max(8, l - 22) + '%,.55)';
        x.beginPath(); x.ellipse(Math.random() * S, Math.random() * S, r, r * (.6 + Math.random() * .5), Math.random() * 3, 0, 6.3); x.fill();
      }
    } else if (pattern === 'stripes') {
      for (let i = 0; i < 16; i++) {
        x.save();
        x.translate(Math.random() * S, 0);
        x.rotate((Math.random() - .5) * .5);
        x.fillStyle = 'hsla(' + h + ',' + (s * .9) + '%,' + Math.max(6, l - 26) + '%,.6)';
        x.fillRect(0, -20, 6 + Math.random() * 16, S + 40);
        x.restore();
      }
    } else if (pattern === 'gradient') {
      const g2 = x.createLinearGradient(0, 0, S, S);
      g2.addColorStop(0, 'hsla(' + ((h + 40) % 360) + ',' + s + '%,' + Math.min(88, l + 18) + '%,.8)');
      g2.addColorStop(1, 'hsla(' + ((h + 320) % 360) + ',' + s + '%,' + Math.max(8, l - 18) + '%,.75)');
      x.fillStyle = g2; x.fillRect(0, 0, S, S);
    } else if (pattern === 'scales') {
      for (let yy = 0; yy < S; yy += 12) {
        for (let xx = 0; xx < S; xx += 12) {
          x.strokeStyle = 'hsla(' + h + ',' + s + '%,' + Math.max(6, l - 18) + '%,.35)';
          x.lineWidth = 1.2;
          x.beginPath(); x.arc(xx + (yy / 12 % 2 ? 6 : 0), yy, 7, .2, Math.PI - .2); x.stroke();
        }
      }
    }
    speckle(x, S, 700, h, s, l, .18);
    return o.c;
  }

  /* ---- 行星表面 ---- */
  const PLANET = {
    lush: { sea: '#1c6fa8', land: '#4f9b3f', hi: '#8f7b4a', ice: '#eef6ff', cloud: .55 },
    dry: { sea: '#8a6a3a', land: '#c69a54', hi: '#8a5f34', ice: '#e8d9b8', cloud: .18 },
    ice: { sea: '#8fc6e8', land: '#dff0fa', hi: '#ffffff', ice: '#ffffff', cloud: .4 },
    gas: { sea: '#c98f4a', land: '#e8c07a', hi: '#a86a3a', ice: '#f6e2b8', cloud: .9 },
    rock: { sea: '#4a4a50', land: '#6e6a64', hi: '#9a948a', ice: '#c8c4bc', cloud: .05 }
  };
  function planetCanvas(kind) {
    const P = PLANET[kind] || PLANET.rock;
    const W = 512, H = 256, o = cv(W, H), x = o.x;
    x.fillStyle = P.sea; x.fillRect(0, 0, W, H);
    const n = SP.U.makeNoise2D(kind.charCodeAt(0) * 977 + 13);
    // 大陆
    for (let i = 0; i < 5200; i++) {
      const px = Math.random() * W, py = Math.random() * H;
      const v = SP.U.fbm(n, px * .012, py * .012, 5, 2.1, .55);
      if (kind === 'gas') {
        const band = Math.sin(py * .09 + v * 3) * .5 + .5;
        x.fillStyle = band > .5 ? P.land : P.hi;
        x.globalAlpha = .32; x.fillRect(px, py, 6, 3); x.globalAlpha = 1;
        continue;
      }
      if (v > .04) {
        x.fillStyle = v > .3 ? P.hi : P.land;
        x.globalAlpha = .5;
        x.fillRect(px, py, 4, 4);
        x.globalAlpha = 1;
      }
    }
    // 极冠
    const g1 = x.createLinearGradient(0, 0, 0, H * .16);
    g1.addColorStop(0, P.ice); g1.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g1; x.fillRect(0, 0, W, H * .16);
    const g2 = x.createLinearGradient(0, H, 0, H * .84);
    g2.addColorStop(0, P.ice); g2.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g2; x.fillRect(0, H * .84, W, H * .16);
    // 云带
    if (P.cloud > .05) blobs(x, W, Math.round(P.cloud * 60), 200, 10, 92, 12, 60, P.cloud * .5);
    return o.c;
  }

  return {
    grass: (rx, ry) => get('grass', ground('#4f9b3f', 100, 48, 40, true), rx, ry),
    dirt: (rx, ry) => get('dirt', ground('#7a5a3a', 28, 34, 34, false), rx, ry),
    sand: (rx, ry) => get('sand', ground('#e0cb98', 42, 46, 72, false), rx, ry),
    snow: (rx, ry) => get('snow', ground('#eef4fb', 210, 30, 94, false), rx, ry),
    rock: (rx, ry) => get('rock', rockCanvas, rx, ry),
    water: (rx, ry) => get('water', waterCanvas, rx, ry),
    bark: (rx, ry) => get('bark', barkCanvas, rx, ry),
    wood: (rx, ry) => get('wood', woodCanvas, rx, ry),
    metal: (rx, ry) => get('metal', metalCanvas, rx, ry),
    hull: (rx, ry) => get('hull', hullCanvas, rx, ry),
    hologram: (rx, ry) => get('holo', hologramCanvas, rx, ry),
    cloud: () => get('cloud', cloudCanvas),
    nebula: () => get('nebula', nebulaCanvas),
    glow: () => get('glow', () => blobTex('rgba(255,240,200,1)', .12)),
    star: () => get('star', () => blobTex('rgba(220,240,255,1)', .1)),
    soft: () => get('soft', () => blobTex('rgba(255,255,255,.95)', .3)),
    planet: (kind) => get('planet_' + kind, () => planetCanvas(kind || 'rock')),
    skin: (h, s, l, pattern) => get('skin_' + Math.round(h) + '_' + Math.round(s) + '_' + Math.round(l) + '_' + (pattern || 'none'),
      () => skinCanvas(h, s, l, pattern)),
    canvas: cv
  };
})();

/* ============================================================== 音频 */
SP.Audio = (function () {
  let ctx = null, master = null, sfx = null, amb = null, mus = null, noiseBuf = null;
  let vol = .7, started = false;
  const loops = {};

  function init() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = vol;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 6; comp.attack.value = .004; comp.release.value = .25;
    master.connect(comp); comp.connect(ctx.destination);
    sfx = ctx.createGain(); sfx.gain.value = 1; sfx.connect(master);
    amb = ctx.createGain(); amb.gain.value = .4; amb.connect(master);
    mus = ctx.createGain(); mus.gain.value = .3; mus.connect(master);
    const len = ctx.sampleRate * 3;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + .02 * w) / 1.02; d[i] = last * 3.2; }
  }
  function resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); }
  function setVolume(v) { vol = v; if (master) master.gain.value = v; }
  const now = () => ctx ? ctx.currentTime : 0;

  function tone(o) {
    if (!ctx) return;
    const t = now() + (o.delay || 0);
    const osc = ctx.createOscillator();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f0, t);
    if (o.f1 != null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f1), t + o.dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(.0001, t);
    g.gain.exponentialRampToValueAtTime(o.gain == null ? .18 : o.gain, t + (o.atk || .008));
    g.gain.exponentialRampToValueAtTime(.0001, t + o.dur);
    let node = osc;
    if (o.filter) {
      const bq = ctx.createBiquadFilter();
      bq.type = o.filter; bq.frequency.value = o.fc || 900; bq.Q.value = o.q || 1;
      osc.connect(bq); node = bq;
    }
    node.connect(g); g.connect(o.bus || sfx);
    osc.start(t); osc.stop(t + o.dur + .05);
  }
  function noise(o) {
    if (!ctx || !noiseBuf) return;
    const t = now() + (o.delay || 0);
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf; src.loop = true; src.playbackRate.value = o.rate || 1;
    const bq = ctx.createBiquadFilter();
    bq.type = o.filter || 'bandpass';
    bq.frequency.setValueAtTime(o.fc || 900, t);
    if (o.fc1) bq.frequency.exponentialRampToValueAtTime(Math.max(30, o.fc1), t + o.dur);
    bq.Q.value = o.q || 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(.0001, t);
    g.gain.exponentialRampToValueAtTime(o.gain == null ? .18 : o.gain, t + (o.atk || .006));
    g.gain.exponentialRampToValueAtTime(.0001, t + o.dur);
    src.connect(bq); bq.connect(g); g.connect(o.bus || sfx);
    src.start(t); src.stop(t + o.dur + .05);
  }
  const seq = (notes, type, dur, gain, step, bus) => notes.forEach((f, i) =>
    tone({ type: type || 'sine', f0: f, dur: dur || .18, gain: gain == null ? .12 : gain, delay: i * (step || .09), bus: bus }));

  const LIB = {
    /* — 界面 — */
    ui_hover: () => tone({ type: 'sine', f0: 880, f1: 1120, dur: .06, gain: .05 }),
    ui_click: () => { tone({ type: 'triangle', f0: 600, f1: 920, dur: .09, gain: .12 }); tone({ type: 'sine', f0: 1500, dur: .05, gain: .05, delay: .02 }); },
    ui_open: () => { tone({ type: 'sine', f0: 380, f1: 820, dur: .18, gain: .1 }); noise({ fc: 2400, fc1: 900, dur: .2, gain: .05 }); },
    ui_close: () => tone({ type: 'sine', f0: 760, f1: 320, dur: .15, gain: .09 }),
    deny: () => tone({ type: 'square', f0: 190, f1: 120, dur: .17, gain: .09, filter: 'lowpass', fc: 700 }),
    confirm: () => seq([523, 784], 'triangle', .16, .12, .08),

    /* — 生物 — */
    eat: () => { noise({ fc: 700, fc1: 300, dur: .16, gain: .16, q: .7 }); tone({ type: 'sine', f0: 220, f1: 140, dur: .14, gain: .08 }); },
    bite: () => { noise({ fc: 900, fc1: 220, dur: .14, gain: .24, q: .6 }); tone({ type: 'triangle', f0: 300, f1: 110, dur: .13, gain: .12 }); },
    hurt: () => { tone({ type: 'square', f0: 300, f1: 120, dur: .2, gain: .13, filter: 'lowpass', fc: 800 }); noise({ fc: 600, fc1: 200, dur: .22, gain: .15 }); },
    die: () => seq([392, 311, 233, 165], 'sine', 1.0, .12, .2),
    spit: () => { noise({ fc: 2200, fc1: 700, dur: .22, gain: .16, q: .5 }); tone({ type: 'sine', f0: 700, f1: 240, dur: .2, gain: .07 }); },
    shock: () => { for (let i = 0; i < 5; i++) tone({ type: 'square', f0: 1200 + Math.random() * 1800, dur: .05, gain: .07, delay: i * .035, filter: 'highpass', fc: 800 }); },
    jet: () => noise({ fc: 1400, fc1: 2600, dur: .32, gain: .13, q: .4 }),
    step: () => noise({ fc: 400 + Math.random() * 260, fc1: 180, dur: .1, gain: .08, q: .8 }),
    roar: () => { tone({ type: 'sawtooth', f0: 160, f1: 70, dur: .9, gain: .18, filter: 'lowpass', fc: 500 }); noise({ fc: 320, fc1: 130, dur: .95, gain: .14 }); },
    epic_roar: () => { tone({ type: 'sawtooth', f0: 90, f1: 42, dur: 2.0, gain: .26, filter: 'lowpass', fc: 320 }); noise({ fc: 200, fc1: 80, dur: 2.1, gain: .2 }); tone({ type: 'sine', f0: 55, f1: 30, dur: 2.2, gain: .16, delay: .1 }); },

    /* — 成长 / 解锁 — */
    dna: () => { tone({ type: 'sine', f0: 1200, f1: 1800, dur: .12, gain: .08 }); tone({ type: 'sine', f0: 1800, dur: .1, gain: .05, delay: .06 }); },
    levelup: () => seq([523, 659, 784, 1046], 'triangle', .35, .11, .08),
    unlock: () => seq([440, 554, 659, 880], 'sine', .5, .1, .09),
    evolve: () => { seq([392, 494, 587, 784, 988], 'triangle', .6, .1, .12); noise({ fc: 1200, fc1: 4000, dur: .9, gain: .07 }); },
    stage_up: () => { seq([262, 330, 392, 523, 659, 784, 1046], 'sine', 1.1, .12, .16); noise({ fc: 800, fc1: 5000, dur: 1.6, gain: .08 }); },

    /* — 社交 — */
    sing: () => seq([523, 659, 784], 'sine', .5, .12, .14),
    dance: () => { [0, .12, .24, .36].forEach((d, i) => { noise({ fc: 500, fc1: 1600, dur: .12, gain: .1, delay: d }); tone({ type: 'triangle', f0: 300 + i * 90, dur: .14, gain: .09, delay: d }); }); },
    charm: () => { tone({ type: 'sine', f0: 700, f1: 1300, dur: .5, gain: .1 }); tone({ type: 'sine', f0: 1050, f1: 1750, dur: .45, gain: .05, delay: .08 }); },
    pose: () => { tone({ type: 'triangle', f0: 440, dur: .3, gain: .1 }); tone({ type: 'triangle', f0: 660, dur: .3, gain: .07, delay: .1 }); },
    ally: () => seq([523, 659, 784, 1046, 1318], 'sine', .7, .11, .1),
    social_ok: () => seq([784, 988], 'sine', .2, .1, .07),
    social_fail: () => seq([330, 247], 'triangle', .25, .1, .1),

    /* — 部落 / 生产 — */
    dig: () => noise({ fc: 700, fc1: 240, dur: .24, gain: .16, q: .6 }),
    build: () => { noise({ fc: 900, fc1: 300, dur: .3, gain: .18 }); seq([300, 420], 'triangle', .16, .1, .12); },
    gather: () => { noise({ fc: 1600, fc1: 700, dur: .18, gain: .1, q: .5 }); tone({ type: 'sine', f0: 800, f1: 1200, dur: .12, gain: .07 }); },
    chop: () => { noise({ fc: 800, fc1: 200, dur: .2, gain: .26, q: .6 }); tone({ type: 'triangle', f0: 210, f1: 90, dur: .2, gain: .12 }); },
    craft: () => seq([520, 700, 900], 'triangle', .14, .1, .07),
    place: () => { noise({ fc: 800, fc1: 260, dur: .16, gain: .22 }); tone({ type: 'sine', f0: 180, f1: 96, dur: .18, gain: .12 }); },
    drum: () => { tone({ type: 'sine', f0: 120, f1: 55, dur: .28, gain: .24 }); noise({ fc: 300, fc1: 120, dur: .18, gain: .12 }); },
    horn: () => { tone({ type: 'sawtooth', f0: 220, f1: 233, dur: .8, gain: .14, filter: 'lowpass', fc: 1100 }); tone({ type: 'sawtooth', f0: 330, dur: .7, gain: .07, delay: .05, filter: 'lowpass', fc: 1400 }); },
    didgeridoo: () => { tone({ type: 'sawtooth', f0: 78, dur: 1.4, gain: .2, filter: 'lowpass', fc: 420 }); noise({ fc: 160, dur: 1.4, gain: .07 }); },
    maracas: () => { for (let i = 0; i < 4; i++) noise({ fc: 5200, fc1: 3400, dur: .07, gain: .1, q: .8, delay: i * .075 }); },
    spear_throw: () => { noise({ fc: 2400, fc1: 900, dur: .2, gain: .14, q: .6 }); tone({ type: 'triangle', f0: 620, f1: 220, dur: .18, gain: .08 }); },
    fire: () => noise({ fc: 420 + Math.random() * 300, dur: .3, gain: .05, q: .5 }),

    /* — 文明 / 星际 — */
    boom: () => { noise({ fc: 220, fc1: 60, dur: 1.1, gain: .34, q: .4 }); tone({ type: 'sine', f0: 90, f1: 32, dur: 1.0, gain: .18 }); },
    laser: () => { tone({ type: 'square', f0: 1500, f1: 260, dur: .16, gain: .11, filter: 'lowpass', fc: 2600 }); noise({ fc: 3000, fc1: 800, dur: .14, gain: .07 }); },
    warp: () => { tone({ type: 'sine', f0: 120, f1: 2400, dur: .9, gain: .14 }); noise({ fc: 400, fc1: 6000, dur: 1.0, gain: .1 }); tone({ type: 'sine', f0: 2400, f1: 200, dur: .5, gain: .07, delay: .8 }); },
    scan: () => { for (let i = 0; i < 6; i++) tone({ type: 'sine', f0: 900 + i * 180, dur: .1, gain: .06, delay: i * .07 }); },
    terraform: () => { tone({ type: 'sine', f0: 180, f1: 620, dur: 1.2, gain: .12 }); noise({ fc: 600, fc1: 2400, dur: 1.4, gain: .09 }); },
    colonize: () => { seq([392, 523, 659, 784], 'triangle', .5, .12, .11); noise({ fc: 900, fc1: 2600, dur: .7, gain: .07 }); },
    spice: () => { seq([1046, 1318, 1568], 'sine', .22, .09, .06); },
    mission_ok: () => seq([659, 880, 1046, 1318], 'triangle', .4, .12, .09)
  };

  function play(name, gainScale) {
    if (!ctx) return;
    resume();
    const f = LIB[name];
    if (!f) return;
    if (gainScale != null && gainScale !== 1) {
      const g = sfx.gain.value;
      sfx.gain.value = g * gainScale;
      f();
      setTimeout(() => { sfx.gain.value = g; }, 0);
    } else f();
  }

  /* ---- 环境音 ---- */
  function makeLoop(cfg) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf; src.loop = true; src.playbackRate.value = cfg.rate || 1;
    const bq = ctx.createBiquadFilter();
    bq.type = cfg.filter || 'lowpass'; bq.frequency.value = cfg.fc; bq.Q.value = cfg.q || .7;
    const g = ctx.createGain(); g.gain.value = 0;
    const lfo = ctx.createOscillator(); lfo.frequency.value = cfg.lfo || .12;
    const lg = ctx.createGain(); lg.gain.value = cfg.lfoAmt || .3;
    lfo.connect(lg); lg.connect(g.gain);
    src.connect(bq); bq.connect(g); g.connect(amb);
    src.start(); lfo.start();
    return g;
  }
  function startAmbient() {
    if (!ctx || started) return;
    started = true;
    loops.water_amb = makeLoop({ fc: 500, rate: .5, lfo: .1, lfoAmt: .3 });
    loops.wind_amb = makeLoop({ fc: 1300, filter: 'bandpass', rate: 1.3, lfo: .08, lfoAmt: .22, q: .6 });
    loops.rain = makeLoop({ fc: 4200, filter: 'highpass', rate: 1.9, lfo: .3, lfoAmt: .08 });
    loops.space_amb = makeLoop({ fc: 180, rate: .25, lfo: .05, lfoAmt: .18 });
  }
  function setAmbient(k, v) {
    if (!loops[k]) return;
    loops[k].gain.setTargetAtTime(v, now(), .9);
  }

  /* ---- 自适应配乐：五阶段各一套音阶 ---- */
  const SCALES = {
    cell: { root: 261.63, steps: [0, 2, 4, 7, 9], type: 'sine', gain: .05, gap: [6, 11] },
    creature: { root: 196.00, steps: [0, 3, 5, 7, 10], type: 'triangle', gain: .06, gap: [7, 13] },
    tribal: { root: 174.61, steps: [0, 2, 3, 7, 8], type: 'triangle', gain: .07, gap: [5, 10] },
    civ: { root: 220.00, steps: [0, 4, 7, 11, 14], type: 'sine', gain: .06, gap: [8, 15] },
    space: { root: 130.81, steps: [0, 5, 7, 12, 17], type: 'sine', gain: .055, gap: [9, 18] },
    tense: { root: 116.54, steps: [0, 1, 6, 7, 11], type: 'sawtooth', gain: .05, gap: [3, 7] }
  };
  let musT = 0, musOn = true, mood = 'cell';
  function setMusic(m) { if (SCALES[m]) mood = m; }
  function musicTick(dt, m) {
    if (!ctx || !musOn) return;
    if (m && SCALES[m]) mood = m;
    musT -= dt;
    if (musT > 0) return;
    const S = SCALES[mood] || SCALES.cell;
    musT = SP.U.rand(S.gap[0], S.gap[1]);
    const n = SP.U.randi(3, 5);
    for (let i = 0; i < n; i++) {
      const semi = SP.U.choice(S.steps) + (SP.U.chance(.3) ? 12 : 0);
      const f = S.root * Math.pow(2, semi / 12);
      tone({ type: S.type, f0: f, dur: 2.2 + Math.random() * 1.4, gain: S.gain, atk: .5, delay: i * .6, bus: mus, filter: 'lowpass', fc: 1700 });
      if (i === 0) tone({ type: 'sine', f0: S.root / 2, dur: 4.5, gain: S.gain * .7, atk: 1.2, bus: mus });
    }
  }
  function enableMusic(on) { musOn = on; }

  return { init, resume, play, setVolume, startAmbient, setAmbient, setMusic, musicTick, enableMusic, get ctx() { return ctx; } };
})();
