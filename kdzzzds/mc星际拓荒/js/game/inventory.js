"use strict";
// ============================================================
//  方块星野 BlockWilds - 物品栏系统
//  9格快捷栏 + 27格背包 + 合成 | 拖拽/分堆/Shift速移/右键取半
// ============================================================
window.G = window.G || {};

(function() {
  var U = G.U;

  // ---------------- 物品堆 ----------------
  // {kind:'block'|'item', id:方块id 或 key:物品key, count}
  function mkStack(ref, count) {
    if (typeof ref === 'number') return { kind: 'block', id: ref, count: count || 1 };
    return { kind: 'item', key: ref, count: count || 1 };
  }
  function stackMax(s) {
    if (!s) return 64;
    if (s.kind === 'block') return 64;
    var d = G.ITEMS[s.key];
    if (d && d.tool) return 1;
    return (d && d.stack) || 64;
  }
  function sameStack(a, b) {
    if (!a || !b || a.kind !== b.kind) return false;
    return a.kind === 'block' ? a.id === b.id : a.key === b.key;
  }
  function stackName(s) {
    if (!s) return '';
    if (s.kind === 'block') { var d = G.BLOCKS[s.id]; return d ? d.name : '?'; }
    var it = G.ITEMS[s.key];
    return it ? it.name : s.key;
  }
  function stackIconURL(s) {
    if (!s) return '';
    if (s.kind === 'block') return G.Icons.blockURL(s.id);
    return G.Icons.itemURL(s.key);
  }
  function stackRarity(s) {
    if (!s) return 0;
    if (s.kind === 'item') { var it = G.ITEMS[s.key]; return it ? (it.rar || 0) : 0; }
    var d = G.BLOCKS[s.id];
    var m = { nomai_brick: 2, nomai_carved: 2, nomai_metal: 2, nomai_lamp: 2, gravity_crystal: 2, quantum_stone: 3, ghost_matter: 3 };
    return m[d && d.key] || 0;
  }
  function stackDesc(s) {
    if (!s) return '';
    if (s.kind === 'item') { var it = G.ITEMS[s.key]; return it ? (it.desc || '') : ''; }
    var d = G.BLOCKS[s.id];
    var extra = {
      gravity_crystal: '挪麦重力科技|放置后产生局部升力场',
      nomai_text: '古老的挪麦文字|用翻译机破译',
      quantum_stone: '不被观测时会移动|量子化的石头',
      ghost_matter: '触之即伤的幽灵物质|用侦察兵探明',
      campfire: '温暖的营火|可以烤棉花糖',
      torch: '火把|照亮黑暗'
    };
    return extra[d && d.key] || '';
  }

  // ---------------- 数据 ----------------
  var hotbar = new Array(9).fill(null);
  var main = new Array(27).fill(null);
  var craft = new Array(9).fill(null);   // 最多3x3
  var craftSize = 2;
  var cursor = null;                     // 拖拽中的堆
  var sel = 0;

  // ---------------- 合成配方（无序匹配） ----------------
  function R(ins, out, outCount) { return { ins: ins, out: out, n: outCount || 1 }; }
  var RECIPES = [
    R({ 'block:log': 1 }, 'block:planks', 4),
    R({ 'block:planks': 2 }, 'item:stick', 4),
    R({ 'item:stick': 1, 'item:coal': 1 }, 'block:torch', 4),
    R({ 'block:planks': 4 }, 'block:crafting', 1),
    R({ 'block:log': 3, 'item:coal': 1 }, 'block:campfire', 1),
    R({ 'block:sand': 2, 'item:coal': 1 }, 'block:glass', 2),
    R({ 'block:iron_ore': 1, 'item:coal': 1 }, 'item:iron_ingot', 1),
    R({ 'block:copper_ore': 1, 'item:coal': 1 }, 'item:copper_ingot', 1),
    R({ 'item:iron_ingot': 2, 'item:stick': 1 }, 'item:repair_kit', 1),
    R({ 'item:iron_ingot': 3, 'block:glass': 1 }, 'item:oxygen_tank', 1),
    R({ 'item:iron_ingot': 2, 'item:coal': 2 }, 'item:fuel_tank', 1),
    R({ 'block:glass': 1, 'block:torch': 1, 'item:iron_ingot': 1 }, 'item:lantern', 1),
    R({ 'block:glass': 2, 'block:torch': 1 }, 'block:lamp', 1),
    R({ 'block:planks': 2, 'block:glass': 1, 'item:copper_ingot': 2 }, 'item:marshmallow', 6)
  ];

  function refOf(s) { return s ? (s.kind === 'block' ? 'block:' + G.BLOCKS[s.id].key : 'item:' + s.key) : null; }
  function parseRef(r) {
    var pp = r.split(':');
    if (pp[0] === 'block') return mkStack(G.BLOCK_BY_KEY[pp[1]].id, 1);
    return mkStack(pp[1], 1);
  }

  function matchRecipe() {
    var have = {};
    for (var i = 0; i < craft.length; i++) {
      var s = craft[i];
      if (!s) continue;
      var r = refOf(s);
      have[r] = (have[r] || 0) + s.count;
    }
    var keys = Object.keys(have);
    if (keys.length === 0) return null;
    outer:
    for (var j = 0; j < RECIPES.length; j++) {
      var rec = RECIPES[j];
      var need = Object.keys(rec.ins);
      if (need.length !== keys.length) continue;
      for (var k = 0; k < need.length; k++) {
        if (!have[need[k]] || have[need[k]] < rec.ins[need[k]]) continue outer;
      }
      return rec;
    }
    return null;
  }

  function consumeRecipe(rec) {
    var need = {};
    for (var k in rec.ins) need[k] = rec.ins[k];
    for (var i = 0; i < craft.length; i++) {
      var s = craft[i];
      if (!s) continue;
      var r = refOf(s);
      if (need[r] > 0) {
        var take = Math.min(need[r], s.count);
        s.count -= take; need[r] -= take;
        if (s.count <= 0) craft[i] = null;
      }
    }
  }

  window.__InvInternal = {
    mkStack: mkStack, stackMax: stackMax, sameStack: sameStack,
    stackName: stackName, stackIconURL: stackIconURL, stackRarity: stackRarity, stackDesc: stackDesc,
    data: {
      hotbar: hotbar, main: main, craft: craft,
      get craftSize() { return craftSize; }, set craftSize(v) { craftSize = v; },
      get cursor() { return cursor; }, set cursor(v) { cursor = v; },
      get sel() { return sel; }, set sel(v) { sel = v; }
    },
    matchRecipe: matchRecipe, consumeRecipe: consumeRecipe, parseRef: parseRef
  };
})();

