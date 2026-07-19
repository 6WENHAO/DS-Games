/* util.js — 基础工具:随机、数学、几何生成(禁止手写顶点数组:全部经 Shape/Lathe/Extrude/内置图元) */
window.G = window.G || {};
(function () {
  const U = {};
  G.U = U;
  U.TAU = Math.PI * 2;

  /* ---------- 随机 ---------- */
  U.rng = function (seed) {
    let a = seed >>> 0 || 1;
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  };
  U.rand = (r, a, b) => a + r() * (b - a);
  U.randi = (r, a, b) => Math.floor(a + r() * (b - a + 1));
  U.pick = (r, arr) => arr[Math.floor(r() * arr.length) % arr.length];

  /* ---------- 数学 ---------- */
  U.clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.ilerp = (a, b, v) => U.clamp((v - a) / (b - a), 0, 1);
  U.smooth = t => t * t * (3 - 2 * t);
  U.damp = (cur, target, lambda, dt) => U.lerp(cur, target, 1 - Math.exp(-lambda * dt));
  U.wrapAngle = a => { while (a > Math.PI) a -= U.TAU; while (a < -Math.PI) a += U.TAU; return a; };
  U.dampAngle = (cur, target, lambda, dt) => cur + U.wrapAngle(target - cur) * (1 - Math.exp(-lambda * dt));
  U.easeOut = t => 1 - Math.pow(1 - t, 3);
  U.easeInOut = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  U.v3 = (x, y, z) => new THREE.Vector3(x, y, z);

  /* ---------- 几何合并(工具性拼接,非手工建模) ---------- */
  U.mergeGeos = function (geos) {
    const nonIdx = geos.map(g => g.index ? g.toNonIndexed() : g);
    const hasSkin = nonIdx.every(g => g.attributes.skinIndex);
    const attrs = ['position', 'normal', 'uv'];
    const out = new THREE.BufferGeometry();
    for (const name of attrs) {
      const size = name === 'uv' ? 2 : 3;
      let total = 0;
      for (const g of nonIdx) total += g.attributes.position.count;
      const arr = new Float32Array(total * size);
      let off = 0;
      for (const g of nonIdx) {
        const a = g.attributes[name];
        const n = g.attributes.position.count;
        if (a) arr.set(a.array.subarray(0, n * size), off);
        off += n * size;
      }
      out.setAttribute(name, new THREE.BufferAttribute(arr, size));
    }
    if (hasSkin) {
      for (const name of ['skinIndex', 'skinWeight']) {
        let total = 0; for (const g of nonIdx) total += g.attributes.position.count;
        const arr = new Float32Array(total * 4); let off = 0;
        for (const g of nonIdx) { arr.set(g.attributes[name].array, off); off += g.attributes.position.count * 4; }
        out.setAttribute(name, new THREE.BufferAttribute(arr, 4));
      }
    }
    return out;
  };

  /* 合并并保留材质分组:items = [{geo, mi}] */
  U.mergeGrouped = function (items) {
    items = items.slice().sort((a, b) => a.mi - b.mi);
    const geo = U.mergeGeos(items.map(i => i.geo));
    let start = 0;
    let cur = -1, curStart = 0;
    for (const it of items) {
      const cnt = (it.geo.index ? it.geo.index.count : it.geo.attributes.position.count);
      const n = it.geo.index ? U._nonIdxCount(it.geo) : it.geo.attributes.position.count;
      if (it.mi !== cur) {
        if (cur >= 0) geo.addGroup(curStart, start - curStart, cur);
        cur = it.mi; curStart = start;
      }
      start += n;
    }
    if (cur >= 0) geo.addGroup(curStart, start - curStart, cur);
    return geo;
  };
  U._nonIdxCount = g => g.index ? g.index.count : g.attributes.position.count;

  U.applyT = function (geo, t) {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    if (t.r) q.setFromEuler(new THREE.Euler(t.r[0] || 0, t.r[1] || 0, t.r[2] || 0, t.ro || 'XYZ'));
    const s = t.s == null ? 1 : t.s;
    const sv = Array.isArray(s) ? new THREE.Vector3(s[0], s[1], s[2]) : new THREE.Vector3(s, s, s);
    const p = t.p || [0, 0, 0];
    m.compose(new THREE.Vector3(p[0], p[1], p[2]), q, sv);
    geo.applyMatrix4(m);
    return geo;
  };

  /* ---------- 车削胶囊(底部在 y=0,顶部在 y=len) ---------- */
  U.capsule = function (r0, r1, len, radial, caps) {
    radial = radial || 10; caps = caps || 4;
    const pts = [];
    for (let k = 0; k <= caps; k++) {
      const a = -Math.PI / 2 + (k / caps) * Math.PI / 2;
      pts.push(new THREE.Vector2(Math.max(1e-4, r0 * Math.cos(a)), r0 + r0 * Math.sin(a)));
    }
    const midSeg = 4;
    for (let k = 1; k < midSeg; k++) {
      const t = k / midSeg;
      pts.push(new THREE.Vector2(U.lerp(r0, r1, t), U.lerp(r0, len - r1, t)));
    }
    for (let k = 0; k <= caps; k++) {
      const a = (k / caps) * Math.PI / 2;
      pts.push(new THREE.Vector2(Math.max(1e-4, r1 * Math.cos(a)), len - r1 + r1 * Math.sin(a)));
    }
    return new THREE.LatheGeometry(pts, radial);
  };

  /* ---------- 圆角矩形 Shape / 圆角盒(挤出+倒角) ---------- */
  U.roundRectShape = function (w, h, r) {
    r = Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4);
    const s = new THREE.Shape();
    const x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y); s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
    s.lineTo(x + w, y + h - r); s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
    s.lineTo(x + r, y + h); s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
    s.lineTo(x, y + r); s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
    return s;
  };
  U.rbox = function (w, h, d, r, seg) {
    r = Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3);
    const shape = U.roundRectShape(w, h, Math.min(r * 1.4, w / 2 - 1e-3, h / 2 - 1e-3));
    const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(1e-3, d - 2 * r), bevelEnabled: true, bevelThickness: r, bevelSize: r * 0.85, bevelSegments: seg || 2, curveSegments: 4 });
    g.translate(0, 0, -(d - 2 * r) / 2);
    g.computeVertexNormals();
    return g;
  };

  /* ---------- 沿路径扫掠剖面 ---------- */
  U.sweep = function (profilePts, pathPts, opt) {
    opt = opt || {};
    const shape = new THREE.Shape();
    profilePts.forEach((p, i) => { i === 0 ? shape.moveTo(p[0], p[1]) : shape.lineTo(p[0], p[1]); });
    shape.closePath();
    const curve = new THREE.CatmullRomCurve3(pathPts.map(p => p.clone ? p.clone() : U.v3(p[0], p[1], p[2])), !!opt.closed, 'catmullrom', opt.tension == null ? 0.0 : opt.tension);
    let len = 0; const P = curve.points;
    for (let i = 1; i < P.length; i++) len += P[i].distanceTo(P[i - 1]);
    const steps = opt.steps || Math.max(2, Math.round(len / (opt.stepLen || 2)));
    return new THREE.ExtrudeGeometry(shape, { steps, bevelEnabled: false, extrudePath: curve });
  };

  /* ---------- 声明式零件 JSON → 网格组/合并几何 ----------
     def: {t:'box|rbox|cyl|cone|sph|tor|lathe', s:[..], p:[x,y,z], r:[rx,ry,rz], m:'matName', mirror:true, name:'..'}
     mirror: 以 x=0 镜像复制(建左半边自动成对) */
  const SNAP = 0.005;
  const sn = v => Math.round(v / SNAP) * SNAP;
  U.buildParts = function (defs, mats, opts) {
    opts = opts || {};
    const group = new THREE.Group();
    const byMat = new Map();
    const named = {};
    function makeGeo(d) {
      const s = (d.s || [1, 1, 1]).map(sn);
      switch (d.t) {
        case 'box': return new THREE.BoxGeometry(s[0], s[1], s[2]);
        case 'rbox': return U.rbox(s[0], s[1], s[2], d.rr || 0.02, d.seg);
        case 'cyl': return new THREE.CylinderGeometry(s[0], s[1] == null ? s[0] : s[1], s[2] == null ? s[1] : s[2], d.seg || 12, 1, !!d.open);
        case 'cone': return new THREE.ConeGeometry(s[0], s[1], d.seg || 10);
        case 'sph': return new THREE.SphereGeometry(s[0], d.seg || 10, d.seg2 || 8);
        case 'tor': return new THREE.TorusGeometry(s[0], s[1], d.seg2 || 8, d.seg || 16, d.arc);
        case 'lathe': return new THREE.LatheGeometry(d.pts.map(p => new THREE.Vector2(p[0], p[1])), d.seg || 14);
        case 'caps': return U.capsule(s[0], s[1] == null ? s[0] : s[1], s[2], d.seg || 10);
        default: throw new Error('part type ' + d.t);
      }
    }
    function add(d, mirrored) {
      const geo = makeGeo(d);
      const p = (d.p || [0, 0, 0]).slice();
      const r = (d.r || [0, 0, 0]).slice();
      if (mirrored) { p[0] = -p[0]; r[1] = -r[1]; r[2] = -r[2]; }
      U.applyT(geo, { p: [0, 0, 0], r, s: d.sc });
      if (mirrored) { geo.scale(-1, 1, 1); }
      geo.translate(p[0], p[1], p[2]);
      if (mirrored) { /* 翻转绕序修正 */ geo.computeVertexNormals(); U.flipWinding(geo); geo.computeVertexNormals(); }
      const key = d.m || 'default';
      if (!byMat.has(key)) byMat.set(key, []);
      byMat.get(key).push(geo);
      return geo;
    }
    for (const d of defs) {
      const g0 = add(d, false);
      if (d.mirror) add(d, true);
      if (d.name) named[d.name] = g0;
    }
    const meshes = [];
    for (const [key, list] of byMat) {
      const merged = U.mergeGeos(list);
      merged.computeVertexNormals();
      const mesh = new THREE.Mesh(merged, mats[key] || mats.default);
      mesh.castShadow = opts.shadow !== false; mesh.receiveShadow = opts.shadow !== false;
      group.add(mesh); meshes.push(mesh);
    }
    return { group, meshes, named, byMat };
  };
  U.flipWinding = function (geo) {
    if (geo.index) geo = geo.toNonIndexed();
    const pos = geo.attributes.position.array;
    const uv = geo.attributes.uv ? geo.attributes.uv.array : null;
    for (let i = 0; i < pos.length; i += 9) {
      for (let k = 0; k < 3; k++) { const t = pos[i + 3 + k]; pos[i + 3 + k] = pos[i + 6 + k]; pos[i + 6 + k] = t; }
    }
    if (uv) for (let i = 0; i < uv.length; i += 6) {
      for (let k = 0; k < 2; k++) { const t = uv[i + 2 + k]; uv[i + 2 + k] = uv[i + 4 + k]; uv[i + 4 + k] = t; }
    }
    geo.attributes.position.needsUpdate = true;
    return geo;
  };

  /* ---------- 空间哈希(2D AABB 碰撞体) ---------- */
  U.SpatialHash = class {
    constructor(cell) { this.cell = cell || 16; this.map = new Map(); this.boxes = []; }
    key(ix, iz) { return ix + ':' + iz; }
    add(x0, z0, x1, z1, y0, y1, tag) {
      const id = this.boxes.length;
      this.boxes.push({ x0, z0, x1, z1, y0: y0 == null ? 0 : y0, y1: y1 == null ? 10 : y1, tag });
      const c = this.cell;
      for (let ix = Math.floor(x0 / c); ix <= Math.floor(x1 / c); ix++)
        for (let iz = Math.floor(z0 / c); iz <= Math.floor(z1 / c); iz++) {
          const k = this.key(ix, iz);
          if (!this.map.has(k)) this.map.set(k, []);
          this.map.get(k).push(id);
        }
      return id;
    }
    query(x0, z0, x1, z1, out) {
      out = out || [];
      const c = this.cell, seen = new Set();
      for (let ix = Math.floor(x0 / c); ix <= Math.floor(x1 / c); ix++)
        for (let iz = Math.floor(z0 / c); iz <= Math.floor(z1 / c); iz++) {
          const l = this.map.get(this.key(ix, iz));
          if (l) for (const id of l) if (!seen.has(id)) { seen.add(id); out.push(this.boxes[id]); }
        }
      return out;
    }
  };

  /* 圆 vs AABB 推出向量 */
  U.circlePush = function (px, pz, r, b) {
    const cx = U.clamp(px, b.x0, b.x1), cz = U.clamp(pz, b.z0, b.z1);
    let dx = px - cx, dz = pz - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 > r * r) return null;
    if (d2 < 1e-9) {
      const l = px - b.x0, rr = b.x1 - px, t = pz - b.z0, bb = b.z1 - pz;
      const m = Math.min(l, rr, t, bb);
      if (m === l) return [-(l + r), 0];
      if (m === rr) return [rr + r, 0];
      if (m === t) return [0, -(t + r)];
      return [0, bb + r];
    }
    const d = Math.sqrt(d2), push = (r - d) / d;
    return [dx * push, dz * push];
  };

  /* 线段(3D) vs AABB(x0,z0,x1,z1,y0,y1) 求最近命中 t,用于镜头防穿墙 */
  U.segAabb = function (p0, p1, b) {
    let tmin = 0, tmax = 1;
    const d = [p1.x - p0.x, p1.y - p0.y, p1.z - p0.z];
    const mn = [b.x0, b.y0, b.z0], mx = [b.x1, b.y1, b.z1];
    const o = [p0.x, p0.y, p0.z];
    for (let i = 0; i < 3; i++) {
      if (Math.abs(d[i]) < 1e-9) { if (o[i] < mn[i] || o[i] > mx[i]) return null; }
      else {
        let t1 = (mn[i] - o[i]) / d[i], t2 = (mx[i] - o[i]) / d[i];
        if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
        tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
        if (tmin > tmax) return null;
      }
    }
    return tmin;
  };

  U.makeCanvas = function (w, h) {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    return { cv, ctx: cv.getContext('2d', { willReadFrequently: true }) };
  };

  /* 错误收集(验收用) */
  U.errors = [];
  window.addEventListener('error', e => { U.errors.push(String(e.message)); showVerr(); });
  window.addEventListener('unhandledrejection', e => { U.errors.push('promise:' + String(e.reason && e.reason.message || e.reason)); showVerr(); });
  function showVerr() {
    const el = document.getElementById('verr');
    if (el && U.errors.length) { el.style.display = 'block'; el.textContent = U.errors.slice(-4).join('\n'); }
  }

  U.qs = (function () { const o = {}; location.search.slice(1).split('&').forEach(kv => { const [k, v] = kv.split('='); if (k) o[k] = v == null ? '1' : decodeURIComponent(v); }); return o; })();
})();
