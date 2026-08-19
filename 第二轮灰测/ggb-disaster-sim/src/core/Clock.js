/**
 * SimClock — the single owner of time.
 *
 * Every system in the simulator reads dt from here and nothing calls
 * performance.now() on its own. That is what makes "slow motion" and "pause"
 * work globally and for free: physics, shaders, particles and disaster
 * timelines all scale together because they all consume the same scaled dt.
 *
 * Two different clocks are exposed on purpose:
 *   dt        — scaled simulation delta (0 when paused). Drives physics/VFX/logic.
 *   realDt    — unscaled wall-clock delta. Drives UI, camera damping and the
 *               performance governor, which must keep working while paused.
 */
export class SimClock {
  constructor() {
    this.timeScale = 1;
    this.paused = false;
    this.simTime = 0;        // accumulated scaled time (shader uTime source)
    this.realTime = 0;       // accumulated wall-clock time
    this.dt = 0;
    this.realDt = 0;
    this.frame = 0;
    this._last = performance.now() / 1000;
    this._maxDt = 1 / 15;    // clamp: a tab switch must not teleport the sim
    this._snapshots = new Map();
  }

  /** Advance the clock. Call exactly once per animation frame, first thing. */
  tick() {
    const now = performance.now() / 1000;
    let raw = now - this._last;
    this._last = now;
    if (!Number.isFinite(raw) || raw < 0) raw = 0;
    this.realDt = Math.min(raw, this._maxDt);
    this.realTime += this.realDt;
    this.dt = this.paused ? 0 : this.realDt * this.timeScale;
    this.simTime += this.dt;
    this.frame++;
    return this.dt;
  }

  setTimeScale(s) { this.timeScale = Math.max(0.02, Math.min(4, s)); }
  pause() { this.paused = true; }
  resume() { this.paused = false; }
  togglePause() { this.paused = !this.paused; return this.paused; }

  /** Advance exactly one deterministic frame while paused (frame-by-frame study). */
  stepOnce(step = 1 / 60) {
    const d = step * this.timeScale;
    this.dt = d;
    this.simTime += d;
    this.frame++;
    return d;
  }

  /**
   * Snapshot support for the "pause and compare" feature. The camera state and
   * a canvas thumbnail are supplied by the caller; the clock only owns the
   * timestamp and the slot bookkeeping.
   */
  saveSnapshot(slot, payload) {
    this._snapshots.set(slot, { simTime: this.simTime, frame: this.frame, ...payload });
    return this._snapshots.get(slot);
  }
  getSnapshot(slot) { return this._snapshots.get(slot) || null; }
  clearSnapshots() { this._snapshots.clear(); }

  reset() {
    this.simTime = 0;
    this.frame = 0;
    this.dt = 0;
    this._last = performance.now() / 1000;
  }
}

/**
 * FixedStepAccumulator — decouples a fixed-rate simulation (physics) from a
 * variable-rate render loop. Rapier is only ever stepped with a constant
 * timestep, which keeps a 900-body collapse reproducible instead of turning
 * into a different movie on every machine.
 */
export class FixedStepAccumulator {
  constructor(step, maxSteps) {
    this.step = step;
    this.maxSteps = maxSteps;
    this.acc = 0;
    this.alpha = 0;   // interpolation factor for render-time smoothing
  }

  /** Returns how many fixed steps to run this frame. */
  consume(dt) {
    this.acc += dt;
    let n = 0;
    while (this.acc >= this.step && n < this.maxSteps) {
      this.acc -= this.step;
      n++;
    }
    // Hard reset if we fell hopelessly behind, rather than accumulating debt.
    if (this.acc > this.step * this.maxSteps * 4) this.acc = 0;
    this.alpha = this.acc / this.step;
    return n;
  }

  reset() { this.acc = 0; this.alpha = 0; }
}
