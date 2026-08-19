// Pooled instanced-cube particle system (Minecraft-style block break bits, dust, sparks).
import * as THREE from 'three';

const MAX = 480;

export class Particles {
  constructor(scene) {
    this.scene = scene;
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshBasicMaterial({ vertexColors: false, transparent: true, opacity: 1 });
    // custom shader for per-instance colour + fade
    this.mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true }), MAX);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = MAX;
    const colors = new Float32Array(MAX * 3);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
    this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    scene.add(this.mesh);

    this.p = [];
    for (let i = 0; i < MAX; i++) {
      this.p.push({ alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 1, size: 0.1, grav: 1, drag: 0.86, color: new THREE.Color(), spin: 0, rot: 0, glow: false });
    }
    this.head = 0;
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._s = new THREE.Vector3();
    this._v = new THREE.Vector3();
  }

  spawn(opts) {
    const p = this.p[this.head];
    this.head = (this.head + 1) % MAX;
    p.alive = true;
    p.x = opts.x; p.y = opts.y; p.z = opts.z;
    p.vx = opts.vx || 0; p.vy = opts.vy || 0; p.vz = opts.vz || 0;
    p.maxLife = opts.life || 0.8; p.life = p.maxLife;
    p.size = opts.size || 0.09;
    p.grav = opts.grav ?? 1;
    p.drag = opts.drag ?? 0.9;
    p.spin = opts.spin ?? (Math.random() - 0.5) * 6;
    p.rot = Math.random() * 6.28;
    p.glow = !!opts.glow;
    if (opts.color) p.color.set(opts.color);
    else p.color.setRGB(1, 1, 1);
    return p;
  }

  burst(x, y, z, color, n = 14, opts = {}) {
    const spread = opts.spread ?? 2.6;
    for (let i = 0; i < n; i++) {
      this.spawn({
        x: x + (Math.random() - 0.5) * (opts.jitter ?? 0.8),
        y: y + (Math.random() - 0.5) * (opts.jitter ?? 0.8),
        z: z + (Math.random() - 0.5) * (opts.jitter ?? 0.8),
        vx: (Math.random() - 0.5) * spread,
        vy: Math.random() * spread * (opts.up ?? 0.8) + (opts.upBias ?? 0.6),
        vz: (Math.random() - 0.5) * spread,
        life: (opts.life ?? 0.9) * (0.6 + Math.random() * 0.7),
        size: (opts.size ?? 0.1) * (0.6 + Math.random() * 0.8),
        color, grav: opts.grav ?? 1, drag: opts.drag ?? 0.9, glow: opts.glow,
      });
    }
  }

  trail(x, y, z, color, opts = {}) {
    this.spawn({
      x, y, z,
      vx: (Math.random() - 0.5) * (opts.spread || 0.3),
      vy: (Math.random() - 0.5) * (opts.spread || 0.3) + (opts.up || 0),
      vz: (Math.random() - 0.5) * (opts.spread || 0.3),
      life: opts.life || 0.5, size: opts.size || 0.08, color,
      grav: opts.grav ?? 0, drag: opts.drag ?? 0.94, glow: opts.glow ?? true,
    });
  }

  update(dt, world) {
    const m = this._m, q = this._q, e = this._e, s = this._s;
    let count = 0;
    for (let i = 0; i < MAX; i++) {
      const p = this.p[i];
      if (!p.alive) {
        // park unused instances at origin with zero scale
        m.makeScale(0, 0, 0);
        this.mesh.setMatrixAt(i, m);
        continue;
      }
      p.life -= dt;
      if (p.life <= 0) { p.alive = false; m.makeScale(0, 0, 0); this.mesh.setMatrixAt(i, m); continue; }
      p.vy -= 22 * p.grav * dt;
      const dragF = Math.pow(p.drag, dt * 60);
      p.vx *= dragF; p.vz *= dragF; p.vy *= dragF;
      let nx = p.x + p.vx * dt, ny = p.y + p.vy * dt, nz = p.z + p.vz * dt;
      if (world && world.solidAt) {
        if (world.solidAt(nx, ny, nz)) {
          if (!world.solidAt(p.x, ny, p.z)) { nx = p.x; nz = p.z; p.vx *= -0.3; p.vz *= -0.3; }
          else { ny = p.y; p.vy = Math.abs(p.vy) * 0.25; p.vx *= 0.6; p.vz *= 0.6; }
        }
      }
      p.x = nx; p.y = ny; p.z = nz;
      p.rot += p.spin * dt;
      const t = p.life / p.maxLife;
      const sc = p.size * (p.glow ? t : (0.55 + 0.45 * t));
      e.set(p.rot, p.rot * 0.7, p.rot * 0.4);
      q.setFromEuler(e);
      s.set(sc, sc, sc);
      m.compose(this._v.set(p.x, p.y, p.z), q, s);
      this.mesh.setMatrixAt(i, m);
      const cf = p.glow ? 1 : 0.85 + 0.15 * t;
      this.mesh.instanceColor.setXYZ(i, p.color.r * cf, p.color.g * cf, p.color.b * cf);
      count++;
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
    this.active = count;
  }

  clear() { for (const p of this.p) p.alive = false; }
  dispose() { this.scene.remove(this.mesh); this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
}
