import * as THREE from 'three';
import type { VoxelField } from '../world/voxels';
import { FORCE, FieldSet, sampleForce } from './fields';

const GRAVITY = 36;

/**
 * Fixed-capacity flying-rubble pool with cheap approximate physics:
 * gravity, air drag, quaternion tumbling, bounce + friction against the city
 * height field, buoyancy in flood water and a timed fade-out recycle.
 */
export class DebrisSystem {
  readonly mesh: THREE.InstancedMesh;
  count = 0;
  cap: number;

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
  private sx: Float32Array;
  private sy: Float32Array;
  private sz: Float32Array;
  private cr: Float32Array;
  private cg: Float32Array;
  private cb: Float32Array;
  private rest: Float32Array;
  private age: Float32Array;
  private fade: Float32Array;

  private mArr: Float32Array;
  private cArr: Float32Array;

  /** Called on hard landings (dust + sound). */
  onImpact: ((x: number, y: number, z: number, power: number) => void) | null = null;

  constructor(cap: number) {
    this.cap = cap;
    const f = (n: number): Float32Array => new Float32Array(n);
    this.px = f(cap);
    this.py = f(cap);
    this.pz = f(cap);
    this.vx = f(cap);
    this.vy = f(cap);
    this.vz = f(cap);
    this.qx = f(cap);
    this.qy = f(cap);
    this.qz = f(cap);
    this.qw = f(cap);
    this.ax = f(cap);
    this.ay = f(cap);
    this.az = f(cap);
    this.sx = f(cap);
    this.sy = f(cap);
    this.sz = f(cap);
    this.cr = f(cap);
    this.cg = f(cap);
    this.cb = f(cap);
    this.rest = f(cap);
    this.age = f(cap);
    this.fade = f(cap);

    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    this.mesh = new THREE.InstancedMesh(geo, mat, cap);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const col = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
    col.setUsage(THREE.DynamicDrawUsage);
    this.mesh.instanceColor = col;
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = false;
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mArr = this.mesh.instanceMatrix.array as Float32Array;
    this.cArr = col.array as Float32Array;
  }

  clear(): void {
    this.count = 0;
    this.mesh.count = 0;
  }

  /** Reserve a slot; recycles the most settled piece when the pool is full. */
  private slot(): number {
    if (this.count < this.cap) return this.count++;
    let worst = 0;
    let score = -1;
    for (let k = 0; k < 10; k++) {
      const i = (Math.random() * this.count) | 0;
      const s = this.rest[i] * 2 + this.age[i];
      if (s > score) {
        score = s;
        worst = i;
      }
    }
    return worst;
  }

  spawn(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    sx: number,
    sy: number,
    sz: number,
    r: number,
    g: number,
    b: number,
  ): void {
    const i = this.slot();
    this.px[i] = x;
    this.py[i] = y;
    this.pz[i] = z;
    this.vx[i] = vx;
    this.vy[i] = vy;
    this.vz[i] = vz;
    this.qx[i] = 0;
    this.qy[i] = 0;
    this.qz[i] = 0;
    this.qw[i] = 1;
    const spin = 3 + Math.random() * 9;
    this.ax[i] = (Math.random() - 0.5) * spin;
    this.ay[i] = (Math.random() - 0.5) * spin;
    this.az[i] = (Math.random() - 0.5) * spin;
    this.sx[i] = sx;
    this.sy[i] = sy;
    this.sz[i] = sz;
    this.cr[i] = r;
    this.cg[i] = g;
    this.cb[i] = b;
    this.rest[i] = 0;
    this.age[i] = 0;
    this.fade[i] = 1;
  }

  /** Convenience: throw the visual body of a voxel outward from a blast. */
  spawnFromVoxel(
    field: VoxelField,
    id: number,
    vx: number,
    vy: number,
    vz: number,
    shade = 1,
  ): void {
    this.spawn(
      field.posX[id],
      field.posY[id],
      field.posZ[id],
      vx,
      vy,
      vz,
      field.sclX[id] * 0.92,
      Math.max(0.22, field.sclY[id] * 0.92),
      field.sclZ[id] * 0.92,
      field.colR[id] * shade,
      field.colG[id] * shade,
      field.colB[id] * shade,
    );
  }

