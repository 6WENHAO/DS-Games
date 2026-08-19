// ============================================================
// engine.js — 纯逻辑回合制战斗引擎（无 DOM 依赖，可在 Node 中测试）
// 规则：第三世代（GBA 宝石版）风格
//  - 属性克制 / 本系加成 / 会心(1/16) / 命中回避 / 随机 85-100%
//  - 出手顺序：优先度 > 速度(麻痹×0.25) > 随机
//  - 能力等级 -6..+6、中毒/剧毒/烧伤/麻痹/睡眠/冰冻/混乱
//  - 天气(晴/雨/沙)与场地(电气场地)、换人、简化背包道具
//  - 招式 PP 耗尽后使用挣扎（反弹 1/4 伤害）
// ============================================================
'use strict';

// ---------- 属性计算 ----------
function calcStat(base, level, isHP, iv) {
  iv = iv === undefined ? 31 : iv;
  if (isHP) return Math.floor(((2 * base + iv) * level) / 100) + level + 10;
  return Math.floor(Math.floor(((2 * base + iv) * level) / 100) + 5);
}

function makeMon(speciesId, level) {
  const sp = SPECIES[speciesId];
  const base = sp.base;
  const mon = {
    id: speciesId,
    name: sp.name,
    types: sp.types.slice(),
    level,
    stats: {
      hp: calcStat(base.hp, level, true),
      atk: calcStat(base.atk, level),
      def: calcStat(base.def, level),
      spa: calcStat(base.spa, level),
      spd: calcStat(base.spd, level),
      spe: calcStat(base.spe, level),
    },
    curHP: 0,
    status: null,       // 中毒/剧毒/烧伤/麻痹/睡眠/冰冻
    toxicN: 0,
    sleepTurns: 0,
    confTurns: 0,
    seeded: false,
    stages: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, acc: 0, eva: 0 },
    moves: sp.moves.map(function (id) {
      return { id, pp: MOVES[id].pp, ppMax: MOVES[id].pp };
    }),
  };
  mon.curHP = mon.stats.hp;
  return mon;
}

function stageMult(stage) {
  return stage >= 0 ? (2 + stage) / 2 : 2 / (2 - stage);
}

// 有效能力值（含能力等级 / 烧伤物攻减半 / 麻痹速度×0.25）
function effStat(mon, statName) {
  let v = mon.stats[statName] * stageMult(mon.stages[statName]);
  if (statName === 'spe' && mon.status === '麻痹') v *= 0.25;
  if (statName === 'atk' && mon.status === '烧伤') v *= 0.5;
  return Math.max(1, Math.floor(v));
}

// ---------- 克制 / 会心 / 伤害 ----------
function typeEffectiveness(atkType, defTypes) {
  let m = 1;
  for (const t of defTypes) {
    const row = CHART[atkType];
    if (row && row[t] !== undefined) m *= row[t];
  }
  return m;
}

function critChance(stage) {
  const table = [1 / 16, 1 / 8, 1 / 4, 1 / 3, 1 / 2];
  return table[Math.min(Math.max(stage | 0, 0), 4)];
}

// 伤害计算（第三世代公式）
// opts: {crit:boolean, eff:number, rand:0.85..1}
function damageCalc(attacker, defender, move, battle, rng, opts) {
  opts = opts || {};
  const L = attacker.level;
  const phys = move.cat === 'phys';
  let A = phys ? effStat(attacker, 'atk') : effStat(attacker, 'spa');
  let D = phys ? effStat(defender, 'def') : effStat(defender, 'spd');
  if (battle.weather.kind === '沙暴' && defender.types.indexOf('岩') >= 0 && !phys) {
    D = Math.floor(D * 1.5);
  }
  let dmg = Math.floor(Math.floor(((Math.floor((2 * L) / 5 + 2) * move.power * A) / D)) / 50) + 2;
  const stab = attacker.types.indexOf(move.type) >= 0 ? 1.5 : 1;
  dmg = Math.floor(dmg * stab);
  const eff = opts.eff !== undefined ? opts.eff : typeEffectiveness(move.type, defender.types);
  dmg = Math.floor(dmg * eff);
  if (opts.crit) dmg = Math.floor(dmg * 2);
  const w = battle.weather.kind;
  if (w === '雨天' && move.type === '水') dmg = Math.floor(dmg * 1.5);
  if (w === '雨天' && move.type === '火') dmg = Math.floor(dmg * 0.5);
  if (w === '大晴天' && move.type === '火') dmg = Math.floor(dmg * 1.5);
  if (w === '大晴天' && move.type === '水') dmg = Math.floor(dmg * 0.5);
  if (battle.terrain.kind === '电气场地' && move.type === '电') dmg = Math.floor(dmg * 1.5);
  if (opts.rand !== undefined) dmg = Math.floor(dmg * opts.rand);
  return Math.max(1, dmg);
}

