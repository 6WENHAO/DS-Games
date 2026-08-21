/**
 * gfx/camera.js
 * ------------------------------------------------------------------
 * First/third-person camera: yaw/pitch orientation, projection matrix,
 * view-projection composition and a frustum for chunk culling.
 *
 * Angle convention matches Minecraft: yaw 0 looks toward -Z, positive
 * yaw turns right (clockwise seen from above), pitch is positive looking
 * down.
 */

import { mat4, vec3, Frustum, clamp, DEG2RAD } from '../core/math.js';

const PITCH_LIMIT = Math.PI / 2 - 0.0015;

export class Camera {
  constructor() {
    this.position = vec3.create(0, 70, 0);
    this.yaw = 0;
    this.pitch = 0;

    this.fov = 70;
    this.near = 0.05;
    this.far = 512;
    this.aspect = 16 / 9;

    this.projection = mat4.create();
    this.view = mat4.create();
    this.viewProjection = mat4.create();
    this.invViewProjection = mat4.create();
    this.frustum = new Frustum();

    this.forward = vec3.create(0, 0, -1);
    this.right = vec3.create(1, 0, 0);
    this.up = vec3.create(0, 1, 0);

    /** Extra FOV multiplier for sprinting / underwater. */
    this.fovModifier = 1;
    /** Roll applied for the sprint/hurt tilt effect, in radians. */
    this.roll = 0;
  }

  /** Applies a mouse delta in radians, clamping pitch like vanilla. */
  rotate(deltaYaw, deltaPitch) {
    this.yaw += deltaYaw;
    this.pitch = clamp(this.pitch + deltaPitch, -PITCH_LIMIT, PITCH_LIMIT);
    // Keep yaw bounded so float precision never degrades.
    if (this.yaw > Math.PI) this.yaw -= Math.PI * 2;
    else if (this.yaw < -Math.PI) this.yaw += Math.PI * 2;
  }

  setPosition(x, y, z) {
    vec3.set(this.position, x, y, z);
  }

  /** Recomputes every derived matrix. Call once per frame. */
  update(aspect, farOverride = null) {
    this.aspect = aspect;
    const far = farOverride ?? this.far;
    mat4.perspective(this.projection, this.fov * this.fovModifier * DEG2RAD, aspect, this.near, far);

    mat4.fromEulerView(this.view, this.position[0], this.position[1], this.position[2], this.yaw, this.pitch);
    if (this.roll !== 0) {
      const rolled = this._rolled ??= mat4.create();
      mat4.identity(rolled);
      mat4.rotateZ(rolled, rolled, this.roll);
      mat4.multiply(this.view, rolled, this.view);
    }

    mat4.multiply(this.viewProjection, this.projection, this.view);
    mat4.invert(this.invViewProjection, this.viewProjection);
    this.frustum.setFromMatrix(this.viewProjection);

    mat4.eulerForward(this.forward, this.yaw, this.pitch);
    mat4.eulerRight(this.right, this.yaw);
    vec3.cross(this.up, this.right, this.forward);
    vec3.normalize(this.up, this.up);
    return this;
  }

  /** True when any part of the world-space box may be visible. */
  boxVisible(minX, minY, minZ, maxX, maxY, maxZ) {
    return this.frustum.intersectsBox(minX, minY, minZ, maxX, maxY, maxZ);
  }

  /**
   * Horizontal facing as a compass string, for the debug overlay.
   * yaw 0 is north (-Z), and yaw increases clockwise: east, south, west.
   */
  facing() {
    const deg = ((this.yaw / DEG2RAD) % 360 + 360) % 360;
    if (deg >= 315 || deg < 45) return 'north';
    if (deg < 135) return 'east';
    if (deg < 225) return 'south';
    return 'west';
  }

  /** Yaw in Minecraft's own degrees (0 = south, increasing clockwise). */
  minecraftYaw() {
    return (((this.yaw / DEG2RAD) + 180) % 360 + 360) % 360 - 180;
  }
}
