/* 临时：打印关键平衡数值，便于人工核对 */
'use strict';
const fs = require('fs'), vm = require('vm');
const sb = { Math, Object, console, isFinite, parseInt, parseFloat, Map, Set, Array, String, Number };
sb.window = sb; sb.globalThis = sb;
sb.document = { createElement: () => ({ getContext: () => null, style: {} }) };
const cx = vm.createContext(sb);
vm.runInContext(fs.readFileSync('js/util.js', 'utf8'), cx);
vm.runInContext(fs.readFileSync('js/config.js', 'utf8'), cx);
const R = sb.R;

console.log('== 建筑 ==');
for (const k in R.BUILDINGS) {
  const d = R.BUILDINGS[k];
  console.log('  ' + d.name.padEnd(7) + ' hp' + String(d.hp).padStart(5) +
    '  $' + String(d.cost).padStart(4) + '  ' + d.build + 's  电' + String(d.power).padStart(5) +
    '  ' + d.size.w + 'x' + d.size.h);
}
console.log('== 武器对建筑倍率（攻城效率）==');
const rows = [];
for (const k in R.WEAPONS) {
  const w = R.WEAPONS[k];
  const dps = w.dmg * (w.burst || 1) / Math.max(0.1, w.cd + (w.burst ? (w.burst - 1) * (w.burstGap || 0) : 0));
  rows.push([k, w.name, dps, w.vs.building === undefined ? 1 : w.vs.building, dps * (w.vs.building === undefined ? 1 : w.vs.building)]);
}
rows.sort((a, b) => b[4] - a[4]);
for (const r of rows) {
  console.log('  ' + r[1].padEnd(11) + ' 原始DPS' + r[2].toFixed(1).padStart(6) +
    '  建筑倍率' + String(r[3]).padStart(5) + '  → 拆建筑DPS' + r[4].toFixed(1).padStart(6));
}
console.log('== 拆一座 3000hp 建造厂需要的秒数（单个单位）==');
for (const id of ['grizzly', 'rhino', 'apoc', 'artillery', 'flamer', 'rocketeer', 'rifleman', 'gunship']) {
  const u = R.UNITS[id];
  if (!u || !u.weapon) continue;
  const w = R.WEAPONS[u.weapon];
  const dps = w.dmg * (w.burst || 1) / Math.max(0.1, w.cd + (w.burst ? (w.burst - 1) * (w.burstGap || 0) : 0));
  const eff = dps * (w.vs.building === undefined ? 1 : w.vs.building);
  console.log('  ' + u.name.padEnd(7) + ' ' + (3000 / eff).toFixed(0).padStart(5) + 's' +
    '　10 个一起：' + (3000 / eff / 10).toFixed(1) + 's');
}
console.log('== 单位对拼（原始DPS / 对重甲 / 对步兵）==');
for (const id of ['rifleman', 'rocketeer', 'sniper', 'flamer', 'lightTank', 'grizzly', 'rhino', 'apoc', 'artillery', 'flakTrack', 'gunship']) {
  const u = R.UNITS[id];
  if (!u || !u.weapon) continue;
  const w = R.WEAPONS[u.weapon];
  const dps = w.dmg * (w.burst || 1) / Math.max(0.1, w.cd + (w.burst ? (w.burst - 1) * (w.burstGap || 0) : 0));
  console.log('  ' + u.name.padEnd(7) + ' $' + String(u.cost).padStart(4) + ' hp' + String(u.hp).padStart(5) +
    ' 射程' + String(w.range).padStart(5) +
    ' DPS' + dps.toFixed(1).padStart(6) +
    ' 对重甲' + (dps * R.armorMul(w, 'heavy')).toFixed(1).padStart(6) +
    ' 对步兵' + (dps * R.armorMul(w, 'infantry')).toFixed(1).padStart(6) +
    ' 性价比(对重甲/百元)' + (dps * R.armorMul(w, 'heavy') / u.cost * 100).toFixed(2).padStart(6));
}
