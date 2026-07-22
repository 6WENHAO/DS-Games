/* ============ 战斗 UI ============ */
COC.BattleUI = (function () {
  'use strict';
  var U = COC.U, CFG = COC.CFG;

  function $(id) { return document.getElementById(id); }

  function init() {
    $('btn-scout-attack').onclick = function () {
      COC.Audio.play('confirm');
      $('scout-bar').classList.add('hidden');
      COC.UI.toast('部署你的部队开始进攻！');
    };
    $('btn-scout-next').onclick = function () {
      COC.Audio.play('click');
      COC.Battle.nextScout();
      COC.Renderer.invalidateGround();
      refreshDeployBar();
    };
    $('btn-scout-home').onclick = function () {
      COC.Audio.play('close');
      exitToHome();
    };
    $('btn-battle-end').onclick = function () {
      COC.Audio.play('click');
      COC.Battle.endBattle();
    };
    $('btn-battle-surrender').onclick = function () {
      COC.Audio.play('click');
      COC.Battle.endBattle(true);
    };
    $('btn-result-home').onclick = function () {
      COC.Audio.play('confirm');
      $('result-panel').classList.add('hidden');
      exitToHome();
    };
    $('scout-cost').textContent = CFG.SCOUT_COST;

    U.on('battle', refreshDeployBar);
    U.on('battleEnd', showResult);
  }

  /* ---------- 进入 / 退出 ---------- */
  function enter() {
    var S = COC.State.get();
    if (COC.State.armyHousing() <= 0 && COC.State.spellCount() <= 0) {
      COC.UI.toast('你还没有部队！先去兵营训练吧');
      COC.Audio.play('error');
      return;
    }
    COC.Mode = 'battle';
    COC.PanelsUI.deselect();
    COC.FX.clear();
    COC.Battle.startScout();
    COC.Renderer.invalidateGround();
    U.emit('mode');
    $('hud-bottom').classList.add('hidden');
    $('battle-hud').classList.remove('hidden');
    $('scout-bar').classList.remove('hidden');
    $('battle-actions').classList.add('hidden');
    var bt = COC.Battle.state();
    COC.UI.toast('发现对手：' + bt.enemy.name + '（' + bt.enemy.th + '本）');
    refreshDeployBar();
    updateTop();
  }

  function exitToHome() {
    COC.Battle.leave();
    COC.FX.clear();
    COC.Renderer.invalidateGround();
    $('battle-hud').classList.add('hidden');
    $('scout-bar').classList.add('hidden');
    U.emit('mode');
    U.emit('hud');
  }

  /* ---------- 部署栏 ---------- */
  function refreshDeployBar() {
    var bar = $('deploy-bar');
    if (!bar) return;
    var bt = COC.Battle.state();
    if (!bt) return;
    var S = COC.State.get();
    bar.innerHTML = '';
    var entries = [];
    var t;
    for (t in S.army) if (S.army[t] > 0) entries.push({ kind: 'troop', id: t, n: S.army[t] });
    for (t in S.spells) if (S.spells[t] > 0) entries.push({ kind: 'spell', id: t, n: S.spells[t] });

    if (!entries.length) {
      bar.innerHTML = '<div style="color:#57431f;font-weight:bold;padding:0 20px">没有可部署的部队了</div>';
      return;
    }

    for (var i = 0; i < entries.length; i++) {
      var e = entries[i];
      var slot = document.createElement('div');
      slot.className = 'deploy-slot' + (e.kind === 'spell' ? ' spell' : '');
      var iconKey = e.kind === 'troop' ? COC.TroopDefs.get(e.id).icon : COC.TroopDefs.spell(e.id).icon;
      var img = COC.Assets.img(iconKey);
      slot.innerHTML = '<img src="' + (img ? img.src : '') + '"><span class="d-cnt">' + e.n + '</span>';
      slot.title = e.kind === 'troop' ? COC.TroopDefs.get(e.id).name : COC.TroopDefs.spell(e.id).name;
      var active = (e.kind === 'troop' && bt.selectedTroop === e.id) || (e.kind === 'spell' && bt.selectedSpell === e.id);
      if (active) slot.classList.add('active');
      (function (entry) {
        slot.onclick = function () {
          COC.Audio.play('click');
          if (entry.kind === 'troop') {
            bt.selectedTroop = bt.selectedTroop === entry.id ? null : entry.id;
            bt.selectedSpell = null;
          } else {
            bt.selectedSpell = bt.selectedSpell === entry.id ? null : entry.id;
            bt.selectedTroop = null;
          }
          refreshDeployBar();
        };
      })(e);
      bar.appendChild(slot);
    }
  }

  /* ---------- 地图点击 ---------- */
  function onTap(sx, sy) {
    var bt = COC.Battle.state();
    if (!bt || bt.ended) return;
    var g = COC.Camera.toGrid(sx, sy);
    if (g.x < 0 || g.y < 0 || g.x >= CFG.MAP || g.y >= CFG.MAP) return;

    if (bt.selectedSpell) {
      if (COC.Battle.castSpell(bt.selectedSpell, g.x, g.y)) {
        var S = COC.State.get();
        if (!S.spells[bt.selectedSpell]) bt.selectedSpell = null;
        if (bt.phase === 'fight') $('scout-bar').classList.add('hidden');
        showFightUI();
        refreshDeployBar();
      }
      return;
    }
    if (bt.selectedTroop) {
      if (COC.Battle.deploy(bt.selectedTroop, g.x, g.y)) {
        var S2 = COC.State.get();
        if (!S2.army[bt.selectedTroop]) {
          bt.selectedTroop = null;
          /* 自动选择下一个还有数量的兵种 */
          for (var t in S2.army) { if (S2.army[t] > 0) { bt.selectedTroop = t; break; } }
        }
        showFightUI();
        refreshDeployBar();
      }
      return;
    }
    COC.UI.toast('先在下方选择要部署的部队');
  }

  function showFightUI() {
    var bt = COC.Battle.state();
    if (bt && bt.phase === 'fight') {
      $('scout-bar').classList.add('hidden');
      $('battle-actions').classList.remove('hidden');
    }
  }

  /* ---------- 每帧顶部数据 ---------- */
  function updateTop() {
    var bt = COC.Battle.state();
    if (!bt) return;
    var m = Math.floor(Math.max(0, bt.timer) / 60), s = Math.floor(Math.max(0, bt.timer) % 60);
    $('battle-timer').textContent = bt.phase === 'scout' ? '侦察中' : m + ':' + (s < 10 ? '0' + s : s);
    var stars = '';
    for (var i = 0; i < 3; i++) stars += i < bt.stars ? '★' : '☆';
    $('battle-stars').textContent = stars;
    $('battle-percent').textContent = bt.percent + '%';
    if (bt.phase === 'scout') {
      $('loot-gold').textContent = U.fmt(bt.availGold);
      $('loot-elixir').textContent = U.fmt(bt.availElixir);
    } else {
      $('loot-gold').textContent = U.fmt(bt.lootGold);
      $('loot-elixir').textContent = U.fmt(bt.lootElixir);
    }
  }

  function tick() {
    if (COC.Mode !== 'battle') return;
    updateTop();
  }

  /* ---------- 结算 ---------- */
  function showResult() {
    var bt = COC.Battle.state();
    if (!bt) return;
    var win = bt.stars > 0;
    $('result-title').textContent = win ? '🎉 胜利！' : '💀 战败…';
    var starsHtml = '';
    for (var i = 0; i < 3; i++) {
      starsHtml += '<span class="' + (i < bt.stars ? 'earned' : '') + '">★</span>';
    }
    $('result-stars').innerHTML = starsHtml;
    $('result-loot').innerHTML =
      '<span><img src="assets/img/icons/gold.png"> +' + U.fmt(bt.lootGold) + '</span>' +
      '<span><img src="assets/img/icons/elixir.png"> +' + U.fmt(bt.lootElixir) + '</span>' +
      '<span>🏆 ' + (bt.trophyDelta >= 0 ? '+' : '') + bt.trophyDelta + '</span>' +
      '<div style="margin-top:8px;font-size:15px;opacity:.75">摧毁 ' + bt.percent + '% · ' + bt.enemy.name + '</div>';
    $('result-panel').classList.remove('hidden');
    $('battle-actions').classList.add('hidden');
  }

  return { init: init, enter: enter, onTap: onTap, tick: tick, refreshDeployBar: refreshDeployBar };
})();
