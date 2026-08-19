// AmbientLife: butterflies, bird flock, dandelion seeds, fireflies, water ripples,
// snow and petal fall — pooled particles / instanced billboards, dimmed and height-capped.
import * as THREE from 'three';
import { regionAt, WORLD } from './heightfield.js';
import { clamp, lerp, TAU } from '../core/utils.js';
import { makeGlowTexture } from '../core/textures.js';

const _m4 = new THREE.Matrix4(); const _q = new THREE.Quaternion(); const _e = new THREE.Euler();
const _s = new THREE.Vector3(); const _p = new THREE.Vector3(); const _c = new THREE.Vector3();

// ---------------------------------------------------------------- textures
const _btCache = new Map();
function butterflyTexture(kind) {
  if (_btCache.has(kind)) return _btCache.get(kind);
  const S = 128, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d'); g.clearRect(0, 0, S, S);
  const pal = kind === 0 ? ['#e8dcc0', '#cfa04a', '#6a5030'] : kind === 1 ? ['#c8d8e8', '#5a8ac8', '#3a4a6a'] : ['#e8d0e0', '#c06a9a', '#6a3a5a'];
  g.translate(S / 2, S / 2);
  for (const s of [-1, 1]) {
    g.save(); g.scale(s, 1);
    g.fillStyle = pal[0]; g.beginPath(); g.ellipse(12, -6, 26, 30, -0.5, 0, 6.2832); g.fill();
    g.fillStyle = pal[1]; g.beginPath(); g.ellipse(6, 4, 18, 20, 0.4, 0, 6.2832); g.fill();
    g.restore();
  }
  g.fillStyle = pal[2]; g.fillRect(-2, -22, 4, 44);
  g.fillStyle = '#1a1a1a'; g.beginPath(); g.arc(0, -22, 3, 0, 6.2832); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  _btCache.set(kind, t); return t;
}
function birdTexture() {
  const S = 64, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d'); g.clearRect(0, 0, S, S);
  g.fillStyle = '#2a2f38';
  g.beginPath(); g.moveTo(S * 0.1, S * 0.5); g.quadraticCurveTo(S * 0.35, S * 0.25, S * 0.5, S * 0.5); g.quadraticCurveTo(S * 0.35, S * 0.4, S * 0.1, S * 0.5); g.fill();
  g.beginPath(); g.moveTo(S * 0.9, S * 0.5); g.quadraticCurveTo(S * 0.65, S * 0.25, S * 0.5, S * 0.5); g.quadraticCurveTo(S * 0.65, S * 0.4, S * 0.9, S * 0.5); g.fill();
  g.fillRect(S * 0.48, S * 0.45, S * 0.04, S * 0.3);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ---------------------------------------------------------------- billboards

class Billboards {
  constructor(scene, count, tex, opts = {}) {
    this.count = count; this.opts = opts;
    const geo = new THREE.PlaneGeometry(1, 1, 1, 1);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: opts.opacity ?? 0.6, alphaTest: 0.05, side: THREE.DoubleSide, depthWrite: false });
    if (opts.dim != null) mat.color.setScalar(opts.dim);
    this.mesh = new THREE.InstancedMesh(geo, mat, count);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    this.pos = []; this.phase = []; this.speed = []; this.scale = [];
    for (let i = 0; i < count; i++) { this.pos.push(new THREE.Vector3()); this.phase.push(Math.random() * TAU); this.speed.push(0.5 + Math.random()); this.scale.push(opts.scale ?? 0.3); }
  }
  orient(i, x, y, z, sx, sy, sz, camera) {
    const dir = _c.subVectors(camera.position, _p.set(x, y, z)); dir.y = 0;
    const yaw = Math.atan2(dir.x, dir.z);
    _e.set(0, yaw, 0); _s.set(sx, sy, sz);
    this.mesh.setMatrixAt(i, _m4.compose(_p.set(x, y, z), _q.setFromEuler(_e), _s));
  }
  flush() { this.mesh.instanceMatrix.needsUpdate = true; }
}

// ---------------------------------------------------------------- point fields

