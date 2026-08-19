import * as THREE from 'three';
import RAPIER from 'rapier';
import { PHYSICS, WORLD } from '../config.js';
import { FixedStepAccumulator } from './Clock.js';

/**
 * PhysicsWorld — Rapier3D (Wasm) wrapper built around the "pre-fractured but
 * asleep" model that this kind of scene demands.
 *
 * THE CENTRAL IDEA
 * ----------------
 * Every fracture chunk of the bridge gets its rigid body and convex collider at
 * load time, but is created as a FIXED (static) body. A static body costs the
 * solver essentially nothing — no island, no integration, no broad-phase pair
 * churn — so the intact bridge is as cheap as a static mesh even though it is
 * already 900 individually simulatable pieces. Triggering a disaster does not
 * build anything: it flips selected bodies to Dynamic with setBodyType() and
 * hands them an impulse. That is why destruction starts on the same frame the
 * user clicks, with no hitch.
 *
 * Bodies are also retired aggressively: anything that has come to rest, sunk,
 * or exceeded the active-body budget goes back to Fixed, keeping the solver
 * island count bounded no matter how long the user lets the carnage run.
 */
export class PhysicsWorld {
  static async create() {
    await RAPIER.init();          // compiles/loads the inlined Wasm module
    return new PhysicsWorld();
  }

  constructor() {
    this.RAPIER = RAPIER;
    this.world = new RAPIER.World({ x: 0, y: PHYSICS.gravity, z: 0 });
    this.world.timestep = PHYSICS.fixedStep;
    this.accumulator = new FixedStepAccumulator(PHYSICS.fixedStep, PHYSICS.maxSubSteps);

    /** @type {Array<ChunkBody>} */
    this.bodies = [];
    this.activeCount = 0;
    this.time = 0;

    /** Callback: (worldPos, impactSpeed) => void — used to spawn splashes. */
    this.onWaterImpact = null;
    /** Callback: (worldPos, impactSpeed) => void — used to spawn dust/sparks. */
    this.onHardImpact = null;

    this._v = new THREE.Vector3();
    this._q = new THREE.Quaternion();
    this._seabed = this._createSeabed();
  }

