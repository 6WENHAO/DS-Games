/* DEEP SPACE CRAFT · models.js —— 盒模型（方块化的无人深空飞船 / 空间站 / 哨兵） */
(function () {
  'use strict';
  var DSC = (window.DSC = window.DSC || {});
  var U = DSC.Util;

  var C = {
    hull: [0.90, 0.93, 0.95],      /* 白色装甲 */
    hull2: [0.74, 0.78, 0.82],
    dark: [0.17, 0.19, 0.22],      /* 深灰结构 */
    dark2: [0.10, 0.11, 0.13],
    orange: [1.00, 0.45, 0.10],    /* NMS 橙 */
    orangeD: [0.62, 0.22, 0.04],
    glass: [0.06, 0.13, 0.20],
    cyan: [0.27, 0.88, 1.00],
    engine: [1.00, 0.55, 0.18],
    engineCore: [1.00, 0.92, 0.72],
    metal: [0.42, 0.45, 0.50],
    red: [1.0, 0.22, 0.16]
  };

  function box(min, max, color, emis) { return { min: min, max: max, color: color, emis: emis || 0 }; }
  /* 沿 X 轴镜像追加 */
  function mirrorX(list) {
    var out = list.slice();
    for (var i = 0; i < list.length; i++) {
      var b = list[i];
      if (b.max[0] <= 0.001 && b.min[0] >= -0.001) continue;
      out.push(box([-b.max[0], b.min[1], b.min[2]], [-b.min[0], b.max[1], b.max[2]], b.color, b.emis));
    }
    return out;
  }

  /* ============================================================ 飞船
     朝向 -Z，尺寸约 8.6(W) × 3.4(H) × 11(L)，方块块面感 + NMS 战机剪影 */
  function shipBoxes() {
    var b = [];
    /* 主机身 */
    b.push(box([-0.95, -0.55, -4.0], [0.95, 0.85, 2.4], C.hull));
    b.push(box([-0.75, -0.72, -3.2], [0.75, -0.45, 1.9], C.dark));      /* 腹部结构 */
    /* 机鼻（分两级收窄） */
    b.push(box([-0.68, -0.35, -5.1], [0.68, 0.55, -4.0], C.hull));
    b.push(box([-0.42, -0.18, -5.9], [0.42, 0.34, -5.1], C.hull2));
    b.push(box([-0.22, -0.05, -6.25], [0.22, 0.2, -5.9], C.orange));    /* 鼻尖橙块 */
    /* 驾驶舱 */
    b.push(box([-0.62, 0.85, -2.6], [0.62, 1.62, -0.7], C.glass));
    b.push(box([-0.72, 0.75, -2.85], [0.72, 0.95, -0.55], C.dark));     /* 座舱框 */
    b.push(box([-0.30, 1.62, -2.0], [0.30, 1.78, -1.0], C.hull2));      /* 顶脊 */
    /* 主翼（三段渐薄，方块化） */
    b.push(box([-3.10, -0.10, -0.9], [-0.95, 0.22, 1.7], C.hull));
    b.push(box([-4.30, -0.06, -0.4], [-3.10, 0.16, 1.5], C.hull2));
    b.push(box([-4.30, -0.04, 0.2], [-4.85, 0.12, 1.3], C.orange));     /* 翼尖橙 */
    b.push(box([-3.95, -0.03, -0.35], [-1.20, 0.24, -0.05], C.orange)); /* 翼面警示条 */
    /* 翼下挂舱 + 侧推进器（青色发光） */
    b.push(box([-3.30, -0.52, 0.1], [-2.35, -0.10, 1.5], C.dark));
    b.push(box([-3.20, -0.44, 1.5], [-2.45, -0.16, 1.72], C.cyan, 1.6));
    /* 垂尾 */
    b.push(box([-0.14, 0.85, 1.5], [0.14, 2.55, 2.35], C.hull));
    b.push(box([-0.16, 2.15, 1.55], [0.16, 2.42, 2.30], C.orange, 0.5));
    /* 平尾 */
    b.push(box([-1.70, 0.30, 1.75], [-0.90, 0.50, 2.45], C.hull2));
    /* 主引擎（双喷口 + 炽核） */
    b.push(box([-1.55, -0.35, 2.15], [-0.35, 0.62, 2.95], C.dark));
    b.push(box([-1.42, -0.24, 2.95], [-0.48, 0.50, 3.15], C.engine, 1.8));
    b.push(box([-1.28, -0.12, 3.15], [-0.62, 0.38, 3.30], C.engineCore, 2.6));
    /* 机身细节：散热格栅、检修板、灯 */
    b.push(box([-0.98, -0.30, -1.2], [-0.90, 0.55, 0.9], C.dark2));
    b.push(box([-0.99, 0.10, -3.6], [-0.90, 0.35, -2.6], C.cyan, 1.2));
    b.push(box([-0.70, -0.60, -4.0], [-0.30, -0.52, -2.2], C.orangeD));
    /* 起落架（收起状态贴合腹部；transition 里用缩放模拟放下） */
    b.push(box([-1.05, -1.05, -2.3], [-0.75, -0.70, -1.9], C.metal));
    b.push(box([-1.05, -1.05, 1.1], [-0.75, -0.70, 1.5], C.metal));
    b.push(box([-0.18, -1.15, -3.3], [0.18, -0.72, -2.9], C.metal));
    return mirrorX(b);
  }

  /* ============================================================ 空间站
     NMS 味：橙色环 + 白色塔体 + 巨大登陆口（方块化） */
  function stationBoxes() {
    var b = [], i;
    /* 中央塔体 */
    b.push(box([-3, -14, -3], [3, 14, 3], C.hull));
    b.push(box([-4.2, -3, -4.2], [4.2, 3, 4.2], C.hull2));
    b.push(box([-4.4, -0.6, -4.4], [4.4, 0.6, 4.4], C.orange, 0.8));
    /* 登陆口（发光橙色方口） */
    b.push(box([-2.6, -2.2, -6.6], [2.6, 2.2, -4.2], C.dark));
    b.push(box([-2.2, -1.8, -6.9], [2.2, 1.8, -6.5], C.orange, 2.2));
    /* 环形结构：用 16 段方块拼 */
    for (i = 0; i < 16; i++) {
      var a = i / 16 * Math.PI * 2, r = 13;
      var x = Math.cos(a) * r, z = Math.sin(a) * r;
      b.push(box([x - 1.6, -1.0, z - 1.6], [x + 1.6, 1.0, z + 1.6], i % 4 === 0 ? C.orange : C.hull, i % 4 === 0 ? 0.6 : 0));
      if (i % 2 === 0) b.push(box([x * 0.55 - 0.6, -0.4, z * 0.55 - 0.6], [x * 0.55 + 0.6, 0.4, z * 0.55 + 0.6], C.metal));
    }
    /* 顶端天线与信号灯 */
    b.push(box([-0.4, 14, -0.4], [0.4, 19, 0.4], C.metal));
    b.push(box([-0.7, 19, -0.7], [0.7, 20.2, 0.7], C.red, 2.4));
    b.push(box([-0.7, -15.4, -0.7], [0.7, -14, 0.7], C.cyan, 1.6));
    return b;
  }

  /* ============================================================ 哨兵无人机 */
  function droneBoxes() {
    var b = [];
    b.push(box([-0.45, -0.45, -0.45], [0.45, 0.45, 0.45], C.hull));
    b.push(box([-0.5, -0.14, -0.5], [0.5, 0.14, 0.5], C.dark));
    b.push(box([-0.22, -0.22, -0.62], [0.22, 0.22, -0.45], C.red, 2.6));   /* 独眼 */
    b.push(box([-0.62, -0.1, -0.2], [-0.45, 0.1, 0.2], C.metal));
    b.push(box([0.45, -0.1, -0.2], [0.62, 0.1, 0.2], C.metal));
    b.push(box([-0.16, 0.45, -0.16], [0.16, 0.72, 0.16], C.orange, 1.2));
    return b;
  }

  /* ============================================================ 着陆平台（降落点标记） */
  function padBoxes() {
    var b = [], i;
    b.push(box([-4, -0.2, -4], [4, 0, 4], C.dark));
    for (i = 0; i < 4; i++) {
      var sx = i < 2 ? -1 : 1, sz = i % 2 === 0 ? -1 : 1;
      b.push(box([sx * 3.2 - 0.5, 0, sz * 3.2 - 0.5], [sx * 3.2 + 0.5, 0.28, sz * 3.2 + 0.5], C.orange, 1.6));
    }
    b.push(box([-3.4, 0, -0.35], [3.4, 0.05, 0.35], C.cyan, 0.9));
    b.push(box([-0.35, 0, -3.4], [0.35, 0.05, 3.4], C.cyan, 0.9));
    return b;
  }

  var cache = {};
  var defs = { ship: shipBoxes, station: stationBoxes, drone: droneBoxes, pad: padBoxes };

  DSC.Models = {
    COLORS: C,
    boxesOf: function (name) { return (defs[name] || shipBoxes)(); },
    /* 惰性构建 GL 网格 */
    get: function (name) {
      if (cache[name]) return cache[name];
      if (!DSC.Render || !DSC.Render.buildBoxModel) return null;
      cache[name] = DSC.Render.buildBoxModel((defs[name] || shipBoxes)());
      return cache[name];
    },
    dispose: function () { cache = {}; }
  };
})();
