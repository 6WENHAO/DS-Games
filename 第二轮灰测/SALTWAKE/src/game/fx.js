/**
 * SALTWAKE — effects, projectiles and billboard props.
 *
 * Three instanced systems, each one draw call:
 *
 *   sprites     the level's static vegetation, fires, nets, candles and the
 *               figures standing in the fog. Camera-facing with quantised yaw.
 *   particles   gibs, embers, impact puffs, smoke, shell casings. Also
 *               billboards, so they inherit the same wobble and snapping.
 *   projectiles harpoons, focus lenses, bone shells and cultist spit, drawn as
 *               small oriented meshes because their direction of travel matters.
 *
 * Particles are a fixed-capacity ring buffer with no allocation in the hot path.
 * The oldest particle is recycled when the buffer is full, which is what a 1997
 * engine would have done with a static effect pool.
 */
import * as THREE from 'three';
import { PALETTE, RENDER } from '../core/config.js';
import { createBillboardMaterial, createActorMaterial } from '../gfx/materials.js';
import { textures, SPRITE_IDS } from '../gfx/textures.js';
import { Acc, blob, tube, wedge, facetShade, rng } from '../gfx/models.js';
import { CELL } from '../world/grid.js';
import { raycastWorld } from '../world/collide.js';

const MAX_SPRITES = 1400;
const MAX_PARTICLES = 420;
const MAX_PROJECTILES = 48;

/** Builds an instanced billboard mesh with the attribute layout materials.js expects. */
function makeBillboardMesh(capacity, material, name) {
  const base = new THREE.PlaneGeometry(1, 1);
  base.translate(0, 0.5, 0);            // pivot at the base of the sprite
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = base.index;
  geo.setAttribute('position', base.getAttribute('position'));
  geo.setAttribute('uv', base.getAttribute('uv'));
  geo.setAttribute('normal', base.getAttribute('normal'));

  const arrays = {
    aPos: new Float32Array(capacity * 3),
    aSize: new Float32Array(capacity * 2),
    aRect: new Float32Array(capacity * 4),
    aTint: new Float32Array(capacity * 3),
    aFlags: new Float32Array(capacity * 2),
  };
  const attrs = {};
  for (const [key, arr] of Object.entries(arrays)) {
    const stride = key === 'aPos' || key === 'aTint' ? 3 : key === 'aRect' ? 4 : 2;
    const attr = new THREE.InstancedBufferAttribute(arr, stride);
    attr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute(key, attr);
    attrs[key] = attr;
  }
  geo.instanceCount = 0;
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 1e4);
  const mesh = new THREE.Mesh(geo, material);
  mesh.name = name;
  mesh.frustumCulled = false;
  mesh.matrixAutoUpdate = false;
  return { mesh, geo, arrays, attrs };
}

const spriteRect = (id) => {
  const r = textures.sprites.rects;
  const i = (SPRITE_IDS[id] !== undefined ? SPRITE_IDS[id] : 0) * 4;
  return [r[i], r[i + 1], r[i + 2], r[i + 3]];
};

export class Fx {
  /** @param {object} ctx { scene, world, player, enemies, audio, lights } */
  constructor(ctx) {
    this.ctx = ctx;

    /* --- static sprite field --- */
    this.spriteMat = createBillboardMaterial({ emissive: 0, fogged: 1 });
    this.sprites = makeBillboardMesh(MAX_SPRITES, this.spriteMat, 'sprites');
    this.spriteCount = 0;
    ctx.scene.add(this.sprites.mesh);

    /* --- emissive sprite field: fire and light sources ignore scene light --- */
    this.fireMat = createBillboardMaterial({ emissive: 1, fogged: 0.35, wobble: RENDER.billboardWobble * 1.7 });
    this.fires = makeBillboardMesh(220, this.fireMat, 'fires');
    this.fireCount = 0;
    ctx.scene.add(this.fires.mesh);

    /* --- particles --- */
    this.partMat = createBillboardMaterial({ emissive: 0.35, fogged: 0.8 });
    this.particles = makeBillboardMesh(MAX_PARTICLES, this.partMat, 'particles');
    ctx.scene.add(this.particles.mesh);
    this.pool = [];
    for (let i = 0; i < MAX_PARTICLES; i += 1) {
      this.pool.push({
        alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0,
        life: 0, maxLife: 1, size: 0.2, sprite: 'smoke', gravity: 1,
        tint: new THREE.Color(1, 1, 1), spin: 0, bounce: 0,
      });
    }
    this.nextParticle = 0;

    /* --- projectiles --- */
    this.projMat = createActorMaterial({});
    this.projGeo = {
      harpoon: this.buildHarpoonGeo(),
      lens: this.buildLensGeo(),
      boneShell: this.buildShellGeo(),
      spit: this.buildSpitGeo(),
    };
    this.projectiles = [];
    for (let i = 0; i < MAX_PROJECTILES; i += 1) {
      this.projectiles.push({ alive: false, mesh: null, kind: null });
    }
    this.projGroup = new THREE.Group();
    ctx.scene.add(this.projGroup);

    /* --- flame cone: a short-lived emissive sprite burst --- */
    this.flameCooldown = 0;
    this.beams = [];
    this.shockwaves = [];
  }

