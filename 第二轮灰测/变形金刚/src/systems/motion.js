/**
 * motion.js —— 行走 / 驾驶 / 拖挂运动学
 *
 *  尺度约定：1 单位 ≈ 1.7 m（机体 5 单位 ≈ 8.5 m 高，卡车 4.1 单位 ≈ 7 m 长）
 *  载具态用自行车模型转向（heading += v/L·tanδ），行走态原地转向。
 */
import * as THREE from 'three';

export const UNIT_M = 1.7;                 // 每单位米数
export const KMH = UNIT_M * 3.6;           // 单位/秒 → km/h

export class Motion {
  constructor(rig, tf, anim) {
    this.rig = rig;
    this.tf = tf;
    this.anim = anim;
    this.enabled = true;
    this.keys = new Set();

    this.speed = 0;
    this.heading = 0;
    this.steerAngle = 0;
    this.accelN = 0;
    this.steerN = 0;

    /* 可调参数 */
    this.maxDrive = 14;
    this.maxWalk = 3.4;
    this.accelRate = 9;
    this.brakeRate = 16;
    this.dragRate = 2.4;
    this.turnRate = 1.9;       // 行走原地转向 rad/s
    this.steerMax = 0.55;      // 前轮最大转角 rad
    this.wheelBase = 2.0;
    this.boost = 1.9;
    this.arenaR = 54;

    this.trailer = null;
    this.trailerOn = false;
    this._hitchLocal = new THREE.Vector3(0, 0, -3.05);
    this._v = new THREE.Vector3();
    this._w = new THREE.Vector3();
  }

  attachTrailer(t) { this.trailer = t; this.snapTrailer(); }

  get throttleInput() {
    const k = this.keys;
    return (k.has('w') || k.has('arrowup') ? 1 : 0) - (k.has('s') || k.has('arrowdown') ? 1 : 0);
  }
  get steerInput() {
    const k = this.keys;
    return (k.has('a') || k.has('arrowleft') ? 1 : 0) - (k.has('d') || k.has('arrowright') ? 1 : 0);
  }

  reset() {
    this.speed = 0; this.heading = 0; this.steerAngle = 0;
    this.rig.root.position.set(0, 0, 0);
    this.rig.root.rotation.y = 0;
    this.snapTrailer();
  }

  update(dt) {
    const morph = this.tf.mode === 'morph';
    const veh = this.tf.vehicleW > 0.85;
    const thr = this.enabled && !morph ? this.throttleInput : 0;
    const str = this.enabled && !morph ? this.steerInput : 0;
    const fast = this.keys.has('shift');
    const vmax = (veh ? this.maxDrive : this.maxWalk) * (fast ? this.boost : 1);

    /* ---- 纵向 ---- */
    if (morph) {
      this.speed *= Math.max(0, 1 - dt * 6);
    } else if (thr > 0) {
      this.speed += this.accelRate * (veh ? 1 : 0.8) * dt;
    } else if (thr < 0) {
      this.speed -= (this.speed > 0.2 ? this.brakeRate : this.accelRate * 0.55) * dt;
    } else {
      this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), this.dragRate * dt);
    }
    const vmin = veh ? -vmax * 0.35 : -vmax * 0.5;
    this.speed = Math.max(vmin, Math.min(vmax, this.speed));
    const sN = Math.min(1, Math.abs(this.speed) / (veh ? this.maxDrive : this.maxWalk));

    /* ---- 转向 ---- */
    const tgtSteer = str * this.steerMax * (veh ? (1 - sN * 0.45) : 1);
    this.steerAngle += (tgtSteer - this.steerAngle) * Math.min(1, dt * 9);
    if (veh) {
      if (Math.abs(this.speed) > 0.02) {
        this.heading += (this.speed / this.wheelBase) * Math.tan(this.steerAngle) * dt;
      }
    } else if (!morph) {
      this.heading += this.steerAngle / this.steerMax * this.turnRate * dt * (this.speed >= 0 ? 1 : -1) *
        (Math.abs(this.speed) > 0.05 ? 1 : 0.55);
    }

    /* ---- 位移 ---- */
    const root = this.rig.root;
    root.rotation.y = this.heading;
    const fwd = this._v.set(Math.sin(this.heading), 0, Math.cos(this.heading));
    root.position.addScaledVector(fwd, this.speed * dt);
    const r = Math.hypot(root.position.x, root.position.z);
    if (r > this.arenaR) {
      root.position.multiplyScalar(this.arenaR / r);
      this.speed *= 0.3;
    }

    /* ---- 车轮：滚动 + 前轮转向 ---- */
    const spin = (this.speed / this.rig.D.wheelR) * dt;
    for (const w of this.rig.wheels) w.rotation.x += spin;
    for (const s of this.rig.steer) s.rotation.y += this.steerAngle * (veh ? 1 : 0.25);

    /* ---- 平滑给动画层用的信号 ---- */
    this.accelN += ((thr || (this.speed !== 0 ? -Math.sign(this.speed) * 0.15 : 0)) - this.accelN) * Math.min(1, dt * 5);
    this.steerN += (this.steerAngle / this.steerMax - this.steerN) * Math.min(1, dt * 6);

    /* ---- 拖挂 ---- */
    if (this.trailer && this.trailer.visible) this._updateTrailer(dt, veh);

    return {
      moving: Math.abs(this.speed) > 0.08 && !morph,
      speed: this.speed,
      speedNorm: sN,
      gaitOmega: Math.max(1.2, Math.abs(this.speed) * 2.6) * Math.sign(this.speed || 1),
      accelN: this.accelN,
      steerN: this.steerN,
      kmh: Math.abs(this.speed) * KMH,
    };
  }

  /** 挂车运动学：牵引销跟随 + 后桥拖拽定向 */
  _updateTrailer(dt, veh) {
    const tr = this.trailer;
    const hitch = this._w.copy(this._hitchLocal);
    this.rig.root.localToWorld(hitch);
    if (!veh) return;                       // 机器人态：挂车原地停放

    const axle = tr.localToWorld(new THREE.Vector3(0, 0, tr.userData.axleZ));
    const dx = hitch.x - axle.x, dz = hitch.z - axle.z;
    const len = Math.hypot(dx, dz) || 1;
    tr.rotation.y = Math.atan2(dx / len, dz / len);
    tr.position.set(hitch.x, 0, hitch.z);
    const spin = (this.speed / 0.42) * dt;
    for (const w of tr.userData.wheels) w.rotation.x += spin;
  }

  snapTrailer() {
    const tr = this.trailer;
    if (!tr) return;
    const hitch = this._w.copy(this._hitchLocal);
    this.rig.root.localToWorld(hitch);
    tr.position.set(hitch.x, 0, hitch.z);
    tr.rotation.y = this.heading;
  }
}
