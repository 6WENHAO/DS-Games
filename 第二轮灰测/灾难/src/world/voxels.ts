import * as THREE from 'three';
import { CITY_HALF } from './layout';

/** Voxel role — drives destruction behaviour and looks. */
export const K_WALL = 0;
export const K_WINDOW = 1;
export const K_SLAB = 2;
export const K_ROOF = 3;
export const K_PROP = 4;
export const K_LEAF = 5;

/** Global uniforms shared by every voxel draw call (earthquake sway on GPU). */
export const swayUniforms = {
  uTime: { value: 0 },
  uQuake: { value: 0 },
};

/** MeshLambert + a tiny vertex-shader bend so a whole city can sway for free. */
export function makeVoxelMaterial(): THREE.MeshLambertMaterial {
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = swayUniforms.uTime;
    shader.uniforms.uQuake = swayUniforms.uQuake;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uTime;
        uniform float uQuake;
        float vxHash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }`,
      )
      .replace(
        '#include <project_vertex>',
        `vec4 mvPosition = vec4( transformed, 1.0 );
        #ifdef USE_INSTANCING
          mvPosition = instanceMatrix * mvPosition;
          if ( uQuake > 0.0002 ) {
            vec3 iPos = instanceMatrix[ 3 ].xyz;
            float ph = vxHash( floor( iPos.xz * 0.135 ) ) * 6.2831853;
            float hf = clamp( mvPosition.y * 0.055, 0.0, 1.7 );
            mvPosition.x += uQuake * hf * sin( uTime * 8.7 + ph );
            mvPosition.z += uQuake * hf * cos( uTime * 7.1 + ph * 1.7 );
          }
        #endif
        mvPosition = modelViewMatrix * mvPosition;
        gl_Position = projectionMatrix * mvPosition;`,
      );
  };
  mat.customProgramCacheKey = () => 'voxel-sway-v1';
  return mat;
}

/** Growable staging buffer used only while the city is being generated. */
export class VoxelBuilder {
  px: number[] = [];
  py: number[] = [];
  pz: number[] = [];
  sx: number[] = [];
  sy: number[] = [];
  sz: number[] = [];
  cr: number[] = [];
  cg: number[] = [];
  cb: number[] = [];
  bid: number[] = [];
  lvl: number[] = [];
  knd: number[] = [];
  private tmp = new THREE.Color();

  add(
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    hex: number,
    building: number,
    level: number,
    kind: number,
    shade = 1,
  ): number {
    this.tmp.setHex(hex);
    this.px.push(x);
    this.py.push(y);
    this.pz.push(z);
    this.sx.push(sx);
    this.sy.push(sy);
    this.sz.push(sz);
    this.cr.push(this.tmp.r * shade);
    this.cg.push(this.tmp.g * shade);
    this.cb.push(this.tmp.b * shade);
    this.bid.push(building);
    this.lvl.push(level);
    this.knd.push(kind);
    return this.px.length - 1;
  }

  get length(): number {
    return this.px.length;
  }
}

const CELL = 4;
const HEIGHT_RES = 1;

/**
 * The destructible city body: one InstancedMesh, swap-remove slot management,
 * a CSR spatial grid for blast queries and a column height field so debris can
 * land on rooftops.
 */
export class VoxelField {
  readonly mesh: THREE.InstancedMesh;
  readonly total: number;
  count = 0;

  readonly posX: Float32Array;
  readonly posY: Float32Array;
  readonly posZ: Float32Array;
  readonly sclX: Float32Array;
  readonly sclY: Float32Array;
  readonly sclZ: Float32Array;
  readonly colR: Float32Array;
  readonly colG: Float32Array;
  readonly colB: Float32Array;
  readonly building: Int32Array;
  readonly level: Uint8Array;
  readonly kind: Uint8Array;
  readonly alive: Uint8Array;
  readonly burn: Float32Array;

  private slot: Int32Array;
  private slotToId: Int32Array;
  private mArr: Float32Array;
  private cArr: Float32Array;

  private mDirtyMin = 1e9;
  private mDirtyMax = -1;
  private cDirtyMin = 1e9;
  private cDirtyMax = -1;

  // CSR spatial grid over XZ
  private gridN: number;
  private gridMin: number;
  private cellStart: Int32Array;
  private cellItems: Int32Array;

  // column height field (top surface of the tallest alive voxel per column)
  private hN: number;
  private hMin: number;
  private height: Float32Array;
  private heightBase: Float32Array;

  constructor(b: VoxelBuilder) {
    const n = b.length;
    this.total = n;
    this.posX = new Float32Array(b.px);
    this.posY = new Float32Array(b.py);
    this.posZ = new Float32Array(b.pz);
    this.sclX = new Float32Array(b.sx);
    this.sclY = new Float32Array(b.sy);
    this.sclZ = new Float32Array(b.sz);
    this.colR = new Float32Array(b.cr);
    this.colG = new Float32Array(b.cg);
    this.colB = new Float32Array(b.cb);
    this.building = new Int32Array(b.bid);
    this.level = new Uint8Array(b.lvl);
    this.kind = new Uint8Array(b.knd);
    this.alive = new Uint8Array(n);
    this.burn = new Float32Array(n);
    this.slot = new Int32Array(n);
    this.slotToId = new Int32Array(n);

    const geo = new THREE.BoxGeometry(1, 1, 1);
    this.mesh = new THREE.InstancedMesh(geo, makeVoxelMaterial(), n);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const colAttr = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
    colAttr.setUsage(THREE.DynamicDrawUsage);
    this.mesh.instanceColor = colAttr;
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    this.mesh.matrixAutoUpdate = false;
    this.mesh.updateMatrix();
    this.mArr = this.mesh.instanceMatrix.array as Float32Array;
    this.cArr = colAttr.array as Float32Array;

    // ---- spatial grid
    const span = CITY_HALF + 40;
    this.gridMin = -span;
    this.gridN = Math.ceil((span * 2) / CELL);
    const cells = this.gridN * this.gridN;
    const counts = new Int32Array(cells + 1);
    const cellOf = (x: number, z: number): number => {
      const gx = Math.min(this.gridN - 1, Math.max(0, ((x - this.gridMin) / CELL) | 0));
      const gz = Math.min(this.gridN - 1, Math.max(0, ((z - this.gridMin) / CELL) | 0));
      return gz * this.gridN + gx;
    };
    for (let i = 0; i < n; i++) counts[cellOf(this.posX[i], this.posZ[i])]++;
    this.cellStart = new Int32Array(cells + 1);
    let acc = 0;
    for (let c = 0; c < cells; c++) {
      this.cellStart[c] = acc;
      acc += counts[c];
    }
    this.cellStart[cells] = acc;
    this.cellItems = new Int32Array(acc);
    const cursor = this.cellStart.slice(0, cells);
    for (let i = 0; i < n; i++) this.cellItems[cursor[cellOf(this.posX[i], this.posZ[i])]++] = i;

    // ---- height field
    this.hMin = -span;
    this.hN = Math.ceil((span * 2) / HEIGHT_RES);
    this.heightBase = new Float32Array(this.hN * this.hN);
    for (let i = 0; i < n; i++) {
      const top = this.posY[i] + this.sclY[i] * 0.5;
      const gx = ((this.posX[i] - this.hMin) / HEIGHT_RES) | 0;
      const gz = ((this.posZ[i] - this.hMin) / HEIGHT_RES) | 0;
      if (gx < 0 || gz < 0 || gx >= this.hN || gz >= this.hN) continue;
      const k = gz * this.hN + gx;
      if (top > this.heightBase[k]) this.heightBase[k] = top;
    }
    this.height = this.heightBase.slice();

    this.resetAll();
  }

  // -------------------------------------------------------------- slot writes
  private writeSlot(s: number, id: number): void {
    const m = this.mArr;
    const o = s * 16;
    m[o] = this.sclX[id];
    m[o + 1] = 0;
    m[o + 2] = 0;
    m[o + 3] = 0;
    m[o + 4] = 0;
    m[o + 5] = this.sclY[id];
    m[o + 6] = 0;
    m[o + 7] = 0;
    m[o + 8] = 0;
    m[o + 9] = 0;
    m[o + 10] = this.sclZ[id];
    m[o + 11] = 0;
    m[o + 12] = this.posX[id];
    m[o + 13] = this.posY[id];
    m[o + 14] = this.posZ[id];
    m[o + 15] = 1;
    const c = s * 3;
    const k = 1 - 0.78 * this.burn[id];
    this.cArr[c] = this.colR[id] * k + this.burn[id] * 0.035;
    this.cArr[c + 1] = this.colG[id] * k + this.burn[id] * 0.026;
    this.cArr[c + 2] = this.colB[id] * k + this.burn[id] * 0.024;
  }

  private markMatrix(s: number): void {
    if (s < this.mDirtyMin) this.mDirtyMin = s;
    if (s > this.mDirtyMax) this.mDirtyMax = s;
  }

  private markColor(s: number): void {
    if (s < this.cDirtyMin) this.cDirtyMin = s;
    if (s > this.cDirtyMax) this.cDirtyMax = s;
  }

  /** Restore the pristine city (used at boot and by the rebuild button). */
  resetAll(): void {
    const n = this.total;
    this.alive.fill(1);
    this.burn.fill(0);
    for (let i = 0; i < n; i++) {
      this.slot[i] = i;
      this.slotToId[i] = i;
      this.writeSlot(i, i);
    }
    this.count = n;
    this.mesh.count = n;
    this.height.set(this.heightBase);
    this.mDirtyMin = 0;
    this.mDirtyMax = n - 1;
    this.cDirtyMin = 0;
    this.cDirtyMax = n - 1;
    this.flush();
  }

  /** Remove one voxel. Returns false when it was already gone. */
  kill(id: number): boolean {
    if (this.alive[id] === 0) return false;
    this.alive[id] = 0;
    const s = this.slot[id];
    const last = this.count - 1;
    if (s !== last) {
      const moved = this.slotToId[last];
      this.writeSlot(s, moved);
      this.slotToId[s] = moved;
      this.slot[moved] = s;
      this.markMatrix(s);
      this.markColor(s);
    }
    this.slot[id] = -1;
    this.count = last;
    this.mesh.count = last;
    // Lower the height field so debris does not float on a destroyed roof.
    const gx = ((this.posX[id] - this.hMin) / HEIGHT_RES) | 0;
    const gz = ((this.posZ[id] - this.hMin) / HEIGHT_RES) | 0;
    if (gx >= 0 && gz >= 0 && gx < this.hN && gz < this.hN) {
      const k = gz * this.hN + gx;
      const bottom = this.posY[id] - this.sclY[id] * 0.5;
      if (this.height[k] > bottom) this.height[k] = bottom;
    }
    return true;
  }

  /** Darken / char a voxel (0 = pristine, 1 = burnt). */
  scorch(id: number, amount: number): void {
    if (this.alive[id] === 0) return;
    const v = Math.min(1, Math.max(this.burn[id], amount));
    if (v <= this.burn[id] + 0.01) return;
    this.burn[id] = v;
    const s = this.slot[id];
    const c = s * 3;
    const k = 1 - 0.78 * v;
    this.cArr[c] = this.colR[id] * k + v * 0.035;
    this.cArr[c + 1] = this.colG[id] * k + v * 0.026;
    this.cArr[c + 2] = this.colB[id] * k + v * 0.024;
    this.markColor(s);
  }

  /** Push pending GPU uploads; called once per frame. */
  flush(): void {
    if (this.mDirtyMax >= this.mDirtyMin) {
      const attr = this.mesh.instanceMatrix;
      const span = this.mDirtyMax - this.mDirtyMin + 1;
      attr.clearUpdateRanges();
      if (span < this.total * 0.5) attr.addUpdateRange(this.mDirtyMin * 16, span * 16);
      attr.needsUpdate = true;
      this.mDirtyMin = 1e9;
      this.mDirtyMax = -1;
    }
    if (this.cDirtyMax >= this.cDirtyMin && this.mesh.instanceColor) {
      const attr = this.mesh.instanceColor;
      const span = this.cDirtyMax - this.cDirtyMin + 1;
      attr.clearUpdateRanges();
      if (span < this.total * 0.5) attr.addUpdateRange(this.cDirtyMin * 3, span * 3);
      attr.needsUpdate = true;
      this.cDirtyMin = 1e9;
      this.cDirtyMax = -1;
    }
  }

  // -------------------------------------------------------------- queries
  /** Visit every voxel (alive or not) whose column is inside the XZ disc. */
  queryDisc(cx: number, cz: number, r: number, visit: (id: number) => void): void {
    const g0x = Math.max(0, ((cx - r - this.gridMin) / CELL) | 0);
    const g1x = Math.min(this.gridN - 1, ((cx + r - this.gridMin) / CELL) | 0);
    const g0z = Math.max(0, ((cz - r - this.gridMin) / CELL) | 0);
    const g1z = Math.min(this.gridN - 1, ((cz + r - this.gridMin) / CELL) | 0);
    for (let gz = g0z; gz <= g1z; gz++) {
      const row = gz * this.gridN;
      for (let gx = g0x; gx <= g1x; gx++) {
        const c = row + gx;
        const e = this.cellStart[c + 1];
        for (let k = this.cellStart[c]; k < e; k++) visit(this.cellItems[k]);
      }
    }
  }

  /** Alive voxels inside a sphere, with normalised distance for falloff. */
  querySphere(
    cx: number,
    cy: number,
    cz: number,
    r: number,
    visit: (id: number, t: number) => void,
  ): void {
    const r2 = r * r;
    this.queryDisc(cx, cz, r, (id) => {
      if (this.alive[id] === 0) return;
      const dx = this.posX[id] - cx;
      const dy = this.posY[id] - cy;
      const dz = this.posZ[id] - cz;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 > r2) return;
      visit(id, Math.sqrt(d2) / r);
    });
  }

  /** Alive voxels inside a vertical cylinder (tornado / flood style fields). */
  queryCylinder(
    cx: number,
    cz: number,
    r: number,
    yMin: number,
    yMax: number,
    visit: (id: number, t: number) => void,
  ): void {
    const r2 = r * r;
    this.queryDisc(cx, cz, r, (id) => {
      if (this.alive[id] === 0) return;
      const y = this.posY[id];
      if (y < yMin || y > yMax) return;
      const dx = this.posX[id] - cx;
      const dz = this.posZ[id] - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 > r2) return;
      visit(id, Math.sqrt(d2) / r);
    });
  }

  /** Top surface height of the city at a world position (0 = bare ground). */
  surfaceAt(x: number, z: number): number {
    const gx = ((x - this.hMin) / HEIGHT_RES) | 0;
    const gz = ((z - this.hMin) / HEIGHT_RES) | 0;
    if (gx < 0 || gz < 0 || gx >= this.hN || gz >= this.hN) return 0;
    const h = this.height[gz * this.hN + gx];
    return h > 0 ? h : 0;
  }
}
