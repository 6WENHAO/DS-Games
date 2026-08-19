// Structures: Mondstadt town (buildings, windmills, Statue of Seven, fountain, plaza,
// paths, walls, bridge, lamps), ruins (Stormterror / Dragonspine / Stonegate) and hilichurl camps.
// Fixed landmarks generated once, spread across frames via ctx.tasks.
import * as THREE from 'three';
import { height, slopeAt, surfaceAt, regionAt, WORLD } from './heightfield.js';
import { makeRNG, clamp, TAU, lerp, smoothstep } from '../core/utils.js';
import { makeToonRamp, makeGlowTexture } from '../core/textures.js';

// ---- village layout (shared: vegetation avoids these building footprints) ----
export const VILLAGE_LAYOUT = {
  plaza: { x: 0, z: 0, r: 26 },
  statue: { x: 0, z: 20 },
  gate: { x: 0, z: -118 },
  buildings: [
    { x: 48, z: 20, rot: 0.6, w: 9, d: 7, h: 7.0, balcony: true },
    { x: 20, z: 52, rot: 1.2, w: 8, d: 6, h: 6.5 },
    { x: -20, z: 54, rot: 2.0, w: 9, d: 6, h: 7.5, balcony: true },
    { x: -52, z: 24, rot: 2.6, w: 8, d: 7, h: 6.5 },
    { x: -54, z: -16, rot: 3.4, w: 9, d: 6, h: 7.0 },
    { x: -26, z: -52, rot: 4.0, w: 8, d: 7, h: 6.5, balcony: true },
    { x: 26, z: -50, rot: 4.8, w: 9, d: 6, h: 7.0 },
    { x: 54, z: -18, rot: 5.4, w: 8, d: 7, h: 6.5 },
    { x: 88, z: 40, rot: 0.8, w: 10, d: 7, h: 8.0 },
    { x: 44, z: 92, rot: 1.5, w: 9, d: 6, h: 7.5, balcony: true },
    { x: -44, z: 94, rot: 2.2, w: 10, d: 7, h: 8.0 },
    { x: -92, z: 44, rot: 3.0, w: 9, d: 6, h: 7.0 },
    { x: -96, z: -40, rot: 3.8, w: 10, d: 7, h: 8.0 },
    { x: -48, z: -90, rot: 4.4, w: 9, d: 6, h: 7.0, balcony: true },
    { x: 48, z: -88, rot: 5.1, w: 10, d: 7, h: 7.5 },
    { x: 94, z: -36, rot: 5.9, w: 9, d: 6, h: 8.0 },
  ],
  windmills: [ { x: 82, z: -70 }, { x: -82, z: -70 } ],
};

// ---------------------------------------------------------------- materials + textures

let _ramp = null;
function ramp() { if (!_ramp) _ramp = makeToonRamp([0, 0.5, 0.72, 1.0], [0.42, 0.68, 0.9, 1.0]); return _ramp; }
function canvas(size) { const c = document.createElement('canvas'); c.width = c.height = size; return c; }

