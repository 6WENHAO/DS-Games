import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { CONFIG } from '../config.js';
import { assets } from '../core/assets.js';
import { audio } from '../core/audio.js';
import { prepareCharacter } from '../core/materials.js';
import { Animator } from './animator.js';
import { clamp, angleDamp, pick, rand } from '../core/utils.js';

const CL = CONFIG.player.clone;

// 分身术幻影：追击最近的敌人挥棍，吸引仇恨，时限到或被打散即溶解。
export class PlayerClone {
  constructor(owner, world, effects, combat, spawnAngle) {
    this.owner = owner;
    this.world = world;
    this.effects = effects;
    this.combat = combat;

    this.hp = CL.hp;
    this.life = CL.duration;
    this.state = 'follow'; // follow | chase | attack | dissolve
    this.stateTime = 0;
    this.attackCd = rand(0.4, 1.0);
    this.attackDidHit = false;
    this.currentAttack = null;
    this.yaw = owner.yaw;
    this.dissolveTime = 0;

    this.group = new THREE.Group();
    this.buildModel();

    const px = owner.position.x + Math.sin(spawnAngle) * 1.6;
    const pz = owner.position.z + Math.cos(spawnAngle) * 1.6;
    this.group.position.set(px, world.getHeight(px, pz), pz);
    this.group.rotation.y = this.yaw;
    this.effects.soulWisp(this.group.position.clone().add(new THREE.Vector3(0, 1, 0)), 10);
  }

  buildModel() {
    const heroGltf = assets.char('hero');
    this.model = SkeletonUtils.clone(heroGltf.scene);
    prepareCharacter(this.model);

    const hide = ['1H_Axe', '2H_Axe', 'Mug', 'Barbarian_Round_Shield', '1H_Axe_Offhand', 'Barbarian_Hat'];
    this.model.traverse((o) => { if (hide.includes(o.name)) o.visible = false; });

    // ghostly golden look
    this.model.traverse((o) => {
      if (!o.isMesh && !o.isSkinnedMesh) return;
      o.castShadow = false;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      o.material = mats.map((m) => {
        const c = m.clone();
        c.transparent = true;
        c.opacity = 0.5;
        c.depthWrite = false;
        if (c.emissive) { c.emissive = new THREE.Color(0xc9962c); c.emissiveIntensity = 0.5; }
        return c;
      });
      if (!Array.isArray(mats)) o.material = o.material[0];
    });

    const mageGltf = assets.char('mage');
    let staffSrc = null;
    mageGltf.scene.traverse((o) => { if (o.name === '2H_Staff') staffSrc = o; });
    if (staffSrc) {
      const staff = staffSrc.clone(true);
      staff.traverse((o) => {
        if (o.isMesh) {
          o.material = o.material.clone();
          o.material.transparent = true;
          o.material.opacity = 0.55;
          o.material.depthWrite = false;
          o.material.color = new THREE.Color(0xd9a13c);
          o.material.emissive = new THREE.Color(0x8a5c10);
          o.material.emissiveIntensity = 0.7;
        }
      });
      let slot = null;
      this.model.traverse((o) => { if (o.name === 'handslot.r') slot = o; });
      if (slot) slot.add(staff);
    }

    this.anim = new Animator(this.model, heroGltf.animations);
    this.anim.play('Idle');
    this.group.add(this.model);
  }

  get position() { return this.group.position; }
  get alive() { return this.state !== 'dissolve'; }

  takeDamage(amount, fromPos) {
    if (!this.alive) return 0;
    this.hp -= amount;
    this.effects.hitSpark(this.position.clone().add(new THREE.Vector3(0, 1.2, 0)), { heavy: false, color: 0xffe08a });
    if (this.hp <= 0) this.startDissolve();
    return amount;
  }

  startDissolve() {
    if (this.state === 'dissolve') return;
    this.state = 'dissolve';
    this.dissolveTime = 0;
    this.effects.soulWisp(this.position.clone().add(new THREE.Vector3(0, 1, 0)), 12);
    audio.playAt('roll', this.position, this.combat.player.position, { volume: 0.6, rate: 0.7 });
  }

