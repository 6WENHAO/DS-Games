// First-person player: Minecraft physics + No Man's Sky survival systems and multi-tool.
import * as THREE from 'three';
import { BLOCKS, BID, RT } from '../world/blocks.js';
import { itemKeyForBlock, ITEMS } from '../data/items.js';
import { clamp } from '../core/noise.js';

const WIDTH = 0.6, HEIGHT = 1.8, EYE = 1.62, CROUCH_H = 1.45, CROUCH_EYE = 1.28;
const WALK = 4.317, SPRINT = 5.612, CROUCH_SPD = 1.4, SWIM = 3.2;
const GRAVITY = 32, JUMP_V = 9.0, TERMINAL = -58;
const JET_ACCEL = 26, JET_MAX_V = 7.5;
const REACH = 5.0;

export class Player {
  constructor(game) {
    this.game = game;
    this.pos = new THREE.Vector3(0, 60, 0);
    this.vel = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0;
    this.onGround = false;
    this.inWater = false;
    this.headInWater = false;
    this.crouching = false;
    this.sprinting = false;
    this.height = HEIGHT;
    this.eyeH = EYE;

    // vitals
    this.health = 100; this.maxHealth = 100;
    this.shield = 100; this.maxShield = 100;
    this.life = 100; this.maxLife = 100;
    this.hazard = 100; this.maxHazard = 100;
    this.jet = 100; this.maxJet = 100;
    this.jetting = false;
    this.lastDamage = -99;
    this.dead = false;

    // multi-tool
    this.tool = { beam: true, scanner: true, visor: true, power: 1.9, heat: 0, overheated: false, cooldown: 0 };
    this.mining = { target: null, progress: 0, lastKey: '', firing: false };
    this.visorOn = false;
    this.analyse = { target: null, progress: 0 };
    this.lampOn = false;
    this.wanted = 0; // sentinel suspicion

    this.hotbar = new Array(9).fill(null); // slot indices into inventory
    this.selected = 0;
    this.stepTimer = 0;
    this.bob = 0;
    this.viewRoll = 0;
    this.fovMod = 0;
    this.lastGroundY = this.pos.y;
    this.recentBlockBreaks = 0;

    this.beamHandle = null;
    this.jetHandle = null;
    this._tmp = new THREE.Vector3();
    this._dir = new THREE.Vector3();
  }

  get eye() { return new THREE.Vector3(this.pos.x, this.pos.y + this.eyeH, this.pos.z); }

  spawn(p) {
    this.pos.set(p.x, p.y, p.z);
    this.vel.set(0, 0, 0);
    this.dead = false;
    this.health = this.maxHealth;
    this.lastGroundY = p.y;
  }

  lookDir(out = new THREE.Vector3()) {
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    out.set(-Math.sin(this.yaw) * cp, sp, -Math.cos(this.yaw) * cp);
    return out.normalize();
  }

  /* ---------------- physics ---------------- */
  aabbCollides(x, y, z) {
    const w = WIDTH / 2;
    const world = this.game.world;
    const x0 = Math.floor(x - w), x1 = Math.floor(x + w);
    const y0 = Math.floor(y), y1 = Math.floor(y + this.height - 0.001);
    const z0 = Math.floor(z - w), z1 = Math.floor(z + w);
    for (let by = y0; by <= y1; by++)
      for (let bz = z0; bz <= z1; bz++)
        for (let bx = x0; bx <= x1; bx++) {
          const id = world.getBlock(bx, by, bz);
          if (!id) continue;
          const d = BLOCKS[id];
          if (d.solid && d.collide) return true;
        }
    return false;
  }

