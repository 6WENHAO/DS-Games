/* =========================================================================
 * GREENFALL · entities.js —— 玩家物理 / 生物 AI / 噪音与仇恨
 *
 * 僵尸设计原则：数量少、速度慢、靠"声音与光"被吸引 —— 是环境压力而非主角。
 * 真正的日常威胁来自野狗、野猪、孢子云、失温、脱水与感染。
 * ======================================================================= */
(function (GF) {
  'use strict';

  const U = GF.util;
  const G = 26;                       // 重力 m/s²

  /* ================================================== 实体类型配置
   * chaseMax : 连续追击的最长秒数，超过就放弃（给玩家喘息时间）
   * chaseCd  : 放弃后多久不会再主动锁定你
   * fleeAtHp : 血量低于该比例时转为逃跑（野生动物会认输）
   */
  const TYPES = {
    zombie: {
      name: '游荡者', model: 'zombie', hp: 62, w: 0.62, h: 1.85, eye: 1.6,
      speed: 1.15, chaseSpeed: 2.55, dmg: 9, reach: 1.5, cd: 1.5,
      hostile: true, hearing: 26, sight: 17, infect: 0.22, bleed: 0.25,
      chaseMax: 26, chaseCd: 6,
      drops: [['cloth_scrap', 0, 2], ['bone', 0, 2], ['spore_sample', 0, 1], ['rag_bandage', 0, 1]],
      xp: 6, noise: 0.6, night: 3.0, urban: 3.2,
    },
    zombie_husk: {
      name: '苔壳者', model: 'zombie', tint: [0.72, 0.95, 0.66], hp: 110, w: 0.7, h: 2.0, eye: 1.7,
      speed: 0.9, chaseSpeed: 2.0, dmg: 15, reach: 1.7, cd: 1.9,
      hostile: true, hearing: 30, sight: 15, infect: 0.4, bleed: 0.3, armor: 6,
      chaseMax: 30, chaseCd: 5,
      drops: [['spore_sample', 1, 3], ['fungal_fiber', 1, 2], ['moss', 1, 3]],
      xp: 14, night: 2.2, urban: 1.4, rare: true,
    },
    zombie_runner: {
      name: '奔行者', model: 'zombie', tint: [1.0, 0.86, 0.86], hp: 40, w: 0.55, h: 1.8, eye: 1.6,
      speed: 1.6, chaseSpeed: 4.6, dmg: 7, reach: 1.4, cd: 1.0,
      hostile: true, hearing: 34, sight: 22, infect: 0.28, bleed: 0.4,
      chaseMax: 16, chaseCd: 10,
      drops: [['cloth_scrap', 0, 2], ['bone', 0, 1]],
      xp: 10, night: 1.4, urban: 1.2, rare: true,
    },
    dog: {
      name: '野狗', model: 'dog', hp: 26, w: 0.6, h: 0.85, eye: 0.65,
      speed: 2.4, chaseSpeed: 5.0, dmg: 6, reach: 1.3, cd: 1.05,
      hostile: true, hearing: 26, sight: 20, bleed: 0.35, pack: 2,
      chaseMax: 7, chaseCd: 15, fleeAtHp: 0.34, predator: true,
      drops: [['meat_raw', 1, 2], ['leather_raw', 0, 1], ['bone', 1, 2], ['sinew', 0, 1]],
      xp: 5, night: 0.5, urban: 0.28, wild: 0.55,
    },
    boar: {
      name: '野猪', model: 'boar', hp: 48, w: 0.9, h: 1.0, eye: 0.8,
      speed: 1.6, chaseSpeed: 4.6, dmg: 12, reach: 1.4, cd: 1.5,
      hostile: false, retaliate: true, hearing: 18, sight: 16, bleed: 0.3,
      chaseMax: 5, chaseCd: 18, fleeAtHp: 0.3,
      drops: [['meat_raw', 2, 4], ['leather_raw', 1, 2], ['bone', 1, 3], ['sinew', 0, 2]],
      xp: 8, wild: 0.85,
    },
    deer: {
      name: '鹿', model: 'deer', hp: 32, w: 0.8, h: 1.5, eye: 1.3,
      speed: 2.0, chaseSpeed: 7.0, dmg: 0, reach: 0, cd: 2,
      hostile: false, flee: true, hearing: 30, sight: 30,
      drops: [['meat_raw', 3, 5], ['leather_raw', 1, 2], ['bone', 2, 3], ['sinew', 1, 2]],
      xp: 6, wild: 2.8,
    },
    crow: {
      name: '乌鸦', model: 'crow', hp: 6, w: 0.4, h: 0.4, eye: 0.3,
      speed: 2.2, chaseSpeed: 5, dmg: 0, reach: 0, cd: 2,
      hostile: false, flee: true, hearing: 24, sight: 24, fly: true,
      drops: [['feather', 1, 3], ['meat_raw', 0, 1], ['bone', 0, 1]],
      xp: 2, wild: 2.0, urban: 1.6,
    },
    raider: {
      name: '拾荒匪', model: 'survivor', tint: [0.9, 0.8, 0.7], hp: 70, w: 0.6, h: 1.85, eye: 1.62,
      speed: 2.6, chaseSpeed: 4.6, dmg: 13, reach: 1.7, cd: 1.1,
      hostile: true, hearing: 30, sight: 26, bleed: 0.4, armor: 3,
      chaseMax: 15, chaseCd: 12, fleeAtHp: 0.2, predator: true,
      drops: [['ammo_9mm', 2, 8], ['rag_bandage', 1, 2], ['jerky', 0, 2], ['knife_hunting', 0, 1], ['coin_stash', 1, 3]],
      xp: 18, night: 0.8, urban: 0.7, rare: true,
    },
    spore: {
      name: '孢子云', model: 'spore', hp: 9999, w: 1.8, h: 1.8, eye: 0.9,
      speed: 0.2, chaseSpeed: 0.2, dmg: 0, reach: 0, cd: 1,
      hostile: false, static: true, hazard: { infect: 0.05, dmg: 0.6, radius: 3.2 },
      drops: [], xp: 0, blight: 6,
    },
  };

  /* ================================================== 基础实体 */
  let NEXT_ID = 1;
  class Entity {
    constructor(type, x, y, z) {
      this.id = NEXT_ID++;
      this.type = type;
      this.cfg = TYPES[type] || TYPES.zombie;
      this.x = x; this.y = y; this.z = z;
      this.vx = 0; this.vy = 0; this.vz = 0;
      this.yaw = Math.random() * 6.283;
      this.hp = this.cfg.hp;
      this.model = this.cfg.model;
      this.tint = this.cfg.tint || null;
      this.scale = 1;
      this.state = 'idle';
      this.target = null;
      this.attackCd = 0;
      this.moving = false;
      this.onGround = false;
      this.wanderT = 0;
      this.wx = 0; this.wz = 0;
      this.alertT = 0;
      this.bleeding = 0;
      this.stun = 0;
      this.lastNoise = null;
      this.age = 0;
      this.flashT = 0;
      this.chaseT = 0;          // 已连续追击秒数
      this.chaseCd = 0;         // 放弃后的冷却（>0 时不会主动锁定玩家）
      this.gaveUp = false;
    }

    get width() { return this.cfg.w; }
    get height() { return this.cfg.h; }

    /* --------------------------------------------- AABB 物理 */
    physics(world, dt) {
      const cfg = this.cfg;
      if (cfg.static) { this.onGround = true; return; }
      const hw = cfg.w / 2, hh = cfg.h;
      // 重力 / 浮力
      const inWater = world.isLiquid(Math.floor(this.x), Math.floor(this.y + 0.4), Math.floor(this.z));
      if (cfg.fly) {
        this.vy += (this.flyTarget != null ? (this.flyTarget - this.y) * 2.2 : 0) * dt;
        this.vy *= 0.94;
      } else if (inWater) {
        this.vy += (-G * 0.22) * dt;
        this.vy = Math.max(this.vy, -2.2);
        if (this.state === 'chase' || this.state === 'flee') this.vy += 3.4 * dt;
      } else {
        this.vy -= G * dt;
      }
      this.vy = Math.max(-42, this.vy);

      // 水平阻尼：指数衰减（地面抓地力强，空中几乎不减速）
      // k 越大越"抓地"：13 表示约 0.2s 内衰减到 7%，走路不会像在冰上滑
      const k = inWater ? 5.0 : (cfg.fly ? 1.0 : (this.onGround ? 14.0 : 0.9));
      const damp = Math.exp(-k * dt);
      this.vx *= damp;
      this.vz *= damp;

      // 分轴移动 + 碰撞
      this.onGround = false;
      const move = (ax, amt) => {
        if (amt === 0) return;
        const step = Math.sign(amt) * Math.min(Math.abs(amt), 0.45);
        let left = amt;
        while (Math.abs(left) > 1e-6) {
          const d = Math.abs(left) > 0.45 ? step : left;
          if (ax === 0) this.x += d; else if (ax === 1) this.y += d; else this.z += d;
          if (collides(world, this.x, this.y, this.z, hw, hh)) {
            // 尝试自动上台阶
            if (ax !== 1 && this.onGroundish(world, hw, hh)) {
              const oy = this.y;
              this.y += 0.58;
              if (!collides(world, this.x, this.y, this.z, hw, hh)) { left -= d; continue; }
              this.y = oy;
            }
            if (ax === 0) { this.x -= d; this.vx = 0; }
            else if (ax === 1) {
              this.y -= d;
              if (d < 0) {
                if (this.vy < -14) this.onLand(-this.vy);
                this.onGround = true;
              }
              this.vy = 0;
            } else { this.z -= d; this.vz = 0; }
            return;
          }
          left -= d;
        }
      };
      move(1, this.vy * dt);
      move(0, this.vx * dt);
      move(2, this.vz * dt);
      // 卡住时向上顶出
      if (collides(world, this.x, this.y, this.z, hw, hh)) this.y += 0.6 * dt * 8;
    }
    onGroundish(world, hw, hh) {
      return collides(world, this.x, this.y - 0.05, this.z, hw, 0.1) || this.onGround;
    }
    onLand() { }

    lookAt(tx, tz) { this.yaw = Math.atan2(tx - this.x, tz - this.z); }

    hurt(amount, src) {
      const armor = this.cfg.armor || 0;
      const dmg = Math.max(1, amount - armor * (0.4 + Math.random() * 0.4));
      this.hp -= dmg;
      this.flashT = 0.22;
      this.stun = Math.min(0.4, dmg * 0.02);
      const cfg = this.cfg;
      // 血量过低的野生动物会认输逃跑
      if (cfg.fleeAtHp && this.hp > 0 && this.hp / cfg.hp < cfg.fleeAtHp) {
        this.state = 'flee'; this.alertT = 9;
        this.chaseCd = cfg.chaseCd || 10; this.chaseT = 0;
        return dmg;
      }
      if (cfg.flee) { this.state = 'flee'; this.alertT = 12; }
      else if (cfg.hostile || cfg.retaliate) {
        // 被攻击就会还手（清掉冷却），但追击时长仍然受 chaseMax 限制
        this.chaseCd = 0;
        this.state = 'chase'; this.alertT = 20; this.target = src || this.target;
      }
      return dmg;
    }
  }

  function collides(world, x, y, z, hw, hh) {
    const x0 = Math.floor(x - hw), x1 = Math.floor(x + hw);
    const y0 = Math.floor(y), y1 = Math.floor(y + hh - 0.001);
    const z0 = Math.floor(z - hw), z1 = Math.floor(z + hw);
    for (let yy = y0; yy <= y1; yy++) for (let zz = z0; zz <= z1; zz++) for (let xx = x0; xx <= x1; xx++) {
      if (world.isSolid(xx, yy, zz)) return true;
    }
    return false;
  }
  GF.collides = collides;

  /* ====================================================== 玩家 */
  class Player extends Entity {
    constructor(x, y, z) {
      super('zombie', x, y, z);       // 借用基类物理
      this.cfg = { w: 0.6, h: 1.8, static: false };
      this.type = 'player';
      this.pitch = 0; this.yaw = 0;
      this.crouch = false; this.sprint = false;
      this.eye = 1.62;
      this.hp = 100; this.maxHp = 100;
      this.fallStart = null;
      this.swimT = 0;
      this.bob = 0;
      this.stepDist = 0;
      this.noiseLevel = 0;
    }
    get eyeY() { return this.y + (this.crouch ? 1.28 : this.eye); }
    dirVec() {
      const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
      return [Math.sin(this.yaw) * cp, sp, Math.cos(this.yaw) * cp];
    }
    onLand(speed) {
      const dmg = Math.max(0, (speed - 15.5)) * 3.4;
      if (dmg > 0) GF.bus.emit('player:fall', { dmg, speed });
    }
  }

  /* ============================================== 实体管理器 */
  class EntityManager {
    constructor(world) {
      this.world = world;
      this.list = [];
      this.noises = [];             // {x,y,z,level,t}
      this.spawnT = 0;
      this.zombieMul = 0.55;        // 僵尸密度（可在设置里调）
      this.animalMul = 1.0;
      this.maxEntities = 46;
      this.maxHostile = 7;          // 同时存在的敌对生物上限
      this.predatorCd = 0;          // 掠食者（野狗/拾荒匪）成群刷新后的冷却
      this.corpses = [];
    }

    add(type, x, y, z) {
      if (this.list.length >= this.maxEntities + 12) return null;
      const e = new Entity(type, x, y, z);
      this.list.push(e);
      return e;
    }

    /** 制造噪音：吸引僵尸 */
    noise(x, y, z, level) {
      this.noises.push({ x, y, z, level, t: 0 });
      if (this.noises.length > 40) this.noises.shift();
    }

    /* ---------------------------------------------------- 生成 */
    trySpawn(player, dt) {
      const w = this.world;
      this.spawnT -= dt;
      if (this.spawnT > 0) return;
      this.spawnT = 2.2 + Math.random() * 3.0;
      if (this.list.length >= this.maxEntities) return;

      const night = w.isNight();
      const lm = GF.Landmarks.nearest(player.x, player.z);
      const urban = lm.d < (lm.l ? lm.l.r + 40 : 0) && lm.l && lm.l.noVeg;
      // 当前敌对生物数量：满了就只刷被动动物，保证不会被无限围攻
      let hostileNow = 0;
      for (const e of this.list) if (e.cfg.hostile) hostileNow++;
      const hostileFull = hostileNow >= this.maxHostile;
      const predatorReady = this.predatorCd <= 0;

      // 选生成点：玩家 24~52 格外，视野外优先
      for (let attempt = 0; attempt < 8; attempt++) {
        const a = Math.random() * 6.283, r = 26 + Math.random() * 26;
        const sx = Math.floor(player.x + Math.cos(a) * r);
        const sz = Math.floor(player.z + Math.sin(a) * r);
        const c = w.getChunk(Math.floor(sx / GF.CHUNK), Math.floor(sz / GF.CHUNK));
        if (!c || !c.ready) continue;
        const lx = sx - c.cx * GF.CHUNK, lz = sz - c.cz * GF.CHUNK;
        const gy = c.heightMap[lx + lz * GF.CHUNK] + 1;
        if (gy <= GF.SEA + 1 || gy >= GF.HEIGHT - 4) continue;
        if (w.isSolid(sx, gy, sz) || w.isSolid(sx, gy + 1, sz)) continue;
        const bio = GF.Biomes.list[c.biomeMap[lx + lz * GF.CHUNK]];
        const light = c.sky ? c.sky[GF.blockIndex(lx, gy, lz)] : 15;

        // 权重表
        const cand = [];
        for (const k of Object.keys(TYPES)) {
          const t = TYPES[k];
          if (t.static && bio.key !== 'blight') continue;
          if (t.hostile && hostileFull) continue;              // 敌对已满
          if (t.predator && !predatorReady) continue;          // 掠食者冷却中
          let wgt = 0;
          if (t.night) wgt += (night ? t.night : t.night * 0.16);
          if (t.urban) wgt += urban ? t.urban : t.urban * 0.12;
          if (t.wild) wgt += urban ? t.wild * 0.3 : t.wild;
          if (t.blight) wgt += bio.key === 'blight' ? t.blight : 0;
          if (k.startsWith('zombie')) wgt *= this.zombieMul * (light < 6 ? 1.5 : 1);
          else if (k === 'raider') wgt *= this.zombieMul * 0.55;
          else wgt *= this.animalMul;
          if (t.rare) wgt *= 0.34;
          if (wgt > 0) cand.push({ w: wgt, k });
        }
        const pick = U.weightedPick(cand, Math.random);
        if (!pick) continue;
        const t = TYPES[pick.k];
        const n = t.pack ? 1 + Math.floor(Math.random() * t.pack) : 1;
        for (let i = 0; i < n; i++) {
          const e = this.add(pick.k, sx + 0.5 + (Math.random() - 0.5) * 3, gy, sz + 0.5 + (Math.random() - 0.5) * 3);
          if (e && t.fly) e.flyTarget = gy + 3 + Math.random() * 6;
        }
        // 掠食者成群出现后，给玩家一段安静时间
        if (t.predator) this.predatorCd = 55 + Math.random() * 50;
        return;
      }
    }

    /* ---------------------------------------------------- 更新 */
    update(dt, player, survival) {
      const w = this.world;
      if (this.predatorCd > 0) this.predatorCd -= dt;
      // 噪音衰减
      for (const n of this.noises) n.t += dt;
      this.noises = this.noises.filter((n) => n.t < 4.5);

      for (let i = this.list.length - 1; i >= 0; i--) {
        const e = this.list[i];
        e.age += dt;
        e.flashT = Math.max(0, e.flashT - dt);
        const cfg = e.cfg;
        const dx = player.x - e.x, dz = player.z - e.z, dy = player.y - e.y;
        const dist = Math.hypot(dx, dz);

        // 死亡
        if (e.hp <= 0) { this.kill(e, i, player); continue; }
        // 太远则移除
        if (dist > 118) { this.list.splice(i, 1); continue; }

        // 静态危害（孢子云）
        if (cfg.hazard) {
          e.y = e.y;  // 静止
          if (dist < cfg.hazard.radius && Math.abs(dy) < 3) {
            survival.sporeExposure(dt * (1 - dist / cfg.hazard.radius));
          }
          continue;
        }

        if (e.stun > 0) { e.stun -= dt; e.physics(w, dt); continue; }

        /* ---- 感知 ---- */
        const canSee = dist < cfg.sight && Math.abs(dy) < 12 && this.hasLine(e, player);
        let heard = null;
        for (const n of this.noises) {
          const nd = Math.hypot(n.x - e.x, n.z - e.z);
          if (nd < cfg.hearing * (0.35 + n.level / 40)) { heard = n; break; }
        }
        const playerNoise = player.noiseLevel || 0;
        const noticedByNoise = dist < cfg.hearing * (0.25 + playerNoise / 45);
        if (e.chaseCd > 0) e.chaseCd -= dt;
        const canAcquire = e.chaseCd <= 0;

        if (cfg.hostile) {
          if (e.state === 'flee') {
            if (e.alertT <= 0) e.state = 'idle';
          } else if ((canSee || noticedByNoise) && canAcquire) {
            e.state = 'chase'; e.alertT = 9; e.target = player;
          } else if (heard && e.state !== 'chase' && canAcquire) {
            e.state = 'seek'; e.wx = heard.x; e.wz = heard.z; e.alertT = 6;
          } else if (e.alertT <= 0 && e.state !== 'idle') e.state = 'idle';
        } else if (cfg.flee) {
          if (canSee && dist < cfg.sight * 0.55) { e.state = 'flee'; e.alertT = 5; }
          else if (e.alertT <= 0) e.state = 'idle';
        } else if (cfg.retaliate) {
          if (e.state === 'chase' && e.alertT <= 0) e.state = 'idle';
        }
        e.alertT -= dt;

        /* ---- 追击时长限制：追久了就放弃，走开喘口气 ---- */
        if (e.state === 'chase') {
          e.chaseT += dt;
          const lim = cfg.chaseMax || 999;
          if (e.chaseT > lim) {
            e.chaseT = 0;
            e.chaseCd = cfg.chaseCd || 8;
            e.target = null;
            e.alertT = 0;
            // 动物会小跑离开，僵尸只是失去兴趣继续游荡
            if (cfg.fleeAtHp || cfg.flee) { e.state = 'flee'; e.alertT = 2.5; }
            else e.state = 'idle';
            e.gaveUp = true;
            GF.bus.emit('mob:giveup', { e, dist });
          }
        } else if (e.chaseT > 0) {
          e.chaseT = Math.max(0, e.chaseT - dt * 0.6);   // 脱战后慢慢回复"体力"
        }

        /* ---- 行为 ---- */
        let mvx = 0, mvz = 0, spd = cfg.speed;
        if (e.state === 'chase' && e.target) {
          spd = cfg.chaseSpeed;
          const d = Math.hypot(dx, dz) || 1;
          mvx = dx / d; mvz = dz / d;
          e.lookAt(player.x, player.z);
          if (dist < cfg.reach + 0.35 && Math.abs(dy) < 2.2) {
            mvx *= 0.15; mvz *= 0.15;
            e.attackCd -= dt;
            if (e.attackCd <= 0) {
              e.attackCd = cfg.cd;
              GF.bus.emit('player:hit', {
                dmg: cfg.dmg * (0.85 + Math.random() * 0.3),
                infect: cfg.infect || 0, bleed: cfg.bleed || 0, from: e,
              });
            }
          }
        } else if (e.state === 'flee') {
          spd = cfg.chaseSpeed;
          const d = Math.hypot(dx, dz) || 1;
          mvx = -dx / d; mvz = -dz / d;
          e.lookAt(e.x - dx, e.z - dz);
        } else if (e.state === 'seek') {
          const sdx = e.wx - e.x, sdz = e.wz - e.z, d = Math.hypot(sdx, sdz) || 1;
          if (d < 2) e.state = 'idle';
          else { mvx = sdx / d; mvz = sdz / d; e.lookAt(e.wx, e.wz); }
        } else {
          e.wanderT -= dt;
          if (e.wanderT <= 0) {
            e.wanderT = 2.5 + Math.random() * 5;
            const a = Math.random() * 6.283;
            e.wx = e.x + Math.cos(a) * (4 + Math.random() * 10);
            e.wz = e.z + Math.sin(a) * (4 + Math.random() * 10);
          }
          const sdx = e.wx - e.x, sdz = e.wz - e.z, d = Math.hypot(sdx, sdz) || 1;
          if (d > 1.2) { mvx = sdx / d * 0.5; mvz = sdz / d * 0.5; e.lookAt(e.wx, e.wz); }
        }

        e.moving = Math.abs(mvx) + Math.abs(mvz) > 0.05;
        const acc = 22;
        e.vx += mvx * spd * acc * dt;
        e.vz += mvz * spd * acc * dt;
        const vmax = spd;
        const vh = Math.hypot(e.vx, e.vz);
        if (vh > vmax) { e.vx = e.vx / vh * vmax; e.vz = e.vz / vh * vmax; }

        // 遇障碍跳一下
        if (e.moving && e.onGround && !cfg.fly) {
          const fx = Math.floor(e.x + mvx * 0.7), fz = Math.floor(e.z + mvz * 0.7);
          if (w.isSolid(fx, Math.floor(e.y), fz) && !w.isSolid(fx, Math.floor(e.y) + 2, fz)) e.vy = 7.4;
        }
        // 鸟类飞行高度维持
        if (cfg.fly) {
          const gy = this.groundY(e.x, e.z);
          e.flyTarget = gy + 4 + Math.sin(e.age * 0.6 + e.id) * 2.5;
        }
        e.physics(w, dt);

        // 流血
        if (e.bleeding > 0) { e.hp -= e.bleeding * dt; e.bleeding = Math.max(0, e.bleeding - dt * 0.15); }
      }

      this.trySpawn(player, dt);
    }

    hasLine(e, player) {
      const w = this.world;
      const ex = e.x, ey = e.y + (e.cfg.eye || 1.5), ez = e.z;
      const tx = player.x, ty = player.eyeY, tz = player.z;
      const d = Math.hypot(tx - ex, ty - ey, tz - ez);
      if (d < 1.5) return true;
      const steps = Math.min(28, Math.ceil(d));
      for (let i = 1; i < steps; i++) {
        const t = i / steps;
        if (w.isOpaque(Math.floor(ex + (tx - ex) * t), Math.floor(ey + (ty - ey) * t), Math.floor(ez + (tz - ez) * t))) return false;
      }
      return true;
    }

    groundY(x, z) {
      const w = this.world;
      const c = w.getChunk(Math.floor(x / GF.CHUNK), Math.floor(z / GF.CHUNK));
      if (!c || !c.ready) return GF.SEA + 2;
      const lx = Math.floor(x) - c.cx * GF.CHUNK, lz = Math.floor(z) - c.cz * GF.CHUNK;
      return c.heightMap[lx + lz * GF.CHUNK] + 1;
    }

    kill(e, index, player) {
      const drops = [];
      for (const [item, mn, mx] of (e.cfg.drops || [])) {
        const n = mn + Math.floor(Math.random() * (mx - mn + 1));
        if (n > 0) drops.push({ item, n });
      }
      GF.bus.emit('entity:die', { e, drops, x: e.x, y: e.y, z: e.z, xp: e.cfg.xp || 0 });
      this.list.splice(index, 1);
    }

    /** 玩家近战：返回被命中的实体 */
    meleeHit(player, reach, cone) {
      const dir = player.dirVec();
      let best = null, bd = 1e9;
      for (const e of this.list) {
        if (e.cfg.static) continue;
        const dx = e.x - player.x, dy = (e.y + e.cfg.h * 0.55) - player.eyeY, dz = e.z - player.z;
        const d = Math.hypot(dx, dy, dz);
        if (d > reach + e.cfg.w) continue;
        const dot = (dx * dir[0] + dy * dir[1] + dz * dir[2]) / (d || 1);
        if (dot < (cone == null ? 0.55 : cone)) continue;
        if (d < bd) { bd = d; best = e; }
      }
      return best;
    }

    /** 射线命中实体（枪械/弓箭） */
    rayHit(ox, oy, oz, dx, dy, dz, maxDist) {
      let best = null, bd = maxDist;
      for (const e of this.list) {
        if (e.cfg.static) continue;
        const cx = e.x, cy = e.y + e.cfg.h * 0.55, cz = e.z;
        const r = Math.max(e.cfg.w * 0.7, 0.45);
        const ex = cx - ox, ey = cy - oy, ez = cz - oz;
        const t = ex * dx + ey * dy + ez * dz;
        if (t < 0 || t > bd) continue;
        const px = ox + dx * t, py = oy + dy * t, pz = oz + dz * t;
        if (Math.hypot(px - cx, py - cy, pz - cz) <= r) { bd = t; best = { e, t }; }
      }
      return best;
    }

    nearestHostile(x, z, maxD) {
      let best = null, bd = maxD || 1e9;
      for (const e of this.list) {
        if (!e.cfg.hostile) continue;
        const d = Math.hypot(e.x - x, e.z - z);
        if (d < bd) { bd = d; best = e; }
      }
      return best ? { e: best, d: bd } : null;
    }

    renderList(cam) {
      const out = [];
      for (const e of this.list) {
        out.push({
          id: e.id, x: e.x, y: e.y, z: e.z, yaw: e.yaw, model: e.model,
          tint: e.flashT > 0 ? [2.2, 0.7, 0.7] : e.tint, scale: e.scale, moving: e.moving,
        });
      }
      return out;
    }
  }

  GF.TYPES = TYPES;
  GF.Entity = Entity;
  GF.Player = Player;
  GF.EntityManager = EntityManager;
})(globalThis.GF = globalThis.GF || {});
