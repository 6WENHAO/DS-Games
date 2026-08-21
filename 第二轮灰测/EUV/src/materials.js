/**
 * materials.js — 程序化材质与环境光照库
 * ==================================================================
 * 规格书 §1.3「全程无侵权：模型、纹理均须原创」。
 * 因此本项目不使用任何第三方模型、贴图或 HDRI：
 *   · 所有纹理由 Canvas2D / 噪声函数程序化生成
 *   · 环境光照由程序化 equirectangular 画布经 PMREM 卷积生成
 *   · Mo/Si 多层膜采用 MeshPhysicalMaterial 的薄膜干涉 (iridescence)，
 *     物理上正是布拉格式多层干涉反射的视觉对应
 */

import * as THREE from 'three';
import { BRAND } from './config.js';
import { PARAMS } from './params.js';

const C = BRAND.colors;
const srgb = (hex) => new THREE.Color().setStyle(hex, THREE.SRGBColorSpace);

// ═══════════════════════════════════════════════════════════════════
// 1. 程序化噪声（值噪声 + FBM），供纹理生成使用
// ═══════════════════════════════════════════════════════════════════
function makeRng(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) / 4294967296); };
}
function valueNoise2D(seed = 1, size = 256) {
  const rng = makeRng(seed);
  const g = new Float32Array(size * size);
  for (let i = 0; i < g.length; i++) g[i] = rng();
  const at = (x, y) => g[((y % size) + size) % size * size + (((x % size) + size) % size)];
  const smooth = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const tx = smooth(x - xi), ty = smooth(y - yi);
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
  };
}
function fbm(noise, x, y, octaves = 5, lac = 2, gain = 0.5) {
  let sum = 0, amp = 0.5, f = 1, norm = 0;
  for (let i = 0; i < octaves; i++) { sum += amp * noise(x * f, y * f); norm += amp; f *= lac; amp *= gain; }
  return sum / norm;
}

