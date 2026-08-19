/* DEEP SPACE CRAFT · noise.js —— 确定性噪声库（地形/星球/洞穴共用） */
(function () {
  'use strict';
  var DSC = (window.DSC = window.DSC || {});

  var SEED = 1337;

  function ihash(x, y, z) {
    /* 32bit 整数哈希（xxhash 风味），返回 0..2^32-1 */
    var h = SEED ^ 0x9E3779B9;
    h = Math.imul(h ^ (x | 0), 0x85EBCA6B);
    h ^= h >>> 13;
    h = Math.imul(h ^ (y | 0), 0xC2B2AE35);
    h ^= h >>> 16;
    h = Math.imul(h ^ (z | 0), 0x27D4EB2F);
    h ^= h >>> 15;
    return h >>> 0;
  }

  function rand2(x, y) { return ihash(x, y, 0) / 4294967296; }
  function rand3(x, y, z) { return ihash(x, y, z) / 4294967296; }

  function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }

  /* --------------------------------------------------------- value 噪声 */
  function value2(x, y) {
    var xi = Math.floor(x), yi = Math.floor(y);
    var xf = x - xi, yf = y - yi;
    var u = fade(xf), v = fade(yf);
    var a = rand2(xi, yi), b = rand2(xi + 1, yi), c = rand2(xi, yi + 1), d = rand2(xi + 1, yi + 1);
    return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
  }

  function value3(x, y, z) {
    var xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    var xf = x - xi, yf = y - yi, zf = z - zi;
    var u = fade(xf), v = fade(yf), w = fade(zf);
    function L(z0) {
      var a = rand3(xi, yi, z0), b = rand3(xi + 1, yi, z0), c = rand3(xi, yi + 1, z0), d = rand3(xi + 1, yi + 1, z0);
      return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
    }
    var l0 = L(zi), l1 = L(zi + 1);
    return l0 + (l1 - l0) * w;
  }

  /* --------------------------------------------------------- 梯度噪声 */
  var G2 = [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7071, 0.7071], [-0.7071, 0.7071], [0.7071, -0.7071], [-0.7071, -0.7071]];
  function grad2(ix, iy, dx, dy) {
    var g = G2[ihash(ix, iy, 7) & 7];
    return g[0] * dx + g[1] * dy;
  }
  /* 返回 -1..1 */
  function perlin2(x, y) {
    var xi = Math.floor(x), yi = Math.floor(y);
    var xf = x - xi, yf = y - yi;
    var u = fade(xf), v = fade(yf);
    var n00 = grad2(xi, yi, xf, yf);
    var n10 = grad2(xi + 1, yi, xf - 1, yf);
    var n01 = grad2(xi, yi + 1, xf, yf - 1);
    var n11 = grad2(xi + 1, yi + 1, xf - 1, yf - 1);
    var a = n00 + (n10 - n00) * u, b = n01 + (n11 - n01) * u;
    return (a + (b - a) * v) * 1.4;
  }

  var G3 = [[1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0], [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
    [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1]];
  function grad3(ix, iy, iz, dx, dy, dz) {
    var g = G3[ihash(ix, iy, iz) % 12];
    return g[0] * dx + g[1] * dy + g[2] * dz;
  }
  function perlin3(x, y, z) {
    var xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    var xf = x - xi, yf = y - yi, zf = z - zi;
    var u = fade(xf), v = fade(yf), w = fade(zf);
    function lerp(a, b, t) { return a + (b - a) * t; }
    var n000 = grad3(xi, yi, zi, xf, yf, zf), n100 = grad3(xi + 1, yi, zi, xf - 1, yf, zf);
    var n010 = grad3(xi, yi + 1, zi, xf, yf - 1, zf), n110 = grad3(xi + 1, yi + 1, zi, xf - 1, yf - 1, zf);
    var n001 = grad3(xi, yi, zi + 1, xf, yf, zf - 1), n101 = grad3(xi + 1, yi, zi + 1, xf - 1, yf, zf - 1);
    var n011 = grad3(xi, yi + 1, zi + 1, xf, yf - 1, zf - 1), n111 = grad3(xi + 1, yi + 1, zi + 1, xf - 1, yf - 1, zf - 1);
    var x00 = lerp(n000, n100, u), x10 = lerp(n010, n110, u), x01 = lerp(n001, n101, u), x11 = lerp(n011, n111, u);
    return lerp(lerp(x00, x10, v), lerp(x01, x11, v), w) * 1.2;
  }

  /* --------------------------------------------------------- 分形 */
  function fbm2(x, y, oct, lac, gain) {
    oct = oct || 4; lac = lac || 2; gain = gain === undefined ? 0.5 : gain;
    var s = 0, a = 1, n = 0;
    for (var i = 0; i < oct; i++) {
      s += perlin2(x, y) * a; n += a; a *= gain; x *= lac; y *= lac;
    }
    return s / n;
  }
  function fbm3(x, y, z, oct, lac, gain) {
    oct = oct || 4; lac = lac || 2; gain = gain === undefined ? 0.5 : gain;
    var s = 0, a = 1, n = 0;
    for (var i = 0; i < oct; i++) {
      s += perlin3(x, y, z) * a; n += a; a *= gain; x *= lac; y *= lac; z *= lac;
    }
    return s / n;
  }
  /* 山脊噪声：0..1，尖锐山脊 */
  function ridged2(x, y, oct, lac, gain) {
    oct = oct || 4; lac = lac || 2.02; gain = gain === undefined ? 0.5 : gain;
    var s = 0, a = 1, n = 0;
    for (var i = 0; i < oct; i++) {
      var v = 1 - Math.abs(perlin2(x, y));
      v *= v;
      s += v * a; n += a; a *= gain; x *= lac; y *= lac;
    }
    return s / n;
  }
  function ridged3(x, y, z, oct) {
    oct = oct || 3;
    var s = 0, a = 1, n = 0;
    for (var i = 0; i < oct; i++) {
      var v = 1 - Math.abs(perlin3(x, y, z)); v *= v;
      s += v * a; n += a; a *= 0.5; x *= 2.01; y *= 2.01; z *= 2.01;
    }
    return s / n;
  }
  /* worley/细胞噪声，返回最近特征点距离（0..~1.4） */
  function worley2(x, y) {
    var xi = Math.floor(x), yi = Math.floor(y), best = 9;
    for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
      var cx = xi + dx, cy = yi + dy;
      var px = cx + rand2(cx, cy), py = cy + rand2(cy, cx + 91);
      var ddx = px - x, ddy = py - y, d = ddx * ddx + ddy * ddy;
      if (d < best) best = d;
    }
    return Math.sqrt(best);
  }
  /* 域扭曲：返回扭曲后的 [x,y] */
  function warp2(x, y, amt, freq) {
    amt = amt === undefined ? 1 : amt; freq = freq || 1;
    var wx = fbm2(x * freq + 5.2, y * freq + 1.3, 3);
    var wy = fbm2(x * freq - 3.7, y * freq + 8.1, 3);
    return [x + wx * amt, y + wy * amt];
  }

  DSC.Noise = {
    setSeed: function (s) { SEED = (s >>> 0) || 1337; },
    getSeed: function () { return SEED; },
    ihash: ihash, rand2: rand2, rand3: rand3,
    value2: value2, value3: value3,
    perlin2: perlin2, perlin3: perlin3,
    fbm2: fbm2, fbm3: fbm3, ridged2: ridged2, ridged3: ridged3,
    worley2: worley2, warp2: warp2,
    /* 便捷：0..1 区间的 fbm */
    fbm2n: function (x, y, oct) { return fbm2(x, y, oct) * 0.5 + 0.5; },
    fbm3n: function (x, y, z, oct) { return fbm3(x, y, z, oct) * 0.5 + 0.5; }
  };
})();
