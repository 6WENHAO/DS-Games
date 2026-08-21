/**
 * voxel/stencil.js —— 5×5 体素点阵字模
 *
 * 用于在壳板、机库门、帆板背面喷涂舱段编号与警示文字。
 * 字模用「每行一个二进制串」书写，加载时展开成位图，可读性优于手算十六进制。
 */

/** @type {Record<string,string>} 每字形 5 行 × 5 列，1 = 有墨 */
const GLYPHS = {
  A: '01110/10001/11111/10001/10001',
  B: '11110/10001/11110/10001/11110',
  C: '01111/10000/10000/10000/01111',
  D: '11110/10001/10001/10001/11110',
  E: '11111/10000/11110/10000/11111',
  F: '11111/10000/11110/10000/10000',
  G: '01111/10000/10011/10001/01111',
  H: '10001/10001/11111/10001/10001',
  I: '11111/00100/00100/00100/11111',
  J: '00111/00010/00010/10010/11100',
  K: '10001/10010/11100/10010/10001',
  L: '10000/10000/10000/10000/11111',
  M: '10001/11011/10101/10001/10001',
  N: '10001/11001/10101/10011/10001',
  O: '01110/10001/10001/10001/01110',
  P: '11110/10001/11110/10000/10000',
  Q: '01110/10001/10101/10011/01111',
  R: '11110/10001/11110/10010/10001',
  S: '01111/10000/01110/00001/11110',
  T: '11111/00100/00100/00100/00100',
  U: '10001/10001/10001/10001/01110',
  V: '10001/10001/10001/01010/00100',
  W: '10001/10001/10101/11011/10001',
  X: '10001/01010/00100/01010/10001',
  Y: '10001/01010/00100/00100/00100',
  Z: '11111/00010/00100/01000/11111',
  0: '01110/10011/10101/11001/01110',
  1: '00100/01100/00100/00100/01110',
  2: '11110/00001/01110/10000/11111',
  3: '11110/00001/00110/00001/11110',
  4: '10010/10010/11111/00010/00010',
  5: '11111/10000/11110/00001/11110',
  6: '01110/10000/11110/10001/01110',
  7: '11111/00010/00100/01000/01000',
  8: '01110/10001/01110/10001/01110',
  9: '01110/10001/01111/00001/01110',
  '-': '00000/00000/11111/00000/00000',
  '.': '00000/00000/00000/00000/00100',
  '/': '00001/00010/00100/01000/10000',
  ':': '00000/00100/00000/00100/00000',
  '+': '00000/00100/01110/00100/00000',
  '>': '01000/00100/00010/00100/01000',
  ' ': '00000/00000/00000/00000/00000',
};

export const GLYPH_W = 5;
export const GLYPH_H = 5;

/** 展开为 { char: Uint8Array(25) } */
const BITMAPS = /** @type {Record<string, Uint8Array>} */ ({});
for (const [ch, rows] of Object.entries(GLYPHS)) {
  const bm = new Uint8Array(GLYPH_W * GLYPH_H);
  rows.split('/').forEach((row, r) => {
    for (let c = 0; c < GLYPH_W; c++) if (row[c] === '1') bm[r * GLYPH_W + c] = 1;
  });
  BITMAPS[ch] = bm;
}

/** 文本像素宽度（含字间距 1） */
export const textWidth = (text, spacing = 1) => text.length * (GLYPH_W + spacing) - spacing;

/**
 * 在某个轴对齐平面上「喷涂」文字（仅重涂已有体素，不新增几何）。
 *
 * @param {import('./volume.js').VoxelVolume} vol
 * @param {string} text
 * @param {object} o
 * @param {number} o.axis    平面法线轴 0=X 1=Y 2=Z
 * @param {number} o.plane   平面在法线轴上的坐标
 * @param {number} o.u       文字起始点在 (axis+1)%3 轴上的坐标
 * @param {number} o.v       文字起始点在 (axis+2)%3 轴上的坐标
 * @param {number} o.mat     喷涂材质
 * @param {number} [o.scale] 放大倍数
 * @param {number} [o.du]    u 轴步进方向（±1）
 * @param {number} [o.dv]    v 轴步进方向（±1，-1 时文字向 -v 生长即"倒着排"）
 * @param {number} [o.depth] 沿法线向内重涂的层数（保证命中曲面）
 * @param {number} [o.dn]    向内方向（±1，默认 -1）
 * @param {number} [o.spacing]
 */
