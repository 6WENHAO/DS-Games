import * as THREE from 'three';
import { Rng } from '../core/rng';
import { FORCE, FieldSet, sampleForce } from '../fx/fields';
import { BLOCK, BLOCKS, CITY_HALF, blockMin } from './layout';
import { coloredBox, mergeParts } from './models';
import type { Threat } from './traffic';
import type { VoxelField } from './voxels';

const SHIRT = [0xff7fa8, 0xffd166, 0x6fd2ff, 0xa78bfa, 0x8fe3b8, 0xff9f6b, 0xf5f2e8, 0x69c9a5];

const WALK = 0;
const PANIC = 1;
const RAGDOLL = 2;
const DEAD = 3;

/**
 * Tiny citizens. They stroll the sidewalk rings, scatter from disasters, get
 * tumbled by tornado / black hole / flood forces and respawn at the outskirts.
 */
export class Crowd {
  readonly mesh: THREE.InstancedMesh;
  readonly capacity: number;

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
  private ring: Float32Array; // walk parameter along the block perimeter
  private cx: Float32Array;
  private cz: Float32Array;
  private half: Float32Array;
  private dirSign: Float32Array;
  private speed: Float32Array;
  private mode: Uint8Array;
  private timer: Float32Array;
  private phase: Float32Array;
  private heading: Float32Array;

  private mtx = new THREE.Matrix4();
  private quat = new THREE.Quaternion();
  private euler = new THREE.Euler();
  private vecP = new THREE.Vector3();
  private vecS = new THREE.Vector3(1, 1, 1);
  private rng = new Rng(4412009);
  private t = 0;

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
    this.ring = f(capacity);
    this.cx = f(capacity);
    this.cz = f(capacity);
    this.half = f(capacity);
    this.dirSign = f(capacity);
    this.speed = f(capacity);
    this.mode = new Uint8Array(capacity);
    this.timer = f(capacity);
    this.phase = f(capacity);
    this.heading = f(capacity);

