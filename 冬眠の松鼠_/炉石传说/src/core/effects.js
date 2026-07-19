// ==== 效果解释器：卡牌效果均为声明式描述，由此模块执行 ====
import { rng } from './rng.js';
import { createMinion } from './player.js';

// target 描述: 'any' | 'enemy_minion' | 'friendly_minion' | 'minion' | 'none'
export function effectNeedsTarget(effect) {
  if (!effect) return false;
  return ['damage', 'destroy', 'transform', 'buff'].includes(effect.type) &&
         effect.target !== 'none';
}

export function validTargets(game, side, effect) {
  const me = game.players[side];
  const foe = game.players[game.enemyOf(side)];
  const list = [];
  const t = effect.target || 'any';
  if (t === 'any') {
    list.push(me.hero, foe.hero, ...me.board, ...foe.board);
  } else if (t === 'enemy') {
    list.push(foe.hero, ...foe.board);
  } else if (t === 'enemy_minion') {
    list.push(...foe.board);
  } else if (t === 'friendly_minion') {
    list.push(...me.board);
  } else if (t === 'minion') {
    list.push(...me.board, ...foe.board);
  }
  if (effect.condition === 'damaged') {
    return list.filter(e => e.kind === 'minion' && e.hp < e.maxHp);
  }
  return list;
}

// 执行一个效果。target 为实体或 null。events 为输出队列。
export function runEffect(game, side, effect, target, events) {
  const me = game.players[side];
  const foeSide = game.enemyOf(side);
  const foe = game.players[foeSide];

  switch (effect.type) {
    case 'damage':
      if (target) game.dealDamage(target, effect.amount, events, { spell: true });
      break;

    case 'damageRandom': {
      for (let i = 0; i < effect.times; i++) {
        const pool = effect.heroOnly
          ? [foe.hero].filter(e => e.hp > 0)
          : [foe.hero, ...foe.board].filter(e => e.hp > 0);
        if (!pool.length) break;
        game.dealDamage(rng.pick(pool), effect.amount, events, { spell: true });
      }
      break;
    }

    case 'aoe': {
      let pool = [];
      if (effect.side === 'enemy' || effect.side === 'all') pool.push(...foe.board);
      if (effect.side === 'all') pool.push(...me.board);
      if (effect.includeHeroes) {
        pool.push(foe.hero);
        if (effect.side === 'all') pool.push(me.hero);
      }
      for (const e of pool.slice()) game.dealDamage(e, effect.amount, events, { spell: true });
      break;
    }

    case 'draw':
      for (let i = 0; i < effect.count; i++) game.draw(me, events);
      break;

    case 'armor':
      me.hero.armor += effect.amount;
      events.push({ t: 'armor', id: me.hero.id, armor: me.hero.armor, gained: effect.amount });
      break;

    case 'heroAttack':
      me.hero.tempAtk += effect.amount;
      events.push({ t: 'heroAtkBuff', id: me.hero.id, atk: me.hero.atk + me.hero.tempAtk });
      break;

    case 'summon': {
      for (let i = 0; i < (effect.count || 1); i++) {
        game.summonToken(side, effect.tokenId, events);
      }
      break;
    }

    case 'destroy':
      if (target && target.kind === 'minion') {
        target.hp = 0;
        events.push({ t: 'destroyed', id: target.id });
      }
      break;

    case 'transform': {
      if (target && target.kind === 'minion') {
        const owner = game.players[target.side];
        const idx = owner.board.indexOf(target);
        if (idx >= 0) {
          const tokenCard = game.cardById(effect.tokenId);
          const m = createMinion(target.side, tokenCard);
          m.sleeping = target.sleeping;
          owner.board[idx] = m;
          events.push({ t: 'transform', oldId: target.id, entity: game.snap(m), side: target.side, index: idx });
        }
      }
      break;
    }

    case 'buff': {
      if (target && target.kind === 'minion') {
        target.atk += effect.atk || 0;
        target.hp += effect.hp || 0;
        target.maxHp += effect.hp || 0;
        events.push({ t: 'buff', id: target.id, atk: target.atk, hp: target.hp });
      }
      break;
    }

    case 'gainMana':
      me.mana = Math.min(10, me.mana + effect.amount);
      events.push({ t: 'manaUpdate', side, mana: me.mana, maxMana: me.maxMana });
      break;

    case 'multi':
      for (const sub of effect.effects) runEffect(game, side, sub, target, events);
      break;
  }
}
