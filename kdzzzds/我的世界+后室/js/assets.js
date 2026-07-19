/* ============================================================
 * BLOCKROOMS - assets.js
 * 所有美术素材均为程序化生成的 SVG（像素风，32x32 无缝贴图）
 * ============================================================ */
(function () {
  'use strict';
  const A = {};
  window.BRAssets = A;

  /* ---------------- 确定性哈希 / 无缝噪声 ---------------- */
  function h2(x, y, s) {
    let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 144269504)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function lerp(a, b, t) { return a + (b - a) * t; }
  // 无缝值噪声：x,y ∈ [0,1)，cells 为晶格数（周期），保证四边可平铺
  function noiseW(x, y, cells, seed) {
    const gx = x * cells, gy = y * cells;
    const x0 = Math.floor(gx), y0 = Math.floor(gy);
    const fx = gx - x0, fy = gy - y0;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const g = (ix, iy) => h2(((ix % cells) + cells) % cells, ((iy % cells) + cells) % cells, seed);
    return lerp(lerp(g(x0, y0), g(x0 + 1, y0), sx), lerp(g(x0, y0 + 1), g(x0 + 1, y0 + 1), sx), sy);
  }
  function fbm(x, y, seed) {
    return noiseW(x, y, 4, seed) * 0.55 + noiseW(x, y, 8, seed + 7) * 0.3 + noiseW(x, y, 16, seed + 13) * 0.15;
  }

  /* ---------------- 颜色工具 ---------------- */
  function hex2rgb(h) {
    h = h.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16)];
  }
  function rgb2hex(r, g, b) {
    const c = v => ('0' + Math.max(0, Math.min(255, Math.round(v))).toString(16)).slice(-2);
    return '#' + c(r) + c(g) + c(b);
  }
  function shade(hex, f) { const [r, g, b] = hex2rgb(hex); return rgb2hex(r * f, g * f, b * f); }
  function mix(a, b, t) {
    const A_ = hex2rgb(a), B_ = hex2rgb(b);
    return rgb2hex(lerp(A_[0], B_[0], t), lerp(A_[1], B_[1], t), lerp(A_[2], B_[2], t));
  }
  A.mix = mix; A.shade = shade;

  /* ---------------- 像素网格 -> SVG ---------------- */
  function Grid(w, h) {
    this.w = w; this.h = h;
    this.d = new Array(w * h).fill(null); // {c:'#hex', a:alpha}
  }
  Grid.prototype.px = function (x, y, c, a) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.d[y * this.w + x] = c === null ? null : { c: c, a: (a === undefined ? 1 : a) };
  };
  Grid.prototype.get = function (x, y) { return this.d[y * this.w + x]; };
  Grid.prototype.fill = function (c, a) { for (let i = 0; i < this.d.length; i++) this.d[i] = { c: c, a: (a === undefined ? 1 : a) }; };
  Grid.prototype.rect = function (x, y, w, h, c, a) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.px(i, j, c, a);
  };
  Grid.prototype.line = function (x0, y0, x1, y1, c, a) {
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx - dy, x = x0, y = y0;
    for (; ;) {
      this.px(x, y, c, a);
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x += sx; }
      if (e2 < dx) { err += dx; y += sy; }
    }
  };
  // 合并同色横向连续像素，输出紧凑 SVG
  Grid.prototype.toSVG = function () {
    let out = '<svg xmlns="http://www.w3.org/2000/svg" width="' + this.w + '" height="' + this.h +
      '" viewBox="0 0 ' + this.w + ' ' + this.h + '" shape-rendering="crispEdges">';
    for (let y = 0; y < this.h; y++) {
      let x = 0;
      while (x < this.w) {
        const p = this.get(x, y);
        if (!p) { x++; continue; }
        let x2 = x + 1;
        while (x2 < this.w) {
          const q = this.get(x2, y);
          if (!q || q.c !== p.c || q.a !== p.a) break;
          x2++;
        }
        out += '<rect x="' + x + '" y="' + y + '" width="' + (x2 - x) + '" height="1" fill="' + p.c + '"' +
          (p.a < 1 ? ' fill-opacity="' + p.a.toFixed(2) + '"' : '') + '/>';
        x = x2;
      }
    }
    return out + '</svg>';
  };
  A.Grid = Grid;

  /* ================= 方块贴图（32x32，无缝） ================= */
  const T = 32;
  const TILES = {};

  function baseNoiseFill(g, c0, c1, seed, amp) {
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const n = fbm(x / T, y / T, seed);
      g.px(x, y, mix(c0, c1, Math.min(1, Math.max(0, (n - 0.5) * (amp || 2) + 0.5))));
    }
  }

  /* ---- Level 0：黄色壁纸（含条纹，横向周期 16 -> 无缝） ---- */
  function wallpaperBase(g, seed, dark) {
    const base0 = dark ? '#b2a057' : '#c8b665', base1 = dark ? '#c0ae60' : '#d6c576';
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const n = fbm(x / T, y / T, seed);
      let c = mix(base0, base1, n);
      const sx = x % 16;
      if (sx >= 6 && sx <= 9) c = shade(c, 0.86);          // 主条纹
      if (sx === 6 || sx === 9) c = shade(c, 0.93);        // 条纹柔边
      if (sx === 13) c = shade(c, 0.95);                   // 细条纹
      if (h2(x, y, seed + 55) < 0.05) c = shade(c, 0.9);   // 颗粒
      g.px(x, y, c);
    }
  }
  TILES.wallpaper0 = () => { const g = new Grid(T, T); wallpaperBase(g, 11, false); return g; };
  TILES.wallpaper1 = () => {
    const g = new Grid(T, T); wallpaperBase(g, 23, false);
    // 潮湿污渍
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const d = noiseW(x / T, y / T, 4, 91);
      if (d > 0.62) g.px(x, y, mix(g.get(x, y).c, '#7a6b34', (d - 0.62) * 2.0));
    }
    return g;
  };
  TILES.wallpaper2 = () => {
    const g = new Grid(T, T); wallpaperBase(g, 37, true);
    for (let x = 0; x < T; x++) { // 底部踢脚磨损
      const wear = 27 + Math.floor(h2(x, 0, 71) * 4);
      for (let y = wear; y < T; y++) g.px(x, y, shade(g.get(x, y).c, 0.8));
    }
    return g;
  };
  /* ---- 破墙露木（打出旧木头的墙） ---- */
  TILES.stud = () => {
    const g = new Grid(T, T); wallpaperBase(g, 45, false);
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const cx = (x - 16) / 12, cy = (y - 16) / 13;
      const r = cx * cx + cy * cy + (noiseW(x / T, y / T, 8, 99) - 0.5) * 0.9;
      if (r < 0.55) { // 破洞：露出竖直木条
        const plank = Math.floor(x / 6);
        let wc = mix('#5a4527', '#6e5836', noiseW(x / T, y / T, 16, 101));
        if (x % 6 === 0) wc = shade(wc, 0.72);
        if (h2(x, y, 103) < 0.12) wc = shade(wc, 0.85 + 0.25 * h2(y, x, plank));
        g.px(x, y, wc);
      } else if (r < 0.72) {
        g.px(x, y, mix(g.get(x, y).c, '#efe4b8', 0.5)); // 撕裂纸边
      }
    }
    return g;
  };
  /* ---- 地毯 ---- */
  function carpet(seed, wet) {
    const g = new Grid(T, T);
    const c0 = wet ? '#5e5530' : '#8b7d46', c1 = wet ? '#6e6438' : '#a3934f';
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const n = noiseW(x / T, y / T, 16, seed) * 0.6 + noiseW(x / T, y / T, 8, seed + 3) * 0.4;
      let c = mix(c0, c1, n);
      const r = h2(x, y, seed + 9);
      if (r < 0.08) c = shade(c, 0.82);
      else if (r > 0.94) c = shade(c, 1.14);
      g.px(x, y, c);
    }
    return g;
  }
  TILES.carpet0 = () => carpet(201, false);
  TILES.carpet1 = () => carpet(207, true);
  /* ---- 吊顶板 / 荧光灯 ---- */
  TILES.ceiling = () => {
    const g = new Grid(T, T);
    baseNoiseFill(g, '#cfcab7', '#dbd6c5', 301, 1.4);
    for (let i = 0; i < T; i++) { g.px(i, 0, '#a8a28c'); g.px(0, i, '#a8a28c'); g.px(i, 1, '#bab48f', 0.6); g.px(1, i, '#bab48f', 0.6); }
    for (let y = 2; y < T; y += 1) for (let x = 2; x < T; x += 1)
      if (h2(x, y, 307) < 0.045) g.px(x, y, '#b5af99'); // 吸音孔
    return g;
  };
  TILES.light = () => {
    const g = new Grid(T, T);
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const dx = (x - 15.5) / 16, dy = (y - 15.5) / 16;
      const d = Math.sqrt(dx * dx + dy * dy);
      let c = mix('#fffbe8', '#f4ecc0', Math.min(1, d * 1.15));
      if (y % 4 === 2 && x > 2 && x < 29) c = shade(c, 0.94); // 灯罩格栅
      g.px(x, y, c);
    }
    for (let i = 0; i < T; i++) { g.px(i, 0, '#b8b294'); g.px(i, 31, '#b8b294'); g.px(0, i, '#b8b294'); g.px(31, i, '#b8b294'); }
    g.px(2, 2, '#8f8a70'); g.px(29, 2, '#8f8a70'); g.px(2, 29, '#8f8a70'); g.px(29, 29, '#8f8a70');
    return g;
  };
  /* ---- 霉斑 ---- */
  TILES.mold = () => {
    const g = new Grid(T, T); wallpaperBase(g, 61, true);
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const n = noiseW(x / T, y / T, 6, 401) * 0.7 + noiseW(x / T, y / T, 12, 403) * 0.3;
      if (n > 0.45) g.px(x, y, mix('#1c2415', '#39482a', noiseW(x / T, y / T, 16, 405)));
      else if (n > 0.4) g.px(x, y, mix(g.get(x, y).c, '#2a3320', 0.6));
    }
    return g;
  };
  /* ---- 木头 ---- */
  function planksTile(seed, c0, c1, seamC) {
    const g = new Grid(T, T);
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const row = Math.floor(y / 8);
      const off = (row % 2) * 16;
      let c = mix(c0, c1, noiseW(((x + off) % T) / T, y / T, 16, seed) * 0.7 + 0.15 * ((y % 8) / 8));
      if (y % 8 === 0) c = seamC;
      if (y % 8 === 7) c = shade(c, 1.1);
      if ((x + off) % 16 === 0 && y % 8 !== 0) c = shade(c, 0.75);
      if (h2(x, y, seed + 5) < 0.04) c = shade(c, 0.88);
      g.px(x, y, c);
    }
    return g;
  }
  TILES.old_wood = () => planksTile(501, '#5b4728', '#6f5a37', '#3c2f1a');
  TILES.planks = () => planksTile(521, '#a5834e', '#bd9a5f', '#6e5631');
  TILES.craft_top = () => {
    const g = planksTile(541, '#a5834e', '#bd9a5f', '#6e5631');
    g.rect(0, 0, 32, 2, '#6e5631'); g.rect(0, 30, 32, 2, '#6e5631');
    g.rect(0, 0, 2, 32, '#6e5631'); g.rect(30, 0, 2, 32, '#6e5631');
    g.rect(4, 4, 24, 24, '#8a6c40'); g.rect(6, 6, 20, 20, '#c4a266');
    g.rect(15, 6, 2, 20, '#8a6c40'); g.rect(6, 15, 20, 2, '#8a6c40');
    return g;
  };
  TILES.craft_side = () => {
    const g = planksTile(561, '#a5834e', '#bd9a5f', '#6e5631');
    g.rect(0, 0, 32, 3, '#c4a266'); g.rect(0, 3, 32, 1, '#6e5631');
    // 工具剪影：锯 + 锤
    g.rect(4, 10, 10, 3, '#4a4a4a'); for (let i = 0; i < 5; i++) g.px(4 + i * 2, 13, '#4a4a4a');
    g.rect(20, 8, 3, 12, '#6e5631'); g.rect(18, 6, 7, 4, '#5a5a5a');
    return g;
  };
  /* ---- Level 1：混凝土 ---- */
  function concreteBase(g, seed, c0, c1) {
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      let c = mix(c0, c1, fbm(x / T, y / T, seed));
      if (h2(x, y, seed + 2) < 0.06) c = shade(c, 0.9);
      g.px(x, y, c);
    }
  }
  TILES.concrete = () => {
    const g = new Grid(T, T); concreteBase(g, 601, '#7d7f83', '#90939a');
    let cx = Math.floor(h2(1, 1, 611) * 28) + 2, cy = 0;   // 裂缝
    while (cy < 31) { g.px(cx, cy, '#5a5c60'); cy++; cx += (h2(cx, cy, 613) < 0.5 ? -1 : 1); cx = Math.max(1, Math.min(30, cx)); }
    return g;
  };
  TILES.pillar = () => {
    const g = new Grid(T, T); concreteBase(g, 621, '#74767b', '#888b92');
    for (let x = 0; x < T; x++) for (let y = 0; y < T; y++) {
      if (noiseW(x / T, y / T, 4, 623) > 0.6 && y > 8) g.px(x, y, shade(g.get(x, y).c, 0.85)); // 垂直水渍
    }
    g.rect(0, 0, 32, 1, '#5a5c60'); g.rect(0, 31, 32, 1, '#5a5c60');
    g.rect(0, 0, 1, 32, '#63656a'); g.rect(31, 0, 1, 32, '#63656a');
    return g;
  };
  TILES.floor1 = () => {
    const g = new Grid(T, T); concreteBase(g, 641, '#54555a', '#616267');
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++)
      if (noiseW(x / T, y / T, 4, 643) > 0.68) g.px(x, y, shade(g.get(x, y).c, 0.8)); // 油渍
    return g;
  };
  TILES.floor1b = () => {  // 停车场黄漆线
    const g = TILES.floor1();
    for (let y = 12; y < 20; y++) for (let x = 0; x < T; x++)
      if (h2(x, y, 651) > 0.18) g.px(x, y, mix('#c8a83a', '#b09228', h2(y, x, 653)));
    return g;
  };
  TILES.ceiling1 = () => {
    const g = new Grid(T, T); concreteBase(g, 661, '#3b3c41', '#45464c');
    g.rect(0, 10, 32, 1, '#2c2d31'); g.rect(0, 14, 32, 1, '#2c2d31'); // 电缆桥架
    g.rect(0, 11, 32, 3, '#333438');
    for (let x = 2; x < 32; x += 8) g.rect(x, 9, 1, 7, '#26272b');
    return g;
  };
  TILES.pipe = () => {
    const g = new Grid(T, T); concreteBase(g, 681, '#7d7f83', '#8d9096');
    // 上方金属管
    for (let x = 0; x < T; x++) {
      for (let y = 5; y <= 12; y++) {
        let c = mix('#9aa0a8', '#6f757d', Math.abs(y - 7.5) / 5);
        if (y === 6) c = '#c2c8d0';
        g.px(x, y, c);
      }
      if (x % 8 === 3) { g.rect(x, 4, 2, 10, '#5f656d'); }
      // 下方锈管
      for (let y = 20; y <= 26; y++) {
        let c = mix('#8a6a4f', '#5e4331', Math.abs(y - 22.5) / 4);
        if (y === 21) c = '#a58469';
        g.px(x, y, c);
      }
      if (x % 8 === 7) { g.rect(x, 19, 2, 9, '#4e3a2b'); }
    }
    return g;
  };
  /* ---- 板条箱 ---- */
  TILES.crate_side = () => {
    const g = planksTile(701, '#8a6c40', '#9d7c4b', '#5d4a2c');
    g.rect(0, 0, 32, 3, '#4f4638'); g.rect(0, 29, 32, 3, '#4f4638');
    g.rect(0, 0, 3, 32, '#4f4638'); g.rect(29, 0, 3, 32, '#4f4638');
    g.line(3, 3, 28, 28, '#5d4a2c'); g.line(4, 3, 29, 28, '#6e5836');
    g.line(28, 3, 3, 28, '#5d4a2c'); g.line(27, 3, 2, 28, '#6e5836');
    g.px(1, 1, '#8b939c'); g.px(30, 1, '#8b939c'); g.px(1, 30, '#8b939c'); g.px(30, 30, '#8b939c');
    return g;
  };
  TILES.crate_top = () => {
    const g = planksTile(711, '#8a6c40', '#9d7c4b', '#5d4a2c');
    g.rect(0, 0, 32, 3, '#4f4638'); g.rect(0, 29, 32, 3, '#4f4638');
    g.rect(0, 0, 3, 32, '#4f4638'); g.rect(29, 0, 3, 32, '#4f4638');
    g.rect(14, 3, 4, 26, '#5d4a2c');
    return g;
  };
  /* ---- 出口大门 ---- */
  TILES.exit_bottom = () => {
    const g = new Grid(T, T); concreteBase(g, 721, '#66686d', '#74777d');
    g.rect(2, 0, 28, 32, '#585b60');
    g.rect(4, 0, 24, 32, '#6b6e74');
    g.rect(4, 4, 24, 3, '#c9cdd2'); g.rect(4, 7, 24, 1, '#9ba0a6'); // 推杆
    g.rect(4, 24, 24, 8, '#4c4f54'); // 踢板
    g.rect(2, 0, 1, 32, '#3f4145'); g.rect(29, 0, 1, 32, '#3f4145');
    return g;
  };
  const EXIT_FONT = { // 3x5 小字体
    E: ['111', '100', '111', '100', '111'], X: ['101', '101', '010', '101', '101'],
    I: ['111', '010', '010', '010', '111'], T: ['111', '010', '010', '010', '010']
  };
  function drawText3x5(g, text, ox, oy, c) {
    let x = ox;
    for (const ch of text) {
      const m = EXIT_FONT[ch];
      if (m) for (let r = 0; r < 5; r++) for (let cc = 0; cc < 3; cc++)
        if (m[r][cc] === '1') g.px(x + cc, oy + r, c);
      x += 4;
    }
  }
  TILES.exit_top = () => {
    const g = new Grid(T, T); concreteBase(g, 731, '#66686d', '#74777d');
    g.rect(2, 20, 28, 12, '#6b6e74'); g.rect(2, 20, 1, 12, '#3f4145'); g.rect(29, 20, 1, 12, '#3f4145');
    g.rect(2, 20, 28, 2, '#585b60');
    g.rect(6, 4, 20, 12, '#0b3d20'); g.rect(7, 5, 18, 10, '#0f5c2e');
    g.rect(6, 4, 20, 1, '#1c7d44'); g.rect(6, 15, 20, 1, '#062513');
    drawText3x5(g, 'EXIT', 9, 7, '#b6ffd2');
    g.px(6, 4, '#54d98c'); g.px(25, 4, '#54d98c');
    return g;
  };
  /* ---- 出口指示牌（箭头 N/E/S/W） ---- */
  function signTile(dir) {
    const g = new Grid(T, T); concreteBase(g, 741, '#74767b', '#888b92');
    g.rect(4, 8, 24, 16, '#0b3d20'); g.rect(5, 9, 22, 14, '#0f5c2e');
    g.rect(4, 8, 24, 1, '#1c7d44'); g.rect(4, 23, 24, 1, '#062513');
    const cx = 16, cy = 16, c = '#c8ffe0';
    function arrow(dx, dy) {
      for (let i = -4; i <= 4; i++) {
        g.px(cx + i * dx, cy + i * dy, c);
        g.px(cx + i * dx + dy, cy + i * dy + dx, c);
      }
      for (let s = 1; s <= 3; s++) {
        g.px(cx + (4 - s) * dx + s * dy, cy + (4 - s) * dy + s * dx, c);
        g.px(cx + (4 - s) * dx - s * dy, cy + (4 - s) * dy - s * dx, c);
      }
      g.px(cx + 5 * dx, cy + 5 * dy, c);
    }
    if (dir === 'n') arrow(0, -1);
    else if (dir === 's') arrow(0, 1);
    else if (dir === 'e') arrow(1, 0);
    else arrow(-1, 0);
    return g;
  }
  TILES.sign_n = () => signTile('n');
  TILES.sign_e = () => signTile('e');
  TILES.sign_s = () => signTile('s');
  TILES.sign_w = () => signTile('w');
  /* ---- 灯笼方块（可放置光源） ---- */
  TILES.lamp_side = () => {
    const g = new Grid(T, T);
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const dx = (x - 15.5) / 16, dy = (y - 15.5) / 16;
      const d = Math.sqrt(dx * dx + dy * dy);
      g.px(x, y, mix('#ffe9a8', '#e8b95c', Math.min(1, d * 1.3)));
    }
    g.rect(0, 0, 32, 3, '#5b4728'); g.rect(0, 29, 32, 3, '#5b4728');
    g.rect(0, 0, 3, 32, '#5b4728'); g.rect(29, 0, 3, 32, '#5b4728');
    g.rect(14, 3, 3, 26, '#6e5836'); g.rect(3, 14, 26, 3, '#6e5836');
    return g;
  };
  TILES.lamp_top = () => {
    const g = new Grid(T, T);
    g.fill('#5b4728');
    g.rect(3, 3, 26, 26, '#6e5836');
    g.rect(6, 6, 20, 20, '#ffedb5');
    g.rect(10, 10, 12, 12, '#fff8dd');
    return g;
  };
  /* ---- 故障方块（noclip 点，三帧动画） ---- */
  function glitchFrame(seed) {
    const g = new Grid(T, T);
    g.fill('#050508');
    const colors = ['#39ff14', '#ff00e0', '#00f0ff', '#ffffff', '#8a2be2'];
    for (let y = 0; y < T; y++) {
      const rowShift = h2(y, 0, seed) < 0.2;
      for (let x = 0; x < T; x++) {
        const r = h2(x, y, seed);
        if (rowShift && r < 0.5) g.px(x, y, colors[Math.floor(h2(y, x, seed + 1) * colors.length)], 0.85);
        else if (r < 0.06) g.px(x, y, colors[Math.floor(h2(x + y, x - y, seed + 2) * colors.length)]);
        else if (r < 0.1) g.px(x, y, '#1a1a24');
      }
    }
    return g;
  }
  TILES.glitch0 = () => glitchFrame(801);
  TILES.glitch1 = () => glitchFrame(823);
  TILES.glitch2 = () => glitchFrame(847);
  /* ---- 挖掘裂纹（透明覆盖层） ---- */
  function crackTile(stage) {
    const g = new Grid(T, T);
    const branches = 3 + stage * 3;
    for (let b = 0; b < branches; b++) {
      let x = 16, y = 16;
      const ang = h2(b, stage, 901) * Math.PI * 2;
      let dx = Math.cos(ang), dy = Math.sin(ang);
      const len = 6 + stage * 4 + h2(b, stage, 903) * 6;
      for (let i = 0; i < len; i++) {
        g.px(Math.round(x), Math.round(y), '#101010', 0.75);
        if (stage >= 2) g.px(Math.round(x) + 1, Math.round(y), '#101010', 0.4);
        x += dx; y += dy;
        if (h2(b * 31 + i, stage, 907) < 0.3) { const t = dx; dx = dx * 0.8 + dy * 0.3; dy = dy * 0.8 - t * 0.3; }
      }
    }
    if (stage >= 1) g.rect(15, 15, 3, 3, '#101010', 0.7);
    return g;
  }
  TILES.crack0 = () => crackTile(0);
  TILES.crack1 = () => crackTile(1);
  TILES.crack2 = () => crackTile(2);
  TILES.crack3 = () => crackTile(3);

  /* ================= 图集 ================= */
  const ATLAS_COLS = 8;
  A.tileUV = {};        // name -> [u0,v0,u1,v1]（含半像素内缩）
  A.tileGrids = {};     // name -> Grid（供图标/颜色采样使用）
  A.tileColor = {};     // name -> 平均色
  A.tileSVG = {};       // name -> 原始 SVG 字符串

  function svgToImage(svg) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
    });
  }
  A.svgToImage = svgToImage;
  A.svgURL = svg => 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));

  function avgColor(grid) {
    let r = 0, g = 0, b = 0, n = 0;
    for (const p of grid.d) {
      if (!p) continue;
      const c = hex2rgb(p.c); r += c[0]; g += c[1]; b += c[2]; n++;
    }
    if (!n) return '#888888';
    return rgb2hex(r / n, g / n, b / n);
  }

  async function buildAtlas() {
    const names = Object.keys(TILES);
    const rows = Math.ceil(names.length / ATLAS_COLS);
    const canvas = document.createElement('canvas');
    canvas.width = ATLAS_COLS * T; canvas.height = rows * T;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    for (let i = 0; i < names.length; i++) {
      const name = names[i];
      const grid = TILES[name]();
      A.tileGrids[name] = grid;
      A.tileColor[name] = avgColor(grid);
      const svg = grid.toSVG();
      A.tileSVG[name] = svg;
      const img = await svgToImage(svg);
      const cx = (i % ATLAS_COLS) * T, cy = Math.floor(i / ATLAS_COLS) * T;
      ctx.drawImage(img, cx, cy, T, T);
      const iu = 0.35 / canvas.width, iv = 0.35 / canvas.height; // 防渗色内缩
      A.tileUV[name] = [
        (cx) / canvas.width + iu, 1 - (cy + T) / canvas.height + iv,
        (cx + T) / canvas.width - iu, 1 - (cy) / canvas.height - iv
      ];
    }
    A.atlasCanvas = canvas;
    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    A.atlasTexture = tex;
  }

  /* ---- 故障方块动画纹理 ---- */
  async function buildGlitchTexture() {
    const frames = [];
    for (const n of ['glitch0', 'glitch1', 'glitch2'])
      frames.push(await svgToImage(A.tileSVG[n]));
    const canvas = document.createElement('canvas');
    canvas.width = T; canvas.height = T;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(frames[0], 0, 0);
    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    A.glitchTexture = tex;
    let fi = 0;
    A.tickGlitch = function () {
      fi = (fi + 1) % 3;
      ctx.clearRect(0, 0, T, T);
      ctx.drawImage(frames[fi], 0, 0);
      tex.needsUpdate = true;
    };
  }

  /* ================= 物品图标 ================= */
  A.iconURL = {}; // itemId -> dataURL

  // 伪 3D 方块图标（等距），faces: {top, side}
  function blockIcon(topName, sideName, sideName2) {
    const top = A.tileGrids[topName], side = A.tileGrids[sideName], side2 = A.tileGrids[sideName2 || sideName];
    function facePart(grid, matrix, bright) {
      let s = '<g transform="matrix(' + matrix.join(',') + ')"><g transform="scale(' + (1 / T) + ')">';
      for (let y = 0; y < T; y += 2) {
        let x = 0;
        while (x < T) {
          const p = grid.get(x, y);
          if (!p) { x += 2; continue; }
          let x2 = x + 2;
          while (x2 < T && grid.get(x2, y) && grid.get(x2, y).c === p.c) x2 += 2;
          s += '<rect x="' + x + '" y="' + y + '" width="' + (x2 - x) + '" height="2.1" fill="' + shade(p.c, bright) + '"/>';
          x = x2;
        }
      }
      return s + '</g></g>';
    }
    let svg = '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 32 32" shape-rendering="crispEdges">';
    svg += facePart(top, [14, 7, -14, 7, 16, 2], 1.0);
    svg += facePart(side2, [14, 7, 0, 14, 2, 9], 0.62);
    svg += facePart(side, [14, -7, 0, 14, 16, 16], 0.82);
    svg += '</svg>';
    return A.svgURL(svg);
  }
  A.blockIcon = blockIcon;

  // 16x16 手绘像素图标
  function iconFromMap(rows, palette) {
    const g = new Grid(16, 16);
    for (let y = 0; y < rows.length; y++)
      for (let x = 0; x < rows[y].length; x++) {
        const ch = rows[y][x];
        if (ch !== '.' && palette[ch]) {
          const p = palette[ch];
          if (Array.isArray(p)) g.px(x, y, p[0], p[1]); else g.px(x, y, p);
        }
      }
    let svg = g.toSVG();
    svg = svg.replace('width="16" height="16"', 'width="64" height="64"');
    return A.svgURL(svg);
  }
  A.iconFromMap = iconFromMap;

  // 程序化工具图标（斜握，MC 风）
  function toolIcon(type, head, headHi, headLo) {
    const g = new Grid(16, 16);
    const H = '#6b4a2a', HD = '#4a331d', O = '#1a1208';
    function handle(x0, y0, x1, y1) {
      g.line(x0, y0, x1, y1, H); g.line(x0 + 1, y0, x1 + 1, y1, HD);
      g.line(x0 - 1, y0, x1 - 1, y1, O, 0.9); g.line(x0 + 2, y0, x1 + 2, y1, O, 0.9);
    }
    if (type === 'pick') {
      handle(3, 13, 10, 6);
      for (let i = 0; i < 10; i++) {
        const yy = 2 + Math.floor(Math.abs(i - 4.5) * 0.55);
        g.px(3 + i, yy, head); g.px(3 + i, yy + 1, headLo);
        g.px(3 + i, yy - 1, O, 0.9);
      }
      g.rect(2, 4, 1, 3, head); g.rect(13, 4, 1, 3, head);
      g.px(2, 3, headHi); g.px(13, 3, headHi);
      g.px(1, 4, O, 0.9); g.px(14, 4, O, 0.9); g.px(2, 7, O, 0.9); g.px(13, 7, O, 0.9);
    } else if (type === 'sword') {
      handle(3, 13, 5, 11);
      g.rect(3, 10, 5, 1, HD); g.rect(4, 11, 1, 1, HD); g.rect(6, 8, 1, 1, HD); // 护手
      for (let i = 0; i < 7; i++) {
        g.px(6 + i, 9 - i, head); g.px(7 + i, 9 - i, headHi);
        g.px(5 + i, 9 - i, O, 0.9); g.px(8 + i, 9 - i, O, 0.9);
      }
      g.px(13, 2, headHi); g.px(12, 2, head);
    } else if (type === 'blade') { // 管刀：宽刃
      handle(3, 13, 5, 11);
      g.rect(3, 10, 4, 2, '#333');
      for (let i = 0; i < 8; i++) {
        g.px(5 + i, 10 - i, headLo); g.px(6 + i, 10 - i, head); g.px(7 + i, 10 - i, headHi);
        g.px(4 + i, 10 - i, O, 0.9);
      }
      g.px(13, 2, headHi);
    }
    return A.svgURL(g.toSVG().replace('width="16" height="16"', 'width="64" height="64"'));
  }

  function buildIcons() {
    // 手绘图标
    A.iconURL.almond = iconFromMap([
      '................',
      '.....CCCC.......',
      '.....CCCC.......',
      '......GG........',
      '......GG........',
      '.....GGGG.......',
      '....GWWWWG......',
      '....GWWWWG......',
      '....LLLLLL......',
      '....LAALLL......',
      '....LAAALL......',
      '....LLLLLL......',
      '....GWWWWG......',
      '....GWWWWG......',
      '.....GGGG.......',
      '................'
    ], { C: '#b8bec4', G: '#a8cfd8', W: '#cfeaf0', L: '#f2ecd9', A: '#b5834b' });
    A.iconURL.stick = iconFromMap([
      '................',
      '............BB..',
      '...........BDB..',
      '..........BDB...',
      '.........BDB....',
      '........BDB.....',
      '.......BDB......',
      '......BDB.......',
      '.....BDB........',
      '....BDB.........',
      '...BDB..........',
      '..BDB...........',
      '..BB............',
      '................',
      '................',
      '................'
    ], { B: '#6b4a2a', D: '#8a6438' });
    A.iconURL.light_tube = iconFromMap([
      '................',
      '.............MM.',
      '............MWM.',
      '...........WWM..',
      '..........WWW...',
      '.........WWW....',
      '........WWW.....',
      '.......WWW......',
      '......WWW.......',
      '.....WWW........',
      '....WWW.........',
      '...WWM..........',
      '..MWM...........',
      '.MM.............',
      '................',
      '................'
    ], { M: '#8b939c', W: '#f4f8e8' });
    A.iconURL.metal_pipe = iconFromMap([
      '................',
      '............DD..',
      '...........DPD..',
      '..........DPPD..',
      '.........DPHD...',
      '........DPHD....',
      '.......DPHD.....',
      '......DPHD......',
      '.....DPHD.......',
      '....DPHD........',
      '...DPPD.........',
      '..DPPD..........',
      '..DDD...........',
      '................',
      '................',
      '................'
    ], { D: '#4e545b', P: '#8b939c', H: '#c2c8d0' });
    A.iconURL.battery = iconFromMap([
      '................',
      '......MM........',
      '.....DDDD.......',
      '.....DTTD.......',
      '.....DTTD.......',
      '.....DDDD.......',
      '.....DBBD.......',
      '.....DBYD.......',
      '.....DYBD.......',
      '.....DBBD.......',
      '.....DBBD.......',
      '.....DDDD.......',
      '................',
      '................',
      '................',
      '................'
    ], { M: '#c2c8d0', D: '#2c3138', T: '#c74a3a', B: '#3a4a5e', Y: '#f2d549' });
    A.iconURL.flashlight = iconFromMap([
      '................',
      '................',
      '................',
      '..........HH....',
      '.........HHHY.L.',
      '..DDDDDDDHHHYLL.',
      '..DGGGGGDHHHYLLL',
      '..DGGGGGDHHHYLLL',
      '..DDDDDDDHHHYLL.',
      '.........HHHY.L.',
      '..........HH....',
      '................',
      '................',
      '................',
      '................',
      '................'
    ], { D: '#2c3138', G: '#4e545b', H: '#6e757d', Y: '#ffe98a', L: ['#fff3b0', 0.55] });
    A.iconURL.bandage = iconFromMap([
      '................',
      '................',
      '....WWWWWWWW....',
      '...WWWWWWWWWW...',
      '...WWWWRRWWWW...',
      '...WWWWRRWWWW...',
      '...WWRRRRRRWW...',
      '...WWRRRRRRWW...',
      '...WWWWRRWWWW...',
      '...WWWWRRWWWW...',
      '...WWWWWWWWWW...',
      '....WWWWWWWW....',
      '......EEEE......',
      '................',
      '................',
      '................'
    ], { W: '#f0ede4', R: '#cc4a3f', E: '#d8d4c8' });
    // 工具
    A.iconURL.wood_pick = toolIcon('pick', '#a5834e', '#c4a266', '#7d6238');
    A.iconURL.wood_sword = toolIcon('sword', '#a5834e', '#c4a266', '#7d6238');
    A.iconURL.pipe_pick = toolIcon('pick', '#8b939c', '#c2c8d0', '#5f656d');
    A.iconURL.pipe_blade = toolIcon('blade', '#8b939c', '#c2c8d0', '#5f656d');
    // 方块图标
    A.iconURL.wall = blockIcon('wallpaper0', 'wallpaper0');
    A.iconURL.carpet = blockIcon('carpet0', 'carpet0');
    A.iconURL.ceiling = blockIcon('ceiling', 'ceiling');
    A.iconURL.old_wood = blockIcon('old_wood', 'old_wood');
    A.iconURL.planks = blockIcon('planks', 'planks');
    A.iconURL.craft = blockIcon('craft_top', 'craft_side');
    A.iconURL.concrete = blockIcon('concrete', 'concrete');
    A.iconURL.crate = blockIcon('crate_top', 'crate_side');
    A.iconURL.lamp = blockIcon('lamp_top', 'lamp_side');
  }

  /* ================= 怪物皮肤纹理 ================= */
  A.entityTex = {}; // key -> THREE.Texture
  const ETEX = {};

  function pixTexture(w, h, painter) {
    const g = new Grid(w, h);
    painter(g);
    return g;
  }
  // 猎犬：苍白无毛皮肤
  ETEX.hound_body = () => pixTexture(16, 16, g => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      let c = mix('#c9bda9', '#a99d88', noiseW(x / 16, y / 16, 8, 1001));
      if (h2(x, y, 1003) < 0.09) c = shade(c, 0.8);
      if (h2(x, y, 1005) < 0.04) c = '#8a5a52';   // 皮肤破损
      g.px(x, y, c);
    }
    for (let i = 0; i < 16; i += 3) g.px(i, 2, '#8f846f'); // 脊椎凸起
  });
  ETEX.hound_face = () => pixTexture(16, 16, g => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++)
      g.px(x, y, mix('#c9bda9', '#a99d88', noiseW(x / 16, y / 16, 8, 1011)));
    g.rect(2, 4, 3, 3, '#0d0d0d'); g.rect(11, 4, 3, 3, '#0d0d0d');  // 深洞眼
    g.px(3, 5, '#3d3d3d'); g.px(12, 5, '#3d3d3d');
    g.rect(3, 10, 10, 4, '#5a3d3a');  // 裂开的嘴
    for (let x = 3; x < 13; x += 2) { g.px(x, 10, '#e8e4da'); g.px(x + 1, 13, '#e8e4da'); } // 牙
  });
  ETEX.hound_leg = () => pixTexture(8, 12, g => {
    for (let y = 0; y < 12; y++) for (let x = 0; x < 8; x++) {
      let c = mix('#bdb19d', '#9d927e', 0); c = mix('#bdb19d', '#9d9180', noiseW(x / 8, y / 12, 4, 1021));
      if (y > 9) c = '#6e6455';
      g.px(x, y, c);
    }
  });
  // 微笑者：纯黑 + 发光笑脸
  ETEX.smiler_face = () => pixTexture(32, 32, g => {
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      const n = noiseW(x / 32, y / 32, 8, 1101);
      g.px(x, y, mix('#020204', '#0a0a12', n));
    }
    // 眼（上弯月）
    for (let i = 0; i < 7; i++) {
      const yy = 9 - Math.floor(Math.sin(i / 6 * Math.PI) * 2.6);
      g.px(4 + i, yy, '#eef6ff'); g.px(4 + i, yy + 1, '#bfe3ff', 0.8);
      g.px(21 + i, yy, '#eef6ff'); g.px(21 + i, yy + 1, '#bfe3ff', 0.8);
    }
    // 大弯月笑
    for (let i = 0; i < 22; i++) {
      const t = i / 21;
      const yy = 18 + Math.floor(Math.sin(t * Math.PI) * 6);
      g.px(5 + i, yy, '#ffffff'); g.px(5 + i, yy - 1, '#eef6ff');
      if (i % 2 === 0) g.px(5 + i, yy - 2, '#dceeff', 0.7); // 牙缝
    }
  });
  ETEX.smiler_side = () => pixTexture(32, 32, g => {
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++)
      g.px(x, y, mix('#020204', '#0a0a12', noiseW(x / 32, y / 32, 8, 1103)));
  });
  // 无面灵：灰西装 + 空白脸
  ETEX.faceling_head = () => pixTexture(16, 16, g => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      let c = mix('#cfc4b4', '#bdb2a2', noiseW(x / 16, y / 16, 6, 1201));
      g.px(x, y, c);
    }
    g.rect(4, 5, 2, 1, '#b0a595', 0.8); g.rect(10, 5, 2, 1, '#b0a595', 0.8); // 极浅的眼窝痕迹
  });
  ETEX.faceling_body = () => pixTexture(16, 16, g => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++)
      g.px(x, y, mix('#3a3d44', '#2e3138', noiseW(x / 16, y / 16, 6, 1211)));
    g.rect(7, 0, 2, 16, '#22242a');  // 领带
    g.rect(5, 0, 1, 4, '#d8d2c4'); g.rect(10, 0, 1, 4, '#d8d2c4'); // 衬衫领
  });
  ETEX.faceling_leg = () => pixTexture(8, 16, g => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 8; x++) {
      let c = mix('#2c2e34', '#25272c', noiseW(x / 8, y / 16, 4, 1221));
      if (y > 13) c = '#1a1b1f';
      g.px(x, y, c);
    }
  });
  ETEX.faceling_arm = () => pixTexture(8, 16, g => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 8; x++) {
      let c = mix('#3a3d44', '#2e3138', noiseW(x / 8, y / 16, 4, 1231));
      if (y > 12) c = '#cfc4b4';
      g.px(x, y, c);
    }
  });
  // 玩家手臂（第一人称）
  ETEX.arm = () => pixTexture(8, 16, g => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 8; x++) {
      let c = mix('#4a5a6e', '#3e4c5e', noiseW(x / 8, y / 16, 4, 1301)); // 蓝色工装袖
      if (y > 11) c = mix('#d8b592', '#c9a37f', noiseW(x / 8, y / 16, 4, 1303)); // 手
      if (y === 11) c = '#35414f';
      g.px(x, y, c);
    }
  });

  async function buildEntityTextures() {
    for (const key of Object.keys(ETEX)) {
      const grid = ETEX[key]();
      const img = await svgToImage(grid.toSVG());
      const canvas = document.createElement('canvas');
      canvas.width = grid.w; canvas.height = grid.h;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0);
      const tex = new THREE.CanvasTexture(canvas);
      tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
      tex.generateMipmaps = false;
      A.entityTex[key] = tex;
    }
  }

  /* ================= 载入 ================= */
  A._debugTiles = TILES;
  A._debugEtex = ETEX;
  A.ready = false;
  A.load = async function () {
    await buildAtlas();
    await buildGlitchTexture();
    buildIcons();
    await buildEntityTextures();
    A.ready = true;
  };
})();