// ---------- 状态免疫 ----------
function canApplyStatus(target, status) {
  if (target.status) return false;
  if (status === '烧伤' && target.types.indexOf('火') >= 0) return false;
  if (status === '冰冻' && target.types.indexOf('冰') >= 0) return false;
  if (status === '麻痹' && target.types.indexOf('电') >= 0) return false;
  if ((status === '中毒' || status === '剧毒') && (target.types.indexOf('毒') >= 0 || target.types.indexOf('钢') >= 0)) return false;
  if (status === '睡眠' && target.types.indexOf('草') >= 0) return false; // 简化：草系抗粉末
  return true;
}

// ---------- 战斗对象 ----------
function createBattle(opts) {
  const rng = opts.rng || mulberry32(20240101);
  const playerLevel = opts.playerLevel || 50;
  const rivalLevels = opts.rivalLevels || RIVAL_LEVELS.slice();
  const playerSpecies = opts.playerSpecies || ['firefox', 'waveturtle', 'voltmouse'];
  const b = {
    rng,
    phase: 'playerAction', // playerAction / forcedSwitch / over
    turn: 1,
    weather: { kind: '晴天', turns: 0 },
    terrain: { kind: 'none', turns: 0 },
    playerTeam: playerSpecies.map(function (id) { return makeMon(id, playerLevel); }),
    rivalTeam: RIVAL_TEAM.map(function (id, i) { return makeMon(id, rivalLevels[i]); }),
    active: [null, null],
    bag: { potion: ITEMS.potion.count, superpotion: ITEMS.superpotion.count, fullheal: ITEMS.fullheal.count },
    winner: null,
  };
  b.active[0] = b.playerTeam[0];
  b.active[1] = b.rivalTeam[0];
  return b;
}

// ---------- 事件 ----------
function ev(type, extra) {
  const e = { type };
  for (const k in extra) e[k] = extra[k];
  return e;
}

// 濒死处理：发出倒下事件；无后备则判负，否则对方 AI 自动换人 / 玩家进入强制换人
// 濒死方本回合剩余行动作废（_skipMove）
function handleFaint(battle, side, events) {
  if (battle._skipMove) battle._skipMove[side] = true;
  const fainted = battle.active[side];
  events.push(ev('faint', { side, name: fainted.name, msg: fainted.name + ' 倒下了！', dur: 1100 }));
  const team = side === 0 ? battle.playerTeam : battle.rivalTeam;
  const anyAlive = team.some(function (m) { return m.curHP > 0; });
  if (!anyAlive) {
    battle.phase = 'over';
    battle.winner = side === 0 ? 'rival' : 'player';
    events.push(ev(side === 0 ? 'defeat' : 'victory', { msg: side === 0 ? '眼前一黑…' : '胜利了！', dur: 1200 }));
    return;
  }
  if (side === 1) {
    // 对手 AI 自动换人
    const to = chooseRivalReplacement(battle);
    if (to >= 0) {
      battle.active[1] = battle.rivalTeam[to];
      events.push(ev('switch', { side: 1, to, name: battle.active[1].name, msg: RIVAL_NAME + ' 派出 ' + battle.active[1].name + '！', dur: 900 }));
    }
  } else {
    battle.phase = 'forcedSwitch';
  }
}

