import * as THREE from 'three';
import { clamp, angleDelta, makeRNG } from '../core/utils.js';

const _v = new THREE.Vector3();
const _aim = new THREE.Vector3();
const _eyeA = new THREE.Vector3();
const _eyeB = new THREE.Vector3();

/**
 * AI 坦克控制器：战术周期（推进/停射交替）/ 交战 / 抢点 / 卡死自救
 */
export class AIController {
  constructor(ctx, tank, rngSeed) {
    this.ctx = ctx;
    this.tank = tank;
    this.rng = makeRNG(rngSeed);
    this.thinkAcc = this.rng() * 0.2;
    this.target = null;
    this.targetBlocked = false;
    this.waypoint = new THREE.Vector3();
    this.trackTime = 0;
    this.stuckTime = 0;
    this.reverseTimer = 0;
    this.aimError = new THREE.Vector3();
    this.aggression = 0.5 + this.rng() * 0.5;
    this.accuracy = 0.55 + this.rng() * 0.45;
    // 战术周期
    this.mode = 'push';         // push=推进, hold=停车射击
    this.tactTimer = 2 + this.rng() * 2;
    this.state = 'advance';     // advance / combat（对外显示）
    this._pickWaypoint(true);
  }

  _pickWaypoint(towardCap = false) {
    const L = this.ctx.layout;
    const cap = L.cap;
    const r = this.rng;
    if (towardCap || r() < 0.66) {
      this.waypoint.set(
        cap.x + (r() * 2 - 1) * 70,
        0,
        cap.z + (r() * 2 - 1) * 70
      );
    } else {
      const side = r() < 0.5 ? -1 : 1;
      this.waypoint.set(
        side * (140 + r() * 240),
        0,
        (this.tank.team === 'A' ? 1 : -1) * (r() * 260 - 40)
      );
    }
  }

  update(dt) {
    const tank = this.tank;
    if (!tank.alive) return;
    this.thinkAcc -= dt;
    this.tactTimer -= dt;
    if (this.thinkAcc <= 0) {
      this.thinkAcc = 0.18;
      this._think();
    }
    if (this.tactTimer <= 0) this._newTactic();
    this._drive(dt);
    this._combat(dt);
  }

  /* ---------- 感知与目标 ---------- */
  _think() {
    const tank = this.tank;
    const { battle, world } = this.ctx;

    let best = null, bestD = 640;
    _eyeA.set(tank.pos.x, tank.pos.y + 2.6, tank.pos.z);
    for (const other of battle.tanks) {
      if (other.team === tank.team || !other.alive) continue;
      const d = other.pos.distanceTo(tank.pos);
      if (d > bestD) continue;
      _eyeB.set(other.pos.x, other.pos.y + 2.2, other.pos.z);
      if (world.lineOfSight(_eyeA, _eyeB)) {
        best = other; bestD = d;
      }
    }
    if (best !== this.target) {
      this.target = best;
      this.trackTime = 0;
      this.targetBlocked = false;
      // 发现新目标：短暂停车瞄准
      if (best) { this.mode = 'hold'; this.tactTimer = 2.5 + this.rng() * 2; }
    }
    this.state = this.target ? 'combat' : 'advance';

    if (!this.target && Math.hypot(this.waypoint.x - tank.pos.x, this.waypoint.z - tank.pos.z) < 30) {
      this._pickWaypoint();
    }
  }

  /* ---------- 战术周期决策 ---------- */
  _newTactic() {
    const tank = this.tank;
    const cap = this.ctx.battle.cap;
    const r = this.rng;
    this.tactTimer = 2.5 + r() * 2.5;

    if (!this.target) {
      this.mode = 'push';
      return;
    }
    const dist = this.target.pos.distanceTo(tank.pos);
    const capHostile = cap.owner !== tank.team;
    const distToCap = Math.hypot(tank.pos.x - cap.x, tank.pos.z - cap.z);
    let pushChance = 0.35;
    if (dist > 380) pushChance += 0.3;
    if (this.targetBlocked) pushChance += 0.35;
    if (capHostile && distToCap > 80) pushChance += 0.2;
    if (dist < 140) pushChance -= 0.25;
    pushChance = clamp(pushChance * (0.6 + this.aggression * 0.7), 0.1, 0.92);
    this.mode = r() < pushChance ? 'push' : 'hold';
    if (this.mode === 'push' && this.rng() < 0.5) this._pickWaypoint(capHostile);
  }

