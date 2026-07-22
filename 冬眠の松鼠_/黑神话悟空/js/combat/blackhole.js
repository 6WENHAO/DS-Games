import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { assets } from '../core/assets.js';
import { audio } from '../core/audio.js';
import { rand, clamp, lerp, pick } from '../core/utils.js';

const H = CONFIG.player.hole;

// 「异次元黑洞」：于高空撕开吞天巨洞——三层吸积盘、引力透镜环、蔽日暗幕。
// 大地碎石被潮汐力拉成长条卷入，敌人近洞离地、螺旋没入视界，噬即抹消。
export class BlackHole {
  constructor(scene, world, effects) {
    this.scene = scene;
    this.world = world;
    this.effects = effects;
    this.combat = null;
    this.active = false;
    this.group = null;
  }

  cast(center) {
    if (this.active) return false;
    this.active = true;
    this.time = 0;
    this.victims = [];
    this.debris = [];
    this.scanTimer = 0;
    this.hum = 0;

    const gy = this.world.getHeight(center.x, center.z);
    this.center = new THREE.Vector3(center.x, gy + H.height, center.z);
    this.groundY = gy;

    this.group = new THREE.Group();
    this.group.position.copy(this.center);
    this.scene.add(this.group);

    // ---- event horizon ----
    this.horizon = new THREE.Mesh(
      new THREE.SphereGeometry(2.2, 40, 28),
      new THREE.MeshBasicMaterial({ color: 0x000000 })
    );
    this.group.add(this.horizon);

    // gravitational lensing ring (bright, hugs the sphere)
    this.lensRing = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.effects.texRing, color: 0xf2e6ff, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.95,
    }));
    this.lensRing.scale.setScalar(5.4);
    this.group.add(this.lensRing);

    // violet rim glow
    this.rimGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.effects.texSoft, color: 0x7a2bff, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.8,
    }));
    this.rimGlow.scale.setScalar(9);
    this.group.add(this.rimGlow);

    // darkness: near halo + sky veil that swallows the light
    this.darkHalo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.effects.texSoft, color: 0x030008, transparent: true,
      blending: THREE.NormalBlending, depthWrite: false, opacity: 0.92,
    }));
    this.darkHalo.scale.setScalar(15);
    this.group.add(this.darkHalo);
    this.skyVeil = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.effects.texSoft, color: 0x060010, transparent: true,
      blending: THREE.NormalBlending, depthWrite: false, opacity: 0.4,
    }));
    this.skyVeil.scale.setScalar(46);
    this.group.add(this.skyVeil);

    // ---- triple accretion disks ----
    this.disks = [];
    const diskDefs = [
      { inner: 2.5, outer: 4.4, color: 0x9a3bff, opacity: 0.62, tiltX: 0.5, tiltY: 0.2, speed: 3.2 },
      { inner: 3.2, outer: 6.2, color: 0x3f8cff, opacity: 0.45, tiltX: -0.38, tiltY: 0.8, speed: -2.2 },
      { inner: 4.2, outer: 7.2, color: 0xffd8a0, opacity: 0.3, tiltX: 0.12, tiltY: -0.5, speed: 1.5 },
    ];
    for (const d of diskDefs) {
      const disk = new THREE.Mesh(
        new THREE.RingGeometry(d.inner, d.outer, 72),
        new THREE.MeshBasicMaterial({
          color: d.color, transparent: true, opacity: d.opacity,
          side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false,
        })
      );
      disk.rotation.x = Math.PI / 2 + d.tiltX;
      disk.rotation.y = d.tiltY;
      disk.userData.speed = d.speed;
      this.group.add(disk);
      this.disks.push(disk);
    }

    this.light = new THREE.PointLight(0x8a3bff, 7, 60, 1.6);
    this.group.add(this.light);

    // ---- debris torn from the earth ----
    const rockTex = assets.tex('rockColor');
    const rockNorm = assets.tex('rockNormal');
    const propNames = ['rock_smallA', 'rock_smallD', 'debris', 'gravestone-broken', 'urn-square'];
    for (let i = 0; i < H.debrisCount; i++) {
      let mesh = null;
      if (i % 3 === 0) {
        const src = assets.prop(pick(propNames));
        if (src) mesh = src.clone(true);
      }
      if (!mesh) {
        mesh = new THREE.Mesh(
          new THREE.DodecahedronGeometry(rand(0.25, 0.7), 0),
          new THREE.MeshStandardMaterial({ map: rockTex, normalMap: rockNorm, roughness: 0.95 })
        );
      }
      const a = rand(0, Math.PI * 2);
      const r = rand(3, H.radius * 0.85);
      const px = this.center.x + Math.cos(a) * r;
      const pz = this.center.z + Math.sin(a) * r;
      mesh.position.set(px, this.world.getHeight(px, pz) - 0.2, pz);
      mesh.rotation.set(rand(0, 6.28), rand(0, 6.28), rand(0, 6.28));
      mesh.scale.setScalar(rand(0.8, 1.5));
      this.scene.add(mesh);
      this.debris.push({
        mesh, delay: rand(0.1, H.duration * 0.6), risen: false, gone: false,
        spin: new THREE.Vector3(rand(-4, 4), rand(-4, 4), rand(-4, 4)),
        baseScale: mesh.scale.x,
      });
    }

    // ---- ground rune ring ----
    this.ring = this.effects.groundRing(this.center.x, gy, this.center.z, H.radius, 0x8a5cff);

    // feedback: the sky darkens for the whole duration
    const fl = document.getElementById('flash-layer');
    fl.className = 'hole';
    audio.play('deathBell', { volume: 0.85, rate: 0.4 });
    audio.play('deathBell', { volume: 0.6, rate: 0.32, delay: 0.2 });
    audio.play('stun', { volume: 0.9, rate: 0.45, delay: 0.1 });
    this.combat.shake(0.5);
    this.combat.announce('异次元黑洞——天地失色，万物归墟！');
    return true;
  }

  scanVictims() {
    for (const e of this.combat.enemies) {
      if (!e.alive || e.lifted || e.state === 'buried') continue;
      if (e.position.distanceTo(this.center) > H.radius) continue;
      e.setLifted(true);
      this.victims.push({ ent: e, isBoss: false, swallowed: false, done: false, swirl: rand(0, 6.28), spin: rand(2.5, 4) * (Math.random() < 0.5 ? 1 : -1) });
    }
    const boss = this.combat.boss;
    if (boss && boss.alive && !boss.lifted && boss.state !== 'dormant' &&
        boss.position.distanceTo(this.center) <= H.radius + 3 &&
        !this.victims.some((v) => v.ent === boss)) {
      boss.setLifted(true);
      this.victims.push({ ent: boss, isBoss: true, swallowed: false, done: false, swirl: rand(0, 6.28), spin: 2.2 });
    }
  }

  update(dt) {
    if (!this.active) return;
    this.time += dt;
    const T = this.time;
    const tForm = H.formTime;
    const tPull = tForm + H.duration;
    const tEnd = tPull + H.collapseTime;

    for (const disk of this.disks) disk.rotation.z += dt * disk.userData.speed;
    const pulse = 1 + Math.sin(T * 8) * 0.07;
    this.lensRing.scale.setScalar(5.4 * pulse);
    this.rimGlow.scale.setScalar(9 * (2 - pulse));
    this.light.intensity = 7 * pulse;
    this.horizon.rotation.y += dt * 0.8;

    // crackling void lightning near the horizon
    if (Math.random() < dt * 14) {
      const a = rand(0, Math.PI * 2), el = rand(-0.8, 0.8);
      this.effects.spawnSprite({
        tex: this.effects.texSpark, color: Math.random() < 0.5 ? 0xcaa8ff : 0xffffff,
        pos: this.center.clone().add(new THREE.Vector3(Math.cos(a) * 2.5, el * 2, Math.sin(a) * 2.5)),
        size: rand(0.6, 1.6), life: rand(0.08, 0.18), grow: 1.5, rot: rand(0, 6.28),
      });
    }

    if (T < tForm) {
      // ---- the void tears open ----
      const k = T / tForm;
      this.group.scale.setScalar(0.01 + (1 - Math.pow(1 - k, 3)) * 0.99);
      this.ring.setProgress(k);
      if (Math.random() < dt * 40) this.suckParticle();
    } else if (T < tPull) {
      // ---- pulling in everything under heaven ----
      if (!this.opened) {
        this.opened = true;
        this.effects.shockwave(this.center.clone(), 0x9a5bff, 22);
        this.combat.hitstop = Math.max(this.combat.hitstop, 0.07);
        this.combat.shake(0.6);
        audio.play('hitHeavy2', { volume: 0.9, rate: 0.5 });
      }
      this.group.scale.setScalar(1);
      this.combat.shake(dt * 0.5); // constant dread rumble
      this.scanTimer -= dt;
      if (this.scanTimer <= 0) { this.scanTimer = 0.3; this.scanVictims(); }
      if (this.hum <= 0) { this.hum = 0.5; audio.play('stun', { volume: 0.4, rate: 0.4, ratejitter: 0.06 }); }
      this.hum -= dt;

      // victims
      for (const v of this.victims) {
        if (v.done) continue;
        if (v.swallowed) { this.updateSwallowing(v, dt); continue; }
        const ent = v.ent;
        const bodyPos = ent.position.clone().add(new THREE.Vector3(0, 1, 0));
        const to3d = this.center.clone().sub(bodyPos);
        const d3 = to3d.length();
        const swallowR = v.isBoss ? H.bossSwallowRadius : H.swallowRadius;
        if (d3 < swallowR) { this.beginSwallow(v); continue; }

        const closeness = clamp(1 - d3 / (H.radius + 3), 0, 1);
        const pull = (H.pullSpeed + closeness * closeness * 14) * (v.isBoss ? H.bossPullMul : 1);
        const step = to3d.normalize().multiplyScalar(pull * dt);
        v.swirl += v.spin * dt;
        const radial = ent.position.clone().sub(this.center).setY(0);
        const swirlDir = new THREE.Vector3(-radial.z, 0, radial.x).normalize();
        step.addScaledVector(swirlDir, pull * dt * 0.5);
        ent.group.position.add(step);

        // far away: slide along the ground; close: lifted into the sky
        if (d3 > H.liftDistance) {
          ent.group.position.y = this.world.getHeight(ent.position.x, ent.position.z);
        } else {
          const minY = this.world.getHeight(ent.position.x, ent.position.z);
          if (ent.position.y < minY) ent.position.y = minY;
          ent.group.rotation.y += dt * 4; // tumbling in the air
        }

        if (Math.random() < dt * 12) {
          this.effects.spawnSprite({
            tex: this.effects.texSoft, color: 0x9a5bff,
            pos: ent.position.clone().add(new THREE.Vector3(rand(-0.5, 0.5), rand(0.3, 1.7), rand(-0.5, 0.5))),
            vel: this.center.clone().sub(ent.position).normalize().multiplyScalar(rand(3, 6)),
            size: rand(0.14, 0.34), life: rand(0.25, 0.5),
          });
        }
      }

      // debris: torn up, spaghettified, devoured
      for (const d of this.debris) {
        if (d.gone) continue;
        if (T - tForm < d.delay) {
          if (Math.random() < dt * 4) this.effects.dust(d.mesh.position.clone(), 2, 0x8a7c60);
          continue;
        }
        if (!d.risen) { d.risen = true; this.effects.dust(d.mesh.position.clone(), 5, 0x8a7c60); }
        const to = this.center.clone().sub(d.mesh.position);
        const dd = to.length();
        if (dd < 2.5) {
          d.gone = true;
          d.mesh.visible = false;
          this.effects.spawnSprite({
            tex: this.effects.texSoft, color: 0xcaa8ff,
            pos: this.center.clone(), size: rand(0.6, 1.2), life: 0.22, grow: 2,
          });
          continue;
        }
        const speed = 3.5 + (1 - clamp(dd / H.radius, 0, 1)) * 13;
        d.mesh.position.addScaledVector(to.normalize(), speed * dt);
        d.mesh.rotation.x += d.spin.x * dt;
        d.mesh.rotation.y += d.spin.y * dt;
        // tidal stretching toward the maw
        const stretch = clamp(1 + (1 - dd / H.radius) * 1.8, 1, 2.6);
        d.mesh.scale.set(d.baseScale / Math.sqrt(stretch), d.baseScale / Math.sqrt(stretch), d.baseScale * stretch);
        d.mesh.lookAt(this.center);
      }

      if (Math.random() < dt * 80) this.suckParticle();
      this.ring.setProgress(1);
    } else if (T < tEnd) {
      // ---- collapse ----
      const k = (T - tPull) / H.collapseTime;
      this.releaseSurvivors();
      this.group.scale.setScalar(Math.max(0.01, 1 - k * k));
      this.darkHalo.material.opacity = 0.92 * (1 - k);
      this.skyVeil.material.opacity = 0.4 * (1 - k);
      for (const v of this.victims) {
        if (v.swallowed && !v.done) this.updateSwallowing(v, dt);
      }
      const fl = document.getElementById('flash-layer');
      if (fl.className === 'hole') fl.className = '';
    } else {
      this.finishCollapse();
    }
  }

  beginSwallow(v) {
    v.swallowed = true;
    v.swallowT = 0;
    audio.play('hitBone2', { volume: 0.8, rate: 0.55, ratejitter: 0.1 });
    this.effects.spawnSprite({
      tex: this.effects.texSpark, color: 0xcaa8ff,
      pos: this.center.clone(), size: 3, life: 0.25, grow: 4,
    });
    this.combat.shake(0.2);
  }

  updateSwallowing(v, dt) {
    v.swallowT += dt;
    const ent = v.ent;
    const k = clamp(v.swallowT / 0.42, 0, 1);
    v.swirl += 10 * dt;
    const r = (1 - k) * (v.isBoss ? 2.4 : 1.6);
    ent.group.position.set(
      this.center.x + Math.cos(v.swirl) * r,
      this.center.y - 1.1 * k,
      this.center.z + Math.sin(v.swirl) * r
    );
    const s = Math.max(0.02, 1 - k) * (v.isBoss ? CONFIG.boss.scale : ent.cfg ? ent.cfg.scale : 1);
    ent.group.scale.setScalar(s);
    ent.group.rotation.y += 14 * dt;
    if (k >= 1 && !v.done) {
      v.done = true;
      ent.setLifted(false);
      ent.group.visible = false;
      if (ent.alive) ent.takeDamage(999999, null, { heavy: true });
      this.combat.emit('damageNumber', this.center.clone().add(new THREE.Vector3(0, 1.6, 0)), '噬', true);
      this.effects.soulWisp(this.center.clone(), 10);
      this.combat.shake(0.3);
    }
  }

  releaseSurvivors() {
    for (const v of this.victims) {
      if (v.swallowed || v.released) continue;
      const ent = v.ent;
      // anything already dragged deep into the well gets devoured anyway
      const d3 = this.center.distanceTo(ent.position.clone().add(new THREE.Vector3(0, 1, 0)));
      if (d3 < H.radius * 0.55) { this.beginSwallow(v); continue; }
      v.released = true;
      ent.group.position.y = this.world.getHeight(ent.position.x, ent.position.z);
      ent.setLifted(false);
    }
  }

  suckParticle() {
    const a = rand(0, Math.PI * 2);
    const el = rand(-0.4, 1);
    const r = rand(5, H.radius + 6);
    const start = this.center.clone().add(new THREE.Vector3(
      Math.cos(a) * r, el * r * 0.5, Math.sin(a) * r
    ));
    if (start.y < this.groundY + 0.2) start.y = this.groundY + 0.2;
    const toHole = this.center.clone().sub(start).normalize().multiplyScalar(rand(10, 20));
    this.effects.spawnSprite({
      tex: this.effects.texSoft,
      color: Math.random() < 0.4 ? 0xcaa8ff : (Math.random() < 0.5 ? 0x8a3bff : 0x4a9aff),
      pos: start, vel: toHole, size: rand(0.12, 0.32), life: rand(0.4, 0.8),
    });
  }

  finishCollapse() {
    this.effects.spawnSprite({
      tex: this.effects.texSoft, color: 0xe8dfff,
      pos: this.center.clone(), size: 4, life: 0.35, grow: 8,
    });
    this.effects.shockwave(new THREE.Vector3(this.center.x, this.groundY, this.center.z), 0x9a5bff, H.radius * 1.8);
    this.effects.dust(new THREE.Vector3(this.center.x, this.groundY, this.center.z), 18, 0x6a5a80);
    audio.play('hitHeavy2', { volume: 0.9, rate: 0.6 });
    audio.play('deathBell', { volume: 0.7, rate: 0.5, delay: 0.08 });
    this.combat.shake(0.7);
    this.combat.hitstop = Math.max(this.combat.hitstop, 0.1);
    this.cleanup();
  }

  cleanup() {
    this.releaseSurvivors();
    for (const v of this.victims) {
      if (v.swallowed && !v.done) {
        v.done = true;
        v.ent.setLifted(false);
        v.ent.group.visible = false;
        if (v.ent.alive) v.ent.takeDamage(999999, null, { heavy: true });
      }
    }
    for (const d of this.debris) {
      this.scene.remove(d.mesh);
      d.mesh.traverse?.((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material && o.material.dispose) o.material.dispose();
      });
    }
    this.debris = [];
    if (this.ring) { this.ring.dispose(); this.ring = null; }
    const fl = document.getElementById('flash-layer');
    if (fl.className === 'hole') fl.className = '';
    if (this.group) {
      this.scene.remove(this.group);
      this.group.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material && o.material.dispose) o.material.dispose();
      });
      this.group = null;
    }
    this.opened = false;
    this.active = false;
  }
}
