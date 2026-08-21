/**
 * 统一输入层：键盘 + 鼠标（拖拽/指针锁定）+ 触屏虚拟摇杆 + 游戏手柄。
 * 输出统一的 state：pitch/yaw/roll/throttleDelta/boost/brake/warp…
 */
import { clamp, clamp01 } from '../util/math.js';

/** 虚拟摇杆（触屏 & 鼠标均可） */
class Joystick {
  constructor(base, knob, { onStart, onEnd } = {}) {
    this.base = base;
    this.knob = knob;
    this.x = 0;
    this.y = 0;
    this.active = false;
    this.pointerId = null;
    this.onStart = onStart;
    this.onEnd = onEnd;
    this._radius = 52;

    const down = (e) => {
      if (this.pointerId !== null) return;
      this.pointerId = e.pointerId;
      this.active = true;
      base.classList.add('active');
      this._radius = Math.max(28, base.clientWidth * 0.42);
      this._center = this._centerOf();
      this._move(e);
      base.setPointerCapture?.(e.pointerId);
      this.onStart?.();
      e.preventDefault();
    };
    const move = (e) => {
      if (e.pointerId !== this.pointerId) return;
      this._move(e);
      e.preventDefault();
    };
    const up = (e) => {
      if (e.pointerId !== this.pointerId) return;
      this.pointerId = null;
      this.active = false;
      this.x = 0; this.y = 0;
      base.classList.remove('active');
      knob.style.transform = 'translate(-50%, -50%)';
      this.onEnd?.();
    };
    base.addEventListener('pointerdown', down, { passive: false });
    base.addEventListener('pointermove', move, { passive: false });
    base.addEventListener('pointerup', up);
    base.addEventListener('pointercancel', up);
    base.addEventListener('lostpointercapture', up);
  }

  _centerOf() {
    const r = this.base.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  _move(e) {
    if (!this._center) this._center = this._centerOf();
    let dx = e.clientX - this._center.x;
    let dy = e.clientY - this._center.y;
    const len = Math.hypot(dx, dy);
    const r = this._radius;
    if (len > r) { dx = (dx / len) * r; dy = (dy / len) * r; }
    this.x = clamp(dx / r, -1, 1);
    this.y = clamp(dy / r, -1, 1);
    this.knob.style.transform = `translate(calc(-50% + ${dx.toFixed(1)}px), calc(-50% + ${dy.toFixed(1)}px))`;
  }
}

export class InputManager {
  constructor({ canvas, root = document, onAction } = {}) {
    this.canvas = canvas;
    this.onAction = onAction ?? (() => {});
    this.keys = new Set();
    this.mouseStick = { x: 0, y: 0 };
    this.mouseActive = false;
    this.pointerLocked = false;
    this.sensitivity = 0.0022;
    this.invertY = false;
    this.touchMode = false;
    this.state = {
      pitch: 0, yaw: 0, roll: 0,
      throttleDelta: 0, throttleAbs: null,
      boost: false, brake: false, warp: false, align: false,
    };
    this._dragging = false;
    this._buttons = { boost: false, warp: false, brake: false, align: false };

    /* ---------------- 键盘 ---------------- */
    const keyDown = (e) => {
      if (e.repeat) {
        e.preventDefault();
        return;
      }
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      this.keys.add(k);
      switch (k) {
        case 'c': this.onAction('camera'); break;
        case 't': this.onAction('target'); break;
        case 'h': this.onAction('hud'); break;
        case 'r': this.onAction('respawn'); break;
        case 'm': this.togglePointerLock(); break;
        case 'x': this.mouseStick.x = 0; this.mouseStick.y = 0; break;
        case 'p': case 'Escape': this.onAction('pause'); break;
        case 'q': this.onAction('quality'); break;
        default: break;
      }
      if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();
    };
    const keyUp = (e) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      this.keys.delete(k);
    };
    root.addEventListener('keydown', keyDown);
    root.addEventListener('keyup', keyUp);
    window.addEventListener('blur', () => this.keys.clear());

