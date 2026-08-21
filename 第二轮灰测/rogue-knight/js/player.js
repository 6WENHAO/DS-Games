/* player.js — 8 名可玩角色 / 技能 / 属性成长 */
(function (K) {
  'use strict';
  var M = K.M, FX = K.FX, S = K.Snd, B = K.B;

  var CHARS = [
    { id: 'knight', name: '骑士 亚瑟', title: '冲锋与钢铁', hp: 120, armor: 3, energy: 100, speed: 3.05, crit: 5,
      pal: { body: '#4a6aa8', pants: '#3a4a68', skin: '#f0c8a0', hair: '#c8d2e4', hat: 'helm', belt: '#2a3244', cape: '#c0392b' },
      weapon: 'w1', skill: { id: 'charge', name: '盾牌冲锋', cd: 300, energy: 30, desc: '向前冲锋，撞开并击伤敌人，期间无敌' }, unlock: 0,
      desc: '高护甲近战英雄，冲锋开路' },
    { id: 'ranger', name: '游侠 希尔', title: '百步穿杨', hp: 95, armor: 2, energy: 110, speed: 3.35, crit: 12,
      pal: { body: '#3f7a52', pants: '#3a4a3a', skin: '#e8b184', hair: '#5a3a22', hat: 'hood', belt: '#2a3a2a' },
      weapon: 'b1', skill: { id: 'rain', name: '箭雨', cd: 330, energy: 34, desc: '在瞄准处召唤大量箭矢从天而降' }, unlock: 0,
      desc: '远程输出高，暴击起手' },
    { id: 'mage', name: '法师 莉娜', title: '霜与火', hp: 85, armor: 2, energy: 150, speed: 3.1, crit: 8,
      pal: { body: '#6a4aa8', pants: '#4a3a6a', skin: '#f6cfae', hair: '#8a5ad0', hat: 'wizard', belt: '#3a2a5a' },
      weapon: 'm1', skill: { id: 'nova', name: '冰霜新星', cd: 300, energy: 40, desc: '冻结并伤害周围所有敌人' }, unlock: 0,
      desc: '能量池巨大，法杖专精' },
    { id: 'rogue', name: '刺客 影', title: '一击致命', hp: 88, armor: 1, energy: 100, speed: 3.6, crit: 20,
      pal: { body: '#2f3444', pants: '#22262f', skin: '#e8c0a0', hair: '#1a1a24', hat: 'hood', belt: '#8a2a3a' },
      weapon: 'w5', skill: { id: 'shadow', name: '影袭', cd: 240, energy: 26, desc: '瞬移一段距离并进入隐身，暴击率大幅提升' }, unlock: 0,
      desc: '最快的移动与最高的暴击' },
    { id: 'engineer', name: '工程师 铆钉', title: '火力覆盖', hp: 105, armor: 3, energy: 120, speed: 2.95, crit: 6,
      pal: { body: '#b06a2a', pants: '#4a4a52', skin: '#d8a273', hair: '#3a3a44', hat: 'helm', belt: '#2a2a34' },
      weapon: 'r1', skill: { id: 'turret', name: '部署炮台', cd: 420, energy: 40, desc: '放置自动射击的哨兵炮台' }, unlock: 60,
      desc: '炮台协同作战，弹药充足' },
    { id: 'berserker', name: '狂战士 格罗', title: '以血换血', hp: 150, armor: 0, energy: 90, speed: 3.15, crit: 10,
      pal: { body: '#8a3a2a', pants: '#5a2a22', skin: '#c88a5a', hair: '#c04a2a', hat: 'none', belt: '#3a1a12' },
      weapon: 'w2', skill: { id: 'rage', name: '狂暴', cd: 360, energy: 30, desc: '短时间内攻速与伤害大增并吸血，受伤增加' }, unlock: 80,
      desc: '生命最厚，越战越勇' },
    { id: 'paladin', name: '圣骑士 塞拉', title: '圣光庇护', hp: 130, armor: 4, energy: 130, speed: 2.9, crit: 6,
      pal: { body: '#d8c070', pants: '#8a7a4a', skin: '#f0c8a0', hair: '#f0e0a0', hat: 'pony', belt: '#6a5a2a', cape: '#e8e8f0' },
      weapon: 'w3', skill: { id: 'holy', name: '圣光爆发', cd: 330, energy: 44, desc: '治疗自身、补满护甲并灼伤周围敌人' }, unlock: 120,
      desc: '续航之王，团灭近身敌人' },
    { id: 'elementalist', name: '元素师 沃恩', title: '天降陨石', hp: 90, armor: 2, energy: 160, speed: 3.05, crit: 9,
      pal: { body: '#2a6a8a', pants: '#2a4a5a', skin: '#e8b184', hair: '#6ad4ff', hat: 'wizard', belt: '#1a3a4a' },
      weapon: 'm3', skill: { id: 'meteor', name: '陨石天降', cd: 390, energy: 50, desc: '在瞄准区域召唤三颗陨石' }, unlock: 150,
      desc: '范围爆发最强的法系' }
  ];
  var CBY = {}; CHARS.forEach(function (c) { CBY[c.id] = c; });

  function baseMods() {
    return { dmgMul: 1, rateMul: 1, extraBullets: 0, crit: 0, pierce: 0, knockMul: 1, speedMul: 1,
      magnet: 0, luck: 0, leech: 0, thorns: 0, explodeBullets: 0, homing: 0, bounce: 0, forceElem: null,
      armorMax: 0, energyRegen: 1, dashCdMul: 1, dashInv: 0, reactInv: 0, rangeMul: 1, skillCdMul: 1,
      coinMul: 1, armorFast: 0, shakeMul: 1 };
  }
  function create(chId, meta) {
    var c = CBY[chId] || CHARS[0];
    var up = (meta && meta.up) || {};
    var p = {
      ch: c, x: 0, y: 0, r: 13, vx: 0, vy: 0, aim: 0, moveT: 0, moving: 0, alive: 1,
      hpMax: c.hp + (up.hp || 0) * 12, hp: 0, armorMax: c.armor + (up.armor || 0), armor: 0,
      energyMax: c.energy + (up.energy || 0) * 12, energy: 0,
      speed: c.speed * (1 + (up.speed || 0) * .03),
      invT: 0, dashT: 0, dashCd: 0, dashA: 0, skillCd: 0, skillT: 0, skillData: null,
      fireCd: 0, burst: null, chargeT: 0, recoil: 0, recoilA: 0, fireFlash: 0, noEnergyT: 0,
      hurtT: 0, hitFlash: 0, coins: 0, gems: 0, kills: 0, relics: [], relicIds: [],
      weapons: [], slot: 0, mods: baseMods(), noDmgT: 0, invis: 0, rageT: 0, critBonus: 0,
      steps: 0, dmgDealt: 0
    };
    p.mods.crit += c.crit + (up.crit || 0) * 2;
    p.mods.dmgMul *= 1 + (up.dmg || 0) * .05;
    p.mods.luck += (up.luck || 0);
    p.mods.magnet += (up.magnet || 0) * 22;
    p.armorMax += p.mods.armorMax;
    p.hp = p.hpMax; p.armor = p.armorMax; p.energy = p.energyMax;
    give(p, K.W.BY[c.weapon]);
    give(p, K.W.BY['p1']);
    p.slot = 0;                       /* 默认握本命武器 */
    return p;
  }
  /* 装备武器：两个槽位，满了则替换当前槽并返回旧武器 */
  function give(p, w) {
    if (!w) return null;
    if (p.weapons.length < 2) { p.weapons.push(w); p.slot = p.weapons.length - 1; return null; }
    var old = p.weapons[p.slot];
    p.weapons[p.slot] = w;
    return old;
  }
  function swap(p) {
    if (p.weapons.length < 2) return;
    p.slot = (p.slot + 1) % p.weapons.length;
    p.fireCd = Math.max(p.fireCd, 8); p.chargeT = 0; p.burst = null;
    S.play('menu', .8);
    FX.text(p.x, p.y - 36, p.weapons[p.slot].name, { col: K.W.RCOL[p.weapons[p.slot].rarity - 1], size: 12, life: 34 });
  }
  function weapon(p) { return p.weapons[p.slot]; }
  function addRelic(p, r) {
    if (!r) return;
    p.relics.push(r); p.relicIds.push(r.id);
    r.f(p.mods, p);
    p.armorMax = p.ch.armor + p.mods.armorMax + ((K.Game.meta && K.Game.meta.up.armor) || 0);
  }

  /* ---------------- 技能 ---------------- */
  function useSkill(p) {
    var sk = p.ch.skill;
    if (p.skillCd > 0) { S.play('no', .4); return false; }
    if (p.energy < sk.energy) { S.play('no', .5); FX.text(p.x, p.y - 40, '能量不足', { col: '#9adfff', size: 12, life: 26 }); return false; }
    p.energy -= sk.energy;
    p.skillCd = Math.round(sk.cd * p.mods.skillCdMul);
    S.play('skill', 1);
    FX.ring(p.x, p.y, 10, 90, '#ffd15c', 18, 4);
    FX.shake(4, 14);
    var a = p.aim, i;
    switch (sk.id) {
      case 'charge': {
        p.dashT = 26; p.dashA = a; p.invT = Math.max(p.invT, 30); p.chargeSkill = 1;
        FX.flash(.1, '#9adfff');
        break;
      }
      case 'rain': {
        var tx = p.x + Math.cos(a) * 200, ty = p.y + Math.sin(a) * 200;
        p.skillT = 60; p.skillData = { kind: 'rain', x: tx, y: ty, t: 0 };
        FX.ring(tx, ty, 20, 150, '#8ad06a', 40, 4);
        break;
      }
      case 'nova': {
        var list = K.Game.enemies;
        FX.ring(p.x, p.y, 20, 260, '#9adfff', 30, 8);
        FX.flash(.18, '#cfeaff'); S.play('freeze', 1);
        for (i = 0; i < list.length; i++) {
          var e = list[i];
          if (!e.alive) continue;
          var d = M.len(e.x - p.x, e.y - p.y);
          if (d < 250) {
            K.Game.hurtEnemy(e, 34 * p.mods.dmgMul, { elem: 'ice', knock: 4, dirX: (e.x - p.x) / (d || 1), dirY: (e.y - p.y) / (d || 1) });
            e.slow = Math.max(e.slow, 200); e.stun = Math.max(e.stun, 60);
          }
        }
        break;
      }
      case 'shadow': {
        var nx = p.x + Math.cos(a) * 210, ny = p.y + Math.sin(a) * 210;
        for (i = 0; i < 8; i++) {
          var t = i / 8, mx = M.lerp(p.x, nx, t), my = M.lerp(p.y, ny, t);
          if (!K.Game.solid(Math.floor(mx / K.TS), Math.floor(my / K.TS))) { p.x = mx; p.y = my; }
        }
        p.invis = 200; p.invT = Math.max(p.invT, 20); p.critBonus = 45;
        FX.burst(nx, ny, 14, { col: '#c06aff', col2: '#eaffff', speed: 4, size: 3 });
        break;
      }
      case 'turret': {
        K.Game.allies.push({ kind: 'turret', x: p.x + Math.cos(a) * 40, y: p.y + Math.sin(a) * 40, r: 12,
          life: 720, t: 0, cd: 0, aim: a, dmg: 7 * p.mods.dmgMul, owner: p });
        break;
      }
      case 'rage': {
        p.rageT = 420;
        FX.flash(.14, '#ff5a3a');
        break;
      }
      case 'holy': {
        p.hp = Math.min(p.hpMax, p.hp + p.hpMax * .35); p.armor = p.armorMax;
        FX.ring(p.x, p.y, 20, 240, '#ffd15c', 30, 8); FX.flash(.2, '#fff0c0'); S.play('heal', 1);
        var l2 = K.Game.enemies;
        for (i = 0; i < l2.length; i++) {
          var e2 = l2[i]; if (!e2.alive) continue;
          var d2 = M.len(e2.x - p.x, e2.y - p.y);
          if (d2 < 230) { K.Game.hurtEnemy(e2, 40 * p.mods.dmgMul, { elem: 'fire', knock: 5, dirX: (e2.x - p.x) / (d2 || 1), dirY: (e2.y - p.y) / (d2 || 1) }); e2.burn = Math.max(e2.burn, 150); }
        }
        break;
      }
      case 'meteor': {
        var mx2 = p.x + Math.cos(a) * 200, my2 = p.y + Math.sin(a) * 200;
        p.skillT = 90; p.skillData = { kind: 'meteor', x: mx2, y: my2, t: 0, n: 0 };
        break;
      }
    }
    return true;
  }
  function skillTick(p) {
    if (p.skillT <= 0 || !p.skillData) return;
    p.skillT--;
    var d = p.skillData; d.t++;
    if (d.kind === 'rain') {
      if (d.t % 4 === 0) {
        for (var i = 0; i < 2; i++) {
          var ox = M.rnd(-110, 110), oy = M.rnd(-110, 110);
          B.spawn({ x: d.x + ox, y: d.y + oy - 240, vx: 0, vy: 16, r: 6, size: 6, noWall: 1,
            dmg: 13 * p.mods.dmgMul, team: 0, style: 'arrow', col: '#8ad06a', life: 16, pierce: 1, knock: 2, crit: p.mods.crit, owner: p });
        }
        S.play('bow', .35, .05);
      }
      FX.ring(d.x, d.y, 140, 150, '#8ad06a', 6, 2);
    } else if (d.kind === 'meteor') {
      if (d.t % 26 === 0 && d.n < 3) {
        d.n++;
        var tx = d.x + M.rnd(-80, 80), ty = d.y + M.rnd(-80, 80);
        FX.ring(tx, ty, 30, 90, '#ff7a2a', 24, 4);
        B.spawn({ x: tx + 40, y: ty - 300, vx: -2, vy: 15, r: 13, size: 13, dmg: 26 * p.mods.dmgMul, team: 0,
          style: 'orb', col: '#ff9a2e', life: 20, noWall: 1, elem: 'fire', explode: { r: 110, dmg: 48 * p.mods.dmgMul }, crit: p.mods.crit, owner: p });
        S.play('rocket', .8);
      }
    }
    if (p.skillT <= 0) p.skillData = null;
  }

  /* ---------------- 更新 ---------------- */
  function update(p) {
    if (!p.alive) { p.hitFlash = Math.max(0, p.hitFlash - 1); return; }
    var In = K.In, G = K.Game;
    p.moveT++;
    if (p.invT > 0) p.invT--;
    if (p.hitFlash > 0) p.hitFlash--;
    if (p.fireCd > 0) p.fireCd--;
    if (p.dashCd > 0) p.dashCd--;
    if (p.skillCd > 0) p.skillCd--;
    if (p.noEnergyT > 0) p.noEnergyT--;
    if (p.invis > 0) { p.invis--; if (p.invis === 0) p.critBonus = 0; }
    if (p.rageT > 0) p.rageT--;
    p.noDmgT++;
    /* 护甲回复 */
    if (p.noDmgT > (p.mods.armorFast ? 150 : 240) && p.armor < p.armorMax && p.noDmgT % 60 === 0) {
      p.armor++; S.play('shield', .5); FX.ring(p.x, p.y, 10, 30, '#7fb0ff', 14, 2);
    }
    /* 能量回复 */
    if (p.moveT % 12 === 0) p.energy = Math.min(p.energyMax, p.energy + .9 * p.mods.energyRegen);
    /* 瞄准 */
    var st = In.stickAim();
    if (st) p.aim = Math.atan2(st.y, st.x);
    else if (In.mouse.moved > 0 || !G.autoAim) {
      p.aim = Math.atan2(In.mouse.y - G.view().sy(p.y), In.mouse.x - G.view().sx(p.x));
    } else {
      var tg = B.nearest(p.x, p.y, 0, 560);
      if (tg) p.aim = Math.atan2(tg.y - p.y, tg.x - p.x);
    }
    /* 移动 */
    var mv = In.move();
    var sp = p.speed * p.mods.speedMul * (p.rageT > 0 ? 1.1 : 1);
    if (p.dashT > 0) {
      p.dashT--;
      var ds = 8.6 * (p.chargeSkill ? 1.25 : 1);
      K.Col.moveBody(p, Math.cos(p.dashA) * ds, Math.sin(p.dashA) * ds, G.solid);
      FX.trail(p.x, p.y, p.chargeSkill ? '#9adfff' : '#cfd6e4', 9, 10);
      if (p.chargeSkill) {
        var list = G.enemies;
        for (var i = 0; i < list.length; i++) {
          var e = list[i];
          if (e.alive && M.len(e.x - p.x, e.y - p.y) < e.r + p.r + 8) {
            if (!e._chg) {
              e._chg = 1;
              G.hurtEnemy(e, 30 * p.mods.dmgMul, { knock: 12, dirX: Math.cos(p.dashA), dirY: Math.sin(p.dashA), crit: p.mods.crit });
            }
          }
        }
      }
      if (p.dashT === 0) { p.chargeSkill = 0; G.enemies.forEach(function (e) { e._chg = 0; }); }
    } else {
      p.moving = mv.l > .1;
      if (p.moving) {
        K.Col.moveBody(p, mv.x * sp, mv.y * sp, G.solid);
        p.steps++;
        if (p.steps % 16 === 0) FX.part({ type: 'smoke', x: p.x + M.rnd(-4, 4), y: p.y + 8, r: 3.4, life: 14, col: '#8a8272', drag: .9, grow: .2 });
      }
      /* 翻滚 */
      if ((In.tap('Space') || In.padDown(0)) && p.dashCd <= 0) {
        p.dashT = 13; p.dashCd = Math.round(46 * p.mods.dashCdMul);
        p.dashA = mv.l > .1 ? Math.atan2(mv.y, mv.x) : p.aim;
        p.invT = Math.max(p.invT, 13 + p.mods.dashInv);
        S.play('dash', .8);
        FX.burst(p.x, p.y, 7, { col: '#cfd6e4', col2: '#ffffff', speed: 3, size: 3, flare: 0 });
      }
    }
    /* 技能 */
    if ((In.tap('KeyF') || In.mouse.rdown && !In.mouse.prdown || In.padDown(1)) && p.skillCd <= 0) useSkill(p);
    skillTick(p);
    /* 换武器 / 互动 */
    if (In.tap('KeyQ') || In.mouse.wheel) swap(p);
    if (In.tap('KeyE') || In.padDown(2)) K.I.interact(p);
    /* 开火 */
    var w = weapon(p);
    if (w) {
      var firing = In.fire();
      var rageMods = p.mods;
      if (p.rageT > 0) { rageMods = Object.create(p.mods); rageMods.rateMul = p.mods.rateMul * 1.6; rageMods.dmgMul = p.mods.dmgMul * 1.3; }
      if (p.critBonus) { rageMods = rageMods === p.mods ? Object.create(p.mods) : rageMods; rageMods.crit = p.mods.crit + p.critBonus; }
      if (p.burst) {
        p.burst.t++;
        if (p.burst.t % p.burst.gap === 0 && p.burst.left > 1) { p.burst.left--; K.W.shot(p, p.burst.w, p.burst.aim, rageMods); }
        if (p.burst.left <= 1) p.burst = null;
      } else if (w.charge) {
        if (firing) {
          p.chargeT++;
          if (p.chargeT % 6 === 0) FX.light(p.x + Math.cos(p.aim) * 20, p.y + Math.sin(p.aim) * 20, 30 + p.chargeT, w.bcol, 5);
          if (p.chargeT >= 45) K.W.fire(p, w, p.aim, rageMods);      /* 蓄满自动释放 */
        } else if (p.chargeT > 0) K.W.fire(p, w, p.aim, rageMods);   /* 松手释放 */
      } else if (firing) {
        K.W.fire(p, w, p.aim, rageMods);                              /* 按住持续射击 */
      }
      p.fireHeld = firing;
    }
    if (p.recoil > 0) p.recoil *= .8;
    if (p.fireFlash > 0) p.fireFlash--;
  }

  /* ---------------- 绘制 ---------------- */
  function draw(p, ctx, V) {
    if (!p) return;
    var x = V.tx(p.x), y = V.ty(p.y), s = V.z;
    K.Art.shadow(ctx, x, y + 3 * s, 12 * s, 5 * s, .3);
    var rx = -Math.cos(p.recoilA) * p.recoil * .5 * s, ry = -Math.sin(p.recoilA) * p.recoil * .5 * s;
    var o = { pal: p.ch.pal, aim: p.aim, moveT: p.moveT, moving: p.moving, weapon: p.weapons[p.slot],
      alpha: p.invis > 0 ? .45 : (p.invT > 0 && p.moveT % 6 < 3 ? .5 : 1), dead: !p.alive };
    if (p.hitFlash > 0) {
      o.pal = { body: '#fff', pants: '#fff', skin: '#fff', hair: '#fff', hat: p.ch.pal.hat, belt: '#fff', cape: p.ch.pal.cape ? '#fff' : null };
    }
    /* 护甲光圈 */
    if (p.armor > 0) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .18 + p.armor * .05;
      ctx.strokeStyle = '#7fb0ff'; ctx.lineWidth = 2 * s;
      ctx.beginPath(); ctx.arc(x, y - 2 * s, 22 * s, 0, M.TAU); ctx.stroke(); ctx.restore();
    }
    if (p.rageT > 0) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .3 + Math.sin(p.moveT * .3) * .1;
      var g = ctx.createRadialGradient(x, y, 0, x, y, 34 * s);
      g.addColorStop(0, 'rgba(255,90,40,.5)'); g.addColorStop(1, 'rgba(255,60,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 34 * s, 0, M.TAU); ctx.fill(); ctx.restore();
    }
    K.Art.hero(ctx, x + rx, y + ry, s, o);
    /* 蓄力条 */
    if (p.chargeT > 0) {
      var k = Math.min(1, p.chargeT / 45);
      ctx.save();
      ctx.fillStyle = 'rgba(10,8,16,.7)'; ctx.fillRect(x - 18 * s, y - 34 * s, 36 * s, 5 * s);
      ctx.fillStyle = k >= 1 ? '#ffd15c' : '#9adfff'; ctx.fillRect(x - 18 * s, y - 34 * s, 36 * s * k, 5 * s);
      ctx.restore();
    }
  }
  function drawAim(ctx, V, p) {
    if (!p || !p.alive) return;
    var m = K.In.mouse;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(m.x, m.y, 9, 0, M.TAU); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(m.x - 14, m.y); ctx.lineTo(m.x - 4, m.y);
    ctx.moveTo(m.x + 4, m.y); ctx.lineTo(m.x + 14, m.y);
    ctx.moveTo(m.x, m.y - 14); ctx.lineTo(m.x, m.y - 4);
    ctx.moveTo(m.x, m.y + 4); ctx.lineTo(m.x, m.y + 14);
    ctx.stroke();
    /* 自动瞄准指示线 */
    if (K.Game.autoAim && K.In.mouse.moved <= 0) {
      var tg = B.nearest(p.x, p.y, 0, 560);
      if (tg) {
        ctx.strokeStyle = 'rgba(255,90,90,.35)'; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(V.tx(p.x), V.ty(p.y)); ctx.lineTo(V.tx(tg.x), V.ty(tg.y)); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,90,90,.8)';
        ctx.beginPath(); ctx.arc(V.tx(tg.x), V.ty(tg.y), (tg.r + 6) * V.z, 0, M.TAU); ctx.stroke();
      }
    }
    ctx.restore();
  }
  K.P = { CHARS: CHARS, CBY: CBY, create: create, update: update, draw: draw, drawAim: drawAim,
    useSkill: useSkill, give: give, swap: swap, weapon: weapon, addRelic: addRelic, baseMods: baseMods };
})(window.K);
