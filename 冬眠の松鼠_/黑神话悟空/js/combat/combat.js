import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { clamp, rand } from '../core/utils.js';
import { audio } from '../core/audio.js';
import { EarthBurial } from './earthburial.js';
import { BlackHole } from './blackhole.js';

// Central combat coordinator: hit sweeps, projectiles, lock-on, camera shake, events to UI.
export class Combat {
  constructor(scene, world, effects) {
    this.scene = scene;
    this.world = world;
    this.effects = effects;
    this.player = null;
    this.enemies = [];
    this.boss = null;
    this.clones = [];
    this.lockTarget = null;
    this.projectiles = [];
    this.trauma = 0;
    this.hitstop = 0;
    this.bossActive = false;
    this.listeners = {};
    this.earthBurial = new EarthBurial(scene, world, effects);
    this.earthBurial.combat = this;
    this.blackHole = new BlackHole(scene, world, effects);
    this.blackHole.combat = this;
  }

  startQuake(center) {
    return this.earthBurial.cast(center);
  }

  startBlackHole(center) {
    return this.blackHole.cast(center);
  }

  on(event, fn) { (this.listeners[event] ??= []).push(fn); }
  emit(event, ...args) { (this.listeners[event] || []).forEach((fn) => fn(...args)); }

  get targets() {
    const t = this.enemies.filter((e) => e.alive);
    if (this.boss && this.boss.active && this.boss.alive) t.push(this.boss);
    return t;
  }

  // ---- player melee sweep ----
  meleeSweep({ source, origin, yaw, range, arc, dmg, heavy }) {
    let hits = 0;
    for (const t of this.targets) {
      const d = t.position.clone().sub(origin).setY(0);
      const dist = d.length();
      const reach = range + (t === this.boss ? 1.3 : 0.35);
      if (dist > reach) continue;
      const ang = Math.atan2(d.x, d.z);
      let diff = Math.abs(ang - yaw) % (Math.PI * 2);
      if (diff > Math.PI) diff = Math.PI * 2 - diff;
      if (diff > arc / 2 && dist > 1.0) continue;

      const variance = rand(0.9, 1.12);
      const final = Math.round(dmg * variance);
      const crit = Math.random() < 0.08;
      const dealt = t.takeDamage(crit ? final * 1.6 : final, origin, { heavy });
      if (dealt > 0) {
        hits++;
        this.emit('damageNumber', t.position.clone().add(new THREE.Vector3(0, 2.1, 0)), Math.round(crit ? final * 1.6 : final), crit || heavy);
        this.hitstop = Math.max(this.hitstop, heavy ? 0.09 : 0.045);
        this.shake(heavy ? 0.42 : 0.18);
      }
    }
    return hits;
  }

  // enemies prefer nearby clones over the player (幻身嘲讽)
  pickTargetFor(enemy) {
    let best = this.player;
    let bestD = enemy.position.distanceTo(this.player.position);
    for (const c of this.clones) {
      if (!c.alive) continue;
      const d = enemy.position.distanceTo(c.position);
      if (d < bestD * 1.35) { best = c; bestD = d; }
    }
    return best;
  }

  requestClones() { this.emit('clones'); }

  // ---- ultimate: annihilate everything in range (法天象地) ----
  annihilate(origin, radius) {
    const victims = this.enemies.filter((e) =>
      e.alive && e.position.distanceTo(origin) <= radius + 0.6);
    // the boss can be executed too, even mid-awakening (but not while dormant)
    if (this.boss && this.boss.alive && this.boss.state !== 'dormant' &&
        this.boss.position.distanceTo(origin) <= radius + 2.5) {
      victims.push(this.boss);
    }

    // spectacle: triple golden shockwave + screen flash + long hitstop
    const base = origin.clone().add(new THREE.Vector3(0, 0.25, 0));
    this.effects.shockwave(base, 0xffe9a0, radius * 1.6);
    setTimeout(() => this.effects.shockwave(base, 0xffd873, radius * 2.4), 120);
    setTimeout(() => this.effects.shockwave(base, 0xffb340, radius * 3.2), 260);
    this.effects.stunRing(origin.clone().add(new THREE.Vector3(0, 1.2, 0)));
    this.shake(1);
    this.hitstop = Math.max(this.hitstop, 0.24);
    const fl = document.getElementById('flash-layer');
    fl.className = 'ult';
    setTimeout(() => { fl.className = ''; }, 500);
    audio.play('hitHeavy1', { volume: 1, rate: 0.55 });
    audio.play('deathBell', { volume: 0.9, rate: 0.8, delay: 0.05 });

    for (const t of victims) {
      this.effects.soulWisp(t.position.clone().add(new THREE.Vector3(0, 1.2, 0)), 12);
      this.emit('damageNumber', t.position.clone().add(new THREE.Vector3(0, 2.3, 0)), '斩', true);
      t.takeDamage(999999, origin, { heavy: true });
    }
    if (victims.length > 0) {
      this.emit('announce', `法天象地——${victims.length} 妖伏诛！`);
    }
    return victims.length;
  }

