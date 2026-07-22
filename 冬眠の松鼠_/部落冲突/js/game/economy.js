/* ============ 经济系统：资源、建造、升级、收集 ============ */
COC.Economy = (function () {
  'use strict';
  var U = COC.U, CFG = COC.CFG;

  /* ---------- 资源操作 ---------- */
  function canAfford(cost) {
    var S = COC.State.get();
    if (cost.gold && S.gold < cost.gold) return false;
    if (cost.elixir && S.elixir < cost.elixir) return false;
    if (cost.gems && S.gems < cost.gems) return false;
    return true;
  }

  function pay(cost) {
    var S = COC.State.get();
    if (!canAfford(cost)) return false;
    if (cost.gold) S.gold -= cost.gold;
    if (cost.elixir) S.elixir -= cost.elixir;
    if (cost.gems) S.gems -= cost.gems;
    U.emit('hud');
    return true;
  }

  function gain(res, amount, silent) {
    var S = COC.State.get();
    if (res === 'gems') { S.gems += amount; }
    else {
      var cap = COC.State.storageCap(res);
      S[res] = Math.min(cap, S[res] + amount);
    }
    if (!silent) U.emit('hud');
  }

  function costText(cost) {
    if (cost.gold) return { res: 'gold', n: cost.gold };
    if (cost.elixir) return { res: 'elixir', n: cost.elixir };
    if (cost.gems) return { res: 'gems', n: cost.gems };
    return { res: 'gold', n: 0 };
  }

  /* ---------- 收集器 ---------- */
  function tickCollectors() {
    var S = COC.State.get();
    var now = U.now();
    for (var i = 0; i < S.buildings.length; i++) {
      var b = S.buildings[i];
      var def = COC.BuildingDefs.get(b.type);
      if (!def.produces || b.busy) continue;
      if (!b.lastTick) b.lastTick = now;
      var lvd = COC.BuildingDefs.lvl(b.type, b.lv);
      var dt = (now - b.lastTick) / 1000;
      if (dt <= 0) continue;
      b.stored = Math.min(lvd.cap, (b.stored || 0) + lvd.prodHour * dt / 3600);
      b.lastTick = now;
    }
  }

  function collect(b) {
    var S = COC.State.get();
    var def = COC.BuildingDefs.get(b.type);
    if (!def.produces || !b.stored || b.stored < 1) return false;
    var res = def.produces;
    var cap = COC.State.storageCap(res);
    var space = cap - S[res];
    if (space <= 0) { COC.UI.toast(res === 'gold' ? '储金罐已满！' : '圣水瓶已满！'); return false; }
    var take = Math.min(Math.floor(b.stored), space);
    b.stored -= take;
    gain(res, take);
    COC.Audio.play(res === 'gold' ? 'coins' : 'elixir');
    COC.FX.collectBurst(b, res, take);
    COC.State.markDirty();
    return true;
  }

  function collectAll() {
    var S = COC.State.get();
    for (var i = 0; i < S.buildings.length; i++) {
      var b = S.buildings[i];
      var def = COC.BuildingDefs.get(b.type);
      if (def.produces && b.stored >= 1) collect(b);
    }
  }

  /* ---------- 建造 ---------- */
  function canBuild(type) {
    var S = COC.State.get();
    var def = COC.BuildingDefs.get(type);
    var th = COC.State.thLevel();
    var count = COC.State.countType(type);
    if (count >= COC.BuildingDefs.maxCount(type, th)) return { ok: false, why: '数量已达上限（大本营 ' + th + ' 级）' };
    var cost = buildCost(type);
    if (!canAfford(cost)) return { ok: false, why: '资源不足' };
    if (!def.isDeco && type !== 'wall' && COC.State.builderFree() <= 0) return { ok: false, why: '没有空闲的建筑工人' };
    return { ok: true };
  }

  function buildCost(type) {
    var def = COC.BuildingDefs.get(type);
    var lv1 = def.levels[0];
    if (type === 'builderhut') {
      var count = COC.State.countType(type);
      var gc = CFG.BUILDER_HUT_GEM_COST[count] || 500;
      if (gc > 0) return { gems: gc };
      return { gold: 0 };
    }
    return lv1.cost;
  }

  /* 开始放置流程由 UI 层处理，确认后调用 place */
  function placeNew(type, x, y) {
    var S = COC.State.get();
    var def = COC.BuildingDefs.get(type);
    var chk = canBuild(type);
    if (!chk.ok) { COC.UI.toast(chk.why); COC.Audio.play('error'); return null; }
    if (!COC.Village.canPlace(x, y, def.size)) { COC.Audio.play('error'); return null; }
    pay(buildCost(type));
    var time = def.levels[0].time;
    var busy = null;
    if (time > 0 && !def.isDeco && type !== 'wall') {
      busy = { kind: 'build', start: U.now(), end: U.now() + time * 1000, total: time };
    }
    var b = COC.State.addBuilding(type, x, y, 1, busy);
    if (def.produces) { b.stored = 0; b.lastTick = U.now(); }
    COC.Village.rebuild();
    COC.Audio.play('place');
    if (busy) COC.Audio.play('build');
    else COC.State.addXp(4 + def.levels[0].hp / 100);
    COC.State.markDirty();
    U.emit('village'); U.emit('hud');
    return b;
  }

  function moveBuilding(b, x, y) {
    var def = COC.BuildingDefs.get(b.type);
    if (!COC.Village.canPlace(x, y, def.size, b.id)) return false;
    b.x = x; b.y = y;
    COC.Village.rebuild();
    COC.Audio.play('place');
    COC.State.markDirty();
    return true;
  }

  /* ---------- 升级 ---------- */
  function upgradeInfo(b) {
    var def = COC.BuildingDefs.get(b.type);
    if (b.lv >= def.levels.length) return { maxed: true };
    var next = def.levels[b.lv]; // 下一级
    var th = COC.State.thLevel();
    var needTh = next.thReq > th;
    return {
      maxed: false, next: next, cost: next.cost, time: next.time,
      needTh: needTh, thReq: next.thReq
    };
  }

  function canUpgrade(b) {
    var info = upgradeInfo(b);
    if (info.maxed) return { ok: false, why: '已满级' };
    if (info.needTh) return { ok: false, why: '需要 ' + info.thReq + ' 级大本营' };
    if (b.busy) return { ok: false, why: '正在施工中' };
    if (!canAfford(info.cost)) return { ok: false, why: '资源不足' };
    var needBuilder = b.type !== 'wall';
    if (needBuilder && COC.State.builderFree() <= 0) return { ok: false, why: '没有空闲的建筑工人' };
    return { ok: true, info: info };
  }

  function upgrade(b) {
    var chk = canUpgrade(b);
    if (!chk.ok) { COC.UI.toast(chk.why); COC.Audio.play('error'); return false; }
    var info = chk.info;
    pay(info.cost);
    if (b.type === 'wall' || info.time <= 0) {
      b.lv++;
      COC.Audio.play('upgrade');
      COC.State.addXp(3 + b.lv * 2);
      COC.FX.buildDone(b);
    } else {
      b.lv++; // 先升级数据，busy 期间显示施工
      b.busy = { kind: 'upgrade', start: U.now(), end: U.now() + info.time * 1000, total: info.time };
      COC.Audio.play('build');
    }
    COC.State.markDirty();
    U.emit('village'); U.emit('hud');
    return true;
  }

  /* 宝石加速 */
  function gemSkipCost(b) {
    if (!b.busy) return 0;
    var remain = (b.busy.end - U.now()) / 1000;
    return Math.max(1, Math.ceil(remain / 60 * CFG.GEM_PER_MIN_SKIP));
  }

  function gemFinish(b) {
    var S = COC.State.get();
    var cost = gemSkipCost(b);
    if (S.gems < cost) { COC.UI.toast('宝石不足'); COC.Audio.play('error'); return false; }
    S.gems -= cost;
    COC.Audio.play('gem');
    COC.State.finishBusy(b);
    COC.State.markDirty();
    U.emit('hud');
    return true;
  }

  /* ---------- 移除装饰 ---------- */
  function removeDeco(b) {
    var S = COC.State.get();
    var def = COC.BuildingDefs.get(b.type);
    if (!def.isDeco) return false;
    var idx = S.buildings.indexOf(b);
    if (idx >= 0) {
      S.buildings.splice(idx, 1);
      gain('gold', Math.floor((def.levels[0].cost.gold || 0) * 0.3));
      COC.Village.rebuild();
      COC.Audio.play('crumble');
      U.emit('village');
      return true;
    }
    return false;
  }

  /* ---------- 障碍清理 ---------- */
  function startClearObstacle(o) {
    var S = COC.State.get();
    var def = COC.BuildingDefs.OBSTACLES[o.kind];
    if (o.clearing) return false;
    if (COC.State.builderFree() <= 0) { COC.UI.toast('没有空闲的建筑工人'); COC.Audio.play('error'); return false; }
    if (!canAfford(def.cost)) { COC.UI.toast('资源不足'); COC.Audio.play('error'); return false; }
    pay(def.cost);
    o.clearing = { start: U.now(), end: U.now() + def.time * 1000, total: def.time };
    COC.Audio.play('build');
    COC.State.markDirty();
    return true;
  }

  function finishClearObstacle(o, silent) {
    var S = COC.State.get();
    var def = COC.BuildingDefs.OBSTACLES[o.kind];
    var idx = S.obstacles.indexOf(o);
    if (idx < 0) return;
    S.obstacles.splice(idx, 1);
    COC.Village.rebuild();
    if (def.reward) {
      if (def.reward.gold) gain('gold', def.reward.gold, silent);
    }
    COC.State.addXp(5);
    if (!silent) {
      COC.Audio.play('crumble');
      if (Math.random() < CFG.OBSTACLE_GEM_CHANCE) {
        var g = U.randInt(1, 6);
        gain('gems', g);
        COC.UI.toast('💎 清理障碍获得 ' + g + ' 宝石！');
        COC.Audio.play('gem');
      }
      U.emit('village');
    }
  }

  /* 每秒逻辑帧 */
  function tick() {
    var S = COC.State.get();
    if (!S) return;
    tickCollectors();
    var now = U.now(), i;
    for (i = 0; i < S.buildings.length; i++) {
      var b = S.buildings[i];
      if (b.busy && now >= b.busy.end) COC.State.finishBusy(b);
    }
    for (i = S.obstacles.length - 1; i >= 0; i--) {
      var o = S.obstacles[i];
      if (o.clearing && now >= o.clearing.end) finishClearObstacle(o);
    }
  }

  return {
    canAfford: canAfford, pay: pay, gain: gain, costText: costText,
    collect: collect, collectAll: collectAll,
    canBuild: canBuild, buildCost: buildCost, placeNew: placeNew, moveBuilding: moveBuilding,
    upgradeInfo: upgradeInfo, canUpgrade: canUpgrade, upgrade: upgrade,
    gemSkipCost: gemSkipCost, gemFinish: gemFinish,
    removeDeco: removeDeco,
    startClearObstacle: startClearObstacle, finishClearObstacle: finishClearObstacle,
    tick: tick
  };
})();
