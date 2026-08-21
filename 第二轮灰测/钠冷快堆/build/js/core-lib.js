/* ============================================================================
   CFR-1500 设计文件 · 共用绘图/数值基础库
   无外部依赖。所有图表为运行时生成的 SVG。
   ==========================================================================*/
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';

  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === 'class') e.className = attrs[k];
      else if (k === 'html') e.innerHTML = attrs[k];
      else if (k === 'text') e.textContent = attrs[k];
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), attrs[k]);
      else if (k === 'style' && typeof attrs[k] === 'object') { for (var s in attrs[k]) e.style[s] = attrs[k][s]; }
      else e.setAttribute(k, attrs[k]);
    }
    (kids || []).forEach(function (c) { if (c) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  function svg(tag, attrs, kids) {
    var e = document.createElementNS(NS, tag);
    if (attrs) for (var k in attrs) {
      if (k === 'text') e.textContent = attrs[k];
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), attrs[k]);
      else e.setAttribute(k, attrs[k]);
    }
    (kids || []).forEach(function (c) { if (c) e.appendChild(c); });
    return e;
  }

  /* ---------- 数值/格式 ---------- */
  function fmt(v, d) {
    if (v === null || v === undefined || !isFinite(v)) return '—';
    d = (d === undefined) ? 2 : d;
    var s = Math.abs(v) >= 1e5 || (Math.abs(v) < 1e-3 && v !== 0)
      ? v.toExponential(Math.max(1, d))
      : v.toFixed(d);
    return s;
  }
  function fmtG(v, d) { // 千位分隔
    var s = fmt(v, d === undefined ? 0 : d), p = s.split('.');
    p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return p.join('.');
  }
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var ease = function (t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };
  var easeOut = function (t) { return 1 - Math.pow(1 - t, 3); };

  /* ---------- 温度配色 (钠回路: 320→560 °C) ---------- */
  var TSTOPS = [
    [150, [58, 92, 140]], [250, [64, 132, 168]], [330, [86, 170, 176]],
    [400, [176, 168, 108]], [470, [216, 150, 62]], [520, [222, 112, 50]],
    [560, [206, 66, 48]], [650, [176, 40, 52]]
  ];
  function colorT(T) {
    var s = TSTOPS;
    if (T <= s[0][0]) return 'rgb(' + s[0][1].join(',') + ')';
    for (var i = 1; i < s.length; i++) {
      if (T <= s[i][0]) {
        var t = (T - s[i - 1][0]) / (s[i][0] - s[i - 1][0]), c = [0, 0, 0];
        for (var j = 0; j < 3; j++) c[j] = Math.round(lerp(s[i - 1][1][j], s[i][1][j], t));
        return 'rgb(' + c.join(',') + ')';
      }
    }
    return 'rgb(' + s[s.length - 1][1].join(',') + ')';
  }

  /* ---------- 六角栅格 ---------- */
  // 轴向坐标 (i,j): P = i*p*(1,0) + j*p*(1/2, √3/2)
  function lattice(nRings, pitch) {
    var out = [], S3 = Math.sqrt(3) / 2;
    for (var i = -nRings; i <= nRings; i++)
      for (var j = -nRings; j <= nRings; j++) {
        var ring = Math.max(Math.abs(i), Math.abs(j), Math.abs(i + j));
        if (ring > nRings) continue;
        out.push({
          i: i, j: j, ring: ring,
          x: pitch * (i + j / 2), y: pitch * (j * S3),
          r: Math.hypot(pitch * (i + j / 2), pitch * j * S3)
        });
      }
    out.sort(function (a, b) { return a.ring - b.ring || Math.atan2(a.y, a.x) - Math.atan2(b.y, b.x); });
    return out;
  }
  // 顶点在 30°+k·60°, 对边距 = 2*R*cos30
  function hexPath(cx, cy, aFlat) {
    var R = aFlat / Math.sqrt(3), d = '';
    for (var k = 0; k < 6; k++) {
      var a = (30 + 60 * k) * Math.PI / 180;
      d += (k ? 'L' : 'M') + (cx + R * Math.cos(a)).toFixed(2) + ' ' + (cy + R * Math.sin(a)).toFixed(2) + ' ';
    }
    return d + 'Z';
  }

  /* ---------- 图表 ----------
     opts: {w,h,pad:{l,r,t,b}, xLabel,yLabel, xLog,yLog, xDomain,yDomain,
            series:[{name,color,pts:[[x,y]..],width,dash,fill,type:'line'|'step'|'dot'|'band'}],
            xTicks:[..]|n, yTicks, bands:[{x0,x1,label,color}], hlines:[{y,label,color,dash}],
            vlines:[{x,label,color,dash}], legend:true, title, grid:true}
     返回 {root, update(series[,domains]), toX,toY, redraw()}                        */
  function chart(opts) {
    var o = Object.assign({
      w: 640, h: 340, pad: { l: 62, r: 16, t: 16, b: 44 }, xLog: false, yLog: false,
      legend: true, grid: true, series: [], xLabel: '', yLabel: ''
    }, opts);
    var root = svg('svg', { class: 'chart', viewBox: '0 0 ' + o.w + ' ' + o.h, preserveAspectRatio: 'xMidYMid meet' });
    var gBack = svg('g'), gData = svg('g'), gFront = svg('g');
    root.appendChild(gBack); root.appendChild(gData); root.appendChild(gFront);
    var P = o.pad, W = o.w - P.l - P.r, H = o.h - P.t - P.b;
    var dx, dy;

    function autoDomain() {
      var xs = [], ys = [];
      o.series.forEach(function (s) {
        (s.pts || []).forEach(function (p) {
          if (isFinite(p[0]) && (!o.xLog || p[0] > 0)) xs.push(p[0]);
          if (isFinite(p[1]) && (!o.yLog || p[1] > 0)) ys.push(p[1]);
        });
      });
      if (!xs.length) { xs = o.xLog ? [1, 10] : [0, 1]; }
      if (!ys.length) { ys = o.yLog ? [1, 10] : [0, 1]; }
      dx = o.xDomain ? o.xDomain.slice() : [Math.min.apply(0, xs), Math.max.apply(0, xs)];
      dy = o.yDomain ? o.yDomain.slice() : [Math.min.apply(0, ys), Math.max.apply(0, ys)];
      if (!o.yDomain) { var m = (dy[1] - dy[0]) * 0.08 || Math.abs(dy[1] * 0.1) || 1; if (o.yLog) { dy[0] /= 1.6; dy[1] *= 1.6; } else { dy[0] -= m; dy[1] += m; } }
      if (dx[0] === dx[1]) dx[1] = dx[0] + 1;
      if (dy[0] === dy[1]) dy[1] = dy[0] + 1;
    }
    function toX(v) { return o.xLog ? P.l + W * (Math.log(v / dx[0]) / Math.log(dx[1] / dx[0])) : P.l + W * (v - dx[0]) / (dx[1] - dx[0]); }
    function toY(v) { return o.yLog ? P.t + H - H * (Math.log(v / dy[0]) / Math.log(dy[1] / dy[0])) : P.t + H - H * (v - dy[0]) / (dy[1] - dy[0]); }

    function ticks(dom, log, want) {
      if (log) {
        var t = [];
        if (!(dom[0] > 0) || !(dom[1] > 0) || !isFinite(dom[0]) || !isFinite(dom[1])) return [{ v: 1, major: true }];
        var e0 = Math.floor(Math.log10(dom[0])), e1 = Math.ceil(Math.log10(dom[1]));
        if (!isFinite(e0) || !isFinite(e1) || e1 - e0 > 40) return [{ v: dom[0], major: true }, { v: dom[1], major: true }];
        for (var e = e0; e <= e1; e++) for (var m = 1; m < 10; m++) {
          var v = m * Math.pow(10, e);
          if (v >= dom[0] * 0.999 && v <= dom[1] * 1.001) t.push({ v: v, major: m === 1 });
        }
        return t;
      }
      want = want || 6;
      var span = dom[1] - dom[0];
      if (!(span > 0) || !isFinite(span)) return [{ v: dom[0], major: true }];
      var step = Math.pow(10, Math.floor(Math.log10(span / want)));
      [1, 2, 2.5, 5, 10].some(function (f) { if (span / (step * f) <= want) { step *= f; return true; } });
      var out = [], s = Math.ceil(dom[0] / step) * step;
      for (var v2 = s; v2 <= dom[1] + step * 1e-6; v2 += step) out.push({ v: +v2.toPrecision(12), major: true });
      return out;
    }
    function tlab(v, log) {
      if (log) { var e = Math.log10(v); return Math.abs(v) >= 1e4 || Math.abs(v) < 1e-2 ? '10' + sup(Math.round(e)) : String(+v.toPrecision(3)); }
      return String(+v.toPrecision(6));
    }
    function sup(n) { var m = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' }; return String(n).split('').map(function (c) { return m[c] || c; }).join(''); }

    function path(pts, step) {
      var d = '', on = false;
      for (var i = 0; i < pts.length; i++) {
        var p = pts[i];
        if (!p || !isFinite(p[0]) || !isFinite(p[1]) || (o.xLog && p[0] <= 0) || (o.yLog && p[1] <= 0)) { on = false; continue; }
        var X = toX(p[0]), Y = toY(p[1]);
        if (!on) { d += 'M' + X.toFixed(2) + ' ' + Y.toFixed(2); on = true; }
        else if (step) { d += 'H' + X.toFixed(2) + 'V' + Y.toFixed(2); }
        else d += 'L' + X.toFixed(2) + ' ' + Y.toFixed(2);
      }
      return d;
    }

    function redraw() {
      autoDomain();
      gBack.textContent = ''; gData.textContent = ''; gFront.textContent = '';
      (o.bands || []).forEach(function (b) {
        gBack.appendChild(svg('rect', {
          x: toX(b.x0), y: P.t, width: Math.max(0, toX(b.x1) - toX(b.x0)), height: H,
          fill: b.color || 'rgba(216,150,62,.10)'
        }));
        if (b.label) gBack.appendChild(svg('text', { x: (toX(b.x0) + toX(b.x1)) / 2, y: P.t + 12, class: 'ct-band', 'text-anchor': 'middle', text: b.label }));
      });
      gBack.appendChild(svg('rect', { x: P.l, y: P.t, width: W, height: H, class: 'ct-plot' }));
      var xt = Array.isArray(o.xTicks) ? o.xTicks.map(function (v) { return { v: v, major: true }; }) : ticks(dx, o.xLog, o.xTicks);
      var yt = Array.isArray(o.yTicks) ? o.yTicks.map(function (v) { return { v: v, major: true }; }) : ticks(dy, o.yLog, o.yTicks);
      xt.forEach(function (t) {
        var X = toX(t.v);
        if (o.grid) gBack.appendChild(svg('line', { x1: X, y1: P.t, x2: X, y2: P.t + H, class: t.major ? 'ct-grid' : 'ct-grid ct-minor' }));
        if (t.major) {
          gBack.appendChild(svg('line', { x1: X, y1: P.t + H, x2: X, y2: P.t + H + 4, class: 'ct-axis' }));
          gBack.appendChild(svg('text', { x: X, y: P.t + H + 16, class: 'ct-tick', 'text-anchor': 'middle', text: tlab(t.v, o.xLog) }));
        }
      });
      yt.forEach(function (t) {
        var Y = toY(t.v);
        if (o.grid) gBack.appendChild(svg('line', { x1: P.l, y1: Y, x2: P.l + W, y2: Y, class: t.major ? 'ct-grid' : 'ct-grid ct-minor' }));
        if (t.major) {
          gBack.appendChild(svg('line', { x1: P.l - 4, y1: Y, x2: P.l, y2: Y, class: 'ct-axis' }));
          gBack.appendChild(svg('text', { x: P.l - 7, y: Y + 3.5, class: 'ct-tick', 'text-anchor': 'end', text: tlab(t.v, o.yLog) }));
        }
      });
      if (o.xLabel) gFront.appendChild(svg('text', { x: P.l + W / 2, y: o.h - 8, class: 'ct-axlab', 'text-anchor': 'middle', text: o.xLabel }));
      if (o.yLabel) gFront.appendChild(svg('text', { x: 12, y: P.t + H / 2, class: 'ct-axlab', 'text-anchor': 'middle', transform: 'rotate(-90 12 ' + (P.t + H / 2) + ')', text: o.yLabel }));
      if (o.title) gFront.appendChild(svg('text', { x: P.l, y: 11, class: 'ct-title', text: o.title }));

      (o.hlines || []).forEach(function (l) {
        gData.appendChild(svg('line', { x1: P.l, y1: toY(l.y), x2: P.l + W, y2: toY(l.y), stroke: l.color || '#b02834', 'stroke-width': 1, 'stroke-dasharray': l.dash || '5 3' }));
        if (l.label) gData.appendChild(svg('text', { x: P.l + W - 3, y: toY(l.y) - 4, class: 'ct-note', 'text-anchor': 'end', fill: l.color || '#b02834', text: l.label }));
      });
      (o.vlines || []).forEach(function (l) {
        gData.appendChild(svg('line', { x1: toX(l.x), y1: P.t, x2: toX(l.x), y2: P.t + H, stroke: l.color || '#8a8478', 'stroke-width': 1, 'stroke-dasharray': l.dash || '5 3' }));
        if (l.label) gData.appendChild(svg('text', { x: toX(l.x) + 3, y: P.t + 10, class: 'ct-note', fill: l.color || '#8a8478', text: l.label }));
      });

      o.series.forEach(function (s) {
        if (s.hidden) return;
        if (s.type === 'band' && s.pts2) {
          var d = path(s.pts) + 'L' + s.pts2.slice().reverse().map(function (p) { return toX(p[0]).toFixed(2) + ' ' + toY(p[1]).toFixed(2); }).join('L') + 'Z';
          gData.appendChild(svg('path', { d: d, fill: s.color, opacity: s.opacity || 0.18, stroke: 'none' }));
          return;
        }
        if (s.fill) {
          var base = toY(o.yLog ? dy[0] : clamp(0, dy[0], dy[1]));
          var pd = path(s.pts, s.type === 'step');
          if (pd) gData.appendChild(svg('path', {
            d: pd + 'L' + toX(s.pts[s.pts.length - 1][0]).toFixed(2) + ' ' + base.toFixed(2) + 'L' + toX(s.pts[0][0]).toFixed(2) + ' ' + base.toFixed(2) + 'Z',
            fill: s.color, opacity: 0.14, stroke: 'none'
          }));
        }
        if (s.type === 'dot') {
          s.pts.forEach(function (p) {
            gData.appendChild(svg('circle', { cx: toX(p[0]), cy: toY(p[1]), r: s.width || 3, fill: s.color, stroke: '#fff', 'stroke-width': 0.6 }));
          });
        } else {
          gData.appendChild(svg('path', {
            d: path(s.pts, s.type === 'step'), fill: 'none', stroke: s.color,
            'stroke-width': s.width || 1.7, 'stroke-dasharray': s.dash || '', 'stroke-linejoin': 'round', 'stroke-linecap': 'round'
          }));
        }
        (s.marks || []).forEach(function (p) {
          gData.appendChild(svg('circle', { cx: toX(p[0]), cy: toY(p[1]), r: 3.2, fill: s.color, stroke: '#fff', 'stroke-width': 0.8 }));
        });
      });

      if (o.legend) {
        var vis = o.series.filter(function (s) { return s.name && !s.noLegend; }), lx = P.l + 8, ly = P.t + 12;
        var g = svg('g');
        vis.forEach(function (s, k) {
          var yy = ly + k * 14;
          g.appendChild(svg('line', { x1: lx, y1: yy - 3.5, x2: lx + 16, y2: yy - 3.5, stroke: s.color, 'stroke-width': s.width || 1.7, 'stroke-dasharray': s.dash || '', opacity: s.hidden ? 0.3 : 1 }));
          g.appendChild(svg('text', { x: lx + 21, y: yy, class: 'ct-leg', opacity: s.hidden ? 0.4 : 1, text: s.name }));
        });
        if (vis.length) {
          var bw = 0; vis.forEach(function (s) { bw = Math.max(bw, s.name.length); });
          gFront.appendChild(svg('rect', { x: lx - 5, y: ly - 12, width: 30 + bw * 6.4, height: vis.length * 14 + 5, class: 'ct-legbox' }));
          gFront.appendChild(g);
        }
      }
    }
    redraw();
    return {
      root: root, opts: o, redraw: redraw, toX: toX, toY: toY,
      update: function (series, dom) {
        if (series) o.series = series;
        if (dom) { if (dom.x) o.xDomain = dom.x; if (dom.y) o.yDomain = dom.y; }
        redraw();
      }
    };
  }

  /* ---------- 表格 ---------- */
  function table(opts) {
    var t = el('table', { class: 'dt ' + (opts.cls || '') });
    if (opts.caption) t.appendChild(el('caption', { html: opts.caption }));
    if (opts.head) {
      var thead = el('thead');
      (Array.isArray(opts.head[0]) ? opts.head : [opts.head]).forEach(function (hr) {
        var tr = el('tr');
        hr.forEach(function (h) {
          var o2 = typeof h === 'object' ? h : { html: String(h) };
          tr.appendChild(el('th', { html: o2.html, colspan: o2.colspan || 1, rowspan: o2.rowspan || 1, class: o2.cls || '' }));
        });
        thead.appendChild(tr);
      });
      t.appendChild(thead);
    }
    var tb = el('tbody');
    (opts.rows || []).forEach(function (r) {
      if (r === '-') { tb.appendChild(el('tr', { class: 'rule' }, [el('td', { colspan: 99 })])); return; }
      var tr = el('tr', { class: r.cls || '' });
      (r.cells || r).forEach(function (c, k) {
        var o2 = (c && typeof c === 'object' && !(c instanceof Node)) ? c : { html: c === undefined || c === null ? '' : String(c) };
        var td = el(o2.th ? 'th' : 'td', { colspan: o2.colspan || 1, class: (o2.cls || '') + (k > 0 && opts.numeric !== false ? ' num' : '') });
        if (o2.node) td.appendChild(o2.node); else td.innerHTML = o2.html;
        tr.appendChild(td);
      });
      tb.appendChild(tr);
    });
    t.appendChild(tb);
    if (opts.foot) t.appendChild(el('tfoot', {}, [el('tr', {}, [el('td', { colspan: 99, html: opts.foot })])]));
    if (opts.parent) opts.parent.appendChild(opts.wrap === false ? t : el('div', { class: 'dt-wrap' }, [t]));
    return t;
  }

  /* ---------- 工程图框 (含标题栏) ---------- */
  var FIGN = 0;
  function figure(opts) {
    FIGN++;
    var n = opts.no || ('图 ' + FIGN);
    var body = el('div', { class: 'fig-body ' + (opts.bodyCls || '') });
    var blk = el('div', { class: 'fig ' + (opts.cls || '') }, [
      body,
      el('div', { class: 'fig-block' }, [
        el('div', { class: 'fb-cell fb-name' }, [el('b', { text: n }), el('span', { html: opts.title || '' })]),
        el('div', { class: 'fb-cell' }, [el('i', { text: '图号' }), el('span', { text: opts.drawNo || '—' })]),
        el('div', { class: 'fb-cell' }, [el('i', { text: '比例' }), el('span', { text: opts.scale || '不按比例' })]),
        el('div', { class: 'fb-cell' }, [el('i', { text: '单位' }), el('span', { text: opts.unit || 'mm' })])
      ])
    ]);
    if (opts.note) blk.appendChild(el('div', { class: 'fig-note', html: opts.note }));
    if (opts.parent) opts.parent.appendChild(blk);
    return { root: blk, body: body, no: n };
  }

  /* ---------- 小组件 ---------- */
  function slider(opts) {
    var out = el('output', { class: 'sl-val' });
    var inp = el('input', {
      type: 'range', min: opts.min, max: opts.max, step: opts.step || 1, value: opts.value,
      oninput: function () { render(); opts.oninput && opts.oninput(+inp.value); }
    });
    function render() { out.textContent = (opts.format ? opts.format(+inp.value) : inp.value) + (opts.unit ? ' ' + opts.unit : ''); }
    render();
    var root = el('label', { class: 'sl' }, [el('span', { class: 'sl-lab', html: opts.label }), inp, out]);
    if (opts.parent) opts.parent.appendChild(root);
    return { root: root, input: inp, get: function () { return +inp.value; }, set: function (v) { inp.value = v; render(); }, render: render };
  }
  function readout(parent, label, unit) {
    var v = el('b', { class: 'ro-v', text: '—' });
    parent.appendChild(el('div', { class: 'ro' }, [el('span', { class: 'ro-l', html: label }), v, unit ? el('i', { class: 'ro-u', html: unit }) : null]));
    return { set: function (x, cls) { v.textContent = x; v.className = 'ro-v ' + (cls || ''); } };
  }
  function btn(label, fn, cls) { return el('button', { class: 'btn ' + (cls || ''), html: label, onclick: fn }); }

  /* ---------- 模块注册 ---------- */
  var MODS = {};
  function register(name, fn) { MODS[name] = fn; }
  function boot() {
    Object.keys(MODS).forEach(function (n) {
      var host = document.getElementById('mount-' + n);
      if (!host) { console.warn('无挂载点: mount-' + n); return; }
      try { MODS[n](host); } catch (e) {
        console.error('模块 ' + n + ' 失败', e);
        host.appendChild(el('div', { class: 'err', text: '模块 ' + n + ' 初始化失败: ' + e.message }));
      }
    });
  }

  window.SFR = {
    NS: NS, el: el, svg: svg, fmt: fmt, fmtG: fmtG, clamp: clamp, lerp: lerp, ease: ease, easeOut: easeOut,
    colorT: colorT, lattice: lattice, hexPath: hexPath, chart: chart, table: table, figure: figure,
    slider: slider, readout: readout, btn: btn, register: register, boot: boot, mods: MODS
  };
})();
