/**
 * SALTWAKE — enemies.
 *
 * Six archetypes, one state machine. The design rule for every one of them is
 * that the player must be able to read what is about to happen:
 *
 *   telegraph  a long, exaggerated windup pose with its own sound
 *   active     a two-frame snap where the damage actually lands
 *   recover    a punish window where the enemy cannot cancel
 *
 * Each has a stated weakness that changes how you spend ammo: haulers split on a
 * headshot, choirmen recoil from flame, crawlers shatter under splash, eye
 * clusters burst to a single harpoon, wearers show their seams to the focus, and
 * the scion is armoured until its three conduits are broken.
 *
 * Pathing is a breadth-first flow field over the cell grid, rebuilt a few times a
 * second from the player's cell. At this grid size that is cheaper and far more
 * reliable than steering, and it means enemies use doors and stairs correctly.
 */
import * as THREE from 'three';
import { ENEMIES, ANIM, SANITY, WORLD } from '../core/config.js';
import { createActorMaterial } from '../gfx/materials.js';
import { buildEnemyModel } from '../gfx/models.js';
import { CELL } from '../world/grid.js';
import { moveHorizontal, groundUnder, lineOfSight } from '../world/collide.js';

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _seg = new THREE.Vector3();

/** One live enemy. */
class Enemy {
  constructor(type, def, rig) {
    this.type = type;
    this.def = def;
    this.rig = rig;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.targetYaw = 0;
    this.health = def.health;
    this.maxHealth = def.health;
    this.state = 'idle';
    this.stateTime = 0;
    this.alive = true;
    this.awake = false;
    this.hurtFlash = 0;
    this.burnTime = 0;
    this.burnDps = 0;
    this.attackCooldown = 0;
    this.blinkCooldown = 0;
    this.summonCooldown = 0;
    this.pinnedTo = null;
    this.radius = def.radius;
    this.height = def.height;
    this.removeAt = 0;
    this.group = rig.group;
    this.armorPhase = def.armorPhases || 0;
    this.conduits = [];
    // Boss only: one health pool per brass conduit.
    this.conduitHealth = def.armorPhases ? new Array(def.armorPhases).fill(240) : [];
    this.conduitBroken = def.armorPhases ? new Array(def.armorPhases).fill(false) : [];
    this.spawnedBy = null;
    this.patrol = null;
    this.patrolIndex = 0;
    this.lastSeen = 0;
    this._body = { x: 0, z: 0, y: 0, radius: def.radius, height: def.height, stepHeight: 0.45 };
  }

  get centre() {
    return _v2.set(this.pos.x, this.pos.y + this.height * 0.55, this.pos.z);
  }
}

export class EnemyManager {
  /** @param {object} ctx { world, player, fx, audio, scene, lights } */
  constructor(ctx) {
    this.ctx = ctx;
    this.list = [];
    this.materials = {};
    this.rigCache = {};
    this.flow = null;
    this.flowTimer = 0;
    this.flowOrigin = { col: -1, row: -1 };
    this.aliveCount = 0;
    this.killCount = 0;
    this.bossActive = false;
    this.boss = null;
    this.sanityPressure = 0;

    for (const type of Object.keys(ENEMIES)) {
      this.materials[type] = createActorMaterial({
        silhouette: ENEMIES[type].boss ? 0.55 : 0,
      });
    }
  }

  /* ------------------------------------------------------------ spawning */

  /**
   * @param {string} type @param {number} x @param {number} y @param {number} z
   */
  spawn(type, x, y, z, opts = {}) {
    const def = ENEMIES[type];
    if (!def) throw new Error(`EnemyManager.spawn: unknown type "${type}"`);
    const rig = buildEnemyModel(type, this.materials[type]);
    const e = new Enemy(type, def, rig);
    e.pos.set(x, y, z);
    e.yaw = (opts.yaw || 0) * Math.PI / 180;
    e.targetYaw = e.yaw;
    e.patrol = opts.patrol || null;
    e.spawnedBy = opts.spawnedBy || null;
    if (def.flying) e.pos.y = y + def.hoverHeight;
    rig.group.position.copy(e.pos);
    this.ctx.scene.add(rig.group);
    this.list.push(e);
    this.aliveCount += 1;
    if (def.boss) { this.boss = e; this.bossActive = true; }
    return e;
  }

