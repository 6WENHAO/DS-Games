// ==== 战斗结算：攻击合法性校验与互殴伤害 ====

export function canAttack(game, attacker) {
  if (game.over) return { ok: false, reason: '游戏已结束' };
  if (attacker.side !== game.turn) return { ok: false, reason: '不是你的回合' };
  const atk = attacker.kind === 'hero' ? attacker.atk + attacker.tempAtk : attacker.atk;
  if (atk <= 0) return { ok: false, reason: '没有攻击力' };
  if (attacker.attacksThisTurn >= 1) return { ok: false, reason: '本回合已攻击过' };
  if (attacker.kind === 'minion' && attacker.sleeping) return { ok: false, reason: '随从需要休整一回合' };
  return { ok: true };
}

export function validAttackTargets(game, attacker) {
  const foe = game.players[game.enemyOf(attacker.side)];
  const taunts = foe.board.filter(m => m.taunt);
  if (taunts.length) return taunts;
  return [foe.hero, ...foe.board];
}

export function resolveAttack(game, attacker, target, events) {
  const chk = canAttack(game, attacker);
  if (!chk.ok) return chk;
  const legal = validAttackTargets(game, attacker);
  if (!legal.includes(target)) {
    const foe = game.players[game.enemyOf(attacker.side)];
    if (foe.board.some(m => m.taunt)) return { ok: false, reason: '必须先攻击嘲讽随从' };
    return { ok: false, reason: '无效的攻击目标' };
  }

  attacker.attacksThisTurn++;
  const atkPower = attacker.kind === 'hero' ? attacker.atk + attacker.tempAtk : attacker.atk;
  events.push({ t: 'attack', attackerId: attacker.id, targetId: target.id });

  game.dealDamage(target, atkPower, events, {});
  // 反击伤害（攻击英雄不反击；随从/英雄打随从会被反击）
  const retaliation = target.kind === 'hero' ? target.atk + target.tempAtk : target.atk;
  if (retaliation > 0) game.dealDamage(attacker, retaliation, events, {});

  game.processDeaths(events);
  return { ok: true };
}
