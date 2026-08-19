/**
 * MiniPhysics.js — 轻量刚体：碎片翻滚 + 船只多点浮力。
 *
 * Body        盒状碎片：重力 + 气动阻力（F = ½ρCdA|v|v）+ 涡旋风场 + 地面碰撞与休眠
 * FloatingBody 船只：四元数姿态 + 对角惯量张量 + 多点浮力/水阻/风压力矩 → 会真的被掀翻
 */
import * as THREE from 'three';
import { clamp } from './Random.js';

const RHO_AIR = 1.225;
const RHO_WATER = 1025;
const G = 9.81;

const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
const _f1 = new THREE.Vector3(), _f2 = new THREE.Vector3(), _f3 = new THREE.Vector3();
const _f4 = new THREE.Vector3(), _f5 = new THREE.Vector3();
const _q1 = new THREE.Quaternion();

let _uid = 1;

export class Body {
  /**
   * @param {object} o
   * @param {THREE.Vector3} o.pos  @param {THREE.Vector3} [o.vel]
   * @param {THREE.Vector3} o.size 半尺寸
   * @param {number} [o.mass] @param {number} [o.cd] @param {number} [o.kind] 实例几何索引
   */
  constructor(o) {
    this.id = _uid++;
    this.pos = o.pos.clone();
    this.vel = (o.vel || _v1.set(0, 0, 0)).clone();
    this.size = o.size.clone();
    this.quat = new THREE.Quaternion();
    if (o.quat) this.quat.copy(o.quat);
    this.spin = new THREE.Vector3(
      (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2);
    const vol = 8 * this.size.x * this.size.y * this.size.z;
    this.mass = o.mass ?? Math.max(vol * (o.density ?? 420), 0.4);
    /* 迎风面积取中等截面 */
    const s = this.size;
    this.area = 4 * (s.x * s.y + s.y * s.z + s.x * s.z) / 3;
    this.cd = o.cd ?? 1.25;
    this.kind = o.kind ?? 0;
    this.color = o.color ?? new THREE.Color(0.6, 0.55, 0.5);
    this.restitution = o.restitution ?? 0.24;
    this.friction = o.friction ?? 0.55;
    this.sleep = false;
    this.settleT = 0;
    this.life = o.life ?? 0;   // >0 时到期回收
    this.age = 0;
    this.inWater = false;
    this.buoyant = o.buoyant ?? false;
  }
  get aero() { return 0.5 * RHO_AIR * this.cd * this.area / this.mass; }
}

export class FloatingBody {
  /**
   * @param {object} o
   * @param {THREE.Vector3} o.size    船体半尺寸（x=半宽, y=半高, z=半长）
   * @param {number} o.mass
   * @param {Array<THREE.Vector3>} o.points 局部浮力采样点（船底轮廓）
   * @param {number} [o.sailArea]     水线以上受风面积
   * @param {THREE.Vector3} [o.sailCenter] 受风面积形心（局部）
   */
  constructor(o) {
    this.id = _uid++;
    this.pos = o.pos.clone();
    this.vel = new THREE.Vector3();
    this.quat = new THREE.Quaternion();
    if (o.quat) this.quat.copy(o.quat);
    this.omega = new THREE.Vector3();
    this.size = o.size.clone();
    this.mass = o.mass;
    this.points = o.points;
    /* 每个采样点代表的排水体积（总排水量 ≈ 质量/水密度，静浮时吃水约 55%） */
    this.pointVol = (this.mass / RHO_WATER) / this.points.length * 2.0;
    this.pointRadius = o.pointRadius ?? Math.min(this.size.x, this.size.y) * 1.15;
    const s = this.size, m = this.mass;
    /* 长方体对角惯量 */
    this.I = new THREE.Vector3(
      m / 3 * (s.y * s.y + s.z * s.z),
      m / 3 * (s.x * s.x + s.z * s.z),
      m / 3 * (s.x * s.x + s.y * s.y),
    );
    this.sailArea = o.sailArea ?? (4 * s.x * s.y);
    this.sailCenter = (o.sailCenter || new THREE.Vector3(0, s.y * 1.2, 0)).clone();
    this.cdWater = o.cdWater ?? 1.1;
    this.capsized = false;
    this.capsizeT = 0;
    this.sunk = 0;
    this.wake = 0;
    this.selfDrive = o.selfDrive ?? 0;    // 自航速度 m/s
    this.heading = o.heading ?? 0;
    this.hullArea = 4 * s.x * s.z;
    this.name = o.name || 'boat';
  }

