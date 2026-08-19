/* =====================================================================
 * Player — 玩家实体：移动、碰撞、游泳、飞行、生命/饥饿/氧气、视角
 * ===================================================================== */
import { AABB } from '../math/AABB.js';
import { clamp, clamp01, damp } from '../math/MathUtils.js';
import { GRAVITY, GAMEMODE, CHUNK_HEIGHT, MATERIAL } from '../core/Constants.js';
import { collideMove, wouldFallOff, isColliding } from './Physics.js';
import { BLOCKS, SLIPPERINESS, idByName } from '../data/blocks.js';
import { bus, EV } from '../core/EventBus.js';

const WIDTH = 0.6;
const HEIGHT = 1.8;
const SNEAK_HEIGHT = 1.5;
const SWIM_HEIGHT = 0.9;
const EYE = 1.62;
const SNEAK_EYE = 1.27;

const SPEED_WALK = 4.317;
const SPEED_SPRINT = 5.612;
const SPEED_SNEAK = 1.31;
const SPEED_SWIM = 2.2;
const SPEED_FLY = 10.9;
const SPEED_FLY_FAST = 21.8;
const JUMP_VELOCITY = 8.95;      // ≈1.25 格跳跃高度
const WATER_JUMP = 4.0;

export class Player {
  constructor(world, spawn = [0.5, 70, 0.5]) {
    this.world = world;
    this.position = new Float32Array(spawn);
    this.velocity = new Float32Array(3);
    this.yaw = 0;
    this.pitch = 0;

    this.box = new AABB();
    this._syncBox();

    this.gamemode = GAMEMODE.CREATIVE;
    this.onGround = false;
    this.sneaking = false;
    this.sprinting = false;
    this.flying = false;
    this.inWater = false;
    this.headInWater = false;
    this.inLava = false;
    this.onLadder = false;
    this.swimming = false;

    // 状态
    this.health = 20;
    this.maxHealth = 20;
    this.food = 20;
    this.saturation = 5;
    this.air = 300;
    this.maxAir = 300;
    this.xp = 0;
    this.xpLevel = 0;
    this.dead = false;
    this.spawnPoint = spawn.slice();

    // 计时
    this.fallDistance = 0;
    this.damageCooldown = 0;
    this.regenTimer = 0;
    this.foodTimer = 0;
    this.stepDistance = 0;
    this.lastStepDistance = 0;
    this._jumpPressTime = -1;
    this._lastSpaceState = false;
    this.bobPhase = 0;
    this.bobAmount = 0;

    this.reach = 5;
    this.blockMaterial = MATERIAL.STONE;
    this._ids = { water: idByName('water'), lava: idByName('lava') };
  }

  get eyeHeight() {
    if (this.swimming) return 0.5;
    return this.sneaking ? SNEAK_EYE : EYE;
  }
  get height() {
    if (this.swimming) return SWIM_HEIGHT;
    return this.sneaking ? SNEAK_HEIGHT : HEIGHT;
  }
  get eyeY() { return this.position[1] + this.eyeHeight; }
  get isCreative() { return this.gamemode === GAMEMODE.CREATIVE; }
  get isSpectator() { return this.gamemode === GAMEMODE.SPECTATOR; }

  _syncBox() {
    this.box.setFromEntity(this.position[0], this.position[1], this.position[2], WIDTH, this.height);
  }

  setGamemode(mode) {
    this.gamemode = mode;
    if (mode !== GAMEMODE.CREATIVE && mode !== GAMEMODE.SPECTATOR) this.flying = false;
    if (mode === GAMEMODE.SPECTATOR) this.flying = true;
    bus.emit(EV.GAMEMODE_CHANGED, mode);
  }

  teleport(x, y, z) {
    this.position[0] = x; this.position[1] = y; this.position[2] = z;
    this.velocity.fill(0);
    this.fallDistance = 0;
    this._syncBox();
  }

  respawn() {
    const [x, y, z] = this.spawnPoint;
    const sy = this.world.highestSolidY(Math.floor(x), Math.floor(z));
    this.teleport(x, Math.max(y, sy + 0.1), z);
    this.health = this.maxHealth;
    this.food = 20;
    this.air = this.maxAir;
    this.dead = false;
    this.fallDistance = 0;
    bus.emit(EV.PLAYER_RESPAWN);
  }

  /* ================= 每帧更新 ================= */

