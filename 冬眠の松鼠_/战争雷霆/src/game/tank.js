import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { clamp, damp, angleDelta, moveAngleTowards, segmentBoxIntersect, boxHitNormal } from '../core/utils.js';
import { prepareModel } from '../world/materials.js';

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _m = new THREE.Matrix4();

let UID = 1;

/**
 * 坦克实体：模型装配 / 驾驶运动 / 炮塔瞄准 / 装甲伤害模型 / 履带动画 / 引擎音效
 */
export class Tank {
  constructor(ctx, { data, team, name, isPlayer = false }) {
    this.ctx = ctx;
    this.data = data;
    this.team = team;
    this.name = name;
    this.isPlayer = isPlayer;
    this.uid = UID++;

    // 运动状态
    this.pos = new THREE.Vector3();
    this.heading = 0;
    this.speed = 0;
    this.yawRate = 0;
    this.throttle = 0;   // -1..1
    this.steer = 0;      // -1..1
    this.radius = 2.7;

    // 炮塔
    this.turretYaw = 0;
    this.gunPitch = 0;
    this.targetTurretYaw = 0;
    this.targetGunPitch = 0;
    this.gunAligned = false;

    // 战斗状态
    this.hp = data.hp;
    this.alive = true;
    this.reloadTimer = 2.5;
    this.currentShell = 'AP';
    this.nextShell = 'AP';
    this.ammo = { AP: data.shells.AP.count, HE: data.shells.HE.count };
    this.engineDamaged = false;
    this.trackBrokenTimer = 0;
    this.gunDamagedTimer = 0;
    this.fireTimer = 0;
    this.damageBy = new Map();
    this.lastHitBy = null;
    this.spotted = isPlayer;
    this.spotTimer = 0;
    this.recoil = 0;

    this.onDestroyed = null;
    this.onDamaged = null;

    this._buildModel();
    this._engineSound = null;
    this._dustAcc = 0;
    this._exhaustAcc = 0;
  }

