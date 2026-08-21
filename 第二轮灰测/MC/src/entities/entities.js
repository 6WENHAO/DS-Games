/**
 * entities/entities.js
 * ------------------------------------------------------------------
 * Entity manager: dropped items and mobs.
 *
 * Dropped items are drawn as small spinning isometric icons using the
 * same icon atlas as the inventory, which keeps them cheap and makes them
 * instantly readable.
 *
 * Mobs use the boxy skinned models from models.js with simple but
 * recognisable behaviour: passive mobs wander and flee when hit, hostile
 * mobs path toward the player, attack on contact, and burn away at
 * sunrise (which is what makes night feel different).
 */

import { AABB, clamp, mat4, damp } from '../core/math.js';
import { buildProgram } from '../gfx/program.js';
import {
  entityVertexShader, entityFragmentShader,
} from '../gfx/shaders/gui.js';
import {
  MODELS, buildModelGeometry, MODEL_FLOATS_PER_VERTEX, UNIT,
} from './models.js';
import { MOVE, BlockCollider, moveBody, isInLiquid } from '../player/physics.js';
import { ItemStack } from '../game/inventory.js';
import { getItem } from '../game/items.js';
import { B } from '../world/blocks.js';

/** Seconds a dropped item waits before it can be collected. */
const PICKUP_DELAY = 0.4;
/** Seconds before a dropped item despawns (vanilla is 5 minutes). */
const ITEM_LIFETIME = 300;

/* ================================================================== */
/* item entity                                                        */
/* ================================================================== */

export class ItemEntity {
  /** @param {ItemStack} stack */
  constructor(x, y, z, stack) {
    this.x = x; this.y = y; this.z = z;
    this.vx = 0; this.vy = 0; this.vz = 0;
    this.stack = stack;
    this.age = 0;
    this.pickupDelay = PICKUP_DELAY;
    this.onGround = false;
    this.box = new AABB();
    this.dead = false;
    this.bob = Math.random() * Math.PI * 2;
    this.spin = Math.random() * Math.PI * 2;
  }

  get isItem() { return true; }

  update(dt, world, collider) {
    this.age += dt;
    if (this.age > ITEM_LIFETIME) { this.dead = true; return; }
    if (this.pickupDelay > 0) this.pickupDelay -= dt;
    this.bob += dt * 2.2;
    this.spin += dt * 1.4;

    this.vy -= MOVE.gravity * 0.55 * dt;
    this.vy = Math.max(this.vy, -20);
    const inWater = isInLiquid(world, this.box, B.WATER);
    if (inWater) { this.vy = Math.min(this.vy + 22 * dt, 1.4); }

    this.box.set(this.x - 0.125, this.y, this.z - 0.125, this.x + 0.125, this.y + 0.25, this.z + 0.125);
    const res = moveBody(world, this.box, { x: this.vx * dt, y: this.vy * dt, z: this.vz * dt }, collider);
    this.x = (this.box.minX + this.box.maxX) / 2;
    this.y = this.box.minY;
    this.z = (this.box.minZ + this.box.maxZ) / 2;
    this.onGround = res.onGround;
    if (res.onGround) {
      this.vy = 0;
      const damp2 = Math.exp(-6 * dt);
      this.vx *= damp2; this.vz *= damp2;
    }
  }
}

/* ================================================================== */
/* mob entity                                                         */
/* ================================================================== */

export class Mob {
  constructor(kind, x, y, z) {
    const model = MODELS[kind];
    this.kind = kind;
    this.model = model;
    this.x = x; this.y = y; this.z = z;
    this.vx = 0; this.vy = 0; this.vz = 0;
    this.yaw = Math.random() * Math.PI * 2;
    this.headYaw = this.yaw;
    this.onGround = false;
    this.box = new AABB();
    this.health = model.health ?? 10;
    this.maxHealth = this.health;
    this.dead = false;
    this.hostile = !!model.hostile;
    this.speed = model.speed ?? 1.1;
    /** Animation phase driven by distance walked. */
    this.limbPhase = 0;
    this.hurtTime = 0;
    /** AI state. */
    this.wanderTimer = Math.random() * 3;
    this.targetYaw = this.yaw;
    this.jumpCooldown = 0;
    this.attackCooldown = 0;
    this.burnTime = 0;
    this.width = model.width;
    this.height = model.height;
  }

