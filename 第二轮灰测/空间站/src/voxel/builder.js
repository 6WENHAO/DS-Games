/**
 * voxel/builder.js —— 程序化体素建模 DSL
 *
 * 设计要点：
 *  1. 所有实体图元都用「世界 AABB 遍历 + 隐函数判定」实现，因此任意角度的
 *     斜置盒体、胶囊、抛物面都不会出现步进裂缝（对比逐点绘制的 3D Bresenham）。
 *  2. 材质参数可以是常量 id，也可以是 `(x,y,z) => id` 的程序化函数，
 *     这样条纹、渐变、风化、随机噪点都能一次成型。
 *  3. 提供 `surface()` / `scatter()` / `greeble()` 等表面后处理算子，
 *     用于批量添加细节（铆钉、把手、管线、灯带），这是体素模型"精致度"的来源。
 */

import { MAT } from './palette.js';
import { mulberry32, hash3, clamp } from '../core/math.js';

const AXIS_U = [1, 2, 0]; // 给定主轴 d，另两轴
const AXIS_V = [2, 0, 1];

export class Brush {
  /** @param {import('./volume.js').VoxelVolume} vol @param {number} seed */
  constructor(vol, seed = 1337) {
    this.vol = vol;
    this.rng = mulberry32(seed);
    this.seed = seed;
  }

  /* ───────────────────── 内部工具 ───────────────────── */

  /** 解析材质：常量或程序化函数 */
  _m(mat, x, y, z) {
    return typeof mat === 'function' ? (mat(x, y, z) | 0) : mat;
  }

  _put(x, y, z, mat, mode) {
    const m = this._m(mat, x, y, z);
    if (m === -1) return;                       // -1 表示"跳过"
    if (mode === 'empty') this.vol.setIfEmpty(x, y, z, m);
    else if (mode === 'paint') this.vol.repaint(x, y, z, m);
    else this.vol.set(x, y, z, m);
  }

  /**
   * 通用隐函数填充：遍历 AABB，对满足 test(x,y,z) 的体素写入材质。
   * @param {number[]} lo @param {number[]} hi 含端点的整数 AABB
   * @param {(x:number,y:number,z:number)=>boolean} test
   * @param {number|Function} mat
   * @param {'set'|'empty'|'paint'} [mode]
   */
  implicit(lo, hi, test, mat, mode = 'set') {
    const x0 = Math.floor(lo[0]), y0 = Math.floor(lo[1]), z0 = Math.floor(lo[2]);
    const x1 = Math.ceil(hi[0]), y1 = Math.ceil(hi[1]), z1 = Math.ceil(hi[2]);
    for (let z = z0; z <= z1; z++)
      for (let y = y0; y <= y1; y++)
        for (let x = x0; x <= x1; x++)
          if (test(x, y, z)) this._put(x, y, z, mat, mode);
    return this;
  }

  /* ───────────────────── 基础实体 ───────────────────── */

  /** 轴对齐实心盒（端点含） */
  box(x0, y0, z0, x1, y1, z1, mat, mode = 'set') {
    const ax0 = Math.min(x0, x1) | 0, ax1 = Math.max(x0, x1) | 0;
    const ay0 = Math.min(y0, y1) | 0, ay1 = Math.max(y0, y1) | 0;
    const az0 = Math.min(z0, z1) | 0, az1 = Math.max(z0, z1) | 0;
    for (let z = az0; z <= az1; z++)
      for (let y = ay0; y <= ay1; y++)
        for (let x = ax0; x <= ax1; x++)
          this._put(x, y, z, mat, mode);
    return this;
  }