  private free(i: number): void {
    const last = this.count - 1;
    if (i !== last) {
      const cp = (a: Float32Array): void => {
        a[i] = a[last];
      };
      cp(this.px);
      cp(this.py);
      cp(this.pz);
      cp(this.vx);
      cp(this.vy);
      cp(this.vz);
      cp(this.qx);
      cp(this.qy);
      cp(this.qz);
      cp(this.qw);
      cp(this.ax);
      cp(this.ay);
      cp(this.az);
      cp(this.sx);
      cp(this.sy);
      cp(this.sz);
      cp(this.cr);
      cp(this.cg);
      cp(this.cb);
      cp(this.rest);
      cp(this.age);
      cp(this.fade);
    }
    this.count = last;
  }

  update(dt: number, field: VoxelField, fields: FieldSet): void {
    if (dt <= 0) {
      this.write();
      return;
    }
    const useFields = fields.anyActive;
    const water = fields.waterLevel;
    for (let i = this.count - 1; i >= 0; i--) {
      this.age[i] += dt;
      let vx = this.vx[i];
      let vy = this.vy[i];
      let vz = this.vz[i];
      const half = this.sy[i] * 0.5;

      vy -= GRAVITY * dt;

      if (useFields) {
        sampleForce(fields, this.px[i], this.py[i], this.pz[i]);
        if (FORCE.eaten) {
          this.free(i);
          continue;
        }
        vx += FORCE.x * dt;
        vy += FORCE.y * dt;
        vz += FORCE.z * dt;
      }

      let submerged = false;
      if (water > 0.05 && this.py[i] < water) {
        submerged = true;
        const depth = Math.min(3, water - this.py[i]);
        vy += (18 + depth * 6) * dt; // buoyancy
        vx *= 1 - 2.4 * dt;
        vz *= 1 - 2.4 * dt;
        vy *= 1 - 3.2 * dt;
        if (fields.waterCurrent > 0) {
          const dx = this.px[i];
          const dz = this.pz[i];
          const d = Math.max(1, Math.hypot(dx, dz));
          vx += (dx / d) * fields.waterCurrent * dt;
          vz += (dz / d) * fields.waterCurrent * dt;
        }
      }

      const drag = 1 - (submerged ? 1.6 : 0.42) * dt;
      vx *= drag;
      vy *= drag;
      vz *= drag;

      this.px[i] += vx * dt;
      this.py[i] += vy * dt;
      this.pz[i] += vz * dt;

      // ---- ground / rooftop contact
      let floor = 0;
      const surf = field.surfaceAt(this.px[i], this.pz[i]);
      if (surf > 0 && this.py[i] - half > surf - 3) floor = surf;
      if (submerged && water > floor + 0.4) {
        // float on the surface instead of sinking to the street
        if (this.py[i] < water - 0.4) {
          this.py[i] += Math.min(6 * dt, water - 0.4 - this.py[i]);
        }
        this.rest[i] += dt * 0.35;
      }
      if (this.py[i] - half < floor) {
        this.py[i] = floor + half;
        const hit = -vy;
        if (hit > 2.6) {
          vy = hit * 0.3;
          vx *= 0.64;
          vz *= 0.64;
          this.ax[i] *= 0.55;
          this.ay[i] *= 0.55;
          this.az[i] *= 0.55;
          if (hit > 7 && this.onImpact && Math.random() < 0.22)
            this.onImpact(this.px[i], this.py[i], this.pz[i], Math.min(1, hit / 26));
        } else {
          vy = 0;
          vx *= 1 - 7 * dt;
          vz *= 1 - 7 * dt;
          this.ax[i] *= 1 - 8 * dt;
          this.ay[i] *= 1 - 8 * dt;
          this.az[i] *= 1 - 8 * dt;
          if (Math.abs(vx) + Math.abs(vz) < 0.6) this.rest[i] += dt;
        }
      } else if (this.py[i] > floor + half + 0.2) {
        this.rest[i] = Math.max(0, this.rest[i] - dt * 2);
      }

      this.vx[i] = vx;
      this.vy[i] = vy;
      this.vz[i] = vz;

      // ---- tumble
      const ox = this.ax[i];
      const oy = this.ay[i];
      const oz = this.az[i];
      if (ox * ox + oy * oy + oz * oz > 1e-5) {
        const qx = this.qx[i];
        const qy = this.qy[i];
        const qz = this.qz[i];
        const qw = this.qw[i];
        const h = dt * 0.5;
        let nx = qx + h * (ox * qw + oy * qz - oz * qy);
        let ny = qy + h * (oy * qw + oz * qx - ox * qz);
        let nz = qz + h * (oz * qw + ox * qy - oy * qx);
        let nw = qw - h * (ox * qx + oy * qy + oz * qz);
        const l = Math.hypot(nx, ny, nz, nw) || 1;
        nx /= l;
        ny /= l;
        nz /= l;
        nw /= l;
        this.qx[i] = nx;
        this.qy[i] = ny;
        this.qz[i] = nz;
        this.qw[i] = nw;
      }

      // ---- recycle
      if (this.rest[i] > 5.2 || this.age[i] > 40) {
        this.fade[i] -= dt * 1.35;
        if (this.fade[i] <= 0) {
          this.free(i);
          continue;
        }
      }
      if (this.py[i] < -60 || Math.abs(this.px[i]) > 620 || Math.abs(this.pz[i]) > 620) {
        this.free(i);
      }
    }
    this.write();
  }