  /* ================= 模型装配 ================= */
  _buildModel() {
    const { assets } = this.ctx;
    const gltf = assets.models[this.data.model];
    const model = SkeletonUtils.clone(gltf.scene);

    this.root = new THREE.Group();
    this.root.name = 'tank_' + this.name;
    const fix = new THREE.Group();
    this.root.add(fix);
    fix.add(model);

    // 找关键节点
    let turretNode = null, gunNode = null;
    model.traverse((o) => {
      if (/^Tank_Turret/i.test(o.name)) turretNode = o;
      else if (/^Tank_Gun/i.test(o.name)) gunNode = o;
    });

    // 依据炮管相对炮塔的方向判断车头朝向并旋转对齐 +Z
    model.updateMatrixWorld(true);
    let fixAngle = 0;
    if (turretNode && gunNode) {
      const tp = new THREE.Vector3(), gp = new THREE.Vector3();
      new THREE.Box3().setFromObject(turretNode).getCenter(tp);
      new THREE.Box3().setFromObject(gunNode).getCenter(gp);
      const dx = gp.x - tp.x, dz = gp.z - tp.z;
      if (Math.abs(dz) >= Math.abs(dx)) fixAngle = dz >= 0 ? 0 : Math.PI;
      else fixAngle = dx >= 0 ? Math.PI / 2 : -Math.PI / 2;
    }
    fix.rotation.y = fixAngle;
    this.root.updateMatrixWorld(true);

    // 归一化尺寸
    const bbox = new THREE.Box3().setFromObject(this.root);
    const size = bbox.getSize(new THREE.Vector3());
    const scale = this.data.length / Math.max(size.z, 0.001);
    model.scale.multiplyScalar(scale);
    this.root.updateMatrixWorld(true);

    // 底部对齐地面
    const bbox2 = new THREE.Box3().setFromObject(this.root);
    model.position.y -= bbox2.min.y / 1; // model 在 fix 内，直接抬高
    this.root.updateMatrixWorld(true);

    // 装配炮塔/火炮枢轴（在游戏坐标系下）
    this.turretPivot = new THREE.Group();
    this.gunPivot = new THREE.Group();
    if (turretNode && gunNode) {
      const tw = new THREE.Vector3();
      new THREE.Box3().setFromObject(turretNode).getCenter(tw);
      this.root.add(this.turretPivot);
      this.turretPivot.position.copy(this.root.worldToLocal(tw.clone()));
      this.turretPivot.attach(turretNode);

      const gw = new THREE.Vector3();
      const gunBox = new THREE.Box3().setFromObject(gunNode);
      gunBox.getCenter(gw);
      gw.z = gunBox.min.z + (gunBox.max.z - gunBox.min.z) * 0.25; // 靠后当耳轴
      this.turretPivot.add(this.gunPivot);
      this.gunPivot.position.copy(this.turretPivot.worldToLocal(gw.clone()));
      this.gunPivot.attach(gunNode);

      // 炮口位置（gunPivot 局部）
      const muzzleWorld = new THREE.Vector3(
        (gunBox.min.x + gunBox.max.x) / 2,
        (gunBox.min.y + gunBox.max.y) / 2,
        gunBox.max.z
      );
      this.muzzleLocal = this.gunPivot.worldToLocal(muzzleWorld.clone());
    } else {
      this.root.add(this.turretPivot);
      this.turretPivot.add(this.gunPivot);
      this.muzzleLocal = new THREE.Vector3(0, 2, 3);
    }

    // 车体包围盒（局部）用于命中判定
    this.root.updateMatrixWorld(true);
    const hullBox = new THREE.Box3().setFromObject(this.root);
    const c = hullBox.getCenter(new THREE.Vector3());
    const s = hullBox.getSize(new THREE.Vector3());
    this.bodyHeight = s.y;

    const mk = (cx, cy, cz, sx, sy, sz) => new THREE.Box3(
      new THREE.Vector3(cx - sx / 2, cy - sy / 2, cz - sz / 2),
      new THREE.Vector3(cx + sx / 2, cy + sy / 2, cz + sz / 2)
    );
    const hullTop = s.y * 0.62;
    this.modules = [
      { name: 'turret', box: mk(c.x, hullTop + s.y * 0.22, c.z - s.z * 0.05, s.x * 0.62, s.y * 0.42, s.z * 0.46), armorKey: 'turret' },
      { name: 'track', side: 'L', box: mk(c.x - s.x * 0.38, s.y * 0.18, c.z, s.x * 0.24, s.y * 0.36, s.z * 0.96), armorKey: 'track' },
      { name: 'track', side: 'R', box: mk(c.x + s.x * 0.38, s.y * 0.18, c.z, s.x * 0.24, s.y * 0.36, s.z * 0.96), armorKey: 'track' },
      { name: 'engine', box: mk(c.x, s.y * 0.34, c.z - s.z * 0.33, s.x * 0.5, s.y * 0.3, s.z * 0.3), armorKey: 'hull', internal: true },
      { name: 'ammo', box: mk(c.x, s.y * 0.3, c.z + s.z * 0.1, s.x * 0.44, s.y * 0.26, s.z * 0.3), armorKey: 'hull', internal: true },
      { name: 'hull', box: mk(c.x, s.y * 0.42, c.z, s.x * 0.72, s.y * 0.6, s.z * 0.98), armorKey: 'hull' },
    ];
    this.boundBox = mk(c.x, s.y * 0.55, c.z, s.x, s.y * 1.15, s.z * 1.05);
    this.boundRadius = Math.max(s.x, s.z) * 0.62;

    // 外观材质（迷彩 + 细节噪声）
    prepareModel(this.root, { camo: this.data.camo, detailScale: 0.85, strength: 0.4 });

    // 履带动画
    this.mixer = new THREE.AnimationMixer(model);
    this.actions = {};
    for (const clip of gltf.animations || []) {
      const key = /Forward/i.test(clip.name) ? 'f' :
        /Backward/i.test(clip.name) ? 'b' :
        /TurningLeft/i.test(clip.name) ? 'l' :
        /TurningRight/i.test(clip.name) ? 'r' : null;
      if (key) {
        const a = this.mixer.clipAction(clip);
        a.play();
        a.setEffectiveWeight(0);
        this.actions[key] = a;
      }
    }

    this.ctx.scene.add(this.root);
  }

