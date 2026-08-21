// ---------------------------------------------------------------------------
// PNG 解码 + 文本化：把截图变成可在终端「读」的亮度图与配色统计，
// 用来在没有图形界面的情况下验收渲染结果。
//   node tools/png-stats.mjs <png> [cols] [rows]
// ---------------------------------------------------------------------------
import fs from 'node:fs';
import zlib from 'node:zlib';

const file = process.argv[2];
const COLS = Number(process.argv[3] || 78);
const ROWS = Number(process.argv[4] || 34);

const buf = fs.readFileSync(file);
if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('不是 PNG');

let off = 8;
let W = 0;
let H = 0;
let depth = 8;
let colorType = 6;
const idat = [];
while (off < buf.length) {
  const len = buf.readUInt32BE(off);
  const type = buf.toString('ascii', off + 4, off + 8);
  const data = buf.subarray(off + 8, off + 8 + len);
  if (type === 'IHDR') {
    W = data.readUInt32BE(0);
    H = data.readUInt32BE(4);
    depth = data[8];
    colorType = data[9];
    if (data[12] !== 0) throw new Error('不支持交错 PNG');
  } else if (type === 'IDAT') idat.push(data);
  else if (type === 'IEND') break;
  off += 12 + len;
}
if (depth !== 8) throw new Error('仅支持 8bit');
const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : colorType === 0 ? 1 : 0;
if (!channels) throw new Error('不支持的颜色类型 ' + colorType);

const raw = zlib.inflateSync(Buffer.concat(idat));
const stride = W * channels;
const px = Buffer.alloc(H * stride);
let p = 0;
for (let y = 0; y < H; y++) {
  const filter = raw[p++];
  const row = raw.subarray(p, p + stride);
  p += stride;
  const cur = px.subarray(y * stride, (y + 1) * stride);
  const prev = y > 0 ? px.subarray((y - 1) * stride, y * stride) : null;
  for (let x = 0; x < stride; x++) {
    const a = x >= channels ? cur[x - channels] : 0;
    const b = prev ? prev[x] : 0;
    const c = prev && x >= channels ? prev[x - channels] : 0;
    let v = row[x];
    switch (filter) {
      case 1: v += a; break;
      case 2: v += b; break;
      case 3: v += (a + b) >> 1; break;
      case 4: {
        const pa = Math.abs(b - c);
        const pb = Math.abs(a - c);
        const pc = Math.abs(a + b - 2 * c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
        break;
      }
      default: break;
    }
    cur[x] = v & 0xff;
  }
}

const at = (x, y) => {
  const i = y * stride + x * channels;
  return [px[i], px[i + 1] ?? px[i], px[i + 2] ?? px[i]];
};

/* ------------------------------ 亮度图 ---------------------------------- */
const RAMP = ' .:-=+*#%@';
const cw = W / COLS;
const ch = H / ROWS;
const lumMap = [];
const catMap = [];
const hist = {};
function classify(r, g, b) {
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const sat = mx === 0 ? 0 : (mx - mn) / mx;
  if (mx < 46) return 'k'; // 近黑（UI / 阴影）
  if (sat < 0.13) return mx > 175 ? 'w' : mx > 92 ? 'n' : 'd'; // 白/灰/暗灰
  if (b >= r && b >= g) return mx > 150 ? 'S' : 'W'; // 天空 / 水
  if (g >= r && g >= b) return 'G'; // 绿（草木）
  if (r > g && g > b) return g > 0.62 * r ? 'y' : 'R'; // 土黄 / 砖红
  return 'm';
}
for (let ry = 0; ry < ROWS; ry++) {
  let lRow = '';
  let cRow = '';
  for (let rx = 0; rx < COLS; rx++) {
    let sr = 0;
    let sg = 0;
    let sb = 0;
    let n = 0;
    const cats = {};
    for (let y = Math.floor(ry * ch); y < Math.min(H, (ry + 1) * ch); y += 2) {
      for (let x = Math.floor(rx * cw); x < Math.min(W, (rx + 1) * cw); x += 2) {
        const [r, g, b] = at(x, y);
        sr += r;
        sg += g;
        sb += b;
        n++;
        const k = classify(r, g, b);
        cats[k] = (cats[k] || 0) + 1;
        hist[k] = (hist[k] || 0) + 1;
      }
    }
    const r = sr / n;
    const g = sg / n;
    const b = sb / n;
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    lRow += RAMP[Math.min(RAMP.length - 1, Math.max(0, Math.round(lum * (RAMP.length - 1))))];
    cRow += Object.entries(cats).sort((a, z) => z[1] - a[1])[0][0];
  }
  lumMap.push(lRow);
  catMap.push(cRow);
}

const total = Object.values(hist).reduce((a, b) => a + b, 0);
const NAMES = {
  S: '天空蓝',
  W: '水/暗蓝',
  G: '草木绿',
  R: '砖红/瓦',
  y: '土黄/木',
  w: '白/亮灰',
  n: '中灰石',
  d: '暗灰',
  k: '近黑/UI',
  m: '其它',
};

console.log(`图像 ${W}×${H}  通道 ${channels}`);
console.log('\n── 亮度图 ' + '─'.repeat(COLS - 10));
lumMap.forEach((r, i) => console.log(String(i).padStart(2) + '|' + r + '|'));
console.log('\n── 配色图 ' + '─'.repeat(COLS - 10));
catMap.forEach((r, i) => console.log(String(i).padStart(2) + '|' + r + '|'));
console.log('\n── 配色占比 ─────────');
Object.entries(hist)
  .sort((a, b) => b[1] - a[1])
  .forEach(([k, v]) => {
    console.log(
      `  ${k} ${(NAMES[k] || k).padEnd(9, '　')} ${((v / total) * 100).toFixed(1).padStart(5)}%  ` +
        '█'.repeat(Math.round((v / total) * 40))
    );
  });
