/* ============================================================
   title.js — 标题画面
   ============================================================ */
(function (AA) {
  'use strict';
  var U = AA.U, PX = AA.PX, P = AA.PAL, F = AA.FONT, S = AA.SFX, M = AA.MUSIC;
  var SCN = AA.SCENES, HUD = AA.HUD;
  var T = AA.TITLE = {};

  var W = 256, H = 192;
  F.define('logo', { size: 42, cell: 54, lh: 54, weight: 900, th: 84, bold: 1.3, family: '"Yu Mincho","SimHei","Microsoft YaHei",serif' });
  F.define('logoS', { size: 15, cell: 20, lh: 20, weight: 700, th: 92, bold: .7, family: '"Yu Mincho","SimSun",serif' });

  var t = 0, sel = 0, entered = false, ready = false;
  var menu = [];
  T.onStart = null;

  /* ---------- 标志 ---------- */
  var logoCv = null;
  function logoArt() {
    if (logoCv) return logoCv;
    var text = '逆転裁判';
    var tw = F.width(text, 'logo');
    var ramp = ['#fff7d4', '#ffe9a8', '#f0cf72', '#dfb44e', '#c1912f', '#a3741f', '#8a5c14'];
    logoCv = PX.make(tw + 14, 58, function (pen, ctx) {
      // 纯白字形（字形本身已是硬边）
      F.draw(ctx, text, 7, 2, 'logo', '#ffffff');
      // 金色分层（source-atop 只影响已有笔画）
      ctx.globalCompositeOperation = 'source-atop';
      for (var i = 0; i < ramp.length; i++) {
        pen.use(ramp[i]);
        ctx.fillStyle = ramp[i];
        var y0 = Math.round(3 + i * 48 / ramp.length), y1 = Math.round(3 + (i + 1) * 48 / ramp.length);
        ctx.fillRect(0, y0, ctx.canvas.width, y1 - y0);
      }
      ctx.globalCompositeOperation = 'source-over';
    }, { outline: '#3a0a10', outlineW: 2, alphaThreshold: 128 });
    return logoCv;
  }

  var subCv = null;
  function subArt() {
    if (subCv) return subCv;
    var text = '第 1 话  逆转的深夜电波';
    var tw = F.width(text, 'logoS');
    subCv = PX.make(tw + 10, 24, function (pen, ctx) {
      F.outlined(ctx, text, 5, 2, 'logoS', '#f4ecd8', '#1a1020', 1);
    }, { alphaThreshold: 92 });
    return subCv;
  }

  /* ---------- 进入 ---------- */
  T.enter = function (hasSave) {
    t = 0; sel = 0; entered = true; ready = false;
    menu = [{ id: 'new', label: '新 的 故 事' }];
    if (hasSave) menu.push({ id: 'continue', label: '继 续 游 戏' });
    menu.push({ id: 'gallery', label: '角 色 与 演 出 一 览' });
    menu.push({ id: 'help', label: '操 作 说 明' });
    SCN.load('court', 'gallery');
    M.play('title', { fadeIn: 1.2 });
  };
  T.leave = function () { entered = false; };
  T.active = function () { return entered; };

  T.update = function (dt) {
    t += dt;
    if (t > 0.9) ready = true;
    // 缓慢的相机漂移
    SCN.nudge(Math.sin(t * .17) * 30, 14 + Math.cos(t * .13) * 10, Math.sin(t * .11) * 24, Math.sin(t * .09) * 2);
  };

  /* ---------- 上屏 ---------- */
  T.drawTop = function (ctx) {
    ctx.drawImage(SCN.bg(), 0, 0);
    // 压暗 + 蓝调
    ctx.fillStyle = 'rgba(6,10,26,.62)'; ctx.fillRect(0, 0, W, H);
    // 光束
    ctx.save();
    for (var i = 0; i < 5; i++) {
      var a = .05 + .03 * Math.sin(t * .6 + i);
      ctx.globalAlpha = a;
      ctx.fillStyle = '#9fc4ff';
      var x = -60 + i * 70 + Math.sin(t * .21 + i) * 14;
      ctx.beginPath();
      ctx.moveTo(x, 0); ctx.lineTo(x + 26, 0); ctx.lineTo(x + 88, H); ctx.lineTo(x + 54, H);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();

    // 标志
    var lg = logoArt();
    var pop = U.ease.outBack(U.sat(t / .7));
    var ly = Math.round(22 + (1 - pop) * -16);
    ctx.save();
    ctx.globalAlpha = U.sat(t / .5);
    ctx.drawImage(lg, Math.round((W - lg.width) / 2), ly);
    ctx.restore();

    // 装饰线
    if (t > .5) {
      var la = U.sat((t - .5) / .5);
      ctx.save(); ctx.globalAlpha = la;
      var lw = Math.round(190 * la);
      ctx.fillStyle = '#e8c46a';
      ctx.fillRect(Math.round((W - lw) / 2), 84, lw, 1);
      ctx.fillStyle = 'rgba(0,0,0,.7)';
      ctx.fillRect(Math.round((W - lw) / 2), 85, lw, 1);
      // 中央菱形
      ctx.fillStyle = '#ffe9a8';
      for (var d = 0; d < 4; d++) ctx.fillRect(128 - 3 + d, 84 - 3 + d, 7 - d * 2, 1);
      for (var d2 = 0; d2 < 4; d2++) ctx.fillRect(128 - 3 + d2, 84 + 3 - d2, 7 - d2 * 2, 1);
      ctx.restore();
    }

    // 副标题
    if (t > .75) {
      var sa = U.sat((t - .75) / .5);
      var sb = subArt();
      ctx.save(); ctx.globalAlpha = sa;
      ctx.drawImage(sb, Math.round((W - sb.width) / 2), 92 + Math.round((1 - sa) * 6));
      ctx.restore();
    }

    // 提示
    if (ready && Math.sin(t * 3.4) > -0.35) {
      F.center(ctx, '— 请在下屏选择 —', 128, 168, 'bodyS', '#cfd8f0');
    }
    F.draw(ctx, 'FAN TRIBUTE · NON-COMMERCIAL', 6, 182, 'tiny', 'rgba(200,214,255,.4)');
  };

  /* ---------- 下屏 ---------- */
  T.drawBot = function (ctx) {
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#1a2650'); g.addColorStop(1, '#080c1c');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.globalAlpha = .08;
    HUD.scales(PX.pen(ctx), 128, 96, 1.9, '#ffffff');
    ctx.restore();
    ctx.save(); ctx.globalAlpha = .05;
    for (var y = 0; y < H; y += 3) { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, y, W, 1); }
    ctx.restore();

    F.center(ctx, 'GYAKUTEN  SAIBAN  ·  NDS  STYLE  TRIBUTE', 128, 8, 'tiny', '#7f8cb8');
    ctx.fillStyle = '#e8c46a'; ctx.fillRect(24, 20, W - 48, 1);

    var top = 34, h = 27, gap = 8;
    for (var i = 0; i < menu.length; i++) {
      var y = top + i * (h + gap);
      var on = i === sel;
      var appear = U.sat((t - .8 - i * .1) / .35);
      if (appear <= 0) continue;
      var dx = Math.round((1 - U.ease.outCubic(appear)) * 30);
      ctx.save(); ctx.globalAlpha = appear;
      HUD.drawButton(ctx, 26 + dx, y, W - 52, h, menu[i].label, on ? 'gold' : 'dark', true, false);
      if (on) {
        var b = Math.sin(t * 7) > 0 ? 0 : 1;
        ctx.fillStyle = '#ffd964';
        for (var q = 0; q < 5; q++) ctx.fillRect(14 - b + q, y + h / 2 - 5 + q, 5 - q, 1);
        for (var q2 = 0; q2 < 5; q2++) ctx.fillRect(14 - b + q2, y + h / 2 + 4 - q2, 5 - q2, 1);
      }
      ctx.restore();
    }
    F.center(ctx, '空格 / 点击 = 确定　　方向键 = 选择', 128, 176, 'tiny', '#5d6890');
  };

  /* ---------- 输入 ---------- */
  function fire(i) {
    if (!menu[i]) return;
    S.select();
    if (T.onStart) T.onStart(menu[i].id);
  }
  T.handleKey = function (k) {
    if (!ready) return;
    if (k === 'up') { sel = U.mod(sel - 1, menu.length); S.cursor(); }
    else if (k === 'down') { sel = U.mod(sel + 1, menu.length); S.cursor(); }
    else if (k === 'confirm') fire(sel);
  };
  T.handleTap = function (x, y, scr) {
    if (!ready) return;
    if (scr !== 1) { return; }
    var top = 34, h = 27, gap = 8;
    for (var i = 0; i < menu.length; i++) {
      var yy = top + i * (h + gap);
      if (y >= yy && y < yy + h) {
        if (sel !== i) { sel = i; S.cursor(); return; }
        fire(i); return;
      }
    }
  };

})(window.AA);
