/* ============================================================
   mayoi.js — 绫里 真宵（灵媒师助手）
   ・画布 148×232，脚底 y=222；略矮于成步堂（≈192px），肩更窄
   ・骨架沿用 rig.js / naruhodo.js 的基准，仅做身形微调
   ・配色全部取自顶部 C 表（颜色自动收集，勿登记 paletteList）
   ============================================================ */
(function (AA) {
  'use strict';
  var U = AA.U, P = AA.PAL, RIG = AA.RIG;
  var D = Math.PI / 180;

  /* ---------------- 配色 ---------------- */
  var C = {
    robe: '#6c4a9c', robeLo: '#4b3271', robeHi: '#8f6cc0', robeEdge: '#33204f',
    obi: '#ece7d6', obiLo: '#c4bd9f', obiKnot: '#d8d2bd',
    collar: '#ffffff', collarLo: '#cfd0d4',
    hair: '#1b1b24', hairHi: '#3b3f58', hairHi2: '#525a7e', hairSpec: '#8f9bd0',
    band: '#e9e4d2', bandLo: '#bdb79e',
    jade: '#2e8b6a', jadeLo: '#1c5c46', jadeHi: '#5cc49a', cord: '#7a3540', cordHi: '#a34b57',
    shoe: '#2a2530', shoeHi: '#443d4c', sock: '#d8cfe8'
  };
  var SK = P.skinPale;

  /* ---------------- 骨架常量（比参考略窄、略矮） ---------------- */
  var CX = 74, HAIRTOP = 24, HY = 62, HRX = 23, HRY = 25;
  var CHIN = 87, SHY = 100, SHOULDER = 106, SHX = 25, HIP = 150;
  var L1 = 32, L2 = 28;

  function draw(pen, s) {
    var bob = s.bob || 0;
    var hip = HIP + bob, shy = SHY + bob, shoulder = SHOULDER + bob;

    /* ================= 及臀长直发（最底层，被上身盖住） ================= */
    var hx = CX + (s.headX || 0), hy = HY + bob + (s.headY || 0);

    /* 及臀长直发（大块暗色，从后脑垂到 y≈185，宽过肩线 → 两侧垂发可见） */
    var hair = [
      [hx - 27, hy - 6], [hx - 24, hy - 24], [hx - 6, hy - 30], [hx + 8, hy - 30],
      [hx + 24, hy - 24], [hx + 28, hy - 6],
      [hx + 34, hy + 4], [hx + 34, hy + 64], [hx + 31, hy + 106], [hx + 24, hy + 122],
      [hx + 10, hy + 126], [hx - 10, hy + 126], [hx - 24, hy + 122], [hx - 31, hy + 106],
      [hx - 34, hy + 64], [hx - 34, hy + 4]
    ];
    pen.blob(hair, C.hair, .94);
    pen.clipBlob(hair, function (p) {
      // 发梢尖角（左右各一撮）
      p.blob([[hx - 36, hy + 106], [hx - 19, hy + 126], [hx - 11, hy + 128], [hx - 26, hy + 111]], C.hair, .8);
      p.blob([[hx + 36, hy + 106], [hx + 19, hy + 126], [hx + 11, hy + 128], [hx + 26, hy + 111]], C.hair, .8);
      // 两侧高光（两档）
      p.blob([[hx - 36, hy - 8], [hx - 30, hy + 20], [hx - 32, hy + 108], [hx - 34, hy + 112],
        [hx - 36, hy + 60], [hx - 36, hy]], C.hairHi, .6);
      p.blob([[hx + 36, hy - 8], [hx + 30, hy + 20], [hx + 32, hy + 108], [hx + 34, hy + 112],
        [hx + 36, hy + 60], [hx + 36, hy]], C.hairHi2, .6);
      // 头顶亮色反光带
      p.blob([[hx - 24, hy - 30], [hx - 6, hy - 33], [hx + 8, hy - 33], [hx + 24, hy - 29],
        [hx + 20, hy - 22], [hx - 20, hy - 22]], C.hairSpec, .6);
    }, .94);

    /* ================= 腿（略短 → 全高约 192px） ================= */
    var st = s.stance || 0;
    RIG.leg(pen, CX - 12 - st, hip + 2, -1 + (s.legL || 0), 3, 34, 28, 19, 13, C.sock, C.sock, C.shoe, -1);
    RIG.leg(pen, CX + 12 + st, hip + 2, 1 + (s.legR || 0), -3, 34, 28, 19, 13, C.sock, C.sock, C.shoe, 1);
    pen.taper([[CX - 10, hip], [CX, hip + 10], [CX + 10, hip]], 4.5, 4.5, C.robeLo);

    /* ================= 上身（可倾斜） ================= */
    pen.save();
    if (s.lean) { pen.translate(CX, hip); pen.rotate(s.lean * D); pen.translate(-CX, -hip); }

    /* 紫色巫女袍 */
    var robe = [
      [CX - 26, shy], [CX - 31, shy + 13], [CX - 33, shy + 32],
      [CX - 30, hip + 8], [CX - 13, hip + 13], [CX, hip + 14], [CX + 13, hip + 13],
      [CX + 30, hip + 8], [CX + 33, shy + 32], [CX + 31, shy + 13], [CX + 26, shy],
      [CX + 13, shy - 7], [CX, shy - 9], [CX - 13, shy - 7]
    ];
    pen.blob(robe, C.robe, .92);
    pen.clipBlob(robe, function (p) {
      // 右侧（观众右）暗面
      p.blob([[CX + 12, shy - 14], [CX + 40, shy - 4], [CX + 40, hip + 22], [CX + 17, hip + 22]], C.robeLo, .55);
      // 左肩亮面
      p.blob([[CX - 28, shy - 3], [CX - 18, shy - 1], [CX - 20, shy + 32], [CX - 29, shy + 26]], C.robeHi, .6);
      // 衣摆（下摆）暗
      p.blob([[CX - 32, hip - 4], [CX + 32, hip - 4], [CX + 30, hip + 16], [CX - 30, hip + 16]], C.robeLo, .5);
    }, .92);

    /* 内衬白领 V 区 */
    var vee = [[CX - 11, shy - 7], [CX, shy - 2], [CX + 11, shy - 7],
    [CX + 9, shy + 22], [CX, shy + 33], [CX - 9, shy + 22]];
    pen.blob(vee, C.collar, .85);
    pen.clipBlob(vee, function (p) {
      p.blob([[CX + 2, shy - 11], [CX + 16, shy - 7], [CX + 16, shy + 40], [CX + 3, shy + 40]], C.collarLo, .6);
    }, .85);
    pen.poly([[CX - 11, shy - 8], [CX - 3, shy - 1], [CX - 7, shy + 7], [CX - 14, shy - 2]], C.collar);
    pen.poly([[CX + 11, shy - 8], [CX + 3, shy - 1], [CX + 7, shy + 7], [CX + 14, shy - 2]], C.collarLo);

    /* 腰带（obi，宽腰封 + 中央小结） */
    pen.blob([[CX - 29, hip - 8], [CX - 26, hip - 13], [CX + 26, hip - 13], [CX + 29, hip - 8],
      [CX + 27, hip + 1], [CX - 27, hip + 1]], C.obi, .9);
    pen.clipBlob([[CX - 29, hip - 8], [CX - 26, hip - 13], [CX + 26, hip - 13], [CX + 29, hip - 8],
      [CX + 27, hip + 1], [CX - 27, hip + 1]], function (p) {
      p.blob([[CX + 2, hip - 14], [CX + 26, hip - 12], [CX + 26, hip + 2], [CX + 4, hip + 2]], C.obiLo, .55);
    }, .9);
    pen.rrect(CX - 5, hip - 9, 10, 11, 3, C.obiKnot);
    pen.circle(CX, hip - 3.5, 2.6, C.obiLo);

    /* 勾玉（magatama）—— 玉珠串 + 逗号形翡翠（挂在胸口紫衣上，≈8px） */
    pen.line([[CX, shy + 8], [CX, shy + 22]], C.cordHi, 2.8, true);
    for (var bi = 0; bi < 6; bi++) pen.circle(CX, shy + 9 + bi * 2.4, 1.5, bi % 2 ? C.cord : C.cordHi);
    pen.blob([[CX - 0.2, shy + 23.6], [CX + 6.0, shy + 22.6], [CX + 7.8, shy + 28], [CX + 5.4, shy + 33.2],
      [CX + 0.6, shy + 34.8], [CX - 3.2, shy + 30.8]], C.robeEdge, .92);
    pen.blob([[CX, shy + 24], [CX + 5.6, shy + 23], [CX + 7.2, shy + 28], [CX + 5.0, shy + 32.5],
      [CX + 0.4, shy + 34], [CX - 2.8, shy + 30.4]], C.jade, .92);
    pen.circle(CX - 2.4, shy + 30.6, 2.8, C.robe);
    pen.circle(CX + 1.6, shy + 26.6, 1.7, C.jadeHi);
    pen.circle(CX + 5.2, shy + 31.4, 1.5, C.jadeLo);
    pen.circle(CX + 1.6, shy + 23.4, 1.1, C.cordHi);

    /* ================= 手臂（宽袖） ================= */
    function arm(sx, sy, off, dark, kind, ang, bend) {
      var h = RIG.armTo(pen, sx, sy, sx + off[0], sy + off[1], L1, L2, 17, 14, 11,
        dark ? C.robeLo : C.robe, dark ? null : C.robeHi, bend, C.robeEdge);
      var dir = Math.atan2(h[1] - h[3], h[0] - h[2]);
      // 巫女服的垂袖（搭在手臂外侧）
      var ox = sx + (dark ? -1 : 1) * 1.0;
      pen.blob([[ox, sy - 4], [ox + (dark ? 1.4 : -1.4), sy + 2], [ox + (dark ? 3.4 : -3.4), sy + 16],
        [ox + (dark ? 1.6 : -1.6), sy + 30], [ox + (dark ? -2.2 : 2.2), sy + 28],
        [ox + (dark ? -3.0 : 3.0), sy + 8]], dark ? C.robeLo : C.robe, .85);
      // 袖口
      pen.circle(h[0], h[1], 6.6, C.robeEdge);
      pen.circle(h[0], h[1], 5.6, dark ? C.robeLo : C.robe);
      RIG.hand(pen, h[0] + Math.cos(dir) * 5.8, h[1] + Math.sin(dir) * 5.8, 5.8, SK.base, SK.lo,
        kind, ang == null ? dir : ang);
      return h;
    }
    arm(CX + SHX, shoulder, s.hR, true, s.kindR, s.angR, 1);
    arm(CX - SHX, shoulder, s.hL, false, s.kindL, s.angL, -1);

    /* ================= 头 ================= */

    /* 脖子（衣服之后、脸之前） */
    pen.taper([[CX, shy - 4], [hx, hy + 22]], 15, 13, SK.lo);
    pen.taper([[CX - 0.5, shy - 3], [hx - 1, hy + 22]], 10, 9, SK.base);

    pen.save();
    if (s.headTilt) { pen.translate(hx, hy + 24); pen.rotate(s.headTilt * D); pen.translate(-hx, -(hy + 24)); }

    /* 后脑发块（被长发遮住的部分，给头顶一个底） */
    pen.blob([[hx - 26, hy - 4], [hx - 22, hy - 22], [hx, hy - 29], [hx + 22, hy - 22],
      [hx + 26, hy - 4], [hx + 23, hy + 9], [hx - 23, hy + 9]], C.hair, .95);

    /* 脸 */
    RIG.head(pen, hx, hy, HRX, HRY, SK, { jaw: .82, chin: 1.10 });

    /* 齐刘海（平直、锯齿，露出足够脸） */
    var fringe = [
      [hx - 25, hy - 6], [hx - 22, hy - 21], [hx - 8, hy - 27], [hx + 8, hy - 27],
      [hx + 22, hy - 20], [hx + 25, hy - 5],
      [hx + 19, hy - 9], [hx + 13, hy - 3], [hx + 7, hy - 11],
      [hx, hy - 4], [hx - 7, hy - 11], [hx - 14, hy - 3], [hx - 19, hy - 9]
    ];
    pen.blob(fringe, C.hair, .8);
    pen.clipBlob(fringe, function (p) {
      p.blob([[hx - 18, hy - 23], [hx - 4, hy - 26], [hx + 1, hy - 21], [hx - 13, hy - 17]], C.hairHi, .7);
      p.blob([[hx + 7, hy - 24], [hx + 16, hy - 20], [hx + 17, hy - 15], [hx + 8, hy - 18]], C.hairHi2, .7);
    }, .8);
    // 鬓角
    pen.poly([[hx - 24, hy - 7], [hx - 19, hy - 4], [hx - 20, hy + 10], [hx - 25, hy + 4]], C.hair);
    pen.poly([[hx + 24, hy - 7], [hx + 19, hy - 4], [hx + 20, hy + 10], [hx + 25, hy + 4]], C.hair);

    /* 头顶发髻（topknot bun）+ 白色发带 */
    pen.blob([[hx - 8, hy - 27], [hx + 8, hy - 27], [hx + 10, hy - 38], [hx + 6, hy - 44],
      [hx - 6, hy - 44], [hx - 10, hy - 38]], C.hair, .9);
    pen.clipBlob([[hx - 8, hy - 27], [hx + 8, hy - 27], [hx + 10, hy - 38], [hx + 6, hy - 44],
      [hx - 6, hy - 44], [hx - 10, hy - 38]], function (p) {
      p.blob([[hx + 1, hy - 44], [hx + 7, hy - 42], [hx + 9, hy - 34], [hx + 2, hy - 33]], C.hairHi, .7);
    }, .9);
    pen.rrect(hx - 8.5, hy - 37, 17, 6.5, 3, C.band);
    pen.circle(hx, hy - 35.5, 2.2, C.band);

    /* 耳 */
    pen.ellipse(hx - 23, hy + 5, 3.2, 5.0, SK.base);
    pen.ellipse(hx + 23, hy + 5, 3.2, 5.0, SK.lo);

    /* 五官 */
    var eyeY = hy + 2;
    RIG.brow(pen, hx, eyeY - 10, 19, 4.2, s.brow, C.hair);
    RIG.eyes(pen, hx, eyeY, 19, 5.0, s.eyes, { pupil: s.pupil, iris: '#3a4a6a', turn: s.headTurn });
    pen.line([[hx + 1, eyeY + 4], [hx + 3.2, eyeY + 9], [hx + 0.4, eyeY + 10]], SK.line, 1.2, true);
    RIG.mouth(pen, hx + (s.headTurn || 0) * 2, hy + 17, 10, s.mouth, SK.line, '#93414a');
    if (s.blush) { RIG.blush(pen, hx - 14, hy + 9, 7.5); RIG.blush(pen, hx + 14, hy + 9, 7.5); }

    pen.restore();

    if (s.sweat) RIG.sweat(pen, hx + 25, hy - 14 + (s.sweatY || 0), 4.6, s.sweat, 0);
    if (s.symbol) RIG.symbol(pen, hx + (s.symbolX || 25), hy - 33, s.symbol, s.symbolCol || '#ffffff');

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
    happy: function (f, talk) {
      return RIG.base({
        bob: f % 2 ? -1 : 0,
        hL: [-4, 56], hR: [-14, 16], kindR: 'open', angR: -0.5,
        eyes: f === 3 ? 'closed' : 'normal', brow: 'up',
        mouth: talk ? (f % 2 ? 'open' : 'grin') : 'grin'
      });
    },
    worried: function (f, talk) {
      return RIG.base({
        bob: f % 2 ? 0 : -1, lean: -1,
        hL: [-9, 34], hR: [9, 34], kindL: 'open', kindR: 'open',
        eyes: 'normal', brow: 'sad',
        mouth: talk ? (f % 2 ? 'open' : 'flat') : 'flat'
      });
    },
    think: function (f, talk) {
      return RIG.base({
        bob: f % 2 ? 0 : -1, lean: -1,
        hL: [-4, 56], hR: [-23, -15], kindR: 'fist',
        eyes: 'narrow', brow: 'down',
        mouth: talk ? (f % 2 ? 'open' : 'flat') : 'flat',
        headTilt: -3, pupil: [0.2, 0.2]
      });
    },
    surprised: function (f, talk) {
      return RIG.base({
        bob: f % 2 ? -1 : 0,
        hL: [-20, 24], hR: [20, 24], kindL: 'open', kindR: 'open',
        eyes: 'wide', brow: 'up',
        mouth: f % 2 ? 'o' : 'wide', pupil: [0, -0.2]
      });
    },
    sad: function (f, talk) {
      return RIG.base({
        bob: f % 2 ? 0 : -1, lean: -2,
        hL: [-4, 56], hR: [4, 56],
        eyes: 'sad', brow: 'sad',
        mouth: talk ? (f % 2 ? 'open' : 'frown') : 'frown',
        headTilt: -4, headY: 2, sweat: f % 2 ? 1 : 0
      });
    },
    angry: function (f, talk) {
      return RIG.base({
        bob: f % 2 ? 1 : 0, lean: 2,
        hL: [-14, 32], hR: [14, 32], kindL: 'fist', kindR: 'fist',
        eyes: 'angry', brow: 'angry',
        mouth: talk ? (f % 2 ? 'shout' : 'frown') : 'frown',
        symbol: 'anger', symbolCol: '#ff6a6a'
      });
    },
    cheer: function (f, talk) {
      return RIG.base({
        bob: f % 2 ? -2 : 0,
        hL: [-14, -8], hR: [14, -8], kindL: 'fist', kindR: 'fist', angL: -1.2, angR: 1.2,
        eyes: 'normal', brow: 'up',
        mouth: talk ? (f % 2 ? 'shout' : 'grin') : 'grin'
      });
    },
    point: function (f, talk) {
      return RIG.base({
        bob: f % 2 ? 0 : -1, lean: 1,
        hL: [-4, 56], hR: [30, 2], kindR: 'point', angR: -0.24,
        mouth: talk ? (f % 2 ? 'open' : 'smile') : 'smile',
        pupil: [0.2, -0.1]
      });
    },
    sweat: function (f, talk) {
      return RIG.base({
        bob: f % 2 ? 0 : -1, lean: -2,
        hL: [-10, 50], hR: [9, 46],
        eyes: 'wide', brow: 'sad',
        mouth: talk ? (f % 2 ? 'open' : 'flat') : 'flat',
        sweat: 2, sweatY: f % 2 ? 0 : 2, headTilt: -2
      });
    },
    shock: function (f, talk) {
      return RIG.base({
        bob: f % 2 ? -2 : -1, lean: -3,
        hL: [-24, 12], hR: [24, 14], kindL: 'open', kindR: 'open',
        eyes: 'wide', brow: 'up', mouth: 'o', pupil: [0, -0.3],
        symbol: 'shock', headY: -2, stance: 2
      });
    }
  };

  RIG.define('mayoi', {
    label: '真宵', full: '绫里 真宵', gender: 'f',
    outline: '#241a16',
    draw: draw,
    poses: poses,
    frames: { normal: 4, happy: 4, cheer: 2, shock: 2 }
  });

})(window.AA);
