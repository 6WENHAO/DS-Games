/* ============================================================
   POOLROOMS · textures.js
   程序化 PBR 贴图 v2:
   - 1024px 瓷砖:每砖随机微倾(lippage)/色差/暗砖混批/缝隙污渍
   - 粗糙度污渍与擦拭痕,让高光真实破碎
   - 马赛克 / 混凝土(带流挂痕)
   输出 map / normalMap / roughnessMap / aoMap(可平铺)
   ============================================================ */
window.PR = window.PR || {};
(function () {
  'use strict';

  function mulberry(seed) {
    let s = seed >>> 0;
    return function () {
      s |= 0; s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function makeTileNoise(cells, seed) {
    const rng = mulberry(seed);
    const lat = [];
    for (let i = 0; i < cells * cells; i++) lat.push(rng());
    const sm = t => t * t * (3 - 2 * t);
    return function (x, y) {
      x = x - Math.floor(x); y = y - Math.floor(y);
      const gx = x * cells, gy = y * cells;
      const x0 = Math.floor(gx) % cells, y0 = Math.floor(gy) % cells;
      const x1 = (x0 + 1) % cells, y1 = (y0 + 1) % cells;
      const fx = sm(gx - Math.floor(gx)), fy = sm(gy - Math.floor(gy));
      const a = lat[y0 * cells + x0], b = lat[y0 * cells + x1];
      const c = lat[y1 * cells + x0], d = lat[y1 * cells + x1];
      return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
    };
  }
  function fbmFactory(seed, octs) {
    const layers = [];
    for (let o = 0; o < octs; o++) layers.push(makeTileNoise(4 << o, seed + o * 131));
    return function (x, y) {
      let v = 0, amp = 1, tot = 0;
      for (let o = 0; o < octs; o++) { v += layers[o](x, y) * amp; tot += amp; amp *= 0.55; }
      return v / tot;
    };
  }

  function canv(size) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    return c;
  }

  function heightToNormal(hArr, size, strength) {
    const c = canv(size), ctx = c.getContext('2d');
    const img = ctx.createImageData(size, size);
    const d = img.data;
    const at = (x, y) => hArr[((y + size) % size) * size + ((x + size) % size)];
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      let nx = -dx, ny = -dy, nz = 1;
      const l = Math.sqrt(nx * nx + ny * ny + nz * nz);
      nx /= l; ny /= l; nz /= l;
      const o = (y * size + x) * 4;
      d[o] = (nx * 0.5 + 0.5) * 255;
      d[o + 1] = (ny * 0.5 + 0.5) * 255;
      d[o + 2] = (nz * 0.5 + 0.5) * 255;
      d[o + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  function toTex(canvas, srgb, aniso) {
    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (srgb) t.encoding = THREE.sRGBEncoding;
    t.anisotropy = aniso || 4;
    return t;
  }

  /* ================= 瓷砖 ================= */
  function buildTiles(size, seed, baseCol, groutCol, opts) {
    opts = opts || {};
    const N = opts.count || 4;
    const G = Math.max(2, Math.round(size * (opts.groutW || 0.011)));
    const rng = mulberry(seed);
    const fbm = fbmFactory(seed + 7, 4);
    const micro = fbmFactory(seed + 77, 5);
    const smudge = fbmFactory(seed + 177, 3);

    const cA = canv(size), aA = cA.getContext('2d');
    const cR = canv(size), aR = cR.getContext('2d');
    const cO = canv(size), aO = cO.getContext('2d');
    const H = new Float32Array(size * size);

    const iA = aA.createImageData(size, size);
    const iR = aR.createImageData(size, size);
    const iO = aO.createImageData(size, size);
    const T = size / N;
    const lip = opts.lippage != null ? opts.lippage : 0.55;

    const tiles = [];
    for (let i = 0; i < N * N; i++) {
      const dark = rng() < 0.07;                 // 混批中的深色砖
      tiles.push({
        b: (dark ? 0.78 : 0.94) + rng() * 0.12,
        hue: (rng() - 0.5) * 0.09,               // 冷暖偏移
        green: (rng() - 0.5) * 0.04,
        r: (dark ? 0.16 : 0.09) + rng() * 0.1,
        warp: rng() * 6.28,
        tx: (rng() - 0.5) * 2 * lip,             // 微倾:高度斜坡 = 恒定法线偏转
        tz: (rng() - 0.5) * 2 * lip
      });
    }

    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const txi = Math.floor(x / T), tyi = Math.floor(y / T);
      const tile = tiles[tyi * N + txi];
      const lx = x - txi * T, ly = y - tyi * T;
      const eD = Math.min(lx, ly, T - 1 - lx, T - 1 - ly);
      const inGrout = eD < G;
      const u = x / size, v = y / size;
      let h;
      const o = (y * size + x) * 4;
      if (inGrout) {
        h = 0.13 + micro(u, v) * 0.1;
        const g = 0.82 + micro(u * 3, v * 3) * 0.3;
        iA.data[o] = groutCol[0] * g;
        iA.data[o + 1] = groutCol[1] * g;
        iA.data[o + 2] = groutCol[2] * g;
        iR.data[o] = iR.data[o + 1] = iR.data[o + 2] = 208 + rng() * 30;
        iO.data[o] = iO.data[o + 1] = iO.data[o + 2] = 118;
      } else {
        const bevel = Math.min(1, (eD - G) / (G * 1.7));
        const wav = Math.sin((lx / T + tile.warp) * 3.1) * Math.sin((ly / T + tile.warp) * 2.7);
        h = 0.5 + bevel * 0.34 + wav * 0.03 + micro(u, v) * 0.05
          + tile.tx * (lx / T - 0.5) + tile.tz * (ly / T - 0.5);   // 微倾斜坡
        const n = fbm(u, v);
        const spec = micro(u * 2, v * 2);
        // 缝隙附近的污垢渐变
        const dirt = 1 - 0.16 * Math.exp(-(eD - G) / (G * 2.2));
        let br = tile.b * (0.93 + n * 0.11) * dirt + (spec > 0.74 ? 0.035 : 0);
        iA.data[o] = Math.min(255, baseCol[0] * br * (1 + tile.hue));
        iA.data[o + 1] = Math.min(255, baseCol[1] * br * (1 + tile.green));
        iA.data[o + 2] = Math.min(255, baseCol[2] * br * (1 - tile.hue * 0.9));
        // 粗糙度:基础 + 噪声 + 大块污渍 + 定向擦拭痕
        const blotch = smudge(u * 1.7 + 0.31, v * 1.7);
        const wipe = smudge(u * 0.6, v * 3.1 + 0.77);
        let rough = tile.r + n * 0.08
          + (blotch > 0.62 ? (blotch - 0.62) * 0.9 : 0)
          + (wipe > 0.7 ? 0.1 : 0)
          + (spec > 0.82 ? 0.14 : 0);
        iR.data[o] = iR.data[o + 1] = iR.data[o + 2] = Math.min(235, rough * 255);
        const edge = Math.min(1, (eD - G) / (G * 2.4));
        iO.data[o] = iO.data[o + 1] = iO.data[o + 2] = (0.8 + edge * 0.2) * 255;
      }
      H[y * size + x] = h;
      iA.data[o + 3] = iR.data[o + 3] = iO.data[o + 3] = 255;
    }
    aA.putImageData(iA, 0, 0);
    aR.putImageData(iR, 0, 0);
    aO.putImageData(iO, 0, 0);
    return {
      map: toTex(cA, true, 8),
      normalMap: toTex(heightToNormal(H, size, opts.nStr || 2.4), false, 8),
      roughnessMap: toTex(cR),
      aoMap: toTex(cO)
    };
  }

  /* ================= 混凝土(带流挂) ================= */
  function buildConcrete(size, seed) {
    const fbm = fbmFactory(seed, 5);
    const fine = fbmFactory(seed + 31, 6);
    const streakN = fbmFactory(seed + 91, 3);
    const rng = mulberry(seed);
    const cA = canv(size), aA = cA.getContext('2d');
    const cR = canv(size), aR = cR.getContext('2d');
    const iA = aA.createImageData(size, size);
    const iR = aR.createImageData(size, size);
    const H = new Float32Array(size * size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      const n = fbm(u, v);
      const f = fine(u, v);
      // 垂直流挂痕(水渍)
      const streak = streakN(u * 5, v * 0.35);
      const streakF = streak > 0.62 ? (streak - 0.62) * 1.6 : 0;
      const o = (y * size + x) * 4;
      let br = 165 + (n - 0.5) * 58 + (f - 0.5) * 26 - streakF * 46;
      if (rng() < 0.004) br -= 42;
      iA.data[o] = br * 0.985; iA.data[o + 1] = br; iA.data[o + 2] = br * 0.995; iA.data[o + 3] = 255;
      const rr = 152 + (f - 0.5) * 88 + n * 30 + streakF * 40;
      iR.data[o] = iR.data[o + 1] = iR.data[o + 2] = Math.min(245, rr); iR.data[o + 3] = 255;
      H[y * size + x] = n * 0.6 + f * 0.4;
    }
    aA.putImageData(iA, 0, 0);
    aR.putImageData(iR, 0, 0);
    return {
      map: toTex(cA, true),
      normalMap: toTex(heightToNormal(H, size, 1.5)),
      roughnessMap: toTex(cR),
      aoMap: null
    };
  }

  function buildWaterNormal(size, seed) {
    const fbm = fbmFactory(seed, 4);
    const H = new Float32Array(size * size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      const a = fbm(u, v);
      const b = fbm(v * 1.7 + 0.31, u * 0.6 + 0.77);
      H[y * size + x] = a * 0.65 + b * 0.35;
    }
    return toTex(heightToNormal(H, size, 2.0));
  }

  function buildSoftDot(size, inner, outer) {
    const c = canv(size), ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.02, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,255,255,' + inner + ')');
    g.addColorStop(0.55, 'rgba(255,255,255,' + outer + ')');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    return new THREE.CanvasTexture(c);
  }

  PR.buildTextures = function () {
    const T = {};
    T.tile = buildTiles(1024, 1201, [233, 238, 240], [142, 152, 154], { count: 4, nStr: 3.0, lippage: 0.6 });
    T.mosaic = buildTiles(1024, 7702, [92, 166, 184], [198, 212, 214], { count: 10, nStr: 2.0, lippage: 0.35, groutW: 0.008 });
    T.concrete = buildConcrete(512, 3303);
    T.waterN1 = buildWaterNormal(256, 9901);
    T.waterN2 = buildWaterNormal(256, 5507);
    T.macro = T.waterN1;
    T.softDot = buildSoftDot(128, 0.9, 0.35);
    PR.tex = T;
    return T;
  };
})();
