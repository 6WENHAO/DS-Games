// ---------------------------------------------------------------------------
// 输入：键盘 / 鼠标 / 指针锁定
// ---------------------------------------------------------------------------

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.down = new Set();
    this.justPressed = new Set();
    this.justReleased = new Set();
    this.mouse = { dx: 0, dy: 0, wheel: 0 };
    this.buttons = [false, false, false];
    this.buttonPressed = [false, false, false];
    this.buttonReleased = [false, false, false];
    this.locked = false;
    this.enabled = true;
    this.sensitivity = 2.2;
    this.invertY = false;
    this.rawInput = true;
    this._onLockChange = null;
    this._bind();
  }

  _bind() {
    const stopFor = new Set(['Tab', 'Space', 'F1', 'F3', 'F5', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
      'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0']);
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (stopFor.has(e.code)) e.preventDefault();
      this.down.add(e.code);
      this.justPressed.add(e.code);
    });
    window.addEventListener('keyup', (e) => {
      this.down.delete(e.code);
      this.justReleased.add(e.code);
    });
    window.addEventListener('blur', () => {
      this.down.clear();
      this.buttons[0] = this.buttons[1] = this.buttons[2] = false;
    });
    this.canvas.addEventListener('mousedown', (e) => {
      if (!this.locked) return;
      const b = e.button === 2 ? 2 : e.button === 1 ? 1 : 0;
      if (!this.buttons[b]) this.buttonPressed[b] = true;
      this.buttons[b] = true;
      e.preventDefault();
    });
    window.addEventListener('mouseup', (e) => {
      const b = e.button === 2 ? 2 : e.button === 1 ? 1 : 0;
      if (this.buttons[b]) this.buttonReleased[b] = true;
      this.buttons[b] = false;
    });
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('mousemove', (e) => {
      if (!this.locked || !this.enabled) return;
      this.mouse.dx += e.movementX || 0;
      this.mouse.dy += e.movementY || 0;
    });
    this.canvas.addEventListener('wheel', (e) => {
      if (!this.locked) return;
      this.mouse.wheel += Math.sign(e.deltaY);
      e.preventDefault();
    }, { passive: false });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas;
      if (this._onLockChange) this._onLockChange(this.locked);
    });
    document.addEventListener('pointerlockerror', () => {
      this.locked = false;
      if (this._onLockChange) this._onLockChange(false);
    });
  }

  onLockChange(fn) { this._onLockChange = fn; }

  async lock() {
    if (this.locked) return true;
    try {
      const p = this.canvas.requestPointerLock({ unadjustedMovement: this.rawInput });
      if (p && p.then) await p;
      return true;
    } catch (e) {
      try { this.canvas.requestPointerLock(); return true; } catch (e2) { return false; }
    }
  }
  unlock() { if (document.pointerLockElement) document.exitPointerLock(); }

  isDown(code) { return this.down.has(code); }
  pressed(code) { return this.justPressed.has(code); }
  released(code) { return this.justReleased.has(code); }
  btn(i) { return this.buttons[i]; }
  btnPressed(i) { return this.buttonPressed[i]; }
  btnReleased(i) { return this.buttonReleased[i]; }

  /** 取出并清空本帧鼠标位移（已乘灵敏度，返回弧度） */
  takeLook() {
    const k = 0.00022 * this.sensitivity;
    const yaw = -this.mouse.dx * k;
    const pitch = (this.invertY ? this.mouse.dy : -this.mouse.dy) * k;
    this.mouse.dx = 0; this.mouse.dy = 0;
    return { yaw, pitch };
  }

  takeWheel() { const w = this.mouse.wheel; this.mouse.wheel = 0; return w; }

  endFrame() {
    this.justPressed.clear();
    this.justReleased.clear();
    this.buttonPressed[0] = this.buttonPressed[1] = this.buttonPressed[2] = false;
    this.buttonReleased[0] = this.buttonReleased[1] = this.buttonReleased[2] = false;
  }
}

/** 默认按键绑定 */
export const BINDS = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  jump: ['Space'],
  duck: ['ControlLeft', 'ControlRight', 'KeyC'],
  walk: ['ShiftLeft', 'ShiftRight'],
  reload: ['KeyR'],
  use: ['KeyE'],
  drop: ['KeyG'],
  buy: ['KeyB'],
  scoreboard: ['Tab'],
  slot1: ['Digit1'],
  slot2: ['Digit2'],
  slot3: ['Digit3'],
  slot4: ['Digit4'],
  slot5: ['Digit5'],
  lastWeapon: ['KeyQ'],
  inspect: ['KeyF'],
  radio: ['KeyZ'],
  menu: ['Escape'],
  spray: ['KeyT'],
  zeus: ['KeyX'],
};

export function anyDown(input, list) {
  for (const c of list) if (input.isDown(c)) return true;
  return false;
}
export function anyPressed(input, list) {
  for (const c of list) if (input.pressed(c)) return true;
  return false;
}
