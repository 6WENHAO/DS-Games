// tools/bench.mjs —— 帧率体检：纯 JS 逐像素渲染器到底跑得动吗
import { compile, setCell } from '../src/world/compile.js';
import { ZONE_DEFS, ZONE_ORDER } from '../src/world/zones.js';
import { Renderer } from '../src/gfx/raycast.js';
import { animateProps } from '../src/gfx/props.js';

const RES = [[320, 180], [384, 216], [480, 270]];
const N = 60;

console.log('分辨率'.padEnd(12), ZONE_ORDER.map((z) => z.padEnd(7)).join(''), '  平均');
for (const [W, H] of RES) {
  const r = new Renderer(W, H);
  const row = [];
  for (const id of ZONE_ORDER) {
    const def = ZONE_DEFS[id];
    const world = compile(def);
    for (const [x, y, ch] of def.checkOpen || []) setCell(world, x, y, ch);
    for (const l of world.lights) l.on = true;
    const cam = { x: def.spawn.x, y: def.spawn.y, a: def.spawn.a, fov: 1.16, ez: 1.62, pitch: 0 };
    // 预热
    for (let i = 0; i < 6; i++) { animateProps(i * 0.1); r.render(world, cam, { time: i * 0.1 }); }
    const t0 = process.hrtime.bigint();
    for (let i = 0; i < N; i++) {
      cam.a += 0.02;
      animateProps(i * 0.05);
      r.render(world, cam, { time: i * 0.05, grain: 6.5, warm: 1.3, sat: 1.06 });
    }
    const ms = Number(process.hrtime.bigint() - t0) / 1e6 / N;
    row.push(ms);
  }
  const avg = row.reduce((a, b) => a + b, 0) / row.length;
  console.log(
    `${W}×${H}`.padEnd(12),
    row.map((ms) => `${ms.toFixed(1)}ms`.padEnd(7)).join(''),
    ` ${avg.toFixed(1)}ms ≈ ${Math.round(1000 / avg)} fps`
  );
}
console.log('\n（Node 与浏览器 JIT 接近，可作参考；浏览器另有 putImageData 的开销）');
