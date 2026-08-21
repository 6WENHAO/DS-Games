/* ==========================================================================
 * tests/raster.js — a tiny Canvas2D-compatible software rasteriser plus a PNG
 * writer, so the browser renderer can be exercised and inspected offline.
 * ==========================================================================*/
'use strict';
const fs = require('fs');
const zlib = require('zlib');

/* ------------------------------------------------------------ PNG output */
let CRC_TABLE = null;
function crc32(buf) {
  if (!CRC_TABLE) {
    CRC_TABLE = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[n] = c;
    }
  }
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}
function writePNG(file, w, h, rgb) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    Buffer.from(rgb.buffer, y * w * 3, w * 3).copy(raw, y * (w * 3 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  fs.writeFileSync(file, Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 6 })),
    chunk('IEND', Buffer.alloc(0))
  ]));
}

/* --------------------------------------------------------- colour parsing */
function parseColor(s) {
  if (typeof s !== 'string') return [255, 0, 255, 1];
  let m = /^rgba?\(([-\d.]+),\s*([-\d.]+),\s*([-\d.]+)(?:,\s*([-\d.]+))?\)$/.exec(s);
  if (m) return [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]];
  if (s[0] === '#') {
    let h = s.slice(1);
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 1];
  }
  return [255, 255, 255, 1];
}

class Grad {
  constructor(kind, a) { this.kind = kind; this.a = a; this.stops = []; }
  addColorStop(t, c) { this.stops.push([t, parseColor(c)]); this.stops.sort((x, y) => x[0] - y[0]); }
  at(x, y) {
    let t;
    if (this.kind === 'linear') {
      const [x0, y0, x1, y1] = this.a;
      const dx = x1 - x0, dy = y1 - y0;
      const len2 = dx * dx + dy * dy || 1;
      t = ((x - x0) * dx + (y - y0) * dy) / len2;
    } else {
      const [x0, y0, r0, x1, y1, r1] = this.a;
      const d = Math.hypot(x - x1, y - y1);
      t = (d - r0) / Math.max(1e-6, r1 - r0);
    }
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const st = this.stops;
    if (!st.length) return [255, 0, 255, 1];
    if (t <= st[0][0]) return st[0][1];
    for (let i = 1; i < st.length; i++) {
      if (t <= st[i][0]) {
        const a = st[i - 1], b = st[i];
        const f = (t - a[0]) / Math.max(1e-6, b[0] - a[0]);
        return [
          a[1][0] + (b[1][0] - a[1][0]) * f, a[1][1] + (b[1][1] - a[1][1]) * f,
          a[1][2] + (b[1][2] - a[1][2]) * f, a[1][3] + (b[1][3] - a[1][3]) * f
        ];
      }
    }
    return st[st.length - 1][1];
  }
}

