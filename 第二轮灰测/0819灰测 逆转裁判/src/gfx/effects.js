/* ============================================================
   effects.js — 逆转裁判标志性演出效果
   ・「异议！」气泡（放射线 + 弹入 + 屏震 + 闪白）
   ・冲击背景（竖条纹 / 放射线）
   ・屏幕震动 / 闪光 / 淡入淡出 / 光圈 / 横向擦除
   ・证言标题条、生命条扣减、纸花、聚焦线
   ============================================================ */
(function (AA) {
  'use strict';
  var U = AA.U, PX = AA.PX, P = AA.PAL, F = AA.FONT, S = AA.SFX;
  var FX = AA.FX = {};

  var W = 256, H = 192;

  /* 追加两个特大字号（喊话用，尺寸大所以少量加粗不会粘连） */
  F.define('shout', { size: 31, cell: 39, lh: 39, weight: 800, th: 94, bold: .35, family: '"Yu Mincho","SimHei","Microsoft YaHei",serif' });
  F.define('shoutS', { size: 23, cell: 29, lh: 29, weight: 800, th: 96, bold: .2, family: '"Yu Mincho","SimHei","Microsoft YaHei",serif' });

  var list = [];          // 活动效果
  var shake = { x: 0, y: 0, t: 0, dur: 0, pow: 0, freq: 26 };
  var whiteout = null;

  FX.clear = function () { list.length = 0; shake.t = 0; shake.dur = 0; shake.x = shake.y = 0; whiteout = null; };

  function add(e) {
    e.t = 0;
    e.dur = e.dur || 1;
    e.layer = e.layer || 'over';
    list.push(e);
    return e;
  }
  FX.add = add;
  FX.busy = function () {
    for (var i = 0; i < list.length; i++) if (list[i].block) return true;
    return false;
  };
  FX.count = function () { return list.length; };

  FX.update = function (dt) {
    for (var i = list.length - 1; i >= 0; i--) {
      var e = list[i];
      e.t += dt;
      if (e.step) e.step(e.t / e.dur, e);
      if (e.t >= e.dur) { if (e.done) e.done(); list.splice(i, 1); }
    }
    if (shake.dur > 0) {
      shake.t += dt;
      var k = U.sat(1 - shake.t / shake.dur);
      var a = shake.t * shake.freq;
      shake.x = Math.round(Math.sin(a * 6.283) * shake.pow * k);
      shake.y = Math.round(Math.cos(a * 4.7) * shake.pow * k * .8);
      if (shake.t >= shake.dur) { shake.dur = 0; shake.x = shake.y = 0; }
    }
  };

  FX.draw = function (ctx, layer) {
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (e.layer !== layer || !e.draw) continue;
      e.draw(ctx, U.sat(e.t / e.dur), e);
    }
  };
  FX.shakeX = function () { return shake.x; };
  FX.shakeY = function () { return shake.y; };

  /* ================= 屏震 ================= */
  FX.shake = function (pow, dur, freq) {
    shake.pow = pow == null ? 4 : pow;
    shake.dur = dur == null ? .35 : dur;
    shake.freq = freq || 26;
    shake.t = 0;
    return shake.dur;
  };

  /* ================= 闪光 ================= */
  FX.flash = function (col, dur, peak) {
    add({
      dur: dur || .22, layer: 'top',
      draw: function (ctx, t) {
        var a = (peak == null ? .85 : peak) * Math.pow(1 - t, 1.6);
        ctx.save(); ctx.globalAlpha = a;
        ctx.fillStyle = col || '#ffffff'; ctx.fillRect(0, 0, W, H);
        ctx.restore();
      }
    });
    return dur || .22;
  };

  /* ================= 淡入 / 淡出 ================= */
  FX.fadeOut = function (dur, col) {
    dur = dur || .4;
    add({
      dur: dur, layer: 'top', block: true, hold: true,
      draw: function (ctx, t) {
        ctx.save(); ctx.globalAlpha = U.ease.inQuad(t);
        ctx.fillStyle = col || '#000000'; ctx.fillRect(0, 0, W, H); ctx.restore();
      },
      done: function () { FX.cover(col || '#000000'); }
    });
    return dur;
  };
  var coverCol = null;
  FX.cover = function (c) { coverCol = c; };
  FX.uncover = function () { coverCol = null; };
  FX.fadeIn = function (dur, col) {
    dur = dur || .4;
    coverCol = null;
    add({
      dur: dur, layer: 'top', block: true,
      draw: function (ctx, t) {
        ctx.save(); ctx.globalAlpha = 1 - U.ease.outQuad(t);
        ctx.fillStyle = col || '#000000'; ctx.fillRect(0, 0, W, H); ctx.restore();
      }
    });
    return dur;
  };
  FX.drawCover = function (ctx) {
    if (!coverCol) return;
    ctx.fillStyle = coverCol; ctx.fillRect(0, 0, W, H);
  };

  /* ================= 横向擦除（场景切换） ================= */
  FX.wipe = function (dur, col, dir) {
    dur = dur || .5;
    add({
      dur: dur, layer: 'top', block: true,
      draw: function (ctx, t) {
        ctx.fillStyle = col || '#0b1024';
        var half = dur / 2;
        var e = t < .5 ? U.ease.outQuad(t * 2) : 1 - U.ease.inQuad((t - .5) * 2);
        var w = Math.round(W * e);
        if (dir === 'v') {
          ctx.fillRect(0, 0, W, Math.round(H * e));
        } else {
          ctx.fillRect(0, 0, w, H);
        }
        // 斜切边缘
        ctx.fillStyle = '#e8c46a';
        if (dir === 'v') ctx.fillRect(0, Math.round(H * e) - 1, W, 1);
        else ctx.fillRect(w - 1, 0, 1, H);
      }
    });
    return dur;
  };

  /* ================= 放射速度线 ================= */
  var speedCache = Object.create(null);
  function speedLines(cx, cy, seed, col, n) {
    var key = 'sl' + cx + '_' + cy + '_' + seed + col + n;
    if (speedCache[key]) return speedCache[key];
    var cv = PX.make(W, H, function (pen) {
      var r = U.rng(seed);
      for (var i = 0; i < n; i++) {
        var a = (i / n) * 6.2832 + r() * .18;
        var r0 = 26 + r() * 30, r1 = 200 + r() * 90;
        var wd = 2 + r() * 7;
        var nx = -Math.sin(a), ny = Math.cos(a);
        pen.poly([
          [cx + Math.cos(a) * r0 + nx * wd * .18, cy + Math.sin(a) * r0 + ny * wd * .18],
          [cx + Math.cos(a) * r1 + nx * wd, cy + Math.sin(a) * r1 + ny * wd],
          [cx + Math.cos(a) * r1 - nx * wd, cy + Math.sin(a) * r1 - ny * wd],
          [cx + Math.cos(a) * r0 - nx * wd * .18, cy + Math.sin(a) * r0 - ny * wd * .18]
        ], col);
      }
    }, { noSnap: true });
    speedCache[key] = cv;
    return cv;
  }
  FX.speedLines = function (dur, cx, cy, col) {
    dur = dur || .5;
    var cv = speedLines(cx == null ? 128 : cx, cy == null ? 96 : cy, 7, col || '#ffffff', 26);
    add({
      dur: dur, layer: 'bg',
      draw: function (ctx, t) {
        ctx.save();
        ctx.globalAlpha = .55 * (1 - t * t);
        var s = 1 + t * .5;
        ctx.translate(128, 96); ctx.scale(s, s); ctx.translate(-128, -96);
        ctx.drawImage(cv, 0, 0);
        ctx.restore();
      }
    });
    return dur;
  };

  /* ================= 冲击背景（竖条纹） ================= */
  var shockCv = null;
  function shockBg() {
    if (shockCv) return shockCv;
    shockCv = PX.make(W, H, function (pen) {
      pen.vgrad(0, 0, W, H, P.fx.shockBg1, P.fx.shockBg2, 7);
      var r = U.rng(99);
      for (var i = 0; i < 34; i++) {
        var x = Math.floor(r() * W);
        var w = 1 + Math.floor(r() * 4);
        pen.rect(x, 0, w, H, r() > .5 ? '#3a58b0' : '#0c1230');
      }
      // 中央亮带
      pen.rect(0, 0, W, H, 'rgba(0,0,0,0)');
    }, { noSnap: true });
    return shockCv;
  }
  FX.shockBg = function (dur) {
    dur = dur || .8;
    var cv = shockBg();
    add({
      dur: dur, layer: 'bg',
      draw: function (ctx, t) {
        ctx.save();
        ctx.globalAlpha = t < .12 ? t / .12 : (t > .8 ? (1 - t) / .2 : 1);
        var ox = Math.round(Math.sin(t * 40) * 3);
        ctx.drawImage(cv, ox, 0);
        ctx.drawImage(cv, ox - W, 0);
        ctx.restore();
      }
    });
    return dur;
  };

  /* ================= 「异议！」气泡 ================= */
  var BUBBLE = {
    objection: { text: '异 议 ！', c1: '#ff6a55', c2: '#8e1010', ring: '#ffffff', tilt: -5 },
    holdit: { text: '等 一 下 ！', c1: '#4aa8ff', c2: '#0e2f7a', ring: '#ffffff', tilt: 4 },
    takethat: { text: '看 这 个 ！', c1: '#ffc94a', c2: '#8a5410', ring: '#ffffff', tilt: -3 },
    gotcha: { text: '就 是 这 里 ！', c1: '#7de08a', c2: '#146030', ring: '#ffffff', tilt: 3 }
  };
  FX.BUBBLE = BUBBLE;

  var bubbleCache = Object.create(null);
  function bubbleArt(kind) {
    if (bubbleCache[kind]) return bubbleCache[kind];
    var d = BUBBLE[kind] || BUBBLE.objection;
    var BW = 252, BH = 104;
    var cv = PX.make(BW, BH, function (pen) {
      var cx = BW / 2, cy = BH / 2;
      // 爆炸星形
      var N = 30, pts = [], pts2 = [], pts3 = [];
      var r = U.rng(kind.length * 977 + 13);
      for (var i = 0; i < N; i++) {
        var a = i / N * 6.2832;
        var out = i % 2 === 0;
        var rr = out ? 1.0 + r() * .12 : 0.80 + r() * .06;
        var ex = Math.cos(a) * rr * (BW / 2 - 6), ey = Math.sin(a) * rr * (BH / 2 - 6);
        pts.push([cx + ex, cy + ey]);
        pts2.push([cx + ex * .955, cy + ey * .94]);
        pts3.push([cx + ex * .90, cy + ey * .88]);
      }
      pen.poly(pts, '#241a16');            // 外描边
      pen.poly(pts2, d.ring);              // 白圈
      pen.poly(pts3, d.c2);                // 底色
      // 渐层
      pen.clipPoly(pts3, function (p) {
        p.vgrad(0, 0, BW, BH, d.c1, d.c2, 6);
        // 上方高光
        p.ellipse(cx, cy - BH * .30, BW * .40, BH * .17, U.hilite(d.c1, .28));
      });
      // 内圈细白边
      for (var k = 0; k < pts3.length; k++) { }
      pen.line(pts3.concat([pts3[0]]), U.hilite(d.c1, .5), 1.2, false);
      // 文字
      var tw = F.width(d.text, 'shout');
      var tx = Math.round(cx - tw / 2), ty = Math.round(cy - 20);
      F.outlined(pen.c, d.text, tx, ty, 'shout', '#ffffff', '#2a0a10', 2);
    }, { alphaThreshold: 96 });
    bubbleCache[kind] = cv;
    return cv;
  }
  FX.bubbleArt = bubbleArt;

  /**
   * 播放喊话气泡。返回总时长
   * o: {gender, noSound, y}
   */
  FX.bubble = function (kind, o) {
    o = o || {};
    var d = BUBBLE[kind] || BUBBLE.objection;
    var art = bubbleArt(kind);
    var DUR = 1.15;
    var lines = speedLines(128, 96, kind.length + 3, kind === 'holdit' ? '#bfe0ff' : '#fff2c8', 22);
    if (!o.noSound) {
      S.shout(kind === 'gotcha' ? 'takethat' : kind, o.gender || 'm');
    }
    FX.shake(5, .38, 30);
    FX.flash('#ffffff', .16, .55);
    add({
      dur: DUR, layer: 'top', block: true,
      draw: function (ctx, t) {
        // 放射线
        ctx.save();
        ctx.globalAlpha = .55 * (1 - U.sat(t * 1.6));
        var ls = 1 + t * .8;
        ctx.translate(128, 96); ctx.scale(ls, ls); ctx.translate(-128, -96);
        ctx.drawImage(lines, 0, 0);
        ctx.restore();
        // 气泡
        var s, a = 1, rot = d.tilt;
        if (t < .16) { s = U.ease.outBack(t / .16) * 1.0; a = U.sat(t / .08); }
        else if (t < .26) { s = 1 + Math.sin((t - .16) / .10 * Math.PI) * .07; }
        else if (t > .84) { s = 1 + (t - .84) / .16 * .35; a = 1 - (t - .84) / .16; }
        else { s = 1 + Math.sin(t * 34) * .012; }
        var yy = (o.y == null ? 92 : o.y) + (t < .16 ? (1 - t / .16) * 8 : 0);
        ctx.save();
        ctx.globalAlpha = a;
        ctx.translate(128, yy);
        ctx.rotate(rot * Math.PI / 180);
        ctx.scale(s, s);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(art, -art.width / 2 | 0, -art.height / 2 | 0);
        ctx.restore();
      }
    });
    return DUR;
  };

  /* ================= 证言标题条 ================= */
  FX.testimonyTitle = function (title, dur) {
    dur = dur || 1.6;
    var cv = PX.make(W, 54, function (pen) {
      // 上下波浪蓝条
      pen.vgrad(0, 0, W, 54, '#0d1a48', '#050a20', 5);
      for (var i = 0; i < W; i += 8) {
        var h = 4 + Math.round(Math.sin(i * .16) * 2.6);
        pen.rect(i, 2, 8, h, '#2c53b8');
        pen.rect(i, 54 - 3 - h, 8, h, '#2c53b8');
      }
      pen.rect(0, 8, W, 1, '#7fa8ff');
      pen.rect(0, 45, W, 1, '#7fa8ff');
      var tw = F.width(title, 'shoutS');
      F.outlined(pen.c, title, Math.round((W - tw) / 2), 12, 'shoutS', '#ffffff', '#0a1230', 2);
    }, { alphaThreshold: 90 });
    S.sting();
    add({
      dur: dur, layer: 'top', block: true,
      draw: function (ctx, t) {
        var y = 70, a = 1, x = 0;
        if (t < .18) { x = -W * (1 - U.ease.outCubic(t / .18)); }
        else if (t > .82) { x = W * U.ease.inCubic((t - .82) / .18); }
        ctx.save(); ctx.globalAlpha = a;
        ctx.drawImage(cv, Math.round(x), y);
        ctx.restore();
      }
    });
    return dur;
  };

  /* ================= 「！」惊愕气泡 ================= */
  FX.exclaim = function (x, y, col) {
    var cv = PX.cached('excl' + col, 34, 40, function (pen) {
      pen.blob([[17, 0], [30, 8], [33, 22], [17, 38], [3, 22], [5, 8]], '#ffffff', .9);
      pen.blob([[17, 3], [27, 10], [30, 22], [17, 34], [6, 22], [8, 10]], col || '#e03040', .9);
      pen.taper([[17, 9], [17, 22]], 7, 4, '#ffffff');
      pen.circle(17, 28, 3.1, '#ffffff');
    }, { outline: '#241a16' });
    S.sting();
    add({
      dur: .8, layer: 'over',
      draw: function (ctx, t) {
        var s = t < .2 ? U.ease.outBack(t / .2) : (t > .7 ? 1 - (t - .7) / .3 * .3 : 1 + Math.sin(t * 28) * .04);
        var a = t > .7 ? 1 - (t - .7) / .3 : 1;
        ctx.save(); ctx.globalAlpha = a;
        ctx.translate(x, y - (t < .2 ? (1 - t / .2) * 6 : 0));
        ctx.scale(s, s); ctx.imageSmoothingEnabled = false;
        ctx.drawImage(cv, -17, -20); ctx.restore();
      }
    });
    return .8;
  };

  /* ================= 汗滴飞出 ================= */
  FX.sweatFly = function (x, y) {
    add({
      dur: .6, layer: 'over',
      draw: function (ctx, t) {
        var pen = PX.pen(ctx);
        var yy = y + U.ease.inQuad(t) * 40;
        ctx.save(); ctx.globalAlpha = 1 - t;
        AA.RIG.sweat(pen, x, yy, 5, 1, 0);
        ctx.restore();
      }
    });
    return .6;
  };

  /* ================= 纸花（判决） ================= */
  FX.confetti = function (dur) {
    dur = dur || 4.2;
    var bits = [];
    var r = U.rng(4242);
    for (var i = 0; i < 54; i++) {
      bits.push({
        x: r() * W, y: -r() * H - 4, vy: 22 + r() * 40, vx: (r() - .5) * 16,
        s: 2 + Math.floor(r() * 3), c: ['#ff6a6a', '#ffd964', '#7fd4ff', '#8ef08a', '#ffffff', '#ffab5e'][Math.floor(r() * 6)],
        ph: r() * 6.28, sp: 3 + r() * 5
      });
    }
    S.confetti();
    add({
      dur: dur, layer: 'over',
      draw: function (ctx, t, e) {
        for (var i = 0; i < bits.length; i++) {
          var b = bits[i];
          var yy = b.y + b.vy * e.t;
          if (yy > H + 6) yy = U.mod(yy, H + 40) - 20;
          var xx = b.x + Math.sin(e.t * b.sp + b.ph) * 9 + b.vx * e.t * .3;
          var w = Math.abs(Math.cos(e.t * b.sp + b.ph)) * b.s + 1;
          ctx.fillStyle = b.c;
          ctx.fillRect(Math.round(U.mod(xx, W)), Math.round(yy), Math.round(w), b.s);
        }
      }
    });
    return dur;
  };

  /* ================= 聚焦推近（角色特写） ================= */
  FX.focusPunch = function (dur) {
    dur = dur || .45;
    add({
      dur: dur, layer: 'bg',
      draw: function (ctx, t) {
        ctx.save();
        ctx.globalAlpha = .30 * (1 - t);
        ctx.fillStyle = '#000000';
        var m = Math.round(28 * (1 - t));
        ctx.fillRect(0, 0, W, m); ctx.fillRect(0, H - m, W, m);
        ctx.restore();
      }
    });
    return dur;
  };

  /* ================= 黑边电影条（回忆 / 演出） ================= */
  var bars = 0, barsTarget = 0;
  FX.bars = function (on) { barsTarget = on ? 22 : 0; };
  FX.drawBars = function (ctx, dt) {
    bars += (barsTarget - bars) * Math.min(1, dt * 8);
    if (bars < .4) return;
    var b = Math.round(bars);
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, W, b); ctx.fillRect(0, H - b, W, b);
  };

  /* ================= 回忆滤镜 ================= */
  var memoryAmt = 0, memoryTarget = 0;
  FX.memory = function (on) { memoryTarget = on ? 1 : 0; };
  FX.drawMemory = function (ctx, dt) {
    memoryAmt += (memoryTarget - memoryAmt) * Math.min(1, dt * 5);
    if (memoryAmt < .02) return;
    ctx.save();
    ctx.globalAlpha = memoryAmt * .42;
    ctx.fillStyle = '#6a5a34'; ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = memoryAmt * .22;
    ctx.fillStyle = '#000000';
    for (var y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);
    ctx.restore();
  };

  /* ================= 生命条扣减演出 ================= */
  FX.penalty = function () {
    S.damage();
    FX.shake(7, .7, 34);
    FX.flash('#ff2a3a', .5, .55);
    add({
      dur: .9, layer: 'top', block: true,
      draw: function (ctx, t) {
        // 红色脉冲边框
        var a = .5 * Math.max(0, 1 - t * 1.3) + .2 * Math.abs(Math.sin(t * 22));
        ctx.save(); ctx.globalAlpha = U.sat(a);
        ctx.strokeStyle = '#ff2a3a'; ctx.lineWidth = 6;
        ctx.strokeRect(3, 3, W - 6, H - 6);
        ctx.globalAlpha = U.sat(a * .5);
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
        ctx.strokeRect(7, 7, W - 14, H - 14);
        ctx.restore();
      }
    });
    return .9;
  };

  /* ================= 雷电（戏剧化） ================= */
  FX.lightning = function () {
    S.thunder();
    add({
      dur: 1.0, layer: 'top',
      draw: function (ctx, t) {
        var a = 0;
        if (t < .05) a = .9;
        else if (t < .1) a = .2;
        else if (t < .16) a = .75;
        else if (t < .22) a = .1;
        ctx.save(); ctx.globalAlpha = a;
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
        ctx.restore();
      }
    });
    FX.shake(3, .6, 18);
    return 1.0;
  };

})(window.AA);
