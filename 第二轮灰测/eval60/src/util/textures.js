/**
 * 程序化贴图（Canvas 生成，零外部资源）。
 * 在无 DOM 环境（Node 测试）下所有函数安全返回 null。
 */
import * as THREE from 'three';
import { TAU, clamp01, lerp, fbm3, ridged3, noise3, lonLatToDir, makeRng } from './math.js';

export const hasDOM = typeof document !== 'undefined' || typeof OffscreenCanvas !== 'undefined';

function makeCanvas(w, h) {
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  return null;
}

function texFrom(canvas, { srgb = true, repeat = 1, aniso = 4 } = {}) {
  if (!canvas) return null;
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = aniso;
  t.needsUpdate = true;
  return t;
}

/** 高度图 → 法线贴图（Sobel） */
function heightToNormal(src, strength = 2.2) {
  if (!src) return null;
  const w = src.width, h = src.height;
  const sctx = src.getContext('2d');
  const data = sctx.getImageData(0, 0, w, h).data;
  const out = makeCanvas(w, h);
  const octx = out.getContext('2d');
  const img = octx.createImageData(w, h);
  const at = (x, y) => {
    const xi = (x + w) % w, yi = (y + h) % h;
    return data[(yi * w + xi) * 4] / 255;
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx =
        at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1) -
        (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1));
      const dy =
        at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1) -
        (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1));
      let nx = dx * strength, ny = dy * strength, nz = 1;
      const l = Math.hypot(nx, ny, nz);
      nx /= l; ny /= l; nz /= l;
      const i = (y * w + x) * 4;
      img.data[i] = (nx * 0.5 + 0.5) * 255;
      img.data[i + 1] = (ny * 0.5 + 0.5) * 255;
      img.data[i + 2] = (nz * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  octx.putImageData(img, 0, 0);
  return out;
}

/* ------------------------------------------------------------------ *
 * 舰体装甲贴图：色板 + 粗糙度 + 法线
 * ------------------------------------------------------------------ */
