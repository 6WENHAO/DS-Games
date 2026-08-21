const MESH = require('../src/mesh.js');
let fails = 0;
const ok = (c, m) => { if (!c) { console.log('FAIL: ' + m); fails++; } else console.log('ok  : ' + m); };
const bbox = g => {
  const b = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9];
  for (let i = 0; i < g.pos.length; i += 3) {
    for (let k = 0; k < 3; k++) { b[k] = Math.min(b[k], g.pos[i + k]); b[k + 3] = Math.max(b[k + 3], g.pos[i + k]); }
  }
  return b;
};
const finite = g => [g.pos, g.nrm, g.col, g.mat].every(a => a.every(v => isFinite(v)));
const normUnit = g => { for (let i = 0; i < g.nrm.length; i += 3) { const l = Math.hypot(g.nrm[i], g.nrm[i+1], g.nrm[i+2]); if (Math.abs(l - 1) > 0.02) return false; } return true; };

// 1. 球：包围盒 = 直径，法线单位化，顶点均在球面上
{
  const b = MESH.createBuilder(); b.part('sphere', 'test').sphere(1.5, 24, 16);
  const g = b.build();
  const bb = bbox(g);
  ok(Math.abs(bb[3] - 1.5) < 0.02 && Math.abs(bb[0] + 1.5) < 0.02, '球体包围盒等于直径');
  ok(normUnit(g), '球体法线均为单位向量');
  let onSphere = true;
  for (let i = 0; i < g.pos.length; i += 3) if (Math.abs(Math.hypot(g.pos[i], g.pos[i+1], g.pos[i+2]) - 1.5) > 0.02) onSphere = false;
  ok(onSphere, '球体顶点全部落在球面上');
  ok(g.stats.curvedRatio === 1, '球体计入曲面三角形');
}
// 2. 变换栈
{
  const b = MESH.createBuilder();
  b.push(); b.translate(3, 0, 0); b.part('box', 'test').box(1, 1, 1); b.endPart(); b.pop();
  b.part('box2', 'test').box(1, 1, 1);
  const g = b.build();
  const p = g.parts.find(x => x.name === 'box');
  ok(Math.abs((p.bbox[0] + p.bbox[3]) / 2 - 3) < 1e-6, '变换栈正确应用平移（部件中心 x=3）');
  const bb = bbox(g);
  ok(Math.abs(bb[0] + 0.5) < 1e-6 && Math.abs(bb[3] - 3.5) < 1e-6, 'pop 后恢复原变换');
}
// 3. 缩放下的法线（逆转置）
{
  const b = MESH.createBuilder();
  b.scale(1, 4, 1); b.part('s').sphere(1, 16, 10);
  const g = b.build();
  ok(normUnit(g), '非均匀缩放后法线仍为单位向量');
  // 椭球顶部法线应近似 +Y
  let top = null;
  for (let i = 0; i < g.pos.length; i += 3) if (!top || g.pos[i+1] > g.pos[top+1]) top = i;
  ok(g.nrm[top+1] > 0.9, '椭球顶点法线朝上（逆转置法线矩阵正确）');
}
// 4. 旋成体与管
{
  const b = MESH.createBuilder();
  b.part('lathe').lathe([[0, 0], [0.5, 0], [0.5, 1], [0.2, 1.4], [0, 1.4]], 24);
  b.part('tube').tube(MESH.spline([[0,0,0],[1,1,0],[2,0,1],[3,1,1]], 8), 0.1, 10, { caps: true });
  b.part('helix').helixTube(0.4, 0.05, 4, 1.2, 24, 8);
  const g = b.build();
  ok(finite(g), '旋成体/管/螺旋管无非法数值');
  ok(normUnit(g), '旋成体/管法线单位化');
  const lp = g.parts.find(p => p.name === 'lathe');
  ok(Math.abs(lp.bbox[4] - 1.4) < 1e-6 && Math.abs(lp.bbox[3] - 0.5) < 1e-6, '旋成体尺寸符合轮廓');
  const hp = g.parts.find(p => p.name === 'helix');
  ok(hp.tris > 400, `螺旋管三角形数 ${hp.tris}（冷凝管盘管）`);
}
// 5. 轮廓挤出 + 分组
{
  const b = MESH.createBuilder();
  const prof = MESH.roundRectProfile(2.4, 1.8, 0.3, 4, 1);
  b.group('shell').part('body').extrudeProfile(prof, -3, 3, {
    steps: 6, capStart: true, capEnd: true,
    groupFn: (a) => (a[0] > 0.6 ? 'wallNear' : a[0] < -0.6 ? 'wallFar' : 'shell')
  });
  const g = b.build();
  ok(!!g.groupRanges.wallNear && !!g.groupRanges.wallFar, '挤出时按轮廓段自动分组（近侧/远侧墙）');
  ok(g.groupRanges.wallNear.count > 0 && g.groupRanges.wallFar.count > 0, '近侧/远侧墙都有三角形，可用于剖切');
  const bb = bbox(g);
  ok(Math.abs(bb[0] + 3) < 1e-6 && Math.abs(bb[3] - 3) < 1e-6, '挤出长度正确');
  ok(g.stats.curvedRatio > 0.9, '圆角轮廓挤出以曲面为主');
}
// 6. 圆角盒的曲面比例与法线多样性
{
  const b = MESH.createBuilder();
  b.part('rb').roundedBox(1, 0.6, 2, 0.15, 4);
  const g = b.build();
  const set = new Set();
  for (let i = 0; i < g.nrm.length; i += 3) set.add([g.nrm[i], g.nrm[i+1], g.nrm[i+2]].map(v => v.toFixed(2)).join(','));
  ok(set.size > 60, `圆角盒法线方向数 ${set.size} > 60（不是 6 个面的方块）`);
  ok(g.stats.curvedRatio > 0.6, `圆角盒曲面三角形占比 ${(g.stats.curvedRatio * 100).toFixed(0)}%`);
}
// 7. 顶点扰动
{
  const b = MESH.createBuilder();
  b.part('p').plane(4, 4, 8, 8);
  const before = b.vertexCount();
  b.distortLast(before, 0.05, 3, 1);
  const g = b.build();
  let maxY = 0; for (let i = 1; i < g.pos.length; i += 3) maxY = Math.max(maxY, Math.abs(g.pos[i]));
  ok(maxY > 0.005 && maxY < 0.06, `顶点扰动生效且幅度受控（最大 ${maxY.toFixed(3)}）`);
}
console.log(fails === 0 ? '\n几何库测试全部通过' : '\n失败 ' + fails + ' 项');
process.exit(fails ? 1 : 0);