  get isItem() { return false; }

  /**
   * @param {import('../world/world.js').World} world
   * @param {import('../player/player.js').Player} player
   */
  update(dt, world, collider, player, day) {
    if (this.hurtTime > 0) this.hurtTime -= dt;
    if (this.attackCooldown > 0) this.attackCooldown -= dt;
    if (this.jumpCooldown > 0) this.jumpCooldown -= dt;
    this.box.setFromCentre(this.x, this.y, this.z, this.width, this.height);

    // --- hostile mobs burn in daylight ---------------------------
    if (this.hostile && this.kind !== 'creeper' && day.daylight > 0.85) {
      const skyLight = world.getSkyLight(Math.floor(this.x), Math.floor(this.y + 1), Math.floor(this.z));
      if (skyLight >= 14) {
        this.burnTime += dt;
        if (this.burnTime > 1.2) { this.burnTime = 0; this.damage(2); }
      } else this.burnTime = 0;
    }

    // --- decide where to go --------------------------------------
    let moveSpeed = 0;
    const dx = player.x - this.x;
    const dz = player.z - this.z;
    const distSq = dx * dx + dz * dz;

    if (this.hostile && distSq < 20 * 20 && !player.isSpectator && !player.dead) {
      // Chase the player.
      this.targetYaw = Math.atan2(dx, -dz);
      moveSpeed = this.speed;
      if (distSq < 1.6 && this.attackCooldown <= 0) {
        this.attackCooldown = 1.0;
        player.damage(this.model.damage ?? 2, 'mob');
        this.onAttack?.(this);
      }
    } else {
      // Wander aimlessly, changing direction every few seconds.
      this.wanderTimer -= dt;
      if (this.wanderTimer <= 0) {
        this.wanderTimer = 2 + Math.random() * 5;
        this.targetYaw = Math.random() * Math.PI * 2;
        this.wandering = Math.random() < 0.65;
      }
      if (this.wandering) moveSpeed = this.speed * 0.45;
      // Passive mobs flee briefly after being hurt.
      if (this.hurtTime > 0) moveSpeed = this.speed * 1.4;
    }

    // Smoothly turn toward the target heading.
    let diff = this.targetYaw - this.yaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.yaw += clamp(diff, -3 * dt, 3 * dt);
    this.headYaw = damp(this.headYaw, this.yaw, 8, dt);

    // --- move ----------------------------------------------------
    const dirX = Math.sin(this.yaw) * moveSpeed;
    const dirZ = -Math.cos(this.yaw) * moveSpeed;
    this.vx = damp(this.vx, dirX, 10, dt);
    this.vz = damp(this.vz, dirZ, 10, dt);

    const inWater = isInLiquid(world, this.box, B.WATER);
    if (inWater) {
      this.vy = Math.min(this.vy + 26 * dt, 1.6);
    } else {
      this.vy -= MOVE.gravity * dt;
      this.vy = Math.max(this.vy, -MOVE.terminalVelocity);
    }

    const res = moveBody(world, this.box, { x: this.vx * dt, y: this.vy * dt, z: this.vz * dt }, collider,
      { stepHeight: this.onGround ? 0.6 : 0 });
    const travelled = Math.hypot(res.movedX ?? 0, res.movedZ ?? 0);
    this.limbPhase += travelled * 6;

    this.x = (this.box.minX + this.box.maxX) / 2;
    this.y = this.box.minY;
    this.z = (this.box.minZ + this.box.maxZ) / 2;
    this.onGround = res.onGround;
    if (res.onGround) this.vy = 0;

    // Jump over a one-block obstacle instead of grinding into it.
    if ((res.hitWallX || res.hitWallZ) && this.onGround && this.jumpCooldown <= 0 && moveSpeed > 0) {
      this.vy = MOVE.jumpVelocity * 0.82;
      this.jumpCooldown = 0.7;
    }

    if (this.y < -6) this.dead = true;
  }

