/* PNG → 文本视图：无图像能力时用来“看”渲染结果
 * 用法: node test/png-view.js <png> [宽] [高]
 * 输出：尺寸、总体亮度、亮度 ASCII 图、主色相图、若干采样点 RGB */
const fs = require('fs');
const zlib = require('zlib');

function decodePNG(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('不是 PNG');
  let off = 8, ihdr = null;
  const idat = [];
  let plte = null, trns = null;
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      ihdr = {
        w: data.readUInt32BE(0), h: data.readUInt32BE(4),
        depth: data[8], color: data[9], interlace: data[12],
      };
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'PLTE') plte = data;
    else if (type === 'tRNS') trns = data;
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  if (!ihdr) throw new Error('缺少 IHDR');
  if (ihdr.depth !== 8) throw new Error('仅支持 8bit，实际 ' + ihdr.depth);
  if (ihdr.interlace) throw new Error('不支持隔行');
  const ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ihdr.color];
  if (!ch) throw new Error('不支持的颜色类型 ' + ihdr.color);
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
      if (ft === 1) v += a;
      else if (ft === 2) v += b;
      else if (ft === 3) v += (a + b) >> 1;
      else if (ft === 4) {
        const pp = a + b - c;
        const pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c);
        v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
      }
      cur[x] = v & 255;
    }
  }
  return { w: ihdr.w, h: ihdr.h, ch, data: out, plte };
}

const file = process.argv[2];
const CW = parseInt(process.argv[3] || '92', 10);
const CH = parseInt(process.argv[4] || '40', 10);
const img = decodePNG(fs.readFileSync(file));
const { w, h, data } = img; const ch2 = img.ch;

function px(x, y) {
  const i = (y * w + x) * ch2;
  if (ch2 === 1) return [data[i], data[i], data[i]];
  return [data[i], data[i + 1], data[i + 2]];
}

const RAMP = ' .:-=+*#%@';
const LOG = process.argv.includes('--log');
// 对数亮度映射：把 1e-4 ~ 1 映射到 0 ~ 10 级，便于看清暗部结构
function ch(L) {
  let t;
  if (LOG) t = (Math.log10(Math.max(L, 1e-5)) + 5) / 5;
  else t = Math.pow(L, 0.55);
  return RAMP[Math.min(RAMP.length - 1, Math.max(0, Math.floor(t * RAMP.length)))];
}
let lumRows = [], hueRows = [], total = 0, maxL = 0;
const hist = new Array(12).fill(0);
let bbox = null;
for (let cy = 0; cy < CH; cy++) {
  let lr = '', hr = '';
  for (let cx = 0; cx < CW; cx++) {
    const x0 = Math.floor(cx * w / CW), x1 = Math.max(x0 + 1, Math.floor((cx + 1) * w / CW));
    const y0 = Math.floor(cy * h / CH), y1 = Math.max(y0 + 1, Math.floor((cy + 1) * h / CH));
    let r = 0, g = 0, b = 0, n = 0;
    for (let y = y0; y < y1; y += Math.max(1, Math.floor((y1 - y0) / 4)))
      for (let x = x0; x < x1; x += Math.max(1, Math.floor((x1 - x0) / 4))) {
        const c = px(x, y); r += c[0]; g += c[1]; b += c[2]; n++;
      }
    r /= n; g /= n; b /= n;
    const L = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    total += L; maxL = Math.max(maxL, L);
    hist[Math.min(11, Math.max(0, Math.floor((Math.log10(Math.max(L, 1e-5)) + 5) / 5 * 11)))]++;
    if (L > 0.012) {
      if (!bbox) bbox = { x0: cx, x1: cx, y0: cy, y1: cy };
      bbox.x0 = Math.min(bbox.x0, cx); bbox.x1 = Math.max(bbox.x1, cx);
      bbox.y0 = Math.min(bbox.y0, cy); bbox.y1 = Math.max(bbox.y1, cy);
    }
    lr += ch(L);
    // 主色相
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const sat = mx > 4 ? (mx - mn) / mx : 0;
    let c = '.';
    if (L < 0.012) c = ' ';
    else if (sat < 0.16) c = L > 0.55 ? 'W' : (L > 0.14 ? 'w' : '.');
    else if (r >= g && r >= b) c = (g > b * 1.35) ? 'Y' : (b > g * 1.3 ? 'M' : 'R');
    else if (g >= r && g >= b) c = (b > r * 1.3) ? 'C' : 'G';
    else c = (r > g * 1.3) ? 'M' : (g > r * 1.25 ? 'C' : 'B');
    hr += c;
  }
  lumRows.push(lr); hueRows.push(hr);
}

console.log('尺寸 ' + w + 'x' + h + '  通道 ' + ch2 +
  '  平均亮度 ' + (total / (CW * CH)).toFixed(4) + '  峰值格亮度 ' + maxL.toFixed(3) +
  (LOG ? '  [对数映射 1e-5..1]' : '  [gamma 0.55]'));
console.log('亮度直方图(对数分箱 1e-5→1): ' + hist.join(' '));
if (bbox) {
  console.log('可见内容包围盒: x ' + bbox.x0 + '–' + bbox.x1 + ' / ' + CW +
    ', y ' + bbox.y0 + '–' + bbox.y1 + ' / ' + CH);
}
console.log('\n--- 亮度图（" .:-=+*#%@" 由暗到亮）---');
lumRows.forEach((r, i) => console.log(String(i).padStart(2, ' ') + '|' + r + '|'));
console.log('\n--- 色相图（R红 Y黄 G绿 C青 B蓝 M洋红 W亮灰 w灰 .暗 空=黑）---');
hueRows.forEach((r, i) => console.log(String(i).padStart(2, ' ') + '|' + r + '|'));

const pts = [[0.5, 0.5], [0.5, 0.42], [0.42, 0.5], [0.58, 0.5], [0.5, 0.58],
  [0.08, 0.5], [0.9, 0.5], [0.5, 0.06], [0.5, 0.95], [0.2, 0.2], [0.8, 0.8]];
console.log('\n--- 采样点 ---');
pts.forEach((p) => {
  const x = Math.min(w - 1, Math.floor(p[0] * w)), y = Math.min(h - 1, Math.floor(p[1] * h));
  const c = px(x, y);
  console.log('  (' + p[0].toFixed(2) + ',' + p[1].toFixed(2) + ') → rgb(' +
    c[0] + ',' + c[1] + ',' + c[2] + ')');
});