const _texCache = new Map();
function texture(name, painter) {
  if (_texCache.has(name)) return _texCache.get(name);
  const c = canvas(256), g = c.getContext('2d');
  painter(g, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  _texCache.set(name, t);
  return t;
}

function wallTexture() {
  return texture('wall', (g, S) => {
    g.fillStyle = '#efe7d2'; g.fillRect(0, 0, S, S);
    // brick texture
    g.strokeStyle = 'rgba(150,130,100,0.25)'; g.lineWidth = 1;
    for (let y = 0; y < S; y += 24) { g.beginPath(); g.moveTo(0, y); g.lineTo(S, y); g.stroke(); }
    for (let y = 0; y < S; y += 48) for (let x = (y / 48) % 2 ? 32 : 0; x < S; x += 64) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 24); g.stroke(); }
    // timber frame
    g.strokeStyle = '#6a5238'; g.lineWidth = 10;
    g.strokeRect(8, 8, S - 16, S - 16);
    g.beginPath(); g.moveTo(S / 2, 8); g.lineTo(S / 2, S - 8); g.stroke();
    g.beginPath(); g.moveTo(8, S * 0.55); g.lineTo(S - 8, S * 0.55); g.stroke();
    // windows
    const win = (wx, wy) => {
      g.fillStyle = '#2a4a6a'; g.fillRect(wx, wy, 64, 52);
      g.fillStyle = '#ffdda0'; g.fillRect(wx + 4, wy + 4, 56, 44);
      g.strokeStyle = '#6a5238'; g.lineWidth = 5;
      g.strokeRect(wx, wy, 64, 52);
      g.beginPath(); g.moveTo(wx + 32, wy); g.lineTo(wx + 32, wy + 52); g.moveTo(wx, wy + 26); g.lineTo(wx + 64, wy + 26); g.stroke();
    };
    win(30, 34); win(150, 34);
    // door
    g.fillStyle = '#5a4028'; g.fillRect(S / 2 - 22, S - 92, 44, 84);
    g.fillStyle = '#c8a86a'; g.fillRect(S / 2 - 16, S - 86, 32, 78);
    g.strokeStyle = '#4a3220'; g.lineWidth = 4; g.strokeRect(S / 2 - 22, S - 92, 44, 84);
  });
}
function roofTexture() {
  return texture('roof', (g, S) => {
    g.fillStyle = '#5a7aa0'; g.fillRect(0, 0, S, S);
    for (let y = 0; y < S; y += 22) {
      g.strokeStyle = 'rgba(40,60,90,0.55)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(0, y); g.lineTo(S, y); g.stroke();
      for (let x = (y / 22) % 2 ? 16 : 0; x < S; x += 32) {
        g.beginPath(); g.arc(x, y, 12, Math.PI, 0); g.stroke();
      }
    }
  });
}
function stoneTexture() {
  return texture('stone', (g, S) => {
    g.fillStyle = '#b7b2a8'; g.fillRect(0, 0, S, S);
    g.strokeStyle = 'rgba(90,86,78,0.5)'; g.lineWidth = 2;
    for (let y = 0; y < S; y += 42) { g.beginPath(); g.moveTo(0, y); g.lineTo(S, y); g.stroke(); }
    for (let y = 0; y < S; y += 84) for (let x = (y / 84) % 2 ? 21 : 0; x < S; x += 42) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 42); g.stroke(); }
  });
}
function woodTexture() {
  return texture('wood', (g, S) => {
    g.fillStyle = '#9a7448'; g.fillRect(0, 0, S, S);
    g.strokeStyle = 'rgba(70,50,28,0.6)'; g.lineWidth = 2;
    for (let y = 0; y < S; y += 20) { g.beginPath(); g.moveTo(0, y); g.lineTo(S, y); g.stroke(); }
    for (let x = 0; x < S; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, S); g.stroke(); }
  });
}
function brickTexture() {
  return texture('brick', (g, S) => {
    g.fillStyle = '#a0603c'; g.fillRect(0, 0, S, S);
    g.strokeStyle = 'rgba(70,40,24,0.7)'; g.lineWidth = 2;
    for (let y = 0; y < S; y += 18) { g.beginPath(); g.moveTo(0, y); g.lineTo(S, y); g.stroke(); }
    for (let y = 0; y < S; y += 36) for (let x = (y / 36) % 2 ? 12 : 0; x < S; x += 24) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 18); g.stroke(); }
  });
}

function toon(color, opts = {}) { return new THREE.MeshToonMaterial({ color, gradientMap: ramp(), ...opts }); }

function gableRoof(w, d, pitch, overhang) {
  const shape = new THREE.Shape();
  const hw = w / 2 + overhang;
  shape.moveTo(-hw, 0); shape.lineTo(0, pitch); shape.lineTo(hw, 0); shape.closePath();
  const depth = d + overhang * 2;
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  g.translate(0, 0, -depth / 2);
  return g;
}

// ---------------------------------------------------------------- particle system

class PSys {
  constructor(scene, opts) {
    this.count = opts.count || 40; this.o = opts;
    this.pos = new Float32Array(this.count * 3);
    this.vel = new Float32Array(this.count * 3);
    this.life = new Float32Array(this.count);
    this.base = opts.base.clone();
    for (let i = 0; i < this.count; i++) this._seed(i, true);
    const geo = new THREE.BufferGeometry();
    this.attr = new THREE.BufferAttribute(this.pos, 3); this.attr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.attr);
    const mat = new THREE.PointsMaterial({ size: opts.size || 0.4, map: opts.tex || null, color: opts.color || 0xffffff, transparent: true, opacity: opts.opacity ?? 1, depthWrite: false, blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending });
    this.points = new THREE.Points(geo, mat); this.points.frustumCulled = false;
    scene.add(this.points);
  }
  _seed(i, init) {
    const o = this.o, b = o.base;
    const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * (o.spread || 2);
    this.pos[i * 3] = b.x + Math.cos(a) * r;
    this.pos[i * 3 + 1] = b.y + (init ? Math.random() * (o.height || 3) : (o.spawnY ?? 0));
    this.pos[i * 3 + 2] = b.z + Math.sin(a) * r;
    this.vel[i * 3] = (Math.random() - 0.5) * (o.hspread || 0.6);
    this.vel[i * 3 + 1] = o.up || 0;
    this.vel[i * 3 + 2] = (Math.random() - 0.5) * (o.hspread || 0.6);
    this.life[i] = Math.random() * (o.life || 2);
  }
  update(dt) {
    const o = this.o;
    for (let i = 0; i < this.count; i++) {
      this.life[i] -= dt;
      this.vel[i * 3 + 1] += (o.gravity || 0) * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      if (this.life[i] <= 0 || this.pos[i * 3 + 1] < (o.floor ?? -1e9)) this._seed(i, false);
    }
    this.attr.needsUpdate = true;
  }
}

