// 临时冒烟脚本：构建全部舱段并统计
import { performance } from 'node:perf_hooks';
import { MODULES, buildModule } from '../src/voxel/blueprint.js';
import { meshVolume } from '../src/voxel/mesher.js';

let totalVox = 0, totalTri = 0, totalVtx = 0, totalBytes = 0;
const t0 = performance.now();
for (const def of MODULES) {
  const ta = performance.now();
  const vol = buildModule(def.id);
  const tb = performance.now();
  const mesh = meshVolume(vol.serialize());
  const tc = performance.now();
  const b = vol.bounds();
  totalVox += vol.count; totalTri += mesh.indexCount / 3; totalVtx += mesh.vertexCount;
  totalBytes += mesh.vertices.byteLength + mesh.indices.byteLength;
  console.log(
    `${def.id.padEnd(11)} vox=${String(vol.count).padStart(7)} quad=${String(mesh.quadCount).padStart(6)}` +
    ` tri=${String(mesh.indexCount / 3).padStart(6)} clip=${String(vol.clipped).padStart(6)}` +
    ` bbox=[${b.size.join('×')}]`.padEnd(18) +
    ` build=${(tb - ta).toFixed(0)}ms mesh=${(tc - tb).toFixed(0)}ms`
  );
}
console.log('─'.repeat(100));
console.log(`合计: 体素 ${totalVox}  顶点 ${totalVtx}  三角 ${totalTri}  GPU ${(totalBytes / 1048576).toFixed(2)} MB  耗时 ${(performance.now() - t0).toFixed(0)}ms`);