  /**
   * @param {number} dt 秒
   * @param {{forward:number,strafe:number,jump:boolean,sneak:boolean,sprint:boolean,jumpPressed:boolean}} input
   */
  update(dt, input) {
    if (this.dead) return;
    const world = this.world;
    dt = Math.min(dt, 0.05);

    this._updateEnvironment();

    // ---- 双击空格切换飞行（创造模式） ----
    if (input.jumpPressed && (this.isCreative || this.isSpectator)) {
      const now = performance.now();
      if (this._jumpPressTime > 0 && now - this._jumpPressTime < 320) {
        this.flying = !this.flying;
        if (this.flying) this.velocity[1] = 0;
        this._jumpPressTime = -1;
      } else {
        this._jumpPressTime = now;
      }
    }
    if (!this.isCreative && !this.isSpectator) this.flying = false;

    this.sneaking = input.sneak && !this.flying && !this.swimming;
    const wantSprint = input.sprint && (input.forward > 0.1) && !this.sneaking;
    this.sprinting = wantSprint && (this.isCreative || this.food > 6);

    // ---- 目标速度 ----
    const fwd = input.forward, str = input.strafe;
    let len = Math.hypot(fwd, str);
    let dirX = 0, dirZ = 0;
    if (len > 0.001) {
      const nf = fwd / len, ns = str / len;
      const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
      dirX = (-sy * nf) + (cy * ns);
      dirZ = (-cy * nf) + (-sy * ns);
      len = Math.min(1, len);
    }

    let speed;
    if (this.flying) speed = (input.sprint ? SPEED_FLY_FAST : SPEED_FLY);
    else if (this.inWater) speed = SPEED_SWIM * (this.sprinting ? 1.35 : 1);
    else if (this.sneaking) speed = SPEED_SNEAK;
    else if (this.sprinting) speed = SPEED_SPRINT;
    else speed = SPEED_WALK;

    const targetVX = dirX * speed * len;
    const targetVZ = dirZ * speed * len;

    // ---- 加速度 / 摩擦 ----
    const groundBlock = world.getBlockSafe(
      Math.floor(this.position[0]), Math.floor(this.position[1] - 0.08), Math.floor(this.position[2]));
    const slip = this.onGround ? (SLIPPERINESS[groundBlock] || 0) : 0;
    let accel;
    if (this.flying) accel = 12;
    else if (this.inWater) accel = 6;
    else if (this.onGround) accel = slip > 0.9 ? 2.2 : 20;
    else accel = 4.5;

    const k = 1 - Math.exp(-accel * dt);
    this.velocity[0] += (targetVX - this.velocity[0]) * k;
    this.velocity[2] += (targetVZ - this.velocity[2]) * k;

    // ---- 垂直 ----
    if (this.flying) {
      let vy = 0;
      if (input.jump) vy += speed * 0.75;
      if (input.sneak) vy -= speed * 0.75;
      this.velocity[1] = damp(this.velocity[1], vy, 10, dt);
      this.fallDistance = 0;
    } else if (this.onLadder && (Math.abs(fwd) > 0.1 || input.jump)) {
      this.velocity[1] = input.sneak ? -1.5 : 2.4;
      this.fallDistance = 0;
    } else if (this.inWater) {
      // 浮力
      const buoy = this.headInWater ? -1.2 : -2.4;
      this.velocity[1] += (buoy - this.velocity[1]) * (1 - Math.exp(-4 * dt));
      if (input.jump) this.velocity[1] = WATER_JUMP;
      this.fallDistance = 0;
    } else if (this.inLava) {
      this.velocity[1] += (-1.0 - this.velocity[1]) * (1 - Math.exp(-3 * dt));
      if (input.jump) this.velocity[1] = 2.4;
    } else {
      this.velocity[1] -= GRAVITY * dt;
      if (this.velocity[1] < -78) this.velocity[1] = -78;
      if (input.jump && this.onGround) {
        this.velocity[1] = JUMP_VELOCITY;
        this.onGround = false;
        if (this.sprinting) {
          // 疾跑跳跃前冲
          this.velocity[0] += dirX * 1.6;
          this.velocity[2] += dirZ * 1.6;
        }
      }
    }

    // ---- 移动与碰撞 ----
    let dx = this.velocity[0] * dt;
    let dy = this.velocity[1] * dt;
    let dz = this.velocity[2] * dt;

    this._syncBox();

    // 潜行防跌落
    if (this.sneaking && this.onGround) {
      if (dx !== 0 && wouldFallOff(world, this.box, dx, 0)) dx = 0;
      if (dz !== 0 && wouldFallOff(world, this.box, 0, dz)) dz = 0;
    }

    let res;
    if (this.isSpectator) {
      this.box.translate(dx, dy, dz);
      res = { dx, dy, dz, onGround: false, hitCeiling: false, hitWall: false };
    } else {
      res = collideMove(world, this.box, dx, dy, dz, this.onGround ? 0.6 : 0);
    }

    this.position[0] = this.box.centerX;
    this.position[1] = this.box.minY;
    this.position[2] = this.box.centerZ;

    // 速度归零
    if (Math.abs(res.dx) < Math.abs(dx) - 1e-6) this.velocity[0] = 0;
    if (Math.abs(res.dz) < Math.abs(dz) - 1e-6) this.velocity[2] = 0;
    if (Math.abs(res.dy) < Math.abs(dy) - 1e-6) {
      if (this.velocity[1] < 0) this._onLanded();
      this.velocity[1] = 0;
    }

    const wasOnGround = this.onGround;
    this.onGround = res.onGround || (this.isSpectator ? false : this._checkGround());
    if (!wasOnGround && this.onGround) this._onLanded();

    // 下落距离
    if (!this.onGround && this.velocity[1] < 0 && !this.flying && !this.inWater) {
      this.fallDistance += -this.velocity[1] * dt;
    }

    // ---- 脚步 / 摇晃 ----
    const horizSpeed = Math.hypot(this.velocity[0], this.velocity[2]);
    this.stepDistance += horizSpeed * dt;
    const targetBob = (this.onGround && horizSpeed > 0.5) ? clamp01(horizSpeed / SPEED_WALK) : 0;
    this.bobAmount = damp(this.bobAmount, targetBob, 8, dt);
    this.bobPhase += horizSpeed * dt * 2.6;

    if (this.stepDistance - this.lastStepDistance > (this.sprinting ? 1.9 : 2.4) && this.onGround && horizSpeed > 0.4) {
      this.lastStepDistance = this.stepDistance;
      const bx = Math.floor(this.position[0]);
      const by = Math.floor(this.position[1] - 0.12);
      const bz = Math.floor(this.position[2]);
      const id = world.getBlockSafe(bx, by, bz);
      if (id > 0) {
        this.blockMaterial = BLOCKS[id].walkSound;
        bus.emit(EV.SOUND, 'step', { material: this.blockMaterial, volume: this.sneaking ? 0.15 : 0.35 });
      }
    }

    // ---- 生命 / 饥饿 / 氧气 ----
    this._updateVitals(dt);

    // 掉出世界
    if (this.position[1] < -6) this.damage(4, '掉进了虚空');

    this._lastSpaceState = input.jump;
    bus.emit(EV.PLAYER_MOVE, this.position);
  }

