/**
 * 第一视角控制器：巨构必须能“走进去”。
 * - WASD 行走 / Shift 疾行 / Space 跳 / Ctrl 蹲 / F 切换飞行
 * - 体素 AABB 碰撞 + 1 格自动上台阶（不然街面上的路缘会把人卡住）
 * - 电梯模式：抓住升降塔轿厢一路爬到 1150 体素高（全场最强的尺度体验）
 */

import * as THREE from 'three';

const EYE = 2.7;          // 眼高（人 3 体素）
const CROUCH_EYE = 1.6;
const RADIUS = 0.62;
const HEIGHT = 3.0;
const GRAVITY = 62;
const JUMP = 15.5;

export class FirstPerson {
  constructor(camera, world, dom) {
    this.camera = camera;
    this.world = world;
    this.dom = dom;
    this.enabled = false;
    this.pos = new THREE.Vector3(-238, 0, 2);   // 脚底
    this.vel = new THREE.Vector3();
    this.yaw = -Math.PI / 2;
    this.pitch = 0.2;
    this.fly = false;
    this.onGround = false;
    this.crouch = false;
    this.run = false;
    this.keys = new Set();
    this.bob = 0;
    this.sens = 0.0022;
    this.speedWalk = 11;
    this.speedRun = 30;
    this.speedFly = 90;
    this.eye = EYE;
    this.ride = null;      // 电梯状态
    this.locked = false;
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onLockChange = this._onLockChange.bind(this);
    document.addEventListener('pointerlockchange', this._onLockChange);
    document.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
  }

  _onLockChange() {
    this.locked = document.pointerLockElement === this.dom;
    if (this.onLockChange) this.onLockChange(this.locked);
  }

  requestLock() { if (this.enabled) this.dom.requestPointerLock?.(); }
  releaseLock() { if (document.pointerLockElement === this.dom) document.exitPointerLock(); }

  _onMouseMove(e) {
    if (!this.enabled || !this.locked) return;
    this.yaw -= e.movementX * this.sens;
    this.pitch -= e.movementY * this.sens;
    const lim = Math.PI / 2 - 0.015;
    this.pitch = Math.max(-lim, Math.min(lim, this.pitch));
  }

  _onKeyDown(e) {
    if (!this.enabled) return;
    const c = e.code;
    this.keys.add(c);
    if (c === 'KeyF') { this.fly = !this.fly; this.vel.set(0, 0, 0); if (this.onFlyChange) this.onFlyChange(this.fly); }
    if (c === 'Space' && !this.fly && this.onGround && !this.ride) { this.vel.y = JUMP; this.onGround = false; }
    if (c === 'Space' || c === 'KeyW' || c === 'KeyA' || c === 'KeyS' || c === 'KeyD') {
      if (this.ride) this.exitRide();
    }
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft', 'ControlLeft'].includes(c)) e.preventDefault();
  }

  _onKeyUp(e) { this.keys.delete(e.code); }

  solidAt(x, y, z) {
    return this.world.get(Math.floor(x), Math.floor(y), Math.floor(z)) !== 0;
  }

  /** AABB 与体素求交（脚底 py） */
  hits(px, py, pz, h = HEIGHT) {
    const x0 = Math.floor(px - RADIUS), x1 = Math.floor(px + RADIUS);
    const y0 = Math.floor(py + 0.02), y1 = Math.floor(py + h - 0.02);
    const z0 = Math.floor(pz - RADIUS), z1 = Math.floor(pz + RADIUS);
    const w = this.world;
    for (let y = y0; y <= y1; y++) {
      for (let z = z0; z <= z1; z++) {
        for (let x = x0; x <= x1; x++) {
          if (w.get(x, y, z) !== 0) return true;
        }
      }
    }
    return false;
  }

  /** 传送到某个视点，并自动落到地面上 */
  placeAt(pos, yaw, pitch, fly = false) {
    let [x, y, z] = pos;
    this.yaw = yaw ?? this.yaw;
    this.pitch = pitch ?? this.pitch;
    this.fly = fly;
    this.ride = null;
    // 向上找到第一个能容身的位置
    let py = Math.round(y);
    for (let i = 0; i < 90; i++) {
      if (!this.hits(x, py, z)) break;
      py += 1;
    }
    // 再向下贴地
    if (!fly) {
      for (let i = 0; i < 200; i++) {
        if (this.hits(x, py - 1, z)) break;
        py -= 1;
        if (py < -220) break;
      }
    }
    this.pos.set(x, py, z);
    this.vel.set(0, 0, 0);
    this.onGround = true;
    this.updateCamera(0);
  }

  /** 搭乘升降塔轿厢 */
  enterRide(elevators, time) {
    if (!elevators || !elevators.length) return;
    // 选最靠近当前位置的一部
    let best = elevators[0], bd = Infinity;
    for (const e of elevators) {
      const d = (e.x - this.pos.x) ** 2 + (e.z - this.pos.z) ** 2;
      if (d < bd) { bd = d; best = e; }
    }
    this.ride = { e: best, t0: time };
    this.fly = false;
    this.vel.set(0, 0, 0);
    if (this.onRideChange) this.onRideChange(true);
  }

  exitRide() {
    if (!this.ride) return;
    this.ride = null;
    this.fly = true;   // 半空中下车 → 自动进入飞行，避免坠落
    if (this.onRideChange) this.onRideChange(false);
    if (this.onFlyChange) this.onFlyChange(this.fly);
  }