// ---------------------------------------------------------------- class

export class Structures {
  constructor(ctx) {
    this.ctx = ctx; this.scene = ctx.scene;
    this.group = new THREE.Group(); this.group.name = 'structures'; this.scene.add(this.group);
    this._initMaterials();

    this.hubs = [];        // rotating windmill hubs
    this.emitters = [];    // dynamic light emitters
    this.particles = [];
    this._initLights();

    this.village = new THREE.Group(); this.village.name = 'village'; this.group.add(this.village);
    this.ruinsG = new THREE.Group(); this.ruinsG.name = 'ruins'; this.group.add(this.ruinsG);
    this.campsG = new THREE.Group(); this.campsG.name = 'camps'; this.group.add(this.campsG);
    this.anchorsG = new THREE.Group(); this.anchorsG.name = 'anchors'; this.group.add(this.anchorsG);

    // schedule generation across frames
    const T = ctx.tasks;
    T.push(() => this._plazaPaths(), 1);
    for (const b of VILLAGE_LAYOUT.buildings) T.push(() => this._buildHouse(b), 1);
    for (const w of VILLAGE_LAYOUT.windmills) T.push(() => this._buildWindmill(w), 1);
    T.push(() => this._buildFountain(), 1);
    T.push(() => this._buildStatue(), 1);
    T.push(() => this._buildLamps(), 1);
    T.push(() => this._buildGateBridgeWall(), 1);
    T.push(() => this._buildStormterror(), 2);
    T.push(() => this._buildDragonspine(), 2);
    T.push(() => this._buildStonegate(), 2);
    for (const c of this.campSites) T.push(() => this._buildCamp(c), 2);
    T.push(() => this._buildAnchors(), 2);
  }

  _initMaterials() {
    this.wallMat = toon(0xffffff, { map: wallTexture() });
    this.roofMat = toon(0xffffff, { map: roofTexture() });
    this.ridgeMat = toon(0x405a80);
    this.stoneMat = toon(0xffffff, { map: stoneTexture() });
    this.woodMat = toon(0xffffff, { map: woodTexture() });
    this.brickMat = toon(0xffffff, { map: brickTexture() });
    this.plasterMat = toon(0xefe7d2);
    this.timberMat = toon(0x6a5238);
    this.stonePlainMat = toon(0xb7b2a8);
    this.crystalMat = new THREE.MeshBasicMaterial({ color: 0x74c8a8 });
    this.iceMat = new THREE.MeshBasicMaterial({ color: 0x93e0ef });
    this.glowTex = makeGlowTexture(64, 2.2, '#ffffff');
  }

  _initLights() {
    const max = clamp(this.ctx.quality.maxLights ?? 6, 2, 8);
    this.lights = [];
    for (let i = 0; i < max; i++) {
      const L = new THREE.PointLight(0xffffff, 0, 22, 2);
      L.castShadow = false;
      this.scene.add(L);
      this.lights.push(L);
    }
  }

  get campSites() {
    return [
      { x: -380, z: 320, radius: 14 }, { x: -640, z: -40, radius: 14 },
      { x: 260, z: 560, radius: 14 }, { x: -180, z: 620, radius: 14 },
      { x: 620, z: 120, radius: 14 }, { x: -520, z: -520, radius: 14 },
      { x: 420, z: -620, radius: 14 },
    ];
  }

  get waypoints() {
    return [
      { id: 'mondstadt', name: '七天神像·蒙德', x: VILLAGE_LAYOUT.statue.x, z: VILLAGE_LAYOUT.statue.z },
      { id: 'windrise', name: '风起地', x: -230, z: 210 },
      { id: 'cider', name: '晨曦酒庄', x: -520, z: -120 },
      { id: 'lake', name: '塞西莉亚湖', x: 520, z: 340 },
      { id: 'stormbearer', name: '奔狼领', x: -820, z: 520 },
      { id: 'dragonspine', name: '龙脊雪山', x: -260, z: -1080 },
      { id: 'stonegate', name: '石门', x: 980, z: -420 },
      { id: 'ruins', name: '风龙废墟', x: -1080, z: -420 },
      { id: 'beach', name: '南风海岸', x: 240, z: 1180 },
    ];
  }

  update(dt) {
    const t = this.ctx.time.elapsed;
    for (const h of this.hubs) h.rotation.z -= dt * 0.9;
    if (this._statueCrystal) {
      this._statueCrystal.rotation.y += dt * 0.7;
      this._statueCrystal.position.y = this._statueCrystalBase + Math.sin(t * 1.1) * 0.25;
    }
    for (const p of this.particles) p.update(dt);
    this._updateLights();
  }