// ---------- 招式执行 ----------
function applyMove(battle, side, moveId, events) {
  const rng = battle.rng;
  const attacker = battle.active[side];
  const defender = battle.active[1 - side];
  const move = MOVES[moveId] || MOVES.struggle;

  // 出招宣告
  events.push(ev('moveUse', { side, moveId: moveId, move, name: attacker.name, msg: attacker.name + ' 使用了 ' + move.name + '！', dur: 800 }));

  // PP 消耗（挣扎不计）
  if (moveId !== 'struggle') {
    const slot = attacker.moves.find(function (m) { return m.id === moveId; });
    if (slot && slot.pp > 0) slot.pp--;
  }

  // 麻痹 25% 无法行动
  if (attacker.status === '麻痹' && rng() < 0.25) {
    events.push(ev('paraSkip', { side, name: attacker.name, msg: attacker.name + ' 麻痹了，无法行动！', dur: 800 }));
    return;
  }
  // 睡眠
  if (attacker.status === '睡眠') {
    if (attacker.sleepTurns > 0) {
      attacker.sleepTurns--;
      if (attacker.sleepTurns > 0) {
        events.push(ev('sleepSkip', { side, name: attacker.name, msg: attacker.name + ' 睡得很香…', dur: 800 }));
        return;
      }
      attacker.status = null;
      events.push(ev('statusCure', { side, status: '睡眠', name: attacker.name, msg: attacker.name + ' 醒来了！', dur: 700 }));
    }
  }
  // 冰冻 20% 解冻
  if (attacker.status === '冰冻') {
    if (rng() < 0.2) {
      attacker.status = null;
      events.push(ev('statusCure', { side, status: '冰冻', name: attacker.name, msg: attacker.name + ' 解冻了！', dur: 700 }));
    } else {
      events.push(ev('freezeSkip', { side, name: attacker.name, msg: attacker.name + ' 冻住了，无法行动！', dur: 800 }));
      return;
    }
  }
  // 混乱：50% 自伤（40 威力、无属性、物理）
  if (attacker.confTurns > 0) {
    attacker.confTurns--;
    if (rng() < 0.5) {
      const selfDmg = damageCalc(attacker, attacker, { name: '混乱', type: '一般', cat: 'phys', power: 40 }, battle, rng, { eff: 1, rand: 0.85 + 0.15 * rng() });
      attacker.curHP = Math.max(0, attacker.curHP - selfDmg);
      events.push(ev('confuseSelf', { side, dmg: selfDmg, from: attacker.curHP + selfDmg, to: attacker.curHP, msg: attacker.name + ' 混乱中，攻击了自己！', dur: 800 }));
      if (attacker.curHP <= 0) handleFaint(battle, side, events);
      return;
    }
    events.push(ev('confuseEnd', { side, name: attacker.name, msg: attacker.name + ' 不再混乱了。', dur: 500 }));
  }

  // ---------- 变化类招式 ----------
  if (move.cat === 'status') {
    const fx = move.fx;
    if (fx.weather) {
      if (battle.weather.kind === fx.weather) {
        events.push(ev('msg', { msg: '但是失败了！', dur: 600 }));
      } else {
        battle.weather = { kind: fx.weather, turns: 5 };
        events.push(ev('weather', { kind: fx.weather, msg: battle.weather.kind === '雨天' ? '天空开始下雨了！' : battle.weather.kind === '大晴天' ? '阳光变强了！' : '沙暴刮了起来！', dur: 900 }));
      }
      return;
    }
    if (fx.terrain) {
      if (battle.terrain.kind === fx.terrain) {
        events.push(ev('msg', { msg: '但是失败了！', dur: 600 }));
      } else {
        battle.terrain = { kind: fx.terrain, turns: 5 };
        events.push(ev('terrain', { kind: fx.terrain, msg: '电气场地展开了！', dur: 900 }));
      }
      return;
    }
    // 自我强化
    if (fx.stat) {
      const parts = [];
      for (const s of fx.stat) {
        if (s.chance < 100 && rng() * 100 >= s.chance) continue;
        const cur = attacker.stages[s.stat];
        if (cur >= 6) continue;
        const delta = Math.min(6 - cur, s.stages);
        attacker.stages[s.stat] += delta;
        parts.push(STAT_NAMES[s.stat] + (delta >= 2 ? ' 大幅提升了！' : ' 提升了！'));
      }
      if (parts.length === 0) {
        events.push(ev('msg', { msg: attacker.name + ' 的能力已经无法再提升！', dur: 600 }));
      } else {
        events.push(ev('statChange', { side, stat: fx.stat[0].stat, stages: fx.stat[0].stages, msg: attacker.name + ' 的' + parts.join(' '), dur: 700 }));
      }
      return;
    }
    // 命中判定（目标类变化招式）
    let hit = true;
    if (move.acc < 101) {
      const accMul = stageMult(attacker.stages.acc) / stageMult(defender.stages.eva);
      hit = rng() * 100 < move.acc * accMul;
    }
    if (!hit) {
      events.push(ev('miss', { side, msg: '但是没有命中！', dur: 700 }));
      return;
    }
    if (fx.sleep) {
      if (canApplyStatus(defender, '睡眠')) {
        defender.status = '睡眠';
        defender.sleepTurns = 1 + Math.floor(rng() * 3);
        events.push(ev('statusApply', { side: 1 - side, status: '睡眠', name: defender.name, msg: defender.name + ' 睡着了！', dur: 800 }));
      } else {
        events.push(ev('immune', { msg: '对 ' + defender.name + ' 没有效果。', dur: 600 }));
      }
      return;
    }
    if (fx.para) {
      if (canApplyStatus(defender, '麻痹')) {
        defender.status = '麻痹';
        events.push(ev('statusApply', { side: 1 - side, status: '麻痹', name: defender.name, msg: defender.name + ' 麻痹了！', dur: 800 }));
      } else {
        events.push(ev('immune', { msg: '对 ' + defender.name + ' 没有效果。', dur: 600 }));
      }
      return;
    }
    if (fx.toxic) {
      if (canApplyStatus(defender, '剧毒')) {
        defender.status = '剧毒';
        defender.toxicN = 0;
        events.push(ev('statusApply', { side: 1 - side, status: '剧毒', name: defender.name, msg: defender.name + ' 中了剧毒！', dur: 800 }));
      } else {
        events.push(ev('immune', { msg: '对 ' + defender.name + ' 没有效果。', dur: 600 }));
      }
      return;
    }
    if (fx.seed) {
      if (defender.seeded) {
        events.push(ev('immune', { msg: defender.name + ' 已经被种子缠住了。', dur: 600 }));
      } else if (defender.types.indexOf('草') >= 0) {
        events.push(ev('immune', { msg: '对 ' + defender.name + ' 没有效果。', dur: 600 }));
      } else {
        defender.seeded = true;
        events.push(ev('seed', { side: 1 - side, name: defender.name, msg: defender.name + ' 被寄生种子缠住了！', dur: 800 }));
      }
      return;
    }
    events.push(ev('msg', { msg: attacker.name + ' 使用了 ' + move.name + '。', dur: 600 }));
    return;
  }

  // ---------- 攻击类招式 ----------
  // 命中判定
  if (move.acc < 101) {
    const accMul = stageMult(attacker.stages.acc) / stageMult(defender.stages.eva);
    if (rng() * 100 >= move.acc * accMul) {
      events.push(ev('miss', { side, msg: attacker.name + ' 的攻击没有命中！', dur: 700 }));
      return;
    }
  }
  const eff = typeEffectiveness(move.type, defender.types);
  if (eff === 0) {
    events.push(ev('immune', { msg: '对 ' + defender.name + ' 似乎没有效果…', dur: 700 }));
    return;
  }
  // 会心
  const critStage = move.fx.crit || 0;
  const isCrit = rng() < critChance(critStage);
  // 会心时无视攻方不利等级与守方有利等级（简化：重算阶段为 0 的攻守值）
  let dmg;
  if (isCrit) {
    const atkName = move.cat === 'phys' ? 'atk' : 'spa';
    const defName = move.cat === 'phys' ? 'def' : 'spd';
    const savedAtk = attacker.stages[atkName], savedDef = defender.stages[defName];
    attacker.stages[atkName] = Math.max(0, attacker.stages[atkName]);
    defender.stages[defName] = Math.min(0, defender.stages[defName]);
    dmg = damageCalc(attacker, defender, move, battle, rng, { crit: true, eff, rand: 0.85 + 0.15 * rng() });
    attacker.stages[atkName] = savedAtk;
    defender.stages[defName] = savedDef;
  } else {
    dmg = damageCalc(attacker, defender, move, battle, rng, { eff, rand: 0.85 + 0.15 * rng() });
  }
  const fromHP = defender.curHP;
  defender.curHP = Math.max(0, defender.curHP - dmg);
  let msg = '';
  if (isCrit) msg += '会心一击！';
  if (eff >= 2) msg += (msg ? ' ' : '') + '效果绝佳！';
  else if (eff < 1) msg += (msg ? ' ' : '') + '效果不理想…';
  events.push(ev('damage', {
    side: 1 - side, dmg, from: fromHP, to: defender.curHP, eff, crit: isCrit,
    moveId: moveId, moveType: move.type, moveCat: move.cat,
    msg, dur: 700,
  }));
  // 受击方濒死
  if (defender.curHP <= 0) {
    handleFaint(battle, 1 - side, events);
    return;
  }
  // 吸取类
  if (move.fx.drain) {
    const heal = Math.max(1, Math.floor(dmg * move.fx.drain));
    const before = attacker.curHP;
    attacker.curHP = Math.min(attacker.stats.hp, attacker.curHP + heal);
    events.push(ev('heal', { side, amount: attacker.curHP - before, msg: attacker.name + ' 吸取了体力！', dur: 700 }));
  }
  // 次要效果
  const fx = move.fx;
  if (fx.burn && canApplyStatus(defender, '烧伤') && rng() * 100 < fx.burn) {
    defender.status = '烧伤';
    events.push(ev('statusApply', { side: 1 - side, status: '烧伤', name: defender.name, msg: defender.name + ' 烧伤了！', dur: 800 }));
  }
  if (fx.para && canApplyStatus(defender, '麻痹') && rng() * 100 < fx.para) {
    defender.status = '麻痹';
    events.push(ev('statusApply', { side: 1 - side, status: '麻痹', name: defender.name, msg: defender.name + ' 麻痹了！', dur: 800 }));
  }
  if (fx.freeze && canApplyStatus(defender, '冰冻') && rng() * 100 < fx.freeze) {
    defender.status = '冰冻';
    events.push(ev('statusApply', { side: 1 - side, status: '冰冻', name: defender.name, msg: defender.name + ' 冻住了！', dur: 800 }));
  }
  if (fx.flinch && defender.curHP > 0 && rng() * 100 < fx.flinch) {
    if (battle._skipMove) battle._skipMove[1 - side] = true; // 畏缩：目标本回合无法行动
    events.push(ev('flinch', { side: 1 - side, name: defender.name, msg: defender.name + ' 畏缩了！', dur: 700 }));
  }
  if (fx.statDown) {
    for (const s of fx.statDown) {
      if (rng() * 100 >= s.chance) continue;
      if (defender.stages[s.stat] <= -6) continue;
      defender.stages[s.stat] -= s.stages;
      events.push(ev('statChange', { side: 1 - side, stat: s.stat, stages: -s.stages, msg: defender.name + ' 的' + STAT_NAMES[s.stat] + ' 下降了！', dur: 700 }));
    }
  }
  if (fx.conf && defender.curHP > 0 && defender.confTurns <= 0 && rng() * 100 < fx.conf) {
    defender.confTurns = 2 + Math.floor(rng() * 4);
    events.push(ev('statusApply', { side: 1 - side, status: '混乱', name: defender.name, msg: defender.name + ' 混乱了！', dur: 700 }));
  }
  // 挣扎反弹
  if (fx.recoil) {
    const rec = Math.max(1, Math.floor(dmg * fx.recoil));
    const before = attacker.curHP;
    attacker.curHP = Math.max(0, attacker.curHP - rec);
    events.push(ev('recoil', { side, dmg: rec, from: before, to: attacker.curHP, msg: attacker.name + ' 受到了反作用力的伤害！', dur: 700 }));
    if (attacker.curHP <= 0) handleFaint(battle, side, events);
  }
}

