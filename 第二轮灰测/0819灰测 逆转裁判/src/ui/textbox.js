/* ============================================================
   textbox.js — 对话框（打字机 / 分页 / 名牌 / 内心独白样式）
   ============================================================ */
(function (AA) {
  'use strict';
  var U = AA.U, PX = AA.PX, P = AA.PAL, F = AA.FONT, S = AA.SFX;
  var TB = AA.TEXTBOX = {};

  var W = 256, H = 192;
  var BOX = { x: 3, y: 122, w: 250, h: 67 };
  var TXT = { x: 12, y: 133, w: 232, lh: 18 };

  var st = {
    visible: false, who: '', label: '', text: '', style: 'normal',
    pages: [], page: 0, n: 0, total: 0, speed: 34, waiting: false,
    finished: true, blipTick: 0, arrowT: 0, showT: 0, hideT: -1,
    onBlip: null, gender: 'm'
  };
  TB.state = st;

  /* ---------- 框体缓存 ---------- */
  var boxCache = Object.create(null);
  function boxArt(style) {
    if (boxCache[style]) return boxCache[style];
    var thought = style === 'thought';
    var narrate = style === 'narrate';
    var testify = style === 'testify';
    var cv = PX.make(BOX.w, BOX.h, function (pen) {
      var c1 = thought ? '#0a1630' : (narrate ? '#0d0d18' : (testify ? '#0a2418' : P.ui.boxTop));
      var c2 = thought ? '#050b1c' : (narrate ? '#050508' : (testify ? '#04120c' : P.ui.boxBot));
      var edge = thought ? '#8fd0ff' : (narrate ? '#c8c8d8' : (testify ? '#9ef0a8' : P.ui.boxEdge));
      var edge2 = thought ? '#2a5f9c' : (narrate ? '#4a4a5a' : (testify ? '#2e7c46' : P.ui.boxEdge2));
      // 外框
      pen.rrect(0, 0, BOX.w, BOX.h, 5, '#000000');
      pen.rrect(1, 1, BOX.w - 2, BOX.h - 2, 4, edge);
      pen.rrect(2, 2, BOX.w - 4, BOX.h - 4, 4, edge2);
      pen.rrect(3, 3, BOX.w - 6, BOX.h - 6, 3, c1);
      // 内部渐层
      pen.clipRect(3, 3, BOX.w - 6, BOX.h - 6, function (p) {
        p.vgrad(3, 3, BOX.w - 6, BOX.h - 6, c1, c2, 6);
        // 顶部一道微光
        p.rect(4, 4, BOX.w - 8, 1, U.mix(c1, edge, .30));
        // 左上斜光
        p.save(); p.alpha(.10);
        p.poly([[3, 3], [70, 3], [30, BOX.h - 3], [3, BOX.h - 3]], '#ffffff');
        p.restore();
      });
      // 四角金饰
      var g = P.ui.gold;
      [[4, 4, 1, 1], [BOX.w - 5, 4, -1, 1], [4, BOX.h - 5, 1, -1], [BOX.w - 5, BOX.h - 5, -1, -1]].forEach(function (q) {
        pen.rect(q[0], q[1], 5 * q[2], 1, g);
        pen.rect(q[0], q[1], 1, 5 * q[3], g);
      });
    }, { alphaThreshold: 40 });
    boxCache[style] = cv;
    return cv;
  }

  function nameArt(label, style) {
    var key = 'n|' + label + '|' + style;
    if (boxCache[key]) return boxCache[key];
    var tw = F.width(label, 'name');
    var w = tw + 20, h = 21;
    var cv = PX.make(w, h, function (pen) {
      var thought = style === 'thought';
      var c1 = thought ? '#123055' : P.ui.nameBg1;
      var c2 = thought ? '#081426' : P.ui.nameBg2;
      pen.rrect(0, 0, w, h, 4, '#000000');
      pen.rrect(1, 1, w - 2, h - 2, 3, P.ui.nameEdge);
      pen.rrect(2, 2, w - 4, h - 4, 3, '#39538f');
      pen.rrect(3, 3, w - 6, h - 6, 2, c1);
      pen.clipRect(3, 3, w - 6, h - 6, function (p) { p.vgrad(3, 3, w - 6, h - 6, c1, c2, 4); });
      pen.rect(4, 4, w - 8, 1, '#6f8ec8');
      F.draw(pen.c, label, 10, F.vcenter(h, 'name'), 'name', thought ? '#bfe4ff' : P.ui.nameText, { shadow: { dx: 1, dy: 1, color: '#0a1024' } });
    }, { alphaThreshold: 40 });
    boxCache[key] = cv;
    return cv;
  }

  /* ---------- 分页 ---------- */
  function paginate(text, style) {
    var lay = F.layout(text, TXT.w, style === 'narrate' ? 'body' : 'body');
    var pages = [], cur = [];
    for (var i = 0; i < lay.lines.length; i++) {
      cur.push(lay.lines[i]);
      if (cur.length === 3) { pages.push(cur); cur = []; }
    }
    if (cur.length) pages.push(cur);
    if (!pages.length) pages = [[]];
    return pages.map(function (ls) {
      var n = 0;
      for (var a = 0; a < ls.length; a++) for (var b = 0; b < ls[a].length; b++) n += ls[a][b].t.length;
      return { lines: ls, style: lay.style, total: n };
    });
  }

  /* ---------- API ---------- */
  /**
   * o: {label, style:'normal'|'thought'|'narrate', speed, instant, gender, onBlip}
   */
  TB.show = function (text, o) {
    o = o || {};
    st.visible = true;
    st.hideT = -1;
    st.label = o.label == null ? st.label : o.label;
    st.style = o.style || 'normal';
    st.gender = o.gender || 'm';
    st.pages = paginate(text, st.style);
    st.page = 0;
    st.n = o.instant ? st.pages[0].total : 0;
    st.total = st.pages[0].total;
    st.speed = o.speed || 34;
    st.finished = !!o.instant;
    st.waiting = false;
    st.blipTick = 0;
    st.showT = 0;
    st.onBlip = o.onBlip || null;
    st.raw = text;
  };
  TB.hide = function () { st.visible = false; };
  TB.isVisible = function () { return st.visible; };
  TB.typing = function () { return st.visible && !st.finished; };
  /** 全部页读完 */
  TB.complete = function () { return st.finished && st.page >= st.pages.length - 1; };
  TB.hasMorePages = function () { return st.page < st.pages.length - 1; };

  /** 确认键：先补完当前页，再翻页；返回 'typed'|'paged'|'end' */
  TB.advance = function () {
    if (!st.visible) return 'end';
    if (!st.finished) { st.n = st.total; st.finished = true; return 'typed'; }
    if (st.page < st.pages.length - 1) {
      st.page++;
      st.total = st.pages[st.page].total;
      st.n = 0; st.finished = false;
      S.page();
      return 'paged';
    }
    return 'end';
  };
  TB.skipAll = function () {
    st.page = st.pages.length - 1;
    st.total = st.pages[st.page].total;
    st.n = st.total; st.finished = true;
  };

  TB.update = function (dt) {
    if (!st.visible) return;
    st.showT += dt;
    st.arrowT += dt;
    if (!st.finished) {
      var sp = st.speed * (AA.INPUT.skipping() ? 6 : 1);
      st.n += sp * dt;
      st.blipTick += sp * dt;
      while (st.blipTick >= 2.2) {
        st.blipTick -= 2.2;
        if (!AA.INPUT.skipping()) S.blip();
      }
      if (st.n >= st.total) { st.n = st.total; st.finished = true; }
    }
  };

  /** 正在“说话”（用于角色口型动画） */
  TB.speaking = function () { return st.visible && !st.finished; };

  TB.draw = function (ctx) {
    if (!st.visible) return;
    var art = boxArt(st.style);
    var pop = U.sat(st.showT / 0.14);
    var oy = Math.round((1 - U.ease.outCubic(pop)) * 10);
    ctx.drawImage(art, BOX.x, BOX.y + oy);

    // 名牌
    if (st.label) {
      var na = nameArt(st.label, st.style);
      ctx.drawImage(na, BOX.x + 4, BOX.y - 15 + oy);
    }
    // 文本
    var pg = st.pages[st.page];
    if (pg) {
      F.drawLayout(ctx, { lines: pg.lines, style: pg.style, total: pg.total },
        TXT.x, TXT.y + oy, {
        limit: Math.floor(st.n),
        color: st.style === 'thought' ? '#bfe4ff' : (st.style === 'narrate' ? '#e8e6dc' : (st.style === 'testify' ? '#d8ffe0' : '#ffffff')),
        lh: TXT.lh,
        shadow: { dx: 1, dy: 1, color: st.style === 'thought' ? '#06122a' : (st.style === 'testify' ? '#04180c' : '#141a30') }
      });
    }
    // 继续箭头
    if (st.finished && Math.sin(st.arrowT * 6.0) > -0.2) {
      var ax = BOX.x + BOX.w - 15, ay = BOX.y + BOX.h - 13 + oy + (Math.sin(st.arrowT * 6.0) > .6 ? -1 : 0);
      ctx.fillStyle = '#0a0f22';
      ctx.fillRect(ax - 1, ay + 1, 10, 6);
      ctx.fillStyle = st.style === 'thought' ? '#8fd0ff' : '#ffd964';
      for (var i = 0; i < 5; i++) ctx.fillRect(ax + i, ay + i, 9 - i * 2, 1);
    }
  };

  TB.boxRect = function () { return BOX; };

})(window.AA);