  physics(dt) {
    const world = this.game.world;
    const input = this.game.input;
    const uiBlocked = this.game.uiBlocking;

    // look
    if (!uiBlocked && input.locked) {
      this.yaw -= input.mouse.dx * input.sensitivity;
      this.pitch -= input.mouse.dy * input.sensitivity * (input.invertY ? -1 : 1);
      this.pitch = clamp(this.pitch, -Math.PI / 2 + 0.02, Math.PI / 2 - 0.02);
    }

    // water state
    const feetBlock = world.blockAt(this.pos.x, this.pos.y + 0.2, this.pos.z);
    const headBlock = world.blockAt(this.pos.x, this.pos.y + this.eyeH, this.pos.z);
    this.inWater = feetBlock === BID.WATER;
    this.headInWater = headBlock === BID.WATER;

    // input direction
    let ix = 0, iz = 0;
    if (!uiBlocked) {
      if (input.down('KeyW')) iz -= 1;
      if (input.down('KeyS')) iz += 1;
      if (input.down('KeyA')) ix -= 1;
      if (input.down('KeyD')) ix += 1;
    }
    const len = Math.hypot(ix, iz);
    if (len > 0) { ix /= len; iz /= len; }

    this.crouching = !uiBlocked && input.down('ControlLeft');
    this.sprinting = !uiBlocked && input.down('ShiftLeft') && len > 0 && !this.crouching;
    const targetH = this.crouching ? CROUCH_H : HEIGHT;
    if (targetH > this.height && this.aabbCollides(this.pos.x, this.pos.y, this.pos.z)) {
      // can't stand up
    } else this.height = targetH;
    this.eyeH += ((this.crouching ? CROUCH_EYE : EYE) - this.eyeH) * Math.min(1, dt * 12);

    let speed = this.crouching ? CROUCH_SPD : this.sprinting ? SPRINT : WALK;
    if (this.inWater) speed = SWIM;

    // desired horizontal velocity in world space
    // camera looks down -Z after rotateY(yaw): forward = (-sin, -cos), right = (cos, -sin)
    const sinY = Math.sin(this.yaw), cosY = Math.cos(this.yaw);
    const dx = ix * cosY + iz * sinY;
    const dz = iz * cosY - ix * sinY;
    const targetVx = dx * speed, targetVz = dz * speed;
    const accel = this.onGround ? 26 : (this.inWater ? 10 : 9);
    this.vel.x += (targetVx - this.vel.x) * Math.min(1, accel * dt);
    this.vel.z += (targetVz - this.vel.z) * Math.min(1, accel * dt);

    // jump / jetpack / swim
    const wantUp = !uiBlocked && input.down('Space');
    this.jetting = false;
    if (this.inWater) {
      this.vel.y += (wantUp ? 14 : -6) * dt;
      this.vel.y = clamp(this.vel.y, -4.5, 4.2);
      this.jet = Math.min(this.maxJet, this.jet + 26 * dt);
    } else if (wantUp && this.onGround) {
      this.vel.y = JUMP_V;
      this.onGround = false;
      this.game.audio.footstep(this.groundMaterial(), true);
    } else if (wantUp && !this.onGround && this.jet > 0.5) {
      this.vel.y = Math.min(this.vel.y + JET_ACCEL * dt * (this.game.creative ? 1.5 : 1), JET_MAX_V * (this.game.creative ? 2.2 : 1));
      if (!this.game.creative) this.jet = Math.max(0, this.jet - 26 * dt);
      this.jetting = true;
      const p = this.game.particles;
      if (p && Math.random() < 0.9) {
        p.trail(this.pos.x + (Math.random() - 0.5) * 0.4, this.pos.y + 0.5, this.pos.z + (Math.random() - 0.5) * 0.4,
          Math.random() < 0.5 ? '#7fd8ff' : '#ffffff', { life: 0.35, size: 0.1, spread: 0.6, grav: -0.1, glow: true });
      }
    }
    if (!this.inWater) this.vel.y = Math.max(TERMINAL, this.vel.y - GRAVITY * dt);
    if (this.onGround && !this.jetting) this.jet = Math.min(this.maxJet, this.jet + 34 * dt);

    // jetpack audio
    if (this.jetting && !this.jetHandle) this.jetHandle = this.game.audio.startJetpack();
    else if (!this.jetting && this.jetHandle) { this.game.audio.stopJetpack(); this.jetHandle = null; }

    // integrate with per-axis collision
    const move = (axis, amount) => {
      if (amount === 0) return;
      const p = this.pos;
      const nx = axis === 'x' ? p.x + amount : p.x;
      const ny = axis === 'y' ? p.y + amount : p.y;
      const nz = axis === 'z' ? p.z + amount : p.z;
      if (!this.aabbCollides(nx, ny, nz)) { p[axis] += amount; return; }
      // step up (0.6 like Minecraft)
      if (axis !== 'y' && this.onGround) {
        for (const step of [0.55, 0.85, 1.05]) {
          if (!this.aabbCollides(nx, p.y + step, nz)) {
            p.y += step; p[axis] += amount; return;
          }
        }
      }
      if (axis === 'y') {
        if (amount < 0) {
          const fall = this.lastGroundY - this.pos.y;
          if (!this.onGround && fall > 3.2 && !this.inWater) {
            const dmg = Math.floor((fall - 3.2) * 3.4);
            if (dmg > 0) this.damage(dmg, 'fall');
          }
          this.onGround = true;
          this.lastGroundY = this.pos.y;
        }
        this.vel.y = 0;
      } else {
        this.vel[axis] = 0;
      }
    };
    move('y', this.vel.y * dt);
    move('x', this.vel.x * dt);
    move('z', this.vel.z * dt);
    if (this.vel.y > 0.01) this.onGround = false;
    if (this.onGround) this.lastGroundY = Math.max(this.lastGroundY, this.pos.y);
    if (!this.onGround && this.vel.y > 0) this.lastGroundY = this.pos.y;

    // ground check when walking off a ledge
    if (this.onGround && !this.aabbCollides(this.pos.x, this.pos.y - 0.06, this.pos.z)) this.onGround = false;

    // anti-stuck: if we somehow end up inside solid blocks, rise until free
    if (this.aabbCollides(this.pos.x, this.pos.y, this.pos.z)) {
      this._stuck = (this._stuck || 0) + dt;
      if (this._stuck > 0.1) {
        for (let i = 0; i < 24; i++) {
          this.pos.y += 0.5;
          if (!this.aabbCollides(this.pos.x, this.pos.y, this.pos.z)) break;
        }
        this.vel.set(0, 0, 0);
        this.lastGroundY = this.pos.y;
        this._stuck = 0;
      }
    } else this._stuck = 0;

    // footsteps + head bob
    const hv = Math.hypot(this.vel.x, this.vel.z);
    if (this.onGround && hv > 0.9) {
      this.stepTimer -= dt * (hv / WALK);
      if (this.stepTimer <= 0) {
        this.stepTimer = this.sprinting ? 0.31 : 0.44;
        this.game.audio.footstep(this.groundMaterial(), this.sprinting);
      }
      this.bob += dt * hv * 1.5;
    } else if (this.inWater && hv > 0.5) {
      this.stepTimer -= dt;
      if (this.stepTimer <= 0) { this.stepTimer = 0.7; this.game.audio.footstep('water', false); }
    }
    this.viewRoll += ((-this.vel.x * sinY - this.vel.z * cosY) * 0 + (ix * 0.02) - this.viewRoll) * Math.min(1, dt * 6);

    // out of world guard
    if (this.pos.y < -8) { this.damage(999, 'void'); }
  }