  /** Builds the level's enemy population from its entity list. */
  populate(level, world) {
    for (const ent of level.entities || []) {
      if (ent.type !== 'enemy') continue;
      const cell = world.grid.get(ent.col, ent.row);
      if (!cell) continue;
      const c = world.grid.centreOf(ent.col, ent.row);
      this.spawn(ent.enemy, c.x, cell.floorY, c.z, { yaw: ent.yaw || 0, patrol: ent.patrol });
    }
  }

  /* ------------------------------------------------------------ queries */

  /**
   * Nearest enemy hit by a ray, as a cylinder test.
   * @returns {{enemy:Enemy, dist:number, point:THREE.Vector3, head:boolean}|null}
   */
  raycast(origin, dir, maxDist) {
    let best = null;
    for (const e of this.list) {
      if (!e.alive) continue;
      // Solve the ray against an infinite cylinder, then clamp to the body span.
      const ox = origin.x - e.pos.x;
      const oz = origin.z - e.pos.z;
      const a = dir.x * dir.x + dir.z * dir.z;
      if (a < 1e-6) continue;
      const b = 2 * (ox * dir.x + oz * dir.z);
      const c = ox * ox + oz * oz - e.radius * e.radius;
      const disc = b * b - 4 * a * c;
      if (disc < 0) continue;
      const sq = Math.sqrt(disc);
      let t = (-b - sq) / (2 * a);
      if (t < 0) t = (-b + sq) / (2 * a);
      if (t < 0 || t > maxDist) continue;
      const y = origin.y + dir.y * t;
      if (y < e.pos.y - 0.05 || y > e.pos.y + e.height + 0.05) continue;
      if (!best || t < best.dist) {
        // The top fifth of the body counts as the head for weakness purposes.
        const head = y > e.pos.y + e.height * 0.78;
        best = {
          enemy: e,
          dist: t,
          point: new THREE.Vector3(origin.x + dir.x * t, y, origin.z + dir.z * t),
          head,
        };
      }
    }
    return best;
  }

  /** Enemies inside a cone, for the flamethrower. */
  coneQuery(origin, dir, range, halfAngle) {
    const out = [];
    const cosLimit = Math.cos(halfAngle);
    for (const e of this.list) {
      if (!e.alive) continue;
      _seg.set(e.pos.x - origin.x, (e.pos.y + e.height * 0.5) - origin.y, e.pos.z - origin.z);
      const dist = _seg.length();
      if (dist > range || dist < 0.05) continue;
      _seg.multiplyScalar(1 / dist);
      if (_seg.dot(dir) < cosLimit) continue;
      out.push(e);
    }
    return out;
  }

  /** Enemies within a radius, for splash damage. */
  radiusQuery(x, y, z, radius) {
    const out = [];
    for (const e of this.list) {
      if (!e.alive) continue;
      const d = Math.hypot(e.pos.x - x, (e.pos.y + e.height * 0.5) - y, e.pos.z - z);
      if (d <= radius) out.push({ enemy: e, dist: d });
    }
    return out;
  }

  /* ------------------------------------------------------------ damage */

