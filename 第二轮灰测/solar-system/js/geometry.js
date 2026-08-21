/* =======================================================================
 *  geometry.js  —  程序化几何体：正二十面体细分球、全屏三角形、环、星点
 * ======================================================================= */
(function (global) {
  'use strict';
  const SS = (global.SS = global.SS || {});
  const G = {};

  /** 细分正二十面体（单位球），level 0 = 20 面 */
  G.icosphere = function (level) {
    const t = (1 + Math.sqrt(5)) / 2;
    let verts = [
      [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
      [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
      [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1],
    ].map((v) => {
      const l = Math.hypot(v[0], v[1], v[2]);
      return [v[0] / l, v[1] / l, v[2] / l];
    });
    let faces = [
      [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
      [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
      [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
      [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
    ];

    for (let it = 0; it < level; it++) {
      const cache = new Map();
      const nf = [];
      const mid = (a, b) => {
        const key = a < b ? a * 1000003 + b : b * 1000003 + a;
        let idx = cache.get(key);
        if (idx !== undefined) return idx;
        const va = verts[a], vb = verts[b];
        const m = [va[0] + vb[0], va[1] + vb[1], va[2] + vb[2]];
        const l = Math.hypot(m[0], m[1], m[2]);
        verts.push([m[0] / l, m[1] / l, m[2] / l]);
        idx = verts.length - 1;
        cache.set(key, idx);
        return idx;
      };
      for (const f of faces) {
        const a = mid(f[0], f[1]), b = mid(f[1], f[2]), c = mid(f[2], f[0]);
        nf.push([f[0], a, c], [f[1], b, a], [f[2], c, b], [a, b, c]);
      }
      faces = nf;
    }

    const positions = new Float32Array(verts.length * 3);
    for (let i = 0; i < verts.length; i++) {
      positions[i * 3] = verts[i][0];
      positions[i * 3 + 1] = verts[i][1];
      positions[i * 3 + 2] = verts[i][2];
    }
    const indices = new Uint32Array(faces.length * 3);
    for (let i = 0; i < faces.length; i++) {
      indices[i * 3] = faces[i][0];
      indices[i * 3 + 1] = faces[i][1];
      indices[i * 3 + 2] = faces[i][2];
    }
    return { positions, indices, vertexCount: verts.length, triCount: faces.length };
  };

  /** 覆盖全屏的两个三角形（clip space） */
  G.fullscreenQuad = function () {
    return new Float32Array([-1, -1, 3, -1, -1, 3]);
  };

  /** 环带（xz 平面），inner/outer 为半径比例，返回 position(xz) + 半径参数 */
  G.ring = function (inner, outer, segments) {
    const pos = [];
    const idx = [];
    for (let i = 0; i <= segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      const ca = Math.cos(a), sa = Math.sin(a);
      pos.push(ca * inner, 0, sa * inner, inner);
      pos.push(ca * outer, 0, sa * outer, outer);
    }
    for (let i = 0; i < segments; i++) {
      const b = i * 2;
      idx.push(b, b + 1, b + 2, b + 2, b + 1, b + 3);
    }
    return { data: new Float32Array(pos), indices: new Uint32Array(idx) };
  };

  /* --------- 恒星背景：按真实亮度分布生成的随机星点 ------------------- */
  function hashRand(seedObj) {
    // xorshift32，保证多次运行一致
    let s = seedObj.s |= 0;
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    seedObj.s = s | 0;
    return ((s >>> 0) % 16777216) / 16777216;
  }

  /** 黑体色温 → 线性 RGB（近似 Tanner Helland 拟合） */
  G.kelvinToRGB = function (k) {
    const t = k / 100;
    let r, g, b;
    if (t <= 66) {
      r = 255;
      g = 99.4708025861 * Math.log(t) - 161.1195681661;
      b = t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
    } else {
      r = 329.698727446 * Math.pow(t - 60, -0.1332047592);
      g = 288.1221695283 * Math.pow(t - 60, -0.0755148492);
      b = 255;
    }
    const cl = (x) => Math.min(1, Math.max(0, x / 255));
    // sRGB → 线性
    const lin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    return [lin(cl(r)), lin(cl(g)), lin(cl(b))];
  };

  /**
   * 星空点云：位置为单位方向，w 为视亮度。
   * 银河带附近密度提高（银道面倾角简化处理）。
   */
  G.starField = function (count) {
    const seed = { s: 0x1a2b3c4d };
    const data = new Float32Array(count * 8); // dir(3) + mag(1) + color(3) + twinkle(1)
    // 银道面法线（相对黄道约 60.2°）
    const gn = [0.0, Math.cos(60.2 * Math.PI / 180), Math.sin(60.2 * Math.PI / 180)];
    for (let i = 0; i < count; i++) {
      let dir, ok = false;
      for (let tries = 0; tries < 12 && !ok; tries++) {
        const u = hashRand(seed) * 2 - 1;
        const th = hashRand(seed) * Math.PI * 2;
        const r = Math.sqrt(Math.max(0, 1 - u * u));
        dir = [r * Math.cos(th), u, r * Math.sin(th)];
        const lat = Math.abs(dir[0] * gn[0] + dir[1] * gn[1] + dir[2] * gn[2]);
        const p = 0.28 + 0.72 * Math.exp(-(lat * lat) / 0.028);
        ok = hashRand(seed) < p;
      }
      // 亮度：多为暗星，少量亮星（幂律）
      const m = Math.pow(hashRand(seed), 5.0);
      const kelvin = 2600 + Math.pow(hashRand(seed), 0.8) * 16000;
      const c = G.kelvinToRGB(kelvin);
      const o = i * 8;
      data[o] = dir[0]; data[o + 1] = dir[1]; data[o + 2] = dir[2];
      data[o + 3] = 0.055 + m * 1.35;
      data[o + 4] = c[0]; data[o + 5] = c[1]; data[o + 6] = c[2];
      data[o + 7] = hashRand(seed) * 6.2831853;
    }
    return data;
  };

  SS.Geo = G;
})(window);
