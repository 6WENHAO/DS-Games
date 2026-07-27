import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Four verbs: move, jump, glide, Call. That is the entire control scheme.
// No fail state: running out of Bloom lands you softly, falling fades you back
// to the last stable ground. Nothing here can ever say "no".
// ---------------------------------------------------------------------------

const GRAVITY = 12.0;
const JUMP_V = 7.3;          // ~2.2 m apex
const WALK = 5.0;
const GLIDE_FWD = 14.0;
const GLIDE_FALL = 1.2;
const GLIDE_DRAIN = 1 / 14;  // 14 s of continuous glide from full
const EYE = 1.05;

export class Input {
  constructor(dom) {
    this.keys = new Set();
    this.yaw = 0;
    this.pitch = -0.14;
    this.locked = false;
    this.callPressed = false;

    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      if (e.code === 'KeyE') this.callPressed = true;
      if (['Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());

    dom.addEventListener('click', () => { if (!this.locked) dom.requestPointerLock(); });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === dom;
    });
    addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.yaw -= e.movementX * 0.0022;
      this.pitch = THREE.MathUtils.clamp(this.pitch - e.movementY * 0.0019, -0.9, 0.65);
    });

    // touch fallback: drag to look, two-finger tap to Call
    let last = null;
    dom.addEventListener('touchstart', (e) => {
      last = e.touches[0];
      if (e.touches.length >= 2) this.callPressed = true;
    }, { passive: true });
    dom.addEventListener('touchmove', (e) => {
      if (!last) return;
      const t = e.touches[0];
      this.yaw -= (t.clientX - last.clientX) * 0.005;
      this.pitch = THREE.MathUtils.clamp(this.pitch - (t.clientY - last.clientY) * 0.004, -0.9, 0.65);
      last = t;
    }, { passive: true });
    dom.addEventListener('touchend', () => { last = null; }, { passive: true });
  }

  axis() {
    const k = this.keys;
    const x = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    const y = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    return { x, y };
  }

  get jumpHeld() { return this.keys.has('Space'); }

  takeCall() { const c = this.callPressed; this.callPressed = false; return c; }
}

export class Player {
  constructor(world, input) {
    this.world = world;
    this.input = input;
    this.pos = new THREE.Vector3(0, 0, 0);
    this.pos.y = world.heightAt(0, 0);
    this.vel = new THREE.Vector3();
    this.grounded = true;
    this.gliding = false;
    this.bloom = 1.0;
    this.facing = 0;
    this.lastSafe = this.pos.clone();
    this.fade = 0;          // dream-cut when you fall out of the world
    this.moveSpeed = 0;
    this.callAge = 99;
    this.onCall = null;
    this._safeTimer = 0;
    this._jumpWasHeld = false;
  }

