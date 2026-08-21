import * as THREE from 'three';
import type { RigidSink } from '../world/city';
import type { VoxelField } from '../world/voxels';
import type { DebrisSystem } from './debris';

export interface ChunkHooks {
  /** Heavy ground contact: shake + rumble + carve. */
  onLand: (x: number, y: number, z: number, power: number, reach: number) => void;
  /** Dust puff request. */
  onDust: (x: number, y: number, z: number, amount: number, spread: number) => void;
}

interface Group {
  active: boolean;
  mode: 0 | 1; // 0 = topple about a hinge, 1 = free fall (pancake collapse)
  px: number;
  py: number;
  pz: number;
  axX: number;
  axY: number;
  axZ: number;
  angle: number;
  angVel: number;
  offY: number;
  velY: number;
  minY: number;
  reach: number;
  dirX: number;
  dirZ: number;
  dust: number;
  chunks: number;
}

const MAX_GROUPS = 10;

/**
 * Rigid-body groups for building failure: a toppling tower rotates about a base
 * hinge, a pancaking floor stack drops straight down. On impact the pieces
 * convert into pooled debris, so nothing accumulates.
 */
export class ChunkSystem implements RigidSink {
  readonly mesh: THREE.InstancedMesh;
  count = 0;
  readonly cap: number;
  readonly groups: Group[] = [];

  private lx: Float32Array;
  private ly: Float32Array;
  private lz: Float32Array;
  private sx: Float32Array;
  private sy: Float32Array;
  private sz: Float32Array;
  private cr: Float32Array;
  private cg: Float32Array;
  private cb: Float32Array;
  private gi: Int32Array;

  private mArr: Float32Array;
  private cArr: Float32Array;
  private rot = new Float32Array(MAX_GROUPS * 9);
  private pos = new Float32Array(MAX_GROUPS * 3);
  private q = new THREE.Quaternion();
  private m3 = new THREE.Matrix4();
  private axis = new THREE.Vector3();