  damage(amount) {
    if (this.dead) return;
    this.health -= amount;
    this.hurtTime = 0.45;
    // Knockback and a hop, like vanilla.
    this.vy = Math.max(this.vy, 3.2);
    if (this.health <= 0) this.dead = true;
  }

  /** Items dropped on death. */
  loot() {
    const table = {
      pig: [{ item: 'porkchop', min: 1, max: 3 }],
      cow: [{ item: 'beef', min: 1, max: 3 }, { item: 'leather', min: 0, max: 2 }],
      sheep: [{ item: 'mutton', min: 1, max: 2 }, { item: 'white_wool', min: 1, max: 1 }],
      chicken: [{ item: 'chicken', min: 1, max: 1 }, { item: 'feather', min: 0, max: 2 }],
      zombie: [{ item: 'rotten_flesh', min: 0, max: 2 }],
      skeleton: [{ item: 'bone', min: 0, max: 2 }, { item: 'arrow', min: 0, max: 2 }],
      creeper: [{ item: 'gunpowder', min: 0, max: 2 }],
    }[this.kind] ?? [];
    return table;
  }
}

/* ================================================================== */
/* manager + renderer                                                 */
/* ================================================================== */

export class EntityManager {
  /**
   * @param {WebGL2RenderingContext} gl
   * @param {import('../gfx/textures.js').TextureSet} textures
   * @param {import('../ui/icon-atlas.js').IconAtlas} icons
   * @param {import('../world/world.js').World} world
   */
  constructor(gl, textures, icons, world) {
    this.gl = gl;
    this.textures = textures;
    this.icons = icons;
    this.world = world;
    this.collider = new BlockCollider();

    /** @type {(ItemEntity|Mob)[]} */
    this.entities = [];
    this.maxEntities = 400;

    this.program = buildProgram(gl, {
      name: 'entity', vertex: entityVertexShader, fragment: entityFragmentShader,
    });
    this.geometry = new Map();
    this.#buildGeometry();

    this.model = mat4.create();
    this.temp = mat4.create();
    this.lightVec = new Float32Array(3);

    /** Callbacks the game hooks into. */
    this.onPickup = null;
    this.onMobDeath = null;
    this.onMobAttack = null;
    this.mobCap = 24;
  }

  get count() { return this.entities.length; }

