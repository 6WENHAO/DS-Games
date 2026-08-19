/**
 * kinematics.js — 悬架空间运动学（精确约束求解，非近似动画）
 *
 * 做法：把「转向节 / 车轮支架」当作 6 自由度刚体，位姿 pose = [tx,ty,tz, rx,ry,rz]
 * （rx,ry,rz 为罗德里格斯旋转矢量，绕静态轮心转动），再对其施加 6 个标量约束：
 *
 *  ▸ 前 双叉臂 (Double Wishbone)  —— 5 个运动约束 + 1 个驱动约束
 *      上摆臂外球头必须落在「绕上摆臂内点轴线的圆」上          → 2 个约束
 *      下摆臂外球头必须落在「绕下摆臂内点轴线的圆」上          → 2 个约束
 *      转向横拉杆长度不变                                      → 1 个约束
 *      驱动：轮心垂向位置 = 指定轮跳量                          → 1 个约束
 *
 *  ▸ 后 五连杆 (Five-Link / Multilink) —— 5 个连杆长度不变 + 1 个驱动约束
 *      5 根连杆各自长度恒定（真正的两力杆约束）                → 5 个约束
 *      驱动：轮心垂向位置 = 指定轮跳量                          → 1 个约束
 *
 * 用带数值雅可比的牛顿-拉夫逊迭代求解 6×6 非线性方程组（上一帧热启动，
 * 通常 2~3 次迭代收敛到 1e-10）。因此外倾角变化、前束变化(bump steer)、
 * 摆臂摆角、减振器行程 全都是几何真解 —— 与真实悬架一致。
 *
 * 坐标（角点局部系，原点 = 静态轮心）：
 *   +x = 朝车辆中心线（内侧）   +y = 上   +z = 前
 *   右侧通过 x 取负镜像生成。
 */

import { solveDense } from './linalg.js';

/* ---------------- 向量工具（普通数组，避免 GC 压力） ---------------- */
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const scl = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const len = (a) => Math.hypot(a[0], a[1], a[2]);
export const unit = (a) => { const n = len(a) || 1; return [a[0] / n, a[1] / n, a[2] / n]; };
export const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** 罗德里格斯旋转：绕矢量 r（模=角度）旋转 p */
export function rotVec(r, p) {
  const th2 = r[0] * r[0] + r[1] * r[1] + r[2] * r[2];
  if (th2 < 1e-18) return [p[0], p[1], p[2]];
  const th = Math.sqrt(th2), c = Math.cos(th), s = Math.sin(th);
  const k = [r[0] / th, r[1] / th, r[2] / th];
  const kd = k[0] * p[0] + k[1] * p[1] + k[2] * p[2];
  const kx = [k[1] * p[2] - k[2] * p[1], k[2] * p[0] - k[0] * p[2], k[0] * p[1] - k[1] * p[0]];
  return [
    p[0] * c + kx[0] * s + k[0] * kd * (1 - c),
    p[1] * c + kx[1] * s + k[1] * kd * (1 - c),
    p[2] * c + kx[2] * s + k[2] * kd * (1 - c),
  ];
}
/** 位姿作用于局部点 */
export function poseApply(pose, p0) {
  const r = rotVec([pose[3], pose[4], pose[5]], p0);
  return [r[0] + pose[0], r[1] + pose[1], r[2] + pose[2]];
}
/** 绕任意轴 (A, u) 旋转角度 ang */
export function rotAboutAxis(A, u, ang, p) {
  const d = sub(p, A);
  const r = rotVec(scl(u, ang), d);
  return add(A, r);
}
/** 求 p0→p1 绕轴 (A,u) 的转角（有符号） */
export function angleAboutAxis(A, u, p0, p1) {
  const d0 = sub(p0, A), d1 = sub(p1, A);
  const a0 = sub(d0, scl(u, dot(d0, u)));
  const a1 = sub(d1, scl(u, dot(d1, u)));
  const c = dot(a0, a1), s = dot(cross(a0, a1), u);
  return Math.atan2(s, c);
}

/* ---------------- 硬点定义 ---------------- */
/**
 * 前悬：双叉臂
 * 硬点经 tools/kinfit.mjs 优化：bump steer 全行程 < 0.02°，减振器运动比 0.582
 */
