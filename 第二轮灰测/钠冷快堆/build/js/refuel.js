/* ============================================================================
   第 6 章：双旋塞直提式换料机构 —— 逆运动学驱动的换料动画
   俯视图（真实旋塞转角）与随动剖视图（真实行程）共享同一状态量
   ==========================================================================*/
(function () {
  'use strict';
  var S = window.SFR, el = S.el, sv = S.svg, PI = Math.PI, D2R = PI / 180, R2D = 180 / PI;

  /* ---------- 机构几何（m / m/s / °/s） ---------- */
  var G = {
    p: 0.155, aF: 0.152, e1: 1.12, e2: 1.12, rLRP: 3.0, rSRP: 1.60, rCh: 0.15,
    zTop: 3.60, zTC: 3.75, zCP0: 3.90, zCP1: 5.90,
    zXfer: 7.50,        // 转运标高（抓具抓取面 = 组件顶）
    zXferHi: 7.90,      // 转运窗口上限
    zGrab: 3.60,        // 堆芯组件抓取标高
    zRack: 4.80,        // 贮存格架抓取标高（座面 1.20 + 3.60）
    zNa: 9.00, zPlug0: 10.20, zPlug1: 11.80, zPark: 10.60, zMastTop: 12.40,
    vFast: 0.200, vLoad: 0.050, vFine: 0.005, hFine: 0.20,
    wL: 0.48, wS: 0.90,                                  // °/s
    tClaw: 4, tVerify: 10, tPin: 8, overhead: 1.10,
    nReplace: 84, wGripEmpty: 0.28, wGripLoad: 3.10      // kN
  };
  G.reach = G.e1 + G.e2;
  var TYPE = {
    F1: { c: '#2d5673', n: '内区燃料', z: 'in' }, F2: { c: '#26485f', n: '外区燃料', z: 'out' },
    SR1: { c: '#8a6a2f', n: '主停堆棒 SR-1' }, SR2: { c: '#7a4a58', n: '后备停堆棒 SR-2' },
    RR: { c: '#5f7a4a', n: '调节棒 RR' }, REF: { c: '#4a5560', n: '钢反射体' },
    SHD: { c: '#39424d', n: 'B₄C 屏蔽' }, IVS: { c: '#1b232b', n: '堆内乏燃料贮存位' },
    NEW: { c: '#1f4f3d', n: '新燃料暂存位' }, TRN: { c: '#7a4e14', n: '转运位（出堆通道）' },
    BLK: { c: '#2a2f35', n: '堵块' }
  };
  var RODS = {
    SR2: [[0, 0], [6, -3], [-3, 6], [-3, -3]],
    SR1: [[3, 0], [0, 3], [-3, 3], [-3, 0], [0, -3], [3, -3], [7, -3], [4, 3], [-3, 7], [-7, 3], [-4, -3], [3, -7]],
    RR: [[5, -2], [2, 3], [-3, 5]]
  };

  /* ---------- 栅元模型 ---------- */
  function buildCells() {
    var raw = S.lattice(14, G.p), cells = [], rodKey = {};
    Object.keys(RODS).forEach(function (k) { RODS[k].forEach(function (c) { rodKey[c[0] + ',' + c[1]] = k; }); });
    var ring14 = [];
    raw.forEach(function (c) {
      var t, key = c.i + ',' + c.j;
      if (c.ring <= 9) t = rodKey[key] || (c.ring <= 6 ? 'F1' : 'F2');
      else if (c.ring <= 11) t = 'REF';
      else if (c.ring <= 13) t = 'SHD';
      else t = 'IVS';
      var o = {
        i: c.i, j: c.j, ring: c.ring, x: c.x, y: c.y, r: c.r,
        th: Math.atan2(c.y, c.x), type: t, occupied: t !== 'IVS' && t !== 'NEW', bu: 0, age: 0, id: ''
      };
      if (c.ring === 14) ring14.push(o);
      cells.push(o);
    });
    /* 环 14 分配：转运位 1 + 新燃料 6 + 乏燃料贮存 76 + 堵块 1 */
    ring14.sort(function (a, b) { return a.th - b.th; });
    ring14.forEach(function (o, k) {
      if (k === 0) { o.type = 'TRN'; o.occupied = false; }
      else if (k <= 6) { o.type = 'NEW'; o.occupied = true; }
      else if (k === 83) { o.type = 'BLK'; o.occupied = true; }
      else { o.type = 'IVS'; o.occupied = false; }
    });
    /* 燃料燃耗：3 批分散装料，区内轮换分配寿期 */
    var inn = cells.filter(function (c) { return c.type === 'F1'; }),
      out = cells.filter(function (c) { return c.type === 'F2'; });
    function assign(list, pf) {
      list.sort(function (a, b) { return (a.i * 7919 + a.j * 104729) % 1000 - (b.i * 7919 + b.j * 104729) % 1000; });
      list.forEach(function (c, k) {
        c.age = (k % 3) + 1;
        c.bu = c.age * 22 * pf * (0.94 + 0.12 * ((Math.abs(c.i * 31 + c.j * 17) % 11) / 10));
      });
    }
    assign(inn, 1.15); assign(out, 0.90);
    var n1 = 0, n2 = 0;
    cells.forEach(function (c) {
      if (c.type === 'F1') c.id = 'F1-' + (++n1); else if (c.type === 'F2') c.id = 'F2-' + (++n2);
      else if (c.type === 'IVS') c.id = 'IVS';
      else if (c.type === 'NEW') c.id = 'NEW';
      else c.id = c.type;
    });
    return cells;
  }
  var CELLS = buildCells();
  var byKey = {}; CELLS.forEach(function (c) { byKey[c.i + ',' + c.j] = c; });
  function pool(type) { return CELLS.filter(function (c) { return c.type === type; }); }
  var STAT = {
    F1: pool('F1').length, F2: pool('F2').length, IVS: pool('IVS').length,
    NEW: pool('NEW').length, REF: pool('REF').length, SHD: pool('SHD').length,
    rods: RODS.SR1.length + RODS.SR2.length + RODS.RR.length
  };

  /* ---------- 逆运动学 ---------- */
  function norm(a) { while (a > PI) a -= 2 * PI; while (a < -PI) a += 2 * PI; return a; }
  function ik(x, y, a0, b0) {
    var r = Math.hypot(x, y), th = Math.atan2(y, x);
    var cb = (r * r - G.e1 * G.e1 - G.e2 * G.e2) / (2 * G.e1 * G.e2);
    cb = S.clamp(cb, -1, 1);
    var out = null;
    [1, -1].forEach(function (sg) {
      var b = sg * Math.acos(cb);
      var dlt = Math.atan2(G.e2 * Math.sin(b), G.e1 + G.e2 * Math.cos(b));
      var a = norm(th - dlt);
      var dA = Math.abs(norm(a - a0)), dB = Math.abs(norm(b - b0));
      var t = Math.max(dA * R2D / G.wL, dB * R2D / G.wS);
      if (!out || t < out.t) out = { a: a, b: b, t: t, dA: dA, dB: dB, elbow: sg > 0 ? '肘上' : '肘下' };
    });
    out.r = r;
    return out;
  }
  function fwd(a, b) {
    return {
      x: G.e1 * Math.cos(a) + G.e2 * Math.cos(a + b),
      y: G.e1 * Math.sin(a) + G.e2 * Math.sin(a + b),
      sx: G.e1 * Math.cos(a), sy: G.e1 * Math.sin(a)
    };
  }

  /* ---------- 状态 ---------- */
  var st = {
    a: 0, b: PI, hoist: G.zPark, claw: 0, carried: null, srcCell: null, dstCell: null,
    locked: true, sealed: true, uncoupled: false, rodsIn: true,
    T: 545, keff: 1.0, o2: 12, level: 9.70, load: 0,
    phase: 0, act: '待启动', clock: 0, batch: 0, alarm: null, trail: [], speed: 20,
    playing: false, done: false, mode: 'auto'
  };

  /* ---------- 联锁 ---------- */
  function interlocks() {
    var carrying = !!st.carried, bot = st.hoist - G.zTop, top = st.hoist;
    var xferOK = carrying ? (bot >= G.zXfer - G.zTop - 1e-6 && bot <= G.zXferHi - G.zTop + 1e-6)
      : (st.hoist >= G.zPark - 1e-6 || st.hoist >= 4.5);
    return [
      { n: '控制棒全插 · k<sub>eff</sub>', ok: st.rodsIn && st.keff <= 0.95, v: st.keff.toFixed(3) },
      { n: '驱动杆已解耦', ok: st.uncoupled, v: st.uncoupled ? '解耦' : '联结' },
      { n: '钠温 180–250 °C', ok: st.T >= 180 && st.T <= 250, v: st.T.toFixed(0) + ' °C' },
      { n: '覆盖气体 O₂ &lt; 50 ppm', ok: st.o2 < 50, v: st.o2.toFixed(0) + ' ppm' },
      { n: '换料液位 9.00 ± 0.05 m', ok: Math.abs(st.level - 9.0) <= 0.05, v: st.level.toFixed(2) + ' m' },
      { n: '冷冻密封已熔化', ok: !st.sealed, v: st.sealed ? '凝固' : '熔化' },
      { n: '抓具载荷窗口', ok: carrying ? (st.load > 2.6 && st.load < 5.0) : st.load < 0.6, v: st.load.toFixed(2) + ' kN' },
      {
        n: carrying ? '组件浸没深度 ≥ 0.3 m' : '抓具位置合法',
        ok: carrying ? (G.zNa - top >= 0.3) : true, v: carrying ? (G.zNa - top).toFixed(2) + ' m' : '—'
      },
      { n: '互锁 A：旋塞转动许可', ok: xferOK, v: carrying ? ('底 ' + bot.toFixed(2) + ' m') : (st.hoist >= G.zPark - 1e-6 ? '停放' : st.hoist.toFixed(2) + ' m') },
      { n: '互锁 B：锁定销', ok: true, v: st.locked ? '已插入' : '已拔出' }
    ];
  }
  function rotatePermit() { var i = interlocks(); return !st.locked && i[8].ok && i[1].ok && i[5].ok; }
  function hoistPermit() { return st.locked; }

  /* ==========================================================================
     视图 1：俯视图
     ========================================================================*/
  function buildPlan(host) {
    var W = 540, C = 270, SC = 70;
    var root = sv('svg', { viewBox: '0 0 ' + W + ' ' + W });
    host.appendChild(root);
    root.appendChild(sv('style', {
      text: '.pl-t{font:9px ui-monospace,monospace;fill:#8d99a6}.pl-t.k{fill:#fff;font-weight:600}' +
        '.pl-t.a{fill:#e8a33d}.hexc{stroke:#0c1013;stroke-width:.6;cursor:pointer}.hexc:hover{stroke:#e8a33d;stroke-width:1.4}'
    }));
    function X(x) { return C + SC * x; } function Y(y) { return C - SC * y; }
    var gB = sv('g'), gH = sv('g'), gLRP = sv('g'), gSRP = sv('g'), gT = sv('g'), gL = sv('g');
    [gB, gH, gLRP, gSRP, gT, gL].forEach(function (g) { root.appendChild(g); });

    /* 隔板与方位盘 */
    gB.appendChild(sv('circle', { cx: C, cy: C, r: SC * 3.4, fill: 'none', stroke: '#39424d', 'stroke-width': 1.2, 'stroke-dasharray': '6 4' }));
    for (var d = 0; d < 360; d += 15) {
      var big = d % 45 === 0, rr = SC * 3.55, r2 = rr + (big ? 9 : 5);
      gB.appendChild(sv('line', {
        x1: C + rr * Math.cos(d * D2R), y1: C - rr * Math.sin(d * D2R),
        x2: C + r2 * Math.cos(d * D2R), y2: C - r2 * Math.sin(d * D2R),
        stroke: big ? '#8d99a6' : '#4a5560', 'stroke-width': big ? 1.2 : .8
      }));
      if (big) gB.appendChild(sv('text', {
        x: C + (rr + 19) * Math.cos(d * D2R), y: C - (rr + 19) * Math.sin(d * D2R) + 3,
        class: 'pl-t', 'text-anchor': 'middle', text: d + '°'
      }));
    }
    /* 可达域 */
    gB.appendChild(sv('circle', { cx: C, cy: C, r: SC * G.reach, fill: 'none', stroke: '#c8761f', 'stroke-width': 1, 'stroke-dasharray': '4 3' }));
    gB.appendChild(sv('text', { x: C + 4, y: Y(G.reach) - 5, class: 'pl-t a', text: '可达域 r ≤ 2.24 m' }));

    /* 栅元 */
    var nodes = {};
    CELLS.forEach(function (c) {
      var pth = sv('path', { d: S.hexPath(X(c.x), Y(c.y), SC * G.aF), class: 'hexc' });
      pth.addEventListener('click', function () { pick(c); });
      gH.appendChild(pth);
      nodes[c.i + ',' + c.j] = pth;
    });
    /* 大旋塞 */
    var lrpG = sv('g');
    lrpG.appendChild(sv('circle', { cx: C, cy: C, r: SC * G.rLRP, fill: 'rgba(60,72,86,.30)', stroke: '#7b8894', 'stroke-width': 2 }));
    for (var k = 0; k < 24; k++) {
      var an = k * 15 * D2R;
      lrpG.appendChild(sv('circle', { cx: C + SC * 2.85 * Math.cos(an), cy: C - SC * 2.85 * Math.sin(an), r: 2.6, fill: '#5b6875' }));
    }
    lrpG.appendChild(sv('path', { d: 'M' + C + ' ' + C + 'L' + (C + SC * G.rLRP) + ' ' + C, stroke: '#9aa7b4', 'stroke-width': 1.6 }));
    lrpG.appendChild(sv('path', { d: 'M' + (C + SC * 2.9) + ' ' + (C - 9) + 'l14 9l-14 9z', fill: '#c8761f' }));
    gLRP.appendChild(lrpG);
    /* 小旋塞 */
    var srpG = sv('g'), srpIn = sv('g');
    srpG.appendChild(srpIn);
    srpIn.appendChild(sv('circle', { cx: 0, cy: 0, r: SC * G.rSRP, fill: 'rgba(84,98,114,.34)', stroke: '#a8b4c0', 'stroke-width': 2 }));
    for (var k2 = 0; k2 < 16; k2++) {
      var a2 = k2 * 22.5 * D2R;
      srpIn.appendChild(sv('circle', { cx: SC * 1.48 * Math.cos(a2), cy: -SC * 1.48 * Math.sin(a2), r: 2.2, fill: '#6d7b88' }));
    }
    srpIn.appendChild(sv('path', { d: 'M0 0L' + (SC * G.rSRP) + ' 0', stroke: '#cfd8e0', 'stroke-width': 1.4 }));
    srpIn.appendChild(sv('circle', { cx: SC * G.e2, cy: 0, r: SC * G.rCh, fill: '#0c1013', stroke: '#e8a33d', 'stroke-width': 1.4 }));
    gSRP.appendChild(srpG);
    /* 抓具与目标 */
    var trail = sv('path', { fill: 'none', stroke: '#e8a33d', 'stroke-width': 1, 'stroke-dasharray': '2 2', opacity: .8 });
    gT.appendChild(trail);
    var grip = sv('g');
    grip.appendChild(sv('circle', { cx: 0, cy: 0, r: 10, fill: 'none', stroke: '#ffd48a', 'stroke-width': 1.6 }));
    grip.appendChild(sv('path', { d: 'M-14 0h28M0 -14v28', stroke: '#ffd48a', 'stroke-width': 1 }));
    var gripLoad = sv('path', { d: S.hexPath(0, 0, SC * G.aF), fill: 'rgba(232,163,61,.35)', stroke: '#ffd48a', 'stroke-width': 1.2 });
    grip.appendChild(gripLoad);
    gT.appendChild(grip);
    var tgtRing = sv('path', { fill: 'none', stroke: '#57c46a', 'stroke-width': 2 });
    var dstRing = sv('path', { fill: 'none', stroke: '#4aa3ff', 'stroke-width': 2, 'stroke-dasharray': '3 2' });
    gT.appendChild(tgtRing); gT.appendChild(dstRing);
    /* 图例 */
    var lg = sv('g'); gL.appendChild(lg);
    var order = ['F1', 'F2', 'SR1', 'SR2', 'RR', 'REF', 'SHD', 'IVS', 'NEW', 'TRN'];
    order.forEach(function (t, k) {
      var yy = 14 + k * 13;
      lg.appendChild(sv('rect', { x: 8, y: yy, width: 10, height: 10, fill: TYPE[t].c, stroke: '#0c1013', 'stroke-width': .6 }));
      lg.appendChild(sv('text', { x: 22, y: yy + 8.6, class: 'pl-t', text: TYPE[t].n }));
    });
    lg.appendChild(sv('text', { x: 8, y: 14 + 10 * 13 + 10, class: 'pl-t', text: '燃料明度 = 燃耗（深→浅：低→高）' }));

    function paint() {
      CELLS.forEach(function (c) {
        var n = nodes[c.i + ',' + c.j], f = TYPE[c.type].c;
        if (c.type === 'F1' || c.type === 'F2') {
          var t = S.clamp(c.bu / 80, 0, 1);
          f = 'rgb(' + Math.round(38 + 150 * t) + ',' + Math.round(76 + 40 * t) + ',' + Math.round(105 - 45 * t) + ')';
        } else if (c.type === 'IVS' && c.occupied) f = '#6a2a24';
        else if (c.type === 'NEW' && !c.occupied) f = '#101a16';
        n.setAttribute('fill', f);
        n.setAttribute('opacity', (st.carried && st.srcCell === c) ? 0.25 : 1);
      });
    }
    function update() {
      var p = fwd(st.a, st.b);
      lrpG.setAttribute('transform', 'rotate(' + (-st.a * R2D) + ' ' + C + ' ' + C + ')');
      srpG.setAttribute('transform', 'translate(' + X(p.sx) + ' ' + Y(p.sy) + ')');
      srpIn.setAttribute('transform', 'rotate(' + (-(st.a + st.b) * R2D) + ')');
      grip.setAttribute('transform', 'translate(' + X(p.x) + ' ' + Y(p.y) + ')');
      gripLoad.setAttribute('opacity', st.carried ? 1 : 0);
      if (st.trail.length > 1) trail.setAttribute('d', st.trail.map(function (q, k) { return (k ? 'L' : 'M') + X(q[0]).toFixed(1) + ' ' + Y(q[1]).toFixed(1); }).join(''));
      else trail.setAttribute('d', '');
      tgtRing.setAttribute('d', st.srcCell ? S.hexPath(X(st.srcCell.x), Y(st.srcCell.y), SC * G.aF * 1.22) : '');
      dstRing.setAttribute('d', st.dstCell ? S.hexPath(X(st.dstCell.x), Y(st.dstCell.y), SC * G.aF * 1.22) : '');
    }
    paint();
    return { update: update, paint: paint };
  }

  /* ==========================================================================
     视图 2：随动剖视图（剖切面始终包含抓具轴线）
     ========================================================================*/
  function buildElev(host) {
    var W = 520, H = 660, SC = 44, AX = 262, Y0 = 596;
    var root = sv('svg', { viewBox: '0 0 ' + W + ' ' + H });
    host.appendChild(root);
    root.appendChild(sv('style', {
      text: '.ev{font:9px ui-monospace,monospace;fill:#8d99a6}.ev.k{fill:#fff;font-weight:600}.ev.a{fill:#e8a33d}' +
        '.ev.g{fill:#57c46a}.dm{stroke:#c8761f;stroke-width:.8;fill:none}.dmt{font:8.6px ui-monospace,monospace;fill:#c8761f}'
      }));
    function X(r) { return AX + SC * r; } function Y(z) { return Y0 - SC * z; }
    function rect(g, r1, z1, r2, z2, a) {
      var o = { x: X(r1), y: Y(z2), width: SC * (r2 - r1), height: SC * (z2 - z1) };
      for (var k in (a || {})) o[k] = a[k];
      g.appendChild(sv('rect', o)); return o;
    }
    function txt(g, r, z, t, cls, an) { g.appendChild(sv('text', { x: X(r), y: Y(z), class: 'ev ' + (cls || ''), 'text-anchor': an || 'start', text: t })); }
    var gB = sv('g'), gC = sv('g'), gCP = sv('g'), gNa = sv('g'), gM = sv('g'), gD = sv('g'), gL = sv('g');
    [gB, gC, gCP, gNa, gM, gD, gL].forEach(function (g) { root.appendChild(g); });

    /* 支承与栅板 */
    rect(gB, -2.5, -0.9, 2.5, -0.25, { fill: 'rgba(58,92,140,.42)', stroke: '#8fa8c4' });
    txt(gB, 0, -0.55, '高压腔室', 'k', 'middle');
    rect(gB, -2.5, -0.25, 2.5, 0, { fill: '#4a5560', stroke: '#9aa7b4' });
    txt(gB, -2.6, -0.1, '栅板', '', 'end');

    /* 栅元剖面 k = -14..14 */
    var bars = [];
    for (var k = -14; k <= 14; k++) {
      var r = k * G.p, ring = Math.abs(k), c = byKey[k + ',0'] || byKey['0,' + k];
      var t = ring <= 9 ? ((byKey[(k) + ',0'] || {}).type || 'F1') : ring <= 11 ? 'REF' : ring <= 13 ? 'SHD' : 'IVS';
      var isIVS = ring === 14, z0 = isIVS ? 1.2 : 0, z1 = z0 + G.zTop;
      if (isIVS) rect(gC, r - 0.076, 0, r + 0.076, 1.2, { fill: '#232b34', stroke: '#4a5560', 'stroke-width': .6 });
      var bar = sv('rect', {
        x: X(r - 0.076), y: Y(z1), width: SC * 0.152, height: SC * G.zTop,
        fill: TYPE[t].c, stroke: '#0c1013', 'stroke-width': .5
      });
      gC.appendChild(bar);
      if (ring <= 9) gC.appendChild(sv('rect', { x: X(r - 0.076), y: Y(1.20), width: SC * 0.152, height: SC * 0.95, fill: t === 'F1' || t === 'F2' ? '#7a3320' : '#6b5a2f' }));
      bars.push({ k: k, r: r, node: bar, ring: ring, isIVS: isIVS, z0: z0 });
    }
    txt(gL, -2.05, 0.55, '活性区 950', 'a', 'end');
    gL.appendChild(sv('path', { d: 'M' + X(-2.0) + ' ' + Y(0.72) + 'L' + X(-1.42) + ' ' + Y(0.72), stroke: '#e8a33d', 'stroke-width': .7 }));
    txt(gL, 2.32, 4.95, '堆内贮存格架', '', 'start');
    txt(gL, 2.32, 4.6, '（环 14，座面 1.20 m）', '', 'start');
    txt(gL, 0, 3.85, '环号 →  0 …… 9 │10 11│12 13│14', '', 'middle');

    /* 控制塞（随小旋塞转动）：带换料通道缺口 */
    var cpL = sv('rect', {}), cpR = sv('rect', {});
    gCP.appendChild(cpL); gCP.appendChild(cpR);
    for (var k3 = -13; k3 <= 13; k3++) {
      gCP.appendChild(sv('line', { x1: X(k3 * G.p), y1: Y(G.zCP0), x2: X(k3 * G.p), y2: Y(G.zTC), stroke: '#8d99a6', 'stroke-width': 1 }));
    }
    txt(gL, -2.68, 4.8, '控制塞 3.90–5.90 m', 'k', 'end');
    txt(gL, -2.68, 4.45, '随小旋塞同步转动', '', 'end');
    txt(gL, -2.68, 4.1, '252 支热套管下端 3.75', '', 'end');

    /* 钠液面与覆盖气体 */
    var naLine = sv('path', { stroke: '#5b8fc9', 'stroke-width': 2, fill: 'none' });
    var naFill = sv('rect', { x: X(-2.95), width: SC * 5.9, fill: 'rgba(58,92,140,.20)' });
    gNa.appendChild(naFill); gNa.appendChild(naLine);
    var naTx = sv('text', { class: 'ev k', x: X(-2.9), text: '' }); gNa.appendChild(naTx);
    txt(gL, 2.35, 9.75, '覆盖气体 Ar', '', 'start');

    /* 旋塞 */
    var lrpB = sv('rect', { x: X(-3.0), y: Y(G.zPlug1), width: SC * 6.0, height: SC * (G.zPlug1 - G.zPlug0), fill: '#333c46', stroke: '#5b6875', 'stroke-width': 1.4 });
    var srpB = sv('rect', { y: Y(G.zPlug1 - 0.02), height: SC * (G.zPlug1 - G.zPlug0 - 0.04), fill: '#3f4a57', stroke: '#8d99a6', 'stroke-width': 1.4 });
    gM.appendChild(lrpB); gM.appendChild(srpB);
    rect(gM, -3.0, G.zPlug1, 3.0, 12.4, { fill: '#2b333c', stroke: '#4a5560' });
    txt(gL, -2.9, 12.0, '楼板', '', 'start');
    var sealN = sv('rect', { x: X(2.6), y: Y(G.zPlug1), width: 10, height: SC * 0.5, stroke: '#cfd8e0', 'stroke-width': .8 });
    gM.appendChild(sealN);
    txt(gL, 2.9, 10.9, '冷冻密封', '', 'start');
    var pinN = sv('rect', { x: X(-2.95), width: 9, height: 5, fill: '#c8761f' }); gM.appendChild(pinN);
    txt(gL, -2.95, 10.05, '锁定销', '', 'start');

    /* 套筒 + 抓具 + 组件 */
    var mast = [sv('rect', {}), sv('rect', {}), sv('rect', {})];
    mast.forEach(function (m) { m.setAttribute('fill', '#59646f'); m.setAttribute('stroke', '#a8b4c0'); m.setAttribute('stroke-width', .8); gM.appendChild(m); });
    var head = sv('rect', { fill: '#8d99a6', stroke: '#e8eef4', 'stroke-width': 1 }); gM.appendChild(head);
    var clawL = sv('path', { stroke: '#ffd48a', 'stroke-width': 2, fill: 'none' }), clawR = sv('path', { stroke: '#ffd48a', 'stroke-width': 2, fill: 'none' });
    gM.appendChild(clawL); gM.appendChild(clawR);
    var carr = sv('rect', { fill: '#8a3a2c', stroke: '#ffd48a', 'stroke-width': 1.2 }); gM.appendChild(carr);
    var carrAct = sv('rect', { fill: '#c05a34' }); gM.appendChild(carrAct);
    var hi = sv('rect', { fill: 'none', stroke: '#57c46a', 'stroke-width': 1.8 }); gM.appendChild(hi);

    /* 尺寸线 */
    var dmLift = sv('path', { class: 'dm' }), dmLiftT = sv('text', { class: 'dmt' });
    var dmSub = sv('path', { class: 'dm' }), dmSubT = sv('text', { class: 'dmt' });
    [dmLift, dmLiftT, dmSub, dmSubT].forEach(function (n) { gD.appendChild(n); });

    /* 转运位与倾斜提升机 */
    var xferG = sv('g'); gM.appendChild(xferG);
    xferG.appendChild(sv('path', { d: 'M' + X(2.17) + ' ' + Y(4.9) + 'L' + X(2.9) + ' ' + Y(7.6), stroke: '#7a4e14', 'stroke-width': 7, fill: 'none', opacity: .75 }));
    xferG.appendChild(sv('path', { d: 'M' + X(2.5) + ' ' + Y(6.0) + 'L' + X(2.86) + ' ' + Y(7.35), stroke: '#e8a33d', 'stroke-width': 1.4, 'marker-end': 'url(#ar1)', fill: 'none' }));
    xferG.appendChild(sv('text', { x: X(2.4), y: Y(7.9), class: 'ev a', 'text-anchor': 'middle', text: '倾斜提升机 30°' }));

    function update() {
      var pos = fwd(st.a, st.b), rg = Math.hypot(pos.x, pos.y), thg = Math.atan2(pos.y, pos.x);
      var rs = G.e1 * Math.cos(st.a - thg);            // 小旋塞中心在剖面内的投影半径
      /* 钠面 */
      naLine.setAttribute('d', 'M' + X(-2.95) + ' ' + Y(st.level) + 'H' + X(2.95));
      naFill.setAttribute('y', Y(st.level)); naFill.setAttribute('height', Math.max(0, Y(-0.9) - Y(st.level)));
      naTx.setAttribute('y', Y(st.level) - 5); naTx.textContent = '换料钠液位 ' + st.level.toFixed(2) + ' m';
      /* 控制塞缺口 */
      var gap0 = rg - G.rCh, gap1 = rg + G.rCh;
      cpL.setAttribute('x', X(-2.6)); cpL.setAttribute('y', Y(G.zCP1));
      cpL.setAttribute('width', Math.max(0, SC * (gap0 + 2.6))); cpL.setAttribute('height', SC * (G.zCP1 - G.zCP0));
      cpL.setAttribute('fill', 'rgba(74,85,96,.75)'); cpL.setAttribute('stroke', '#8fa0b0'); cpL.setAttribute('stroke-width', 1);
      cpR.setAttribute('x', X(gap1)); cpR.setAttribute('y', Y(G.zCP1));
      cpR.setAttribute('width', Math.max(0, SC * (2.6 - gap1))); cpR.setAttribute('height', SC * (G.zCP1 - G.zCP0));
      cpR.setAttribute('fill', 'rgba(74,85,96,.75)'); cpR.setAttribute('stroke', '#8fa0b0'); cpR.setAttribute('stroke-width', 1);
      /* 旋塞投影 */
      srpB.setAttribute('x', X(rs - G.rSRP)); srpB.setAttribute('width', SC * 2 * G.rSRP);
      sealN.setAttribute('fill', st.sealed ? '#4aa3ff' : '#c05a34');
      pinN.setAttribute('y', Y(G.zPlug0) - (st.locked ? 0 : 14));
      pinN.setAttribute('fill', st.locked ? '#57c46a' : '#ef5f6b');
      /* 套筒：从 11.0 到 hoist，3 节 */
      var top = G.zMastTop, len = Math.max(0.05, top - st.hoist);
      for (var i = 0; i < 3; i++) {
        var z1 = top - len * i / 3, z2 = top - len * (i + 1) / 3, w = 0.20 - i * 0.045;
        mast[i].setAttribute('x', X(rg - w / 2)); mast[i].setAttribute('y', Y(z1));
        mast[i].setAttribute('width', SC * w); mast[i].setAttribute('height', SC * (z1 - z2));
      }
      head.setAttribute('x', X(rg - 0.13)); head.setAttribute('y', Y(st.hoist + 0.30));
      head.setAttribute('width', SC * 0.26); head.setAttribute('height', SC * 0.30);
      var o = 0.055 + st.claw * 0.075;
      clawL.setAttribute('d', 'M' + X(rg - 0.055) + ' ' + Y(st.hoist + 0.30) + 'L' + X(rg - o) + ' ' + Y(st.hoist + 0.06) + 'L' + X(rg - o * 0.6) + ' ' + Y(st.hoist - 0.05));
      clawR.setAttribute('d', 'M' + X(rg + 0.055) + ' ' + Y(st.hoist + 0.30) + 'L' + X(rg + o) + ' ' + Y(st.hoist + 0.06) + 'L' + X(rg + o * 0.6) + ' ' + Y(st.hoist - 0.05));
      /* 被吊组件 */
      if (st.carried) {
        carr.setAttribute('x', X(rg - 0.076)); carr.setAttribute('y', Y(st.hoist));
        carr.setAttribute('width', SC * 0.152); carr.setAttribute('height', SC * G.zTop);
        carr.setAttribute('opacity', 1);
        carrAct.setAttribute('x', X(rg - 0.076)); carrAct.setAttribute('y', Y(st.hoist - 2.40));
        carrAct.setAttribute('width', SC * 0.152); carrAct.setAttribute('height', SC * 0.95);
        carrAct.setAttribute('opacity', 1);
        dmSub.setAttribute('d', 'M' + X(rg + 0.42) + ' ' + Y(st.hoist) + 'V' + Y(st.level));
        dmSubT.setAttribute('x', X(rg + 0.5)); dmSubT.setAttribute('y', (Y(st.hoist) + Y(st.level)) / 2);
        dmSubT.textContent = '浸没 ' + ((st.level - st.hoist) * 1000).toFixed(0);
      } else {
        carr.setAttribute('opacity', 0); carrAct.setAttribute('opacity', 0);
        dmSub.setAttribute('d', ''); dmSubT.textContent = '';
      }
      /* 提升幅度尺寸 */
      dmLift.setAttribute('d', 'M' + X(rg - 0.42) + ' ' + Y(G.zGrab) + 'V' + Y(G.zXfer));
      dmLiftT.setAttribute('x', X(rg - 1.36)); dmLiftT.setAttribute('y', (Y(G.zGrab) + Y(G.zXfer)) / 2);
      dmLiftT.textContent = '提升幅度 3 900';
      /* 高亮当前作业栅元 */
      var hit = null;
      bars.forEach(function (b) { if (b.k > 0 && Math.abs(b.r - rg) < 0.078) hit = b; });
      if (hit) {
        hi.setAttribute('x', X(hit.r - 0.095)); hi.setAttribute('y', Y(hit.z0 + G.zTop + 0.08));
        hi.setAttribute('width', SC * 0.19); hi.setAttribute('height', SC * (G.zTop + 0.16));
        hi.setAttribute('opacity', 1);
      } else hi.setAttribute('opacity', 0);
      bars.forEach(function (b) {
        var vis = 1;
        if (st.carried && st.srcCell && Math.abs(b.r - st.srcCell.r) < 0.078 && b.k > 0) vis = 0.22;
        b.node.setAttribute('opacity', vis);
      });
      xferG.setAttribute('opacity', Math.abs(norm(thg - 0)) < 0.35 ? 1 : 0.22);
    }
    var defs = sv('defs'); root.appendChild(defs);
    var mk = sv('marker', { id: 'ar1', viewBox: '0 0 8 8', refX: 4, refY: 4, markerWidth: 5, markerHeight: 5, orient: 'auto' });
    mk.appendChild(sv('path', { d: 'M0 1L6 4L0 7z', fill: '#e8a33d' })); defs.appendChild(mk);
    return { update: update };
  }

  /* ==========================================================================
     动作队列
     ========================================================================*/
  var PHASES = [
    ['停堆 · 等温冷却至 200 °C', '控制棒全插；钠体积收缩 7.3% 使液位落到 9.00 m'],
    ['控制棒驱动杆解耦', '吸收体留在堆芯插入位，驱动杆随旋塞上提'],
    ['熔化冷冻密封 · 拔出锁定销', '低熔点合金 96 °C；泄漏率判据 1×10⁻⁴ Pa·m³/s'],
    ['换料机自检', '行程 / 载荷 / 编码器双通道比对'],
    ['旋塞联动 → 目标乏组件', '逆运动学解 α, β；取角行程之和最小的肘位'],
    ['抓取乏组件', '下行 7 000 mm（200→5 mm/s）· 咬合 · 载荷校验'],
    ['提升至转运标高', '3 900 mm @ 50 mm/s；顶部浸没 1 500 mm'],
    ['旋塞联动 → 堆内贮存位', '组件随旋塞在钠下转运'],
    ['放入贮存格架', '下降 2 700 mm · 松爪 · 回转运标高'],
    ['旋塞联动 → 新燃料暂存位 · 抓取', '新组件已预热至 200 °C'],
    ['旋塞联动 → 空栅元', '装料位与卸料位同区'],
    ['装入新组件 · 抓具回停放高度', '下降 3 900 mm · 松爪 · 上提 7 000 mm'],
    ['计数与循环', '目标 84 盒（内区 38 / 外区 46）'],
    ['旋塞归位 · 密封凝固 · 检漏', 'Ar 检漏合格后允许升温'],
    ['驱动杆耦合 · 升温 · 提棒至临界', '等温 200→395 °C，逐组提棒']
  ];

  function A(o) { return o; }
  function actRotate(ph, getXY, note) {
    return A({
      ph: ph, name: note, kind: 'rot', init: function () {
        var t = getXY(), sol = ik(t.x, t.y, st.a, st.b);
        this.a0 = st.a; this.b0 = st.b; this.a1 = sol.a; this.b1 = sol.b;
        this.dA = norm(sol.a - st.a); this.dB = norm(sol.b - st.b);
        this.tA = Math.abs(this.dA) * R2D / G.wL; this.tB = Math.abs(this.dB) * R2D / G.wS;
        this.rt = Math.max(this.tA, this.tB); this.elbow = sol.elbow;
        st.trail = [];
        if (!rotatePermit()) { st.alarm = '互锁 A/B 拒绝旋塞转动：' + (st.locked ? '锁定销未拔出' : '抓具不在转运窗口/停放位'); return false; }
        return true;
      },
      run: function (p) {
        var tt = this.rt * p;
        st.a = this.a0 + Math.sign(this.dA) * Math.min(Math.abs(this.dA), G.wL * D2R * tt);
        st.b = this.b0 + Math.sign(this.dB) * Math.min(Math.abs(this.dB), G.wS * D2R * tt);
        var q = fwd(st.a, st.b);
        if (st.trail.length === 0 || Math.hypot(q.x - st.trail[st.trail.length - 1][0], q.y - st.trail[st.trail.length - 1][1]) > 0.02) st.trail.push([q.x, q.y]);
        if (st.trail.length > 400) st.trail.shift();
      },
      end: function () { st.a = this.a1; st.b = this.b1; }
    });
  }
  function actHoist(ph, z1, note) {
    return A({
      ph: ph, name: note, kind: 'hoist', init: function () {
        this.z0 = st.hoist; this.z1 = z1;
        var d = Math.abs(z1 - this.z0), down = z1 < this.z0;
        var v = st.carried ? G.vLoad : (down ? G.vFast : G.vFast);
        if (st.carried) v = G.vLoad;
        this.fine = down ? Math.min(G.hFine, d) : 0;
        this.rt = (d - this.fine) / v + this.fine / G.vFine;
        this.v = v;
        if (!hoistPermit()) { st.alarm = '互锁 B 拒绝抓具升降：锁定销未插入'; return false; }
        return true;
      },
      run: function (p) {
        var d = Math.abs(this.z1 - this.z0), tt = this.rt * p, sgn = this.z1 < this.z0 ? -1 : 1;
        var coarse = (d - this.fine) / this.v, moved;
        moved = tt <= coarse ? this.v * tt : (d - this.fine) + G.vFine * (tt - coarse);
        st.hoist = this.z0 + sgn * Math.min(d, moved);
      },
      end: function () { st.hoist = this.z1; }
    });
  }
  function actClaw(ph, open, note, grabCell, release) {
    return A({
      ph: ph, name: note, kind: 'claw', rt: G.tClaw + G.tVerify,
      init: function () { return true; },
      run: function (p) {
        var q = S.clamp(p * (G.tClaw + G.tVerify) / G.tClaw, 0, 1);
        st.claw = open ? q : 1 - q;
        if (!open && q >= 1 && grabCell && !st.carried) {
          st.carried = grabCell(); if (st.carried) { st.srcCell = st.carried.cell; }
        }
        st.load = st.carried ? S.lerp(G.wGripEmpty, G.wGripLoad, S.clamp((p - 0.3) / 0.4, 0, 1)) : G.wGripEmpty * (1 - p * 0.5);
        if (open && q >= 1 && release && st.carried) { release(); st.carried = null; st.load = G.wGripEmpty; }
      },
      end: function () { st.claw = open ? 1 : 0; }
    });
  }
  function actPin(ph, insert, note) {
    return A({
      ph: ph, name: note, kind: 'pin', rt: G.tPin, init: function () { return true; },
      run: function () { }, end: function () { st.locked = insert; }
    });
  }
  function actWait(ph, rt, note, fn, fast) {
    return A({ ph: ph, name: note, rt: rt, fast: fast, init: function () { return true; }, run: function (p) { fn && fn(p); }, end: function () { fn && fn(1); } });
  }

  /* --- 选择目标 --- */
  var manual = null;
  function pickTarget() {
    if (manual && manual.occupied && (manual.type === 'F1' || manual.type === 'F2')) { var m = manual; manual = null; return m; }
    var best = null;
    CELLS.forEach(function (c) {
      if ((c.type === 'F1' || c.type === 'F2') && c.occupied && c.age >= 3 && (!best || c.bu > best.bu)) best = c;
    });
    if (!best) CELLS.forEach(function (c) { if ((c.type === 'F1' || c.type === 'F2') && c.occupied && (!best || c.bu > best.bu)) best = c; });
    return best;
  }
  function freeIVS() { var f = null; pool('IVS').forEach(function (c) { if (!c.occupied && !f) f = c; }); return f; }
  function fullNEW() { var f = null; pool('NEW').forEach(function (c) { if (c.occupied && !f) f = c; }); return f; }

  function cycleActions() {
    var src = pickTarget(), ivs = freeIVS(), nw = fullNEW();
    if (!src || !ivs || !nw) return [actWait(12, 30, '贮存位/新燃料暂存位耗尽 —— 需与出堆转运并行作业', function () { }, true)];
    var q = [];
    st.dstCell = null;
    q.push(actPin(4, false, '拔出锁定销'));
    q.push(actRotate(4, function () { return { x: src.x, y: src.y }; }, '旋塞联动 → ' + src.id + '（r = ' + (src.r * 1000).toFixed(0) + ' mm）'));
    q.push(actPin(5, true, '插入锁定销'));
    q.push(actHoist(5, G.zGrab, '抓具下行至提柄（7 000 mm）'));
    q.push(actClaw(5, false, '抓爪咬合 + 载荷校验', function () {
      src.occupied = false; return { cell: src, bu: src.bu, id: src.id, kind: 'spent' };
    }));
    q.push(actHoist(6, G.zXfer, '提升 3 900 mm 至转运标高'));
    q.push(actPin(7, false, '拔出锁定销'));
    q.push(actRotate(7, function () { return { x: ivs.x, y: ivs.y }; }, '旋塞联动 → 堆内贮存位'));
    q.push(actPin(8, true, '插入锁定销'));
    q.push(actHoist(8, G.zRack, '下降 2 700 mm 入格架'));
    q.push(actClaw(8, true, '松爪 · 乏组件交贮存格架', null, function () { ivs.occupied = true; ivs.bu = src.bu; st.srcCell = null; }));
    q.push(actHoist(8, G.zXfer, '抓具回转运标高'));
    q.push(actPin(9, false, '拔出锁定销'));
    q.push(actRotate(9, function () { return { x: nw.x, y: nw.y }; }, '旋塞联动 → 新燃料暂存位'));
    q.push(actPin(9, true, '插入锁定销'));
    q.push(actHoist(9, G.zRack, '下降至新组件提柄'));
    q.push(actClaw(9, false, '抓取新组件（已预热 200 °C）', function () {
      nw.occupied = false; return { cell: null, bu: 0, id: '新组件', kind: 'fresh' };
    }));
    q.push(actHoist(9, G.zXfer, '提升至转运标高'));
    q.push(actPin(10, false, '拔出锁定销'));
    q.push(actRotate(10, function () { st.dstCell = src; return { x: src.x, y: src.y }; }, '旋塞联动 → 空栅元 ' + src.id));
    q.push(actPin(11, true, '插入锁定销'));
    q.push(actHoist(11, G.zGrab, '下降 3 900 mm 就位'));
    q.push(actClaw(11, true, '松爪 · 新组件坐入栅元', null, function () {
      src.occupied = true; src.bu = 0; src.age = 1; st.dstCell = null;
    }));
    q.push(actHoist(11, G.zPark, '抓具回停放高度（7 000 mm）'));
    q.push(actWait(12, 20, '记录：组件编号 / 燃耗 / 载荷曲线归档', function () { }, false));
    q.push(A({
      ph: 12, name: '批次计数 +1', rt: 1, init: function () { return true; }, run: function () { },
      end: function () { st.batch++; }
    }));
    return q;
  }

  function prologue() {
    return [
      actWait(0, 3 * 86400, '停堆 · 等温冷却 200 °C · 液位 9.70 → 9.00 m', function (p) {
        st.T = S.lerp(545, 200, p); st.level = S.lerp(9.70, 9.00, p);
        st.keff = S.lerp(1.000, 0.926, S.clamp(p * 3, 0, 1)); st.rodsIn = true;
      }, true),
      actWait(1, 2 * 3600, '19 根驱动杆解耦并提升至旋塞内', function (p) { st.uncoupled = p > 0.6; }, true),
      actWait(2, 4 * 3600, '电加热熔化冷冻密封（96 °C 合金）', function (p) { st.sealed = p < 0.7; }, true),
      actWait(3, 1800, '换料机自检：行程 ±50 mm · 载荷 0/3.1 kN · 编码器双通道', function (p) {
        st.load = G.wGripEmpty * (0.4 + 0.6 * Math.abs(Math.sin(p * 6)));
      }, true),
      A({
        ph: 3, name: '自检完成，载荷归零', rt: 5, init: function () { return true; },
        run: function () { }, end: function () { st.load = G.wGripEmpty; }
      })
    ];
  }
  function epilogue() {
    return [
      actPin(13, false, '拔销 · 旋塞归零位'),
      actRotate(13, function () { return { x: G.e1 + G.e2, y: 0 }; }, '旋塞归位（α = 0°, β = 0°）'),
      actPin(13, true, '插入锁定销'),
      actWait(13, 6 * 3600, '冷冻密封凝固 · Ar 检漏 ≤ 1×10⁻⁴ Pa·m³/s', function (p) { st.sealed = p > 0.5; }, true),
      actWait(14, 4 * 3600, '驱动杆重新耦合 · 逐根行程与脱扣试验', function (p) { st.uncoupled = p < 0.5; }, true),
      actWait(14, 2 * 86400, '升温 200 → 395 °C · 逐组提棒 · 逼近临界', function (p) {
        st.T = S.lerp(200, 395, p); st.level = S.lerp(9.00, 9.70, p);
        st.keff = S.lerp(0.926, 1.000, p); st.rodsIn = p < 0.5;
      }, true)
    ];
  }

  /* ==========================================================================
     装配
     ========================================================================*/
  function mount(host) {
    var fig = S.figure({
      parent: host, title: '换料时序动画：俯视（真实旋塞转角）+ 随动剖视（真实行程）',
      drawNo: 'CFR1500-M-601', scale: '俯视 1:14 / 剖视 1:23（页内）', unit: 'm', bodyCls: 'dark',
      note: '<b>俯视图</b>：大旋塞（Φ6.0 m，同心）与小旋塞（Φ3.2 m，偏心 1 120 mm）按 6.1 的逆解转动，虚线为抓具轴线扫出的轨迹，琥珀色圆为可达域 r ≤ 2 240 mm。' +
        '<b>剖视图</b>：剖切面始终包含抓具轴线（随动剖视），因此可以同时看到抓具径向位置与竖直行程；控制塞随小旋塞转动，其上的换料通道始终位于抓具正上方。' +
        '点击俯视图任一燃料栅元可指定下一个作业目标；"违规操作演示"用于验证互锁 A 的截断逻辑。'
    });
    var views = el('div', { class: 'rf-views' });
    var vp = el('div', { class: 'rf-view' }), ve = el('div', { class: 'rf-view' });
    vp.appendChild(el('div', { class: 'rf-cap', text: '俯视图  PLAN' }));
    ve.appendChild(el('div', { class: 'rf-cap', text: '随动剖视 A–A  SECTION' }));
    views.appendChild(vp); views.appendChild(ve);
    fig.body.appendChild(views);
    var plan = buildPlan(vp), elev = buildElev(ve);

    /* ---- 控制台 ---- */
    var con = el('div', { class: 'rf-console' }), cl = el('div'), cr = el('div');
    con.appendChild(cl); con.appendChild(cr); fig.body.appendChild(con);

    var bar = el('div', { class: 'ctrl-row' }); cl.appendChild(bar);
    var bPlay = S.btn('▶ 开始换料', toggle, 'pri');
    var bStep = S.btn('单步', function () { st.playing = false; sync(); stepOnce(); });
    var bRst = S.btn('复位', reset);
    var bBad = S.btn('违规操作演示', badOp);
    bar.appendChild(bPlay); bar.appendChild(bStep); bar.appendChild(bRst); bar.appendChild(bBad);
    var spd = el('span', { class: 'note' });
    [20, 60, 200].forEach(function (v) {
      var b = S.btn(v + '×', function () { st.speed = v; syncSpd(); }, v === st.speed ? 'sm on' : 'sm');
      b.dataset.v = v; spd.appendChild(b);
    });
    bar.appendChild(el('span', { class: 'note', html: '时间压缩' })); bar.appendChild(spd);
    function syncSpd() { Array.prototype.forEach.call(spd.children, function (b) { b.className = 'btn sm' + (+b.dataset.v === st.speed ? ' on' : ''); }); }

    var tl = el('div', { class: 'tl' }), tlf = el('div', { class: 'tl-fill' });
    tl.appendChild(tlf); cl.appendChild(tl);
    var alarm = el('div', { class: 'err', style: { display: 'none', margin: '8px 0' } }); cl.appendChild(alarm);

    var stepUL = el('ol', { class: 'step-list' });
    PHASES.forEach(function (p, k) {
      stepUL.appendChild(el('li', {}, [el('span', { class: 'sn', text: String(k) }),
      el('div', {}, [el('b', { text: p[0] }), el('i', { text: p[1] })])]));
    });
    cl.appendChild(el('div', { class: 'panel-dark', style: { margin: '8px 0 0' } }, [
      el('div', { class: 'h4', text: '换料时序（15 个阶段，第 4–12 阶段按 84 盒循环）' }), stepUL
    ]));

    var pnl = el('div', { class: 'panel-dark', style: { margin: 0 } }); cr.appendChild(pnl);
    pnl.appendChild(el('div', { class: 'h4', text: '机构状态' }));
    var R = {};
    [['当前动作', ''], ['大旋塞 α', '°'], ['小旋塞 β（相对）', '°'], ['抓具半径 r', 'mm'], ['肘位解', ''],
    ['抓具标高', 'm'], ['组件底部标高', 'm'], ['顶部浸没深度', 'mm'], ['抓具载荷', 'kN'],
    ['已更换组件', '/ 84'], ['工艺累计时间', ''], ['单盒节拍', 'min']].forEach(function (p) {
      R[p[0]] = S.readout(pnl, p[0], p[1]);
    });
    pnl.appendChild(el('div', { class: 'h4', text: '换料许可与联锁', style: { marginTop: '10px' } }));
    var ilkBox = el('div'); pnl.appendChild(ilkBox);
    var ilkNodes = interlocks().map(function (i) {
      var n = el('div', { class: 'ilk' }, [el('span', { class: 'lamp' }), el('span', { class: 't', html: i.n }), el('span', { class: 'v' })]);
      ilkBox.appendChild(n); return n;
    });
    var pnl2 = el('div', { class: 'panel-dark' }); cr.appendChild(pnl2);
    pnl2.appendChild(el('div', { class: 'h4', text: '堆芯 / 贮存状态' }));
    var R2 = {};
    [['堆芯燃料组件', '盒'], ['本循环卸出', '盒'], ['贮存格架占用', '/ 76'], ['新燃料暂存', '/ 6'],
    ['最高燃耗组件', 'GWd/t'], ['乏组件衰变热', 'kW'], ['钠温', '°C'], ['k<sub>eff</sub>', '']].forEach(function (p) {
      R2[p[0]] = S.readout(pnl2, p[0], p[1]);
    });

    /* ---- 运行时 ---- */
    var queue = [], cur = null, curP = 0, curT = 0, tPrev = 0, cycleT = 0, cycleStart = 0;
    function reset() {
      CELLS.length = 0; buildCells().forEach(function (c) { CELLS.push(c); });
      byKey = {}; CELLS.forEach(function (c) { byKey[c.i + ',' + c.j] = c; });
      st.a = 0; st.b = PI; st.hoist = G.zPark; st.claw = 0; st.carried = null; st.srcCell = null; st.dstCell = null;
      st.locked = true; st.sealed = true; st.uncoupled = false; st.rodsIn = true;
      st.T = 545; st.keff = 1.0; st.level = 9.70; st.load = 0; st.phase = 0; st.act = '待启动';
      st.clock = 0; st.batch = 0; st.alarm = null; st.trail = []; st.playing = false; st.done = false;
      queue = prologue(); cur = null; curP = 0; cycleT = 0; cycleStart = 0;
      plan.paint(); render(); sync();
    }
    function toggle() { if (st.done) { reset(); } st.playing = !st.playing; st.alarm = null; sync(); }
    function sync() {
      bPlay.innerHTML = st.playing ? '⏸ 暂停' : (st.batch || cur ? '▶ 继续' : '▶ 开始换料');
      alarm.style.display = st.alarm ? '' : 'none';
      alarm.textContent = st.alarm || '';
      syncSpd();
    }
    function badOp() {
      st.playing = false;
      st.locked = false; st.hoist = 5.2; st.carried = null; st.claw = 0;
      var ok = rotatePermit();
      st.alarm = ok ? '（未触发）' : '⚠ 互锁 A 动作：抓具在 5.20 m（既非停放高度、也不在转运窗口 3.90–4.30 m 内），旋塞转动回路被机械凸轮 + 位置开关切断。若强行转动，抓具将扫过堆芯组件顶部与热套管。';
      st.act = '互锁演示：旋塞转动被拒绝';
      render(); sync();
    }
    function pick(c) {
      if (c.type === 'F1' || c.type === 'F2') { manual = c; st.alarm = '已指定下一作业目标：' + c.id + '（燃耗 ' + c.bu.toFixed(1) + ' GWd/t，r = ' + (c.r * 1000).toFixed(0) + ' mm）'; }
      else st.alarm = '该栅元（' + TYPE[c.type].n + '）不是可换料的燃料位';
      sync(); render();
    }
    window.__rfPick = pick;

    function stepOnce() {
      if (!cur) {
        if (!queue.length) {
          if (st.batch >= G.nReplace) { queue = epilogue(); st.done = true; }
          else { queue = cycleActions(); if (!cycleStart) cycleStart = st.clock; }
        }
        cur = queue.shift();
        if (!cur) { st.playing = false; return; }
        st.phase = cur.ph; st.act = cur.name;
        var ok = cur.init ? cur.init() : true;
        if (ok === false) { st.playing = false; cur = null; sync(); return; }
        curP = 0; curT = 0;
      }
      cur.run && cur.run(1);
      cur.end && cur.end();
      st.clock += (cur.rt || 0) * G.overhead;
      cur = null;
      render();
    }
    function advance(dtReal) {
      var budget = dtReal * st.speed;
      var guard = 0;
      while (budget > 0 && st.playing && guard++ < 200) {
        if (!cur) {
          if (!queue.length) {
            if (st.batch >= G.nReplace) { if (!st.done) { queue = epilogue(); st.done = true; } else { st.playing = false; break; } }
            else { queue = cycleActions(); if (!cycleStart) cycleStart = st.clock; }
          }
          cur = queue.shift();
          st.phase = cur.ph; st.act = cur.name;
          var ok = cur.init ? cur.init() : true;
          if (ok === false) { st.playing = false; cur = null; sync(); break; }
          curT = 0;
        }
        var rt = cur.rt || 1;
        var eff = cur.fast ? Math.min(rt, 3 * st.speed) : rt;   // 长时工艺步压缩为 ~3 s 动画
        var use = Math.min(budget, eff - curT);
        curT += use; budget -= use;
        cur.run && cur.run(S.clamp(curT / eff, 0, 1));
        if (curT >= eff - 1e-9) {
          cur.end && cur.end();
          st.clock += rt * G.overhead;
          if (cur.ph === 12 && cur.name === '批次计数 +1') { cycleT = st.clock - cycleStart; cycleStart = st.clock; }
          cur = null;
        }
      }
    }
    function render() {
      var pos = fwd(st.a, st.b), rg = Math.hypot(pos.x, pos.y);
      plan.update(); elev.update();
      R['当前动作'].set(st.act);
      R['大旋塞 α'].set((norm(st.a) * R2D).toFixed(2));
      R['小旋塞 β（相对）'].set((norm(st.b) * R2D).toFixed(2));
      R['抓具半径 r'].set((rg * 1000).toFixed(0), rg <= G.reach ? 'ok' : 'bad');
      R['肘位解'].set(norm(st.b) >= 0 ? '肘上 β>0' : '肘下 β<0');
      R['抓具标高'].set(st.hoist.toFixed(3));
      R['组件底部标高'].set(st.carried ? (st.hoist - G.zTop).toFixed(3) : '—');
      R['顶部浸没深度'].set(st.carried ? ((st.level - st.hoist) * 1000).toFixed(0) : '—',
        st.carried ? ((st.level - st.hoist) >= 0.3 ? 'ok' : 'bad') : '');
      R['抓具载荷'].set(st.load.toFixed(2), st.load > 5 ? 'bad' : st.load > 2.6 && st.load < 5 ? 'ok' : '');
      R['已更换组件'].set(String(st.batch));
      R['工艺累计时间'].set(fmtDur(st.clock));
      R['单盒节拍'].set(cycleT ? (cycleT / 60).toFixed(1) : '—');
      var ilk = interlocks(), allok = true;
      ilk.forEach(function (i, k) {
        var n = ilkNodes[k];
        var cls = i.ok ? 'g' : (k === 9 ? 'y' : (k === 8 && st.locked ? 'y' : 'r'));
        n.className = 'ilk ' + cls;
        n.children[2].textContent = i.v;
        if (!i.ok && k !== 9 && !(k === 8 && st.locked)) allok = false;
      });
      var occ = CELLS.filter(function (c) { return c.type === 'IVS' && c.occupied; }).length;
      var nw = CELLS.filter(function (c) { return c.type === 'NEW' && c.occupied; }).length;
      var maxbu = 0; CELLS.forEach(function (c) { if ((c.type === 'F1' || c.type === 'F2') && c.occupied) maxbu = Math.max(maxbu, c.bu); });
      R2['堆芯燃料组件'].set(String(CELLS.filter(function (c) { return (c.type === 'F1' || c.type === 'F2') && c.occupied; }).length));
      R2['本循环卸出'].set(String(occ));
      R2['贮存格架占用'].set(String(occ));
      R2['新燃料暂存'].set(String(nw), nw ? 'ok' : 'warn');
      R2['最高燃耗组件'].set(maxbu.toFixed(1));
      R2['乏组件衰变热'].set(st.carried && st.carried.kind === 'spent' ? '8.0' : '—');
      R2['钠温'].set(st.T.toFixed(0), st.T >= 180 && st.T <= 250 ? 'ok' : 'warn');
      R2['k<sub>eff</sub>'].set(st.keff.toFixed(3), st.keff <= 0.95 ? 'ok' : 'bad');
      tlf.style.width = (100 * S.clamp(st.batch / G.nReplace, 0, 1)) + '%';
      Array.prototype.forEach.call(stepUL.children, function (li, k) {
        li.className = k === st.phase ? 'cur' : (k < st.phase || (st.batch > 0 && k <= 12) ? 'done' : '');
      });
    }
    function fmtDur(s) {
      if (s < 60) return s.toFixed(0) + ' s';
      if (s < 3600) return (s / 60).toFixed(1) + ' min';
      if (s < 86400) return (s / 3600).toFixed(2) + ' h';
      return (s / 86400).toFixed(2) + ' d';
    }
    var last = 0;
    function loop(ts) {
      var dt = Math.min(0.06, (ts - last) / 1000 || 0.016); last = ts;
      if (st.playing && !document.hidden) { advance(dt); render(); }
      requestAnimationFrame(loop);
    }
    reset();
    requestAnimationFrame(loop);

    /* ---- 机构参数小结 ---- */
    var sum = el('div', { class: 'grid2', style: { marginTop: '14px' } });
    fig.body.appendChild(sum);
    var t1 = el('div', { class: 'panel-dark', style: { margin: 0 } });
    t1.appendChild(el('div', { class: 'h4', text: '逆运动学校核（页内实算）' }));
    S.table({
      parent: t1, head: ['作业半径 r / mm', 'β / °', 'α−θ 偏移 δ / °', '可达'],
      rows: [0, 155, 310, 620, 930, 1240, 1395, 1550, 1705, 1860, 2015, 2170, 2240, 2300].map(function (r) {
        var s2 = ik(r / 1000, 0, 0, PI);
        var reach = r / 1000 <= G.reach + 1e-9;
        return [String(r), reach ? (s2.b * R2D).toFixed(2) : '—',
        reach ? (Math.atan2(G.e2 * Math.sin(s2.b), G.e1 + G.e2 * Math.cos(s2.b)) * R2D).toFixed(2) : '—',
        { html: reach ? '<b class="ok">是</b>' : '<b class="bad">否</b>' }];
      }),
      foot: 'r = 0 为奇异位形（β = 180°，α 不定）；r = 2 170 mm 为环 14（最外作业圈），余量 70 mm；r = 2 300 mm 已超出 e₁+e₂ = 2 240 mm，不可达。'
    });
    sum.appendChild(t1);
    var t2 = el('div', { class: 'panel-dark', style: { margin: 0 } });
    t2.appendChild(el('div', { class: 'h4', text: '栅元清单（与第 1 章表 1-2 一致）' }));
    S.table({
      parent: t2, head: ['类别', '数量', '环'],
      rows: [['内区燃料 F1', STAT.F1, '0–6'], ['外区燃料 F2', STAT.F2, '7–9'],
      ['控制棒位（SR-1/SR-2/RR）', STAT.rods + '（12/4/3）', '0,3,5,6,7'],
      ['钢反射体', STAT.REF, '10–11'], ['B₄C 屏蔽', STAT.SHD, '12–13'],
      ['乏燃料贮存位', 76, '14'], ['新燃料暂存位', 6, '14'], ['转运位 / 堵块', '1 / 1', '14'],
        { cls: 'tot', cells: ['栅元合计', 631, '0–14'] }],
      foot: '六角栅格节距 155 mm；环 n 的角向半径 = 155·n mm；总位置数 = 1 + 3n(n+1)。'
    });
    sum.appendChild(t2);
  }

  S.register('refuel', mount);
  window.SFR_REFUEL = { G: G, CELLS: CELLS, ik: ik, fwd: fwd, st: st, STAT: STAT };
})();
