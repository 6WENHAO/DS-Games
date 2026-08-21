// 片区几何诊断：列出各片区最靠西/东/最高的合并网格（按材质名定位构件）
//   node tools/diag.mjs [片区id …]     默认全部
import { register } from 'node:module';
register('./three-hooks.mjs', import.meta.url);
await import('./dom-stub.mjs');

const THREE = await import('three');
const { buildTown } = await import('../src/world/town.js');

const only = process.argv.slice(2);
const town = buildTown();
town.group.updateMatrixWorld(true);
const box = new THREE.Box3();
for (const child of town.group.children) {
  const id = child.userData.district || child.name;
  if (only.length && !only.includes(id)) continue;
  const list = [];
  child.traverse((o) => {
    if (!o.isMesh) return;
    box.setFromObject(o);
    list.push({
      mat: o.material.name || o.name,
      minx: box.min.x,
      maxx: box.max.x,
      minz: box.min.z,
      maxz: box.max.z,
      maxy: box.max.y,
    });
  });
  console.log(`\n=== ${id} ===`);
  console.log('— 最靠西 —');
  list
    .slice()
    .sort((a, b) => a.minx - b.minx)
    .slice(0, 4)
    .forEach((r) => console.log(`   ${r.mat.padEnd(16)} x${r.minx.toFixed(1)}..${r.maxx.toFixed(1)}  z${r.minz.toFixed(1)}..${r.maxz.toFixed(1)}`));
  console.log('— 最靠东 —');
  list
    .slice()
    .sort((a, b) => b.maxx - a.maxx)
    .slice(0, 4)
    .forEach((r) => console.log(`   ${r.mat.padEnd(16)} x${r.minx.toFixed(1)}..${r.maxx.toFixed(1)}  z${r.minz.toFixed(1)}..${r.maxz.toFixed(1)}`));
  console.log('— 最高 —');
  list
    .slice()
    .sort((a, b) => b.maxy - a.maxy)
    .slice(0, 4)
    .forEach((r) => console.log(`   ${r.mat.padEnd(16)} 高${r.maxy.toFixed(1)}  x${r.minx.toFixed(1)}..${r.maxx.toFixed(1)}`));
}
