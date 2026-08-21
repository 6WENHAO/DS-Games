/* ============================================================================
 * mesh.js —— 程序化几何构建库（零依赖）
 *   变换栈 + 真曲面图元：旋成体(lathe)、沿路径管(tube)、螺旋管(helix)、
 *   圆角盒(roundedBox)、球/锥/柱/环、轮廓挤出(extrudeProfile)、多边形挤出
 *   顶点属性：位置 / 法线 / 颜色 / 材质(粗糙度, 金属度, 自发光)
 *   支持"部件(part)"与"分组(group)"登记，便于剖切显示、标签与统计
 * ==========================================================================*/
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.MESH = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /* ------------------------------ 矩阵 ------------------------------ */
  const M = {
    ident: () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
    mul(a, b) {                              // a*b（列主序）
      const o = new Array(16);
      for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
        let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
        o[c * 4 + r] = s;
      } return o;
    },
    trans: (x, y, z) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1],
    scale: (x, y, z) => [x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1],
    rotX(a) { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]; },
    rotY(a) { const c = Math.cos(a), s = Math.sin(a); return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]; },
    rotZ(a) { const c = Math.cos(a), s = Math.sin(a); return [c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; },
    apply(m, p) {
      return [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
        m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
        m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]];
    },
    // 法线矩阵（逆转置的 3x3），支持非均匀缩放
    normalMat(m) {
      const a = m[0], b = m[1], c = m[2], d = m[4], e = m[5], f = m[6], g = m[8], h = m[9], i = m[10];
      const A = e * i - f * h, B = f * g - d * i, C = d * h - e * g;
      let det = a * A + b * B + c * C;
      if (Math.abs(det) < 1e-12) det = 1e-12;
      const id = 1 / det;
      return [A * id, B * id, C * id,
        (c * h - b * i) * id, (a * i - c * g) * id, (b * g - a * h) * id,
        (b * f - c * e) * id, (c * d - a * f) * id, (a * e - b * d) * id];
    },
    applyN(n, v) {
      const x = n[0] * v[0] + n[3] * v[1] + n[6] * v[2];
      const y = n[1] * v[0] + n[4] * v[1] + n[7] * v[2];
      const z = n[2] * v[0] + n[5] * v[1] + n[8] * v[2];
      const l = Math.hypot(x, y, z) || 1;
      return [x / l, y / l, z / l];
    }
  };
  const V = {
    sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
    add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
    mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
    cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
    dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
    norm(a) { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
    len: a => Math.hypot(a[0], a[1], a[2])
  };
  const TAU = Math.PI * 2;

  /* ------------------------------ 构建器 ------------------------------ */
  function createBuilder() {
    const pos = [], nrm = [], col = [], mat = [];    // mat = [rough, metal, emissive]
    let stack = [M.ident()], cur = M.ident();
    let curCol = [0.8, 0.8, 0.8], curMat = [0.6, 0.0, 0.0];
    const triG = [];                                 // 每个三角形所属分组（写入时记录）
    const triP = [];                                 // 每个三角形所属部件名
    const parts = [];                                // {name, group, start, count, bbox, kind}
    let curGroup = 'default', partOpen = null;
    let curvedTris = 0, flatTris = 0;                // 曲面/平面三角形统计（用于"避免方块堆砌"的自检）
    let curvedFlag = false;

    const api = {
      /* --- 状态 --- */
      push() { stack.push(cur.slice()); return api; },
      pop() { cur = stack.pop() || M.ident(); return api; },
      translate(x, y, z) { cur = M.mul(cur, M.trans(x, y, z)); return api; },
      rotateX(a) { cur = M.mul(cur, M.rotX(a)); return api; },
      rotateY(a) { cur = M.mul(cur, M.rotY(a)); return api; },
      rotateZ(a) { cur = M.mul(cur, M.rotZ(a)); return api; },
      scale(x, y, z) { cur = M.mul(cur, M.scale(x, y === undefined ? x : y, z === undefined ? x : z)); return api; },
      color(c) { curCol = c.slice(); return api; },
      material(rough, metal, emis) { curMat = [rough, metal || 0, emis || 0]; return api; },
      group(g) { curGroup = g; return api; },
      /* --- 部件登记 --- */
      part(name, kind) {
        if (partOpen) api.endPart();
        partOpen = { name, kind: kind || 'misc', group: curGroup, start: pos.length / 3, bbox: [1e9, 1e9, 1e9, -1e9, -1e9, -1e9] };
        return api;
      },
      endPart() {
        if (!partOpen) return api;
        partOpen.count = pos.length / 3 - partOpen.start;
        if (partOpen.count > 0) parts.push(partOpen);
        partOpen = null;
        return api;
      },
      /* --- 底层写入 --- */
      vert(p, n) {
        const P = M.apply(cur, p), N = M.applyN(M.normalMat(cur), n);
        pos.push(P[0], P[1], P[2]); nrm.push(N[0], N[1], N[2]);
        col.push(curCol[0], curCol[1], curCol[2]);
        mat.push(curMat[0], curMat[1], curMat[2]);
        if (partOpen) {
          const b = partOpen.bbox;
          b[0] = Math.min(b[0], P[0]); b[1] = Math.min(b[1], P[1]); b[2] = Math.min(b[2], P[2]);
          b[3] = Math.max(b[3], P[0]); b[4] = Math.max(b[4], P[1]); b[5] = Math.max(b[5], P[2]);
        }
        return api;
      },
      tri(a, b, c, na, nb, nc) {
        api.vert(a, na); api.vert(b, nb || na); api.vert(c, nc || na);
        if (curvedFlag) curvedTris++; else flatTris++;
        triG.push(curGroup);
        triP.push(partOpen ? partOpen.name : null);
        return api;
      },
      quad(a, b, c, d, na, nb, nc, nd) {
        api.tri(a, b, c, na, nb, nc);
        api.tri(a, c, d, na, nc, nd);
        return api;
      },

      /* ==================== 图元 ==================== */
      // 平面（细分，便于顶点扰动）
      plane(w, d, sx, sy, up) {
        curvedFlag = false;
        sx = sx || 1; sy = sy || 1;
        const n = up || [0, 1, 0];
        for (let i = 0; i < sx; i++) for (let j = 0; j < sy; j++) {
          const x0 = -w / 2 + w * i / sx, x1 = -w / 2 + w * (i + 1) / sx;
          const z0 = -d / 2 + d * j / sy, z1 = -d / 2 + d * (j + 1) / sy;
          api.quad([x0, 0, z0], [x0, 0, z1], [x1, 0, z1], [x1, 0, z0], n, n, n, n);
        }
        return api;
      },
      box(w, h, d) {
        curvedFlag = false;
        const x = w / 2, y = h / 2, z = d / 2;
        const P = [[-x, -y, -z], [x, -y, -z], [x, y, -z], [-x, y, -z], [-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z]];
        const F = [[4, 5, 6, 7, [0, 0, 1]], [1, 0, 3, 2, [0, 0, -1]], [5, 1, 2, 6, [1, 0, 0]],
          [0, 4, 7, 3, [-1, 0, 0]], [3, 7, 6, 2, [0, 1, 0]], [4, 0, 1, 5, [0, -1, 0]]];
        F.forEach(f => api.quad(P[f[0]], P[f[1]], P[f[2]], P[f[3]], f[4], f[4], f[4], f[4]));
        return api;
      },
      // 圆角盒：用球面拐角 + 圆柱棱 + 平面，是"不像方块"的主力
      roundedBox(w, h, d, r, seg) {
        seg = Math.max(2, seg || 4);
        r = Math.min(r, Math.min(w, h, d) / 2 - 1e-4);
        const hx = w / 2 - r, hy = h / 2 - r, hz = d / 2 - r;
        curvedFlag = true;
        // 8 个球角
        for (let sx = -1; sx <= 1; sx += 2) for (let sy = -1; sy <= 1; sy += 2) for (let sz = -1; sz <= 1; sz += 2) {
          for (let i = 0; i < seg; i++) for (let j = 0; j < seg; j++) {
            const a0 = (i / seg) * Math.PI / 2, a1 = ((i + 1) / seg) * Math.PI / 2;
            const b0 = (j / seg) * Math.PI / 2, b1 = ((j + 1) / seg) * Math.PI / 2;
            const P = (a, b) => {
              const n = [Math.cos(a) * Math.cos(b) * sx, Math.sin(b) * sy, Math.cos(a) * Math.sin(b) * sz];
              void n;
              const nn = V.norm([Math.cos(b) * Math.cos(a) * sx, Math.sin(b) * sy, Math.cos(b) * Math.sin(a) * sz]);
              return { p: [hx * sx + nn[0] * r, hy * sy + nn[1] * r, hz * sz + nn[2] * r], n: nn };
            };
            const A = P(a0, b0), B = P(a1, b0), C = P(a1, b1), D = P(a0, b1);
            if (sx * sy * sz > 0) api.quad(A.p, B.p, C.p, D.p, A.n, B.n, C.n, D.n);
            else api.quad(A.p, D.p, C.p, B.p, A.n, D.n, C.n, B.n);
          }
        }
        // 12 条圆柱棱
        const edge = (axis, sa, sb) => {
          for (let i = 0; i < seg; i++) {
            const a0 = (i / seg) * Math.PI / 2, a1 = ((i + 1) / seg) * Math.PI / 2;
            const mk = (a, t) => {
              const cx = Math.cos(a) * r, cy = Math.sin(a) * r;
              if (axis === 0) return { p: [t, hy * sa + cx * sa, hz * sb + cy * sb], n: V.norm([0, cx * sa, cy * sb]) };
              if (axis === 1) return { p: [hx * sa + cx * sa, t, hz * sb + cy * sb], n: V.norm([cx * sa, 0, cy * sb]) };
              return { p: [hx * sa + cx * sa, hy * sb + cy * sb, t], n: V.norm([cx * sa, cy * sb, 0]) };
            };
            const L = axis === 0 ? hx : axis === 1 ? hy : hz;
            const A = mk(a0, -L), B = mk(a0, L), C = mk(a1, L), D = mk(a1, -L);
            if (sa * sb > 0) api.quad(A.p, B.p, C.p, D.p, A.n, B.n, C.n, D.n);
            else api.quad(A.p, D.p, C.p, B.p, A.n, D.n, C.n, B.n);
          }
        };
        for (let sa = -1; sa <= 1; sa += 2) for (let sb = -1; sb <= 1; sb += 2) { edge(0, sa, sb); edge(1, sa, sb); edge(2, sa, sb); }
        // 6 个平面
        const face = (n, u, v, off) => {
          const A = V.add(V.mul(n, off), V.add(V.mul(u, -1), V.mul(v, -1)));
          const B = V.add(V.mul(n, off), V.add(V.mul(u, 1), V.mul(v, -1)));
          const C = V.add(V.mul(n, off), V.add(V.mul(u, 1), V.mul(v, 1)));
          const D = V.add(V.mul(n, off), V.add(V.mul(u, -1), V.mul(v, 1)));
          api.quad(A, B, C, D, n, n, n, n);
        };
        curvedFlag = false;
        face([1, 0, 0], [0, hy, 0], [0, 0, hz], w / 2); face([-1, 0, 0], [0, 0, hz], [0, hy, 0], w / 2);
        face([0, 1, 0], [0, 0, hz], [hx, 0, 0], h / 2); face([0, -1, 0], [hx, 0, 0], [0, 0, hz], h / 2);
        face([0, 0, 1], [hx, 0, 0], [0, hy, 0], d / 2); face([0, 0, -1], [0, hy, 0], [hx, 0, 0], d / 2);
        return api;
      },
      // 圆柱/圆锥/圆台（沿 Y 轴），可选端盖
      cylinder(r0, r1, h, seg, opts) {
        opts = opts || {}; seg = Math.max(3, seg || 20);
        curvedFlag = true;
        const y0 = opts.center === false ? 0 : -h / 2, y1 = y0 + h;
        const slope = (r0 - r1) / h;
        for (let i = 0; i < seg; i++) {
          const a0 = (i / seg) * TAU, a1 = ((i + 1) / seg) * TAU;
          const P = (a, r, y) => [Math.cos(a) * r, y, Math.sin(a) * r];
          const N = a => V.norm([Math.cos(a), slope, Math.sin(a)]);
          api.quad(P(a0, r0, y0), P(a1, r0, y0), P(a1, r1, y1), P(a0, r1, y1), N(a0), N(a1), N(a1), N(a0));
        }
        if (opts.caps !== false) {
          for (let i = 0; i < seg; i++) {
            const a0 = (i / seg) * TAU, a1 = ((i + 1) / seg) * TAU;
            if (r0 > 1e-6) api.tri([0, y0, 0], [Math.cos(a1) * r0, y0, Math.sin(a1) * r0], [Math.cos(a0) * r0, y0, Math.sin(a0) * r0], [0, -1, 0]);
            if (r1 > 1e-6) api.tri([0, y1, 0], [Math.cos(a0) * r1, y1, Math.sin(a0) * r1], [Math.cos(a1) * r1, y1, Math.sin(a1) * r1], [0, 1, 0]);
          }
        }
        return api;
      },
      sphere(r, seg, rings, opts) {
        opts = opts || {}; seg = Math.max(4, seg || 24); rings = Math.max(2, rings || 16);
        const t0 = opts.t0 === undefined ? 0 : opts.t0, t1 = opts.t1 === undefined ? Math.PI : opts.t1;
        curvedFlag = true;
        for (let i = 0; i < rings; i++) for (let j = 0; j < seg; j++) {
          const p0 = t0 + (t1 - t0) * i / rings, p1 = t0 + (t1 - t0) * (i + 1) / rings;
          const a0 = (j / seg) * TAU, a1 = ((j + 1) / seg) * TAU;
          const S = (p, a) => V.norm([Math.sin(p) * Math.cos(a), Math.cos(p), Math.sin(p) * Math.sin(a)]);
          const A = S(p0, a0), B = S(p0, a1), C = S(p1, a1), D = S(p1, a0);
          api.quad(V.mul(A, r), V.mul(B, r), V.mul(C, r), V.mul(D, r), A, B, C, D);
        }
        return api;
      },
      torus(R, r, segU, segV, arc) {
        segU = segU || 32; segV = segV || 12; arc = arc === undefined ? TAU : arc;
        curvedFlag = true;
        for (let i = 0; i < segU; i++) for (let j = 0; j < segV; j++) {
          const u0 = arc * i / segU, u1 = arc * (i + 1) / segU;
          const v0 = TAU * j / segV, v1 = TAU * (j + 1) / segV;
          const P = (u, v) => {
            const cu = Math.cos(u), su = Math.sin(u), cv = Math.cos(v), sv = Math.sin(v);
            return { p: [(R + r * cv) * cu, r * sv, (R + r * cv) * su], n: [cv * cu, sv, cv * su] };
          };
          const A = P(u0, v0), B = P(u1, v0), C = P(u1, v1), D = P(u0, v1);
          api.quad(A.p, B.p, C.p, D.p, A.n, B.n, C.n, D.n);
        }
        return api;
      },
      capsule(r, h, seg) {
        seg = seg || 20;
        api.cylinder(r, r, h, seg, { caps: false });
        api.push(); api.translate(0, h / 2, 0); api.sphere(r, seg, 8, { t0: 0, t1: Math.PI / 2 }); api.pop();
        api.push(); api.translate(0, -h / 2, 0); api.sphere(r, seg, 8, { t0: Math.PI / 2, t1: Math.PI }); api.pop();
        return api;
      },
      // 旋成体：profile = [[r,y],...]（绕 Y 轴），可选平滑法线
      lathe(profile, seg, opts) {
        opts = opts || {}; seg = Math.max(4, seg || 24);
        curvedFlag = true;
        const arc = opts.arc === undefined ? TAU : opts.arc;
        for (let k = 0; k < profile.length - 1; k++) {
          const [r0, y0] = profile[k], [r1, y1] = profile[k + 1];
          const dr = r1 - r0, dy = y1 - y0;
          const nl = Math.hypot(dr, dy);
          if (nl < 1e-9) continue;                        // 退化段：跳过，避免零长法线
          const nr = dy / nl, ny = -dr / nl;                 // 轮廓法线（向外）
          for (let i = 0; i < seg; i++) {
            const a0 = arc * i / seg, a1 = arc * (i + 1) / seg;
            const P = (a, r, y) => [Math.cos(a) * r, y, Math.sin(a) * r];
            const N = a => V.norm([Math.cos(a) * nr, ny, Math.sin(a) * nr]);
            if (r0 < 1e-6 && r1 < 1e-6) continue;
            api.quad(P(a0, r0, y0), P(a1, r0, y0), P(a1, r1, y1), P(a0, r1, y1), N(a0), N(a1), N(a1), N(a0));
          }
        }
        return api;
      },
      // 沿路径挤出圆截面（平行传输坐标架，避免扭曲）
      tube(path, radius, seg, opts) {
        opts = opts || {}; seg = Math.max(3, seg || 10);
        if (path.length < 2) return api;
        curvedFlag = true;
        const radFn = typeof radius === 'function' ? radius : () => radius;
        let up = opts.up || [0, 1, 0];
        const frames = [];
        for (let i = 0; i < path.length; i++) {
          const t = V.norm(i === 0 ? V.sub(path[1], path[0])
            : i === path.length - 1 ? V.sub(path[i], path[i - 1]) : V.sub(path[i + 1], path[i - 1]));
          let n = V.cross(up, t);
          if (V.len(n) < 1e-5) { up = Math.abs(t[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0]; n = V.cross(up, t); }
          n = V.norm(n);
          const b = V.norm(V.cross(t, n));
          up = b;
          frames.push({ p: path[i], n, b });
        }
        for (let i = 0; i < frames.length - 1; i++) {
          const f0 = frames[i], f1 = frames[i + 1];
          const r0 = radFn(i / (frames.length - 1)), r1 = radFn((i + 1) / (frames.length - 1));
          for (let j = 0; j < seg; j++) {
            const a0 = TAU * j / seg, a1 = TAU * (j + 1) / seg;
            const ring = (f, a, r) => {
              const d = V.add(V.mul(f.n, Math.cos(a)), V.mul(f.b, Math.sin(a)));
              return { p: V.add(f.p, V.mul(d, r)), n: d };
            };
            const A = ring(f0, a0, r0), B = ring(f1, a0, r1), C = ring(f1, a1, r1), D = ring(f0, a1, r0);
            api.quad(A.p, B.p, C.p, D.p, A.n, B.n, C.n, D.n);
          }
        }
        if (opts.caps) {
          [0, frames.length - 1].forEach((idx, k) => {
            const f = frames[idx], r = radFn(k), sgn = k === 0 ? -1 : 1;
            const t = V.norm(V.cross(f.n, f.b));
            for (let j = 0; j < seg; j++) {
              const a0 = TAU * j / seg, a1 = TAU * (j + 1) / seg;
              const q = a => V.add(f.p, V.add(V.mul(f.n, Math.cos(a) * r), V.mul(f.b, Math.sin(a) * r)));
              if (sgn > 0) api.tri(f.p, q(a0), q(a1), V.mul(t, sgn));
              else api.tri(f.p, q(a1), q(a0), V.mul(t, sgn));
            }
          });
        }
        return api;
      },
      helixTube(R, r, turns, height, segU, segV) {
        const path = [];
        const n = Math.max(8, Math.round(segU || 24) * turns);
        for (let i = 0; i <= n; i++) {
          const t = i / n, a = t * TAU * turns;
          path.push([Math.cos(a) * R, -height / 2 + height * t, Math.sin(a) * R]);
        }
        return api.tube(path, r, segV || 8);
      },
      // 沿 X 轴挤出 2D 轮廓（轮廓点为 [z,y]），可分段着色/分组
      extrudeProfile(profile, x0, x1, opts) {
        opts = opts || {};
        const steps = opts.steps || 1;
        const scaleFn = opts.scaleFn || (() => [1, 1]);
        const groupFn = opts.groupFn || null;
        const closed = opts.closed !== false;
        const n = profile.length;
        curvedFlag = true;
        const ptAt = (k, t) => {
          const s = scaleFn(t);
          const x = x0 + (x1 - x0) * t;
          return [x, profile[k][1] * s[1] + (opts.yOff ? opts.yOff(t) : 0), profile[k][0] * s[0]];
        };
        const segCount = closed ? n : n - 1;
        for (let k = 0; k < segCount; k++) {
          const k1 = (k + 1) % n;
          const gname = groupFn ? groupFn(profile[k], profile[k1], k) : null;
          const prevG = curGroup;
          if (gname) curGroup = gname;
          for (let i = 0; i < steps; i++) {
            const t0 = i / steps, t1 = (i + 1) / steps;
            const A = ptAt(k, t0), B = ptAt(k1, t0), C = ptAt(k1, t1), D = ptAt(k, t1);
            // 外法线：轮廓切向 x 挤出方向
            const dz = profile[k1][0] - profile[k][0], dy = profile[k1][1] - profile[k][1];
            const nl = Math.hypot(dz, dy);
            if (nl < 1e-9) continue;                      // 退化段：跳过
            const nn = [0, dz / nl, -dy / nl];
            const flip = opts.flip ? -1 : 1;
            const N = [nn[0] * flip, nn[1] * flip, nn[2] * flip];
            if (flip > 0) api.quad(A, B, C, D, N, N, N, N);
            else api.quad(A, D, C, B, N, N, N, N);
          }
          if (gname) curGroup = prevG;
        }
        // 端盖（三角扇，轮廓需为凸或近凸）
        if (opts.capStart || opts.capEnd) {
          const cap = (t, dir) => {
            const c = [x0 + (x1 - x0) * t, 0, 0];
            let cy = 0, cz = 0;
            profile.forEach(p => { cy += p[1]; cz += p[0]; });
            const s = scaleFn(t);
            c[1] = (cy / n) * s[1] + (opts.yOff ? opts.yOff(t) : 0); c[2] = (cz / n) * s[0];
            for (let k = 0; k < n; k++) {
              const k1 = (k + 1) % n;
              const A = ptAt(k, t), B = ptAt(k1, t);
              if (dir > 0) api.tri(c, B, A, [dir, 0, 0]); else api.tri(c, A, B, [dir, 0, 0]);
            }
          };
          if (opts.capStart) cap(0, -1);
          if (opts.capEnd) cap(1, 1);
        }
        return api;
      },
      // 多边形沿 Y 挤出（带上下盖）
      extrudePoly(poly, h, opts) {
        opts = opts || {};
        curvedFlag = false;
        const n = poly.length;
        for (let i = 0; i < n; i++) {
          const a = poly[i], b = poly[(i + 1) % n];
          const nn = V.norm([b[1] - a[1], 0, -(b[0] - a[0])]);
          api.quad([a[0], 0, a[1]], [b[0], 0, b[1]], [b[0], h, b[1]], [a[0], h, a[1]], nn, nn, nn, nn);
        }
        if (opts.caps !== false) {
          let cx = 0, cz = 0; poly.forEach(p => { cx += p[0]; cz += p[1]; });
          cx /= n; cz /= n;
          for (let i = 0; i < n; i++) {
            const a = poly[i], b = poly[(i + 1) % n];
            api.tri([cx, h, cz], [a[0], h, a[1]], [b[0], h, b[1]], [0, 1, 0]);
            api.tri([cx, 0, cz], [b[0], 0, b[1]], [a[0], 0, a[1]], [0, -1, 0]);
          }
        }
        return api;
      },

      /* --- 顶点扰动（做旧/凹陷）：对最近写入的 count 个顶点施加噪声位移 --- */
      distortLast(count, amp, freq, seed) {
        const start = pos.length / 3 - count;
        const h = (x, y, z) => {
          const s = Math.sin(x * freq + seed) * Math.cos(y * freq * 1.3 + seed * 1.7) * Math.sin(z * freq * 0.8 + seed * 2.3);
          return s;
        };
        for (let i = start; i < pos.length / 3; i++) {
          const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
          const d = h(x, y, z) * amp;
          pos[i * 3] += nrm[i * 3] * d; pos[i * 3 + 1] += nrm[i * 3 + 1] * d; pos[i * 3 + 2] += nrm[i * 3 + 2] * d;
        }
        return api;
      },
      vertexCount: () => pos.length / 3,
      /* --- 导出 --- */
      build() {
        api.endPart();
        // 按分组把三角形重排为连续区间，便于剖切时按组绘制
        const triCount = pos.length / 9;
        const triGroup = triG.slice();
        for (let t = 0; t < triCount; t++) if (!triGroup[t]) triGroup[t] = 'default';
        const order = [];
        const groupRanges = {};
        const names = [...new Set(triGroup)];
        names.forEach(g => {
          const start = order.length;
          for (let t = 0; t < triCount; t++) if (triGroup[t] === g) order.push(t);
          groupRanges[g] = { start: start * 3, count: (order.length - start) * 3 };
        });
        const P = new Float32Array(triCount * 9), N = new Float32Array(triCount * 9),
          C = new Float32Array(triCount * 9), Mt = new Float32Array(triCount * 9);
        const outParts = parts.map(p => p.name);
        const nameToIdx = new Map(outParts.map((n, i) => [n, i]));
        const triPart = new Int32Array(triCount).fill(-1);
        order.forEach((t, i) => {
          const nm = triP[t];
          triPart[i] = nm !== null && nameToIdx.has(nm) ? nameToIdx.get(nm) : -1;
        });
        order.forEach((t, i) => {
          for (let k = 0; k < 9; k++) {
            P[i * 9 + k] = pos[t * 9 + k]; N[i * 9 + k] = nrm[t * 9 + k];
            C[i * 9 + k] = col[t * 9 + k]; Mt[i * 9 + k] = mat[t * 9 + k];
          }
        });
        return {
          pos: P, nrm: N, col: C, mat: Mt, triCount, groupRanges, triPart,
          parts: parts.map(p => ({ name: p.name, kind: p.kind, group: p.group, tris: p.count / 3, bbox: p.bbox })),
          stats: { curvedTris, flatTris, curvedRatio: curvedTris / Math.max(1, curvedTris + flatTris) }
        };
      }
    };
    return api;
  }

  /* ------------------------------ 曲线工具 ------------------------------ */
  // Catmull-Rom 采样，用于管路/条纹路径
  function spline(points, samples, closed) {
    const out = [];
    const n = points.length;
    const get = i => points[closed ? (i + n) % n : Math.max(0, Math.min(n - 1, i))];
    const segs = closed ? n : n - 1;
    for (let s = 0; s < segs; s++) {
      const p0 = get(s - 1), p1 = get(s), p2 = get(s + 1), p3 = get(s + 2);
      for (let i = 0; i < samples; i++) {
        const t = i / samples, t2 = t * t, t3 = t2 * t;
        out.push([0, 1, 2].map(k =>
          0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 +
            (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3)));
      }
    }
    out.push(get(closed ? 0 : n - 1).slice());
    return out;
  }
  // 生成圆角矩形轮廓（返回 [z,y] 序列，逆时针）
  function roundRectProfile(w, h, r, seg, cy) {
    const pts = [];
    const hz = w / 2 - r, hy = h / 2 - r, y0 = cy || 0;
    const corner = (cz, cyy, a0) => {
      for (let i = 0; i <= seg; i++) {
        const a = a0 + (i / seg) * Math.PI / 2;
        pts.push([cz + Math.cos(a) * r, y0 + cyy + Math.sin(a) * r]);
      }
    };
    corner(hz, -hy, -Math.PI / 2);
    corner(hz, hy, 0);
    corner(-hz, hy, Math.PI / 2);
    corner(-hz, -hy, Math.PI);
    return pts;
  }

  return { createBuilder, spline, roundRectProfile, M, V, TAU };
});
