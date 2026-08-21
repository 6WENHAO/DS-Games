/* pngstat.js — 零依赖 PNG 解码 + 分块统计，用于无人值守地"看"渲染结果
   用法: node tools/pngstat.js shots/xx.png [gridX gridY] */
const fs = require('fs'), zlib = require('zlib');

function decodePNG(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not png');
  let off = 8, w = 0, h = 0, bitDepth = 8, colorType = 6, idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.slice(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      bitDepth = data[8]; colorType = data[9];
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  if (bitDepth !== 8) throw new Error('bitDepth ' + bitDepth + ' unsupported');
  const ch = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 0 ? 1 : 0;
  if (!ch) throw new Error('colorType ' + colorType + ' unsupported');
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * ch;
  const out = Buffer.alloc(h * stride);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const ft = raw[y * (stride + 1)];
    const line = raw.slice(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    const cur = Buffer.alloc(stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? cur[x - ch] : 0, b = prev[x], c = x >= ch ? prev[x - ch] : 0;
      let v = line[x];
      if (ft === 1) v += a; else if (ft === 2) v += b;
      else if (ft === 3) v += (a + b) >> 1;
      else if (ft === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
      }
      cur[x] = v & 255;
    }
    cur.copy(out, y * stride); prev = cur;
  }
  return { w, h, ch, data: out };
}

function stats(img, gx, gy) {
  const { w, h, ch, data } = img;
  const tiles = [];
  for (let ty = 0; ty < gy; ty++) {
    const row = [];
    for (let tx = 0; tx < gx; tx++) {
      const x0 = Math.floor(tx * w / gx), x1 = Math.floor((tx + 1) * w / gx);
      const y0 = Math.floor(ty * h / gy), y1 = Math.floor((ty + 1) * h / gy);
      let r = 0, g = 0, b = 0, n = 0, l2 = 0, l1 = 0;
      for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) {
        const i = y * w * ch + x * ch;
        const R = data[i], G = data[i + 1], B = data[i + 2];
        r += R; g += G; b += B; n++;
        const L = 0.299 * R + 0.587 * G + 0.114 * B;
        l1 += L; l2 += L * L;
      }
      const mr = r / n, mg = g / n, mb = b / n, ml = l1 / n;
      row.push({ r: mr, g: mg, b: mb, l: ml, sd: Math.sqrt(Math.max(0, l2 / n - ml * ml)) });
    }
    tiles.push(row);
  }
  return tiles;
}

const file = process.argv[2];
const gx = parseInt(process.argv[3] || '6'), gy = parseInt(process.argv[4] || '4');
const img = decodePNG(fs.readFileSync(file));
const t = stats(img, gx, gy);
let all = { r: 0, g: 0, b: 0, l: 0, sd: 0, n: 0 }, minL = 999, maxL = -1;
console.log(file + '  ' + img.w + 'x' + img.h + ' ch=' + img.ch);
console.log('tile grid ' + gx + 'x' + gy + '  [ R G B | L sd ]');
t.forEach((row, y) => {
  console.log('  y' + y + ': ' + row.map(c =>
    ('' + Math.round(c.r)).padStart(3) + ',' + ('' + Math.round(c.g)).padStart(3) + ',' + ('' + Math.round(c.b)).padStart(3) +
    '|' + ('' + Math.round(c.l)).padStart(3) + ' σ' + ('' + Math.round(c.sd)).padStart(2)).join('  '));
  row.forEach(c => { all.r += c.r; all.g += c.g; all.b += c.b; all.l += c.l; all.sd += c.sd; all.n++; minL = Math.min(minL, c.l); maxL = Math.max(maxL, c.l); });
});
const n = all.n;
console.log('MEAN rgb=' + [all.r / n, all.g / n, all.b / n].map(v => Math.round(v)).join(',') +
  '  L=' + (all.l / n).toFixed(1) + '  meanTileSigma=' + (all.sd / n).toFixed(1) +
  '  Lrange=' + minL.toFixed(0) + '..' + maxL.toFixed(0));
const flat = (all.sd / n) < 2 && (maxL - minL) < 6;
console.log('VERDICT: ' + (flat ? 'FLAT/EMPTY (渲染可能失败)' : 'has structure'));
