// 无浏览器基准：跑一遍生成 + 网格化，检查错误、耗时与规模
import { createGenerator } from '../src/generator.js';
import { createMesher } from '../src/mesher.js';

const t0 = performance.now();
const gen = createGenerator(861204);
const timings = [];
for (const [label, run] of gen.steps) {
  const a = performance.now();
  run();
  const dt = performance.now() - a;
  timings.push([label, dt]);
  console.log(`  ${label.padEnd(24, '·')} ${dt.toFixed(0)} ms`);
}
const tGen = performance.now() - t0;

console.log('\n体素统计');
console.log('  实体体素   :', gen.data.stats.solid.toLocaleString());
console.log('  区块数     :', gen.data.stats.chunks.toLocaleString(), `(${gen.data.stats.memoryMB.toFixed(1)} MB)`);
console.log('  包围盒     :', JSON.stringify(gen.data.stats.bbox));
console.log('  生成耗时   :', tGen.toFixed(0), 'ms');

const t1 = performance.now();
const mesher = createMesher(gen.world, 100000);
while (mesher.step());
const sectors = mesher.finish();
const tMesh = performance.now() - t1;

let verts = 0, quads = 0, bytes = 0;
for (const s of sectors) {
  verts += s.verts; quads += s.quads;
  bytes += s.position.byteLength + s.normal.byteLength + s.color.byteLength
    + s.ao.byteLength + s.emissive.byteLength + s.index.byteLength;
}
console.log('\n网格统计');
console.log('  扇区(draw call):', sectors.length);
console.log('  四边形         :', quads.toLocaleString());
console.log('  三角形         :', (quads * 2).toLocaleString());
console.log('  顶点           :', verts.toLocaleString());
console.log('  GPU 缓冲       :', (bytes / 1048576).toFixed(1), 'MB');
console.log('  网格化耗时     :', tMesh.toFixed(0), 'ms');

console.log('\n道具锚点');
const d = gen.data;
console.log('  注释:', d.annotations.length, '| 电梯:', d.elevators.length,
  '| 航线:', d.droneLanes.length, '| 行人:', d.pedPaths.length,
  '| 车道:', d.carPaths.length, '| 闪灯:', d.blinkers.length,
  '| 光井:', d.lightShafts.length, '| 视点:', d.viewpoints.length);

// 抽查若干位置是否可站立（第一视角出生点必须在空气里）
for (const vp of d.viewpoints.filter((v) => v.mode === 'fps')) {
  const [x, y, z] = vp.pos;
  const solidHere = gen.world.get(Math.round(x), Math.round(y), Math.round(z));
  const solidHead = gen.world.get(Math.round(x), Math.round(y) + 2, Math.round(z));
  const floor = gen.world.groundAt(Math.round(x), Math.round(z), Math.round(y) + 4, Math.round(y) - 60);
  console.log(`  ${vp.name.padEnd(18)} 脚下=${solidHere} 头部=${solidHead} 地面y=${floor}`);
}
