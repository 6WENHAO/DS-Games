/* =====================================================================
 * 出图统计：解码 out/*.png，报均值/极值/裁剪比例/色偏
 *   node tools/imgstat.js
 * 本会话模型无图像输入能力，用统计量代替肉眼判断"是否死黑 / 过曝 / 偏色"。
 * ===================================================================== */
'use strict';
const fs = require('fs');
const zlib = require('zlib');
const path = require('path');
const OUT = path.join(__dirname, '..', 'out');

function readPNG(file) {
  const buf = fs.readFileSync(file);
  let p = 8, w = 0, h = 0, bd = 0, ct = 0;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString('ascii', p + 4, p + 8);
    const data = buf.slice(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); bd = data[8]; ct = data[9]; }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  if (bd !== 8 || ct !== 2) throw new Error('仅支持 8 位 RGB');
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * 3 + 1;
  const px = Buffer.alloc(w * h * 3);
  let prev = Buffer.alloc(w * 3);
  for (let y = 0; y < h; y++) {
    const ft = raw[y * stride];
    const line = raw.slice(y * stride + 1, y * stride + stride);
    const cur = Buffer.alloc(w * 3);
    for (let i = 0; i < w * 3; i++) {
      const a = i >= 3 ? cur[i - 3] : 0, b = prev[i], c = i >= 3 ? prev[i - 3] : 0;
      let val = line[i];
      if (ft === 1) val += a;
      else if (ft === 2) val += b;
      else if (ft === 3) val += (a + b) >> 1;
      else if (ft === 4) {
        const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
        val += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
      }
      cur[i] = val & 255;
    }
    cur.copy(px, y * w * 3);
    prev = cur;
  }
  return { w, h, px };
}

const files = fs.readdirSync(OUT).filter(f => f.endsWith('.png')).sort();
console.log('文件'.padEnd(30, '\u3000') + '  尺寸        亮度均值  最暗 最亮  死黑%  过曝%  R:G:B 色偏');
let bad = [];
for (const f of files) {
  let im;
  try { im = readPNG(path.join(OUT, f)); }
  catch (e) { console.log('  ' + f + ' 解码失败: ' + e.message); bad.push(f); continue; }
  const n = im.w * im.h;
  let sum = 0, mn = 255, mx = 0, dark = 0, blown = 0, sr = 0, sg = 0, sb = 0;
  for (let i = 0; i < n; i++) {
    const r = im.px[i * 3], g = im.px[i * 3 + 1], b = im.px[i * 3 + 2];
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    sum += l; sr += r; sg += g; sb += b;
    if (l < mn) mn = l; if (l > mx) mx = l;
    if (l < 3) dark++;
    if (r > 252 && g > 252 && b > 252) blown++;
  }
  const mean = sum / n;
  const pd = dark / n * 100, pb = blown / n * 100;
  const mr = sr / n, mg = sg / n, mb = sb / n;
  const flag = (mean < 12 || mean > 225 || pb > 12 || pd > 55) ? '  ← 可疑' : '';
  if (flag) bad.push(f);
  console.log('  ' + f.padEnd(28, '\u3000') + ' ' + (im.w + '×' + im.h).padEnd(10) +
    mean.toFixed(1).padStart(8) + mn.toFixed(0).padStart(6) + mx.toFixed(0).padStart(5) +
    pd.toFixed(1).padStart(7) + pb.toFixed(1).padStart(7) + '   ' +
    (mr / mg).toFixed(2) + ':1.00:' + (mb / mg).toFixed(2) + flag);
}
console.log('');
if (bad.length) console.log('需人工复核：' + bad.join('、'));
else console.log('全部出图曝光与色彩分布正常（无死黑、无大面积过曝）。');
