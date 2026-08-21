/**
 * charts.js —— 零依赖 Canvas 图表工具（柱/分组柱/折线/雷达/环形/仪表/条形进度）
 * 所有图表自适应容器尺寸，支持 hover 读数。
 */
import { fmt } from '../core/store.js';

var FONT = '12px "Segoe UI", "Microsoft YaHei", system-ui, sans-serif';
var FONT_SM = '11px "Segoe UI", "Microsoft YaHei", system-ui, sans-serif';
var AXIS = 'rgba(255,255,255,.30)';
var GRID = 'rgba(255,255,255,.075)';
var TXT = 'rgba(226,232,240,.92)';
var TXT_DIM = 'rgba(148,163,184,.85)';

function setup(host) {
  host.innerHTML = '';
  var cv = document.createElement('canvas');
  cv.style.width = '100%';
  cv.style.display = 'block';
  host.appendChild(cv);
  var tip = document.createElement('div');
  tip.className = 'chart-tip';
  host.appendChild(tip);
  return { cv: cv, ctx: cv.getContext('2d'), tip: tip };
}

function fit(cv, host, hpx) {
  var dpr = Math.min(2, window.devicePixelRatio || 1);
  var w = host.clientWidth || 480;
  var h = hpx || host.clientHeight || 220;
  cv.width = Math.round(w * dpr);
  cv.height = Math.round(h * dpr);
  cv.style.height = h + 'px';
  var ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return { w: w, h: h, ctx: ctx };
}

function observe(host, fn) {
  if (typeof ResizeObserver !== 'undefined') {
    var ro = new ResizeObserver(function () { fn(); });
    ro.observe(host);
  } else {
    window.addEventListener('resize', fn);
  }
  return fn;
}

/* ------------------------------------------------------------------ */
/** 分组柱状图 */
export function groupedBar(host, cfg) {
  var s = setup(host);
  var hit = [];
  function draw() {
    var f = fit(s.cv, host, cfg.height || 240);
    var ctx = f.ctx, w = f.w, h = f.h;
    var padL = cfg.padL || 46, padR = 14, padT = cfg.padT || 18, padB = cfg.padB || 34;
    var iw = w - padL - padR, ih = h - padT - padB;
    var min = cfg.min !== undefined ? cfg.min : 0;
    var max = cfg.max !== undefined ? cfg.max : 1;
    var nG = cfg.labels.length, nS = cfg.series.length;
    hit.length = 0;
    // grid
    ctx.font = FONT_SM;
    var ticks = cfg.ticks || 5;
    for (var t = 0; t <= ticks; t++) {
      var v = min + (max - min) * t / ticks;
      var y = padT + ih - ih * t / ticks;
      ctx.strokeStyle = GRID; ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
      ctx.fillStyle = TXT_DIM; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.fillText(cfg.fmtY ? cfg.fmtY(v) : fmt(v, cfg.yDigits === undefined ? 2 : cfg.yDigits), padL - 6, y);
    }
    if (cfg.refLine !== undefined) {
      var ry = padT + ih - ih * (cfg.refLine - min) / (max - min);
      ctx.save(); ctx.setLineDash([5, 4]); ctx.strokeStyle = 'rgba(255,209,102,.75)';
      ctx.beginPath(); ctx.moveTo(padL, ry); ctx.lineTo(w - padR, ry); ctx.stroke(); ctx.restore();
      if (cfg.refLabel) {
        ctx.fillStyle = 'rgba(255,209,102,.9)'; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
        ctx.fillText(cfg.refLabel, padL + 4, ry - 2);
      }
    }
    var gw = iw / nG;
    var bw = Math.max(3, Math.min(cfg.maxBar || 26, (gw - 8) / nS));
    for (var g = 0; g < nG; g++) {
      var gx = padL + g * gw;
      for (var si = 0; si < nS; si++) {
        var ser = cfg.series[si];
        var val = ser.data[g];
        if (val === null || val === undefined || isNaN(val)) continue;
        var bh = ih * (val - min) / (max - min);
        bh = Math.max(0, Math.min(ih, bh));
        var bx = gx + (gw - bw * nS) / 2 + si * bw;
        var by = padT + ih - bh;
        var grad = ctx.createLinearGradient(0, by, 0, padT + ih);
        grad.addColorStop(0, ser.color);
        grad.addColorStop(1, ser.color + '55');
        ctx.fillStyle = grad;
        ctx.fillRect(bx, by, bw - 1.5, bh);
        if (cfg.highlight === ser.key) {
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.4;
          ctx.strokeRect(bx - 0.5, by - 0.5, bw - 0.5, bh + 1);
        }
        hit.push({ x: bx, y: by, w: bw, h: bh, label: cfg.labels[g], ser: ser.name, val: val });
      }
      ctx.fillStyle = TXT_DIM; ctx.font = FONT_SM;
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      var lab = cfg.labels[g];
      ctx.save();
      if (cfg.rotate) {
        ctx.translate(gx + gw / 2, padT + ih + 6); ctx.rotate(-Math.PI / 4.2);
        ctx.textAlign = 'right'; ctx.fillText(lab, 0, 0);
      } else {
        ctx.fillText(lab, gx + gw / 2, padT + ih + 6);
      }
      ctx.restore();
    }
    ctx.strokeStyle = AXIS; ctx.beginPath();
    ctx.moveTo(padL, padT); ctx.lineTo(padL, padT + ih); ctx.lineTo(w - padR, padT + ih); ctx.stroke();
    if (cfg.title) {
      ctx.fillStyle = TXT; ctx.font = FONT; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText(cfg.title, padL, 2);
    }
  }
  s.cv.onmousemove = function (e) {
    var r = s.cv.getBoundingClientRect();
    var mx = e.clientX - r.left, my = e.clientY - r.top;
    for (var i = 0; i < hit.length; i++) {
      var b = hit[i];
      if (mx >= b.x - 2 && mx <= b.x + b.w + 2 && my >= b.y - 4 && my <= b.y + b.h + 4) {
        s.tip.style.display = 'block';
        s.tip.style.left = Math.min(r.width - 130, mx + 10) + 'px';
        s.tip.style.top = Math.max(0, my - 34) + 'px';
        s.tip.innerHTML = '<b>' + b.ser + '</b><br>' + b.label + ' · ' +
          (cfg.fmtTip ? cfg.fmtTip(b.val) : fmt(b.val, 3));
        return;
      }
    }
    s.tip.style.display = 'none';
  };
  s.cv.onmouseleave = function () { s.tip.style.display = 'none'; };
  observe(host, draw);
  draw();
  return { redraw: draw, setCfg: function (n) { Object.assign(cfg, n); draw(); } };
}

