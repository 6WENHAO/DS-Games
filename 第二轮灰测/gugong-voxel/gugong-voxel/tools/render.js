/* =====================================================================
 * 紫禁城 体素模型 — 无头软件渲染（视觉校验 + 滤镜出图）
 *   node --max-old-space-size=6144 tools/render.js
 * 不依赖任何第三方库：自带面剔除、Z 缓冲、平行光硬阴影、AO，
 * 并复刻实时管线的后期链（HDR 缓冲 → 亮部金字塔泛光 → 云隙光 →
 * 色调映射 → 调色 → 暗角 → 颗粒），滤镜预设直接取自 js/85-post.js，
 * 与浏览器里所见保持同一套参数。
 * 输出：out/*.png
 * ===================================================================== */
'use strict';
const fs = require('fs');
const zlib = require('zlib');
const path = require('path');
const ROOT = path.join(__dirname, '..');
global.self = global;
// vendor 为 UMD 构建，在 Node 下经 module.exports 导出，需显式挂到全局供 85-post.js 取用
global.THREE = require(path.join(ROOT, 'vendor', 'three.min.js')) || global.THREE;
for (const f of ['00-palette', '10-voxel', '15-field', '20-arch', '25-comp',
                 '30-plan', '40-city', '50-outer', '60-inner', '70-build', '85-post'])
  require(path.join(ROOT, 'js', f + '.js'));
const G = globalThis;
const LIST = G.GGPalette.LIST, B = G.GGPalette.BLOCK;
const FILTERS = G.PostFX ? G.PostFX.FILTERS : null;
if (!FILTERS) { console.error('未能取到滤镜预设'); process.exit(1); }

/* ---------------- PNG 编码 ---------------- */
const CRC = (() => { const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c; }
  return t; })();
function crc32(buf) { let c = ~0; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return ~c >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}
function writePNG(file, w, h, rgb) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  fs.writeFileSync(file, Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 6 })),
    chunk('IEND', Buffer.alloc(0))
  ]));
}

/* ---------------- 体素 ---------------- */
console.log('生成体素数据…');
const res = G.BuildCity({ log: () => {} });
const v = res.world, vox = res.voxels, cells = v.cells;
console.log('可见方块 ' + vox.count);

/* ---------------- 太阳与硬阴影（按时刻缓存） ---------------- */
const OFF = 1024, KX = 1048576, KZ = 512;
function occ(x, y, z) {
  if (y < 0 || y > 511 || x < -OFF || x >= OFF || z < -OFF || z >= OFF) return false;
  return cells.has((x + OFF) * KX + (z + OFF) * KZ + y);
}
function sunVec(hour) {
  const LAT = 39.92 * Math.PI / 180, DEC = 15 * Math.PI / 180;
  const H = (hour - 12) * 15 * Math.PI / 180;
  const sa = Math.sin(DEC) * Math.sin(LAT) + Math.cos(DEC) * Math.cos(LAT) * Math.cos(H);
  const alt = Math.asin(Math.max(-1, Math.min(1, sa)));
  let az = Math.acos(Math.max(-1, Math.min(1,
    (Math.sin(DEC) - sa * Math.sin(LAT)) / (Math.cos(alt) * Math.cos(LAT)))));
  if (H > 0) az = 2 * Math.PI - az;
  return [Math.sin(az) * Math.cos(alt), Math.sin(alt), Math.cos(az) * Math.cos(alt)];
}
const sunCache = {};
function ensureSun(hour) {
  const key = hour.toFixed(2);
  if (sunCache[key]) return sunCache[key];
  const S = sunVec(hour);
  const alt = Math.asin(S[1]);
  const lit = new Uint8Array(vox.count);
  const dx = S[0], dy = S[1], dz = S[2];
  for (let i = 0; i < vox.count; i++) {
    let px = vox.xs[i] + 0.5 + dx * 1.2, py = vox.ys[i] + 0.5 + dy * 1.2, pz = vox.zs[i] + 0.5 + dz * 1.2;
    let hit = 0;
    for (let s = 0; s < 150; s++) {
      if (py > 62) break;
      if (occ(Math.floor(px), Math.floor(py), Math.floor(pz))) { hit = 1; break; }
      px += dx; py += dy; pz += dz;
    }
    lit[i] = hit ? 0 : 1;
  }
  const t = Math.min(1, Math.max(0, alt) / (55 * Math.PI / 180));
  // 日色（线性）：低日偏橙，高日近白
  const sc = [1.0 * (1 - t) + 1.0 * t, 0.45 + 0.50 * t, 0.16 + 0.72 * t];
  const o = { S, alt, lit, t, sunColor: sc };
  sunCache[key] = o;
  console.log('  太阳 ' + hour.toFixed(1) + ' 时  高度角 ' + (alt * 180 / Math.PI).toFixed(1) +
              '°  方向 ' + S.map(n => n.toFixed(2)).join(','));
  return o;
}

