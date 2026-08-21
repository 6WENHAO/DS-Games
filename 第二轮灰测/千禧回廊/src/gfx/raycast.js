// ============================================================================
//  raycast.js —— 光线投射渲染器
//  · 墙：DDA + 纹理映射 + 四面独立贴图
//  · 地/顶：逐行投射（可 per-cell 换材质，null 处露出天空全景）
//  · 精灵：广告牌 + z-buffer 遮挡
//  · 光：区域环境光 + 点光源（白炽灯的暖）+ 距离暖雾
//  · 后处理：暗角、颗粒、扫描线、闪烁、色偏
//  输出裸 RGBA，因此浏览器 putImageData / Node 编码 PNG 都能用同一份代码
// ============================================================================

import { rgba } from './pixels.js';
import { tex, TS } from './textures.js';
import { skyPanorama, PW, PH, MAX_ELEV } from './sky.js';

// 点光源统一增益：场景里的 i 只是相对权重，真正的"曝光"在这里定
// （调大 = 灯更抢戏、更容易过曝；调小 = 更依赖环境光、更平）
const POINT_LIGHT_GAIN = 0.92;

// 高光肩部：0.62 以下线性保留（保住暖调中间调），以上指数收敛，永远到不了纯白
// 用 1024 项查表，逐像素只做三次数组取值 —— 基本不要钱
const TONE = (() => {
  const t = 0.62, n = 1024;
  const lut = new Uint8ClampedArray(n);
  for (let i = 0; i < n; i++) {
    const x = (i / 255);
    const y = x <= t ? x : t + (1 - t) * (1 - Math.exp(-(x - t) / (1 - t)));
    lut[i] = Math.round(y * 255);
  }
  return lut;
})();
const tone = (v) => TONE[v < 0 ? 0 : v > 1023 ? 1023 : v | 0];

export class Renderer {
  constructor(w, h) {
    this.w = w; this.h = h;
    this.hdr = new Float32Array(w * h * 4);      // 渲染过程用浮点，允许过曝
    this.data = new Uint8ClampedArray(w * h * 4); // 后处理后的最终 8bit 输出
    this.zbuf = new Float32Array(w);
    this.frame = 0;
    this._vig = null;
    this._buildVignette();
  }

  resize(w, h) {
    if (w === this.w && h === this.h) return;
    this.w = w; this.h = h;
    this.hdr = new Float32Array(w * h * 4);
    this.data = new Uint8ClampedArray(w * h * 4);
    this.zbuf = new Float32Array(w);
    this._buildVignette();
  }

