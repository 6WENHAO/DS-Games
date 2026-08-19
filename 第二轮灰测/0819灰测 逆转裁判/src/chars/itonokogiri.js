/* ============================================================
   itonokogiri.js — 糸锯 圭介（刑警 / Detective Gumshoe）
   高大、邋遢、大大咧咧却心地善良的刑警。总是一副乱糟糟的样子。
     ・骨架基准（画布 148×232，脚底 y=222，含发全高 200px）
         发梢顶 y≈22 / 头心 62 / 下巴 88 / 肩线 100
         肩点 (74±32, 106) / 腰 152 / 膝 190 / 脚 218
     ・米色长风衣（敞开），灰绿衬衫 + 深绿领带，乱蓬蓬深棕发，满脸胡茬
     ・颜色取自文件顶部 C 表（不登记 paletteList，交给引擎自动收集）
   ============================================================ */
(function (AA) {
  'use strict';
  var U = AA.U, P = AA.PAL, RIG = AA.RIG;
  var D = Math.PI / 180;

  /* ---------------- 配色 ---------------- */
  var C = {
    coat: '#8c7a56', coatLo: '#5f5136', coatHi: '#a8966d', coatEdge: '#2e2719',
    shirt: '#7a8550', shirtLo: '#5a6240',
    tie: '#2e5c3c',
    hair: '#4a3524', hairHi: '#664a30',
    pants: '#4a5048', pantsLo: '#353a34',
    shoe: '#26262e',
    plaster: '#e8a294'
  };
  var SK = P.skin;          // 面部肤色
  var ST = P.skinTan;       // 胡茬（用 lo 的更重暗调）

  /* 骨架常量 */
  var CX = 74, HY = 62, HRX = 24, HRY = 25;
  var CHIN = 88, SHY = 100, SHOULDER = 106, SHX = 32, HIP = 152;
  var L1 = 32, L2 = 28;
  var COATBOT = 185;

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

    /* 长风衣（敞开，垂至约 y=185） */
    var coat = [
      [CX - 33, shy], [CX - 38, shy + 14], [CX - 36, shy + 40],
      [CX - 31, hip + 8], [CX - 26, COATBOT - 12], [CX - 13, COATBOT],
      [CX, COATBOT + 1], [CX + 13, COATBOT], [CX + 26, COATBOT - 12],
      [CX + 31, hip + 8], [CX + 36, shy + 40], [CX + 38, shy + 14], [CX + 33, shy],
      [CX + 16, shy - 8], [CX, shy - 10], [CX - 16, shy - 8]
    ];
    pen.blob(coat, C.coat, .92);
    pen.clipBlob(coat, function (p) {
      // 右侧（观众右）暗面
      p.blob([[CX + 12, shy - 16], [CX + 44, shy - 4], [CX + 44, COATBOT + 6], [CX + 16, COATBOT + 6]], C.coatLo, .55);
      // 左肩亮面
      p.blob([[CX - 34, shy - 4], [CX - 22, shy - 2], [CX - 25, shy + 40], [CX - 36, shy + 30]], C.coatHi, .6);
      // 下摆暗
      p.blob([[CX - 34, COATBOT - 20], [CX + 34, COATBOT - 20], [CX + 30, COATBOT + 4], [CX - 30, COATBOT + 4]], C.coatLo, .5);
    }, .92);

    /* 风衣竖向褶皱 */
    pen.line([[CX - 24, shy + 46], [CX - 25, COATBOT - 6]], C.coatLo, 1.6, false);
    pen.line([[CX - 17, shy + 48], [CX - 18, COATBOT - 4]], C.coatLo, 1.3, false);
    pen.line([[CX + 24, shy + 46], [CX + 25, COATBOT - 6]], C.coatLo, 1.6, false);
    pen.line([[CX + 17, shy + 48], [CX + 18, COATBOT - 4]], C.coatLo, 1.3, false);

    /* 腰带（腰际束带细节） */
    pen.rect(CX - 30, hip - 6, 60, 7, C.coatLo);
    pen.rect(CX - 30, hip - 6, 60, 2, C.coatEdge);
    pen.rect(CX - 4, hip - 8, 8, 10, C.coatEdge);

    /* 衬衫（风衣敞开的 V 字，露出胸腹） */
    var shirtStrip = [
      [CX - 7, shy + 3], [CX + 7, shy + 3],
      [CX + 9, shy + 36], [CX + 10, 160],
      [CX + 9, COATBOT - 1], [CX, COATBOT + 1], [CX - 9, COATBOT - 1],
      [CX - 10, 160], [CX - 9, shy + 36]
    ];
    pen.blob(shirtStrip, C.shirt, .9);
    pen.clipBlob(shirtStrip, function (p) {
      p.blob([[CX + 1, shy], [CX + 13, shy + 4], [CX + 13, COATBOT + 2], [CX + 2, COATBOT + 2]], C.shirtLo, .55);
    }, .9);

    /* 松垮的深绿领带 */
    pen.blob([[CX - 4, shy + 4], [CX + 5, shy + 1], [CX + 5, shy + 11], [CX - 2, shy + 14]], C.tie, .9);
    pen.blob([[CX - 1, shy + 9], [CX + 4, shy + 10], [CX + 6, shy + 28], [CX + 4, shy + 44], [CX, shy + 46], [CX - 3, shy + 28]], C.tie, .9);

    /* 胸袋 */
    pen.rect(CX - 27, shy + 21, 15, 12, C.coat);
    pen.rect(CX - 27, shy + 17, 15, 4, C.coatHi);
    pen.rect(CX - 27, shy + 21, 15, 1.5, C.coatEdge);

    /* 内门襟线（敞开的边缘） */
    RIG.ink(pen, [[CX - 14, shy + 4], [CX - 13, shy + 40], [CX - 15, 150], [CX - 13, COATBOT - 2]], 1.3, C.coatEdge);
    RIG.ink(pen, [[CX + 14, shy + 4], [CX + 13, shy + 40], [CX + 15, 150], [CX + 13, COATBOT - 2]], 1.3, C.coatEdge);

    /* ================= 手臂 ================= */
    function arm(sx, sy, off, dark, kind, ang, bend) {
      var h = RIG.armTo(pen, sx, sy, sx + off[0], sy + off[1], L1, L2, 20, 16, 12,
        dark ? C.coatLo : C.coat, dark ? null : C.coatHi, bend, C.coatEdge);
      var dir = Math.atan2(h[1] - h[3], h[0] - h[2]);
      // 袖口
      pen.circle(h[0], h[1], 7.4, C.coatEdge);
      pen.circle(h[0], h[1], 6.4, dark ? C.coatLo : C.coat);
      pen.circle(h[0] + Math.cos(dir) * 1.5, h[1] + Math.sin(dir) * 1.5, 5.0, C.shirt);
      RIG.hand(pen, h[0] + Math.cos(dir) * 6.4, h[1] + Math.sin(dir) * 6.4, 6.2, SK.base, SK.lo,
        kind, ang == null ? dir : ang);
      return h;
    }
    arm(CX - SHX, shoulder, s.hL, false, s.kindL, s.angL, -1);

    /* ================= 头 ================= */
    var hx = CX + (s.headX || 0), hy = HY + bob + (s.headY || 0);
    // 脖子
    pen.taper([[CX, shy - 4], [hx, hy + 22]], 16, 14, SK.lo);
    pen.taper([[CX - 0.5, shy - 3], [hx - 1, hy + 22]], 11, 10, SK.base);

    /* 立起的宽领（两条领片竖在颈侧） */
    pen.poly([[CX - 15, shy + 4], [CX - 8, shy], [CX - 12, shy - 13], [CX - 20, shy - 5]], C.coat);
    pen.poly([[CX + 15, shy + 4], [CX + 8, shy], [CX + 12, shy - 13], [CX + 20, shy - 5]], C.coatHi);
    pen.line([[CX - 15, shy + 4], [CX - 8, shy], [CX - 12, shy - 13]], C.coatEdge, 1.1, true);
    pen.line([[CX + 15, shy + 4], [CX + 8, shy], [CX + 12, shy - 13]], C.coatEdge, 1.1, true);

    pen.save();
    if (s.headTilt) { pen.translate(hx, hy + 24); pen.rotate(s.headTilt * D); pen.translate(-hx, -(hy + 24)); }

    /* 乱发（后脑发块，顶部毛躁） */
    var hairMass = [
      [hx - 29, hy + 5], [hx - 28, hy - 10], [hx - 22, hy - 24],
      [hx - 15, hy - 18], [hx - 9, hy - 36], [hx - 3, hy - 20],
      [hx + 2, hy - 40], [hx + 8, hy - 21], [hx + 15, hy - 32],
      [hx + 22, hy - 18], [hx + 28, hy - 10], [hx + 29, hy + 5],
      [hx + 27, hy + 12], [hx - 27, hy + 12]
    ];
    pen.blob(hairMass, C.hair, .95);
    pen.clipBlob(hairMass, function (p) {
      p.blob([[hx - 16, hy - 30], [hx - 4, hy - 38], [hx + 6, hy - 34], [hx + 2, hy - 24], [hx - 10, hy - 22]], C.hairHi, .7);
    }, .95);

    /* 脸 */
    var hd = RIG.head(pen, hx, hy, HRX, HRY, SK, { jaw: .8, chin: 1.0 });

    /* 乱蓬蓬的刘海（避开眉毛区域，露出浓眉） */
    var fringe = [
      [hx - 24, hy - 6], [hx - 18, hy - 13], [hx - 12, hy - 9], [hx - 7, hy - 15],
      [hx, hy - 10], [hx + 7, hy - 16], [hx + 13, hy - 9], [hx + 18, hy - 12], [hx + 24, hy - 6],
      [hx + 20, hy - 9], [hx + 12, hy - 11], [hx + 5, hy - 9],
      [hx, hy - 11], [hx - 5, hy - 9], [hx - 12, hy - 11], [hx - 20, hy - 9]
    ];
    pen.blob(fringe, C.hair, .8);
    pen.clipBlob(fringe, function (p) {
      p.blob([[hx - 6, hy - 15], [hx + 1, hy - 18], [hx + 5, hy - 11], [hx - 2, hy - 8]], C.hairHi, .7);
    }, .8);

    /* 鬓角 / 耳侧乱发 */
    pen.poly([[hx - 25, hy - 6], [hx - 19, hy - 4], [hx - 21, hy + 10], [hx - 26, hy + 4]], C.hair);
    pen.poly([[hx + 25, hy - 6], [hx + 19, hy - 4], [hx + 21, hy + 10], [hx + 26, hy + 4]], C.hair);

    /* 翘出的乱发丝 */
    pen.spike(hx - 27, hy + 3, 10, 195 * D, 3.2, C.hair, 1.5);
    pen.spike(hx + 27, hy + 2, 10, -20 * D, 3.2, C.hair, 1.5);
    pen.spike(hx - 10, hy - 26, 7, -95 * D, 2.8, C.hair, 0.5);
    pen.spike(hx + 14, hy - 26, 7, -70 * D, 2.8, C.hair, 0.5);

    /* 耳 */
    pen.ellipse(hx - 24, hy + 5, 3.4, 5.2, SK.base);
    pen.ellipse(hx + 24, hy + 5, 3.4, 5.2, SK.lo);

    /* 胡茬（下颚与下巴的暗色带，clipped 到脸型内） */
    pen.clipBlob(hd.pts, function (p) {
      p.blob([
        [hx - HRX * .95, hy + 8], [hx - HRX * .98, hy + 15],
        [hx - HRX * .62, hy + 23], [hx, hy + 25],
        [hx + HRX * .62, hy + 23], [hx + HRX * .98, hy + 15],
        [hx + HRX * .95, hy + 8], [hx, hy + 12]
      ], ST.lo, .7);
    }, .95);

    /* 左颊创可贴（X 形胶布） */
    pen.save();
    pen.translate(hx - 15, hy + 9);
    pen.rotate(-0.25);
    pen.rect(-3.5, -4.5, 7, 9, C.plaster);
    pen.line([[-2.5, -3.5], [2.5, 3.5]], SK.line, 1.1, false);
    pen.line([[2.5, -3.5], [-2.5, 3.5]], SK.line, 1.1, false);
    pen.restore();

    /* 五官（诚恳的宽眼 + 浓眉） */
    var eyeY = hy + 2;
    RIG.brow(pen, hx, eyeY - 10, 21, 5.8, s.brow, P.line);
    RIG.eyes(pen, hx, eyeY, 20, 4.8, s.eyes, { pupil: s.pupil, iris: '#3a2a1e', turn: s.headTurn });
    pen.line([[hx + 1, eyeY + 4], [hx + 3.2, eyeY + 9], [hx + 0.4, eyeY + 10]], SK.line, 1.2, true);
    RIG.mouth(pen, hx + (s.headTurn || 0) * 2, hy + 16, 11, s.mouth, SK.line, '#93414a');

    pen.restore();

    /* 右臂（画在头之后，敬礼时手掌落在额前/太阳穴） */
    arm(CX + SHX, shoulder, s.hR, true, s.kindR, s.angR, 1);

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
        eyes: 'normal',
        mouth: tm(talk, f)
      });
    },
    salute: function (f, talk) {
      return RIG.base({
        bob: f % 2 ? 0 : -1,
        hR: [-12, -52], kindR: 'open', angR: -1.3,
        hL: [-8, 58],
        eyes: 'normal', brow: 'up',
        mouth: talk ? (f % 2 ? 'open' : 'grin') : 'grin'
      });
    },
    confused: function (f, talk) {
      return RIG.base({
        bob: f % 2 ? 0 : -1,
        headTilt: -6,
        hL: [18, -48], kindL: 'open', angL: -1.2,
        hR: [-6, 58],
        eyes: 'normal', brow: 'up',
        mouth: talk ? (f % 2 ? 'open' : 'flat') : 'flat',
        symbol: 'question', symbolX: -6
      });
    },
    sweat: function (f, talk) {
      return RIG.base({
        bob: f % 2 ? 0 : -1, lean: -2,
        hL: [-22, 12], hR: [22, 14], kindL: 'open', kindR: 'open',
        eyes: 'wide', brow: 'sad',
        mouth: talk ? (f % 2 ? 'open' : 'flat') : 'flat',
        sweat: 3, sweatY: f % 2 ? 0 : 2, headTilt: -2
      });
    },
    happy: function (f, talk) {
      return RIG.base({
        bob: f % 2 ? -1 : 0,
        eyes: f === 3 ? 'closed' : 'normal', brow: 'up',
        mouth: talk ? (f % 2 ? 'open' : 'grin') : 'grin',
        hR: [-2, -34], kindR: 'fist', angR: -0.9
      });
    },
    shock: function (f, talk) {
      return RIG.base({
        bob: f % 2 ? -2 : -1, lean: -3,
        hL: [-24, 16], hR: [24, 18], kindL: 'open', kindR: 'open',
        eyes: 'wide', brow: 'up', mouth: 'o', pupil: [0, -0.3],
        symbol: 'shock', headY: -2, stance: 2
      });
    },
    sad: function (f, talk) {
      return RIG.base({
        bob: f % 2 ? 2 : 1, lean: -2,
        hL: [-6, 60], hR: [6, 60],
        eyes: 'sad', brow: 'sad',
        mouth: talk ? (f % 2 ? 'open' : 'frown') : 'frown',
        headTilt: -4, headY: 2
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
    angry: function (f, talk) {
      return RIG.base({
        bob: f % 2 ? 1 : 0, lean: 2,
        hL: [-16, 34], hR: [16, 34], kindL: 'fist', kindR: 'fist',
        eyes: 'angry', brow: 'angry',
        mouth: talk ? (f % 2 ? 'shout' : 'frown') : 'frown',
        symbol: 'anger', symbolCol: '#ff6a6a'
      });
    },
    point: function (f, talk) {
      return RIG.base({
        bob: f % 2 ? -1 : 0, lean: 1.5,
        hL: [-4, 58], hR: [22, 6], kindR: 'point', angR: -0.6,
        mouth: talk ? (f % 2 ? 'open' : 'smile') : 'smile'
      });
    }
  };

  RIG.define('itonokogiri', { label: '糸锯', full: '糸锯 圭介', gender: 'm', outline: '#241a16', draw: draw, poses: poses, frames: { normal: 4, salute: 2, happy: 4, shock: 2 } });

})(window.AA);