/* ------------------------------------------------------------ the context */
class Ctx2D {
  constructor(w, h) {
    this.W = w; this.H = h;
    this.buf = new Uint8Array(w * h * 3);
    this.buf.fill(10);
    this.m = [1, 0, 0, 1, 0, 0];
    this.stack = [];
    this.path = [];
    this.cur = null;
    this.fillStyle = '#fff';
    this.strokeStyle = '#fff';
    this.lineWidth = 1;
    this.globalAlpha = 1;
    this.font = ''; this.textAlign = 'left';
    this.lineJoin = 'round'; this.shadowBlur = 0; this.shadowColor = '';
    this.texts = 0;
    this.canvas = { width: w, height: h, style: {} };
  }
  /* --- transforms --- */
  setTransform(a, b, c, d, e, f) { this.m = [a, b, c, d, e, f]; }
  save() { this.stack.push(this.m.slice()); }
  restore() { if (this.stack.length) this.m = this.stack.pop(); }
  translate(x, y) {
    const m = this.m;
    m[4] += m[0] * x + m[2] * y;
    m[5] += m[1] * x + m[3] * y;
  }
  rotate(a) {
    const m = this.m, c = Math.cos(a), s = Math.sin(a);
    const m0 = m[0] * c + m[2] * s, m1 = m[1] * c + m[3] * s;
    const m2 = m[0] * -s + m[2] * c, m3 = m[1] * -s + m[3] * c;
    m[0] = m0; m[1] = m1; m[2] = m2; m[3] = m3;
  }
  scale(x, y) { const m = this.m; m[0] *= x; m[1] *= x; m[2] *= y; m[3] *= y; }
  tp(x, y) {
    const m = this.m;
    return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
  }
  /* --- paths --- */
  beginPath() { this.path = []; this.cur = null; }
  moveTo(x, y) { this.cur = [this.tp(x, y)]; this.path.push(this.cur); }
  lineTo(x, y) { if (!this.cur) return this.moveTo(x, y); this.cur.push(this.tp(x, y)); }
  closePath() { if (this.cur && this.cur.length) this.cur.push(this.cur[0].slice()); }
  rect(x, y, w, h) {
    this.moveTo(x, y); this.lineTo(x + w, y); this.lineTo(x + w, y + h); this.lineTo(x, y + h); this.closePath();
  }
  arc(cx, cy, r, a0, a1, ccw) {
    const seg = Math.max(8, Math.min(64, Math.ceil(r)));
    let span = a1 - a0;
    if (ccw) { if (span > 0) span -= Math.PI * 2; } else if (span < 0) span += Math.PI * 2;
    const pts = [];
    for (let i = 0; i <= seg; i++) {
      const a = a0 + span * (i / seg);
      pts.push(this.tp(cx + Math.cos(a) * r, cy + Math.sin(a) * r));
    }
    if (!this.cur || !this.cur.length) { this.cur = pts; this.path.push(this.cur); }
    else this.cur = (this.path[this.path.length - 1] = this.cur.concat(pts));
  }
  arcTo(x1, y1, x2, y2) { this.lineTo(x1, y1); this.lineTo(x2, y2); }
  createLinearGradient(x0, y0, x1, y1) {
    const a = this.tp(x0, y0), b = this.tp(x1, y1);
    return new Grad('linear', [a[0], a[1], b[0], b[1]]);
  }
  createRadialGradient(x0, y0, r0, x1, y1, r1) {
    const a = this.tp(x0, y0), b = this.tp(x1, y1);
    const s = Math.hypot(this.m[0], this.m[1]) || 1;
    return new Grad('radial', [a[0], a[1], r0 * s, b[0], b[1], r1 * s]);
  }
  measureText(t) { return { width: (t || '').length * 6 }; }
  fillText() { this.texts++; }
  strokeText() { this.texts++; }
  /* --- painting --- */
  _style(st) { return st instanceof Grad ? st : parseColor(st); }
  _px(x, y, col, alpha) {
    if (x < 0 || y < 0 || x >= this.W || y >= this.H) return;
    const a = alpha * (col[3] === undefined ? 1 : col[3]);
    if (a <= 0.002) return;
    const i = (y * this.W + x) * 3, b = this.buf;
    if (a >= 0.999) { b[i] = col[0]; b[i + 1] = col[1]; b[i + 2] = col[2]; return; }
    b[i] += (col[0] - b[i]) * a;
    b[i + 1] += (col[1] - b[i + 1]) * a;
    b[i + 2] += (col[2] - b[i + 2]) * a;
  }
  _fillPath(subs, style) {
    const st = this._style(style);
    let y0 = 1e9, y1 = -1e9;
    for (const s of subs) for (const p of s) { if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
    y0 = Math.max(0, Math.floor(y0)); y1 = Math.min(this.H - 1, Math.ceil(y1));
    const xs = [];
    for (let y = y0; y <= y1; y++) {
      const yc = y + 0.5;
      xs.length = 0;
      for (const s of subs) {
        for (let i = 0; i < s.length; i++) {
          const a = s[i], b = s[(i + 1) % s.length];
          if ((a[1] <= yc && b[1] > yc) || (b[1] <= yc && a[1] > yc)) {
            xs.push(a[0] + (yc - a[1]) / (b[1] - a[1]) * (b[0] - a[0]));
          }
        }
      }
      if (xs.length < 2) continue;
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const xa = Math.max(0, Math.round(xs[k])), xb = Math.min(this.W - 1, Math.round(xs[k + 1]) - 1);
        for (let x = xa; x <= xb; x++) {
          this._px(x, y, st instanceof Grad ? st.at(x + 0.5, yc) : st, this.globalAlpha);
        }
      }
    }
  }
  fill() { if (this.path.length) this._fillPath(this.path, this.fillStyle); }
  fillRect(x, y, w, h) {
    const p = [this.tp(x, y), this.tp(x + w, y), this.tp(x + w, y + h), this.tp(x, y + h)];
    this._fillPath([p], this.fillStyle);
  }
  stroke() {
    const lw = Math.max(0.6, this.lineWidth * Math.hypot(this.m[0], this.m[1]));
    for (const s of this.path) {
      for (let i = 0; i + 1 < s.length; i++) {
        const a = s[i], b = s[i + 1];
        const dx = b[0] - a[0], dy = b[1] - a[1];
        const len = Math.hypot(dx, dy) || 1e-6;
        const nx = -dy / len * lw / 2, ny = dx / len * lw / 2;
        this._fillPath([[
          [a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny],
          [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny]
        ]], this.strokeStyle);
      }
    }
  }
  strokeRect(x, y, w, h) {
    this.beginPath(); this.rect(x, y, w, h); this.closePath(); this.stroke();
  }
  clip() { }
}


module.exports = { Ctx2D, Grad, writePNG, parseColor };

