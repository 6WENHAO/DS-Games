/* textures.js - 全部贴图由 SVG 程序化绘制（16x16 像素风），禁止外部图片 */
const TEXGEN = (function () {
  'use strict';
  let PAL = null;

  /* ---------- 像素工具 ---------- */
  function R(seed) {
    let t = seed >>> 0;
    return function () {
      t += 0x6D2B79F5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }
  function mk() { return new Uint8ClampedArray(16 * 16 * 4); }
  function set(d, x, y, c, a) {
    if (x < 0 || x > 15 || y < 0 || y > 15) return;
    const i = (y * 16 + x) * 4;
    d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = a === undefined ? 255 : a;
  }
  function sh(c, f) { return [c[0] * f, c[1] * f, c[2] * f]; }
  function mx(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function fillN(d, base, vary, rnd) {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const k = (rnd() - 0.5) * vary;
      set(d, x, y, [base[0] + k, base[1] + k, base[2] + k]);
    }
  }
  function rect(d, x0, y0, w, h, c, a) {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) set(d, x, y, c, a);
  }
  function speck(d, c, n, rnd, a) { for (let i = 0; i < n; i++) set(d, rnd() * 16 | 0, rnd() * 16 | 0, c, a); }
  function disc(d, cx, cy, r, c, a) {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++)
      if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r) set(d, x, y, c, a);
  }
  function line(d, x0, y0, x1, y1, c, a) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) || 1;
    for (let i = 0; i <= n; i++) set(d, Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), c, a);
  }
  function border(d, c) { rect(d, 0, 0, 16, 1, c); rect(d, 0, 15, 16, 1, c); rect(d, 0, 0, 1, 16, c); rect(d, 15, 0, 1, 16, c); }

  function stoneBase(d, rnd) {
    fillN(d, [128, 130, 134], 26, rnd);
    for (let i = 0; i < 5; i++) {
      const x = rnd() * 14 | 0, y = rnd() * 14 | 0, f = 0.9 + rnd() * 0.18;
      for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) {
        const idx = ((y + b) * 16 + x + a) * 4;
        if (idx < d.length) { d[idx] *= f; d[idx + 1] *= f; d[idx + 2] *= f; }
      }
    }
  }
  function oreTex(d, rnd, col, hi) {
    stoneBase(d, rnd);
    for (let i = 0; i < 5; i++) {
      const x = 2 + rnd() * 11 | 0, y = 2 + rnd() * 11 | 0;
      set(d, x, y, col); set(d, x + 1, y, col); set(d, x, y + 1, sh(col, 0.75));
      if (rnd() < 0.7) set(d, x + 1, y + 1, hi);
      if (rnd() < 0.4) set(d, x - 1, y, hi);
    }
  }
  function metalBlock(d, rnd, base) {
    fillN(d, base, 10, rnd);
    border(d, sh(base, 0.72));
    rect(d, 1, 1, 14, 1, mx(base, [255, 255, 255], 0.35));
    rect(d, 1, 1, 1, 14, mx(base, [255, 255, 255], 0.25));
    rect(d, 1, 14, 14, 1, sh(base, 0.82));
  }
  function logSide(d, rnd, base) {
    for (let x = 0; x < 16; x++) {
      const f = 0.82 + ((x * 7) % 5) * 0.06;
      for (let y = 0; y < 16; y++) set(d, x, y, sh(base, f + (rnd() - 0.5) * 0.1));
    }
    for (let i = 0; i < 3; i++) { const x = rnd() * 16 | 0, y = rnd() * 14 | 0; set(d, x, y, sh(base, 0.6)); set(d, x, y + 1, sh(base, 0.6)); }
  }
  function logTop(d, rnd, bark, core) {
    fillN(d, bark, 14, rnd);
    for (let r = 6; r >= 1; r -= 1.6) {
      const f = 0.75 + (6 - r) * 0.07;
      for (let a = 0; a < 40; a++) {
        const t = a / 40 * Math.PI * 2;
        set(d, Math.round(7.5 + Math.cos(t) * r), Math.round(7.5 + Math.sin(t) * r), sh(core, f));
      }
    }
    disc(d, 7.5, 7.5, 1.6, sh(core, 1.05));
  }
  function planks(d, rnd, base) {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const row = y >> 2;
      const f = 0.9 + ((x * 3 + row * 5) % 7) * 0.022 + (rnd() - 0.5) * 0.06;
      set(d, x, y, sh(base, f));
    }
    for (let r = 0; r < 4; r++) {
      rect(d, 0, r * 4 + 3, 16, 1, sh(base, 0.62));
      const off = (r * 7 + 4) % 16;
      rect(d, off, r * 4, 1, 3, sh(base, 0.68));
    }
  }
  function woolTex(d, rnd, base) {
    fillN(d, base, 22, rnd);
    for (let y = 0; y < 16; y += 2) for (let x = (y >> 1) % 2; x < 16; x += 4) set(d, x, y, sh(base, 0.88));
    border(d, sh(base, 0.9));
  }
  function terraTex(d, rnd, base) {
    fillN(d, base, 16, rnd);
    for (let y = 0; y < 16; y += 3) rect(d, 0, y, 16, 1, sh(base, 0.9));
    for (let y = 2; y < 16; y += 5) rect(d, 0, y, 16, 1, sh(base, 1.08));
  }
  function leafBase(d, rnd, base, holePr) {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const r = rnd();
      let c = base;
      if (r < 0.22) c = sh(base, 0.78);
      else if (r > 0.86) c = sh(base, 1.16);
      set(d, x, y, c);
    }
  }

  /* ---------- 方块贴图painter：与 gen.js TILE_LIST 同名 ---------- */
  function makePainters(P) {
    const woolColors = [
      [233, 236, 236], [240, 118, 19], [189, 68, 179], [58, 175, 217], [248, 198, 39], [112, 185, 25],
      [237, 141, 172], [62, 68, 71], [142, 142, 134], [21, 137, 145], [121, 42, 172], [53, 57, 157],
      [114, 71, 40], [84, 109, 27], [161, 39, 34], [25, 25, 25]
    ];
    const p = {
      grass_top: function (d, r) {
        fillN(d, P.grass, 30, r);
        speck(d, sh(P.grass, 0.75), 26, r); speck(d, sh(P.grass, 1.2), 16, r);
      },
      grass_side: function (d, r) {
        fillN(d, P.dirt, 26, r); speck(d, sh(P.dirt, 0.7), 14, r);
        for (let x = 0; x < 16; x++) {
          const hgt = 2 + (r() * 3 | 0);
          for (let y = 0; y < hgt; y++) set(d, x, y, sh(P.grass, y === hgt - 1 ? 0.85 : 1));
        }
      },
      dirt: function (d, r) { fillN(d, P.dirt, 28, r); speck(d, sh(P.dirt, 0.68), 20, r); speck(d, sh(P.dirt, 1.25), 10, r); },
      stone: function (d, r) { stoneBase(d, r); },
      cobble: function (d, r) {
        fillN(d, [110, 112, 116], 18, r);
        const pts = [[3, 3, 3], [10, 2, 3], [14, 6, 2], [5, 9, 3], [11, 9, 3], [2, 13, 2], [8, 14, 2], [14, 13, 2]];
        for (let i = 0; i < pts.length; i++) {
          const f = 0.92 + r() * 0.25;
          disc(d, pts[i][0], pts[i][1], pts[i][2], sh([130, 132, 136], f));
        }
        speck(d, [82, 84, 88], 22, r);
      },
      sand: function (d, r) { fillN(d, P.sand, 20, r); speck(d, sh(P.sand, 0.85), 18, r); speck(d, sh(P.sand, 1.1), 10, r); },
      red_sand: function (d, r) { fillN(d, P.redSand, 20, r); speck(d, sh(P.redSand, 0.85), 18, r); },
      sandstone_top: function (d, r) { fillN(d, P.sandstone, 14, r); border(d, sh(P.sandstone, 0.9)); },
      sandstone_side: function (d, r) {
        fillN(d, P.sandstone, 12, r);
        rect(d, 0, 0, 16, 2, sh(P.sandstone, 1.08)); rect(d, 0, 13, 16, 3, sh(P.sandstone, 0.85));
        for (let y = 4; y < 12; y += 3) rect(d, 0, y, 16, 1, sh(P.sandstone, 0.93));
        speck(d, sh(P.sandstone, 0.8), 8, r);
      },
      gravel: function (d, r) {
        fillN(d, P.gravel, 34, r);
        speck(d, [88, 84, 80], 24, r); speck(d, [150, 146, 142], 20, r); speck(d, [118, 104, 88], 12, r);
      },
      snow: function (d, r) { fillN(d, P.snow, 10, r); speck(d, [255, 255, 255], 14, r); speck(d, [214, 224, 236], 10, r); },
      ice: function (d, r) {
        fillN(d, P.ice, 14, r);
        line(d, 2, 13, 8, 3, sh(P.ice, 1.15)); line(d, 9, 14, 13, 6, sh(P.ice, 1.12));
        speck(d, [236, 248, 255], 8, r); border(d, sh(P.ice, 0.92));
      },
      bedrock: function (d, r) {
        fillN(d, [70, 70, 74], 44, r);
        for (let i = 0; i < 6; i++) { const x = r() * 13 | 0, y = r() * 13 | 0; rect(d, x, y, 3, 2, r() < 0.5 ? [38, 38, 42] : [104, 104, 110]); }
      },
      coal_ore: function (d, r) { oreTex(d, r, [38, 38, 40], [70, 70, 74]); },
      iron_ore: function (d, r) { oreTex(d, r, [206, 160, 120], [232, 200, 168]); },
      gold_ore: function (d, r) { oreTex(d, r, [244, 200, 66], [255, 236, 140]); },
      diamond_ore: function (d, r) { oreTex(d, r, [70, 220, 210], [170, 250, 245]); },
      ruby_ore: function (d, r) { oreTex(d, r, [222, 60, 70], [255, 130, 138]); },
      emerald_ore: function (d, r) { oreTex(d, r, [50, 200, 105], [140, 245, 180]); },
      lazul_ore: function (d, r) { oreTex(d, r, [45, 78, 200], [110, 140, 240]); },
      coal_block: function (d, r) { metalBlock(d, r, [42, 42, 46]); },
      iron_block: function (d, r) { metalBlock(d, r, [222, 222, 224]); },
      gold_block: function (d, r) { metalBlock(d, r, [246, 208, 61]); },
      diamond_block: function (d, r) { metalBlock(d, r, [98, 226, 217]); },
      emerald_block: function (d, r) { metalBlock(d, r, [70, 208, 120]); },
      log_fir_side: function (d, r) { logSide(d, r, P.logFir); },
      log_fir_top: function (d, r) { logTop(d, r, P.logFir, [186, 150, 106]); },
      log_palm_side: function (d, r) {
        logSide(d, r, P.logPalm);
        for (let y = 3; y < 16; y += 4) rect(d, 0, y, 16, 1, sh(P.logPalm, 0.7));
      },
      log_palm_top: function (d, r) { logTop(d, r, P.logPalm, [214, 190, 140]); },
      log_cherry_side: function (d, r) {
        logSide(d, r, P.logCherry);
        for (let i = 0; i < 3; i++) { const y = 2 + (r() * 12 | 0); rect(d, r() * 10 | 0, y, 4, 1, sh(P.logCherry, 1.35)); }
      },
      log_cherry_top: function (d, r) { logTop(d, r, P.logCherry, [200, 150, 140]); },
      log_giant_side: function (d, r) {
        logSide(d, r, P.logGiant);
        rect(d, 4, 0, 2, 16, sh(P.logGiant, 0.78)); rect(d, 11, 0, 1, 16, sh(P.logGiant, 1.15));
      },
      log_giant_top: function (d, r) { logTop(d, r, P.logGiant, [196, 158, 108]); },
      planks_fir: function (d, r) { planks(d, r, [158, 122, 86]); },
      planks_palm: function (d, r) { planks(d, r, [208, 178, 122]); },
      planks_cherry: function (d, r) { planks(d, r, [188, 128, 118]); },
      planks_giant: function (d, r) { planks(d, r, [146, 104, 64]); },
      leaves_fir: function (d, r) {
        leafBase(d, r, P.folFir);
        for (let i = 0; i < 8; i++) { const x = r() * 14 | 0, y = r() * 14 | 0; line(d, x, y, x + 2, y + 2, sh(P.folFir, 0.66)); }
        speck(d, [216, 230, 238], 3, r);
      },
      leaves_palm: function (d, r) {
        leafBase(d, r, P.folPalm);
        for (let y = 1; y < 16; y += 3) { line(d, 0, y, 15, y, sh(P.folPalm, 1.18)); line(d, 0, y + 1, 15, y + 1, sh(P.folPalm, 0.72)); }
      },
      leaves_cherry: function (d, r) {
        leafBase(d, r, P.folCherry);
        for (let i = 0; i < 7; i++) {
          const x = 1 + (r() * 13 | 0), y = 1 + (r() * 13 | 0);
          set(d, x, y, [255, 235, 244]); set(d, x + 1, y, [255, 215, 232]); set(d, x, y + 1, [244, 130, 176]);
        }
        speck(d, sh(P.folCherry, 0.7), 12, r);
      },
      leaves_giant: function (d, r) {
        leafBase(d, r, P.folGiant);
        speck(d, [150, 255, 190], 7, r); speck(d, sh(P.folGiant, 0.62), 14, r);
      },
      terra_plain: function (d, r) { terraTex(d, r, [168, 106, 82]); },
      brick: function (d, r) {
        fillN(d, [188, 96, 78], 16, r);
        for (let row = 0; row < 4; row++) {
          rect(d, 0, row * 4 + 3, 16, 1, [214, 202, 194]);
          const off = row % 2 ? 3 : 9;
          rect(d, off, row * 4, 1, 3, [214, 202, 194]);
          rect(d, (off + 8) % 16, row * 4, 1, 3, [214, 202, 194]);
        }
      },
      stonebrick: function (d, r) {
        fillN(d, [122, 124, 128], 18, r);
        rect(d, 0, 7, 16, 1, [86, 88, 92]); rect(d, 0, 15, 16, 1, [86, 88, 92]);
        rect(d, 7, 0, 1, 8, [86, 88, 92]); rect(d, 12, 8, 1, 8, [86, 88, 92]); rect(d, 3, 8, 1, 8, [86, 88, 92]);
        rect(d, 0, 0, 16, 1, [150, 152, 158]);
      },
      mossy: function (d, r) {
        p.cobble(d, r);
        for (let i = 0; i < 7; i++) { const x = r() * 13 | 0, y = r() * 13 | 0; rect(d, x, y, 1 + (r() * 3 | 0), 1 + (r() * 2 | 0), [92, 138, 62]); }
      },
      obsidian: function (d, r) {
        fillN(d, [24, 18, 38], 12, r);
        for (let i = 0; i < 5; i++) { const x = r() * 15 | 0, y = r() * 15 | 0; set(d, x, y, [74, 52, 110]); set(d, x + 1, y + 1, [50, 36, 80]); }
      },
      glowstone: function (d, r) {
        fillN(d, [196, 142, 58], 30, r);
        for (let i = 0; i < 8; i++) { const x = r() * 14 | 0, y = r() * 14 | 0; rect(d, x, y, 2, 2, [255, 224, 128]); set(d, x, y, [255, 246, 190]); }
      },
      bookshelf: function (d, r) {
        planks(d, r, [158, 122, 86]);
        rect(d, 1, 2, 14, 5, [78, 58, 40]);
        rect(d, 1, 9, 14, 5, [78, 58, 40]);
        const bc = [[172, 54, 52], [62, 96, 168], [84, 142, 68], [196, 170, 60], [140, 74, 150], [190, 190, 190]];
        for (let row = 0; row < 2; row++) for (let x = 1; x < 15; x += 2) {
          const c = bc[(x + row * 3) % bc.length];
          rect(d, x, 2 + row * 7, 2, 5, c); rect(d, x, 2 + row * 7, 1, 5, sh(c, 0.8));
        }
      },
      craft_top: function (d, r) {
        planks(d, r, [158, 122, 86]);
        border(d, [96, 70, 46]);
        rect(d, 3, 3, 10, 1, [96, 70, 46]); rect(d, 3, 12, 10, 1, [96, 70, 46]);
        rect(d, 3, 3, 1, 10, [96, 70, 46]); rect(d, 12, 3, 1, 10, [96, 70, 46]);
      },
      craft_side: function (d, r) {
        planks(d, r, [158, 122, 86]);
        rect(d, 2, 3, 5, 5, [120, 120, 124]); rect(d, 3, 4, 3, 3, [168, 168, 172]);
        rect(d, 9, 3, 5, 5, [150, 96, 60]); rect(d, 10, 4, 3, 3, [190, 130, 84]);
      },
      furnace: function (d, r) {
        stoneBase(d, r); border(d, [84, 86, 90]);
        rect(d, 4, 7, 8, 6, [30, 30, 34]);
        rect(d, 5, 9, 6, 3, [216, 120, 32]); rect(d, 6, 10, 4, 2, [255, 196, 64]);
      },
      chest_side: function (d, r) {
        planks(d, r, [168, 118, 62]); border(d, [104, 72, 38]);
        rect(d, 0, 6, 16, 1, [104, 72, 38]);
        rect(d, 7, 4, 2, 4, [150, 150, 155]); rect(d, 7, 5, 2, 2, [190, 190, 196]);
      },
      chest_top: function (d, r) { planks(d, r, [168, 118, 62]); border(d, [104, 72, 38]); },
      tnt_top: function (d, r) {
        fillN(d, [188, 66, 52], 14, r);
        rect(d, 3, 3, 10, 10, [222, 200, 178]);
        disc(d, 7.5, 7.5, 2.2, [50, 44, 40]); set(d, 7, 7, [255, 220, 120]); set(d, 8, 8, [255, 220, 120]);
      },
      tnt_side: function (d, r) {
        fillN(d, [198, 70, 54], 14, r);
        for (let x = 0; x < 16; x += 4) rect(d, x, 0, 1, 16, sh([198, 70, 54], 0.85));
        rect(d, 0, 6, 16, 4, [228, 208, 186]);
        rect(d, 2, 7, 2, 2, [40, 36, 34]); rect(d, 7, 7, 2, 2, [40, 36, 34]); rect(d, 12, 7, 2, 2, [40, 36, 34]);
      },
      tnt_bottom: function (d, r) { fillN(d, [148, 52, 40], 14, r); border(d, [110, 40, 32]); },
      sponge: function (d, r) {
        fillN(d, [206, 196, 82], 22, r);
        for (let i = 0; i < 12; i++) set(d, r() * 16 | 0, r() * 16 | 0, [150, 138, 48]);
        for (let i = 0; i < 5; i++) rect(d, r() * 14 | 0, r() * 14 | 0, 2, 1, [166, 154, 56]);
      },
      pumpkin_side: function (d, r) {
        fillN(d, [214, 124, 32], 16, r);
        for (let x = 1; x < 16; x += 4) rect(d, x, 0, 1, 16, [176, 96, 22]);
        for (let x = 3; x < 16; x += 4) rect(d, x, 0, 1, 16, [236, 152, 52]);
        border(d, [166, 90, 22]);
      },
      pumpkin_top: function (d, r) {
        fillN(d, [206, 118, 30], 14, r);
        for (let a = 0; a < 32; a++) { const t = a / 32 * Math.PI * 2; set(d, Math.round(7.5 + Math.cos(t) * 5), Math.round(7.5 + Math.sin(t) * 5), [176, 96, 22]); }
        rect(d, 7, 6, 2, 3, [96, 128, 48]);
      },
      melon_side: function (d, r) {
        fillN(d, [96, 168, 48], 12, r);
        for (let x = 0; x < 16; x += 3) rect(d, x, 0, 1, 16, [66, 130, 36]);
        for (let x = 1; x < 16; x += 6) rect(d, x, 0, 1, 16, [150, 200, 90]);
      },
      melon_top: function (d, r) {
        fillN(d, [96, 168, 48], 10, r);
        for (let rr = 6; rr > 1; rr -= 2)
          for (let a = 0; a < 40; a++) { const t = a / 40 * Math.PI * 2; set(d, Math.round(7.5 + Math.cos(t) * rr), Math.round(7.5 + Math.sin(t) * rr), [66, 130, 36]); }
      },
      cactus_side: function (d, r) {
        fillN(d, [70, 140, 60], 12, r);
        for (let x = 2; x < 16; x += 4) rect(d, x, 0, 1, 16, [50, 112, 46]);
        for (let y = 1; y < 16; y += 3) { set(d, 1, y, [230, 240, 210]); set(d, 8, y + 1, [230, 240, 210]); set(d, 14, y, [230, 240, 210]); }
        border(d, [46, 100, 42]);
      },
      cactus_top: function (d, r) {
        fillN(d, [70, 140, 60], 10, r); border(d, [46, 100, 42]);
        rect(d, 4, 4, 8, 8, [96, 170, 80]);
      },
      hay_side: function (d, r) {
        fillN(d, [200, 164, 58], 24, r);
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if ((x + y * 3) % 7 === 0) set(d, x, y, [166, 128, 40]);
        rect(d, 0, 5, 16, 1, [140, 104, 34]); rect(d, 0, 11, 16, 1, [140, 104, 34]);
      },
      hay_top: function (d, r) {
        fillN(d, [206, 170, 62], 20, r);
        for (let i = 0; i < 9; i++) { const x = 1 + (i % 3) * 5, y = 1 + ((i / 3) | 0) * 5; disc(d, x + 1.5, y + 1.5, 2, [180, 142, 46]); set(d, x + 1, y + 1, [222, 190, 88]); }
      },
      clay: function (d, r) { fillN(d, [154, 160, 170], 14, r); speck(d, [178, 184, 194], 10, r); speck(d, [130, 136, 148], 10, r); },
      mud: function (d, r) { fillN(d, [96, 74, 52], 20, r); speck(d, [70, 52, 36], 22, r); speck(d, [120, 96, 68], 8, r); },
      quartz: function (d, r) { fillN(d, [236, 232, 226], 8, r); line(d, 2, 4, 9, 11, [214, 208, 200]); line(d, 10, 2, 14, 7, [214, 208, 200]); border(d, [222, 218, 212]); },
      prismarine: function (d, r) {
        fillN(d, [82, 156, 146], 14, r);
        rect(d, 0, 5, 16, 1, [58, 122, 116]); rect(d, 0, 11, 16, 1, [58, 122, 116]);
        rect(d, 5, 0, 1, 6, [58, 122, 116]); rect(d, 11, 5, 1, 7, [58, 122, 116]); rect(d, 3, 11, 1, 5, [58, 122, 116]);
        speck(d, [130, 200, 188], 8, r);
      },
      glass: function (d, r) {
        for (let i = 0; i < d.length; i += 4) d[i + 3] = 0;
        border(d, [232, 244, 248]);
        set(d, 3, 2, [255, 255, 255]); set(d, 2, 3, [255, 255, 255]);
        line(d, 11, 2, 13, 4, [220, 236, 244]);
      },
      tallgrass: function (d, r) {
        for (let i = 0; i < d.length; i += 4) d[i + 3] = 0;
        for (let k = 0; k < 7; k++) {
          const x = 1 + k * 2 + (r() * 2 | 0);
          const hgt = 6 + (r() * 8 | 0);
          const g = [88 + r() * 40, 160 + r() * 40, 62, 0];
          for (let y = 15; y > 15 - hgt; y--) set(d, x + (y < 10 ? (r() < 0.3 ? 1 : 0) : 0), y, g);
        }
      },
      flower_red: function (d, r) { flowerTex(d, r, [222, 60, 66], [255, 150, 150]); },
      flower_yellow: function (d, r) { flowerTex(d, r, [240, 200, 50], [255, 240, 140]); },
      flower_blue: function (d, r) { flowerTex(d, r, [92, 118, 232], [170, 190, 255]); },
      mush_brown: function (d, r) { mushTex(d, r, [150, 110, 76]); },
      mush_red: function (d, r) { mushTex(d, r, [200, 58, 54]); },
      deadbush: function (d, r) {
        for (let i = 0; i < d.length; i += 4) d[i + 3] = 0;
        const c = [136, 100, 58];
        line(d, 8, 15, 8, 8, c); line(d, 8, 10, 4, 5, c); line(d, 8, 10, 12, 5, c);
        line(d, 8, 12, 5, 10, c); line(d, 8, 12, 12, 9, c); line(d, 4, 5, 3, 3, c); line(d, 12, 5, 13, 3, c);
      },
      /* 青藏高原写实系：枯黄草甸（草簇斑驳）/ 草甸侧面 / 灰褐山岩（节理裂隙） */
      meadow_top: function (d, r) {
        fillN(d, P.meadow, 26, r);
        speck(d, sh(P.meadow, 0.72), 22, r);          // 干枯暗斑
        speck(d, P.meadowWet, 14, r);                  // 稀疏湿绿草簇
        speck(d, sh(P.meadow, 1.18), 12, r);           // 高光干草
        for (let i = 0; i < 5; i++) {                  // 裸露土斑
          const x = r() * 14 | 0, y = r() * 14 | 0;
          set(d, x, y, sh(P.dirt, 1.05)); set(d, x + 1, y, sh(P.dirt, 0.9));
        }
      },
      meadow_side: function (d, r) {
        fillN(d, P.dirt, 26, r); speck(d, sh(P.dirt, 0.7), 14, r);
        for (let x = 0; x < 16; x++) {
          const hgt = 2 + (r() * 3 | 0);
          for (let y = 0; y < hgt; y++) set(d, x, y, sh(P.meadow, y === hgt - 1 ? 0.82 : 0.98));
        }
      },
      alprock: function (d, r) {
        fillN(d, P.alprock, 24, r);
        for (let y = 4; y < 16; y += 5) rect(d, 0, y, 16, 1, sh(P.alprock, 0.86));   // 沉积层理
        for (let i = 0; i < 4; i++) {                  // 斜向节理裂隙
          const x = r() * 12 | 0, y = r() * 10 | 0;
          line(d, x, y, x + 2 + (r() * 3 | 0), y + 3 + (r() * 3 | 0), sh(P.alprock, 0.68));
        }
        speck(d, sh(P.alprock, 1.22), 10, r);          // 风化亮斑
        speck(d, P.alprockDark, 12, r);
      },
      /* ---------- 新树种（橡/桦/金合欢/丛林/枫 + 红杉/巨橡/榕树巨树） ---------- */
      log_oak_side: function (d, r) {
        logSide(d, r, P.logOak);
        for (let i = 0; i < 2; i++) { const x = 2 + (r() * 12 | 0), y = 3 + (r() * 9 | 0); set(d, x, y, sh(P.logOak, 0.55)); set(d, x, y + 1, sh(P.logOak, 0.5)); }
      },
      log_oak_top: function (d, r) { logTop(d, r, P.logOak, [186, 148, 100]); },
      planks_oak: function (d, r) { planks(d, r, [170, 132, 94]); },
      leaves_oak: function (d, r) {
        leafBase(d, r, P.folOak);
        for (let i = 0; i < 6; i++) { const x = r() * 14 | 0, y = r() * 14 | 0; line(d, x, y, x + 1, y + 2, sh(P.folOak, 0.7)); }
        speck(d, sh(P.folOak, 1.25), 8, r);
      },
      log_birch_side: function (d, r) {
        for (let x = 0; x < 16; x++) {
          const f = 0.9 + ((x * 5) % 4) * 0.035;
          for (let y = 0; y < 16; y++) set(d, x, y, sh(P.logBirch, f + (r() - 0.5) * 0.06));
        }
        for (let i = 0; i < 7; i++) {                  // 白桦黑色横纹
          const x = r() * 12 | 0, y = r() * 15 | 0;
          rect(d, x, y, 2 + (r() * 3 | 0), 1, [56, 52, 48]);
        }
        speck(d, [246, 246, 240], 6, r);
      },
      log_birch_top: function (d, r) { logTop(d, r, P.logBirch, [222, 206, 168]); },
      planks_birch: function (d, r) { planks(d, r, [214, 196, 158]); },
      leaves_birch: function (d, r) {
        leafBase(d, r, P.folBirch);
        speck(d, [206, 232, 150], 10, r); speck(d, sh(P.folBirch, 0.72), 10, r);
      },
      log_acacia_side: function (d, r) {
        logSide(d, r, P.logAcacia);
        for (let y = 2; y < 16; y += 5) rect(d, 0, y, 16, 1, sh(P.logAcacia, 0.72));
      },
      log_acacia_top: function (d, r) { logTop(d, r, P.logAcacia, [198, 118, 82]); },
      planks_acacia: function (d, r) { planks(d, r, [186, 102, 68]); },
      leaves_acacia: function (d, r) {
        leafBase(d, r, P.folAcacia);
        for (let y = 0; y < 16; y += 2) for (let x = (y >> 1) % 2; x < 16; x += 3) set(d, x, y, sh(P.folAcacia, 1.14));
        speck(d, sh(P.folAcacia, 0.68), 10, r);
      },
      log_jungle_side: function (d, r) {
        logSide(d, r, P.logJungle);
        for (let i = 0; i < 5; i++) { const x = r() * 15 | 0, y = r() * 15 | 0; set(d, x, y, [86, 124, 62]); }  // 苔斑
      },
      log_jungle_top: function (d, r) { logTop(d, r, P.logJungle, [188, 146, 100]); },
      planks_jungle: function (d, r) { planks(d, r, [172, 124, 88]); },
      leaves_jungle: function (d, r) {
        leafBase(d, r, P.folJungle);
        for (let i = 0; i < 5; i++) { const x = 1 + (r() * 13 | 0), y = 1 + (r() * 13 | 0); line(d, x, y, x + 2, y, sh(P.folJungle, 1.3)); }
        speck(d, [214, 232, 120], 3, r);
      },
      log_maple_side: function (d, r) {
        logSide(d, r, P.logMaple);
        for (let i = 0; i < 3; i++) { const y = 2 + (r() * 12 | 0); rect(d, r() * 10 | 0, y, 3, 1, sh(P.logMaple, 1.3)); }
      },
      log_maple_top: function (d, r) { logTop(d, r, P.logMaple, [196, 140, 100]); },
      planks_maple: function (d, r) { planks(d, r, [182, 120, 92]); },
      leaves_maple: function (d, r) {
        leafBase(d, r, P.folMaple);
        speck(d, [232, 150, 60], 12, r); speck(d, [160, 52, 36], 12, r); speck(d, [244, 196, 90], 5, r);
      },
      log_seq_side: function (d, r) {
        logSide(d, r, P.logSeq);
        rect(d, 3, 0, 1, 16, sh(P.logSeq, 0.66)); rect(d, 8, 0, 1, 16, sh(P.logSeq, 0.72));
        rect(d, 12, 0, 1, 16, sh(P.logSeq, 0.66)); rect(d, 5, 0, 1, 16, sh(P.logSeq, 1.18));   // 纤维状深沟树皮
      },
      log_seq_top: function (d, r) { logTop(d, r, P.logSeq, [208, 142, 96]); },
      leaves_seq: function (d, r) {
        leafBase(d, r, P.folSeq);
        for (let i = 0; i < 8; i++) { const x = r() * 14 | 0, y = r() * 14 | 0; line(d, x, y + 2, x + 2, y, sh(P.folSeq, 0.66)); }
        speck(d, sh(P.folSeq, 1.28), 6, r);
      },
      log_bigoak_side: function (d, r) {
        logSide(d, r, P.logBigOak);
        disc(d, 4 + (r() * 8 | 0), 4 + (r() * 8 | 0), 1.6, sh(P.logBigOak, 0.6));   // 大树瘤
        speck(d, sh(P.logBigOak, 1.2), 6, r);
      },
      log_bigoak_top: function (d, r) { logTop(d, r, P.logBigOak, [190, 148, 100]); },
      leaves_bigoak: function (d, r) {
        leafBase(d, r, P.folBigOak);
        speck(d, [150, 236, 130], 7, r); speck(d, sh(P.folBigOak, 0.62), 14, r);
      },
      log_banyan_side: function (d, r) {
        logSide(d, r, P.logBanyan);
        for (let i = 0; i < 4; i++) { const x = 1 + (r() * 13 | 0); line(d, x, 0, x + (r() < 0.5 ? 1 : -1), 15, sh(P.logBanyan, 1.16)); }  // 垂须纹
      },
      log_banyan_top: function (d, r) { logTop(d, r, P.logBanyan, [202, 178, 138]); },
      leaves_banyan: function (d, r) {
        leafBase(d, r, P.folBanyan);
        speck(d, [222, 244, 210], 5, r); speck(d, sh(P.folBanyan, 0.7), 12, r);
        for (let i = 0; i < 3; i++) { const x = r() * 15 | 0; line(d, x, 13, x, 15, [150, 128, 96]); }   // 垂下气根须
      }
    };
    for (let i = 0; i < 6; i++) (function (i) { p['terra_' + i] = function (d, r) { terraTex(d, r, P.terra[i]); }; })(i);
    for (let i = 0; i < 16; i++) (function (i) { p['wool_' + i] = function (d, r) { woolTex(d, r, woolColors[i]); }; })(i);
    return p;
  }
  function flowerTex(d, r, c, hi) {
    for (let i = 0; i < d.length; i += 4) d[i + 3] = 0;
    const g = [70, 140, 58];
    line(d, 8, 15, 8, 7, g); line(d, 8, 11, 6, 9, g); line(d, 8, 12, 10, 10, g);
    disc(d, 8, 5, 2.4, c);
    set(d, 8, 5, hi); set(d, 6, 4, sh(c, 0.8)); set(d, 10, 6, sh(c, 0.8));
    set(d, 8, 2, c); set(d, 5, 5, c); set(d, 11, 5, c); set(d, 8, 8, c);
  }
  function mushTex(d, r, cap) {
    for (let i = 0; i < d.length; i += 4) d[i + 3] = 0;
    rect(d, 7, 9, 2, 6, [222, 210, 190]);
    disc(d, 8, 7, 4, cap);
    rect(d, 4, 8, 8, 1, sh(cap, 0.8));
    set(d, 6, 5, [255, 240, 240]); set(d, 10, 6, [255, 240, 240]);
  }

  /* ---------- 工具图标（ASCII 模板 + 材质换色） ---------- */
  const TOOL_TPL = {
    sword: [
      '..............o.',
      '............oMMo',
      '...........oMMm.',
      '..........oMMm..',
      '.........oMMm...',
      '........oMMm....',
      '.......oMMm.....',
      '..o...oMMm......',
      '..oo.oMMm.......',
      '..ooOMMm........',
      '...OOOo.........',
      '..hOOo..........',
      '.hhoOO..........',
      'hhh..O..........',
      'hh..............',
      '................'
    ],
    pickaxe: [
      '.....mmmMMMm....',
      '...mmMMMMMMMMm..',
      '..mMMm.....mMMm.',
      '..mMm...h...mMm.',
      '..mM...hh....mM.',
      '..mm..hh.....mm.',
      '......hh........',
      '.....hh.........',
      '....hh..........',
      '...hh...........',
      '..hh............',
      '.hh.............',
      'hh..............',
      '................',
      '................',
      '................'
    ],
    axe: [
      '....mmMM........',
      '..mmMMMMm.......',
      '..mMMmmMMm......',
      '..mMM.hhMm......',
      '...mm.hhmm......',
      '......hh........',
      '.....hh.........',
      '....hh..........',
      '...hh...........',
      '..hh............',
      '.hh.............',
      'hh..............',
      '................',
      '................',
      '................',
      '................'
    ],
    shovel: [
      '..........mMMm..',
      '.........mMMMM..',
      '........hmMMMm..',
      '.......hh.mmm...',
      '......hh........',
      '.....hh.........',
      '....hh..........',
      '...hh...........',
      '..hh............',
      '.hh.............',
      'hh..............',
      '................',
      '................',
      '................',
      '................',
      '................'
    ],
    hoe: [
      '.....mmMMMMm....',
      '....mMMmmmMM....',
      '....mm...hh.....',
      '........hh......',
      '.......hh.......',
      '......hh........',
      '.....hh.........',
      '....hh..........',
      '...hh...........',
      '..hh............',
      '.hh.............',
      'hh..............',
      '................',
      '................',
      '................',
      '................'
    ]
  };
  const TOOL_MATS = {
    wood: { M: [196, 156, 106], m: [158, 122, 82] },
    stone: { M: [172, 174, 178], m: [126, 128, 132] },
    iron: { M: [236, 236, 238], m: [178, 178, 184] },
    gold: { M: [252, 220, 82], m: [216, 166, 32] },
    diamond: { M: [120, 234, 224], m: [52, 190, 178] }
  };
  function paintTool(d, tpl, mat) {
    const map = {
      M: mat.M, m: mat.m,
      o: [44, 36, 30], O: [120, 96, 60],
      h: [140, 104, 64], H: [104, 76, 46]
    };
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const ch = tpl[y][x];
      if (ch !== '.' && map[ch]) set(d, x, y, map[ch]);
    }
  }

  /* ---------- 食物 / 杂项图标 ---------- */
  function makeItemPainters() {
    const p = {};
    function clear(d) { for (let i = 0; i < d.length; i += 4) d[i + 3] = 0; }
    p.apple = function (d, r) {
      clear(d); disc(d, 7, 9, 4.4, [212, 50, 48]); disc(d, 10, 9, 4.2, [212, 50, 48]);
      set(d, 5, 7, [255, 160, 150]); set(d, 6, 7, [255, 160, 150]); set(d, 5, 8, [250, 120, 116]);
      line(d, 8, 4, 9, 2, [96, 66, 34]); set(d, 11, 3, [96, 170, 60]); set(d, 12, 3, [96, 170, 60]); set(d, 12, 4, [70, 140, 48]);
    };
    p.gapple = function (d, r) { p.apple(d, r); for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 0 && d[i] > 180 && d[i + 1] < 90) { d[i] = 250; d[i + 1] = 208; d[i + 2] = 60; } };
    p.bread = function (d, r) {
      clear(d);
      for (let i = 0; i < 6; i++) line(d, 3 + i, 11 - i, 9 + i, 11 - i, i < 2 ? [156, 104, 50] : [206, 152, 84]);
      line(d, 5, 5, 11, 5, [230, 188, 120]); line(d, 4, 6, 10, 6, [230, 188, 120]);
    };
    p.cookie = function (d, r) {
      clear(d); disc(d, 8, 8, 5, [200, 140, 74]);
      const pts = [[6, 6], [10, 7], [7, 10], [11, 10], [9, 5]];
      for (let i = 0; i < pts.length; i++) set(d, pts[i][0], pts[i][1], [92, 58, 36]);
    };
    p.melon_slice = function (d, r) {
      clear(d);
      for (let i = 0; i < 8; i++) line(d, 3 + i, 13 - i, 12, 13 - i, i > 5 ? [96, 168, 48] : [232, 92, 92]);
      line(d, 3, 13, 12, 13, [96, 168, 48]); line(d, 12, 5, 12, 13, [166, 214, 120]);
      set(d, 8, 9, [60, 40, 36]); set(d, 10, 11, [60, 40, 36]); set(d, 9, 7, [60, 40, 36]);
    };
    p.carrot = function (d, r) {
      clear(d);
      line(d, 6, 15, 11, 6, [232, 132, 40]); line(d, 7, 15, 12, 7, [232, 132, 40]); line(d, 7, 14, 11, 8, [255, 168, 74]);
      line(d, 12, 5, 10, 3, [90, 170, 60]); line(d, 12, 5, 14, 3, [90, 170, 60]); line(d, 12, 5, 12, 2, [110, 190, 70]);
    };
    p.potato = function (d, r) { clear(d); disc(d, 8, 9, 4.4, [206, 168, 108]); disc(d, 10, 8, 3.4, [206, 168, 108]); set(d, 6, 8, [166, 128, 78]); set(d, 11, 10, [166, 128, 78]); set(d, 9, 6, [222, 190, 130]); };
    p.potato_baked = function (d, r) { p.potato(d, r); line(d, 5, 9, 11, 9, [150, 108, 60]); set(d, 8, 7, [255, 226, 160]); };
    p.fish = function (d, r) {
      clear(d); disc(d, 9, 8, 3.6, [140, 168, 196]);
      line(d, 4, 5, 4, 11, [110, 138, 168]); line(d, 5, 6, 5, 10, [110, 138, 168]);
      set(d, 11, 7, [30, 30, 34]); line(d, 9, 5, 11, 4, [110, 138, 168]);
    };
    p.fish_cooked = function (d, r) { p.fish(d, r); for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 0) { d[i] = Math.min(255, d[i] * 1.3 + 40); d[i + 1] = d[i + 1] * 0.8 + 20; d[i + 2] *= 0.5; } };
    p.meat_raw = function (d, r) {
      clear(d); disc(d, 8, 8, 4.6, [226, 96, 100]); disc(d, 6, 7, 2, [244, 168, 170]);
      line(d, 11, 11, 13, 13, [226, 96, 100]);
    };
    p.meat_cooked = function (d, r) {
      clear(d); disc(d, 8, 8, 4.6, [166, 100, 56]); disc(d, 6, 7, 2, [206, 152, 96]);
      line(d, 11, 11, 13, 13, [166, 100, 56]); line(d, 5, 10, 10, 10, [124, 70, 38]);
    };
    p.stick = function (d, r) { clear(d); line(d, 4, 13, 11, 4, [140, 104, 64]); line(d, 5, 13, 12, 5, [104, 76, 46]); };
    p.coal_item = function (d, r) { clear(d); disc(d, 8, 8, 4, [46, 46, 50]); set(d, 6, 6, [90, 90, 96]); set(d, 9, 9, [24, 24, 26]); };
    p.iron_ingot = function (d, r) { ingot(d, [222, 222, 226], [178, 178, 184]); };
    p.gold_ingot = function (d, r) { ingot(d, [250, 216, 74], [212, 162, 30]); };
    p.diamond_gem = function (d, r) { gem(d, [110, 232, 222], [40, 180, 170]); };
    p.emerald_gem = function (d, r) { gem(d, [92, 220, 130], [36, 160, 82]); };
    p.ruby_gem = function (d, r) { gem(d, [240, 84, 96], [180, 40, 52]); };
    p.lazul_gem = function (d, r) { gem(d, [86, 118, 232], [42, 62, 170]); };
    p.string = function (d, r) { clear(d); line(d, 3, 3, 6, 8, [235, 235, 235]); line(d, 6, 8, 4, 12, [235, 235, 235]); line(d, 4, 12, 9, 14, [222, 222, 222]); line(d, 9, 14, 12, 9, [235, 235, 235]); };
    p.feather = function (d, r) {
      clear(d);
      line(d, 4, 13, 11, 3, [240, 240, 244]); line(d, 5, 13, 12, 4, [222, 224, 230]);
      line(d, 6, 12, 12, 5, [208, 210, 218]); line(d, 4, 14, 6, 12, [150, 150, 158]);
    };
    p.leather = function (d, r) { clear(d); disc(d, 8, 8, 4.4, [178, 108, 56]); rect(d, 5, 5, 6, 6, [178, 108, 56]); set(d, 6, 6, [206, 136, 78]); rect(d, 4, 8, 2, 3, [150, 88, 44]); };
    p.paper = function (d, r) { clear(d); rect(d, 4, 3, 8, 10, [244, 244, 240]); rect(d, 4, 3, 1, 10, [222, 222, 216]); rect(d, 11, 3, 1, 10, [210, 210, 204]); };
    p.book = function (d, r) {
      clear(d); rect(d, 4, 3, 9, 10, [150, 62, 54]); rect(d, 4, 3, 2, 10, [110, 44, 38]);
      rect(d, 6, 4, 6, 8, [240, 236, 226]); rect(d, 11, 4, 1, 8, [222, 218, 208]);
    };
    p.bone = function (d, r) {
      clear(d); line(d, 5, 11, 10, 6, [240, 240, 232]); line(d, 5, 10, 10, 5, [240, 240, 232]);
      disc(d, 4, 12, 1.4, [240, 240, 232]); disc(d, 6, 13, 1.4, [240, 240, 232]);
      disc(d, 10, 4, 1.4, [240, 240, 232]); disc(d, 12, 5, 1.4, [240, 240, 232]);
    };
    p.arrow = function (d, r) {
      clear(d); line(d, 3, 12, 11, 4, [140, 104, 64]);
      rect(d, 10, 3, 3, 3, [180, 180, 186]); set(d, 12, 3, [220, 220, 226]);
      line(d, 3, 12, 3, 9, [230, 230, 234]); line(d, 3, 12, 6, 12, [230, 230, 234]);
    };
    p.bow = function (d, r) {
      clear(d);
      line(d, 4, 2, 12, 2, [150, 110, 66]); line(d, 12, 2, 13, 8, [150, 110, 66]);
      line(d, 13, 8, 12, 13, [150, 110, 66]); line(d, 4, 13, 12, 13, [150, 110, 66]);
      line(d, 4, 2, 4, 13, [230, 230, 234]);
    };
    p.bucket = function (d, r) {
      clear(d);
      for (let i = 0; i < 7; i++) line(d, 4 + i * 0.35 | 0, 6 + i, 12 - i * 0.35 | 0, 6 + i, [198, 198, 204]);
      line(d, 4, 5, 12, 5, [230, 230, 236]);
      for (let a = 0; a < 16; a++) { const t = a / 15 * Math.PI; set(d, Math.round(8 + Math.cos(t) * 4), Math.round(4 - Math.sin(t) * 2.4), [160, 160, 166]); }
    };
    p.bucket_water = function (d, r) { p.bucket(d, r); rect(d, 5, 6, 7, 2, [58, 118, 205]); set(d, 6, 6, [120, 170, 235]); };
    p.shears = function (d, r) {
      clear(d); line(d, 4, 4, 10, 10, [210, 210, 216]); line(d, 11, 4, 5, 10, [186, 186, 192]);
      disc(d, 4, 12, 1.5, [150, 62, 54]); disc(d, 10, 12, 1.5, [150, 62, 54]);
    };
    p.clock_item = function (d, r) { clear(d); disc(d, 8, 8, 4.6, [250, 216, 74]); disc(d, 8, 8, 3, [110, 150, 220]); line(d, 8, 8, 8, 6, [30, 30, 34]); line(d, 8, 8, 10, 9, [30, 30, 34]); };
    p.compass_item = function (d, r) { clear(d); disc(d, 8, 8, 4.6, [190, 30, 30]); disc(d, 8, 8, 3, [236, 236, 240]); line(d, 8, 8, 8, 5, [200, 40, 40]); line(d, 8, 8, 8, 10, [70, 70, 80]); };
    function ingot(d, hi, lo) {
      clear(d);
      for (let i = 0; i < 4; i++) line(d, 5 - i * 0 + i, 6 + i, 11 + i, 6 + i, i === 0 ? hi : lo);
      line(d, 5, 6, 8, 4, hi); line(d, 8, 4, 14, 4, hi); line(d, 14, 4, 14, 8, lo); line(d, 11, 6, 14, 4, lo);
      rect(d, 6, 7, 9, 3, lo); rect(d, 6, 7, 8, 1, mx(hi, lo, 0.3));
    }
    function gem(d, hi, lo) {
      clear(d);
      const pts = [[8, 3], [12, 6], [11, 11], [5, 11], [4, 6]];
      for (let y = 3; y <= 12; y++) for (let x = 3; x <= 13; x++) {
        if (inPoly(x, y, pts)) set(d, x, y, (x + y) % 3 === 0 ? hi : mx(hi, lo, 0.5));
      }
      line(d, 8, 3, 4, 6, hi); line(d, 8, 3, 12, 6, hi);
      line(d, 5, 11, 11, 11, lo);
    }
    function inPoly(x, y, pts) {
      let c = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        if ((pts[i][1] > y) !== (pts[j][1] > y) &&
          x < (pts[j][0] - pts[i][0]) * (y - pts[i][1]) / (pts[j][1] - pts[i][1]) + pts[i][0]) c = !c;
      }
      return c;
    }
    return p;
  }

  /* ---------- 像素 → SVG ---------- */
  function pxToSvgRects(d, ox, oy) {
    let s = '';
    for (let y = 0; y < 16; y++) {
      let x = 0;
      while (x < 16) {
        const i = (y * 16 + x) * 4;
        const a = d[i + 3];
        if (a === 0) { x++; continue; }
        const r = d[i], g = d[i + 1], b = d[i + 2];
        let w = 1;
        while (x + w < 16) {
          const j = (y * 16 + x + w) * 4;
          if (d[j] !== r || d[j + 1] !== g || d[j + 2] !== b || d[j + 3] !== a) break;
          w++;
        }
        const hex = '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
        s += '<rect x="' + (ox + x) + '" y="' + (oy + y) + '" width="' + w + '" height="1" fill="' + hex + '"' +
          (a < 255 ? ' fill-opacity="' + (a / 255).toFixed(3) + '"' : '') + '/>';
        x += w;
      }
    }
    return s;
  }
  function svgWrap(inner, w, h) {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" shape-rendering="crispEdges">' + inner + '</svg>';
  }
  function svgURL(svg) { return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); }

  let painters = null, itemPainters = null;
  const tilePixels = {};
  const iconCache = {};

  function seedOf(name) { let s = 7; for (let i = 0; i < name.length; i++) s = (s * 131 + name.charCodeAt(i)) >>> 0; return s; }

  function paintTile(name) {
    if (tilePixels[name]) return tilePixels[name];
    const d = mk();
    const fn = painters[name];
    if (fn) fn(d, R(seedOf(name)));
    else rect(d, 0, 0, 16, 16, [255, 0, 255]);
    tilePixels[name] = d;
    return d;
  }

  /* ---------- 对外 API ---------- */
  return {
    init: function (G) {
      PAL = G.PAL;
      painters = makePainters(PAL);
      itemPainters = makeItemPainters();
      this.G = G;
    },
    // 构建 256x256 图集（一张大 SVG → canvas）
    buildAtlas: function (G) {
      const list = G.TILE_LIST;
      let inner = '';
      for (let i = 0; i < list.length; i++) {
        const d = paintTile(list[i]);
        inner += pxToSvgRects(d, (i & 15) * 16, (i >> 4) * 16);
      }
      const svg = svgWrap(inner, 256, 256);
      return new Promise(function (resolve, reject) {
        const img = new Image();
        img.onload = function () {
          const cv = document.createElement('canvas');
          cv.width = 256; cv.height = 256;
          const ctx = cv.getContext('2d');
          ctx.drawImage(img, 0, 0);
          resolve(cv);
        };
        img.onerror = function (e) { reject(new Error('atlas svg load fail')); };
        img.src = svgURL(svg);
      });
    },
    tileIcon: function (name) {
      const k = 't:' + name;
      if (!iconCache[k]) iconCache[k] = svgURL(svgWrap(pxToSvgRects(paintTile(name), 0, 0), 16, 16));
      return iconCache[k];
    },
    toolIcon: function (kind, mat) {
      const k = 'tool:' + kind + ':' + mat;
      if (!iconCache[k]) {
        const d = mk();
        for (let i = 0; i < d.length; i += 4) d[i + 3] = 0;
        paintTool(d, TOOL_TPL[kind], TOOL_MATS[mat]);
        iconCache[k] = svgURL(svgWrap(pxToSvgRects(d, 0, 0), 16, 16));
      }
      return iconCache[k];
    },
    itemIcon: function (name) {
      const k = 'i:' + name;
      if (!iconCache[k]) {
        const d = mk();
        const fn = itemPainters[name];
        if (fn) fn(d, R(seedOf(name)));
        iconCache[k] = svgURL(svgWrap(pxToSvgRects(d, 0, 0), 16, 16));
      }
      return iconCache[k];
    }
  };
})();
