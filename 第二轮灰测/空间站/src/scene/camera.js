/**
 * scene/camera.js —— 轨道相机 + 影院巡游
 *
 * · 球坐标轨道控制（拖拽旋转 / 滚轮缩放 / 右键或 Shift 平移 / 双指捏合）
 * · 全部参数走「目标值 + 帧率无关指数阻尼」，任何交互都有顺滑的跟随感
 * · 影院模式沿预设航点巡游，自动缓入缓出并在结束后循环
 * · 空闲一段时间后自动缓慢环绕，适合作为展示页
 */

import { mat4, vec3, clamp, damp, dampAngle, shortAngle, easeInOutSine, DEG } from '../core/math.js';

export class OrbitCamera {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.target = vec3.create(0, 0, 0);
    this.desiredTarget = vec3.create(0, 0, 0);

    this.azimuth = opts.azimuth ?? 0.7;
    this.elevation = opts.elevation ?? 0.28;
    this.distance = opts.distance ?? 420;
    this.desiredAzimuth = this.azimuth;
    this.desiredElevation = this.elevation;
    this.desiredDistance = this.distance;

    this.fovY = (opts.fov ?? 42) * DEG;
    this.desiredFov = this.fovY;
    this.near = 1.2;
    this.far = 40000;

    this.minDistance = 26;
    this.maxDistance = 1600;
    this.minElevation = -1.45;
    this.maxElevation = 1.45;

    this.autoRotate = true;
    this.autoRotateSpeed = 0.035;
    this.idleDelay = 4.5;
    this._idle = 0;

    this.enabled = true;
    this.view = mat4.create();
    this.proj = mat4.create();
    this.viewProj = mat4.create();
    this.position = vec3.create();
    this.aspect = 1;

    /** 影院巡游状态 */
    this.tour = null;

