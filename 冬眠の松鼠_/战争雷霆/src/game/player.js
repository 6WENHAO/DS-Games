import * as THREE from 'three';
import { clamp, damp } from '../core/utils.js';

const _dir = new THREE.Vector3();
const _pivot = new THREE.Vector3();
const _camPos = new THREE.Vector3();
const _muzzleEnd = new THREE.Vector3();

/**
 * 玩家控制：驾驶输入 / 轨道相机 / 狙击镜 / 瞄准与穿深预估
 */
export class PlayerController {
  constructor(ctx) {
    this.ctx = ctx;
    this.tank = null;
    this.camYaw = Math.PI;
    this.camPitch = -0.12;
    this.camDist = 13;
    this.scope = false;
    this.zoomLevels = [4, 6, 8];
    this.zoomIndex = 0;
    this.shake = 0;
    this.aimPoint = new THREE.Vector3(0, 0, 100);
    this.aimInfo = { targetTank: null, penClass: 'none', dist: 0 };
    this.gunHit = { point: new THREE.Vector3(), dist: 100, blocked: false };
    this.enabled = false;
    this._smoothPos = new THREE.Vector3();
    this._firstFrame = true;
  }

  attachTank(tank) {
    if (this.tank && this.tank.root) this.tank.root.visible = true;
    this.tank = tank;
    this.camYaw = tank.heading;
    this.camPitch = -0.12;
    this.scope = false;
    this._firstFrame = true;
  }

  toggleScope() {
    this.scope = !this.scope;
    if (this.tank) this.tank.root.visible = !this.scope;
    this.ctx.audio.playUI('ui_click', 0.4, this.scope ? 1.3 : 0.9);
  }

  addShake(amount) { this.shake = Math.min(1.6, this.shake + amount); }

  update(dt) {
    const tank = this.tank;
    if (!tank) return;
    const input = this.ctx.input;
    const camera = this.ctx.engine.camera;

    if (this.enabled) {
      // ---- 驾驶（仅存活时） ----
      if (tank.alive) {
        const f = (input.isDown('KeyW') ? 1 : 0) - (input.isDown('KeyS') ? 1 : 0);
        const s = (input.isDown('KeyA') ? 1 : 0) - (input.isDown('KeyD') ? 1 : 0);
        tank.throttle = f;
        tank.steer = s;
      }

      // ---- 视角（存活/阵亡旁观均可环视） ----
      const md = input.consumeDeltas();
      const sens = this.scope ? 0.0009 / this.zoomLevels[this.zoomIndex] * 4 : 0.0023;
      this.camYaw -= md.dx * sens;
      this.camPitch -= md.dy * sens;
      this.camPitch = clamp(this.camPitch, this.scope ? -0.32 : -0.52, this.scope ? 0.35 : 0.62);
      if (md.wheel !== 0) {
        if (this.scope) {
          this.zoomIndex = clamp(this.zoomIndex - md.wheel, 0, this.zoomLevels.length - 1);
        } else {
          this.camDist = clamp(this.camDist + md.wheel * 2, 7, 26);
        }
      }

      // ---- 开火 ----
      if (tank.alive && input.mouseDown[0] && tank.canFire()) {
        tank.fire();
        this.addShake(0.55);
        input.mouseDown[0] = false; // 单发
      }
    } else {
      input.consumeDeltas();
      if (tank.alive) { tank.throttle = 0; tank.steer = 0; }
    }

    // ---- 视线方向 ----
    _dir.set(
      Math.sin(this.camYaw) * Math.cos(this.camPitch),
      Math.sin(this.camPitch),
      Math.cos(this.camYaw) * Math.cos(this.camPitch)
    );

    // ---- 瞄准射线（相机中心） ----
    const eye = this.scope ? this._scopeEye() : _pivot.set(tank.pos.x, tank.pos.y + 3.2, tank.pos.z);
    this._computeAim(eye, _dir);
    if (tank.alive) tank.aimAt(this.aimPoint);

    // ---- 相机定位 ----
    if (this.scope && tank.alive) {
      const m = tank.getMuzzle();
      _camPos.copy(m.pos).addScaledVector(m.dir, -1.6);
      _camPos.y += 0.35;
      camera.position.copy(_camPos);
      camera.rotation.set(0, 0, 0);
      camera.lookAt(_camPos.clone().add(_dir));
      camera.fov = 62 / this.zoomLevels[this.zoomIndex];
    } else {
      if (this.scope) { this.scope = false; tank.root.visible = true; }
      _pivot.set(tank.pos.x, tank.pos.y + 3.0, tank.pos.z);
      let dist = this.camDist;
      // 相机碰撞
      const back = _dir.clone().multiplyScalar(-1);
      const hit = this.ctx.world.raycast(_pivot, back, dist + 1);
      if (hit) dist = Math.max(2.4, hit.dist - 1.2);
      _camPos.copy(_pivot).addScaledVector(back, dist);
      const minY = this.ctx.terrain.heightAt(_camPos.x, _camPos.z) + 1.1;
      if (_camPos.y < minY) _camPos.y = minY;
      if (this._firstFrame) { this._smoothPos.copy(_camPos); this._firstFrame = false; }
      this._smoothPos.x = damp(this._smoothPos.x, _camPos.x, 22, dt);
      this._smoothPos.y = damp(this._smoothPos.y, _camPos.y, 22, dt);
      this._smoothPos.z = damp(this._smoothPos.z, _camPos.z, 22, dt);
      camera.position.copy(this._smoothPos);
      camera.lookAt(this._smoothPos.clone().add(_dir));
      camera.fov = 70;
    }

    // ---- 震动 ----
    if (this.shake > 0.001) {
      camera.position.x += (Math.random() - 0.5) * this.shake * 0.35;
      camera.position.y += (Math.random() - 0.5) * this.shake * 0.3;
      camera.rotation.z += (Math.random() - 0.5) * this.shake * 0.012;
      this.shake = damp(this.shake, 0, 6.5, dt);
    }
    camera.updateProjectionMatrix();

    // ---- 火炮实际落点（准星） ----
    if (tank.alive) this._computeGunHit();

    // ---- 音频监听者 ----
    this.ctx.audio.setListener(
      { x: camera.position.x, y: camera.position.y, z: camera.position.z },
      { x: _dir.x, y: _dir.y, z: _dir.z }
    );
  }