export function hullTextureSet(size = 1024, seed = 7, tint = '#8f9aa8') {
  if (!hasDOM) return { map: null, roughnessMap: null, normalMap: null, metalnessMap: null };
  const rng = makeRng(seed);
  const albedo = makeCanvas(size, size);
  const height = makeCanvas(size, size);
  const rough = makeCanvas(size, size);
  const a = albedo.getContext('2d');
  const hg = height.getContext('2d');
  const r = rough.getContext('2d');

  a.fillStyle = tint; a.fillRect(0, 0, size, size);
  hg.fillStyle = '#808080'; hg.fillRect(0, 0, size, size);
  r.fillStyle = '#6a6a6a'; r.fillRect(0, 0, size, size);

  // 大装甲块：分割成不规则矩形
  const rects = [];
  const split = (x, y, w, h, depth) => {
    if (depth <= 0 || w < size * 0.06 || h < size * 0.06) { rects.push([x, y, w, h]); return; }
    const vertical = w > h ? rng() < 0.8 : rng() < 0.2;
    const t = rng.range(0.34, 0.66);
    if (vertical) { split(x, y, w * t, h, depth - 1); split(x + w * t, y, w * (1 - t), h, depth - 1); }
    else { split(x, y, w, h * t, depth - 1); split(x, y + h * t, w, h * (1 - t), depth - 1); }
  };
  split(0, 0, size, size, 5);

  for (const [x, y, w, h] of rects) {
    const v = rng.range(-16, 16);
    a.fillStyle = `rgba(${140 + v},${150 + v},${162 + v},0.55)`;
    a.fillRect(x + 1, y + 1, w - 2, h - 2);
    // 面板缝隙（高度下沉）
    hg.strokeStyle = 'rgba(40,40,40,0.95)';
    hg.lineWidth = Math.max(1.2, size / 512);
    hg.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    // 粗糙度：每块略有差异
    r.fillStyle = `rgba(${110 + rng.range(-30, 30)},0,0,0.5)`;
    r.fillRect(x + 1, y + 1, w - 2, h - 2);
    // 少量高光边（受光边缘）
    if (rng() < 0.4) {
      a.strokeStyle = 'rgba(215,225,235,0.20)';
      a.lineWidth = 1.5;
      a.beginPath(); a.moveTo(x + 2, y + h - 2); a.lineTo(x + 2, y + 2); a.lineTo(x + w - 2, y + 2); a.stroke();
    }
    a.strokeStyle = 'rgba(20,24,30,0.55)';
    a.lineWidth = Math.max(1, size / 640);
    a.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    // 铆钉
    if (rng() < 0.55) {
      const n = rng.int(3, 9);
      for (let i = 0; i < n; i++) {
        const px = x + 5 + rng() * Math.max(1, w - 10);
        const py = y + 5 + rng() * Math.max(1, h - 10);
        const rad = size / 480;
        a.fillStyle = 'rgba(60,66,74,0.7)';
        a.beginPath(); a.arc(px, py, rad, 0, TAU); a.fill();
        hg.fillStyle = 'rgba(190,190,190,0.85)';
        hg.beginPath(); hg.arc(px, py, rad, 0, TAU); hg.fill();
      }
    }
    // 通风格栅
    if (rng() < 0.18 && w > size * 0.09 && h > size * 0.05) {
      const lines = rng.int(4, 9);
      for (let i = 0; i < lines; i++) {
        const ly = y + (h * (i + 1)) / (lines + 1);
        a.fillStyle = 'rgba(28,32,38,0.75)';
        a.fillRect(x + w * 0.14, ly - 1, w * 0.72, 2);
        hg.fillStyle = 'rgba(48,48,48,0.9)';
        hg.fillRect(x + w * 0.14, ly - 1, w * 0.72, 2);
      }
    }
  }

  // 细密污渍 / 使用痕迹
  for (let i = 0; i < 900; i++) {
    const x = rng() * size, y = rng() * size;
    const w = rng.range(2, 40), h = rng.range(1, 3);
    a.fillStyle = `rgba(${rng.range(60, 130) | 0},${rng.range(65, 135) | 0},${rng.range(70, 145) | 0},${rng.range(0.03, 0.12).toFixed(3)})`;
    a.fillRect(x, y, w, h);
  }
  // 警示条纹
  for (let i = 0; i < 5; i++) {
    const x = rng() * size, y = rng() * size;
    const w = rng.range(size * 0.05, size * 0.16), h = rng.range(6, 12);
    a.save();
    a.translate(x, y); a.rotate(rng() < 0.5 ? 0 : Math.PI / 2);
    for (let k = 0; k * 10 < w; k++) {
      a.fillStyle = k % 2 ? 'rgba(226,178,40,0.85)' : 'rgba(30,32,36,0.85)';
      a.fillRect(k * 10, 0, 10, h);
    }
    a.restore();
  }

  return {
    map: texFrom(albedo, { repeat: 1 }),
    roughnessMap: texFrom(rough, { srgb: false }),
    normalMap: texFrom(heightToNormal(height, 1.6), { srgb: false }),
  };
}

/** 发光光斑（引擎/星点/耀斑） */
export function glowTexture(size = 128, inner = '#ffffff', outer = 'rgba(120,190,255,0)', power = 2) {
  if (!hasDOM) return null;
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner);
  g.addColorStop(0.18, inner);
  g.addColorStop(Math.min(0.85, 0.28 * power), 'rgba(120,190,255,0.35)');
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const t = texFrom(c);
  if (t) t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

