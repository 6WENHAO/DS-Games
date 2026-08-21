import * as THREE from 'three';
import { Rng } from '../core/rng';
import { FORCE, FieldSet, sampleForce } from '../fx/fields';
import type { DebrisSystem } from '../fx/debris';
import { CITY_HALF, roadLines } from './layout';
import { coloredBox, mergeParts } from './models';
import type { VoxelField } from './voxels';

const CAR_COLORS = [0xff6b6b, 0xffd166, 0x4ecdc4, 0xa78bfa, 0xf8f4e3, 0x64b5f6, 0xffa07a, 0x81c784];

const MODE_DRIVE = 0;
const MODE_FLEE = 1;
const MODE_LOOSE = 2;

export interface Threat {
  x: number;
  z: number;
  radius: number;
  power: number;
}

/**
 * Toy traffic. Cars cruise the road grid, panic-accelerate near a disaster and
 * turn into tumbling wrecks when they are caught by one.
 */
export class Traffic {
  readonly mesh: THREE.InstancedMesh;
  readonly capacity: number;
  count = 0;

  private px: Float32Array;
  private py: Float32Array;
  private pz: Float32Array;
  private vx: Float32Array;
  private vy: Float32Array;
  private vz: Float32Array;
  private qx: Float32Array;
  private qy: Float32Array;
  private qz: Float32Array;
  private qw: Float32Array;
  private ax: Float32Array;
  private ay: Float32Array;
  private az: Float32Array;
  private dir: Float32Array; // heading angle for driving cars
  private speed: Float32Array;
  private axis: Uint8Array; // 0 = travels along X, 1 = along Z
  private mode: Uint8Array;
  private timer: Float32Array;
  private colorIdx: Uint8Array;

  private mtx = new THREE.Matrix4();
  private quat = new THREE.Quaternion();
  private vecP = new THREE.Vector3();
  private vecS = new THREE.Vector3(1, 1, 1);
  private rng = new Rng(778211);

  /** Fired when a car is destroyed (fireball + debris hooks). */
  onWreck: ((x: number, y: number, z: number) => void) | null = null;

