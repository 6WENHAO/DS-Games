// Third-person action camera: orbit, spring boom, occlusion pull-in, lock-on,
// FOV kick, shake, aim mode and cinematic override.
import * as THREE from 'three';
import { clamp, damp, dampAngle, lerp, smoothstep, wrapAngle } from '../core/utils.js';
import { height } from '../world/heightfield.js';

export class ActionCamera {
  constructor(ctx) {
    this.ctx = ctx;
    this.cam = ctx.camera;
    this.yaw = Math.PI; this.pitch = -0.16;
    this.dist = 6.2; this.wantDist = 6.2;
    this.focus = new THREE.Vector3();
    this.pos = new THREE.Vector3();
    this.lockTarget = null;
    this.fov = 48; this.baseFov = 48; this.fovKick = 0;
    this.shakeOff = new THREE.Vector3();
    this.mode = 'follow';     // follow | aim | cinematic | free
    this.cinematic = null;
    this.sens = 1.0;
    this._up = new THREE.Vector3(0, 1, 0);
    this._tmp = new THREE.Vector3();
    this._tmp2 = new THREE.Vector3();
    this.height = 1.52;
    this.shoulder = 0.0;
  }

  setLockTarget(t) { this.lockTarget = t; }

  handleInput(dt) {
    const ctx = this.ctx, m = ctx.input.mouse;
    if (this.mode === 'cinematic') return;
    const aiming = this.mode === 'aim';
    const s = (aiming ? 0.0016 : 0.0027) * this.sens;
    if (ctx.input.locked) {
      this.yaw -= m.dx * s;
      this.pitch = clamp(this.pitch - m.dy * s * 0.86, -1.22, 1.05);
    }
    const gl = ctx.input.gamepadLook?.();
    if (gl) { this.yaw -= gl[0] * 2.4 * dt; this.pitch = clamp(this.pitch - gl[1] * 1.7 * dt, -1.22, 1.05); }
    if (m.wheel) this.wantDist = clamp(this.wantDist + m.wheel * 0.7, 2.2, 11);
  }

  update(dt, player) {
    const ctx = this.ctx;
    if (this.mode === 'free') return;   // photo mode drives the camera itself
    this.handleInput(dt);

    if (this.mode === 'cinematic' && !this.cinematic) return;   // prologue drives the camera itself
    if (this.mode === 'cinematic' && this.cinematic) {
      const c = this.cinematic;
      c.t = Math.min(1, c.t + dt / c.dur);
      const k = c.ease ? c.ease(c.t) : c.t;
      this.cam.position.lerpVectors(c.from, c.to, k);
      this._tmp.lerpVectors(c.lookFrom, c.lookTo, k);
      this.cam.lookAt(this._tmp);
      this.cam.fov = lerp(c.fovFrom ?? 40, c.fovTo ?? 40, k);
      this.cam.updateProjectionMatrix();
      if (c.t >= 1) { c.resolve?.(); this.cinematic = null; this.mode = 'follow'; }
      return;
    }

    // ----- lock-on softly steers the yaw toward the target -----
    if (this.lockTarget && this.lockTarget.alive !== false) {
      const tc = this.lockTarget.center ? this.lockTarget.center(this._tmp2) : this._tmp2.copy(this.lockTarget.root.position);
      const to = this._tmp.copy(tc).sub(player.position);
      const want = Math.atan2(-to.x, -to.z);
      this.yaw = dampAngle(this.yaw, want, 5.5, dt);
      const flat = Math.hypot(to.x, to.z);
      const wantPitch = clamp(-Math.atan2(to.y - 1.2, flat) - 0.06, -0.7, 0.5);
      this.pitch = damp(this.pitch, wantPitch, 3.4, dt);
    } else if (this.lockTarget) this.lockTarget = null;

    // ----- focus point -----
    const st = player.state;
    const hOff = st === 'swim' ? 0.55 : st === 'climb' ? 1.25 : this.height;
    const lead = this._tmp.copy(player.velocity).setY(0).multiplyScalar(0.055);
    this.focus.x = damp(this.focus.x, player.position.x + lead.x, 16, dt);
    this.focus.y = damp(this.focus.y, player.position.y + hOff, st === 'glide' ? 5 : 11, dt);
    this.focus.z = damp(this.focus.z, player.position.z + lead.z, 16, dt);

    // ----- boom -----
    const aim = this.mode === 'aim';
    const targetDist = aim ? 1.9 : this.wantDist * (st === 'glide' ? 1.28 : st === 'sprint' ? 1.06 : 1);
    this.dist = damp(this.dist, targetDist, 7, dt);
    this.shoulder = damp(this.shoulder, aim ? 0.62 : 0, 8, dt);

    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    const dir = this._tmp.set(Math.sin(this.yaw) * cp, -sp, Math.cos(this.yaw) * cp);
    const right = this._tmp2.set(dir.z, 0, -dir.x).normalize();
    const want = this.pos.copy(this.focus).addScaledVector(dir, -this.dist).addScaledVector(right, this.shoulder);

    // occlusion: keep out of terrain and props
    const gy = height(want.x, want.z) + 0.55;
    if (want.y < gy) want.y = gy;
    const hit = ctx.collision?.rayDown(want.x, want.z, want.y + 6);
    if (hit && hit.object && want.y < hit.y + 0.4) want.y = hit.y + 0.4;

    this.cam.position.lerp(want, 1 - Math.exp(-(aim ? 22 : 15) * dt));

    // shake + look
    ctx.fx3d?.shakeOffset(this.shakeOff, ctx.time.elapsed);
    this.cam.position.add(this.shakeOff);
    this._tmp.copy(this.focus).addScaledVector(right, this.shoulder * 0.7);
    this.cam.lookAt(this._tmp);

    // fov kick from speed / attacks
    const speed = Math.hypot(player.velocity.x, player.velocity.z);
    const speedFov = smoothstep(4.5, 12, speed) * 5.5 + (st === 'glide' ? 4 : 0);
    this.fovKick = damp(this.fovKick, 0, 6, dt);
    const target = (aim ? 32 : this.baseFov) + speedFov + this.fovKick;
    this.cam.fov = damp(this.cam.fov, target, 8, dt);
    this.cam.updateProjectionMatrix();
  }

  kick(amount = 3) { this.fovKick = amount; }

  /** Fly the camera along a scripted move; resolves when finished. */
  playCinematic({ from, to, lookFrom, lookTo, dur = 3, fovFrom = 42, fovTo = 38, ease }) {
    return new Promise(resolve => {
      this.mode = 'cinematic';
      this.cinematic = { from: from.clone(), to: to.clone(), lookFrom: lookFrom.clone(), lookTo: lookTo.clone(), dur, fovFrom, fovTo, ease, t: 0, resolve };
    });
  }

  /** World position -> screen pixels (for lock-on markers / health bars). */
  project(v3, out = { x: 0, y: 0, visible: false }) {
    this._tmp.copy(v3).project(this.cam);
    out.visible = this._tmp.z < 1;
    out.x = (this._tmp.x * 0.5 + 0.5) * innerWidth;
    out.y = (-this._tmp.y * 0.5 + 0.5) * innerHeight;
    return out;
  }
}