/* ---------------- 材质色（转线性） ---------------- */
function s2l(c) { return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
const MC = LIST.map(s => [
  s2l(((s.color >> 16) & 255) / 255),
  s2l(((s.color >> 8) & 255) / 255),
  s2l((s.color & 255) / 255)
]);

/* ---------------- 几何：六面 ---------------- */
const FACES = [
  { n: [0, 1, 0], c: [[0, 1, 0], [1, 1, 0], [1, 1, 1], [0, 1, 1]] },
  { n: [0, -1, 0], c: [[0, 0, 0], [0, 0, 1], [1, 0, 1], [1, 0, 0]] },
  { n: [1, 0, 0], c: [[1, 0, 0], [1, 0, 1], [1, 1, 1], [1, 1, 0]] },
  { n: [-1, 0, 0], c: [[0, 0, 0], [0, 1, 0], [0, 1, 1], [0, 0, 1]] },
  { n: [0, 0, 1], c: [[0, 0, 1], [0, 1, 1], [1, 1, 1], [1, 0, 1]] },
  { n: [0, 0, -1], c: [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]] }
];

/* ---------------- 场景光栅化 → 线性 HDR ---------------- */
function rasterize(opt, sunInfo) {
  const W = opt.w, H = opt.h, sc = opt.scale;
  const S = sunInfo.S, lit = sunInfo.lit, t = sunInfo.t, SC = sunInfo.sunColor;
  const az = opt.az * Math.PI / 180, el = opt.el * Math.PI / 180;
  const fx = -Math.sin(az) * Math.cos(el), fy = -Math.sin(el), fz = -Math.cos(az) * Math.cos(el);
  let rx = fz, ry = 0, rz = -fx;
  const rl = Math.hypot(rx, rz) || 1; rx /= rl; rz /= rl;
  const ux = ry * fz - rz * fy, uy = rz * fx - rx * fz, uz = rx * fy - ry * fx;
  const cx = opt.center[0], cy = opt.center[1], cz = opt.center[2];

  const zbuf = new Float32Array(W * H).fill(1e30);
  const hdr = new Float32Array(W * H * 3);

  /* 天空：与实时天空着色器同一套配色（低日暖橙、高日淡蓝），线性值 */
  const tw = Math.min(1, t * 1.25);
  const mixc = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
  const HOR_DUSK = [0.807, 0.407, 0.166];   // 0xe8ab72 转线性
  const HOR_DAY = [0.501, 0.673, 0.826];    // 0xbcd6ea
  const TOP_DUSK = [0.010, 0.041, 0.147];   // 0x1b3a6b
  const TOP_DAY = [0.028, 0.159, 0.552];    // 0x2f6ec4
  const skyHor = mixc(HOR_DUSK, HOR_DAY, tw);
  const skyTop = mixc(TOP_DUSK, TOP_DAY, t);
  // 日轮在正交视图中的屏幕位置（远距离投影，多数情况落在画外，径向模糊即成条状光束）
  const sunW = [cx + S[0] * 1500, cy + S[1] * 1500, cz + S[2] * 1500];
  const swx = ((sunW[0] - cx) * rx + (sunW[2] - cz) * rz) * sc + W / 2;
  const swy = -((sunW[0] - cx) * ux + (sunW[1] - cy) * uy + (sunW[2] - cz) * uz) * sc + H / 2;
  for (let y = 0; y < H; y++) {
    const k = 1 - y / H;
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      const g = Math.pow(k, 0.8);
      let r0 = skyHor[0] + (skyTop[0] - skyHor[0]) * g;
      let g0 = skyHor[1] + (skyTop[1] - skyHor[1]) * g;
      let b0 = skyHor[2] + (skyTop[2] - skyHor[2]) * g;
      const d = Math.hypot(x - swx, y - swy) / Math.max(1, H);
      const glow = Math.exp(-d * 5.5) * 1.5 + Math.exp(-d * 26.0) * 8.0;
      r0 += SC[0] * glow; g0 += SC[1] * glow; b0 += SC[2] * glow;
      hdr[o] = r0; hdr[o + 1] = g0; hdr[o + 2] = b0;
    }
  }

  const bb = opt.bbox;
  const sxA = new Float64Array(4), syA = new Float64Array(4);
  let drawn = 0;
  for (let i = 0; i < vox.count; i++) {
    const X = vox.xs[i], Y = vox.ys[i], Z = vox.zs[i];
    if (bb && (X < bb[0] || X > bb[3] || Y < bb[1] || Y > bb[4] || Z < bb[2] || Z > bb[5])) continue;
    const base = MC[vox.ids[i]];
    const aoF = 1 - 0.5 * Math.pow(vox.ao[i] / 26, 1.5);
    for (let f = 0; f < 6; f++) {
      const F = FACES[f], n = F.n;
      if (n[0] * fx + n[1] * fy + n[2] * fz >= 0) continue;
      if (occ(X + n[0], Y + n[1], Z + n[2])) continue;
      let lam = n[0] * S[0] + n[1] * S[1] + n[2] * S[2];
      if (lam < 0) lam = 0;
      if (!lit[i]) lam = 0;
      const amb = 0.24 + 0.18 * (n[1] * 0.5 + 0.5);
      const kd = aoF;
      const cr = base[0] * (amb * (0.45 + 0.55 * t) + lam * 1.55 * SC[0]) * kd;
      const cg = base[1] * (amb * (0.48 + 0.52 * t) + lam * 1.55 * SC[1]) * kd;
      const cb = base[2] * (amb * (0.55 + 0.45 * t) + lam * 1.55 * SC[2]) * kd;
      let minx = 1e9, maxx = -1e9, miny = 1e9, maxy = -1e9, dep = 0;
      for (let q = 0; q < 4; q++) {
        const wx = X + F.c[q][0] - cx, wy = Y + F.c[q][1] - cy, wz = Z + F.c[q][2] - cz;
        const sx = (wx * rx + wz * rz) * sc + W / 2;
        const sy = -(wx * ux + wy * uy + wz * uz) * sc + H / 2;
        sxA[q] = sx; syA[q] = sy;
        if (sx < minx) minx = sx; if (sx > maxx) maxx = sx;
        if (sy < miny) miny = sy; if (sy > maxy) maxy = sy;
        dep += wx * fx + wy * fy + wz * fz;
      }
      dep *= 0.25;
      const x0 = Math.max(0, Math.floor(minx)), x1 = Math.min(W - 1, Math.ceil(maxx));
      const y0 = Math.max(0, Math.floor(miny)), y1 = Math.min(H - 1, Math.ceil(maxy));
      if (x0 > x1 || y0 > y1) continue;
      drawn++;
      const big = (x1 - x0) > 2 || (y1 - y0) > 2;
      for (let py = y0; py <= y1; py++) {
        for (let px = x0; px <= x1; px++) {
          if (big) {
            let inside = true;
            for (let e = 0; e < 4; e++) {
              const ax = sxA[e], ay = syA[e], bx2 = sxA[(e + 1) & 3], by2 = syA[(e + 1) & 3];
              if ((bx2 - ax) * (py + 0.5 - ay) - (by2 - ay) * (px + 0.5 - ax) < -0.02) { inside = false; break; }
            }
            if (!inside) {
              let in2 = true;
              for (let e = 3; e >= 0; e--) {
                const ax = sxA[e], ay = syA[e], bx2 = sxA[(e + 3) & 3], by2 = syA[(e + 3) & 3];
                if ((bx2 - ax) * (py + 0.5 - ay) - (by2 - ay) * (px + 0.5 - ax) < -0.02) { in2 = false; break; }
              }
              if (!in2) continue;
            }
          }
          const zi = py * W + px;
          if (dep >= zbuf[zi]) continue;
          zbuf[zi] = dep;
          const o = zi * 3;
          hdr[o] = cr; hdr[o + 1] = cg; hdr[o + 2] = cb;
        }
      }
    }
  }
  return { hdr, drawn, sunScreen: [swx, swy] };
}

