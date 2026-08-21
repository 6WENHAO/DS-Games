/* ============ 魔法系统：吐息 / 投射物 / 遗物 / 祝福 / 部落 ============ */
(function (D) {
  "use strict";
  var U = D.util;

  var BREATHS = {
    fire: {
      key: "fire", name: "烈焰吐息", short: "焰", kind: "cone",
      cost: 32, cd: 1.7, range: 240, arc: 0.52, dmg: 26, burn: 5, burnDmg: 6.5,
      col: "#ff8a2a", col2: "#ffe6a0", ground: 2
    },
    frost: {
      key: "frost", name: "霜冻吐息", short: "霜", kind: "cone",
      cost: 24, cd: 1.5, range: 215, arc: 0.62, dmg: 15, chill: 4.5,
      col: "#7fd8ff", col2: "#eafbff", extinguish: true
    },
    bolt: {
      key: "bolt", name: "雷霆吐息", short: "雷", kind: "line",
      cost: 26, cd: 1.4, range: 330, dmg: 30, stun: 0.45, chain: 2,
      col: "#ffe066", col2: "#fffbdc"
    },
    quake: {
      key: "quake", name: "大地震荡", short: "震", kind: "ring",
      cost: 30, cd: 2.0, range: 190, dmg: 22, stun: 1.1, knock: 340,
      col: "#e6c894", col2: "#fff0cc"
    }
  };

  var RELICS = {
    emberheart: { name: "炽心", icon: "🔥", desc: "吐息伤害 +40%，免疫燃烧" },
    stoneskin: { name: "石肤", icon: "🛡", desc: "受到的伤害 -20%" },
    windscale: { name: "风鳞", icon: "🌀", desc: "移动速度 +15%" },
    regen: { name: "再生鳞", icon: "💚", desc: "持续缓慢回复生命" },
    dragonsoul: { name: "龙魂", icon: "🐲", desc: "最大生命 +25%，魔力上限 +40" },
    hexfang: { name: "咒牙", icon: "🦷", desc: "撕咬附带 3 秒燃烧" },
    frostheart: { name: "霜心", icon: "❄", desc: "撕咬使敌人减速" },
    manaflow: { name: "灵脉", icon: "✨", desc: "魔力回复翻倍，吐息更省更快" }
  };

  var BLESSINGS = {
    might: { key: "might", name: "力量祝福", dmg: 1.35, dur: 60, col: "#ff8a5a" },
    haste: { key: "haste", name: "迅捷祝福", speed: 1.25, dur: 60, col: "#8ce87a" },
    ward: { key: "ward", name: "守护祝福", shield: 70, dur: 60, col: "#7fd8ff" }
  };

  var PROJ = {
    spear: { r: 5, sp: 430, life: 1.5, col: "#c9a06a", trail: 0 },
    fireball: { r: 9, sp: 300, life: 2.0, col: "#ff9a3a", trail: 1 }
  };

  /* ---------------- 遗物 ---------------- */
  function relicHas(c, id) { return !!(c && c.relics && c.relics[id]); }
  function relicCount(c) { var n = 0; if (c && c.relics) for (var k in c.relics) n++; return n; }

  function applyRelicStats(c) {
    c.manaMax = 100;
    c.fireproof = !!c.def.fireproof;
    if (!c.relics) return;
    if (c.relics.dragonsoul) { c.maxHp = Math.round(c.maxHp * 1.25); c.manaMax += 40; }
    if (c.relics.windscale) c.speed *= 1.15;
    if (c.relics.emberheart) c.fireproof = true;
  }

  function giveRelic(game, id) {
    var p = game.player;
    if (!p) return null;
    p.relics = p.relics || {};
    if (relicCount(p) >= 4) {
      p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.4);
      p.mana = p.manaMax;
      game.toast("遗物栏已满，转化为生命与魔力", "info");
      return null;
    }
    var pool = [];
    for (var k in RELICS) if (!p.relics[k]) pool.push(k);
    if (!pool.length) return null;
    var pick = (id && !p.relics[id]) ? id : pool[Math.floor(Math.random() * pool.length)];
    p.relics[pick] = 1;
    p.applyLevel(true);
    game.fx.text(p.x, p.y - p.radius * 2.4, RELICS[pick].icon + " " + RELICS[pick].name, "#ffce54");
    game.fx.ring(p.x, p.y, 12, 170, "rgba(255,206,84,0.8)", 0.9);
    game.toast("获得遗物 " + RELICS[pick].name + "：" + RELICS[pick].desc, "good");
    D.Audio.level();
    game.unlock("relic");
    return pick;
  }

  /* ---------------- 状态 ---------------- */
  function applyBurn(c, dur, dps, game) {
    if (!c || c.dead || c.fireproof || c.def.fireproof) return;
    c.burn = Math.max(c.burn, dur);
    c.burnDmg = Math.max(c.burnDmg, dps);
    if (game && game.quality > 0) game.fx.ember(c.x, c.y - c.radius * 0.4);
  }
  function applyChill(c, dur) {
    if (!c || c.dead) return;
    c.chill = Math.max(c.chill, dur);
    c.burn = 0;
  }
  function applyStun(c, dur) {
    if (!c || c.dead || c.def.boss) return;
    c.stun = Math.max(c.stun, dur);
  }

  /* ---------------- 吐息 ---------------- */
  function breathOf(c) { return BREATHS[c.def.breath] || null; }

  function costOf(c, b) { return b.cost * (relicHas(c, "manaflow") ? 0.78 : 1); }

  function canCast(c) {
    var b = breathOf(c);
    if (!b || c.dead || c.stun > 0) return null;
    if (c.breathCd > 0) return null;
    if (c.isPlayer && c.mana < costOf(c, b)) return null;
    return b;
  }

  function hostile(a, b) {
    if (!b || b.dead || b.remove || b === a) return false;
    if (b.def.ignoreAI && !a.isPlayer) return false;
    return a.faction() !== b.faction();
  }

  function zigzag(pts) {
    var out = [];
    for (var i = 0; i < pts.length - 1; i++) {
      var a = pts[i], b = pts[i + 1];
      var dx = b[0] - a[0], dy = b[1] - a[1];
      var len = Math.sqrt(dx * dx + dy * dy) || 1;
      var nx = -dy / len, ny = dx / len;
      out.push(a);
      for (var k = 1; k < 4; k++) {
        var t = k / 4;
        var j = (Math.random() - 0.5) * Math.min(34, len * 0.3);
        out.push([a[0] + dx * t + nx * j, a[1] + dy * t + ny * j]);
      }
    }
    out.push(pts[pts.length - 1]);
    return out;
  }

  function cast(game, c) {
    var b = canCast(c);
    if (!b) return false;
    if (c.isPlayer) c.mana -= costOf(c, b);
    c.breathCd = b.cd * (relicHas(c, "manaflow") ? 0.75 : 1);
    c.breathT = 0.42;
    c.breathKind = b.key;
    c.breathAng = c.face;
    c.eatT = 0;
    var scaleMul = (0.65 + 0.5 * c.scale) * (1 + (c.level - 1) * 0.04);
    var dmg = b.dmg * scaleMul * (relicHas(c, "emberheart") && b.key === "fire" ? 1.4 : 1);
    var mx = c.x + Math.cos(c.face) * c.radius * 0.95;
    var my = c.y + Math.sin(c.face) * c.radius * 0.95 - c.radius * 0.45;

    if (b.kind === "cone") {
      var range = b.range * (0.75 + 0.35 * c.scale);
      var list = game.neighbors(c.x, c.y, range + 80);
      for (var i = 0; i < list.length; i++) {
        var o = list[i];
        if (!hostile(c, o)) continue;
        var dd = U.dist(mx, my, o.x, o.y);
        if (dd > range + o.radius) continue;
        var ang = Math.atan2(o.y - my, o.x - mx);
        if (Math.abs(U.angleDiff(c.face, ang)) > b.arc + o.radius / Math.max(60, dd)) continue;
        o.damage(dmg, c, game);
        if (b.burn) applyBurn(o, b.burn, b.burnDmg, game);
        if (b.chill) applyChill(o, b.chill);
        if (c.isPlayer) game.fx.text(o.x, o.y - o.radius - 8, Math.round(dmg) + "", b.col);
      }
      // 粒子
      var n = game.quality > 0 ? 20 : 10;
      for (var p2 = 0; p2 < n; p2++) {
        var t2 = Math.random();
        var a2 = c.face + (Math.random() - 0.5) * b.arc * 2;
        var rr = t2 * range;
        game.fx.spray(mx + Math.cos(a2) * rr, my + Math.sin(a2) * rr, 1, {
          col: Math.random() < 0.5 ? b.col : b.col2, r: 3 + t2 * 7, sp: 40, up: b.key === "fire" ? 40 : 0,
          g: b.key === "fire" ? -40 : 30, life: 0.45
        });
      }
      if (b.ground) {
        for (var g = 0; g < b.ground; g++) {
          var gx = mx + Math.cos(c.face) * range * (0.45 + g * 0.35);
          var gy = my + Math.sin(c.face) * range * (0.45 + g * 0.35);
          if (!game.world.isWater(gx, gy) && !game.world.solidAt(gx, gy)) {
            game.fires.push({ x: gx, y: gy, r: 52, t: 5 + Math.random() * 3, dmgT: 0.4, own: c.isPlayer ? "p" : "n" });
          }
        }
      }
      if (b.extinguish) {
        for (var f = game.fires.length - 1; f >= 0; f--) {
          if (U.dist(mx, my, game.fires[f].x, game.fires[f].y) < range) game.fires.splice(f, 1);
        }
        c.burn = 0;
      }
      D.Audio.breath(b.key);
    } else if (b.kind === "line") {
      var range2 = b.range * (0.8 + 0.3 * c.scale);
      var list2 = game.neighbors(c.x, c.y, range2 + 80);
      var best = null, bestT = 1e9;
      var cs = Math.cos(c.face), sn = Math.sin(c.face);
      for (var j = 0; j < list2.length; j++) {
        var o2 = list2[j];
        if (!hostile(c, o2)) continue;
        var dx2 = o2.x - mx, dy2 = o2.y - my;
        var tt = dx2 * cs + dy2 * sn;
        if (tt < 0 || tt > range2) continue;
        var perp = Math.abs(-dx2 * sn + dy2 * cs);
        if (perp > o2.radius + 30) continue;
        if (tt < bestT) { bestT = tt; best = o2; }
      }
      var pts = [[mx, my]];
      var hits = [];
      if (best) {
        hits.push(best);
        pts.push([best.x, best.y - best.radius * 0.4]);
        var cur = best;
        for (var ch = 0; ch < (b.chain || 0); ch++) {
          var nxt = null, nd = 200;
          var near = game.neighbors(cur.x, cur.y, 200);
          for (var k2 = 0; k2 < near.length; k2++) {
            var o3 = near[k2];
            if (!hostile(c, o3) || hits.indexOf(o3) >= 0) continue;
            var d3 = U.dist(cur.x, cur.y, o3.x, o3.y);
            if (d3 < nd) { nd = d3; nxt = o3; }
          }
          if (!nxt) break;
          hits.push(nxt);
          pts.push([nxt.x, nxt.y - nxt.radius * 0.4]);
          cur = nxt;
        }
      } else {
        pts.push([mx + cs * range2, my + sn * range2]);
      }
      c.breathPts = zigzag(pts);
      for (var h = 0; h < hits.length; h++) {
        var dm = dmg * (h === 0 ? 1 : 0.65);
        hits[h].damage(dm, c, game);
        if (b.stun) applyStun(hits[h], b.stun);
        game.fx.spark(hits[h].x, hits[h].y - hits[h].radius * 0.4, 10, b.col);
        if (c.isPlayer) game.fx.text(hits[h].x, hits[h].y - hits[h].radius - 8, Math.round(dm) + "", b.col);
      }
      game.flash = Math.max(game.flash, 0.09);
      D.Audio.breath(b.key);
    } else {
      var range3 = b.range * (0.8 + 0.4 * c.scale);
      var list3 = game.neighbors(c.x, c.y, range3 + 60);
      for (var q = 0; q < list3.length; q++) {
        var o4 = list3[q];
        if (!hostile(c, o4)) continue;
        var d4 = U.dist(c.x, c.y, o4.x, o4.y);
        if (d4 > range3 + o4.radius) continue;
        o4.damage(dmg, c, game);
        if (b.stun) applyStun(o4, b.stun);
        if (b.knock) {
          var ka = Math.atan2(o4.y - c.y, o4.x - c.x);
          o4.kx += Math.cos(ka) * b.knock;
          o4.ky += Math.sin(ka) * b.knock;
        }
        if (c.isPlayer) game.fx.text(o4.x, o4.y - o4.radius - 8, Math.round(dmg) + "", b.col);
      }
      game.fx.ring(c.x, c.y, 16, range3, "rgba(230,200,148,0.85)", 0.55);
      for (var d5 = 0; d5 < (game.quality > 0 ? 16 : 8); d5++) {
        var a5 = Math.random() * U.TAU;
        game.fx.dust(c.x + Math.cos(a5) * range3 * 0.7, c.y + Math.sin(a5) * range3 * 0.5, 26);
      }
      game.shake(9);
      D.Audio.breath(b.key);
    }
    if (c.isPlayer) game.vibrate(35);
    return true;
  }

  /* ---------------- 投射物 ---------------- */
  function fireProjectile(game, owner, target, kind) {
    var K = PROJ[kind] || PROJ.spear;
    var rd = owner.def.ranged || {};
    var ox = owner.x + Math.cos(owner.face) * owner.radius * 1.1;
    var oy = owner.y - owner.radius * 0.7;
    var lead = 0.12;
    var tx = target.x + target.vx * lead, ty = target.y - target.radius * 0.4 + target.vy * lead;
    var ang = Math.atan2(ty - oy, tx - ox) + (Math.random() - 0.5) * 0.09;
    owner.face = Math.atan2(target.y - owner.y, target.x - owner.x);
    game.projectiles.push({
      x: ox, y: oy, vx: Math.cos(ang) * K.sp, vy: Math.sin(ang) * K.sp,
      kind: kind, r: K.r, col: K.col, trail: K.trail, life: K.life,
      dmg: (rd.dmg || 12) * (0.75 + 0.35 * owner.scale), burn: rd.burn || 0, burnDmg: rd.burnDmg || 0,
      side: owner.faction(), owner: owner, ph: 0, ang: ang
    });
    D.Audio.throwSpear(kind === "fireball");
  }

  function updateProjectiles(game, dt) {
    var list = game.projectiles;
    for (var i = list.length - 1; i >= 0; i--) {
      var p = list[i];
      p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; p.ph += dt * 14;
      if (p.trail && game.quality > 0 && Math.random() < dt * 30) game.fx.ember(p.x, p.y);
      var gone = p.life <= 0 || game.world.solidAt(p.x, p.y);
      var hitC = null;
      if (!gone) {
        var near = game.neighbors(p.x, p.y, 90);
        for (var k = 0; k < near.length; k++) {
          var c = near[k];
          if (c.dead || c.remove || c === p.owner) continue;
          if (c.faction() === p.side) continue;
          if (c.def.ignoreAI) continue;
          if (U.dist(p.x, p.y, c.x, c.y - c.radius * 0.4) > c.radius * 0.95 + p.r) continue;
          hitC = c; break;
        }
      }
      if (hitC) {
        hitC.damage(p.dmg, p.owner, game);
        if (p.burn) applyBurn(hitC, p.burn, p.burnDmg, game);
        game.fx.spark(p.x, p.y, p.kind === "fireball" ? 14 : 6, p.col);
        if (p.kind === "fireball") {
          game.fx.ring(p.x, p.y, 6, 60, "rgba(255,140,60,0.7)", 0.35);
          D.Audio.boom();
        }
        list.splice(i, 1);
        continue;
      }
      if (gone) {
        game.fx.spray(p.x, p.y, 4, { col: p.col, r: 2.5, sp: 50, life: 0.3 });
        list.splice(i, 1);
      }
    }
  }

  /* ---------------- 萨满支援 ---------------- */
  function support(game, c) {
    var list = game.neighbors(c.x, c.y, 320);
    var side = c.faction();
    var target = null, worst = 0.75;
    for (var i = 0; i < list.length; i++) {
      var o = list[i];
      if (o.dead || o.def.ignoreAI || o.faction() !== side) continue;
      var k = o.hp / o.maxHp;
      if (k < worst) { worst = k; target = o; }
    }
    if (target) {
      c.magicCd = 5.5;
      target.hp = Math.min(target.maxHp, target.hp + target.maxHp * 0.3);
      target.shield = Math.max(target.shield, 30);
      target.burn = 0;
      game.fx.ring(target.x, target.y, 8, 60, "rgba(150,255,180,0.85)", 0.6);
      game.fx.text(target.x, target.y - target.radius - 10, "+治疗", "#9dffb0");
      c.atkAnim = 0.3;
      D.Audio.heal();
      return true;
    }
    return false;
  }

  /* ---------------- 幽影龙瞬移 ---------------- */
  function blink(game, c, target) {
    var a = Math.atan2(c.y - target.y, c.x - target.x) + Math.PI + (Math.random() - 0.5) * 1.4;
    var d = target.radius + c.radius + 30;
    var pt = game.world.findLand(target.x + Math.cos(a) * d, target.y + Math.sin(a) * d, c.radius);
    game.fx.ring(c.x, c.y, 6, 70, "rgba(150,160,255,0.8)", 0.4);
    c.x = pt.x; c.y = pt.y;
    c.vx = 0; c.vy = 0;
    c.face = Math.atan2(target.y - c.y, target.x - c.x);
    c.blinkCd = 4 + Math.random() * 3;
    game.fx.ring(c.x, c.y, 6, 70, "rgba(150,160,255,0.8)", 0.4);
    game.fx.spray(c.x, c.y, 10, { col: "#8f9bff", r: 3, sp: 70, life: 0.5 });
    D.Audio.blink();
  }

  /* ---------------- 魔法地物 ---------------- */
  function nearMagic(game, x, y) {
    var w = game.world, out = { factor: 1, crystal: null, rune: null };
    var cs = w.crystals || [];
    for (var i = 0; i < cs.length; i++) {
      if (U.dist2(x, y, cs[i].x, cs[i].y) < 150 * 150) { out.crystal = cs[i]; out.factor = Math.max(out.factor, 4.5); }
    }
    var rs = w.runes || [];
    for (var j = 0; j < rs.length; j++) {
      if (U.dist2(x, y, rs[j].x, rs[j].y) < rs[j].r * rs[j].r) { out.rune = rs[j]; out.factor = Math.max(out.factor, 3); }
    }
    return out;
  }

  function manaRegen(game, p) {
    var base = 2.4;
    if (relicHas(p, "manaflow")) base *= 2;
    var m = nearMagic(game, p.x, p.y);
    base *= m.factor;
    if (game.event === "manasurge") base *= 3;
    return base;
  }

  function activateRune(game, rune) {
    if (!rune || rune.cd > 0) return false;
    var p = game.player;
    rune.cd = 150;
    var keys = ["might", "haste", "ward"];
    var b = BLESSINGS[keys[Math.floor(Math.random() * keys.length)]];
    p.bless = { key: b.key, name: b.name, t: b.dur, dmg: b.dmg || 1, speed: b.speed || 1, col: b.col };
    if (b.shield) p.shield = Math.max(p.shield, b.shield);
    p.mana = p.manaMax;
    p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.2);
    game.fx.ring(rune.x, rune.y, 10, rune.r, "rgba(200,160,255,0.9)", 1.0);
    game.fx.text(p.x, p.y - p.radius * 2.2, b.name, b.col);
    game.toast("符文回应了你：" + b.name + "（60 秒）", "good");
    D.Audio.level();
    game.unlock("rune");
    return true;
  }

  function updateWorldMagic(game, dt) {
    var w = game.world;
    var rs = w.runes || [];
    for (var i = 0; i < rs.length; i++) if (rs[i].cd > 0) rs[i].cd -= dt;
    if (game.quality > 0 && game.player) {
      var m = nearMagic(game, game.player.x, game.player.y);
      var src = m.crystal || m.rune;
      if (src && Math.random() < dt * 14) {
        game.fx.spray(src.x + (Math.random() - 0.5) * 60, src.y + (Math.random() - 0.5) * 40, 1, {
          col: m.crystal ? "#9ff0ff" : "#d0a8ff", r: 2.6, sp: 8, up: 30, g: -18, life: 1.1
        });
      }
    }
  }

  /* ---------------- 部落营地 ---------------- */
  function updateVillages(game, dt) {
    var w = game.world, p = game.player;
    if (!w.villages || !p) return;
    for (var i = 0; i < w.villages.length; i++) {
      var v = w.villages[i];
      var d2 = U.dist2(v.x, v.y, p.x, p.y);
      if (v.ruined) continue;
      if (d2 > 2600 * 2600) {
        if (v.totem && !v.totem.dead) { v.totemHp = v.totem.hp; v.totem.remove = true; v.totem = null; }
        continue;
      }
      if (!v.seen && d2 < 640 * 640) {
        v.seen = true;
        game.toast("发现人类营地 —— 咬碎中央图腾柱可夺取遗物", "info");
        game.unlock("village");
        D.Audio.blip();
      }
      if (!v.totem || v.totem.remove || v.totem.dead) {
        if (!v.totemDown) {
          var t = game.spawn("totem", v.x, v.y, { level: 6 });
          if (t) {
            t.village = v;
            t.hp = Math.min(t.maxHp, v.totemHp || t.maxHp);
            v.totem = t;
          }
        }
      } else v.totemHp = v.totem.hp;

      v.spawnT -= dt;
      if (v.spawnT > 0) continue;
      v.spawnT = 5 + Math.random() * 5;
      var alive = 0, list = game.creatures;
      for (var k = 0; k < list.length; k++) {
        var c = list[k];
        if (c.village === v && !c.dead && c.def.kind === "human") alive++;
      }
      var want = 3 + Math.min(4, game.day);
      if (alive >= want) continue;
      var roll = Math.random();
      var sp = roll < 0.5 ? "hunter" : roll < 0.8 ? "spearman" : "shaman";
      if (game.day >= 4 && roll > 0.96) sp = "chief";
      var a = Math.random() * U.TAU, r = v.r * (0.45 + Math.random() * 0.5);
      var pt = w.findLand(v.x + Math.cos(a) * r, v.y + Math.sin(a) * r, 12);
      var h = game.spawn(sp, pt.x, pt.y, { level: 2 + Math.floor(Math.random() * (2 + game.day)) });
      if (h) { h.village = v; h.homeX = v.x; h.homeY = v.y; }
    }
  }

  function onStructDestroyed(game, t) {
    var v = t.village;
    if (v) { v.ruined = true; v.totemDown = true; v.totem = null; }
    game.fx.ring(t.x, t.y, 20, 240, "rgba(255,180,80,0.85)", 1.0);
    game.fx.spark(t.x, t.y, 30, "#ffd257");
    game.shake(15);
    D.Audio.boom();
    game.player.gainExp(130, game);
    game.stats.totems = (game.stats.totems || 0) + 1;
    game.toast("图腾柱倒下了！营地不再派兵", "good");
    game.unlock("totem");
    giveRelic(game);
    if (v) {
      var pt = game.world.findLand(v.x + 70, v.y + 20, 14);
      var ch = game.spawn("chief", pt.x, pt.y, { level: 4 + game.day });
      if (ch) {
        ch.village = v;
        ch.target = game.player;
        ch.state = "fight";
        game.toast("酋长被惊动，正冲向你！", "bad");
      }
    }
  }

  D.Magic = {
    BREATHS: BREATHS, RELICS: RELICS, BLESSINGS: BLESSINGS, PROJ: PROJ,
    relicHas: relicHas, relicCount: relicCount, applyRelicStats: applyRelicStats, giveRelic: giveRelic,
    applyBurn: applyBurn, applyChill: applyChill, applyStun: applyStun,
    breathOf: breathOf, costOf: costOf, canCast: canCast, cast: cast,
    fireProjectile: fireProjectile, updateProjectiles: updateProjectiles,
    support: support, blink: blink,
    nearMagic: nearMagic, manaRegen: manaRegen, activateRune: activateRune,
    updateWorldMagic: updateWorldMagic, updateVillages: updateVillages,
    onStructDestroyed: onStructDestroyed
  };
})(window.DINO);
