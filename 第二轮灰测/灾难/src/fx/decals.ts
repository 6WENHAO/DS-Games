import * as THREE from 'three';

/** Procedural soft radial sprite used for every ground mark (no external art). */
function makeDecalTexture(): THREE.Texture {
  const s = 128;
  const cv = document.createElement('canvas');
  cv.width = s;
  cv.height = s;
  const ctx = cv.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.55, 'rgba(255,255,255,0.86)');
    g.addColorStop(0.82, 'rgba(255,255,255,0.34)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    // ragged rim so scorch marks are not perfect circles
    ctx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 90; i++) {
      const a = (i / 90) * Math.PI * 2;
      const r = s * 0.36 + Math.random() * s * 0.16;
      const rad = 3 + Math.random() * 9;
      ctx.beginPath();
      ctx.arc(s / 2 + Math.cos(a) * r, s / 2 + Math.sin(a) * r, rad, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0,0,0,${0.1 + Math.random() * 0.28})`;
      ctx.fill();
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

interface Decal {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  used: boolean;
}

const POOL = 54;

/** Ground scorch / crater marks with a recycling pool. */
export class DecalSystem {
  readonly group = new THREE.Group();
  private pool: Decal[] = [];
  private cursor = 0;
  private tex: THREE.Texture;

  constructor() {
    this.tex = makeDecalTexture();
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.rotateX(-Math.PI / 2);
    for (let i = 0; i < POOL; i++) {
      const mat = new THREE.MeshBasicMaterial({
        map: this.tex,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -3,
        polygonOffsetUnits: -3,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.visible = false;
      mesh.frustumCulled = false;
      mesh.renderOrder = 2;
      this.group.add(mesh);
      this.pool.push({ mesh, mat, used: false });
    }
  }

  add(x: number, z: number, radius: number, hex: number, opacity: number, y = 0.18): void {
    const d = this.pool[this.cursor];
    this.cursor = (this.cursor + 1) % POOL;
    d.used = true;
    d.mesh.visible = true;
    d.mesh.position.set(x, y, z);
    d.mesh.scale.set(radius * 2, 1, radius * 2);
    d.mesh.rotation.y = Math.random() * Math.PI * 2;
    d.mat.color.setHex(hex);
    d.mat.opacity = opacity;
  }

  /** Layered impact crater: dark core, brown ring, wide scorch. */
  crater(x: number, z: number, radius: number): void {
    this.add(x, z, radius * 1.45, 0x2c2118, 0.42, 0.17);
    this.add(x, z, radius * 1.0, 0x1a1410, 0.72, 0.19);
    this.add(x, z, radius * 0.62, 0x0d0a08, 0.9, 0.21);
    this.add(x, z, radius * 0.34, 0x5a3a24, 0.5, 0.23);
  }

  scorch(x: number, z: number, radius: number, strength = 1): void {
    this.add(x, z, radius * 1.25, 0x3a2c20, 0.3 * strength, 0.17);
    this.add(x, z, radius * 0.8, 0x171210, 0.62 * strength, 0.19);
  }

  clear(): void {
    for (const d of this.pool) {
      d.used = false;
      d.mesh.visible = false;
      d.mat.opacity = 0;
    }
    this.cursor = 0;
  }
}