// ============================================================
//  物品栏 UI：拖拽 / 分堆 / Shift速移 / 右键取半 / Tooltip
// ============================================================
(function() {
  var U = G.U;
  var IN = window.__InvInternal;
  var D = IN.data;
  var _tooltip = null, _ghost = null;
  var _uiRefresh = null;

  function slotArr(zone) {
    if (zone === 'hot') return D.hotbar;
    if (zone === 'main') return D.main;
    if (zone === 'craft') return D.craft;
    return null;
  }

  // 快速移动：hot<->main，craft->main
  function shiftMove(zone, i) {
    var arr = slotArr(zone);
    var s = arr[i];
    if (!s) return;
    var targets = zone === 'hot' ? [D.main] : [D.hotbar, D.main];
    for (var t = 0; t < targets.length; t++) {
      var tg = targets[t];
      // 先叠加
      for (var j = 0; j < tg.length; j++) {
        if (IN.sameStack(tg[j], s)) {
          var can = IN.stackMax(s) - tg[j].count;
          var mv = Math.min(can, s.count);
          tg[j].count += mv; s.count -= mv;
          if (s.count <= 0) { arr[i] = null; return; }
        }
      }
      for (var j2 = 0; j2 < tg.length; j2++) {
        if (!tg[j2]) { tg[j2] = s; arr[i] = null; return; }
      }
    }
  }

  function clickSlot(zone, i, btn, shiftKey) {
    var arr = slotArr(zone);
    if (!arr) return;
    if (shiftKey) { shiftMove(zone, i); G.SFX.play('drag_pick'); refresh(); return; }
    var s = arr[i];
    if (btn === 0) { // 左键：整堆 拾/放/交换/合并
      if (!D.cursor) {
        if (s) { D.cursor = s; arr[i] = null; G.SFX.play('drag_pick'); }
      } else {
        if (!s) { arr[i] = D.cursor; D.cursor = null; G.SFX.play('drag_put'); }
        else if (IN.sameStack(s, D.cursor)) {
          var can = IN.stackMax(s) - s.count;
          var mv = Math.min(can, D.cursor.count);
          s.count += mv; D.cursor.count -= mv;
          if (D.cursor.count <= 0) D.cursor = null;
          G.SFX.play('drag_put');
        } else {
          arr[i] = D.cursor; D.cursor = s; G.SFX.play('drag_pick');
        }
      }
    } else if (btn === 2) { // 右键：取半 / 放一个
      if (!D.cursor) {
        if (s) {
          var half = Math.ceil(s.count / 2);
          D.cursor = { kind: s.kind, id: s.id, key: s.key, count: half };
          s.count -= half;
          if (s.count <= 0) arr[i] = null;
          G.SFX.play('drag_pick');
        }
      } else {
        if (!s) {
          arr[i] = { kind: D.cursor.kind, id: D.cursor.id, key: D.cursor.key, count: 1 };
          D.cursor.count--;
          if (D.cursor.count <= 0) D.cursor = null;
          G.SFX.play('drag_put');
        } else if (IN.sameStack(s, D.cursor) && s.count < IN.stackMax(s)) {
          s.count++; D.cursor.count--;
          if (D.cursor.count <= 0) D.cursor = null;
          G.SFX.play('drag_put');
        }
      }
    }
    refresh();
  }

  function craftResultClick(shiftKey) {
    var rec = IN.matchRecipe();
    if (!rec) return;
    var out = IN.parseRef(rec.out);
    out.count = rec.n;
    var loops = shiftKey ? 16 : 1;
    for (var l = 0; l < loops; l++) {
      rec = IN.matchRecipe();
      if (!rec) break;
      var o2 = IN.parseRef(rec.out); o2.count = rec.n;
      if (!G.Inv.give(o2, true)) break;
      IN.consumeRecipe(rec);
    }
    G.SFX.play('craft');
    refresh();
  }

  // ---------------- DOM ----------------
  function renderSlotEl(el, s, selFlag) {
    el.innerHTML = '';
    if (selFlag) el.classList.add('sel'); else el.classList.remove('sel');
    if (!s) return;
    var img = document.createElement('img');
    img.src = IN.stackIconURL(s);
    img.draggable = false;
    el.appendChild(img);
    if (s.count > 1) {
      var c = document.createElement('div');
      c.className = 'cnt';
      c.textContent = s.count;
      el.appendChild(c);
    }
  }

  function bindSlot(el, zone, idx) {
    el.addEventListener('mousedown', function(e) {
      e.preventDefault(); e.stopPropagation();
      clickSlot(zone, idx, e.button, e.shiftKey);
    });
    el.addEventListener('contextmenu', function(e) { e.preventDefault(); });
    el.addEventListener('mouseenter', function() { showTooltip(zone, idx, el); });
    el.addEventListener('mouseleave', hideTooltip);
  }

  function showTooltip(zone, idx, el) {
    var s = slotArr(zone) ? slotArr(zone)[idx] : null;
    if (zone === 'result') s = window.__craftPreview || null;
    if (zone === 'catalog') s = window.__catPreview || null;
    if (!s || D.cursor) { hideTooltip(); return; }
    var tt = U.$('tooltip');
    var rar = IN.stackRarity(s);
    var desc = IN.stackDesc(s);
    var html = '<div class="tt-name rar' + rar + '">' + IN.stackName(s) + '</div>';
    if (desc) {
      desc.split('|').forEach(function(line) {
        html += '<div class="tt-desc">' + line + '</div>';
      });
    }
    tt.innerHTML = html;
    tt.classList.remove('hidden');
    var r = el.getBoundingClientRect();
    tt.style.left = Math.min(window.innerWidth - 280, r.right + 8) + 'px';
    tt.style.top = Math.max(6, r.top - 10) + 'px';
  }
  function hideTooltip() { U.$('tooltip').classList.add('hidden'); }

  function refresh() {
    if (_uiRefresh) _uiRefresh();
    // 拖拽幽灵
    var gEl = U.$('drag-ghost');
    if (D.cursor) {
      gEl.classList.remove('hidden');
      gEl.innerHTML = '<img src="' + IN.stackIconURL(D.cursor) + '">' +
        (D.cursor.count > 1 ? '<div class="cnt">' + D.cursor.count + '</div>' : '');
    } else {
      gEl.classList.add('hidden');
    }
    if (G.HUD) G.HUD.refreshHotbar();
  }

  document.addEventListener('mousemove', function(e) {
    var gEl = U.$('drag-ghost');
    if (!gEl.classList.contains('hidden')) {
      gEl.style.left = e.clientX + 'px';
      gEl.style.top = e.clientY + 'px';
    }
  });

  // ---------------- 公开 API ----------------
  G.Inv = {
    mkStack: IN.mkStack,
    stackName: IN.stackName,
    stackIconURL: IN.stackIconURL,
    get hotbar() { return D.hotbar; },
    get main() { return D.main; },
    get sel() { return D.sel; },
    set sel(v) { D.sel = v; },
    get selStack() { return D.hotbar[D.sel]; },
    get cursor() { return D.cursor; },
    setCursor: function(st) { D.cursor = st; },

    // 给予物品；simulate=true 时失败返回false不实际放入
    give: function(stack, must) {
      var zones = [D.hotbar, D.main];
      for (var z = 0; z < 2; z++) {
        var arr = zones[z];
        for (var i = 0; i < arr.length; i++) {
          if (IN.sameStack(arr[i], stack)) {
            var can = IN.stackMax(stack) - arr[i].count;
            var mv = Math.min(can, stack.count);
            arr[i].count += mv; stack.count -= mv;
            if (stack.count <= 0) { refresh(); return true; }
          }
        }
      }
      for (var z2 = 0; z2 < 2; z2++) {
        var arr2 = zones[z2];
        for (var j = 0; j < arr2.length; j++) {
          if (!arr2[j]) { arr2[j] = stack; refresh(); return true; }
        }
      }
      refresh();
      return false;
    },

    // 消耗当前手持1个
    consumeSel: function() {
      var s = D.hotbar[D.sel];
      if (!s) return;
      s.count--;
      if (s.count <= 0) D.hotbar[D.sel] = null;
      refresh();
    },

    count: function(ref) {
      var n = 0;
      [D.hotbar, D.main].forEach(function(arr) {
        arr.forEach(function(s) {
          if (!s) return;
          if (s.kind === 'block' && typeof ref === 'number' && s.id === ref) n += s.count;
          if (s.kind === 'item' && typeof ref === 'string' && s.key === ref) n += s.count;
        });
      });
      return n;
    },

    setRefreshHook: function(fn) { _uiRefresh = fn; },
    refresh: refresh,
    bindSlot: bindSlot,
    renderSlotEl: renderSlotEl,
    craftResultClick: craftResultClick,
    matchRecipe: IN.matchRecipe,
    hideTooltip: hideTooltip,
    showTooltipFor: showTooltip,
    get craftGrid() { return D.craft; },
    get craftSize() { return D.craftSize; },
    set craftSize(v) { D.craftSize = v; },

    // 合成台关闭时把材料退回背包
    dumpCraft: function() {
      for (var i = 0; i < D.craft.length; i++) {
        if (D.craft[i]) { this.give(D.craft[i]); D.craft[i] = null; }
      }
      if (D.cursor) { this.give(D.cursor); D.cursor = null; }
      refresh();
    }
  };
})();
