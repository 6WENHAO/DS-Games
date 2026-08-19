/* =============================================================
   controls.js — orbit camera with inertia.

   Written locally rather than pulled from three's examples/ so the
   page stays a dependency-free set of classic scripts, and so the
   diorama can add its own touches: tilt limits that keep the island
   readable, framed presets, and a slow cinematic drift.
   ============================================================= */
(function (global) {
  'use strict';
  const T = global.THREE;
  const TOWN = global.TOWN;
  const U = TOWN.U;

  /**
   * new TOWN.Orbit(camera, domElement, opts)
   * opts: {target, minDist, maxDist, minPolar, maxPolar, damping}
   */
  TOWN.Orbit = function (camera, dom, opts) {
    opts = opts || {};
    const self = this;

    this.camera = camera;
    this.dom = dom;
    this.target = opts.target ? opts.target.clone() : new T.Vector3(0, 5, 0);
    this.minDist = opts.minDist || 26;
    this.maxDist = opts.maxDist || 235;
    this.minPolar = opts.minPolar !== undefined ? opts.minPolar : 0.14;
    this.maxPolar = opts.maxPolar !== undefined ? opts.maxPolar : 1.46;
    this.damping = opts.damping || 0.12;
    this.enabled = true;
    this.autoRotate = false;
    this.autoRotateSpeed = 0.035;
    this.panLimit = opts.panLimit || 62;

    // spherical state (current + desired)
    const sph = { r: 118, theta: 0.86, phi: 0.92 };
    const want = { r: 118, theta: 0.86, phi: 0.92 };
    const wantTarget = this.target.clone();
    this.sph = sph;

    let dragging = 0;               // 0 none, 1 rotate, 2 pan
    let lastX = 0, lastY = 0;
    const pinch = { active: false, dist: 0 };
    let tween = null;

    /* ---------- helpers ---------- */
    this.setFromCamera = function () {
      const off = camera.position.clone().sub(self.target);
      sph.r = want.r = off.length();
      sph.theta = want.theta = Math.atan2(off.x, off.z);
      sph.phi = want.phi = Math.acos(U.clamp(off.y / sph.r, -1, 1));
    };

    this.set = function (r, theta, phi, target, ms) {
      const from = { r: sph.r, theta: sph.theta, phi: sph.phi, t: self.target.clone() };
      const to = {
        r: U.clamp(r === undefined ? sph.r : r, self.minDist, self.maxDist),
        theta: theta === undefined ? sph.theta : theta,
        phi: U.clamp(phi === undefined ? sph.phi : phi, self.minPolar, self.maxPolar),
        t: target ? target.clone() : self.target.clone(),
      };
      // take the short way round
      to.theta = from.theta + U.angleDelta(from.theta, to.theta);
      if (!ms) {
        want.r = sph.r = to.r; want.theta = sph.theta = to.theta; want.phi = sph.phi = to.phi;
        self.target.copy(to.t); wantTarget.copy(to.t);
        tween = null;
        return;
      }
      tween = { from, to, t: 0, ms };
    };

    /** frame(centre, radius) — pull back far enough to see a sphere */
    this.frame = function (centre, radius, ms) {
      const fov = camera.fov * U.DEG;
      const d = (radius / Math.sin(fov / 2)) * 1.02;
      self.set(d, want.theta, want.phi, centre, ms);
    };

    /* ---------- input ---------- */
    function onDown(e) {
      if (!self.enabled) return;
      dom.setPointerCapture && dom.setPointerCapture(e.pointerId);
      dragging = (e.button === 2 || e.shiftKey || e.button === 1) ? 2 : 1;
      lastX = e.clientX; lastY = e.clientY;
      tween = null;
      dom.style.cursor = dragging === 2 ? 'move' : 'grabbing';
    }
    function onMove(e) {
      if (!dragging || !self.enabled) return;
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      if (dragging === 1) {
        want.theta -= dx * 0.0052;
        want.phi = U.clamp(want.phi - dy * 0.0042, self.minPolar, self.maxPolar);
      } else {
        panBy(dx, dy);
      }
    }
    function onUp(e) {
      dragging = 0;
      dom.style.cursor = 'grab';
      dom.releasePointerCapture && e && e.pointerId !== undefined &&
        dom.hasPointerCapture && dom.hasPointerCapture(e.pointerId) &&
        dom.releasePointerCapture(e.pointerId);
    }
    function panBy(dx, dy) {
      const scale = want.r * 0.0016;
      const right = new T.Vector3(Math.cos(want.theta), 0, -Math.sin(want.theta));
      const fwd = new T.Vector3(Math.sin(want.theta), 0, Math.cos(want.theta));
      wantTarget.addScaledVector(right, -dx * scale);
      wantTarget.addScaledVector(fwd, -dy * scale * 0.85);
      const l = Math.hypot(wantTarget.x, wantTarget.z);
      if (l > self.panLimit) {
        wantTarget.x *= self.panLimit / l;
        wantTarget.z *= self.panLimit / l;
      }
      wantTarget.y = U.clamp(wantTarget.y, -2, 30);
    }
    function onWheel(e) {
      if (!self.enabled) return;
      e.preventDefault();
      const k = Math.exp(U.clamp(e.deltaY, -220, 220) * 0.0012);
      want.r = U.clamp(want.r * k, self.minDist, self.maxDist);
      tween = null;
    }
    function onTouchStart(e) {
      if (e.touches.length === 2) {
        pinch.active = true;
        pinch.dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY);
      }
    }
    function onTouchMove(e) {
      if (pinch.active && e.touches.length === 2) {
        e.preventDefault();
        const d = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY);
        if (pinch.dist > 0) {
          want.r = U.clamp(want.r * (pinch.dist / d), self.minDist, self.maxDist);
        }
        pinch.dist = d;
      }
    }
    function onTouchEnd() { pinch.active = false; }

    dom.style.cursor = 'grab';
    dom.addEventListener('pointerdown', onDown);
    global.addEventListener('pointermove', onMove);
    global.addEventListener('pointerup', onUp);
    dom.addEventListener('wheel', onWheel, { passive: false });
    dom.addEventListener('contextmenu', (e) => e.preventDefault());
    dom.addEventListener('touchstart', onTouchStart, { passive: true });
    dom.addEventListener('touchmove', onTouchMove, { passive: false });
    dom.addEventListener('touchend', onTouchEnd);

    this.dispose = function () {
      dom.removeEventListener('pointerdown', onDown);
      global.removeEventListener('pointermove', onMove);
      global.removeEventListener('pointerup', onUp);
      dom.removeEventListener('wheel', onWheel);
    };

    /* ---------- per-frame ---------- */
    const tmp = new T.Vector3();
    this.update = function (dt) {
      if (tween) {
        tween.t = Math.min(1, tween.t + (dt * 1000) / tween.ms);
        const e = tween.t < 0.5 ? 4 * tween.t * tween.t * tween.t
          : 1 - Math.pow(-2 * tween.t + 2, 3) / 2;      // easeInOutCubic
        want.r = U.lerp(tween.from.r, tween.to.r, e);
        want.theta = U.lerp(tween.from.theta, tween.to.theta, e);
        want.phi = U.lerp(tween.from.phi, tween.to.phi, e);
        wantTarget.lerpVectors(tween.from.t, tween.to.t, e);
        if (tween.t >= 1) tween = null;
      }
      if (self.autoRotate && !dragging && !tween) {
        want.theta += self.autoRotateSpeed * dt;
      }
      const k = 1 - Math.exp(-dt / Math.max(0.0001, self.damping));
      sph.r = U.lerp(sph.r, want.r, k);
      sph.theta = U.lerp(sph.theta, want.theta, k);
      sph.phi = U.lerp(sph.phi, want.phi, k);
      self.target.lerp(wantTarget, k);

      const sinPhi = Math.sin(sph.phi);
      tmp.set(sinPhi * Math.sin(sph.theta), Math.cos(sph.phi), sinPhi * Math.cos(sph.theta));
      camera.position.copy(self.target).addScaledVector(tmp, sph.r);
      camera.lookAt(self.target);
    };

    this.get = function () {
      return { r: sph.r, theta: sph.theta, phi: sph.phi, target: self.target.clone() };
    };
  };

  console.log('[TOWN] controls ready');
})(window);
