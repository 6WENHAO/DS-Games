/* ============================================================================
   第 7 章：非能动衰变热排出（DRACS / RVACS）+ 固有安全裕度定量判据
   ==========================================================================*/
(function () {
  'use strict';
  var S = window.SFR, el = S.el, sv = S.svg;
  var P0 = 1500e6, decay = (window.SFR_PLANT || {}).decay;

  /* 非能动排热标定：单列在池温 550 °C、环境 30 °C 时 10 MW；两侧均自然循环 ⇒ Q ∝ ΔT^1.5 */
  var K_TRAIN = 10e6 / Math.pow(520, 1.5);
  var RVACS_K = 2.5e6 / Math.pow(520, 1.5);
  function poolTemp(Q, n, Tamb) {
    var k = n * K_TRAIN + RVACS_K;
    return Tamb + Math.pow(Math.max(0, Q) / k, 2 / 3);
  }
  function trainQ(Tpool, Tamb) { return K_TRAIN * Math.pow(Math.max(0, Tpool - Tamb), 1.5); }
  /* 中间钠回路自然循环：w ∝ Q^(1/3)（浮升头 ∝ ΔT·H，摩擦 ∝ w²，Q = w·cp·ΔT） */
  var WREF = 61, QREF = 10e6, CPNA = 1270;
  function natFlow(Q) { return WREF * Math.pow(Math.max(1e3, Q) / QREF, 1 / 3); }

  function fmtT(t) {
    if (t < 60) return t.toFixed(0) + ' s';
    if (t < 3600) return (t / 60).toFixed(0) + ' min';
    if (t < 86400) return (t / 3600).toFixed(1) + ' h';
    return (t / 86400).toFixed(1) + ' d';
  }

  function mount(host) {
    /* ---------- 图：DRACS + RVACS ---------- */
    var fig = S.figure({
      parent: host, title: '非能动衰变热排出系统：DRACS（4 列）与 RVACS（最终手段）',
      drawNo: 'CFR1500-S-701', scale: '不按比例', unit: '—', bodyCls: 'dark',
      note: 'DRACS 每列由浸没式钠-钠冷却器 DHX（热池内）、中间钠回路（<b>无泵</b>，自然循环）、空气冷却器 AHX 与自然通风烟囱组成，全程无转动部件、无阀门动作要求；空气侧风门为"失效开启"型。RVACS 沿保护容器外壁靠空气自然对流排热，是不依赖任何回路完整性的最后一道手段。'
    });
    var W = 900, H = 470, root = sv('svg', { viewBox: '0 0 ' + W + ' ' + H });
    fig.body.appendChild(root);
    root.appendChild(sv('style', { text: '.sy{font:9.4px ui-monospace,monospace;fill:#8d99a6}.sy.k{fill:#fff;font-weight:600}.sy.a{fill:#e8a33d}.sy.g{fill:#57c46a}' }));
    var defs = sv('defs'); root.appendChild(defs);
    var mk = sv('marker', { id: 'sar', viewBox: '0 0 8 8', refX: 4, refY: 4, markerWidth: 5, markerHeight: 5, orient: 'auto' });
    mk.appendChild(sv('path', { d: 'M0 1L6 4L0 7z', fill: '#9aa7b4' })); defs.appendChild(mk);
    var gS = sv('g'), gF = sv('g'), gL = sv('g');
    [gS, gF, gL].forEach(function (g) { root.appendChild(g); });
    function tx(x, y, t, c, a) { gL.appendChild(sv('text', { x: x, y: y, class: 'sy ' + (c || ''), 'text-anchor': a || 'start', text: t })); }
    function bx(x, y, w, h, f, s) { gS.appendChild(sv('rect', { x: x, y: y, width: w, height: h, fill: f || '#1c2530', stroke: s || '#9aa7b4', 'stroke-width': 1.5 })); }
    function pp(d, c, w) { gS.appendChild(sv('path', { d: d, fill: 'none', stroke: c || '#5b6875', 'stroke-width': w || 4 })); }

    /* 主容器 + 保护容器（局部） */
    gS.appendChild(sv('path', { d: 'M120 150V400Q210 448 300 400V150', fill: 'rgba(200,90,45,.18)', stroke: '#cfd8e0', 'stroke-width': 2.5 }));
    gS.appendChild(sv('path', { d: 'M104 150V404Q210 462 316 404V150', fill: 'none', stroke: '#7b8894', 'stroke-width': 2 }));
    gS.appendChild(sv('line', { x1: 120, y1: 172, x2: 300, y2: 172, stroke: '#e07a3a', 'stroke-width': 2 }));
    tx(210, 166, '热池', 'a', 'middle'); tx(210, 300, '堆芯 + 一回路', 'k', 'middle');
    tx(210, 320, '衰变热源', '', 'middle');
    tx(112, 140, '主容器 / 保护容器', '', 'middle');

    /* DHX */
    bx(232, 186, 46, 96);
    for (var i = 0; i < 5; i++) pp('M' + (238 + i * 9) + ' 190V278', '#39424d', 2);
    tx(255, 300, 'DHX', 'k', 'middle'); tx(255, 314, '10 MW', '', 'middle');

    /* 中间钠回路（自然循环） */
    pp('M255 186V96H470', '#8a5a3a', 4.5);
    pp('M470 300H340V282H278', '#4a6f8c', 4.5);
    bx(392, 40, 78, 40, '#1c2530'); tx(431, 64, '膨胀箱', 'k', 'middle');
    pp('M431 80V96', '#5b6875', 3);
    tx(350, 88, '上升段 ≈ 12 m 热柱', 'a', 'middle');
    tx(350, 276, '下降段（冷）', '', 'middle');

    /* AHX + 烟囱 */
    bx(470, 70, 96, 130); tx(518, 130, 'AHX', 'k', 'middle'); tx(518, 146, '钠-空气', '', 'middle');
    for (var j = 0; j < 8; j++) pp('M' + (478 + j * 12) + ' 74V196', '#39424d', 2);
    pp('M566 70H640V26H700V26', 'none', 0);
    gS.appendChild(sv('path', { d: 'M600 200V60H700V200', fill: 'none', stroke: '#7b8894', 'stroke-width': 2.5 }));
    gS.appendChild(sv('path', { d: 'M600 60H700', fill: 'none', stroke: '#7b8894', 'stroke-width': 1, 'stroke-dasharray': '4 3' }));
    tx(650, 50, '烟囱 30 m（自然通风）', '', 'middle');
    bx(600, 200, 100, 108, 'rgba(47,111,140,.10)', '#4a5560');
    tx(650, 258, '空气通道', '', 'middle');
    pp('M566 136H600', '#5b6875', 4);
    pp('M700 250H760', '#4a6f8c', 4);
    gS.appendChild(sv('path', { d: 'M760 236h26v28h-26z', fill: '#232b34', stroke: '#57c46a', 'stroke-width': 1.6 }));
    tx(773, 284, '风门', 'g', 'middle'); tx(773, 298, '失效开启', 'g', 'middle');
    pp('M786 250H840V420H600V308', '#4a6f8c', 3.4);
    tx(820, 436, '进风（30 °C）', '', 'middle');

    /* RVACS */
    bx(40, 150, 22, 254, 'rgba(47,111,140,.14)', '#4a5560');
    tx(30, 140, 'RVACS', 'g', 'middle'); tx(30, 420, '2.5 MW', 'g', 'middle');
    pp('M51 404V430H30', '#4a6f8c', 3);
    pp('M51 150V120H30', '#c07a4a', 3);
    tx(20, 280, '保护容器外壁', '', 'end');

    /* 流线 */
    var stt = { Q: 15.75e6, n: 4, Tp: 470, Tamb: 30, w: 61, dT: 120, wAir: 82 };
    function leg(g, d, gap) {
      var p = sv('path', { d: d, fill: 'none', stroke: 'rgba(150,170,190,.14)', 'stroke-width': 3 });
      g.appendChild(p);
      var len = (p.getTotalLength ? p.getTotalLength() : 0), n = Math.max(2, Math.round(len / gap)), dots = [];
      for (var k = 0; k < n; k++) { var c = sv('circle', { r: 2.6, cx: -9, cy: -9 }); g.appendChild(c); dots.push({ node: c, s: len * k / n }); }
      return { path: p, len: len, dots: dots };
    }
    var LG = [
      { l: leg(gF, 'M255 190V96H470V130', 24), t0: function (s) { return s.Tp; }, t1: function (s) { return s.Tp; }, v: 1 },
      { l: leg(gF, 'M518 80V196', 20), t0: function (s) { return s.Tp; }, t1: function (s) { return s.Tp - s.dT; }, v: 1 },
      { l: leg(gF, 'M518 196V212H470V300H340V282H278', 24), t0: function (s) { return s.Tp - s.dT; }, t1: function (s) { return s.Tp - s.dT; }, v: 1 },
      { l: leg(gF, 'M255 282V196', 20), t0: function (s) { return s.Tp - s.dT; }, t1: function (s) { return s.Tp; }, v: 1 },
      { l: leg(gF, 'M830 410H612V310', 26), t0: function () { return 30; }, t1: function () { return 30; }, v: 1.4, air: 1 },
      { l: leg(gF, 'M612 300V210', 22), t0: function () { return 30; }, t1: function (s) { return 30 + 0.32 * (s.Tp - 30); }, v: 1.4, air: 1 },
      { l: leg(gF, 'M650 200V64', 26), t0: function (s) { return 30 + 0.32 * (s.Tp - 30); }, t1: function (s) { return 30 + 0.30 * (s.Tp - 30); }, v: 1.7, air: 1 },
      { l: leg(gF, 'M51 400V160', 26), t0: function () { return 30; }, t1: function (s) { return 30 + 0.22 * (s.Tp - 30); }, v: 1.0, air: 1 }
    ];
    function paint() {
      LG.forEach(function (L) {
        L.l.dots.forEach(function (d) {
          var f = d.s / L.l.len, T = S.lerp(L.t0(stt), L.t1(stt), f);
          d.node.setAttribute('fill', L.air ? (T < 60 ? '#6fa8d6' : T < 140 ? '#c8b96a' : '#d9853f') : S.colorT(T));
          if (!L.l.path.getPointAtLength) return; var pt = L.l.path.getPointAtLength(d.s);
          d.node.setAttribute('cx', pt.x.toFixed(1)); d.node.setAttribute('cy', pt.y.toFixed(1));
        });
      });
    }
    var reduce = false;
    try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { }
    var last = 0;
    function loop(ts) {
      var dt = Math.min(0.05, (ts - last) / 1000 || 0.016); last = ts;
      if (!document.hidden && !reduce) {
        var k = stt.w / WREF;
        LG.forEach(function (L) {
          var v = L.v * 30 * (L.air ? stt.wAir / 82 : k);
          L.l.dots.forEach(function (d) {
            d.s = (d.s + v * dt) % L.l.len;
            if (!L.l.path.getPointAtLength) return; var pt = L.l.path.getPointAtLength(d.s);
            d.node.setAttribute('cx', pt.x.toFixed(1)); d.node.setAttribute('cy', pt.y.toFixed(1));
          });
        });
      }
      requestAnimationFrame(loop);
    }

    /* ---------- 控制台 ---------- */
    var con = el('div', { class: 'rf-console' }), cl = el('div'), cr = el('div', { class: 'panel-dark', style: { margin: 0 } });
    con.appendChild(cl); con.appendChild(cr); fig.body.appendChild(con);
    var nTrain = 4, tAft = 3600, Tamb = 30;
    var slT = S.slider({
      parent: cl, label: '停堆后时间', min: 0, max: 66, step: 1, value: 36,
      format: function (v) { return fmtT(Math.pow(10, v / 12)); },
      oninput: function (v) { tAft = Math.pow(10, v / 12); upd(); }
    });
    var rowT = el('div', { class: 'ctrl-row' }); cl.appendChild(rowT);
    rowT.appendChild(el('span', { class: 'note', html: '可用 DRACS 列数' }));
    var tb = [];
    [1, 2, 3, 4].forEach(function (n) {
      var b = S.btn(String(n), function () { nTrain = n; tb.forEach(function (x, k) { x.className = 'btn sm' + (k + 1 === nTrain ? ' on' : ''); }); upd(); }, 'sm' + (n === 4 ? ' on' : ''));
      tb.push(b); rowT.appendChild(b);
    });
    S.slider({
      parent: cl, label: '环境温度', min: -20, max: 45, step: 1, value: 30, unit: '°C',
      oninput: function (v) { Tamb = v; upd(); }
    });
    cl.appendChild(el('div', {
      class: 'note', html: '排热能力模型：两侧均为自然循环 ⇒ <span class="fx">Q = k·(T<sub>池</sub> − T<sub>环境</sub>)<sup>1.5</sup></span>，' +
        '按"单列在池温 550 °C、环境 30 °C 时 10 MW"标定；中间钠回路流量按浮升-摩擦平衡的 <span class="fx">w ∝ Q<sup>1/3</sup></span> 标定。' +
        '判据：池温上限 650 °C（结构与蠕变），下限 150 °C（<b>防钠凝固</b>）。'
    }));
    var R = {};
    cr.appendChild(el('div', { class: 'h4', text: '非能动排热平衡' }));
    [['衰变热份额', '% P₀'], ['衰变热功率', 'MW'], ['单列排热能力', 'MW'], ['系统排热能力', 'MW'],
    ['平衡池温', '°C'], ['中间回路流量/列', 'kg/s'], ['DHX 侧 ΔT', 'K'], ['空气流量/列', 'kg/s'],
    ['结构温度判定', ''], ['凝固风险判定', '']].forEach(function (p) { R[p[0]] = S.readout(cr, p[0], p[1]); });

    var chart = S.chart({
      w: 620, h: 300, yLog: true, xLog: true, xLabel: '停堆后时间 / s', yLabel: '功率 / MW',
      yDomain: [0.5, 200], xDomain: [1, 5e6], legend: true, series: []
    });
    var f2 = S.figure({
      parent: host, title: '衰变热与非能动排热能力的时间关系', drawNo: 'CFR1500-S-702',
      scale: '—', unit: '—', bodyCls: 'dark',
      note: '结论：<b>停堆最初约 6 h 内需要至少 2 列 DRACS</b>（或 1 列 DRACS + 二回路自然循环）；6 h 以后单列即可。' +
        '另一侧的约束常被忽略 —— 4 列全开时，24 h 后池温会被拉到 190 °C 附近，接近钠凝固裕度，因此空气侧风门必须可调节（而不是简单地"越多越好"）。'
    });
    f2.body.appendChild(chart.root);

    function upd() {
      var frac = decay ? decay(tAft) : 0.01, Q = P0 * frac;
      var Tp = poolTemp(Q, nTrain, Tamb);
      var qT = trainQ(Tp, Tamb), w = natFlow(Q / Math.max(1, nTrain)), dT = (Q / Math.max(1, nTrain)) / (w * CPNA);
      var wAir = (Q / Math.max(1, nTrain)) / (1010 * 120);
      stt = { Q: Q, n: nTrain, Tp: Tp, Tamb: Tamb, w: w, dT: dT, wAir: wAir };
      R['衰变热份额'].set((frac * 100).toFixed(3));
      R['衰变热功率'].set(S.fmt(Q / 1e6, 2));
      R['单列排热能力'].set(S.fmt(qT / 1e6, 2));
      R['系统排热能力'].set(S.fmt((nTrain * qT + RVACS_K * Math.pow(Math.max(0, Tp - Tamb), 1.5)) / 1e6, 2));
      R['平衡池温'].set(Tp.toFixed(0), Tp > 650 ? 'bad' : Tp < 150 ? 'bad' : Tp > 600 || Tp < 200 ? 'warn' : 'ok');
      R['中间回路流量/列'].set(w.toFixed(1));
      R['DHX 侧 ΔT'].set(dT.toFixed(0));
      R['空气流量/列'].set(wAir.toFixed(0));
      R['结构温度判定'].set(Tp <= 650 ? '合格 ≤ 650 °C' : '超限', Tp <= 650 ? 'ok' : 'bad');
      R['凝固风险判定'].set(Tp >= 150 ? '合格 ≥ 150 °C' : '风险', Tp >= 150 ? 'ok' : 'bad');
      paint();
      var ts = [], k;
      for (k = 0; k <= 80; k++) ts.push(Math.pow(10, k / 80 * Math.log10(5e6)));
      var sers = [{ name: '衰变热', color: '#b0303a', pts: ts.map(function (t) { return [t, P0 * (decay ? decay(t) : 0.01) / 1e6]; }), width: 2.2 }];
      [1, 2, 4].forEach(function (n, idx) {
        sers.push({
          name: n + ' 列 DRACS 在池温 550 °C 的能力', color: ['#6b6257', '#2f6f8c', '#3f7a45'][idx],
          pts: [[1, n * 10], [5e6, n * 10]], dash: '5 3', width: 1.4
        });
      });
      sers.push({ name: 'RVACS（池温 550 °C）', color: '#8a4b8f', pts: [[1, 2.5], [5e6, 2.5]], dash: '2 3', width: 1.2 });
      sers.push({ name: '当前工况点', color: '#e8a33d', type: 'dot', pts: [[tAft, Q / 1e6]], width: 5 });
      chart.update(sers);
    }
    upd();
    requestAnimationFrame(loop);

    /* ---------- 衰变热表 ---------- */
    var rows = [[1, '瞬发裂变停止后 1 s'], [60, '一回路强迫循环仍在惰转'], [600, '二回路或 DRACS 接管'],
    [3600, 'DRACS ≥ 2 列'], [21600, 'DRACS 1 列足够'], [86400, 'DRACS 1 列 + 风门节流'],
    [604800, '风门大幅节流防凝固'], [2592000, '换料窗口：组件仍需钠冷却']];
    S.table({
      parent: host, caption: '表 7-3　衰变热与排热手段的时间序列 <i>衰变热曲线为分段对数插值的典型 MOX 快堆值</i>',
      head: ['停堆后时间', 'P/P₀ / %', '功率 / MW', '4 列全开时的平衡池温 / °C', '1 列时的平衡池温 / °C', '排热手段'],
      rows: rows.map(function (r) {
        var f = decay ? decay(r[0]) : 0.01, Q = P0 * f;
        var t4 = poolTemp(Q, 4, 30), t1 = poolTemp(Q, 1, 30);
        return [fmtT(r[0]), (f * 100).toFixed(3), (Q / 1e6).toFixed(1),
        { html: (t4 < 150 ? '<b class="bad">' : t4 > 650 ? '<b class="bad">' : '<b class="ok">') + t4.toFixed(0) + '</b>', cls: 'num' },
        { html: (t1 < 150 ? '<b class="bad">' : t1 > 650 ? '<b class="bad">' : '<b class="ok">') + t1.toFixed(0) + '</b>', cls: 'num' },
          { html: r[1], cls: 'l' }];
      }),
      foot: '红色 = 越过 650 °C 结构限值或跌破 150 °C 凝固裕度。表中"平衡池温"是稳态解，实际瞬态受 780 t 钠的热惯量强烈平滑：以 P = 1% P₀ = 15 MW、m·c<sub>p</sub> = 780 t × 1.27 kJ/(kg·K) = 990 MJ/K 计，池温升速率仅 0.015 K/s（54 K/h），因此运行人员有数小时的响应时间。'
    });

    /* ---------- 固有安全裕度判据 ---------- */
    var pan = el('div', { class: 'panel' });
    pan.appendChild(el('div', { class: 'h4', text: '固有安全裕度的定量判据（Wade–Hill 准静态积分参数）' }));
    pan.appendChild(el('div', {
      class: 'note', html:
        '把反应性反馈按驱动量分成三项：<span class="fx">ρ = A·(P/P₀ − 1) + B·(P/F − 1) + C·(T<sub>in</sub> − T<sub>in,0</sub>)</span>，' +
        'A 为随功率变化的燃料相关项，B 为随"功率/流量比"变化的冷却剂温升相关项，C 为入口温度系数。'
    }));
    S.table({
      parent: pan, head: ['参数', '取自本设计的分项', '数值'],
      rows: [
        ['A（燃料相关，∝ P）', '多普勒 −453 + 燃料轴向膨胀 −210 + 包壳轴向 −33', '−696 pcm'],
        ['B（冷却剂温升相关，∝ P/F）', '钠密度 +21 + 组件弯曲 −105 + 驱动线膨胀 −120', '−204 pcm'],
        ['C（入口温度系数）', '结构与钠密度对入口温度的响应', '−1.2 pcm/K'],
        { cls: 'tot', cells: ['|A/B|', '无保护失流（ULOF）渐近温升的放大因子，目标 ≤ 1', '3.4'] }
      ],
      foot: '<b>这是本设计最重要的一个负面结论</b>：|A/B| = 3.4 ≫ 1 意味着仅靠固有反馈，完全失流后堆芯出口温度的渐近值会显著超过额定温升，' +
        '不足以自行进入安全渐近态。因此 SASS（居里点合金自持脱扣，700 °C 动作）与 4 列非能动排热在本设计中<b>不是可选的增强项，而是设计必需项</b>；' +
        '若要把 |A/B| 压到 1 附近，可行的方向是增大 B（例如引入 GEM 气体膨胀模块，使失流时钠空泡效应贡献强负反应性）或降低堆芯功率密度，两者都需要在后续设计阶段权衡。'
    });
    host.appendChild(pan);
  }
  S.register('safety', mount);
})();
