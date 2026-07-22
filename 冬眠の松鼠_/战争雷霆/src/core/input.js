/**
 * 输入管理：键盘 / 鼠标 / 指针锁定
 */
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.wheelDelta = 0;
    this.mouseDown = { 0: false, 1: false, 2: false };
    this.pointerLocked = false;
    this.enabled = false;
    this.onPointerLockChange = null;
    this.onKeyDown = null;
    this.onMouseDown = null;

    document.addEventListener('keydown', (e) => {
      if (!this.enabled) return;
      if (e.code === 'Tab' || e.code === 'F1') e.preventDefault();
      if (!e.repeat) {
        this.keys.add(e.code);
        if (this.onKeyDown) this.onKeyDown(e.code, e);
      }
    });
    document.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    document.addEventListener('mousemove', (e) => {
      if (!this.enabled || !this.pointerLocked) return;
      this.mouseDX += e.movementX;
      this.mouseDY += e.movementY;
    });
    document.addEventListener('mousedown', (e) => {
      if (!this.enabled) return;
      this.mouseDown[e.button] = true;
      if (this.onMouseDown) this.onMouseDown(e.button);
    });
    document.addEventListener('mouseup', (e) => { this.mouseDown[e.button] = false; });
    document.addEventListener('wheel', (e) => {
      if (!this.enabled) return;
      this.wheelDelta += Math.sign(e.deltaY);
    }, { passive: true });
    document.addEventListener('contextmenu', (e) => {
      if (this.enabled) e.preventDefault();
    });

    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === this.canvas;
      if (this.onPointerLockChange) this.onPointerLockChange(this.pointerLocked);
    });
  }

  lockPointer() {
    if (document.pointerLockElement !== this.canvas) {
      this.canvas.requestPointerLock();
    }
  }
  unlockPointer() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  isDown(code) { return this.keys.has(code); }

  /** 每帧结束后调用，清算增量 */
  consumeDeltas() {
    const d = { dx: this.mouseDX, dy: this.mouseDY, wheel: this.wheelDelta };
    this.mouseDX = 0; this.mouseDY = 0; this.wheelDelta = 0;
    return d;
  }
}
