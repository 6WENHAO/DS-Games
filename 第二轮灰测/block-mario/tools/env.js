/* =========================================================
   tools/env.js — 无浏览器验收环境
   · 纯 JS 软件 2D 光栅器（仿射变换 / alpha 混合 / getImageData）
   · PNG 编码器（zlib）
   · 桩 DOM，可按需加载 js/ 下的模块
   ========================================================= */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');

/* ---------- 颜色 ---------- */
const colCache = new Map();
function parseColor(c) {
  if (typeof c !== 'string') return null;
  let v = colCache.get(c);
  if (v) return v;
  let out = [0, 0, 0, 255];
  const s = c.trim();
  if (s[0] === '#') {
    if (s.length === 4) out = [parseInt(s[1] + s[1], 16), parseInt(s[2] + s[2], 16), parseInt(s[3] + s[3], 16), 255];
    else if (s.length === 5) out = [parseInt(s[1] + s[1], 16), parseInt(s[2] + s[2], 16), parseInt(s[3] + s[3], 16), parseInt(s[4] + s[4], 16)];
    else if (s.length === 9) out = [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16), parseInt(s.slice(7, 9), 16)];
    else out = [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16), 255];
  } else if (s.startsWith('rgba') || s.startsWith('rgb')) {
    const p = s.slice(s.indexOf('(') + 1, s.indexOf(')')).split(',').map(Number);
    out = [p[0] | 0, p[1] | 0, p[2] | 0, Math.round((p[3] === undefined ? 1 : p[3]) * 255)];
  }
  colCache.set(c, out);
  return out;
}

function matMul(m, n) {
  return [
    m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]
  ];
}
function matInv(m) {
  const det = m[0] * m[3] - m[1] * m[2];
  if (!det) return [1, 0, 0, 1, 0, 0];
  const id = 1 / det;
  return [m[3] * id, -m[1] * id, -m[2] * id, m[0] * id,
    (m[2] * m[5] - m[3] * m[4]) * id, (m[1] * m[4] - m[0] * m[5]) * id];
}
function ap(m, x, y) { return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]; }

class Ctx {
  constructor(t) {
    this.t = t; this.m = [1, 0, 0, 1, 0, 0]; this.stack = [];
    this.fillStyle = '#000'; this.strokeStyle = '#000'; this.lineWidth = 1;
    this.globalAlpha = 1; this.globalCompositeOperation = 'source-over';
    this.imageSmoothingEnabled = false; this.font = '10px monospace'; this.textAlign = 'left';
    this.textBaseline = 'alphabetic'; this.path = []; this.canvas = t; this.shadowBlur = 0; this.shadowColor = '#000';
  }
  save() { this.stack.push([this.m.slice(), this.fillStyle, this.strokeStyle, this.globalAlpha, this.lineWidth, this.globalCompositeOperation]); }
  restore() { const s = this.stack.pop(); if (s) { this.m = s[0]; this.fillStyle = s[1]; this.strokeStyle = s[2]; this.globalAlpha = s[3]; this.lineWidth = s[4]; this.globalCompositeOperation = s[5]; } }
  translate(x, y) { this.m = matMul(this.m, [1, 0, 0, 1, x, y]); }
  scale(x, y) { this.m = matMul(this.m, [x, 0, 0, y, 0, 0]); }
  rotate(a) { const c = Math.cos(a), s = Math.sin(a); this.m = matMul(this.m, [c, s, -s, c, 0, 0]); }
  setTransform(a, b, c, d, e, f) { this.m = [a, b, c, d, e, f]; }
  resetTransform() { this.m = [1, 0, 0, 1, 0, 0]; }
  transform(a, b, c, d, e, f) { this.m = matMul(this.m, [a, b, c, d, e, f]); }

