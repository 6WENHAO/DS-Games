/**
 * 飞行模型：四元数姿态 + 惯性漂移 + 引力 + 碰撞 + 曲速。
 * 手感目标：像“重型截击舰”——有质量感但反应利落，
 * 松杆会保留惯性漂移（太空没有空气阻力），加力时抓地力提升。
 */
import * as THREE from 'three';
import { clamp, clamp01, damp, lerp } from '../util/math.js';

const MAX_SPEED = 620;      // 巡航极速 (units/s)
const BOOST_MUL = 2.9;      // 加力倍率
const WARP_MUL = 22;        // 曲速倍率
const PITCH_RATE = 1.15;
const YAW_RATE = 0.85;
const ROLL_RATE = 2.1;

export class FlightModel {
  constructor(ship, { bodies = [], blackHole = null, sunRadius = 3100 } = {}) {
    this.ship = ship;
    this.bodies = bodies;
    this.blackHole = blackHole;
    this.sunRadius = sunRadius;

    this.position = ship.group.position;
    this.quaternion = ship.group.quaternion;
    this.velocity = new THREE.Vector3();
    this.angular = new THREE.Vector3();     // 局部角速度 (pitch, yaw, roll)
    this.throttle = 0.28;
    this.boost = 0;
    this.warp = 0;
    this.energy = 100;
    this.hull = 100;
    this.speed = 0;
    this.gForce = 0;
    this.warnings = [];
    this.status = 'ok';
    this.statusTime = 0;
    this.events = [];

    this._grav = new THREE.Vector3();
    this._fwd = new THREE.Vector3();
    this._tmpQ = new THREE.Quaternion();
    this._tmpV = new THREE.Vector3();
    this._desired = new THREE.Vector3();
    this._prevVel = new THREE.Vector3();
    this._spawn = { pos: new THREE.Vector3(), quat: new THREE.Quaternion() };
  }

  setSpawn(pos, lookAt) {
    this._spawn.pos.copy(pos);
    const m = new THREE.Matrix4().lookAt(pos, lookAt, new THREE.Vector3(0, 1, 0));
    this._spawn.quat.setFromRotationMatrix(m);
    this.respawn(false);
  }

  /**
   * 以天体为参照的出生姿态：相机位于天体的“向阳侧”（太阳在身后），
   * 机头指向切向开阔空域，星球位于视野一侧 ——
   * 既能看到被照亮的星球全貌，又不会一推油门就撞上去。
   */
  setSpawnNear(body, { dist = 1200, height = 220, offset = 0.62 } = {}) {
    const up = new THREE.Vector3(0, 1, 0);
    const radial = body.position.clone().normalize();   // 太阳 → 天体
    if (radial.lengthSq() < 1e-6) radial.set(1, 0, 0);
    const tangent = new THREE.Vector3().crossVectors(up, radial).normalize();
    const pos = body.position.clone()
      .addScaledVector(tangent, -dist * 0.72)
      .addScaledVector(radial, -dist * 0.62)          // 向阳侧
      .addScaledVector(up, height);
    const toBody = body.position.clone().sub(pos).normalize();
    const side = new THREE.Vector3().crossVectors(toBody, up).normalize();
    const look = pos.clone()
      .addScaledVector(toBody, dist)
      .addScaledVector(side, dist * offset)
      .addScaledVector(up, dist * 0.08);
    this.setSpawn(pos, look);
  }

  respawn(announce = true) {
    this.position.copy(this._spawn.pos);
    this.quaternion.copy(this._spawn.quat);
    this.velocity.set(0, 0, 0);
    this.angular.set(0, 0, 0);
    this.throttle = 0.2;
    this.boost = 0;
    this.warp = 0;
    this.energy = 100;
    this.hull = 100;
    if (announce) this.events.push({ type: 'respawn', text: '紧急跃迁完成 · 舰体已修复' });
  }