const STAT_NAMES = { atk: '攻击', def: '防御', spa: '特攻', spd: '特防', spe: '速度', acc: '命中', eva: '回避' };

// ---------- 回合末结算 ----------
function endTurn(battle, events) {
  const rng = battle.rng;
  for (let side = 0; side < 2; side++) {
    const mon = battle.active[side];
    if (!mon || mon.curHP <= 0) continue;
    // 寄生种子吸取
    if (mon.seeded) {
      const drain = Math.max(1, Math.floor(mon.stats.hp / 8));
      mon.curHP = Math.max(0, mon.curHP - drain);
      const other = battle.active[1 - side];
      if (other && other.curHP > 0) other.curHP = Math.min(other.stats.hp, other.curHP + drain);
      events.push(ev('drain', { side, dmg: drain, from: mon.curHP + drain, to: mon.curHP, msg: mon.name + ' 被寄生种子吸走了体力！', dur: 600 }));
      if (mon.curHP <= 0) {
        handleFaint(battle, side, events);
        continue;
      }
    }
    // 中毒 / 烧伤 / 剧毒
    let chip = 0;
    if (mon.status === '中毒' || mon.status === '烧伤') chip = Math.max(1, Math.floor(mon.stats.hp / 8));
    if (mon.status === '剧毒') {
      mon.toxicN = Math.min(15, mon.toxicN + 1);
      chip = Math.max(1, Math.floor((mon.stats.hp * mon.toxicN) / 16));
    }
    if (chip > 0) {
      mon.curHP = Math.max(0, mon.curHP - chip);
      events.push(ev('chip', {
        side, dmg: chip, from: mon.curHP + chip, to: mon.curHP,
        msg: mon.name + (mon.status === '烧伤' ? ' 因烧伤受到伤害！' : ' 因中毒受到伤害！'), dur: 600,
      }));
      if (mon.curHP <= 0) {
        handleFaint(battle, side, events);
        continue;
      }
    }
    // 沙暴伤害（岩/地面/钢 免疫）
    if (battle.weather.kind === '沙暴' && !mon.types.some(function (t) { return t === '岩' || t === '地面' || t === '钢'; })) {
      const sand = Math.max(1, Math.floor(mon.stats.hp / 16));
      mon.curHP = Math.max(0, mon.curHP - sand);
      events.push(ev('chip', { side, dmg: sand, from: mon.curHP + sand, to: mon.curHP, msg: '沙暴肆虐！', dur: 600 }));
      if (mon.curHP <= 0) {
        handleFaint(battle, side, events);
        continue;
      }
    }
  }
  // 天气 / 场地倒计时
  if (battle.weather.turns > 0) {
    battle.weather.turns--;
    if (battle.weather.turns === 0) {
      events.push(ev('weatherEnd', { msg: battle.weather.kind === '雨天' ? '雨停了。' : battle.weather.kind === '大晴天' ? '阳光恢复了。' : '沙暴平息了。', dur: 700 }));
      battle.weather = { kind: '晴天', turns: 0 };
    }
  }
  if (battle.terrain.turns > 0) {
    battle.terrain.turns--;
    if (battle.terrain.turns === 0) {
      events.push(ev('terrainEnd', { msg: '电气场地消失了。', dur: 700 }));
      battle.terrain = { kind: 'none', turns: 0 };
    }
  }
}

