import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { clamp, damp, angleDamp } from '../core/utils.js';

const C = CONFIG.camera;

export class ThirdPersonCamera {
  constructor(camera, world) {
    this.camera = camera;
    this.world = world;
    this.yaw = 0;            // camera azimuth around player: sits at +z side, looking down the road (-z)
    this.pitch = 0.24;
    this.distance = C.distance;
    this.currentDistance = C.distance;
    this.shakeOffset = new THREE.Vector3();
    this.lookTarget = new THREE.Vector3();
    this.smoothFocus = new THREE.Vector3();
    this.initialized = false;
  }

  applyInput(input) {
    this.yaw -= input.mouseDX * C.sensitivity;
    this.pitch = clamp(this.pitch + input.mouseDY * C.sensitivity, C.minPitch, C.maxPitch);
  }

  update(dt, player, lockTarget, trauma) {
    const focus = player.position.clone().add(new THREE.Vector3(0, C.height, 0));
    if (!this.initialized) {
      this.smoothFocus.copy(focus);
      this.initialized = true;
    }
    this.smoothFocus.x = damp(this.smoothFocus.x, focus.x, 12, dt);
    this.smoothFocus.y = damp(this.smoothFocus.y, focus.y, 8, dt);
    this.smoothFocus.z = damp(this.smoothFocus.z, focus.z, 12, dt);

    // lock-on steering
    if (lockTarget && lockTarget.alive) {
      const to = lockTarget.position.clone().sub(player.position);
      const targetYaw = Math.atan2(to.x, to.z) + Math.PI;
      this.yaw = angleDamp(this.yaw, targetYaw, 4.5, dt);
      const distK = clamp(to.length() / 18, 0, 1);
      this.pitch = damp(this.pitch, 0.2 + distK * 0.1, 3, dt);
    }

    const dir = new THREE.Vector3(
      Math.sin(this.yaw) * Math.cos(this.pitch),
      Math.sin(this.pitch),
      Math.cos(this.yaw) * Math.cos(this.pitch)
    );

    // camera collision: pull in if terrain or boundary blocks
    let dist = this.distance;
    const probes = 6;
    for (let i = 1; i <= probes; i++) {
      const t = (i / probes) * dist;
      const p = this.smoothFocus.clone().addScaledVector(dir, t);
      const ground = this.world.getHeight(p.x, p.z) + 0.42;
      if (p.y < ground) {
        dist = Math.max(1.2, t - 0.35);
        break;
      }
    }
    this.currentDistance = damp(this.currentDistance, dist, 9, dt);

    const pos = this.smoothFocus.clone().addScaledVector(dir, this.currentDistance);
    const minY = this.world.getHeight(pos.x, pos.z) + 0.38;
    if (pos.y < minY) pos.y = minY;

    // trauma shake
    const shakeAmt = trauma * trauma;
    if (shakeAmt > 0.001) {
      const t = performance.now() * 0.001;
      this.shakeOffset.set(
        (Math.sin(t * 67.3) + Math.sin(t * 41.7)) * 0.5,
        (Math.sin(t * 55.1) + Math.sin(t * 73.9)) * 0.5,
        0
      ).multiplyScalar(shakeAmt * 0.28);
    } else {
      this.shakeOffset.set(0, 0, 0);
    }

    this.camera.position.copy(pos).add(this.shakeOffset);

    const lookAt = lockTarget && lockTarget.alive
      ? this.smoothFocus.clone().lerp(lockTarget.position.clone().add(new THREE.Vector3(0, 1.6, 0)), 0.28)
      : this.smoothFocus;
    this.lookTarget.copy(lookAt);
    this.camera.lookAt(lookAt.clone().add(this.shakeOffset.clone().multiplyScalar(0.5)));
  }
}
