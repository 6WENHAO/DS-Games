/**
 * voxel/factory.js —— 并行建模调度器
 *
 * 建立一个 module worker 池，把 17 个舱段的「建模 + 网格化」任务分发出去。
 * 若浏览器不支持 module worker（或被安全策略拦截），自动退化为主线程分帧构建，
 * 保证功能可用性不受影响。
 */

import { MODULES } from './blueprint.js';

const WORKER_URL = new URL('./mesher.worker.js', import.meta.url);

/** 探测 module worker 可用性（只探测一次） */
function trySpawn() {
  try {
    return new Worker(WORKER_URL, { type: 'module' });
  } catch (err) {
    console.warn('[factory] module worker 不可用，退化到主线程构建：', err);
    return null;
  }
}

/**
 * @typedef {Object} BuildCallbacks
 * @property {(done:number,total:number,label:string)=>void} [onProgress]
 * @property {(def:object, mesh:object, info:object)=>void} onModule
 * @property {(msg:string, level?:string)=>void} [onLog]
 */

/**
 * 并行构建全部舱段。
 * @param {BuildCallbacks} cb
 * @returns {Promise<{workers:number, elapsed:number, fallback:boolean}>}
 */
export async function buildStation(cb) {
  const t0 = performance.now();
  const queue = MODULES.map((d) => d.id);
  const total = queue.length;
  let done = 0;

  const report = (id, info) => {
    done++;
    cb.onProgress?.(done, total, id);
    const def = MODULES.find((d) => d.id === id);
    cb.onLog?.(`${def ? def.name : id} · ${info.voxelCount.toLocaleString('zh-CN')} 体素 · ${(info.quadCount).toLocaleString('zh-CN')} 面 · ${(info.buildMs + info.meshMs).toFixed(0)} ms`, 'ok');
  };

  /* ── 优先路径：Worker 池 ── */
  const probe = trySpawn();
  if (probe) {
    const hw = navigator.hardwareConcurrency || 4;
    const count = Math.max(1, Math.min(total, hw - 1 > 0 ? hw - 1 : 1, 8));
    const workers = [probe];
    for (let i = 1; i < count; i++) {
      const w = trySpawn();
      if (w) workers.push(w);
    }
    cb.onLog?.(`启动 ${workers.length} 个建模工作线程（逻辑核心 ${hw}）`);

    await new Promise((resolve, reject) => {
      let active = 0;
      let failed = null;

      const pump = (w) => {
        const id = queue.shift();
        if (!id) {
          if (active === 0) resolve();
          return;
        }
        active++;
        w.postMessage({ id, seq: done });
      };

      for (const w of workers) {
        w.onmessage = (e) => {
          const d = e.data;
          active--;
          if (d.ok) {
            const def = MODULES.find((x) => x.id === d.id);
            try { cb.onModule(def, d.mesh, d.info); } catch (err) { failed = err; }
            report(d.id, d.info);
          } else {
            console.error(`[factory] 舱段 ${d.id} 构建失败：`, d.error);
            cb.onLog?.(`舱段 ${d.id} 构建失败`, 'warn');
            done++;
            cb.onProgress?.(done, total, d.id);
          }
          if (failed) { reject(failed); return; }
          pump(w);
        };
        w.onerror = (err) => {
          console.error('[factory] worker 异常：', err.message || err);
          active--;
          pump(w);
        };
      }
      // 初始灌注
      for (const w of workers) pump(w);
    });

    for (const w of workers) w.terminate();
    return { workers: workers.length, elapsed: performance.now() - t0, fallback: false };
  }

  /* ── 退化路径：主线程分帧构建 ── */
  const { buildModule } = await import('./blueprint.js');
  const { meshVolume } = await import('./mesher.js');
  for (const id of queue) {
    await nextFrame();
    const ta = performance.now();
    const vol = buildModule(id);
    const mesh = meshVolume(vol.serialize());
    const info = {
      voxelCount: vol.count, quadCount: mesh.quadCount, bounds: vol.bounds(),
      clipped: vol.clipped, histogram: vol.histogram(),
      buildMs: performance.now() - ta, meshMs: 0,
    };
    cb.onModule(MODULES.find((d) => d.id === id), mesh, info);
    report(id, info);
  }
  return { workers: 0, elapsed: performance.now() - t0, fallback: true };
}

const nextFrame = () => new Promise((r) => (typeof requestAnimationFrame === 'function'
  ? requestAnimationFrame(() => r())
  : setTimeout(r, 0)));
