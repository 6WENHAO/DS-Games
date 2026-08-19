// Procedurally generated PBR-ish texture set (no external assets, fully offline).
import * as THREE from 'three';
import { simplex2, fbm2, ridged2, hash2 } from './noise.js';

function canvas(size) { const c = document.createElement('canvas'); c.width = c.height = size; return c; }

/** Build albedo + normal + roughness from a per-pixel callback. */
function buildMaterialMaps(size, shade, opts = {}) {
  const c = canvas(size), ctx = c.getContext('2d', { willReadFrequently: true });
  const img = ctx.createImageData(size, size);
  const hmap = new Float32Array(size * size);
  const rmap = new Float32Array(size * size);
  const out = { r: 0, g: 0, b: 0, h: 0, rough: 0.9 };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    out.rough = 0.9; shade(x, y, x / size, y / size, out);
    const i = y * size + x, p = i * 4;
    img.data[p] = out.r * 255; img.data[p + 1] = out.g * 255; img.data[p + 2] = out.b * 255; img.data[p + 3] = 255;
    hmap[i] = out.h; rmap[i] = out.rough;
  }
  ctx.putImageData(img, 0, 0);
  const albedo = new THREE.CanvasTexture(c);
  albedo.colorSpace = THREE.SRGBColorSpace;

  // normal from height (sobel, wrapping)
  const nc = canvas(size), nctx = nc.getContext('2d');
  const nimg = nctx.createImageData(size, size);
  const S = opts.normalStrength ?? 2.4;
  const at = (x, y) => hmap[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (at(x - 1, y) - at(x + 1, y)) * S, dy = (at(x, y - 1) - at(x, y + 1)) * S;
    let nx = dx, ny = dy, nz = 1; const l = Math.hypot(nx, ny, nz);
    const p = (y * size + x) * 4;
    nimg.data[p] = (nx / l * 0.5 + 0.5) * 255; nimg.data[p + 1] = (ny / l * 0.5 + 0.5) * 255;
    nimg.data[p + 2] = (nz / l * 0.5 + 0.5) * 255; nimg.data[p + 3] = 255;
  }
  nctx.putImageData(nimg, 0, 0);
  const normal = new THREE.CanvasTexture(nc);

  const rc = canvas(size), rctx = rc.getContext('2d');
  const rimg = rctx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) { const v = rmap[i] * 255, p = i * 4; rimg.data[p] = rimg.data[p + 1] = rimg.data[p + 2] = v; rimg.data[p + 3] = 255; }
  rctx.putImageData(rimg, 0, 0);
  const rough = new THREE.CanvasTexture(rc);

  for (const t of [albedo, normal, rough]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.needsUpdate = true; }
  return { map: albedo, normalMap: normal, roughnessMap: rough };
}

export function makeTerrainTextures(size = 256) {
  const F = size / 256;
  const grass = buildMaterialMaps(size, (x, y, u, v, o) => {
    const n = fbm2(u * 22, v * 22, 4), blade = simplex2(u * 150, v * 42) * 0.5 + simplex2(u * 41, v * 190) * 0.5;
    const patch = fbm2(u * 5.5 + 12, v * 5.5 - 3, 3);
    const t = 0.5 + n * 0.28 + blade * 0.16;
    o.r = 0.20 + t * 0.20 + patch * 0.09;
    o.g = 0.34 + t * 0.31 + patch * 0.05;
    o.b = 0.13 + t * 0.14 - patch * 0.02;
    const dead = Math.max(0, patch * 1.4 - 0.55);
    o.r += dead * 0.28; o.g += dead * 0.18; o.b += dead * 0.02;
    o.h = n * 0.5 + blade * 0.35; o.rough = 0.88 - t * 0.1;
  }, { normalStrength: 0.95 });

  const rock = buildMaterialMaps(size, (x, y, u, v, o) => {
    const strat = simplex2(u * 8, v * 34) * 0.5 + fbm2(u * 15, v * 15, 4) * 0.5;
    const crack = Math.pow(ridged2(u * 9 + 3, v * 9 - 7, 4), 3.0);
    const grain = fbm2(u * 90, v * 90, 2) * 0.5;
    let t = 0.46 + strat * 0.22 + grain * 0.12 - crack * 0.42;
    o.r = t * 0.98 + 0.06; o.g = t * 0.95 + 0.06; o.b = t * 0.92 + 0.07;
    const moss = Math.max(0, fbm2(u * 6 - 21, v * 6 + 8, 3) * 1.5 - 0.45);
    o.r -= moss * 0.10; o.g += moss * 0.07; o.b -= moss * 0.06;
    o.h = strat * 0.6 - crack * 1.6 + grain * 0.3; o.rough = 0.94 - moss * 0.06;
  }, { normalStrength: 3.1 });

  const dirt = buildMaterialMaps(size, (x, y, u, v, o) => {
    const n = fbm2(u * 26 + 4, v * 26 - 9, 4), pebble = Math.max(0, simplex2(u * 110, v * 110) - 0.55) * 2.2;
    const t = 0.5 + n * 0.3;
    o.r = 0.30 + t * 0.26 + pebble * 0.12; o.g = 0.22 + t * 0.19 + pebble * 0.11; o.b = 0.14 + t * 0.12 + pebble * 0.10;
    o.h = n * 0.6 + pebble * 0.9; o.rough = 0.95;
  }, { normalStrength: 2.2 });

  const sand = buildMaterialMaps(size, (x, y, u, v, o) => {
    const ripple = Math.sin(u * 58 + fbm2(u * 6, v * 6, 2) * 5.5) * 0.5 + 0.5;
    const grain = fbm2(u * 190, v * 190, 2);
    const t = 0.72 + ripple * 0.1 + grain * 0.1;
    o.r = t * 0.94; o.g = t * 0.84; o.b = t * 0.63;
    o.h = ripple * 0.5 + grain * 0.5; o.rough = 0.82;
  }, { normalStrength: 1.5 });

  const snow = buildMaterialMaps(size, (x, y, u, v, o) => {
    const n = fbm2(u * 18, v * 18, 4), sparkle = Math.max(0, simplex2(u * 260, v * 260) - 0.7) * 3;
    const t = 0.72 + n * 0.07 + sparkle * 0.10;
    o.r = Math.min(1, t * 0.96); o.g = Math.min(1, t * 0.975); o.b = Math.min(1, t * 1.0);
    o.h = n * 0.8; o.rough = 0.45 - sparkle * 0.25;
  }, { normalStrength: 1.4 });

  return { grass, rock, dirt, sand, snow };
}

