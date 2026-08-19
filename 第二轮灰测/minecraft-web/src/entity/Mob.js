/* =====================================================================
 * Mob — 生物实体：AI、物理、受伤、掉落、苦力怕爆炸
 * ===================================================================== */
import { AABB } from '../math/AABB.js';
import { collideMove } from './Physics.js';
import { GRAVITY } from '../core/Constants.js';
import { MOB_TYPES } from './MobModels.js';
import { bus, EV } from '../core/EventBus.js';
import { clamp, lerpAngle, damp } from '../math/MathUtils.js';
import { idByName, BLOCKS } from '../data/blocks.js';

let nextId = 1;
const WATER_ID = idByName('water');

export class Mob {
  constructor(world, type, x, y, z) {
    this.id = nextId++;
    this.world = world;
    this.type = type;
    this.def = MOB_TYPES[type] || MOB_TYPES.pig;
    this.position = new Float32Array([x, y, z]);
    this.velocity = new Float32Array(3);
    this.yaw = Math.random() * Math.PI * 2;
    this.renderYaw = this.yaw;
    this.headYaw = 0;
    this.health = this.def.health;
    this.dead = false;
    this.onGround = false;
    this.inWater = false;
    this.box = new AABB();
    this._syncBox();

    // AI
    this.wanderTimer = Math.random() * 3;
    this.moveDir = [0, 0];
    this.jumpCooldown = 0;
    this.attackCooldown = 0;
    this.fuse = -1;
    this.hurtTime = 0;
    this.walkPhase = Math.random() * 6;
    this.walkSpeed = 0;
    this.age = 0;
    this.panicTimer = 0;
    this.despawnTimer = 0;
    this.light = 1;
  }

  get width() { return this.def.width; }
  get height() { return this.def.height; }
  get hostile() { return this.def.hostile === true; }

  _syncBox() {
    this.box.setFromEntity(this.position[0], this.position[1], this.position[2], this.width, this.height);
  }

  update(dt, player, manager) {
    if (this.dead) return;
    dt = Math.min(dt, 0.05);
    this.age += dt;
    this.hurtTime = Math.max(0, this.hurtTime - dt);
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.jumpCooldown = Math.max(0, this.jumpCooldown - dt);

    const world = this.world;
    const px = Math.floor(this.position[0]);
    const py = Math.floor(this.position[1] + this.height * 0.5);
    const pz = Math.floor(this.position[2]);
    this.inWater = world.getBlockSafe(px, Math.floor(this.position[1] + 0.2), pz) === WATER_ID;
    this.light = world.lightAt(px, py, pz, world.daylight);

    this._think(dt, player, manager);
    this._physics(dt);

    // 白天燃烧（僵尸/骷髅）
    if (this.def.burnsInDay && !this.inWater) {
      const sky = world.getSkyLight(px, Math.floor(this.position[1] + this.height), pz);
      if (sky > 11 && world.daylight > 0.65) {
        this.burnTimer = (this.burnTimer || 0) + dt;
        if (this.burnTimer > 1) { this.burnTimer = 0; this.damage(1, null, manager); }
      }
    }

    // 远离玩家太久则消失
    const dx = this.position[0] - player.position[0];
    const dz = this.position[2] - player.position[2];
    const distSq = dx * dx + dz * dz;
    if (distSq > 96 * 96) this.dead = true;
    if (this.hostile && world.daylight > 0.8 && distSq > 40 * 40 && this.age > 30) this.dead = true;
  }