  /**
   * @param {Enemy} e
   * @param {number} amount
   * @param {string} kind bullet | flame | splash | harpoon | focus | burn
   */
  damage(e, amount, kind, point, dir) {
    if (!e.alive) return 0;
    const def = e.def;
    let dmg = amount;

    /* The boss is armoured until its three brass conduits are shot out. A hit
     * near a conduit damages that conduit; a hit anywhere else rings off the
     * plates. The conduits are lit and modelled on the body, so the target is
     * visible rather than explained. */
    if (def.boss && e.armorPhase > 0) {
      const conduit = point ? this.nearestConduit(e, point) : null;
      if (conduit) {
        e.conduitHealth[conduit.index] -= amount;
        e.hurtFlash = 1;
        this.ctx.fx.spawnImpact(point.x, point.y, point.z, 'flesh', dir);
        if (e.conduitHealth[conduit.index] <= 0 && !e.conduitBroken[conduit.index]) {
          e.conduitBroken[conduit.index] = true;
          this.breakConduit(e, conduit.index);
        }
        return amount;
      }
      this.ctx.fx.spawnImpact(
        point ? point.x : e.pos.x, point ? point.y : e.pos.y + e.height * 0.5,
        point ? point.z : e.pos.z, 'armor', dir,
      );
      return 0;
    }

    const weak = def.weakness;
    if (weak) {
      if (weak.kind === kind) dmg *= weak.multiplier;
      else if (weak.kind === 'headshot' && kind === 'bullet' && point
        && point.y > e.pos.y + e.height * 0.78) dmg *= weak.multiplier;
    }
    if (def.resist && def.resist[kind]) dmg *= def.resist[kind];

    e.health -= dmg;
    e.hurtFlash = 1;
    e.awake = true;
    e.lastSeen = 0;
    if (e.state === 'idle') this.setState(e, 'chase');

    if (e.health <= 0) {
      this.kill(e, kind, dir);
    } else if (this.ctx.audio && def.sounds && def.sounds.hurt && Math.random() < 0.55) {
      this.ctx.audio.play(def.sounds.hurt, { position: e.pos, volume: 0.55 });
    }
    return dmg;
  }

  ignite(e, seconds, dps) {
    if (!e.alive) return;
    e.burnTime = Math.max(e.burnTime, seconds);
    e.burnDps = Math.max(e.burnDps, dps);
  }

  kill(e, kind, dir) {
    if (!e.alive) return;
    e.alive = false;
    e.health = 0;
    this.aliveCount -= 1;
    this.killCount += 1;
    this.setState(e, 'die');
    e.removeAt = e.def.boss ? 8.0 : 3.2;
    if (this.ctx.audio && e.def.sounds && e.def.sounds.die) {
      this.ctx.audio.play(e.def.sounds.die, { position: e.pos, volume: 0.85 });
    }
    // Period-accurate gore: chunky low-res gibs, dark red, no anatomy.
    const gibs = e.def.gibs || 0;
    if (gibs > 0 && this.ctx.fx) {
      const violent = kind === 'splash' || kind === 'harpoon' || kind === 'focus';
      this.ctx.fx.spawnGibs(
        e.pos.x, e.pos.y + e.height * 0.5, e.pos.z,
        violent ? gibs + 3 : gibs, dir, violent ? 1.6 : 1.0,
      );
    }
    if (e.def.boss) this.bossActive = false;
  }

  /**
   * Which conduit, if any, a hit point lands on. Conduits are child groups of the
   * boss rig, so their world positions come from the scene graph.
   * @returns {{index:number, dist:number}|null}
   */
  nearestConduit(e, point) {
    if (!e.def.armorPhases) return null;
    let best = null;
    for (let i = 0; i < e.def.armorPhases; i += 1) {
      if (e.conduitBroken[i]) continue;
      const part = e.rig.parts[`conduit${i}`];
      if (!part) continue;
      part.getWorldPosition(_v);
      // Generous radius: the conduit is a metre-tall brass column on a moving
      // body, and the fight should reward aim without demanding pixel accuracy.
      const d = _v.distanceTo(point);
      if (d < 2.2 && (!best || d < best.dist)) best = { index: i, dist: d };
    }
    return best;
  }