    const geo = mergeParts([
      coloredBox(0.52, 0.62, 0.34, 0, 0.62, 0, 0xffffff),
      coloredBox(0.34, 0.34, 0.3, 0, 1.08, 0, 0xffd9b8),
      coloredBox(0.2, 0.34, 0.24, -0.14, 0.18, 0, 0x46536b),
      coloredBox(0.2, 0.34, 0.24, 0.14, 0.18, 0, 0x46536b),
    ]);
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true });
    this.mesh = new THREE.InstancedMesh(geo, mat, capacity);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
    this.mesh.castShadow = true;
    this.mesh.frustumCulled = false;
  }

  get aliveCount(): number {
    let n = 0;
    for (let i = 0; i < this.capacity; i++) if (this.mode[i] !== DEAD) n++;
    return n;
  }

  get panicCount(): number {
    let n = 0;
    for (let i = 0; i < this.capacity; i++) if (this.mode[i] === PANIC) n++;
    return n;
  }

  populate(): void {
    const c = new THREE.Color();
    for (let i = 0; i < this.capacity; i++) {
      this.assignRing(i, this.rng.int(0, BLOCKS - 1), this.rng.int(0, BLOCKS - 1));
      this.ring[i] = this.rng.next() * this.perim(i);
      this.dirSign[i] = this.rng.bool(0.5) ? 1 : -1;
      this.speed[i] = this.rng.range(1.5, 2.7);
      this.mode[i] = WALK;
      this.timer[i] = 0;
      this.phase[i] = this.rng.range(0, 6.28);
      this.qx[i] = 0;
      this.qy[i] = 0;
      this.qz[i] = 0;
      this.qw[i] = 1;
      c.setHex(this.rng.pick(SHIRT));
      this.mesh.setColorAt(i, c);
      this.place(i);
    }
    this.mesh.count = this.capacity;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  reset(): void {
    this.populate();
  }

  private assignRing(i: number, bi: number, bj: number): void {
    this.cx[i] = blockMin(bi) + BLOCK / 2;
    this.cz[i] = blockMin(bj) + BLOCK / 2;
    this.half[i] = BLOCK / 2 + 0.9;
  }

  private perim(i: number): number {
    return this.half[i] * 8;
  }

  /** Convert the perimeter parameter into a position + heading. */
  private place(i: number): void {
    const h = this.half[i];
    const side = this.half[i] * 2;
    let s = this.ring[i] % (side * 4);
    if (s < 0) s += side * 4;
    let x = 0;
    let z = 0;
    let head = 0;
    if (s < side) {
      x = -h + s;
      z = -h;
      head = 0;
    } else if (s < side * 2) {
      x = h;
      z = -h + (s - side);
      head = -Math.PI / 2;
    } else if (s < side * 3) {
      x = h - (s - side * 2);
      z = h;
      head = Math.PI;
    } else {
      x = -h;
      z = h - (s - side * 3);
      head = Math.PI / 2;
    }
    this.px[i] = this.cx[i] + x;
    this.pz[i] = this.cz[i] + z;
    this.py[i] = 0.12;
    this.heading[i] = this.dirSign[i] > 0 ? head : head + Math.PI;
  }

  /** Make everyone within range run for their lives. */
  panic(x: number, z: number, radius: number): void {
    for (let i = 0; i < this.capacity; i++) {
      if (this.mode[i] === DEAD || this.mode[i] === RAGDOLL) continue;
      const d = Math.hypot(this.px[i] - x, this.pz[i] - z);
      if (d > radius) continue;
      this.mode[i] = PANIC;
      this.timer[i] = 3.5 + Math.random() * 3.5;
      const inv = 1 / Math.max(0.4, d);
      this.heading[i] = Math.atan2(-(this.pz[i] - z) * inv, (this.px[i] - x) * inv);
      this.speed[i] = 5 + Math.random() * 2.6;
    }
  }

  /** Physical impulse (blast / tornado / collapse). */
  toss(x: number, z: number, radius: number, power: number): void {
    for (let i = 0; i < this.capacity; i++) {
      if (this.mode[i] === DEAD) continue;
      const dx = this.px[i] - x;
      const dz = this.pz[i] - z;
      const d = Math.hypot(dx, dz);
      if (d > radius) continue;
      const t = 1 - d / radius;
      const inv = 1 / Math.max(0.5, d);
      this.mode[i] = RAGDOLL;
      this.timer[i] = 0;
      this.vx[i] = dx * inv * power * t * 15;
      this.vy[i] = 5 + t * power * 14;
      this.vz[i] = dz * inv * power * t * 15;
    }
  }

  private respawn(i: number): void {
    this.assignRing(i, this.rng.int(0, BLOCKS - 1), this.rng.int(0, BLOCKS - 1));
    this.ring[i] = this.rng.next() * this.perim(i);
    this.dirSign[i] = this.rng.bool(0.5) ? 1 : -1;
    this.speed[i] = this.rng.range(1.5, 2.7);
    this.mode[i] = WALK;
    this.timer[i] = 0;
    this.qx[i] = 0;
    this.qy[i] = 0;
    this.qz[i] = 0;
    this.qw[i] = 1;
    this.vx[i] = 0;
    this.vy[i] = 0;
    this.vz[i] = 0;
    this.place(i);
  }

  update(dt: number, field: VoxelField, fields: FieldSet, threats: Threat[]): void {
    this.t += dt;
    const useFields = fields.anyActive;
    const water = fields.waterLevel;
    for (let i = 0; i < this.capacity; i++) {
      const m = this.mode[i];
      if (m === DEAD) {
        this.timer[i] -= dt;
        if (this.timer[i] <= 0) this.respawn(i);
        continue;
      }

      if (m !== RAGDOLL) {
        // pulled off their feet by strong fields or rising water
        if (useFields) {
          sampleForce(fields, this.px[i], this.py[i] + 0.6, this.pz[i]);
          if (FORCE.eaten) {
            this.kill(i);
            continue;
          }
          if (Math.abs(FORCE.x) + Math.abs(FORCE.z) + Math.abs(FORCE.y) > 9) {
            this.mode[i] = RAGDOLL;
            this.vx[i] = FORCE.x * 0.3;
            this.vy[i] = 3 + Math.abs(FORCE.y) * 0.25;
            this.vz[i] = FORCE.z * 0.3;
            this.timer[i] = 0;
            continue;
          }
        }
        if (water > 0.75) {
          this.mode[i] = RAGDOLL;
          this.vy[i] = 1.5;
          this.timer[i] = 0;
          continue;
        }
        for (const t of threats) {
          const d = Math.hypot(this.px[i] - t.x, this.pz[i] - t.z);
          if (d < t.radius * 2.1) {
            if (this.mode[i] !== PANIC) {
              this.mode[i] = PANIC;
              this.timer[i] = 3 + Math.random() * 3;
              this.speed[i] = 5 + Math.random() * 2.4;
            }
            const inv = 1 / Math.max(0.4, d);
            this.heading[i] = Math.atan2(-(this.pz[i] - t.z) * inv, (this.px[i] - t.x) * inv);
            break;
          }
        }
      }

      if (m === WALK) {
        this.ring[i] += this.dirSign[i] * this.speed[i] * dt;
        this.place(i);
        this.bob(i, 1);
      } else if (m === PANIC) {
        this.timer[i] -= dt;
        const c = Math.cos(this.heading[i]);
        const s = Math.sin(this.heading[i]);
        this.px[i] += c * this.speed[i] * dt;
        this.pz[i] -= s * this.speed[i] * dt;
        this.py[i] = 0.12;
        if (Math.abs(this.px[i]) > CITY_HALF + 46 || Math.abs(this.pz[i]) > CITY_HALF + 46) {
          this.respawn(i);
          continue;
        }
        if (this.timer[i] <= 0) {
          // rejoin the nearest block ring
          const bi = Math.min(
            BLOCKS - 1,
            Math.max(0, Math.round((this.px[i] + CITY_HALF - BLOCK / 2 - 6) / (BLOCK + 6))),
          );
          const bj = Math.min(
            BLOCKS - 1,
            Math.max(0, Math.round((this.pz[i] + CITY_HALF - BLOCK / 2 - 6) / (BLOCK + 6))),
          );
          this.assignRing(i, bi, bj);
          this.ring[i] = Math.random() * this.perim(i);
          this.speed[i] = 1.5 + Math.random() * 1.2;
          this.mode[i] = WALK;
        }
        this.bob(i, 2.1);
      } else {
        this.updateRagdoll(i, dt, field, fields, useFields, water);
      }
    }
    this.write();
  }

  private kill(i: number): void {
    this.mode[i] = DEAD;
    this.timer[i] = 5 + Math.random() * 6;
  }

  private bob(i: number, rate: number): void {
    const p = this.t * this.speed[i] * 3.4 * rate + this.phase[i];
    this.py[i] = 0.12 + Math.abs(Math.sin(p)) * 0.1;
    this.euler.set(Math.sin(p) * 0.12, this.heading[i], Math.sin(p * 0.5) * 0.06);
    this.quat.setFromEuler(this.euler);
    this.qx[i] = this.quat.x;
    this.qy[i] = this.quat.y;
    this.qz[i] = this.quat.z;
    this.qw[i] = this.quat.w;
  }

  private updateRagdoll(
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
    vy -= 32 * dt;
    if (useFields) {
      sampleForce(fields, this.px[i], this.py[i] + 0.5, this.pz[i]);
      if (FORCE.eaten) {
        this.kill(i);
        return;
      }
      vx += FORCE.x * dt;
      vy += FORCE.y * dt;
      vz += FORCE.z * dt;
    }
    if (water > 0.1 && this.py[i] < water) {
      vy += 24 * dt;
      vx *= 1 - 1.8 * dt;
      vz *= 1 - 1.8 * dt;
      if (fields.waterCurrent > 0) {
        const d = Math.max(1, Math.hypot(this.px[i], this.pz[i]));
        vx += (this.px[i] / d) * fields.waterCurrent * 0.6 * dt;
        vz += (this.pz[i] / d) * fields.waterCurrent * 0.6 * dt;
      }
    }
    const drag = 1 - 0.6 * dt;
    vx *= drag;
    vy *= drag;
    vz *= drag;
    this.px[i] += vx * dt;
    this.py[i] += vy * dt;
    this.pz[i] += vz * dt;
    let floor = 0;
    const surf = field.surfaceAt(this.px[i], this.pz[i]);
    if (surf > 0 && this.py[i] > surf - 2.5) floor = surf;
    if (water > floor + 0.3 && this.py[i] < water - 0.35)
      this.py[i] += Math.min(3 * dt, water - 0.35 - this.py[i]);
    let grounded = false;
    if (this.py[i] < floor + 0.12) {
      this.py[i] = floor + 0.12;
      vy = -vy * 0.2;
      vx *= 1 - 6 * dt;
      vz *= 1 - 6 * dt;
      grounded = Math.abs(vx) + Math.abs(vz) < 1.2;
    }
    this.vx[i] = vx;
    this.vy[i] = vy;
    this.vz[i] = vz;
    // tumbling orientation
    this.euler.set(this.timer[i] * 5.5, this.timer[i] * 3.1, this.timer[i] * 4.2);
    this.quat.setFromEuler(this.euler);
    this.qx[i] = this.quat.x;
    this.qy[i] = this.quat.y;
    this.qz[i] = this.quat.z;
    this.qw[i] = this.quat.w;
    if (grounded && this.timer[i] > 1.4 && !useFields && water < 0.5) {
      this.mode[i] = PANIC;
      this.timer[i] = 2.5;
      this.speed[i] = 4.6 + Math.random() * 2;
      this.heading[i] = Math.random() * Math.PI * 2;
    }
    if (Math.abs(this.px[i]) > 320 || Math.abs(this.pz[i]) > 320 || this.py[i] < -40) this.kill(i);
  }

  private write(): void {
    for (let i = 0; i < this.capacity; i++) {
      if (this.mode[i] === DEAD) {
        this.mtx.makeScale(0, 0, 0);
        this.mesh.setMatrixAt(i, this.mtx);
        continue;
      }
      this.quat.set(this.qx[i], this.qy[i], this.qz[i], this.qw[i]);
      this.vecP.set(this.px[i], this.py[i], this.pz[i]);
      this.mtx.compose(this.vecP, this.quat, this.vecS);
      this.mesh.setMatrixAt(i, this.mtx);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
