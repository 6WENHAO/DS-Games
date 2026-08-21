/**
 * SALTWAKE — the player.
 *
 * Movement is the Quake acceleration model, which is what makes a 1997 shooter
 * feel like one: you reach full speed in a few frames, ground friction is
 * separate from acceleration, and air control is a small fraction of ground
 * control so a jump commits you. Strafe-jumping falls out of the model rather
 * than being special-cased, which is correct for the era.
 *
 * The camera carries a persistent district roll (the Victorian blocks lean) plus
 * a sanity-driven roll, stepped bob, a landing dip and weapon kick. All of it is
 * small enough to leave aim readable.
 */
import * as THREE from 'three';
import { PLAYER, SANITY, ANIM, WORLD } from '../core/config.js';
import { CELL } from '../world/build.js';
import { groundUnder, moveHorizontal, resolveProps } from '../world/collide.js';

const DEG = Math.PI / 180;

export class Player {
  /**
   * @param {object} world result of buildWorld()
   * @param {object} opts { audio, hud }
   */
  constructor(world, opts = {}) {
    this.world = world;
    this.audio = opts.audio || null;
    this.hud = opts.hud || null;

    this.pos = new THREE.Vector3();     // feet
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.onGround = false;
    this.crouching = false;
    this.inWater = false;
    this.waterDepth = 0;

    this.health = PLAYER.maxHealth;
    this.armor = 0;
    this.sanity = PLAYER.maxSanity;
    this.alive = true;
    this.keys = new Set();
    this.secretsFound = new Set();

    this.height = PLAYER.height;
    this.eyeHeight = PLAYER.eye;
    this.radius = PLAYER.radius;

    this.bobPhase = 0;
    this.landDip = 0;
    this.viewKick = new THREE.Vector2();
    this.districtRoll = 0;
    this.targetRoll = 0;
    this.airTime = 0;
    this.stepDistance = 0;
    this.lastDamageTime = -99;
    this.drownTimer = 0;
    this.hurtFlash = 0;
    this.lastDamageDir = 0;

    this.camera = new THREE.PerspectiveCamera(84, 16 / 9, 0.05, 200);
    this.camera.rotation.order = 'YXZ';

    /** Reusable body descriptor handed to the collision routines. */
    this._body = { x: 0, z: 0, y: 0, radius: this.radius, height: this.height, stepHeight: PLAYER.stepHeight };
    this._forward = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this._wish = new THREE.Vector3();
  }

  spawn(x, y, z, yawDeg = 0) {
    this.pos.set(x, y, z);
    this.vel.set(0, 0, 0);
    this.yaw = yawDeg * DEG;
    this.pitch = 0;
    this.alive = true;
    this.health = PLAYER.maxHealth;
    this.sanity = PLAYER.maxSanity;
  }

  get eyePosition() {
    const eye = this.crouching ? PLAYER.crouchEye : PLAYER.eye;
    return this.pos.y + eye + this.landDip;
  }

  /** Unit forward including pitch, for aiming. */
  aimDirection(out = new THREE.Vector3()) {
    const cp = Math.cos(this.pitch);
    return out.set(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp).normalize();
  }

  look(dx, dy) {
    this.yaw -= dx * PLAYER.mouseSensitivity;
    this.pitch -= dy * PLAYER.mouseSensitivity;
    this.pitch = Math.max(-PLAYER.pitchLimit, Math.min(PLAYER.pitchLimit, this.pitch));
    if (this.yaw > Math.PI) this.yaw -= Math.PI * 2;
    if (this.yaw < -Math.PI) this.yaw += Math.PI * 2;
  }

  /* ------------------------------------------------------------ movement */

  /**
   * Quake ground friction: applied before acceleration, with a floor on the
   * control speed so you can still stop from a crawl.
   */
  applyFriction(dt) {
    const v = this.vel;
    const speed = Math.hypot(v.x, v.z);
    if (speed < 0.01) { v.x = 0; v.z = 0; return; }
    const control = Math.max(speed, PLAYER.stopSpeed);
    const drop = control * PLAYER.friction * dt;
    const newSpeed = Math.max(0, speed - drop) / speed;
    v.x *= newSpeed;
    v.z *= newSpeed;
  }