export function frontDoubleWishbone() {
  return {
    type: 'dw', label: '双叉臂 Double Wishbone',
    wheelCenter: [0, 0, 0],
    uca: { a: [0.400, 0.216, 0.112], b: [0.400, 0.212, -0.112], out: [0.116, 0.206, 0.004] },
    lca: { a: [0.620, -0.058, 0.152], b: [0.620, -0.094, -0.152], out: [0.074, -0.146, 0.006] },
    tie: { in: [0.588, -0.019, -0.260], out: [0.116, -0.056, -0.156] },
    damper: { top: [0.265, 0.408, 0.030], bottom: [0.295, -0.122, 0.022], on: 'lca' },
    arb: {                                  // 横向稳定杆（前）
      axis: [0.0, -0.055, -0.40],           // 扭杆轴线所在的 (y,z)，x 由 pivotX 给出
      pivotX: 0.30, arm: [0, 0.035, 0.20], attach: [0.44, -0.086, 0.10], attachOn: 'lca',
    },
    brake: { r: 0.170, t: 0.026, caliperAng: 2.5 },
    upright: [[0.116, 0.206, 0.004], [0.074, -0.146, 0.006], [0.116, -0.056, -0.156], [0, 0, 0]],
    springTurns: 7.5, springR: 0.072, coilR: 0.0115,
  };
}

/**
 * 后悬：五连杆
 * 横拉杆内点经优化：bump steer < 0.01°；连杆长度 403/433/478/479/473 mm
 */
export function rearFiveLink() {
  return {
    type: 'ml', label: '五连杆 Five-Link',
    wheelCenter: [0, 0, 0],
    links: [
      { in: [0.500, 0.146, 0.140], out: [0.106, 0.166, 0.056], name: '上前臂 (外倾控制)', c: 0xd8dde6 },
      { in: [0.520, 0.134, -0.162], out: [0.100, 0.160, -0.062], name: '上后臂', c: 0xd8dde6 },
      { in: [0.552, -0.150, 0.172], out: [0.086, -0.166, 0.066], name: '下前臂 (承载)', c: 0xc2c8d2 },
      { in: [0.560, -0.166, -0.150], out: [0.090, -0.176, -0.056], name: '下后臂 (纵向定位)', c: 0xc2c8d2 },
      { in: [0.566, -0.056, -0.372], out: [0.116, -0.050, -0.226], name: '横拉杆 (前束控制)', c: 0xffc46b },
    ],
    damper: { top: [0.222, 0.432, 0.032], bottom: [0.152, -0.140, 0.024], on: 'carrier' },
    arb: {
      axis: [0.0, -0.070, 0.42], pivotX: 0.32, arm: [0, 0.032, -0.19],
      attach: [0.40, -0.156, 0.10], attachOn: 'link3',
    },
    brake: { r: 0.158, t: 0.022, caliperAng: -2.4 },
    upright: [[0.106, 0.166, 0.056], [0.100, 0.160, -0.062], [0.086, -0.166, 0.066], [0.090, -0.176, -0.056], [0.116, -0.050, -0.226], [0, 0, 0]],
    springTurns: 8, springR: 0.076, coilR: 0.0115,
  };
}

/** 镜像（生成右侧硬点）：x 取负 */
export function mirrorDef(def) {
  const mp = (p) => [-p[0], p[1], p[2]];
  const walk = (o) => {
    if (Array.isArray(o)) {
      if (o.length === 3 && o.every(v => typeof v === 'number')) return mp(o);
      return o.map(walk);
    }
    if (o && typeof o === 'object') {
      const r = {};
      for (const k in o) r[k] = (k === 'pivotX') ? -o[k] : walk(o[k]);
      return r;
    }
    return o;
  };
  const d = walk(def);
  d.mirrored = true;
  return d;
}

