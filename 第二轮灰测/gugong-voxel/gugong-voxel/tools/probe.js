/* =====================================================================
 * 紫禁城 体素模型 — 剖面探针（形制校验）
 *   node --max-old-space-size=6144 tools/probe.js
 * 打印关键单体的立面剖切图，用于核对：
 *   举架曲线（檐口平缓、脊部陡峻）、重檐腰檐、正脊垂脊、台基须弥座、
 *   庑殿（四坡无山花）/ 歇山（有山花博风）/ 攒尖（收于宝顶）/ 盝顶（平顶围脊）
 *   之间的差别，以及城墙垛口、角楼三重檐十字脊。
 * ===================================================================== */
'use strict';
const path = require('path');
const ROOT = path.join(__dirname, '..');
for (const f of ['00-palette', '10-voxel', '15-field', '20-arch', '25-comp',
                 '30-plan', '40-city', '50-outer', '60-inner', '70-build'])
  require(path.join(ROOT, 'js', f + '.js'));
const G = globalThis, B = G.GGPalette.BLOCK;
const res = G.BuildCity({ log: () => {} });
const v = res.world;

const CH = {};
const put = (ks, c) => ks.forEach(k => { CH[B[k]] = c; });
put(['TILE_Y', 'TILE_Y_D', 'TILE_Y_L'], 'y');      // 黄琉璃瓦面
put(['RIDGE'], 'R');                                // 正脊/垂脊
put(['RIDGE_G'], 'r');
put(['BEAST'], '8');                                // 走兽/套兽
put(['FINIAL', 'GILT'], '$');                       // 宝顶/鎏金
put(['TILE_G', 'TILE_G_D'], 'g'); put(['TILE_K'], 'k'); put(['TILE_ASH'], 'a');
put(['WALL_R', 'WALL_R_D'], 'H');                   // 墙身
put(['COL_R'], 'I');                                // 檐柱
put(['DOOR_R'], 'D'); put(['LATTICE'], 'x');        // 隔扇门 / 菱花心
put(['BEAM_B'], 'b'); put(['BEAM_G'], 'e');         // 额枋青 / 绿
put(['DOUGONG'], 'w');                              // 斗拱
put(['WOOD_D'], 'v');                               // 椽飞
put(['WALL_CITY', 'WALL_CITY_D'], 'C');
put(['BRICK', 'BRICK_D'], 'B');
put(['MARBLE', 'MARBLE_D'], '=');                   // 汉白玉
put(['RAIL'], 'i');                                 // 望柱栏板
put(['STONE'], 's');
put(['PAVE', 'PAVE_2', 'PAVE_W'], '_');
put(['WATER'], '~'); put(['SOIL', 'GRASS'], ',');
put(['LEAF', 'LEAF_D', 'LEAF_L'], 'T'); put(['TRUNK'], 't'); put(['ROCK'], '^');
put(['BRONZE', 'LION'], 'o');

/** 剖面：slab 厚度内取"最靠近剖切面且存在"的方块 */
function section(title, opt) {
  console.log('\n===== ' + title + ' =====');
  const { axis, at, slab, a0, a1, y0, y1, label } = opt;
  console.log('  剖切：' + (axis === 'x' ? 'x=' + at + '（南北向剖面，左南→右北，横轴 z）'
                                         : 'z=' + at + '（东西向剖面，左西→右东，横轴 x）'));
  const cols = [];
  for (let a = a0; a <= a1; a++) {
    const col = [];
    for (let y = y1; y >= y0; y--) {
      let id;
      for (let d = 0; d <= slab; d++) {
        const p = d === 0 ? 0 : (d % 2 ? Math.ceil(d / 2) : -Math.ceil(d / 2));
        id = axis === 'x' ? v.get(at + p, y, a) : v.get(a, y, at + p);
        if (id !== undefined) break;
      }
      col.push(id === undefined ? ' ' : (CH[id] || '?'));
    }
    cols.push(col);
  }
  for (let r = 0; r <= y1 - y0; r++) {
    let line = '';
    for (let c = 0; c < cols.length; c++) line += cols[c][r];
    console.log(String(y1 - r).padStart(3) + ' ' + line);
  }
  // 横轴刻度
  let t1 = '    ', t2 = '    ';
  for (let a = a0; a <= a1; a++) t1 += (a % 10 === 0 ? '|' : ' ');
  console.log(t1);
  let marks = '    ';
  for (let a = a0; a <= a1; a++) {
    if (a % 20 === 0) { const s = String(a); marks = marks.slice(0, 4 + (a - a0)) + s; a += s.length - 1; }
    else if (marks.length < 4 + (a - a0) + 1) marks += ' ';
  }
  console.log(marks);
  if (label) console.log('  ' + label);
}

