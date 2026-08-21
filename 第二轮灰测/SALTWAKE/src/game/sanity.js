/**
 * SALTWAKE — sanity.
 *
 * Sanity falls near horrors you can see, when the focus is fired, and inside the
 * ritual spaces. It recovers slowly once nothing is looking at you.
 *
 * The rule the whole system obeys: **it changes what the player perceives, never
 * what the player controls.** No forced turns, no dropped weapons, no inverted
 * input. What it does instead:
 *
 *   tier 1  the HUD dial starts to drift, and the fog breathes harder
 *   tier 2  whispers arrive from positions where nothing is standing
 *   tier 3  phantom enemy silhouettes appear at the edge of vision and dissolve
 *           when looked at directly; HUD glyphs begin to corrupt
 *   tier 4  the image tears along scanlines, the horizon tips, and sounds play
 *           from the wrong side of the room
 *
 * Every effect is reversible and every one of them is a lie about the world, not
 * a change to it. The player can always tell the difference by shooting.
 */
import * as THREE from 'three';
import { SANITY, PLAYER } from '../core/config.js';
import { textures, SPRITE_IDS } from '../gfx/textures.js';
import { createBillboardMaterial } from '../gfx/materials.js';
import { CELL } from '../world/grid.js';
import { lineOfSight } from '../world/collide.js';

const MAX_PHANTOMS = 6;

export class SanitySystem {
  /** @param {object} ctx { player, world, enemies, audio, hud, stage, scene } */
  constructor(ctx) {
    this.ctx = ctx;
    this.tier = 0;
    this.phantomTimer = 4;
    this.whisperTimer = 8;
    this.ritualZones = [];
    this.distortion = 0;

    /* --- phantoms are billboards, so they cost nothing and read as enemies --- */
    this.material = createBillboardMaterial({ emissive: 0, fogged: 1 });
    const base = new THREE.PlaneGeometry(1, 1);
    base.translate(0, 0.5, 0);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = base.index;
    geo.setAttribute('position', base.getAttribute('position'));
    geo.setAttribute('uv', base.getAttribute('uv'));
    geo.setAttribute('normal', base.getAttribute('normal'));
    this.arrays = {
      aPos: new Float32Array(MAX_PHANTOMS * 3),
      aSize: new Float32Array(MAX_PHANTOMS * 2),
      aRect: new Float32Array(MAX_PHANTOMS * 4),
      aTint: new Float32Array(MAX_PHANTOMS * 3),
      aFlags: new Float32Array(MAX_PHANTOMS * 2),
    };
    this.attrs = {};
    for (const [key, arr] of Object.entries(this.arrays)) {
      const stride = key === 'aPos' || key === 'aTint' ? 3 : key === 'aRect' ? 4 : 2;
      const a = new THREE.InstancedBufferAttribute(arr, stride);
      a.setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute(key, a);
      this.attrs[key] = a;
    }
    geo.instanceCount = 0;
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.matrixAutoUpdate = false;
    this.mesh.name = 'phantoms';
    ctx.scene.add(this.mesh);

    this.phantoms = [];
    for (let i = 0; i < MAX_PHANTOMS; i += 1) {
      this.phantoms.push({ alive: false, x: 0, y: 0, z: 0, life: 0, size: 2.0 });
    }
  }

  /** Zones that drain sanity simply by standing in them. */
  addRitualZone(colMin, rowMin, colMax, rowMax, rate) {
    this.ritualZones.push({ colMin, rowMin, colMax, rowMax, rate });
  }

  get tierFor() {
    const s = this.ctx.player.sanity01;
    const t = SANITY.tiers;
    if (s <= t[3]) return 4;
    if (s <= t[2]) return 3;
    if (s <= t[1]) return 2;
    if (s <= t[0]) return 1;
    return 0;
  }

  spawnPhantom() {
    const { player, world, enemies } = this.ctx;
    const slot = this.phantoms.find((p) => !p.alive);
    if (!slot) return;
    // Place it just inside peripheral vision: visible, but never where the
    // player is already looking.
    for (let attempt = 0; attempt < 18; attempt += 1) {
      const off = (Math.random() < 0.5 ? -1 : 1) * (0.9 + Math.random() * 0.7);
      const a = player.yaw + Math.PI + off;
      const r = 7 + Math.random() * 12;
      const x = player.pos.x + Math.sin(a) * r;
      const z = player.pos.z + Math.cos(a) * r;
      const cell = world.grid.atWorld(x, z);
      if (!cell || !cell.walk || cell.pit) continue;
      if (!lineOfSight(world.grid, player.pos.x, player.eyePosition, player.pos.z,
        x, cell.floorY + 1.2, z, 30)) continue;
      // Never overlap a real enemy: the lie has to be distinguishable.
      let clash = false;
      for (const e of enemies.list) {
        if (e.alive && Math.hypot(e.pos.x - x, e.pos.z - z) < 2.5) { clash = true; break; }
      }
      if (clash) continue;
      slot.alive = true;
      slot.x = x;
      slot.y = cell.floorY;
      slot.z = z;
      slot.life = 2.4 + Math.random() * 2.6;
      slot.size = 1.8 + Math.random() * 0.6;
      return;
    }
  }

