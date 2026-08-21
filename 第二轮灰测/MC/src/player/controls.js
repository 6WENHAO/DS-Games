/**
 * player/controls.js
 * ------------------------------------------------------------------
 * Input: keyboard, mouse (with pointer lock), scroll wheel and touch.
 *
 * The class only *collects* state; the game loop reads `movementInput()`
 * each frame and reacts to the queued one-shot actions. That keeps input
 * frame-rate independent and makes key remapping trivial.
 */

/** Default key bindings, using KeyboardEvent.code so layout does not matter. */
export const DEFAULT_BINDINGS = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  jump: ['Space'],
  sneak: ['ShiftLeft', 'ShiftRight'],
  sprint: ['ControlLeft', 'ControlRight'],
  inventory: ['KeyE'],
  drop: ['KeyQ'],
  chat: ['KeyT', 'Slash'],
  debug: ['F3'],
  perspective: ['F5'],
  fullscreen: ['F11'],
  screenshot: ['F2'],
  pause: ['Escape'],
  hotbar: ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9'],
};

export class Controls {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {object} [opts]
   */
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.bindings = { ...DEFAULT_BINDINGS, ...(opts.bindings ?? {}) };
    this.sensitivity = opts.sensitivity ?? 0.0022;
    this.invertY = opts.invertY ?? false;

    /** Held keys, by event.code. */
    this.keys = new Set();
    /** Mouse buttons currently down. */
    this.buttons = new Set();
    /** Accumulated mouse delta since the last read. */
    this.mouseDX = 0;
    this.mouseDY = 0;
    /** Accumulated wheel delta since the last read. */
    this.wheel = 0;
    /** Cursor position in CSS pixels (used by GUI screens). */
    this.cursorX = 0;
    this.cursorY = 0;

    this.pointerLocked = false;
    /** True while any GUI screen wants the cursor. */
    this.guiMode = false;

    /** One-shot actions, drained by the game each frame. */
    this.actions = [];
    /** Text typed while a text field has focus. */
    this.textBuffer = '';
    this.captureText = false;

    /** Callbacks. */
    this.onPointerLockChange = null;
    this.onMouseDown = null;
    this.onMouseUp = null;
    this.onMouseMoveGui = null;
    this.onWheelGui = null;
    this.onKeyDownRaw = null;
    /**
     * Called first for every keydown. Returning `true` means the key was
     * consumed (by an open screen or the chat bar) and must not also be
     * turned into a game action.
     */
    /**
     * Fired synchronously from the keydown handler, because the Fullscreen
     * API only works inside a user-gesture context.
     */
    this.onFullscreenToggle = null;