/** 十字星芒（太阳耀斑） */
export function flareTexture(size = 256) {
  if (!hasDOM) return null;
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, size, size);
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.12, 'rgba(255,236,190,0.75)');
  g.addColorStop(0.5, 'rgba(255,170,80,0.12)');
  g.addColorStop(1, 'rgba(255,140,60,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  // 星芒
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.2;
    ctx.save();
    ctx.translate(size / 2, size / 2);
    ctx.rotate(a);
    const lg = ctx.createLinearGradient(0, 0, size * 0.5, 0);
    lg.addColorStop(0, 'rgba(255,240,220,0.6)');
    lg.addColorStop(1, 'rgba(255,200,140,0)');
    ctx.fillStyle = lg;
    ctx.beginPath();
    ctx.moveTo(0, -size * 0.012); ctx.lineTo(size * 0.5, 0); ctx.lineTo(0, size * 0.012);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  const t = texFrom(c);
  if (t) t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

/* ------------------------------------------------------------------ *
 * 行星贴图
 * ------------------------------------------------------------------ */
const PALETTES = {
  mercury: [[52, 48, 44], [96, 90, 84], [140, 132, 124], [176, 168, 158]],
  venus:   [[176, 132, 62], [212, 174, 100], [238, 214, 156], [250, 238, 200]],
  earth:   [[8, 34, 74], [12, 62, 116], [46, 104, 62], [120, 148, 88]],
  mars:    [[92, 44, 28], [140, 72, 40], [186, 108, 62], [214, 158, 112]],
  jupiter: [[126, 92, 62], [188, 152, 108], [226, 200, 162], [156, 108, 78]],
  saturn:  [[160, 132, 84], [206, 180, 128], [236, 218, 174], [188, 158, 108]],
  uranus:  [[92, 166, 176], [140, 202, 208], [186, 226, 228], [116, 186, 194]],
  neptune: [[28, 62, 138], [52, 96, 180], [104, 150, 216], [72, 118, 196]],
  moon:    [[46, 46, 48], [92, 92, 96], [134, 134, 138], [168, 168, 172]],
};

function paletteLookup(pal, t) {
  const n = pal.length - 1;
  const x = clamp01(t) * n;
  const i = Math.min(n - 1, Math.floor(x));
  const f = x - i;
  return [
    lerp(pal[i][0], pal[i + 1][0], f),
    lerp(pal[i][1], pal[i + 1][1], f),
    lerp(pal[i][2], pal[i + 1][2], f),
  ];
}

/**
 * 生成行星等距柱状贴图。
 * kind: 'rocky' | 'gas' | 'earth' | 'ice'
 * 返回 { map, emissiveMap|null, bumpMap }
 */
export function planetTextureSet(kindKey, palKey, seed = 1, size = 512) {
  if (!hasDOM) return { map: null, emissiveMap: null, normalMap: null };
  const w = size, h = size / 2;
  const pal = PALETTES[palKey] ?? PALETTES.mercury;
  const albedo = makeCanvas(w, h);
  const height = makeCanvas(w, h);
  const night = kindKey === 'earth' ? makeCanvas(w, h) : null;
  const ac = albedo.getContext('2d');
  const hc = height.getContext('2d');
  const nc = night ? night.getContext('2d') : null;
  const aimg = ac.createImageData(w, h);
  const himg = hc.createImageData(w, h);
  const nimg = nc ? nc.createImageData(w, h) : null;
  const s = seed * 13.37;

  for (let y = 0; y < h; y++) {
    const v = (y + 0.5) / h;
    for (let x = 0; x < w; x++) {
      const u = (x + 0.5) / w;
      const d = lonLatToDir(u, v);
      const px = d[0] * 2.2 + s, py = d[1] * 2.2 + s * 0.7, pz = d[2] * 2.2 - s * 0.3;
      let t, hgt, rgb;

      if (kindKey === 'gas') {
        // 条带 + 涡旋
        const band = py * 6.0;
        const swirl = fbm3(px * 1.6, py * 5.0, pz * 1.6, 5) - 0.5;
        const flow = Math.sin(band + swirl * 3.4) * 0.5 + 0.5;
        const fine = fbm3(px * 6.0, py * 26.0, pz * 6.0, 4);
        t = clamp01(flow * 0.72 + fine * 0.28);
        rgb = paletteLookup(pal, t);
        // 大红斑 / 涡旋眼
        const spotLon = 0.62, spotLat = 0.61;
        const dx = Math.min(Math.abs(u - spotLon), 1 - Math.abs(u - spotLon)) * 2.6;
        const dy = (v - spotLat) * 6.0;
        const sp = 1 - clamp01(Math.hypot(dx, dy) * 2.2);
        if (sp > 0) {
          const sc = [206, 108, 74];
          const k = Math.pow(sp, 1.6);
          rgb = [lerp(rgb[0], sc[0], k), lerp(rgb[1], sc[1], k), lerp(rgb[2], sc[2], k)];
        }
        hgt = t * 0.4 + 0.4;
      } else if (kindKey === 'ice') {
        const band = Math.sin(py * 4.0 + fbm3(px, py * 3, pz, 3) * 1.6) * 0.5 + 0.5;
        t = clamp01(band * 0.5 + fbm3(px * 3, py * 3, pz * 3, 4) * 0.5);
        rgb = paletteLookup(pal, t);
        hgt = 0.5;
      } else if (kindKey === 'earth') {
        const cont = ridged3(px * 1.15, py * 1.15, pz * 1.15, 6);
        const detail = fbm3(px * 7, py * 7, pz * 7, 5);
        const land = cont * 0.72 + detail * 0.28;
        const ice = Math.pow(Math.abs(d[1]), 5.5) * 1.5;
        const isLand = land > 0.5;
        if (isLand) {
          const alt = clamp01((land - 0.5) * 3.2);
          const green = paletteLookup([pal[2], pal[3], [150, 140, 118], [235, 238, 242]], alt * 0.9 + detail * 0.1);
          rgb = green;
        } else {
          const depth = clamp01((0.5 - land) * 2.6);
          rgb = paletteLookup([pal[1], pal[0]], depth);
        }
        if (ice > 0.5) {
          const k = clamp01((ice - 0.5) * 2);
          rgb = [lerp(rgb[0], 240, k), lerp(rgb[1], 246, k), lerp(rgb[2], 252, k)];
        }
        hgt = isLand ? 0.55 + (land - 0.5) * 0.9 : 0.42;
        if (nimg) {
          // 夜面城市灯光：只在陆地、且中纬度更密
          let lights = 0;
          if (isLand && ice < 0.6) {
            const cl = fbm3(px * 22, py * 22, pz * 22, 3);
            const belt = 1 - Math.pow(Math.abs(d[1]), 1.4);
            lights = clamp01((cl - 0.62) * 6) * belt;
          }
          const i2 = (y * w + x) * 4;
          nimg.data[i2] = 255 * lights;
          nimg.data[i2 + 1] = 220 * lights;
          nimg.data[i2 + 2] = 150 * lights;
          nimg.data[i2 + 3] = 255;
        }
      } else {
        // rocky：陨石坑
        const base = fbm3(px * 2.4, py * 2.4, pz * 2.4, 6);
        let crater = 0;
        for (let o = 0; o < 3; o++) {
          const f = 4 + o * 7;
          const c = noise3(px * f + o * 31, py * f + o * 17, pz * f + o * 7);
          crater += Math.pow(clamp01(1 - Math.abs(c - 0.5) * 5.2), 3) * (0.16 / (o + 1));
        }
        t = clamp01(base * 0.85 + crater * 1.6);
        rgb = paletteLookup(pal, t);
        hgt = clamp01(base * 0.7 + crater * 2.0);
      }

      const i = (y * w + x) * 4;
      aimg.data[i] = rgb[0]; aimg.data[i + 1] = rgb[1]; aimg.data[i + 2] = rgb[2]; aimg.data[i + 3] = 255;
      const hv = (hgt * 255) | 0;
      himg.data[i] = hv; himg.data[i + 1] = hv; himg.data[i + 2] = hv; himg.data[i + 3] = 255;
    }
  }
  ac.putImageData(aimg, 0, 0);
  hc.putImageData(himg, 0, 0);
  if (nc && nimg) nc.putImageData(nimg, 0, 0);

  const map = texFrom(albedo);
  if (map) { map.wrapT = THREE.ClampToEdgeWrapping; map.repeat.set(1, 1); }
  const normalMap = texFrom(heightToNormal(height, kindKey === 'gas' ? 0.5 : 1.5), { srgb: false });
  if (normalMap) { normalMap.wrapT = THREE.ClampToEdgeWrapping; normalMap.repeat.set(1, 1); }
  const emissiveMap = night ? texFrom(night) : null;
  if (emissiveMap) { emissiveMap.wrapT = THREE.ClampToEdgeWrapping; emissiveMap.repeat.set(1, 1); }
  return { map, normalMap, emissiveMap };
}

/** 云层（带 alpha） */
export function cloudTexture(seed = 3, size = 512) {
  if (!hasDOM) return null;
  const w = size, h = size / 2;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  const s = seed * 7.7;
  for (let y = 0; y < h; y++) {
    const v = (y + 0.5) / h;
    for (let x = 0; x < w; x++) {
      const u = (x + 0.5) / w;
      const d = lonLatToDir(u, v);
      const band = Math.sin(d[1] * 9.0) * 0.12;
      const n = fbm3(d[0] * 3.4 + s, d[1] * 3.4, d[2] * 3.4 - s, 6);
      const a = clamp01((n + band - 0.52) * 3.4);
      const i = (y * w + x) * 4;
      img.data[i] = 255; img.data[i + 1] = 255; img.data[i + 2] = 255;
      img.data[i + 3] = 255 * Math.pow(a, 0.85);
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = texFrom(c);
  if (t) t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

/** 行星环贴图（径向条带 + 透明缝隙） */
export function ringTexture(seed = 5, size = 1024) {
  if (!hasDOM) return null;
  const c = makeCanvas(size, 8);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, 8);
  const rng = makeRng(seed);
  const gaps = [];
  for (let i = 0; i < 7; i++) gaps.push([rng.range(0.08, 0.95), rng.range(0.004, 0.03)]);
  for (let x = 0; x < size; x++) {
    const t = x / size;
    let a = 0.9 * (0.35 + 0.65 * Math.pow(Math.sin(Math.PI * clamp01(t * 1.02)), 0.6));
    const band = 0.55 + 0.45 * Math.sin(t * 190 + noise3(t * 40, 0.5, 0.5) * 8);
    a *= 0.55 + 0.45 * band;
    for (const [g, wd] of gaps) a *= 1 - Math.exp(-Math.pow((t - g) / wd, 2) * 0.5) * 0.98;
    a *= clamp01((t - 0.02) * 14) * clamp01((1 - t) * 12);
    const shade = 0.72 + 0.28 * band;
    for (let y = 0; y < 8; y++) {
      const i = (y * size + x) * 4;
      img.data[i] = 236 * shade;
      img.data[i + 1] = 222 * shade;
      img.data[i + 2] = 196 * shade;
      img.data[i + 3] = 255 * clamp01(a);
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = texFrom(c);
  if (t) { t.wrapS = THREE.ClampToEdgeWrapping; t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 1); }
  return t;
}

/** 舰体涂装/编号贴花 */
export function decalTexture(text = 'DSH-01', size = 512) {
  if (!hasDOM) return null;
  const c = makeCanvas(size, size / 2);
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, c.width, c.height);
  // 斜切色带
  ctx.save();
  ctx.translate(c.width * 0.06, c.height * 0.5);
  ctx.rotate(-0.06);
  ctx.fillStyle = 'rgba(60,190,255,0.92)';
  ctx.fillRect(0, -c.height * 0.06, c.width * 0.5, c.height * 0.045);
  ctx.fillStyle = 'rgba(255,90,60,0.9)';
  ctx.fillRect(0, c.height * 0.03, c.width * 0.3, c.height * 0.03);
  ctx.restore();
  ctx.fillStyle = 'rgba(232,240,248,0.95)';
  ctx.font = `bold ${Math.floor(size * 0.15)}px "Segoe UI", Arial, sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, size * 0.06, c.height * 0.34);
  ctx.font = `${Math.floor(size * 0.055)}px "Segoe UI", Arial, sans-serif`;
  ctx.fillStyle = 'rgba(200,215,230,0.8)';
  ctx.fillText('NOVA-CLASS  ·  破晓', size * 0.07, c.height * 0.66);
  const t = texFrom(c);
  if (t) { t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; }
  return t;
}

/** 单通道噪声图，供着色器用 */
export function noiseTexture(size = 256, seed = 9) {
  if (!hasDOM) return null;
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const n = fbm3(x * 0.06 + seed, y * 0.06, seed * 2, 4) * 255;
      const n2 = fbm3(x * 0.02 - seed, y * 0.02, 5.5, 3) * 255;
      img.data[i] = n; img.data[i + 1] = n2;
      img.data[i + 2] = noise3(x * 0.2, y * 0.2, seed) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return texFrom(c, { srgb: false });
}
