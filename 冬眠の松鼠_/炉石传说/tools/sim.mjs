// 核心逻辑冒烟测试：随机对局模拟（node tools/sim.mjs）
import { Game } from '../src/core/game.js';
import { HEROES, DECKS } from '../src/data/cards.js';

function randomTurn(game, side) {
  let acted = true;
  let guard = 0;
  while (acted && !game.over && guard++ < 60) {
    acted = false;
    const p = game.players[side];
    // 尝试出牌
    for (let i = 0; i < p.hand.length; i++) {
      const req = game.playRequirements(side, i);
      if (!req.playable) continue;
      let target = null;
      if (req.needsTarget) target = req.targets[Math.floor(Math.random() * req.targets.length)];
      const r = game.playCard(side, i, p.board.length, target);
      if (r.ok) { acted = true; break; }
    }
    if (game.over) return;
    // 尝试英雄技能
    const pr = game.powerRequirements(side);
    if (pr.usable) {
      const t = pr.needsTarget ? pr.targets[Math.floor(Math.random() * pr.targets.length)] : null;
      if (game.useHeroPower(side, t).ok) acted = true;
    }
    if (game.over) return;
    // 尝试攻击
    for (const m of [...p.board, p.hero]) {
      const info = game.attackInfo(m.id);
      if (info.can && info.targets.length) {
        const t = info.targets[Math.floor(Math.random() * info.targets.length)];
        const r = game.attack(m.id, t);
        if (r.ok) { acted = true; break; }
      }
    }
  }
}

let wins = { p1: 0, p2: 0, draw: 0 };
for (let g = 0; g < 200; g++) {
  const game = new Game(
    { hero: HEROES.mage, deck: DECKS.mage },
    { hero: HEROES.warrior, deck: DECKS.warrior },
  );
  game.start();
  let safety = 0;
  while (!game.over && safety++ < 300) {
    randomTurn(game, game.turn);
    if (!game.over) game.endTurn();
  }
  if (safety >= 300) { console.log('!! 对局未在300回合内结束'); break; }
  if (game.winner === null) wins.draw++; else wins[game.winner]++;
}
console.log('模拟200局结果:', wins);
console.log('OK - 核心逻辑无崩溃');
