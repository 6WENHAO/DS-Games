/*!
 * src/gl/resources.js — 滤镜共享资源：有序抖动矩阵、噪声、字形图集、调色板
 */
(function (global) {
  'use strict';
  var D = global.DSV4P || (global.DSV4P = {});
  var R = {};

  /* ------------------------------------------------------------------ *
   * Bayer 有序抖动矩阵（递归构造，n 必须是 2 的幂）
   *   M(2n) = [ 4M(n)+0  4M(n)+2 ]
   *           [ 4M(n)+3  4M(n)+1 ]
   * ------------------------------------------------------------------ */
  R.bayerMatrix = function (n) {
    if (n === 1) return [[0]];
    var half = R.bayerMatrix(n >> 1);
    var m = [];
    var h = n >> 1;
    for (var y = 0; y < n; y++) m.push(new Array(n));
    for (var yy = 0; yy < h; yy++) {
      for (var xx = 0; xx < h; xx++) {
        var v = half[yy][xx] * 4;
        m[yy][xx] = v + 0;
        m[yy][xx + h] = v + 2;
        m[yy + h][xx] = v + 3;
        m[yy + h][xx + h] = v + 1;
      }
    }
    return m;
  };

  /** 8x8 Bayer -> RGBA Uint8Array（阈值放在 r/g/b/a 四个通道，方便着色器随取） */
  R.bayerBytes = function (n) {
    n = n || 8;
    var m = R.bayerMatrix(n);
    var total = n * n;
    var out = new Uint8Array(total * 4);
    for (var y = 0; y < n; y++) {
      for (var x = 0; x < n; x++) {
        // +0.5 让阈值落在格子中心，避免 0 值导致的死区
        var v = Math.round(((m[y][x] + 0.5) / total) * 255);
        var i = (y * n + x) * 4;
        out[i] = v; out[i + 1] = v; out[i + 2] = v; out[i + 3] = 255;
      }
    }
    return out;
  };

  /* ------------------------------------------------------------------ *
   * 可复现白噪声（固定种子，保证同一帧渲染两次结果一致）
   * ------------------------------------------------------------------ */
  R.mulberry32 = function (seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  R.noiseBytes = function (size, seed) {
    size = size || 64;
    var rnd = R.mulberry32(seed == null ? 0x51ED27 : seed);
    var out = new Uint8Array(size * size * 4);
    for (var i = 0; i < out.length; i++) out[i] = (rnd() * 256) | 0;
    return out;
  };

  /* ------------------------------------------------------------------ *
   * 调色板（最多 32 色；用于像素风/复古机型模拟）
   * ------------------------------------------------------------------ */
  R.palettes = [
    { id: 'none', name: '不限制（原色）', colors: null },
    { id: 'mono', name: '黑白 1-bit', colors: ['#000000', '#ffffff'] },
    { id: 'mono-ink', name: '墨蓝 1-bit', colors: ['#10131c', '#e8eef7'] },
    { id: 'gb-dmg', name: 'Game Boy DMG', colors: ['#0f380f', '#306230', '#8bac0f', '#9bbc0f'] },
    { id: 'gb-pocket', name: 'GB Pocket 灰阶', colors: ['#181818', '#4a4a4a', '#8c8c8c', '#e0e0e0'] },
    { id: 'pico8', name: 'PICO-8 (16)', colors: ['#000000', '#1d2b53', '#7e2553', '#008751', '#ab5236', '#5f574f', '#c2c3c7', '#fff1e8', '#ff004d', '#ffa300', '#ffec27', '#00e436', '#29adff', '#83769c', '#ff77a8', '#ffccaa'] },
    { id: 'nes', name: 'NES 常用 (16)', colors: ['#000000', '#fcfcfc', '#f8f8f8', '#bcbcbc', '#7c7c7c', '#a4e4fc', '#3cbcfc', '#0078f8', '#0000fc', '#b8b8f8', '#6888fc', '#0058f8', '#f8b8f8', '#f878f8', '#e40058', '#f83800'] },
    { id: 'c64', name: 'Commodore 64', colors: ['#000000', '#ffffff', '#880000', '#aaffee', '#cc44cc', '#00cc55', '#0000aa', '#eeee77', '#dd8855', '#664400', '#ff7777', '#333333', '#777777', '#aaff66', '#0088ff', '#bbbbbb'] },
    { id: 'cga', name: 'CGA 16 色', colors: ['#000000', '#0000aa', '#00aa00', '#00aaaa', '#aa0000', '#aa00aa', '#aa5500', '#aaaaaa', '#555555', '#5555ff', '#55ff55', '#55ffff', '#ff5555', '#ff55ff', '#ffff55', '#ffffff'] },
    { id: 'zx', name: 'ZX Spectrum', colors: ['#000000', '#0000d7', '#d70000', '#d700d7', '#00d700', '#00d7d7', '#d7d700', '#d7d7d7', '#0000ff', '#ff0000', '#ff00ff', '#00ff00', '#00ffff', '#ffff00', '#ffffff'] },
    { id: 'teletext', name: '图文电视 8 色', colors: ['#000000', '#ff0000', '#00ff00', '#ffff00', '#0000ff', '#ff00ff', '#00ffff', '#ffffff'] },
    { id: 'amber', name: '琥珀单色终端', colors: ['#160c00', '#3d2200', '#8a4f00', '#d98a00', '#ffc04d'] },
    { id: 'green-crt', name: '绿色单色终端', colors: ['#001100', '#00330f', '#00661f', '#33cc33', '#b3ffb3'] },
    { id: 'sepia', name: '棕褐 6 阶', colors: ['#1b1109', '#3a2617', '#6b4527', '#9c6b3f', '#c8a06a', '#f0dcbb'] },
    { id: 'gruvbox', name: 'Gruvbox 16', colors: ['#282828', '#cc241d', '#98971a', '#d79921', '#458588', '#b16286', '#689d6a', '#a89984', '#928374', '#fb4934', '#b8bb26', '#fabd2f', '#83a598', '#d3869b', '#8ec07c', '#ebdbb2'] },
    { id: 'vaporwave', name: '蒸汽波 8', colors: ['#1a0033', '#3d1a6e', '#7b2ff7', '#f72585', '#ff7ad9', '#4cc9f0', '#b8f2ff', '#fff5f7'] },
    { id: 'custom', name: '自定义…', colors: ['#000000', '#ffffff'] }
  ];

  R.paletteById = function (id) {
    for (var i = 0; i < R.palettes.length; i++) if (R.palettes[i].id === id) return R.palettes[i];
    return R.palettes[0];
  };

  /** 调色板 -> Float32Array(32*3)；不足部分重复最后一色 */
  R.paletteFloats = function (colors) {
    var out = new Float32Array(32 * 3);
    var n = Math.min(32, (colors && colors.length) || 0);
    var last = [0, 0, 0];
    for (var i = 0; i < n; i++) {
      var c = D.util.hexToRgb(colors[i]);
      out[i * 3] = c[0]; out[i * 3 + 1] = c[1]; out[i * 3 + 2] = c[2];
      last = c;
    }
    for (var j = n; j < 32; j++) {
      out[j * 3] = last[0]; out[j * 3 + 1] = last[1]; out[j * 3 + 2] = last[2];
    }
    return { data: out, count: Math.max(1, n) };
  };

  /* ------------------------------------------------------------------ *
   * 字形图集（ASCII 艺术滤镜用）
   * 做法：把候选字符逐个画进小画布，按「墨量」排序，再横向排成一行图集。
   * 这样不依赖具体字体度量，换字体也能自动工作。
   * ------------------------------------------------------------------ */
  R.RAMPS = {
    ascii: ' .,:;i1tfLCG08@',
    blocks: ' \u2591\u2592\u2593\u2588',
    dots: ' \u2802\u2806\u2807\u2827\u2837\u283F\u287F\u28FF',
    digits: ' .-+*0123456789',
    kana: ' \u30fb\u30a2\u30ab\u30b5\u30bf\u30ca\u30cf\u30de\u30e4\u30e9\u30ef\u30f2\u30f3',
    hanzi: ' \u4e00\u4e8c\u5341\u571f\u672c\u76ee\u7530\u7c73\u76e3\u9f8e'
  };

  /**
   * 生成字形图集
   * @param {string} chars 候选字符
   * @param {number} cell 单元像素（建议 16 或 24）
   * @param {string} font CSS 字体族
   * @returns {{canvas:HTMLCanvasElement, count:number, order:string, cell:number}}
   */
  R.buildGlyphAtlas = function (chars, cell, font) {
    cell = cell || 16;
    font = font || 'ui-monospace, "DejaVu Sans Mono", Consolas, monospace';
    var list = String(chars || R.RAMPS.ascii).split('');
    var probe = document.createElement('canvas');
    probe.width = cell; probe.height = cell;
    var pctx = probe.getContext('2d', { willReadFrequently: true });
    var scored = [];
    for (var i = 0; i < list.length; i++) {
      pctx.clearRect(0, 0, cell, cell);
      pctx.fillStyle = '#000';
      pctx.fillRect(0, 0, cell, cell);
      pctx.fillStyle = '#fff';
      pctx.font = Math.round(cell * 0.92) + 'px ' + font;
      pctx.textAlign = 'center';
      pctx.textBaseline = 'middle';
      pctx.fillText(list[i], cell / 2, cell / 2 + cell * 0.04);
      var d = pctx.getImageData(0, 0, cell, cell).data;
      var sum = 0;
      for (var p = 0; p < d.length; p += 4) sum += d[p];
      scored.push({ ch: list[i], ink: sum / (cell * cell * 255) });
    }
    scored.sort(function (a, b) { return a.ink - b.ink; });

    var count = scored.length;
    var cv = document.createElement('canvas');
    cv.width = cell * count;
    cv.height = cell;
    var ctx = cv.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = '#fff';
    ctx.font = Math.round(cell * 0.92) + 'px ' + font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (var k = 0; k < count; k++) {
      ctx.fillText(scored[k].ch, k * cell + cell / 2, cell / 2 + cell * 0.04);
    }
    return {
      canvas: cv, count: count, cell: cell,
      order: scored.map(function (s) { return s.ch; }).join('')
    };
  };

  D.Resources = R;
  if (typeof module !== 'undefined' && module.exports) module.exports = R;
})(typeof window !== 'undefined' ? window : globalThis);
