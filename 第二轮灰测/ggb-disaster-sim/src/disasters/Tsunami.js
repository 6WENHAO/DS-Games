import * as THREE from 'three';
import { WORLD, DISASTER } from '../config.js';

/**
 * Tsunami — a travelling soliton that interacts with the structure.
 *
 * The wave is not a particle effect bolted onto the water; it is a term inside
 * the ocean's displacement function (see ocean.glsl.js / Ocean.sampleHeight),
 * which means:
 *   • the visual wall and the physics front are the same object — the CPU can
 *     ask the ocean how tall the wave is at the tower's X and get the number the
 *     GPU is drawing,
 *   • the crest correctly refracts and foams because it is real surface
 *     geometry, not a sprite,
 *   • debris already in the water rides the wave, because buoyancy is evaluated
 *     against the same displaced surface.
 *
 * Structural interaction is staged by X position, so the north tower is hit
 * first, then the deck, then the south tower — the sequencing a directed shot
 * needs.
 */
export class Tsunami {
  constructor(ctx) {
    this.ctx = ctx;
    this.id = 'tsunami';
    this.label = '海啸巨浪 · Tsunami';
    this.running = false;
    this.t = 0;
    this.frontX = DISASTER.tsunami.startX;
    this._sprayTimer = 0;
    this._hitTower = [false, false];
    this._deckFront = -WORLD.deckLength;
    this._tmp = new THREE.Vector3();
    this._tmp2 = new THREE.Vector3();
  }

  trigger() {
    const cfg = DISASTER.tsunami;
    this.running = true;
    this.t = 0;
    this.frontX = cfg.startX;
    this._hitTower = [false, false];
    this._deckFront = -WORLD.deckLength;
    this.ctx.ocean.setTsunami(this.frontX, 0, cfg.waveLength * 0.45, true);
  }

  update(dt) {
    if (!this.running) return;
    const cfg = DISASTER.tsunami;
    const { ocean, bridge, physics, particles, shake, camera, postfx } = this.ctx;
    this.t += dt;

    // ---- wave state ----
    this.frontX += cfg.speed * dt;
    // The wall rears up as it reaches the shallow strait, then decays inland.
    const shoal = THREE.MathUtils.smoothstep(this.frontX, cfg.startX, -600);
    const decay = 1 - THREE.MathUtils.smoothstep(this.frontX, 1800, 4200) * 0.8;
    const height = cfg.waveHeight * shoal * decay;
    const width = cfg.waveLength * (0.5 - 0.16 * shoal);
    ocean.setTsunami(this.frontX, height, width, true);

    // Low rumble that peaks as the wall passes the camera.
    const near = 1 - THREE.MathUtils.clamp(Math.abs(camera.position.x - this.frontX) / 2200, 0, 1);
    shake.setAmbient(near * near * 0.34 * (height / cfg.waveHeight));

    // ---- spray torn off the crest, only near the camera's region of interest ----
    this._sprayTimer -= dt;
    if (this._sprayTimer <= 0 && height > 8) {
      this._sprayTimer = 0.07;
      const z = camera.position.z + (Math.random() - 0.5) * 900;
      this._tmp.set(this.frontX + width * 0.12, height * 0.92, z);
      particles.waveSpray(this._tmp, 1, THREE.MathUtils.clamp(height / 55, 0.4, 2.2));
    }

    // ---- screen-space refraction as the wall crosses the camera plane ----
    if (!this._distorted && Math.abs(this.frontX - camera.position.x) < 320 && height > 30) {
      this._distorted = true;
      this._tmp.set(this.frontX, height * 0.6, camera.position.z);
      postfx.spawnShockwave(this._tmp, {
        speed: 90, life: 2.6, amp: 0.05, thickness: 220, chroma: 0.16, heat: 0.0, radius0: 40,
      });
    }

    // ---- structural interaction ----
    if (height > 12) {
      // Continuous drag on everything inside the wall.
      physics.applyWaveForce(this.frontX, width * 0.5, height, cfg.impactImpulse);

      // Deck: anything the crest is taller than gets torn off, front-first.
      const reach = this.frontX + width * 0.18;
      if (height > WORLD.deckY - 6 && reach > this._deckFront) {
        const from = Math.max(this._deckFront, -WORLD.deckLength * 0.5);
        const to = Math.min(reach, WORLD.deckLength * 0.5);
        this._deckFront = reach;
        if (to > from) {
          bridge.releaseDeckSpan(from, to, (e, imp) => {
            imp.set(2600 + Math.random() * 1200, 500 + Math.random() * 900,
                    (Math.random() - 0.5) * 900);
          });
        }
      }

      // Towers: the wall shears the legs at waterline height.
      for (let i = 0; i < 2; i++) {
        const sign = i === 0 ? -1 : 1;
        const tx = sign * WORLD.towerX;
        if (this._hitTower[i] || this.frontX < tx - width * 0.2) continue;
        this._hitTower[i] = true;
        const cut = Math.min(height * 0.55, WORLD.towerHeight * 0.6);
        bridge.releaseTowerAbove(sign, cut, 1500);
        this._tmp.set(tx, Math.min(height, 90) * 0.8, 0);
        physics.applyRadialImpulse(this._tmp, 240, 900, { upBias: 0.15 });
        particles.waveSpray(this._tmp, 1, 2.4);
        shake.addAt(0.9, this._tmp, camera.position, 3000);
        // Cables lose their anchor once the tower top goes.
        const node = bridge.cableNodeAtX(tx);
        bridge.cables.breakAt(0, node, 30, 26);
        bridge.cables.breakAt(1, node, 30, 26);
      }
    }

    if (this.frontX > 5200) { this.running = false; shake.setAmbient(0); }
  }

  reset() {
    this.running = false;
    this.t = 0;
    this._distorted = false;
    this.frontX = DISASTER.tsunami.startX;
    this.ctx.ocean.setTsunami(this.frontX, 0, 400, false);
    this.ctx.shake.setAmbient(0);
  }

  get progress() {
    if (!this.running) return 0;
    const cfg = DISASTER.tsunami;
    return THREE.MathUtils.clamp((this.frontX - cfg.startX) / (5200 - cfg.startX), 0, 1);
  }
}
