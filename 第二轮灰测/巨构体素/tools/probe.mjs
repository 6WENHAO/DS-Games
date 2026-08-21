// 探针：打印指定位置的体素柱，用于排查“出生点被堵”的问题
import { createGenerator } from '../src/generator.js';
import { MAT } from '../src/palette.js';

const gen = createGenerator(861204);
for (const [, run] of gen.steps) run();
const w = gen.world;

const spots = process.argv.slice(2);
const list = spots.length ? spots.map((s) => s.split(',').map(Number)) : [[-164, -164], [-160, -160], [-166, -166], [-164, 0], [0, 0]];

for (const [x, z] of list) {
  const col = [];
  for (let y = -2; y <= 14; y++) {
    const m = w.get(x, y, z);
    col.push(`${y}:${m ? MAT[m].name : '·'}`);
  }
  console.log(`(${x},${z})  ${col.join(' ')}`);
}
