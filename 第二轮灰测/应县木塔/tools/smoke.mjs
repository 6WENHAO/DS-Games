// 应县木塔：Node 端建模冒烟测试
import { register } from 'node:module';
register('./three-hooks.mjs', import.meta.url);
await import('./dom-stub.mjs');

const warns = [];
const ow = console.warn;
console.warn = (...a) => warns.push(a.join(' '));

const THREE = await import('three');
const { buildPagoda, LAYOUT } = await import('../src/pagoda/pagoda.js');
const { buildJointBench, JOINTS } = await import('../src/pagoda/joints.js');
const CAI = await import('../src/lib/cai.js');

const t0 = performance.now();
const { group, info } = buildPagoda();
const ms = performance.now() - t0;
const bench = buildJointBench({ gap: 4.3 });
bench.update(0.6);
bench.update(0);
console.warn = ow;

const scene = new THREE.Scene();
scene.add(group);
scene.add(bench.group);
group.updateMatrixWorld(true);
bench.group.updateMatrixWorld(true);

let meshes = 0;
let tris = 0;
const bad = [];
const mats = new Set();
scene.traverse((o) => {
  if (!o.isMesh) return;
  meshes++;
  mats.add(o.material.name || o.material.type);
  const g = o.geometry;
  const pos = g.attributes.position;
  if (!pos) return bad.push(`${o.name}: 无 position`);
  const n = o.isInstancedMesh ? o.count : 1;
  tris += ((g.index ? g.index.count : pos.count) / 3) * n;
  g.computeBoundingBox();
  const bb = g.boundingBox;
  if (![bb.min.x, bb.min.y, bb.max.y].every(Number.isFinite)) bad.push(`${o.name}: NaN 顶点`);
  if (!g.attributes.uv) bad.push(`${o.name}: 缺 uv`);
  if (!g.attributes.normal) bad.push(`${o.name}: 缺 normal`);
});

const box = new THREE.Box3().setFromObject(group);
const size = box.getSize(new THREE.Vector3());
const jb = new THREE.Box3().setFromObject(bench.group);
const jsz = jb.getSize(new THREE.Vector3());
const line = '─'.repeat(60);
console.log(line);
console.log(`  材广 ${(CAI.CAI * 100).toFixed(1)} cm   1 分° = ${(CAI.FEN * 100).toFixed(2)} cm`);
console.log(`  构建耗时        ${ms.toFixed(0)} ms`);
console.log(`  构件总数        ${info.pieces.toLocaleString()}`);
console.log(`  铺作朵数        ${info.puzuoCount}`);
console.log(`  铺作变体        ${info.bank.defs.size}（实例 ${info.instances}）`);
console.log(`  网格数          ${meshes}`);
console.log(`  三角面          ${Math.round(tris).toLocaleString()}`);
console.log(`  材质            ${mats.size}`);
console.log(line);
console.log(`  塔身高（含刹）  ${info.bodyHeight.toFixed(2)} m`);
console.log(`  总高（含台基）  ${info.totalHeight.toFixed(2)} m   目标 67.31 m`);
console.log(`  包围盒          ${size.x.toFixed(2)} × ${size.y.toFixed(2)} × ${size.z.toFixed(2)} m`);
console.log(line);
console.log(`  榫卯示教件      ${JOINTS.length} 种，共 ${bench.items.reduce((a, b) => a + b.parts.length, 0)} 个零件组`);
console.log(`  示教台尺寸      ${jsz.x.toFixed(1)} × ${jsz.y.toFixed(1)} × ${jsz.z.toFixed(1)} m`);
JOINTS.forEach((j, i) => {
  console.log(`   ${String(i + 1).padStart(2)}. ${j.name.padEnd(8)} ${j.sub.padEnd(22)} 零件 ${bench.items[i].parts.length}`);
});
console.log(line);
console.log('  各层标高：');
for (const L of info.layers) {
  console.log(
    `   ${String(L.name).padEnd(6)} 地面 ${(L.y0 ?? 0).toFixed(2).padStart(6)}  ` +
      `檐口 ${(L.yEave ?? 0).toFixed(2).padStart(6)}  顶 ${(L.yTop ?? 0).toFixed(2).padStart(6)}`
  );
}
console.log(line);
if (warns.length) {
  console.log(`⚠ 警告 ${warns.length}：`);
  [...new Set(warns)].slice(0, 8).forEach((w) => console.log('   ' + w));
}
if (bad.length) {
  console.log(`✗ 几何问题 ${bad.length}：`);
  [...new Set(bad)].slice(0, 12).forEach((b) => console.log('   ' + b));
}
console.log(!bad.length && !warns.length ? '✓ 检查通过' : '△ 见上');
process.exit(bad.length || warns.length ? 1 : 0);