  /** 世界上向量（判断是否倾覆） */
  upDot() {
    return _v1.set(0, 1, 0).applyQuaternion(this.quat).y;
  }
}

export class PhysicsWorld {
  constructor() {
    /** @type {Body[]} */
    this.bodies = [];
    /** @type {FloatingBody[]} */
    this.floaters = [];
    this.groundAt = () => 0;
    this.waterAt = null;            // (x,z) => 水面高度；为空表示无水
    this.waterVelAt = null;         // (x,z,out) => 水面流速
    this.tornado = null;
    this.maxBodies = 900;
    this.sleeping = 0;
  }

  add(body) {
    this.bodies.push(body);
    if (this.bodies.length > this.maxBodies) {
      /* 优先回收已休眠的最老碎片 */
      let idx = this.bodies.findIndex((b) => b.sleep);
      if (idx < 0) idx = 0;
      this.bodies.splice(idx, 1);
    }
    return body;
  }
  addFloater(f) { this.floaters.push(f); return f; }
  clear() { this.bodies.length = 0; this.floaters.length = 0; }

  windAt(p, out) {
    if (this.tornado) return this.tornado.windAt(p, out);
    return out.set(0, 0, 0);
  }

  step(dt) {
    dt = clamp(dt, 0, 1 / 25);
    this._stepBodies(dt);
    this._stepFloaters(dt);
  }