  /** Quake acceleration: only the component along the wish direction is added. */
  accelerate(wishX, wishZ, wishSpeed, accel, dt) {
    const current = this.vel.x * wishX + this.vel.z * wishZ;
    const add = wishSpeed - current;
    if (add <= 0) return;
    let accelSpeed = accel * dt * wishSpeed;
    if (accelSpeed > add) accelSpeed = add;
    this.vel.x += accelSpeed * wishX;
    this.vel.z += accelSpeed * wishZ;
  }

  /**
   * @param {number} dt
   * @param {object} input { forward, strafe, jump, run, crouch }
   */
  update(dt, input) {
    if (!this.alive) {
      this.updateCamera(dt);
      return;
    }

    const body = this._body;
    body.x = this.pos.x;
    body.z = this.pos.z;
    body.y = this.pos.y;
    body.radius = this.radius;
    body.height = this.crouching ? PLAYER.crouchHeight : PLAYER.height;
    body.stepHeight = PLAYER.stepHeight;

    /* --- crouch, with a headroom check before standing back up --- */
    const wantCrouch = !!input.crouch;
    if (wantCrouch !== this.crouching) {
      if (wantCrouch) this.crouching = true;
      else {
        const ground = groundUnder(this.world.grid, this.pos.x, this.pos.z, this.radius,
          this.pos.y, PLAYER.height, PLAYER.stepHeight);
        if (ground.ceilY - this.pos.y >= PLAYER.height) this.crouching = false;
      }
    }
    this.height = this.crouching ? PLAYER.crouchHeight : PLAYER.height;

    /* --- ground sample --- */
    let ground = groundUnder(this.world.grid, this.pos.x, this.pos.z, this.radius,
      this.pos.y, this.height, PLAYER.stepHeight);
    const cell = ground.cell;
    this.inWater = false;
    this.waterDepth = 0;
    if (cell && cell.waterY !== null && cell.waterY !== undefined) {
      const surface = cell.waterY;
      if (this.pos.y < surface - 0.05) {
        this.inWater = true;
        this.waterDepth = surface - this.pos.y;
      }
    }

    /* --- wish direction from input, in the yaw frame --- */
    const sinY = Math.sin(this.yaw);
    const cosY = Math.cos(this.yaw);
    let wx = -sinY * input.forward - cosY * input.strafe;
    let wz = -cosY * input.forward + sinY * input.strafe;
    const wishLen = Math.hypot(wx, wz);
    if (wishLen > 1e-4) { wx /= wishLen; wz /= wishLen; }

    let wishSpeed = 0;
    if (wishLen > 1e-4) {
      wishSpeed = this.inWater ? PLAYER.waterSpeed
        : this.crouching ? PLAYER.crouchSpeed
          : input.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
    }

    /* --- vertical --- */
    if (this.inWater) {
      // Buoyant drag rather than free fall.
      this.vel.y -= WORLD.gravityWater * dt;
      this.vel.y *= 1 - Math.min(1, 4.0 * dt);
      if (input.jump) this.vel.y = PLAYER.waterJumpSpeed;
      this.drownTimer += this.waterDepth > (this.crouching ? PLAYER.crouchEye : PLAYER.eye) ? dt : -dt * 2;
      this.drownTimer = Math.max(0, this.drownTimer);
      if (this.drownTimer > PLAYER.drownTime) {
        this.damage(PLAYER.drownDamage, 0, 'drown');
        this.drownTimer = PLAYER.drownTime * 0.72;
        if (this.audio) this.audio.play('playerDrown');
      }
    } else {
      this.drownTimer = Math.max(0, this.drownTimer - dt * 3);
      this.vel.y -= PLAYER.gravity * dt;
      if (this.vel.y < -PLAYER.maxFallSpeed) this.vel.y = -PLAYER.maxFallSpeed;
    }

    if (this.onGround && !this.inWater) {
      this.applyFriction(dt);
      this.accelerate(wx, wz, wishSpeed, PLAYER.accelerate, dt);
      if (input.jump) {
        this.vel.y = PLAYER.jumpSpeed;
        this.onGround = false;
        this.airTime = 0;
      }
    } else if (this.inWater) {
      this.applyFriction(dt * 0.7);
      this.accelerate(wx, wz, wishSpeed, PLAYER.accelerate * 0.6, dt);
    } else {
      // Air: only a sliver of control, which is what makes jumps commit.
      this.accelerate(wx, wz, Math.min(wishSpeed, 3.2), PLAYER.airAccelerate, dt);
      this.airTime += dt;
    }

    /* --- integrate horizontally, then resolve --- */
    moveHorizontal(this.world.grid, body, this.vel.x * dt, this.vel.z * dt);
    resolveProps(this.world.colliders, body);
    // Zero the velocity component we lost, so we slide instead of sticking.
    const movedX = body.x - this.pos.x;
    const movedZ = body.z - this.pos.z;
    if (Math.abs(this.vel.x * dt) > 1e-5 && Math.abs(movedX) < Math.abs(this.vel.x * dt) * 0.35) this.vel.x *= 0.25;
    if (Math.abs(this.vel.z * dt) > 1e-5 && Math.abs(movedZ) < Math.abs(this.vel.z * dt) * 0.35) this.vel.z *= 0.25;
    this.pos.x = body.x;
    this.pos.z = body.z;

    /* --- integrate vertically against the new ground --- */
    ground = groundUnder(this.world.grid, this.pos.x, this.pos.z, this.radius,
      this.pos.y, this.height, PLAYER.stepHeight);
    this.pos.y += this.vel.y * dt;

    const headRoom = ground.ceilY - this.height;
    if (this.pos.y > headRoom) {
      this.pos.y = headRoom;
      if (this.vel.y > 0) this.vel.y = 0;
    }

    if (this.pos.y <= ground.floorY + 0.001) {
      const impact = -this.vel.y;
      if (!this.onGround && impact > PLAYER.fallSafeSpeed) {
        const dmg = Math.round((impact - PLAYER.fallSafeSpeed) * PLAYER.fallDamagePerSpeed);
        if (dmg > 0) this.damage(dmg, 0, 'fall');
      }
      if (!this.onGround) {
        this.landDip = -PLAYER.landDip * Math.min(1, impact / 12);
        if (this.audio && impact > 3) this.audio.play('playerLand', { volume: Math.min(1, impact / 14) });
      }
      this.pos.y = ground.floorY;
      this.vel.y = 0;
      this.onGround = true;
      this.airTime = 0;
    } else {
      this.onGround = false;
    }

    // A cell marked as a pit with nothing under it drops you out of the level.
    if (ground.overPit && this.pos.y < ground.floorY - 12) {
      this.damage(999, 0, 'pit');
    }

    if (ground.hazard && this.onGround) {
      this.damage(14 * dt, 0, 'hazard');
    }

    /* --- footsteps, on distance rather than time --- */
    if (this.onGround) {
      const speed = Math.hypot(this.vel.x, this.vel.z);
      this.stepDistance += speed * dt;
      const stride = this.crouching ? 2.4 : 1.9;
      if (this.stepDistance > stride && speed > 1.2) {
        this.stepDistance = 0;
        if (this.audio) {
          const sound = this.inWater || (cell && cell.water) ? 'stepWet'
            : cell && cell.tiles && cell.tiles.floor === 'dockPlanks' ? 'stepWood' : 'stepStone';
          this.audio.play(sound, { volume: 0.42 });
        }
      }
      this.bobPhase += speed * dt * 1.7;
    }

    /* --- sanity regeneration --- */
    if (performanceNowSeconds() - this.lastDamageTime > SANITY.regenDelay) {
      this.sanity = Math.min(PLAYER.maxSanity, this.sanity + SANITY.regenPerSecond * dt);
    }

    this.landDip += (0 - this.landDip) * Math.min(1, dt * 7);
    this.viewKick.multiplyScalar(Math.max(0, 1 - dt * 9));
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 2.4);

