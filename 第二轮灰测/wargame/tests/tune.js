/* 平衡调参观测：批量 AI 对局的结局分布与关键指标终局分布 */
const S = require('../src/scenario.js');
const E = require('../src/engine.js');
const N = parseInt(process.argv[2] || '300', 10);
const tally = {}, codes = {};
const keys = ['esc', 'heu', 'redMissiles', 'intercept', 'usWill', 'irCohesion', 'ilMorale', 'oil', 'arabTilt', 'talks', 'hormuz', 'civ'];
const acc = {}; keys.forEach(k => acc[k] = []);
let turns = [];
for (let i = 0; i < N; i++) {
  const st = E.autoPlay(9000 + i);
  tally[st.over.winner] = (tally[st.over.winner] || 0) + 1;
  codes[st.over.code] = (codes[st.over.code] || 0) + 1;
  keys.forEach(k => acc[k].push(st.meters[k]));
  turns.push(st.turn);
}
const med = a => { const b = a.slice().sort((x, y) => x - y); return b[b.length >> 1]; };
const mean = a => (a.reduce((x, y) => x + y, 0) / a.length);
console.log('结局: ' + JSON.stringify(tally));
console.log('判定: ' + JSON.stringify(codes));
console.log('平均回合: ' + mean(turns).toFixed(1));
console.log('终局指标（中位数 / 均值）:');
keys.forEach(k => console.log('  ' + k.padEnd(13) + med(acc[k]).toString().padStart(6) + ' / ' + mean(acc[k]).toFixed(1)));
