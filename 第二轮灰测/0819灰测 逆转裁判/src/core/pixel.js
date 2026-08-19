/* ============================================================
   pixel.js — 像素画引擎
   思路：用矢量图形（贝塞尔/多边形）在低分辨率画布上作画，
         然后强制「颜色吸附 + Alpha 阈值化」把抗锯齿抹掉，
         再由 Alpha 边缘检测生成 1px 描边。
         → 得到真正硬边的像素画，同时保留手绘的造型自由度。
   ============================================================ */
(function (AA) {
  'use strict';
  var U = AA.U, P = AA.PAL;
  var PX = AA.PX = {};

  /* ================= 平滑闭合曲线（Catmull-Rom → 三次贝塞尔） ================= */
  function pathCurve(ctx, pts, closed, tension) {
    var n = pts.length;
    if (n < 2) return;
    if (n === 2) { ctx.moveTo(pts[0][0], pts[0][1]); ctx.lineTo(pts[1][0], pts[1][1]); return; }
    var t = tension == null ? 1 : tension;
    var get = closed
      ? function (i) { return pts[U.mod(i, n)]; }
      : function (i) { return pts[U.clamp(i, 0, n - 1)]; };
    ctx.moveTo(pts[0][0], pts[0][1]);
    var last = closed ? n : n - 1;
    for (var i = 0; i < last; i++) {
      var p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
      var c1x = p1[0] + (p2[0] - p0[0]) / 6 * t, c1y = p1[1] + (p2[1] - p0[1]) / 6 * t;
      var c2x = p2[0] - (p3[0] - p1[0]) / 6 * t, c2y = p2[1] - (p3[1] - p1[1]) / 6 * t;
      ctx.bezierCurveTo(c1x, c1y, c2x, c2y, p2[0], p2[1]);
    }
    if (closed) ctx.closePath();
  }
  PX.pathCurve = pathCurve;

  function pathPoly(ctx, pts, closed) {
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    if (closed !== false) ctx.closePath();
  }

  /* ================= 画笔 ================= */
  function Pen(ctx) {
    this.c = ctx;
    this.colors = Object.create(null);   // 使用过的颜色集合（量化调色板）
    this.ox = 0; this.oy = 0;
    this.sx = 1; this.sy = 1;
  }
  Pen.prototype.use = function (col) {
    if (col && col.charAt(0) === '#') this.colors[col.toLowerCase()] = 1;
    return col;
  };
  Pen.prototype.addPalette = function (cols) {
    for (var i = 0; i < cols.length; i++) this.use(cols[i]);
    return this;
  };
  Pen.prototype.save = function () { this.c.save(); return this; };
  Pen.prototype.restore = function () { this.c.restore(); return this; };
  Pen.prototype.translate = function (x, y) { this.c.translate(x, y); return this; };
  Pen.prototype.scale = function (x, y) { this.c.scale(x, y == null ? x : y); return this; };
  Pen.prototype.rotate = function (a) { this.c.rotate(a); return this; };
  Pen.prototype.alpha = function (a) { this.c.globalAlpha = a; return this; };

  /* --- 填充图形 --- */
  Pen.prototype.poly = function (pts, col) {
    var c = this.c; c.beginPath(); pathPoly(c, pts); c.fillStyle = this.use(col); c.fill(); return this;
  };
  Pen.prototype.blob = function (pts, col, tension) {
    var c = this.c; c.beginPath(); pathCurve(c, pts, true, tension); c.fillStyle = this.use(col); c.fill(); return this;
  };
  Pen.prototype.rect = function (x, y, w, h, col) {
    var c = this.c; c.fillStyle = this.use(col); c.fillRect(x, y, w, h); return this;
  };
  Pen.prototype.ellipse = function (x, y, rx, ry, col, rot) {
    var c = this.c; c.beginPath(); c.ellipse(x, y, Math.max(.4, rx), Math.max(.4, ry), rot || 0, 0, 6.2832);
    c.fillStyle = this.use(col); c.fill(); return this;
  };
  Pen.prototype.circle = function (x, y, r, col) { return this.ellipse(x, y, r, r, col); };
  /* 圆角矩形 */
  Pen.prototype.rrect = function (x, y, w, h, r, col) {
    var c = this.c; r = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r);
    c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r);
    c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y);
    c.closePath(); c.fillStyle = this.use(col); c.fill(); return this;
  };

  /* --- 线条 --- */
  Pen.prototype.line = function (pts, col, w, smooth, closed) {
    var c = this.c; c.beginPath();
    if (smooth) pathCurve(c, pts, !!closed, 1); else pathPoly(c, pts, !!closed);
    c.strokeStyle = this.use(col); c.lineWidth = w || 1;
    c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke(); return this;
  };
  Pen.prototype.strokeShape = function (pts, col, w, smooth) {
    return this.line(pts, col, w, smooth, true);
  };

  /* --- 在形状内做明暗（赛璐璐分层） --- */
  Pen.prototype.clipBlob = function (pts, fn, tension) {
    var c = this.c; c.save(); c.beginPath(); pathCurve(c, pts, true, tension); c.clip(); fn(this); c.restore(); return this;
  };
  Pen.prototype.clipPoly = function (pts, fn) {
    var c = this.c; c.save(); c.beginPath(); pathPoly(c, pts); c.clip(); fn(this); c.restore(); return this;
  };
  Pen.prototype.clipRect = function (x, y, w, h, fn) {
    var c = this.c; c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip(); fn(this); c.restore(); return this;
  };

  /* 在图形上加一条斜向高光带 */
  Pen.prototype.sheen = function (pts, col, x0, y0, x1, y1, width) {
    var self = this;
    this.clipBlob(pts, function (p) {
      p.save();
      var c = p.c;
      c.lineWidth = width || 3; c.strokeStyle = self.use(col); c.lineCap = 'round';
      c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
      p.restore();
    });
    return this;
  };

  /* 尖刺（成步堂的头发！） */
  Pen.prototype.spike = function (x, y, len, ang, baseW, col, bend) {
    bend = bend || 0;
    var dx = Math.cos(ang), dy = Math.sin(ang);
    var nx = -dy, ny = dx;
    var tipx = x + dx * len + nx * bend, tipy = y + dy * len + ny * bend;
    var midx = x + dx * len * .5 + nx * (bend * .35 + baseW * .1);
    var midy = y + dy * len * .5 + ny * (bend * .35 + baseW * .1);
    var c = this.c;
    c.beginPath();
    c.moveTo(x + nx * baseW / 2, y + ny * baseW / 2);
    c.quadraticCurveTo(midx + nx * baseW * .28, midy + ny * baseW * .28, tipx, tipy);
    c.quadraticCurveTo(midx - nx * baseW * .28, midy - ny * baseW * .28, x - nx * baseW / 2, y - ny * baseW / 2);
    c.closePath();
    c.fillStyle = this.use(col); c.fill();
    return this;
  };

  /* 一条锥形带（袖子、领带、头发束） */
  Pen.prototype.taper = function (pts, w0, w1, col, tension) {
    var n = pts.length, left = [], right = [];
    for (var i = 0; i < n; i++) {
      var a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      var dx = b[0] - a[0], dy = b[1] - a[1], l = Math.max(.001, Math.hypot(dx, dy));
      var nx = -dy / l, ny = dx / l;
      var w = U.lerp(w0, w1, n === 1 ? 0 : i / (n - 1)) / 2;
      left.push([pts[i][0] + nx * w, pts[i][1] + ny * w]);
      right.unshift([pts[i][0] - nx * w, pts[i][1] - ny * w]);
    }
    var c = this.c; c.beginPath();
    pathCurve(c, left.concat(right), true, tension == null ? .9 : tension);
    c.fillStyle = this.use(col); c.fill();
    return this;
  };

  /* 有序抖动（Bayer 4x4）填充，用于渐变过渡 —— 很有 NDS 味 */
  var BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  Pen.prototype.dither = function (x, y, w, h, colA, colB, t) {
    var c = this.c; this.use(colA); this.use(colB);
    for (var j = 0; j < h; j++) for (var i = 0; i < w; i++) {
      var th = (BAYER4[(j & 3) * 4 + (i & 3)] + .5) / 16;
      c.fillStyle = t > th ? colB : colA;
      c.fillRect(x + i, y + j, 1, 1);
    }
    return this;
  };
  PX.BAYER4 = BAYER4;

  /* 垂直抖动渐变（背景幕布之类） */
  Pen.prototype.vgrad = function (x, y, w, h, colTop, colBot, steps) {
    steps = steps || 6;
    for (var s = 0; s < steps; s++) {
      var t = steps === 1 ? 0 : s / (steps - 1);
      var yy = Math.round(y + h * s / steps), hh = Math.round(y + h * (s + 1) / steps) - yy;
      this.rect(x, yy, w, hh, U.mix(colTop, colBot, t));
    }
    return this;
  };

  /* ================= 像素化（核心） ================= */
  function paletteArray(colorMap, extra) {
    var list = [];
    for (var k in colorMap) list.push(U.hex2rgb(k));
    if (extra) for (var i = 0; i < extra.length; i++) list.push(U.hex2rgb(extra[i]));
    return list;
  }

  /**
   * 把画布内容吸附到给定调色板，并硬化 Alpha。
   * @param ctx 目标 2D 上下文
   * @param pal [[r,g,b],...]
   * @param opt {alphaThreshold, keepAlpha}
   */
  function snap(ctx, pal, opt) {
    opt = opt || {};
    var th = opt.alphaThreshold == null ? 110 : opt.alphaThreshold;
    var w = ctx.canvas.width, h = ctx.canvas.height;
    if (!w || !h || !pal.length) return;
    var img = ctx.getImageData(0, 0, w, h), d = img.data;
    var cache = new Map();
    for (var i = 0; i < d.length; i += 4) {
      if (d[i + 3] < th) { d[i + 3] = 0; d[i] = d[i + 1] = d[i + 2] = 0; continue; }
      d[i + 3] = 255;
      var key = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
      var got = cache.get(key);
      if (got === undefined) {
        var best = 0, bd = 1e12;
        for (var p = 0; p < pal.length; p++) {
          var c = pal[p];
          var dr = c[0] - d[i], dg = c[1] - d[i + 1], db = c[2] - d[i + 2];
          // 亮度差 + 色度差（后者权重高，避免“灰调混色”被吸到饱和的中间色去，
          // 例如头发与皮肤的过渡色被误吸成西装的蓝）
          var lum = dr * dr * 0.30 + dg * dg * 0.59 + db * db * 0.11;
          var c1 = dr - dg, c2 = dg - db;
          var chroma = c1 * c1 + c2 * c2;
          var dd = lum * 0.55 + chroma * 0.30;
          if (dd < bd) { bd = dd; best = p; }
        }
        got = best; cache.set(key, got);
      }
      var pc = pal[got];
      d[i] = pc[0]; d[i + 1] = pc[1]; d[i + 2] = pc[2];
    }
    ctx.putImageData(img, 0, 0);
  }
  PX.snap = snap;

  /** 由 Alpha 边缘生成外描边（向外扩 1px） */
  function silhouette(ctx, col, thick) {
    thick = thick || 1;
    var w = ctx.canvas.width, h = ctx.canvas.height;
    var rgb = U.hex2rgb(col);
    for (var pass = 0; pass < thick; pass++) {
      var img = ctx.getImageData(0, 0, w, h), d = img.data;
      var add = [];
      for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
        var i = (y * w + x) * 4;
        if (d[i + 3] !== 0) continue;
        var hit = false;
        if (x > 0 && d[i - 4 + 3] === 255) hit = true;
        else if (x < w - 1 && d[i + 4 + 3] === 255) hit = true;
        else if (y > 0 && d[i - w * 4 + 3] === 255) hit = true;
        else if (y < h - 1 && d[i + w * 4 + 3] === 255) hit = true;
        if (hit) add.push(i);
      }
      for (var k = 0; k < add.length; k++) {
        var j = add[k];
        d[j] = rgb[0]; d[j + 1] = rgb[1]; d[j + 2] = rgb[2]; d[j + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
    }
  }
  PX.silhouette = silhouette;

  /** 内部深色线的“加深”：在颜色相邻处不处理，仅提供工具 */
  PX.dropShadow = function (ctx, col, dx, dy, alpha) {
    var w = ctx.canvas.width, h = ctx.canvas.height;
    var tmp = U.ctx(w, h);
    tmp.drawImage(ctx.canvas, 0, 0);
    ctx.save();
    ctx.globalCompositeOperation = 'destination-over';
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.drawImage(tmp.canvas, dx, dy);
    ctx.restore();
  };

  /**
   * 主入口：绘制一张像素精灵
   * opts: {outline, outlineW, alphaThreshold, palette:[extra colors], noSnap}
   */
  PX.make = function (w, h, drawFn, opts) {
    opts = opts || {};
    var ctx = U.ctx(w, h);
    var pen = new Pen(ctx);
    if (opts.palette) pen.addPalette(opts.palette);
    drawFn(pen, ctx);
    if (!opts.noSnap) {
      var pal = paletteArray(pen.colors, opts.outline ? [opts.outline] : null);
      snap(ctx, pal, opts);
    }
    if (opts.outline) silhouette(ctx, opts.outline, opts.outlineW || 1);
    return ctx.canvas;
  };
  PX.Pen = Pen;
  PX.pen = function (ctx) { return new Pen(ctx); };

  /* ================= 缓存 ================= */
  var cache = Object.create(null);
  PX.cached = function (key, w, h, drawFn, opts) {
    var c = cache[key];
    if (!c) c = cache[key] = PX.make(w, h, drawFn, opts);
    return c;
  };
  PX.clearCache = function () { cache = Object.create(null); };

  /* ================= 贴图 ================= */
  PX.blit = function (ctx, cv, x, y, o) {
    if (!cv) return;
    o = o || {};
    var sx = o.flip ? -1 : 1;
    x = Math.round(x); y = Math.round(y);
    if (o.alpha != null && o.alpha < 1) { ctx.save(); ctx.globalAlpha = o.alpha; }
    if (sx < 0) {
      ctx.save(); ctx.translate(x + cv.width, y); ctx.scale(-1, 1);
      ctx.drawImage(cv, 0, 0); ctx.restore();
    } else {
      ctx.drawImage(cv, x, y);
    }
    if (o.alpha != null && o.alpha < 1) ctx.restore();
  };

  /** 生成染色版本（受伤闪红 / 剪影 / 白闪） */
  var tintCache = new Map();
  PX.tinted = function (cv, col, amt, mode) {
    var key = cv.__id || (cv.__id = 'c' + (tintCache.size + Math.random()));
    var k = key + '|' + col + '|' + amt + '|' + (mode || 'm');
    var got = tintCache.get(k);
    if (got) return got;
    var ctx = U.ctx(cv.width, cv.height);
    ctx.drawImage(cv, 0, 0);
    ctx.globalCompositeOperation = mode === 'flat' ? 'source-atop' : 'source-atop';
    ctx.globalAlpha = amt;
    ctx.fillStyle = col;
    ctx.fillRect(0, 0, cv.width, cv.height);
    if (tintCache.size > 260) tintCache.clear();
    tintCache.set(k, ctx.canvas);
    return ctx.canvas;
  };

  /** 纯色剪影（用于登场黑影、闪电剪影） */
  PX.silo = function (cv, col) { return PX.tinted(cv, col, 1); };

  /** 生成一个软阴影椭圆（地面投影） */
  PX.groundShadow = function (w, h, col, steps) {
    steps = steps || 3;
    return PX.cached('gsh' + w + '_' + h + '_' + col + steps, w, h, function (p) {
      for (var i = 0; i < steps; i++) {
        var t = i / steps;
        p.ellipse(w / 2, h / 2, w / 2 * (1 - t * .34), h / 2 * (1 - t * .34), U.mix(col, '#000000', t * .35));
      }
    }, { noSnap: false });
  };

  /* ================= 位图字形辅助：把任意区域硬化 ================= */
  PX.harden = function (ctx, th) {
    var w = ctx.canvas.width, h = ctx.canvas.height;
    var img = ctx.getImageData(0, 0, w, h), d = img.data;
    th = th == null ? 110 : th;
    for (var i = 0; i < d.length; i += 4) d[i + 3] = d[i + 3] < th ? 0 : 255;
    ctx.putImageData(img, 0, 0);
  };

  /** 15bit 量化整块画布（用于最终屏幕的 2D 回退路径） */
  PX.q15canvas = function (ctx) {
    var w = ctx.canvas.width, h = ctx.canvas.height;
    var img = ctx.getImageData(0, 0, w, h), d = img.data;
    for (var i = 0; i < d.length; i += 4) {
      d[i] = (d[i] & 248) | (d[i] >> 5);
      d[i + 1] = (d[i + 1] & 248) | (d[i + 1] >> 5);
      d[i + 2] = (d[i + 2] & 248) | (d[i + 2] >> 5);
    }
    ctx.putImageData(img, 0, 0);
  };

})(window.AA);