  /* ------------------------------------------------------------ geometry */

  buildHarpoonGeo() {
    const acc = new Acc();
    const r = rng(3);
    acc.add(tube(0.9, 0.018, 0.016, 4), new THREE.Matrix4().makeRotationX(Math.PI / 2)
      .setPosition(0, 0, -0.45), facetShade(new THREE.Color('#5a6266'), 0.4));
    acc.add(wedge(0.06, 0.16, 0.04), new THREE.Matrix4().makeRotationX(-Math.PI / 2)
      .setPosition(0, 0, -0.95), facetShade(new THREE.Color(PALETTE.bone)));
    return acc.build();
  }

  buildLensGeo() {
    const acc = new Acc();
    const r = rng(5);
    acc.add(blob(0.16, 1, 0.12, r), new THREE.Matrix4().makeScale(1, 1, 0.4),
      facetShade(new THREE.Color('#9fe08a'), 0.12));
    return acc.build();
  }

  buildShellGeo() {
    const acc = new Acc();
    const r = rng(7);
    acc.add(blob(0.15, 0, 0.2, r), new THREE.Matrix4().makeScale(0.8, 0.8, 1.5),
      facetShade(new THREE.Color(PALETTE.bone), 0.3));
    return acc.build();
  }

  buildSpitGeo() {
    const acc = new Acc();
    const r = rng(13);
    acc.add(blob(0.12, 0, 0.35, r), new THREE.Matrix4(),
      facetShade(new THREE.Color(PALETTE.ichor), 0.18));
    return acc.build();
  }

  /* ------------------------------------------------------------ static props */

  /**
   * Adds a static billboard. `emissive` routes it to the fire field.
   * @param {string} sprite one of the SPRITE_IDS keys
   */
  addSprite(sprite, x, y, z, width, height, { tint = null, sway = 0, emissive = false } = {}) {
    const target = emissive ? this.fires : this.sprites;
    const cap = emissive ? 220 : MAX_SPRITES;
    const i = emissive ? this.fireCount : this.spriteCount;
    if (i >= cap) return false;
    const rect = spriteRect(sprite);
    target.arrays.aPos[i * 3] = x;
    target.arrays.aPos[i * 3 + 1] = y;
    target.arrays.aPos[i * 3 + 2] = z;
    target.arrays.aSize[i * 2] = width;
    target.arrays.aSize[i * 2 + 1] = height;
    for (let k = 0; k < 4; k += 1) target.arrays.aRect[i * 4 + k] = rect[k];
    const c = tint || { r: 1, g: 1, b: 1 };
    target.arrays.aTint[i * 3] = c.r;
    target.arrays.aTint[i * 3 + 1] = c.g;
    target.arrays.aTint[i * 3 + 2] = c.b;
    target.arrays.aFlags[i * 2] = sway;
    target.arrays.aFlags[i * 2 + 1] = Math.random();
    if (emissive) this.fireCount += 1; else this.spriteCount += 1;
    return true;
  }

  /** Call once after all static sprites are placed. */
  commitSprites() {
    this.sprites.geo.instanceCount = this.spriteCount;
    this.fires.geo.instanceCount = this.fireCount;
    for (const a of Object.values(this.sprites.attrs)) a.needsUpdate = true;
    for (const a of Object.values(this.fires.attrs)) a.needsUpdate = true;
  }