const _texCache = new Map();
function cachedTexture(key, build) {
  if (_texCache.has(key)) return _texCache.get(key);
  const t = build();
  _texCache.set(key, t);
  return t;
}
function canvas2d(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return { c, ctx: c.getContext('2d', { willReadFrequently: false }) };
}
function toTexture(canvas, { repeat = 1, srgbColor = false, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = aniso;
  t.colorSpace = srgbColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.needsUpdate = true;
  return t;
}

// ═══════════════════════════════════════════════════════════════════
// 2. 程序化纹理
// ═══════════════════════════════════════════════════════════════════

/** 拉丝金属粗糙度图 —— 不锈钢真空腔体表面 */
export function brushedRoughness(seed = 7, size = 512, base = 0.36, streak = 0.16) {
  return cachedTexture(`brushed:${seed}:${base}:${streak}`, () => {
    const { c, ctx } = canvas2d(size, size);
    const n = valueNoise2D(seed, 128);
    const img = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        // 横向强拉伸 → 拉丝
        const v = fbm(n, x * 0.55, y * 0.02, 4);
        const fine = fbm(n, x * 3.1, y * 0.09, 3);
        const r = Math.min(1, Math.max(0, base + (v - 0.5) * streak + (fine - 0.5) * streak * 0.5));
        const i = (y * size + x) * 4;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.round(r * 255);
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return toTexture(c, { repeat: 2 });
  });
}

/** 微观起伏法线图 —— 机加工表面 */
export function machinedNormal(seed = 11, size = 512, strength = 1.4) {
  return cachedTexture(`mnormal:${seed}:${strength}`, () => {
    const { c, ctx } = canvas2d(size, size);
    const n = valueNoise2D(seed, 96);
    const h = new Float32Array(size * size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      h[y * size + x] = fbm(n, x * 0.09, y * 0.09, 5) * 0.7 + fbm(n, x * 0.7, y * 0.7, 3) * 0.3;
    }
    const img = ctx.createImageData(size, size);
    const H = (x, y) => h[(((y % size) + size) % size) * size + (((x % size) + size) % size)];
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const dx = (H(x + 1, y) - H(x - 1, y)) * strength * 8;
      const dy = (H(x, y + 1) - H(x, y - 1)) * strength * 8;
      const l = Math.hypot(dx, dy, 1);
      const i = (y * size + x) * 4;
      img.data[i] = Math.round((-dx / l * 0.5 + 0.5) * 255);
      img.data[i + 1] = Math.round((-dy / l * 0.5 + 0.5) * 255);
      img.data[i + 2] = Math.round((1 / l * 0.5 + 0.5) * 255);
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return toTexture(c, { repeat: 3 });
  });
}

/**
 * 芯片版图纹理 —— 掩模与晶圆共用同一版图数据，
 * 保证「掩模图形 → 晶圆图形」是同一图形的 4:1 缩小，而非两套美术。
 * mode: 'mask'（吸收层黑 / 反射区亮）| 'wafer'（显影后的芯片图形）| 'alpha'
 */
export function chipLayout(size = 1024, mode = 'mask', seed = 20240513) {
  return cachedTexture(`chip:${size}:${mode}:${seed}`, () => {
    const { c, ctx } = canvas2d(size, size);
    const rng = makeRng(seed);
    const dark = mode === 'wafer' ? '#0b1016' : '#05070a';
    const light = mode === 'wafer' ? '#9fd0ff' : '#dfeaf5';
    ctx.fillStyle = dark; ctx.fillRect(0, 0, size, size);

    const S = size / 1024;
    // —— 宏观分区：SRAM 阵列 / 逻辑核 / IO 环 / 布线通道 ——
    const blocks = [];
    const grid = 4;
    for (let gy = 0; gy < grid; gy++) for (let gx = 0; gx < grid; gx++) {
      const kind = rng();
      blocks.push({
        x: 40 * S + gx * 236 * S, y: 40 * S + gy * 236 * S, w: 216 * S, h: 216 * S,
        kind: kind < 0.42 ? 'sram' : kind < 0.78 ? 'logic' : 'analog',
      });
    }
    ctx.fillStyle = light;
    for (const b of blocks) {
      if (b.kind === 'sram') {
        // 高密度规则阵列 —— 光刻分辨率的典型考验对象
        const p = 6 * S, lw = 2.4 * S;
        for (let y = b.y; y < b.y + b.h; y += p) ctx.fillRect(b.x, y, b.w, lw);
        for (let x = b.x; x < b.x + b.w; x += p * 2) ctx.fillRect(x, b.y, lw, b.h);
      } else if (b.kind === 'logic') {
        // 随机标准单元行 + 曼哈顿布线
        const rowH = 14 * S;
        for (let y = b.y; y < b.y + b.h; y += rowH) {
          let x = b.x;
          while (x < b.x + b.w - 4 * S) {
            const w = (4 + Math.floor(rng() * 14)) * S;
            if (rng() > 0.28) ctx.fillRect(x, y + 2 * S, Math.min(w, b.x + b.w - x), rowH - 6 * S);
            x += w + 3 * S;
          }
        }
        for (let k = 0; k < 26; k++) {
          const x0 = b.x + rng() * b.w, y0 = b.y + rng() * b.h;
          const l = (18 + rng() * 90) * S, t = 2.6 * S;
          if (rng() > 0.5) ctx.fillRect(x0, y0, Math.min(l, b.x + b.w - x0), t);
          else ctx.fillRect(x0, y0, t, Math.min(l, b.y + b.h - y0));
        }
      } else {
        // 模拟/电源区：粗线与通孔阵列
        ctx.fillRect(b.x, b.y, b.w, 8 * S);
        ctx.fillRect(b.x, b.y + b.h - 8 * S, b.w, 8 * S);
        for (let y = b.y + 20 * S; y < b.y + b.h - 20 * S; y += 22 * S)
          for (let x = b.x + 12 * S; x < b.x + b.w - 12 * S; x += 22 * S)
            ctx.fillRect(x, y, 9 * S, 9 * S);
      }
    }
    // —— 全局电源网格与 IO 环 ——
    ctx.globalAlpha = 0.85;
    for (let x = 24 * S; x < size; x += 118 * S) ctx.fillRect(x, 0, 5 * S, size);
    for (let y = 24 * S; y < size; y += 118 * S) ctx.fillRect(0, y, size, 5 * S);
    ctx.globalAlpha = 1;
    ctx.lineWidth = 7 * S; ctx.strokeStyle = light;
    ctx.strokeRect(14 * S, 14 * S, size - 28 * S, size - 28 * S);
    for (let i = 0; i < 64; i++) {
      const t = (i + 0.5) / 64 * (size - 40 * S) + 20 * S;
      ctx.fillRect(t, 3 * S, 9 * S, 9 * S);
      ctx.fillRect(t, size - 12 * S, 9 * S, 9 * S);
      ctx.fillRect(3 * S, t, 9 * S, 9 * S);
      ctx.fillRect(size - 12 * S, t, 9 * S, 9 * S);
    }
    if (mode === 'mask') {
      // 掩模为反射式：吸收层(暗) 与 多层膜反射区(亮) 反相
      ctx.globalCompositeOperation = 'difference';
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, size, size);
      ctx.globalCompositeOperation = 'source-over';
    }
    return toTexture(c, { repeat: 1, srgbColor: true, aniso: 16 });
  });
}