/* ------------------------------------------------------------------ */
/** 折线图（多序列，可作实时曲线） */
export function lineChart(host, cfg) {
  var s = setup(host);
  function draw() {
    var f = fit(s.cv, host, cfg.height || 200);
    var ctx = f.ctx, w = f.w, h = f.h;
    var padL = cfg.padL || 46, padR = 14, padT = 16, padB = 28;
    var iw = w - padL - padR, ih = h - padT - padB;
    var min = cfg.min, max = cfg.max;
    if (min === undefined || max === undefined) {
      min = Infinity; max = -Infinity;
      for (var i = 0; i < cfg.series.length; i++)
        for (var j = 0; j < cfg.series[i].data.length; j++) {
          var v = cfg.series[i].data[j];
          if (v < min) min = v; if (v > max) max = v;
        }
      if (!isFinite(min)) { min = 0; max = 1; }
      var pad = (max - min) * 0.15 || 0.1;
      min -= pad; max += pad;
    }
    ctx.font = FONT_SM;
    var ticks = cfg.ticks || 4;
    for (var t = 0; t <= ticks; t++) {
      var y = padT + ih - ih * t / ticks;
      ctx.strokeStyle = GRID; ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
      ctx.fillStyle = TXT_DIM; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.fillText(fmt(min + (max - min) * t / ticks, cfg.yDigits === undefined ? 2 : cfg.yDigits), padL - 6, y);
    }
    var N = cfg.n || Math.max.apply(null, cfg.series.map(function (x) { return x.data.length; })) || 1;
    for (var si = 0; si < cfg.series.length; si++) {
      var ser = cfg.series[si];
      if (!ser.data.length) continue;
      ctx.strokeStyle = ser.color; ctx.lineWidth = ser.width || 1.8;
      ctx.beginPath();
      for (var k = 0; k < ser.data.length; k++) {
        var x = padL + iw * (N <= 1 ? 0.5 : k / (N - 1));
        var yy = padT + ih - ih * ((ser.data[k] - min) / (max - min));
        if (k === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
      }
      ctx.stroke();
      if (ser.fill) {
        ctx.lineTo(padL + iw * ((ser.data.length - 1) / Math.max(1, N - 1)), padT + ih);
        ctx.lineTo(padL, padT + ih);
        ctx.closePath();
        var gr = ctx.createLinearGradient(0, padT, 0, padT + ih);
        gr.addColorStop(0, ser.color + '44'); gr.addColorStop(1, ser.color + '02');
        ctx.fillStyle = gr; ctx.fill();
      }
    }
    ctx.strokeStyle = AXIS; ctx.beginPath();
    ctx.moveTo(padL, padT); ctx.lineTo(padL, padT + ih); ctx.lineTo(w - padR, padT + ih); ctx.stroke();
    if (cfg.xLabels) {
      ctx.fillStyle = TXT_DIM; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      for (var q = 0; q < cfg.xLabels.length; q++) {
        ctx.fillText(cfg.xLabels[q], padL + iw * (q / Math.max(1, cfg.xLabels.length - 1)), padT + ih + 6);
      }
    }
    if (cfg.title) {
      ctx.fillStyle = TXT; ctx.font = FONT; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText(cfg.title, padL, 0);
    }
  }
  observe(host, draw);
  draw();
  return { redraw: draw };
}

/* ------------------------------------------------------------------ */
/** 雷达图（多模型多指标对比） */
export function radar(host, cfg) {
  var s = setup(host);
  function draw() {
    var f = fit(s.cv, host, cfg.height || 260);
    var ctx = f.ctx, w = f.w, h = f.h;
    var cx = w / 2, cy = h / 2 + 6, rad = Math.min(w, h) * 0.34;
    var n = cfg.axes.length;
    ctx.font = FONT_SM;
    for (var ring = 1; ring <= 4; ring++) {
      ctx.strokeStyle = GRID; ctx.beginPath();
      for (var i = 0; i <= n; i++) {
        var a = -Math.PI / 2 + (i % n) / n * Math.PI * 2;
        var r = rad * ring / 4;
        var x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath(); ctx.stroke();
    }
    for (i = 0; i < n; i++) {
      var a2 = -Math.PI / 2 + i / n * Math.PI * 2;
      ctx.strokeStyle = GRID; ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a2) * rad, cy + Math.sin(a2) * rad); ctx.stroke();
      ctx.fillStyle = TXT_DIM;
      ctx.textAlign = Math.cos(a2) > 0.3 ? 'left' : (Math.cos(a2) < -0.3 ? 'right' : 'center');
      ctx.textBaseline = Math.sin(a2) > 0.3 ? 'top' : (Math.sin(a2) < -0.3 ? 'bottom' : 'middle');
      ctx.fillText(cfg.axes[i], cx + Math.cos(a2) * (rad + 12), cy + Math.sin(a2) * (rad + 12));
    }
    for (var si = 0; si < cfg.series.length; si++) {
      var ser = cfg.series[si];
      ctx.beginPath();
      for (i = 0; i <= n; i++) {
        var idx = i % n;
        var a3 = -Math.PI / 2 + idx / n * Math.PI * 2;
        var v = (ser.data[idx] - cfg.axisMin[idx]) / (cfg.axisMax[idx] - cfg.axisMin[idx]);
        v = Math.max(0.02, Math.min(1, v));
        var x2 = cx + Math.cos(a3) * rad * v, y2 = cy + Math.sin(a3) * rad * v;
        if (i === 0) ctx.moveTo(x2, y2); else ctx.lineTo(x2, y2);
      }
      ctx.closePath();
      ctx.fillStyle = ser.color + (ser.dim ? '18' : '30');
      ctx.fill();
      ctx.strokeStyle = ser.color; ctx.lineWidth = ser.dim ? 1 : 2.1; ctx.stroke();
    }
  }
  observe(host, draw);
  draw();
  return { redraw: draw, setCfg: function (n2) { Object.assign(cfg, n2); draw(); } };
}