  /** 空心盒（壳厚 t），可选择省略某些面：faces = '±x±y±z' 中要保留的集合 */
  boxShell(x0, y0, z0, x1, y1, z1, mat, t = 1, skip = '') {
    const ax0 = Math.min(x0, x1), ax1 = Math.max(x0, x1);
    const ay0 = Math.min(y0, y1), ay1 = Math.max(y0, y1);
    const az0 = Math.min(z0, z1), az1 = Math.max(z0, z1);
    const noXn = skip.includes('-x'), noXp = skip.includes('+x');
    const noYn = skip.includes('-y'), noYp = skip.includes('+y');
    const noZn = skip.includes('-z'), noZp = skip.includes('+z');
    for (let z = az0; z <= az1; z++)
      for (let y = ay0; y <= ay1; y++)
        for (let x = ax0; x <= ax1; x++) {
          const onXn = x - ax0 < t, onXp = ax1 - x < t;
          const onYn = y - ay0 < t, onYp = ay1 - y < t;
          const onZn = z - az0 < t, onZp = az1 - z < t;
          const keep = (onXn && !noXn) || (onXp && !noXp) || (onYn && !noYn) ||
                       (onYp && !noYp) || (onZn && !noZn) || (onZp && !noZp);
          if (keep) this._put(x, y, z, mat, 'set');
        }
    return this;
  }

  /** 挖空一个盒（等价于写入空气） */
  carve(x0, y0, z0, x1, y1, z1) {
    return this.box(x0, y0, z0, x1, y1, z1, 0);
  }

  /** 球 / 椭球；shell>0 时只留壳 */
  ellipsoid(cx, cy, cz, rx, ry, rz, mat, shell = 0, mode = 'set') {
    const inner = shell > 0
      ? [Math.max(0, rx - shell), Math.max(0, ry - shell), Math.max(0, rz - shell)]
      : null;
    return this.implicit(
      [cx - rx - 1, cy - ry - 1, cz - rz - 1], [cx + rx + 1, cy + ry + 1, cz + rz + 1],
      (x, y, z) => {
        const dx = (x - cx) / rx, dy = (y - cy) / ry, dz = (z - cz) / rz;
        if (dx * dx + dy * dy + dz * dz > 1) return false;
        if (!inner) return true;
        const ix = (x - cx) / (inner[0] || 0.001), iy = (y - cy) / (inner[1] || 0.001), iz = (z - cz) / (inner[2] || 0.001);
        return ix * ix + iy * iy + iz * iz > 1;
      }, mat, mode);
  }

  sphere(cx, cy, cz, r, mat, shell = 0, mode = 'set') {
    return this.ellipsoid(cx, cy, cz, r, r, r, mat, shell, mode);
  }

