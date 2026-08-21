/**
 * build-geodata.mjs
 * 解码 echarts(Natural Earth 派生) UTF8 编码 GeoJSON -> 抽取海岸线/行政多边形
 * -> Douglas-Peucker 抽稀 -> 输出 js/geodata.js (classic script, 挂 window.TWG.GEO)
 *
 * 数据源: registry.npmmirror.com/echarts/4.9.0/files/map/json/province/*.json
 * 底图坐标系: WGS84 经纬度
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const DATA = path.join(ROOT, 'data');
const OUT = path.join(ROOT, 'js', 'geodata.js');

/* ---------- echarts UTF8 解码 ---------- */
function decodePolygon(str, encodeOffsets, encodeScale) {
  const result = [];
  let prevX = encodeOffsets[0];
  let prevY = encodeOffsets[1];
  for (let i = 0; i < str.length; i += 2) {
    let x = str.charCodeAt(i) - 64;
    let y = str.charCodeAt(i + 1) - 64;
    x = (x >> 1) ^ -(x & 1);      // zigzag
    y = (y >> 1) ^ -(y & 1);
    x += prevX;                    // delta
    y += prevY;
    prevX = x;
    prevY = y;
    result.push([x / encodeScale, y / encodeScale]);
  }
  return result;
}

function decodeGeoJson(json) {
  const encodeScale = json.UTF8Scale == null ? 1024 : json.UTF8Scale;
  for (const feature of json.features) {
    const g = feature.geometry;
    if (!g || typeof g.coordinates?.[0] !== 'string' && !Array.isArray(g.coordinates?.[0])) continue;
    for (let i = 0; i < g.coordinates.length; i++) {
      const c = g.coordinates[i];
      if (g.type === 'Polygon') {
        if (typeof c === 'string') g.coordinates[i] = decodePolygon(c, g.encodeOffsets[i], encodeScale);
      } else if (g.type === 'MultiPolygon') {
        for (let j = 0; j < c.length; j++) {
          if (typeof c[j] === 'string') c[j] = decodePolygon(c[j], g.encodeOffsets[i][j], encodeScale);
        }
      }
    }
  }
  return json;
}

/* ---------- Douglas-Peucker 抽稀 ---------- */
function perpDist(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const L2 = dx * dx + dy * dy;
  if (L2 === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  let t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}
function simplify(pts, tol) {
  if (pts.length < 3) return pts.slice();
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop();
    let maxD = -1, idx = -1;
    for (let i = s + 1; i < e; i++) {
      const d = perpDist(pts[i], pts[s], pts[e]);
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD > tol && idx > 0) { keep[idx] = 1; stack.push([s, idx], [idx, e]); }
  }
  const out = [];
  for (let i = 0; i < pts.length; i++) if (keep[i]) out.push(pts[i]);
  return out;
}

const r5 = (v) => Math.round(v * 100000) / 100000;

/* ---------- 提取 ---------- */
// 感兴趣区域: 台海战场 (含琉球西南、巴士海峡北、东部战区纵深机场)
const AOI = { w: 112.5, e: 126.5, s: 19.0, n: 32.5 };

function ringInAOI(ring) {
  let inside = 0;
  for (const p of ring) {
    if (p[0] >= AOI.w - 1.0 && p[0] <= AOI.e + 1.0 && p[1] >= AOI.s - 1.0 && p[1] <= AOI.n + 1.0) inside++;
  }
  return inside / ring.length > 0.05;
}

function ringArea(ring) { // 近似面积 (deg^2)
  let a = 0;
  for (let i = 0, n = ring.length; i < n; i++) {
    const p = ring[i], q = ring[(i + 1) % n];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return Math.abs(a / 2);
}

function collect(file, opts = {}) {
  const raw = JSON.parse(fs.readFileSync(path.join(DATA, file), 'utf8'));
  const gj = decodeGeoJson(raw);
  const polys = [];
  const labels = [];
  for (const f of gj.features) {
    const name = f.properties?.name || f.properties?.name_en || '';
    const g = f.geometry;
    if (!g) continue;
    const rings = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    let best = null, bestA = 0;
    for (const poly of rings) {
      const outer = poly[0];
      if (!outer || outer.length < 4) continue;
      if (!ringInAOI(outer)) continue;
      const A = ringArea(outer);
      if (A < (opts.minArea ?? 0.00002)) continue;
      const s = simplify(outer, opts.tol ?? 0.004).map((p) => [r5(p[0]), r5(p[1])]);
      if (s.length < 4) continue;
      polys.push(s);
      if (A > bestA) { bestA = A; best = s; }
    }
    if (best && name) {
      // 质心
      let cx = 0, cy = 0;
      for (const p of best) { cx += p[0]; cy += p[1]; }
      labels.push({ n: name, c: [r5(cx / best.length), r5(cy / best.length)] });
    }
  }
  return { polys, labels };
}

const tw = collect('ec_taiwan.json', { tol: 0.0018, minArea: 0.000004 });
const fj = collect('ec_fujian.json', { tol: 0.0035, minArea: 0.00003 });
const zj = collect('ec_zhejiang.json', { tol: 0.004, minArea: 0.00005 });
const gd = collect('ec_guangdong.json', { tol: 0.006, minArea: 0.0001 });
// 内陆背景（纵深机场/导弹旅所在），粗抽稀
const inland = { polys: [], labels: [] };
for (const f of ['ec_jiangxi.json', 'ec_anhui.json', 'ec_jiangsu.json', 'ec_shanghai.json', 'ec_guangxi.json', 'ec_hunan.json']) {
  const r = collect(f, { tol: 0.02, minArea: 0.002 });
  inland.polys.push(...r.polys);
}

const count = (o) => o.polys.reduce((a, p) => a + p.length, 0);
console.log('taiwan   polys', tw.polys.length, 'pts', count(tw));
console.log('fujian   polys', fj.polys.length, 'pts', count(fj));
console.log('zhejiang polys', zj.polys.length, 'pts', count(zj));
console.log('guangdong polys', gd.polys.length, 'pts', count(gd));
console.log('inland   polys', inland.polys.length, 'pts', count(inland));

const bbox = (o) => {
  let x0 = 999, y0 = 999, x1 = -999, y1 = -999;
  for (const p of o.polys) for (const c of p) { x0 = Math.min(x0, c[0]); x1 = Math.max(x1, c[0]); y0 = Math.min(y0, c[1]); y1 = Math.max(y1, c[1]); }
  return [x0, y0, x1, y1].map((v) => v.toFixed(2)).join(',');
};
console.log('taiwan bbox', bbox(tw));

const body = `/* 自动生成 by tools/build-geodata.mjs — 请勿手改
 * 海岸线/行政区矢量 (WGS84)，源自 Natural Earth (via echarts 4.9 province maps)，Douglas-Peucker 抽稀
 */
(function (root) {
  'use strict';
  var TWG = root.TWG = root.TWG || {};
  TWG.GEO = {
    aoi: ${JSON.stringify(AOI)},
    taiwan:    ${JSON.stringify(tw.polys)},
    twLabels:  ${JSON.stringify(tw.labels)},
    fujian:    ${JSON.stringify(fj.polys)},
    fjLabels:  ${JSON.stringify(fj.labels)},
    zhejiang:  ${JSON.stringify(zj.polys)},
    guangdong: ${JSON.stringify(gd.polys)},
    inland:    ${JSON.stringify(inland.polys)}
  };
})(typeof window !== 'undefined' ? window : globalThis);
`;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, body, 'utf8');
console.log('written', OUT, (fs.statSync(OUT).size / 1024).toFixed(1) + ' KB');