  _stepBodies(dt) {
    const bodies = this.bodies;
    let sleeping = 0;
    for (let i = bodies.length - 1; i >= 0; i--) {
      const b = bodies[i];
      b.age += dt;
      if (b.life > 0 && b.age > b.life) { bodies.splice(i, 1); continue; }
      if (b.sleep) {
        sleeping++;
        /* 休眠碎片如果重新进入强风区就唤醒 */
        if (this.tornado) {
          const w = this.windAt(b.pos, _v1);
          if (w.lengthSq() > 900) { b.sleep = false; }
        }
        continue;
      }

      const w = this.windAt(b.pos, _v1);
      /* 气动力：相对风速的平方阻力 */
      _v2.copy(w).sub(b.vel);
      const rel = _v2.length();
      const k = b.aero * rel;
      b.vel.addScaledVector(_v2, Math.min(k * dt, 0.85));
      b.vel.y -= G * dt;

      /* 水中：浮力 + 强阻尼（海面碎片漂浮） */
      const wh = this.waterAt ? this.waterAt(b.pos.x, b.pos.z) : -1e9;
      b.inWater = b.pos.y - b.size.y < wh;
      if (b.inWater) {
        const sub = clamp((wh - (b.pos.y - b.size.y)) / (2 * b.size.y), 0, 1);
        const vol = 8 * b.size.x * b.size.y * b.size.z * sub;
        const fb = (RHO_WATER * vol * G) / b.mass * (b.buoyant ? 1 : 0.75);
        b.vel.y += fb * dt;
        b.vel.multiplyScalar(1 - Math.min(0.9, 2.6 * dt));
        b.spin.multiplyScalar(1 - Math.min(0.9, 3.0 * dt));
      }

      b.pos.addScaledVector(b.vel, dt);

      /* 翻滚：风切变驱动 + 阻尼 */
      const tumble = Math.min(rel * 0.012, 2.4);
      b.spin.x += (Math.random() - 0.5) * tumble * dt * 6;
      b.spin.y += (Math.random() - 0.5) * tumble * dt * 6;
      b.spin.z += (Math.random() - 0.5) * tumble * dt * 6;
      b.spin.multiplyScalar(1 - Math.min(0.6, 0.35 * dt));
      const sl = b.spin.length();
      if (sl > 1e-4) {
        _q1.setFromAxisAngle(_v3.copy(b.spin).multiplyScalar(1 / sl), sl * dt);
        b.quat.premultiply(_q1).normalize();
      }

      /* 地面碰撞 */
      const gh = this.groundAt(b.pos.x, b.pos.z);
      const floor = Math.max(gh, b.inWater ? -1e9 : -1e9);
      const rest = floor + b.size.y * 0.85;
      if (b.pos.y < rest) {
        b.pos.y = rest;
        if (b.vel.y < 0) {
          const impact = -b.vel.y;
          b.vel.y = impact * b.restitution;
          b.vel.x *= 1 - b.friction;
          b.vel.z *= 1 - b.friction;
          b.spin.multiplyScalar(0.55);
          if (impact < 1.4) b.settleT += dt + 0.05;
        }
        b.settleT += dt;
        const speed = b.vel.length();
        if (speed < 0.55 && b.settleT > 0.55) {
          b.sleep = true;
          b.vel.set(0, 0, 0);
          b.spin.set(0, 0, 0);
          /* 落地后躺平一点，避免半嵌入地面 */
          b.pos.y = rest;
        }
      } else if (b.pos.y > rest + 1.5) {
        b.settleT = 0;
      }
      /* 飞太高/太远的碎片回收 */
      if (b.pos.y > 3000 || Math.abs(b.pos.x) > 9000 || Math.abs(b.pos.z) > 9000) {
        bodies.splice(i, 1);
      }
    }
    this.sleeping = sleeping;
  }

  _stepFloaters(dt) {
    if (!this.waterAt) return;
    const sub = 2;
    const h = dt / sub;
    for (const f of this.floaters) {
      for (let s = 0; s < sub; s++) this._stepFloater(f, h);
    }
  }

