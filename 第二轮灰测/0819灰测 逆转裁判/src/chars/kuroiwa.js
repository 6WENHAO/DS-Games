/* ============================================================
   kuroiwa.js — 黑岩 龙三（深夜电台制作人 / 真凶）
   外表圆滑、综艺范，骨子里透着油滑；高潮时崩溃。
     ・骨架基准同 naruhodo（画布 148×232，脚底 y=222）
     ・HEAVY 体型：宽肩、啤酒肚、短粗颈、大脸（jaw 0.9 / chin 1.0）
     ・常服：米白开襟西装 + 亮蓝绿夏威夷花衬衫（珊瑚红/黄花朵）
     ・配件：DJ 耳机挂脖、墨镜、粗金链
     ・normal/smug/laugh/think/angry/sad/sweat：墨镜遮眼（无可见眼）
       panic：墨镜滑到鼻梁下方露出惊恐眼；shock/breakdown：墨镜摘下
   ============================================================ */
(function (AA) {
  'use strict';
  var U = AA.U, P = AA.PAL, RIG = AA.RIG;
  var D = Math.PI / 180;

  /* ---------------- 配色 ---------------- */
  var C = {
    blazer: '#ded4bc', blazerLo: '#ab9f83', blazerHi: '#f3ecd8', blazerEdge: '#6b5b40',
    sleeveEdge: '#3a2c26',
    shirt: '#1f7d80', shirtLo: '#165c5f',
    coral: '#e8654f', yellow: '#f0c74a',
    pants: '#2a3a5c', pantsLo: '#1a2540',
    shoe: '#32323e',
    hair: '#1b1e2a', hairHi: '#303a56', hairHi2: '#3d4a70',
    lens: '#0e1016', glint: '#bfe6ff',
    gold: '#e0b24a', goldHi: '#f6dd94',
    cup: '#3d3f4d', cupHi: '#585a6a'
  };
  var SK = P.skinTan;

  /* 骨架常量（HEAVY 体型） */
  var CX = 74, HY = 62, HRX = 26, HRY = 26;
  var SHY = 100, SHOULDER = 107, SHX = 34, HIP = 152;
  var L1 = 32, L2 = 28;

  /* 夏威夷衬衫上的小花朵（珊瑚红/黄 六瓣 + 中心点） */
  function flower(p, x, y, petal, center) {
    for (var i = 0; i < 6; i++) {
      var a = i * 1.0472 + 0.26;
      p.circle(x + Math.cos(a) * 2.8, y + Math.sin(a) * 2.8, 2.2, petal);
    }
    p.circle(x, y, 2.0, center);
  }

  /* 墨镜：一条宽深色镜片杆 + 鼻梁 + 镜腿 + 高光斜纹 */
  function drawGlasses(p, hx, gy) {
    var lx = hx - 11.5, rx = hx + 11.5;
    p.line([[lx - 6, gy + 1], [hx - 25, gy + 3]], C.lens, 1.8, false);
    p.line([[rx + 6, gy + 1], [hx + 25, gy + 3]], C.lens, 1.8, false);
    p.rrect(lx - 6, gy - 4, 12, 8, 2.6, C.lens);
    p.rrect(rx - 6, gy - 4, 12, 8, 2.6, C.lens);
    p.line([[lx - 0.5, gy - 1], [rx + 0.5, gy - 1]], C.lens, 2.2, false);
    p.line([[lx - 4, gy - 2.5], [lx + 2.5, gy + 1.5]], C.glint, 2.0, false);
    p.line([[rx - 2.5, gy + 1.5], [rx + 4, gy - 2.5]], C.glint, 2.0, false);
  }

  /* DJ 耳机耳罩 */
  function earCup(p, x, y) {
    p.circle(x, y, 4.8, C.cup);
    p.circle(x, y, 2.6, C.cupHi);
  }

  function draw(pen, s) {
    var bob = s.bob || 0;
    var hip = HIP + bob, shy = SHY + bob, shoulder = SHOULDER + bob;
    var glasses = s.glasses || 'on';
    var messy = s.messy;

    /* ================= 腿 ================= */
    var st = s.stance || 0;
    RIG.leg(pen, CX - 15 - st, hip + 2, -2 + (s.legL || 0), 2, 38, 30, 24, 16, C.pants, C.pantsLo, C.shoe, -1);
    RIG.leg(pen, CX + 15 + st, hip + 2, 2 + (s.legR || 0), -2, 38, 30, 24, 16, C.pants, C.pantsLo, C.shoe, 1);
    pen.taper([[CX - 13, hip], [CX, hip + 12], [CX + 13, hip]], 6, 6, C.pantsLo);

    /* ================= 上身（可倾斜） ================= */
    pen.save();
    if (s.lean) { pen.translate(CX, hip); pen.rotate(s.lean * D); pen.translate(-CX, -hip); }

    /* 宽大圆肚西装（开襟） */
    var jacket = [
      [CX - 30, shy], [CX - 37, shy + 12], [CX - 35, shy + 34],
      [CX - 31, hip + 8], [CX - 13, hip + 13], [CX, hip + 14], [CX + 13, hip + 13],
      [CX + 31, hip + 8], [CX + 35, shy + 34], [CX + 37, shy + 12], [CX + 30, shy],
      [CX + 16, shy - 7], [CX, shy - 9], [CX - 16, shy - 7]
    ];
    pen.blob(jacket, C.blazer, .92);
    pen.clipBlob(jacket, function (p) {
      // 右侧暗面（窄带）
      p.blob([[CX + 22, shy - 10], [CX + 42, shy - 2], [CX + 42, hip + 18], [CX + 24, hip + 18]], C.blazerLo, 1);
      // 左肩亮面
      p.blob([[CX - 31, shy - 2], [CX - 19, shy], [CX - 21, shy + 28], [CX - 32, shy + 24]], C.blazerHi, 1);
      // 圆肚下方暗面
      p.blob([[CX - 22, hip + 4], [CX + 22, hip + 4], [CX + 20, hip + 18], [CX - 20, hip + 18]], C.blazerLo, 1);
    }, .92);

    /* 衬衫 V 区（亮蓝绿 + 花朵，一直开到下摆） */
    var vee = [[CX - 15, shy - 6], [CX, shy - 2], [CX + 15, shy - 6],
      [CX + 13, shy + 24], [CX + 9, shy + 40], [CX, shy + 56], [CX - 9, shy + 40], [CX - 13, shy + 24]];
    pen.blob(vee, C.shirt, .85);
    pen.clipBlob(vee, function (p) {
      p.blob([[CX + 3, shy - 10], [CX + 18, shy - 6], [CX + 18, shy + 60], [CX + 4, shy + 60]], C.shirtLo, .6);
      flower(p, CX - 7, shy + 7, C.coral, C.yellow);
      flower(p, CX + 8, shy + 7, C.yellow, C.coral);
      flower(p, CX - 7, shy + 20, C.coral, C.yellow);
      flower(p, CX + 7, shy + 26, C.yellow, C.coral);
      flower(p, CX - 5, shy + 34, C.coral, C.yellow);
      flower(p, CX + 5, shy + 42, C.yellow, C.coral);
      flower(p, CX - 2, shy + 49, C.coral, C.yellow);
    }, .85);

    /* 翻领 */
    pen.poly([[CX - 15, shy - 7], [CX - 3, shy], [CX - 12, shy + 26], [CX - 26, shy + 8]], C.blazerHi);
    pen.poly([[CX + 15, shy - 7], [CX + 3, shy], [CX + 12, shy + 26], [CX + 26, shy + 8]], C.blazerLo);
    RIG.ink(pen, [[CX - 15, shy - 7], [CX - 3, shy], [CX - 12, shy + 26]], 1.2, C.blazerEdge);
    RIG.ink(pen, [[CX + 15, shy - 7], [CX + 3, shy], [CX + 12, shy + 26]], 1.2, C.blazerEdge);

    pen.restore();

    /* ================= 脖子 ================= */
    var hx = CX + (s.headX || 0), hy = HY + bob + (s.headY || 0);
    pen.taper([[CX, shy - 2], [hx, hy + 24]], 22, 18, SK.lo);
    pen.taper([[CX - 0.5, shy - 2], [hx - 1, hy + 24]], 16, 13, SK.base);

    /* ================= 头 ================= */
    pen.save();
    if (s.headTilt) { pen.translate(hx, hy + 24); pen.rotate(s.headTilt * D); pen.translate(-hx, -(hy + 24)); }

    /* 后脑/顶/两侧发块（画在脸之前） */
    pen.blob([
      [hx - 27, hy - 9], [hx - 26, hy - 28], [hx - 12, hy - 32], [hx - 4, hy - 31],
      [hx, hy - 32], [hx + 4, hy - 31], [hx + 12, hy - 32], [hx + 26, hy - 28], [hx + 27, hy - 9],
      [hx + 23, hy + 14], [hx + 9, hy + 18], [hx - 9, hy + 18], [hx - 23, hy + 14]
    ], C.hair, .95);

    /* 脸 */
    RIG.head(pen, hx, hy, HRX, HRY, SK, { jaw: .9, chin: 1.0 });

    /* 前额后梳发 + M 形寡妇尖（画在脸之上） */
    var fringe = [
      [hx - 26, hy - 26], [hx - 21, hy - 31], [hx - 10, hy - 32], [hx - 4, hy - 31],
      [hx, hy - 32], [hx + 4, hy - 31], [hx + 10, hy - 32], [hx + 21, hy - 31], [hx + 26, hy - 26],
      [hx + 22, hy - 19], [hx + 14, hy - 16], [hx + 7, hy - 18], [hx, hy - 15], [hx - 7, hy - 18], [hx - 14, hy - 16], [hx - 22, hy - 19]
    ];
    pen.blob(fringe, C.hair, .9);
    pen.clipBlob(fringe, function (p) {
      p.line([[hx - 12, hy - 22], [hx - 10, hy - 30]], C.hairHi2, 1.1);
      p.line([[hx - 3, hy - 21], [hx - 2, hy - 30]], C.hairHi2, 1.1);
      p.line([[hx + 6, hy - 22], [hx + 7, hy - 30]], C.hairHi2, 1.1);
    }, .9);
    pen.sheen(fringe, C.hairHi, hx - 15, hy - 29, hx + 15, hy - 28, 3.2);
    pen.sheen(fringe, C.hairHi2, hx - 9, hy - 26, hx + 9, hy - 25, 1.5);

    /* 崩溃：头发凌乱翘起（随帧摆动） */
    if (messy) {
      var mf = (s.messyF || 0) % 4;
      var k = mf % 2 ? 1 : -1;
      pen.spike(hx - 8 + k * 2, hy - 26, 16 + (mf % 2 ? 2 : 0), (-100 + k * 8) * D, 3.2, C.hair, 4 + k * 2);
      pen.spike(hx + 2 - k * 2, hy - 28, 18 + (mf % 2 ? 0 : 2), (-80 - k * 6) * D, 3.4, C.hair, -5 - k * 2);
      pen.spike(hx + 12 + k, hy - 24, 14 + (mf % 2 ? 1 : 0), (-60 + k * 5) * D, 3.0, C.hair, 3 + k);
      pen.spike(hx - 18 - k, hy - 22, 12 + (mf % 2 ? 0 : 1), (-120 - k * 6) * D, 2.6, C.hair, -3 - k);
    }

    /* 鬓角 */
    pen.poly([[hx - 25, hy - 4], [hx - 21, hy - 2], [hx - 22, hy + 11], [hx - 26, hy + 6]], C.hair);
    pen.poly([[hx + 25, hy - 4], [hx + 21, hy - 2], [hx + 22, hy + 11], [hx + 26, hy + 6]], C.hair);

    /* 耳 */
    pen.ellipse(hx - 24, hy + 5, 3.4, 5.2, SK.base);
    pen.ellipse(hx + 24, hy + 5, 3.4, 5.2, SK.lo);

    /* 五官 */
    var eyeY = hy + 2;
    RIG.brow(pen, hx, eyeY - 10, 22, 4.4, s.brow, C.hair);

    var showEyes = glasses !== 'on';
    if (showEyes) {
      var eyeSize = s.eyes === 'wide' ? 5.4 : 4.6;
      RIG.eyes(pen, hx, eyeY, 22, eyeSize, s.eyes, { pupil: s.pupil, iris: '#2b3142', turn: s.headTurn });
    }

    /* 宽鼻 */
    pen.blob([[hx - 4, eyeY + 4], [hx + 4, eyeY + 4], [hx + 3, eyeY + 10], [hx - 3, eyeY + 10]], SK.lo, .9);
    pen.line([[hx - 2.5, eyeY + 9], [hx - 1, eyeY + 10.5]], SK.line, 1.2, true);
    pen.line([[hx + 2.5, eyeY + 9], [hx + 1, eyeY + 10.5]], SK.line, 1.2, true);

    /* 小胡子（加粗，避免细线被吸成棕） */
    pen.blob([[hx - 7, hy + 11], [hx, hy + 12], [hx + 7, hy + 11],
      [hx + 6, hy + 14.5], [hx, hy + 15], [hx - 6, hy + 14.5]], C.hair, .9);

    /* 嘴 */
    RIG.mouth(pen, hx + (s.headTurn || 0) * 2, hy + 17, 12, s.mouth, SK.line, '#93414a');

    /* 墨镜（on 遮眼 / slip 滑到鼻梁下） */
    if (glasses === 'on') drawGlasses(pen, hx, eyeY);
    else if (glasses === 'slip') drawGlasses(pen, hx, eyeY + 8);

    pen.restore();

    /* ================= 手臂 ================= */
    function arm(sx, sy, off, dark, kind, ang, bend) {
      var col = dark ? C.blazerLo : C.blazer;
      var hi = dark ? null : C.blazerHi;
      var h = RIG.armTo(pen, sx, sy, sx + off[0], sy + off[1], L1, L2, 22, 18, 13, col, hi, bend, C.sleeveEdge);
      var dir = Math.atan2(h[1] - h[3], h[0] - h[2]);
      pen.circle(h[0], h[1], 7.8, C.sleeveEdge);
      pen.circle(h[0], h[1], 6.8, col);
      pen.circle(h[0] + Math.cos(dir) * 1.6, h[1] + Math.sin(dir) * 1.6, 5.4, SK.base);
      var hx2 = h[0] + Math.cos(dir) * 6.8, hy2 = h[1] + Math.sin(dir) * 6.8;
      RIG.hand(pen, hx2, hy2, 6.4, SK.base, SK.lo, kind, ang == null ? dir : ang);
      return [hx2, hy2];
    }
    var handR = arm(CX + SHX, shoulder, s.hR, true, s.kindR, s.angR, 1);
    var handL = arm(CX - SHX, shoulder, s.hL, false, s.kindL, s.angL, -1);

    /* ================= 粗金链 ================= */
    pen.line([[CX - 15, shy], [CX, shy + 3], [CX + 15, shy]], C.gold, 3.4, true);
    for (var i = -2; i <= 2; i++) pen.circle(CX + i * 6, shy + 2 - Math.abs(i) * 0.7, 1.2, C.goldHi);

    /* ================= DJ 耳机挂脖 ================= */
    var bandY = shy + 12;
    pen.taper([[CX - 16, bandY], [CX, bandY + 1], [CX + 16, bandY]], 6, 7, C.cup);
    earCup(pen, CX - 19, bandY + 4);
    earCup(pen, CX + 19, bandY + 4);

    /* ================= 墨镜拿在手里（shock） ================= */
    if (glasses === 'off' && s.glassesHand) {
      var gx = s.glassesHand === 'R' ? handR[0] : handL[0];
      var gy = s.glassesHand === 'R' ? handR[1] : handL[1];
      pen.line([[gx - 7, gy], [gx + 7, gy]], C.lens, 2.0, false);
      pen.circle(gx - 4, gy - 1, 2.6, C.lens);
      pen.circle(gx + 4, gy - 1, 2.6, C.lens);
      pen.line([[gx - 5, gy - 3], [gx - 3, gy - 2]], C.glint, 1.0, false);
    }

    /* ================= 汗 / 符号 ================= */
    if (s.sweat) RIG.sweat(pen, hx + 27, hy - 12 + (s.sweatY || 0), 4.6, s.sweat, 0);
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
        glasses: 'on',
        mouth: tm(talk, f)
      });
    },
    smug: function (f, talk) {
      return RIG.base({
        bob: f % 2 ? 0 : -1, lean: 1.5, headTilt: -3, headY: -1,
        glasses: 'on',
        hL: [-10, 58], hR: [-18, 0], kindR: 'open',
        brow: 'up',
        mouth: talk ? (f % 2 ? 'open' : 'grin') : 'grin'
      });
    },
    laugh: function (f, talk) {
      return RIG.base({
        bob: f % 2 ? 1 : -1, lean: -2, headTilt: -6, headY: -2,
        glasses: 'on',
        hL: [-6, 58], hR: [-30, 34], kindR: 'open',
        brow: 'up',
        mouth: 'wide'
      });
    },
    sweat: function (f, talk) {
      return RIG.base({
        bob: f % 2 ? 0 : -1, lean: -2, headTilt: -2,
        glasses: 'on',
        hL: [-10, 56], hR: [10, 50],
        mouth: talk ? (f % 2 ? 'open' : 'flat') : 'flat',
        sweat: 2, sweatY: f % 2 ? 0 : 2
      });
    },
    panic: function (f, talk) {
      return RIG.base({
        bob: f % 2 ? 1 : 0, lean: -3, headTilt: -2, headY: 1,
        glasses: 'slip',
        hL: [-22, 10], hR: [22, 12], kindL: 'open', kindR: 'open',
        eyes: 'wide', brow: 'sad', pupil: [0, -0.3],
        mouth: talk ? (f % 2 ? 'open' : 'o') : 'o',
        sweat: 3, sweatY: f % 2 ? 0 : 3
      });
    },
    shock: function (f, talk) {
      return RIG.base({
        bob: f % 2 ? -1 : 0, lean: -2,
        glasses: 'off', glassesHand: 'R',
        hL: [-8, 58], hR: [24, -24], kindR: 'open',
        eyes: 'wide', brow: 'up', pupil: [0, -0.4],
        mouth: 'o',
        symbol: 'shock', headY: -1, stance: 2
      });
    },
    angry: function (f, talk) {
      return RIG.base({
        bob: f % 2 ? 1 : 0, lean: 2,
        glasses: 'on',
        hL: [-16, 40], hR: [16, 40], kindL: 'fist', kindR: 'fist',
        brow: 'angry',
        mouth: talk ? (f % 2 ? 'shout' : 'frown') : 'frown',
        symbol: 'anger', symbolCol: '#ff6a6a'
      });
    },
    breakdown: function (f, talk) {
      var lean = [6, -5, -6, 5][f % 4];
      var tilt = [4, -3, -4, 3][f % 4];
      var eye = ['shut', 'wide', 'shut', 'wide'][f % 4];
      return RIG.base({
        bob: [-1, 1, 0, -1][f % 4],
        lean: lean, headTilt: tilt, headY: [-2, 2, 0, -1][f % 4],
        glasses: 'off', messy: true, messyF: f,
        hL: [7 + (f % 2 ? -2 : 2), -42 - (f % 2 ? 0 : 1)],
        hR: [-7 + (f % 2 ? 2 : -2), -42 - (f % 2 ? 1 : 0)],
        kindL: 'open', kindR: 'open',
        eyes: eye, brow: 'sad',
        mouth: f % 2 ? 'shout' : 'wide',
        sweat: 3, sweatY: [0, 4, 2, 3][f % 4],
        stance: [2, -2, 1, -1][f % 4]
      });
    },
    think: function (f, talk) {
      return RIG.base({
        bob: f % 2 ? 0 : -1, lean: -1,
        glasses: 'on',
        hL: [-6, 58], hR: [-24, -16], kindR: 'fist',
        brow: 'down',
        mouth: talk ? (f % 2 ? 'open' : 'flat') : 'flat',
        headTilt: -3, headY: 1
      });
    },
    sad: function (f, talk) {
      return RIG.base({
        bob: f % 2 ? 0 : -1, lean: -3,
        glasses: 'on',
        hL: [-4, 58], hR: [4, 58],
        brow: 'sad',
        mouth: talk ? (f % 2 ? 'open' : 'frown') : 'frown',
        headTilt: 3, headY: 3
      });
    }
  };

  RIG.define('kuroiwa', {
    label: '黑岩', full: '黑岩 龙三', gender: 'm',
    outline: '#241a16',
    draw: draw,
    poses: poses,
    frames: { normal: 4, smug: 4, laugh: 4, breakdown: 4, panic: 2, shock: 2 }
  });

})(window.AA);
