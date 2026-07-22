/* ============ 防御建筑 AI & 投射物 ============ */
COC.Defenses = (function () {
  'use strict';
  var U = COC.U, CFG = COC.CFG;

  /* 初始化战斗中防御建筑的运行数据 */
  function setup(b) {
    var def = COC.BuildingDefs.get(b.type);
    if (!def.weapon) return;
    var lvd = COC.BuildingDefs.lvl(b.type, b.lv);
    b.isDefense = true;
    b.weapon = def.weapon;
    b.dmg = lvd.dmg;
    b.rate = lvd.rate;
    b.range = lvd.range;
    b.minRange = lvd.minRange || 0;
    b.splash = lvd.splash || 0;
    b.cd = U.randF(0.3, 1.2);
    b.aim = 0;            /* 朝向角(弧度) */
    b.aimFrame = 0;       /* 射击动画帧 */
    b.fireT = 0;
    b.trg = null;
  }

  function update(b, dt, bt) {
    if (b.hp <= 0 || !b.weapon) return;
    b.cd -= dt;
    b.fireT = Math.max(0, b.fireT - dt);

    /* 目标校验 */
    var t = b.trg;
    if (!t || t.dead || t.hp <= 0 || !within(b, t)) {
      b.trg = acquire(b, bt);
      t = b.trg;
    }
    if (!t) return;

    /* 朝向（箭塔用） */
    var dx = t.x - b.cx, dy = t.y - b.cy;
    b.aim = Math.atan2(dy, dx);

    if (b.cd <= 0) {
      b.cd = b.rate;
      b.fireT = 0.45;
      fire(b, t, bt);
    }
  }

  function within(b, t) {
    var d = U.dist(b.cx, b.cy, t.x, t.y);
    return d <= b.range && d >= b.minRange;
  }

  function acquire(b, bt) {
    var best = null, bestD = Infinity;
    for (var i = 0; i < bt.troops.length; i++) {
      var t = bt.troops[i];
      if (t.dead || t.hp <= 0) continue;
      var d = U.dist(b.cx, b.cy, t.x, t.y);
      if (d <= b.range && d >= b.minRange && d < bestD) { bestD = d; best = t; }
    }
    return best;
  }

  function fire(b, t, bt) {
    switch (b.weapon) {
      case 'cannon':
        COC.Battle.spawnProjectile({
          kind: 'cannonball', sx: b.cx, sy: b.cy, sz: 30,
          target: t, dmg: b.dmg, splash: 0
        });
        COC.FX.muzzle(b.cx, b.cy, 26);
        COC.Audio.play('cannonShot', 0.7);
        break;
      case 'arrow':
        COC.Battle.spawnProjectile({
          kind: 'bolt', sx: b.cx, sy: b.cy, sz: 42,
          target: t, dmg: b.dmg, splash: 0
        });
        COC.Audio.play('arrowShot', 0.55);
        break;
      case 'mortar':
        COC.Battle.spawnProjectile({
          kind: 'shell', sx: b.cx, sy: b.cy, sz: 26,
          gx: t.x, gy: t.y, lob: true,
          dmg: b.dmg, splash: b.splash
        });
        COC.Audio.play('mortarShot', 0.7);
        break;
      case 'magic':
        COC.Battle.spawnProjectile({
          kind: 'orb', sx: b.cx, sy: b.cy, sz: 40,
          target: t, dmg: b.dmg, splash: b.splash
        });
        COC.Audio.play('wizardShot', 0.6);
        break;
    }
  }

  /* ---------- 投射物更新 ---------- */
  var PSPEED = { cannonball: 14, bolt: 18, shell: 7, orb: 10, arrow: 15, fireball: 11 };

  function updateProjectile(p, dt, bt) {
    var speed = PSPEED[p.kind] || 12;
    var tx, ty;
    if (p.target && !p.target.size) {
      /* 追踪部队 */
      if (p.target.dead || p.target.hp <= 0) { p.dead = true; return; }
      tx = p.target.x; ty = p.target.y;
    } else if (p.target && p.target.size) {
      tx = p.target.cx; ty = p.target.cy;
      if (p.target.hp <= 0) { p.dead = true; return; }
    } else {
      tx = p.gx; ty = p.gy;
    }

    var dx = tx - p.x, dy = ty - p.y;
    var d = Math.sqrt(dx * dx + dy * dy);
    p.dir = Math.atan2(dy, dx);

    if (p.lob) {
      /* 抛物线：t 0→1 */
      p.t += dt / p.flight;
      p.x = U.lerp(p.sx0, tx, p.t);
      p.y = U.lerp(p.sy0, ty, p.t);
      p.z = p.sz + Math.sin(Math.min(1, p.t) * Math.PI) * p.arc;
      if (p.t >= 1) { impact(p, tx, ty, bt); p.dead = true; }
      return;
    }

    var step = speed * dt;
    if (step >= d - 0.1) {
      impact(p, tx, ty, bt);
      p.dead = true;
      return;
    }
    p.x += dx / d * step;
    p.y += dy / d * step;
    p.z = Math.max(6, p.z - dt * 10);
  }

  function impact(p, tx, ty, bt) {
    if (p.fromTroop) {
      /* 部队打建筑 */
      if (p.target && p.target.size && p.target.hp > 0) {
        if (p.splash > 0) {
          for (var i = 0; i < bt.buildings.length; i++) {
            var o = bt.buildings[i];
            if (o.hp <= 0) continue;
            var dd = U.dist(tx, ty, o.cx, o.cy) - o.size * 0.4;
            if (dd <= p.splash) COC.Battle.damageBuilding(o, p.dmg, null);
          }
          COC.FX.smallBlast(tx, ty, p.kind === 'fireball' ? '#ff9a3d' : '#ffd763');
        } else {
          COC.Battle.damageBuilding(p.target, p.dmg, null);
          COC.FX.hitSpark(tx, ty);
        }
      }
      return;
    }
    /* 防御打部队 */
    if (p.splash > 0) {
      for (var j = 0; j < bt.troops.length; j++) {
        var t = bt.troops[j];
        if (t.dead || t.hp <= 0) continue;
        if (U.dist(tx, ty, t.x, t.y) <= p.splash) {
          COC.Battle.damageTroop(t, p.dmg);
        }
      }
      if (p.kind === 'shell') { COC.FX.explosion(tx, ty, 0.75, 'b'); COC.Audio.play('explode', 0.5); }
      else COC.FX.smallBlast(tx, ty, p.kind === 'orb' ? '#c95df0' : '#ffd763');
    } else if (p.target && !p.target.size) {
      COC.Battle.damageTroop(p.target, p.dmg);
      COC.FX.hitSpark(tx, ty);
    }
  }

  return { setup: setup, update: update, updateProjectile: updateProjectile };
})();
