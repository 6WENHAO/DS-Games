/* ============================================================
   hibiki.js — 音无 响（深夜电台 DJ / 被害人）
   ・仅出现在立绘 / 回忆中，姿势少但要有明星气场
   ・深藏青波浪刘海（遮一眼、及领）/ 深炭灰夹克 + 黑T + 银闪电 + 银链 + 红围巾
   ・银色+黑色头戴耳机（招牌）
   ============================================================ */
(function (AA) {
  'use strict';
  var U = AA.U, P = AA.PAL, RIG = AA.RIG;
  var D = Math.PI / 180;

  /* ---------------- 配色 ---------------- */
  var C = {
    hair: '#232a3e', hairHi: '#3d4a68', hairHi2: '#55648a', hairLo: '#151a2a',
    jacket: '#333644', jacketLo: '#242731', jacketHi: '#4a4f61', jacketEdge: '#15171f',
    tee: '#171921',
    motif: '#e8edf5',
    chain: '#7f8896',
    scarf: '#b8323c', scarfLo: '#86202a', scarfHi: '#d95a60',
    jeans: '#2f4566', jeansLo: '#1f2a40',
    shoe: '#2a2a32', shoeHi: '#3c3c46',
    hpBlack: '#0c0e14', hpSilver: '#c3ccd8'
  };
  var SK = P.skin;

  /* 骨架常量（标准身高） */
  var CX = 74, HY = 62, HRX = 24, HRY = 25;
  var SHY = 100, SHOULDER = 106, SHX = 30, HIP = 152;
  var L1 = 32, L2 = 28;

  function draw(pen, s) {
    var bob = s.bob || 0;
    var hip = HIP + bob, shy = SHY + bob, shoulder = SHOULDER + bob;

    /* ================= 腿（深色牛仔裤 + 鞋） ================= */
    var st = s.stance || 0;
    RIG.leg(pen, CX - 13 - st, hip + 2, -2 + (s.legL || 0), 2, 36, 30, 20, 14, C.jeans, C.jeansLo, C.shoe, -1);
    RIG.leg(pen, CX + 13 + st, hip + 2, 2 + (s.legR || 0), -2, 36, 30, 20, 14, C.jeans, C.jeansLo, C.shoe, 1);

    pen.save();
    if (s.lean) { pen.translate(CX, hip); pen.rotate(s.lean * D); pen.translate(-CX, -hip); }

    /* ================= 深炭灰夹克 ================= */
    var jacket = [
      [CX - 28, shy], [CX - 34, shy + 14], [CX - 32, shy + 34], [CX - 28, hip + 6],
      [CX - 11, hip + 12], [CX, hip + 13], [CX + 11, hip + 12],
      [CX + 28, hip + 6], [CX + 32, shy + 34], [CX + 34, shy + 14], [CX + 28, shy],
      [CX + 15, shy - 6], [CX, shy - 8], [CX - 15, shy - 6]
    ];
    pen.blob(jacket, C.jacket, .92);
    pen.clipBlob(jacket, function (p) {
      p.blob([[CX + 12, shy - 16], [CX + 42, shy - 6], [CX + 42, hip + 22], [CX + 17, hip + 22]], C.jacketLo, .55);
      p.blob([[CX - 30, shy - 4], [CX - 19, shy - 2], [CX - 21, shy + 34], [CX - 31, shy + 28]], C.jacketHi, .6);
      p.blob([[CX - 32, hip - 6], [CX + 32, hip - 6], [CX + 30, hip + 16], [CX - 30, hip + 16]], C.jacketLo, .5);
    }, .92);

    /* 黑T V 区 */
    var tee = [[CX - 12, shy - 6], [CX, shy - 2], [CX + 12, shy - 6],
    [CX + 10, shy + 24], [CX, shy + 36], [CX - 10, shy + 24]];
    pen.blob(tee, C.tee, .85);
    pen.clipBlob(tee, function (p) {
      p.blob([[CX + 2, shy - 12], [CX + 17, shy - 8], [CX + 17, shy + 42], [CX + 3, shy + 42]], C.jacketLo, .6);
    }, .85);

    /* 胸口银色闪电纹 */
    pen.poly([
      [CX + 3, shy + 14], [CX - 1, shy + 21], [CX + 2, shy + 21], [CX - 2, shy + 28], [CX + 5, shy + 19], [CX + 2, shy + 19]
    ], C.motif);

    /* 银色细链 */
    pen.line([[CX - 6, shy + 14], [CX - 3, shy + 19], [CX, shy + 21], [CX + 3, shy + 19], [CX + 6, shy + 14]], C.chain, 1.3, true);

    /* ================= 手臂（夹克袖） ================= */
    function arm(sx, sy, off, kind, ang, bend, dark) {
      var col = dark ? C.jacketLo : C.jacket;
      var shd = dark ? null : C.jacketHi;
      var h = RIG.armTo(pen, sx, sy, sx + off[0], sy + off[1], L1, L2, 20, 16, 12, col, shd, bend, C.jacketEdge);
      var dir = Math.atan2(h[1] - h[3], h[0] - h[2]);
      pen.circle(h[0], h[1], 7.6, C.jacketEdge);
      pen.circle(h[0], h[1], 6.6, col);
      pen.circle(h[0] + Math.cos(dir) * 1.6, h[1] + Math.sin(dir) * 1.6, 5.2, C.tee);
      var hx = h[0] + Math.cos(dir) * 6.6, hy = h[1] + Math.sin(dir) * 6.6;
      RIG.hand(pen, hx, hy, 6.2, SK.base, SK.lo, kind, ang == null ? dir : ang);
      return [hx, hy];
    }
    var handR = arm(CX + SHX, shoulder, s.hR, s.kindR, s.angR, 1, true);
    arm(CX - SHX, shoulder, s.hL, s.kindL, s.angL, -1, false);

    /* ================= 头 ================= */
    var hx = CX + (s.headX || 0), hy = HY + bob + (s.headY || 0);
    pen.taper([[CX, shy - 4], [hx, hy + 22]], 15, 13, SK.lo);
    pen.taper([[CX - 0.5, shy - 3], [hx - 1, hy + 22]], 10, 9, SK.base);

    /* 红围巾（围在颈上 + 垂下两段） */
    var scarfBand = [
      [CX - 14, shy - 6], [CX - 15, shy + 3], [CX - 12, shy + 10], [CX - 5, shy + 13], [CX, shy + 13],
      [CX + 5, shy + 13], [CX + 12, shy + 10], [CX + 15, shy + 3], [CX + 14, shy - 6]
    ];
    pen.blob(scarfBand, C.scarf, .9);
    pen.clipBlob(scarfBand, function (p) {
      p.blob([[CX + 2, shy - 8], [CX + 16, shy + 0], [CX + 16, shy + 16], [CX + 4, shy + 16]], C.scarfLo, .6);
      p.blob([[CX - 13, shy - 4], [CX - 8, shy - 2], [CX - 9, shy + 10], [CX - 13, shy + 6]], C.scarfHi, .6);
    }, .9);
    pen.blob([[CX - 8, shy + 9], [CX - 14, shy + 24], [CX - 12, shy + 38], [CX - 6, shy + 42], [CX - 4, shy + 24]], C.scarf, .9);
    pen.blob([[CX + 6, shy + 9], [CX + 12, shy + 22], [CX + 14, shy + 36], [CX + 8, shy + 40], [CX + 5, shy + 22]], C.scarfLo, .9);

    pen.save();
    if (s.headTilt) { pen.translate(hx, hy + 24); pen.rotate(s.headTilt * D); pen.translate(-hx, -(hy + 24)); }

    // 后发（微卷、及领）
    var hairPts = [
      [hx - 25, hy - 8], [hx - 24, hy - 24], [hx - 12, hy - 34], [hx + 2, hy - 35], [hx + 16, hy - 32], [hx + 24, hy - 20], [hx + 26, hy - 6],
      [hx + 25, hy + 12], [hx + 21, hy + 28], [hx + 16, hy + 36], [hx + 8, hy + 38], [hx - 8, hy + 38], [hx - 16, hy + 36], [hx - 21, hy + 28], [hx - 25, hy + 12]
    ];
    pen.blob(hairPts, C.hair, .95);
    pen.clipBlob(hairPts, function (p) {
      p.blob([[hx + 6, hy - 30], [hx + 28, hy - 20], [hx + 28, hy + 40], [hx + 8, hy + 40]], C.hairLo, .55);
      p.line([[hx - 12, hy - 26], [hx - 16, hy - 8], [hx - 14, hy + 6]], C.hairHi, 2.2, true);
      p.line([[hx + 4, hy - 28], [hx + 2, hy - 6], [hx + 5, hy + 12]], C.hairHi2, 2.0, true);
    }, .95);

    // 脸（窄脸）
    RIG.head(pen, hx, hy, HRX, HRY, SK, { jaw: 0.74, chin: 1.0 });

    // 斜刘海（遮一只眼）
    var fringe = [
      [hx - 24, hy - 8], [hx - 21, hy - 26], [hx - 10, hy - 34], [hx + 2, hy - 35], [hx + 13, hy - 32], [hx + 22, hy - 24], [hx + 25, hy - 6],
      [hx + 21, hy - 9], [hx + 17, hy - 4], [hx + 13, hy - 10],
      [hx + 9, hy - 5], [hx + 6, hy - 11], [hx + 2, hy - 5],
      [hx - 2, hy - 8], [hx - 6, hy - 3], [hx - 10, hy - 7], [hx - 13, hy - 1], [hx - 17, hy - 6], [hx - 21, hy - 7]
    ];
    pen.blob(fringe, C.hair, .8);
    pen.clipBlob(fringe, function (p) {
      p.blob([[hx - 12, hy - 30], [hx + 2, hy - 34], [hx + 5, hy - 28], [hx - 6, hy - 25]], C.hairHi, .7);
    }, .8);

    // 五官
    var eyeY = hy + 2;
    RIG.brow(pen, hx, eyeY - 11, 18, 4.2, s.brow, C.hairLo);
    RIG.eyes(pen, hx, eyeY, 18, 4.4, s.eyes, { pupil: s.pupil, iris: '#b8863a', turn: s.headTurn });
    pen.line([[hx + 1, eyeY + 4], [hx + 3.2, eyeY + 9], [hx + 0.4, eyeY + 10]], C.hairLo, 1.2, true);
    RIG.mouth(pen, hx + (s.headTurn || 0) * 2, hy + 17, 11, s.mouth, C.hairLo, '#93414a');

    // 耳机（戴在头上，耳罩贴耳，头梁弧过顶）
    pen.line([[hx - 26, hy + 3], [hx - 22, hy - 18], [hx - 10, hy - 31], [hx + 10, hy - 31], [hx + 22, hy - 18], [hx + 26, hy + 3]], C.hpBlack, 4.2, true);
    pen.line([[hx - 25, hy + 2], [hx - 21, hy - 17], [hx - 10, hy - 30], [hx + 10, hy - 30], [hx + 21, hy - 17], [hx + 25, hy + 2]], C.hpSilver, 1.5, true);
    function cup(x, y) {
      pen.circle(x, y, 5.4, C.hpBlack);
      pen.circle(x, y, 4.0, C.hpSilver);
      pen.circle(x, y, 2.4, C.hpBlack);
      pen.circle(x - 0.8, y - 0.8, 1.0, '#ffffff');
    }
    cup(hx - 26, hy + 4);
    cup(hx + 26, hy + 4);

    pen.restore(); // headTilt

    // 手持麦克风（talk2）
    if (s.mic) {
      var mx = handR[0], my = handR[1];
      pen.taper([[mx, my], [mx, my - 9]], 3.0, 3.4, C.hpSilver);
      pen.circle(mx, my - 11, 3.6, C.hpBlack);
      pen.circle(mx, my - 11, 1.8, C.hpDark);
      pen.circle(mx - 1, my - 12, 1.0, '#ffffff');
    }

    pen.restore(); // lean

    if (s.sweat) RIG.sweat(pen, hx + 26, hy - 14 + (s.sweatY || 0), 4.6, s.sweat, 0);
    if (s.symbol) RIG.symbol(pen, hx + (s.symbolX || 25), hy - 30, s.symbol, s.symbolCol || '#ffffff');
  }

  /* ---------------- 姿势 ---------------- */
  function tm(talk, f, open, closed) {
    return talk ? (f % 2 ? (open || 'open') : (closed || 'closed')) : (closed || 'closed');
  }

  var poses = {
    normal: function (f, talk) {
      return RIG.base({
        bob: f % 2 ? 0 : -1,
        eyes: 'narrow', brow: 'normal',
        mouth: talk ? (f % 2 ? 'open' : 'smile') : 'smile'
      });
    },
    smile: function (f, talk) {
      return RIG.base({
        bob: f % 2 ? -1 : 0,
        hR: [30, -8], kindR: 'open', angR: -0.4,
        eyes: 'narrow', brow: 'up',
        mouth: talk ? (f % 2 ? 'open' : 'grin') : 'grin',
        headTilt: 2
      });
    },
    talk2: function (f, talk) {
      return RIG.base({
        bob: f % 2 ? 0 : -1,
        hR: [-24, -16], kindR: 'fist',
        eyes: f % 2 ? 'normal' : 'narrow', brow: 'normal',
        mouth: 'open',
        headTilt: 2, headY: 1,
        mic: true
      });
    },
    serious: function (f, talk) {
      return RIG.base({
        bob: f % 2 ? 0 : -1,
        eyes: 'narrow', brow: 'down',
        mouth: talk ? (f % 2 ? 'open' : 'flat') : 'flat',
        headY: 1
      });
    },
    shock: function (f, talk) {
      return RIG.base({
        bob: f % 2 ? -2 : -1, lean: -3,
        hL: [-26, 14], hR: [26, 16], kindL: 'open', kindR: 'open',
        eyes: 'wide', brow: 'up',
        mouth: 'o', pupil: [0, -0.3],
        symbol: 'shock', headY: -2, stance: 2
      });
    },
    sad: function (f, talk) {
      return RIG.base({
        bob: f % 2 ? 0 : -1, lean: -3,
        hL: [-4, 58], hR: [4, 58],
        eyes: 'sad', brow: 'sad',
        mouth: talk ? (f % 2 ? 'open' : 'frown') : 'frown',
        headTilt: -4, headY: 2
      });
    }
  };

  RIG.define('hibiki', { label: '音无', full: '音无 响', gender: 'm', outline: '#241a16', draw: draw, poses: poses, frames: { normal: 4, smile: 4 } });

})(window.AA);
