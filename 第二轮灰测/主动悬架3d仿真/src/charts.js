/**
 * charts.js — 实时振动曲线（Canvas 2D）
 * 上下两车同一信号叠加绘制：橙 = 被动，青 = 主动，灰 = 路面输入
 */

const CSS = {
  grid: 'rgba(255,255,255,0.07)',
  gridStrong: 'rgba(255,255,255,0.14)',
  zero: 'rgba(255,255,255,0.28)',
  text: 'rgba(226,235,245,0.72)',
  passive: '#ff8a3d',
  active: '#3ddcff',
  road: 'rgba(255,255,255,0.26)',
};

export const SIGNALS = {
  aSeat: { key: 'aSeat', label: '关键点垂向加速度', unit: 'm/s²', auto: true, min: -6, max: 6, road: false },
  awSeat: { key: 'awSeat', label: '关键点加速度 (ISO 2631 加权)', unit: 'm/s²', auto: true, min: -3, max: 3, road: false },
  zSeat: { key: 'zSeat', label: '关键点垂向位移', unit: 'mm', auto: true, min: -40, max: 40, road: true },
  theta: { key: 'theta', label: '车身俯仰角', unit: '°', auto: true, min: -1.5, max: 1.5, road: false },
  phi: { key: 'phi', label: '车身侧倾角', unit: '°', auto: true, min: -1.5, max: 1.5, road: false },
  trav: { key: 'trav', label: '悬架行程（绝对值最大轮）', unit: 'mm', auto: true, min: -100, max: 100, road: false },
  load: { key: 'load', label: '轮胎动载荷波动', unit: '% 静载', auto: true, min: 0, max: 120, road: false },
  force: { key: 'force', label: '作动器出力', unit: 'N', auto: true, min: -5000, max: 5000, road: false },
};

function ringToArray(r, n) {
  const out = new Float32Array(n);
  const have = Math.min(n, r.n);
  for (let i = 0; i < have; i++) {
    // 最新样本在 r.i-1
    const idx = ((r.i - have + i) % r.len + r.len) % r.len;
    out[n - have + i] = r.d[idx];
  }
  return { arr: out, have };
}

