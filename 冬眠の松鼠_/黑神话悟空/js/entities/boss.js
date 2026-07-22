import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { CONFIG } from '../config.js';
import { assets } from '../core/assets.js';
import { audio } from '../core/audio.js';
import { prepareCharacter, isolateMaterials, setTint, clearTint } from '../core/materials.js';
import { Animator } from './animator.js';
import { clamp, angleDamp, pick, rand } from '../core/utils.js';

const B = CONFIG.boss;

export class Boss {
  constructor(world, effects, combat) {
    this.world = world;
    this.effects = effects;
    this.combat = combat;

    this.hp = B.hp;
    this.maxHp = B.hp;
    this.phase = 1;
    this.state = 'dormant'; // dormant | awakening | idle | chase | windup | attack | slam | volley | summon | teleport | stunned | hurt | dying | dead
    this.stateTime = 0;
    this.attackCd = 2;
    this.stunTimer = 0;
    this.yaw = 0;
    this.attackDidHit = false;
    this.currentAttack = null;
    this.comboStep = 0;
    this.slamMarker = null;
    this.summonedCount = 0;
    this.moveSpeedMul = 1;
    this.lifted = false;

    this.group = new THREE.Group();
    this.buildModel();
    const { x, z } = CONFIG.arena;
    this.group.position.set(x, world.getHeight(x, z - 8), z - 8);
    this.group.rotation.y = Math.PI / 2;
  }

  buildModel() {
    const gltf = assets.char(B.model);
    this.model = SkeletonUtils.clone(gltf.scene);
    prepareCharacter(this.model);
    isolateMaterials(this.model);
    this.model.scale.setScalar(B.scale);

    const wep = assets.char(B.weapon);
    if (wep) {
      const w = wep.scene.clone(true);
      w.traverse((o) => { if (o.isMesh) { o.castShadow = true; if (o.material.map) o.material.map.colorSpace = THREE.SRGBColorSpace; } });
      let slot = null;
      this.model.traverse((o) => { if (o.name === 'handslot.r') slot = o; });
      if (slot) slot.add(w);
    }

    // ghost-fire eyes
    this.eyeMats = [];
    this.model.traverse((o) => {
      if (o.isMesh && /Eyes/.test(o.name)) {
        o.material = o.material.clone();
        o.material.emissive = new THREE.Color(0x66ddff);
        o.material.emissiveIntensity = 2.2;
        this.eyeMats.push(o.material);
      }
    });

    this.anim = new Animator(this.model, gltf.animations);
    this.anim.play('Skeleton_Inactive_Standing_Pose', { fade: 0 });
    this.group.add(this.model);

    this.auraLight = new THREE.PointLight(0x66ccee, 0, 14, 1.6);
    this.auraLight.position.y = 2.4;
    this.group.add(this.auraLight);
  }

  get position() { return this.group.position; }
  get alive() { return this.state !== 'dead' && this.state !== 'dying'; }
  get active() { return !['dormant', 'awakening', 'dead'].includes(this.state); }

  setState(s) { this.state = s; this.stateTime = 0; }

  awaken() {
    if (this.state !== 'dormant') return;
    this.setState('awakening');
    this.auraLight.intensity = 3.2;
    this.anim.play('Skeletons_Awaken_Standing', { once: true, fade: 0.2, speed: 0.9, onDone: () => {
      if (this.state !== 'awakening') return; // may have been executed mid-rise
      this.setState('idle');
      this.attackCd = 1.4;
    }});
    this.effects.shockwave(this.position.clone(), 0x88ddff, 12);
    audio.play('deathBell', { volume: 0.55, rate: 0.6 });
  }

  applyStun(duration) {
    if (!this.alive || this.state === 'dormant' || this.state === 'awakening') return;
    // boss resists: shorter freeze
    this.stunTimer = duration * 0.55;
    this.clearSlamMarker();
    this.setState('stunned');
    this.anim.freeze(true);
    setTint(this.model, 0xc9a227, 0.8);
  }

  clearStunFx() {
    this.anim.freeze(false);
    clearTint(this.model);
  }

  // gravity lift (地爆天星): even the lady of bones can be dragged skyward
  setLifted(v) {
    if (this.lifted === v) return;
    this.lifted = v;
    if (v) {
      this.stunTimer = 0;
      this.clearSlamMarker();
      clearTint(this.model);
      this.anim.freeze(true);
      setTint(this.model, 0x8a5cff, 0.7);
    } else {
      this.anim.freeze(false);
      clearTint(this.model);
      if (this.alive && this.state !== 'dormant') this.setState('chase');
    }
  }

