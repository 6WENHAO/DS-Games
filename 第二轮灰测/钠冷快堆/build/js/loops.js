/* ============================================================================
   第 2 / 3 章：一回路（池式）与二回路系统图 + 流动动画 + 热平衡联动
   ==========================================================================*/
(function () {
  'use strict';
  var S = window.SFR, el = S.el, sv = S.svg;

  /* ---------- 液钠物性（拟合公开数据，T in °C） ---------- */
  function rhoNa(T) { return 951.3 - 0.2429 * T; }                            // kg/m3
  function cpNa(T) { return 1436.7 - 0.5806 * T + 4.627e-4 * T * T; }         // J/kg/K
  function kNa(T) { return 92.95 - 5.809e-2 * T + 1.173e-5 * T * T; }         // W/m/K
  function muNa(T) { return 1e-3 * Math.exp(-6.4406 - 0.3958 * Math.log(T + 273.15) + 556.835 / (T + 273.15)); }
  var TBOIL = 883;                                                            // °C @ 0.1 MPa

  /* ---------- 设计基准点 ---------- */
  var D = {
    P0: 1500e6, Tin: 395, Tout: 545, cpRef: 1270, w1: 7874,
    T2i: 320, T2o: 505, w2: 6320, nLoop: 3, nIHX: 6, nPump: 3,
    dPcore: 0.450, dPplen: 0.060, dPpipe: 0.120, dPihx: 0.006, dPsuct: 0.020, dPwin: 0.002,
    etaPump: 0.79, steam: 658, pSteam: 14.0, Tsteam: 490, Tfeed: 240,
    Aihx: 900, Uihx: 5000, Asg: 2900, Usg: 4500, etaGross: 0.405, aux: 32e6
  };
  D.dPtot = D.dPcore + D.dPplen + D.dPpipe + D.dPihx + D.dPsuct + D.dPwin;

  /* 衰变热（停堆后 t 秒，占额定份额）— 分段对数插值 */
  var DECAY = [[1, .060], [10, .045], [30, .036], [100, .030], [300, .0215], [1e3, .0155],
    [3.6e3, .0105], [1e4, .0073], [8.64e4, .0045], [6.048e5, .0023], [2.592e6, .0013], [5.184e6, .0010]];
  function decay(t) {
    t = Math.max(1, t);
    for (var i = 1; i < DECAY.length; i++) {
      if (t <= DECAY[i][0]) {
        var f = Math.log(t / DECAY[i - 1][0]) / Math.log(DECAY[i][0] / DECAY[i - 1][0]);
        return DECAY[i - 1][1] * Math.pow(DECAY[i][1] / DECAY[i - 1][1], f);
      }
    }
    return DECAY[DECAY.length - 1][1];
  }

  /* ---------- 全厂工况求解（准静态） ---------- */
  var PLANT = { pf: 1.0, mode: 'normal', tTrip: 3600 };
  var subs = [];
  function fire() { subs.forEach(function (f) { try { f(compute()); } catch (e) { console.error(e); } }); }

  function compute() {
    var s = {}, pf, ff;
    if (PLANT.mode === 'normal') {
      pf = PLANT.pf;
      ff = Math.max(0.35, pf);                 // 流量随功率调节，下限 35%
      s.label = '正常运行 ' + Math.round(pf * 100) + '% FP';
    } else {
      pf = decay(PLANT.tTrip);
      ff = 0.08;                               // 自然循环流量份额
      s.label = '停堆后 ' + fmtT(PLANT.tTrip) + '（自然循环）';
    }
    s.pf = pf; s.ff = ff;
    s.P = D.P0 * pf;
    s.w1 = D.w1 * ff;
    s.Tin = D.Tin;
    var cp = cpNa((D.Tin + D.Tout) / 2);
    s.dT = s.P / (s.w1 * cp);
    s.Tout = s.Tin + s.dT;
    s.Tavg = (s.Tin + s.Tout) / 2;
    s.rho = rhoNa(s.Tavg);
    s.vel = s.w1 / (1.4205 * s.rho);
    s.Q1 = s.w1 / s.rho;
    /* 泵：ΔP ∝ w²  */
    s.dP = D.dPtot * ff * ff;
    s.pumpHyd = PLANT.mode === 'normal' ? s.dP * 1e6 * s.Q1 : 0;
    s.pumpShaft = s.pumpHyd / D.etaPump;
    s.dLevel = (D.dPihx + D.dPwin) * ff * ff * 1e6 / (rhoNa(s.Tout) * 9.81);
    /* 二回路：保持 IHX 端差比例，二次侧流量同比例 */
    s.w2 = D.w2 * ff;
    s.T2i = D.T2i; s.dT2 = s.P / (s.w2 * cpNa((D.T2i + D.T2o) / 2)); s.T2o = s.T2i + s.dT2;
    /* IHX 对数平均温差与需求面积核算 */
    var d1 = s.Tout - s.T2o, d2 = s.Tin - s.T2i;
    s.lmtdIHX = (Math.abs(d1 - d2) < 1e-6) ? d1 : (d1 - d2) / Math.log(d1 / d2);
    s.Aneed = s.P / D.nIHX / (D.Uihx * Math.max(1, s.lmtdIHX));
    /* 三回路 */
    s.steam = D.steam * pf;
    s.Pe = PLANT.mode === 'normal' ? (s.P * D.etaGross - D.aux * (0.45 + 0.55 * pf)) : 0;
    s.margin = TBOIL - (s.Tout + 45);          // 峰值通道比混合平均高约 45 K
    return s;
  }
  function fmtT(t) {
    if (t < 60) return t.toFixed(0) + ' s';
    if (t < 3600) return (t / 60).toFixed(0) + ' min';
    if (t < 86400) return (t / 3600).toFixed(1) + ' h';
    return (t / 86400).toFixed(1) + ' d';
  }

  /* ---------- 粒子流动画（沿 SVG 路径） ---------- */
  var ANIM = { legs: [], last: 0, running: false, reduce: false };
  try { ANIM.reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { }

  function makeLeg(g, d, opt) {
    var p = sv('path', { d: d, fill: 'none', stroke: opt.guide || 'none', 'stroke-width': opt.gw || 1 });
    g.appendChild(p);
    var len = p.getTotalLength ? p.getTotalLength() : 0;
    var n = Math.max(2, Math.round(len / (opt.gap || 26)));
    var leg = { path: p, len: len, dots: [], t0: opt.t0, t1: opt.t1, vref: opt.v || 1, r: opt.r || 2.6, kind: opt.kind || 'na' };
    for (var i = 0; i < n; i++) {
      var c = sv('circle', { r: leg.r, cx: -99, cy: -99 });
      g.appendChild(c);
      leg.dots.push({ node: c, s: len * i / n });
    }
    ANIM.legs.push(leg);
    return leg;
  }
  function paintLegs(st) {
    ANIM.legs.forEach(function (L) {
      L.dots.forEach(function (dt) {
        var f = L.len ? dt.s / L.len : 0;
        var T = S.lerp(L.t0(st), L.t1(st), f);
        dt.node.setAttribute('fill', L.kind === 'steam' ? (T > 200 ? '#e8eef4' : '#8fb3cc') : S.colorT(T));
        dt.node.setAttribute('opacity', L.kind === 'steam' ? 0.95 : 0.92);
      });
    });
  }
  function tick(ts) {
    if (!ANIM.running) return;
    var dt = Math.min(0.05, (ts - ANIM.last) / 1000 || 0.016);
    ANIM.last = ts;
    var st = ANIM.state || compute();
    var spd = st.ff;
    ANIM.legs.forEach(function (L) {
      var v = L.vref * spd * 62 * (L.kind === 'steam' ? 1.5 * st.pf / Math.max(.2, st.ff) : 1);
      L.dots.forEach(function (d) {
        d.s = (d.s + v * dt) % L.len;
        if (!L.path.getPointAtLength) return; var pt = L.path.getPointAtLength(d.s);
        d.node.setAttribute('cx', pt.x.toFixed(1));
        d.node.setAttribute('cy', pt.y.toFixed(1));
      });
    });
    requestAnimationFrame(tick);
  }
  function startAnim() {
    if (ANIM.running || ANIM.reduce) { if (ANIM.reduce) staticPos(); return; }
    ANIM.running = true; ANIM.last = performance.now(); requestAnimationFrame(tick);
  }
  function staticPos() {
    ANIM.legs.forEach(function (L) {
      L.dots.forEach(function (d) { if (!L.path.getPointAtLength) return; var pt = L.path.getPointAtLength(d.s); d.node.setAttribute('cx', pt.x.toFixed(1)); d.node.setAttribute('cy', pt.y.toFixed(1)); });
    });
  }
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { ANIM.running = false; } else { startAnim(); }
  });

  /* ---------- 通用绘图小工具 ---------- */
  function hatch(id, defs, color, sp, ang) {
    var p = sv('pattern', { id: id, width: sp, height: sp, patternTransform: 'rotate(' + ang + ')', patternUnits: 'userSpaceOnUse' });
    p.appendChild(sv('line', { x1: 0, y1: 0, x2: 0, y2: sp, stroke: color, 'stroke-width': 1 }));
    defs.appendChild(p);
    return 'url(#' + id + ')';
  }
  function lab(g, x, y, txt, cls, anchor) {
    g.appendChild(sv('text', { x: x, y: y, class: 'dw-lab ' + (cls || ''), 'text-anchor': anchor || 'start', text: txt }));
  }
  function leader(g, x1, y1, x2, y2) {
    g.appendChild(sv('path', { d: 'M' + x1 + ' ' + y1 + 'L' + x2 + ' ' + y2, stroke: '#7d8b98', 'stroke-width': .7, fill: 'none' }));
    g.appendChild(sv('circle', { cx: x1, cy: y1, r: 1.6, fill: '#7d8b98' }));
  }
  function dim(g, x1, y1, x2, y2, txt, off) {
    g.appendChild(sv('path', { d: 'M' + x1 + ' ' + y1 + 'L' + x2 + ' ' + y2, stroke: '#c8761f', 'stroke-width': .8, 'marker-start': 'url(#ar1)', 'marker-end': 'url(#ar1)', fill: 'none' }));
    var mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    g.appendChild(sv('text', { x: mx + (off ? off[0] : 4), y: my + (off ? off[1] : -3), class: 'dw-dim', text: txt }));
  }
  function style(root) {
    root.appendChild(sv('style', {
      text: '.dw-lab{font:9.6px ui-monospace,monospace;fill:#aab6c2}.dw-lab.k{fill:#fff;font-weight:600}' +
        '.dw-lab.t{fill:#e8a33d}.dw-dim{font:9px ui-monospace,monospace;fill:#c8761f}' +
        '.dw-lab.s{font-size:8.6px;fill:#7d8b98}'
    }));
  }
  function arrowDefs(defs) {
    var m = sv('marker', { id: 'ar1', viewBox: '0 0 8 8', refX: 4, refY: 4, markerWidth: 5, markerHeight: 5, orient: 'auto' });
    m.appendChild(sv('path', { d: 'M0 1L6 4L0 7z', fill: '#c8761f' })); defs.appendChild(m);
    var m2 = sv('marker', { id: 'ar2', viewBox: '0 0 8 8', refX: 5, refY: 4, markerWidth: 6, markerHeight: 6, orient: 'auto' });
    m2.appendChild(sv('path', { d: 'M0 1L7 4L0 7z', fill: '#9aa7b4' })); defs.appendChild(m2);
  }

  /* ==========================================================================
     一回路：纵剖面
     ========================================================================*/
  function mountPrimary(host) {
    var fig = S.figure({
      parent: host, title: '一回路池式布置纵剖面与钠流程（示 2/6 台 IHX、2/3 台主泵、1/4 台 DHX）',
      drawNo: 'CFR1500-P-101', scale: '1 : 40（页内 40 px/m）', unit: 'm',
      bodyCls: 'dark',
      note: '流线颜色按局部钠温着色（图例见下）；粒子速度与流量成正比。<b>热池液位高于冷池 1.0 m</b>，该液位差正是驱动热池钠经 IHX 返回冷池的全部水头，因此 IHX 一次侧压降被限制在 8 kPa 量级。冷池钠温 395 °C 使主容器壁与栅板长期处于低温区，蠕变不控制设计。'
    });
    var W = 900, H = 640, root = sv('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'dwg' });
    fig.body.appendChild(root);
    style(root);
    var defs = sv('defs'); root.appendChild(defs); arrowDefs(defs);
    var hConc = hatch('hc', defs, '#3c4550', 5, 45), hSteel = hatch('hs', defs, '#4a5560', 4, -45);

    var SC = 40, AX = 450, Y0 = 600;
    function X(r) { return AX + SC * r; }
    function Y(z) { return Y0 - SC * z; }
    function box(g, r1, z1, r2, z2, a) {
      var o = { x: X(r1), y: Y(z2), width: SC * (r2 - r1), height: SC * (z2 - z1) };
      for (var k in (a || {})) o[k] = a[k];
      var e = sv('rect', o); g.appendChild(e); return e;
    }
    var gBack = sv('g'), gNa = sv('g'), gStruct = sv('g'), gFlow = sv('g'), gLab = sv('g');
    [gBack, gNa, gStruct, gFlow, gLab].forEach(function (g) { root.appendChild(g); });

    /* --- 混凝土与楼板 --- */
    gBack.appendChild(sv('path', { d: 'M40 ' + Y(12.4) + 'H' + X(-7.6) + 'V' + Y(-1.2) + 'H40Z', fill: hConc, stroke: '#3c4550' }));
    gBack.appendChild(sv('path', { d: 'M860 ' + Y(12.4) + 'H' + X(7.6) + 'V' + Y(-1.2) + 'H860Z', fill: hConc, stroke: '#3c4550' }));
    box(gBack, -7.6, 12.4, 7.6, 14.0, { fill: '#2b333c', stroke: '#4a5560' });                 // 楼板
    box(gBack, -3.0, 12.4, 3.0, 13.95, { fill: '#333c46', stroke: '#5b6875' });                // 大旋塞
    box(gBack, -0.48, 12.4, 2.72, 13.95, { fill: '#3d4854', stroke: '#6d7b88' });              // 小旋塞
    lab(gLab, X(0), Y(13.1) + 4, '大旋塞 Φ6.0 m', 'k', 'middle');
    lab(gLab, X(1.12), Y(12.72) + 3, '小旋塞 Φ3.2', 's', 'middle');
    lab(gLab, X(-6.0), Y(13.2), '楼板（屏蔽 + 支承）', 's');

    /* --- 保护容器 / 主容器 --- */
    gStruct.appendChild(sv('path', {
      d: 'M' + X(-6.7) + ' ' + Y(12.2) + 'V' + Y(1.0) + 'Q' + X(0) + ' ' + (Y(1.0) + 96) + ' ' + X(6.7) + ' ' + Y(1.0) + 'V' + Y(12.2),
      fill: 'none', stroke: '#7b8894', 'stroke-width': 2.4
    }));
    gStruct.appendChild(sv('path', {
      d: 'M' + X(-6.3) + ' ' + Y(12.4) + 'V' + Y(1.0) + 'Q' + X(0) + ' ' + (Y(1.0) + 80) + ' ' + X(6.3) + ' ' + Y(1.0) + 'V' + Y(12.4),
      fill: 'none', stroke: '#cfd8e0', 'stroke-width': 3
    }));
    lab(gLab, X(-6.9), Y(11.0), '保护容器', 's', 'end'); leader(gLab, X(-6.7), Y(11.2), X(-6.95), Y(11.05));
    lab(gLab, X(6.55), Y(11.6), '主容器 316LN', 'k'); lab(gLab, X(6.55), Y(11.2), 'Φ12.6 × 14.2 m, δ50', 's');

    /* --- 钠池（冷池 / 热池） --- */
    var zCold = 10.2, zHot = 11.2, zRoofB = 12.4;
    gNa.appendChild(sv('path', {   // 冷池：整个容器内 (至冷池液位)
      d: 'M' + X(-6.3) + ' ' + Y(zCold) + 'V' + Y(1.0) + 'Q' + X(0) + ' ' + (Y(1.0) + 80) + ' ' + X(6.3) + ' ' + Y(1.0) + 'V' + Y(zCold) + 'Z',
      fill: 'rgba(58,92,140,.42)'
    }));
    gNa.appendChild(sv('path', {   // 热池：隔板以内、堆芯以上
      d: 'M' + X(-4.6) + ' ' + Y(zHot) + 'V' + Y(1.9) + 'H' + X(4.6) + 'V' + Y(zHot) + 'Z',
      fill: 'rgba(200,90,45,.30)'
    }));
    gNa.appendChild(sv('line', { x1: X(-4.6), y1: Y(zHot), x2: X(4.6), y2: Y(zHot), stroke: '#e07a3a', 'stroke-width': 2 }));
    gNa.appendChild(sv('line', { x1: X(-6.3), y1: Y(zCold), x2: X(-4.6), y2: Y(zCold), stroke: '#5b8fc9', 'stroke-width': 2 }));
    gNa.appendChild(sv('line', { x1: X(4.6), y1: Y(zCold), x2: X(6.3), y2: Y(zCold), stroke: '#5b8fc9', 'stroke-width': 2 }));
    lab(gLab, X(0), Y(zHot) - 7, '热池 545 °C', 't', 'middle');
    lab(gLab, X(5.45), Y(zCold) - 7, '冷池 395 °C', 'k', 'middle');
    dim(gLab, X(-5.5), Y(zCold), X(-5.5), Y(zHot), 'Δh = 1.0 m', [-72, 4]);
    lab(gLab, X(0), Y(11.85), '覆盖气体 Ar  +20 kPa(g)', 's', 'middle');

    /* --- 隔板 redan --- */
    ['-', '+'].forEach(function (sgn) {
      var s2 = sgn === '-' ? -1 : 1;
      gStruct.appendChild(sv('path', {
        d: 'M' + X(s2 * 4.6) + ' ' + Y(11.8) + 'V' + Y(1.9) + 'L' + X(s2 * 3.0) + ' ' + Y(1.35),
        fill: 'none', stroke: '#9aa7b4', 'stroke-width': 2.6
      }));
    });
    lab(gLab, X(4.75), Y(6.6), '隔板 redan', 's');

    /* --- 堆芯与支承 --- */
    box(gStruct, -3.0, 0.6, 3.0, 1.2, { fill: 'rgba(58,92,140,.55)', stroke: '#8fa8c4' });   // 高压腔室
    lab(gLab, X(0), Y(0.85) + 3, '高压腔室（入口联箱）', 'k', 'middle');
    box(gStruct, -3.0, 1.2, 3.0, 1.4, { fill: '#4a5560', stroke: '#9aa7b4' });               // 栅板
    lab(gLab, X(-3.15), Y(1.28) + 3, '支承栅板', 's', 'end');
    var gCore = sv('g'); gStruct.appendChild(gCore);
    for (var i = -16; i <= 16; i++) {
      var rr = i * 0.157;
      if (Math.abs(rr) > 2.55) continue;
      gCore.appendChild(sv('rect', { x: X(rr) - 2.4, y: Y(5.0), width: 4.8, height: SC * 3.6, fill: '#2a323b', stroke: '#4a5560', 'stroke-width': .5 }));
      gCore.appendChild(sv('rect', { x: X(rr) - 2.4, y: Y(2.60), width: 4.8, height: SC * 0.95, fill: '#7a3320' }));     // 活性区
      gCore.appendChild(sv('rect', { x: X(rr) - 2.4, y: Y(2.85), width: 4.8, height: SC * 0.25, fill: '#3b4a5c' }));     // 钠腔
      gCore.appendChild(sv('rect', { x: X(rr) - 2.4, y: Y(2.95), width: 4.8, height: SC * 0.10, fill: '#4c4030' }));     // B4C
    }
    lab(gLab, X(-2.7), Y(2.1), '活性区 950', 't', 'end'); leader(gLab, X(-2.5), Y(2.1), X(-2.72), Y(2.1));
    lab(gLab, X(-2.7), Y(2.98), '钠腔 250 + B₄C 100', 's', 'end'); leader(gLab, X(-2.5), Y(2.95), X(-2.72), Y(2.96));
    lab(gLab, X(2.72), Y(4.3), '气腔 900', 's'); lab(gLab, X(2.72), Y(4.75), '组件全高 3 600', 's');
    box(gStruct, -2.8, 5.2, 2.8, 7.2, { fill: 'rgba(74,85,96,.5)', stroke: '#8fa0b0', 'stroke-dasharray': '4 2' });
    lab(gLab, X(0), Y(6.1), '上部堆内构件 UIS', 'k', 'middle');
    lab(gLab, X(0), Y(5.6), '252 支出口热电偶 / 棒导向管', 's', 'middle');
    for (var q = -2; q <= 2; q++) {
      gStruct.appendChild(sv('line', { x1: X(q * 1.1), y1: Y(7.2), x2: X(q * 1.1), y2: Y(12.4), stroke: '#5b6875', 'stroke-width': 2 }));
    }
    lab(gLab, X(-1.05), Y(9.6), '控制棒驱动线', 's', 'end');

    /* --- IHX ×2 --- */
    [-3.6, 3.6].forEach(function (rc) {
      box(gStruct, rc - .7, 5.4, rc + .7, 10.4, { fill: '#1c2530', stroke: '#9aa7b4', 'stroke-width': 1.6 });
      for (var k = 0; k < 9; k++) box(gStruct, rc - .58 + k * 0.145, 5.9, rc - .53 + k * 0.145, 10.0, { fill: '#39424d' });
      box(gStruct, rc - .7, 10.0, rc + .7, 10.35, { fill: '#5a3020', stroke: '#9aa7b4' });     // 入口窗
      box(gStruct, rc - .7, 5.4, rc + .7, 5.75, { fill: '#23364a', stroke: '#9aa7b4' });       // 出口
      // 二次侧管
      gStruct.appendChild(sv('path', { d: 'M' + X(rc) + ' ' + Y(12.4) + 'V' + Y(10.6), stroke: '#c8761f', 'stroke-width': 3.4, fill: 'none' }));
      gStruct.appendChild(sv('path', { d: 'M' + X(rc + .45) + ' ' + Y(12.4) + 'V' + Y(10.55), stroke: '#2f6f8c', 'stroke-width': 3.4, fill: 'none' }));
    });
    lab(gLab, X(-3.6), Y(7.9), 'IHX', 'k', 'middle'); lab(gLab, X(-3.6), Y(7.55), '250 MW', 's', 'middle');
    lab(gLab, X(-3.6), Y(10.55), '一次侧入口窗', 's', 'middle');
    lab(gLab, X(3.6), Y(5.15), '一次侧出口 → 冷池', 's', 'middle');
    lab(gLab, X(3.15), Y(12.62), '二次侧 505 °C 出', 't', 'middle');
    lab(gLab, X(4.4), Y(12.62), '320 °C 进', 'k', 'middle');

    /* --- 主泵 ×2 --- */
    [-5.6, 5.6].forEach(function (rc) {
      box(gStruct, rc - .55, 6.2, rc + .55, 12.4, { fill: '#1c2530', stroke: '#9aa7b4', 'stroke-width': 1.6 });
      gStruct.appendChild(sv('path', { d: 'M' + X(rc - .55) + ' ' + Y(6.6) + 'L' + X(rc - .8) + ' ' + Y(6.2) + 'H' + X(rc + .8) + 'L' + X(rc + .55) + ' ' + Y(6.6) + 'Z', fill: '#2a3540', stroke: '#9aa7b4' }));
      gStruct.appendChild(sv('circle', { cx: X(rc), cy: Y(7.0), r: 7, fill: 'none', stroke: '#c8761f', 'stroke-width': 1.6 }));
      // 压出管：下行 → 内折 → 高压腔室
      gStruct.appendChild(sv('path', {
        d: 'M' + X(rc + (rc > 0 ? .55 : -.55)) + ' ' + Y(7.6) + 'H' + X(rc + (rc > 0 ? 1.0 : -1.0)) + 'V' + Y(0.9) + 'H' + X(rc > 0 ? 3.0 : -3.0),
        fill: 'none', stroke: '#8fa0b0', 'stroke-width': 5
      }));
    });
    lab(gLab, X(-5.6), Y(11.0), '主泵', 'k', 'middle'); lab(gLab, X(-5.6), Y(10.65), '2 625 kg/s', 's', 'middle');
    lab(gLab, X(-5.6), Y(5.85), '吸入口', 's', 'middle');
    lab(gLab, X(-6.65), Y(2.4), '压出管 → 高压腔室', 's');

    /* --- DHX --- */
    box(gStruct, 4.05, 8.2, 4.5, 10.8, { fill: '#1c2530', stroke: '#57c46a', 'stroke-width': 1.4 });
    gStruct.appendChild(sv('path', { d: 'M' + X(4.28) + ' ' + Y(10.8) + 'V' + Y(12.4), stroke: '#57c46a', 'stroke-width': 2.6, fill: 'none' }));
    lab(gLab, X(4.62), Y(9.4), 'DHX 10 MW', 's'); lab(gLab, X(4.62), Y(9.05), '→ DRACS（7.2）', 's');

    /* --- 流线 --- */
    var fT = { in: function (s) { return s.Tin; }, out: function (s) { return s.Tout; } };
    var L = [];
    function push(d, o) { o.guide = o.guide || 'rgba(150,170,190,.16)'; o.gw = 3; L.push(makeLeg(gFlow, d, o)); }
    // 冷池下行 → 泵吸入
    [-1, 1].forEach(function (sg) {
      push('M' + X(sg * 5.95) + ' ' + Y(9.9) + 'V' + Y(6.45) + 'H' + X(sg * 5.6) + 'V' + Y(6.9), { t0: fT.in, t1: fT.in, v: 1.0, gap: 24 });
      push('M' + X(sg * 5.6) + ' ' + Y(7.15) + 'V' + Y(7.6) + 'H' + X(sg * 6.6) + 'V' + Y(0.9) + 'H' + X(sg * 3.05), { t0: fT.in, t1: fT.in, v: 1.6, gap: 26 });
    });
    // 高压腔室 → 堆芯（温度沿程上升）
    for (var c = -2; c <= 2; c++) {
      var rr2 = c * 1.15;
      push('M' + X(rr2) + ' ' + Y(0.75) + 'V' + Y(1.45),
        { t0: fT.in, t1: fT.in, v: 1.1, gap: 20 });
      push('M' + X(rr2) + ' ' + Y(1.45) + 'V' + Y(5.1),
        { t0: fT.in, t1: fT.out, v: 1.4, gap: 18, guide: 'rgba(220,120,60,.18)' });
    }
    // 堆芯出口 → 热池 → IHX 入口
    [[-3.6, -1], [3.6, 1]].forEach(function (p) {
      push('M' + X(p[0] * 0.30) + ' ' + Y(5.2) + 'V' + Y(10.6) + 'H' + X(p[0] - p[1] * 0.35) + 'V' + Y(10.15) + 'H' + X(p[0]) + 'V' + Y(9.9),
        { t0: fT.out, t1: fT.out, v: 1.0, gap: 26, guide: 'rgba(220,120,60,.16)' });
      // IHX 内下行（放热）
      push('M' + X(p[0]) + ' ' + Y(9.9) + 'V' + Y(5.65),
        { t0: fT.out, t1: fT.in, v: 0.85, gap: 17, guide: 'rgba(160,150,150,.14)' });
      // IHX 出口 → 冷池
      push('M' + X(p[0]) + ' ' + Y(5.55) + 'H' + X(p[0] + p[1] * 1.0) + 'V' + Y(9.2),
        { t0: fT.in, t1: fT.in, v: 1.0, gap: 24 });
      // 二次侧上升（逆流）
      push('M' + X(p[0] + .45) + ' ' + Y(12.2) + 'V' + Y(10.5) + 'H' + X(p[0] + .3) + 'V' + Y(5.9) + 'H' + X(p[0] - .3) + 'V' + Y(10.5) + 'H' + X(p[0]) + 'V' + Y(12.2),
        { t0: function (s) { return s.T2i; }, t1: function (s) { return s.T2o; }, v: 1.1, gap: 22, r: 2.2, guide: 'rgba(47,111,140,.20)' });
    });

    /* --- 图例 --- */
    var gl = sv('g'); root.appendChild(gl);
    [[150, '150'], [250, '250'], [320, '320'], [395, '395'], [470, '470'], [505, '505'], [545, '545'], [600, '600']].forEach(function (p, k) {
      gl.appendChild(sv('rect', { x: 44 + k * 30, y: 16, width: 30, height: 9, fill: S.colorT(p[0]) }));
      gl.appendChild(sv('text', { x: 44 + k * 30, y: 34, class: 'dw-lab s', text: p[1] }));
    });
    lab(gl, 44, 12, '钠温标尺 °C', 's');
    lab(gl, 290, 25, '橙 = 一回路（放射性 ²⁴Na）　蓝 = 二回路（非放射性）', 's');

    /* --- 控制台 --- */
    var con = el('div', { class: 'rf-console' });
    var cl = el('div'), cr = el('div', { class: 'panel-dark', style: { margin: '0' } });
    con.appendChild(cl); con.appendChild(cr);
    fig.body.appendChild(con);

    var row = el('div', { class: 'ctrl-row' });
    cl.appendChild(row);
    var bN = S.btn('正常运行', function () { PLANT.mode = 'normal'; syncBtn(); fire(); }, 'on');
    var bT = S.btn('主泵全停 · 自然循环', function () { PLANT.mode = 'nat'; syncBtn(); fire(); });
    row.appendChild(bN); row.appendChild(bT);
    function syncBtn() {
      bN.className = 'btn' + (PLANT.mode === 'normal' ? ' on' : '');
      bT.className = 'btn' + (PLANT.mode === 'nat' ? ' on' : '');
      slP.root.style.display = PLANT.mode === 'normal' ? '' : 'none';
      slD.root.style.display = PLANT.mode === 'normal' ? 'none' : '';
    }
    var slP = S.slider({
      parent: cl, label: '反应堆功率', min: 20, max: 100, step: 1, value: 100, unit: '% FP',
      oninput: function (v) { PLANT.pf = v / 100; fire(); }
    });
    var slD = S.slider({
      parent: cl, label: '停堆后时间（对数）', min: 0, max: 66, step: 1, value: 36,
      format: function (v) { return fmtT(Math.pow(10, v / 12)); },
      oninput: function (v) { PLANT.tTrip = Math.pow(10, v / 12); fire(); }
    });
    cl.appendChild(el('div', {
      class: 'note', html: '功率调节时流量按功率同步调节并保持 35% 下限（低功率段 ΔT 下降）；' +
        '自然循环工况取流量 8% 额定，功率为衰变热曲线值 —— 这是"泵全停 + 停堆成功"下钠池的实际状态。'
    }));

    cr.appendChild(el('div', { class: 'h4', text: '一回路运行参数' }));
    var R = {};
    ['工况', '堆芯功率', '一回路流量', '堆芯 ΔT', '出口钠温', '堆芯流速', '主泵扬程', '主泵轴功率(3台)',
      '热/冷池液位差', 'IHX 对数平均温差', 'IHX 需求面积/台', '二回路流量', '二回路出口', '主蒸汽流量',
      '发电机出力', '峰值通道沸腾裕量'].forEach(function (k) {
        R[k] = S.readout(cr, k, { '堆芯功率': 'MW', '一回路流量': 'kg/s', '堆芯 ΔT': 'K', '出口钠温': '°C', '堆芯流速': 'm/s', '主泵扬程': 'MPa', '主泵轴功率(3台)': 'MW', '热/冷池液位差': 'm', 'IHX 对数平均温差': 'K', 'IHX 需求面积/台': 'm²', '二回路流量': 'kg/s', '二回路出口': '°C', '主蒸汽流量': 'kg/s', '发电机出力': 'MW', '峰值通道沸腾裕量': 'K' }[k] || '');
      });

    function render(st) {
      ANIM.state = st;
      R['工况'].set(st.label);
      R['堆芯功率'].set(S.fmtG(st.P / 1e6, 0));
      R['一回路流量'].set(S.fmtG(st.w1, 0));
      R['堆芯 ΔT'].set(S.fmt(st.dT, 1));
      R['出口钠温'].set(S.fmt(st.Tout, 1), st.Tout > 600 ? 'warn' : 'ok');
      R['堆芯流速'].set(S.fmt(st.vel, 2));
      R['主泵扬程'].set(S.fmt(st.dP, 3));
      R['主泵轴功率(3台)'].set(S.fmt(st.pumpShaft / 1e6, 2));
      R['热/冷池液位差'].set(S.fmt(st.dLevel, 2));
      R['IHX 对数平均温差'].set(S.fmt(st.lmtdIHX, 1));
      R['IHX 需求面积/台'].set(S.fmtG(st.Aneed, 0), st.Aneed <= D.Aihx ? 'ok' : 'warn');
      R['二回路流量'].set(S.fmtG(st.w2, 0));
      R['二回路出口'].set(S.fmt(st.T2o, 1));
      R['主蒸汽流量'].set(S.fmt(st.steam, 1));
      R['发电机出力'].set(S.fmtG(st.Pe / 1e6, 0));
      R['峰值通道沸腾裕量'].set(S.fmt(st.margin, 0), st.margin > 200 ? 'ok' : st.margin > 80 ? 'warn' : 'bad');
      paintLegs(st);
      if (ANIM.reduce) staticPos();
    }
    subs.push(render);
    syncBtn();
    render(compute());
    startAnim();
  }

  /* ==========================================================================
     二回路 + 三回路：工艺流程图
     ========================================================================*/
  function mountSecondary(host) {
    var fig = S.figure({
      parent: host, title: '二回路（1/3 环路）与能量转换系统工艺流程图',
      drawNo: 'CFR1500-P-201', scale: '不按比例', unit: '—', bodyCls: 'dark',
      note: '每条环路含 2 台 IHX（图中合并表示）、1 台循环泵、1 台直流蒸汽发生器。<b>膨胀箱位于回路最高点</b>并用 Ar 加压，使 IHX 处二次侧静压高于一次侧，管束泄漏时钠由二次侧流向一次侧，放射性不外泄。钠水反应防护支路（爆破膜 → 反应产物排放箱）与氢检测点在图中以绿色标出。'
    });
    var W = 900, H = 470, root = sv('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'dwg' });
    fig.body.appendChild(root); style(root);
    var defs = sv('defs'); root.appendChild(defs); arrowDefs(defs);
    var gS = sv('g'), gF = sv('g'), gL = sv('g');
    root.appendChild(gS); root.appendChild(gF); root.appendChild(gL);

    function unit(x, y, w, h, t1, t2, fill) {
      gS.appendChild(sv('rect', { x: x, y: y, width: w, height: h, fill: fill || '#1c2530', stroke: '#9aa7b4', 'stroke-width': 1.6 }));
      lab(gL, x + w / 2, y + h / 2 - 2, t1, 'k', 'middle');
      if (t2) lab(gL, x + w / 2, y + h / 2 + 11, t2, 's', 'middle');
    }
    function pipe(d, col, w) { gS.appendChild(sv('path', { d: d, fill: 'none', stroke: col || '#5b6875', 'stroke-width': w || 4 })); }
    function pump(cx, cy, r, t) {
      gS.appendChild(sv('circle', { cx: cx, cy: cy, r: r, fill: '#232b34', stroke: '#9aa7b4', 'stroke-width': 1.6 }));
      gS.appendChild(sv('path', { d: 'M' + (cx - r * .5) + ' ' + (cy - r * .5) + 'L' + (cx + r * .6) + ' ' + cy + 'L' + (cx - r * .5) + ' ' + (cy + r * .5) + 'Z', fill: '#c8761f' }));
      lab(gL, cx, cy + r + 11, t, 's', 'middle');
    }
    function valve(cx, cy, t, col) {
      gS.appendChild(sv('path', { d: 'M' + (cx - 6) + ' ' + (cy - 6) + 'L' + (cx + 6) + ' ' + (cy + 6) + 'L' + (cx + 6) + ' ' + (cy - 6) + 'L' + (cx - 6) + ' ' + (cy + 6) + 'Z', fill: col || '#9aa7b4', stroke: '#cfd8e0', 'stroke-width': .8 }));
      if (t) lab(gL, cx, cy - 10, t, 's', 'middle');
    }

    /* IHX */
    unit(58, 96, 74, 210, 'IHX ×2', '900 m²/台');
    lab(gL, 95, 86, '一次侧 545→395 °C', 't', 'middle');
    pipe('M70 96V72H36V330H70V306', '#8a5a3a', 4);   // 一次侧象征
    lab(gL, 32, 200, '一回路', 's', 'end');

    /* 二回路热支 → 膨胀箱 → SG */
    pipe('M132 130H236', '#5b6875', 5);
    unit(236, 40, 96, 62, '膨胀箱', 'Ar 0.25 MPa');
    pipe('M284 102V130M284 130H420', '#5b6875', 5);
    lab(gL, 200, 122, '505 °C', 't', 'middle');

    /* SG */
    unit(420, 96, 96, 232, '蒸汽发生器', '直流 · 500 MW');
    for (var k = 0; k < 7; k++) gS.appendChild(sv('path', { d: 'M' + (432 + k * 12) + ' 320Q' + (438 + k * 12) + ' 210 ' + (432 + k * 12) + ' 104', fill: 'none', stroke: '#39424d', 'stroke-width': 2 }));
    lab(gL, 468, 88, '钠壳侧下行 / 水管侧上行', 's', 'middle');

    /* 二回路冷支回 IHX */
    pipe('M420 300H360V392H160V236H132', '#5b6875', 5);
    lab(gL, 300, 384, '320 °C 冷支', 'k', 'middle');
    pump(246, 392, 15, '二回路泵 2 107 kg/s');

    /* 钠水反应防护 */
    valve(390, 300, '', '#57c46a');
    pipe('M390 306V340H300V430H470V340H420', '#2f6f4a', 3);
    unit(470, 404, 130, 50, '反应产物排放箱', '爆破膜 0.8 MPa 开启', '#16211b');
    gS.appendChild(sv('path', { d: 'M446 340h48', stroke: '#57c46a', 'stroke-width': 3 }));
    lab(gL, 306, 334, 'H₂ 计 30 ppb', 's');
    gS.appendChild(sv('circle', { cx: 300, cy: 322, r: 7, fill: '#16211b', stroke: '#57c46a', 'stroke-width': 1.4 }));
    lab(gL, 300, 326, 'H', 's', 'middle');
    lab(gL, 536, 392, '氢燃烧塔 / 分离器', 's', 'middle');

    /* 三回路：蒸汽 → 汽轮机 → 凝汽器 → 给水 */
    pipe('M516 108H600', '#b9c4cf', 5);
    lab(gL, 556, 100, '14.0 MPa 490 °C', 't', 'middle');
    unit(600, 78, 118, 62, '汽轮机', '3 000 r/min');
    gS.appendChild(sv('rect', { x: 730, y: 88, width: 52, height: 42, fill: '#232b34', stroke: '#c8761f', 'stroke-width': 1.6 }));
    lab(gL, 756, 112, 'G', 'k', 'middle'); lab(gL, 756, 144, '607 MW 毛', 's', 'middle');
    pipe('M659 140V180H600V240H718V180H659', '#5c7a8f', 4);
    unit(600, 214, 118, 52, '凝汽器', '5.5 kPa / 34 °C');
    pipe('M600 240H556V300H516', '#4a6f8c', 4);
    pump(556, 274, 14, '给水泵');
    unit(760, 214, 110, 52, '回热 4 级 + 除氧', '给水 240 °C', '#1c2530');
    pipe('M718 240H760', '#4a6f8c', 4);
    pipe('M815 214V166H540V300H516', '#4a6f8c', 3);
    lab(gL, 660, 158, '给水 240 °C → SG', 's', 'middle');

    /* 流线 */
    function T2i(s) { return s.T2i; } function T2o(s) { return s.T2o; }
    function push2(d, o) { o.guide = o.guide || 'rgba(150,170,190,.14)'; o.gw = 3; makeLeg(gF, d, o); }
    push2('M132 128H284V128H420', { t0: T2o, t1: T2o, v: 1.2, gap: 26 });
    push2('M436 110V318', { t0: T2o, t1: T2i, v: 1.0, gap: 18, guide: 'rgba(160,150,150,.14)' });
    push2('M470 318V110', { t0: T2o, t1: T2i, v: 1.0, gap: 18, guide: 'none' });
    push2('M420 300H360V392H160V236H132', { t0: T2i, t1: T2i, v: 1.2, gap: 26 });
    push2('M100 236V130', { t0: T2i, t1: T2o, v: 1.1, gap: 20, guide: 'rgba(47,111,140,.18)' });
    // 水/蒸汽
    push2('M504 300V110', { t0: function () { return 240; }, t1: function () { return 490; }, v: 1.1, gap: 20, kind: 'steam', r: 2.2, guide: 'rgba(200,210,220,.14)' });
    push2('M516 108H655', { t0: function () { return 490; }, t1: function () { return 470; }, v: 1.9, gap: 26, kind: 'steam', r: 2.4 });
    push2('M659 140V180H620V240', { t0: function () { return 120; }, t1: function () { return 34; }, v: 1.5, gap: 24, kind: 'steam', r: 2.2 });
    push2('M660 262H760V240', { t0: function () { return 34; }, t1: function () { return 120; }, v: 1.0, gap: 24, kind: 'steam', r: 2.0 });
    push2('M815 214V166H540V300H504', { t0: function () { return 240; }, t1: function () { return 240; }, v: 1.0, gap: 26, kind: 'steam', r: 2.0 });

    /* 读数 */
    var con = el('div', { class: 'rf-console' }), cl = el('div'), cr = el('div', { class: 'panel-dark', style: { margin: 0 } });
    con.appendChild(cl); con.appendChild(cr); fig.body.appendChild(con);
    cl.appendChild(el('div', { class: 'h4', text: '钠水反应：三层防护的时间尺度' }));
    cl.appendChild(el('div', {
      class: 'note', html:
        '<b>t &lt; 1 s</b>　微泄漏（针孔，&lt; 0.1 g/s）：钠中氢浓度上升，氢计 30 ppb 检测限在数十秒内报警。<br>' +
        '<b>数分钟 – 数十分钟</b>　泄漏自扩大（NaOH 腐蚀管壁 → 孔径增大 → 邻管受冲刷）：这是唯一的可干预窗口，逻辑是"报警 → 隔离 → 蒸汽侧卸压 → 钠侧排放"。<br>' +
        '<b>t &lt; 0.1 s（DEG）</b>　单管双端断裂：压力波 1.5 MPa，爆破膜 0.8 MPa 开启，动力学上人无法干预，只能靠被动件承受。<br>' +
        '<span class="tag">设计判据</span> 二回路管道、膨胀箱、IHX 二次侧壳体均按 1.5 MPa 动态载荷校核；主容器不承受任何钠水反应载荷 —— 这是设中间回路的<b>根本理由</b>。'
    }));
    cr.appendChild(el('div', { class: 'h4', text: '二 / 三回路参数（随第 2 章工况联动）' }));
    var R2 = {};
    ['工况', '单环路热功率', '二回路流量/环路', 'IHX 出口钠温', 'SG 钠侧出口', '主蒸汽流量', '主蒸汽温度',
      'SG 对数平均温差', 'SG 需求面积', '发电机出力', '净电功率', '净效率'].forEach(function (k) {
        R2[k] = S.readout(cr, k, { '单环路热功率': 'MW', '二回路流量/环路': 'kg/s', 'IHX 出口钠温': '°C', 'SG 钠侧出口': '°C', '主蒸汽流量': 'kg/s', '主蒸汽温度': '°C', 'SG 对数平均温差': 'K', 'SG 需求面积': 'm²', '发电机出力': 'MW', '净电功率': 'MW', '净效率': '%' }[k] || '');
      });
    function render2(st) {
      var Tst = st.pf > 0.3 ? D.Tsteam : D.Tsteam - (0.3 - st.pf) * 260;
      var d1 = st.T2o - Tst, d2 = st.T2i - D.Tfeed;
      var lm = (Math.abs(d1 - d2) < 1e-6 || d1 <= 0 || d2 <= 0) ? Math.max(1, (d1 + d2) / 2) : (d1 - d2) / Math.log(d1 / d2);
      R2['工况'].set(st.label);
      R2['单环路热功率'].set(S.fmtG(st.P / 1e6 / 3, 0));
      R2['二回路流量/环路'].set(S.fmtG(st.w2 / 3, 0));
      R2['IHX 出口钠温'].set(S.fmt(st.T2o, 1));
      R2['SG 钠侧出口'].set(S.fmt(st.T2i, 1));
      R2['主蒸汽流量'].set(S.fmt(st.steam, 1));
      R2['主蒸汽温度'].set(S.fmt(Tst, 0), Tst > 400 ? 'ok' : 'warn');
      R2['SG 对数平均温差'].set(S.fmt(lm, 1));
      R2['SG 需求面积'].set(S.fmtG(st.P / 3 / (D.Usg * lm), 0), st.P / 3 / (D.Usg * lm) <= D.Asg ? 'ok' : 'warn');
      R2['发电机出力'].set(S.fmtG(st.P * D.etaGross / 1e6, 0));
      R2['净电功率'].set(S.fmtG(st.Pe / 1e6, 0));
      R2['净效率'].set(st.P > 0 ? S.fmt(100 * st.Pe / st.P, 1) : '0');
      paintLegs(st);
    }
    subs.push(render2);
    render2(compute());
    startAnim();
  }

  S.register('primary', mountPrimary);
  S.register('secondary', mountSecondary);
  window.SFR_PLANT = { D: D, compute: compute, decay: decay, rhoNa: rhoNa, cpNa: cpNa, kNa: kNa, muNa: muNa, TBOIL: TBOIL, PLANT: PLANT, fire: fire, subs: subs };
})();
