// 查出把体素写到 |x|,|z| > 260 或 y < -200 的调用点
import { createGenerator } from '../src/generator.js';

const gen = createGenerator(861204);
const w = gen.world;
const LIM = 258;
let hits = 0;
const seen = new Set();

function check(x0, y0, z0, x1, y1, z1, tag) {
  if (x0 < -LIM || x1 > LIM || z0 < -LIM || z1 > LIM || y0 < -200) {
    const st = new Error().stack.split('\n').slice(3, 6).join(' | ');
    if (!seen.has(st)) {
      seen.add(st);
      console.log(`\n[${tag}] box=(${x0},${y0},${z0})..(${x1},${y1},${z1})\n${st}`);
    }
    hits++;
  }
}

const origFill = w.fillBox.bind(w);
w.fillBox = (x0, y0, z0, x1, y1, z1, m) => { if (m !== 0) check(x0, y0, z0, x1, y1, z1, 'fillBox'); return origFill(x0, y0, z0, x1, y1, z1, m); };
const origSetC = w.setC.bind(w);
w.setC = (x, y, z, m) => { if (m !== 0) check(x, y, z, x, y, z, 'setC'); return origSetC(x, y, z, m); };

for (const [label, run] of gen.steps) run();
console.log('\n越界写入次数:', hits);
