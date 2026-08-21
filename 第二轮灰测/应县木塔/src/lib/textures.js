// ---------------------------------------------------------------------------
// 程序化贴图（Canvas 现绘，无外部资源）：木纹 / 石作 / 瓦作 / 抹灰 / 铁件
// ---------------------------------------------------------------------------
import * as THREE from 'three';

function cv(size = 256) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  return c;
}
function fin(canvas, aniso = 8) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  return t;
}
function rnd(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 木纹：vertical=true 时纹理竖向（柱），否则横向（枋、拱） */
export function woodTexture(base = '#8a6440', vertical = false, seed = 7) {
  const S = 256;
  const c = cv(S);
  const ctx = c.getContext('2d');
  const r = rnd(seed);
  const col = new THREE.Color(base);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, S, S);
  // 年轮 / 顺纹
  for (let i = 0; i < 90; i++) {
    const k = 0.72 + r() * 0.5;
    const cc = col.clone().multiplyScalar(k);
    ctx.strokeStyle = `rgba(${(cc.r * 255) | 0},${(cc.g * 255) | 0},${(cc.b * 255) | 0},${0.25 + r() * 0.45})`;
    ctx.lineWidth = 0.6 + r() * 3.2;
    ctx.beginPath();
    if (vertical) {
      const x = r() * S;
      ctx.moveTo(x, -4);
      ctx.bezierCurveTo(x + (r() - 0.5) * 14, S * 0.33, x + (r() - 0.5) * 14, S * 0.66, x + (r() - 0.5) * 8, S + 4);
    } else {
      const y = r() * S;
      ctx.moveTo(-4, y);
      ctx.bezierCurveTo(S * 0.33, y + (r() - 0.5) * 14, S * 0.66, y + (r() - 0.5) * 14, S + 4, y + (r() - 0.5) * 8);
    }
    ctx.stroke();
  }
  // 木节
  for (let i = 0; i < 3; i++) {
    const x = r() * S;
    const y = r() * S;
    const rr = 3 + r() * 7;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rr);
    g.addColorStop(0, 'rgba(60,38,22,0.75)');
    g.addColorStop(1, 'rgba(60,38,22,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, rr, 0, Math.PI * 2);
    ctx.fill();
  }
  // 风化斑驳
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = `rgba(${r() > 0.6 ? '255,250,240' : '30,20,12'},${r() * 0.07})`;
    ctx.fillRect(r() * S, r() * S, 1 + r() * 2, 1 + r() * 2);
  }
  return fin(c);
}

/** 石作（台基、柱础）：条石砌缝 */
export function stoneTexture(base = '#9a978f', seed = 11) {
  const S = 256;
  const c = cv(S);
  const ctx = c.getContext('2d');
  const r = rnd(seed);
  const col = new THREE.Color(base);
  ctx.fillStyle = `#${col.clone().multiplyScalar(0.72).getHexString()}`;
  ctx.fillRect(0, 0, S, S);
  const rows = 5;
  const bh = S / rows;
  for (let i = 0; i < rows; i++) {
    let x = i % 2 ? -34 : -12;
    while (x < S) {
      const w = 52 + r() * 44;
      const k = 0.88 + r() * 0.26;
      const cc = col.clone().multiplyScalar(k);
      ctx.fillStyle = `#${cc.getHexString()}`;
      ctx.fillRect(x + 1.6, i * bh + 1.6, w - 3.2, bh - 3.2);
      ctx.fillStyle = 'rgba(255,255,255,0.07)';
      ctx.fillRect(x + 1.6, i * bh + 1.6, w - 3.2, 1.6);
      ctx.fillStyle = 'rgba(0,0,0,0.13)';
      ctx.fillRect(x + 1.6, i * bh + bh - 4, w - 3.2, 2.2);
      x += w;
    }
  }
  for (let i = 0; i < 1400; i++) {
    ctx.fillStyle = `rgba(0,0,0,${r() * 0.1})`;
    ctx.fillRect(r() * S, r() * S, 1.6, 1.6);
  }
  return fin(c);
}

