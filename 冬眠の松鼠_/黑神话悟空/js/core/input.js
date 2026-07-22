export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set();          // cleared each frame
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.lmbDown = false;
    this.rmbDown = false;
    this.lmbPressed = false;
    this.rmbPressed = false;
    this.rmbReleased = false;
    this.lockRequested = false;
    this.enabled = false;

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressed.add(e.code);
      if (e.code === 'Tab') e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    canvas.addEventListener('mousedown', (e) => {
      if (!this.enabled) return;
      if (document.pointerLockElement !== canvas) {
        this.requestLock();
        return;
      }
      if (e.button === 0) { this.lmbDown = true; this.lmbPressed = true; }
      if (e.button === 2) { this.rmbDown = true; this.rmbPressed = true; }
      if (e.button === 1) { this.pressed.add('MMB'); e.preventDefault(); }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.lmbDown = false;
      if (e.button === 2) { if (this.rmbDown) this.rmbReleased = true; this.rmbDown = false; }
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    window.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === this.canvas) {
        this.mouseDX += e.movementX;
        this.mouseDY += e.movementY;
      }
    });
  }

  requestLock() {
    if (document.pointerLockElement !== this.canvas) {
      try {
        const p = this.canvas.requestPointerLock?.();
        if (p && p.catch) p.catch(() => {});
      } catch (e) { /* headless / unsupported */ }
    }
  }

  releaseLock() {
    if (document.pointerLockElement === this.canvas) document.exitPointerLock?.();
  }

  get locked() {
    return document.pointerLockElement === this.canvas;
  }

  moveVector() {
    let x = 0, z = 0;
    if (this.keys.has('KeyW')) z += 1;
    if (this.keys.has('KeyS')) z -= 1;
    if (this.keys.has('KeyA')) x -= 1;
    if (this.keys.has('KeyD')) x += 1;
    const len = Math.hypot(x, z);
    if (len > 0) { x /= len; z /= len; }
    return { x, z, active: len > 0 };
  }

  wasPressed(code) { return this.pressed.has(code); }

  endFrame() {
    this.pressed.clear();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.lmbPressed = false;
    this.rmbPressed = false;
    this.rmbReleased = false;
  }
}
