/* =============================================================================
   tools/png.js - dependency-free PNG reader + text preview, so a screenshot can
   be inspected from the console: overall statistics, a luminance map and a
   hue map. Handy for verifying renders without an image viewer.

   Usage:  node tools/png.js shots/test.png [cols] [rows]
   ========================================================================== */
'use strict';
const fs = require('fs');
const zlib = require('zlib');

function decodePNG(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let off = 8, ihdr = null, idat = [], plte = null, trns = null;
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.slice(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      ihdr = {
        w: data.readUInt32BE(0), h: data.readUInt32BE(4),
        depth: data[8], color: data[9], comp: data[10], filter: data[11], interlace: data[12]
      };
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'PLTE') plte = data;
    else if (type === 'tRNS') trns = data;
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  if (!ihdr) throw new Error('no IHDR');
  if (ihdr.interlace) throw new Error('interlaced PNG not supported');
  if (ihdr.depth !== 8) throw new Error('only 8-bit PNGs supported (got ' + ihdr.depth + ')');
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ihdr.color];
  if (!channels) throw new Error('unsupported colour type ' + ihdr.color);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = channels;
  const stride = ihdr.w * bpp;
  const out = Buffer.alloc(ihdr.h * stride);
  let pos = 0;
  for (let y = 0; y < ihdr.h; y++) {
    const ft = raw[pos++];
    const row = raw.slice(pos, pos + stride); pos += stride;
    const cur = out.slice(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.slice((y - 1) * stride, y * stride) : Buffer.alloc(stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0;
      const b = prev[x];
      const c = x >= bpp ? prev[x - bpp] : 0;
      let v = row[x];
      switch (ft) {
        case 0: break;
        case 1: v = v + a; break;
        case 2: v = v + b; break;
        case 3: v = v + ((a + b) >> 1); break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
          v = v + (pa <= pb && pa <= pc ? a : (pb <= pc ? b : c));
          break;
        }
        default: throw new Error('bad filter ' + ft);
      }
      cur[x] = v & 255;
    }
  }
  /* expand to RGB */
  const rgb = new Uint8Array(ihdr.w * ihdr.h * 3);
  for (let i = 0, n = ihdr.w * ihdr.h; i < n; i++) {
    let r, g, b;
    if (ihdr.color === 0 || ihdr.color === 4) { r = g = b = out[i * bpp]; }
    else if (ihdr.color === 3) {
      const idx = out[i * bpp] * 3;
      r = plte[idx]; g = plte[idx + 1]; b = plte[idx + 2];
    } else { r = out[i * bpp]; g = out[i * bpp + 1]; b = out[i * bpp + 2]; }
    rgb[i * 3] = r; rgb[i * 3 + 1] = g; rgb[i * 3 + 2] = b;
  }
  return { w: ihdr.w, h: ihdr.h, rgb };
}

const RAMP = ' .:-=+*oO#@';
function hueChar(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), v = mx / 255, sat = mx ? (mx - mn) / mx : 0;
  if (v < 0.10) return '.';                       /* near black          */
  if (sat < 0.10) return v > 0.75 ? 'W' : (v > 0.35 ? 'g' : 'k');  /* greys */
  if (b >= r && b >= g) return v > 0.6 ? 'B' : 'b';                /* blue  */
  if (g >= r && g >= b) return v > 0.5 ? 'G' : 'v';                /* green */
  if (r > g && g > b) return (g > r * 0.72) ? 'y' : 'n';           /* yellow/brown */
  return 'r';
}

function preview(img, cols, rows) {
  const { w, h, rgb } = img;
  const cw = w / cols, ch = h / rows;
  const lum = [], hue = [];
  for (let ry = 0; ry < rows; ry++) {
    let lrow = '', hrow = '';
    for (let rx = 0; rx < cols; rx++) {
      let sr = 0, sg = 0, sb = 0, n = 0;
      const x0 = Math.floor(rx * cw), x1 = Math.max(x0 + 1, Math.floor((rx + 1) * cw));
      const y0 = Math.floor(ry * ch), y1 = Math.max(y0 + 1, Math.floor((ry + 1) * ch));
      for (let y = y0; y < y1 && y < h; y += 2) {
        for (let x = x0; x < x1 && x < w; x += 2) {
          const i = (y * w + x) * 3;
          sr += rgb[i]; sg += rgb[i + 1]; sb += rgb[i + 2]; n++;
        }
      }
      const r = sr / n, g = sg / n, b = sb / n;
      const l = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      lrow += RAMP[Math.min(RAMP.length - 1, Math.floor(l * RAMP.length))];
      hrow += hueChar(r, g, b);
    }
    lum.push(lrow); hue.push(hrow);
  }
  return { lum, hue };
}

function stats(img) {
  const { w, h, rgb } = img;
  let sr = 0, sg = 0, sb = 0, n = 0, mn = 255, mx = 0;
  const colours = new Set();
  for (let i = 0; i < w * h; i += 7) {
    const r = rgb[i * 3], g = rgb[i * 3 + 1], b = rgb[i * 3 + 2];
    sr += r; sg += g; sb += b; n++;
    const l = 0.299 * r + 0.587 * g + 0.114 * b;
    if (l < mn) mn = l; if (l > mx) mx = l;
    if (colours.size < 60000) colours.add((r >> 3) << 10 | (g >> 3) << 5 | (b >> 3));
  }
  return {
    mean: [sr / n, sg / n, sb / n].map(v => Math.round(v)),
    minLum: Math.round(mn), maxLum: Math.round(mx), colours: colours.size
  };
}

const file = process.argv[2] || 'shots/test.png';
const cols = parseInt(process.argv[3], 10) || 104;
const rows = parseInt(process.argv[4], 10) || 40;
const img = decodePNG(fs.readFileSync(file));
const st = stats(img);
console.log(file + '  ' + img.w + 'x' + img.h +
  '  mean rgb=' + st.mean.join(',') + '  lum ' + st.minLum + '..' + st.maxLum +
  '  distinct colours(5bit)=' + st.colours);
const pv = preview(img, cols, rows);
console.log('\n-- luminance ' + '-'.repeat(cols - 13));
pv.lum.forEach(r => console.log(r));
console.log('\n-- hue (B/b blue  G/v green  y/n yellow-brown  r red  W/g/k grey  . black) ' + '-'.repeat(Math.max(0, cols - 74)));
pv.hue.forEach(r => console.log(r));