/** 硅晶圆表面：结晶纹理 + 环形抛光痕 */
export function siliconSurface(size = 512) {
  return cachedTexture('silicon', () => {
    const { c, ctx } = canvas2d(size, size);
    const n = valueNoise2D(31, 128);
    const img = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const dx = x / size - 0.5, dy = y / size - 0.5;
      const r = Math.hypot(dx, dy);
      const rings = 0.5 + 0.5 * Math.sin(r * 420 + fbm(n, x * 0.02, y * 0.02, 3) * 6);
      const v = 0.13 + rings * 0.05 + fbm(n, x * 0.35, y * 0.35, 4) * 0.05;
      const i = (y * size + x) * 4;
      img.data[i] = Math.round(v * 210); img.data[i + 1] = Math.round(v * 225); img.data[i + 2] = Math.round(v * 255);
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return toTexture(c, { repeat: 1, srgbColor: true });
  });
}

/** HUD 网格贴花（地面参考网格） */
export function gridTexture(size = 512, div = 8) {
  return cachedTexture(`grid:${div}`, () => {
    const { c, ctx } = canvas2d(size, size);
    ctx.clearRect(0, 0, size, size);
    ctx.strokeStyle = C.grid; ctx.lineWidth = 1;
    const step = size / div;
    for (let i = 0; i <= div; i++) {
      ctx.globalAlpha = i % div === 0 ? 0.9 : 0.35;
      ctx.beginPath(); ctx.moveTo(i * step, 0); ctx.lineTo(i * step, size); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * step); ctx.lineTo(size, i * step); ctx.stroke();
    }
    return toTexture(c, { repeat: 1, srgbColor: true });
  });
}

/** 软圆点精灵（辉光/粒子） */
export function glowSprite(size = 128, power = 2.6) {
  return cachedTexture(`glow:${power}`, () => {
    const { c, ctx } = canvas2d(size, size);
    const img = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const dx = (x + 0.5) / size * 2 - 1, dy = (y + 0.5) / size * 2 - 1;
      const r = Math.min(1, Math.hypot(dx, dy));
      const a = Math.pow(1 - r, power);
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = Math.round(Math.max(0, a) * 255);
    }
    ctx.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });
}

