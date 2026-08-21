/**
 * ui/perf.js —— Canvas2D 性能曲线
 *
 * 用 Canvas2D 绘制帧时间历史（面积图 + 移动平均线 + 60/30 fps 参考线），
 * 与 WebGL 主画面互不干扰，开销极低。
 */

export class PerfGraph {
  /** @param {HTMLCanvasElement} canvas */
  constructor(canvas, { samples = 180 } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.n = samples;
    this.data = new Float32Array(samples);
    this.cpu = new Float32Array(samples);
    this.head = 0;
    this.filled = 0;
    this.avg = 16.7;
    this.cpuAvg = 4;
    this._dpr = Math.min(2, globalThis.devicePixelRatio || 1);
    this._resize();
  }

  _resize() {
    const c = this.canvas;
    const w = c.clientWidth || parseInt(c.getAttribute('width'), 10) || 196;
    const h = c.clientHeight || parseInt(c.getAttribute('height'), 10) || 48;
    this.cssW = w; this.cssH = h;
    c.width = Math.round(w * this._dpr);
    c.height = Math.round(h * this._dpr);
    this.ctx.setTransform(this._dpr, 0, 0, this._dpr, 0, 0);
  }

  /**
   * @param {number} frameMs 帧间隔（毫秒，决定 FPS）
   * @param {number} [cpuMs]  CPU 侧渲染提交耗时（另绘一条参考线）
   */
  push(frameMs, cpuMs = 0) {
    this.data[this.head] = frameMs;
    this.cpu[this.head] = cpuMs;
    this.head = (this.head + 1) % this.n;
    this.filled = Math.min(this.n, this.filled + 1);
    this.avg = this.avg * 0.94 + frameMs * 0.06;
    this.cpuAvg = this.cpuAvg * 0.94 + cpuMs * 0.06;
  }

  draw() {
    const ctx = this.ctx;
    const w = this.cssW, h = this.cssH;
    if (!w || !h) return;
    ctx.clearRect(0, 0, w, h);

    // 背景与网格
    ctx.fillStyle = 'rgba(6,12,20,0.55)';
    ctx.fillRect(0, 0, w, h);
    const scale = 50; // 上限 50ms
    const y = (ms) => h - Math.min(1, ms / scale) * h;

    ctx.strokeStyle = 'rgba(94,242,164,0.30)';
    ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(0, y(16.7)); ctx.lineTo(w, y(16.7)); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,180,84,0.28)';
    ctx.beginPath(); ctx.moveTo(0, y(33.3)); ctx.lineTo(w, y(33.3)); ctx.stroke();
    ctx.setLineDash([]);

    if (this.filled < 2) return;
    const step = w / (this.n - 1);
    const idx = (i) => this.data[(this.head - this.filled + i + this.n * 2) % this.n];

    // 面积
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(89,215,255,0.42)');
    grad.addColorStop(1, 'rgba(89,215,255,0.02)');
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let i = 0; i < this.filled; i++) ctx.lineTo(i * step, y(idx(i)));
    ctx.lineTo((this.filled - 1) * step, h);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // 曲线（帧间隔）
    ctx.beginPath();
    for (let i = 0; i < this.filled; i++) {
      const px = i * step, py = y(idx(i));
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.strokeStyle = 'rgba(140,232,255,0.95)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // CPU 提交耗时（细虚线，用于区分是 CPU 还是 GPU/垂直同步瓶颈）
    const cpuAt = (i) => this.cpu[(this.head - this.filled + i + this.n * 2) % this.n];
    ctx.beginPath();
    for (let i = 0; i < this.filled; i++) {
      const px = i * step, py = y(cpuAt(i));
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.strokeStyle = 'rgba(255,180,84,0.55)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.stroke();
    ctx.setLineDash([]);

    // 数值
    const fps = 1000 / Math.max(this.avg, 0.01);
    ctx.font = '600 10px ui-monospace, Consolas, monospace';
    ctx.fillStyle = fps > 50 ? 'rgba(94,242,164,0.95)' : fps > 28 ? 'rgba(255,196,110,0.95)' : 'rgba(255,110,110,0.95)';
    ctx.fillText(`${fps.toFixed(0)} FPS`, 5, 12);
    ctx.fillStyle = 'rgba(190,215,235,0.72)';
    ctx.fillText(`${this.avg.toFixed(1)}ms`, w - 76, 12);
    ctx.fillStyle = 'rgba(255,180,84,0.80)';
    ctx.fillText(`cpu ${this.cpuAvg.toFixed(1)}`, w - 40, 12);
  }
}
