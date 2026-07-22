/* ============ 玩家状态 & 存档 ============ */
COC.State = (function () {
  'use strict';
  var U = COC.U, CFG = COC.CFG;

  var S = null;          // 当前存档对象
  var dirty = false;

  function fresh() {
    return {
      ver: 1,
      name: '酋长',
      xp: 0, level: 1, trophies: 0,
      gold: CFG.START_GOLD, elixir: CFG.START_ELIXIR, gems: CFG.START_GEMS,
      buildings: [],
      obstacles: [],
      army: {},
      queue: [],            // [{troop, need, start}] 顺序训练
      spells: {},
      brewing: null,        // {spell, start, time}
      troopLv: { barbarian: 1, archer: 1, goblin: 1, giant: 1, wallbreaker: 1, wizard: 1 },
      labBusy: null,        // {troop, start, time}
      nextId: 1,
      soundOn: true,
      created: U.now(),
      lastSeen: U.now()
    };
  }

  /* ---------- 初始村庄 ---------- */
  function setupStarterVillage() {
    var V = COC.Village;
    addBuilding('townhall', 20, 18, 1);
    addBuilding('goldmine', 16, 24, 1);
    addBuilding('elixirpump', 25, 24, 1);
    addBuilding('goldstorage', 16, 14, 1);
    addBuilding('elixirstorage', 26, 14, 1);
    addBuilding('cannon', 21, 25, 1);
    addBuilding('barracks', 27, 19, 1);
    addBuilding('armycamp', 12, 19, 1);
    addBuilding('builderhut', 24, 11, 1);
    addBuilding('builderhut', 18, 11, 1);
    V.spawnObstacles(CFG.HOME_SPAWN_TREES);
    S.army = { barbarian: 10 };
  }

  function addBuilding(type, x, y, lv, busy) {
    var b = {
      id: S.nextId++, type: type, lv: lv || 1, x: x, y: y,
      busy: busy || null
    };
    var def = COC.BuildingDefs.get(type);
    if (def.produces) { b.stored = 0; b.lastTick = U.now(); }
    S.buildings.push(b);
    return b;
  }

  /* ---------- 计算属性 ---------- */
  function builderTotal() {
    var n = 0;
    for (var i = 0; i < S.buildings.length; i++) {
      if (S.buildings[i].type === 'builderhut') n++;
    }
    return n;
  }
  function builderBusy() {
    var n = 0, i;
    for (i = 0; i < S.buildings.length; i++) if (S.buildings[i].busy) n++;
    for (i = 0; i < S.obstacles.length; i++) if (S.obstacles[i].clearing) n++;
    return n;
  }
  function builderFree() { return builderTotal() - builderBusy(); }

  function thLevel() {
    for (var i = 0; i < S.buildings.length; i++) {
      if (S.buildings[i].type === 'townhall') return S.buildings[i].lv;
    }
    return 1;
  }

  function storageCap(res) {
    var cap = 1000; // 大本营基础
    for (var i = 0; i < S.buildings.length; i++) {
      var b = S.buildings[i];
      var def = COC.BuildingDefs.get(b.type);
      if (def.stores === res && !isUnderConstruction(b)) {
        cap += COC.BuildingDefs.lvl(b.type, b.lv).store;
      }
    }
    return cap;
  }

  function campCap() {
    var cap = 0;
    for (var i = 0; i < S.buildings.length; i++) {
      var b = S.buildings[i];
      var def = COC.BuildingDefs.get(b.type);
      var lvd = COC.BuildingDefs.lvl(b.type, b.lv);
      if (lvd && lvd.camp && !isUnderConstruction(b)) cap += lvd.camp;
    }
    return cap;
  }

  function armyHousing() {
    var n = 0;
    for (var t in S.army) n += (COC.TroopDefs.get(t).housing * S.army[t]);
    return n;
  }

  function spellCap() {
    var cap = 0;
    for (var i = 0; i < S.buildings.length; i++) {
      var b = S.buildings[i];
      var lvd = COC.BuildingDefs.lvl(b.type, b.lv);
      if (lvd && lvd.spellCap && !isUnderConstruction(b)) cap = Math.max(cap, lvd.spellCap);
    }
    return cap;
  }

  function spellCount() {
    var n = 0;
    for (var k in S.spells) n += S.spells[k];
    return n;
  }

  function maxBarracksLv() {
    var lv = 0;
    for (var i = 0; i < S.buildings.length; i++) {
      var b = S.buildings[i];
      if (b.type === 'barracks' && !isUnderConstruction(b)) lv = Math.max(lv, b.lv);
    }
    return lv;
  }

  function labLevel() {
    var lv = 0;
    for (var i = 0; i < S.buildings.length; i++) {
      var b = S.buildings[i];
      if (b.type === 'laboratory' && !isUnderConstruction(b)) lv = Math.max(lv, b.lv);
    }
    return lv;
  }

  function isUnderConstruction(b) { return !!(b.busy && b.busy.kind === 'build'); }

  function countType(type) {
    var n = 0;
    for (var i = 0; i < S.buildings.length; i++) if (S.buildings[i].type === type) n++;
    return n;
  }

  function findBuilding(id) {
    for (var i = 0; i < S.buildings.length; i++) if (S.buildings[i].id === id) return S.buildings[i];
    return null;
  }

  /* ---------- XP ---------- */
  function xpNeed(lv) { return 60 * lv * lv; }
  function addXp(n) {
    S.xp += Math.max(1, Math.floor(n));
    while (S.xp >= xpNeed(S.level)) {
      S.xp -= xpNeed(S.level);
      S.level++;
      COC.Audio.play('levelup');
      COC.UI.toast('🎉 声望等级提升至 ' + S.level + '！');
      if (S.level % 2 === 0) { S.gems += 25; COC.UI.toast('💎 获得 25 宝石奖励'); }
    }
    U.emit('hud');
  }

  /* ---------- 存档 ---------- */
  function save() {
    if (!S) return;
    S.lastSeen = U.now();
    try {
      localStorage.setItem(CFG.SAVE_KEY, JSON.stringify(S));
      dirty = false;
    } catch (e) { console.warn('存档失败', e); }
  }

  function load() {
    try {
      var raw = localStorage.getItem(CFG.SAVE_KEY);
      if (raw) {
        S = JSON.parse(raw);
        return true;
      }
    } catch (e) { console.warn('读档失败', e); }
    return false;
  }

  function reset() {
    localStorage.removeItem(CFG.SAVE_KEY);
    S = fresh();
    setupStarterVillage();
    save();
  }

  function init() {
    if (!load()) {
      S = fresh();
      setupStarterVillage();
      save();
    }
    applyOffline();
  }

  /* ---------- 离线进度 ---------- */
  function applyOffline() {
    var now = U.now(), i;
    /* 建造/升级完成 */
    for (i = 0; i < S.buildings.length; i++) {
      var b = S.buildings[i];
      if (b.busy && now >= b.busy.end) finishBusy(b, true);
    }
    /* 障碍清理完成 */
    for (i = S.obstacles.length - 1; i >= 0; i--) {
      var o = S.obstacles[i];
      if (o.clearing && now >= o.clearing.end) COC.Economy.finishClearObstacle(o, true);
    }
    /* 训练队列（离线推进） */
    COC.Training.advanceQueue(true);
    /* 法术酿造 */
    if (S.brewing && now >= S.brewing.start + S.brewing.time * 1000) {
      S.spells[S.brewing.spell] = (S.spells[S.brewing.spell] || 0) + 1;
      S.brewing = null;
    }
    /* 实验室 */
    if (S.labBusy && now >= S.labBusy.start + S.labBusy.time * 1000) {
      S.troopLv[S.labBusy.troop] = (S.troopLv[S.labBusy.troop] || 1) + 1;
      S.labBusy = null;
    }
  }

  function finishBusy(b, silent) {
    var wasBuild = b.busy.kind === 'build';
    var t = b.busy.total || 10;
    b.busy = null;
    addXp(Math.sqrt(t) + b.lv * 4);
    if (!silent) {
      COC.Audio.play('upgrade');
      COC.FX.buildDone(b);
      COC.UI.toast((wasBuild ? '建造完成：' : '升级完成：') + COC.BuildingDefs.get(b.type).name +
        (wasBuild ? '' : ' Lv.' + b.lv));
    }
    U.emit('village');
    U.emit('hud');
  }

  function markDirty() { dirty = true; }

  /* 周期存档 */
  setInterval(function () { if (S) save(); }, CFG.SAVE_INTERVAL);
  window.addEventListener('beforeunload', function () { if (S) save(); });

  return {
    init: init, save: save, reset: reset,
    get: function () { return S; },
    addBuilding: addBuilding, findBuilding: findBuilding, countType: countType,
    builderTotal: builderTotal, builderBusy: builderBusy, builderFree: builderFree,
    thLevel: thLevel, storageCap: storageCap, campCap: campCap, armyHousing: armyHousing,
    spellCap: spellCap, spellCount: spellCount, maxBarracksLv: maxBarracksLv, labLevel: labLevel,
    isUnderConstruction: isUnderConstruction,
    addXp: addXp, xpNeed: xpNeed,
    finishBusy: finishBusy, markDirty: markDirty
  };
})();