  /**
   * Scatters the level's decorative sprites: weed along wall bases, reeds in
   * water, nets on the docks, candles and fires where the lights say so.
   */
  populate(world, level) {
    const grid = world.grid;
    const r = rng(0x51a17);
    grid.forEach((cell, col, row) => {
      if (!cell.walk || cell.door) return;
      const x0 = col * CELL;
      const z0 = row * CELL;
      // Wall-adjacent tufts: three or four per cell edge that touches solid.
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nb = grid.get(col + dc, row + dr);
        if (nb && nb.walk) continue;
        const count = cell.water ? 3 : 2;
        for (let k = 0; k < count; k += 1) {
          if (r() > (cell.district === 'ruins' || cell.district === 'rift' ? 0.25 : 0.62)) continue;
          const t = 0.15 + r() * 0.7;
          const off = 0.28 + r() * 0.16;
          const x = x0 + (dc !== 0 ? (dc > 0 ? CELL - off : off) : t * CELL);
          const z = z0 + (dr !== 0 ? (dr > 0 ? CELL - off : off) : t * CELL);
          const sprite = cell.water ? 'reeds'
            : cell.district === 'victorian' || cell.district === 'docks'
              ? (r() > 0.5 ? 'weeds' : 'seagrass') : 'seagrass';
          const h = (cell.water ? 1.5 : 0.75) * (0.6 + r() * 0.7);
          this.addSprite(sprite, x, cell.floorY - 0.05, z, h * 0.75, h, {
            sway: 0.05 + r() * 0.09,
            tint: new THREE.Color(0.75 + r() * 0.4, 0.8 + r() * 0.3, 0.7 + r() * 0.3),
          });
        }
      }
      // Hanging nets on the docks.
      if (cell.district === 'docks' && r() > 0.94) {
        this.addSprite('net', x0 + CELL * 0.5, cell.ceilY - 2.2, z0 + CELL * 0.5, 2.2, 2.2, { sway: 0.03 });
      }
    });

    // Fires and candles come from the level's own light list, so they always agree.
    for (const light of world.lights) {
      if (light.kind === 'flame') {
        this.addSprite('flame', light.x, light.y - 0.5, light.z, 1.0, 1.5, { emissive: true, sway: 0.02 });
      } else if (light.kind === 'candle' || light.kind === 'ritual') {
        this.addSprite('candle', light.x, light.y - 0.55, light.z, 0.35, 0.7, { emissive: true });
      }
    }

