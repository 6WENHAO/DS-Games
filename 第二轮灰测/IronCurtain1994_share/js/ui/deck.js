/* 铁幕1994 — 卡组编辑器（战争游戏：红龙 式：槽位 / 分值 / 老兵度 / 改装挂载 / 运输载具） */
(function () {
  'use strict';
  var IC = window.IC;
  var U = IC.Util, R = IC.Rules, UI = IC.UI;
  var D = IC.Deck = {};

  var st = {
    side: 'NATO', mode: 'advanced94', deck: null, tab: 'units',
    filterCat: 'ALL', filterEra: 'ALL', filterCountry: 'ALL',
    selPool: null, selDeckIdx: -1, slots: 20, onSave: null, onBack: null, extraOps: []
  };

  D.blankDeck = function () { return { cards: [], support: [], ops: [] }; };

  D.open = function (opts) {
    st.side = opts.side;
    st.mode = opts.mode;
    st.deck = opts.deck || D.blankDeck();
    st.slots = opts.slots || IC.DeckRules.maxSlots;
    st.extraOps = opts.extraOps || [];
    st.onSave = opts.onSave; st.onBack = opts.onBack;
    st.selPool = null; st.selDeckIdx = -1; st.tab = 'units';
    st.filterCat = 'ALL'; st.filterEra = 'ALL'; st.filterCountry = 'ALL';
    UI.show('screen-deck');
    U.byId('d-side-name').textContent = UI.sideFull(st.side);
    U.byId('d-mode-name').textContent = R.MODES[st.mode].name;
    bindOnce();
    renderFilters(); renderPool(); renderDeck(); renderDetail();
  };

  var bound = false;
  function bindOnce() {
    if (bound) return; bound = true;
    U.byId('d-back').onclick = function () { if (st.onBack) st.onBack(); };
    U.byId('d-save').onclick = function () {
      if (st.onSave) st.onSave(st.deck);
      UI.toast('卡组已保存（' + st.deck.cards.length + ' 张部队卡 / ' + st.deck.support.length + ' 项支援 / ' + st.deck.ops.length + ' 条指令）');
    };
    U.byId('d-clear').onclick = function () {
      st.deck.cards = []; st.deck.support = []; st.deck.ops = [];
      st.selDeckIdx = -1; renderDeck(); renderDetail(); renderPool();
    };
    U.byId('d-auto').onclick = function () {
      var d = IC.AI.buildDeck(st.side, st.mode, null, new IC.RNG(Date.now() & 0xffff), { slots: st.slots });
      st.deck.cards = d.cards; st.deck.support = d.support; st.deck.ops = d.ops;
      st.selDeckIdx = -1; renderDeck(); renderDetail(); renderPool();
      UI.toast('已按均衡编成自动配卡，可继续手动微调。');
    };
    var tabs = U.byId('d-tabs').children;
    for (var i = 0; i < tabs.length; i++) {
      (function (tab) {
        tab.onclick = function () {
          st.tab = tab.getAttribute('data-t');
          for (var j = 0; j < tabs.length; j++) tabs[j].classList.remove('on');
          tab.classList.add('on');
          renderDeck();
        };
      })(tabs[i]);
    }
  }

  function pool() {
    var all = st.side === 'WP' ? (window.DATA_UNITS_WP || []) : (window.DATA_UNITS_NATO || []);
    var eras = R.MODES[st.mode].era;
    return all.filter(function (c) {
      if (c.category === 'TR') return false;
      if (eras.indexOf(c.era) < 0) return false;
      if (st.filterCat !== 'ALL' && c.category !== st.filterCat) return false;
      if (st.filterEra !== 'ALL' && c.era !== +st.filterEra) return false;
      if (st.filterCountry !== 'ALL' && c.country !== st.filterCountry) return false;
      return true;
    }).sort(function (a, b) {
      var oa = (R.CATEGORY[a.category] || {}).order || 9, ob = (R.CATEGORY[b.category] || {}).order || 9;
      return oa - ob || a.cost - b.cost;
    });
  }

  function renderFilters() {
    var host = U.clear(U.byId('d-filters'));
    var all = st.side === 'WP' ? (window.DATA_UNITS_WP || []) : (window.DATA_UNITS_NATO || []);
    var cats = ['ALL'], countries = ['ALL'];
    all.forEach(function (c) {
      if (c.category === 'TR') return;
      if (cats.indexOf(c.category) < 0) cats.push(c.category);
      if (countries.indexOf(c.country) < 0) countries.push(c.country);
    });
    cats.forEach(function (c) {
      var chip = U.el('span', 'chip' + (st.filterCat === c ? ' on' : ''), c === 'ALL' ? '全部兵种' : UI.catName(c));
      chip.onclick = function () { st.filterCat = c; renderFilters(); renderPool(); };
      host.appendChild(chip);
    });
    host.appendChild(U.el('span', '', '&nbsp;|&nbsp;'));
    ['ALL'].concat(R.MODES[st.mode].era).forEach(function (e) {
      var chip = U.el('span', 'chip' + (String(st.filterEra) === String(e) ? ' on' : ''), e === 'ALL' ? '全年代' : (e + ' 年'));
      chip.onclick = function () { st.filterEra = e; renderFilters(); renderPool(); };
      host.appendChild(chip);
    });
    host.appendChild(U.el('span', '', '&nbsp;|&nbsp;'));
    countries.forEach(function (c) {
      var chip = U.el('span', 'chip' + (st.filterCountry === c ? ' on' : ''), c === 'ALL' ? '全部国别' : UI.country(c));
      chip.onclick = function () { st.filterCountry = c; renderFilters(); renderPool(); };
      host.appendChild(chip);
    });
  }

  function renderPool() {
    var host = U.clear(U.byId('d-pool'));
    var list = pool();
    if (!list.length) host.appendChild(U.el('div', 'dim', '没有符合条件的装备。'));
    list.forEach(function (c) {
      var el = U.el('div', 'ucard ' + (st.side === 'NATO' ? 'nato' : 'wp') + (st.selPool === c.id ? ' sel' : ''));
      var top = U.el('div', 'uc-top');
      var ico = U.el('span', 'uc-ico');
      ico.appendChild(UI.symbol(c, st.side, 34, 26));
      var txt = U.el('div');
      txt.appendChild(U.el('div', 'uc-n', U.esc(c.short || c.name)));
      txt.appendChild(U.el('div', 'uc-r', U.esc(c.role || '') + ' · ' + UI.country(c.country) +
        (c.era === 1994 ? ' <span class="tag era94">94</span>' : '')));
      top.appendChild(ico); top.appendChild(txt);
      el.appendChild(top);
      var s = c.stats || {};
      el.appendChild(U.el('div', 'uc-stats',
        '<span>甲' + (s.armorF || 0) + '</span><span>机' + (s.move || 0) + '</span><span>观' + (s.optics || 0) + '</span>' +
        '<span>编' + (c.strength || 0) + '</span><span>×' + (c.avail || 1) + '</span>'));
      el.appendChild(U.el('div', 'uc-c', c.cost + ''));
      UI.bindTip(el, function () { return UI.cardTip(c); });
      el.onclick = function () {
        st.selPool = c.id; st.selDeckIdx = -1;
        renderPool(); renderDetail();
      };
      el.ondblclick = function () { addCard(c.id); };
      host.appendChild(el);
    });
  }

  function usedSlots() { return st.deck.cards.length; }

  function addCard(cardId, mods, vet, transport) {
    if (usedSlots() >= st.slots) { UI.toast('卡组槽位已满（' + st.slots + '），先移除一些卡片。', 'bad'); return; }
    var same = st.deck.cards.filter(function (c) { return c.cardId === cardId; }).length;
    if (same >= 3) { UI.toast('同一装备最多放入 3 张卡。', 'bad'); return; }
    st.deck.cards.push({ cardId: cardId, mods: (mods || []).slice(), vet: vet || null, transport: transport });
    st.selDeckIdx = st.deck.cards.length - 1;
    renderDeck(); renderDetail();
  }

  function renderDeck() {
    var host = U.clear(U.byId('d-deck'));
    var pts = 0;
    st.deck.cards.forEach(function (e) {
      var raw = IC.Battle.findCard(e.cardId);
      if (raw) pts += R.buildCard(raw, e.mods, e.vet).cost;
    });
    U.byId('d-slots').textContent = usedSlots() + '/' + st.slots + ' 槽位 · 均价 ' +
      (st.deck.cards.length ? Math.round(pts / st.deck.cards.length) : 0) + ' 分';

    if (st.tab === 'units') {
      if (!st.deck.cards.length) host.appendChild(U.el('div', 'dim', '卡组为空。双击左侧装备加入，或点「自动配卡」。'));
      var byCat = {};
      st.deck.cards.forEach(function (e, i) {
        var raw = IC.Battle.findCard(e.cardId);
        if (!raw) return;
        (byCat[raw.category] = byCat[raw.category] || []).push({ e: e, i: i, raw: raw });
      });
      Object.keys(byCat).sort(function (a, b) {
        return ((R.CATEGORY[a] || {}).order || 9) - ((R.CATEGORY[b] || {}).order || 9);
      }).forEach(function (cat) {
        host.appendChild(U.el('div', 'dim', '<b style="color:var(--gold)">' + UI.catName(cat) + '</b>'));
        byCat[cat].forEach(function (item) {
          var built = R.buildCard(item.raw, item.e.mods, item.e.vet);
          var row = U.el('div', 'deck-slot' + (st.selDeckIdx === item.i ? ' sel' : ''));
          row.appendChild(UI.symbol(item.raw, st.side, 26, 20));
          var nm = U.el('span', '', U.esc(built.short || built.name) +
            (item.e.mods && item.e.mods.length ? ' <span class="tag gold">+' + item.e.mods.length + '</span>' : '') +
            ' <span class="dim">' + UI.vetName(built.vet) + '×' + built.avail + '</span>');
          nm.style.flex = '1';
          row.appendChild(nm);
          row.appendChild(U.el('span', '', '<span style="color:var(--gold)">' + built.cost + '</span>'));
          var x = U.el('span', 'ds-x', '✕');
          x.onclick = function (ev) {
            ev.stopPropagation();
            st.deck.cards.splice(item.i, 1);
            st.selDeckIdx = -1; renderDeck(); renderDetail();
          };
          row.appendChild(x);
          row.onclick = function () { st.selDeckIdx = item.i; st.selPool = null; renderDeck(); renderDetail(); };
          UI.bindTip(row, function () { return UI.cardTip(built); });
          host.appendChild(row);
        });
      });
    } else if (st.tab === 'support') {
      host.appendChild(U.el('div', 'dim', '最多选择 ' + IC.DeckRules.maxSupport + ' 项场外支援。核 / 化学打击需要在战斗中通过「作战决心」取得战区授权（无尽模式无需授权）。'));
      (window.DATA_SUPPORT || []).filter(function (s) {
        return (s.side === 'ANY' || s.side === st.side) && R.MODES[st.mode].era.indexOf(s.era) >= 0;
      }).forEach(function (s) {
        var on = st.deck.support.indexOf(s.id) >= 0;
        var row = U.el('div', 'mod-row' + (on ? ' on' : ''));
        row.innerHTML = '<div style="flex:1"><div style="color:var(--parch)">' + U.esc(s.name) +
          (s.restricted ? ' <span class="tag bad">需授权</span>' : '') + '</div>' +
          '<div class="dim">半径 ' + s.radius + ' 格 · ' + (s.delay ? '延迟 ' + s.delay + ' 回合' : '立即弹着') +
          (s.he ? ' · 杀伤 ' + s.he : '') + (s.pen ? ' · 穿深 ' + s.pen : '') + '</div>' +
          '<div class="dim" style="font-style:italic">' + U.esc(s.desc) + '</div></div>' +
          '<div class="mr-c">' + s.cost + '</div>';
        row.onclick = function () {
          var i = st.deck.support.indexOf(s.id);
          if (i >= 0) st.deck.support.splice(i, 1);
          else {
            if (st.deck.support.length >= IC.DeckRules.maxSupport) { UI.toast('支援栏位已满。', 'bad'); return; }
            st.deck.support.push(s.id);
          }
          renderDeck();
        };
        host.appendChild(row);
      });
    } else {
      host.appendChild(U.el('div', 'dim', '最多选择 ' + IC.DeckRules.maxOps + ' 条超限战指令。「下达作战决心」始终可用。' +
        (st.extraOps.length ? '战略层已额外解锁：' + st.extraOps.map(function (id) {
          var o = window.DATA_HYBRID.battleOps.filter(function (x) { return x.id === id; })[0];
          return o ? o.name : id;
        }).join('、') : '')));
      (window.DATA_HYBRID.battleOps || []).forEach(function (o) {
        if (o.effect === 'resolve') return;
        var free = st.extraOps.indexOf(o.id) >= 0;
        var on = st.deck.ops.indexOf(o.id) >= 0 || free;
        var dom = window.DATA_HYBRID.domains[o.domain] || {};
        var row = U.el('div', 'mod-row' + (on ? ' on' : ''));
        row.innerHTML = '<div style="flex:1"><div style="color:var(--parch)">' + (dom.icon || '') + ' ' + U.esc(o.name) +
          (free ? ' <span class="tag good">战略层已解锁</span>' : '') + '</div>' +
          '<div class="dim">' + (dom.name || '') + ' · 分值 ' + o.cost + ' · 指挥点 ' + (o.cp || 1) +
          (o.radius ? ' · 半径 ' + o.radius : '') + (o.duration ? ' · 持续 ' + o.duration + ' 回合' : '') + '</div>' +
          '<div class="dim" style="font-style:italic">' + U.esc(o.desc) + '</div></div>';
        row.onclick = function () {
          if (free) { UI.toast('该指令由战略层提供，无需占用卡组栏位。'); return; }
          var i = st.deck.ops.indexOf(o.id);
          if (i >= 0) st.deck.ops.splice(i, 1);
          else {
            if (st.deck.ops.length >= IC.DeckRules.maxOps) { UI.toast('指令栏位已满。', 'bad'); return; }
            st.deck.ops.push(o.id);
          }
          renderDeck();
        };
        host.appendChild(row);
      });
    }
  }

  function renderDetail() {
    var host = U.clear(U.byId('d-detail'));
    var entry = null, raw = null, inDeck = false;
    if (st.selDeckIdx >= 0 && st.deck.cards[st.selDeckIdx]) {
      entry = st.deck.cards[st.selDeckIdx];
      raw = IC.Battle.findCard(entry.cardId);
      inDeck = true;
    } else if (st.selPool) {
      raw = IC.Battle.findCard(st.selPool);
      entry = { cardId: st.selPool, mods: [], vet: null, transport: raw ? raw.transport : null };
    }
    if (!raw) { host.appendChild(U.el('div', 'dim', '从左侧选择一件装备查看详情、改装与挂载。')); return; }
    var built = R.buildCard(raw, entry.mods, entry.vet);

    var head = U.el('div');
    head.innerHTML = '<div style="display:flex;gap:8px;align-items:flex-start">' +
      '<div style="flex:1"><div style="font-family:var(--serif);font-size:16px;color:var(--parch)">' + U.esc(built.name) + '</div>' +
      '<div class="dim" style="font-size:11.5px">' + UI.country(raw.country) + ' · ' + UI.catName(raw.category) + ' · ' + U.esc(raw.role || '') +
      ' · <span class="tag ' + (raw.era === 1994 ? 'era94' : '') + '">' + raw.era + '</span></div></div>' +
      '<div style="text-align:right"><div style="font-size:22px;color:var(--gold);font-family:var(--serif)">' + built.cost + '</div>' +
      '<div class="dim" style="font-size:10px">召唤分值</div></div></div>';
    host.appendChild(head);
    host.appendChild(U.el('div', 'hr'));

    var s = built.stats || {};
    host.appendChild(U.el('div', '', '' +
      row2('装甲 正/侧/顶', (s.armorF || 0) + ' / ' + (s.armorS || 0) + ' / ' + (s.armorT || 0)) +
      row2('机动 / 观测 / 隐蔽', (s.move || 0) + ' / ' + (s.optics || 0) + ' / ' + (s.stealth || 0)) +
      row2('编制 / 可用数量', (built.strength || 0) + ' / ' + built.avail) +
      row2('士气 / 电子对抗', (s.morale || 0) + ' / ' + (s.ecm || 0))));
    host.appendChild(U.el('div', 'hr'));

    host.appendChild(U.el('h4', '', '武器'));
    (built.weapons || []).forEach(function (w) {
      host.appendChild(U.el('div', 'weap-row', UI.weaponHtml(w, w.ammo)));
    });

    /* 老兵度 */
    host.appendChild(U.el('h4', '', '老兵度'));
    var vr = U.el('div', 'vet-row');
    window.DATA_VET_ORDER.forEach(function (v) {
      var chip = U.el('span', 'chip' + ((entry.vet || raw.vet || 'trained') === v ? ' on' : ''), UI.vetName(v));
      chip.onclick = function () { entry.vet = v; if (inDeck) renderDeck(); renderDetail(); };
      UI.bindTip(chip, function () {
        var d = window.DATA_VET[v];
        return '<h4>' + d.name + '</h4><div class="tp-r"><span>命中</span><b>' + (d.acc >= 0 ? '+' : '') + Math.round(d.acc * 100) + '%</b></div>' +
          '<div class="tp-r"><span>凝聚力</span><b>' + (d.cohesion >= 0 ? '+' : '') + d.cohesion + '</b></div>' +
          '<div class="tp-r"><span>单价</span><b>×' + d.costMult + '</b></div>' +
          '<div class="tp-r"><span>可用数量</span><b>×' + d.availMult + '</b></div>';
      });
      vr.appendChild(chip);
    });
    host.appendChild(vr);

    /* 改装挂载 */
    var mods = (raw.mods || []).filter(function (id) {
      var m = window.DATA_MODS[id];
      return m && (!m.era || R.MODES[st.mode].era.indexOf(m.era) >= 0);
    });
    if (mods.length) {
      host.appendChild(U.el('h4', '', '改装 / 挂载'));
      mods.forEach(function (id) {
        var m = window.DATA_MODS[id];
        var on = entry.mods.indexOf(id) >= 0;
        var row = U.el('div', 'mod-row' + (on ? ' on' : ''));
        row.innerHTML = '<div style="flex:1"><div style="color:var(--parch)">' + U.esc(m.name) +
          (m.era === 1994 ? ' <span class="tag era94">94</span>' : '') + '</div>' +
          '<div class="dim">' + U.esc(m.tag || '') + '：' + U.esc(m.desc || '') + '</div></div>' +
          '<div class="mr-c">' + (m.cost >= 0 ? '+' : '') + m.cost + '</div>';
        row.onclick = function () {
          var i = entry.mods.indexOf(id);
          if (i >= 0) entry.mods.splice(i, 1); else entry.mods.push(id);
          if (inDeck) renderDeck();
          renderDetail();
        };
        host.appendChild(row);
      });
    }

    /* 运输载具 */
    if (raw.category === 'INF') {
      host.appendChild(U.el('h4', '', '运输载具'));
      var trs = (st.side === 'WP' ? (window.DATA_UNITS_WP || []) : (window.DATA_UNITS_NATO || []))
        .filter(function (c) { return c.category === 'TR' && R.MODES[st.mode].era.indexOf(c.era) >= 0; });
      var cur = entry.transport === undefined ? raw.transport : entry.transport;
      var wrap = U.el('div', 'vet-row');
      wrap.style.flexWrap = 'wrap';
      var footChip = U.el('span', 'chip' + (!cur ? ' on' : ''), '徒步');
      footChip.onclick = function () { entry.transport = null; if (inDeck) renderDeck(); renderDetail(); };
      wrap.appendChild(footChip);
      trs.forEach(function (t) {
        var chip = U.el('span', 'chip' + (cur === t.id ? ' on' : ''), U.esc(t.short || t.name));
        chip.onclick = function () { entry.transport = t.id; if (inDeck) renderDeck(); renderDetail(); };
        UI.bindTip(chip, function () { return UI.cardTip(t); });
        wrap.appendChild(chip);
      });
      host.appendChild(wrap);
      host.appendChild(U.el('div', 'dim', '乘车时使用载具的机动力与装甲，可在战场上下车展开。'));
    }

    if (built.desc) {
      host.appendChild(U.el('div', 'hr'));
      host.appendChild(U.el('div', '', '<div style="font-family:var(--serif);font-style:italic;color:#b6bfc9">' + U.esc(built.desc) + '</div>'));
    }

    host.appendChild(U.el('div', 'hr'));
    if (inDeck) {
      var rm = U.el('button', 'btn block danger sm', '从卡组移除');
      rm.onclick = function () {
        st.deck.cards.splice(st.selDeckIdx, 1);
        st.selDeckIdx = -1; renderDeck(); renderDetail();
      };
      host.appendChild(rm);
      var dup = U.el('button', 'btn block sm', '复制一份到卡组');
      dup.style.marginTop = '5px';
      dup.onclick = function () { addCard(entry.cardId, entry.mods, entry.vet, entry.transport); };
      host.appendChild(dup);
    } else {
      var add = U.el('button', 'btn block primary sm', '加入卡组（占 1 槽位）');
      add.onclick = function () { addCard(entry.cardId, entry.mods, entry.vet, entry.transport); };
      host.appendChild(add);
    }
  }

  function row2(k, v) {
    return '<div class="kv"><span class="dim">' + k + '</span><b>' + v + '</b></div>';
  }
})();
