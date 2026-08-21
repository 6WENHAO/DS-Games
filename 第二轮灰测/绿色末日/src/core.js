/* =========================================================================
 * GREENFALL · 绿蚀纪元   —  core.js
 * 基础设施：数学、随机、噪声、事件总线、工具函数
 * 零依赖，普通脚本（file:// 双击可运行）
 * ======================================================================= */
(function (GF) {
  'use strict';

  /* ---------------------------------------------------------------- 数学 */
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smoothstep = (t) => t * t * (3 - 2 * t);
  const invLerp = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));
  const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  const dist2 = (x1, z1, x2, z2) => Math.hypot(x1 - x2, z1 - z2);

  /* ------------------------------------------------------------ 随机数 */
  // xorshift32 —— 确定性、快
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // 整数哈希：位置 -> [0,1)，用于「无状态」的程序化生成
  function hash2(x, y, seed) {
    let h = (x | 0) * 374761393 + (y | 0) * 668265263 + (seed | 0) * 2147483647;
    h = (h ^ (h >>> 13)) >>> 0;
    h = Math.imul(h, 1274126177) >>> 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function hash3(x, y, z, seed) {
    let h = (x | 0) * 374761393 + (y | 0) * 668265263 + (z | 0) * 2246822519 + (seed | 0) * 3266489917;
    h = (h ^ (h >>> 13)) >>> 0;
    h = Math.imul(h, 1274126177) >>> 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  // 由坐标派生一个稳定的 RNG（结构体、战利品用）
  function rngAt(x, z, seed) {
    return mulberry32((Math.imul(x | 0, 73856093) ^ Math.imul(z | 0, 19349663) ^ (seed | 0)) >>> 0);
  }

  /* -------------------------------------------------------------- 噪声 */
  class Noise {
    constructor(seed) { this.seed = seed | 0; }

    // 2D 值噪声（平滑插值）
    value2(x, y) {
      const xi = Math.floor(x), yi = Math.floor(y);
      const tx = smoothstep(x - xi), ty = smoothstep(y - yi);
      const s = this.seed;
      const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s);
      const c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
      return lerp(lerp(a, b, tx), lerp(c, d, tx), ty);
    }

    value3(x, y, z) {
      const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
      const tx = smoothstep(x - xi), ty = smoothstep(y - yi), tz = smoothstep(z - zi);
      const s = this.seed;
      const c000 = hash3(xi, yi, zi, s), c100 = hash3(xi + 1, yi, zi, s);
      const c010 = hash3(xi, yi + 1, zi, s), c110 = hash3(xi + 1, yi + 1, zi, s);
      const c001 = hash3(xi, yi, zi + 1, s), c101 = hash3(xi + 1, yi, zi + 1, s);
      const c011 = hash3(xi, yi + 1, zi + 1, s), c111 = hash3(xi + 1, yi + 1, zi + 1, s);
      const x00 = lerp(c000, c100, tx), x10 = lerp(c010, c110, tx);
      const x01 = lerp(c001, c101, tx), x11 = lerp(c011, c111, tx);
      return lerp(lerp(x00, x10, ty), lerp(x01, x11, ty), tz);
    }

    // 分形叠加
    fbm2(x, y, oct = 4, lac = 2.0, gain = 0.5) {
      let f = 1, a = 1, sum = 0, norm = 0;
      for (let i = 0; i < oct; i++) {
        sum += a * this.value2(x * f, y * f);
        norm += a; f *= lac; a *= gain;
      }
      return sum / norm;
    }
    fbm3(x, y, z, oct = 3, lac = 2.0, gain = 0.5) {
      let f = 1, a = 1, sum = 0, norm = 0;
      for (let i = 0; i < oct; i++) {
        sum += a * this.value3(x * f, y * f, z * f);
        norm += a; f *= lac; a *= gain;
      }
      return sum / norm;
    }
    // 山脊噪声（山脉、峡谷）
    ridged(x, y, oct = 4) {
      let f = 1, a = 1, sum = 0, norm = 0;
      for (let i = 0; i < oct; i++) {
        const n = 1 - Math.abs(this.value2(x * f, y * f) * 2 - 1);
        sum += a * n * n; norm += a; f *= 2; a *= 0.5;
      }
      return sum / norm;
    }
    // 沃罗诺伊：返回 {d1, d2, cx, cz}，用于地块/裂缝/城市区块
    worley(x, y, cell = 1) {
      const gx = Math.floor(x / cell), gy = Math.floor(y / cell);
      let d1 = 1e9, d2 = 1e9, bx = 0, by = 0;
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
        const cxi = gx + ox, cyi = gy + oy;
        const px = (cxi + hash2(cxi, cyi, this.seed)) * cell;
        const py = (cyi + hash2(cxi, cyi, this.seed + 7717)) * cell;
        const d = Math.hypot(x - px, y - py);
        if (d < d1) { d2 = d1; d1 = d; bx = cxi; by = cyi; }
        else if (d < d2) d2 = d;
      }
      return { d1, d2, cx: bx, cz: by };
    }
  }

  /* --------------------------------------------------------- 事件总线 */
  class Bus {
    constructor() { this.m = new Map(); }
    on(ev, fn) {
      if (!this.m.has(ev)) this.m.set(ev, new Set());
      this.m.get(ev).add(fn);
      return () => this.off(ev, fn);
    }
    off(ev, fn) { const s = this.m.get(ev); if (s) s.delete(fn); }
    emit(ev, payload) {
      const s = this.m.get(ev);
      if (s) for (const fn of Array.from(s)) { try { fn(payload); } catch (e) { console.error('[bus]', ev, e); } }
      const all = this.m.get('*');
      if (all) for (const fn of Array.from(all)) { try { fn(ev, payload); } catch (e) { /* noop */ } }
    }
  }

  /* ------------------------------------------------------- 小工具集合 */
  function weightedPick(list, rnd) {           // list: [{w:number, ...}]
    let total = 0;
    for (const it of list) total += (it.w || 0);
    if (total <= 0) return null;
    let r = rnd() * total;
    for (const it of list) { r -= (it.w || 0); if (r <= 0) return it; }
    return list[list.length - 1];
  }
  const pad2 = (n) => (n < 10 ? '0' + n : '' + n);
  function fmtClock(dayFrac) {                 // 0..1 -> "HH:MM"
    const t = ((dayFrac % 1) + 1) % 1;
    const mins = Math.floor(t * 1440);
    return pad2(Math.floor(mins / 60)) + ':' + pad2(mins % 60);
  }
  function fmtNum(n, d = 0) { return n.toFixed(d); }
  // key: 世界坐标打包成字符串键
  const posKey = (x, y, z) => x + ',' + y + ',' + z;
  const chunkKey = (cx, cz) => cx + ',' + cz;

  // 简易 3D 向量
  function vec(x = 0, y = 0, z = 0) { return { x, y, z }; }

  /** 由偏航角得到移动基向量。
   *  前向 f = (sin yaw, cos yaw)；右向 r = cross(f, up) = (-cos yaw, sin yaw)。
   *  必须与 M4.lookAt 得到的"屏幕右"一致，否则 A/D 会左右颠倒。 */
  function moveBasis(yaw) {
    const s = Math.sin(yaw), c = Math.cos(yaw);
    return { fx: s, fz: c, rx: -c, rz: s };
  }

  // 数组洗牌（确定性）
  function shuffle(arr, rnd) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  // 颜色工具
  function rgb(r, g, b) { return [r / 255, g / 255, b / 255]; }
  function hex(h) {
    const n = parseInt(h.replace('#', ''), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }
  function toCss(c, a) {
    const r = Math.round(clamp(c[0], 0, 1) * 255), g = Math.round(clamp(c[1], 0, 1) * 255), b = Math.round(clamp(c[2], 0, 1) * 255);
    return a == null ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${a})`;
  }

  /* ------------------------------------------------------- 4x4 矩阵 */
  const M4 = {
    ident() { return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]); },
    persp(fovyDeg, aspect, near, far) {
      const f = 1 / Math.tan((fovyDeg * Math.PI / 180) / 2), nf = 1 / (near - far);
      return new Float32Array([
        f / aspect, 0, 0, 0,
        0, f, 0, 0,
        0, 0, (far + near) * nf, -1,
        0, 0, 2 * far * near * nf, 0]);
    },
    ortho(l, r, b, t, n, f) {
      return new Float32Array([
        2 / (r - l), 0, 0, 0,
        0, 2 / (t - b), 0, 0,
        0, 0, -2 / (f - n), 0,
        -(r + l) / (r - l), -(t + b) / (t - b), -(f + n) / (f - n), 1]);
    },
    mul(a, b) { // out = a * b
      const o = new Float32Array(16);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
        o[i * 4 + j] = a[j] * b[i * 4] + a[4 + j] * b[i * 4 + 1] + a[8 + j] * b[i * 4 + 2] + a[12 + j] * b[i * 4 + 3];
      }
      return o;
    },
    lookAt(ex, ey, ez, cx, cy, cz, ux, uy, uz) {
      let zx = ex - cx, zy = ey - cy, zz = ez - cz;
      let l = Math.hypot(zx, zy, zz) || 1; zx /= l; zy /= l; zz /= l;
      let xx = uy * zz - uz * zy, xy = uz * zx - ux * zz, xz = ux * zy - uy * zx;
      l = Math.hypot(xx, xy, xz) || 1; xx /= l; xy /= l; xz /= l;
      const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
      return new Float32Array([
        xx, yx, zx, 0,
        xy, yy, zy, 0,
        xz, yz, zz, 0,
        -(xx * ex + xy * ey + xz * ez), -(yx * ex + yy * ey + yz * ez), -(zx * ex + zy * ey + zz * ez), 1]);
    },
    trs(tx, ty, tz, ry, sx, sy, sz) { // 平移 + 绕Y旋转 + 缩放
      const c = Math.cos(ry), s = Math.sin(ry);
      return new Float32Array([
        c * sx, 0, -s * sx, 0,
        0, sy, 0, 0,
        s * sz, 0, c * sz, 0,
        tx, ty, tz, 1]);
    },
  };

  GF.util = {
    clamp, lerp, smoothstep, invLerp, mix3, dist2,
    mulberry32, hash2, hash3, rngAt, weightedPick, shuffle,
    fmtClock, fmtNum, pad2, posKey, chunkKey, vec, moveBasis,
    rgb, hex, toCss,
  };
  GF.Noise = Noise;
  GF.Bus = Bus;
  GF.M4 = M4;
  GF.bus = new Bus();
  GF.VERSION = '1.0.0';

})(globalThis.GF = globalThis.GF || {});