/* ---------------- 后期：泛光金字塔 + 云隙光 + 调色 ---------------- */
function boxBlur(src, w, h, r) {
  const tmp = new Float32Array(src.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let a = 0, b = 0, c = 0, n = 0;
    for (let d = -r; d <= r; d++) {
      const xx = Math.min(w - 1, Math.max(0, x + d)), o = (y * w + xx) * 3;
      a += src[o]; b += src[o + 1]; c += src[o + 2]; n++;
    }
    const o2 = (y * w + x) * 3;
    tmp[o2] = a / n; tmp[o2 + 1] = b / n; tmp[o2 + 2] = c / n;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let a = 0, b = 0, c = 0, n = 0;
    for (let d = -r; d <= r; d++) {
      const yy = Math.min(h - 1, Math.max(0, y + d)), o = (yy * w + x) * 3;
      a += tmp[o]; b += tmp[o + 1]; c += tmp[o + 2]; n++;
    }
    const o2 = (y * w + x) * 3;
    src[o2] = a / n; src[o2 + 1] = b / n; src[o2 + 2] = c / n;
  }
}
function bilinear(buf, w, h, u, vv, out) {
  const x = Math.min(w - 1.001, Math.max(0, u * w - 0.5));
  const y = Math.min(h - 1.001, Math.max(0, vv * h - 0.5));
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
  const x1 = Math.min(w - 1, x0 + 1), y1 = Math.min(h - 1, y0 + 1);
  for (let c = 0; c < 3; c++) {
    const a = buf[(y0 * w + x0) * 3 + c], b = buf[(y0 * w + x1) * 3 + c];
    const d = buf[(y1 * w + x0) * 3 + c], e = buf[(y1 * w + x1) * 3 + c];
    out[c] = (a * (1 - fx) + b * fx) * (1 - fy) + (d * (1 - fx) + e * fx) * fy;
  }
}
function aces(x) { return Math.max(0, Math.min(1, (x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14))); }
function filmic(x) { const y = Math.max(0, x - 0.004); return (y * (6.2 * y + 0.5)) / (y * (6.2 * y + 1.7) + 0.06); }
function l2b(c) { const s = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; return Math.max(0, Math.min(255, Math.round(s * 255))); }
function hash2(x, y) { let h = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return h - Math.floor(h); }

