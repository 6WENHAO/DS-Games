import * as THREE from 'three';
import { AudioEngine } from './audio/audio';
import type { Engine } from './core/engine';
import { clamp } from './core/rng';
import { LightningSystem } from './fx/bolts';
import { ChunkSystem } from './fx/chunks';
import { DebrisSystem } from './fx/debris';
import { DecalSystem } from './fx/decals';
import { FieldSet } from './fx/fields';
import { ParticleSystem } from './fx/particles';
import { ScreenFx } from './fx/screen';
import { ShockwaveSystem } from './fx/shockwave';
import { City, generateCity } from './world/city';
import { BLOCK, BLOCKS, CITY_HALF, blockMin } from './world/layout';
import { Crowd } from './world/crowd';
import { Sky } from './world/sky';
import { Terrain } from './world/terrain';
import { Traffic } from './world/traffic';
import type { Threat } from './world/traffic';
import { VoxelField, swayUniforms } from './world/voxels';
import { Water } from './world/water';

const SCRATCH_IDS = new Int32Array(60000);

export interface BlastParams {
  radius: number;
  force: number;
  debris: number;
  scorch: number;
  up: number;
  jagged: number;
}

/**
 * The live sandbox: owns every world + fx system and exposes the high level
 * destruction primitives the disasters are built from.
 */
export class Sandbox {
  readonly field: VoxelField;
  readonly city: City;
  readonly terrain: Terrain;
  readonly sky: Sky;
  readonly water = new Water();
  readonly traffic: Traffic;
  readonly crowd: Crowd;
  readonly debris: DebrisSystem;
  readonly chunks: ChunkSystem;
  readonly sparks: ParticleSystem;
  readonly smoke: ParticleSystem;
  readonly shock = new ShockwaveSystem();
  readonly decals = new DecalSystem();
  readonly bolts = new LightningSystem();
  readonly screen: ScreenFx;
  readonly fields = new FieldSet();
  readonly audio = new AudioEngine();
  readonly threats: Threat[] = [];

  /** UI power slider, 0.35 .. 2.2 */
  power = 1;
  /** Raised by the earthquake so buildings fail more eagerly. */
  stress = 0;
  private burning: Array<{ x: number; y: number; z: number; t: number; r: number; rate: number }> = [];
  private col = new THREE.Color();
  private parkKeys = new Set<string>(['1,4', '4,1', '0,2']);

  constructor(readonly engine: Engine) {
    const q = engine.quality;
    const data = generateCity();
    this.field = new VoxelField(data.builder);
    this.city = new City(this.field, data.buildings);
    this.terrain = new Terrain(this.parkKeys);
    this.sky = new Sky(engine.scene, q.cloudCount);
    this.debris = new DebrisSystem(q.debrisCap);
    this.sparks = new ParticleSystem(q.sparkCap, true);
    this.smoke = new ParticleSystem(q.smokeCap, false);
    this.traffic = new Traffic(q.carCount);
    this.crowd = new Crowd(q.pedCount);
    this.screen = new ScreenFx(engine.camera, engine.grade);

    this.chunks = new ChunkSystem(
      q.chunkCap,
      this.field,
      this.debris,
      (id) => this.killVoxel(id),
      {
        onLand: (x, y, z, power, reach) => {
          this.screen.shake(0.16 + power * 0.4);
          this.audio.crumble();
          this.audio.impact(0.9);
          this.dust(x, y, z, 26, reach * 0.45, 1.5);
          this.crowd.panic(x, z, reach + 12);
          this.crowd.toss(x, z, reach * 0.6, 0.5);
          this.decals.scorch(x, z, Math.max(4, reach * 0.4), 0.5);
          this.damageSphere(x, 1.2, z, Math.max(3, reach * 0.22), {
            radius: 0,
            force: 8,
            debris: 14,
            scorch: 0.25,
            up: 0.4,
            jagged: 0.3,
          });
        },
        onDust: (x, y, z, amount, spread) => this.dust(x, y, z, amount, spread, 1),
      },
      () => engine.quality.eventDebris,
    );

    this.debris.onImpact = (x, y, z, p) => {
      this.audio.impact(p);
      if (Math.random() < 0.5) this.dust(x, y, z, 2, 1.2, 0.7);
    };
    this.traffic.onWreck = (x, y, z) => {
      this.fire(x, y, z, 16, 7, 0.9);
      this.sparkBurst(x, y, z, 18, 12, 0xffc46b);
      this.smokeColumn(x, y, z, 10, 3, 2.4);
      this.audio.explosion(0.5);
      this.screen.shake(0.08);
    };

    const scene = engine.scene;
    scene.add(this.terrain.group);
    scene.add(this.field.mesh);
    scene.add(this.chunks.mesh);
    scene.add(this.debris.mesh);
    scene.add(this.traffic.mesh);
    scene.add(this.crowd.mesh);
    scene.add(this.decals.group);
    scene.add(this.shock.group);
    scene.add(this.bolts.group);
    scene.add(this.smoke.points);
    scene.add(this.sparks.points);
    scene.add(this.water.mesh);

    this.configureShadows();
    this.traffic.populate();
    this.crowd.populate();
  }