  moveAxis(d, axis) {
    const p = this.pos;
    const step = 0.24;
    let remain = Math.abs(d);
    const sgn = Math.sign(d);
    while (remain > 1e-4) {
      const s = Math.min(step, remain) * sgn;
      remain -= Math.abs(s);
      const nx = axis === 0 ? p.x + s : p.x;
      const nz = axis === 2 ? p.z + s : p.z;
      const h = this.crouch ? 1.9 : HEIGHT;
      if (!this.hits(nx, p.y, nz, h)) { p.x = nx; p.z = nz; continue; }
      // 尝试上一格台阶
      if (this.onGround && !this.hits(nx, p.y + 1, nz, h) && !this.hits(p.x, p.y + 1, p.z, h)) {
        p.y += 1; p.x = nx; p.z = nz; continue;
      }
      break;
    }
  }

  update(dt, time) {
    if (!this.enabled) return;
    const k = this.keys;
    this.run = k.has('ShiftLeft') || k.has('ShiftRight');
    this.crouch = !this.fly && (k.has('ControlLeft') || k.has('KeyC'));

    if (this.ride) {
      const e = this.ride.e;
      const span = e.y1 - e.y0;
      const period = (span * 2) / e.speed;
      const ph = ((time / period) + e.phase) % 1;
      const tri = ph < 0.5 ? ph * 2 : 2 - ph * 2;
      const ease = tri * tri * (3 - 2 * tri);
      // 站在轿厢外侧的检修平台上：能看见轿厢本身，尺度感才成立
      const ox = e.x - Math.sign(e.x || 1) * 8;
      this.pos.set(ox, e.y0 + span * ease + 1.0, e.z);
      this.updateCamera(dt);
      return;
    }

    let fwd = 0, strafe = 0, lift = 0;
    if (k.has('KeyW') || k.has('ArrowUp')) fwd += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) fwd -= 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) strafe -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) strafe += 1;
    if (this.fly) {
      if (k.has('Space')) lift += 1;
      if (k.has('ControlLeft') || k.has('KeyC')) lift -= 1;
    }
    const len = Math.hypot(fwd, strafe) || 1;
    fwd /= len; strafe /= len;

    const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
    // 前方 = (-sin(yaw), 0, -cos(yaw))
    const fx = -sy, fz = -cy;
    const rx = cy, rz = -sy;

    if (this.fly) {
      const sp = (this.run ? this.speedFly * 2.6 : this.speedFly) * (1 + Math.abs(this.pitch) * 0.2);
      const cp = Math.cos(this.pitch), sp2 = Math.sin(this.pitch);
      const dx = (fx * cp * fwd + rx * strafe) * sp * dt;
      const dz = (fz * cp * fwd + rz * strafe) * sp * dt;
      const dy = (sp2 * fwd + lift) * sp * dt;
      this.pos.x += dx; this.pos.y += dy; this.pos.z += dz;
    } else {
      const sp = this.run ? this.speedRun : (this.crouch ? 5 : this.speedWalk);
      const wx = (fx * fwd + rx * strafe) * sp;
      const wz = (fz * fwd + rz * strafe) * sp;
      this.moveAxis(wx * dt, 0);
      this.moveAxis(wz * dt, 2);
      this.vel.y -= GRAVITY * dt;
      this.vel.y = Math.max(this.vel.y, -160);
      let dy = this.vel.y * dt;
      const h = this.crouch ? 1.9 : HEIGHT;
      const stepY = 0.22;
      let rem = Math.abs(dy);
      const sg = Math.sign(dy);
      while (rem > 1e-4) {
        const s = Math.min(stepY, rem) * sg;
        rem -= Math.abs(s);
        if (!this.hits(this.pos.x, this.pos.y + s, this.pos.z, h)) {
          this.pos.y += s;
        } else {
          if (sg < 0) this.pos.y = Math.floor(this.pos.y + s) + 1;
          this.vel.y = 0;
          break;
        }
      }
      // 明确的落地探测：不能靠"这一帧下落被挡住"来判断，
      // 否则静止站立时 onGround 会在两帧之间抖动，导致跳跃时好时坏。
      this.onGround = this.vel.y <= 0.01 && this.hits(this.pos.x, this.pos.y - 0.14, this.pos.z, h);
      if (this.onGround && this.vel.y < 0) this.vel.y = 0;
      if (this.pos.y < -230) { this.pos.y = -230; this.onGround = true; this.vel.y = 0; }
      // 头部走动起伏
      const moving = (Math.abs(fwd) + Math.abs(strafe)) > 0 && this.onGround;
      this.bob += dt * (this.run ? 13 : 8.5) * (moving ? 1 : 0);
    }
    this.updateCamera(dt);
  }

  updateCamera(dt) {
    const target = this.crouch ? CROUCH_EYE : EYE;
    this.eye += (target - this.eye) * Math.min(1, dt * 12);
    const bobY = this.fly ? 0 : Math.sin(this.bob) * 0.075;
    const bobX = this.fly ? 0 : Math.cos(this.bob * 0.5) * 0.045;
    this.camera.position.set(this.pos.x + bobX, this.pos.y + this.eye + bobY, this.pos.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }

  get altitude() { return this.pos.y; }
}