    this._drag = null;
    this._pointers = new Map();
    this._pinch = 0;
    this._bind();
  }

  /* ───────────── 输入 ───────────── */

  _bind() {
    const c = this.canvas;
    const opts = { passive: false };
    c.addEventListener('pointerdown', (e) => {
      if (!this.enabled) return;
      c.setPointerCapture(e.pointerId);
      this._pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this._pointers.size === 1) {
        this._drag = {
          id: e.pointerId, x: e.clientX, y: e.clientY,
          pan: e.button === 2 || e.button === 1 || e.shiftKey,
          moved: 0,
        };
      } else if (this._pointers.size === 2) {
        this._pinch = this._pointerDistance();
      }
      this.stopTour();
      this._idle = 0;
    });
    c.addEventListener('pointermove', (e) => {
      const rec = this._pointers.get(e.pointerId);
      if (rec) { rec.x = e.clientX; rec.y = e.clientY; }
      if (!this._drag) return;
      if (this._pointers.size >= 2) {
        const d = this._pointerDistance();
        if (this._pinch > 0 && d > 0) {
          this.desiredDistance = clamp(this.desiredDistance * (this._pinch / d), this.minDistance, this.maxDistance);
        }
        this._pinch = d;
        return;
      }
      if (e.pointerId !== this._drag.id) return;
      const dx = e.clientX - this._drag.x;
      const dy = e.clientY - this._drag.y;
      this._drag.x = e.clientX; this._drag.y = e.clientY;
      this._drag.moved += Math.abs(dx) + Math.abs(dy);
      this._idle = 0;
      if (this._drag.pan) this._pan(dx, dy);
      else {
        this.desiredAzimuth -= dx * 0.0055;
        this.desiredElevation = clamp(this.desiredElevation + dy * 0.0048, this.minElevation, this.maxElevation);
      }
    });
    const end = (e) => {
      this._pointers.delete(e.pointerId);
      if (this._drag && e.pointerId === this._drag.id) {
        this.lastDragDistance = this._drag.moved;
        this._drag = null;
      }
      if (this._pointers.size < 2) this._pinch = 0;
    };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
    c.addEventListener('lostpointercapture', end);
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    c.addEventListener('wheel', (e) => {
      if (!this.enabled) return;
      e.preventDefault();
      const k = Math.exp(clamp(e.deltaY, -180, 180) * 0.0016);
      this.desiredDistance = clamp(this.desiredDistance * k, this.minDistance, this.maxDistance);
      this.stopTour();
      this._idle = 0;
    }, opts);
  }

  _pointerDistance() {
    const p = [...this._pointers.values()];
    if (p.length < 2) return 0;
    return Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
  }

  /** 屏幕平移：沿相机右向量与上向量移动注视点 */
  _pan(dx, dy) {
    const s = this.distance * Math.tan(this.fovY / 2) * 2 / this.canvas.clientHeight;
    const ca = Math.cos(this.azimuth), sa = Math.sin(this.azimuth);
    const ce = Math.cos(this.elevation), se = Math.sin(this.elevation);
    // 右向量与上向量（世界空间）
    const rx = ca, ry = 0, rz = -sa;
    const ux = -sa * se, uy = ce, uz = -ca * se;
    this.desiredTarget[0] += (-dx * rx + dy * ux) * s;
    this.desiredTarget[1] += (-dx * ry + dy * uy) * s;
    this.desiredTarget[2] += (-dx * rz + dy * uz) * s;
  }

  /* ───────────── 聚焦与巡游 ───────────── */

  /**
   * 平滑聚焦到某个位置。
   * @param {number[]} center @param {number} distance
   * @param {{azimuth?:number, elevation?:number, fov?:number}} [view]
   */
  focus(center, distance, view = {}) {
    vec3.copy(this.desiredTarget, center);
    this.desiredDistance = clamp(distance, this.minDistance, this.maxDistance);
    if (view.azimuth !== undefined) this.desiredAzimuth = this.azimuth + shortAngle(this.azimuth, view.azimuth);
    if (view.elevation !== undefined) this.desiredElevation = clamp(view.elevation, this.minElevation, this.maxElevation);
    if (view.fov !== undefined) this.desiredFov = view.fov * DEG;
  }

  /** @param {Array<object>} waypoints 每项 {center, distance, azimuth, elevation, fov, hold, label} */
  startTour(waypoints) {
    if (!waypoints || !waypoints.length) return;
    this.tour = { list: waypoints, i: 0, t: 0, from: this._snapshot() };
    this.autoRotate = false;
  }

  stopTour() {
    if (this.tour) this.tour = null;
  }

  get touring() { return !!this.tour; }

  _snapshot() {
    return {
      center: [this.target[0], this.target[1], this.target[2]],
      distance: this.distance, azimuth: this.azimuth, elevation: this.elevation, fov: this.fovY,
    };
  }

  /* ───────────── 每帧更新 ───────────── */

  update(dt, aspect) {
    this.aspect = aspect;

    if (this.tour) {
      const wp = this.tour.list[this.tour.i];
      const dur = wp.duration ?? 5.5;
      this.tour.t += dt;
      const k = easeInOutSine(clamp(this.tour.t / dur, 0, 1));
      const a = this.tour.from;
      vec3.lerp(this.desiredTarget, a.center, wp.center, k);
      this.desiredDistance = a.distance + (wp.distance - a.distance) * k;
      this.desiredAzimuth = a.azimuth + shortAngle(a.azimuth, wp.azimuth) * k;
      this.desiredElevation = a.elevation + (wp.elevation - a.elevation) * k;
      this.desiredFov = a.fov + ((wp.fov ?? 42) * DEG - a.fov) * k;
      if (this.tour.t >= dur + (wp.hold ?? 0)) {
        this.tour.i = (this.tour.i + 1) % this.tour.list.length;
        this.tour.t = 0;
        this.tour.from = this._snapshot();
      }
    } else {
      this._idle += dt;
      if (this.autoRotate && this._idle > this.idleDelay && !this._drag) {
        this.desiredAzimuth += this.autoRotateSpeed * dt;
      }
    }

    const rate = this.tour ? 7 : 5.5;
    this.azimuth = dampAngle(this.azimuth, this.desiredAzimuth, rate, dt);
    this.elevation = damp(this.elevation, this.desiredElevation, rate, dt);
    this.distance = damp(this.distance, this.desiredDistance, rate, dt);
    this.fovY = damp(this.fovY, this.desiredFov, rate, dt);
    vec3.lerp(this.target, this.target, this.desiredTarget, 1 - Math.exp(-rate * dt));

    const ce = Math.cos(this.elevation), se = Math.sin(this.elevation);
    this.position[0] = this.target[0] + this.distance * ce * Math.sin(this.azimuth);
    this.position[1] = this.target[1] + this.distance * se;
    this.position[2] = this.target[2] + this.distance * ce * Math.cos(this.azimuth);

    const up = Math.abs(this.elevation) > 1.4 ? [0, 0, Math.sign(-se) || 1] : [0, 1, 0];
    mat4.lookAt(this.view, this.position, this.target, up);
    this.near = Math.max(0.6, this.distance * 0.008);
    this.far = 42000;
    mat4.perspective(this.proj, this.fovY, aspect, this.near, this.far);
    mat4.multiply(this.viewProj, this.proj, this.view);
  }
}