  /** Puts out one conduit and thins the boss's silhouette shading a step. */
  breakConduit(e, index) {
    if (!e || !e.def.boss || e.armorPhase <= 0) return false;
    const i = index === undefined ? e.armorPhase - 1 : index;
    e.armorPhase = Math.max(0, e.armorPhase - 1);
    e.conduitBroken[i] = true;
    e.hurtFlash = 1;
    const part = e.rig.parts[`conduit${i}`];
    if (part) part.visible = false;
    const total = e.def.armorPhases || 3;
    // Each broken conduit makes the shape a little more legible.
    this.materials.scion.uniforms.uSilhouette.value = 0.55 * (e.armorPhase / total);
    if (this.ctx.audio) this.ctx.audio.play('mechanismLock', { volume: 1 });
    if (this.ctx.fx) {
      part && part.getWorldPosition(_v);
      this.ctx.fx.spawnShockwave(_v.x, _v.y, _v.z, 4.5);
    }
    return true;
  }

  setState(e, state) {
    if (e.state === state) return;
    e.state = state;
    e.stateTime = 0;
  }

  /* ------------------------------------------------------------ pathing */

  /** BFS flow field from the player's cell over open cells. */
  rebuildFlow() {
    const grid = this.ctx.world.grid;
    const p = this.ctx.player;
    const col = Math.floor(p.pos.x / CELL);
    const row = Math.floor(p.pos.z / CELL);
    if (col === this.flowOrigin.col && row === this.flowOrigin.row && this.flow) return;
    this.flowOrigin.col = col;
    this.flowOrigin.row = row;

    const size = grid.cols * grid.rows;
    if (!this.flow || this.flow.length !== size) this.flow = new Int32Array(size);
    this.flow.fill(-1);
    const start = grid.get(col, row);
    if (!start || !start.walk) return;

    const queue = new Int32Array(size);
    let head = 0;
    let tail = 0;
    const startIdx = row * grid.cols + col;
    this.flow[startIdx] = 0;
    queue[tail] = startIdx;
    tail += 1;
    while (head < tail) {
      const idx = queue[head];
      head += 1;
      const cRow = Math.floor(idx / grid.cols);
      const cCol = idx - cRow * grid.cols;
      const d = this.flow[idx];
      const here = grid.get(cCol, cRow);
      const y = here ? here.floorY : 0;
      for (let s = 0; s < 4; s += 1) {
        const nc = cCol + (s === 0 ? 1 : s === 1 ? -1 : 0);
        const nr = cRow + (s === 2 ? 1 : s === 3 ? -1 : 0);
        if (nc < 0 || nr < 0 || nc >= grid.cols || nr >= grid.rows) continue;
        const nIdx = nr * grid.cols + nc;
        if (this.flow[nIdx] !== -1) continue;
        const cell = grid.get(nc, nr);
        if (!cell || !cell.walk || cell.pit) continue;
        if (cell.door && !cell.doorOpen) continue;
        if (cell.floorY - y > 0.45 + 1e-4) continue;
        this.flow[nIdx] = d + 1;
        queue[tail] = nIdx;
        tail += 1;
      }
    }
  }

  /** Direction of steepest descent in the flow field, or null. */
  flowDirection(e, out) {
    const grid = this.ctx.world.grid;
    if (!this.flow) return null;
    const col = Math.floor(e.pos.x / CELL);
    const row = Math.floor(e.pos.z / CELL);
    const idx = row * grid.cols + col;
    if (idx < 0 || idx >= this.flow.length) return null;
    const here = this.flow[idx];
    if (here < 0) return null;
    let bestD = here;
    let bc = col;
    let br = row;
    for (let s = 0; s < 4; s += 1) {
      const nc = col + (s === 0 ? 1 : s === 1 ? -1 : 0);
      const nr = row + (s === 2 ? 1 : s === 3 ? -1 : 0);
      if (nc < 0 || nr < 0 || nc >= grid.cols || nr >= grid.rows) continue;
      const d = this.flow[nr * grid.cols + nc];
      if (d >= 0 && d < bestD) { bestD = d; bc = nc; br = nr; }
    }
    if (bc === col && br === row) return null;
    // Aim at the target cell's centre so movement hugs corridors.
    out.set((bc + 0.5) * CELL - e.pos.x, 0, (br + 0.5) * CELL - e.pos.z);
    const len = Math.hypot(out.x, out.z);
    if (len < 1e-4) return null;
    out.multiplyScalar(1 / len);
    return out;
  }