  private configureShadows(): void {
    const q = this.engine.quality;
    const sun = this.sky.sun;
    sun.castShadow = q.shadows;
    if (!q.shadows) return;
    sun.shadow.mapSize.set(q.shadowSize, q.shadowSize);
    const cam = sun.shadow.camera;
    const r = CITY_HALF + 34;
    cam.left = -r;
    cam.right = r;
    cam.top = r;
    cam.bottom = -r;
    cam.near = 1;
    cam.far = 420;
    cam.updateProjectionMatrix();
    sun.shadow.bias = -0.0009;
    sun.shadow.normalBias = 0.35;
  }

  // ------------------------------------------------------------------ counters
  get voxelCount(): number {
    return this.field.count + this.chunks.count;
  }

  get debrisCount(): number {
    return this.debris.count + this.chunks.count;
  }

  get particleCount(): number {
    return this.sparks.count + this.smoke.count;
  }

  // ------------------------------------------------------------------ ops
  killVoxel(id: number): void {
    if (this.field.kill(id)) this.city.notifyKilled(id);
  }

  addThreat(x: number, z: number, radius: number, power: number): Threat {
    const t: Threat = { x, z, radius, power };
    this.threats.push(t);
    return t;
  }

  removeThreat(t: Threat): void {
    const i = this.threats.indexOf(t);
    if (i >= 0) this.threats.splice(i, 1);
  }

  /**
   * The core destruction primitive: hollow out a sphere of voxels, throw a
   * capped number of them outward as debris and char the surviving rim.
   */
  damageSphere(x: number, y: number, z: number, radius: number, p: BlastParams): number {
    const r = radius > 0 ? radius : p.radius;
    if (r <= 0) return 0;
    let n = 0;
    const jag = p.jagged;
    this.field.querySphere(x, y, z, r * 1.42, (id, t) => {
      if (n >= SCRATCH_IDS.length) return;
      const h = (Math.sin(this.field.posX[id] * 12.9898 + this.field.posZ[id] * 78.233 + this.field.posY[id] * 37.719) * 43758.5453) % 1;
      const wobble = 1 - jag * 0.5 + jag * Math.abs(h);
      if (t * 1.42 <= wobble) SCRATCH_IDS[n++] = id;
      else if (t * 1.42 < wobble + 0.34) this.field.scorch(id, p.scorch * (1.2 - t));
    });
    if (n === 0) return 0;
    const budget = Math.min(p.debris, this.engine.quality.eventDebris);
    const step = Math.max(1, Math.ceil(n / Math.max(1, budget)));
    for (let i = 0; i < n; i++) {
      const id = SCRATCH_IDS[i];
      const dx = this.field.posX[id] - x;
      const dy = this.field.posY[id] - y;
      const dz = this.field.posZ[id] - z;
      const d = Math.max(0.6, Math.hypot(dx, dy, dz));
      this.city.pushDirection(id, dx / d, dz / d);
      if (i % step === 0) {
        const falloff = 0.4 + 0.85 * (1 - Math.min(1, d / (r * 1.42)));
        const sp = p.force * falloff * (0.7 + Math.random() * 0.7);
        this.debris.spawnFromVoxel(
          this.field,
          id,
          (dx / d) * sp,
          (dy / d) * sp + p.up * sp * 0.6 + Math.random() * 3,
          (dz / d) * sp,
          1 - 0.35 * Math.random() * p.scorch,
        );
      }
      this.killVoxel(id);
    }
    return n;
  }