  takeDamage(amount, fromPos, { heavy = false } = {}) {
    if (!this.alive || this.state === 'dormant') return 0;
    this.hp -= amount;
    this.combat.onBossDamaged(this);

    const hitPos = this.position.clone().add(new THREE.Vector3(rand(-0.5, 0.5), rand(1.4, 2.4), rand(-0.5, 0.5)));
    this.effects.hitSpark(hitPos, { heavy });
    this.effects.bloodBurst(hitPos, 0xbfd6de);
    audio.play(pick(heavy ? ['hitHeavy1', 'hitHeavy2'] : ['hitBone1', 'hitBone2', 'hitBone3']), { volume: 0.8, ratejitter: 0.1 });

    if (this.hp <= 0) {
      this.hp = 0;
      this.startDying();
      return amount;
    }

    if (this.phase === 1 && this.hp / this.maxHp <= B.phase2At) {
      this.enterPhase2();
    }

    // occasional stagger on heavy hits only
    if (heavy && !this.lifted && Math.random() < 0.35 && this.state !== 'stunned') {
      this.clearSlamMarker();
      this.setState('hurt');
      this.anim.play('Hit_A', { once: true, fade: 0.06, speed: 1.2, onDone: () => {
        if (this.state === 'hurt') this.setState('chase');
      }});
    }
    return amount;
  }

  enterPhase2() {
    this.phase = 2;
    this.moveSpeedMul = 1.3;
    for (const m of this.eyeMats) m.emissive = new THREE.Color(0xff4433);
    this.auraLight.color = new THREE.Color(0xff5533);
    this.auraLight.intensity = 4.2;
    this.effects.shockwave(this.position.clone(), 0xff6644, 14);
    this.combat.shake(0.55);
    audio.play('deathBell', { volume: 0.7, rate: 0.8 });
    this.combat.announce('白骨夫人怒了——骨焰焚天！');
    // brief roar pause
    this.clearSlamMarker();
    this.setState('windup');
    this.anim.play('Cheer', { once: true, fade: 0.15, speed: 1.1, onDone: () => {
      if (this.state === 'windup') this.setState('chase');
    }});
  }

  startDying() {
    this.clearStunFx();
    this.clearSlamMarker();
    this.setState('dying');
    this.auraLight.intensity = 6;
    this.anim.play('Death_C_Skeletons', { once: true, clamp: true, fade: 0.12, speed: 0.85, onDone: () => {
      this.setState('dead');
      this.combat.onBossDefeated(this);
    }});
    this.effects.shockwave(this.position.clone(), 0xffe9a0, 16);
    audio.play('deathBell', { volume: 1, rate: 0.55 });
  }

  // ------------------------------------------------------------------
  update(dt, player) {
    this.stateTime += dt;
    if (this.state === 'dead') return;
    if (this.lifted) return; // dragged by the gravity art, pose frozen

    if (this.state === 'stunned') {
      this.stunTimer -= dt;
      if (this.stunTimer <= 0) {
        this.clearStunFx();
        this.setState('chase');
      }
      return;
    }

    if (this.state === 'dying') {
      this.anim.update(dt);
      return;
    }

    const toPlayer = player.position.clone().sub(this.position).setY(0);
    const dist = toPlayer.length();
    this.attackCd -= dt;

    switch (this.state) {
      case 'dormant':
      case 'awakening':
        break;

      case 'idle':
        this.anim.ensure('2H_Melee_Idle', { fade: 0.3 });
        if (player.alive) this.setState('chase');
        break;

      case 'chase': {
        if (!player.alive) { this.setState('idle'); break; }
        this.faceToward(player.position, dt, 7);
        const speed = B.speed * this.moveSpeedMul;

        if (this.attackCd <= 0) {
          this.chooseAttack(dist, player);
        } else if (dist > 3.2) {
          this.move(toPlayer.normalize(), speed, dt);
          this.anim.ensure('Running_A', { fade: 0.22 });
        } else {
          const tangent = new THREE.Vector3(-toPlayer.z, 0, toPlayer.x).normalize();
          this.move(tangent, speed * 0.35, dt);
          this.anim.ensure('Walking_A', { fade: 0.25 });
        }
        break;
      }

      case 'attack':
        this.updateMeleeCombo(dt, player);
        break;

      case 'slam':
        this.updateSlam(dt, player);
        break;

      case 'volley':
        this.updateVolley(dt, player);
        break;

      case 'summon':
        break;

      case 'teleport':
        this.updateTeleport(dt, player);
        break;

      case 'windup':
      case 'hurt':
        break;
    }

    this.snapToGround();
    this.anim.update(dt);
  }

