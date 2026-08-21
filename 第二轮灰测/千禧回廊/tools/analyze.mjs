// tools/analyze.mjs —— 无需肉眼：数值化体检材质（区域均色 / 方差 / 色相 / 自发光覆盖率）
import { tex, textureNames, TS } from '../src/gfx/textures.js';

function regionStats(p, x, y, w, h) {
  let r = 0, g = 0, b = 0, n = 0, vr = 0;
  const lum = [];
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) {
      const c = p.get(xx, yy);
      r += c[0]; g += c[1]; b += c[2]; n++;
      lum.push(0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]);
    }
  }
  r /= n; g /= n; b /= n;
  const mL = lum.reduce((a, v) => a + v, 0) / lum.length;
  for (const v of lum) vr += (v - mL) ** 2;
  const sd = Math.sqrt(vr / lum.length);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let hue = 0;
  if (max - min > 1) {
    if (max === r) hue = 60 * (((g - b) / (max - min)) % 6);
    else if (max === g) hue = 60 * ((b - r) / (max - min) + 2);
    else hue = 60 * ((r - g) / (max - min) + 4);
    if (hue < 0) hue += 360;
  }
  const sat = max < 1 ? 0 : (max - min) / max;
  return { r, g, b, lum: mL, sd, hue, sat };
}

const hex = (s) => '#' + [s.r, s.g, s.b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

const names = process.argv.length > 2 ? process.argv.slice(2) : textureNames();
console.log('name'.padEnd(20), '上半区'.padEnd(9), '下半区'.padEnd(9), 'L上/L下'.padEnd(12), '细节sd'.padEnd(7), '色相', '饱和', '发光%');
console.log('-'.repeat(96));
let bad = 0;
for (const n of names) {
  const p = tex(n);
  const top = regionStats(p, 0, 0, TS, TS / 2);
  const bot = regionStats(p, 0, TS / 2, TS, TS / 2);
  const all = regionStats(p, 0, 0, TS, TS);
  let emit = 0;
  if (p.emit) for (const v of p.emit) if (v > 8) emit++;
  const emitPct = ((emit / (TS * TS)) * 100).toFixed(0);
  // 体检：洋红棋盘 = 材质缺失；sd<2 = 完全平板；lum<12 = 全黑
  const isMissing = Math.abs(all.hue - 300) < 12 && all.sat > 0.85;
  const flags = [];
  if (isMissing) flags.push('!! 材质缺失(洋红棋盘)');
  if (all.sd < 2.0) flags.push('!! 无细节(纯色板)');
  if (all.lum < 12) flags.push('!! 几乎全黑');
  if (all.lum > 245) flags.push('!! 几乎全白');
  if (flags.length) bad++;
  console.log(
    n.padEnd(20),
    hex(top).padEnd(9),
    hex(bot).padEnd(9),
    `${top.lum.toFixed(0)}/${bot.lum.toFixed(0)}`.padEnd(12),
    all.sd.toFixed(1).padEnd(7),
    all.hue.toFixed(0).padStart(4),
    all.sat.toFixed(2).padStart(6),
    emitPct.padStart(5),
    flags.join(' ')
  );
}
console.log('-'.repeat(96));
console.log(bad === 0 ? `✔ ${names.length} 张材质全部通过体检` : `✘ ${bad} 张材质有问题`);