  // ---- enemy projectiles ----
  spawnProjectile(from, to, speed, dmg, color = 0x77e0ff) {
    const dir = to.clone().sub(from).normalize();
    const group = new THREE.Group();
    const core = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.effects.texSoft, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    core.scale.setScalar(0.85);
    group.add(core);
    const light = new THREE.PointLight(color, 1.6, 7, 2);
    group.add(light);
    group.position.copy(from);
    this.scene.add(group);
    this.projectiles.push({ group, dir, speed, dmg, life: 4, color });
  }

  updateProjectiles(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      p.group.position.addScaledVector(p.dir, p.speed * dt);
      // trail
      if (Math.random() < 0.7) {
        this.effects.spawnSprite({
          tex: this.effects.texSoft, color: p.color, pos: p.group.position.clone(),
          size: rand(0.2, 0.45), life: 0.28, grow: -0.6,
        });
      }
      const groundY = this.world.getHeight(p.group.position.x, p.group.position.z);
      const hitGround = p.group.position.y <= groundY + 0.15;
      let hitTarget = false;
      if (this.player && this.player.alive) {
        const d = p.group.position.distanceTo(this.player.position.clone().add(new THREE.Vector3(0, 1.1, 0)));
        if (d < 0.85) {
          hitTarget = true;
          this.player.takeDamage(p.dmg, p.group.position);
        }
      }
      if (!hitTarget) {
        for (const c of this.clones) {
          if (!c.alive) continue;
          const d = p.group.position.distanceTo(c.position.clone().add(new THREE.Vector3(0, 1.1, 0)));
          if (d < 0.85) { hitTarget = true; c.takeDamage(p.dmg, p.group.position); break; }
        }
      }
      if (p.life <= 0 || hitGround || hitTarget) {
        this.effects.hitSpark(p.group.position.clone(), { heavy: false, color: p.color });
        this.scene.remove(p.group);
        this.projectiles.splice(i, 1);
      }
    }
  }

  // ---- lock-on ----
  toggleLock(camera) {
    if (this.lockTarget && this.lockTarget.alive) {
      this.lockTarget = null;
      audio.play('uiBack', { volume: 0.4 });
      return;
    }
    const camDir = new THREE.Vector3();
    camera.camera.getWorldDirection(camDir);
    let best = null, bestScore = Infinity;
    for (const t of this.targets) {
      const to = t.position.clone().sub(this.player.position);
      const dist = to.length();
      if (dist > 28) continue;
      to.normalize();
      const angleCost = 1 - to.dot(camDir);
      const score = dist * 0.35 + angleCost * 18;
      if (score < bestScore) { bestScore = score; best = t; }
    }
    this.lockTarget = best;
    if (best) audio.play('uiClick', { volume: 0.5 });
  }

  validateLock() {
    if (this.lockTarget && (!this.lockTarget.alive || this.lockTarget.position.distanceTo(this.player.position) > 34)) {
      this.lockTarget = null;
    }
  }

  // ---- feedback ----
  shake(amount) { this.trauma = clamp(this.trauma + amount, 0, 1); }

  onPlayerHurt(amount) {
    this.shake(0.36);
    this.emit('playerHurt', amount);
    const fl = document.getElementById('flash-layer');
    fl.className = 'hurt';
    setTimeout(() => { fl.className = ''; }, 220);
  }

  onPlayerDeath() { this.emit('playerDeath'); }

  onEnemyKilled(enemy) {
    if (this.player) this.player.souls += enemy.cfg ? enemy.cfg.soul : 0;
    this.emit('enemyKilled', enemy);
  }

  onBossDamaged(boss) { this.emit('bossDamaged', boss); }

  onBossDefeated(boss) {
    if (this.player) this.player.souls += CONFIG.boss.soul;
    this.bossActive = false;
    this.emit('bossDefeated', boss);
  }

  requestSummon(pos, count) { this.emit('summon', pos, count); }
  announce(text) { this.emit('announce', text); }

  update(dt) {
    this.hitstop = Math.max(0, this.hitstop - dt);
    this.trauma = Math.max(0, this.trauma - dt * 1.6);
    this.updateProjectiles(dt);
    this.earthBurial.update(dt);
    this.blackHole.update(dt);
    this.validateLock();
  }
}
