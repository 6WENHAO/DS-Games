/**
 * test-models3d.mjs — 校验参数化三维建模库能否为全部 112 型装备正确生成网格
 * 用法: node tools/test-models3d.mjs
 */
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(import.meta.dirname, '..');
globalThis.window = globalThis;

// three.js UMD → 浏览器分支（global 作用域内无 exports/module/define）
vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'vendor', 'three.min.js'), 'utf8'));
if (!globalThis.THREE) { console.error('THREE 未挂载到全局'); process.exit(1); }
console.log('three.js r' + globalThis.THREE.REVISION);

for (const f of ['equipment', 'theater', 'oob', 'models3d']) {
  require(path.join(ROOT, 'js', f + '.js'));
}
const TWG = globalThis.TWG;
if (!TWG.M3D) { console.error('M3D 未加载'); process.exit(1); }

const ids = Object.keys(TWG.PLATFORMS);
let ok = 0, fail = [], totTri = 0, maxTri = 0, maxId = '', minTri = 1e9, minId = '';
const byDomain = {};
const t0 = Date.now();

for (const id of ids) {
  let m = null, err = null;
  try { m = TWG.M3D.get(id); } catch (e) { err = e; }
  if (!m) { fail.push([id, err ? String(err.message || err).slice(0, 90) : 'null']); continue; }
  const ud = m.userData || {};
  const tri = ud.tris || 0;
  const bb = ud.bbox && ud.bbox.size;
  if (!bb || !(bb.x > 0) || !(bb.z > 0)) { fail.push([id, 'bbox 异常 ' + JSON.stringify(bb)]); continue; }
  // 检查 NaN 顶点
  let nan = 0;
  m.traverse(o => {
    if (!o.geometry) return;
    const p = o.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      if (!Number.isFinite(p.getX(i)) || !Number.isFinite(p.getY(i)) || !Number.isFinite(p.getZ(i))) { nan++; break; }
    }
  });
  if (nan) { fail.push([id, nan + ' 个网格含 NaN 顶点']); continue; }
  ok++; totTri += tri;
  if (tri > maxTri) { maxTri = tri; maxId = id; }
  if (tri < minTri) { minTri = tri; minId = id; }
  const P = TWG.PLATFORMS[id];
  (byDomain[P.domain] = byDomain[P.domain] || []).push({ id, tri, size: [bb.x, bb.y, bb.z].map(v => +v.toFixed(1)) });
}

console.log('='.repeat(74));
console.log(`成功 ${ok}/${ids.length}　失败 ${fail.length}　构建耗时 ${Date.now() - t0} ms`);
console.log(`三角面: 合计 ${totTri}　平均 ${Math.round(totTri / Math.max(ok, 1))}　最大 ${maxTri} (${maxId})　最小 ${minTri} (${minId})`);
for (const d of Object.keys(byDomain)) {
  const arr = byDomain[d];
  const avg = Math.round(arr.reduce((a, x) => a + x.tri, 0) / arr.length);
  console.log(`  ${d.padEnd(8)} ${String(arr.length).padStart(3)} 型　平均 ${String(avg).padStart(5)} 面　例: ` +
    arr.slice(0, 3).map(x => `${x.id}(${x.tri}面 ${x.size.join('×')}m)`).join('  '));
}
if (fail.length) {
  console.log('-'.repeat(74));
  console.log('失败清单:');
  for (const [id, e] of fail) console.log('  ' + id.padEnd(20) + e);
}
console.log('='.repeat(74));
// 尺寸合理性抽查（模型包围盒长度应接近真实舰长/机长）
const checks = [['CV-Fujian', 316, 40], ['DDG-055', 180, 25], ['FFG-054A', 134, 20],
  ['SS-039C', 77, 12], ['J-20A', 21, 5], ['H-6K', 35, 8], ['E-2K', 18, 6], ['F-16V', 15, 5]];
let sizeBad = 0;
for (const [id, expect, tol] of checks) {
  const m = TWG.M3D.get(id);
  if (!m) continue;
  const len = m.userData.bbox.size.z;
  const good = Math.abs(len - expect) <= tol;
  if (!good) sizeBad++;
  console.log(`${good ? 'PASS' : 'FAIL'}  ${id.padEnd(14)} 模型长度 ${len.toFixed(1)} m　期望 ${expect}±${tol} m`);
}
console.log(fail.length === 0 && sizeBad === 0 ? '★ 三维建模库全部通过' : '✗ 存在问题');
process.exit(fail.length === 0 && sizeBad === 0 ? 0 : 2);