  _scopeEye() {
    const m = this.tank.getMuzzle();
    return _pivot.copy(m.pos).addScaledVector(m.dir, -1.2);
  }

  /** 相机中心射线与世界/坦克求交 → aimPoint 与穿深预估 */
  _computeAim(origin, dir) {
    const { world, battle } = this.ctx;
    const maxDist = 2400;
    let best = null;

    const wh = world.raycast(origin, dir, maxDist);
    if (wh) best = { point: wh.point, dist: wh.dist, tank: null };

    _muzzleEnd.copy(origin).addScaledVector(dir, best ? best.dist : maxDist);
    for (const t of battle.tanks) {
      if (t === this.tank || !t.alive) continue;
      const hit = t.hitTest(origin, _muzzleEnd);
      if (hit) {
        const d = hit.point.distanceTo(origin);
        if (!best || d < best.dist) best = { point: hit.point, dist: d, tank: t, hit };
      }
    }

    if (best) {
      this.aimPoint.copy(best.point);
      this.aimInfo.dist = best.dist;
      this.aimInfo.targetTank = best.tank;
      if (best.tank && best.tank.team !== this.tank.team && best.hit) {
        // 穿深预估
        const shell = this.tank.data.shells[this.tank.currentShell];
        const penEff = shell.pen * (1 - clamp(best.dist, 0, 1800) / 1800 * 0.22);
        const nominal = best.tank.armorAt(best.hit);
        const shellDirLocal = dir.clone().transformDirection(
          new THREE.Matrix4().copy(best.tank.root.matrixWorld).invert()
        );
        const cos = Math.abs(shellDirLocal.normalize().dot(best.hit.normalLocal));
        const eff = nominal / Math.max(cos, 0.25);
        this.aimInfo.penClass = penEff > eff * 1.15 ? 'good' : penEff > eff * 0.9 ? 'maybe' : 'bad';
      } else if (best.tank && best.tank.team === this.tank.team) {
        this.aimInfo.penClass = 'ally';
      } else {
        this.aimInfo.penClass = 'none';
      }
    } else {
      this.aimPoint.copy(origin).addScaledVector(dir, 2000);
      this.aimInfo.dist = 2000;
      this.aimInfo.targetTank = null;
      this.aimInfo.penClass = 'none';
    }
  }

  /** 火炮弹道落点（含重力，用于第二准星） */
  _computeGunHit() {
    const { world, battle } = this.ctx;
    const m = this.tank.getMuzzle();
    const shellVel = this.tank.data.shells[this.tank.currentShell].vel;
    const pos = _camPos.copy(m.pos);
    const vel = _muzzleEnd.copy(m.dir).multiplyScalar(shellVel);
    const dt = 0.045;
    let traveled = 0;
    const segDir = new THREE.Vector3();
    const segEnd = new THREE.Vector3();
    for (let i = 0; i < 90; i++) {
      vel.y -= 9.8 * dt;
      segEnd.copy(pos).addScaledVector(vel, dt);
      const segLen = pos.distanceTo(segEnd);
      segDir.copy(vel).normalize();
      // 世界（地形+建筑）
      const wh = world.raycast(pos, segDir, segLen);
      if (wh) {
        this.gunHit.point.copy(wh.point);
        this.gunHit.dist = traveled + wh.dist;
        this.gunHit.blocked = this.gunHit.dist < 60 && this.gunHit.dist < this.aimInfo.dist - 3;
        return;
      }
      // 坦克
      for (const t of battle.tanks) {
        if (t === this.tank || !t.alive) continue;
        if (t.pos.distanceTo(pos) > segLen + t.boundRadius + 1) continue;
        const hit = t.hitTest(pos, segEnd);
        if (hit) {
          this.gunHit.point.copy(hit.point);
          this.gunHit.dist = traveled + hit.point.distanceTo(pos);
          this.gunHit.blocked = false;
          return;
        }
      }
      pos.copy(segEnd);
      traveled += segLen;
      if (traveled > 2200) break;
    }
    this.gunHit.point.copy(pos);
    this.gunHit.dist = traveled;
    this.gunHit.blocked = false;
  }
}