  // ---- lighting pool: assign N dynamic lights to nearest/priority emitters ----
  _updateLights() {
    const n = this.lights.length; if (!n) return;
    const p = this.ctx.camera.position;
    const night = 1 - (this.ctx.sky?.dayFactor ?? 1);
    const list = this.emitters.map((e) => ({ e, d: Math.hypot(e.pos.x - p.x, e.pos.z - p.z) }));
    list.sort((a, b) => (a.e.priority - b.e.priority) || (a.d - b.d));
    for (let i = 0; i < n; i++) {
      const L = this.lights[i], item = list[i];
      if (!item) { L.intensity = 0; continue; }
      const e = item.e;
      L.position.copy(e.pos);
      L.color.copy(e.color);
      let k = e.nightOnly ? night : (0.35 + 0.65 * night);
      L.intensity = e.intensity * k;
    }
  }

  // ---- village pieces ----
  _plazaPaths() {
    const y = height(VILLAGE_LAYOUT.plaza.x, VILLAGE_LAYOUT.plaza.z) + 0.06;
    const plaza = new THREE.Mesh(new THREE.CylinderGeometry(26, 26, 0.24, 48), this.stoneMat);
    plaza.position.set(0, y, 0); plaza.receiveShadow = true;
    this.village.add(plaza);
    // radial paths
    const path = (x1, z1, x2, z2, w) => {
      const dx = x2 - x1, dz = z2 - z1; const len = Math.hypot(dx, dz);
      const m = new THREE.Mesh(new THREE.BoxGeometry(len, 0.12, w), this.stoneMat);
      m.position.set((x1 + x2) / 2, y - 0.02, (z1 + z2) / 2);
      m.rotation.y = Math.atan2(dx, dz);
      m.receiveShadow = true;
      this.village.add(m);
    };
    path(0, 0, 0, -118, 5);
    path(0, 0, 78, 70, 4);
    path(0, 0, -78, 72, 4);
    path(0, 0, 30, 30, 4);
  }