  /** Cars flip / explode, citizens are thrown and everyone nearby flees. */
  blastEntities(x: number, z: number, radius: number, power: number): void {
    this.traffic.blast(x, z, radius * 1.15, power, this.debris);
    this.crowd.toss(x, z, radius * 1.3, power);
    this.crowd.panic(x, z, radius * 3.4);
  }

  /** Registers a slowly burning hotspot that keeps emitting fire + smoke. */
  addFire(x: number, y: number, z: number, radius: number, duration: number, rate = 1): void {
    if (this.burning.length > 26) this.burning.shift();
    this.burning.push({ x, y, z, t: duration, r: radius, rate });
  }

  // ------------------------------------------------------------------ particles
  private rgb(hex: number): THREE.Color {
    return this.col.setHex(hex);
  }

  sparkBurst(x: number, y: number, z: number, count: number, speed: number, hex = 0xffd27f): void {
    const c = this.rgb(hex);
    const n = this.scaleCount(count);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const e = Math.random() * Math.PI - Math.PI / 2;
      const s = speed * (0.35 + Math.random() * 0.9);
      this.sparks.spawn(
        x,
        y,
        z,
        Math.cos(a) * Math.cos(e) * s,
        Math.abs(Math.sin(e)) * s * 1.15,
        Math.sin(a) * Math.cos(e) * s,
        0.35 + Math.random() * 0.7,
        0.5 + Math.random() * 0.5,
        0.06,
        c.r,
        c.g,
        c.b,
        1,
        -16,
        0.7,
        0.35,
      );
    }
  }

  fire(x: number, y: number, z: number, count: number, spread: number, life = 1): void {
    const n = this.scaleCount(count);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * spread;
      const warm = Math.random();
      this.sparks.spawn(
        x + Math.cos(a) * r * 0.5,
        y + Math.random() * spread * 0.4,
        z + Math.sin(a) * r * 0.5,
        Math.cos(a) * r * 0.5,
        2 + Math.random() * 5,
        Math.sin(a) * r * 0.5,
        life * (0.6 + Math.random() * 0.7),
        1.4 + Math.random() * 1.8,
        0.2,
        1,
        0.42 + warm * 0.42,
        0.08 + warm * 0.14,
        0.95,
        3.5,
        1.4,
        0.4,
      );
    }
  }

  dust(x: number, y: number, z: number, count: number, spread: number, life = 1): void {
    const n = this.scaleCount(count);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * spread;
      const g = 0.62 + Math.random() * 0.24;
      this.smoke.spawn(
        x + Math.cos(a) * r,
        y + Math.random() * spread * 0.5,
        z + Math.sin(a) * r,
        Math.cos(a) * (1 + Math.random() * 3),
        0.8 + Math.random() * 2.4,
        Math.sin(a) * (1 + Math.random() * 3),
        life * (1.4 + Math.random() * 1.8),
        1.6 + Math.random() * 2,
        5 + Math.random() * 5,
        g,
        g * 0.96,
        g * 0.9,
        0.5,
        0.6,
        0.9,
        0.6,
      );
    }
  }

  smokeColumn(x: number, y: number, z: number, count: number, spread: number, life = 2): void {
    const n = this.scaleCount(count);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * spread;
      const g = 0.22 + Math.random() * 0.3;
      this.smoke.spawn(
        x + Math.cos(a) * r,
        y + Math.random() * 2,
        z + Math.sin(a) * r,
        Math.cos(a) * 1.2,
        4 + Math.random() * 6,
        Math.sin(a) * 1.2,
        life * (1 + Math.random()),
        2 + Math.random() * 2,
        7 + Math.random() * 7,
        g,
        g * 0.95,
        g * 0.95,
        0.62,
        1.2,
        0.7,
        0.7,
      );
    }
  }

  private scaleCount(c: number): number {
    const tier = this.engine.quality.tier;
    const k = tier === 2 ? 1 : tier === 1 ? 0.7 : 0.45;
    return Math.max(1, Math.round(c * k));
  }

  /** Convenience: a full "explosion" feedback package. */
  explosionFx(x: number, y: number, z: number, radius: number, hue: number): void {
    this.shock.sphere(x, y + radius * 0.18, z, radius * 0.24, radius * 1.05, 0.62, hue, 1.8, 1, 0.92);
    this.shock.sphere(x, y + radius * 0.3, z, radius * 0.5, radius * 1.7, 1.05, 0xffb063, 0.7, 0.35, 0.7);
    this.shock.ring(x, 0.3, z, radius * 0.3, radius * 2.2, 0.7, 0xfff0c0, 1.3);
    this.sparkBurst(x, y + 1, z, Math.round(30 + radius * 3.8), radius * 2.6, 0xffd27f);
    this.fire(x, y + 1, z, Math.round(20 + radius * 2.4), radius * 0.55, 1.5);
    this.dust(x, y + 0.6, z, Math.round(20 + radius * 2.4), radius * 0.8, 1.7);
  }

  // ------------------------------------------------------------------ frame
  update(dt: number, simDt: number): void {
    swayUniforms.uTime.value += simDt;
    this.sky.update(dt, simDt);
    this.water.update(dt, simDt);
    this.fields.waterLevel = this.water.level;

    // burning hotspots
    for (let i = this.burning.length - 1; i >= 0; i--) {
      const b = this.burning[i];
      b.t -= simDt;
      if (b.t <= 0) {
        this.burning.splice(i, 1);
        continue;
      }
      if (Math.random() < simDt * 9 * b.rate) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * b.r;
        this.fire(b.x + Math.cos(a) * r, b.y, b.z + Math.sin(a) * r, 2, 1.4, 1.2);
        if (Math.random() < 0.4) this.smokeColumn(b.x + Math.cos(a) * r, b.y + 1, b.z + Math.sin(a) * r, 1, 1.2, 2.4);
      }
    }

    this.chunks.update(simDt);
    this.debris.update(simDt, this.field, this.fields);
    this.traffic.update(simDt, this.field, this.fields, this.threats);
    this.crowd.update(simDt, this.field, this.fields, this.threats);
    this.sparks.update(simDt, this.fields);
    this.smoke.update(simDt, this.fields);
    this.shock.update(simDt);
    this.bolts.update(simDt);
    this.city.evaluate(this.chunks, simDt, clamp(this.stress, 0, 1));
    this.field.flush();

    const h = this.engine.renderer.domElement.height;
    const projY = this.engine.camera.projectionMatrix.elements[5];
    this.sparks.setProjection(h, projY);
    this.smoke.setProjection(h, projY);
    this.audio.update(dt);
  }

  /** Full restoration: city, props, weather, water, fx pools and audio beds. */
  rebuild(): void {
    this.field.resetAll();
    this.city.reset();
    this.debris.clear();
    this.chunks.clear();
    this.sparks.clear();
    this.smoke.clear();
    this.shock.clear();
    this.bolts.clear();
    this.decals.clear();
    this.water.reset();
    this.sky.reset();
    this.fields.reset();
    this.threats.length = 0;
    this.burning.length = 0;
    this.traffic.reset();
    this.crowd.reset();
    this.screen.reset();
    this.stress = 0;
    swayUniforms.uQuake.value = 0;
    this.audio.windLevel(0);
    this.audio.quakeLevel(0);
    this.audio.waterLevel(0);
    this.audio.singularity(0);
  }

  /** Random position inside the built-up area (used by storm / quake). */
  randomCityPoint(out: THREE.Vector2): THREE.Vector2 {
    const bi = (Math.random() * BLOCKS) | 0;
    const bj = (Math.random() * BLOCKS) | 0;
    return out.set(blockMin(bi) + Math.random() * BLOCK, blockMin(bj) + Math.random() * BLOCK);
  }
}
