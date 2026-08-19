/**
 * linalg.js — 轻量线性代数库
 * 为 LQR 最优控制器提供：矩阵运算、矩阵求逆、连续/离散化、离散 Riccati 方程(DARE)求解。
 * 纯 JS，无任何外部依赖，可在浏览器与 Node 中运行。
 */

export function mat(r, c, fill) {
  const m = { r, c, d: new Float64Array(r * c) };
  if (fill) m.d.set(fill);
  return m;
}
export function eye(n, s = 1) {
  const m = mat(n, n);
  for (let i = 0; i < n; i++) m.d[i * n + i] = s;
  return m;
}
export function diag(v) {
  const n = v.length, m = mat(n, n);
  for (let i = 0; i < n; i++) m.d[i * n + i] = v[i];
  return m;
}
export const mg = (M, i, j) => M.d[i * M.c + j];
export const ms_ = (M, i, j, v) => { M.d[i * M.c + j] = v; };
export function clone(M) { const o = mat(M.r, M.c); o.d.set(M.d); return o; }

export function mmul(A, B) {
  if (A.c !== B.r) throw new Error(`mmul dim ${A.r}x${A.c} * ${B.r}x${B.c}`);
  const O = mat(A.r, B.c);
  const { r: n, c: k } = A, p = B.c;
  for (let i = 0; i < n; i++) {
    const ai = i * k, oi = i * p;
    for (let t = 0; t < k; t++) {
      const a = A.d[ai + t];
      if (a === 0) continue;
      const bt = t * p;
      for (let j = 0; j < p; j++) O.d[oi + j] += a * B.d[bt + j];
    }
  }
  return O;
}
export function mT(A) {
  const O = mat(A.c, A.r);
  for (let i = 0; i < A.r; i++) for (let j = 0; j < A.c; j++) O.d[j * A.r + i] = A.d[i * A.c + j];
  return O;
}
/** A + s*B */
export function madd(A, B, s = 1) {
  const O = clone(A);
  for (let i = 0; i < O.d.length; i++) O.d[i] += s * B.d[i];
  return O;
}
export function mscale(A, s) {
  const O = clone(A);
  for (let i = 0; i < O.d.length; i++) O.d[i] *= s;
  return O;
}
export function maxAbsDiff(A, B) {
  let e = 0;
  for (let i = 0; i < A.d.length; i++) e = Math.max(e, Math.abs(A.d[i] - B.d[i]));
  return e;
}

/** 高斯-约当法求逆（带部分选主元） */
export function minv(A) {
  const n = A.r;
  if (n !== A.c) throw new Error('minv: not square');
  const M = new Float64Array(n * 2 * n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) M[i * 2 * n + j] = A.d[i * n + j];
    M[i * 2 * n + n + i] = 1;
  }
  const W = 2 * n;
  for (let col = 0; col < n; col++) {
    let piv = col, best = Math.abs(M[col * W + col]);
    for (let r2 = col + 1; r2 < n; r2++) {
      const v = Math.abs(M[r2 * W + col]);
      if (v > best) { best = v; piv = r2; }
    }
    if (best < 1e-14) throw new Error('minv: singular matrix');
    if (piv !== col) for (let j = 0; j < W; j++) { const t = M[col * W + j]; M[col * W + j] = M[piv * W + j]; M[piv * W + j] = t; }
    const dv = M[col * W + col];
    for (let j = 0; j < W; j++) M[col * W + j] /= dv;
    for (let r2 = 0; r2 < n; r2++) {
      if (r2 === col) continue;
      const f = M[r2 * W + col];
      if (f === 0) continue;
      for (let j = 0; j < W; j++) M[r2 * W + j] -= f * M[col * W + j];
    }
  }
  const O = mat(n, n);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) O.d[i * n + j] = M[i * W + n + j];
  return O;
}

/** 解 A x = b （小规模，就地高斯消元，带部分选主元）。A: n*n 展平数组, b: 长度 n */
export function solveDense(Aflat, b, n) {
  const A = Float64Array.from(Aflat), x = Float64Array.from(b);
  for (let col = 0; col < n; col++) {
    let piv = col, best = Math.abs(A[col * n + col]);
    for (let r = col + 1; r < n; r++) {
      const v = Math.abs(A[r * n + col]);
      if (v > best) { best = v; piv = r; }
    }
    if (best < 1e-13) { A[col * n + col] += 1e-9; }   // 正则化，避免奇异构型崩溃
    if (piv !== col) {
      for (let j = 0; j < n; j++) { const t = A[col * n + j]; A[col * n + j] = A[piv * n + j]; A[piv * n + j] = t; }
      const t = x[col]; x[col] = x[piv]; x[piv] = t;
    }
    const dv = A[col * n + col];
    for (let r = col + 1; r < n; r++) {
      const f = A[r * n + col] / dv;
      if (f === 0) continue;
      for (let j = col; j < n; j++) A[r * n + j] -= f * A[col * n + j];
      x[r] -= f * x[col];
    }
  }
  for (let i = n - 1; i >= 0; i--) {
    let s = x[i];
    for (let j = i + 1; j < n; j++) s -= A[i * n + j] * x[j];
    x[i] = s / A[i * n + i];
  }
  return x;
}

/**
 * 连续系统 (A,B) 零阶保持离散化（矩阵指数级数展开）
 * Ad = Σ (A·dt)^k / k!      Bd = Σ A^k·dt^(k+1)/(k+1)! · B
 */
export function c2d(A, B, dt, terms = 14) {
  const n = A.r;
  let Ad = eye(n), Bd = mat(n, B.c);
  let T = eye(n);                       // (A dt)^k / k!
  const Adt = mscale(A, dt);
  for (let k = 0; k < terms; k++) {
    Bd = madd(Bd, mmul(T, B), dt / (k + 1));
    T = mscale(mmul(T, Adt), 1 / (k + 1));
    Ad = madd(Ad, T);
  }
  return { Ad, Bd };
}

/**
 * 离散代数 Riccati 方程定点迭代：
 *   P = Q + Aᵀ P A − Aᵀ P B (R + Bᵀ P B)⁻¹ Bᵀ P A
 * 返回最优反馈增益 K（u = −K x）及收敛信息。
 */
export function dare(A, B, Q, R, { iters = 4000, tol = 1e-11 } = {}) {
  const At = mT(A), Bt = mT(B);
  let P = clone(Q), K = null, it = 0, err = Infinity;
  for (; it < iters; it++) {
    const BtP = mmul(Bt, P);
    const S = madd(R, mmul(BtP, B));
    const Si = minv(S);
    K = mmul(Si, mmul(BtP, A));
    const AtP = mmul(At, P);
    let Pn = madd(madd(Q, mmul(AtP, A)), mmul(mmul(AtP, B), K), -1);
    // 对称化，抑制数值漂移
    for (let i = 0; i < Pn.r; i++) for (let j = i + 1; j < Pn.c; j++) {
      const v = 0.5 * (Pn.d[i * Pn.c + j] + Pn.d[j * Pn.c + i]);
      Pn.d[i * Pn.c + j] = v; Pn.d[j * Pn.c + i] = v;
    }
    err = maxAbsDiff(Pn, P);
    P = Pn;
    if (err < tol * Math.max(1, Math.abs(P.d[0]))) break;
  }
  return { K, P, iters: it, err };
}
