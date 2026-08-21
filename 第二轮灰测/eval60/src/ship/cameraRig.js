/**
 * 相机架：三种视角（追尾 / 座舱 / 电影环绕），带弹性跟随、
 * 速度引起的视场变化、加力与引力抖动。
 */
import * as THREE from 'three';
import { clamp01, damp, lerp } from '../util/math.js';

const MODES = ['chase', 'cockpit', 'cine'];

export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.mode = 'chase';
    this.baseFov = 62;
    this._pos = new THREE.Vector3();
    this._quat = new THREE.Quaternion();
    this._targetPos = new THREE.Vector3();
    this._lookAt = new THREE.Vector3();
    this._up = new THREE.Vector3();
    this._offset = new THREE.Vector3();
    this._m = new THREE.Matrix4();
    this._shake = new THREE.Vector3();
    this._t = 0;
    this._fov = this.baseFov;
    this._init = false;
    this.freeLook = { x: 0, y: 0 };
  }

  cycle() {
    const i = MODES.indexOf(this.mode);
    this.mode = MODES[(i + 1) % MODES.length];
    return this.mode;
  }

  setMode(m) {
    if (MODES.includes(m)) this.mode = m;
  }

  update(dt, flight, ship, extra = {}) {
    this._t += dt;
    const shipPos = flight.position;
    const q = flight.quaternion;
    const speedK = clamp01(flight.speed / 900);
    const warp = flight.warp;
    const boost = flight.boost;

    // 目标位置与朝向
    if (this.mode === 'cockpit') {
      // 飞行员眼位：座椅之前、仪表台之后（离仪表台约 1.1 单位，避免过曝糊屏）
      this._offset.set(0, 1.28, -4.05).applyQuaternion(q);
      this._targetPos.copy(shipPos).add(this._offset);
      this._lookAt.copy(shipPos).add(
        this._up.set(0, 0.9, -60).applyQuaternion(q),
      );
      this._up.set(0, 1, 0).applyQuaternion(q);
      this.camera.near = 0.22;
    } else if (this.mode === 'cine') {
      const a = this._t * 0.22;
      const r = 34 + Math.sin(this._t * 0.14) * 7;
      this._offset.set(Math.cos(a) * r, 7 + Math.sin(a * 0.7) * 5, Math.sin(a) * r);
      this._targetPos.copy(shipPos).add(this._offset);
      this._lookAt.copy(shipPos);
      this._up.set(0, 1, 0);
      this.camera.near = 0.6;
    } else {
      const back = lerp(26, 33, speedK) + warp * 12;
      const up = lerp(3.4, 4.6, speedK);
      this._offset.set(this.freeLook.x * 16, up + this.freeLook.y * 8, back).applyQuaternion(q);
      this._targetPos.copy(shipPos).add(this._offset);
      this._lookAt.copy(shipPos).add(
        this._up.set(0, 0.6, -44 - speedK * 40).applyQuaternion(q),
      );
      // 跟随 85% 的滚转，保留一点“世界水平”参考
      this._up.set(0, 1, 0).applyQuaternion(q).lerp(new THREE.Vector3(0, 1, 0), 0.15).normalize();
      this.camera.near = 0.6;
    }

    if (!this._init) {
      this._pos.copy(this._targetPos);
      this._init = true;
    }

    // 弹性跟随：速度越高越贴身，避免被甩掉
    const lambda = this.mode === 'cockpit' ? 60 : lerp(4.5, 11, speedK) + warp * 8;
    this._pos.x = damp(this._pos.x, this._targetPos.x, lambda, dt);
    this._pos.y = damp(this._pos.y, this._targetPos.y, lambda, dt);
    this._pos.z = damp(this._pos.z, this._targetPos.z, lambda, dt);

    this._m.lookAt(this._pos, this._lookAt, this._up);
    this._quat.setFromRotationMatrix(this._m);

    // 抖动：加力 / 曲速 / 引力潮汐 / 撞击
    const shakeAmp =
      boost * 0.11 + warp * 0.5 + (extra.bhDanger ?? 0) * 1.6 + (extra.impact ?? 0) * 2.2;
    if (shakeAmp > 0.001) {
      const t = this._t * 42;
      this._shake.set(
        Math.sin(t * 1.7) * 0.6 + Math.sin(t * 3.1) * 0.4,
        Math.cos(t * 2.3) * 0.6 + Math.sin(t * 4.7) * 0.4,
        Math.sin(t * 1.1) * 0.3,
      ).multiplyScalar(shakeAmp);
      this._pos.add(this._shake);
    }

    this.camera.position.copy(this._pos);
    this.camera.quaternion.copy(this._quat);

    // 视场：速度感 + 曲速拉伸
    const targetFov = this.baseFov + speedK * 9 + warp * 26 + boost * 4;
    this._fov = damp(this._fov, targetFov, 3.5, dt);
    if (Math.abs(this.camera.fov - this._fov) > 0.01 || this.camera.near !== this._near) {
      this.camera.fov = this._fov;
      this._near = this.camera.near;
      this.camera.updateProjectionMatrix();
    }
  }
}
