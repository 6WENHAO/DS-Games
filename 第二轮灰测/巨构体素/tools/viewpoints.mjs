/**
 * 视点体检 / 候选点扫描：
 * 逐个候选位置计算 地面高度 / 头顶净空 / 八向水平净空 / 是否见天 / 上方遮盖高度，
 * 用来客观地挑选第一视角的出生点（避免出生在实体里或封闭的箱子里）。
 */
import { createGenerator, CFG } from '../src/generator.js';

const gen = createGenerator(861204);
for (const [, run] of gen.steps) run();
const w = gen.world;

function metrics(x, z, yHint = 3) {
  x = Math.round(x); z = Math.round(z);
  // 找地面
  let floor = null;
  for (let y = yHint + 30; y >= -220; y--) {
    if (w.get(x, y, z) !== 0) { floor = y + 1; break; }
  }
  if (floor === null) floor = -220;
  // 站立空间
  let stand = 0;
  for (let i = 0; i < 8; i++) { if (w.get(x, floor + i, z) !== 0) break; stand++; }
  const eye = floor + 2;
  // 头顶净空 / 覆盖高度
  let ceil = null;
  for (let y = floor + 1; y < 1500; y++) {
    if (w.get(x, y, z) !== 0) { ceil = y; break; }
  }
  // 八向水平净空
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  const clear = dirs.map(([dx, dz]) => {
    for (let d = 1; d <= 90; d++) {
      if (w.get(x + dx * d, eye, z + dz * d) !== 0) return d;
    }
    return 90;
  });
  const openH = clear.reduce((a, b) => a + b, 0) / clear.length;
  return { x, z, floor, stand, ceil: ceil === null ? '天' : ceil, openH: +openH.toFixed(1), clear };
}

const args = process.argv.slice(2);
if (args.length >= 2 && args[0] === 'at') {
  for (let i = 1; i < args.length; i++) {
    const [x, z] = args[i].split(',').map(Number);
    console.log(JSON.stringify(metrics(x, z)));
  }
} else if (args[0] === 'vp') {
  console.log('—— 当前视点体检 ——');
  for (const v of gen.data.viewpoints.filter((v) => v.mode === 'fps')) {
    const m = metrics(v.pos[0], v.pos[2], v.pos[1]);
    console.log(`${v.name.padEnd(20)} floor=${String(m.floor).padStart(5)} stand=${m.stand} ceil=${String(m.ceil).padStart(5)} open=${String(m.openH).padStart(5)}  clear=${m.clear.join(',')}`);
  }
} else {
  // 扫描各类候选
  const report = (title, list) => {
    console.log('\n== ' + title + ' ==');
    const rows = list.map(([x, z]) => metrics(x, z))
      .filter((m) => m.stand >= 4)
      .sort((a, b) => b.openH - a.openH);
    for (const m of rows.slice(0, 8)) {
      console.log(`  (${String(m.x).padStart(5)},${String(m.z).padStart(5)}) floor=${String(m.floor).padStart(4)} ceil=${String(m.ceil).padStart(5)} open=${String(m.openH).padStart(5)} clear=${m.clear.join(',')}`);
    }
  };

  const O = CFG.OFFSET_AVE;
  report('偏轴大道 · 进城（z=-62 一线）',
    [-244, -232, -220, -206, -192, -176, -160, -144, -128, -112, -100].map((x) => [x, -O]));
  report('中轴 · 巨门（z=2 一线）',
    [-246, -240, -234, -228, -222].map((x) => [x, 2]));
  report('巨核广场',
    [[-82, 34], [-78, 60], [-60, -62], [-70, 70], [-84, 0], [-62, 62], [62, 62], [-40, 76]]);
  const canopy = [];
  for (let x = -212; x <= 212; x += 4) {
    for (let z = -212; z <= 212; z += 4) {
      const c = Math.max(Math.abs(x), Math.abs(z));
      if (c < 130 || c > 208) continue;
      canopy.push([x, z]);
    }
  }
  const canopyM = canopy.map(([x, z]) => metrics(x, z))
    .filter((m) => m.stand >= 4 && m.ceil !== '天' && m.ceil >= 100 && m.ceil <= 140 && m.openH > 30)
    .sort((a, b) => b.openH - a.openH);
  console.log('\n== 天盖之下（要求头顶 100~140 有天盖、水平开阔）==');
  for (const m of canopyM.slice(0, 10)) {
    console.log(`  (${String(m.x).padStart(5)},${String(m.z).padStart(5)}) floor=${String(m.floor).padStart(4)} ceil=${String(m.ceil).padStart(5)} open=${String(m.openH).padStart(5)} clear=${m.clear.join(',')}`);
  }
  report('深渊边缘',
    [[142, -196], [146, -196], [144, -170], [144, -220], [170, -144], [196, -144]]);
  console.log('\n== 巨跨甲板 ==');
  for (const x of [70, 84, 96, 104, 118, 130]) {
    const m = metrics(x, 0, 224);
    console.log(`  (${x},0) floor=${m.floor} stand=${m.stand} ceil=${m.ceil} open=${m.openH}`);
  }
  console.log('\n== 云上环廊 ==');
  for (const [x, z] of [[-46, 0], [-44, 20], [0, -46], [-40, -40], [-50, 0]]) {
    const m = metrics(x, z, CFG.PLATFORM_Y[5] + 12);
    console.log(`  (${x},${z}) floor=${m.floor} stand=${m.stand} ceil=${m.ceil} open=${m.openH}`);
  }
}