  _blend(px, py, rgba, alpha) {
    const t = this.t;
    if (px < 0 || py < 0 || px >= t.width || py >= t.height) return;
    const i = (py * t.width + px) * 4, d = t.data;
    let a = (rgba[3] / 255) * alpha;
    if (a <= 0) return;
    if (this.globalCompositeOperation === 'source-atop') {
      const da = d[i + 3] / 255;
      if (da <= 0) return;
      a *= da;
    } else if (this.globalCompositeOperation === 'destination-out') {
      d[i + 3] = Math.max(0, d[i + 3] - a * 255);
      return;
    }
    const ia = 1 - a;
    d[i] = rgba[0] * a + d[i] * ia;
    d[i + 1] = rgba[1] * a + d[i + 1] * ia;
    d[i + 2] = rgba[2] * a + d[i + 2] * ia;
    d[i + 3] = Math.max(d[i + 3], Math.round(a * 255 + d[i + 3] * ia));
  }
  _span(x, y, w, h, cb) {
    const inv = matInv(this.m);
    const cs = [ap(this.m, x, y), ap(this.m, x + w, y), ap(this.m, x, y + h), ap(this.m, x + w, y + h)];
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const c of cs) { x0 = Math.min(x0, c[0]); y0 = Math.min(y0, c[1]); x1 = Math.max(x1, c[0]); y1 = Math.max(y1, c[1]); }
    x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0));
    x1 = Math.min(this.t.width - 1, Math.ceil(x1)); y1 = Math.min(this.t.height - 1, Math.ceil(y1));
    for (let py = y0; py <= y1; py++) {
      for (let px = x0; px <= x1; px++) {
        const lx = inv[0] * (px + 0.5) + inv[2] * (py + 0.5) + inv[4];
        const ly = inv[1] * (px + 0.5) + inv[3] * (py + 0.5) + inv[5];
        if (lx >= x && lx < x + w && ly >= y && ly < y + h) cb(px, py, lx - x, ly - y);
      }
    }
  }
  _grad(g, px, py) {
    let t;
    if (g.kind === 'linear') {
      const dx = g.x1 - g.x0, dy = g.y1 - g.y0;
      const len2 = dx * dx + dy * dy || 1;
      t = ((px + 0.5 - g.x0) * dx + (py + 0.5 - g.y0) * dy) / len2;
    } else {
      const d = Math.hypot(px + 0.5 - g.x1, py + 0.5 - g.y1);
      t = (d - g.r0) / Math.max(0.0001, g.r1 - g.r0);
    }
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const st = g.stops;
    if (!st.length) return [0, 0, 0, 0];
    let a = st[0], b = st[st.length - 1];
    for (let i = 0; i < st.length - 1; i++) if (t >= st[i][0] && t <= st[i + 1][0]) { a = st[i]; b = st[i + 1]; break; }
    const k = Math.min(1, Math.max(0, (t - a[0]) / Math.max(1e-6, b[0] - a[0])));
    const ca = parseColor(a[1]) || [0, 0, 0, 0], cb = parseColor(b[1]) || [0, 0, 0, 0];
    return [ca[0] + (cb[0] - ca[0]) * k, ca[1] + (cb[1] - ca[1]) * k, ca[2] + (cb[2] - ca[2]) * k, ca[3] + (cb[3] - ca[3]) * k];
  }
  fillRect(x, y, w, h) {
    if (!(w > 0) || !(h > 0)) return;
    const a = this.globalAlpha, st = this.fillStyle;
    if (st && typeof st === 'object' && st.stops) { this._span(x, y, w, h, (px, py) => this._blend(px, py, this._grad(st, px, py), a)); return; }
    const col = parseColor(st) || [0, 0, 0, 255];
    this._span(x, y, w, h, (px, py) => this._blend(px, py, col, a));
  }
  clearRect(x, y, w, h) {
    this._span(x, y, w, h, (px, py) => {
      const i = (py * this.t.width + px) * 4;
      this.t.data[i] = this.t.data[i + 1] = this.t.data[i + 2] = this.t.data[i + 3] = 0;
    });
  }
  drawImage(src, dx, dy, dw, dh) {
    if (!src || !src.width) return;
    if (dw === undefined) { dw = src.width; dh = src.height; }
    const sw = src.width, sh = src.height, sd = src.data, a = this.globalAlpha;
    this._span(dx, dy, dw, dh, (px, py, u, v) => {
      const sx = Math.min(sw - 1, Math.floor(u / dw * sw));
      const sy = Math.min(sh - 1, Math.floor(v / dh * sh));
      const si = (sy * sw + sx) * 4;
      if (sd[si + 3] === 0) return;
      this._blend(px, py, [sd[si], sd[si + 1], sd[si + 2], sd[si + 3]], a);
    });
  }
  beginPath() { this.path = []; }
  closePath() {} moveTo() {} lineTo() {} clip() {} fillText() {} strokeText() {}
  arc(x, y, r, a0, a1) { this.path.push({ k: 'arc', x, y, r, a0, a1 }); }
  ellipse(x, y, rx, ry) { this.path.push({ k: 'el', x, y, rx, ry }); }
  rect(x, y, w, h) { this.path.push({ k: 'rect', x, y, w, h }); }
  fill() {
    const a = this.globalAlpha, st = this.fillStyle;
    const col = (st && typeof st === 'object') ? null : (parseColor(st) || [0, 0, 0, 255]);
    for (const p of this.path) {
      if (p.k === 'rect') { this.fillRect(p.x, p.y, p.w, p.h); continue; }
      const rx = p.k === 'el' ? p.rx : p.r, ry = p.k === 'el' ? p.ry : p.r;
      if (!(rx > 0) || !(ry > 0)) continue;
      this._span(p.x - rx, p.y - ry, rx * 2, ry * 2, (px, py, u, v) => {
        const lx = (u - rx) / rx, ly = (v - ry) / ry;
        if (lx * lx + ly * ly <= 1) this._blend(px, py, col || this._grad(st, px, py), a);
      });
    }
  }
  stroke() {
    const col = parseColor(this.strokeStyle) || [0, 0, 0, 255], a = this.globalAlpha, lw = Math.max(1, this.lineWidth);
    for (const p of this.path) {
      if (p.k !== 'arc' || !(p.r > 0)) continue;
      const R = p.r + lw, r0 = p.r - lw / 2, r1 = p.r + lw / 2;
      const full = Math.abs(p.a1 - p.a0) >= 6.28;
      this._span(p.x - R, p.y - R, R * 2, R * 2, (px, py, u, v) => {
        const lx = u - R, ly = v - R, d = Math.sqrt(lx * lx + ly * ly);
        if (d < r0 || d > r1) return;
        if (!full) {
          const ang = Math.atan2(ly, lx);
          const da = ((ang - p.a0) % 6.283185307 + 6.283185307) % 6.283185307;
          const sweep = ((p.a1 - p.a0) % 6.283185307 + 6.283185307) % 6.283185307;
          if (da > sweep) return;
        }
        this._blend(px, py, col, a);
      });
    }
  }
  strokeRect(x, y, w, h) {
    const s = this.fillStyle; this.fillStyle = this.strokeStyle;
    this.fillRect(x, y, w, this.lineWidth); this.fillRect(x, y + h - this.lineWidth, w, this.lineWidth);
    this.fillRect(x, y, this.lineWidth, h); this.fillRect(x + w - this.lineWidth, y, this.lineWidth, h);
    this.fillStyle = s;
  }
  measureText(t) { return { width: (t || '').length * 6 }; }
  createLinearGradient(x0, y0, x1, y1) { const stops = []; return { kind: 'linear', x0, y0, x1, y1, stops, addColorStop: (o, c) => stops.push([o, c]) }; }
  createRadialGradient(x0, y0, r0, x1, y1, r1) { const stops = []; return { kind: 'radial', x0, y0, r0, x1, y1, r1, stops, addColorStop: (o, c) => stops.push([o, c]) }; }
  createPattern() { return null; }
  /* 真实的 getImageData / putImageData —— 描边与后处理需要 */
  getImageData(x, y, w, h) {
    x = x | 0; y = y | 0; w = w | 0; h = h | 0;
    const out = new Uint8ClampedArray(w * h * 4);
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const sx = x + i, sy = y + j;
        if (sx < 0 || sy < 0 || sx >= this.t.width || sy >= this.t.height) continue;
        const si = (sy * this.t.width + sx) * 4, di = (j * w + i) * 4;
        out[di] = this.t.data[si]; out[di + 1] = this.t.data[si + 1];
        out[di + 2] = this.t.data[si + 2]; out[di + 3] = this.t.data[si + 3];
      }
    }
    return { width: w, height: h, data: out };
  }
  putImageData(img, x, y) {
    x = x | 0; y = y | 0;
    for (let j = 0; j < img.height; j++) {
      for (let i = 0; i < img.width; i++) {
        const dx = x + i, dy = y + j;
        if (dx < 0 || dy < 0 || dx >= this.t.width || dy >= this.t.height) continue;
        const si = (j * img.width + i) * 4, di = (dy * this.t.width + dx) * 4;
        this.t.data[di] = img.data[si]; this.t.data[di + 1] = img.data[si + 1];
        this.t.data[di + 2] = img.data[si + 2]; this.t.data[di + 3] = img.data[si + 3];
      }
    }
  }
}