  _checkGround() {
    const probe = this.box.clone();
    probe.minY -= 0.04;
    probe.maxY = this.box.minY + 0.001;
    return isColliding(this.world, probe);
  }

  _onLanded() {
    if (this.fallDistance > 3.2 && !this.isCreative && !this.inWater) {
      const dmg = Math.floor(this.fallDistance - 3);
      if (dmg > 0) this.damage(dmg, '摔到了地面');
    }
    if (this.fallDistance > 0.6) {
      const bx = Math.floor(this.position[0]);
      const by = Math.floor(this.position[1] - 0.12);
      const bz = Math.floor(this.position[2]);
      const id = this.world.getBlockSafe(bx, by, bz);
      if (id > 0) {
        bus.emit(EV.SOUND, 'land', { material: BLOCKS[id].walkSound, volume: 0.4 });
      }
    }
    this.fallDistance = 0;
  }

  _updateEnvironment() {
    const world = this.world;
    const px = Math.floor(this.position[0]);
    const pz = Math.floor(this.position[2]);
    const feetY = Math.floor(this.position[1] + 0.1);
    const eyeYi = Math.floor(this.eyeY);

    const feetId = world.getBlockSafe(px, feetY, pz);
    const eyeId = world.getBlockSafe(px, eyeYi, pz);
    const wid = this._ids.water, lid = this._ids.lava;

    this.inWater = feetId === wid || eyeId === wid;
    this.headInWater = eyeId === wid;
    this.inLava = feetId === lid || eyeId === lid;
    this.swimming = this.headInWater && this.inWater;

    // 梯子 / 藤蔓
    const bodyY = Math.floor(this.position[1] + 0.9);
    const bodyId = world.getBlockSafe(px, bodyY, pz);
    this.onLadder = bodyId > 0 && BLOCKS[bodyId].climbable === true;
  }