function post(hdr, W, H, F, sunScreen, sunColor, expo) {
  /* 亮部提取（半分辨率）+ 四级金字塔 */
  const lv = [], sz = [];
  let lw = W >> 1, lh = H >> 1;
  const l0 = new Float32Array(lw * lh * 3);
  const th = F.th, knee = 0.35;
  for (let y = 0; y < lh; y++) for (let x = 0; x < lw; x++) {
    const o = (y * lw + x) * 3;
    let r = 0, g = 0, b = 0;
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
      const s = (Math.min(H - 1, y * 2 + dy) * W + Math.min(W - 1, x * 2 + dx)) * 3;
      r += hdr[s]; g += hdr[s + 1]; b += hdr[s + 2];
    }
    r /= 4; g /= 4; b /= 4;
    const l = Math.max(r, Math.max(g, b));
    const s2 = Math.min(1, Math.max(0, (l - th + knee) / (2 * knee)));
    const w = Math.max(l - th, s2 * s2 * knee) / Math.max(1e-4, l);
    l0[o] = r * w; l0[o + 1] = g * w; l0[o + 2] = b * w;
  }
  lv.push(l0); sz.push([lw, lh]);
  boxBlur(lv[0], lw, lh, 2);
  for (let i = 1; i < 4; i++) {
    const pw = sz[i - 1][0], ph = sz[i - 1][1];
    const nw = Math.max(1, pw >> 1), nh = Math.max(1, ph >> 1);
    const d = new Float32Array(nw * nh * 3), p = lv[i - 1];
    for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) {
      const o = (y * nw + x) * 3;
      let r = 0, g = 0, b = 0;
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
        const s = (Math.min(ph - 1, y * 2 + dy) * pw + Math.min(pw - 1, x * 2 + dx)) * 3;
        r += p[s]; g += p[s + 1]; b += p[s + 2];
      }
      d[o] = r / 4; d[o + 1] = g / 4; d[o + 2] = b / 4;
    }
    boxBlur(d, nw, nh, 2);
    lv.push(d); sz.push([nw, nh]);
  }

  /* 云隙光：在亮部首级上沿日轮方向做条状累积 */
  const rays = new Float32Array(lw * lh * 3);
  if (F.ry > 0.0001) {
    const N = 24, len = 0.20 * lh;
    let ddx = sunScreen[0] / 2 - lw / 2, ddy = sunScreen[1] / 2 - lh / 2;
    const dl = Math.hypot(ddx, ddy) || 1; ddx /= dl; ddy /= dl;
    for (let y = 0; y < lh; y++) for (let x = 0; x < lw; x++) {
      let r = 0, g = 0, b = 0, w = 1, tw = 0;
      for (let s = 0; s < N; s++) {
        const px = Math.round(x + ddx * len * s / N), py = Math.round(y + ddy * len * s / N);
        if (px < 0 || py < 0 || px >= lw || py >= lh) break;
        const o = (py * lw + px) * 3;
        r += lv[0][o] * w; g += lv[0][o + 1] * w; b += lv[0][o + 2] * w;
        tw += w; w *= 0.93;
      }
      const o2 = (y * lw + x) * 3;
      if (tw > 0) { rays[o2] = r / N; rays[o2 + 1] = g / N; rays[o2 + 2] = b / N; }
    }
  }

  /* 合成 */
  const img = Buffer.alloc(W * H * 3);
  const bw = [0.42, 0.28, 0.17, 0.13];
  const tmp = [0, 0, 0];
  const aspect = W / H;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3;
      let c = [hdr[o], hdr[o + 1], hdr[o + 2]];
      const u = (x + 0.5) / W, vv = (y + 0.5) / H;
      /* 泛光 */
      if (F.bl > 0.0001) {
        for (let i = 0; i < 4; i++) {
          bilinear(lv[i], sz[i][0], sz[i][1], u, vv, tmp);
          c[0] += tmp[0] * bw[i] * F.bl; c[1] += tmp[1] * bw[i] * F.bl; c[2] += tmp[2] * bw[i] * F.bl;
        }
      }
      /* 云隙光 */
      if (F.ry > 0.0001) {
        bilinear(rays, lw, lh, u, vv, tmp);
        c[0] += tmp[0] * sunColor[0] * F.ry; c[1] += tmp[1] * sunColor[1] * F.ry; c[2] += tmp[2] * sunColor[2] * F.ry;
      }
      /* 曝光与色调映射 */
      const ex = expo * F.ex;
      c[0] *= ex; c[1] *= ex; c[2] *= ex;
      for (let i = 0; i < 3; i++) {
        if (F.tm === 3) c[i] = c[i] / (1 + c[i]);
        else if (F.tm === 2) c[i] = filmic(c[i]);
        else if (F.tm === 1) c[i] = aces(c[i]);
        else c[i] = Math.min(1, Math.max(0, c[i]));
      }
      /* 调色：先饱和度、再色偏、后增益与对比（与实时合成着色器同序） */
      const lum = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
      for (let i = 0; i < 3; i++) c[i] = lum + (c[i] - lum) * F.sa;
      c[0] *= 1 + F.tp * 0.22; c[2] *= 1 - F.tp * 0.22; c[1] *= 1 + F.ti * 0.16;
      for (let i = 0; i < 3; i++) c[i] = c[i] * F.gain[i] + F.lift[i] * (1 - c[i]);
      for (let i = 0; i < 3; i++) c[i] = (c[i] - 0.5) * F.ct + 0.5;
      for (let i = 0; i < 3; i++) c[i] = Math.min(1, Math.max(0, c[i]));
      /* 暗角 */
      if (F.vig > 0.0001) {
        const qx = (u - 0.5) * aspect, qy = vv - 0.5;
        const rr = Math.hypot(qx, qy);
        const s = Math.min(1, Math.max(0, (rr - 0.34) / (0.96 - 0.34)));
        const k = 1 - F.vig * s * s * (3 - 2 * s);
        c[0] *= k; c[1] *= k; c[2] *= k;
      }
      /* 颗粒 */
      if (F.gr > 0.0001) {
        const n = hash2(x * 0.37, y * 0.71) - 0.5;
        const lm = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
        const g = n * F.gr * (0.10 + 0.34 * (1 - lm));
        c[0] += g; c[1] += g; c[2] += g;
      }
      img[o] = l2b(c[0]); img[o + 1] = l2b(c[1]); img[o + 2] = l2b(c[2]);
    }
  }
  return img;
}