  chooseAttack(dist, player) {
    const roll = Math.random();
    if (this.phase === 2 && roll < 0.16 && dist > 5) {
      this.startTeleport(player);
    } else if (dist < 4.4) {
      if (roll < 0.32) this.startSlam(player);
      else this.startMeleeCombo(player);
    } else if (dist < 7 && roll < 0.4) {
      this.startSlam(player);
    } else if (this.summonedCount < B.attacks.summonMax && roll < 0.22 && this.phase === 1) {
      this.startSummon(player);
    } else {
      this.startVolley(player);
    }
  }

  // ---- melee combo ----
  startMeleeCombo(player) {
    this.comboStep = 0;
    this.setState('attack');
    this.attackCd = rand(1.4, 2.4) / this.moveSpeedMul;
    this.playComboStep(player);
  }

  playComboStep(player) {
    const anims = ['1H_Melee_Attack_Slice_Horizontal', '1H_Melee_Attack_Slice_Diagonal', '1H_Melee_Attack_Chop'];
    this.currentAttack = anims[this.comboStep % anims.length];
    this.attackDidHit = false;
    this.anim.play(this.currentAttack, { once: true, fade: 0.08, speed: 1.05 * this.moveSpeedMul, onDone: () => {
      if (this.state !== 'attack') return;
      this.comboStep++;
      const maxSteps = this.phase === 2 ? 3 : 2;
      const dist = player.position.distanceTo(this.position);
      if (this.comboStep < maxSteps && dist < 6) {
        this.stateTime = 0;
        this.playComboStep(player);
      } else {
        this.setState('chase');
      }
    }});
    audio.play(pick(['swing1', 'swing2']), { volume: 0.6, rate: 0.8 });
  }

  updateMeleeCombo(dt, player) {
    const dur = this.anim.duration(this.currentAttack) / (1.05 * this.moveSpeedMul);
    const k = clamp(this.stateTime / dur, 0, 1);
    if (k < 0.4) {
      this.faceToward(player.position, dt, 6);
      // step toward player
      const to = player.position.clone().sub(this.position).setY(0);
      if (to.length() > 2.4) this.move(to.normalize(), B.speed * 1.15, dt);
    }
    if (!this.attackDidHit && k >= 0.46) {
      this.attackDidHit = true;
      const A = B.attacks.combo;
      const d = player.position.clone().sub(this.position).setY(0);
      const dist = d.length();
      if (dist < A.range) {
        const facing = Math.atan2(d.x, d.z);
        let diff = Math.abs(facing - this.yaw) % (Math.PI * 2);
        if (diff > Math.PI) diff = Math.PI * 2 - diff;
        if (diff < A.arc / 2 + 0.3) {
          player.takeDamage(A.dmg, this.position);
        }
      }
    }
  }

  // ---- ground slam AoE ----
  startSlam(player) {
    this.setState('slam');
    this.attackCd = rand(2.2, 3.4) / this.moveSpeedMul;
    this.attackDidHit = false;
    const A = B.attacks.slam;
    const px = player.position.x, pz = player.position.z;
    this.slamTarget = { x: px, z: pz };
    const y = this.world.getHeight(px, pz);
    this.slamMarker = this.effects.groundRing(px, y, pz, A.radius, this.phase === 2 ? 0xff4422 : 0xffaa33);
    this.anim.play('2H_Melee_Attack_Slice', { once: true, fade: 0.1, speed: 0.62, onDone: () => {
      if (this.state === 'slam') this.setState('chase');
    }});
  }

  updateSlam(dt, player) {
    const A = B.attacks.slam;
    const k = clamp(this.stateTime / A.windup, 0, 1);
    if (this.slamMarker) this.slamMarker.setProgress(k);
    if (k < 0.5) this.faceToward(player.position, dt, 4);

    if (!this.attackDidHit && k >= 1) {
      this.attackDidHit = true;
      const y = this.world.getHeight(this.slamTarget.x, this.slamTarget.z);
      const center = new THREE.Vector3(this.slamTarget.x, y, this.slamTarget.z);
      this.effects.shockwave(center, this.phase === 2 ? 0xff6644 : 0xffcf9a, A.radius * 2.2);
      this.combat.shake(0.5);
      audio.play('hitHeavy1', { volume: 0.95, rate: 0.7 });
      const d = player.position.distanceTo(center);
      if (d < A.radius && player.iframes <= 0) {
        player.takeDamage(A.dmg, center);
      }
      this.clearSlamMarker();
      if (this.phase === 2) {
        // follow-up bone spikes ring
        setTimeout(() => {
          if (!this.alive) return;
          const y2 = this.world.getHeight(player.position.x, player.position.z);
          const c2 = player.position.clone(); c2.y = y2;
          const marker = this.effects.groundRing(c2.x, y2, c2.z, A.radius * 0.7, 0xff4422);
          const t0 = performance.now();
          const tick = () => {
            const kk = (performance.now() - t0) / 700;
            if (kk >= 1) {
              marker.dispose();
              this.effects.shockwave(c2, 0xff6644, A.radius * 1.4);
              audio.play('hitHeavy2', { volume: 0.8, rate: 0.8 });
              if (player.position.distanceTo(c2) < A.radius * 0.7) player.takeDamage(A.dmg * 0.7, c2);
              return;
            }
            marker.setProgress(kk);
            requestAnimationFrame(tick);
          };
          tick();
        }, 500);
      }
    }
  }

