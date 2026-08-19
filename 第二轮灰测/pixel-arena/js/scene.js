// ============================================================
// scene.js — 程序化像素对战舞台（多层视差 / 云影 / 雾 / 天气粒子）
// 内部 512×240 平铺世界，427×240 摄像机窗口，camX ∈ [0, 85]
// 所有图层只用统一 32 色调色板，半透明一律 Bayer 抖动。
// ============================================================
'use strict';

const VIEW_W = 427, VIEW_H = 240, WORLD_W = 512, HORIZON = 96;

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  return { c, g };
}

const Scene = {
  init() {
    this.rng = mulberry32(20240915);
    this.ensureLeaf();
    this.weather = '晴天';
    this.terrain = 'none';
    this.tintLevel = 0;         // 当前天气染色强度（过渡用）
    this.tintTarget = 0;
    this.shadowTime = 0;
    this.shadowAccum = 0;
    this.layers = {};
    this.layers.sky = makeCanvas(WORLD_W, VIEW_H);
    this.layers.clouds = makeCanvas(WORLD_W, VIEW_H);
    this.layers.mountF = makeCanvas(WORLD_W, VIEW_H);
    this.layers.mountN = makeCanvas(WORLD_W, VIEW_H);
    this.layers.hills = makeCanvas(WORLD_W, VIEW_H);
    this.layers.grass = makeCanvas(WORLD_W, VIEW_H);
    this.layers.props = makeCanvas(WORLD_W, VIEW_H);
    this.layers.fringe = makeCanvas(WORLD_W, 40);
    this.layers.fog = makeCanvas(VIEW_W, VIEW_H);
    this.layers.vignette = makeCanvas(VIEW_W, VIEW_H);
    this.shadowBand = makeCanvas(WORLD_W, 140);
    this.shadowImg = this.shadowBand.g.createImageData(WORLD_W, 140);
    // 天气染色图案
    this.tintPat = {
      '雨天': ditherPattern(2, 2),
      '大晴天': ditherPattern(21, 2),
      '沙暴': ditherPattern(10, 3),
      '晴天': null,
    };
    this.tintPatLight = {
      '雨天': ditherPattern(2, 1),
      '大晴天': ditherPattern(21, 1),
      '沙暴': ditherPattern(10, 1),
      '晴天': null,
    };
    this.bakeStatic();
    this.setWeather('晴天');
    this.initParticles();
    return this;
  },

  // ---------- 周期函数（周期整除 512，保证无缝平铺）----------
  sinP(x, n, phase) {
    return Math.sin((x / WORLD_W) * Math.PI * 2 * n + phase);
  },

  // ---------- 静态烘焙 ----------
  bakeStatic() {
    this.bakeClouds();
    this.bakeMountF();
    this.bakeMountN();
    this.bakeHills();
    this.bakeGrass();
    this.bakeProps();
    this.bakeFringe();
    this.bakeFog();
    this.bakeVignette();
  },

  bakeSky() {
    const { c, g } = this.layers.sky;
    g.clearRect(0, 0, WORLD_W, VIEW_H);
    const W = this.weather;
    let bands, sun;
    if (W === '雨天') {
      bands = [
        { y: 0, c: 2 }, { y: 42, c: 3 }, { y: 72, c: 4 }, { y: 92, c: 5 },
      ];
      sun = null;
    } else if (W === '大晴天') {
      bands = [
        { y: 0, c: 3 }, { y: 46, c: 4 }, { y: 74, c: 5 }, { y: 90, c: 6 }, { y: 94, c: 7 },
      ];
      sun = { x: 428, y: 30, r: 9, halo: 16, core: 30 };
    } else if (W === '沙暴') {
      bands = [
        { y: 0, c: 2 }, { y: 44, c: 3 }, { y: 70, c: 11 }, { y: 92, c: 10 },
      ];
      sun = { x: 428, y: 32, r: 6, halo: 12, core: 10, ring: 11 };
    } else {
      bands = [
        { y: 0, c: 3 }, { y: 46, c: 4 }, { y: 76, c: 5 }, { y: 90, c: 6 },
      ];
      sun = { x: 428, y: 30, r: 7, halo: 12, core: 30, ring: 21 };
    }
    for (let i = 0; i < bands.length; i++) {
      const b = bands[i];
      const next = bands[i + 1];
      const yEnd = next ? next.y : VIEW_H;
      g.fillStyle = PAL[b.c];
      g.fillRect(0, b.y, WORLD_W, yEnd - b.y);
      if (next) {
        // 色带过渡用 Bayer 抖动
        const ty = Math.min(8, Math.floor((next.y - b.y) / 2));
        for (let r = 0; r < ty; r++) {
          const level = Math.round(16 * (r + 1) / (ty + 1));
          fillDither(g, 0, next.y - ty + r, WORLD_W, 1, next.c, level);
        }
      }
    }
    if (sun) {
      fillDither(g, sun.x - sun.halo, sun.y - sun.halo, sun.halo * 2, sun.halo * 2, sun.core === 30 ? 20 : 10, 6);
      circle(g, sun.x, sun.y, sun.r, sun.core === 30 ? 20 : 10);
      circle(g, sun.x, sun.y, Math.max(2, sun.r - 3), sun.core === 30 ? 30 : 11);
      if (sun.ring) circle(g, sun.x + sun.r * 0.3, sun.y - sun.r * 0.3, 2, sun.ring);
      // 光晕
      circle(g, sun.x, sun.y, sun.r + 3, sun.core === 30 ? 21 : 12);
      circle(g, sun.x, sun.y, sun.r + 1, sun.core === 30 ? 20 : 10);
    }
  },

  bakeClouds() {
    const { c, g } = this.layers.clouds;
    g.clearRect(0, 0, WORLD_W, VIEW_H);
    const puffs = [
      { x: 40, y: 26, rx: 20, ry: 8 },
      { x: 165, y: 40, rx: 26, ry: 9 },
      { x: 300, y: 22, rx: 18, ry: 7 },
      { x: 445, y: 36, rx: 24, ry: 9 },
    ];
    const wrap = function (x) { return [x, x - WORLD_W, x + WORLD_W]; };
    for (const p of puffs) {
      for (const wx of wrap(p.x)) {
        // 云团（奶油白 + 底部阴影）
        ellipse(g, wx, p.y, p.rx, p.ry, 30);
        ellipse(g, wx - p.rx * 0.55, p.y + 2, p.rx * 0.55, p.ry * 0.7, 30);
        ellipse(g, wx + p.rx * 0.55, p.y + 2, p.rx * 0.55, p.ry * 0.7, 30);
        ellipse(g, wx, p.y + p.ry * 0.55, p.rx * 0.85, p.ry * 0.5, 7);
        ellipse(g, wx, p.y + p.ry * 0.75, p.rx * 0.6, p.ry * 0.35, 6);
      }
    }
  },

  bakeMountF() {
    const { c, g } = this.layers.mountF;
    g.clearRect(0, 0, WORLD_W, VIEW_H);
    const self = this;
    for (let x = 0; x < WORLD_W; x++) {
      const s1 = self.sinP(x, 2, 1.3);
      const s2 = self.sinP(x, 5, 0.7);
      const ridge = 84 - 10 * (0.5 + 0.5 * s1) - 6 * (0.5 + 0.5 * s2);
      const slope = Math.cos((x / WORLD_W) * Math.PI * 2 * 2 + 1.3) * 2 + Math.cos((x / WORLD_W) * Math.PI * 2 * 5 + 0.7) * 5;
      const col = slope >= 0 ? 4 : 3;
      const top = Math.max(60, Math.round(ridge));
      g.fillStyle = PAL[col];
      g.fillRect(x, top, 1, HORIZON - top);
      if (top < 80) { g.fillStyle = PAL[6]; g.fillRect(x, top, 1, 2); }
    }
    // 山脚薄雾
    fillDither(g, 0, HORIZON - 6, WORLD_W, 6, 5, 5);
  },

  bakeMountN() {
    const { c, g } = this.layers.mountN;
    g.clearRect(0, 0, WORLD_W, VIEW_H);
    const self = this;
    for (let x = 0; x < WORLD_W; x++) {
      const s1 = self.sinP(x, 3, 0.2);
      const s2 = self.sinP(x, 7, 2.8);
      const top = Math.max(72, Math.round(88 - 5 * (0.5 + 0.5 * s1) - 3 * (0.5 + 0.5 * s2)));
      g.fillStyle = PAL[14];
      g.fillRect(x, top, 1, HORIZON - top);
      g.fillStyle = PAL[15];
      g.fillRect(x, top, 1, 2);
      for (let y = top + 2; y < HORIZON; y++) {
        if (hash2(x, y, 3) < 0.09) { g.fillStyle = PAL[15]; g.fillRect(x, y, 1, 1); }
      }
    }
  },

  bakeHills() {
    const { c, g } = this.layers.hills;
    g.clearRect(0, 0, WORLD_W, VIEW_H);
    const mounds = [
      { x: 110, y: 104, rx: 44, ry: 14 },
      { x: 300, y: 100, rx: 58, ry: 17 },
      { x: 470, y: 106, rx: 46, ry: 15 },
    ];
    const wrapX = function (x) { return [x, x - WORLD_W, x + WORLD_W]; };
    for (const m of mounds) {
      for (const wx of wrapX(m.x)) {
        ellipse(g, wx, m.y, m.rx, m.ry, 15);
        ellipse(g, wx - 2, m.y - 4, m.rx * 0.8, m.ry * 0.55, 16);
        ellipse(g, wx + 3, m.y + 6, m.rx * 0.85, m.ry * 0.45, 14);
        fillDither(g, wx - m.rx * 0.7, m.y + m.ry - 2, m.rx * 1.4, 2, 15, 6);
      }
    }
  },

  bakeGrass() {
    const { c, g } = this.layers.grass;
    g.clearRect(0, 0, WORLD_W, VIEW_H);
    const self = this;
    // 起伏草带（波浪边界 + 周期平铺）
    for (let x = 0; x < WORLD_W; x++) {
      for (let y = HORIZON; y < VIEW_H; y++) {
        const band = Math.floor((y - HORIZON) / 7);
        const wob = Math.floor(3.5 * self.sinP(x, 2, band * 0.9));
        const bandY = HORIZON + band * 7 + wob;
        let col = band % 2 === 0 ? 16 : 17;
        if (y < HORIZON + 6) col = 15;
        else if (y < HORIZON + 12 && ditherOn(x, y, 9)) col = 15;
        // 草叶斑点
        const h = hash2(x, y, 11);
        if (h < 0.045) col = 18;
        else if (h > 0.975) col = 15;
        g.fillStyle = PAL[col];
        g.fillRect(x, y, 1, 1);
        void bandY;
      }
    }
    // 近景暗色草带（纵深）
    fillDither(g, 0, VIEW_H - 16, WORLD_W, 16, 15, 5);
  },

  bakeProps() {
    const { c, g } = this.layers.props;
    g.clearRect(0, 0, WORLD_W, VIEW_H);
    const rng = this.rng;
    // 远景小树（在围栏后）
    this.tree(240, 118, 9);
    // 两侧大树
    this.tree(48, 152, 17);
    this.tree(398, 150, 14);
    // 木围栏
    for (let x = 228; x <= 388; x += 16) {
      rect(g, x, 108, 3, 12, 12);
      rect(g, x - 1, 106, 5, 2, 13);
    }
    rect(g, 224, 113, 172, 2, 13);
    rect(g, 224, 119, 172, 2, 13);
    // 对手土台（战斗平台边界）
    ellipse(g, 305, 152, 74, 20, 15);
    ellipse(g, 305, 146, 70, 14, 16);
    ellipseRing(g, 305, 140, 54, 13, 13, 11, 2);
    ellipse(g, 305, 139, 49, 10, 10);
    fillDither(g, 255, 131, 100, 3, 9, 6);       // 顶部受光
    fillDither(g, 260, 146, 90, 3, 12, 5);       // 底部阴影
    const stones = [[275, 142], [318, 144], [300, 136], [332, 141], [288, 146], [262, 138]];
    for (const s of stones) { px(g, s[0], s[1], 12); px(g, s[0] + 1, s[1], 13); }
    // 土路（连接玩家与对手站位）
    const p0 = { x: 150, y: 188 }, p1 = { x: 190, y: 166 }, p2 = { x: 305, y: 144 };
    for (let i = 0; i <= 14; i++) {
      const b = bezier2(p0, p1, p2, i / 14);
      ellipse(g, b.x, b.y, 7, 3.5, 11);
      ellipse(g, b.x, b.y - 0.6, 5.4, 2.5, 10);
      fillDither(g, b.x - 6, b.y + 2.4, 12, 2, 12, 6);
    }
    // 玩家站位土台
    ellipseRing(g, 150, 198, 46, 10, 13, 11, 2);
    ellipse(g, 150, 197, 42, 7, 10);
    fillDither(g, 108, 190, 84, 2, 9, 6);
    // 岩石
    this.rock(335, 180, 12, 7);
    this.rock(350, 185, 8, 5);
    this.rock(326, 186, 6, 4);
    this.rock(60, 202, 9, 6);
    this.rock(72, 208, 5, 3);
    // 花丛
    const flowers = [[80, 150, 27], [140, 172, 23], [180, 206, 20], [232, 192, 27], [262, 216, 30], [292, 206, 23], [362, 198, 27], [402, 186, 20], [442, 166, 30], [472, 202, 23]];
    for (const f of flowers) this.flower(f[0], f[1], f[2]);
    // 草丛
    for (let i = 0; i < 30; i++) {
      const x = 6 + Math.floor(rng() * 500);
      const y = 108 + Math.floor(rng() * 128);
      this.tuft(x, y);
    }
  },

  tree(cx, ty, r) {
    const g = this.layers.props.g;
    rect(g, cx - 3, ty + r * 0.55, 6, 14, 12);
    rect(g, cx - 1, ty + r * 0.55, 2, 14, 13);
    ellipse(g, cx, ty, r, r * 0.8, 15);
    ellipse(g, cx - r * 0.45, ty + r * 0.25, r * 0.55, r * 0.5, 16);
    ellipse(g, cx + r * 0.45, ty + r * 0.35, r * 0.5, r * 0.45, 14);
    ellipse(g, cx - r * 0.3, ty - r * 0.2, r * 0.35, r * 0.3, 17);
    fillDither(g, cx - r * 0.6, ty + r * 0.6, r * 1.2, r * 0.25, 14, 5);
  },

  rock(cx, cy, rx, ry) {
    const g = this.layers.props.g;
    ellipseRing(g, cx, cy, rx, ry, 13, 11, 1);
    ellipse(g, cx - rx * 0.15, cy - ry * 0.3, rx * 0.6, ry * 0.5, 10);
    ellipse(g, cx + rx * 0.3, cy + ry * 0.4, rx * 0.4, ry * 0.35, 12);
  },

  flower(x, y, color) {
    const g = this.layers.props.g;
    vline(g, x, y, 3, 15);
    px(g, x - 1, y - 2, 17);
    px(g, x + 1, y - 2, 17);
    px(g, x, y - 1, color);
    px(g, x, y - 3, color);
    px(g, x - 2, y - 2, color);
    px(g, x + 2, y - 2, color);
    px(g, x, y - 2, 21);
  },

  tuft(x, y) {
    const g = this.layers.props.g;
    vline(g, x, y - 2, 3, 17);
    vline(g, x - 2, y - 1, 3, 16);
    vline(g, x + 2, y - 1, 3, 16);
    px(g, x, y - 3, 18);
    px(g, x - 2, y - 2, 18);
    px(g, x + 2, y - 2, 18);
  },

  bakeFringe() {
    const { c, g } = this.layers.fringe;
    g.clearRect(0, 0, WORLD_W, 40);
    const self = this;
    for (let x = 0; x < WORLD_W; x++) {
      const h = 4 + Math.floor(2 * self.sinP(x, 3, 0)) + Math.floor(hash2(x, 7) * 5);
      const top = 40 - 6 - h;
      g.fillStyle = PAL[14];
      g.fillRect(x, top, 1, 40 - top);
      g.fillStyle = PAL[15];
      g.fillRect(x, top, 1, 2);
    }
    // 顶部角枝（框景）
    line(g, 2, 2, 16, 16, 13);
    line(g, 2, 2, 12, 8, 13);
    for (const p of [[14, 14], [10, 11], [8, 7], [4, 4], [16, 16]]) { px(g, p[0], p[1], 15); px(g, p[0] + 1, p[1] - 1, 16); }
    line(g, WORLD_W - 2, 3, WORLD_W - 16, 17, 13);
    line(g, WORLD_W - 2, 3, WORLD_W - 12, 9, 13);
    for (const p of [[WORLD_W - 14, 15], [WORLD_W - 10, 12], [WORLD_W - 8, 8], [WORLD_W - 4, 5], [WORLD_W - 16, 17]]) { px(g, p[0], p[1], 15); px(g, p[0] - 1, p[1] - 1, 16); }
  },

  bakeFog() {
    const { c, g } = this.layers.fog;
    g.clearRect(0, 0, VIEW_W, VIEW_H);
    // 地平线像素雾（Bayer 抖动浓度随高度递减）
    let y = 78;
    for (const level of [2, 3, 5, 7, 9]) {
      fillDither(g, 0, y, VIEW_W, 6, 7, level);
      y += 6;
    }
  },

  bakeVignette() {
    const { c, g } = this.layers.vignette;
    g.clearRect(0, 0, VIEW_W, VIEW_H);
    const S = 48;
    for (let i = 0; i < S; i++) {
      const level = Math.round(7 * (1 - i / S));
      if (level <= 0) continue;
      const w = S - i;
      fillDither(g, 0, i, w, 1, 1, level);                       // 左上
      fillDither(g, VIEW_W - w, i, w, 1, 1, level);              // 右上
      fillDither(g, 0, VIEW_H - 1 - i, w, 1, 1, level);          // 左下
      fillDither(g, VIEW_W - w, VIEW_H - 1 - i, w, 1, 1, level); // 右下
    }
  },

  // ---------- 云影（世界 XZ 噪声采样 + 抖动投影）----------
  updateShadows(dt) {
    this.shadowAccum += dt;
    if (this.shadowAccum < 150) return;
    this.shadowAccum = 0;
    this.shadowTime += 0.16;
    const data = this.shadowImg.data;
    const t = this.shadowTime;
    const bandW = WORLD_W, bandH = 140;
    for (let y = 0; y < bandH; y++) {
      for (let x = 0; x < bandW; x++) {
        const n = fbm2(x * 0.02 + t, y * 0.07, 2, 5);
        let a = 0;
        if (n > 0.64) {
          const d = (n - 0.64) / 0.36;
          if (bayer4(x, y) < d) a = 255;
        }
        if (n > 0.82) a = 255;
        const o = (y * bandW + x) * 4;
        if (a > 0) {
          const rgb = (n > 0.8) ? [0x1c, 0x2c, 0x44] : [0x10, 0x18, 0x20];
          data[o] = rgb[0]; data[o + 1] = rgb[1]; data[o + 2] = rgb[2]; data[o + 3] = 255;
        } else {
          data[o + 3] = 0;
        }
      }
    }
    this.shadowBand.g.putImageData(this.shadowImg, 0, 0);
  },

  // ---------- 天气粒子（8-12fps 步进）----------
  initParticles() {
    this.particles = [];
    this.splashes = [];
    this.pStep = 0;
  },

  setWeather(kind) {
    const changed = this.weather !== kind;
    this.weather = kind;
    this.bakeSky(); // 始终重烘焙（含初始化首帧）
    if (changed) {
      this.tintLevel = Math.max(0, this.tintLevel);
      this.tintTarget = kind === '晴天' ? 0 : 1;
    }
    this.initParticles();
    if (kind === '雨天') this.spawnRain();
    else if (kind === '沙暴') this.spawnSand();
    else this.spawnLeaves();
  },

  setTerrain(kind) {
    this.terrain = kind;
  },

  spawnLeaves() {
    this.particles = [];
    for (let i = 0; i < 7; i++) {
      this.particles.push({
        kind: 'leaf', x: Math.floor(this.rng() * VIEW_W), y: -4 - Math.floor(this.rng() * 60),
        vy: 7 + this.rng() * 9, vx: 2 + this.rng() * 5, phase: this.rng() * 6.28,
      });
    }
  },
  spawnRain() {
    this.particles = [];
    for (let i = 0; i < 44; i++) {
      this.particles.push({
        kind: 'rain', x: Math.floor(this.rng() * (VIEW_W + 16)) - 8, y: Math.floor(this.rng() * VIEW_H),
        vy: 26 + this.rng() * 8, vx: -3,
      });
    }
  },
  spawnSand() {
    this.particles = [];
    for (let i = 0; i < 34; i++) {
      this.particles.push({
        kind: 'sand', x: Math.floor(this.rng() * VIEW_W), y: Math.floor(this.rng() * VIEW_H),
        vy: 3 + this.rng() * 4, vx: -8 - this.rng() * 8,
      });
    }
  },

  updateParticles(dt, t) {
    const hz = this.weather === '雨天' ? 12 : this.weather === '沙暴' ? 10 : 8;
    const step = Math.floor(t / (1000 / hz));
    if (step === this.pStep) return;
    this.pStep = step;
    for (const p of this.particles) {
      if (p.kind === 'leaf') {
        p.y += p.vy / hz;
        p.x += (p.vx + Math.sin(t * 0.004 + p.phase) * 6) / hz;
        if (p.y > VIEW_H + 6) { p.y = -6; p.x = Math.floor(this.rng() * VIEW_W); }
      } else if (p.kind === 'rain') {
        p.y += p.vy / hz;
        p.x += p.vx / hz;
        if (p.y > VIEW_H - 12) {
          this.splashes.push({ x: p.x, y: VIEW_H - 12, t });
          p.y = -6; p.x = Math.floor(this.rng() * VIEW_W);
        }
      } else {
        p.y += p.vy / hz;
        p.x += p.vx / hz;
        if (p.x < -8) { p.x = VIEW_W + 8; p.y = Math.floor(this.rng() * VIEW_H); }
        if (p.y > VIEW_H) p.y = -4;
      }
    }
    this.splashes = this.splashes.filter(function (s) { return t - s.t < 240; });
  },

  drawParticles(ctx, t) {
    const self = this;
    for (const p of this.particles) {
      const x = Math.round(p.x), y = Math.round(p.y);
      if (p.kind === 'leaf') {
        const sway = Math.round(Math.sin(t * 0.004 + p.phase) * 2);
        ctx.drawImage(self.leafCanvas, x + sway, y);
      } else if (p.kind === 'rain') {
        ctx.fillStyle = PAL[25];
        ctx.fillRect(x, y, 1, 3);
        ctx.fillStyle = PAL[26];
        ctx.fillRect(x, y + 3, 1, 1);
      } else {
        ctx.fillStyle = PAL[11];
        ctx.fillRect(x, y, 2, 1);
        ctx.fillStyle = PAL[10];
        ctx.fillRect(x, y + 1, 1, 1);
      }
    }
    for (const s of this.splashes) {
      const a = (t - s.t) < 120 ? 25 : 26;
      ctx.fillStyle = PAL[a];
      ctx.fillRect(Math.round(s.x) - 1, Math.round(s.y), 3, 1);
    }
  },

  // ---------- 合成 ----------
  render(ctx, opts) {
    const camX = opts.camX, shakeX = opts.shakeX || 0, shakeY = opts.shakeY || 0;
    const L = this.layers;
    const sx = shakeX, sy = shakeY;
    // 天空（不受平移影响，只随震动）
    ctx.drawImage(L.sky.c, sx, sy);
    // 视差层
    this.drawParallax(ctx, L.clouds.c, camX, 0.10, sx, sy, true);
    this.drawParallax(ctx, L.mountF.c, camX, 0.15, sx, sy, true);
    this.drawParallax(ctx, L.mountN.c, camX, 0.35, sx, sy, true);
    this.drawParallax(ctx, L.hills.c, camX, 0.55, sx, sy, true);
    this.drawParallax(ctx, L.grass.c, camX, 0.75, sx, sy, true);
    this.drawParallax(ctx, L.props.c, camX, 1.0, sx, sy, false);
    // 云影（与地面同速）
    const off = Math.floor(camX);
    ctx.drawImage(this.shadowBand.c, sx - off, sy + 92);
    // 雾（精灵之前，地平线附近）
    ctx.drawImage(L.fog.c, 0, 0);
    return this;
  },

  drawParallax(ctx, layer, camX, factor, sx, sy, wrap) {
    let off = Math.floor(camX * factor);
    if (wrap) off = ((off % WORLD_W) + WORLD_W) % WORLD_W;
    ctx.drawImage(layer, sx - off, sy);
    if (wrap) ctx.drawImage(layer, sx - off + WORLD_W, sy);
  },

  // 精灵之后的前景与后处理层
  renderFore(ctx, camX, shakeX, shakeY, t, dt) {
    const off = Math.floor(camX * 1.25) % WORLD_W;
    ctx.drawImage(this.layers.fringe.c, shakeX - off, 200 + shakeY);
    ctx.drawImage(this.layers.fringe.c, shakeX - off + WORLD_W, 200 + shakeY);
    // 天气染色（纯调色板抖动图案，分级淡入淡出，绝不使用 alpha 混色）
    if (this.tintTarget > this.tintLevel) {
      this.tintLevel = Math.min(this.tintTarget, this.tintLevel + dt / 700);
    } else if (this.tintTarget < this.tintLevel) {
      this.tintLevel = Math.max(this.tintTarget, this.tintLevel - dt / 700);
    }
    if (this.tintLevel > 0.01) {
      const base = this.tintPat[this.weather];
      if (base) {
        if (this.tintLevel >= 0.67) {
          ctx.fillStyle = base;
          ctx.fillRect(0, 0, VIEW_W, VIEW_H);
        } else if (this.tintLevel >= 0.33) {
          ctx.fillStyle = this.tintPatLight[this.weather];
          ctx.fillRect(0, 0, VIEW_W, VIEW_H);
        }
      }
    }
    // 电气场地：地面电光微亮（抖动）
    if (this.terrain === '电气场地') {
      fillDither(ctx, 0, HORIZON, VIEW_W, VIEW_H - HORIZON, 20, 2);
    }
    ctx.drawImage(this.layers.vignette.c, 0, 0);
    this.updateParticles(dt, t);
    this.drawParticles(ctx, t);
    this.updateShadows(dt);
  },
};

// 叶子粒子位图（延迟烘焙，依赖 document）
Scene.ensureLeaf = function () {
  if (!Scene.leafCanvas) {
    Scene.leafCanvas = bakeMap(LEAF);
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Scene, VIEW_W, VIEW_H, WORLD_W, HORIZON };
}
