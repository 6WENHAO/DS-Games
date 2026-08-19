import * as THREE from 'three';
import { WORLD, DISASTER } from '../config.js';

/**
 * Monster — localised, aimable physical destruction.
 *
 * This mode exists to satisfy a different requirement from the other three: not
 * a scripted catastrophe, but an ARBITRARY-POINT damage tool. `strikeAt(point)`
 * applies a high-intensity local impulse anywhere the user clicks, which is also
 * the hook a gameplay layer or an authored animation would drive.
 *
 * The creature itself is deliberately kept off-camera and implied — a swiping
 * claw and footfall pressure waves. Implying the kaiju is both cheaper and
 * scarier than modelling one, and it keeps the destruction the subject of the
 * shot. The claw is a capsule chain whose tip carries the impulse, so what you
 * see hitting the deck is what the solver is actually pushing.
 */
export class Monster {
  constructor(ctx) {
    this.ctx = ctx;
    this.id = 'monster';
    this.label = '巨兽摧毁 · Kaiju';
    this.running = false;
    this.t = 0;
    this._footTimer = 0;
    this._swipeT = -1;
    this._swipeFrom = new THREE.Vector3();
    this._swipeTo = new THREE.Vector3();
    this._tip = new THREE.Vector3();
    this._tmp = new THREE.Vector3();

    // ---- claw: a chain of tapering spheres ----
    const N = 7;
    this.clawCount = N;
    const geo = new THREE.SphereGeometry(1, 12, 10);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x1d2320, roughness: 0.72, metalness: 0.16,
    });
    this.claw = new THREE.InstancedMesh(geo, mat, N);
    this.claw.castShadow = true;
    this.claw.frustumCulled = false;
    this.claw.visible = false;
    ctx.scene.add(this.claw);
    this._clawGeo = geo;
    this._clawMat = mat;
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._s = new THREE.Vector3();
  }

  trigger() {
    this.running = true;
    this.t = 0;
    this._footTimer = 0.4;
    this._beginSwipe(new THREE.Vector3(-260, WORLD.deckY, 0));
  }

  /** Start a claw swipe that passes through `target`. */
  _beginSwipe(target) {
    const cfg = DISASTER.monster;
    this._swipeT = 0;
    this._swipeTarget = target.clone();
    // Sweep across the deck from the seaward side, arcing down through it.
    this._swipeFrom.set(target.x - 420, target.y + 260, target.z + 520);
    this._swipeTo.set(target.x + 420, target.y - 90, target.z - 520);
    this.claw.visible = true;
    this._swipeDur = cfg.swipeDuration;
    this._struck = false;
  }

  /**
   * PUBLIC: hit the structure at an arbitrary world point. Called by the UI
   * (shift-click) and by the swipe animation.
   */
  strikeAt(point, power = 1) {
    const cfg = DISASTER.monster;
    const { physics, bridge, particles, shake, camera, postfx } = this.ctx;

    const touched = physics.applyRadialImpulse(point, cfg.clawRadius * 2.4,
      cfg.strikeImpulse * 0.001 * power, { upBias: 0.35, spin: 0.9 });

    // Anything the claw passes through on the deck is torn out.
    bridge.releaseDeckSpan(point.x - cfg.clawRadius, point.x + cfg.clawRadius, (e, imp) => {
      imp.set((Math.random() - 0.3) * 1800 * power, 900 * power, (Math.random() - 0.5) * 2200 * power);
    });
    // Cables in reach snap.
    if (Math.abs(point.x) < WORLD.towerX && point.y > WORLD.deckY - 30) {
      const node = bridge.cableNodeAtX(point.x);
      bridge.cables.breakAt(Math.random() < 0.5 ? 0 : 1, node, 18, 28);
    }
    // Tower hit: shear it where the claw landed.
    for (const sign of [-1, 1]) {
      if (Math.abs(point.x - sign * WORLD.towerX) < 90 && point.y > 40) {
        bridge.releaseTowerAbove(sign, point.y - 20, -sign * 1600 * power);
      }
    }

    particles.debrisImpact(point, 34 * power);
    postfx.spawnShockwave(point, {
      speed: 220, life: 1.5, amp: 0.05 * power, thickness: 90, chroma: 0.2, heat: 0.15,
    });
    shake.addAt(0.8 * power, point, camera.position, 2600);
    return touched;
  }

  _updateSwipe(dt) {
    const u = this._swipeT / this._swipeDur;
    // Ease-in: the arm accelerates into the swing.
    const e = u * u * (3 - 2 * u);
    this._tip.lerpVectors(this._swipeFrom, this._swipeTo, e);
    // Arc the path so it scoops through the deck rather than passing flat.
    this._tip.y += Math.sin(e * Math.PI) * 130;

    // Lay the capsule chain back along the swing direction.
    const dir = this._swipeTo.clone().sub(this._swipeFrom).normalize();
    for (let i = 0; i < this.clawCount; i++) {
      const back = i * DISASTER.monster.clawRadius * 1.15;
      this._tmp.copy(this._tip).addScaledVector(dir, -back);
      this._tmp.y += back * 0.42;                       // the arm rises behind the tip
      const r = DISASTER.monster.clawRadius * (1 - i * 0.085);
      this._s.set(r, r * 1.35, r);
      this._m.compose(this._tmp, this._q, this._s);
      this.claw.setMatrixAt(i, this._m);
    }
    this.claw.instanceMatrix.needsUpdate = true;

    // Deliver the blow when the tip crosses the deck plane.
    if (!this._struck && e > 0.42) {
      this._struck = true;
      this.strikeAt(this._swipeTarget, 1.25);
    }

    this._swipeT += dt;
    if (this._swipeT > this._swipeDur) {
      this._swipeT = -1;
      this.claw.visible = false;
    }
  }

  update(dt) {
    if (!this.running) return;
    const cfg = DISASTER.monster;
    const { ocean, particles, shake, camera, physics } = this.ctx;
    this.t += dt;

    if (this._swipeT >= 0) this._updateSwipe(dt);

    // ---- footfalls: an unseen mass walking the seabed ----
    this._footTimer -= dt;
    if (this._footTimer <= 0) {
      this._footTimer = cfg.footstepInterval;
      const fx = -1500 + (this.t * 55) % 3000;
      const fz = 620 * (Math.random() < 0.5 ? -1 : 1);
      this._tmp.set(fx, WORLD.seaLevel, fz);
      particles.waterImpact(this._tmp, 46);
      shake.addAt(0.55, this._tmp, camera.position, 3200);
      // The pressure wave rattles the structure without destroying it.
      physics.applyRadialImpulse(this._tmp, 700, 60, { upBias: 0.6, activateStatic: false });
    }

    // ---- schedule successive swipes along the span ----
    if (this._swipeT < 0 && this.t > 3) {
      const n = Math.floor((this.t - 3) / 4.2);
      if (n !== this._lastSwipe) {
        this._lastSwipe = n;
        const targets = [
          new THREE.Vector3(160, WORLD.deckY, 0),
          new THREE.Vector3(-WORLD.towerX, WORLD.towerHeight * 0.78, 0),
          new THREE.Vector3(520, WORLD.deckY, 0),
          new THREE.Vector3(WORLD.towerX, WORLD.towerHeight * 0.64, 0),
        ];
        if (n < targets.length) this._beginSwipe(targets[n]);
        else { this.running = false; shake.setAmbient(0); }
      }
    }

    shake.setAmbient(Math.min(0.12, 0.03 + this.t * 0.004));
    // Keep the ocean aware of nothing in particular here — footfalls are local.
    void ocean;
  }

  reset() {
    this.running = false;
    this.t = 0;
    this._swipeT = -1;
    this._lastSwipe = undefined;
    this.claw.visible = false;
    this.ctx.shake.setAmbient(0);
  }

  get progress() { return this.running ? THREE.MathUtils.clamp(this.t / 21, 0, 1) : 0; }

  dispose() {
    this._clawGeo.dispose();
    this._clawMat.dispose();
    this.ctx.scene.remove(this.claw);
  }
}