  _think(dt, player, manager) {
    const def = this.def;
    const dx = player.position[0] - this.position[0];
    const dy = player.position[1] - this.position[1];
    const dz = player.position[2] - this.position[2];
    const dist = Math.hypot(dx, dy, dz);

    // 面向玩家（近距离）
    if (dist < 12) {
      this.headYaw = Math.atan2(-dx, -dz) - this.yaw;
      while (this.headYaw > Math.PI) this.headYaw -= Math.PI * 2;
      while (this.headYaw < -Math.PI) this.headYaw += Math.PI * 2;
      this.headYaw = clamp(this.headYaw, -1.1, 1.1);
    } else {
      this.headYaw = damp(this.headYaw, 0, 3, dt);
    }

    const canChase = this.hostile && !player.isCreative && !player.isSpectator && !player.dead;

    if (canChase && dist < 20) {
      // 追击
      const yawTo = Math.atan2(-dx, -dz);
      this.yaw = lerpAngle(this.yaw, yawTo, 1 - Math.exp(-6 * dt));
      this.moveDir[0] = -Math.sin(this.yaw);
      this.moveDir[1] = -Math.cos(this.yaw);
      this.walkSpeed = def.speed * 1.15;

      // 苦力怕引爆
      if (def.explode) {
        if (dist < 2.6) {
          if (this.fuse < 0) { this.fuse = 1.5; bus.emit(EV.SOUND, 'fuse', { volume: 0.7 }); }
          this.fuse -= dt;
          this.walkSpeed = 0;
          if (this.fuse <= 0) { this._explode(player, manager); return; }
        } else if (this.fuse > 0) {
          this.fuse = -1;
        }
      } else if (dist < 1.9 && this.attackCooldown <= 0) {
        this.attackCooldown = 1;
        player.damage(def.attack || 2, `被${def.display}击杀`);
        // 击退
        const kb = 3.2 / Math.max(dist, 0.4);
        player.velocity[0] += dx * kb * 0.1;
        player.velocity[2] += dz * kb * 0.1;
      }
      // 跳过障碍
      if (this.onGround && this.jumpCooldown <= 0 && this._blockedAhead()) {
        this.velocity[1] = 8.2; this.jumpCooldown = 0.6;
      }
      return;
    }

    // 受惊逃跑
    if (this.panicTimer > 0) {
      this.panicTimer -= dt;
      this.walkSpeed = def.speed * 1.6;
      if (this.onGround && this.jumpCooldown <= 0 && this._blockedAhead()) {
        this.velocity[1] = 8.2; this.jumpCooldown = 0.6;
      }
      return;
    }

    // 随机漫步
    this.wanderTimer -= dt;
    if (this.wanderTimer <= 0) {
      this.wanderTimer = 2 + Math.random() * 5;
      if (Math.random() < 0.35) {
        this.walkSpeed = 0;
        this.moveDir[0] = this.moveDir[1] = 0;
      } else {
        this.yaw = Math.random() * Math.PI * 2;
        this.moveDir[0] = -Math.sin(this.yaw);
        this.moveDir[1] = -Math.cos(this.yaw);
        this.walkSpeed = def.speed * 0.55;
      }
    }
    // 避免走进水/悬崖
    if (this.walkSpeed > 0 && this.onGround) {
      const ax = this.position[0] + this.moveDir[0] * 0.8;
      const az = this.position[2] + this.moveDir[1] * 0.8;
      const belowId = this.world.getBlockSafe(Math.floor(ax), Math.floor(this.position[1] - 1), Math.floor(az));
      if (belowId === 0 || belowId === WATER_ID) {
        this.yaw += Math.PI * (0.5 + Math.random() * 0.5);
        this.moveDir[0] = -Math.sin(this.yaw);
        this.moveDir[1] = -Math.cos(this.yaw);
      }
      if (this.jumpCooldown <= 0 && this._blockedAhead()) {
        this.velocity[1] = 8.2; this.jumpCooldown = 0.8;
      }
    }
  }

  _blockedAhead() {
    const ax = this.position[0] + this.moveDir[0] * 0.55;
    const az = this.position[2] + this.moveDir[1] * 0.55;
    const y = Math.floor(this.position[1] + 0.2);
    const id = this.world.getBlockCollide(Math.floor(ax), y, Math.floor(az));
    if (id <= 0) return false;
    const b = BLOCKS[id];
    if (!b || !b.solid) return false;
    // 上方要有空间
    const above = this.world.getBlockCollide(Math.floor(ax), y + 1, Math.floor(az));
    return above <= 0 || !BLOCKS[above]?.solid;
  }

