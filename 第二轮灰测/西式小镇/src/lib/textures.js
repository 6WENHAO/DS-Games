// ---------------------------------------------------------------------------
// 程序化贴图：全部用 Canvas 现场绘制，无需任何外部图片资源。
// 每张贴图都是可平铺 (tileable) 的，世界尺寸→UV 由 geom.js 负责换算。
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { mulberry32 } from './rng.js';

function makeCanvas(size = 256) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  return c;
}

function finish(canvas, { aniso = 8, srgb = true } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  t.needsUpdate = true;
  return t;
}

/** 在画布上撒一层细噪点，制造手工模型的粗糙质感 */
function speckle(ctx, size, count, alpha, dark = true) {
  for (let i = 0; i < count; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = Math.random() * 2 + 0.4;
    ctx.fillStyle = dark
      ? `rgba(0,0,0,${alpha * Math.random()})`
      : `rgba(255,255,255,${alpha * Math.random()})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

/* ---------------------------------- 砖墙 --------------------------------- */
export function brickTexture(brick = '#a8503c', mortar = '#d9cbb4', seed = 7) {
  const S = 256;
  const c = makeCanvas(S);
  const ctx = c.getContext('2d');
  const rnd = mulberry32(seed);
  ctx.fillStyle = mortar;
  ctx.fillRect(0, 0, S, S);

  const rows = 8;
  const bh = S / rows;
  const bw = S / 4;
  const base = new THREE.Color(brick);
  for (let r = 0; r < rows; r++) {
    const off = r % 2 === 0 ? 0 : -bw / 2;
    for (let i = -1; i < 5; i++) {
      const x = i * bw + off;
      const y = r * bh;
      const k = 0.82 + rnd() * 0.32;
      const col = base.clone().multiplyScalar(k);
      ctx.fillStyle = `#${col.getHexString()}`;
      ctx.fillRect(x + 1.4, y + 1.4, bw - 2.8, bh - 2.8);
      // 砖块高光/阴影
      ctx.fillStyle = 'rgba(255,255,255,0.07)';
      ctx.fillRect(x + 1.4, y + 1.4, bw - 2.8, 1.6);
      ctx.fillStyle = 'rgba(0,0,0,0.10)';
      ctx.fillRect(x + 1.4, y + bh - 3.4, bw - 2.8, 2);
    }
  }
  speckle(ctx, S, 500, 0.13);
  return finish(c);
}

/* --------------------------------- 抹灰墙 -------------------------------- */
export function plasterTexture(color = '#efe3cd', seed = 11) {
  const S = 256;
  const c = makeCanvas(S);
  const ctx = c.getContext('2d');
  const rnd = mulberry32(seed);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, S, S);
  const base = new THREE.Color(color);
  for (let i = 0; i < 150; i++) {
    const k = 0.9 + rnd() * 0.18;
    const col = base.clone().multiplyScalar(k);
    ctx.fillStyle = `rgba(${(col.r * 255) | 0},${(col.g * 255) | 0},${(col.b * 255) | 0},0.5)`;
    const x = rnd() * S;
    const y = rnd() * S;
    const w = 12 + rnd() * 60;
    const h = 8 + rnd() * 40;
    ctx.beginPath();
    ctx.ellipse(x, y, w, h, rnd() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  speckle(ctx, S, 900, 0.07);
  speckle(ctx, S, 400, 0.07, false);
  return finish(c);
}

/* --------------------------------- 屋顶瓦 -------------------------------- */
export function tileTexture(color = '#a8412f', seed = 3) {
  const S = 256;
  const c = makeCanvas(S);
  const ctx = c.getContext('2d');
  const rnd = mulberry32(seed);
  const base = new THREE.Color(color);
  ctx.fillStyle = `#${base.clone().multiplyScalar(0.6).getHexString()}`;
  ctx.fillRect(0, 0, S, S);

  const rows = 8;
  const th = S / rows;
  const tw = S / 8;
  for (let r = 0; r < rows; r++) {
    const off = r % 2 ? tw / 2 : 0;
    for (let i = -1; i < 9; i++) {
      const x = i * tw + off;
      const y = r * th;
      const k = 0.85 + rnd() * 0.3;
      const col = base.clone().multiplyScalar(k);
      ctx.fillStyle = `#${col.getHexString()}`;
      ctx.beginPath();
      // 圆头瓦片
      ctx.moveTo(x + 0.8, y + th - 0.8);
      ctx.lineTo(x + 0.8, y + th * 0.45);
      ctx.quadraticCurveTo(x + tw / 2, y - th * 0.15, x + tw - 0.8, y + th * 0.45);
      ctx.lineTo(x + tw - 0.8, y + th - 0.8);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.22)';
      ctx.lineWidth = 1;
      ctx.stroke();
      // 上缘高光
      ctx.fillStyle = 'rgba(255,255,255,0.10)';
      ctx.fillRect(x + 2, y + th * 0.5, tw - 4, 1.5);
    }
  }
  speckle(ctx, S, 600, 0.12);
  return finish(c);
}