console.log('图例：y 黄瓦  R 正脊/垂脊  8 走兽  $ 宝顶鎏金  g 绿瓦  k 黑瓦');
console.log('      H 墙身  I 檐柱  D 隔扇门  x 菱花心  b 额枋青  e 额枋绿  w 斗拱  v 椽飞');
console.log('      = 汉白玉  i 望柱栏板  s 青白石  C 城墙  B 城砖  _ 铺装  o 铜石  T 树');

section('太和殿 · 南北向剖面（重檐庐殿顶，验举架曲线与三台）', {
  axis: 'x', at: 0, slab: 6, a0: -180, a1: -40, y0: 0, y1: 40,
  label: '应见：三层台基叠落 → 月台 → 台明 → 下层柱枋斗拱 → 腰檐 → 上层 → 上檐四坡 → 正脊'
});
section('太和殿 · 东西向剖面（应为四坡收于一条正脊，无山花）', {
  axis: 'z', at: -90, slab: 8, a0: -52, a1: 52, y0: 6, y1: 40
});
section('保和殿 · 东西向剖面（重檐歇山：两端应有竖直山花与博风板）', {
  axis: 'z', at: 8, slab: 8, a0: -40, a1: 40, y0: 6, y1: 36
});
section('中和殿 · 东西向剖面（单檐四角攒尖：应收于一点并立宝顶）', {
  axis: 'z', at: -38, slab: 6, a0: -26, a1: 26, y0: 6, y1: 32
});
section('太和门 · 东西向剖面（重檐歇山）', {
  axis: 'z', at: -312, slab: 8, a0: -32, a1: 32, y0: 0, y1: 30
});
section('钦安殿 · 东西向剖面（重檐盝顶：顶部应为平顶加围脊，紫禁城唯一）', {
  axis: 'z', at: 381, slab: 5, a0: -20, a1: 20, y0: 0, y1: 24
});
section('午门 · 南北向剖面（城台 12 m + 正楼重檐庐殿）', {
  axis: 'x', at: 0, slab: 4, a0: -500, a1: -430, y0: 0, y1: 44
});
section('东南角楼 · 东西向剖面（三重檐十字脊，坐城墙墩台）', {
  axis: 'z', at: -475, slab: 8, a0: 348, a1: 394, y0: 0, y1: 36
});
section('城墙 · 东西向剖面（外侧雁翅垛口墙留射孔、内侧宇墙、收分）', {
  axis: 'x', at: -200, slab: 0, a0: -486, a1: -462, y0: 0, y1: 18,
  label: '横轴为 z：左侧为城外（南），右侧为城内（北）'
});
section('乾清宫 · 东西向剖面（重檐庐殿）', {
  axis: 'z', at: 200, slab: 8, a0: -38, a1: 38, y0: 0, y1: 28
});
section('文渊阁 · 东西向剖面（黑琉璃瓦绿剪边，面阔六间）', {
  axis: 'z', at: -186, slab: 6, a0: 168, a1: 212, y0: 0, y1: 24
});