/* ------------------------------------------------------------------ */
/** 环形分布图 */
export function donut(host, cfg) {
  var s = setup(host);
  function draw() {
    var f = fit(s.cv, host, cfg.height || 200);
    var ctx = f.ctx, w = f.w, h = f.h;
    var cx = w * 0.32, cy = h / 2, rO = Math.min(w * 0.28, h * 0.42), rI = rO * 0.58;
    var total = 0, i;
    for (i = 0; i < cfg.items.length; i++) total += cfg.items[i].value;
    if (total <= 0) {
      ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = rO - rI;
      ctx.beginPath(); ctx.arc(cx, cy, (rO + rI) / 2, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = TXT_DIM; ctx.font = FONT_SM; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('暂无数据', cx, cy);
      return;
    }
    var a = -Math.PI / 2;
    for (i = 0; i < cfg.items.length; i++) {
      var it = cfg.items[i];
      var sw = it.value / total * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx, cy, rO, a, a + sw);
      ctx.arc(cx, cy, rI, a + sw, a, true);
      ctx.closePath();
      ctx.fillStyle = it.color;
      ctx.fill();
      a += sw;
    }
    ctx.fillStyle = TXT; ctx.font = 'bold 18px "Segoe UI", system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(total), cx, cy - 5);
    ctx.font = FONT_SM; ctx.fillStyle = TXT_DIM;
    ctx.fillText(cfg.centerLabel || '总数', cx, cy + 12);
    // legend
    var lx = w * 0.6, ly = 10, lh = Math.min(16, (h - 20) / Math.max(1, cfg.items.length));
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.font = FONT_SM;
    for (i = 0; i < cfg.items.length && i < 14; i++) {
      var y = ly + i * lh + lh / 2;
      ctx.fillStyle = cfg.items[i].color;
      ctx.fillRect(lx, y - 3.5, 8, 7);
      ctx.fillStyle = TXT_DIM;
      var nm = cfg.items[i].label;
      if (nm.length > 12) nm = nm.slice(0, 11) + '…';
      ctx.fillText(nm + '  ' + cfg.items[i].value, lx + 12, y);
    }
  }
  observe(host, draw);
  draw();
  return { redraw: draw, setCfg: function (n) { Object.assign(cfg, n); draw(); } };
}

