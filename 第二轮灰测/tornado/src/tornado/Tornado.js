/**
 * Tornado.js — 龙卷风控制器。
 *
 * 它是"唯一真相源"：着色器的形态 uniform、物理风场、水面涡流、草地压弯、建筑破坏判定
 * 全部来自这里，因此看到的漏斗和吹翻船只/掀掉屋顶的力是同一个东西。
 *
 * 风场模型（Rankine 组合涡 + 近地径向进流 + 涡壁上升气流）：
 *   v_t(r) = Vmax·(r/rc)          r ≤ rc      （核内近似刚体旋转）
 *   v_t(r) = Vmax·(rc/r)^0.72     r > rc      （核外衰减，比 1/r 慢，符合实测外流场）
 *   v_r    = -0.42·Vmax·e^(-y/h)  近地面向内辐合
 *   v_z    = 0.55·Vmax·e^(-((r-rc)/rc)²)      涡壁抬升最强
 */
import * as THREE from 'three';
import { P } from '../core/Params.js';
import { clamp, smoothstep, lerp, damp, TAU } from '../core/Random.js';

const DEG = Math.PI / 180;
const _v = new THREE.Vector3();

export class Tornado {
  constructor() {
    this.position = new THREE.Vector3(260, 0, -120);
    this.velocity = new THREE.Vector3();
    this.time = 0;
    this.groundY = 0;
    /** 场景注入：地形高度查询 */
    this.heightAt = () => 0;
    /** 场景注入：地面尘土颜色 */
    this.dustColor = new THREE.Color(0.44, 0.36, 0.27);
    this.waterMode = 0;

    this._orbitAngle = Math.PI * 0.35;
    this._lineT = 0;
    this._lineDir = new THREE.Vector2(1, 0.25).normalize();
    this._seek = null;
    this._seekTimer = 0;
    this.sceneRadius = 1800;

    this.ambientWind = new THREE.Vector3();
    this._tmp = new THREE.Vector3();
    this.refresh();
  }

  /** 参数派生量 */
  refresh() {
    this.height = P.get('t_height');
    this.baseRadius = P.get('t_baseRadius');
    this.topRadius = Math.max(P.get('t_topRadius'), this.baseRadius * 1.05);
    this.profile = P.get('t_profile');
    /** 最大切向风速 m/s：EF0≈40 → EF5≈135 */
    this.vmax = 20 + 26 * P.get('t_swirl');
    this.rc = Math.max(this.baseRadius * 0.92, 1.2);
    this.omega = this.vmax / this.rc;
    this.strength = clamp((this.vmax - 30) / 110, 0, 1.25) * (P.get('t_visible') ? 1 : 0);
    this.tiltTan = Math.tan(P.get('t_tilt') * DEG);
    this.tiltDir = new THREE.Vector2(
      Math.cos(P.get('t_tiltDir') * DEG), Math.sin(P.get('t_tiltDir') * DEG));
    this.wobble = P.get('t_wobble');
    this.wobSpeed = P.get('t_wobbleSpeed');
    this.dustHeight = P.get('t_dustHeight');
  }

  /** 与着色器 spineOffset() 完全一致（t = 0..1 的相对高度） */
  spineOffset(t, out = { x: 0, y: 0 }) {
    const T = this.time, w = this.wobble, ws = this.wobSpeed;
    out.x = this.tiltDir.x * (this.tiltTan * this.height * t)
      + Math.sin(T * ws * 1.00 + t * 3.4) * (w * 26 * t * t)
      + Math.sin(T * ws * 0.41 + t * 1.3) * (w * 44 * t);
    out.y = this.tiltDir.y * (this.tiltTan * this.height * t)
      + Math.cos(T * ws * 0.83 + t * 2.7) * (w * 26 * t * t)
      + Math.cos(T * ws * 0.37 - t * 1.1) * (w * 44 * t);
    return out;
  }

