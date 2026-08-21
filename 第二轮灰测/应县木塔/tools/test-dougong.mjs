// 快速检查：单朵铺作的构件数、三角面数与包围盒是否合理
import { register } from 'node:module';
register('./three-hooks.mjs', import.meta.url);
await import('./dom-stub.mjs');

const THREE = await import('three');
const { Sculptor } = await import('../src/lib/geom.js');
const { puzuo, puzuoCorner, puzuoPingzuo } = await import('../src/pagoda/dougong.js');
const CAI = await import('../src/lib/cai.js');

console.log(`材广 ${(CAI.CAI * 100).toFixed(1)}cm  1分° = ${(CAI.FEN * 100).toFixed(2)}cm  材厚 ${(CAI.CAI_T * 100).toFixed(1)}cm`);

function measure(name, fn) {
  const s = new Sculptor(name);
  const meta = fn(s);
  const parts = s.bake();
  let tris = 0;
  const box = new THREE.Box3();
  const b2 = new THREE.Box3();
  for (const p of parts) {
    tris += p.geo.attributes.position.count / 3;
    b2.setFromBufferAttribute(p.geo.attributes.position);
    box.union(b2);
  }
  const sz = box.getSize(new THREE.Vector3());
  console.log(
    `${name.padEnd(14)} 构件${String(s.pieces).padStart(4)}  材质${parts.length}  三角面${String(Math.round(tris)).padStart(5)}  ` +
      `尺寸 ${sz.x.toFixed(2)}×${sz.y.toFixed(2)}×${sz.z.toFixed(2)}m  ` +
      `出跳${(meta?.reach ?? 0).toFixed(2)}m 总高${(meta?.height ?? 0).toFixed(2)}m`
  );
  return { meta, tris, pieces: s.pieces, box };
}

measure('七铺作双抄双下昂', (s) => puzuo(s, { jumps: ['hua', 'hua', 'ang', 'ang'], jixin: [false, true, false, true] }));
measure('五铺作双抄', (s) => puzuo(s, { jumps: ['hua', 'hua'], jixin: [false, true], inner: 1, shuatou: false }));
measure('平坐铺作', (s) => puzuoPingzuo(s, {}));
measure('转角铺作', (s) => puzuoCorner(s, {}));
measure('上层(0.9材)', (s) => puzuo(s, { scale: 0.9 }));
