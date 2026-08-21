import * as THREE from 'three';

interface Wave {
  mesh: THREE.Mesh;
  mat: THREE.Material & { opacity: number };
  t: number;
  dur: number;
  r0: number;
  r1: number;
  flat: number;
  alpha: number;
  active: boolean;
}

const RINGS = 18;
const SPHERES = 12;

/**
 * Expanding blast geometry: flat ground rings and glowing spherical shells /
 * fireballs. Fixed pools, additive, no allocation after construction.
 */
export class ShockwaveSystem {
  readonly group = new THREE.Group();
  private rings: Wave[] = [];
  private spheres: Wave[] = [];
  private sphereUniforms: Array<{ uColor: { value: THREE.Color }; uOpacity: { value: number }; uCore: { value: number } }> = [];

  constructor() {
    const ringGeo = new THREE.RingGeometry(0.7, 1, 80, 1);
    ringGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < RINGS; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: true,
      });
      const mesh = new THREE.Mesh(ringGeo, mat);
      mesh.visible = false;
      mesh.frustumCulled = false;
      mesh.renderOrder = 4;
      this.group.add(mesh);
      this.rings.push({ mesh, mat, t: 0, dur: 1, r0: 1, r1: 10, flat: 1, alpha: 1, active: false });
    }

    const sphereGeo = new THREE.SphereGeometry(1, 28, 18);
    for (let i = 0; i < SPHERES; i++) {
      const uniforms = {
        uColor: { value: new THREE.Color(0xffffff) },
        uOpacity: { value: 0 },
        uCore: { value: 0 },
      };
      this.sphereUniforms.push(uniforms);
      const mat = new THREE.ShaderMaterial({
        uniforms,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        vertexShader: `
          varying vec3 vN; varying vec3 vP;
          void main() {
            vN = normalize( normalMatrix * normal );
            vec4 mv = modelViewMatrix * vec4( position, 1.0 );
            vP = mv.xyz;
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: `
          uniform vec3 uColor; uniform float uOpacity; uniform float uCore;
          varying vec3 vN; varying vec3 vP;
          void main() {
            vec3 V = normalize( -vP );
            float rim = pow( 1.0 - abs( dot( normalize( vN ), V ) ), 2.4 );
            float a = mix( rim, 0.55 + rim * 0.85, uCore );
            gl_FragColor = vec4( uColor * a * uOpacity, 1.0 );
          }`,
      });
      const mesh = new THREE.Mesh(sphereGeo, mat);
      mesh.visible = false;
      mesh.frustumCulled = false;
      mesh.renderOrder = 4;
      this.group.add(mesh);
      this.spheres.push({
        mesh,
        mat: mat as unknown as THREE.Material & { opacity: number },
        t: 0,
        dur: 1,
        r0: 1,
        r1: 10,
        flat: 1,
        alpha: 1,
        active: false,
      });
    }
  }

  private take(pool: Wave[]): Wave {
    for (const w of pool) if (!w.active) return w;
    let oldest = pool[0];
    let best = -1;
    for (const w of pool) {
      const p = w.t / w.dur;
      if (p > best) {
        best = p;
        oldest = w;
      }
    }
    return oldest;
  }

  /** Flat expanding ground ring. */
  ring(
    x: number,
    y: number,
    z: number,
    r0: number,
    r1: number,
    dur: number,
    hex: number,
    alpha = 1,
  ): void {
    const w = this.take(this.rings);
    w.active = true;
    w.t = 0;
    w.dur = dur;
    w.r0 = r0;
    w.r1 = r1;
    w.alpha = alpha;
    w.flat = 1;
    w.mesh.visible = true;
    w.mesh.position.set(x, y, z);
    (w.mat as THREE.MeshBasicMaterial).color.setHex(hex);
  }

  /** Spherical shell (core = 0) or solid fireball (core = 1). */
  sphere(
    x: number,
    y: number,
    z: number,
    r0: number,
    r1: number,
    dur: number,
    hex: number,
    alpha = 1,
    core = 0,
    flatten = 1,
  ): void {
    const idx = this.spheres.indexOf(this.take(this.spheres));
    const w = this.spheres[idx];
    w.active = true;
    w.t = 0;
    w.dur = dur;
    w.r0 = r0;
    w.r1 = r1;
    w.alpha = alpha;
    w.flat = flatten;
    w.mesh.visible = true;
    w.mesh.position.set(x, y, z);
    this.sphereUniforms[idx].uColor.value.setHex(hex);
    this.sphereUniforms[idx].uCore.value = core;
  }

  clear(): void {
    for (const w of this.rings) {
      w.active = false;
      w.mesh.visible = false;
    }
    for (const w of this.spheres) {
      w.active = false;
      w.mesh.visible = false;
    }
  }

  update(dt: number): void {
    for (const w of this.rings) {
      if (!w.active) continue;
      w.t += dt;
      const p = Math.min(1, w.t / w.dur);
      const r = w.r0 + (w.r1 - w.r0) * (1 - (1 - p) * (1 - p));
      w.mesh.scale.set(r, 1, r);
      (w.mat as THREE.MeshBasicMaterial).opacity = w.alpha * (1 - p) * (1 - p);
      if (p >= 1) {
        w.active = false;
        w.mesh.visible = false;
      }
    }
    for (let i = 0; i < this.spheres.length; i++) {
      const w = this.spheres[i];
      if (!w.active) continue;
      w.t += dt;
      const p = Math.min(1, w.t / w.dur);
      const r = w.r0 + (w.r1 - w.r0) * (1 - (1 - p) * (1 - p) * (1 - p));
      w.mesh.scale.set(r, r * w.flat, r);
      this.sphereUniforms[i].uOpacity.value = w.alpha * (1 - p) ** 1.6;
      if (p >= 1) {
        w.active = false;
        w.mesh.visible = false;
      }
    }
  }
}