  _physics(dt) {
    const world = this.world;
    const targetVX = this.moveDir[0] * this.walkSpeed;
    const targetVZ = this.moveDir[1] * this.walkSpeed;
    const accel = this.onGround ? 14 : 3;
    const k = 1 - Math.exp(-accel * dt);
    this.velocity[0] += (targetVX - this.velocity[0]) * k;
    this.velocity[2] += (targetVZ - this.velocity[2]) * k;

    if (this.inWater) {
      this.velocity[1] += (1.2 - this.velocity[1]) * (1 - Math.exp(-5 * dt));
    } else {
      this.velocity[1] -= GRAVITY * dt;
      if (this.velocity[1] < -60) this.velocity[1] = -60;
    }

    this._syncBox();
    const res = collideMove(world, this.box,
      this.velocity[0] * dt, this.velocity[1] * dt, this.velocity[2] * dt, 1.05);

    this.position[0] = this.box.centerX;
    this.position[1] = this.box.minY;
    this.position[2] = this.box.centerZ;

    if (Math.abs(res.dx) < Math.abs(this.velocity[0] * dt) - 1e-6) this.velocity[0] = 0;
    if (Math.abs(res.dz) < Math.abs(this.velocity[2] * dt) - 1e-6) this.velocity[2] = 0;
    if (res.onGround || res.hitCeiling) this.velocity[1] = 0;
    this.onGround = res.onGround;

    const horiz = Math.hypot(this.velocity[0], this.velocity[2]);
    this.walkPhase += horiz * dt * 3.4;
    this.renderYaw = lerpAngle(this.renderYaw, this.yaw, 1 - Math.exp(-10 * dt));
  }

  damage(amount, source, manager) {
    if (this.dead) return;
    this.health -= amount;
    this.hurtTime = 0.35;
    this.panicTimer = this.hostile ? 0 : 4;
    bus.emit(EV.SOUND, 'mobHurt', { volume: 0.4, type: this.type });
    if (source) {
      const dx = this.position[0] - source[0];
      const dz = this.position[2] - source[2];
      const l = Math.hypot(dx, dz) || 1;
      this.velocity[0] += (dx / l) * 4.2;
      this.velocity[2] += (dz / l) * 4.2;
      this.velocity[1] = Math.max(this.velocity[1], 4.2);
    }
    if (this.health <= 0) this.die(manager);
  }

  die(manager) {
    if (this.dead) return;
    this.dead = true;
    bus.emit(EV.SOUND, 'mobDeath', { volume: 0.4, type: this.type });
    if (manager) {
      for (const [item, min, max] of (this.def.drops || [])) {
        const n = min + Math.floor(Math.random() * (max - min + 1));
        if (n > 0) manager.dropItem(this.position[0], this.position[1] + 0.4, this.position[2], item, n);
      }
      manager.spawnDeathParticles(this);
    }
  }

  _explode(player, manager) {
    this.dead = true;
    const [x, y, z] = this.position;
    const radius = 3.2;
    bus.emit(EV.SOUND, 'explode', { volume: 1 });
    // 破坏方块
    const world = this.world;
    const r = Math.ceil(radius);
    for (let dy = -r; dy <= r; dy++) {
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          const d = Math.hypot(dx, dy, dz);
          if (d > radius * (0.75 + Math.random() * 0.35)) continue;
          const bx = Math.floor(x) + dx, by = Math.floor(y + 0.5) + dy, bz = Math.floor(z) + dz;
          const id = world.getBlockSafe(bx, by, bz);
          if (id <= 0) continue;
          const b = BLOCKS[id];
          if (b.hardness < 0 || b.hardness > 12) continue;   // 基岩/黑曜石免疫
          world.setBlock(bx, by, bz, 0);
        }
      }
    }
    // 伤害玩家
    const dist = Math.hypot(player.position[0] - x, player.position[1] - y, player.position[2] - z);
    if (dist < radius * 2) {
      const dmg = Math.round((1 - dist / (radius * 2)) * 22);
      if (dmg > 0) player.damage(dmg, '被苦力怕炸死');
      const l = Math.max(0.5, dist);
      player.velocity[0] += ((player.position[0] - x) / l) * 12;
      player.velocity[1] += 6;
      player.velocity[2] += ((player.position[2] - z) / l) * 12;
    }
    if (manager) manager.spawnExplosionParticles(x, y + 0.5, z);
  }

  /** 动画：返回各部件的摆动角 */
  animation() {
    const swing = Math.sin(this.walkPhase) * 0.7;
    const swing2 = Math.sin(this.walkPhase + Math.PI) * 0.7;
    const idle = Math.sin(this.age * 1.6) * 0.06;
    return {
      legFL: swing, legFR: swing2, legBL: swing2, legBR: swing,
      armL: swing2 * 0.6, armR: swing * 0.6,
      head: idle,
      headYaw: this.headYaw,
      hurt: this.hurtTime > 0,
      fuse: this.fuse,
    };
  }
}