// ---------- 对手 AI ----------
function estimateDamage(move, attacker, defender, battle) {
  const eff = typeEffectiveness(move.type, defender.types);
  if (eff === 0) return 0;
  return damageCalc(attacker, defender, move, battle, battle.rng, { eff, rand: 1 });
}

function scoreMove(battle, attacker, defender, moveId) {
  const move = MOVES[moveId];
  const slot = attacker.moves.find(function (m) { return m.id === moveId; });
  if (slot && slot.pp <= 0) return -1000;
  if (move.cat === 'status') {
    const fx = move.fx;
    if (fx.weather) {
      if (battle.weather.kind === fx.weather) return 4;
      return 62;
    }
    if (fx.terrain) {
      if (battle.terrain.kind === fx.terrain) return 4;
      return 55;
    }
    if (fx.stat) {
      let missing = 0;
      for (const s of fx.stat) missing += Math.max(0, 6 - attacker.stages[s.stat]);
      return 25 + missing * 9;
    }
    if (fx.sleep && canApplyStatus(defender, '睡眠')) return 45 + 35 * (move.acc / 100);
    if (fx.para && canApplyStatus(defender, '麻痹')) return 45 + 35 * (move.acc / 100);
    if (fx.toxic && canApplyStatus(defender, '剧毒')) return 42 + 32 * (move.acc / 100);
    if (fx.seed && !defender.seeded && defender.types.indexOf('草') < 0) return 38 + 25 * (move.acc / 100);
    return 4;
  }
  const eff = typeEffectiveness(move.type, defender.types);
  if (eff === 0) return -100;
  const stab = attacker.types.indexOf(move.type) >= 0 ? 1.5 : 1;
  let s = estimateDamage(move, attacker, defender, battle) * eff * stab * (move.acc / 100);
  if (defender.curHP > 0 && s >= defender.curHP) s += 35;
  if (move.priority > 0) s += 5;
  return s;
}

