/* 生成预览图：用无头 Edge 截取几个典型构型，并打印每张图的基本统计做健全性检查 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const base = 'file:///' + path.join(dir, 'j20.html').replace(/\\/g, '/');
const W = 1600, H = 1000;

const shots = [
  ['preview-1-三视斜.png', 'cam=iso'],
  ['preview-2-飞行加力.png', 'flight=1&ab=1&gear=0&cam=rear'],
  ['preview-3-腹视弹舱.png', 'cam=belly&bay=1'],
  ['preview-4-座舱.png', 'cam=cockpit'],
  ['preview-5-进气道DSI.png', 'cam=intake'],
  ['preview-6-俯视.png', 'cam=top'],
];

function decode(file) {
  const buf = fs.readFileSync(file);
  let p = 8, w = 0, h = 0, type = 0; const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), tag = buf.toString('ascii', p + 4, p + 8);
    const data = buf.subarray(p + 8, p + 8 + len);
    if (tag === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); type = data[9]; }
    if (tag === 'IDAT') idat.push(data);
    if (tag === 'IEND') break;
    p += 12 + len;
  }
  const ch = type === 6 ? 4 : 3;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * ch, out = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const ft = raw[y * (stride + 1)];
    const src = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= ch ? out[y * stride + i - ch] : 0;
      const b = y > 0 ? out[(y - 1) * stride + i] : 0;
      const c = i >= ch && y > 0 ? out[(y - 1) * stride + i - ch] : 0;
      let v = src[i];
      if (ft === 1) v += a; else if (ft === 2) v += b; else if (ft === 3) v += (a + b) >> 1;
      else if (ft === 4) { const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      out[y * stride + i] = v & 0xff;
    }
  }
  let s = 0, n = 0; const bins = new Set();
  for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) {
    const i = (y * w + x) * ch;
    s += 0.299 * out[i] + 0.587 * out[i + 1] + 0.114 * out[i + 2]; n++;
    bins.add((out[i] >> 4) << 8 | (out[i + 1] >> 4) << 4 | (out[i + 2] >> 4));
  }
  return { w, h, avg: s / n, colors: bins.size, bytes: buf.length };
}

let bad = 0;
for (const [name, qs] of shots) {
  const out = path.join(dir, name);
  fs.rmSync(out, { force: true });
  const efd = fs.openSync(path.join(dir, '.edge-stderr.txt'), 'w');
  try {
    execFileSync(EDGE, [
      '--headless=new', '--disable-gpu', '--enable-unsafe-swiftshader',
      '--use-gl=angle', '--use-angle=swiftshader', '--no-sandbox', '--no-first-run',
      '--no-default-browser-check', '--disable-extensions', '--hide-scrollbars',
      '--mute-audio', '--allow-file-access-from-files',
      `--user-data-dir=${path.join(dir, '.edge-profile')}`,
      `--window-size=${W},${H}`, `--screenshot=${out}`, `${base}?${qs}`,
    ], { stdio: ['ignore', 'ignore', efd], timeout: 300000 });
  } finally { fs.closeSync(efd); }
  if (!fs.existsSync(out)) { console.log(`✗ ${name} 未生成`); bad++; continue; }
  const st = decode(out);
  const okShot = st.avg > 25 && st.avg < 225 && st.colors > 90;
  if (!okShot) bad++;
  console.log(`${okShot ? '✓' : '✗'} ${name}  ${st.w}×${st.h}  ${(st.bytes / 1024).toFixed(0)} KB  平均亮度 ${st.avg.toFixed(1)}  颜色簇 ${st.colors}`);
}
console.log(bad ? `\n${bad} 张预览图异常` : '\n预览图全部正常');
if (bad) process.exitCode = 1;
