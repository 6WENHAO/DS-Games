/* ===================================================================
   util.js — 数学 / 随机 / 矩阵 / 颜色 工具
   全部挂到 window.G.U（数学 & 随机）与 window.G.M4（4x4 矩阵）
   世界坐标约定： X 向右(东)、Y 向上、Z 向后(南)。1 格 = 1 单位。
   yaw = 0 时朝向 -Z；yaw 增大向右转（+X）。
   =================================================================== */
(function () {
  'use strict';
  const G = (window.G = window.G || {});

  const PI = Math.PI, TAU = PI * 2;

  /* ------------------------- 基础数学 ------------------------- */
  const U = {
    PI, TAU, DEG: PI / 180,

    clamp(v, a, b) { return v < a ? a : (v > b ? b : v); },
    clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); },
    lerp(a, b, t) { return a + (b - a) * t; },
    // 与帧率无关的指数逼近
    damp(a, b, lambda, dt) { return b + (a - b) * Math.exp(-lambda * dt); },
    inv(v) { return v === 0 ? 0 : 1 / v; },
    sign(v) { return v < 0 ? -1 : (v > 0 ? 1 : 0); },

    smooth(t) { t = U.clamp01(t); return t * t * (3 - 2 * t); },
    easeOut(t) { t = U.clamp01(t); return 1 - (1 - t) * (1 - t); },
    easeIn(t) { t = U.clamp01(t); return t * t; },
    easeOutCubic(t) { t = U.clamp01(t); const f = 1 - t; return 1 - f * f * f; },
    easeInCubic(t) { t = U.clamp01(t); return t * t * t; },
    easeOutBack(t) {
      t = U.clamp01(t); const c = 1.9; const f = t - 1;
      return 1 + (c + 1) * f * f * f + c * f * f;
    },
    // 0->1->0 的脉冲
    pulse(t) { t = U.clamp01(t); return Math.sin(t * PI); },

    dist2(ax, ay, bx, by) { const dx = bx - ax, dy = by - ay; return dx * dx + dy * dy; },
    dist(ax, ay, bx, by) { return Math.sqrt(U.dist2(ax, ay, bx, by)); },
    len2(x, y) { return x * x + y * y; },

    // 角度归一化到 (-PI, PI]
    wrapAngle(a) {
      a = (a + PI) % TAU;
      if (a < 0) a += TAU;
      return a - PI;
    },
    angleDiff(a, b) { return U.wrapAngle(b - a); },
    // 朝目标角度旋转，限制最大步长
    turnToward(a, b, maxStep) {
      const d = U.angleDiff(a, b);
      if (Math.abs(d) <= maxStep) return b;
      return a + Math.sign(d) * maxStep;
    },
    // 由方向向量求 yaw（与上面的约定一致）
    yawOf(dx, dz) { return Math.atan2(dx, -dz); },
    fwdX(yaw) { return Math.sin(yaw); },
    fwdZ(yaw) { return -Math.cos(yaw); },

    now() { return (typeof performance !== 'undefined' ? performance.now() : Date.now()); },

    fmt(n) { return (n | 0).toString(); },
    pad(n, w) { let s = '' + n; while (s.length < w) s = '0' + s; return s; },
    roman(n) {
      const t = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
      let s = '';
      for (const [v, c] of t) while (n >= v) { s += c; n -= v; }
      return s || '0';
    },
  };

  /* ------------------------- 随机数 ------------------------- */
  // mulberry32：确定性、够快、够均匀
  class Rng {
    constructor(seed) { this.seed(seed); }
    seed(s) {
      if (typeof s === 'string') {
        let h = 2166136261 >>> 0;
        for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
        s = h;
      }
      this.s = (s === undefined ? (Math.random() * 4294967295) : s) >>> 0;
      return this;
    }
    next() {
      this.s = (this.s + 0x6D2B79F5) >>> 0;
      let t = this.s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    range(a, b) { return a + (b - a) * this.next(); }
    int(n) { return (this.next() * n) | 0; }              // [0,n)
    intRange(a, b) { return a + ((this.next() * (b - a + 1)) | 0); } // [a,b]
    chance(p) { return this.next() < p; }
    sign() { return this.next() < 0.5 ? -1 : 1; }
    pick(arr) { return arr[(this.next() * arr.length) | 0]; }
    // 权重抽取：items 里每项需有 .weight（缺省 1）
    weighted(items, key) {
      let total = 0;
      for (const it of items) total += (key ? it[key] : it.weight) || 1;
      let r = this.next() * total;
      for (const it of items) { r -= (key ? it[key] : it.weight) || 1; if (r <= 0) return it; }
      return items[items.length - 1];
    }
    shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = (this.next() * (i + 1)) | 0;
        const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
      }
      return arr;
    }
    // 近似正态分布
    gauss() { return (this.next() + this.next() + this.next() + this.next() - 2) * 0.8862; }
    // 单位圆内一点
    inDisc(r) {
      const a = this.next() * TAU, d = Math.sqrt(this.next()) * r;
      return [Math.cos(a) * d, Math.sin(a) * d];
    }
    // 单位球面方向
    onSphere() {
      const z = this.range(-1, 1), a = this.next() * TAU, s = Math.sqrt(1 - z * z);
      return [Math.cos(a) * s, z, Math.sin(a) * s];
    }
  }
  U.Rng = Rng;
  U.rng = new Rng(Date.now() >>> 0);  // 全局非确定性随机（特效用）

  /* ------------------------- 颜色 ------------------------- */
  U.hex = function (h) {
    if (typeof h === 'number') return [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
    h = h.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    const n = parseInt(h, 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  };
  U.mulc = function (c, f) { return [c[0] * f, c[1] * f, c[2] * f]; };
  U.mixc = function (a, b, t) { return [U.lerp(a[0], b[0], t), U.lerp(a[1], b[1], t), U.lerp(a[2], b[2], t)]; };
  U.css = function (c, a) {
    return 'rgba(' + (c[0] * 255 | 0) + ',' + (c[1] * 255 | 0) + ',' + (c[2] * 255 | 0) + ',' + (a === undefined ? 1 : a) + ')';
  };
  // 打包 rgb(0..1) 到单个 float（低精度调色用不到，保留给顶点色）
  U.jitterColor = function (c, rng, amt) {
    const f = 1 + (rng ? rng.gauss() : 0) * amt;
    return [U.clamp01(c[0] * f), U.clamp01(c[1] * f), U.clamp01(c[2] * f)];
  };

  G.U = U;

  /* ------------------------- 4x4 矩阵（列主序，符合 GL） ------------------------- */
  const M4 = {
    create() { return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]); },
    identity(o) {
      o[0] = 1; o[1] = 0; o[2] = 0; o[3] = 0;
      o[4] = 0; o[5] = 1; o[6] = 0; o[7] = 0;
      o[8] = 0; o[9] = 0; o[10] = 1; o[11] = 0;
      o[12] = 0; o[13] = 0; o[14] = 0; o[15] = 1;
      return o;
    },
    copy(o, a) { o.set(a); return o; },

    perspective(o, fovy, aspect, near, far) {
      const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
      o[0] = f / aspect; o[1] = 0; o[2] = 0; o[3] = 0;
      o[4] = 0; o[5] = f; o[6] = 0; o[7] = 0;
      o[8] = 0; o[9] = 0; o[10] = (far + near) * nf; o[11] = -1;
      o[12] = 0; o[13] = 0; o[14] = 2 * far * near * nf; o[15] = 0;
      return o;
    },
    ortho(o, l, r, b, t, n, f) {
      o[0] = 2 / (r - l); o[1] = 0; o[2] = 0; o[3] = 0;
      o[4] = 0; o[5] = 2 / (t - b); o[6] = 0; o[7] = 0;
      o[8] = 0; o[9] = 0; o[10] = -2 / (f - n); o[11] = 0;
      o[12] = -(r + l) / (r - l); o[13] = -(t + b) / (t - b); o[14] = -(f + n) / (f - n); o[15] = 1;
      return o;
    },

    // o = a * b
    mul(o, a, b) {
      const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3],
        a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7],
        a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11],
        a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
      for (let i = 0; i < 4; i++) {
        const b0 = b[i * 4], b1 = b[i * 4 + 1], b2 = b[i * 4 + 2], b3 = b[i * 4 + 3];
        o[i * 4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
        o[i * 4 + 1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
        o[i * 4 + 2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
        o[i * 4 + 3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
      }
      return o;
    },

    translate(o, x, y, z) {
      M4.identity(o); o[12] = x; o[13] = y; o[14] = z; return o;
    },
    scale(o, x, y, z) {
      M4.identity(o); o[0] = x; o[5] = (y === undefined ? x : y); o[10] = (z === undefined ? x : z); return o;
    },
    rotX(o, r) {
      const c = Math.cos(r), s = Math.sin(r);
      M4.identity(o); o[5] = c; o[6] = s; o[9] = -s; o[10] = c; return o;
    },
    rotY(o, r) {
      const c = Math.cos(r), s = Math.sin(r);
      M4.identity(o); o[0] = c; o[2] = -s; o[8] = s; o[10] = c; return o;
    },
    rotZ(o, r) {
      const c = Math.cos(r), s = Math.sin(r);
      M4.identity(o); o[0] = c; o[1] = s; o[4] = -s; o[5] = c; return o;
    },

    // 常用组合：平移 + YXZ 欧拉 + 缩放（就地写入 o）
    compose(o, px, py, pz, ry, rx, rz, sx, sy, sz) {
      sy = (sy === undefined ? sx : sy); sz = (sz === undefined ? sx : sz);
      const cy = Math.cos(ry), sy_ = Math.sin(ry);
      const cx = Math.cos(rx), sx_ = Math.sin(rx);
      const cz = Math.cos(rz), sz_ = Math.sin(rz);
      // R = Ry * Rx * Rz
      const m00 = cy * cz + sy_ * sx_ * sz_;
      const m01 = cx * sz_;
      const m02 = -sy_ * cz + cy * sx_ * sz_;
      const m10 = -cy * sz_ + sy_ * sx_ * cz;
      const m11 = cx * cz;
      const m12 = sy_ * sz_ + cy * sx_ * cz;
      const m20 = sy_ * cx;
      const m21 = -sx_;
      const m22 = cy * cx;
      o[0] = m00 * sx; o[1] = m01 * sx; o[2] = m02 * sx; o[3] = 0;
      o[4] = m10 * sy; o[5] = m11 * sy; o[6] = m12 * sy; o[7] = 0;
      o[8] = m20 * sz; o[9] = m21 * sz; o[10] = m22 * sz; o[11] = 0;
      o[12] = px; o[13] = py; o[14] = pz; o[15] = 1;
      return o;
    },

    // 由三个基向量 + 位置直接构造矩阵（列 = 基向量）
    basis(o, rx, ry, rz, ux, uy, uz, bx, by, bz, px, py, pz) {
      o[0] = rx; o[1] = ry; o[2] = rz; o[3] = 0;
      o[4] = ux; o[5] = uy; o[6] = uz; o[7] = 0;
      o[8] = bx; o[9] = by; o[10] = bz; o[11] = 0;
      o[12] = px; o[13] = py; o[14] = pz; o[15] = 1;
      return o;
    },

    // 摄像机视图矩阵：先平移到原点，再反向旋转（yaw 绕 Y，pitch 绕 X）
    view(o, ex, ey, ez, yaw, pitch, roll) {
      const cy = Math.cos(-yaw), sy = Math.sin(-yaw);
      const cx = Math.cos(-pitch), sx = Math.sin(-pitch);
      const cz = Math.cos(-(roll || 0)), sz = Math.sin(-(roll || 0));
      // R = Rz * Rx * Ry （视图空间：先偏航，再俯仰，最后滚转）
      const r00 = cz * cy + sz * sx * sy, r01 = sz * cx, r02 = -cz * sy + sz * sx * cy;
      const r10 = -sz * cy + cz * sx * sy, r11 = cz * cx, r12 = sz * sy + cz * sx * cy;
      const r20 = cx * sy, r21 = -sx, r22 = cx * cy;
      o[0] = r00; o[1] = r10; o[2] = r20; o[3] = 0;
      o[4] = r01; o[5] = r11; o[6] = r21; o[7] = 0;
      o[8] = r02; o[9] = r12; o[10] = r22; o[11] = 0;
      o[12] = -(r00 * ex + r01 * ey + r02 * ez);
      o[13] = -(r10 * ex + r11 * ey + r12 * ez);
      o[14] = -(r20 * ex + r21 * ey + r22 * ez);
      o[15] = 1;
      return o;
    },

    // 变换点（返回到 out[3]）
    xformPoint(out, m, x, y, z) {
      out[0] = m[0] * x + m[4] * y + m[8] * z + m[12];
      out[1] = m[1] * x + m[5] * y + m[9] * z + m[13];
      out[2] = m[2] * x + m[6] * y + m[10] * z + m[14];
      const w = m[3] * x + m[7] * y + m[11] * z + m[15];
      out[3] = w;
      return out;
    },
    // 只取旋转部分变换向量
    xformDir(out, m, x, y, z) {
      out[0] = m[0] * x + m[4] * y + m[8] * z;
      out[1] = m[1] * x + m[5] * y + m[9] * z;
      out[2] = m[2] * x + m[6] * y + m[10] * z;
      return out;
    },
  };
  G.M4 = M4;

  /* ------------------------- 小型对象池 ------------------------- */
  class Pool {
    constructor(factory, reset, cap) {
      this.factory = factory; this.reset = reset;
      this.items = []; this.cap = cap || 4096;
    }
    get() {
      const list = this.items;
      for (let i = 0; i < list.length; i++) if (!list[i].alive) { this.reset(list[i]); list[i].alive = true; return list[i]; }
      if (list.length >= this.cap) {  // 满了就抢最老的
        const it = list[(Math.random() * list.length) | 0];
        this.reset(it); it.alive = true; return it;
      }
      const it = this.factory(); this.reset(it); it.alive = true; list.push(it); return it;
    }
    forEach(fn) { const l = this.items; for (let i = 0; i < l.length; i++) if (l[i].alive) fn(l[i], i); }
    count() { let n = 0; const l = this.items; for (let i = 0; i < l.length; i++) if (l[i].alive) n++; return n; }
    clear() { const l = this.items; for (let i = 0; i < l.length; i++) l[i].alive = false; }
  }
  U.Pool = Pool;

  if (typeof module !== 'undefined' && module.exports) module.exports = { U, M4 };
})();
