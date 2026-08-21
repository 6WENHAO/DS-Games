/* 开发用：统计内容规模 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
global.window = global; global.addEventListener = () => { };
global.document = { readyState: 'loading', createElement: () => ({ style: {}, classList: { add() { }, remove() { }, toggle() { }, contains() { } }, appendChild() { }, addEventListener() { }, querySelector: () => null, querySelectorAll: () => [] }), addEventListener() { }, querySelector: () => null, querySelectorAll: () => [] };
['util', 'svg', 'data-powers', 'data-cards', 'data-relics', 'data-potions', 'data-enemies', 'data-events'].forEach(f => {
  vm.runInThisContext(fs.readFileSync(path.join(ROOT, 'js', f + '.js'), 'utf8'), { filename: f });
});
vm.runInThisContext(`
const byType = {};
Object.keys(CARDS).forEach(k => { const t = CARDS[k].type; byType[t] = (byType[t]||0)+1; });
const byRar = {};
Object.keys(CARDS).forEach(k => { const t = CARDS[k].rarity; byRar[t] = (byRar[t]||0)+1; });
console.log('卡牌总数：' + Object.keys(CARDS).length, JSON.stringify(byType), JSON.stringify(byRar));
console.log('遗物：' + Object.keys(RELICS).length + '　药水：' + Object.keys(POTIONS).length +
  '　敌人：' + Object.keys(ENEMIES).length + '　事件：' + Object.keys(EVENTS).length +
  '　能力状态：' + Object.keys(POWERS).length);
let mv = 0; Object.keys(ENEMIES).forEach(k => mv += Object.keys(ENEMIES[k].moves).length);
console.log('敌人招式总数：' + mv);
`, { filename: 'counts' });
