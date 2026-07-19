// ==== AI 对手（p2）：逐个动作执行，动作间由外部播放动画 ====
import { getCard } from '../data/cards.js';

// 返回下一个动作 {type, ...} 或 null（回合结束）
export function nextAction(game) {
  const side = 'p2';
  const p = game.players[side];
  const foe = game.players.p1;
  if (game.over || game.turn !== side) return null;

  // 1. 出牌：优先高费
  const playable = [];
  for (let i = 0; i < p.hand.length; i++) {
    const req = game.playRequirements(side, i);
    if (req.playable) playable.push({ i, req, card: getCard(p.hand[i]) });
  }
  playable.sort((a, b) => b.card.cost - a.card.cost);
  for (const cand of playable) {
    const target = chooseTarget(game, cand);
    if (cand.req.needsTarget && target == null) continue;
    return { type: 'play', handIndex: cand.i, boardPos: p.board.length, targetId: target };
  }

  // 2. 攻击
  for (const m of p.board) {
    const info = game.attackInfo(m.id);
    if (!info.can || !info.targets.length) continue;
    const targetId = chooseAttackTarget(game, m, info.targets);
    return { type: 'attack', attackerId: m.id, targetId };
  }
  // 英雄攻击（英勇打击后）
  const heroInfo = game.attackInfo(p.hero.id);
  if (heroInfo.can && heroInfo.targets.length) {
    const targetId = chooseAttackTarget(game, p.hero, heroInfo.targets);
    return { type: 'attack', attackerId: p.hero.id, targetId };
  }

  // 3. 英雄技能
  const pr = game.powerRequirements(side);
  if (pr.usable) {
    let t = null;
    if (pr.needsTarget) {
      t = choosePowerTarget(game, pr.targets);
      if (t == null) return null;
    }
    return { type: 'power', targetId: t };
  }

  return null;
}

function chooseTarget(game, cand) {
  const { card, req } = cand;
  if (!req.needsTarget) return null;
  const targets = req.targets.map(id => game.getEntity(id)).filter(Boolean);
  const eff = card.type === 'spell' ? card.effect : card.battlecry;
  const enemyMinions = targets.filter(e => e.kind === 'minion' && e.side === 'p1');
  const enemyHero = targets.find(e => e.kind === 'hero' && e.side === 'p1');

  if (eff.type === 'damage') {
    // 能斩杀的最大随从优先，否则打脸
    const killable = enemyMinions.filter(m => m.hp <= eff.amount);
    if (killable.length) return best(killable, m => m.atk).id;
    const big = enemyMinions.filter(m => m.hp > eff.amount && m.atk >= 4);
    if (big.length && eff.amount >= 3) return best(big, m => m.atk).id;
    if (enemyHero) return enemyHero.id;
    return enemyMinions.length ? best(enemyMinions, m => m.atk).id : null;
  }
  if (eff.type === 'destroy') {
    return enemyMinions.length ? best(enemyMinions, m => m.atk).id : null;
  }
  if (eff.type === 'transform') {
    const worthy = enemyMinions.filter(m => m.atk >= 4 || m.hp >= 5);
    return worthy.length ? best(worthy, m => m.atk + m.hp).id : null;
  }
  if (eff.type === 'buff') {
    const own = targets.filter(e => e.kind === 'minion' && e.side === 'p2');
    return own.length ? best(own, m => m.atk).id : null;
  }
  return targets.length ? targets[0].id : null;
}

function chooseAttackTarget(game, attacker, targetIds) {
  const targets = targetIds.map(id => game.getEntity(id)).filter(Boolean);
  const minions = targets.filter(e => e.kind === 'minion');
  const hero = targets.find(e => e.kind === 'hero');
  const atk = attacker.kind === 'hero' ? attacker.atk + attacker.tempAtk : attacker.atk;

  // 有利交换：能杀死对方且自己不死，或对方是大威胁
  const goodTrades = minions.filter(m => m.hp <= atk && (attacker.kind === 'hero' || m.atk < attacker.hp || m.atk >= 5));
  if (goodTrades.length) return best(goodTrades, m => m.atk * 2 + m.hp).id;
  // 嘲讽墙必须打
  if (!hero) return best(minions, m => -m.hp).id;
  // 否则打脸
  return hero.id;
}

function choosePowerTarget(game, targetIds) {
  const targets = targetIds.map(id => game.getEntity(id)).filter(Boolean);
  const kill = targets.filter(e => e.kind === 'minion' && e.side === 'p1' && e.hp === 1);
  if (kill.length) return best(kill, m => m.atk).id;
  const hero = targets.find(e => e.kind === 'hero' && e.side === 'p1');
  return hero ? hero.id : null;
}

function best(arr, score) {
  return arr.reduce((a, b) => (score(b) > score(a) ? b : a));
}

export function executeAction(game, action) {
  switch (action.type) {
    case 'play': return game.playCard('p2', action.handIndex, action.boardPos, action.targetId);
    case 'attack': return game.attack(action.attackerId, action.targetId);
    case 'power': return game.useHeroPower('p2', action.targetId);
  }
  return { ok: false, events: [] };
}
