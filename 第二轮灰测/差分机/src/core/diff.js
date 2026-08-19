/* =====================================================================
 * diff.js —— 差分法数学核心 / finite-difference mathematics
 *
 * 本文件只做"数学"，不参与机械动画。它的唯一职责是：
 *   1. 由多项式或差分表得到 Δ^j f(x0)；
 *   2. 求出真实巴贝奇机 **两相加法** 所需要的寄存器装载值；
 *   3. 提供把机器寄存器读数反算回 Δ 值的整数逆变换（用于页面校验）。
 *
 * 为什么需要 (2)(3)?
 *   理想差分递推是"同时更新"： D_j <- D_j + D_{j+1} (全部同时)
 *   而真实机器一次曲柄只能驱动一半的列，所以一个完整循环是两相：
 *       相 A(奇数列 -> 偶数列):  D0+=D1, D2+=D3, D4+=D5 ...
 *       相 B(偶数列 -> 奇数列):  D1+=D2, D3+=D4 ...
 *   相 B 用到的 D2 已在相 A 中被改过，所以机器的递推矩阵 C != S。
 *   但 C 与 S 都是幺幂矩阵，存在整数上三角矩阵 L 使 C·L = L·S，
 *   即：机械寄存器 m = L·d。历史上真机也必须这样"预调"初值。
 *   我们把 L 直接解出来（并做整数精确校验），于是：
 *       装载：m = L d          显示：d = L^{-1} m
 *   页面上同时给出机械读数 m 与数学差分 d，二者互为验证。
 * ===================================================================== */
