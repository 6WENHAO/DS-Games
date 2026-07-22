import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { assets } from '../core/assets.js';
import { prepareProp } from '../core/materials.js';
import { mulberry32, distToPolyline, clamp, pick } from '../core/utils.js';

// Places all static props, records cylinder colliders, returns points of interest.
export class Scatter {
  constructor(scene, terrain, environment) {
    this.scene = scene;
    this.terrain = terrain;
    this.env = environment;
    this.colliders = [];   // {x, z, r}
    this.templates = new Map();
    this.rng = mulberry32(987654321);
    this.group = new THREE.Group();
    this.group.name = 'scatter';
    this.flames = [];      // positions for fire VFX
  }

  template(name) {
    if (!this.templates.has(name)) {
      const src = assets.prop(name);
      if (!src) return null;
      this.templates.set(name, prepareProp(src.clone(true), name));
    }
    return this.templates.get(name);
  }

  place(name, x, z, { ry = 0, scale = 1, collider = 0, sink = 0.04, yOffset = 0 } = {}) {
    const tpl = this.template(name);
    if (!tpl) return null;
    const obj = tpl.clone(true);
    const y = this.terrain.getHeight(x, z) - sink + yOffset;
    obj.position.set(x, y, z);
    obj.rotation.y = ry;
    obj.scale.setScalar(scale);
    this.group.add(obj);
    if (collider > 0) this.colliders.push({ x, z, r: collider * scale });
    return obj;
  }

  clearance(x, z, r) {
    for (const c of this.colliders) {
      const d = Math.hypot(x - c.x, z - c.z);
      if (d < c.r + r) return false;
    }
    return true;
  }

  onPath(x, z, margin = 2.2) {
    return distToPolyline(x, z, CONFIG.path.points) < CONFIG.path.width + margin;
  }

  inArena(x, z, margin = 4) {
    return Math.hypot(x - CONFIG.arena.x, z - CONFIG.arena.z) < CONFIG.arena.radius + margin;
  }

  nearShrine(x, z, margin = 11) {
    return Math.hypot(x - CONFIG.shrine.x, z - CONFIG.shrine.z) < margin;
  }

  build() {
    this.buildShrine();
    this.buildRoad();
    this.buildArena();
    this.buildForestAndGraves();
    this.buildBoundary();
    this.scene.add(this.group);
    return this;
  }

