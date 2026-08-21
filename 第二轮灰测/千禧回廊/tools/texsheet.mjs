// tools/texsheet.mjs —— 把全部材质拼成一张大图输出 PNG，用于肉眼审美术
import fs from 'node:fs';
import path from 'node:path';
import { encodePNG, upscale } from './png.mjs';
import { pix } from '../src/gfx/pixels.js';
import { tex, textureNames, TS } from '../src/gfx/textures.js';

const names = textureNames();
const cols = 6;
const rows = Math.ceil(names.length / cols);
const pad = 3, label = 8;
const cellW = TS + pad * 2, cellH = TS + pad * 2 + label;

const sheet = pix(cols * cellW, rows * cellH).fill('#141210');

names.forEach((n, i) => {
  const c = i % cols, r = (i / cols) | 0;
  const x = c * cellW + pad, y = r * cellH + pad;
  sheet.rect(x - 1, y - 1, TS + 2, TS + 2, '#3a352c');
  sheet.drawPix(tex(n), x, y);
  sheet.tiny(x, y + TS + 2, n.replace(/_/g, '-').slice(0, 15), '#c8bb9a', 1);
});

const k = Number(process.argv[2] || 2);
const up = upscale(sheet.w, sheet.h, sheet.data, k);
const outDir = path.resolve('preview');
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, 'textures.png');
fs.writeFileSync(out, encodePNG(up.w, up.h, up.data));
console.log(`✔ ${names.length} 张材质 → ${out}  (${up.w}×${up.h})`);
