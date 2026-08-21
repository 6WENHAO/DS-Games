// ---------------------------------------------------------------------------
// 屋面（檐 / 攒尖顶 / 塔刹）
//
// 八面完全对称 → 只建一面，其余用实例旋转复制。
// 一面自下而上的叠层（与真实做法一致）：
//   撩檐枋 → 檐椽 → 飞椽 → 望板 → 板瓦(底瓦) → 筒瓦(盖瓦) → 檐口瓦当滴水
// 转角：老角梁 + 仔角梁（翼角起翘）+ 垂脊。
// 檐口曲线 = 起翘（角部抬高）+ 出翘（角部径向外伸），故相邻两面在角脊自然交汇。
//
// 瓦垄根数由「檐口实长 ÷ 瓦垄间距」定，不再跟屋面网格挂钩；
// 攒尖顶因半径急剧收小，采用「抽垄」：每当周长减半即把瓦垄数折半（真实做法）。
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { MAT } from '../lib/materials.js';
import { OCT_N } from '../lib/geom.js';
import { f, ZUCAI, CAI_T } from '../lib/cai.js';

const HALF = Math.PI / OCT_N; // 22.5°
const TAN_HALF = Math.tan(HALF);
const TILE_SPACE = 0.34; // 瓦垄中距（筒瓦 + 板瓦）
const TILE_R = 0.082; // 筒瓦半径
const TILE_LIFT = 0.055; // 板瓦面高出望板

const smooth = (e0, e1, x) => {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};
const pol = (th, r, y) => [Math.sin(th) * r, y, Math.cos(th) * r];
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const dist3 = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);

