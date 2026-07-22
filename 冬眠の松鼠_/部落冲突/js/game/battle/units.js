/* ============ 战斗单位（部队实体 & AI） ============ */
COC.Units = (function () {
  'use strict';
  var U = COC.U, CFG = COC.CFG;
  var nextId = 1;

  function create(type, lv, x, y) {
    var def = COC.TroopDefs.get(type);
    var g = Math.pow(COC.TroopDefs.GROWTH, (lv || 1) - 1);
    return {
      id: nextId++, type: type, lv: lv || 1,
      x: x, y: y,
      ox: U.randF(-0.22, 0.22), oy: U.randF(-0.22, 0.22),
      hp: Math.round(def.hp * g), maxHp: Math.round(def.hp * g),
      dps: def.dps * g,
      speed: def.speed, range: def.range,
      pref: def.pref, prefMul: def.prefMul || 1,
      splash: def.splash || 0, suicide: !!def.suicide,
      scale: def.scale || 1,
      state: 'seek', target: null, subTarget: null,
      path: null, pathIdx: 0,
      atkCd: 0, retargetCd: 0,
      facing: 1, moving: false, bob: Math.random() * 10,
      dead: false, deathT: 0
    };
  }

  /* ---------- 目标选择 ---------- */
  function pickTarget(t, bt) {
    var list = bt.buildings, best = null, bestD = Infinity, i, b, d;
    var wantDefense = t.pref === 'defense';
    var wantRes = t.pref === 'resource';
    var wantWall = t.pref === 'wall';

    if (wantWall) {
      /* 炸弹人：找离部队最近的墙 */
      for (i = 0; i < list.length; i++) {
        b = list[i];
        if (b.hp <= 0 || b.type !== 'wall') continue;
        d = U.dist2(t.x, t.y, b.cx, b.cy);
        if (d < bestD) { bestD = d; best = b; }
      }
      if (best) return best;
    }

    for (var pass = 0; pass < 2; pass++) {
      for (i = 0; i < list.length; i++) {
        b = list[i];
        if (b.hp <= 0 || b.type === 'wall') continue;
        if (pass === 0) {
          if (wantDefense && !b.isDefense) continue;
          if (wantRes && !b.isResource) continue;
        }
        d = U.dist2(t.x, t.y, b.cx, b.cy);
        if (d < bestD) { bestD = d; best = b; }
      }
      if (best || (!wantDefense && !wantRes)) break;
    }
    return best;
  }

  /* 计算目标周围的寻路终点 */
  function goalCells(t, target, bt) {
    var N = CFG.MAP, goals = [];
    var size = target.size;
    var reach = Math.max(0.5, t.range);
    if (t.range <= 1) {
      /* 近战：footprint 外一圈 */
      for (var dy = -1; dy <= size; dy++) {
        for (var dx = -1; dx <= size; dx++) {
          if (dx >= 0 && dx < size && dy >= 0 && dy < size) continue;
          var gx = target.x + dx, gy = target.y + dy;
          if (gx < 0 || gy < 0 || gx >= N || gy >= N) continue;
          if (bt.grid[gy * N + gx] === -1) continue;
          goals.push({ x: gx, y: gy });
        }
      }
    } else {
      /* 远程：与目标中心距离 <= range 的可站立格 */
      var r = Math.ceil(t.range + size / 2 + 1);
      var cx = Math.round(target.cx), cy = Math.round(target.cy);
      for (var y = Math.max(0, cy - r); y <= Math.min(N - 1, cy + r); y++) {
        for (var x = Math.max(0, cx - r); x <= Math.min(N - 1, cx + r); x++) {
          if (bt.grid[y * N + x] !== 0) continue;
          var dd = U.dist(x + 0.5, y + 0.5, target.cx, target.cy) - size * 0.35;
          if (dd <= t.range + 0.3) goals.push({ x: x, y: y });
        }
      }
    }
    return goals;
  }

  function planPath(t, bt) {
    var target = t.target;
    if (!target) return false;
    var goals = goalCells(t, target, bt);
    if (!goals.length) return false;
    var res = COC.Pathfind.find(bt.grid, CFG.MAP, Math.round(t.x - 0.5), Math.round(t.y - 0.5), goals, 26000);
    if (!res) return false;
    t.path = res.path;
    t.pathIdx = 0;
    /* 路径上有墙：先打第一堵墙 */
    t.subTarget = null;
    if (res.walls.length > 0 && t.type !== 'wallbreaker') {
      var wIdx = res.walls[0];
      var wall = bt.wallByCell[wIdx];
      if (wall && wall.hp > 0) {
        t.subTarget = wall;
        /* 截断路径到墙前 */
        for (var i = 0; i < t.path.length; i++) {
          var c = t.path[i];
          if (c.y * CFG.MAP + c.x === wIdx) { t.path = t.path.slice(0, i); break; }
        }
      }
    }
    return true;
  }

  /* 当前攻击对象（墙优先） */
  function atkTarget(t) { return t.subTarget && t.subTarget.hp > 0 ? t.subTarget : t.target; }

  function inRange(t, b) {
    if (!b) return false;
    var half = b.size / 2;
    /* 到 footprint 的近似距离 */
    var dx = Math.max(Math.abs(t.x - b.cx) - half, 0);
    var dy = Math.max(Math.abs(t.y - b.cy) - half, 0);
    var d = Math.sqrt(dx * dx + dy * dy);
    return d <= Math.max(0.6, t.range) + 0.15;
  }

  /* ---------- 更新 ---------- */
  function update(t, dt, bt) {
    if (t.dead) { t.deathT += dt; return; }
    if (t.hp <= 0) { die(t, bt); return; }
    t.atkCd -= dt;
    t.retargetCd -= dt;
    t.bob += dt * 10;

    var target = t.target;
    if (!target || target.hp <= 0) {
      t.subTarget = null;
      t.target = pickTarget(t, bt);
      t.path = null;
      if (!t.target) { t.moving = false; return; }
      if (!planPath(t, bt)) {
        /* 完全被围死：直接打最近的墙 */
        var nw = nearestWall(t, bt);
        if (nw) { t.subTarget = nw; t.path = null; }
      }
      return;
    }

    var at = atkTarget(t);

    /* 攻击 */
    if (at && inRange(t, at)) {
      t.moving = false;
      if (t.atkCd <= 0) {
        t.atkCd = 1;
        doAttack(t, at, bt);
      }
      return;
    }

    /* 没路径 → 规划 */
    if (!t.path || t.pathIdx >= t.path.length) {
      if (t.subTarget && t.subTarget.hp > 0) {
        /* 走向墙 */
        moveTowards(t, t.subTarget.cx, t.subTarget.cy, dt);
        return;
      }
      if (!planPath(t, bt)) {
        var nw2 = nearestWall(t, bt);
        if (nw2) { t.subTarget = nw2; }
        else { moveTowards(t, target.cx, target.cy, dt); }
      }
      return;
    }

    /* 沿路径移动 */
    var wp = t.path[t.pathIdx];
    var wx = wp.x + 0.5 + t.ox * 0.5, wy = wp.y + 0.5 + t.oy * 0.5;
    if (moveTowards(t, wx, wy, dt)) t.pathIdx++;
  }

  function moveTowards(t, wx, wy, dt) {
    var dx = wx - t.x, dy = wy - t.y;
    var d = Math.sqrt(dx * dx + dy * dy);
    t.moving = true;
    if (d < 0.06) return true;
    var step = t.speed * dt;
    if (step >= d) { t.x = wx; t.y = wy; return true; }
    t.x += dx / d * step;
    t.y += dy / d * step;
    var sdx = (dx - dy); /* 屏幕水平方向 */
    if (Math.abs(sdx) > 0.05) t.facing = sdx > 0 ? 1 : -1;
    return false;
  }

  function nearestWall(t, bt) {
    var best = null, bestD = Infinity;
    for (var i = 0; i < bt.buildings.length; i++) {
      var b = bt.buildings[i];
      if (b.hp <= 0 || b.type !== 'wall') continue;
      var d = U.dist2(t.x, t.y, b.cx, b.cy);
      if (d < bestD) { bestD = d; best = b; }
    }
    return best;
  }

  function doAttack(t, b, bt) {
    if (t.suicide) {
      /* 炸弹人自爆 */
      var dmg = t.dps;
      var r = t.splash || 1.2;
      var list = bt.buildings;
      for (var i = 0; i < list.length; i++) {
        var o = list[i];
        if (o.hp <= 0) continue;
        var d = U.dist(t.x, t.y, o.cx, o.cy) - o.size * 0.4;
        if (d <= r) {
          var mul = o.type === 'wall' ? t.prefMul : 1;
          COC.Battle.damageBuilding(o, dmg * mul, t);
        }
      }
      COC.FX.explosion(t.x, t.y, 1.1, 'a');
      COC.Audio.play('explode');
      t.hp = 0;
      die(t, bt);
      return;
    }

    var mul = 1;
    if (t.pref === 'resource' && b.isResource) mul = t.prefMul;
    if (b.type === 'wall' && t.pref === 'wall') mul = t.prefMul;

    if (t.range > 1) {
      /* 远程投射物 */
      var pt = t.type === 'wizard' ? 'fireball' : 'arrow';
      COC.Battle.spawnProjectile({
        kind: pt, sx: t.x, sy: t.y, sz: 14,
        target: b, dmg: t.dps * mul, splash: t.splash, fromTroop: true
      });
      COC.Audio.play(t.type === 'wizard' ? 'wizardShot' : 'arrowShot', 0.5);
    } else {
      COC.Battle.damageBuilding(b, t.dps * mul, t);
      COC.FX.hitSpark(b.cx + U.randF(-0.4, 0.4), b.cy + U.randF(-0.4, 0.4));
      COC.Audio.play(b.type === 'wall' ? 'wallHit' : 'swordHit', 0.5);
    }
  }

  function die(t, bt) {
    if (t.dead) return;
    t.dead = true;
    t.deathT = 0;
    COC.FX.poof(t.x, t.y, 0.5);
  }

  return { create: create, update: update, pickTarget: pickTarget, planPath: planPath };
})();
