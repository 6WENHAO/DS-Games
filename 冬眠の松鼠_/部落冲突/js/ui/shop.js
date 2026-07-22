/* ============ 商店 ============ */
COC.ShopUI = (function () {
  'use strict';
  var U = COC.U;
  var currentTab = 'economy';

  function $(id) { return document.getElementById(id); }

  function init() {
    var tabs = document.querySelectorAll('#shop-tabs .tab');
    for (var i = 0; i < tabs.length; i++) {
      (function (t) {
        t.onclick = function () {
          currentTab = t.getAttribute('data-tab');
          for (var j = 0; j < tabs.length; j++) tabs[j].classList.remove('active');
          t.classList.add('active');
          COC.Audio.play('click');
          refresh();
        };
      })(tabs[i]);
    }
  }

  function open() {
    $('shop-panel').classList.remove('hidden');
    refresh();
  }

  function close() { $('shop-panel').classList.add('hidden'); }

  function iconFor(type) {
    var spr = COC.BuildingDefs.spriteFor(type, 1);
    var key = spr.key;
    if (type === 'goldmine') key = 'goldmine_8';
    if (type === 'archertower') key = 'atower_a2_0';
    if (type === 'wall') key = 'wall_wood_corner2';
    var img = COC.Assets.img(key);
    return img ? img.src : '';
  }

  function refresh() {
    var grid = $('shop-grid');
    grid.innerHTML = '';
    var S = COC.State.get();
    var th = COC.State.thLevel();
    var list = COC.BuildingDefs.shopList(currentTab);

    /* 大本营升级卡放在资源页最前面 */
    if (currentTab === 'economy') list = ['townhall'].concat(list);

    for (var i = 0; i < list.length; i++) {
      var type = list[i];
      var def = COC.BuildingDefs.get(type);
      var card = document.createElement('div');
      card.className = 'card';

      if (type === 'townhall') {
        makeTownhallCard(card);
        grid.appendChild(card);
        continue;
      }

      var count = COC.State.countType(type);
      var max = COC.BuildingDefs.maxCount(type, th);
      var cost = COC.Economy.buildCost(type);
      var ct = COC.Economy.costText(cost);
      var costIcon = ct.res === 'gems' ? 'assets/img/icons/gem.png' : 'assets/img/icons/' + (ct.res === 'gold' ? 'gold' : 'elixir') + '.png';
      var lv1 = def.levels[0];

      var lockText = '';
      var maxAll = def.maxByTH[def.maxByTH.length - 1];
      if (max <= 0) {
        var needTh = 1;
        for (var t2 = 0; t2 < def.maxByTH.length; t2++) if (def.maxByTH[t2] > 0) { needTh = t2 + 1; break; }
        lockText = '需要 ' + needTh + ' 级大本营';
      } else if (count >= max) {
        lockText = '已达上限';
      }

      card.innerHTML =
        '<span class="c-cnt">' + count + '/' + Math.max(max, count) + '</span>' +
        '<img class="thumb" src="' + iconFor(type) + '">' +
        '<div class="c-name">' + def.name + '</div>' +
        '<div class="c-sub">' + (lockText || (lv1.time > 0 ? '建造 ' + U.fmtTime(lv1.time) : '立即建成')) + '</div>' +
        '<div class="c-cost ' + ct.res + '"><img src="' + costIcon + '">' + (ct.n > 0 ? U.fmt(ct.n) : '免费') + '</div>';

      if (lockText) {
        card.classList.add('disabled');
      } else {
        (function (tp) {
          card.onclick = function () {
            var chk = COC.Economy.canBuild(tp);
            if (!chk.ok) { COC.UI.toast(chk.why); COC.Audio.play('error'); return; }
            close();
            COC.Audio.play('confirm');
            COC.PanelsUI.startPlacing(tp);
          };
        })(type);
      }
      grid.appendChild(card);
    }
  }

  function makeTownhallCard(card) {
    var S = COC.State.get();
    var th = null;
    for (var i = 0; i < S.buildings.length; i++) if (S.buildings[i].type === 'townhall') th = S.buildings[i];
    if (!th) return;
    var info = COC.Economy.upgradeInfo(th);
    var img = COC.Assets.img(COC.BuildingDefs.spriteFor('townhall', th.lv).key);
    if (info.maxed) {
      card.innerHTML = '<span class="c-lv">Lv.' + th.lv + '</span><img class="thumb" src="' + (img ? img.src : '') + '">' +
        '<div class="c-name">大本营</div><div class="c-sub">已满级</div>';
      card.classList.add('disabled');
      return;
    }
    card.innerHTML =
      '<span class="c-lv">Lv.' + th.lv + '</span>' +
      '<img class="thumb" src="' + (img ? img.src : '') + '">' +
      '<div class="c-name">升级大本营</div>' +
      '<div class="c-sub">升至 ' + (th.lv + 1) + ' 级 · ' + U.fmtTime(info.time) + '</div>' +
      '<div class="c-cost gold"><img src="assets/img/icons/gold.png">' + U.fmt(info.cost.gold || 0) + '</div>';
    card.onclick = function () {
      close();
      COC.PanelsUI.select(th);
      COC.Camera.centerOn(th.x + 2, th.y + 2);
    };
  }

  return { init: init, open: open, close: close, refresh: refresh };
})();
