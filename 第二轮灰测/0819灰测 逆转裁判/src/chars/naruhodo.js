/* ============================================================
   naruhodo.js — 成步堂 龙一（辩护律师）
   【参考实现】其余角色请遵循同样的结构与画法：
     ・骨架基准（画布 148×232，脚底 y=222，含发全高 200px）
         发梢顶 y≈22 / 颅顶 38 / 头心 62 / 下巴 87 / 肩线 100
         肩点 (74±30, 106) / 腰 152 / 膝 190 / 脚 218
     ・手用 hL/hR = [相对肩点的 dx,dy] 指定，IK 自动求肘
     ・颜色一律取自本文件顶部的 C 表，并登记进 paletteList
   ============================================================ */
(function (AA) {
  'use strict';
  var U = AA.U, P = AA.PAL, RIG = AA.RIG;
  var D = Math.PI / 180;

  /* ---------------- 配色 ---------------- */
  var C = {
    suit: '#33488c', suitLo: '#22305e', suitHi: '#48609f', suitEdge: '#18224a',
    shirt: '#f2f0e6', shirtLo: '#cfcdc0',
    tie: '#bc323c', tieLo: '#7f1f27', tieHi: '#d75a5e',
    hair: '#1b1e2a', hairHi: '#303a56', hairHi2: '#3d4a70',
    shoe: '#24242c', shoeHi: '#3c3c46',
    badge: '#e0b24a', badgeHi: '#f6dd94', badgeRed: '#c8343e',
    pants: '#2a3a72', pantsLo: '#1b2450'
  };
  var SK = P.skin;

  /* 骨架常量 */
  var CX = 74, HAIRTOP = 22, HY = 62, HRX = 24, HRY = 25;
  var CHIN = 87, SHY = 100, SHOULDER = 106, SHX = 30, HIP = 152;
  var L1 = 32, L2 = 28;

  function draw(pen, s) {
    var bob = s.bob || 0;
    var hip = HIP + bob, shy = SHY + bob, shoulder = SHOULDER + bob;

    /* ================= 腿 ================= */
    var st = s.stance || 0;
    RIG.leg(pen, CX - 13 - st, hip + 2, -2 + (s.legL || 0), 2, 36, 30, 20, 14, C.pants, C.pantsLo, C.shoe, -1);
    RIG.leg(pen, CX + 13 + st, hip + 2, 2 + (s.legR || 0), -2, 36, 30, 20, 14, C.pants, C.pantsLo, C.shoe, 1);
    pen.taper([[CX - 11, hip], [CX, hip + 11], [CX + 11, hip]], 5, 5, C.pantsLo);

    /* ================= 上身（可倾斜） ================= */
    pen.save();
    if (s.lean) { pen.translate(CX, hip); pen.rotate(s.lean * D); pen.translate(-CX, -hip); }

    /* 西装 */
    var jacket = [
      [CX - 28, shy], [CX - 34, shy + 14], [CX - 32, shy + 34],
      [CX - 28, hip + 6], [CX - 11, hip + 12], [CX, hip + 13], [CX + 11, hip + 12],
      [CX + 28, hip + 6], [CX + 32, shy + 34], [CX + 34, shy + 14], [CX + 28, shy],
      [CX + 15, shy - 6], [CX, shy - 8], [CX - 15, shy - 6]
    ];
    pen.blob(jacket, C.suit, .92);
    pen.clipBlob(jacket, function (p) {
      // 右侧（观众右）暗面
      p.blob([[CX + 12, shy - 16], [CX + 42, shy - 6], [CX + 42, hip + 22], [CX + 17, hip + 22]], C.suitLo, .55);
      // 左肩亮面（收窄，避免抢戏）
      p.blob([[CX - 30, shy - 4], [CX - 19, shy - 2], [CX - 21, shy + 34], [CX - 31, shy + 28]], C.suitHi, .6);
      // 腰部暗
      p.blob([[CX - 32, hip - 6], [CX + 32, hip - 6], [CX + 30, hip + 16], [CX - 30, hip + 16]], C.suitLo, .5);
    }, .92);

    /* 衬衫 V 区 */
    var vee = [[CX - 12, shy - 6], [CX, shy - 2], [CX + 12, shy - 6],
    [CX + 10, shy + 24], [CX, shy + 36], [CX - 10, shy + 24]];
    pen.blob(vee, C.shirt, .85);
    pen.clipBlob(vee, function (p) {
      p.blob([[CX + 2, shy - 12], [CX + 17, shy - 8], [CX + 17, shy + 42], [CX + 3, shy + 42]], C.shirtLo, .6);
    }, .85);
    pen.poly([[CX - 12, shy - 7], [CX - 3, shy - 1], [CX - 8, shy + 8], [CX - 15, shy - 1]], C.shirt);
    pen.poly([[CX + 12, shy - 7], [CX + 3, shy - 1], [CX + 8, shy + 8], [CX + 15, shy - 1]], C.shirtLo);

    /* 领带 */
    pen.poly([[CX - 4, shy - 1], [CX + 4, shy - 1], [CX + 3, shy + 7], [CX - 3, shy + 7]], C.tie);
    pen.blob([[CX - 3, shy + 6], [CX + 3, shy + 6], [CX + 6, shy + 22], [CX, shy + 32], [CX - 6, shy + 22]], C.tie, .85);
    pen.blob([[CX + 1, shy + 7], [CX + 3.4, shy + 7], [CX + 5, shy + 22], [CX + 1, shy + 28]], C.tieLo, .8);
    pen.ellipse(CX - 1.2, shy + 12, 1.5, 3.2, C.tieHi);

    /* 翻领 */
    pen.poly([[CX - 14, shy - 7], [CX - 2, shy], [CX - 11, shy + 28], [CX - 24, shy + 8]], C.suitHi);
    pen.poly([[CX + 14, shy - 7], [CX + 2, shy], [CX + 11, shy + 28], [CX + 24, shy + 8]], C.suitLo);
    RIG.ink(pen, [[CX - 14, shy - 7], [CX - 2, shy], [CX - 11, shy + 28]], 1.2, C.suitEdge);
    RIG.ink(pen, [[CX + 14, shy - 7], [CX + 2, shy], [CX + 11, shy + 28]], 1.2, C.suitEdge);

    /* 律师徽章 */
    pen.circle(CX + 19, shy + 13, 4.4, C.badge);
    pen.circle(CX + 19, shy + 13, 2.8, C.badgeRed);
    pen.circle(CX + 17.8, shy + 11.8, 1.4, C.badgeHi);

    /* ================= 手臂 ================= */
    function arm(sx, sy, off, dark, kind, ang, bend) {
      var h = RIG.armTo(pen, sx, sy, sx + off[0], sy + off[1], L1, L2, 20, 16, 12,
        dark ? C.suitLo : C.suit, dark ? null : C.suitHi, bend, C.suitEdge);
      var dir = Math.atan2(h[1] - h[3], h[0] - h[2]);
      // 袖口
      pen.circle(h[0], h[1], 7.6, C.suitEdge);
      pen.circle(h[0], h[1], 6.6, dark ? C.suitLo : C.suit);
      pen.circle(h[0] + Math.cos(dir) * 1.6, h[1] + Math.sin(dir) * 1.6, 5.2, C.shirt);
      RIG.hand(pen, h[0] + Math.cos(dir) * 6.6, h[1] + Math.sin(dir) * 6.6, 6.2, SK.base, SK.lo,
        kind, ang == null ? dir : ang);
      return h;
    }
    arm(CX + SHX, shoulder, s.hR, true, s.kindR, s.angR, 1);
    arm(CX - SHX, shoulder, s.hL, false, s.kindL, s.angL, -1);

    /* ================= 头 ================= */
    var hx = CX + (s.headX || 0), hy = HY + bob + (s.headY || 0);
    // 脖子
    pen.taper([[CX, shy - 4], [hx, hy + 22]], 16, 14, SK.lo);
    pen.taper([[CX - 0.5, shy - 3], [hx - 1, hy + 22]], 11, 10, SK.base);

    pen.save();
    if (s.headTilt) { pen.translate(hx, hy + 24); pen.rotate(s.headTilt * D); pen.translate(-hx, -(hy + 24)); }

    /* 尖刺发（向后上方放射） */
    var spikes = [
      [-90, 30, 16, -2], [-108, 28, 15, 4], [-72, 28, 15, -5],
      [-127, 24, 13, 5], [-53, 24, 13, -6], [-146, 20, 11, 4], [-34, 19, 11, -5],
      [-163, 15, 9, 3], [-18, 14, 9, -4]
    ];
    for (var i = 0; i < spikes.length; i++) {
      var sp = spikes[i], a = sp[0] * D;
      pen.spike(hx + Math.cos(a) * 19, hy + Math.sin(a) * 20, sp[1], a, sp[2], C.hair, sp[3]);
    }
    // 后脑发块
    pen.blob([[hx - 26, hy - 4], [hx - 21, hy - 22], [hx, hy - 29], [hx + 21, hy - 22],
    [hx + 26, hy - 4], [hx + 23, hy + 8], [hx - 23, hy + 8]], C.hair, .95);

    /* 脸 */
    RIG.head(pen, hx, hy, HRX, HRY, SK, { jaw: .76, chin: 1.02 });

    /* 刘海（尖角形，压住上额，但露出足够脸） */
    var fringe = [
      [hx - 25, hy - 8], [hx - 21, hy - 22], [hx - 7, hy - 28], [hx + 9, hy - 28],
      [hx + 22, hy - 21], [hx + 25, hy - 7],
      [hx + 18, hy - 11], [hx + 12, hy - 3], [hx + 6, hy - 12],
      [hx, hy - 4], [hx - 7, hy - 13], [hx - 14, hy - 4], [hx - 19, hy - 12]
    ];
    pen.blob(fringe, C.hair, .8);
    pen.clipBlob(fringe, function (p) {
      p.blob([[hx - 18, hy - 24], [hx - 3, hy - 27], [hx + 1, hy - 21], [hx - 13, hy - 17]], C.hairHi, .7);
      p.blob([[hx + 7, hy - 25], [hx + 16, hy - 21], [hx + 17, hy - 16], [hx + 8, hy - 19]], C.hairHi2, .7);
    }, .8);
    // 鬓角
    pen.poly([[hx - 24, hy - 8], [hx - 19, hy - 5], [hx - 20, hy + 9], [hx - 25, hy + 3]], C.hair);
    pen.poly([[hx + 24, hy - 8], [hx + 19, hy - 5], [hx + 20, hy + 9], [hx + 25, hy + 3]], C.hair);

    /* 耳 */
    pen.ellipse(hx - 24, hy + 5, 3.4, 5.2, SK.base);
    pen.ellipse(hx + 24, hy + 5, 3.4, 5.2, SK.lo);

    /* 五官 */
    var eyeY = hy + 2;
    RIG.brow(pen, hx, eyeY - 10, 20, 4.2, s.brow, C.hair);
    RIG.eyes(pen, hx, eyeY, 19, 4.6, s.eyes, { pupil: s.pupil, iris: '#2b3142', turn: s.headTurn });
    pen.line([[hx + 1, eyeY + 4], [hx + 3.2, eyeY + 9], [hx + 0.4, eyeY + 10]], SK.line, 1.2, true);
    RIG.mouth(pen, hx + (s.headTurn || 0) * 2, hy + 16, 11, s.mouth, SK.line, '#93414a');
    if (s.blush) { RIG.blush(pen, hx - 15, hy + 9, 8); RIG.blush(pen, hx + 15, hy + 9, 8); }

    pen.restore();

    if (s.sweat) RIG.sweat(pen, hx + 26, hy - 14 + (s.sweatY || 0), 4.6, s.sweat, 0);
    if (s.symbol) RIG.symbol(pen, hx + (s.symbolX || 25), hy - 30, s.symbol, s.symbolCol || '#ffffff');

    pen.restore();
  }

  /* ---------------- 姿势 ---------------- */
  function tm(talk, f, open, closed) {
    return talk ? (f % 2 ? (open || 'open') : (closed || 'closed')) : (closed || 'closed');
  }

  var poses = {
    normal: function (f, talk) {
      return RIG.base({
        bob: f % 2 ? 0 : -1,
        eyes: f === 3 ? 'closed' : 'normal',
        mouth: tm(talk, f)
      });
    },
    think: function (f, talk) {
      return RIG.base({
        bob: f % 2 ? 0 : -1, lean: -1,
        hL: [-5, 58], hR: [-26, -14], kindR: 'fist',
        eyes: 'narrow', brow: 'down',
        mouth: talk ? (f % 2 ? 'open' : 'flat') : 'flat',
        headTilt: -3
      });
    },
    confident: function (f, talk) {
      return RIG.base({
        bob: f % 2 ? -1 : 0, lean: 1.5,
        hL: [-4, 58], hR: [34, 4], kindR: 'point', angR: -0.28,
        mouth: talk ? (f % 2 ? 'open' : 'smile') : 'smile',
        pupil: [0.2, -0.1]
      });
    },
    slam: function (f, talk) {
      return RIG.base({
        bob: f % 2 ? 1 : 0, lean: 4,
        hL: [-14, 24], hR: [14, 24], kindL: 'open', kindR: 'open',
        eyes: 'angry', brow: 'angry',
        mouth: talk ? (f % 2 ? 'shout' : 'wide') : 'wide',
        headY: 3
      });
    },
    objection: function (f, talk) {
      return RIG.base({
        bob: f % 2 ? 1 : 0, lean: 6,
        hL: [-8, 50], hR: [42, -6], kindR: 'point', angR: -0.1,
        eyes: 'angry', brow: 'angry',
        mouth: f % 2 ? 'shout' : 'wide',
        headY: 2, headTilt: 2
      });
    },
    sweat: function (f, talk) {
      return RIG.base({
        bob: f % 2 ? 0 : -1, lean: -2,
        hL: [-12, 52], hR: [10, 48],
        eyes: 'wide', brow: 'sad',
        mouth: talk ? (f % 2 ? 'open' : 'flat') : 'flat',
        sweat: 2, sweatY: f % 2 ? 0 : 2, headTilt: -2
      });
    },
    damage: function (f, talk) {
      return RIG.base({
        bob: f % 2 ? 2 : 0, lean: -7,
        hL: [-24, 4], hR: [22, 8], kindL: 'open', kindR: 'open',
        eyes: 'shut', brow: 'sad', mouth: 'wide',
        sweat: 3, headTilt: -6, headY: 4, stance: 3
      });
    },
    shock: function (f, talk) {
      return RIG.base({
        bob: f % 2 ? -2 : -1, lean: -3,
        hL: [-26, 14], hR: [26, 16], kindL: 'open', kindR: 'open',
        eyes: 'wide', brow: 'up', mouth: 'o', pupil: [0, -0.3],
        symbol: 'shock', headY: -2, stance: 2
      });
    },
    sad: function (f, talk) {
      return RIG.base({
        bob: f % 2 ? 0 : -1, lean: -3,
        hL: [-4, 58], hR: [4, 58],
        eyes: 'sad', brow: 'sad',
        mouth: talk ? (f % 2 ? 'open' : 'frown') : 'frown',
        headTilt: -4, headY: 2, sweat: f % 2 ? 1 : 0
      });
    },
    happy: function (f, talk) {
      return RIG.base({
        bob: f % 2 ? -1 : 0,
        eyes: f === 3 ? 'closed' : 'normal', brow: 'up',
        mouth: talk ? (f % 2 ? 'open' : 'smile') : 'smile'
      });
    },
    angry: function (f, talk) {
      return RIG.base({
        bob: f % 2 ? 1 : 0, lean: 2,
        hL: [-16, 34], hR: [16, 34], kindL: 'fist', kindR: 'fist',
        eyes: 'angry', brow: 'angry',
        mouth: talk ? (f % 2 ? 'shout' : 'frown') : 'frown',
        symbol: 'anger', symbolCol: '#ff6a6a'
      });
    },
    read: function (f, talk) {
      return RIG.base({
        bob: f % 2 ? 0 : -1,
        hL: [-16, 30], hR: [16, 30], kindL: 'open', kindR: 'open',
        eyes: 'narrow', brow: 'down',
        mouth: talk ? (f % 2 ? 'open' : 'closed') : 'closed',
        headTilt: 2, headY: 3
      });
    }
  };

  RIG.define('naruhodo', {
    label: '成步堂', full: '成步堂 龙一', gender: 'm',
    outline: '#241a16',
    draw: draw,
    poses: poses,
    frames: { normal: 4, happy: 4, objection: 2, slam: 2, damage: 2, shock: 2 }
  });

})(window.AA);
