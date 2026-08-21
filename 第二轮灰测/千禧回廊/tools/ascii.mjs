// tools/ascii.mjs —— 把离屏渲染的一帧转成 ASCII 灰阶图打到终端
//   用法: node tools/ascii.mjs <zone> [angleDeg] [x] [y] [cols] [pitchDeg]
//   这样即使没有图像查看能力，也能判断构图：地平线位置、墙的收缩、门洞、精灵剪影
import { compile, setCell } from '../src/world/compile.js';
import { ZONE_DEFS } from '../src/world/zones.js';
import { Renderer } from '../src/gfx/raycast.js';
import { animateProps } from '../src/gfx/props.js';

const zoneId = process.argv[2] || 'home';
const angleDeg = process.argv[3] !== undefined ? Number(process.argv[3]) : null;
const px = process.argv[4] !== undefined ? Number(process.argv[4]) : null;
const py = process.argv[5] !== undefined ? Number(process.argv[5]) : null;
const COLS = Number(process.argv[6] || 108);
const pitchDeg = Number(process.argv[7] || 0);

const def = ZONE_DEFS[zoneId];
if (!def) { console.error(`没有这个场景: ${zoneId}`); process.exit(1); }
const world = compile(def);
for (const [x, y, ch] of def.checkOpen || []) setCell(world, x, y, ch);
for (const l of world.lights) l.on = true;

const W = 384, H = 216;
const r = new Renderer(W, H);
const FOV = 1.16;
const cam = {
  x: px ?? def.spawn.x,
  y: py ?? def.spawn.y,
  a: angleDeg !== null ? (angleDeg * Math.PI) / 180 : def.spawn.a,
  fov: FOV, ez: 1.62,
  // pitch 是地平线的屏幕偏移；这里按角度换算，和游戏里一致
  pitch: Math.tan((pitchDeg * Math.PI) / 180) * ((W / 2) / Math.tan(FOV / 2)),
};
animateProps(1.7);
const data = r.render(world, cam, { grain: 0, scanlines: 0.05, warm: 1.3, sat: 1.06, bloom: 0.45, bloomThreshold: 192, time: 1.7 });

// 灰阶 → 字符（暗到亮）
const RAMP = ' .:-=+*#%@';
const ROWS = Math.round((COLS * H) / W / 2.1);
let outLum = '', outHue = '';
const HUE = { r: 'R', o: 'O', y: 'Y', g: 'G', c: 'C', b: 'B', m: 'M', n: '.' };

for (let ry = 0; ry < ROWS; ry++) {
  for (let rx = 0; rx < COLS; rx++) {
    const x0 = Math.floor((rx * W) / COLS), x1 = Math.floor(((rx + 1) * W) / COLS);
    const y0 = Math.floor((ry * H) / ROWS), y1 = Math.floor(((ry + 1) * H) / ROWS);
    let l = 0, R = 0, G = 0, B = 0, n = 0;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const i = (y * W + x) * 4;
      R += data[i]; G += data[i + 1]; B += data[i + 2];
      l += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      n++;
    }
    l /= n; R /= n; G /= n; B /= n;
    outLum += RAMP[Math.min(RAMP.length - 1, Math.max(0, Math.round((l / 255) * (RAMP.length - 1))))];
    const mx = Math.max(R, G, B), mn = Math.min(R, G, B);
    const sat = mx < 1 ? 0 : (mx - mn) / mx;
    let h = 'n';
    if (sat > 0.16) {
      let deg;
      if (mx === R) deg = (60 * (((G - B) / (mx - mn)) % 6) + 360) % 360;
      else if (mx === G) deg = 60 * ((B - R) / (mx - mn) + 2);
      else deg = 60 * ((R - G) / (mx - mn) + 4);
      h = deg < 15 || deg >= 345 ? 'r' : deg < 40 ? 'o' : deg < 70 ? 'y'
        : deg < 165 ? 'g' : deg < 200 ? 'c' : deg < 265 ? 'b' : 'm';
    }
    outHue += HUE[h];
  }
  outLum += '\n'; outHue += '\n';
}

console.log(`— ${zoneId} @ (${cam.x.toFixed(1)},${cam.y.toFixed(1)}) 朝向 ${((cam.a * 180) / Math.PI).toFixed(0)}° 俯仰 ${pitchDeg}° —`);
console.log('【明暗】(空=黑 @=亮)  地平线应在正中');
console.log(outLum);
console.log('【色相】R红 O橙 Y黄 G绿 C青 B蓝 M紫 .=灰');
console.log(outHue);

// —— 关键行的实测 RGB（比 ASCII 更硬的证据）——
function probe(label, y) {
  const cols = [0.08, 0.3, 0.5, 0.7, 0.92].map((f) => Math.floor(f * W));
  const s = cols.map((x) => {
    const i = (y * W + x) * 4;
    return `#${[data[i], data[i + 1], data[i + 2]].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
  });
  const li = cols.map((x) => {
    const i = (y * W + x) * 4;
    return Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
  });
  console.log(`${label.padEnd(14)} y=${String(y).padStart(3)}  ${s.join(' ')}   L=${li.join('/')}`);
}
console.log('【采样】左8% 左30% 正中 右70% 右92%');
probe('顶部(天/顶)', 6);
probe('上四分之一', Math.floor(H * 0.25));
probe('地平线上方', Math.floor(H / 2) - 8);
probe('地平线下方', Math.floor(H / 2) + 8);
probe('下四分之一', Math.floor(H * 0.75));
probe('底部(近地)', H - 6);