/* ---------------------------------- 石板 -------------------------------- */
export function stoneTexture(color = '#b9b3a6', seed = 23) {
  const S = 256;
  const c = makeCanvas(S);
  const ctx = c.getContext('2d');
  const rnd = mulberry32(seed);
  const base = new THREE.Color(color);
  ctx.fillStyle = `#${base.clone().multiplyScalar(0.72).getHexString()}`;
  ctx.fillRect(0, 0, S, S);
  const rows = 6;
  const bh = S / rows;
  for (let r = 0; r < rows; r++) {
    let x = r % 2 ? -30 : -10;
    while (x < S) {
      const w = 40 + rnd() * 46;
      const k = 0.86 + rnd() * 0.28;
      const col = base.clone().multiplyScalar(k);
      ctx.fillStyle = `#${col.getHexString()}`;
      ctx.fillRect(x + 2, r * bh + 2, w - 4, bh - 4);
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(x + 2, r * bh + 2, w - 4, 2);
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.fillRect(x + 2, r * bh + bh - 5, w - 4, 2.5);
      x += w;
    }
  }
  speckle(ctx, S, 800, 0.12);
  return finish(c);
}

/* --------------------------------- 木板 --------------------------------- */
export function woodTexture(color = '#8a5a34', vertical = false, seed = 31) {
  const S = 256;
  const c = makeCanvas(S);
  const ctx = c.getContext('2d');
  const rnd = mulberry32(seed);
  const base = new THREE.Color(color);
  ctx.fillStyle = `#${base.getHexString()}`;
  ctx.fillRect(0, 0, S, S);
  const planks = 6;
  const pw = S / planks;
  for (let i = 0; i < planks; i++) {
    const k = 0.82 + rnd() * 0.36;
    const col = base.clone().multiplyScalar(k);
    ctx.save();
    if (vertical) ctx.translate(0, 0);
    ctx.fillStyle = `#${col.getHexString()}`;
    if (vertical) ctx.fillRect(i * pw, 0, pw - 1.5, S);
    else ctx.fillRect(0, i * pw, S, pw - 1.5);
    // 木纹
    ctx.strokeStyle = `rgba(0,0,0,0.14)`;
    for (let g = 0; g < 7; g++) {
      ctx.lineWidth = 0.6 + rnd();
      ctx.beginPath();
      if (vertical) {
        const x = i * pw + rnd() * pw;
        ctx.moveTo(x, 0);
        ctx.bezierCurveTo(x + 3, S * 0.3, x - 3, S * 0.7, x, S);
      } else {
        const y = i * pw + rnd() * pw;
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(S * 0.3, y + 3, S * 0.7, y - 3, S, y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  for (let i = 0; i < planks; i++) {
    if (vertical) ctx.fillRect(i * pw - 1, 0, 2, S);
    else ctx.fillRect(0, i * pw - 1, S, 2);
  }
  speckle(ctx, S, 400, 0.1);
  return finish(c);
}

/* -------------------------------- 鹅卵石路 ------------------------------- */
export function cobbleTexture(color = '#8e8779', seed = 5) {
  const S = 256;
  const c = makeCanvas(S);
  const ctx = c.getContext('2d');
  const rnd = mulberry32(seed);
  const base = new THREE.Color(color);
  ctx.fillStyle = `#${base.clone().multiplyScalar(0.55).getHexString()}`;
  ctx.fillRect(0, 0, S, S);
  const n = 13;
  const step = S / n;
  for (let gy = -1; gy <= n; gy++) {
    for (let gx = -1; gx <= n; gx++) {
      const off = gy % 2 ? step / 2 : 0;
      const x = gx * step + off + (rnd() - 0.5) * step * 0.3;
      const y = gy * step + (rnd() - 0.5) * step * 0.3;
      const r = step * (0.42 + rnd() * 0.2);
      const k = 0.78 + rnd() * 0.45;
      const col = base.clone().multiplyScalar(k);
      ctx.fillStyle = `#${col.getHexString()}`;
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * (0.75 + rnd() * 0.35), rnd() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.beginPath();
      ctx.ellipse(x - r * 0.2, y - r * 0.25, r * 0.5, r * 0.32, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  speckle(ctx, S, 700, 0.14);
  return finish(c);
}

/* --------------------------------- 草地 --------------------------------- */
export function grassTexture(color = '#7c9a52', seed = 17) {
  const S = 256;
  const c = makeCanvas(S);
  const ctx = c.getContext('2d');
  const rnd = mulberry32(seed);
  const base = new THREE.Color(color);
  ctx.fillStyle = `#${base.getHexString()}`;
  ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 2600; i++) {
    const x = rnd() * S;
    const y = rnd() * S;
    const k = 0.7 + rnd() * 0.6;
    const col = base.clone().multiplyScalar(k);
    ctx.strokeStyle = `#${col.getHexString()}`;
    ctx.lineWidth = 0.9 + rnd() * 1.2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rnd() - 0.5) * 4, y - 2 - rnd() * 5);
    ctx.stroke();
  }
  for (let i = 0; i < 60; i++) {
    // 零星小花
    const x = rnd() * S;
    const y = rnd() * S;
    ctx.fillStyle = rnd() > 0.5 ? 'rgba(255,240,190,0.75)' : 'rgba(240,200,225,0.7)';
    ctx.beginPath();
    ctx.arc(x, y, 1.2 + rnd(), 0, Math.PI * 2);
    ctx.fill();
  }
  return finish(c);
}

/* --------------------------------- 泥土 --------------------------------- */
export function dirtTexture(color = '#9a7a52', seed = 41) {
  const S = 128;
  const c = makeCanvas(S);
  const ctx = c.getContext('2d');
  const rnd = mulberry32(seed);
  const base = new THREE.Color(color);
  ctx.fillStyle = `#${base.getHexString()}`;
  ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 500; i++) {
    const k = 0.75 + rnd() * 0.5;
    const col = base.clone().multiplyScalar(k);
    ctx.fillStyle = `#${col.getHexString()}`;
    ctx.beginPath();
    ctx.arc(rnd() * S, rnd() * S, 1 + rnd() * 4, 0, Math.PI * 2);
    ctx.fill();
  }
  return finish(c);
}

/* --------------------------------- 水面 --------------------------------- */
export function waterTexture(seed = 61) {
  const S = 256;
  const c = makeCanvas(S);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(S, S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const v =
        Math.sin(x * 0.09) * 0.5 +
        Math.sin(y * 0.11 + 1.7) * 0.5 +
        Math.sin((x + y) * 0.055) * 0.4 +
        Math.sin((x - y) * 0.07 + 2.1) * 0.3;
      const t = (v + 1.7) / 3.4;
      const i = (y * S + x) * 4;
      img.data[i] = 40 + t * 60;
      img.data[i + 1] = 90 + t * 80;
      img.data[i + 2] = 120 + t * 95;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return finish(c);
}

/* --------------------------------- 茅草 --------------------------------- */
export function thatchTexture(color = '#c19a4e', seed = 73) {
  const S = 256;
  const c = makeCanvas(S);
  const ctx = c.getContext('2d');
  const rnd = mulberry32(seed);
  const base = new THREE.Color(color);
  ctx.fillStyle = `#${base.clone().multiplyScalar(0.7).getHexString()}`;
  ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 3000; i++) {
    const k = 0.7 + rnd() * 0.65;
    const col = base.clone().multiplyScalar(k);
    ctx.strokeStyle = `#${col.getHexString()}`;
    ctx.lineWidth = 1 + rnd() * 1.6;
    const x = rnd() * S;
    const y = rnd() * S;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (rnd() - 0.5) * 6, y + 6 + rnd() * 10);
    ctx.stroke();
  }
  return finish(c);
}

/* ------------------------------ 彩色玻璃窗 ------------------------------- */
export function stainedGlassTexture(seed = 91) {
  const S = 256;
  const c = makeCanvas(S);
  const ctx = c.getContext('2d');
  const rnd = mulberry32(seed);
  ctx.fillStyle = '#20222c';
  ctx.fillRect(0, 0, S, S);
  const cols = ['#c0392b', '#2e6da4', '#d4a017', '#2e8b57', '#7d3c98', '#c95b8e'];
  const cx = S / 2;
  const cy = S / 2;
  for (let ring = 5; ring >= 1; ring--) {
    const r = (ring / 5) * S * 0.48;
    const petals = ring * 4;
    for (let p = 0; p < petals; p++) {
      const a0 = (p / petals) * Math.PI * 2;
      const a1 = ((p + 0.86) / petals) * Math.PI * 2;
      ctx.fillStyle = cols[Math.floor(rnd() * cols.length)];
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, a0, a1);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.fillStyle = '#f7e7b0';
  ctx.beginPath();
  ctx.arc(cx, cy, S * 0.07, 0, Math.PI * 2);
  ctx.fill();
  return finish(c);
}

/* ------------------------- 光晕 / 烟雾 / 星星 精灵 ------------------------ */
export function glowTexture(inner = 'rgba(255,240,200,1)', outer = 'rgba(255,190,90,0)') {
  const S = 128;
  const c = makeCanvas(S);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, inner);
  g.addColorStop(0.35, inner.replace(/[\d.]+\)$/, '0.55)'));
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function smokeTexture() {
  const S = 128;
  const c = makeCanvas(S);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(S / 2, S / 2, 2, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.5, 'rgba(240,240,245,0.35)');
  g.addColorStop(1, 'rgba(230,230,240,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ----------------------------- 区域名牌贴图 ----------------------------- */
export function labelTexture(title, sub, accent = '#e9c46a') {
  const W = 512;
  const H = 160;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, W, H);

  // 底板
  const r = 18;
  ctx.fillStyle = 'rgba(24,22,28,0.78)';
  ctx.beginPath();
  ctx.moveTo(r, 8);
  ctx.lineTo(W - r, 8);
  ctx.quadraticCurveTo(W - 8, 8, W - 8, 8 + r);
  ctx.lineTo(W - 8, H - 30 - r);
  ctx.quadraticCurveTo(W - 8, H - 30, W - 8 - r, H - 30);
  ctx.lineTo(W / 2 + 16, H - 30);
  ctx.lineTo(W / 2, H - 8);
  ctx.lineTo(W / 2 - 16, H - 30);
  ctx.lineTo(8 + r, H - 30);
  ctx.quadraticCurveTo(8, H - 30, 8, H - 30 - r);
  ctx.lineTo(8, 8 + r);
  ctx.quadraticCurveTo(8, 8, 8 + r, 8);
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#fdf6e6';
  ctx.font = 'bold 46px "Georgia","Times New Roman",serif';
  ctx.fillText(title, W / 2, 62);
  ctx.fillStyle = accent;
  ctx.font = 'italic 26px "Georgia",serif';
  ctx.fillText(sub, W / 2, 100);

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** 商店招牌贴图 */
export function signTexture(text, bg = '#2f4858', fg = '#f2e3bd') {
  const W = 256;
  const H = 96;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = fg;
  ctx.lineWidth = 5;
  ctx.strokeRect(7, 7, W - 14, H - 14);
  ctx.fillStyle = fg;
  ctx.textAlign = 'center';
  ctx.font = 'bold 34px "Georgia",serif';
  ctx.fillText(text, W / 2, H / 2 + 12);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
