/* ============================================================================
 * models3d.js — 参数化高还原三维装备建模库 (Parametric 3D Equipment Models)
 * ----------------------------------------------------------------------------
 * 依赖 three.js (vendor/three.min.js)。不加载任何外部模型文件：
 *   全部按平台真实构型用截面放样(loft) + 机翼/舰体/炮塔/雷达阵面等零件程序化生成，
 *   单模型 600~3000 三角面，内存与加载开销极小，便于烘焙为地图精灵。
 *
 * 坐标约定: +X 右舷 / +Y 上 / -Z 舰首(机头)朝向。单位 = 米。
 * ==========================================================================*/
(function (root) {
  'use strict';
  var TWG = root.TWG = root.TWG || {};
  var T = null;
  function three() { return T || (T = root.THREE); }
  function ok() { return typeof root.THREE !== 'undefined'; }

  /* ======================= 材质 ======================================== */
  var MATS = null;
  function mats() {
    if (MATS) return MATS;
    var X = three();
    function std(color, rough, metal, o) {
      return new X.MeshStandardMaterial(Object.assign({ color: color, roughness: rough, metalness: metal }, o || {}));
    }
    MATS = {
      hullGrey: std(0x6a7378, 0.62, 0.35),
      hullDark: std(0x4a5257, 0.58, 0.4),
      hullNavy: std(0x545e66, 0.6, 0.38),
      deck: std(0x33383c, 0.9, 0.12),
      deckDark: std(0x24282b, 0.95, 0.08),
      antiSkid: std(0x2b3033, 0.98, 0.05),
      white: std(0xd9dee0, 0.55, 0.15),
      radome: std(0xc9cfd2, 0.45, 0.1),
      glass: std(0x7fd4ff, 0.12, 0.2, { transparent: true, opacity: 0.5, envMapIntensity: 1.4 }),
      canopy: std(0x9ad8f0, 0.08, 0.35, { transparent: true, opacity: 0.42 }),
      metal: std(0x9aa3a8, 0.35, 0.85),
      metalDark: std(0x5b6266, 0.4, 0.8),
      nozzle: std(0x3a3d3f, 0.45, 0.9),
      rubber: std(0x1c1f21, 0.95, 0.05),
      olive: std(0x4c5340, 0.8, 0.15),
      sand: std(0x7d7358, 0.85, 0.1),
      camo: std(0x3f4a3a, 0.85, 0.12),
      yellow: std(0xd6a92e, 0.6, 0.2),
      orange: std(0xd2762a, 0.6, 0.2),
      red: std(0xa32f2c, 0.6, 0.2),
      radarPanel: std(0x2a3a44, 0.35, 0.5, { emissive: 0x0d3a4c, emissiveIntensity: 0.75 }),
      radarPanelR: std(0x3a2a2a, 0.35, 0.5, { emissive: 0x4c1d1d, emissiveIntensity: 0.7 }),
      stealth: std(0x3c4146, 0.42, 0.55),
      lightG: std(0x2c6e3c, 0.4, 0.2, { emissive: 0x22c55e, emissiveIntensity: 1.2 }),
      lightR: std(0x6e2c2c, 0.4, 0.2, { emissive: 0xef4444, emissiveIntensity: 1.2 })
    };
    return MATS;
  }
  function tint(base, hex) {
    var X = three(), m = base.clone(); m.color = new X.Color(hex); return m;
  }

  /* ======================= 几何工具 ==================================== */
  /** 截面放样: stations = [{z, pts:[[x,y],...]}]，pts 数量一致，返回封闭 BufferGeometry */
  function loft(stations, capFront, capBack) {
    var X = three();
    var N = stations.length, M = stations[0].pts.length;
    var pos = [], idx = [];
    for (var i = 0; i < N; i++) {
      var s = stations[i];
      for (var j = 0; j < M; j++) pos.push(s.pts[j][0], s.pts[j][1], s.z);
    }
    for (var i2 = 0; i2 < N - 1; i2++) {
      for (var j2 = 0; j2 < M; j2++) {
        var a = i2 * M + j2, b = i2 * M + (j2 + 1) % M;
        var c = (i2 + 1) * M + (j2 + 1) % M, d = (i2 + 1) * M + j2;
        idx.push(a, b, c, a, c, d);
      }
    }
    function cap(ring, rev) {
      var base = ring * M;
      var cx = 0, cy = 0, cz = stations[ring].z;
      for (var j = 0; j < M; j++) { cx += stations[ring].pts[j][0]; cy += stations[ring].pts[j][1]; }
      cx /= M; cy /= M;
      var ci = pos.length / 3;
      pos.push(cx, cy, cz);
      for (var j3 = 0; j3 < M; j3++) {
        var a1 = base + j3, b1 = base + (j3 + 1) % M;
        if (rev) idx.push(ci, b1, a1); else idx.push(ci, a1, b1);
      }
    }
    if (capFront) cap(0, true);
    if (capBack) cap(N - 1, false);
    var g = new X.BufferGeometry();
    g.setAttribute('position', new X.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  /** 舰体: 由长度/舰宽/吃水+型深生成带首柱外飘与舰尾方艉的船体 */
  function hullGeom(L, B, D, opt) {
    opt = opt || {};
    var bowRake = opt.bowRake == null ? 0.55 : opt.bowRake;
    var transom = opt.transom == null ? 0.82 : opt.transom;  // 方艉宽度比
    var flare = opt.flare == null ? 1.12 : opt.flare;
    var Ns = 15, Ms = 12;
    var st = [];
    for (var i = 0; i < Ns; i++) {
      var t = i / (Ns - 1);                     // 0 = 首, 1 = 尾
      var z = -L / 2 + t * L;
      // 半宽包线: 首部尖削, 中部最宽, 尾部方艉
      var hw;
      if (t < 0.42) hw = Math.pow(Math.sin(t / 0.42 * Math.PI / 2), 0.72);
      else if (t < 0.72) hw = 1;
      else hw = 1 - (1 - transom) * Math.pow((t - 0.72) / 0.28, 1.4);
      hw *= B / 2;
      // 龙骨深度: 首部深、尾部浅
      var dep = D * (t < 0.2 ? 0.72 + 0.28 * (t / 0.2) : t > 0.85 ? 1 - 0.22 * ((t - 0.85) / 0.15) : 1);
      // 甲板线(舷弧): 首尾高、中部低
      var sheer = D * 0.14 * (Math.pow(1 - t, 2.1) * 1.5 + Math.pow(t, 3) * 0.5);
      var pts = [];
      for (var j = 0; j < Ms; j++) {
        var u = j / Ms * Math.PI * 2;
        // 用变形圆生成 U 形横剖面：上部外飘、底部收窄
        var cs = Math.cos(u), sn = Math.sin(u);
        var yy, xx;
        if (sn >= 0) {           // 上半: 舷侧近垂直并外飘
          yy = sn * (D * 0.5) + D * 0.5 - dep;
          xx = cs * hw * (1 + (flare - 1) * sn);
        } else {                 // 下半: V/U 形底
          var k = Math.pow(-sn, 0.62);
          yy = -k * dep + (D * 0.5 - dep) + D * 0.5 * 0;
          yy = (D * 0.5 - dep) - k * (D * 0.5);
          xx = cs * hw * (1 - 0.72 * k);
        }
        pts.push([xx, yy + sheer, 0]);
      }
      // 首柱前倾
      if (t < 0.3) z += bowRake * (0.3 - t) / 0.3 * (L * 0.03);
      st.push({ z: z, pts: pts });
    }
    return loft(st, true, true);
  }

  /** 机身: 椭圆截面放样, 支持前锥/后缩/座舱鼓包 */
  function fuseGeom(L, W, H, opt) {
    opt = opt || {};
    var Ns = 16, Ms = 12, st = [];
    for (var i = 0; i < Ns; i++) {
      var t = i / (Ns - 1);
      var z = -L / 2 + t * L;
      var r;
      if (t < 0.16) r = Math.pow(t / 0.16, 0.55);                 // 机头锥
      else if (t < 0.72) r = 1;
      else r = 1 - (1 - (opt.tailR == null ? 0.5 : opt.tailR)) * Math.pow((t - 0.72) / 0.28, 1.3);
      var w = W / 2 * r, hh = H / 2 * r;
      if (opt.flatBottom) hh *= 1;
      var pts = [];
      for (var j = 0; j < Ms; j++) {
        var u = j / Ms * Math.PI * 2;
        var x = Math.cos(u) * w;
        var y = Math.sin(u) * hh;
        if (opt.flatBottom && y < 0) y *= 0.62;
        if (opt.chine && Math.abs(Math.sin(u)) < 0.35) x *= 1.18;  // 边条/翼身融合
        pts.push([x, y, 0]);
      }
      st.push({ z: z, pts: pts });
    }
    return loft(st, true, true);
  }

  /** 机翼/尾翼: 后掠 + 上反 + 翼型厚度 */
  function wingGeom(rootC, tipC, span, sweep, thick, dihedral, twist) {
    var st = [], Ns = 6, Ms = 8;
    for (var i = 0; i < Ns; i++) {
      var t = i / (Ns - 1);
      var c = rootC + (tipC - rootC) * t;
      var xoff = span * t;
      var zoff = sweep * t;
      var yoff = Math.tan((dihedral || 0) * Math.PI / 180) * xoff;
      var th = thick * (1 - 0.45 * t);
      var pts = [];
      for (var j = 0; j < Ms; j++) {
        var u = j / Ms * Math.PI * 2;
        // 翼型: 前缘圆、后缘尖
        var zc = -Math.cos(u) * c / 2;
        var yc = Math.sin(u) * th / 2 * (1 - Math.pow(Math.abs(Math.cos(u)), 1.6) * 0.55);
        if (Math.cos(u) < 0) yc *= 0.72;
        pts.push([0, yc + yoff, zc + zoff]);
      }
      // 以 x 作为放样轴 → 转置
      st.push({ z: xoff, pts: pts.map(function (p) { return [p[2], p[1]]; }) });
    }
    // st 的 pts 是 [z,y]，放样轴是 x：手动重排
    var X = three();
    var g = loft(st, true, true);
    // 交换 x/z：loft 把 pts[0]→x, pts[1]→y, station.z→z
    var pos = g.attributes.position;
    for (var k = 0; k < pos.count; k++) {
      var a = pos.getX(k), b = pos.getY(k), cz = pos.getZ(k);
      pos.setXYZ(k, cz, b, a);
    }
    g.computeVertexNormals();
    return g;
  }

  function box(w, h, d) { return new (three().BoxGeometry)(w, h, d); }
  function cyl(r1, r2, h, seg) { return new (three().CylinderGeometry)(r1, r2, h, seg || 12); }
  function sph(r, s) { return new (three().SphereGeometry)(r, s || 12, (s || 12) / 2); }
  function mesh(g, m, x, y, z, rx, ry, rz, sx, sy, sz) {
    var o = new (three().Mesh)(g, m);
    o.position.set(x || 0, y || 0, z || 0);
    if (rx || ry || rz) o.rotation.set(rx || 0, ry || 0, rz || 0);
    if (sx != null) o.scale.set(sx, sy == null ? sx : sy, sz == null ? sx : sz);
    o.castShadow = true; o.receiveShadow = true;
    return o;
  }
  var RAD = Math.PI / 180;

  /* ======================= 零件 ======================================== */
  function missile(len, dia, mat, finMat) {
    var g = new (three().Group)();
    var M = mats();
    g.add(mesh(cyl(dia / 2, dia / 2, len * 0.82, 10), mat || M.white, 0, 0, 0, Math.PI / 2));
    g.add(mesh(cyl(0.02, dia / 2, len * 0.18, 10), mat || M.white, 0, 0, -len * 0.5, Math.PI / 2));
    for (var i = 0; i < 4; i++) {
      var a = i * Math.PI / 2 + Math.PI / 4;
      var f = mesh(box(dia * 0.06, dia * 1.5, len * 0.16), finMat || M.metalDark,
        Math.cos(a) * dia * 0.75, Math.sin(a) * dia * 0.75, len * 0.36, 0, 0, a);
      g.add(f);
    }
    return g;
  }
  function gunTurret(scale, mat) {
    var M = mats(), g = new (three().Group)();
    g.add(mesh(cyl(1.6 * scale, 1.9 * scale, 1.3 * scale, 14), mat || M.hullGrey, 0, 0.65 * scale, 0));
    g.add(mesh(box(1.9 * scale, 1.5 * scale, 3.2 * scale), mat || M.hullGrey, 0, 1.6 * scale, -0.4 * scale));
    g.add(mesh(cyl(0.16 * scale, 0.13 * scale, 4.2 * scale, 8), M.metalDark, 0, 1.7 * scale, -3.0 * scale, Math.PI / 2));
    return g;
  }
  function ciwsMount(scale) {
    var M = mats(), g = new (three().Group)();
    g.add(mesh(cyl(1.0 * scale, 1.2 * scale, 1.1 * scale, 12), M.hullGrey, 0, 0.55 * scale, 0));
    g.add(mesh(sph(0.75 * scale, 10), M.white, 0, 1.5 * scale, 0.2 * scale));
    g.add(mesh(cyl(0.42 * scale, 0.42 * scale, 1.9 * scale, 10), M.metalDark, 0, 1.2 * scale, -1.1 * scale, Math.PI / 2));
    return g;
  }
  function vlsBlock(cols, rows, cell, mat) {
    var M = mats(), g = new (three().Group)();
    var w = cols * cell, d = rows * cell;
    g.add(mesh(box(w, cell * 0.35, d), mat || M.deckDark, 0, 0, 0));
    for (var i = 0; i < cols; i++) for (var j = 0; j < rows; j++) {
      g.add(mesh(box(cell * 0.62, cell * 0.12, cell * 0.62), M.metalDark,
        -w / 2 + cell * (i + 0.5), cell * 0.2, -d / 2 + cell * (j + 0.5)));
    }
    return g;
  }
  function mast(h, mat) {
    var M = mats(), g = new (three().Group)();
    g.add(mesh(cyl(0.55, 0.28, h, 8), mat || M.hullGrey, 0, h / 2, 0));
    g.add(mesh(box(3.4, 0.28, 0.28), M.metalDark, 0, h * 0.66, 0));
    g.add(mesh(box(2.2, 0.24, 0.24), M.metalDark, 0, h * 0.84, 0));
    g.add(mesh(sph(0.5, 8), M.lightR, 0, h + 0.4, 0));
    return g;
  }
  function radarArray(w, h, mat) {
    return mesh(box(w, h, 0.35), mat || mats().radarPanel, 0, 0, 0);
  }
  function heliPad(r) {
    var M = mats(), g = new (three().Group)();
    g.add(mesh(cyl(r, r, 0.12, 20), M.antiSkid, 0, 0, 0));
    g.add(mesh(new (three().TorusGeometry)(r * 0.66, r * 0.06, 6, 20), M.yellow, 0, 0.1, 0, Math.PI / 2));
    return g;
  }
  function wheel(r, w) { return mesh(cyl(r, r, w, 10), mats().rubber, 0, 0, 0, 0, 0, Math.PI / 2); }
  function truckChassis(L, W, H, wheels, matBody) {
    var M = mats(), g = new (three().Group)();
    g.add(mesh(box(W, H * 0.5, L), matBody || M.olive, 0, H * 0.55, 0));
    g.add(mesh(box(W * 0.92, H * 0.62, L * 0.22), matBody || M.olive, 0, H * 0.95, -L * 0.36));
    g.add(mesh(box(W * 0.8, H * 0.3, L * 0.16), M.glass, 0, H * 1.12, -L * 0.44));
    for (var i = 0; i < wheels; i++) {
      var zz = -L * 0.34 + i * (L * 0.68 / Math.max(1, wheels - 1));
      g.add(mesh(cyl(H * 0.42, H * 0.42, W * 0.14, 10), M.rubber, W * 0.47, H * 0.42, zz, 0, 0, Math.PI / 2));
      g.add(mesh(cyl(H * 0.42, H * 0.42, W * 0.14, 10), M.rubber, -W * 0.47, H * 0.42, zz, 0, 0, Math.PI / 2));
    }
    return g;
  }

  /* ======================= 舰艇构型 ==================================== */
  function shipBase(P, sideCol) {
    var M = mats(), X = three();
    var L = P.len || 120;
    var B = L * (P.role === 'cv' ? 0.135 : P.role === 'barge' ? 0.24 : P.role === 'sealift' ? 0.16 : 0.125);
    if (P.role === 'lhd' || P.role === 'lha') B = L * 0.145;
    var D = L * 0.045;
    var g = new X.Group();
    var hullMat = sideCol === 'ROC' ? tint(M.hullNavy, 0x5b6a74) : M.hullGrey;
    var hull = mesh(hullGeom(L, B, D * 2.2, { transom: P.role === 'lst' ? 0.95 : 0.82 }), hullMat, 0, 0, 0);
    g.add(hull);
    // 主甲板
    g.add(mesh(box(B * 0.96, 0.3, L * 0.98), M.deck, 0, D * 1.1, 0));
    g.userData = { L: L, B: B, D: D, deckY: D * 1.15 };
    return g;
  }

  function buildCarrier(P, side) {
    var M = mats(), X = three();
    var g = shipBase(P, side), u = g.userData, L = u.L, B = u.B, dy = u.deckY;
    var fdW = B * 1.85;                                   // 飞行甲板外飘
    g.add(mesh(box(fdW, 0.9, L * 0.985), M.antiSkid, -B * 0.16, dy + 1.6, 0));
    // 斜角甲板
    var ang = P.id === 'CV-Fujian' ? 9 : 8;
    g.add(mesh(box(fdW * 0.42, 0.5, L * 0.62), M.antiSkid, -fdW * 0.32, dy + 2.0, L * 0.06, 0, -ang * RAD, 0));
    // 跑道标线
    g.add(mesh(box(1.1, 0.12, L * 0.62), M.white, -fdW * 0.28, dy + 2.3, L * 0.05, 0, -ang * RAD, 0));
    g.add(mesh(box(1.1, 0.12, L * 0.7), M.white, B * 0.1, dy + 2.15, -L * 0.1));
    // 舰岛
    var isl = new X.Group();
    isl.add(mesh(box(B * 0.34, L * 0.055, L * 0.19), M.hullGrey, 0, L * 0.028, 0));
    isl.add(mesh(box(B * 0.26, L * 0.03, L * 0.1), M.hullGrey, 0, L * 0.07, -L * 0.02));
    isl.add(mesh(box(B * 0.2, L * 0.012, L * 0.075), M.glass, 0, L * 0.05, -L * 0.05));
    // 双波段相控阵
    ['0,0,-1', '0,0,1', '-1,0,0', '1,0,0'].forEach(function (v, i) {
      var d = v.split(',').map(Number);
      var p = radarArray(B * 0.2, L * 0.028, M.radarPanel);
      p.position.set(d[0] * B * 0.17, L * 0.032, d[2] * L * 0.095);
      p.rotation.y = i < 2 ? 0 : Math.PI / 2;
      isl.add(p);
    });
    isl.add(mast(L * 0.075, M.metalDark)).position;
    var mm = mast(L * 0.07, M.metalDark); mm.position.set(0, L * 0.085, L * 0.01); isl.add(mm);
    isl.position.set(fdW * 0.30, dy + 2.4, L * 0.02);
    g.add(isl);
    // 滑跃甲板 或 弹射器
    if (P.id === 'CV-Fujian') {
      [[-fdW * 0.34, -L * 0.30, L * 0.30], [-fdW * 0.08, -L * 0.33, L * 0.24], [fdW * 0.2, -L * 0.34, L * 0.2]].forEach(function (c) {
        g.add(mesh(box(1.6, 0.16, c[2]), M.yellow, c[0], dy + 2.35, c[1]));
      });
    } else {
      var sk = mesh(box(fdW * 0.55, 1.0, L * 0.1), M.antiSkid, -fdW * 0.1, dy + 3.4, -L * 0.46, -12 * RAD, 0, 0);
      g.add(sk);
    }
    // 甲板停放舰载机
    var acCount = 0; if (P.airWing) Object.keys(P.airWing).forEach(function (k) { acCount += P.airWing[k]; });
    var spots = [[fdW * 0.05, -L * 0.40], [fdW * 0.20, -L * 0.30], [fdW * 0.30, -L * 0.16],
      [fdW * 0.32, L * 0.14], [fdW * 0.22, L * 0.28], [-fdW * 0.30, L * 0.40], [-fdW * 0.12, L * 0.44]];
    for (var i = 0; i < Math.min(spots.length, Math.ceil(acCount / 7)); i++) {
      var ac = buildAircraftSmall(L * 0.075, side);
      ac.position.set(spots[i][0], dy + 2.6, spots[i][1]);
      ac.rotation.y = (i % 2 ? 0.5 : -0.35);
      g.add(ac);
    }
    // 近防
    [[-fdW * 0.46, -L * 0.32], [fdW * 0.46, L * 0.3]].forEach(function (c) {
      var w = ciwsMount(L * 0.013); w.position.set(c[0], dy + 1.8, c[1]); g.add(w);
    });
    return g;
  }
  function buildAircraftSmall(len, side) {
    var M = mats(), X = three(), g = new X.Group();
    var m = side === 'ROC' ? tint(M.hullGrey, 0x7d8790) : M.stealth;
    g.add(mesh(fuseGeom(len, len * 0.13, len * 0.15, { tailR: 0.5 }), m, 0, 0, 0));
    g.add(mesh(wingGeom(len * 0.3, len * 0.09, len * 0.3, len * 0.22, len * 0.03, 0), m, 0, 0, len * 0.06));
    g.add(mesh(wingGeom(len * 0.3, len * 0.09, len * 0.3, len * 0.22, len * 0.03, 0), m, 0, 0, len * 0.06, 0, Math.PI, 0));
    g.add(mesh(box(len * 0.02, len * 0.12, len * 0.1), m, len * 0.05, len * 0.07, len * 0.38));
    g.add(mesh(box(len * 0.02, len * 0.12, len * 0.1), m, -len * 0.05, len * 0.07, len * 0.38));
    return g;
  }

  function buildLHD(P, side) {
    var M = mats(), X = three();
    var g = shipBase(P, side), u = g.userData, L = u.L, B = u.B, dy = u.deckY;
    var fdW = B * 1.35;
    g.add(mesh(box(fdW, 0.8, L * 0.97), M.antiSkid, 0, dy + 1.5, 0));
    for (var i = 0; i < 5; i++) {
      var hp = heliPad(B * 0.2); hp.position.set(-fdW * 0.12, dy + 2.0, -L * 0.36 + i * L * 0.18); g.add(hp);
    }
    var isl = new X.Group();
    isl.add(mesh(box(B * 0.3, L * 0.05, L * 0.26), M.hullGrey, 0, L * 0.025, 0));
    isl.add(mesh(box(B * 0.22, L * 0.02, L * 0.1), M.glass, 0, L * 0.05, -L * 0.06));
    var pa = radarArray(B * 0.18, L * 0.03, M.radarPanel); pa.position.set(-B * 0.15, L * 0.03, -L * 0.06); isl.add(pa);
    var mm = mast(L * 0.08, M.metalDark); mm.position.set(0, L * 0.055, L * 0.05); isl.add(mm);
    isl.position.set(fdW * 0.36, dy + 2.0, L * 0.04);
    g.add(isl);
    if (P.role === 'lha') {   // 076 电磁弹射
      g.add(mesh(box(1.5, 0.16, L * 0.34), M.yellow, -fdW * 0.26, dy + 2.0, -L * 0.26));
      for (var k = 0; k < 3; k++) {
        var uav = buildAircraftSmall(L * 0.06, side);
        uav.position.set(fdW * (0.05 + k * 0.11), dy + 2.2, L * (0.24 + k * 0.06)); uav.rotation.y = 0.4; g.add(uav);
      }
    } else {
      for (var k2 = 0; k2 < 3; k2++) {
        var h2 = buildHeloSmall(L * 0.075, side);
        h2.position.set(fdW * (0.02 + k2 * 0.1), dy + 2.4, L * (0.18 + k2 * 0.13)); g.add(h2);
      }
    }
    [[-fdW * 0.5, -L * 0.42], [fdW * 0.5, L * 0.42]].forEach(function (c) {
      var w = ciwsMount(L * 0.014); w.position.set(c[0], dy + 1.8, c[1]); g.add(w);
    });
    return g;
  }
  function buildHeloSmall(len, side) {
    var M = mats(), X = three(), g = new X.Group();
    g.add(mesh(fuseGeom(len * 0.75, len * 0.2, len * 0.22, { tailR: 0.3 }), M.olive, 0, 0, 0));
    g.add(mesh(cyl(len * 0.02, len * 0.02, len * 0.45, 6), M.olive, 0, len * 0.05, len * 0.5, Math.PI / 2, 0, 0));
    g.add(mesh(cyl(len * 0.52, len * 0.52, 0.06, 16), M.metalDark, 0, len * 0.2, 0));
    return g;
  }

  function buildLPD(P, side) {
    var M = mats(), X = three();
    var g = shipBase(P, side), u = g.userData, L = u.L, B = u.B, dy = u.deckY;
    g.add(mesh(box(B * 0.86, L * 0.055, L * 0.42), M.hullGrey, 0, dy + L * 0.028, -L * 0.16));
    g.add(mesh(box(B * 0.7, L * 0.02, L * 0.12), M.glass, 0, dy + L * 0.055, -L * 0.3));
    var mm = mast(L * 0.09, M.metalDark); mm.position.set(0, dy + L * 0.058, -L * 0.2); g.add(mm);
    // 后部飞行甲板 + 坞舱
    g.add(mesh(box(B * 0.9, 0.4, L * 0.36), M.antiSkid, 0, dy + 1.2, L * 0.28));
    var hp = heliPad(B * 0.3); hp.position.set(0, dy + 1.5, L * 0.24); g.add(hp);
    g.add(mesh(box(B * 0.6, L * 0.02, L * 0.1), M.deckDark, 0, dy + 0.6, L * 0.46));
    for (var i = 0; i < 4; i++) {
      var t = ciwsMount(L * 0.016);
      t.position.set((i % 2 ? 1 : -1) * B * 0.42, dy + 1.6, (i < 2 ? -1 : 1) * L * 0.36); g.add(t);
    }
    return g;
  }

  function buildLST(P, side) {
    var M = mats(), X = three();
    var g = shipBase(P, side), u = g.userData, L = u.L, B = u.B, dy = u.deckY;
    // 首门与跳板
    g.add(mesh(box(B * 0.62, L * 0.05, 0.5), M.metalDark, 0, dy + L * 0.02, -L * 0.49));
    g.add(mesh(box(B * 0.5, 0.35, L * 0.16), M.yellow, 0, dy + 0.2, -L * 0.56, -6 * RAD, 0, 0));
    // 车辆甲板
    g.add(mesh(box(B * 0.86, 0.25, L * 0.6), M.deckDark, 0, dy + 1.0, -L * 0.02));
    for (var i = 0; i < 3; i++) {
      var v = buildTankSmall(L * 0.075); v.position.set((i - 1) * B * 0.26, dy + 1.5, -L * 0.1 + (i % 2) * L * 0.16); g.add(v);
    }
    // 尾部上层建筑
    g.add(mesh(box(B * 0.72, L * 0.07, L * 0.2), M.hullGrey, 0, dy + L * 0.035, L * 0.35));
    g.add(mesh(box(B * 0.55, L * 0.022, L * 0.08), M.glass, 0, dy + L * 0.07, L * 0.29));
    var mm = mast(L * 0.11, M.metalDark); mm.position.set(0, dy + L * 0.07, L * 0.36); g.add(mm);
    return g;
  }
  function buildTankSmall(len) {
    var M = mats(), X = three(), g = new X.Group();
    g.add(mesh(box(len * 0.42, len * 0.16, len), M.camo, 0, len * 0.16, 0));
    g.add(mesh(box(len * 0.3, len * 0.12, len * 0.42), M.camo, 0, len * 0.3, -len * 0.04));
    g.add(mesh(cyl(len * 0.02, len * 0.02, len * 0.5, 6), M.metalDark, 0, len * 0.32, -len * 0.42, Math.PI / 2));
    g.add(mesh(box(len * 0.1, len * 0.14, len * 0.96), M.rubber, len * 0.23, len * 0.08, 0));
    g.add(mesh(box(len * 0.1, len * 0.14, len * 0.96), M.rubber, -len * 0.23, len * 0.08, 0));
    return g;
  }

  function buildBarge(P, side) {
    var M = mats(), X = three(), g = new X.Group();
    var L = P.len || 185, B = L * 0.24, D = L * 0.05;
    g.add(mesh(box(B, D, L), M.hullDark, 0, D / 2, 0));
    g.add(mesh(box(B * 0.98, 0.3, L * 0.98), M.deckDark, 0, D + 0.2, 0));
    // 4 条自升支腿
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (s) {
      g.add(mesh(cyl(B * 0.045, B * 0.045, L * 0.34, 10), M.yellow, s[0] * B * 0.4, D + L * 0.16, s[1] * L * 0.36));
      g.add(mesh(box(B * 0.12, D * 0.5, B * 0.12), M.metalDark, s[0] * B * 0.4, D * 0.4, s[1] * L * 0.36));
    });
    // 前伸栈桥
    var br = new X.Group();
    br.add(mesh(box(B * 0.4, 0.5, L * 0.5), M.metal, 0, 0, -L * 0.25));
    for (var i = 0; i < 6; i++) br.add(mesh(box(B * 0.44, 0.35, 0.6), M.orange, 0, 0.4, -L * 0.06 - i * L * 0.075));
    br.position.set(0, D + 1.0, -L * 0.5); br.rotation.x = -3 * RAD;
    g.add(br);
    // 甲板载具
    for (var k = 0; k < 4; k++) {
      var v = buildTankSmall(L * 0.055);
      v.position.set(((k % 2) - 0.5) * B * 0.42, D + 1.0, -L * 0.15 + Math.floor(k / 2) * L * 0.22); g.add(v);
    }
    g.add(mesh(box(B * 0.5, D * 0.8, L * 0.12), M.hullGrey, 0, D + D * 0.4, L * 0.42));
    return g;
  }

  function buildSealift(P, side) {
    var M = mats(), X = three();
    var g = shipBase(P, side), u = g.userData, L = u.L, B = u.B, dy = u.deckY;
    // 多层车辆甲板箱型上层
    g.add(mesh(box(B * 0.98, L * 0.055, L * 0.8), M.white, 0, dy + L * 0.028, -L * 0.02));
    for (var i = 0; i < 4; i++) {
      g.add(mesh(box(B * 1.0, 0.3, L * 0.8), M.hullGrey, 0, dy + L * 0.012 * (i + 1), -L * 0.02));
    }
    g.add(mesh(box(B * 0.8, L * 0.06, L * 0.14), M.white, 0, dy + L * 0.085, L * 0.36));
    g.add(mesh(box(B * 0.66, L * 0.018, L * 0.06), M.glass, 0, dy + L * 0.1, L * 0.32));
    g.add(mesh(cyl(B * 0.07, B * 0.06, L * 0.05, 10), M.red, 0, dy + L * 0.13, L * 0.42));
    // 尾跳板
    g.add(mesh(box(B * 0.5, 0.4, L * 0.12), M.yellow, 0, dy + 0.4, L * 0.53, 5 * RAD, 0, 0));
    return g;
  }

  function buildCombatant(P, side) {
    var M = mats(), X = three();
    var g = shipBase(P, side), u = g.userData, L = u.L, B = u.B, dy = u.deckY;
    var big = (P.disp || 4000) > 9000;
    var hullMat = side === 'ROC' ? tint(M.hullNavy, 0x5f6c76) : M.hullGrey;
    // 主炮
    var gt = gunTurret(L * 0.011, hullMat); gt.position.set(0, dy + 0.3, -L * 0.34); g.add(gt);
    // 前垂发
    var vlsN = P.vlsTotal || 0;
    if (vlsN > 0) {
      var fb = vlsBlock(4, Math.max(2, Math.round(vlsN / 16)), L * 0.016);
      fb.position.set(0, dy + 0.5, -L * 0.22); g.add(fb);
      if (vlsN > 48) { var bb = vlsBlock(4, Math.round(vlsN / 24), L * 0.016); bb.position.set(0, dy + 0.5, L * 0.2); g.add(bb); }
    } else if (P.launcher) {
      // 倾斜箱式/臂式发射装置
      var lb = mesh(box(B * 0.4, L * 0.02, L * 0.06), M.deckDark, 0, dy + 0.6, -L * 0.22); g.add(lb);
      for (var i2 = 0; i2 < 4; i2++) {
        var mi = missile(L * 0.05, L * 0.007, M.white);
        mi.rotation.x = -18 * RAD;
        mi.position.set(-B * 0.12 + i2 * B * 0.08, dy + 1.2, -L * 0.22); g.add(mi);
      }
    }
    // 上层建筑(阶梯式)
    var sup = new X.Group();
    sup.add(mesh(box(B * 0.68, L * 0.042, L * 0.3), hullMat, 0, L * 0.021, 0));
    sup.add(mesh(box(B * 0.52, L * 0.03, L * 0.16), hullMat, 0, L * 0.055, -L * 0.03));
    sup.add(mesh(box(B * 0.44, L * 0.014, L * 0.09), M.glass, 0, L * 0.05, -L * 0.075));
    // 相控阵板 (四面)
    var panelMat = side === 'ROC' ? M.radarPanelR : M.radarPanel;
    if (P.radar && /相控阵|AESA|SPY|346/.test(P.radar.name || '')) {
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (s, i) {
        var p = radarArray(B * 0.22, L * 0.026, panelMat);
        p.position.set(s[0] * B * 0.3, L * 0.036, s[1] * L * 0.055);
        p.rotation.y = (s[0] > 0 ? -1 : 1) * 32 * RAD + (s[1] > 0 ? Math.PI : 0);
        sup.add(p);
      });
    }
    // 桅杆 + 旋转雷达
    var mm = mast(L * 0.1, M.metalDark); mm.position.set(0, L * 0.062, -L * 0.02); sup.add(mm);
    if (!(P.radar && /相控阵|AESA/.test(P.radar.name || ''))) {
      sup.add(mesh(box(B * 0.5, L * 0.008, L * 0.02), M.white, 0, L * 0.15, -L * 0.02));
    }
    sup.position.set(0, dy + 0.4, -L * 0.04);
    g.add(sup);
    // 烟囱
    g.add(mesh(box(B * 0.3, L * 0.035, L * 0.07), M.hullDark, 0, dy + L * 0.045, L * 0.04));
    // 反舰导弹发射箱 (中部两舷)
    var hasAshm = Object.keys(P.allWeapons || {}).some(function (k) { return (TWG.WEAPONS[k] || {}).type === 'ashm'; });
    if (hasAshm && !vlsN) {
      [-1, 1].forEach(function (s) {
        for (var j = 0; j < 2; j++) {
          g.add(mesh(box(L * 0.012, L * 0.012, L * 0.06), M.orange, s * B * 0.28, dy + 1.0 + j * L * 0.013, L * 0.1, -12 * RAD, s * 22 * RAD, 0));
        }
      });
    }
    // 近防
    var ciwsScale = L * 0.012;
    var c1 = ciwsMount(ciwsScale); c1.position.set(0, dy + L * 0.05, -L * 0.14); g.add(c1);
    var c2 = ciwsMount(ciwsScale); c2.position.set(0, dy + L * 0.04, L * 0.3); g.add(c2);
    // 机库与直升机甲板
    if (P.helo || big) {
      g.add(mesh(box(B * 0.6, L * 0.035, L * 0.14), hullMat, 0, dy + L * 0.018, L * 0.2));
      var hp = heliPad(B * 0.33); hp.position.set(0, dy + 0.35, L * 0.38); g.add(hp);
    }
    // 拖曳阵/鱼雷发射管
    if (P.sonar && P.sonar.towed) g.add(mesh(cyl(0.5, 0.5, L * 0.03, 8), M.metalDark, 0, dy + 0.6, L * 0.47, Math.PI / 2));
    return g;
  }

  function buildFAC(P, side) {
    var M = mats(), X = three(), g = new X.Group();
    var L = P.len || 43, catam = /022|TuoChiang/.test(P.id || '');
    var B = L * (catam ? 0.28 : 0.2), D = L * 0.06;
    var hullMat = side === 'ROC' ? tint(M.hullNavy, 0x63707a) : M.hullGrey;
    if (catam) {
      [-1, 1].forEach(function (s) {
        var h = mesh(hullGeom(L, B * 0.36, D * 2, { transom: 0.9 }), hullMat, s * B * 0.32, 0, 0);
        g.add(h);
      });
      g.add(mesh(box(B * 0.95, D * 0.6, L * 0.8), hullMat, 0, D * 0.9, 0));
    } else {
      g.add(mesh(hullGeom(L, B, D * 2, { transom: 0.9 }), hullMat, 0, 0, 0));
    }
    var dy = D * 1.1;
    // 隐身棱面上层建筑
    var s1 = mesh(box(B * 0.6, L * 0.09, L * 0.34), hullMat, 0, dy + L * 0.05, -L * 0.1);
    g.add(s1);
    g.add(mesh(box(B * 0.44, L * 0.03, L * 0.1), M.glass, 0, dy + L * 0.08, -L * 0.2));
    var mm = mast(L * 0.14, M.metalDark); mm.position.set(0, dy + L * 0.09, -L * 0.06); g.add(mm);
    // 反舰导弹发射箱
    var boxes = catam ? 4 : 2;
    [-1, 1].forEach(function (s) {
      for (var i = 0; i < boxes / 2 + 1; i++) {
        g.add(mesh(box(L * 0.05, L * 0.05, L * 0.2), M.orange,
          s * B * 0.26, dy + L * 0.035 + i * L * 0.05, L * 0.22, -10 * RAD, s * 12 * RAD, 0));
      }
    });
    if (side === 'ROC') { var cw = ciwsMount(L * 0.03); cw.position.set(0, dy + L * 0.02, L * 0.42); g.add(cw); }
    return g;
  }

  function buildSub(P, side) {
    var M = mats(), X = three(), g = new X.Group();
    var L = P.len || 75, R = L * 0.055;
    var hullMat = side === 'ROC' ? tint(M.hullDark, 0x3b4348) : M.hullDark;
    // 水滴形艇体
    var st = [], Ns = 18, Ms = 14;
    for (var i = 0; i < Ns; i++) {
      var t = i / (Ns - 1), z = -L / 2 + t * L;
      var r = R * Math.pow(Math.sin(Math.pow(t, 0.85) * Math.PI), 0.55);
      if (t > 0.86) r = R * Math.pow(Math.sin(Math.pow(0.86, 0.85) * Math.PI), 0.55) * (1 - (t - 0.86) / 0.14 * 0.82);
      var pts = [];
      for (var j = 0; j < Ms; j++) {
        var u2 = j / Ms * Math.PI * 2;
        pts.push([Math.cos(u2) * r, Math.sin(u2) * r]);
      }
      st.push({ z: z, pts: pts });
    }
    g.add(mesh(loft(st, true, true), hullMat, 0, 0, 0));
    // 指挥台围壳
    g.add(mesh(box(R * 0.9, R * 1.15, L * 0.14), hullMat, 0, R * 0.85, -L * 0.1));
    g.add(mesh(box(R * 0.7, R * 0.3, L * 0.1), hullMat, 0, R * 1.5, -L * 0.1));
    // 潜望镜/通气管
    g.add(mesh(cyl(R * 0.07, R * 0.05, R * 1.3, 6), M.metalDark, 0, R * 2.1, -L * 0.12));
    g.add(mesh(cyl(R * 0.05, R * 0.05, R * 1.0, 6), M.metalDark, R * 0.2, R * 1.9, -L * 0.08));
    // 围壳舵
    g.add(mesh(box(R * 3.0, R * 0.12, L * 0.055), hullMat, 0, R * 0.6, -L * 0.09));
    // 尾部 X 舵
    for (var k = 0; k < 4; k++) {
      var a = k * Math.PI / 2 + Math.PI / 4;
      g.add(mesh(box(R * 0.1, R * 2.0, L * 0.06), hullMat,
        Math.cos(a) * R * 0.9, Math.sin(a) * R * 0.9, L * 0.4, 0, 0, a));
    }
    // 螺旋桨/泵推
    g.add(mesh(cyl(R * 0.42, R * 0.3, L * 0.03, 10), M.metal, 0, 0, L * 0.48, Math.PI / 2));
    return g;
  }

  function buildCCG(P, side) {
    var M = mats(), X = three();
    var g = shipBase(P, side), u = g.userData, L = u.L, B = u.B, dy = u.deckY;
    // 白色船体 + 红蓝斜纹
    g.children[0].material = M.white;
    g.add(mesh(box(B * 0.72, L * 0.06, L * 0.42), M.white, 0, dy + L * 0.03, -L * 0.08));
    g.add(mesh(box(B * 0.56, L * 0.022, L * 0.12), M.glass, 0, dy + L * 0.062, -L * 0.22));
    g.add(mesh(box(B * 1.02, L * 0.02, L * 0.1), M.red, 0, dy + 0.6, -L * 0.3, 0, 0, 0));
    g.add(mesh(box(B * 1.02, L * 0.012, L * 0.05), M.radarPanel, 0, dy + 0.45, -L * 0.24));
    var gt = gunTurret(L * 0.01, M.white); gt.position.set(0, dy + 0.3, -L * 0.36); g.add(gt);
    var mm = mast(L * 0.11, M.metalDark); mm.position.set(0, dy + L * 0.065, -L * 0.12); g.add(mm);
    var hp = heliPad(B * 0.33); hp.position.set(0, dy + 0.4, L * 0.34); g.add(hp);
    g.add(mesh(box(B * 0.62, L * 0.04, L * 0.16), M.white, 0, dy + L * 0.02, L * 0.14));
    return g;
  }
  function buildMilitia(P, side) {
    var M = mats(), X = three();
    var g = shipBase(P, side), u = g.userData, L = u.L, B = u.B, dy = u.deckY;
    g.children[0].material = tint(M.hullGrey, 0x4a5a58);
    g.add(mesh(box(B * 0.68, L * 0.09, L * 0.26), M.sand, 0, dy + L * 0.045, L * 0.16));
    g.add(mesh(box(B * 0.5, L * 0.03, L * 0.1), M.glass, 0, dy + L * 0.085, L * 0.1));
    g.add(mesh(cyl(0.25, 0.2, L * 0.22, 6), M.metalDark, 0, dy + L * 0.11, L * 0.02));
    for (var i = 0; i < 3; i++) g.add(mesh(box(B * 0.5, L * 0.02, L * 0.06), M.orange, 0, dy + 0.4 + i * L * 0.02, -L * 0.2));
    return g;
  }

  /* ======================= 飞机构型 ==================================== */
  function acBase(P, side, span) {
    var M = mats(), X = three(), g = new X.Group();
    var stealth = (P.rcs != null && P.rcs < 0.3);
    var body = stealth ? M.stealth : (side === 'ROC' ? tint(M.hullGrey, 0x8b959c) :
      side === 'US' ? tint(M.hullGrey, 0x6f7a82) : tint(M.hullGrey, 0x78838a));
    g.userData = { body: body, stealth: stealth };
    return g;
  }
  function pylonMissiles(g, L, span, n, mat, y) {
    for (var i = 0; i < n; i++) {
      var s = i % 2 ? 1 : -1, k = Math.floor(i / 2);
      var mi = missile(L * 0.18, L * 0.022, mat || mats().white);
      mi.position.set(s * span * (0.18 + k * 0.13), (y == null ? -L * 0.045 : y), L * 0.02);
      g.add(mi);
      g.add(mesh(box(L * 0.012, L * 0.02, L * 0.05), mats().metalDark, s * span * (0.18 + k * 0.13), (y == null ? -L * 0.03 : y + 0.15), L * 0.02));
    }
  }
  function buildFighter(P, side, kind) {
    var M = mats(), X = three();
    var L = TWG.platformLen(P.id);
    var span = TWG.platformSpan(P.id);
    var g = acBase(P, side), body = g.userData.body;
    // 机身
    g.add(mesh(fuseGeom(L, L * 0.115, L * 0.135, { tailR: 0.46, chine: 1 }), body, 0, 0, 0));
    // 座舱
    g.add(mesh(sph(L * 0.055, 10), M.canopy, 0, L * 0.055, -L * 0.24, 0, 0, 0, 1, 0.75, 2.1));
    // 主翼
    var sweep = kind === 'delta' ? L * 0.42 : L * 0.3;
    var rootC = kind === 'delta' ? L * 0.5 : L * 0.34, tipC = kind === 'delta' ? L * 0.1 : L * 0.13;
    [1, -1].forEach(function (s) {
      var w = mesh(wingGeom(rootC, tipC, span / 2, sweep, L * 0.028, 2), body, 0, -L * 0.01, L * 0.04);
      if (s < 0) w.scale.x = -1;
      g.add(w);
    });
    // 鸭翼 (歼-20/歼-10/幻象)
    if (kind === 'delta' && /J-20|J-10|Mirage|IDF/.test(P.id)) {
      [1, -1].forEach(function (s) {
        var c = mesh(wingGeom(L * 0.14, L * 0.05, span * 0.2, L * 0.1, L * 0.014, 6), body, 0, L * 0.01, -L * 0.16);
        if (s < 0) c.scale.x = -1;
        g.add(c);
      });
    }
    // 平尾
    if (kind !== 'delta' || /J-20/.test(P.id)) {
      [1, -1].forEach(function (s) {
        var h = mesh(wingGeom(L * 0.16, L * 0.06, span * 0.22, L * 0.11, L * 0.016, 0), body, 0, -L * 0.005, L * 0.38);
        if (s < 0) h.scale.x = -1;
        g.add(h);
      });
    }
    // 垂尾
    var twin = (P.crew >= 2 || /J-20|J-16|J-11|Su-3|J-15|J-35|F-22|F-35/.test(P.id));
    if (twin) {
      [1, -1].forEach(function (s) {
        var v = mesh(wingGeom(L * 0.16, L * 0.07, L * 0.13, L * 0.1, L * 0.014, 0), body,
          s * L * 0.055, L * 0.02, L * 0.34, 0, 0, s * (kind === 'delta' ? 22 : 16) * RAD);
        v.rotation.z = s * (kind === 'delta' ? -0.38 : -0.28);
        v.rotation.x = -Math.PI / 2;
        v.rotation.order = 'ZXY';
        g.add(v);
      });
    } else {
      var v1 = mesh(wingGeom(L * 0.22, L * 0.09, L * 0.16, L * 0.13, L * 0.016, 0), body, 0, L * 0.02, L * 0.3);
      v1.rotation.x = -Math.PI / 2; g.add(v1);
    }
    // 发动机喷口
    var eN = twin ? 2 : 1;
    for (var e = 0; e < eN; e++) {
      var ex = eN === 2 ? (e ? 1 : -1) * L * 0.045 : 0;
      g.add(mesh(cyl(L * 0.042, L * 0.05, L * 0.07, 12), M.nozzle, ex, -L * 0.005, L * 0.48, Math.PI / 2));
    }
    // 挂载
    if (!g.userData.stealth) pylonMissiles(g, L, span, 4, M.white);
    else {
      // 隐身机内埋弹舱线
      g.add(mesh(box(L * 0.04, L * 0.004, L * 0.24), M.metalDark, L * 0.045, -L * 0.065, 0));
      g.add(mesh(box(L * 0.04, L * 0.004, L * 0.24), M.metalDark, -L * 0.045, -L * 0.065, 0));
    }
    // 航行灯
    g.add(mesh(sph(L * 0.008, 6), M.lightG, span * 0.5, 0, L * 0.06));
    g.add(mesh(sph(L * 0.008, 6), M.lightR, -span * 0.5, 0, L * 0.06));
    return g;
  }
  function buildBomber(P, side) {
    var M = mats(), X = three();
    var L = TWG.platformLen(P.id), span = TWG.platformSpan(P.id);
    var g = acBase(P, side), body = g.userData.body;
    g.add(mesh(fuseGeom(L, L * 0.1, L * 0.11, { tailR: 0.4 }), body, 0, 0, 0));
    g.add(mesh(sph(L * 0.05, 10), M.glass, 0, L * 0.035, -L * 0.4, 0, 0, 0, 1, 0.7, 1.6));
    g.add(mesh(sph(L * 0.045, 10), M.radome, 0, -L * 0.02, -L * 0.47, 0, 0, 0, 1, 0.8, 1.3));
    [1, -1].forEach(function (s) {
      var w = mesh(wingGeom(L * 0.3, L * 0.1, span / 2, L * 0.26, L * 0.022, 2), body, 0, -L * 0.01, L * 0.02);
      if (s < 0) w.scale.x = -1; g.add(w);
      g.add(mesh(cyl(L * 0.032, L * 0.036, L * 0.14, 10), M.nozzle, s * L * 0.06, -L * 0.01, L * 0.36, Math.PI / 2));
    });
    var v = mesh(wingGeom(L * 0.24, L * 0.1, L * 0.2, L * 0.16, L * 0.016, 0), body, 0, L * 0.02, L * 0.3);
    v.rotation.x = -Math.PI / 2; g.add(v);
    [1, -1].forEach(function (s) {
      var h = mesh(wingGeom(L * 0.14, L * 0.06, span * 0.16, L * 0.1, L * 0.014, 0), body, 0, 0, L * 0.42);
      if (s < 0) h.scale.x = -1; g.add(h);
    });
    // 翼下巡航导弹
    [1, -1].forEach(function (s) {
      for (var i = 0; i < 3; i++) {
        var mi = missile(L * 0.2, L * 0.022, M.white);
        mi.position.set(s * span * (0.14 + i * 0.1), -L * 0.05, L * 0.06); g.add(mi);
      }
    });
    return g;
  }
  function buildAEW(P, side) {
    var M = mats(), X = three();
    var L = TWG.platformLen(P.id), span = TWG.platformSpan(P.id);
    var g = acBase(P, side), body = g.userData.body;
    g.add(mesh(fuseGeom(L, L * 0.12, L * 0.14, { tailR: 0.55, flatBottom: 1 }), body, 0, 0, 0));
    g.add(mesh(sph(L * 0.05, 10), M.glass, 0, L * 0.05, -L * 0.36, 0, 0, 0, 1, 0.7, 1.4));
    [1, -1].forEach(function (s) {
      var w = mesh(wingGeom(L * 0.2, L * 0.11, span / 2, L * 0.03, L * 0.02, 3), body, 0, L * 0.04, L * 0.0);
      if (s < 0) w.scale.x = -1; g.add(w);
      [0.35, 0.62].forEach(function (f) {
        g.add(mesh(cyl(L * 0.028, L * 0.028, L * 0.12, 10), M.metalDark, s * span * f, L * 0.03, -L * 0.03, Math.PI / 2));
        g.add(mesh(cyl(L * 0.06, L * 0.06, 0.12, 12), M.metalDark, s * span * f, L * 0.03, -L * 0.1, Math.PI / 2));
      });
    });
    // 背负式圆盘雷达罩 (E-2 型) 或 平衡木
    if (P.id === 'E-2K' || P.id === 'KJ-2000') {
      g.add(mesh(cyl(L * 0.28, L * 0.28, L * 0.03, 20), M.radome, 0, L * 0.12, L * 0.02));
      g.add(mesh(box(L * 0.03, L * 0.07, L * 0.05), M.metalDark, 0, L * 0.08, L * 0.02));
    } else {
      g.add(mesh(box(L * 0.05, L * 0.11, L * 0.44), M.radarPanel, 0, L * 0.13, 0));
      g.add(mesh(box(L * 0.03, L * 0.06, L * 0.05), M.metalDark, 0, L * 0.09, 0));
      g.add(mesh(box(L * 0.3, L * 0.08, L * 0.04), M.radarPanel, 0, L * 0.13, -L * 0.02));
    }
    var v = mesh(wingGeom(L * 0.2, L * 0.09, L * 0.16, L * 0.1, L * 0.014, 0), body, 0, L * 0.03, L * 0.34);
    v.rotation.x = -Math.PI / 2; g.add(v);
    [1, -1].forEach(function (s) {
      var h = mesh(wingGeom(L * 0.12, L * 0.06, span * 0.14, L * 0.06, L * 0.012, 0), body, 0, L * 0.02, L * 0.42);
      if (s < 0) h.scale.x = -1; g.add(h);
    });
    return g;
  }
  function buildTransport(P, side) {
    var M = mats(), X = three();
    var L = TWG.platformLen(P.id), span = TWG.platformSpan(P.id);
    var g = acBase(P, side), body = g.userData.body;
    g.add(mesh(fuseGeom(L, L * 0.13, L * 0.15, { tailR: 0.6, flatBottom: 1 }), body, 0, 0, 0));
    g.add(mesh(sph(L * 0.05, 10), M.glass, 0, L * 0.05, -L * 0.38, 0, 0, 0, 1, 0.7, 1.4));
    [1, -1].forEach(function (s) {
      var w = mesh(wingGeom(L * 0.2, L * 0.1, span / 2, L * 0.06, L * 0.02, -2), body, 0, L * 0.055, 0);
      if (s < 0) w.scale.x = -1; g.add(w);
      [0.3, 0.55].forEach(function (f) {
        g.add(mesh(cyl(L * 0.03, L * 0.03, L * 0.13, 10), M.metalDark, s * span * f, L * 0.045, -L * 0.04, Math.PI / 2));
        if (/Y-8|Y-9|P-3|Y-20/.test(P.id) && P.id !== 'Y-20A') {
          g.add(mesh(cyl(L * 0.005, L * 0.005, L * 0.19, 4), M.metalDark, s * span * f, L * 0.045, -L * 0.115, 0, 0, 0.4));
          g.add(mesh(cyl(L * 0.005, L * 0.005, L * 0.19, 4), M.metalDark, s * span * f, L * 0.045, -L * 0.115, 0, 0, -0.4 + Math.PI / 2));
        } else {
          g.add(mesh(cyl(L * 0.035, L * 0.03, L * 0.02, 12), M.nozzle, s * span * f, L * 0.045, -L * 0.105, Math.PI / 2));
        }
      });
    });
    var v = mesh(wingGeom(L * 0.26, L * 0.1, L * 0.22, L * 0.14, L * 0.018, 0), body, 0, L * 0.04, L * 0.32);
    v.rotation.x = -Math.PI / 2; g.add(v);
    [1, -1].forEach(function (s) {
      var h = mesh(wingGeom(L * 0.13, L * 0.06, span * 0.15, L * 0.07, L * 0.013, 0), body, 0, L * 0.05, L * 0.42);
      if (s < 0) h.scale.x = -1; g.add(h);
    });
    if (P.id === 'P-3C') g.add(mesh(cyl(L * 0.012, L * 0.008, L * 0.16, 8), M.metalDark, 0, 0, L * 0.52, Math.PI / 2));
    return g;
  }
  function buildHelo(P, side) {
    var M = mats(), X = three();
    var L = TWG.platformLen(P.id);
    var g = acBase(P, side), body = /AH-|Z-10/.test(P.id) ? M.camo : g.userData.body;
    var atk = /AH-|Z-10/.test(P.id);
    g.add(mesh(fuseGeom(L * 0.72, L * (atk ? 0.09 : 0.16), L * 0.16, { tailR: 0.3 }), body, 0, 0, -L * 0.06));
    // 尾梁
    g.add(mesh(cyl(L * 0.028, L * 0.02, L * 0.42, 8), body, 0, L * 0.02, L * 0.42, Math.PI / 2));
    // 垂尾 + 尾桨
    var tv = mesh(wingGeom(L * 0.12, L * 0.05, L * 0.1, L * 0.05, L * 0.012, 0), body, 0, L * 0.05, L * 0.6);
    tv.rotation.x = -Math.PI / 2; g.add(tv);
    g.add(mesh(cyl(L * 0.11, L * 0.11, 0.05, 10), M.metalDark, L * 0.03, L * 0.1, L * 0.6, 0, 0, Math.PI / 2));
    // 主旋翼
    g.add(mesh(cyl(L * 0.035, L * 0.035, L * 0.06, 8), M.metalDark, 0, L * 0.13, -L * 0.06));
    var blades = atk ? 4 : 5;
    for (var i = 0; i < blades; i++) {
      var a = i / blades * Math.PI * 2;
      var b = mesh(box(L * 0.035, L * 0.006, L * 0.52), body, Math.sin(a) * L * 0.26, L * 0.16, -L * 0.06 + Math.cos(a) * L * 0.26, 0, a, 0);
      b.material = M.metalDark; g.add(b);
    }
    // 短翼挂架 / 座舱
    if (atk) {
      g.add(mesh(box(L * 0.5, L * 0.02, L * 0.1), body, 0, -L * 0.02, -L * 0.02));
      [1, -1].forEach(function (s) {
        g.add(mesh(cyl(L * 0.03, L * 0.03, L * 0.16, 8), M.metalDark, s * L * 0.22, -L * 0.05, 0, Math.PI / 2));
        for (var k = 0; k < 2; k++) g.add(mesh(cyl(L * 0.012, L * 0.012, L * 0.1, 6), M.olive, s * L * 0.22, -L * 0.05, -L * 0.06 + k * 0.4, Math.PI / 2));
      });
      g.add(mesh(sph(L * 0.05, 8), M.canopy, 0, L * 0.06, -L * 0.26, 0, 0, 0, 1, 0.8, 1.6));
      g.add(mesh(sph(L * 0.035, 8), M.metalDark, 0, -L * 0.06, -L * 0.34));  // 光电转塔
      if (P.id === 'AH-64E') g.add(mesh(cyl(L * 0.09, L * 0.09, L * 0.05, 10), M.radome, 0, L * 0.22, -L * 0.06));
    } else {
      g.add(mesh(box(L * 0.3, L * 0.06, L * 0.16), M.glass, 0, L * 0.03, -L * 0.3));
      g.add(mesh(box(L * 0.02, L * 0.09, L * 0.4), M.metalDark, L * 0.1, -L * 0.09, -L * 0.05));
      g.add(mesh(box(L * 0.02, L * 0.09, L * 0.4), M.metalDark, -L * 0.1, -L * 0.09, -L * 0.05));
    }
    return g;
  }
  function buildUAV(P, side) {
    var M = mats(), X = three();
    var stealth = /GJ-11/.test(P.id);
    var L = TWG.platformLen(P.id), span = TWG.platformSpan(P.id);
    var g = acBase(P, side), body = stealth ? M.stealth : tint(M.white, 0xb9c2c6);
    if (stealth) {
      // 飞翼构型
      var st = [];
      for (var i = 0; i < 6; i++) {
        var t = i / 5, z = -L / 2 + t * L;
        var hw = span / 2 * Math.pow(Math.sin(t * Math.PI * 0.85), 0.6);
        var th = L * 0.05 * (1 - t * 0.6);
        st.push({ z: z, pts: [[hw, 0], [hw * 0.6, th * 0.5], [0, th], [-hw * 0.6, th * 0.5], [-hw, 0], [-hw * 0.6, -th * 0.35], [0, -th * 0.6], [hw * 0.6, -th * 0.35]] });
      }
      g.add(mesh(loft(st, true, true), body, 0, 0, 0));
      g.add(mesh(box(L * 0.12, L * 0.04, L * 0.16), M.metalDark, 0, L * 0.05, L * 0.1));
    } else {
      g.add(mesh(fuseGeom(L, L * 0.1, L * 0.11, { tailR: 0.4 }), body, 0, 0, 0));
      [1, -1].forEach(function (s) {
        var w = mesh(wingGeom(L * 0.14, L * 0.07, span / 2, L * 0.02, L * 0.012, 2), body, 0, L * 0.02, 0);
        if (s < 0) w.scale.x = -1; g.add(w);
      });
      // V 尾
      [1, -1].forEach(function (s) {
        var v = mesh(wingGeom(L * 0.13, L * 0.05, L * 0.16, L * 0.07, L * 0.012, 0), body, 0, 0, L * 0.4);
        v.rotation.x = -Math.PI / 2; v.rotation.z = s * 0.6; if (s < 0) v.scale.x = -1;
        g.add(v);
      });
      g.add(mesh(sph(L * 0.06, 10), M.radome, 0, -L * 0.02, -L * 0.3, 0, 0, 0, 1, 0.85, 1.2));
      g.add(mesh(sph(L * 0.04, 8), M.metalDark, 0, -L * 0.06, -L * 0.12));
      if (P.id === 'GJ-2') pylonMissiles(g, L, span, 4, M.olive, -L * 0.04);
    }
    return g;
  }

  /* ======================= 地面装备 ==================================== */
  function buildTEL(P, side, kind) {
    var M = mats(), X = three(), g = new X.Group();
    var L = kind === 'big' ? 16 : kind === 'mlrs' ? 12 : 13, W = L * 0.28, H = L * 0.2;
    var bodyMat = side === 'ROC' ? M.olive : M.camo;
    g.add(truckChassis(L, W, H, kind === 'big' ? 5 : 4, bodyMat));
    if (kind === 'mlrs') {
      // 箱式火箭炮: 两个发射箱
      var pod = new X.Group();
      [-1, 1].forEach(function (s) {
        pod.add(mesh(box(W * 0.4, H * 0.9, L * 0.4), M.metalDark, s * W * 0.24, 0, 0));
        for (var r = 0; r < 2; r++) for (var c = 0; c < 2; c++)
          pod.add(mesh(cyl(W * 0.08, W * 0.08, L * 0.42, 8), M.nozzle, s * W * 0.24 + (c - 0.5) * W * 0.17, (r - 0.5) * H * 0.4, 0, Math.PI / 2));
      });
      pod.position.set(0, H * 1.2, L * 0.12); pod.rotation.x = -42 * RAD;
      g.add(pod);
    } else if (kind === 'sam') {
      // 4 联装筒式
      var lp = new X.Group();
      for (var i = 0; i < 4; i++) {
        lp.add(mesh(cyl(W * 0.13, W * 0.13, L * 0.52, 10), M.olive, (i % 2 - 0.5) * W * 0.32, (Math.floor(i / 2) - 0.5) * W * 0.32, 0, Math.PI / 2));
      }
      lp.position.set(0, H * 1.25, L * 0.1); lp.rotation.x = -62 * RAD;
      g.add(lp);
      g.add(mesh(box(W * 0.6, H * 0.5, L * 0.1), bodyMat, 0, H * 0.95, L * 0.36));
    } else {
      // 弹道/巡航导弹起竖筒
      var canN = kind === 'big' ? 1 : 2;
      var cg = new X.Group();
      for (var c2 = 0; c2 < canN; c2++) {
        var cx = canN === 2 ? (c2 - 0.5) * W * 0.42 : 0;
        cg.add(mesh(cyl(W * (canN === 2 ? 0.16 : 0.26), W * (canN === 2 ? 0.16 : 0.26), L * 0.72, 12), M.olive, cx, 0, 0, Math.PI / 2));
        cg.add(mesh(cyl(W * 0.05, W * 0.05, L * 0.06, 8), M.metalDark, cx, 0, -L * 0.39, Math.PI / 2));
      }
      cg.position.set(0, H * 1.35, L * 0.08); cg.rotation.x = -70 * RAD;
      g.add(cg);
      g.add(mesh(box(W * 0.9, H * 0.35, L * 0.2), M.metalDark, 0, H * 0.85, L * 0.3));
    }
    return g;
  }
  function buildTankUnit(P, side) {
    var M = mats(), X = three(), g = new X.Group();
    var L = 9.8, W = 3.6, H = 2.4;
    var body = side === 'ROC' ? M.olive : M.camo;
    g.add(mesh(box(W, H * 0.42, L), body, 0, H * 0.5, 0));
    g.add(mesh(box(W * 0.72, H * 0.3, L * 0.5), body, 0, H * 0.85, -L * 0.04));
    g.add(mesh(cyl(W * 0.06, W * 0.05, L * 0.62, 10), M.metalDark, 0, H * 0.9, -L * 0.52, Math.PI / 2));
    g.add(mesh(box(W * 0.1, H * 0.16, L * 0.06), M.metalDark, W * 0.2, H * 1.05, -L * 0.12));
    [1, -1].forEach(function (s) {
      g.add(mesh(box(W * 0.24, H * 0.36, L * 0.96), M.rubber, s * W * 0.42, H * 0.28, 0));
      for (var i = 0; i < 6; i++) g.add(mesh(cyl(H * 0.2, H * 0.2, W * 0.16, 10), M.metalDark, s * W * 0.42, H * 0.28, -L * 0.4 + i * L * 0.16, 0, 0, Math.PI / 2));
    });
    g.add(mesh(box(W * 0.5, H * 0.1, L * 0.1), M.metalDark, 0, H * 1.02, L * 0.16));
    return g;
  }
  function buildIFV(P, side) {
    var M = mats(), X = three(), g = new X.Group();
    var L = 7.2, W = 3.2, H = 2.3;
    var body = side === 'ROC' ? M.olive : M.camo;
    g.add(mesh(box(W, H * 0.5, L), body, 0, H * 0.55, 0));
    g.add(mesh(box(W * 0.9, H * 0.28, L * 0.4), body, 0, H * 0.9, -L * 0.2));
    g.add(mesh(cyl(W * 0.36, W * 0.3, H * 0.28, 10), body, 0, H * 1.05, L * 0.06));
    g.add(mesh(cyl(W * 0.035, W * 0.03, L * 0.3, 8), M.metalDark, 0, H * 1.08, -L * 0.16, Math.PI / 2));
    // 两栖战车: 首端滑水板
    if (/Amph|Marine/.test(P.id)) g.add(mesh(box(W * 0.86, H * 0.28, 0.3), M.metalDark, 0, H * 0.62, -L * 0.52, -22 * RAD, 0, 0));
    [1, -1].forEach(function (s) {
      for (var i = 0; i < 3; i++) g.add(mesh(cyl(H * 0.24, H * 0.24, W * 0.16, 10), M.rubber, s * W * 0.5, H * 0.28, -L * 0.32 + i * L * 0.32, 0, 0, Math.PI / 2));
    });
    return g;
  }
  function buildRadarUnit(P, side) {
    var M = mats(), X = three(), g = new X.Group();
    var big = /RADAR-ROC$|RADAR-PLA/.test(P.id);
    if (big) {
      // 固定式大型相控阵
      g.add(mesh(box(16, 5, 12), M.white, 0, 2.5, 0));
      var arr = mesh(box(14, 12, 1.2), side === 'ROC' ? M.radarPanelR : M.radarPanel, 0, 10, -4.5, -20 * RAD, 0, 0);
      g.add(arr);
      g.add(mesh(box(15, 1, 2), M.metalDark, 0, 4.4, -5.6));
      g.add(mesh(box(3, 6, 3), M.white, 8, 8, 3));
    } else {
      g.add(truckChassis(11, 3.2, 2.4, 3, side === 'ROC' ? M.olive : M.camo));
      var a2 = mesh(box(7.5, 4.6, 0.5), side === 'ROC' ? M.radarPanelR : M.radarPanel, 0, 5.0, 0.6, -14 * RAD, 0, 0);
      g.add(a2);
      g.add(mesh(cyl(0.35, 0.35, 2.6, 8), M.metalDark, 0, 3.4, 0.9));
      g.add(mesh(box(2.2, 1.6, 3.4), M.metalDark, 0, 2.6, -3.2));
    }
    return g;
  }
  function buildSamSite(P, side) {
    var M = mats(), X = three(), g = new X.Group();
    // 发射车 ×2 + 制导雷达
    var t1 = buildTEL(P, side, 'sam'); t1.position.set(-6, 0, 2); g.add(t1);
    var t2 = buildTEL(P, side, 'sam'); t2.position.set(6, 0, -2); t2.rotation.y = 0.25; g.add(t2);
    var r = buildRadarUnit({ id: 'mob' }, side); r.position.set(0, 0, 12); r.scale.set(0.85, 0.85, 0.85); g.add(r);
    return g;
  }
  function buildArtillery(P, side) {
    var M = mats(), X = three(), g = new X.Group();
    var L = 9.5, W = 3.4, H = 2.6;
    var body = side === 'ROC' ? M.olive : M.camo;
    g.add(mesh(box(W, H * 0.45, L), body, 0, H * 0.5, 0));
    g.add(mesh(box(W * 0.86, H * 0.42, L * 0.5), body, 0, H * 0.92, L * 0.1));
    g.add(mesh(cyl(W * 0.055, W * 0.045, L * 0.8, 10), M.metalDark, 0, H * 1.0, -L * 0.5, Math.PI / 2 - 6 * RAD));
    [1, -1].forEach(function (s) {
      g.add(mesh(box(W * 0.22, H * 0.34, L * 0.94), M.rubber, s * W * 0.42, H * 0.26, 0));
      for (var i = 0; i < 5; i++) g.add(mesh(cyl(H * 0.19, H * 0.19, W * 0.15, 10), M.metalDark, s * W * 0.42, H * 0.26, -L * 0.36 + i * L * 0.18, 0, 0, Math.PI / 2));
    });
    return g;
  }
  function buildInfantry(P, side) {
    var M = mats(), X = three(), g = new X.Group();
    var body = side === 'ROC' ? M.olive : M.camo;
    // 工事化阵地: 掩体 + 沙袋 + 车辆
    g.add(mesh(box(16, 1.2, 10), M.sand, 0, 0.6, 0));
    for (var i = 0; i < 5; i++) g.add(mesh(box(2.4, 1.0, 1.2), M.sand, -6 + i * 3, 1.6, -5.2));
    g.add(mesh(box(5, 2.2, 4), M.deckDark, -4, 1.7, 1));
    var v = buildIFV({ id: 'x' }, side); v.position.set(4.5, 0, 1); v.rotation.y = 0.4; v.scale.set(0.85, 0.85, 0.85); g.add(v);
    var t = truckChassis(8, 2.8, 2.2, 3, body); t.position.set(-1, 0, 5.5); t.rotation.y = 0.2; g.add(t);
    return g;
  }
  function buildBeachhead(P, side) {
    var M = mats(), X = three(), g = new X.Group();
    g.add(mesh(box(26, 0.8, 14), tint(M.sand, 0x8a7f61), 0, 0.4, 0));
    for (var i = 0; i < 4; i++) {
      var v = buildIFV({ id: 'Amph' }, 'PLA');
      v.position.set(-9 + i * 6, 0, -3 + (i % 2) * 5); v.rotation.y = 0.1 * i; g.add(v);
    }
    var t = buildTankSmall(8); t.position.set(8, 0, 4); g.add(t);
    for (var k = 0; k < 3; k++) g.add(mesh(box(2.6, 1.4, 1.6), M.olive, -11 + k * 2.9, 1.2, 5.4));
    g.add(mesh(box(4, 2.4, 3), M.camo, 10, 1.4, -4));
    return g;
  }

  /* ======================= 分发 ======================================== */
  var CACHE = {};
  function buildFor(cls) {
    var P = TWG.PLATFORMS[cls];
    if (!P) return null;
    var side = P.side, r = P.role, X = three();
    var g;
    switch (P.domain) {
      case 'surface':
        if (r === 'cv') g = buildCarrier(P, side);
        else if (r === 'lhd' || r === 'lha') g = buildLHD(P, side);
        else if (r === 'lpd') g = buildLPD(P, side);
        else if (r === 'lst' || r === 'lsm') g = buildLST(P, side);
        else if (r === 'barge') g = buildBarge(P, side);
        else if (r === 'sealift') g = buildSealift(P, side);
        else if (r === 'ccg') g = buildCCG(P, side);
        else if (r === 'militia') g = buildMilitia(P, side);
        else if (r === 'fac') g = buildFAC(P, side);
        else if (r === 'corvette' || r === 'patrol' || r === 'minelayer') g = (P.len || 60) < 70 ? buildFAC(P, side) : buildCombatant(P, side);
        else g = buildCombatant(P, side);
        break;
      case 'sub': g = buildSub(P, side); break;
      case 'air':
        if (P.helo) g = buildHelo(P, side);
        else if (P.uav) g = buildUAV(P, side);
        else if (r === 'aew') g = buildAEW(P, side);
        else if (r === 'bomber') g = buildBomber(P, side);
        else if (r === 'transport' || r === 'asw' || r === 'elint') g = buildTransport(P, side);
        else g = buildFighter(P, side, (P.gen >= 5 || /J-10|Mirage|IDF/.test(cls)) ? 'delta' : 'conv');
        break;
      case 'ground':
        if (r === 'srbm_bde' || r === 'hgv_bde' || r === 'asbm_bde') g = buildTEL(P, side, 'big');
        else if (r === 'lacm_bde' || r === 'lacm_bn') g = buildTEL(P, side, 'lacm');
        else if (r === 'mlrs_bde' || r === 'mlrs_bn') g = buildTEL(P, side, 'mlrs');
        else if (r === 'ashm_bn') g = buildTEL(P, side, 'lacm');
        else if (r === 'arty_bn') g = buildArtillery(P, side);
        else if (r === 'armor_bde' || r === 'heavy_bde') g = buildTankUnit(P, side);
        else if (r === 'mech_bde' || r === 'amph_bde' || r === 'marine_bde' || r === 'airborne_bde') g = buildIFV(P, side);
        else if (r === 'beachhead') g = buildBeachhead(P, side);
        else g = buildInfantry(P, side);
        break;
      case 'sam': g = buildSamSite(P, side); break;
      case 'radar': g = buildRadarUnit(P, side); break;
      default: g = buildInfantry(P, side);
    }
    // 归一化: 记录包围盒
    var bb = new X.Box3().setFromObject(g);
    var size = new X.Vector3(); bb.getSize(size);
    var center = new X.Vector3(); bb.getCenter(center);
    g.userData.bbox = { size: { x: size.x, y: size.y, z: size.z }, center: { x: center.x, y: center.y, z: center.z } };
    g.userData.cls = cls;
    var tri = 0;
    g.traverse(function (o) { if (o.geometry && o.geometry.index) tri += o.geometry.index.count / 3; });
    g.userData.tris = Math.round(tri);
    return g;
  }

  TWG.M3D = {
    available: ok,
    /** 取得模型（带缓存，返回 clone 以便多处使用） */
    get: function (cls, fresh) {
      if (!ok()) return null;
      if (!CACHE[cls]) {
        try { CACHE[cls] = buildFor(cls); }
        catch (e) { CACHE[cls] = null; if (root.console) console.warn('M3D build failed', cls, e); }
      }
      if (!CACHE[cls]) return null;
      return fresh ? CACHE[cls].clone(true) : CACHE[cls];
    },
    info: function (cls) {
      var m = this.get(cls);
      return m ? m.userData : null;
    },
    clear: function () { CACHE = {}; MATS = null; },
    /* 供外部复用的零件 */
    parts: { loft: loft, hullGeom: hullGeom, fuseGeom: fuseGeom, wingGeom: wingGeom, missile: missile, mats: mats }
  };
})(typeof window !== 'undefined' ? window : globalThis);
