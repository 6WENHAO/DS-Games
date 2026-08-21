/**
 * player/player.js
 * ------------------------------------------------------------------
 * The player: position, movement integration, survival stats and the
 * game-mode rules.
 *
 * Three game modes, as in vanilla:
 *  - **survival**  : gravity, health, hunger, fall damage, real mining
 *  - **creative**  : flight, no damage, instant mining, infinite items
 *  - **spectator** : flight and no collision at all
 */

import { AABB, clamp, damp } from '../core/math.js';
import {
  MOVE, PLAYER_SIZE, BlockCollider, moveBody, isInLiquid, isOnClimbable,
  blockBelow, fallDamage, applyDrag,
} from './physics.js';
import { B, blocks } from '../world/blocks.js';
import { PlayerInventory } from '../game/inventory.js';
import { WORLD_HEIGHT } from '../world/constants.js';

export const GAME_MODE = { SURVIVAL: 'survival', CREATIVE: 'creative', SPECTATOR: 'spectator' };

/** Health and hunger limits, in half-hearts / hunger points. */
export const MAX_HEALTH = 20;
export const MAX_HUNGER = 20;

export class Player {
  /** @param {import('../world/world.js').World} world */
  constructor(world) {
    this.world = world;

    this.x = 0; this.y = 80; this.z = 0;
    this.vx = 0; this.vy = 0; this.vz = 0;
    this.yaw = 0; this.pitch = 0;

    this.mode = GAME_MODE.SURVIVAL;
    this.onGround = false;
    this.sneaking = false;
    this.sprinting = false;
    this.flying = false;
    this.inWater = false;
    this.headInWater = false;
    this.inLava = false;
    this.onClimbable = false;

    /** Distance fallen since leaving the ground, for fall damage. */
    this.fallDistance = 0;
    this.health = MAX_HEALTH;
    this.hunger = MAX_HUNGER;
    this.saturation = 5;
    this.exhaustion = 0;
    this.air = 300;         // ticks of breath, like vanilla
    this.xp = 0;
    this.xpLevel = 0;
    this.dead = false;
    this.invulnerable = 0;  // seconds of damage immunity
    this.hurtTime = 0;

    this.inventory = new PlayerInventory();
    this.box = new AABB();
    this.collider = new BlockCollider();

    /** Smoothed eye height so sneaking eases rather than snaps. */
    this.eyeHeight = PLAYER_SIZE.eyeHeight;
    /** View bobbing phase. */
    this.walkDistance = 0;
    this.bobPhase = 0;

    /** Double-tap detection for creative flight. */
    this.lastJumpTapAt = -1;
    /** Set for one frame when the player just landed, for sounds. */
    this.justLanded = false;
    this.justStepped = false;
    this.justSplashed = false;
    this.stepCooldown = 0;
    this.blockUnder = 0;

    /** Callbacks the game wires up. */
    this.onDamage = null;
    this.onDeath = null;
    this.onStep = null;
    this.onSplash = null;

    this.#syncBox();
  }

  /* ---------------------------------------------------------------- */
  /* geometry                                                        */
  /* ---------------------------------------------------------------- */

  get height() { return this.sneaking ? PLAYER_SIZE.sneakHeight : PLAYER_SIZE.height; }

  get eyeY() { return this.y + this.eyeHeight; }