  /** 与着色器 radiusAt() 完全一致 */
  radiusAt(t) {
    t = clamp(t, 0, 1);
    const neck = 1 - 0.22 * Math.exp(-t * 26);
    let r = this.baseRadius * neck + (this.topRadius - this.baseRadius) * Math.pow(t, this.profile);
    r *= 1 + 0.06 * Math.sin(this.time * 0.37 + t * 5.1) + 0.04 * Math.sin(this.time * 0.19 - t * 2.3);
    return Math.max(r, 0.6);
  }

  /** 涡心在给定高度的世界 XZ */
  axisAt(y, out = new THREE.Vector2()) {
    const t = clamp((y - this.position.y) / this.height, 0, 1);
    const s = this.spineOffset(t, { x: 0, y: 0 });
    return out.set(this.position.x + s.x, this.position.z + s.y);
  }

  /**
   * 世界风速（m/s）。所有会被龙卷风影响的东西都调用它。
   * @param {THREE.Vector3} p
   * @param {THREE.Vector3} out
   */
  windAt(p, out = _v) {
    out.copy(this.ambientWind);
    if (this.strength <= 0.001) return out;

    const relY = p.y - this.position.y;
    const t = clamp(relY / this.height, 0, 1);
    const s = this.spineOffset(t, { x: 0, y: 0 });
    const dx = p.x - (this.position.x + s.x);
    const dz = p.z - (this.position.z + s.y);
    let r = Math.hypot(dx, dz);
    if (r < 0.05) r = 0.05;
    if (r > this.rc * 26 + 400) return out;                     // 远场只有环境风

    const R = this.radiusAt(t);
    const rc = Math.max(R * 0.92, 1.2);
    const vmax = this.vmax;

    /* 切向（与着色器视觉旋向一致：速度方向 = (dz, -dx)/r） */
    const vt = r <= rc ? vmax * (r / rc) : vmax * Math.pow(rc / r, 0.72);
    const inv = 1 / r;
    out.x += (dz * inv) * vt;
    out.z += (-dx * inv) * vt;

    /* 径向进流（近地面向内辐合） */
    const hK = Math.exp(-Math.max(relY, 0) / (this.height * 0.16));
    const vr = -vmax * 0.42 * hK * smoothstep(rc * 5, rc * 1.05, r);
    out.x += (dx * inv) * vr;
    out.z += (dz * inv) * vr;

    /* 涡壁上升气流 + 近地抽吸 */
    const q = (r - rc) / (rc * 0.95);
    const vz = vmax * 0.55 * Math.exp(-q * q) * (0.25 + 0.75 * t) + vmax * 0.16 * hK * Math.exp(-r / (rc * 3));
    out.y += vz;

    /* 风暴自身移动带走空气 */
    out.x += this.velocity.x * 0.85;
    out.z += this.velocity.z * 0.85;
    return out;
  }

  /** 动压 q = ½ρv²（Pa），用于结构破坏判定 */
  pressureAt(p) {
    const w = this.windAt(p, this._tmp);
    const v = w.length();
    return 0.5 * 1.225 * v * v;
  }

  /** 到涡心轴线的水平距离 */
  distanceTo(p) {
    const a = this.axisAt(p.y, new THREE.Vector2());
    return Math.hypot(p.x - a.x, p.z - a.y);
  }

  /** 让龙卷风扑向某点 */
  strike(x, z, hold = 26) {
    this._seek = new THREE.Vector2(x, z);
    this._seekTimer = hold;
  }