  _buildHouse(b) {
    const y = height(b.x, b.z);
    const g = new THREE.Group(); g.position.set(b.x, y, b.z); g.rotation.y = b.rot;
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.6, 0.5, b.d + 0.6), this.stoneMat);
    plinth.position.y = 0.25; plinth.receiveShadow = true; g.add(plinth);
    const wall = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), this.wallMat);
    wall.position.y = 0.5 + b.h / 2; wall.castShadow = true; wall.receiveShadow = true; g.add(wall);
    const roof = new THREE.Mesh(gableRoof(b.w, b.d, 2.4, 0.6), this.roofMat);
    roof.position.y = b.h; roof.castShadow = true; roof.receiveShadow = true; g.add(roof);
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(b.w + 1.2, 0.16, 0.24), this.ridgeMat);
    ridge.position.y = b.h + 2.4; g.add(ridge);
    const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.6, 0.7), this.brickMat);
    chimney.position.set(b.w * 0.28, b.h + 1.4, b.d * 0.28); chimney.castShadow = true; g.add(chimney);
    if (b.balcony) {
      const balc = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.16, 1.0), this.woodMat);
      balc.position.set(0, b.h * 0.72, b.d / 2 + 0.5); balc.castShadow = true; g.add(balc);
      for (const bx of [-1.1, 0, 1.1]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.7, 0.08), this.timberMat);
        rail.position.set(bx, b.h * 0.72 + 0.35, b.d / 2 + 0.95); g.add(rail);
      }
    }
    this.village.add(g);
    this.ctx.collision?.addBox(b.x, y + b.h / 2, b.z, b.w / 2, b.h / 2, b.d / 2, b.rot);
  }

  _buildWindmill(w) {
    const y = height(w.x, w.z);
    const g = new THREE.Group(); g.position.set(w.x, y, w.z);
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 4.0, 20, 8, 3), this.plasterMat);
    tower.position.y = 10; tower.castShadow = true; tower.receiveShadow = true; g.add(tower);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 2.8, 1.2, 8), this.timberMat);
    band.position.y = 18.5; g.add(band);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(3.0, 3.0, 8), this.roofMat);
    cap.position.y = 20.4; cap.castShadow = true; g.add(cap);
    // rotating hub + 4 large blades
    const hub = new THREE.Group(); hub.position.set(0, 19.0, 2.6); g.add(hub);
    const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 1.4, 6), this.timberMat);
    axle.rotation.x = Math.PI / 2; hub.add(axle);
    for (let i = 0; i < 4; i++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(8.4, 1.5, 0.2), this.woodMat);
      blade.position.x = 4.2; blade.rotation.y = (i / 4) * TAU;
      blade.castShadow = true;
      hub.add(blade);
    }
    const hubCap = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), this.timberMat);
    hub.add(hubCap);
    this.village.add(g);
    this.hubs.push(hub);
    this.ctx.collision?.addCylinder(w.x, w.z, 3.8, y, y + 19);
  }

  _buildFountain() {
    const x = 0, z = 0, y = height(x, z);
    const g = new THREE.Group(); g.position.set(x, y, z);
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(3.0, 3.4, 1.1, 18), this.stonePlainMat);
    basin.position.y = 0.55; basin.castShadow = true; basin.receiveShadow = true; g.add(basin);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.16, 8, 20), this.stonePlainMat);
    rim.rotation.x = Math.PI / 2; rim.position.y = 1.1; g.add(rim);
    const water = new THREE.Mesh(new THREE.CylinderGeometry(2.7, 2.7, 0.3, 18), new THREE.MeshStandardMaterial({ color: 0x2a7a9a, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.85 }));
    water.position.y = 1.02; g.add(water);
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 1.6, 8), this.stonePlainMat);
    column.position.y = 1.3; g.add(column);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.2, 0.3, 8), this.stonePlainMat);
    top.position.y = 2.1; top.castShadow = true; g.add(top);
    this.village.add(g);
    this.ctx.collision?.addCylinder(x, z, 3.3, y, y + 1.1);
    const fp = new PSys(this.scene, { count: 40, base: new THREE.Vector3(x, y + 1.1, z), size: 0.22, tex: this.glowTex, color: 0x9fe0ff, additive: false, opacity: 0.9, up: 3.0, gravity: -9.0, hspread: 0.15, spread: 0.7, height: 2.4, life: 1.4, spawnY: 0.1, floor: y + 1.1 });
    this.particles.push(fp);
    this.emitters.push({ pos: new THREE.Vector3(x, y + 2.4, z), color: new THREE.Color(0x7fd8ff), intensity: 8, priority: 3, nightOnly: true });
  }

  _buildStatue() {
    const { x, z } = VILLAGE_LAYOUT.statue;
    const y = height(x, z);
    const g = new THREE.Group(); g.position.set(x, y, z);
    const stone = this.stonePlainMat;
    // platform + steps
    const plat = new THREE.Mesh(new THREE.CylinderGeometry(5, 5.4, 1.2, 10), stone);
    plat.position.y = 0.6; plat.castShadow = true; plat.receiveShadow = true; g.add(plat);
    for (let i = 0; i < 3; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.4, 1.6), stone); s.position.set(0, 0.2 + i * 0.4, 4.6 + i * 0.6); g.add(s); }
    // pedestal
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.9, 2.6, 8), stone);
    ped.position.y = 2.5; ped.castShadow = true; g.add(ped);
    // humanoid (Barbatos)
    const body = new THREE.Group(); body.position.y = 4.0;
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.55, 1.0, 4, 8), stone); torso.position.y = 1.4; torso.castShadow = true; body.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 10), stone); head.position.y = 2.5; body.add(head);
    for (const s of [-1, 1]) { const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 1.1, 6), stone); arm.position.set(s * 0.62, 1.5, 0); arm.rotation.z = s * 0.5; body.add(arm); }
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.8, 0.9, 8), stone); skirt.position.y = 0.5; body.add(skirt);
    g.add(body);
    // wings
    for (const s of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.SphereGeometry(1.1, 8, 6), stone);
      wing.scale.set(0.16, 0.9, 0.6); wing.position.set(s * 0.72, 4.6, -0.25); wing.rotation.z = s * 0.6;
      wing.castShadow = true; g.add(wing);
    }
    // floating crystal
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.7, 0), this.crystalMat);
    crystal.position.set(0, 7.0, 0); g.add(crystal);
    const crystal2 = new THREE.Mesh(new THREE.OctahedronGeometry(0.4, 0), this.crystalMat);
    crystal2.position.set(0.45, 7.4, 0.2); g.add(crystal2);
    const halo = new THREE.Mesh(new THREE.IcosahedronGeometry(1.0, 0), this.crystalMat);
    halo.position.set(0, 7.0, 0); g.add(halo);
    const glowSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, color: 0x74c8a8, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false }));
    glowSprite.scale.setScalar(3.4); glowSprite.position.set(0, 7.0, 0); g.add(glowSprite);
    this._statueCrystal = crystal; this._statueCrystalBase = 7.0;
    this.village.add(g);
    this.ctx.collision?.addCylinder(x, z, 2.0, y, y + 5);
    this.ctx.interact?.register({ pos: new THREE.Vector3(x, y + 3, z), radius: 3.5, label: '七天神像', icon: 'waypoint', priority: -1 });
    this.emitters.push({ pos: new THREE.Vector3(x, y + 7.5, z), color: new THREE.Color(0x74c8a8), intensity: 12, priority: 0, nightOnly: false });
  }

  _buildLamps() {
    const posts = [[-14, -20], [14, -20], [-20, 14], [20, 14], [0, -60], [0, -100], [60, 0], [-60, 0]];
    const geo = new THREE.BufferGeometry();
    // merge pole + head with vertex colors
    const pole = new THREE.CylinderGeometry(0.08, 0.1, 3.0, 6).translate(0, 1.5, 0).toNonIndexed();
    const head = new THREE.SphereGeometry(0.22, 8, 6).translate(0, 3.1, 0).toNonIndexed();
    const pos = [], col = [];
    const push = (g2, r, gr, b) => { const p = g2.attributes.position; for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); col.push(r, gr, b); } };
    push(pole, 0.24, 0.24, 0.28); push(head, 1.0, 0.86, 0.55);
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(col), 3));
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true });
    const mesh = new THREE.InstancedMesh(geo, mat, posts.length);
    posts.forEach(([x, z], i) => {
      const y = height(x, z);
      const m = new THREE.Matrix4().makeRotationY(0); m.setPosition(x, y, z);
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    this.village.add(mesh);
    for (const [x, z] of posts) {
      this.emitters.push({ pos: new THREE.Vector3(x, height(x, z) + 3, z), color: new THREE.Color(0xffc37a), intensity: 20, priority: 2, nightOnly: true });
    }
  }

  _buildGateBridgeWall() {
    const { x, z } = VILLAGE_LAYOUT.gate; const y = height(x, z);
    const stone = this.stonePlainMat;
    // gate pillars + lintel
    for (const s of [-4, 4]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(2.0, 7, 2.0), stone); p.position.set(s, 3.5, z); p.castShadow = true; this.village.add(p);
      this.ctx.collision?.addCylinder(x + s, z, 1.2, y, y + 7);
    }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(12, 1.6, 2.2), stone); lintel.position.set(0, 7.4, z); lintel.castShadow = true; this.village.add(lintel);
    // walls flanking the gate
    for (const s of [-1, 1]) for (let i = 1; i <= 3; i++) {
      const seg = new THREE.Mesh(new THREE.BoxGeometry(8, 4.4, 2.4), stone);
      seg.position.set(s * (12 + i * 8 - 4), 2.2, z + s * 2);
      seg.rotation.y = s * 0.1;
      seg.castShadow = true; seg.receiveShadow = true; this.village.add(seg);
    }
    // wooden bridge leading down from the gate
    const b = new THREE.Group();
    for (let i = 0; i < 10; i++) {
      const t = i / 9;
      const bx = x, bz = z - 6 - i * 3.2, by = height(bx, bz) + 0.3;
      const plank = new THREE.Mesh(new THREE.BoxGeometry(6, 0.3, 3.0), this.woodMat);
      plank.position.set(bx, by, bz); plank.castShadow = true; plank.receiveShadow = true; b.add(plank);
      if (i % 2 === 0) {
        for (const s of [-1, 1]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.9, 3.0), this.timberMat); rail.position.set(s * 3, by + 0.7, bz); b.add(rail); }
      }
    }
    this.village.add(b);
  }

  // ---- camps ----
  _buildCamp(c) {
    const y = height(c.x, c.z);
    if (y < 0.6 || surfaceAt(c.x, c.z) === 'water') return;
    const rng = makeRNG(Math.round(c.x * 7 + c.z * 13));
    const g = new THREE.Group(); g.position.set(c.x, y, c.z); g.rotation.y = rng() * TAU;
    // fence
    const posts = [];
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * TAU, r = c.radius * 0.9;
      posts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    const postGeo = new THREE.CylinderGeometry(0.12, 0.16, 1.6, 5);
    const fence = new THREE.InstancedMesh(postGeo, this.timberMat, posts.length);
    posts.forEach(([px, pz], i) => { const m = new THREE.Matrix4().makeTranslation(px, 0.8, pz); fence.setMatrixAt(i, m); });
    fence.instanceMatrix.needsUpdate = true; fence.castShadow = true; g.add(fence);
    for (let i = 0; i < posts.length; i++) {
      const [x1, z1] = posts[i], [x2, z2] = posts[(i + 1) % posts.length];
      const rail = new THREE.Mesh(new THREE.BoxGeometry(Math.hypot(x2 - x1, z2 - z1), 0.18, 0.18), this.timberMat);
      rail.position.set((x1 + x2) / 2, 0.7, (z1 + z2) / 2);
      rail.rotation.y = Math.atan2(x2 - x1, z2 - z1); g.add(rail);
    }
    // tent
    const tent = new THREE.Group(); tent.position.set(0, 0, c.radius * 0.4);
    const cloth = new THREE.Mesh(new THREE.ConeGeometry(2.6, 2.6, 4), this.brickMat);
    cloth.position.y = 1.3; cloth.rotation.y = Math.PI / 4; cloth.castShadow = true; tent.add(cloth);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 5), this.timberMat); pole.position.y = 1.3; tent.add(pole);
    g.add(tent);
    // crates
    for (let i = 0; i < 3; i++) {
      const cr = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), this.woodMat);
      const a = rng() * TAU, r = 1.6 + rng() * 2;
      cr.position.set(Math.cos(a) * r, 0.4, Math.sin(a) * r); cr.rotation.y = rng() * TAU; cr.castShadow = true; g.add(cr);
      this.ctx.collision?.addBox(c.x + Math.cos(a) * r, y + 0.4, c.z + Math.sin(a) * r, 0.4, 0.4, 0.4, 0);
    }
    // campfire
    const fireBase = new THREE.Vector3(0, 0.3, -c.radius * 0.3);
    for (let i = 0; i < 4; i++) { const log = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 1.1, 5), this.timberMat); const a = (i / 4) * TAU + Math.PI / 4; log.position.set(Math.cos(a) * 0.4, 0.15, Math.sin(a) * 0.4); log.rotation.y = a; log.rotation.z = Math.PI / 2; g.add(log); }
    const fp = new PSys(this.scene, { count: 26, base: new THREE.Vector3(c.x, y, c.z), size: 0.5, tex: this.glowTex, color: 0xff8a3a, additive: true, opacity: 0.9, up: 1.4, gravity: -0.4, hspread: 0.5, spread: 0.5, height: 1.2, life: 1.3, spawnY: 0.2, floor: y });
    this.particles.push(fp);
    this.campsG.add(g);
    this.emitters.push({ pos: new THREE.Vector3(c.x, y + 1, c.z), color: new THREE.Color(0xff7a3a), intensity: 26, priority: 1, nightOnly: false });
  }

  // ---- ruins ----
  _buildStormterror() {
    const x = -1080, z = -420, y = height(x, z);
    const g = new THREE.Group(); g.position.set(x, y, z);
    const stone = this.stonePlainMat;
    // broken tower: stacked tapering cylinders, rotated
    const rng = makeRNG(7);
    let ty = 0;
    for (let i = 0; i < 4; i++) {
      const r0 = 5.5 - i * 1.1, r1 = 5.5 - (i + 1) * 1.1, h = 7 - i * 0.8;
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, h, 8, 2), stone);
      seg.position.y = ty + h / 2; seg.rotation.y = i * 0.3; seg.rotation.z = (rng() - 0.5) * 0.06; seg.castShadow = true; g.add(seg);
      ty += h;
    }
    this.ctx.collision?.addCylinder(x, z, 5.4, y, y + ty);
    // fallen pillars
    for (let i = 0; i < 5; i++) {
      const a = rng() * TAU, r = 9 + rng() * 10;
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 8 + rng() * 6, 7), stone);
      p.position.set(Math.cos(a) * r, 0.5, Math.sin(a) * r);
      p.rotation.set(rng() * 1.2 - 0.6, rng() * TAU, rng() * 1.2 - 0.6); p.castShadow = true; g.add(p);
    }
    // arch
    const arch = new THREE.Group(); arch.position.set(-14, 0, -6);
    for (const s of [-1, 1]) { const pil = new THREE.Mesh(new THREE.BoxGeometry(2.2, 7, 2.2), stone); pil.position.set(s * 3, 3.5, 0); pil.castShadow = true; arch.add(pil); this.ctx.collision?.addCylinder(x - 14 + s * 3, z - 6, 1.3, y, y + 7); }
    const lint = new THREE.Mesh(new THREE.BoxGeometry(8.5, 1.6, 2.4), stone); lint.position.set(0, 7.2, 0); lint.castShadow = true; arch.add(lint);
    arch.rotation.y = 0.5; g.add(arch);
    // ground cracks (dark strips)
    for (let i = 0; i < 6; i++) {
      const a = rng() * TAU, r = 3 + rng() * 12;
      const crack = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 4 + rng() * 6), this.timberMat);
      crack.material = new THREE.MeshBasicMaterial({ color: 0x1a1216 });
      crack.position.set(Math.cos(a) * r, 0.05, Math.sin(a) * r); crack.rotation.y = a; g.add(crack);
    }
    this.ruinsG.add(g);
    // purple-black corruption fog
    const fog = new PSys(this.scene, { count: 70, base: new THREE.Vector3(x, y + 3, z), size: 2.4, tex: this.glowTex, color: 0x4a1030, additive: true, opacity: 0.32, up: 0.25, gravity: 0, hspread: 0.5, spread: 13, height: 8, life: 5, spawnY: 0, floor: y - 40 });
    this.particles.push(fog);
  }

  _buildDragonspine() {
    const x = -260, z = -1080, y = height(x, z);
    const g = new THREE.Group(); g.position.set(x, y, z);
    const stone = this.stonePlainMat;
    // frozen stele
    const stele = new THREE.Mesh(new THREE.BoxGeometry(3, 9, 1.2), stone); stele.position.y = 4.5; stele.castShadow = true; g.add(stele);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(1.8, 2, 4), this.iceMat); cap.position.y = 9.8; cap.rotation.y = Math.PI / 4; g.add(cap);
    this.ctx.collision?.addBox(x, y + 4.5, z, 1.5, 4.5, 0.6, 0);
    // broken steps
    for (let i = 0; i < 5; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.5, 1.4), stone); s.position.set(0, 0.25 + i * 0.5, 4 + i * 0.8); s.castShadow = true; g.add(s); }
    // ice crystals
    const rng = makeRNG(31);
    for (let i = 0; i < 8; i++) {
      const a = rng() * TAU, r = 3 + rng() * 7;
      const cr = new THREE.Mesh(new THREE.ConeGeometry(0.4 + rng() * 0.6, 1.2 + rng() * 2, 4), this.iceMat);
      cr.position.set(Math.cos(a) * r, 0.6, Math.sin(a) * r); cr.rotation.set(rng() * 0.5 - 0.25, rng() * TAU, rng() * 0.5 - 0.25); g.add(cr);
    }
    this.ruinsG.add(g);
  }

  _buildStonegate() {
    const x = 980, z = -420, y = height(x, z);
    const g = new THREE.Group(); g.position.set(x, y, z);
    const stone = this.stonePlainMat;
    const rng = makeRNG(55);
    // eroded rock pillars
    const pillarGeo = new THREE.CylinderGeometry(0.7, 1.6, 1, 6, 3);
    for (let i = 0; i < 9; i++) {
      const a = rng() * TAU, r = 14 + rng() * 30, h = 14 + rng() * 22;
      const pil = new THREE.Mesh(new THREE.CylinderGeometry(1.2 + rng() * 1.6, 2.4 + rng() * 2, h, 6, 3), stone);
      const px = Math.cos(a) * r, pz = Math.sin(a) * r;
      pil.position.set(px, h / 2, pz); pil.rotation.y = rng() * TAU; pil.castShadow = true; g.add(pil);
      this.ctx.collision?.addCylinder(x + px, z + pz, 2.4, y, y + h);
    }
    // rope bridge between two tall pillars
    const b = new THREE.Group();
    const p1 = { x: 10, z: 0 }, p2 = { x: 10, z: 34 };
    const plankMat = this.woodMat;
    for (let i = 0; i < 12; i++) {
      const t = i / 11;
      const px = lerp(p1.x, p2.x, t), pz = lerp(p1.z, p2.z, t);
      const sag = Math.sin(t * Math.PI) * 1.6;
      const by = height(x + px, z + pz) + 14 - sag;
      const plank = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.14, 0.9), plankMat);
      plank.position.set(px, by, pz); plank.rotation.x = 0.1; plank.castShadow = true; b.add(plank);
    }
    for (const s of [-1, 1]) {
      const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 34, 4), this.timberMat);
      rope.rotation.x = Math.PI / 2; rope.position.set(10, height(x + 10, z) + 14.5, 17 + s * 1.0); b.add(rope);
    }
    this.ruinsG.add(g); this.ruinsG.add(b);
  }

  _buildAnchors() {
    const spots = [
      { x: -230, z: 210 }, { x: 520, z: 340 }, { x: -260, z: -1080 }, { x: 980, z: -420 }, { x: -1080, z: -420 }, { x: 240, z: 1180 },
    ];
    for (const s of spots) {
      const y = height(s.x, s.z);
      const g = new THREE.Group(); g.position.set(s.x, y, s.z);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.0, 1.2, 7), this.stonePlainMat); base.position.y = 0.6; base.castShadow = true; g.add(base);
      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.45, 0), this.crystalMat); crystal.position.y = 2.0; g.add(crystal);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.05, 6, 20), this.crystalMat); ring.rotation.x = Math.PI / 2; ring.position.y = 1.5; g.add(ring);
      this.anchorsG.add(g);
      this.ctx.interact?.register({ pos: new THREE.Vector3(s.x, y + 1.2, s.z), radius: 3.0, label: '传送锚点', icon: 'waypoint', priority: -1 });
    }
  }

  dispose() {
    this.scene.remove(this.group);
    for (const L of this.lights) this.scene.remove(L);
    for (const p of this.particles) { this.scene.remove(p.points); p.points.geometry.dispose(); p.points.material.dispose(); }
  }
}
