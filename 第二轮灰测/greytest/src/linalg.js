/* =====================================================================
 * linalg.js —— 小型稠密矩阵数值库（纯 JS，无依赖）
 * ---------------------------------------------------------------------
 * 教学说明：
 *   倒立摆的 LQR 设计需要在浏览器里现场求解代数 Riccati 方程 (ARE)，
 *   而 ARE 的可靠解法依赖三样基础设施：
 *     1) 线性方程组求解（高斯消元）—— 用于 Lyapunov 方程的 Kronecker 展开；
 *     2) 对称特征值分解（Jacobi 旋转）—— 用于判定 Q>=0 与求条件数；
 *     3) 特征多项式 + 复根求解 —— 用于给出闭环极点（教学核心可视化）。
 *   本文件用最少的代码把这三件事做到"数值上可信"，并全部给出残差自检。
 *
 * 约定：矩阵用二维数组 A[i][j]（行优先），向量用一维数组。
 * ===================================================================== */
(function (global) {
  'use strict';

  // ---------- 构造与基本操作 ----------
  function zeros(n, m) {
    m = (m === undefined) ? n : m;
    const A = new Array(n);
    for (let i = 0; i < n; i++) A[i] = new Float64Array(m);
    return A;
  }

  function eye(n, s) {
    s = (s === undefined) ? 1 : s;
    const A = zeros(n, n);
    for (let i = 0; i < n; i++) A[i][i] = s;
    return A;
  }

  function diag(v) {
    const A = zeros(v.length, v.length);
    for (let i = 0; i < v.length; i++) A[i][i] = v[i];
    return A;
  }

  function clone(A) {
    const n = A.length, B = new Array(n);
    for (let i = 0; i < n; i++) B[i] = Float64Array.from(A[i]);
    return B;
  }

  function transpose(A) {
    const n = A.length, m = A[0].length, B = zeros(m, n);
    for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) B[j][i] = A[i][j];
    return B;
  }

  function mul(A, B) {
    const n = A.length, k = B.length, m = B[0].length;
    const C = zeros(n, m);
    for (let i = 0; i < n; i++) {
      const Ai = A[i], Ci = C[i];
      for (let p = 0; p < k; p++) {
        const a = Ai[p];
        if (a === 0) continue;
        const Bp = B[p];
        for (let j = 0; j < m; j++) Ci[j] += a * Bp[j];
      }
    }
    return C;
  }

  function add(A, B) {
    const C = clone(A);
    for (let i = 0; i < A.length; i++) for (let j = 0; j < A[0].length; j++) C[i][j] += B[i][j];
    return C;
  }

  function sub(A, B) {
    const C = clone(A);
    for (let i = 0; i < A.length; i++) for (let j = 0; j < A[0].length; j++) C[i][j] -= B[i][j];
    return C;
  }

  function scale(A, s) {
    const C = clone(A);
    for (let i = 0; i < A.length; i++) for (let j = 0; j < A[0].length; j++) C[i][j] *= s;
    return C;
  }

  function matVec(A, v) {
    const n = A.length, m = A[0].length, r = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      let s = 0;
      for (let j = 0; j < m; j++) s += A[i][j] * v[j];
      r[i] = s;
    }
    return r;
  }

  function dot(a, b) {
    let s = 0;
    for (let i = 0; i < a.length; i++) s += a[i] * b[i];
    return s;
  }

  function trace(A) {
    let s = 0;
    for (let i = 0; i < A.length; i++) s += A[i][i];
    return s;
  }

  function normF(A) {
    let s = 0;
    for (let i = 0; i < A.length; i++) for (let j = 0; j < A[0].length; j++) s += A[i][j] * A[i][j];
    return Math.sqrt(s);
  }

  function symmetrize(A) {
    const n = A.length, B = zeros(n, n);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) B[i][j] = 0.5 * (A[i][j] + A[j][i]);
    return B;
  }

  // ---------- 线性方程组：带部分选主元的高斯消元 ----------
  // 解 A x = b（A 为 n x n）。就地工作在副本上，返回 x；奇异时抛错。
  function solve(A, b) {
    const n = A.length;
    const M = new Array(n);
    for (let i = 0; i < n; i++) {
      M[i] = new Float64Array(n + 1);
      for (let j = 0; j < n; j++) M[i][j] = A[i][j];
      M[i][n] = b[i];
    }
    for (let col = 0; col < n; col++) {
      // 选主元
      let piv = col, best = Math.abs(M[col][col]);
      for (let r = col + 1; r < n; r++) {
        const v = Math.abs(M[r][col]);
        if (v > best) { best = v; piv = r; }
      }
      if (best < 1e-300) throw new Error('solve(): 矩阵奇异或接近奇异');
      if (piv !== col) { const t = M[piv]; M[piv] = M[col]; M[col] = t; }
      const Mc = M[col], d = Mc[col];
      for (let r = col + 1; r < n; r++) {
        const Mr = M[r], f = Mr[col] / d;
        if (f === 0) continue;
        for (let j = col; j <= n; j++) Mr[j] -= f * Mc[j];
      }
    }
    const x = new Float64Array(n);
    for (let i = n - 1; i >= 0; i--) {
      let s = M[i][n];
      for (let j = i + 1; j < n; j++) s -= M[i][j] * x[j];
      x[i] = s / M[i][i];
    }
    return x;
  }

  function inv(A) {
    const n = A.length, Inv = zeros(n, n);
    for (let c = 0; c < n; c++) {
      const e = new Float64Array(n); e[c] = 1;
      const col = solve(A, e);
      for (let i = 0; i < n; i++) Inv[i][c] = col[i];
    }
    return Inv;
  }

  // 秩：带阈值的高斯消元（用于能控性判定）
  function rank(A, tol) {
    const M = clone(A);
    const n = M.length, m = M[0].length;
    let scaleMax = 0;
    for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) scaleMax = Math.max(scaleMax, Math.abs(M[i][j]));
    if (tol === undefined) tol = 1e-10 * Math.max(1, scaleMax) * Math.max(n, m);
    let r = 0;
    for (let c = 0; c < m && r < n; c++) {
      let piv = r, best = Math.abs(M[r][c]);
      for (let i = r + 1; i < n; i++) {
        const v = Math.abs(M[i][c]);
        if (v > best) { best = v; piv = i; }
      }
      if (best <= tol) continue;
      const t = M[piv]; M[piv] = M[r]; M[r] = t;
      for (let i = r + 1; i < n; i++) {
        const f = M[i][c] / M[r][c];
        for (let j = c; j < m; j++) M[i][j] -= f * M[r][j];
      }
      r++;
    }
    return r;
  }

  // ---------- 对称特征值分解：循环 Jacobi 旋转 ----------
  // 返回 {values:[...降序], vectors: V}（A ≈ V diag(values) V^T）
  function jacobiEigSym(Ain, maxSweep) {
    const n = Ain.length;
    const A = clone(symmetrize(Ain));
    let V = eye(n);
    maxSweep = maxSweep || 100;
    for (let sweep = 0; sweep < maxSweep; sweep++) {
      let off = 0;
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += A[i][j] * A[i][j];
      if (Math.sqrt(2 * off) < 1e-14 * Math.max(1, normF(A))) break;
      for (let p = 0; p < n - 1; p++) {
        for (let q = p + 1; q < n; q++) {
          if (Math.abs(A[p][q]) < 1e-300) continue;
          const theta = (A[q][q] - A[p][p]) / (2 * A[p][q]);
          const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
          const c = 1 / Math.sqrt(t * t + 1), s = t * c;
          for (let k = 0; k < n; k++) {
            const akp = A[k][p], akq = A[k][q];
            A[k][p] = c * akp - s * akq;
            A[k][q] = s * akp + c * akq;
          }
          for (let k = 0; k < n; k++) {
            const apk = A[p][k], aqk = A[q][k];
            A[p][k] = c * apk - s * aqk;
            A[q][k] = s * apk + c * aqk;
          }
          for (let k = 0; k < n; k++) {
            const vkp = V[k][p], vkq = V[k][q];
            V[k][p] = c * vkp - s * vkq;
            V[k][q] = s * vkp + c * vkq;
          }
        }
      }
    }
    const idx = [];
    for (let i = 0; i < n; i++) idx.push(i);
    idx.sort((a, b) => A[b][b] - A[a][a]);
    const values = idx.map((i) => A[i][i]);
    const Vs = zeros(n, n);
    for (let i = 0; i < n; i++) for (let k = 0; k < n; k++) Vs[i][k] = V[i][idx[k]];
    return { values: values, vectors: Vs };
  }

  // 奇异值（通过 A^T A 的对称特征值）与 2-范数条件数
  function singularValues(A) {
    const AtA = mul(transpose(A), A);
    const e = jacobiEigSym(AtA);
    return e.values.map((v) => Math.sqrt(Math.max(0, v)));
  }

  function cond2(A) {
    const s = singularValues(A);
    const smax = s[0], smin = s[s.length - 1];
    return (smin <= 0) ? Infinity : smax / smin;
  }

  // ---------- 特征多项式：Faddeev–LeVerrier ----------
  // 返回 [c0, c1, ..., c_{n-1}, 1]，即 p(λ)=λ^n + c_{n-1}λ^{n-1}+...+c0
  function charPoly(A) {
    const n = A.length;
    const c = new Float64Array(n + 1);
    c[n] = 1;
    let M = eye(n);
    for (let k = 1; k <= n; k++) {
      const AM = mul(A, M);
      c[n - k] = -trace(AM) / k;
      M = add(AM, eye(n, c[n - k]));
    }
    return Array.from(c);
  }

  // ---------- 复根：Durand–Kerner（Weierstrass）迭代 ----------
  // coeffs = [c0, c1, ..., cn]（升幂）。返回 [{re, im}, ...]
  function polyRoots(coeffs) {
    let c = coeffs.slice();
    while (c.length > 1 && Math.abs(c[c.length - 1]) < 1e-300) c.pop();
    const n = c.length - 1;
    if (n < 1) return [];
    const an = c[n];
    const a = c.map((v) => v / an); // 首一化
    // 初值：(0.4+0.9i)^k，避免对称初值导致的死锁
    let zr = new Float64Array(n), zi = new Float64Array(n);
    let pr = 1, pi = 0;
    for (let k = 0; k < n; k++) {
      zr[k] = pr; zi[k] = pi;
      const nr = pr * 0.4 - pi * 0.9, ni = pr * 0.9 + pi * 0.4;
      pr = nr; pi = ni;
    }
    const evalP = (xr, xi) => {
      let vr = 0, vi = 0;
      for (let k = n; k >= 0; k--) {
        const nr = vr * xr - vi * xi + a[k];
        const ni = vr * xi + vi * xr;
        vr = nr; vi = ni;
      }
      return [vr, vi];
    };
    for (let iter = 0; iter < 500; iter++) {
      let maxStep = 0;
      for (let k = 0; k < n; k++) {
        const [pr2, pi2] = evalP(zr[k], zi[k]);
        // 分母 Π_{j≠k}(z_k - z_j)
        let dr = 1, di = 0;
        for (let j = 0; j < n; j++) {
          if (j === k) continue;
          const xr = zr[k] - zr[j], xi = zi[k] - zi[j];
          const nr = dr * xr - di * xi, ni = dr * xi + di * xr;
          dr = nr; di = ni;
        }
        const den = dr * dr + di * di;
        if (den < 1e-300) continue;
        // step = p / d
        const sr = (pr2 * dr + pi2 * di) / den;
        const si = (pi2 * dr - pr2 * di) / den;
        zr[k] -= sr; zi[k] -= si;
        maxStep = Math.max(maxStep, Math.hypot(sr, si));
      }
      if (maxStep < 1e-14) break;
    }
    const roots = [];
    for (let k = 0; k < n; k++) roots.push({ re: zr[k], im: Math.abs(zi[k]) < 1e-10 ? 0 : zi[k] });
    roots.sort((p, q) => (q.re - p.re) || (q.im - p.im));
    return roots;
  }

  function eigenvalues(A) { return polyRoots(charPoly(A)); }

  // ---------- Lyapunov 方程 A^T P + P A = -Q ----------
  // 直接按元素展开成 n^2 x n^2 线性方程组（n=4 时仅 16x16，浏览器里瞬时完成）：
  //   (A^T P + P A)_{ij} = Σ_k A_{ki} P_{kj} + Σ_k P_{ik} A_{kj} = -Q_{ij}
  // 未知量按行优先编号 idx(i,j) = i*n + j。
  function lyapunovSolveT(A, Q) {
    const n = A.length, N = n * n;
    const M = zeros(N, N);
    const rhs = new Float64Array(N);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const row = i * n + j;
        for (let k = 0; k < n; k++) {
          M[row][k * n + j] += A[k][i];   // A^T P 项
          M[row][i * n + k] += A[k][j];   // P A   项
        }
        rhs[row] = -Q[i][j];
      }
    }
    const x = solve(M, rhs);
    const P = zeros(n, n);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) P[i][j] = x[i * n + j];
    return symmetrize(P);
  }

  // ---------- 工具 ----------
  function isFiniteMat(A) {
    for (let i = 0; i < A.length; i++) for (let j = 0; j < A[0].length; j++) if (!isFinite(A[i][j])) return false;
    return true;
  }

  function toRows(A) { return A.map((r) => Array.from(r)); }

  /* ---------- 矩阵指数：缩放-平方 + 泰勒展开 ----------
   * 用于连续系统的零阶保持离散化。配合"增广矩阵技巧"可同时得到 A_d 与 B_d：
   *   expm([[A, B], [0, 0]] · Ts) = [[A_d, B_d], [0, I]]
   * 这样即使 A 奇异（本系统 A 确实有一个零特征值）也不需要求逆。
   */
  function expm(A) {
    const n = A.length;
    const nrm = normF(A);
    let s = 0;
    if (nrm > 0.5) s = Math.max(0, Math.ceil(Math.log2(nrm / 0.5)));
    const As = scale(A, Math.pow(2, -s));
    let term = eye(n), sum = eye(n);
    for (let k = 1; k <= 20; k++) {
      term = scale(mul(term, As), 1 / k);
      sum = add(sum, term);
      if (normF(term) < 1e-18 * Math.max(1, normF(sum))) break;
    }
    for (let i = 0; i < s; i++) sum = mul(sum, sum);
    return sum;
  }

  // 零阶保持离散化：x[k+1] = Ad x[k] + Bd u[k]
  function c2dZoh(A, B, Ts) {
    const n = A.length, m = B[0].length;
    const M = zeros(n + m, n + m);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) M[i][j] = A[i][j] * Ts;
      for (let j = 0; j < m; j++) M[i][n + j] = B[i][j] * Ts;
    }
    const E = expm(M);
    const Ad = zeros(n, n), Bd = zeros(n, m);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) Ad[i][j] = E[i][j];
      for (let j = 0; j < m; j++) Bd[i][j] = E[i][n + j];
    }
    return { Ad: Ad, Bd: Bd };
  }

  /* ---------- 谱半径：Gelfand 公式 + 反复平方 ----------
   * 为什么不直接用 eigenvalues()：离散化后（小 Ts）全部特征值都聚在 z=1 附近，
   * 而"特征多项式 + 求根"在根聚簇时是病态的，算出来的模长可能虚假地 > 1，
   * 导致"临界采样周期"被误判。Gelfand 公式 ρ(M) = lim ‖Mᵏ‖^(1/k) 用反复平方
   * （k = 2^16）配合归一化防溢出，对聚簇谱非常稳健。
   */
  function spectralRadius(M, squarings) {
    const q = squarings || 16;
    let X = clone(M), logSum = 0, k = 1;
    for (let j = 0; j < q; j++) {
      X = mul(X, X); k *= 2;
      const nx = normF(X);
      if (!isFinite(nx)) return Infinity;
      if (nx > 1e40 || (nx < 1e-40 && nx > 0)) { X = scale(X, 1 / nx); logSum += Math.log(nx); }
      if (nx === 0) return 0;
    }
    const nf = normF(X);
    if (!isFinite(nf)) return Infinity;
    return Math.exp((logSum + Math.log(nf)) / k);
  }

  global.LinAlg = {
    zeros, eye, diag, clone, transpose, mul, add, sub, scale, matVec, dot, trace,
    normF, symmetrize, solve, inv, rank, jacobiEigSym, singularValues, cond2,
    charPoly, polyRoots, eigenvalues, lyapunovSolveT, isFiniteMat, toRows,
    expm, c2dZoh, spectralRadius
  };
})(typeof window !== 'undefined' ? window : globalThis);
