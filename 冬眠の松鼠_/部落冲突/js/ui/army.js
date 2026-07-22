/* ============ 军队面板 / 实验室 ============ */
COC.ArmyUI = (function () {
  'use strict';
  var U = COC.U;
  var timer = null;

  function $(id) { return document.getElementById(id); }

  function init() {
    U.on('army', function () {
      if (!$('army-panel').classList.contains('hidden')) refresh();
    });
  }

  function open() {
    $('army-panel').classList.remove('hidden');
    refresh();
    if (timer) clearInterval(timer);
    timer = setInterval(function () {
      if ($('army-panel').classList.contains('hidden')) { clearInterval(timer); timer = null; return; }
      refreshQueueOnly();
    }, 300);
  }

  function troopImg(id) {
    var img = COC.Assets.img(COC.TroopDefs.get(id).icon);
    return img ? img.src : '';
  }

  function refresh() {
    var S = COC.State.get();

    /* 容量信息 */
    var used = COC.State.armyHousing();
    var cap = COC.State.campCap();
    $('army-camp-info').innerHTML = '驻地容量：<b>' + used + '/' + cap + '</b>' +
      (COC.State.maxBarracksLv() <= 0 ? ' · <span style="color:#a33">需要先建造兵营</span>' : '');

    /* 当前军队 */
    var cur = $('army-current');
    cur.innerHTML = '';
    var any = false;
    for (var t in S.army) {
      if (S.army[t] <= 0) continue;
      any = true;
      var chip = document.createElement('div');
      chip.className = 'unit-chip';
      chip.innerHTML = '<img src="' + troopImg(t) + '"><span class="u-cnt">×' + S.army[t] + '</span>' +
        '<span class="u-lv">Lv.' + (S.troopLv[t] || 1) + '</span>';
      chip.title = COC.TroopDefs.get(t).name;
      cur.appendChild(chip);
    }
    if (!any) cur.innerHTML = '<div style="opacity:.6;font-size:14px;line-height:60px">还没有部队，快训练吧！</div>';

    /* 训练卡片 */
    var grid = $('train-grid');
    grid.innerHTML = '';
    var list = COC.TroopDefs.list();
    var bLv = COC.State.maxBarracksLv();
    for (var i = 0; i < list.length; i++) {
      var id = list[i];
      var def = COC.TroopDefs.get(id);
      var locked = bLv < def.barracksLv;
      var card = document.createElement('div');
      card.className = 'card' + (locked ? ' disabled' : '');
      card.innerHTML =
        '<span class="c-lv">Lv.' + (S.troopLv[id] || 1) + '</span>' +
        '<span class="c-cnt">🏠' + def.housing + '</span>' +
        '<img class="thumb" src="' + troopImg(id) + '">' +
        '<div class="c-name">' + def.name + '</div>' +
        '<div class="c-sub">' + (locked ? '需要' + def.barracksLv + '级兵营' : U.fmtTime(def.trainTime)) + '</div>' +
        '<div class="c-cost elixir"><img src="assets/img/icons/elixir.png">' + def.cost + '</div>';
      if (!locked) {
        (function (tid) {
          card.onclick = function () { COC.Training.train(tid); refresh(); };
        })(id);
      }
      grid.appendChild(card);
    }

    refreshQueueOnly();
    refreshSpells();
  }

  function refreshQueueOnly() {
    var S = COC.State.get();
    var qr = $('train-queue');
    var qi = $('queue-info');
    qr.innerHTML = '';
    if (!S.queue.length) {
      qr.innerHTML = '<div style="opacity:.5;font-size:13px">训练队列为空</div>';
      qi.textContent = '';
      return;
    }
    var prog = COC.Training.queueProgress();
    qi.textContent = '（队列 ' + S.queue.length + '）';
    for (var i = 0; i < S.queue.length; i++) {
      var q = S.queue[i];
      var item = document.createElement('div');
      item.className = 'q-item';
      var pct = i === 0 && prog ? Math.round(prog.pct * 100) : 0;
      item.innerHTML = '<img src="' + troopImg(q.troop) + '">' +
        '<div class="q-bar" style="width:' + pct + '%"></div>' +
        '<div class="q-x">×</div>';
      (function (idx) {
        item.querySelector('.q-x').onclick = function () { COC.Training.cancelQueued(idx); };
      })(i);
      qr.appendChild(item);
    }
  }

  function refreshSpells() {
    var S = COC.State.get();
    var row = $('spell-row');
    row.innerHTML = '';
    var cap = COC.State.spellCap();
    if (cap <= 0) {
      row.innerHTML = '<div style="opacity:.6;font-size:14px;line-height:60px">建造法术工厂后解锁法术</div>';
      return;
    }
    var ids = COC.TroopDefs.spellList();
    for (var i = 0; i < ids.length; i++) {
      var id = ids[i];
      var def = COC.TroopDefs.spell(id);
      var have = S.spells[id] || 0;

      var chip = document.createElement('div');
      chip.className = 'unit-chip spell';
      var img = COC.Assets.img(def.icon);
      chip.innerHTML = '<img src="' + (img ? img.src : '') + '"><span class="u-cnt">×' + have + '</span>';
      chip.title = def.name + '：' + def.desc;
      row.appendChild(chip);

      var btn = document.createElement('button');
      btn.className = 'act-btn blue';
      if (S.brewing) {
        var remain = Math.max(0, (S.brewing.start + S.brewing.time * 1000 - U.now()) / 1000);
        btn.textContent = '酿造中 ' + U.fmtTime(remain);
        btn.disabled = true;
      } else if (COC.State.spellCount() >= cap) {
        btn.textContent = '法术库已满 (' + COC.State.spellCount() + '/' + cap + ')';
        btn.disabled = true;
      } else {
        btn.innerHTML = '酿造 ' + def.name + ' <img class="mini" src="assets/img/icons/elixir.png"> ' + def.cost;
        (function (sid) {
          btn.onclick = function () { COC.Training.brewSpell(sid); refresh(); };
        })(id);
      }
      row.appendChild(btn);
    }
  }

  /* ---------- 实验室 ---------- */
  function openLab() {
    $('lab-panel').classList.remove('hidden');
    refreshLab();
    var t = setInterval(function () {
      if ($('lab-panel').classList.contains('hidden')) { clearInterval(t); return; }
      refreshLab();
    }, 600);
  }

  function refreshLab() {
    var S = COC.State.get();
    var grid = $('lab-grid');
    grid.innerHTML = '';
    var list = COC.TroopDefs.list();
    for (var i = 0; i < list.length; i++) {
      var id = list[i];
      var def = COC.TroopDefs.get(id);
      var info = COC.Training.labInfo(id);
      var card = document.createElement('div');
      card.className = 'card';
      var body =
        '<span class="c-lv">Lv.' + info.lv + '</span>' +
        '<img class="thumb" src="' + troopImg(id) + '">' +
        '<div class="c-name">' + def.name + '</div>' +
        '<div class="c-sub">生命 ' + COC.TroopDefs.statAt(id, 'hp', info.lv) + ' · 伤害 ' + COC.TroopDefs.statAt(id, 'dps', info.lv) + '</div>';
      if (info.lv >= info.maxLv) {
        body += '<div class="c-sub" style="color:#4a7a1e;font-weight:bold">已满级</div>';
        card.classList.add('disabled');
      } else if (S.labBusy && S.labBusy.troop === id) {
        var remain = Math.max(0, (S.labBusy.start + S.labBusy.time * 1000 - U.now()) / 1000);
        body += '<div class="c-sub" style="color:#2f7cd6;font-weight:bold">研究中 ' + U.fmtTime(remain) + '</div>';
      } else {
        body += '<div class="c-cost elixir"><img src="assets/img/icons/elixir.png">' + U.fmt(info.cost) + ' · ' + U.fmtTime(info.time) + '</div>';
      }
      card.innerHTML = body;
      if (info.lv < info.maxLv && !(S.labBusy && S.labBusy.troop === id)) {
        (function (tid) {
          card.onclick = function () { COC.Training.research(tid); refreshLab(); };
        })(id);
      }
      grid.appendChild(card);
    }
  }

  return { init: init, open: open, openLab: openLab, refresh: refresh };
})();
