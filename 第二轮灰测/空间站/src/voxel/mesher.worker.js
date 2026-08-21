/**
 * voxel/mesher.worker.js —— 建模 + 网格化工作线程
 *
 * 每个 Worker 独立完成「程序化建模 → 贪心网格化」的完整流程，
 * 结果以可转移对象（ArrayBuffer）零拷贝回传主线程。
 * 由于 blueprint 的建造程序是纯函数且使用确定性 PRNG，
 * 无论在哪个 Worker 上执行，结果都完全一致。
 */

import { buildModule } from './blueprint.js';
import { meshVolume } from './mesher.js';

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

self.onmessage = (e) => {
  const { id, seq } = e.data || {};
  if (!id) return;
  try {
    const t0 = now();
    const vol = buildModule(id);
    const t1 = now();
    const mesh = meshVolume(vol.serialize());
    const t2 = now();
    const histogram = vol.histogram();

    self.postMessage({
      ok: true, id, seq,
      mesh: {
        vertices: mesh.vertices,
        indices: mesh.indices,
        vertexCount: mesh.vertexCount,
        indexCount: mesh.indexCount,
        origin: mesh.origin,
      },
      info: {
        voxelCount: vol.count,
        quadCount: mesh.quadCount,
        bounds: vol.bounds(),
        clipped: vol.clipped,
        histogram,
        buildMs: t1 - t0,
        meshMs: t2 - t1,
      },
    }, [mesh.vertices.buffer, mesh.indices.buffer, histogram.buffer]);
  } catch (err) {
    self.postMessage({ ok: false, id, seq, error: String((err && err.stack) || err) });
  }
};