  /* ------------------------------------------------------------ frame */

  update(dt, time) {
    const { player, world, audio, lights } = this.ctx;
    this.flowTimer -= dt;
    if (this.flowTimer <= 0) { this.rebuildFlow(); this.flowTimer = 0.22; }

    let pressure = 0;

    for (let i = this.list.length - 1; i >= 0; i -= 1) {
      const e = this.list[i];
      e.stateTime += dt;
      e.hurtFlash = Math.max(0, e.hurtFlash - dt * 5.5);

      if (!e.alive) {
        e.removeAt -= dt;
        e.rig.animate('die', e.stateTime, time);
        e.group.position.copy(e.pos);
        e.group.rotation.y = e.yaw;
        if (e.removeAt <= 0) {
          this.ctx.scene.remove(e.group);
          e.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
          this.list.splice(i, 1);
        }
        continue;
      }

      /* --- burning --- */
      if (e.burnTime > 0) {
        e.burnTime -= dt;
        this.damage(e, e.burnDps * dt, 'burn', null, null);
        if (this.ctx.fx && Math.random() < dt * 12) {
          this.ctx.fx.spawnEmber(e.pos.x, e.pos.y + e.height * 0.6, e.pos.z);
        }
        if (lights) lights.add(e.centre, 4.0, '#ff9a3c', 0.7);
        if (!e.alive) continue;
      }

      /* --- senses --- */
      const toPlayer = _v.set(player.pos.x - e.pos.x, 0, player.pos.z - e.pos.z);
      const dist = toPlayer.length();
      const eyeY = e.pos.y + e.height * 0.8;
      const canSee = dist < 42 && lineOfSight(
        world.grid, e.pos.x, eyeY, e.pos.z,
        player.pos.x, player.eyePosition, player.pos.z, 45,
      );
      if (canSee) {
        e.lastSeen = 0;
        if (!e.awake) {
          e.awake = true;
          if (audio && e.def.sounds && e.def.sounds.alert) {
            audio.play(e.def.sounds.alert, { position: e.pos, volume: 0.75 });
          }
        }
      } else {
        e.lastSeen += dt;
      }

      /* --- sanity pressure from being near a horror you can see --- */
      if (canSee && dist < SANITY.proximityRange) {
        pressure += e.def.sanityAura * (1 - dist / SANITY.proximityRange);
      }

      if (e.attackCooldown > 0) e.attackCooldown -= dt;
      if (e.blinkCooldown > 0) e.blinkCooldown -= dt;
      if (e.summonCooldown > 0) e.summonCooldown -= dt;

      this.think(e, dt, dist, canSee, toPlayer);
      this.move(e, dt, dist);

      /* --- render pose --- */
      e.rig.animate(e.state, e.stateTime, time);
      e.group.position.copy(e.pos);
      // Turn in steps: enemies snap to face rather than sliding round.
      const turnStep = Math.PI / 8;
      let diff = e.targetYaw - e.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(diff) > turnStep * 0.5) e.yaw += Math.sign(diff) * Math.min(Math.abs(diff), turnStep * dt * 9);
      e.group.rotation.y = e.yaw;
      const mat = this.materials[e.type];
      mat.uniforms.uHurt.value = e.hurtFlash;

      // The eye cluster is its own light source, which is how you spot it in fog.
      if (e.type === 'eye' && lights) {
        lights.add(e.centre, 6.0, '#9fe08a', e.state === 'telegraph' ? 1.5 : 0.5);
      }

      /* Every unbroken boss conduit carries its own light. The fight is built on
       * shooting them, so they have to be the brightest thing in the arena; a
       * dark target in fog is not a mechanic, it is a guess. */
      if (e.def.boss && e.armorPhase > 0 && lights) {
        for (let ci = 0; ci < (e.def.armorPhases || 0); ci += 1) {
          if (e.conduitBroken[ci]) continue;
          const part = e.rig.parts[`conduit${ci}`];
          if (!part) continue;
          part.getWorldPosition(_v);
          // Pulses on the stop-motion clock so it reads as charged, not steady.
          const pulse = 1.6 + Math.sin(Math.floor(time * 6) * 1.7 + ci) * 0.5;
          lights.add(_v, 11.0, '#c9e07a', pulse);
        }
      }
    }

