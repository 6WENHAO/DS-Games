/**
 * SALTWAKE — input.
 *
 * Keyboard and mouse with pointer lock. Bindings are WASD plus the 1997
 * conventions the genre still uses: shift to run, space to jump, control to
 * crouch, E to use, R to reload, number keys and the wheel to switch weapons.
 *
 * Mouse deltas are accumulated between frames and consumed by the player, so
 * turning is frame-rate independent.
 */
export class Input {
  /** @param {HTMLCanvasElement} canvas */
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.mouseDx = 0;
    this.mouseDy = 0;
    this.fire = false;
    this.altFire = false;
    this.locked = false;
    this.wheel = 0;
    this.weaponRequest = -1;
    this.pressed = new Set();
    this.enabled = true;

    this._onKeyDown = (e) => {
      if (!this.enabled) return;
      if (e.repeat) { e.preventDefault(); return; }
      this.keys.add(e.code);
      this.pressed.add(e.code);
      const n = KEY_TO_SLOT[e.code];
      if (n !== undefined) this.weaponRequest = n;
      // Stop the browser scrolling or activating anything while playing.
      if (BLOCKED.has(e.code)) e.preventDefault();
    };
    this._onKeyUp = (e) => { this.keys.delete(e.code); };
    this._onMouseMove = (e) => {
      if (!this.locked) return;
      this.mouseDx += e.movementX || 0;
      this.mouseDy += e.movementY || 0;
    };
    this._onMouseDown = (e) => {
      if (!this.locked) { this.requestLock(); return; }
      if (e.button === 0) this.fire = true;
      if (e.button === 2) this.altFire = true;
    };
    this._onMouseUp = (e) => {
      if (e.button === 0) this.fire = false;
      if (e.button === 2) this.altFire = false;
    };
    this._onWheel = (e) => {
      if (!this.locked) return;
      this.wheel += Math.sign(e.deltaY);
      e.preventDefault();
    };
    this._onContext = (e) => e.preventDefault();
    this._onLockChange = () => {
      this.locked = document.pointerLockElement === this.canvas;
      if (!this.locked) { this.fire = false; this.altFire = false; this.keys.clear(); }
      if (this.onLockChange) this.onLockChange(this.locked);
    };
    this._onBlur = () => { this.keys.clear(); this.fire = false; this.altFire = false; };

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    window.addEventListener('wheel', this._onWheel, { passive: false });
    window.addEventListener('blur', this._onBlur);
    canvas.addEventListener('contextmenu', this._onContext);
    document.addEventListener('pointerlockchange', this._onLockChange);
  }

  requestLock() {
    if (this.canvas.requestPointerLock) this.canvas.requestPointerLock();
  }

  releaseLock() {
    if (document.exitPointerLock) document.exitPointerLock();
  }

  down(code) { return this.keys.has(code); }

  /** True once per physical press. */
  tapped(code) {
    if (!this.pressed.has(code)) return false;
    this.pressed.delete(code);
    return true;
  }

  /** Snapshot for this frame; also drains the accumulated deltas. */
  sample() {
    const forward = (this.down('KeyW') || this.down('ArrowUp') ? 1 : 0)
      - (this.down('KeyS') || this.down('ArrowDown') ? 1 : 0);
    const strafe = (this.down('KeyD') || this.down('ArrowRight') ? 1 : 0)
      - (this.down('KeyA') || this.down('ArrowLeft') ? 1 : 0);
    const state = {
      forward,
      strafe,
      jump: this.down('Space'),
      run: this.down('ShiftLeft') || this.down('ShiftRight'),
      crouch: this.down('ControlLeft') || this.down('ControlRight') || this.down('KeyC'),
      fire: this.fire,
      altFire: this.altFire,
      use: this.tapped('KeyE') || this.tapped('KeyF'),
      reload: this.tapped('KeyR'),
      dx: this.mouseDx,
      dy: this.mouseDy,
      wheel: this.wheel,
      weapon: this.weaponRequest,
    };
    this.mouseDx = 0;
    this.mouseDy = 0;
    this.wheel = 0;
    this.weaponRequest = -1;
    return state;
  }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('mousemove', this._onMouseMove);
    window.removeEventListener('mousedown', this._onMouseDown);
    window.removeEventListener('mouseup', this._onMouseUp);
    window.removeEventListener('wheel', this._onWheel);
    window.removeEventListener('blur', this._onBlur);
    this.canvas.removeEventListener('contextmenu', this._onContext);
    document.removeEventListener('pointerlockchange', this._onLockChange);
  }
}

const KEY_TO_SLOT = {
  Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Digit5: 4, Digit6: 5,
};

const BLOCKED = new Set([
  'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6',
  'ControlLeft', 'ControlRight', 'KeyE', 'KeyR', 'Tab',
]);
