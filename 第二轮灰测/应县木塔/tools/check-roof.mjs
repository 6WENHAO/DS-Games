import { register } from 'node:module';
register('./three-hooks.mjs', import.meta.url);
await import('./dom-stub.mjs');
const THREE = await import('three');
const { Sculptor } = await import('../src/lib/geom.js');
const { eaveFace, hipFace } = await import('../src/pagoda/roof.js');

function chk(name, fn) {
  const s = new Sculptor(name);
  const meta = fn(s);
  const parts = s.bake();
  let tris = 0;
  const byMat = {};
  for (const p of parts) {
    const t = p.geo.attributes.position.count / 3;
    tris += t;
    byMat[p.mat.name] = Math.round(t);
  }
  console.log(`${name}: 构件${s.pieces} 三角面${Math.round(tris)} 瓦垄${meta.nTile}`);
  console.log('   ' + Object.entries(byMat).map(([k, v]) => `${k}:${v}`).join('  '));
  return meta;
}
// 一层檐
chk('一层檐', (s) => eaveFace(s, { rLiao: 12.87, rWall: 11.18, riseUp: 2.05, yanChu: 0.9, feiChu: 0.58, qiQiao: 0.52, chuQiao: 0.38 }));
// 顶层攒尖
chk('攒尖顶', (s) => hipFace(s, { rLiao: 10.46, height: 7.6, rTop: 1.2 }));

// 瓦垄覆盖率核算
const TILE_SPACE = 0.34, TILE_R = 0.082;
for (const [nm, rl, yc, fc, cq] of [['副阶', 14.55, 0.82, 0.5, 0.32], ['一层', 12.87, 0.9, 0.58, 0.38], ['五层', 10.46, 0.95, 0.6, 0.42]]) {
  const rEave = rl + yc + fc + cq;
  const chord = 2 * rEave * Math.sin(Math.PI / 8);
  const n = Math.max(8, Math.round(chord / TILE_SPACE));
  console.log(`${nm}: 檐口弦长 ${chord.toFixed(2)}m  瓦垄 ${n + 1} 道  中距 ${(chord / n * 100).toFixed(1)}cm  筒瓦宽 ${(TILE_R * 200).toFixed(1)}cm  盖瓦率 ${((TILE_R * 2) / (chord / n) * 100).toFixed(0)}%`);
}
