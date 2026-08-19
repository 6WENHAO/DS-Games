// ---------------------------------------------------------------------------
// 无头逻辑自测：不渲染、不发声，直接跑真实的 Game 主循环
//   node tools/smoke.mjs                 默认 dust2 竞技模式跑 4 分钟
//   node tools/smoke.mjs dust2 6         指定地图与模拟分钟数
//   node tools/smoke.mjs all             四张地图 + 死斗模式各跑一遍
// 检查：不抛异常、回合能推进、Bot 会移动/交火/下包拆包、经济与比分正常
// ---------------------------------------------------------------------------

import { Game } from '../src/game/game.js';
import { PHASE } from '../src/game/match.js';

const arg = process.argv[2] || 'dust2';
const minutes = parseFloat(process.argv[3] || '4');
const DT = 1 / 100;

function run(mapId, mode, simSeconds) {
  const game = new Game(null, { headless: true });
  const stats = {
    map: mapId, mode, rounds: 0, kills: 0, headshots: 0, plants: 0, defuses: 0,
    explodes: 0, timeouts: 0, elims: 0, grenades: 0, shots: 0, moved: 0,
    maxStepMs: 0, totalMs: 0, steps: 0, errors: [], stuck: 0, swaps: 0,
    scoreT: 0, scoreCT: 0, buys: 0, moneyMin: 1e9, moneyMax: 0,
  };
  // 埋点
  const origKill = game.kill.bind(game);
  game.kill = (victim, attacker, weapon, hitgroup, cause) => {
    stats.kills++;
    if (hitgroup === 'head') stats.headshots++;
    return origKill(victim, attacker, weapon, hitgroup, cause);
  };
  const origBuy = game.buy.bind(game);
  game.buy = (p, id, silent) => { const r = origBuy(p, id, silent); if (r) stats.buys++; return r; };
  const origSwap = game.onSwapSides.bind(game);
  game.onSwapSides = () => { stats.swaps++; return origSwap(); };

  game.startMatch({ map: mapId, mode, bots: 4, difficulty: 'hard', team: 't' });
  const m = game.match;
  const origEnd = m.endRound.bind(m);
  m.endRound = (winner, reason) => {
    if (m.phase !== PHASE.OVER && m.phase !== PHASE.GAMEOVER) {
      stats.rounds++;
      if (reason === 'defuse') stats.defuses++;
      if (reason === 'explode') stats.explodes++;
      if (reason === 'time') stats.timeouts++;
      if (reason === 'elim') stats.elims++;
    }
    return origEnd(winner, reason);
  };
  const origPlant = m.finishPlant.bind(m);
  m.finishPlant = (p) => { stats.plants++; return origPlant(p); };
  const origThrow = game.grenades.throwGrenade.bind(game.grenades);
  game.grenades.throwGrenade = (p, t, pw) => { const r = origThrow(p, t, pw); if (r) stats.grenades++; return r; };

  const prev = game.players.map((p) => p.pos.slice());
  const steps = Math.round(simSeconds / DT);
  for (let i = 0; i < steps; i++) {
    const t0 = performance.now();
    try {
      game.update(DT);
    } catch (e) {
      stats.errors.push(`第 ${i} 步 (t=${(i * DT).toFixed(1)}s): ${e.message}\n${(e.stack || '').split('\n').slice(1, 4).join('\n')}`);
      if (stats.errors.length > 4) break;
    }
    const ms = performance.now() - t0;
    stats.totalMs += ms;
    stats.steps++;
    if (ms > stats.maxStepMs) stats.maxStepMs = ms;
    // 移动统计
    if (i % 20 === 0) {
      game.players.forEach((p, k) => {
        const d = Math.hypot(p.pos[0] - prev[k][0], p.pos[2] - prev[k][2]);
        if (p.alive) stats.moved += d;
        prev[k] = p.pos.slice();
      });
    }
    // 卡住检测：存活玩家长时间零位移
    if (i % 500 === 0) {
      for (const p of game.players) {
        if (!p.alive) continue;
        p._checkPos = p._checkPos || p.pos.slice();
        const d = Math.hypot(p.pos[0] - p._checkPos[0], p.pos[2] - p._checkPos[2]);
        if (game.match.phase === PHASE.LIVE && d < 0.4) stats.stuck++;
        p._checkPos = p.pos.slice();
      }
    }
    if (game.match.phase === PHASE.GAMEOVER) break;
  }
  for (const p of game.players) {
    stats.moneyMin = Math.min(stats.moneyMin, p.money);
    stats.moneyMax = Math.max(stats.moneyMax, p.money);
  }
  stats.scoreT = m.score.t;
  stats.scoreCT = m.score.ct;
  stats.avgMs = stats.totalMs / Math.max(1, stats.steps);
  stats.simSeconds = stats.steps * DT;
  stats.navNodes = game.nav.nodes.length;
  stats.gameOver = m.phase === PHASE.GAMEOVER;
  return stats;
}

function report(s) {
  const ok = [];
  const bad = [];
  console.log(`\n=== ${s.map} / ${s.mode} ===`);
  console.log(`  模拟 ${s.simSeconds.toFixed(0)}s (${s.steps} 步)  平均 ${s.avgMs.toFixed(3)}ms/步  峰值 ${s.maxStepMs.toFixed(1)}ms`);
  console.log(`  回合 ${s.rounds}（全歼 ${s.elims} / 爆炸 ${s.explodes} / 拆包 ${s.defuses} / 超时 ${s.timeouts}）比分 ${s.scoreT}:${s.scoreCT}${s.swaps ? ` 交换 ${s.swaps} 次` : ''}`);
  console.log(`  击杀 ${s.kills}（爆头 ${s.headshots}） 下包 ${s.plants} 投掷 ${s.grenades} 购买 ${s.buys}`);
  console.log(`  累计移动 ${s.moved.toFixed(0)}m  金钱区间 $${s.moneyMin}~$${s.moneyMax}  导航节点 ${s.navNodes}`);

  if (s.errors.length) { bad.push(`${s.errors.length} 个运行时异常`); for (const e of s.errors) console.log('  ⚠ ' + e); }
  else ok.push('无异常');
  if (s.moved < 200) bad.push(`Bot 几乎没有移动（${s.moved.toFixed(0)}m）`); else ok.push('Bot 会移动');
  if (s.kills < 3) bad.push(`交火太少（${s.kills} 次击杀）`); else ok.push('Bot 会交火');
  if (s.mode !== 'deathmatch') {
    if (s.rounds < 1) bad.push('一个回合都没打完');
    else ok.push('回合能推进');
    if (s.plants < 1 && s.rounds >= 3) bad.push('从未下包（T 的目标逻辑可能有问题）');
    else if (s.plants >= 1) ok.push('会下包');
  }
  if (s.avgMs > 3.0) bad.push(`单步耗时过高 ${s.avgMs.toFixed(2)}ms`); else ok.push('性能达标');
  console.log('  ' + (bad.length ? '❌ ' + bad.join('；') : '✅ ' + ok.join('、')));
  return bad.length === 0;
}

let allOk = true;
if (arg === 'all') {
  for (const map of ['dust2', 'mirage', 'office']) {
    allOk = report(run(map, 'competitive', 150)) && allOk;
  }
  allOk = report(run('arena', 'deathmatch', 90)) && allOk;
} else {
  const mode = arg === 'arena' ? 'deathmatch' : 'competitive';
  allOk = report(run(arg, mode, minutes * 60));
}
console.log(allOk ? '\n全部自测通过' : '\n存在问题');
process.exit(allOk ? 0 : 1);