    /* --- district lean --- */
    if (cell && cell.district) {
      const lean = DISTRICT_ROLL[cell.district] || 0;
      this.targetRoll = lean;
    }
    this.districtRoll += (this.targetRoll - this.districtRoll) * Math.min(1, dt * 1.6);

    this.updateCamera(dt);
  }

  updateCamera(dt) {
    const cam = this.camera;
    // Bob is quantised to the stop-motion clock so the whole frame ticks together.
    const bobStep = Math.floor(this.bobPhase * ANIM.viewmodelFps) / ANIM.viewmodelFps;
    const bob = Math.sin(bobStep * Math.PI * 2) * PLAYER.bobAmount * (this.onGround ? 1 : 0.2);
    const sway = Math.cos(bobStep * Math.PI) * PLAYER.swayAmount;

    cam.position.set(this.pos.x, this.eyePosition + bob, this.pos.z);
    const sanity01 = this.sanity / PLAYER.maxSanity;
    // Low sanity tips the horizon a little further every tier.
    const madRoll = (1 - sanity01) * 0.055 * Math.sin(performanceNowSeconds() * 0.7);
    cam.rotation.set(this.pitch + this.viewKick.y, this.yaw + this.viewKick.x + sway * 0.4,
      this.districtRoll + madRoll);
    if (!this.alive) cam.rotation.z += 0.55;
  }

  /* ------------------------------------------------------------ state */

  /**
   * @param {number} amount
   * @param {number} dirRelative radians relative to view forward, for the vignette
   */
  damage(amount, dirRelative = 0, cause = 'hit') {
    if (!this.alive || amount <= 0) return;
    let remaining = amount;
    if (this.armor > 0) {
      const absorbed = Math.min(this.armor, remaining * PLAYER.armorAbsorb);
      this.armor -= absorbed;
      remaining -= absorbed;
    }
    this.health -= remaining;
    this.lastDamageTime = performanceNowSeconds();
    this.hurtFlash = Math.min(1, this.hurtFlash + Math.min(0.7, amount / 45));
    this.lastDamageDir = dirRelative;
    if (this.hud) this.hud.flashDamage(dirRelative, Math.min(1, amount / 40));
    if (this.audio && cause !== 'hazard') this.audio.play('playerHurt', { volume: 0.7 });
    if (this.health <= 0) {
      this.health = 0;
      this.alive = false;
      if (this.audio) this.audio.play('playerDie');
    }
  }

  heal(amount) {
    this.health = Math.min(PLAYER.maxHealth, this.health + amount);
  }

  addArmor(amount) {
    this.armor = Math.min(PLAYER.maxArmor, this.armor + amount);
  }

  /** Sanity only ever falls from the world or the focus; never from damage. */
  drainSanity(amount) {
    this.sanity = Math.max(0, this.sanity - amount);
    this.lastDamageTime = performanceNowSeconds();
  }

  restoreSanity(amount) {
    this.sanity = Math.min(PLAYER.maxSanity, this.sanity + amount);
  }

  get sanity01() {
    return this.sanity / PLAYER.maxSanity;
  }

  giveKey(id) {
    this.keys.add(id);
  }

  hasKey(id) {
    return !id || this.keys.has(id);
  }

  addKick(x, y) {
    this.viewKick.x += x;
    this.viewKick.y += y;
  }

  /** Cell the player currently stands in. */
  get cell() {
    return this.world.grid.atWorld(this.pos.x, this.pos.z);
  }
}

/** How far each district tips the horizon. The subsidence is deliberate. */
export const DISTRICT_ROLL = {
  docks: 0.012,
  sewer: -0.008,
  victorian: 0.040,
  altar: -0.018,
  ruins: 0.026,
  rift: -0.065,
};

let _clockBase = 0;
function performanceNowSeconds() {
  if (typeof performance !== 'undefined' && performance.now) return performance.now() / 1000;
  if (!_clockBase) _clockBase = Date.now();
  return (Date.now() - _clockBase) / 1000;
}

export { CELL };
