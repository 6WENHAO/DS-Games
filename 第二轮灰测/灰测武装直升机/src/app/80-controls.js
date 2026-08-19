/* ============================================================================
 *  80 · 自研轨道控制器（阻尼 / 平移 / 触屏 / 镜头飞行）
 * ==========================================================================*/

class Orbit {
  constructor(camera, dom) {
    this.cam = camera; this.dom = dom;
    this.target = new THREE.Vector3(0.35, 1.95, 0);
    this.tTarget = this.target.clone();
    this.theta = 0.82; this.phi = 1.19; this.dist = 18.6;
    this.tTheta = this.theta; this.tPhi = this.phi; this.tDist = this.dist;
    this.minDist = 2.2; this.maxDist = 120;
    this.minPhi = 0.08; this.maxPhi = 1.545;
    this.damp = 0.12;
    this.autoRotate = false; this.autoSpeed = 0.055;
    this.enabled = true;
    this.fly = null;
    this.userActive = false;
    this.pointers = new Map();
    this.pinch = 0;
    const el = dom;
    el.style.touchAction = 'none';
    el.addEventListener('pointerdown', e => this._down(e));
    el.addEventListener('pointermove', e => this._move(e));
    el.addEventListener('pointerup', e => this._up(e));
    el.addEventListener('pointercancel', e => this._up(e));
    el.addEventListener('pointerleave', e => this._up(e));
    el.addEventListener('wheel', e => this._wheel(e), { passive: false });
    el.addEventListener('contextmenu', e => e.preventDefault());
    el.addEventListener('dblclick', () => { this.tDist = clamp(this.tDist * 0.55, this.minDist, this.maxDist); });
    this.update(0);
  }
  _down(e) {
    if (!this.enabled) return;
    this.dom.setPointerCapture?.(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, button: e.button, shift: e.shiftKey });
    this.fly = null; this.userActive = true;
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      this.pinch = Math.hypot(a.x - b.x, a.y - b.y);
    }
  }
  _move(e) {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (this.pointers.size >= 2) {
      const [a, b] = [...this.pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (this.pinch > 0) this.tDist = clamp(this.tDist * (this.pinch / Math.max(1, d)), this.minDist, this.maxDist);
      this.pinch = d;
      this._pan(dx * 0.5, dy * 0.5);
      return;
    }
    const pan = p.button === 2 || p.button === 1 || p.shift;
    if (pan) this._pan(dx, dy);
    else {
      this.tTheta -= dx * 0.0052;
      this.tPhi = clamp(this.tPhi - dy * 0.0052, this.minPhi, this.maxPhi);
    }
  }
  _up(e) {
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.pinch = 0;
  }
  _wheel(e) {
    if (!this.enabled) return;
    e.preventDefault();
    this.fly = null; this.userActive = true;
    const k = Math.exp(clamp(e.deltaY, -120, 120) * 0.0011);
    this.tDist = clamp(this.tDist * k, this.minDist, this.maxDist);
  }
  _pan(dx, dy) {
    const s = this.dist * 0.0016;
    const right = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), fwd = new THREE.Vector3();
    this.cam.getWorldDirection(fwd);
    right.crossVectors(fwd, up).normalize();
    const camUp = new THREE.Vector3().crossVectors(right, fwd).normalize();
    this.tTarget.addScaledVector(right, -dx * s).addScaledVector(camUp, dy * s);
    this.tTarget.y = clamp(this.tTarget.y, 0.1, 12);
  }
  flyTo(p, dur = 1.5) {
    const norm = a => {
      let t = a;
      while (t - this.theta > PI) t -= TAU;
      while (t - this.theta < -PI) t += TAU;
      return t;
    };
    this.fly = {
      t: 0, dur,
      from: { theta: this.theta, phi: this.phi, dist: this.dist, target: this.target.clone() },
      to: {
        theta: norm(p.theta ?? this.theta), phi: p.phi ?? this.phi, dist: p.dist ?? this.dist,
        target: p.target ? new THREE.Vector3(...p.target) : this.target.clone(),
      },
    };
    this.userActive = false;
  }
  update(dt) {
    if (this.fly) {
      const f = this.fly;
      f.t = Math.min(1, f.t + dt / f.dur);
      const k = easeInOut(f.t);
      this.tTheta = this.theta = lerp(f.from.theta, f.to.theta, k);
      this.tPhi = this.phi = lerp(f.from.phi, f.to.phi, k);
      this.tDist = this.dist = lerp(f.from.dist, f.to.dist, k);
      this.target.lerpVectors(f.from.target, f.to.target, k);
      this.tTarget.copy(this.target);
      if (f.t >= 1) this.fly = null;
    } else {
      if (this.autoRotate && this.pointers.size === 0) this.tTheta += this.autoSpeed * dt;
      const k = 1 - Math.pow(1 - this.damp, dt * 60);
      this.theta = lerp(this.theta, this.tTheta, k);
      this.phi = lerp(this.phi, this.tPhi, k);
      this.dist = lerp(this.dist, this.tDist, k);
      this.target.lerp(this.tTarget, k);
    }
    const sp = Math.sin(this.phi), cp = Math.cos(this.phi);
    this.cam.position.set(
      this.target.x + this.dist * sp * Math.cos(this.theta),
      this.target.y + this.dist * cp,
      this.target.z + this.dist * sp * Math.sin(this.theta));
    // 防止穿地
    if (this.cam.position.y < 0.35) this.cam.position.y = 0.35;
    this.cam.lookAt(this.target);
  }
}

/* 镜头预设 */
const VIEWS = {
  hero: { label: '英雄机位', theta: 0.82, phi: 1.19, dist: 18.6, target: [0.35, 1.95, 0] },
  side: { label: '正侧视', theta: PI / 2, phi: 1.492, dist: 21.5, target: [-0.2, 2.05, 0] },
  front: { label: '正前视', theta: 0.02, phi: 1.45, dist: 18.5, target: [1.5, 1.95, 0] },
  top: { label: '俯视', theta: 0.55, phi: 0.16, dist: 22.5, target: [0.2, 2.0, 0] },
  rear: { label: '尾后视', theta: PI * 0.94, phi: 1.30, dist: 18.0, target: [-2.6, 2.3, 0] },
  cockpit: { label: '座舱', theta: 0.62, phi: 1.16, dist: 4.6, target: [4.35, 2.35, 0] },
  gun: { label: 'M230 机炮', theta: 0.55, phi: 1.42, dist: 3.4, target: [4.0, 0.95, 0] },
  hub: { label: '桨毂 / 龙弓', theta: 0.85, phi: 1.02, dist: 4.6, target: [1.15, 3.60, 0] },
  tail: { label: 'X 型尾桨', theta: PI * 0.78, phi: 1.20, dist: 4.2, target: [-7.1, 2.85, -0.3] },
  sensor: { label: 'TADS 转塔', theta: 0.30, phi: 1.36, dist: 2.9, target: [6.15, 1.25, 0] },
  arms: { label: '武器挂载', theta: 1.15, phi: 1.34, dist: 5.4, target: [1.4, 1.25, 1.9] },
  gear: { label: '起落架', theta: 1.05, phi: 1.44, dist: 3.6, target: [2.5, 0.55, 1.05] },
};