  /** A single static slab far below sea level so strays never fall forever. */
  _createSeabed() {
    const desc = RAPIER.RigidBodyDesc.fixed().setTranslation(0, -120, 0);
    const rb = this.world.createRigidBody(desc);
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(WORLD.oceanSize * 0.5, 8, WORLD.oceanSize * 0.5)
        .setFriction(0.9).setRestitution(0.02),
      rb,
    );
    return rb;
  }

  /**
   * Register one fracture chunk.
   * @param {object} o
   * @param {THREE.Vector3} o.position    world position of the chunk centroid
   * @param {THREE.Quaternion} [o.quaternion]
   * @param {Float32Array} [o.hull]       flattened local-space hull points (convex collider)
   * @param {THREE.Vector3} [o.halfExtents] cuboid fallback when no hull is given
   * @param {object} o.batch              BatchedRigidMesh that draws it
   * @param {number} o.index              chunk index inside that batch
   * @param {number} [o.density]
   */
  addChunk(o) {
    const desc = RAPIER.RigidBodyDesc.fixed()
      .setTranslation(o.position.x, o.position.y, o.position.z)
      .setLinearDamping(PHYSICS.linearDamping)
      .setAngularDamping(PHYSICS.angularDamping)
      .setCcdEnabled(false);          // CCD is enabled per-body only when launched fast
    if (o.quaternion) {
      const q = o.quaternion;
      desc.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
    }
    const rb = this.world.createRigidBody(desc);

    let cd = null;
    if (o.hull && o.hull.length >= 12) cd = RAPIER.ColliderDesc.convexHull(o.hull);
    if (!cd) {
      const h = o.halfExtents || new THREE.Vector3(1, 1, 1);
      cd = RAPIER.ColliderDesc.cuboid(Math.max(h.x, 0.05), Math.max(h.y, 0.05), Math.max(h.z, 0.05));
    }
    cd.setDensity(o.density ?? 2.2).setFriction(0.82).setRestitution(0.04);
    const collider = this.world.createCollider(cd, rb);

    /** @typedef {object} ChunkBody */
    const entry = {
      rb, collider,
      batch: o.batch,
      index: o.index,
      home: o.position.clone(),
      homeQuat: (o.quaternion || new THREE.Quaternion()).clone(),
      state: 'static',
      restTimer: 0,
      submergedFor: 0,
      activatedAt: 0,
      splashed: false,
      lastSpeed: 0,
    };
    this.bodies.push(entry);
    return entry;
  }

  /** Flip a chunk to Dynamic. Optionally kick it. */
  activate(entry, impulse = null, torque = null) {
    if (entry.state !== 'static') return false;
    entry.rb.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
    entry.state = 'dynamic';
    entry.activatedAt = this.time;
    entry.restTimer = 0;
    this.activeCount++;
    if (impulse) entry.rb.applyImpulse({ x: impulse.x, y: impulse.y, z: impulse.z }, true);
    if (torque) entry.rb.applyTorqueImpulse({ x: torque.x, y: torque.y, z: torque.z }, true);
    return true;
  }

  /** Retire a chunk from the solver (still drawn at its final resting transform). */
  freeze(entry) {
    if (entry.state === 'static') return;
    entry.rb.setBodyType(RAPIER.RigidBodyType.Fixed, false);
    if (entry.state === 'dynamic') this.activeCount--;
    entry.state = 'frozen';
  }

  /**
   * Spherical impulse field — the workhorse for explosions, meteor impacts and
   * monster strikes. Falloff is 1/r² clamped, with an upward bias so debris
   * arcs instead of sliding, which is what reads as "blast" on camera.
   */
  applyRadialImpulse(center, radius, power, opts = {}) {
    const upBias = opts.upBias ?? 0.45;
    const spin = opts.spin ?? 0.55;
    const activateStatic = opts.activateStatic ?? true;
    const r2 = radius * radius;
    let touched = 0;

    for (const e of this.bodies) {
      if (e.state === 'frozen' || e.state === 'sunk') continue;
      const t = e.rb.translation();
      const dx = t.x - center.x, dy = t.y - center.y, dz = t.z - center.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 > r2) continue;

      const d = Math.max(Math.sqrt(d2), 1);
      const falloff = 1 - d / radius;             // linear-ish core
      const mag = power * falloff * falloff;       // squared → sharp near-field
      const inv = 1 / d;
      const imp = {
        x: dx * inv * mag,
        y: dy * inv * mag + mag * upBias,
        z: dz * inv * mag,
      };
      if (e.state === 'static') {
        if (!activateStatic) continue;
        this.activate(e, imp);
      } else {
        e.rb.applyImpulse(imp, true);
      }
      // Random-ish but deterministic tumble from the chunk index.
      const s = Math.sin(e.index * 12.9898) * 43758.5453;
      const f = s - Math.floor(s);
      e.rb.applyTorqueImpulse({
        x: (f - 0.5) * mag * spin,
        y: (((f * 7) % 1) - 0.5) * mag * spin,
        z: (((f * 13) % 1) - 0.5) * mag * spin,
      }, true);
      e.rb.enableCcd(true);                        // fast debris must not tunnel
      touched++;
    }
    return touched;
  }

  /**
   * Horizontal drag from a tsunami front: everything below the water wall gets
   * shoved down-axis. Called each frame while the wave overlaps the structure.
   */
  applyWaveForce(frontX, thickness, crestY, power) {
    for (const e of this.bodies) {
      if (e.state === 'frozen' || e.state === 'sunk') continue;
      const t = e.rb.translation();
      if (t.y > crestY) continue;
      const dx = t.x - frontX;
      if (dx < -thickness || dx > thickness * 0.35) continue;
      const w = 1 - Math.abs(dx) / thickness;
      const imp = { x: power * w * 0.016, y: power * w * 0.004, z: 0 };
      if (e.state === 'static') this.activate(e, imp);
      else e.rb.applyImpulse(imp, true);
    }
  }

  /** Convert a world point + radius into "how many chunks live here" (UI/aiming). */
  countNear(center, radius) {
    const r2 = radius * radius;
    let n = 0;
    for (const e of this.bodies) {
      const t = e.rb.translation();
      const dx = t.x - center.x, dy = t.y - center.y, dz = t.z - center.z;
      if (dx * dx + dy * dy + dz * dz <= r2) n++;
    }
    return n;
  }

  /**
   * Step the solver and push every transform into the batched renderers.
   * @param dt scaled simulation delta (0 while paused → sim freezes, camera does not)
   */
  update(dt) {
    const steps = this.accumulator.consume(dt);
    for (let i = 0; i < steps; i++) {
      this.world.step();
      this.time += PHYSICS.fixedStep;
    }

    const budgetExceeded = this.activeCount > PHYSICS.maxActiveBodies;

    for (const e of this.bodies) {
      if (e.state === 'static') continue;

      const t = e.rb.translation();
      const r = e.rb.rotation();

      if (e.state === 'dynamic') {
        const lv = e.rb.linvel();
        const speed = Math.hypot(lv.x, lv.y, lv.z);

        // --- hard-impact detection: a big deceleration means it hit something ---
        if (this.onHardImpact && e.lastSpeed - speed > 9 && t.y > WORLD.seaLevel + 1) {
          this._v.set(t.x, t.y, t.z);
          this.onHardImpact(this._v, e.lastSpeed);
        }
        e.lastSpeed = speed;

        // --- water: splash once, then buoyancy + heavy drag, then sink out ---
        if (t.y < WORLD.seaLevel) {
          if (!e.splashed && speed > 4) {
            e.splashed = true;
            if (this.onWaterImpact) {
              this._v.set(t.x, WORLD.seaLevel, t.z);
              this.onWaterImpact(this._v, speed);
            }
          }
          const depth = Math.min(WORLD.seaLevel - t.y, 20);
          const m = e.rb.mass();
          // Buoyancy slightly under gravity (concrete sinks) + quadratic drag.
          e.rb.applyImpulse({
            x: -lv.x * m * 0.10 * PHYSICS.fixedStep * 60,
            y: (depth * 0.55 * m * 0.10 - lv.y * m * 0.14) * PHYSICS.fixedStep * 60,
            z: -lv.z * m * 0.10 * PHYSICS.fixedStep * 60,
          }, true);
          e.submergedFor += dt;
          if (e.submergedFor > 4.5) {          // gone: retire and stop drawing it
            this.freeze(e);
            e.state = 'sunk';
            e.batch.setTransform(e.index, this._v.set(t.x, t.y, t.z), this._q.set(r.x, r.y, r.z, r.w), 0);
            continue;
          }
        }

        // --- rest detection / budget eviction ---
        if (speed < 0.35) {
          e.restTimer += dt;
          if (e.restTimer > PHYSICS.sleepAfter || (budgetExceeded && e.restTimer > 0.5)) this.freeze(e);
        } else {
          e.restTimer = 0;
        }
      }

      this._v.set(t.x, t.y, t.z);
      this._q.set(r.x, r.y, r.z, r.w);
      e.batch.setTransform(e.index, this._v, this._q, 1);
    }
  }

  /** Restore the bridge to pristine, un-fractured state. */
  reset() {
    for (const e of this.bodies) {
      e.rb.setBodyType(RAPIER.RigidBodyType.Fixed, false);
      e.rb.setTranslation({ x: e.home.x, y: e.home.y, z: e.home.z }, false);
      e.rb.setRotation({ x: e.homeQuat.x, y: e.homeQuat.y, z: e.homeQuat.z, w: e.homeQuat.w }, false);
      e.rb.setLinvel({ x: 0, y: 0, z: 0 }, false);
      e.rb.setAngvel({ x: 0, y: 0, z: 0 }, false);
      e.rb.enableCcd(false);
      e.state = 'static';
      e.restTimer = 0;
      e.submergedFor = 0;
      e.splashed = false;
      e.lastSpeed = 0;
      e.batch.setTransform(e.index, e.home, e.homeQuat, 1);
    }
    this.activeCount = 0;
    this.time = 0;
    this.accumulator.reset();
  }

  get stats() {
    let dynamic = 0, frozen = 0, sunk = 0, staticN = 0;
    for (const e of this.bodies) {
      if (e.state === 'dynamic') dynamic++;
      else if (e.state === 'frozen') frozen++;
      else if (e.state === 'sunk') sunk++;
      else staticN++;
    }
    return { total: this.bodies.length, dynamic, frozen, sunk, static: staticN };
  }

  dispose() { this.world.free(); }
}