    this.sanityPressure = pressure;
  }

  /** The state machine. Every branch either telegraphs or recovers. */
  think(e, dt, dist, canSee, toPlayer) {
    const def = e.def;
    const { player, audio, fx } = this.ctx;
    if (dist > 0.01) e.targetYaw = Math.atan2(toPlayer.x, toPlayer.z);

    switch (e.state) {
      case 'idle':
        if (e.awake) this.setState(e, 'chase');
        break;

      case 'chase': {
        const melee = def.melee;
        const ranged = def.ranged;
        const lunge = def.lunge;
        if (e.attackCooldown <= 0) {
          if (def.boss && def.slam && dist < def.slam.radius * 0.9) {
            this.setState(e, 'telegraph');
            e.pendingAttack = 'slam';
          } else if (melee && dist <= melee.range) {
            this.setState(e, 'telegraph');
            e.pendingAttack = 'melee';
          } else if (lunge && dist <= lunge.range && dist > (melee ? melee.range : 0) && canSee) {
            this.setState(e, 'telegraph');
            e.pendingAttack = 'lunge';
          } else if (ranged && dist <= ranged.range && canSee) {
            this.setState(e, 'telegraph');
            e.pendingAttack = ranged.summon ? 'summon' : 'ranged';
          }
        }
        // The wearer teleports out of trouble rather than trading.
        if (def.blink && e.blinkCooldown <= 0 && dist < 6 && canSee) {
          this.setState(e, 'blink');
        }
        if (!canSee && e.lastSeen > 8) { e.awake = false; this.setState(e, 'idle'); }
        break;
      }

      case 'telegraph': {
        const windup = e.pendingAttack === 'slam' ? def.slam.windup
          : e.pendingAttack === 'lunge' ? def.lunge.windup
            : e.pendingAttack === 'ranged' || e.pendingAttack === 'summon' ? def.ranged.windup
              : def.melee.windup;
        if (e.stateTime === 0 || (!e._telegraphSound && e.stateTime > 0.02)) {
          e._telegraphSound = true;
          if (audio && def.sounds.attack) {
            audio.play(def.sounds.attack, { position: e.pos, volume: 0.8 });
          }
        }
        if (e.stateTime >= windup) {
          e._telegraphSound = false;
          this.setState(e, e.pendingAttack === 'lunge' ? 'lunge' : 'attack');
        }
        break;
      }

      case 'attack': {
        const kind = e.pendingAttack;
        if (!e._struck) {
          e._struck = true;
          if (kind === 'melee' && dist <= def.melee.range + 0.6) {
            player.damage(def.melee.damage, this.relativeAngle(e), 'melee');
          } else if (kind === 'slam') {
            if (dist <= def.slam.radius) {
              const falloff = 1 - dist / def.slam.radius;
              player.damage(def.slam.damage * falloff, this.relativeAngle(e), 'slam');
            }
            if (fx) fx.spawnShockwave(e.pos.x, e.pos.y, e.pos.z, def.slam.radius);
          } else if (kind === 'ranged') {
            this.fireRanged(e);
          } else if (kind === 'summon') {
            this.summon(e);
          }
        }
        const active = kind === 'slam' ? def.slam.windup * 0.2 : (def.melee ? def.melee.active : 0.18);
        if (e.stateTime >= active) {
          e._struck = false;
          this.setState(e, 'recover');
        }
        break;
      }

      case 'lunge': {
        // Commits: the crawler cannot turn once it leaves the ground.
        if (e.stateTime === 0 || !e._lunged) {
          e._lunged = true;
          const dir = _v.set(Math.sin(e.yaw), 0, Math.cos(e.yaw));
          e.vel.x = dir.x * def.lunge.speed;
          e.vel.z = dir.z * def.lunge.speed;
          e.vel.y = 4.2;
        }
        if (dist < def.melee.range && !e._struck) {
          e._struck = true;
          player.damage(def.lunge.damage, this.relativeAngle(e), 'lunge');
        }
        if (e.stateTime > 0.55) { e._lunged = false; e._struck = false; this.setState(e, 'recover'); }
        break;
      }

      case 'recover': {
        const rec = def.melee ? def.melee.recover : 0.6;
        if (e.stateTime >= rec) {
          e.attackCooldown = e.pendingAttack === 'slam' ? def.slam.cooldown
            : def.ranged ? def.ranged.cooldown : 0.35;
          this.setState(e, 'chase');
        }
        break;
      }

      case 'blink': {
        if (e.stateTime >= def.blink.windup) {
          // Reappears at a random open cell within range, away from the player.
          const spot = this.findBlinkSpot(e, def.blink.range);
          if (spot) {
            if (fx) fx.spawnBlink(e.pos.x, e.pos.y + 1, e.pos.z);
            e.pos.set(spot.x, spot.y, spot.z);
            if (fx) fx.spawnBlink(spot.x, spot.y + 1, spot.z);
            if (audio) audio.play('portalEnter', { position: e.pos, volume: 0.6 });
          }
          e.blinkCooldown = def.blink.cooldown;
          this.setState(e, 'chase');
        }
        break;
      }
      default:
        break;
    }
  }

  relativeAngle(e) {
    const { player } = this.ctx;
    const a = Math.atan2(e.pos.x - player.pos.x, e.pos.z - player.pos.z);
    let rel = a - (player.yaw + Math.PI);
    while (rel > Math.PI) rel -= Math.PI * 2;
    while (rel < -Math.PI) rel += Math.PI * 2;
    return rel;
  }

  fireRanged(e) {
    const { player, fx } = this.ctx;
    const def = e.def.ranged;
    const from = _v.set(e.pos.x, e.pos.y + e.height * 0.72, e.pos.z);
    const to = _v2.set(player.pos.x, player.eyePosition, player.pos.z);
    const dir = to.sub(from).normalize();
    if (def.beam) {
      // The beam is instant but only after a very long telegraph.
      fx.spawnBeam(from, dir, def.range, def.beamTime);
      const hit = lineOfSight(this.ctx.world.grid, from.x, from.y, from.z,
        player.pos.x, player.eyePosition, player.pos.z, def.range);
      if (hit) player.damage(def.damage, this.relativeAngle(e), 'beam');
    } else {
      fx.spawnProjectile({
        kind: 'spit',
        x: from.x, y: from.y, z: from.z,
        vx: dir.x * def.speed, vy: dir.y * def.speed, vz: dir.z * def.speed,
        damage: def.damage,
        owner: 'enemy',
      });
    }
  }

  summon(e) {
    const def = e.def.ranged;
    const grid = this.ctx.world.grid;
    let placed = 0;
    for (let attempt = 0; attempt < 24 && placed < def.count; attempt += 1) {
      const a = Math.random() * Math.PI * 2;
      const r = 2.0 + Math.random() * 4.0;
      const x = e.pos.x + Math.cos(a) * r;
      const z = e.pos.z + Math.sin(a) * r;
      const cell = grid.atWorld(x, z);
      if (!cell || !cell.walk || cell.pit || (cell.door && !cell.doorOpen)) continue;
      const spawned = this.spawn(def.summon, x, cell.floorY, z, { spawnedBy: e });
      spawned.awake = true;
      this.setState(spawned, 'chase');
      if (this.ctx.fx) this.ctx.fx.spawnBlink(x, cell.floorY + 0.6, z);
      placed += 1;
    }
    if (this.ctx.audio) this.ctx.audio.play('summonerSpawn', { position: e.pos, volume: 0.9 });
  }

  findBlinkSpot(e, range) {
    const grid = this.ctx.world.grid;
    const { player } = this.ctx;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const a = Math.random() * Math.PI * 2;
      const r = range * (0.5 + Math.random() * 0.5);
      const x = e.pos.x + Math.cos(a) * r;
      const z = e.pos.z + Math.sin(a) * r;
      const cell = grid.atWorld(x, z);
      if (!cell || !cell.walk || cell.pit || (cell.door && !cell.doorOpen)) continue;
      // Prefer somewhere that is not right on top of the player.
      if (Math.hypot(x - player.pos.x, z - player.pos.z) < 4) continue;
      return { x, y: cell.floorY, z };
    }
    return null;
  }

  /** Movement and gravity. Flying enemies hover instead. */
  move(e, dt, dist) {
    const def = e.def;
    const world = this.ctx.world;
    const body = e._body;
    body.x = e.pos.x;
    body.z = e.pos.z;
    body.y = e.pos.y;

    const chasing = e.state === 'chase';
    const committed = e.state === 'lunge';
    let speed = 0;
    if (chasing) {
      speed = (def.chargeSpeed && dist < 12) ? def.chargeSpeed : def.speed;
      // Do not crowd: back off slightly inside melee range so the telegraph reads.
      if (def.melee && dist < def.melee.range * 0.75) speed *= -0.4;
    }

    if (committed) {
      // Ballistic: the lunge carries whatever velocity it was given.
      moveHorizontal(world.grid, body, e.vel.x * dt, e.vel.z * dt);
      e.vel.y -= 20 * dt;
    } else if (speed !== 0) {
      const dir = this.flowDirection(e, _v);
      if (dir) {
        e.vel.x = dir.x * speed;
        e.vel.z = dir.z * speed;
      } else {
        // No path: walk straight at the player and let collision sort it out.
        const t = _v.set(this.ctx.player.pos.x - e.pos.x, 0, this.ctx.player.pos.z - e.pos.z);
        if (t.lengthSq() > 1e-4) {
          t.normalize();
          e.vel.x = t.x * speed;
          e.vel.z = t.z * speed;
        }
      }
      moveHorizontal(world.grid, body, e.vel.x * dt, e.vel.z * dt);
    } else {
      e.vel.x = 0;
      e.vel.z = 0;
    }
    e.pos.x = body.x;
    e.pos.z = body.z;

    if (def.flying) {
      const ground = groundUnder(world.grid, e.pos.x, e.pos.z, e.radius, e.pos.y, 0.6, 2.0);
      const target = Math.min(ground.floorY + def.hoverHeight, ground.ceilY - 0.7);
      e.pos.y += (target - e.pos.y) * Math.min(1, dt * 2.2);
    } else {
      e.vel.y -= 20 * dt;
      e.pos.y += e.vel.y * dt;
      const ground = groundUnder(world.grid, e.pos.x, e.pos.z, e.radius, e.pos.y, e.height, 0.45);
      if (e.pos.y <= ground.floorY) {
        e.pos.y = ground.floorY;
        e.vel.y = 0;
      }
    }
  }

  /** Everything still alive, for the director's encounter gates. */
  aliveIn(colMin, rowMin, colMax, rowMax) {
    let n = 0;
    for (const e of this.list) {
      if (!e.alive) continue;
      const col = Math.floor(e.pos.x / CELL);
      const row = Math.floor(e.pos.z / CELL);
      if (col >= colMin && col <= colMax && row >= rowMin && row <= rowMax) n += 1;
    }
    return n;
  }

  dispose() {
    for (const e of this.list) {
      this.ctx.scene.remove(e.group);
      e.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    }
    this.list.length = 0;
  }
}
