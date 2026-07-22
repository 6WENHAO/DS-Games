// ============================================================
//  player.js  -  first-person controller with CS/Source-style
//  movement (ground accel + friction, air-strafe, crouch, jump,
//  step-up AABB collision) and view-punch recoil.
// ============================================================
import * as THREE from "three";
import { PHYS, TEAM } from "./config.js";

export class Player {
  constructor(camera, map) {
    this.camera = camera;
    this.map = map;
    this.colliders = map.colliders;

    this.pos = new THREE.Vector3(0, 0, 38); // feet position
    this.vel = new THREE.Vector3();
    this.yaw = Math.PI;   // facing -z
    this.pitch = 0;

    this.recoilPitch = 0;
    this.recoilYaw = 0;

    this.onGround = false;
    this.crouching = false;
    this.crouchAmt = 0; // 0 stand .. 1 crouch

    this.height = PHYS.standHalfHeight * 2;
    this.eyeHeight = PHYS.eyeHeight;

    this.team = TEAM.T;
    this.health = 100;
    this.armor = 0;
    this.helmet = false;
    this.alive = true;

    this.maxSpeed = 6.05;      // set by current weapon
    this.wishWalk = false;

    this._bob = 0;
    this._prevY = 0;
  }

  reset(pos, team) {
    this.pos.copy(pos);
    this.vel.set(0, 0, 0);
    this.team = team;
    this.yaw = team === TEAM.T ? Math.PI : 0;
    this.pitch = 0;
    this.recoilPitch = this.recoilYaw = 0;
    this.health = 100;
    this.alive = true;
    this.crouching = false;
    this.crouchAmt = 0;
  }

  get eyePosition() {
    return new THREE.Vector3(
      this.pos.x,
      this.pos.y + this.eyeHeight - this.crouchAmt * (PHYS.eyeHeight - PHYS.crouchEyeHeight),
      this.pos.z
    );
  }

  getForward() {
    const p = this.pitch + this.recoilPitch;
    const y = this.yaw + this.recoilYaw;
    return new THREE.Vector3(
      -Math.sin(y) * Math.cos(p),
      Math.sin(p),
      -Math.cos(y) * Math.cos(p)
    );
  }

  addRecoil(pitchDelta, yawDelta) {
    this.recoilPitch += pitchDelta;
    this.recoilYaw += yawDelta;
  }

  applyLook(dx, dy, sens) {
    const s = sens * 0.00042;
    this.yaw -= dx * s;
    this.pitch -= dy * s;
    const lim = Math.PI / 2 - 0.02;
    this.pitch = Math.max(-lim, Math.min(lim, this.pitch));
  }

  update(dt, input, aimScale = 1) {
    if (!this.alive) return;

    // ----- look -----
    this.applyLook(input.mouse.dx, input.mouse.dy * (input.mouse.dy ? 1 : 1), input.sensitivity * aimScale);

    // recoil recovery (view punch returns toward zero)
    const rec = Math.exp(-9 * dt);
    this.recoilPitch *= rec;
    this.recoilYaw *= rec;
    if (Math.abs(this.recoilPitch) < 0.0001) this.recoilPitch = 0;
    if (Math.abs(this.recoilYaw) < 0.0001) this.recoilYaw = 0;

    // ----- crouch -----
    this.crouching = !!input.keys["ControlLeft"] || !!input.keys["ControlRight"] || !!input.keys["KeyC"];
    const targetCrouch = this.crouching ? 1 : 0;
    // don't uncrouch if blocked overhead
    if (targetCrouch === 0 && this.crouchAmt > 0 && this._ceilingBlocked()) {
      // stay crouched
    } else {
      this.crouchAmt += (targetCrouch - this.crouchAmt) * Math.min(1, dt * 12);
    }
    this.height = 2 * (PHYS.standHalfHeight - this.crouchAmt * (PHYS.standHalfHeight - PHYS.crouchHalfHeight));

    // ----- wish direction -----
    const f = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const r = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    let wx = 0, wz = 0;
    if (input.keys["KeyW"]) { wx += f.x; wz += f.z; }
    if (input.keys["KeyS"]) { wx -= f.x; wz -= f.z; }
    if (input.keys["KeyD"]) { wx += r.x; wz += r.z; }
    if (input.keys["KeyA"]) { wx -= r.x; wz -= r.z; }
    const wl = Math.hypot(wx, wz);
    if (wl > 0) { wx /= wl; wz /= wl; }

    this.wishWalk = !!input.keys["ShiftLeft"] || !!input.keys["ShiftRight"];
    let speed = this.maxSpeed;
    if (this.crouchAmt > 0.5) speed *= PHYS.crouchSpeedMul + (1 - PHYS.crouchSpeedMul) * (1 - this.crouchAmt);
    if (this.wishWalk) speed *= PHYS.walkSpeedMul;
    if (this.crouchAmt > 0.5) speed = this.maxSpeed * PHYS.crouchSpeedMul;
    else if (this.wishWalk) speed = this.maxSpeed * PHYS.walkSpeedMul;

    // ----- ground detection -----
    this.onGround = this._probeGround();

    if (this.onGround) {
      this._friction(dt, wl > 0);
      this._accelerate(wx, wz, speed, PHYS.accelerate, dt);
      // jump
      if (input.keys["Space"] && this._jumpReady !== false) {
        this.vel.y = PHYS.jumpSpeed;
        this.onGround = false;
        this._jumpReady = false;
      }
    } else {
      this._accelerate(wx, wz, Math.min(speed, PHYS.maxAirWishSpeed), PHYS.airAccelerate, dt);
    }
    if (!input.keys["Space"]) this._jumpReady = true;

    // gravity
    this.vel.y -= PHYS.gravity * dt;

    // ----- integrate -----
    this._moveHorizontal(this.vel.x * dt, this.vel.z * dt);
    this._moveVertical(this.vel.y * dt);

    // clamp to bounds
    const b = this.map.bounds;
    this.pos.x = Math.max(b.minX + 1, Math.min(b.maxX - 1, this.pos.x));
    this.pos.z = Math.max(b.minZ + 1, Math.min(b.maxZ - 1, this.pos.z));

    // view bob
    const hspeed = Math.hypot(this.vel.x, this.vel.z);
    if (this.onGround && hspeed > 0.5) this._bob += dt * hspeed * 1.4;

    this._updateCamera(hspeed);
  }