(function (root) {
  'use strict';

  var DE = root.DE || (root.DE = {});

  /* ---------------- 基础组合数学 ---------------- */

  function binom(n, k) {
    if (k < 0 || k > n) return 0;
    var r = 1;
    for (var i = 0; i < k; i++) r = r * (n - i) / (i + 1);
    return Math.round(r);
  }

  // coeffs[i] 是 x^i 的系数
  function evalPoly(coeffs, x) {
    var v = 0;
    for (var i = coeffs.length - 1; i >= 0; i--) v = v * x + coeffs[i];
    return v;
  }

  // 由函数值序列求前向差分表（第 0 项即 f(x0)）
  function differenceTable(values) {
    var rows = [values.slice()], r = 0;
    while (rows[r].length > 1) {
      var prev = rows[r], next = [];
      for (var i = 0; i + 1 < prev.length; i++) next.push(prev[i + 1] - prev[i]);
      rows.push(next); r++;
    }
    return rows.map(function (row) { return row[0]; });
  }

  // 由 Δ 值向量还原函数值 f(x0+k) = Σ C(k,j) Δ^j
  function valueFromDifferences(d, k) {
    var v = 0;
    for (var j = 0; j < d.length; j++) v += binom(k, j) * d[j];
    return v;
  }

  /* ---------------- 机器的相/算子 ---------------- */

  // 一个完整循环中两个相各自的加法对 {src -> dst}
  // 相 A：src = 1,3,5...  相 B：src = 2,4,6...
  function phasePlan(nCols) {
    var A = [], B = [], i;
    for (i = 1; i < nCols; i += 2) A.push({ src: i, dst: i - 1, gap: i - 1 });
    for (i = 2; i < nCols; i += 2) B.push({ src: i, dst: i - 1, gap: i - 1 });
    return [A, B];
  }

  function identity(n) {
    var M = [], i, j;
    for (i = 0; i < n; i++) { M.push([]); for (j = 0; j < n; j++) M[i].push(i === j ? 1 : 0); }
    return M;
  }

  function matMul(A, B) {
    var n = A.length, m = B[0].length, p = B.length, C = [], i, j, k, s;
    for (i = 0; i < n; i++) {
      C.push([]);
      for (j = 0; j < m; j++) { s = 0; for (k = 0; k < p; k++) s += A[i][k] * B[k][j]; C[i].push(s); }
    }
    return C;
  }

  // 一个相的线性算子：对每个 (src,dst) 做 row_dst += row_src
  function phaseMatrix(ops, n) {
    var M = identity(n);
    ops.forEach(function (op) {
      for (var j = 0; j < n; j++) M[op.dst][j] += M[op.src][j];
    });
    return M;
  }

  // 一个完整循环（先 A 后 B）的整数矩阵： m' = C m
  function cycleMatrix(nCols) {
    var pl = phasePlan(nCols);
    var A = phaseMatrix(pl[0], nCols);
    var B = phaseMatrix(pl[1], nCols);
    return matMul(B, A);
  }

  /* ---------------- 数值求解 + 整数精确校验 ---------------- */

  function solveLinear(A, b) {
    var n = A.length, M = [], i, j, k;
    for (i = 0; i < n; i++) M.push(A[i].slice().concat([b[i]]));
    for (i = 0; i < n; i++) {
      var piv = i;
      for (k = i + 1; k < n; k++) if (Math.abs(M[k][i]) > Math.abs(M[piv][i])) piv = k;
      if (Math.abs(M[piv][i]) < 1e-12) return null;
      var t = M[i]; M[i] = M[piv]; M[piv] = t;
      for (k = i + 1; k < n; k++) {
        var f = M[k][i] / M[i][i];
        if (f === 0) continue;
        for (j = i; j <= n; j++) M[k][j] -= f * M[i][j];
      }
    }
    var x = new Array(n);
    for (i = n - 1; i >= 0; i--) {
      var s = M[i][n];
      for (j = i + 1; j < n; j++) s -= M[i][j] * x[j];
      x[i] = s / M[i][i];
    }
    return x;
  }

  // 精确整数校验： A x == b ?
  function checkIntegerSolution(A, x, b) {
    for (var i = 0; i < A.length; i++) {
      var s = 0;
      for (var j = 0; j < x.length; j++) {
        if (!Number.isInteger(x[j])) return false;
        s += A[i][j] * x[j];
      }
      if (s !== b[i]) return false;
    }
    return true;
  }

  /* ---------------- 装载矩阵 L：m = L d ---------------- */
  /*
   * 约束：机器每完成一个完整循环，D0 轮组读数必须正好是 f(x0+k)。
   *      设 C 为循环矩阵，则 (C^k m)[0] = f(x0+k)，k = 0..n。
   *      因为 C 与 S 同为幺幂（(C-I)^{n+1}=0），D0 输出必是 k 的 ≤n 次多项式，
   *      故只要在 n+1 个点上相等就永远相等。
   */
  function loadingMatrix(nCols) {
    var C = cycleMatrix(nCols), n = nCols;
    // A 的第 k 行 = e0^T C^k
    var P = identity(n), rows = [], k;
    for (k = 0; k < n; k++) { rows.push(P[0].slice()); P = matMul(P, C); }

    var L = [], i, j;
    for (i = 0; i < n; i++) { L.push(new Array(n)); }
    for (j = 0; j < n; j++) {
      // d = e_j  =>  f(x0+k) = C(k, j)
      var b = [];
      for (k = 0; k < n; k++) b.push(binom(k, j));
      var col = solveLinear(rows, b);
      if (!col) throw new Error('loadingMatrix: 奇异矩阵 nCols=' + nCols);
      col = col.map(function (v) { return Math.round(v); });
      if (!checkIntegerSolution(rows, col, b)) {
        throw new Error('loadingMatrix: 非整数解 nCols=' + nCols);
      }
      for (i = 0; i < n; i++) L[i][j] = col[i];
    }
    var Linv = invertIntegerMatrix(L);
    return { C: C, L: L, Linv: Linv };
  }

  function invertIntegerMatrix(L) {
    var n = L.length, inv = [], j, i;
    for (i = 0; i < n; i++) inv.push(new Array(n));
    for (j = 0; j < n; j++) {
      var e = [];
      for (i = 0; i < n; i++) e.push(i === j ? 1 : 0);
      var col = solveLinear(L, e);
      if (!col) throw new Error('invertIntegerMatrix: 不可逆');
      col = col.map(function (v) { return Math.round(v); });
      if (!checkIntegerSolution(L, col, e)) throw new Error('invertIntegerMatrix: 非整数逆');
      for (i = 0; i < n; i++) inv[i][j] = col[i];
    }
    return inv;
  }

  function applyMatrix(M, v) {
    var out = [], i, j, s;
    for (i = 0; i < M.length; i++) { s = 0; for (j = 0; j < v.length; j++) s += M[i][j] * v[j]; out.push(s); }
    return out;
  }

  /* ---------------- 取模工具（机器是 10^nD 的有限位机） ---------------- */

  function modWrap(v, nDigits) {
    var m = Math.pow(10, nDigits);
    v = v % m;
    if (v < 0) v += m;
    return v;
  }

  // 把有限位读数解释成带符号数（用于显示负的高阶差分）
  function signedRead(v, nDigits) {
    var m = Math.pow(10, nDigits);
    return v > m / 2 ? v - m : v;
  }

  DE.math = {
    binom: binom,
    evalPoly: evalPoly,
    differenceTable: differenceTable,
    valueFromDifferences: valueFromDifferences,
    phasePlan: phasePlan,
    cycleMatrix: cycleMatrix,
    loadingMatrix: loadingMatrix,
    applyMatrix: applyMatrix,
    modWrap: modWrap,
    signedRead: signedRead,
    solveLinear: solveLinear
  };
})(typeof window !== 'undefined' ? window : globalThis);
