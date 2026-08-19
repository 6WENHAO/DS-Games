/* ============================================================
   poly3d.js — 软件低多面数渲染器
   刻意复刻 NDS 时代的特征：
   ・顶点投影后取整（低子像素精度 → 特有的“抖动”）
   ・每面平光 + 阶梯化明暗（赛璐璐）
   ・画家算法排序（无逐像素深度缓冲）
   ・仿射式 UV（用双线性映射画面内细节）
   ・雾化衰减
   ============================================================ */
(function (AA) {
  'use strict';
  var U = AA.U, PX = AA.PX;
  var P3 = AA.P3 = {};

  /* ---------------- 向量 / 矩阵 ---------------- */
  function v3(x, y, z) { return [x, y, z]; }
  P3.v3 = v3;
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
  function cross(a, b) {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function norm(a) {
    var l = Math.sqrt(dot(a, a)) || 1;
    return [a[0] / l, a[1] / l, a[2] / l];
  }
  P3.sub = sub; P3.add = add; P3.cross = cross; P3.dot = dot; P3.norm = norm;

  function matIdent() { return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; }
  function matMul(a, b) {
    var o = new Array(16);
    for (var i = 0; i < 4; i++) for (var j = 0; j < 4; j++) {
      o[i * 4 + j] = a[i * 4] * b[j] + a[i * 4 + 1] * b[4 + j] + a[i * 4 + 2] * b[8 + j] + a[i * 4 + 3] * b[12 + j];
    }
    return o;
  }
  function matTrans(x, y, z) { var m = matIdent(); m[12] = x; m[13] = y; m[14] = z; return m; }
  function matScale(x, y, z) { var m = matIdent(); m[0] = x; m[5] = y == null ? x : y; m[10] = z == null ? x : z; return m; }
  function matRotY(a) { var c = Math.cos(a), s = Math.sin(a), m = matIdent(); m[0] = c; m[2] = -s; m[8] = s; m[10] = c; return m; }
  function matRotX(a) { var c = Math.cos(a), s = Math.sin(a), m = matIdent(); m[5] = c; m[6] = s; m[9] = -s; m[10] = c; return m; }
  function matRotZ(a) { var c = Math.cos(a), s = Math.sin(a), m = matIdent(); m[0] = c; m[1] = s; m[4] = -s; m[5] = c; return m; }
  function xform(m, p) {
    return [
      m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
      m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
      m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]
    ];
  }
  function xformDir(m, p) {
    return [
      m[0] * p[0] + m[4] * p[1] + m[8] * p[2],
      m[1] * p[0] + m[5] * p[1] + m[9] * p[2],
      m[2] * p[0] + m[6] * p[1] + m[10] * p[2]
    ];
  }
  P3.mat = {
    ident: matIdent, mul: matMul, trans: matTrans, scale: matScale,
    rotX: matRotX, rotY: matRotY, rotZ: matRotZ, xform: xform
  };

  /* ---------------- 网格构造辅助 ---------------- */
  /**
   * Mesh = { v: [[x,y,z]...], f: [face] }
   * face = { i:[a,b,c(,d)], c:'#rrggbb', shade:1, det:[{u,v,w,h,c}], grad:['#a','#b'],
   *          both:false（是否双面）, bias:0（排序偏移）, edge:'#..' , unlit:false }
   */
  function Mesh() { this.v = []; this.f = []; }
  Mesh.prototype.pt = function (x, y, z) { this.v.push([x, y, z]); return this.v.length - 1; };
  Mesh.prototype.quad = function (a, b, c, d, opt) {
    var f = Object.assign({ i: [a, b, c, d] }, opt || {});
    this.f.push(f); return f;
  };
  Mesh.prototype.tri = function (a, b, c, opt) {
    var f = Object.assign({ i: [a, b, c] }, opt || {});
    this.f.push(f); return f;
  };
  /** 长方体：以 (x,y,z) 为最小角，尺寸 w,h,d。faces 可分别指定颜色
   *  绕序统一为「从外侧看逆时针」(CCW)，与背面剔除约定一致 */
  Mesh.prototype.box = function (x, y, z, w, h, d, opt) {
    if (!isFinite(w) || !isFinite(h) || !isFinite(d)) {
      console.error('Mesh.box: 尺寸参数无效（是否漏了 depth？）', x, y, z, w, h, d);
      return this.v.length;
    }
    opt = opt || {};
    var c = opt.c || '#888888';
    var top = opt.top || U.hilite(c, .22);
    var side = opt.side || c;
    var side2 = opt.side2 || U.shadow(c, .30);
    var front = opt.front || U.mix(side, side2, .35);
    var bottom = opt.bottom || U.shadow(c, .55);
    var b = this.v.length;
    this.pt(x, y, z); this.pt(x + w, y, z); this.pt(x + w, y, z + d); this.pt(x, y, z + d);          // 0-3 底
    this.pt(x, y + h, z); this.pt(x + w, y + h, z); this.pt(x + w, y + h, z + d); this.pt(x, y + h, z + d); // 4-7 顶
    var o = { bias: opt.bias, both: opt.both, unlit: opt.unlit, edge: opt.edge, occl: opt.occl };
    if (!opt.noTop) this.quad(b + 4, b + 7, b + 6, b + 5, Object.assign({ c: top, det: opt.detTop, grad: opt.gradTop }, o));
    if (!opt.noBottom) this.quad(b + 0, b + 1, b + 2, b + 3, Object.assign({ c: bottom }, o));
    if (!opt.noFront) this.quad(b + 0, b + 4, b + 5, b + 1, Object.assign({ c: front, det: opt.detFront, grad: opt.gradFront }, o)); // -z
    if (!opt.noBack) this.quad(b + 3, b + 2, b + 6, b + 7, Object.assign({ c: side2, det: opt.detBack }, o));  // +z
    if (!opt.noLeft) this.quad(b + 0, b + 3, b + 7, b + 4, Object.assign({ c: side2, det: opt.detLeft }, o));  // -x
    if (!opt.noRight) this.quad(b + 1, b + 5, b + 6, b + 2, Object.assign({ c: side, det: opt.detRight }, o)); // +x
    return b;
  };
  /** 水平面（法线 +Y） */
  Mesh.prototype.plane = function (x, y, z, w, d, opt) {
    var b = this.v.length;
    this.pt(x, y, z); this.pt(x, y, z + d); this.pt(x + w, y, z + d); this.pt(x + w, y, z);
    this.quad(b, b + 1, b + 2, b + 3, opt);
    return b;
  };
  /** 竖直面（法线 +Z） */
  Mesh.prototype.wall = function (x, y, z, w, h, opt) {
    var b = this.v.length;
    this.pt(x, y, z); this.pt(x + w, y, z); this.pt(x + w, y + h, z); this.pt(x, y + h, z);
    this.quad(b, b + 1, b + 2, b + 3, opt);
    return b;
  };
  /** 侧向面（法线 +X / -X），在 x 平面上，沿 z 延伸 */
  Mesh.prototype.wallX = function (x, y, z, d, h, opt) {
    var b = this.v.length;
    this.pt(x, y, z); this.pt(x, y + h, z); this.pt(x, y + h, z + d); this.pt(x, y, z + d);
    this.quad(b, b + 1, b + 2, b + 3, opt);   // 法线 +X
    return b;
  };
  /** 棱柱（多边形截面拉伸，用于柱子） */
  Mesh.prototype.prism = function (cx, cz, r, y0, y1, n, opt) {
    opt = opt || {};
    var base = this.v.length, i;
    for (i = 0; i < n; i++) {
      var a = i / n * Math.PI * 2 + (opt.rot || 0);
      this.pt(cx + Math.cos(a) * r, y0, cz + Math.sin(a) * r);
    }
    for (i = 0; i < n; i++) {
      var a2 = i / n * Math.PI * 2 + (opt.rot || 0);
      this.pt(cx + Math.cos(a2) * r, y1, cz + Math.sin(a2) * r);
    }
    for (i = 0; i < n; i++) {
      var j = (i + 1) % n;
      this.quad(base + i, base + n + i, base + n + j, base + j,
        { c: opt.c || '#999', grad: opt.grad, bias: opt.bias, both: opt.both, occl: opt.occl });
    }
    if (!opt.noCap) {
      var top = [];
      for (i = n - 1; i >= 0; i--) top.push(base + n + i);
      this.f.push({ i: top, c: opt.top || U.hilite(opt.c || '#999', .2), bias: opt.bias, both: opt.both, occl: opt.occl });
    }
    return base;
  };
  P3.Mesh = function () { return new Mesh(); };

  /* ---------------- 渲染器 ---------------- */
  function Renderer(ctx, w, h) {
    this.ctx = ctx; this.w = w; this.h = h;
    this.cam = { eye: [0, 40, 120], target: [0, 30, 0], up: [0, 1, 0], fov: 42, roll: 0 };
    this.light = norm([-0.42, 0.78, -0.46]);
    this.ambient = 0.52;
    this.bands = 5;
    this.fog = { color: '#1a2038', near: 260, far: 620, k: 0.85 };
    this.jitter = true;
    this.list = [];
    this.colors = Object.create(null);
    this._vm = matIdent();
  }

  Renderer.prototype.setCamera = function (c) {
    if (c.eye) this.cam.eye = c.eye;
    if (c.target) this.cam.target = c.target;
    if (c.fov) this.cam.fov = c.fov;
    if (c.up) this.cam.up = c.up;
    if (c.roll != null) this.cam.roll = c.roll;
  };

  Renderer.prototype._buildView = function () {
    var c = this.cam;
    var zA = norm(sub(c.eye, c.target));
    var up = c.up || [0, 1, 0];
    if (c.roll) {
      var ca = Math.cos(c.roll), sa = Math.sin(c.roll);
      var xTmp = norm(cross(up, zA));
      up = norm(add([up[0] * ca, up[1] * ca, up[2] * ca], [xTmp[0] * sa, xTmp[1] * sa, xTmp[2] * sa]));
    }
    var xA = norm(cross(up, zA));
    var yA = cross(zA, xA);
    var e = c.eye;
    this._vm = [
      xA[0], yA[0], zA[0], 0,
      xA[1], yA[1], zA[1], 0,
      xA[2], yA[2], zA[2], 0,
      -dot(xA, e), -dot(yA, e), -dot(zA, e), 1
    ];
    this._f = (this.h / 2) / Math.tan(this.cam.fov * 0.5 * U.deg);
  };

  Renderer.prototype.begin = function () {
    this.list.length = 0;
    this.colors = Object.create(null);
    this._buildView();
  };

  Renderer.prototype._viewPt = function (p) {
    var m = this._vm;
    return [
      m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
      m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
      m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]
    ];
  };

  /** 世界坐标 → 屏幕；返回 null 表示在相机后方 */
  Renderer.prototype.project = function (p) {
    if (!this._f) this._buildView();
    var v = this._viewPt(p);
    var z = -v[2];
    if (z < 0.6) return null;
    return {
      x: this.w / 2 + v[0] * this._f / z,
      y: this.h / 2 - v[1] * this._f / z,
      z: z,
      s: this._f / z
    };
  };
  /** 每单位世界长度对应的像素数（用于精灵缩放） */
  Renderer.prototype.pxPerUnit = function (p) {
    var v = this._viewPt(p); var z = -v[2];
    return z < 0.6 ? 0 : this._f / z;
  };

  var NEAR = 4;

  /** 视空间近平面裁剪（保留 -z >= NEAR 的部分） */
  function clipNear(poly) {
    var out = [], n = poly.length;
    for (var i = 0; i < n; i++) {
      var a = poly[i], b = poly[(i + 1) % n];
      var da = -a[2] - NEAR, db = -b[2] - NEAR;
      if (da >= 0) out.push(a);
      if ((da >= 0) !== (db >= 0)) {
        var t = da / (da - db);
        out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
      }
    }
    return out;
  }

  Renderer.prototype.mesh = function (mesh, model) {
    var vs = mesh.v, fs = mesh.f;
    var n = vs.length;
    var world = new Array(n), view = new Array(n);
    var i;
    for (i = 0; i < n; i++) {
      var wp = model ? xform(model, vs[i]) : vs[i];
      world[i] = wp;
      view[i] = this._viewPt(wp);
    }
    var cx = this.w / 2, cy = this.h / 2, F = this._f, jit = this.jitter;
    for (i = 0; i < fs.length; i++) {
      var f = fs[i], idx = f.i, m = idx.length;
      // 世界法线（用于光照，取未裁剪的原始顶点）
      var w0 = world[idx[0]], w1 = world[idx[1]], w2 = world[idx[2]];
      var nrm = norm(cross(sub(w1, w0), sub(w2, w0)));

      var vpoly = new Array(m), anyNear = false, allBehind = true;
      for (var k = 0; k < m; k++) {
        var vp = view[idx[k]];
        vpoly[k] = vp;
        if (-vp[2] < NEAR) anyNear = true; else allBehind = false;
      }
      if (allBehind) continue;
      if (anyNear) { vpoly = clipNear(vpoly); if (vpoly.length < 3) continue; }

      var pts = new Array(vpoly.length), zsum = 0;
      for (var k2 = 0; k2 < vpoly.length; k2++) {
        var v = vpoly[k2], z = -v[2];
        var sx = cx + v[0] * F / z, sy = cy - v[1] * F / z;
        pts[k2] = jit ? [Math.round(sx), Math.round(sy), z] : [sx, sy, z];
        zsum += z;
      }
      // 背面剔除（屏幕空间面积；y 向下 → 正面为负）
      var area = 0, L = pts.length;
      for (var a = 0; a < L; a++) {
        var p1 = pts[a], p2 = pts[(a + 1) % L];
        area += p1[0] * p2[1] - p2[0] * p1[1];
      }
      if (!f.both && !mesh.noCull && area >= 0) continue;
      if (Math.abs(area) < 0.75) continue;
      this.list.push({ f: f, pts: pts, z: zsum / L + (f.bias || 0), n: nrm, flip: area > 0 });
    }
  };

  Renderer.prototype.sprite3d = function (pos, cv, opt) {
    var p = this.project(pos);
    if (!p) return null;
    this.list.push({ spr: cv, sp: p, z: p.z + ((opt && opt.bias) || 0), o: opt || {} });
    return p;
  };
  /** 插入一个自定义绘制（跟随深度排序） */
  Renderer.prototype.custom = function (z, fn) { this.list.push({ fn: fn, z: z }); };

  /* 明暗阶梯化 */
  Renderer.prototype._shadeColor = function (base, nrm, zc, unlit) {
    if (unlit) return base;
    var d = dot(nrm, this.light);
    var lit = this.ambient + (1 - this.ambient) * Math.max(0, d);
    // 背面补光（避免全黑）
    lit += Math.max(0, -d) * 0.12;
    var b = this.bands;
    lit = Math.round(lit * b) / b;
    var col = lit >= 1 ? base : (lit > 0.999 ? base : (lit < 1 ? mixShade(base, lit) : base));
    if (this.fog && this.fog.k > 0) {
      var t = U.sat((zc - this.fog.near) / (this.fog.far - this.fog.near)) * this.fog.k;
      if (t > 0.002) col = U.mix(col, this.fog.color, t);
    }
    return col;
  };
  function mixShade(base, lit) {
    if (lit >= 1.0) return U.hilite(base, Math.min(.45, (lit - 1) * 1.2));
    return U.shadow(base, U.sat(1 - lit) * 1.05);
  }

  Renderer.prototype.end = function (opt) {
    opt = opt || {};
    var ctx = this.ctx;
    this.list.sort(function (a, b) { return b.z - a.z; });
    for (var i = 0; i < this.list.length; i++) {
      var it = this.list[i];
      if (it.fn) { it.fn(ctx, this); continue; }
      if (it.spr) { drawSprite(ctx, it); continue; }
      var f = it.f, pts = it.pts;
      var nrm = it.flip ? [-it.n[0], -it.n[1], -it.n[2]] : it.n;
      it.n = nrm;
      var col = this._shadeColor(f.c || '#888888', nrm, it.z, f.unlit);
      this.colors[col] = 1;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (var k = 1; k < pts.length; k++) ctx.lineTo(pts[k][0], pts[k][1]);
      ctx.closePath();
      if (f.grad && pts.length >= 3) {
        var g = ctx.createLinearGradient(pts[0][0], pts[0][1], pts[2][0], pts[2][1]);
        var c1 = this._shadeColor(f.grad[0], nrm, it.z, f.unlit);
        var c2 = this._shadeColor(f.grad[1], nrm, it.z, f.unlit);
        this.colors[c1] = 1; this.colors[c2] = 1;
        g.addColorStop(0, c1); g.addColorStop(1, c2);
        ctx.fillStyle = g;
      } else ctx.fillStyle = col;
      ctx.fill();
      if (f.edge) {
        ctx.strokeStyle = this._shadeColor(f.edge, it.n, it.z, true);
        this.colors[ctx.strokeStyle] = 1;
        ctx.lineWidth = 1; ctx.stroke();
      }
      // 面内细节（仿射 UV）
      if (f.det && pts.length === 4) drawDetails(this, ctx, f, pts, it);
    }
  };

  function drawSprite(ctx, it) {
    var cv = it.spr, o = it.o, p = it.sp;
    var sc = o.scale == null ? 1 : o.scale;
    var w = Math.round(cv.width * sc), h = Math.round(cv.height * sc);
    var x = Math.round(p.x - w * (o.ax == null ? 0.5 : o.ax));
    var y = Math.round(p.y - h * (o.ay == null ? 1 : o.ay));
    if (o.alpha != null) { ctx.save(); ctx.globalAlpha = o.alpha; }
    ctx.drawImage(cv, x, y, w, h);
    if (o.alpha != null) ctx.restore();
  }

  function drawDetails(R, ctx, f, pts, it) {
    var p0 = pts[0], p1 = pts[1], p2 = pts[2], p3 = pts[3];
    function map(u, v) {
      var ax = p0[0] + (p1[0] - p0[0]) * u, ay = p0[1] + (p1[1] - p0[1]) * u;
      var bx = p3[0] + (p2[0] - p3[0]) * u, by = p3[1] + (p2[1] - p3[1]) * u;
      return [ax + (bx - ax) * v, ay + (by - ay) * v];
    }
    for (var i = 0; i < f.det.length; i++) {
      var d = f.det[i];
      var c = R._shadeColor(d.c, it.n, it.z, d.unlit || f.unlit);
      R.colors[c] = 1;
      if (d.pts) {
        ctx.beginPath();
        for (var q = 0; q < d.pts.length; q++) {
          var mp = map(d.pts[q][0], d.pts[q][1]);
          if (q === 0) ctx.moveTo(mp[0], mp[1]); else ctx.lineTo(mp[0], mp[1]);
        }
        ctx.closePath();
      } else {
        var a = map(d.u, d.v), b = map(d.u + d.w, d.v), cc = map(d.u + d.w, d.v + d.h), dd = map(d.u, d.v + d.h);
        ctx.beginPath();
        ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(cc[0], cc[1]); ctx.lineTo(dd[0], dd[1]);
        ctx.closePath();
      }
      if (d.stroke) { ctx.strokeStyle = c; ctx.lineWidth = d.lw || 1; ctx.stroke(); }
      else { ctx.fillStyle = c; ctx.fill(); }
    }
  }

  Renderer.prototype.palette = function () {
    var out = [];
    for (var k in this.colors) out.push(U.hex2rgb(k));
    return out;
  };

  P3.renderer = function (ctx, w, h) { return new Renderer(ctx, w, h); };

  /* ---------------- 相机预设与插值 ---------------- */
  P3.lerpCam = function (a, b, t, ease) {
    var e = (ease || U.ease.inOutCubic)(U.sat(t));
    function L(x, y) { return [U.lerp(x[0], y[0], e), U.lerp(x[1], y[1], e), U.lerp(x[2], y[2], e)]; }
    return {
      eye: L(a.eye, b.eye),
      target: L(a.target, b.target),
      fov: U.lerp(a.fov || 42, b.fov || 42, e),
      roll: U.lerp(a.roll || 0, b.roll || 0, e)
    };
  };

})(window.AA);