  // ---- spawn shrine (土地庙) ----
  buildShrine() {
    const { x, z } = CONFIG.shrine;
    const rng = this.rng;
    // temple body sits south of the plaza, entrance faces the road (-z)
    this.place('crypt', x, z + 3.6, { ry: 0, scale: 1.25, collider: 2.6 });
    this.place('statue_head', x, z + 2.2, { ry: 0, scale: 1.5, collider: 0.9 });
    this.place('altar-stone', x, z + 0.8, { ry: Math.PI, scale: 1.1, collider: 1.0 });
    this.place('candle-multiple', x - 0.8, z + 0.55, { scale: 1.2 });
    this.place('candle', x + 0.75, z + 0.7, { scale: 1.3 });
    const l1 = this.place('lantern-candle', x - 2.3, z - 0.6, { scale: 1.35, collider: 0.35 });
    const l2 = this.place('lantern-candle', x + 2.3, z - 0.6, { scale: 1.35, collider: 0.35 });
    if (l1) this.flames.push(new THREE.Vector3(x - 2.3, this.terrain.getHeight(x - 2.3, z - 0.6) + 1.35, z - 0.6));
    if (l2) this.flames.push(new THREE.Vector3(x + 2.3, this.terrain.getHeight(x + 2.3, z - 0.6) + 1.35, z - 0.6));
    this.env.addFlameLight(x - 2.3, this.terrain.getHeight(x - 2.3, z - 0.6) + 1.5, z - 0.6, 0xffa04a, 2.2, 10);
    this.env.addFlameLight(x + 2.3, this.terrain.getHeight(x + 2.3, z - 0.6) + 1.5, z - 0.6, 0xffa04a, 2.2, 10);

    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + 0.3;
      const r = 6.5 + rng() * 1.5;
      const px = x + Math.sin(a) * r, pz = z + Math.cos(a) * r * 0.8 + 1;
      if (Math.abs(a - Math.PI) < 0.85) continue; // gap toward road (-z)
      this.place(pick(['stone-wall', 'stone-wall-damaged']), px, pz, { ry: a + Math.PI / 2, scale: 1.15, collider: 1.0 });
    }
  }

  // ---- pilgrim road decorations ----
  buildRoad() {
    const pts = CONFIG.path.points;
    const rng = this.rng;
    let lanternSide = 1;
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
      const segLen = Math.hypot(bx - ax, bz - az);
      const dirX = (bx - ax) / segLen, dirZ = (bz - az) / segLen;
      const nX = -dirZ, nZ = dirX;
      const steps = Math.floor(segLen / 7);
      for (let s = 0; s <= steps; s++) {
        const t = s / Math.max(steps, 1);
        const cx = ax + (bx - ax) * t;
        const cz = az + (bz - az) * t;
        if (this.inArena(cx, cz, 2) || this.nearShrine(cx, cz, 8)) continue;
        if (rng() < 0.55) {
          const side = lanternSide *= -1;
          const off = CONFIG.path.width * 0.5 + 0.8 + rng() * 0.7;
          const lx = cx + nX * off * side, lz = cz + nZ * off * side;
          if (rng() < 0.42) {
            this.place('lightpost-single', lx, lz, { ry: rng() * 6.28, scale: 1.15, collider: 0.35 });
            const y = this.terrain.getHeight(lx, lz);
            this.flames.push(new THREE.Vector3(lx, y + 2.55, lz));
            this.env.addFlameLight(lx, y + 2.6, lz, 0xffa04a, 1.9, 11);
          } else if (rng() < 0.5) {
            this.place(pick(['gravestone-cross', 'cross-wood', 'urn-round']), lx, lz, { ry: rng() * 6.28, scale: 1 + rng() * 0.3, collider: 0.45 });
          } else {
            this.place(pick(['fence-damaged', 'fence']), lx, lz, { ry: Math.atan2(dirX, dirZ) + Math.PI / 2, scale: 1.1, collider: 0.7 });
          }
        }
      }
    }
  }

  // ---- boss arena ----
  buildArena() {
    const { x, z, radius } = { ...CONFIG.arena, radius: CONFIG.arena.radius };
    this.place('crypt-large', x, z - radius - 4.5, { ry: Math.PI, scale: 2.1, collider: 5.2 });
    this.place('statue_ring', x, z - radius + 0.5, { ry: 0, scale: 2.6, collider: 1.4 });

    const N = 12;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      // gate opening toward road (north, +z)
      if (Math.abs(a - Math.PI / 2) < 0.001) continue;
      const px = x + Math.cos(a) * radius;
      const pz = z + Math.sin(a) * radius;
      const isGateSide = Math.abs(Math.atan2(Math.sin(a) - 1, Math.cos(a))) < 0.5;
      if (Math.sin(a) > 0.86) continue; // north gap
      if (i % 3 === 0) {
        this.place('pillar-obelisk', px, pz, { ry: -a, scale: 1.65, collider: 1.0 });
      } else if (i % 3 === 1) {
        this.place('column-large', px, pz, { ry: -a, scale: 1.5, collider: 0.9 });
      } else {
        this.place('iron-fence', px, pz, { ry: -a + Math.PI / 2, scale: 1.6, collider: 1.1 });
      }
    }
    // gate pillars
    const gx = Math.cos(Math.PI / 2) * radius, gz = Math.sin(Math.PI / 2) * radius;
    this.place('border-pillar', x - 3.4, z + radius, { scale: 1.7, collider: 0.8 });
    this.place('border-pillar', x + 3.4, z + radius, { scale: 1.7, collider: 0.8 });

    // fire baskets
    const fireSpots = [[-radius * 0.55, -radius * 0.5], [radius * 0.55, -radius * 0.5], [-radius * 0.62, radius * 0.35], [radius * 0.62, radius * 0.35]];
    for (const [fx, fz] of fireSpots) {
      this.place('fire-basket', x + fx, z + fz, { scale: 1.35, collider: 0.55 });
      const y = this.terrain.getHeight(x + fx, z + fz);
      this.flames.push(new THREE.Vector3(x + fx, y + 1.1, z + fz));
      this.env.addFlameLight(x + fx, y + 1.35, z + fz, 0xff8a3c, 3.0, 15);
    }

    // scattered bones/coffins inside
    const rng = this.rng;
    for (let i = 0; i < 7; i++) {
      const a = rng() * Math.PI * 2, r = radius * (0.3 + rng() * 0.5);
      const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
      this.place(pick(['debris', 'coffin-old', 'gravestone-broken', 'debris-wood']), px, pz, { ry: rng() * 6.28, scale: 0.95 + rng() * 0.35, collider: 0 });
    }
  }

  // ---- graveyard forest ----
  buildForestAndGraves() {
    const rng = this.rng;
    const R = CONFIG.world.boundaryRadius;

    // dense pines
    for (let i = 0; i < 320; i++) {
      const x = (rng() * 2 - 1) * R;
      const z = (rng() * 2 - 1) * R;
      if (Math.hypot(x, z) > R - 2) continue;
      if (this.onPath(x, z, 2.6) || this.inArena(x, z, 6) || this.nearShrine(x, z, 12)) continue;
      if (!this.clearance(x, z, 1.2)) continue;
      const tree = pick(['pine', 'pine', 'pine-crooked', 'pine-fall', 'pine-fall-crooked']);
      const s = 1.25 + rng() * 1.15;
      this.place(tree, x, z, { ry: rng() * 6.28, scale: s, collider: tree.startsWith('pine-fall') ? 0 : 0.5 });
    }

    // grave clusters
    for (let c = 0; c < 14; c++) {
      const cx = (rng() * 2 - 1) * (R - 18);
      const cz = (rng() * 2 - 1) * (R - 18);
      if (this.onPath(cx, cz, 4) || this.inArena(cx, cz, 8) || this.nearShrine(cx, cz, 14)) continue;
      const count = 3 + Math.floor(rng() * 5);
      const baseRy = rng() * Math.PI * 2;
      for (let i = 0; i < count; i++) {
        const gx = cx + (rng() * 2 - 1) * 5;
        const gz = cz + (rng() * 2 - 1) * 5;
        if (this.onPath(gx, gz, 2) || !this.clearance(gx, gz, 0.7)) continue;
        const g = pick(['gravestone-bevel', 'gravestone-round', 'gravestone-cross', 'gravestone-broken', 'gravestone-wide', 'gravestone-decorative', 'grave', 'cross']);
        this.place(g, gx, gz, { ry: baseRy + (rng() - 0.5) * 0.7, scale: 1 + rng() * 0.35, collider: g === 'grave' ? 0 : 0.5 });
        if (rng() < 0.3) this.place('grave-border', gx, gz + 0.9, { ry: baseRy, scale: 1.05 });
      }
      if (rng() < 0.5) this.place(pick(['crypt', 'coffin', 'coffin-old']), cx, cz, { ry: rng() * 6.28, scale: 1.2, collider: 2.2 });
    }

    // rocks & stumps & bushes & mushrooms
    for (let i = 0; i < 180; i++) {
      const x = (rng() * 2 - 1) * R;
      const z = (rng() * 2 - 1) * R;
      if (Math.hypot(x, z) > R - 3) continue;
      if (this.onPath(x, z, 1.6) || this.inArena(x, z, 5) || this.nearShrine(x, z, 10)) continue;
      if (!this.clearance(x, z, 0.8)) continue;
      const roll = rng();
      if (roll < 0.3) {
        const rock = pick(['rock_largeA', 'rock_largeC', 'rock_largeE', 'rocks', 'rocks-tall', 'rock_tallB', 'rock_tallD']);
        const s = 0.9 + rng() * 1.3;
        this.place(rock, x, z, { ry: rng() * 6.28, scale: s, collider: rock.includes('large') || rock.includes('tall') ? 1.1 : 0.6 });
      } else if (roll < 0.45) {
        this.place(pick(['stump_old', 'stump_round', 'trunk', 'trunk-long', 'debris-wood']), x, z, { ry: rng() * 6.28, scale: 1 + rng() * 0.4, collider: 0.5 });
      } else if (roll < 0.62) {
        this.place(pick(['plant_bush', 'plant_bushDetailed', 'grass_large']), x, z, { ry: rng() * 6.28, scale: 1.1 + rng() * 0.7 });
      } else if (roll < 0.72) {
        this.place(pick(['mushroom_red', 'mushroom_tan']), x, z, { ry: rng() * 6.28, scale: 0.9 + rng() * 0.8 });
      } else {
        this.place(pick(['grass', 'grass_leafs']), x, z, { ry: rng() * 6.28, scale: 1.1 + rng() * 0.8 });
      }
    }

    // ancient ruin accents
    for (let i = 0; i < 10; i++) {
      const x = (rng() * 2 - 1) * (R - 22);
      const z = (rng() * 2 - 1) * (R - 22);
      if (this.onPath(x, z, 3.5) || this.inArena(x, z, 8) || this.nearShrine(x, z, 13)) continue;
      if (!this.clearance(x, z, 1.4)) continue;
      this.place(pick(['statue_obelisk', 'statue_column', 'pillar-square', 'cross-column', 'statue_head']), x, z, { ry: rng() * 6.28, scale: 1.1 + rng() * 0.6, collider: 0.9 });
    }
  }

  // ---- boundary mountains ----
  buildBoundary() {
    const R = CONFIG.world.boundaryRadius;
    const rng = this.rng;
    const N = 34;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2 + rng() * 0.1;
      const r = R + 5 + rng() * 7;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const rock = pick(['cliff_large_rock', 'cliff_block_rock', 'cliff_top_rock']);
      this.place(rock, x, z, { ry: rng() * 6.28, scale: 4.2 + rng() * 3.2, sink: 1.4 });
      if (rng() < 0.8) {
        this.place('pine', x * 0.94, z * 0.94, { ry: rng() * 6.28, scale: 1.7 + rng() * 1.2 });
      }
    }
  }
}
