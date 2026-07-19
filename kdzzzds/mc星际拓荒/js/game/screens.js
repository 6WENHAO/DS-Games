"use strict";
// ============================================================
//  方块星野 BlockWilds - 界面屏幕
//  背包(E) / 飞船日志(Q) / 暂停(Esc) / 设置 / 补给箱
// ============================================================
window.G = window.G || {};

(function() {
  var U = G.U;
  var _open = null;       // 'inv' | 'log' | 'pause' | 'chest' | 'craft'
  var _screensEl = null;

  function panel(title, texKind) {
    var p = U.el('div', 'mc-panel screen-pop');
    p.style.background = 'var(--tex-' + (texKind || 'stone') + ')';
    if (title) U.el('div', 'panel-title', p, title);
    ['pc-tl', 'pc-tr', 'pc-bl', 'pc-br'].forEach(function(c) {
      var d = U.el('div', 'panel-corner ' + c, p);
      d.style.backgroundImage = 'var(--tex-corner)';
    });
    return p;
  }

  function openScreen(name, builder) {
    _screensEl.innerHTML = '';
    _screensEl.classList.remove('hidden');
    _open = name;
    builder(_screensEl);
    G.SFX.play('ui_open');
    document.exitPointerLock && document.exitPointerLock();
  }

  function closeScreen() {
    if (!_open) return;
    if (_open === 'inv' || _open === 'craft' || _open === 'chest') G.Inv.dumpCraft();
    _open = null;
    _screensEl.classList.add('hidden');
    _screensEl.innerHTML = '';
    G.Inv.hideTooltip();
    G.SFX.play('ui_close');
    if (!G.Player.state.dead) G.Main.lockPointer();
  }

  // ---------------- 背包（含2x2或3x3合成） ----------------
  function buildInventory(root, big) {
    var p = panel(big ? '工作台' : (G.Creative ? '背包 · 创造模式' : '背包'), big ? 'wood' : 'stone');
    root.appendChild(p);
    G.Inv.craftSize = big ? 3 : 2;

    // 创造模式物品目录
    if (G.Creative) {
      var catTitle = U.el('div', '', p, '物品目录（左键整组 · 右键单个 · Shift直接入包）');
      catTitle.style.cssText = 'font-size:12px;color:#3a3a3a;margin-bottom:4px;';
      var cat = U.el('div', 'cat-grid', p);
      var catalog = [];
      G.BLOCK_DEFS.forEach(function(d) {
        if (d.id > 0 && d.tiles) catalog.push(G.Inv.mkStack(d.id, 1));
      });
      G.ITEM_DEFS.forEach(function(d) { catalog.push(G.Inv.mkStack(d.key, 1)); });
      catalog.forEach(function(proto) {
        var el = U.el('div', 'slot', cat);
        G.Inv.renderSlotEl(el, proto);
        el.addEventListener('mousedown', function(e) {
          e.preventDefault(); e.stopPropagation();
          var maxN = proto.kind === 'item' && G.ITEMS[proto.key] && G.ITEMS[proto.key].tool ? 1 : 64;
          var st = { kind: proto.kind, id: proto.id, key: proto.key, count: e.button === 2 ? 1 : maxN };
          if (e.shiftKey) { G.Inv.give(st); G.SFX.play('pickup', 0.6); }
          else { G.Inv.setCursor(st); G.SFX.play('drag_pick'); }
          G.Inv.refresh();
        });
        el.addEventListener('contextmenu', function(e) { e.preventDefault(); });
        el.addEventListener('mouseenter', function() {
          window.__catPreview = proto;
          G.Inv.showTooltipFor('catalog', 0, el);
        });
        el.addEventListener('mouseleave', G.Inv.hideTooltip);
      });
      U.el('div', 'inv-row-gap', p);
    }


    // 合成区
    var cz = U.el('div', 'craft-zone', p);
    var cg = U.el('div', 'craft-grid' + (big ? ' g3' : ''), cz);
    var n = big ? 9 : 4;
    var craftEls = [];
    for (var i = 0; i < n; i++) {
      var s = U.el('div', 'slot', cg);
      G.Inv.bindSlot(s, 'craft', big ? i : [0, 1, 3, 4][i]);
      craftEls.push({ el: s, idx: big ? i : [0, 1, 3, 4][i] });
    }
    U.el('div', 'craft-arrow', cz, '➜');
    var resEl = U.el('div', 'slot', cz);
    resEl.addEventListener('mousedown', function(e) {
      e.preventDefault();
      G.Inv.craftResultClick(e.shiftKey);
    });
    resEl.addEventListener('mouseenter', function() { G.Inv.showTooltipFor('result', 0, resEl); });
    resEl.addEventListener('mouseleave', G.Inv.hideTooltip);

    // 主背包 3x9
    var mg = U.el('div', 'inv-grid', p);
    var mainEls = [];
    for (var j = 0; j < 27; j++) {
      var s2 = U.el('div', 'slot', mg);
      G.Inv.bindSlot(s2, 'main', j);
      mainEls.push(s2);
    }
    U.el('div', 'inv-row-gap', p);
    // 快捷栏 1x9
    var hg = U.el('div', 'inv-grid', p);
    var hotEls = [];
    for (var k = 0; k < 9; k++) {
      var s3 = U.el('div', 'slot', hg);
      G.Inv.bindSlot(s3, 'hot', k);
      hotEls.push(s3);
    }

    function refresh() {
      for (var i2 = 0; i2 < mainEls.length; i2++) G.Inv.renderSlotEl(mainEls[i2], G.Inv.main[i2]);
      for (var i3 = 0; i3 < hotEls.length; i3++) G.Inv.renderSlotEl(hotEls[i3], G.Inv.hotbar[i3]);
      for (var i4 = 0; i4 < craftEls.length; i4++) G.Inv.renderSlotEl(craftEls[i4].el, G.Inv.craftGrid[craftEls[i4].idx]);
      var rec = G.Inv.matchRecipe();
      window.__craftPreview = null;
      if (rec) {
        var pp = rec.out.split(':');
        var st = pp[0] === 'block' ? G.Inv.mkStack(G.BLOCK_BY_KEY[pp[1]].id, rec.n) : G.Inv.mkStack(pp[1], rec.n);
        window.__craftPreview = st;
        G.Inv.renderSlotEl(resEl, st);
      } else {
        G.Inv.renderSlotEl(resEl, null);
      }
    }
    G.Inv.setRefreshHook(refresh);
    refresh();
  }

  // ---------------- 飞船日志 ----------------
  function buildLog(root) {
    var p = panel('◈ 飞船日志 — 探索记录 ◈', 'paper');
    root.appendChild(p);
    var wrap = U.el('div', 'log-wrap', p);
    var list = U.el('div', 'log-list', wrap);
    var detail = U.el('div', 'log-detail', wrap);
    detail.style.background = 'var(--tex-paper)';

    var entries = G.Gameplay.logEntries();
    var keys = Object.keys(entries);
    if (keys.length === 0) {
      detail.innerHTML = '<h3>暂无记录</h3><div>探索太阳系，破译挪麦文字，线索会自动记录在这里。日志在时间循环中不会丢失。</div>';
    }
    var selKey = null;
    function show(k) {
      selKey = k;
      var e = entries[k];
      e.seen = true;
      var html = '<h3>' + e.title + '</h3>';
      e.clues.forEach(function(c) { html += '<div class="log-clue">' + c + '</div>'; });
      detail.innerHTML = html;
      Array.prototype.forEach.call(list.children, function(btn) {
        btn.classList.toggle('sel', btn.dataset.k === k);
        if (btn.dataset.k === k) btn.classList.remove('new');
      });
    }
    keys.forEach(function(k) {
      var e = entries[k];
      var btn = U.el('button', 'log-entry-btn' + (e.seen ? '' : ' new'), list, e.title);
      btn.dataset.k = k;
      btn.addEventListener('click', function() { G.SFX.play('ui_click'); show(k); });
    });
    if (keys.length) show(keys[keys.length - 1]);
  }

  window.__ScreensInternal = {
    panel: panel, openScreen: openScreen, closeScreen: closeScreen,
    buildInventory: buildInventory, buildLog: buildLog,
    get open() { return _open; },
    setEl: function(el) { _screensEl = el; }
  };
})();