  update(dt, engineTime) {
    this.time = engineTime;
    this.refresh();

    /* ---- 环境风（与海面风一致） ---- */
    const wd = P.get('w_windDir') * DEG;
    const ws = P.get('w_windSpeed');
    this.ambientWind.set(Math.cos(wd) * ws, 0, Math.sin(wd) * ws).multiplyScalar(0.55);

    /* ---- 路径 ---- */
    const spd = P.get('t_speed');
    const mode = P.get('t_pathMode');
    const prevX = this.position.x, prevZ = this.position.z;

    if (this._seekTimer > 0 && this._seek) {
      this._seekTimer -= dt;
      const dx = this._seek.x - this.position.x, dz = this._seek.y - this.position.z;
      const d = Math.hypot(dx, dz);
      const v = Math.max(spd, 14);
      if (d > 4) {
        this.position.x += (dx / d) * v * dt;
        this.position.z += (dz / d) * v * dt;
      }
      if (this._seekTimer <= 0) {
        this._seek = null;
        // 回到轨道时保持相位连续
        this._orbitAngle = Math.atan2(this.position.z, this.position.x);
      }
    } else if (mode === 'orbit') {
      const R = Math.max(P.get('t_pathRadius'), 30);
      this._orbitAngle += (spd / R) * dt;
      this.position.x = Math.cos(this._orbitAngle) * R;
      this.position.z = Math.sin(this._orbitAngle) * R;
    } else if (mode === 'line') {
      this._lineT += spd * dt;
      const half = this.sceneRadius;
      const s = ((this._lineT % (half * 2)) + half * 2) % (half * 2) - half;
      this.position.x = this._lineDir.x * s - this._lineDir.y * 90;
      this.position.z = this._lineDir.y * s + this._lineDir.x * 90;
    } else {
      const R = P.get('t_pathRadius');
      // 定点：缓慢趋近到设定半径处，避免参数切换时跳变
      const a = Math.atan2(this.position.z, this.position.x);
      this.position.x = damp(this.position.x, Math.cos(a) * R, 1.2, dt);
      this.position.z = damp(this.position.z, Math.sin(a) * R, 1.2, dt);
    }

    /* 贴地 */
    this.groundY = this.heightAt(this.position.x, this.position.z);
    this.position.y = this.groundY;

    if (dt > 1e-5) {
      this.velocity.set((this.position.x - prevX) / dt, 0, (this.position.z - prevZ) / dt);
      if (this.velocity.lengthSq() > 4000) this.velocity.setLength(60);
    }
    return this;
  }

  /** 把形态参数写进体积着色器 */
  syncUniforms(u) {
    u.uPos.value.copy(this.position);
    u.uHeight.value = this.height;
    u.uBaseR.value = this.baseRadius;
    u.uTopR.value = this.topRadius;
    u.uProfile.value = this.profile;
    u.uHollow.value = P.get('t_hollow');
    u.uWall.value = P.get('t_wall');
    u.uTiltDir.value.copy(this.tiltDir);
    u.uTilt.value = this.tiltTan;
    u.uWobble.value = this.wobble;
    u.uWobSpeed.value = this.wobSpeed;
    u.uOmega.value = this.omega;
    u.uDiff.value = P.get('t_diff');
    u.uHelix.value = 0.0035 + 0.004 * P.get('t_diff');
    u.uUpdraft.value = P.get('t_updraft');
    u.uTurb.value = P.get('t_turb');
    u.uTurbScale.value = P.get('t_turbScale');
    u.uMulti.value = P.get('t_multi');
    u.uSubOrbit.value = this.omega * 0.22;
    u.uDensity.value = P.get('t_density') * (P.get('t_visible') ? 1 : 0);
    u.uBright.value = P.get('t_bright');
    u.uAmbientK.value = P.get('t_ambient');
    u.uScatterG.value = P.get('t_scatterG');
    u.uCondense.value = P.get('t_condense');
    u.uDust.value = P.get('t_dust');
    u.uDustHeight.value = this.dustHeight;
    u.uDustColor.value.copy(this.dustColor);
    u.uWaterMode.value = this.waterMode;
    u.uJitter.value = 1.0;

    /* 包围体：涡柱 + 摆动 + 尘裙 + 云底盘，取最大水平范围 */
    const s = this.spineOffset(1, { x: 0, y: 0 });
    const sway = Math.hypot(s.x, s.y);
    const skirt = this.baseRadius * 1.7 + this.dustHeight * 3.2 * 1.15;
    const plate = this.topRadius * 2.3;
    u.uBoundC.value.set(this.position.x + s.x * 0.5, this.position.z + s.y * 0.5);
    u.uBoundR.value = Math.max(plate, skirt, this.topRadius * 1.3) + sway * 0.6 + 40;
  }
}
