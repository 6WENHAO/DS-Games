/* ============================================================
   kanon.js — 白鸟 花音（新人声优 / 被冤枉的被告）
   ・娇小、胆怯：约 188px、窄肩（半宽 24）、腿略短
   ・栗色波波头 + 淡蓝星形发夹 / 超大淡粉卫衣 / 灰短裙 + 深色打底裤 + 白球鞋
   ============================================================ */
(function (AA) {
  'use strict';
  var U = AA.U, P = AA.PAL, RIG = AA.RIG;
  var D = Math.PI / 180;

  /* ---------------- 配色 ---------------- */
  var C = {
    hair: '#7a4f34', hairHi: '#9d6a45', hairLo: '#54341f',
    clip: '#8fc4dd',
    hoodie: '#efc8cf', hoodieLo: '#c69aa4', hoodieHi: '#fbe4e8', hoodieEdge: '#8f5c6c',
    skirt: '#8f8f98', skirtLo: '#6c6c76', skirtHi: '#a8a8b2',
    leggings: '#3a3a44', leggingsLo: '#2c2c34',
    sneaker: '#e8e6e2', sneakerLo: '#b8b4ae', sneakerAccent: '#7a9fd0',
    tear: '#bfe6ff', tearLine: '#5e9dc8'
  };
  var SK = P.skinPale;

  /* 骨架常量（窄肩、短腿） */
  var CX = 74, HY = 62, HRX = 24, HRY = 25;
  var SHY = 100, SHOULDER = 106, SHX = 24, HIP = 152;
  var L1 = 32, L2 = 28;

  function star(pen, x, y, r, col) {
    var pts = [];
    for (var i = 0; i < 10; i++) {
      var a = -Math.PI / 2 + i * Math.PI / 5;
      var rr = (i % 2 === 0) ? r : r * 0.5;
      pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]);
    }
    pen.poly(pts, col);
  }

  function sneakerDetail(pen, x, y, d) {
    pen.ellipse(x + d, y + 2.4, 6.2, 2.0, C.sneakerLo);
    pen.line([[x - d * 4, y - 1.2], [x + d * 3, y - 0.6]], C.sneakerAccent, 1.5, true);
  }

  function draw(pen, s) {
    var bob = s.bob || 0;
    var hip = HIP + bob, shy = SHY + bob, shoulder = SHOULDER + bob;

    /* ================= 腿（打底裤 + 球鞋） ================= */
    var st = s.stance || 0;
    var fl = RIG.leg(pen, CX - 12 - st, hip + 2, -1 + (s.legL || 0), 2, 33, 27, 15, 10, C.leggings, C.leggingsLo, C.sneaker, -1);
    var fr = RIG.leg(pen, CX + 12 + st, hip + 2, 1 + (s.legR || 0), -2, 33, 27, 15, 10, C.leggings, C.leggingsLo, C.sneaker, 1);
    sneakerDetail(pen, fl[0], fl[1], -1);
    sneakerDetail(pen, fr[0], fr[1], 1);

    pen.save();
    if (s.lean) { pen.translate(CX, hip); pen.rotate(s.lean * D); pen.translate(-CX, -hip); }

    /* ================= 短裙 ================= */
    var skirt = [
      [CX - 15, hip - 2], [CX - 13, hip + 2], [CX - 19, hip + 16], [CX - 9, hip + 24], [CX, hip + 25],
      [CX + 9, hip + 24], [CX + 19, hip + 16], [CX + 13, hip + 2], [CX + 15, hip - 2]
    ];
    pen.blob(skirt, C.skirt, .9);
    pen.clipBlob(skirt, function (p) {
      p.blob([[CX + 2, hip - 4], [CX + 21, hip + 2], [CX + 21, hip + 28], [CX + 4, hip + 28]], C.skirtLo, .6);
      p.blob([[CX - 15, hip + 0], [CX - 8, hip + 2], [CX - 9, hip + 22], [CX - 16, hip + 16]], C.skirtHi, .6);
    }, .9);

    /* ================= 卫衣（宽松大身） ================= */
    var body = [
      [CX - 30, shy - 2], [CX - 33, shy + 8], [CX - 34, shy + 28], [CX - 31, hip + 6],
      [CX - 18, hip + 6], [CX, hip + 7], [CX + 18, hip + 6],
      [CX + 31, hip + 6], [CX + 34, shy + 28], [CX + 33, shy + 8], [CX + 30, shy - 2],
      [CX + 14, shy - 8], [CX, shy - 10], [CX - 14, shy - 8]
    ];
    pen.blob(body, C.hoodie, .92);
    pen.clipBlob(body, function (p) {
      p.blob([[CX + 10, shy - 14], [CX + 38, shy - 4], [CX + 38, hip + 12], [CX + 15, hip + 12]], C.hoodieLo, .55);
      p.blob([[CX - 30, shy - 2], [CX - 18, shy + 0], [CX - 20, shy + 34], [CX - 31, shy + 26]], C.hoodieHi, .6);
      p.blob([[CX - 33, hip - 2], [CX + 33, hip - 2], [CX + 30, hip + 10], [CX - 30, hip + 10]], C.hoodieLo, .5);
    }, .92);
    // 袋鼠口袋缝线
    pen.line([[CX - 18, shy + 24], [CX - 8, shy + 30], [CX, shy + 31], [CX + 8, shy + 30], [CX + 18, shy + 24]], C.hoodieEdge, 1.7, true);
    // 抽绳 + 两个绳头（深边白绳，明显可读）
    pen.line([[CX - 3, shy + 0], [CX - 7, shy + 17]], C.hoodieEdge, 3.2, true);
    pen.line([[CX - 3, shy + 0], [CX - 7, shy + 17]], '#ffffff', 1.8, true);
    pen.line([[CX + 3, shy + 0], [CX + 7, shy + 19]], C.hoodieEdge, 3.2, true);
    pen.line([[CX + 3, shy + 0], [CX + 7, shy + 19]], '#ffffff', 1.8, true);
    pen.circle(CX - 8, shy + 19, 2.6, C.hoodieEdge);
    pen.circle(CX - 8, shy + 19, 1.8, '#ffffff');
    pen.circle(CX + 8, shy + 21, 2.6, C.hoodieEdge);
    pen.circle(CX + 8, shy + 21, 1.8, '#ffffff');

    /* ================= 兜帽（堆在颈后） ================= */
    var hood = [
      [CX - 16, shy - 8], [CX - 21, shy + 1], [CX - 20, shy + 14], [CX - 11, shy + 20], [CX, shy + 21],
      [CX + 11, shy + 20], [CX + 20, shy + 14], [CX + 21, shy + 1], [CX + 16, shy - 8]
    ];
    pen.blob(hood, C.hoodieLo, .92);
    pen.clipBlob(hood, function (p) {
      p.blob([[CX - 12, shy - 10], [CX - 6, shy - 10], [CX - 6, shy + 16], [CX - 12, shy + 16]], C.hoodie, .6);
    }, .92);

    /* ================= 头 ================= */
    var hx = CX + (s.headX || 0), hy = HY + bob + (s.headY || 0);
    pen.taper([[CX, shy - 2], [hx, hy + 20]], 11, 9, SK.lo);
    pen.taper([[CX - 0.5, shy - 2], [hx - 1, hy + 20]], 7, 6, SK.base);

    pen.save();
    if (s.headTilt) { pen.translate(hx, hy + 24); pen.rotate(s.headTilt * D); pen.translate(-hx, -(hy + 24)); }

    // 后发（波波头主体，齐下巴）
    var bobPts = [
      [hx - 26, hy - 4], [hx - 25, hy - 20], [hx - 12, hy - 28], [hx + 2, hy - 29], [hx + 15, hy - 27], [hx + 25, hy - 20],
      [hx + 27, hy - 2], [hx + 27, hy + 16], [hx + 22, hy + 29], [hx + 11, hy + 32], [hx - 11, hy + 32], [hx - 22, hy + 29], [hx - 27, hy + 16]
    ];
    pen.blob(bobPts, C.hair, .95);
    pen.clipBlob(bobPts, function (p) {
      p.blob([[hx + 8, hy - 28], [hx + 30, hy - 20], [hx + 30, hy + 34], [hx + 10, hy + 34]], C.hairLo, .6);
    }, .95);
    pen.clipBlob(bobPts, function (p) {
      p.ellipse(hx - 13, hy - 11, 8, 5, C.hairHi);
    }, .95);

    // 脸（圆润下巴）
    RIG.head(pen, hx, hy, HRX, HRY, SK, { jaw: 0.84, chin: 1.12 });

    // 刘海
    var fringe = [
      [hx - 24, hy - 6], [hx - 20, hy - 21], [hx - 11, hy - 26], [hx + 1, hy - 27], [hx + 13, hy - 25], [hx + 22, hy - 19], [hx + 24, hy - 5],
      [hx + 19, hy - 9], [hx + 15, hy - 4], [hx + 10, hy - 10],
      [hx + 5, hy - 4], [hx, hy - 11], [hx - 5, hy - 4], [hx - 10, hy - 10], [hx - 15, hy - 4], [hx - 19, hy - 9]
    ];
    pen.blob(fringe, C.hair, .8);
    pen.clipBlob(fringe, function (p) {
      p.blob([[hx - 14, hy - 24], [hx - 2, hy - 26], [hx + 3, hy - 22], [hx - 8, hy - 19]], C.hairHi, .7);
      p.blob([[hx + 8, hy - 23], [hx + 16, hy - 19], [hx + 16, hy - 15], [hx + 8, hy - 18]], C.hairHi, .7);
    }, .8);

    // 两侧鬓发（修饰脸型的两小绺）
    pen.blob([[hx - 21, hy - 6], [hx - 17, hy - 3], [hx - 18, hy + 16], [hx - 22, hy + 12]], C.hair, .9);
    pen.blob([[hx + 21, hy - 6], [hx + 17, hy - 3], [hx + 18, hy + 16], [hx + 22, hy + 12]], C.hair, .9);

    // 星形发夹（角色左鬓 = 观众右侧）
    star(pen, hx + 18, hy - 13, 4.2, C.clip);
    pen.circle(hx + 17.6, hy - 13.6, 1.0, '#ffffff');

    // 五官
    var eyeY = hy + 2;
    RIG.brow(pen, hx, eyeY - 11, 18, 4.0, s.brow, C.hairLo);
    RIG.eyes(pen, hx, eyeY, 18, 5.2, s.eyes, { pupil: s.pupil, iris: '#7a3a24', turn: s.headTurn });
    pen.line([[hx + 1, eyeY + 5], [hx + 3.2, eyeY + 10], [hx + 0.4, eyeY + 11]], C.hairLo, 1.2, true);
    RIG.mouth(pen, hx + (s.headTurn || 0) * 2, hy + 17, 10, s.mouth, C.hairLo, '#93414a');
    if (s.blush) { RIG.blush(pen, hx - 13, hy + 9, 7); RIG.blush(pen, hx + 13, hy + 9, 7); }

    // 眼泪（哭姿：两眼下方两道淡蓝泪痕）
    if (s.tears) {
      var lx = hx - 8, rx = hx + 8, y0 = hy + 6;
      pen.ellipse(lx + 1, y0 - 1, 1.8, 2.4, C.tear);
      pen.ellipse(rx, y0 - 1, 1.8, 2.4, C.tear);
      pen.taper([[lx, y0], [lx - 1, y0 + 10], [lx - 2, y0 + 24]], 3.4, 1.6, C.tear);
      pen.taper([[rx + 1, y0], [rx, y0 + 10], [rx + 2, y0 + 24]], 3.4, 1.6, C.tear);
      pen.line([[lx - 0.3, y0 + 3], [lx - 0.7, y0 + 15]], '#ffffff', 1, true);
      pen.line([[rx + 0.7, y0 + 3], [rx + 1.1, y0 + 15]], '#ffffff', 1, true);
    }

    pen.restore(); // headTilt

    /* ================= 手臂（长袖，几乎吞没手） ================= */
    function arm(sx, sy, off, kind, ang, bend, dark) {
      var col = dark ? C.hoodieLo : C.hoodie;
      var shd = dark ? null : C.hoodieHi;
      var h = RIG.armTo(pen, sx, sy, sx + off[0], sy + off[1], L1, L2, 21, 17, 13, col, shd, bend, C.hoodieEdge);
      var dir = Math.atan2(h[1] - h[3], h[0] - h[2]);
      pen.circle(h[0], h[1], 8.0, C.hoodieEdge);
      pen.circle(h[0], h[1], 7.0, col);
      pen.circle(h[0] + Math.cos(dir) * 1.4, h[1] + Math.sin(dir) * 1.4, 5.0, C.hoodieLo);
      RIG.hand(pen, h[0] + Math.cos(dir) * 5.8, h[1] + Math.sin(dir) * 5.8, 4.6, SK.base, SK.lo, kind, ang == null ? dir : ang);
      return h;
    }
    arm(CX + SHX, shoulder, s.hR, s.kindR, s.angR, 1, true);
    arm(CX - SHX, shoulder, s.hL, s.kindL, s.angL, -1, false);

    pen.restore(); // lean

    if (s.sweat) RIG.sweat(pen, hx + 24, hy - 14 + (s.sweatY || 0), 4.6, s.sweat, 0);
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
        hL: [-12, 58], hR: [12, 58],
        eyes: 'normal', brow: 'normal',
        mouth: tm(talk, f)
      });
    },
    sad: function (f, talk) {
      return RIG.base({
        bob: f % 2 ? 0 : -1, lean: -2,
        hL: [21, 50], hR: [-21, 50], kindL: 'open', kindR: 'open',
        eyes: 'sad', brow: 'sad',
        mouth: talk ? (f % 2 ? 'open' : 'frown') : 'frown',
        headY: 2, headTilt: -3
      });
    },
    hopeful: function (f, talk) {
      return RIG.base({
        bob: f % 2 ? 0 : -1,
        hL: [21, 22], hR: [-21, 22], kindL: 'open', kindR: 'open',
        eyes: 'wide', brow: 'up',
        mouth: talk ? (f % 2 ? 'open' : 'smile') : 'smile',
        headY: -2, headTilt: 2, pupil: [0, -0.2], blush: 1
      });
    },
    cry: function (f, talk) {
      return RIG.base({
        bob: f % 2 ? 0 : -1, lean: -1,
        hL: [-8, -26], hR: [8, -26], kindL: 'open', kindR: 'open',
        eyes: 'shut', brow: 'sad',
        mouth: 'wide',
        headY: 1, headTilt: -2,
        tears: true
      });
    },
    surprised: function (f, talk) {
      return RIG.base({
        bob: f % 2 ? 0 : -1, lean: -2,
        hL: [-14, 44], hR: [14, 46], kindL: 'open', kindR: 'open',
        eyes: 'wide', brow: 'up',
        mouth: 'o', pupil: [0, -0.3],
        headY: -1
      });
    },
    think: function (f, talk) {
      return RIG.base({
        bob: f % 2 ? 0 : -1, lean: -1,
        hL: [-12, 58], hR: [-24, -18], kindR: 'fist',
        eyes: 'narrow', brow: 'down',
        mouth: talk ? (f % 2 ? 'open' : 'flat') : 'flat',
        headTilt: -3, pupil: [0.3, -0.1]
      });
    },
    happy: function (f, talk) {
      return RIG.base({
        bob: f % 2 ? -1 : 0,
        hL: [-12, 58], hR: [12, 58],
        eyes: f === 3 ? 'closed' : 'normal', brow: 'up',
        mouth: talk ? (f % 2 ? 'open' : 'smile') : 'smile',
        blush: 1
      });
    },
    sweat: function (f, talk) {
      return RIG.base({
        bob: f % 2 ? 0 : -1, lean: -2,
        hL: [-12, 52], hR: [12, 48],
        eyes: 'wide', brow: 'sad',
        mouth: talk ? (f % 2 ? 'open' : 'flat') : 'flat',
        sweat: 2, sweatY: f % 2 ? 0 : 2, headTilt: -2, headY: 1
      });
    },
    shock: function (f, talk) {
      return RIG.base({
        bob: f % 2 ? -2 : -1, lean: -4,
        hL: [-22, 20], hR: [22, 22], kindL: 'open', kindR: 'open',
        eyes: 'wide', brow: 'up',
        mouth: 'o', pupil: [0, -0.3],
        symbol: 'shock', headY: -2, stance: 2
      });
    }
  };

  RIG.define('kanon', { label: '花音', full: '白鸟 花音', gender: 'f', outline: '#241a16', draw: draw, poses: poses, frames: { normal: 4, sad: 4, cry: 2 } });

})(window.AA);