// ═══════════════════════════════════════════════════════════════════
// 3. 程序化环境光照（原创，替代第三方 HDRI）
//    生成 equirectangular 画布：顶部柔和天光 + 三块打光板 + 冷暖分区，
//    再经 PMREMGenerator 卷积为 PBR 环境贴图。
// ═══════════════════════════════════════════════════════════════════
export function buildEnvironment(renderer) {
  const W = 1024, H = 512;
  const { c, ctx } = canvas2d(W, H);
  // 垂直渐变底：上冷下暗
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0.00, '#4e7599');
  g.addColorStop(0.30, '#2b4256');
  g.addColorStop(0.50, '#16212c');
  g.addColorStop(0.72, '#0d141c');
  g.addColorStop(1.00, '#080c12');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  // 打光板：柔和椭圆高光
  const cards = [
    { x: 0.16, y: 0.26, rx: 0.22, ry: 0.18, col: '#bcdcff', a: 1.00 },  // 主光 冷蓝
    { x: 0.66, y: 0.32, rx: 0.18, ry: 0.15, col: '#ffe3bc', a: 0.72 },  // 辅光 暖
    { x: 0.42, y: 0.09, rx: 0.38, ry: 0.12, col: '#eaf6ff', a: 0.92 },  // 顶光条
    { x: 0.88, y: 0.60, rx: 0.16, ry: 0.13, col: '#7fa8cc', a: 0.62 },  // 反弹光
    { x: 0.34, y: 0.78, rx: 0.30, ry: 0.12, col: '#3c5570', a: 0.50 },  // 地面反弹
  ];
  ctx.globalCompositeOperation = 'lighter';
  for (const k of cards) {
    const grd = ctx.createRadialGradient(k.x * W, k.y * H, 0, k.x * W, k.y * H, Math.max(k.rx * W, k.ry * H));
    const col = new THREE.Color(k.col);
    grd.addColorStop(0, `rgba(${col.r * 255 | 0},${col.g * 255 | 0},${col.b * 255 | 0},${k.a})`);
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save();
    ctx.translate(k.x * W, k.y * H); ctx.scale(1, (k.ry * H) / (k.rx * W)); ctx.translate(-k.x * W, -k.y * H);
    ctx.fillStyle = grd; ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  ctx.globalCompositeOperation = 'source-over';

  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const rt = pmrem.fromEquirectangular(tex);
  pmrem.dispose();
  tex.dispose();
  return rt.texture;
}

