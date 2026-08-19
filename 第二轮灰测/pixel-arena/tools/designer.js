// ============================================================
// tools/designer.js — 像素精灵设计器
// 用椭圆/矩形/像素/线段图层程序化设计精灵，自动生成 1px 描边，
// 栅格化后由 export-maps.js 导出为静态地图（游戏零运行时依赖）。
// ============================================================
'use strict';

const OUTLINE = 1; // 描边色（调色板 1 = 近黑）

class Grid {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.cells = new Int8Array(w * h).fill(-1);
  }
  set(x, y, c) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.cells[y * this.w + x] = c;
  }
  // 填充椭圆
  ell(cx, cy, rx, ry, c, inflate) {
    const rxf = rx + (inflate || 0), ryf = ry + (inflate || 0);
    const x0 = Math.floor(cx - rxf), x1 = Math.ceil(cx + rxf);
    const y0 = Math.floor(cy - ryf), y1 = Math.ceil(cy + ryf);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = (x - cx) / rxf, dy = (y - cy) / ryf;
        if (dx * dx + dy * dy <= 1) this.set(x, y, c);
      }
    }
  }
  rect(x, y, w, h, c, inflate) {
    const inf = inflate || 0;
    for (let yy = Math.round(y) - inf; yy < Math.round(y) + Math.round(h) + inf; yy++) {
      for (let xx = Math.round(x) - inf; xx < Math.round(x) + Math.round(w) + inf; xx++) {
        this.set(xx, yy, c);
      }
    }
  }
  line(x1, y1, x2, y2, c, thick) {
    thick = thick || 1;
    let x = Math.round(x1), y = Math.round(y1);
    const ex = Math.round(x2), ey = Math.round(y2);
    const dx = Math.abs(ex - x), dy = -Math.abs(ey - y);
    const sx = x < ex ? 1 : -1, sy = y < ey ? 1 : -1;
    let err = dx + dy;
    for (let i = 0; i < 1000; i++) {
      for (let t = 0; t < thick; t++) {
        this.set(x, y + Math.floor(t - (thick - 1) / 2), c);
      }
      if (x === ex && y === ey) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x += sx; }
      if (e2 <= dx) { err += dx; y += sy; }
    }
  }
  // 图层化绘制：先描边后填色
  shapes(list) {
    for (const s of list) {
      if (s.type === 'px') continue;
      if (s.type === 'ell') this.ell(s.x, s.y, s.rx, s.ry, OUTLINE, 1);
      else if (s.type === 'rect') this.rect(s.x, s.y, s.w, s.h, OUTLINE, 1);
      else if (s.type === 'line') this.line(s.x1, s.y1, s.x2, s.y2, OUTLINE, (s.thick || 1) + 2);
    }
    for (const s of list) {
      if (s.type === 'px') { this.set(s.x, s.y, s.c); continue; }
      if (s.type === 'ell') this.ell(s.x, s.y, s.rx, s.ry, s.c, 0);
      else if (s.type === 'rect') this.rect(s.x, s.y, s.w, s.h, s.c, 0);
      else if (s.type === 'line') this.line(s.x1, s.y1, s.x2, s.y2, s.c, s.thick || 1);
    }
  }
  rows() {
    const out = [];
    const CH = '0123456789ABCDEFGHIJKLMNOPQRSTUV';
    for (let y = 0; y < this.h; y++) {
      let s = '';
      for (let x = 0; x < this.w; x++) {
        const c = this.cells[y * this.w + x];
        s += c < 0 ? '.' : CH[c];
      }
      out.push(s);
    }
    return out;
  }
}