class Raster {
  constructor(w, h) { this._w = 0; this._h = 0; this.data = new Uint8ClampedArray(4); this._ctx = new Ctx(this); if (w) this.width = w; if (h) this.height = h; }
  getContext() { return this._ctx; }
}
Object.defineProperty(Raster.prototype, 'width', { get() { return this._w; }, set(v) { this._w = v | 0; this._alloc(); } });
Object.defineProperty(Raster.prototype, 'height', { get() { return this._h; }, set(v) { this._h = v | 0; this._alloc(); } });
Raster.prototype._alloc = function () { if (this._w > 0 && this._h > 0) this.data = new Uint8ClampedArray(this._w * this._h * 4); };

/* ---------- PNG ---------- */
function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = c ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}
function writePNG(file, raster) {
  const w = raster.width, h = raster.height, d = raster.data;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    for (let x = 0; x < w * 4; x++) raw[y * (w * 4 + 1) + 1 + x] = d[y * w * 4 + x];
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))
  ]);
  fs.writeFileSync(file, png);
  return png.length;
}

/* ---------- 桩 DOM ---------- */
function forceGlobal(g, name, value) {
  try { g[name] = value; } catch (e) {}
  if (g[name] !== value) Object.defineProperty(g, name, { value, writable: true, configurable: true });
}
function makeEl(tag) {
  if ((tag || '').toLowerCase() === 'canvas') return new Raster(1, 1);
  const el = {
    tagName: (tag || 'div').toUpperCase(), style: {}, children: [], className: '', title: '',
    _text: '', _html: '', width: 0, height: 0, onclick: null, checked: false,
    classList: { add() {}, remove() {}, contains() { return false; }, toggle() {} },
    appendChild(c) { this.children.push(c); return c; },
    removeChild(c) { this.children = this.children.filter(x => x !== c); return c; },
    addEventListener() {}, removeEventListener() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 }),
    focus() {}, remove() {}
  };
  Object.defineProperty(el, 'textContent', { get() { return this._text; }, set(v) { this._text = String(v); } });
  Object.defineProperty(el, 'innerHTML', { get() { return this._html; }, set(v) { this._html = String(v); this.children = []; } });
  return el;
}
function install() {
  const g = globalThis;
  g.window = g;
  g.document = { createElement: makeEl, getElementById: () => null, body: makeEl('body'), documentElement: makeEl('html'), addEventListener() {} };
  forceGlobal(g, 'navigator', { userAgent: 'headless' });
  g.innerWidth = 1280; g.innerHeight = 720; g.devicePixelRatio = 1;
  g.addEventListener = () => {}; g.removeEventListener = () => {};
  g.requestAnimationFrame = () => 0; g.cancelAnimationFrame = () => {};
  forceGlobal(g, 'performance', { now: () => Date.now() });
  g.AudioContext = undefined;
  g.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  return g;
}
function load(files) {
  for (const f of files) {
    const p = path.join(ROOT, 'js', f);
    vm.runInThisContext(fs.readFileSync(p, 'utf8'), { filename: p });
  }
  return globalThis.G;
}

const ALL = ['core.js', 'art.js', 'levels.js', 'entities.js', 'game.js'];

module.exports = { Raster, Ctx, writePNG, makeEl, install, load, ALL, ROOT, parseColor };