  _updateVitals(dt) {
    if (this.isCreative || this.isSpectator) {
      this.air = this.maxAir;
      return;
    }
    this.damageCooldown = Math.max(0, this.damageCooldown - dt);

    // 氧气
    if (this.headInWater) {
      this.air -= dt * 60;
      if (this.air <= 0) {
        this.air = 0;
        this.drownTimer = (this.drownTimer || 0) + dt;
        if (this.drownTimer > 1) { this.drownTimer = 0; this.damage(2, '溺水了'); }
      }
    } else {
      this.air = Math.min(this.maxAir, this.air + dt * 240);
      this.drownTimer = 0;
    }

    // 岩浆伤害
    if (this.inLava) {
      this.lavaTimer = (this.lavaTimer || 0) + dt;
      if (this.lavaTimer > 0.5) { this.lavaTimer = 0; this.damage(4, '试图在岩浆里游泳'); }
    }

    // 饥饿消耗
    let drain = 0.006;
    if (this.sprinting) drain = 0.05;
    else if (Math.hypot(this.velocity[0], this.velocity[2]) > 0.5) drain = 0.018;
    this.foodTimer += drain * dt * 10;
    if (this.foodTimer >= 1) {
      this.foodTimer = 0;
      if (this.saturation > 0) this.saturation = Math.max(0, this.saturation - 1);
      else this.food = Math.max(0, this.food - 1);
    }

    // 自然回血
    if (this.food >= 18 && this.health < this.maxHealth) {
      this.regenTimer += dt;
      if (this.regenTimer > 3.5) {
        this.regenTimer = 0;
        this.health = Math.min(this.maxHealth, this.health + 1);
        this.food = Math.max(0, this.food - 0.4);
      }
    } else this.regenTimer = 0;

    // 饥饿伤害
    if (this.food <= 0) {
      this.starveTimer = (this.starveTimer || 0) + dt;
      if (this.starveTimer > 4) { this.starveTimer = 0; this.damage(1, '饿死了'); }
    }
  }

  damage(amount, reason = '') {
    if (this.isCreative || this.isSpectator || this.dead) return;
    if (this.damageCooldown > 0) return;
    this.health -= amount;
    this.damageCooldown = 0.5;
    bus.emit(EV.PLAYER_DAMAGE, amount, reason);
    bus.emit(EV.SOUND, 'hurt', { volume: 0.5 });
    if (this.health <= 0) {
      this.health = 0;
      this.dead = true;
      bus.emit(EV.PLAYER_DIED, reason);
    }
  }

  heal(amount) {
    this.health = Math.min(this.maxHealth, this.health + amount);
  }

  eat(item) {
    if (!item || !item.nutrition) return false;
    if (this.food >= 20 && !this.isCreative) return false;
    this.food = Math.min(20, this.food + item.nutrition);
    this.saturation = Math.min(this.food, this.saturation + item.saturation);
    bus.emit(EV.SOUND, 'eat', { volume: 0.4 });
    return true;
  }

  addXp(n) {
    this.xp += n;
    while (this.xp >= this.xpNeeded) {
      this.xp -= this.xpNeeded;
      this.xpLevel++;
    }
  }
  get xpNeeded() { return 7 + this.xpLevel * 3; }

  /** 是否站在方块上（用于 F3） */
  get standingOn() {
    const id = this.world.getBlockSafe(
      Math.floor(this.position[0]), Math.floor(this.position[1] - 0.1), Math.floor(this.position[2]));
    return id > 0 ? BLOCKS[id].display : '空气';
  }

  serialize() {
    return {
      position: [...this.position],
      yaw: this.yaw, pitch: this.pitch,
      health: this.health, food: this.food, air: this.air,
      xp: this.xp, xpLevel: this.xpLevel,
      gamemode: this.gamemode, flying: this.flying,
      spawnPoint: [...this.spawnPoint],
    };
  }

  deserialize(d) {
    if (!d) return;
    if (d.position) this.teleport(d.position[0], d.position[1], d.position[2]);
    if (typeof d.yaw === 'number') this.yaw = d.yaw;
    if (typeof d.pitch === 'number') this.pitch = d.pitch;
    if (typeof d.health === 'number') this.health = d.health;
    if (typeof d.food === 'number') this.food = d.food;
    if (typeof d.air === 'number') this.air = d.air;
    if (typeof d.xp === 'number') this.xp = d.xp;
    if (typeof d.xpLevel === 'number') this.xpLevel = d.xpLevel;
    if (d.gamemode) this.setGamemode(d.gamemode);
    if (typeof d.flying === 'boolean') this.flying = d.flying;
    if (d.spawnPoint) this.spawnPoint = d.spawnPoint.slice();
    this.dead = this.health <= 0;
  }
}

export { WIDTH as PLAYER_WIDTH, HEIGHT as PLAYER_HEIGHT };
void clamp; void CHUNK_HEIGHT;
