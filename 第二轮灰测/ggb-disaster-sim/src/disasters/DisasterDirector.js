import { Earthquake } from './Earthquake.js';
import { Tsunami } from './Tsunami.js';
import { Meteor } from './Meteor.js';
import { Monster } from './Monster.js';

/**
 * DisasterDirector — the scheduler. Modules never talk to each other; they only
 * touch the shared context (bridge / physics / ocean / particles / postfx), so
 * combinations compose without special cases.
 *
 * `ctx` is the single dependency-injection surface for every disaster:
 *   { scene, camera, bridge, ocean, physics, particles, shake, postfx, sky }
 */
export class DisasterDirector {
  constructor(ctx) {
    this.ctx = ctx;
    this.modules = {
      earthquake: new Earthquake(ctx),
      tsunami: new Tsunami(ctx),
      meteor: new Meteor(ctx),
      monster: new Monster(ctx),
    };
    /** @type {string|null} */
    this.activeId = null;
    this.elapsed = 0;
  }

  get active() { return this.activeId ? this.modules[this.activeId] : null; }
  get list() { return Object.values(this.modules).map((m) => ({ id: m.id, label: m.label })); }

  /**
   * Fire a disaster. Triggering while one runs layers the new one on top —
   * a meteor during an earthquake is a legitimate (and excellent) shot.
   */
  trigger(id, opts) {
    const m = this.modules[id];
    if (!m) return false;
    this.activeId = id;
    this.elapsed = 0;
    m.trigger(opts);
    return true;
  }

  /** Aimable strike — routed to the monster module's public damage API. */
  strikeAt(point, power = 1) {
    return this.modules.monster.strikeAt(point, power);
  }

  update(dt) {
    this.elapsed += dt;
    for (const m of Object.values(this.modules)) {
      if (m.running) m.update(dt);
    }
  }

  /** Full restore: pristine bridge, calm sea, no debris, no trauma. */
  reset() {
    for (const m of Object.values(this.modules)) m.reset();
    this.activeId = null;
    this.elapsed = 0;
    this.ctx.physics.reset();
    this.ctx.bridge.reset();
    this.ctx.particles.clear();
    this.ctx.shake.reset();
    this.ctx.postfx.waves.length = 0;
    this.ctx.ocean.setTsunami(-5200, 0, 400, false);
  }

  get status() {
    const running = Object.values(this.modules).filter((m) => m.running);
    return {
      active: running.map((m) => m.id),
      progress: running.length ? Math.max(...running.map((m) => m.progress)) : 0,
    };
  }

  dispose() {
    for (const m of Object.values(this.modules)) if (m.dispose) m.dispose();
  }
}
