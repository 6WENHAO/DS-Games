// Keyboard / mouse / pointer-lock input with a small event bus.

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set();     // this frame
    this.released = new Set();
    this.mouse = { dx: 0, dy: 0, left: false, right: false, middle: false, wheel: 0 };
    this.mousePressed = { left: false, right: false, middle: false };
    this.locked = false;
    this.enabled = true;
    this.uiCapture = false;       // true when a panel wants the mouse
    this.sensitivity = 0.0022;
    this.invertY = false;
    this.listeners = new Map();

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const c = e.code;
      if (['Tab', 'F1', 'F3', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(c)) e.preventDefault();
      this.keys.add(c);
      this.pressed.add(c);
      this.emit('key', c, e);
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
      this.released.add(e.code);
    });
    window.addEventListener('blur', () => { this.keys.clear(); this.mouse.left = this.mouse.right = false; });

    canvas.addEventListener('mousedown', (e) => {
      if (!this.locked) return;
      if (e.button === 0) { this.mouse.left = true; this.mousePressed.left = true; }
      if (e.button === 2) { this.mouse.right = true; this.mousePressed.right = true; }
      if (e.button === 1) { this.mouse.middle = true; this.mousePressed.middle = true; }
      this.emit('mousedown', e.button);
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.left = false;
      if (e.button === 2) this.mouse.right = false;
      if (e.button === 1) this.mouse.middle = false;
      this.emit('mouseup', e.button);
    });
    window.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.mouse.dx += e.movementX || 0;
      this.mouse.dy += e.movementY || 0;
    });
    window.addEventListener('wheel', (e) => {
      if (this.uiCapture) return;
      this.mouse.wheel += Math.sign(e.deltaY);
      e.preventDefault();
    }, { passive: false });

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas;
      this.emit('lockchange', this.locked);
    });
  }

  on(evt, fn) {
    if (!this.listeners.has(evt)) this.listeners.set(evt, []);
    this.listeners.get(evt).push(fn);
    return () => {
      const arr = this.listeners.get(evt);
      const i = arr.indexOf(fn);
      if (i >= 0) arr.splice(i, 1);
    };
  }
  emit(evt, ...args) {
    const arr = this.listeners.get(evt);
    if (arr) for (const fn of arr.slice()) fn(...args);
  }

  async requestLock() {
    if (this.locked) return true;
    try { await this.canvas.requestPointerLock(); return true; } catch (e) { return false; }
  }
  releaseLock() { if (this.locked) document.exitPointerLock(); }

  down(code) { return this.keys.has(code); }
  hit(code) { return this.pressed.has(code); }
  anyDown(...codes) { return codes.some((c) => this.keys.has(c)); }

  /** consume per-frame state; call at end of frame */
  endFrame() {
    this.pressed.clear();
    this.released.clear();
    this.mouse.dx = 0; this.mouse.dy = 0; this.mouse.wheel = 0;
    this.mousePressed.left = this.mousePressed.right = this.mousePressed.middle = false;
  }
}
