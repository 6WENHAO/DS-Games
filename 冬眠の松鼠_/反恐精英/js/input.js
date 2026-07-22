// ============================================================
//  input.js  -  keyboard + mouse + pointer lock
// ============================================================
export class Input {
  constructor(domElement) {
    this.el = domElement;
    this.keys = {};
    this.mouse = { dx: 0, dy: 0, left: false, right: false, wheel: 0 };
    this.locked = false;
    this.sensitivity = 2.2;
    this._pressed = {};      // edge-triggered this frame
    this._mousePressed = {}; // edge-triggered mouse
    this.onLockChange = null;

    // callbacks that fire regardless of lock (menus)
    this.globalKeyHandlers = {};

    window.addEventListener("keydown", (e) => this._onKey(e, true));
    window.addEventListener("keyup", (e) => this._onKey(e, false));
    window.addEventListener("mousedown", (e) => this._onMouse(e, true));
    window.addEventListener("mouseup", (e) => this._onMouse(e, false));
    window.addEventListener("mousemove", (e) => this._onMove(e));
    window.addEventListener("wheel", (e) => { if (this.locked) this.mouse.wheel += Math.sign(e.deltaY); }, { passive: true });
    window.addEventListener("contextmenu", (e) => e.preventDefault());

    document.addEventListener("pointerlockchange", () => {
      this.locked = document.pointerLockElement === this.el;
      if (this.onLockChange) this.onLockChange(this.locked);
    });
  }

  requestLock() {
    if (this.el.requestPointerLock) this.el.requestPointerLock();
  }
  exitLock() {
    if (document.exitPointerLock) document.exitPointerLock();
  }

  _onKey(e, down) {
    const code = e.code;
    if (down && !this.keys[code]) this._pressed[code] = true;
    this.keys[code] = down;
    // global handlers (buy menu, scoreboard, etc.) run always
    if (down && this.globalKeyHandlers[code]) {
      this.globalKeyHandlers[code](e);
    }
    // prevent scrolling / default for gameplay keys while playing
    if (this.locked && ["Space", "Tab", "KeyE", "KeyR", "Digit1", "Digit2", "Digit3", "Digit4", "Digit5"].includes(code)) {
      e.preventDefault();
    }
    if (code === "Tab") e.preventDefault();
  }

  _onMouse(e, down) {
    if (e.button === 0) { this.mouse.left = down; if (down) this._mousePressed[0] = true; }
    if (e.button === 2) { this.mouse.right = down; if (down) this._mousePressed[2] = true; }
  }

  _onMove(e) {
    if (this.locked) {
      this.mouse.dx += e.movementX || 0;
      this.mouse.dy += e.movementY || 0;
    }
  }

  // edge-triggered helpers
  wasPressed(code) { return !!this._pressed[code]; }
  wasMousePressed(btn) { return !!this._mousePressed[btn]; }

  // call at end of frame
  endFrame() {
    this.mouse.dx = 0;
    this.mouse.dy = 0;
    this.mouse.wheel = 0;
    this._pressed = {};
    this._mousePressed = {};
  }
}
