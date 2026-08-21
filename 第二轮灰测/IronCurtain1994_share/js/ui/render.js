/* 铁幕1994 — 地图渲染层
 * HOI4 军用地图画风 + 北约军标计数器
 * 经典脚本，无模块；加载时不得触碰 document（DOM/ctx 只在 init/draw 等被调用时发生）。
 * 加载顺序：core.js / rules.js / maps.js / battle.js 之后、ui.js 之前。
 */
(function () {
  'use strict';
  var IC = window.IC;
  var R = IC.Rules || {};
  var Hex = IC.Hex || {};
  var Render = IC.Render = {};

  /* ============================ 常量 ============================ */
  var BASE_SIZE = 34;                 // 六角格基准半径（像素）
  var ZOOM_MIN = 0.5, ZOOM_MAX = 2.2; // 缩放范围
  var SQRT3 = Math.sqrt(3);
  var FONT_SERIF = 'Georgia, "Times New Roman", "Songti SC", serif';
  var FONT_SANS = '"DIN Alternate", "Arial Narrow", "Helvetica Neue", Arial, sans-serif';

  // 目标点/部署区归属色
  var SIDE_COLOR = { NATO: '#4a7ebb', WP: '#b04a4a', NONE: '#9a9a92' };

  // 战场效果（st.effects）配色与标签
  var EFFECT_COLOR = {
    jam: '#6fa8dc', radar: '#e8a33d', sigint: '#59c9d6',
    cyber: '#b06ae0', decoy: '#b0b0b0', maskirovka: '#8fbf6f'
  };
  var EFFECT_LABEL = {
    jam: '干扰', radar: '雷达压制', sigint: '侦察',
    cyber: '数据链', decoy: '假目标', maskirovka: '欺骗'
  };

  /* ============================ 内部状态 ============================ */
  var _canvas = null;                 // 绑定画布
  var _ctx = null;                    // 2D 上下文
  var _dpr = 1;                       // devicePixelRatio
  var _terrainCache = [];             // 地形层离屏缓存（LRU，最多 8 张）
  var _terrainVersion = 1;            // 地形版本号（invalidateTerrain 自增）
  var _fx = [];                       // 瞬时特效队列
  var _paper = null;                  // 纸张噪点纹理（一次性生成）

  /* ============================ 工具函数 ============================ */
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  // 由 (q,r) 生成确定性伪随机 [0,1)
  function hash2(q, r) {
    var h = (q * 374761393 + r * 668265263) | 0;
    h = ((h ^ (h >>> 13)) * 1274126177) | 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  // 每格带盐值的子随机（用于布置格内装饰物，稳定不抖动）
  function hr(h, salt) {
    return hash2((h.q * 129 + salt) | 0, (h.r * 257 + salt * 31) | 0);
  }

  function hexToRgb(h) {
    h = (h || '#808080').replace('#', '');
    if (h.length === 3) h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
    var n = parseInt(h, 16);
    if (isNaN(n)) n = 0x808080;
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  function rgbStr(c) { return 'rgb(' + (c.r | 0) + ',' + (c.g | 0) + ',' + (c.b | 0) + ')'; }
  function lerpColor(a, b, t) {
    return { r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t };
  }
  function mixHex(h1, h2, t) { return rgbStr(lerpColor(hexToRgb(h1), hexToRgb(h2), t)); }
  // amt>=0 提亮，amt<0 压暗
  function shadeRGB(c, amt) {
    var r = c.r, g = c.g, b = c.b;
    if (amt >= 0) { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
    else { r *= (1 + amt); g *= (1 + amt); b *= (1 + amt); }
    return { r: r, g: g, b: b };
  }
  function hexToRgba(hex, a) {
    var c = hexToRgb(hex);
    return 'rgba(' + (c.r | 0) + ',' + (c.g | 0) + ',' + (c.b | 0) + ',' + a + ')';
  }

  // 容错后的 view（所有字段都可为 null/undefined）
  function normView(view) {
    var v = view || {};
    var cam = v.cam || {};
    var zoom = cam.zoom == null ? 1 : cam.zoom;
    if (!isFinite(zoom)) zoom = 1;
    return {
      cam: {
        x: isFinite(cam.x) ? cam.x : 0,
        y: isFinite(cam.y) ? cam.y : 0,
        zoom: clamp(zoom, ZOOM_MIN, ZOOM_MAX)
      },
      fogSide: v.fogSide || null,
      hover: v.hover || null,
      selectedId: v.selectedId || null,
      reachable: v.reachable || null,
      path: v.path || null,
      attackable: v.attackable || null,
      aim: v.aim || null,
      deployZone: v.deployZone || null,
      showGrid: v.showGrid !== false,
      showRad: v.showRad !== false,
      showObjectives: v.showObjectives !== false
    };
  }

  function makeCanvas(w, h) {
    var c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  function mapAt(st, q, r) {
    if (!st || !st.map) return null;
    if (st.map.at) return st.map.at(q, r);
    var hx = st.map.hexes;
    return hx ? hx[Hex.key(q, r)] : null;
  }

  // 世界坐标（地图像素，随 zoom 缩放）
  function worldXY(q, r, size) {
    return { x: size * SQRT3 * (q + r / 2), y: size * 1.5 * r };
  }
  // 世界坐标 → 屏幕坐标（减去相机平移）
  function px(v, q, r, size) {
    var w = worldXY(q, r, size);
    return { x: w.x - v.cam.x, y: w.y - v.cam.y };
  }

  // 六角格多边形路径（pointy-top，顶点朝上）
  function hexPath(ctx, cx, cy, size) {
    ctx.beginPath();
    for (var k = 0; k < 6; k++) {
      var a = Math.PI / 180 * (60 * k - 90);
      var x = cx + size * Math.cos(a), y = cy + size * Math.sin(a);
      if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  // 圆角矩形（不依赖原生 roundRect）
  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // 多边形椭圆（避免依赖 ctx.ellipse，线宽均匀）
  function ellipse(ctx, cx, cy, rx, ry, fill) {
    ctx.beginPath();
    var N = 36;
    for (var i = 0; i <= N; i++) {
      var a = (i / N) * Math.PI * 2;
      var x = cx + rx * Math.cos(a), y = cy + ry * Math.sin(a);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    if (fill) ctx.fill(); else ctx.stroke();
  }

  // 箭头（从 a 指向 b，三角形箭头）
  function drawArrow(ctx, ax, ay, bx, by, len) {
    var ang = Math.atan2(by - ay, bx - ax);
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(ang);
    ctx.beginPath();
    ctx.moveTo(len, 0);
    ctx.lineTo(-len * 0.6, -len * 0.5);
    ctx.lineTo(-len * 0.6, len * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /* ============================ 几何 / 变换 API ============================ */
  Render.hexToScreen = function (st, view, q, r) {
    var v = normView(view);
    var size = BASE_SIZE * v.cam.zoom;
    return px(v, q, r, size);
  };

  Render.screenToHex = function (st, view, sx, sy) {
    var v = normView(view);
    var size = BASE_SIZE * v.cam.zoom;
    var wx = sx + v.cam.x, wy = sy + v.cam.y;
    var p = Hex.fromPixel(wx, wy, size);
    if (mapAt(st, p.q, p.r)) return { q: p.q, r: p.r };
    return null;
  };

  Render.centerOn = function (st, view, q, r) {
    var v = normView(view);
    var size = BASE_SIZE * v.cam.zoom;
    var w = worldXY(q, r, size);
    var cw = _canvas ? (_canvas.clientWidth || 800) : 800;
    var ch = _canvas ? (_canvas.clientHeight || 600) : 600;
    if (view && view.cam) {
      view.cam.x = w.x - cw / 2;
      view.cam.y = w.y - ch / 2;
    }
  };

  // 地图在指定 size 下的包围盒（含边距）
  function mapBounds(st, size) {
    var list = (st && st.map && st.map.list) || [];
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (var i = 0; i < list.length; i++) {
      var h = list[i];
      var w = worldXY(h.q, h.r, size);
      if (w.x < minX) minX = w.x; if (w.x > maxX) maxX = w.x;
      if (w.y < minY) minY = w.y; if (w.y > maxY) maxY = w.y;
    }
    if (!isFinite(minX)) { minX = 0; maxX = 0; minY = 0; maxY = 0; }
    var m = size * 2;
    return { x0: minX - m, y0: minY - m, w: (maxX - minX) + m * 2, h: (maxY - minY) + m * 2 };
  }

  Render.fitMap = function (st, view) {
    if (!st || !st.map) return;
    var cw = _canvas ? (_canvas.clientWidth || 800) : 800;
    var ch = _canvas ? (_canvas.clientHeight || 600) : 600;
    var b = mapBounds(st, BASE_SIZE); // 以 zoom=1 计算尺寸
    var zoom = clamp(Math.min(cw / b.w, ch / b.h), ZOOM_MIN, ZOOM_MAX);
    var v = view || {};
    var cam = v.cam || (v.cam = {});
    cam.zoom = zoom;
    cam.x = (b.x0 + b.w / 2) * zoom - cw / 2;
    cam.y = (b.y0 + b.h / 2) * zoom - ch / 2;
  };

  /* ============================ 地形层（离屏缓存） ============================ */
  Render.invalidateTerrain = function () {
    _terrainVersion++;
    _terrainCache = [];
  };

  function terrainKey(st, view) {
    var z = Math.round(normView(view).cam.zoom * 100);
    var id = (st && st.map && st.map.id) ? st.map.id : 'map';
    return id + '|' + z + '|' + _terrainVersion;
  }

  function getTerrain(st, view) {
    var key = terrainKey(st, view);
    for (var i = 0; i < _terrainCache.length; i++) {
      if (_terrainCache[i].key === key) return _terrainCache[i];
    }
    var built = buildTerrain(st, view);
    built.key = key;
    _terrainCache.push(built);
    if (_terrainCache.length > 8) _terrainCache.shift();
    return built;
  }

  // 纸张噪点纹理（生成一次）
  function getPaper() {
    if (_paper) return _paper;
    var c = makeCanvas(256, 256);
    var g = c.getContext('2d');
    var id = g.createImageData(256, 256);
    for (var i = 0; i < id.data.length; i += 4) {
      var n = 222 + Math.floor(hash2(i, i >> 2) * 32);
      id.data[i] = n; id.data[i + 1] = n; id.data[i + 2] = n; id.data[i + 3] = 255;
    }
    g.putImageData(id, 0, 0);
    _paper = c;
    return c;
  }

  // 建造一张当前 zoom 下的地形离屏图（静态地形：底、地貌装饰、道路、桥梁、水域）
  function buildTerrain(st, view) {
    var v = normView(view);
    var size = BASE_SIZE * v.cam.zoom;
    var b = mapBounds(st, size);
    var canvas = makeCanvas(b.w, b.h);
    var ctx = canvas.getContext('2d');
    var list = (st.map && st.map.list) || [];
    var i, h;

    // 1) 逐格底色 + 地貌装饰
    for (i = 0; i < list.length; i++) {
      h = list[i];
      var terr = R.TERRAIN && R.TERRAIN[h.t] ? R.TERRAIN[h.t] : (R.TERRAIN ? R.TERRAIN.plain : { c1: '#8a9a6b', c2: '#7d8d5f' });
      var w = worldXY(h.q, h.r, size);
      var cx = w.x - b.x0, cy = w.y - b.y0;
      var t = hash2(h.q, h.r);
      var base = lerpColor(hexToRgb(terr.c1), hexToRgb(terr.c2), t);

      // 六角底
      hexPath(ctx, cx, cy, size);
      ctx.fillStyle = rgbStr(base);
      ctx.fill();
      // 顶部提亮、底部压暗的缓坡（哑光浮雕感）
      var g = ctx.createRadialGradient(cx - size * 0.25, cy - size * 0.35, size * 0.1, cx, cy, size * 1.05);
      g.addColorStop(0, rgbStr(shadeRGB(base, 0.10)));
      g.addColorStop(1, rgbStr(shadeRGB(base, -0.13)));
      hexPath(ctx, cx, cy, size);
      ctx.fillStyle = g;
      ctx.fill();

      decorateTerrain(ctx, h, cx, cy, size, terr);
    }

    // 2) 道路（相邻同为道路才连线）
    drawRoads(ctx, st, size, b.x0, b.y0);

    // 3) 纸张纹理叠加
    var p = getPaper();
    ctx.save();
    ctx.globalAlpha = 0.06;
    ctx.globalCompositeOperation = 'overlay';
    var pat = ctx.createPattern(p, 'repeat');
    ctx.fillStyle = pat;
    ctx.fillRect(0, 0, b.w, b.h);
    ctx.restore();

    return { canvas: canvas, x0: b.x0, y0: b.y0 };
  }

  // 各类型地貌装饰
  function decorateTerrain(ctx, h, cx, cy, size, terr) {
    var t = h.t;
    if (terr.water || t === 'ford') drawWaves(ctx, cx, cy, size, terr.water && t === 'sea' ? 3 : 2);
    if (t === 'bridge') drawBridge(ctx, cx, cy, size);
    if (terr.urban) { if (t === 'ruins') drawRuins(ctx, h, cx, cy, size); else drawBuildings(ctx, h, cx, cy, size, t === 'city'); }
    if (t === 'grove') drawTrees(ctx, h, cx, cy, size, false);
    if (t === 'forest') drawTrees(ctx, h, cx, cy, size, true);
    if (t === 'hill' || t === 'ridge') drawContours(ctx, h, cx, cy, size, t === 'ridge');
    if (t === 'marsh') drawMarsh(ctx, h, cx, cy, size);
    if (t === 'plain' || t === 'field' || t === 'steppe' || t === 'field2') drawField(ctx, h, cx, cy, size, t);
    if (t === 'airbase') drawRunway(ctx, cx, cy, size);
    if (t === 'coast') drawCoast(ctx, cx, cy, size);
  }

  function drawWaves(ctx, cx, cy, size, n) {
    ctx.save();
    ctx.strokeStyle = 'rgba(235,245,245,0.20)';
    ctx.lineWidth = 1;
    for (var i = 0; i < n; i++) {
      var yy = cy - size * 0.35 + i * (size * 0.7 / Math.max(1, n));
      ctx.beginPath();
      ctx.moveTo(cx - size * 0.5, yy);
      ctx.quadraticCurveTo(cx, yy - size * 0.12, cx + size * 0.5, yy);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawBridge(ctx, cx, cy, size) {
    ctx.save();
    // 深棕梁体（横跨河流）
    ctx.fillStyle = '#4a4038';
    ctx.fillRect(cx - size * 0.62, cy - size * 0.16, size * 1.24, size * 0.32);
    ctx.strokeStyle = '#2c2620';
    ctx.lineWidth = 1;
    ctx.strokeRect(cx - size * 0.62, cy - size * 0.16, size * 1.24, size * 0.32);
    // 桥面木板
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1;
    for (var i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(cx + i * size * 0.22, cy - size * 0.16);
      ctx.lineTo(cx + i * size * 0.22, cy + size * 0.16);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawBuildings(ctx, h, cx, cy, size, dense) {
    ctx.save();
    var n = dense ? 6 : 3;
    for (var i = 0; i < n; i++) {
      var rx = (hr(h, i + 1) - 0.5) * size * 0.9;
      var ry = (hr(h, i + 11) - 0.5) * size * 0.66;
      var bw = size * (0.14 + hr(h, i + 21) * 0.11);
      var bh = size * (0.15 + hr(h, i + 31) * 0.13);
      var bx = cx + rx - bw / 2, by = cy + ry - bh / 2;
      ctx.fillStyle = 'rgba(70,62,52,0.92)';
      ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = 'rgba(255,255,255,0.09)';
      ctx.fillRect(bx, by, bw, bh * 0.32);
      ctx.strokeStyle = 'rgba(28,24,20,0.45)';
      ctx.lineWidth = 0.75;
      ctx.strokeRect(bx, by, bw, bh);
    }
    ctx.restore();
  }

  function drawRuins(ctx, h, cx, cy, size) {
    ctx.save();
    var n = 5;
    for (var i = 0; i < n; i++) {
      var rx = (hr(h, i + 1) - 0.5) * size * 0.95;
      var ry = (hr(h, i + 11) - 0.5) * size * 0.72;
      var bw = size * (0.12 + hr(h, i + 21) * 0.12);
      var bh = size * (0.08 + hr(h, i + 31) * 0.08);
      // 断壁残垣（带缺口的墙体）
      ctx.fillStyle = 'rgba(56,50,44,0.85)';
      ctx.fillRect(cx + rx - bw / 2, cy + ry, bw, bh * 0.45);
      ctx.fillRect(cx + rx - bw * 0.2, cy + ry + bh * 0.5, bw * 0.5, bh * 0.55);
      // 黑色焦痕
      ctx.fillStyle = 'rgba(18,14,11,0.55)';
      ctx.beginPath();
      ctx.arc(cx + rx, cy + ry, size * 0.09, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawTrees(ctx, h, cx, cy, size, forest) {
    ctx.save();
    var n = forest ? (4 + Math.floor(hr(h, 41) * 2)) : 3; // 森林 4-5，疏林 3
    for (var i = 0; i < n; i++) {
      var rx = (hr(h, i + 1) - 0.5) * size * 0.85;
      var ry = (hr(h, i + 11) - 0.5) * size * 0.58;
      var r = size * (forest ? 0.16 : 0.13) * (0.8 + hr(h, i + 21) * 0.4);
      // 深绿松树三角
      ctx.fillStyle = forest ? 'rgba(24,38,22,0.88)' : 'rgba(42,60,36,0.82)';
      ctx.beginPath();
      ctx.moveTo(cx + rx, cy + ry - r);
      ctx.lineTo(cx + rx - r * 0.9, cy + ry + r * 0.7);
      ctx.lineTo(cx + rx + r * 0.9, cy + ry + r * 0.7);
      ctx.closePath();
      ctx.fill();
      // 树影
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ellipse(ctx, cx + rx, cy + ry + r * 0.85, r * 0.7, r * 0.24, true);
    }
    ctx.restore();
  }

  function drawContours(ctx, h, cx, cy, size, ridge) {
    ctx.save();
    ctx.strokeStyle = ridge ? 'rgba(58,48,36,0.55)' : 'rgba(72,64,42,0.45)';
    ctx.lineWidth = 1;
    var n = ridge ? 3 : 2;
    for (var i = 0; i < n; i++) {
      var rr = size * (0.36 - i * 0.15);
      ctx.beginPath();
      ctx.arc(cx, cy, rr, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, rr, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawMarsh(ctx, h, cx, cy, size) {
    ctx.save();
    ctx.strokeStyle = 'rgba(215,230,222,0.42)';
    ctx.lineWidth = 1;
    for (var i = 0; i < 4; i++) {
      var rx = (hr(h, i + 1) - 0.5) * size * 0.9;
      var ry = (hr(h, i + 11) - 0.5) * size * 0.6;
      ctx.beginPath();
      ctx.moveTo(cx + rx - size * 0.1, cy + ry);
      ctx.lineTo(cx + rx + size * 0.1, cy + ry);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawField(ctx, h, cx, cy, size, kind) {
    ctx.save();
    if (kind === 'field') {         // 耕地：平行犁沟
      ctx.strokeStyle = 'rgba(90,80,40,0.28)';
      ctx.lineWidth = 1;
      for (var i = 0; i < 3; i++) {
        var yy = cy - size * 0.35 + i * size * 0.3;
        ctx.beginPath();
        ctx.moveTo(cx - size * 0.5, yy);
        ctx.lineTo(cx + size * 0.5, yy);
        ctx.stroke();
      }
    } else if (kind === 'field2') { // 果园：成行圆点
      ctx.fillStyle = 'rgba(52,72,42,0.55)';
      for (var j = 0; j < 6; j++) {
        var rx = (hr(h, j + 1) - 0.5) * size * 0.8;
        var ry = (hr(h, j + 11) - 0.5) * size * 0.55;
        ctx.beginPath();
        ctx.arc(cx + rx, cy + ry, size * 0.05, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {                        // 平原/草原：稀疏点
      ctx.fillStyle = 'rgba(60,60,30,0.26)';
      var n = kind === 'steppe' ? 4 : 3;
      for (var k = 0; k < n; k++) {
        var rx2 = (hr(h, k + 1) - 0.5) * size * 0.9;
        var ry2 = (hr(h, k + 11) - 0.5) * size * 0.7;
        ctx.beginPath();
        ctx.arc(cx + rx2, cy + ry2, size * 0.045, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawRunway(ctx, cx, cy, size) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = 'rgba(48,48,46,0.62)';
    ctx.fillRect(-size * 0.55, -size * 0.09, size * 1.1, size * 0.18);
    ctx.strokeStyle = 'rgba(230,230,225,0.5)';
    ctx.lineWidth = 1;
    ctx.setLineDash([size * 0.1, size * 0.08]);
    ctx.beginPath();
    ctx.moveTo(-size * 0.5, 0);
    ctx.lineTo(size * 0.5, 0);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  function drawCoast(ctx, cx, cy, size) {
    ctx.save();
    ctx.strokeStyle = 'rgba(120,180,205,0.4)';
    ctx.lineWidth = 1;
    for (var i = 0; i < 3; i++) {
      var yy = cy - size * 0.4 + i * size * 0.34;
      ctx.beginPath();
      ctx.moveTo(cx - size * 0.45, yy);
      ctx.quadraticCurveTo(cx, yy - size * 0.1, cx + size * 0.45, yy);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawRoads(ctx, st, size, x0, y0) {
    var list = (st.map && st.map.list) || [];
    ctx.lineCap = 'round';
    for (var i = 0; i < list.length; i++) {
      var h = list[i];
      if (!h.road) continue;
      // 只处理方向 0..2，避免同一条路画两次
      for (var d = 0; d < 3; d++) {
        var n = Hex.neighbor(h.q, h.r, d);
        var nh = mapAt(st, n.q, n.r);
        if (!nh || !nh.road) continue;
        var w1 = worldXY(h.q, h.r, size), w2 = worldXY(nh.q, nh.r, size);
        var ax = w1.x - x0, ay = w1.y - y0, bx = w2.x - x0, by = w2.y - y0;
        // 深色路基 + 土黄路面
        ctx.strokeStyle = 'rgba(72,62,42,0.5)';
        ctx.lineWidth = size * 0.22;
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
        ctx.strokeStyle = '#b09a6a';
        ctx.lineWidth = size * 0.13;
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      }
    }
  }

  /* ============================ 覆盖层（每帧重绘） ============================ */

  // 动态战场条件：辐射/化学/烟幕/火焰（随引擎衰减、可动画，故放在覆盖层）
  function drawDynamicTerrain(ctx, st, v, size) {
    var list = (st.map && st.map.list) || [];
    var time = Date.now() / 1000;
    for (var i = 0; i < list.length; i++) {
      var h = list[i];
      var p = px(v, h.q, h.r, size);
      if (h.rad > 0 && v.showRad) drawRadiation(ctx, h, p.x, p.y, size, time);
      if (h.chem > 0) drawChem(ctx, h, p.x, p.y, size);
      if (h.smoke > 0) drawSmokeHex(ctx, h, p.x, p.y, size, time);
      if (h.fire > 0) drawFireHex(ctx, h, p.x, p.y, size, time);
    }
  }

  function drawRadiation(ctx, h, cx, cy, size, time) {
    var lvl = clamp(h.rad, 1, 3);
    ctx.save();
    hexPath(ctx, cx, cy, size);
    ctx.clip();
    // 黄绿色斜线网格
    ctx.strokeStyle = 'rgba(180,210,60,0.5)';
    ctx.lineWidth = 1.2;
    var step = size * (0.52 - lvl * 0.08);
    for (var x = cx - size; x < cx + size; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, cy - size);
      ctx.lineTo(x + size, cy + size);
      ctx.stroke();
    }
    // 脉动荧光
    var pulse = 0.5 + 0.5 * Math.sin(time * 2);
    ctx.fillStyle = 'rgba(160,200,40,' + (0.10 + 0.08 * pulse + lvl * 0.04) + ')';
    ctx.fillRect(cx - size, cy - size, size * 2, size * 2);
    ctx.restore();
    drawTrefoil(ctx, cx, cy, size * 0.34);
  }

  // 三叶辐射符号
  function drawTrefoil(ctx, cx, cy, r) {
    ctx.save();
    ctx.strokeStyle = 'rgba(48,58,10,0.9)';
    ctx.fillStyle = 'rgba(48,58,10,0.88)';
    ctx.lineWidth = Math.max(1, r * 0.16);
    var a0 = -Math.PI / 2;
    for (var i = 0; i < 3; i++) {
      var a = a0 + i * Math.PI * 2 / 3;
      var sxp = cx + Math.cos(a) * r, syp = cy + Math.sin(a) * r;
      ctx.beginPath();
      ctx.arc(sxp, syp, r * 0.55, a - Math.PI * 0.9, a + Math.PI * 0.9);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.14, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawChem(ctx, h, cx, cy, size) {
    var lvl = clamp(h.chem, 1, 3);
    ctx.save();
    hexPath(ctx, cx, cy, size);
    ctx.clip();
    ctx.fillStyle = 'rgba(150,60,200,' + (0.22 + lvl * 0.1) + ')';
    ctx.fillRect(cx - size, cy - size, size * 2, size * 2);
    // 紫色点阵
    ctx.fillStyle = 'rgba(120,40,170,0.72)';
    var step = size * 0.22;
    for (var x = cx - size; x < cx + size; x += step) {
      for (var y = cy - size; y < cy + size; y += step) {
        var ix = Math.round(x), iy = Math.round(y);
        if (hash2(ix, iy) < 0.5) {
          var ox = (hash2(ix, iy + 1) - 0.5) * step * 0.3;
          ctx.beginPath();
          ctx.arc(x + ox, y, size * 0.035, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    ctx.restore();
  }

  function drawSmokeHex(ctx, h, cx, cy, size, time) {
    var lvl = clamp(h.smoke, 1, 3);
    ctx.save();
    hexPath(ctx, cx, cy, size);
    ctx.clip();
    var drift = time * 6;
    for (var i = 0; i < lvl + 1; i++) {
      var rx = (hr(h, i + 1) - 0.5) * size * 0.8 + Math.sin(drift + i) * size * 0.08;
      var ry = (hr(h, i + 11) - 0.5) * size * 0.6 + Math.cos(drift * 0.8 + i) * size * 0.06;
      var rr = size * (0.3 + hr(h, i + 21) * 0.2);
      var g = ctx.createRadialGradient(cx + rx, cy + ry, 0, cx + rx, cy + ry, rr);
      g.addColorStop(0, 'rgba(230,230,230,0.5)');
      g.addColorStop(1, 'rgba(200,200,200,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx + rx, cy + ry, rr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawFireHex(ctx, h, cx, cy, size, time) {
    var lvl = clamp(h.fire, 1, 3);
    ctx.save();
    hexPath(ctx, cx, cy, size);
    ctx.clip();
    var fl = 0.6 + 0.4 * Math.sin(time * 9 + h.q * 2.1 + h.r * 1.7);
    for (var i = 0; i < lvl; i++) {
      var rx = (hr(h, i + 1) - 0.5) * size * 0.6;
      var ry = (hr(h, i + 11) - 0.5) * size * 0.45;
      var rr = size * (0.22 + fl * 0.1 + i * 0.03);
      var g = ctx.createRadialGradient(cx + rx, cy + ry, 0, cx + rx, cy + ry, rr);
      g.addColorStop(0, 'rgba(255,200,60,0.85)');
      g.addColorStop(0.5, 'rgba(230,90,30,0.6)');
      g.addColorStop(1, 'rgba(120,30,10,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx + rx, cy + ry, rr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // 六角网格线
  function drawGrid(ctx, st, v, size) {
    if (!v.showGrid) return;
    var list = (st.map && st.map.list) || [];
    ctx.strokeStyle = 'rgba(20,18,14,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var i = 0; i < list.length; i++) {
      var h = list[i];
      var p = px(v, h.q, h.r, size);
      for (var k = 0; k < 6; k++) {
        var a = Math.PI / 180 * (60 * k - 90);
        var x = p.x + size * Math.cos(a), y = p.y + size * Math.sin(a);
        if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
    }
    ctx.stroke();
  }

  // 目标点徽记（HOI4 风圆形徽记 + 小旗 + 标签）
  function drawObjectives(ctx, st, v, size) {
    if (!v.showObjectives) return;
    var objs = (st.map && st.map.objectives) || [];
    for (var i = 0; i < objs.length; i++) {
      var o = objs[i];
      var p = px(v, o.q, o.r, size);
      var col = o.owner === 'NATO' ? SIDE_COLOR.NATO : (o.owner === 'WP' ? SIDE_COLOR.WP : SIDE_COLOR.NONE);
      ctx.save();
      // 双圈徽记
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x, p.y, size * 0.42, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(p.x, p.y, size * 0.34, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(20,20,16,0.55)';
      ctx.beginPath(); ctx.arc(p.x, p.y, size * 0.3, 0, Math.PI * 2); ctx.fill();
      // 字母标签
      ctx.fillStyle = col;
      ctx.font = 'bold ' + Math.max(9, Math.round(size * 0.3)) + 'px ' + FONT_SANS;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(o.label || '?', p.x, p.y + size * 0.02);
      // 上方小旗
      var flagTop = p.y - size * 0.52;
      ctx.strokeStyle = col; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(p.x, p.y - size * 0.34); ctx.lineTo(p.x, flagTop); ctx.stroke();
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(p.x, flagTop);
      ctx.lineTo(p.x + size * 0.2, flagTop + size * 0.07);
      ctx.lineTo(p.x, flagTop + size * 0.14);
      ctx.closePath();
      ctx.fill();
      // 下方名称
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = Math.max(8, Math.round(size * 0.2)) + 'px ' + FONT_SERIF;
      ctx.fillText(o.name || '', p.x, p.y + size * 0.62);
      ctx.restore();
    }
  }

  // 部署区归属色
  function deploySide(st, key) {
    var d = (st.map && st.map.deploy) || {};
    if (d.NATO && d.NATO.indexOf(key) >= 0) return 'NATO';
    if (d.WP && d.WP.indexOf(key) >= 0) return 'WP';
    return null;
  }

  function drawDeployZone(ctx, st, v, size) {
    if (!v.deployZone) return;
    ctx.save();
    for (var k in v.deployZone) {
      if (!v.deployZone[k]) continue;
      var p = Hex.parse(k);
      if (!mapAt(st, p.q, p.r)) continue;
      var side = deploySide(st, k) || 'NONE';
      var col = SIDE_COLOR[side] || SIDE_COLOR.NONE;
      var c = px(v, p.q, p.r, size);
      hexPath(ctx, c.x, c.y, size);
      ctx.fillStyle = hexToRgba(col, 0.12);
      ctx.fill();
      ctx.setLineDash([size * 0.15, size * 0.1]);
      ctx.strokeStyle = hexToRgba(col, 0.7);
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();
  }

  // 机动范围：半透明白色填充，消耗越高越淡
  function drawReachable(ctx, st, v, size) {
    if (!v.reachable) return;
    ctx.save();
    for (var k in v.reachable) {
      var cell = v.reachable[k];
      var p = Hex.parse(k);
      var cost = (cell && cell.cost != null) ? cell.cost : 1;
      var c = px(v, p.q, p.r, size);
      hexPath(ctx, c.x, c.y, size);
      var alpha = clamp(0.42 - cost * 0.05, 0.08, 0.4);
      ctx.fillStyle = 'rgba(255,255,255,' + alpha + ')';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.restore();
  }

  // 预览路径：虚线折线 + 末端箭头
  function drawPath(ctx, st, v, size) {
    if (!v.path || !v.path.length) return;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,220,90,0.9)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.setLineDash([size * 0.2, size * 0.12]);
    ctx.beginPath();
    for (var i = 0; i < v.path.length; i++) {
      var p = px(v, v.path[i].q, v.path[i].r, size);
      if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    if (v.path.length >= 2) {
      var a = v.path[v.path.length - 2], b = v.path[v.path.length - 1];
      var pa = px(v, a.q, a.r, size), pb = px(v, b.q, b.r, size);
      ctx.fillStyle = 'rgba(255,220,90,0.9)';
      drawArrow(ctx, pa.x, pa.y, pb.x, pb.y, size * 0.3);
    }
    ctx.restore();
  }

  // 可射击目标：红色描边 + 中央命中率
  function drawAttackable(ctx, st, v, size) {
    if (!v.attackable) return;
    ctx.save();
    for (var k in v.attackable) {
      var info = v.attackable[k];
      var p = Hex.parse(k);
      var c = px(v, p.q, p.r, size);
      hexPath(ctx, c.x, c.y, size);
      ctx.strokeStyle = 'rgba(210,40,40,0.9)';
      ctx.lineWidth = 2;
      ctx.stroke();
      var chance = (info && info.chance != null) ? info.chance : null;
      if (chance != null) {
        ctx.fillStyle = 'rgba(30,12,12,0.72)';
        ctx.beginPath(); ctx.arc(c.x, c.y, size * 0.3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ff6a5a';
        ctx.font = 'bold ' + Math.max(9, Math.round(size * 0.24)) + 'px ' + FONT_SANS;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(Math.round(chance * 100) + '%', c.x, c.y);
      }
    }
    ctx.restore();
  }

  // 半径内高亮
  function highlightRadius(ctx, st, v, center, radius, size, fill) {
    var cells = Hex.spiral(center.q, center.r, radius);
    for (var i = 0; i < cells.length; i++) {
      var p = cells[i];
      if (!mapAt(st, p.q, p.r)) continue;
      var c = px(v, p.q, p.r, size);
      hexPath(ctx, c.x, c.y, size);
      ctx.fillStyle = fill;
      ctx.fill();
    }
  }

  // 支援/指令瞄准：以 hover 为中心画警戒圈
  function drawAim(ctx, st, v, size) {
    if (!v.aim || !v.hover) return;
    var radius = v.aim.radius || 1;
    var kind = v.aim.kind || 'op';
    var c = px(v, v.hover.q, v.hover.r, size);
    var R = radius * size * 1.9 + size * 0.5;
    ctx.save();
    if (kind === 'nuke') {
      highlightRadius(ctx, st, v, v.hover, radius, size, 'rgba(255,40,30,0.15)');
      ctx.strokeStyle = 'rgba(255,40,30,0.9)';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(c.x, c.y, R, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,120,40,0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(c.x, c.y, R * 1.15, 0, Math.PI * 2); ctx.stroke();
      drawTrefoil(ctx, c.x, c.y, size * 0.5);
    } else {
      highlightRadius(ctx, st, v, v.hover, radius, size, 'rgba(230,60,40,0.16)');
      ctx.strokeStyle = 'rgba(230,60,40,0.85)';
      ctx.lineWidth = 2;
      ctx.setLineDash([size * 0.18, size * 0.12]);
      ctx.beginPath(); ctx.arc(c.x, c.y, R, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  }

  // 战场效果（jam/radar/sigint/cyber/decoy/maskirovka）
  function drawEffects(ctx, st, v, size, cw, ch) {
    var effs = (st && st.effects) || [];
    var turn = (st && st.turn) || 0;
    var time = Date.now() / 1000;
    var full = [];
    ctx.save();
    for (var i = 0; i < effs.length; i++) {
      var ef = effs[i];
      if (!ef || ef.until < turn) continue;
      if (ef.radius >= 99) { full.push(ef); continue; }
      var c = px(v, ef.q, ef.r, size);
      var R = (ef.radius || 0) * size * 1.9 + size * 0.4;
      var col = EFFECT_COLOR[ef.kind] || '#cccccc';
      ctx.setLineDash([size * 0.2, size * 0.12]);
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(c.x, c.y, R, 0, Math.PI * 2); ctx.stroke();

      if (ef.kind === 'jam') {
        ctx.strokeStyle = col; ctx.lineWidth = 1.5;
        for (var j = 0; j < 3; j++) {
          ctx.beginPath(); ctx.arc(c.x, c.y, R * 0.55 + j * size * 0.14, Math.PI * 0.1, Math.PI * 0.9); ctx.stroke();
        }
      } else if (ef.kind === 'radar') {
        ctx.strokeStyle = col; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(c.x, c.y);
        ctx.lineTo(c.x + Math.cos(time) * R * 0.6, c.y + Math.sin(time) * R * 0.6); ctx.stroke();
      } else if (ef.kind === 'sigint') {
        ctx.strokeStyle = col; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(c.x, c.y, R * 0.5, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(c.x - R * 0.7, c.y); ctx.lineTo(c.x + R * 0.7, c.y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(c.x, c.y - R * 0.7); ctx.lineTo(c.x, c.y + R * 0.7); ctx.stroke();
      } else if (ef.kind === 'cyber') {
        ctx.strokeStyle = col; ctx.lineWidth = 1.5;
        for (var k = 0; k < 4; k++) {
          var gx = c.x + (hr({ q: ef.q, r: ef.r }, k + 1) - 0.5) * R * 1.2;
          var gy = c.y + (hr({ q: ef.q, r: ef.r }, k + 11) - 0.5) * R * 1.2;
          ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx + size * 0.3, gy - size * 0.2); ctx.stroke();
        }
      } else if (ef.kind === 'decoy') {
        ctx.strokeStyle = col; ctx.lineWidth = 1.5;
        for (var m = 0; m < 3; m++) {
          var dx = c.x + (hr({ q: ef.q, r: ef.r }, m + 1) - 0.5) * R;
          var dy = c.y + (hr({ q: ef.q, r: ef.r }, m + 11) - 0.5) * R;
          ctx.strokeRect(dx - size * 0.3, dy - size * 0.2, size * 0.6, size * 0.4);
        }
      } else if (ef.kind === 'maskirovka') {
        ctx.strokeStyle = col; ctx.lineWidth = 1;
        for (var x = c.x - R; x < c.x + R; x += size * 0.25) {
          ctx.beginPath(); ctx.moveTo(x, c.y - R); ctx.lineTo(x + R, c.y + R); ctx.stroke();
        }
      }
      ctx.setLineDash([]);
      if (ef.kind && EFFECT_LABEL[ef.kind]) {
        ctx.fillStyle = col;
        ctx.font = 'bold ' + Math.max(8, Math.round(size * 0.2)) + 'px ' + FONT_SANS;
        ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.fillText(EFFECT_LABEL[ef.kind], c.x, c.y - R - 2);
      }
    }
    // 全域效果横幅
    if (full.length) {
      var msg = '';
      for (var fi = 0; fi < full.length; fi++) msg += (fi ? ' · ' : '') + (EFFECT_LABEL[full[fi].kind] || full[fi].kind);
      var bw = 240, bh = 20;
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(cw / 2 - bw / 2, 6, bw, bh);
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1;
      ctx.strokeRect(cw / 2 - bw / 2, 6, bw, bh);
      ctx.fillStyle = '#e8e2d2';
      ctx.font = Math.round(12) + 'px ' + FONT_SANS;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(msg, cw / 2, 6 + bh / 2 + 1);
    }
    ctx.restore();
  }

  /* ============================ 北约军标 ============================ */
  // 中央军标：方框 + 各兵种符号（白色线条）
  function drawNatoSymbol(ctx, cat, x, y, w, h) {
    ctx.save();
    ctx.strokeStyle = '#f4f2ea';
    ctx.fillStyle = '#f4f2ea';
    ctx.lineWidth = Math.max(1, w * 0.07);
    ctx.lineJoin = 'round';
    var cx = x + w / 2, cy = y + h / 2;
    ctx.strokeRect(x, y, w, h); // 军标外框
    switch (cat) {
      case 'INF': // 方框内交叉斜线
        ctx.beginPath();
        ctx.moveTo(x + 1, y + 1); ctx.lineTo(x + w - 1, y + h - 1);
        ctx.moveTo(x + w - 1, y + 1); ctx.lineTo(x + 1, y + h - 1);
        ctx.stroke();
        break;
      case 'ARM': // 方框内椭圆
        ellipse(ctx, cx, cy, w * 0.32, h * 0.32, false);
        break;
      case 'REC': // 方框内单斜线
        ctx.beginPath(); ctx.moveTo(x + 1, y + 1); ctx.lineTo(x + w - 1, y + h - 1); ctx.stroke();
        break;
      case 'SUP': // 方框内实心点（炮兵）
        ctx.beginPath(); ctx.arc(cx, cy, w * 0.13, 0, Math.PI * 2); ctx.fill();
        break;
      case 'AA': // 方框 + 朝上弧 + 箭头
        ctx.beginPath(); ctx.arc(cx, cy + h * 0.12, w * 0.28, Math.PI, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx, cy + h * 0.05); ctx.lineTo(cx, y + h * 0.12); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx - w * 0.08, y + h * 0.2); ctx.lineTo(cx, y + h * 0.1); ctx.lineTo(cx + w * 0.08, y + h * 0.2); ctx.stroke();
        break;
      case 'HEL': // 方框内旋翼十字
        ctx.beginPath();
        ctx.moveTo(cx - w * 0.32, cy); ctx.lineTo(cx + w * 0.32, cy);
        ctx.moveTo(cx, cy - h * 0.3); ctx.lineTo(cx, cy + h * 0.3);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx - w * 0.32, cy - h * 0.06); ctx.lineTo(cx - w * 0.32, cy + h * 0.06);
        ctx.moveTo(cx + w * 0.32, cy - h * 0.06); ctx.lineTo(cx + w * 0.32, cy + h * 0.06);
        ctx.stroke();
        break;
      case 'AIR': // 方框内机翼椭圆 + 尾翼
        ellipse(ctx, cx, cy, w * 0.42, h * 0.18, false);
        ctx.beginPath();
        ctx.moveTo(cx + w * 0.28, cy); ctx.lineTo(cx + w * 0.4, cy - h * 0.2); ctx.lineTo(cx + w * 0.4, cy + h * 0.2);
        ctx.closePath(); ctx.stroke();
        break;
      case 'EW': // 方框内闪电
        ctx.beginPath();
        ctx.moveTo(cx + w * 0.12, y + h * 0.1);
        ctx.lineTo(cx - w * 0.18, cy + h * 0.02);
        ctx.lineTo(cx + w * 0.02, cy + h * 0.02);
        ctx.lineTo(cx - w * 0.12, y + h * 0.9);
        ctx.lineTo(cx + w * 0.2, cy - h * 0.02);
        ctx.lineTo(cx - w * 0.02, cy - h * 0.02);
        ctx.closePath();
        ctx.fill();
        break;
      case 'LOG': // 方框内竖条
        ctx.beginPath();
        ctx.moveTo(cx - w * 0.1, y + h * 0.12); ctx.lineTo(cx - w * 0.1, y + h * 0.88);
        ctx.moveTo(cx + w * 0.1, y + h * 0.12); ctx.lineTo(cx + w * 0.1, y + h * 0.88);
        ctx.stroke();
        break;
      case 'TR':
      default:   // 方框内轮子
        ctx.beginPath(); ctx.arc(cx, cy, w * 0.22, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx - w * 0.22, cy); ctx.lineTo(cx + w * 0.22, cy);
        ctx.moveTo(cx, cy - w * 0.22); ctx.lineTo(cx, cy + w * 0.22);
        ctx.stroke();
        break;
    }
    ctx.restore();
  }

  // 1994 金星
  function drawGoldStar(ctx, cx, cy, r) {
    ctx.save();
    ctx.fillStyle = '#e8c34a';
    ctx.strokeStyle = '#c9a227';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    for (var i = 0; i < 10; i++) {
      var a = -Math.PI / 2 + i * Math.PI / 5;
      var rr = (i % 2 === 0) ? r : r * 0.45;
      var x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  // 老兵 V 形
  function drawChevrons(ctx, cx, cy, count, r) {
    ctx.save();
    ctx.strokeStyle = '#f4f2ea';
    ctx.lineWidth = Math.max(1, r * 0.3);
    ctx.lineJoin = 'round';
    for (var i = 0; i < count; i++) {
      var off = i * r * 0.9;
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.5 + off, cy - r * 0.4);
      ctx.lineTo(cx + off, cy + r * 0.2);
      ctx.lineTo(cx + r * 0.5 + off, cy - r * 0.4);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawWheel(ctx, cx, cy, r) {
    ctx.save();
    ctx.strokeStyle = '#e8e0c8';
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = Math.max(1, r * 0.3);
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy);
    ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r);
    ctx.stroke();
    ctx.restore();
  }

  // 卡组界面用：返回该卡的北约军标离屏画布
  Render.symbolCanvas = function (card, side, size) {
    var s = size || 64;
    var c = makeCanvas(s, s);
    var ctx = c.getContext('2d');
    var cat = (card && card.category) || 'INF';
    var pad = s * 0.14;
    drawNatoSymbol(ctx, cat, pad, pad, s - pad * 2, s - pad * 2);
    if (card && card.era === 1994) drawGoldStar(ctx, s - pad * 0.8, pad * 0.7, s * 0.08);
    var vet = card && card.vet;
    if (vet === 'veteran') drawChevrons(ctx, pad * 0.7, pad * 0.7, 1, s * 0.06);
    else if (vet === 'elite') drawChevrons(ctx, pad * 0.7, pad * 0.7, 2, s * 0.06);
    return c;
  };

  /* ============================ 单位计数器 ============================ */
  function drawUnits(ctx, st, v, size) {
    var units = (st && st.units) || [];
    var fogSide = v.fogSide;
    var drawList = [];
    for (var i = 0; i < units.length; i++) {
      var u = units[i];
      if (!u || u.dead) continue;
      var ghost = false;
      // 战争迷雾
      if (fogSide && u.side !== fogSide) {
        var sp = u.spotted || {};
        if (!sp[fogSide]) {
          var lsn = u.lastSeenTurn;
          if (lsn != null && st.turn != null && (st.turn - lsn) <= 2) ghost = true;
          else continue;
        }
      }
      drawList.push({ u: u, ghost: ghost });
    }
    // 按行排序，南侧单位后画（在上层）
    drawList.sort(function (a, b) { return (a.u.r - b.u.r) || (a.u.q - b.u.q); });
    for (var j = 0; j < drawList.length; j++) {
      var p = px(v, drawList[j].u.q, drawList[j].u.r, size);
      drawCounter(ctx, v, drawList[j].u, p.x, p.y, size, drawList[j].ghost);
    }
  }

  function drawCounter(ctx, v, u, cx, cy, size, ghost) {
    var card = u.card || {};
    var cat = card.category || 'INF';
    var side = u.side || 'NATO';
    var selected = v.selectedId && u.id === v.selectedId;
    var cw = size * 1.55, ch = size * 1.05;
    var x = cx - cw / 2, y = cy - ch / 2;

    ctx.save();

    // 最后已知位置：30% 透明度灰色虚线
    if (ghost) {
      ctx.globalAlpha = 0.3;
      roundRect(ctx, x, y, cw, ch, size * 0.08);
      ctx.fillStyle = 'rgba(120,120,120,0.15)';
      ctx.fill();
      ctx.strokeStyle = '#9a9a9a';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
      return;
    }

    // 底色渐变（北约蓝 / 华约红；压制加暗；溃散变灰）
    var g = ctx.createLinearGradient(x, y, x, y + ch);
    if (u.state === 'routed') {
      g.addColorStop(0, '#6a6a66');
      g.addColorStop(1, '#55554f');
    } else if (side === 'NATO') {
      g.addColorStop(0, u.state === 'pinned' ? '#233a55' : '#2d4f7c');
      g.addColorStop(1, u.state === 'pinned' ? '#2c4a6a' : '#3b6ea5');
    } else {
      g.addColorStop(0, u.state === 'pinned' ? '#5c2323' : '#7c2d2d');
      g.addColorStop(1, u.state === 'pinned' ? '#6f2c2c' : '#a33b3b');
    }

    if (selected) {
      ctx.shadowColor = 'rgba(255,220,90,0.9)';
      ctx.shadowBlur = size * 0.35;
    }
    roundRect(ctx, x, y, cw, ch, size * 0.08);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.shadowBlur = 0;
    // 金色描边
    ctx.lineWidth = selected ? 2 : 1;
    ctx.strokeStyle = selected ? '#ffe27a' : '#c9a227';
    roundRect(ctx, x, y, cw, ch, size * 0.08);
    ctx.stroke();

    // 中央北约军标
    var sb = size * 0.8;
    var sx = cx - sb / 2, sy = cy - sb / 2 - size * 0.02;
    drawNatoSymbol(ctx, cat, sx, sy, sb, sb);

    // 1994 金星（军标右上角）
    if (card.era === 1994) drawGoldStar(ctx, sx + sb + size * 0.02, sy - size * 0.02, size * 0.12);
    // 老兵 V 形（军标左上角）
    if (card.vet === 'veteran') drawChevrons(ctx, sx - size * 0.04, sy - size * 0.04, 1, size * 0.11);
    else if (card.vet === 'elite') drawChevrons(ctx, sx - size * 0.04, sy - size * 0.04, 2, size * 0.11);

    // 上沿：编制条（绿→黄→红）
    var strRatio = (u.maxStr > 0) ? clamp(u.str / u.maxStr, 0, 1) : 0;
    var barW = cw - size * 0.24;
    var barX = x + size * 0.12;
    var barH = Math.max(2, size * 0.09);
    var barY = y + size * 0.06;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(barX, barY, barW, barH);
    var strCol = strRatio > 0.66 ? '#7fbf5a' : (strRatio > 0.33 ? '#e3c94a' : '#d9534f');
    ctx.fillStyle = strCol;
    ctx.fillRect(barX, barY, barW * strRatio, barH);

    // 下沿：凝聚力条（蓝→橙）
    var coh = clamp((u.cohesion || 0) / 100, 0, 1);
    var cbarY = y + ch - size * 0.15;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(barX, cbarY, barW, barH);
    var cohCol = coh > 0.66 ? '#5aa3d0' : (coh > 0.33 ? '#e8a33d' : '#e06a3d');
    ctx.fillStyle = cohCol;
    ctx.fillRect(barX, cbarY, barW * coh, barH);

    // 右下角：编制数值
    ctx.fillStyle = '#f2efe6';
    ctx.font = 'bold ' + Math.max(8, Math.round(size * 0.26)) + 'px ' + FONT_SANS;
    ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(String(u.str != null ? u.str : 0), x + cw - size * 0.12, y + ch - size * 0.22);

    // 左下角：AP 圆点（最多 6 个）
    var ap = clamp(Math.round(u.ap || 0), 0, 6);
    var apY = y + ch - size * 0.3;
    for (var i = 0; i < ap; i++) {
      ctx.fillStyle = '#ffd76a';
      ctx.beginPath();
      ctx.arc(x + size * 0.18 + i * size * 0.15, apY, size * 0.05, 0, Math.PI * 2);
      ctx.fill();
    }

    // 底部：构筑土堆
    if (u.entrench > 0) {
      var m = clamp(u.entrench, 1, 3);
      var my = y + ch - size * 0.02;
      for (var e = 0; e < m; e++) {
        ctx.fillStyle = '#8a7a5a';
        ctx.beginPath();
        ctx.arc(x + size * 0.22 + e * size * 0.16, my, size * 0.07, Math.PI, Math.PI * 2);
        ctx.fill();
      }
    }

    // 右上：乘车车轮
    if (u.mounted) drawWheel(ctx, x + cw - size * 0.18, y + size * 0.16, size * 0.12);

    // 外侧：朝向三角（装甲面）
    if (u.facing != null) {
      var dir = Hex.DIRS ? (Hex.DIRS[((u.facing % 6) + 6) % 6] || Hex.DIRS[0]) : [1, 0];
      var dx = SQRT3 * (dir[0] + dir[1] / 2);
      var dy = 1.5 * dir[1];
      var len = Math.sqrt(dx * dx + dy * dy) || 1;
      dx /= len; dy /= len;
      var fx = cx + dx * (cw / 2 + size * 0.14);
      var fy = cy + dy * (ch / 2 + size * 0.14);
      ctx.save();
      ctx.translate(fx, fy);
      ctx.rotate(Math.atan2(dy, dx));
      ctx.fillStyle = '#e8d28a';
      ctx.beginPath();
      ctx.moveTo(size * 0.16, 0);
      ctx.lineTo(-size * 0.08, -size * 0.1);
      ctx.lineTo(-size * 0.08, size * 0.1);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // 溃散：白旗
    if (u.state === 'routed') {
      var fxb = x + cw + size * 0.2, fyb = y - size * 0.05;
      ctx.strokeStyle = '#e8e8e8'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(fxb - size * 0.15, fyb + size * 0.3); ctx.lineTo(fxb - size * 0.15, fyb - size * 0.25); ctx.stroke();
      ctx.fillStyle = '#f4f4f4';
      ctx.beginPath();
      ctx.moveTo(fxb - size * 0.15, fyb - size * 0.25);
      ctx.lineTo(fxb + size * 0.1, fyb - size * 0.15);
      ctx.lineTo(fxb - size * 0.15, fyb - size * 0.05);
      ctx.closePath();
      ctx.fill();
    }

    // 下方缩略名（前缀国别缩写）
    var label = String(u.short || card.short || card.name || '');
    var country = card.country;
    if (country && R.COUNTRY && R.COUNTRY[country]) label = country + '·' + label;
    ctx.fillStyle = '#e6e0d0';
    ctx.font = Math.max(8, Math.round(size * 0.26)) + 'px ' + FONT_SANS;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText(label, cx, y + ch + size * 0.05);

    ctx.restore();
  }

  /* ============================ 瞬时特效 ============================ */
  Render.addFX = function (kind, q, r, text) {
    _fx.push({ kind: kind, q: q, r: r, text: text, age: 0, life: 60 });
    if (_fx.length > 200) _fx.shift();
  };

  Render.tickFX = function () {
    var any = false;
    for (var i = _fx.length - 1; i >= 0; i--) {
      _fx[i].age++;
      if (_fx[i].age > _fx[i].life) _fx.splice(i, 1);
      else any = true;
    }
    return any;
  };

  function drawFX(ctx, st, v, size, cw, ch) {
    for (var i = 0; i < _fx.length; i++) {
      var fx = _fx[i];
      var p = fx.age / fx.life;
      var fade = 1 - p;
      var c = px(v, fx.q, fx.r, size);
      switch (fx.kind) {
        case 'hit': drawHitFX(ctx, c.x, c.y, size, p, fade); break;
        case 'kill': drawKillFX(ctx, c.x, c.y, size, p, fade); break;
        case 'nuke': drawNukeFX(ctx, c.x, c.y, size, p, fade, cw, ch); break;
        case 'arty': drawArtyFX(ctx, c.x, c.y, size, p, fade); break;
        case 'smoke': drawSmokeFX(ctx, c.x, c.y, size, p, fade); break;
        case 'spot': drawSpotFX(ctx, c.x, c.y, size, p, fade); break;
        case 'move': drawMoveFX(ctx, c.x, c.y, size, p, fade); break;
      }
      if (fx.text) {
        ctx.fillStyle = 'rgba(255,255,255,' + fade + ')';
        ctx.font = 'bold ' + Math.max(9, Math.round(size * 0.3)) + 'px ' + FONT_SANS;
        ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.fillText(String(fx.text), c.x, c.y - size * 0.6);
      }
    }
  }

  function drawHitFX(ctx, cx, cy, size, p, fade) {
    var r = size * (0.2 + p * 0.5);
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.strokeStyle = '#ffe27a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (var i = 0; i < 6; i++) {
      var a = i * Math.PI / 3 + p;
      ctx.moveTo(cx + Math.cos(a) * r * 0.3, cy + Math.sin(a) * r * 0.3);
      ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,210,80,' + (fade * 0.6) + ')';
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawKillFX(ctx, cx, cy, size, p, fade) {
    var r = size * (0.2 + p * 0.6);
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.strokeStyle = '#ff5a3a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (var i = 0; i < 8; i++) {
      var a = i * Math.PI / 4;
      ctx.moveTo(cx + Math.cos(a) * r * 0.4, cy + Math.sin(a) * r * 0.4);
      ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    ctx.stroke();
    ctx.fillStyle = 'rgba(20,10,8,' + (fade * 0.7) + ')';
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.4, 0, Math.PI * 2); ctx.fill();
    // 骷髅
    ctx.fillStyle = 'rgba(255,255,255,' + fade + ')';
    ctx.beginPath(); ctx.arc(cx, cy - r * 0.12, r * 0.14, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(cx - r * 0.1, cy + r * 0.02, r * 0.2, r * 0.12);
    ctx.fillStyle = 'rgba(20,10,8,' + fade + ')';
    ctx.beginPath(); ctx.arc(cx - r * 0.05, cy - r * 0.12, r * 0.04, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + r * 0.05, cy - r * 0.12, r * 0.04, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawNukeFX(ctx, cx, cy, size, p, fade, cw, ch) {
    var r = size * (0.3 + p * 3);
    ctx.save();
    // 早期屏幕过曝
    if (p < 0.35) {
      ctx.globalAlpha = (1 - p / 0.35) * 0.75;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, cw, ch);
    }
    ctx.globalAlpha = fade;
    // 冲击波双环
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,220,160,0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.8, 0, Math.PI * 2); ctx.stroke();
    // 蘑菇云剪影
    var mh = size * (0.5 + p * 1.2);
    ctx.fillStyle = 'rgba(60,50,40,' + fade + ')';
    ctx.fillRect(cx - size * 0.1, cy - mh * 0.4, size * 0.2, mh * 0.4);
    ctx.beginPath(); ctx.arc(cx, cy - mh * 0.4, size * 0.35, Math.PI, 0); ctx.fill();
    ctx.fillStyle = 'rgba(255,140,50,' + (fade * 0.5) + ')';
    ctx.beginPath(); ctx.arc(cx, cy - mh * 0.2, size * 0.2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawArtyFX(ctx, cx, cy, size, p, fade) {
    ctx.save();
    ctx.globalAlpha = fade;
    var n = 4;
    for (var i = 0; i < n; i++) {
      var rx = cx + (hash2(i, 3) - 0.5) * size * 1.2;
      var ry = cy + (hash2(i, 5) - 0.5) * size * 1.0;
      var r = size * (0.1 + p * 0.4 + hash2(i, 9) * 0.1);
      var g = ctx.createRadialGradient(rx, ry, 0, rx, ry, r);
      g.addColorStop(0, 'rgba(240,235,220,0.9)');
      g.addColorStop(0.5, 'rgba(150,145,135,0.5)');
      g.addColorStop(1, 'rgba(90,88,80,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(rx, ry, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function drawSmokeFX(ctx, cx, cy, size, p, fade) {
    var r = size * (0.2 + p * 1.0);
    var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, 'rgba(200,200,200,' + (fade * 0.6) + ')');
    g.addColorStop(1, 'rgba(160,160,160,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  }

  function drawSpotFX(ctx, cx, cy, size, p, fade) {
    var r = size * (0.3 + p * 0.3);
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.strokeStyle = '#5ad6d6';
    ctx.lineWidth = 2;
    ctx.strokeRect(cx - r / 2, cy - r / 2, r, r);
    ctx.beginPath();
    ctx.moveTo(cx - r / 2, cy - r / 2 + r * 0.25); ctx.lineTo(cx - r / 2, cy - r / 2); ctx.lineTo(cx - r / 2 + r * 0.25, cy - r / 2);
    ctx.moveTo(cx + r / 2 - r * 0.25, cy - r / 2); ctx.lineTo(cx + r / 2, cy - r / 2); ctx.lineTo(cx + r / 2, cy - r / 2 + r * 0.25);
    ctx.moveTo(cx + r / 2, cy + r / 2 - r * 0.25); ctx.lineTo(cx + r / 2, cy + r / 2); ctx.lineTo(cx + r / 2 - r * 0.25, cy + r / 2);
    ctx.moveTo(cx - r / 2 + r * 0.25, cy + r / 2); ctx.lineTo(cx - r / 2, cy + r / 2); ctx.lineTo(cx - r / 2, cy + r / 2 - r * 0.25);
    ctx.stroke();
    ctx.restore();
  }

  function drawMoveFX(ctx, cx, cy, size, p, fade) {
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.strokeStyle = '#5aa3e0';
    ctx.lineWidth = 2;
    for (var i = 0; i < 3; i++) {
      var t = (p * 3 + i / 3) % 1;
      var yy = cy - size * 0.6 + t * size * 1.2;
      ctx.beginPath();
      ctx.moveTo(cx - size * 0.15, yy - size * 0.12);
      ctx.lineTo(cx, yy);
      ctx.lineTo(cx + size * 0.15, yy - size * 0.12);
      ctx.stroke();
    }
    ctx.restore();
  }

  // 悬停高亮
  function drawHover(ctx, st, v, size) {
    if (!v.hover) return;
    var p = px(v, v.hover.q, v.hover.r, size);
    hexPath(ctx, p.x, p.y, size);
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // 暗角
  function drawVignette(ctx, w, h) {
    var g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.45, w / 2, h / 2, Math.max(w, h) * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(10,8,6,0.5)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  /* ============================ 入口 ============================ */
  Render.init = function (canvas) {
    if (!canvas) return;
    _canvas = canvas;
    _ctx = canvas.getContext('2d');
    var dpr = (typeof window !== 'undefined' && window.devicePixelRatio) ? window.devicePixelRatio : 1;
    if (!isFinite(dpr) || dpr < 1) dpr = 1;
    _dpr = clamp(dpr, 1, 3);
  };

  Render.draw = function (st, view) {
    if (!st || !st.map) return;
    if (!_canvas || !_ctx) return;
    var v = normView(view);

    // 高 DPI 尺寸自适应
    var cw = _canvas.clientWidth, ch = _canvas.clientHeight;
    if (!cw || !ch) return;
    var dw = Math.round(cw * _dpr), dh = Math.round(ch * _dpr);
    if (_canvas.width !== dw || _canvas.height !== dh) {
      _canvas.width = dw;
      _canvas.height = dh;
    }
    _ctx.setTransform(_dpr, 0, 0, _dpr, 0, 0);
    var ctx = _ctx;
    var size = BASE_SIZE * v.cam.zoom;

    // 背景
    ctx.fillStyle = '#191512';
    ctx.fillRect(0, 0, cw, ch);

    // 1) 地形层（离屏缓存）
    var terr = getTerrain(st, view);
    ctx.drawImage(terr.canvas, terr.x0 - v.cam.x, terr.y0 - v.cam.y);

    // 2) 动态战场条件（辐射/化学/烟幕/火焰）
    drawDynamicTerrain(ctx, st, v, size);

    // 3) 六角网格
    drawGrid(ctx, st, v, size);

    // 4) 目标点
    drawObjectives(ctx, st, v, size);

    // 5) 部署区
    drawDeployZone(ctx, st, v, size);

    // 6) 战场效果
    drawEffects(ctx, st, v, size, cw, ch);

    // 7) 机动范围 + 路径
    drawReachable(ctx, st, v, size);
    drawPath(ctx, st, v, size);

    // 8) 单位
    drawUnits(ctx, st, v, size);

    // 9) 可射击目标 + 瞄准圈（叠加在单位之上，保证清晰）
    drawAttackable(ctx, st, v, size);
    drawAim(ctx, st, v, size);

    // 10) 悬停
    drawHover(ctx, st, v, size);

    // 11) 瞬时特效
    drawFX(ctx, st, v, size, cw, ch);

    // 12) 暗角
    drawVignette(ctx, cw, ch);
  };
})();
