"use strict";
// ============================================================
//  方块星野 BlockWilds - 数学 / 噪声 / 通用工具
// ============================================================
window.G = window.G || {};

(function() {
  var U = {};

  U.clamp = function(v, a, b) { return v < a ? a : (v > b ? b : v); };
  U.lerp = function(a, b, t) { return a + (b - a) * t; };
  U.smooth = function(t) { return t * t * (3 - 2 * t); };
  U.easeOut = function(t) { return 1 - (1 - t) * (1 - t); };
  U.easeInOut = function(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };

  U.mulberry = function(seed) {
    var st = seed | 0;
    return function() {
      st |= 0; st = st + 0x6D2B79F5 | 0;
      var t = Math.imul(st ^ st >>> 15, 1 | st);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  };

  // ---------- 3D 哈希 ----------
  function h3(x, y, z, s) {
    var h = (s | 0) + x * 374761393 + y * 668265263 + z * 2147483647;
    h = (h ^ (h >>> 13)) * 1274126177;
    h = h ^ (h >>> 16);
    return (h >>> 0) / 4294967296;
  }
  U.hash3 = h3;

  // ---------- 3D 值噪声（平滑插值） ----------
  U.noise3 = function(x, y, z, s) {
    var xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    var xf = x - xi, yf = y - yi, zf = z - zi;
    var u = U.smooth(xf), v = U.smooth(yf), w = U.smooth(zf);
    var c000 = h3(xi, yi, zi, s),     c100 = h3(xi + 1, yi, zi, s);
    var c010 = h3(xi, yi + 1, zi, s), c110 = h3(xi + 1, yi + 1, zi, s);
    var c001 = h3(xi, yi, zi + 1, s), c101 = h3(xi + 1, yi, zi + 1, s);
    var c011 = h3(xi, yi + 1, zi + 1, s), c111 = h3(xi + 1, yi + 1, zi + 1, s);
    var x00 = U.lerp(c000, c100, u), x10 = U.lerp(c010, c110, u);
    var x01 = U.lerp(c001, c101, u), x11 = U.lerp(c011, c111, u);
    return U.lerp(U.lerp(x00, x10, v), U.lerp(x01, x11, v), w);
  };

  // ---------- 分形噪声 ----------
  U.fbm3 = function(x, y, z, s, oct, lac, gain) {
    oct = oct || 4; lac = lac || 2.0; gain = gain || 0.5;
    var sum = 0, amp = 0.5, f = 1, norm = 0;
    for (var i = 0; i < oct; i++) {
      sum += U.noise3(x * f, y * f, z * f, s + i * 1013) * amp;
      norm += amp; amp *= gain; f *= lac;
    }
    return sum / norm;
  };

  // 山脊噪声（山脉/峡谷）
  U.ridge3 = function(x, y, z, s, oct) {
    oct = oct || 3;
    var sum = 0, amp = 0.5, f = 1, norm = 0;
    for (var i = 0; i < oct; i++) {
      var n = U.noise3(x * f, y * f, z * f, s + i * 733);
      n = 1 - Math.abs(n * 2 - 1);
      sum += n * n * amp;
      norm += amp; amp *= 0.5; f *= 2.1;
    }
    return sum / norm;
  };

  // ---------- 向量便捷（复用临时对象，避免GC） ----------
  U.v3 = function(x, y, z) { return new THREE.Vector3(x || 0, y || 0, z || 0); };
  U.tmpV = [];
  for (var i = 0; i < 12; i++) U.tmpV.push(new THREE.Vector3());
  U.tmpQ = [new THREE.Quaternion(), new THREE.Quaternion(), new THREE.Quaternion()];
  U.tmpM = [new THREE.Matrix4(), new THREE.Matrix4()];

  // 把 quaternion 的"up"逐渐对齐到目标 up（球面行走用）
  U.alignUp = function(quat, targetUp, t) {
    var cur = U.tmpV[10].set(0, 1, 0).applyQuaternion(quat);
    var q = U.tmpQ[2].setFromUnitVectors(cur, targetUp);
    var qi = U.tmpQ[1].identity().slerp(q, U.clamp(t, 0, 1));
    quat.premultiply(qi);
    return quat;
  };

  // 格式化 mm:ss
  U.fmtTime = function(sec) {
    sec = Math.max(0, Math.floor(sec));
    var m = Math.floor(sec / 60), s = sec % 60;
    return (m < 10 ? '0' + m : m) + ':' + (s < 10 ? '0' + s : s);
  };

  // DOM 快捷
  U.el = function(tag, cls, parent, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    if (parent) parent.appendChild(e);
    return e;
  };
  U.$ = function(id) { return document.getElementById(id); };

  G.U = U;
})();