  setPosition(x, z, heading = 0) {
    this.pos.set(x, this.ctx.terrain.heightAt(x, z), z);
    this.heading = heading;
    this.turretYaw = 0; this.targetTurretYaw = 0;
    this.root.position.copy(this.pos);
    this.root.rotation.set(0, heading, 0);
    this.root.updateMatrixWorld(true);
  }

  forwardDir(out = new THREE.Vector3()) {
    return out.set(Math.sin(this.heading), 0, Math.cos(this.heading));
  }

  /* ================= 每帧更新 ================= */
  update(dt) {
    const { terrain, world, effects } = this.ctx;
    const d = this.data;

    if (this.alive) {
      // ---- 修理计时 ----
      if (this.trackBrokenTimer > 0) {
        this.trackBrokenTimer -= dt;
        if (this.trackBrokenTimer <= 0) { this.trackBrokenTimer = 0; }
      }
      if (this.gunDamagedTimer > 0) this.gunDamagedTimer = Math.max(0, this.gunDamagedTimer - dt);
      if (this.fireTimer > 0) {
        this.fireTimer -= dt;
        this._applyDamage(4 * dt, null, 'fire');
        if (Math.random() < dt * 8) {
          effects.exhaust(_v.copy(this.pos).add(_v2.set((Math.random() - 0.5) * 2, 1.8, (Math.random() - 0.5) * 2)));
        }
      }

      // ---- 驾驶 ----
      const mobility = (this.engineDamaged ? 0.55 : 1) * (this.trackBrokenTimer > 0 ? 0 : 1);
      const slopePitch = this._slopeAlong();
      const targetSpeed = this.throttle >= 0
        ? this.throttle * d.maxSpeed * mobility
        : this.throttle * d.reverseSpeed * mobility;
      const accel = d.accel * (this.throttle === 0 ? 1.6 : 1);
      let slopeEffect = -slopePitch * 6;
      if (Math.abs(this.speed) < 0.5 && this.throttle === 0) slopeEffect = 0;
      this.speed += clamp(targetSpeed + slopeEffect * 0.35 - this.speed, -accel * dt, accel * dt);
      if (mobility === 0) this.speed = damp(this.speed, 0, 6, dt);

      const speedFactor = clamp(1 - Math.abs(this.speed) / (d.maxSpeed * 1.6), 0.42, 1);
      const targetYawRate = this.steer * d.hullTurnRate * speedFactor * (this.trackBrokenTimer > 0 ? 0 : 1) * (this.speed < -0.3 ? -1 : 1);
      this.yawRate = damp(this.yawRate, targetYawRate, 8, dt);
      this.heading += this.yawRate * dt;

      const newPos = _v.copy(this.pos);
      newPos.x += Math.sin(this.heading) * this.speed * dt;
      newPos.z += Math.cos(this.heading) * this.speed * dt;

      // 边界
      const lim = this.ctx.layout.playableHalf;
      newPos.x = clamp(newPos.x, -lim, lim);
      newPos.z = clamp(newPos.z, -lim, lim);

      // 静态碰撞
      world.resolveTankCollision(this, newPos, this.radius, (c) => {
        const cpos = new THREE.Vector3(c.x, this.pos.y + 0.5, c.z);
        if (c.explosive) {
          effects.explosion(cpos, { big: false });
          this.ctx.audio.play3D('explosion', cpos, { volume: 0.9, refDist: 24 });
          this._applyDamage(8 + Math.random() * 8, null, 'barrel');
          if (Math.random() < 0.25) this.trackBrokenTimer = Math.max(this.trackBrokenTimer, 3.5);
        } else {
          effects.crushDebris(cpos, c.kind);
          this.ctx.audio.play3D('thud', c.object.position, { volume: 0.5 });
        }
        this.speed *= 0.86;
      });
      // 车际碰撞
      for (const other of this.ctx.battle.tanks) {
        if (other === this || !other.alive) continue;
        const dx = newPos.x - other.pos.x, dz = newPos.z - other.pos.z;
        const rr = this.radius + other.radius;
        const d2 = dx * dx + dz * dz;
        if (d2 < rr * rr && d2 > 1e-6) {
          const dd = Math.sqrt(d2);
          newPos.x = other.pos.x + (dx / dd) * rr;
          newPos.z = other.pos.z + (dz / dd) * rr;
          this.speed *= 0.7;
        }
      }
      this.pos.copy(newPos);
      this.pos.y = terrain.heightAt(this.pos.x, this.pos.z);

      // ---- 炮塔驱动 ----
      const gunRate = 0.55; // rad/s 俯仰
      this.turretYaw = moveAngleTowards(this.turretYaw, this.targetTurretYaw, d.turretRate * dt);
      this.gunPitch = clamp(
        moveAngleTowards(this.gunPitch, this.targetGunPitch, gunRate * dt),
        d.gunPitch.min, d.gunPitch.max
      );
      this.gunAligned =
        Math.abs(angleDelta(this.turretYaw, this.targetTurretYaw)) < 0.012 &&
        Math.abs(this.gunPitch - this.targetGunPitch) < 0.012;

      // ---- 装填 ----
      if (this.reloadTimer > 0) {
        const mult = this.gunDamagedTimer > 0 ? 0.55 : 1;
        this.reloadTimer -= dt * mult;
        if (this.reloadTimer <= 0) {
          this.reloadTimer = 0;
          this.currentShell = this.nextShell;
          if (this.isPlayer) this.ctx.audio.playUI('ui_click2', 0.5, 1.2);
        }
      }

      // ---- 尘土 / 排气 ----
      const spd = Math.abs(this.speed);
      if (spd > 1.5) {
        this._dustAcc += dt * spd;
        if (this._dustAcc > 2.2) {
          this._dustAcc = 0;
          const back = this.forwardDir(_v2).multiplyScalar(-d.length * 0.4);
          for (const side of [-1, 1]) {
            const p = _v.copy(this.pos).add(back);
            p.x += Math.cos(this.heading) * side * 1.4;
            p.z += -Math.sin(this.heading) * side * 1.4;
            p.y += 0.4;
            effects.dust(p, this.forwardDir(new THREE.Vector3()).multiplyScalar(-this.speed), clamp(spd / d.maxSpeed, 0.3, 1));
          }
        }
      }
      this._exhaustAcc += dt;
      if (this._exhaustAcc > 0.34 && Math.abs(this.throttle) > 0.1) {
        this._exhaustAcc = 0;
        const p = _v.copy(this.pos);
        const back = this.forwardDir(_v2).multiplyScalar(-d.length * 0.42);
        p.add(back); p.y += 1.5;
        effects.exhaust(p);
      }
    } else {
      this.speed = 0;
    }

    // ---- 位姿応用（贴合地形） ----
    const n = terrain.normalAt(this.pos.x, this.pos.z, _v2);
    _q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
    const yawQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.heading);
    _q.multiply(yawQ);
    this.root.quaternion.slerp(_q, Math.min(1, dt * 7));
    this.root.position.copy(this.pos);
    this.turretPivot.rotation.y = this.turretYaw;
    this.recoil = damp(this.recoil, 0, 7, dt);
    this.gunPivot.rotation.x = -this.gunPitch;
    this.gunPivot.position.z = this._gunBaseZ !== undefined ? this._gunBaseZ - this.recoil : (this._gunBaseZ = this.gunPivot.position.z);