/* ------------------------------------------------------------------ */
/** 半环仪表 */
export function gauge(host, cfg) {
  var s = setup(host);
  function draw() {
    var f = fit(s.cv, host, cfg.height || 130);
    var ctx = f.ctx, w = f.w, h = f.h;
    var cx = w / 2, cy = h * 0.78, r = Math.min(w * 0.42, h * 0.72);
    var v = Math.max(0, Math.min(1, (cfg.value - cfg.min) / (cfg.max - cfg.min)));
    ctx.lineWidth = Math.max(8, r * 0.20);
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,.10)';
    ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI, Math.PI * 2); ctx.stroke();
    var col = cfg.color || '#4db8ff';
    if (cfg.zones) {
      for (var i = 0; i < cfg.zones.length; i++) if (v >= cfg.zones[i].from) col = cfg.zones[i].color;
    }
    ctx.strokeStyle = col;
    ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI, Math.PI + Math.PI * v); ctx.stroke();
    ctx.fillStyle = TXT; ctx.font = 'bold 19px "Segoe UI", system-ui';
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(cfg.text !== undefined ? cfg.text : fmt(cfg.value, 2), cx, cy - 6);
    ctx.font = FONT_SM; ctx.fillStyle = TXT_DIM;
    ctx.fillText(cfg.label || '', cx, cy + 14);
  }
  observe(host, draw);
  draw();
  return { redraw: draw, setCfg: function (n) { Object.assign(cfg, n); draw(); } };
}

/* ------------------------------------------------------------------ */
/** 时序甘特（单支烟支的全链路阶段耗时） */
export function gantt(host, cfg) {
  var s = setup(host);
  function draw() {
    var f = fit(s.cv, host, cfg.height || 210);
    var ctx = f.ctx, w = f.w, h = f.h;
    var padL = cfg.padL || 116, padR = 60, padT = 22, padB = 26;
    var iw = w - padL - padR;
    var rows = cfg.rows || [];
    if (!rows.length) {
      ctx.fillStyle = TXT_DIM; ctx.font = FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(cfg.empty || '运行仿真后显示时序', w / 2, h / 2);
      return;
    }
    var tMax = 0;
    for (var i = 0; i < rows.length; i++) tMax = Math.max(tMax, rows[i].end);
    tMax = Math.max(tMax, 1) * 1.06;
    var rh = Math.min(24, (h - padT - padB) / rows.length);
    ctx.font = FONT_SM;
    for (var g = 0; g <= 5; g++) {
      var x = padL + iw * g / 5;
      ctx.strokeStyle = GRID; ctx.beginPath(); ctx.moveTo(x, padT - 4); ctx.lineTo(x, padT + rows.length * rh); ctx.stroke();
      ctx.fillStyle = TXT_DIM; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText(fmt(tMax * g / 5, 1) + ' ms', x, padT - 6);
    }
    for (i = 0; i < rows.length; i++) {
      var r = rows[i];
      var y = padT + i * rh;
      var x0 = padL + iw * (r.start / tMax);
      var x1 = padL + iw * (r.end / tMax);
      ctx.fillStyle = TXT_DIM; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.font = FONT_SM;
      ctx.fillText(r.label, padL - 8, y + rh / 2);
      ctx.fillStyle = r.color;
      var bw = Math.max(2, x1 - x0);
      ctx.fillRect(x0, y + rh * 0.22, bw, rh * 0.56);
      ctx.fillStyle = TXT;
      ctx.textAlign = 'left';
      ctx.fillText(fmt(r.end - r.start, 2), x1 + 6, y + rh / 2);
    }
    if (cfg.title) {
      ctx.fillStyle = TXT; ctx.font = FONT; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText(cfg.title, 6, 2);
    }
  }
  observe(host, draw);
  draw();
  return { redraw: draw, setCfg: function (n) { Object.assign(cfg, n); draw(); } };
}

