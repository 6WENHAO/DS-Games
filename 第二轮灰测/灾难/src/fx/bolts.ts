import * as THREE from 'three';

interface Bolt {
  core: THREE.LineSegments;
  halo: THREE.LineSegments;
  coreGeo: THREE.BufferGeometry;
  haloGeo: THREE.BufferGeometry;
  corePos: Float32Array;
  haloPos: Float32Array;
  life: number;
  dur: number;
  flick: number;
  active: boolean;
}

const POOL = 5;
const SEGS = 150; // segments per bolt (incl. branches)

/**
 * Procedural forked lightning. Each strike rewrites a fixed-size line buffer,
 * flickers a few frames and lights a shared point light.
 */
export class LightningSystem {
  readonly group = new THREE.Group();
  readonly light: THREE.PointLight;
  private bolts: Bolt[] = [];

  constructor() {
    for (let i = 0; i < POOL; i++) {
      const corePos = new Float32Array(SEGS * 6);
      const haloPos = new Float32Array(SEGS * 6);
      const coreGeo = new THREE.BufferGeometry();
      const haloGeo = new THREE.BufferGeometry();
      const ca = new THREE.BufferAttribute(corePos, 3);
      const ha = new THREE.BufferAttribute(haloPos, 3);
      ca.setUsage(THREE.DynamicDrawUsage);
      ha.setUsage(THREE.DynamicDrawUsage);
      coreGeo.setAttribute('position', ca);
      haloGeo.setAttribute('position', ha);
      coreGeo.setDrawRange(0, 0);
      haloGeo.setDrawRange(0, 0);
      coreGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 100, 0), 500);
      haloGeo.boundingSphere = coreGeo.boundingSphere;
      const core = new THREE.LineSegments(
        coreGeo,
        new THREE.LineBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 1,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      const halo = new THREE.LineSegments(
        haloGeo,
        new THREE.LineBasicMaterial({
          color: 0x9fd8ff,
          transparent: true,
          opacity: 0.85,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      core.frustumCulled = false;
      halo.frustumCulled = false;
      core.visible = false;
      halo.visible = false;
      core.renderOrder = 7;
      halo.renderOrder = 7;
      this.group.add(halo, core);
      this.bolts.push({
        core,
        halo,
        coreGeo,
        haloGeo,
        corePos,
        haloPos,
        life: 0,
        dur: 0.28,
        flick: 0,
        active: false,
      });
    }
    this.light = new THREE.PointLight(0xdff0ff, 0, 130, 1.6);
    this.light.visible = false;
    this.group.add(this.light);
  }

  strike(x: number, z: number, topY = 150, tint = 0xffffff): void {
    let b: Bolt | null = null;
    for (const c of this.bolts)
      if (!c.active) {
        b = c;
        break;
      }
    if (!b) b = this.bolts[0];
    b.active = true;
    b.life = 0;
    b.dur = 0.3;
    b.flick = 0;
    (b.core.material as THREE.LineBasicMaterial).color.setHex(tint);

    let n = 0;
    const push = (
      arr: Float32Array,
      ax: number,
      ay: number,
      az: number,
      bx: number,
      by: number,
      bz: number,
      i: number,
    ): void => {
      const o = i * 6;
      arr[o] = ax;
      arr[o + 1] = ay;
      arr[o + 2] = az;
      arr[o + 3] = bx;
      arr[o + 4] = by;
      arr[o + 5] = bz;
    };

    // main channel: jittered walk from the cloud base to the target
    const steps = 22;
    let cx = x + (Math.random() - 0.5) * 24;
    let cy = topY;
    let cz = z + (Math.random() - 0.5) * 24;
    const branchStarts: Array<[number, number, number]> = [];
    for (let s = 0; s < steps && n < SEGS - 20; s++) {
      const t = (s + 1) / steps;
      const nx = x + (cx - x) * (1 - t) * 0.55 + (Math.random() - 0.5) * 7 * (1 - t * 0.6);
      const ny = topY * (1 - t);
      const nz = z + (cz - z) * (1 - t) * 0.55 + (Math.random() - 0.5) * 7 * (1 - t * 0.6);
      push(b.corePos, cx, cy, cz, nx, ny, nz, n);
      push(b.haloPos, cx + 0.7, cy, cz + 0.7, nx + 0.7, ny, nz + 0.7, n);
      n++;
      if (Math.random() < 0.35) branchStarts.push([nx, ny, nz]);
      cx = nx;
      cy = ny;
      cz = nz;
    }
    // forks
    for (const [bx0, by0, bz0] of branchStarts) {
      if (n >= SEGS - 4) break;
      let px = bx0;
      let py = by0;
      let pz = bz0;
      const len = 2 + ((Math.random() * 4) | 0);
      let dx = (Math.random() - 0.5) * 12;
      let dz = (Math.random() - 0.5) * 12;
      for (let k = 0; k < len && n < SEGS - 1; k++) {
        const nx = px + dx * 0.6;
        const ny = py - Math.random() * 9 - 3;
        const nz = pz + dz * 0.6;
        push(b.corePos, px, py, pz, nx, ny, nz, n);
        push(b.haloPos, px + 0.6, py, pz + 0.6, nx + 0.6, ny, nz + 0.6, n);
        n++;
        px = nx;
        py = ny;
        pz = nz;
        dx *= 0.7;
        dz *= 0.7;
        if (ny < 2) break;
      }
    }

    b.coreGeo.setDrawRange(0, n * 2);
    b.haloGeo.setDrawRange(0, n * 2);
    const ca = b.coreGeo.getAttribute('position') as THREE.BufferAttribute;
    const ha = b.haloGeo.getAttribute('position') as THREE.BufferAttribute;
    ca.clearUpdateRanges();
    ha.clearUpdateRanges();
    ca.addUpdateRange(0, n * 6);
    ha.addUpdateRange(0, n * 6);
    ca.needsUpdate = true;
    ha.needsUpdate = true;
    b.core.visible = true;
    b.halo.visible = true;

    this.light.position.set(x, 14, z);
    this.light.intensity = 900;
    this.light.visible = true;
  }

  clear(): void {
    for (const b of this.bolts) {
      b.active = false;
      b.core.visible = false;
      b.halo.visible = false;
    }
    this.light.visible = false;
    this.light.intensity = 0;
  }

  update(dt: number): void {
    for (const b of this.bolts) {
      if (!b.active) continue;
      b.life += dt;
      b.flick += dt;
      const p = b.life / b.dur;
      if (p >= 1) {
        b.active = false;
        b.core.visible = false;
        b.halo.visible = false;
        continue;
      }
      const on = b.flick % 0.07 < 0.045;
      const a = (1 - p) * (on ? 1 : 0.25);
      (b.core.material as THREE.LineBasicMaterial).opacity = a;
      (b.halo.material as THREE.LineBasicMaterial).opacity = a * 0.7;
    }
    if (this.light.visible) {
      this.light.intensity *= Math.max(0, 1 - dt * 9);
      if (this.light.intensity < 3) {
        this.light.intensity = 0;
        this.light.visible = false;
      }
    }
  }
}
