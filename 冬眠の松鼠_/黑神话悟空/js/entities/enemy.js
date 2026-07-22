import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { CONFIG } from '../config.js';
import { assets } from '../core/assets.js';
import { audio } from '../core/audio.js';
import { prepareCharacter, isolateMaterials, setTint, clearTint } from '../core/materials.js';
import { Animator } from './animator.js';
import { clamp, angleDamp, pick, rand } from '../core/utils.js';

let enemyId = 0;

export class Enemy {
  constructor(type, x, z, world, effects, combat, { buried = true } = {}) {
    this.id = enemyId++;
    this.cfg = CONFIG.enemies[type];
    this.type = type;
    this.world = world;
    this.effects = effects;
    this.combat = combat;

    this.hp = this.cfg.hp;
    this.maxHp = this.cfg.hp;
    this.state = buried ? 'buried' : 'idle'; // buried | rising | idle | chase | strafe | windup | attack | hurt | stunned | dead
    this.stateTime = 0;
    this.attackCd = rand(...this.cfg.attackCooldown);
    this.stunTimer = 0;
    this.yaw = rand(0, Math.PI * 2);
    this.attackDidHit = false;
    this.currentAttack = null;
    this.strafeDir = Math.random() < 0.5 ? 1 : -1;
    this.deadTimer = 0;
    this.spawnPos = { x, z };
    this.hurtCount = 0;
    this.lifted = false;

    this.group = new THREE.Group();
    this.buildModel();
    this.group.position.set(x, world.getHeight(x, z), z);
    this.group.rotation.y = this.yaw;
    if (buried) this.group.position.y -= 2.1;
  }

