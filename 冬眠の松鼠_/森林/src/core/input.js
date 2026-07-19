// 键盘/鼠标输入与指针锁定
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.pointerLocked = false;
    this.attackPressed = false;   // 本帧按下
    this.attackHeld = false;
    this.onKeyPress = null;       // (code) => void
    this.enabled = false;

    document.addEventListener('keydown', (e) => {
      if (!this.enabled) return;
      if (!e.repeat) {
        this.keys.add(e.code);
        if (this.onKeyPress) this.onKeyPress(e.code);
      }
      if (['Tab', 'Space'].includes(e.code)) e.preventDefault();
    });
    document.addEventListener('keyup', (e) => this.keys.delete(e.code));

    document.addEventListener('mousemove', (e) => {
      if (this.pointerLocked) {
        this.mouseDX += e.movementX;
        this.mouseDY += e.movementY;
      }
    });

    document.addEventListener('mousedown', (e) => {
      if (!this.enabled || !this.pointerLocked) return;
      if (e.button === 0) { this.attackPressed = true; this.attackHeld = true; }
    });
    document.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.attackHeld = false;
    });

    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === this.canvas;
      if (!this.pointerLocked && this.onPointerUnlock) this.onPointerUnlock();
    });
  }

  lock() {
    if (!this.pointerLocked) this.canvas.requestPointerLock();
  }

  unlock() {
    if (this.pointerLocked) document.exitPointerLock();
  }

  down(code) { return this.keys.has(code); }

  consumeMouse() {
    const dx = this.mouseDX, dy = this.mouseDY;
    this.mouseDX = 0; this.mouseDY = 0;
    return [dx, dy];
  }

  endFrame() {
    this.attackPressed = false;
  }
}
