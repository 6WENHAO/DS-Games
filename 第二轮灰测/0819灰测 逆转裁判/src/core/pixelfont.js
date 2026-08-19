/* ============================================================
   pixelfont.js — 位图字体引擎
   把系统字体在目标像素尺寸下渲染后做 Alpha 阈值化，
   得到硬边的点阵字形并缓存；支持内联颜色标记与打字机。
   标记语法： [r]红[/]  [b]蓝[/]  [g]金[/]  [c]青[/]  [e]绿[/]
   ============================================================ */
(function (AA) {
  'use strict';
  var U = AA.U, PX = AA.PX;
  var F = AA.FONT = {};

  var STACK_GOTHIC = '"Zpix","Silkscreen","SimHei","Microsoft YaHei","Noto Sans SC","PingFang SC","Hiragino Sans GB",sans-serif';
  var STACK_MINCHO = '"Yu Mincho","SimSun","Songti SC","Noto Serif SC",serif';

  var styles = F.styles = {};

  F.define = function (name, o) {
    var st = {
      name: name,
      family: o.family || STACK_GOTHIC,
      size: o.size || 12,
      weight: o.weight || 400,
      cell: o.cell || (o.size + 3),
      lh: o.lh || (o.size + 4),
      base: o.base == null ? 0 : o.base,      // 基线微调（像素）
      th: o.th == null ? 100 : o.th,          // alpha 阈值
      bold: o.bold || 0,                      // 加粗量 0..1.2（像素级描边）
      track: o.track || 0,                    // 字距
      shadow: o.shadow || null,               // {dx,dy,color}
      italic: o.italic || false,
      cache: Object.create(null),
      wcache: Object.create(null)
    };
    st.font = (st.italic ? 'italic ' : '') + st.weight + ' ' + st.size + 'px ' + st.family;
    styles[name] = st;
    return st;
  };

  /* ---------- 预设 ----------
     CJK 在低分辨率下最怕「粗」：无论是 weight 还是多次偏移叠加，
     都会让笔画粘连成一团。实测（tests/font.html 的 SWEEP / EVAL）：
       12px weight500 bold.55 → 每行笔画段数 1.29（糊）
       12px weight600 bold0   → 1.17（更糊，weight 才是主因）
       13px weight400 bold0   → 1.80（可读，但「啊/播」等密字仍成实心块）
       14px weight400 bold0   → 2.02（密字也能看出内部结构）
     所以：一律 weight 400 + bold 0，靠字号换清晰度，靠 1px 暗影换对比。 */
  F.define('body', { size: 14, cell: 18, lh: 18, weight: 400, th: 114, bold: 0, track: 0 });
  F.define('bodyS', { size: 13, cell: 17, lh: 16, weight: 400, th: 110, bold: 0 });
  F.define('name', { size: 14, cell: 18, lh: 18, weight: 400, th: 110, bold: 0 });
  F.define('ui', { size: 13, cell: 17, lh: 16, weight: 400, th: 108, bold: 0 });
  F.define('uiS', { size: 12, cell: 16, lh: 14, weight: 400, th: 110, bold: 0 });
  F.define('tiny', { size: 11, cell: 14, lh: 13, weight: 400, th: 112, bold: 0 });
  F.define('big', { size: 18, cell: 23, lh: 23, weight: 500, th: 102, bold: 0 });
  F.define('huge', { size: 27, cell: 33, lh: 33, weight: 600, th: 98, bold: .2 });
  F.define('serif', { size: 14, cell: 18, lh: 18, weight: 400, th: 104, bold: 0, family: STACK_MINCHO });
  F.define('serifBig', { size: 23, cell: 29, lh: 29, weight: 600, th: 100, bold: .15, family: STACK_MINCHO });

  /* ---------- 测量 ---------- */
  var mctx = U.ctx(8, 8);
  function advance(ch, st) {
    var w = st.wcache[ch];
    if (w === undefined) {
      mctx.font = st.font;
      w = Math.ceil(mctx.measureText(ch).width);
      if (w <= 0) w = Math.ceil(st.size / 2);
      st.wcache[ch] = w;
    }
    return w;
  }
  F.advance = function (ch, style) { return advance(ch, styles[style] || styles.body) + (styles[style] || styles.body).track; };

  /* ---------- 字形位图 ---------- */
  function glyph(ch, st, color) {
    var byColor = st.cache[color];
    if (!byColor) byColor = st.cache[color] = Object.create(null);
    var g = byColor[ch];
    if (g) return g;

    var aw = advance(ch, st);
    var pad = 2;
    var ctx = U.ctx(aw + pad * 2, st.cell + pad * 2);
    ctx.font = st.font;
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#ffffff';
    var bx = pad, by = pad + st.size + st.base;
    // 加粗：多次微偏移叠加，再阈值化 → 得到 1px 级别的实心笔画
    var b = st.bold;
    if (b > 0) {
      var offs = [[0, 0], [b * .55, 0], [0, b * .55], [-b * .35, 0], [0, -b * .3], [b * .4, b * .4]];
      for (var i = 0; i < offs.length; i++) ctx.fillText(ch, bx + offs[i][0], by + offs[i][1]);
    } else {
      ctx.fillText(ch, bx, by);
    }
    PX.harden(ctx, st.th);
    // 上色
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.globalCompositeOperation = 'source-over';

    g = { cv: ctx.canvas, w: aw, ox: -pad, oy: -pad };
    byColor[ch] = g;
    return g;
  }
  F.glyph = glyph;

  /* ---------- 颜色标记解析 ---------- */
  var TAGCOL = {
    r: '#ff6a6a', R: '#ff2f3a', b: '#7fd4ff', g: '#ffd964',
    c: '#9ad8ff', e: '#8ef08a', w: '#ffffff', k: '#9aa4c4', p: '#e2a8ff', o: '#ffab5e'
  };
  F.tagColor = TAGCOL;

  /**
   * "普通[r]关键词[/]普通" → [{t:'普通',c:null},{t:'关键词',c:'#ff6a6a'},...]
   * 同时支持 [w:xx] 等待、[!] 停顿标记（由文本框处理）；这里保留为控制字符。
   */
  F.parse = function (text, baseColor) {
    var segs = [], cur = '', col = baseColor || null, stack = [];
    for (var i = 0; i < text.length; i++) {
      if (text[i] === '[') {
        var e = text.indexOf(']', i);
        if (e > i) {
          var tag = text.slice(i + 1, e);
          if (tag === '/') {
            if (cur) { segs.push({ t: cur, c: col }); cur = ''; }
            col = stack.pop() || baseColor || null;
            i = e; continue;
          }
          if (TAGCOL[tag]) {
            if (cur) { segs.push({ t: cur, c: col }); cur = ''; }
            stack.push(col); col = TAGCOL[tag];
            i = e; continue;
          }
          if (tag[0] === '#') {
            if (cur) { segs.push({ t: cur, c: col }); cur = ''; }
            stack.push(col); col = tag;
            i = e; continue;
          }
        }
      }
      cur += text[i];
    }
    if (cur) segs.push({ t: cur, c: col });
    return segs;
  };

  /** 去掉标记后的纯文本长度（打字机计数用） */
  F.plain = function (text) {
    var segs = F.parse(text), s = '';
    for (var i = 0; i < segs.length; i++) s += segs[i].t;
    return s;
  };

  /* ---------- 排版 ---------- */
  /**
   * 把带标记文本排成行。每行是 [{t,c}] 片段数组。
   * 返回 {lines:[...], total:纯文本字符数}
   */
  F.layout = function (text, maxw, style, baseColor) {
    var st = styles[style] || styles.body;
    var segs = F.parse(text, baseColor);
    var lines = [[]], curw = 0, total = 0;
    var noHead = '，。、；：？！）】》」』”・…,.!?:;)]}>';
    function push(ch, c) {
      var line = lines[lines.length - 1];
      var last = line[line.length - 1];
      if (last && last.c === c) last.t += ch; else line.push({ t: ch, c: c });
    }
    for (var s = 0; s < segs.length; s++) {
      var seg = segs[s];
      for (var i = 0; i < seg.t.length; i++) {
        var ch = seg.t[i];
        total++;
        if (ch === '\n') { lines.push([]); curw = 0; continue; }
        var w = advance(ch, st) + st.track;
        if (curw + w > maxw) {
          // 行首禁则：把上一个字符挪到下一行
          var line = lines[lines.length - 1];
          if (noHead.indexOf(ch) >= 0 && line.length) {
            var lastSeg = line[line.length - 1];
            if (lastSeg.t.length > 1 || line.length > 1) {
              var moved = lastSeg.t[lastSeg.t.length - 1], mc = lastSeg.c;
              lastSeg.t = lastSeg.t.slice(0, -1);
              if (!lastSeg.t) line.pop();
              lines.push([{ t: moved, c: mc }]);
              curw = advance(moved, st) + st.track;
              push(ch, seg.c); curw += w; continue;
            }
          }
          lines.push([]); curw = 0;
        }
        push(ch, seg.c); curw += w;
      }
    }
    return { lines: lines, total: total, style: st };
  };

  /** 绘制已排版文本；limit = 显示的字符数（打字机），返回实际绘制字符数 */
  F.drawLayout = function (ctx, lay, x, y, opt) {
    opt = opt || {};
    var st = lay.style, lh = opt.lh || st.lh;
    var limit = opt.limit == null ? Infinity : opt.limit;
    var base = opt.color || '#ffffff';
    var shadow = opt.shadow;   // {dx,dy,color}
    var n = 0, lastX = x, lastY = y;
    for (var li = 0; li < lay.lines.length; li++) {
      var line = lay.lines[li], cx = x, cy = y + li * lh;
      if (opt.align === 'center' || opt.align === 'right') {
        var lw = 0;
        for (var q = 0; q < line.length; q++) for (var qq = 0; qq < line[q].t.length; qq++) lw += advance(line[q].t[qq], st) + st.track;
        cx = opt.align === 'center' ? Math.round(x - lw / 2) : Math.round(x - lw);
      }
      for (var si = 0; si < line.length; si++) {
        var seg = line[si], col = seg.c || base;
        for (var i = 0; i < seg.t.length; i++) {
          if (n >= limit) return { n: n, x: lastX, y: lastY, line: li };
          var ch = seg.t[i];
          if (ch !== ' ' && ch !== '\u3000') {
            if (shadow) {
              var gs = glyph(ch, st, shadow.color);
              ctx.drawImage(gs.cv, cx + gs.ox + shadow.dx, cy + gs.oy + shadow.dy);
            }
            var g = glyph(ch, st, col);
            ctx.drawImage(g.cv, cx + g.ox, cy + g.oy);
          }
          lastX = cx; lastY = cy;
          cx += advance(ch, st) + st.track;
          n++;
        }
      }
    }
    return { n: n, x: lastX, y: lastY, line: lay.lines.length - 1 };
  };

  /** 一行文字快捷绘制 */
  F.draw = function (ctx, text, x, y, style, color, opt) {
    opt = opt || {};
    var lay = F.layout(text, opt.maxw || 9999, style, color);
    opt.color = color;
    return F.drawLayout(ctx, lay, x, y, opt);
  };

  F.width = function (text, style) {
    var st = styles[style] || styles.body;
    var t = F.plain(text), w = 0;
    for (var i = 0; i < t.length; i++) w += advance(t[i], st) + st.track;
    return w;
  };

  /** 在高度 h 的框内垂直居中某个字号，返回绘制用的 y 偏移 */
  F.vcenter = function (h, style) {
    var st = styles[style] || styles.body;
    return Math.max(0, Math.round((h - st.cell) / 2));
  };
  F.cell = function (style) { return (styles[style] || styles.body).cell; };

  /** 居中绘制 */
  F.center = function (ctx, text, cx, y, style, color, opt) {
    opt = opt || {}; opt.align = 'center';
    return F.draw(ctx, text, cx, y, style, color, opt);
  };

  /** 带描边的醒目文字（用于「異議あり！」等） */
  F.outlined = function (ctx, text, x, y, style, fill, edge, ew) {
    ew = ew || 1;
    var st = styles[style] || styles.body;
    var t = F.plain(text);
    for (var dy = -ew; dy <= ew; dy++) for (var dx = -ew; dx <= ew; dx++) {
      if (!dx && !dy) continue;
      var cx = x;
      for (var i = 0; i < t.length; i++) {
        var g = glyph(t[i], st, edge);
        ctx.drawImage(g.cv, cx + g.ox + dx, y + g.oy + dy);
        cx += advance(t[i], st) + st.track;
      }
    }
    var cx2 = x;
    for (var j = 0; j < t.length; j++) {
      var g2 = glyph(t[j], st, fill);
      ctx.drawImage(g2.cv, cx2 + g2.ox, y + g2.oy);
      cx2 += advance(t[j], st) + st.track;
    }
    return F.width(text, style);
  };

  F.clearCache = function () {
    for (var k in styles) { styles[k].cache = Object.create(null); styles[k].wcache = Object.create(null); }
  };

})(window.AA);