  nearestEnemy() {
    let best = null, bestD = 16;
    for (const t of this.combat.targets) {
      const d = t.position.distanceTo(this.position);
      if (d < bestD) { bestD = d; best = t; }
    }
    return { target: best, dist: bestD };
  }

  setState(s) { this.state = s; this.stateTime = 0; }

  // returns true when the clone should be removed from the scene
  update(dt) {
    this.stateTime += dt;

    if (this.state === 'dissolve') {
      this.dissolveTime += dt;
      const k = clamp(1 - this.dissolveTime / 0.6, 0, 1);
      this.model.traverse((o) => {
        if (!o.isMesh && !o.isSkinnedMesh) return;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => { m.opacity = 0.5 * k; });
      });
      this.group.position.y -= dt * 0.4;
      this.anim.update(dt);
      return this.dissolveTime > 0.65;
    }

    this.life -= dt;
    if (this.life <= 0) { this.startDissolve(); return false; }

    const { target, dist } = this.nearestEnemy();

    switch (this.state) {
      case 'follow': {
        if (target) { this.setState('chase'); break; }
        const toOwner = this.owner.position.clone().sub(this.position).setY(0);
        const d = toOwner.length();
        if (d > 2.6) {
          this.moveDir(toOwner.normalize(), CL.speed * 0.9, dt);
          this.anim.ensure('Running_A', { fade: 0.2 });
        } else {
          this.anim.ensure('Idle', { fade: 0.25 });
        }
        break;
      }

      case 'chase': {
        if (!target) { this.setState('follow'); break; }
        this.faceToward(target.position, dt);
        this.attackCd -= dt;
        if (dist < CL.attackRange && this.attackCd <= 0) {
          this.startAttack(target);
        } else if (dist >= CL.attackRange * 0.7) {
          this.moveDir(target.position.clone().sub(this.position).setY(0).normalize(), CL.speed, dt);
          this.anim.ensure('Running_A', { fade: 0.18 });
        } else {
          this.anim.ensure('Idle', { fade: 0.25 });
        }
        break;
      }

      case 'attack': {
        const dur = this.anim.duration(this.currentAttack) / 1.3;
        const k = clamp(this.stateTime / dur, 0, 1);
        if (target && k < 0.4) this.faceToward(target.position, dt, 6);
        if (!this.attackDidHit && k >= 0.45) {
          this.attackDidHit = true;
          this.combat.meleeSweep({
            source: this, origin: this.position, yaw: this.yaw,
            range: CL.attackRange + 0.3, arc: 1.7, dmg: CL.dmg, heavy: false,
          });
          audio.playAt('swing1', this.position, this.combat.player.position, { volume: 0.35, rate: 1.3, ratejitter: 0.1 });
        }
        break;
      }
    }

    this.group.position.y = this.world.getHeight(this.position.x, this.position.z);
    this.anim.update(dt);
    return false;
  }

  startAttack(target) {
    this.currentAttack = pick(['2H_Melee_Attack_Slice', '2H_Melee_Attack_Chop', '2H_Melee_Attack_Stab']);
    this.attackDidHit = false;
    this.attackCd = rand(1.1, 1.8);
    this.setState('attack');
    this.anim.play(this.currentAttack, { once: true, fade: 0.08, speed: 1.3, onDone: () => {
      if (this.state === 'attack') this.setState('chase');
    }});
  }

  faceToward(targetPos, dt, speed = 10) {
    const d = targetPos.clone().sub(this.position);
    this.yaw = angleDamp(this.yaw, Math.atan2(d.x, d.z), speed, dt);
    this.group.rotation.y = this.yaw;
  }

  moveDir(dir, speed, dt) {
    const nx = this.position.x + dir.x * speed * dt;
    const nz = this.position.z + dir.z * speed * dt;
    const solved = this.world.resolveCollision(nx, nz, 0.5);
    this.position.x = solved.x;
    this.position.z = solved.z;
  }
}