  groundMaterial() {
    const world = this.game.world;
    const id = world.getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y - 0.2), Math.floor(this.pos.z));
    if (!id) return 'stone';
    return BLOCKS[id].sound || 'stone';
  }

  /* ---------------- vitals ---------------- */
  vitalsUpdate(dt) {
    const g = this.game;
    if (g.creative) {
      // creative mode: all life-support systems are irrelevant
      this.life = this.maxLife;
      this.hazard = this.maxHazard;
      this.jet = this.maxJet;
      this.shield = this.maxShield;
      this.health = this.maxHealth;
      return;
    }
    const planet = g.planet;
    const now = g.time;
    // life support: drains constantly, faster when sprinting or in vacuum/underwater
    let drain = 0.62;
    if (this.sprinting) drain += 0.35;
    if (this.headInWater) drain += 1.5;
    if (planet && planet.hazard === 'none') drain *= 0.8;
    this.life = Math.max(0, this.life - drain * dt);

    // hazard protection
    if (planet && planet.hazard !== 'none') {
      const sheltered = g.world.getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y + this.height + 2), Math.floor(this.pos.z)) !== 0;
      const level = planet.hazardLevel || 1;
      let hd = 0.45 + level * 0.42;
      if (sheltered) hd *= 0.25;
      if (g.storm) hd *= 2.4;
      this.hazard = Math.max(0, this.hazard - hd * dt);
    } else if (g.storm) {
      this.hazard = Math.max(0, this.hazard - 1.4 * dt);
    } else {
      this.hazard = Math.min(this.maxHazard, this.hazard + 2 * dt);
    }

    // damage when systems fail
    if (this.life <= 0) this.damageOverTime(5.5 * dt, 'life');
    if (this.hazard <= 0 && planet && planet.hazard !== 'none') this.damageOverTime(6.5 * dt, 'hazard');

    // lava / hot blocks
    const feet = g.world.blockAt(this.pos.x, this.pos.y + 0.2, this.pos.z);
    if (feet === BID.WATER && planet && planet.biome === 'volcanic') this.damageOverTime(14 * dt, 'lava');

    // shield + health regen
    if (now - this.lastDamage > 7) this.shield = Math.min(this.maxShield, this.shield + 6 * dt);
    if (now - this.lastDamage > 13) this.health = Math.min(this.maxHealth, this.health + 1.4 * dt);

    // alarms
    if (this.life < 20 && this.life > 0) {
      this._alarmT = (this._alarmT || 0) - dt;
      if (this._alarmT <= 0) { this._alarmT = this.life < 8 ? 0.7 : 1.6; g.audio.lowResourceAlarm('life'); }
    }
    if (this.health < 30 && !this.dead) {
      this._hbT = (this._hbT || 0) - dt;
      if (this._hbT <= 0) { this._hbT = 1.25; g.audio.heartbeat(); }
    }
    if (this.health <= 0 && !this.dead) this.die();
  }

  damage(n, type = 'hit') {
    if (this.dead || this.game.creative) return;
    const g = this.game;
    this.lastDamage = g.time;
    if (this.shield > 0) {
      const absorbed = Math.min(this.shield, n * 0.8);
      this.shield -= absorbed;
      n -= absorbed;
      g.audio.shieldHit();
    }
    if (n > 0) {
      this.health = Math.max(0, this.health - n);
      g.audio.hurt();
      g.ui.damageFlash();
    }
    g.ui.shake(Math.min(0.6, n * 0.03));
    if (this.health <= 0) this.die();
  }

  damageOverTime(n, type) {
    if (this.dead || this.game.creative) return;
    this.health = Math.max(0, this.health - n);
    this._dotT = (this._dotT || 0) - n;
    if (this._dotT <= 0) {
      this._dotT = 6;
      this.game.audio.hurt();
      this.game.ui.damageFlash();
      this.game.ui.toast({ kind: 'warn', name: type === 'life' ? '生命维持失效!' : type === 'hazard' ? '危害防护失效!' : '受到伤害', amt: '' });
    }
    if (this.health <= 0) this.die();
  }

  die() {
    if (this.dead) return;
    this.dead = true;
    this.game.onPlayerDeath();
  }

  rechargeSystems() {
    const g = this.game;
    const inv = g.inventory;
    let did = false;
    if (this.life < this.maxLife - 1) {
      if (inv.has('OXYGEN', 20)) { inv.remove('OXYGEN', 20); this.life = Math.min(this.maxLife, this.life + 55); did = true; }
      else if (inv.has('LIFE_SUPPORT_GEL', 1)) { inv.remove('LIFE_SUPPORT_GEL', 1); this.life = this.maxLife; did = true; }
    }
    if (this.hazard < this.maxHazard - 1) {
      if (inv.has('SODIUM', 10)) { inv.remove('SODIUM', 10); this.hazard = Math.min(this.maxHazard, this.hazard + 60); did = true; }
      else if (inv.has('SODIUM_NITRATE', 4)) { inv.remove('SODIUM_NITRATE', 4); this.hazard = this.maxHazard; did = true; }
    }
    if (this.shield < this.maxShield - 1 && inv.has('SODIUM', 10)) {
      inv.remove('SODIUM', 10); this.shield = Math.min(this.maxShield, this.shield + 50); did = true;
    }
    if (did) {
      g.audio.confirm();
      g.ui.toast({ kind: 'info', name: '系统已充能', amt: '' });
    } else {
      g.audio.uiError();
      g.ui.toast({ kind: 'warn', name: '缺少充能材料 (氧 / 钠)', amt: '' });
    }
    return did;
  }

  /* ---------------- multi-tool ---------------- */
  interactUpdate(dt) {
    const g = this.game;
    const input = g.input;
    const world = g.world;
    const eye = this.eye;
    const dir = this.lookDir(this._dir);
    const hit = world.raycast(eye, dir, REACH);
    this.aimHit = hit;

    // heat decay
    if (!this.mining.firing) this.tool.heat = Math.max(0, this.tool.heat - dt * 0.45);
    if (this.tool.overheated) {
      this.tool.cooldown -= dt;
      if (this.tool.cooldown <= 0) { this.tool.overheated = false; this.tool.heat = 0; }
    }

    if (g.uiBlocking || !input.locked) { this.stopBeam(); this.mining.progress = 0; return; }

    // analysis visor mode
    if (this.visorOn) {
      this.stopBeam();
      this.updateAnalyse(dt, hit);
      return;
    }

    const wantFire = input.mouse.left && !this.tool.overheated;
    if (wantFire && hit) {
      const def = BLOCKS[hit.id];
      const hkey = hit.x + ',' + hit.y + ',' + hit.z;
      if (this.mining.lastKey !== hkey) { this.mining.lastKey = hkey; this.mining.progress = 0; }
      if (def.hardness < 0) {
        this.mining.progress = 0;
      } else {
        this.startBeam();
        this.mining.firing = true;
        if (!g.creative) this.tool.heat = Math.min(1, this.tool.heat + dt * 0.24);
        if (this.beamHandle) this.beamHandle.setHeat(this.tool.heat);
        if (this.tool.heat >= 1) {
          this.tool.overheated = true; this.tool.cooldown = 2.4;
          g.audio.beamOverheat();
          this.stopBeam();
          g.ui.toast({ kind: 'warn', name: '采矿光束过热', amt: '冷却中' });
        }
        const need = g.creative ? 0.04 : Math.max(0.12, def.hardness * 1.5 / this.tool.power);
        this.mining.progress += dt / need;
        // impact particles + light
        const px = hit.x + 0.5 + hit.nx * 0.55, py = hit.y + 0.5 + hit.ny * 0.55, pz = hit.z + 0.5 + hit.nz * 0.55;
        if (Math.random() < 0.55) {
          g.particles.trail(px, py, pz, def.resource ? '#ffd08a' : '#ffb86a', { life: 0.3, size: 0.07, spread: 1.2, grav: 0.4, glow: true });
        }
        if (this.mining.progress >= 1) {
          this.breakBlock(hit);
          this.mining.progress = 0;
        }
      }
    } else {
      this.mining.firing = false;
      this.stopBeam();
      this.mining.progress = Math.max(0, this.mining.progress - dt * 1.6);
    }

    // place block
    if (input.mousePressed.right && hit) {
      this.tryPlace(hit);
    }
  }

  startBeam() {
    if (!this.beamHandle) this.beamHandle = this.game.audio.startMiningBeam();
  }
  stopBeam() {
    if (this.beamHandle) { this.game.audio.stopMiningBeam(); this.beamHandle = null; }
    this.mining.firing = false;
  }

  breakBlock(hit) {
    const g = this.game;
    const def = BLOCKS[hit.id];
    const cx = hit.x + 0.5, cy = hit.y + 0.5, cz = hit.z + 0.5;
    g.world.setBlock(hit.x, hit.y, hit.z, 0);
    g.audio.blockBreak(def.sound, 0);
    const col = g.palette.blockColor(hit.id);
    g.particles.burst(cx, cy, cz, col, def.rt === RT.CROSS ? 8 : 16, { size: 0.11, life: 0.85, spread: 2.4, glow: def.emissive > 0.4 });

    // drops
    let gained = null;
    if (def.resource) {
      const [a, b] = def.dropCount;
      const n = a + Math.floor(Math.random() * (b - a + 1));
      const added = g.inventory.add(def.resource, n);
      if (added < n) g.ui.toast({ kind: 'warn', name: '背包已满', amt: '' });
      gained = { key: def.resource, n: added };
    } else if (def.drop) {
      const key = itemKeyForBlock(BID[def.drop] !== undefined ? BID[def.drop] : hit.id);
      const added = g.inventory.add(ITEMS[key] ? key : itemKeyForBlock(hit.id), 1);
      gained = { key: ITEMS[key] ? key : itemKeyForBlock(hit.id), n: added };
    } else {
      const added = g.inventory.add(itemKeyForBlock(hit.id), 1);
      gained = { key: itemKeyForBlock(hit.id), n: added };
    }
    if (gained && gained.n > 0) {
      g.audio.itemPickup(!!def.resource);
      g.ui.toast({ kind: 'get', key: gained.key, amt: '+' + gained.n });
      g.onResourceGained(gained.key, gained.n);
    }
    // sentinel suspicion
    this.recentBlockBreaks++;
    g.onBlockBroken(hit, def);
  }

  tryPlace(hit) {
    const g = this.game;
    const sel = this.currentItem();
    if (!sel) return;
    const def = ITEMS[sel.key];
    if (!def || def.type !== 'block') {
      // interact-like usage of non-block items: ignore
      return;
    }
    const bx = hit.x + hit.nx, by = hit.y + hit.ny, bz = hit.z + hit.nz;
    if (g.world.getBlock(bx, by, bz)) return;
    // don't place inside the player
    const w = WIDTH / 2 + 0.02;
    if (bx + 1 > this.pos.x - w && bx < this.pos.x + w &&
        bz + 1 > this.pos.z - w && bz < this.pos.z + w &&
        by + 1 > this.pos.y && by < this.pos.y + this.height) return;
    const blockId = def.block;
    if (g.world.setBlock(bx, by, bz, blockId)) {
      g.inventory.remove(sel.key, 1);
      g.audio.blockPlace(BLOCKS[blockId].sound);
      const col = g.palette.blockColor(blockId);
      g.particles.burst(bx + 0.5, by + 0.5, bz + 0.5, col, 5, { size: 0.07, life: 0.4, spread: 1.1 });
      g.onBlockPlaced(bx, by, bz, blockId);
    }
  }

  updateAnalyse(dt, hit) {
    const g = this.game;
    const target = g.findScanTarget(hit);
    this.analyse.target = target;
    if (target && g.input.mouse.left) {
      this.analyse.progress += dt / 1.15;
      if (!this._chargeSfx) this._chargeSfx = g.audio.startCharge();
      if (this.analyse.progress >= 1) {
        this.analyse.progress = 0;
        if (this._chargeSfx) { this._chargeSfx.stop(false); this._chargeSfx = null; }
        g.completeAnalysis(target);
      }
    } else {
      this.analyse.progress = Math.max(0, this.analyse.progress - dt * 2);
      if (this._chargeSfx) { this._chargeSfx.stop(false); this._chargeSfx = null; }
    }
  }

  toggleVisor(on) {
    const g = this.game;
    const v = on === undefined ? !this.visorOn : on;
    if (v === this.visorOn) return;
    this.visorOn = v;
    if (v) { g.audio.visorOn(); this.stopBeam(); } else g.audio.visorOff();
    g.ui.setVisor(v);
  }

  currentItem() {
    const inv = this.game.inventory;
    const idx = this.hotbar[this.selected];
    if (idx === null || idx === undefined) return null;
    return inv.slots[idx] ? Object.assign({ slot: idx }, inv.slots[idx]) : null;
  }

  update(dt) {
    if (this.dead) return;
    this.physics(dt);
    this.vitalsUpdate(dt);
    this.interactUpdate(dt);
  }

  serialize() {
    return {
      pos: [this.pos.x, this.pos.y, this.pos.z], yaw: this.yaw, pitch: this.pitch,
      health: this.health, shield: this.shield, life: this.life, hazard: this.hazard, jet: this.jet,
      tool: this.tool, hotbar: this.hotbar, selected: this.selected, wanted: this.wanted,
    };
  }
  load(d) {
    if (!d) return;
    this.pos.fromArray(d.pos || [0, 60, 0]);
    this.yaw = d.yaw || 0; this.pitch = d.pitch || 0;
    this.health = d.health ?? 100; this.shield = d.shield ?? 100;
    this.life = d.life ?? 100; this.hazard = d.hazard ?? 100; this.jet = d.jet ?? 100;
    if (d.tool) Object.assign(this.tool, d.tool);
    if (d.hotbar) this.hotbar = d.hotbar;
    this.selected = d.selected || 0;
    this.wanted = d.wanted || 0;
    this.dead = false;
  }
}
