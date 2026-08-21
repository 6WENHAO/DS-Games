/**
 * 体素笔刷：巨构生成器使用的几何原语。
 * 所有坐标都是闭区间（inclusive）。
 */

export class Brush {
  constructor(world) { this.w = world; }

  fill(x0, y0, z0, x1, y1, z1, m) {
    this.w.fillBox(
      Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1),
      Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1), m,
    );
  }

  clear(x0, y0, z0, x1, y1, z1) { this.fill(x0, y0, z0, x1, y1, z1, 0); }

  /** 四面竖墙（无顶无底），厚度 t */
  wallsXZ(x0, y0, z0, x1, y1, z1, m, t = 1) {
    this.fill(x0, y0, z0, x0 + t - 1, y1, z1, m);
    this.fill(x1 - t + 1, y0, z0, x1, y1, z1, m);
    this.fill(x0 + t, y0, z0, x1 - t, y1, z0 + t - 1, m);
    this.fill(x0 + t, y0, z1 - t + 1, x1 - t, y1, z1, m);
  }

  /** 六面壳体 */
  shell(x0, y0, z0, x1, y1, z1, m, t = 1) {
    this.wallsXZ(x0, y0, z0, x1, y1, z1, m, t);
    this.fill(x0 + t, y0, z0 + t, x1 - t, y0 + t - 1, z1 - t, m);
    this.fill(x0 + t, y1 - t + 1, z0 + t, x1 - t, y1, z1 - t, m);
  }

  /** 12 条棱（巨型框架的骨架） */
  edgeBars(x0, y0, z0, x1, y1, z1, m, t = 1) {
    const e = t - 1;
    // 竖棱
    for (const [cx, cz] of [[x0, z0], [x1 - e, z0], [x0, z1 - e], [x1 - e, z1 - e]]) {
      this.fill(cx, y0, cz, cx + e, y1, cz + e, m);
    }
    // 上下横棱
    for (const y of [y0, y1 - e]) {
      this.fill(x0, y, z0, x1, y + e, z0 + e, m);
      this.fill(x0, y, z1 - e, x1, y + e, z1, m);
      this.fill(x0, y, z0 + e + 1, x0 + e, y + e, z1 - e - 1, m);
      this.fill(x1 - e, y, z0 + e + 1, x1, y + e, z1 - e - 1, m);
    }
  }

  slab(x0, z0, x1, z1, y, h, m) { this.fill(x0, y, z0, x1, y + h - 1, z1, m); }

  /** 1×1 竖柱：col(x, y0, z, y1) */
  col(x, y0, z, y1, m) { this.fill(x, y0, z, x, y1, z, m); }

  /** 方柱：以 (x,z) 为中心，半宽 r */
  colR(x, z, r, y0, y1, m) { this.fill(x - r, y0, z - r, x + r, y1, z + r, m); }

  /** 体素圆柱 */
  cyl(cx, cz, r, y0, y1, m) {
    const r2 = (r + 0.35) * (r + 0.35);
    for (let dz = -r; dz <= r; dz++) {
      const zz = dz * dz;
      let span = -1;
      for (let dx = -r; dx <= r; dx++) {
        const inside = dx * dx + zz <= r2;
        if (inside && span < 0) span = dx;
        if ((!inside || dx === r) && span >= 0) {
          const end = inside ? dx : dx - 1;
          this.fill(cx + span, y0, cz + dz, cx + end, y1, cz + dz, m);
          span = -1;
        }
      }
    }
  }

  /** 体素圆环（管） */
  ring(cx, cz, r0, r1, y0, y1, m) {
    const ro2 = (r1 + 0.35) * (r1 + 0.35);
    const ri2 = (r0 - 0.35) * (r0 - 0.35);
    for (let dz = -r1; dz <= r1; dz++) {
      const zz = dz * dz;
      for (let dx = -r1; dx <= r1; dx++) {
        const d = dx * dx + zz;
        if (d <= ro2 && d >= ri2) this.fill(cx + dx, y0, cz + dz, cx + dx, y1, cz + dz, m);
      }
    }
  }

  /** 粗线段（桁架斜撑、管道、缆索） */
  lineBar(x0, y0, z0, x1, y1, z1, m, t = 1) {
    const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0;
    const n = Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz));
    if (n === 0) { this.fill(x0, y0, z0, x0 + t - 1, y0 + t - 1, z0 + t - 1, m); return; }
    const e = t - 1;
    for (let i = 0; i <= n; i++) {
      const s = i / n;
      const x = Math.round(x0 + dx * s), y = Math.round(y0 + dy * s), z = Math.round(z0 + dz * s);
      this.fill(x, y, z, x + e, y + e, z + e, m);
    }
  }

  /** 竖向 X 形斜撑阵列（axis: 0=在 x 常量面上, 2=在 z 常量面上） */
  crossBrace(axis, c, a0, a1, y0, y1, m, t = 2, steps = 1) {
    const da = (a1 - a0) / steps, dy = (y1 - y0) / steps;
    for (let i = 0; i < steps; i++) {
      const A0 = Math.round(a0 + da * i), A1 = Math.round(a0 + da * (i + 1));
      const Y0 = Math.round(y0 + dy * i), Y1 = Math.round(y0 + dy * (i + 1));
      if (axis === 0) {
        this.lineBar(c, Y0, A0, c, Y1, A1, m, t);
        this.lineBar(c, Y1, A0, c, Y0, A1, m, t);
      } else {
        this.lineBar(A0, Y0, c, A1, Y1, c, m, t);
        this.lineBar(A0, Y1, c, A1, Y0, c, m, t);
      }
    }
  }

  /** 交替色带（警示条纹） */
  stripe(x0, y0, z0, x1, y1, z1, mA, mB, period = 4, axis = 0) {
    const lo = axis === 0 ? x0 : axis === 1 ? y0 : z0;
    const hi = axis === 0 ? x1 : axis === 1 ? y1 : z1;
    for (let i = lo; i <= hi; i++) {
      const m = (Math.floor((i - lo) / period) % 2 === 0) ? mA : mB;
      if (axis === 0) this.fill(i, y0, z0, i, y1, z1, m);
      else if (axis === 1) this.fill(x0, i, z0, x1, i, z1, m);
      else this.fill(x0, y0, i, x1, y1, i, m);
    }
  }
}
