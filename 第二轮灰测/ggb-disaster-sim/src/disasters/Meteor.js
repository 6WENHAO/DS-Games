import * as THREE from 'three';
import { WORLD, DISASTER, COLORS } from '../config.js';

/**
 * Meteor — entry, impact, blast.
 *
 * Three separate physical events are modelled, because they read differently on
 * camera and arrive at different times:
 *   1. ENTRY — an incandescent body on a ballistic path, shedding fire and smoke.
 *      The trail is emitted along the interpolated path rather than at the
 *      current position, so a 940 m/s object still leaves a continuous streak
 *      instead of a dotted line at 60 fps.
 *   2. IMPACT — a radial rigid-body impulse, chunk incandescence (setHeat), a
 *      fireball, and a screen-space shockwave whose front expands at ~620 m/s.
 *      The visual front and the physical impulse radius are driven by the same
 *      number, so debris starts moving exactly when the ring reaches it.
 *   3. AFTERMATH — sustained burning on the crater lip and secondary collapses
 *      as unsupported spans give way.
 */
export class Meteor {
  constructor(ctx) {
    this.ctx = ctx;
    this.id = 'meteor';
    this.label = '陨石冲击 · Meteor';
    this.running = false;
    this.phase = 'idle';
    this.t = 0;

    const cfg = DISASTER.meteor;
    this.impact = new THREE.Vector3(...cfg.impactPoint);

    // ---- the body ----
    const geo = new THREE.IcosahedronGeometry(cfg.radius, 2);
    // Rough it up so it is not an obvious sphere.
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const n = 0.78 + Math.abs(Math.sin(i * 12.9898) * 0.42);
      p.setXYZ(i, p.getX(i) * n, p.getY(i) * n, p.getZ(i) * n);
    }
    geo.computeVertexNormals();
    this.mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      color: 0x1c1614, roughness: 0.95, metalness: 0.1,
      emissive: new THREE.Color(COLORS.fire), emissiveIntensity: 2.6,
    }));
    this.mesh.castShadow = true;
    this.mesh.visible = false;
    ctx.scene.add(this.mesh);

    this._from = new THREE.Vector3();
    this._pos = new THREE.Vector3();
    this._prev = new THREE.Vector3();
    this._tmp = new THREE.Vector3();
    this._burnTimer = 0;
    this._secondary = 0;
  }

  /** @param {THREE.Vector3} [target] optional user-chosen impact point */
  trigger(target = null) {
    const cfg = DISASTER.meteor;
    if (target) this.impact.copy(target);
    this.running = true;
    this.phase = 'entry';
    this.t = 0;
    this._secondary = 0;

    // Come in low from the north-west so the streak crosses the frame diagonally
    // rather than dropping straight down out of shot.
    this._from.copy(this.impact).add(new THREE.Vector3(-2300, 2050, -1400));
    this.travel = this._from.distanceTo(this.impact) / cfg.entrySpeed;
    this._pos.copy(this._from);
    this._prev.copy(this._from);
    this.mesh.visible = true;
    this.mesh.position.copy(this._from);
    this.mesh.scale.setScalar(1);
  }

  _entry(dt) {
    const cfg = DISASTER.meteor;
    const { particles, shake, camera } = this.ctx;
    const u = Math.min(this.t / this.travel, 1);
    this._prev.copy(this._pos);
    this._pos.lerpVectors(this._from, this.impact, u);
    this.mesh.position.copy(this._pos);
    this.mesh.rotation.x += dt * 2.1;
    this.mesh.rotation.y += dt * 1.4;

    // Emit along the segment travelled this frame → continuous trail.
    const seg = this._prev.distanceTo(this._pos);
    const n = Math.min(28, Math.max(2, Math.floor(seg / 26)));
    for (let i = 0; i < n; i++) {
      this._tmp.lerpVectors(this._prev, this._pos, i / n);
      particles.fire.emit({
        origin: this._tmp, direction: this._tmp.clone().sub(this.impact).normalize(),
        speed: 22, speedJitter: 0.8, spread: 0.7, count: 3, life: 1.1,
        size0: cfg.radius * 0.7, size1: cfg.radius * 2.1, drag: 1.1, originJitter: cfg.radius,
      });
      particles.smoke.emit({
        origin: this._tmp, direction: new THREE.Vector3(0, 1, 0),
        speed: 9, speedJitter: 0.9, spread: 0.9, count: 2, life: 8,
        size0: cfg.radius, size1: cfg.radius * 7, drag: 0.6, buoyancy: 0.8,
        originJitter: cfg.radius * 1.6,
      });
    }

    // Sonic pressure grows as it closes.
    shake.setAmbient(Math.pow(u, 3) * 0.30);
    if (u >= 1) this._detonate();
    else if (u > 0.85) shake.addAt(0.05, this._pos, camera.position, 3000);
  }

  _detonate() {
    const cfg = DISASTER.meteor;
    const { bridge, physics, particles, shake, postfx, camera, ocean } = this.ctx;
    this.phase = 'blast';
    this.t = 0;
    this.mesh.visible = false;

    // ---- fireball + shockwave ----
    particles.explosion(this.impact, 9);
    postfx.spawnShockwave(this.impact, {
      speed: cfg.shockwaveSpeed, life: 2.9, amp: 0.16,
      thickness: 130, chroma: 0.55, heat: 0.85, radius0: cfg.radius,
    });
    // A second, slower thermal front for the lingering heat haze.
    postfx.spawnShockwave(this.impact, {
      speed: 120, life: 5.0, amp: 0.03, thickness: 420, chroma: 0.1, heat: 0.9, radius0: 20,
    });
    shake.add(1.0);

    // ---- rigid-body blast ----
    physics.applyRadialImpulse(this.impact, cfg.blastRadius, cfg.blastImpulse * 0.001, {
      upBias: 0.55, spin: 0.8,
    });

    // ---- incandescent debris near the crater ----
    for (const e of physics.bodies) {
      const d = e.rb.translation();
      this._tmp.set(d.x, d.y, d.z);
      const dist = this._tmp.distanceTo(this.impact);
      if (dist < cfg.blastRadius * 0.55) {
        e.batch.setHeat(e.index, THREE.MathUtils.clamp(1 - dist / (cfg.blastRadius * 0.55), 0, 1));
      }
    }

    // ---- the deck simply ceases to exist near ground zero ----
    bridge.releaseDeckSpan(this.impact.x - 190, this.impact.x + 190, (e, imp) => {
      const d = e.x - this.impact.x;
      imp.set(Math.sign(d) * (2400 - Math.abs(d) * 4), 2200 + Math.random() * 1400,
              (Math.random() - 0.5) * 2000);
    });
    // Cables in the blast are vaporised.
    const node = bridge.cableNodeAtX(this.impact.x);
    bridge.cables.breakAt(0, node, 34, 46);
    bridge.cables.breakAt(1, node, 34, 46);

    // If it splashed down, throw a column of water instead of a dust plume.
    if (this.impact.y < WORLD.deckY * 0.4 || ocean.isSubmerged(this.impact.x, this.impact.y, this.impact.z)) {
      particles.waterImpact(new THREE.Vector3(this.impact.x, WORLD.seaLevel, this.impact.z), 90);
    }
    shake.addAt(1.0, this.impact, camera.position, 6000);
  }

  _blast(dt) {
    const { bridge, particles, shake } = this.ctx;
    shake.setAmbient(Math.max(0, 0.30 - this.t * 0.09));

    // Sustained burning at the crater lip.
    this._burnTimer -= dt;
    if (this._burnTimer <= 0 && this.t < 30) {
      this._burnTimer = 0.09;
      for (let i = 0; i < 3; i++) {
        this._tmp.set(
          this.impact.x + (Math.random() - 0.5) * 300,
          WORLD.deckY + 2,
          this.impact.z + (Math.random() - 0.5) * 24,
        );
        particles.burn(this._tmp, 1.6 + Math.random());
      }
    }

    // Secondary failures: the spans either side lose support and follow.
    if (this.t > 2.2 && this._secondary === 0) {
      this._secondary = 1;
      bridge.releaseDeckSpan(this.impact.x - 420, this.impact.x - 180,
        (e, imp) => imp.set(-300, -600, 0));
      bridge.releaseDeckSpan(this.impact.x + 180, this.impact.x + 420,
        (e, imp) => imp.set(300, -600, 0));
      shake.add(0.4);
    }
    if (this.t > 5.5 && this._secondary === 1) {
      this._secondary = 2;
      // Whichever tower is nearer gives up its top third.
      const sign = this.impact.x < 0 ? -1 : 1;
      bridge.releaseTowerAbove(sign, WORLD.towerHeight * 0.6, -sign * 1200);
      shake.add(0.55);
    }
    if (this.t > 34) { this.running = false; shake.setAmbient(0); }
  }

  update(dt) {
    if (!this.running) return;
    this.t += dt;
    if (this.phase === 'entry') this._entry(dt);
    else if (this.phase === 'blast') this._blast(dt);
  }

  reset() {
    this.running = false;
    this.phase = 'idle';
    this.t = 0;
    this._secondary = 0;
    this.mesh.visible = false;
    this.impact.set(...DISASTER.meteor.impactPoint);
    this.ctx.shake.setAmbient(0);
  }

  get progress() { return this.running ? THREE.MathUtils.clamp(this.t / 34, 0, 1) : 0; }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.ctx.scene.remove(this.mesh);
  }
}
