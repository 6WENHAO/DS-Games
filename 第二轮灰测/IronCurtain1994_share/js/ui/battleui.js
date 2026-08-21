/* 铁幕1994 — 战斗界面（HUD / 单位面板 / 预备队 / 支援 / 超限战 / 情报 / 交互） */
(function () {
  'use strict';
  var IC = window.IC;
  var U = IC.Util, R = IC.Rules, UI = IC.UI, Hex = IC.Hex, Btl = IC.Battle;
  var BU = IC.BattleUI = {};

  var G = {
    st: null, onFinish: null, tab: 'reserve',
    mode: 'select',            // select | deploy | aim
    aim: null,                 // {kind:'support'|'op', id, radius, def}
    deployIdx: -1,
    view: null,
    drag: null,
    busy: false,
    animTimer: null
  };
  BU.G = G;

  /* ================= 启动 ================= */
  BU.start = function (battleState, onFinish) {
    G.st = battleState;
    G.onFinish = onFinish;
    G.mode = 'select'; G.aim = null; G.deployIdx = -1; G.busy = false;
    G.view = {
      cam: { x: 0, y: 0, zoom: 1 },
      fogSide: battleState.playerSide,
      hover: null, selectedId: null, reachable: null, path: null,
      attackable: null, aim: null, deployZone: null,
      showGrid: true, showRad: true, showObjectives: true
    };
    G.st.onLog = function () { /* 日志在每次渲染时统一刷新 */ };
    G.st.onFx = function (kind, q, r, text) {
      try { if (IC.Render && IC.Render.addFX) IC.Render.addFX(kind, q, r, text); } catch (e) {}
    };
    UI.show('screen-battle');
    bindOnce();
    var cv = U.byId('map-canvas');
    try { IC.Render.init(cv); IC.Render.fitMap(G.st, G.view); } catch (e) { console.error(e); }
    BU.renderAll();
    animate();
    var m = G.st.mission || {};
    if (m.role === 'defend') UI.toast('防御任务：在时限内守住指定目标点。', null, 3600);
    else UI.toast('提示：先用侦察单位建立观察，再用炮兵压制、装甲突击。右键取消当前操作。', null, 4200);
  };

  /* ================= 事件绑定 ================= */
  var bound = false;
  function bindOnce() {
    if (bound) return; bound = true;
    var cv = U.byId('map-canvas');

    cv.addEventListener('mousemove', function (ev) {
      var rect = cv.getBoundingClientRect();
      var sx = ev.clientX - rect.left, sy = ev.clientY - rect.top;
      if (G.drag) {
        G.view.cam.x -= (ev.clientX - G.drag.x);
        G.view.cam.y -= (ev.clientY - G.drag.y);
        G.drag.x = ev.clientX; G.drag.y = ev.clientY;
        draw();
        return;
      }
      var h = null;
      try { h = IC.Render.screenToHex(G.st, G.view, sx, sy); } catch (e) {}
      var changed = (!!h !== !!G.view.hover) || (h && G.view.hover && (h.q !== G.view.hover.q || h.r !== G.view.hover.r));
      G.view.hover = h;
      if (changed) {
        updatePathPreview();
        draw();
        hoverTip(ev, h);
      }
    });
    cv.addEventListener('mouseleave', function () { G.view.hover = null; UI.hideTip(); draw(); });
    cv.addEventListener('mousedown', function (ev) {
      if (ev.button === 1 || ev.button === 2 || ev.shiftKey) { G.drag = { x: ev.clientX, y: ev.clientY }; ev.preventDefault(); }
    });
    window.addEventListener('mouseup', function () { G.drag = null; });
    cv.addEventListener('contextmenu', function (ev) { ev.preventDefault(); cancelMode(); });
    cv.addEventListener('click', function (ev) {
      if (G.busy) return;
      var rect = cv.getBoundingClientRect();
      var h = null;
      try { h = IC.Render.screenToHex(G.st, G.view, ev.clientX - rect.left, ev.clientY - rect.top); } catch (e) {}
      if (h) onHexClick(h);
    });
    cv.addEventListener('wheel', function (ev) {
      ev.preventDefault();
      var z = G.view.cam.zoom * (ev.deltaY < 0 ? 1.12 : 0.89);
      G.view.cam.zoom = U.clamp(z, 0.5, 2.2);
      draw();
    }, { passive: false });

    document.addEventListener('keydown', function (ev) {
      if (UI.current !== 'screen-battle') return;
      if (ev.key === 'Escape') cancelMode();
      else if (ev.key === ' ') { ev.preventDefault(); endTurn(); }
      else if (ev.key === 'Tab') { ev.preventDefault(); cycleUnits(); }
      else if (ev.key === 'd' || ev.key === 'D') { var u = sel(); if (u) doAction('dig'); }
      else if (ev.key === 'r' || ev.key === 'R') { var u2 = sel(); if (u2) doAction('rally'); }
    });

    var tabs = U.byId('r-tabs').children;
    for (var i = 0; i < tabs.length; i++) {
      (function (tab) {
        tab.onclick = function () {
          G.tab = tab.getAttribute('data-t');
          for (var j = 0; j < tabs.length; j++) tabs[j].classList.remove('on');
          tab.classList.add('on');
          renderRight();
        };
      })(tabs[i]);
    }
  }

  function sel() {
    if (!G.view.selectedId) return null;
    var u = G.st.units.filter(function (x) { return x.id === G.view.selectedId && !x.dead; })[0];
    return u || null;
  }

  function cancelMode() {
    G.mode = 'select'; G.aim = null; G.deployIdx = -1;
    G.view.aim = null; G.view.deployZone = null;
    BU.renderAll();
  }

  function cycleUnits() {
    var mine = Btl.living(G.st, G.st.playerSide).filter(function (u) { return u.ap > 0; });
    if (!mine.length) return;
    var idx = 0;
    for (var i = 0; i < mine.length; i++) if (mine[i].id === G.view.selectedId) { idx = i + 1; break; }
    selectUnit(mine[idx % mine.length]);
  }

  /* ================= 交互 ================= */
  function selectUnit(u) {
    G.mode = 'select'; G.aim = null; G.view.aim = null; G.deployIdx = -1; G.view.deployZone = null;
    if (!u) { G.view.selectedId = null; G.view.reachable = null; G.view.attackable = null; BU.renderAll(); return; }
    G.view.selectedId = u.id;
    computeOverlays(u);
    BU.renderAll();
  }

  function computeOverlays(u) {
    G.view.reachable = null; G.view.attackable = null; G.view.path = null;
    if (!u || u.side !== G.st.playerSide) return;
    if (u.ap > 0 && u.state !== 'routed') {
      try {
        var reach = Btl.reachable(G.st, u);
        G.view.reachable = reach.cells;
        G._reach = reach;
      } catch (e) { G.view.reachable = null; }
    }
    var att = {};
    Btl.living(G.st, G.st.enemySide).forEach(function (t) {
      if (!t.spotted[G.st.playerSide]) return;
      var w = Btl.bestWeapon(G.st, u, t);
      if (!w) return;
      att[Hex.key(t.q, t.r)] = { chance: Btl.hitChance(G.st, u, t, w.w, {}), unitId: t.id };
    });
    G.view.attackable = att;
  }

  function updatePathPreview() {
    var u = sel();
    G.view.path = null;
    if (!u || !G.view.hover || !G._reach || !G.view.reachable) return;
    var k = Hex.key(G.view.hover.q, G.view.hover.r);
    if (G.view.reachable[k]) G.view.path = Btl.pathTo(G._reach, k);
  }

  function onHexClick(h) {
    var st = G.st;
    if (st.over) return;
    var k = Hex.key(h.q, h.r);

    /* 支援 / 指令瞄准 */
    if (G.mode === 'aim' && G.aim) {
      executeAim(h);
      return;
    }
    /* 部署 */
    if (G.mode === 'deploy' && G.deployIdx >= 0) {
      var res = Btl.deploy(st, st.playerSide, G.deployIdx, h.q, h.r);
      if (!res.ok) { UI.toast(res.msg, 'bad'); return; }
      if (st.onFx) st.onFx('move', h.q, h.r);
      var entry = st.sides[st.playerSide].deck[G.deployIdx];
      if (!st.mode.endless && entry && entry.used >= entry.avail) { G.mode = 'select'; G.deployIdx = -1; G.view.deployZone = null; }
      BU.renderAll();
      return;
    }
    /* 常规选择 / 移动 / 射击 */
    var u = sel();
    var target = Btl.unitAt(st, h.q, h.r);
    if (target && target.side === st.playerSide) { selectUnit(target); return; }
    if (u && target && target.side === st.enemySide && target.spotted[st.playerSide]) { openFireDialog(u, target); return; }
    if (u && G.view.reachable && G.view.reachable[k]) {
      G.busy = true;
      var mv = Btl.moveUnit(st, u, k);
      G.busy = false;
      if (!mv.ok) { UI.toast(mv.msg, 'bad'); return; }
      if (st.onFx) st.onFx('move', h.q, h.r);
      computeOverlays(u);
      BU.renderAll();
      checkOver();
      return;
    }
    if (!target) selectUnit(null);
  }

  /* ================= 射击对话框 ================= */
  function openFireDialog(u, target) {
    var st = G.st;
    var list = Btl.weaponList(st, u);
    var eff = Btl.eff(u);
    var rows = [];
    list.forEach(function (item) {
      var w = item.w;
      var usable = Btl.weaponUsable(st, u, w, item.index, target);
      var cost = Btl.fireCost(w);
      var hc = usable ? Btl.hitChance(st, u, target, w, {}) : 0;
      var kc = usable ? Btl.killChance(st, u, target, w) : null;
      var reason = '';
      if (!usable) {
        var d = Hex.dist(u, target);
        if (d > w.rmax) reason = '超出射程（' + d + ' > ' + w.rmax + '）';
        else if (d < (w.rmin || 0)) reason = '低于最小射程';
        else if ((u.ammo[item.index] || 0) <= 0) reason = '弹药耗尽';
        else if (w.kind === 'NUKE' && !st.sides[u.side].nukeAuth) reason = '缺少核释放授权';
        else if (Btl.losBlocked(st, u, target)) reason = '视线被阻断';
        else reason = '无法对该目标使用';
      }
      rows.push({ item: item, w: w, usable: usable && u.ap >= cost, cost: cost, hc: hc, kc: kc, reason: reason || (u.ap < cost ? '行动点不足' : '') });
    });
    var wrap = U.el('div', 'fire-list');
    var head = U.el('div', '', '<div class="kv"><span>' + U.esc(u.short) + ' → <b>' + U.esc(target.short) + '</b></span>' +
      '<span class="dim">距离 ' + Hex.dist(u, target) + ' 格 · 目标凝聚力 ' + Math.round(target.cohesion) + ' · 编制 ' + target.str + '/' + target.maxStr + '</span></div>');
    wrap.appendChild(head);
    var modal;
    rows.forEach(function (r) {
      var el = U.el('div', 'fire-opt' + (r.usable ? '' : ' na'));
      if (!r.usable) el.style.opacity = '.45';
      var arcLabel = r.kc ? ({ front: '正面', side: '侧面', rear: '后方', top: '顶部', soft: '软目标' })[r.kc.arc] : '';
      el.innerHTML = '<div class="fo-t"><span>' + U.esc(r.w.name) + '</span><span class="dim">' + UI.kindName(r.w.kind) + ' · ' + r.cost + ' AP</span></div>' +
        '<div class="fo-s">' +
        (r.usable
          ? '<span>命中率 <b style="color:var(--gold)">' + Math.round(r.hc * 100) + '%</b></span>' +
            '<span>毁伤率 <b>' + Math.round(r.kc.p * 100) + '%</b></span>' +
            '<span>着弹面 ' + arcLabel + (r.kc.armor ? '（装甲 ' + r.kc.armor + ' vs 穿深 ' + r.kc.pen + '）' : '') + '</span>' +
            '<span>齐射 ' + (r.w.rof || 1) + ' 发</span>'
          : '<span style="color:#c25b52">' + U.esc(r.reason) + '</span>') +
        '</div>';
      if (r.usable) {
        el.onclick = function () {
          modal.close();
          doFire(u, target, r.item.index);
        };
      }
      wrap.appendChild(el);
    });
    modal = UI.modal('选择射击方式', wrap, [{ label: '取消' }]);
  }

  function doFire(u, target, weaponIdx) {
    var st = G.st;
    var rep = Btl.attack(st, u, target, weaponIdx, {});
    if (!rep.ok) { UI.toast(rep.msg || '射击失败', 'bad'); return; }
    if (rep.nuke) {
      UI.toast('☢ 核装置已投放。', 'nuke', 4000);
    } else {
      Btl.log(st, 'combat', '🎯 ' + u.short + ' 以 ' + rep.weapon + ' 射击 ' + rep.target +
        '：' + rep.shots + ' 发中 ' + rep.hits + ' 命中，' + rep.kills + ' 个编制被毁。');
      if (st.onFx) st.onFx(rep.kills > 0 ? 'kill' : 'hit', target.q, target.r);
    }
    computeOverlays(u);
    BU.renderAll();
    checkOver();
  }

  /* ================= 支援 / 指令 ================= */
  function beginAim(kind, id, def) {
    G.mode = 'aim';
    G.aim = { kind: kind, id: id, def: def };
    G.view.aim = { radius: def.radius || 0, kind: def.kind === 'nuke' ? 'nuke' : (kind === 'op' ? 'op' : 'barrage') };
    UI.toast('在地图上点击目标格以实施「' + def.name + '」，右键取消。', def.kind === 'nuke' ? 'nuke' : null, 3200);
    BU.renderAll();
  }

  function executeAim(h) {
    var st = G.st, a = G.aim;
    var res;
    if (a.kind === 'support') res = Btl.callSupport(st, st.playerSide, a.id, h.q, h.r);
    else res = Btl.useOp(st, st.playerSide, a.id, h.q, h.r);
    if (!res || !res.ok) { UI.toast((res && res.msg) || '执行失败', 'bad', 3200); return; }
    if (res.msg) UI.toast(res.msg.split('\n')[0], a.def.kind === 'nuke' ? 'nuke' : null, 3600);
    cancelMode();
    checkOver();
  }

  /* ================= 单位动作 ================= */
  function doAction(kind) {
    var u = sel();
    if (!u) return;
    var res;
    if (kind === 'dig') res = Btl.digIn(G.st, u);
    else if (kind === 'rally') res = Btl.rally(G.st, u);
    else if (kind === 'dismount') res = Btl.dismount(G.st, u);
    else if (kind === 'mount') res = Btl.mount(G.st, u);
    else if (kind === 'hold') { u.ap = 0; res = { ok: true }; }
    if (res && !res.ok) UI.toast(res.msg, 'bad');
    computeOverlays(u);
    BU.renderAll();
  }

  /* ================= 回合流转 ================= */
  function endTurn() {
    var st = G.st;
    if (st.over || G.busy) return;
    G.busy = true;
    selectUnit(null);
    var overlay = U.el('div', 'overlay-msg blink', '敌 方 行 动 中 …');
    var mapBox = document.querySelector('.b-map');
    mapBox.appendChild(overlay);
    var r1 = Btl.nextTurn(st);
    BU.renderAll();
    setTimeout(function () {
      try {
        if (!st.over) IC.AI.takeTurn(st, st.enemySide);
        if (!st.over) Btl.nextTurn(st);
      } catch (e) {
        console.error(e);
        Btl.log(st, 'warn', '敌方指挥系统出现故障（' + (e.message || e) + '）。');
      }
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      G.busy = false;
      BU.renderAll();
      if (!checkOver()) {
        var ch = (window.DATA_LORE.radioChatter || {})[st.playerSide] || [];
        if (ch.length) U.byId('b-chatter').innerHTML = '「' + U.esc(st.rng.pick(ch)) + '」<br><span class="dim">— 第 ' + st.turn + ' 回合，营指挥网</span>';
      }
    }, 420);
  }

  function checkOver() {
    if (!G.st.over) return false;
    var res = G.st.result || { kind: 'draw', why: '战斗结束' };
    setTimeout(function () { if (G.onFinish) G.onFinish(res, G.st); }, 700);
    return true;
  }

  /* ================= 绘制 ================= */
  function draw() {
    try { IC.Render.draw(G.st, G.view); } catch (e) { console.error(e); }
  }
  function animate() {
    if (G.animTimer) clearInterval(G.animTimer);
    G.animTimer = setInterval(function () {
      if (UI.current !== 'screen-battle') return;
      var more = false;
      try { more = IC.Render.tickFX(); } catch (e) {}
      if (more) draw();
    }, 45);
  }

  BU.renderAll = function () {
    if (!G.st) return;
    renderHud();
    renderUnitPanel();
    renderRight();
    renderLog();
    draw();
  };

  function renderHud() {
    var st = G.st, host = U.clear(U.byId('b-hud'));
    var p = st.sides[st.playerSide], e = st.sides[st.enemySide];
    var tg = st.targets || Btl.computeTargets(st);
    function item(label, val, cls, tipHtml) {
      var el = U.el('div', 'hud-item', '<div class="hl">' + label + '</div><div class="hv ' + (cls || '') + '">' + val + '</div>');
      if (tipHtml) UI.bindTip(el, tipHtml);
      return el;
    }
    host.appendChild(item('回合', st.turn + ' / ' + st.maxTurns));
    host.appendChild(item('模式', st.mode.short || st.mode.name));
    host.appendChild(item('召唤分值', Math.round(p.points) + ' <span class="dim" style="font-size:11px">+' + (p.lastIncome || p.incomeBase) + '</span>', 'gold',
      function () {
        return '<h4>召唤分值</h4><div class="tp-r"><span>基础收入</span><b>' + p.incomeBase + '</b></div>' +
          '<div class="tp-r"><span>控制目标点</span><b>' + st.map.objectives.filter(function (o) { return o.owner === st.playerSide; }).length + ' × ' + R.C.incomePerObjective + '</b></div>' +
          '<div class="tp-r"><span>金融/破袭修正</span><b>×' + (p.modifiers.incomeMult || 1).toFixed(2) + '</b></div>' +
          '<div class="dim">从场外召唤部队、呼叫支援与执行超限战指令都消耗分值。</div>';
      }));
    host.appendChild(item('指挥点', p.cp + ' / ' + R.C.cpMax, '', function () {
      return '<h4>指挥点 (CP)</h4><div class="dim">每回合恢复 ' + R.C.cpPerTurn + ' 点。超限战指令与「下达作战决心」需要消耗指挥点。</div>';
    }));
    host.appendChild(item('胜利分', Math.round(p.vp) + ' / ' + tg.player, 'gold', function () {
      return '<h4>胜利分</h4><div class="tp-r"><span>本方</span><b>' + Math.round(p.vp) + ' / ' + tg.player + '</b></div>' +
        '<div class="tp-r"><span>敌方</span><b>' + Math.round(e.vp) + ' / ' + tg.enemy + '</b></div>' +
        '<div class="dim">从敌方手中夺取的目标点每回合产满额胜利分，守着自己原有的目标只有三分之一；歼灭敌军也会得分。</div>';
    }));
    host.appendChild(item('敌方胜利分', Math.round(e.vp) + ' / ' + tg.enemy, e.vp / tg.enemy > 0.7 ? 'bad' : ''));
    /* 升级阶梯 */
    var esc = U.el('div', 'hud-item');
    var dots = '';
    for (var i = 1; i <= window.DATA_HYBRID.escalation.max; i++) {
      dots += '<i class="' + (st.escalation >= i ? (i >= 4 ? 'crit' : 'on') : '') + '"></i>';
    }
    esc.innerHTML = '<div class="hl">战区升级阶梯</div><div class="esc-ladder">' + dots + '</div>';
    UI.bindTip(esc, function () {
      var lv = (window.DATA_LORE.escalation.levels || [])[U.clamp(st.escalation, 0, 5)] || {};
      return '<h4>' + (lv.name || ('等级 ' + st.escalation)) + '</h4><div>' + U.esc(lv.text || '') + '</div>' +
        '<div class="hr"></div><div class="tp-r"><span>末日指数</span><b>' + st.doomsday + ' / 6</b></div>' +
        '<div class="dim">核与化学武器的使用会推高阶梯；末日指数满格意味着战略核交换。</div>';
    });
    host.appendChild(esc);
    host.appendChild(item('核授权', p.nukeAuth ? '<span style="color:#e8e07a">已授权</span>' : (st.mode.nuke === 'free' ? '无限制' : '未授权'),
      '', function () {
        var info = Btl.authChance(st, st.playerSide);
        var h = '<h4>战区核释放权限</h4>';
        h += '<div class="dim">在「超限战」面板下达作战决心可申请授权。当前成功率约 <b style="color:var(--gold)">' + Math.round(info.chance * 100) + '%</b></div><div class="hr"></div>';
        info.conds.forEach(function (c) {
          h += '<div class="tp-r"><span>' + (c.met ? '✔' : '✖') + ' ' + U.esc(c.text) + '</span><span class="dim">+' + Math.round(c.weight * 100) + '%</span></div>';
        });
        return h;
      }));
    var spacer = U.el('div', '', ''); spacer.style.flex = '1';
    host.appendChild(spacer);
    var b1 = U.el('button', 'btn sm primary', '结束回合 (空格)');
    b1.onclick = endTurn;
    if (G.busy) b1.classList.add('disabled');
    host.appendChild(b1);
    var b2 = U.el('button', 'btn sm', '目标');
    b2.onclick = showObjectives;
    host.appendChild(b2);
    var b3 = U.el('button', 'btn sm', '菜单');
    b3.onclick = function () {
      UI.modal('战场菜单', '<p>当前：' + U.esc(st.map.name) + ' · 第 ' + st.turn + ' / ' + st.maxTurns + ' 回合</p>' +
        '<p class="dim">放弃战斗将按当前态势判定为失败。</p>', [
        { label: '继续作战' },
        { label: '规则与操作', fn: function () { IC.Screens.showHelp(true); } },
        { label: '放弃战斗', cls: 'danger', fn: function () {
          Btl.finish(st, 'lose', '指挥官下令停止进攻，部队脱离接触。');
          if (G.onFinish) G.onFinish(st.result, st);
        } }
      ]);
    };
    host.appendChild(b3);
  }

  function showObjectives() {
    var st = G.st;
    var h = '<div class="dim">控制目标点可获得每回合分值收入与胜利分。夺取敌方目标点的收益是守住自家目标的三倍。</div><div class="hr"></div>';
    st.map.objectives.forEach(function (o) {
      var own = o.owner ? UI.sideName(o.owner) : '中立';
      var col = o.owner === st.playerSide ? 'var(--good)' : (o.owner ? 'var(--bad)' : 'var(--text-dim)');
      h += '<div class="kv"><span><b>' + o.label + '</b> ' + U.esc(o.name) + (o.origin && o.origin !== o.owner ? ' <span class="tag gold">已夺取</span>' : '') +
        '</span><span style="color:' + col + '">' + own + ' · ' + o.vp + ' 分</span></div>';
    });
    if ((st.mission.holdObjectives || []).length) {
      h += '<div class="hr"></div><div class="tag bad">必须死守：' + st.mission.holdObjectives.map(function (id) {
        var o = st.map.objectives.filter(function (x) { return x.id === id; })[0];
        return o ? o.label + ' ' + o.name : id;
      }).join('、') + '</div>';
    }
    UI.modal('战场目标', h, [{ label: '关闭' }]);
  }

  /* ---------- 单位面板 ---------- */
  function renderUnitPanel() {
    var host = U.clear(U.byId('u-panel'));
    var u = sel();
    var st = G.st;
    if (!u) {
      host.appendChild(U.el('div', 'panel-h', '<span>部队详情</span>'));
      var tips = window.DATA_LORE.tips || [];
      host.appendChild(U.el('div', 'tab-body', '<div class="dim">点击本方部队查看详情。<br><br>' +
        '<b style="color:var(--gold)">操作</b><br>· 左键选中 / 移动 / 攻击<br>· 右键或 ESC 取消<br>· 滚轮缩放，Shift+拖动平移<br>· 空格结束回合，Tab 循环可行动部队<br>· D 构筑阵地，R 就地整顿<br><br>' +
        (tips.length ? '<b style="color:var(--gold)">战术提示</b><br>' + U.esc(tips[Math.floor(Math.random() * tips.length)]) : '') + '</div>'));
      return;
    }
    var eff = Btl.eff(u);
    var card = u.card;
    var hdr = U.el('div', 'unit-hdr');
    hdr.innerHTML = '<div class="un">' + U.esc(card.name) + (u.mounted ? ' <span class="tag">乘车</span>' : '') + '</div>' +
      '<div class="us">' + UI.country(card.country) + ' · ' + UI.catName(card.category) + ' · ' + UI.vetName(card.vet) +
      (card.era === 1994 ? ' · <span class="tag era94">1994</span>' : '') + '</div>';
    host.appendChild(hdr);

    var body = U.el('div', 'tab-body');
    body.appendChild(U.el('div', '', '<div class="kv"><span class="dim">编制</span><b>' + u.str + ' / ' + u.maxStr + '</b></div>' +
      '<div class="bar str"><i style="width:' + (100 * u.str / u.maxStr) + '%"></i></div>' +
      '<div class="kv" style="margin-top:5px"><span class="dim">凝聚力 ' + (u.state === 'routed' ? '<span style="color:#c25b52">溃散</span>' : u.state === 'pinned' ? '<span style="color:#d1a24a">被压制</span>' : '') + '</span><b>' + Math.round(u.cohesion) + '</b></div>' +
      '<div class="bar coh"><i style="width:' + u.cohesion + '%"></i></div>'));
    var s = eff.stats || {};
    body.appendChild(U.el('div', 'hr'));
    body.appendChild(U.el('div', '',
      '<div class="kv"><span class="dim">行动点</span><b>' + u.ap + ' / ' + u.maxAp + '</b></div>' +
      '<div class="kv"><span class="dim">机动力</span><b>' + Btl.moveAllowance(st, u) + ' 格</b></div>' +
      '<div class="kv"><span class="dim">装甲 正/侧/顶</span><b>' + (s.armorF || 0) + ' / ' + (s.armorS || 0) + ' / ' + (s.armorT || 0) + '</b></div>' +
      '<div class="kv"><span class="dim">观测 / 隐蔽</span><b>' + (s.optics || 0) + ' / ' + (s.stealth || 0) + '</b></div>' +
      '<div class="kv"><span class="dim">构筑度</span><b>' + u.entrench + ' / 3</b></div>' +
      (u.card.category === 'AIR' ? '<div class="kv"><span class="dim">剩余出击轮次</span><b>' + (u.sortie || 0) + '</b></div>' : '') +
      (u.card.category === 'HEL' ? '<div class="kv"><span class="dim">燃油</span><b>' + (u.fuel || 0) + '</b></div>' : '')));

    var hx = st.map.at(u.q, u.r);
    if (hx) {
      var terr = R.terrain(hx.t);
      body.appendChild(U.el('div', '', '<div class="kv"><span class="dim">所在地形</span><b>' + terr.name +
        '（掩体 ' + Math.round(terr.cover * 100) + '%）</b></div>' +
        (hx.rad ? '<div class="kv"><span class="dim">辐射污染</span><b style="color:#d8d24a">' + hx.rad + ' 级</b></div>' : '') +
        (hx.chem ? '<div class="kv"><span class="dim">化学污染</span><b style="color:#c58fd8">残留</b></div>' : '') +
        (hx.smoke ? '<div class="kv"><span class="dim">烟幕</span><b>' + hx.smoke + ' 回合</b></div>' : '')));
    }

    body.appendChild(U.el('div', 'hr'));
    body.appendChild(U.el('h4', '', '武器'));
    (eff.weapons || []).forEach(function (w, i) {
      body.appendChild(U.el('div', 'weap-row', UI.weaponHtml(w, u.ammo[i])));
    });
    if (eff.traits && eff.traits.length) {
      body.appendChild(U.el('div', 'hr'));
      body.appendChild(U.el('div', 'dim', '特性：' + eff.traits.map(function (t) { return UI.traitName(t); }).join('、')));
    }
    if (card.mods && card.mods.length) {
      body.appendChild(U.el('div', 'dim', '改装：' + card.mods.map(function (m) {
        return (window.DATA_MODS[m] || {}).name || m;
      }).join('、')));
    }
    host.appendChild(body);

    /* 动作 */
    var acts = U.el('div', 'act-grid');
    function actBtn(label, kind, ok, tip) {
      var b = U.el('button', 'btn sm' + (ok ? '' : ' disabled'), label);
      if (ok) b.onclick = function () { doAction(kind); };
      if (tip) UI.bindTip(b, tip);
      acts.appendChild(b);
    }
    var mine = u.side === st.playerSide;
    actBtn('构筑阵地 (D)', 'dig', mine && u.ap >= R.C.digCost && u.entrench < 3, '消耗 ' + R.C.digCost + ' AP，提升掩体与隐蔽。');
    actBtn('就地整顿 (R)', 'rally', mine && u.ap > 0, '消耗全部 AP，恢复约 ' + R.C.rallyRecover + ' 点凝聚力。');
    if (u.mounted) actBtn('下车展开', 'dismount', mine && u.ap >= R.C.dismountCost, '步兵下车后获得掩体与反坦克火力，载具退往后方。');
    else if (u.mountCard) actBtn('登车', 'mount', mine && u.ap >= R.C.dismountCost, '重新登车以获得机动力。');
    else actBtn('—', 'none', false);
    actBtn('待命', 'hold', mine && u.ap > 0, '清空剩余行动点（保留警戒射击能力）。');
    host.appendChild(acts);
  }

  /* ---------- 右侧面板 ---------- */
  function renderRight() {
    var host = U.clear(U.byId('r-body'));
    var st = G.st, p = st.sides[st.playerSide];
    if (G.tab === 'reserve') {
      host.appendChild(U.el('div', 'dim', '点击卡片进入部署模式，然后在<b style="color:var(--gold)">高亮的部署区</b>点击落点。剩余分值 ' +
        Math.round(p.points) + '。'));
      var byCat = {};
      p.deck.forEach(function (d, i) { (byCat[d.card.category] = byCat[d.card.category] || []).push({ d: d, i: i }); });
      Object.keys(byCat).sort(function (a, b) {
        return ((R.CATEGORY[a] || {}).order || 9) - ((R.CATEGORY[b] || {}).order || 9);
      }).forEach(function (cat) {
        host.appendChild(U.el('div', 'dim', '<b style="color:var(--gold)">' + UI.catName(cat) + '</b>'));
        byCat[cat].forEach(function (it) {
          var d = it.d;
          var left = st.mode.endless ? '∞' : (d.avail - d.used);
          var canAfford = p.points >= d.card.cost;
          var out = !st.mode.endless && d.used >= d.avail;
          var el = U.el('div', 'rcard' + (G.deployIdx === it.i ? ' sel' : '') + ((out || !canAfford) ? ' na' : ''));
          el.innerHTML = '<div class="rc-n">' + U.esc(d.card.short || d.card.name) + '</div>' +
            '<div class="rc-m"><span>' + UI.vetName(d.card.vet) + ' · 剩余 ' + left + '</span><span class="rc-cost">' + d.card.cost + ' 分</span></div>';
          UI.bindTip(el, function () { return UI.cardTip(d.card); });
          if (!out && canAfford) {
            el.onclick = function () {
              G.mode = 'deploy'; G.deployIdx = it.i;
              G.view.selectedId = null; G.view.reachable = null; G.view.attackable = null;
              var zone = {};
              (st.map.deploy[st.playerSide] || []).forEach(function (k) {
                var pp = Hex.parse(k);
                if (Btl.canDeployAt(st, st.playerSide, pp.q, pp.r)) zone[k] = true;
              });
              G.view.deployZone = zone;
              BU.renderAll();
            };
          }
          host.appendChild(el);
        });
      });
    } else if (G.tab === 'support') {
      host.appendChild(U.el('div', 'dim', '呼叫场外火力。延迟弹着的火力会在下个回合开始时落下——预判敌军的移动。'));
      if (!p.support.length) host.appendChild(U.el('div', 'dim', '本次作战未编配场外支援。'));
      p.support.forEach(function (sup) {
        var def = sup.def;
        var cost = Math.round(def.cost * (st.mode.endless ? 0.6 : 1));
        var avail = Btl.supportAvailable(st, st.playerSide, sup) && p.points >= cost;
        var el = U.el('div', 'rcard' + (avail ? '' : ' na') + (G.aim && G.aim.id === sup.id ? ' sel' : ''));
        var lockMsg = '';
        if (def.restricted === 'nuke' && !p.nukeAuth) lockMsg = '需战区核授权';
        else if (def.restricted === 'chem' && !p.chemAuth) lockMsg = '需化学武器授权';
        else if (!st.mode.endless && sup.used >= sup.max) lockMsg = '已用尽';
        else if (p.points < cost) lockMsg = '分值不足';
        el.innerHTML = '<div class="rc-n">' + (def.kind === 'nuke' ? '☢ ' : def.kind === 'smoke' ? '🌫 ' : def.kind === 'recon' ? '🛩 ' : '💥 ') +
          U.esc(def.name) + '</div>' +
          '<div class="rc-m"><span>' + (lockMsg ? '<span style="color:#c25b52">' + lockMsg + '</span>' :
            ('半径 ' + def.radius + ' · ' + (def.delay ? '延迟 ' + def.delay + ' 回合' : '立即') + ' · 剩 ' + (st.mode.endless ? '∞' : (sup.max - sup.used)))) +
          '</span><span class="rc-cost">' + cost + ' 分</span></div>';
        UI.bindTip(el, function () {
          return '<h4>' + U.esc(def.name) + '</h4><div>' + U.esc(def.desc) + '</div><div class="hr"></div>' +
            '<div class="tp-r"><span>覆盖半径</span><b>' + def.radius + ' 格</b></div>' +
            (def.he ? '<div class="tp-r"><span>杀伤 / 穿深</span><b>' + def.he + ' / ' + (def.pen || 0) + '</b></div>' : '') +
            (def.shots ? '<div class="tp-r"><span>弹数</span><b>' + def.shots + '</b></div>' : '') +
            (def.yieldKt ? '<div class="tp-r"><span>当量</span><b>' + def.yieldKt + ' 千吨</b></div>' : '');
        });
        if (avail) el.onclick = function () { beginAim('support', sup.id, def); };
        host.appendChild(el);
      });
    } else if (G.tab === 'ops') {
      host.appendChild(U.el('div', 'dim', '《超限战》工具箱：电子战、信息战、金融战、特种破袭。消耗分值与指挥点（当前 ' + p.cp + ' CP）。'));
      p.ops.forEach(function (op) {
        var def = op.def;
        var dom = window.DATA_HYBRID.domains[def.domain] || {};
        var cost = Math.round(def.cost * (p.modifiers.opsCostMult || 1));
        var isResolve = def.effect === 'resolve';
        var canDo = p.cp >= (def.cp || 1) && (isResolve || p.points >= cost);
        var el = U.el('div', 'rcard' + (canDo ? '' : ' na') + (G.aim && G.aim.id === op.id ? ' sel' : ''));
        el.innerHTML = '<div class="rc-n">' + (dom.icon || '') + ' ' + U.esc(def.name) + '</div>' +
          '<div class="rc-m"><span>' + (dom.name || '') + ' · ' + (def.cp || 1) + ' CP' +
          (def.radius ? ' · 半径 ' + def.radius : '') + '</span><span class="rc-cost">' + (isResolve ? '免费' : cost + ' 分') + '</span></div>';
        UI.bindTip(el, function () {
          if (isResolve) {
            var info = Btl.authChance(st, st.playerSide);
            var h = '<h4>下达作战决心</h4><div>' + U.esc(def.desc) + '</div><div class="hr"></div>' +
              '<div class="tp-r"><span>预计批准概率</span><b style="color:var(--gold)">' + Math.round(info.chance * 100) + '%</b></div><div class="hr"></div>';
            info.conds.forEach(function (c) {
              h += '<div class="tp-r"><span>' + (c.met ? '✔' : '✖') + ' ' + U.esc(c.text) + '</span><span class="dim">+' + Math.round(c.weight * 100) + '%</span></div>';
            });
            h += '<div class="hr"></div><div class="dim">获批后本场战斗解锁核打击，同时推高战区升级阶梯与末日指数——敌方也很可能随之获得核报复授权。</div>';
            return h;
          }
          return '<h4>' + U.esc(def.name) + '</h4><div>' + U.esc(def.desc) + '</div>';
        });
        if (canDo) {
          el.onclick = function () {
            if (isResolve) {
              UI.confirm('下达作战决心', '你将以战区司令部的名义申请核释放权限。这一步无法撤回，且很可能引来对方的核报复。是否继续？', function () {
                var res = Btl.requestAuthorization(st, st.playerSide);
                UI.toast(res.msg || '', res.granted ? 'nuke' : 'bad', 5000);
                BU.renderAll();
              }, '下达决心');
              return;
            }
            if ((def.radius || 0) > 0) beginAim('op', op.id, def);
            else {
              var res = Btl.useOp(st, st.playerSide, op.id, 0, 0);
              if (!res.ok) UI.toast(res.msg, 'bad');
              else UI.toast(res.msg.split('\n')[0], null, 3600);
              BU.renderAll();
            }
          };
        }
        host.appendChild(el);
      });
    } else {
      /* 情报 */
      var e = st.sides[st.enemySide];
      var seen = Btl.living(st, st.enemySide).filter(function (u) { return u.spotted[st.playerSide]; });
      host.appendChild(U.el('h4', '', '敌情'));
      host.appendChild(U.el('div', 'dim', '已侦察到 ' + seen.length + ' 支敌军部队' +
        (st.effects.some(function (ef) { return ef.kind === 'sigint' && ef.side === st.playerSide && ef.until >= st.turn; }) ? '（电子侦察生效中）' : '') + '。'));
      seen.sort(function (a, b) { return (b.card.cost || 0) - (a.card.cost || 0); }).forEach(function (t) {
        var el = U.el('div', 'rcard');
        el.innerHTML = '<div class="rc-n">' + U.esc(t.card.short || t.card.name) + '</div>' +
          '<div class="rc-m"><span>' + UI.catName(t.card.category) + ' · ' + Btl.hexName(st, t.q, t.r) + '</span>' +
          '<span>编制 ' + t.str + '/' + t.maxStr + '</span></div>';
        UI.bindTip(el, function () { return UI.cardTip(t.card); });
        el.onclick = function () {
          IC.Render.centerOn(st, G.view, t.q, t.r);
          draw();
        };
        host.appendChild(el);
      });
      host.appendChild(U.el('div', 'hr'));
      host.appendChild(U.el('h4', '', '战区态势'));
      host.appendChild(U.el('div', '',
        '<div class="kv"><span class="dim">升级阶梯</span><b>' + st.escalation + ' / ' + window.DATA_HYBRID.escalation.max + '</b></div>' +
        '<div class="kv"><span class="dim">末日指数</span><b>' + st.doomsday + ' / 6</b></div>' +
        '<div class="kv"><span class="dim">本方核使用</span><b>' + st.sides[st.playerSide].nukesUsed + ' 次</b></div>' +
        '<div class="kv"><span class="dim">敌方核使用</span><b>' + e.nukesUsed + ' 次</b></div>' +
        '<div class="kv"><span class="dim">敌方核授权</span><b>' + (e.nukeAuth ? '<span style="color:#c25b52">已获得</span>' : '尚未') + '</b></div>' +
        '<div class="kv"><span class="dim">本方战损</span><b>' + st.sides[st.playerSide].lost + ' 支</b></div>' +
        '<div class="kv"><span class="dim">歼灭敌军</span><b>' + st.sides[st.playerSide].killed + ' 支</b></div>'));
      var strat = st.sides[st.playerSide].strat || {};
      var keys = Object.keys(strat);
      if (keys.length) {
        host.appendChild(U.el('div', 'hr'));
        host.appendChild(U.el('h4', '', '战略层加成'));
        var txt = [];
        if (strat.incomeMult) txt.push('本方收入 ×' + strat.incomeMult.toFixed(2));
        if (strat.enemyIncomeMult) txt.push('敌方收入 ×' + strat.enemyIncomeMult.toFixed(2));
        if (strat.enemyCohesion) txt.push('敌方初始凝聚力 ' + strat.enemyCohesion);
        if (strat.availMod) txt.push('可用数量 +' + strat.availMod);
        if (strat.deckSlots) txt.push('卡组槽位 +' + strat.deckSlots);
        if (strat.nukeAuthBonus) txt.push('核授权概率 +' + Math.round(strat.nukeAuthBonus * 100) + '%');
        if (strat.nukePreAuth) txt.push('开局核预授权');
        if (strat.chemAuth) txt.push('化学武器授权');
        if (strat.enemyReserveDelay) txt.push('敌方增援延迟 ' + strat.enemyReserveDelay + ' 回合');
        if (strat.enemyAaAcc) txt.push('敌方防空命中 ' + Math.round(strat.enemyAaAcc * 100) + '%');
        host.appendChild(U.el('div', 'dim', txt.length ? txt.join('<br>') : '无'));
      }
    }
  }

  function renderLog() {
    var host = U.byId('b-log');
    var st = G.st;
    var items = st.log.slice(-40);
    host.innerHTML = items.map(function (l) {
      return '<div class="l ' + (l.kind || '') + '"><span class="t">T' + l.turn + '</span>' + U.esc(l.text).replace(/\n/g, '<br>') + '</div>';
    }).join('');
    host.scrollTop = host.scrollHeight;
  }

  function hoverTip(ev, h) {
    if (!h) { UI.hideTip(); return; }
    var st = G.st;
    var hx = st.map.at(h.q, h.r);
    if (!hx) { UI.hideTip(); return; }
    var terr = R.terrain(hx.t);
    var u = Btl.unitAt(st, h.q, h.r);
    var html = '<h4>' + Btl.hexName(st, h.q, h.r) + ' · ' + terr.name + '</h4>';
    html += '<div class="tp-r"><span>掩体 / 机动消耗</span><b>' + Math.round(terr.cover * 100) + '% / ' + terr.move + '</b></div>';
    if (hx.road) html += '<div class="dim">有道路：沿路机动消耗减半</div>';
    if (hx.rad) html += '<div style="color:#d8d24a">辐射污染 ' + hx.rad + ' 级：每回合造成损耗与凝聚力下降</div>';
    if (hx.chem) html += '<div style="color:#c58fd8">化学污染残留</div>';
    if (hx.smoke) html += '<div class="dim">烟幕：观测与命中大幅下降</div>';
    if (u && (u.side === st.playerSide || u.spotted[st.playerSide])) {
      html += '<div class="hr"></div><h4>' + U.esc(u.card.name) + '</h4>';
      html += '<div class="tp-r"><span>' + UI.sideName(u.side) + ' · ' + UI.vetName(u.card.vet) + '</span><b>编制 ' + u.str + '/' + u.maxStr + '</b></div>';
      html += '<div class="tp-r"><span>凝聚力 / 行动点</span><b>' + Math.round(u.cohesion) + ' / ' + u.ap + '</b></div>';
      var sel0 = sel();
      if (sel0 && u.side !== sel0.side) {
        var w = Btl.bestWeapon(st, sel0, u);
        if (w) {
          var hc = Btl.hitChance(st, sel0, u, w.w, {});
          var kc = Btl.killChance(st, sel0, u, w.w);
          html += '<div class="hr"></div><div class="tp-r"><span>' + U.esc(w.w.name) + '</span><b style="color:var(--gold)">' +
            Math.round(hc * 100) + '% 命中 / ' + Math.round(kc.p * 100) + '% 毁伤</b></div>';
        } else {
          html += '<div class="hr"></div><div class="dim">当前无可用武器打击该目标</div>';
        }
      }
    }
    if (G.mode === 'aim' && G.aim) {
      html += '<div class="hr"></div><div style="color:var(--gold)">点击此处实施「' + U.esc(G.aim.def.name) + '」（半径 ' + (G.aim.def.radius || 0) + ' 格）</div>';
    }
    if (G.mode === 'deploy' && G.deployIdx >= 0) {
      var d = st.sides[st.playerSide].deck[G.deployIdx];
      html += '<div class="hr"></div><div style="color:var(--gold)">点击部署 ' + U.esc(d.card.short || d.card.name) + '（' + d.card.cost + ' 分）</div>';
    }
    UI.tip(html, ev);
  }
})();
