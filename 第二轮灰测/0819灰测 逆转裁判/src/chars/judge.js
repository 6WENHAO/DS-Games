/* ============================================================
   judge.js — 审判长（The Judge）
   ・年迈、和蔼但耳根软的审判长。平时在审判席后只露出胸像，
     所以头、胡须、法帽与肩部是全部个性所在。
   ・骨架基准（画布 148×232，脚底 y=222，含法帽全高 200px）
       帽顶 y≈24 / 颅顶 38 / 头心 62 / 下巴 88 / 肩线 100
       肩点 (74±32, 106) / 腰 152 / 膝 190 / 脚 218
   ・手用 hL/hR = [相对肩点的 dx,dy] 指定，IK 自动求肘
   ============================================================ */
(function (AA) {
  'use strict';
  var U = AA.U, P = AA.PAL, RIG = AA.RIG;
  var D = Math.PI / 180;

  /* ---------------- 配色 ---------------- */
  var C = {
    robe: '#23252f', robeHi: '#33364a', robeLo: '#15161d', robeEdge: '#0e0f14',
    collar: '#e6d9b6',
    beard: '#e8e6df', beardLo: '#c3c2bc', beardHi: '#ffffff',
    cap: '#1a1c26', band: '#c9a44c',
    shoe: '#6e2a30',
    iris: '#2a2f3a', mouthIn: '#8c3a44',
    gavelHead: '#8b5f38', gavelHandle: '#6a4a2e'
  };
  var SK = P.skin;

  /* 骨架常量 */
  var CX = 74, HY = 62, HRX = 25, HRY = 26;
  var SHY = 100, SHOULDER = 106, SHX = 32, HIP = 152;
  var L1 = 32, L2 = 28;

  /* 木槌：圆柱头 + 柄（垂直于柄的横圆柱头） */
  function gavel(pen, x, y, ang) {
    var hx2 = x + Math.cos(ang) * 14, hy2 = y + Math.sin(ang) * 14;
    pen.taper([[x, y], [(x + hx2) / 2, (y + hy2) / 2], [hx2, hy2]], 5.2, 4.4, C.gavelHandle);
    pen.save();
    pen.translate(hx2, hy2);
    pen.rotate(ang);
    pen.rrect(-4.5, -9, 9, 18, 3.4, C.gavelHead);
    pen.rrect(-4.5, -1.1, 9, 2.2, 1, C.gavelHandle);
    pen.restore();
  }

  function draw(pen, s) {
    var bob = s.bob || 0;
    var hip = HIP + bob, shy = SHY + bob, shoulder = SHOULDER + bob;

    /* ================= 腿（简朴，长袍遮住大半） ================= */
    var st = s.stance || 0;
    RIG.leg(pen, CX - 14 - st, hip + 2, -2 + (s.legL || 0), 2, 36, 28, 20, 14, C.robe, C.robeLo, C.shoe, -1);
    RIG.leg(pen, CX + 14 + st, hip + 2, 2 + (s.legR || 0), -2, 36, 28, 20, 14, C.robe, C.robeLo, C.shoe, 1);
    pen.taper([[CX - 11, hip], [CX, hip + 11], [CX + 11, hip]], 5, 5, C.robeLo);

    /* ================= 上身（可倾斜） ================= */
    pen.save();
    if (s.lean) { pen.translate(CX, hip); pen.rotate(s.lean * D); pen.translate(-CX, -hip); }

    /* 黑袍 */
    var robe = [
      [CX - 30, shy], [CX - 37, shy + 14], [CX - 35, shy + 34],
      [CX - 30, hip + 6], [CX - 12, hip + 12], [CX, hip + 13], [CX + 12, hip + 12],
      [CX + 30, hip + 6], [CX + 35, shy + 34], [CX + 37, shy + 14], [CX + 30, shy],
      [CX + 15, shy - 6], [CX, shy - 8], [CX - 15, shy - 6]
    ];
    pen.blob(robe, C.robe, .92);
    pen.clipBlob(robe, function (p) {
      p.blob([[CX + 12, shy - 16], [CX + 44, shy - 6], [CX + 44, hip + 22], [CX + 16, hip + 22]], C.robeLo, .55);
      p.blob([[CX - 33, shy - 4], [CX - 20, shy - 2], [CX - 22, shy + 34], [CX - 34, shy + 28]], C.robeHi, .6);
      p.blob([[CX - 34, hip - 6], [CX + 34, hip - 6], [CX + 32, hip + 16], [CX - 32, hip + 16]], C.robeLo, .5);
    }, .92);

    /* 白色立领（颈周一圈，宽到肩，被胡须遮住中间、两侧露出框住胡须） */
    var collar = [
      [CX - 26, shy - 4], [CX - 20, shy - 16], [CX + 20, shy - 16], [CX + 26, shy - 4],
      [CX + 25, shy + 8], [CX + 13, shy + 12], [CX - 13, shy + 12], [CX - 25, shy + 8]
    ];
    pen.blob(collar, C.collar, .9);
    pen.clipBlob(collar, function (p) {
      p.blob([[CX + 4, shy - 14], [CX + 24, shy - 10], [CX + 24, shy + 12], [CX + 5, shy + 12]], C.beardLo, .6);
    }, .9);

    /* 胸前白色前襟（竖直白条，上半被胡须遮住，下半露出） */
    pen.taper([[CX, shy + 2], [CX, shy + 30], [CX, hip + 10]], 13, 10, C.collar);
    pen.taper([[CX + 3, shy + 4], [CX + 3, shy + 30], [CX + 2.5, hip + 10]], 3, 2.4, C.beardLo);

    /* ================= 头（先画，让手臂/手盖在胡须上） ================= */
    var hx = CX + (s.headX || 0), hy = HY + bob + (s.headY || 0);

    /* 颈（被胡须遮住大半） */
    pen.taper([[CX, shy - 6], [hx, hy + 16]], 15, 13, SK.lo);

    pen.save();
    if (s.headTilt) { pen.translate(hx, hy + 24); pen.rotate(s.headTilt * D); pen.translate(-hx, -(hy + 24)); }

    /* 光头 */
    RIG.head(pen, hx, hy, HRX, HRY, SK, { jaw: .8, chin: 1.0 });

    /* 两侧白发（鬓角，与胡须相连） */
    var hairL = [[hx - 24, hy - 6], [hx - 18, hy - 15], [hx - 12, hy - 17], [hx - 10, hy - 4], [hx - 13, hy + 7], [hx - 21, hy + 3]];
    var hairR = [[hx + 24, hy - 6], [hx + 18, hy - 15], [hx + 12, hy - 17], [hx + 10, hy - 4], [hx + 13, hy + 7], [hx + 21, hy + 3]];
    pen.blob(hairL, C.beard, .9);
    pen.blob(hairR, C.beard, .9);
    pen.clipBlob(hairL, function (p) {
      p.blob([[hx - 21, hy - 2], [hx - 16, hy - 6], [hx - 14, hy + 4], [hx - 20, hy + 2]], C.beardLo, .6);
    }, .9);
    pen.clipBlob(hairR, function (p) {
      p.blob([[hx + 20, hy - 2], [hx + 16, hy - 6], [hx + 15, hy + 4], [hx + 19, hy + 2]], C.beardLo, .6);
    }, .9);

    /* 黑色方顶法帽 */
    var capPts = [
      [hx - 24, hy - 21], [hx - 22, hy - 30], [hx - 9, hy - 32], [hx + 9, hy - 32], [hx + 22, hy - 30], [hx + 24, hy - 21],
      [hx + 20, hy - 19], [hx - 20, hy - 19]
    ];
    pen.blob(capPts, C.cap, .95);
    pen.clipBlob(capPts, function (p) {
      p.blob([[hx - 22, hy - 31], [hx - 5, hy - 32], [hx - 3, hy - 25], [hx - 18, hy - 24]], C.robeHi, .6);
    }, .95);
    /* 帽檐金带 + 顶钮/穗（像素对齐，避免抗锯齿产生杂色） */
    pen.rrect(hx - 23, hy - 24, 46, 4.5, 2, C.band);
    pen.rect(hx - 1, hy - 34, 2, 2, C.band);

    /* 五官 */
    var eyeY = hy + 2;
    /* 浓白眉（深影在下 + 白在上） */
    RIG.brow(pen, hx, eyeY - 9, 21, 5.2, s.brow, C.beardLo);
    RIG.brow(pen, hx, eyeY - 11, 21, 4.4, s.brow, C.beardHi);
    RIG.eyes(pen, hx, eyeY, 18, 4.2, s.eyes, { pupil: s.pupil, iris: C.iris, turn: s.headTurn });
    /* 鼻 + 眼下皱纹 */
    pen.line([[hx, eyeY + 3], [hx - 1.6, eyeY + 7], [hx + 0.6, eyeY + 7.6]], SK.line, 1.2, true);
    pen.line([[hx - 10, eyeY + 4], [hx - 7, eyeY + 7.6], [hx - 3.5, eyeY + 6]], SK.line, 1.1, true);
    pen.line([[hx + 10, eyeY + 4], [hx + 7, eyeY + 7.6], [hx + 3.5, eyeY + 6]], SK.line, 1.1, true);

    /* 胡须（招牌：覆盖整个下半脸 + 胸口） */
    var showMouth = s.mouth && s.mouth !== 'closed';
    /* 上唇髭 */
    var moust = [
      [hx - 20, hy + 6], [hx - 10, hy + 7], [hx, hy + 7], [hx + 10, hy + 7], [hx + 20, hy + 6],
      [hx + 18, hy + 12], [hx + 9, hy + 19], [hx, hy + 20], [hx - 9, hy + 19], [hx - 18, hy + 12]
    ];
    pen.blob(moust, C.beard, .9);
    pen.clipBlob(moust, function (p) {
      p.blob([[hx - 14, hy + 8], [hx - 2, hy + 10], [hx - 4, hy + 17], [hx - 12, hy + 14]], C.beardHi, .7);
    }, .9);

    /* 嘴（说话/表情时从髭下露出来） */
    if (showMouth) RIG.mouth(pen, hx, hy + 21, 7.5, s.mouth, SK.line, C.mouthIn);

    /* 下半胡须（大三角，盖住嘴/颈/胸口） */
    var gap = showMouth ? 27 : 17;
    var beardPts = [
      [hx - 24, hy + 4], [hx - 20, hy + 12], [hx - 14, hy + 16],
      [hx - 7, hy + (gap - 3)], [hx, hy + gap],
      [hx + 7, hy + (gap - 3)], [hx + 14, hy + 16], [hx + 20, hy + 12], [hx + 24, hy + 4],
      [hx + 18, hy + 38], [hx + 13, hy + 60], [hx + 8, hy + 78], [hx + 4, hy + 86],
      [hx, hy + 88], [hx - 4, hy + 86], [hx - 8, hy + 78], [hx - 13, hy + 60], [hx - 18, hy + 38]
    ];
    pen.blob(beardPts, C.beard, .92);
    pen.clipBlob(beardPts, function (p) {
      p.blob([[hx + 3, hy], [hx + 22, hy + 4], [hx + 22, hy + 90], [hx + 5, hy + 90]], C.beardLo, .6);
      p.blob([[hx - 21, hy + 2], [hx - 9, hy + 2], [hx - 11, hy + 70], [hx - 19, hy + 70]], C.beardHi, .5);
      p.blob([[hx - 15, hy + 68], [hx + 15, hy + 68], [hx + 9, hy + 90], [hx - 9, hy + 90]], C.beardLo, .5);
    }, .92);
    /* 须纹 */
    pen.line([[hx - 5, hy + 24], [hx - 7, hy + 58], [hx - 4, hy + 78]], C.beardLo, 1.2, true);
    pen.line([[hx + 5, hy + 24], [hx + 7, hy + 58], [hx + 4, hy + 78]], C.beardLo, 1.2, true);
    pen.line([[hx - 1, hy + 30], [hx, hy + 60], [hx - 1, hy + 82]], C.beardLo, 1.2, true);
    pen.line([[hx - 3, hy + 26], [hx - 4, hy + 52]], C.beardHi, 1, true);
    pen.line([[hx + 3, hy + 26], [hx + 4, hy + 52]], C.beardHi, 1, true);

    pen.restore(); /* headTilt */

    /* ================= 手臂（画在胡须之后，让手盖在胡须上） ================= */
    function arm(sx, sy, off, dark, kind, ang, bend, isGavel) {
      var h = RIG.armTo(pen, sx, sy, sx + off[0], sy + off[1], L1, L2, 22, 17, 13,
        dark ? C.robeLo : C.robe, dark ? null : C.robeHi, bend, C.robeEdge);
      var dir = Math.atan2(h[1] - h[3], h[0] - h[2]);
      pen.circle(h[0], h[1], 8.2, C.robeEdge);
      pen.circle(h[0], h[1], 7.0, dark ? C.robeLo : C.robe);
      var hndx = h[0] + Math.cos(dir) * 6.8, hndy = h[1] + Math.sin(dir) * 6.8;
      RIG.hand(pen, hndx, hndy, 6.4, SK.base, SK.lo, kind, ang == null ? dir : ang);
      if (isGavel) gavel(pen, hndx, hndy, s.gavelAng || -0.55);
      return h;
    }
    arm(CX + SHX, shoulder, s.hR, true, s.kindR, s.angR, 1, s.gavel);
    arm(CX - SHX, shoulder, s.hL, false, s.kindL, s.angL, -1, false);

    if (s.sweat) RIG.sweat(pen, hx + 24, hy - 16 + (s.sweatY || 0), 4.4, s.sweat, 0);
    if (s.symbol) RIG.symbol(pen, hx + (s.symbolX || 27), hy - 36, s.symbol, s.symbolCol || '#ffffff');

    pen.restore(); /* lean */
  }

  /* ---------------- 姿势 ---------------- */
  function tm(talk, f) {
    return talk ? (f % 2 ? 'open' : 'closed') : 'closed';
  }

  var poses = {
    normal: function (f, talk) {
      return RIG.base({
        bob: f % 2 ? 0 : -1,
        eyes: f === 3 ? 'narrow' : 'normal',
        brow: 'normal',
        mouth: tm(talk, f)
      });
    },
    nod: function (f, talk) {
      return RIG.base({
        bob: f % 2 ? 1 : 0,
        headY: 3, headTilt: 2,
        eyes: 'closed', brow: 'normal',
        mouth: 'closed'
      });
    },
    surprise: function (f, talk) {
      return RIG.base({
        bob: f % 2 ? -1 : 0,
        hL: [-24, -2], hR: [24, -2], kindL: 'open', kindR: 'open',
        eyes: 'wide', brow: 'up', mouth: 'o', pupil: [0, -0.3],
        symbol: 'shock', symbolX: 27, headY: -2
      });
    },
    angry: function (f, talk) {
      return RIG.base({
        bob: f % 2 ? 1 : 0,
        hL: [-10, 52], hR: [22, -30], kindL: 'fist', kindR: 'fist',
        eyes: 'angry', brow: 'angry',
        mouth: talk ? (f % 2 ? 'open' : 'frown') : 'frown',
        headY: 1
      });
    },
    think: function (f, talk) {
      return RIG.base({
        bob: f % 2 ? 0 : -1,
        hL: [-6, 58], hR: [-22, -4], kindR: 'fist', kindL: 'fist',
        eyes: 'narrow', brow: 'down',
        mouth: 'flat', headTilt: -3
      });
    },
    confused: function (f, talk) {
      return RIG.base({
        bob: f % 2 ? 0 : -1,
        headTilt: -8, headY: 1,
        eyes: 'normal', brow: 'up', mouth: 'flat',
        symbol: 'question', symbolX: 27, pupil: [0.2, 0]
      });
    },
    gavel: function (f, talk) {
      var raised = (f % 2) === 0;
      return RIG.base({
        bob: raised ? -1 : 1,
        hL: [-8, 50], hR: raised ? [16, -40] : [16, -12],
        kindL: 'fist', kindR: 'fist',
        gavel: true, gavelAng: raised ? -0.55 : 1.35,
        eyes: 'normal', brow: 'down',
        mouth: 'closed', headY: raised ? -1 : 2
      });
    },
    happy: function (f, talk) {
      return RIG.base({
        bob: f % 2 ? -1 : 0,
        eyes: f === 3 ? 'closed' : 'normal', brow: 'up',
        mouth: talk ? (f % 2 ? 'open' : 'smile') : 'smile'
      });
    },
    sad: function (f, talk) {
      return RIG.base({
        bob: f % 2 ? 0 : -1,
        hL: [-6, 58], hR: [6, 58],
        eyes: 'sad', brow: 'sad',
        mouth: talk ? (f % 2 ? 'open' : 'frown') : 'frown',
        headTilt: -4, headY: 2
      });
    }
  };

  RIG.define('judge', {
    label: '审判长', full: '审判长', gender: 'm',
    outline: '#241a16',
    draw: draw,
    poses: poses,
    frames: { normal: 4, nod: 2, surprise: 2, gavel: 2 }
  });

})(window.AA);