// ---------------- 精灵设计 ----------------
const P = {
  FIREFOX_F(g) {
    g.shapes([
      // 火焰尾（右侧、身体之后）
      { type: 'ell', x: 31, y: 15, rx: 5, ry: 9, c: 22 },
      { type: 'ell', x: 31, y: 15, rx: 3.5, ry: 7, c: 21 },
      { type: 'ell', x: 30, y: 6, rx: 3.5, ry: 4, c: 20 },
      { type: 'ell', x: 30, y: 6, rx: 2, ry: 2.5, c: 22 },
      { type: 'px', x: 29, y: 4, c: 23 },
      // 身体
      { type: 'ell', x: 17, y: 23, rx: 8, ry: 6.5, c: 21 },
      { type: 'ell', x: 17, y: 24, rx: 6, ry: 5, c: 22 },
      // 后腿（远侧，深色）
      { type: 'rect', x: 14, y: 27, w: 3, h: 6, c: 22 },
      { type: 'rect', x: 22, y: 27, w: 3, h: 6, c: 22 },
      // 头
      { type: 'ell', x: 13, y: 11, rx: 7, ry: 6, c: 21 },
      // 耳朵
      { type: 'ell', x: 9, y: 3, rx: 3.5, ry: 4.5, c: 21 },
      { type: 'ell', x: 18, y: 3, rx: 3.5, ry: 4.5, c: 21 },
      { type: 'ell', x: 9.5, y: 4, rx: 1.8, ry: 3, c: 22 },
      { type: 'ell', x: 18.5, y: 4, rx: 1.8, ry: 3, c: 22 },
      // 口鼻（朝左）
      { type: 'ell', x: 8, y: 13, rx: 3, ry: 2.3, c: 8 },
      { type: 'px', x: 5.5, y: 12.5, c: 13 },
      // 眼睛
      { type: 'rect', x: 9, y: 9.5, w: 2, h: 1.6, c: 1 },
      { type: 'rect', x: 13.5, y: 9.5, w: 2, h: 1.6, c: 1 },
      { type: 'px', x: 9.8, y: 9, c: 30 },
      { type: 'px', x: 14.3, y: 9, c: 30 },
      // 胸口绒毛
      { type: 'ell', x: 12, y: 19, rx: 3.5, ry: 4, c: 8 },
      // 前腿
      { type: 'rect', x: 10, y: 27, w: 3, h: 6, c: 21 },
      { type: 'rect', x: 20, y: 27, w: 3, h: 6, c: 21 },
      { type: 'rect', x: 10, y: 32, w: 3.4, h: 1.4, c: 22 },
      { type: 'rect', x: 20, y: 32, w: 3.4, h: 1.4, c: 22 },
      { type: 'rect', x: 14, y: 32, w: 3.4, h: 1.4, c: 22 },
      { type: 'rect', x: 22, y: 32, w: 3.4, h: 1.4, c: 22 },
      // 尾巴与身体连接
      { type: 'ell', x: 25, y: 20, rx: 3.5, ry: 4.5, c: 21 },
      { type: 'ell', x: 25, y: 21, rx: 2.5, ry: 3, c: 22 },
    ]);
  },
  SPROUTAUR_F(g) {
    g.shapes([
      // 背上的大芽苞（右移，与头部错开）
      { type: 'ell', x: 27, y: 9, rx: 6.5, ry: 7.5, c: 16 },
      { type: 'ell', x: 26, y: 7, rx: 3.8, ry: 4.2, c: 17 },
      { type: 'ell', x: 27, y: 10, rx: 4.8, ry: 4.6, c: 15 },
      { type: 'px', x: 26, y: 5.5, c: 18 },
      { type: 'px', x: 29.5, y: 6.5, c: 18 },
      // 头顶嫩芽
      { type: 'rect', x: 10.5, y: 2.5, w: 1.4, h: 4, c: 15 },
      { type: 'ell', x: 8.5, y: 2.6, rx: 2.4, ry: 1.8, c: 17 },
      { type: 'ell', x: 13.5, y: 2.6, rx: 2.4, ry: 1.8, c: 17 },
      // 身体
      { type: 'ell', x: 17, y: 23, rx: 8, ry: 6, c: 16 },
      { type: 'ell', x: 17, y: 24, rx: 5.5, ry: 4.5, c: 17 },
      // 头（更大、更低、与芽苞分离）
      { type: 'ell', x: 10, y: 15, rx: 6.2, ry: 5.2, c: 16 },
      { type: 'ell', x: 8, y: 16, rx: 3, ry: 2.7, c: 17 },
      // 颈部
      { type: 'ell', x: 13, y: 18, rx: 3.5, ry: 3, c: 16 },
      // 吻部（朝左）
      { type: 'ell', x: 5, y: 16.5, rx: 2.6, ry: 1.9, c: 19 },
      { type: 'px', x: 3.3, y: 15.5, c: 13 },
      // 眼睛
      { type: 'rect', x: 7.5, y: 13.5, w: 2, h: 1.7, c: 1 },
      { type: 'rect', x: 11.5, y: 13.5, w: 2, h: 1.7, c: 1 },
      { type: 'px', x: 8.3, y: 13.2, c: 30 },
      { type: 'px', x: 12.3, y: 13.2, c: 30 },
      // 肚皮
      { type: 'ell', x: 16, y: 24.5, rx: 4.5, ry: 3.5, c: 19 },
      // 斑点
      { type: 'px', x: 19, y: 20, c: 15 },
      { type: 'px', x: 21.5, y: 23, c: 15 },
      { type: 'px', x: 18, y: 17.5, c: 15 },
      // 腿
      { type: 'rect', x: 12, y: 27, w: 3, h: 6, c: 16 },
      { type: 'rect', x: 20.5, y: 27, w: 3, h: 6, c: 16 },
      { type: 'rect', x: 12, y: 32, w: 3.5, h: 1.6, c: 15 },
      { type: 'rect', x: 20.5, y: 32, w: 3.5, h: 1.6, c: 15 },
      // 尾巴
      { type: 'ell', x: 26.5, y: 22, rx: 3, ry: 1.8, c: 17 },
      { type: 'px', x: 29.5, y: 21, c: 18 },
    ]);
  },
  WAVETURTLE_F(g) {
    g.shapes([
      // 龟壳（主体）
      { type: 'ell', x: 20, y: 14, rx: 10.5, ry: 9, c: 11 },
      { type: 'ell', x: 20, y: 13, rx: 8.5, ry: 7, c: 10 },
      { type: 'ell', x: 19, y: 15.5, rx: 8.5, ry: 6, c: 11 },
      // 壳缘
      { type: 'ell', x: 20, y: 20.5, rx: 10.5, ry: 2.8, c: 12 },
      { type: 'ell', x: 20, y: 20, rx: 8.5, ry: 1.8, c: 11 },
      // 波浪花纹
      { type: 'px', x: 16, y: 9.5, c: 4 },
      { type: 'px', x: 19, y: 8.5, c: 4 },
      { type: 'px', x: 22, y: 9.5, c: 4 },
      { type: 'px', x: 14.5, y: 11, c: 5 },
      { type: 'px', x: 17.5, y: 10.3, c: 5 },
      { type: 'px', x: 20.5, y: 10.3, c: 5 },
      { type: 'px', x: 23.5, y: 11, c: 5 },
      // 脖子
      { type: 'rect', x: 10.5, y: 15.5, w: 5, h: 5, c: 25 },
      // 头（朝左，更大更低）
      { type: 'ell', x: 8.5, y: 16, rx: 5, ry: 4.2, c: 25 },
      { type: 'ell', x: 4.8, y: 17, rx: 2.5, ry: 1.9, c: 7 },
      { type: 'px', x: 3.1, y: 16.2, c: 13 },
      { type: 'rect', x: 7, y: 14.3, w: 2, h: 1.7, c: 1 },
      { type: 'px', x: 7.8, y: 14, c: 30 },
      // 腹甲
      { type: 'ell', x: 14, y: 20, rx: 5, ry: 3.5, c: 8 },
      { type: 'px', x: 12, y: 18, c: 9 },
      { type: 'px', x: 16, y: 18, c: 9 },
      // 腿
      { type: 'rect', x: 11, y: 24.5, w: 3.5, h: 5, c: 25 },
      { type: 'rect', x: 24, y: 24.5, w: 3.5, h: 5, c: 25 },
      { type: 'rect', x: 10.5, y: 28.5, w: 4.5, h: 1.8, c: 26 },
      { type: 'rect', x: 23.5, y: 28.5, w: 4.5, h: 1.8, c: 26 },
      // 尾巴
      { type: 'ell', x: 30, y: 21, rx: 3, ry: 1.8, c: 25 },
    ]);
  },
  VOLTMOUSE_F(g) {
    g.shapes([
      // 闪电尾巴（右侧）
      { type: 'line', x1: 22, y1: 20, x2: 26, y2: 15, c: 20, thick: 2 },
      { type: 'line', x1: 26, y1: 15, x2: 23, y2: 11, c: 20, thick: 2 },
      { type: 'line', x1: 23, y1: 11, x2: 28, y2: 6, c: 20, thick: 2 },
      { type: 'px', x: 28, y: 4.5, c: 21 },
      // 耳朵
      { type: 'ell', x: 7.5, y: 4, rx: 4, ry: 5.5, c: 20 },
      { type: 'ell', x: 16.5, y: 4, rx: 4, ry: 5.5, c: 20 },
      { type: 'ell', x: 7.8, y: 5, rx: 2.4, ry: 3.8, c: 1 },
      { type: 'ell', x: 16.8, y: 5, rx: 2.4, ry: 3.8, c: 1 },
      { type: 'px', x: 7.5, y: 0.5, c: 1 },
      { type: 'px', x: 16.5, y: 0.5, c: 1 },
      // 身体
      { type: 'ell', x: 13, y: 21, rx: 7, ry: 5.5, c: 20 },
      { type: 'ell', x: 13, y: 22.5, rx: 4.5, ry: 3.5, c: 8 },
      // 头
      { type: 'ell', x: 12, y: 11.5, rx: 7, ry: 5.5, c: 20 },
      // 脸颊
      { type: 'ell', x: 6.5, y: 14, rx: 2.6, ry: 2, c: 23 },
      { type: 'ell', x: 17.5, y: 14, rx: 2.6, ry: 2, c: 23 },
      { type: 'px', x: 5.6, y: 13.2, c: 20 },
      { type: 'px', x: 18.4, y: 13.2, c: 20 },
      // 鼻
      { type: 'px', x: 4.6, y: 12.5, c: 13 },
      // 眼睛
      { type: 'rect', x: 8, y: 10.5, w: 2, h: 1.8, c: 1 },
      { type: 'rect', x: 14, y: 10.5, w: 2, h: 1.8, c: 1 },
      { type: 'px', x: 8.8, y: 10.2, c: 30 },
      { type: 'px', x: 14.8, y: 10.2, c: 30 },
      // 手臂
      { type: 'rect', x: 7.5, y: 17, w: 2, h: 3, c: 20 },
      // 腿
      { type: 'rect', x: 10, y: 25, w: 3, h: 4, c: 20 },
      { type: 'rect', x: 17, y: 25, w: 3, h: 4, c: 20 },
      { type: 'rect', x: 9.5, y: 28, w: 4, h: 1.6, c: 21 },
      { type: 'rect', x: 16.5, y: 28, w: 4, h: 1.6, c: 21 },
    ]);
  },
  PSYKITTY_F(g) {
    g.shapes([
      // 卷尾（右侧）
      { type: 'ell', x: 25.5, y: 17, rx: 4, ry: 3, c: 28 },
      { type: 'ell', x: 25.5, y: 17, rx: 2.6, ry: 1.8, c: 27 },
      { type: 'rect', x: 20, y: 17.5, w: 5, h: 3, c: 27 },
      // 身体
      { type: 'ell', x: 14, y: 22, rx: 7, ry: 6, c: 27 },
      { type: 'ell', x: 14, y: 23.5, rx: 4.5, ry: 4, c: 8 },
      // 耳朵
      { type: 'ell', x: 8, y: 4, rx: 4, ry: 5, c: 27 },
      { type: 'ell', x: 17, y: 4, rx: 4, ry: 5, c: 27 },
      { type: 'ell', x: 8.3, y: 4.8, rx: 2.3, ry: 3.4, c: 28 },
      { type: 'ell', x: 17.3, y: 4.8, rx: 2.3, ry: 3.4, c: 28 },
      // 头
      { type: 'ell', x: 12.5, y: 11, rx: 7, ry: 5.5, c: 27 },
      // 额心宝石
      { type: 'ell', x: 12.5, y: 6.5, rx: 2.2, ry: 2, c: 25 },
      { type: 'px', x: 11.8, y: 5.8, c: 30 },
      // 吻部
      { type: 'ell', x: 7, y: 13, rx: 2.6, ry: 2, c: 8 },
      { type: 'px', x: 5.2, y: 12.3, c: 24 },
      // 眼睛
      { type: 'rect', x: 8.5, y: 10, w: 2, h: 1.8, c: 1 },
      { type: 'rect', x: 14, y: 10, w: 2, h: 1.8, c: 1 },
      { type: 'px', x: 9.3, y: 9.7, c: 30 },
      { type: 'px', x: 14.8, y: 9.7, c: 30 },
      // 腿
      { type: 'rect', x: 10, y: 26, w: 3, h: 5, c: 27 },
      { type: 'rect', x: 17.5, y: 26, w: 3, h: 5, c: 27 },
      { type: 'rect', x: 9.5, y: 30, w: 4, h: 1.6, c: 28 },
      { type: 'rect', x: 17, y: 30, w: 4, h: 1.6, c: 28 },
    ]);
  },
  ROCKRHINO_F(g) {
    g.shapes([
      // 背部岩石甲板
      { type: 'ell', x: 20, y: 16, rx: 4.5, ry: 3.5, c: 31 },
      { type: 'ell', x: 25, y: 15, rx: 4.5, ry: 3.5, c: 31 },
      { type: 'ell', x: 29.5, y: 17, rx: 3.5, ry: 2.8, c: 31 },
      { type: 'ell', x: 20, y: 17.5, rx: 4.5, ry: 2.2, c: 28 },
      { type: 'ell', x: 25, y: 16.5, rx: 4.5, ry: 2.2, c: 28 },
      { type: 'ell', x: 29.5, y: 18.2, rx: 3.5, ry: 1.8, c: 28 },
      { type: 'px', x: 18.5, y: 14.5, c: 30 },
      { type: 'px', x: 23.5, y: 13.5, c: 30 },
      // 身体
      { type: 'ell', x: 16.5, y: 22.5, rx: 10.5, ry: 6.5, c: 11 },
      { type: 'ell', x: 16.5, y: 24, rx: 8, ry: 4.5, c: 12 },
      // 头（朝左）
      { type: 'ell', x: 11, y: 16, rx: 7, ry: 5.5, c: 11 },
      // 额头甲
      { type: 'ell', x: 12, y: 12.5, rx: 5, ry: 3, c: 31 },
      { type: 'ell', x: 12, y: 13.5, rx: 5, ry: 2, c: 28 },
      { type: 'px', x: 10.5, y: 11.3, c: 30 },
      // 角
      { type: 'line', x1: 3, y1: 6, x2: 8, y2: 14, c: 9, thick: 3 },
      { type: 'px', x: 3.2, y: 5.4, c: 30 },
      // 吻部
      { type: 'ell', x: 4.5, y: 17.5, rx: 2.4, ry: 2, c: 12 },
      { type: 'px', x: 2.9, y: 16.6, c: 13 },
      // 眼睛
      { type: 'rect', x: 6.8, y: 14.2, w: 2, h: 1.8, c: 1 },
      { type: 'px', x: 7.6, y: 13.9, c: 30 },
      // 耳朵
      { type: 'ell', x: 16.5, y: 11, rx: 2.2, ry: 2.6, c: 12 },
      { type: 'ell', x: 16.5, y: 11, rx: 1.2, ry: 1.5, c: 13 },
      // 腿
      { type: 'rect', x: 8.5, y: 26.5, w: 4, h: 6, c: 11 },
      { type: 'rect', x: 14, y: 27, w: 4, h: 6, c: 12 },
      { type: 'rect', x: 20.5, y: 27, w: 4, h: 6, c: 11 },
      { type: 'rect', x: 26, y: 26.5, w: 4, h: 6, c: 12 },
      { type: 'rect', x: 8, y: 31.5, w: 5, h: 1.8, c: 13 },
      { type: 'rect', x: 13.5, y: 32, w: 5, h: 1.8, c: 13 },
      { type: 'rect', x: 20, y: 32, w: 5, h: 1.8, c: 13 },
      { type: 'rect', x: 25.5, y: 31.5, w: 5, h: 1.8, c: 13 },
      // 尾巴
      { type: 'rect', x: 29, y: 22, w: 4, h: 2, c: 13 },
    ]);
  },
  // ---------------- 背面 40×40 ----------------
  FIREFOX_B(g) {
    g.shapes([
      // 火焰大尾巴（居中后方）
      { type: 'ell', x: 20, y: 20, rx: 5, ry: 13, c: 22 },
      { type: 'ell', x: 20, y: 20, rx: 3.5, ry: 10.5, c: 21 },
      { type: 'ell', x: 20, y: 5, rx: 4, ry: 4.5, c: 20 },
      { type: 'ell', x: 20, y: 5, rx: 2.3, ry: 2.8, c: 22 },
      { type: 'px', x: 19, y: 2.5, c: 23 },
      { type: 'px', x: 21.5, y: 3.5, c: 23 },
      // 身体（背）
      { type: 'ell', x: 20, y: 26, rx: 9, ry: 8, c: 21 },
      { type: 'ell', x: 20, y: 27.5, rx: 6.5, ry: 6, c: 22 },
      // 头（背）
      { type: 'ell', x: 20, y: 13, rx: 8, ry: 6.5, c: 21 },
      // 耳朵
      { type: 'ell', x: 13, y: 4, rx: 4, ry: 5, c: 21 },
      { type: 'ell', x: 27, y: 4, rx: 4, ry: 5, c: 21 },
      { type: 'ell', x: 13.4, y: 5, rx: 2.2, ry: 3.4, c: 22 },
      { type: 'ell', x: 27.4, y: 5, rx: 2.2, ry: 3.4, c: 22 },
      // 腿部
      { type: 'rect', x: 13.5, y: 32, w: 3.5, h: 5, c: 21 },
      { type: 'rect', x: 24, y: 32, w: 3.5, h: 5, c: 21 },
      { type: 'rect', x: 13, y: 36, w: 4.5, h: 1.6, c: 22 },
      { type: 'rect', x: 23.5, y: 36, w: 4.5, h: 1.6, c: 22 },
    ]);
  },
  SPROUTAUR_B(g) {
    g.shapes([
      // 大芽苞（背面主体）
      { type: 'ell', x: 20, y: 13, rx: 12, ry: 11, c: 16 },
      { type: 'ell', x: 19, y: 11.5, rx: 7.5, ry: 7, c: 17 },
      { type: 'ell', x: 20, y: 15, rx: 9, ry: 7.5, c: 15 },
      { type: 'px', x: 17, y: 7.5, c: 18 },
      { type: 'px', x: 21, y: 6.5, c: 18 },
      { type: 'px', x: 24.5, y: 10, c: 18 },
      // 顶部嫩芽
      { type: 'rect', x: 19.3, y: 1.5, w: 1.6, h: 4, c: 15 },
      { type: 'ell', x: 17, y: 2, rx: 2.8, ry: 2, c: 17 },
      { type: 'ell', x: 23, y: 2, rx: 2.8, ry: 2, c: 17 },
      // 身体
      { type: 'ell', x: 20, y: 26, rx: 8, ry: 6, c: 16 },
      { type: 'ell', x: 20, y: 27, rx: 5, ry: 4, c: 17 },
      // 后腿
      { type: 'rect', x: 14, y: 30, w: 3.5, h: 5, c: 16 },
      { type: 'rect', x: 24, y: 30, w: 3.5, h: 5, c: 16 },
      { type: 'rect', x: 13.5, y: 34, w: 4.5, h: 1.6, c: 15 },
      { type: 'rect', x: 23.5, y: 34, w: 4.5, h: 1.6, c: 15 },
      // 尾巴
      { type: 'ell', x: 27, y: 24.5, rx: 3, ry: 2, c: 17 },
      { type: 'px', x: 29.5, y: 23.5, c: 18 },
    ]);
  },
  WAVETURTLE_B(g) {
    g.shapes([
      // 龟壳（背面主体）
      { type: 'ell', x: 21, y: 15, rx: 12, ry: 11, c: 11 },
      { type: 'ell', x: 21, y: 14, rx: 9.5, ry: 8.5, c: 10 },
      { type: 'ell', x: 21, y: 16.5, rx: 9.5, ry: 7, c: 11 },
      { type: 'ell', x: 21, y: 24, rx: 12, ry: 2.8, c: 12 },
      { type: 'ell', x: 21, y: 23.5, rx: 9.5, ry: 1.8, c: 11 },
      // 波浪花纹
      { type: 'px', x: 16, y: 9.5, c: 4 },
      { type: 'px', x: 19, y: 8.3, c: 4 },
      { type: 'px', x: 22, y: 9.5, c: 4 },
      { type: 'px', x: 25, y: 11, c: 4 },
      { type: 'px', x: 14.5, y: 11.5, c: 5 },
      { type: 'px', x: 17.5, y: 10.5, c: 5 },
      { type: 'px', x: 20.5, y: 10.5, c: 5 },
      { type: 'px', x: 23.5, y: 11.5, c: 5 },
      { type: 'px', x: 26.5, y: 13, c: 5 },
      // 头（左前方露出）
      { type: 'ell', x: 9, y: 19, rx: 4.5, ry: 4, c: 25 },
      { type: 'rect', x: 11, y: 19, w: 5, h: 4.5, c: 25 },
      // 后腿
      { type: 'rect', x: 12.5, y: 25, w: 3.5, h: 5, c: 25 },
      { type: 'rect', x: 25, y: 25, w: 3.5, h: 5, c: 25 },
      { type: 'rect', x: 12, y: 29, w: 4.5, h: 1.6, c: 26 },
      { type: 'rect', x: 24.5, y: 29, w: 4.5, h: 1.6, c: 26 },
      // 尾巴
      { type: 'ell', x: 33, y: 21, rx: 3.5, ry: 2.2, c: 25 },
    ]);
  },
  VOLTMOUSE_B(g) {
    g.shapes([
      // 闪电尾巴（右后侧，露出身体轮廓外）
      { type: 'line', x1: 24, y1: 30, x2: 30, y2: 26, c: 20, thick: 3 },
      { type: 'line', x1: 30, y1: 26, x2: 26, y2: 22, c: 20, thick: 3 },
      { type: 'line', x1: 26, y1: 22, x2: 33, y2: 17, c: 20, thick: 3 },
      { type: 'line', x1: 33, y1: 17, x2: 29, y2: 13, c: 20, thick: 3 },
      { type: 'line', x1: 29, y1: 13, x2: 36, y2: 8, c: 20, thick: 3 },
      { type: 'px', x: 36, y: 6.5, c: 21 },
      { type: 'px', x: 37, y: 6, c: 20 },
      // 耳朵
      { type: 'ell', x: 11, y: 4, rx: 5, ry: 6, c: 20 },
      { type: 'ell', x: 26, y: 4, rx: 5, ry: 6, c: 20 },
      { type: 'ell', x: 11.5, y: 5, rx: 3, ry: 4.2, c: 1 },
      { type: 'ell', x: 26.5, y: 5, rx: 3, ry: 4.2, c: 1 },
      { type: 'px', x: 11, y: 0.5, c: 1 },
      { type: 'px', x: 26, y: 0.5, c: 1 },
      // 身体（背）
      { type: 'ell', x: 18.5, y: 24, rx: 8.5, ry: 7, c: 20 },
      // 头（背）
      { type: 'ell', x: 18.5, y: 12, rx: 8, ry: 6.5, c: 20 },
      // 手臂
      { type: 'rect', x: 9.5, y: 22, w: 2.5, h: 3.5, c: 20 },
      { type: 'rect', x: 25, y: 22, w: 2.5, h: 3.5, c: 20 },
      // 腿
      { type: 'rect', x: 12, y: 30, w: 3.5, h: 5, c: 20 },
      { type: 'rect', x: 21.5, y: 30, w: 3.5, h: 5, c: 20 },
      { type: 'rect', x: 11.5, y: 34, w: 4.5, h: 1.6, c: 21 },
      { type: 'rect', x: 21, y: 34, w: 4.5, h: 1.6, c: 21 },
    ]);
  },
  PSYKITTY_B(g) {
    g.shapes([
      // 卷尾（右侧）
      { type: 'ell', x: 29, y: 19, rx: 5, ry: 4, c: 28 },
      { type: 'ell', x: 29, y: 19, rx: 3.2, ry: 2.4, c: 27 },
      { type: 'rect', x: 21, y: 19.5, w: 7, h: 3.5, c: 27 },
      // 身体（背）
      { type: 'ell', x: 17, y: 25, rx: 8, ry: 7, c: 27 },
      { type: 'ell', x: 17, y: 26.5, rx: 5.5, ry: 5, c: 28 },
      // 耳朵
      { type: 'ell', x: 11, y: 4.5, rx: 4.5, ry: 5.5, c: 27 },
      { type: 'ell', x: 23, y: 4.5, rx: 4.5, ry: 5.5, c: 27 },
      { type: 'ell', x: 11.4, y: 5.5, rx: 2.6, ry: 3.8, c: 28 },
      { type: 'ell', x: 23.4, y: 5.5, rx: 2.6, ry: 3.8, c: 28 },
      // 头（背）
      { type: 'ell', x: 17, y: 12.5, rx: 8, ry: 6.5, c: 27 },
      // 后脑宝石微光
      { type: 'px', x: 17, y: 8, c: 25 },
      { type: 'px', x: 16, y: 9, c: 25 },
      { type: 'px', x: 18, y: 9, c: 25 },
      // 腿
      { type: 'rect', x: 11, y: 30, w: 3.5, h: 5, c: 27 },
      { type: 'rect', x: 21, y: 30, w: 3.5, h: 5, c: 27 },
      { type: 'rect', x: 10.5, y: 34, w: 4.5, h: 1.6, c: 28 },
      { type: 'rect', x: 20.5, y: 34, w: 4.5, h: 1.6, c: 28 },
    ]);
  },
  ROCKRHINO_B(g) {
    g.shapes([
      // 头顶角尖
      { type: 'line', x1: 22, y1: 0.5, x2: 20, y2: 4, c: 9, thick: 3 },
      { type: 'px', x: 21.8, y: 0, c: 30 },
      // 岩石甲板（背部主体，三层）
      { type: 'ell', x: 20, y: 8, rx: 8, ry: 5, c: 31 },
      { type: 'ell', x: 20, y: 13.5, rx: 10, ry: 6, c: 31 },
      { type: 'ell', x: 20, y: 19.5, rx: 11, ry: 6.5, c: 31 },
      { type: 'ell', x: 20, y: 25, rx: 10, ry: 5.5, c: 31 },
      { type: 'ell', x: 20, y: 9.5, rx: 8, ry: 3.8, c: 28 },
      { type: 'ell', x: 20, y: 15, rx: 10, ry: 4.6, c: 28 },
      { type: 'ell', x: 20, y: 21, rx: 11, ry: 5, c: 28 },
      { type: 'ell', x: 20, y: 26.3, rx: 10, ry: 4.2, c: 28 },
      { type: 'px', x: 16, y: 6.5, c: 30 },
      { type: 'px', x: 23, y: 11.5, c: 30 },
      { type: 'px', x: 17, y: 17.5, c: 30 },
      { type: 'px', x: 24, y: 23, c: 30 },
      // 身体侧沿
      { type: 'ell', x: 20, y: 27, rx: 12, ry: 5, c: 11 },
      // 耳朵
      { type: 'ell', x: 10, y: 9, rx: 2.5, ry: 3, c: 12 },
      { type: 'ell', x: 10, y: 9, rx: 1.4, ry: 1.8, c: 13 },
      // 腿
      { type: 'rect', x: 11, y: 30, w: 4.5, h: 6, c: 11 },
      { type: 'rect', x: 25.5, y: 30, w: 4.5, h: 6, c: 12 },
      { type: 'rect', x: 10.5, y: 35, w: 5.5, h: 1.8, c: 13 },
      { type: 'rect', x: 25, y: 35, w: 5.5, h: 1.8, c: 13 },
      // 尾巴
      { type: 'rect', x: 31, y: 26, w: 5, h: 2.5, c: 13 },
    ]);
  },
  // ---------------- 队伍头像 10×10 ----------------
  ICON_firefox(g) {
    g.shapes([
      { type: 'ell', x: 5, y: 5, rx: 3.5, ry: 3.5, c: 21 },
      { type: 'ell', x: 2.5, y: 1.5, rx: 1.8, ry: 2.2, c: 21 },
      { type: 'ell', x: 7.5, y: 1.5, rx: 1.8, ry: 2.2, c: 21 },
      { type: 'ell', x: 3.5, y: 2.5, rx: 1, ry: 1.4, c: 22 },
      { type: 'ell', x: 8.5, y: 2.5, rx: 1, ry: 1.4, c: 22 },
      { type: 'ell', x: 2, y: 7, rx: 1.4, ry: 1.1, c: 8 },
      { type: 'px', x: 1, y: 6.5, c: 13 },
      { type: 'px', x: 3.5, y: 4.5, c: 1 },
      { type: 'px', x: 6.5, y: 4.5, c: 1 },
      { type: 'px', x: 8.5, y: 3.5, c: 20 },
    ]);
  },
  ICON_sproutaur(g) {
    g.shapes([
      { type: 'ell', x: 6.5, y: 2.5, rx: 2.5, ry: 2.2, c: 16 },
      { type: 'ell', x: 6, y: 2, rx: 1.2, ry: 1, c: 17 },
      { type: 'rect', x: 4.8, y: 0.5, w: 0.9, h: 1.5, c: 15 },
      { type: 'ell', x: 4, y: 1, rx: 1, ry: 0.8, c: 17 },
      { type: 'ell', x: 6, y: 1, rx: 1, ry: 0.8, c: 17 },
      { type: 'ell', x: 5, y: 6, rx: 4, ry: 3.4, c: 16 },
      { type: 'px', x: 3, y: 5, c: 1 },
      { type: 'px', x: 6, y: 5, c: 1 },
      { type: 'px', x: 1.5, y: 6.5, c: 13 },
      { type: 'ell', x: 4, y: 6.5, rx: 1.2, ry: 1, c: 19 },
    ]);
  },
  ICON_waveturtle(g) {
    g.shapes([
      { type: 'ell', x: 5.5, y: 5, rx: 4, ry: 3.5, c: 11 },
      { type: 'ell', x: 5.5, y: 4.5, rx: 2.6, ry: 2, c: 10 },
      { type: 'px', x: 4.5, y: 3, c: 4 },
      { type: 'px', x: 6.5, y: 2.5, c: 4 },
      { type: 'ell', x: 1.5, y: 6, rx: 1.6, ry: 1.4, c: 25 },
      { type: 'px', x: 0.5, y: 5.5, c: 13 },
      { type: 'px', x: 1.5, y: 5.5, c: 1 },
      { type: 'ell', x: 8.5, y: 7, rx: 1.4, ry: 0.9, c: 25 },
    ]);
  },
  ICON_voltmouse(g) {
    g.shapes([
      { type: 'ell', x: 2.5, y: 2, rx: 1.8, ry: 2.4, c: 20 },
      { type: 'ell', x: 7.5, y: 2, rx: 1.8, ry: 2.4, c: 20 },
      { type: 'px', x: 2.5, y: 0.5, c: 1 },
      { type: 'px', x: 7.5, y: 0.5, c: 1 },
      { type: 'ell', x: 5, y: 5.5, rx: 4, ry: 3.6, c: 20 },
      { type: 'ell', x: 1.5, y: 6.5, rx: 1.2, ry: 1, c: 23 },
      { type: 'ell', x: 8.5, y: 6.5, rx: 1.2, ry: 1, c: 23 },
      { type: 'px', x: 3, y: 4.5, c: 1 },
      { type: 'px', x: 6, y: 4.5, c: 1 },
      { type: 'px', x: 0.5, y: 5.5, c: 13 },
    ]);
  },
  ICON_psykitty(g) {
    g.shapes([
      { type: 'ell', x: 2.5, y: 2, rx: 1.8, ry: 2.4, c: 27 },
      { type: 'ell', x: 7.5, y: 2, rx: 1.8, ry: 2.4, c: 27 },
      { type: 'ell', x: 2.5, y: 2.4, rx: 1, ry: 1.5, c: 28 },
      { type: 'ell', x: 7.5, y: 2.4, rx: 1, ry: 1.5, c: 28 },
      { type: 'ell', x: 5, y: 5.5, rx: 4, ry: 3.6, c: 27 },
      { type: 'ell', x: 5, y: 3.6, rx: 1.1, ry: 1, c: 25 },
      { type: 'px', x: 3, y: 4.5, c: 1 },
      { type: 'px', x: 6, y: 4.5, c: 1 },
      { type: 'ell', x: 1.5, y: 6.5, rx: 1.2, ry: 1, c: 8 },
    ]);
  },
  ICON_rockrhino(g) {
    g.shapes([
      { type: 'line', x1: 0.5, y1: 2, x2: 3, y2: 5, c: 9, thick: 2 },
      { type: 'ell', x: 5, y: 5.5, rx: 4.5, ry: 3.6, c: 11 },
      { type: 'ell', x: 4.5, y: 3.5, rx: 3, ry: 1.8, c: 31 },
      { type: 'ell', x: 4.5, y: 4, rx: 3, ry: 1.1, c: 28 },
      { type: 'px', x: 3.5, y: 2.8, c: 30 },
      { type: 'px', x: 2.5, y: 5, c: 1 },
      { type: 'ell', x: 8, y: 4.5, rx: 1.2, ry: 1.4, c: 31 },
    ]);
  },
};

