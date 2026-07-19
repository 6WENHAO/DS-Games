"use strict";
// ============================================================
//  方块星野 BlockWilds - HUD
//  快捷栏 / 分段状态条 / 准星提示 / 循环时钟 / 飞船仪表
// ============================================================
window.G = window.G || {};

(function() {
  var U = G.U;
  var _hotbarEls = [];
  var _toastTimer = null;
  var _lastHP = -1, _lastO2 = -1, _lastFuel = -1;

  function buildHotbar() {
    var hb = U.$('hotbar');
    hb.innerHTML = '';
    _hotbarEls = [];
    for (var i = 0; i < 9; i++) {
      var el = U.el('div', 'slot', hb);
      _hotbarEls.push(el);
    }
  }

  function refreshHotbar() {
    for (var i = 0; i < 9; i++) {
      G.Inv.renderSlotEl(_hotbarEls[i], G.Inv.hotbar[i], i === G.Inv.sel);
    }
  }

  function buildBar(el, iconFull, iconEmpty, count, value, max) {
    // value: 当前值, 每个图标2点
    var per = max / count;
    var need = Math.ceil(count);
    if (el.childNodes.length !== need) {
      el.innerHTML = '';
      for (var i = 0; i < need; i++) U.el('img', '', el);
    }
    var imgs = el.childNodes;
    for (var j = 0; j < need; j++) {
      var thr = (j + 0.5) * per;
      var url = value >= thr ? iconFull : iconEmpty;
      if (imgs[j].src !== url) imgs[j].src = url;
    }
  }

  G.HUD = {
    init: function() {
      buildHotbar();
      refreshHotbar();
      // 烤棉花糖进度条
      var rb = U.el('div', '', U.$('hud'));
      rb.id = 'roast-bar';
      U.el('div', '', rb);
    },

    refreshHotbar: refreshHotbar,

    update: function(dt) {
      var P = G.Player.state;
      // 创造模式：隐藏生存状态条
      var statusEl = U.$('hud-status');
      var wantStatus = G.Creative ? 'none' : '';
      if (statusEl.style.display !== wantStatus) statusEl.style.display = wantStatus;
      var badge = U.$('creative-badge');
      if (G.Creative && !badge) {
        badge = U.el('div', '', U.$('hud'));
        badge.id = 'creative-badge';
        badge.textContent = '◆ 创造模式 ◆';
      } else if (!G.Creative && badge) badge.remove();
      if (!G.Creative) {
        // 血量（10图标=20点）
        buildBar(U.$('bar-health'), G.Icons.hudURL('heart_full'), G.Icons.hudURL('heart_empty'), 10, P.hp, G.CONF.HP_MAX);
        buildBar(U.$('bar-oxygen'), G.Icons.hudURL('bubble_full'), G.Icons.hudURL('bubble_empty'), 10, P.o2, G.CONF.O2_MAX);
        buildBar(U.$('bar-fuel'), G.Icons.hudURL('flame_full'), G.Icons.hudURL('flame_empty'), 10, P.fuel, G.CONF.FUEL_MAX);
        U.$('jet-fill').style.height = Math.round(P.fuel / G.CONF.FUEL_MAX * 92) + '%';
      }

      // 循环时钟
      var gp = G.Gameplay;
      if (gp) {
        var remain = gp.loopRemaining();
        var clockEl = U.$('hud-loopclock');
        var warn = remain < 60;
        clockEl.innerHTML = '☀ 恒星稳定度<br><span style="font-size:20px;color:' +
          (warn ? '#ff6a4a' : '#ffd9a0') + '">' + U.fmtTime(remain) + '</span>' +
          (warn ? '<br><span style="color:#ff6a4a">警告：坍缩临近</span>' : '');
      }

      // 飞船仪表
      var shipHud = U.$('ship-hud');
      if (P.inShip) {
        var S = G.Ship.state;
        var near = G.Solar.nearestPlanet(S.state === 'flying' ? S.pos : G.Ship.worldPos(new THREE.Vector3()));
        var relV = 0;
        if (S.state === 'flying') {
          var sv = G.Player.surfaceVelAt(near.planet, G.Solar.worldToLocal(near.planet, S.pos, new THREE.Vector3()), new THREE.Vector3());
          relV = S.vel.clone().sub(sv).length();
        }
        shipHud.innerHTML =
          '◆ 飞船状态 [' + (S.state === 'landed' ? '已着陆' : '飞行中') + ']\n' +
          '  燃料 ' + Math.round(S.fuel) + '%   船体 ' + Math.round(S.hull) + '%\n' +
          '  最近星球: ' + near.planet.name + '\n' +
          '  高度 ' + Math.max(0, Math.round(near.surfDist)) + 'm   相对速度 ' + relV.toFixed(1) + 'm/s' +
          (S.state === 'landed' ? '\n  [R] 点火起飞  [F] 离开驾驶位' : '\n  [F] 离开驾驶位（危险！）');
      } else {
        shipHud.innerHTML = '';
      }
    },

    setTargetInfo: function(target) {
      var hint = U.$('hud-hint');
      var gp = G.Gameplay;
      // gameplay 可以覆盖提示
      if (gp && gp.currentHint) { hint.innerHTML = gp.currentHint; return; }
      if (target) {
        var def = G.BLOCKS[target.id];
        if (def && def.use) {
          var uses = { craft: '右键打开工作台', nomai_text: '手持翻译机右键破译', campfire: '手持棉花糖右键烘烤', chest: '右键打开补给箱' };
          hint.innerHTML = uses[def.use] || '';
          return;
        }
        if (def && def.hard >= 0) { hint.innerHTML = ''; return; }
      }
      hint.innerHTML = '';
    },

    toast: function(msg, color, ms) {
      var el = U.$('hud-toast');
      el.innerHTML = msg;
      el.style.color = color || '#ffff55';
      el.style.opacity = 1;
      if (_toastTimer) clearTimeout(_toastTimer);
      _toastTimer = setTimeout(function() { el.style.opacity = 0; }, ms || 2600);
    },

    damageFlash: function() {
      var el = U.$('damage-flash');
      el.style.opacity = 1;
      setTimeout(function() { el.style.opacity = 0; }, 160);
    },

    roastBar: function(t) {
      var rb = U.$('roast-bar');
      if (t === null || t === undefined) { rb.style.display = 'none'; return; }
      rb.style.display = 'block';
      rb.firstChild.style.width = Math.min(100, t * 100) + '%';
    },

    // 信号镜界面
    scope: function(show, freqName, signalText, strength) {
      var el = U.$('scope-overlay');
      if (!show) { el.classList.add('hidden'); return; }
      el.classList.remove('hidden');
      U.$('scope-freq').innerHTML = '频段: ' + freqName + ' <span class="keycap">右键</span>切换';
      U.$('scope-signal').innerHTML = signalText || '';
      U.$('scope-ring').style.boxShadow =
        '0 0 0 2000px rgba(4,8,16,.72), inset 0 0 ' + (30 + (strength || 0) * 90) + 'px rgba(120,200,255,' + (0.1 + (strength || 0) * 0.4) + ')';
    },

    // 翻译机界面
    translate: function(show, text, title) {
      var el = U.$('translate-overlay');
      if (!show) { el.classList.add('hidden'); return; }
      el.classList.remove('hidden');
      if (title) U.$('translate-title').innerHTML = title;
      U.$('translate-text').innerHTML = text || '';
    }
  };
})();
