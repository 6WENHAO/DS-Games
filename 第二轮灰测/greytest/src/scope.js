/* =====================================================================
 * scope.js —— 轻量绘图组件（纯 Canvas 2D，无外部依赖）
 *   Scope    : 时域曲线（滚动窗口 + 自动量程 + 多通道）
 *   PoleMap  : s 平面极点/零点图（开环 vs 闭环对比）
 *   Phase    : 相图（θ-θ̇ 平面轨迹，带渐隐拖尾）
 * ===================================================================== */
(function (global) {
  'use strict';

  const CSS = {
    bg: '#0f1420', grid: '#1e2839', axis: '#3c4a63', text: '#8fa3c0', textDim: '#5d6e8a'
  };

  function setupHiDPI(canvas) {
    const dpr = Math.max(1, Math.min(3, global.devicePixelRatio || 1));
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(80, Math.round(rect.width)), h = Math.max(50, Math.round(rect.height));
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr; canvas.height = h * dpr;
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx: ctx, w: w, h: h };
  }

  function niceStep(range, target) {
    if (!(range > 0)) return 1;
    const raw = range / Math.max(1, target);
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const n = raw / mag;
    const mult = n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10;
    return mult * mag;
  }

  function fmtNum(v, step) {
    const dec = Math.max(0, Math.min(4, -Math.floor(Math.log10(Math.abs(step || 1))) + (Math.abs(step) < 1 ? 1 : 0)));
    if (Math.abs(v) >= 1000) return v.toExponential(1);
    return v.toFixed(dec);
  }

  /* ---------------- 时域示波器 ---------------- */
  class Scope {
    /* opts: { title, unit, window (s), series:[{label,color,dash}], yMin, yMax, symmetric, bands:[{y,color,label}] } */
    constructor(canvas, opts) {
      this.canvas = canvas;
      this.o = Object.assign({ title: '', unit: '', window: 10, series: [], symmetric: false, minSpan: 0.02 }, opts);
      this.n = this.o.series.length;
      this.cap = 4096;
      this.t = new Float64Array(this.cap);
      this.v = [];
      for (let i = 0; i < this.n; i++) this.v.push(new Float64Array(this.cap));
      this.head = 0; this.count = 0;
    }
    clear() { this.head = 0; this.count = 0; }
    push(t, vals) {
      this.t[this.head] = t;
      for (let i = 0; i < this.n; i++) this.v[i][this.head] = (vals[i] === undefined || !isFinite(vals[i])) ? NaN : vals[i];
      this.head = (this.head + 1) % this.cap;
      if (this.count < this.cap) this.count++;
    }
    // 返回可见区间内的索引序列
    *visible(tMin) {
      const start = (this.head - this.count + this.cap) % this.cap;
      for (let k = 0; k < this.count; k++) {
        const idx = (start + k) % this.cap;
        if (this.t[idx] >= tMin) yield idx;
      }
    }
    draw(tNow) {
      const { ctx, w, h } = setupHiDPI(this.canvas);
      const o = this.o;
      const padL = 44, padR = 6, padT = 16, padB = 16;
      const pw = w - padL - padR, ph = h - padT - padB;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#111826';
      ctx.fillRect(0, 0, w, h);

      const tMin = Math.max(0, (tNow === undefined ? 0 : tNow) - o.window);
      const tMax = tMin + o.window;

      // y 量程
      let lo = Infinity, hi = -Infinity;
      for (const idx of this.visible(tMin)) {
        for (let i = 0; i < this.n; i++) {
          const val = this.v[i][idx];
          if (isFinite(val)) { if (val < lo) lo = val; if (val > hi) hi = val; }
        }
      }
      if (o.bands) for (const b of o.bands) { lo = Math.min(lo, b.y); hi = Math.max(hi, b.y); }
      if (!isFinite(lo)) { lo = -1; hi = 1; }
      if (o.symmetric) { const a = Math.max(Math.abs(lo), Math.abs(hi)); lo = -a; hi = a; }
      let span = hi - lo;
      if (span < o.minSpan) { const c = 0.5 * (lo + hi); lo = c - o.minSpan / 2; hi = c + o.minSpan / 2; span = o.minSpan; }
      lo -= span * 0.1; hi += span * 0.1; span = hi - lo;
      if (o.yMin !== undefined) lo = o.yMin;
      if (o.yMax !== undefined) hi = o.yMax;
      span = hi - lo;

      const X = (t) => padL + (t - tMin) / (tMax - tMin) * pw;
      const Y = (v) => padT + (1 - (v - lo) / span) * ph;

      // 网格
      const ystep = niceStep(span, 4);
      ctx.strokeStyle = CSS.grid; ctx.lineWidth = 1;
      ctx.fillStyle = CSS.textDim; ctx.font = '10px ui-monospace, Consolas, monospace';
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      const y0 = Math.ceil(lo / ystep) * ystep;
      for (let yv = y0; yv <= hi + 1e-12; yv += ystep) {
        const py = Y(yv);
        ctx.beginPath(); ctx.moveTo(padL, py); ctx.lineTo(w - padR, py); ctx.stroke();
        ctx.fillText(fmtNum(yv, ystep), padL - 5, py);
      }
      const tstep = niceStep(o.window, 5);
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      for (let tv = Math.ceil(tMin / tstep) * tstep; tv <= tMax; tv += tstep) {
        const px = X(tv);
        ctx.beginPath(); ctx.moveTo(px, padT); ctx.lineTo(px, h - padB); ctx.stroke();
        ctx.fillText(tv.toFixed(tstep < 1 ? 1 : 0), px, h - padB + 3);
      }
      // 零线
      if (lo < 0 && hi > 0) {
        ctx.strokeStyle = CSS.axis; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(padL, Y(0)); ctx.lineTo(w - padR, Y(0)); ctx.stroke();
      }
      // 限幅带（例如 ±u_max、±导轨长度）
      if (o.bands) {
        for (const b of o.bands) {
          ctx.strokeStyle = b.color || '#7a3b3b'; ctx.setLineDash([4, 3]); ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(padL, Y(b.y)); ctx.lineTo(w - padR, Y(b.y)); ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      // 曲线
      ctx.save();
      ctx.beginPath(); ctx.rect(padL, padT, pw, ph); ctx.clip();
      for (let i = 0; i < this.n; i++) {
        const se = o.series[i];
        if (se.hidden) continue;
        ctx.strokeStyle = se.color; ctx.lineWidth = se.width || 1.6;
        if (se.dash) ctx.setLineDash(se.dash); else ctx.setLineDash([]);
        ctx.beginPath();
        let first = true;
        for (const idx of this.visible(tMin)) {
          const val = this.v[i][idx];
          if (!isFinite(val)) { first = true; continue; }
          const px = X(this.t[idx]), py = Y(val);
          if (first) { ctx.moveTo(px, py); first = false; } else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.restore();

      // 标题与图例
      ctx.font = '11px system-ui, "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillStyle = CSS.text;
      ctx.fillText(o.title + (o.unit ? ` [${o.unit}]` : ''), padL, 2);
      let lx = padL + ctx.measureText(o.title + (o.unit ? ` [${o.unit}]` : '')).width + 12;
      for (let i = 0; i < this.n; i++) {
        const se = o.series[i];
        if (!se.label || se.hidden) continue;
        ctx.strokeStyle = se.color; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(lx, 8); ctx.lineTo(lx + 12, 8); ctx.stroke();
        ctx.fillStyle = CSS.textDim;
        ctx.fillText(se.label, lx + 15, 2);
        lx += 15 + ctx.measureText(se.label).width + 12;
      }
    }
  }

  /* ---------------- s 平面极点图 ---------------- */
  class PoleMap {
    constructor(canvas) { this.canvas = canvas; }
    // groups: [{poles:[{re,im}], color, symbol:'x'|'o', label}]
    draw(groups, opts) {
      opts = opts || {};
      const { ctx, w, h } = setupHiDPI(this.canvas);
      ctx.clearRect(0, 0, w, h); ctx.fillStyle = '#111826'; ctx.fillRect(0, 0, w, h);
      const padL = 34, padR = 8, padT = 16, padB = 18;
      const pw = w - padL - padR, ph = h - padT - padB;
      let maxRe = 1, maxIm = 1;
      for (const g of groups) for (const z of g.poles) {
        maxRe = Math.max(maxRe, Math.abs(z.re)); maxIm = Math.max(maxIm, Math.abs(z.im));
      }
      if (opts.logScale) { /* 预留 */ }
      const spanRe = maxRe * 1.25, spanIm = Math.max(maxIm * 1.3, spanRe * 0.35);
      const X = (re) => padL + (re + spanRe) / (2 * spanRe) * pw;
      const Y = (im) => padT + (1 - (im + spanIm) / (2 * spanIm)) * ph;

      // 右半平面阴影（不稳定区）
      ctx.fillStyle = 'rgba(190,60,60,0.10)';
      ctx.fillRect(X(0), padT, w - padR - X(0), ph);
      // 网格
      ctx.strokeStyle = CSS.grid; ctx.lineWidth = 1;
      const sRe = niceStep(2 * spanRe, 6), sIm = niceStep(2 * spanIm, 4);
      ctx.fillStyle = CSS.textDim; ctx.font = '9px ui-monospace, monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      for (let v = Math.ceil(-spanRe / sRe) * sRe; v <= spanRe; v += sRe) {
        ctx.beginPath(); ctx.moveTo(X(v), padT); ctx.lineTo(X(v), h - padB); ctx.stroke();
        if (Math.abs(v) > 1e-9) ctx.fillText(fmtNum(v, sRe), X(v), h - padB + 3);
      }
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      for (let v = Math.ceil(-spanIm / sIm) * sIm; v <= spanIm; v += sIm) {
        ctx.beginPath(); ctx.moveTo(padL, Y(v)); ctx.lineTo(w - padR, Y(v)); ctx.stroke();
        if (Math.abs(v) > 1e-9) ctx.fillText(fmtNum(v, sIm), padL - 4, Y(v));
      }
      // 坐标轴（虚轴 = 稳定边界）
      ctx.strokeStyle = '#c05050'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(X(0), padT); ctx.lineTo(X(0), h - padB); ctx.stroke();
      ctx.strokeStyle = CSS.axis; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(padL, Y(0)); ctx.lineTo(w - padR, Y(0)); ctx.stroke();

      // 标记
      for (const g of groups) {
        ctx.strokeStyle = g.color; ctx.fillStyle = g.color; ctx.lineWidth = 1.8;
        for (const z of g.poles) {
          const px = X(z.re), py = Y(z.im), r = 4.5;
          if (g.symbol === 'o') {
            ctx.beginPath(); ctx.arc(px, py, r, 0, 2 * Math.PI); ctx.stroke();
          } else {
            ctx.beginPath();
            ctx.moveTo(px - r, py - r); ctx.lineTo(px + r, py + r);
            ctx.moveTo(px + r, py - r); ctx.lineTo(px - r, py + r);
            ctx.stroke();
          }
        }
      }
      // 图例
      ctx.font = '10px system-ui, "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      let ly = 2;
      for (const g of groups) {
        if (!g.label) continue;
        ctx.fillStyle = g.color; ctx.fillText((g.symbol === 'o' ? '○ ' : '× ') + g.label, padL + 2, ly);
        ly += 12;
      }
      ctx.fillStyle = CSS.textDim; ctx.textAlign = 'right';
      ctx.fillText('Re', w - padR - 2, Y(0) + 3);
      ctx.textAlign = 'left'; ctx.fillText('Im', X(0) + 4, padT);
    }
  }

  /* ---------------- 相图 ---------------- */
  class Phase {
    constructor(canvas, opts) {
      this.canvas = canvas;
      this.o = Object.assign({ title: '相图 θ–θ̇', xLabel: 'θ [rad]', yLabel: 'θ̇ [rad/s]', trail: 1200 }, opts);
      this.pts = [];
    }
    clear() { this.pts = []; }
    push(x, y, group) {
      this.pts.push([x, y, group || 0]);
      if (this.pts.length > this.o.trail) this.pts.shift();
    }
    draw(colors) {
      const { ctx, w, h } = setupHiDPI(this.canvas);
      ctx.clearRect(0, 0, w, h); ctx.fillStyle = '#111826'; ctx.fillRect(0, 0, w, h);
      const padL = 40, padR = 8, padT = 16, padB = 18;
      const pw = w - padL - padR, ph = h - padT - padB;
      let ax = 0.15, ay = 0.5;
      for (const p of this.pts) { ax = Math.max(ax, Math.abs(p[0])); ay = Math.max(ay, Math.abs(p[1])); }
      ax *= 1.15; ay *= 1.15;
      const X = (v) => padL + (v + ax) / (2 * ax) * pw;
      const Y = (v) => padT + (1 - (v + ay) / (2 * ay)) * ph;
      ctx.strokeStyle = CSS.grid; ctx.lineWidth = 1;
      const sx = niceStep(2 * ax, 4), sy = niceStep(2 * ay, 4);
      ctx.fillStyle = CSS.textDim; ctx.font = '9px ui-monospace, monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      for (let v = Math.ceil(-ax / sx) * sx; v <= ax; v += sx) {
        ctx.beginPath(); ctx.moveTo(X(v), padT); ctx.lineTo(X(v), h - padB); ctx.stroke();
        if (Math.abs(v) > 1e-9) ctx.fillText(fmtNum(v, sx), X(v), h - padB + 3);
      }
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      for (let v = Math.ceil(-ay / sy) * sy; v <= ay; v += sy) {
        ctx.beginPath(); ctx.moveTo(padL, Y(v)); ctx.lineTo(w - padR, Y(v)); ctx.stroke();
        if (Math.abs(v) > 1e-9) ctx.fillText(fmtNum(v, sy), padL - 4, Y(v));
      }
      ctx.strokeStyle = CSS.axis;
      ctx.beginPath(); ctx.moveTo(padL, Y(0)); ctx.lineTo(w - padR, Y(0)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(X(0), padT); ctx.lineTo(X(0), h - padB); ctx.stroke();

      // 轨迹（越新越亮）
      const n = this.pts.length;
      for (let i = 1; i < n; i++) {
        const a = this.pts[i - 1], b = this.pts[i];
        if (a[2] !== b[2]) continue;
        const alpha = 0.12 + 0.88 * (i / n);
        const col = (colors && colors[b[2]]) || '#4ea8ff';
        ctx.strokeStyle = col.replace('rgb(', 'rgba(').replace(')', `,${alpha.toFixed(3)})`);
        if (col[0] === '#') {
          const r = parseInt(col.slice(1, 3), 16), g = parseInt(col.slice(3, 5), 16), bl = parseInt(col.slice(5, 7), 16);
          ctx.strokeStyle = `rgba(${r},${g},${bl},${alpha.toFixed(3)})`;
        }
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(X(a[0]), Y(a[1])); ctx.lineTo(X(b[0]), Y(b[1])); ctx.stroke();
      }
      // 当前点
      const groupsSeen = new Set(this.pts.map((p) => p[2]));
      for (const gi of groupsSeen) {
        let last = null;
        for (let i = n - 1; i >= 0; i--) if (this.pts[i][2] === gi) { last = this.pts[i]; break; }
        if (!last) continue;
        ctx.fillStyle = (colors && colors[gi]) || '#4ea8ff';
        ctx.beginPath(); ctx.arc(X(last[0]), Y(last[1]), 3.2, 0, 2 * Math.PI); ctx.fill();
      }
      // 平衡点
      ctx.strokeStyle = '#e8c46a'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(X(0), Y(0), 4, 0, 2 * Math.PI); ctx.stroke();

      ctx.font = '11px system-ui, "Microsoft YaHei", sans-serif';
      ctx.fillStyle = CSS.text; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText(this.o.title, padL, 2);
      ctx.fillStyle = CSS.textDim; ctx.textAlign = 'right';
      ctx.fillText(this.o.xLabel, w - padR - 2, h - padB - 12);
    }
  }

  global.Plots = { Scope, PoleMap, Phase, setupHiDPI };
})(typeof window !== 'undefined' ? window : globalThis);