  /* ---------- 驾驶 ---------- */
  _drive(dt) {
    const tank = this.tank;
    if (this.reverseTimer > 0) {
      this.reverseTimer -= dt;
      tank.throttle = -0.85;
      tank.steer = this._reverseSteer;
      return;
    }
    if (Math.abs(tank.throttle) > 0.4 && Math.abs(tank.speed) < 0.45) {
      this.stuckTime += dt;
      if (this.stuckTime > 2.2) {
        this.stuckTime = 0;
        this.reverseTimer = 1.6 + this.rng();
        this._reverseSteer = this.rng() < 0.5 ? -0.9 : 0.9;
        return;
      }
    } else {
      this.stuckTime = Math.max(0, this.stuckTime - dt * 2);
    }

    if (this.target && this.mode === 'hold') {
      tank.throttle = 0;
      tank.steer = 0;
      return;
    }

    // 推进目的地：有目标时抵近到 180m 再停；无目标去路点
    let dx, dz;
    if (this.target) {
      const dist = this.target.pos.distanceTo(tank.pos);
      if (dist < 160 && this.aggression < 0.85) {
        // 距离够近：切回停射
        this.mode = 'hold';
        tank.throttle = 0; tank.steer = 0;
        return;
      }
      dx = this.target.pos.x - tank.pos.x;
      dz = this.target.pos.z - tank.pos.z;
    } else {
      dx = this.waypoint.x - tank.pos.x;
      dz = this.waypoint.z - tank.pos.z;
    }

    let desired = Math.atan2(dx, dz);
    desired += this._avoid();
    const diff = angleDelta(tank.heading, desired);
    tank.steer = clamp(diff * 2.2, -1, 1);
    const dist = Math.hypot(dx, dz);
    let throttle = clamp(dist / 45, 0.4, 1);
    if (Math.abs(diff) > 1.2) throttle *= 0.4;
    if (this.target) throttle = Math.min(throttle, 0.8);
    tank.throttle = throttle;
  }

  _avoid() {
    const tank = this.tank;
    const { world } = this.ctx;
    const probeDist = 22;
    let bias = 0;
    for (const [angOff, w] of [[0, 1], [0.5, 0.6], [-0.5, 0.6]]) {
      const a = tank.heading + angOff;
      const px = tank.pos.x + Math.sin(a) * probeDist;
      const pz = tank.pos.z + Math.cos(a) * probeDist;
      let blocked = 0;
      for (const sb of world.solidBoxes) {
        const b = sb.box;
        if (px > b.min.x - 2 && px < b.max.x + 2 && pz > b.min.z - 2 && pz < b.max.z + 2 &&
            tank.pos.y + 2 < b.max.y) { blocked = 1; break; }
      }
      if (!blocked) {
        for (const c of world.treeCircles) {
          if (Math.hypot(px - c.x, pz - c.z) < c.r + 3) { blocked = 1; break; }
        }
      }
      if (blocked) bias += (angOff === 0 ? (this.rng() < 0.5 ? 0.9 : -0.9) : -Math.sign(angOff) * 0.8) * w;
    }
    return bias;
  }

  /* ---------- 战斗 ---------- */
  _combat(dt) {
    const tank = this.tank;
    const target = this.target;
    if (!target || !target.alive) {
      _aim.set(
        tank.pos.x + Math.sin(tank.heading) * 120,
        tank.pos.y + 1.5,
        tank.pos.z + Math.cos(tank.heading) * 120
      );
      tank.aimAt(_aim);
      return;
    }
    this.trackTime += dt;

    const shellVel = tank.data.shells[tank.currentShell].vel;
    const dist = target.pos.distanceTo(tank.pos);
    const tof = dist / shellVel;
    const tv = _v.set(
      Math.sin(target.heading) * target.speed,
      0,
      Math.cos(target.heading) * target.speed
    );
    _aim.copy(target.pos);
    _aim.addScaledVector(tv, tof * 0.92);
    _aim.y += 1.4;

    // 瞄准误差（跟踪时间越长越准）
    const err = Math.max(0.12, 1.5 - this.trackTime * 0.55) * (1.5 - this.accuracy) * (dist / 520 + 0.45);
    if (Math.random() < dt * 2.2) {
      this.aimError.set(
        (this.rng() * 2 - 1) * err,
        (this.rng() * 2 - 1) * err * 0.5,
        (this.rng() * 2 - 1) * err
      );
    }
    _aim.add(this.aimError);
    tank.aimAt(_aim);

    if (tank.canFire() && tank.gunAligned && this.trackTime > 0.65) {
      const muzzle = tank.getMuzzle();
      _eyeB.set(target.pos.x, target.pos.y + 1.8, target.pos.z);
      if (this._allyInLine(muzzle.pos, _eyeB)) {
        this.targetBlocked = true;
      } else if (this.ctx.world.lineOfSight(muzzle.pos, _eyeB)) {
        this.targetBlocked = false;
        tank.fire();
        this.trackTime = Math.min(this.trackTime, 1.8);
      } else {
        this.targetBlocked = true;
      }
    }
  }

  /** 弹道上是否有友军阻挡 */
  _allyInLine(from, to) {
    for (const t of this.ctx.battle.tanks) {
      if (t === this.tank || !t.alive || t.team !== this.tank.team) continue;
      const roughDist = t.pos.distanceTo(from);
      if (roughDist > from.distanceTo(to) + t.boundRadius) continue;
      if (t.hitTest(from, to)) return true;
    }
    return false;
  }
}
