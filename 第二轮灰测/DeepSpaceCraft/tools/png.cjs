/* PNG 像素统计（零依赖，手写解码）：判断截图是否"真的画出了东西"
   用法：node tools/png.cjs shot.png  */
'use strict';
const fs = require('fs');
const zlib = require('zlib');

function decode(file) {
  const buf = fs.readFileSync(file);
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('不是 PNG');
  let off = 8, w = 0, h = 0, bd = 0, ct = 0, idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.slice(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4); bd = data[8]; ct = data[9];
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  if (bd !== 8 || (ct !== 2 && ct !== 6)) throw new Error('仅支持 8bit RGB/RGBA，got bd=' + bd + ' ct=' + ct);
  const bpp = ct === 6 ? 4 : 3;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * bpp;
  const out = Buffer.alloc(h * stride);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    const line = raw.slice(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    const cur = Buffer.alloc(stride);
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0, b = prev[x], c = x >= bpp ? prev[x - bpp] : 0;
      let v = line[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c); }
      cur[x] = v & 255;
    }
    cur.copy(out, y * stride);
    prev = cur;
  }
  return { w, h, bpp, px: out };
}

function analyse(file) {
  const { w, h, bpp, px } = decode(file);
  const at = (x, y) => { const i = (y * w + x) * bpp; return [px[i], px[i + 1], px[i + 2]]; };
  let sum = 0, black = 0, orange = 0, cyan = 0, white = 0, red = 0, sat = 0;
  const bands = new Array(9).fill(0), bandN = new Array(9).fill(0);
  const hist = {};
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b] = at(x, y);
      const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      sum += l;
      if (l < 8) black++;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      if (mx - mn > 40) sat++;
      if (r > 120 && g > 60 && g < r * 0.86 && b < g * 0.75) orange++;
      if (b > 110 && g > 90 && r < g * 0.8) cyan++;
      if (r > 200 && g > 200 && b > 200) white++;
      if (r > 110 && g < r * 0.45 && b < r * 0.5) red++;
      const bi = Math.min(8, (y / h * 9) | 0);
      bands[bi] += l; bandN[bi]++;
      const key = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5);
      hist[key] = (hist[key] || 0) + 1;
    }
  }
  const n = w * h;
  /* 中央区域细节度（相邻像素差的均值 → 纹理/几何细节） */
  let detail = 0, dn = 0;
  for (let y = (h * 0.3) | 0; y < h * 0.75; y += 2) {
    for (let x = (w * 0.25) | 0; x < w * 0.75; x += 2) {
      const a = at(x, y), b2 = at(x + 2, y), c = at(x, y + 2);
      detail += Math.abs(a[0] - b2[0]) + Math.abs(a[1] - b2[1]) + Math.abs(a[2] - b2[2]) +
        Math.abs(a[0] - c[0]) + Math.abs(a[1] - c[1]) + Math.abs(a[2] - c[2]);
      dn++;
    }
  }
  const colors = Object.keys(hist).length;
  return {
    file: file.replace(/.*[\\/]/, ''), size: w + 'x' + h,
    meanLum: +(sum / n).toFixed(1),
    blackPct: +(black / n * 100).toFixed(1),
    saturatedPct: +(sat / n * 100).toFixed(1),
    orangePct: +(orange / n * 100).toFixed(2),
    cyanPct: +(cyan / n * 100).toFixed(2),
    whitePct: +(white / n * 100).toFixed(2),
    redPct: +(red / n * 100).toFixed(2),
    detail: +(detail / dn / 6).toFixed(1),
    distinctColors: colors,
    bandLum: bands.map((v, i) => +(v / bandN[i]).toFixed(1))
  };
}

for (const f of process.argv.slice(2)) {
  try { console.log(JSON.stringify(analyse(f))); }
  catch (e) { console.log(JSON.stringify({ file: f, error: e.message })); }
}
