// Third-person follow camera in the spirit of Journey / Flower:
// it drifts behind the swarm, realigns itself when you travel, and when you stop it
// glides in close and opens the aperture so the meadow melts into bokeh.

import * as THREE from 'three';
import { terrainHeight } from './noise.js';
import { WORLD } from './config.js';

export class FollowCam {
  constructor(aspect = 16 / 9) {
    this.camera = new THREE.PerspectiveCamera(WORLD.fov, aspect, WORLD.near, WORLD.far);
    this.camera.position.set(0, 8, 14);

    this.yaw = Math.PI * 0.5;
    this.pitch = 0.20;
    this.dist = 10.5;
    this.distTarget = 10.5;
    this.zoomBias = 1;

    this.pos = new THREE.Vector3(0, 10, 14);
    this.lookAt = new THREE.Vector3();
    this.smoothTarget = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.fov = WORLD.fov;
    this.free = false;
    this.shakeT = 0;

    this.focus = 12;
    this.aperture = 0.6;
    this._v = new THREE.Vector3();
    this._t = new THREE.Vector3();
  }

  setAspect(a) {
    this.camera.aspect = a;
    this.camera.updateProjectionMatrix();
  }

  update(dt, input, petals, windVec) {
    const o = input.takeOrbit();
    this.yaw -= o.x * 0.0042;
    this.pitch = THREE.MathUtils.clamp(this.pitch + o.y * 0.0032, -0.42, 1.02);
    const z = input.takeZoom();
    if (z) this.zoomBias = THREE.MathUtils.clamp(this.zoomBias * (1 + z * 0.12), 0.32, 3.4);

    const idle = petals.idle;
    const speed = petals.speed;

    // auto-align behind the direction of travel once the player stops steering the view
    if (!this.free && input.lastDrag > 1.6 && speed > 1.2) {
      const want = Math.atan2(petals.heading.z, petals.heading.x) + Math.PI;
      let diff = ((want - this.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      this.yaw += diff * Math.min(1, dt * 0.9);
      // ease the pitch down a touch at speed for a sense of rush
      this.pitch += (0.16 - this.pitch) * Math.min(1, dt * 0.35);
    }

    // stopping => dolly in and narrow the lens
    const base = this.free ? 16 : THREE.MathUtils.lerp(11.2, 4.7, idle);
    this.distTarget = base * this.zoomBias + speed * 0.16;
    this.dist += (this.distTarget - this.dist) * Math.min(1, dt * 2.6);

    const targetFov = this.free ? 60 : THREE.MathUtils.lerp(WORLD.fov, 39, idle * 0.85);
    this.fov += (targetFov - this.fov) * Math.min(1, dt * 1.6);
    if (Math.abs(this.camera.fov - this.fov) > 0.01) {
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
    }

    // the swarm centre, smoothed
    this._t.copy(petals.centroid);
    this._t.y += 0.9 + idle * 0.35;
    this.smoothTarget.lerp(this._t, Math.min(1, dt * (2.4 + speed * 0.08)));

    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    this._v.set(Math.cos(this.yaw) * cp, sp, Math.sin(this.yaw) * cp);
    const desired = this._v.multiplyScalar(this.dist).add(this.smoothTarget);

    // critically damped follow
    const k = this.free ? 5.5 : 3.4 + idle * 1.4;
    this.pos.x += (desired.x - this.pos.x) * Math.min(1, dt * k);
    this.pos.y += (desired.y - this.pos.y) * Math.min(1, dt * k * 0.85);
    this.pos.z += (desired.z - this.pos.z) * Math.min(1, dt * k);

    // handheld drift: tiny, but it makes the frame feel photographed
    this.shakeT += dt;
    const gust = Math.min(1.4, Math.hypot(windVec.x, windVec.y) * 0.22);
    const sx = Math.sin(this.shakeT * 0.63) * 0.055 + Math.sin(this.shakeT * 1.71) * 0.022;
    const sy = Math.cos(this.shakeT * 0.51) * 0.045 + Math.sin(this.shakeT * 2.13) * 0.018;
    this.pos.x += sx * (0.6 + gust);
    this.pos.y += sy * (0.5 + gust * 0.6);

    // never clip through the meadow
    const gh = terrainHeight(this.pos.x, this.pos.z) + 1.9;
    if (this.pos.y < gh) this.pos.y += (gh - this.pos.y) * Math.min(1, dt * 9);

    this.camera.position.copy(this.pos);
    this.lookAt.lerp(this.smoothTarget, Math.min(1, dt * 4.5));
    this.camera.lookAt(this.lookAt);
    this.camera.updateMatrixWorld();

    // ---- autofocus on the swarm; aperture opens as we settle
    const dFocus = this.camera.position.distanceTo(petals.centroid);
    this.focus += (dFocus - this.focus) * Math.min(1, dt * 3.2);
    const wantAperture = THREE.MathUtils.lerp(0.45, 2.35, idle) * (1 / Math.max(0.55, this.zoomBias));
    this.aperture += (wantAperture - this.aperture) * Math.min(1, dt * 1.8);

    return this.camera;
  }
}
