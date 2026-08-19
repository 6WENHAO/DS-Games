/* ============================================================
   record.js — 法庭记录（证物 / 人物档案），下屏界面
   ============================================================ */
(function (AA) {
  'use strict';
  var U = AA.U, PX = AA.PX, P = AA.PAL, F = AA.FONT, S = AA.SFX, RIG = AA.RIG;
  var RC = AA.RECORD = {};

  var W = 256, H = 192;
  var GRID = { x: 5, y: 23, cw: 60, ch: 40, gap: 2, cols: 4, rows: 2 };

  var items = [];          // {id,name,kind,desc,draw,sub}
  var tab = 'evi';         // evi | pro
  var page = 0, sel = 0;
  var open = false, mode = 'view';
  var t = 0, popT = 0;
  var iconCache = Object.create(null);
  RC.onPresent = null;
  RC.onClose = null;

  /* ---------------- 数据 ---------------- */
  RC.reset = function () { items = []; tab = 'evi'; page = 0; sel = 0; iconCache = Object.create(null); };
  RC.add = function (it) {
    if (RC.get(it.id)) return false;
    items.push(it);
    return true;
  };
  RC.get = function (id) {
    for (var i = 0; i < items.length; i++) if (items[i].id === id) return items[i];
    return null;
  };
  RC.has = function (id) { return !!RC.get(id); };
  RC.all = function () { return items.slice(); };
  RC.list = function (kind) {
    return items.filter(function (i) { return (i.kind || 'evi') === kind; });
  };
  RC.count = function (kind) { return RC.list(kind || tab).length; };

  /* ---------------- 图标 ---------------- */
  var IW = 48, IH = 26;
  function iconOf(it) {
    var key = it.id;
    if (iconCache[key]) return iconCache[key];
    var cv;
    if (it.kind === 'pro' && it.char && RIG.has(it.char)) {
      // 人物档案：裁切角色立绘的头部
      var sp = RIG.sprite(it.char, it.pose || 'normal', 0, false);
      var ctx = U.ctx(IW, IH);
      ctx.imageSmoothingEnabled = false;
      // 头部大致在 (74±26, 24..100)
      ctx.drawImage(sp, 74 - 24, 28, 48, 52, 0, -13, 48, 52);
      cv = ctx.canvas;
    } else {
      cv = PX.make(IW, IH, function (pen) {
        if (it.draw) it.draw(pen, IW, IH);
        else { pen.rrect(6, 4, IW - 12, IH - 8, 3, '#8a8f9e'); }
      }, { outline: '#241a16', alphaThreshold: 96 });
    }
    iconCache[key] = cv;
    return cv;
  }
  RC.icon = iconOf;

  /* ---------------- 界面缓存 ---------------- */
  var bgCv = null;
  function bgArt() {
    if (bgCv) return bgCv;
    bgCv = PX.make(W, H, function (pen) {
      pen.vgrad(0, 0, W, H, '#22325f', '#0d1430', 8);
      // 斜纹
      pen.save(); pen.alpha(.055);
      for (var i = -H; i < W; i += 7) pen.poly([[i, 0], [i + 3, 0], [i + 3 + H, H], [i + H, H]], '#ffffff');
      pen.restore();
      // 顶栏
      pen.rect(0, 0, W, 21, '#0a1024');
      pen.vgrad(0, 1, W, 19, '#1e2c58', '#0c1330', 4);
      pen.rect(0, 20, W, 1, '#e8c46a');
      pen.rect(0, 21, W, 1, '#000000');
      // 底栏
      pen.rect(0, 158, W, 34, '#0a1024');
      pen.vgrad(0, 159, W, 33, '#16204a', '#080c1c', 4);
      pen.rect(0, 158, W, 1, '#e8c46a');
    }, { noSnap: true });
    return bgCv;
  }

  function cellRect(i) {
    var c = i % GRID.cols, r = Math.floor(i / GRID.cols);
    return {
      x: GRID.x + c * (GRID.cw + GRID.gap),
      y: GRID.y + r * (GRID.ch + GRID.gap),
      w: GRID.cw, h: GRID.ch
    };
  }
  var PER = GRID.cols * GRID.rows;

  /* ---------------- 打开 / 关闭 ---------------- */
  RC.open = function (m, o) {
    o = o || {};
    open = true; mode = m || 'view';
    if (o.tab) tab = o.tab;
    popT = 0;
    if (o.keepSel !== true) { sel = 0; page = 0; }
    S.open();
  };
  RC.close = function () {
    if (!open) return;
    open = false; S.close();
    if (RC.onClose) RC.onClose();
  };
  RC.isOpen = function () { return open; };
  RC.mode = function () { return mode; };
  RC.selected = function () {
    var l = RC.list(tab);
    return l[page * PER + sel] || null;
  };
  RC.setTab = function (k) { if (tab !== k) { tab = k; sel = 0; page = 0; S.cursor(); } };

  /* ---------------- 输入 ---------------- */
  RC.handleKey = function (k) {
    if (!open) return false;
    var l = RC.list(tab), n = l.length;
    var maxPage = Math.max(0, Math.ceil(n / PER) - 1);
    var idx = page * PER + sel;
    if (k === 'left') {
      if (sel % GRID.cols > 0) { sel--; S.cursor(); }
      else if (page > 0) { page--; sel += GRID.cols - 1; S.page(); }
      return true;
    }
    if (k === 'right') {
      if (sel % GRID.cols < GRID.cols - 1 && page * PER + sel + 1 < n) { sel++; S.cursor(); }
      else if (page < maxPage) { page++; sel -= (GRID.cols - 1); if (sel < 0) sel = 0; S.page(); }
      return true;
    }
    if (k === 'up') {
      if (sel >= GRID.cols) { sel -= GRID.cols; S.cursor(); }
      else { RC.setTab(tab === 'evi' ? 'pro' : 'evi'); }
      return true;
    }
    if (k === 'down') {
      if (sel + GRID.cols < PER && page * PER + sel + GRID.cols < n) { sel += GRID.cols; S.cursor(); }
      else RC.setTab(tab === 'evi' ? 'pro' : 'evi');
      return true;
    }
    if (k === 'confirm') {
      if (mode === 'present') {
        var it = RC.selected();
        if (it) { S.present(); if (RC.onPresent) RC.onPresent(it); }
        else S.deny();
      } else S.select();
      return true;
    }
    if (k === 'cancel' || k === 'record') { RC.close(); return true; }
    return false;
  };

  RC.pageDelta = function (d) {
    var n = RC.list(tab).length;
    var maxPage = Math.max(0, Math.ceil(n / PER) - 1);
    var np = U.clamp(page + d, 0, maxPage);
    if (np === page) { S.deny(); return false; }
    page = np;
    if (page * PER + sel >= n) sel = Math.max(0, n - page * PER - 1);
    S.page();
    return true;
  };
  /** 直接定位到某个条目（供测试与快捷跳转） */
  RC.selectById = function (id) {
    var it = RC.get(id);
    if (!it) return false;
    tab = it.kind || 'evi';
    var l = RC.list(tab), pos = -1;
    for (var i = 0; i < l.length; i++) if (l[i].id === id) { pos = i; break; }
    if (pos < 0) return false;
    page = Math.floor(pos / PER); sel = pos % PER;
    return true;
  };

  RC.handleTap = function (x, y) {
    if (!open) return false;
    // 标签 / 翻页
    if (y < 21) {
      if (x < 66) RC.setTab('evi');
      else if (x < 132) RC.setTab('pro');
      else if (x >= 200 && x < 232) RC.pageDelta(1);
      else if (x >= 158 && x < 192) RC.pageDelta(-1);
      return true;
    }
    // 底栏按钮
    if (y >= 158) {
      if (mode === 'present' && x < 128) { RC.handleKey('confirm'); return true; }
      RC.close(); return true;
    }
    // 格子
    var l = RC.list(tab), n = l.length;
    for (var i = 0; i < PER; i++) {
      var r = cellRect(i);
      if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) {
        if (page * PER + i >= n) { S.deny(); return true; }
        if (sel === i) {
          if (mode === 'present') { S.present(); if (RC.onPresent) RC.onPresent(RC.selected()); }
          else S.select();
        } else { sel = i; S.cursor(); }
        return true;
      }
    }
    return true;
  };

  RC.update = function (dt) { t += dt; popT += dt; };

  /* ---------------- 绘制 ---------------- */
  RC.draw = function (ctx) {
    if (!open) return;
    var pop = U.ease.outCubic(U.sat(popT / .18));
    ctx.save();
    if (pop < 1) { ctx.globalAlpha = pop; ctx.translate(0, Math.round((1 - pop) * 14)); }
    ctx.drawImage(bgArt(), 0, 0);

    var l = RC.list(tab), n = l.length;
    var maxPage = Math.max(0, Math.ceil(n / PER) - 1);

    /* 顶栏：标签 */
    drawTab(ctx, 5, 3, 60, 15, '证 物', tab === 'evi');
    drawTab(ctx, 69, 3, 60, 15, '人 物', tab === 'pro');
    // 翻页控件
    ctx.fillStyle = 'rgba(0,0,0,.34)';
    ctx.fillRect(158, 3, 34, 15); ctx.fillRect(200, 3, 32, 15);
    arrow(ctx, 178, 11, -1, page > 0);
    arrow(ctx, 212, 11, 1, page < maxPage);
    F.center(ctx, (page + 1) + '/' + (maxPage + 1), 196, 5, 'uiS', '#cfd8f0');
    F.draw(ctx, mode === 'present' ? '举证' : '记录', 234, 5, 'uiS', '#ffd964');

    /* 格子 */
    for (var i = 0; i < PER; i++) {
      var r = cellRect(i), gi = page * PER + i;
      var it = l[gi];
      var on = i === sel && it;
      // 底板
      var f1 = on ? '#425fc0' : '#1b2650';
      var f2 = on ? '#1f3480' : '#0c1330';
      ctx.fillStyle = '#000000';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      var g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
      g.addColorStop(0, f1); g.addColorStop(1, f2);
      ctx.fillStyle = g;
      ctx.fillRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
      ctx.fillStyle = on ? '#ffe9a8' : '#48568c';
      ctx.fillRect(r.x + 1, r.y + 1, r.w - 2, 1);
      ctx.fillRect(r.x + 1, r.y + r.h - 2, r.w - 2, 1);
      ctx.fillRect(r.x + 1, r.y + 1, 1, r.h - 2);
      ctx.fillRect(r.x + r.w - 2, r.y + 1, 1, r.h - 2);
      if (!it) {
        F.center(ctx, '—', r.x + r.w / 2, r.y + r.h / 2 - 6, 'uiS', '#2c3a68');
        continue;
      }
      var ic = iconOf(it);
      ctx.drawImage(ic, r.x + Math.round((r.w - IW) / 2), r.y + 1);
      ctx.fillStyle = 'rgba(0,0,0,.34)';
      ctx.fillRect(r.x + 1, r.y + r.h - 15, r.w - 2, 14);
      var nm = it.short || it.name;
      F.center(ctx, nm.length > 5 ? nm.slice(0, 5) : nm, r.x + r.w / 2, r.y + r.h - 15, 'tiny', on ? '#ffffff' : '#cdd6f0');
      // 选中光标
      if (on) {
        var b = Math.sin(t * 7) > 0 ? 1 : 0;
        ctx.fillStyle = '#ffd964';
        ctx.fillRect(r.x - 1 - b, r.y - 1 - b, 5, 1); ctx.fillRect(r.x - 1 - b, r.y - 1 - b, 1, 5);
        ctx.fillRect(r.x + r.w - 4 + b, r.y - 1 - b, 5, 1); ctx.fillRect(r.x + r.w + b, r.y - 1 - b, 1, 5);
        ctx.fillRect(r.x - 1 - b, r.y + r.h + b, 5, 1); ctx.fillRect(r.x - 1 - b, r.y + r.h - 4 + b, 1, 5);
        ctx.fillRect(r.x + r.w - 4 + b, r.y + r.h + b, 5, 1); ctx.fillRect(r.x + r.w + b, r.y + r.h - 4 + b, 1, 5);
      }
    }

    /* 详情 */
    var it2 = RC.selected();
    var dy = 108, dh = 54;
    ctx.fillStyle = '#000000'; ctx.fillRect(4, dy, W - 8, dh);
    var pg = ctx.createLinearGradient(0, dy, 0, dy + dh);
    pg.addColorStop(0, '#f4eeda'); pg.addColorStop(1, '#ddd4b8');
    ctx.fillStyle = pg; ctx.fillRect(5, dy + 1, W - 10, dh - 2);
    ctx.fillStyle = '#fffaf0'; ctx.fillRect(5, dy + 1, W - 10, 1);
    ctx.fillStyle = '#b3a988'; ctx.fillRect(5, dy + dh - 2, W - 10, 1);
    if (it2) {
      F.draw(ctx, it2.name, 10, dy + 1, 'ui', '#2a2418');
      if (it2.sub) F.draw(ctx, it2.sub, 10 + F.width(it2.name, 'ui') + 8, dy + 4, 'tiny', '#7a6a48');
      F.draw(ctx, it2.desc || '', 10, dy + 19, 'bodyS', '#3a3226', { maxw: W - 22, lh: 17 });
    } else {
      F.center(ctx, '（尚未取得任何' + (tab === 'evi' ? '证物' : '资料') + '）', W / 2, dy + 19, 'bodyS', '#8a8068');
    }

    /* 底栏按钮 */
    if (mode === 'present') {
      button(ctx, 8, 165, 112, 24, '出　示', true);
      button(ctx, 136, 165, 112, 24, '返　回', false);
    } else {
      button(ctx, 72, 165, 112, 24, '关　闭', false);
    }
    ctx.restore();
  };

  function drawTab(ctx, x, y, w, h, label, on) {
    ctx.fillStyle = '#000000'; ctx.fillRect(x, y, w, h);
    var g = ctx.createLinearGradient(0, y, 0, y + h);
    if (on) { g.addColorStop(0, '#f0d98a'); g.addColorStop(1, '#a87c22'); }
    else { g.addColorStop(0, '#33437a'); g.addColorStop(1, '#141c40'); }
    ctx.fillStyle = g; ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
    ctx.fillStyle = on ? '#fff6d8' : '#4a5a94';
    ctx.fillRect(x + 1, y + 1, w - 2, 1);
    F.center(ctx, label, x + w / 2, y + F.vcenter(h, 'uiS'), 'uiS', on ? '#2a1e08' : '#c8d2ee');
  }

  function button(ctx, x, y, w, h, label, hot) {
    ctx.fillStyle = '#000000'; ctx.fillRect(x, y, w, h);
    var g = ctx.createLinearGradient(0, y, 0, y + h);
    if (hot) { g.addColorStop(0, P.ui.btnHotFace1); g.addColorStop(1, P.ui.btnHotFace2); }
    else { g.addColorStop(0, P.ui.btnFace1); g.addColorStop(1, P.ui.btnFace2); }
    ctx.fillStyle = g; ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
    ctx.fillStyle = hot ? '#ffd2c8' : '#dce6ff';
    ctx.fillRect(x + 1, y + 1, w - 2, 1);
    ctx.fillStyle = 'rgba(0,0,0,.45)';
    ctx.fillRect(x + 1, y + h - 3, w - 2, 2);
    F.center(ctx, label, x + w / 2, y + F.vcenter(h, 'ui'), 'ui', '#ffffff');
  }
  RC.button = button;

  function arrow(ctx, x, y, dir, on) {
    ctx.fillStyle = on ? '#ffd964' : '#3c4670';
    for (var i = 0; i < 5; i++) {
      ctx.fillRect(x + (dir > 0 ? i : -i), y - (4 - i), 1, (4 - i) * 2 + 1);
    }
  }
  RC.arrow = arrow;

})(window.AA);
