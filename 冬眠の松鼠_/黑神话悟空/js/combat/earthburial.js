import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { assets } from '../core/assets.js';
import { audio } from '../core/audio.js';
import { rand, clamp, pick, lerp } from '../core/utils.js';

const Q = CONFIG.player.quake;

// 「地爆天星」式引力聚陨：黑紫引力核心升空，将范围内敌人与大地碎石
// 一并吸上高空聚成巨岩球，最后轰然坠地爆发。全程序化实现。
export class EarthBurial {
  constructor(scene, world, effects, combat) {
    this.scene = scene;
    this.world = world;
    this.effects = effects;
    this.combat = combat;
    this.active = false;
    this.group = null;
  }

  cast(center) {
    if (this.active) return false;
    this.active = true;
    this.time = 0;
    this.tickTimer = 0;
    this.exploded = false;

    const gy = this.world.getHeight(center.x, center.z);
    this.center = new THREE.Vector3(center.x, gy, center.z);
    this.coreY = gy;

    this.group = new THREE.Group();
    this.scene.add(this.group);

    // ---- gravity core ----
    this.core = new THREE.Group();
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x14001f, emissive: 0x7a2bff, emissiveIntensity: 2.4, roughness: 0.35, metalness: 0.2,
    });
    this.coreMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.62, 1), coreMat);
    this.core.add(this.coreMesh);
    this.coreGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.effects.texSoft, color: 0xa055ff, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.95,
    }));
    this.coreGlow.scale.setScalar(4.2);
    this.core.add(this.coreGlow);
    this.coreLight = new THREE.PointLight(0x9040ff, 5, 34, 1.6);
    this.core.add(this.coreLight);
    this.core.position.copy(this.center);
    this.group.add(this.core);

    // ---- purple gravity pillar ----
    const pillarGeo = new THREE.CylinderGeometry(0.7, 2.6, Q.height, 18, 1, true);
    this.pillarMat = new THREE.MeshBasicMaterial({
      color: 0x8a4bff, transparent: true, opacity: 0, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this.pillar = new THREE.Mesh(pillarGeo, this.pillarMat);
    this.pillar.position.set(this.center.x, gy + Q.height / 2, this.center.z);
    this.group.add(this.pillar);

    // ---- ground indicator ring ----
    this.ring = this.effects.groundRing(this.center.x, gy, this.center.z, Q.radius, 0x8a5cff);

    // ---- victims: enemies + boss get lifted ----
    this.victims = [];
    for (const e of this.combat.enemies) {
      if (!e.alive || e.state === 'buried') continue;
      if (e.position.distanceTo(this.center) > Q.radius) continue;
      this.addVictim(e);
    }
    const boss = this.combat.boss;
    if (boss && boss.alive && boss.state !== 'dormant' &&
        boss.position.distanceTo(this.center) <= Q.radius + 2.5) {
      this.addVictim(boss, true);
    }

    // ---- rocks torn from the earth ----
    this.rocks = [];
    const rockTex = assets.tex('rockColor');
    const rockNorm = assets.tex('rockNormal');
    const propNames = ['rock_smallA', 'rock_smallD', 'rocks', 'debris', 'gravestone-broken', 'urn-round'];
    const count = 22;
    for (let i = 0; i < count; i++) {
      let mesh;
      if (i % 3 === 0) {
        const src = assets.prop(pick(propNames));
        mesh = src ? src.clone(true) : null;
        if (mesh) mesh.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
      }
      if (!mesh) {
        mesh = new THREE.Mesh(
          new THREE.DodecahedronGeometry(rand(0.3, 0.85), 0),
          new THREE.MeshStandardMaterial({ map: rockTex, normalMap: rockNorm, roughness: 0.95 })
        );
        mesh.castShadow = true;
      }
      const a = rand(0, Math.PI * 2);
      const r = rand(1.5, Q.radius * 0.9);
      const px = this.center.x + Math.cos(a) * r;
      const pz = this.center.z + Math.sin(a) * r;
      const py = this.world.getHeight(px, pz);
      mesh.position.set(px, py - 0.25, pz);
      mesh.rotation.set(rand(0, 6.28), rand(0, 6.28), rand(0, 6.28));
      const s = rand(0.8, 1.6);
      mesh.scale.setScalar(s);
      this.group.add(mesh);

      // random point on the future shell
      const u = rand(-1, 1), th = rand(0, Math.PI * 2);
      const sq = Math.sqrt(1 - u * u);
      this.rocks.push({
        mesh,
        start: mesh.position.clone(),
        shellDir: new THREE.Vector3(sq * Math.cos(th), u, sq * Math.sin(th)),
        delay: rand(0, 0.9),
        spin: new THREE.Vector3(rand(-3, 3), rand(-3, 3), rand(-3, 3)),
        vel: new THREE.Vector3(),
        risen: false,
      });
    }

    // cast feedback
    const fl = document.getElementById('flash-layer');
    fl.className = 'quake';
    setTimeout(() => { if (fl.className === 'quake') fl.className = ''; }, 600);
    audio.play('stun', { volume: 0.9, rate: 0.55 });
    audio.play('deathBell', { volume: 0.5, rate: 1.1, delay: 0.15 });
    this.combat.shake(0.4);
    this.combat.announce(`地爆天星——${this.victims.length} 妖离地！`);
    return true;
  }

  addVictim(ent, isBoss = false) {
    ent.setLifted(true);
    const off = ent.position.clone().sub(this.center);
    this.victims.push({
      ent, isBoss,
      angle: Math.atan2(off.z, off.x),
      radius: Math.max(off.length(), 1.4),
      baseY: ent.position.y,
      spinSpeed: rand(2.2, 3.6) * (Math.random() < 0.5 ? 1 : -1),
      wobble: rand(0, 6.28),
    });
  }

  // damage that ignores stagger while lifted (entities handle the lifted flag themselves)
  dealTick() {
    for (const v of this.victims) {
      if (!v.ent.alive) continue;
      v.ent.takeDamage(Q.tickDmg, null, { heavy: false });
      this.combat.emit('damageNumber', v.ent.position.clone().add(new THREE.Vector3(0, 1.6, 0)), Q.tickDmg, false);
    }
  }

  update(dt) {
    if (!this.active) return;
    this.time += dt;
    const T = this.time;
    const tRise = Q.riseTime;
    const tGather = tRise + Q.gatherTime;
    const tHold = tGather + Q.holdTime;
    const tFall = tHold + Q.fallTime;

    const gy = this.center.y;

    if (T < tRise) {
      // ---- phase 1: core ascends ----
      const k = T / tRise;
      const e = 1 - Math.pow(1 - k, 3);
      this.coreY = gy + 1 + e * (Q.height - 1);
      this.core.position.set(this.center.x, this.coreY, this.center.z);
      this.pillarMat.opacity = k * 0.3;
      this.ring.setProgress(k);
      if (Math.random() < dt * 40) this.suckParticle();
    } else if (T < tGather) {
      // ---- phase 2: everything is pulled skyward ----
      const k = (T - tRise) / Q.gatherTime;
      this.coreY = gy + Q.height;
      this.core.position.set(this.center.x, this.coreY, this.center.z);
      this.pillarMat.opacity = 0.3 * (1 - k * 0.4);
      this.ring.setProgress(1);

      for (const r of this.rocks) {
        const localT = clamp((T - tRise - r.delay) / (Q.gatherTime * 0.75), 0, 1);
        if (localT <= 0) {
          if (!r.risen && Math.random() < dt * 8) this.effects.dust(r.start.clone(), 2, 0x8a7c60);
          continue;
        }
        if (!r.risen) { r.risen = true; this.effects.dust(r.start.clone(), 5, 0x8a7c60); }
        const e = localT * localT * (3 - 2 * localT);
        const target = this.core.position.clone().addScaledVector(r.shellDir, Q.shellRadius);
        const spiral = new THREE.Vector3(
          Math.sin(localT * 9 + r.delay * 7) * (1 - e) * 2.2, 0,
          Math.cos(localT * 9 + r.delay * 7) * (1 - e) * 2.2
        );
        r.mesh.position.lerpVectors(r.start, target, e).add(spiral);
        r.mesh.rotation.x += r.spin.x * dt;
        r.mesh.rotation.y += r.spin.y * dt;
        r.mesh.rotation.z += r.spin.z * dt;
      }

      for (const v of this.victims) {
        v.angle += v.spinSpeed * dt;
        const e = k * k * (3 - 2 * k);
        const rr = lerp(v.radius, 1.1, e);
        const vy = lerp(v.baseY, this.coreY - 1.4, e) + Math.sin(T * 5 + v.wobble) * 0.35;
        v.ent.group.position.set(
          this.center.x + Math.cos(v.angle) * rr,
          vy,
          this.center.z + Math.sin(v.angle) * rr
        );
        if (Math.random() < dt * 6) {
          this.effects.spawnSprite({
            tex: this.effects.texSoft, color: 0xa055ff,
            pos: v.ent.position.clone().add(new THREE.Vector3(rand(-0.5, 0.5), rand(0, 1.6), rand(-0.5, 0.5))),
            vel: new THREE.Vector3(0, rand(0.5, 1.5), 0), size: rand(0.12, 0.3), life: rand(0.25, 0.5),
          });
        }
      }

      this.tickTimer -= dt;
      if (this.tickTimer <= 0) { this.tickTimer = 0.5; this.dealTick(); }
      if (Math.random() < dt * 50) this.suckParticle();
      this.corePulse(T, 1);
    } else if (T < tHold) {
      // ---- phase 3: the great sphere trembles ----
      const k = (T - tGather) / Q.holdTime;
      this.spinShell(dt, 1 + k * 2.5);
      this.coreMesh.material.emissive.setHex(k > 0.5 ? 0xff3050 : 0x7a2bff);
      this.corePulse(T, 1 + k * 2);
      this.combat.shake(0.06);
      if (Math.random() < dt * 30) this.suckParticle();
    } else if (T < tFall) {
      // ---- phase 4: it falls ----
      const k = (T - tHold) / Q.fallTime;
      const e = k * k;
      const y = lerp(gy + Q.height, gy + 1.2, e);
      const dy = y - this.core.position.y;
      this.core.position.y = y;
      this.pillarMat.opacity = 0;
      for (const r of this.rocks) r.mesh.position.y += dy;
      for (const v of this.victims) v.ent.group.position.y += dy;
      this.spinShell(dt, 4);
    } else if (!this.exploded) {
      this.explode(gy);
    } else {
      // ---- debris scatter after the blast ----
      const k = clamp((T - tFall) / 1.1, 0, 1);
      for (const r of this.rocks) {
        r.vel.y -= 22 * dt;
        r.mesh.position.addScaledVector(r.vel, dt);
        const groundAt = this.world.getHeight(r.mesh.position.x, r.mesh.position.z);
        if (r.mesh.position.y < groundAt + 0.1) {
          r.mesh.position.y = groundAt + 0.1;
          r.vel.multiplyScalar(0.4);
          r.vel.y = Math.abs(r.vel.y) * 0.3;
        }
        r.mesh.rotation.x += r.spin.x * dt * 2;
        r.mesh.rotation.z += r.spin.z * dt * 2;
        r.mesh.traverse?.((o) => {
          if (o.material && o.material.transparent) o.material.opacity = 1 - k;
        });
      }
      this.coreGlow.material.opacity = Math.max(0, 0.95 - k * 2);
      this.coreLight.intensity = Math.max(0, 5 - k * 10);
      this.coreMesh.scale.setScalar(Math.max(0.01, 1 - k * 1.4));
      if (k >= 1) this.cleanup();
    }
  }

  corePulse(T, mul) {
    const p = 1 + Math.sin(T * 10) * 0.12 * mul;
    this.coreMesh.scale.setScalar(p);
    this.coreGlow.scale.setScalar(4.2 * p * (1 + (mul - 1) * 0.25));
    this.coreLight.intensity = 5 * p * mul;
    this.coreMesh.rotation.y += 0.03;
    this.coreMesh.rotation.x += 0.017;
  }

  spinShell(dt, speedMul) {
    for (const r of this.rocks) {
      const off = r.mesh.position.clone().sub(this.core.position);
      const rotated = off.applyAxisAngle(new THREE.Vector3(0, 1, 0), dt * 0.8 * speedMul);
      r.mesh.position.copy(this.core.position).add(rotated);
      r.mesh.rotation.y += dt * 2 * speedMul;
    }
    for (const v of this.victims) {
      v.angle += v.spinSpeed * dt * speedMul * 0.4;
      v.ent.group.position.x = this.center.x + Math.cos(v.angle) * 1.1;
      v.ent.group.position.z = this.center.z + Math.sin(v.angle) * 1.1;
    }
  }

  suckParticle() {
    const a = rand(0, Math.PI * 2);
    const r = rand(3, Q.radius);
    const start = new THREE.Vector3(
      this.center.x + Math.cos(a) * r,
      this.world.getHeight(this.center.x + Math.cos(a) * r, this.center.z + Math.sin(a) * r) + rand(0.2, 1.5),
      this.center.z + Math.sin(a) * r
    );
    const toCore = this.core.position.clone().sub(start).normalize().multiplyScalar(rand(7, 13));
    this.effects.spawnSprite({
      tex: this.effects.texSoft, color: Math.random() < 0.5 ? 0xa055ff : 0x6a3bd0,
      pos: start, vel: toCore, size: rand(0.1, 0.28), life: rand(0.4, 0.8),
    });
  }

  explode(gy) {
    this.exploded = true;
    const impact = new THREE.Vector3(this.center.x, gy, this.center.z);

    // release victims: scatter them around the crater, then apply blast damage
    for (const v of this.victims) {
      const a = rand(0, Math.PI * 2);
      const rr = rand(1.5, 4.2);
      const px = this.center.x + Math.cos(a) * rr;
      const pz = this.center.z + Math.sin(a) * rr;
      v.ent.group.position.set(px, this.world.getHeight(px, pz), pz);
      v.ent.setLifted(false);
      if (v.ent.alive) {
        v.ent.takeDamage(Q.blastDmg, impact, { heavy: true });
        this.combat.emit('damageNumber', v.ent.position.clone().add(new THREE.Vector3(0, 2, 0)), Q.blastDmg, true);
      } else {
        this.effects.bloodBurst(v.ent.position.clone().add(new THREE.Vector3(0, 1, 0)), 0xbfa8ff);
      }
    }

    // rocks burst outward
    for (const r of this.rocks) {
      const dir = r.mesh.position.clone().sub(impact).setY(0).normalize();
      r.vel.copy(dir.multiplyScalar(rand(6, 15)));
      r.vel.y = rand(4, 11);
      r.mesh.traverse?.((o) => {
        if (o.material) { o.material = o.material.clone(); o.material.transparent = true; }
      });
    }

    // spectacle
    this.effects.shockwave(impact, 0xffb340, Q.radius * 1.8);
    setTimeout(() => this.effects.shockwave(impact, 0xa055ff, Q.radius * 2.6), 100);
    setTimeout(() => this.effects.shockwave(impact, 0xff8040, Q.radius * 3.4), 220);
    this.effects.dust(impact, 26, 0x9a8265);
    for (let i = 0; i < 22; i++) {
      const a = rand(0, Math.PI * 2);
      this.effects.spawnSprite({
        tex: this.effects.texSmoke, color: 0x7a6a52,
        pos: impact.clone().add(new THREE.Vector3(0, 0.4, 0)),
        vel: new THREE.Vector3(Math.cos(a) * rand(3, 9), rand(2, 7), Math.sin(a) * rand(3, 9)),
        size: rand(0.8, 1.8), life: rand(0.6, 1.2), grow: 2.2, gravity: -6, additive: false,
      });
      this.effects.spawnSprite({
        tex: this.effects.texSoft, color: pick([0xffb340, 0xa055ff, 0xffe9a0]),
        pos: impact.clone().add(new THREE.Vector3(0, 0.6, 0)),
        vel: new THREE.Vector3(Math.cos(a) * rand(4, 12), rand(3, 10), Math.sin(a) * rand(4, 12)),
        size: rand(0.15, 0.4), life: rand(0.3, 0.7), gravity: -12,
      });
    }
    this.combat.shake(1);
    this.combat.hitstop = Math.max(this.combat.hitstop, 0.2);
    const fl = document.getElementById('flash-layer');
    fl.className = 'boom';
    setTimeout(() => { if (fl.className === 'boom') fl.className = ''; }, 450);
    audio.play('hitHeavy1', { volume: 1, rate: 0.5 });
    audio.play('hitHeavy2', { volume: 0.9, rate: 0.65, delay: 0.06 });
    audio.play('deathBell', { volume: 0.8, rate: 0.7, delay: 0.12 });

    this.ring.dispose();
    this.ring = null;
  }

  cleanup() {
    if (this.ring) { this.ring.dispose(); this.ring = null; }
    for (const v of this.victims) { if (v.ent.lifted) v.ent.setLifted(false); }
    this.scene.remove(this.group);
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material && o.material.dispose) o.material.dispose();
    });
    this.group = null;
    this.active = false;
  }
}