  get forward() {
    return this._fwd.set(0, 0, -1).applyQuaternion(this.quaternion);
  }

  update(dt, input) {
    const ship = this.ship;
    this.warnings.length = 0;

    /* ---------------- 姿态 ---------------- */
    const boostReq = input.boost && this.energy > 1;
    const warpReq = input.warp && this.energy > 6 && this.throttle > 0.15;
    this.boost = damp(this.boost, boostReq ? 1 : 0, 4.5, dt);
    this.warp = damp(this.warp, warpReq ? 1 : 0, warpReq ? 2.2 : 3.0, dt);

    // 曲速/加力时操控变钝（更有重量感）
    const agility = lerp(1, 0.42, this.warp) * lerp(1, 0.82, this.boost);
    const tp = clamp(input.pitch, -1, 1) * PITCH_RATE * agility;
    const ty = clamp(input.yaw, -1, 1) * YAW_RATE * agility;
    const tr = clamp(input.roll, -1, 1) * ROLL_RATE * agility;
    // 转向时自动配合一点滚转，飞起来更“帅”
    const autoRoll = -ty * 0.55 * (1 - Math.abs(input.roll));

    this.angular.x = damp(this.angular.x, tp, 5.5, dt);
    this.angular.y = damp(this.angular.y, ty, 5.0, dt);
    this.angular.z = damp(this.angular.z, tr + autoRoll, 4.5, dt);

    if (Math.abs(this.angular.x) + Math.abs(this.angular.y) + Math.abs(this.angular.z) > 1e-5) {
      const e = new THREE.Euler(this.angular.x * dt, this.angular.y * dt, this.angular.z * dt, 'XYZ');
      this._tmpQ.setFromEuler(e);
      this.quaternion.multiply(this._tmpQ).normalize();
    }

    // 对准目标（辅助驾驶）
    if (input.align && input.alignTarget) {
      const m = new THREE.Matrix4().lookAt(this.position, input.alignTarget, this._tmpV.set(0, 1, 0));
      this._tmpQ.setFromRotationMatrix(m);
      this.quaternion.slerp(this._tmpQ, clamp01(dt * 1.8));
    }

    /* ---------------- 油门 ---------------- */
    if (input.throttleAbs != null) {
      this.throttle = clamp01(input.throttleAbs);
    } else if (input.throttleDelta) {
      this.throttle = clamp01(this.throttle + input.throttleDelta * dt * 1.15);
    }
    if (input.brake) this.throttle = damp(this.throttle, 0, 6, dt);

    /* ---------------- 能量 ---------------- */
    // 加力 ≈ 9s / 曲速 ≈ 8s（满槽），停用后约 8s 充满
    const drain = this.boost * 11 + this.warp * 12;
    this.energy = clamp(this.energy - drain * dt + (drain < 1 ? 13 * dt : 0), 0, 100);
    if (this.energy <= 0.5) { this.boost *= 0.5; this.warp *= 0.5; }

    /* ---------------- 线速度 ---------------- */
    const target = MAX_SPEED * this.throttle
      * (1 + this.boost * (BOOST_MUL - 1))
      * (1 + this.warp * (WARP_MUL - 1));
    this._desired.copy(this.forward).multiplyScalar(target);
    // 抓地力：加力时更贴合指向，松油门时保留惯性
    const grip = lerp(1.5, 4.5, this.boost * 0.6 + this.warp * 0.4) * (input.brake ? 2.4 : 1);
    this._prevVel.copy(this.velocity);
    this.velocity.x = damp(this.velocity.x, this._desired.x, grip, dt);
    this.velocity.y = damp(this.velocity.y, this._desired.y, grip, dt);
    this.velocity.z = damp(this.velocity.z, this._desired.z, grip, dt);

    /* ---------------- 引力 ---------------- */
    this._grav.set(0, 0, 0);
    let bhDanger = 0;
    if (this.blackHole) {
      this.blackHole.addGravity(this.position, this._grav);
      bhDanger = this.blackHole.dangerLevel(this.position);
      if (bhDanger > 0.08) {
        this.warnings.push({
          key: 'bh', level: bhDanger,
          text: bhDanger > 0.62 ? '⚠ 引力井临界！立即全功率脱离' : '⚠ 检测到强引力场',
        });
      }
      if (this.blackHole.isConsumed(this.position)) {
        this.events.push({ type: 'death', text: '舰体被事件视界吞没 —— 执行紧急跃迁' });
        this.respawn();
        return;
      }
    }
    this.velocity.addScaledVector(this._grav, dt);

    /* ---------------- 位移 ---------------- */
    this.position.addScaledVector(this.velocity, dt);
    this.speed = this.velocity.length();
    this.gForce = this._tmpV.copy(this.velocity).sub(this._prevVel).length() / Math.max(dt, 1e-4) / 9.8;

    /* ---------------- 碰撞 / 高温 ---------------- */
    for (const b of this.bodies) {
      const d = this.position.distanceTo(b.position);
      const rr = b.radius + ship.radius * 1.1;
      if (b.key === 'sun') {
        const heat = clamp01((this.sunRadius * 4.2 - d) / (this.sunRadius * 3.0));
        if (heat > 0.05) {
          this.hull = clamp(this.hull - heat * heat * 26 * dt, 0, 100);
          this.warnings.push({
            key: 'heat', level: heat,
            text: heat > 0.6 ? '⚠ 舰体过热！立刻远离恒星' : '⚠ 恒星辐射升温',
          });
          if (heat > 0.25) ship.flashShield(dt * heat * 2.2);
        }
        if (this.hull <= 0) {
          this.events.push({ type: 'death', text: '舰体在恒星风中解体 —— 执行紧急跃迁' });
          this.respawn();
          return;
        }
      }
      if (d < rr) {
        // 软碰撞：推出表面，法向反弹 + 切向滑移（避免“黏”在星球上）
        this._tmpV.copy(this.position).sub(b.position).normalize();
        this.position.copy(b.position).addScaledVector(this._tmpV, rr + 0.5);
        const vn = this.velocity.dot(this._tmpV);
        if (vn < 0) {
          // v = v_t * 0.92 - v_n * 0.35
          this.velocity.addScaledVector(this._tmpV, -vn);      // 去掉法向分量
          this.velocity.multiplyScalar(0.92);                  // 切向摩擦
          this.velocity.addScaledVector(this._tmpV, -vn * 0.35); // 弹起
        }
        const impact = clamp01(Math.abs(vn) / 260);
        if (impact > 0.04) {
          this.hull = clamp(this.hull - impact * 16, 0, 100);
          ship.flashShield(0.6 + impact);
          this.warnings.push({ key: 'impact', level: 1, text: '⚠ 舰体撞击！护盾吸收冲击' });
        } else {
          ship.flashShield(dt * 2);
          this.warnings.push({ key: 'graze', level: 0.35, text: '⚠ 贴近星体表面 · 请拉起' });
        }
      }
    }

    // 舰体缓慢自修复
    this.hull = clamp(this.hull + dt * 1.4, 0, 100);

    /* ---------------- 驱动模型动画 ---------------- */
    ship.update(dt, {
      throttle: this.throttle,
      boost: this.boost,
      warp: this.warp,
      pitch: this.angular.x / PITCH_RATE,
      yaw: this.angular.y / YAW_RATE,
    });

    this.bhDanger = bhDanger;
  }

  /** 供 HUD 使用的瞬时数据 */
  telemetry() {
    return {
      speed: this.speed,
      throttle: this.throttle,
      boost: this.boost,
      warp: this.warp,
      energy: this.energy,
      hull: this.hull,
      warnings: this.warnings,
      bhDanger: this.bhDanger ?? 0,
    };
  }
}
