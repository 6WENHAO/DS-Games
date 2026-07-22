import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { Terrain } from './terrain.js';
import { Environment } from './environment.js';
import { Scatter } from './scatter.js';
import { clamp } from '../core/utils.js';

export class World {
  constructor(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer;
    this.terrain = new Terrain();
    this.env = new Environment(scene, renderer);
    this.scatter = null;
  }

  build() {
    this.env.build();
    const terrainMesh = this.terrain.build();
    this.scene.add(terrainMesh);
    this.scatter = new Scatter(this.scene, this.terrain, this.env);
    this.scatter.build();
    return this;
  }

  getHeight(x, z) {
    return this.terrain.getHeight(x, z);
  }

  get colliders() {
    return this.scatter ? this.scatter.colliders : [];
  }

  get flames() {
    return this.scatter ? this.scatter.flames : [];
  }

  // Push a moving entity out of prop colliders & world boundary. Returns corrected {x, z}.
  resolveCollision(x, z, radius) {
    for (const c of this.colliders) {
      const dx = x - c.x, dz = z - c.z;
      const d = Math.hypot(dx, dz);
      const min = c.r + radius;
      if (d < min && d > 1e-5) {
        const push = (min - d) / d;
        x += dx * push;
        z += dz * push;
      }
    }
    const R = CONFIG.world.boundaryRadius - 2;
    const r = Math.hypot(x, z);
    if (r > R) {
      x = (x / r) * R;
      z = (z / r) * R;
    }
    return { x, z };
  }

  // Keep entity inside arena during boss fight
  clampToArena(x, z, margin = 1.2) {
    const { x: ax, z: az, radius } = CONFIG.arena;
    const dx = x - ax, dz = z - az;
    const d = Math.hypot(dx, dz);
    const max = radius - margin;
    if (d > max) {
      x = ax + (dx / d) * max;
      z = az + (dz / d) * max;
    }
    return { x, z };
  }

  update(dt, focusPos) {
    this.env.update(dt, focusPos);
  }
}
