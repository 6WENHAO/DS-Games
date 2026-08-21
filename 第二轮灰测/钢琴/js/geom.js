/* =============================================================
 * geom.js —— 通用几何 / 纹理工具库（纯白钢琴项目）
 * 仅依赖 three.js 全局 THREE，可在 file:// 下直接运行
 * ============================================================= */
(function (global) {
  'use strict';

  const T = global.THREE;
  const V2 = (x, y) => new T.Vector2(x, y);

  /* ---------- 多边形工具 ---------- */

  // 有符号面积（>0 表示逆时针 CCW）
  function signedArea(pts) {
    let a = 0;
    for (let i = 0, n = pts.length; i < n; i++) {
      const p = pts[i], q = pts[(i + 1) % n];
      a += p.x * q.y - q.x * p.y;
    }
    return a * 0.5;
  }

  // 将闭合多边形向内偏移 dist（角平分线法 + 斜接限制），用于生成琴壳内壁
  function offsetPolygon(pts, dist) {
    const n = pts.length;
    const sign = signedArea(pts) > 0 ? 1 : -1; // CCW 时内法线 = 左法线
    const out = [];
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n];
      const d1 = p1.clone().sub(p0);
      const d2 = p2.clone().sub(p1);
      if (d1.lengthSq() < 1e-12 || d2.lengthSq() < 1e-12) { out.push(p1.clone()); continue; }
      d1.normalize(); d2.normalize();
      const n1 = V2(-d1.y, d1.x).multiplyScalar(sign);
      const n2 = V2(-d2.y, d2.x).multiplyScalar(sign);
      const bis = n1.clone().add(n2);
      if (bis.lengthSq() < 1e-10) bis.copy(n2);
      bis.normalize();
      const cosHalf = Math.max(0.4, bis.dot(n2)); // 限制尖角处的过度外扩
      out.push(p1.clone().add(bis.multiplyScalar(dist / cosHalf)));
    }
    return out;
  }

  // 采样 Shape 轮廓为点数组
  function samplePoints(shape, divisions) {
    return shape.extractPoints(divisions || 64).shape.map((p) => V2(p.x, p.y));
  }

  function shapeFromPoints(pts) {
    const s = new T.Shape();
    s.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) s.lineTo(pts[i].x, pts[i].y);
    s.closePath();
    return s;
  }

  function pathFromPoints(pts) {
    const p = new T.Path();
    p.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) p.lineTo(pts[i].x, pts[i].y);
    p.closePath();
    return p;
  }

  // 点是否在多边形内（射线法）
  function pointInPolygon(pts, x, y) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i].x, yi = pts[i].y, xj = pts[j].x, yj = pts[j].y;
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  /* ---------- 挤出：把 2D 形状变成竖直的 3D 板件 ----------
   * up   : shape.y -> world -z（向琴尾），挤出方向 +y（向上）
   * down : shape.y -> world +z（向琴前），挤出方向 -y（向下）
   */
  function extrude(shape, height, opts) {
    opts = opts || {};
    const bev = opts.bevel === undefined ? 0.0035 : opts.bevel;
    const geo = new T.ExtrudeGeometry(shape, {
      depth: height,
      curveSegments: opts.curveSegments || 32,
      steps: 1,
      bevelEnabled: bev > 0,
      bevelThickness: bev,
      bevelSize: bev,
      bevelOffset: 0,
      bevelSegments: opts.bevelSegments || 2,
      UVGenerator: opts.uvGenerator,
    });
    geo.rotateX(opts.down ? Math.PI / 2 : -Math.PI / 2);
    return geo;
  }

  /* ---------- 由 8 个角点构成的棱柱（可做锥度/斜面，如黑键、踏板） ----------
   * 顺序: B0 后左, B1 后右, B2 前右, B3 前左 (底), T0..T3 (顶)
   */
  function prism8(B0, B1, B2, B3, T0, T1, T2, T3) {
    const tri = [
      T0, T3, T2, T0, T2, T1,       // 顶
      B0, B1, B2, B0, B2, B3,       // 底
      B3, B2, T2, B3, T2, T3,       // 前
      B1, B0, T0, B1, T0, T1,       // 后
      B2, B1, T1, B2, T1, T2,       // 右
      B0, B3, T3, B0, T3, T0,       // 左
    ];
    const pos = new Float32Array(tri.length * 3);
    const uv = new Float32Array(tri.length * 2);
    for (let i = 0; i < tri.length; i++) {
      pos[i * 3] = tri[i].x; pos[i * 3 + 1] = tri[i].y; pos[i * 3 + 2] = tri[i].z;
      uv[i * 2] = (i % 3) * 0.5; uv[i * 2 + 1] = Math.floor((i % 6) / 3);
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(pos, 3));
    g.setAttribute('uv', new T.BufferAttribute(uv, 2));
    g.computeVertexNormals();
    return g;
  }

  // 带锥度的方块：底面 w0×d0，顶面 w1×d1（顶面前沿可回收形成斜面）
  function taperBox(w0, w1, d0, d1, h) {
    const a = w0 / 2, b = w1 / 2;
    return prism8(
      new T.Vector3(-a, 0, 0), new T.Vector3(a, 0, 0), new T.Vector3(a, 0, d0), new T.Vector3(-a, 0, d0),
      new T.Vector3(-b, h, 0), new T.Vector3(b, h, 0), new T.Vector3(b, h, d1), new T.Vector3(-b, h, d1)
    );
  }

  /* ---------- 圆角矩形 Shape ---------- */
  function roundedRect(w, h, r) {
    const s = new T.Shape();
    const x = -w / 2, y = -h / 2;
    r = Math.min(r, Math.min(w, h) / 2);
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y);
    s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
    s.lineTo(x + w, y + h - r);
    s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
    s.lineTo(x + r, y + h);
    s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
    s.lineTo(x, y + r);
    s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
    s.closePath();
    return s;
  }

  /* ---------- 简易几何合并（同属性、已烘焙变换） ---------- */
  function merge(geos) {
    const list = geos.filter(Boolean).map((g) => (g.index ? g.toNonIndexed() : g));
    if (!list.length) return new T.BufferGeometry();
    const names = ['position', 'normal', 'uv'];
    const used = names.filter((n) => list.some((g) => g.getAttribute(n)));
    let total = 0;
    list.forEach((g) => (total += g.getAttribute('position').count));
    const out = new T.BufferGeometry();
    used.forEach((name) => {
      const size = name === 'uv' ? 2 : 3;
      const arr = new Float32Array(total * size);
      let off = 0;
      list.forEach((g) => {
        const a = g.getAttribute(name);
        const cnt = g.getAttribute('position').count;
        if (a) arr.set(a.array.subarray(0, cnt * size), off);
        off += cnt * size;
      });
      out.setAttribute(name, new T.BufferAttribute(arr, size));
    });
    if (!out.getAttribute('normal')) out.computeVertexNormals();
    return out;
  }

  // 变换后的几何副本
  function xform(geo, { pos, rot, scale } = {}) {
    const g = geo.clone();
    const m = new T.Matrix4();
    const q = new T.Quaternion();
    if (rot) q.setFromEuler(new T.Euler(rot[0] || 0, rot[1] || 0, rot[2] || 0));
    m.compose(
      new T.Vector3(pos ? pos[0] : 0, pos ? pos[1] : 0, pos ? pos[2] : 0),
      q,
      new T.Vector3(scale ? scale[0] : 1, scale ? scale[1] : 1, scale ? scale[2] : 1)
    );
    g.applyMatrix4(m);
    return g;
  }

  /* ---------- 画布纹理（全部程序化生成，无外部资源） ---------- */
  function canvas2d(w, h) {
    const c = (global.document && global.document.createElement)
      ? global.document.createElement('canvas')
      : { width: w, height: h, getContext: () => null };
    c.width = w; c.height = h;
    return { c, x: c.getContext ? c.getContext('2d') : null };
  }

  function finishTex(c, { srgb = true, repeat, aniso = 4 } = {}) {
    const tex = new T.CanvasTexture(c);
    if (srgb && T.SRGBColorSpace) tex.colorSpace = T.SRGBColorSpace;
    else if (srgb && T.sRGBEncoding !== undefined) tex.encoding = T.sRGBEncoding;
    if (repeat) {
      tex.wrapS = tex.wrapT = T.RepeatWrapping;
      tex.repeat.set(repeat[0], repeat[1]);
    }
    tex.anisotropy = aniso;
    tex.needsUpdate = true;
    return tex;
  }

  // 摄影棚背景：上白下浅灰的柔和渐变
  function studioBackground() {
    const { c, x } = canvas2d(16, 512);
    if (!x) return null;
    const g = x.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0.0, '#ffffff');
    g.addColorStop(0.45, '#fdfdfe');
    g.addColorStop(0.72, '#eef0f3');
    g.addColorStop(1.0, '#dfe3e8');
    x.fillStyle = g;
    x.fillRect(0, 0, 16, 512);
    return finishTex(c);
  }

  // 接地柔影（径向 alpha）
  function contactShadow(size) {
    const s = size || 256;
    const { c, x } = canvas2d(s, s);
    if (!x) return null;
    const g = x.createRadialGradient(s / 2, s / 2, s * 0.04, s / 2, s / 2, s * 0.5);
    g.addColorStop(0.0, 'rgba(120,126,138,0.55)');
    g.addColorStop(0.42, 'rgba(120,126,138,0.26)');
    g.addColorStop(0.78, 'rgba(120,126,138,0.06)');
    g.addColorStop(1.0, 'rgba(120,126,138,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, s, s);
    return finishTex(c, { srgb: false });
  }

  // 云杉音板的细腻白木纹（低对比）
  function soundboardGrain() {
    const { c, x } = canvas2d(1024, 256);
    if (!x) return null;
    x.fillStyle = '#fbfbfa';
    x.fillRect(0, 0, 1024, 256);
    for (let i = 0; i < 190; i++) {
      const y = Math.random() * 256;
      x.strokeStyle = 'rgba(196,190,178,' + (0.05 + Math.random() * 0.13).toFixed(3) + ')';
      x.lineWidth = 0.4 + Math.random() * 1.5;
      x.beginPath();
      x.moveTo(0, y);
      for (let px = 0; px <= 1024; px += 64) {
        x.lineTo(px, y + Math.sin(px * 0.012 + i) * 1.6 + (Math.random() - 0.5) * 0.8);
      }
      x.stroke();
    }
    return finishTex(c, { repeat: [1, 1] });
  }

  // 象牙白琴键表面的极细纹理（用作 roughnessMap，制造真实的哑光层次）
  function keyRoughness() {
    const { c, x } = canvas2d(256, 256);
    if (!x) return null;
    x.fillStyle = '#8a8a8a';
    x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2600; i++) {
      const v = 120 + Math.random() * 70 | 0;
      x.fillStyle = 'rgba(' + v + ',' + v + ',' + v + ',0.25)';
      x.fillRect(Math.random() * 256, Math.random() * 256, 1.6, 1.6);
    }
    for (let i = 0; i < 60; i++) {
      x.strokeStyle = 'rgba(150,150,150,0.18)';
      x.lineWidth = 0.6;
      x.beginPath();
      x.moveTo(0, Math.random() * 256);
      x.lineTo(256, Math.random() * 256);
      x.stroke();
    }
    return finishTex(c, { srgb: false, repeat: [1, 1] });
  }

  // 品牌字样贴花（浅灰，低调镶嵌在琴键盖上）
  function brandDecal(text, sub) {
    const { c, x } = canvas2d(1024, 256);
    if (!x) return null;
    x.clearRect(0, 0, 1024, 256);
    x.fillStyle = 'rgba(150,154,162,0.92)';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.font = '600 92px "Times New Roman", Georgia, serif';
    if (x.fillText) x.fillText(text || 'AURORA', 512, 108);
    x.font = '300 34px "Helvetica Neue", Arial, sans-serif';
    x.fillStyle = 'rgba(160,164,172,0.8)';
    if (x.fillText) x.fillText(sub || 'H A N D   C R A F T E D   G R A N D', 512, 178);
    return finishTex(c);
  }

  /* ---------- 车削轮廓（琴腿等） ---------- */
  function lathe(profile, segments) {
    const pts = profile.map((p) => V2(p[0], p[1]));
    const g = new T.LatheGeometry(pts, segments || 28);
    return g;
  }

  global.Geom = {
    V2, signedArea, offsetPolygon, samplePoints, shapeFromPoints, pathFromPoints,
    pointInPolygon, extrude, prism8, taperBox, roundedRect, merge, xform, lathe,
    studioBackground, contactShadow, soundboardGrain, keyRoughness, brandDecal, canvas2d, finishTex,
  };
})(typeof window !== 'undefined' ? window : globalThis);