  _buildVignette() {
    const { w, h } = this;
    const v = new Float32Array(w * h);
    const cx = w / 2, cy = h / 2;
    const maxR = Math.sqrt(cx * cx + cy * cy);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dx = (x - cx) / maxR, dy = (y - cy) / maxR;
        const rn = Math.sqrt(dx * dx + dy * dy);   // 0 = 画面中心，1 = 四角
        v[y * w + x] = 1 - 0.4 * Math.pow(rn, 2.1);
      }
    }
    this._vig = v;
  }

  /**
   * @param world { w,h, walls, floors, ceils, amb, lights, sprites }
   * @param cam   { x, y, a, fov, ez, pitch }
   * @param fx    { darkness, flicker, grain, scanlines, tint, tintAmount, sat }
   */
  render(world, cam, fx = {}) {
    this.frame++;
    const W = this.w, H = this.h, out = this.hdr, zb = this.zbuf;
    const fov = cam.fov ?? 1.15;
    const L = Math.tan(fov / 2);
    const focal = (W / 2) / L;
    const ez = cam.ez ?? 1.62;          // 眼高（米）
    const wallH = world.wallH ?? 2.6;   // 层高（米）；一格 = 一米
    const hy = Math.round(H / 2 + (cam.pitch || 0));

    const dirX = Math.cos(cam.a), dirY = Math.sin(cam.a);
    const planeX = -dirY * L, planeY = dirX * L;

    const amb = world.amb;
    const fogC = amb._fogRGB || (amb._fogRGB = rgba(amb.fog));
    const fogStart = amb.fogStart, fogSpan = Math.max(0.001, amb.fogEnd - amb.fogStart);
    const baseLight = (amb.light ?? 1) * (fx.darkness ?? 1) * (fx.flicker ?? 1);

    // —— 点光源打包 ——
    const lights = world.lights || [];
    const nL = lights.length;
    const lx = this._lx || (this._lx = new Float64Array(32));
    const ly = this._ly || (this._ly = new Float64Array(32));
    const lrad = this._lrad || (this._lrad = new Float64Array(32));
    const lint = this._lint || (this._lint = new Float64Array(32));
    const lcol = this._lcol || (this._lcol = new Float64Array(96));
    const nl = Math.min(nL, 32);
    for (let i = 0; i < nl; i++) {
      const g = lights[i];
      lx[i] = g.x; ly[i] = g.y; lrad[i] = g.r;
      lint[i] = (g.i ?? 1) * (g.on === false ? 0 : 1) * (g._flick ?? 1) * POINT_LIGHT_GAIN;
      const c = g._rgb || (g._rgb = rgba(g.color || '#ffe6b0'));
      lcol[i * 3] = c[0] / 255; lcol[i * 3 + 1] = c[1] / 255; lcol[i * 3 + 2] = c[2] / 255;
    }

    const wallsG = world.walls, floorsG = world.floors, ceilsG = world.ceils;
    const mapW = world.w, mapH = world.h;

    // ===================================================================
    //  1) 天空全景（只在有露天格子的区域用得上，但先铺底最省事）
    // ===================================================================
    const useSky = !!amb.sky;
    if (useSky) {
      const sky = skyPanorama();
      const sd = sky.data;
      for (let y = 0; y < Math.min(H, Math.max(0, hy + 1)); y++) {
        const elev = Math.atan((hy - y) / focal);
        let v = Math.round((1 - elev / MAX_ELEV) * (PH - 1));
        if (v < 0) v = 0; if (v > PH - 1) v = PH - 1;
        const rowOff = v * PW;
        for (let x = 0; x < W; x++) {
          const camX = (x * 2) / W - 1;
          const rx = dirX + planeX * camX, ry = dirY + planeY * camX;
          let az = Math.atan2(ry, rx);
          if (az < 0) az += Math.PI * 2;
          let u = Math.round((az / (Math.PI * 2)) * PW) % PW;
          const si = (rowOff + u) * 4, di = (y * W + x) * 4;
          out[di] = sd[si]; out[di + 1] = sd[si + 1]; out[di + 2] = sd[si + 2]; out[di + 3] = 255;
        }
      }
      // 地平线以下先铺暖霾，随后被地面覆盖（大俯仰时 hy 会跑到屏幕外，要夹住）
      for (let y = Math.max(0, hy + 1); y < H; y++) {
        const di0 = y * W * 4;
        for (let x = 0; x < W; x++) {
          const di = di0 + x * 4;
          out[di] = fogC[0]; out[di + 1] = fogC[1]; out[di + 2] = fogC[2]; out[di + 3] = 255;
        }
      }
    } else {
      // 室内：先用雾色铺满，防止空洞
      for (let i = 0; i < out.length; i += 4) {
        out[i] = fogC[0]; out[i + 1] = fogC[1]; out[i + 2] = fogC[2]; out[i + 3] = 255;
      }
    }

    // ===================================================================
    //  2) 地面 + 天花（逐行投射）
    // ===================================================================
    const cxL = -L, cxR = L; // 最左/最右列的相机平面偏移
    const rayLX = dirX + planeX * (cxL / L), rayLY = dirY + planeY * (cxL / L);
    const rayRX = dirX + planeX * (cxR / L), rayRY = dirY + planeY * (cxR / L);

    for (let y = 0; y < H; y++) {
      const below = y > hy;
      const p = below ? y - hy : hy - y;
      if (p <= 0) continue;
      const dist = below ? (ez * focal) / p : ((wallH - ez) * focal) / p;
      if (dist > amb.fogEnd * 2.2 && !useSky) continue;

      // 该行两端的世界坐标
      const wLX = cam.x + rayLX * dist, wLY = cam.y + rayLY * dist;
      const wRX = cam.x + rayRX * dist, wRY = cam.y + rayRY * dist;
      const stepX = (wRX - wLX) / W, stepY = (wRY - wLY) / W;
      let wx = wLX, wy = wLY;

      // 雾
      let fogF = (dist - fogStart) / fogSpan;
      fogF = fogF < 0 ? 0 : fogF > 1 ? 1 : fogF;
      fogF = fogF * fogF * (3 - 2 * fogF);
      const distShade = baseLight * (below ? 1 : 0.94);

      const rowOff = y * W * 4;
      for (let x = 0; x < W; x++, wx += stepX, wy += stepY) {
        const mx = Math.floor(wx), my = Math.floor(wy);
        if (mx < 0 || my < 0 || mx >= mapW || my >= mapH) continue;
        const name = below ? floorsG[my][mx] : ceilsG[my][mx];
        if (!name) continue;                 // 露天 → 保留天空
        const t = tex(name);
        const td = t.data;
        const tx = ((wx - mx) * TS) | 0, ty = ((wy - my) * TS) | 0;
        const ti = (ty * TS + tx) * 4;
        const em = t.emit ? t.emit[ty * TS + tx] / 255 : 0;

        let sh = distShade;
        // 点光
        let ar = 0, ag = 0, ab = 0;
        for (let i = 0; i < nl; i++) {
          if (lint[i] <= 0) continue;
          const ddx = wx - lx[i], ddy = wy - ly[i];
          const d2 = ddx * ddx + ddy * ddy;
          const rr = lrad[i];
          if (d2 >= rr * rr) continue;
          const att = 1 - Math.sqrt(d2) / rr;
          const k = att * att * lint[i];
          ar += lcol[i * 3] * k; ag += lcol[i * 3 + 1] * k; ab += lcol[i * 3 + 2] * k;
        }
        if (em > 0) sh = sh + em * 1.15;
        let r = td[ti] * sh + td[ti] * ar;
        let g = td[ti + 1] * sh + td[ti + 1] * ag;
        let b = td[ti + 2] * sh + td[ti + 2] * ab;
        const ff = fogF * (1 - em * 0.85);
        const di = rowOff + x * 4;
        out[di] = r + (fogC[0] - r) * ff;
        out[di + 1] = g + (fogC[1] - g) * ff;
        out[di + 2] = b + (fogC[2] - b) * ff;
        out[di + 3] = 255;
      }
    }

    // ===================================================================
    //  3) 墙（DDA）
    // ===================================================================
    for (let x = 0; x < W; x++) {
      const camX = (x * 2) / W - 1;
      const rdx = dirX + planeX * camX;
      const rdy = dirY + planeY * camX;

      let mx = Math.floor(cam.x), my = Math.floor(cam.y);
      const ddx = rdx === 0 ? 1e30 : Math.abs(1 / rdx);
      const ddy = rdy === 0 ? 1e30 : Math.abs(1 / rdy);
      const sx = rdx < 0 ? -1 : 1, sy = rdy < 0 ? -1 : 1;
      let sdx = rdx < 0 ? (cam.x - mx) * ddx : (mx + 1 - cam.x) * ddx;
      let sdy = rdy < 0 ? (cam.y - my) * ddy : (my + 1 - cam.y) * ddy;

      let side = 0, hit = null, guard = 0;
      while (guard++ < 220) {
        if (sdx < sdy) { sdx += ddx; mx += sx; side = 0; }
        else { sdy += ddy; my += sy; side = 1; }
        if (mx < 0 || my < 0 || mx >= mapW || my >= mapH) break;
        const cell = wallsG[my][mx];
        if (cell) { hit = cell; break; }
      }

      if (!hit) { zb[x] = 1e9; continue; }

      const perp = side === 0 ? (mx - cam.x + (1 - sx) / 2) / rdx
                              : (my - cam.y + (1 - sy) / 2) / rdy;
      const d = Math.max(0.0001, perp);
      zb[x] = d;

      // 命中的是哪一面（用于给门/单面装饰贴不同图）
      let name;
      if (side === 0) name = sx > 0 ? (hit.w || hit.all) : (hit.e || hit.all);
      else name = sy > 0 ? (hit.n || hit.all) : (hit.s || hit.all);
      const t = tex(name);
      const td = t.data, temit = t.emit;

      // 纹理横坐标
      let wallX = side === 0 ? cam.y + d * rdy : cam.x + d * rdx;
      wallX -= Math.floor(wallX);
      let texX = (wallX * TS) | 0;
      if (side === 0 && rdx > 0) texX = TS - 1 - texX;
      if (side === 1 && rdy < 0) texX = TS - 1 - texX;

      const lineH = focal / d;
      const cellH = hit.h ?? wallH;                 // 支持矮墙（女儿墙）
      const yTop = hy - (cellH - ez) * lineH;
      const yBot = hy + ez * lineH;
      const step = TS / (yBot - yTop);
      let y0 = Math.ceil(yTop), y1 = Math.floor(yBot);
      let texPos = (y0 - yTop) * step;
      if (y0 < 0) { texPos += -y0 * step; y0 = 0; }
      if (y1 > H - 1) y1 = H - 1;

      // 侧面明暗（假的方向光，但立体感全靠它）
      const sideK = side === 1 ? 0.78 : 1.0;
      let fogF = (d - fogStart) / fogSpan;
      fogF = fogF < 0 ? 0 : fogF > 1 ? 1 : fogF;
      fogF = fogF * fogF * (3 - 2 * fogF);

      // 命中点世界坐标（算点光）
      const hxw = cam.x + rdx * d, hyw = cam.y + rdy * d;
      let ar = 0, ag = 0, ab = 0;
      for (let i = 0; i < nl; i++) {
        if (lint[i] <= 0) continue;
        const lxx = hxw - lx[i], lyy = hyw - ly[i];
        const d2 = lxx * lxx + lyy * lyy;
        const rr = lrad[i];
        if (d2 >= rr * rr) continue;
        const att = 1 - Math.sqrt(d2) / rr;
        const k = att * att * lint[i];
        ar += lcol[i * 3] * k; ag += lcol[i * 3 + 1] * k; ab += lcol[i * 3 + 2] * k;
      }

      const shBase = baseLight * sideK;
      for (let y = y0; y <= y1; y++, texPos += step) {
        let ty = texPos | 0;
        if (ty < 0) ty = 0; else if (ty > TS - 1) ty = TS - 1;
        const ti = (ty * TS + texX) * 4;
        const em = temit ? temit[ty * TS + texX] / 255 : 0;
        // 竖直向的柔和衰减：靠地面更暗一点，增加"房间感"
        const vk = 1 - Math.max(0, (ty - 40) / TS) * 0.22;
        const sh = shBase * vk + em * 1.2;
        const r0 = td[ti], g0 = td[ti + 1], b0 = td[ti + 2];
        let r = r0 * sh + r0 * ar, g = g0 * sh + g0 * ag, b = b0 * sh + b0 * ab;
        const ff = fogF * (1 - em * 0.85);
        const di = (y * W + x) * 4;
        out[di] = r + (fogC[0] - r) * ff;
        out[di + 1] = g + (fogC[1] - g) * ff;
        out[di + 2] = b + (fogC[2] - b) * ff;
        out[di + 3] = 255;
      }
    }

    // ===================================================================
    //  4) 精灵（广告牌）
    // ===================================================================
    const sprites = (world.sprites || []).filter((s) => !s.hidden && s.tex);
    const order = [];
    for (const s of sprites) {
      const dx = s.x - cam.x, dy = s.y - cam.y;
      order.push({ s, d2: dx * dx + dy * dy });
    }
    order.sort((a, b) => b.d2 - a.d2);

    const time = (fx.time ?? this.frame / 60);
    for (const { s } of order) {
      const swayX = s.sway ? Math.sin(time * (s.swaySpeed || 1.4) + (s.phase || 0)) * s.sway : 0;
      const dx = s.x + swayX - cam.x, dy = s.y - cam.y;
      const invDet = 1 / (planeX * dirY - dirX * planeY);
      const tX = invDet * (dirY * dx - dirX * dy);
      const tY = invDet * (-planeY * dx + planeX * dy);
      if (tY < 0.14) continue;
      const t = s.tex;
      const hgt = s.hgt ?? 0.6;
      const base = s.base ?? 0;
      const hpx = (focal * hgt) / tY;
      const wpx = hpx * (t.w / t.h) * (s.squash ?? 1);
      const scrX = (W / 2) * (1 + tX / tY);
      const bobY = s.bob ? Math.sin(time * (s.bobSpeed || 1.1) + (s.phase || 0)) * s.bob : 0;
      const yBot = hy + (ez - base - bobY) * focal / tY;
      const yTop = yBot - hpx;

      let fogF = (tY - fogStart) / fogSpan;
      fogF = fogF < 0 ? 0 : fogF > 1 ? 1 : fogF;
      fogF = fogF * fogF * (3 - 2 * fogF);

      // 精灵处的点光
      let ar = 0, ag = 0, ab = 0;
      for (let i = 0; i < nl; i++) {
        if (lint[i] <= 0) continue;
        const lxx = s.x - lx[i], lyy = s.y - ly[i];
        const d2 = lxx * lxx + lyy * lyy;
        const rr = lrad[i];
        if (d2 >= rr * rr) continue;
        const att = 1 - Math.sqrt(d2) / rr;
        const k = att * att * lint[i];
        ar += lcol[i * 3] * k; ag += lcol[i * 3 + 1] * k; ab += lcol[i * 3 + 2] * k;
      }
      const semit = s.emit ?? 0;
      const sh = baseLight * (s.lit ?? 1) + semit * 1.25;
      const alpha = s.alpha ?? 1;
      const td = t.data;

      const x0 = Math.max(0, Math.ceil(scrX - wpx / 2));
      const x1 = Math.min(W - 1, Math.floor(scrX + wpx / 2));
      const yy0 = Math.max(0, Math.ceil(yTop));
      const yy1 = Math.min(H - 1, Math.floor(yBot));
      for (let x = x0; x <= x1; x++) {
        if (tY >= zb[x]) continue;
        let sxi = (((x - (scrX - wpx / 2)) / wpx) * t.w) | 0;
        if (sxi < 0) sxi = 0; else if (sxi > t.w - 1) sxi = t.w - 1;
        if (s.flip) sxi = t.w - 1 - sxi;
        for (let y = yy0; y <= yy1; y++) {
          let syi = (((y - yTop) / hpx) * t.h) | 0;
          if (syi < 0) syi = 0; else if (syi > t.h - 1) syi = t.h - 1;
          const ti = (syi * t.w + sxi) * 4;
          const a = (td[ti + 3] / 255) * alpha;
          if (a < 0.02) continue;
          const em = Math.max(semit, t.emit ? t.emit[syi * t.w + sxi] / 255 : 0);
          const sh2 = sh + em * 0.9;
          const r0 = td[ti], g0 = td[ti + 1], b0 = td[ti + 2];
          let r = r0 * sh2 + r0 * ar, g = g0 * sh2 + g0 * ag, b = b0 * sh2 + b0 * ab;
          const ff = fogF * (1 - em * 0.9);
          r = r + (fogC[0] - r) * ff;
          g = g + (fogC[1] - g) * ff;
          b = b + (fogC[2] - b) * ff;
          const di = (y * W + x) * 4;
          out[di] += (r - out[di]) * a;
          out[di + 1] += (g - out[di + 1]) * a;
          out[di + 2] += (b - out[di + 2]) * a;
        }
      }
    }

    // ===================================================================
    //  5) 后处理：泛光 / 暗角 / 色调 / 扫描线 / 颗粒
    // ===================================================================
    if ((fx.bloom ?? 0.5) > 0) this._bloom(fx.bloom ?? 0.5, fx.bloomThreshold ?? 168);
    this._post(fx);
    return this.data;
  }

  /**
   * 廉价泛光：1/4 分辨率取高光 → 两次盒式模糊 → 双线性加回
   * 玻璃幕墙、白炽灯泡、电视雪花靠它"发出来"，梦核的空气感一半在这
   */
  _bloom(strength, threshold) {
    const W = this.w, H = this.h, out = this.hdr;
    const bw = W >> 2, bh = H >> 2;
    if (!this._bl || this._blw !== bw) {
      this._blw = bw; this._blh = bh;
      this._bl = new Float32Array(bw * bh * 3);
      this._bl2 = new Float32Array(bw * bh * 3);
    }
    const a = this._bl, b = this._bl2;
    a.fill(0);
    // 降采样 + 取超过阈值的部分
    for (let by = 0; by < bh; by++) {
      for (let bx = 0; bx < bw; bx++) {
        let r = 0, g = 0, bl = 0;
        for (let y = 0; y < 4; y++) {
          const sy = by * 4 + y;
          if (sy >= H) break;
          for (let x = 0; x < 4; x++) {
            const sx = bx * 4 + x;
            if (sx >= W) break;
            const i = (sy * W + sx) * 4;
            r += out[i]; g += out[i + 1]; bl += out[i + 2];
          }
        }
        r /= 16; g /= 16; bl /= 16;
        const lum = 0.299 * r + 0.587 * g + 0.114 * bl;
        const k = lum > threshold ? (lum - threshold) / (255 - threshold + 1) : 0;
        const j = (by * bw + bx) * 3;
        a[j] = r * k; a[j + 1] = g * k; a[j + 2] = bl * k;
      }
    }
    // 分离式盒模糊 ×2（半径 2）
    for (let pass = 0; pass < 2; pass++) {
      const src = pass === 0 ? a : b, dst = pass === 0 ? b : a;
      // 横向
      for (let y = 0; y < bh; y++) {
        for (let x = 0; x < bw; x++) {
          let r = 0, g = 0, bl = 0, n = 0;
          for (let d = -2; d <= 2; d++) {
            const xx = x + d;
            if (xx < 0 || xx >= bw) continue;
            const j = (y * bw + xx) * 3;
            r += src[j]; g += src[j + 1]; bl += src[j + 2]; n++;
          }
          const j = (y * bw + x) * 3;
          dst[j] = r / n; dst[j + 1] = g / n; dst[j + 2] = bl / n;
        }
      }
      // 纵向（写回 src，省一个缓冲）
      for (let x = 0; x < bw; x++) {
        for (let y = 0; y < bh; y++) {
          let r = 0, g = 0, bl = 0, n = 0;
          for (let d = -2; d <= 2; d++) {
            const yy = y + d;
            if (yy < 0 || yy >= bh) continue;
            const j = (yy * bw + x) * 3;
            r += dst[j]; g += dst[j + 1]; bl += dst[j + 2]; n++;
          }
          const j = (y * bw + x) * 3;
          src[j] = r / n; src[j + 1] = g / n; src[j + 2] = bl / n;
        }
      }
    }
    // 双线性加回
    for (let y = 0; y < H; y++) {
      const fy = Math.min(bh - 1.001, y / 4 - 0.5);
      const y0 = Math.max(0, Math.floor(fy)), ty = fy - y0;
      const y1 = Math.min(bh - 1, y0 + 1);
      for (let x = 0; x < W; x++) {
        const fx2 = Math.min(bw - 1.001, x / 4 - 0.5);
        const x0 = Math.max(0, Math.floor(fx2)), tx = fx2 - x0;
        const x1 = Math.min(bw - 1, x0 + 1);
        const j00 = (y0 * bw + x0) * 3, j01 = (y0 * bw + x1) * 3;
        const j10 = (y1 * bw + x0) * 3, j11 = (y1 * bw + x1) * 3;
        const i = (y * W + x) * 4;
        for (let c = 0; c < 3; c++) {
          const top = a[j00 + c] + (a[j01 + c] - a[j00 + c]) * tx;
          const bot = a[j10 + c] + (a[j11 + c] - a[j10 + c]) * tx;
          out[i + c] += (top + (bot - top) * ty) * strength;
        }
      }
    }
  }

  _post(fx) {
    const W = this.w, H = this.h, hdr = this.hdr, out = this.data, vig = this._vig;
    const grainAmt = fx.grain ?? 7;
    const scan = fx.scanlines ?? 0.055;
    const tint = fx.tint ? rgba(fx.tint) : null;
    const tintA = fx.tintAmount ?? 0;
    const sat = fx.sat ?? 1.0;
    const warm = fx.warm ?? 1.0;
    let seed = (this.frame * 1103515245 + 12345) | 0;

    for (let y = 0; y < H; y++) {
      const scanK = 1 - (y & 1) * scan;
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        // 高光肩部（先压掉过曝，再做暗角/色调，颜色才不会糊成白块）
        let r = tone(hdr[i]), g = tone(hdr[i + 1]), b = tone(hdr[i + 2]);

        // 暖调（红多一点，蓝少一点）—— 千禧年照片的褪色感
        if (warm !== 1) {
          r *= 1 + (warm - 1) * 0.12;
          b *= 1 - (warm - 1) * 0.14;
        }
        // 饱和度
        if (sat !== 1) {
          const l = 0.299 * r + 0.587 * g + 0.114 * b;
          r = l + (r - l) * sat; g = l + (g - l) * sat; b = l + (b - l) * sat;
        }
        // 暗角
        const v = vig[y * W + x];
        r *= v; g *= v; b *= v;
        // 扫描线
        r *= scanK; g *= scanK; b *= scanK;
        // 颗粒
        if (grainAmt > 0) {
          seed ^= seed << 13; seed |= 0; seed ^= seed >>> 17; seed ^= seed << 5; seed |= 0;
          const n = (((seed >>> 8) & 255) / 255 - 0.5) * grainAmt;
          r += n; g += n; b += n;
        }
        // 闪白/闪红
        if (tint && tintA > 0) {
          r += (tint[0] - r) * tintA;
          g += (tint[1] - g) * tintA;
          b += (tint[2] - b) * tintA;
        }
        out[i] = r; out[i + 1] = g; out[i + 2] = b; out[i + 3] = 255;
      }
    }
  }
}
