/**
 * headless-test.mjs — 无头回归推演
 * 用法: node tools/headless-test.mjs [scenarioId] [days] [dt]
 * 校验: 引擎可完整跑完战役、无异常、各子系统均产生输出
 */
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(import.meta.dirname, '..');
globalThis.window = globalThis;

for (const f of ['geodata', 'equipment', 'theater', 'oob', 'scenarios', 'engine', 'ai']) {
  require(path.join(ROOT, 'js', f + '.js'));
}
const TWG = globalThis.TWG;

const scId = process.argv[2] || 'invasion';
const days = Number(process.argv[3] || 0) || null;
const dt = Number(process.argv[4] || 20);

const sc = TWG.SCENARIOS[scId];
if (!sc) { console.error('unknown scenario', scId, Object.keys(TWG.SCENARIOS)); process.exit(1); }

console.log('='.repeat(78));
console.log('剧本:', sc.name);
console.log('装备库: 平台', Object.keys(TWG.PLATFORMS).length, '型 / 武器', Object.keys(TWG.WEAPONS).length, '型');
console.log('战场: 机场', TWG.THEATER.AIRBASES.length, '/ 港口', TWG.THEATER.PORTS.length,
  '/ 滩头', TWG.THEATER.BEACHES.length, '/ 关键节点', TWG.THEATER.KEYSITES.length);
console.log('='.repeat(78));

const E = new TWG.Engine({ scenario: sc, seed: 20250401 });
const maxT = (days || sc.maxDays) * 86400;
const t0 = Date.now();
let steps = 0, errors = [];

E.onEvent = (e) => {
  if (e.kind === 'critical' || e.kind === 'phase' || e.kind === 'end') {
    console.log(`[${e.clock}] ${e.side || '--'} ${e.text}`);
  }
};

try {
  while (E.t < maxT && !E.ended) {
    E.step(dt);
    steps++;
    if (steps % 20000 === 0) {
      const s = E.score();
      console.log(`  ... ${E.clock()}  制空 ${(s.air * 100).toFixed(0)}%  制海 ${(s.sea * 100).toFixed(0)}%` +
        `  单位 ${E.units.filter(u => !u.dead).length}  飞行体 ${E.proj.length}` +
        `  PLA损失(机/舰) ${E.sides.PLA.losses.air}/${E.sides.PLA.losses.ship}` +
        `  ROC损失(机/舰) ${E.sides.ROC.losses.air + E.sides.ROC.losses.aircraftGround}/${E.sides.ROC.losses.ship}`);
    }
  }
} catch (err) {
  errors.push(err);
  console.error('\n!!! 运行异常 @', E.clock(), 'step', steps);
  console.error(err);
}

const ms = Date.now() - t0;
console.log('-'.repeat(78));
console.log(`推演步数 ${steps}  耗时 ${ms} ms  (${(steps / (ms / 1000)).toFixed(0)} step/s)`);
const S = E.score();
console.log(`结束时间 ${E.clock()}`);
console.log(`制空权指数 PLA ${(S.air * 100).toFixed(1)}%   制海权指数 PLA ${(S.sea * 100).toFixed(1)}%`);
console.log(`战役评分  PLA ${S.pla.toFixed(1)} : ROC ${S.roc.toFixed(1)}`);
console.log('损失统计:');
for (const s of ['PLA', 'ROC', 'US', 'JP']) {
  const L = E.sides[s].losses;
  if (!E.sides[s].active && s !== 'PLA' && s !== 'ROC') continue;
  console.log(`  ${s}: 空中 ${L.air} 架 / 地面被毁 ${L.aircraftGround} 架 / 舰艇 ${L.ship} 艘 / 潜艇 ${L.sub} 艘 / 地面部队 ${L.ground} 个单位` +
    ` | 出动 ${E.sides[s].sorties} 架次 | 发射导弹 ${E.sides[s].missilesFired} 枚 (命中 ${E.sides[s].missilesHit})`);
}
console.log(`拦截总数 ${E.counters.intercepts} 枚 / 齐射次数 ${E.counters.salvos}`);
const bh = Object.entries(E.beachheads);
console.log(`登陆场 ${bh.length} 处:`);
for (const [k, b] of bh) {
  const nm = (TWG.THEATER.idx.beach[k] || {}).name || k;
  console.log(`  ${nm}: ${b.active ? '活动' : '已崩溃'} 兵力 ${Math.round(b.troops)} 人 / 战力 ${b.cp.toFixed(0)}` +
    ` / 补给 ${(b.supply * 100).toFixed(0)}% / 突破 ${b.breakout ? '是' : '否'} / 推进 ${(b.advance || 0).toFixed(0)}km` +
    ` / 交换比 PLA ${Math.round(b.plaLoss || 0)} : ROC ${Math.round(b.rocLoss || 0)}`);
}
const capt = Object.keys(E.captured);
console.log('被攻占目标 ' + capt.length + (capt.length ? ': ' + capt.join(', ') : ''));
console.log('台军机场平均可用率 ' + (E.baseOpsAvg('ROC') * 100).toFixed(1) + '%   解放军 ' + (E.baseOpsAvg('PLA') * 100).toFixed(1) + '%');
console.log('事件总数 ' + E.log.length + '  采样点 ' + E.stats.length);
if (E.ended) console.log('判定: ' + (E.ended.winner || '僵持') + ' — ' + E.ended.why);

/* --- 子系统健康检查 --- */
const checks = [];
function chk(name, ok, extra) { checks.push({ name, ok, extra }); }
chk('引擎无异常', errors.length === 0, errors.length ? String(errors[0]).slice(0, 120) : '');
chk('导弹发射链路', E.sides.PLA.missilesFired > 100, 'PLA fired=' + E.sides.PLA.missilesFired);
chk('台军反击链路', E.sides.ROC.missilesFired > 10, 'ROC fired=' + E.sides.ROC.missilesFired);
chk('防空拦截链路', E.counters.intercepts > 5, 'intercepts=' + E.counters.intercepts);
chk('航空出动链路', E.sides.PLA.sorties > 50 && E.sides.ROC.sorties > 10,
  'PLA=' + E.sides.PLA.sorties + ' ROC=' + E.sides.ROC.sorties);
chk('机场毁伤链路', E.baseOpsAvg('ROC') < 0.98, 'rocOps=' + E.baseOpsAvg('ROC').toFixed(2));
chk('水面战毁伤链路', E.sides.ROC.losses.ship + E.sides.PLA.losses.ship > 0,
  'ships lost PLA=' + E.sides.PLA.losses.ship + ' ROC=' + E.sides.ROC.losses.ship);
if (sc.needAmphib) chk('两栖登陆链路', bh.length > 0 && Object.values(E.beachheads).some(b => b.troops > 500),
  'beachheads=' + bh.length);
chk('统计采样', E.stats.length > 10, 'samples=' + E.stats.length);
console.log('-'.repeat(78));
let pass = true;
for (const c of checks) { if (!c.ok) pass = false; console.log((c.ok ? 'PASS  ' : 'FAIL  ') + c.name + (c.extra ? '   [' + c.extra + ']' : '')); }
console.log('-'.repeat(78));
console.log(pass ? '★ 全部子系统检查通过' : '✗ 存在未通过项');
process.exit(pass ? 0 : 2);