  update(dt) {
    const inp = this.input;
    const ax = inp.axis();

    // --- move, camera-relative ---
    const fwd = new THREE.Vector3(-Math.sin(inp.yaw), 0, -Math.cos(inp.yaw));
    const right = new THREE.Vector3(Math.cos(inp.yaw), 0, -Math.sin(inp.yaw));
    const wish = new THREE.Vector3()
      .addScaledVector(fwd, ax.y)
      .addScaledVector(right, ax.x);
    if (wish.lengthSq() > 0) { wish.normalize(); this.facing = Math.atan2(wish.x, wish.z); }

    const ground = this.world.heightAt(this.pos.x, this.pos.z);
    const normal = this.world.normalAt(this.pos.x, this.pos.z);
    const slope = Math.acos(THREE.MathUtils.clamp(normal.y, -1, 1));

    // --- glide ---
    const wantGlide = inp.jumpHeld && !this.grounded && this.vel.y < 0.6 && this.bloom > 0.001;
    this.gliding = wantGlide;

    let speed = WALK;
    if (this.gliding) {
      speed = GLIDE_FWD;
      this.bloom = Math.max(0, this.bloom - GLIDE_DRAIN * dt);
      this.vel.y = THREE.MathUtils.damp(this.vel.y, -GLIDE_FALL, 6, dt);
    } else {
      this.vel.y -= GRAVITY * dt;
    }

    // uphill costs a little, downhill gives a little — the terrain shapes gait
    if (this.grounded) {
      const uphill = wish.dot(new THREE.Vector3(-normal.x, 0, -normal.z));
      speed *= THREE.MathUtils.clamp(1 - uphill * 0.55, 0.55, 1.35);
    }

    const accel = this.grounded ? 12 : 3.5;
    const targetVX = wish.x * speed, targetVZ = wish.z * speed;
    this.vel.x = THREE.MathUtils.damp(this.vel.x, targetVX, accel, dt);
    this.vel.z = THREE.MathUtils.damp(this.vel.z, targetVZ, accel, dt);

    // slides: dune and grass faces over ~30 degrees
    if (this.grounded && slope > 0.52) {
      const s = (slope - 0.52) * 26;
      this.vel.x += -normal.x * s * dt;
      this.vel.z += -normal.z * s * dt;
    }

    // --- jump (rising edge only; holding is glide, not hop) ---
    if (inp.jumpHeld && !this._jumpWasHeld && this.grounded) {
      this.vel.y = JUMP_V;
      this.grounded = false;
    }
    this._jumpWasHeld = inp.jumpHeld;

    this.pos.addScaledVector(this.vel, dt);

    // --- ground follow ---
    const g2 = this.world.heightAt(this.pos.x, this.pos.z);
    if (this.pos.y <= g2) {
      this.pos.y = g2;
      if (this.vel.y < 0) this.vel.y = 0;
      this.grounded = true;
    } else if (this.pos.y > g2 + 0.05) {
      this.grounded = false;
    }

    // --- Bloom regen: being near living things gives you the ability to rise ---
    if (!this.gliding) {
      const near = this.grounded ? 1.0 : 0.35;
      this.bloom = Math.min(1, this.bloom + 0.085 * near * dt);
    }

    // --- world bounds: a soft turn-back, never a wall ---
    const lim = 470;
    const d = Math.hypot(this.pos.x, this.pos.z);
    if (d > lim) {
      const k = (d - lim) * 0.9 * dt;
      this.pos.x -= (this.pos.x / d) * k * 10;
      this.pos.z -= (this.pos.z / d) * k * 10;
    }

    // --- last stable ground, for the dream-cut ---
    this._safeTimer += dt;
    if (this.grounded && this._safeTimer > 1.2) {
      this._safeTimer = 0;
      this.lastSafe.copy(this.pos);
    }

    // --- the Call ---
    this.callAge += dt;
    if (this.input.takeCall() && this.callAge > 0.7) {
      this.callAge = 0;
      if (this.onCall) this.onCall(this.pos.clone());
    }

    this.moveSpeed = Math.hypot(this.vel.x, this.vel.z);
  }

  get eye() { return new THREE.Vector3(this.pos.x, this.pos.y + EYE, this.pos.z); }
}

// ---------------------------------------------------------------------------
// Camera: slow, damped, and it breathes. Never snaps.
// ---------------------------------------------------------------------------
export class FollowCamera {
  constructor(camera, input) {
    this.camera = camera;
    this.input = input;
    this.target = new THREE.Vector3();
    this.pos = new THREE.Vector3(0, 10, 12);
    this.fov = 55;
    this.breath = 0;
  }

  update(dt, player, world) {
    this.breath += dt;
    const { yaw, pitch } = this.input;

    const dist = 7.4 - pitch * 2.0;
    const look = player.eye.clone().add(new THREE.Vector3(0, 0.6, 0));
    const dir = new THREE.Vector3(
      Math.sin(yaw) * Math.cos(pitch),
      -Math.sin(pitch),
      Math.cos(yaw) * Math.cos(pitch),
    );
    const want = look.clone().addScaledVector(dir, dist);

    // never let the camera dip under the ground
    const gh = world.heightAt(want.x, want.z) + 1.6;
    if (want.y < gh) want.y = gh;

    this.pos.x = THREE.MathUtils.damp(this.pos.x, want.x, 5.2, dt);
    this.pos.y = THREE.MathUtils.damp(this.pos.y, want.y, 4.4, dt);
    this.pos.z = THREE.MathUtils.damp(this.pos.z, want.z, 5.2, dt);
    this.target.lerp(look, 1 - Math.exp(-7 * dt));

    // 0.15 degree drift on two axes — the frame is never quite still
    const bx = Math.sin(this.breath * 0.52) * 0.0026;
    const by = Math.sin(this.breath * 0.37 + 1.1) * 0.0026;

    this.camera.position.copy(this.pos);
    this.camera.lookAt(this.target);
    this.camera.rotateX(by);
    this.camera.rotateY(bx);

    // FOV: 55 default, 68 gliding (speed), 42 held on a vista
    const wantFov = player.gliding ? 68 : 55;
    this.fov = THREE.MathUtils.damp(this.fov, wantFov, 2.6, dt);
    if (Math.abs(this.camera.fov - this.fov) > 0.01) {
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
    }
  }
}
