// ============ 程序化 PBR 贴图 (ImageData 高速版) ============
const Tex = (() => {
  const cache = {};

  function canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }
  function toTex(c, repeat = [1, 1], srgb = false) {
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
    t.anisotropy = 16;
    if (srgb) t.encoding = THREE.sRGBEncoding;
    return t;
  }
  function rnd(seed) {
    let s = seed;
    return () => (s = (s * 16807 + 12345) % 2147483647) / 2147483647;
  }

  // 值噪声 (平滑)
  function makeValueNoise(size, cells, seed) {
    const r = rnd(seed);
    const g = new Float32Array((cells + 1) * (cells + 1));
    for (let i = 0; i < g.length; i++) g[i] = r();
    const sm = t => t * t * (3 - 2 * t);
    return (x, y) => {
      const fx = (x / size) * cells, fy = (y / size) * cells;
      const ix = Math.floor(fx), iy = Math.floor(fy);
      const tx = sm(fx - ix), ty = sm(fy - iy);
      const i0 = ix % (cells + 1), i1 = (ix + 1) % (cells + 1);
      const j0 = (iy % (cells + 1)) * (cells + 1), j1 = ((iy + 1) % (cells + 1)) * (cells + 1);
      const a = g[j0 + i0], b = g[j0 + i1], c2 = g[j1 + i0], d = g[j1 + i1];
      return a + (b - a) * tx + (c2 - a) * ty + (a - b - c2 + d) * tx * ty;
    };
  }

  // 通用: 按函数填充 ImageData
  function fillImage(size, fn) {
    const c = canvas(size, size), ctx = c.getContext('2d');
    const img = ctx.createImageData(size, size);
    const d = img.data;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const [r, g, b] = fn(x, y);
      d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // 高度图 → 法线贴图
  function heightToNormal(hf, size, strength = 2) {
    return fillImage(size, (x, y) => {
      const l = hf((x - 1 + size) % size, y), rr = hf((x + 1) % size, y);
      const u = hf(x, (y - 1 + size) % size), dd = hf(x, (y + 1) % size);
      let nx = (l - rr) * strength, ny = (u - dd) * strength, nz = 1;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
      return [(nx / len * 0.5 + 0.5) * 255, (ny / len * 0.5 + 0.5) * 255, (nz / len * 0.5 + 0.5) * 255];
    });
  }

  // ---------- 瓷砖组 ----------
  const TILE_N = 8, TSIZE = 512;
  // 每砖随机微倾斜 (贴砖不完美 → 反光角度差异)
  const tiltR = rnd(881);
  const tilts = [];
  for (let i = 0; i < TILE_N * TILE_N; i++) tilts.push([(tiltR() - 0.5) * 0.14, (tiltR() - 0.5) * 0.14]);

  // 釉面砖高度: 平釉面 + 圆润倒角 + 微倾斜
  function tileHeight(x, y) {
    const cell = TSIZE / TILE_N;
    const lx = x % cell, ly = y % cell;
    const gw = 4;
    if (lx < gw || ly < gw) return 0;
    const bx = (lx - gw) / (cell - gw), by = (ly - gw) / (cell - gw);
    const ti = Math.floor(y / cell) * TILE_N + Math.floor(x / cell);
    const [tx, ty] = tilts[ti % tilts.length];
    // 距边缘距离 → 倒角轮廓 (edge 0..0.5)
    const edge = Math.min(bx, 1 - bx, by, 1 - by);
    const t = Math.min(1, edge / 0.14);
    const bevel = t * t * (3 - 2 * t);          // smoothstep 圆角
    const dome = Math.sin(bx * Math.PI) * Math.sin(by * Math.PI); // 极轻微鼓面
    return 0.25 + bevel * 0.62 + dome * 0.06 + (bx - 0.5) * tx + (by - 0.5) * ty;
  }

  function tileAlbedo(tint = [0.92, 0.97, 0.99]) {
    const noise = makeValueNoise(TSIZE, 24, 5);
    const speck = makeValueNoise(TSIZE, 96, 6);
    const cell = TSIZE / TILE_N;
    // 每砖亮度 + 微色相偏移 (青/蓝釉色差)
    const r = rnd(77);
    const bright = [], hueR = [], hueB = [];
    for (let i = 0; i < TILE_N * TILE_N; i++) {
      bright.push(0.93 + r() * 0.09);
      hueR.push((r() - 0.5) * 0.055);           // 红通道偏移 → 偏青/偏暖
      hueB.push((r() - 0.5) * 0.04);
    }
    return fillImage(TSIZE, (x, y) => {
      const h = tileHeight(x, y);
      if (h < 0.1) {
        // 沟缝: 灰浆 + 污渍变化
        const g = 96 + noise(x, y) * 34 + speck(x, y) * 10;
        return [g, g * 1.02, g * 1.03];
      }
      const ti = Math.floor(y / cell) * TILE_N + Math.floor(x / cell);
      // 釉下颜色流动 + 细小斑点
      const flow = noise(x * 2 % TSIZE, y * 2 % TSIZE);
      const sp = speck(x, y) > 0.82 ? -8 : 0;
      const b = bright[ti] * (0.965 + flow * 0.05);
      // 倒角边缘微亮 (釉水堆积高光感)
      const edgeGlow = h > 0.3 && h < 0.72 ? 6 : 0;
      return [
        (235 * (tint[0] + hueR[ti]) * b) + sp + edgeGlow,
        (243 * tint[1] * b) + sp + edgeGlow,
        (248 * (tint[2] + hueB[ti]) * b) + sp + edgeGlow,
      ];
    });
  }

  function tileNormal() { return heightToNormal(tileHeight, TSIZE, 7); }

  function tileRoughness() {
    const noise = makeValueNoise(TSIZE, 20, 9);
    const wear = makeValueNoise(TSIZE, 6, 14);
    return fillImage(TSIZE, (x, y) => {
      const h = tileHeight(x, y);
      let rough;
      if (h < 0.1) rough = 0.9;                              // 沟缝哑光
      else {
        rough = 0.035 + noise(x, y) * 0.07;                  // 镜面釉
        if (h < 0.62) rough += 0.1;                          // 倒角带略糙
        if (wear(x, y) > 0.74) rough += 0.12;                // 局部磨损雾面
      }
      const v = Math.min(1, rough) * 255;
      return [v, v, v];
    });
  }

  function poolTileAlbedo() { return tileAlbedo([0.6, 0.88, 0.96]); }

  // ---------- 大理石组 (宫殿) ----------
  const MSIZE = 512;
  let marbleH = null;
  function marbleHeight(x, y) {
    if (!marbleH) {
      const n1 = makeValueNoise(MSIZE, 5, 41);
      const n2 = makeValueNoise(MSIZE, 13, 42);
      const n3 = makeValueNoise(MSIZE, 37, 43);
      marbleH = (px, py) => {
        const warp = n2(px, py) * 2.4 + n3(px, py) * 0.8;   // 湍流扰动
        // 主脉络: 扭曲正弦条纹
        const vein = Math.abs(Math.sin((px / MSIZE) * 6.5 + warp * 2.2 + n1(px, py) * 3.0));
        const vein2 = Math.abs(Math.sin((py / MSIZE) * 4.0 + warp * 1.7));
        return Math.min(vein, vein2 * 0.8 + 0.25);
      };
    }
    return marbleH(x, y);
  }
  function marbleAlbedo() {
    const grain = makeValueNoise(MSIZE, 64, 44);
    const cloud = makeValueNoise(MSIZE, 9, 45);
    return fillImage(MSIZE, (x, y) => {
      const v = marbleHeight(x, y);
      // 白玉底 + 灰金脉络
      const veinAmt = Math.pow(Math.max(0, 1 - v * 2.6), 1.6);
      const base = 226 + cloud(x, y) * 18 + grain(x, y) * 6;
      const rr = base - veinAmt * 74;
      const gg = base - veinAmt * 66;
      const bb = base - veinAmt * 52;
      return [rr, gg * 0.995, bb * 0.97];
    });
  }
  function marbleNormal() { return heightToNormal((x, y) => marbleHeight(x, y) * 0.35, MSIZE, 1.2); }
  function marbleRoughness() {
    const n = makeValueNoise(MSIZE, 18, 46);
    return fillImage(MSIZE, (x, y) => {
      const v = marbleHeight(x, y);
      const veinAmt = Math.pow(Math.max(0, 1 - v * 2.6), 1.6);
      const rough = 0.12 + veinAmt * 0.2 + n(x, y) * 0.08;
      const b = Math.min(1, rough) * 255;
      return [b, b, b];
    });
  }

  // ---------- 混凝土组 ----------
  const CSIZE = 512;
  let concN1 = null, concN2 = null;
  function concHeight(x, y) {
    if (!concN1) {
      concN1 = makeValueNoise(CSIZE, 12, 21);
      concN2 = makeValueNoise(CSIZE, 48, 22);
    }
    return concN1(x, y) * 0.7 + concN2(x, y) * 0.3;
  }
  function concreteAlbedo() {
    const r = rnd(31);
    const c = fillImage(CSIZE, (x, y) => {
      const v = 168 + concHeight(x, y) * 42 + (r() - 0.5) * 10;
      return [v, v, v * 0.985];
    });
    const ctx = c.getContext('2d');
    ctx.fillStyle = 'rgba(120,120,118,0.5)';
    ctx.fillRect(0, CSIZE / 2 - 1, CSIZE, 2);
    ctx.fillRect(CSIZE / 2 - 1, 0, 2, CSIZE);
    return c;
  }
  function concreteNormal() { return heightToNormal(concHeight, CSIZE, 1.6); }
  function concreteRoughness() {
    return fillImage(CSIZE, (x, y) => {
      const v = (0.55 + concHeight(x, y) * 0.3) * 255;
      return [v, v, v];
    });
  }

  // ---------- 焦散动画帧 (轻量正弦干涉 + 异步生成) ----------
  const CAUS_SIZE = 128, CAUS_FRAMES = 16;
  function causticFrame(frame) {
    const t = frame / CAUS_FRAMES * Math.PI * 2;
    const S = CAUS_SIZE;
    const TAU = Math.PI * 2;
    return fillImage(S, (x, y) => {
      const u = x / S * TAU, v = y / S * TAU;
      // 三组行波干涉 (无缝平铺: 频率为整数)
      let w1 = Math.sin(u * 3 + t) + Math.sin(v * 2 - t * 1.3) + Math.sin((u + v) * 2 + t * 0.7);
      let w2 = Math.sin(u * 5 - t * 1.1) + Math.sin(v * 4 + t * 0.9) + Math.sin((u * 2 - v) * 1.5 - t);
      // 干涉亮线: 接近波峰交叠处
      let c = Math.pow(Math.max(0, 1 - Math.abs(w1) * 0.55), 3) + Math.pow(Math.max(0, 1 - Math.abs(w2) * 0.6), 3) * 0.7;
      c = Math.min(1, c);
      const b = c * 255;
      return [b * 0.75, b * 0.95, b];
    });
  }

  let causticTextures = null;
  function getCaustics() {
    if (!causticTextures) {
      // 先同步第一帧, 其余异步分帧生成
      causticTextures = [];
      const first = toTex(causticFrame(0), [1, 1]);
      for (let i = 0; i < CAUS_FRAMES; i++) causticTextures.push(first);
      let i = 1;
      const genNext = () => {
        if (i >= CAUS_FRAMES) return;
        causticTextures[i] = toTex(causticFrame(i), [1, 1]);
        i++;
        setTimeout(genNext, 30);
      };
      setTimeout(genNext, 100);
    }
    return causticTextures;
  }

  // ---------- 水波法线 ----------
  function waterNormalCanvas(seed = 91) {
    const S = 128;
    const n1 = makeValueNoise(S, 10, seed);
    const n2 = makeValueNoise(S, 28, seed + 1);
    const hf = (x, y) => n1(x, y) * 0.65 + n2(x, y) * 0.35;
    return heightToNormal(hf, S, 2.2);
  }

  // ---------- 缓存接口 ----------
  function get(name, repeat) {
    const key = name + '|' + (repeat ? repeat.join('x') : '');
    if (!cache[key]) {
      const makers = {
        tileAlbedo: () => toTex(tileAlbedo(), repeat, true),
        tileNormal: () => toTex(tileNormal(), repeat),
        tileRough: () => toTex(tileRoughness(), repeat),
        poolTileAlbedo: () => toTex(poolTileAlbedo(), repeat, true),
        marbleAlbedo: () => toTex(marbleAlbedo(), repeat, true),
        marbleNormal: () => toTex(marbleNormal(), repeat),
        marbleRough: () => toTex(marbleRoughness(), repeat),
        concAlbedo: () => toTex(concreteAlbedo(), repeat, true),
        concNormal: () => toTex(concreteNormal(), repeat),
        concRough: () => toTex(concreteRoughness(), repeat),
        waterNormal: () => toTex(waterNormalCanvas(), repeat),
        waterNormal2: () => toTex(waterNormalCanvas(131), repeat),
      };
      cache[key] = makers[name]();
    }
    return cache[key];
  }

  return { get, getCaustics, CAUS_FRAMES };
})();
