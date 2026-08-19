/* =====================================================================
 * Loop — 主循环：可变步长渲染 + 固定 20tps 逻辑刻 + 帧率统计
 * ===================================================================== */
import { TICK_MS } from './Constants.js';

export class Loop {
  /**
   * @param {(dt:number, now:number)=>void} onFrame  可变步长（秒）
   * @param {(tickIndex:number)=>void} onTick        固定 50ms 逻辑刻
   */
  constructor(onFrame, onTick) {
    this.onFrame = onFrame;
    this.onTick = onTick;
    this.running = false;
    this.paused = false;
    this.rafId = 0;
    this.lastTime = 0;
    this.accumulator = 0;
    this.tickIndex = 0;
    this.tickScale = 1;          // /tick 命令可调倍速

    // 统计
    this.fps = 0;
    this.frameMs = 0;
    this.frameMsSmooth = 0;
    this.frames = 0;
    this._fpsTimer = 0;
    this.history = new Float32Array(120);
    this.historyIndex = 0;
    this.maxFrameMs = 0;
    this.totalTime = 0;
    this.frameCount = 0;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    const step = (now) => {
      if (!this.running) return;
      this.rafId = requestAnimationFrame(step);
      this._step(now);
    };
    this.rafId = requestAnimationFrame(step);
  }

  stop() {
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = 0;
  }

  _step(now) {
    let dt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    // 防止切标签页回来后的巨大跳变
    if (dt > 0.25) dt = 0.25;
    if (dt < 0) dt = 0;
    this.totalTime += dt;
    this.frameCount++;

    const t0 = performance.now();

    if (!this.paused) {
      // ---- 固定逻辑刻 ----
      this.accumulator += dt * 1000 * this.tickScale;
      let ticks = 0;
      while (this.accumulator >= TICK_MS && ticks < 10) {
        this.accumulator -= TICK_MS;
        this.tickIndex++;
        ticks++;
        this.onTick?.(this.tickIndex);
      }
      if (this.accumulator > TICK_MS * 10) this.accumulator = 0;
    }

    // ---- 渲染帧 ----
    this.onFrame?.(dt, now);

    const ms = performance.now() - t0;
    this.frameMs = ms;
    this.frameMsSmooth += (ms - this.frameMsSmooth) * 0.1;
    this.history[this.historyIndex] = ms;
    this.historyIndex = (this.historyIndex + 1) % this.history.length;
    if (ms > this.maxFrameMs) this.maxFrameMs = ms;

    // ---- FPS 计数 ----
    this.frames++;
    this._fpsTimer += dt;
    if (this._fpsTimer >= 0.5) {
      this.fps = Math.round(this.frames / this._fpsTimer);
      this.frames = 0;
      this._fpsTimer = 0;
      this.maxFrameMs *= 0.6;   // 缓慢衰减峰值
    }
  }

  /** 逻辑刻内的插值系数（0..1），用于实体平滑渲染 */
  get tickAlpha() { return this.accumulator / TICK_MS; }
}
