/* ============================================================
   mitsurugi.js — 御剑 怜侍（检察官 / Miles Edgeworth）
   冷峻、优雅、傲慢的精英检察官，站姿笔挺，比成步堂更瘦削。
      ・骨架基准（画布 148×232，脚底 y=222，含发全高 200px）
          发梢顶 y≈22 / 头心 62 / 下巴 87 / 肩线 100
          肩点 (74±30, 106) / 腰 152 / 膝 190 / 脚 218
      ・银灰后梳发（分缝），酒红西装 + 尖领，白衬衫
      ・标志性特征：领口垂到胸前的大白荷叶边领结（jabot）
      ・颜色取自文件顶部 C 表（不登记 paletteList，交给引擎自动收集）
   ============================================================ */
(function (AA) {
  'use strict';
  var U = AA.U, P = AA.PAL, RIG = AA.RIG;
  var D = Math.PI / 180;

  /* ---------------- 配色 ---------------- */
  var C = {
    suit: '#8e2f52', suitLo: '#5f1c37', suitHi: '#ab4a6d', suitEdge: '#33101f',
    vest: '#7c2543',
    pantsLo: '#471224',
    cravat: '#f4f2ea', cravatLo: '#cfcdc2', white: '#ffffff',
    hair: '#b9bcc9', hairLo: '#8f93a4', hairHi: '#e2e5ee',
    shoe: '#26262e',
    iris: '#3a404d', mouth: '#93414a'
  };
  var SK = P.skinPale;

  /* 骨架常量 */
  var CX = 74, HY = 62, HRX = 24, HRY = 25;
  var CHIN = 87, SHY = 100, SHOULDER = 106, SHX = 30, HIP = 152;
  var L1 = 32, L2 = 28;

  /* 领结（jabot）的单层荷叶边：一条白带，下缘三道扇贝 */
  function ruffle(pen, cx, y0, w, h) {
    var L = cx - w / 2, R = cx + w / 2;
    var pts = [
      [L, y0], [R, y0], [R, y0 + h * 0.4],
      [R - w * 0.17, y0 + h], [R - w * 0.33, y0 + h * 0.5], [R - w * 0.5, y0 + h],
      [R - w * 0.67, y0 + h * 0.5], [R - w * 0.83, y0 + h],
      [L, y0 + h * 0.4]
    ];
    pen.blob(pts, C.cravat, .8);
    pen.clipBlob(pts, function (p) {
      p.blob([[L, y0 + h * 0.55], [R, y0 + h * 0.55], [R, y0 + h + 2], [L, y0 + h + 2]], C.cravatLo, .7);
    }, .8);
    pen.clipBlob(pts, function (p) {
      p.blob([[L, y0 - 1], [R, y0 - 1], [R, y0 + 3], [L, y0 + 3]], C.white, .8);
    }, .8);
  }

  /* 大领结：衬衫领 + 领结 + 三层荷叶边，从领口垂至胸口 */
  function jabot(pen, cx, top) {
    pen.poly([[cx - 10, top - 2], [cx - 2, top + 2], [cx - 11, top + 6], [cx - 16, top + 1]], C.white);
    pen.poly([[cx + 10, top - 2], [cx + 2, top + 2], [cx + 11, top + 6], [cx + 16, top + 1]], C.cravat);
    pen.blob([[cx - 5, top - 1], [cx + 5, top - 1], [cx + 4.5, top + 6], [cx, top + 8], [cx - 4.5, top + 6]], C.cravat, .9);
    pen.blob([[cx - 1, top], [cx + 3, top], [cx + 3, top + 4], [cx, top + 5], [cx - 1, top + 4]], C.white, .9);
    ruffle(pen, cx, top + 5, 20, 8);
    ruffle(pen, cx, top + 12, 22, 8);
    ruffle(pen, cx, top + 19, 20, 8);
  }

  function draw(pen, s) {
    var bob = s.bob || 0;
    var hip = HIP + bob, shy = SHY + bob, shoulder = SHOULDER + bob;

    /* ================= 腿 ================= */
    var st = s.stance || 0;
    RIG.leg(pen, CX - 12 - st, hip + 2, -2 + (s.legL || 0), 2, 36, 30, 19, 13, C.suitLo, C.pantsLo, C.shoe, -1);
    RIG.leg(pen, CX + 12 + st, hip + 2, 2 + (s.legR || 0), -2, 36, 30, 19, 13, C.suitLo, C.pantsLo, C.shoe, 1);
    pen.taper([[CX - 10, hip], [CX, hip + 11], [CX + 10, hip]], 5, 5, C.pantsLo);

    /* ================= 上身（可倾斜） ================= */
    pen.save();
    if (s.lean) { pen.translate(CX, hip); pen.rotate(s.lean * D); pen.translate(-CX, -hip); }

    /* 酒红西装外套（较瘦削） */
    var jacket = [
      [CX - 27, shy], [CX - 32, shy + 12], [CX - 31, shy + 34], [CX - 27, hip + 6],
      [CX - 9, hip + 11], [CX, hip + 12], [CX + 9, hip + 11],
      [CX + 27, hip + 6], [CX + 31, shy + 34], [CX + 32, shy + 12], [CX + 27, shy],
      [CX + 13, shy - 6], [CX, shy - 8], [CX - 13, shy - 6]
    ];
    pen.blob(jacket, C.suit, .92);
    pen.clipBlob(jacket, function (p) {
      p.blob([[CX + 12, shy - 14], [CX + 38, shy - 4], [CX + 38, hip + 20], [CX + 16, hip + 20]], C.suitLo, .55);
      p.blob([[CX - 29, shy - 3], [CX - 19, shy - 1], [CX - 21, shy + 32], [CX - 30, shy + 26]], C.suitHi, .6);
      p.blob([[CX - 30, hip - 6], [CX + 30, hip - 6], [CX + 28, hip + 14], [CX - 28, hip + 14]], C.suitLo, .5);
    }, .92);

    /* 暗红马甲（领结下方探出的小 V 边缘） */
    var vest = [[CX - 7, shy - 1], [CX + 7, shy - 1], [CX + 10, shy + 20], [CX, shy + 34], [CX - 10, shy + 20]];
    pen.blob(vest, C.vest, .85);
    pen.line([[CX - 7, shy - 1], [CX, shy + 34], [CX + 7, shy - 1]], C.suitEdge, 1.2, true);

    /* 前襟闭合线 + 纽扣 */
    pen.line([[CX, shy + 34], [CX, hip + 10]], C.suitEdge, 1.2, false);
    pen.circle(CX, shy + 36, 1.5, C.suitEdge);
    pen.circle(CX, shy + 46, 1.5, C.suitEdge);

    /* 尖领 */
    pen.poly([[CX - 15, shy - 8], [CX - 2, shy + 1], [CX - 12, shy + 26], [CX - 25, shy + 10]], C.suitHi);
    pen.poly([[CX + 15, shy - 8], [CX + 2, shy + 1], [CX + 12, shy + 26], [CX + 25, shy + 10]], C.suitLo);
    RIG.ink(pen, [[CX - 15, shy - 8], [CX - 2, shy + 1], [CX - 12, shy + 26]], 1.2, C.suitEdge);
    RIG.ink(pen, [[CX + 15, shy - 8], [CX + 2, shy + 1], [CX + 12, shy + 26]], 1.2, C.suitEdge);

    /* 口袋巾（左胸） */
    pen.poly([[CX - 26, shy + 13], [CX - 18, shy + 13], [CX - 22, shy + 7]], C.white);
    pen.line([[CX - 26, shy + 13], [CX - 18, shy + 13]], C.suitEdge, 1.0, false);

    /* 大领结（最醒目的特征） */
    jabot(pen, CX, shy - 1);

    /* ================= 手臂 ================= */
    function arm(sx, sy, off, dark, kind, ang, bend) {
      var h = RIG.armTo(pen, sx, sy, sx + off[0], sy + off[1], L1, L2, 19, 15, 11,
        dark ? C.suitLo : C.suit, dark ? null : C.suitHi, bend, C.suitEdge);
      var dir = Math.atan2(h[1] - h[3], h[0] - h[2]);
      pen.circle(h[0], h[1], 7.2, C.suitEdge);
      pen.circle(h[0], h[1], 6.2, dark ? C.suitLo : C.suit);
      pen.circle(h[0] + Math.cos(dir) * 1.5, h[1] + Math.sin(dir) * 1.5, 4.8, C.white);
      RIG.hand(pen, h[0] + Math.cos(dir) * 6.2, h[1] + Math.sin(dir) * 6.2, 6.0, SK.base, SK.lo,
        kind, ang == null ? dir : ang);
      return h;
    }
    var bendL = s.bendL == null ? -1 : s.bendL;
    var bendR = s.bendR == null ? 1 : s.bendR;
    arm(CX - SHX, shoulder, s.hL, false, s.kindL, s.angL, bendL);
    arm(CX + SHX, shoulder, s.hR, true, s.kindR, s.angR, bendR);

    /* ================= 头 ================= */
    var hx = CX + (s.headX || 0), hy = HY + bob + (s.headY || 0);
    pen.taper([[CX, shy - 4], [hx, hy + 22]], 15, 13, SK.lo);
    pen.taper([[CX - 0.5, shy - 3], [hx - 1, hy + 22]], 10, 9, SK.base);

    pen.save();
    if (s.headTilt) { pen.translate(hx, hy + 24); pen.rotate(s.headTilt * D); pen.translate(-hx, -(hy + 24)); }

    /* 后梳的银灰发（向后/侧梳，分缝，高耸） */
    var hairBack = [
      [hx - 27, hy - 2], [hx - 26, hy - 14], [hx - 20, hy - 26], [hx - 10, hy - 38],
      [hx + 2, hy - 40], [hx + 14, hy - 36], [hx + 24, hy - 22], [hx + 27, hy - 8],
      [hx + 27, hy + 4], [hx + 24, hy + 12], [hx + 18, hy + 18], [hx + 6, hy + 16],
      [hx - 8, hy + 14], [hx - 18, hy + 8], [hx - 25, hy + 2]
    ];
    pen.blob(hairBack, C.hair, .95);
    pen.clipBlob(hairBack, function (p) {
      p.blob([[hx + 12, hy - 26], [hx + 28, hy - 20], [hx + 30, hy + 4], [hx + 16, hy + 2]], C.hairLo, .6);
    }, .95);
    pen.sheen(hairBack, C.hairHi, hx - 6, hy - 36, hx + 8, hy - 34, 3.5);
    pen.sheen(hairBack, C.white, hx - 2, hy - 33, hx + 4, hy - 32, 1.4);

    /* 脸（棱角分明） */
    RIG.head(pen, hx, hy, HRX, HRY, SK, { jaw: 0.72, chin: 0.98 });

    /* 光滑的前发（向右后方梳） */
    var fringe = [
      [hx - 24, hy - 11], [hx - 20, hy - 16], [hx - 10, hy - 20], [hx - 2, hy - 18],
      [hx + 9, hy - 16], [hx + 19, hy - 14], [hx + 23, hy - 11], [hx + 14, hy - 9],
      [hx + 4, hy - 10], [hx - 6, hy - 10], [hx - 15, hy - 9], [hx - 20, hy - 8]
    ];
    pen.blob(fringe, C.hair, .8);
    pen.clipBlob(fringe, function (p) {
      p.blob([[hx - 12, hy - 20], [hx - 2, hy - 21], [hx + 2, hy - 16], [hx - 8, hy - 14]], C.hairHi, .7);
    }, .8);
    // 分缝
    pen.line([[hx - 9, hy - 28], [hx - 5, hy - 14]], C.hairLo, 1.3, true);
    // 额前一缕
    pen.taper([[hx - 6, hy - 16], [hx - 2, hy - 8], [hx + 0.5, hy - 1]], 2.6, 2.0, C.hair);

    /* 鬓角 */
    pen.poly([[hx - 24, hy - 6], [hx - 19, hy - 4], [hx - 20, hy + 10], [hx - 25, hy + 4]], C.hair);
    pen.poly([[hx + 24, hy - 6], [hx + 19, hy - 4], [hx + 20, hy + 10], [hx + 25, hy + 4]], C.hair);

    /* 颈后软尖发梢 */
    pen.poly([[hx + 16, hy + 13], [hx + 21, hy + 17], [hx + 14, hy + 18]], C.hair);
    pen.poly([[hx + 10, hy + 15], [hx + 15, hy + 19], [hx + 7, hy + 19]], C.hair);
    pen.poly([[hx + 3, hy + 15], [hx + 8, hy + 19], [hx + 0, hy + 18]], C.hairLo);

    /* 耳 */
    pen.ellipse(hx - 24, hy + 5, 3.4, 5.2, SK.base);
    pen.ellipse(hx + 24, hy + 5, 3.4, 5.2, SK.lo);

    /* 五官（细长锐眼、细眉、常带一丝不屑的皱眉） */
    var eyeY = hy + 2;
    RIG.brow(pen, hx, eyeY - 10, 19, 3.6, s.brow, C.hairLo);
    RIG.eyes(pen, hx, eyeY, 19, 4.4, s.eyes, { pupil: s.pupil, iris: C.iris, turn: s.headTurn });
    pen.line([[hx + 1, eyeY + 4], [hx + 3, eyeY + 9], [hx + 0.6, eyeY + 10]], SK.line, 1.2, true);
    RIG.mouth(pen, hx + (s.headTurn || 0) * 2, hy + 16, 10, s.mouth, SK.line, C.mouth);

    pen.restore();

    if (s.sweat) RIG.sweat(pen, hx + 26, hy - 14 + (s.sweatY || 0), 4.6, s.sweat, 0);
    if (s.symbol) RIG.symbol(pen, hx + (s.symbolX || 25), hy - 30, s.symbol, s.symbolCol || '#ffffff');

    pen.restore();
  }

  /* ---------------- 姿势 ---------------- */
  function tm(talk, f, open, closed) {
    closed = closed || 'frown';
    return talk ? (f % 2 ? (open || 'open') : closed) : closed;
  }

  var poses = {
    normal: function (f, talk) {
      return RIG.base({
        bob: f % 2 ? 0 : -1,
        eyes: f === 3 ? 'closed' : 'normal',
        mouth: tm(talk, f)
      });
    },
    arms: function (f, talk) {
      return RIG.base({
        bob: f % 2 ? 0 : -1,
        hL: [40, 20], hR: [-40, 20], kindL: 'open', kindR: 'open', bendL: 1, bendR: -1,
        eyes: 'normal',
        mouth: tm(talk, f)
      });
    },
    smug: function (f, talk) {
      return RIG.base({
        bob: f % 2 ? 0 : -1, lean: 1,
        headY: -2, headTilt: -2,
        hL: [-4, 56], hR: [-28, -16], kindR: 'open', angR: -0.9, bendL: -1, bendR: 1,
        eyes: 'narrow', pupil: [0, -0.2],
        mouth: talk ? (f % 2 ? 'open' : 'smile') : 'smile'
      });
    },
    point: function (f, talk) {
      return RIG.base({
        bob: f % 2 ? -1 : 0, lean: 3,
        hL: [-6, 54], hR: [-34, -8], kindR: 'point', angR: -3.0, bendL: -1, bendR: 1,
        eyes: 'normal', brow: 'angry',
        mouth: talk ? (f % 2 ? 'open' : 'flat') : 'flat',
        headY: -1, headTilt: -1
      });
    },
    objection: function (f, talk) {
      return RIG.base({
        bob: f % 2 ? 1 : 0, lean: 6,
        hL: [-8, 44], hR: [-40, -10], kindR: 'point', angR: -3.0, bendL: -1, bendR: 1,
        eyes: 'angry', brow: 'angry',
        mouth: f % 2 ? 'shout' : 'wide',
        headY: 2, headTilt: 2
      });
    },
    damage: function (f, talk) {
      return RIG.base({
        bob: f % 2 ? 2 : 0, lean: -7,
        hL: [-24, 4], hR: [22, 6], kindL: 'open', kindR: 'open', bendL: 1, bendR: -1,
        eyes: 'shut', brow: 'sad', mouth: 'wide',
        sweat: 3, headTilt: -6, headY: 4, stance: 3
      });
    },
    shock: function (f, talk) {
      return RIG.base({
        bob: f % 2 ? -2 : -1, lean: -3,
        hL: [-26, 14], hR: [26, 16], kindL: 'open', kindR: 'open', bendL: 1, bendR: -1,
        eyes: 'wide', brow: 'up', mouth: 'o', pupil: [0, -0.3],
        symbol: 'shock', headY: -2, stance: 2
      });
    },
    angry: function (f, talk) {
      return RIG.base({
        bob: f % 2 ? 1 : 0, lean: 2,
        hL: [-16, 34], hR: [16, 34], kindL: 'fist', kindR: 'fist', bendL: 1, bendR: -1,
        eyes: 'angry', brow: 'angry',
        mouth: talk ? (f % 2 ? 'shout' : 'frown') : 'frown',
        symbol: 'anger', symbolCol: '#ff6a6a'
      });
    },
    think: function (f, talk) {
      return RIG.base({
        bob: f % 2 ? 0 : -1, lean: -1,
        hL: [-5, 58], hR: [-20, -48], kindR: 'open', bendL: -1, bendR: 1,
        eyes: 'closed', brow: 'down',
        mouth: talk ? (f % 2 ? 'open' : 'flat') : 'flat',
        headTilt: -3
      });
    },
    sweat: function (f, talk) {
      return RIG.base({
        bob: f % 2 ? 0 : -1, lean: -2,
        hL: [-10, 52], hR: [10, 48], bendL: -1, bendR: 1,
        eyes: 'normal', brow: 'sad',
        mouth: talk ? (f % 2 ? 'open' : 'flat') : 'flat',
        sweat: 2, sweatY: f % 2 ? 0 : 2, headTilt: -2
      });
    },
    sad: function (f, talk) {
      return RIG.base({
        bob: f % 2 ? 0 : -1, lean: -3,
        hL: [-4, 58], hR: [4, 58], bendL: -1, bendR: 1,
        eyes: 'sad', brow: 'sad',
        mouth: talk ? (f % 2 ? 'open' : 'frown') : 'frown',
        headTilt: -4, headY: 2
      });
    }
  };

  RIG.define('mitsurugi', { label: '御剑', full: '御剑 怜侍', gender: 'm', outline: '#241a16', draw: draw, poses: poses, frames: { normal: 4, arms: 4, smug: 4, objection: 2, damage: 2, shock: 2 } });

})(window.AA);
