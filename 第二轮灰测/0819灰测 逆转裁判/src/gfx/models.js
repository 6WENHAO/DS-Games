/* ============================================================
   models.js — 低多面数场景模型（1 单位 ≈ 1cm）
   坐标：X 右、Y 上、Z 朝观众（法官席在 -Z 深处）
   ============================================================ */
(function (AA) {
  'use strict';
  var U = AA.U, P = AA.PAL, P3 = AA.P3;
  var MD = AA.MODELS = {};

  var CHAR_H = 200;   // 角色在世界中的标称身高
  MD.CHAR_H = CHAR_H;

  /* ================= 通用零件 ================= */

  // 木质台面（带金色饰条与面板分格）
  function benchDetails(n, base, dark) {
    var d = [];
    for (var i = 0; i < n; i++) {
      var u = i / n, w = 1 / n;
      d.push({ u: u + 0.012, v: 0.14, w: w - 0.024, h: 0.70, c: i % 2 ? base : dark });
      d.push({ u: u + 0.012, v: 0.14, w: w - 0.024, h: 0.055, c: U.hilite(base, .25) });
    }
    return d;
  }

  // 观众席剪影小人
  function galleryPerson(m, x, y, z, seed, col) {
    var r = U.rng(seed | 0);
    var hw = 15 + r() * 5, hh = 42 + r() * 10;
    var c = col || '#232a44';
    m.box(x - hw, y, z - 9, hw * 2, hh, 18, { c: c, top: U.shadow(c, .1), side: U.shadow(c, .25), side2: U.shadow(c, .45), front: c });
    m.prism(x, z, 11 + r() * 2, y + hh, y + hh + 24, 6, { c: U.hilite(c, .06), top: U.hilite(c, .12), rot: r() * 2 });
    // 肩
    m.box(x - hw - 4, y + hh - 12, z - 8, 8, 12, 16, { c: U.shadow(c, .2) });
    m.box(x + hw - 4, y + hh - 12, z - 8, 8, 12, 16, { c: U.shadow(c, .2) });
  }

  // 灯（自发光面）
  function lamp(m, x, y, z, w, h, col) {
    m.box(x - w / 2, y, z, w, h, 6, { c: '#3a3f52', top: '#4a5066' });
    m.wall(x - w / 2 + 1, y + 1, z - 0.6, w - 2, h - 2, { c: col || '#ffeec2', unlit: true });
  }

  /* ================= 法庭 ================= */
  MD.courtroom = function () {
    var m = P3.Mesh();
    var C = P.court;
    var X0 = -700, X1 = 700, Z0 = -1320, Z1 = 420, CY = 470;

    /* ---- 地板：大理石棋盘 ---- */
    var gx = 10, gz = 12, cw = (X1 - X0) / gx, cd = (Z1 - Z0) / gz;
    for (var i = 0; i < gx; i++) for (var j = 0; j < gz; j++) {
      var alt = (i + j) & 1;
      m.plane(X0 + i * cw, 0, Z0 + j * cd, cw, cd, {
        c: alt ? C.marble : C.marbleLo,
        bias: 8
      });
    }
    /* ---- 中央红毯 ---- */
    m.plane(-170, 1.2, -1060, 340, 1480, { c: C.carpet, bias: 4, grad: [C.carpetDark, C.carpet] });
    m.plane(-170, 1.6, -1060, 22, 1480, { c: C.trim, bias: 2 });
    m.plane(148, 1.6, -1060, 22, 1480, { c: C.trim, bias: 2 });

    /* ---- 后墙 ---- */
    var panels = 12, pw = (X1 - X0) / panels;
    for (var p = 0; p < panels; p++) {
      var px = X0 + p * pw;
      m.wall(px, 0, Z0, pw, 300, {
        c: p % 2 ? C.wall : U.shadow(C.wall, .12),
        det: [
          { u: .10, v: .10, w: .80, h: .80, c: p % 2 ? U.shadow(C.wood, .1) : C.wood },
          { u: .14, v: .14, w: .72, h: .72, c: p % 2 ? C.woodHi : U.hilite(C.wood, .06) }
        ]
      });
      m.wall(px, 300, Z0, pw, 170, { c: p % 2 ? U.shadow(C.wall, .18) : U.shadow(C.wall, .28) });
    }
    // 檐口
    m.box(X0, 296, Z0, X1 - X0, 14, 16, { c: C.trim, top: U.hilite(C.trim, .3) });
    m.box(X0, 452, Z0, X1 - X0, 18, 20, { c: U.shadow(C.wall, .3), top: C.wall });

    /* ---- 侧墙 ---- */
    for (var s = 0; s < 2; s++) {
      var wx = s ? X1 : X0;
      var sgn = s ? -1 : 1;
      for (var q = 0; q < 9; q++) {
        var z = Z0 + q * ((Z1 - Z0) / 9), dz = (Z1 - Z0) / 9;
        var b = m.v.length;
        m.pt(wx, 0, z); m.pt(wx, 300, z); m.pt(wx, 300, z + dz); m.pt(wx, 0, z + dz);
        if (sgn > 0) m.quad(b, b + 1, b + 2, b + 3, { c: q % 2 ? C.wall : U.shadow(C.wall, .1), det: [{ u: .1, v: .12, w: .8, h: .76, c: C.wood }, { u: .16, v: .17, w: .68, h: .66, c: C.woodHi }] });
        else m.quad(b + 3, b + 2, b + 1, b, { c: q % 2 ? C.wall : U.shadow(C.wall, .1), det: [{ u: .1, v: .12, w: .8, h: .76, c: C.wood }, { u: .16, v: .17, w: .68, h: .66, c: C.woodHi }] });
        // 上部
        var b2 = m.v.length;
        m.pt(wx, 300, z); m.pt(wx, CY, z); m.pt(wx, CY, z + dz); m.pt(wx, 300, z + dz);
        if (sgn > 0) m.quad(b2, b2 + 1, b2 + 2, b2 + 3, { c: U.shadow(C.wall, .26) });
        else m.quad(b2 + 3, b2 + 2, b2 + 1, b2, { c: U.shadow(C.wall, .26) });
      }
      // 壁灯
      for (var L = 0; L < 3; L++) lamp(m, wx - sgn * 10, 320, -900 + L * 420, 40, 62, '#ffe9b0');
      // 柱子
      for (var pc = 0; pc < 3; pc++) {
        m.prism(wx - sgn * 34, -1000 + pc * 500, 40, 0, 470, 8, {
          c: C.marble, top: C.marbleLo, rot: .4, grad: [U.shadow(C.marble, .35), C.marble]
        });
      }
    }

    /* ---- 天花板 ---- */
    for (var ci = 0; ci < 6; ci++) for (var cj = 0; cj < 7; cj++) {
      var cx2 = X0 + ci * ((X1 - X0) / 6), cz2 = Z0 + cj * ((Z1 - Z0) / 7);
      var cw2 = (X1 - X0) / 6, cd2 = (Z1 - Z0) / 7;
      var b3 = m.v.length;
      m.pt(cx2, CY, cz2); m.pt(cx2 + cw2, CY, cz2); m.pt(cx2 + cw2, CY, cz2 + cd2); m.pt(cx2, CY, cz2 + cd2);
      m.quad(b3, b3 + 1, b3 + 2, b3 + 3, {   // 法线 -Y（朝下）
        c: (ci + cj) & 1 ? U.shadow(C.wall, .34) : U.shadow(C.wall, .42),
        det: [{ u: .12, v: .12, w: .76, h: .76, c: U.shadow(C.wall, .5) }]
      });
    }
    // 吊灯板
    for (var lz = 0; lz < 3; lz++) {
      var lzz = -960 + lz * 460;
      var b4 = m.v.length;
      m.pt(-150, CY - 12, lzz - 60); m.pt(150, CY - 12, lzz - 60); m.pt(150, CY - 12, lzz + 60); m.pt(-150, CY - 12, lzz + 60);
      m.quad(b4, b4 + 1, b4 + 2, b4 + 3, { c: '#fff4d2', unlit: true });
      m.box(-158, CY - 16, lzz - 68, 316, 8, 136, { c: C.trim, noTop: true, noBottom: true });
    }

    /* ---- 法官席 ---- */
    // 台基
    m.box(-460, 0, -1300, 920, 104, 250, {
      c: C.bench, top: U.shadow(C.woodTop, .1), side: C.wood, side2: U.shadow(C.wood, .3),
      front: C.wood, occl: true,
      detFront: benchDetails(8, C.wood, U.shadow(C.wood, .22))
    });
    // 主桌
    m.box(-410, 104, -1210, 820, 112, 120, {
      c: C.wood, top: C.woodTop, side: C.woodLo, side2: U.shadow(C.wood, .35),
      front: C.woodHi, occl: true,
      detFront: [
        { u: .0, v: .0, w: 1, h: .12, c: C.trim },
        { u: .04, v: .16, w: .26, h: .70, c: U.shadow(C.wood, .18) },
        { u: .06, v: .19, w: .22, h: .64, c: C.wood },
        { u: .37, v: .16, w: .26, h: .70, c: U.shadow(C.wood, .18) },
        { u: .39, v: .19, w: .22, h: .64, c: C.wood },
        { u: .70, v: .16, w: .26, h: .70, c: U.shadow(C.wood, .18) },
        { u: .72, v: .19, w: .22, h: .64, c: C.wood },
        { u: .0, v: .90, w: 1, h: .10, c: U.shadow(C.wood, .45) }
      ]
    });
    // 桌上：木槌座、文件
    m.box(150, 216, -1180, 90, 10, 46, { c: '#6b4a2a', top: '#7d5832', occl: true });
    m.box(-250, 216, -1180, 120, 5, 60, { c: '#e8e2cc', top: '#f4efe0', occl: true });
    // 法官背后高背板
    m.box(-330, 104, -1290, 660, 300, 26, {
      c: U.shadow(C.wood, .16), top: C.trim, front: C.wood,
      detFront: [
        { u: .05, v: .04, w: .90, h: .92, c: U.shadow(C.wood, .3) },
        { u: .08, v: .07, w: .84, h: .86, c: C.wood }
      ]
    });
    // 法院徽章（金色圆盘）
    m.prism(0, -1274, 96, 300, 312, 16, { c: C.gold, top: U.hilite(C.gold, .3), rot: .2 });
    m.prism(0, -1272, 74, 312, 318, 16, { c: U.hilite(C.gold, .18), top: '#f4e3a8', rot: .2 });
    // 徽章中央：天秤的抽象造型
    m.wall(-6, 318, -1268, 12, 74, { c: '#f6ecc0', unlit: true });
    m.wall(-52, 372, -1268, 104, 9, { c: '#f6ecc0', unlit: true });
    m.wall(-56, 344, -1268, 26, 7, { c: '#e2cf92', unlit: true });
    m.wall(30, 344, -1268, 26, 7, { c: '#e2cf92', unlit: true });
    m.wall(-14, 392, -1268, 28, 26, { c: '#f6ecc0', unlit: true });
    // 两侧幕布
    for (var cs = 0; cs < 2; cs++) {
      var mx = cs ? 340 : -560;
      for (var f = 0; f < 5; f++) {
        m.wall(mx + f * 44, 104, -1286 + (f % 2) * 6, 44, 366, {
          c: f % 2 ? C.curtain : C.curtainLo,
          grad: [C.curtainLo, C.curtain]
        });
      }
    }

    /* ---- 证人席 ---- */
    m.box(-118, 0, -800, 236, 100, 130, {
      c: C.wood, top: C.woodTop, side: C.woodLo, side2: U.shadow(C.wood, .32), front: C.woodHi,
      occl: true,
      detFront: [
        { u: .0, v: .0, w: 1, h: .1, c: C.trim },
        { u: .08, v: .16, w: .36, h: .70, c: U.shadow(C.wood, .2) },
        { u: .11, v: .20, w: .30, h: .62, c: C.wood },
        { u: .56, v: .16, w: .36, h: .70, c: U.shadow(C.wood, .2) },
        { u: .59, v: .20, w: .30, h: .62, c: C.wood }
      ]
    });
    // 麦克风（偏置到证人席左侧，避免挡住证人的脸）
    m.prism(-74, -742, 7, 100, 110, 6, { c: '#3a3f4c', occl: true });
    m.prism(-74, -742, 2.6, 110, 138, 6, { c: '#54596a', occl: true });
    m.prism(-74, -742, 9, 138, 150, 8, { c: '#2c303c', top: '#4a4f5e', occl: true });

    /* ---- 辩护席 / 检察席 ---- */
    function bench(sign) {
      var xIn = sign * 470;                 // 面向中央的一侧
      var xOut = sign * 600;
      var x0 = Math.min(xIn, xOut), w = Math.abs(xOut - xIn);
      m.box(x0, 0, -330, w, 100, 430, {
        c: C.wood, top: C.woodTop, side: sign > 0 ? C.woodHi : C.woodLo,
        side2: sign > 0 ? C.woodLo : C.woodHi,
        front: U.shadow(C.wood, .2), occl: true
      });
      // 面向中央的装饰面板
      var b = m.v.length;
      var fx = xIn - sign * 1.5;
      m.pt(fx, 0, -330); m.pt(fx, 100, -330); m.pt(fx, 100, 100); m.pt(fx, 0, 100);
      var det = [
        { u: .0, v: .0, w: 1, h: .10, c: C.trim },
        { u: .04, v: .16, w: .28, h: .70, c: U.shadow(C.wood, .22) },
        { u: .06, v: .20, w: .24, h: .62, c: C.woodHi },
        { u: .36, v: .16, w: .28, h: .70, c: U.shadow(C.wood, .22) },
        { u: .38, v: .20, w: .24, h: .62, c: C.woodHi },
        { u: .68, v: .16, w: .28, h: .70, c: U.shadow(C.wood, .22) },
        { u: .70, v: .20, w: .24, h: .62, c: C.woodHi }
      ];
      if (sign > 0) m.quad(b, b + 1, b + 2, b + 3, { c: C.wood, det: det, occl: true });
      else m.quad(b + 3, b + 2, b + 1, b, { c: C.wood, det: det, occl: true });
      // 桌上：文件与铭牌
      m.box(x0 + 25, 100, -300, 80, 4, 56, { c: '#e6dfc6', top: '#f2ecd8', occl: true });
      m.box(x0 + 30, 100, -250, 52, 16, 10, { c: C.trim, top: U.hilite(C.trim, .3), front: '#f0e0aa', occl: true });
    }
    bench(-1); bench(1);

    /* ---- 旁听席 ---- */
    for (var tier = 0; tier < 3; tier++) {
      var ty = 30 + tier * 34, tz = 150 + tier * 90;
      m.box(-660, 0, tz, 1320, ty, 92, { c: '#4a4034', top: '#5c5040', side: '#3e3529' });
      m.box(-640, ty, tz + 8, 1280, 40, 26, { c: C.bench, top: U.hilite(C.bench, .18) });
      for (var g = 0; g < 9; g++) {
        galleryPerson(m, -560 + g * 140, ty + 40, tz + 46, 1000 + tier * 31 + g * 7,
          ['#242c48', '#2c2438', '#1e2a3a', '#332a30', '#26303c'][(g + tier) % 5]);
      }
    }
    // 旁听席前的栏杆
    m.box(-660, 0, 120, 1320, 96, 12, { c: C.wood, top: C.trim, front: C.woodLo });
    for (var rr = 0; rr < 14; rr++) m.prism(-620 + rr * 96, 126, 7, 96, 128, 6, { c: C.trim });
    m.box(-660, 126, 114, 1320, 12, 24, { c: C.trim, top: U.hilite(C.trim, .3) });

    /* ---- 相机预设 ----
       构图基准：角色身高 200 世界单位；精灵画布高 216、脚底基线 y=210。
       slots: [屏幕 x（精灵中心）, 屏幕 y（脚底）, 缩放]
       fgZ:   视深小于该值的面 → 前景层（画在角色之上，用于台面遮挡下半身） */
    var cams = {
      defense: {
        eye: [-361, 120, -100], target: [-644, 114, -100], fov: 38, fgZ: 300,
        slots: { defense: [128, 214, 1] }
      },
      defenseBoth: {
        eye: [-361, 120, -150], target: [-644, 114, -150], fov: 38, fgZ: 300,
        slots: { defense: [82, 214, 1], assistant: [190, 210, .93] }
      },
      prosecution: {
        eye: [361, 120, -100], target: [644, 114, -100], fov: 38, fgZ: 300,
        slots: { prosecutor: [128, 214, 1] }
      },
      witness: {
        eye: [0, 122, -584], target: [0, 116, -876], fov: 38, fgZ: 300,
        slots: { witness: [128, 213, 1] }
      },
      judge: {
        eye: [0, 236, -964], target: [0, 230, -1246], fov: 38, fgZ: 300,
        slots: { judge: [128, 226, 1] }
      },
      wide: {
        eye: [0, 300, 300], target: [0, 120, -780], fov: 58,
        slots: {
          defense: [28, 172, .44], assistant: [76, 167, .40], prosecutor: [224, 172, .44],
          judge: [128, 116, .32]
        }
      },
      gallery: { eye: [0, 210, -420], target: [0, 175, 300], fov: 50, slots: {} },
      codefense: {
        eye: [-330, 158, 210], target: [-585, 122, -95], fov: 44, fgZ: 200,
        slots: { defense: [92, 224, .88], assistant: [180, 214, .8] }
      },
      overhead: { eye: [-40, 420, -300], target: [0, 60, -760], fov: 55, slots: {} }
    };

    /* ---- 效果锚点（3D 位置，用于冲击波/尘埃等） ---- */
    var anchors = {
      naruhodo: [-644, 0, -100],
      mayoi: [-664, 0, -190],
      mitsurugi: [644, 0, -100],
      judge: [0, 104, -1246],
      witness: [0, 0, -876],
      itonokogiri: [0, 0, -876]
    };

    return { mesh: m, cams: cams, anchors: anchors, name: 'court' };
  };

  /* ================= 深夜电台・录音室（案发现场） ================= */
  MD.studio = function () {
    var m = P3.Mesh();
    var S = P.studio;
    var X0 = -420, X1 = 420, Z0 = -520, Z1 = 240, CY = 270;

    // 地板
    for (var i = 0; i < 7; i++) for (var j = 0; j < 7; j++) {
      m.plane(X0 + i * 120, 0, Z0 + j * 108, 120, 108, {
        c: (i + j) & 1 ? S.floor : U.shadow(S.floor, .12), bias: 6
      });
    }
    // 后墙：吸音棉（楔形块阵列）
    for (var a = 0; a < 12; a++) for (var b = 0; b < 5; b++) {
      var fx = X0 + a * 70, fy = 20 + b * 46;
      m.wall(fx, fy, Z0, 70, 46, {
        c: (a + b) & 1 ? S.foam : U.shadow(S.foam, .16),
        det: [
          { pts: [[.5, .06], [.94, .5], [.5, .94], [.06, .5]], c: (a + b) & 1 ? U.hilite(S.foam, .1) : S.foam }
        ]
      });
    }
    m.wall(X0, 0, Z0, X1 - X0, 20, { c: U.shadow(S.wall, .4) });
    m.wall(X0, 250, Z0, X1 - X0, 20, { c: U.shadow(S.wall, .3) });

    // 侧墙
    for (var s = 0; s < 2; s++) {
      var wx = s ? X1 : X0, sgn = s ? -1 : 1;
      for (var q = 0; q < 6; q++) {
        var z = Z0 + q * ((Z1 - Z0) / 6), dz = (Z1 - Z0) / 6;
        var bb = m.v.length;
        m.pt(wx, 0, z); m.pt(wx, CY, z); m.pt(wx, CY, z + dz); m.pt(wx, 0, z + dz);
        var op = { c: q % 2 ? S.wall : S.wallLo, grad: [S.wallLo, S.wallHi] };
        if (sgn > 0) m.quad(bb, bb + 1, bb + 2, bb + 3, op);
        else m.quad(bb + 3, bb + 2, bb + 1, bb, op);
      }
    }
    // 天花板 + 灯
    for (var ci = 0; ci < 4; ci++) for (var cj = 0; cj < 4; cj++) {
      var b5 = m.v.length;
      var cx = X0 + ci * 210, cz = Z0 + cj * 190;
      m.pt(cx, CY, cz); m.pt(cx + 210, CY, cz); m.pt(cx + 210, CY, cz + 190); m.pt(cx, CY, cz + 190);
      m.quad(b5, b5 + 1, b5 + 2, b5 + 3, { c: (ci + cj) & 1 ? U.shadow(S.wall, .3) : U.shadow(S.wall, .42) });
    }
    var b6 = m.v.length;
    m.pt(-120, CY - 8, -230); m.pt(120, CY - 8, -230); m.pt(120, CY - 8, -110); m.pt(-120, CY - 8, -110);
    m.quad(b6, b6 + 1, b6 + 2, b6 + 3, { c: '#e8f6ff', unlit: true });

    // 玻璃窗（通往控制室）
    m.wall(120, 96, Z0 + 3, 260, 116, { c: S.glassBlue, grad: ['#2c4a68', '#6f9dc4'] });
    m.box(112, 88, Z0 - 2, 276, 10, 10, { c: S.metalLo, top: S.metal });
    m.box(112, 212, Z0 - 2, 276, 10, 10, { c: S.metalLo, top: S.metal });
    // 控制室里的剪影设备
    m.box(160, 96, Z0 - 40, 80, 30, 30, { c: '#20283a', top: '#2c364c' });
    m.box(270, 96, Z0 - 40, 60, 44, 30, { c: '#1c2334', top: '#28304a' });

    // ON AIR 灯箱
    m.box(-60, 224, Z0 + 4, 120, 40, 12, { c: '#2a2f3e', top: '#3a4052' });
    m.wall(-52, 232, Z0 + 3, 104, 24, { c: S.neonR, unlit: true });

    // 调音台
    m.box(-300, 0, -120, 300, 74, 130, { c: S.desk, top: S.deskHi, side: U.shadow(S.desk, .2) });
    var mixTop = m.v.length;
    m.pt(-300, 74, -120); m.pt(-300, 74, 10); m.pt(0, 74, 10); m.pt(0, 74, -120);
    m.quad(mixTop, mixTop + 1, mixTop + 2, mixTop + 3, {
      c: '#2a2f3e',
      det: (function () {
        var d = [{ u: .04, v: .1, w: .92, h: .5, c: '#22283a' }];
        for (var k = 0; k < 12; k++) {
          d.push({ u: .06 + k * .076, v: .16, w: .022, h: .38, c: '#4a5266' });
          d.push({ u: .055 + k * .076, v: .16 + (k % 4) * .07, w: .034, h: .05, c: k % 3 ? '#c8ccd8' : '#e0554a' });
          d.push({ u: .06 + k * .076, v: .62, w: .03, h: .03, c: k % 2 ? S.neonG : S.neonR });
        }
        for (var k2 = 0; k2 < 6; k2++) d.push({ u: .1 + k2 * .14, v: .74, w: .05, h: .1, c: '#3a4152' });
        return d;
      })()
    });
    // 显示器
    m.box(-250, 74, -110, 110, 8, 60, { c: '#2c3242' });
    m.box(-244, 82, -104, 98, 62, 8, { c: '#1a1f2c', top: '#262d3c' });
    m.wall(-238, 88, -106, 86, 50, { c: S.screenGlow, unlit: true, det: [
      { u: .06, v: .1, w: .88, h: .1, c: '#0a1a26' },
      { u: .06, v: .3, w: .5, h: .08, c: '#0a1a26' },
      { u: .06, v: .5, w: .7, h: .08, c: '#0a1a26' },
      { u: .06, v: .7, w: .3, h: .08, c: '#0a1a26' }
    ] });

    // 播音桌 + 麦克风吊臂
    m.box(-40, 0, -300, 260, 72, 150, { c: S.desk, top: S.deskHi });
    m.prism(60, -240, 6, 72, 96, 6, { c: S.metalLo, top: S.metal });
    m.box(30, 96, -244, 130, 7, 7, { c: S.metal });
    m.prism(150, -240, 4, 78, 96, 6, { c: S.metalLo });
    m.prism(150, -240, 13, 60, 80, 8, { c: '#23283a', top: '#333a4e' });
    // 耳机挂在桌上
    m.prism(-10, -260, 22, 72, 80, 8, { c: '#1e2432', top: '#2a3244' });

    // 磁带机
    m.box(180, 72, -290, 110, 46, 90, { c: '#39404f', top: '#4a5264' });
    m.wall(186, 80, -296, 98, 32, { c: '#1c2230', det: [
      { u: .1, v: .2, w: .3, h: .6, c: '#5a6274' }, { u: .6, v: .2, w: .3, h: .6, c: '#5a6274' },
      { u: .18, v: .34, w: .14, h: .3, c: '#101620' }, { u: .68, v: .34, w: .14, h: .3, c: '#101620' },
      { u: .44, v: .74, w: .12, h: .12, c: S.neonR }
    ] });

    // 倒下的椅子 + 人形标记
    m.box(-150, 0, 60, 90, 12, 90, { c: '#3a3040', top: '#4a3f52', bias: -3 });
    m.box(-150, 12, 130, 90, 78, 12, { c: '#332a3a', top: '#443848' });
    m.prism(-105, 105, 32, 0, 8, 5, { c: '#22283a', top: '#2c3446' });
    // 地面的人形轮廓（白色胶带）
    var tape = [];
    (function () {
      var pts = [[.44, .16], [.56, .16], [.6, .3], [.86, .42], [.84, .5], [.58, .44],
      [.6, .66], [.72, .9], [.64, .94], [.5, .72], [.36, .94], [.28, .9], [.4, .66],
      [.42, .44], [.16, .5], [.14, .42], [.4, .3]];
      tape.push({ pts: pts, c: '#e8e4d0', stroke: true, lw: 2, unlit: true });
    })();
    m.plane(-260, 2.5, 20, 300, 200, { c: S.floor, bias: 2, det: tape });

    // 散落的碎片（怀表）
    m.prism(-40, 120, 9, 3, 6, 6, { c: '#c9a44c', top: '#e2c477', bias: -2 });
    m.prism(-16, 138, 4, 3, 5, 5, { c: '#8f8f9a', top: '#b9b9c6', bias: -2 });

    var cams = {
      main: { eye: [40, 170, 300], target: [-40, 110, -260], fov: 48, slots: { talk: [128, 219, 1] } },
      desk: { eye: [80, 145, -20], target: [70, 100, -300], fov: 40, slots: { talk: [128, 219, 1] } },
      mixer: { eye: [-150, 148, 160], target: [-150, 86, -60], fov: 44, slots: { talk: [128, 219, 1] } },
      body: { eye: [-140, 205, 265], target: [-150, 18, 70], fov: 46, slots: { talk: [128, 219, 1] } },
      window: { eye: [170, 148, 70], target: [225, 138, -500], fov: 40, slots: { talk: [128, 219, 1] } },
      tape: { eye: [235, 138, -110], target: [235, 102, -300], fov: 40, slots: { talk: [128, 219, 1] } },
      foam: { eye: [-230, 150, -190], target: [-240, 130, -520], fov: 40, slots: { talk: [128, 219, 1] } },
      chair: { eye: [-90, 175, 240], target: [-110, 60, 100], fov: 44, slots: { talk: [128, 219, 1] } }
    };
    var anchors = {
      naruhodo: [-150, 0, 40],
      mayoi: [-40, 0, 70],
      itonokogiri: [120, 0, -20],
      witness: [60, 0, -60]
    };
    return { mesh: m, cams: cams, anchors: anchors, name: 'studio', talkCam: 'main' };
  };

  /* ================= 拘留所会面室 ================= */
  MD.detention = function () {
    var m = P3.Mesh();
    var J = P.jail;
    var X0 = -360, X1 = 360, Z0 = -300, Z1 = 220, CY = 250;

    for (var i = 0; i < 6; i++) for (var j = 0; j < 5; j++) {
      m.plane(X0 + i * 120, 0, Z0 + j * 104, 120, 104, { c: (i + j) & 1 ? J.floor : U.shadow(J.floor, .1), bias: 6 });
    }
    // 后墙（对面的墙，砖块感）
    for (var a = 0; a < 9; a++) for (var b = 0; b < 6; b++) {
      m.wall(X0 + a * 80, 6 + b * 42, Z0, 80, 42, {
        c: (a + b) & 1 ? J.wall : J.wallLo,
        det: [{ u: .04, v: .08, w: .92, h: .84, c: (a + b) & 1 ? J.wallHi : J.wall }]
      });
    }
    // 侧墙
    for (var s = 0; s < 2; s++) {
      var wx = s ? X1 : X0, sgn = s ? -1 : 1;
      var bb = m.v.length;
      m.pt(wx, 0, Z0); m.pt(wx, CY, Z0); m.pt(wx, CY, Z1); m.pt(wx, 0, Z1);
      var op = { c: J.wall, grad: [J.wallLo, J.wallHi] };
      if (sgn > 0) m.quad(bb, bb + 1, bb + 2, bb + 3, op); else m.quad(bb + 3, bb + 2, bb + 1, bb, op);
    }
    // 天花板 + 荧光灯
    var b7 = m.v.length;
    m.pt(X0, CY, Z0); m.pt(X1, CY, Z0); m.pt(X1, CY, Z1); m.pt(X0, CY, Z1);
    m.quad(b7, b7 + 1, b7 + 2, b7 + 3, { c: U.shadow(J.wall, .4) });
    var b8 = m.v.length;
    m.pt(-140, CY - 6, -110); m.pt(140, CY - 6, -110); m.pt(140, CY - 6, -60); m.pt(-140, CY - 6, -60);
    m.quad(b8, b8 + 1, b8 + 2, b8 + 3, { c: J.light, unlit: true });

    // 隔断台 + 玻璃 + 铁栏
    m.box(X0, 0, -60, X1 - X0, 92, 40, { c: '#585349', top: '#6b655a', front: '#4e493f', occl: true });
    m.wall(X0 + 10, 92, -46, X1 - X0 - 20, 120, { c: J.glass, grad: ['#5d7482', '#93a9b8'] });
    for (var r = 0; r < 15; r++) m.box(X0 + 39 + r * 46, 92, -52, 8, 158, 8, { c: J.bar, top: J.barHi, side: J.barHi, occl: true });
    m.box(X0, 210, -54, X1 - X0, 14, 30, { c: '#4a453c', top: '#5c564b', occl: true });
    // 桌前的凳子
    m.prism(-60, 90, 34, 0, 44, 8, { c: '#4a4238', top: '#5b5245' });
    m.prism(-60, 90, 8, 0, 44, 6, { c: '#3a3430' });

    var cams = {
      main: {
        eye: [-20, 128, 113], target: [-20, 120, -170], fov: 38, fgZ: 300,
        slots: { witness: [128, 220, 1] }
      },
      wide: { eye: [110, 195, 200], target: [-20, 100, -240], fov: 52, slots: { talk: [128, 224, .9] } }
    };
    var anchors = {
      naruhodo: [-120, 0, 96], mayoi: [30, 0, 110],
      kanon: [-20, 0, -170], witness: [-20, 0, -170]
    };
    return { mesh: m, cams: cams, anchors: anchors, name: 'detention', talkCam: 'main' };
  };

  /* ================= 法庭前厅 ================= */
  MD.lobby = function () {
    var m = P3.Mesh();
    var C = P.court, O = P.office;
    var X0 = -520, X1 = 520, Z0 = -420, Z1 = 260, CY = 340;

    for (var i = 0; i < 8; i++) for (var j = 0; j < 6; j++) {
      m.plane(X0 + i * 130, 0, Z0 + j * ((Z1 - Z0) / 6), 130, (Z1 - Z0) / 6, {
        c: (i + j) & 1 ? C.marble : C.marbleLo, bias: 6
      });
    }
    // 后墙：大窗
    m.wall(X0, 0, Z0, X1 - X0, 90, { c: O.wallLo });
    m.wall(X0, 90, Z0, 180, 200, { c: O.wall });
    m.wall(X1 - 180, 90, Z0, 180, 200, { c: O.wall });
    m.wall(X0 + 180, 90, Z0 + 2, X1 - X0 - 360, 200, { c: '#9fd0e8', unlit: true, grad: ['#7fb6d8', '#cfe9f6'] });
    for (var w = 0; w < 5; w++) m.box(X0 + 180 + w * ((X1 - X0 - 360) / 5) - 5, 90, Z0, 10, 200, 12, { c: '#6a6152', top: '#7d7462' });
    m.box(X0 + 176, 286, Z0 - 2, X1 - X0 - 352, 16, 16, { c: '#6a6152', top: '#7d7462' });
    m.wall(X0, 290, Z0, X1 - X0, 50, { c: U.shadow(O.wall, .25) });
    // 天花板
    var b9 = m.v.length;
    m.pt(X0, CY, Z0); m.pt(X1, CY, Z0); m.pt(X1, CY, Z1); m.pt(X0, CY, Z1);
    m.quad(b9, b9 + 1, b9 + 2, b9 + 3, { c: U.shadow(O.wall, .38) });
    var b10 = m.v.length;
    m.pt(-150, CY - 8, -180); m.pt(150, CY - 8, -180); m.pt(150, CY - 8, -60); m.pt(-150, CY - 8, -60);
    m.quad(b10, b10 + 1, b10 + 2, b10 + 3, { c: '#fff6dc', unlit: true });
    // 侧墙
    for (var s = 0; s < 2; s++) {
      var wx = s ? X1 : X0, sgn = s ? -1 : 1, bb = m.v.length;
      m.pt(wx, 0, Z0); m.pt(wx, CY, Z0); m.pt(wx, CY, Z1); m.pt(wx, 0, Z1);
      var op = { c: O.wall, grad: [O.wallLo, O.wallHi] };
      if (sgn > 0) m.quad(bb, bb + 1, bb + 2, bb + 3, op); else m.quad(bb + 3, bb + 2, bb + 1, bb, op);
    }
    // 长椅
    for (var bench = 0; bench < 2; bench++) {
      var bx = bench ? 150 : -390;
      m.box(bx, 0, -170, 240, 40, 80, { c: C.bench, top: U.hilite(C.bench, .2) });
      m.box(bx, 40, -170, 240, 60, 16, { c: U.shadow(C.bench, .1), top: C.bench });
    }
    // 盆栽
    m.prism(-430, 60, 40, 0, 56, 8, { c: '#7a5a3e', top: '#8f6c4a' });
    for (var lf = 0; lf < 7; lf++) {
      var ang = lf / 7 * 6.28;
      m.box(-430 + Math.cos(ang) * 26 - 8, 56, 60 + Math.sin(ang) * 26 - 8, 16, 70 + (lf % 3) * 22, 16,
        { c: lf % 2 ? O.plant : O.plantHi, top: O.plantHi });
    }
    // 法庭大门
    m.box(-160, 0, Z0 + 4, 320, 250, 14, { c: '#5c4028', top: C.trim, front: '#6e4d31',
      detFront: [
        { u: .02, v: .02, w: .46, h: .96, c: '#7a5636' }, { u: .52, v: .02, w: .46, h: .96, c: '#7a5636' },
        { u: .06, v: .08, w: .38, h: .4, c: '#5f4229' }, { u: .56, v: .08, w: .38, h: .4, c: '#5f4229' },
        { u: .06, v: .54, w: .38, h: .38, c: '#5f4229' }, { u: .56, v: .54, w: .38, h: .38, c: '#5f4229' },
        { u: .47, v: .44, w: .025, h: .1, c: C.trim }, { u: .505, v: .44, w: .025, h: .1, c: C.trim }
      ] });

    var cams = {
      main: { eye: [40, 165, 220], target: [-30, 128, -320], fov: 46, slots: { talk: [128, 219, 1] } },
      door: { eye: [0, 150, -100], target: [0, 140, -420], fov: 40, slots: { talk: [128, 219, 1] } },
      window: { eye: [0, 160, -60], target: [30, 180, -420], fov: 42, slots: { talk: [128, 219, 1] } }
    };
    var anchors = {
      naruhodo: [-130, 0, 20], mayoi: [10, 0, 40],
      itonokogiri: [190, 0, -30], mitsurugi: [200, 0, -60], kanon: [-40, 0, -30], witness: [140, 0, -60]
    };
    return { mesh: m, cams: cams, anchors: anchors, name: 'lobby', talkCam: 'main' };
  };

  /* ================= 成步堂法律事务所 ================= */
  MD.office = function () {
    var m = P3.Mesh();
    var O = P.office;
    var X0 = -400, X1 = 400, Z0 = -340, Z1 = 200, CY = 260;

    for (var i = 0; i < 6; i++) for (var j = 0; j < 5; j++) {
      m.plane(X0 + i * 133, 0, Z0 + j * 108, 133, 108, { c: (i + j) & 1 ? '#6b5842' : '#5e4d3a', bias: 6 });
    }
    for (var a = 0; a < 8; a++) {
      m.wall(X0 + a * 100, 0, Z0, 100, 90, { c: a % 2 ? '#6a5842' : '#5f4e3a' });
      m.wall(X0 + a * 100, 90, Z0, 100, CY - 90, {
        c: a % 2 ? O.wall : O.wallHi,
        det: [{ u: .1, v: .06, w: .8, h: .5, c: a % 2 ? O.wallHi : O.wall }]
      });
    }
    m.box(X0, 84, Z0, X1 - X0, 12, 10, { c: '#4e402e', top: '#63523c' });
    for (var s = 0; s < 2; s++) {
      var wx = s ? X1 : X0, sgn = s ? -1 : 1, bb = m.v.length;
      m.pt(wx, 0, Z0); m.pt(wx, CY, Z0); m.pt(wx, CY, Z1); m.pt(wx, 0, Z1);
      var op = { c: O.wall, grad: [O.wallLo, O.wallHi] };
      if (sgn > 0) m.quad(bb, bb + 1, bb + 2, bb + 3, op); else m.quad(bb + 3, bb + 2, bb + 1, bb, op);
    }
    var b11 = m.v.length;
    m.pt(X0, CY, Z0); m.pt(X1, CY, Z0); m.pt(X1, CY, Z1); m.pt(X0, CY, Z1);
    m.quad(b11, b11 + 1, b11 + 2, b11 + 3, { c: U.shadow(O.wall, .4) });
    var b12 = m.v.length;
    m.pt(-90, CY - 6, -150); m.pt(90, CY - 6, -150); m.pt(90, CY - 6, -60); m.pt(-90, CY - 6, -60);
    m.quad(b12, b12 + 1, b12 + 2, b12 + 3, { c: '#fff2d4', unlit: true });

    // 办公桌
    m.box(-330, 0, -230, 300, 76, 130, { c: O.desk, top: U.hilite(O.desk, .2), front: U.shadow(O.desk, .15) });
    m.box(-300, 76, -210, 90, 5, 60, { c: '#e9e2c8', top: '#f4efdc' });
    m.box(-160, 76, -200, 60, 34, 44, { c: '#2c3244', top: '#3a4358' });
    m.prism(-250, -140, 22, 76, 84, 8, { c: '#3f5db0', top: '#5570c6' });
    // 沙发
    m.box(60, 0, -60, 300, 48, 110, { c: O.sofa, top: O.sofaHi });
    m.box(60, 48, -60, 300, 60, 26, { c: U.shadow(O.sofa, .1), top: O.sofaHi });
    m.box(50, 0, -60, 20, 88, 110, { c: U.shadow(O.sofa, .18), top: O.sofaHi });
    m.box(350, 0, -60, 20, 88, 110, { c: U.shadow(O.sofa, .18), top: O.sofaHi });
    // 茶几
    m.box(110, 0, 60, 200, 40, 90, { c: '#5c4630', top: '#75593c' });
    // 书架
    m.box(200, 0, Z0 + 6, 180, 220, 44, { c: '#5a442c', top: '#6d5436', front: '#664c30',
      detFront: (function () {
        var d = [];
        for (var k = 0; k < 5; k++) {
          d.push({ u: .04, v: .06 + k * .19, w: .92, h: .15, c: '#3e2f1e' });
          for (var q = 0; q < 9; q++) d.push({ u: .06 + q * .1, v: .075 + k * .19, w: .075, h: .12, c: ['#a8443c', '#3c5a86', '#8a7a3a', '#4a7a56', '#7a3a6a'][(k + q) % 5] });
        }
        return d;
      })() });
    // 盆栽
    m.prism(-370, 120, 34, 0, 46, 8, { c: '#7a5a3e', top: '#8f6c4a' });
    for (var lf2 = 0; lf2 < 6; lf2++) {
      var ang2 = lf2 / 6 * 6.28;
      m.box(-370 + Math.cos(ang2) * 22 - 7, 46, 120 + Math.sin(ang2) * 22 - 7, 14, 60 + (lf2 % 3) * 20, 14,
        { c: lf2 % 2 ? O.plant : O.plantHi, top: O.plantHi });
    }

    var cams = {
      main: { eye: [60, 155, 200], target: [-60, 122, -260], fov: 46, slots: { talk: [128, 219, 1] } },
      desk: { eye: [-170, 145, 90], target: [-190, 105, -190], fov: 42, slots: { talk: [128, 219, 1] } },
      shelf: { eye: [250, 150, 60], target: [265, 135, -300], fov: 40, slots: { talk: [128, 219, 1] } }
    };
    var anchors = {
      naruhodo: [-190, 0, -60], mayoi: [-60, 0, -30],
      itonokogiri: [120, 0, -120], witness: [120, 0, -120]
    };
    return { mesh: m, cams: cams, anchors: anchors, name: 'office', talkCam: 'main' };
  };

})(window.AA);