export function stencil(vol, text, o) {
  const { axis, plane, u, v, mat, scale = 1, du = 1, dv = 1, depth = 2, dn = -1, spacing = 1 } = o;
  const AU = [1, 2, 0][axis], AV = [2, 0, 1][axis];
  const up = String(text).toUpperCase();
  let cursor = 0;
  let painted = 0;
  for (const ch of up) {
    const bm = BITMAPS[ch] || BITMAPS[' '];
    for (let r = 0; r < GLYPH_H; r++) {
      for (let c = 0; c < GLYPH_W; c++) {
        if (!bm[r * GLYPH_W + c]) continue;
        for (let sy = 0; sy < scale; sy++) {
          for (let sx = 0; sx < scale; sx++) {
            const p = [0, 0, 0];
            p[AU] = u + du * ((cursor + c) * scale + sx);
            p[AV] = v + dv * ((GLYPH_H - 1 - r) * scale + sy);
            for (let k = 0; k < depth; k++) {
              p[axis] = plane + dn * k;
              if (vol.repaint(p[0], p[1], p[2], mat)) painted++;
            }
          }
        }
      }
    }
    cursor += GLYPH_W + spacing;
  }
  return painted;
}

/**
 * 在圆柱表面沿周向环绕喷涂（用于核心舱侧壁标识）。
 * @param {import('./volume.js').VoxelVolume} vol
 * @param {string} text
 * @param {object} o
 * @param {number} o.axis   圆柱轴
 * @param {number[]} o.c    轴心（三分量，仅另两轴有效）
 * @param {number} o.r      半径
 * @param {number} o.at     沿轴的中心位置
 * @param {number} o.ang0   起始角（弧度）
 * @param {number} o.mat
 * @param {number} [o.scale]
 * @param {number} [o.flip] 1 或 -1，文字沿轴方向翻转
 */
export function stencilCylinder(vol, text, o) {
  const { axis, c, r, at, ang0, mat, scale = 1, flip = 1, spacing = 1 } = o;
  const AU = [1, 2, 0][axis], AV = [2, 0, 1][axis];
  const up = String(text).toUpperCase();
  const totalW = textWidth(up, spacing) * scale;
  // 弧长 → 角度：每体素约对应 1/r 弧度
  const dAng = 1 / Math.max(1, r);
  let cursor = 0;
  for (const ch of up) {
    const bm = BITMAPS[ch] || BITMAPS[' '];
    for (let row = 0; row < GLYPH_H; row++) {
      for (let col = 0; col < GLYPH_W; col++) {
        if (!bm[row * GLYPH_W + col]) continue;
        for (let sy = 0; sy < scale; sy++) {
          for (let sx = 0; sx < scale; sx++) {
            const arcIdx = (cursor + col) * scale + sx - totalW / 2;
            const ang = ang0 + arcIdx * dAng;
            const axial = at + flip * ((GLYPH_H - 1 - row) * scale + sy - (GLYPH_H * scale) / 2);
            for (let k = 0; k <= 2; k++) {
              const rr = r - k;
              const p = [0, 0, 0];
              p[axis] = Math.round(axial);
              p[AU] = Math.round(c[AU] + Math.cos(ang) * rr);
              p[AV] = Math.round(c[AV] + Math.sin(ang) * rr);
              vol.repaint(p[0], p[1], p[2], mat);
            }
          }
        }
      }
    }
    cursor += GLYPH_W + spacing;
  }
}