    // Figures in the fog: placed by the level, never hostile, never explained.
    for (const ent of level.entities || []) {
      if (ent.type !== 'figure') continue;
      const cell = grid.get(ent.col, ent.row);
      if (!cell) continue;
      const c = grid.centreOf(ent.col, ent.row);
      this.addSprite('figure', c.x, cell.floorY, c.z, 1.1, 2.0, {
        tint: new THREE.Color(0.8, 0.85, 0.85),
      });
    }
    this.commitSprites();
    return { sprites: this.spriteCount, fires: this.fireCount };
  }

  /* ------------------------------------------------------------ particles */

  emit(sprite, x, y, z, vx, vy, vz, life, size, opts = {}) {
    const p = this.pool[this.nextParticle];
    this.nextParticle = (this.nextParticle + 1) % MAX_PARTICLES;
    p.alive = true;
    p.x = x; p.y = y; p.z = z;
    p.vx = vx; p.vy = vy; p.vz = vz;
    p.life = life; p.maxLife = life;
    p.size = size;
    p.sprite = sprite;
    p.gravity = opts.gravity === undefined ? 1 : opts.gravity;
    p.bounce = opts.bounce || 0;
    p.gib = !!opts.gib;
    p.emissive = !!opts.emissive;
    if (opts.tint) p.tint.copy(opts.tint); else p.tint.setRGB(1, 1, 1);
    return p;
  }

  spawnGibs(x, y, z, count, dir, force = 1) {
    for (let i = 0; i < count; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const up = 2.2 + Math.random() * 3.4 * force;
      const out = (1.4 + Math.random() * 2.8) * force;
      this.emit('smoke', x, y, z,
        Math.cos(a) * out + (dir ? dir.x * 2.2 * force : 0),
        up,
        Math.sin(a) * out + (dir ? dir.z * 2.2 * force : 0),
        1.4 + Math.random() * 1.0, 0.18 + Math.random() * 0.10,
        { gib: true, bounce: 0.3, tint: new THREE.Color('#7a1f14') });
    }
    // A short dark spray that reads as impact rather than fluid.
    for (let i = 0; i < 5; i += 1) {
      const a = Math.random() * Math.PI * 2;
      this.emit('smoke', x, y, z, Math.cos(a) * 1.5, 1.2 + Math.random(), Math.sin(a) * 1.5,
        0.5, 0.22, { gravity: 0.4, tint: new THREE.Color('#3a0f0a') });
    }
  }

  spawnImpact(x, y, z, kind, dir, wall) {
    const nx = wall ? wall.nx : (dir ? -dir.x : 0);
    const ny = wall ? wall.ny : (dir ? -dir.y : 1);
    const nz = wall ? wall.nz : (dir ? -dir.z : 0);
    const tint = kind === 'flesh' ? new THREE.Color('#6d1a12')
      : kind === 'armor' ? new THREE.Color('#c9a24a')
        : new THREE.Color('#6b6455');
    const n = kind === 'flesh' ? 4 : 3;
    for (let i = 0; i < n; i += 1) {
      this.emit('smoke', x + nx * 0.05, y + ny * 0.05, z + nz * 0.05,
        nx * 1.6 + (Math.random() - 0.5) * 1.8,
        ny * 1.6 + Math.random() * 1.6,
        nz * 1.6 + (Math.random() - 0.5) * 1.8,
        0.28 + Math.random() * 0.18, 0.10 + Math.random() * 0.08,
        { gravity: 0.7, tint });
    }
    if (this.ctx.audio && kind === 'stone') {
      this.ctx.audio.play('harpoonHitStone', { position: { x, y, z }, volume: 0.28 });
    }
  }

  spawnEmber(x, y, z) {
    this.emit('flame', x + (Math.random() - 0.5) * 0.3, y, z + (Math.random() - 0.5) * 0.3,
      (Math.random() - 0.5) * 0.6, 1.4 + Math.random(), (Math.random() - 0.5) * 0.6,
      0.5, 0.14, { gravity: -0.3, emissive: true });
  }

  /** The flamethrower cone: a burst of emissive sprites along the aim line. */
  spawnFlame(origin, dir, range) {
    for (let i = 0; i < 3; i += 1) {
      const t = 0.5 + Math.random() * range * 0.85;
      const spread = 0.18 * (t / range);
      this.emit('flame',
        origin.x + dir.x * t + (Math.random() - 0.5) * spread * 4,
        origin.y + dir.y * t + (Math.random() - 0.5) * spread * 3,
        origin.z + dir.z * t + (Math.random() - 0.5) * spread * 4,
        dir.x * 5 + (Math.random() - 0.5) * 2,
        dir.y * 5 + 1.2,
        dir.z * 5 + (Math.random() - 0.5) * 2,
        0.26 + Math.random() * 0.16, 0.6 + Math.random() * 0.5,
        { gravity: -0.5, emissive: true });
    }
    if (this.ctx.lights) {
      this.ctx.lights.add(
        { x: origin.x + dir.x * 2.5, y: origin.y + dir.y * 2.5, z: origin.z + dir.z * 2.5 },
        8.0, '#ff9a3c', 1.6,
      );
    }
  }

  spawnBlink(x, y, z) {
    for (let i = 0; i < 10; i += 1) {
      const a = Math.random() * Math.PI * 2;
      this.emit('smoke', x, y, z, Math.cos(a) * 2.4, (Math.random() - 0.3) * 2.4, Math.sin(a) * 2.4,
        0.4, 0.28, { gravity: 0, tint: new THREE.Color('#2a3a30'), emissive: true });
    }
  }

  spawnShockwave(x, y, z, radius) {
    this.shockwaves.push({ x, y, z, radius, t: 0 });
    for (let i = 0; i < 18; i += 1) {
      const a = (i / 18) * Math.PI * 2;
      this.emit('smoke', x + Math.cos(a) * 1.2, y + 0.2, z + Math.sin(a) * 1.2,
        Math.cos(a) * 9, 1.4, Math.sin(a) * 9,
        0.7, 0.6, { gravity: 0.5, tint: new THREE.Color('#4a4136') });
    }
  }

  spawnBeam(from, dir, range, time) {
    this.beams.push({
      x: from.x, y: from.y, z: from.z, dx: dir.x, dy: dir.y, dz: dir.z, range, t: 0, life: time,
    });
  }

  /* ------------------------------------------------------------ projectiles */

  spawnProjectile(spec) {
    let slot = this.projectiles.find((p) => !p.alive);
    if (!slot) slot = this.projectiles[0];
    if (!slot.mesh || slot.kind !== spec.kind) {
      if (slot.mesh) this.projGroup.remove(slot.mesh);
      slot.mesh = new THREE.Mesh(this.projGeo[spec.kind] || this.projGeo.spit, this.projMat);
      slot.mesh.frustumCulled = false;
      slot.kind = spec.kind;
      this.projGroup.add(slot.mesh);
    }
    slot.alive = true;
    slot.mesh.visible = true;
    Object.assign(slot, spec);
    slot.life = 5.0;
    slot.travelled = 0;
    slot.mesh.position.set(spec.x, spec.y, spec.z);
    return slot;
  }

  /* ------------------------------------------------------------ frame */

  update(dt, time) {
    const { world, player, enemies, lights, audio } = this.ctx;

    /* --- particles --- */
    const arrays = this.particles.arrays;
    let live = 0;
    for (let i = 0; i < MAX_PARTICLES; i += 1) {
      const p = this.pool[i];
      if (!p.alive) continue;
      p.life -= dt;
      if (p.life <= 0) { p.alive = false; continue; }
      p.vy -= 20 * p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      // Cheap floor bounce so gibs settle instead of sinking.
      const cell = world.grid.atWorld(p.x, p.z);
      if (cell && p.y < cell.floorY + 0.03) {
        p.y = cell.floorY + 0.03;
        if (p.bounce > 0 && Math.abs(p.vy) > 1.2) {
          p.vy = -p.vy * p.bounce;
          p.vx *= 0.5; p.vz *= 0.5;
        } else {
          p.vx *= 0.82; p.vz *= 0.82; p.vy = 0;
        }
      }
      if (live < MAX_PARTICLES) {
        const fade = Math.min(1, p.life / (p.maxLife * 0.5));
        const rect = spriteRect(p.sprite);
        arrays.aPos[live * 3] = p.x;
        arrays.aPos[live * 3 + 1] = p.y;
        arrays.aPos[live * 3 + 2] = p.z;
        const s = p.size * (p.sprite === 'smoke' && !p.gib ? (2 - fade) : 1);
        arrays.aSize[live * 2] = s;
        arrays.aSize[live * 2 + 1] = s;
        for (let k = 0; k < 4; k += 1) arrays.aRect[live * 4 + k] = rect[k];
        arrays.aTint[live * 3] = p.tint.r * fade;
        arrays.aTint[live * 3 + 1] = p.tint.g * fade;
        arrays.aTint[live * 3 + 2] = p.tint.b * fade;
        arrays.aFlags[live * 2] = 0;
        arrays.aFlags[live * 2 + 1] = i / MAX_PARTICLES;
        live += 1;
      }
    }
    this.particles.geo.instanceCount = live;
    for (const a of Object.values(this.particles.attrs)) a.needsUpdate = true;

    /* --- projectiles --- */
    for (const p of this.projectiles) {
      if (!p.alive) continue;
      p.life -= dt;
      const stepX = p.vx * dt;
      const stepY = p.vy * dt;
      const stepZ = p.vz * dt;
      const stepLen = Math.hypot(stepX, stepY, stepZ);
      p.travelled += stepLen;
      if (p.kind === 'boneShell' || p.kind === 'spit') p.vy -= 9.5 * dt;

      // Enemies first, then the world.
      const dir = _tmpDir.set(p.vx, p.vy, p.vz).normalize();
      const origin = _tmpOrigin.set(p.x, p.y, p.z);
      let consumed = false;

      if (p.owner === 'player') {
        const hit = enemies.raycast(origin, dir, stepLen + 0.35);
        if (hit) {
          const kindName = p.kind === 'harpoon' ? 'harpoon' : p.kind === 'lens' ? 'focus' : 'splash';
          enemies.damage(hit.enemy, p.damage, kindName, hit.point, dir);
          if (p.pinDamage && hit.enemy.alive) {
            // Pinning: if there is a wall right behind, it takes extra.
            const behind = raycastWorld(world.grid, hit.point.x, hit.point.y, hit.point.z,
              dir.x, dir.y, dir.z, 1.6);
            if (behind) enemies.damage(hit.enemy, p.pinDamage, 'harpoon', hit.point, dir);
          }
          if (p.splashRadius > 0) this.explode(p, hit.point.x, hit.point.y, hit.point.z);
          if (audio) {
            audio.play(p.kind === 'harpoon' ? 'harpoonHitFlesh' : 'focusRelease',
              { position: hit.point, volume: 0.7 });
          }
          this.spawnImpact(hit.point.x, hit.point.y, hit.point.z, 'flesh', dir);
          if (!p.piercing) consumed = true;
        }
      } else {
        // Enemy projectile against the player.
        const d = Math.hypot(player.pos.x - p.x, player.eyePosition - p.y, player.pos.z - p.z);
        if (d < 0.75) {
          const rel = Math.atan2(p.x - player.pos.x, p.z - player.pos.z) - (player.yaw + Math.PI);
          player.damage(p.damage, rel, 'spit');
          this.spawnImpact(p.x, p.y, p.z, 'flesh', dir);
          consumed = true;
        }
      }

      if (!consumed && !p.piercing) {
        const wall = raycastWorld(world.grid, p.x, p.y, p.z, dir.x, dir.y, dir.z, stepLen + 0.2);
        if (wall) {
          if (p.splashRadius > 0) this.explode(p, wall.x, wall.y, wall.z);
          else this.spawnImpact(wall.x, wall.y, wall.z, 'stone', dir, wall);
          consumed = true;
        }
      } else if (p.piercing) {
        // The focus lens passes through geometry; it only dies on distance.
        if (p.travelled > 60) consumed = true;
      }

      if (consumed || p.life <= 0) {
        p.alive = false;
        p.mesh.visible = false;
        continue;
      }
      p.x += stepX; p.y += stepY; p.z += stepZ;
      p.mesh.position.set(p.x, p.y, p.z);
      p.mesh.lookAt(p.x + p.vx, p.y + p.vy, p.z + p.vz);
      if (p.kind === 'lens' && lights) lights.add(p.mesh.position, 7, '#9fe08a', 1.2);
      if (p.kind === 'boneShell' && lights) lights.add(p.mesh.position, 4, '#ffe0a0', 0.5);
    }

    /* --- beams and shockwaves are short-lived light events --- */
    for (let i = this.beams.length - 1; i >= 0; i -= 1) {
      const b = this.beams[i];
      b.t += dt;
      if (b.t > b.life) { this.beams.splice(i, 1); continue; }
      const n = 7;
      for (let k = 0; k < n; k += 1) {
        const t = (k / n) * b.range * 0.6;
        if (Math.random() > 0.5) continue;
        this.emit('flame', b.x + b.dx * t, b.y + b.dy * t, b.z + b.dz * t,
          0, 0.4, 0, 0.12, 0.34, { gravity: 0, emissive: true, tint: new THREE.Color('#9fe08a') });
      }
      if (lights) lights.add({ x: b.x, y: b.y, z: b.z }, 9, '#9fe08a', 1.4);
    }
    for (let i = this.shockwaves.length - 1; i >= 0; i -= 1) {
      const s = this.shockwaves[i];
      s.t += dt;
      if (s.t > 0.5) { this.shockwaves.splice(i, 1); continue; }
      if (lights) lights.add({ x: s.x, y: s.y + 1, z: s.z }, s.radius * 1.4, '#ffb060', 2.2 * (1 - s.t / 0.5));
    }
  }

  explode(p, x, y, z) {
    const { enemies, audio, lights } = this.ctx;
    const hits = enemies.radiusQuery(x, y, z, p.splashRadius);
    for (const h of hits) {
      const falloff = 1 - h.dist / p.splashRadius;
      enemies.damage(h.enemy, p.splashDamage * falloff, 'splash', null, null);
    }
    for (let i = 0; i < 14; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const sp = 4 + Math.random() * 7;
      this.emit('smoke', x, y, z, Math.cos(a) * sp, Math.random() * 5, Math.sin(a) * sp,
        0.6 + Math.random() * 0.4, 0.5, { gravity: 0.6, tint: new THREE.Color('#5a4a36') });
    }
    for (let i = 0; i < 8; i += 1) {
      this.emit('flame', x, y, z, (Math.random() - 0.5) * 5, Math.random() * 4, (Math.random() - 0.5) * 5,
        0.3, 0.8, { gravity: -0.2, emissive: true });
    }
    if (lights) lights.add({ x, y: y + 0.5, z }, 14, '#ffcc70', 4.0);
    if (audio) audio.play('distantBoom', { position: { x, y, z }, volume: 0.8 });
    this.shockwaves.push({ x, y, z, radius: p.splashRadius, t: 0 });
  }

  dispose() {
    for (const key of ['sprites', 'fires', 'particles']) {
      const s = this[key];
      this.ctx.scene.remove(s.mesh);
      s.geo.dispose();
    }
    this.spriteMat.dispose();
    this.fireMat.dispose();
    this.partMat.dispose();
    this.projMat.dispose();
  }
}

const _tmpDir = new THREE.Vector3();
const _tmpOrigin = new THREE.Vector3();