  constructor(capacity: number) {
    this.capacity = capacity;
    const f = (n: number): Float32Array => new Float32Array(n);
    this.px = f(capacity);
    this.py = f(capacity);
    this.pz = f(capacity);
    this.vx = f(capacity);
    this.vy = f(capacity);
    this.vz = f(capacity);
    this.qx = f(capacity);
    this.qy = f(capacity);
    this.qz = f(capacity);
    this.qw = f(capacity);
    this.ax = f(capacity);
    this.ay = f(capacity);
    this.az = f(capacity);
    this.dir = f(capacity);
    this.speed = f(capacity);
    this.axis = new Uint8Array(capacity);
    this.mode = new Uint8Array(capacity);
    this.timer = f(capacity);
    this.colorIdx = new Uint8Array(capacity);

    const geo = mergeParts([
      coloredBox(3.4, 0.95, 1.8, 0, 0.72, 0, 0xffffff),
      coloredBox(1.9, 0.8, 1.6, -0.15, 1.5, 0, 0xdff1ff),
      coloredBox(0.5, 0.5, 2.0, 1.15, 0.3, 0, 0x2a2a30),
      coloredBox(0.5, 0.5, 2.0, -1.15, 0.3, 0, 0x2a2a30),
      coloredBox(0.35, 0.3, 0.3, 1.75, 0.8, 0.6, 0xfff3c4),
      coloredBox(0.35, 0.3, 0.3, 1.75, 0.8, -0.6, 0xfff3c4),
    ]);
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true });
    this.mesh = new THREE.InstancedMesh(geo, mat, capacity);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const col = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
    this.mesh.instanceColor = col;
    this.mesh.castShadow = true;
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
  }

  populate(): void {
    const lines = roadLines();
    const c = new THREE.Color();
    this.count = 0;
    for (let i = 0; i < this.capacity; i++) {
      const alongX = this.rng.bool(0.5);
      const line = this.rng.pick(lines);
      const lane = this.rng.bool(0.5) ? 1.35 : -1.35;
      const t = this.rng.range(-CITY_HALF, CITY_HALF);
      const idx = this.count++;
      this.axis[idx] = alongX ? 0 : 1;
      if (alongX) {
        this.px[idx] = t;
        this.pz[idx] = line + lane;
        this.dir[idx] = lane > 0 ? Math.PI : 0;
      } else {
        this.px[idx] = line - lane;
        this.pz[idx] = t;
        this.dir[idx] = lane > 0 ? -Math.PI / 2 : Math.PI / 2;
      }
      this.py[idx] = 0.16;
      this.speed[idx] = this.rng.range(7, 15);
      this.mode[idx] = MODE_DRIVE;
      this.timer[idx] = 0;
      this.qx[idx] = 0;
      this.qy[idx] = 0;
      this.qz[idx] = 0;
      this.qw[idx] = 1;
      this.vx[idx] = 0;
      this.vy[idx] = 0;
      this.vz[idx] = 0;
      this.colorIdx[idx] = this.rng.int(0, CAR_COLORS.length - 1);
      c.setHex(CAR_COLORS[this.colorIdx[idx]]);
      this.mesh.setColorAt(idx, c);
    }
    this.mesh.count = this.count;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  reset(): void {
    this.populate();
  }

  /** Rip a car loose from the road with an impulse. */
  launch(i: number, vx: number, vy: number, vz: number): void {
    this.mode[i] = MODE_LOOSE;
    this.vx[i] = vx;
    this.vy[i] = vy;
    this.vz[i] = vz;
    this.ax[i] = (Math.random() - 0.5) * 8;
    this.ay[i] = (Math.random() - 0.5) * 8;
    this.az[i] = (Math.random() - 0.5) * 8;
    this.timer[i] = 0;
  }

  /** Blast response: nearby cars flip, close cars explode. */
  blast(x: number, z: number, radius: number, power: number, debris: DebrisSystem): void {
    for (let i = 0; i < this.count; i++) {
      const dx = this.px[i] - x;
      const dz = this.pz[i] - z;
      const d = Math.hypot(dx, dz);
      if (d > radius) continue;
      const t = 1 - d / radius;
      if (d < radius * 0.42) {
        // destroyed: scatter a few chassis chunks and respawn elsewhere
        for (let k = 0; k < 5; k++)
          debris.spawn(
            this.px[i],
            this.py[i] + 0.6,
            this.pz[i],
            (Math.random() - 0.5) * 16,
            4 + Math.random() * 12,
            (Math.random() - 0.5) * 16,
            0.9,
            0.5,
            0.7,
            0.15,
            0.15,
            0.16,
          );
        if (this.onWreck) this.onWreck(this.px[i], this.py[i] + 0.5, this.pz[i]);
        this.respawn(i);
        continue;
      }
      const inv = 1 / Math.max(0.5, d);
      const s = power * t * 22;
      this.launch(i, dx * inv * s, 6 + t * power * 18, dz * inv * s);
    }
  }

  private respawn(i: number): void {
    const lines = roadLines();
    const alongX = this.rng.bool(0.5);
    const line = this.rng.pick(lines);
    const lane = this.rng.bool(0.5) ? 1.35 : -1.35;
    this.axis[i] = alongX ? 0 : 1;
    if (alongX) {
      this.px[i] = this.rng.bool(0.5) ? -CITY_HALF - 8 : CITY_HALF + 8;
      this.pz[i] = line + lane;
      this.dir[i] = this.px[i] > 0 ? Math.PI : 0;
    } else {
      this.px[i] = line - lane;
      this.pz[i] = this.rng.bool(0.5) ? -CITY_HALF - 8 : CITY_HALF + 8;
      this.dir[i] = this.pz[i] > 0 ? -Math.PI / 2 : Math.PI / 2;
    }
    this.py[i] = 0.16;
    this.mode[i] = MODE_DRIVE;
    this.speed[i] = this.rng.range(7, 15);
    this.qx[i] = 0;
    this.qy[i] = 0;
    this.qz[i] = 0;
    this.qw[i] = 1;
    this.vx[i] = 0;
    this.vy[i] = 0;
    this.vz[i] = 0;
    this.timer[i] = 0;
  }

  update(dt: number, field: VoxelField, fields: FieldSet, threats: Threat[]): void {
    const useFields = fields.anyActive;
    const water = fields.waterLevel;
    for (let i = 0; i < this.count; i++) {
      if (this.mode[i] === MODE_LOOSE) {
        this.updateLoose(i, dt, field, fields, useFields, water);
        continue;
      }
      // ---- on-road driving
      let boost = 1;
      for (const t of threats) {
        const d = Math.hypot(this.px[i] - t.x, this.pz[i] - t.z);
        if (d < t.radius * 2.4) {
          boost = 2.3;
          this.mode[i] = MODE_FLEE;
          this.timer[i] = 3;
          break;
        }
      }
      if (this.mode[i] === MODE_FLEE) {
        this.timer[i] -= dt;
        if (this.timer[i] <= 0) this.mode[i] = MODE_DRIVE;
        boost = Math.max(boost, 1.9);
      }
      if (water > 0.55) boost *= 0.35;
      const v = this.speed[i] * boost * dt;
      const c = Math.cos(this.dir[i]);
      const s = Math.sin(this.dir[i]);
      this.px[i] += c * v;
      this.pz[i] -= s * v;
      if (
        this.px[i] > CITY_HALF + 14 ||
        this.px[i] < -CITY_HALF - 14 ||
        this.pz[i] > CITY_HALF + 14 ||
        this.pz[i] < -CITY_HALF - 14
      ) {
        this.respawn(i);
        continue;
      }
      // deep water lifts cars off the road
      if (water > 1.5) this.launch(i, 0, 1, 0);
      if (useFields) {
        sampleForce(fields, this.px[i], this.py[i], this.pz[i]);
        if (Math.abs(FORCE.x) + Math.abs(FORCE.z) > 14 || FORCE.eaten)
          this.launch(i, FORCE.x * 0.35, 6 + Math.abs(FORCE.y) * 0.3, FORCE.z * 0.35);
      }
      this.quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.dir[i]);
      this.qx[i] = this.quat.x;
      this.qy[i] = this.quat.y;
      this.qz[i] = this.quat.z;
      this.qw[i] = this.quat.w;
    }
    this.write();
  }

  private updateLoose(
    i: number,
    dt: number,
    field: VoxelField,
    fields: FieldSet,
    useFields: boolean,
    water: number,
  ): void {
    this.timer[i] += dt;
    let vx = this.vx[i];
    let vy = this.vy[i];
    let vz = this.vz[i];
    vy -= 34 * dt;
    if (useFields) {
      sampleForce(fields, this.px[i], this.py[i], this.pz[i]);
      if (FORCE.eaten) {
        this.respawn(i);
        return;
      }
      vx += FORCE.x * dt * 0.8;
      vy += FORCE.y * dt * 0.8;
      vz += FORCE.z * dt * 0.8;
    }
    if (water > 0.1 && this.py[i] < water) {
      vy += 26 * dt;
      vx *= 1 - 2.2 * dt;
      vz *= 1 - 2.2 * dt;
    }
    const drag = 1 - 0.5 * dt;
    vx *= drag;
    vy *= drag;
    vz *= drag;
    this.px[i] += vx * dt;
    this.py[i] += vy * dt;
    this.pz[i] += vz * dt;
    let floor = 0;
    const surf = field.surfaceAt(this.px[i], this.pz[i]);
    if (surf > 0 && this.py[i] > surf - 3) floor = surf;
    if (water > floor + 0.3 && this.py[i] < water - 0.5) this.py[i] += Math.min(4 * dt, water - 0.5 - this.py[i]);
    if (this.py[i] < floor + 0.35) {
      this.py[i] = floor + 0.35;
      if (-vy > 3) {
        vy = -vy * 0.28;
        vx *= 0.6;
        vz *= 0.6;
      } else {
        vy = 0;
        vx *= 1 - 5 * dt;
        vz *= 1 - 5 * dt;
      }
      this.ax[i] *= 1 - 3 * dt;
      this.ay[i] *= 1 - 3 * dt;
      this.az[i] *= 1 - 3 * dt;
    }
    this.vx[i] = vx;
    this.vy[i] = vy;
    this.vz[i] = vz;
    // tumble
    const h = dt * 0.5;
    const ox = this.ax[i];
    const oy = this.ay[i];
    const oz = this.az[i];
    let nx = this.qx[i] + h * (ox * this.qw[i] + oy * this.qz[i] - oz * this.qy[i]);
    let ny = this.qy[i] + h * (oy * this.qw[i] + oz * this.qx[i] - ox * this.qz[i]);
    let nz = this.qz[i] + h * (oz * this.qw[i] + ox * this.qy[i] - oy * this.qx[i]);
    let nw = this.qw[i] - h * (ox * this.qx[i] + oy * this.qy[i] + oz * this.qz[i]);
    const l = Math.hypot(nx, ny, nz, nw) || 1;
    nx /= l;
    ny /= l;
    nz /= l;
    nw /= l;
    this.qx[i] = nx;
    this.qy[i] = ny;
    this.qz[i] = nz;
    this.qw[i] = nw;
    if (this.timer[i] > 26 || Math.abs(this.px[i]) > 300 || Math.abs(this.pz[i]) > 300) this.respawn(i);
  }

  private write(): void {
    for (let i = 0; i < this.count; i++) {
      this.quat.set(this.qx[i], this.qy[i], this.qz[i], this.qw[i]);
      this.vecP.set(this.px[i], this.py[i], this.pz[i]);
      this.mtx.compose(this.vecP, this.quat, this.vecS);
      this.mesh.setMatrixAt(i, this.mtx);
    }
    this.mesh.count = this.count;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
