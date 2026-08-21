/* 铁幕1994 — 主控：存档、战略效果合并、屏幕路由、启动 */
(function () {
  'use strict';
  var IC = window.IC;
  var U = IC.Util, UI = IC.UI, S = IC.Screens;

  var Game = IC.Game = {};

  function blankCampaign() {
    return { progress: 0, sp: 4, pc: 1, doomsday: 0, strategic: [], nukes: 0, log: [], lastEnding: null };
  }
  function blankSave() {
    return {
      version: 1, mode: 'advanced94', side: 'NATO',
      campaigns: { NATO: blankCampaign(), WP: blankCampaign() },
      decks: {}
    };
  }

  Game.load = function () {
    var raw = IC.Store.read();
    var sv = (raw && raw.game) ? raw.game : null;
    if (!sv || sv.version !== 1) sv = blankSave();
    ['NATO', 'WP'].forEach(function (s) {
      if (!sv.campaigns[s]) sv.campaigns[s] = blankCampaign();
      var c = sv.campaigns[s];
      if (!c.strategic) c.strategic = [];
      if (c.sp == null) c.sp = 4;
      if (c.pc == null) c.pc = 1;
      if (c.doomsday == null) c.doomsday = 0;
      if (c.progress == null) c.progress = 0;
    });
    if (!sv.decks) sv.decks = {};
    Game.save = sv;
    Game.mode = sv.mode || 'advanced94';
    Game.side = sv.side || 'NATO';
  };

  Game.persist = function () {
    Game.save.mode = Game.mode;
    Game.save.side = Game.side;
    IC.Store.patch({ game: Game.save });
  };

  Game.reset = function () {
    Game.save = blankSave();
    Game.mode = 'advanced94'; Game.side = 'NATO';
    Game.persist();
  };

  /* ---------- 卡组存取（按阵营 + 模式分别保存） ---------- */
  Game.deckKey = function (side, mode) { return side + '|' + mode; };
  Game.getDeck = function (side, mode) {
    var k = Game.deckKey(side, mode);
    if (!Game.save.decks[k]) Game.save.decks[k] = { cards: [], support: [], ops: [] };
    var d = Game.save.decks[k];
    if (!d.cards) d.cards = [];
    if (!d.support) d.support = [];
    if (!d.ops) d.ops = [];
    return d;
  };
  Game.setDeck = function (side, mode, d) {
    Game.save.decks[Game.deckKey(side, mode)] = d;
    Game.persist();
  };

  /* ---------- 战略层效果合并 ---------- */
  var MULT_KEYS = { incomeMult: 1, enemyIncomeMult: 1, opsCostMult: 1 };
  Game.stratEffects = function (side) {
    var cs = Game.save.campaigns[side];
    var acc = { unlockOps: [] };
    for (var k in MULT_KEYS) acc[k] = 1;
    (cs.strategic || []).forEach(function (id) {
      var op = (window.DATA_HYBRID.strategic || []).filter(function (x) { return x.id === id; })[0];
      if (!op || !op.effects) return;
      var e = op.effects;
      Object.keys(e).forEach(function (key) {
        var v = e[key];
        if (key === 'unlockOps') {
          (v || []).forEach(function (o) { if (acc.unlockOps.indexOf(o) < 0) acc.unlockOps.push(o); });
        } else if (MULT_KEYS.hasOwnProperty(key)) {
          acc[key] = (acc[key] || 1) * v;
        } else if (typeof v === 'number') {
          acc[key] = (acc[key] || 0) + v;
        } else {
          acc[key] = acc[key] || v;
        }
      });
    });
    /* 政治资本折算为核授权概率加成 */
    acc.nukeAuthBonus = (acc.nukeAuthBonus || 0) + (cs.pc || 0) * 0.04;
    return acc;
  };

  /* ---------- 启动 ---------- */
  function boot() {
    try {
      Game.load();
      /* 数据完整性检查 */
      var need = ['DATA_UNITS_WP', 'DATA_UNITS_NATO', 'DATA_MODS', 'DATA_SUPPORT', 'DATA_HYBRID', 'DATA_LORE', 'DATA_CAMPAIGN'];
      var missing = need.filter(function (k) { return !window[k]; });
      if (missing.length) throw new Error('数据文件缺失：' + missing.join('、'));

      U.byId('btn-campaign').onclick = function () { S.campaign(Game.side); };
      U.byId('btn-skirmish').onclick = function () { S.skirmish(); };
      U.byId('btn-lore').onclick = function () { S.showLore(); };
      U.byId('btn-help').onclick = function () { S.showHelp(false); };
      U.byId('btn-wipe').onclick = function () {
        UI.confirm('清除存档', '将清除两条战线的全部进度、战略投资与卡组。此操作无法撤销。', function () {
          Game.reset();
          S.menu();
          UI.toast('存档已清除。');
        }, '清除');
      };
      S.menu();
      console.log('[铁幕1994] 就绪：华约 ' + window.DATA_UNITS_WP.length + ' 卡 / 北约 ' + window.DATA_UNITS_NATO.length +
        ' 卡 / 改装 ' + Object.keys(window.DATA_MODS).length + ' 项 / 支援 ' + window.DATA_SUPPORT.length +
        ' 项 / 超限战指令 ' + window.DATA_HYBRID.battleOps.length + ' 条');
    } catch (e) {
      var f = U.byId('fatal'), b = U.byId('fatal-body');
      if (f && b) { f.style.display = 'block'; b.innerHTML += '<p>启动失败：' + U.esc(e.message) + '</p><pre>' + U.esc(e.stack || '') + '</pre>'; }
      throw e;
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
