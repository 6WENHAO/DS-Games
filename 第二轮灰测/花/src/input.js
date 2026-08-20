// Input: keyboard, mouse drag, wheel, touch.

export class Input {
  constructor(dom) {
    this.keys = new Set();
    this.orbit = { x: 0, y: 0 };
    this.zoom = 0;
    this.dragging = false;
    this.lastDrag = 1e9;
    this.joystick = { x: 0, y: 0, active: false };
    this.onKey = null;
    this.pointerId = null;
    this.px = 0; this.py = 0;
    this.touchMode = null;

    const el = dom;
    this._el = el;

    window.addEventListener('keydown', (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      this.keys.add(k);
      if (this.onKey) this.onKey(k, e);
      if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
    }, { passive: false });

    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());

    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      this.pointerId = e.pointerId;
      this.dragging = true;
      this.px = e.clientX; this.py = e.clientY;
      this.touchMode = null;
      if (e.pointerType !== 'mouse') {
        const rect = el.getBoundingClientRect();
        // lower third of the screen behaves like a thumb stick
        this.touchMode = (e.clientY - rect.top) / rect.height > 0.66 ? 'move' : 'look';
        if (this.touchMode === 'move') {
          this.joystick.active = true;
          this.joyOrigin = { x: e.clientX, y: e.clientY };
        }
      }
      el.setPointerCapture?.(e.pointerId);
    });

    el.addEventListener('pointermove', (e) => {
      if (!this.dragging || e.pointerId !== this.pointerId) return;
      const dx = e.clientX - this.px;
      const dy = e.clientY - this.py;
      this.px = e.clientX; this.py = e.clientY;
      if (this.touchMode === 'move') {
        const jx = (e.clientX - this.joyOrigin.x) / 70;
        const jy = (e.clientY - this.joyOrigin.y) / 70;
        this.joystick.x = Math.max(-1, Math.min(1, jx));
        this.joystick.y = Math.max(-1, Math.min(1, jy));
      } else {
        this.orbit.x += dx;
        this.orbit.y += dy;
        this.lastDrag = 0;
      }
    });

    const end = (e) => {
      if (e.pointerId !== undefined && e.pointerId !== this.pointerId) return;
      this.dragging = false;
      this.pointerId = null;
      this.joystick.active = false;
      this.joystick.x = 0; this.joystick.y = 0;
      this.touchMode = null;
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('pointerleave', end);

    el.addEventListener('wheel', (e) => {
      this.zoom += Math.sign(e.deltaY) * Math.min(2.2, Math.abs(e.deltaY) * 0.012);
      e.preventDefault();
    }, { passive: false });

    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /** consume accumulated orbit delta */
  takeOrbit() {
    const o = { x: this.orbit.x, y: this.orbit.y };
    this.orbit.x = 0; this.orbit.y = 0;
    return o;
  }

  takeZoom() {
    const z = this.zoom;
    this.zoom = 0;
    return z;
  }

  axes() {
    const k = this.keys;
    let x = 0, y = 0;
    if (k.has('w') || k.has('arrowup')) y += 1;
    if (k.has('s') || k.has('arrowdown')) y -= 1;
    if (k.has('a') || k.has('arrowleft')) x -= 1;
    if (k.has('d') || k.has('arrowright')) x += 1;
    if (this.joystick.active) {
      x += this.joystick.x;
      y -= this.joystick.y;
    }
    const l = Math.hypot(x, y);
    if (l > 1) { x /= l; y /= l; }
    return { x, y };
  }

  get boost() { return this.keys.has('shift') ? 1 : 0; }
  get lift() {
    let l = this.keys.has(' ') ? 1 : 0;
    if (this.keys.has('control') || this.keys.has('z')) l -= 0.65;
    return l;
  }

  update(dt) {
    this.lastDrag += dt;
  }
}
