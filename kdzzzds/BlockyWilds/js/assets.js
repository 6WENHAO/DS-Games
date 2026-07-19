/* =========================================================
   assets.js — 全部可见美术资源均由 SVG 程序化生成（原创像素风）
   ========================================================= */
const Assets = (() => {

  /* ---------- 随机 ---------- */
  function mulberry(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- 颜色 ---------- */
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  function hex(c) {
    const h = n => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');
    return '#' + h(c[0]) + h(c[1]) + h(c[2]);
  }
  function shade(c, f) { return [c[0] * f, c[1] * f, c[2] * f, c[3] === undefined ? 1 : c[3]]; }
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, 1]; }

  /* ---------- 16×16 像素图 ---------- */
  function px16(fn) {
    const g = [];
    for (let y = 0; y < 16; y++) { const r = []; for (let x = 0; x < 16; x++) r.push(fn(x, y)); g.push(r); }
    return g;
  }
  // 像素图 → SVG（同行同色行程合并）
  function pixToSVG(px, size) {
    size = size || 16;
    let out = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="${size}" height="${size}" shape-rendering="crispEdges">`;
    for (let y = 0; y < 16; y++) {
      let x = 0;
      while (x < 16) {
        const c = px[y][x];
        if (!c) { x++; continue; }
        let x2 = x + 1;
        const key = hex(c) + '|' + (c[3] === undefined ? 1 : c[3]);
        while (x2 < 16 && px[y][x2] && (hex(px[y][x2]) + '|' + (px[y][x2][3] === undefined ? 1 : px[y][x2][3])) === key) x2++;
        const op = (c[3] !== undefined && c[3] < 1) ? ` fill-opacity="${c[3]}"` : '';
        out += `<rect x="${x}" y="${y}" width="${x2 - x}" height="1" fill="${hex(c)}"${op}/>`;
        x = x2;
      }
    }
    return out + '</svg>';
  }
  function pixGroup(px) { // 供图标复用：不含 <svg> 外壳
    let out = '';
    for (let y = 0; y < 16; y++) {
      let x = 0;
      while (x < 16) {
        const c = px[y][x];
        if (!c) { x++; continue; }
        let x2 = x + 1;
        const key = hex(c);
        while (x2 < 16 && px[y][x2] && hex(px[y][x2]) === key) x2++;
        out += `<rect x="${x}" y="${y}" width="${x2 - x}" height="1" fill="${key}"/>`;
        x = x2;
      }
    }
    return out;
  }

  /* ---------- 通用纹理生成 ---------- */
  function speckle(base, amp, seed, extra) {
    const rng = mulberry(seed);
    return px16(() => {
      let f = 1 - amp / 2 + rng() * amp;
      if (extra && rng() < extra.p) f *= extra.f;
      return shade(base, f);
    });
  }
  function voronoi(seedCount, seed, colorFn, edgeFn) {
    const rng = mulberry(seed);
    const pts = [];
    for (let i = 0; i < seedCount; i++) pts.push([rng() * 16, rng() * 16, rng()]);
    const nearest = (x, y) => {
      let bi = 0, bd = 1e9;
      for (let i = 0; i < pts.length; i++) {
        let dx = Math.abs(x - pts[i][0]), dy = Math.abs(y - pts[i][1]);
        if (dx > 8) dx = 16 - dx; if (dy > 8) dy = 16 - dy;
        const d = dx * dx + dy * dy;
        if (d < bd) { bd = d; bi = i; }
      }
      return bi;
    };
    return px16((x, y) => {
      const i = nearest(x, y);
      if (edgeFn && (nearest((x + 1) % 16, y) !== i || nearest(x, (y + 1) % 16) !== i)) return edgeFn(pts[i][2]);
      return colorFn(pts[i][2], x, y);
    });
  }

  /* ---------- 调色板（原创，MC 原版色调风格） ---------- */
  const C = {
    grass: [116, 186, 74], dirt: [134, 96, 67], stone: [126, 126, 126],
    sand: [219, 207, 163], redsand: [201, 116, 58], gravel: [136, 126, 122],
    bark: [102, 81, 50], barkL: [133, 106, 66], wood: [184, 148, 95],
    leaf: [58, 141, 55], water: [53, 97, 222], ice: [160, 200, 255],
    snow: [240, 246, 250], coal: [34, 34, 38], iron: [216, 175, 147],
    crystal: [64, 224, 255], crystalD: [20, 60, 84],
    ancient: [46, 61, 77], ancientM: [30, 40, 52], glow: [255, 216, 94],
    metal: [154, 164, 173], metalD: [60, 64, 70], hull: [196, 106, 58],
    basalt: [74, 74, 84], bedrock: [70, 70, 70], lampWood: [58, 44, 20],
  };

  /* ---------- 方块贴图生成器 ---------- */
  const TEXGEN = {
    grass_top: () => speckle(C.grass, 0.28, 11, { p: 0.08, f: 1.25 }),
    dirt: () => speckle(C.dirt, 0.3, 22, { p: 0.1, f: 0.72 }),
    grass_side: () => {
      const d = speckle(C.dirt, 0.3, 23, { p: 0.1, f: 0.72 });
      const rng = mulberry(31);
      for (let x = 0; x < 16; x++) {
        const depth = 2 + Math.floor(rng() * 3);
        for (let y = 0; y < depth; y++) d[y][x] = shade(C.grass, 0.8 + rng() * 0.35);
        if (rng() < 0.25 && depth < 5) d[depth][x] = shade(C.grass, 0.75);
      }
      return d;
    },
    stone: () => {
      const g = speckle(C.stone, 0.18, 41);
      const rng = mulberry(42);
      for (let i = 0; i < 6; i++) {
        const x = Math.floor(rng() * 14), y = Math.floor(rng() * 16), w = 2 + Math.floor(rng() * 2);
        for (let j = 0; j < w; j++) g[y][(x + j) % 16] = shade(C.stone, 0.78);
      }
      return g;
    },
    cobble: () => voronoi(7, 55, (v) => shade(C.stone, 0.8 + v * 0.35), () => shade(C.stone, 0.45)),
    sand: () => speckle(C.sand, 0.16, 66, { p: 0.06, f: 0.85 }),
    redsand: () => speckle(C.redsand, 0.2, 67, { p: 0.06, f: 0.82 }),
    gravel: () => voronoi(12, 77, (v) => mix(shade(C.gravel, 0.7 + v * 0.5), C.dirt, v * 0.3)),
    log_side: () => {
      const rng = mulberry(88);
      const stripes = []; for (let x = 0; x < 16; x++) stripes.push(0.75 + rng() * 0.5);
      return px16((x, y) => {
        let f = stripes[x];
        if (rng() < 0.04) f *= 0.7;
        return shade(x % 4 === 0 ? C.bark : C.barkL, f * (x % 4 === 0 ? 0.8 : 1));
      });
    },
    log_top: () => px16((x, y) => {
      const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
      const ring = Math.floor(d);
      if (ring >= 7) return shade(C.bark, 0.85);
      return shade(C.wood, ring % 2 === 0 ? 1.02 : 0.8);
    }),
    planks: () => {
      const rng = mulberry(99);
      const seams = [3, 9, 14, 6];
      return px16((x, y) => {
        const board = Math.floor(y / 4);
        if (y % 4 === 3) return shade(C.wood, 0.55);
        if (x === seams[board]) return shade(C.wood, 0.6);
        let f = 0.9 + ((board * 7) % 3) * 0.07;
        if (rng() < 0.08) f *= 0.85;
        return shade(C.wood, f);
      });
    },
    leaves: () => speckle(C.leaf, 0.5, 111, { p: 0.12, f: 0.55 }),
    glass: () => px16((x, y) => {
      if (x === 0 || y === 0 || x === 15 || y === 15) return [200, 220, 226];
      if ((x === 2 && y < 6) || (x === 3 && y >= 2 && y < 5) || (x + y === 20 && x > 8)) return [255, 255, 255, 0.6];
      return null;
    }),
    water: () => {
      const rng = mulberry(123);
      return px16((x, y) => {
        let f = 0.85 + rng() * 0.3;
        if ((y + ((x * 3) >> 2)) % 5 === 0) f *= 1.25;
        const c = shade(C.water, f); c[3] = 0.78; return c;
      });
    },
    ice: () => {
      const g = speckle(C.ice, 0.12, 130);
      const rng = mulberry(131);
      let x = 2, y = 15;
      while (y > 0) { g[y][clamp(x, 0, 15)] = [255, 255, 255]; y--; x += rng() < 0.5 ? 1 : 0; }
      return g;
    },
    snow: () => speckle(C.snow, 0.08, 140),
    coal_ore: () => oreTex(C.coal, 150),
    iron_ore: () => oreTex(C.iron, 160),
    crystal_ore: () => {
      const g = speckle([50, 58, 70], 0.2, 170);
      const rng = mulberry(171);
      for (let i = 0; i < 4; i++) {
        const x = 2 + Math.floor(rng() * 11), y = 2 + Math.floor(rng() * 11);
        g[y][x] = C.crystal.slice(); g[y + 1][x + 1] = shade(C.crystal, 0.7); g[y][x + 1] = [190, 250, 255];
      }
      return g;
    },
    crystal_block: () => {
      const rng = mulberry(180);
      return px16((x, y) => {
        const d = (x + y) % 8;
        if (d === 0) return [200, 252, 255];
        if (d < 3) return shade(C.crystal, 0.9 + rng() * 0.2);
        return mix(C.crystalD, C.crystal, 0.25 + rng() * 0.25);
      });
    },
    glowlamp: () => px16((x, y) => {
      if (x < 2 || y < 2 || x > 13 || y > 13) return shade(C.lampWood, 0.9 + ((x + y) % 3) * 0.1);
      const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
      return mix(C.glow, [255, 255, 230], 1 - d / 7);
    }),
    ancient_brick: () => {
      const rng = mulberry(190);
      return px16((x, y) => {
        const row = Math.floor(y / 4);
        const off = (row % 2) * 4;
        if (y % 4 === 3 || (x + off) % 8 === 7) return shade(C.ancientM, 0.9);
        if (rng() < 0.03) return mix(C.ancient, C.crystal, 0.55);
        return shade(C.ancient, 0.85 + rng() * 0.3);
      });
    },
    ancient_tablet: () => {
      const g = TEXGEN.ancient_brick();
      const spiral = [[7,4],[8,4],[9,5],[9,6],[9,7],[8,8],[7,8],[6,8],[5,7],[5,6],[5,5],[6,4],[7,6],[7,10],[7,11],[7,12],[4,11],[10,11]];
      for (const [x, y] of spiral) g[y][x] = C.crystal.slice();
      return g;
    },
    metal: () => {
      const g = speckle(C.metal, 0.1, 200);
      for (const [x, y] of [[1,1],[14,1],[1,14],[14,14]]) g[y][x] = shade(C.metal, 0.55);
      for (let x = 0; x < 16; x++) g[0][x] = shade(C.metal, 1.15);
      return g;
    },
    metal_dark: () => speckle(C.metalD, 0.15, 210),
    engine: () => px16((x, y) => {
      const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
      if (d > 5) return shade(C.metalD, 0.9 + ((x * y) % 3) * 0.08);
      if (d > 3) return [120, 60, 30];
      return mix([255, 140, 40], [255, 230, 160], 1 - d / 3);
    }),
    hull: () => {
      const rng = mulberry(220);
      return px16((x, y) => {
        if (y % 5 === 4) return shade(C.hull, 0.55);
        let f = 0.85 + rng() * 0.3;
        return shade(C.hull, f);
      });
    },
    launchpad: () => px16((x, y) => {
      if (y < 3) return ((x + y) % 4 < 2) ? [230, 190, 60] : [30, 30, 32];
      return shade(C.metalD, 0.85 + ((x * 7 + y * 13) % 5) * 0.06);
    }),
    basalt: () => {
      const rng = mulberry(230);
      const stripes = []; for (let x = 0; x < 16; x++) stripes.push(0.75 + rng() * 0.4);
      return px16((x, y) => {
        let f = stripes[x] * (x % 5 === 0 ? 0.7 : 1);
        if (rng() < 0.03) f *= 1.3;
        return shade(C.basalt, f);
      });
    },
    bedrock: () => voronoi(10, 240, (v) => shade(C.bedrock, 0.5 + v * 0.9)),
    chest_top: () => frameWood(250, 0.8),
    chest_side: () => {
      const g = frameWood(251, 0.85);
      for (let x = 0; x < 16; x++) { g[7][x] = shade(C.metalD, 1.1); }
      g[7][7] = C.glow.slice(); g[8][7] = shade(C.glow, 0.7); g[8][8] = shade(C.glow, 0.7); g[7][8] = C.glow.slice();
      return g;
    },
    table_top: () => {
      const g = TEXGEN.planks();
      for (let i = 0; i < 16; i++) { g[0][i] = shade(C.wood, 1.15); g[15][i] = shade(C.wood, 0.5); }
      for (let y = 3; y < 13; y++) for (let x = 3; x < 13; x++) if (x % 3 === 0 || y % 3 === 0) g[y][x] = shade(C.wood, 0.62);
      return g;
    },
    table_side: () => {
      const g = TEXGEN.planks();
      for (let x = 0; x < 16; x++) g[0][x] = shade(C.hull, 0.9);
      g[4][4] = shade(C.metalD, 1.2); g[5][4] = shade(C.metalD, 1.2); g[4][11] = C.iron.slice(); g[5][11] = shade(C.iron, 0.7);
      return g;
    },
    flame: () => {
      const rng = mulberry(260);
      return px16((x, y) => {
        const cx = Math.abs(x - 7.5), h = 15 - y;
        const w = 7 - h * 0.42 + (rng() - 0.5) * 2;
        if (cx > w) return null;
        if (cx < w - 3.5 && y > 8) return [255, 236, 160];
        if (cx < w - 1.6) return [255, 180, 40];
        return [235, 90, 20];
      });
    },
    signal_stone: () => { // 信号塔方块
      const g = speckle(C.metalD, 0.12, 270);
      for (let y = 2; y < 14; y += 3) for (let x = 3; x < 13; x++) g[y][x] = mix(C.metalD, C.crystal, 0.8);
      return g;
    },
    telescope: () => {
      const g = speckle([84, 66, 100], 0.15, 280);
      for (let y = 4; y < 12; y++) for (let x = 4; x < 12; x++) {
        const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
        g[y][x] = d < 2 ? [220, 240, 255] : [30, 24, 48];
      }
      return g;
    },
    crack1: () => crackTex(1), crack2: () => crackTex(2), crack3: () => crackTex(3),
  };

  function oreTex(oc, seed) {
    const g = speckle(C.stone, 0.18, seed);
    const rng = mulberry(seed + 1);
    for (let i = 0; i < 4; i++) {
      const x = 1 + Math.floor(rng() * 12), y = 1 + Math.floor(rng() * 12);
      g[y][x] = oc.slice(); g[y][x + 1] = shade(oc, 0.8); g[y + 1][x] = shade(oc, 0.75); 
      if (rng() < 0.6) g[y + 1][x + 1] = shade(oc, 0.9);
    }
    return g;
  }
  function frameWood(seed, f) {
    const rng = mulberry(seed);
    return px16((x, y) => {
      if (x === 0 || y === 0 || x === 15 || y === 15) return shade(C.bark, 0.9 + rng() * 0.2);
      return shade(C.wood, f * (0.85 + rng() * 0.25));
    });
  }
  function crackTex(level) {
    const rng = mulberry(300 + level);
    const g = px16(() => null);
    const branches = 2 + level * 2;
    for (let b = 0; b < branches; b++) {
      let x = 7 + Math.floor(rng() * 3) - 1, y = 7 + Math.floor(rng() * 3) - 1;
      const len = 3 + level * 3;
      for (let i = 0; i < len; i++) {
        if (x < 0 || y < 0 || x > 15 || y > 15) break;
        g[y][x] = [10, 10, 10, 0.65];
        const d = rng();
        if (d < 0.3) x++; else if (d < 0.6) x--; else if (d < 0.8) y++; else y--;
      }
    }
    return g;
  }

  /* ---------- 图集 ---------- */
  const TILE_NAMES = Object.keys(TEXGEN);
  const TILES = {}; TILE_NAMES.forEach((n, i) => TILES[n] = i);
  const ATLAS_COLS = 8, TILE = 16;
  const ATLAS_ROWS = Math.ceil(TILE_NAMES.length / ATLAS_COLS);
  const pixCache = {};
  function getPix(name) { if (!pixCache[name]) pixCache[name] = TEXGEN[name](); return pixCache[name]; }

  function svgToImage(svg) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => res(img);
      img.onerror = rej;
      img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
    });
  }

  let atlasCanvas = null;
  async function buildAtlas() {
    atlasCanvas = document.createElement('canvas');
    atlasCanvas.width = ATLAS_COLS * TILE; atlasCanvas.height = ATLAS_ROWS * TILE;
    const ctx = atlasCanvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    await Promise.all(TILE_NAMES.map(async (name, i) => {
      const img = await svgToImage(pixToSVG(getPix(name)));
      ctx.drawImage(img, (i % ATLAS_COLS) * TILE, Math.floor(i / ATLAS_COLS) * TILE);
    }));
    return atlasCanvas;
  }
  function tileUV(name) {
    const i = TILES[name];
    return [(i % ATLAS_COLS) / ATLAS_COLS, Math.floor(i / ATLAS_COLS) / ATLAS_ROWS, 1 / ATLAS_COLS, 1 / ATLAS_ROWS];
  }

  /* ---------- 等距方块图标（MC 物品栏立方体） ---------- */
  function isoIcon(topName, sideName, side2Name) {
    const top = pixGroup(getPix(topName));
    const left = pixGroup(getPix(sideName));
    const right = pixGroup(getPix(side2Name || sideName));
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="6 -2 28 28" shape-rendering="crispEdges">
      <g transform="matrix(0.625,0.3125,-0.625,0.3125,20,0)">${top}</g>
      <g transform="matrix(0.625,0.3125,0,0.75,10,5)">${left}<rect x="0" y="0" width="16" height="16" fill="#000" fill-opacity="0.22"/></g>
      <g transform="matrix(0.625,-0.3125,0,0.75,20,10)">${right}<rect x="0" y="0" width="16" height="16" fill="#000" fill-opacity="0.4"/></g>
    </svg>`;
  }
  function flatIcon(px) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges">${pixGroup(px)}</svg>`;
  }

  /* ---------- 手绘物品像素图标（原创） ---------- */
  function drawMap(rows, palette) {
    return px16((x, y) => {
      const ch = rows[y] ? rows[y][x] : ' ';
      return (ch && ch !== ' ' && palette[ch]) ? palette[ch].slice() : null;
    });
  }
  const IP = { // 图标调色板
    k: [40, 34, 30], w: [184, 148, 95], W: [214, 180, 128], s: [126, 126, 126], S: [160, 160, 160],
    o: [232, 150, 60], O: [255, 200, 120], r: [214, 70, 50], g: [110, 190, 90], b: [70, 140, 230],
    B: [160, 210, 255], c: [64, 224, 255], C: [180, 248, 255], y: [255, 216, 94], Y: [255, 240, 180],
    m: [200, 205, 215], M: [240, 244, 250], d: [90, 96, 105], p: [250, 240, 230], i: [216, 175, 147],
    e: [34, 34, 38], t: [130, 104, 66],
  };
  const ITEM_MAPS = {
    pickaxe_wood: ['      kkkkk     ','    kkwwwwwkk   ','   kwwk   kwwk  ','  kwk      kwk  ','  kk   kk   kk  ','       kwk      ','      kwk       ','      kwk       ','     kwk        ','     kwk        ','    kwk         ','    kwk         ','   kwk          ','   kwk          ','  kwk           ','   k            '],
    pickaxe_stone: ['      kkkkk     ','    kkssssskk   ','   kssk   kssk  ','  ksk      ksk  ','  kk   kk   kk  ','       kwk      ','      kwk       ','      kwk       ','     kwk        ','     kwk        ','    kwk         ','    kwk         ','   kwk          ','   kwk          ','  kwk           ','   k            '],
    stick: ['                ','                ','            k   ','           kwk  ','          kwk   ','         kwk    ','        kwk     ','       kwk      ','      kwk       ','     kwk        ','    kwk         ','   kwk          ','  kwk           ','  kk            ','                ','                '],
    suit: ['     kkkkkk     ','    kMMMMMMk    ','   kMBBBBBBMk   ','   kMBeeeeBMk   ','   kMBBBBBBMk   ','    kMMMMMMk    ','  kkkoooooookk  ',' kokoOOOOOOokok ',' kok kooook kok ',' kok koooook kok','  k  koooook k  ','     kok kok    ','     kok kok    ','     kok kok    ','    kook kook   ','                '],
    scope: ['                ','            kkk ','          kkCCk ','        kkccCk  ','      kkcccck   ','    kkccccck    ','   kdccccck     ','  kdddccck      ','  kdddkck       ','  kddddk        ','   kddk         ','   kdk          ','  kdk           ',' kdk            ',' kk             ','                '],
    translator: ['                ','  kkkkkkkkkkkk  ',' kddddddddddddk ',' kdCCCCCCCCCCdk ',' kdCc c cc cCdk ',' kdC cc c c CDk ',' kdCc c cc cCdk ',' kdCCCCCCCCCCdk ',' kddddddddddddk ',' kdyyk    kyydk ',' kddddddddddddk ','  kkkkkkkkkkkk  ','      kddk      ','      kddk      ','     kddddk     ','                '],
    codes: ['   kkkkkkkkkk   ','  kppppppppppk  ','  kpkkkk kkkpk  ','  kppppppppppk  ','  kpkkkkkkk pk  ','  kppppppppppk  ','  kpkkk kkkkpk  ','  kppppppppppk  ','  kprrrrrrrrpk  ','  kprkkkkkkrpk  ','  kprkyyyykrpk  ','  kprkkkkkkrpk  ','  kprrrrrrrrpk  ','  kppppppppppk  ','   kkkkkkkkkk   ','                '],
    marshmallow: ['                ','                ','     kkkkk      ','    kMMMMMk     ','   kMMMMMMWk    ','   kMMMMMMMk    ','   kWMMMMMWk    ','    kWWWWWk     ','     kkkkk      ','      kwk       ','      kwk       ','       kwk      ','       kwk      ','        kwk     ','        kk      ','                '],
    marshmallow_r: ['                ','                ','     kkkkk      ','    kOOOOOk     ','   kOooooOWk    ','   kOoOOooOk    ','   kWoOOooOk    ','    kWooook     ','     kkkkk      ','      kwk       ','      kwk       ','       kwk      ','       kwk      ','        kwk     ','        kk      ','                '],
    coal: ['                ','                ','     kkkk       ','   kkeeeekk     ','  keeeekeeek    ','  keekeeeeeek   ',' keeeeeekeeek   ',' keekeeeeeeeek  ',' keeeeeekeeeek  ',' keeekeeeeeeek  ','  keeeeeekeek   ','  keekeeeeek    ','   kkeeeekk     ','     kkkk       ','                ','                '],
    iron_ingot: ['                ','                ','                ','                ','      kkkkkkkk  ','     kMmmmmmmmk ','    kMmmmmmmmk  ','   kMmmmmmmmk   ','  kmmmmmmmmk    ','  kkkkkkkkk     ','                ','                ','                ','                ','                ','                '],
    crystal_shard: ['                ','       kk       ','      kCck      ','      kCck      ','     kCccck     ','     kCccck     ','    kCccccck    ','    kCccccck    ','   kCccccccck   ','   kCcccccccx   ','   kccccccccx   ','    kccccccx    ','     kccccx     ','      kccx      ','       kx       ','                '].map(r=>r.replace(/x/g,'k')),
    fuel_can: ['                ','    kkkkk       ','   kdok dk      ','  kkkkkkkkkk    ','  koooooooook   ','  koyyyyyyook   ','  koykkkkkyok   ','  koyk fuelyok  ','  koykkkkkyok   ','  koyyyyyyook   ','  koooooooook   ','  koooooooook   ','  kkkkkkkkkkk   ','                ','                ','                '].map(r=>r.replace(/fuel/g,'yyyy')),
    heart_item: ['                ','                ','  krrk   krrk   ',' krrrrk krrrrk  ',' krrrrrkrrrrrk  ',' krrrrrrrrrrrk  ','  krrrrrrrrrk   ','   krrrrrrrk    ','    krrrrrk     ','     krrrk      ','      krk       ','       k        ','                ','                ','                ','                '],
  };
  const iconCache = {};
  function itemIcon(id) {
    if (iconCache[id]) return iconCache[id];
    let svg;
    if (ITEM_MAPS[id]) svg = flatIcon(drawMap(ITEM_MAPS[id], IP));
    else svg = flatIcon(px16(() => [255, 0, 255]));
    iconCache[id] = svg; return svg;
  }

  /* ---------- UI 大图 ---------- */
  function starsSVG(w, h, n, seed) {
    const rng = mulberry(seed);
    let s = '';
    for (let i = 0; i < n; i++) {
      const x = Math.floor(rng() * w), y = Math.floor(rng() * h), sz = rng() < 0.85 ? 2 : 3;
      const o = 0.3 + rng() * 0.7;
      s += `<rect x="${x}" y="${y}" width="${sz}" height="${sz}" fill="#fff" opacity="${o.toFixed(2)}">`;
      if (rng() < 0.3) s += `<animate attributeName="opacity" values="${o.toFixed(2)};0.1;${o.toFixed(2)}" dur="${(2 + rng() * 4).toFixed(1)}s" repeatCount="indefinite"/>`;
      s += `</rect>`;
    }
    return s;
  }

  function menuSkySVG() {
    let planets = '';
    // 像素星球剪影
    const defs = [
      { x: 640, y: 140, r: 46, c1: '#74ba4a', c2: '#4a8a34' },
      { x: 170, y: 300, r: 30, c1: '#c97440', c2: '#9c5228' },
      { x: 820, y: 420, r: 24, c1: '#40e0ff', c2: '#1a7a9c' },
    ];
    for (const p of defs) {
      let cells = '';
      const rng = mulberry(p.x);
      const st = Math.max(4, Math.floor(p.r / 6));
      for (let y = -p.r; y < p.r; y += st) for (let x = -p.r; x < p.r; x += st) {
        if (x * x + y * y > p.r * p.r) continue;
        const lit = (x - y) < p.r * 0.2;
        cells += `<rect x="${p.x + x}" y="${p.y + y}" width="${st}" height="${st}" fill="${lit ? p.c1 : p.c2}" opacity="${0.85 + rng() * 0.15}"/>`;
      }
      planets += cells;
    }
    // 太阳
    let sun = `<g><rect x="440" y="60" width="56" height="56" fill="#ffdf8a"/><rect x="452" y="72" width="32" height="32" fill="#fff6d8"/>
      <rect x="424" y="76" width="12" height="24" fill="#ffb84a" opacity="0.8"/><rect x="500" y="76" width="12" height="24" fill="#ffb84a" opacity="0.8"/>
      <rect x="456" y="44" width="24" height="12" fill="#ffb84a" opacity="0.8"/><rect x="456" y="120" width="24" height="12" fill="#ffb84a" opacity="0.8"/>
      <animateTransform attributeName="transform" type="scale" values="1;1.04;1" additive="sum" dur="3s" repeatCount="indefinite"/></g>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 640" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" shape-rendering="crispEdges">
      <defs><linearGradient id="mg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#04050e"/><stop offset="0.7" stop-color="#0a0d22"/><stop offset="1" stop-color="#141c3a"/>
      </linearGradient></defs>
      <rect width="960" height="640" fill="url(#mg)"/>
      ${starsSVG(960, 640, 240, 7)}${planets}${sun}
    </svg>`;
  }

  function logoSVG() {
    const t = '方块拓荒';
    let letters = '';
    const colors = ['#8ad04e', '#c98544', '#9aa4ad', '#40e0ff'];
    for (let i = 0; i < 4; i++) {
      const x = 95 + i * 150;
      letters += `<g>
        <text x="${x + 6}" y="106" font-size="120" font-weight="900" font-family="'Microsoft YaHei',sans-serif" text-anchor="middle" fill="#000" opacity="0.9">${t[i]}</text>
        <text x="${x}" y="100" font-size="120" font-weight="900" font-family="'Microsoft YaHei',sans-serif" text-anchor="middle" fill="${colors[i]}" stroke="#1a1a1a" stroke-width="3">${t[i]}</text>
        <text x="${x - 2}" y="98" font-size="120" font-weight="900" font-family="'Microsoft YaHei',sans-serif" text-anchor="middle" fill="#fff" opacity="0.18">${t[i]}</text>
      </g>`;
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 760 170">
      ${letters}
      <text x="380" y="152" font-size="26" letter-spacing="14" font-family="'Courier New',monospace" font-weight="bold" text-anchor="middle" fill="#ffd85e" stroke="#000" stroke-width="1">B L O C K Y   W I L D S</text>
      <text x="380" y="30" font-size="15" letter-spacing="6" font-family="'Microsoft YaHei',sans-serif" text-anchor="middle" fill="#8a8fb0">— 二 十 二 分 钟 的 宇 宙 —</text>
    </svg>`;
  }

  function heartSVG(state) { // full | half | empty
    const on = state !== 'empty';
    const half = state === 'half';
    const px = drawMap(ITEM_MAPS.heart_item, IP);
    let body = '';
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const c = px[y][x]; if (!c) continue;
      let fill = hex(c);
      if (!on) fill = '#3a3a40';
      else if (half && x >= 8) fill = '#3a3a40';
      else if (hex(c) === '#d64632') fill = '#e8402e';
      body += `<rect x="${x}" y="${y}" width="1" height="1" fill="${fill}"/>`;
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 1 16 12" shape-rendering="crispEdges">${body}</svg>`;
  }

  const oxySVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges">
    <rect x="4" y="2" width="8" height="2" fill="#dfefff"/><rect x="3" y="4" width="10" height="9" fill="#3d9be9"/>
    <rect x="5" y="6" width="3" height="3" fill="#bfe4ff"/><rect x="4" y="13" width="8" height="1" fill="#1a5a96"/></svg>`;
  const fuelSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges">
    <rect x="6" y="1" width="4" height="2" fill="#888"/><rect x="4" y="3" width="8" height="11" fill="#e98a2b"/>
    <rect x="6" y="5" width="4" height="5" fill="#ffd27a"/><rect x="4" y="14" width="8" height="1" fill="#7a4210"/></svg>`;
  const sunIconSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges">
    <rect x="4" y="4" width="8" height="8" fill="#ffdf8a"/><rect x="6" y="6" width="4" height="4" fill="#fff6d8"/>
    <rect x="1" y="6" width="2" height="4" fill="#ffb84a"/><rect x="13" y="6" width="2" height="4" fill="#ffb84a"/>
    <rect x="6" y="1" width="4" height="2" fill="#ffb84a"/><rect x="6" y="13" width="4" height="2" fill="#ffb84a"/></svg>`;

  /* ---------- 太阳 / 星点 大纹理 ---------- */
  function sunTexSVG(red) { // red: 0~1 红巨星程度
    const core = red > 0.5 ? '#fff0e0' : '#fff6d8';
    const mid = mixHex('#ffdf8a', '#ff7a50', red);
    const edge = mixHex('#ffb84a', '#d43a20', red);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="128" height="128" shape-rendering="crispEdges">
      <rect x="6" y="6" width="20" height="20" fill="${edge}"/>
      <rect x="9" y="9" width="14" height="14" fill="${mid}"/>
      <rect x="12" y="12" width="8" height="8" fill="${core}"/>
      <rect x="0" y="12" width="6" height="8" fill="${edge}" opacity="0.55"/><rect x="26" y="12" width="6" height="8" fill="${edge}" opacity="0.55"/>
      <rect x="12" y="0" width="8" height="6" fill="${edge}" opacity="0.55"/><rect x="12" y="26" width="8" height="6" fill="${edge}" opacity="0.55"/>
      <rect x="3" y="3" width="5" height="5" fill="${edge}" opacity="0.35"/><rect x="24" y="3" width="5" height="5" fill="${edge}" opacity="0.35"/>
      <rect x="3" y="24" width="5" height="5" fill="${edge}" opacity="0.35"/><rect x="24" y="24" width="5" height="5" fill="${edge}" opacity="0.35"/>
    </svg>`;
  }
  function mixHex(a, b, t) {
    const pa = [parseInt(a.slice(1, 3), 16), parseInt(a.slice(3, 5), 16), parseInt(a.slice(5, 7), 16)];
    const pb = [parseInt(b.slice(1, 3), 16), parseInt(b.slice(3, 5), 16), parseInt(b.slice(5, 7), 16)];
    return hex(mix(pa, pb, t));
  }
  const starDotSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8" width="16" height="16" shape-rendering="crispEdges">
    <rect x="3" y="3" width="2" height="2" fill="#fff"/><rect x="2" y="3" width="1" height="2" fill="#fff" opacity="0.5"/>
    <rect x="5" y="3" width="1" height="2" fill="#fff" opacity="0.5"/><rect x="3" y="2" width="2" height="1" fill="#fff" opacity="0.5"/>
    <rect x="3" y="5" width="2" height="1" fill="#fff" opacity="0.5"/></svg>`;

  /* ---------- 驾驶舱 ---------- */
  function cockpitSVG() {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" width="100%" height="100%" preserveAspectRatio="none">
      <defs><pattern id="mtl" width="8" height="8" patternUnits="userSpaceOnUse">
        <rect width="8" height="8" fill="#3c4046"/><rect width="8" height="1" fill="#4a4f56"/><rect y="7" width="8" height="1" fill="#2c2f34"/>
      </pattern></defs>
      <polygon points="0,0 240,0 60,900 0,900" fill="url(#mtl)" stroke="#17181c" stroke-width="6"/>
      <polygon points="1600,0 1360,0 1540,900 1600,900" fill="url(#mtl)" stroke="#17181c" stroke-width="6"/>
      <polygon points="0,0 1600,0 1600,70 0,70" fill="url(#mtl)" stroke="#17181c" stroke-width="6"/>
      <polygon points="60,900 1540,900 1600,900 1600,760 1380,700 220,700 0,760 0,900" fill="url(#mtl)" stroke="#17181c" stroke-width="6"/>
      <rect x="260" y="726" width="1080" height="150" fill="#23252a" stroke="#0e0f12" stroke-width="4"/>
      <rect x="290" y="750" width="180" height="90" fill="#0d1a12" stroke="#000" stroke-width="3"/>
      <text x="380" y="790" font-family="'Courier New',monospace" font-size="24" fill="#8affc1" text-anchor="middle">ALT</text>
      <rect x="500" y="750" width="180" height="90" fill="#101321" stroke="#000" stroke-width="3"/>
      <text x="590" y="790" font-family="'Courier New',monospace" font-size="24" fill="#9fd8ff" text-anchor="middle">NAV</text>
      <rect x="920" y="750" width="180" height="90" fill="#1f1208" stroke="#000" stroke-width="3"/>
      <text x="1010" y="790" font-family="'Courier New',monospace" font-size="24" fill="#ffd27a" text-anchor="middle">FUEL</text>
      <rect x="1130" y="750" width="180" height="90" fill="#170b1d" stroke="#000" stroke-width="3"/>
      <text x="1220" y="790" font-family="'Courier New',monospace" font-size="24" fill="#d8a5ff" text-anchor="middle">O2</text>
      <g>
        <rect x="740" y="746" width="120" height="98" fill="#111" stroke="#000" stroke-width="3"/>
        <rect x="786" y="766" width="28" height="58" fill="#e8402e"><animate attributeName="fill" values="#e8402e;#8a1a10;#e8402e" dur="1.2s" repeatCount="indefinite"/></rect>
      </g>
      ${[0,1,2,3,4,5,6].map(i=>`<rect x="${300+i*160}" y="712" width="10" height="8" fill="${i%2?'#8affc1':'#ffd27a'}"><animate attributeName="opacity" values="1;0.2;1" dur="${(1+i*0.3).toFixed(1)}s" repeatCount="indefinite"/></rect>`).join('')}
      <polygon points="240,0 1360,0 1340,70 260,70" fill="none"/>
      <line x1="800" y1="0" x2="800" y2="70" stroke="#17181c" stroke-width="10"/>
    </svg>`;
  }

  /* ---------- NPC 头像与皮肤 ---------- */
  function faceMap(hairC, skinC, beard, brow) {
    return px16((x, y) => {
      if (y < 3 || (y < 5 && (x < 3 || x > 12))) return hairC;
      if (brow && y === 5 && x >= 3 && x <= 12 && x !== 7 && x !== 8) return hairC;
      if (y >= 6 && y <= 7 && (x === 4 || x === 5 || x === 10 || x === 11)) return [255, 255, 255];
      if (y === 7 && (x === 5 || x === 11)) return [30, 60, 40];
      if (beard && y > 10 && x > 2 && x < 13) return shade(hairC, 1.2);
      if (y === 11 && x >= 6 && x <= 9) return shade(skinC, 0.75);
      if (y >= 9 && y <= 10 && x >= 7 && x <= 8) return shade(skinC, 0.88);
      return skinC.slice();
    });
  }
  const NPCS = {
    elder:    { name: '长者·灰木', hair: [168, 168, 172], skin: [224, 178, 132], beard: true,  cloth: [92, 70, 46] },
    curator:  { name: '管理员·蕨', hair: [110, 70, 40],  skin: [238, 192, 148], beard: false, cloth: [58, 96, 64] },
    astronomer: { name: '天文学家·霍恩', hair: [50, 46, 44], skin: [210, 165, 120], beard: false, cloth: [50, 60, 96] },
  };
  function npcFacePix(id) {
    const n = NPCS[id];
    return faceMap(n.hair, n.skin, n.beard, true);
  }
  function portraitSVG(id) {
    return flatIcon(npcFacePix(id));
  }
  function npcClothPix(id) {
    const n = NPCS[id];
    return speckle(n.cloth, 0.2, id.length * 37 + 5);
  }

  /* ---------- 古族字符 ---------- */
  function glyphSVG(seed) {
    const rng = mulberry(seed * 971 + 13);
    let d = '', x = 2 + Math.floor(rng() * 4) * 2, y = 2 + Math.floor(rng() * 4) * 2;
    d = `M${x} ${y}`;
    const steps = 5 + Math.floor(rng() * 5);
    for (let i = 0; i < steps; i++) {
      const dir = Math.floor(rng() * 4);
      const len = 2 + Math.floor(rng() * 3) * 2;
      if (dir === 0) x = clamp(x + len, 1, 13); else if (dir === 1) x = clamp(x - len, 1, 13);
      else if (dir === 2) y = clamp(y + len, 1, 13); else y = clamp(y - len, 1, 13);
      d += ` L${x} ${y}`;
    }
    const dot = rng() < 0.6 ? `<rect x="${2 + Math.floor(rng() * 10)}" y="${2 + Math.floor(rng() * 10)}" width="2" height="2" fill="#9ff0ff"/>` : '';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 14 14" class="glyph">
      <path d="${d}" fill="none" stroke="#35e0ff" stroke-width="1.6" stroke-linecap="square"/>${dot}</svg>`;
  }

  /* ---------- 篝火（结局/菜单动画） ---------- */
  function campfireSVG() {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" shape-rendering="crispEdges">
      <rect x="4" y="24" width="24" height="3" fill="#665132"/>
      <rect x="6" y="21" width="20" height="3" fill="#856a42" transform="rotate(6 16 22)"/>
      <g>
        <rect x="12" y="10" width="8" height="12" fill="#eb5a14"><animate attributeName="height" values="12;14;11;12" dur="0.9s" repeatCount="indefinite"/></rect>
        <rect x="14" y="13" width="4" height="9" fill="#ffb428"><animate attributeName="height" values="9;11;8;9" dur="0.7s" repeatCount="indefinite"/></rect>
        <rect x="15" y="17" width="2" height="5" fill="#ffeca0"/>
        <rect x="10" y="15" width="3" height="6" fill="#eb5a14" opacity="0.85"><animate attributeName="opacity" values="0.85;0.3;0.85" dur="1.1s" repeatCount="indefinite"/></rect>
        <rect x="20" y="14" width="3" height="7" fill="#eb5a14" opacity="0.85"><animate attributeName="opacity" values="0.85;0.4;0.85" dur="1.3s" repeatCount="indefinite"/></rect>
        <rect x="15" y="6" width="2" height="2" fill="#ffb428" opacity="0.8"><animate attributeName="y" values="8;4;8" dur="1.6s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.8;0;0.8" dur="1.6s" repeatCount="indefinite"/></rect>
      </g>
    </svg>`;
  }

  /* ---------- 信号镜界面 ---------- */
  function scopeOverlaySVG() {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" width="100%" height="100%" preserveAspectRatio="none">
      <rect width="1600" height="900" fill="#000" opacity="0.35"/>
      <circle cx="800" cy="450" r="330" fill="none" stroke="#8affc1" stroke-width="3" opacity="0.7"/>
      <circle cx="800" cy="450" r="333" fill="none" stroke="#000" stroke-width="4" opacity="0.6"/>
      <line x1="800" y1="90" x2="800" y2="140" stroke="#8affc1" stroke-width="3"/>
      <line x1="800" y1="760" x2="800" y2="810" stroke="#8affc1" stroke-width="3"/>
      <line x1="440" y1="450" x2="490" y2="450" stroke="#8affc1" stroke-width="3"/>
      <line x1="1110" y1="450" x2="1160" y2="450" stroke="#8affc1" stroke-width="3"/>
      <rect x="640" y="70" width="320" height="34" fill="#0a140e" stroke="#8affc1" stroke-width="2"/>
    </svg>`;
  }

  return {
    TILES, TILE_NAMES, ATLAS_COLS, ATLAS_ROWS,
    buildAtlas, tileUV, get atlasCanvas() { return atlasCanvas; },
    svgToImage, pixToSVG, getPix,
    makePix: (color, amp, seed) => speckle(color, amp, seed),
    isoIcon, itemIcon, flatIcon,
    npcFacePix, npcClothPix, NPCS, portraitSVG,
    ui: {
      menuSky: menuSkySVG, logo: logoSVG, heart: heartSVG,
      oxy: oxySVG, fuel: fuelSVG, sunIcon: sunIconSVG,
      cockpit: cockpitSVG, glyph: glyphSVG, campfire: campfireSVG,
      sunTex: sunTexSVG, starDot: starDotSVG, scopeOverlay: scopeOverlaySVG,
      stars: starsSVG,
    },
  };
})();