  #syncBox() {
    this.box.setFromCentre(this.x, this.y, this.z, PLAYER_SIZE.width, this.height);
  }

  setPosition(x, y, z) {
    this.x = x; this.y = y; this.z = z;
    this.vx = 0; this.vy = 0; this.vz = 0;
    this.fallDistance = 0;
    this.#syncBox();
  }

  /** Teleports to the top of the column, used by /tp and respawn. */
  placeOnSurface(x, z) {
    const top = this.world.surfaceY(Math.floor(x), Math.floor(z));
    this.setPosition(x, Math.min(top, WORLD_HEIGHT - 3), z);
  }

  /* ---------------------------------------------------------------- */
  /* mode                                                            */
  /* ---------------------------------------------------------------- */

  setMode(mode) {
    if (!Object.values(GAME_MODE).includes(mode)) return false;
    this.mode = mode;
    if (mode === GAME_MODE.SURVIVAL) this.flying = false;
    if (mode === GAME_MODE.SPECTATOR) this.flying = true;
    return true;
  }

  get isCreative() { return this.mode === GAME_MODE.CREATIVE; }
  get isSpectator() { return this.mode === GAME_MODE.SPECTATOR; }
  get canFly() { return this.mode !== GAME_MODE.SURVIVAL; }
  get takesDamage() { return this.mode === GAME_MODE.SURVIVAL; }
  get reach() { return this.isCreative ? 5.5 : 4.5; }

  /* ---------------------------------------------------------------- */
  /* movement                                                        */
  /* ---------------------------------------------------------------- */

  /**
   * Integrates one frame of movement.
   * @param {number} dt seconds
   * @param {{forward:number, strafe:number, jump:boolean, sneak:boolean, sprint:boolean, up:number}} input
   */
  update(dt, input) {
    this.justLanded = false;
    this.justStepped = false;
    this.justSplashed = false;
    if (this.invulnerable > 0) this.invulnerable -= dt;
    if (this.hurtTime > 0) this.hurtTime -= dt;
    if (this.dead) return;

    const wasInWater = this.inWater;
    this.sneaking = input.sneak && !this.flying;
    this.#syncBox();

    // --- environment sampling ------------------------------------
    this.inWater = isInLiquid(this.world, this.box, B.WATER);
    this.inLava = isInLiquid(this.world, this.box, B.LAVA);
    this.onClimbable = isOnClimbable(this.world, this.box);
    const eyeBlock = this.world.getBlock(Math.floor(this.x), Math.floor(this.eyeY), Math.floor(this.z));
    this.headInWater = eyeBlock === B.WATER;
    if (this.inWater && !wasInWater && Math.abs(this.vy) > 3) {
      this.justSplashed = true;
      this.onSplash?.(this.x, this.y, this.z);
    }

    // --- desired horizontal direction ----------------------------
    const cos = Math.cos(this.yaw);
    const sin = Math.sin(this.yaw);
    // forward is -Z at yaw 0; strafe is +X at yaw 0
    let dirX = input.strafe * cos + input.forward * sin;
    let dirZ = input.strafe * sin - input.forward * cos;
    const len = Math.hypot(dirX, dirZ);
    if (len > 1) { dirX /= len; dirZ /= len; }

    // Sprinting requires forward input and (in survival) enough food.
    this.sprinting = input.sprint && input.forward > 0 && !this.sneaking
      && (!this.takesDamage || this.hunger > 6);

    const speed = this.#targetSpeed();

    if (this.flying) {
      this.#updateFlight(dt, dirX, dirZ, speed, input);
    } else if (this.inWater || this.inLava) {
      this.#updateSwim(dt, dirX, dirZ, input);
    } else {
      this.#updateWalk(dt, dirX, dirZ, speed, input);
    }

    // --- integrate + collide -------------------------------------
    const motion = { x: this.vx * dt, y: this.vy * dt, z: this.vz * dt };
    this.#syncBox();
    let res;
    if (this.isSpectator) {
      this.box.minX += motion.x; this.box.maxX += motion.x;
      this.box.minY += motion.y; this.box.maxY += motion.y;
      this.box.minZ += motion.z; this.box.maxZ += motion.z;
      res = { onGround: false, hitCeiling: false, movedY: motion.y };
    } else {
      res = moveBody(this.world, this.box, motion, this.collider, {
        stepHeight: this.onGround && !this.flying ? MOVE.stepHeight : 0,
      });
    }

    const prevY = this.y;
    this.x = (this.box.minX + this.box.maxX) / 2;
    this.y = this.box.minY;
    this.z = (this.box.minZ + this.box.maxZ) / 2;

    // --- landing / fall damage -----------------------------------
    if (res.onGround) {
      if (!this.onGround) {
        this.justLanded = true;
        if (this.takesDamage && !this.inWater) {
          const damageAmount = fallDamage(this.fallDistance);
          if (damageAmount > 0) this.damage(damageAmount, 'fall');
        }
      }
      this.fallDistance = 0;
      this.vy = 0;
    } else if (res.hitCeiling) {
      this.vy = 0;
    }
    if (!res.onGround && this.vy < 0 && !this.inWater && !this.flying) {
      this.fallDistance += prevY - this.y;
    }
    if (this.inWater || this.flying || this.onClimbable) this.fallDistance = 0;
    this.onGround = res.onGround;

    // Cancel horizontal velocity when we hit a wall so we do not
    // accumulate energy against it.
    if (res.hitWallX) this.vx = 0;
    if (res.hitWallZ) this.vz = 0;

    // --- footsteps ----------------------------------------------
    this.blockUnder = blockBelow(this.world, this.box);
    const travelled = Math.hypot(res.movedX ?? 0, res.movedZ ?? 0);
    this.walkDistance += travelled;
    if (this.onGround) this.bobPhase += travelled * 5.5;
    this.stepCooldown -= dt;
    if (this.onGround && travelled > 0.0005 && this.stepCooldown <= 0 && this.blockUnder) {
      this.stepCooldown = this.sprinting ? 0.28 : 0.42;
      this.justStepped = true;
      this.onStep?.(this.blockUnder, this.x, this.y, this.z);
    }

    // --- smooth the eye height ----------------------------------
    const targetEye = this.sneaking ? PLAYER_SIZE.sneakEyeHeight : PLAYER_SIZE.eyeHeight;
    this.eyeHeight = damp(this.eyeHeight, targetEye, 18, dt);

    // --- world bounds -------------------------------------------
    if (this.y < -8) {
      if (this.takesDamage) this.damage(4, 'void');
      else this.setPosition(this.x, WORLD_HEIGHT - 4, this.z);
    }

    this.#updateVitals(dt);
  }

  #targetSpeed() {
    if (this.flying) return this.sprinting ? MOVE.flySprintSpeed : MOVE.flySpeed;
    if (this.sneaking) return MOVE.sneakSpeed;
    if (this.sprinting) return MOVE.sprintSpeed;
    return MOVE.walkSpeed;
  }

  #updateWalk(dt, dirX, dirZ, speed, input) {
    const accel = this.onGround ? 42 : 12;
    this.vx += (dirX * speed - this.vx) * Math.min(1, accel * dt);
    this.vz += (dirZ * speed - this.vz) * Math.min(1, accel * dt);
    if (this.onGround && dirX === 0 && dirZ === 0) {
      this.vx = applyDrag(this.vx, MOVE.groundFriction, dt);
      this.vz = applyDrag(this.vz, MOVE.groundFriction, dt);
    }

    if (this.onClimbable) {
      // Ladders: slow, controlled vertical movement.
      this.vy = input.jump ? 3.0 : (input.sneak ? -1.5 : (input.forward !== 0 ? 2.4 : -1.4));
      return;
    }

    if (input.jump && this.onGround) {
      this.vy = MOVE.jumpVelocity;
      // Sprint jumping gets vanilla's forward boost.
      if (this.sprinting) { this.vx += dirX * 2.2; this.vz += dirZ * 2.2; }
      this.exhaustion += this.sprinting ? 0.2 : 0.05;
      this.onGround = false;
    }
    this.vy -= MOVE.gravity * dt;
    this.vy = Math.max(this.vy, -MOVE.terminalVelocity);
  }

  #updateSwim(dt, dirX, dirZ, input) {
    const speed = MOVE.swimSpeed * (this.sprinting ? 1.35 : 1);
    this.vx += (dirX * speed - this.vx) * Math.min(1, 10 * dt);
    this.vz += (dirZ * speed - this.vz) * Math.min(1, 10 * dt);
    const gravity = this.inLava ? MOVE.liquidGravity * 1.4 : MOVE.liquidGravity;
    this.vy -= gravity * dt;
    if (input.jump) {
      this.vy += MOVE.swimUpSpeed * 8 * dt;
      this.vy = Math.min(this.vy, MOVE.swimUpSpeed);
    } else if (input.sneak) {
      this.vy -= MOVE.swimUpSpeed * 4 * dt;
    }
    // Buoyancy keeps a floating player bobbing at the surface.
    const surfaceish = this.world.getBlock(Math.floor(this.x), Math.floor(this.y + 1.2), Math.floor(this.z)) !== B.WATER;
    if (surfaceish && !input.sneak) this.vy += 4.2 * dt;
    this.vy = clamp(this.vy, -6, MOVE.swimUpSpeed);
    this.vx = applyDrag(this.vx, MOVE.liquidDrag, dt);
    this.vz = applyDrag(this.vz, MOVE.liquidDrag, dt);
  }

  #updateFlight(dt, dirX, dirZ, speed, input) {
    this.vx += (dirX * speed - this.vx) * Math.min(1, 12 * dt);
    this.vz += (dirZ * speed - this.vz) * Math.min(1, 12 * dt);
    const vertical = (input.jump ? 1 : 0) - (input.sneak ? 1 : 0) + (input.up ?? 0);
    this.vy += (vertical * speed - this.vy) * Math.min(1, 12 * dt);
    if (vertical === 0) this.vy = applyDrag(this.vy, 0.6, dt);
  }

  /** Handles the double-tap-space flight toggle. */
  tapJump(now) {
    if (!this.canFly) return;
    if (this.lastJumpTapAt > 0 && now - this.lastJumpTapAt < 0.32) {
      this.flying = !this.flying;
      if (this.flying) this.vy = 0;
      this.lastJumpTapAt = -1;
    } else {
      this.lastJumpTapAt = now;
    }
  }

  /* ---------------------------------------------------------------- */
  /* survival stats                                                  */
  /* ---------------------------------------------------------------- */

  #updateVitals(dt) {
    if (!this.takesDamage) {
      this.health = MAX_HEALTH;
      this.hunger = MAX_HUNGER;
      this.air = 300;
      return;
    }

    // --- breath ---------------------------------------------------
    if (this.headInWater) {
      this.air -= dt * 20;
      if (this.air <= 0) {
        this.air = 0;
        this.drownTimer = (this.drownTimer ?? 0) + dt;
        if (this.drownTimer >= 1) { this.drownTimer = 0; this.damage(2, 'drown'); }
      }
    } else {
      this.air = Math.min(300, this.air + dt * 80);
      this.drownTimer = 0;
    }

    // --- lava ----------------------------------------------------
    if (this.inLava) {
      this.lavaTimer = (this.lavaTimer ?? 0) + dt;
      if (this.lavaTimer >= 0.5) { this.lavaTimer = 0; this.damage(4, 'lava'); }
    }

    // --- hunger --------------------------------------------------
    const moving = Math.hypot(this.vx, this.vz);
    if (moving > 0.1) this.exhaustion += (this.sprinting ? 0.1 : 0.01) * dt * 20 * 0.05;
    if (this.exhaustion >= 4) {
      this.exhaustion -= 4;
      if (this.saturation > 0) this.saturation = Math.max(0, this.saturation - 1);
      else this.hunger = Math.max(0, this.hunger - 1);
    }

    // --- regeneration / starvation --------------------------------
    this.regenTimer = (this.regenTimer ?? 0) + dt;
    if (this.regenTimer >= 4) {
      this.regenTimer = 0;
      if (this.hunger >= 18 && this.health < MAX_HEALTH) {
        this.health = Math.min(MAX_HEALTH, this.health + 1);
        this.exhaustion += 3;
      } else if (this.hunger === 0 && this.health > 1) {
        this.damage(1, 'starve');
      }
    }
  }

  /** Applies damage, respecting armour and the brief immunity window. */
  damage(amount, cause = 'generic') {
    if (!this.takesDamage || this.dead) return false;
    if (this.invulnerable > 0 && cause !== 'void') return false;
    const armour = this.inventory.armourPoints();
    const reduced = cause === 'fall' || cause === 'generic' || cause === 'mob'
      ? amount * (1 - Math.min(20, armour) * 0.04)
      : amount;
    this.health = Math.max(0, this.health - Math.max(0.5, reduced));
    this.invulnerable = 0.5;
    this.hurtTime = 0.4;
    this.onDamage?.(amount, cause);
    if (this.health <= 0) this.die();
    return true;
  }

  heal(amount) {
    this.health = Math.min(MAX_HEALTH, this.health + amount);
  }

  /** Eats a food item, returning true when it was consumed. */
  eat(itemDef) {
    if (!itemDef?.food) return false;
    if (this.hunger >= MAX_HUNGER && this.takesDamage) return false;
    this.hunger = Math.min(MAX_HUNGER, this.hunger + itemDef.food);
    this.saturation = Math.min(this.hunger, this.saturation + itemDef.saturation);
    return true;
  }

  die() {
    if (this.dead) return;
    this.dead = true;
    this.health = 0;
    this.onDeath?.();
  }

  /** Resets stats and puts the player back at the spawn point. */
  respawn(spawnX, spawnY, spawnZ) {
    this.dead = false;
    this.health = MAX_HEALTH;
    this.hunger = MAX_HUNGER;
    this.saturation = 5;
    this.exhaustion = 0;
    this.air = 300;
    this.fallDistance = 0;
    this.invulnerable = 1.5;
    this.setPosition(spawnX, spawnY, spawnZ);
  }

  /** Adds experience, levelling up as vanilla does. */
  addXp(amount) {
    this.xp += amount;
    while (this.xp >= this.xpForLevel(this.xpLevel + 1)) {
      this.xp -= this.xpForLevel(this.xpLevel + 1);
      this.xpLevel++;
    }
  }

  xpForLevel(level) {
    if (level <= 16) return 2 * level + 7;
    if (level <= 31) return 5 * level - 38;
    return 9 * level - 158;
  }

  /** Fraction toward the next level, for the XP bar. */
  get xpProgress() {
    const need = this.xpForLevel(this.xpLevel + 1);
    return need > 0 ? clamp(this.xp / need, 0, 1) : 0;
  }

  /** Name of the block the player is standing on, for the debug overlay. */
  standingOn() {
    return blocks[this.blockUnder]?.name ?? 'air';
  }

  /* ---------------------------------------------------------------- */
  /* persistence                                                     */
  /* ---------------------------------------------------------------- */

  toJSON() {
    return {
      x: this.x, y: this.y, z: this.z,
      yaw: this.yaw, pitch: this.pitch,
      mode: this.mode, flying: this.flying,
      health: this.health, hunger: this.hunger, saturation: this.saturation,
      xp: this.xp, xpLevel: this.xpLevel,
      inventory: this.inventory.toJSON(),
    };
  }

  fromJSON(json) {
    if (!json) return this;
    this.setPosition(json.x ?? 0, json.y ?? 80, json.z ?? 0);
    this.yaw = json.yaw ?? 0;
    this.pitch = json.pitch ?? 0;
    this.setMode(json.mode ?? GAME_MODE.SURVIVAL);
    this.flying = !!json.flying && this.canFly;
    this.health = json.health ?? MAX_HEALTH;
    this.hunger = json.hunger ?? MAX_HUNGER;
    this.saturation = json.saturation ?? 5;
    this.xp = json.xp ?? 0;
    this.xpLevel = json.xpLevel ?? 0;
    this.inventory.fromJSON(json.inventory);
    this.dead = this.health <= 0;
    return this;
  }
}
