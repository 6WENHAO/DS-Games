/* =============================================================================
 * textures.js — 程序化生成的低分辨率复古贴图（无外部资源，离线可用）
 *
 * 设计要点：
 *  - 全部用 Canvas2D 画 64~256px 的小图，magFilter=Nearest → 粗糙像素感
 *  - 保留 mipmap（NearestMipmapLinear）避免远处地面剧烈闪烁，但层内仍是硬像素
 *  - 贴图上不写真实汉字（避免缺字体变成豆腐块），改用"笔画感"抽象字形
 *  - 同时输出 roughness/metalness 灰度图，供潮湿地面等 PBR 材质使用
 * ===========================================================================*/
(function () {
  'use strict';
  var HZ = window.HZ;
  var Tex = (HZ.Tex = {});
  var cache = {};

  /* ------------------------------------------------------------ 基础工具 --- */
  function cv(w, h) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h || w;
    return c;
  }
  function ctxOf(c) {
    var g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    return g;
  }
  function fill(g, w, h, col) { g.fillStyle = col; g.fillRect(0, 0, w, h); }

  // 值噪声（带插值），返回 [0,1]
  function valueNoise(rnd, w, h, cell) {
    var gw = Math.ceil(w / cell) + 2, gh = Math.ceil(h / cell) + 2, i;
    var g = new Float32Array(gw * gh);
    for (i = 0; i < g.length; i++) g[i] = rnd();
    var out = new Float32Array(w * h);
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var fx = x / cell, fy = y / cell;
        var x0 = Math.floor(fx), y0 = Math.floor(fy);
        var tx = fx - x0, ty = fy - y0;
        tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
        var a = g[y0 * gw + x0], b = g[y0 * gw + x0 + 1];
        var c = g[(y0 + 1) * gw + x0], d = g[(y0 + 1) * gw + x0 + 1];
        out[y * w + x] = (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
      }
    }
    return out;
  }
  // 多层分形噪声
  function fbm(rnd, w, h, baseCell, octaves) {
    var acc = new Float32Array(w * h), amp = 1, tot = 0, cell = baseCell, i;
    for (var o = 0; o < octaves; o++) {
      var n = valueNoise(rnd, w, h, Math.max(2, cell));
      for (i = 0; i < acc.length; i++) acc[i] += n[i] * amp;
      tot += amp; amp *= 0.5; cell = Math.max(2, cell * 0.5);
    }
    for (i = 0; i < acc.length; i++) acc[i] /= tot;
    return acc;
  }

  // 把噪声以 multiply/overlay 方式盖到画布上
  function overlayNoise(g, w, h, noise, strength, tint) {
    var img = g.getImageData(0, 0, w, h), d = img.data;
    for (var i = 0, p = 0; i < noise.length; i++, p += 4) {
      var n = (noise[i] - 0.5) * 2 * strength * 255;
      d[p] = HZ.clamp(d[p] + n * (tint ? tint[0] : 1), 0, 255);
      d[p + 1] = HZ.clamp(d[p + 1] + n * (tint ? tint[1] : 1), 0, 255);
      d[p + 2] = HZ.clamp(d[p + 2] + n * (tint ? tint[2] : 1), 0, 255);
    }
    g.putImageData(img, 0, 0);
  }

  // 霉斑 / 水渍：软边不规则色块
  function blotches(g, rnd, w, h, count, colors, rMin, rMax, alpha) {
    for (var i = 0; i < count; i++) {
      var x = rnd() * w, y = rnd() * h;
      var r = HZ.range(rnd, rMin, rMax);
      var col = HZ.pick(rnd, colors);
      var grad = g.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, 'rgba(' + col + ',' + (alpha * HZ.range(rnd, 0.6, 1)).toFixed(3) + ')');
      grad.addColorStop(0.55, 'rgba(' + col + ',' + (alpha * 0.45).toFixed(3) + ')');
      grad.addColorStop(1, 'rgba(' + col + ',0)');
      g.fillStyle = grad;
      // 拉成不规则形状
      g.save();
      g.translate(x, y);
      g.rotate(rnd() * Math.PI);
      g.scale(1, HZ.range(rnd, 0.35, 1.6));
      g.translate(-x, -y);
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      g.restore();
    }
  }

  // 顺墙流下的水痕
  function streaks(g, rnd, w, h, count, col) {
    for (var i = 0; i < count; i++) {
      var x = Math.floor(rnd() * w);
      var top = rnd() * h * 0.4;
      var len = HZ.range(rnd, h * 0.25, h * 0.9);
      var wid = HZ.irange(rnd, 1, 4);
      var a = HZ.range(rnd, 0.05, 0.22);
      var grad = g.createLinearGradient(0, top, 0, top + len);
      grad.addColorStop(0, 'rgba(' + col + ',' + a.toFixed(3) + ')');
      grad.addColorStop(1, 'rgba(' + col + ',0)');
      g.fillStyle = grad;
      g.fillRect(x, top, wid, len);
    }
  }

  // 抽象"笔画字形"：竖排的假汉字，避免依赖 CJK 字体
  function glyph(g, x, y, s, col, rnd) {
    g.strokeStyle = col;
    g.lineWidth = Math.max(1, s * 0.12);
    g.lineCap = 'butt';
    var strokes = HZ.irange(rnd, 3, 6);
    for (var i = 0; i < strokes; i++) {
      var horiz = rnd() < 0.62;
      g.beginPath();
      if (horiz) {
        var yy = y + s * HZ.range(rnd, 0.12, 0.88);
        var x0 = x + s * HZ.range(rnd, 0.02, 0.3);
        g.moveTo(x0, yy); g.lineTo(x0 + s * HZ.range(rnd, 0.35, 0.9), yy);
      } else {
        var xx = x + s * HZ.range(rnd, 0.12, 0.88);
        var y0 = y + s * HZ.range(rnd, 0.02, 0.3);
        g.moveTo(xx, y0); g.lineTo(xx, y0 + s * HZ.range(rnd, 0.35, 0.9));
      }
      g.stroke();
    }
  }
  function glyphColumn(g, x, y, size, gap, n, col, rnd) {
    for (var i = 0; i < n; i++) glyph(g, x, y + i * (size + gap), size, col, rnd);
  }

  /* ---------------------------------------------------- Texture 包装 ------ */
  function toTexture(canvas, repX, repY, opts) {
    opts = opts || {};
    var t = new THREE.CanvasTexture(canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.NearestFilter;                       // 硬像素
    t.minFilter = opts.mip === false ? THREE.NearestFilter : THREE.NearestMipmapLinearFilter;
    t.generateMipmaps = opts.mip !== false;
    t.anisotropy = 1;                                        // 复古：不做各向异性
    if (repX || repY) t.repeat.set(repX || 1, repY || 1);
    if ('colorSpace' in t && opts.linear) t.colorSpace = THREE.NoColorSpace;
    t.needsUpdate = true;
    return t;
  }

  /* ============================ 各类贴图生成器 ============================ */
  var gen = {};

  /* 走廊墙面：脏抹灰 + 霉斑 + 水痕 */
  gen.plaster = function (seed) {
    var S = 128, c = cv(S), g = ctxOf(c), rnd = HZ.rng(seed);
    fill(g, S, S, '#6d6f66');
    overlayNoise(g, S, S, fbm(rnd, S, S, 32, 4), 0.16);
    overlayNoise(g, S, S, fbm(rnd, S, S, 4, 2), 0.09);
    blotches(g, rnd, S, S, 14, ['58,66,52', '40,48,38', '74,72,58'], 6, 26, 0.5);
    streaks(g, rnd, S, S, 18, '38,42,34');
    // 剥落的小坑
    for (var i = 0; i < 90; i++) {
      g.fillStyle = 'rgba(' + (rnd() < 0.5 ? '92,92,84' : '46,46,42') + ',' + HZ.range(rnd, 0.2, 0.6).toFixed(2) + ')';
      g.fillRect(Math.floor(rnd() * S), Math.floor(rnd() * S), HZ.irange(rnd, 1, 3), HZ.irange(rnd, 1, 3));
    }
    return c;
  };

  /* 旧墙纸：竖条纹 + 大片脱落露出灰泥 */
  gen.wallpaper = function (seed) {
    var S = 128, c = cv(S), g = ctxOf(c), rnd = HZ.rng(seed);
    fill(g, S, S, '#9a9077');
    // 竖条纹
    for (var x = 0; x < S; x += 8) {
      g.fillStyle = 'rgba(120,110,88,0.35)';
      g.fillRect(x, 0, 3, S);
      g.fillStyle = 'rgba(160,150,124,0.18)';
      g.fillRect(x + 4, 0, 1, S);
    }
    // 小花纹
    for (var i = 0; i < 40; i++) {
      g.fillStyle = 'rgba(108,100,80,0.22)';
      var px = Math.floor(rnd() * S), py = Math.floor(rnd() * S);
      g.fillRect(px, py, 2, 2); g.fillRect(px + 2, py + 2, 2, 2);
    }
    overlayNoise(g, S, S, fbm(rnd, S, S, 24, 4), 0.14);
    // 发霉 + 泛黄
    blotches(g, rnd, S, S, 12, ['74,80,54', '52,58,40', '104,88,52'], 8, 30, 0.55);
    streaks(g, rnd, S, S, 12, '60,54,36');
    // 脱落区域：露出下层灰泥
    var plaster = gen.plaster(seed + 7717);
    for (var k = 0; k < 5; k++) {
      var w = HZ.irange(rnd, 14, 46), h = HZ.irange(rnd, 20, 64);
      var ox = HZ.irange(rnd, 0, S - 1), oy = HZ.irange(rnd, 0, S - 1);
      g.save();
      g.beginPath();
      // 撕裂状多边形
      var steps = 9;
      g.moveTo(ox, oy);
      for (var s = 1; s <= steps; s++) {
        var a = (s / steps) * Math.PI * 2;
        g.lineTo(ox + Math.cos(a) * w * 0.5 * HZ.range(rnd, 0.6, 1.25),
                 oy + Math.sin(a) * h * 0.5 * HZ.range(rnd, 0.6, 1.25));
      }
      g.closePath(); g.clip();
      g.drawImage(plaster, 0, 0);
      g.restore();
      // 撕口暗边
      g.strokeStyle = 'rgba(30,28,22,0.5)'; g.lineWidth = 1; g.stroke();
    }
    return c;
  };

  /* 混凝土（楼梯间 / 天花板） */
  gen.concrete = function (seed) {
    var S = 128, c = cv(S), g = ctxOf(c), rnd = HZ.rng(seed);
    fill(g, S, S, '#5d6060');
    overlayNoise(g, S, S, fbm(rnd, S, S, 20, 4), 0.2);
    blotches(g, rnd, S, S, 10, ['44,50,48', '70,72,70'], 8, 34, 0.4);
    // 裂缝
    for (var i = 0; i < 4; i++) {
      g.strokeStyle = 'rgba(28,30,28,0.55)';
      g.lineWidth = 1;
      g.beginPath();
      var x = rnd() * S, y = rnd() * S;
      g.moveTo(x, y);
      for (var s = 0; s < 14; s++) {
        x += HZ.range(rnd, -6, 6); y += HZ.range(rnd, -2, 9);
        g.lineTo(x, y);
      }
      g.stroke();
    }
    return c;
  };

  /* 木门：竖木纹 + 磨损 + 门板分格 */
  gen.woodDoor = function (seed) {
    var W = 64, H = 128, c = cv(W, H), g = ctxOf(c), rnd = HZ.rng(seed);
    fill(g, W, H, '#5a4633');
    // 木纹
    for (var i = 0; i < 70; i++) {
      var x = rnd() * W;
      g.strokeStyle = 'rgba(' + (rnd() < 0.5 ? '40,30,20' : '104,84,60') + ',' + HZ.range(rnd, 0.12, 0.4).toFixed(2) + ')';
      g.lineWidth = HZ.range(rnd, 0.6, 2.2);
      g.beginPath();
      g.moveTo(x, 0);
      for (var y = 0; y <= H; y += 8) g.lineTo(x + Math.sin((y / H) * Math.PI * HZ.range(rnd, 1, 3)) * 2.5, y);
      g.stroke();
    }
    // 门板凹格
    g.strokeStyle = 'rgba(26,20,14,0.75)'; g.lineWidth = 2;
    g.strokeRect(7, 10, W - 14, H * 0.42);
    g.strokeRect(7, H * 0.53, W - 14, H * 0.4);
    g.strokeStyle = 'rgba(120,100,74,0.25)'; g.lineWidth = 1;
    g.strokeRect(9, 12, W - 18, H * 0.42 - 4);
    overlayNoise(g, W, H, fbm(rnd, W, H, 18, 3), 0.13);
    blotches(g, rnd, W, H, 7, ['34,40,28', '26,22,16'], 5, 20, 0.5);
    streaks(g, rnd, W, H, 6, '28,24,16');
    return c;
  };

  /* 木地板 */
  gen.woodFloor = function (seed) {
    var S = 128, c = cv(S), g = ctxOf(c), rnd = HZ.rng(seed);
    fill(g, S, S, '#4b3f31');
    var plank = 16;
    for (var y = 0; y < S; y += plank) {
      var base = HZ.range(rnd, -14, 14);
      g.fillStyle = 'rgb(' + Math.floor(75 + base) + ',' + Math.floor(63 + base) + ',' + Math.floor(49 + base) + ')';
      g.fillRect(0, y, S, plank - 1);
      g.fillStyle = 'rgba(20,16,12,0.8)';
      g.fillRect(0, y + plank - 1, S, 1);
      // 木纹
      for (var i = 0; i < 26; i++) {
        g.strokeStyle = 'rgba(30,24,18,' + HZ.range(rnd, 0.06, 0.22).toFixed(2) + ')';
        g.lineWidth = 1;
        g.beginPath();
        var yy = y + rnd() * plank;
        g.moveTo(0, yy);
        for (var x = 0; x <= S; x += 16) g.lineTo(x, yy + HZ.range(rnd, -0.8, 0.8));
        g.stroke();
      }
      // 竖向拼缝
      var seam = Math.floor(rnd() * S);
      g.fillStyle = 'rgba(18,14,10,0.7)';
      g.fillRect(seam, y, 1, plank - 1);
    }
    overlayNoise(g, S, S, fbm(rnd, S, S, 26, 4), 0.12);
    blotches(g, rnd, S, S, 9, ['30,34,26', '60,50,34'], 8, 28, 0.45);
    return c;
  };

  /* 榻榻米 */
  gen.tatami = function (seed) {
    var S = 128, c = cv(S), g = ctxOf(c), rnd = HZ.rng(seed);
    fill(g, S, S, '#7d7a4e');
    // 编织横纹
    for (var y = 0; y < S; y++) {
      var t = (y % 4 < 2) ? 0.1 : -0.06;
      g.fillStyle = 'rgba(' + (t > 0 ? '255,250,210' : '20,20,10') + ',' + Math.abs(t).toFixed(2) + ')';
      g.fillRect(0, y, S, 1);
    }
    for (var x = 0; x < S; x += 2) {
      g.fillStyle = 'rgba(40,38,20,0.06)';
      g.fillRect(x, 0, 1, S);
    }
    // 席边黑布
    g.fillStyle = '#22201a'; g.fillRect(0, 0, S, 4); g.fillRect(0, S - 4, S, 4);
    overlayNoise(g, S, S, fbm(rnd, S, S, 22, 3), 0.13);
    blotches(g, rnd, S, S, 8, ['64,66,40', '44,48,30', '90,80,44'], 8, 26, 0.5);
    return c;
  };

  /* 潮湿瓷砖（浴室 / 走廊局部） */
  gen.tile = function (seed) {
    var S = 128, c = cv(S), g = ctxOf(c), rnd = HZ.rng(seed);
    fill(g, S, S, '#8c9490');
    var t = 32;
    for (var y = 0; y < S; y += t) {
      for (var x = 0; x < S; x += t) {
        var v = HZ.range(rnd, -12, 10);
        g.fillStyle = 'rgb(' + Math.floor(136 + v) + ',' + Math.floor(144 + v) + ',' + Math.floor(140 + v) + ')';
        g.fillRect(x + 1, y + 1, t - 2, t - 2);
      }
    }
    // 缝隙发霉
    g.strokeStyle = 'rgba(46,52,42,0.9)'; g.lineWidth = 2;
    for (var i = 0; i <= S; i += t) {
      g.beginPath(); g.moveTo(i, 0); g.lineTo(i, S); g.stroke();
      g.beginPath(); g.moveTo(0, i); g.lineTo(S, i); g.stroke();
    }
    blotches(g, rnd, S, S, 16, ['48,60,44', '30,40,30'], 4, 16, 0.55);
    overlayNoise(g, S, S, fbm(rnd, S, S, 16, 3), 0.1);
    return c;
  };

  /* 锈蚀金属 */
  gen.rust = function (seed) {
    var S = 128, c = cv(S), g = ctxOf(c), rnd = HZ.rng(seed);
    fill(g, S, S, '#5b5a57');
    overlayNoise(g, S, S, fbm(rnd, S, S, 14, 4), 0.22);
    blotches(g, rnd, S, S, 26, ['116,64,30', '84,44,22', '140,86,40'], 4, 22, 0.6);
    streaks(g, rnd, S, S, 14, '92,50,24');
    return c;
  };

  /* 旧报纸（散落地面 / 贴窗） */
  gen.newspaper = function (seed) {
    var W = 128, H = 128, c = cv(W, H), g = ctxOf(c), rnd = HZ.rng(seed);
    fill(g, W, H, '#c8bfa4');
    overlayNoise(g, W, H, fbm(rnd, W, H, 20, 3), 0.07);
    // 报头
    g.fillStyle = '#2a2620';
    glyphColumn(g, 8, 6, 14, 3, 1, '#2a2620', rnd);
    for (var i = 0; i < 4; i++) glyph(g, 24 + i * 16, 6, 14, '#2a2620', rnd);
    g.fillRect(6, 24, W - 12, 1);
    // 正文：小横线模拟文字块
    var y = 30;
    while (y < H - 8) {
      var colw = HZ.irange(rnd, 30, 56);
      var x = 6;
      while (x < W - 8) {
        var lines = HZ.irange(rnd, 3, 8);
        for (var l = 0; l < lines && y + l * 3 < H - 6; l++) {
          g.fillStyle = 'rgba(44,40,34,' + HZ.range(rnd, 0.35, 0.7).toFixed(2) + ')';
          g.fillRect(x, y + l * 3, Math.min(colw, W - 8 - x), 1);
        }
        x += colw + 4;
      }
      y += HZ.irange(rnd, 14, 26);
      // 偶尔一块"照片"
      if (rnd() < 0.35) {
        var pw = HZ.irange(rnd, 22, 40), ph = HZ.irange(rnd, 14, 24);
        var px = HZ.irange(rnd, 6, W - pw - 6);
        g.fillStyle = 'rgba(60,58,54,0.85)'; g.fillRect(px, y, pw, ph);
        var nz = fbm(rnd, pw, ph, 6, 2);
        var img = g.getImageData(px, y, pw, ph), d = img.data;
        for (var p = 0; p < nz.length; p++) {
          var v = 40 + nz[p] * 150;
          d[p * 4] = v; d[p * 4 + 1] = v; d[p * 4 + 2] = v * 0.96;
        }
        g.putImageData(img, px, y);
        y += ph + 6;
      }
    }
    // 泛黄污渍与折痕
    blotches(g, rnd, W, H, 10, ['150,120,60', '96,80,44'], 6, 26, 0.35);
    g.strokeStyle = 'rgba(90,80,60,0.5)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(0, H * 0.5); g.lineTo(W, H * 0.5 + HZ.range(rnd, -3, 3)); g.stroke();
    return c;
  };

  /* 手写纸条 / 日记页 */
  gen.note = function (seed) {
    var W = 96, H = 128, c = cv(W, H), g = ctxOf(c), rnd = HZ.rng(seed);
    fill(g, W, H, '#d8d0b4');
    overlayNoise(g, W, H, fbm(rnd, W, H, 18, 3), 0.06);
    // 竖排手写（抽象字形）
    for (var col = 0; col < 5; col++) {
      var x = W - 16 - col * 17;
      var n = HZ.irange(rnd, 4, 8);
      glyphColumn(g, x, 10, 11, 4, n, 'rgba(38,34,40,0.8)', rnd);
    }
    blotches(g, rnd, W, H, 8, ['150,130,70', '90,84,60'], 5, 18, 0.4);
    // 边缘破损
    g.globalCompositeOperation = 'destination-out';
    for (var i = 0; i < 26; i++) {
      g.beginPath();
      var ex = rnd() < 0.5 ? HZ.range(rnd, 0, 6) : HZ.range(rnd, W - 6, W);
      g.arc(ex, rnd() * H, HZ.range(rnd, 1, 4), 0, Math.PI * 2); g.fill();
    }
    g.globalCompositeOperation = 'source-over';
    return c;
  };

  /* 御札（护符纸条）：泛黄纸 + 朱红竖排字 */
  gen.ofuda = function (seed) {
    var W = 32, H = 128, c = cv(W, H), g = ctxOf(c), rnd = HZ.rng(seed);
    fill(g, W, H, '#e0d6b2');
    overlayNoise(g, W, H, fbm(rnd, W, H, 12, 3), 0.08);
    glyphColumn(g, 8, 8, 15, 5, 6, 'rgba(150,26,26,0.88)', rnd);
    // 朱印
    g.strokeStyle = 'rgba(160,30,30,0.75)'; g.lineWidth = 2;
    g.strokeRect(9, H - 26, 14, 16);
    blotches(g, rnd, W, H, 5, ['140,120,60'], 4, 12, 0.35);
    return c;
  };

  /* 儿童蜡笔画 */
  gen.drawing = function (seed) {
    var S = 96, c = cv(S), g = ctxOf(c), rnd = HZ.rng(seed);
    fill(g, S, S, '#cfc7ab');
    overlayNoise(g, S, S, fbm(rnd, S, S, 14, 2), 0.05);
    // 房子
    g.strokeStyle = '#4a3a2a'; g.lineWidth = 2;
    g.strokeRect(18, 46, 40, 34);
    g.beginPath(); g.moveTo(16, 46); g.lineTo(38, 28); g.lineTo(60, 46); g.stroke();
    g.strokeStyle = '#3a4a5a'; g.strokeRect(28, 60, 10, 20); // 门
    // 三个火柴人：其中一个被涂黑
    var xs = [16, 46, 74];
    for (var i = 0; i < 3; i++) {
      var x = xs[i], y = 30;
      var col = i === 2 ? '#141414' : '#26323c';
      g.strokeStyle = col; g.lineWidth = i === 2 ? 4 : 2;
      g.beginPath(); g.arc(x, y, 5, 0, Math.PI * 2); g.stroke();
      g.beginPath();
      g.moveTo(x, y + 5); g.lineTo(x, y + 20);
      g.moveTo(x - 7, y + 10); g.lineTo(x + 7, y + 10);
      g.moveTo(x, y + 20); g.lineTo(x - 6, y + 32);
      g.moveTo(x, y + 20); g.lineTo(x + 6, y + 32);
      g.stroke();
      if (i === 2) { // 涂掉脸
        g.fillStyle = '#141414';
        g.beginPath(); g.arc(x, y, 6, 0, Math.PI * 2); g.fill();
        // 反复涂抹的线
        for (var k = 0; k < 14; k++) {
          g.strokeStyle = 'rgba(10,10,10,0.6)'; g.lineWidth = 2;
          g.beginPath();
          g.moveTo(x - 10 + rnd() * 20, y - 10 + rnd() * 24);
          g.lineTo(x - 10 + rnd() * 20, y - 10 + rnd() * 24);
          g.stroke();
        }
      }
    }
    // 太阳（画成黑色）
    g.strokeStyle = '#1a1a1a'; g.lineWidth = 2;
    g.beginPath(); g.arc(78, 14, 8, 0, Math.PI * 2); g.stroke();
    return c;
  };

  /* 遗照 / 全家福：脸被刮掉 */
  gen.photo = function (seed) {
    var W = 96, H = 96, c = cv(W, H), g = ctxOf(c), rnd = HZ.rng(seed);
    fill(g, W, H, '#8e8878');
    // 影棚灰底
    var grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#a9a394'); grad.addColorStop(1, '#5d594e');
    g.fillStyle = grad; g.fillRect(6, 6, W - 12, H - 12);
    // 三个模糊人形
    for (var i = 0; i < 3; i++) {
      var x = 22 + i * 26, y = 44;
      g.fillStyle = 'rgba(40,42,44,0.85)';
      g.beginPath(); g.ellipse(x, y + 24, 11, 20, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(180,172,156,0.9)';
      g.beginPath(); g.arc(x, y, 8, 0, Math.PI * 2); g.fill();
    }
    // 刮痕：把脸刮掉
    for (var k = 0; k < 60; k++) {
      g.strokeStyle = 'rgba(228,224,210,' + HZ.range(rnd, 0.4, 0.95).toFixed(2) + ')';
      g.lineWidth = HZ.range(rnd, 1, 2.5);
      g.beginPath();
      var sx = 12 + rnd() * (W - 24), sy = 34 + rnd() * 22;
      g.moveTo(sx, sy); g.lineTo(sx + HZ.range(rnd, -12, 12), sy + HZ.range(rnd, -8, 8));
      g.stroke();
    }
    overlayNoise(g, W, H, fbm(rnd, W, H, 10, 3), 0.1);
    blotches(g, rnd, W, H, 6, ['120,100,50'], 5, 18, 0.35);
    return c;
  };

  /* 苍白皮肤（人形怪物） */
  gen.skin = function (seed) {
    var S = 64, c = cv(S), g = ctxOf(c), rnd = HZ.rng(seed);
    fill(g, S, S, '#b9b3a6');
    overlayNoise(g, S, S, fbm(rnd, S, S, 10, 3), 0.14);
    blotches(g, rnd, S, S, 12, ['120,116,104', '92,96,92', '146,138,126'], 4, 16, 0.5);
    return c;
  };

  /* 荧光灯灯罩（自发光贴图） */
  gen.lampGlass = function (seed) {
    var S = 64, c = cv(S), g = ctxOf(c), rnd = HZ.rng(seed);
    fill(g, S, S, '#cfe6df');
    overlayNoise(g, S, S, fbm(rnd, S, S, 8, 2), 0.08);
    // 灯管内的死虫
    for (var i = 0; i < 7; i++) {
      g.fillStyle = 'rgba(40,38,30,0.7)';
      g.beginPath(); g.ellipse(rnd() * S, rnd() * S, HZ.range(rnd, 1, 3), HZ.range(rnd, 1, 2), rnd(), 0, Math.PI * 2); g.fill();
    }
    return c;
  };

  /* 灰度粗糙度图（给 PBR 用） */
  gen.roughness = function (seed) {
    var S = 64, c = cv(S), g = ctxOf(c), rnd = HZ.rng(seed);
    fill(g, S, S, '#b0b0b0');
    var n = fbm(rnd, S, S, 12, 4);
    var img = g.getImageData(0, 0, S, S), d = img.data;
    for (var i = 0; i < n.length; i++) {
      var v = 70 + n[i] * 150;
      d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v;
    }
    g.putImageData(img, 0, 0);
    // 水洼：低粗糙度（更亮的反射）
    blotches(g, rnd, S, S, 8, ['20,20,20'], 5, 20, 0.9);
    return c;
  };

  /* 尘埃粒子精灵 */
  gen.dust = function () {
    var S = 32, c = cv(S), g = ctxOf(c);
    var grad = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    grad.addColorStop(0, 'rgba(255,255,255,0.9)');
    grad.addColorStop(0.35, 'rgba(220,235,230,0.35)');
    grad.addColorStop(1, 'rgba(200,220,215,0)');
    g.fillStyle = grad; g.fillRect(0, 0, S, S);
    return c;
  };

  /* 手电筒体积光锥的横截面衰减 */
  gen.coneFalloff = function () {
    var S = 64, c = cv(S), g = ctxOf(c);
    var grad = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    grad.addColorStop(0, 'rgba(255,255,255,0.55)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.16)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad; g.fillRect(0, 0, S, S);
    return c;
  };

  /* 墙面污渍贴片（带 alpha，贴在墙上做细节） */
  gen.decalMold = function (seed) {
    var S = 64, c = cv(S), g = ctxOf(c), rnd = HZ.rng(seed);
    g.clearRect(0, 0, S, S);
    blotches(g, rnd, S, S, 10, ['46,56,38', '30,38,28', '62,60,40'], 6, 20, 0.85);
    streaks(g, rnd, S, S, 8, '34,40,30');
    return c;
  };

  /* 电视雪花噪点（动态刷新） */
  Tex.makeStatic = function () {
    var S = 64, c = cv(S), g = ctxOf(c);
    var tex = toTexture(c, 1, 1, { mip: false });
    var img = g.createImageData(S, S);
    var t = 0;
    return {
      texture: tex,
      canvas: c,
      update: function () {
        t++;
        var d = img.data;
        for (var i = 0; i < S * S; i++) {
          var v = Math.random() * 255;
          // 偶尔的水平"扫描条"
          v *= (((i / S | 0) + t) % 17 < 2) ? 1.25 : 0.85;
          v = v > 255 ? 255 : v;
          d[i * 4] = v * 0.85; d[i * 4 + 1] = v; d[i * 4 + 2] = v * 0.95; d[i * 4 + 3] = 255;
        }
        g.putImageData(img, 0, 0);
        tex.needsUpdate = true;
      }
    };
  };

  /* ============================== 对外接口 ============================== */
  var seeds = {
    plaster: 1301, wallpaper: 2207, concrete: 3313, woodDoor: 4409, woodFloor: 5501,
    tatami: 6607, tile: 7703, rust: 8809, newspaper: 9901, note: 10103, ofuda: 11213,
    drawing: 12317, photo: 13411, skin: 14507, lampGlass: 15601, roughness: 16703,
    dust: 17801, coneFalloff: 18901, decalMold: 20011
  };

  /**
   * 取贴图（带缓存）
   * @param name 生成器名
   * @param repX,repY 重复次数
   * @param variant 变体号（同一类贴图的不同随机实例）
   */
  Tex.get = function (name, repX, repY, variant) {
    var v = variant || 0;
    var key = name + '|' + (repX || 1) + '|' + (repY || 1) + '|' + v;
    if (cache[key]) return cache[key];
    var f = gen[name];
    if (!f) throw new Error('未知贴图: ' + name);
    var canvas = f((seeds[name] || 101) + v * 7919);
    var tex = toTexture(canvas, repX, repY, { mip: name !== 'dust' && name !== 'coneFalloff' });
    cache[key] = tex;
    return tex;
  };

  // 需要 alpha 的贴片贴图（不重复、不 mipmap）
  Tex.getDecal = function (name, variant) {
    var key = 'decal|' + name + '|' + (variant || 0);
    if (cache[key]) return cache[key];
    var canvas = gen[name]((seeds[name] || 101) + (variant || 0) * 6151);
    var t = new THREE.CanvasTexture(canvas);
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestMipmapLinearFilter;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    t.needsUpdate = true;
    cache[key] = t;
    return t;
  };

  Tex.clear = function () {
    for (var k in cache) { try { cache[k].dispose(); } catch (e) {} }
    cache = {};
  };
})();