  /** 半球：dir 为保留方向的符号（axis + sign），用于穹顶 */
  hemisphere(cx, cy, cz, r, axis, sign, mat, shell = 0) {
    const c = [cx, cy, cz];
    return this.implicit(
      [cx - r - 1, cy - r - 1, cz - r - 1], [cx + r + 1, cy + r + 1, cz + r + 1],
      (x, y, z) => {
        const p = [x, y, z];
        if ((p[axis] - c[axis]) * sign < 0) return false;
        const dx = x - cx, dy = y - cy, dz = z - cz;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 > r * r) return false;
        return shell <= 0 || d2 >= (r - shell) * (r - shell);
      }, mat);
  }

  /**
   * 轴向圆柱。axis: 0=X 1=Y 2=Z；[from,to] 为沿轴范围（含）。
   * shell>0 → 管壁；capFrom/capTo 为端盖材质（不传则开口）。
   */
  cylinder(axis, ca, cb, r, from, to, mat, { shell = 0, capA = null, capB = null, capT = 1 } = {}) {
    if (from > to) { const t = from; from = to; to = t; const c = capA; capA = capB; capB = c; }
    const u = AXIS_U[axis], v = AXIS_V[axis];
    const lo = [0, 0, 0], hi = [0, 0, 0];
    lo[axis] = from; hi[axis] = to;
    lo[u] = ca - r - 1; hi[u] = ca + r + 1;
    lo[v] = cb - r - 1; hi[v] = cb + r + 1;
    const r2 = r * r, ri2 = (r - shell) * (r - shell);
    const p = [0, 0, 0];
    this.implicit(lo, hi, (x, y, z) => {
      p[0] = x; p[1] = y; p[2] = z;
      const du = p[u] - ca, dv = p[v] - cb;
      const d2 = du * du + dv * dv;
      if (d2 > r2) return false;
      if (shell <= 0) return true;
      if (d2 >= ri2) return true;
      // 端盖
      const a = p[axis];
      if (capA !== null && a - from < capT) return true;
      if (capB !== null && to - a < capT) return true;
      return false;
    }, (x, y, z) => {
      p[0] = x; p[1] = y; p[2] = z;
      const a = p[axis];
      const du = p[u] - ca, dv = p[v] - cb;
      const d2 = du * du + dv * dv;
      if (shell > 0 && d2 < ri2) {
        if (capA !== null && a - from < capT) return this._m(capA, x, y, z);
        if (capB !== null && to - a < capT) return this._m(capB, x, y, z);
      }
      return this._m(mat, x, y, z);
    });
    return this;
  }

  /** 轴向圆锥/锥台：半径从 r0（from 端）线性变到 r1（to 端） */
  cone(axis, ca, cb, r0, r1, from, to, mat, shell = 0) {
    if (from > to) { let t = from; from = to; to = t; t = r0; r0 = r1; r1 = t; }
    const u = AXIS_U[axis], v = AXIS_V[axis];
    const rmax = Math.max(r0, r1);
    const lo = [0, 0, 0], hi = [0, 0, 0];
    lo[axis] = from; hi[axis] = to;
    lo[u] = ca - rmax - 1; hi[u] = ca + rmax + 1;
    lo[v] = cb - rmax - 1; hi[v] = cb + rmax + 1;
    const span = (to - from) || 1;
    const p = [0, 0, 0];
    return this.implicit(lo, hi, (x, y, z) => {
      p[0] = x; p[1] = y; p[2] = z;
      const t = (p[axis] - from) / span;
      const r = r0 + (r1 - r0) * t;
      const du = p[u] - ca, dv = p[v] - cb;
      const d2 = du * du + dv * dv;
      if (d2 > r * r) return false;
      if (shell <= 0) return true;
      const ri = r - shell;
      return d2 >= ri * ri;
    }, mat);
  }

  /** 圆环（甜甜圈）。axis 为环法线方向；R 主半径，r 管半径 */
  torus(axis, cx, cy, cz, R, r, mat, mode = 'set') {
    const c = [cx, cy, cz];
    const u = AXIS_U[axis], v = AXIS_V[axis];
    const lo = [0, 0, 0], hi = [0, 0, 0];
    lo[axis] = c[axis] - r - 1; hi[axis] = c[axis] + r + 1;
    lo[u] = c[u] - R - r - 1; hi[u] = c[u] + R + r + 1;
    lo[v] = c[v] - R - r - 1; hi[v] = c[v] + R + r + 1;
    const p = [0, 0, 0];
    return this.implicit(lo, hi, (x, y, z) => {
      p[0] = x; p[1] = y; p[2] = z;
      const du = p[u] - c[u], dv = p[v] - c[v], da = p[axis] - c[axis];
      const q = Math.hypot(du, dv) - R;
      return q * q + da * da <= r * r;
    }, mat, mode);
  }

  /** 圆盘（薄片圆柱） */
  disc(axis, cx, cy, cz, r, thickness, mat, holeR = 0) {
    const c = [cx, cy, cz];
    const half = thickness / 2;
    return this.cylinderRange(axis, c, r, holeR, c[axis] - half, c[axis] + half - (thickness % 2 === 0 ? 1 : 0), mat);
  }

  /** 带内孔的轴向圆柱段（环柱） */
  cylinderRange(axis, c, rOuter, rInner, from, to, mat, mode = 'set') {
    if (from > to) { const t = from; from = to; to = t; }
    const u = AXIS_U[axis], v = AXIS_V[axis];
    const lo = [0, 0, 0], hi = [0, 0, 0];
    lo[axis] = Math.round(from); hi[axis] = Math.round(to);
    lo[u] = c[u] - rOuter - 1; hi[u] = c[u] + rOuter + 1;
    lo[v] = c[v] - rOuter - 1; hi[v] = c[v] + rOuter + 1;
    const ro2 = rOuter * rOuter, ri2 = rInner * rInner;
    const p = [0, 0, 0];
    return this.implicit(lo, hi, (x, y, z) => {
      p[0] = x; p[1] = y; p[2] = z;
      const du = p[u] - c[u], dv = p[v] - c[v];
      const d2 = du * du + dv * dv;
      return d2 <= ro2 && d2 >= ri2;
    }, mat, mode);
  }

  /** 任意朝向的胶囊（粗线段）：桁架斜撑、天线杆、机械臂连杆 */
  capsule(p0, p1, r, mat, mode = 'set') {
    const [ax, ay, az] = p0, [bx, by, bz] = p1;
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    const len2 = dx * dx + dy * dy + dz * dz || 1;
    const lo = [Math.min(ax, bx) - r - 1, Math.min(ay, by) - r - 1, Math.min(az, bz) - r - 1];
    const hi = [Math.max(ax, bx) + r + 1, Math.max(ay, by) + r + 1, Math.max(az, bz) + r + 1];
    const r2 = r * r;
    return this.implicit(lo, hi, (x, y, z) => {
      const px = x - ax, py = y - ay, pz = z - az;
      let t = (px * dx + py * dy + pz * dz) / len2;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const ex = px - dx * t, ey = py - dy * t, ez = pz - dz * t;
      return ex * ex + ey * ey + ez * ez <= r2;
    }, mat, mode);
  }

  /** 任意朝向的方棒（切比雪夫距离版胶囊）：结构梁更"工业" */
  beam(p0, p1, half, mat, mode = 'set') {
    const [ax, ay, az] = p0, [bx, by, bz] = p1;
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    const len2 = dx * dx + dy * dy + dz * dz || 1;
    const lo = [Math.min(ax, bx) - half - 1, Math.min(ay, by) - half - 1, Math.min(az, bz) - half - 1];
    const hi = [Math.max(ax, bx) + half + 1, Math.max(ay, by) + half + 1, Math.max(az, bz) + half + 1];
    return this.implicit(lo, hi, (x, y, z) => {
      const px = x - ax, py = y - ay, pz = z - az;
      let t = (px * dx + py * dy + pz * dz) / len2;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const ex = Math.abs(px - dx * t), ey = Math.abs(py - dy * t), ez = Math.abs(pz - dz * t);
      return Math.max(ex, ey, ez) <= half;
    }, mat, mode);
  }

  /**
   * 斜置盒体（OBB）：给定中心、正交基与半长，AABB 遍历 + 局部投影判定。
   * @param {number[]} c 中心 @param {number[]} u @param {number[]} v @param {number[]} w 单位正交基
   * @param {number[]} half 三轴半长
   */
  obb(c, u, v, w, half, mat, mode = 'set') {
    const ext = [0, 0, 0];
    for (let i = 0; i < 3; i++) {
      ext[i] = Math.abs(u[i]) * half[0] + Math.abs(v[i]) * half[1] + Math.abs(w[i]) * half[2] + 1;
    }
    return this.implicit(
      [c[0] - ext[0], c[1] - ext[1], c[2] - ext[2]], [c[0] + ext[0], c[1] + ext[1], c[2] + ext[2]],
      (x, y, z) => {
        const dx = x - c[0], dy = y - c[1], dz = z - c[2];
        return Math.abs(dx * u[0] + dy * u[1] + dz * u[2]) <= half[0]
            && Math.abs(dx * v[0] + dy * v[1] + dz * v[2]) <= half[1]
            && Math.abs(dx * w[0] + dy * w[1] + dz * w[2]) <= half[2];
      }, mat, mode);
  }

  /**
   * 抛物面天线反射面：沿 axis 开口，深度 depth，口径 r，壳厚 t。
   */
  dish(axis, c, r, depth, t, mat, sign = 1) {
    const u = AXIS_U[axis], v = AXIS_V[axis];
    const lo = [0, 0, 0], hi = [0, 0, 0];
    lo[u] = c[u] - r - 1; hi[u] = c[u] + r + 1;
    lo[v] = c[v] - r - 1; hi[v] = c[v] + r + 1;
    lo[axis] = c[axis] - (sign > 0 ? 1 : depth + t + 1);
    hi[axis] = c[axis] + (sign > 0 ? depth + t + 1 : 1);
    const k = depth / (r * r || 1);
    const p = [0, 0, 0];
    return this.implicit(lo, hi, (x, y, z) => {
      p[0] = x; p[1] = y; p[2] = z;
      const du = p[u] - c[u], dv = p[v] - c[v];
      const d2 = du * du + dv * dv;
      if (d2 > r * r) return false;
      const surf = c[axis] + sign * k * d2;
      const off = (p[axis] - surf) * sign;
      return off >= 0 && off <= t;
    }, mat);
  }

  /* ───────────────────── 复合结构 ───────────────────── */

  /**
   * 空间桁架梁：4 根纵杆 + 交替斜撑 + 周期性横隔框。
   * @param {number[]} p0 @param {number[]} p1 端点
   * @param {number} half 截面半宽
   */
  truss(p0, p1, half, matLongeron, matBrace, { segment = 10, rod = 1, frame = true } = {}) {
    const dir = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
    const len = Math.hypot(...dir);
    if (len < 1) return this;
    for (let i = 0; i < 3; i++) dir[i] /= len;
    // 构造与 dir 正交的两个轴
    const ref = Math.abs(dir[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const u = norm(cross(dir, ref));
    const v = norm(cross(dir, u));
    const corner = (s, t, f) => [
      p0[0] + dir[0] * f * len + u[0] * s * half + v[0] * t * half,
      p0[1] + dir[1] * f * len + u[1] * s * half + v[1] * t * half,
      p0[2] + dir[2] * f * len + u[2] * s * half + v[2] * t * half,
    ];
    const signs = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    // 纵杆
    for (const [s, t] of signs) this.beam(corner(s, t, 0), corner(s, t, 1), rod, matLongeron);
    // 分段斜撑与横框
    const segs = Math.max(1, Math.round(len / segment));
    for (let k = 0; k < segs; k++) {
      const f0 = k / segs, f1 = (k + 1) / segs;
      const flip = k % 2 === 0;
      for (let e = 0; e < 4; e++) {
        const a = signs[e], b = signs[(e + 1) % 4];
        // 每段每个侧面一根斜撑，方向交替形成经典 W 形
        const s0 = flip ? corner(a[0], a[1], f0) : corner(b[0], b[1], f0);
        const s1 = flip ? corner(b[0], b[1], f1) : corner(a[0], a[1], f1);
        this.capsule(s0, s1, rod * 0.8, matBrace);
      }
      if (frame) {
        for (let e = 0; e < 4; e++) {
          const a = signs[e], b = signs[(e + 1) % 4];
          this.beam(corner(a[0], a[1], f1), corner(b[0], b[1], f1), rod * 0.85, matLongeron);
        }
      }
    }
    if (frame) {
      for (let e = 0; e < 4; e++) {
        const a = signs[e], b = signs[(e + 1) % 4];
        this.beam(corner(a[0], a[1], 0), corner(b[0], b[1], 0), rod * 0.85, matLongeron);
      }
    }
    return this;
  }

  /**
   * 太阳翼面板：主体电池阵 + 边框 + 分格缝 + 汇流条。
   * axis 为面板法线方向，面板在另两轴上展开。
   */
  solarPanel(axis, c, halfA, halfB, thickness, { cell = MAT.SOLAR_CELL, bus = MAT.SOLAR_HOT, frame = MAT.SOLAR_FRAME, grid = 9 } = {}) {
    const u = AXIS_U[axis], v = AXIS_V[axis];
    const lo = [0, 0, 0], hi = [0, 0, 0];
    lo[axis] = c[axis] - Math.floor(thickness / 2); hi[axis] = lo[axis] + thickness - 1;
    lo[u] = c[u] - halfA; hi[u] = c[u] + halfA;
    lo[v] = c[v] - halfB; hi[v] = c[v] + halfB;
    const p = [0, 0, 0];
    this.box(lo[0], lo[1], lo[2], hi[0], hi[1], hi[2], (x, y, z) => {
      p[0] = x; p[1] = y; p[2] = z;
      const du = p[u] - (c[u] - halfA), dv = p[v] - (c[v] - halfB);
      const edgeU = Math.min(du, 2 * halfA - du), edgeV = Math.min(dv, 2 * halfB - dv);
      if (edgeU < 1 || edgeV < 1) return frame;                        // 外框
      if (du % grid === 0 || dv % (grid * 2) === 0) return frame;       // 分格缝
      if (dv % (grid * 2) === 1 || (du % grid) === 1) return bus;       // 汇流条
      return cell;
    });
    return this;
  }

  /** 散热板：白色薄板 + 细密鳍片边缘 + 根部转轴 */
  radiatorPanel(axis, c, halfA, halfB, thickness, mat = MAT.RADIATOR, edge = MAT.TITANIUM) {
    const u = AXIS_U[axis], v = AXIS_V[axis];
    const lo = [0, 0, 0], hi = [0, 0, 0];
    lo[axis] = c[axis] - Math.floor(thickness / 2); hi[axis] = lo[axis] + thickness - 1;
    lo[u] = c[u] - halfA; hi[u] = c[u] + halfA;
    lo[v] = c[v] - halfB; hi[v] = c[v] + halfB;
    const p = [0, 0, 0];
    return this.box(lo[0], lo[1], lo[2], hi[0], hi[1], hi[2], (x, y, z) => {
      p[0] = x; p[1] = y; p[2] = z;
      const du = p[u] - (c[u] - halfA), dv = p[v] - (c[v] - halfB);
      if (du < 1 || 2 * halfA - du < 1 || dv < 1 || 2 * halfB - dv < 1) return edge;
      return mat;
    });
  }

  /**
   * 沿圆柱开一圈舱窗（在壳体上重涂，不改变几何），支持竖排多行。
   * @param {number} axis 圆柱轴 @param {number[]} c 轴心（u,v 分量有效）
   */
  windowRing(axis, c, r, at, count, mat, { w = 2, h = 3, phase = 0, ring = MAT.HULL_DARK } = {}) {
    const u = AXIS_U[axis], v = AXIS_V[axis];
    for (let i = 0; i < count; i++) {
      const ang = phase + (i / count) * Math.PI * 2;
      const cu = c[u] + Math.cos(ang) * r, cv = c[v] + Math.sin(ang) * r;
      for (let a = -Math.floor(w / 2) - 1; a <= Math.floor(w / 2) + 1; a++) {
        for (let bi = -Math.floor(h / 2) - 1; bi <= Math.floor(h / 2) + 1; bi++) {
          const border = Math.abs(a) > Math.floor(w / 2) || Math.abs(bi) > Math.floor(h / 2);
          const p = [0, 0, 0];
          p[axis] = Math.round(at + bi);
          p[u] = Math.round(cu + Math.cos(ang + Math.PI / 2) * a);
          p[v] = Math.round(cv + Math.sin(ang + Math.PI / 2) * a);
          // 往内外各推 2 层，确保命中曲面壳体
          for (let k = -2; k <= 1; k++) {
            const q = [p[0], p[1], p[2]];
            q[u] = Math.round(p[u] + Math.cos(ang) * k);
            q[v] = Math.round(p[v] + Math.sin(ang) * k);
            this.vol.repaint(q[0], q[1], q[2], border ? ring : mat);
          }
        }
      }
    }
    return this;
  }

  /** 沿轴向的一圈加强环（重涂 + 微凸起） */
  ribRing(axis, c, r, at, mat, { thickness = 1, protrude = 1 } = {}) {
    this.cylinderRange(axis, c, r + protrude, r - 1, at - Math.floor(thickness / 2), at + Math.floor(thickness / 2), mat);
    return this;
  }

  /** 环形排布回调：把一个"局部构件"复制到轴周围 N 个角度上 */
  radial(axis, c, r, count, cb, phase = 0) {
    const u = AXIS_U[axis], v = AXIS_V[axis];
    for (let i = 0; i < count; i++) {
      const ang = phase + (i / count) * Math.PI * 2;
      const p = [0, 0, 0];
      p[axis] = c[axis];
      p[u] = c[u] + Math.cos(ang) * r;
      p[v] = c[v] + Math.sin(ang) * r;
      const out = [0, 0, 0];
      out[axis] = 0; out[u] = Math.cos(ang); out[v] = Math.sin(ang);
      const tan = [0, 0, 0];
      tan[axis] = 0; tan[u] = -Math.sin(ang); tan[v] = Math.cos(ang);
      const ax = [0, 0, 0]; ax[axis] = 1;
      cb(p, out, tan, ax, ang, i);
    }
    return this;
  }

  /** 沿轴镜像执行（如左右舷对称构件） */
  mirror(axis, at, cb) {
    cb(1, 0);
    const self = this;
    const orig = this.vol;
    // 用坐标翻转代理写入
    const proxy = {
      set: (x, y, z, m) => orig.set(...flip(axis, at, x, y, z), m),
      setIfEmpty: (x, y, z, m) => orig.setIfEmpty(...flip(axis, at, x, y, z), m),
      repaint: (x, y, z, m) => orig.repaint(...flip(axis, at, x, y, z), m),
      get: (x, y, z) => orig.get(...flip(axis, at, x, y, z)),
      solid: (x, y, z) => orig.solid(...flip(axis, at, x, y, z)),
      index: (x, y, z) => orig.index(...flip(axis, at, x, y, z)),
    };
    this.vol = /** @type {any} */(proxy);
    cb(-1, 1);
    this.vol = orig;
    return self;
  }

  /* ───────────────────── 表面后处理 ───────────────────── */

  /**
   * 遍历指定 AABB 内所有"暴露表面体素"，交给回调决定是否重涂 / 附加构件。
   * @param {number[]} lo @param {number[]} hi
   * @param {(x:number,y:number,z:number,nx:number,ny:number,nz:number,mat:number)=>void} cb
   */
  surface(lo, hi, cb) {
    const vol = this.vol;
    for (let z = lo[2]; z <= hi[2]; z++)
      for (let y = lo[1]; y <= hi[1]; y++)
        for (let x = lo[0]; x <= hi[0]; x++) {
          const m = vol.get(x, y, z);
          if (m === 0) continue;
          let nx = 0, ny = 0, nz = 0, exposed = false;
          if (!vol.solid(x + 1, y, z)) { nx += 1; exposed = true; }
          if (!vol.solid(x - 1, y, z)) { nx -= 1; exposed = true; }
          if (!vol.solid(x, y + 1, z)) { ny += 1; exposed = true; }
          if (!vol.solid(x, y - 1, z)) { ny -= 1; exposed = true; }
          if (!vol.solid(x, y, z + 1)) { nz += 1; exposed = true; }
          if (!vol.solid(x, y, z - 1)) { nz -= 1; exposed = true; }
          if (exposed) cb(x, y, z, nx, ny, nz, m);
        }
    return this;
  }

  /**
   * 表面随机凸起细节（greeble）：在暴露面上以一定概率长出 1–3 体素的小盒。
   * 这是让体素模型显得"精密"的核心手段。
   */
  greeble(lo, hi, density, mats, { maxSize = 2, avoid = [], seed = 0 } = {}) {
    const rnd = mulberry32((this.seed ^ (seed * 2654435761)) >>> 0);
    const picks = [];
    this.surface(lo, hi, (x, y, z, nx, ny, nz, m) => {
      if (avoid.includes(m)) return;
      if (hash3(x + seed, y - seed, z + seed * 3) > density) return;
      picks.push(x, y, z, nx, ny, nz);
    });
    for (let i = 0; i < picks.length; i += 6) {
      const [x, y, z, nx, ny, nz] = picks.slice(i, i + 6);
      const mat = mats[(rnd() * mats.length) | 0];
      const s = 1 + ((rnd() * maxSize) | 0);
      const h = 1 + ((rnd() * 2) | 0);
      const dx = nx !== 0 ? Math.sign(nx) : 0, dy = ny !== 0 ? Math.sign(ny) : 0, dz = nz !== 0 ? Math.sign(nz) : 0;
      const ex = dx !== 0 ? h : s, ey = dy !== 0 ? h : s, ez = dz !== 0 ? h : s;
      for (let k = 1; k <= Math.max(1, h); k++) {
        this.box(
          x + dx * k - (dx ? 0 : Math.floor(ex / 2)), y + dy * k - (dy ? 0 : Math.floor(ey / 2)), z + dz * k - (dz ? 0 : Math.floor(ez / 2)),
          x + dx * k + (dx ? 0 : Math.floor(ex / 2)), y + dy * k + (dy ? 0 : Math.floor(ey / 2)), z + dz * k + (dz ? 0 : Math.floor(ez / 2)),
          mat, 'empty'
        );
      }
    }
    return this;
  }

  /** 在暴露表面按概率重涂（风化、污渍、涂装拼色） */
  weather(lo, hi, prob, mat, filter = null) {
    const picks = [];
    this.surface(lo, hi, (x, y, z, nx, ny, nz, m) => {
      if (filter && !filter(m, x, y, z, nx, ny, nz)) return;
      if (hash3(x * 7 + 1, y * 13 + 3, z * 17 + 5) < prob) picks.push(x, y, z);
    });
    for (let i = 0; i < picks.length; i += 3) this.vol.repaint(picks[i], picks[i + 1], picks[i + 2], this._m(mat, picks[i], picks[i + 1], picks[i + 2]));
    return this;
  }

  /** 沿一条轴向直线铺管路（贴合表面 1 体素外） */
  pipeRun(axis, c, from, to, mat, r = 1) {
    const a = [0, 0, 0], b = [0, 0, 0];
    for (let i = 0; i < 3; i++) { a[i] = c[i]; b[i] = c[i]; }
    a[axis] = from; b[axis] = to;
    return this.capsule(a, b, r, mat, 'empty');
  }

  /** 灯带：沿轴向按间隔点亮 */
  lightStrip(axis, c, from, to, mat, spacing = 6) {
    const p = [c[0], c[1], c[2]];
    for (let t = from; t <= to; t += spacing) {
      p[axis] = t;
      this.vol.repaint(p[0], p[1], p[2], mat);
    }
    return this;
  }
}

/* ───────────────────── 向量小工具 ───────────────────── */

function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function norm(a) {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}
function flip(axis, at, x, y, z) {
  const p = [x, y, z];
  p[axis] = 2 * at - p[axis];
  return p;
}

export { cross, norm, clamp };
