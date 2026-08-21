/* ===================================================================
   tools/pngstat.js —— 极简 PNG 解码 + 统计 + ASCII 预览
   用途：在无法直接看图的环境里，把截图变成可读文本来验证渲染结果。
   用法： node tools/pngstat.js shots/shot1.png [宽=100]
   =================================================================== */
'use strict';
const fs = require('fs');
const zlib = require('zlib');

function decodePNG(buf) {
  if (buf.readUInt32BE(0) !== 0x89504E47) throw new Error('不是 PNG');
  let off = 8, w = 0, h = 0, bitDepth = 8, colorType = 6, interlace = 0;
  const idat = [];
  let plte = null, trns = null;
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.slice(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      bitDepth = data[8]; colorType = data[9]; interlace = data[12];
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'PLTE') plte = data;
    else if (type === 'tRNS') trns = data;
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  if (interlace) throw new Error('不支持隔行 PNG');
  if (bitDepth !== 8) throw new Error('只支持 8 位深，当前 ' + bitDepth);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const chan = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 3 ? 1 : colorType === 4 ? 2 : 1;
  const stride = w * chan;
  const out = Buffer.alloc(w * h * 4);
  let prev = Buffer.alloc(stride);
  let p = 0;
  for (let y = 0; y < h; y++) {
    const filter = raw[p++];
    const line = Buffer.from(raw.slice(p, p + stride)); p += stride;
    for (let i = 0; i < stride; i++) {
      const a = i >= chan ? line[i - chan] : 0;
      const b = prev[i];
      const c = i >= chan ? prev[i - chan] : 0;
      let v = line[i];
      switch (filter) {
        case 1: v += a; break;
        case 2: v += b; break;
        case 3: v += (a + b) >> 1; break;
        case 4: {
          const pp = a + b - c;
          const pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
          v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
          break;
        }
      }
      line[i] = v & 255;
    }
    prev = line;
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      if (chan === 4) { out[o] = line[x * 4]; out[o + 1] = line[x * 4 + 1]; out[o + 2] = line[x * 4 + 2]; out[o + 3] = line[x * 4 + 3]; }
      else if (chan === 3) { out[o] = line[x * 3]; out[o + 1] = line[x * 3 + 1]; out[o + 2] = line[x * 3 + 2]; out[o + 3] = 255; }
      else if (chan === 1 && plte) {
        const idx = line[x] * 3;
        out[o] = plte[idx]; out[o + 1] = plte[idx + 1]; out[o + 2] = plte[idx + 2]; out[o + 3] = 255;
      } else { out[o] = out[o + 1] = out[o + 2] = line[x * chan]; out[o + 3] = 255; }
    }
  }
  return { w, h, data: out };
}

const file = process.argv[2];
const cols = parseInt(process.argv[3] || '100', 10);
const img = decodePNG(fs.readFileSync(file));
const { w, h, data } = img;

/* ---------- 统计 ---------- */
let sr = 0, sg = 0, sb = 0, nBlack = 0, nBright = 0, nRed = 0, nWarm = 0;
const uniq = new Set();
const hist = new Array(16).fill(0);
for (let i = 0; i < w * h; i++) {
  const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
  sr += r; sg += g; sb += b;
  const lum = (r * 299 + g * 587 + b * 114) / 1000;
  hist[Math.min(15, (lum / 16) | 0)]++;
  if (lum < 8) nBlack++;
  if (lum > 150) nBright++;
  if (r > 60 && r > g * 1.6 && r > b * 1.6) nRed++;
  if (r > 100 && g > 60 && b < g) nWarm++;
  if (uniq.size < 60000) uniq.add((r >> 2) << 12 | (g >> 2) << 6 | (b >> 2));
}
const N = w * h;
console.log('文件: ' + file);
console.log('尺寸: ' + w + 'x' + h + '   像素: ' + N);
console.log('平均 RGB: ' + (sr / N).toFixed(1) + ', ' + (sg / N).toFixed(1) + ', ' + (sb / N).toFixed(1));
console.log('纯黑占比: ' + (nBlack / N * 100).toFixed(1) + '%   高亮占比: ' + (nBright / N * 100).toFixed(1) + '%');
console.log('偏红像素(血/火): ' + (nRed / N * 100).toFixed(2) + '%   暖色像素(火光): ' + (nWarm / N * 100).toFixed(2) + '%');
console.log('不同颜色数(6bit量化): ' + uniq.size);
console.log('亮度直方图: ' + hist.map((v, i) => (v / N * 100).toFixed(1)).join(' '));

/* ---------- ASCII 预览 ---------- */
const CH = ' .:-=+*#%@';
const rows = Math.max(8, Math.round(cols * (h / w) * 0.47));
let art = '';
for (let ry = 0; ry < rows; ry++) {
  let line = '';
  for (let rx = 0; rx < cols; rx++) {
    const x0 = Math.floor(rx * w / cols), x1 = Math.max(x0 + 1, Math.floor((rx + 1) * w / cols));
    const y0 = Math.floor(ry * h / rows), y1 = Math.max(y0 + 1, Math.floor((ry + 1) * h / rows));
    let l = 0, rr = 0, gg = 0, bb = 0, n = 0;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const i = (y * w + x) * 4;
      rr += data[i]; gg += data[i + 1]; bb += data[i + 2];
      l += (data[i] * 299 + data[i + 1] * 587 + data[i + 2] * 114) / 1000;
      n++;
    }
    l /= n; rr /= n; gg /= n; bb /= n;
    let ch = CH[Math.min(9, Math.max(0, Math.round(Math.pow(l / 255, 0.65) * 9)))];
    // 明显偏红的区域用 R 标出，暖色用 o
    if (rr > 45 && rr > gg * 1.7 && rr > bb * 1.7) ch = l > 90 ? 'R' : 'r';
    else if (rr > 110 && gg > 70 && bb < gg * 0.8) ch = 'o';
    line += ch;
  }
  art += line + '\n';
}
console.log('\nASCII 预览（R/r=红 血光, o=暖光/火焰, @=最亮）:');
console.log(art);