class PointField {
  constructor(scene, opts) {
    this.count = opts.count || 60; this.o = opts;
    this.pos = new Float32Array(this.count * 3);
    this.vel = new Float32Array(this.count * 3);
    this.life = new Float32Array(this.count);
    this.phase = new Float32Array(this.count);
    this.center = opts.center.clone();
    for (let i = 0; i < this.count; i++) this._seed(i, true);
    const geo = new THREE.BufferGeometry();
    this.attr = new THREE.BufferAttribute(this.pos, 3); this.attr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.attr);
    const mat = new THREE.PointsMaterial({ size: opts.size || 0.3, map: opts.tex || null, color: opts.color || 0xffffff, transparent: true, opacity: opts.opacity ?? 0.25, depthWrite: false, blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending });
    this.points = new THREE.Points(geo, mat); this.points.frustumCulled = false;
    scene.add(this.points);
  }
  _seed(i, init) {
    const o = this.o, c = this.center;
    const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * (o.spread || 6);
    this.pos[i * 3] = c.x + Math.cos(a) * r;
    this.pos[i * 3 + 1] = c.y + (init ? Math.random() * (o.height || 4) : (o.spawnY ?? o.height ?? 4));
    this.pos[i * 3 + 2] = c.z + Math.sin(a) * r;
    this.vel[i * 3] = (Math.random() - 0.5) * (o.hspread || 0.3) + (o.wind?.x || 0);
    this.vel[i * 3 + 1] = (o.up || 0) + (Math.random() - 0.5) * 0.15;
    this.vel[i * 3 + 2] = (Math.random() - 0.5) * (o.hspread || 0.3) + (o.wind?.z || 0);
    this.life[i] = Math.random() * (o.life || 3);
    this.phase[i] = Math.random() * TAU;
  }
  update(dt, t, opacity) {
    const o = this.o, mx = o.maxRadius || 60;
    for (let i = 0; i < this.count; i++) {
      this.life[i] -= dt;
      this.vel[i * 3 + 1] += (o.gravity || 0) * dt;
      let px = this.pos[i * 3] + this.vel[i * 3] * dt;
      let py = this.pos[i * 3 + 1] + this.vel[i * 3 + 1] * dt;
      let pz = this.pos[i * 3 + 2] + this.vel[i * 3 + 2] * dt;
      if (o.bob) py += Math.sin(t * (o.bobFreq || 2) + this.phase[i]) * (o.bob || 0.4) * dt;
      this.pos[i * 3] = px; this.pos[i * 3 + 1] = py; this.pos[i * 3 + 2] = pz;
      const dx = px - this.center.x, dy = py - this.center.y, dz = pz - this.center.z;
      if (this.life[i] <= 0 || py < (o.floor ?? -1e9) || dx * dx + dz * dz > mx * mx) this._seed(i, false);
    }
    this.attr.needsUpdate = true;
    if (opacity != null) this.points.material.opacity = opacity;
  }
}

// ---------------------------------------------------------------- ripples

class Ripples {
  constructor(scene, center, n = 6) {
    this.rings = [];
    const geo = new THREE.RingGeometry(0.86, 1.0, 40);
    for (let i = 0; i < n; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
      const m = new THREE.Mesh(geo, mat);
      m.rotation.x = -Math.PI / 2; m.position.set(center.x, center.y + 0.1, center.z);
      scene.add(m);
      this.rings.push({ m, offset: i * 0.6, period: 2.4 + i * 0.5, maxR: 3.5 + i * 1.2 });
    }
  }
  update(dt, t) {
    for (const r of this.rings) {
      const cyc = ((t - r.offset) % r.period) / r.period;
      r.m.scale.setScalar(lerp(0.4, r.maxR, Math.max(0, cyc)));
      r.m.material.opacity = Math.max(0, (1 - cyc) * 0.35);
    }
  }
}

// ---------------------------------------------------------------- class

export class AmbientLife {
  constructor(ctx) {
    this.ctx = ctx; this.scene = ctx.scene;
    this.group = new THREE.Group(); this.group.name = 'ambientlife'; this.scene.add(this.group);
    const glow = makeGlowTexture(64, 2.0, '#ffffff');

    // butterflies (day, dim, near player)
    this.butterflies = [];
    for (let k = 0; k < 2; k++) {
      const bb = new Billboards(this.scene, 4, butterflyTexture(k), { scale: 0.3, opacity: 0.55, dim: 0.85 });
      this.butterflies.push(bb);
      for (let i = 0; i < bb.count; i++) bb.pos[i].set((Math.random() - 0.5) * 30, 1.2, (Math.random() - 0.5) * 30);
    }
    // bird flock (dark silhouettes)
    this.birds = new Billboards(this.scene, 8, birdTexture(), { scale: 1.4, opacity: 0.8, dim: 0.5 });
    this.birdCenter = new THREE.Vector3(-180, 78, 260);

    // dandelion seeds (day, dim, near player, 0-5m)
    this.seeds = new PointField(this.scene, { count: 30, center: new THREE.Vector3(0, 2, 0), size: 0.1, tex: glow, color: 0xaab0b8, additive: false, opacity: 0.22, spread: 26, height: 4, wind: new THREE.Vector3(0.5, 0, 0.25), up: 0, gravity: -0.02, life: 6, floor: 0.3, spawnY: 4, maxRadius: 45 });
    // fireflies (night, dim, follow player)
    this.fireflies = new PointField(this.scene, { count: 40, center: new THREE.Vector3(0, 1.5, 0), size: 0.3, tex: glow, color: 0xccff88, additive: true, opacity: 0.2, spread: 34, height: 3, bob: 0.4, bobFreq: 1.6, life: 6, floor: 0.4, spawnY: 3, maxRadius: 45 });
    // snow near Dragonspine
    this.snow = new PointField(this.scene, { count: 160, center: new THREE.Vector3(-260, 40, -1080), size: 0.4, tex: glow, color: 0xffffff, additive: false, opacity: 0.45, spread: 90, height: 40, wind: new THREE.Vector3(0.7, 0, 0.3), gravity: -1.6, life: 12, floor: -20, spawnY: 40, maxRadius: 120 });
    // petals near player on meadows (day, dim)
    this.petals = new PointField(this.scene, { count: 40, center: new THREE.Vector3(0, 3, 0), size: 0.4, tex: glow, color: 0xd8a8b8, additive: false, opacity: 0.25, spread: 30, height: 4, wind: new THREE.Vector3(0.4, 0, 0.25), gravity: -0.5, life: 7, floor: 0.3, spawnY: 5, maxRadius: 45 });
    // lake ripples
    this.ripples = new Ripples(this.scene, new THREE.Vector3(WORLD.lake.x, WORLD.waterLevel, WORLD.lake.z), 6);
  }

