/* 两张截图的像素差分：用来验证"撞击真的改变了这颗星球的外观"
 * 用法: node test/png-diff.js a.png b.png [宽] [高]
 * 输出：差异像素占比、差异质心与包围盒、差异强度 ASCII 图 */
const fs = require('fs');
const zlib = require('zlib');

function decodePNG(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('不是 PNG');
  let off = 8, ihdr = null;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') ihdr = { w: data.readUInt32BE(0), h: data.readUInt32BE(4), depth: data[8], color: data[9], interlace: data[12] };
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  const ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ihdr.color];
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = ihdr.w * ch;
  const out = Buffer.alloc(stride * ihdr.h);
  let p = 0;
  for (let y = 0; y < ihdr.h; y++) {
    const ft = raw[p++];
    const row = raw.subarray(p, p + stride); p += stride;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? cur[x - ch] : 0;
      const b = prev ? prev[x] : 0;
      const c = prev && x >= ch ? prev[x - ch] : 0;
      let v = row[x];
      if (ft === 1) v += a; else if (ft === 2) v += b;
      else if (ft === 3) v += (a + b) >> 1;
      else if (ft === 4) {
        const pp = a + b - c;
        const pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
      }
      cur[x] = v & 255;
    }
  }
  return { w: ihdr.w, h: ihdr.h, ch, data: out };
}

const A = decodePNG(fs.readFileSync(process.argv[2]));
const B = decodePNG(fs.readFileSync(process.argv[3]));
const CW = parseInt(process.argv[4] || '78', 10);
const CH = parseInt(process.argv[5] || '26', 10);
if (A.w !== B.w || A.h !== B.h) throw new Error('尺寸不同');
const w = A.w, h = A.h;
const get = (img, x, y) => {
  const i = (y * w + x) * img.ch;
  return img.ch === 1 ? [img.data[i], img.data[i], img.data[i]]
    : [img.data[i], img.data[i + 1], img.data[i + 2]];
};

let diffN = 0, sum = 0, cx = 0, cy = 0, maxD = 0;
let bx0 = 1e9, bx1 = -1, by0 = 1e9, by1 = -1;
const THRESH = 10;
const grid = [];
for (let gy = 0; gy < CH; gy++) grid.push(new Array(CW).fill(0));
for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
    const a = get(A, x, y), b = get(B, x, y);
    const d = Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
    if (d > maxD) maxD = d;
    sum += d;
    if (d > THRESH) {
      diffN++; cx += x; cy += y;
      if (x < bx0) bx0 = x; if (x > bx1) bx1 = x;
      if (y < by0) by0 = y; if (y > by1) by1 = y;
    }
    const gx = Math.min(CW - 1, Math.floor(x * CW / w));
    const gy = Math.min(CH - 1, Math.floor(y * CH / h));
    grid[gy][gx] = Math.max(grid[gy][gx], d);
  }
}
const tot = w * h;
console.log('尺寸 ' + w + 'x' + h);
console.log('差异像素(>' + THRESH + '/765): ' + diffN + ' = ' + (diffN / tot * 100).toFixed(2) + '%');
console.log('平均差异 ' + (sum / tot).toFixed(2) + '/765   最大差异 ' + maxD);
if (diffN) {
  console.log('差异质心 (' + (cx / diffN / w).toFixed(3) + ', ' + (cy / diffN / h).toFixed(3) + ')' +
    '  包围盒 x ' + bx0 + '–' + bx1 + ' y ' + by0 + '–' + by1 +
    ' (' + (bx1 - bx0 + 1) + 'x' + (by1 - by0 + 1) + 'px)');
}
const RAMP = ' .:-=+*#%@';
console.log('\n--- 差异强度图 ---');
grid.forEach((row, i) => {
  console.log(String(i).padStart(2) + '|' + row.map((d) =>
    RAMP[Math.min(9, Math.floor(Math.pow(Math.min(d / 160, 1), 0.5) * 10))]).join('') + '|');
});
