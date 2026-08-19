/* DEEP SPACE CRAFT · textures.js —— 程序化 16×16 像素贴图图集（委派 B · 契约 §5）
 * 零依赖：一块 256×256 ImageData 直接写像素，最后一次 putImageData。
 * 确定性：内部固定 seed 的 mulberry32（不依赖 math.js，自实现一份），多次 build 结果完全一致。
 * 加载期零 DOM：本文件加载时只做定义；所有 canvas 只在 build()/icon()/debugSheet()/crackTextures() 内惰性创建。
 */
(function () {
  'use strict';
  var DSC = (window.DSC = window.DSC || {});

  /* ----------------------------------------------------------------
   * 57 个 tile 名 —— 顺序即 tileIndex（SPEC §5 硬性契约，一个不能少、不能改名）
   * tileIndex = row*16 + col
   * ---------------------------------------------------------------- */
  var TILE_NAMES = [
    'stone', 'cobblestone', 'dirt', 'grass_top', 'grass_side', 'sand', 'sandstone_top', 'sandstone_side', 'gravel',
    'log_top', 'log_side', 'leaves', 'planks', 'water', 'snow_top', 'snow_side', 'ice', 'bedrock',
    'coal_ore', 'iron_ore', 'gold_ore', 'diamond_ore', 'copper_ore', 'emeril_ore', 'chryson_crystal', 'indium_crystal',
    'alien_grass_top', 'alien_grass_side', 'alien_dirt', 'alien_stone', 'alien_log_top', 'alien_log_side', 'alien_leaves',
    'fungal_cap_top', 'fungal_cap_side', 'lumina_block', 'crystal_block', 'glass',
    'metal_plate', 'metal_panel', 'tech_grate', 'glow_panel', 'hull_white', 'monolith',
    'obsidian', 'magma', 'carbon_block', 'sodium_block', 'launch_pad', 'frost_stone', 'red_sand', 'toxic_sludge',
    'star_bulb', 'salt_block', 'ash_block', 'coral_block', 'alien_sand'
  ];

  var TS = 16, COLS = 16, ROWS = 16, SIZE = 256;

  /* tile 名 -> 序号（纯数据，加载期即可建立，无 DOM） */
  var _index = {};
  for (var _ti = 0; _ti < TILE_NAMES.length; _ti++) _index[TILE_NAMES[_ti]] = _ti;

  /* build 期间内部状态（用完即释放） */
  var _d = null, _ox = 0, _oy = 0, _rng = null;

  /* 各类缓存（幂等） */
  var _atlas = null, _iconCache = {}, _avgCache = {}, _debugCache = null, _crackCache = null;

  /* ------------------------------------------------------------- RNG
   * mulberry32：确定性伪随机，返回 0..1（自实现，不依赖加载顺序） */
  function makeRng(seed) {
    var a = (seed >>> 0) || 1;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* 颜色工具：'#rrggbb' / '#rgb' 或 [r,g,b] / [r,g,b,a] -> [r,g,b,a] */
  function normColor(c) {
    if (typeof c === 'string') {
      c = c.replace('#', '');
      if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
      return [parseInt(c.substr(0, 2), 16), parseInt(c.substr(2, 2), 16), parseInt(c.substr(4, 2), 16), 255];
    }
    if (c.length === 3) return [c[0], c[1], c[2], 255];
    return [c[0], c[1], c[2], c[3]];
  }

  /* 定位当前 tile（name 或序号） */
  function at(tile) {
    var i = typeof tile === 'number' ? tile : _index[tile];
    if (i === undefined) i = 0;
    _ox = (i % COLS) * TS;
    _oy = Math.floor(i / COLS) * TS;
  }

  /* --------------------------------------------------------------
   * 像素工具：tile 局部坐标（0..15），越界自动裁剪，绝不染到邻格
   * px 支持四种调用：px(x,y,r,g,b,a) / px(x,y,[r,g,b]) / px(x,y,[r,g,b,a]) / px(x,y,'#rrggbb')
   * -------------------------------------------------------------- */
  function px(x, y, r, g, b, a) {
    if (x < 0 || x > 15 || y < 0 || y > 15) return;
    if (typeof r === 'object') { a = r.length > 3 ? r[3] : 255; b = r[2]; g = r[1]; r = r[0]; }
    else if (typeof r === 'string') {
      var c = normColor(r); r = c[0]; g = c[1]; b = c[2]; a = c[3];
    }
    var p = ((_oy + y) * SIZE + (_ox + x)) * 4;
    _d[p] = r; _d[p + 1] = g; _d[p + 2] = b; _d[p + 3] = a === undefined ? 255 : a;
  }

  function _fillRect(color) {
    for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) px(x, y, color);
  }
  function _rect(x0, y0, w, h, color) {
    for (var y = y0; y < y0 + h; y++) for (var x = x0; x < x0 + w; x++) px(x, y, color);
  }
  function _hline(y, color) {
    for (var x = 0; x < 16; x++) px(x, y, color);
  }

  /* 团块状噪点：锚点 + 邻域扩散，有"团块感"而非均匀椒盐 */
  function _noise(shades, density) {
    var dens = density === undefined ? 0.3 : density;
    var anchors = Math.max(4, Math.round(256 * dens / 2.2));
    for (var i = 0; i < anchors; i++) {
      var col = shades[Math.floor(_rng() * shades.length)];
      var ax = 1 + Math.floor(_rng() * 14);
      var ay = 1 + Math.floor(_rng() * 14);
      var n = 1 + Math.floor(_rng() * 3);
      for (var k = 0; k < n; k++) {
        px(ax + Math.floor(_rng() * 3) - 1, ay + Math.floor(_rng() * 3) - 1, col);
      }
    }
  }

  /* 实心圆斑（r 可为小数） */
  function _blob(color, cx, cy, r) {
    var rr = Math.ceil(r);
    for (var dy = -rr; dy <= rr; dy++) for (var dx = -rr; dx <= rr; dx++) {
      if (dx * dx + dy * dy <= r * r) px(Math.round(cx) + dx, Math.round(cy) + dy, color);
    }
  }

  /* Bresenham 直线 */
  function _line(x0, y0, x1, y1, color) {
    var dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    var sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    var err = dx - dy;
    for (;;) {
      px(x0, y0, color);
      if (x0 === x1 && y0 === y1) break;
      var e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x0 += sx; }
      if (e2 < dx) { err += dx; y0 += sy; }
    }
  }

  /* 1px（或 w px）边框 */
  function _border(color, w) {
    w = w || 1;
    for (var i = 0; i < w; i++) {
      for (var x = i; x < 16 - i; x++) {
        px(x, i, color); px(x, 15 - i, color);
      }
      for (var y = i; y < 16 - i; y++) {
        px(i, y, color); px(15 - i, y, color);
      }
    }
  }

  /* 棋盘抖动 */
  function _dither(a, b) {
    for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) {
      px(x, y, ((x + y) % 2 === 0) ? a : b);
    }
  }

  /* 契约要求的内部工具（带 tile 参数，自动定位） */
  function fill(tile, color) { at(tile); _fillRect(color); }
  function noise(tile, base, shades, density) { at(tile); if (base) _fillRect(base); _noise(shades, density); }
  function blob(tile, color, cx, cy, r) { at(tile); _blob(color, cx, cy, r); }
  function line(tile, x0, y0, x1, y1, color) { at(tile); _line(x0, y0, x1, y1, color); }
  function border(tile, color, w) { at(tile); _border(color, w || 1); }
  function dither(tile, a, b) { at(tile); _dither(a, b); }

  /* ----------------------------------------------------------------
   * 复合小件：螺钉 / 晶柱 / 岩浆缝 / 冰裂纹
   * ---------------------------------------------------------------- */

  /* 2×2 螺钉：亮面 + 暗面 + 十字槽 */
  function screw(cx, cy) {
    px(cx, cy, [172, 182, 192]); px(cx + 1, cy, [172, 182, 192]);
    px(cx, cy + 1, [104, 114, 124]); px(cx + 1, cy + 1, [104, 114, 124]);
    px(cx + 1, cy, [64, 72, 82]);
  }

  /* 斜向晶柱：亮核心 + 两侧中亮 + 暗色缝隙（自发光"亮而不糊"） */
  function shard(x0, y0, x1, y1, core, mid, dark) {
    var steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1;
    for (var t = 0; t <= steps; t++) {
      var x = x0 + Math.round((x1 - x0) * t / steps);
      var y = y0 + Math.round((y1 - y0) * t / steps);
      px(x, y, core);
      px(x + 1, y, mid); px(x - 1, y, mid);
      if (_rng() < 0.35) px(x, y + 1, dark);
      if (_rng() < 0.2) px(x, y - 1, dark);
    }
    px(x1, y1, core);
  }

  /* 岩浆裂缝：白热核心 + 橙色边缘 + 暗橙外沿，蜿蜒走向 */
  function lavaPath(x0, y0, x1, y1) {
    var steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1;
    for (var t = 0; t <= steps; t++) {
      var x = x0 + Math.round((x1 - x0) * t / steps);
      var y = y0 + Math.round((y1 - y0) * t / steps);
      if (_rng() < 0.5) y += Math.floor(_rng() * 3) - 1;
      else x += Math.floor(_rng() * 3) - 1;
      px(x, y, [255, 224, 128]);
      px(x + 1, y, [255, 106, 0]); px(x - 1, y, [255, 106, 0]);
      px(x, y + 1, [200, 62, 0]); px(x, y - 1, [200, 62, 0]);
      if (_rng() < 0.2) px(x, y, [255, 255, 200]);
    }
  }

  /* 锯齿裂纹线（冰面）：带抖动与随机分支 */
  function jaggedLine(x0, y0, x1, y1, color, w) {
    w = w || 1;
    var steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1;
    for (var t = 0; t <= steps; t++) {
      var x = x0 + Math.round((x1 - x0) * t / steps);
      var y = y0 + Math.round((y1 - y0) * t / steps);
      if (_rng() < 0.6) x += Math.floor(_rng() * 3) - 1;
      if (_rng() < 0.5) y += Math.floor(_rng() * 3) - 1;
      for (var dy = 0; dy < w; dy++) for (var dx = 0; dx < w; dx++) px(x + dx, y + dy, color);
      if (_rng() < 0.12) {
        px(x + Math.floor(_rng() * 5) - 2, y + Math.floor(_rng() * 5) - 2, color);
      }
    }
  }

  /* ----------------------------------------------------------------
   * 共享底纹
   * ---------------------------------------------------------------- */

  /* 石头底纹：矿石共用同一份（MC 精髓：视觉统一）。只画当前 tile，不定位。 */
  function stonePainter() {
    _fillRect('#7E7E7E');
    _noise(['#6F6F6F', '#636363', '#8B8B8B', '#939393'], 0.32);
    _blob('#5C5C5C', 4, 11, 2.6);   // 大暗斑（裂痕感）
    _blob('#5C5C5C', 12, 3, 2);
    _blob('#989898', 2, 4, 1.8);     // 大亮斑
  }

  /* 同心年轮（原木顶 / 异星原木顶共用） */
  function ringTexture(light, dark, pith, bark) {
    for (var y = 0; y < 16; y++) for (var x = 0; x < 16; x++) {
      var dx = x - 7.5, dy = y - 7.5;
      var dist = Math.sqrt(dx * dx + dy * dy);
      var ring = Math.floor(dist * 0.75);
      var col = (ring % 2 === 0) ? light : dark;
      var frac = dist * 0.75 - ring;
      if ((frac < 0.22 || frac > 0.78) && _rng() < 0.35) col = (ring % 2 === 0) ? dark : light;
      px(x, y, col);
    }
    px(7, 7, pith); px(8, 7, pith); px(7, 8, pith); px(8, 8, pith);   // 中心髓点
    _border(bark, 1);
  }

  /* 竖向树皮条纹（原木侧 / 异星原木侧共用） */
  function logSidePainter(shades, edge) {
    _fillRect(shades[1]);
    var x = 0;
    while (x < 16) {
      var w = 1 + Math.floor(_rng() * 3);
      var c = shades[Math.floor(_rng() * shades.length)];
      for (var sx = x; sx < Math.min(16, x + w); sx++) {
        for (var y = 0; y < 16; y++) {
          var cc = c;
          if (_rng() < 0.12) cc = shades[Math.floor(_rng() * shades.length)];
          px(sx, y, cc);
        }
      }
      x += w;
    }
    _border(edge, 1);
  }

  /* 草皮垂边（草侧 / 异星草侧共用）：锯齿状 + 1~2px 悬垂 + 草土分界暗线 */
  function grassSidePainter(greens, hang, edgeLine, highlight, dirtBase, dirtShades) {
    _fillRect(dirtBase);
    for (var y = 7; y < 16; y++) for (var x = 0; x < 16; x++) {
      if (_rng() < 0.28) px(x, y, dirtShades[Math.floor(_rng() * dirtShades.length)]);
    }
    for (x = 0; x < 16; x++) {
      var d = 3 + Math.floor(_rng() * 3);
      var hangN = _rng() < 0.35 ? 1 : 0;
      for (y = 0; y < d; y++) px(x, y, greens[Math.floor(_rng() * greens.length)]);
      if (hangN) px(x, d, hang);
      px(x, d + hangN, edgeLine);
      if (_rng() < 0.25) px(x, 1 + Math.floor(_rng() * d), highlight);
    }
  }

  /* 矿石通用：同一份石头底 + 4~7 簇矿物斑（1px 高光 + 1px 暗边） */
  function oreTile(name, main, dark, light, extra, isDiamond) {
    at(name);
    stonePainter();
    var n = 5 + Math.floor(_rng() * 3);
    for (var i = 0; i < n; i++) {
      var cx = 1 + Math.floor(_rng() * 13);
      var cy = 1 + Math.floor(_rng() * 13);
      var s = 1 + Math.floor(_rng() * 2);
      if (isDiamond) {
        /* 菱形晶簇：中心高光 + 四向 + 外层暗边 */
        px(cx, cy, light);
        px(cx, cy - 1, main); px(cx - 1, cy, main); px(cx + 1, cy, main); px(cx, cy + 1, main);
        px(cx, cy - 2, dark); px(cx - 2, cy, dark); px(cx + 2, cy, dark); px(cx, cy + 2, dark);
      } else {
        for (var dy = 0; dy <= s; dy++) for (var dx = 0; dx <= s; dx++) {
          if (_rng() < 0.72) px(cx + dx, cy + dy, main);
        }
        px(cx + s, cy + s, dark);   // 1px 暗边（右下）
        px(cx, cy, light);          // 1px 高光（左上）
        if (extra && _rng() < 0.45) px(cx + s, cy, extra);   // 点缀色（铜锈等）
      }
    }
    border(name, [0, 0, 0, 50]);
  }

  /* ----------------------------------------------------------------
   * paintAll：按 TILE_NAMES 顺序绘制全部 57 格（rng 序列固定 -> 确定性）
   * ---------------------------------------------------------------- */
  function paintAll() {
    /* ---- 地表/方块（MC 侧） ---- */
    at('stone'); stonePainter(); border('stone', [0, 0, 0, 55]);

    /* 鹅卵石：深色砂浆 + 四块圆角石 + 明暗倒角 */
    at('cobblestone');
    _fillRect('#4B4B4B');
    _rect('#7A7A7A', 0, 0, 7, 7);
    _rect('#868686', 9, 0, 7, 7);
    _rect('#727272', 0, 9, 7, 7);
    _rect('#808080', 9, 9, 7, 7);
    /* 砂浆"咬合"边缘 */
    px(7, 0, '#4B4B4B'); px(7, 1, '#4B4B4B'); px(8, 0, '#4B4B4B');
    px(7, 7, '#4B4B4B'); px(8, 7, '#4B4B4B'); px(7, 8, '#4B4B4B'); px(8, 8, '#4B4B4B');
    /* 每块石：左上亮 / 右下暗 */
    px(0, 0, '#8E8E8E'); px(1, 0, '#8E8E8E'); px(0, 1, '#8E8E8E');
    px(6, 6, '#666666'); px(6, 5, '#666666'); px(5, 6, '#666666');
    px(9, 0, '#949494'); px(10, 0, '#949494'); px(9, 1, '#949494');
    px(15, 6, '#6E6E6E'); px(14, 6, '#6E6E6E'); px(15, 5, '#6E6E6E');
    px(0, 9, '#808080'); px(0, 10, '#808080'); px(1, 9, '#808080');
    px(6, 15, '#5E5E5E'); px(5, 15, '#5E5E5E'); px(6, 14, '#5E5E5E');
    px(9, 9, '#8E8E8E'); px(10, 9, '#8E8E8E'); px(9, 10, '#8E8E8E');
    px(15, 15, '#686868'); px(14, 15, '#686868'); px(15, 14, '#686868');
    _noise(['#7E7E7E', '#6E6E6E', '#8A8A8A'], 0.14);
    border('cobblestone', [0, 0, 0, 50]);

    /* 泥土 */
    at('dirt');
    _fillRect('#8B6849');
    _noise(['#7A5C3F', '#6B5137', '#987550', '#A5815A'], 0.34);
    _blob('#6B5137', 3, 12, 2);
    _blob('#6B5137', 12, 4, 2);
    border('dirt', [0, 0, 0, 50]);

    /* 草顶：两三种绿团块 + 少量亮点 */
    at('grass_top');
    _fillRect('#79C05A');
    _noise(['#6FB04F', '#85C963', '#5E9E42'], 0.4);
    for (var i = 0; i < 9; i++) {
      px(1 + Math.floor(_rng() * 14), 1 + Math.floor(_rng() * 14), [170, 222, 143]);
    }
    border('grass_top', [0, 0, 0, 45]);

    /* 草侧 */
    grassSidePainter(
      ['#79C05A', '#6FB04F', '#85C963', '#5E9E42'], '#65A64A', '#3E6E2E', [170, 226, 138],
      '#8B6849', ['#7A5C3F', '#6B5137', '#987550', '#A5815A']
    );

    /* 沙 */
    at('sand');
    _fillRect('#DBCE9B');
    _noise(['#E8DDB2', '#C9BA85', '#BBA96F', '#E2D5A8'], 0.3);
    border('sand', [0, 0, 0, 40]);

    /* 砂岩顶：内缩 1px 暗边 + 四角小方点 */
    at('sandstone_top');
    _fillRect('#D8C68F');
    _noise(['#CFBD85', '#E2D2A0'], 0.2);
    _rect('#C4B078', 1, 1, 14, 1); _rect('#C4B078', 1, 14, 14, 1);
    _rect('#C4B078', 1, 1, 1, 14); _rect('#C4B078', 14, 1, 1, 14);
    _rect('#C4B078', 3, 3, 2, 2); _rect('#C4B078', 11, 3, 2, 2);
    _rect('#C4B078', 3, 11, 2, 2); _rect('#C4B078', 11, 11, 2, 2);
    border('sandstone_top', '#B9A66F');

    /* 砂岩侧：横向分层带 */
    at('sandstone_side');
    _fillRect('#D8C68F');
    for (var sy = 0; sy < 16; sy++) {
      var sc;
      if (sy === 0 || sy === 1) sc = '#C9B67E';
      else if (sy >= 2 && sy <= 4) sc = '#E4D6A6';
      else if (sy >= 5 && sy <= 9) sc = '#D8C68F';
      else if (sy >= 10 && sy <= 12) sc = '#C4B078';
      else sc = '#E4D6A6';
      _hline(sy, sc);
    }
    _noise(['#CFBD85', '#E2D2A0', '#C4B078'], 0.15);
    border('sandstone_side', '#B9A66F');

    /* 砾石：高密度碎石 */
    at('gravel');
    _fillRect('#7C766A');
    _noise(['#8A8478', '#6E685C', '#5D574C', '#968F80', '#4E483E'], 0.5);
    border('gravel', [0, 0, 0, 45]);

    /* 原木顶：同心年轮 + 中心髓点 */
    ringTexture('#B3A173', '#7A6544', '#5E4A30', '#54422A');

    /* 原木侧：竖向木纹深浅交替 */
    logSidePainter(['#5C4529', '#75593A', '#4A3820', '#806541', '#644E30'], '#4A3820');

    /* 树叶：不透明（流畅风），密团块 + 少量深色"洞" */
    at('leaves');
    _fillRect('#4F7F2B');
    _noise(['#3D6A20', '#5F9836', '#6FA844'], 0.5);
    for (var lv = 0; lv < 8; lv++) {
      px(Math.floor(_rng() * 16), Math.floor(_rng() * 16), [46, 74, 26]);
    }
    border('leaves', [0, 0, 0, 40]);

    /* 木板：4 条横板 + 板缝暗线 + 钉点 + 木纹细线 */
    at('planks');
    _fillRect('#B08D5B');
    _noise(['#A6824F', '#BA9764', '#9C7A48', '#C4A06C'], 0.22);
    for (var pb = 0; pb < 4; pb++) {
      var pSy = pb * 4 + 3;
      for (var pX = 0; pX < 16; pX++) px(pX, pSy, '#5A462A');
    }
    var pSeams = [7, 3, 11, 7];
    for (pb = 0; pb < 4; pb++) {
      var pSx = pSeams[pb];
      for (var pY = pb * 4; pY < pb * 4 + 3; pY++) px(pSx, pY, '#5A462A');
      px(pSx - 1, pb * 4 + 1, '#4A3820'); px(pSx, pb * 4 + 1, '#4A3820');
      px(pSx - 1, pb * 4 + 2, '#4A3820'); px(pSx, pb * 4 + 2, '#4A3820');
      px(pSx - 1, pb * 4 + 1, '#8E6E40');
    }
    for (pb = 0; pb < 4; pb++) {
      var gY = pb * 4 + (pb % 2 === 0 ? 0 : 2);
      var gX0 = Math.floor(_rng() * 5), gLen = 4 + Math.floor(_rng() * 6);
      for (var gX = gX0; gX < gX0 + gLen && gX < 16; gX++) px(gX, gY, '#9C7A48');
    }
    border('planks', '#6E5636');

    /* 水：2~3 档蓝 + 横向波峰（半透明，shader 将来做流动） */
    at('water');
    _fillRect([62, 118, 228, 205]);
    for (var wX = 0; wX < 16; wX++) {
      px(wX, 14, [48, 94, 190, 205]); px(wX, 15, [42, 84, 172, 210]);
    }
    var crests = [2, 6, 9, 12];
    for (var wc = 0; wc < crests.length; wc++) {
      var wY = crests[wc], wPhase = wc * 2;
      for (var wX2 = 0; wX2 < 16; wX2++) {
        if (((wX2 + wPhase) % 9) < 3) {
          px(wX2, wY, [95, 155, 240, 220]);
          if (_rng() < 0.5) px(wX2, wY + 1, [80, 140, 235, 200]);
        }
      }
    }
    for (var wI = 0; wI < 10; wI++) {
      px(1 + Math.floor(_rng() * 14), 1 + Math.floor(_rng() * 13), [140, 190, 250, 230]);
    }

    /* 雪顶 */
    at('snow_top');
    _fillRect('#F2F5F7');
    _noise(['#E8EDF1', '#DAE2E8', '#FFFFFF'], 0.3);
    for (var sI = 0; sI < 8; sI++) {
      px(Math.floor(_rng() * 16), Math.floor(_rng() * 16), [255, 255, 255]);
    }
    border('snow_top', [0, 0, 0, 30]);

    /* 雪侧：底部微暗（积雪厚度感） */
    at('snow_side');
    _fillRect('#F2F5F7');
    _noise(['#E8EDF1', '#DAE2E8'], 0.28);
    for (var sX = 0; sX < 16; sX++) {
      px(sX, 13, [214, 222, 230]); px(sX, 14, [205, 214, 222]); px(sX, 15, [196, 206, 214]);
    }
    border('snow_side', [0, 0, 0, 28]);

    /* 冰：半透浅蓝 + 白色裂纹斜线 */
    at('ice');
    _fillRect([143, 184, 255, 190]);
    _noise(['#79A6F2', '#A6C8FF', '#6E96E0'], 0.2);
    jaggedLine(1, 3, 15, 12, [255, 255, 255, 235], 1);
    jaggedLine(2, 10, 13, 4, [255, 255, 255, 200], 1);
    border('ice', [100, 140, 220, 120]);

    /* 基岩：近黑 + 大量暗洞 + 少量亮 */
    at('bedrock');
    _fillRect('#4A4A4A');
    _noise(['#2B2B2B', '#1E1E1E', '#3A3A3A', '#5E5E5E', '#6E6E6E'], 0.5);
    for (var bI = 0; bI < 6; bI++) {
      _blob('#141414', 1 + Math.floor(_rng() * 14), 1 + Math.floor(_rng() * 14), 1 + Math.floor(_rng() * 1.4));
    }
    border('bedrock', [0, 0, 0, 60]);

    /* ---- 矿石（同一份石头底纹） ---- */
    oreTile('coal_ore', [35, 35, 38], [14, 14, 16], [110, 123, 140]);
    oreTile('iron_ore', [216, 175, 147], [162, 124, 98], [240, 211, 190]);
    oreTile('gold_ore', [252, 227, 64], [208, 160, 20], [255, 248, 168]);
    oreTile('diamond_ore', [95, 232, 224], [44, 164, 156], [190, 255, 250], null, true);
    oreTile('copper_ore', [232, 130, 74], [176, 90, 40], [255, 199, 155], [78, 201, 168]);
    oreTile('emeril_ore', [63, 224, 106], [26, 168, 66], [170, 255, 196]);

    /* ---- 自发光晶体（高饱和核心 + 暗色缝隙，亮而不糊） ---- */
    at('chryson_crystal');
    _fillRect('#141C0E');
    shard(4, 2, 6, 10, '#FFF9C0', '#FFE94A', '#C9B030');
    shard(9, 12, 12, 5, '#FFF9C0', '#FFE94A', '#C9B030');
    shard(12, 2, 13, 5, '#FFF9C0', '#F0D840', '#B89A20');
    shard(1, 13, 3, 9, '#FFF9C0', '#FFE94A', '#C9B030');
    for (var cI = 0; cI < 6; cI++) {
      px(1 + Math.floor(_rng() * 14), 1 + Math.floor(_rng() * 14), [214, 240, 120, 150]);
    }

    at('indium_crystal');
    _fillRect('#140A20');
    shard(3, 13, 6, 4, '#E4D0FF', '#8A5CFF', '#4A2A80');
    shard(9, 12, 11, 5, '#E4D0FF', '#8A5CFF', '#4A2A80');
    shard(13, 9, 14, 3, '#E4D0FF', '#7A4AFF', '#3A1E68');
    shard(6, 1, 8, 4, '#E4D0FF', '#9A6CFF', '#4A2A80');
    for (var iI = 0; iI < 6; iI++) {
      px(1 + Math.floor(_rng() * 14), 1 + Math.floor(_rng() * 14), [180, 150, 255, 140]);
    }

    /* ---- 外星系列（青紫 / 橙红 / 毒绿异星配色，保持 MC 手感） ---- */
    at('alien_grass_top');
    _fillRect('#7A5AC8');
    _noise(['#5E42A8', '#8A68D8', '#9A7AE0'], 0.4);
    for (var agI = 0; agI < 9; agI++) {
      px(1 + Math.floor(_rng() * 14), 1 + Math.floor(_rng() * 14), [192, 166, 240]);
    }
    for (var agJ = 0; agJ < 5; agJ++) {
      px(1 + Math.floor(_rng() * 14), 1 + Math.floor(_rng() * 14), [90, 184, 200]);
    }
    border('alien_grass_top', [0, 0, 0, 45]);

    grassSidePainter(
      ['#7A5AC8', '#6A4AB8', '#8A68D8', '#5E42A8'], '#8F6FD8', '#4A3290', [192, 166, 240],
      '#4E3760', ['#42304F', '#3A2944', '#5C446E', '#6A5280']
    );

    at('alien_dirt');
    _fillRect('#4E3760');
    _noise(['#42304F', '#3A2944', '#5C446E', '#6A5280'], 0.34);
    border('alien_dirt', [0, 0, 0, 50]);

    at('alien_stone');
    _fillRect('#3A3A46');
    _noise(['#2C2C36', '#4E4E5C', '#585866', '#46364F'], 0.35);
    _blob('#2E2436', 11, 3, 2);
    border('alien_stone', [0, 0, 0, 55]);

    ringTexture([78, 192, 184], [42, 122, 116], [90, 216, 204], '#1E5E58');
    logSidePainter(['#2A7A74', '#3BA8A0', '#4EC0B8', '#34867E', '#57D0C4'], '#1E5E58');

    at('alien_leaves');
    _fillRect('#2E7A6E');
    _noise(['#256659', '#3B9688', '#4AB0A0', '#1E5348'], 0.5);
    border('alien_leaves', [0, 0, 0, 40]);

    /* 蘑菇盖顶：橙红 + 径向明暗 + 奶油斑点 */
    at('fungal_cap_top');
    _fillRect('#D84A2E');
    _blob('#E8734C', 7, 7, 4);
    _noise(['#B03A24', '#C8452A', '#EF8A64'], 0.22);
    var fSpots = [[2, 3], [5, 11], [9, 4], [12, 10], [4, 6], [11, 12]];
    for (var fS = 0; fS < fSpots.length; fS++) {
      _blob('#FFD9B0', fSpots[fS][0], fSpots[fS][1], 1.4);
    }
    border('fungal_cap_top', '#8A2A1C');

    /* 蘑菇盖侧：竖向肋纹 + 上部斑点 + 底部菌褶暗边 */
    at('fungal_cap_side');
    _fillRect('#D84A2E');
    for (var fX = 0; fX < 16; fX++) {
      if (fX % 3 === 0) for (var fY = 0; fY < 16; fY++) px(fX, fY, '#B03A24');
    }
    _noise(['#C8452A', '#EF8A64'], 0.15);
    _blob('#FFD9B0', 4, 3, 1); _blob('#FFD9B0', 11, 5, 1);
    for (var fX2 = 0; fX2 < 16; fX2++) {
      px(fX2, 14, '#7A2418'); px(fX2, 15, '#6E2015');
    }
    border('fungal_cap_side', '#8A2A1C');

    /* 亮块：亮青白面板 + 网格暗缝 + 四格辉光（自发光 1.0） */
    at('lumina_block');
    _fillRect('#C8F4FF');
    for (var lY = 0; lY < 16; lY++) { px(7, lY, '#5EB8D8'); px(8, lY, '#5EB8D8'); }
    for (var lX = 0; lX < 16; lX++) { px(lX, 7, '#5EB8D8'); px(lX, 8, '#5EB8D8'); }
    _blob('#FFFFFF', 4, 4, 2); _blob('#FFFFFF', 12, 4, 2);
    _blob('#FFFFFF', 4, 12, 2); _blob('#FFFFFF', 12, 12, 2);
    border('lumina_block', '#4AA0C0');

    /* 水晶块：半透青 + 对角刻面 + 白色亮点 */
    at('crystal_block');
    _fillRect([138, 232, 232, 195]);
    _line(1, 4, 14, 12, [200, 255, 255, 200]);
    _line(2, 13, 13, 5, [120, 200, 215, 140]);
    _noise(['#6EC8D8', '#A8F0F0', '#C8FFFF'], 0.2);
    for (var crI = 0; crI < 8; crI++) {
      px(1 + Math.floor(_rng() * 14), 1 + Math.floor(_rng() * 14), [255, 255, 255, 220]);
    }
    border('crystal_block', [90, 170, 190, 110]);

    /* 玻璃：四边 1px 框 + 对角高光 + 中间近透明 */
    at('glass');
    _fillRect([168, 208, 232, 26]);
    _line(1, 3, 8, 10, [240, 250, 255, 220]);
    _line(9, 11, 14, 15, [240, 250, 255, 150]);
    _line(3, 9, 6, 12, [255, 255, 255, 80]);
    border('glass', [216, 232, 242, 240]);
    /* 四角加厚 */
    px(0, 0, [200, 220, 235, 255]); px(1, 0, [200, 220, 235, 255]); px(0, 1, [200, 220, 235, 255]);
    px(15, 0, [200, 220, 235, 255]); px(14, 0, [200, 220, 235, 255]); px(15, 1, [200, 220, 235, 255]);
    px(0, 15, [200, 220, 235, 255]); px(1, 15, [200, 220, 235, 255]); px(0, 14, [200, 220, 235, 255]);
    px(15, 15, [200, 220, 235, 255]); px(14, 15, [200, 220, 235, 255]); px(15, 14, [200, 220, 235, 255]);

    /* ---- 科技类（NMS 味） ---- */
    /* 金属板：蓝灰面板 + 分割线 + 8 螺钉 + 倒角 */
    at('metal_plate');
    _fillRect('#5A6A78');
    _dither('#5A6A78', [84, 99, 112, 60]);
    for (var mpY = 0; mpY < 16; mpY++) px(8, mpY, [62, 74, 86]);
    for (var mpX = 0; mpX < 16; mpX++) px(mpX, 8, [62, 74, 86]);
    for (var bv = 0; bv < 16; bv++) {
      px(bv, 0, [112, 130, 146]); px(0, bv, [112, 130, 146]);
      px(bv, 15, [40, 50, 60]); px(15, bv, [40, 50, 60]);
    }
    screw(1, 1); screw(14, 1); screw(1, 14); screw(14, 14);
    screw(8, 1); screw(8, 14); screw(1, 8); screw(14, 8);

    /* 警示面板：深色金属 + 橙色斜纹 + 暗边 + 螺钉 */
    at('metal_panel');
    _fillRect('#3A4650');
    for (var wY2 = 0; wY2 < 16; wY2++) for (var wX3 = 0; wX3 < 16; wX3++) {
      var m = (wX3 + wY2) % 8;
      if (m < 3) px(wX3, wY2, [255, 160, 60]);
      else if (m === 3) px(wX3, wY2, [200, 110, 30]);
    }
    _noise(['#33404A', '#42505C'], 0.12);
    screw(1, 1); screw(14, 1); screw(1, 14); screw(14, 14);
    border('metal_panel', [30, 36, 42]);

    /* 格栅：金属编织 + 横向暗槽 + 青色发光唇边 */
    at('tech_grate');
    _fillRect('#2A323C');
    _dither('#2A323C', [37, 45, 55, 70]);
    var slits = [2, 6, 10, 14];
    for (var sl = 0; sl < slits.length; sl++) {
      var sR0 = slits[sl];
      for (var tX = 0; tX < 16; tX++) {
        px(tX, sR0 + 1, [10, 14, 20]);
        px(tX, sR0, [70, 224, 255]);
        if (tX % 4 === 3) px(tX, sR0, [20, 40, 52]);
      }
    }
    border('tech_grate', [18, 24, 30]);

    /* 发光面板：青白 + 中心辉光 + 暗青边框（自发光 0.9） */
    at('glow_panel');
    _fillRect('#A8E8F8');
    _blob('#E8FFFF', 8, 8, 5);
    _blob('#FFFFFF', 8, 8, 2);
    for (var gpX = 0; gpX < 16; gpX++) px(gpX, 8, [46, 122, 150, 120]);
    border('glow_panel', '#2E7A96');
    px(1, 1, [255, 255, 255]); px(14, 1, [255, 255, 255]);
    px(1, 14, [255, 255, 255]); px(14, 14, [255, 255, 255]);

    /* 白色装甲：干净白 + 浅灰接缝 + 铆钉 */
    at('hull_white');
    _fillRect('#E8ECEF');
    for (var hY = 0; hY < 16; hY++) px(8, hY, [176, 186, 194]);
    for (var hX = 0; hX < 16; hX++) px(hX, 8, [176, 186, 194]);
    for (var hB = 0; hB < 16; hB++) {
      px(hB, 0, [255, 255, 255]); px(0, hB, [255, 255, 255]);
      px(hB, 15, [200, 208, 214]); px(15, hB, [200, 208, 214]);
    }
    screw(3, 3); screw(12, 3); screw(3, 12); screw(12, 12);
    border('hull_white', [150, 160, 168]);

    /* 方碑：深色石面 + 青色发光外星刻纹（自发光 0.35） */
    at('monolith');
    _fillRect('#2A2536');
    _noise(['#221E2E', '#322C42', '#3A3350'], 0.3);
    var glow = [106, 232, 255];
    _line(7, 1, 7, 14, glow);
    _line(1, 7, 14, 7, glow);
    px(7, 3, glow); px(6, 4, glow); px(8, 4, glow);
    px(5, 5, glow); px(9, 5, glow); px(4, 6, glow); px(10, 6, glow);
    px(7, 11, glow); px(6, 10, glow); px(8, 10, glow);
    px(5, 9, glow); px(9, 9, glow);
    _blob([106, 232, 255, 60], 7, 7, 3);
    for (var mI = 0; mI < 10; mI++) {
      px(1 + Math.floor(_rng() * 14), 1 + Math.floor(_rng() * 14), [122, 90, 200, 90]);
    }
    border('monolith', '#1A1624');

    /* 黑曜石：深紫黑 + 玻璃光泽斜线 */
    at('obsidian');
    _fillRect('#241A2E');
    _noise(['#170F1E', '#2E2238', '#3A2C4A'], 0.35);
    _line(0, 12, 9, 2, [74, 53, 96, 160]);
    _line(10, 14, 15, 8, [74, 53, 96, 120]);
    border('obsidian', '#120C18');

    /* 岩浆：暗岩 + 白热裂缝（自发光 1.0） */
    at('magma');
    _fillRect('#3A2A20');
    _noise(['#2E2018', '#4A3628'], 0.3);
    lavaPath(0, 5, 15, 12);
    lavaPath(2, 14, 13, 2);
    lavaPath(7, 0, 11, 15);

    /* 碳块：近黑石墨 + 光泽 */
    at('carbon_block');
    _fillRect('#2E2E2E');
    _noise(['#1E1E1E', '#3A3A3A', '#464646', '#202020'], 0.4);
    _line(0, 2, 15, 9, [70, 70, 70, 90]);
    border('carbon_block', '#141414');

    /* 钠块：亮黄晶体刻面 + 亮核（自发光 0.8） */
    at('sodium_block');
    _fillRect('#FFE24A');
    for (var sdY = 0; sdY < 16; sdY++) for (var sdX = 0; sdX < 16; sdX++) {
      if ((sdX + sdY) % 5 === 0) px(sdX, sdY, [212, 164, 23, 160]);
    }
    _blob('#FFF9A8', 8, 8, 3);
    for (var sdI = 0; sdI < 10; sdI++) {
      px(1 + Math.floor(_rng() * 14), 1 + Math.floor(_rng() * 14), [255, 252, 220]);
    }
    border('sodium_block', '#D4A417');

    /* 发射台：黄黑警示斜条 + 中心 H 标记 */
    at('launch_pad');
    _fillRect('#1E2228');
    for (var lpY = 0; lpY < 16; lpY++) for (var lpX = 0; lpX < 16; lpX++) {
      var lm = (lpX + lpY) % 8;
      if (lm < 3) px(lpX, lpY, [255, 210, 60]);
      else if (lm === 3) px(lpX, lpY, [180, 130, 20]);
    }
    var hc = [232, 240, 248];
    for (var hY2 = 5; hY2 <= 10; hY2++) {
      px(5, hY2, hc); px(6, hY2, hc); px(9, hY2, hc); px(10, hY2, hc);
    }
    for (var hX2 = 5; hX2 <= 10; hX2++) { px(hX2, 7, hc); px(hX2, 8, hc); }
    for (hY2 = 4; hY2 <= 11; hY2++) { px(4, hY2, [40, 46, 54]); px(11, hY2, [40, 46, 54]); }
    for (hX2 = 4; hX2 <= 11; hX2++) { px(hX2, 4, [40, 46, 54]); px(hX2, 11, [40, 46, 54]); }
    screw(1, 1); screw(14, 1); screw(1, 14); screw(14, 14);
    border('launch_pad', [16, 18, 22]);

    /* 霜石：冷灰石 + 冰蓝斑块 + 霜白高光 */
    at('frost_stone');
    _fillRect('#7A8288');
    _noise(['#6A7278', '#8A9298'], 0.3);
    for (var frI = 0; frI < 6; frI++) {
      _blob([154, 192, 232], 1 + Math.floor(_rng() * 14), 1 + Math.floor(_rng() * 14), 1.6);
    }
    for (var frJ = 0; frJ < 8; frJ++) {
      px(1 + Math.floor(_rng() * 14), 1 + Math.floor(_rng() * 14), [216, 236, 255, 200]);
    }
    border('frost_stone', [60, 66, 72]);

    /* 红沙（异星） */
    at('red_sand');
    _fillRect('#C96A3E');
    _noise(['#B85A30', '#A84E28', '#D97C52', '#E8936A'], 0.32);
    border('red_sand', [0, 0, 0, 40]);

    /* 毒液：毒绿半透明 + 气泡孔（暗环亮心）+ 波状暗带（自发光 0.4） */
    at('toxic_sludge');
    _fillRect([122, 184, 46, 205]);
    _noise(['#5E9420', '#A8E858', '#8ED03C'], 0.25);
    var bubbles = [[3, 4], [10, 6], [6, 11], [13, 12], [2, 13]];
    for (var bb = 0; bb < bubbles.length; bb++) {
      var bX = bubbles[bb][0], bY = bubbles[bb][1];
      px(bX, bY, [70, 100, 26, 235]); px(bX, bY + 1, [70, 100, 26, 235]);
      px(bX + 1, bY, [70, 100, 26, 235]); px(bX + 1, bY + 1, [70, 100, 26, 235]);
      px(bX, bY, [200, 248, 120, 220]);
    }
    for (var tX2 = 0; tX2 < 16; tX2++) {
      if (tX2 % 2 === 0) { px(tX2, 4, [78, 124, 32, 180]); px(tX2, 10, [78, 124, 32, 180]); }
    }
    for (var tI = 0; tI < 8; tI++) {
      px(1 + Math.floor(_rng() * 14), 1 + Math.floor(_rng() * 14), [180, 240, 110, 200]);
    }
    border('toxic_sludge', [70, 110, 30, 150]);

    /* 星灯球：暗底 + 发光黄球 + 白核 + 光晕（自发光 0.8） */
    at('star_bulb');
    _fillRect('#16202A');
    _line(4, 8, 4, 15, [46, 122, 74]);
    _line(11, 5, 11, 15, [46, 122, 74]);
    _blob([255, 232, 96, 70], 4, 6, 3);
    _blob([255, 232, 96, 70], 11, 3, 3);
    _blob([255, 232, 96], 4, 6, 2);
    _blob([255, 255, 208], 4, 6, 1);
    _blob([255, 232, 96], 11, 3, 2);
    _blob([255, 255, 208], 11, 3, 1);
    for (var sbI = 0; sbI < 6; sbI++) {
      px(1 + Math.floor(_rng() * 14), 1 + Math.floor(_rng() * 14), [255, 244, 170, 200]);
    }

    /* 盐块：白色晶体刻面 */
    at('salt_block');
    _fillRect('#F0F2F5');
    _line(2, 13, 13, 6, [208, 218, 228]);
    _line(6, 1, 13, 5, [255, 255, 255]);
    _noise(['#E0E6EC', '#D2DAE4', '#FFFFFF'], 0.2);
    for (var sB2 = 0; sB2 < 6; sB2++) {
      px(1 + Math.floor(_rng() * 14), 1 + Math.floor(_rng() * 14), [255, 255, 255, 230]);
    }
    border('salt_block', [190, 200, 210]);

    /* 灰烬 */
    at('ash_block');
    _fillRect('#6E6E6E');
    _noise(['#5E5E5E', '#4E4E4E', '#7A7A7A', '#888888'], 0.4);
    border('ash_block', [0, 0, 0, 50]);

    /* 珊瑚块：亮粉 + 管孔（深孔亮心）+ 高光（自发光 0.3） */
    at('coral_block');
    _fillRect('#FF6E9C');
    _noise(['#E85888', '#FF8AB0', '#F06090'], 0.35);
    var tubes = [[3, 4], [11, 3], [7, 10], [13, 11], [5, 13]];
    for (var tb = 0; tb < tubes.length; tb++) {
      _blob([184, 70, 110], tubes[tb][0], tubes[tb][1], 1.5);
      _blob([255, 208, 226], tubes[tb][0], tubes[tb][1], 0.7);
    }
    for (var cbI = 0; cbI < 8; cbI++) {
      px(1 + Math.floor(_rng() * 14), 1 + Math.floor(_rng() * 14), [255, 190, 214]);
    }
    border('coral_block', [180, 60, 100]);

    /* 异星沙（青紫） */
    at('alien_sand');
    _fillRect('#A08AD0');
    _noise(['#B8A4E0', '#8872B8', '#76609E', '#C4B2E8'], 0.32);
    border('alien_sand', [0, 0, 0, 40]);
  }

  /* ----------------------------------------------------------------
   * build()：幂等 —— 第一次生成并缓存 atlas
   * ---------------------------------------------------------------- */
  function build() {
    if (_atlas) return _atlas;

    var canvas = document.createElement('canvas');   // 唯一的 atlas 画布（惰性创建）
    canvas.width = SIZE;
    canvas.height = SIZE;
    var ctx = canvas.getContext('2d');
    var img = ctx.createImageData(SIZE, SIZE);
    _d = img.data;
    _rng = makeRng(0x5EED);      // 固定种子 -> 每次结果完全一致
    paintAll();
    ctx.putImageData(img, 0, 0); // 一次性写入
    _d = null; _rng = null;

    var index = {};
    for (var i = 0; i < TILE_NAMES.length; i++) index[TILE_NAMES[i]] = i;

    _atlas = {
      canvas: canvas,
      tileSize: TS,
      cols: COLS,
      rows: ROWS,
      index: index,
      name: function (i) { return TILE_NAMES[i]; },
      uv: function (name) {
        var idx = index[name];
        var col = idx % COLS, row = Math.floor(idx / COLS);
        return [col / COLS, row / ROWS, (col + 1) / COLS, (row + 1) / ROWS];
      }
    };
    return _atlas;
  }

  /* ----------------------------------------------------------------
   * icon(tileName, scale)：NEAREST 放大裁图 -> dataURL(PNG)，带缓存
   * ---------------------------------------------------------------- */
  function icon(name, scale) {
    scale = scale || 4;
    var key = name + '@' + scale;
    if (_iconCache[key]) return _iconCache[key];
    var atlas = build();
    var cv = document.createElement('canvas');
    cv.width = TS * scale;
    cv.height = TS * scale;
    var ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    var idx = atlas.index[name];
    var sx = (idx % COLS) * TS, sy = Math.floor(idx / COLS) * TS;
    ctx.drawImage(atlas.canvas, sx, sy, TS, TS, 0, 0, TS * scale, TS * scale);
    var url = cv.toDataURL('image/png');
    _iconCache[key] = url;
    return url;
  }

  /* ----------------------------------------------------------------
   * avgColor(tileName) -> [r,g,b]（0..1），渲染端做粒子/远景色
   * ---------------------------------------------------------------- */
  function avgColor(name) {
    if (_avgCache[name]) return _avgCache[name];
    var atlas = build();
    var idx = atlas.index[name];
    var sx = (idx % COLS) * TS, sy = Math.floor(idx / COLS) * TS;
    var ctx = atlas.canvas.getContext('2d');
    var d = ctx.getImageData(sx, sy, TS, TS).data;
    var r = 0, g = 0, b = 0, n = 0;
    for (var i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 10) continue;   // 跳过近透明像素
      r += d[i]; g += d[i + 1]; b += d[i + 2]; n++;
    }
    n = n || 1;
    var out = [r / n / 255, g / n / 255, b / n / 255];
    _avgCache[name] = out;
    return out;
  }

  /* ----------------------------------------------------------------
   * debugSheet()：全部 tile 放大 4 倍 + 名称标签（美术自检截图用）
   * ---------------------------------------------------------------- */
  function debugSheet() {
    if (_debugCache) return _debugCache;
    var atlas = build();
    var cell = 64 + 12;
    var cv = document.createElement('canvas');
    cv.width = COLS * 64;
    cv.height = Math.ceil(TILE_NAMES.length / COLS) * cell;
    var ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#1a1a22';
    ctx.fillRect(0, 0, cv.width, cv.height);
    for (var i = 0; i < TILE_NAMES.length; i++) {
      var cx = (i % COLS) * 64, cy = Math.floor(i / COLS) * cell;
      var sx = (i % COLS) * TS, sy = Math.floor(i / COLS) * TS;
      ctx.drawImage(atlas.canvas, sx, sy, TS, TS, cx, cy, 64, 64);
      ctx.fillStyle = '#c8d8e8';
      ctx.font = '8px monospace';
      ctx.fillText(TILE_NAMES[i], cx, cy + 64 + 9);
    }
    _debugCache = cv;
    return cv;
  }

  /* ----------------------------------------------------------------
   * crackTextures()：MC 式挖掘裂纹，10 级逐级加深。
   * 返回 10 个 16×16 canvas（透明底 + 黑色裂纹）数组 ——
   * 渲染端可直接 DSC.GL.texFromCanvas 上传叠加；如需 dataURL 自行
   * cv.toDataURL('image/png')。每级用独立固定 seed，确定性。
   * ---------------------------------------------------------------- */
  function crackTextures() {
    if (_crackCache) return _crackCache;
    var out = [];
    for (var stage = 0; stage < 10; stage++) {
      var cv = document.createElement('canvas');
      cv.width = TS; cv.height = TS;
      var ctx = cv.getContext('2d');
      var img = ctx.createImageData(TS, TS);
      var d = img.data;
      var rng = makeRng(0xC0FFEE + stage * 7919);
      var cracks = 2 + Math.floor(rng() * 3);
      for (var c = 0; c < cracks; c++) {
        var edge = Math.floor(rng() * 4);
        var x, y, dir;
        if (edge === 0) { x = Math.floor(rng() * 16); y = 0; dir = Math.PI / 2 + (rng() - 0.5) * 1.6; }
        else if (edge === 1) { x = 15; y = Math.floor(rng() * 16); dir = Math.PI + (rng() - 0.5) * 1.6; }
        else if (edge === 2) { x = Math.floor(rng() * 16); y = 15; dir = -Math.PI / 2 + (rng() - 0.5) * 1.6; }
        else { x = 0; y = Math.floor(rng() * 16); dir = (rng() - 0.5) * 1.6; }
        var len = 4 + stage * 1.2 + rng() * 4;
        var w = stage > 6 ? 2 : 1;
        for (var t = 0; t < len; t++) {
          for (var dy = 0; dy < w; dy++) for (var dx = 0; dx < w; dx++) {
            var qx = Math.round(x) + dx, qy = Math.round(y) + dy;
            if (qx >= 0 && qx < 16 && qy >= 0 && qy < 16) {
              var p = (qy * TS + qx) * 4;
              d[p] = 10; d[p + 1] = 10; d[p + 2] = 14; d[p + 3] = 235;
            }
          }
          x += Math.cos(dir) + (rng() - 0.5) * 0.8;
          y += Math.sin(dir) + (rng() - 0.5) * 0.8;
          if (rng() < 0.08) dir += (rng() - 0.5) * 1.2;   // 随机转向（分叉感）
        }
      }
      ctx.putImageData(img, 0, 0);
      out.push(cv);
    }
    _crackCache = out;
    return out;
  }

  /* ---------------------------------------------------------------- 导出 */
  DSC.Textures = {
    TILE_NAMES: TILE_NAMES,
    build: build,
    icon: icon,
    avgColor: avgColor,
    debugSheet: debugSheet,
    crackTextures: crackTextures
  };
})();
