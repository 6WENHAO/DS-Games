/* ===================================================================
   util.js — 数学 / 随机 / 网格 / 空间索引 / 计时
   全部挂在 window.R 命名空间下（R = RTS）。

   坐标约定（2D 俯视）：
     世界坐标 X 向右(东)、Y 向下(南)，单位 = 像素。
     1 格 (tile) = TILE 像素。格坐标 (cx,cy) = (floor(x/TILE), floor(y/TILE))。
     角度 0 = 正东(+X)，顺时针增大（与 canvas 一致）。
     8 向朝向索引 dir = 0..7 ，0=东，2=南，4=西，6=北。
   =================================================================== */
(function () {
  'use strict';
  const R = (window.R = window.R || {});

  const PI = Math.PI, TAU = PI * 2;

  /** 一格的像素尺寸。渲染与逻辑共用。 */
  R.TILE = 24;

  /* ============================ 数学 ============================ */
  const U = {
    PI, TAU, DEG: PI / 180, RAD: 180 / PI,

    clamp(v, a, b) { return v < a ? a : (v > b ? b : v); },
    clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); },
    lerp(a, b, t) { return a + (b - a) * t; },
    /** 与帧率无关的指数逼近：把 a 拉向 b */
    damp(a, b, lambda, dt) { return b + (a - b) * Math.exp(-lambda * dt); },
    sign(v) { return v < 0 ? -1 : (v > 0 ? 1 : 0); },
    min(a, b) { return a < b ? a : b; },
    max(a, b) { return a > b ? a : b; },

    smooth(t) { t = U.clamp01(t); return t * t * (3 - 2 * t); },
    easeOut(t) { t = U.clamp01(t); return 1 - (1 - t) * (1 - t); },
    easeIn(t) { t = U.clamp01(t); return t * t; },
    easeOutCubic(t) { t = U.clamp01(t); const f = 1 - t; return 1 - f * f * f; },
    pulse(t) { t = U.clamp01(t); return Math.sin(t * PI); },

    dist2(ax, ay, bx, by) { const dx = bx - ax, dy = by - ay; return dx * dx + dy * dy; },
    dist(ax, ay, bx, by) { return Math.sqrt(U.dist2(ax, ay, bx, by)); },
    len(x, y) { return Math.sqrt(x * x + y * y); },
    len2(x, y) { return x * x + y * y; },
    /** 切比雪夫距离（格子八方向步数） */
    cheb(ax, ay, bx, by) { return Math.max(Math.abs(bx - ax), Math.abs(by - ay)); },

    /** 归一化到 [-PI, PI) */
    wrapAngle(a) {
      a = (a + PI) % TAU;
      if (a < 0) a += TAU;
      return a - PI;
    },
    angleDiff(a, b) { return U.wrapAngle(b - a); },
    /** 朝目标角旋转，限制最大步长 */
    turnToward(a, b, maxStep) {
      const d = U.angleDiff(a, b);
      if (Math.abs(d) <= maxStep) return b;
      return U.wrapAngle(a + Math.sign(d) * maxStep);
    },
    /** 角度 → 8 向索引 */
    dir8(a) {
      let i = Math.round(U.wrapAngle(a) / (TAU / 8));
      if (i < 0) i += 8;
      return i & 7;
    },
    /** 角度 → 16 向索引（车体用，转向更细腻） */
    dir16(a) {
      let i = Math.round(U.wrapAngle(a) / (TAU / 16));
      if (i < 0) i += 16;
      return i & 15;
    },
    dirToAngle(d, n) { return (d % n) * (TAU / n); },

    /** 线段与圆是否相交（投射物近似判定用） */
    segCircle(x1, y1, x2, y2, cx, cy, r) {
      const dx = x2 - x1, dy = y2 - y1;
      const l2 = dx * dx + dy * dy;
      let t = l2 > 0 ? ((cx - x1) * dx + (cy - y1) * dy) / l2 : 0;
      t = U.clamp01(t);
      const px = x1 + dx * t, py = y1 + dy * t;
      return U.dist2(px, py, cx, cy) <= r * r;
    },

    /** 矩形是否相交 */
    rectHit(ax, ay, aw, ah, bx, by, bw, bh) {
      return ax < bx + bw && bx < ax + aw && ay < by + bh && by < ay + ah;
    },

    now() { return (typeof performance !== 'undefined' ? performance.now() : Date.now()); },

    /** 数字格式化：1234 → "1,234" */
    comma(n) {
      n = Math.round(n);
      let s = String(Math.abs(n)), out = '';
      while (s.length > 3) { out = ',' + s.slice(-3) + out; s = s.slice(0, -3); }
      return (n < 0 ? '-' : '') + s + out;
    },
    /** 秒 → "1:05" */
    mmss(sec) {
      sec = Math.max(0, Math.floor(sec));
      const m = Math.floor(sec / 60), s = sec % 60;
      return m + ':' + (s < 10 ? '0' : '') + s;
    },
    pad(n, w) { let s = '' + n; while (s.length < w) s = '0' + s; return s; },
  };
  R.U = U;

  /* ============================ 随机 ============================ */
  /** mulberry32：可复现的 32bit PRNG */
  R.rng = function (seed) {
    let a = (seed >>> 0) || 1;
    const f = function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    /** [a,b) 浮点 */
    f.range = (lo, hi) => lo + (hi - lo) * f();
    /** [lo,hi] 整数 */
    f.int = (lo, hi) => Math.floor(lo + (hi - lo + 1) * f()) ;
    f.bool = (p) => f() < (p === undefined ? 0.5 : p);
    f.pick = (arr) => arr[Math.floor(f() * arr.length) % arr.length];
    /** 原地洗牌 */
    f.shuffle = (arr) => {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(f() * (i + 1));
        const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
      }
      return arr;
    };
    /** 单位圆内均匀取点 */
    f.disc = (r) => {
      const a = f() * TAU, d = Math.sqrt(f()) * r;
      return { x: Math.cos(a) * d, y: Math.sin(a) * d };
    };
    f.sign = () => (f() < 0.5 ? -1 : 1);
    return f;
  };

  /** 值噪声（地形生成用），返回 [0,1] */
  R.makeNoise = function (seed) {
    const rnd = R.rng(seed);
    const P = 256, perm = new Uint8Array(P * 2), grad = new Float32Array(P * 2);
    for (let i = 0; i < P; i++) { perm[i] = i; grad[i] = rnd(); }
    rnd.shuffle(perm.subarray(0, P));
    for (let i = 0; i < P; i++) { perm[P + i] = perm[i]; grad[P + i] = grad[i]; }
    const at = (xi, yi) => grad[(perm[xi & 255] + (yi & 255)) & 511];
    /** 单层平滑噪声 */
    function base(x, y) {
      const xi = Math.floor(x), yi = Math.floor(y);
      const tx = U.smooth(x - xi), ty = U.smooth(y - yi);
      const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
      return U.lerp(U.lerp(a, b, tx), U.lerp(c, d, tx), ty);
    }
    /** 分形叠加 */
    return function (x, y, oct, lac, gain) {
      oct = oct || 4; lac = lac || 2; gain = gain || 0.5;
      let f = 1, amp = 1, sum = 0, norm = 0;
      for (let i = 0; i < oct; i++) {
        sum += base(x * f, y * f) * amp;
        norm += amp; amp *= gain; f *= lac;
      }
      return sum / norm;
    };
  };

  /* ====================== 空间哈希（邻居查询） ======================
     单位数量上千时，逐对距离判定会炸。按格分桶，查询只看邻近桶。
     ============================================================== */
  R.SpatialHash = class SpatialHash {
    constructor(cell) {
      this.cell = cell || 48;
      this.map = new Map();
    }
    key(cx, cy) { return cx * 46341 + cy; }
    clear() { this.map.clear(); }
    insert(e) {
      const c = this.cell;
      const k = this.key(Math.floor(e.x / c), Math.floor(e.y / c));
      let b = this.map.get(k);
      if (!b) { b = []; this.map.set(k, b); }
      b.push(e);
    }
    rebuild(list) {
      this.clear();
      for (let i = 0; i < list.length; i++) this.insert(list[i]);
    }
    /** 收集半径 r 内的候选（可能略多，需再精确判定） */
    query(x, y, r, out) {
      out = out || [];
      out.length = 0;
      const c = this.cell;
      const x0 = Math.floor((x - r) / c), x1 = Math.floor((x + r) / c);
      const y0 = Math.floor((y - r) / c), y1 = Math.floor((y + r) / c);
      for (let cy = y0; cy <= y1; cy++) {
        for (let cx = x0; cx <= x1; cx++) {
          const b = this.map.get(this.key(cx, cy));
          if (b) for (let i = 0; i < b.length; i++) out.push(b[i]);
        }
      }
      return out;
    }
  };

  /* ====================== 二叉堆（A* 开放表） ====================== */
  R.Heap = class Heap {
    constructor() { this.a = []; }
    get size() { return this.a.length; }
    clear() { this.a.length = 0; }
    push(node, f) {
      const a = this.a;
      a.push({ n: node, f });
      let i = a.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (a[p].f <= a[i].f) break;
        const t = a[p]; a[p] = a[i]; a[i] = t; i = p;
      }
    }
    pop() {
      const a = this.a;
      if (a.length === 0) return null;
      const top = a[0], last = a.pop();
      if (a.length) {
        a[0] = last;
        let i = 0;
        for (;;) {
          const l = i * 2 + 1, r = l + 1;
          let m = i;
          if (l < a.length && a[l].f < a[m].f) m = l;
          if (r < a.length && a[r].f < a[m].f) m = r;
          if (m === i) break;
          const t = a[m]; a[m] = a[i]; a[i] = t; i = m;
        }
      }
      return top.n;
    }
  };

  /* ====================== 颜色 ====================== */
  R.Col = {
    /** hsl → "#rrggbb" */
    hsl(h, s, l) {
      h = ((h % 360) + 360) % 360; s = U.clamp01(s); l = U.clamp01(l);
      const c = (1 - Math.abs(2 * l - 1)) * s;
      const hp = h / 60, x = c * (1 - Math.abs((hp % 2) - 1));
      let r = 0, g = 0, b = 0;
      if (hp < 1) { r = c; g = x; }
      else if (hp < 2) { r = x; g = c; }
      else if (hp < 3) { g = c; b = x; }
      else if (hp < 4) { g = x; b = c; }
      else if (hp < 5) { r = x; b = c; }
      else { r = c; b = x; }
      const m = l - c / 2;
      const q = (v) => U.clamp(Math.round((v + m) * 255), 0, 255);
      return '#' + ((1 << 24) | (q(r) << 16) | (q(g) << 8) | q(b)).toString(16).slice(1);
    },
    /** "#rrggbb" → {r,g,b} 0..255 */
    parse(hex) {
      const v = parseInt(hex.slice(1), 16);
      return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
    },
    rgb(r, g, b) {
      const q = (v) => U.clamp(Math.round(v), 0, 255);
      return '#' + ((1 << 24) | (q(r) << 16) | (q(g) << 8) | q(b)).toString(16).slice(1);
    },
    /** 两色混合，t=0 取 a */
    mix(a, b, t) {
      const A = R.Col.parse(a), B = R.Col.parse(b);
      return R.Col.rgb(U.lerp(A.r, B.r, t), U.lerp(A.g, B.g, t), U.lerp(A.b, B.b, t));
    },
    /** 明度缩放 */
    scale(hex, k) {
      const c = R.Col.parse(hex);
      return R.Col.rgb(c.r * k, c.g * k, c.b * k);
    },
    /** 加透明度 */
    alpha(hex, a) {
      const c = R.Col.parse(hex);
      return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + a + ')';
    },
  };

  /* ====================== 离屏画布 ====================== */
  R.makeCanvas = function (w, h) {
    let cv;
    if (typeof document !== 'undefined' && document.createElement) {
      cv = document.createElement('canvas');
    } else {
      // Node 冒烟测试下的极简桩件
      cv = { getContext: () => null };
    }
    cv.width = Math.max(1, Math.ceil(w));
    cv.height = Math.max(1, Math.ceil(h));
    return cv;
  };

  /* ====================== 简易 ID ====================== */
  let _uid = 0;
  R.uid = function () { return ++_uid; };
  R.resetUid = function () { _uid = 0; };

})();
