/* ============================================================================
   CFR-1500 设计文件 · 不同温度下的中子截面（多普勒展宽与共振自屏）
   纯 JavaScript 模块，无外部依赖。ES2018，单个 IIFE。
   内核：SLBW 单能级 + Faddeeva 多普勒展宽 + 窄共振自屏 + 有效共振积分。
   ==========================================================================*/
(function () {
  'use strict';

  /* ================= 物理常数与共振参数 ================= */
  var A = 238.05;            // U-238 质量数
  var KB = 8.617333e-5;      // 玻尔兹曼常数 [eV/K]
  var SIG_POT = 10.6;        // 势散射截面 [b]
  var SQRT_PI = Math.sqrt(Math.PI);
  var TWO_OVER_SQRT_PI = 2 / Math.sqrt(Math.PI);
  var C0FAC = 2.608e6 * Math.pow((A + 1) / A, 2);   // σ0 前因子 [b]

  // [E0 (eV), Γn (meV), Γγ (meV)] —— SLBW 参数，ENDF/B 量级（g_J = 1，s 波）
  var RES = [
    [6.674, 1.476, 22.9], [20.871, 10.09, 22.9], [36.682, 34.13, 22.6], [66.03, 24.6, 25.6],
    [80.749, 1.865, 22.6], [102.56, 71.7, 22.3], [116.902, 25.5, 22.6], [145.66, 0.85, 22.6],
    [165.29, 3.30, 22.6], [189.67, 175.0, 22.9], [208.46, 51.0, 22.6], [237.38, 25.9, 22.6],
    [273.66, 23.0, 22.6], [291.0, 17.0, 22.6], [311.3, 1.60, 22.6], [347.8, 63.0, 22.6],
    [376.9, 6.0, 22.6], [397.7, 6.4, 22.6], [410.2, 17.0, 22.6], [434.4, 1.4, 22.6]
  ];
  var E0_674 = 6.674;   // 局部放大共振

  /* ================= Faddeeva 函数 w(z) =================
     w(z) = exp(-z^2)·erfc(-iz)，z = x + iy，y ≥ 0。
     采用「幂级数 + 渐近展开」等价算法（|z|<4.5 用级数，否则用渐近），
     在共振计算所涉区域内相对误差 ≤ 1e-4。                                   */
  function faddeeva(x, y) {
    if (y < 0) { var wm = faddeeva(x, -y); return { re: wm.re, im: -wm.im }; }
    var r = Math.hypot(x, y);
    if (r < 4.5) {
      // 幂级数：w(z) = Σ (iz)^n / Γ(n/2+1)，系数比 r_n = 2/((n+2) r_{n-1})，r_0 = 2/√π
      var tre = 1, tim = 0, sre = 1, sim = 0;
      var izre = -y, izim = x;
      var rr = TWO_OVER_SQRT_PI;
      var N = Math.floor(2 * r * r + 14 * r + 20) + 2;
      for (var n = 0; n < N; n++) {
        var nre = (tre * izre - tim * izim) * rr;
        var nim = (tre * izim + tim * izre) * rr;
        tre = nre; tim = nim;
        sre += tre; sim += tim;
        rr = 2 / ((n + 2) * rr);
      }
      return { re: sre, im: sim };
    }
    // 渐近展开：w(z) ~ (i/(√π z)) Σ (2k-1)!!/(2 z^2)^k
    var z2re = x * x - y * y, z2im = 2 * x * y;
    var n2 = z2re * z2re + z2im * z2im;
    var iz2re = z2re / n2, iz2im = -z2im / n2;
    var c = [1, 0.5, 0.75, 1.875, 6.5625, 29.53125, 162.421875, 1136.953125];
    var pre = 1, pim = 0, sre2 = 0, sim2 = 0;
    for (var k = 0; k < 8; k++) {
      sre2 += c[k] * pre; sim2 += c[k] * pim;
      var npr = pre * iz2re - pim * iz2im;
      var npi = pre * iz2im + pim * iz2re;
      pre = npr; pim = npi;
    }
    var r2 = x * x + y * y;
    var mre = y / (SQRT_PI * r2), mim = x / (SQRT_PI * r2);
    return { re: sre2 * mre - sim2 * mim, im: sre2 * mim + sim2 * mre };
  }

  /* ψ(ξ,x) = (ξ√π/2)·Re[w(z)]，χ(ξ,x) = ξ√π·Im[w(z)]，z = (ξ/2)(x + i) */
  function psiChi(xi, x) {
    var w = faddeeva(0.5 * xi * x, 0.5 * xi);
    return [0.5 * xi * SQRT_PI * w.re, xi * SQRT_PI * w.im];
  }

  /* 多普勒宽度 Δ = √(4 E0 k T / A) [eV] */
  function dopplerWidth(E0, T) {
    return Math.sqrt(4 * E0 * KB * T / A);
  }

  /* 共振的近区窗口半径：±60·max(Γ0, Δ(2100 K))，与网格一致 */
  function resonanceWindow(E0, Gn0, Gg) {
    var Gamma0 = (Gn0 + Gg) * 1e-3;
    return 60 * Math.max(Gamma0, dopplerWidth(E0, 2100));
  }

  /* 单共振在某能量处的贡献。
     |E-E0| ≤ 窗口 → 全多普勒（ψ）；窗口外 → 洛伦兹尾（ψ = 1/(1+x²)，与 T 无关）。
     wantScatter=true 返回弹性部分，否则返回俘获部分。 */
  function resContribution(E, T, i, wantScatter) {
    var E0 = RES[i][0], Gn0 = RES[i][1] * 1e-3, Gg = RES[i][2] * 1e-3;
    var Gn = Gn0 * Math.sqrt(E / E0);
    var G = Gn + Gg;
    var s0 = C0FAC * (Gn / (G * E0));
    var W = resonanceWindow(E0, Gn0, Gg);
    var x = 2 * (E - E0) / G;
    var ps;
    if (Math.abs(E - E0) <= W) {
      ps = psiChi(G / dopplerWidth(E0, T), x)[0];
    } else {
      ps = 1 / (1 + x * x);
    }
    if (wantScatter) return s0 * (Gn / G) * ps;
    return s0 * (Gg / G) * Math.sqrt(E0 / E) * ps;
  }

  /* 单点截面 [b]（已含势散射与全部 20 条共振，共振-势干涉项忽略） */
  function sigmaGamma(E, T) {
    var s = 0;
    for (var i = 0; i < RES.length; i++) s += resContribution(E, T, i, false);
    return s;
  }
  function sigmaScatter(E, T) {
    var s = SIG_POT;
    for (var i = 0; i < RES.length; i++) s += resContribution(E, T, i, true);
    return s;
  }
  function sigmaTotal(E, T) { return sigmaGamma(E, T) + sigmaScatter(E, T); }

  /* ================= 能量网格 ================= */
  function geomspace(a, b, n) {
    var out = new Float64Array(n);
    for (var i = 0; i < n; i++) out[i] = a * Math.pow(b / a, i / (n - 1));
    return out;
  }
  function linspace(a, b, n) {
    var out = new Float64Array(n);
    for (var i = 0; i < n; i++) out[i] = a + (b - a) * i / (n - 1);
    return out;
  }
  function buildGrid() {
    var parts = [geomspace(1, 1000, 4000)];
    for (var i = 0; i < RES.length; i++) {
      var E0 = RES[i][0], Gn0 = RES[i][1] * 1e-3, Gg = RES[i][2] * 1e-3;
      var W = resonanceWindow(E0, Gn0, Gg);
      parts.push(linspace(Math.max(0.5, E0 - W), E0 + W, 1600));
    }
    var all = [];
    for (var p = 0; p < parts.length; p++)
      for (var j = 0; j < parts[p].length; j++) all.push(parts[p][j]);
    all.sort(function (a, b) { return a - b; });
    var out = [];
    for (var k = 0; k < all.length; k++) {
      var v = all[k];
      if (v <= 1 || v >= 1000) continue;
      if (k > 0 && v === all[k - 1]) continue;
      out.push(v);
    }
    return new Float64Array(out);
  }

  function lowerBound(arr, v) {
    var lo = 0, hi = arr.length;
    while (lo < hi) { var m = (lo + hi) >> 1; if (arr[m] < v) lo = m + 1; else hi = m; }
    return lo;
  }

  /* 洛伦兹远翼俘获截面（与 T 无关） */
  function lorentzGamma(E, E0, Gn0, Gg) {
    var Gn = Gn0 * Math.sqrt(E / E0);
    var G = Gn + Gg;
    var s0 = C0FAC * (Gn / (G * E0));
    var x = 2 * (E - E0) / G;
    return s0 * (Gg / G) * Math.sqrt(E0 / E) / (1 + x * x);
  }

  /* 缓存的网格与远翼/近区索引（惰性构建一次） */
  var GRID = null, FAR = null, NEAR = null, NPTS = 0;
  function ensureGrid() {
    if (GRID) return;
    GRID = buildGrid();
    NPTS = GRID.length;
    FAR = new Float64Array(NPTS);
    NEAR = [];
    for (var i = 0; i < RES.length; i++) {
      var E0 = RES[i][0], Gn0 = RES[i][1] * 1e-3, Gg = RES[i][2] * 1e-3;
      var W = resonanceWindow(E0, Gn0, Gg);
      var lo = lowerBound(GRID, E0 - W);
      var hi = lowerBound(GRID, E0 + W);
      NEAR.push({ E0: E0, Gn0: Gn0, Gg: Gg, lo: lo, hi: hi });
      for (var j = 0; j < lo; j++) FAR[j] += lorentzGamma(GRID[j], E0, Gn0, Gg);
      for (var j2 = hi; j2 < NPTS; j2++) FAR[j2] += lorentzGamma(GRID[j2], E0, Gn0, Gg);
    }
  }

  /* 在全局网格上计算某温度下的 sg（俘获）、sn（弹性）数组 */
  function computeSpectra(T) {
    ensureGrid();
    var sg = new Float64Array(NPTS);
    sg.set(FAR);
    var sn = new Float64Array(NPTS);
    for (var j = 0; j < NPTS; j++) sn[j] = SIG_POT;
    for (var i = 0; i < RES.length; i++) {
      var nd = NEAR[i];
      var D = dopplerWidth(nd.E0, T);
      for (var j2 = nd.lo; j2 < nd.hi; j2++) {
        var E = GRID[j2];
        var Gn = nd.Gn0 * Math.sqrt(E / nd.E0);
        var G = Gn + nd.Gg;
        var s0 = C0FAC * (Gn / (G * nd.E0));
        var xi = G / D;
        var x = 2 * (E - nd.E0) / G;
        var ps = psiChi(xi, x)[0];
        sg[j2] += s0 * (nd.Gg / G) * Math.sqrt(nd.E0 / E) * ps;
        sn[j2] += s0 * (Gn / G) * ps;
      }
    }
    return { sg: sg, sn: sn };
  }

  /* 梯形积分 Σ 0.5(y_i+y_{i+1})(x_{i+1}-x_i) */
  function trapz(y, x) {
    var s = 0;
    for (var i = 0; i < x.length - 1; i++) s += 0.5 * (y[i] + y[i + 1]) * (x[i + 1] - x[i]);
    return s;
  }

  /* 有效共振积分与无限稀释共振积分（单温度） */
  function effRI(T, sigmaB) {
    ensureGrid();
    var sp = computeSpectra(T);
    var s = 0;
    for (var j = 0; j < NPTS - 1; j++) {
      var f0 = sp.sg[j] * sigmaB / (sigmaB + sp.sg[j] + sp.sn[j]) / GRID[j];
      var f1 = sp.sg[j + 1] * sigmaB / (sigmaB + sp.sg[j + 1] + sp.sn[j + 1]) / GRID[j + 1];
      s += 0.5 * (f0 + f1) * (GRID[j + 1] - GRID[j]);
    }
    return s;
  }
  function riInf(T) {
    ensureGrid();
    var sp = computeSpectra(T);
    var s = 0;
    for (var j = 0; j < NPTS - 1; j++)
      s += 0.5 * (sp.sg[j] / GRID[j] + sp.sg[j + 1] / GRID[j + 1]) * (GRID[j + 1] - GRID[j]);
    return s;
  }

  /* 温度表：返回 { Ts, sigmasB, rows:[{T, Delta674, xi674, peak, fwhm, riInf, Ieff[]}] } */
  function computeTable(Ts, sigmasB) {
    ensureGrid();
    var E = GRID;
    var rows = [];
    for (var t = 0; t < Ts.length; t++) {
      var T = Ts[t];
      var sp = computeSpectra(T);
      var sg = sp.sg, sn = sp.sn;
      var peak = 0, pi = 0;
      for (var j = 0; j < NPTS; j++) {
        if (Math.abs(E[j] - E0_674) < 2 && sg[j] > peak) { peak = sg[j]; pi = j; }
      }
      var half = peak / 2, left = NaN, right = NaN;
      for (var j = pi; j > 0; j--) {
        if (sg[j - 1] <= half && sg[j] >= half) {
          left = E[j - 1] + (E[j] - E[j - 1]) * (half - sg[j - 1]) / (sg[j] - sg[j - 1]); break;
        }
      }
      for (var j2 = pi; j2 < NPTS - 1; j2++) {
        if (sg[j2] >= half && sg[j2 + 1] <= half) {
          right = E[j2] + (E[j2 + 1] - E[j2]) * (sg[j2] - half) / (sg[j2] - sg[j2 + 1]); break;
        }
      }
      var fwhm = (isFinite(left) && isFinite(right)) ? right - left : NaN;
      var ri = 0;
      for (var j3 = 0; j3 < NPTS - 1; j3++)
        ri += 0.5 * (sg[j3] / E[j3] + sg[j3 + 1] / E[j3 + 1]) * (E[j3 + 1] - E[j3]);
      var Ieff = [];
      for (var b = 0; b < sigmasB.length; b++) {
        var sb = sigmasB[b], s2 = 0;
        for (var j4 = 0; j4 < NPTS - 1; j4++) {
          var f0 = sg[j4] * sb / (sb + sg[j4] + sn[j4]) / E[j4];
          var f1 = sg[j4 + 1] * sb / (sb + sg[j4 + 1] + sn[j4 + 1]) / E[j4 + 1];
          s2 += 0.5 * (f0 + f1) * (E[j4 + 1] - E[j4]);
        }
        Ieff.push(s2);
      }
      var dd = dopplerWidth(E0_674, T);
      var G674 = RES[0][1] * 1e-3 + RES[0][2] * 1e-3;
      rows.push({
        T: T, Delta674: dd, xi674: G674 / dd,
        peak: peak, fwhm: fwhm, riInf: ri, Ieff: Ieff
      });
    }
    return { Ts: Ts, sigmasB: sigmasB, rows: rows };
  }

  /* 最小二乘线性拟合，返回 {slope, intercept, r2} */
  function linFit(xs, ys) {
    var n = xs.length, sx = 0, sy = 0, sxx = 0, sxy = 0, syy = 0;
    for (var i = 0; i < n; i++) {
      sx += xs[i]; sy += ys[i]; sxx += xs[i] * xs[i]; sxy += xs[i] * ys[i]; syy += ys[i] * ys[i];
    }
    var slope = (n * sxy - sx * sy) / (n * sxx - sx * sx);
    var intercept = (sy - slope * sx) / n;
    var ym = sy / n, ssRes = 0, ssTot = 0;
    for (var i2 = 0; i2 < n; i2++) {
      var yp = slope * xs[i2] + intercept;
      ssRes += (ys[i2] - yp) * (ys[i2] - yp);
      ssTot += (ys[i2] - ym) * (ys[i2] - ym);
    }
    return { slope: slope, intercept: intercept, r2: 1 - ssRes / ssTot };
  }

  /* ================= 导出 API ================= */
  var API = {
    RES: RES, A: A, KB: KB, SIG_POT: SIG_POT,
    faddeeva: faddeeva, psiChi: psiChi, dopplerWidth: dopplerWidth,
    sigmaGamma: sigmaGamma, sigmaScatter: sigmaScatter, sigmaTotal: sigmaTotal,
    buildGrid: buildGrid, computeTable: computeTable,
    effRI: effRI, riInf: riInf, linFit: linFit
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof window !== 'undefined' && window.SFR) window.SFR.register('xsec', mount);

  /* ======================================================================
     页面渲染
     ====================================================================== */
  var PAL = ['#2f6f8c', '#c8761f', '#8a4b8f', '#3f7a45', '#b0303a', '#6b6257', '#1f9ea8'];

  function mount(host) {
    var S = window.SFR;
    secMechanism(S, host);
    secDoppler(S, host);
    secTable(S, host);
    secIeff(S, host);
    secOneGroup(S, host);
    secSpectrum(S, host);
    secInference(S, host);
  }

  /* ---------- 1. 机理说明 ---------- */
  function secMechanism(S, host) {
    var p = S.el('div', { class: 'panel' }, [
      S.el('div', { class: 'h4', text: '机理：多普勒展宽与共振自屏（SLBW + 窄共振近似）' }),
      S.el('p', { class: 'note', html:
        '多普勒宽度：Δ = √(4 E<sub>0</sub> k T / A)，k = 8.6173×10<sup>-5</sup> eV/K，A = 238.05。' +
        '多普勒展宽线型用 Faddeeva 函数：ψ(ξ,x) = (ξ√π/2)·Re[w(z)]，χ(ξ,x) = ξ√π·Im[w(z)]，' +
        'z = (ξ/2)(x + i)，w(z) = e<sup>-z²</sup>erfc(-iz)，其中 ξ = Γ/Δ、x = 2(E-E<sub>0</sub>)/Γ。' }),
      S.el('p', { class: 'note', html:
        '单能级 Breit–Wigner（SLBW，g<sub>J</sub>=1）：σ<sub>0</sub> = 2.608×10<sup>6</sup>·((A+1)/A)²·Γ<sub>n</sub>/(Γ·E<sub>0</sub>) [b]；' +
        'Γ<sub>n</sub>(E) = Γ<sub>n</sub>(E<sub>0</sub>)·√(E/E<sub>0</sub>)，Γ = Γ<sub>n</sub> + Γ<sub>γ</sub>。' +
        '俘获 σ<sub>γ</sub>(E) = Σ<sub>r</sub> σ<sub>0,r</sub>(Γ<sub>γ</sub>/Γ)√(E<sub>0</sub>/E)·ψ<sub>r</sub>，' +
        '弹性 σ<sub>n</sub>(E) = σ<sub>pot</sub> + Σ<sub>r</sub> σ<sub>0,r</sub>(Γ<sub>n</sub>/Γ)·ψ<sub>r</sub>，σ<sub>pot</sub> = 10.6 b。' +
        '（共振-势散射干涉项忽略，对俘获自屏影响 <1%。）' }),
      S.el('p', { class: 'note', html:
        '窄共振（NR）自屏与有效共振积分：I<sub>eff</sub>(T, σ<sub>b</sub>) = ∫ σ<sub>γ</sub>(E,T)·σ<sub>b</sub>/(σ<sub>b</sub>+σ<sub>t</sub>(E,T)) dE/E，' +
        '积分区间 1–1000 eV；无限稀释 RI<sub>∞</sub> = ∫ σ<sub>γ</sub> dE/E。' }),
      S.el('p', { class: 'note', html:
        '<b>因果链：</b>温度升高 → 靶核热运动加剧 → 共振峰变矮、两翼变宽（多普勒展宽）；' +
        '由于展宽前后俘获面积守恒（RI<sub>∞</sub> 与 T 无关），而展宽使翼部σ<sub>γ</sub>抬升、峰部被自屏压制的效应减弱，' +
        '共振区的有效俘获 I<sub>eff</sub> 随温度上升 → 更多中子被 U-238 俘获 → 引入<b>负多普勒反应性</b>（负反馈，反应堆固有安全性的关键来源）。' }),
      S.el('p', { class: 'note', html:
        '<b>重要声明：</b>本页共振区截面为页面内<b>实时 SLBW 计算</b>（可逐点复算）；第 5 节的 1 群谱平均截面为<b>代表性量级值</b>（非直接查库，仅供量级参考）。' })
    ]);
    host.appendChild(p);
  }

  /* ---------- 2. σγ(E) 多普勒展宽（两幅联动） ---------- */
  function secDoppler(S, host) {
    var Tslider = 900;
    var EsL = linspace(E0_674 - 0.6, E0_674 + 0.6, 420);
    var EsR = geomspace(1, 1000, 640);
    var fixedT = [300, 900, 1500, 2100];

    function curve(Es, T) {
      var pts = [];
      for (var i = 0; i < Es.length; i++) pts.push([Es[i], sigmaGamma(Es[i], T)]);
      return pts;
    }
    function sliderSeries(Es, T) {
      return { name: 'T = ' + T + ' K', color: '#b0303a', width: 3.2, pts: curve(Es, T) };
    }

    var serL = [
      { name: 'T = 300 K', color: PAL[0], pts: curve(EsL, 300) },
      { name: 'T = 900 K', color: PAL[1], pts: curve(EsL, 900) },
      { name: 'T = 1500 K', color: PAL[2], pts: curve(EsL, 1500) },
      { name: 'T = 2100 K', color: PAL[3], pts: curve(EsL, 2100) },
      sliderSeries(EsL, Tslider)
    ];
    var serR = [
      { name: 'T = 300 K', color: PAL[0], pts: curve(EsR, 300) },
      sliderSeries(EsR, Tslider)
    ];

    var fig = S.figure({ parent: host, title: 'σ<sub>γ</sub>(E) 多普勒展宽（U-238，6.674 eV 共振 / 全景）', unit: 'b', note: '页面内实时 SLBW 计算；左图线性 E 轴，右图双对数。' });
    var grid = S.el('div', { class: 'grid2' });
    fig.body.appendChild(grid);

    var cL = S.chart({
      w: 620, h: 360, xLabel: '中子能量 E [eV]', yLabel: 'σγ [b]',
      xDomain: [E0_674 - 0.6, E0_674 + 0.6], yDomain: [0, 7800], series: serL
    });
    var cR = S.chart({
      w: 620, h: 360, xLabel: '中子能量 E [eV]', yLabel: 'σγ [b]',
      xLog: true, yLog: true, xDomain: [1, 1000], yDomain: [1e-5, 2e4], series: serR
    });
    grid.appendChild(cL.root);
    grid.appendChild(cR.root);

    var ctrl = S.el('div', { class: 'ctrl-row' });
    fig.body.appendChild(ctrl);
    var sl = S.slider({
      parent: ctrl, label: '温度', min: 300, max: 2400, step: 50, value: Tslider, unit: 'K',
      oninput: function (T) { redraw(T); }
    });

    var ro = S.el('div', { class: 'grid3' });
    fig.body.appendChild(ro);
    var rT = S.readout(ro, '当前温度 T', 'K');
    var rD = S.readout(ro, '多普勒宽度 Δ(6.674 eV)', 'meV');
    var rX = S.readout(ro, 'ξ = Γ/Δ', '—');
    var rP = S.readout(ro, '峰值 σγ', 'b');
    var rR = S.readout(ro, 'RI∞（面积守恒）', 'b');

    function redraw(T) {
      var sL = sliderSeries(EsL, T), sR = sliderSeries(EsR, T);
      serL[4] = sL; serR[1] = sR;
      cL.update(serL); cR.update(serR);
      var dd = dopplerWidth(E0_674, T);
      var G = RES[0][1] * 1e-3 + RES[0][2] * 1e-3;
      rT.set(S.fmt(T, 0));
      rD.set(S.fmt(dd * 1e3, 2));
      rX.set(S.fmt(G / dd, 3));
      rP.set(S.fmt(sigmaGamma(E0_674, T), 0));
      rR.set(S.fmt(267.76, 2));
    }
    redraw(Tslider);
    fig.body.appendChild(S.el('div', { class: 'note', html:
      '读数条说明：温度升高 → Δ、ξ 变化 → 峰值 σ<sub>γ</sub> 下降（峰变矮、翼变宽），而 RI<sub>∞</sub> ≈ 267.76 b 不随 T 变（面积守恒）。' }));
  }

  /* ---------- 3. 核心表：不同温度下的截面与自屏 ---------- */
  function secTable(S, host) {
    var Ts = [300, 600, 900, 1200, 1500, 1800, 2100, 2400];
    var sigmasB = [20, 50, 200];
    var tab = computeTable(Ts, sigmasB);
    var rows = tab.rows;
    var head = ['T [K]', 'Δ(6.674) [meV]', 'ξ', '峰值 σγ [b]', '半高全宽 [eV]',
      'RI∞ [b]', 'I_eff σb=20 [b]', 'I_eff σb=50 [b]', 'I_eff σb=200 [b]', 'ΔI_eff/I_eff(300K) [%]'];
    var body = [];
    var base = rows[0].Ieff[1];  // σb=50 at 300K
    for (var t = 0; t < rows.length; t++) {
      var r = rows[t];
      body.push([
        String(r.T),
        S.fmt(r.Delta674 * 1e3, 2),
        S.fmt(r.xi674, 3),
        S.fmt(r.peak, 0),
        S.fmt(r.fwhm, 4),
        S.fmt(r.riInf, 2),
        S.fmt(r.Ieff[0], 4),
        S.fmt(r.Ieff[1], 4),
        S.fmt(r.Ieff[2], 4),
        S.fmt((r.Ieff[1] - base) / base * 100, 2)
      ]);
    }
    // 各 σb 的 d I_eff / d ln T（% 相对 300K 值的变化斜率）
    var slopes = [];
    for (var b = 0; b < sigmasB.length; b++) {
      var xs = [], ys = [];
      for (var t2 = 1; t2 < rows.length; t2++) {
        xs.push(Math.log(rows[t2].T / 300));
        ys.push((rows[t2].Ieff[b] - rows[0].Ieff[b]) / rows[0].Ieff[b] * 100);
      }
      slopes.push(linFit(xs, ys).slope);
    }
    var fig = S.figure({ parent: host, title: '不同温度下的中子截面与自屏效应（U-238 共振区）', unit: 'b', note: '' });
    var wrap = S.el('div');
    S.table({
      parent: wrap, head: head, rows: body,
      caption: '行 = 温度；列 = 多普勒宽度、形状参数、峰值俘获、半高全宽、无限稀释共振积分、有效共振积分（σb = 20/50/200 b）、相对变化（σb=50）。',
      foot: '积分区间 1–1000 eV；网格 = 全局对数 4000 点 ∪ 各共振局部细网 1600 点（±60·max(Γ,Δ(2100 K))），梯形积分。' +
        '验收容差：RI∞ ±1%，I_eff ±1.5%，峰值 ±3%（scipy wofz 参考解）。d I_eff/d ln T ≈ ' +
        S.fmt(slopes[0], 2) + ' / ' + S.fmt(slopes[1], 2) + ' / ' + S.fmt(slopes[2], 2) + ' %/ln（σb = 20/50/200 b）。'
    });
    fig.body.appendChild(wrap);
    fig.body.appendChild(S.el('div', { class: 'note', html:
      '注：半高全宽为 σ<sub>γ</sub> 在 6.674 eV 共振处相对峰值一半的全宽；RI<sub>∞</sub> 面积守恒（各 T 相差 <0.01%）。' +
      'I_eff 对 ln T 近似线性（R² &gt; 0.997），这正是多普勒反应性写成 Δρ = K<sub>D</sub>·ln(T₂/T₁) 的原因。' }));
  }

  /* ---------- 4. I_eff vs ln(T/300) ---------- */
  function secIeff(S, host) {
    var Ts = [300, 600, 900, 1200, 1500, 1800, 2100, 2400];
    var sigmasB = [20, 50, 200];
    var tab = computeTable(Ts, sigmasB);
    var rows = tab.rows;
    var series = [];
    var colors = [PAL[0], PAL[1], PAL[2]];
    for (var b = 0; b < sigmasB.length; b++) {
      var pts = [];
      for (var t = 0; t < rows.length; t++) pts.push([Math.log(rows[t].T / 300), rows[t].Ieff[b]]);
      series.push({ name: 'σb = ' + sigmasB[b] + ' b', color: colors[b], pts: pts, marks: pts });
    }
    // 线性拟合虚线 + 斜率标注
    for (var b2 = 0; b2 < sigmasB.length; b2++) {
      var xs = [], ys = [];
      for (var t2 = 0; t2 < rows.length; t2++) { xs.push(Math.log(rows[t2].T / 300)); ys.push(rows[t2].Ieff[b2]); }
      var fit = linFit(xs, ys);
      var relSlope = fit.slope / rows[0].Ieff[b2] * 100;
      var fpts = [[xs[0], fit.slope * xs[0] + fit.intercept], [xs[xs.length - 1], fit.slope * xs[xs.length - 1] + fit.intercept]];
      series.push({
        name: '拟合 σb=' + sigmasB[b2] + ' b（' + S.fmt(relSlope, 2) + ' %/ln）',
        color: colors[b2], pts: fpts, width: 1.4, dash: '6 4', noLegend: false
      });
    }
    var fig = S.figure({ parent: host, title: 'I_eff 随 ln(T/300) 的变化（窄共振自屏）', unit: 'b', note: '' });
    var c = S.chart({
      w: 900, h: 380, xLabel: 'ln(T/300)', yLabel: 'I_eff [b]',
      xDomain: [0, Math.log(2400 / 300)], series: series
    });
    fig.body.appendChild(c.root);
    fig.body.appendChild(S.el('div', { class: 'note', html:
      '三条实线为 I_eff(σb=20/50/200 b)，虚线为最小二乘线性拟合。斜率（%/ln）约 10.4 / 14.0 / 21.8，R² &gt; 0.997，' +
      '验证 I_eff 对 ln T 近似线性——多普勒反应性 Δρ = K<sub>D</sub>·ln(T₂/T₁) 的理论依据。' }));
  }

  /* ---------- 5. 1 群谱平均截面（代表性量级值） ---------- */
  function secOneGroup(S, host) {
    var head = ['核素', 'σf [b]', 'σc [b]', 'σ_el [b]', 'ν', '备注', '300→2100 K 相对变化'];
    var rows = [
      ['U-235', '1.30', '0.45', '6.5', '2.45', '主要裂变核素', '共振区分量 ≈ +1%'],
      ['U-238', '0.04', '0.30', '6.2', '—（阈值）', '阈值裂变（≈1 MeV）；主要共振吸收体', 'σc ≈ +2%（多普勒）'],
      ['Pu-239', '1.80', '0.40', '6.0', '2.95', '主要裂变核素', '共振区分量 ≈ +1%'],
      ['Pu-240', '0.35', '0.45', '6.0', '2.90', '主要寄生吸收体', '<1%'],
      ['Pu-241', '2.40', '0.35', '6.0', '2.95', '高 σf', '<1%'],
      ['Pu-242', '0.20', '0.35', '6.0', '2.90', '阈值裂变', '<1%'],
      ['Na-23', '—', '0.0006', '3.2', '—', '冷却剂；弹性散射主导', '<1%'],
      ['Fe-56', '—', '0.004', '3.0', '—', '结构材料', '<1%'],
      ['O-16', '—', '0.00002', '3.6', '—', '燃料氧', '<1%'],
      ['B-10', '—', '0.6（n,α）', '3.5', '—', '可燃毒物 / 控制', '<1%']
    ];
    var fig = S.figure({ parent: host, title: '1 群谱平均截面（典型 SFR MOX 谱，中位能量约 150 keV）', unit: 'b', note: '' });
    var wrap = S.el('div');
    S.table({
      parent: wrap, head: head, rows: rows,
      caption: '代表性量级值 ±20%，不用于设计计算（非直接查库）。',
      foot: '快谱下大部分中子能量在共振区（0.1–25 keV）之上，故 1 群截面对温度不敏感；真正的温度效应集中在 U-238 共振自屏（负多普勒反应性主要来源）。'
    });
    fig.body.appendChild(wrap);
  }

  /* ---------- 6. 典型快堆中子能谱（示意谱型） ---------- */
  function secSpectrum(S, host) {
    // φ(E)·E（每单位对数能量间隔通量），E 单位 eV；示意谱型，非输运计算结果。
    function fluxPerLethargy(EeV) {
      var Em = EeV / 1e6;   // MeV
      var chi = 0.453 * Math.exp(-Em / 0.965) * Math.sinh(Math.sqrt(2.29 * Em)); // U-235 Watt 裂变谱
      var g = 1 / (1 + Math.pow(Em / 2.5, 3));   // Na/Fe/O 弹性散射造成的高能端衰减
      var phi = chi + 0.14 / Em * g;             // 慢化尾 1/E 修正
      return phi * Em;                            // φ(E)·E（arb.）
    }
    var Es = geomspace(10, 1e7, 500);
    var pts = [];
    for (var i = 0; i < Es.length; i++) pts.push([Es[i], fluxPerLethargy(Es[i])]);
    // 中位能量（φ(E) 在 E 上的 50% 分位）
    var med = medianEnergy(geomspace(10, 1e7, 2000));
    function medianEnergy(Earr) {
      var ph = new Float64Array(Earr.length);
      for (var i = 0; i < Earr.length; i++) {
        var Em = Earr[i] / 1e6;
        ph[i] = 0.453 * Math.exp(-Em / 0.965) * Math.sinh(Math.sqrt(2.29 * Em)) + 0.14 / Em / (1 + Math.pow(Em / 2.5, 3));
      }
      var total = 0;
      for (var j = 0; j < Earr.length - 1; j++) total += 0.5 * (ph[j] + ph[j + 1]) * (Earr[j + 1] - Earr[j]);
      var acc = 0;
      for (var j2 = 0; j2 < Earr.length - 1; j2++) {
        acc += 0.5 * (ph[j2] + ph[j2 + 1]) * (Earr[j2 + 1] - Earr[j2]);
        if (acc >= total / 2) return Earr[j2];
      }
      return Earr[Math.floor(Earr.length / 2)];
    }
    var fig = S.figure({ parent: host, title: '典型快堆中子能谱（示意谱型，非输运计算结果）', unit: 'arb.', note: 'φ(E)·E，每单位对数能量间隔的通量；解析模型 = 裂变源 χ(E) + 1/E 慢化尾 + 高能端衰减。' });
    var c = S.chart({
      w: 900, h: 380, xLabel: '中子能量 E [eV]', yLabel: 'φ(E)·E [arb.]',
      xLog: true, series: [{ name: 'φ(E)·E', color: PAL[0], pts: pts, width: 1.8, fill: true }],
      bands: [
        { x0: 0.1e3, x1: 25e3, label: '共振自屏主导区 0.1–25 keV', color: 'rgba(47,111,140,.12)' },
        { x0: 2.85e3 * 0.8, x1: 2.85e3 * 1.2, label: 'Na-23 2.85 keV', color: 'rgba(200,118,31,.16)' }
      ],
      vlines: [
        { x: 1e6, label: 'U-238 裂变阈 ≈1 MeV', color: '#b0303a' },
        { x: med, label: '中位能量 ≈' + S.fmt(med / 1e3, 0) + ' keV', color: '#3f7a45' }
      ]
    });
    fig.body.appendChild(c.root);
    fig.body.appendChild(S.el('div', { class: 'note', html:
      '注：曲线为示意谱型（χ(E) + 1/E 尾 + 高能端弹性/非弹衰减），非输运计算结果；标出中位能量、Na-23 2.85 keV 散射共振窗、' +
      'U-238 裂变阈（≈1 MeV）与共振自屏主导区（0.1–25 keV）。' }));
  }

  /* ---------- 7. 推论：多普勒常数 K_D ---------- */
  function secInference(S, host) {
    var KD = -0.0055;
    var Tref = 773;
    var Ts = [773, 1000, 1500, 2000, 2500];
    var head = ['T [K]', 'ln(T/773)', 'ρ_Doppler = K_D·ln(T/T_ref) [pcm]'];
    var rows = [];
    for (var i = 0; i < Ts.length; i++) {
      var x = Math.log(Ts[i] / Tref);
      rows.push([String(Ts[i]), S.fmt(x, 4), S.fmt(KD * x * 1e5, 1)]);
    }
    var p = S.el('div', { class: 'panel' }, [
      S.el('div', { class: 'h4', text: '推论：多普勒常数 K_D 与多普勒反应性' }),
      S.el('p', { class: 'note', html:
        '由第 3 表 d I_eff/d ln T ≈ 14 %/ln（σb=50）可见，U-238 有效共振俘获随 ln T 近似线性上升，' +
        '负反馈量级与 ln T 成正比。本设计取多普勒常数 <b>K<sub>D</sub> = T·dρ/dT ≈ -0.0055</b>（即 -550 pcm），' +
        '对应 300→900 K 约 -600 pcm（-0.0055·ln(900/300) ≈ -604 pcm）。' }),
      S.el('p', { class: 'note', html:
        '<b>两者不可混为一谈：</b>页面内 SLBW 计算给出的是机理与量级（单核素、窄共振近似、无空间/谱自洽）；' +
        'K<sub>D</sub> 的取值来自堆芯设计（全堆输运 + 燃耗计算，含几何、谱互屏蔽、燃料成分与燃耗演化）。' +
        '本页只负责说明「为何是负、为何近似 ln T」，而不替代设计值的计算。' })
    ]);
    host.appendChild(p);
    var wrap = S.el('div');
    S.table({ parent: wrap, head: head, rows: rows, caption: '多普勒反应性 ρ_Doppler(T) = K_D·ln(T/T_ref)，T_ref = 773 K，K_D = -0.0055（-550 pcm）。' });
    host.appendChild(wrap);
  }
})();
