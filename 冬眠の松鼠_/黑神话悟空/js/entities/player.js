import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { CONFIG } from '../config.js';
import { assets } from '../core/assets.js';
import { audio } from '../core/audio.js';
import { prepareCharacter, isolateMaterials, setTint, clearTint } from '../core/materials.js';
import { Animator } from './animator.js';
import { clamp, angleDamp, pick, rand } from '../core/utils.js';

const P = CONFIG.player;

export class Player {
  constructor(world, effects, combat) {
    this.world = world;
    this.effects = effects;
    this.combat = combat;

    this.hp = P.hp;
    this.maxHp = P.hp;
    this.stamina = P.stamina;
    this.focus = 0;
    this.gourds = P.gourdCharges;
    this.souls = 0;

    this.state = 'idle';       // idle | move | roll | attack | heavy | charge | hurt | drink | cast | dead
    this.stateTime = 0;
    this.comboIndex = 0;
    this.comboQueued = false;
    this.attackDidHit = false;
    this.attackData = null;
    this.chargeTime = 0;
    this.iframes = 0;
    this.hurtCd = 0;
    this.stunCd = 0;
    this.cloneCd = 0;
    this.guardCd = 0;
    this.guardTime = 0;
    this.guardFxTimer = 0;
    this.ultCd = 0;
    this.quakeCd = 0;
    this.holeCd = 0;
    this.rollDir = new THREE.Vector3();
    this.speedMul = 1;
    this.moveSpeed = 0;
    this.yaw = Math.PI;        // facing -z (toward the road)
    this.stepTimer = 0;
    this.deadTime = 0;

    this.group = new THREE.Group();
    this.buildModel();

    const { x, z } = CONFIG.shrine;
    this.group.position.set(x, world.getHeight(x, z - 3), z - 3);
    this.group.rotation.y = this.yaw;
  }