// ═══════════════════════════════════════════════════════════════════
// 4. 材质库
// ═══════════════════════════════════════════════════════════════════
export function createMaterials(env) {
  const common = { envMap: env, envMapIntensity: 1.0 };

  /** 不锈钢真空腔体 */
  const steel = new THREE.MeshPhysicalMaterial({
    ...common, color: srgb('#98a5b3'), metalness: 1.0, roughness: 0.33,
    roughnessMap: brushedRoughness(7, 512, 0.34, 0.18),
    normalMap: machinedNormal(11, 512, 0.9), normalScale: new THREE.Vector2(0.35, 0.35),
    envMapIntensity: 1.5,
  });

  /** 深色阳极氧化铝 —— 机架与外壳 */
  const anodized = new THREE.MeshPhysicalMaterial({
    ...common, color: srgb('#39434f'), metalness: 0.8, roughness: 0.5,
    roughnessMap: brushedRoughness(19, 512, 0.52, 0.14),
    normalMap: machinedNormal(23, 512, 1.1), normalScale: new THREE.Vector2(0.5, 0.5),
    envMapIntensity: 1.15,
  });

  /** 深色吸光内壁 —— 真空腔内部，抑制杂散光 */
  const innerDark = new THREE.MeshPhysicalMaterial({
    ...common, color: srgb('#26313d'), metalness: 0.30, roughness: 0.74,
    normalMap: machinedNormal(29, 512, 1.4), normalScale: new THREE.Vector2(0.7, 0.7),
    envMapIntensity: 0.85, side: THREE.BackSide,
  });

  /**
   * ★ Mo/Si 多层膜反射面
   * 40 对 Mo/Si 交替镀层的布拉格干涉，在视觉上呈现随角度变化的
   * 干涉色。用 MeshPhysicalMaterial 的薄膜干涉参数表达，
   * iridescenceThicknessRange 对应多层膜周期量级（示意）。
   */
  const multilayer = new THREE.MeshPhysicalMaterial({
    ...common, color: srgb('#c6d3e0'), metalness: 1.0, roughness: 0.13,
    iridescence: 1.0, iridescenceIOR: 1.9,
    iridescenceThicknessRange: [180, 460],
    envMapIntensity: 2.4, side: THREE.DoubleSide,
  });

  /** 多层膜背面/镜体（碳化硅基体 + 冷却结构） */
  const mirrorBody = new THREE.MeshPhysicalMaterial({
    ...common, color: srgb('#4a5665'), metalness: 0.55, roughness: 0.44,
    normalMap: machinedNormal(37, 512, 1.0), normalScale: new THREE.Vector2(0.4, 0.4),
    envMapIntensity: 1.1,
  });

  /** 熔融锡 —— 液态金属 */
  const tin = new THREE.MeshPhysicalMaterial({
    ...common, color: srgb(C.tin), metalness: 1.0, roughness: 0.09,
    envMapIntensity: 1.4,
  });

  /** 白陶瓷绝缘件 */
  const ceramic = new THREE.MeshPhysicalMaterial({
    ...common, color: srgb('#d8dee6'), metalness: 0.0, roughness: 0.42,
    clearcoat: 0.6, clearcoatRoughness: 0.3, envMapIntensity: 0.9,
  });

  /** 铜质冷却管路 */
  const copper = new THREE.MeshPhysicalMaterial({
    ...common, color: srgb('#b1734a'), metalness: 1.0, roughness: 0.31,
    roughnessMap: brushedRoughness(43, 512, 0.31, 0.12), envMapIntensity: 1.1,
  });

  /** 观察窗玻璃 */
  const viewport = new THREE.MeshPhysicalMaterial({
    ...common, color: srgb('#8ab4d8'), metalness: 0.0, roughness: 0.04,
    transmission: 0.92, thickness: 0.6, ior: 1.52,
    transparent: true, opacity: 0.42, side: THREE.DoubleSide, envMapIntensity: 1.2,
  });

  /** 硅晶圆 */
  const silicon = new THREE.MeshPhysicalMaterial({
    ...common, color: srgb('#7f8b99'), metalness: 0.92, roughness: 0.055,
    map: siliconSurface(512), iridescence: 0.55, iridescenceIOR: 1.6,
    iridescenceThicknessRange: [260, 720], envMapIntensity: 1.5,
  });

  /** 光刻胶薄膜（曝光前，均匀半透明） */
  const resist = new THREE.MeshPhysicalMaterial({
    ...common, color: srgb('#4d6f8c'), metalness: 0.1, roughness: 0.16,
    transmission: 0.5, thickness: 0.05, ior: 1.6,
    transparent: true, opacity: 0.6, envMapIntensity: 1.0, side: THREE.DoubleSide,
  });

  /** 掩模基板（石英） */
  const maskSubstrate = new THREE.MeshPhysicalMaterial({
    ...common, color: srgb('#c3ccd6'), metalness: 0.1, roughness: 0.2,
    clearcoat: 0.8, clearcoatRoughness: 0.15, envMapIntensity: 1.0,
  });

  /** HUD 线框（不受光，恒定色） */
  const hudLine = new THREE.LineBasicMaterial({ color: srgb(C.primary), transparent: true, opacity: 0.55 });
  const hudLineDim = new THREE.LineBasicMaterial({ color: srgb(C.grid), transparent: true, opacity: 0.4 });

  return {
    steel, anodized, innerDark, multilayer, mirrorBody, tin, ceramic, copper,
    viewport, silicon, resist, maskSubstrate, hudLine, hudLineDim,
  };
}

/** 自发光材质工厂（等离子体、光束、指示灯） */
export function emissive(colorHex, intensity = 1, { transparent = false, opacity = 1, blending } = {}) {
  const m = new THREE.MeshBasicMaterial({
    color: srgb(colorHex), transparent, opacity,
    blending: blending ?? (transparent ? THREE.AdditiveBlending : THREE.NormalBlending),
    depthWrite: !transparent,
    toneMapped: true,
  });
  m.color.multiplyScalar(intensity);
  return m;
}

export { srgb, valueNoise2D, fbm, makeRng, canvas2d, toTexture };
