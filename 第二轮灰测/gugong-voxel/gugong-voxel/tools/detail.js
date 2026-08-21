/* 细节抽查：坤宁宫烟囱与口袋房门位、城门门扇、攒尖走兽 */
'use strict';
const path = require('path');
const ROOT = path.join(__dirname, '..');
for (const f of ['00-palette', '10-voxel', '15-field', '20-arch', '25-comp',
                 '30-plan', '40-city', '50-outer', '60-inner', '70-build'])
  require(path.join(ROOT, 'js', f + '.js'));
const G = globalThis, B = G.GGPalette.BLOCK, L = G.GGPalette.LIST, P = G.Plan;
const r = G.BuildCity({ log: () => {} }), v = r.world;
const KZ = P.AXIS.kunninggong;

function topAt(x, z) {
  for (let y = 45; y >= 0; y--) { const id = v.get(x, y, z); if (id !== undefined) return y + ' ' + L[id].name; }
  return '0 空';
}
console.log('=== 坤宁宫 · 烟囱（紫禁城主要殿座中唯一） ===');
console.log('  烟囱顶 (16,' + (KZ + 2) + ') : ' + topAt(16, KZ + 2));
console.log('  烟囱顶 (17,' + (KZ + 3) + ') : ' + topAt(17, KZ + 3));
console.log('  正脊顶 ( 0,' + KZ + ') : ' + topAt(0, KZ));
console.log('  屋面   (16,' + (KZ - 2) + ') : ' + topAt(16, KZ - 2));

console.log('\n=== 坤宁宫 · 口袋房门位（南立面墙线 z=' + (KZ - 10 + 1) + '） ===');
const zf = KZ - 10 + 1;
for (const y of [4, 6, 8]) {
  let row = '';
  for (let x = -22; x <= 22; x++) {
    const id = v.get(x, y, zf);
    row += id === undefined ? '.' :
      (id === B.WALL_R || id === B.WALL_R_D) ? 'H' :
      id === B.DOOR_R ? 'D' : id === B.LATTICE ? 'x' : id === B.COL_R ? 'I' : '?';
  }
  console.log('  y=' + y + '  ' + row);
}
console.log('        ' + ' '.repeat(24) + '^^^^^^^ 仅此处（x=+2..+8）留门，其余砌实墙');

console.log('\n=== 城门实榻大门门扇（D 门板 / | 门缝 / $ 铺首） ===');
[['午门中门  ', 0, P.WUMEN.main.z0 + 12, 'z'],
 ['神武门中门', 0, P.SHENWUMEN.z0 + 14, 'z']].forEach(q => {
  let s = '';
  for (let x = -4; x <= 4; x++) {
    const id = v.get(x, 5, q[2]);
    s += id === undefined ? '.' : id === B.DOOR_R ? 'D' : id === B.GILT ? '$' : id === B.WOOD_D ? '|' : '#';
  }
  console.log('  ' + q[0] + ' z=' + q[2] + '  ' + s);
});
['东华门', '西华门'].forEach((nm, i) => {
  const g = i === 0 ? P.DONGHUAMEN : P.XIHUAMEN;
  const plane = i === 0 ? g.x0 + 14 : g.x1 - 14;
  let s = '';
  for (let z = -204; z <= -196; z++) {
    const id = v.get(plane, 5, z);
    s += id === undefined ? '.' : id === B.DOOR_R ? 'D' : id === B.GILT ? '$' : id === B.WOOD_D ? '|' : '#';
  }
  console.log('  ' + nm + '    x=' + plane + '  ' + s);
});

console.log('\n=== 攒尖顶垂脊走兽 ===');
let n1 = 0, n2 = 0;
for (let x = -20; x <= 20; x++) for (let z = -58; z <= -18; z++) for (let y = 10; y <= 32; y++)
  if (v.get(x, y, z) === B.BEAST) n1++;
for (let x = -12; x <= 12; x++) for (let z = 226; z <= 250; z++) for (let y = 4; y <= 22; y++)
  if (v.get(x, y, z) === B.BEAST) n2++;
console.log('  中和殿区域 ' + n1 + ' 个   交泰殿区域 ' + n2 + ' 个');

console.log('\n=== 储秀宫阶前铜龙铜鹿 ===');
let n3 = 0;
const col = P.INNER_COL.wIn, row = P.INNER_ROW[3];
for (let x = col.x0; x <= col.x1; x++) for (let z = row.z0; z <= row.z1; z++) for (let y = 1; y <= 10; y++)
  if (v.get(x, y, z) === B.BRONZE) n3++;
console.log('  储秀宫院内铜制方块数 ' + n3);