// 通用 AI 行动选择（side=0 玩家侧演示/测试，side=1 对手）
function chooseAction(battle, side) {
  const rng = battle.rng;
  const attacker = battle.active[side];
  const defender = battle.active[1 - side];
  const benchOf = side === 1 ? chooseRivalReplacement : function () {
    let bestIdx = -1, bestScore = -1e9;
    for (let i = 0; i < battle.playerTeam.length; i++) {
      const m = battle.playerTeam[i];
      if (m.curHP <= 0 || m === battle.active[side]) continue;
      let s = 0;
      for (const t of defender.types) {
        const mul = typeEffectiveness(t, m.types);
        s += mul <= 0.5 ? 40 : mul === 1 ? 15 : -25;
      }
      s += rng() * 5;
      if (s > bestScore) { bestScore = s; bestIdx = i; }
    }
    return bestIdx;
  };
  if (attacker.curHP <= 0) return { kind: 'switch', to: benchOf(battle) };
  // 招式评分
  let best = null, bestS = -1e9;
  for (const slot of attacker.moves) {
    const s = scoreMove(battle, attacker, defender, slot.id) + rng() * 6;
    if (s > bestS) { bestS = s; best = slot.id; }
  }
  // 是否换人：当前精灵完全打不动对手且后备有更好选择
  const team = side === 1 ? battle.rivalTeam : battle.playerTeam;
  const bench = team.filter(function (m) { return m.curHP > 0 && battle.active[side] !== m; });
  if (bench.length > 0) {
    const maxEff = Math.max.apply(null, attacker.moves.map(function (m) {
      return typeEffectiveness(MOVES[m.id].type, defender.types);
    }));
    if (maxEff <= 0.5 && rng() < 0.3) {
      const to = benchOf(battle);
      if (to >= 0) return { kind: 'switch', to };
    }
  }
  return { kind: 'move', moveId: best };
}