/* ---------------- 出图 ---------------- */
const OUT = path.join(ROOT, 'out');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT);
const jobs = [
  { file: 'a-全城东南鸟瞰.png', w: 1900, h: 1150, scale: 1.22, az: 152, el: 34,
    center: [0, 14, -20], bbox: null, hour: 10.2, f: 0 },
  { file: 'b-中轴正南透视.png', w: 1700, h: 950, scale: 1.35, az: 180, el: 22,
    center: [0, 16, -60], bbox: null, hour: 10.2, f: 0 },
  { file: 'c-三大殿近景.png', w: 1700, h: 1000, scale: 6.2, az: 158, el: 30,
    center: [0, 16, -70], bbox: [-150, 0, -260, 150, 60, 90], hour: 10.2, f: 0 },
  { file: 'd-太和殿正面.png', w: 1500, h: 950, scale: 11.5, az: 180, el: 15,
    center: [0, 20, -105], bbox: [-70, 0, -190, 70, 60, -40], hour: 10.2, f: 0 },
  { file: 'e-午门五凤楼.png', w: 1600, h: 950, scale: 6.0, az: 178, el: 24,
    center: [0, 16, -500], bbox: [-160, 0, -620, 160, 60, -400], hour: 10.2, f: 0 },
  { file: 'f-后三宫与御花园.png', w: 1600, h: 1000, scale: 3.4, az: 168, el: 32,
    center: [0, 14, 300], bbox: [-220, 0, 100, 220, 60, 500], hour: 10.2, f: 0 },
  { file: 'g-东南角楼.png', w: 1300, h: 900, scale: 11.0, az: 140, el: 22,
    center: [368, 22, -472], bbox: [300, 0, -540, 420, 60, -400], hour: 10.2, f: 0 },
  { file: 'h-全城正俯视平面.png', w: 1240, h: 1500, scale: 1.18, az: 180, el: 89.4,
    center: [0, 10, 0], bbox: null, hour: 10.2, f: 0 },
  /* ---- 滤镜示例 ---- */
  { file: 'i-滤镜金瓦丹墙·三大殿.png', w: 1700, h: 1000, scale: 6.2, az: 158, el: 30,
    center: [0, 16, -70], bbox: [-150, 0, -260, 150, 60, 90], hour: 9.0, f: 1 },
  { file: 'j-滤镜青绿彩画·太和殿.png', w: 1500, h: 950, scale: 11.5, az: 176, el: 16,
    center: [0, 20, -105], bbox: [-70, 0, -190, 70, 60, -40], hour: 10.2, f: 2 },
  { file: 'k-滤镜水墨·中轴.png', w: 1700, h: 950, scale: 1.35, az: 180, el: 22,
    center: [0, 16, -60], bbox: null, hour: 11.5, f: 3 },
  { file: 'l-滤镜黄昏·全城.png', w: 1900, h: 1150, scale: 1.22, az: 118, el: 20,
    center: [0, 14, -20], bbox: null, hour: 17.6, f: 4 },
  { file: 'm-滤镜月夜·后三宫.png', w: 1600, h: 1000, scale: 3.4, az: 168, el: 30,
    center: [0, 14, 300], bbox: [-220, 0, 100, 220, 60, 500], hour: 6.4, f: 5 },
  { file: 'n-滤镜旧照·午门.png', w: 1600, h: 950, scale: 6.0, az: 178, el: 24,
    center: [0, 16, -500], bbox: [-160, 0, -620, 160, 60, -400], hour: 15.5, f: 6 }
];
for (const j of jobs) {
  const t0 = Date.now();
  const si = ensureSun(j.hour);
  const r = rasterize(j, si);
  const img = post(r.hdr, j.w, j.h, FILTERS[j.f], r.sunScreen, si.sunColor, 1.06);
  writePNG(path.join(OUT, j.file), j.w, j.h, img);
  console.log('  ' + j.file.padEnd(28, ' ') + ' 滤镜 ' + FILTERS[j.f].n.padEnd(5, '\u3000') +
              ' 面片 ' + String(r.drawn).padStart(7) + '  ' + (Date.now() - t0) + ' ms');
}
console.log('\n出图完成 → ' + OUT);