/** Tiling normal map for the water surface (used by three's Water addon). */
export function makeWaterNormals(size = 256) {
  const c = canvas(size), ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const H = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size;
    H[y * size + x] = fbm2(u * 8, v * 8, 4) * 0.6 + Math.sin((u * 12 + fbm2(u * 4, v * 4, 2) * 3) * Math.PI) * 0.25 + fbm2(u * 30, v * 30, 2) * 0.18;
  }
  const at = (x, y) => H[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (at(x - 1, y) - at(x + 1, y)) * 3.0, dy = (at(x, y - 1) - at(x, y + 1)) * 3.0;
    const l = Math.hypot(dx, dy, 1), p = (y * size + x) * 4;
    img.data[p] = (dx / l * .5 + .5) * 255; img.data[p + 1] = (dy / l * .5 + .5) * 255; img.data[p + 2] = (1 / l * .5 + .5) * 255; img.data[p + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

/** Soft radial sprite (particles, glows, light shafts). */
export function makeGlowTexture(size = 128, power = 2.4, color = '#ffffff') {
  const c = canvas(size), ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (let i = 0; i <= 10; i++) { const t = i / 10; g.addColorStop(t, `rgba(255,255,255,${Math.pow(1 - t, power).toFixed(4)})`); }
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  if (color !== '#ffffff') { ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = color; ctx.fillRect(0, 0, size, size); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/** Cel-shading ramp for MeshToonMaterial: hard 2-3 step anime lighting. */
export function makeToonRamp(steps = [0.0, 0.42, 0.62, 1.0], colors = [0.42, 0.66, 0.88, 1.0]) {
  const w = 64, c = canvas(w); c.height = 1;
  const ctx = c.getContext('2d'), img = ctx.createImageData(w, 1);
  for (let i = 0; i < w; i++) {
    const t = i / (w - 1); let v = colors[0];
    for (let s = 0; s < steps.length; s++) if (t >= steps[s]) v = colors[Math.min(colors.length - 1, s)];
    const p = i * 4; img.data[p] = img.data[p + 1] = img.data[p + 2] = v * 255; img.data[p + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Star field for the night sky dome. */
export function makeStarTexture(size = 1024) {
  const c = canvas(size), ctx = c.getContext('2d');
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 2600; i++) {
    const x = Math.random() * size, y = Math.random() * size;
    const r = Math.pow(Math.random(), 3.2) * 1.9 + 0.25, a = 0.35 + Math.random() * 0.65;
    const tint = Math.random(); const col = tint < .7 ? '255,255,255' : tint < .85 ? '190,215,255' : '255,225,190';
    ctx.fillStyle = `rgba(${col},${a})`; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
  }
  // milky way band
  for (let i = 0; i < 9000; i++) {
    const t = Math.random(); const x = t * size;
    const y = size * 0.5 + Math.sin(t * 3.1) * size * 0.13 + (Math.random() - 0.5) * size * 0.1 * (1 + Math.sin(t * 7) * .4);
    ctx.fillStyle = `rgba(210,225,255,${0.03 + Math.random() * 0.09})`;
    ctx.fillRect(x, y, 1.2, 1.2);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