/** 在两点之间架一根方料（截面 w×h，长边沿两点连线） */
function beam(s, mat, p0, p1, w, h) {
  const dx = p1[0] - p0[0];
  const dy = p1[1] - p0[1];
  const dz = p1[2] - p0[2];
  const len = Math.hypot(dx, dy, dz);
  const ry = Math.atan2(dx, dz);
  const rx = -Math.atan2(dy, Math.hypot(dx, dz));
  s.push((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, (p0[2] + p1[2]) / 2, ry, 1, rx);
  s.box(mat, w, h, len, 0, -h / 2, 0, 0, 0.4);
  s.pop();
}

/** 沿两点铺一节筒瓦（半圆瓦，凸面朝上） */
function tileRun(s, p0, p1, r = TILE_R, mat = MAT.tile) {
  const dx = p1[0] - p0[0];
  const dy = p1[1] - p0[1];
  const dz = p1[2] - p0[2];
  const len = Math.hypot(dx, dy, dz) * 1.06;
  const ry = Math.atan2(dx, dz);
  const rx = -Math.atan2(dy, Math.hypot(dx, dz));
  s.push((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, (p0[2] + p1[2]) / 2, ry, 1, rx);
  s.halfCyl(mat, r, len, 0, 0, 0, 0, 0, 4, 0.3);
  s.pop();
}

/* ========================================================================== */
/*                                 出檐一面                                   */
/* ========================================================================== */
/**
 * @param {Object} o
 *   rLiao   撩檐枋半径（柱心边心距 + 铺作出跳）
 *   rWall   屋面上口半径（贴上层塔身）
 *   riseUp  上口相对撩檐枋的高差
 *   yanChu / feiChu  檐椽出 / 飞椽出
 *   qiQiao / chuQiao 角部起翘 / 出翘
 */
export function eaveFace(s, o = {}) {
  const rLiao = o.rLiao;
  const rWall = o.rWall ?? rLiao - 2.2;
  const riseUp = o.riseUp ?? 2.0;
  const yanChu = o.yanChu ?? 0.85;
  const feiChu = o.feiChu ?? 0.55;
  const qiQiao = o.qiQiao ?? 0.5;
  const chuQiao = o.chuQiao ?? 0.35;
  const NT = o.segT ?? 14; // 屋面顺身细分
  const NR = o.segR ?? 3; // 径向（举折）细分

  /* --------------------------- 撩檐枋 / 承椽枋 --------------------------- */
  const wLiao = 2 * rLiao * TAN_HALF;
  s.box(MAT.fang, wLiao + 0.02, ZUCAI, CAI_T * 1.2, 0, -ZUCAI, rLiao, 0, 0.6);
  const wUp = 2 * rWall * TAN_HALF;
  s.box(MAT.fang, wUp, f(16), f(12), 0, riseUp - f(16), rWall, 0, 0.6);

  /* ----------------------- 屋面参数化：pt(u, t) ------------------------ */
  // 上口（直线弦）
  const upperAt = (u) => {
    const x = u * rWall * TAN_HALF;
    return { th: Math.atan2(x, rWall), r: Math.hypot(x, rWall), y: riseUp };
  };
  // 檐口（飞椽头：起翘 + 出翘）
  const lowerAt = (u) => {
    const au = Math.abs(u);
    const q = qiQiao * Math.pow(smooth(0.45, 1, au), 1.5);
    const cq = chuQiao * Math.pow(smooth(0.5, 1, au), 1.4);
    const x = u * rLiao * TAN_HALF;
    return {
      th: Math.atan2(x, rLiao),
      r: Math.hypot(x, rLiao) + yanChu + feiChu + cq,
      y: -yanChu * 0.42 + feiChu * 0.12 + q,
    };
  };
  const pt = (u, t, dy = 0) => {
    const a = upperAt(u);
    const b = lowerAt(u);
    return pol(
      a.th + (b.th - a.th) * t,
      a.r + (b.r - a.r) * t,
      a.y + (b.y - a.y) * Math.pow(t, 0.72) + dy
    );
  };

  /* --------------------------- 望板 + 板瓦面 --------------------------- */
  for (let j = 0; j < NR; j++) {
    const t0 = j / NR;
    const t1 = (j + 1) / NR;
    for (let i = 0; i < NT; i++) {
      const u0 = (i / NT) * 2 - 1;
      const u1 = ((i + 1) / NT) * 2 - 1;
      // 望板（双面，仰视可见）
      s.panel(MAT.ban, pt(u0, t0), pt(u1, t0), pt(u1, t1), pt(u0, t1), 0.7, true);
      // 板瓦（底瓦）面：略高于望板，顶点顺序取反使法线朝上
      s.panel(
        MAT.tileDark,
        pt(u0, t0, TILE_LIFT),
        pt(u0, t1, TILE_LIFT),
        pt(u1, t1, TILE_LIFT),
        pt(u1, t0, TILE_LIFT),
        0.45
      );
    }
  }

  /* ------------------------------ 筒瓦瓦垄 ----------------------------- */
  const eaveLen = 2 * lowerAt(1).r * Math.sin(HALF); // 檐口弦长
  const nTile = Math.max(8, Math.round(eaveLen / TILE_SPACE));
  for (let k = 0; k <= nTile; k++) {
    const u = (k / nTile) * 2 - 1;
    for (let j = 0; j < NR; j++) {
      tileRun(s, pt(u, j / NR, TILE_LIFT + TILE_R * 0.3), pt(u, (j + 1) / NR, TILE_LIFT + TILE_R * 0.3));
    }
    // 檐口瓦当（筒瓦头）
    const e = pt(u, 1, TILE_LIFT + TILE_R * 0.3);
    s.push(e[0], e[1], e[2], Math.atan2(e[0], e[2]));
    s.cyl(MAT.tileDark, TILE_R * 1.3, TILE_R * 1.3, 0.05, 0, -TILE_R * 1.3, 0.03, 8, 0, 0.3);
    s.pop();
  }
  // 檐口滴水（板瓦头，沿檐口一圈下折）
  for (let i = 0; i < NT; i++) {
    const u0 = (i / NT) * 2 - 1;
    const u1 = ((i + 1) / NT) * 2 - 1;
    const a = pt(u0, 1, TILE_LIFT);
    const b = pt(u1, 1, TILE_LIFT);
    s.panel(
      MAT.tileDark,
      a,
      b,
      [b[0], b[1] - 0.13, b[2] + 0.03],
      [a[0], a[1] - 0.13, a[2] + 0.03],
      0.4,
      true
    );
  }

  /* -------------------------------- 椽 --------------------------------
   * 屋面有举折（上陡下缓），故椽子必须逐步架分段随面铺钉，
   * 一根直椽是压不出这条曲线的（真实做法亦然：每步架一段椽）。
   */
  const nc = o.chuanCount ?? 12;
  const tYan = 0.78; // 檐椽头所在（其外为飞椽出挑段）
  for (let i = 0; i < nc; i++) {
    const u = ((i + 0.5) / nc) * 2 - 1;
    // 檐椽：自承椽枋随面而下，至檐椽头
    const nSeg = Math.max(2, NR);
    for (let j = 0; j < nSeg; j++) {
      const a = (j / nSeg) * tYan;
      const b = ((j + 1) / nSeg) * tYan;
      beam(s, MAT.chuan, pt(u, a, -0.1), pt(u, b, -0.1), f(6), f(7));
    }
    // 飞椽：压在檐椽头之上，挑出至檐口
    beam(s, MAT.chuan, pt(u, tYan - 0.12, -0.035), pt(u, 1, -0.03), f(6), f(6.5));
  }

  /* --------------------- 转角：角梁 + 垂脊（+22.5° 侧）--------------------- */
  const thC = HALF;
  const rc0 = rWall / Math.cos(HALF);
  const cq1 = chuQiao;
  const rc1 = rLiao / Math.cos(HALF) + yanChu + feiChu + cq1;
  const yc1 = -yanChu * 0.42 + feiChu * 0.12 + qiQiao;
  const a0 = pol(thC, rc0 - 0.2, riseUp + 0.06);
  const a1 = pol(thC, rc1, yc1);
  beam(s, MAT.liang, a0, a1, f(12), f(18)); // 老角梁
  const b0 = pol(thC, rc0 - 0.2, riseUp + 0.06 + f(18));
  const b1 = pol(thC, rc1 + 0.3, yc1 + qiQiao * 0.5 + 0.1); // 仔角梁头翘起
  beam(s, MAT.liang, b0, b1, f(11), f(15));
  // 垂脊（角脊）：脊瓦一列
  const nseg = 7;
  for (let i = 0; i < nseg; i++) {
    const q0 = lerp3(b0, b1, i / nseg);
    const q1 = lerp3(b0, b1, (i + 1) / nseg);
    const mid = [(q0[0] + q1[0]) / 2, (q0[1] + q1[1]) / 2 + 0.07, (q0[2] + q1[2]) / 2];
    const len = dist3(q0, q1) * 1.06;
    const ry = Math.atan2(q1[0] - q0[0], q1[2] - q0[2]);
    const rx = -Math.atan2(q1[1] - q0[1], Math.hypot(q1[0] - q0[0], q1[2] - q0[2]));
    s.push(mid[0], mid[1], mid[2], ry, 1, rx);
    s.box(MAT.tileDark, 0.2, 0.11, len, 0, 0, 0, 0, 0.3);
    s.halfCyl(MAT.tileDark, 0.1, len, 0, 0.11, 0, 0, 0, 5, 0.3);
    s.pop();
  }
  // 套兽（角梁头）
  s.push(b1[0], b1[1], b1[2], thC);
  s.box(MAT.tileDark, f(14), f(14), f(20), 0, 0, 0, 0, 0.3);
  s.pop();
  return { eaveY: -yanChu * 0.42, topY: riseUp, nTile };
}

/* ========================================================================== */
/*                          顶层攒尖屋顶（八角锥一面）                          */
/* ========================================================================== */
export function hipFace(s, o = {}) {
  const rLiao = o.rLiao;
  const height = o.height ?? 7.6; // 自撩檐枋到刹座底
  const yanChu = o.yanChu ?? 0.95;
  const feiChu = o.feiChu ?? 0.6;
  const qiQiao = o.qiQiao ?? 0.6;
  const chuQiao = o.chuQiao ?? 0.42;
  const NT = o.segT ?? 14;
  const NR = o.segR ?? 6;
  const rTop = o.rTop ?? 1.2;

  const wLiao = 2 * rLiao * TAN_HALF;
  s.box(MAT.fang, wLiao + 0.02, ZUCAI, CAI_T * 1.2, 0, -ZUCAI, rLiao, 0, 0.6);

  /* ---------------- 参数化屋面：t = 0 顶（刹座）, t = 1 檐口 ---------------- */
  const lowerAt = (u) => {
    const au = Math.abs(u);
    const q = qiQiao * Math.pow(smooth(0.45, 1, au), 1.5);
    const cq = chuQiao * Math.pow(smooth(0.5, 1, au), 1.4);
    const x = u * rLiao * TAN_HALF;
    return {
      th: Math.atan2(x, rLiao),
      r: Math.hypot(x, rLiao) + yanChu + feiChu + cq,
      y: -yanChu * 0.42 + feiChu * 0.12 + q,
    };
  };
  const pt = (u, t, dy = 0) => {
    const b = lowerAt(u);
    const rT = rTop * (1 + Math.abs(u) * 0.05);
    return pol(
      b.th * t,
      rT + (b.r - rT) * t,
      height + (b.y - height) * Math.pow(t, 0.62) + dy
    );
  };

  /* --------------------------- 望板 + 板瓦面 --------------------------- */
  for (let j = 0; j < NR; j++) {
    const t0 = j / NR;
    const t1 = (j + 1) / NR;
    for (let i = 0; i < NT; i++) {
      const u0 = (i / NT) * 2 - 1;
      const u1 = ((i + 1) / NT) * 2 - 1;
      s.panel(MAT.ban, pt(u0, t0), pt(u1, t0), pt(u1, t1), pt(u0, t1), 0.7, true);
      s.panel(
        MAT.tileDark,
        pt(u0, t0, TILE_LIFT),
        pt(u0, t1, TILE_LIFT),
        pt(u1, t1, TILE_LIFT),
        pt(u1, t0, TILE_LIFT),
        0.45
      );
    }
  }

  /* --------------- 筒瓦：随半径收小逐段「抽垄」（折半）--------------- */
  const eaveLen = 2 * lowerAt(1).r * Math.sin(HALF);
  let n0 = Math.max(8, Math.round(eaveLen / TILE_SPACE));
  n0 = Math.pow(2, Math.round(Math.log2(n0))); // 取 2 的幂，便于逐段折半
  const lift = TILE_LIFT + TILE_R * 0.3;
  for (let j = NR - 1; j >= 0; j--) {
    const t1 = (j + 1) / NR; // 外（下）
    const t0 = j / NR; // 内（上）
    // 该段中部的弦长决定还能容纳多少垄
    const tm = (t0 + t1) / 2;
    const chord = 2 * Math.hypot(pt(1, tm)[0], pt(1, tm)[2]) * Math.sin(HALF);
    let n = n0;
    while (n > 4 && chord / n < TILE_SPACE * 0.72) n /= 2;
    for (let k = 0; k <= n; k++) {
      const u = (k / n) * 2 - 1;
      tileRun(s, pt(u, t0, lift), pt(u, t1, lift));
    }
    // 抽垄处加一道横向压边（盖住并垄的接缝）
    if (j < NR - 1) {
      const rr = Math.hypot(pt(0, t1)[0], pt(0, t1)[2]);
      const yy = pt(0, t1, TILE_LIFT)[1];
      s.cyl(MAT.tileDark, rr * 1.006, rr * 1.006, 0.05, 0, yy - 0.02, 0, OCT_N * 2, Math.PI / OCT_N, 0.4);
    }
  }
  // 檐口瓦当 + 滴水
  for (let k = 0; k <= n0; k++) {
    const u = (k / n0) * 2 - 1;
    const e = pt(u, 1, lift);
    s.push(e[0], e[1], e[2], Math.atan2(e[0], e[2]));
    s.cyl(MAT.tileDark, TILE_R * 1.3, TILE_R * 1.3, 0.05, 0, -TILE_R * 1.3, 0.03, 8, 0, 0.3);
    s.pop();
  }
  for (let i = 0; i < NT; i++) {
    const u0 = (i / NT) * 2 - 1;
    const u1 = ((i + 1) / NT) * 2 - 1;
    const a = pt(u0, 1, TILE_LIFT);
    const b = pt(u1, 1, TILE_LIFT);
    s.panel(MAT.tileDark, a, b, [b[0], b[1] - 0.14, b[2] + 0.03], [a[0], a[1] - 0.14, a[2] + 0.03], 0.4, true);
  }

  /* -------------------------------- 椽 -------------------------------- */
  const nc = o.chuanCount ?? 12;
  const tYan = 0.8;
  for (let i = 0; i < nc; i++) {
    const u = ((i + 0.5) / nc) * 2 - 1;
    const nSeg = Math.max(3, NR);
    for (let j = 0; j < nSeg; j++) {
      const a = 0.12 + (j / nSeg) * (tYan - 0.12);
      const b = 0.12 + ((j + 1) / nSeg) * (tYan - 0.12);
      beam(s, MAT.chuan, pt(u, a, -0.1), pt(u, b, -0.1), f(6), f(7));
    }
    beam(s, MAT.chuan, pt(u, tYan - 0.1, -0.035), pt(u, 1, -0.03), f(6), f(6.5));
  }

  /* ------------------------ 角梁 + 垂脊（+22.5°）------------------------ */
  const thC = HALF;
  const rc1 = rLiao / Math.cos(HALF) + yanChu + feiChu + chuQiao;
  const yc1 = -yanChu * 0.42 + feiChu * 0.12 + qiQiao;
  const top0 = pol(thC * 0.02, rTop * 0.92, height);
  const a1 = pol(thC, rc1, yc1);
  beam(s, MAT.liang, top0, a1, f(12), f(18)); // 老角梁
  const b0 = [top0[0], top0[1] + f(18), top0[2]];
  const b1 = pol(thC, rc1 + 0.28, yc1 + qiQiao * 0.5 + 0.1);
  beam(s, MAT.liang, b0, b1, f(11), f(15)); // 仔角梁
  const nseg = 9;
  for (let i = 0; i < nseg; i++) {
    const q0 = curveOnHip(b0, b1, i / nseg);
    const q1 = curveOnHip(b0, b1, (i + 1) / nseg);
    const mid = [(q0[0] + q1[0]) / 2, (q0[1] + q1[1]) / 2 + 0.075, (q0[2] + q1[2]) / 2];
    const len = dist3(q0, q1) * 1.06;
    const ry = Math.atan2(q1[0] - q0[0], q1[2] - q0[2]);
    const rx = -Math.atan2(q1[1] - q0[1], Math.hypot(q1[0] - q0[0], q1[2] - q0[2]));
    s.push(mid[0], mid[1], mid[2], ry, 1, rx);
    s.box(MAT.tileDark, 0.21, 0.11, len, 0, 0, 0, 0, 0.3);
    s.halfCyl(MAT.tileDark, 0.105, len, 0, 0.11, 0, 0, 0, 5, 0.3);
    s.pop();
  }
  s.push(b1[0], b1[1], b1[2], thC);
  s.box(MAT.tileDark, f(15), f(15), f(22), 0, 0, 0, 0, 0.3);
  s.pop();
  return { topY: height, nTile: n0 };
}

/** 垂脊沿屋面弧线（下凹）插值 */
function curveOnHip(a, b, t) {
  const p = lerp3(a, b, t);
  p[1] -= Math.sin(Math.PI * t) * (a[1] - b[1]) * 0.16;
  return p;
}

/* ========================================================================== */
/*                                  塔刹                                      */
/* ========================================================================== */
/** 砖砌刹座 + 铁制覆钵、九重相轮、圆光、仰月、宝盖、宝珠（原点在刹座底） */
export function finial(s, o = {}) {
  const r = o.r ?? 1.15;
  let y = 0;
  // 砖刹座（须弥座式，兼盖住攒尖顶的收头）
  s.cyl(MAT.stone, r * 1.66, r * 1.78, 0.5, 0, y, 0, OCT_N, Math.PI / OCT_N, 0.8);
  y += 0.5;
  s.cyl(MAT.stoneDark, r * 1.3, r * 1.4, 0.42, 0, y, 0, OCT_N, Math.PI / OCT_N, 0.8);
  y += 0.42;
  s.cyl(MAT.stone, r * 1.5, r * 1.34, 0.34, 0, y, 0, OCT_N, Math.PI / OCT_N, 0.8);
  y += 0.34;
  // 覆钵
  s.ball(MAT.iron, r * 0.95, 0, y + r * 0.34, 0, 16, 0.6);
  s.cyl(MAT.iron, r * 0.5, r * 0.62, 0.28, 0, y + r * 0.8, 0, 14, 0, 0.5);
  y += r * 1.05;
  // 相轮九重
  for (let i = 0; i < 9; i++) {
    const rr = r * (0.72 - i * 0.045);
    s.torus(MAT.iron, rr, 0.075, 0, y + 0.02, 0, Math.PI / 2, 0, 0, 18, 0.3);
    s.cyl(MAT.iron, 0.1, 0.1, 0.3, 0, y - 0.06, 0, 10, 0, 0.3);
    y += 0.3;
  }
  // 圆光（带火焰）
  s.torus(MAT.iron, r * 0.66, 0.055, 0, y + r * 0.35, 0, 0, 0, 0, 22, 0.3);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    s.boxR(MAT.iron, 0.055, 0.3, 0.055, Math.cos(a) * r * 0.66, y + r * 0.35, Math.sin(a) * r * 0.66, 0, -a, 0, 0.3);
  }
  y += r * 0.62;
  // 仰月
  s.torus(MAT.iron, r * 0.34, 0.07, 0, y, 0, Math.PI / 2, Math.PI / 2, 0, 16, 0.3);
  s.cyl(MAT.iron, 0.09, 0.09, 0.5, 0, y, 0, 10, 0, 0.3);
  y += 0.5;
  // 宝盖
  s.cone(MAT.iron, r * 0.46, 0.26, 0, y, 0, 14, 0, 0.4);
  y += 0.26;
  // 宝珠
  s.ball(MAT.gold, r * 0.3, 0, y + r * 0.26, 0, 14, 0.4);
  s.cone(MAT.gold, r * 0.12, 0.34, 0, y + r * 0.5, 0, 10, 0, 0.3);
  y += r * 0.5 + 0.34;
  return { top: y };
}

/** 塔刹八条铁链（拉向垂脊端头） */
export function finialChains(s, o = {}) {
  const yTop = o.yTop;
  const yEnd = o.yEnd;
  const rEnd = o.rEnd;
  const seg = 7;
  for (let i = 0; i < OCT_N; i++) {
    const th = Math.PI / OCT_N + (i * Math.PI * 2) / OCT_N;
    const ex = Math.sin(th) * rEnd;
    const ez = Math.cos(th) * rEnd;
    for (let k = 0; k < seg; k++) {
      const t0 = k / seg;
      const t1 = (k + 1) / seg;
      const p0 = [ex * t0, yTop + (yEnd - yTop) * t0 - Math.sin(Math.PI * t0) * 0.5, ez * t0];
      const p1 = [ex * t1, yTop + (yEnd - yTop) * t1 - Math.sin(Math.PI * t1) * 0.5, ez * t1];
      const len = dist3(p0, p1);
      const ry = Math.atan2(p1[0] - p0[0], p1[2] - p0[2]);
      const rx = -Math.atan2(p1[1] - p0[1], Math.hypot(p1[0] - p0[0], p1[2] - p0[2]));
      s.push((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, (p0[2] + p1[2]) / 2, ry, 1, rx);
      s.box(MAT.iron, 0.035, 0.035, len, 0, 0, 0, 0, 0.2);
      s.pop();
    }
  }
}