export class Chart {
  constructor(container, sigKey, opts = {}) {
    this.sig = SIGNALS[sigKey];
    this.opts = opts;
    this.wrap = document.createElement('div');
    this.wrap.className = 'chart';
    this.head = document.createElement('div');
    this.head.className = 'chart-head';
    this.wrap.appendChild(this.head);
    this.canvas = document.createElement('canvas');
    this.wrap.appendChild(this.canvas);
    container.appendChild(this.wrap);
    this.ctx = this.canvas.getContext('2d');
    this.h = opts.height || 116;
    this.range = { min: this.sig.min, max: this.sig.max };
    this.resize();
  }

  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = this.wrap.clientWidth || 340;
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = this.h + 'px';
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(this.h * dpr);
    this.dpr = dpr; this.w = w;
  }

  setSignal(k) { this.sig = SIGNALS[k]; this.range = { min: this.sig.min, max: this.sig.max }; }

  /**
   * @param sim   Sim 实例
   * @param window 显示时间窗 s
   */
  draw(sim, windowS = 6.5) {
    const g = this.ctx, dpr = this.dpr;
    const W = this.canvas.width, H = this.canvas.height;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, W, H);
    g.scale(dpr, dpr);
    const w = this.w, h = this.h;
    const padL = 46, padR = 8, padT = 6, padB = 15;
    const iw = w - padL - padR, ih = h - padT - padB;

    const n = Math.max(2, Math.round(windowS / 0.004));
    const key = this.sig.key;
    const pa = ringToArray(sim.A.sig[key], n);
    const ac = ringToArray(sim.B.sig[key], n);

    /* 自适应量程 */
    let lo = Infinity, hi = -Infinity;
    for (let i = n - Math.min(n, Math.max(pa.have, ac.have)); i < n; i++) {
      lo = Math.min(lo, pa.arr[i], ac.arr[i]);
      hi = Math.max(hi, pa.arr[i], ac.arr[i]);
    }
    if (!Number.isFinite(lo)) { lo = this.sig.min; hi = this.sig.max; }
    const span = Math.max(1e-6, hi - lo);
    lo -= span * 0.14; hi += span * 0.14;
    if (this.sig.key !== 'load') { const m = Math.max(Math.abs(lo), Math.abs(hi)); lo = -m; hi = m; }
    // 平滑量程，避免跳动
    const k = 0.12;
    this.range.min += (lo - this.range.min) * k;
    this.range.max += (hi - this.range.max) * k;
    const rmin = this.range.min, rmax = this.range.max;
    const y = (v) => padT + ih - ((v - rmin) / Math.max(1e-9, rmax - rmin)) * ih;
    const x = (i) => padL + (i / (n - 1)) * iw;

    /* 网格 */
    g.lineWidth = 1;
    g.strokeStyle = CSS.grid;
    g.beginPath();
    for (let i = 0; i <= 4; i++) {
      const yy = Math.round(padT + (ih * i) / 4) + 0.5;
      g.moveTo(padL, yy); g.lineTo(padL + iw, yy);
    }
    for (let i = 0; i <= 6; i++) {
      const xx = Math.round(padL + (iw * i) / 6) + 0.5;
      g.moveTo(xx, padT); g.lineTo(xx, padT + ih);
    }
    g.stroke();
    // 零线
    if (rmin < 0 && rmax > 0) {
      g.strokeStyle = CSS.zero;
      g.beginPath();
      const yy = Math.round(y(0)) + 0.5;
      g.moveTo(padL, yy); g.lineTo(padL + iw, yy);
      g.stroke();
    }
    /* 坐标标注 */
    g.fillStyle = CSS.text;
    g.font = `${10}px ui-monospace, Menlo, Consolas, monospace`;
    g.textAlign = 'right'; g.textBaseline = 'middle';
    for (let i = 0; i <= 4; i++) {
      const v = rmax - ((rmax - rmin) * i) / 4;
      g.fillText(fmtTick(v), padL - 5, padT + (ih * i) / 4);
    }
    g.textAlign = 'center'; g.textBaseline = 'top';
    for (let i = 0; i <= 3; i++) {
      const t = -windowS + (windowS * i) / 3;
      g.fillText(i === 3 ? '现在' : `${t.toFixed(1)}s`, padL + (iw * i) / 3, padT + ih + 3);
    }

    /* 路面输入（参考） */
    if (this.sig.road) {
      const rd = ringToArray(sim.roadSig, n);
      g.strokeStyle = CSS.road; g.lineWidth = 1.2;
      g.beginPath();
      for (let i = 0; i < n; i++) { const yy = y(rd.arr[i]); i ? g.lineTo(x(i), yy) : g.moveTo(x(i), yy); }
      g.stroke();
    }

    /* 曲线 */
    const line = (a, color, lw) => {
      g.strokeStyle = color; g.lineWidth = lw; g.lineJoin = 'round';
      g.beginPath();
      for (let i = 0; i < n; i++) {
        const yy = Math.max(padT - 40, Math.min(padT + ih + 40, y(a[i])));
        i ? g.lineTo(x(i), yy) : g.moveTo(x(i), yy);
      }
      g.stroke();
    };
    line(pa.arr, CSS.passive, 1.5);
    line(ac.arr, CSS.active, 1.7);

    /* 标题 + 当前 RMS */
    const rmsP = rms(pa.arr), rmsA = rms(ac.arr);
    const imp = rmsP > 1e-9 ? ((rmsP - rmsA) / rmsP) * 100 : 0;
    this.head.innerHTML =
      `<span class="ct">${this.sig.label} <em>${this.sig.unit}</em></span>` +
      `<span class="cv"><i class="dot p"></i>${rmsP.toFixed(rmsP < 10 ? 2 : 1)}` +
      ` <i class="dot a"></i>${rmsA.toFixed(rmsA < 10 ? 2 : 1)}` +
      ` <b class="${imp >= 0 ? 'good' : 'bad'}">${imp >= 0 ? '↓' : '↑'}${Math.abs(imp).toFixed(0)}%</b></span>`;
  }
}