const DESIGNERS = {
  FIREFOX_F: { w: 36, h: 36, fn: P.FIREFOX_F },
  SPROUTAUR_F: { w: 36, h: 36, fn: P.SPROUTAUR_F },
  WAVETURTLE_F: { w: 36, h: 36, fn: P.WAVETURTLE_F },
  VOLTMOUSE_F: { w: 36, h: 36, fn: P.VOLTMOUSE_F },
  PSYKITTY_F: { w: 36, h: 36, fn: P.PSYKITTY_F },
  ROCKRHINO_F: { w: 36, h: 36, fn: P.ROCKRHINO_F },
  FIREFOX_B: { w: 40, h: 40, fn: P.FIREFOX_B },
  SPROUTAUR_B: { w: 40, h: 40, fn: P.SPROUTAUR_B },
  WAVETURTLE_B: { w: 40, h: 40, fn: P.WAVETURTLE_B },
  VOLTMOUSE_B: { w: 40, h: 40, fn: P.VOLTMOUSE_B },
  PSYKITTY_B: { w: 40, h: 40, fn: P.PSYKITTY_B },
  ROCKRHINO_B: { w: 40, h: 40, fn: P.ROCKRHINO_B },
  ICON_firefox: { w: 10, h: 10, fn: P.ICON_firefox },
  ICON_sproutaur: { w: 10, h: 10, fn: P.ICON_sproutaur },
  ICON_waveturtle: { w: 10, h: 10, fn: P.ICON_waveturtle },
  ICON_voltmouse: { w: 10, h: 10, fn: P.ICON_voltmouse },
  ICON_psykitty: { w: 10, h: 10, fn: P.ICON_psykitty },
  ICON_rockrhino: { w: 10, h: 10, fn: P.ICON_rockrhino },
};

function buildMap(spec) {
  const g = new Grid(spec.w, spec.h);
  spec.fn(g);
  return { w: spec.w, h: spec.h, rows: g.rows() };
}

function buildAll() {
  const out = {};
  for (const name in DESIGNERS) out[name] = buildMap(DESIGNERS[name]);
  return out;
}

module.exports = { Grid, DESIGNERS, buildMap, buildAll };
