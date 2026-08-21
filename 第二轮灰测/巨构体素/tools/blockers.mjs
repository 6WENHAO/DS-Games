// 查清是谁在挡太阳：打印被遮挡点的遮挡物
import { createGenerator, CFG } from '../src/generator.js';
import { MAT } from '../src/palette.js';

const gen = createGenerator(861204);
for (const [, run] of gen.steps) run();
const w = gen.world;

const el = Number(process.argv[2] || 75), az = Number(process.argv[3] || 250);
const e = (el * Math.PI) / 180, a = (az * Math.PI) / 180;
const d = [Math.cos(e) * Math.sin(a), Math.sin(e), Math.cos(e) * Math.cos(a)];

function blocker(x, y, z) {
  for (let t = 1.5; t < 2600; t += 1.0) {
    const px = Math.floor(x + d[0] * t), py = Math.floor(y + d[1] * t), pz = Math.floor(z + d[2] * t);
    if (py > CFG.MAST_TOP + 8) return null;
    if (Math.abs(px) > 300 || Math.abs(pz) > 300) return null;
    const m = w.get(px, py, pz);
    if (m !== 0) return { px, py, pz, m, t };
  }
  return null;
}

const tally = new Map();
let n = 0, shadowed = 0;
const samples = [];
for (let x = -240; x <= 240; x += 7) {
  for (let z = -240; z <= 240; z += 7) {
    let top = null;
    for (let y = 320; y >= -30; y--) if (w.get(x, y, z) !== 0) { top = y; break; }
    if (top === null) continue;
    n++;
    const b = blocker(x + 0.5, top + 1.05, z + 0.5);
    if (b) {
      shadowed++;
      const key = `y≈${Math.round(b.py / 100) * 100} ${MAT[b.m].name}`;
      tally.set(key, (tally.get(key) || 0) + 1);
      if (samples.length < 12) samples.push(`  (${x},${z}) 顶面y=${top} → 遮挡 (${b.px},${b.py},${b.pz}) ${MAT[b.m].name} t=${b.t.toFixed(0)}`);
    }
  }
}
console.log(`el=${el}° az=${az}°  采样 ${n}，被遮挡 ${shadowed} (${(shadowed / n * 100).toFixed(1)}%)`);
console.log('遮挡物分类（按遮挡物高度/材质）:');
[...tally.entries()].sort((p, q) => q[1] - p[1]).slice(0, 14).forEach(([k, v]) => console.log(`  ${String(v).padStart(5)}  ${k}`));
console.log('样例:');
samples.forEach((s) => console.log(s));