function rms(a) { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * a[i]; return Math.sqrt(s / a.length); }
function fmtTick(v) {
  const a = Math.abs(v);
  if (a >= 1000) return (v / 1000).toFixed(1) + 'k';
  if (a >= 100) return v.toFixed(0);
  if (a >= 10) return v.toFixed(0);
  if (a >= 1) return v.toFixed(1);
  return v.toFixed(2);
}

/* ---------------- 悬架运动学特性曲线（静态图） ---------------- */
export function drawKinematicsChart(canvas, sweepF, sweepR) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = canvas.clientWidth || 340, h = 132;
  canvas.style.height = h + 'px';
  canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  const g = canvas.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  const padL = 40, padR = 10, padT = 16, padB = 20;
  const iw = w - padL - padR, ih = h - padT - padB;

  let cmin = 0, cmax = 0;
  for (const r of [...sweepF, ...sweepR]) { cmin = Math.min(cmin, r.camber); cmax = Math.max(cmax, r.camber); }
  const m = Math.max(Math.abs(cmin), Math.abs(cmax)) * 1.15 || 1;
  const tmin = sweepF[0].travel, tmax = sweepF[sweepF.length - 1].travel;
  const X = (t) => padL + ((t - tmin) / (tmax - tmin)) * iw;
  const Y = (c) => padT + ih / 2 - (c / m) * (ih / 2);

  g.strokeStyle = CSS.grid; g.lineWidth = 1;
  g.beginPath();
  for (let i = 0; i <= 4; i++) { const yy = Math.round(padT + (ih * i) / 4) + 0.5; g.moveTo(padL, yy); g.lineTo(padL + iw, yy); }
  for (let i = 0; i <= 4; i++) { const xx = Math.round(padL + (iw * i) / 4) + 0.5; g.moveTo(xx, padT); g.lineTo(xx, padT + ih); }
  g.stroke();
  g.strokeStyle = CSS.zero; g.beginPath();
  g.moveTo(padL, Math.round(Y(0)) + 0.5); g.lineTo(padL + iw, Math.round(Y(0)) + 0.5);
  g.moveTo(Math.round(X(0)) + 0.5, padT); g.lineTo(Math.round(X(0)) + 0.5, padT + ih);
  g.stroke();

  const plot = (rows, color) => {
    g.strokeStyle = color; g.lineWidth = 1.9; g.beginPath();
    rows.forEach((r, i) => { const xx = X(r.travel), yy = Y(r.camber); i ? g.lineTo(xx, yy) : g.moveTo(xx, yy); });
    g.stroke();
  };
  plot(sweepF, '#8fd0ff');
  plot(sweepR, '#ffd68f');

  g.fillStyle = CSS.text;
  g.font = '10px ui-monospace, Menlo, Consolas, monospace';
  g.textAlign = 'right'; g.textBaseline = 'middle';
  for (let i = 0; i <= 4; i++) g.fillText((m - (2 * m * i) / 4).toFixed(1), padL - 5, padT + (ih * i) / 4);
  g.textAlign = 'center'; g.textBaseline = 'top';
  for (let i = 0; i <= 4; i++) g.fillText((tmin * 1000 + ((tmax - tmin) * 1000 * i) / 4).toFixed(0), padL + (iw * i) / 4, padT + ih + 3);
  g.textAlign = 'left'; g.textBaseline = 'top';
  g.fillStyle = '#8fd0ff'; g.fillText('■ 前 双叉臂', padL + 2, 2);
  g.fillStyle = '#ffd68f'; g.fillText('■ 后 五连杆', padL + 82, 2);
  g.fillStyle = CSS.text; g.textAlign = 'right';
  g.fillText('外倾角 °  /  轮跳 mm', w - padR, 2);
}
