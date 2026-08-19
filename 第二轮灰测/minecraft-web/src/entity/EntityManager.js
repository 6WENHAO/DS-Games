/* =====================================================================
 * EntityManager — 生物生成/更新/清理、掉落物实体
 * ===================================================================== */
import { Mob } from './Mob.js';
import { AABB } from '../math/AABB.js';
import { collideMove } from './Physics.js';
import { GRAVITY, GAMEMODE } from '../core/Constants.js';
import { PASSIVE_MOBS, HOSTILE_MOBS, MOB_TYPES } from './MobModels.js';
import { biomeInfo } from '../world/Biomes.js';
import { bus, EV } from '../core/EventBus.js';
import { idByName } from '../data/blocks.js';
import settings from '../core/Settings.js';

const MAX_PASSIVE = 14;
const MAX_HOSTILE = 16;
const WATER_ID = idByName('water');

/** 掉落物实体 */
export class ItemEntity {
  constructor(world, x, y, z, item, count) {
    this.world = world;
    this.position = new Float32Array([x, y, z]);
    this.velocity = new Float32Array([
      (Math.random() - 0.5) * 2.2, 3.2 + Math.random(), (Math.random() - 0.5) * 2.2,
    ]);
    this.item = item;
    this.count = count;
    this.age = 0;
    this.pickupDelay = 0.45;
    this.dead = false;
    this.spin = Math.random() * Math.PI * 2;
    this.box = new AABB();
    this.onGround = false;
    this._sync();
  }
  _sync() {
    this.box.setFromEntity(this.position[0], this.position[1], this.position[2], 0.28, 0.28);
  }
  update(dt) {
    this.age += dt;
    this.pickupDelay = Math.max(0, this.pickupDelay - dt);
    this.spin += dt * 1.6;
    const inWater = this.world.getBlockSafe(
      Math.floor(this.position[0]), Math.floor(this.position[1] + 0.1), Math.floor(this.position[2])) === WATER_ID;
    if (inWater) {
      this.velocity[1] += (1.0 - this.velocity[1]) * (1 - Math.exp(-6 * dt));
    } else {
      this.velocity[1] -= GRAVITY * 0.55 * dt;
    }
    const fr = this.onGround ? 6 : 1.2;
    const k = 1 - Math.exp(-fr * dt);
    this.velocity[0] -= this.velocity[0] * k;
    this.velocity[2] -= this.velocity[2] * k;

    this._sync();
    const res = collideMove(this.world, this.box,
      this.velocity[0] * dt, this.velocity[1] * dt, this.velocity[2] * dt, 0);
    this.position[0] = this.box.centerX;
    this.position[1] = this.box.minY;
    this.position[2] = this.box.centerZ;
    this.onGround = res.onGround;
    if (res.onGround || res.hitCeiling) this.velocity[1] = 0;
    if (this.age > 300) this.dead = true;
    if (this.position[1] < -4) this.dead = true;
  }
}

export class EntityManager {
  constructor(world, particles) {
    this.world = world;
    this.particles = particles;
    /** @type {Mob[]} */
    this.mobs = [];
    /** @type {ItemEntity[]} */
    this.items = [];
    this.spawnTimer = 3;
    this.onPickup = null;    // (itemName, count) => 剩余数量
    this.stats = { mobs: 0, items: 0 };
  }

  clear() {
    this.mobs.length = 0;
    this.items.length = 0;
  }

  spawnMob(type, x, y, z) {
    if (!MOB_TYPES[type]) return null;
    const m = new Mob(this.world, type, x, y, z);
    this.mobs.push(m);
    return m;
  }

  dropItem(x, y, z, item, count = 1) {
    if (!item || count <= 0) return null;
    // 合并附近的同种掉落物
    for (const e of this.items) {
      if (e.dead || e.item !== item) continue;
      const d = Math.hypot(e.position[0] - x, e.position[1] - y, e.position[2] - z);
      if (d < 0.8 && e.count + count <= 64) { e.count += count; return e; }
    }
    const it = new ItemEntity(this.world, x, y, z, item, count);
    this.items.push(it);
    return it;
  }