  update(dt) {
    const { player, enemies, audio, hud, stage, world } = this.ctx;
    if (!player.alive) return;

    /* --- drain --- */
    let drain = enemies.sanityPressure * (SANITY.proximityDrain / 3.2);
    const col = Math.floor(player.pos.x / CELL);
    const row = Math.floor(player.pos.z / CELL);
    for (const z of this.ritualZones) {
      if (col >= z.colMin && col <= z.colMax && row >= z.rowMin && row <= z.rowMax) drain += z.rate;
    }
    if (drain > 0) player.drainSanity(drain * dt);

    const tier = this.tierFor;
    if (tier > this.tier && audio) {
      // Crossing a threshold downward is announced, once.
      audio.play('reversedVoice', { volume: 0.35 + tier * 0.1 });
    }
    this.tier = tier;

    const s01 = player.sanity01;
    this.distortion = Math.max(0, 1 - s01 / 0.75);

    /* --- phantoms: tier 3 and below --- */
    if (tier >= 3) {
      this.phantomTimer -= dt;
      if (this.phantomTimer <= 0) {
        const range = SANITY.phantomInterval;
        this.phantomTimer = range[1] + (range[0] - range[1]) * s01 + Math.random() * 2;
        this.spawnPhantom();
      }
    }

    /* --- whispers from nowhere: tier 2 and below --- */
    if (tier >= 2 && audio) {
      this.whisperTimer -= dt;
      if (this.whisperTimer <= 0) {
        const range = SANITY.whisperInterval;
        this.whisperTimer = range[1] + (range[0] - range[1]) * s01 + Math.random() * 4;
        // Deliberately misplaced: the sound comes from a spot with nothing in it.
        const a = Math.random() * Math.PI * 2;
        const r = 3 + Math.random() * 6;
        audio.play('sanityWhisper', {
          position: { x: player.pos.x + Math.cos(a) * r, y: player.eyePosition, z: player.pos.z + Math.sin(a) * r },
          volume: 0.5,
        });
      }
    }

    /* --- update phantoms; they dissolve when looked at --- */
    let live = 0;
    for (let i = 0; i < MAX_PHANTOMS; i += 1) {
      const p = this.phantoms[i];
      if (!p.alive) continue;
      p.life -= dt;
      // Looked at directly? Then it was never there.
      const toP = Math.atan2(p.x - player.pos.x, p.z - player.pos.z);
      let rel = toP - (player.yaw + Math.PI);
      while (rel > Math.PI) rel -= Math.PI * 2;
      while (rel < -Math.PI) rel += Math.PI * 2;
      if (Math.abs(rel) < 0.28) p.life = Math.min(p.life, 0.18);
      if (p.life <= 0) { p.alive = false; continue; }

      const rect = textures.sprites.rects;
      const idx = SPRITE_IDS.figure * 4;
      this.arrays.aPos[live * 3] = p.x;
      this.arrays.aPos[live * 3 + 1] = p.y;
      this.arrays.aPos[live * 3 + 2] = p.z;
      this.arrays.aSize[live * 2] = p.size * 0.55;
      this.arrays.aSize[live * 2 + 1] = p.size;
      for (let k = 0; k < 4; k += 1) this.arrays.aRect[live * 4 + k] = rect[idx + k];
      const fade = Math.min(1, p.life / 0.6);
      this.arrays.aTint[live * 3] = 0.7 * fade;
      this.arrays.aTint[live * 3 + 1] = 0.78 * fade;
      this.arrays.aTint[live * 3 + 2] = 0.8 * fade;
      this.arrays.aFlags[live * 2] = 0.01;
      this.arrays.aFlags[live * 2 + 1] = i / MAX_PHANTOMS;
      live += 1;
    }
    this.mesh.geometry.instanceCount = live;
    for (const a of Object.values(this.attrs)) a.needsUpdate = true;

    /* --- push the perceptual state outward --- */
    if (hud) {
      hud.setSanity(s01);
      hud.setDistortion(this.distortion);
    }
    if (stage) stage.setDistortion(this.distortion * 0.85);
    // The fog breathes harder as sanity falls: the world itself feels less fixed.
    if (world && world.material) {
      const u = world.material.uniforms;
      if (u.uFogBreath) u.uFogBreath.value = 0.22 + this.distortion * 0.55;
    }
  }

  dispose() {
    this.ctx.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