// ============================================================
//  暂停菜单 / 设置 / 补给箱 / 公开API
// ============================================================
(function() {
  var U = G.U;
  var IN = window.__ScreensInternal;

  function buildPause(root) {
    var p = IN.panel('游戏暂停', 'stone');
    root.appendChild(p);
    var col = U.el('div', 'pause-col', p);

    var btnBack = U.el('button', 'mc-btn', col, '回到游戏');
    btnBack.addEventListener('click', function() { G.SFX.play('ui_click'); IN.closeScreen(); });

    var btnLog = U.el('button', 'mc-btn', col, '飞船日志');
    btnLog.addEventListener('click', function() {
      G.SFX.play('ui_click');
      IN.openScreen('log', IN.buildLog);
    });

    var btnMode = U.el('button', 'mc-btn', col, G.Creative ? '切换到生存模式' : '切换到创造模式');
    btnMode.addEventListener('click', function() {
      G.Creative = !G.Creative;
      G.SFX.play('craft');
      G.HUD.toast(G.Creative ? '已切换到创造模式：无限资源 · 秒破 · 无伤 · 无限燃料' : '已切换到生存模式', '#7cff7c', 3000);
      IN.closeScreen();
    });

    // 音量设置
    var sliders = [
      ['music', '音乐'], ['ambient', '环境'], ['sfx', '音效'], ['ui', '界面']
    ];
    sliders.forEach(function(cfg) {
      var row = U.el('div', 'mc-slider', col);
      U.el('label', '', row, cfg[1]);
      var input = document.createElement('input');
      input.type = 'range'; input.min = 0; input.max = 100;
      input.value = Math.round(G.Audio.getVolume(cfg[0]) * 100);
      row.appendChild(input);
      var val = U.el('div', 'val', row, input.value + '%');
      input.addEventListener('input', function() {
        G.Audio.setVolume(cfg[0], input.value / 100);
        val.textContent = input.value + '%';
      });
      input.addEventListener('change', function() { G.SFX.play('ui_click'); });
    });

    var btnReset = U.el('button', 'mc-btn', col, '自我了断（重启循环）');
    btnReset.addEventListener('click', function() {
      G.SFX.play('ui_click');
      IN.closeScreen();
      G.Gameplay.triggerLoopReset('manual');
    });

    var tip = U.el('div', '', col,
      '<div style="font-size:12px;color:#4a4a4a;line-height:1.9;margin-top:6px">' +
      'WASD 移动 · 空格 跳/喷气 · Shift 下降 · Ctrl 疾跑/飞船加力<br>' +
      'E 背包 · Q 日志 · F 交互/上下船 · R 起飞 · 1-9 快捷栏<br>' +
      '飞船内：鼠标转向 · QE 滚转 · WASD+空格/Shift 平移推进</div>');
    tip.style.pointerEvents = 'none';
  }

  // 补给箱（简化：直接给予奖励物品）
  function buildChest(root, lootGiven) {
    var p = IN.panel('补给箱', 'wood');
    root.appendChild(p);
    var msg = U.el('div', '', p, lootGiven.length ?
      '你找到了：' : '箱子已经空了。');
    msg.style.cssText = 'font-size:15px;color:#3a2a12;margin-bottom:8px;';
    lootGiven.forEach(function(s) {
      var row = U.el('div', '', p);
      row.style.cssText = 'display:flex;align-items:center;gap:8px;margin:4px 0;font-size:14px;color:#2a1c08;';
      var img = document.createElement('img');
      img.src = G.Inv.stackIconURL(s);
      img.style.cssText = 'width:28px;height:28px;';
      row.appendChild(img);
      U.el('span', '', row, G.Inv.stackName(s) + ' × ' + s.count);
    });
    var btn = U.el('button', 'mc-btn', p, '收下');
    btn.style.marginTop = '10px';
    btn.addEventListener('click', function() { G.SFX.play('ui_click'); IN.closeScreen(); });
  }

  G.Screens = {
    init: function() {
      IN.setEl(U.$('screens'));
      // 快捷键
      document.addEventListener('keydown', function(e) {
        if (!G.Main || !G.Main.started()) return;
        if (e.code === 'KeyE') {
          if (IN.open === 'inv') IN.closeScreen();
          else if (!IN.open) IN.openScreen('inv', function(r) { IN.buildInventory(r, false); });
        } else if (e.code === 'KeyQ') {
          if (IN.open === 'log') IN.closeScreen();
          else if (!IN.open) IN.openScreen('log', IN.buildLog);
        } else if (e.code === 'Escape') {
          if (IN.open) IN.closeScreen();
          else IN.openScreen('pause', buildPause);
        }
      });
    },
    isOpen: function() { return !!IN.open; },
    close: closeAll,
    openCraft: function() {
      IN.openScreen('craft', function(r) { IN.buildInventory(r, true); });
    },
    openChest: function(loot) {
      IN.openScreen('chest', function(r) { buildChest(r, loot); });
    },
    openLog: function() { IN.openScreen('log', IN.buildLog); },
    openPause: function() { IN.openScreen('pause', buildPause); }
  };

  function closeAll() { IN.closeScreen(); }
})();
