/* ============================================================================
 * rv.js —— 沃尔特的房车（Fleetwood Bounder 风格 C 型/A 型房车）三维模型
 *   坐标：+X 车头 / +Y 上 / +Z 右侧（车门侧）；单位：米
 *   分组：ground chassis shellNear shellFar roof front rear glass
 *        interior lab cab props emissive
 *   剖切视图 = 隐藏 shellNear + roof（+ 近侧玻璃），露出内部实验室场景
 * ==========================================================================*/
(function (root, factory) {
  const MESH = (typeof module !== 'undefined' && typeof require === 'function') ? require('./mesh.js') : root.MESH;
  const api = factory(MESH);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.RVMODEL = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (MESH) {
  'use strict';
  const TAU = Math.PI * 2, PI = Math.PI;

  /* ------------------------------- 配色 ------------------------------- */
  const C = {
    bodyCream: [0.82, 0.78, 0.68],     // 车身米白（做旧发黄）
    bodyDirty: [0.66, 0.62, 0.52],
    stripeBrown: [0.42, 0.28, 0.18],
    stripeTan: [0.68, 0.50, 0.30],
    roofWhite: [0.80, 0.79, 0.74],
    metalDark: [0.24, 0.24, 0.26],
    metalMid: [0.55, 0.56, 0.58],
    chrome: [0.78, 0.80, 0.84],
    rubber: [0.10, 0.10, 0.11],
    glassBlue: [0.30, 0.42, 0.48],
    glassClear: [0.72, 0.82, 0.86],
    interiorWall: [0.74, 0.70, 0.60],
    woodCab: [0.40, 0.27, 0.17],
    counterTop: [0.52, 0.50, 0.46],
    floorLino: [0.44, 0.40, 0.34],
    seatBrown: [0.36, 0.26, 0.19],
    cushionTan: [0.55, 0.45, 0.34],
    barrelBlue: [0.14, 0.30, 0.52],
    barrelWhite: [0.80, 0.80, 0.78],
    glassLab: [0.80, 0.90, 0.92],
    liquidAmber: [0.72, 0.45, 0.12],
    crystalBlue: [0.45, 0.72, 0.88],
    flameBlue: [0.35, 0.62, 1.0],
    plasticRed: [0.62, 0.10, 0.08],
    sand: [0.70, 0.60, 0.44],
    sandDark: [0.52, 0.44, 0.33],
    rock: [0.42, 0.38, 0.34],
    scrub: [0.34, 0.36, 0.22],
    lampWarm: [1.0, 0.86, 0.62]
  };
  const jitter = (c, a, rnd) => [
    Math.max(0, Math.min(1, c[0] + (rnd() - 0.5) * a)),
    Math.max(0, Math.min(1, c[1] + (rnd() - 0.5) * a)),
    Math.max(0, Math.min(1, c[2] + (rnd() - 0.5) * a))];
  function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

  /* ------------------------------- 尺寸 ------------------------------- */
  const D = {
    xRear: -3.95, xFront: 3.55, xNose: 3.98,
    halfW: 1.22, floorY: 0.74, wallTop: 2.42, roofY: 2.62,
    wheelR: 0.42, wheelW: 0.24,
    axleFront: 2.45, axleRear: -2.05
  };

  /* --------------------- 车身横截面（顺时针 => 外法线朝外）--------------------- */
  function bodyProfile(inset) {
    const p = [];
    const hz = D.halfW - inset, top = D.wallTop - inset * 0.4, roof = D.roofY - inset * 0.5;
    const bot = D.floorY + inset * 0.6;
    const rc = 0.30 - inset * 0.3;                 // 车顶圆角
    const seg = 6;
    // 车顶：中间 -> 右上圆角
    p.push([0, roof]);
    p.push([hz - rc - 0.24, roof]);
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * (PI / 2);
      p.push([hz - rc + Math.sin(a) * rc, top - 0.02 + Math.cos(a) * (roof - top + 0.02)]);
    }
    // 右墙（略外凸）
    for (let i = 1; i <= 5; i++) {
      const t = i / 5, y = top - 0.02 - t * (top - 0.02 - (bot + 0.34));
      const bulge = Math.sin(t * PI) * 0.022;
      p.push([hz + bulge, y]);
    }
    // 右下裙边圆角
    for (let i = 0; i <= 4; i++) {
      const a = (i / 4) * (PI / 2);
      p.push([hz - 0.16 + Math.cos(a) * 0.16, bot + 0.18 - Math.sin(a) * 0.18]);
    }
    // 底面
    p.push([0.5, bot]);
    p.push([-0.5, bot]);
    // 左下裙边圆角
    for (let i = 0; i <= 4; i++) {
      const a = (i / 4) * (PI / 2);
      p.push([-(hz - 0.16) - Math.sin(a) * 0.16, bot + 0.18 * (1 - Math.cos(a))]);
    }
    // 左墙
    for (let i = 1; i <= 5; i++) {
      const t = 1 - i / 5, y = bot + 0.34 + (1 - t) * (top - 0.02 - (bot + 0.34));
      const bulge = Math.sin((1 - t) * PI) * 0.022;
      void t;
      p.push([-(hz + bulge), y]);
    }
    // 左上圆角 -> 车顶
    for (let i = 0; i <= seg; i++) {
      const a = (PI / 2) * (1 - i / seg);
      p.push([-(hz - rc) - Math.sin(a) * rc, top - 0.02 + Math.cos(a) * (roof - top + 0.02)]);
    }
    p.push([-(hz - rc - 0.24), roof]);
    return p;
  }

  /* ============================ 组件构建函数 ============================ */
  // 车轮：胎面用旋成体+胎块，轮辋用旋成体+螺母
  function wheel(b, dual, rnd) {
    const R = D.wheelR, W = D.wheelW;
    b.group('chassis');
    b.color(C.rubber).material(0.85, 0.0);
    // 轮胎断面（旋成体，绕 Y；随后整体旋转到绕 Z）
    const tp = [];
    tp.push([R - 0.13, -W / 2]);
    tp.push([R - 0.02, -W / 2 + 0.03]);
    tp.push([R, -W / 2 + 0.07]);
    tp.push([R, W / 2 - 0.07]);
    tp.push([R - 0.02, W / 2 - 0.03]);
    tp.push([R - 0.13, W / 2]);
    b.push(); b.rotateX(PI / 2);
    b.lathe(tp, 44);
    b.pop();
    // 胎面花纹块
    b.color([0.13, 0.13, 0.14]);
    const blocks = 30;
    for (let i = 0; i < blocks; i++) {
      const a = (i / blocks) * TAU;
      b.push();
      b.rotateZ(a); b.translate(R + 0.005, 0, 0); b.rotateY(0.1 * ((i % 2) ? 1 : -1));
      b.roundedBox(0.035, 0.09, W - 0.09, 0.012, 2);
      b.pop();
    }
    // 轮辋
    b.color(C.metalMid).material(0.35, 0.85);
    b.push(); b.rotateX(PI / 2);
    b.lathe([[0.05, -W / 2 + 0.02], [R - 0.14, -W / 2 + 0.03], [R - 0.11, -0.02], [R - 0.11, 0.04],
      [R - 0.15, W / 2 - 0.02], [0.06, W / 2 - 0.02], [0.05, -W / 2 + 0.02]], 26);
    b.pop();
    // 轮毂盖 + 螺母
    b.color(C.chrome).material(0.2, 0.95);
    b.push(); b.rotateX(PI / 2); b.translate(0, dual ? -W / 2 - 0.01 : W / 2 + 0.01, 0);
    b.lathe([[0, 0.03], [0.06, 0.035], [0.10, 0.02], [0.115, -0.01], [0.05, -0.02], [0, -0.02]], 20);
    b.pop();
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU;
      b.push();
      b.translate(Math.cos(a) * 0.17, Math.sin(a) * 0.17, (dual ? -1 : 1) * (W / 2 - 0.01));
      b.rotateX(PI / 2);
      b.cylinder(0.022, 0.02, 0.035, 6);
      b.pop();
    }
    void rnd;
  }

  // 车灯：透镜（旋成体）+ 灯壳 + 自发光
  function lamp(b, r, depth, colr, emis) {
    b.color(colr).material(0.25, 0.1, emis);
    b.push(); b.rotateZ(-PI / 2);
    b.lathe([[0, 0], [r * 0.7, 0.004], [r, depth * 0.35], [r * 0.98, depth], [r * 0.6, depth * 1.05], [0, depth * 1.02]], 18);
    b.pop();
    b.color(C.chrome).material(0.3, 0.9);
    b.push(); b.rotateZ(-PI / 2); b.translate(0, depth * 1.02, 0);
    b.lathe([[r * 0.6, 0], [r * 1.06, 0.01], [r * 1.06, 0.05], [r * 0.9, 0.05]], 18);
    b.pop();
  }

  // 座椅（船长椅）：底座 + 坐垫 + 靠背 + 头枕 + 扶手，全圆角
  function seat(b, rnd) {
    b.color(C.metalDark).material(0.5, 0.6);
    b.push(); b.translate(0, 0.10, 0); b.cylinder(0.16, 0.10, 0.20, 16); b.pop();
    b.push(); b.translate(0, 0.02, 0); b.cylinder(0.22, 0.20, 0.04, 18); b.pop();
    b.push(); b.translate(0, 0.28, 0); b.cylinder(0.07, 0.07, 0.30, 12); b.pop();
    b.color(jitter(C.seatBrown, 0.06, rnd)).material(0.85, 0.0);
    b.push(); b.translate(0, 0.46, 0); b.roundedBox(0.52, 0.14, 0.50, 0.06, 3); b.pop();       // 坐垫
    b.push(); b.translate(-0.20, 0.76, 0); b.rotateZ(0.12); b.roundedBox(0.14, 0.56, 0.48, 0.06, 3); b.pop(); // 靠背
    b.push(); b.translate(-0.24, 1.10, 0); b.rotateZ(0.16); b.roundedBox(0.13, 0.20, 0.30, 0.06, 3); b.pop(); // 头枕
    for (const s of [-1, 1]) {
      b.push(); b.translate(-0.02, 0.62, s * 0.28); b.rotateX(0);
      b.roundedBox(0.30, 0.08, 0.09, 0.035, 3); b.pop();
    }
  }

  // 圆底烧瓶（球体+瓶颈+磨口）
  function flask(b, r) {
    b.color(C.glassLab).material(0.08, 0.0);
    b.group('glass');
    b.push(); b.translate(0, r, 0); b.sphere(r, 32, 22); b.pop();
    b.push(); b.translate(0, r * 2, 0); b.cylinder(r * 0.30, r * 0.32, r * 0.85, 18, { caps: false }); b.pop();
    b.push(); b.translate(0, r * 2.45, 0); b.lathe([[r * 0.32, 0], [r * 0.40, 0.01], [r * 0.40, 0.05], [r * 0.30, 0.055]], 18); b.pop();
    b.group('lab');
    // 瓶内液体
    b.color(C.liquidAmber).material(0.15, 0.0, 0.05);
    b.push(); b.translate(0, r * 0.92, 0); b.sphere(r * 0.86, 22, 14, { t0: PI * 0.42, t1: PI }); b.pop();
    b.push(); b.translate(0, r * 0.92 - r * 0.86 * Math.cos(PI * 0.42), 0);
    b.cylinder(r * 0.86 * Math.sin(PI * 0.42), r * 0.86 * Math.sin(PI * 0.42), 0.001, 22); b.pop();
  }

  // 锥形瓶
  function erlenmeyer(b, r, h) {
    b.group('glass'); b.color(C.glassLab).material(0.08, 0.0);
    b.lathe([[0, 0], [r, 0.004], [r, 0.02], [r * 0.30, h * 0.72], [r * 0.30, h], [r * 0.36, h + 0.012], [r * 0.30, h + 0.02]], 22);
    b.group('lab');
  }

  // 烧杯
  function beaker(b, r, h) {
    b.group('glass'); b.color(C.glassLab).material(0.08, 0.0);
    b.lathe([[0, 0], [r, 0.003], [r, h], [r * 1.06, h + 0.006], [r * 0.96, h + 0.008], [r * 0.96, 0.01]], 20);
    b.group('lab');
  }

  // 冷凝管：外玻璃管 + 内螺旋盘管 + 两个接管嘴
  function condenser(b, len) {
    b.group('glass'); b.color(C.glassLab).material(0.06, 0.0);
    b.push(); b.cylinder(0.055, 0.055, len, 20, { caps: false }); b.pop();
    b.push(); b.translate(0, len / 2, 0); b.lathe([[0.055, 0], [0.062, 0.006], [0.03, 0.03], [0.03, 0.08]], 18); b.pop();
    b.push(); b.translate(0, -len / 2, 0); b.lathe([[0.03, -0.08], [0.03, -0.03], [0.062, -0.006], [0.055, 0]], 18); b.pop();
    // 内盘管
    b.color([0.86, 0.94, 0.96]).material(0.05, 0.0);
    b.push(); b.helixTube(0.030, 0.009, 7, len * 0.86, 26, 7); b.pop();
    // 接管嘴
    b.color(C.glassLab);
    for (const s of [-1, 1]) {
      b.push(); b.translate(0, s * len * 0.32, 0); b.rotateZ(PI / 2 * s * 0.0); b.rotateX(PI / 2);
      b.cylinder(0.013, 0.011, 0.07, 10); b.pop();
    }
    b.group('lab');
  }

  // 化学桶（带箍圈与盖）
  function barrel(b, r, h, colr, rnd) {
    b.color(jitter(colr, 0.05, rnd)).material(0.55, 0.0);
    b.lathe([[0, 0], [r * 0.92, 0], [r * 0.96, 0.03], [r, 0.09],
      [r, h - 0.09], [r * 0.96, h - 0.03], [r * 0.92, h], [0, h]], 26);
    b.color([colr[0] * 0.8, colr[1] * 0.8, colr[2] * 0.8]);
    [0.28, 0.55, 0.82].forEach(t => {
      b.push(); b.translate(0, h * t, 0); b.rotateX(PI / 2); b.torus(r + 0.005, 0.018, 26, 8); b.pop();
    });
    b.color(C.metalMid).material(0.4, 0.7);
    b.push(); b.translate(r * 0.45, h + 0.005, 0); b.cylinder(0.05, 0.05, 0.02, 12); b.pop();
    b.push(); b.translate(-r * 0.4, h + 0.005, r * 0.2); b.cylinder(0.035, 0.035, 0.018, 10); b.pop();
    b.color(C.barrelWhite).material(0.6, 0.0);
    b.push(); b.translate(0, h * 0.55, r + 0.008); b.rotateX(-PI / 2);
    b.plane(r * 1.1, h * 0.34, 1, 1); b.pop();
  }

  // 防毒面具（面罩 + 滤罐 + 背带）
  function gasMask(b) {
    b.color([0.20, 0.22, 0.20]).material(0.7, 0.0);
    b.push(); b.scale(1, 1.15, 0.8); b.sphere(0.115, 20, 14); b.pop();
    b.color(C.glassClear).material(0.1, 0.0);
    b.push(); b.translate(0.075, 0.02, 0); b.rotateZ(-PI / 2); b.scale(1, 1, 0.85);
    b.lathe([[0, 0], [0.062, 0.004], [0.066, 0.02], [0.05, 0.028]], 18); b.pop();
    b.color([0.16, 0.17, 0.16]).material(0.75, 0.0);
    for (const s of [-1, 1]) {
      b.push(); b.translate(0.02, -0.07, s * 0.085); b.rotateX(PI / 2 * 0.15 * s);
      b.cylinder(0.048, 0.05, 0.075, 16); b.pop();
    }
    // 背带
    b.color([0.22, 0.20, 0.17]).material(0.9, 0.0);
    const strap = MESH.spline([[-0.09, 0.06, 0.08], [-0.16, 0.16, 0.05], [-0.14, 0.26, 0], [-0.16, 0.16, -0.05], [-0.09, 0.06, -0.08]], 6);
    b.tube(strap, 0.012, 6);
  }

  // 灭火器
  function extinguisher(b) {
    b.color(C.plasticRed).material(0.45, 0.2);
    b.lathe([[0, 0], [0.085, 0.01], [0.09, 0.05], [0.09, 0.42], [0.07, 0.47], [0.035, 0.49], [0.035, 0.52], [0, 0.52]], 20);
    b.color(C.metalMid).material(0.35, 0.8);
    b.push(); b.translate(0, 0.545, 0); b.cylinder(0.028, 0.026, 0.06, 12); b.pop();
    b.push(); b.translate(0.03, 0.575, 0); b.rotateZ(0.2); b.roundedBox(0.10, 0.02, 0.03, 0.008, 2); b.pop();
    b.color([0.12, 0.12, 0.12]).material(0.8, 0.0);
    b.tube(MESH.spline([[0.02, 0.55, 0.02], [0.14, 0.44, 0.08], [0.12, 0.22, 0.02], [0.05, 0.12, -0.02]], 6), 0.014, 8);
    b.color([0.92, 0.90, 0.86]).material(0.6, 0.0);
    b.push(); b.translate(0.0, 0.3, 0.091); b.rotateX(-PI / 2); b.plane(0.09, 0.12, 1, 1); b.pop();
  }

  // 塑料桶/试剂瓶
  function jug(b, h, colr) {
    b.color(colr).material(0.4, 0.0);
    b.lathe([[0, 0], [0.085, 0.005], [0.09, 0.03], [0.088, h * 0.72], [0.06, h * 0.86], [0.032, h * 0.9],
      [0.032, h], [0.04, h + 0.012], [0.03, h + 0.02]], 18);
    b.color([0.9, 0.9, 0.88]).material(0.5, 0.0);
    b.push(); b.translate(0, h * 0.45, 0.091); b.rotateX(-PI / 2); b.plane(0.09, h * 0.4, 1, 1); b.pop();
  }

  // 柜门（带把手与门缝）
  function cabinetDoors(b, w, h, d, n, colr) {
    b.color(colr).material(0.55, 0.05);
    const gap = 0.012, dw = (w - gap * (n + 1)) / n;
    for (let i = 0; i < n; i++) {
      const z = -w / 2 + gap * (i + 1) + dw * (i + 0.5);
      b.push(); b.translate(d / 2, 0, z); b.roundedBox(0.022, h - gap * 2, dw, 0.008, 2); b.pop();
      b.color(C.chrome).material(0.3, 0.9);
      b.push(); b.translate(d / 2 + 0.02, -h * 0.28, z + dw * 0.32); b.rotateZ(PI / 2);
      b.tube([[0, 0, 0], [0.03, 0, 0], [0.03, 0.07, 0], [0, 0.07, 0]].map(p => [p[0], p[1], p[2]]), 0.007, 8);
      b.pop();
      b.color(colr).material(0.55, 0.05);
    }
  }

  /* ============================ 主构建 ============================ */
  function build() {
    const b = MESH.createBuilder();
    const rnd = rng(20080120);

    /* ---------------- 环境：沙地、石块、灌木 ---------------- */
    b.group('ground').part('desert', 'env');
    b.color(C.sand).material(0.95, 0.0);
    b.push(); b.translate(0, 0, 0);
    const GS = 46, GN = 52;
    for (let i = 0; i < GN; i++) for (let j = 0; j < GN; j++) {
      const x0 = -GS / 2 + GS * i / GN, x1 = -GS / 2 + GS * (i + 1) / GN;
      const z0 = -GS / 2 + GS * j / GN, z1 = -GS / 2 + GS * (j + 1) / GN;
      const hAt = (x, z) => Math.sin(x * 0.22) * 0.10 + Math.cos(z * 0.19) * 0.09 + Math.sin((x + z) * 0.07) * 0.16;
      const near = Math.hypot((x0 + x1) / 2, (z0 + z1) / 2) < 6.5;
      const shade = near ? 0.0 : 0.08;
      b.color(jitter([C.sand[0] - shade, C.sand[1] - shade, C.sand[2] - shade], 0.07, rnd));
      const A = [x0, hAt(x0, z0) * (near ? 0.25 : 1), z0], B = [x0, hAt(x0, z1) * (near ? 0.25 : 1), z1];
      const Cc = [x1, hAt(x1, z1) * (near ? 0.25 : 1), z1], Dd = [x1, hAt(x1, z0) * (near ? 0.25 : 1), z0];
      const n = [0, 1, 0];
      b.quad(A, B, Cc, Dd, n, n, n, n);
    }
    b.pop();
    b.endPart();
    b.part('rocks', 'env');
    for (let i = 0; i < 16; i++) {
      const a = rnd() * TAU, r = 7 + rnd() * 13;
      const x = Math.cos(a) * r, z = Math.sin(a) * r, s = 0.20 + rnd() * 0.55;
      b.color(jitter(C.rock, 0.10, rnd)).material(0.9, 0.0);
      b.push(); b.translate(x, s * 0.35, z); b.rotateY(rnd() * TAU); b.scale(s, s * 0.7, s * 0.85);
      const before = b.vertexCount();
      b.sphere(1, 9, 6);
      b.distortLast(b.vertexCount() - before, 0.22, 3.5 + rnd() * 3, rnd() * 10);
      b.pop();
    }
    for (let i = 0; i < 12; i++) {
      const a = rnd() * TAU, r = 6 + rnd() * 14;
      b.color(jitter(C.scrub, 0.12, rnd)).material(0.9, 0.0);
      b.push(); b.translate(Math.cos(a) * r, 0.16, Math.sin(a) * r); b.scale(1, 0.8, 1);
      const before = b.vertexCount();
      b.sphere(0.35 + rnd() * 0.3, 8, 5);
      b.distortLast(b.vertexCount() - before, 0.35, 9, rnd() * 8);
      b.pop();
    }
    b.endPart();
    // 轮胎压痕
    b.part('tracks', 'env').color(C.sandDark).material(0.95, 0);
    for (const s of [-1, 1]) {
      b.push(); b.translate(-14, 0.012, s * 1.05); b.rotateY(0.02 * s);
      b.plane(20, 0.30, 20, 1); b.pop();
    }
    b.endPart();

    /* ---------------- 底盘 ---------------- */
    b.group('chassis').part('chassisFrame', 'struct');
    b.color(C.metalDark).material(0.7, 0.5);
    for (const s of [-1, 1]) {
      b.push(); b.translate(-0.1, 0.52, s * 0.62); b.roundedBox(7.4, 0.16, 0.12, 0.03, 2); b.pop();
    }
    for (let i = 0; i < 7; i++) {
      b.push(); b.translate(-3.3 + i * 1.15, 0.50, 0); b.roundedBox(0.10, 0.10, 1.28, 0.025, 2); b.pop();
    }
    // 前后保险杠支架 + 拖车钩
    b.push(); b.translate(D.xRear + 0.05, 0.42, 0); b.roundedBox(0.20, 0.12, 1.4, 0.03, 2); b.pop();
    b.endPart();
    b.part('axles', 'struct');
    b.color(C.metalMid).material(0.6, 0.7);
    for (const ax of [D.axleFront, D.axleRear]) {
      b.push(); b.translate(ax, D.wheelR, 0); b.rotateX(PI / 2); b.cylinder(0.055, 0.055, 2.30, 14); b.pop();
    }
    b.push(); b.translate(D.axleRear, D.wheelR, 0); b.sphere(0.17, 16, 10); b.pop();
    b.push(); b.translate(0.4, D.wheelR + 0.02, 0); b.rotateZ(PI / 2); b.cylinder(0.045, 0.045, 3.6, 12); b.pop();
    // 钢板弹簧（弯曲管）
    b.color(C.metalDark).material(0.75, 0.4);
    for (const ax of [D.axleFront, D.axleRear]) for (const s of [-1, 1]) {
      const sp = MESH.spline([[ax - 0.75, 0.50, s * 0.66], [ax - 0.3, 0.44, s * 0.66], [ax, 0.42, s * 0.66], [ax + 0.3, 0.44, s * 0.66], [ax + 0.75, 0.50, s * 0.66]], 5);
      b.tube(sp, 0.030, 6);
    }
    b.endPart();
    b.part('exhaust', 'struct');
    b.color(C.metalMid).material(0.5, 0.8);
    b.push(); b.translate(0.9, 0.40, -0.45); b.rotateZ(PI / 2); b.cylinder(0.09, 0.09, 0.55, 14); b.pop();
    b.tube(MESH.spline([[1.7, 0.42, -0.42], [0.9, 0.40, -0.45], [-0.6, 0.38, -0.52], [-2.2, 0.36, -0.62], [-3.6, 0.34, -0.75], [-4.05, 0.33, -0.78]], 6), 0.035, 10, { caps: true });
    b.endPart();
    b.part('fuelTank', 'struct').color([0.30, 0.30, 0.32]).material(0.7, 0.3);
    b.push(); b.translate(-0.9, 0.42, 0.55); b.roundedBox(1.5, 0.28, 0.75, 0.08, 3); b.pop();
    b.endPart();
    b.part('propaneTank', 'struct').color([0.86, 0.86, 0.84]).material(0.5, 0.2);
    b.push(); b.translate(1.5, 0.42, 0.62); b.rotateZ(PI / 2); b.capsule(0.19, 0.62, 18); b.pop();
    b.color(C.metalMid).material(0.4, 0.8);
    b.push(); b.translate(1.86, 0.42, 0.62); b.rotateZ(PI / 2); b.cylinder(0.05, 0.05, 0.07, 10); b.pop();
    b.endPart();
    b.part('spare', 'struct').color(C.rubber).material(0.85, 0);
    b.push(); b.translate(-3.55, 0.62, 0.0); b.rotateY(PI / 2); b.rotateX(PI / 2); b.torus(0.33, 0.11, 22, 10); b.pop();
    b.endPart();

    /* ---------------- 车轮 ×6 ---------------- */
    const wheels = [
      [D.axleFront, 1.10, false], [D.axleFront, -1.10, false],
      [D.axleRear, 0.86, true], [D.axleRear, 1.14, false],
      [D.axleRear, -0.86, true], [D.axleRear, -1.14, false]
    ];
    wheels.forEach((w, i) => {
      b.part('wheel' + (i + 1), i === 0 ? 'hot' : 'part');
      b.push(); b.translate(w[0], D.wheelR, w[1]); b.rotateY(w[1] > 0 ? 0 : PI); b.rotateX(rnd() * 0.4);
      wheel(b, w[2], rnd);
      b.pop();
      b.endPart();
    });

    /* ---------------- 车身外壳（圆角轮廓沿 X 挤出）---------------- */
    b.part('bodyShell', 'body');
    b.color(C.bodyCream).material(0.62, 0.08);
    const prof = bodyProfile(0);
    const shellStartV = b.vertexCount();
    b.extrudeProfile(prof, D.xRear, D.xFront, {
      steps: 58,
      scaleFn: t => {                                   // 车头略收窄、车顶略前倾
        const s = 1 - Math.pow(Math.max(0, t - 0.72) / 0.28, 2) * 0.035;
        return [s, 1 - Math.pow(Math.max(0, t - 0.80) / 0.20, 2) * 0.02];
      },
      groupFn: (a, c) => {
        const y = (a[1] + c[1]) / 2, z = (a[0] + c[0]) / 2;
        if (y > D.wallTop - 0.03) return 'roof';
        if (y < D.floorY + 0.30 && Math.abs(z) < 1.0) return 'chassis';
        return z > 0 ? 'shellNear' : 'shellFar';
      }
    });
    // 做旧：轻微凹陷与起皱
    b.distortLast(b.vertexCount() - shellStartV, 0.012, 2.2, 3.7);
    b.endPart();

    // 内壁（同轮廓内缩、法线翻转）
    b.group('interior').part('interiorShell', 'body');
    b.color(C.interiorWall).material(0.75, 0.0);
    b.extrudeProfile(bodyProfile(0.055), D.xRear + 0.06, D.xFront - 0.02, {
      steps: 36, flip: true,
      scaleFn: t => [1 - Math.pow(Math.max(0, t - 0.72) / 0.28, 2) * 0.035, 1],
      groupFn: (a, c) => {                        // 与外壳同样分段，剖切时一并移除
        const y = (a[1] + c[1]) / 2, z = (a[0] + c[0]) / 2;
        if (y > D.wallTop - 0.10) return 'roof';
        if (y < D.floorY + 0.35 && Math.abs(z) < 1.05) return 'interior';
        return z > 0 ? 'shellNear' : 'interior';
      }
    });
    b.endPart();
    // 地板
    b.part('floor', 'body').color(C.floorLino).material(0.55, 0.0);
    b.push(); b.translate(-0.2, D.floorY + 0.015, 0);
    for (let i = 0; i < 24; i++) for (let j = 0; j < 8; j++) {
      const w = 7.0 / 24, d = 2.24 / 8;
      b.color(jitter(C.floorLino, 0.05, rnd));
      b.push(); b.translate(-3.5 + w * (i + 0.5), 0, -1.12 + d * (j + 0.5)); b.plane(w * 0.97, d * 0.97, 1, 1); b.pop();
    }
    b.pop();
    b.endPart();

    /* ---------------- 车头：挡风玻璃、前脸、灯 ---------------- */
    b.group('front').part('noseCap', 'body');
    b.color(C.bodyCream).material(0.6, 0.08);
    // 前脸：挡风玻璃区域留空，只做下半段围板与车顶前唇（否则会挡住驾驶室视线）
    const fullProf = bodyProfile(0.02);
    const lower = fullProf.filter(p => p[1] < 1.62);          // 腰线以下（含底部）
    const upper = fullProf.filter(p => p[1] > D.wallTop - 0.12); // 车顶前唇
    b.extrudeProfile(lower, D.xFront - 0.02, D.xNose, {
      steps: 8, closed: false,
      scaleFn: t => [1 - t * t * 0.10, 1 - t * 0.06]
    });
    b.extrudeProfile(upper, D.xFront - 0.02, D.xNose - 0.16, {
      steps: 5, closed: false,
      scaleFn: t => [1 - t * t * 0.10, 1 - t * 0.03]
    });
    // 前脸下缘封板
    b.push(); b.translate(D.xNose - 0.01, 1.18, 0); b.rotateY(PI / 2);
    b.roundedBox(2.26, 0.86, 0.06, 0.05, 3); b.pop();
    // A 柱
    for (const s2 of [-1, 1]) {
      b.push(); b.translate(D.xNose - 0.22, 1.94, s2 * 1.16); b.rotateZ(-0.26); b.rotateY(s2 * 0.12);
      b.roundedBox(0.14, 1.05, 0.13, 0.05, 3); b.pop();
    }
    b.endPart();
    // 挡风玻璃（两片，带中柱与倾斜）
    b.group('glass').part('windshield', 'glass');
    b.color(C.glassBlue).material(0.06, 0.1);
    for (const s of [-1, 1]) {
      b.push();
      b.translate(D.xNose - 0.30, 1.90, s * 0.60);
      b.rotateZ(-0.30); b.rotateY(s * 0.10);
      b.roundedBox(0.03, 0.86, 1.05, 0.03, 2);
      b.pop();
    }
    b.endPart();
    b.group('front').part('windshieldFrame', 'body');
    b.color(C.bodyDirty).material(0.5, 0.3);
    for (const s of [-1, 1]) {
      b.push(); b.translate(D.xNose - 0.30, 1.90, s * 0.60); b.rotateZ(-0.30); b.rotateY(s * 0.10);
      b.push(); b.translate(0.01, 0.46, 0); b.roundedBox(0.07, 0.06, 1.12, 0.02, 2); b.pop();
      b.push(); b.translate(0.01, -0.46, 0); b.roundedBox(0.07, 0.06, 1.12, 0.02, 2); b.pop();
      b.push(); b.translate(0.01, 0, s * 0.55); b.roundedBox(0.07, 0.92, 0.06, 0.02, 2); b.pop();
      b.pop();
    }
    b.push(); b.translate(D.xNose - 0.36, 1.90, 0); b.rotateZ(-0.30); b.roundedBox(0.08, 0.92, 0.07, 0.025, 2); b.pop();
    // 雨刷
    b.color(C.metalDark).material(0.6, 0.4);
    for (const s of [-1, 1]) {
      b.push(); b.translate(D.xNose - 0.16, 1.44, s * 0.55);
      b.tube(MESH.spline([[0, 0, -0.22], [0.02, 0.05, 0], [0, 0.02, 0.26]], 5), 0.012, 6);
      b.pop();
    }
    b.endPart();
    b.part('headlights', 'hot');
    for (const s of [-1, 1]) {
      b.push(); b.translate(D.xNose + 0.02, 1.02, s * 0.82); lamp(b, 0.14, 0.06, [0.92, 0.93, 0.88], 0.55); b.pop();
      b.push(); b.translate(D.xNose + 0.02, 0.98, s * 0.52); lamp(b, 0.075, 0.05, [0.95, 0.62, 0.18], 0.25); b.pop();
    }
    b.endPart();
    b.part('grille', 'body').color(C.metalDark).material(0.55, 0.4);
    for (let i = 0; i < 7; i++) {
      b.push(); b.translate(D.xNose - 0.02, 0.86 + i * 0.045, 0); b.roundedBox(0.05, 0.022, 1.05, 0.008, 2); b.pop();
    }
    b.endPart();
    b.part('frontBumper', 'body').color(C.metalMid).material(0.45, 0.6);
    b.push(); b.translate(D.xNose - 0.04, 0.66, 0);
    b.tube(MESH.spline([[0, 0, -1.18], [0.10, 0.0, -0.9], [0.14, 0, 0], [0.10, 0.0, 0.9], [0, 0, 1.18]], 7),
      0.085, 10, { caps: true });
    b.pop();
    b.color([0.80, 0.78, 0.72]).material(0.7, 0.1);
    b.push(); b.translate(D.xNose + 0.06, 0.86, 0.0); b.roundedBox(0.03, 0.10, 0.34, 0.01, 2); b.pop();
    b.endPart();

    /* ---------------- 车尾 ---------------- */
    b.group('rear').part('rearWall', 'body');
    b.color(C.bodyCream).material(0.62, 0.08);
    b.extrudeProfile(bodyProfile(0.01), D.xRear - 0.10, D.xRear, { steps: 3, capStart: true });
    b.endPart();
    b.group('glass').part('rearWindow', 'glass').color(C.glassBlue).material(0.06, 0.1);
    b.push(); b.translate(D.xRear - 0.115, 1.92, 0); b.roundedBox(0.03, 0.62, 1.40, 0.05, 3); b.pop();
    b.endPart();
    b.group('rear').part('taillights', 'part');
    for (const s of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const cols = [[0.85, 0.12, 0.10], [0.9, 0.45, 0.10], [0.9, 0.9, 0.85]];
        b.push(); b.translate(D.xRear - 0.12, 1.02 - i * 0.15, s * 0.96); b.rotateZ(PI);
        lamp(b, 0.072, 0.045, cols[i], i === 0 ? 0.5 : 0.2); b.pop();
      }
    }
    b.endPart();
    b.part('rearLadder', 'hot').color(C.metalMid).material(0.4, 0.85);
    for (const s of [-1, 1]) {
      b.tube([[D.xRear - 0.07, 0.95, s * 0.42], [D.xRear - 0.07, 2.62, s * 0.42], [D.xRear + 0.10, 2.80, s * 0.42]], 0.022, 8);
    }
    for (let i = 0; i < 6; i++) {
      b.push(); b.translate(D.xRear - 0.07, 1.06 + i * 0.30, 0); b.rotateX(PI / 2); b.cylinder(0.018, 0.018, 0.84, 8); b.pop();
    }
    b.endPart();
    b.part('rearBumper', 'body').color(C.metalMid).material(0.45, 0.6);
    b.push(); b.translate(D.xRear - 0.06, 0.62, 0);
    b.tube(MESH.spline([[0, 0, -1.16], [-0.08, 0, -0.85], [-0.11, 0, 0], [-0.08, 0, 0.85], [0, 0, 1.16]], 7), 0.075, 10, { caps: true });
    b.pop();
    b.color([0.85, 0.85, 0.80]).material(0.7, 0.1);
    b.push(); b.translate(D.xRear - 0.17, 0.86, -0.55); b.roundedBox(0.02, 0.14, 0.28, 0.01, 2); b.pop();
    b.endPart();

    /* ---------------- 侧面细节：车窗、车门、条纹、后视镜 ---------------- */
    const sideWindow = (x, z, w, h, y) => {
      const s = Math.sign(z);
      b.group('glass').part('win' + x.toFixed(1) + (s > 0 ? 'N' : 'F'), 'glass');
      b.color(C.glassBlue).material(0.06, 0.1);
      b.push(); b.translate(x, y, z + s * 0.006); b.roundedBox(w, h, 0.03, 0.05, 3); b.pop();
      b.endPart();
      b.group(s > 0 ? 'shellNear' : 'shellFar').part('winFrame' + x.toFixed(1) + (s > 0 ? 'N' : 'F'), 'body');
      b.color(C.bodyDirty).material(0.5, 0.25);
      b.push(); b.translate(x, y, z + s * 0.012);
      b.push(); b.translate(0, h / 2, 0); b.roundedBox(w + 0.06, 0.05, 0.035, 0.014, 2); b.pop();
      b.push(); b.translate(0, -h / 2, 0); b.roundedBox(w + 0.06, 0.05, 0.035, 0.014, 2); b.pop();
      b.push(); b.translate(w / 2, 0, 0); b.roundedBox(0.05, h, 0.035, 0.014, 2); b.pop();
      b.push(); b.translate(-w / 2, 0, 0); b.roundedBox(0.05, h, 0.035, 0.014, 2); b.pop();
      b.pop();
      b.endPart();
      // 车内侧亮面（从内部看像透光的窗）
      b.group('interior').part('winIn' + x.toFixed(1) + (s > 0 ? 'N' : 'F'), 'glass');
      b.color([0.62, 0.72, 0.82]).material(0.3, 0.0, 0.35);
      b.push(); b.translate(x, y, z - s * 0.055); b.rotateY(s > 0 ? 0 : PI); b.rotateX(PI / 2);
      b.plane(w - 0.05, h - 0.05, 1, 1, [0, 1, 0]); b.pop();
      b.endPart();
    };
    // 驾驶室侧窗 + 生活区侧窗
    sideWindow(2.62, D.halfW, 0.72, 0.60, 1.86);
    sideWindow(2.62, -D.halfW, 0.72, 0.60, 1.86);
    sideWindow(0.55, -D.halfW, 1.55, 0.72, 1.92);
    sideWindow(-1.35, -D.halfW, 1.05, 0.66, 1.92);
    sideWindow(-2.85, -D.halfW, 0.80, 0.60, 1.92);
    sideWindow(-0.30, D.halfW, 1.25, 0.70, 1.92);
    sideWindow(-2.60, D.halfW, 0.95, 0.60, 1.92);

    // 车门（近侧，驾驶室后方）
    b.group('shellNear').part('entryDoor', 'hot');
    b.color([C.bodyCream[0] * 0.97, C.bodyCream[1] * 0.97, C.bodyCream[2] * 0.97]).material(0.6, 0.08);
    b.push(); b.translate(1.62, 1.52, D.halfW + 0.02); b.roundedBox(0.86, 1.72, 0.06, 0.05, 3); b.pop();
    b.color(C.bodyDirty).material(0.5, 0.2);
    b.push(); b.translate(1.62, 1.52, D.halfW + 0.052); b.roundedBox(0.80, 1.66, 0.02, 0.04, 2); b.pop();
    b.group('glass').color(C.glassBlue).material(0.06, 0.1);
    b.push(); b.translate(1.62, 1.98, D.halfW + 0.062); b.roundedBox(0.62, 0.52, 0.02, 0.04, 3); b.pop();
    b.group('shellNear');
    b.color(C.chrome).material(0.3, 0.9);
    b.push(); b.translate(1.28, 1.50, D.halfW + 0.08); b.rotateY(PI / 2);
    b.tube([[0, 0, 0], [0.06, 0, 0], [0.06, 0.16, 0], [0, 0.16, 0]], 0.012, 8); b.pop();
    b.push(); b.translate(1.28, 1.34, D.halfW + 0.07); b.rotateX(PI / 2); b.cylinder(0.025, 0.025, 0.03, 10); b.pop();
    b.endPart();
    // 折叠踏步
    b.part('doorStep', 'part').color(C.metalDark).material(0.6, 0.5);
    b.push(); b.translate(1.62, 0.52, D.halfW + 0.20); b.roundedBox(0.72, 0.05, 0.30, 0.02, 2); b.pop();
    b.push(); b.translate(1.62, 0.30, D.halfW + 0.26); b.roundedBox(0.72, 0.05, 0.30, 0.02, 2); b.pop();
    for (const s of [-1, 1]) {
      b.tube([[1.62 + s * 0.30, 0.66, D.halfW + 0.02], [1.62 + s * 0.32, 0.52, D.halfW + 0.20], [1.62 + s * 0.34, 0.30, D.halfW + 0.26]], 0.016, 6);
    }
    b.endPart();
    // 行李舱门
    ['shellNear', 'shellFar'].forEach((g, gi) => {
      const s = gi === 0 ? 1 : -1;
      b.group(g).part('bay' + gi, 'part');
      b.color([C.bodyCream[0] * 0.93, C.bodyCream[1] * 0.93, C.bodyCream[2] * 0.93]).material(0.6, 0.1);
      b.push(); b.translate(-0.65, 1.00, s * (D.halfW + 0.015)); b.roundedBox(1.30, 0.44, 0.04, 0.04, 2); b.pop();
      b.color(C.chrome).material(0.3, 0.9);
      b.push(); b.translate(-0.65, 1.00, s * (D.halfW + 0.05)); b.rotateX(PI / 2); b.cylinder(0.028, 0.028, 0.03, 10); b.pop();
      b.endPart();
    });
    // 轮眉（环面片段）
    for (const w of [[D.axleFront, 1], [D.axleFront, -1], [D.axleRear, 1], [D.axleRear, -1]]) {
      b.group(w[1] > 0 ? 'shellNear' : 'shellFar').part('arch' + w[0].toFixed(1) + w[1], 'body');
      b.color(C.bodyDirty).material(0.65, 0.05);
      b.push(); b.translate(w[0], D.wheelR + 0.10, w[1] * (D.halfW - 0.02));
      b.rotateX(PI / 2); b.rotateY(-PI / 2); b.rotateZ(0);
      b.push(); b.rotateY(0); b.torus(0.62, 0.055, 22, 8, PI); b.pop();
      b.pop();
      b.endPart();
    }
    // 车身条纹（沿车身的两条棕色飘带）
    b.part('stripes', 'body');
    [[1.42, C.stripeBrown, 0.085], [1.24, C.stripeTan, 0.055], [1.08, C.stripeBrown, 0.035]].forEach((st, k) => {
      b.color(st[1]).material(0.55, 0.05);
      for (const s of [-1, 1]) {
        b.group(s > 0 ? 'shellNear' : 'shellFar');
        const path = MESH.spline([
          [D.xRear + 0.02, st[0] + 0.30, s * (D.halfW + 0.006)],
          [-2.2, st[0] + 0.16 + k * 0.02, s * (D.halfW + 0.014)],
          [-0.2, st[0], s * (D.halfW + 0.016)],
          [1.8, st[0] - 0.10, s * (D.halfW + 0.014)],
          [3.2, st[0] + 0.06, s * (D.halfW + 0.010)],
          [D.xNose - 0.10, st[0] + 0.30, s * (D.halfW - 0.06)]
        ], 8);
        b.tube(path, st[2] / 2, 5);
      }
    });
    b.endPart();
    // 后视镜
    b.group('front').part('mirrors', 'part');
    for (const s of [-1, 1]) {
      b.color(C.metalDark).material(0.5, 0.5);
      b.push();
      b.tube([[D.xNose - 0.34, 1.78, s * 1.16], [D.xNose - 0.30, 1.86, s * 1.34], [D.xNose - 0.26, 1.80, s * 1.44]], 0.022, 8);
      b.tube([[D.xNose - 0.34, 1.50, s * 1.16], [D.xNose - 0.28, 1.60, s * 1.40]], 0.020, 8);
      b.pop();
      b.push(); b.translate(D.xNose - 0.24, 1.72, s * 1.46); b.rotateY(s * 0.25);
      b.color([0.18, 0.18, 0.19]).material(0.6, 0.2); b.roundedBox(0.06, 0.34, 0.20, 0.03, 3);
      b.color(C.chrome).material(0.08, 1.0);
      b.push(); b.translate(0.035, 0, 0); b.roundedBox(0.01, 0.29, 0.16, 0.01, 2); b.pop();
      b.pop();
    }
    b.endPart();

    /* ---------------- 车顶设备 ---------------- */
    b.group('roof').part('roofAC', 'hot');
    b.color([0.86, 0.85, 0.80]).material(0.55, 0.05);
    b.push(); b.translate(-1.55, D.roofY + 0.10, 0); b.roundedBox(1.05, 0.26, 0.80, 0.10, 4); b.pop();
    b.color([0.72, 0.71, 0.67]).material(0.6, 0.05);
    for (let i = 0; i < 6; i++) {
      b.push(); b.translate(-1.55 + (i - 2.5) * 0.14, D.roofY + 0.14, 0.40); b.rotateX(0.4);
      b.roundedBox(0.10, 0.02, 0.06, 0.006, 2); b.pop();
    }
    b.endPart();
    b.part('roofVents', 'part');
    [[0.35, 0], [-3.0, 0.3]].forEach(v => {
      b.color([0.80, 0.79, 0.75]).material(0.6, 0.05);
      b.push(); b.translate(v[0], D.roofY + 0.03, v[1]); b.roundedBox(0.44, 0.10, 0.44, 0.03, 2); b.pop();
      b.color([0.86, 0.88, 0.86]).material(0.35, 0.0);
      b.push(); b.translate(v[0] - 0.02, D.roofY + 0.14, v[1]); b.rotateZ(-0.28); b.roundedBox(0.46, 0.03, 0.46, 0.02, 2); b.pop();
    });
    b.endPart();
    b.part('roofPipes', 'part').color(C.metalMid).material(0.5, 0.6);
    b.push(); b.translate(-2.4, D.roofY + 0.14, -0.55); b.cylinder(0.05, 0.045, 0.30, 12); b.pop();
    b.push(); b.translate(-2.4, D.roofY + 0.30, -0.55); b.lathe([[0.06, 0], [0.075, 0.01], [0.075, 0.04], [0.02, 0.05]], 12); b.pop();
    // 实验室排风管（从车内穿出）
    b.color([0.55, 0.55, 0.52]).material(0.7, 0.3);
    b.tube(MESH.spline([[-0.9, D.roofY - 0.02, -0.75], [-0.9, D.roofY + 0.16, -0.72], [-1.05, D.roofY + 0.30, -0.60], [-1.30, D.roofY + 0.34, -0.55]], 6), 0.055, 12, { caps: true });
    b.endPart();
    b.part('antenna', 'part').color(C.metalDark).material(0.4, 0.7);
    b.push(); b.translate(2.6, D.roofY + 0.02, -0.85); b.cylinder(0.03, 0.02, 0.10, 8); b.pop();
    b.push(); b.translate(2.6, D.roofY + 0.35, -0.85); b.rotateZ(0.12); b.cylinder(0.008, 0.005, 0.62, 6); b.pop();
    b.push(); b.translate(2.68, D.roofY + 0.66, -0.85); b.sphere(0.018, 10, 6); b.pop();
    b.endPart();
    // 车顶脏污带（深色薄片）
    b.part('roofGrime', 'body').color([0.62, 0.60, 0.55]).material(0.9, 0.0);
    b.push(); b.translate(-0.4, D.roofY + 0.012, 0.55); b.plane(5.6, 0.5, 12, 2); b.pop();
    b.push(); b.translate(0.6, D.roofY + 0.012, -0.62); b.plane(4.2, 0.4, 10, 2); b.pop();
    b.endPart();

    /* ================= 内部：驾驶室 ================= */
    b.group('cab').part('driverSeat', 'hot');
    b.push(); b.translate(2.92, D.floorY, 0.62); b.rotateY(-PI / 2 + 0.25); seat(b, rnd); b.pop();
    b.endPart();
    b.part('passengerSeat', 'part');
    b.push(); b.translate(2.92, D.floorY, -0.62); b.rotateY(-PI / 2 - 0.25); seat(b, rnd); b.pop();
    b.endPart();
    b.part('dashboard', 'hot');
    b.color([0.22, 0.20, 0.19]).material(0.7, 0.05);
    b.push(); b.translate(D.xNose - 0.52, 1.36, 0);
    b.push(); b.rotateZ(-0.06); b.roundedBox(0.42, 0.22, 2.10, 0.07, 3); b.pop();
    b.push(); b.translate(-0.06, -0.22, 0); b.roundedBox(0.30, 0.30, 2.06, 0.05, 3); b.pop();
    b.pop();
    // 仪表盘
    b.color([0.10, 0.10, 0.11]).material(0.5, 0.1);
    b.push(); b.translate(D.xNose - 0.60, 1.50, 0.62); b.rotateZ(-0.25); b.roundedBox(0.24, 0.20, 0.46, 0.05, 3); b.pop();
    b.color([0.70, 0.72, 0.68]).material(0.3, 0.1, 0.18);
    for (let i = 0; i < 3; i++) {
      b.push(); b.translate(D.xNose - 0.70, 1.53, 0.46 + i * 0.16); b.rotateZ(-PI / 2 - 0.25);
      b.cylinder(0.055 - (i === 1 ? 0 : 0.015), 0.055 - (i === 1 ? 0 : 0.015), 0.01, 14); b.pop();
    }
    // 中控与收音机
    b.color([0.15, 0.15, 0.16]).material(0.5, 0.2);
    b.push(); b.translate(D.xNose - 0.62, 1.30, -0.02); b.rotateZ(-0.2); b.roundedBox(0.20, 0.16, 0.26, 0.02, 2); b.pop();
    b.color([0.35, 0.55, 0.40]).material(0.3, 0.0, 0.4);
    b.push(); b.translate(D.xNose - 0.70, 1.34, -0.02); b.rotateZ(-PI / 2 - 0.2); b.plane(0.14, 0.05, 1, 1); b.pop();
    b.color([0.6, 0.6, 0.6]).material(0.4, 0.5);
    for (let i = 0; i < 4; i++) {
      b.push(); b.translate(D.xNose - 0.72, 1.24, -0.10 + i * 0.055); b.rotateZ(-PI / 2 - 0.2); b.cylinder(0.014, 0.014, 0.015, 8); b.pop();
    }
    b.endPart();
    b.part('steeringWheel', 'hot');
    b.color([0.12, 0.12, 0.13]).material(0.55, 0.1);
    b.push(); b.translate(D.xNose - 0.78, 1.58, 0.62); b.rotateZ(0.38); b.rotateY(PI / 2);
    b.push(); b.rotateX(PI / 2); b.torus(0.185, 0.020, 30, 10); b.pop();
    for (let i = 0; i < 3; i++) {
      const a = i * TAU / 3 + 0.4;
      b.push(); b.rotateZ(a); b.translate(0.09, 0, 0); b.rotateZ(PI / 2); b.roundedBox(0.022, 0.19, 0.04, 0.008, 2); b.pop();
    }
    b.color([0.25, 0.25, 0.26]).material(0.5, 0.2);
    b.cylinder(0.05, 0.045, 0.05, 14);
    b.pop();
    // 转向柱
    b.color([0.18, 0.18, 0.19]).material(0.6, 0.2);
    b.push(); b.translate(D.xNose - 0.62, 1.42, 0.62); b.rotateZ(-PI / 2 + 0.38); b.rotateY(PI / 2); b.cylinder(0.045, 0.05, 0.30, 12); b.pop();
    b.endPart();
    b.part('cabDetails', 'part');
    // 变速杆
    b.color([0.2, 0.2, 0.2]).material(0.5, 0.3);
    b.push(); b.translate(D.xNose - 0.66, 1.20, 0.30); b.rotateZ(-0.35); b.cylinder(0.016, 0.014, 0.26, 8); b.pop();
    b.color([0.10, 0.09, 0.09]);
    b.push(); b.translate(D.xNose - 0.72, 1.34, 0.28); b.sphere(0.032, 12, 8); b.pop();
    // 遮阳板 + 后视镜
    b.color([0.55, 0.52, 0.46]).material(0.8, 0.0);
    for (const s of [-1, 1]) {
      b.push(); b.translate(D.xNose - 0.52, 2.30, s * 0.58); b.rotateZ(0.18); b.roundedBox(0.30, 0.02, 0.62, 0.01, 2); b.pop();
    }
    b.color([0.12, 0.12, 0.13]).material(0.5, 0.1);
    b.push(); b.translate(D.xNose - 0.46, 2.24, 0); b.roundedBox(0.05, 0.10, 0.34, 0.02, 2); b.pop();
    // 引擎盖（A 型房车驾驶室之间）
    b.color([0.30, 0.29, 0.27]).material(0.7, 0.1);
    b.push(); b.translate(3.06, 0.98, 0); b.roundedBox(0.9, 0.34, 0.72, 0.06, 3); b.pop();
    // 踏板
    b.color(C.metalDark).material(0.5, 0.4);
    for (let i = 0; i < 2; i++) {
      b.push(); b.translate(D.xNose - 0.66, 0.86, 0.50 + i * 0.18); b.rotateZ(-0.4); b.roundedBox(0.16, 0.02, 0.09, 0.01, 2); b.pop();
    }
    b.endPart();

    /* ================= 内部：实验台（远侧）================= */
    b.group('lab').part('labBench', 'part');
    b.color(C.counterTop).material(0.5, 0.1);
    b.push(); b.translate(-0.75, 1.62, -0.86); b.roundedBox(3.0, 0.06, 0.66, 0.02, 2); b.pop();
    b.color([0.58, 0.54, 0.46]).material(0.6, 0.05);
    b.push(); b.translate(-0.75, 1.14, -0.92); b.roundedBox(2.96, 0.90, 0.54, 0.03, 2); b.pop();
    b.push(); b.translate(-0.75, 1.16, -0.62);
    cabinetDoors(b, 2.9, 0.86, 0.04, 4, [0.50, 0.42, 0.33]);
    b.pop();
    b.endPart();

    // 加热套 + 圆底烧瓶 + 支架 + 冷凝管 + 管路
    b.part('heatingMantle', 'hot');
    b.color([0.24, 0.24, 0.26]).material(0.6, 0.2);
    b.push(); b.translate(-0.10, 1.65, -0.86);
    b.lathe([[0, 0], [0.155, 0.005], [0.16, 0.03], [0.16, 0.11], [0.125, 0.13], [0.10, 0.10], [0.10, 0.02], [0, 0.015]], 22);
    b.color([0.75, 0.32, 0.18]).material(0.4, 0.0, 0.35);
    b.push(); b.translate(0, 0.105, 0); b.cylinder(0.098, 0.098, 0.004, 20); b.pop();
    b.color([0.30, 0.30, 0.32]).material(0.5, 0.3);
    b.push(); b.translate(0.13, 0.05, 0.10); b.rotateX(PI / 2); b.cylinder(0.026, 0.026, 0.02, 12); b.pop();
    b.pop();
    b.endPart();
    b.part('roundFlask', 'hot');
    b.push(); b.translate(-0.10, 1.78, -0.86); flask(b, 0.145); b.pop();
    b.endPart();
    b.part('labStand', 'part');
    b.color(C.metalDark).material(0.45, 0.6);
    b.push(); b.translate(-0.42, 1.66, -0.86); b.roundedBox(0.20, 0.02, 0.30, 0.01, 2); b.pop();
    b.push(); b.translate(-0.42, 2.06, -0.86); b.cylinder(0.014, 0.014, 0.80, 10); b.pop();
    // 夹具
    for (const yy of [1.92, 2.22]) {
      b.color(C.metalMid).material(0.4, 0.7);
      b.push(); b.translate(-0.42, yy, -0.86); b.rotateY(0.2);
      b.roundedBox(0.035, 0.03, 0.16, 0.008, 2);
      b.push(); b.translate(0, 0, 0.12); b.rotateX(PI / 2); b.torus(0.045, 0.010, 14, 6, PI * 1.2); b.pop();
      b.pop();
      b.push(); b.translate(-0.40, yy, -0.86); b.rotateZ(PI / 2); b.cylinder(0.010, 0.010, 0.05, 8); b.pop();
    }
    b.endPart();
    b.part('condenser', 'hot');
    b.push(); b.translate(-0.24, 2.06, -0.80); b.rotateZ(0.30); condenser(b, 0.62); b.pop();
    b.endPart();
    b.part('labTubing', 'part');
    b.color([0.85, 0.86, 0.84]).material(0.35, 0.0);
    // 烧瓶 -> 冷凝管
    b.tube(MESH.spline([[-0.10, 2.16, -0.86], [-0.14, 2.30, -0.84], [-0.20, 2.34, -0.80], [-0.29, 2.30, -0.76]], 7), 0.014, 8);
    // 冷凝管 -> 接收瓶
    b.tube(MESH.spline([[-0.13, 1.80, -0.72], [-0.02, 1.76, -0.70], [0.10, 1.72, -0.74], [0.18, 1.70, -0.80]], 7), 0.014, 8);
    // 冷却水循环 -> 桶
    b.color([0.30, 0.42, 0.72]).material(0.4, 0.0);
    b.tube(MESH.spline([[-0.36, 2.24, -0.74], [-0.60, 2.10, -0.66], [-0.90, 1.80, -0.60], [-1.05, 1.40, -0.66], [-1.05, 1.05, -0.72]], 8), 0.013, 8);
    b.tube(MESH.spline([[-0.16, 1.90, -0.70], [-0.50, 1.86, -0.55], [-0.95, 1.60, -0.52], [-1.10, 1.20, -0.60]], 8), 0.013, 8);
    // 排风软管 -> 车顶
    b.color([0.62, 0.62, 0.58]).material(0.75, 0.1);
    b.tube(MESH.spline([[-0.10, 2.30, -0.90], [-0.35, 2.44, -0.92], [-0.65, 2.52, -0.86], [-0.90, 2.56, -0.78]], 8), 0.052, 12);
    b.endPart();
    b.part('glassware', 'part');
    b.push(); b.translate(0.20, 1.65, -0.82); erlenmeyer(b, 0.085, 0.20); b.pop();
    b.push(); b.translate(0.46, 1.65, -0.90); beaker(b, 0.068, 0.13); b.pop();
    b.push(); b.translate(0.62, 1.65, -0.78); beaker(b, 0.052, 0.10); b.pop();
    // 量筒
    b.group('glass').color(C.glassLab).material(0.07, 0);
    b.push(); b.translate(0.80, 1.65, -0.88);
    b.lathe([[0, 0], [0.06, 0.004], [0.06, 0.02], [0.028, 0.03], [0.028, 0.30], [0.034, 0.31], [0.026, 0.315]], 18);
    b.pop();
    b.group('lab');
    // 温度计
    b.color([0.88, 0.92, 0.94]).material(0.1, 0.0);
    b.push(); b.translate(-0.02, 2.02, -0.82); b.rotateZ(0.12); b.cylinder(0.008, 0.008, 0.34, 8); b.pop();
    b.color([0.85, 0.15, 0.10]).material(0.2, 0.0);
    b.push(); b.translate(-0.04, 1.86, -0.82); b.sphere(0.013, 10, 6); b.pop();
    b.endPart();
    b.part('burner', 'part');
    b.color([0.35, 0.35, 0.37]).material(0.5, 0.5);
    b.push(); b.translate(-0.62, 1.65, -0.78);
    b.lathe([[0, 0], [0.075, 0.004], [0.075, 0.02], [0.022, 0.04], [0.022, 0.20], [0.030, 0.21]], 16);
    b.color(C.flameBlue).material(0.1, 0.0, 1.6);
    b.push(); b.translate(0, 0.23, 0); b.lathe([[0.022, 0], [0.016, 0.05], [0.006, 0.11], [0, 0.14]], 12); b.pop();
    b.pop();
    b.endPart();
    b.part('crystalTray', 'hot');
    b.color([0.70, 0.72, 0.74]).material(0.35, 0.7);
    b.push(); b.translate(-1.30, 1.66, -0.84); b.roundedBox(0.44, 0.035, 0.30, 0.012, 2); b.pop();
    for (let i = 0; i < 26; i++) {
      const x = -1.30 + (rnd() - 0.5) * 0.36, z = -0.84 + (rnd() - 0.5) * 0.22;
      const s = 0.018 + rnd() * 0.030;
      b.color(jitter(C.crystalBlue, 0.10, rnd)).material(0.12, 0.0, 0.06);
      b.push(); b.translate(x, 1.69 + s * 0.4, z); b.rotateY(rnd() * TAU); b.rotateX(rnd() * 0.6); b.rotateZ(rnd() * 0.6);
      b.scale(s, s * (0.7 + rnd() * 0.9), s * (0.6 + rnd() * 0.8));
      b.lathe([[0, -1], [0.8, -0.2], [0.9, 0.3], [0.35, 0.85], [0, 1]], 5);
      b.pop();
    }
    b.endPart();
    b.part('hotplate', 'part');
    b.color([0.82, 0.82, 0.80]).material(0.4, 0.3);
    b.push(); b.translate(-0.92, 1.68, -0.86); b.roundedBox(0.28, 0.07, 0.26, 0.02, 2); b.pop();
    b.color([0.20, 0.20, 0.20]).material(0.5, 0.2);
    b.push(); b.translate(-0.92, 1.72, -0.88); b.cylinder(0.095, 0.095, 0.012, 18); b.pop();
    b.color([0.85, 0.30, 0.20]).material(0.3, 0.0, 0.5);
    b.push(); b.translate(-1.03, 1.70, -0.74); b.rotateX(PI / 2); b.cylinder(0.014, 0.014, 0.012, 10); b.pop();
    b.endPart();

    /* ================= 内部：厨房区（近侧）================= */
    b.group('lab').part('kitchen', 'part');
    b.color(C.counterTop).material(0.5, 0.1);
    b.push(); b.translate(0.30, 1.62, 0.88); b.roundedBox(1.60, 0.06, 0.62, 0.02, 2); b.pop();
    b.color([0.52, 0.44, 0.34]).material(0.6, 0.05);
    b.push(); b.translate(0.30, 1.14, 0.94); b.roundedBox(1.56, 0.90, 0.50, 0.03, 2); b.pop();
    b.push(); b.translate(0.30, 1.16, 0.64); b.rotateY(PI);
    cabinetDoors(b, 1.5, 0.86, 0.04, 2, [0.46, 0.38, 0.29]);
    b.pop();
    // 水槽 + 龙头
    b.color([0.75, 0.76, 0.78]).material(0.3, 0.85);
    b.push(); b.translate(-0.10, 1.60, 0.88);
    b.lathe([[0.19, 0.04], [0.19, 0.0], [0.17, -0.10], [0.06, -0.13], [0, -0.13]], 18);
    b.pop();
    b.push(); b.translate(-0.10, 1.66, 1.06); b.cylinder(0.020, 0.018, 0.14, 10);
    b.tube(MESH.spline([[0, 0.07, 0], [0, 0.13, -0.02], [0, 0.15, -0.10], [0, 0.12, -0.16]], 6), 0.016, 8);
    b.pop();
    // 灶台
    b.color([0.18, 0.18, 0.19]).material(0.45, 0.3);
    b.push(); b.translate(0.72, 1.66, 0.88); b.roundedBox(0.52, 0.03, 0.46, 0.01, 2); b.pop();
    b.color(C.metalDark).material(0.5, 0.6);
    for (const p of [[0.60, 0.78], [0.60, 0.98], [0.86, 0.88]]) {
      b.push(); b.translate(p[0], 1.685, p[1]); b.rotateX(PI / 2); b.torus(0.055, 0.007, 16, 6); b.pop();
      b.push(); b.translate(p[0], 1.675, p[1]); b.cylinder(0.030, 0.024, 0.014, 12); b.pop();
    }
    b.endPart();
    b.part('fridge', 'hot');
    b.color([0.78, 0.76, 0.70]).material(0.5, 0.1);
    b.push(); b.translate(1.30, 1.28, 0.86); b.roundedBox(0.62, 1.12, 0.60, 0.05, 3); b.pop();
    b.color([0.70, 0.68, 0.62]).material(0.55, 0.1);
    b.push(); b.translate(1.30, 1.02, 0.56); b.roundedBox(0.58, 0.56, 0.03, 0.02, 2); b.pop();
    b.push(); b.translate(1.30, 1.48, 0.56); b.roundedBox(0.58, 0.32, 0.03, 0.02, 2); b.pop();
    b.color(C.chrome).material(0.3, 0.9);
    b.push(); b.translate(1.05, 1.02, 0.54); b.rotateX(PI / 2); b.cylinder(0.014, 0.014, 0.24, 8); b.pop();
    b.endPart();
    b.part('upperCabinets', 'part');
    b.color([0.48, 0.40, 0.31]).material(0.6, 0.05);
    b.push(); b.translate(0.30, 2.18, 1.02); b.roundedBox(1.70, 0.52, 0.36, 0.04, 3); b.pop();
    b.push(); b.translate(0.30, 2.18, 0.84); b.rotateY(PI); cabinetDoors(b, 1.64, 0.48, 0.04, 3, [0.44, 0.36, 0.28]); b.pop();
    b.push(); b.translate(-1.60, 2.18, -1.00); b.roundedBox(1.30, 0.52, 0.34, 0.04, 3); b.pop();
    b.push(); b.translate(-1.60, 2.18, -0.83); cabinetDoors(b, 1.24, 0.48, 0.04, 2, [0.44, 0.36, 0.28]); b.pop();
    b.endPart();

    /* ================= 内部：餐桌区 ================= */
    b.group('lab').part('dinette', 'hot');
    b.color([0.55, 0.44, 0.32]).material(0.5, 0.05);
    b.push(); b.translate(-2.30, 1.42, 0.62); b.roundedBox(0.82, 0.05, 1.05, 0.03, 3); b.pop();
    b.color(C.chrome).material(0.3, 0.9);
    b.push(); b.translate(-2.30, 1.06, 0.62); b.cylinder(0.045, 0.045, 0.66, 12); b.pop();
    b.push(); b.translate(-2.30, 0.78, 0.62); b.lathe([[0, 0], [0.22, 0.006], [0.22, 0.02], [0.05, 0.03]], 16); b.pop();
    // 长椅
    for (const s of [-1, 1]) {
      b.color(jitter(C.cushionTan, 0.05, rnd)).material(0.85, 0.0);
      b.push(); b.translate(-2.30 + s * 0.62, 1.06, 0.66); b.roundedBox(0.42, 0.14, 1.06, 0.05, 3); b.pop();
      b.push(); b.translate(-2.30 + s * 0.82, 1.44, 0.66); b.rotateZ(s * 0.06); b.roundedBox(0.13, 0.62, 1.02, 0.05, 3); b.pop();
      b.color([0.42, 0.34, 0.26]).material(0.7, 0.0);
      b.push(); b.translate(-2.30 + s * 0.62, 0.88, 0.66); b.roundedBox(0.44, 0.28, 1.02, 0.02, 2); b.pop();
    }
    b.endPart();

    /* ================= 内部：桶、防护、杂物 ================= */
    b.group('props').part('barrelBlue1', 'hot');
    b.push(); b.translate(-3.30, D.floorY + 0.02, -0.60); barrel(b, 0.28, 0.86, C.barrelBlue, rnd); b.pop();
    b.endPart();
    b.part('barrelBlue2', 'part');
    b.push(); b.translate(-3.28, D.floorY + 0.02, 0.02); b.rotateY(0.6); barrel(b, 0.26, 0.80, [0.16, 0.34, 0.55], rnd); b.pop();
    b.endPart();
    b.part('barrelWhite', 'part');
    b.push(); b.translate(-2.62, D.floorY + 0.02, -0.72); b.rotateY(1.2); barrel(b, 0.24, 0.70, [0.78, 0.78, 0.74], rnd); b.pop();
    b.endPart();
    b.part('jugs', 'part');
    b.push(); b.translate(-1.85, 1.68, -0.90); jug(b, 0.28, [0.86, 0.86, 0.82]); b.pop();
    b.push(); b.translate(-2.05, 1.68, -0.84); jug(b, 0.24, [0.80, 0.74, 0.30]); b.pop();
    b.push(); b.translate(-3.62, D.floorY + 0.02, 0.62); b.rotateY(0.4); jug(b, 0.34, [0.30, 0.55, 0.35]); b.pop();
    b.endPart();
    b.part('bucket', 'part');
    b.color([0.55, 0.56, 0.58]).material(0.5, 0.2);
    b.push(); b.translate(-1.15, D.floorY + 0.02, -0.78);
    b.lathe([[0, 0], [0.14, 0.004], [0.145, 0.02], [0.175, 0.26], [0.185, 0.275], [0.170, 0.28]], 20);
    b.color(C.metalMid).material(0.35, 0.8);
    b.push(); b.translate(0, 0.28, 0); b.rotateX(PI / 2); b.torus(0.175, 0.008, 20, 6); b.pop();
    b.push(); b.rotateY(PI / 2);
    b.tube(MESH.spline([[0, 0.27, -0.17], [0, 0.44, -0.10], [0, 0.48, 0], [0, 0.44, 0.10], [0, 0.27, 0.17]], 6), 0.007, 6);
    b.pop();
    b.color([0.30, 0.45, 0.60]).material(0.2, 0.0, 0.05);
    b.push(); b.translate(0, 0.20, 0); b.cylinder(0.163, 0.163, 0.005, 20); b.pop();
    b.pop();
    b.endPart();
    b.part('gasMask', 'hot');
    b.push(); b.translate(-2.05, 2.02, 1.06); b.rotateY(-0.5); b.rotateZ(-0.25); gasMask(b); b.pop();
    b.color(C.metalMid).material(0.4, 0.7);
    b.push(); b.translate(-2.05, 2.24, 1.14); b.rotateZ(PI / 2); b.cylinder(0.012, 0.012, 0.06, 8); b.pop();
    b.endPart();
    b.part('extinguisher', 'hot');
    b.push(); b.translate(1.02, D.floorY + 0.02, -1.00); extinguisher(b); b.pop();
    b.color(C.metalDark).material(0.6, 0.4);
    b.push(); b.translate(1.02, 1.10, -1.10); b.roundedBox(0.10, 0.03, 0.10, 0.01, 2); b.pop();
    b.endPart();
    b.part('hazmatSuit', 'part');
    b.color([0.86, 0.86, 0.80]).material(0.7, 0.0);
    b.push(); b.translate(-3.10, 1.20, 1.02); b.rotateY(-0.3);
    b.lathe([[0.20, 0], [0.24, 0.30], [0.22, 0.68], [0.14, 0.90], [0.10, 0.98]], 16);
    b.push(); b.translate(0, 0.72, 0); b.rotateZ(0.7); b.cylinder(0.055, 0.045, 0.44, 10); b.pop();
    b.push(); b.translate(0, 0.72, 0); b.rotateZ(-0.7); b.cylinder(0.055, 0.045, 0.44, 10); b.pop();
    b.color(C.metalMid).material(0.4, 0.7);
    b.push(); b.translate(0, 1.02, 0); b.rotateZ(PI / 2); b.cylinder(0.010, 0.010, 0.30, 8); b.pop();
    b.pop();
    b.endPart();
    b.part('duffel', 'part');
    b.color([0.30, 0.28, 0.24]).material(0.85, 0.0);
    b.push(); b.translate(-2.90, D.floorY + 0.16, 0.72); b.rotateY(0.5); b.scale(1, 0.72, 0.62);
    const dv = b.vertexCount();
    b.sphere(0.34, 18, 12);
    b.distortLast(b.vertexCount() - dv, 0.03, 6, 2.2);
    b.pop();
    b.color([0.20, 0.19, 0.17]);
    b.push(); b.translate(-2.90, D.floorY + 0.34, 0.72); b.rotateY(0.5); b.rotateX(PI / 2); b.torus(0.10, 0.014, 14, 6); b.pop();
    b.endPart();
    b.part('hoseCoil', 'part');
    b.color([0.20, 0.22, 0.24]).material(0.7, 0.0);
    b.push(); b.translate(-3.55, D.floorY + 0.06, -1.05); b.rotateX(PI / 2);
    b.torus(0.20, 0.022, 24, 8); b.pop();
    b.push(); b.translate(-3.55, D.floorY + 0.11, -1.05); b.rotateX(PI / 2);
    b.torus(0.17, 0.022, 24, 8); b.pop();
    b.endPart();
    b.part('foldChair', 'part');
    b.color(C.metalMid).material(0.5, 0.6);
    b.push(); b.translate(-1.62, D.floorY, 0.86); b.rotateY(-0.8);
    for (const s of [-1, 1]) {
      b.tube([[s * 0.16, 0.02, -0.16], [s * 0.16, 0.44, -0.14], [s * 0.15, 0.46, 0.10]], 0.014, 6);
      b.tube([[s * 0.16, 0.02, 0.16], [s * 0.16, 0.46, 0.12], [s * 0.15, 0.82, 0.06]], 0.014, 6);
    }
    b.color([0.30, 0.32, 0.36]).material(0.8, 0.0);
    b.push(); b.translate(0, 0.46, 0); b.roundedBox(0.34, 0.03, 0.32, 0.01, 2); b.pop();
    b.push(); b.translate(0, 0.70, 0.06); b.rotateX(0.2); b.roundedBox(0.32, 0.24, 0.03, 0.01, 2); b.pop();
    b.pop();
    b.endPart();
    b.part('battery', 'part');
    b.color([0.16, 0.18, 0.20]).material(0.6, 0.1);
    b.push(); b.translate(0.62, D.floorY + 0.12, -1.02); b.roundedBox(0.34, 0.22, 0.20, 0.02, 2); b.pop();
    b.color([0.75, 0.60, 0.30]).material(0.3, 0.85);
    for (const s of [-1, 1]) {
      b.push(); b.translate(0.62 + s * 0.10, D.floorY + 0.25, -1.02); b.cylinder(0.022, 0.018, 0.05, 10); b.pop();
    }
    b.endPart();

    /* ================= 内部：顶灯与线管 ================= */
    b.group('interior').part('ceilingLamp', 'part');
    b.color([0.88, 0.86, 0.80]).material(0.4, 0.0);
    b.push(); b.translate(-1.10, 2.42, 0.30);
    b.lathe([[0.19, 0.02], [0.19, 0], [0.14, -0.07], [0.06, -0.09], [0, -0.09]], 20);
    b.color(C.lampWarm).material(0.2, 0.0, 2.4);
    b.push(); b.translate(0, -0.05, 0); b.sphere(0.09, 16, 10); b.pop();
    b.pop();
    b.push(); b.translate(1.60, 2.42, -0.40);
    b.color([0.88, 0.86, 0.80]).material(0.4, 0.0);
    b.lathe([[0.14, 0.02], [0.14, 0], [0.10, -0.05], [0, -0.06]], 16);
    b.color(C.lampWarm).material(0.2, 0.0, 1.6);
    b.push(); b.translate(0, -0.04, 0); b.sphere(0.06, 14, 8); b.pop();
    b.pop();
    b.endPart();
    b.part('conduits', 'part').color([0.60, 0.58, 0.54]).material(0.7, 0.1);
    b.tube(MESH.spline([[3.0, 2.46, -1.06], [1.0, 2.50, -1.08], [-1.0, 2.50, -1.06], [-3.2, 2.46, -1.02]], 6), 0.020, 8);
    b.tube(MESH.spline([[-0.9, 2.48, -1.04], [-1.0, 2.30, -1.10], [-1.05, 2.10, -1.08]], 5), 0.016, 6);
    b.endPart();
    b.part('smokeDetector', 'part').color([0.86, 0.85, 0.82]).material(0.5, 0.0);
    b.push(); b.translate(0.9, 2.44, 0.55); b.lathe([[0.075, 0], [0.075, -0.02], [0.05, -0.03], [0, -0.03]], 14); b.pop();
    b.endPart();

    /* ================= 追加细节 A：电气、通风、覆膜 ================= */
    b.group('interior').part('electricPanel', 'part');
    b.color([0.86, 0.85, 0.82]).material(0.5, 0.05);
    b.push(); b.translate(2.05, 1.92, -1.06); b.roundedBox(0.34, 0.44, 0.10, 0.02, 2); b.pop();
    b.color([0.20, 0.20, 0.22]).material(0.5, 0.1);
    for (let i = 0; i < 6; i++) {
      b.push(); b.translate(1.95 + (i % 3) * 0.10, 1.98 + Math.floor(i / 3) * 0.14, -1.00);
      b.roundedBox(0.06, 0.10, 0.04, 0.01, 2); b.pop();
    }
    b.color([0.85, 0.30, 0.20]).material(0.3, 0, 0.5);
    b.push(); b.translate(2.16, 2.10, -1.00); b.cylinder(0.012, 0.012, 0.02, 8); b.pop();
    b.endPart();
    b.part('ventFan', 'part');
    b.color([0.80, 0.79, 0.76]).material(0.5, 0.05);
    b.push(); b.translate(0.35, 2.42, 0); b.rotateX(PI); b.lathe([[0.20, 0], [0.21, 0.03], [0.19, 0.06], [0, 0.06]], 18); b.pop();
    b.color([0.55, 0.55, 0.52]).material(0.5, 0.3);
    for (let i = 0; i < 5; i++) {
      b.push(); b.translate(0.35, 2.40, 0); b.rotateY(i * TAU / 5); b.translate(0.09, 0, 0); b.rotateX(0.5);
      b.roundedBox(0.14, 0.012, 0.07, 0.006, 2); b.pop();
    }
    b.endPart();
    b.part('lampCord', 'part').color([0.20, 0.20, 0.20]).material(0.7, 0.0);
    b.tube(MESH.spline([[-1.10, 2.50, 0.30], [-1.02, 2.42, 0.34], [-0.95, 2.30, 0.30]], 5), 0.006, 5);
    b.endPart();
    b.part('sheeting', 'part').color([0.80, 0.82, 0.80]).material(0.35, 0.0);
    b.push(); b.translate(-2.55, 2.05, -1.10); b.rotateX(PI / 2);
    const sv = b.vertexCount();
    b.plane(1.5, 0.9, 10, 6, [0, 1, 0]);
    b.distortLast(b.vertexCount() - sv, 0.05, 7, 4.2);
    b.pop();
    b.endPart();
    b.group('lab').part('funnel', 'part');
    b.color(C.glassLab).material(0.08, 0.0);
    b.push(); b.translate(0.62, 1.78, -0.92); b.rotateZ(0.1);
    b.lathe([[0, 0], [0.012, 0.005], [0.012, 0.10], [0.075, 0.20], [0.078, 0.205], [0.070, 0.205]], 18);
    b.pop();
    b.endPart();
    b.part('scale', 'part');
    b.color([0.86, 0.86, 0.84]).material(0.4, 0.1);
    b.push(); b.translate(-1.62, 1.68, -0.86); b.roundedBox(0.26, 0.06, 0.22, 0.015, 2); b.pop();
    b.color([0.70, 0.72, 0.74]).material(0.25, 0.8);
    b.push(); b.translate(-1.62, 1.72, -0.88); b.cylinder(0.085, 0.085, 0.008, 20); b.pop();
    b.color([0.25, 0.45, 0.30]).material(0.3, 0.0, 0.45);
    b.push(); b.translate(-1.62, 1.71, -0.75); b.rotateX(-1.1); b.plane(0.10, 0.04, 1, 1); b.pop();
    b.endPart();

    /* ================= 追加细节：滴水槽、窗帘、货架、杂物 ================= */
    // 车顶滴水槽（两侧长条圆管，提升边缘精度）
    b.group('roof').part('dripRails', 'body').color(C.bodyDirty).material(0.5, 0.25);
    for (const s of [-1, 1]) {
      const path = [];
      for (let i = 0; i <= 30; i++) {
        const t = i / 30, x = D.xRear + (D.xFront + 0.3 - D.xRear) * t;
        const shrink = 1 - Math.pow(Math.max(0, t - 0.72) / 0.28, 2) * 0.035;
        path.push([x, D.wallTop + 0.10, s * (D.halfW - 0.10) * shrink]);
      }
      b.tube(path, 0.028, 8);
    }
    b.endPart();
    // 侧裙防擦条
    b.part('rubRails', 'body').color([0.36, 0.30, 0.24]).material(0.6, 0.1);
    for (const s of [-1, 1]) {
      b.group(s > 0 ? 'shellNear' : 'shellFar');
      const path = [];
      for (let i = 0; i <= 24; i++) {
        const t = i / 24, x = D.xRear + 0.05 + (D.xFront - D.xRear - 0.1) * t;
        path.push([x, 0.92, s * (D.halfW + 0.02)]);
      }
      b.tube(path, 0.030, 6);
    }
    b.endPart();
    // 泥挡板
    b.group('chassis').part('mudFlaps', 'part').color([0.14, 0.14, 0.15]).material(0.85, 0.0);
    for (const s of [-1, 1]) {
      b.push(); b.translate(D.axleRear - 0.66, 0.30, s * 1.02); b.rotateZ(0.08);
      b.roundedBox(0.03, 0.44, 0.42, 0.02, 2); b.pop();
    }
    b.endPart();
    // 外接电源口 / 加油口
    b.group('shellNear').part('hookups', 'part');
    b.color(C.metalDark).material(0.5, 0.4);
    b.push(); b.translate(2.05, 1.06, D.halfW + 0.02); b.rotateY(PI / 2); b.cylinder(0.075, 0.075, 0.05, 16); b.pop();
    b.color(C.chrome).material(0.3, 0.9);
    b.push(); b.translate(2.05, 1.06, D.halfW + 0.05); b.rotateY(PI / 2); b.lathe([[0.06, 0], [0.075, 0.008], [0.07, 0.02], [0, 0.022]], 16); b.pop();
    b.color([0.30, 0.30, 0.32]).material(0.6, 0.3);
    b.push(); b.translate(-1.05, 1.10, D.halfW + 0.02); b.roundedBox(0.34, 0.30, 0.03, 0.03, 2); b.pop();
    b.endPart();

    // 车内窗帘（褶皱用旋成体近似）
    b.group('interior').part('curtains', 'part').color([0.52, 0.44, 0.36]).material(0.9, 0.0);
    const curtain = (x, z, w, h) => {
      const s = Math.sign(z);
      for (let i = 0; i < 7; i++) {
        const zz = -w / 2 + w * (i + 0.5) / 7;
        b.push(); b.translate(x + zz, h, z - s * 0.055); b.rotateX(PI);
        b.lathe([[0.028, 0], [0.036, 0.12], [0.030, 0.30], [0.034, 0.46], [0.026, 0.58]], 7);
        b.pop();
      }
      b.color(C.metalMid).material(0.4, 0.7);
      b.push(); b.translate(x, h + 0.02, z - s * 0.055); b.rotateY(PI / 2); b.cylinder(0.010, 0.010, w + 0.10, 8); b.pop();
      b.color([0.52, 0.44, 0.36]).material(0.9, 0.0);
    };
    curtain(0.55, -D.halfW, 1.45, 2.30);
    curtain(-1.35, -D.halfW, 1.00, 2.30);
    curtain(-0.30, D.halfW, 1.20, 2.30);
    b.endPart();

    // 后部货架 + 试剂瓶阵列
    b.group('lab').part('shelf', 'part').color([0.46, 0.38, 0.30]).material(0.6, 0.05);
    b.push(); b.translate(-3.05, 1.86, -0.98); b.roundedBox(1.30, 0.04, 0.34, 0.015, 2); b.pop();
    b.push(); b.translate(-3.05, 2.20, -0.98); b.roundedBox(1.30, 0.04, 0.34, 0.015, 2); b.pop();
    for (const s of [-1, 1]) {
      b.push(); b.translate(-3.05 + s * 0.64, 2.03, -0.98); b.roundedBox(0.03, 0.40, 0.32, 0.01, 2); b.pop();
    }
    b.endPart();
    b.part('reagents', 'part');
    for (let i = 0; i < 9; i++) {
      const x = -3.60 + i * 0.135, y = i < 5 ? 1.88 : 2.22, xx = i < 5 ? x : -3.55 + (i - 5) * 0.16;
      const cols = [[0.82, 0.78, 0.62], [0.30, 0.48, 0.34], [0.74, 0.72, 0.68], [0.52, 0.30, 0.22], [0.30, 0.42, 0.60]];
      b.color(jitter(cols[i % 5], 0.06, rnd)).material(0.35, 0.0);
      b.push(); b.translate(xx, y, -0.98 + (rnd() - 0.5) * 0.12);
      const hh = 0.14 + rnd() * 0.10;
      b.lathe([[0, 0], [0.040, 0.004], [0.042, 0.02], [0.040, hh * 0.78], [0.020, hh * 0.9], [0.020, hh], [0.026, hh + 0.012]], 14);
      b.pop();
    }
    b.endPart();
    // 纸巾卷、马克杯、笔记本、工具箱、储物筐
    b.part('smallProps', 'part');
    b.color([0.90, 0.89, 0.86]).material(0.7, 0.0);
    b.push(); b.translate(0.95, 1.72, 0.94); b.rotateZ(PI / 2); b.lathe([[0.022, -0.11], [0.055, -0.10], [0.055, 0.10], [0.022, 0.11]], 16); b.pop();
    b.color([0.78, 0.76, 0.70]).material(0.4, 0.05);
    b.push(); b.translate(-1.95, 1.66, 0.62);
    b.lathe([[0, 0], [0.042, 0.004], [0.044, 0.02], [0.042, 0.09], [0.046, 0.095], [0.038, 0.098]], 16);
    b.push(); b.translate(0.055, 0.05, 0); b.rotateY(PI / 2); b.torus(0.030, 0.008, 14, 6, PI * 1.1); b.pop();
    b.pop();
    b.color([0.80, 0.78, 0.72]).material(0.8, 0.0);
    b.push(); b.translate(-2.55, 1.45, 0.42); b.rotateY(0.3); b.roundedBox(0.24, 0.02, 0.32, 0.006, 2); b.pop();
    b.color([0.20, 0.22, 0.26]).material(0.5, 0.1);
    b.push(); b.translate(-2.52, 1.47, 0.40); b.rotateY(0.3); b.rotateZ(0.1); b.cylinder(0.006, 0.005, 0.14, 8); b.pop();
    b.color([0.70, 0.20, 0.12]).material(0.45, 0.15);
    b.push(); b.translate(0.30, D.floorY + 0.11, -1.02); b.roundedBox(0.42, 0.20, 0.24, 0.03, 3); b.pop();
    b.color(C.chrome).material(0.3, 0.9);
    b.push(); b.translate(0.30, D.floorY + 0.23, -1.02); b.rotateY(PI / 2); b.tube([[0, 0, -0.06], [0, 0.03, 0], [0, 0, 0.06]], 0.008, 6); b.pop();
    b.color([0.32, 0.34, 0.38]).material(0.6, 0.05);
    b.push(); b.translate(-1.55, D.floorY + 0.13, -1.02);
    for (let i = 0; i < 8; i++) {
      b.push(); b.translate(0, -0.13 + i * 0.035, 0); b.rotateX(PI / 2); b.torus(0.19, 0.010, 4, 4); b.pop();
    }
    b.pop();
    b.endPart();
    // 拖把与扫帚
    b.part('mop', 'part').color([0.62, 0.52, 0.36]).material(0.8, 0.0);
    b.push(); b.translate(-3.72, D.floorY, 1.02); b.rotateZ(0.14); b.rotateX(-0.1);
    b.cylinder(0.016, 0.014, 1.30, 8, { center: false });
    b.color([0.75, 0.72, 0.62]).material(0.9, 0.0);
    b.push(); b.translate(0, 0.06, 0); b.lathe([[0.02, 0], [0.09, 0.02], [0.075, 0.16], [0.02, 0.18]], 12); b.pop();
    b.pop();
    b.endPart();

    /* ================= 追加细节 B：生活道具与车外装备 ================= */
    b.group('lab').part('coffeeMaker', 'part');
    b.color([0.18, 0.18, 0.20]).material(0.5, 0.1);
    b.push(); b.translate(-0.35, 1.65, 1.02); b.roundedBox(0.20, 0.30, 0.22, 0.03, 3); b.pop();
    b.color(C.glassLab).material(0.1, 0.0);
    b.push(); b.translate(-0.35, 1.70, 0.90); b.lathe([[0, 0], [0.055, 0.004], [0.058, 0.10], [0.05, 0.12]], 16); b.pop();
    b.color([0.35, 0.20, 0.10]).material(0.25, 0.0);
    b.push(); b.translate(-0.35, 1.72, 0.90); b.cylinder(0.05, 0.05, 0.05, 16); b.pop();
    b.endPart();
    b.part('tvSet', 'part');
    b.color([0.22, 0.22, 0.24]).material(0.5, 0.1);
    b.push(); b.translate(-2.55, 2.02, 1.02); b.rotateY(-0.35); b.roundedBox(0.36, 0.30, 0.30, 0.03, 3);
    b.color([0.12, 0.14, 0.16]).material(0.2, 0.1, 0.12);
    b.push(); b.translate(-0.19, 0.01, 0); b.rotateY(PI / 2); b.roundedBox(0.24, 0.22, 0.02, 0.02, 2); b.pop();
    b.color(C.metalMid).material(0.4, 0.7);
    b.push(); b.translate(0.05, 0.17, 0.06); b.rotateZ(0.5); b.cylinder(0.005, 0.003, 0.30, 6); b.pop();
    b.pop();
    b.endPart();
    b.part('wallClock', 'part');
    b.color([0.85, 0.83, 0.78]).material(0.5, 0.0);
    b.push(); b.translate(-1.95, 2.24, -1.08); b.rotateX(-PI / 2);
    b.lathe([[0, 0], [0.085, 0.004], [0.09, 0.02], [0.075, 0.03]], 20);
    b.color([0.2, 0.2, 0.2]).material(0.4, 0.1);
    b.push(); b.translate(0, 0.032, 0); b.rotateZ(0.4); b.roundedBox(0.055, 0.004, 0.006, 0.002, 1); b.pop();
    b.push(); b.translate(0, 0.032, 0); b.rotateZ(-1.1); b.roundedBox(0.038, 0.004, 0.006, 0.002, 1); b.pop();
    b.pop();
    b.endPart();
    b.part('towel', 'part').color([0.70, 0.62, 0.50]).material(0.9, 0.0);
    b.push(); b.translate(0.95, 1.42, 0.62); b.rotateX(PI / 2); b.rotateZ(0.06);
    const tv2 = b.vertexCount();
    b.plane(0.26, 0.40, 5, 6, [0, 1, 0]);
    b.distortLast(b.vertexCount() - tv2, 0.03, 14, 5.1);
    b.pop();
    b.endPart();
    b.part('spiceRack', 'part');
    b.color([0.44, 0.36, 0.28]).material(0.6, 0.05);
    b.push(); b.translate(1.05, 1.98, 1.08); b.roundedBox(0.40, 0.03, 0.14, 0.01, 2); b.pop();
    for (let i = 0; i < 6; i++) {
      b.color(jitter([0.62, 0.50, 0.32], 0.22, rnd)).material(0.4, 0.0);
      b.push(); b.translate(0.90 + i * 0.06, 2.03, 1.06);
      b.lathe([[0, 0], [0.019, 0.003], [0.020, 0.055], [0.012, 0.065], [0.012, 0.078]], 12); b.pop();
    }
    b.endPart();
    b.part('floorMat', 'part').color([0.28, 0.26, 0.24]).material(0.9, 0.0);
    b.push(); b.translate(1.62, D.floorY + 0.02, 0.72); b.roundedBox(0.70, 0.02, 0.52, 0.04, 2); b.pop();
    b.endPart();
    // 车外：折叠椅、油桶、铁锹、路锥
    b.group('props').part('campChair', 'part');
    b.color([0.40, 0.42, 0.46]).material(0.5, 0.5);
    b.push(); b.translate(2.2, 0, D.halfW + 0.55); b.rotateY(-0.4); b.rotateZ(-0.10);
    for (const s of [-1, 1]) {
      b.tube([[s * 0.20, 0.02, -0.18], [s * 0.20, 0.50, -0.14], [s * 0.19, 0.92, -0.06]], 0.016, 6);
      b.tube([[s * 0.20, 0.02, 0.20], [s * 0.20, 0.48, 0.10]], 0.016, 6);
    }
    b.color([0.24, 0.34, 0.42]).material(0.85, 0.0);
    b.push(); b.translate(0, 0.50, 0.0); b.roundedBox(0.42, 0.03, 0.36, 0.01, 2); b.pop();
    b.push(); b.translate(0, 0.76, -0.10); b.rotateX(0.25); b.roundedBox(0.40, 0.34, 0.03, 0.01, 2); b.pop();
    b.pop();
    b.endPart();
    b.part('jerryCan', 'part');
    b.color([0.32, 0.38, 0.28]).material(0.55, 0.1);
    b.push(); b.translate(-3.2, 0.18, D.halfW + 0.45); b.rotateY(0.3); b.roundedBox(0.36, 0.36, 0.16, 0.03, 3);
    b.color([0.26, 0.30, 0.22]).material(0.6, 0.1);
    b.push(); b.translate(0, 0.20, 0); b.rotateX(PI / 2); b.torus(0.07, 0.014, 12, 6, PI); b.pop();
    b.color(C.metalDark).material(0.5, 0.4);
    b.push(); b.translate(0.10, 0.19, 0); b.cylinder(0.032, 0.03, 0.04, 10); b.pop();
    b.pop();
    b.endPart();
    b.part('shovel', 'part');
    b.color([0.55, 0.44, 0.30]).material(0.85, 0.0);
    b.push(); b.translate(-2.4, 0.02, D.halfW + 0.30); b.rotateZ(1.15); b.rotateY(0.4);
    b.cylinder(0.018, 0.016, 1.05, 8, { center: false });
    b.color(C.metalMid).material(0.45, 0.7);
    b.push(); b.translate(0, -0.02, 0); b.rotateX(PI); b.lathe([[0.02, 0], [0.11, 0.06], [0.10, 0.22], [0.03, 0.26]], 8); b.pop();
    b.pop();
    b.endPart();
    b.part('cones', 'part');
    for (let i = 0; i < 2; i++) {
      b.color([0.85, 0.32, 0.10]).material(0.6, 0.0);
      b.push(); b.translate(3.6 + i * 0.9, 0.0, D.halfW + 0.9 - i * 0.5);
      b.lathe([[0.18, 0], [0.19, 0.03], [0.10, 0.10], [0.045, 0.36], [0.03, 0.40]], 14);
      b.color([0.92, 0.92, 0.90]).material(0.6, 0.0);
      b.push(); b.translate(0, 0.22, 0); b.cylinder(0.062, 0.055, 0.06, 14, { caps: false }); b.pop();
      b.pop();
    }
    b.endPart();

    const geo = b.build();
    geo.meta = {
      title: '沃尔特的房车 · Fleetwood Bounder（致敬《绝命毒师》）',
      dims: { length: D.xNose - (D.xRear - 0.10), width: D.halfW * 2, height: D.roofY + 0.36 },
      groups: Object.keys(geo.groupRanges)
    };
    return geo;
  }

  /* ------------------------- 热点标签（中文名） ------------------------- */
  const LABELS = {
    roundFlask: '圆底烧瓶（反应容器）',
    condenser: '蛇形冷凝管',
    heatingMantle: '加热套 / 电热包',
    crystalTray: '结晶托盘（剧集标志道具）',
    barrelBlue1: '化学原料桶',
    gasMask: '防毒面具',
    extinguisher: '灭火器',
    driverSeat: '驾驶座',
    steeringWheel: '方向盘',
    dashboard: '仪表台',
    dinette: '餐桌与长椅',
    fridge: '冰箱',
    roofAC: '顶置空调',
    rearLadder: '车尾爬梯',
    entryDoor: '侧门与折叠踏步',
    headlights: '前大灯',
    wheel1: '前轮（含胎面花纹）'
  };

  return { build, LABELS, D, C };
});
