/* ============================================================
   hud.js — 下屏游戏界面：标题栏 / 生命条 / 指令按钮 / 选项列表 / 回顾
   ============================================================ */
(function (AA) {
  'use strict';
  var U = AA.U, PX = AA.PX, P = AA.PAL, F = AA.FONT, S = AA.SFX;
  var HUD = AA.HUD = {};

  var W = 256, H = 192;

  var st = {
    title: '', phase: '', mode: 'idle',
    buttons: [], menu: null, menuSel: 0, menuTitle: '',
    life: 5, lifeMax: 5, lifeFlash: 0, lifeShown: 5,
    t: 0, popT: 0, hint: '',
    log: [], logOpen: false, logScroll: 0,
    pressed: null, pressT: 0
  };
  HUD.state = st;

  HUD.reset = function () {
    st.buttons = []; st.menu = null; st.title = ''; st.phase = '';
    st.life = st.lifeMax = 5; st.lifeShown = 5; st.log = []; st.logOpen = false;
    st.hint = '';
  };
  HUD.setTitle = function (a, b) {
    if (a !== undefined) st.title = a || '';
    if (b !== undefined) st.phase = b || '';
  };
  HUD.showLife = function (on) { st.showLife = on !== false; };
  HUD.setPhase = function (b) { st.phase = b || ''; };
  HUD.setHint = function (h) { st.hint = h || ''; };
  HUD.setLife = function (cur, max) {
    if (max) st.lifeMax = max;
    if (cur < st.life) st.lifeFlash = 1.2;
    st.life = cur;
  };
  HUD.life = function () { return st.life; };
  HUD.setButtons = function (list) { st.buttons = list || []; st.popT = 0; st.rootSel = 0; };
  HUD.buttons = function () { return st.buttons; };
  HUD.setMenu = function (items, o) {
    o = o || {};
    st.menu = items && items.length ? items : null;
    st.menuSel = o.sel || 0;
    st.menuTitle = o.title || '';
    st.popT = 0;
  };
  HUD.menuSel = function () { return st.menuSel; };
  HUD.hasMenu = function () { return !!st.menu; };
  HUD.pushLog = function (who, text) {
    st.log.push({ who: who || '', text: text });
    if (st.log.length > 80) st.log.shift();
  };
  HUD.toggleLog = function () {
    st.logOpen = !st.logOpen;
    st.logScroll = Math.max(0, st.log.length - 6);
    S[st.logOpen ? 'open' : 'close']();
  };
  HUD.logOpen = function () { return st.logOpen; };

  /* ---------------- 背景 ---------------- */
  var bgCv = null;
  function bgArt() {
    if (bgCv) return bgCv;
    bgCv = PX.make(W, H, function (pen) {
      pen.vgrad(0, 0, W, H, '#1d2b56', '#0a1024', 9);
      // 细网格
      pen.save(); pen.alpha(.05);
      for (var y = 0; y < H; y += 4) pen.rect(0, y, W, 1, '#ffffff');
      for (var x = 0; x < W; x += 4) pen.rect(x, 0, 1, H, '#ffffff');
      pen.restore();
      // 中央天秤水印
      pen.save(); pen.alpha(.10);
      scales(pen, 128, 84, 1.5, '#ffffff');
      pen.restore();
      // 顶栏
      pen.rect(0, 0, W, 20, '#080c1c');
      pen.vgrad(0, 1, W, 18, '#25355f', '#0c1330', 4);
    }, { noSnap: true });
    var c = bgCv.getContext('2d');
    c.fillStyle = '#e8c46a'; c.fillRect(0, 19, W, 1);
    c.fillStyle = '#000000'; c.fillRect(0, 20, W, 1);
    return bgCv;
  }

  /** 天秤线稿 */
  function scales(pen, cx, cy, s, col) {
    pen.rect(cx - 1 * s, cy - 26 * s, 2 * s, 50 * s, col);
    pen.rect(cx - 24 * s, cy - 22 * s, 48 * s, 2 * s, col);
    pen.rect(cx - 14 * s, cy + 24 * s, 28 * s, 2.4 * s, col);
    pen.circle(cx, cy - 28 * s, 3 * s, col);
    // 左右托盘
    [-1, 1].forEach(function (d) {
      pen.rect(cx + d * 22 * s - .8 * s, cy - 21 * s, 1.6 * s, 10 * s, col);
      pen.poly([[cx + d * 30 * s, cy - 11 * s], [cx + d * 14 * s, cy - 11 * s],
      [cx + d * 18 * s, cy - 5 * s], [cx + d * 26 * s, cy - 5 * s]], col);
    });
  }
  HUD.scales = scales;

  /* ---------------- 按钮绘制 ---------------- */
  function btnColors(kind, on) {
    if (kind === 'hot') return on ? ['#e06a72', '#8b2029'] : [P.ui.btnHotFace1, P.ui.btnHotFace2];
    if (kind === 'gold') return on ? ['#f4dc9a', '#a87c22'] : [P.ui.btnGoldFace1, P.ui.btnGoldFace2];
    if (kind === 'dark') return on ? ['#3a4270', '#161c38'] : ['#2a3157', '#101632'];
    return on ? ['#5a7ade', '#25397e'] : [P.ui.btnFace1, P.ui.btnFace2];
  }

  function drawButton(ctx, x, y, w, h, label, kind, enabled, pressed, sub) {
    var cols = btnColors(kind, false);
    if (kind === 'gold') cols = enabled ? [P.ui.btnGoldFace1, P.ui.btnGoldFace2] : ['#5a5038', '#2c2718'];
    if (!enabled) cols = ['#333a58', '#181d33'];
    var oy = pressed ? 2 : 0;
    ctx.fillStyle = '#000000';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(0,0,0,.55)';
    ctx.fillRect(x + 1, y + h - 3 + oy, w - 2, 3);
    var g = ctx.createLinearGradient(0, y + oy, 0, y + h + oy);
    g.addColorStop(0, cols[0]); g.addColorStop(1, cols[1]);
    ctx.fillStyle = g;
    ctx.fillRect(x + 1, y + 1 + oy, w - 2, h - 4);
    // 高光 / 描边
    ctx.fillStyle = enabled ? 'rgba(255,255,255,.42)' : 'rgba(255,255,255,.13)';
    ctx.fillRect(x + 1, y + 1 + oy, w - 2, 1);
    ctx.fillStyle = enabled ? (kind === 'gold' ? '#fff3cc' : '#cfdcff') : '#5a6488';
    ctx.fillRect(x + 1, y + 1 + oy, 1, h - 4); ctx.fillRect(x + w - 2, y + 1 + oy, 1, h - 4);
    var tcol = enabled ? (kind === 'gold' ? '#2c2008' : '#ffffff') : '#7c86a8';
    var ty = y + F.vcenter(h - 4, 'ui') + oy + (sub ? -5 : 0);
    F.center(ctx, label, x + w / 2, ty, 'ui', tcol);
    if (sub) F.center(ctx, sub, x + w / 2, ty + 15, 'tiny', enabled ? 'rgba(255,255,255,.65)' : '#666f90');
  }
  HUD.drawButton = drawButton;

  /* ---------------- 生命条 ---------------- */
  function drawLife(ctx, x, y) {
    var n = st.lifeMax, segW = 13, segH = 9, gap = 1;
    var total = n * segW + (n - 1) * gap;
    var bx = x - total;
    F.draw(ctx, '生命', bx - 26, y - 1, 'tiny', '#cfd8f0');
    ctx.fillStyle = '#000000';
    ctx.fillRect(bx - 2, y - 2, total + 4, segH + 4);
    ctx.fillStyle = P.ui.hpBack;
    ctx.fillRect(bx - 1, y - 1, total + 2, segH + 2);
    for (var i = 0; i < n; i++) {
      var sx = bx + i * (segW + gap);
      var alive = i < st.lifeShown;
      if (alive) {
        var g = ctx.createLinearGradient(0, y, 0, y + segH);
        g.addColorStop(0, P.ui.hpFill1); g.addColorStop(1, P.ui.hpFill2);
        ctx.fillStyle = g;
        ctx.fillRect(sx, y, segW, segH);
        ctx.fillStyle = 'rgba(255,255,255,.55)';
        ctx.fillRect(sx, y, segW, 1);
      } else {
        ctx.fillStyle = P.ui.hpLost;
        ctx.fillRect(sx, y, segW, segH);
        ctx.fillStyle = 'rgba(0,0,0,.5)';
        ctx.fillRect(sx + 1, y + 1, segW - 2, segH - 2);
      }
    }
    if (st.lifeFlash > 0) {
      ctx.save();
      ctx.globalAlpha = Math.abs(Math.sin(st.lifeFlash * 18)) * U.sat(st.lifeFlash);
      ctx.strokeStyle = '#ff3a4a'; ctx.lineWidth = 2;
      ctx.strokeRect(bx - 3, y - 3, total + 6, segH + 6);
      ctx.restore();
    }
  }

  /* ---------------- 更新 ---------------- */
  HUD.update = function (dt) {
    st.t += dt; st.popT += dt;
    if (st.lifeFlash > 0) st.lifeFlash -= dt;
    if (st.pressT > 0) { st.pressT -= dt; if (st.pressT <= 0) st.pressed = null; }
    // 生命条平滑扣减
    if (st.lifeShown > st.life) {
      if (st.lifeFlash <= 0.72) st.lifeShown = st.life;
    } else if (st.lifeShown < st.life) st.lifeShown = st.life;
  };

  /* ---------------- 布局 ---------------- */
  var DEFAULT_BTN = [{ id: 'record', label: '法 庭 记 录', kind: 'gold' }];
  function buttonRects() {
    var list = st.buttons;
    if (!list.length) list = st.noDefault ? [] : DEFAULT_BTN;
    var n = list.length;
    if (!n) return [];
    var y = 156, h = 32, m = 6, gap = 5;
    var w = Math.floor((W - m * 2 - gap * (n - 1)) / n);
    if (n === 1) { m = 60; w = W - m * 2; }
    var out = [];
    for (var i = 0; i < n; i++) out.push({ x: m + i * (w + gap), y: y, w: w, h: h, b: list[i] });
    return out;
  }
  HUD.buttonRects = buttonRects;
  HUD.setNoDefault = function (v) { st.noDefault = !!v; };

  function menuRects() {
    if (!st.menu) return [];
    var n = st.menu.length;
    var top = st.menuTitle ? 44 : 32;
    var h = Math.min(26, Math.floor((146 - top) / n) - 3);
    h = Math.max(19, h);
    var gap = Math.min(6, Math.floor((146 - top - h * n) / Math.max(1, n)));
    var out = [];
    for (var i = 0; i < n; i++) out.push({ x: 16, y: top + i * (h + gap), w: W - 32, h: h, i: i });
    return out;
  }
  HUD.menuRects = menuRects;

  /* ---------------- 输入 ---------------- */
  HUD.handleTap = function (x, y) {
    if (st.logOpen) {
      if (y > 158) { HUD.toggleLog(); return '__log_close'; }
      if (y < 96) st.logScroll = Math.max(0, st.logScroll - 3);
      else st.logScroll = Math.min(Math.max(0, st.log.length - 6), st.logScroll + 3);
      S.cursor();
      return null;
    }
    if (y < 20 && x > 216) { HUD.toggleLog(); return '__log'; }
    var mr = menuRects();
    for (var i = 0; i < mr.length; i++) {
      var r = mr[i];
      if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) {
        if (st.menuSel !== i) { st.menuSel = i; S.cursor(); return null; }
        S.select();
        return { menu: i, item: st.menu[i] };
      }
    }
    var br = buttonRects();
    for (var k = 0; k < br.length; k++) {
      var q = br[k];
      if (x >= q.x && x < q.x + q.w && y >= q.y && y < q.y + q.h) {
        if (q.b.enabled === false) { S.deny(); return null; }
        st.pressed = q.b.id; st.pressT = .12;
        S.select();
        return { button: q.b.id, item: q.b };
      }
    }
    return null;
  };

  HUD.handleKey = function (k) {
    if (st.logOpen) {
      if (k === 'up') { st.logScroll = Math.max(0, st.logScroll - 1); S.cursor(); return null; }
      if (k === 'down') { st.logScroll = Math.min(Math.max(0, st.log.length - 6), st.logScroll + 1); S.cursor(); return null; }
      if (k === 'cancel' || k === 'confirm' || k === 'log') { HUD.toggleLog(); return null; }
      return null;
    }
    if (k === 'log') { HUD.toggleLog(); return null; }
    if (st.menu) {
      if (k === 'up') { st.menuSel = U.mod(st.menuSel - 1, st.menu.length); S.cursor(); return null; }
      if (k === 'down') { st.menuSel = U.mod(st.menuSel + 1, st.menu.length); S.cursor(); return null; }
      if (k === 'confirm') { S.select(); return { menu: st.menuSel, item: st.menu[st.menuSel] }; }
      return null;
    }
    return null;
  };

  /* ---------------- 绘制 ---------------- */
  HUD.draw = function (ctx) {
    ctx.drawImage(bgArt(), 0, 0);

    /* 顶栏 */
    F.draw(ctx, st.title || '', 6, 3, 'ui', '#ffe9a8');
    if (st.phase) F.draw(ctx, st.phase, 6 + F.width(st.title || '', 'ui') + 8, 5, 'tiny', '#93a4d8');
    if (st.lifeMax > 0 && st.showLife !== false) drawLife(ctx, 212, 6);
    // 回顾按钮
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(220, 2, 32, 16);
    ctx.strokeStyle = 'rgba(232,196,106,.5)'; ctx.lineWidth = 1;
    ctx.strokeRect(220.5, 2.5, 31, 15);
    F.center(ctx, '回顾', 236, 4, 'tiny', '#e8c46a');

    if (st.logOpen) { drawLog(ctx); return; }

    var pop = U.ease.outCubic(U.sat(st.popT / .2));

    /* 选项列表 */
    if (st.menu) {
      if (st.menuTitle) {
        ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.fillRect(10, 24, W - 20, 18);
        F.center(ctx, st.menuTitle, W / 2, 26, 'ui', '#bfd0ff');
      }
      var mr = menuRects();
      for (var i = 0; i < mr.length; i++) {
        var r = mr[i], it = st.menu[i];
        var on = i === st.menuSel;
        var dx = Math.round((1 - pop) * (i % 2 ? 22 : -22));
        drawMenuItem(ctx, r.x + dx, r.y, r.w, r.h, it, on);
      }
    } else if (st.hint) {
      // 中央提示
      var bw = Math.min(W - 30, F.width(st.hint, 'bodyS') + 24);
      ctx.fillStyle = 'rgba(0,0,0,.34)';
      ctx.fillRect(Math.round((W - bw) / 2), 74, bw, 24);
      F.center(ctx, st.hint, W / 2, 78, 'bodyS', '#cfd8f0');
    }

    /* 指令按钮 */
    var br = buttonRects();
    for (var k = 0; k < br.length; k++) {
      var q = br[k], b = q.b;
      var dy = Math.round((1 - pop) * 20);
      drawButton(ctx, q.x, q.y + dy, q.w, q.h, b.label, b.kind || 'normal',
        b.enabled !== false, st.pressed === b.id, b.sub);
      // 键盘光标
      if (!st.menu && st.rootSel === k && br.length > 1) {
        var bb = Math.sin(st.t * 7) > 0 ? 0 : 1;
        ctx.strokeStyle = '#ffe9a8'; ctx.lineWidth = 1;
        ctx.strokeRect(q.x - 1.5 - bb, q.y + dy - 1.5 - bb, q.w + 3 + bb * 2, q.h + 3 + bb * 2);
      }
    }
  };

  function drawMenuItem(ctx, x, y, w, h, it, on) {
    var dis = it.enabled === false;
    ctx.fillStyle = '#000000'; ctx.fillRect(x, y, w, h);
    var g = ctx.createLinearGradient(0, y, 0, y + h);
    if (dis) { g.addColorStop(0, '#2a3050'); g.addColorStop(1, '#161b32'); }
    else if (on) { g.addColorStop(0, '#f0dc96'); g.addColorStop(1, '#b0801f'); }
    else { g.addColorStop(0, '#2f4283'); g.addColorStop(1, '#141d42'); }
    ctx.fillStyle = g; ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
    ctx.fillStyle = on ? 'rgba(255,255,255,.6)' : 'rgba(255,255,255,.22)';
    ctx.fillRect(x + 1, y + 1, w - 2, 1);
    if (on) {
      ctx.fillStyle = '#fff6d8';
      ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y + h - 1, w, 1);
      ctx.fillRect(x, y, 1, h); ctx.fillRect(x + w - 1, y, 1, h);
    }
    var tx = x + 12;
    F.draw(ctx, it.label, tx, y + F.vcenter(h, 'ui'), 'ui',
      dis ? '#6c7698' : (on ? '#2a1e08' : '#e6ecff'));
    if (it.done) F.draw(ctx, '✓', x + w - 18, y + F.vcenter(h, 'ui'), 'ui', on ? '#4a3a10' : '#8ef08a');
    if (on) {
      var b = Math.sin(st.t * 7) > 0 ? 0 : 1;
      ctx.fillStyle = '#2a1e08';
      for (var q = 0; q < 4; q++) ctx.fillRect(x + 4 - b, y + h / 2 - 4 + q, 4 - q, 1);
    }
  }

  function drawLog(ctx) {
    ctx.fillStyle = 'rgba(4,7,16,.86)'; ctx.fillRect(0, 21, W, H - 21);
    F.center(ctx, '— 对 话 回 顾 —', W / 2, 26, 'ui', '#e8c46a');
    var y = 42;
    var start = U.clamp(st.logScroll, 0, Math.max(0, st.log.length - 6));
    for (var i = start; i < Math.min(st.log.length, start + 5); i++) {
      var e = st.log[i];
      if (e.who) {
        F.draw(ctx, e.who, 8, y, 'tiny', '#ffd964');
        F.draw(ctx, e.text, 8 + 46, y - 1, 'bodyS', '#dfe4f4', { maxw: W - 66, lh: 16 });
      } else {
        F.draw(ctx, e.text, 8, y - 1, 'bodyS', '#aab4d4', { maxw: W - 20, lh: 16 });
      }
      y += 23;
    }
    if (!st.log.length) F.center(ctx, '（还没有对话记录）', W / 2, 90, 'bodyS', '#7c86a8');
    drawButton(ctx, 72, 162, 112, 26, '关　闭', 'dark', true, false);
    // 滚动提示
    if (st.log.length > 6) {
      F.draw(ctx, '▲', 240, 40, 'tiny', start > 0 ? '#e8c46a' : '#3a4368');
      F.draw(ctx, '▼', 240, 140, 'tiny', start < st.log.length - 6 ? '#e8c46a' : '#3a4368');
    }
  }

})(window.AA);
