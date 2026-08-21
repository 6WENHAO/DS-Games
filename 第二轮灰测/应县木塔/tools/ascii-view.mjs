// ---------------------------------------------------------------------------
// 几何投影字符图：直接从模型顶点投影出正立面 / 平面 / 局部放大图，
// 用来在无图形界面的条件下核对建筑构成（层数、出檐、收分、八角平面…）
//   node tools/ascii-view.mjs [elev|plan|zoom] [x0 x1 y0 y1]
// ---------------------------------------------------------------------------
import { register } from 'node:module';
register('./three-hooks.mjs', import.meta.url);
await import('./dom-stub.mjs');

const THREE = await import('three');
const { buildPagoda } = await import('../src/pagoda/pagoda.js');

const mode = process.argv[2] || 'elev';
const { group } = buildPagoda();
group.updateMatrixWorld(true);

/* 收集世界坐标点（按材质分类，用不同字符表示） */
const CHAR = {
  柱: 'H',
  内槽柱: 'H',
  枋: '=',
  拱: 'x',
  斗: 'o',
  昂: '/',
  梁: '-',
  椽: '.',
  板: ':',
  斜撑: '\\',
  榫头: '+',
  台基石: '#',
  压阑石: '#',
  柱础: '#',
  筒瓦: '^',
  脊瓦: '^',
  拱眼壁: '`',
  板壁: '`',
  板门: 'D',
  勾栏: 'r',
  铁件: 'I',
  鎏金: '*',
  地面: ' ',
};
const pts = [];
const v = new THREE.Vector3();
const m = new THREE.Matrix4();
group.traverse((o) => {
  if (!o.isMesh) return;
  const ch = CHAR[o.material.name] ?? '?';
  if (ch === ' ') return;
  const pos = o.geometry.attributes.position;
  const step = Math.max(1, Math.floor(pos.count / 12000)); // 抽样
  const insts = o.isInstancedMesh ? o.count : 1;
  for (let k = 0; k < insts; k++) {
    if (o.isInstancedMesh) {
      o.getMatrixAt(k, m);
      m.premultiply(o.matrixWorld);
    } else m.copy(o.matrixWorld);
    for (let i = 0; i < pos.count; i += step) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m);
      pts.push(v.x, v.y, v.z, ch.charCodeAt(0));
    }
  }
});
console.log(`采样点 ${(pts.length / 4).toLocaleString()}`);

function draw(ax, ay, W, H, x0, x1, y0, y1, flipY = true, title = '', slice = null) {
  const grid = new Array(W * H).fill(' ');
  const prio = ' .:`^-=xo/\\+rDHI*#?';
  for (let i = 0; i < pts.length; i += 4) {
    const a = pts[i + ax];
    const b = pts[i + ay];
    if (a < x0 || a > x1 || b < y0 || b > y1) continue;
    if (slice) {
      const s = pts[i + slice.axis];
      if (s < slice.min || s > slice.max) continue;
    }
    const cx = Math.floor(((a - x0) / (x1 - x0)) * (W - 1));
    const cyRaw = ((b - y0) / (y1 - y0)) * (H - 1);
    const cy = flipY ? H - 1 - Math.floor(cyRaw) : Math.floor(cyRaw);
    const idx = cy * W + cx;
    const c = String.fromCharCode(pts[i + 3]);
    if (prio.indexOf(c) > prio.indexOf(grid[idx])) grid[idx] = c;
  }
  console.log(`\n${title}  横[${x0},${x1}] 竖[${y0},${y1}]${slice ? ` 切片 ${'xyz'[slice.axis]}∈[${slice.min},${slice.max}]` : ''}`);
  const ruler = (yv) => yv.toFixed(0).padStart(3);
  for (let r = 0; r < H; r++) {
    const yv = flipY ? y1 - ((r + 0.5) / H) * (y1 - y0) : y0 + ((r + 0.5) / H) * (y1 - y0);
    console.log(`${ruler(yv)}│${grid.slice(r * W, r * W + W).join('')}│`);
  }
  console.log('    └' + '─'.repeat(W) + '┘');
}

const num = (i, d) => (process.argv[i] !== undefined ? Number(process.argv[i]) : d);
if (mode === 'elev') {
  draw(0, 1, 108, 54, -22, 22, -5, 68, true, '正立面（x-y）');
} else if (mode === 'plan') {
  draw(0, 2, 96, 48, -20, 20, -20, 20, false, '底层平面（x-z）');
} else if (mode === 'sect') {
  // 沿塔轴纵剖（只取 |x| < 1.3 的点）
  draw(2, 1, 108, 56, -18, 18, -5, 68, true, '纵剖面（z-y）', { axis: 0, min: -1.3, max: 1.3 });
} else if (mode === 'zoom') {
  draw(2, 1, 112, 44, num(3, 8), num(4, 16), num(5, 7), num(6, 12), true, '出檐局部（z-y）', {
    axis: 0,
    min: num(7, -1.6),
    max: num(8, 1.6),
  });
} else if (mode === 'plan5') {
  draw(0, 2, 96, 48, -14, 14, -14, 14, false, '上层平面（x-z）');
}
