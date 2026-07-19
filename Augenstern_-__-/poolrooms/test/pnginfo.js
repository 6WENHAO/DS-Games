/* 最小 PNG 解码 + 画面统计:均值/过曝比例/分区亮度/ASCII 预览 */
'use strict';
const fs = require('fs'), zlib = require('zlib');
const file = process.argv[2];
const buf = fs.readFileSync(file);
let off = 8, w, h, bitDepth, colorType, interlace;
const idat = [];
while (off < buf.length) {
  const len = buf.readUInt32BE(off);
  const type = buf.toString('ascii', off + 4, off + 8);
  const data = buf.slice(off + 8, off + 8 + len);
  if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); bitDepth = data[8]; colorType = data[9]; interlace = data[12]; }
  else if (type === 'IDAT') idat.push(data);
  else if (type === 'IEND') break;
  off += 12 + len;
}
if (bitDepth !== 8 || interlace !== 0) { console.log('unsupported png', bitDepth, interlace); process.exit(1); }
const ch = colorType === 6 ? 4 : (colorType === 2 ? 3 : 1);
const raw = zlib.inflateSync(Buffer.concat(idat));
const stride = w * ch;
const out = Buffer.alloc(h * stride);
let p = 0;
for (let y = 0; y < h; y++) {
  const f = raw[p++]; const row = y * stride; const prev = row - stride;
  for (let x = 0; x < stride; x++) {
    const rb = raw[p++];
    const a = x >= ch ? out[row + x - ch] : 0;
    const b = y > 0 ? out[prev + x] : 0;
    const c = (x >= ch && y > 0) ? out[prev + x - ch] : 0;
    let v;
    switch (f) {
      case 0: v = rb; break;
      case 1: v = rb + a; break;
      case 2: v = rb + b; break;
      case 3: v = rb + ((a + b) >> 1); break;
      case 4: { const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c); const pr = (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c); v = rb + pr; break; }
      default: v = rb;
    }
    out[row + x] = v & 255;
  }
}
const px = (x, y) => { const o = y * stride + x * ch; return [out[o], out[o + 1], out[o + 2]]; };
let sr = 0, sg = 0, sb = 0, over = 0, under = 0, n = 0;
for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) {
  const [r, g, b] = px(x, y);
  const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  sr += r; sg += g; sb += b; n++;
  if (l > 240) over++;
  if (l < 16) under++;
}
console.log('size', w + 'x' + h, 'colorType', colorType);
console.log('mean RGB', (sr / n).toFixed(0), (sg / n).toFixed(0), (sb / n).toFixed(0));
console.log('over(>240):', (over / n * 100).toFixed(1) + '%', ' under(<16):', (under / n * 100).toFixed(1) + '%');
const bands = [[0, '顶 '], [1, '中 '], [2, '底 ']];
for (const [bi, nm] of bands) {
  let r2 = 0, g2 = 0, b2 = 0, m = 0;
  for (let y = Math.floor(h * bi / 3); y < Math.floor(h * (bi + 1) / 3); y += 2)
    for (let x = 0; x < w; x += 4) { const c = px(x, y); r2 += c[0]; g2 += c[1]; b2 += c[2]; m++; }
  console.log(nm + 'band RGB', (r2 / m).toFixed(0), (g2 / m).toFixed(0), (b2 / m).toFixed(0));
}
console.log('中心像素', px(w >> 1, h >> 1).join(','), ' 左上(10,10)', px(10, 10).join(','), ' 右下', px(w - 10, h - 10).join(','));
const ramp = ' .:-=+*#%@';
const CW = 64, CH = 28;
let art = '';
for (let cy = 0; cy < CH; cy++) {
  let line = '';
  for (let cx = 0; cx < CW; cx++) {
    let r3 = 0, g3 = 0, b3 = 0, m3 = 0;
    const x0 = Math.floor(cx * w / CW), x1 = Math.floor((cx + 1) * w / CW);
    const y0 = Math.floor(cy * h / CH), y1 = Math.floor((cy + 1) * h / CH);
    for (let y = y0; y < y1; y += 3) for (let x = x0; x < x1; x += 3) { const c = px(x, y); r3 += c[0]; g3 += c[1]; b3 += c[2]; m3++; }
    const l = (0.2126 * r3 + 0.7152 * g3 + 0.0722 * b3) / m3;
    line += ramp[Math.min(9, Math.floor(l / 25.6))];
  }
  art += line + '\n';
}
console.log(art);
