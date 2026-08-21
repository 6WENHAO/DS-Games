/**
 * workers/pool.js
 * ------------------------------------------------------------------
 * A small task pool over module web workers, used for terrain
 * generation and chunk meshing.
 *
 * Design notes
 *  - jobs are dispatched to the least-loaded worker so a slow chunk does
 *    not head-of-line block the others;
 *  - every job carries a monotonic id; results are matched back through
 *    a pending-promise map, so out-of-order completion is fine;
 *  - large typed arrays are moved with `postMessage` transfer lists and
 *    handed back by the worker, letting the caller recycle them;
 *  - if workers cannot be created at all (for example when the page is
 *    opened from file://), the pool transparently falls back to running
 *    the same code synchronously on the main thread. The game keeps
 *    working, just with a less smooth frame rate.
 */

export class WorkerPool {
  /**
   * @param {object} opts
   * @param {string} opts.url            module worker URL
   * @param {number} [opts.size]         worker count
   * @param {object} [opts.initMessage]  sent to every worker on startup
   * @param {(msg: object) => object} [opts.fallback]
   *        synchronous handler used when workers are unavailable
   */
  constructor({ url, size, initMessage = {}, fallback = null }) {
    const hardware = globalThis.navigator?.hardwareConcurrency ?? 4;
    this.size = Math.max(1, Math.min(size ?? Math.min(6, Math.max(2, hardware - 2)), 8));
    this.url = url;
    this.fallback = fallback;
    this.workers = [];
    this.load = [];
    this.pending = new Map();
    this.nextId = 1;
    this.usingFallback = false;
    this.initMessage = initMessage;

    try {
      for (let i = 0; i < this.size; i++) this.#spawn(i);
    } catch (err) {
      console.warn(`[pool] web workers unavailable (${err.message}); running on the main thread`);
      this.usingFallback = true;
      this.workers = [];
    }
    if (this.workers.length === 0) this.usingFallback = true;
  }

  #spawn(index) {
    const worker = new Worker(this.url, { type: 'module', name: `chunk-worker-${index}` });
    worker.onmessage = (ev) => this.#onMessage(index, ev.data);
    worker.onerror = (ev) => {
      console.error(`[pool] worker ${index} error: ${ev.message}`);
      ev.preventDefault?.();
    };
    worker.postMessage({ type: 'init', ...this.initMessage });
    this.workers[index] = worker;
    this.load[index] = 0;
  }

  /** Broadcasts a message to every worker (used to update shared tables). */
  broadcast(message, transfer = []) {
    for (const w of this.workers) w.postMessage(message, transfer);
  }

  #onMessage(index, data) {
    this.load[index] = Math.max(0, this.load[index] - 1);
    const entry = this.pending.get(data.id);
    if (!entry) return;   // cancelled
    this.pending.delete(data.id);
    if (data.error) entry.reject(new Error(data.error));
    else entry.resolve(data);
  }

  /** Index of the worker with the fewest outstanding jobs. */
  #leastLoaded() {
    let best = 0;
    for (let i = 1; i < this.workers.length; i++) {
      if (this.load[i] < this.load[best]) best = i;
    }
    return best;
  }

  /**
   * Submits a job.
   * @param {object} message   must not contain `id`
   * @param {Transferable[]} [transfer]
   * @returns {Promise<object>}
   */
  submit(message, transfer = []) {
    const id = this.nextId++;

    if (this.usingFallback) {
      if (!this.fallback) return Promise.reject(new Error('no worker and no fallback'));
      // Defer so callers still observe async behaviour.
      return new Promise((resolve, reject) => {
        queueMicrotask(() => {
          try { resolve({ id, ...this.fallback({ ...message, id }) }); } catch (err) { reject(err); }
        });
      });
    }

    const index = this.#leastLoaded();
    this.load[index]++;
    const promise = new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
    this.workers[index].postMessage({ id, ...message }, transfer);
    return promise;
  }

  /** Drops a pending job's callbacks; the result will be ignored. */
  cancel(id) {
    this.pending.delete(id);
  }

  /** Total outstanding jobs. */
  get busy() {
    return this.usingFallback ? 0 : this.load.reduce((a, b) => a + b, 0);
  }

  terminate() {
    for (const w of this.workers) w.terminate();
    this.workers = [];
    this.pending.clear();
  }
}

/**
 * Recycles the large padded typed arrays used for mesh jobs. Meshing a
 * chunk needs ~130 KB of scratch; without pooling that is a lot of
 * garbage per second while flying around.
 */
export class BufferPool {
  constructor(factory, limit = 24) {
    this.factory = factory;
    this.limit = limit;
    this.free = [];
  }

  acquire() {
    return this.free.pop() ?? this.factory();
  }

  release(buf) {
    if (!buf) return;
    if (this.free.length < this.limit) this.free.push(buf);
  }

  clear() { this.free.length = 0; }
}
