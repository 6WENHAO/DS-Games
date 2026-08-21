import * as THREE from 'three';
import { FORCE, FieldSet, sampleForce } from './fields';

/**
 * GPU-fed point sprite pool. Two instances exist: an additive one for sparks /
 * fire / flash motes and a soft alpha-blended one for smoke and dust.
 */
export class ParticleSystem {
  readonly points: THREE.Points;
  count = 0;
  readonly cap: number;

  private px: Float32Array;
  private py: Float32Array;
  private pz: Float32Array;
  private vx: Float32Array;
  private vy: Float32Array;
  private vz: Float32Array;
  private life: Float32Array;
  private maxLife: Float32Array;
  private s0: Float32Array;
  private s1: Float32Array;
  private cr: Float32Array;
  private cg: Float32Array;
  private cb: Float32Array;
  private al: Float32Array;
  private grav: Float32Array;
  private drag: Float32Array;
  private fs: Float32Array;

  private posAttr: THREE.BufferAttribute;
  private colAttr: THREE.BufferAttribute;
  private sizeAttr: THREE.BufferAttribute;
  private posArr: Float32Array;
  private colArr: Float32Array;
  private sizeArr: Float32Array;
  private uScale = { value: 700 };

  constructor(cap: number, additive: boolean) {
    this.cap = cap;
    const f = (n: number): Float32Array => new Float32Array(n);
    this.px = f(cap);
    this.py = f(cap);
    this.pz = f(cap);
    this.vx = f(cap);
    this.vy = f(cap);
    this.vz = f(cap);
    this.life = f(cap);
    this.maxLife = f(cap);
    this.s0 = f(cap);
    this.s1 = f(cap);
    this.cr = f(cap);
    this.cg = f(cap);
    this.cb = f(cap);
    this.al = f(cap);
    this.grav = f(cap);
    this.drag = f(cap);
    this.fs = f(cap);

    this.posArr = new Float32Array(cap * 3);
    this.colArr = new Float32Array(cap * 4);
    this.sizeArr = new Float32Array(cap);
    const geo = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(this.posArr, 3);
    this.colAttr = new THREE.BufferAttribute(this.colArr, 4);
    this.sizeAttr = new THREE.BufferAttribute(this.sizeArr, 1);
    this.posAttr.setUsage(THREE.DynamicDrawUsage);
    this.colAttr.setUsage(THREE.DynamicDrawUsage);
    this.sizeAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.posAttr);
    geo.setAttribute('aColor', this.colAttr);
    geo.setAttribute('aSize', this.sizeAttr);
    geo.setDrawRange(0, 0);
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 40, 0), 900);

    const mat = new THREE.ShaderMaterial({
      uniforms: { uScale: this.uScale },
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      vertexShader: `
        attribute vec4 aColor;
        attribute float aSize;
        uniform float uScale;
        varying vec4 vColor;
        void main() {
          vColor = aColor;
          vec4 mv = modelViewMatrix * vec4( position, 1.0 );
          gl_Position = projectionMatrix * mv;
          gl_PointSize = max( 1.0, aSize * uScale / max( 0.5, -mv.z ) );
        }`,
      fragmentShader: `
        varying vec4 vColor;
        void main() {
          vec2 d = gl_PointCoord - 0.5;
          float r2 = dot( d, d );
          if ( r2 > 0.25 ) discard;
          float a = ${additive ? 'smoothstep( 0.25, 0.0, r2 )' : 'smoothstep( 0.25, 0.03, r2 ) * 0.92'};
          gl_FragColor = vec4( vColor.rgb, vColor.a * a );
        }`,
    });

    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 6 : 5;
  }

  /** Convert world size to pixels for the current viewport. */
  setProjection(pixelHeight: number, projY: number): void {
    this.uScale.value = pixelHeight * 0.5 * projY;
  }

  clear(): void {
    this.count = 0;
    this.points.geometry.setDrawRange(0, 0);
  }

  spawn(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    life: number,
    size0: number,
    size1: number,
    r: number,
    g: number,
    b: number,
    alpha: number,
    grav: number,
    drag: number,
    fieldSens = 0.5,
  ): void {
    let i: number;
    if (this.count < this.cap) i = this.count++;
    else i = (Math.random() * this.cap) | 0;
    this.px[i] = x;
    this.py[i] = y;
    this.pz[i] = z;
    this.vx[i] = vx;
    this.vy[i] = vy;
    this.vz[i] = vz;
    this.life[i] = life;
    this.maxLife[i] = life;
    this.s0[i] = size0;
    this.s1[i] = size1;
    this.cr[i] = r;
    this.cg[i] = g;
    this.cb[i] = b;
    this.al[i] = alpha;
    this.grav[i] = grav;
    this.drag[i] = drag;
    this.fs[i] = fieldSens;
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
      cp(this.life);
      cp(this.maxLife);
      cp(this.s0);
      cp(this.s1);
      cp(this.cr);
      cp(this.cg);
      cp(this.cb);
      cp(this.al);
      cp(this.grav);
      cp(this.drag);
      cp(this.fs);
    }
    this.count = last;
  }

  update(dt: number, fields: FieldSet | null): void {
    const useFields = fields !== null && fields.anyActive;
    for (let i = this.count - 1; i >= 0; i--) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.free(i);
        continue;
      }
      let vx = this.vx[i];
      let vy = this.vy[i];
      let vz = this.vz[i];
      vy += this.grav[i] * dt;
      if (useFields && fields && this.fs[i] > 0) {
        sampleForce(fields, this.px[i], this.py[i], this.pz[i]);
        const k = this.fs[i] * dt;
        vx += FORCE.x * k;
        vy += FORCE.y * k;
        vz += FORCE.z * k;
      }
      const d = 1 - this.drag[i] * dt;
      vx *= d;
      vy *= d;
      vz *= d;
      this.px[i] += vx * dt;
      this.py[i] += vy * dt;
      this.pz[i] += vz * dt;
      if (this.py[i] < 0.15) {
        this.py[i] = 0.15;
        vy = Math.abs(vy) * 0.12;
        vx *= 0.9;
        vz *= 0.9;
      }
      this.vx[i] = vx;
      this.vy[i] = vy;
      this.vz[i] = vz;
    }
    this.write();
  }

  private write(): void {
    const p = this.posArr;
    const c = this.colArr;
    const s = this.sizeArr;
    for (let i = 0; i < this.count; i++) {
      const t = 1 - this.life[i] / this.maxLife[i];
      const o = i * 3;
      p[o] = this.px[i];
      p[o + 1] = this.py[i];
      p[o + 2] = this.pz[i];
      const k = i * 4;
      // fade in fast, out slow
      const fade = t < 0.12 ? t / 0.12 : 1 - (t - 0.12) / 0.88;
      c[k] = this.cr[i];
      c[k + 1] = this.cg[i];
      c[k + 2] = this.cb[i];
      c[k + 3] = this.al[i] * Math.max(0, fade);
      s[i] = this.s0[i] + (this.s1[i] - this.s0[i]) * t;
    }
    const n = this.count;
    this.points.geometry.setDrawRange(0, n);
    this.posAttr.clearUpdateRanges();
    this.colAttr.clearUpdateRanges();
    this.sizeAttr.clearUpdateRanges();
    if (n > 0) {
      this.posAttr.addUpdateRange(0, n * 3);
      this.colAttr.addUpdateRange(0, n * 4);
      this.sizeAttr.addUpdateRange(0, n);
    }
    this.posAttr.needsUpdate = true;
    this.colAttr.needsUpdate = true;
    this.sizeAttr.needsUpdate = true;
  }
}