function chooseRivalAction(battle) {
  return chooseAction(battle, 1);
}

// 对手换人：选对玩家在场精灵综合抗性最好的后备
function chooseRivalReplacement(battle) {
  const rng = battle.rng;
  const foe = battle.active[0];
  let bestIdx = -1, bestScore = -1e9;
  for (let i = 0; i < battle.rivalTeam.length; i++) {
    const m = battle.rivalTeam[i];
    if (m.curHP <= 0 || m === battle.active[1]) continue;
    let s = 0;
    for (const t of foe.types) {
      const mul = typeEffectiveness(t, m.types);
      s += mul <= 0.5 ? 40 : mul === 1 ? 15 : -25;
    }
    s += rng() * 5;
    if (s > bestScore) { bestScore = s; bestIdx = i; }
  }
  return bestIdx;
}

// ---------- 玩家行动 ----------
function doPlayerSwitch(battle, to, events) {
  const mon = battle.playerTeam[to];
  if (!mon) return false;
  if (mon.curHP <= 0) { events.push(ev('msg', { msg: mon.name + ' 已经倒下了！', dur: 700 })); return false; }
  if (mon === battle.active[0]) { events.push(ev('msg', { msg: mon.name + ' 已经在场上了！', dur: 700 })); return false; }
  battle.active[0] = mon;
  events.push(ev('switch', { side: 0, to, name: mon.name, msg: '去吧，' + mon.name + '！', dur: 900 }));
  return true;
}

function doPlayerItem(battle, itemId, events) {
  if (battle.bag[itemId] === undefined || battle.bag[itemId] <= 0) {
    events.push(ev('msg', { msg: '没有这个道具了！', dur: 700 }));
    return false;
  }
  const mon = battle.active[0];
  if (mon.curHP <= 0) { events.push(ev('msg', { msg: '请先换人！', dur: 700 })); return false; }
  const item = ITEMS[itemId];
  let used = false;
  if (item.heal) {
    if (mon.curHP >= mon.stats.hp && !mon.status) {
      events.push(ev('msg', { msg: '现在不需要使用这个道具。', dur: 700 }));
      return false;
    }
    const before = mon.curHP;
    mon.curHP = Math.min(mon.stats.hp, mon.curHP + item.heal);
    battle.bag[itemId]--;
    used = true;
    events.push(ev('item', { side: 0, itemId, name: item.name, heal: mon.curHP - before, msg: '使用了 ' + item.name + '！恢复了 ' + (mon.curHP - before) + ' 点HP！', dur: 900 }));
  } else if (item.cure) {
    if (!mon.status) {
      events.push(ev('msg', { msg: '现在不需要使用这个道具。', dur: 700 }));
      return false;
    }
    const st = mon.status;
    mon.status = null;
    battle.bag[itemId]--;
    used = true;
    events.push(ev('item', { side: 0, itemId, name: item.name, cure: st, msg: '使用了 ' + item.name + '！治愈了' + st + '！', dur: 900 }));
  }
  return used;
}