  buildModel() {
    const gltf = assets.char(this.cfg.model);
    this.model = SkeletonUtils.clone(gltf.scene);
    prepareCharacter(this.model);
    isolateMaterials(this.model);
    this.model.scale.setScalar(this.cfg.scale);

    if (this.cfg.weapon) {
      const wep = assets.char(this.cfg.weapon);
      if (wep) {
        const w = wep.scene.clone(true);
        w.traverse((o) => { if (o.isMesh) { o.castShadow = true; if (o.material.map) o.material.map.colorSpace = THREE.SRGBColorSpace; } });
        let slot = null;
        this.model.traverse((o) => { if (o.name === 'handslot.r') slot = o; });
        if (slot) slot.add(w);
      }
    }

    this.anim = new Animator(this.model, gltf.animations);
    if (this.state === 'buried') {
      this.anim.play('Skeletons_Inactive_Floor_Pose', { fade: 0 });
    } else {
      this.anim.play('Idle');
    }
    this.group.add(this.model);

    // health bar sprite
    this.hpCanvas = document.createElement('canvas');
    this.hpCanvas.width = 96; this.hpCanvas.height = 10;
    this.hpTex = new THREE.CanvasTexture(this.hpCanvas);
    this.hpSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.hpTex, transparent: true, depthWrite: false }));
    this.hpSprite.scale.set(1.35, 0.14, 1);
    this.hpSprite.position.y = 2.35 * this.cfg.scale;
    this.hpSprite.visible = false;
    this.group.add(this.hpSprite);
    this.drawHpBar();
  }

  drawHpBar() {
    const ctx = this.hpCanvas.getContext('2d');
    ctx.clearRect(0, 0, 96, 10);
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(0, 0, 96, 10);
    ctx.fillStyle = '#8f1d18';
    ctx.fillRect(1, 1, 94 * clamp(this.hp / this.maxHp, 0, 1), 8);
    ctx.strokeStyle = 'rgba(210,180,120,0.8)';
    ctx.strokeRect(0.5, 0.5, 95, 9);
    this.hpTex.needsUpdate = true;
  }

  get position() { return this.group.position; }
  get alive() { return this.state !== 'dead'; }

  setState(s) { this.state = s; this.stateTime = 0; }

  applyStun(duration) {
    if (!this.alive) return;
    this.stunTimer = duration;
    this.setState('stunned');
    this.anim.freeze(true);
    setTint(this.model, 0xc9a227, 0.9);
  }

  // gravity lift (地爆天星): frozen mid-air, position driven externally
  setLifted(v) {
    if (this.lifted === v) return;
    this.lifted = v;
    if (v) {
      this.stunTimer = 0;
      clearTint(this.model);
      if (this.alive) this.setState('lifted');
      this.anim.freeze(true);
      setTint(this.model, 0x8a5cff, 0.75);
    } else {
      this.anim.freeze(false);
      clearTint(this.model);
      if (this.alive) this.setState('chase');
    }
  }

  takeDamage(amount, fromPos, { heavy = false } = {}) {
    if (!this.alive) return 0;
    const wasStunned = this.state === 'stunned';
    this.hp -= amount;
    this.drawHpBar();
    this.hpSprite.visible = true;

    const hitPos = this.position.clone().add(new THREE.Vector3(0, 1.2 * this.cfg.scale, 0));
    this.effects.hitSpark(hitPos, { heavy });
    this.effects.bloodBurst(hitPos);
    audio.playAt(pick(heavy ? ['hitHeavy1', 'hitHeavy2'] : ['hitBone1', 'hitBone2', 'hitBone3']), this.position, this.combat.player.position, { volume: 1, ratejitter: 0.12 });

    if (this.hp <= 0) {
      this.die();
      return amount;
    }

    // while gravity-lifted: take damage but no stagger/knockback (position is external)
    if (this.lifted) return amount;

    // knockback
    if (fromPos) {
      const push = this.position.clone().sub(fromPos).setY(0).normalize().multiplyScalar(heavy ? 1.1 : 0.45);
      const solved = this.world.resolveCollision(this.position.x + push.x, this.position.z + push.z, 0.5);
      this.position.x = solved.x;
      this.position.z = solved.z;
    }

    if (wasStunned && !heavy) return amount; // light hits don't break the freeze

    // stagger (heavy always, light sometimes)
    this.hurtCount++;
    if (heavy || this.hurtCount % 2 === 1 || this.type === 'minion') {
      if (wasStunned) this.clearStun();
      this.setState('hurt');
      this.attackDidHit = false;
      this.anim.play(pick(['Hit_A', 'Hit_B']), { once: true, fade: 0.05, speed: 1.35, onDone: () => {
        if (this.state === 'hurt') this.setState('chase');
      }});
    }
    return amount;
  }

  clearStun() {
    this.stunTimer = 0;
    this.anim.freeze(false);
    clearTint(this.model);
  }

  die() {
    this.clearStun();
    const wasLifted = this.lifted;
    this.setState('dead');
    this.hpSprite.visible = false;
    this.deadTimer = 0;
    this.anim.freeze(false);
    this.anim.play(pick(['Death_A', 'Death_B']), { once: true, clamp: true, fade: 0.08 });
    if (wasLifted) this.anim.freeze(true); // corpse stays rigid while spinning in the sky
    audio.playAt('enemyDie', this.position, this.combat.player.position, { volume: 0.9 });
    this.effects.soulWisp(this.position.clone().add(new THREE.Vector3(0, 1, 0)));
    this.combat.onEnemyKilled(this);
  }

  // ------------------------------------------------------------------
  update(dt, player) {
    this.stateTime += dt;

    if (this.state === 'dead') {
      this.deadTimer += dt;
      if (this.deadTimer > 2.2 && !this.lifted) {
        this.group.position.y -= dt * 0.55; // sink into the ground
      }
      this.anim.update(dt);
      return this.deadTimer > 4.5 && !this.lifted; // signal removal (not while sky-borne)
    }

    if (this.lifted) return false; // position & pose driven by the gravity art

    if (this.state === 'stunned') {
      this.stunTimer -= dt;
      if (this.stunTimer <= 0) {
        this.clearStun();
        this.setState('chase');
      }
      return false;
    }

    const target = this.combat.pickTargetFor(this);
    const toPlayer = target.position.clone().sub(this.position).setY(0);
    const dist = toPlayer.length();
    this.attackCd -= dt;

    switch (this.state) {
      case 'buried':
        if (player.position.distanceTo(this.position) < this.cfg.aggroRange * 0.75 && player.alive) {
          this.setState('rising');
          this.group.position.y = this.world.getHeight(this.position.x, this.position.z);
          this.anim.play(pick(['Skeletons_Awaken_Floor', 'Skeletons_Awaken_Floor_Long']), { once: true, fade: 0.05, onDone: () => {
            if (this.state === 'rising') this.setState('chase');
          }});
          this.effects.dust(this.position.clone(), 10, 0x8a7c60);
          audio.playAt('hitBone1', this.position, player.position, { volume: 0.7, rate: 0.7 });
        }
        break;

      case 'rising':
        break;

      case 'idle':
        this.anim.ensure('Idle', { fade: 0.25 });
        if (dist < this.cfg.aggroRange && player.alive) this.setState('chase');
        break;

      case 'chase': {
        if (!target.alive || !player.alive) { this.setState('idle'); break; }
        this.faceToward(target.position, dt, 9);

        const wantRange = this.cfg.ranged ? this.cfg.keepDistance : this.cfg.attackRange * 0.82;
        if (this.cfg.ranged && dist < this.cfg.keepDistance * 0.6) {
          this.moveDir(toPlayer.normalize().negate(), this.cfg.speed * 0.8, dt);
          this.anim.ensure('Walking_Backwards', { fade: 0.2 });
        } else if (dist > wantRange) {
          this.moveDir(toPlayer.normalize(), this.cfg.speed, dt);
          this.anim.ensure(this.anim.has('Walking_D_Skeletons') && this.cfg.speed < 3 ? 'Walking_D_Skeletons' : 'Running_A', { fade: 0.2 });
        } else if (this.attackCd <= 0 && dist < (this.cfg.ranged ? this.cfg.attackRange : this.cfg.attackRange * 1.15)) {
          this.startAttack(target);
        } else {
          // circle around target
          const tangent = new THREE.Vector3(-toPlayer.z, 0, toPlayer.x).normalize().multiplyScalar(this.strafeDir);
          this.moveDir(tangent, this.cfg.speed * 0.4, dt);
          this.anim.ensure(this.strafeDir > 0 ? 'Running_Strafe_Right' : 'Running_Strafe_Left', { fade: 0.25 });
          if (Math.random() < dt * 0.4) this.strafeDir *= -1;
        }
        break;
      }

      case 'windup':
        this.faceToward(target.position, dt, 6);
        break;

      case 'attack':
        this.updateAttack(dt, target);
        break;

      case 'hurt':
        break;
    }

    this.snapToGround();
    this.anim.update(dt);
    return false;
  }

  faceToward(target, dt, speed = 8) {
    const d = target.clone().sub(this.position);
    const targetYaw = Math.atan2(d.x, d.z);
    this.yaw = angleDamp(this.yaw, targetYaw, speed, dt);
    this.group.rotation.y = this.yaw;
  }

  moveDir(dir, speed, dt) {
    const nx = this.position.x + dir.x * speed * dt;
    const nz = this.position.z + dir.z * speed * dt;
    const solved = this.world.resolveCollision(nx, nz, 0.5);
    // simple separation from other enemies
    for (const other of this.combat.enemies) {
      if (other === this || !other.alive) continue;
      const dx = solved.x - other.position.x;
      const dz = solved.z - other.position.z;
      const d = Math.hypot(dx, dz);
      if (d < 1.1 && d > 1e-4) {
        solved.x += (dx / d) * (1.1 - d) * 0.5;
        solved.z += (dz / d) * (1.1 - d) * 0.5;
      }
    }
    this.position.x = solved.x;
    this.position.z = solved.z;
  }

  startAttack(target) {
    this.currentAttack = pick(this.cfg.anims);
    this.attackDidHit = false;
    this.setState('attack');
    this.attackCd = rand(...this.cfg.attackCooldown);

    const speed = this.type === 'rogue' ? 1.25 : 1.0;
    this.anim.play(this.currentAttack, { once: true, fade: 0.08, speed, onDone: () => {
      if (this.state === 'attack') this.setState('chase');
    }});
    if (!this.cfg.ranged) {
      audio.playAt(pick(['swing1', 'swing2']), this.position, this.combat.player.position, { volume: 0.5, rate: 0.9, ratejitter: 0.1 });
    }
  }

  updateAttack(dt, target) {
    const dur = this.anim.duration(this.currentAttack) / (this.type === 'rogue' ? 1.25 : 1.0);
    const k = clamp(this.stateTime / dur, 0, 1);
    if (k < 0.35) this.faceToward(target.position, dt, 5);

    if (!this.attackDidHit && k >= (this.cfg.ranged ? 0.55 : 0.45)) {
      this.attackDidHit = true;
      if (this.cfg.ranged) {
        const from = this.position.clone().add(new THREE.Vector3(0, 1.5 * this.cfg.scale, 0));
        const to = target.position.clone().add(new THREE.Vector3(0, 1.1, 0));
        this.combat.spawnProjectile(from, to, this.cfg.projectileSpeed, this.cfg.dmg, 0x77e0ff);
        audio.playAt('stun', this.position, this.combat.player.position, { volume: 0.4, rate: 0.75 });
      } else {
        const d = target.position.clone().sub(this.position).setY(0);
        const dist = d.length();
        if (dist < this.cfg.attackRange + 0.35) {
          const facing = Math.atan2(d.x, d.z);
          let diff = Math.abs(facing - this.yaw) % (Math.PI * 2);
          if (diff > Math.PI) diff = Math.PI * 2 - diff;
          if (diff < 1.15) {
            target.takeDamage(this.cfg.dmg, this.position);
          }
        }
      }
    }
  }

  snapToGround() {
    if (this.state === 'buried' || this.lifted) return;
    this.group.position.y = this.world.getHeight(this.position.x, this.position.z);
  }
}