    this.#bind();
  }

  /* ---------------------------------------------------------------- */
  /* setup                                                           */
  /* ---------------------------------------------------------------- */

  #bind() {
    this.handlers = {
      keydown: (e) => this.#onKeyDown(e),
      keyup: (e) => this.#onKeyUp(e),
      mousedown: (e) => this.#onMouseDown(e),
      mouseup: (e) => this.#onMouseUp(e),
      mousemove: (e) => this.#onMouseMove(e),
      wheel: (e) => this.#onWheel(e),
      contextmenu: (e) => e.preventDefault(),
      pointerlockchange: () => this.#onPointerLockChange(),
      blur: () => this.releaseAll(),
      touchstart: (e) => this.#onTouch(e, 'start'),
      touchmove: (e) => this.#onTouch(e, 'move'),
      touchend: (e) => this.#onTouch(e, 'end'),
    };

    window.addEventListener('keydown', this.handlers.keydown, { passive: false });
    window.addEventListener('keyup', this.handlers.keyup);
    window.addEventListener('blur', this.handlers.blur);
    this.canvas.addEventListener('mousedown', this.handlers.mousedown);
    window.addEventListener('mouseup', this.handlers.mouseup);
    window.addEventListener('mousemove', this.handlers.mousemove);
    this.canvas.addEventListener('wheel', this.handlers.wheel, { passive: false });
    this.canvas.addEventListener('contextmenu', this.handlers.contextmenu);
    document.addEventListener('pointerlockchange', this.handlers.pointerlockchange);
    this.canvas.addEventListener('touchstart', this.handlers.touchstart, { passive: false });
    this.canvas.addEventListener('touchmove', this.handlers.touchmove, { passive: false });
    this.canvas.addEventListener('touchend', this.handlers.touchend, { passive: false });
  }

  dispose() {
    window.removeEventListener('keydown', this.handlers.keydown);
    window.removeEventListener('keyup', this.handlers.keyup);
    window.removeEventListener('blur', this.handlers.blur);
    this.canvas.removeEventListener('mousedown', this.handlers.mousedown);
    window.removeEventListener('mouseup', this.handlers.mouseup);
    window.removeEventListener('mousemove', this.handlers.mousemove);
    this.canvas.removeEventListener('wheel', this.handlers.wheel);
    this.canvas.removeEventListener('contextmenu', this.handlers.contextmenu);
    document.removeEventListener('pointerlockchange', this.handlers.pointerlockchange);
    this.canvas.removeEventListener('touchstart', this.handlers.touchstart);
    this.canvas.removeEventListener('touchmove', this.handlers.touchmove);
    this.canvas.removeEventListener('touchend', this.handlers.touchend);
  }

  /* ---------------------------------------------------------------- */
  /* pointer lock                                                    */
  /* ---------------------------------------------------------------- */

  /**
   * Asks for pointer lock.
   *
   * Browsers reject this unless it happens inside a user gesture, and
   * Chromium also rejects the `unadjustedMovement` option on some
   * platforms. Both rejections are expected and must stay silent - an
   * unhandled rejection here would otherwise look like a crash.
   */
  requestPointerLock() {
    if (this.pointerLocked) return;
    const el = this.canvas;
    if (!el.requestPointerLock) return;
    try {
      const promise = el.requestPointerLock({ unadjustedMovement: true });
      if (promise?.catch) {
        promise.catch(() => {
          // Retry without the option, then give up quietly.
          try {
            const plain = el.requestPointerLock();
            if (plain?.catch) plain.catch(() => {});
          } catch { /* no gesture: ignore */ }
        });
      }
    } catch { /* no gesture: ignore */ }
  }

  exitPointerLock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  #onPointerLockChange() {
    this.pointerLocked = document.pointerLockElement === this.canvas;
    if (!this.pointerLocked) this.releaseAll();
    this.onPointerLockChange?.(this.pointerLocked);
  }

  /** Clears held inputs, e.g. when the window loses focus. */
  releaseAll() {
    this.keys.clear();
    this.buttons.clear();
    this.mouseDX = 0;
    this.mouseDY = 0;
  }

  /* ---------------------------------------------------------------- */
  /* handlers                                                        */
  /* ---------------------------------------------------------------- */

  #isBound(action, code) {
    return this.bindings[action]?.includes(code);
  }

  #onKeyDown(e) {
    // Let the browser keep its reload / devtools shortcuts.
    if (e.ctrlKey && ['KeyR', 'KeyW', 'KeyT', 'KeyN'].includes(e.code)) return;
    if (['F5', 'F11', 'F12'].includes(e.code) && e.ctrlKey) return;

    /*
     * Give the open screen (or the chat bar) first refusal. If it consumed
     * the key we must stop here: otherwise the same press would ALSO be
     * queued as a game action, and a key that both closes a screen and
     * toggles it - E for the inventory - would close it synchronously and
     * then reopen it from the queue on the next frame, appearing to do
     * nothing at all.
     */
    if (this.onKeyDownRaw?.(e) === true) {
      e.preventDefault();
      // Track the key as held so auto-repeat does not fire again.
      this.keys.add(e.code);
      return;
    }
    if (this.captureText) {
      // Text entry swallows everything except the control keys.
      if (e.code === 'Escape' || e.code === 'Enter' || e.code === 'NumpadEnter') {
        this.actions.push({ type: e.code === 'Escape' ? 'text-cancel' : 'text-submit' });
      } else if (e.code === 'Backspace') {
        this.textBuffer = this.textBuffer.slice(0, -1);
      } else if (e.code === 'Tab') {
        this.actions.push({ type: 'text-complete' });
      } else if (e.key && e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
        this.textBuffer += e.key;
      }
      e.preventDefault();
      return;
    }

    if (this.keys.has(e.code)) { e.preventDefault(); return; }
    this.keys.add(e.code);

    /*
     * Fullscreen is handled synchronously, right here, rather than through
     * the action queue: `requestFullscreen()` is only permitted inside a
     * user-gesture context, and the queue is drained from
     * requestAnimationFrame, where the browser would reject the request.
     */
    if (this.#isBound('fullscreen', e.code)) {
      e.preventDefault();
      this.onFullscreenToggle?.();
      return;
    }

    // --- one-shot actions ---------------------------------------
    if (this.#isBound('pause', e.code)) this.actions.push({ type: 'pause' });
    else if (this.#isBound('inventory', e.code)) this.actions.push({ type: 'inventory' });
    else if (this.#isBound('drop', e.code)) this.actions.push({ type: 'drop', all: e.ctrlKey });
    else if (this.#isBound('chat', e.code)) {
      this.actions.push({ type: 'chat', command: e.code === 'Slash' });
    } else if (this.#isBound('debug', e.code)) this.actions.push({ type: 'debug' });
    else if (this.#isBound('perspective', e.code)) this.actions.push({ type: 'perspective' });
    else if (this.#isBound('screenshot', e.code)) this.actions.push({ type: 'screenshot' });
    else if (this.#isBound('jump', e.code)) this.actions.push({ type: 'jump-tap' });
    else {
      const slot = this.bindings.hotbar.indexOf(e.code);
      if (slot >= 0) this.actions.push({ type: 'hotbar', slot });
    }

    // Prevent the page from scrolling on space / arrows.
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) {
      e.preventDefault();
    }
    /*
     * Only suppress the browser's default for function keys the game
     * actually uses. Blanket-suppressing every F-key used to swallow F12
     * (developer tools) and F11 (native fullscreen) while doing nothing
     * with them, which left those keys simply dead.
     */
    if (this.#isFunctionKeyHandled(e.code)) e.preventDefault();
  }

  /** True when `code` is a function key bound to a game action. */
  #isFunctionKeyHandled(code) {
    if (!/^F\d{1,2}$/.test(code)) return false;
    for (const [action, codes] of Object.entries(this.bindings)) {
      if (action === 'hotbar') continue;
      if (codes.includes(code)) return true;
    }
    return false;
  }

  #onKeyUp(e) {
    this.keys.delete(e.code);
  }

  #onMouseDown(e) {
    this.buttons.add(e.button);
    this.cursorX = e.clientX;
    this.cursorY = e.clientY;
    this.onMouseDown?.(e.button, e);
    if (!this.guiMode) e.preventDefault();
  }

  #onMouseUp(e) {
    this.buttons.delete(e.button);
    this.onMouseUp?.(e.button, e);
  }

  #onMouseMove(e) {
    if (this.pointerLocked) {
      this.mouseDX += e.movementX ?? 0;
      this.mouseDY += e.movementY ?? 0;
    } else {
      this.cursorX = e.clientX;
      this.cursorY = e.clientY;
      this.onMouseMoveGui?.(e.clientX, e.clientY);
    }
  }

  #onWheel(e) {
    e.preventDefault();
    if (this.guiMode) { this.onWheelGui?.(e.deltaY); return; }
    this.wheel += e.deltaY;
  }

  /**
   * Minimal touch support: the left third of the screen is a virtual
   * stick, the rest looks around, and a tap mines.
   */
  #onTouch(e, phase) {
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    for (const touch of e.changedTouches) {
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;
      const isStick = x < rect.width * 0.35;
      if (phase === 'start') {
        if (isStick) this.touchStick = { id: touch.identifier, ox: x, oy: y, dx: 0, dy: 0 };
        else this.touchLook = { id: touch.identifier, lx: x, ly: y, moved: 0 };
      } else if (phase === 'move') {
        if (this.touchStick?.id === touch.identifier) {
          this.touchStick.dx = x - this.touchStick.ox;
          this.touchStick.dy = y - this.touchStick.oy;
        } else if (this.touchLook?.id === touch.identifier) {
          this.mouseDX += (x - this.touchLook.lx) * 2.2;
          this.mouseDY += (y - this.touchLook.ly) * 2.2;
          this.touchLook.moved += Math.abs(x - this.touchLook.lx) + Math.abs(y - this.touchLook.ly);
          this.touchLook.lx = x;
          this.touchLook.ly = y;
        }
      } else {
        if (this.touchStick?.id === touch.identifier) this.touchStick = null;
        else if (this.touchLook?.id === touch.identifier) {
          if (this.touchLook.moved < 12) this.actions.push({ type: 'touch-tap' });
          this.touchLook = null;
        }
      }
    }
  }

  /* ---------------------------------------------------------------- */
  /* per-frame reads                                                 */
  /* ---------------------------------------------------------------- */

  #held(action) {
    for (const code of this.bindings[action] ?? []) if (this.keys.has(code)) return true;
    return false;
  }

  /** Axis-style movement input for the player integrator. */
  movementInput() {
    let forward = (this.#held('forward') ? 1 : 0) - (this.#held('back') ? 1 : 0);
    let strafe = (this.#held('right') ? 1 : 0) - (this.#held('left') ? 1 : 0);
    if (this.touchStick) {
      const dead = 12;
      const scale = 1 / 60;
      const dx = this.touchStick.dx;
      const dy = this.touchStick.dy;
      if (Math.abs(dy) > dead) forward = Math.max(-1, Math.min(1, -dy * scale));
      if (Math.abs(dx) > dead) strafe = Math.max(-1, Math.min(1, dx * scale));
    }
    return {
      forward,
      strafe,
      jump: this.#held('jump'),
      sneak: this.#held('sneak'),
      sprint: this.#held('sprint'),
      up: 0,
    };
  }

  /** Consumes the accumulated look delta, returning radians. */
  takeLookDelta() {
    const sign = this.invertY ? -1 : 1;
    const dx = this.mouseDX * this.sensitivity;
    const dy = this.mouseDY * this.sensitivity * sign;
    this.mouseDX = 0;
    this.mouseDY = 0;
    return { yaw: dx, pitch: dy };
  }

  /** Consumes the accumulated wheel delta as a discrete step count. */
  takeWheelSteps() {
    if (this.wheel === 0) return 0;
    const steps = Math.sign(this.wheel) * Math.max(1, Math.round(Math.abs(this.wheel) / 100));
    this.wheel = 0;
    return steps;
  }

  /** Consumes queued one-shot actions. */
  takeActions() {
    if (this.actions.length === 0) return null;
    const list = this.actions;
    this.actions = [];
    return list;
  }

  isMouseDown(button) { return this.buttons.has(button); }

  /** Begins/ends text capture for the chat bar. */
  startTextCapture(initial = '') {
    this.captureText = true;
    this.textBuffer = initial;
  }

  endTextCapture() {
    this.captureText = false;
    const text = this.textBuffer;
    this.textBuffer = '';
    return text;
  }
}