    // ---- 履带动画 ----
    if (this.mixer && this.alive) {
      const spd = this.speed;
      const wF = spd > 0.15 ? clamp(spd / 5, 0.15, 1) : 0;
      const wB = spd < -0.15 ? clamp(-spd / 4, 0.15, 1) : 0;
      const turn = this.yawRate;
      const wL = turn > 0.04 ? clamp(turn / 0.5, 0.2, 1) : 0;
      const wR = turn < -0.04 ? clamp(-turn / 0.5, 0.2, 1) : 0;
      this.actions.f?.setEffectiveWeight(wF);
      this.actions.b?.setEffectiveWeight(wB);
      this.actions.l?.setEffectiveWeight(wL);
      this.actions.r?.setEffectiveWeight(wR);
      const rate = clamp(Math.abs(spd) / 5 + Math.abs(turn) * 1.2, 0, 2.2);
      this.mixer.timeScale = Math.max(rate, 0.001);
      this.mixer.update(dt);
    }

    // ---- 引擎声 ----
    this._updateEngineSound(dt);
  }

  _slopeAlong() {
    const t = this.ctx.terrain;
    const f = this.forwardDir(_v2);
    const ahead = t.heightAt(this.pos.x + f.x * 3, this.pos.z + f.z * 3);
    const behind = t.heightAt(this.pos.x - f.x * 3, this.pos.z - f.z * 3);
    return Math.atan2(ahead - behind, 6);
  }

  _updateEngineSound(dt) {
    const audio = this.ctx.audio;
    const listener = audio.listenerPos;
    const dx = this.pos.x - listener.x, dz = this.pos.z - listener.z;
    const dist2 = dx * dx + dz * dz;
    const inRange = dist2 < 340 * 340;
    if (this.alive && inRange && !this._engineSound) {
      this._engineSound = audio.createEngine(this.isPlayer ? 'engine0' : 'engine1', this.pos);
    } else if ((!this.alive || !inRange) && this._engineSound) {
      this._engineSound.stop();
      this._engineSound = null;
    }
    if (this._engineSound) {
      this._engineSound.setPos(this.pos);
      const load = clamp(Math.abs(this.speed) / this.data.maxSpeed, 0, 1);
      const throttleLoad = Math.abs(this.throttle) * 0.4;
      const rate = 0.72 + load * 0.75 + throttleLoad * 0.2;
      const vol = (this.isPlayer ? 0.4 : 0.55) * (0.45 + load * 0.5 + throttleLoad * 0.2);
      this._engineSound.set(vol, rate);
    }
  }

  /* ================= 瞄准 / 开火 ================= */
  /** 让炮塔瞄准世界坐标点 */
  aimAt(point) {
    _v.copy(point).sub(this.pos);
    const worldYaw = Math.atan2(_v.x, _v.z);
    this.targetTurretYaw = ((worldYaw - this.heading) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
    const muzzle = this.getMuzzle();
    const dy = point.y - muzzle.pos.y;
    const distXZ = Math.hypot(point.x - muzzle.pos.x, point.z - muzzle.pos.z);
    // 弹道补偿（抛物线近似）
    const v0 = this.data.shells[this.currentShell].vel;
    const t = distXZ / v0;
    const drop = 0.5 * 9.8 * t * t;
    this.targetGunPitch = clamp(Math.atan2(dy + drop, distXZ) - this._hullPitch(), this.data.gunPitch.min, this.data.gunPitch.max);
  }

  _hullPitch() {
    // 车体纵向俯仰对火炮的影响（近似）
    const f = this.forwardDir(_v2);
    const n = this.ctx.terrain.normalAt(this.pos.x, this.pos.z, _v);
    return -(f.x * n.x + f.z * n.z) * 1.2;
  }

  getMuzzle() {
    this.root.updateMatrixWorld(true);
    const pos = this.muzzleLocal.clone();
    this.gunPivot.localToWorld(pos);
    const dir = new THREE.Vector3(0, 0, 1);
    _m.extractRotation(this.gunPivot.matrixWorld);
    dir.applyMatrix4(_m).normalize();
    return { pos, dir };
  }

  get reloadProgress() {
    const total = this.data.reload;
    return 1 - clamp(this.reloadTimer / total, 0, 1);
  }

  canFire() {
    return this.alive && this.reloadTimer <= 0 && this.ammo[this.currentShell] > 0;
  }

  fire() {
    if (!this.canFire()) return null;
    const shellData = this.data.shells[this.currentShell];
    const { pos, dir } = this.getMuzzle();
    // 散布
    const disp = 0.004;
    dir.x += (Math.random() - 0.5) * disp;
    dir.y += (Math.random() - 0.5) * disp * 0.7;
    dir.z += (Math.random() - 0.5) * disp;
    dir.normalize();

    this.ammo[this.currentShell]--;
    this.reloadTimer = this.data.reload;
    this.recoil = 0.35;

    const shell = this.ctx.projectiles.spawn({
      shooter: this,
      type: this.currentShell,
      pos: pos.clone(),
      vel: dir.clone().multiplyScalar(shellData.vel),
      pen: shellData.pen,
      dmg: shellData.dmg,
      splash: shellData.splash || 0,
    });

    this.ctx.effects.muzzleFlash(pos, dir);
    this.ctx.audio.play3D('cannon', pos, { volume: 1, rate: 0.92 + Math.random() * 0.16, refDist: 30, maxDist: 1600 });
    // 车体后坐
    this.speed -= dir.dot(this.forwardDir(_v2)) * 0.7;
    return shell;
  }

  switchShell(type) {
    if (!this.data.shells[type]) return;
    this.nextShell = type;
    if (this.reloadTimer <= 0 && this.currentShell !== type) {
      // 换弹重新装填（半程惩罚）
      this.currentShell = type;
      this.reloadTimer = this.data.reload * 0.5;
    }
  }

  /* ================= 命中判定 ================= */
  /** 线段命中检测（世界坐标）。返回最近命中模块信息 */
  hitTest(p0World, p1World) {
    this.root.updateMatrixWorld(true);
    _m.copy(this.root.matrixWorld).invert();
    const p0 = _v.copy(p0World).applyMatrix4(_m);
    const p1 = _v2.copy(p1World).applyMatrix4(_m);
    // 粗测
    if (segmentBoxIntersect(p0, p1, this.boundBox, null) === null) return null;
    let best = null;
    const localPoint = new THREE.Vector3();
    for (const mod of this.modules) {
      const t = segmentBoxIntersect(p0, p1, mod.box, localPoint);
      if (t !== null && (!best || t < best.t)) {
        const normalLocal = boxHitNormal(mod.box, localPoint, new THREE.Vector3());
        best = {
          t,
          module: mod.name,
          side: mod.side,
          armorKey: mod.armorKey,
          pointLocal: localPoint.clone(),
          normalLocal,
        };
      }
    }
    if (!best) return null;
    best.point = best.pointLocal.clone().applyMatrix4(this.root.matrixWorld);
    best.normal = best.normalLocal.clone().transformDirection(this.root.matrixWorld);
    best.tank = this;
    return best;
  }

  /** 获取命中面的名义装甲厚度 */
  armorAt(hit) {
    const n = hit.normalLocal;
    const key = hit.armorKey === 'turret' ? 'turret' : 'hull';
    const armor = this.data.armor[key];
    if (hit.armorKey === 'track') return 20;
    if (Math.abs(n.y) > 0.7) return armor.top;
    if (Math.abs(n.z) > Math.abs(n.x)) return n.z > 0 ? armor.front : armor.rear;
    return armor.side;
  }

  /* ================= 伤害 ================= */
  applyHit(hit, shell, dist) {
    const results = { tank: this, module: hit.module, result: 'nonpen', dmg: 0, detonation: false };
    if (!this.alive) { results.result = 'dead'; return results; }

    const shellDirLocal = _v.copy(shell.vel).normalize().transformDirection(_m.copy(this.root.matrixWorld).invert());
    const cos = Math.abs(shellDirLocal.dot(hit.normalLocal));
    const angleDeg = Math.acos(clamp(cos, 0, 1)) * 180 / Math.PI;

    const isHE = shell.type === 'HE';
    // 跳弹
    if (!isHE && angleDeg > 73 && hit.module !== 'track' && Math.random() < 0.8) {
      results.result = 'ricochet';
      this._notifyDamaged(shell.shooter, results);
      return results;
    }

    const basePen = shell.pen;
    const penEff = isHE ? basePen : basePen * (1 - clamp(dist, 0, 1800) / 1800 * 0.22);
    const nominal = this.armorAt(hit);
    const effArmor = nominal / Math.max(cos, 0.25);
    const penetrated = penEff > effArmor;

    const roll = shell.dmg[0] + Math.random() * (shell.dmg[1] - shell.dmg[0]);

    if (hit.module === 'track') {
      // 履带（外部模块）
      this.trackBrokenTimer = Math.max(this.trackBrokenTimer, 5.5);
      results.result = penetrated ? 'pen' : 'trackhit';
      const dmg = penetrated ? roll * 0.4 : roll * 0.12;
      this._applyDamage(dmg, shell.shooter, 'track');
      results.dmg = dmg;
      this._notifyDamaged(shell.shooter, results);
      return results;
    }

    if (!penetrated) {
      if (isHE) {
        // 榴弹冲击波
        const dmg = roll * 0.35;
        this._applyDamage(dmg, shell.shooter, 'he_splash');
        if (Math.random() < 0.5) this.trackBrokenTimer = Math.max(this.trackBrokenTimer, 4);
        results.result = 'splash';
        results.dmg = dmg;
      } else {
        results.result = 'nonpen';
      }
      this._notifyDamaged(shell.shooter, results);
      return results;
    }

    // 击穿
    results.result = 'pen';
    let dmg = roll * clamp(penEff / effArmor, 1, 1.5) * (isHE ? 1.35 : 1);
    switch (hit.module) {
      case 'ammo':
        if (Math.random() < 0.3) {
          results.detonation = true;
          dmg = 9999;
        } else {
          dmg *= 1.45;
          if (Math.random() < 0.2) this.fireTimer = Math.max(this.fireTimer, 5);
        }
        break;
      case 'engine':
        this.engineDamaged = true;
        if (Math.random() < 0.33) this.fireTimer = Math.max(this.fireTimer, 6);
        dmg *= 0.95;
        break;
      case 'turret':
        if (Math.random() < 0.35) this.gunDamagedTimer = Math.max(this.gunDamagedTimer, 9);
        break;
      default: break;
    }
    results.dmg = dmg;
    this._applyDamage(dmg, shell.shooter, hit.module, results.detonation);
    this._notifyDamaged(shell.shooter, results);
    return results;
  }

  _notifyDamaged(shooter, results) {
    if (this.onDamaged) this.onDamaged(shooter, results);
  }

  _applyDamage(dmg, shooter, cause, detonation = false) {
    if (!this.alive) return;
    this.hp -= dmg;
    if (shooter && shooter !== this) {
      this.damageBy.set(shooter.uid, (this.damageBy.get(shooter.uid) || 0) + dmg);
      this.lastHitBy = shooter;
      this.spotTimer = 8;
    }
    if (this.hp <= 0) {
      this.hp = 0;
      this._destroy(shooter || this.lastHitBy, detonation || cause === 'ammo');
    }
  }

  _destroy(killer, detonation) {
    if (!this.alive) return;
    this.alive = false;
    this.throttle = 0; this.steer = 0;
    const { effects, audio, world } = this.ctx;
    const center = this.pos.clone(); center.y += 1.4;
    if (detonation) {
      effects.ammoDetonation(center);
      audio.play3D('explosion_big', center, { volume: 1, refDist: 40, maxDist: 2000 });
      // 炮塔跳飞
      this.turretPivot.position.y += 0.4;
      this.turretPivot.rotation.z += (Math.random() - 0.5) * 0.5;
    } else {
      effects.explosion(center, { big: false, ground: false });
      audio.play3D('explosion', center, { volume: 0.95, refDist: 34, maxDist: 1600 });
      audio.play3D('explosion_chunky', center, { volume: 0.7, refDist: 30, maxDist: 1200 });
    }
    effects.addBurning(this.pos, 30, this.bodyHeight * 0.7);
    effects.scorch(this.pos, 7);
    // 烧黑
    this.root.traverse((o) => {
      if (o.isMesh) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => {
          if (!m.userData.__burnt) {
            const nm = m.clone();
            nm.userData.__burnt = true;
            if (nm.color) nm.color.multiplyScalar(0.16);
            if (o.material === m) o.material = nm;
          }
        });
      }
    });
    // 残骸作为掩体（用紧凑车体盒，避免炮管撑大碰撞体）
    this.root.updateMatrixWorld(true);
    const wbox = this.boundBox.clone().applyMatrix4(this.root.matrixWorld);
    world.solidBoxes.push({ box: wbox, blockShell: true, name: 'wreck', mesh: this.root });
    if (this._engineSound) { this._engineSound.stop(); this._engineSound = null; }
    if (this.onDestroyed) this.onDestroyed(killer, detonation);
  }

  dispose() {
    if (this._engineSound) { this._engineSound.stop(); this._engineSound = null; }
    this.ctx.scene.remove(this.root);
  }
}
