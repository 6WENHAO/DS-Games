/* art.js — 全程序化美术：角色 / 敌人 / Boss / 武器 / 道具 / 场景物件 */
(function (K) {
  'use strict';
  var M = K.M, TAU = M.TAU;
  var OL = '#151220';

  function hex(h) {
    var v = h.replace('#', ''); if (v.length === 3) v = v[0] + v[0] + v[1] + v[1] + v[2] + v[2];
    var n = parseInt(v, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function sh(c, k) {
    var a = hex(c);
    if (k >= 0) return 'rgb(' + [a[0] + (255 - a[0]) * k | 0, a[1] + (255 - a[1]) * k | 0, a[2] + (255 - a[2]) * k | 0] + ')';
    var m = 1 + k; return 'rgb(' + [a[0] * m | 0, a[1] * m | 0, a[2] * m | 0] + ')';
  }
  function circle(ctx, x, y, r, fill, olw) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU);
    if (olw !== 0) { ctx.lineWidth = olw || 2.2; ctx.strokeStyle = OL; ctx.stroke(); }
    ctx.fillStyle = fill; ctx.fill();
  }
  function ell(ctx, x, y, rx, ry, fill, rot, olw) {
    ctx.beginPath(); ctx.ellipse(x, y, Math.max(.4, rx), Math.max(.4, ry), rot || 0, 0, TAU);
    if (olw !== 0) { ctx.lineWidth = olw || 2.2; ctx.strokeStyle = OL; ctx.stroke(); }
    ctx.fillStyle = fill; ctx.fill();
  }
  function rr(ctx, x, y, w, h, r, fill, olw) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x - w / 2, y - h / 2, w, h, r);
    else { var x0 = x - w / 2, y0 = y - h / 2; ctx.moveTo(x0 + r, y0); ctx.arcTo(x0 + w, y0, x0 + w, y0 + h, r); ctx.arcTo(x0 + w, y0 + h, x0, y0 + h, r); ctx.arcTo(x0, y0 + h, x0, y0, r); ctx.arcTo(x0, y0, x0 + w, y0, r); }
    if (olw !== 0) { ctx.lineWidth = olw || 2.2; ctx.strokeStyle = OL; ctx.stroke(); }
    ctx.fillStyle = fill; ctx.fill();
  }
  function poly(ctx, pts, fill, olw) {
    ctx.beginPath(); ctx.moveTo(pts[0], pts[1]);
    for (var i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.closePath();
    if (olw !== 0) { ctx.lineWidth = olw || 2.2; ctx.strokeStyle = OL; ctx.stroke(); }
    ctx.fillStyle = fill; ctx.fill();
  }
  function limb(ctx, x1, y1, x2, y2, w, fill) {
    ctx.lineCap = 'round';
    ctx.strokeStyle = OL; ctx.lineWidth = w + 2.2;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.strokeStyle = fill; ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  }
  function shadow(ctx, x, y, rx, ry, a) {
    ctx.save(); ctx.globalAlpha = a === undefined ? .32 : a; ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.fill(); ctx.restore();
  }

  /* ============ 武器（原点=握把，枪口朝 +x） ============ */
  var WSHAPE = {
    pistol: function (ctx, c) { rr(ctx, 5, 0, 16, 5, 1.6, c.a); rr(ctx, -1, 3, 6, 7, 2, sh(c.a, -.3)); rr(ctx, 11, -1.5, 5, 2.5, 1, sh(c.b, .2)); },
    rifle: function (ctx, c) { rr(ctx, 9, 0, 28, 4.6, 1.4, c.a); rr(ctx, -2, 2.4, 9, 6, 2, sh(c.a, -.35)); rr(ctx, 2, -3.2, 8, 2.6, 1, sh(c.b, .1)); rr(ctx, 20, 2.6, 5, 4, 1, sh(c.a, -.2)); },
    smg: function (ctx, c) { rr(ctx, 6, 0, 19, 5.4, 1.6, c.a); rr(ctx, -2, 3, 7, 7, 2, sh(c.a, -.35)); rr(ctx, 4, 4.4, 4, 7, 1.4, sh(c.b, -.1)); },
    shotgun: function (ctx, c) { rr(ctx, 10, -1.4, 30, 4, 1.2, c.a); rr(ctx, 10, 2, 30, 4, 1.2, sh(c.a, -.15)); rr(ctx, -3, 3, 11, 6, 2, sh(c.b, -.3)); },
    sniper: function (ctx, c) { rr(ctx, 12, 0, 36, 4, 1.2, c.a); rr(ctx, -3, 2.6, 12, 6, 2, sh(c.a, -.35)); rr(ctx, 6, -5, 11, 3.4, 1.4, sh(c.b, -.1)); circle(ctx, 12, -5, 2.2, '#9adfff', 1.4); },
    laser: function (ctx, c) { rr(ctx, 9, 0, 26, 6, 3, c.a); circle(ctx, 20, 0, 3.4, c.b, 1.6); rr(ctx, -2, 3, 8, 6, 2, sh(c.a, -.3)); rr(ctx, 6, -4.4, 10, 2.4, 1.2, c.b); },
    launcher: function (ctx, c) { rr(ctx, 10, 0, 30, 9, 4, c.a); circle(ctx, 24, 0, 5, sh(c.a, -.4), 2); rr(ctx, -1, 4, 9, 7, 2, sh(c.a, -.3)); rr(ctx, 6, -6, 12, 3, 1.4, sh(c.b, 0)); },
    cannon: function (ctx, c) { rr(ctx, 12, 0, 26, 13, 5, c.a); circle(ctx, 25, 0, 7, '#20202c', 2.2); rr(ctx, 0, 6, 10, 8, 3, sh(c.a, -.35)); },
    bow: function (ctx, c) {
      ctx.strokeStyle = OL; ctx.lineWidth = 5.4; ctx.beginPath(); ctx.arc(2, 0, 13, -1.35, 1.35); ctx.stroke();
      ctx.strokeStyle = c.a; ctx.lineWidth = 3.2; ctx.beginPath(); ctx.arc(2, 0, 13, -1.35, 1.35); ctx.stroke();
      ctx.strokeStyle = '#e8e2d0'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(5, -12.6); ctx.lineTo(-1, 0); ctx.lineTo(5, 12.6); ctx.stroke();
      rr(ctx, 8, 0, 16, 2.2, 1, sh(c.b, .1), 0);
    },
    staff: function (ctx, c) { limb(ctx, -6, 6, 12, -10, 4, sh(c.a, -.15)); circle(ctx, 15, -13, 5.4, c.b, 2); circle(ctx, 15, -13, 2.4, '#fff', 0); },
    sword: function (ctx, c) { poly(ctx, [2, -2.6, 26, -1.8, 31, 0, 26, 1.8, 2, 2.6], c.b); rr(ctx, 0, 0, 5, 9, 1.6, sh(c.a, -.2)); rr(ctx, -5, 0, 6, 4, 1.6, c.a); },
    greatsword: function (ctx, c) { poly(ctx, [2, -5, 30, -4, 38, 0, 30, 4, 2, 5], c.b); rr(ctx, -1, 0, 5, 14, 2, sh(c.a, -.25)); rr(ctx, -7, 0, 7, 5, 2, c.a); },
    spear: function (ctx, c) { limb(ctx, -6, 0, 26, 0, 3.4, sh(c.a, -.2)); poly(ctx, [26, -4, 38, 0, 26, 4], c.b); },
    hammer: function (ctx, c) { limb(ctx, -6, 0, 20, 0, 4, sh(c.a, -.25)); rr(ctx, 25, 0, 13, 16, 3, c.b); rr(ctx, 25, 0, 13, 6, 2, sh(c.b, .18), 0); },
    dagger: function (ctx, c) { poly(ctx, [2, -2, 15, -1.4, 19, 0, 15, 1.4, 2, 2], c.b); rr(ctx, 0, 0, 4, 7, 1.4, sh(c.a, -.2)); },
    shuriken: function (ctx, c) { for (var i = 0; i < 4; i++) { ctx.save(); ctx.rotate(i * TAU / 4); poly(ctx, [0, -3, 12, 0, 0, 3], c.b); ctx.restore(); } circle(ctx, 0, 0, 2.6, sh(c.a, -.2), 1.4); },
    tesla: function (ctx, c) { rr(ctx, 6, 0, 18, 7, 3, c.a); rr(ctx, -2, 3, 7, 6, 2, sh(c.a, -.3)); circle(ctx, 18, 0, 4.4, c.b, 2); circle(ctx, 18, 0, 1.8, '#fff', 0); ctx.strokeStyle = c.b; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(18, 0, 7, -1, 1); ctx.stroke(); },
    flamer: function (ctx, c) { rr(ctx, 8, 0, 22, 7, 2.4, c.a); circle(ctx, 20, 0, 4.6, sh(c.a, -.4), 2); rr(ctx, -3, 2, 9, 8, 2.4, sh(c.b, -.2)); rr(ctx, 2, -5.4, 12, 3.4, 1.6, sh(c.b, .05)); },
    orb: function (ctx, c) { circle(ctx, 12, 0, 6.4, c.b, 2); circle(ctx, 12, 0, 2.8, '#fff', 0); limb(ctx, -4, 3, 7, 0, 3.4, sh(c.a, -.2)); }
  };
  function weapon(ctx, x, y, a, s, w) {
    var f = WSHAPE[w.shape] || WSHAPE.pistol;
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    if (Math.cos(a) < 0) ctx.scale(1, -1);
    ctx.scale(s, s); ctx.lineJoin = 'round';
    f(ctx, w.col || { a: '#6b7280', b: '#cfd6e4' });
    ctx.restore();
  }

  /* ============ 主角 ============ */
  function hero(ctx, x, y, s, o) {
    o = o || {};
    var pal = o.pal, aim = o.aim || 0, mt = o.moveT || 0, fx = Math.cos(aim) < 0 ? -1 : 1;
    var bob = o.moving ? Math.sin(mt * .32) * 1.7 * s : Math.sin(mt * .07) * .7 * s;
    ctx.save(); ctx.translate(x, y); ctx.lineJoin = 'round';
    if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
    var S = s;
    /* 腿 */
    var lo = o.moving ? Math.sin(mt * .32) * 3.4 * S : 0;
    limb(ctx, -4 * S, 4 * S, (-4 + lo * .4) * S, (12 + Math.abs(lo) * .2) * S, 5 * S, sh(pal.pants, -.1));
    limb(ctx, 4 * S, 4 * S, (4 - lo * .4) * S, (12 - Math.abs(lo) * .2) * S, 5 * S, pal.pants);
    /* 身体 */
    ctx.save(); ctx.translate(0, bob);
    rr(ctx, 0, 2 * S, 19 * S, 17 * S, 6 * S, pal.body, 2.3 * S);
    rr(ctx, -1 * S, -1 * S, 12 * S, 7 * S, 3 * S, sh(pal.body, .16), 0);
    if (pal.belt) rr(ctx, 0, 8 * S, 19 * S, 4 * S, 1.5 * S, pal.belt, 0);
    /* 披风 */
    if (pal.cape) { ctx.save(); ctx.globalAlpha = (o.alpha === undefined ? 1 : o.alpha) * .95; poly(ctx, [-9 * S, -2 * S, 9 * S, -2 * S, 6 * S + lo * .5, 15 * S, -6 * S + lo * .5, 15 * S], pal.cape, 2 * S); ctx.restore(); }
    /* 头 */
    var hy = -11 * S;
    circle(ctx, fx * 1 * S, hy, 8.6 * S, pal.skin, 2.3 * S);
    /* 头发/头盔 */
    if (pal.hat === 'helm') {
      ctx.beginPath(); ctx.arc(fx * 1 * S, hy - .5 * S, 9 * S, Math.PI * 1.02, Math.PI * 2.02); ctx.closePath();
      ctx.fillStyle = pal.hair; ctx.lineWidth = 2.2 * S; ctx.strokeStyle = OL; ctx.stroke(); ctx.fill();
      rr(ctx, fx * 1 * S, hy - 9 * S, 4 * S, 7 * S, 1.6 * S, sh(pal.hair, .2));
    } else if (pal.hat === 'hood') {
      poly(ctx, [fx * -8 * S, hy + 3 * S, fx * 1 * S, hy - 12 * S, fx * 10 * S, hy + 3 * S, fx * 6 * S, hy + 6 * S, fx * -5 * S, hy + 6 * S], pal.hair, 2.2 * S);
    } else if (pal.hat === 'pony') {
      ctx.beginPath(); ctx.arc(fx * 1 * S, hy - 1 * S, 9 * S, Math.PI * 1.05, Math.PI * 2.05); ctx.closePath();
      ctx.fillStyle = pal.hair; ctx.lineWidth = 2.2 * S; ctx.strokeStyle = OL; ctx.stroke(); ctx.fill();
      limb(ctx, fx * -6 * S, hy - 2 * S, fx * -14 * S, hy + 6 * S, 5 * S, pal.hair);
    } else if (pal.hat === 'wizard') {
      poly(ctx, [fx * -10 * S, hy - 2 * S, fx * 10 * S, hy - 2 * S, fx * 3 * S, hy - 20 * S], pal.hair, 2.2 * S);
      rr(ctx, fx * 1 * S, hy - 2.5 * S, 22 * S, 3.4 * S, 1.4 * S, sh(pal.hair, -.2));
    } else {
      ctx.beginPath(); ctx.arc(fx * 1 * S, hy - 1 * S, 9.2 * S, Math.PI * 1.02, Math.PI * 2.02); ctx.closePath();
      ctx.fillStyle = pal.hair; ctx.lineWidth = 2.2 * S; ctx.strokeStyle = OL; ctx.stroke(); ctx.fill();
    }
    /* 眼睛 */
    if (!o.dead) {
      var ex = fx * 3.2 * S, ey = hy + 1.4 * S;
      ctx.fillStyle = '#1a1626';
      ctx.beginPath(); ctx.ellipse(ex, ey, 1.5 * S, 2 * S, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(ex - fx * 5.6 * S, ey, 1.5 * S, 2 * S, 0, 0, TAU); ctx.fill();
    }
    ctx.restore();
    /* 手臂 + 武器 */
    var hx = Math.cos(aim) * 13 * S, hy2 = Math.sin(aim) * 13 * S + 2 * S + bob;
    limb(ctx, fx * 6 * S, 2 * S + bob, hx, hy2, 4.4 * S, pal.skin);
    if (o.weapon) weapon(ctx, hx, hy2, aim, S, o.weapon);
    limb(ctx, fx * -6 * S, 3 * S + bob, fx * -9 * S + Math.cos(aim) * 4 * S, 7 * S + bob, 4.2 * S, sh(pal.skin, -.12));
    ctx.restore();
  }

  /* ============ 敌人 ============ */
  var EART = {
    slime: function (ctx, s, o, c) {
      var w = 1 + Math.sin(o.t * .12) * .12, h = 1 - Math.sin(o.t * .12) * .1;
      ell(ctx, 0, 2 * s, 13 * s * w, 11 * s * h, c.a, 0, 2.4 * s);
      ell(ctx, -4 * s, -2 * s, 4 * s, 3 * s, sh(c.a, .3), 0, 0);
      eyes(ctx, s, o, 0, 0, 3.2);
    },
    bat: function (ctx, s, o, c) {
      var f = Math.sin(o.t * .5);
      poly(ctx, [-3 * s, 0, -16 * s, (-6 - f * 5) * s, -12 * s, 3 * s], c.a, 2 * s);
      poly(ctx, [3 * s, 0, 16 * s, (-6 - f * 5) * s, 12 * s, 3 * s], c.a, 2 * s);
      circle(ctx, 0, 0, 8 * s, sh(c.a, .1), 2.2 * s);
      poly(ctx, [-6 * s, -5 * s, -3 * s, -12 * s, -1 * s, -5 * s], sh(c.a, -.1), 1.6 * s);
      poly(ctx, [6 * s, -5 * s, 3 * s, -12 * s, 1 * s, -5 * s], sh(c.a, -.1), 1.6 * s);
      eyes(ctx, s, o, 0, 0, 2.6, '#ff5a4a');
    },
    skeleton: function (ctx, s, o, c) {
      limb(ctx, -4 * s, 6 * s, -5 * s, 14 * s, 4 * s, c.a);
      limb(ctx, 4 * s, 6 * s, 5 * s, 14 * s, 4 * s, c.a);
      rr(ctx, 0, 2 * s, 14 * s, 14 * s, 4 * s, c.a, 2.2 * s);
      ctx.strokeStyle = sh(c.a, -.25); ctx.lineWidth = 1.4 * s;
      for (var i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-5 * s, (-2 + i * 4) * s); ctx.lineTo(5 * s, (-2 + i * 4) * s); ctx.stroke(); }
      circle(ctx, 0, -11 * s, 8 * s, sh(c.a, .12), 2.2 * s);
      ctx.fillStyle = '#241f2e';
      ctx.beginPath(); ctx.arc(-3 * s, -11 * s, 2.4 * s, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(3 * s, -11 * s, 2.4 * s, 0, TAU); ctx.fill();
      ctx.fillRect(-2 * s, -6 * s, 4 * s, 2 * s);
    },
    archer: function (ctx, s, o, c) {
      body(ctx, s, o, c); hood(ctx, s, o, c, '#3a8f52');
    },
    gunner: function (ctx, s, o, c) { body(ctx, s, o, c); helm(ctx, s, o, c); },
    caster: function (ctx, s, o, c) {
      poly(ctx, [-11 * s, 12 * s, -7 * s, -6 * s, 7 * s, -6 * s, 11 * s, 12 * s], c.a, 2.3 * s);
      circle(ctx, 0, -11 * s, 7.6 * s, '#2a2438', 2.2 * s);
      circle(ctx, -2.6 * s, -11 * s, 1.7 * s, '#9adfff', 0);
      circle(ctx, 2.6 * s, -11 * s, 1.7 * s, '#9adfff', 0);
      var p = 1 + Math.sin(o.t * .18) * .2;
      circle(ctx, 12 * s, 0, 4.4 * s * p, c.b, 1.8 * s);
    },
    bomber: function (ctx, s, o, c) {
      var pulse = o.telegraph ? 1 + Math.sin(o.t * 1.1) * .16 : 1;
      circle(ctx, 0, 0, 12 * s * pulse, o.telegraph && (o.t % 8 < 4) ? '#ff6a4a' : c.a, 2.4 * s);
      limb(ctx, 0, -12 * s, 3 * s, -18 * s, 2.4 * s, '#8a7a5a');
      circle(ctx, 4 * s, -19 * s, 2 * s, '#ffb04a', 0);
      eyes(ctx, s, o, 0, 1, 2.8, '#fff');
    },
    golem: function (ctx, s, o, c) {
      rr(ctx, 0, 4 * s, 26 * s, 22 * s, 7 * s, c.a, 2.6 * s);
      rr(ctx, -9 * s, -2 * s, 8 * s, 8 * s, 2 * s, sh(c.a, .18), 0);
      circle(ctx, 0, -13 * s, 9 * s, sh(c.a, -.1), 2.4 * s);
      circle(ctx, -3.4 * s, -13 * s, 2 * s, '#ffd15c', 0);
      circle(ctx, 3.4 * s, -13 * s, 2 * s, '#ffd15c', 0);
      limb(ctx, -14 * s, 0, -20 * s, 10 * s, 7 * s, sh(c.a, -.08));
      limb(ctx, 14 * s, 0, 20 * s, 10 * s, 7 * s, sh(c.a, -.08));
    },
    spider: function (ctx, s, o, c) {
      for (var i = 0; i < 4; i++) {
        var ph = Math.sin(o.t * .3 + i) * 3 * s;
        limb(ctx, -5 * s, 0, (-16 - i * 1.5) * s, (-8 + i * 6) * s + ph, 2.4 * s, sh(c.a, -.2));
        limb(ctx, 5 * s, 0, (16 + i * 1.5) * s, (-8 + i * 6) * s - ph, 2.4 * s, sh(c.a, -.2));
      }
      ell(ctx, 0, 3 * s, 11 * s, 9 * s, c.a, 0, 2.3 * s);
      circle(ctx, 0, -6 * s, 7 * s, sh(c.a, .1), 2.2 * s);
      eyes(ctx, s, o, 0, -6, 2.2, '#ff4a6a');
    },
    ghost: function (ctx, s, o, c) {
      ctx.save(); ctx.globalAlpha = .72;
      var wob = Math.sin(o.t * .1) * 2 * s;
      poly(ctx, [-11 * s, -4 * s, -8 * s, -14 * s, 8 * s, -14 * s, 11 * s, -4 * s,
        8 * s, 8 * s + wob, 4 * s, 2 * s, 0, 9 * s - wob, -4 * s, 2 * s, -8 * s, 8 * s + wob], c.a, 2.2 * s);
      ctx.restore();
      circle(ctx, -3.4 * s, -8 * s, 2.2 * s, '#1a1626', 0);
      circle(ctx, 3.4 * s, -8 * s, 2.2 * s, '#1a1626', 0);
    },
    plant: function (ctx, s, o, c) {
      limb(ctx, 0, 14 * s, 0, 0, 5 * s, '#3f7a3a');
      var open = o.telegraph ? 1.25 : 1;
      circle(ctx, 0, -4 * s, 11 * s * open, c.a, 2.4 * s);
      for (var i = 0; i < 5; i++) {
        var a = -Math.PI / 2 + (i - 2) * .5;
        poly(ctx, [Math.cos(a) * 8 * s, Math.sin(a) * 8 * s - 4 * s, Math.cos(a) * 17 * s * open, Math.sin(a) * 17 * s * open - 4 * s,
          Math.cos(a + .3) * 8 * s, Math.sin(a + .3) * 8 * s - 4 * s], sh(c.a, -.22), 1.6 * s);
      }
      circle(ctx, 0, -4 * s, 4 * s, '#2a1420', 0);
    },
    /* —— Boss —— */
    bossSkull: function (ctx, s, o, c) {
      var t = o.t;
      limb(ctx, -16 * s, 8 * s, -24 * s, 26 * s, 9 * s, c.a);
      limb(ctx, 16 * s, 8 * s, 24 * s, 26 * s, 9 * s, c.a);
      rr(ctx, 0, 4 * s, 40 * s, 34 * s, 10 * s, c.a, 3 * s);
      ctx.strokeStyle = sh(c.a, -.3); ctx.lineWidth = 2 * s;
      for (var i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-14 * s, (-8 + i * 7) * s); ctx.lineTo(14 * s, (-8 + i * 7) * s); ctx.stroke(); }
      circle(ctx, 0, -22 * s, 20 * s, sh(c.a, .1), 3 * s);
      poly(ctx, [-20 * s, -30 * s, -4 * s, -46 * s, 0, -34 * s, 4 * s, -46 * s, 20 * s, -30 * s], c.b, 2.6 * s);
      ctx.fillStyle = '#ff4a3a';
      circle(ctx, -7 * s, -22 * s, 5 * s, '#2a1018', 0);
      circle(ctx, 7 * s, -22 * s, 5 * s, '#2a1018', 0);
      var glow = .6 + Math.sin(t * .12) * .4;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = glow;
      circle(ctx, -7 * s, -22 * s, 3.2 * s, '#ff6a3a', 0); circle(ctx, 7 * s, -22 * s, 3.2 * s, '#ff6a3a', 0);
      ctx.restore();
      ctx.fillStyle = '#2a1018';
      for (i = 0; i < 5; i++) ctx.fillRect((-10 + i * 5) * s, -14 * s, 3 * s, 5 * s);
    },
    bossSlime: function (ctx, s, o, c) {
      var w = 1 + Math.sin(o.t * .09) * .1, h = 1 - Math.sin(o.t * .09) * .09;
      ell(ctx, 0, 6 * s, 34 * s * w, 28 * s * h, c.a, 0, 3 * s);
      ctx.save(); ctx.globalAlpha = .5; ell(ctx, -12 * s, -6 * s, 10 * s, 7 * s, '#fff', 0, 0); ctx.restore();
      ell(ctx, 0, 10 * s, 14 * s, 8 * s, sh(c.a, -.25), 0, 0);
      circle(ctx, -12 * s, -2 * s, 6 * s, '#fff', 2 * s); circle(ctx, 12 * s, -2 * s, 6 * s, '#fff', 2 * s);
      circle(ctx, -11 * s, -1 * s, 3 * s, '#1a1626', 0); circle(ctx, 13 * s, -1 * s, 3 * s, '#1a1626', 0);
      poly(ctx, [-8 * s, 12 * s, 0, 20 * s, 8 * s, 12 * s], '#2a1420', 1.8 * s);
      circle(ctx, 0, 0, 8 * s, c.b, 2 * s);
    },
    bossMech: function (ctx, s, o, c) {
      for (var i = 0; i < 3; i++) {
        var ph = Math.sin(o.t * .16 + i * 1.2) * 5 * s;
        limb(ctx, -16 * s, 0, (-34 - i * 3) * s, (-14 + i * 14) * s + ph, 4.6 * s, sh(c.a, -.25));
        limb(ctx, 16 * s, 0, (34 + i * 3) * s, (-14 + i * 14) * s - ph, 4.6 * s, sh(c.a, -.25));
      }
      rr(ctx, 0, 0, 46 * s, 34 * s, 10 * s, c.a, 3 * s);
      rr(ctx, 0, -4 * s, 30 * s, 14 * s, 5 * s, sh(c.a, .14), 0);
      circle(ctx, 0, 0, 11 * s, c.b, 2.6 * s);
      var g = .5 + Math.sin(o.t * .2) * .5;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = g;
      circle(ctx, 0, 0, 7 * s, '#ff3a5a', 0); ctx.restore();
      rr(ctx, -22 * s, -16 * s, 10 * s, 8 * s, 2 * s, sh(c.a, -.15));
      rr(ctx, 22 * s, -16 * s, 10 * s, 8 * s, 2 * s, sh(c.a, -.15));
    }
  };
  function body(ctx, s, o, c) {
    limb(ctx, -4 * s, 6 * s, -5 * s, 13 * s, 4.4 * s, sh(c.a, -.3));
    limb(ctx, 4 * s, 6 * s, 5 * s, 13 * s, 4.4 * s, sh(c.a, -.3));
    rr(ctx, 0, 2 * s, 17 * s, 15 * s, 5 * s, c.a, 2.3 * s);
    circle(ctx, 0, -10 * s, 8 * s, c.skin || '#d8a273', 2.2 * s);
  }
  function hood(ctx, s, o, c, col) {
    poly(ctx, [-9 * s, -7 * s, 0, -20 * s, 9 * s, -7 * s, 6 * s, -4 * s, -6 * s, -4 * s], col || sh(c.a, -.2), 2.2 * s);
    ctx.fillStyle = '#1a1626';
    circle(ctx, -3 * s, -10 * s, 1.8 * s, '#ffd15c', 0); circle(ctx, 3 * s, -10 * s, 1.8 * s, '#ffd15c', 0);
  }
  function helm(ctx, s, o, c) {
    ctx.beginPath(); ctx.arc(0, -11 * s, 9 * s, Math.PI, TAU); ctx.closePath();
    ctx.fillStyle = sh(c.a, -.3); ctx.lineWidth = 2.2 * s; ctx.strokeStyle = OL; ctx.stroke(); ctx.fill();
    ctx.fillStyle = '#1a1626'; ctx.fillRect(-6 * s, -11 * s, 12 * s, 3 * s);
    ctx.fillStyle = '#ff8a4a'; ctx.fillRect(-5 * s, -10.4 * s, 3 * s, 1.8 * s);
  }
  function eyes(ctx, s, o, ox, oy, r, col) {
    ctx.fillStyle = col || '#1a1626';
    ctx.beginPath(); ctx.arc((ox - 3.6) * s, oy * s, r * .5 * s, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc((ox + 3.6) * s, oy * s, r * .5 * s, 0, TAU); ctx.fill();
  }
  function enemy(ctx, x, y, s, kind, o) {
    var f = EART[kind] || EART.slime;
    ctx.save(); ctx.translate(x, y); ctx.lineJoin = 'round';
    if (o.flip) ctx.scale(-1, 1);
    if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
    f(ctx, s, o, o.col || { a: '#7fd06a', b: '#ffd15c' });
    ctx.restore();
  }

  /* ============ 道具 / 场景物件 ============ */
  var IART = {
    coin: function (ctx, s, t) { var w = Math.abs(Math.cos(t * .08)) * .7 + .3; ell(ctx, 0, 0, 6 * s * w, 6 * s, '#ffcf3a', 0, 1.8 * s); if (w > .5) { ctx.fillStyle = '#fff0a0'; ctx.fillRect(-1.4 * s * w, -2.6 * s, 2.8 * s * w, 5.2 * s); } },
    gem: function (ctx, s, t) { ctx.save(); ctx.rotate(Math.sin(t * .05) * .2); poly(ctx, [0, -8 * s, 7 * s, -1 * s, 0, 8 * s, -7 * s, -1 * s], '#7ad4ff', 1.8 * s); poly(ctx, [0, -8 * s, 3 * s, -1 * s, 0, 3 * s, -3 * s, -1 * s], '#d8f4ff', 0); ctx.restore(); },
    heart: function (ctx, s, t) { var p = 1 + Math.sin(t * .12) * .09; ctx.save(); ctx.scale(p, p); poly(ctx, [0, 7 * s, -7 * s, -1 * s, -4 * s, -6 * s, 0, -3 * s, 4 * s, -6 * s, 7 * s, -1 * s], '#ff4a6a', 1.8 * s); ctx.restore(); },
    armor: function (ctx, s, t) { poly(ctx, [0, -8 * s, 7 * s, -4 * s, 7 * s, 3 * s, 0, 8 * s, -7 * s, 3 * s, -7 * s, -4 * s], '#7fb0ff', 1.8 * s); ctx.fillStyle = '#d8e8ff'; ctx.fillRect(-1.4 * s, -4 * s, 2.8 * s, 8 * s); },
    energy: function (ctx, s, t) { poly(ctx, [-2 * s, -9 * s, 5 * s, -2 * s, 1 * s, -1 * s, 4 * s, 9 * s, -5 * s, 1 * s, -1 * s, 0], '#9affe0', 1.6 * s); },
    key: function (ctx, s, t) { circle(ctx, -3 * s, 0, 4 * s, '#ffd15c', 1.6 * s); ctx.fillStyle = '#ffd15c'; ctx.fillRect(0, -1.2 * s, 9 * s, 2.4 * s); ctx.fillRect(6 * s, 0, 2 * s, 4 * s); },
    chest: function (ctx, s, t, o) {
      var open = o && o.open;
      rr(ctx, 0, 4 * s, 30 * s, 18 * s, 3 * s, '#8a5a2a', 2.4 * s);
      ctx.save(); ctx.translate(0, -5 * s); if (open) ctx.rotate(-.8);
      rr(ctx, 0, 0, 30 * s, 12 * s, 4 * s, '#a06a30', 2.4 * s); ctx.restore();
      rr(ctx, 0, 1 * s, 7 * s, 8 * s, 1.6 * s, '#ffcf3a', 1.8 * s);
      if (open) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; var g = ctx.createRadialGradient(0, 0, 0, 0, 0, 26 * s); g.addColorStop(0, 'rgba(255,220,120,.7)'); g.addColorStop(1, 'rgba(255,180,60,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 26 * s, 0, TAU); ctx.fill(); ctx.restore(); }
    },
    barrel: function (ctx, s) { rr(ctx, 0, 0, 26 * s, 30 * s, 6 * s, '#6a4a2a', 2.4 * s); ctx.strokeStyle = '#3a2a18'; ctx.lineWidth = 2 * s; ctx.beginPath(); ctx.moveTo(-13 * s, -6 * s); ctx.lineTo(13 * s, -6 * s); ctx.moveTo(-13 * s, 6 * s); ctx.lineTo(13 * s, 6 * s); ctx.stroke(); circle(ctx, 0, -15 * s, 10 * s, '#8a5f34', 2 * s); },
    bomb: function (ctx, s, t) { circle(ctx, 0, 2 * s, 13 * s, '#2c2c3a', 2.4 * s); limb(ctx, 3 * s, -10 * s, 8 * s, -18 * s, 2.4 * s, '#8a7a5a'); circle(ctx, 9 * s, -19 * s, 2.6 * s, t % 10 < 5 ? '#ffd15c' : '#ff6a3a', 0); },
    crate: function (ctx, s) { rr(ctx, 0, 0, 28 * s, 28 * s, 3 * s, '#9a7a4a', 2.4 * s); ctx.strokeStyle = '#5a4020'; ctx.lineWidth = 2.4 * s; ctx.beginPath(); ctx.moveTo(-14 * s, -14 * s); ctx.lineTo(14 * s, 14 * s); ctx.moveTo(14 * s, -14 * s); ctx.lineTo(-14 * s, 14 * s); ctx.stroke(); },
    pot: function (ctx, s) { ell(ctx, 0, 2 * s, 12 * s, 14 * s, '#7a8a9a', 0, 2.4 * s); rr(ctx, 0, -12 * s, 14 * s, 5 * s, 2 * s, '#5a6a7a'); },
    torch: function (ctx, s, t) {
      rr(ctx, 0, 6 * s, 6 * s, 26 * s, 2 * s, '#5a3f22', 2 * s);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      var fl = 1 + Math.sin(t * .3) * .18;
      var g = ctx.createRadialGradient(0, -12 * s, 0, 0, -12 * s, 22 * s * fl);
      g.addColorStop(0, 'rgba(255,230,150,.95)'); g.addColorStop(.4, 'rgba(255,150,40,.55)'); g.addColorStop(1, 'rgba(255,90,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, -12 * s, 22 * s * fl, 0, TAU); ctx.fill(); ctx.restore();
    },
    portal: function (ctx, s, t) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (var i = 0; i < 4; i++) {
        var r = (10 + i * 7) * s, a = t * (.02 + i * .01);
        ctx.strokeStyle = i % 2 ? '#9a6bff' : '#6ad4ff'; ctx.lineWidth = 3 * s;
        ctx.globalAlpha = .8 - i * .15;
        ctx.beginPath(); ctx.ellipse(0, 0, r, r * (.55 + Math.sin(t * .05 + i) * .12), a, 0, TAU); ctx.stroke();
      }
      var g = ctx.createRadialGradient(0, 0, 0, 0, 0, 34 * s);
      g.addColorStop(0, 'rgba(200,180,255,.75)'); g.addColorStop(1, 'rgba(120,60,255,0)');
      ctx.fillStyle = g; ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(0, 0, 34 * s, 0, TAU); ctx.fill();
      ctx.restore();
    },
    shrine: function (ctx, s, t) {
      poly(ctx, [-14 * s, 14 * s, -10 * s, -10 * s, 10 * s, -10 * s, 14 * s, 14 * s], '#6a6a8a', 2.6 * s);
      circle(ctx, 0, -16 * s, 8 * s, '#ffd15c', 2.2 * s);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .5 + Math.sin(t * .08) * .3;
      circle(ctx, 0, -16 * s, 13 * s, 'rgba(255,220,120,.5)', 0); ctx.restore();
    },
    statue: function (ctx, s) { poly(ctx, [-12 * s, 18 * s, -8 * s, -8 * s, 8 * s, -8 * s, 12 * s, 18 * s], '#5e6478', 2.6 * s); circle(ctx, 0, -16 * s, 9 * s, '#6e7488', 2.4 * s); poly(ctx, [-9 * s, -20 * s, 0, -30 * s, 9 * s, -20 * s], '#4e5468', 2 * s); },
    turret: function (ctx, s, t, o) {
      circle(ctx, 0, 0, 11 * s, '#5a7a9a', 2.4 * s);
      circle(ctx, 0, 0, 5 * s, '#9adfff', 1.8 * s);
      ctx.save(); ctx.rotate((o && o.aim) || 0); rr(ctx, 10 * s, 0, 16 * s, 6 * s, 2 * s, '#7a9aba', 2 * s); ctx.restore();
    }
  };
  function item(ctx, x, y, s, kind, t, o) {
    var f = IART[kind]; if (!f) return;
    ctx.save(); ctx.translate(x, y); ctx.lineJoin = 'round';
    if (o && o.alpha !== undefined) ctx.globalAlpha = o.alpha;
    f(ctx, s, t || 0, o); ctx.restore();
  }

  K.Art = { hero: hero, enemy: enemy, weapon: weapon, item: item, shadow: shadow, sh: sh, hex: hex,
    circle: circle, rr: rr, poly: poly, limb: limb, ell: ell, WSHAPE: WSHAPE, IART: IART, EART: EART, OL: OL };
})(window.K);