  _friction(dt, moving) {
    const speed = Math.hypot(this.vel.x, this.vel.z);
    if (speed < 0.01) { this.vel.x = 0; this.vel.z = 0; return; }
    const control = speed < PHYS.stopSpeed ? PHYS.stopSpeed : speed;
    let drop = control * PHYS.friction * dt;
    let newspeed = speed - drop;
    if (newspeed < 0) newspeed = 0;
    newspeed /= speed;
    this.vel.x *= newspeed;
    this.vel.z *= newspeed;
  }

  _accelerate(wx, wz, wishspeed, accel, dt) {
    if (wishspeed <= 0) return;
    const current = this.vel.x * wx + this.vel.z * wz;
    const add = wishspeed - current;
    if (add <= 0) return;
    let accelspeed = accel * wishspeed * dt;
    if (accelspeed > add) accelspeed = add;
    this.vel.x += accelspeed * wx;
    this.vel.z += accelspeed * wz;
  }

  _intersects(px, py, pz, r, h, c) {
    return (
      px - r < c.maxX && px + r > c.minX &&
      pz - r < c.maxZ && pz + r > c.minZ &&
      py < c.maxY - 0.001 && py + h > c.minY + 0.001
    );
  }

  _moveHorizontal(dx, dz) {
    const r = PHYS.radius, h = this.height;
    // X axis
    this.pos.x += dx;
    for (let pass = 0; pass < 2; pass++) {
      for (const c of this.colliders) {
        if (this._intersects(this.pos.x, this.pos.y, this.pos.z, r, h, c)) {
          if (this._tryStep(c)) continue;
          this.pos.x = dx > 0 ? c.minX - r : c.maxX + r;
          this.vel.x = 0;
        }
      }
    }
    // Z axis
    this.pos.z += dz;
    for (let pass = 0; pass < 2; pass++) {
      for (const c of this.colliders) {
        if (this._intersects(this.pos.x, this.pos.y, this.pos.z, r, h, c)) {
          if (this._tryStep(c)) continue;
          this.pos.z = dz > 0 ? c.minZ - r : c.maxZ + r;
          this.vel.z = 0;
        }
      }
    }
  }

  _tryStep(c) {
    const rise = c.maxY - this.pos.y;
    if (rise > 0.02 && rise <= PHYS.stepHeight) {
      // check headroom at stepped height
      const newY = c.maxY;
      for (const o of this.colliders) {
        if (o === c) continue;
        if (this._intersects(this.pos.x, newY, this.pos.z, PHYS.radius, this.height, o)) return false;
      }
      this.pos.y = newY;
      return true;
    }
    return false;
  }

  _moveVertical(dy) {
    const r = PHYS.radius, h = this.height;
    const prevY = this.pos.y;
    this.pos.y += dy;
    let grounded = false;

    if (this.pos.y <= 0) { this.pos.y = 0; if (this.vel.y < 0) this.vel.y = 0; grounded = true; }

    for (const c of this.colliders) {
      const horiz = this.pos.x - r < c.maxX && this.pos.x + r > c.minX &&
                    this.pos.z - r < c.maxZ && this.pos.z + r > c.minZ;
      if (!horiz) continue;
      // landing on top
      if (dy <= 0 && prevY >= c.maxY - 0.05 && this.pos.y < c.maxY) {
        this.pos.y = c.maxY; this.vel.y = 0; grounded = true;
      }
      // ceiling bump
      else if (dy > 0 && prevY + h <= c.minY + 0.05 && this.pos.y + h > c.minY) {
        this.pos.y = c.minY - h; if (this.vel.y > 0) this.vel.y = 0;
      }
    }
    if (grounded) this.onGround = true;
  }

  _probeGround() {
    if (this.pos.y <= 0.02) return true;
    const r = PHYS.radius;
    for (const c of this.colliders) {
      const horiz = this.pos.x - r < c.maxX && this.pos.x + r > c.minX &&
                    this.pos.z - r < c.maxZ && this.pos.z + r > c.minZ;
      if (horiz && Math.abs(this.pos.y - c.maxY) < 0.08) return true;
    }
    return false;
  }

  _ceilingBlocked() {
    const standH = PHYS.standHalfHeight * 2;
    const r = PHYS.radius;
    for (const c of this.colliders) {
      if (this._intersects(this.pos.x, this.pos.y, this.pos.z, r, standH, c)) return true;
    }
    return false;
  }

  _updateCamera(hspeed) {
    const eye = this.eyePosition;
    let bobY = 0, bobX = 0;
    if (this.onGround) {
      bobY = Math.sin(this._bob * 2) * 0.02 * Math.min(1, hspeed / 5);
      bobX = Math.cos(this._bob) * 0.015 * Math.min(1, hspeed / 5);
    }
    this.camera.position.set(eye.x + bobX, eye.y + bobY, eye.z);
    this.camera.rotation.order = "YXZ";
    this.camera.rotation.y = this.yaw + this.recoilYaw;
    this.camera.rotation.x = this.pitch + this.recoilPitch;
    this.camera.rotation.z = 0;
  }
}
