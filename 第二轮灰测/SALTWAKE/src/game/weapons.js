/**
 * SALTWAKE — weapons.
 *
 * Six weapons, each with a distinct job and a distinct cost:
 *
 *   revolver     reliable, accurate, six rounds, always useful
 *   shotgun      two shells, or both at once; punishes you for missing
 *   harpoon      one shaft, huge damage, pins light enemies to the wall behind
 *   flamer       sustained cone, the answer to the parasite in a cultist's chest
 *   focus        fires through walls and takes sanity every time
 *   bonecannon   splash, but it has to wind up before it will speak
 *
 * The viewmodel is animated on the 12 fps stop-motion clock and recoil is
 * stepped, so firing reads as a held pose rather than a smooth curve.
 */
import * as THREE from 'three';
import { WEAPONS, AMMO, ANIM, PLAYER } from '../core/config.js';
import { createViewmodelMaterial } from '../gfx/materials.js';
import { buildViewmodel, stopMotion } from '../gfx/models.js';
import { raycastWorld } from '../world/collide.js';

const _dir = new THREE.Vector3();
const _origin = new THREE.Vector3();
const _tmp = new THREE.Vector3();

export class WeaponManager {
  /**
   * @param {object} ctx { player, world, enemies, fx, audio, hud, camera }
   */
  constructor(ctx) {
    this.ctx = ctx;
    this.defs = WEAPONS;
    this.owned = WEAPONS.map((_, i) => i === 0);
    this.index = 0;
    this.loaded = WEAPONS.map((w) => w.capacity);
    this.reserve = {};
    for (const key of Object.keys(AMMO)) this.reserve[key] = 0;

    this.cooldown = 0;
    this.reloadTimer = 0;
    this.reloadTotal = 0;
    this.chargeTimer = 0;
    this.firing = false;
    this.fireVisual = 0;
    this.muzzleTimer = 0;
    this.switchTimer = 0;
    this.pendingIndex = -1;
    this.flameLoop = null;
    this.burstShots = 0;

    /* --- viewmodel scene: its own camera so it never clips into a wall --- */
    this.material = createViewmodelMaterial();
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, 16 / 9, 0.01, 4);
    this.rigs = {};
    this.holder = new THREE.Group();
    this.scene.add(this.holder);
    for (const def of WEAPONS) {
      const rig = buildViewmodel(def.id, this.material);
      rig.group.visible = false;
      rig.group.position.set(...def.viewOffset);
      this.holder.add(rig.group);
      this.rigs[def.id] = rig;
    }
    this.rigs[WEAPONS[0].id].group.visible = true;
  }

  get def() { return this.defs[this.index]; }
  get ammoKind() { return this.def.ammo; }
  get loadedCount() { return this.loaded[this.index]; }
  get reserveCount() { return this.reserve[this.ammoKind] || 0; }
  get reloading() { return this.reloadTimer > 0; }

  giveWeapon(id) {
    const i = this.defs.findIndex((w) => w.id === id);
    if (i < 0 || this.owned[i]) return false;
    this.owned[i] = true;
    // A new weapon arrives loaded and with a little spare.
    this.loaded[i] = this.defs[i].capacity;
    this.giveAmmo(this.defs[i].ammo, AMMO[this.defs[i].ammo].pickup);
    this.select(i);
    return true;
  }

  giveAmmo(kind, amount) {
    const cap = AMMO[kind];
    if (!cap) return 0;
    const before = this.reserve[kind] || 0;
    this.reserve[kind] = Math.min(cap.max, before + amount);
    return this.reserve[kind] - before;
  }

  select(i) {
    if (i < 0 || i >= this.defs.length || !this.owned[i] || i === this.index) return;
    if (this.switchTimer > 0) return;
    this.pendingIndex = i;
    this.switchTimer = 0.18;
    this.cancelFlame();
    if (this.ctx.audio) this.ctx.audio.play('weaponSwitch');
  }

  cycle(delta) {
    for (let n = 1; n <= this.defs.length; n += 1) {
      const i = (this.index + delta * n + this.defs.length * 4) % this.defs.length;
      if (this.owned[i]) { this.select(i); return; }
    }
  }

  cancelFlame() {
    if (this.flameLoop) { this.flameLoop.stop(0.08); this.flameLoop = null; }
    this.firing = false;
  }

  /** Enough ammo in the magazine for one press? */
  canFire() {
    if (this.cooldown > 0 || this.reloadTimer > 0 || this.switchTimer > 0) return false;
    const def = this.def;
    if (def.id === 'flamer') return (this.reserve.oil || 0) > 0;
    return this.loaded[this.index] > 0;
  }

  reload() {
    const def = this.def;
    if (def.id === 'flamer') return;
    if (this.reloadTimer > 0) return;
    if (this.loaded[this.index] >= def.capacity) return;
    if ((this.reserve[def.ammo] || 0) <= 0) return;
    this.reloadTotal = def.reloadTime || 1.2;
    this.reloadTimer = this.reloadTotal;
    if (this.ctx.audio && def.reloadSound) this.ctx.audio.play(def.reloadSound);
  }

  finishReload() {
    const def = this.def;
    const want = def.capacity - this.loaded[this.index];
    const have = this.reserve[def.ammo] || 0;
    const take = Math.min(want, have);
    this.loaded[this.index] += take;
    this.reserve[def.ammo] = have - take;
  }

  /* ------------------------------------------------------------ firing */

  /**
   * @param {boolean} down primary held
   * @param {boolean} alt secondary held (both barrels)
   */
  tryFire(down, alt) {
    const def = this.def;
    if (def.id === 'flamer') {
      if (down && (this.reserve.oil || 0) > 0 && this.reloadTimer <= 0 && this.switchTimer <= 0) {
        if (!this.firing) {
          this.firing = true;
          if (this.ctx.audio) {
            this.ctx.audio.play('flamethrowerIgnite');
            this.flameLoop = this.ctx.audio.loop('flamethrower', { volume: 0.8 });
          }
        }
      } else if (this.firing) {
        this.cancelFlame();
      }
      return;
    }

    if (!down) { this.wasDown = false; return; }
    // Everything except the flamer is a discrete press.
    if (this.wasDown && def.id !== 'bonecannon') return;
    this.wasDown = true;

    if (!this.canFire()) {
      if (this.loaded[this.index] <= 0 && this.cooldown <= 0 && this.reloadTimer <= 0) {
        if (this.ctx.audio && def.emptySound) this.ctx.audio.play(def.emptySound);
        this.reload();
      }
      return;
    }

    if (def.chargeTime || def.windupTime) {
      // The focus and the cannon both hold before they release.
      const need = def.chargeTime || def.windupTime;
      if (this.chargeTimer < need) {
        if (this.chargeTimer === 0 && this.ctx.audio) {
          const s = def.chargeSound || def.windSound;
          if (s) this.ctx.audio.play(s);
        }
        return;
      }
    }
    this.discharge(alt);
  }

  discharge(alt) {
    const def = this.def;
    const { player, audio, fx } = this.ctx;
    const both = alt && def.altPellets && this.loaded[this.index] >= 2;

    player.aimDirection(_dir);
    _origin.set(player.pos.x, player.eyePosition, player.pos.z);

    if (def.id === 'flamer') {
      // handled in update(): continuous
    } else if (def.projectile) {
      const speed = def.projectileSpeed;
      fx.spawnProjectile({
        kind: def.projectile,
        x: _origin.x, y: _origin.y, z: _origin.z,
        vx: _dir.x * speed, vy: _dir.y * speed, vz: _dir.z * speed,
        damage: def.damage,
        splashDamage: def.splashDamage || 0,
        splashRadius: def.splashRadius || 0,
        piercing: !!def.piercing,
        pinDamage: def.pinDamage || 0,
        owner: 'player',
      });
    } else {
      const pellets = both ? def.altPellets : (def.pellets || 1);
      const spread = both ? def.altSpread : def.spread;
      const damage = both ? def.altDamage : def.damage;
      for (let i = 0; i < pellets; i += 1) {
        this.hitscan(_origin, _dir, spread, damage, def.range, i);
      }
    }

    const used = both ? 2 : 1;
    this.loaded[this.index] -= used;
    this.cooldown = def.fireDelay;
    this.chargeTimer = 0;
    this.fireVisual = 1;
    this.muzzleTimer = def.light ? def.light.time : 0.05;

    player.addKick((Math.random() - 0.5) * 0.006, def.kick * 0.012 * (both ? 1.7 : 1));
    if (audio && def.sound) audio.play(def.sound, { volume: both ? 1 : 0.9 });
    if (def.id === 'shotgun') audio && audio.play('shellDrop', { volume: 0.3 });

    if (def.sanityCost) {
      player.drainSanity(def.sanityCost);
      if (audio) audio.play('sanityWhisper', { volume: 0.5 });
    }
    if (this.loaded[this.index] <= 0) this.reload();
  }

  /** One hitscan pellet against enemies first, then the world. */
  hitscan(origin, dir, spread, damage, range, seed) {
    const { world, enemies, fx } = this.ctx;
    // Deterministic-ish cone: a square distribution reads more like the era than
    // a perfect disc, and the pellet pattern stays recognisable.
    const sx = (Math.random() - 0.5) * spread * 2;
    const sy = (Math.random() - 0.5) * spread * 2;
    _tmp.copy(dir);
    _tmp.x += sx; _tmp.y += sy;
    _tmp.normalize();

    const hit = enemies.raycast(origin, _tmp, range);
    const wall = raycastWorld(world.grid, origin.x, origin.y, origin.z, _tmp.x, _tmp.y, _tmp.z, range);
    const wallDist = wall ? wall.dist : Infinity;

    if (hit && hit.dist < wallDist) {
      enemies.damage(hit.enemy, damage, 'bullet', hit.point, _tmp);
      fx.spawnImpact(hit.point.x, hit.point.y, hit.point.z, 'flesh', _tmp);
      return;
    }
    if (wall) {
      fx.spawnImpact(wall.x, wall.y, wall.z, 'stone', _tmp, wall);
    }
  }

  /** The flamer applies damage in a cone every frame it is held. */
  updateFlame(dt) {
    const def = this.defs.find((w) => w.id === 'flamer');
    const { player, enemies, fx, audio } = this.ctx;
    const cost = def.ammoPerSecond * dt;
    if ((this.reserve.oil || 0) < cost) { this.cancelFlame(); return; }
    this.reserve.oil -= cost;

    player.aimDirection(_dir);
    _origin.set(player.pos.x, player.eyePosition, player.pos.z);
    fx.spawnFlame(_origin, _dir, def.range);

    const hits = enemies.coneQuery(_origin, _dir, def.range, def.coneAngle);
    for (const e of hits) {
      enemies.damage(e, def.damagePerSecond * dt, 'flame', null, _dir);
      enemies.ignite(e, def.burnTime, def.burnDamage);
    }
    this.fireVisual = 1;
    this.muzzleTimer = 0.08;
    if (this.flameLoop) this.flameLoop.setPosition(_origin);
  }

  /* ------------------------------------------------------------ frame */

  update(dt, input, time) {
    const def = this.def;

    if (this.switchTimer > 0) {
      this.switchTimer -= dt;
      if (this.switchTimer <= 0 && this.pendingIndex >= 0) {
        this.rigs[this.def.id].group.visible = false;
        this.index = this.pendingIndex;
        this.pendingIndex = -1;
        this.rigs[this.def.id].group.visible = true;
        this.chargeTimer = 0;
      }
    }

    if (this.cooldown > 0) this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.reloadTimer > 0) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) { this.finishReload(); this.reloadTimer = 0; }
    }

    // Charge builds only while the trigger is held and there is ammo to spend.
    const wantCharge = input.fire && this.loaded[this.index] > 0 && this.cooldown <= 0 && this.reloadTimer <= 0;
    if ((def.chargeTime || def.windupTime) && wantCharge) {
      this.chargeTimer = Math.min(def.chargeTime || def.windupTime, this.chargeTimer + dt);
    } else if (!input.fire) {
      this.chargeTimer = Math.max(0, this.chargeTimer - dt * 2.5);
    }

    this.tryFire(input.fire, input.altFire);
    if (this.firing && def.id === 'flamer') this.updateFlame(dt);

    if (this.muzzleTimer > 0) this.muzzleTimer = Math.max(0, this.muzzleTimer - dt);
    // Recoil decays on the stop-motion clock, so it steps down.
    const { frame } = stopMotion(time, ANIM.viewmodelFps);
    if (frame !== this._lastFrame) {
      this._lastFrame = frame;
      this.fireVisual = Math.max(0, this.fireVisual - 0.34);
    }

    this.updateViewmodel(dt, time);
    this.submitLight();
  }

  updateViewmodel(dt, time) {
    const { player } = this.ctx;
    const def = this.def;
    const rig = this.rigs[def.id];
    const need = def.chargeTime || def.windupTime || 1;
    const charge = (def.chargeTime || def.windupTime) ? this.chargeTimer / need : 0;
    const reloadProgress = this.reloadTotal > 0 && this.reloadTimer > 0
      ? 1 - this.reloadTimer / this.reloadTotal : 0;
    rig.animate(this.fireVisual, reloadProgress, time, charge);

    // Sway and lag: the weapon trails the view, quantised so it snaps.
    const { t } = stopMotion(time, ANIM.viewmodelFps);
    const speed = Math.hypot(player.vel.x, player.vel.z);
    const bob = Math.sin(t * 7.5) * 0.010 * Math.min(1, speed / PLAYER.runSpeed);
    const bobY = Math.abs(Math.cos(t * 7.5)) * 0.008 * Math.min(1, speed / PLAYER.runSpeed);
    this.holder.position.set(
      -player.viewKick.x * 0.6 + bob,
      -player.viewKick.y * 0.35 - bobY + (player.onGround ? 0 : -0.02),
      0,
    );
    this.holder.rotation.z = player.districtRoll * 0.5;
    // Switching drops the weapon out of frame and brings the next one up.
    const drop = this.switchTimer > 0 ? Math.sin((1 - this.switchTimer / 0.18) * Math.PI) : 0;
    this.holder.position.y -= drop * 0.30;
  }

  /** The muzzle flash is a real dynamic light, which is how the era did it. */
  submitLight() {
    const def = this.def;
    if (!def.light || this.muzzleTimer <= 0) return;
    const { player, lights } = this.ctx;
    if (!lights) return;
    const k = this.muzzleTimer / Math.max(def.light.time, 1e-3);
    player.aimDirection(_dir);
    _tmp.set(
      player.pos.x + _dir.x * 0.8,
      player.eyePosition + _dir.y * 0.8,
      player.pos.z + _dir.z * 0.8,
    );
    lights.add(_tmp, def.light.radius, def.light.color, def.light.intensity * k);
    this.material.uniforms.uMuzzle.value = k;
    this.material.uniforms.uMuzzleColor.value.set(def.light.color);
  }

  /** State for the HUD. */
  hudState() {
    const def = this.def;
    return {
      kind: def.ammo,
      loaded: Math.floor(this.loaded[this.index]),
      reserve: Math.floor(this.reserve[def.ammo] || 0),
      capacity: def.capacity,
      owned: this.owned.slice(),
      index: this.index,
      names: this.defs.map((w) => w.name),
    };
  }
}