/* ---------------- 求解器 ---------------- */
export class CornerSolver {
  constructor(def) {
    this.def = def;
    this.pose = new Float64Array(6);
    this.res = new Float64Array(6);
    this.res2 = new Float64Array(6);
    this.J = new Float64Array(36);
    this.target = 0;
    this.iters = 0; this.err = 0;

    if (def.type === 'dw') {
      this.ucaU = unit(sub(def.uca.b, def.uca.a));
      this.lcaU = unit(sub(def.lca.b, def.lca.a));
      this.ucaRef = this._axisRef(def.uca.a, this.ucaU, def.uca.out);
      this.lcaRef = this._axisRef(def.lca.a, this.lcaU, def.lca.out);
      this.tieL = dist(def.tie.out, def.tie.in);
    } else {
      this.linkL = def.links.map(l => dist(l.out, l.in));
    }
    this.damperL0 = dist(def.damper.top, def.damper.bottom);
    // ARB 初始几何
    if (def.arb) {
      const A = def.arb;
      this.arbPivot = [A.pivotX, A.axis[1], A.axis[2]];
      this.arbTip0 = add(this.arbPivot, A.arm);
      this.arbR = len(A.arm);
      this.arbLinkL = dist(this.arbTip0, A.attach);
      this.arbAng = 0;
    }
    this.out = {
      pose: this.pose, pts: {}, camber: 0, toe: 0, damperLen: 0, damperTop: null, damperBottom: null,
      ucaAng: 0, lcaAng: 0, arbTip: null, arbAttach: null, arbAng: 0, wheelCenter: [0, 0, 0],
      converged: true,
    };
    this.solve(0);
  }

  _axisRef(A, u, P) {
    const d = sub(P, A);
    const along = dot(d, u);
    const perp = Math.sqrt(Math.max(0, dot(d, d) - along * along));
    return { along, perp };
  }

  _residual(pose, res) {
    const def = this.def;
    if (def.type === 'dw') {
      // 上摆臂外球头：绕上摆臂轴线的圆
      let P = poseApply(pose, def.uca.out);
      let d = sub(P, def.uca.a), al = dot(d, this.ucaU);
      res[0] = al - this.ucaRef.along;
      res[1] = Math.sqrt(Math.max(1e-14, dot(d, d) - al * al)) - this.ucaRef.perp;
      // 下摆臂外球头
      P = poseApply(pose, def.lca.out);
      d = sub(P, def.lca.a); al = dot(d, this.lcaU);
      res[2] = al - this.lcaRef.along;
      res[3] = Math.sqrt(Math.max(1e-14, dot(d, d) - al * al)) - this.lcaRef.perp;
      // 横拉杆定长
      res[4] = dist(poseApply(pose, def.tie.out), def.tie.in) - this.tieL;
    } else {
      for (let i = 0; i < 5; i++) {
        res[i] = dist(poseApply(pose, def.links[i].out), def.links[i].in) - this.linkL[i];
      }
    }
    // 驱动约束：轮心垂向 = 目标轮跳
    res[5] = poseApply(pose, def.wheelCenter)[1] - this.target;
  }

  /** 求解给定轮跳量（m，向上为压缩正）下的完整几何 */
  solve(targetY) {
    this.target = targetY;
    const pose = this.pose, res = this.res, res2 = this.res2, J = this.J;
    let it = 0, err = Infinity;
    for (; it < 12; it++) {
      this._residual(pose, res);
      err = 0; for (let i = 0; i < 6; i++) err = Math.max(err, Math.abs(res[i]));
      if (err < 1e-11) break;
      const h = 1e-7;
      for (let j = 0; j < 6; j++) {
        const old = pose[j];
        pose[j] = old + h;
        this._residual(pose, res2);
        pose[j] = old;
        for (let i = 0; i < 6; i++) J[i * 6 + j] = (res2[i] - res[i]) / h;
      }
      const dx = solveDense(J, res, 6);
      let step = 1;
      // 阻尼牛顿：限制单步幅度，保证极端行程下不发散
      let mx = 0; for (let j = 0; j < 6; j++) mx = Math.max(mx, Math.abs(dx[j]));
      if (mx > 0.08) step = 0.08 / mx;
      for (let j = 0; j < 6; j++) pose[j] -= step * dx[j];
    }
    this.iters = it; this.err = err;
    this._extract();
    return this.out;
  }