// ---------- 回合结算主流程 ----------
function resolveTurn(battle, playerAction) {
  const events = [];
  const rng = battle.rng;
  let playerActed = false;

  if (battle.phase !== 'playerAction' && battle.phase !== 'forcedSwitch') {
    return { events, battle };
  }

  if (playerAction.kind === 'forfeit') {
    battle.phase = 'over';
    battle.winner = 'rival';
    events.push(ev('defeat', { msg: '认输了…', dur: 1000 }));
    return { events, battle };
  }

  // 1) 换人 / 道具（先于招式）
  if (playerAction.kind === 'switch') {
    if (doPlayerSwitch(battle, playerAction.to, events)) playerActed = true;
  } else if (playerAction.kind === 'item') {
    if (doPlayerItem(battle, playerAction.itemId, events)) playerActed = true;
  }
  if (battle.phase === 'over') return { events, battle };
  if (playerAction.kind === 'switch' && !playerActed) {
    return { events, battle }; // 非法换人：不消耗回合
  }
  if (playerAction.kind === 'item' && !playerActed) {
    return { events, battle }; // 道具未使用：不消耗回合
  }

  // 对手行动
  const rivalAct = chooseRivalAction(battle);
  if (rivalAct.kind === 'switch') {
    if (rivalAct.to >= 0) {
      battle.active[1] = battle.rivalTeam[rivalAct.to];
      events.push(ev('switch', { side: 1, to: rivalAct.to, name: battle.active[1].name, msg: RIVAL_NAME + ' 派出 ' + battle.active[1].name + '！', dur: 900 }));
    }
  }
  if (battle.phase === 'over') return { events, battle };

  // 2) 招式顺序：优先度 > 速度 > 随机
  const order = [];
  const moveChoices = [null, null];
  if (!playerActed && playerAction.kind === 'move') moveChoices[0] = playerAction.moveId;
  if (rivalAct.kind === 'move') moveChoices[1] = rivalAct.moveId;
  for (let s = 0; s < 2; s++) if (moveChoices[s] !== null) order.push(s);
  order.sort(function (a, b) {
    const pa = (MOVES[moveChoices[a]] || MOVES.struggle).priority || 0;
    const pb = (MOVES[moveChoices[b]] || MOVES.struggle).priority || 0;
    if (pa !== pb) return pb - pa;
    const sa = effStat(battle.active[a], 'spe');
    const sb = effStat(battle.active[b], 'spe');
    if (sa !== sb) return sb - sa;
    return rng() < 0.5 ? -1 : 1;
  });

  // 3) 依次执行
  battle._skipMove = { 0: false, 1: false };
  for (const side of order) {
    if (battle.phase === 'over') break;
    const a = battle.active[side];
    const d = battle.active[1 - side];
    if (a.curHP <= 0 || d.curHP <= 0 || battle._skipMove[side]) continue;
    let moveId = moveChoices[side];
    if (moveId) {
      const slot = a.moves.find(function (m) { return m.id === moveId; });
      if (!slot) moveId = a.moves[0].id; // 非该精灵招式 → 回退第一招
      else if (slot.pp <= 0) moveId = 'struggle'; // PP 耗尽 → 挣扎
    }
    applyMove(battle, side, moveId || 'struggle', events);
  }

  // 4) 回合末结算（若战斗未结束）
  if (battle.phase !== 'over') {
    endTurn(battle, events);
  }
  battle.turn++;
  if (battle.phase !== 'over' && battle.phase !== 'forcedSwitch') battle.phase = 'playerAction';
  return { events, battle };
}

// 玩家濒死后的强制换人
function chooseReplacementPlayer(battle, to) {
  const events = [];
  if (doPlayerSwitch(battle, to, events)) {
    if (battle.phase !== 'over') battle.phase = 'playerAction';
  }
  return { events, battle };
}

// ---------- 完整自动对战模拟（测试 / 演示用）----------
function simulateBattle(opts) {
  const battle = createBattle(opts);
  const log = [];
  let guard = 0;
  while (battle.phase !== 'over' && guard < 300) {
    guard++;
    let action;
    if (battle.phase === 'forcedSwitch') {
      // 玩家自动换第一只存活后备
      let to = -1;
      for (let i = 0; i < battle.playerTeam.length; i++) {
        if (battle.playerTeam[i].curHP > 0 && battle.playerTeam[i] !== battle.active[0]) { to = i; break; }
      }
      const r = chooseReplacementPlayer(battle, to);
      log.push.apply(log, r.events);
      if (to < 0) break;
    } else {
      // 玩家侧也用 AI 决策（演示/测试）
      const act = chooseAction(battle, 0);
      if (act.kind === 'switch' && act.to >= 0) {
        const r = resolveTurn(battle, act);
        log.push.apply(log, r.events);
      } else {
        const r = resolveTurn(battle, { kind: 'move', moveId: act.moveId });
        log.push.apply(log, r.events);
      }
    }
  }
  return { battle, turns: battle.turn, guard, log };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    calcStat, makeMon, stageMult, effStat, typeEffectiveness, critChance, damageCalc,
    canApplyStatus, createBattle, resolveTurn, chooseReplacementPlayer, simulateBattle,
    chooseRivalAction, chooseAction, estimateDamage, STAT_NAMES, applyMove, endTurn, handleFaint,
  };
}
