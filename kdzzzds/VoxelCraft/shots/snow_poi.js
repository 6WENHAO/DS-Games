/* shots/snow_poi.js - 扫描雪地群系兴趣点（用于积雪优化前后截图对比） */
const GEN_MODULE = require('../js/gen.js');
const G = {};
GEN_MODULE(G);
G.setSeed(20260718);

const R = 6000, STEP = 48;
const poi = {
  snowMt: null,       // 雪山群系 高海拔带雪
  snowline: null,     // 雪山群系 雪线过渡带 (h≈105..135)
  snowForest: null,   // 雪山群系 带雪区且 h<300（未来雪林区）
  highsnow: null,     // 高雪原
  highsnowIce: null,  // 高雪原冰面湖
  peakSnow: null,     // 高雪山 雪冠
  peakBare: null,     // 高雪山 裸岩带 (900..1100)
};
function d2(x, z) { return x * x + z * z; }
function upd(key, x, z, c, score) {
  const cur = poi[key];
  const v = { x, z, h: c.h, d: Math.sqrt(d2(x, z)) | 0, score };
  if (!cur) { poi[key] = v; return; }
  // 同分优先离原点近
  if (score > cur.score || (score === cur.score && v.d < cur.d)) poi[key] = v;
}

for (let x = -R; x <= R; x += STEP) {
  for (let z = -R; z <= R; z += STEP) {
    const c = G.column(x, z);
    const b = c.biome;
    if (b === G.B_SNOW) {
      if (c.snow && c.h > 250) upd('snowMt', x, z, c, Math.min(c.h, 460) - Math.sqrt(d2(x, z)) * 0.02);
      if (c.h >= 105 && c.h <= 135) upd('snowline', x, z, c, 100 - Math.abs(c.h - 120) - Math.sqrt(d2(x, z)) * 0.01);
      if (c.snow && c.h < 300) upd('snowForest', x, z, c, 200 - Math.sqrt(d2(x, z)) * 0.02);
    } else if (b === G.B_HIGHSNOW) {
      upd('highsnow', x, z, c, 100 - Math.sqrt(d2(x, z)) * 0.01);
      if (c.det < 0.34 && G.h2(Math.floor(x / 24), Math.floor(z / 24), 211) < 0.4)
        upd('highsnowIce', x, z, c, 100 - Math.sqrt(d2(x, z)) * 0.01);
    } else if (b === G.B_HIGHPEAK) {
      if (c.snow && c.h > 1400) upd('peakSnow', x, z, c, Math.min(c.h, 2200) * 0.1 - Math.sqrt(d2(x, z)) * 0.01);
      if (!c.snow && c.h >= 900 && c.h <= 1120) upd('peakBare', x, z, c, 100 - Math.sqrt(d2(x, z)) * 0.01);
    }
  }
}
// 高原类群系更远，扩大范围粗扫
for (let x = -20000; x <= 20000; x += 96) {
  for (let z = -20000; z <= 20000; z += 96) {
    if (Math.abs(x) <= R && Math.abs(z) <= R) continue;
    const f = { hlRaw: G.fbm(x, z, 1 / 4200, 3, 171) };
    if (f.hlRaw < 0.56) continue;          // 高原掩码外跳过（省 column 全算）
    const c = G.column(x, z);
    const b = c.biome;
    if (b === G.B_HIGHSNOW) {
      upd('highsnow', x, z, c, 100 - Math.sqrt(d2(x, z)) * 0.005);
      if (c.det < 0.34 && G.h2(Math.floor(x / 24), Math.floor(z / 24), 211) < 0.4)
        upd('highsnowIce', x, z, c, 100 - Math.sqrt(d2(x, z)) * 0.005);
    } else if (b === G.B_HIGHPEAK) {
      if (c.snow && c.h > 1400) upd('peakSnow', x, z, c, Math.min(c.h, 2200) * 0.1 - Math.sqrt(d2(x, z)) * 0.005);
      if (!c.snow && c.h >= 900 && c.h <= 1120) upd('peakBare', x, z, c, 100 - Math.sqrt(d2(x, z)) * 0.005);
    }
  }
}
for (const k of Object.keys(poi)) {
  const p = poi[k];
  console.log(k.padEnd(12), p ? `x=${p.x} z=${p.z} h=${p.h} dist=${p.d}` : 'NOT FOUND');
}