  _extract() {
    const def = this.def, pose = this.pose, o = this.out;
    o.converged = this.err < 1e-7;
    o.wheelCenter = poseApply(pose, def.wheelCenter);

    // 车轮姿态：自旋轴 = 局部 +x
    const ax = rotVec([pose[3], pose[4], pose[5]], [1, 0, 0]);
    o.axis = ax;
    // 右侧硬点是左侧的镜像，位姿解也是镜像解 —— 外倾/前束的「物理」符号需按侧翻转
    const sgn = def.mirrored ? -1 : 1;
    o.camber = sgn * Math.asin(Math.max(-1, Math.min(1, ax[1]))) * 180 / Math.PI;
    o.toe = -sgn * Math.asin(Math.max(-1, Math.min(1, ax[2]))) * 180 / Math.PI;
    o.rotVec = [pose[3], pose[4], pose[5]];

    const pts = o.pts;
    if (def.type === 'dw') {
      pts.ucaOut = poseApply(pose, def.uca.out);
      pts.lcaOut = poseApply(pose, def.lca.out);
      pts.tieOut = poseApply(pose, def.tie.out);
      o.ucaAng = angleAboutAxis(def.uca.a, this.ucaU, def.uca.out, pts.ucaOut);
      o.lcaAng = angleAboutAxis(def.lca.a, this.lcaU, def.lca.out, pts.lcaOut);
      o.damperBottom = rotAboutAxis(def.lca.a, this.lcaU, o.lcaAng, def.damper.bottom);
      pts.upright = def.upright.map(p => poseApply(pose, p));
    } else {
      pts.linkOut = def.links.map(l => poseApply(pose, l.out));
      o.damperBottom = poseApply(pose, def.damper.bottom);
      pts.upright = def.upright.map(p => poseApply(pose, p));
    }
    o.damperTop = def.damper.top;
    o.damperLen = dist(o.damperTop, o.damperBottom);
    o.damperStroke = o.damperLen - this.damperL0;

    // 横向稳定杆：解出摆臂转角，使拉杆长度守恒（圆-球交点，闭式解）
    if (def.arb) {
      const A = def.arb;
      let attach;
      if (A.attachOn === 'lca' && def.type === 'dw') {
        attach = rotAboutAxis(def.lca.a, this.lcaU, o.lcaAng, A.attach);
      } else if (A.attachOn === 'link3' && def.type === 'ml') {
        const l = def.links[2], out = pts.linkOut[2];
        const f = dist(A.attach, l.in) / Math.max(1e-9, dist(l.out, l.in));
        attach = add(l.in, scl(sub(out, l.in), f));
      } else {
        attach = poseApply(pose, A.attach);
      }
      const P = this.arbPivot, r = this.arbR;
      const u = attach[1] - P[1], w = attach[2] - P[2];
      const dx2 = (P[0] - attach[0]) ** 2;
      const R = Math.hypot(u, w);
      const C = (dx2 + u * u + w * w + r * r - this.arbLinkL ** 2) / (2 * r);
      const ph = Math.atan2(w, u);
      let t;
      if (R < 1e-9 || Math.abs(C / R) > 1) t = this.arbAng;
      else {
        const ac = Math.acos(Math.max(-1, Math.min(1, C / R)));
        const t1 = ph + ac, t2 = ph - ac;
        const d1 = Math.abs(angDiff(t1, this.arbRefAng ?? t1));
        const d2 = Math.abs(angDiff(t2, this.arbRefAng ?? t1));
        t = d1 <= d2 ? t1 : t2;
      }
      if (this.arbRefAng === undefined) this.arbRefAng = t;
      this.arbAng = t;
      o.arbTip = [P[0], P[1] + r * Math.cos(t), P[2] + r * Math.sin(t)];
      o.arbAttach = attach;
      o.arbAng = angDiff(t, this.arbRefAng);
      o.arbPivot = P;
    }
    return o;
  }

  /** 扫掠运动学特性曲线（外倾/前束/减振器行程 vs 轮跳） */
  sweep(minT = -0.09, maxT = 0.09, n = 41) {
    const save = Float64Array.from(this.pose), st = this.target;
    const rows = [];
    for (let i = 0; i < n; i++) {
      const t = minT + (maxT - minT) * (i / (n - 1));
      this.solve(t);
      rows.push({ travel: t, camber: this.out.camber, toe: this.out.toe, damper: this.out.damperStroke, ok: this.out.converged });
    }
    this.pose.set(save); this.solve(st);
    return rows;
  }
}
function angDiff(a, b) { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; }