  update(dt, player) {
    // ---- 生物 ----
    for (let i = this.mobs.length - 1; i >= 0; i--) {
      const m = this.mobs[i];
      m.update(dt, player, this);
      if (m.dead) this.mobs.splice(i, 1);
    }

    // ---- 掉落物 ----
    for (let i = this.items.length - 1; i >= 0; i--) {
      const e = this.items[i];
      e.update(dt);
      if (!e.dead && e.pickupDelay <= 0) {
        const dx = player.position[0] - e.position[0];
        const dy = (player.position[1] + 0.9) - e.position[1];
        const dz = player.position[2] - e.position[2];
        const d = Math.hypot(dx, dy, dz);
        if (d < 1.5) {
          // 吸附
          const pull = (1.5 - d) * 5;
          e.velocity[0] += (dx / (d || 1)) * pull * dt * 6;
          e.velocity[1] += (dy / (d || 1)) * pull * dt * 6;
          e.velocity[2] += (dz / (d || 1)) * pull * dt * 6;
        }
        if (d < 0.85 && this.onPickup) {
          const left = this.onPickup(e.item, e.count);
          if (left <= 0) {
            e.dead = true;
            bus.emit(EV.SOUND, 'pickup', { volume: 0.25 });
            bus.emit(EV.ITEM_PICKUP, e.item, e.count);
          } else if (left < e.count) {
            e.count = left;
            bus.emit(EV.SOUND, 'pickup', { volume: 0.2 });
          }
        }
      }
      if (e.dead) this.items.splice(i, 1);
    }

    // ---- 自动生成 ----
    if (settings.get('mobs') && player.gamemode !== GAMEMODE.SPECTATOR) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnTimer = 2.5;
        this._trySpawn(player);
      }
    }

    this.stats.mobs = this.mobs.length;
    this.stats.items = this.items.length;
  }

  _trySpawn(player) {
    const world = this.world;
    const night = world.daylight < 0.35;
    let passive = 0, hostile = 0;
    for (const m of this.mobs) { if (m.hostile) hostile++; else passive++; }

    const attempts = 6;
    for (let a = 0; a < attempts; a++) {
      const ang = Math.random() * Math.PI * 2;
      const dist = 16 + Math.random() * 30;
      const x = Math.floor(player.position[0] + Math.cos(ang) * dist);
      const z = Math.floor(player.position[2] + Math.sin(ang) * dist);
      const chunk = world.getChunkAt(x, z);
      if (!chunk || chunk.state < 3) continue;

      const h = chunk.heightMap[((z & 15) << 4) | (x & 15)];
      if (h <= 1) continue;
      const y = h;
      const ground = world.getBlockSafe(x, y - 1, z);
      if (ground <= 0 || ground === WATER_ID) continue;
      if (world.getBlockSafe(x, y, z) !== 0 || world.getBlockSafe(x, y + 1, z) !== 0) continue;

      const sky = world.getSkyLight(x, y, z);
      const blockLight = world.getBlockLight(x, y, z);
      const biome = biomeInfo(world.biomeAt(x, z));

      if (night && hostile < MAX_HOSTILE && blockLight < 8 && Math.random() < 0.75) {
        const type = HOSTILE_MOBS[(Math.random() * HOSTILE_MOBS.length) | 0];
        this.spawnMob(type, x + 0.5, y, z + 0.5);
        hostile++;
      } else if (!night && passive < MAX_PASSIVE && sky > 8) {
        const list = (biome.mobs || []).filter(t => PASSIVE_MOBS.includes(t));
        const type = list.length ? list[(Math.random() * list.length) | 0]
          : PASSIVE_MOBS[(Math.random() * PASSIVE_MOBS.length) | 0];
        // 成群生成
        const n = 1 + ((Math.random() * 3) | 0);
        for (let k = 0; k < n && passive < MAX_PASSIVE; k++) {
          this.spawnMob(type, x + 0.5 + (Math.random() - 0.5) * 3, y, z + 0.5 + (Math.random() - 0.5) * 3);
          passive++;
        }
      }
    }
  }

  /** 初始生成一批动物，让世界不至于太空 */
  populateInitial(player, count = 8) {
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const dist = 8 + Math.random() * 24;
      const x = Math.floor(player.position[0] + Math.cos(ang) * dist);
      const z = Math.floor(player.position[2] + Math.sin(ang) * dist);
      const y = this.world.highestSolidY(x, z);
      if (y < 2) continue;
      const biome = biomeInfo(this.world.biomeAt(x, z));
      const list = (biome.mobs || []).filter(t => PASSIVE_MOBS.includes(t));
      const type = list.length ? list[(Math.random() * list.length) | 0] : 'pig';
      this.spawnMob(type, x + 0.5, y, z + 0.5);
    }
  }

  killAll() {
    const n = this.mobs.length;
    this.mobs.length = 0;
    return n;
  }

  spawnDeathParticles(mob) {
    if (!this.particles) return;
    const c = mob.def.parts[0]?.color || '#ffffff';
    this.particles.burstColor(mob.position[0], mob.position[1] + mob.height * 0.5, mob.position[2], c, 12);
  }

  spawnExplosionParticles(x, y, z) {
    if (!this.particles) return;
    this.particles.explosion(x, y, z);
  }

  /** 攻击距离内的生物 */
  hitEntity(entity, damage, sourcePos) {
    entity.damage(damage, sourcePos, this);
  }
}
