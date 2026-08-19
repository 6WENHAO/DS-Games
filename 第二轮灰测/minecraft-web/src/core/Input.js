/* =====================================================================
 * Input — 键鼠 / 指针锁定 / 滚轮 / 触摸 统一输入层
 *  - isDown(code)      当前是否按下
 *  - pressed(code)     本帧是否刚按下（endFrame 后清空）
 *  - released(code)    本帧是否刚松开
 *  - mouse.dx/dy       本帧鼠标位移（指针锁定下的原始 movement）
 *  - wheel             本帧滚轮增量（归一化为 ±1 档）
 * ===================================================================== */
import settings from './Settings.js';
import { bus } from './EventBus.js';

export const KEYS = {
  FORWARD: ['KeyW', 'ArrowUp'],
  BACK: ['KeyS', 'ArrowDown'],
  LEFT: ['KeyA', 'ArrowLeft'],
  RIGHT: ['KeyD', 'ArrowRight'],
  JUMP: ['Space'],
  SNEAK: ['ShiftLeft', 'ShiftRight'],
  SPRINT: ['ControlLeft', 'ControlRight'],
  INVENTORY: ['KeyE'],
  DROP: ['KeyQ'],
  CHAT: ['KeyT'],
  COMMAND: ['Slash'],
  PERSPECTIVE: ['KeyF'],
  DEBUG: ['F3'],
  FULLSCREEN: ['F11'],
  ZOOM: ['KeyC'],
  PICK: ['KeyM'],
};

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.down = new Set();
    this.justDown = new Set();
    this.justUp = new Set();
    this.mouse = { dx: 0, dy: 0, x: 0, y: 0, left: false, right: false, middle: false };
    this.mouseJust = { left: false, right: false, middle: false };
    this.mouseJustUp = { left: false, right: false, middle: false };
    this.wheel = 0;
    this.locked = false;
    this.enabled = true;      // 打开菜单/聊天时置 false（仅屏蔽游戏按键）
    this._wantLock = false;   // 上次 requestLock 的意图（供锁定失败重试用）
    this._lockRetry = null;
    this.textMode = false;    // 聊天输入中
    this.touch = { active: false, moveX: 0, moveY: 0, jump: false, look: { dx: 0, dy: 0 } };
    this._handlers = [];
    this._attach();
  }

  _on(target, type, fn, opts) {
    target.addEventListener(type, fn, opts);
    this._handlers.push([target, type, fn, opts]);
  }

  _attach() {
    const c = this.canvas;

    // ---------- 键盘 ----------
    this._on(window, 'keydown', (e) => {
      // 允许浏览器快捷键（Ctrl/Cmd + 字母）通过
      if (e.ctrlKey && e.code !== 'ControlLeft' && e.code !== 'ControlRight' && e.code !== 'KeyW') {
        if (['KeyR', 'KeyT', 'KeyI', 'KeyJ', 'KeyC', 'KeyV', 'KeyA'].includes(e.code)) return;
      }
      if (this.textMode) {
        // 文本模式下只关心 Esc / Enter，由 UI 层处理
        return;
      }
      if (e.code === 'F11') return;               // 交给浏览器全屏
      if (e.code === 'F5' && !e.shiftKey) e.preventDefault();
      if (e.code === 'F3') e.preventDefault();
      if (e.code === 'Tab') e.preventDefault();
      if (e.code === 'Space') e.preventDefault();
      if (e.repeat) return;
      this.down.add(e.code);
      this.justDown.add(e.code);
      bus.emit('input:keydown', e.code, e);
    });

    this._on(window, 'keyup', (e) => {
      this.down.delete(e.code);
      this.justUp.add(e.code);
      bus.emit('input:keyup', e.code, e);
    });

    // 失焦时释放所有按键，避免"卡键"
    this._on(window, 'blur', () => this.releaseAll());
    this._on(document, 'visibilitychange', () => { if (document.hidden) this.releaseAll(); });

    // ---------- 鼠标 ----------
    this._on(c, 'mousedown', (e) => {
      if (!this.locked) return;             // 未锁定时由 UI 处理点击
      e.preventDefault();
      this._setButton(e.button, true);
    });
    this._on(window, 'mouseup', (e) => this._setButton(e.button, false));
    this._on(c, 'contextmenu', (e) => e.preventDefault());

    this._on(document, 'mousemove', (e) => {
      if (this.locked) {
        const s = settings.sensitivityScalar;
        this.mouse.dx += (e.movementX || 0) * s;
        this.mouse.dy += (e.movementY || 0) * s * (settings.get('invertY') ? -1 : 1);
      } else {
        this.mouse.x = e.clientX; this.mouse.y = e.clientY;
      }
    });

    this._on(window, 'wheel', (e) => {
      if (!this.locked) return;
      e.preventDefault();
      this.wheel += Math.sign(e.deltaY);
    }, { passive: false });

    // ---------- 指针锁定 ----------
    this._on(document, 'pointerlockchange', () => {
      const wasLocked = this.locked;
      this.locked = document.pointerLockElement === c;
      document.body.classList.toggle('playing', this.locked);
      if (!this.locked && wasLocked) {
        this.releaseAll();
        bus.emit('input:unlock');
      } else if (this.locked) {
        bus.emit('input:lock');
      }
    });
    this._on(document, 'pointerlockerror', () => {
      console.warn('[Input] 指针锁定失败');
      // Chrome 在短时间内重复请求会被节流（约 1.25s 窗口），延迟后重试一次
      if (this._lockRetry) clearTimeout(this._lockRetry);
      this._lockRetry = setTimeout(() => {
        this._lockRetry = null;
        if (!this.locked && this._wantLock) this.requestLock();
      }, 1400);
      bus.emit('input:unlock');
    });
  }

  _setButton(button, state) {
    const name = button === 0 ? 'left' : button === 2 ? 'right' : button === 1 ? 'middle' : null;
    if (!name) return;
    if (state && !this.mouse[name]) this.mouseJust[name] = true;
    if (!state && this.mouse[name]) this.mouseJustUp[name] = true;
    this.mouse[name] = state;
  }

  requestLock() {
    if (this.locked) return;
    this._wantLock = true;
    // 注意：不要使用 { unadjustedMovement: true }（原始输入模式）。
    // Windows 上该模式存在光标被钳制在屏幕边缘、移动事件停止的已知问题，
    // 表现为"视角拖到一定程度卡住"。普通锁定模式会持续把光标拉回中心，可无限旋转。
    try { this.canvas.requestPointerLock(); } catch (_) {}
  }

  exitLock() {
    this._wantLock = false;
    if (document.pointerLockElement) document.exitPointerLock();
  }

  releaseAll() {
    for (const code of this.down) this.justUp.add(code);
    this.down.clear();
    this.mouse.left = this.mouse.right = this.mouse.middle = false;
  }

  // ---------- 查询 ----------
  isDown(code) { return this.enabled && this.down.has(code); }
  pressed(code) { return this.enabled && this.justDown.has(code); }
  released(code) { return this.justUp.has(code); }

  /** 绑定组查询：any(KEYS.FORWARD) */
  any(codes) {
    if (!this.enabled) return false;
    for (const c of codes) if (this.down.has(c)) return true;
    return false;
  }
  anyPressed(codes) {
    if (!this.enabled) return false;
    for (const c of codes) if (this.justDown.has(c)) return true;
    return false;
  }

  /** 取出并清零鼠标位移 */
  consumeMouseDelta() {
    const d = { dx: this.mouse.dx, dy: this.mouse.dy };
    this.mouse.dx = 0; this.mouse.dy = 0;
    return d;
  }

  consumeWheel() { const w = this.wheel; this.wheel = 0; return w; }

  /** 每帧末调用 */
  endFrame() {
    this.justDown.clear();
    this.justUp.clear();
    this.mouseJust.left = this.mouseJust.right = this.mouseJust.middle = false;
    this.mouseJustUp.left = this.mouseJustUp.right = this.mouseJustUp.middle = false;
    this.mouse.dx = 0; this.mouse.dy = 0;
    this.wheel = 0;
  }

  destroy() {
    for (const [t, ty, fn, o] of this._handlers) t.removeEventListener(ty, fn, o);
    this._handlers.length = 0;
  }
}
