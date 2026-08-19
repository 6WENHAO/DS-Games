// ============================================================
// tests.js — 共享断言测试集（浏览器 #selftest 与 Node 共用）
// 覆盖：克制表 / 能力计算 / 伤害公式 / 先手顺序 / 状态 / 天气场地
// / 濒死换人 / 胜负判定 / 完整自动对战收敛
// ============================================================
'use strict';

function makeReporter() {
  return {
    results: [],
    failures: 0,
    ok(name, fn) {
      try {
        const v = fn();
        if (v === false) throw new Error('assertion returned false');
        this.results.push({ name, pass: true });
      } catch (err) {
        this.failures++;
        this.results.push({ name, pass: false, err: String(err && err.message ? err.message : err) });
      }
    },
  };
}

function RUN_TESTS(extra) {
  // extra: {render: fn(name, fn)} 由浏览器注入渲染管线测试
  const r = makeReporter();

  r.ok('调色板 32 色且合法', function () {
    if (PAL.length !== 32) return false;
    for (const h of PAL) {
      if (!/^#[0-9a-f]{6}$/i.test(h)) return false;
    }
    return true;
  });

  r.ok('克制表：火克草、水克火、电对地面无效', function () {
    return typeEffectiveness('火', ['草']) === 2 &&
      typeEffectiveness('水', ['火']) === 2 &&
      typeEffectiveness('电', ['地面']) === 0;
  });

  r.ok('克制表：一般对幽灵无效、格斗克一般、龙对妖精无效', function () {
    return typeEffectiveness('一般', ['幽灵']) === 0 &&
      typeEffectiveness('格斗', ['一般']) === 2 &&
      typeEffectiveness('龙', ['妖精']) === 0 &&
      typeEffectiveness('钢', ['妖精']) === 2 &&
      typeEffectiveness('地面', ['飞行']) === 0;
  });

  r.ok('能力计算：50 级岩甲犀 HP=175 攻击=132', function () {
    const m = makeMon('rockrhino', 50);
    return m.stats.hp === 175 && m.stats.atk === 132;
  });

  r.ok('伤害公式：满随机火焰喷射 vs 青芽兽 = 126', function () {
    const b = createBattle({ rng: mulberry32(1), playerSpecies: ['firefox'] });
    const atk = makeMon('firefox', 50);
    const def = makeMon('sproutaur', 50);
    const dmg = damageCalc(atk, def, MOVES.flamethrower, b, b.rng, { eff: 2, rand: 1 });
    return dmg === 126;
  });

  r.ok('伤害公式：草打水×2、火打水×0.5、本系×1.5', function () {
    const b = createBattle({ rng: mulberry32(2) });
    const fire = makeMon('firefox', 50);
    const grass = makeMon('sproutaur', 50);
    const water = makeMon('waveturtle', 50);
    const d1 = damageCalc(grass, water, MOVES.energyball, b, b.rng, { rand: 1 });
    const d2 = damageCalc(fire, water, MOVES.ember, b, b.rng, { rand: 1 });
    // energyball: 90 威力 草 特攻 88 -> 水 特防 85，2 倍
    const expect1 = Math.floor(Math.floor(Math.floor(Math.floor(Math.floor((Math.floor(2 * 50 / 5 + 2) * 90 * effStat(grass, 'spa')) / effStat(water, 'spd')) / 50) + 2) * 1.5) * 2);
    return d1 === expect1 && d2 > 0 && d1 > d2;
  });

  r.ok('出手顺序：优先度 > 速度', function () {
    const b = createBattle({ rng: mulberry32(3), playerSpecies: ['voltmouse'], rivalLevels: [46, 47, 48] });
    // 电光鼠(108) 电光一闪(+1) vs 焰尾狐(97) —— 同队内比较用自定义对象
    const fast = makeMon('voltmouse', 50);
    const slow = makeMon('psykitty', 50);
    const qa = MOVES.quickattack, psy = MOVES.psychic;
    const order = [0, 1].sort(function (a, b) {
      const pa = (a === 0 ? qa : psy).priority || 0;
      const pb = (b === 0 ? qa : psy).priority || 0;
      if (pa !== pb) return pb - pa;
      const sa = a === 0 ? fast : slow;
      const sb = b === 0 ? fast : slow;
      return effStat(sb, 'spe') - effStat(sa, 'spe');
    });
    return order[0] === 0 && effStat(fast, 'spe') > effStat(slow, 'spe');
  });

  r.ok('状态：烧伤物攻减半、麻痹速度×0.25', function () {
    const m = makeMon('rockrhino', 50);
    m.status = '烧伤';
    const burnedAtk = effStat(m, 'atk');
    m.status = null;
    const normAtk = effStat(m, 'atk');
    m.status = '麻痹';
    const paraSpe = effStat(m, 'spe');
    return burnedAtk === Math.floor(m.stats.atk / 2) && paraSpe === Math.floor(m.stats.spe * 0.25) && normAtk === m.stats.atk;
  });

  r.ok('能力等级：+2 = ×2、-2 = ×0.5', function () {
    return stageMult(2) === 2 && stageMult(-2) === 0.5 && stageMult(6) === 4 && stageMult(-6) === 0.25;
  });

  r.ok('天气：雨天水系×1.5、火系×0.5；大晴天相反', function () {
    const b = createBattle({ rng: mulberry32(4) });
    const water = makeMon('waveturtle', 50);
    const fire = makeMon('firefox', 50);
    const target = makeMon('rockrhino', 50);
    b.weather = { kind: '雨天', turns: 5 };
    const wRain = damageCalc(water, target, MOVES.watergun, b, b.rng, { rand: 1 });
    const fRain = damageCalc(fire, target, MOVES.ember, b, b.rng, { rand: 1 });
    b.weather = { kind: '大晴天', turns: 5 };
    const wSun = damageCalc(water, target, MOVES.watergun, b, b.rng, { rand: 1 });
    const fSun = damageCalc(fire, target, MOVES.ember, b, b.rng, { rand: 1 });
    return wRain > wSun && fSun > fRain;
  });

  r.ok('电气场地：电系×1.5', function () {
    const b = createBattle({ rng: mulberry32(5) });
    const elec = makeMon('voltmouse', 50);
    const target = makeMon('waveturtle', 50);
    b.terrain = { kind: 'none', turns: 0 };
    const a = damageCalc(elec, target, MOVES.thundershock, b, b.rng, { rand: 1 });
    b.terrain = { kind: '电气场地', turns: 5 };
    const c = damageCalc(elec, target, MOVES.thundershock, b, b.rng, { rand: 1 });
    return c > a;
  });

  r.ok('完整流程：麻痹跳过与睡眠回合', function () {
    const b = createBattle({ rng: mulberry32(6), playerSpecies: ['psykitty'] });
    const evs = [];
    const rival = b.active[1];
    rival.status = '麻痹';
    // 用 0 值 rng 确保 25% 判定必跳过
    b.rng = function () { return 0; };
    applyMoveForTest(b, 1, 'psychic', evs);
    const skipped = evs.some(function (e) { return e.type === 'paraSkip'; });
    return skipped;
  });

  r.ok('完整流程：催眠后睡眠回合与醒来', function () {
    const b = createBattle({ rng: mulberry32(7), playerSpecies: ['psykitty'] });
    const evs = [];
    b.active[0].status = '睡眠';
    b.active[0].sleepTurns = 1;
    const r = resolveTurn(b, { kind: 'move', moveId: 'psychic' });
    const hasWake = r.events.some(function (e) { return e.type === 'statusCure' && e.status === '睡眠'; });
    const woke = b.active[0].status === null;
    return hasWake || woke;
  });

  r.ok('完整流程：剧毒递增伤害', function () {
    const b = createBattle({ rng: mulberry32(8) });
    const target = b.active[0];
    target.status = '剧毒';
    target.toxicN = 0;
    const chips = [];
    for (let i = 0; i < 3; i++) {
      const evs = [];
      endTurn(b, evs);
      const chipEv = evs.find(function (e) { return e.type === 'chip' && e.side === 0; });
      if (chipEv) chips.push(chipEv.dmg);
    }
    return chips.length === 3 && chips[0] < chips[1] && chips[1] < chips[2];
  });

  r.ok('完整流程：濒死换人与胜负判定', function () {
    const b = createBattle({ rng: mulberry32(9), playerSpecies: ['rockrhino', 'firefox', 'waveturtle'] });
    // 直接把对手三只打到 1 HP，再用攻击收尾
    for (const m of b.rivalTeam) m.curHP = 1;
    let guard = 0;
    while (b.phase !== 'over' && guard < 60) {
      guard++;
      if (b.phase === 'forcedSwitch') {
        let to = -1;
        for (let i = 0; i < b.playerTeam.length; i++) {
          if (b.playerTeam[i].curHP > 0 && b.playerTeam[i] !== b.active[0]) { to = i; break; }
        }
        chooseReplacementPlayer(b, to);
      } else {
        const active = b.active[0];
        const dmgMove = active.moves.find(function (m) { return m.pp > 0 && MOVES[m.id].cat !== 'status'; }) || active.moves[0];
        resolveTurn(b, { kind: 'move', moveId: dmgMove.id });
      }
    }
    return b.phase === 'over' && b.winner === 'player';
  });

  r.ok('完整流程：认输直接判负', function () {
    const b = createBattle({ rng: mulberry32(10) });
    const r = resolveTurn(b, { kind: 'forfeit' });
    return b.phase === 'over' && b.winner === 'rival' && r.events.length > 0;
  });

  r.ok('完整流程：PP 耗尽后使用挣扎并反弹', function () {
    const b = createBattle({ rng: mulberry32(11) });
    const atk = b.active[0];
    for (const m of atk.moves) m.pp = 0;
    const r = resolveTurn(b, { kind: 'move', moveId: atk.moves[0].id });
    return r.events.some(function (e) { return e.type === 'moveUse' && e.moveId === 'struggle'; }) ||
      r.events.some(function (e) { return e.type === 'recoil'; });
  });

  r.ok('完整流程：道具回复与道具耗尽', function () {
    const b = createBattle({ rng: mulberry32(12) });
    // 对手只带一只只会变化招式的精灵，避免干扰回复断言
    const rival = b.active[1];
    rival.moves = [{ id: 'sunnyday', pp: 5, ppMax: 5 }];
    b.rivalTeam = [rival];
    const mon = b.active[0];
    mon.curHP = mon.stats.hp - 20;
    const before = b.bag.potion;
    const r = resolveTurn(b, { kind: 'item', itemId: 'potion' });
    return b.active[0].curHP === mon.stats.hp && b.bag.potion === before - 1 &&
      r.events.some(function (e) { return e.type === 'item'; });
  });

  r.ok('完整自动对战：300 回合内收敛并分出胜负', function () {
    const sim = simulateBattle({ rng: mulberry32(42), playerSpecies: ['firefox', 'waveturtle', 'voltmouse'] });
    let bad = false;
    for (const t of sim.battle.playerTeam.concat(sim.battle.rivalTeam)) {
      if (!isFinite(t.curHP) || t.curHP < 0 || t.curHP > t.stats.hp) bad = true;
      for (const k in t.stats) if (!isFinite(t.stats[k])) bad = true;
    }
    return sim.battle.phase === 'over' && sim.battle.winner !== null && sim.guard < 300 && !bad;
  });

  r.ok('事件消息为字符串（可空）且事件流完整', function () {
    const sim = simulateBattle({ rng: mulberry32(43) });
    let bad = false;
    for (const e of sim.log) {
      if (e.msg !== undefined && typeof e.msg !== 'string') bad = true;
    }
    return !bad && sim.log.length > 10;
  });

  r.ok('AI 不会对已睡眠目标再催眠', function () {
    const b = createBattle({ rng: mulberry32(44), playerSpecies: ['psykitty'] });
    b.active[0].status = '睡眠';
    b.active[0].sleepTurns = 3;
    const act = chooseRivalAction(b);
    return act.kind === 'move' && act.moveId !== 'hypnosis';
  });

  if (extra && extra.render) extra.render(r);
  return r;
}

// 供引擎测试直接调用内部 applyMove（浏览器/Node 共享）
function applyMoveForTest(battle, side, moveId, events) {
  return applyMove(battle, side, moveId, events);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { RUN_TESTS, makeReporter, applyMoveForTest };
}
