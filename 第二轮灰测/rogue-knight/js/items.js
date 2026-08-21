/* items.js — 掉落物 / 宝箱 / 商店 / 遗物 */
(function (K) {
  'use strict';
  var M = K.M, FX = K.FX, S = K.Snd;
  var items = [];

  /* ---------------- 遗物 ---------------- */
  var RELICS = [
    { id: 'ammo', name: '双弹匣', icon: '#ffd15c', desc: '所有武器额外 +1 发弹丸', f: function (m) { m.extraBullets += 1; } },
    { id: 'rate', name: '急速扳机', icon: '#8ad06a', desc: '攻击速度 +22%', f: function (m) { m.rateMul *= 1.22; } },
    { id: 'dmg', name: '力量护符', icon: '#ff5a4a', desc: '伤害 +25%', f: function (m) { m.dmgMul *= 1.25; } },
    { id: 'crit', name: '暴击手套', icon: '#ffc23a', desc: '暴击率 +14%', f: function (m) { m.crit += 14; } },
    { id: 'pierce', name: '穿甲弹头', icon: '#6ab0ff', desc: '子弹额外穿透 +1', f: function (m) { m.pierce += 1; } },
    { id: 'boots', name: '疾风之靴', icon: '#9adfff', desc: '移动速度 +16%', f: function (m) { m.speedMul *= 1.16; } },
    { id: 'magnet', name: '磁力核心', icon: '#c06aff', desc: '拾取范围大幅提升', f: function (m) { m.magnet += 90; } },
    { id: 'leech', name: '吸血鬼之牙', icon: '#c8203a', desc: '造成伤害的 5% 转为治疗', f: function (m) { m.leech += .05; } },
    { id: 'thorn', name: '荆棘之甲', icon: '#7ad04a', desc: '受伤时反弹范围伤害', f: function (m) { m.thorns += 14; } },
    { id: 'boom', name: '爆裂弹头', icon: '#ff9a2e', desc: '子弹命中时产生小爆炸', f: function (m) { m.explodeBullets = 1; } },
    { id: 'homing', name: '制导芯片', icon: '#7fb0ff', desc: '子弹具备追踪能力', f: function (m) { m.homing = Math.max(m.homing, .035); } },
    { id: 'bounce', name: '弹射涂层', icon: '#ffd15c', desc: '子弹可在墙上弹跳 2 次', f: function (m) { m.bounce += 2; } },
    { id: 'shield', name: '护盾电池', icon: '#7fb0ff', desc: '护甲上限 +2 且回复更快', f: function (m, p) { m.armorMax += 2; m.armorFast = 1; p.armorMax += 2; p.armor = p.armorMax; } },
    { id: 'heart', name: '生命宝石', icon: '#ff4a6a', desc: '生命上限 +30 并立即治疗', f: function (m, p) { p.hpMax += 30; p.hp = Math.min(p.hpMax, p.hp + 30); } },
    { id: 'energy', name: '奥能水晶', icon: '#9affe0', desc: '能量上限 +30，回复 +50%', f: function (m, p) { p.energyMax += 30; p.energy = p.energyMax; m.energyRegen *= 1.5; } },
    { id: 'ice', name: '霜冻附魔', icon: '#6ad4ff', desc: '攻击附带冰冻减速', f: function (m) { m.forceElem = 'ice'; } },
    { id: 'fire', name: '烈焰附魔', icon: '#ff7a2a', desc: '攻击附带燃烧', f: function (m) { m.forceElem = 'fire'; } },
    { id: 'luck', name: '幸运四叶草', icon: '#8ad06a', desc: '掉落品质与金币提升', f: function (m) { m.luck += 3; m.coinMul *= 1.3; } },
    { id: 'dash', name: '闪现引擎', icon: '#c06aff', desc: '翻滚冷却 -40%，可穿过子弹', f: function (m) { m.dashCdMul *= .6; m.dashInv += 8; } },
    { id: 'react', name: '应激装甲', icon: '#ffc23a', desc: '受伤后获得 1 秒无敌', f: function (m) { m.reactInv = 60; } },
    { id: 'range', name: '延展枪管', icon: '#b8c0d0', desc: '射程/近战范围 +20%', f: function (m) { m.rangeMul *= 1.2; } },
    { id: 'skill', name: '英雄印记', icon: '#ffc23a', desc: '技能冷却 -30%', f: function (m) { m.skillCdMul *= .7; } }
  ];
  var RBY = {}; RELICS.forEach(function (r) { RBY[r.id] = r; });
  function rollRelic(R, owned) {
    var pool = RELICS.filter(function (r) { return owned.indexOf(r.id) < 0; });
    if (!pool.length) pool = RELICS;
    return R ? R.pick(pool) : M.pick(pool);
  }

  /* ---------------- 掉落物 ---------------- */
  function reset() { items.length = 0; }
  function add(o) {
    o.t = 0; o.z = o.z === undefined ? 6 : o.z; o.vz = o.vz === undefined ? M.rnd(1.4, 3) : o.vz;
    o.vx = o.vx || 0; o.vy = o.vy || 0; o.r = o.r || 12;
    items.push(o); return o;
  }
  function drop(x, y, kind, o) {
    o = o || {};
    var a = M.rnd(M.TAU), sp = o.pop === 0 ? 0 : M.rnd(.6, 2.4);
    return add({ kind: kind, x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
      w: o.w, relic: o.relic, price: o.price, amount: o.amount || 1, r: o.r || 12, shop: o.shop, heal: o.heal, fixed: o.fixed });
  }
  /* 敌人死亡掉落 */
  function spawnDrops(e) {
    var p = K.Game.player, m = p ? p.mods : { coinMul: 1, luck: 0 };
    var n = Math.max(1, Math.round(e.coin * (m.coinMul || 1) * M.rnd(.7, 1.25)));
    var i;
    for (i = 0; i < Math.min(12, n); i++) drop(e.x + M.rnd(-10, 10), e.y + M.rnd(-10, 10), 'coin', { amount: Math.ceil(n / Math.min(12, n)) });
    if (e.gems) for (i = 0; i < e.gems; i++) drop(e.x + M.rnd(-14, 14), e.y + M.rnd(-14, 14), 'gem');
    else if (M.chance(.06 + (m.luck || 0) * .01)) drop(e.x, e.y, 'gem');
    if (M.chance(.055 + (m.luck || 0) * .012)) drop(e.x, e.y, 'heart');
    if (M.chance(.04)) drop(e.x, e.y, 'energy');
    if (M.chance(.03)) drop(e.x, e.y, 'armor');
    if (e.boss) {
      drop(e.x - 40, e.y, 'relic', { relic: rollRelic(null, p ? p.relicIds : []), pop: 0 });
      drop(e.x + 40, e.y, 'weapon', { w: K.W.roll(K.Game.rng, K.Game.floor + 1, (m.luck || 0) + 4), pop: 0 });
      drop(e.x, e.y + 40, 'heart', { amount: 3 });
    } else if (M.chance(.05 + (m.luck || 0) * .01)) {
      drop(e.x, e.y, 'weapon', { w: K.W.roll(K.Game.rng, K.Game.floor, m.luck || 0) });
    }
  }
  /* ---------------- 更新 ---------------- */
  function update() {
    var p = K.Game.player, i, it;
    for (i = items.length - 1; i >= 0; i--) {
      it = items[i]; it.t++;
      if (it.z > 0 || it.vz > 0) { it.z += it.vz; it.vz -= .22; if (it.z < 0) { it.z = 0; it.vz *= -.35; } }
      it.x += it.vx; it.y += it.vy; it.vx *= .9; it.vy *= .9;
      if (!p || !p.alive) continue;
      var d = M.len(p.x - it.x, p.y - it.y);
      var auto = it.kind === 'coin' || it.kind === 'gem' || it.kind === 'heart' || it.kind === 'energy' || it.kind === 'armor';
      if (auto) {
        var mag = 58 + (p.mods.magnet || 0);
        if (d < mag && it.t > 8) {
          var pull = M.clamp((1 - d / mag) * 2.6, .5, 3.4);
          var a = Math.atan2(p.y - it.y, p.x - it.x);
          it.x += Math.cos(a) * (2 + pull * 2.4); it.y += Math.sin(a) * (2 + pull * 2.4);
        }
        if (d < p.r + 8) { collect(it, p); items.splice(i, 1); continue; }
      }
    }
  }
  function collect(it, p) {
    switch (it.kind) {
      case 'coin': p.coins += it.amount; S.play('coin', .5, .02); FX.text(it.x, it.y - 8, '+' + it.amount, { col: '#ffcf3a', size: 11, life: 26 }); break;
      case 'gem': p.gems += it.amount; S.play('gem', .6, .04); FX.text(it.x, it.y - 8, '宝石 +' + it.amount, { col: '#7ad4ff', size: 12, life: 32 }); break;
      case 'heart': {
        var h = 18 * it.amount;
        p.hp = Math.min(p.hpMax, p.hp + h); S.play('heal', .7); FX.text(it.x, it.y - 10, '+' + h, { col: '#ff5a7a', size: 14, life: 34 });
        FX.burst(it.x, it.y, 8, { col: '#ff8aa0', col2: '#ffd0dd', speed: 3, size: 3 }); break;
      }
      case 'energy': p.energy = Math.min(p.energyMax, p.energy + 26 * it.amount); S.play('item', .5); FX.text(it.x, it.y - 10, '能量 +26', { col: '#9affe0', size: 12, life: 30 }); break;
      case 'armor': p.armor = Math.min(p.armorMax, p.armor + 1); S.play('shield', .7); FX.text(it.x, it.y - 10, '护甲 +1', { col: '#7fb0ff', size: 12, life: 30 }); break;
    }
    FX.light(it.x, it.y, 50, '#ffd15c', 8);
  }
  /* 互动（E 键）：返回提示文本 */
  function nearest(p) {
    var best = null, bd = 1e9;
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (it.kind === 'coin' || it.kind === 'gem' || it.kind === 'heart' || it.kind === 'energy' || it.kind === 'armor') continue;
      var d = M.len(p.x - it.x, p.y - it.y);
      if (d < 62 && d < bd) { bd = d; best = it; }
    }
    return best;
  }
  function prompt(it, p) {
    if (!it) return null;
    if (it.kind === 'weapon') return { txt: '[E] 拾取 ' + it.w.name + '（' + K.W.RNAME[it.w.rarity - 1] + '）' + (it.price ? '  ' + it.price + ' 金' : ''), col: K.W.RCOL[it.w.rarity - 1] };
    if (it.kind === 'relic') return { txt: '[E] 获得遗物 ' + it.relic.name + (it.price ? '  ' + it.price + ' 金' : ''), col: it.relic.icon };
    if (it.kind === 'chest') return { txt: it.opened ? '' : '[E] 开启宝箱', col: '#ffd15c' };
    if (it.kind === 'portal') return { txt: '[E] 进入下一层', col: '#c06aff' };
    if (it.kind === 'shrine') return { txt: it.used ? '' : '[E] 祈祷（消耗 30 金：随机祝福）', col: '#ffd15c' };
    if (it.kind === 'heal') return { txt: '[E] 治疗药水  ' + it.price + ' 金', col: '#ff5a7a' };
    return null;
  }
  function interact(p) {
    var it = nearest(p); if (!it) return false;
    if (it.price && !it.bought) {
      if (p.coins < it.price) { S.play('no', .6); FX.text(p.x, p.y - 40, '金币不足', { col: '#ff6a6a', size: 13, life: 30 }); return false; }
      p.coins -= it.price; it.bought = 1; it.price = 0;
      FX.text(it.x, it.y - 20, '已购买', { col: '#8ad06a', size: 13, life: 30 });
      S.play('coin', .8);
      if (it.kind === 'heal') { p.hp = Math.min(p.hpMax, p.hp + 60); S.play('heal', 1); FX.burst(p.x, p.y, 12, { col: '#ff8aa0', col2: '#ffd0dd', speed: 3.4, size: 4 }); remove(it); return true; }
    }
    switch (it.kind) {
      case 'weapon': {
        var old = K.P.give(p, it.w);
        S.play('item', .9);
        FX.text(p.x, p.y - 40, it.w.name, { col: K.W.RCOL[it.w.rarity - 1], size: 15, life: 40 });
        if (old) { it.w = old; it.t = 0; } else remove(it);
        return true;
      }
      case 'relic': {
        K.P.addRelic(p, it.relic);
        S.play('levelup', 1); FX.flash(.16, it.relic.icon);
        FX.text(p.x, p.y - 42, it.relic.name, { col: it.relic.icon, size: 16, life: 60 });
        FX.text(p.x, p.y - 22, it.relic.desc, { col: '#e8eefc', size: 11, life: 60 });
        remove(it); return true;
      }
      case 'chest': {
        if (it.opened) return false;
        it.opened = 1; S.play('chest', 1);
        FX.burst(it.x, it.y, 22, { col: '#ffe9a8', col2: '#ffcf3a', speed: 5, size: 4, flareR: 26 });
        FX.light(it.x, it.y, 160, '#ffd15c', 20);
        var R = K.Game.rng;
        if (it.big || M.chance(.34)) drop(it.x, it.y - 24, 'relic', { relic: rollRelic(R, p.relicIds), pop: 0 });
        else drop(it.x, it.y - 24, 'weapon', { w: K.W.roll(R, K.Game.floor, p.mods.luck), pop: 0 });
        for (var i = 0; i < 8; i++) drop(it.x, it.y, 'coin', { amount: 3 });
        if (M.chance(.5)) drop(it.x, it.y, 'heart');
        return true;
      }
      case 'portal': K.Game.nextFloor(); return true;
      case 'shrine': {
        if (it.used) return false;
        if (p.coins < 30) { S.play('no', .6); FX.text(p.x, p.y - 40, '需要 30 金', { col: '#ff6a6a', size: 13, life: 30 }); return false; }
        p.coins -= 30; it.used = 1;
        var kinds = ['hp', 'armor', 'energy', 'dmg', 'relic'];
        var kk = M.pick(kinds);
        S.play('levelup', 1); FX.flash(.2, '#ffd15c'); FX.ring(it.x, it.y, 10, 140, '#ffd15c', 26, 5);
        if (kk === 'hp') { p.hpMax += 20; p.hp = p.hpMax; FX.text(p.x, p.y - 40, '生命上限 +20', { col: '#ff5a7a', size: 14, life: 50 }); }
        else if (kk === 'armor') { p.armorMax += 1; p.armor = p.armorMax; FX.text(p.x, p.y - 40, '护甲上限 +1', { col: '#7fb0ff', size: 14, life: 50 }); }
        else if (kk === 'energy') { p.energyMax += 20; p.energy = p.energyMax; FX.text(p.x, p.y - 40, '能量上限 +20', { col: '#9affe0', size: 14, life: 50 }); }
        else if (kk === 'dmg') { p.mods.dmgMul *= 1.12; FX.text(p.x, p.y - 40, '伤害 +12%', { col: '#ff8a4a', size: 14, life: 50 }); }
        else { K.P.addRelic(p, rollRelic(K.Game.rng, p.relicIds)); FX.text(p.x, p.y - 40, '获得遗物！', { col: '#ffd15c', size: 14, life: 50 }); }
        return true;
      }
    }
    return false;
  }
  function remove(it) { var i = items.indexOf(it); if (i >= 0) items.splice(i, 1); }

  /* ---------------- 绘制 ---------------- */
  function drawUnder(ctx, V) {
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      K.Art.shadow(ctx, V.tx(it.x), V.ty(it.y) + 2 * V.z, (it.kind === 'chest' ? 15 : 7) * V.z, (it.kind === 'chest' ? 6 : 3.4) * V.z, .26);
    }
  }
  function draw(ctx, V) {
    for (var i = 0; i < items.length; i++) {
      var it = items[i], x = V.tx(it.x), y = V.ty(it.y - it.z), s = V.z;
      var bob = it.z > 0 ? 0 : Math.sin(it.t * .08) * 2 * s;
      if (it.kind === 'weapon') {
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .5;
        var g = ctx.createRadialGradient(x, y, 0, x, y, 26 * s);
        g.addColorStop(0, K.W.RCOL[it.w.rarity - 1]); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 26 * s, 0, M.TAU); ctx.fill(); ctx.restore();
        K.Art.weapon(ctx, x, y + bob, -.5, s * 1.05, it.w);
      } else if (it.kind === 'relic') {
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .55;
        var g2 = ctx.createRadialGradient(x, y, 0, x, y, 30 * s);
        g2.addColorStop(0, it.relic.icon); g2.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(x, y, 30 * s, 0, M.TAU); ctx.fill(); ctx.restore();
        ctx.save(); ctx.translate(x, y + bob); ctx.rotate(Math.sin(it.t * .04) * .3);
        K.Art.poly(ctx, [0, -11 * s, 10 * s, 0, 0, 11 * s, -10 * s, 0], it.relic.icon, 2.2 * s);
        K.Art.circle(ctx, 0, 0, 3.4 * s, '#fff', 0);
        ctx.restore();
      } else if (it.kind === 'heal') {
        K.Art.item(ctx, x, y + bob, s, 'heart', it.t);
      } else K.Art.item(ctx, x, y + bob, s, it.kind, it.t, it);
      if (it.price) {
        ctx.save(); ctx.textAlign = 'center'; ctx.font = '900 ' + (12 * s).toFixed(1) + 'px "Arial Black",sans-serif';
        ctx.lineWidth = 3 * s; ctx.strokeStyle = '#14101c'; ctx.strokeText(it.price + '金', x, y - 26 * s);
        ctx.fillStyle = '#ffcf3a'; ctx.fillText(it.price + '金', x, y - 26 * s); ctx.restore();
      }
    }
  }
  K.I = { items: items, RELICS: RELICS, RBY: RBY, rollRelic: rollRelic, drop: drop, add: add, spawnDrops: spawnDrops,
    update: update, draw: draw, drawUnder: drawUnder, reset: reset, interact: interact, nearest: nearest,
    prompt: prompt, remove: remove };
})(window.K);