  /** Uploads one VAO/VBO per mob model. */
  #buildGeometry() {
    const gl = this.gl;
    for (const [kind, model] of Object.entries(MODELS)) {
      const built = buildModelGeometry(model);
      const vao = gl.createVertexArray();
      gl.bindVertexArray(vao);
      const vbo = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      gl.bufferData(gl.ARRAY_BUFFER, built.data, gl.STATIC_DRAW);
      const stride = MODEL_FLOATS_PER_VERTEX * 4;
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0);
      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 2, gl.FLOAT, false, stride, 12);
      gl.enableVertexAttribArray(2);
      gl.vertexAttribPointer(2, 3, gl.FLOAT, false, stride, 20);
      gl.bindVertexArray(null);
      this.geometry.set(kind, { vao, vbo, parts: built.parts, model });
    }
  }

  /* ---------------------------------------------------------------- */
  /* spawning                                                        */
  /* ---------------------------------------------------------------- */

  /** Drops an item stack into the world with a little scatter. */
  dropItem(x, y, z, stack, throwDir = null) {
    if (!stack || stack.isEmpty) return null;
    if (this.entities.length >= this.maxEntities) return null;
    const e = new ItemEntity(x, y, z, stack.copy());
    if (throwDir) {
      e.vx = throwDir[0] * 6; e.vy = throwDir[1] * 4 + 2.2; e.vz = throwDir[2] * 6;
      e.pickupDelay = 0.8;
    } else {
      e.vx = (Math.random() - 0.5) * 1.6;
      e.vy = 2.2;
      e.vz = (Math.random() - 0.5) * 1.6;
    }
    this.entities.push(e);
    return e;
  }

  /** Spawns a mob, returning it (or null when the kind is unknown). */
  spawnMob(kind, x, y, z) {
    if (!MODELS[kind]) return null;
    if (this.mobCount() >= this.mobCap) return null;
    const mob = new Mob(kind, x, y, z);
    mob.onAttack = (m) => this.onMobAttack?.(m);
    this.entities.push(mob);
    return mob;
  }

  mobCount() {
    let n = 0;
    for (const e of this.entities) if (!e.isItem) n++;
    return n;
  }

  clear() { this.entities.length = 0; }

  /* ---------------------------------------------------------------- */
  /* simulation                                                      */
  /* ---------------------------------------------------------------- */

  /**
   * @param {number} dt
   * @param {import('../player/player.js').Player} player
   * @param {import('../game/daycycle.js').DayCycle} day
   */
  update(dt, player, day) {
    const playerBox = player.box;
    for (let i = this.entities.length - 1; i >= 0; i--) {
      const e = this.entities[i];
      if (e.isItem) {
        e.update(dt, this.world, this.collider);
        // Collect when the player touches it.
        if (!e.dead && e.pickupDelay <= 0) {
          const dx = e.x - player.x;
          const dy = e.y - (player.y + 0.9);
          const dz = e.z - player.z;
          if (dx * dx + dy * dy + dz * dz < 2.0) {
            const left = player.inventory.addItem(e.stack.id, e.stack.count);
            if (left < e.stack.count) {
              this.onPickup?.(e.stack.id, e.stack.count - left);
              if (left === 0) e.dead = true; else e.stack.count = left;
            }
          }
        }
        void playerBox;
      } else {
        e.update(dt, this.world, this.collider, player, day);
        if (e.dead) {
          this.onMobDeath?.(e);
        }
      }
      if (e.dead) this.entities.splice(i, 1);
    }
  }

  /** Nearest mob whose box the ray hits, for attacking. */
  pickMob(ox, oy, oz, dx, dy, dz, maxDistance) {
    let best = null;
    let bestDist = maxDistance;
    for (const e of this.entities) {
      if (e.isItem) continue;
      const box = e.box;
      // Slab method against the mob's AABB.
      const inv = (d) => (d === 0 ? Infinity : 1 / d);
      let tmin = (box.minX - ox) * inv(dx);
      let tmax = (box.maxX - ox) * inv(dx);
      if (tmin > tmax) { const t = tmin; tmin = tmax; tmax = t; }
      let t1 = (box.minY - oy) * inv(dy);
      let t2 = (box.maxY - oy) * inv(dy);
      if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
      tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
      t1 = (box.minZ - oz) * inv(dz);
      t2 = (box.maxZ - oz) * inv(dz);
      if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
      tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
      if (tmax < 0 || tmin > tmax) continue;
      const dist = tmin < 0 ? 0 : tmin;
      if (dist < bestDist) { bestDist = dist; best = e; }
    }
    return best;
  }

  /**
   * Night-time hostile spawning around the player, in unlit spots.
   */
  trySpawnHostile(player, day, random = Math.random) {
    if (day.daylight > 0.35) return;
    if (this.mobCount() >= this.mobCap) return;
    const kinds = ['zombie', 'skeleton', 'creeper'];
    const kind = kinds[Math.floor(random() * kinds.length)];
    for (let attempt = 0; attempt < 8; attempt++) {
      const angle = random() * Math.PI * 2;
      const dist = 24 + random() * 20;
      const x = Math.floor(player.x + Math.cos(angle) * dist);
      const z = Math.floor(player.z + Math.sin(angle) * dist);
      if (!this.world.isLoaded(x, z)) continue;
      const y = this.world.surfaceY(x, z);
      if (y < 2) continue;
      if (this.world.getBlock(x, y, z) !== 0 || this.world.getBlock(x, y + 1, z) !== 0) continue;
      if (this.world.getBlockLight(x, y, z) > 7) continue;
      this.spawnMob(kind, x + 0.5, y, z + 0.5);
      return;
    }
  }

  /** Daytime passive spawning on grass. */
  trySpawnPassive(player, random = Math.random) {
    if (this.mobCount() >= this.mobCap) return;
    const kinds = ['pig', 'cow', 'sheep', 'chicken'];
    const kind = kinds[Math.floor(random() * kinds.length)];
    for (let attempt = 0; attempt < 6; attempt++) {
      const angle = random() * Math.PI * 2;
      const dist = 20 + random() * 24;
      const x = Math.floor(player.x + Math.cos(angle) * dist);
      const z = Math.floor(player.z + Math.sin(angle) * dist);
      if (!this.world.isLoaded(x, z)) continue;
      const y = this.world.surfaceY(x, z);
      const ground = this.world.getBlock(x, y - 1, z);
      if (ground !== B.GRASS_BLOCK) continue;
      if (this.world.getBlock(x, y, z) !== 0) continue;
      this.spawnMob(kind, x + 0.5, y, z + 0.5);
      return;
    }
  }

  /* ---------------------------------------------------------------- */
  /* rendering                                                       */
  /* ---------------------------------------------------------------- */

  /**
   * Draws mobs (skinned boxes) and dropped items (billboarded icons).
   */
  render(camera, env, day) {
    const gl = this.gl;
    if (this.entities.length === 0) return;

    const p = this.program.use();
    p.mat4('uViewProj', camera.viewProjection);
    p.vec3('uCameraPos', camera.position);
    p.vec3('uFogColor', env.fogColor);
    p.float('uFogStart', env.fogStart);
    p.float('uFogEnd', env.fogEnd);
    p.float('uFogDensity', env.fogDensity);
    gl.enable(gl.CULL_FACE);
    gl.disable(gl.BLEND);

    for (const e of this.entities) {
      if (e.isItem) continue;
      const geo = this.geometry.get(e.kind);
      if (!geo) continue;

      // World light at the mob's head.
      const lightByte = this.world.getLightByte(
        Math.floor(e.x), Math.floor(e.y + e.height * 0.7), Math.floor(e.z));
      const sky = ((lightByte >> 4) & 15) / 15;
      const block = (lightByte & 15) / 15;
      const level = Math.max(sky * day.daylight, block);
      const shade = clamp(0.16 + level * 0.95, 0, 1);
      this.lightVec[0] = shade; this.lightVec[1] = shade * 0.99; this.lightVec[2] = shade * 0.96;
      p.vec3('uLight', this.lightVec);
      p.vec4('uTint', 1, 1, 1, 1);
      p.float('uFlash', e.hurtTime > 0 ? 0.55 : 0);
      p.texture('uTex', 0, gl.TEXTURE_2D, this.textures.get(geo.model.texture).texture);

      gl.bindVertexArray(geo.vao);
      const swing = Math.sin(e.limbPhase) * 0.7;
      for (const part of geo.parts) {
        // Per-part animation: legs and arms swing, the head turns.
        mat4.identity(this.model);
        mat4.translate(this.model, this.model, e.x, e.y, e.z);
        mat4.rotateY(this.model, this.model, -e.yaw);

        if (part.name.startsWith('leg') || part.name.startsWith('arm')) {
          const index = Number(part.name.slice(-1));
          const phase = (index % 2 === 0) ? swing : -swing;
          const pivotY = part.name.startsWith('leg')
            ? (e.kind === 'zombie' || e.kind === 'skeleton' ? 12 * UNIT : 6 * UNIT)
            : 24 * UNIT;
          mat4.translate(this.model, this.model, 0, pivotY, 0);
          mat4.rotateX(this.model, this.model, phase * 0.55);
          mat4.translate(this.model, this.model, 0, -pivotY, 0);
        } else if (part.name === 'head') {
          const pivotY = e.kind === 'zombie' || e.kind === 'skeleton' ? 24 * UNIT : 12 * UNIT;
          mat4.translate(this.model, this.model, 0, pivotY, 0);
          mat4.rotateY(this.model, this.model, -(e.headYaw - e.yaw));
          mat4.translate(this.model, this.model, 0, -pivotY, 0);
        }
        p.mat4('uModel', this.model);
        gl.drawArrays(gl.TRIANGLES, part.offset, part.count);
      }
      gl.bindVertexArray(null);
    }

    this.#renderItems(camera);
  }

  /** Dropped items: small camera-facing icons that bob and spin. */
  #renderItems(camera) {
    const items = this.entities.filter((e) => e.isItem);
    if (items.length === 0) return;
    // Reuse the GUI batch approach but in world space via the particle-ish
    // path: build quads on the fly with the icon atlas.
    const gl = this.gl;
    if (!this.itemBuffer) {
      this.itemBuffer = { data: new Float32Array(2048 * 4 * 8), vao: gl.createVertexArray(), vbo: gl.createBuffer() };
      gl.bindVertexArray(this.itemBuffer.vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.itemBuffer.vbo);
      gl.bufferData(gl.ARRAY_BUFFER, this.itemBuffer.data.byteLength, gl.DYNAMIC_DRAW);
      const stride = 8 * 4;
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0);
      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 2, gl.FLOAT, false, stride, 12);
      gl.enableVertexAttribArray(2);
      gl.vertexAttribPointer(2, 3, gl.FLOAT, false, stride, 20);
      gl.bindVertexArray(null);
      // Triangle list; no index buffer needed.
    }

    const data = this.itemBuffer.data;
    let floats = 0;
    let quads = 0;
    const rx = camera.right[0]; const ry = camera.right[1]; const rz = camera.right[2];
    const ux = camera.up[0]; const uy = camera.up[1]; const uz = camera.up[2];

    for (const e of items) {
      const uv = this.icons.uvFor(e.stack.id);
      if (!uv) continue;
      if (quads >= 2000) break;
      const s = 0.22;
      const bobY = Math.sin(e.bob) * 0.05 + 0.14;
      const cx = e.x; const cy = e.y + bobY; const cz = e.z;
      const corners = [[-1, -1, uv[0], uv[3]], [1, -1, uv[2], uv[3]], [1, 1, uv[2], uv[1]], [-1, 1, uv[0], uv[1]]];
      const order = [0, 1, 2, 0, 2, 3];
      for (const k of order) {
        const [ax, ay, tu, tv] = corners[k];
        data[floats++] = cx + rx * ax * s + ux * ay * s;
        data[floats++] = cy + ry * ax * s + uy * ay * s;
        data[floats++] = cz + rz * ax * s + uz * ay * s;
        data[floats++] = tu;
        data[floats++] = tv;
        data[floats++] = 0; data[floats++] = 1; data[floats++] = 0;
      }
      quads++;
    }
    if (quads === 0) return;

    const p = this.program.use();
    p.vec3('uLight', 1, 1, 1);
    p.vec4('uTint', 1, 1, 1, 1);
    p.float('uFlash', 0);
    mat4.identity(this.model);
    p.mat4('uModel', this.model);
    p.texture('uTex', 0, gl.TEXTURE_2D, this.icons.texture);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.CULL_FACE);
    gl.bindVertexArray(this.itemBuffer.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.itemBuffer.vbo);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, data.subarray(0, floats));
    gl.drawArrays(gl.TRIANGLES, 0, quads * 6);
    gl.bindVertexArray(null);
    gl.enable(gl.CULL_FACE);
    gl.disable(gl.BLEND);
  }

  dispose() {
    const gl = this.gl;
    this.program.dispose();
    for (const geo of this.geometry.values()) {
      gl.deleteVertexArray(geo.vao);
      gl.deleteBuffer(geo.vbo);
    }
    if (this.itemBuffer) {
      gl.deleteVertexArray(this.itemBuffer.vao);
      gl.deleteBuffer(this.itemBuffer.vbo);
    }
  }
}

export { ItemStack, getItem };