/** 瓦作：青灰陶瓦，带细密横纹 */
export function tileTexture(base = '#5b5f66', seed = 23) {
  const S = 128;
  const c = cv(S);
  const ctx = c.getContext('2d');
  const r = rnd(seed);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 700; i++) {
    ctx.fillStyle = `rgba(${r() > 0.5 ? '255,255,255' : '0,0,0'},${r() * 0.12})`;
    ctx.fillRect(r() * S, r() * S, 1 + r() * 3, 1);
  }
  for (let y = 0; y < S; y += 16) {
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(0, y, S, 1.4);
  }
  return fin(c);
}

/** 抹灰墙（拱眼壁、板壁） */
export function plasterTexture(base = '#d9cfb8', seed = 31) {
  const S = 128;
  const c = cv(S);
  const ctx = c.getContext('2d');
  const r = rnd(seed);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, S, S);
  const col = new THREE.Color(base);
  for (let i = 0; i < 120; i++) {
    const cc = col.clone().multiplyScalar(0.9 + r() * 0.2);
    ctx.fillStyle = `rgba(${(cc.r * 255) | 0},${(cc.g * 255) | 0},${(cc.b * 255) | 0},0.5)`;
    ctx.beginPath();
    ctx.ellipse(r() * S, r() * S, 6 + r() * 26, 4 + r() * 18, r() * 3, 0, 6.3);
    ctx.fill();
  }
  for (let i = 0; i < 500; i++) {
    ctx.fillStyle = `rgba(0,0,0,${r() * 0.06})`;
    ctx.fillRect(r() * S, r() * S, 1.5, 1.5);
  }
  return fin(c);
}

/** 铁件（塔刹、铁链） */
export function ironTexture(seed = 41) {
  const S = 128;
  const c = cv(S);
  const ctx = c.getContext('2d');
  const r = rnd(seed);
  ctx.fillStyle = '#3f3b38';
  ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 500; i++) {
    const br = r();
    ctx.fillStyle = br > 0.7 ? `rgba(120,74,44,${r() * 0.5})` : `rgba(0,0,0,${r() * 0.35})`;
    ctx.beginPath();
    ctx.arc(r() * S, r() * S, 0.8 + r() * 4, 0, 6.3);
    ctx.fill();
  }
  return fin(c);
}

/** 地面 / 夯土 */
export function groundTexture(seed = 53) {
  const S = 256;
  const c = cv(S);
  const ctx = c.getContext('2d');
  const r = rnd(seed);
  ctx.fillStyle = '#9a8e78';
  ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 2600; i++) {
    ctx.fillStyle = `rgba(${r() > 0.5 ? '120,108,86' : '176,166,142'},${r() * 0.55})`;
    ctx.beginPath();
    ctx.arc(r() * S, r() * S, 0.7 + r() * 3.4, 0, 6.3);
    ctx.fill();
  }
  return fin(c);
}

/** 构件名牌 */
export function labelTexture(text, sub = '', accent = '#e0b25a') {
  const pad = 18;
  const c = document.createElement('canvas');
  const ctx0 = c.getContext('2d');
  ctx0.font = 'bold 40px "Songti SC","SimSun",serif';
  const w = Math.max(160, ctx0.measureText(text).width + pad * 2 + 10);
  c.width = Math.ceil(w);
  c.height = sub ? 92 : 62;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.fillStyle = 'rgba(22,20,18,0.82)';
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2.5;
  const rr = 8;
  ctx.beginPath();
  ctx.moveTo(rr, 2);
  ctx.lineTo(c.width - rr, 2);
  ctx.quadraticCurveTo(c.width - 2, 2, c.width - 2, 2 + rr);
  ctx.lineTo(c.width - 2, c.height - 2 - rr);
  ctx.quadraticCurveTo(c.width - 2, c.height - 2, c.width - 2 - rr, c.height - 2);
  ctx.lineTo(rr, c.height - 2);
  ctx.quadraticCurveTo(2, c.height - 2, 2, c.height - 2 - rr);
  ctx.lineTo(2, 2 + rr);
  ctx.quadraticCurveTo(2, 2, rr, 2);
  ctx.fill();
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f6efe0';
  ctx.font = 'bold 40px "Songti SC","SimSun",serif';
  ctx.fillText(text, c.width / 2, sub ? 44 : 44);
  if (sub) {
    ctx.fillStyle = accent;
    ctx.font = '20px "Segoe UI",sans-serif';
    ctx.fillText(sub, c.width / 2, 76);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return { tex: t, aspect: c.width / c.height };
}