  constructor(
    cap: number,
    private readonly field: VoxelField,
    private readonly debris: DebrisSystem,
    private readonly killVoxel: (id: number) => void,
    private readonly hooks: ChunkHooks,
    private readonly debrisBudget: () => number,
  ) {
    this.cap = cap;
    const f = (n: number): Float32Array => new Float32Array(n);
    this.lx = f(cap);
    this.ly = f(cap);
    this.lz = f(cap);
    this.sx = f(cap);
    this.sy = f(cap);
    this.sz = f(cap);
    this.cr = f(cap);
    this.cg = f(cap);
    this.cb = f(cap);
    this.gi = new Int32Array(cap);

    for (let i = 0; i < MAX_GROUPS; i++)
      this.groups.push({
        active: false,
        mode: 0,
        px: 0,
        py: 0,
        pz: 0,
        axX: 0,
        axY: 1,
        axZ: 0,
        angle: 0,
        angVel: 0,
        offY: 0,
        velY: 0,
        minY: 0,
        reach: 1,
        dirX: 1,
        dirZ: 0,
        dust: 0,
        chunks: 0,
      });

    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, cap);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const col = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
    col.setUsage(THREE.DynamicDrawUsage);
    this.mesh.instanceColor = col;
    this.mesh.castShadow = true;
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mArr = this.mesh.instanceMatrix.array as Float32Array;
    this.cArr = col.array as Float32Array;
  }

  get activeGroups(): number {
    let n = 0;
    for (const g of this.groups) if (g.active) n++;
    return n;
  }

  clear(): void {
    this.count = 0;
    this.mesh.count = 0;
    for (const g of this.groups) g.active = false;
  }

  spawnGroup(
    ids: number[],
    mode: 'topple' | 'fall',
    pivot: THREE.Vector3,
    axis: THREE.Vector3,
    spin: number,
  ): void {
    let gIdx = -1;
    for (let i = 0; i < MAX_GROUPS; i++)
      if (!this.groups[i].active) {
        gIdx = i;
        break;
      }
    const avail = this.cap - this.count;
    if (gIdx < 0 || avail < 8) {
      // No room for a rigid group: shatter straight into debris instead.
      const budget = Math.min(ids.length, this.debrisBudget());
      for (let i = 0; i < ids.length; i++) {
        const id = ids[i];
        if (i < budget)
          this.debris.spawnFromVoxel(
            this.field,
            id,
            (Math.random() - 0.5) * 6,
            Math.random() * 4,
            (Math.random() - 0.5) * 6,
          );
        this.killVoxel(id);
      }
      this.hooks.onDust(pivot.x, pivot.y + 2, pivot.z, 14, 6);
      return;
    }

    const g = this.groups[gIdx];
    g.active = true;
    g.mode = mode === 'topple' ? 0 : 1;
    g.px = pivot.x;
    g.py = pivot.y;
    g.pz = pivot.z;
    this.axis.copy(axis).normalize();
    g.axX = this.axis.x;
    g.axY = this.axis.y;
    g.axZ = this.axis.z;
    g.angle = 0;
    g.angVel = 0.12 * spin;
    g.offY = 0;
    g.velY = 0;
    g.dust = 0;
    g.minY = 1e9;
    g.reach = 1;
    // fall direction is perpendicular to the hinge
    g.dirX = -this.axis.z;
    g.dirZ = this.axis.x;

    const take = Math.min(ids.length, avail);
    let placed = 0;
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      if (placed < take) {
        const k = this.count++;
        placed++;
        this.lx[k] = this.field.posX[id] - pivot.x;
        this.ly[k] = this.field.posY[id] - pivot.y;
        this.lz[k] = this.field.posZ[id] - pivot.z;
        this.sx[k] = this.field.sclX[id];
        this.sy[k] = this.field.sclY[id];
        this.sz[k] = this.field.sclZ[id];
        const burn = 1 - 0.6 * this.field.burn[id];
        this.cr[k] = this.field.colR[id] * burn;
        this.cg[k] = this.field.colG[id] * burn;
        this.cb[k] = this.field.colB[id] * burn;
        this.gi[k] = gIdx;
        if (this.ly[k] < g.minY) g.minY = this.ly[k];
        const r = Math.hypot(this.lx[k], this.ly[k], this.lz[k]);
        if (r > g.reach) g.reach = r;
      } else if (placed > 0 && i % 3 === 0) {
        this.debris.spawnFromVoxel(
          this.field,
          id,
          (Math.random() - 0.5) * 5,
          Math.random() * 3,
          (Math.random() - 0.5) * 5,
        );
      }
      this.killVoxel(id);
    }
    g.chunks = placed;
    if (g.minY > 1e8) g.minY = 0;
    this.hooks.onDust(pivot.x, pivot.y + 1.5, pivot.z, 12, Math.min(10, g.reach * 0.4));
  }

  update(dt: number): void {
    let anyActive = false;
    for (let gi = 0; gi < MAX_GROUPS; gi++) {
      const g = this.groups[gi];
      if (!g.active) continue;
      anyActive = true;
      if (g.mode === 0) {
        const acc = (11.5 / Math.sqrt(Math.max(6, g.reach))) * (0.34 + Math.sin(Math.min(1.57, g.angle)));
        g.angVel += acc * dt;
        g.angle += g.angVel * dt;
        g.dust -= dt;
        if (g.dust <= 0) {
          g.dust = 0.09;
          const t = Math.random();
          this.hooks.onDust(
            g.px + g.dirX * g.reach * t * 0.8 + (Math.random() - 0.5) * 4,
            0.6 + Math.random() * 3,
            g.pz + g.dirZ * g.reach * t * 0.8 + (Math.random() - 0.5) * 4,
            2,
            3,
          );
        }
        if (g.angle >= 1.46) this.land(gi, g);
      } else {
        g.velY -= 27 * dt;
        g.offY += g.velY * dt;
        g.angle += dt * 0.22;
        g.dust -= dt;
        if (g.dust <= 0) {
          g.dust = 0.07;
          this.hooks.onDust(
            g.px + (Math.random() - 0.5) * g.reach,
            g.py + g.offY + Math.random() * 3,
            g.pz + (Math.random() - 0.5) * g.reach,
            2,
            3,
          );
        }
        const bottom = g.py + g.offY + g.minY;
        if (bottom <= 0.35) this.land(gi, g);
      }
    }
    if (anyActive || this.count > 0) this.write();
  }

  private land(gi: number, g: Group): void {
    const budget = this.debrisBudget();
    let spawned = 0;
    const tipX = g.px + g.dirX * g.reach * 0.7;
    const tipZ = g.pz + g.dirZ * g.reach * 0.7;
    // Recompute the group transform once so debris starts where it looks.
    this.buildTransform(gi, g);
    const r = this.rot;
    const p = this.pos;
    const ro = gi * 9;
    const po = gi * 3;
    for (let i = 0; i < this.count; i++) {
      if (this.gi[i] !== gi) continue;
      const lx = this.lx[i];
      const ly = this.ly[i];
      const lz = this.lz[i];
      const wx = p[po] + r[ro] * lx + r[ro + 3] * ly + r[ro + 6] * lz;
      const wy = p[po + 1] + r[ro + 1] * lx + r[ro + 4] * ly + r[ro + 7] * lz;
      const wz = p[po + 2] + r[ro + 2] * lx + r[ro + 5] * ly + r[ro + 8] * lz;
      if (spawned < budget && (i & 1) === 0) {
        spawned++;
        const outX = wx - g.px;
        const outZ = wz - g.pz;
        const d = Math.max(1, Math.hypot(outX, outZ));
        const sp = 3 + Math.random() * 7;
        this.debris.spawn(
          wx,
          Math.max(0.4, wy),
          wz,
          (outX / d) * sp + g.dirX * 3,
          2 + Math.random() * 7,
          (outZ / d) * sp + g.dirZ * 3,
          this.sx[i],
          this.sy[i],
          this.sz[i],
          this.cr[i],
          this.cg[i],
          this.cb[i],
        );
      } else if (Math.random() < 0.1) {
        this.hooks.onDust(wx, Math.max(0.6, wy), wz, 1, 2);
      }
    }
    g.active = false;
    this.hooks.onLand(tipX, 1, tipZ, Math.min(1, g.reach / 26), g.reach);
    this.compact();
  }

  /** Drop every chunk belonging to a finished group. */
  private compact(): void {
    let w = 0;
    for (let i = 0; i < this.count; i++) {
      const g = this.groups[this.gi[i]];
      if (!g.active) continue;
      if (w !== i) {
        this.lx[w] = this.lx[i];
        this.ly[w] = this.ly[i];
        this.lz[w] = this.lz[i];
        this.sx[w] = this.sx[i];
        this.sy[w] = this.sy[i];
        this.sz[w] = this.sz[i];
        this.cr[w] = this.cr[i];
        this.cg[w] = this.cg[i];
        this.cb[w] = this.cb[i];
        this.gi[w] = this.gi[i];
      }
      w++;
    }
    this.count = w;
    this.mesh.count = w;
  }

  private buildTransform(gi: number, g: Group): void {
    this.axis.set(g.axX, g.axY, g.axZ);
    this.q.setFromAxisAngle(this.axis, g.angle);
    this.m3.makeRotationFromQuaternion(this.q);
    const e = this.m3.elements;
    const o = gi * 9;
    this.rot[o] = e[0];
    this.rot[o + 1] = e[1];
    this.rot[o + 2] = e[2];
    this.rot[o + 3] = e[4];
    this.rot[o + 4] = e[5];
    this.rot[o + 5] = e[6];
    this.rot[o + 6] = e[8];
    this.rot[o + 7] = e[9];
    this.rot[o + 8] = e[10];
    const p = gi * 3;
    this.pos[p] = g.px;
    this.pos[p + 1] = g.py + g.offY;
    this.pos[p + 2] = g.pz;
  }

  private write(): void {
    for (let gi = 0; gi < MAX_GROUPS; gi++) {
      const g = this.groups[gi];
      if (g.active) this.buildTransform(gi, g);
    }
    const m = this.mArr;
    const c = this.cArr;
    const r = this.rot;
    const p = this.pos;
    for (let i = 0; i < this.count; i++) {
      const ro = this.gi[i] * 9;
      const po = this.gi[i] * 3;
      const lx = this.lx[i];
      const ly = this.ly[i];
      const lz = this.lz[i];
      const o = i * 16;
      const sx = this.sx[i];
      const sy = this.sy[i];
      const sz = this.sz[i];
      m[o] = r[ro] * sx;
      m[o + 1] = r[ro + 1] * sx;
      m[o + 2] = r[ro + 2] * sx;
      m[o + 3] = 0;
      m[o + 4] = r[ro + 3] * sy;
      m[o + 5] = r[ro + 4] * sy;
      m[o + 6] = r[ro + 5] * sy;
      m[o + 7] = 0;
      m[o + 8] = r[ro + 6] * sz;
      m[o + 9] = r[ro + 7] * sz;
      m[o + 10] = r[ro + 8] * sz;
      m[o + 11] = 0;
      m[o + 12] = p[po] + r[ro] * lx + r[ro + 3] * ly + r[ro + 6] * lz;
      m[o + 13] = p[po + 1] + r[ro + 1] * lx + r[ro + 4] * ly + r[ro + 7] * lz;
      m[o + 14] = p[po + 2] + r[ro + 2] * lx + r[ro + 5] * ly + r[ro + 8] * lz;
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
