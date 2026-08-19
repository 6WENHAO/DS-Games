/* =====================================================================
 * geom.js —— 全部几何都在浏览器里用代码生成（不依赖任何建模软件）
 *
 * 关键点：
 *  · 齿轮是真的有齿的（梯形近似渐开线），齿数/模数/中心距严格匹配，
 *    因此啮合处不会穿模；所有传动比都用真实齿数计算。
 *  · 凸轮的外形由 machine.js 里驱动机构的同一个 profile 函数生成，
 *    所以"凸轮形状"与"从动件位移"在几何上一致，不是装饰。
 *  · 数字环是 10 个带图集 UV 的四边形，数字 d 贴在局部方位角 -d·36°，
 *    于是轮子转角 a = d·36° 时数字 d 正对前方窗口 —— 与内核读数公式一致。
 * ===================================================================== */
(function (root) {
  'use strict';
  var DE = root.DE || (root.DE = {});
  var TAU = Math.PI * 2;

  /* ------------------------------------------------------------------
   * 合并几何（自己实现，避免依赖 examples/jsm）
   * items: [{ geometry, matrix? }]
   * ------------------------------------------------------------------ */
  function mergeGeometries(items) {
    var THREE = root.THREE;
    var pos = [], nor = [], i, j;
    for (i = 0; i < items.length; i++) {
      var g = items[i].geometry;
      if (g.index) g = g.toNonIndexed();
      var m = items[i].matrix || null;
      var p = g.attributes.position.array;
      var n = g.attributes.normal ? g.attributes.normal.array : null;
      var nm = null;
      if (m) { nm = new THREE.Matrix3().setFromMatrix4(m).invert().transpose(); }
      var v = new THREE.Vector3(), w = new THREE.Vector3();
      for (j = 0; j < p.length; j += 3) {
        v.set(p[j], p[j + 1], p[j + 2]);
        if (m) v.applyMatrix4(m);
        pos.push(v.x, v.y, v.z);
        if (n) {
          w.set(n[j], n[j + 1], n[j + 2]);
          if (nm) w.applyMatrix3(nm).normalize();
          nor.push(w.x, w.y, w.z);
        } else { nor.push(0, 1, 0); }
      }
    }
    var out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    return out;
  }

  /* 把 XY 平面挤出的几何转成"轴 = +Y"或"轴 = +X" */
  function orient(geometry, axis, thickness) {
    var THREE = root.THREE;
    geometry.translate(0, 0, -thickness / 2);
    if (axis === 'y') geometry.rotateX(-Math.PI / 2);
    else if (axis === 'x') geometry.rotateY(Math.PI / 2);
    return geometry;
  }

  /* ------------------------------------------------------------------
   * 直齿圆柱齿轮（梯形齿近似渐开线）
   * teeth 齿数, mod 模数 => 节圆半径 R = teeth*mod/2
   * ------------------------------------------------------------------ */
  function gearShapePoints(teeth, mod, backlash) {
    var R = teeth * mod / 2;
    var Rtip = R + mod * 0.95;
    var Rroot = R - mod * 1.15;
    var half = Math.PI / (2 * teeth) - (backlash || 0.012) / R;   // 节圆上半齿角
    if (half < 0.005) half = 0.005;
    var tipHalf = half * 0.55;
    var rootHalf = half * 1.35;
    var pts = [];
    for (var i = 0; i < teeth; i++) {
      var c = i * TAU / teeth;
      pts.push([Rroot, c - rootHalf * 1.0 - (TAU / teeth / 2 - rootHalf) * 0.55]);
      pts.push([Rroot, c - rootHalf]);
      pts.push([R, c - half]);
      pts.push([Rtip, c - tipHalf]);
      pts.push([Rtip, c + tipHalf]);
      pts.push([R, c + half]);
      pts.push([Rroot, c + rootHalf]);
      pts.push([Rroot, c + rootHalf * 1.0 + (TAU / teeth / 2 - rootHalf) * 0.55]);
    }
    return pts;
  }

  function gearGeometry(teeth, mod, thickness, bore, axis, arc) {
    var THREE = root.THREE;
    var pts = gearShapePoints(teeth, mod);
    var shape = new THREE.Shape();
    var first = true;
    var R = teeth * mod / 2, Rroot = R - mod * 1.15;
    for (var i = 0; i < pts.length; i++) {
      var r = pts[i][0], a = pts[i][1];
      // 残齿轮：只在 arc = [a0,a1] 内保留齿，其余走根圆
      if (arc) {
        var norm = ((a % TAU) + TAU) % TAU;
        var inArc = arc[0] <= arc[1]
          ? (norm >= arc[0] && norm <= arc[1])
          : (norm >= arc[0] || norm <= arc[1]);
        if (!inArc) r = Rroot;
      }
      var x = r * Math.cos(a), y = r * Math.sin(a);
      if (first) { shape.moveTo(x, y); first = false; } else { shape.lineTo(x, y); }
    }
    shape.closePath();
    if (bore > 0) {
      var hole = new THREE.Path();
      hole.absarc(0, 0, bore, 0, TAU, true);
      shape.holes.push(hole);
    }
    var g = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: 24 });
    g.computeVertexNormals();
    return orient(g, axis || 'y', thickness);
  }

  /* 节圆半径 */
  function pitchR(teeth, mod) { return teeth * mod / 2; }

  /* ------------------------------------------------------------------
   * 啮合相位：给定主动轮的角度，算出从动轮应有的基准角
   * 外啮合时两轮节圆上弧长相等、方向相反。
   * alpha = 由 A 指向 B 的方位角（在齿轮平面内）
   * ------------------------------------------------------------------ */
  function meshBaseAngle(thetaA, alpha, teethA, teethB) {
    var u = thetaA - alpha;                       // A 的齿相对中心连线的相位
    return alpha + Math.PI - Math.PI / teethB - u * teethA / teethB;
  }

  /* ------------------------------------------------------------------
   * 凸轮：半径 = base + lift * f(t)，从动件在正上方接触
   * 凸轮以 dir·(曲柄角) 旋转；接触点的局部角 phi = π/2 - dir·2πt
   *  => 轮廓半径必须写成 f( (π/2 - phi) / (dir·2π) )
   * 于是"凸轮外形"和"从动件位移"在几何上严格一致。
   * ------------------------------------------------------------------ */
  function camGeometry(f, base, lift, thickness, axis, dir) {
    var THREE = root.THREE;
    var d = dir || 1;
    var N = 288, shape = new THREE.Shape();
    for (var i = 0; i <= N; i++) {
      var phi = i / N * TAU;
      var t = (((Math.PI / 2 - phi) / (d * TAU)) % 1 + 1) % 1;
      var r = base + lift * f(t);
      var x = r * Math.cos(phi), y = r * Math.sin(phi);
      if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
    }
    shape.closePath();
    var hole = new THREE.Path();
    hole.absarc(0, 0, base * 0.28, 0, TAU, true);
    shape.holes.push(hole);
    var g = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
    g.computeVertexNormals();
    return orient(g, axis || 'x', thickness);
  }
  /* 凸轮从动件位移（与上面几何完全一致） */
  function camLift(f, lift, t) { return lift * f(t); }

  /* ------------------------------------------------------------------
   * 棘齿环（进位棘爪用）：锯齿，单向推动
   * ------------------------------------------------------------------ */
  function ratchetRingGeometry(teeth, rootR, tipR, thickness) {
    var THREE = root.THREE;
    var shape = new THREE.Shape();
    for (var i = 0; i < teeth; i++) {
      var a0 = i * TAU / teeth;
      var a1 = (i + 0.72) * TAU / teeth;
      var a2 = (i + 1) * TAU / teeth;
      if (i === 0) shape.moveTo(rootR * Math.cos(a0), rootR * Math.sin(a0));
      shape.lineTo(tipR * Math.cos(a1), tipR * Math.sin(a1));
      shape.lineTo(rootR * Math.cos(a2), rootR * Math.sin(a2));
    }
    shape.closePath();
    var hole = new THREE.Path();
    hole.absarc(0, 0, rootR * 0.45, 0, TAU, true);
    shape.holes.push(hole);
    var g = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
    g.computeVertexNormals();
    return orient(g, 'y', thickness);
  }

  /* ------------------------------------------------------------------
   * 端面齿轮（冠齿轮 / lantern）：盘面上一圈轴向销
   * 与垂直轴上的直齿小齿轮 1:1 啮合
   * ------------------------------------------------------------------ */
  function crownGearGeometry(pins, ringR, pinR, pinH, discR, discT) {
    var THREE = root.THREE;
    var items = [];
    items.push({ geometry: new THREE.CylinderGeometry(discR, discR, discT, 32), matrix: new THREE.Matrix4() });
    for (var i = 0; i < pins; i++) {
      var a = i * TAU / pins;
      var g = new THREE.CylinderGeometry(pinR, pinR, pinH, 10);
      var m = new THREE.Matrix4().makeTranslation(ringR * Math.sin(a), discT / 2 + pinH / 2, ringR * Math.cos(a));
      items.push({ geometry: g, matrix: m });
    }
    return mergeGeometries(items);
  }

  /* ------------------------------------------------------------------
   * 数字图集贴图 + 数字环几何
   * ------------------------------------------------------------------ */
  function digitAtlas() {
    var THREE = root.THREE;
    var W = 640, H = 64;
    var cv = (typeof document !== 'undefined') ? document.createElement('canvas') : null;
    if (!cv) return null;                      // 无 DOM（node 测试）时跳过
    cv.width = W; cv.height = H;
    var g = cv.getContext('2d');
    g.fillStyle = '#efe9d8'; g.fillRect(0, 0, W, H);
    g.strokeStyle = '#b9b09a'; g.lineWidth = 2;
    for (var i = 0; i < 10; i++) {
      g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, H); g.stroke();
      g.fillStyle = '#1b1b1b';
      g.font = 'bold 46px "Georgia", serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(String(i), i * 64 + 32, H / 2 + 2);
    }
    var tex = new THREE.CanvasTexture(cv);
    tex.anisotropy = 4;
    return tex;
  }

  /* 数字 d 贴在局部方位角 -d*36°，与内核 digit = round(a/36°) 一致 */
  function digitBandGeometry(radius, height) {
    var THREE = root.THREE;
    var pos = [], nor = [], uv = [];
    var w = radius * TAU / 10 * 0.86;
    for (var d = 0; d < 10; d++) {
      var th = -d * TAU / 10;
      var n = [Math.sin(th), 0, Math.cos(th)];
      var right = [Math.cos(th), 0, -Math.sin(th)];
      var c = [radius * Math.sin(th), 0, radius * Math.cos(th)];
      var u0 = d / 10, u1 = (d + 1) / 10;
      function P(sx, sy) {
        return [c[0] + right[0] * sx * w / 2, sy * height / 2, c[2] + right[2] * sx * w / 2];
      }
      var bl = P(-1, -1), br = P(1, -1), tr = P(1, 1), tl = P(-1, 1);
      var quad = [[bl, u0, 0], [br, u1, 0], [tr, u1, 1], [bl, u0, 0], [tr, u1, 1], [tl, u0, 1]];
      for (var q = 0; q < quad.length; q++) {
        pos.push(quad[q][0][0], quad[q][0][1], quad[q][0][2]);
        nor.push(n[0], n[1], n[2]);
        uv.push(quad[q][1], quad[q][2]);
      }
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    return g;
  }

  /* ------------------------------------------------------------------
   * 小工具
   * ------------------------------------------------------------------ */
  function box(w, h, d) { return new root.THREE.BoxGeometry(w, h, d); }
  function cyl(r, h, seg, axis) {
    var g = new root.THREE.CylinderGeometry(r, r, h, seg || 16);
    if (axis === 'x') g.rotateZ(Math.PI / 2);
    if (axis === 'z') g.rotateX(Math.PI / 2);
    return g;
  }
  /* 两点之间的连杆（用于摇臂/连杆，每帧可更新） */
  function setRod(mesh, a, b) {
    var THREE = root.THREE;
    var dir = new THREE.Vector3().subVectors(b, a);
    var len = dir.length();
    mesh.position.copy(a).addScaledVector(dir, 0.5);
    mesh.scale.set(1, len, 1);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  }

  /* 二连杆逆解：从 p0 到 p1，杆长 l1,l2，返回中间关节位置（平面 = YZ 或 XZ 由调用者给基向量） */
  function twoLinkIK(p0, p1, l1, l2, ex, ey, sign) {
    var THREE = root.THREE;
    var d = new THREE.Vector3().subVectors(p1, p0);
    var L = d.length();
    if (L > l1 + l2) L = l1 + l2 - 1e-6;
    var a = (l1 * l1 - l2 * l2 + L * L) / (2 * L);
    var hh = Math.max(0, l1 * l1 - a * a);
    var h = Math.sqrt(hh);
    var u = d.clone().normalize();
    // 在给定平面内取垂直方向
    var perp = new THREE.Vector3().crossVectors(u, ex.clone().cross(ey)).normalize();
    if (!isFinite(perp.x) || perp.length() < 1e-6) perp = ey.clone();
    return p0.clone().addScaledVector(u, a).addScaledVector(perp, (sign || 1) * h);
  }

  DE.geom = {
    mergeGeometries: mergeGeometries,
    gearGeometry: gearGeometry,
    pitchR: pitchR,
    meshBaseAngle: meshBaseAngle,
    camGeometry: camGeometry,
    camLift: camLift,
    ratchetRingGeometry: ratchetRingGeometry,
    crownGearGeometry: crownGearGeometry,
    digitAtlas: digitAtlas,
    digitBandGeometry: digitBandGeometry,
    box: box, cyl: cyl, setRod: setRod, twoLinkIK: twoLinkIK, orient: orient
  };
})(typeof window !== 'undefined' ? window : globalThis);