/* ------------------------------------------------------------------ */
/** 数值热力表（逐类 AP 矩阵） */
export function heatTable(host, cfg) {
  host.innerHTML = '';
  var tb = document.createElement('table');
  tb.className = 'heat-table';
  var thead = document.createElement('thead');
  var tr = document.createElement('tr');
  var th0 = document.createElement('th');
  th0.textContent = cfg.corner || '';
  th0.className = 'sticky-col';
  tr.appendChild(th0);
  for (var c = 0; c < cfg.cols.length; c++) {
    var th = document.createElement('th');
    th.innerHTML = cfg.cols[c];
    tr.appendChild(th);
  }
  thead.appendChild(tr);
  tb.appendChild(thead);
  var tbody = document.createElement('tbody');
  for (var r = 0; r < cfg.rows.length; r++) {
    var trr = document.createElement('tr');
    var td0 = document.createElement('td');
    td0.innerHTML = cfg.rows[r];
    td0.className = 'sticky-col row-head';
    trr.appendChild(td0);
    for (c = 0; c < cfg.cols.length; c++) {
      var td = document.createElement('td');
      var v = cfg.data[r][c];
      if (v === null || v === undefined) { td.textContent = '—'; }
      else {
        td.textContent = cfg.fmt ? cfg.fmt(v) : fmt(v, 3);
        var t = (v - cfg.min) / (cfg.max - cfg.min);
        t = Math.max(0, Math.min(1, t));
        td.style.background = 'rgba(' + Math.round(255 - 205 * t) + ',' + Math.round(90 + 130 * t) + ',' + Math.round(120 + 40 * t) + ',' + (0.10 + 0.42 * t) + ')';
        if (cfg.bestPerRow && v === Math.max.apply(null, cfg.data[r].filter(function (x) { return x !== null; }))) {
          td.classList.add('best');
        }
      }
      trr.appendChild(td);
    }
    tbody.appendChild(trr);
  }
  tb.appendChild(tbody);
  host.appendChild(tb);
  return { el: tb };
}

/** 横向进度条列表（实时统计的类别分布） */
export function barList(host, items, opts) {
  var o = opts || {};
  host.innerHTML = '';
  var max = 1;
  for (var i = 0; i < items.length; i++) max = Math.max(max, items[i].value);
  for (i = 0; i < items.length; i++) {
    var it = items[i];
    var row = document.createElement('div');
    row.className = 'barlist-row';
    var lab = document.createElement('div');
    lab.className = 'barlist-label';
    lab.textContent = it.label;
    var track = document.createElement('div');
    track.className = 'barlist-track';
    var fillEl = document.createElement('div');
    fillEl.className = 'barlist-fill';
    fillEl.style.width = (it.value / max * 100).toFixed(1) + '%';
    fillEl.style.background = it.color;
    track.appendChild(fillEl);
    var val = document.createElement('div');
    val.className = 'barlist-val';
    val.textContent = o.fmt ? o.fmt(it) : it.value;
    row.appendChild(lab); row.appendChild(track); row.appendChild(val);
    host.appendChild(row);
  }
  if (!items.length) {
    var e = document.createElement('div');
    e.className = 'muted small pad';
    e.textContent = o.empty || '暂无数据';
    host.appendChild(e);
  }
}
