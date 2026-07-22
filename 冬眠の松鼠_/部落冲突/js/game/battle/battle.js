/* ============ 战斗控制器 ============ */
COC.Battle = (function () {
  'use strict';
  var U = COC.U, CFG = COC.CFG;

  var bt = null;   /* 战斗运行时状态 */

  function state() { return bt; }
  function active() { return !!bt; }

  /* ---------- 进入侦察 ---------- */
  function startScout() {
    var S = COC.State.get();
    var enemy = COC.Generator.generate(COC.State.thLevel());
    bt = buildRuntime(enemy);
    bt.phase = 'scout';
    COC.Camera.centerOn(CFG.MAP / 2, CFG.MAP / 2 - 4);
    U.emit('battle');
    return bt;
  }

  function nextScout() {
    var S = COC.State.get();
    if (S.gold < CFG.SCOUT_COST) { COC.UI.toast('金币不足'); COC.Audio.play('error'); return; }
    S.gold -= CFG.SCOUT_COST;
    var enemy = COC.Generator.generate(COC.State.thLevel());
    bt = buildRuntime(enemy);
    bt.phase = 'scout';
    U.emit('hud'); U.emit('battle');
  }

  function buildRuntime(enemy) {
    var N = CFG.MAP;
    var grid = new Int16Array(N * N);
    var forbid = new Uint8Array(N * N);
    var wallByCell = {};
    var buildings = [];
    var lootPool = lootFor(enemy.th);
    var storG = [], storE = [], colG = [], colE = [], thRef = null;

    for (var i = 0; i < enemy.buildings.length; i++) {
      var e = enemy.buildings[i];
      var def = COC.BuildingDefs.get(e.type);
      var lvd = COC.BuildingDefs.lvl(e.type, Math.min(e.lv, def.levels.length));
      var b = {
        type: e.type, lv: e.lv, x: e.x, y: e.y, size: def.size,
        cx: e.x + def.size / 2, cy: e.y + def.size / 2,
        hp: lvd.hp, maxHp: lvd.hp,
        isResource: !!(def.produces || def.stores || e.type === 'townhall'),
        isDefense: false, destroyed: false,
        lootGold: 0, lootElixir: 0,
        anim: Math.random() * 10
      };
      COC.Defenses.setup(b);
      buildings.push(b);

      /* 网格 */
      for (var dy = 0; dy < def.size; dy++) for (var dx = 0; dx < def.size; dx++) {
        var idx = (e.y + dy) * N + (e.x + dx);
        if (e.type === 'wall') {
          grid[idx] = 6 + Math.round(lvd.hp / 80);
          wallByCell[idx] = b;
        } else {
          grid[idx] = -1;
        }
      }
      if (e.type !== 'wall') {
        for (var fy = -1; fy <= def.size; fy++) for (var fx = -1; fx <= def.size; fx++) {
          var gx = e.x + fx, gy = e.y + fy;
          if (gx >= 0 && gy >= 0 && gx < N && gy < N) forbid[gy * N + gx] = 1;
        }
      }
      /* 战利品分配收集 */
      if (e.type === 'goldstorage') storG.push(b);
      else if (e.type === 'elixirstorage') storE.push(b);
      else if (e.type === 'goldmine') colG.push(b);
      else if (e.type === 'elixirpump') colE.push(b);
      else if (e.type === 'townhall') thRef = b;
    }

    distribute(lootPool.gold, thRef, storG, colG, 'lootGold');
    distribute(lootPool.elixir, thRef, storE, colE, 'lootElixir');

    var weight = 0;
    for (var w = 0; w < buildings.length; w++) if (buildings[w].type !== 'wall') weight++;

    return {
      uid: 'b' + U.now() + '_' + Math.floor(Math.random() * 1e6),
      seed: U.randInt(1, 200000),
      enemy: enemy, buildings: buildings, grid: grid, forbid: forbid, wallByCell: wallByCell,
      troops: [], projectiles: [],
      timer: CFG.BATTLE_TIME, phase: 'scout',
      totalWeight: weight, destroyedWeight: 0, percent: 0,
      stars: 0, thDown: false, got50: false, got100: false,
      lootGold: 0, lootElixir: 0,
      deployed: false, ended: false,
      selectedTroop: null, selectedSpell: null,
      availGold: lootPool.gold, availElixir: lootPool.elixir
    };
  }

  function lootFor(th) {
    var base = [0, 1200, 3200, 7000, 14000, 26000][th] || 1200;
    return { gold: Math.round(base * U.randF(0.8, 1.2)), elixir: Math.round(base * U.randF(0.8, 1.2)) };
  }

  function distribute(total, thRef, storages, collectors, key) {
    var thShare = storages.length ? 0.2 : 0.5;
    if (thRef) thRef[key] += Math.round(total * thShare);
    var i;
    if (storages.length) {
      var ss = total * 0.5 / storages.length;
      for (i = 0; i < storages.length; i++) storages[i][key] += Math.round(ss);
    }
    if (collectors.length) {
      var cs = total * 0.3 / collectors.length;
      for (i = 0; i < collectors.length; i++) collectors[i][key] += Math.round(cs);
    }
  }

  /* ---------- 部署 ---------- */
  function canDeployAt(gx, gy) {
    var N = CFG.MAP;
    if (gx < 0 || gy < 0 || gx >= N || gy >= N) return false;
    return !bt.forbid[gy * N + gx];
  }

  function deploy(troopType, wx, wy) {
    var S = COC.State.get();
    if (!bt || bt.ended) return false;
    if ((S.army[troopType] || 0) <= 0) return false;
    var gx = Math.floor(wx), gy = Math.floor(wy);
    if (!canDeployAt(gx, gy)) { COC.FX.badSpot(wx, wy); COC.Audio.play('error', 0.6); return false; }

    S.army[troopType]--;
    if (S.army[troopType] <= 0) delete S.army[troopType];

    var lv = S.troopLv[troopType] || 1;
    var t = COC.Units.create(troopType, lv, wx, wy);
    bt.troops.push(t);
    if (bt.phase === 'scout') beginFight();
    bt.deployed = true;
    COC.FX.poof(wx, wy, 0.45);
    COC.Audio.play('deploy');
    COC.State.markDirty();
    U.emit('battle');
    return true;
  }

  function castSpell(id, wx, wy) {
    var S = COC.State.get();
    if (!bt || bt.ended) return false;
    if ((S.spells[id] || 0) <= 0) return false;
    S.spells[id]--;
    if (S.spells[id] <= 0) delete S.spells[id];
    if (bt.phase === 'scout') beginFight();

    var def = COC.TroopDefs.spell(id);
    if (id === 'lightning') {
      var strikes = 3;
      for (var i = 0; i < strikes; i++) {
        (function (k) {
          setTimeout(function () {
            if (!bt) return;
            var ox = U.randF(-0.8, 0.8), oy = U.randF(-0.8, 0.8);
            var tx = wx + (k === 0 ? 0 : ox), ty = wy + (k === 0 ? 0 : oy);
            COC.FX.lightning(tx, ty);
            COC.Audio.play('lightning', 0.8);
            for (var j = 0; j < bt.buildings.length; j++) {
              var b = bt.buildings[j];
              if (b.hp <= 0) continue;
              var d = U.dist(tx, ty, b.cx, b.cy) - b.size * 0.35;
              if (d <= def.radius) damageBuilding(b, def.dmg / strikes, null);
            }
            for (var m = 0; m < bt.troops.length; m++) { /* 雷电不伤自己部队 */ }
          }, k * 350);
        })(i);
      }
    }
    U.emit('battle');
    return true;
  }

  function beginFight() {
    bt.phase = 'fight';
    COC.Audio.play('battleStart');
    U.emit('battle');
  }

  /* ---------- 伤害 ---------- */
  function damageBuilding(b, dmg, src) {
    if (!bt || b.hp <= 0) return;
    b.hp -= dmg;
    b.hitT = 0.15;
    b.hpShowT = 3;
    if (b.hp <= 0) {
      b.hp = 0;
      b.destroyed = true;
      destroyBuilding(b);
    }
  }

  function destroyBuilding(b) {
    var N = CFG.MAP;
    /* 清理网格 */
    for (var dy = 0; dy < b.size; dy++) for (var dx = 0; dx < b.size; dx++) {
      var idx = (b.y + dy) * N + (b.x + dx);
      bt.grid[idx] = 0;
      delete bt.wallByCell[idx];
    }
    /* 战利品 */
    if (b.lootGold) { bt.lootGold += b.lootGold; }
    if (b.lootElixir) { bt.lootElixir += b.lootElixir; }

    if (b.type === 'wall') {
      COC.FX.smallBlast(b.cx, b.cy, '#c8a468');
      COC.Audio.play('crumble', 0.7);
      /* 墙破了，所有部队重新规划路径 */
      for (var i = 0; i < bt.troops.length; i++) {
        var t = bt.troops[i];
        if (t.subTarget === b) t.subTarget = null;
        t.path = null;
      }
    } else {
      bt.destroyedWeight++;
      bt.percent = Math.round(bt.destroyedWeight / bt.totalWeight * 100);
      COC.FX.explosion(b.cx, b.cy, 0.5 + b.size * 0.28, b.size >= 4 ? 'a' : 'c');
      COC.FX.scorch(b.cx, b.cy, b.size);
      COC.Audio.play(b.size >= 4 ? 'bigExplode' : 'explode');
      if (b.type === 'townhall') bt.thDown = true;
      updateStars();
      /* 部队重寻目标 */
      for (var j = 0; j < bt.troops.length; j++) {
        if (bt.troops[j].target === b) { bt.troops[j].target = null; bt.troops[j].path = null; }
      }
    }
    U.emit('battle');
  }

  function damageTroop(t, dmg) {
    if (t.dead) return;
    t.hp -= dmg;
    t.hitT = 0.15;
    if (t.hp <= 0) t.hp = 0;
  }

  function updateStars() {
    var before = bt.stars;
    var s = 0;
    if (bt.thDown) s++;
    if (bt.percent >= 50) s++;
    if (bt.percent >= 100) s++;
    bt.stars = s;
    if (s > before) {
      COC.Audio.play('star');
      COC.FX.starBurst();
    }
  }

  /* ---------- 帧更新 ---------- */
  function tick(dt) {
    if (!bt || bt.ended) return;
    if (bt.phase !== 'fight') return;

    bt.timer -= dt;
    var i;

    for (i = 0; i < bt.troops.length; i++) COC.Units.update(bt.troops[i], dt, bt);
    for (i = 0; i < bt.buildings.length; i++) {
      var b = bt.buildings[i];
      if (b.hitT) b.hitT = Math.max(0, b.hitT - dt);
      COC.Defenses.update(b, dt, bt);
    }
    for (i = bt.projectiles.length - 1; i >= 0; i--) {
      var p = bt.projectiles[i];
      COC.Defenses.updateProjectile(p, dt, bt);
      if (p.dead) bt.projectiles.splice(i, 1);
    }

    /* 结束判定 */
    var aliveTroops = false;
    for (i = 0; i < bt.troops.length; i++) if (!bt.troops[i].dead) { aliveTroops = true; break; }
    var S = COC.State.get();
    var reserves = COC.State.armyHousing() > 0 || COC.State.spellCount() > 0;

    if (bt.percent >= 100 || bt.timer <= 0 || (bt.deployed && !aliveTroops && !reserves)) {
      endBattle();
    }
  }

  function spawnProjectile(o) {
    var p = {
      kind: o.kind, x: o.sx, y: o.sy, z: o.sz || 20,
      sx0: o.sx, sy0: o.sy, sz: o.sz || 20,
      target: o.target || null, gx: o.gx, gy: o.gy,
      dmg: o.dmg, splash: o.splash || 0,
      fromTroop: !!o.fromTroop, dead: false, dir: 0, t: 0
    };
    if (o.lob) {
      p.lob = true;
      var d = U.dist(o.sx, o.sy, o.gx, o.gy);
      p.flight = Math.max(0.8, d / 7);
      p.arc = 60 + d * 6;
    }
    bt.projectiles.push(p);
  }

  /* ---------- 结束 ---------- */
  function endBattle(surrender) {
    if (!bt || bt.ended) return;
    bt.ended = true;
    bt.phase = 'ended';
    var S = COC.State.get();
    var win = bt.stars > 0;

    /* 战利品入库 */
    COC.Economy.gain('gold', bt.lootGold, true);
    COC.Economy.gain('elixir', bt.lootElixir, true);

    /* 奖杯 */
    var dTrophy;
    if (win) dTrophy = CFG.TROPHY_WIN[bt.stars - 1];
    else dTrophy = -CFG.TROPHY_LOSE;
    S.trophies = Math.max(0, S.trophies + dTrophy);
    bt.trophyDelta = dTrophy;

    COC.State.addXp(10 + bt.percent / 2 + bt.stars * 15);
    COC.State.markDirty();
    COC.State.save();

    setTimeout(function () {
      COC.Audio.play(win ? 'victory' : 'defeat');
      if (win) COC.FX.fireworks();
      U.emit('battleEnd');
    }, 600);
    U.emit('hud');
  }

  function leave() {
    bt = null;
    COC.Mode = 'home';
    COC.Camera.centerOn(CFG.MAP / 2, CFG.MAP / 2 - 2);
    U.emit('mode');
  }

  return {
    state: state, active: active,
    startScout: startScout, nextScout: nextScout,
    deploy: deploy, castSpell: castSpell, canDeployAt: canDeployAt,
    damageBuilding: damageBuilding, damageTroop: damageTroop,
    spawnProjectile: spawnProjectile,
    tick: tick, endBattle: endBattle, leave: leave
  };
})();
