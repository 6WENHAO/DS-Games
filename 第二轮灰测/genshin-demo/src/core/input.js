// Keyboard + mouse + gamepad input with action mapping, edge detection and pointer lock.
const DEFAULT_MAP = {
  forward: ['KeyW', 'ArrowUp'], back: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
  jump: ['Space'], sprint: ['ShiftLeft', 'ShiftRight'], skill: ['KeyE'], burst: ['KeyQ'], interact: ['KeyF'],
  lockon: ['KeyR'], map: ['KeyM'], party1: ['Digit1'], party2: ['Digit2'], party3: ['Digit3'], party4: ['Digit4'],
  inventory: ['KeyB'], quests: ['KeyJ'], photo: ['KeyP'], pause: ['Escape'], walk: ['ControlLeft'], debug: ['F3'],
  sight: ['KeyV'], sprintAlt: ['ShiftRight'],
};

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.map = DEFAULT_MAP;
    this.down = new Set(); this.pressed = new Set(); this.released = new Set();
    this.mouse = { x: 0, y: 0, dx: 0, dy: 0, wheel: 0, left: false, right: false, leftPressed: false, rightPressed: false, leftHeldTime: 0, rightHeldTime: 0 };
    this.locked = false; this.enabled = true; this.uiCapture = false;
    this._touch = { active: false, move: { x: 0, y: 0 } };

    addEventListener('keydown', e => {
      if (e.repeat) return;
      if (['F5', 'F12'].includes(e.code)) return;
      this.down.add(e.code); this.pressed.add(e.code);
      if (e.code === 'Space' || e.code.startsWith('Arrow') || e.code === 'Tab') e.preventDefault();
    });
    addEventListener('keyup', e => { this.down.delete(e.code); this.released.add(e.code); });
    addEventListener('blur', () => { this.down.clear(); this.mouse.left = this.mouse.right = false; });

    canvas.addEventListener('mousedown', e => {
      if (e.button === 0) { this.mouse.left = true; this.mouse.leftPressed = true; this.mouse.leftHeldTime = 0; }
      if (e.button === 2) { this.mouse.right = true; this.mouse.rightPressed = true; }
      if (!this.locked && this.wantLock) this.requestLock();
    });
    addEventListener('mouseup', e => {
      if (e.button === 0) this.mouse.left = false;
      if (e.button === 2) this.mouse.right = false;
    });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    addEventListener('mousemove', e => {
      if (this.locked) { this.mouse.dx += e.movementX; this.mouse.dy += e.movementY; }
      this.mouse.x = e.clientX; this.mouse.y = e.clientY;
    });
    addEventListener('wheel', e => { this.mouse.wheel += Math.sign(e.deltaY); }, { passive: true });
    document.addEventListener('pointerlockchange', () => { this.locked = document.pointerLockElement === canvas; });
  }

  requestLock() {
    if (this.locked) return;
    try { const p = this.canvas.requestPointerLock?.(); if (p?.catch) p.catch(() => {}); }
    catch { /* needs a user gesture; harmless */ }
  }
  releaseLock() { if (this.locked) document.exitPointerLock?.(); }

  isDown(action) { if (!this.enabled) return false; const k = this.map[action]; return !!k && k.some(c => this.down.has(c)); }
  justPressed(action) { if (!this.enabled) return false; const k = this.map[action]; return !!k && k.some(c => this.pressed.has(c)); }
  justReleased(action) { const k = this.map[action]; return !!k && k.some(c => this.released.has(c)); }

  /** Movement axis in screen space: x = right, y = forward. Normalised. */
  moveAxis() {
    let x = 0, y = 0;
    if (this.isDown('forward')) y += 1;
    if (this.isDown('back')) y -= 1;
    if (this.isDown('right')) x += 1;
    if (this.isDown('left')) x -= 1;
    const gp = this._gamepadAxes();
    if (gp) { x += gp[0]; y -= gp[1]; }
    if (this._touch.active) { x += this._touch.move.x; y += this._touch.move.y; }
    const l = Math.hypot(x, y);
    return l > 1 ? { x: x / l, y: y / l, len: 1 } : { x, y, len: l };
  }

  _gamepadAxes() {
    const pads = navigator.getGamepads?.() ?? [];
    for (const p of pads) if (p) {
      const dz = v => Math.abs(v) < 0.18 ? 0 : v;
      return [dz(p.axes[0] ?? 0), dz(p.axes[1] ?? 0)];
    }
    return null;
  }
  gamepadLook() {
    const pads = navigator.getGamepads?.() ?? [];
    for (const p of pads) if (p) { const dz = v => Math.abs(v) < 0.2 ? 0 : v; return [dz(p.axes[2] ?? 0), dz(p.axes[3] ?? 0)]; }
    return null;
  }

  /** Called once per frame AFTER all systems read input. */
  endFrame(dt) {
    this.pressed.clear(); this.released.clear();
    this.mouse.dx = 0; this.mouse.dy = 0; this.mouse.wheel = 0;
    this.mouse.leftPressed = false; this.mouse.rightPressed = false;
    if (this.mouse.left) this.mouse.leftHeldTime += dt; else this.mouse.leftHeldTime = 0;
    if (this.mouse.right) this.mouse.rightHeldTime += dt; else this.mouse.rightHeldTime = 0;
  }
}
