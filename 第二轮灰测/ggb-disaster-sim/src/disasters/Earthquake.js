import * as THREE from 'three';
import { WORLD, DISASTER } from '../config.js';

/**
 * Earthquake — progressive structural failure, staged the way a suspension
 * bridge actually loses a fight with a M8 event.
 *
 * The timeline is the point. Destruction that happens all at once reads as a
 * glitch; destruction that happens in the right ORDER reads as physics:
 *
 *   0.0 s  low-frequency sway builds (0.31 Hz — near a real tower's first mode)
 *   3.2 s  suspender-cable tension exceeds capacity: strands part one at a time,
 *          from mid-span outward, each one whipping and dumping its load onto
 *          its neighbours
 *   4.6 s  the unsupported deck hinges and peels open from the centre
 *   ~7  s  with the deck load gone, the towers are unbalanced and the tops go
 *
 * Every stage feeds the next through the physics world rather than through a
 * script: released deck chunks really do stop pulling on the cables, because
 * their rigid bodies are no longer static.
 */
export class Earthquake {
  constructor(ctx) {
    this.ctx = ctx;
    this.id = 'earthquake';
    this.label = '强震崩塌 · Seismic';
    this.running = false;
    this.t = 0;
    this._cableTimer = 0;
    this._breakStep = 0;
    this._deckFront = 0;
    this._towersDown = [false, false];
    this._dustTimer = 0;
    this._tmp = new THREE.Vector3();
  }

  trigger() {
    this.running = true;
    this.t = 0;
    this._cableTimer = 0;
    this._breakStep = 0;
    this._deckFront = 0;
    this._towersDown = [false, false];
    this.ctx.shake.setAmbient(0.06);
  }

  update(dt) {
    if (!this.running) return;
    const cfg = DISASTER.earthquake;
    const { bridge, physics, particles, shake, camera } = this.ctx;
    this.t += dt;

    // ---- 1. sway, ramping in over the build-up ----
    const ramp = Math.min(this.t / cfg.buildUp, 1);
    const amp = cfg.swayAmplitude * ramp;
    bridge.sway(amp, cfg.swayFrequency, this.t);
    shake.setAmbient(THREE.MathUtils.clamp(0.05 + ramp * 0.30, 0, 0.42)
                   * (this.t > 14 ? Math.max(0, 1 - (this.t - 14) / 6) : 1));

    // Dust shaken off the tower bases — cheap, and it sells "the ground is moving".
    this._dustTimer -= dt;
    if (this._dustTimer <= 0 && this.t < 12) {
      this._dustTimer = 0.22;
      for (const s of [-1, 1]) {
        this._tmp.set(s * WORLD.towerX + (Math.random() - 0.5) * 40, 8, (Math.random() - 0.5) * 40);
        particles.debrisImpact(this._tmp, 12 * ramp);
      }
    }

    // ---- 2. cables part, mid-span outward, alternating sides ----
    if (this.t > cfg.buildUp) {
      this._cableTimer -= dt;
      if (this._cableTimer <= 0) {
        this._cableTimer = cfg.cableBreakInterval;
        const step = this._breakStep++;
        // Walk outward from mid-span: 0, +1, -1, +2, -2 … in node space.
        const half = Math.floor(step / 2);
        const dir = step % 2 === 0 ? 1 : -1;
        const x = dir * half * 34;
        if (Math.abs(x) < WORLD.towerX - 30) {
          const rope = step % 2;
          const node = bridge.cableNodeAtX(x);
          bridge.cables.breakAt(rope, node, 22, 30 + Math.random() * 22);

          const y = bridge.cableHeightAt(x);
          this._tmp.set(x, y, (rope === 0 ? -1 : 1) * WORLD.towerLegSpread * 0.5);
          // A parting steel cable throws sparks and a puff of paint dust.
          particles.spark.emit({
            origin: this._tmp, direction: new THREE.Vector3(0, 1, 0), speed: 40,
            speedJitter: 0.9, spread: 1.0, count: 26, life: 1.3,
            size0: 0.9, size1: 0.2, drag: 0.35,
          });
          shake.addAt(0.30, this._tmp, camera.position, 1400);
        }
      }
    }

    // ---- 3. the deck peels open from mid-span ----
    if (this.t > cfg.deckReleaseDelay) {
      // Failure front travels outward at ~46 m/s in each direction.
      const front = (this.t - cfg.deckReleaseDelay) * 46;
      if (front > this._deckFront) {
        const x0 = -front, x1 = front;
        const prevX0 = -this._deckFront, prevX1 = this._deckFront;
        this._deckFront = front;

        // Release only the newly exposed rings, not the whole span every frame.
        const release = (a, b) => {
          if (b <= a) return;
          bridge.releaseDeckSpan(a, b, (e, imp) => {
            // Chunks near the hinge get flung; the middle just drops.
            const lean = THREE.MathUtils.clamp(Math.abs(e.x) / 400, 0, 1);
            imp.set(Math.sign(e.x) * 900 * lean, -1500 - Math.random() * 900,
                    (Math.random() - 0.5) * 700);
          });
        };
        release(prevX1, Math.min(x1, WORLD.towerX + 90));
        release(Math.max(x0, -WORLD.towerX - 90), prevX0);

        if (Math.floor(front / 90) !== Math.floor((front - 46 * dt) / 90)) {
          this._tmp.set(THREE.MathUtils.clamp(front, 0, WORLD.towerX), WORLD.deckY, 0);
          shake.addAt(0.42, this._tmp, camera.position, 1600);
        }
      }
    }

    // ---- 4. once the deck load is gone, the tower tops fail ----
    if (this.t > cfg.deckReleaseDelay + 2.4) {
      for (let i = 0; i < 2; i++) {
        if (this._towersDown[i]) continue;
        const sign = i === 0 ? -1 : 1;
        // Stagger the two towers so it does not look symmetrical.
        if (this.t < cfg.deckReleaseDelay + 2.4 + i * 1.7) continue;
        this._towersDown[i] = true;
        const n = bridge.releaseTowerAbove(sign, WORLD.towerHeight * 0.52, -sign * 1800);
        this._tmp.set(sign * WORLD.towerX, WORLD.towerHeight * 0.7, 0);
        particles.debrisImpact(this._tmp, 30);
        shake.addAt(0.85, this._tmp, camera.position, 2600);
        if (n > 0) physics.applyRadialImpulse(this._tmp, 160, 400, { upBias: 0.1 });
      }
    }

    if (this.t > 26) { this.running = false; shake.setAmbient(0); }
  }

  reset() {
    this.running = false;
    this.t = 0;
    this.ctx.shake.setAmbient(0);
  }

  get progress() { return this.running ? Math.min(this.t / 26, 1) : 0; }
}