    /* ---------------- 鼠标 ---------------- */
    if (canvas) {
      canvas.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'touch') { this.touchMode = true; return; }
        if (e.button !== 0) return;
        this._dragging = true;
        this.mouseActive = true;
        canvas.setPointerCapture?.(e.pointerId);
      });
      canvas.addEventListener('pointerup', (e) => {
        if (e.pointerType === 'touch') return;
        this._dragging = false;
      });
      canvas.addEventListener('pointerleave', () => { this._dragging = false; });
      canvas.addEventListener('pointermove', (e) => {
        if (e.pointerType === 'touch') return;
        if (this.pointerLocked) {
          this.mouseStick.x = clamp(this.mouseStick.x + e.movementX * this.sensitivity, -1, 1);
          this.mouseStick.y = clamp(this.mouseStick.y + e.movementY * this.sensitivity, -1, 1);
          this.mouseActive = true;
        } else if (this._dragging) {
          this.mouseStick.x = clamp(this.mouseStick.x + e.movementX * this.sensitivity * 1.5, -1, 1);
          this.mouseStick.y = clamp(this.mouseStick.y + e.movementY * this.sensitivity * 1.5, -1, 1);
          this.mouseActive = true;
        }
      });
      canvas.addEventListener('contextmenu', (e) => e.preventDefault());
      document.addEventListener('pointerlockchange', () => {
        this.pointerLocked = document.pointerLockElement === canvas;
        if (!this.pointerLocked) { this.mouseStick.x = 0; this.mouseStick.y = 0; }
      });
      canvas.addEventListener('wheel', (e) => {
        this.onAction('throttleWheel', -Math.sign(e.deltaY) * 0.08);
        e.preventDefault();
      }, { passive: false });
    }

    window.addEventListener('touchstart', () => { this.touchMode = true; }, { passive: true, once: true });
  }

  togglePointerLock() {
    if (!this.canvas) return;
    if (this.pointerLocked) document.exitPointerLock?.();
    else this.canvas.requestPointerLock?.();
  }

  /** 绑定触屏 UI（index.html 中的元素） */
  bindTouchUI({ leftBase, leftKnob, rightBase, rightKnob, buttons = {} }) {
    if (leftBase && leftKnob) {
      this.stickL = new Joystick(leftBase, leftKnob, { onStart: () => { this.touchMode = true; } });
    }
    if (rightBase && rightKnob) {
      this.stickR = new Joystick(rightBase, rightKnob, { onStart: () => { this.touchMode = true; } });
    }
    const hold = (el, name) => {
      if (!el) return;
      const on = (e) => {
        this._buttons[name] = true; el.classList.add('on');
        this.touchMode = true; e.preventDefault();
      };
      const off = (e) => { this._buttons[name] = false; el.classList.remove('on'); };
      el.addEventListener('pointerdown', on, { passive: false });
      el.addEventListener('pointerup', off);
      el.addEventListener('pointercancel', off);
      el.addEventListener('pointerleave', off);
    };
    hold(buttons.boost, 'boost');
    hold(buttons.warp, 'warp');
    hold(buttons.brake, 'brake');
    hold(buttons.align, 'align');
    const tap = (el, action) => {
      if (!el) return;
      el.addEventListener('pointerdown', (e) => {
        this.touchMode = true;
        this.onAction(action);
        el.classList.add('on');
        e.preventDefault();
      }, { passive: false });
      el.addEventListener('pointerup', () => el.classList.remove('on'));
      el.addEventListener('pointercancel', () => el.classList.remove('on'));
    };
    tap(buttons.camera, 'camera');
    tap(buttons.target, 'target');
    tap(buttons.help, 'pause');
  }

  key(...names) {
    for (const n of names) if (this.keys.has(n)) return true;
    return false;
  }

  /** 每帧汇总输入 */
  sample(dt) {
    const s = this.state;
    let pitch = 0, yaw = 0, roll = 0, throttleDelta = 0;

    // 键盘
    if (this.key('ArrowUp', 'i')) pitch += 1;
    if (this.key('ArrowDown', 'k')) pitch -= 1;
    if (this.key('ArrowLeft', 'j')) yaw += 1;
    if (this.key('ArrowRight', 'l')) yaw -= 1;
    if (this.key('a')) roll += 1;
    if (this.key('d')) roll -= 1;
    if (this.key('w')) throttleDelta += 1;
    if (this.key('s')) throttleDelta -= 1;

    // 鼠标虚拟杆（拖拽或指针锁定）
    if (this.mouseActive) {
      const my = this.invertY ? this.mouseStick.y : -this.mouseStick.y;
      pitch += my;
      yaw += -this.mouseStick.x;
      if (!this.pointerLocked && !this._dragging) {
        // 松开后回中
        this.mouseStick.x *= Math.max(0, 1 - dt * 6);
        this.mouseStick.y *= Math.max(0, 1 - dt * 6);
        if (Math.abs(this.mouseStick.x) < 0.002 && Math.abs(this.mouseStick.y) < 0.002) {
          this.mouseActive = false;
        }
      }
    }

    // 触屏摇杆
    if (this.stickL?.active) {
      pitch += -this.stickL.y;
      yaw += -this.stickL.x;
    }
    if (this.stickR?.active) {
      throttleDelta += -this.stickR.y;
      roll += -this.stickR.x;
    }

    // 手柄
    let padBoost = false, padBrake = false, padWarp = false;
    const pads = navigator.getGamepads?.() ?? [];
    for (const p of pads) {
      if (!p) continue;
      const dz = (v) => (Math.abs(v) < 0.14 ? 0 : v);
      pitch += -dz(p.axes[1] ?? 0);
      yaw += -dz(p.axes[0] ?? 0);
      roll += -dz(p.axes[2] ?? 0);
      throttleDelta += -dz(p.axes[3] ?? 0);
      padBoost = !!p.buttons[7]?.pressed;
      padBrake = !!p.buttons[6]?.pressed;
      padWarp = !!p.buttons[0]?.pressed;
      break;
    }

    s.pitch = clamp(pitch, -1, 1);
    s.yaw = clamp(yaw, -1, 1);
    s.roll = clamp(roll, -1, 1);
    s.throttleDelta = clamp(throttleDelta, -1, 1);
    s.boost = this.key('Shift') || this._buttons.boost || padBoost;
    s.brake = this.key(' ') || this._buttons.brake || padBrake;
    s.warp = this.key('f') || this._buttons.warp || padWarp;
    s.align = this.key('g') || this._buttons.align;
    return s;
  }
}