  _stepFloater(f, dt) {
    const force = _f1.set(0, -G * f.mass, 0);
    const torque = _f2.set(0, 0, 0);
    const pw = _f3;

    /* --- 多点浮力 + 水阻 --- */
    let submerged = 0;
    const n = f.points.length;
    for (let i = 0; i < n; i++) {
      const lp = f.points[i];
      pw.copy(lp).applyQuaternion(f.quat).add(f.pos);
      const wh = this.waterAt(pw.x, pw.z);
      const depth = wh - pw.y;
      if (depth <= -f.pointRadius) continue;
      const frac = clamp((depth + f.pointRadius) / (2 * f.pointRadius), 0, 1);
      submerged += frac / n;

      const rx = pw.x - f.pos.x, ry = pw.y - f.pos.y, rz = pw.z - f.pos.z;

      /* 浮力（+y）施加在采样点上：τ = r × (0, fb, 0) = (rz·fb, 0, -rx·fb)
         这正是复原力矩的来源，船倾斜时浸没侧浮力更大 → 会自己扶正；
         被涡旋抬起一侧时复原力矩不足 → 翻覆。 */
      const fb = RHO_WATER * G * f.pointVol * frac;
      force.y += fb;
      torque.x += rz * fb;
      torque.z += -rx * fb;

      /* 该点的水阻（含波浪水平流速） */
      let vwx = 0, vwz = 0;
      if (this.waterVelAt) {
        this.waterVelAt(pw.x, pw.z, _f4);
        vwx = _f4.x; vwz = _f4.z;
      }
      const vpx = f.vel.x + (f.omega.y * rz - f.omega.z * ry);
      const vpy = f.vel.y + (f.omega.z * rx - f.omega.x * rz);
      const vpz = f.vel.z + (f.omega.x * ry - f.omega.y * rx);
      const rvx = vpx - vwx, rvy = vpy, rvz = vpz - vwz;
      const dk = 0.5 * RHO_WATER * f.cdWater * (f.hullArea / n) * frac;
      const dfx = -dk * rvx * Math.abs(rvx) * 0.06;
      const dfy = -dk * rvy * Math.abs(rvy) * 0.10;
      const dfz = -dk * rvz * Math.abs(rvz) * 0.06;
      force.x += dfx; force.y += dfy; force.z += dfz;
      torque.x += ry * dfz - rz * dfy;
      torque.y += rz * dfx - rx * dfz;
      torque.z += rx * dfy - ry * dfx;
    }

    /* --- 风压（水线以上的船体 + 桅帆/上层建筑） --- */
    pw.copy(f.sailCenter).applyQuaternion(f.quat).add(f.pos);
    this.windAt(pw, _f5);
    const rvx = _f5.x - f.vel.x, rvy = _f5.y - f.vel.y, rvz = _f5.z - f.vel.z;
    const relS = Math.hypot(rvx, rvy, rvz);
    const above = clamp(1 - submerged * 0.8, 0.2, 1);
    const wk = 0.5 * RHO_AIR * 1.25 * f.sailArea * above;
    const fwx = wk * rvx * relS, fwy = wk * rvy * relS * 0.7, fwz = wk * rvz * relS;
    force.x += fwx; force.y += fwy; force.z += fwz;
    const sx = pw.x - f.pos.x, sy = pw.y - f.pos.y, sz = pw.z - f.pos.z;
    torque.x += sy * fwz - sz * fwy;
    torque.y += sz * fwx - sx * fwz;
    torque.z += sx * fwy - sy * fwx;

    /* --- 自航（未倾覆时保持航向） --- */
    if (f.selfDrive > 0 && !f.capsized) {
      const hx = Math.sin(f.heading), hz = Math.cos(f.heading);
      const cur = f.vel.x * hx + f.vel.z * hz;
      const thrust = (f.selfDrive - cur) * f.mass * 0.35;
      force.x += hx * thrust; force.z += hz * thrust;
    }

    /* --- 积分 --- */
    f.vel.x += force.x / f.mass * dt;
    f.vel.y += force.y / f.mass * dt;
    f.vel.z += force.z / f.mass * dt;
    f.vel.multiplyScalar(1 - Math.min(0.4, 0.18 * dt));
    f.pos.x += f.vel.x * dt; f.pos.y += f.vel.y * dt; f.pos.z += f.vel.z * dt;

    f.omega.x += torque.x / f.I.x * dt;
    f.omega.y += torque.y / f.I.y * dt;
    f.omega.z += torque.z / f.I.z * dt;
    /* 角阻尼：水里比空中大得多 */
    const angDamp = 1 - Math.min(0.5, (1.4 + 3.2 * submerged) * dt);
    f.omega.multiplyScalar(angDamp);
    const ol = f.omega.length();
    if (ol > 1e-5) {
      _q1.setFromAxisAngle(_v3.copy(f.omega).multiplyScalar(1 / ol), ol * dt);
      f.quat.premultiply(_q1).normalize();
    }

    /* --- 倾覆判定 --- */
    const up = f.upDot();
    if (!f.capsized && up < 0.18) { f.capsized = true; f.capsizeT = 0; }
    if (f.capsized) {
      f.capsizeT += dt;
      f.selfDrive = 0;
      /* 进水下沉 */
      if (f.capsizeT > 2.5) f.sunk = Math.min(1, f.sunk + dt * 0.05);
      f.pos.y -= f.sunk * dt * 1.6;
    } else if (up > 0.55) {
      f.capsized = false;
    }
    f.wake = Math.max(0, Math.hypot(f.vel.x, f.vel.z) * (1 - f.sunk));
  }
}