  private write(): void {
    const m = this.mArr;
    const c = this.cArr;
    for (let i = 0; i < this.count; i++) {
      const x = this.qx[i];
      const y = this.qy[i];
      const z = this.qz[i];
      const w = this.qw[i];
      const x2 = x + x;
      const y2 = y + y;
      const z2 = z + z;
      const xx = x * x2;
      const xy = x * y2;
      const xz = x * z2;
      const yy = y * y2;
      const yz = y * z2;
      const zz = z * z2;
      const wx = w * x2;
      const wy = w * y2;
      const wz = w * z2;
      const f = this.fade[i];
      const sx = this.sx[i] * f;
      const sy = this.sy[i] * f;
      const sz = this.sz[i] * f;
      const o = i * 16;
      m[o] = (1 - (yy + zz)) * sx;
      m[o + 1] = (xy + wz) * sx;
      m[o + 2] = (xz - wy) * sx;
      m[o + 3] = 0;
      m[o + 4] = (xy - wz) * sy;
      m[o + 5] = (1 - (xx + zz)) * sy;
      m[o + 6] = (yz + wx) * sy;
      m[o + 7] = 0;
      m[o + 8] = (xz + wy) * sz;
      m[o + 9] = (yz - wx) * sz;
      m[o + 10] = (1 - (xx + yy)) * sz;
      m[o + 11] = 0;
      m[o + 12] = this.px[i];
      m[o + 13] = this.py[i];
      m[o + 14] = this.pz[i];
      m[o + 15] = 1;
      const k = i * 3;
      c[k] = this.cr[i];
      c[k + 1] = this.cg[i];
      c[k + 2] = this.cb[i];
    }
    this.mesh.count = this.count;
    const im = this.mesh.instanceMatrix;
    im.clearUpdateRanges();
    if (this.count > 0) im.addUpdateRange(0, this.count * 16);
    im.needsUpdate = true;
    const ic = this.mesh.instanceColor;
    if (ic) {
      ic.clearUpdateRanges();
      if (this.count > 0) ic.addUpdateRange(0, this.count * 3);
      ic.needsUpdate = true;
    }
  }
}