  update(dt, playerPos) {
    const p = playerPos || this.ctx.camera.position;
    const t = this.ctx.time.elapsed;
    const day = this.ctx.sky?.dayFactor ?? 1;
    const night = 1 - day;
    const camera = this.ctx.camera;
    const reg = this.ctx.region ?? regionAt(p.x, p.z);
    const inSnow = reg?.id === 'dragonspine';

    // butterflies near player (day only)
    for (const bb of this.butterflies) {
      for (let i = 0; i < bb.count; i++) {
        const b = bb.pos[i];
        b.x += Math.sin(t * bb.speed[i] * 1.3 + bb.phase[i]) * dt * 1.8;
        b.y = 1.0 + Math.sin(t * bb.speed[i] + bb.phase[i]) * 0.8 + 0.8;
        b.z += Math.cos(t * bb.speed[i] * 1.1 + bb.phase[i]) * dt * 1.8;
        const d = Math.hypot(b.x - p.x, b.z - p.z);
        if (d > 35) { b.x = p.x + (Math.random() - 0.5) * 28; b.z = p.z + (Math.random() - 0.5) * 28; }
        const flap = 0.45 + 0.55 * Math.sin(t * 14 + bb.phase[i]);
        const s = bb.scale[i] * day;
        bb.orient(i, b.x, b.y, b.z, s, s * flap, s, camera);
      }
      bb.flush();
    }

    // birds orbit
    for (let i = 0; i < this.birds.count; i++) {
      const a = t * 0.16 + (i / this.birds.count) * TAU;
      const r = 26 + (i % 3) * 8;
      const x = this.birdCenter.x + Math.cos(a) * r;
      const z = this.birdCenter.z + Math.sin(a) * r * 0.6;
      const y = this.birdCenter.y + Math.sin(a * 2 + i) * 6;
      const flap = 0.5 + 0.5 * Math.sin(t * 7 + i);
      this.birds.orient(i, x, y, z, 1.4, 1.4 * flap, 1.4, camera);
    }
    this.birds.flush();

    // point fields follow the player (within ~40m), gated by day/night
    this.seeds.center.set(p.x, 1.5, p.z);
    this.seeds.update(dt, t, clamp(day * 1.1, 0, 0.22));
    this.fireflies.center.set(p.x, 1.5, p.z);
    this.fireflies.update(dt, t, night * 0.2);
    this.petals.center.set(p.x, 1.5, p.z);
    this.petals.update(dt, t, clamp(day, 0, 0.25) * (reg?.id === 'windrise' || reg?.id === 'mondstadt' ? 1 : 0.35));
    this.snow.center.set(p.x, 30, p.z);
    this.snow.update(dt, t, inSnow ? 0.45 : 0);
    this.ripples.update(dt, t);
  }

  dispose() {
    for (const bb of this.butterflies) { this.scene.remove(bb.mesh); bb.mesh.geometry.dispose(); bb.mesh.material.dispose(); }
    this.scene.remove(this.birds.mesh); this.birds.mesh.geometry.dispose(); this.birds.mesh.material.dispose();
    for (const f of [this.seeds, this.fireflies, this.snow, this.petals]) { this.scene.remove(f.points); f.points.geometry.dispose(); f.points.material.dispose(); }
    for (const r of this.ripples.rings) { this.scene.remove(r.m); r.m.material.dispose(); }
    this.scene.remove(this.group);
  }
}
