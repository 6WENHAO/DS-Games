/* =====================================================================
 * 浮空构件定位：找出自地面不可达的连通块，按体量排序并报告其材质与位置
 *   node --max-old-space-size=6144 tools/floating.js
 * ===================================================================== */
'use strict';
const path = require('path');
const ROOT = path.join(__dirname, '..');
for (const f of ['00-palette', '10-voxel', '15-field', '20-arch', '25-comp',
                 '30-plan', '40-city', '50-outer', '60-inner', '70-build'])
  require(path.join(ROOT, 'js', f + '.js'));
const G = globalThis, L = G.GGPalette.LIST, P = G.Plan;
const res = G.BuildCity({ log: () => {} });
const v = res.world, cells = v.cells;
const OFF = 1024, KX = 1048576, KZ = 512;

function dec(k) { const y = k % KZ, t = (k - y) / KZ, zi = t % 2048; return { x: (t - zi) / 2048 - OFF, y: y, z: zi - OFF }; }

/* 1. 自地面泛洪（26 邻域：面/棱/角相邻皆算相连） */
const NB = [];
for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++)
  if (dx || dy || dz) NB.push(dx * KX + dz * KZ + dy);
function neighbors(k) {
  const y = k % KZ, out = [];
  for (let dy = -1; dy <= 1; dy++) {
    if (y + dy < 0 || y + dy > 511) continue;
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      if (!dx && !dy && !dz) continue;
      out.push(k + dx * KX + dz * KZ + dy);
    }
  }
  return out;
}
const seen = new Set(); let stack = [];
cells.forEach((id, k) => { if ((k % KZ) <= P.GY) { stack.push(k); seen.add(k); } });
while (stack.length) {
  const k = stack.pop();
  for (const n of neighbors(k)) if (!seen.has(n) && cells.has(n)) { seen.add(n); stack.push(n); }
}
console.log('自地面可达（26 邻域）' + seen.size + ' / ' + cells.size + '，不可达 ' + (cells.size - seen.size));

/* 2. 对不可达者做连通分量 */
const rest = [];
cells.forEach((id, k) => { if (!seen.has(k)) rest.push(k); });
const done = new Set(), comps = [];
for (const s of rest) {
  if (done.has(s)) continue;
  const q = [s]; done.add(s);
  const members = [];
  while (q.length) {
    const k = q.pop(); members.push(k);
    for (const n of neighbors(k)) if (!done.has(n) && cells.has(n) && !seen.has(n)) { done.add(n); q.push(n); }
  }
  comps.push(members);
}
comps.sort((a, b) => b.length - a.length);
console.log('不可达连通分量 ' + comps.length + ' 个\n');

console.log('体量最大的 18 个分量：');
console.log('  #  方块数   x 范围        y 范围     z 范围        主材质');
for (let i = 0; i < Math.min(18, comps.length); i++) {
  const c = comps[i];
  let x0 = 9e9, x1 = -9e9, y0 = 9e9, y1 = -9e9, z0 = 9e9, z1 = -9e9;
  const mat = {};
  for (const k of c) {
    const d = dec(k);
    if (d.x < x0) x0 = d.x; if (d.x > x1) x1 = d.x;
    if (d.y < y0) y0 = d.y; if (d.y > y1) y1 = d.y;
    if (d.z < z0) z0 = d.z; if (d.z > z1) z1 = d.z;
    const nm = L[cells.get(k)].name; mat[nm] = (mat[nm] || 0) + 1;
  }
  const top = Object.entries(mat).sort((a, b) => b[1] - a[1]).slice(0, 3)
    .map(e => e[0] + '×' + e[1]).join('  ');
  console.log('  ' + String(i + 1).padStart(2) + ' ' + String(c.length).padStart(7) +
    '  [' + String(x0).padStart(5) + ',' + String(x1).padStart(5) + ']' +
    '  [' + String(y0).padStart(3) + ',' + String(y1).padStart(3) + ']' +
    '  [' + String(z0).padStart(5) + ',' + String(z1).padStart(5) + ']  ' + top);
}

/* 3. 分量规模分布 */
const bucket = { '1': 0, '2-5': 0, '6-20': 0, '21-100': 0, '101-1000': 0, '>1000': 0 };
for (const c of comps) {
  const n = c.length;
  if (n === 1) bucket['1']++;
  else if (n <= 5) bucket['2-5']++;
  else if (n <= 20) bucket['6-20']++;
  else if (n <= 100) bucket['21-100']++;
  else if (n <= 1000) bucket['101-1000']++;
  else bucket['>1000']++;
}
console.log('\n分量规模分布: ' + JSON.stringify(bucket));
