/* ============================================================
   rig.js — 角色骨架与表情系统
   ・精灵画布 148×216，脚底基线 y=210，标准身高 200px（= 200 世界单位）
   ・角色只写一份 draw(pen, s)，姿势 = 一组状态参数 → 可组合、可插值
   ・每帧结果按 (角色|姿势|帧|说话) 缓存为硬边像素图
   ============================================================ */
(function (AA) {
  'use strict';
  var U = AA.U, PX = AA.PX, P = AA.PAL;
  var RIG = AA.RIG = {};

  var W = RIG.W = 148, H = RIG.H = 232, GROUND = RIG.GROUND = 222;
  var D = Math.PI / 180;

  var chars = Object.create(null);

  /* ============ 定义角色 ============ */
  /**
   * def: {
   *   outline:'#241a16', gender:'m'|'f',
   *   draw: function(pen, s),
   *   poses: { normal: function(f, talk){ return state } , ... },
   *   frames: {normal:2, ...}   // 每个姿势的循环帧数（默认 2）
   * }
   */
  RIG.define = function (name, def) {
    def.name = name;
    def.frames = def.frames || {};
    chars[name] = def;
    return def;
  };
  RIG.get = function (name) { return chars[name]; };
  RIG.list = function () { return Object.keys(chars); };
  RIG.has = function (name) { return !!chars[name]; };

  /* ============ 基础状态 ============
     手部用「相对肩点的偏移」表示，配合两骨 IK 求肘 —— 摆姿势时直观得多。
     hL / hR = [dx, dy]（画布像素；dy 向下为正）
     kindL / kindR = 'fist' | 'open' | 'point'，angL/angR = 手指朝向（弧度）
  */
  RIG.base = function (o) {
    return Object.assign({
      bob: 0, lean: 0, twist: 0, sink: 0,
      headX: 0, headY: 0, headTilt: 0, headTurn: 0,
      eyes: 'normal', brow: 'normal', mouth: 'closed', pupil: [0, 0],
      hL: [-7, 60], hR: [7, 60],
      kindL: 'fist', kindR: 'fist', angL: null, angR: null,
      legL: 0, legR: 0, stance: 0,
      sweat: 0, sweatY: 0, blush: 0,
      symbol: null, symbolX: 0, symbolCol: null,
      fx: null
    }, o || {});
  };

  /* ============ 通用绘图辅助 ============ */

  /** 内部墨线 */
  function ink(pen, pts, w, col, smooth) {
    pen.line(pts, col || P.line, w == null ? 1.4 : w, smooth !== false);
  }
  RIG.ink = ink;

  /** 两骨 IK：求肘位置 */
  RIG.ik = function (sx, sy, tx, ty, l1, l2, bend) {
    var dx = tx - sx, dy = ty - sy;
    var d = Math.sqrt(dx * dx + dy * dy) || 0.001;
    var maxd = l1 + l2 - 0.6, mind = Math.abs(l1 - l2) + 0.6;
    var dd = U.clamp(d, mind, maxd);
    if (dd !== d) { dx *= dd / d; dy *= dd / d; d = dd; tx = sx + dx; ty = sy + dy; }
    var a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
    var hh = Math.sqrt(Math.max(0, l1 * l1 - a * a));
    var ux = dx / d, uy = dy / d;
    var px = -uy * (bend || 1), py = ux * (bend || 1);
    return [sx + ux * a + px * hh, sy + uy * a + py * hh, tx, ty];
  };

  /**
   * 手臂（IK 版）：从肩点伸向目标手位
   * edge: 若给出，先画一层加宽的深色 → 手臂与躯干之间产生 1px 分界线
   * @return [handX, handY, elbowX, elbowY]
   */
  RIG.armTo = function (pen, sx, sy, tx, ty, l1, l2, w1, w2, w3, col, shade, bend, edge) {
    var r = RIG.ik(sx, sy, tx, ty, l1, l2, bend);
    var ex = r[0], ey = r[1], hx = r[2], hy = r[3];
    if (edge) {
      pen.taper([[sx, sy], [(sx + ex) / 2, (sy + ey) / 2], [ex, ey]], w1 + 2.4, w2 + 2.4, edge);
      pen.taper([[ex, ey], [(ex + hx) / 2, (ey + hy) / 2], [hx, hy]], w2 + 2.4, w3 + 2.4, edge);
      pen.circle(ex, ey, w2 * .5 + 1.2, edge);
    }
    pen.taper([[sx, sy], [(sx + ex) / 2, (sy + ey) / 2], [ex, ey]], w1, w2, col);
    pen.taper([[ex, ey], [(ex + hx) / 2, (ey + hy) / 2], [hx, hy]], w2, w3, col);
    pen.circle(ex, ey, w2 * .5, col);
    if (shade) pen.taper([[sx, sy], [ex, ey]], w1 * .3, w2 * .3, shade);
    return [hx, hy, ex, ey];
  };

  /**
   * 手臂（角度版，90=垂下）
   * @return 手部位置 [x,y,elbowX,elbowY]
   */
  RIG.arm = function (pen, sx, sy, a1, a2, l1, l2, w1, w2, w3, col, shade) {
    var r1 = a1 * D, r2 = (a1 + a2) * D;
    var ex = sx + Math.cos(r1) * l1, ey = sy + Math.sin(r1) * l1;
    var hx = ex + Math.cos(r2) * l2, hy = ey + Math.sin(r2) * l2;
    pen.taper([[sx, sy], [(sx + ex) / 2, (sy + ey) / 2], [ex, ey]], w1, w2, col);
    pen.taper([[ex, ey], [(ex + hx) / 2, (ey + hy) / 2], [hx, hy]], w2, w3, col);
    pen.circle(ex, ey, w2 / 2, col);
    if (shade) pen.taper([[sx, sy], [ex, ey]], w1 * .34, w2 * .34, shade);
    return [hx, hy, ex, ey];
  };

  /** 手（简化的拳/掌） */
  RIG.hand = function (pen, x, y, r, col, shade, kind, ang) {
    ang = ang || 0;
    if (kind === 'point') {
      pen.circle(x, y, r * .92, col);
      pen.taper([[x, y], [x + Math.cos(ang) * r * 2.4, y + Math.sin(ang) * r * 2.4]], r * .82, r * .5, col);
      if (shade) pen.circle(x + r * .3, y + r * .35, r * .42, shade);
    } else if (kind === 'open') {
      pen.ellipse(x, y, r * 1.12, r * .95, col, ang);
      if (shade) pen.ellipse(x + r * .25, y + r * .3, r * .5, r * .42, shade, ang);
    } else {
      pen.circle(x, y, r, col);
      if (shade) pen.circle(x + r * .28, y + r * .3, r * .48, shade);
    }
  };

  /** 腿（含鞋）。dir: 鞋尖朝向 (+1 右 / -1 左) */
  RIG.leg = function (pen, hx, hy, a1, a2, l1, l2, w1, w2, col, shade, shoe, dir) {
    var r1 = (90 + a1) * D, r2 = (90 + a1 + a2) * D;
    var kx = hx + Math.cos(r1) * l1, ky = hy + Math.sin(r1) * l1;
    var fx = kx + Math.cos(r2) * l2, fy = ky + Math.sin(r2) * l2;
    pen.taper([[hx, hy], [kx, ky]], w1, w2, col);
    pen.taper([[kx, ky], [fx, fy]], w2, w2 * .88, col);
    if (shade) pen.taper([[hx, hy], [kx, ky]], w1 * .32, w2 * .32, shade);
    // 鞋（朝 dir 方向伸出，两只鞋之间保留空隙）
    var d = dir == null ? 1 : dir;
    var a = w2 * .55, b = w2 * .55 + w2 * .36;
    var lft = d > 0 ? a : b, rgt = d > 0 ? b : a;
    pen.blob([
      [fx - lft, fy - 3.5], [fx + rgt, fy - 3.0], [fx + rgt, fy + 2.0],
      [fx + rgt * .8, fy + 5], [fx - lft * .9, fy + 5]
    ], shoe || '#2a2a30', .8);
    return [fx, fy];
  };

  /* ============ 头部 ============ */
  /**
   * 头：返回若干关键点方便五官定位
   * shape: {rx, ry, jaw, chin}
   */
  RIG.head = function (pen, cx, cy, rx, ry, skin, o) {
    o = o || {};
    var jaw = o.jaw == null ? .78 : o.jaw;
    var chin = o.chin == null ? 1.06 : o.chin;
    var pts = [
      [cx, cy - ry],
      [cx + rx * .82, cy - ry * .72],
      [cx + rx, cy - ry * .08],
      [cx + rx * jaw, cy + ry * .58],
      [cx + rx * .34, cy + ry * chin],
      [cx, cy + ry * (chin + .04)],
      [cx - rx * .34, cy + ry * chin],
      [cx - rx * jaw, cy + ry * .58],
      [cx - rx, cy - ry * .08],
      [cx - rx * .82, cy - ry * .72]
    ];
    pen.blob(pts, skin.base, .95);
    // 侧面阴影
    pen.clipBlob(pts, function (p) {
      p.blob([[cx + rx * .30, cy - ry * 1.2], [cx + rx * 1.3, cy - ry * .9],
      [cx + rx * 1.3, cy + ry * 1.3], [cx + rx * .46, cy + ry * 1.3]], skin.lo, .6);
      // 下颌阴影
      p.blob([[cx - rx, cy + ry * .5], [cx + rx, cy + ry * .5], [cx + rx * .8, cy + ry * 1.3], [cx - rx * .8, cy + ry * 1.3]], skin.lo, .6);
    }, .95);
    // 额头高光
    pen.clipBlob(pts, function (p) {
      p.ellipse(cx - rx * .34, cy - ry * .5, rx * .40, ry * .24, skin.hi);
    }, .95);
    return { pts: pts, cx: cx, cy: cy, rx: rx, ry: ry };
  };

  /* ============ 眼睛 ============ */
  /**
   * kind: normal | wide | closed | angry | sad | shut | side | dot | shine | narrow
   */
  RIG.eyes = function (pen, cx, cy, sp, size, kind, o) {
    o = o || {};
    var white = o.white || '#ffffff';
    var iris = o.iris || '#2a2f3a';
    var lash = o.lash || P.line;
    var px = (o.pupil && o.pupil[0]) || 0, py = (o.pupil && o.pupil[1]) || 0;
    var turn = o.turn || 0;
    var lx = cx - sp / 2 + turn * sp * .28, rx = cx + sp / 2 + turn * sp * .28;

    function one(ex, mirror) {
      var m = mirror ? -1 : 1;
      if (kind === 'closed' || kind === 'shut') {
        pen.line([[ex - size * 1.1, cy], [ex - size * .3, cy + size * .34], [ex + size * 1.05, cy - size * .1]], lash, Math.max(1.3, size * .30), true);
        if (kind === 'shut') pen.line([[ex - size * .8, cy + size * .62], [ex + size * .5, cy + size * .5]], lash, 1.1, true);
        return;
      }
      if (kind === 'dot') { pen.circle(ex, cy, size * .44, lash); return; }
      var ew = size * (kind === 'wide' ? 1.16 : (kind === 'narrow' ? 1.02 : 1.06));
      var eh = size * (kind === 'wide' ? 1.28 : (kind === 'narrow' ? .5 : .92));
      // 眼白
      pen.ellipse(ex, cy, ew, eh, white);
      // 瞳
      var ir = size * (kind === 'wide' ? .56 : .58);
      pen.ellipse(ex + px * size * .3, cy + py * size * .28, ir, ir * 1.06, iris);
      pen.circle(ex + px * size * .3 - ir * .3, cy + py * size * .28 - ir * .36, ir * .34, '#ffffff');
      // 上眼睑 / 睫毛
      if (kind === 'angry') {
        pen.poly([[ex - ew * 1.12, cy - eh * 1.5], [ex + ew * 1.12, cy - eh * .34],
        [ex + ew * 1.12, cy - eh * .05], [ex - ew * 1.12, cy - eh * .55]], lash);
      } else if (kind === 'sad') {
        pen.poly([[ex - ew * 1.12, cy - eh * .45], [ex + ew * 1.12, cy - eh * 1.35],
        [ex + ew * 1.12, cy - eh * .6], [ex - ew * 1.12, cy - eh * .05]], lash);
      } else {
        pen.line([[ex - ew * 1.05, cy - eh * .46], [ex, cy - eh * 1.12], [ex + ew * 1.05, cy - eh * .5]], lash, Math.max(1.2, size * .30), true);
      }
      if (kind === 'wide') {
        pen.line([[ex - ew * 1.02, cy + eh * .62], [ex, cy + eh * 1.05], [ex + ew * 1.02, cy + eh * .66]], lash, 1.1, true);
      }
    }
    one(lx, false); one(rx, true);
    return { lx: lx, rx: rx, cy: cy };
  };

  /* ============ 眉毛 ============ */
  RIG.brow = function (pen, cx, cy, sp, size, kind, col) {
    col = col || P.line;
    var lx = cx - sp / 2, rx = cx + sp / 2;
    function one(ex, m) {
      var pts;
      if (kind === 'angry') pts = [[ex - size * 1.15 * m, cy - size * .34], [ex, cy + size * .12], [ex + size * 1.05 * m, cy + size * .5]];
      else if (kind === 'sad') pts = [[ex - size * 1.15 * m, cy + size * .5], [ex, cy + size * .02], [ex + size * 1.05 * m, cy - size * .35]];
      else if (kind === 'up') pts = [[ex - size * 1.1 * m, cy - size * .1], [ex, cy - size * .62], [ex + size * 1.05 * m, cy - size * .18]];
      else if (kind === 'down') pts = [[ex - size * 1.1 * m, cy + size * .3], [ex, cy + size * .44], [ex + size * 1.05 * m, cy + size * .22]];
      else pts = [[ex - size * 1.1 * m, cy + size * .12], [ex, cy - size * .2], [ex + size * 1.05 * m, cy + size * .05]];
      pen.line(pts, col, Math.max(1.6, size * .52), true);
    }
    one(lx, 1); one(rx, -1);
  };

  /* ============ 嘴 ============ */
  /** kind: closed | open | wide | smile | grin | frown | shout | small | flat | o */
  RIG.mouth = function (pen, cx, cy, w, kind, col, inner) {
    col = col || P.line;
    inner = inner || '#8c3a44';
    switch (kind) {
      case 'open':
        pen.blob([[cx - w * .5, cy], [cx, cy - w * .16], [cx + w * .5, cy],
        [cx + w * .34, cy + w * .5], [cx, cy + w * .62], [cx - w * .34, cy + w * .5]], col, .9);
        pen.blob([[cx - w * .3, cy + w * .12], [cx, cy + w * .06], [cx + w * .3, cy + w * .12],
        [cx + w * .2, cy + w * .42], [cx, cy + w * .5], [cx - w * .2, cy + w * .42]], inner, .9);
        break;
      case 'wide':
      case 'shout':
        pen.blob([[cx - w * .72, cy - w * .12], [cx, cy - w * .3], [cx + w * .72, cy - w * .12],
        [cx + w * .55, cy + w * .78], [cx, cy + w * 1.0], [cx - w * .55, cy + w * .78]], col, .9);
        pen.blob([[cx - w * .44, cy + w * .16], [cx, cy + w * .06], [cx + w * .44, cy + w * .16],
        [cx + w * .34, cy + w * .64], [cx, cy + w * .8], [cx - w * .34, cy + w * .64]], inner, .9);
        pen.blob([[cx - w * .5, cy - w * .1], [cx + w * .5, cy - w * .1], [cx + w * .4, cy + w * .1], [cx - w * .4, cy + w * .1]], '#ffffff', .7);
        break;
      case 'smile':
        pen.line([[cx - w * .56, cy - w * .16], [cx, cy + w * .34], [cx + w * .56, cy - w * .16]], col, Math.max(1.4, w * .19), true);
        break;
      case 'grin':
        pen.blob([[cx - w * .62, cy - w * .1], [cx, cy + w * .06], [cx + w * .62, cy - w * .1],
        [cx + w * .42, cy + w * .56], [cx, cy + w * .68], [cx - w * .42, cy + w * .56]], col, .9);
        pen.blob([[cx - w * .5, cy - w * .02], [cx + w * .5, cy - w * .02], [cx + w * .36, cy + w * .18], [cx - w * .36, cy + w * .18]], '#ffffff', .7);
        break;
      case 'frown':
        pen.line([[cx - w * .5, cy + w * .28], [cx, cy - w * .18], [cx + w * .5, cy + w * .28]], col, Math.max(1.4, w * .19), true);
        break;
      case 'small':
        pen.ellipse(cx, cy + w * .1, w * .2, w * .18, col);
        break;
      case 'o':
        pen.ellipse(cx, cy + w * .12, w * .28, w * .34, col);
        pen.ellipse(cx, cy + w * .14, w * .17, w * .22, inner);
        break;
      case 'flat':
        pen.line([[cx - w * .42, cy], [cx + w * .42, cy]], col, Math.max(1.3, w * .17), false);
        break;
      default: // closed
        pen.line([[cx - w * .40, cy - w * .04], [cx - w * .1, cy + w * .1], [cx + w * .40, cy - w * .02]], col, Math.max(1.3, w * .17), true);
    }
  };

  /* ============ 汗珠 / 特效 ============ */
  RIG.sweat = function (pen, x, y, s, n, phase) {
    n = n || 1;
    for (var i = 0; i < n; i++) {
      var yy = y + i * s * 2.1 + (phase || 0) * s * .8;
      var xx = x + (i % 2 ? s * .9 : 0) + i * s * .5;
      var sz = s * (1 - i * 0.14);
      pen.blob([[xx, yy - sz * 1.5], [xx + sz * .82, yy + sz * .3], [xx + sz * .5, yy + sz * 1.15],
      [xx - sz * .5, yy + sz * 1.15], [xx - sz * .82, yy + sz * .3]], '#bfe6ff', .9);
      pen.ellipse(xx - sz * .28, yy + sz * .3, sz * .26, sz * .34, '#ffffff');
      pen.line([[xx - sz * .82, yy + sz * .34], [xx - sz * .5, yy + sz * 1.1], [xx + sz * .5, yy + sz * 1.15]], '#5e9dc8', 1, true);
    }
  };
  RIG.blush = function (pen, cx, cy, w, amt) {
    for (var i = 0; i < 3; i++) {
      pen.line([[cx - w * .5 + i * w * .34, cy - w * .16], [cx - w * .5 + i * w * .34 + w * .12, cy + w * .2]], '#e8807e', 1.4, true);
    }
  };
  /** 头顶的“愤怒/惊愕”符号 */
  RIG.symbol = function (pen, x, y, kind, col) {
    col = col || '#ffffff';
    if (kind === 'anger') {
      pen.line([[x - 5, y - 6], [x + 5, y + 4]], col, 2.4, false);
      pen.line([[x + 5, y - 6], [x - 5, y + 4]], col, 2.4, false);
      pen.line([[x - 7, y - 1], [x + 7, y - 1]], col, 2.2, false);
    } else if (kind === 'shock') {
      pen.taper([[x, y - 9], [x, y + 2]], 4.4, 2.4, col);
      pen.circle(x, y + 6, 2.0, col);
    } else if (kind === 'question') {
      pen.line([[x - 4, y - 7], [x + 1, y - 9], [x + 4, y - 5], [x, y - 1], [x, y + 2]], col, 2.4, true);
      pen.circle(x, y + 6, 1.8, col);
    } else if (kind === 'sweatbead') {
      RIG.sweat(pen, x, y, 4, 1, 0);
    }
  };

  /* ============ 地面阴影 ============ */
  RIG.groundShadow = function (pen, cx, w, alpha) {
    pen.save(); pen.alpha(alpha == null ? .3 : alpha);
    pen.ellipse(cx, GROUND + 2, w, w * .22, '#1b1424');
    pen.restore();
  };

  /* ============ 渲染 / 缓存 ============ */
  var cache = Object.create(null);

  function stateFor(def, pose, f, talk) {
    var fn = def.poses[pose] || def.poses.normal;
    var s = fn(f, talk);
    return s;
  }

  RIG.frames = function (name, pose) {
    var def = chars[name];
    if (!def) return 1;
    return def.frames[pose] || def.frames[(def.poses[pose] ? pose : 'normal')] || 2;
  };

  /** 取得（并缓存）一帧精灵 */
  RIG.sprite = function (name, pose, f, talk) {
    var def = chars[name];
    if (!def) return null;
    if (!def.poses[pose]) pose = 'normal';
    var n = RIG.frames(name, pose);
    f = ((f % n) + n) % n;
    var key = name + '|' + pose + '|' + f + '|' + (talk ? 1 : 0);
    var c = cache[key];
    if (c) return c;
    var s = stateFor(def, pose, f, talk);
    c = PX.make(W, H, function (pen) {
      pen.addPalette(def.paletteList || []);
      def.draw(pen, s);
    }, { outline: def.outline || P.line, alphaThreshold: 100 });
    cache[key] = c;
    return c;
  };

  /** 预热（避免首次出现时的卡顿） */
  RIG.preload = function (name, poses) {
    var def = chars[name];
    if (!def) return 0;
    var list = poses || Object.keys(def.poses);
    var cnt = 0;
    for (var i = 0; i < list.length; i++) {
      var n = RIG.frames(name, list[i]);
      for (var f = 0; f < n; f++) { RIG.sprite(name, list[i], f, false); RIG.sprite(name, list[i], f, true); cnt += 2; }
    }
    return cnt;
  };
  RIG.clearCache = function () { cache = Object.create(null); };

  /* ============ 绘制到屏幕 ============ */
  var scaleCache = new Map();
  function scaled(cv, s) {
    if (s === 1) return cv;
    var q = Math.max(0.125, Math.round(s * 16) / 16);
    if (q === 1) return cv;
    var key = (cv.__sid || (cv.__sid = 's' + (scaleCache.size + 1) + '_' + Math.random().toString(36).slice(2, 7))) + '@' + q;
    var got = scaleCache.get(key);
    if (got) return got;
    var w = Math.max(1, Math.round(cv.width * q)), h = Math.max(1, Math.round(cv.height * q));
    var ctx = U.ctx(w, h);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(cv, 0, 0, w, h);
    if (scaleCache.size > 340) scaleCache.clear();
    scaleCache.set(key, ctx.canvas);
    return ctx.canvas;
  }
  RIG.scaled = scaled;

  /**
   * 把角色画到 ctx
   * slot: {x（中心）, y（脚底）, s（缩放）}
   * o: {flip, alpha, dx, dy, tint, tintAmt}
   */
  RIG.draw = function (ctx, cv, slot, o) {
    if (!cv || !slot) return;
    o = o || {};
    var s = slot.s == null ? 1 : slot.s;
    var img = scaled(cv, s);
    var q = img === cv ? 1 : (img.width / cv.width);
    if (o.tint && o.tintAmt > 0) img = PX.tinted(img, o.tint, o.tintAmt);
    var w = img.width, h = img.height;
    var footY = GROUND * q;
    var x = Math.round(slot.x - w / 2 + (o.dx || 0));
    var y = Math.round(slot.y - footY + (o.dy || 0));
    if (o.alpha != null && o.alpha < 1) { ctx.save(); ctx.globalAlpha = o.alpha; }
    if (o.flip) {
      ctx.save(); ctx.translate(x + w, y); ctx.scale(-1, 1);
      ctx.drawImage(img, 0, 0); ctx.restore();
    } else ctx.drawImage(img, x, y);
    if (o.alpha != null && o.alpha < 1) ctx.restore();
  };

})(window.AA);
