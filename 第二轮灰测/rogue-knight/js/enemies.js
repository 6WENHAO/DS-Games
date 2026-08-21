/* enemies.js — 12 种敌人 AI + 3 个多阶段 Boss */
(function (K) {
  'use strict';
  var M = K.M, FX = K.FX, S = K.Snd, B = K.B, TS = K.TS;

  var LIST = [
    { id: 'slime', name: '史莱姆', art: 'slime', r: 15, hp: 26, speed: 1.05, dmg: 7, ai: 'chase',
      col: { a: '#6ad06a', b: '#d0ff9a' }, coin: 2, split: 1, contact: 1 },
    { id: 'bat', name: '蝙蝠', art: 'bat', r: 12, hp: 18, speed: 2.35, dmg: 6, ai: 'flyer',
      col: { a: '#7a5a8a', b: '#ff5a4a' }, coin: 2, contact: 1, fly: 1 },
    { id: 'skeleton', name: '骷髅兵', art: 'skeleton', r: 14, hp: 40, speed: 1.35, dmg: 12, ai: 'melee',
      col: { a: '#e6e0cc', b: '#8a8070' }, coin: 3, atk: { range: 46, cd: 78, windup: 26, r1: 56, half: .85, frames: 10 } },
    { id: 'archer', name: '骷髅弓手', art: 'archer', r: 13, hp: 32, speed: 1.15, dmg: 9, ai: 'shooter',
      col: { a: '#4a7a4a', b: '#8ad06a', skin: '#e6e0cc' }, coin: 4,
      atk: { range: 330, keep: 190, cd: 92, windup: 34, n: 1, spd: 7.2, style: 'arrow', size: 4, col: '#e8dcc0' } },
    { id: 'gunner', name: '地牢枪手', art: 'gunner', r: 14, hp: 44, speed: 1.2, dmg: 7, ai: 'shooter',
      col: { a: '#5a6a8a', b: '#ffd15c', skin: '#d8a273' }, coin: 5,
      atk: { range: 340, keep: 210, cd: 104, windup: 26, n: 3, gap: 9, spd: 8, style: 'bullet', size: 4.4, col: '#ffd15c', spread: .06 } },
    { id: 'bomber', name: '自爆怪', art: 'bomber', r: 14, hp: 30, speed: 1.75, dmg: 26, ai: 'bomber',
      col: { a: '#4a4a5a', b: '#ff6a3a' }, coin: 4, boom: { r: 92, dmg: 26 } },
    { id: 'spider', name: '毒蛛', art: 'spider', r: 14, hp: 34, speed: 1.5, dmg: 10, ai: 'charger',
      col: { a: '#6a4a7a', b: '#7ad04a' }, coin: 4, elem: 'poison',
      atk: { range: 250, cd: 96, windup: 30, dash: 9.5, dashT: 16 } },
    { id: 'caster', name: '暗影术士', art: 'caster', r: 14, hp: 40, speed: 1.05, dmg: 11, ai: 'caster',
      col: { a: '#4a3a6a', b: '#c06aff' }, coin: 6,
      atk: { range: 380, keep: 240, cd: 118, windup: 40, n: 2, spd: 5.4, style: 'orb', size: 7, col: '#c06aff', homing: .035 } },
    { id: 'golem', name: '石魔像', art: 'golem', r: 21, hp: 130, speed: .82, dmg: 18, ai: 'melee', heavy: 1,
      col: { a: '#7a7a8a', b: '#ffd15c' }, coin: 9,
      atk: { range: 60, cd: 118, windup: 40, r1: 80, half: 1.1, frames: 14, shock: { r: 96, dmg: 14 } } },
    { id: 'ghost', name: '怨灵', art: 'ghost', r: 13, hp: 30, speed: 1.5, dmg: 10, ai: 'ghost',
      col: { a: '#9ac0ff', b: '#eaffff' }, coin: 5, contact: 1, fly: 1, noclip: 1, elem: 'ice' },
    { id: 'plant', name: '食人花', art: 'plant', r: 16, hp: 56, speed: 0, dmg: 8, ai: 'turret',
      col: { a: '#c04a6a', b: '#7ad04a' }, coin: 5,
      atk: { range: 420, cd: 96, windup: 34, n: 5, spread: 6.283, spd: 4.6, style: 'orb', size: 6, col: '#7ad04a' } },
    { id: 'brute', name: '狂暴兽人', art: 'skeleton', r: 18, hp: 90, speed: 1.75, dmg: 16, ai: 'charger', heavy: 1,
      col: { a: '#8a5a3a', b: '#ff8a4a' }, coin: 7,
      atk: { range: 300, cd: 84, windup: 26, dash: 12, dashT: 20 } }
  ];
  var BY = {};
  LIST.forEach(function (e) { BY[e.id] = e; });

  var BOSSES = [
    { id: 'skullKing', name: '骷髅王 · 无冠者', art: 'bossSkull', r: 40, hp: 900, speed: .9, dmg: 20, boss: 1,
      col: { a: '#e8e2cc', b: '#8a3a3a' }, coin: 60, gems: 8, acts: ['volley', 'summon', 'charge', 'slam'] },
    { id: 'slimeKing', name: '史莱姆之王', art: 'bossSlime', r: 46, hp: 1150, speed: .8, dmg: 22, boss: 1,
      col: { a: '#5ad06a', b: '#ffd15c' }, coin: 70, gems: 9, acts: ['jump', 'ring', 'split', 'roll'] },
    { id: 'mechSpider', name: '机械母巢', art: 'bossMech', r: 46, hp: 1400, speed: 1.05, dmg: 24, boss: 1,
      col: { a: '#6a7a9a', b: '#ff3a5a' }, coin: 85, gems: 11, acts: ['sweep', 'missiles', 'mines', 'dash'] }
  ];

  function make(def, x, y, o) {
    o = o || {};
    var floor = K.Game.floor || 1;
    var hpMul = (1 + (floor - 1) * .42) * (o.elite ? 2.4 : 1) * (def.boss ? 1 + (floor - 1) * .3 : 1);
    var dmgMul = (1 + (floor - 1) * .2) * (o.elite ? 1.4 : 1);
    var e = {
      def: def, kind: def.art, name: def.name, x: x, y: y, r: def.r * (o.elite ? 1.2 : 1),
      hp: Math.round(def.hp * hpMul), hpMax: Math.round(def.hp * hpMul),
      speed: def.speed * (o.elite ? .92 : 1) * (1 + (floor - 1) * .03),
      dmg: def.dmg * dmgMul, col: def.col, ai: def.ai, atk: def.atk, boss: !!def.boss, elite: !!o.elite,
      alive: 1, vx: 0, vy: 0, kx: 0, ky: 0, t: M.rndi(0, 200), st: 0, stT: 0, cd: M.rndi(20, 70),
      flash: 0, flip: 0, aim: 0, stuck: 0, wander: 0, wanderA: M.rnd(M.TAU),
      burn: 0, poison: 0, slow: 0, stun: 0, dotT: 0, telegraph: 0, spawnT: 26,
      contact: def.contact ? 22 : 0, act: null, actT: 0, phase: 1, sub: 0, coin: def.coin || 2, gems: def.gems || 0
    };
    if (o.elite) { e.name = '精英 · ' + def.name; e.coin = Math.round(e.coin * 2.2); e.gems = (e.gems || 0) + 1; }
    return e;
  }
  function spawn(id, x, y, o) {
    var def = BY[id] || LIST[0];
    var e = make(def, x, y, o);
    K.Game.enemies.push(e);
    FX.ring(x, y, 4, 34, '#c06aff', 18, 3);
    FX.burst(x, y, 8, { col: '#c06aff', col2: '#eaffff', speed: 3, size: 3, flare: 0 });
    S.play('spawn', .5, .06);
    return e;
  }
  function spawnBoss(idx, x, y) {
    var def = BOSSES[idx % BOSSES.length];
    var e = make(def, x, y, {});
    e.spawnT = 60;
    K.Game.enemies.push(e);
    S.play('roar', 1);
    FX.shake(12, 40); FX.flash(.22, '#ff5a4a');
    K.Snd.setMode('boss');
    return e;
  }
  function tableFor(floor) {
    var t = [{ id: 'slime', w: 26 }, { id: 'bat', w: 20 }, { id: 'skeleton', w: 22 }, { id: 'archer', w: 16 }];
    if (floor >= 2) t = t.concat([{ id: 'bomber', w: 12 }, { id: 'spider', w: 14 }, { id: 'gunner', w: 14 }]);
    if (floor >= 3) t = t.concat([{ id: 'caster', w: 12 }, { id: 'golem', w: 9 }, { id: 'ghost', w: 11 }]);
    if (floor >= 4) t = t.concat([{ id: 'plant', w: 10 }, { id: 'brute', w: 11 }]);
    return t;
  }

  /* ---------------- 通用工具 ---------------- */
  function moveTo(e, ax, ay, mul) {
    var sp = e.speed * (e.slow > 0 ? .45 : 1) * (mul === undefined ? 1 : mul);
    var l = M.len(ax, ay) || 1;
    var dx = ax / l * sp, dy = ay / l * sp;
    if (e.def.noclip) { e.x += dx; e.y += dy; }
    else {
      var hit = K.Col.moveBody(e, dx, dy, K.Game.solid);
      if (hit.x || hit.y) e.stuck++; else e.stuck = Math.max(0, e.stuck - 1);
      if (e.stuck > 14) { e.wander = 34; e.wanderA = Math.atan2(dy, dx) + (M.chance(.5) ? 1.6 : -1.6); e.stuck = 0; }
    }
  }
  function shootAt(e, p, a, cfg) {
    var n = cfg.n || 1, i, ang;
    for (i = 0; i < n; i++) {
      if (cfg.spread >= 6) ang = a + i * M.TAU / n;
      else ang = a + (n === 1 ? 0 : (i / (n - 1) - .5) * (cfg.spread || .2) * 2);
      B.spawn({ x: e.x + Math.cos(ang) * (e.r + 6), y: e.y + Math.sin(ang) * (e.r + 6) - 2,
        vx: Math.cos(ang) * cfg.spd, vy: Math.sin(ang) * cfg.spd, r: cfg.size || 5, size: cfg.size || 5,
        dmg: e.dmg * (cfg.dmgMul || 1), team: 1, style: cfg.style || 'bullet', col: cfg.col || '#ff8a4a',
        life: cfg.life || 150, knock: 1.6, homing: cfg.homing || 0, elem: cfg.elem || e.def.elem || null,
        explode: cfg.explode || null, owner: e });
    }
    FX.muzzle(e.x + Math.cos(a) * e.r, e.y + Math.sin(a) * e.r, a, 9, cfg.col || '#ffd15c');
    S.play(cfg.sfx || 'pistol', .45, .03);
  }
  function telegraph(e, col, r) {
    e.telegraph = 1;
    if (e.t % 8 === 0) {
      S.play('warn', .2, .12);
      FX.ring(e.x, e.y, (r || e.r + 10) * .6, r || e.r + 14, col || '#ff6a4a', 12, 2);
    }
  }

  /* ---------------- AI ---------------- */
  var AI = {
    chase: function (e, p, d, a) {
      if (e.wander > 0) { e.wander--; moveTo(e, Math.cos(e.wanderA), Math.sin(e.wanderA), .8); return; }
      moveTo(e, p.x - e.x, p.y - e.y, d < 40 ? .5 : 1);
    },
    flyer: function (e, p, d, a) {
      e.bobA = (e.bobA || 0) + .13;
      var wob = Math.sin(e.t * .09) * 1.2;
      moveTo(e, p.x - e.x + Math.cos(e.t * .06) * 60, p.y - e.y + Math.sin(e.t * .08) * 50 + wob, d < 60 ? 1.25 : 1);
    },
    ghost: function (e, p, d, a) {
      moveTo(e, p.x - e.x, p.y - e.y, 1);
      if (e.t % 30 === 0) FX.trail(e.x, e.y, '#9ac0ff', 10, 20);
    },
    melee: function (e, p, d, a) {
      var A = e.atk;
      if (e.st === 0) {
        if (d > A.range) moveTo(e, p.x - e.x, p.y - e.y, 1);
        else if (e.cd <= 0) { e.st = 1; e.stT = A.windup; e.aim = a; }
        else moveTo(e, p.x - e.x, p.y - e.y, .25);
      } else if (e.st === 1) {
        telegraph(e, '#ff8a4a', e.r + A.r1 * .35);
        e.aim = M.lerp(e.aim, a, .06);
        if (--e.stT <= 0) {
          e.st = 2; e.stT = 8;
          B.swing({ owner: e, team: 1, x: e.x, y: e.y, ang: e.aim, r0: 6, r1: A.r1, half: A.half,
            frames: A.frames, dmg: e.dmg, knock: e.def.heavy ? 7 : 4, col: e.col.b, shape: 'sword', shock: A.shock });
          S.play(e.def.heavy ? 'heavy' : 'swing', .55);
          if (e.def.heavy) FX.shake(3, 12);
        }
      } else if (e.st === 2) { if (--e.stT <= 0) { e.st = 0; e.cd = e.atk.cd; } }
    },
    shooter: function (e, p, d, a) {
      var A = e.atk;
      if (e.st === 0) {
        if (d > A.range) moveTo(e, p.x - e.x, p.y - e.y, 1);
        else if (d < A.keep) moveTo(e, e.x - p.x, e.y - p.y, .85);
        else {
          var sa = a + Math.PI / 2 * (e.strafeDir || 1);
          if (e.t % 60 === 0) e.strafeDir = M.chance(.5) ? 1 : -1;
          moveTo(e, Math.cos(sa), Math.sin(sa), .55);
          if (e.cd <= 0) { e.st = 1; e.stT = A.windup; e.aim = a; }
        }
      } else if (e.st === 1) {
        telegraph(e, A.col, e.r + 12);
        e.aim = M.lerp(e.aim, a, .12);
        if (--e.stT <= 0) {
          e.st = 2; e.stT = A.gap ? A.gap * (A.n - 1) : 6; e.sub = A.gap ? A.n : 1;
          if (A.gap) { shootAt(e, p, e.aim, { n: 1, spd: A.spd, style: A.style, size: A.size, col: A.col, spread: A.spread }); e.sub--; }
          else shootAt(e, p, e.aim, A);
        }
      } else if (e.st === 2) {
        if (A.gap && e.sub > 0 && e.stT % A.gap === 0) { shootAt(e, p, e.aim, { n: 1, spd: A.spd, style: A.style, size: A.size, col: A.col, spread: A.spread }); e.sub--; }
        if (--e.stT <= 0) { e.st = 0; e.cd = A.cd; }
      }
    },
    turret: function (e, p, d, a) {
      var A = e.atk;
      if (e.st === 0) { if (d < A.range && e.cd <= 0) { e.st = 1; e.stT = A.windup; } }
      else if (e.st === 1) {
        telegraph(e, '#7ad04a', e.r + 16);
        if (--e.stT <= 0) { e.st = 2; e.stT = 10; shootAt(e, p, a + e.t * .02, A); }
      } else if (e.st === 2) { if (--e.stT <= 0) { e.st = 0; e.cd = A.cd; } }
    },
    charger: function (e, p, d, a) {
      var A = e.atk;
      if (e.st === 0) {
        moveTo(e, p.x - e.x, p.y - e.y, .8);
        if (d < A.range && e.cd <= 0) { e.st = 1; e.stT = A.windup; e.aim = a; }
      } else if (e.st === 1) {
        telegraph(e, '#ffd15c', e.r + 20);
        e.aim = M.lerp(e.aim, a, .08);
        moveTo(e, -Math.cos(e.aim), -Math.sin(e.aim), .3);
        if (--e.stT <= 0) { e.st = 2; e.stT = A.dashT; S.play('dash', .6); e.contact = Math.max(e.contact, 18); }
      } else if (e.st === 2) {
        moveTo(e, Math.cos(e.aim), Math.sin(e.aim), A.dash / e.speed);
        FX.trail(e.x, e.y, e.col.b, e.r * .7, 8);
        if (--e.stT <= 0) { e.st = 0; e.cd = A.cd; if (!e.def.contact) e.contact = 0; }
      }
    },
    bomber: function (e, p, d, a) {
      if (e.st === 0) {
        moveTo(e, p.x - e.x, p.y - e.y, 1);
        if (d < 62) { e.st = 1; e.stT = 40; S.play('warn', .6); }
      } else if (e.st === 1) {
        telegraph(e, '#ff5a3a', e.r + 30);
        moveTo(e, p.x - e.x, p.y - e.y, .5);
        if (--e.stT <= 0) { boom(e); }
      }
    },
    caster: function (e, p, d, a) {
      var A = e.atk;
      if (e.st === 0) {
        if (d < A.keep || e.blinkCd <= 0) {
          e.blinkCd = 150;
          var ang = M.rnd(M.TAU), R = 220;
          var nx = p.x + Math.cos(ang) * R, ny = p.y + Math.sin(ang) * R;
          var rm0 = K.D.roomAt(nx, ny), rmSelf = e.room !== undefined ? K.D.rooms[e.room] : null;
          var okRoom = !rmSelf || (rm0 && rm0.id === rmSelf.id);
          if (okRoom && !K.Game.solid(Math.floor(nx / TS), Math.floor(ny / TS))) {
            FX.burst(e.x, e.y, 10, { col: '#c06aff', col2: '#eaffff', speed: 4, size: 3 });
            e.x = nx; e.y = ny;
            FX.burst(e.x, e.y, 10, { col: '#c06aff', col2: '#eaffff', speed: 4, size: 3 });
            S.play('spawn', .4);
          }
        }
        e.blinkCd = (e.blinkCd || 150) - 1;
        if (d > A.range) moveTo(e, p.x - e.x, p.y - e.y, .8);
        else if (e.cd <= 0) { e.st = 1; e.stT = A.windup; }
      } else if (e.st === 1) {
        telegraph(e, '#c06aff', e.r + 18);
        if (--e.stT <= 0) { e.st = 2; e.stT = 14; shootAt(e, p, a, A); S.play('magic', .5); }
      } else if (e.st === 2) { if (--e.stT <= 0) { e.st = 0; e.cd = A.cd; } }
    },
    /* ---------------- Boss ---------------- */
    boss: function (e, p, d, a) {
      var acts = e.def.acts;
      if (!e.act) {
        if (e.cd > 0) { moveTo(e, p.x - e.x, p.y - e.y, d > 200 ? 1 : (d < 120 ? -.5 : .3)); return; }
        e.act = M.pick(acts); e.actT = 0; e.sub = 0;
        if (e.phase >= 2 && M.chance(.35)) e.act = M.pick(acts);
      }
      var fast = e.phase >= 2 ? .72 : 1;
      var F = e.def.id;
      e.actT++;
      if (F === 'skullKing') bossSkull(e, p, d, a, fast);
      else if (F === 'slimeKing') bossSlime(e, p, d, a, fast);
      else bossMech(e, p, d, a, fast);
    }
  };
  function endAct(e, cd) { e.act = null; e.actT = 0; e.cd = cd; e.telegraph = 0; }

  function bossSkull(e, p, d, a, fast) {
    var t = e.actT;
    if (e.act === 'volley') {
      if (t < 40 * fast) { telegraph(e, '#ff6a3a', e.r + 26); moveTo(e, p.x - e.x, p.y - e.y, .12); }
      else if (t % Math.round(14 * fast) === 0 && t < (e.phase >= 2 ? 150 : 110)) {
        var n = e.phase >= 2 ? 12 : 9, off = t * .07;
        for (var i = 0; i < n; i++) {
          var ang = off + i * M.TAU / n;
          B.spawn({ x: e.x + Math.cos(ang) * e.r, y: e.y + Math.sin(ang) * e.r, vx: Math.cos(ang) * 5.2, vy: Math.sin(ang) * 5.2,
            r: 6, size: 6, dmg: e.dmg * .55, team: 1, style: 'bullet', col: '#e8e2cc', life: 190, knock: 1.4 });
        }
        S.play('rifle', .5);
      } else if (t > (e.phase >= 2 ? 160 : 120)) endAct(e, 60);
    } else if (e.act === 'summon') {
      if (t < 46) telegraph(e, '#c06aff', e.r + 30);
      else if (t === 46) {
        S.play('spawn', .8);
        var cnt = e.phase >= 2 ? 4 : 2;
        for (var j = 0; j < cnt; j++) {
          var ang2 = M.rnd(M.TAU), R = 90;
          var mn = spawn(M.chance(.5) ? 'skeleton' : 'bat', e.x + Math.cos(ang2) * R, e.y + Math.sin(ang2) * R, {});
          mn.room = e.room;
        }
      } else if (t > 70) endAct(e, 90);
    } else if (e.act === 'charge') {
      if (t < 40) { telegraph(e, '#ffd15c', e.r + 26); e.aim = M.lerp(e.aim, a, .1); }
      else if (t < 40 + 46 * (2 - fast)) {
        moveTo(e, Math.cos(e.aim), Math.sin(e.aim), 5.2);
        e.contact = 20; FX.trail(e.x, e.y, '#ffd15c', e.r * .8, 9);
        if (e.stuck > 2) { FX.shake(9, 16); B.explode(e.x, e.y, 80, e.dmg * .6, 1, '#ffd15c'); endAct(e, 70); }
      } else { e.contact = e.def.contact ? 22 : 0; endAct(e, 70); }
    } else if (e.act === 'slam') {
      if (t < 44) { telegraph(e, '#ff3a5a', e.r + 40); }
      else if (t === 44) {
        S.play('explode', .9); FX.shake(14, 26);
        for (var k = 0; k < 3; k++) {
          var rr = 90 + k * 70;
          FX.ring(e.x, e.y, rr * .5, rr, '#ff8a4a', 22, 5);
        }
        B.explode(e.x, e.y, 170, e.dmg * .8, 1, '#ff8a4a');
        var n2 = 18;
        for (var q = 0; q < n2; q++) {
          var ag = q * M.TAU / n2 + .1;
          B.spawn({ x: e.x + Math.cos(ag) * 40, y: e.y + Math.sin(ag) * 40, vx: Math.cos(ag) * 4, vy: Math.sin(ag) * 4,
            r: 7, size: 7, dmg: e.dmg * .5, team: 1, style: 'bullet', col: '#ff8a4a', life: 150 });
        }
      } else if (t > 70) endAct(e, 80);
    }
  }
  function bossSlime(e, p, d, a, fast) {
    var t = e.actT;
    if (e.act === 'jump') {
      if (t < 34) { telegraph(e, '#5ad06a', e.r + 24); e.jz = 0; }
      else if (t < 34 + 30) {
        e.jz = Math.sin((t - 34) / 30 * Math.PI) * 90;
        var tx = p.x, ty = p.y;
        e.x = M.lerp(e.x, tx, .09); e.y = M.lerp(e.y, ty, .09);
        FX.ring(p.x, p.y, e.r * 1.2, e.r * 1.3, '#ff5a4a', 4, 2);
      } else if (t === 64) {
        e.jz = 0; S.play('explode', .8); FX.shake(13, 22);
        B.explode(e.x, e.y, 130, e.dmg, 1, '#7ad06a');
        for (var i = 0; i < 10; i++) {
          var ag = i * M.TAU / 10;
          B.spawn({ x: e.x, y: e.y, vx: Math.cos(ag) * 5, vy: Math.sin(ag) * 5, r: 8, size: 8, dmg: e.dmg * .4,
            team: 1, style: 'orb', col: '#7ad06a', life: 90, elem: 'poison' });
        }
      } else if (t > 90) endAct(e, 60);
    } else if (e.act === 'ring') {
      if (t < 30) telegraph(e, '#ffd15c', e.r + 20);
      else if (t % 16 === 0 && t < 120) {
        var n = e.phase >= 2 ? 16 : 12, off = t * .05;
        for (var j = 0; j < n; j++) {
          var ang = off + j * M.TAU / n;
          B.spawn({ x: e.x + Math.cos(ang) * e.r, y: e.y + Math.sin(ang) * e.r, vx: Math.cos(ang) * 4.4, vy: Math.sin(ang) * 4.4,
            r: 7, size: 7, dmg: e.dmg * .5, team: 1, style: 'orb', col: '#8ad06a', life: 170, elem: 'poison' });
        }
        S.play('magic', .45);
      } else if (t > 130) endAct(e, 66);
    } else if (e.act === 'split') {
      if (t < 40) telegraph(e, '#d0ff9a', e.r + 26);
      else if (t === 40) { for (var k = 0; k < (e.phase >= 2 ? 5 : 3); k++) { var sm = spawn('slime', e.x + M.rnd(-70, 70), e.y + M.rnd(-70, 70), {}); sm.room = e.room; } S.play('spawn', .8); }
      else if (t > 64) endAct(e, 80);
    } else if (e.act === 'roll') {
      if (t < 34) { telegraph(e, '#ff8a4a', e.r + 22); e.aim = M.lerp(e.aim, a, .12); }
      else if (t < 34 + 80) {
        e.rollA = (e.rollA || e.aim);
        moveTo(e, Math.cos(e.rollA), Math.sin(e.rollA), 4.4);
        e.contact = 22; e.spinV = (e.spinV || 0) + .3;
        if (e.stuck > 2) { e.rollA += Math.PI * M.rnd(.6, 1.4); FX.shake(7, 12); e.stuck = 0; }
        FX.trail(e.x, e.y, '#7ad06a', e.r * .8, 8);
      } else { e.contact = 22; e.spinV = 0; endAct(e, 70); }
    }
  }
  function bossMech(e, p, d, a, fast) {
    var t = e.actT;
    if (e.act === 'sweep') {
      if (t < 40) { telegraph(e, '#ff3a5a', e.r + 30); e.aim = a; }
      else if (t < 40 + 110) {
        var dir = e.sweepDir || (e.sweepDir = M.chance(.5) ? 1 : -1);
        var ang = e.aim - dir * 1.1 + dir * ((t - 40) / 110) * 2.2;
        var r = K.Col.ray(e.x, e.y, Math.cos(ang), Math.sin(ang), 900, K.Game.solid);
        FX.beam(e.x, e.y, r.x, r.y, '#ff5a6a', 9, 3);
        FX.light(r.x, r.y, 70, '#ff5a6a', 4);
        var dd = B.segDist(p.x, p.y, e.x, e.y, r.x, r.y);
        if (dd < p.r + 8 && t % 4 === 0) K.Game.hurtPlayer(e.dmg * .5, { dirX: Math.cos(ang), dirY: Math.sin(ang), knock: 2 });
        if (t % 20 === 0) S.play('beam', .5);
      } else { e.sweepDir = 0; endAct(e, 60); }
    } else if (e.act === 'missiles') {
      if (t < 34) telegraph(e, '#ffd15c', e.r + 22);
      else if (t % 12 === 0 && t < 100) {
        var ag = a + M.rnd(-.9, .9);
        B.spawn({ x: e.x + Math.cos(ag) * e.r, y: e.y + Math.sin(ag) * e.r, vx: Math.cos(ag) * 4.4, vy: Math.sin(ag) * 4.4,
          r: 6, size: 6, dmg: e.dmg * .55, team: 1, style: 'rocket', col: '#ff9a2e', life: 220, homing: .04,
          explode: { r: 66, dmg: e.dmg * .5 } });
        S.play('rocket', .5);
      } else if (t > 110) endAct(e, 70);
    } else if (e.act === 'mines') {
      if (t < 26) telegraph(e, '#7ad04a', e.r + 20);
      else if (t % 10 === 0 && t < 90) {
        var ang2 = M.rnd(M.TAU), R = M.rnd(60, 220);
        B.spawn({ x: e.x, y: e.y, vx: Math.cos(ang2) * M.rnd(3, 7), vy: Math.sin(ang2) * M.rnd(3, 7), r: 7, size: 7,
          dmg: e.dmg * .4, team: 1, style: 'grenade', col: '#7ad04a', life: 120, explode: { r: 74, dmg: e.dmg * .55 } });
      } else if (t > 100) endAct(e, 60);
    } else if (e.act === 'dash') {
      if (t < 30) { telegraph(e, '#ff3a5a', e.r + 24); e.aim = M.lerp(e.aim, a, .16); }
      else if (t < 30 + 40) {
        moveTo(e, Math.cos(e.aim), Math.sin(e.aim), 5);
        e.contact = 20;
        FX.trail(e.x, e.y, '#ff3a5a', e.r * .7, 8);
        if (e.stuck > 2) { FX.shake(8, 14); endAct(e, 50); }
      } else { e.contact = 0; endAct(e, 55); }
    }
  }

  function boom(e) {
    B.explode(e.x, e.y, e.def.boom.r, e.dmg, 1, '#ff8a3a');
    e.hp = 0; e.alive = 0; e.exploded = 1;
    K.Game.onEnemyDeath(e, 1);
  }

  /* ---------------- 更新 ---------------- */
  function update(e) {
    var p = K.Game.player;
    e.t++;
    if (e.flash > 0) e.flash--;
    if (e.spawnT > 0) { e.spawnT--; return; }
    /* 状态效果 */
    if (e.burn > 0) { e.burn--; if (e.burn % 24 === 0) { K.Game.hurtEnemy(e, 3 + K.Game.floor, { small: 1, noKnock: 1, elem: 'fire' }); } if (e.t % 4 === 0) FX.part({ type: 'flame', x: e.x + M.rnd(-6, 6), y: e.y + M.rnd(-8, 4), vy: -1, r: 6, life: 14, col: '#ff7a2a', drag: .94 }); }
    if (e.poison > 0) { e.poison--; if (e.poison % 30 === 0) K.Game.hurtEnemy(e, 2 + K.Game.floor * .7, { small: 1, noKnock: 1, elem: 'poison' }); if (e.t % 7 === 0) FX.part({ type: 'shard', x: e.x + M.rnd(-8, 8), y: e.y + M.rnd(-8, 4), vy: -.6, r: 2.4, life: 18, col: '#7ad04a', drag: .95 }); }
    if (e.slow > 0) { e.slow--; if (e.t % 8 === 0) FX.part({ type: 'shard', x: e.x + M.rnd(-8, 8), y: e.y + M.rnd(-8, 8), r: 2, life: 12, col: '#9adfff', drag: .9 }); }
    if (e.stun > 0) { e.stun--; if (e.t % 5 === 0) FX.spark(e.x, e.y - e.r, M.rnd(M.TAU), 1, '#ffd15c'); }
    if (!e.alive) return;
    /* 击退 */
    if (Math.abs(e.kx) > .05 || Math.abs(e.ky) > .05) {
      K.Col.moveBody(e, e.kx, e.ky, K.Game.solid);
      e.kx *= .82; e.ky *= .82;
    }
    if (e.cd > 0) e.cd--;
    e.telegraph = 0;
    if (e.stun > 0) return;
    if (!p || !p.alive) return;
    var d = M.len(p.x - e.x, p.y - e.y), a = Math.atan2(p.y - e.y, p.x - e.x);
    e.flip = Math.cos(a) < 0 ? 1 : 0;
    (e.boss ? AI.boss : (AI[e.ai] || AI.chase))(e, p, d, a);
    /* 接触伤害 */
    if (e.contact > 0 && d < e.r + p.r) {
      K.Game.hurtPlayer(e.dmg * (e.def.contact ? 1 : 1.2), { dirX: (p.x - e.x) / (d || 1), dirY: (p.y - e.y) / (d || 1), knock: 5 });
      e.kx -= (p.x - e.x) / (d || 1) * 2; e.ky -= (p.y - e.y) / (d || 1) * 2;
    }
    /* Boss 阶段 */
    if (e.boss && e.phase === 1 && e.hp < e.hpMax * .5) {
      e.phase = 2; e.speed *= 1.18;
      FX.flash(.3, '#ff5a4a'); FX.shake(14, 30); FX.ring(e.x, e.y, 20, 220, '#ff3a5a', 30, 7);
      S.play('roar', 1); FX.text(e.x, e.y - e.r - 30, '狂暴！', { col: '#ff5a4a', size: 22, life: 60 });
    }
  }
  /* 敌人之间的软推挤 */
  function separate(list) {
    for (var i = 0; i < list.length; i++) {
      var a = list[i]; if (!a.alive || a.boss) continue;
      for (var j = i + 1; j < list.length; j++) {
        var b = list[j]; if (!b.alive) continue;
        var dx = b.x - a.x, dy = b.y - a.y, rr = a.r + b.r;
        var d2 = dx * dx + dy * dy;
        if (d2 < rr * rr && d2 > .01) {
          var d = Math.sqrt(d2), pushv = (rr - d) * .28;
          var ux = dx / d, uy = dy / d;
          var wa = b.boss ? 1 : .5, wb = a.boss ? 1 : .5;
          a.x -= ux * pushv * wa; a.y -= uy * pushv * wa;
          if (!b.boss) { b.x += ux * pushv * wb; b.y += uy * pushv * wb; }
        }
      }
    }
  }

  /* ---------------- 绘制 ---------------- */
  function draw(e, ctx, V) {
    var s = V.z * (e.elite ? 1.18 : 1) * (e.boss ? 1.9 : 1);
    var x = V.tx(e.x), y = V.ty(e.y - (e.jz || 0));
    var sp = e.spawnT > 0 ? 1 - e.spawnT / 26 : 1;
    K.Art.shadow(ctx, V.tx(e.x), V.ty(e.y) + 2 * V.z, e.r * .95 * V.z, e.r * .42 * V.z, e.jz ? .18 : .3);
    if (e.spawnT > 0) { ctx.save(); ctx.globalAlpha = sp; }
    if (e.elite || e.boss) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      var g = ctx.createRadialGradient(x, y, 0, x, y, e.r * 2.4 * s / (e.boss ? 1.6 : 1));
      g.addColorStop(0, e.boss ? 'rgba(255,60,90,.32)' : 'rgba(255,200,60,.28)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, e.r * 2.4 * s / (e.boss ? 1.6 : 1), 0, M.TAU); ctx.fill();
      ctx.restore();
    }
    var o = { t: e.t, flip: e.flip, col: e.col, telegraph: e.telegraph, alpha: e.def.noclip ? .8 : 1 };
    if (e.flash > 0) {
      ctx.save();
      K.Art.enemy(ctx, x, y, s, e.kind, { t: e.t, flip: e.flip, col: { a: '#ffffff', b: '#ffffff', skin: '#ffffff' }, telegraph: e.telegraph });
      ctx.restore();
    } else K.Art.enemy(ctx, x, y, s, e.kind, o);
    if (e.spawnT > 0) ctx.restore();
    /* 状态与血条 */
    if (e.slow > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .25; K.Art.circle(ctx, x, y, e.r * 1.1 * V.z, '#6ad4ff', 0); ctx.restore(); }
    if (e.hp < e.hpMax && !e.boss) {
      var w = Math.max(22, e.r * 2.2) * V.z, h = 4 * V.z, by = y - (e.r + 16) * V.z;
      ctx.fillStyle = 'rgba(10,8,16,.75)'; ctx.fillRect(x - w / 2, by, w, h);
      ctx.fillStyle = e.elite ? '#ffc23a' : '#ff5a5a';
      ctx.fillRect(x - w / 2, by, w * (e.hp / e.hpMax), h);
    }
    if (e.telegraph) {
      ctx.save(); ctx.globalAlpha = .55 + Math.sin(e.t * .6) * .3;
      ctx.strokeStyle = '#ff5a4a'; ctx.lineWidth = 2 * V.z;
      ctx.beginPath(); ctx.arc(x, y, (e.r + 14) * V.z, 0, M.TAU); ctx.stroke(); ctx.restore();
    }
  }
  K.E = { LIST: LIST, BY: BY, BOSSES: BOSSES, spawn: spawn, spawnBoss: spawnBoss, tableFor: tableFor,
    update: update, draw: draw, separate: separate, make: make, boom: boom };
})(window.K);