  clearSlamMarker() {
    if (this.slamMarker) { this.slamMarker.dispose(); this.slamMarker = null; }
  }

  // ---- projectile volley ----
  startVolley(player) {
    this.setState('volley');
    this.attackCd = rand(2.4, 3.6) / this.moveSpeedMul;
    this.volleyShots = this.phase === 2 ? B.attacks.volley2.count : B.attacks.volley.count;
    this.volleyTimer = 0.55;
    this.anim.play('Spellcast_Shoot', { once: true, fade: 0.12, speed: 0.8, onDone: () => {
      if (this.state === 'volley' && this.volleyShots <= 0) this.setState('chase');
    }});
  }

  updateVolley(dt, player) {
    this.faceToward(player.position, dt, 5);
    this.volleyTimer -= dt;
    if (this.volleyShots > 0 && this.volleyTimer <= 0) {
      this.volleyShots--;
      this.volleyTimer = this.phase === 2 ? 0.22 : 0.34;
      const cfgV = this.phase === 2 ? B.attacks.volley2 : B.attacks.volley;
      const from = this.position.clone().add(new THREE.Vector3(0, 2.6, 0));
      const spread = this.phase === 2 ? 1.3 : 0.6;
      const to = player.position.clone().add(new THREE.Vector3(rand(-spread, spread), 1.1, rand(-spread, spread)));
      this.combat.spawnProjectile(from, to, cfgV.speed, cfgV.dmg, this.phase === 2 ? 0xff6a4a : 0x77e0ff);
      audio.play('stun', { volume: 0.5, rate: 0.7, ratejitter: 0.1 });
    }
    if (this.volleyShots <= 0 && this.stateTime > 1.6) this.setState('chase');
  }

  // ---- summon minions ----
  startSummon(player) {
    this.setState('summon');
    this.attackCd = rand(3, 4);
    this.anim.play('Spellcast_Raise', { once: true, fade: 0.15, speed: 0.9, onDone: () => {
      if (this.state === 'summon') this.setState('chase');
    }});
    setTimeout(() => {
      if (!this.alive) return;
      this.summonedCount++;
      this.combat.requestSummon(this.position, 2);
      this.effects.shockwave(this.position.clone(), 0x88ddff, 8);
    }, 900);
  }

  // ---- teleport behind player ----
  startTeleport(player) {
    this.setState('teleport');
    this.attackCd = 0.4;
    this.teleportPhase = 0;
    this.effects.bloodBurst(this.position.clone().add(new THREE.Vector3(0, 1.5, 0)), 0x88ddff);
  }

  updateTeleport(dt, player) {
    if (this.teleportPhase === 0 && this.stateTime > 0.28) {
      this.teleportPhase = 1;
      const back = player.position.clone().sub(
        new THREE.Vector3(Math.sin(player.yaw), 0, Math.cos(player.yaw)).multiplyScalar(-3.2)
      );
      const solved = this.world.clampToArena(back.x, back.z, 2);
      this.group.position.set(solved.x, this.world.getHeight(solved.x, solved.z), solved.z);
      this.effects.bloodBurst(this.position.clone().add(new THREE.Vector3(0, 1.5, 0)), 0x88ddff);
      audio.play('roll', { volume: 0.6, rate: 0.6 });
    }
    if (this.teleportPhase === 1 && this.stateTime > 0.42) {
      this.startMeleeCombo(player);
    }
  }

  faceToward(target, dt, speed = 7) {
    const d = target.clone().sub(this.position);
    const targetYaw = Math.atan2(d.x, d.z);
    this.yaw = angleDamp(this.yaw, targetYaw, speed, dt);
    this.group.rotation.y = this.yaw;
  }

  move(dir, speed, dt) {
    const nx = this.position.x + dir.x * speed * dt;
    const nz = this.position.z + dir.z * speed * dt;
    const solved = this.world.clampToArena(nx, nz, 1.6);
    this.position.x = solved.x;
    this.position.z = solved.z;
  }

  snapToGround() {
    if (this.lifted) return;
    this.group.position.y = this.world.getHeight(this.position.x, this.position.z);
  }
}