  buildModel() {
    const heroGltf = assets.char('hero');
    this.model = SkeletonUtils.clone(heroGltf.scene);
    prepareCharacter(this.model);
    isolateMaterials(this.model);

    // hide default barbarian gear, keep cape for silhouette
    const hide = ['1H_Axe', '2H_Axe', 'Mug', 'Barbarian_Round_Shield', '1H_Axe_Offhand', 'Barbarian_Hat'];
    this.model.traverse((o) => { if (hide.includes(o.name)) o.visible = false; });

    // attach golden staff (from mage pack) to right hand slot
    const mageGltf = assets.char('mage');
    let staffSrc = null;
    mageGltf.scene.traverse((o) => { if (o.name === '2H_Staff') staffSrc = o; });
    this.staff = null;
    if (staffSrc) {
      this.staff = staffSrc.clone(true);
      this.staff.visible = true;
      this.staff.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.material = o.material.clone();
          o.material.color = new THREE.Color(0xd9a13c);
          o.material.emissive = new THREE.Color(0x5a3c08);
          o.material.emissiveIntensity = 0.55;
          o.material.metalness = 0.75;
          o.material.roughness = 0.35;
        }
      });
      let slot = null;
      this.model.traverse((o) => { if (o.name === 'handslot.r') slot = o; });
      if (slot) slot.add(this.staff);
    }

    this.anim = new Animator(this.model, heroGltf.animations);
    this.anim.play('Idle');
    this.group.add(this.model);

    // staff tip glow for trails
    this.staffTip = new THREE.Object3D();
    this.staffTip.position.set(0, 1.15, 0);
    if (this.staff) this.staff.add(this.staffTip);
    this.trail = this.effects.attachTrail(() => {
      if (!this.staff) return null;
      const v = new THREE.Vector3();
      this.staffTip.getWorldPosition(v);
      return v;
    }, 0xffd873);
  }

  get position() { return this.group.position; }
  get alive() { return this.state !== 'dead'; }
  get busy() { return ['roll', 'attack', 'heavy', 'hurt', 'drink', 'cast', 'charge'].includes(this.state); }

  setState(s) {
    this.state = s;
    this.stateTime = 0;
  }

  // ------------------------------------------------------------------
  update(dt, input, camera, enemies) {
    this.stateTime += dt;
    this.iframes = Math.max(0, this.iframes - dt);
    this.hurtCd = Math.max(0, this.hurtCd - dt);
    this.stunCd = Math.max(0, this.stunCd - dt);
    this.cloneCd = Math.max(0, this.cloneCd - dt);
    this.guardCd = Math.max(0, this.guardCd - dt);
    this.ultCd = Math.max(0, this.ultCd - dt);
    this.quakeCd = Math.max(0, this.quakeCd - dt);
    this.holeCd = Math.max(0, this.holeCd - dt);
    this.updateGuard(dt);

    if (this.state === 'dead') {
      this.anim.update(dt);
      this.deadTime += dt;
      return;
    }

    // stamina regen (slower while sprinting/attacking)
    const regenMul = this.state === 'idle' || this.state === 'move' ? 1 : 0.35;
    this.stamina = clamp(this.stamina + P.staminaRegen * regenMul * dt, 0, P.stamina);

    switch (this.state) {
      case 'idle':
      case 'move': this.updateLocomotion(dt, input, camera); break;
      case 'roll': this.updateRoll(dt); break;
      case 'charge': this.updateCharge(dt, input, camera); break;
      case 'attack':
      case 'heavy': this.updateAttack(dt, enemies); break;
      case 'drink': this.updateDrink(dt); break;
      case 'cast':
      case 'hurt': break; // timed via anim callbacks
    }

    // shared action triggers
    if (!this.busy) {
      if (input.lmbPressed) this.startAttack(0, camera);
      else if (input.rmbDown && this.stamina > 10) this.startCharge();
      else if (input.wasPressed('Space')) this.startRoll(input, camera);
      else if (input.wasPressed('KeyR')) this.startDrink();
      else if (input.wasPressed('KeyE')) this.castStun(enemies);
      else if (input.wasPressed('KeyQ')) this.castClone();
    } else if (this.state === 'attack') {
      if (input.lmbPressed) this.comboQueued = true;
      if (input.wasPressed('Space') && this.stateTime > 0.32 && this.stamina >= P.rollCost) {
        this.startRoll(input, camera); // roll-cancel late attack
      }
    } else if (this.state === 'charge') {
      if (input.rmbReleased) this.releaseHeavy(camera);
      if (input.wasPressed('Space')) this.startRoll(input, camera);
    }

    // 金刚躯可在任意动作中瞬发（读招开霸体）
    if (input.wasPressed('KeyF')) this.castGuard();
    // 法天象地：奥义，任意动作中皆可引发
    if (input.wasPressed('KeyX')) this.castUlt();
    // 地爆天星：引力聚陨
    if (input.wasPressed('KeyV')) this.castQuake();
    // 异次元黑洞：吞噬秒杀
    if (input.wasPressed('KeyK')) this.castHole();

    this.anim.update(dt);
    this.snapToGround();
  }

  updateLocomotion(dt, input, camera) {
    const mv = input.moveVector();
    const sprinting = input.keys.has('ShiftLeft') && mv.active && this.stamina > 1;

    let speed = 0;
    if (mv.active) {
      const camYaw = camera.yaw;
      // view-forward azimuth is camYaw + PI; screen-right = forward x up
      const wx = mv.x * Math.cos(camYaw) - mv.z * Math.sin(camYaw);
      const wz = -mv.x * Math.sin(camYaw) - mv.z * Math.cos(camYaw);
      const targetYaw = Math.atan2(wx, wz);
      this.yaw = angleDamp(this.yaw, targetYaw, 14, dt);
      this.group.rotation.y = this.yaw;

      speed = sprinting ? P.sprintSpeed : P.runSpeed;
      if (sprinting) this.stamina = clamp(this.stamina - P.sprintCost * dt, 0, P.stamina);

      const nx = this.group.position.x + Math.sin(this.yaw) * speed * dt;
      const nz = this.group.position.z + Math.cos(this.yaw) * speed * dt;
      const solved = this.world.resolveCollision(nx, nz, 0.55);
      const finalPos = this.combat.bossActive ? this.world.clampToArena(solved.x, solved.z) : solved;
      this.group.position.x = finalPos.x;
      this.group.position.z = finalPos.z;

      this.setStateSoft('move');
      this.anim.ensure(sprinting ? 'Running_B' : 'Running_A', { fade: 0.16 });

      this.stepTimer -= dt * (sprinting ? 1.45 : 1);
      if (this.stepTimer <= 0) {
        this.stepTimer = 0.31;
        audio.play(pick(['step1', 'step2', 'step3', 'step4']), { volume: 0.35, ratejitter: 0.12 });
      }
    } else {
      this.setStateSoft('idle');
      this.anim.ensure('Idle', { fade: 0.22 });
    }
    this.moveSpeed = speed;
  }

  setStateSoft(s) {
    if (this.state !== s) { this.state = s; this.stateTime = 0; }
  }

  // ---- roll ----
  startRoll(input, camera) {
    if (this.stamina < P.rollCost) return;
    this.stamina -= P.rollCost;
    const mv = input.moveVector();
    let dirYaw;
    if (mv.active) {
      const camYaw = camera.yaw;
      const wx = mv.x * Math.cos(camYaw) - mv.z * Math.sin(camYaw);
      const wz = -mv.x * Math.sin(camYaw) - mv.z * Math.cos(camYaw);
      dirYaw = Math.atan2(wx, wz);
    } else {
      dirYaw = this.yaw + Math.PI; // backstep away
    }
    this.rollDir.set(Math.sin(dirYaw), 0, Math.cos(dirYaw));
    this.yaw = dirYaw;
    this.group.rotation.y = dirYaw;
    this.setState('roll');
    this.iframes = P.rollIFrameEnd - P.rollIFrameStart;
    this.anim.play('Dodge_Forward', { once: true, fade: 0.08, speed: 1.35 });
    audio.play('roll', { volume: 0.5, ratejitter: 0.1 });
    this.effects.dust(this.group.position.clone(), 5);
  }

  updateRoll(dt) {
    const k = this.stateTime / P.rollDuration;
    const speed = P.rollSpeed * (1 - k * 0.55);
    const nx = this.group.position.x + this.rollDir.x * speed * dt;
    const nz = this.group.position.z + this.rollDir.z * speed * dt;
    const solved = this.world.resolveCollision(nx, nz, 0.55);
    const finalPos = this.combat.bossActive ? this.world.clampToArena(solved.x, solved.z) : solved;
    this.group.position.x = finalPos.x;
    this.group.position.z = finalPos.z;
    if (this.stateTime >= P.rollDuration) {
      this.setState('idle');
      this.anim.play('Idle', { fade: 0.15 });
    }
  }

  // ---- light combo ----
  startAttack(index, camera) {
    const data = P.combo[index];
    if (!data) return;
    this.comboIndex = index;
    this.attackData = data;
    this.attackDidHit = false;
    this.comboQueued = false;
    this.setState('attack');

    // face lock-on target
    const target = this.combat.lockTarget;
    if (target && target.alive) {
      const d = target.position.clone().sub(this.group.position);
      this.yaw = Math.atan2(d.x, d.z);
      this.group.rotation.y = this.yaw;
    }

    this.anim.play(data.anim, {
      once: true, fade: 0.08, speed: data.speed,
      onDone: () => this.finishAttack(),
    });
    audio.play(pick(['swing1', 'swing2', 'swing3']), { volume: 0.55, rate: 1.25, ratejitter: 0.1 });
    this.trail.active = true;
  }

  finishAttack() {
    this.trail.active = false;
    if (this.state !== 'attack') return;
    if (this.comboQueued && this.comboIndex < P.combo.length - 1) {
      this.startAttack(this.comboIndex + 1);
    } else {
      this.setState('idle');
      this.anim.play('Idle', { fade: 0.18 });
    }
  }

  updateAttack(dt, enemies) {
    const data = this.attackData;
    if (!data) { this.setState('idle'); return; }
    const dur = this.anim.duration(data.anim) / data.speed;
    const k = clamp(this.stateTime / dur, 0, 1);

    // forward lunge in early phase
    if (k > 0.15 && k < 0.55) {
      const sp = data.lunge * dt / 0.4;
      const nx = this.group.position.x + Math.sin(this.yaw) * sp;
      const nz = this.group.position.z + Math.cos(this.yaw) * sp;
      const solved = this.world.resolveCollision(nx, nz, 0.55);
      const finalPos = this.combat.bossActive ? this.world.clampToArena(solved.x, solved.z) : solved;
      this.group.position.x = finalPos.x;
      this.group.position.z = finalPos.z;
    }

    if (!this.attackDidHit && k >= data.hitAt) {
      this.attackDidHit = true;
      const heavy = this.state === 'heavy';
      const bonus = heavy ? P.heavy.focusDmg * Math.floor(this.focus) : 0;
      if (heavy) this.focus = 0;
      const dmg = data.dmg + bonus + (heavy && this.chargeFull ? P.heavy.baseDmg * 0.5 : 0);
      const hits = this.combat.meleeSweep({
        source: this,
        origin: this.group.position,
        yaw: this.yaw,
        range: data.range,
        arc: data.arc,
        dmg,
        heavy,
      });
      if (hits > 0 && !heavy) {
        this.focus = clamp(this.focus + P.focusPerHit * hits, 0, P.focusMax);
      }
    }
  }

  // ---- heavy charge ----
  startCharge() {
    this.setState('charge');
    this.chargeTime = 0;
    this.chargeFull = false;
    this.anim.play('Spellcast_Long', { fade: 0.15, speed: 0.85 });
  }

  updateCharge(dt, input, camera) {
    this.chargeTime += dt;
    if (this.chargeTime >= P.heavy.maxCharge && !this.chargeFull) {
      this.chargeFull = true;
      this.effects.stunRing(this.group.position.clone().add(new THREE.Vector3(0, 0.8, 0)));
      audio.play('parry', { volume: 0.4, rate: 1.6 });
    }
    if (this.chargeTime > 0.25) {
      const target = this.combat.lockTarget;
      if (target && target.alive) {
        const d = target.position.clone().sub(this.group.position);
        this.yaw = angleDamp(this.yaw, Math.atan2(d.x, d.z), 10, dt);
        this.group.rotation.y = this.yaw;
      }
    }
  }

  releaseHeavy() {
    if (this.chargeTime < P.heavy.minCharge) {
      this.setState('idle');
      this.anim.play('Idle', { fade: 0.15 });
      return;
    }
    const H = P.heavy;
    this.attackData = { anim: H.anim, dmg: H.baseDmg, speed: H.speed, lunge: H.lunge, hitAt: H.hitAt, range: H.range, arc: H.arc };
    this.attackDidHit = false;
    this.setState('heavy');
    this.anim.play(H.anim, { once: true, fade: 0.08, speed: H.speed, onDone: () => {
      this.trail.active = false;
      this.setState('idle');
      this.anim.play('Idle', { fade: 0.18 });
    }});
    audio.play('swing2', { volume: 0.8, rate: 0.85 });
    this.trail.active = true;
    this.effects.dust(this.group.position.clone(), 8);
  }

  // ---- ultimate (法天象地) ----
  castUlt() {
    if (this.ultCd > 0 || !this.alive) return;
    this.ultCd = P.ult.cooldown;
    this.trail.active = false;
    this.setState('cast');
    this.anim.play('Spellcast_Raise', { once: true, fade: 0.08, speed: 1.0, onDone: () => {
      if (this.state === 'cast') { this.setState('idle'); this.anim.play('Idle', { fade: 0.2 }); }
    }});
    // gathering glow while raising the staff
    this.effects.stunRing(this.group.position.clone().add(new THREE.Vector3(0, 0.5, 0)));
    audio.play('deathBell', { volume: 0.5, rate: 1.5 });
    setTimeout(() => {
      if (this.alive) this.combat.annihilate(this.group.position.clone(), P.ult.radius);
    }, 550);
  }

  // ---- gravity art (地爆天星式引力聚陨) ----
  castQuake() {
    if (this.quakeCd > 0 || !this.alive) return;
    if (this.combat.earthBurial && this.combat.earthBurial.active) return;
    this.quakeCd = P.quake.cooldown;
    this.trail.active = false;
    this.setState('cast');
    this.anim.play('Spellcast_Long', { once: true, fade: 0.1, speed: 1.15, onDone: () => {
      if (this.state === 'cast') { this.setState('idle'); this.anim.play('Idle', { fade: 0.2 }); }
    }});
    const target = this.combat.lockTarget;
    const center = target && target.alive
      ? target.position.clone()
      : this.group.position.clone().add(
          new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw)).multiplyScalar(P.quake.castRange));
    this.effects.stunRing(this.group.position.clone().add(new THREE.Vector3(0, 0.4, 0)));
    setTimeout(() => {
      if (this.alive) this.combat.startQuake(center);
    }, 420);
  }

  // ---- void art (异次元黑洞) ----
  castHole() {
    if (this.holeCd > 0 || !this.alive) return;
    if (this.combat.blackHole && this.combat.blackHole.active) return;
    this.holeCd = P.hole.cooldown;
    this.trail.active = false;
    this.setState('cast');
    this.anim.play('Spellcast_Shoot', { once: true, fade: 0.1, speed: 1.0, onDone: () => {
      if (this.state === 'cast') { this.setState('idle'); this.anim.play('Idle', { fade: 0.2 }); }
    }});
    const target = this.combat.lockTarget;
    const center = target && target.alive
      ? target.position.clone()
      : this.group.position.clone().add(
          new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw)).multiplyScalar(P.hole.castRange));
    this.effects.stunRing(this.group.position.clone().add(new THREE.Vector3(0, 0.5, 0)));
    setTimeout(() => {
      if (this.alive) this.combat.startBlackHole(center);
    }, 380);
  }

  // ---- clone spell (分身术) ----
  castClone() {
    if (this.cloneCd > 0) return;
    this.cloneCd = P.clone.cooldown;
    this.setState('cast');
    this.anim.play('Spellcast_Raise', { once: true, fade: 0.1, speed: 1.5, onDone: () => {
      if (this.state === 'cast') { this.setState('idle'); this.anim.play('Idle', { fade: 0.18 }); }
    }});
    this.effects.soulWisp(this.group.position.clone().add(new THREE.Vector3(0, 1.2, 0)), 14);
    audio.play('stun', { volume: 0.7, rate: 1.2 });
    setTimeout(() => this.combat.requestClones(), 260);
  }

  // ---- iron body (金刚躯) ----
  castGuard() {
    if (this.guardCd > 0 || !this.alive) return;
    this.guardCd = P.guard.cooldown;
    this.guardTime = P.guard.duration;
    setTint(this.model, 0xd4af37, 0.55);
    this.effects.stunRing(this.group.position.clone().add(new THREE.Vector3(0, 0.9, 0)));
    audio.play('parry', { volume: 0.8, rate: 0.9 });
  }

  updateGuard(dt) {
    if (this.guardTime <= 0) return;
    this.guardTime -= dt;
    this.guardFxTimer -= dt;
    if (this.guardFxTimer <= 0) {
      this.guardFxTimer = 0.16;
      this.effects.spawnSprite({
        tex: this.effects.texSoft, color: 0xd4af37,
        pos: this.group.position.clone().add(new THREE.Vector3(rand(-0.5, 0.5), rand(0.2, 1.7), rand(-0.5, 0.5))),
        vel: new THREE.Vector3(0, rand(0.6, 1.4), 0), size: rand(0.1, 0.25), life: rand(0.3, 0.6),
      });
    }
    if (this.guardTime <= 0) clearTint(this.model);
  }

  // ---- gourd ----
  startDrink() {
    if (this.gourds <= 0 || this.hp >= this.maxHp) return;
    this.gourds--;
    this.setState('drink');
    this.anim.play('Use_Item', { once: true, fade: 0.15, speed: 1.1, onDone: () => {
      this.setState('idle');
      this.anim.play('Idle', { fade: 0.2 });
    }});
    audio.play('drink', { volume: 0.8 });
  }

  updateDrink(dt) {
    if (this.stateTime > 0.45 && !this._healed) {
      this._healed = true;
      this.hp = clamp(this.hp + P.gourdHeal, 0, this.maxHp);
      this.effects.healGlow(this.group.position.clone().add(new THREE.Vector3(0, 1, 0)));
      document.getElementById('flash-layer').className = 'heal';
      setTimeout(() => { document.getElementById('flash-layer').className = ''; }, 260);
    }
    if (this.state !== 'drink') this._healed = false;
  }

  // ---- immobilize spell (定身�? ----
  castStun(enemies) {
    if (this.stunCd > 0) return;
    let target = this.combat.lockTarget;
    if (!target || !target.alive) {
      let best = null, bestD = P.stun.range;
      for (const e of enemies) {
        if (!e.alive) continue;
        const d = e.position.distanceTo(this.group.position);
        if (d < bestD) { bestD = d; best = e; }
      }
      target = best;
    }
    if (!target) return;
    this.stunCd = P.stun.cooldown;
    this.setState('cast');
    const d = target.position.clone().sub(this.group.position);
    this.yaw = Math.atan2(d.x, d.z);
    this.group.rotation.y = this.yaw;
    this.anim.play('Spellcast_Shoot', { once: true, fade: 0.1, speed: 1.35, onDone: () => {
      this.setState('idle');
      this.anim.play('Idle', { fade: 0.18 });
    }});
    setTimeout(() => {
      if (target.alive) {
        target.applyStun(P.stun.duration);
        this.effects.stunRing(target.position.clone().add(new THREE.Vector3(0, 0.6, 0)));
        audio.play('stun', { volume: 0.8 });
      }
    }, 320);
  }

  // ---- damage intake ----
  takeDamage(amount, fromPos) {
    if (!this.alive || this.iframes > 0) return false;

    // 金刚躯：大幅减伤、免疫硬直与击退
    if (this.guardTime > 0) {
      const reduced = Math.max(1, Math.round(amount * (1 - P.guard.reduction)));
      this.hp -= reduced;
      this.combat.onPlayerHurt(reduced);
      this.effects.hitSpark(this.group.position.clone().add(new THREE.Vector3(0, 1.3, 0)), { heavy: false, color: 0xffe08a });
      audio.play('parry', { volume: 0.7, ratejitter: 0.1 });
      this.iframes = 0.25;
      if (this.hp <= 0) { this.hp = 0; this.die(); }
      return true;
    }

    this.hp -= amount;
    this.combat.onPlayerHurt(amount);
    this._healed = false;

    if (this.hp <= 0) {
      this.hp = 0;
      this.die();
      return true;
    }
    this.iframes = P.hurtIFrames;
    if (this.state !== 'attack' && this.state !== 'heavy' || this.hurtCd <= 0) {
      this.setState('hurt');
      this.hurtCd = 1.2;
      this.trail.active = false;
      this.anim.play(pick(['Hit_A', 'Hit_B']), { once: true, fade: 0.06, speed: 1.3, onDone: () => {
        if (this.state === 'hurt') { this.setState('idle'); this.anim.play('Idle', { fade: 0.15 }); }
      }});
    }
    audio.play('playerHurt', { volume: 0.75, ratejitter: 0.08 });
    if (fromPos) {
      const push = this.group.position.clone().sub(fromPos).setY(0).normalize().multiplyScalar(0.6);
      const solved = this.world.resolveCollision(this.group.position.x + push.x, this.group.position.z + push.z, 0.55);
      this.group.position.x = solved.x;
      this.group.position.z = solved.z;
    }
    return true;
  }

  die() {
    this.setState('dead');
    this.trail.active = false;
    this.anim.play(pick(['Death_A', 'Death_B']), { once: true, clamp: true, fade: 0.1 });
    audio.play('deathBell', { volume: 0.9 });
    this.combat.onPlayerDeath();
  }

  respawn() {
    const { x, z } = CONFIG.shrine;
    this.group.position.set(x, this.world.getHeight(x, z - 3), z - 3);
    this.yaw = Math.PI;
    this.group.rotation.y = this.yaw;
    this.hp = this.maxHp;
    this.stamina = P.stamina;
    this.gourds = P.gourdCharges;
    this.focus = 0;
    this.stunCd = 0;
    this.cloneCd = 0;
    this.guardCd = 0;
    this.guardTime = 0;
    this.ultCd = 0;
    this.quakeCd = 0;
    this.holeCd = 0;
    clearTint(this.model);
    this.iframes = 1.2;
    this.deadTime = 0;
    this.setState('idle');
    this.anim.play('Idle', { fade: 0.1 });
  }

  snapToGround() {
    const p = this.group.position;
    p.y = this.world.getHeight(p.x, p.z);
  }
}
