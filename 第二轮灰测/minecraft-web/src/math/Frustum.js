/* =====================================================================
 * Frustum — 从 viewProjection 矩阵提取 6 个裁剪平面，用于区块剔除
 * 平面方程 ax+by+cz+d = 0，法线指向视锥内部
 * ===================================================================== */

export class Frustum {
  constructor() {
    // 6 个平面 × 4 分量
    this.planes = new Float32Array(24);
  }

  /** m 为列主序的 viewProj 矩阵 */
  setFromMatrix(m) {
    const p = this.planes;
    const m0 = m[0], m1 = m[1], m2 = m[2], m3 = m[3];
    const m4 = m[4], m5 = m[5], m6 = m[6], m7 = m[7];
    const m8 = m[8], m9 = m[9], m10 = m[10], m11 = m[11];
    const m12 = m[12], m13 = m[13], m14 = m[14], m15 = m[15];

    // left:  row3 + row0
    setPlane(p, 0, m3 + m0, m7 + m4, m11 + m8, m15 + m12);
    // right: row3 - row0
    setPlane(p, 1, m3 - m0, m7 - m4, m11 - m8, m15 - m12);
    // bottom: row3 + row1
    setPlane(p, 2, m3 + m1, m7 + m5, m11 + m9, m15 + m13);
    // top: row3 - row1
    setPlane(p, 3, m3 - m1, m7 - m5, m11 - m9, m15 - m13);
    // near: row3 + row2
    setPlane(p, 4, m3 + m2, m7 + m6, m11 + m10, m15 + m14);
    // far: row3 - row2
    setPlane(p, 5, m3 - m2, m7 - m6, m11 - m10, m15 - m14);
    return this;
  }

  /** AABB 是否与视锥相交（保守测试，可能有假阳性但不会漏） */
  intersectsBox(minX, minY, minZ, maxX, maxY, maxZ) {
    const p = this.planes;
    for (let i = 0; i < 6; i++) {
      const o = i * 4;
      const a = p[o], b = p[o + 1], c = p[o + 2], d = p[o + 3];
      // 取 AABB 在平面法线方向上最“靠内”的点
      const x = a > 0 ? maxX : minX;
      const y = b > 0 ? maxY : minY;
      const z = c > 0 ? maxZ : minZ;
      if (a * x + b * y + c * z + d < 0) return false;
    }
    return true;
  }

  intersectsSphere(cx, cy, cz, r) {
    const p = this.planes;
    for (let i = 0; i < 6; i++) {
      const o = i * 4;
      if (p[o] * cx + p[o + 1] * cy + p[o + 2] * cz + p[o + 3] < -r) return false;
    }
    return true;
  }

  containsPoint(x, y, z) {
    const p = this.planes;
    for (let i = 0; i < 6; i++) {
      const o = i * 4;
      if (p[o] * x + p[o + 1] * y + p[o + 2] * z + p[o + 3] < 0) return false;
    }
    return true;
  }
}

function setPlane(p, i, a, b, c, d) {
  const inv = 1 / (Math.hypot(a, b, c) || 1);
  const o = i * 4;
  p[o] = a * inv; p[o + 1] = b * inv; p[o + 2] = c * inv; p[o + 3] = d * inv;
}
