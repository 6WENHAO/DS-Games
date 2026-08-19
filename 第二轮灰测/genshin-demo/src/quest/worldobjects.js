// 世界对象（模块 D）：宝箱 / 传送锚点 / 元素方碑 / 风场 / 仙灵 / 可破坏物 / 采集点 / 冒险家营地。
// 同时导出共享几何/材质构建器，供 puzzles.js、npcs.js 复用（避免重复造轮子）。
// 契约：export class WorldObjects { constructor(ctx); update(dt); }
import * as THREE from 'three';
import { makeToonRamp } from '../core/textures.js';
import { height, findFlatSpot, REGIONS, WORLD } from '../world/heightfield.js';
import { makeRNG, clamp } from '../core/utils.js';

// ---- 元素配色（契约 §5） ----
export const ELEMENT_COLORS = {
  anemo: '#74c8a8', pyro: '#ff7a55', hydro: '#4fc3f7', electro: '#c88bfa',
  cryo: '#93e0ef', geo: '#f0b93c', dendro: '#9adb4a', physical: '#e8e4da',
};

// dev 场景地面在 y=0；真实世界用 height()
export function groundY(ctx, x, z) { return ctx.dev ? 0 : height(x, z); }

// ---- 共享缓存 ----
let _ramp = null;
export function toonRamp(ctx) { return ctx?.toonRamp ?? (_ramp ??= makeToonRamp()); }

const _matCache = new Map();
/** 共享 NPR toon 材质（按签名缓存）。 */
export function mat(ctx, color, opts = {}) {
  const key = color + '|' + (opts.emissive ?? '') + '|' + (opts.emissiveIntensity ?? '') + '|' + (opts.metal ?? '') + '|' + (opts.rough ?? '');
  let m = _matCache.get(key);
  if (!m) {
    m = new THREE.MeshToonMaterial({ color: new THREE.Color(color), gradientMap: toonRamp(ctx) });
    if (opts.emissive) { m.emissive = new THREE.Color(opts.emissive); m.emissiveIntensity = opts.emissiveIntensity ?? 1; }
    if (opts.metal != null) m.metalness = opts.metal;
    if (opts.rough != null) m.roughness = opts.rough;
    _matCache.set(key, m);
  }
  return m;
}
/** 克隆一份材质（用于需要独立改 emissive 状态的实例）。 */
export function matClone(ctx, color, opts = {}) { return mat(ctx, color, opts).clone(); }

const _geo = new Map();
function geo(key, fn) { if (!_geo.has(key)) _geo.set(key, fn()); return _geo.get(key); }

let _pointsMat = null;
function pointsMat(color, size = 0.14) {
  if (!_pointsMat) _pointsMat = new THREE.PointsMaterial({ size, vertexColors: false, transparent: true, opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
  _pointsMat.color.set(color); _pointsMat.size = size; return _pointsMat;
}

// ---- 构建器 ----

export const CHEST_TIERS = {
  common:   { body: '#8a5a2b', trim: '#5f4320', glow: null, label: '普通宝箱' },
  exquisite:{ body: '#2a6a8a', trim: '#cfc8b6', glow: '#7ad0e0', label: '精致宝箱' },
  precious: { body: '#5f3a8a', trim: '#e8c860', glow: '#ffd060', label: '珍贵宝箱' },
};
export const CHEST_REWARDS = { common: '摩拉 ×300 + 武器素材', exquisite: '摩拉 ×800 + 圣遗物', precious: '摩拉 ×1500 + 原石 ×5' };

export function buildChest(ctx, tier = 'common') {
  const cfg = CHEST_TIERS[tier] ?? CHEST_TIERS.common;
  const g = new THREE.Group();
  const base = new THREE.Mesh(geo('chest_base', () => new THREE.BoxGeometry(1.0, 0.55, 0.7)), mat(ctx, cfg.body, { rough: 0.7 }));
  base.position.y = 0.28; base.castShadow = base.receiveShadow = true; g.add(base);
  const band = new THREE.Mesh(geo('chest_band', () => new THREE.BoxGeometry(1.05, 0.15, 0.75)), mat(ctx, cfg.trim, { metal: 0.7, rough: 0.35 }));
  band.position.y = 0.32; g.add(band);
  const lidPivot = new THREE.Group(); lidPivot.position.set(0, 0.55, -0.35); g.add(lidPivot);
  const lid = new THREE.Mesh(geo('chest_lid', () => new THREE.BoxGeometry(1.0, 0.34, 0.7)), mat(ctx, cfg.body, { rough: 0.7 }));
  lid.position.set(0, 0.17, 0.35); lid.castShadow = true; lidPivot.add(lid);
  const lidBand = new THREE.Mesh(geo('chest_lidband', () => new THREE.BoxGeometry(1.05, 0.1, 0.75)), mat(ctx, cfg.trim, { metal: 0.7, rough: 0.35 }));
  lidBand.position.set(0, 0.35, 0.35); lidPivot.add(lidBand);
  if (cfg.glow) {
    const orb = new THREE.Mesh(geo('chest_orb', () => new THREE.SphereGeometry(0.1, 12, 10)), matClone(ctx, '#fff', { emissive: cfg.glow, emissiveIntensity: 1.8 }));
    orb.position.set(0, 0.78, 0.35); lidPivot.add(orb);
  }
  g.userData = { lid: lidPivot, open: 0, tier };
  return g;
}

export function buildMonument(ctx, element = 'geo') {
  const col = ELEMENT_COLORS[element] ?? '#ffffff';
  const g = new THREE.Group();
  const stone = mat(ctx, '#7d7f86', { rough: 0.8 });
  const base = new THREE.Mesh(geo('mon_base', () => new THREE.BoxGeometry(0.95, 0.24, 0.95)), stone);
  base.position.y = 0.12; base.castShadow = base.receiveShadow = true; g.add(base);
  const pillar = new THREE.Mesh(geo('mon_pillar', () => new THREE.BoxGeometry(0.5, 1.4, 0.5)), stone);
  pillar.position.y = 0.95; pillar.castShadow = true; g.add(pillar);
  const rune = new THREE.Mesh(geo('mon_rune', () => new THREE.OctahedronGeometry(0.22, 0)), matClone(ctx, '#16161c', { emissive: col, emissiveIntensity: 0.55 }));
  rune.position.y = 1.9; g.add(rune);
  const ring = new THREE.Mesh(geo('mon_ring', () => new THREE.TorusGeometry(0.44, 0.03, 8, 24)), matClone(ctx, '#16161c', { emissive: col, emissiveIntensity: 0.4 }));
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.26; g.add(ring);
  g.userData = { rune, ring, element, lit: false };
  return g;
}
export function setMonumentLit(mon, lit) {
  const u = mon.userData;
  u.lit = lit;
  u.rune.material.emissiveIntensity = lit ? 2.6 : 0.55;
  u.ring.material.emissiveIntensity = lit ? 1.8 : 0.4;
  u.rune.material.color.set(lit ? '#ffffff' : '#16161c');
}

export function buildWaypoint(ctx) {
  const g = new THREE.Group();
  const stone = mat(ctx, '#9a9fa8', { rough: 0.7 });
  const base = new THREE.Mesh(geo('wp_base', () => new THREE.CylinderGeometry(0.5, 0.66, 0.4, 12)), stone);
  base.position.y = 0.2; base.castShadow = base.receiveShadow = true; g.add(base);
  const pillar = new THREE.Mesh(geo('wp_pillar', () => new THREE.CylinderGeometry(0.28, 0.34, 1.6, 10)), stone);
  pillar.position.y = 1.2; pillar.castShadow = true; g.add(pillar);
  const orb = new THREE.Mesh(geo('wp_orb', () => new THREE.SphereGeometry(0.22, 14, 12)), matClone(ctx, '#eaf7ff', { emissive: '#5cc8ff', emissiveIntensity: 1.5 }));
  orb.position.y = 2.3; g.add(orb);
  const ring = new THREE.Mesh(geo('wp_ring', () => new THREE.TorusGeometry(0.42, 0.03, 8, 24)), matClone(ctx, '#88e0ff', { emissive: '#4cc8ff', emissiveIntensity: 1.0 }));
  ring.position.y = 2.3; g.add(ring);
  g.userData = { orb, ring, active: false };
  return g;
}

function makeWindParticles(N, radius, heightH) {
  const arr = []; const positions = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * radius;
    const x = Math.cos(a) * r, z = Math.sin(a) * r, y = Math.random() * heightH;
    positions[i * 3] = x; positions[i * 3 + 1] = y; positions[i * 3 + 2] = z;
    arr.push({ x, z, y, speed: 1.4 + Math.random() * 2.2 });
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  return { geo: g, arr, heightH };
}

export function buildWindField(ctx, radius = 1.7, heightH = 9) {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(geo('wf_ring', () => new THREE.TorusGeometry(radius, 0.06, 8, 32)), matClone(ctx, '#74c8a8', { emissive: '#3aa88a', emissiveIntensity: 1.1 }));
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.15; g.add(ring);
  const p = makeWindParticles(56, radius * 0.9, heightH);
  const points = new THREE.Points(p.geo, pointsMat('#a8ffe0', 0.13));
  g.add(points);
  g.userData = { ring, points, arr: p.arr, radius, heightH };
  return g;
}

export function buildSeelie(ctx, color = '#7ad0ff') {
  const g = new THREE.Group();
  const orb = new THREE.Mesh(geo('seelie_orb', () => new THREE.SphereGeometry(0.18, 12, 10)), matClone(ctx, '#ffffff', { emissive: color, emissiveIntensity: 2.2 }));
  g.add(orb);
  const light = new THREE.PointLight(color, 6, 8, 2); g.add(light);
  g.userData = { orb, light };
  return g;
}

export function buildPressurePlate(ctx) {
  const g = new THREE.Group();
  const plate = new THREE.Mesh(geo('pp_plate', () => new THREE.CylinderGeometry(0.9, 0.9, 0.18, 20)), mat(ctx, '#8a6a3a', { rough: 0.6 }));
  plate.position.y = 0.09; plate.castShadow = plate.receiveShadow = true; g.add(plate);
  const glow = new THREE.Mesh(geo('pp_glow', () => new THREE.CylinderGeometry(0.85, 0.85, 0.05, 20)), matClone(ctx, '#111', { emissive: '#f0b93c', emissiveIntensity: 0.3 }));
  glow.position.y = 0.2; g.add(glow);
  g.userData = { plate, glow, pressed: false };
  return g;
}

export function buildTorch(ctx) {
  const g = new THREE.Group();
  const stand = new THREE.Mesh(geo('torch_stand', () => new THREE.CylinderGeometry(0.16, 0.24, 1.0, 10)), mat(ctx, '#5a5248', { rough: 0.8 }));
  stand.position.y = 0.5; stand.castShadow = true; g.add(stand);
  const bowl = new THREE.Mesh(geo('torch_bowl', () => new THREE.CylinderGeometry(0.34, 0.2, 0.3, 12)), mat(ctx, '#3a3a40', { rough: 0.6, metal: 0.4 }));
  bowl.position.y = 1.05; g.add(bowl);
  const flame = new THREE.Mesh(geo('torch_flame', () => new THREE.ConeGeometry(0.18, 0.5, 10)), matClone(ctx, '#ff7a55', { emissive: '#ff7a55', emissiveIntensity: 2.4 }));
  flame.position.y = 1.42; g.add(flame);
  const light = new THREE.PointLight(0xff9a55, 0, 6, 2); light.position.y = 1.5; g.add(light);
  g.userData = { flame, light, lit: false };
  return g;
}
export function setTorchLit(t, lit) {
  const u = t.userData; u.lit = lit;
  u.flame.visible = lit;
  u.flame.material.emissiveIntensity = lit ? 2.4 : 0.1;
  u.light.intensity = lit ? 6 : 0;
}

export function buildMemoryStone(ctx, color = '#c88bfa') {
  const g = new THREE.Group();
  const ped = new THREE.Mesh(geo('ms_ped', () => new THREE.CylinderGeometry(0.4, 0.5, 0.2, 10)), mat(ctx, '#6a6f78', { rough: 0.7 }));
  ped.position.y = 0.1; ped.receiveShadow = true; g.add(ped);
  const stone = new THREE.Mesh(geo('ms_stone', () => new THREE.DodecahedronGeometry(0.32, 0)), matClone(ctx, '#16161c', { emissive: color, emissiveIntensity: 0.5 }));
  stone.position.y = 0.55; g.add(stone);
  g.userData = { stone, lit: false };
  return g;
}
export function setMemoryLit(ms, lit, color) {
  const u = ms.userData; u.lit = lit;
  u.stone.material.emissiveIntensity = lit ? 2.4 : 0.5;
  if (color) u.stone.material.emissive.set(color);
}

const BREAKABLE = {
  barrel: { color: '#8a6a3a', make: () => new THREE.CylinderGeometry(0.4, 0.4, 0.9, 10) },
  crate:  { color: '#a8834f', make: () => new THREE.BoxGeometry(0.85, 0.85, 0.85) },
  rock:   { color: '#8d9299', make: () => new THREE.DodecahedronGeometry(0.5, 0) },
};
export function buildBreakable(ctx, kind = 'crate') {
  const c = BREAKABLE[kind] ?? BREAKABLE.crate;
  const m = new THREE.Mesh(geo('brk_' + kind, c.make), mat(ctx, c.color, { rough: 0.85 }));
  m.castShadow = m.receiveShadow = true;
  m.userData = { kind };
  return m;
}

export const GATHER = {
  berry:      { color: '#e05050', glow: '#ff8888', make: () => new THREE.IcosahedronGeometry(0.22, 0), label: '树莓' },
  sweetflower:{ color: '#f6f2ff', glow: '#ffffff', make: () => new THREE.ConeGeometry(0.2, 0.42, 6), label: '甜甜花' },
  mint:       { color: '#6ad05a', glow: '#a0ff90', make: () => new THREE.ConeGeometry(0.18, 0.36, 6), label: '薄荷' },
  iron:       { color: '#6a6f78', glow: null,          make: () => new THREE.DodecahedronGeometry(0.28, 0), label: '铁矿石' },
  crystal:    { color: '#66ccff', glow: '#7ad0ff', make: () => new THREE.OctahedronGeometry(0.26, 0), label: '水晶矿' },
};

export function buildCamp(ctx) {
  const g = new THREE.Group();
  const tent = new THREE.Mesh(geo('camp_tent', () => new THREE.ConeGeometry(1.6, 1.5, 4)), mat(ctx, '#c8b088', { rough: 0.9 }));
  tent.rotation.y = Math.PI / 4; tent.position.y = 0.75; tent.castShadow = tent.receiveShadow = true; g.add(tent);
  const logGeo = geo('camp_log', () => new THREE.CylinderGeometry(0.08, 0.08, 0.8, 6));
  for (let i = 0; i < 3; i++) { const l = new THREE.Mesh(logGeo, mat(ctx, '#6a4a28')); l.rotation.z = Math.PI / 2; l.rotation.y = i * Math.PI / 3; l.position.y = 0.08; g.add(l); }
  const flame = new THREE.Mesh(geo('camp_flame', () => new THREE.ConeGeometry(0.22, 0.55, 8)), matClone(ctx, '#ff7a55', { emissive: '#ff7a55', emissiveIntensity: 2.0 }));
  flame.position.set(0, 0.5, 0); g.add(flame);
  const light = new THREE.PointLight(0xff9a55, 4, 10, 2); light.position.set(0, 1.2, 0); g.add(light);
  return g;
}

/** NPC 占位胶囊（characters 模块缺失时回退）。 */
export function makeNPCPlaceholder(ctx, color = '#d8c8b0') {
  const g = new THREE.Group();
  const body = new THREE.Mesh(geo('npc_body', () => new THREE.CapsuleGeometry(0.3, 0.9, 4, 12)), mat(ctx, color, { rough: 0.7 }));
  body.position.y = 0.9; body.castShadow = true; g.add(body);
  const head = new THREE.Mesh(geo('npc_head', () => new THREE.SphereGeometry(0.24, 14, 12)), mat(ctx, '#f2d8c0', { rough: 0.6 }));
  head.position.y = 1.7; g.add(head);
  return g;
}

// ---- 头顶气泡（Canvas2D 文字） ----
const _bubbleCache = new Map();
export function makeBubble(ctx, text) {
  let tex = _bubbleCache.get(text);
  if (!tex) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 96;
    const g2 = c.getContext('2d');
    g2.fillStyle = 'rgba(250,246,232,0.95)'; g2.strokeStyle = '#e8d5a8'; g2.lineWidth = 6;
    roundRect(g2, 8, 8, 240, 64, 18); g2.fill(); g2.stroke();
    g2.fillStyle = '#3b3226'; g2.font = 'bold 30px "Microsoft YaHei", sans-serif'; g2.textAlign = 'center'; g2.textBaseline = 'middle';
    g2.fillText(text, 128, 42);
    tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.minFilter = THREE.LinearFilter;
    if (_bubbleCache.size > 24) { const k0 = _bubbleCache.keys().next().value; _bubbleCache.delete(k0); }
    _bubbleCache.set(text, tex);
  }
  const sm = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  const sp = new THREE.Sprite(sm); sp.scale.set(2.6, 0.98, 1); sp.position.y = 2.35;
  return sp;
}
function roundRect(g2, x, y, w, h, r) {
  g2.beginPath(); g2.moveTo(x + r, y);
  g2.arcTo(x + w, y, x + w, y + h, r); g2.arcTo(x + w, y + h, x, y + h, r);
  g2.arcTo(x, y + h, x, y, r); g2.arcTo(x, y, x + w, y, r); g2.closePath();
}

// ---- 交互注册（interact 缺失时先入队，出现后补注册） ----
export class InteractRegistrar {
  constructor(ctx) { this.ctx = ctx; this.pending = []; this.handles = []; }
  register(opts) {
    if (!this.ctx.interact) {
      this.pending.push(opts);
      return { remove: () => { const i = this.pending.indexOf(opts); if (i >= 0) this.pending.splice(i, 1); } };
    }
    try { const h = this.ctx.interact.register(opts); this.handles.push(h); return h; }
    catch (e) { console.log('[worldobjects] interact', e); return { remove() {} }; }
  }
  flush() {
    if (!this.ctx.interact || !this.pending.length) return;
    for (const o of this.pending.splice(0)) { try { this.handles.push(this.ctx.interact.register(o)); } catch {} }
  }
  clear() { for (const h of this.handles) try { h?.remove?.(); } catch {} this.handles.length = 0; }
}

// =====================================================================
export class WorldObjects {
  constructor(ctx) {
    this.ctx = ctx;
    this.group = new THREE.Group(); this.group.name = 'worldobjects';
    ctx.scene.add(this.group);
    this.registrar = new InteractRegistrar(ctx);
    this.chests = []; this.waypoints = []; this.gathering = []; this.breakables = []; this.camps = [];
    this.windFields = []; this.seelies = [];
    this.effects = []; this.fragments = [];
    this._gatherMesh = new Map(); // type -> InstancedMesh
    this._listeners = [];
    const on = (n, f) => { const u = ctx.events?.on?.(n, f); if (u) this._listeners.push(u); };
    on('combat:hit', (p) => this._onHit(p));

    if (ctx.dev) this._buildDemo(); else this._buildWorld();
  }

  // ---------- 世界布局（真实） ----------
  _buildWorld() {
    const ctx = this.ctx, rng = makeRNG(0xD0B0B5);

    const chestPlan = [];
    const tierOf = i => (i % 6 === 0 ? 'precious' : i % 3 === 0 ? 'exquisite' : 'common');
    let ci = 0;
    const regionsCount = [['mondstadt', 3], ['windrise', 3], ['cider', 2], ['lake', 2], ['stormbearer', 3], ['dragonspine', 3], ['stonegate', 3], ['ruins', 3], ['beach', 3]];
    for (const [rid, count] of regionsCount) {
      const reg = REGIONS.find(r => r.id === rid); if (!reg) continue;
      for (let k = 0; k < count; k++) {
        const s = findFlatSpot(reg.x, reg.z, rng, reg.r * 0.7, 16);
        chestPlan.push({ x: s.x, y: s.y, z: s.z, tier: tierOf(ci++) });
      }
    }
    this._batch(chestPlan, (c, i) => this.addChest(c.x, c.y, c.z, c.tier, 'chest_' + i), 5);

    const waypoints = [
      ['statue_seven', 0, 0], ['windrise', -230, 210], ['cider', -520, -120],
      ['lake', 520, 340], ['dragonspine', -260, -1080], ['stonegate', 980, -420], ['ruins', -1080, -420],
    ];
    this._batch(waypoints, ([id, x, z]) => this.addWaypoint(x, height(x, z), z, id), 3);

    const gatherPlan = [];
    const gatherTypes = ['berry', 'sweetflower', 'mint', 'iron', 'crystal'];
    let gi = 0;
    for (const [rid, count] of [['mondstadt', 6], ['windrise', 6], ['cider', 5], ['lake', 5], ['stormbearer', 6], ['dragonspine', 6], ['stonegate', 5], ['ruins', 5], ['beach', 4]]) {
      const reg = REGIONS.find(r => r.id === rid); if (!reg) continue;
      for (let k = 0; k < count; k++) {
        const s = findFlatSpot(reg.x, reg.z, rng, reg.r * 0.75, 16);
        gatherPlan.push({ x: s.x, y: s.y, z: s.z, type: gatherTypes[gi++ % gatherTypes.length] });
      }
    }
    this._batch(gatherPlan, (p, i) => this.addGathering(p.x, p.y, p.z, p.type, 'gather_' + i), 8);

    const brkPlan = [];
    const kinds = ['barrel', 'crate', 'rock'];
    for (let i = 0; i < 20; i++) {
      const reg = REGIONS[i % REGIONS.length];
      const s = findFlatSpot(reg.x, reg.z, rng, reg.r * 0.7, 14);
      brkPlan.push({ x: s.x, y: s.y, z: s.z, kind: kinds[i % 3] });
    }
    this._batch(brkPlan, (p, i) => this.addBreakable(p.x, p.y, p.z, p.kind, 'brk_' + i), 5);

    const camps = [['windrise', -300, 260], ['stormbearer', -800, 480], ['beach', 300, 1150]];
    this._batch(camps, ([, x, z]) => this.addCamp(x, height(x, z), z), 2);

    // 两个用于攀爬/滑翔的独立风场
    this._batch([['windrise', -230, 210], ['stonegate', 980, -420]], ([, x, z]) => this.addWindField(x, height(x, z), z, 1.8, 11), 1);
  }

  // ---------- 演示布局（dev 场景） ----------
  _buildDemo() {
    const ctx = this.ctx;
    // 三种宝箱
    this.addChest(-2, 0, 3, 'common', 'demo_chest_c');
    this.addChest(0, 0, 3.2, 'exquisite', 'demo_chest_e');
    this.addChest(2, 0, 3, 'precious', 'demo_chest_p');
    // 传送锚点
    this.addWaypoint(-2, 0, -1.5, 'demo_waypoint');
    // 采集点（3 种）
    this.addGathering(2.5, 0, 1.2, 'berry', 'demo_g1');
    this.addGathering(3.0, 0, 1.0, 'sweetflower', 'demo_g2');
    this.addGathering(3.5, 0, 1.2, 'crystal', 'demo_g3');
    // 可破坏物
    this.addBreakable(4.5, 0, 0.5, 'barrel', 'demo_b1');
    this.addBreakable(4.8, 0, 0.8, 'crate', 'demo_b2');
    this.addBreakable(4.4, 0, 0.9, 'rock', 'demo_b3');
    // 冒险家营地
    this.addCamp(-4, 0, 1.5);
    // 风场
    this.addWindField(5.5, 0, -1, 1.6, 9);
  }

  _batch(items, fn, per) {
    const ctx = this.ctx;
    for (let i = 0; i < items.length; i += per) {
      const slice = items.slice(i, i + per);
      ctx.tasks?.push(() => { for (let k = 0; k < slice.length; k++) fn(slice[k], i + k); }, Math.floor(i / per));
    }
  }

  // ---------- 添加对象 ----------
  addChest(x, y, z, tier, id) {
    const ctx = this.ctx;
    const g = buildChest(ctx, tier);
    g.position.set(x, y, z);
    this.group.add(g);
    const c = { id, tier, pos: new THREE.Vector3(x, y, z), group: g, lid: g.userData.lid, opened: false, handle: null };
    c.handle = this.registrar.register({
      pos: c.pos, radius: 2.2, label: CHEST_TIERS[tier].label, icon: 'chest', once: true,
      onInteract: () => this.openChest(c),
    });
    this.chests.push(c);
    return c;
  }

  addWaypoint(x, y, z, id) {
    const ctx = this.ctx;
    const g = buildWaypoint(ctx);
    g.position.set(x, y, z);
    this.group.add(g);
    const w = { id, pos: new THREE.Vector3(x, y, z), group: g, active: false, handle: null };
    w.handle = this.registrar.register({
      pos: w.pos, radius: 2.8, label: '激活传送锚点', icon: 'waypoint', once: false,
      onInteract: () => this.activateWaypoint(w),
    });
    this.waypoints.push(w);
    return w;
  }
  activateWaypoint(w) {
    if (w.active) { this.teleport(w); return; }
    w.active = true;
    w.group.userData.ring.material.emissiveIntensity = 2.0;
    w.group.userData.orb.material.emissiveIntensity = 2.4;
    this.ctx.audio?.sfx?.('waypoint_unlock', { pos: w.pos });
    this.ctx.fx3d?.burst?.(w.pos, 'anemo', 1.2);
    this.ctx.ui?.toast?.('传送锚点已激活');
    this.ctx.events?.emit('waypoint:unlocked', { id: w.id });
  }
  teleport(w) {
    const p = this.ctx.player;
    if (p?.teleport) p.teleport(w.pos.x, w.pos.z);
    else if (p?.root) p.root.position.set(w.pos.x, w.pos.y + 0.2, w.pos.z);
    this.ctx.audio?.sfx?.('waypoint_unlock', { pos: w.pos });
  }

  addGathering(x, y, z, type, id) {
    const ctx = this.ctx;
    let im = this._gatherMesh.get(type);
    if (!im) {
      im = new THREE.InstancedMesh(geo('gather_' + type, GATHER[type].make), mat(ctx, GATHER[type].color, { emissive: GATHER[type].glow, emissiveIntensity: GATHER[type].glow ? 0.7 : 0, rough: 0.7 }), 512);
      im.count = 0; im.castShadow = true; im.receiveShadow = true;
      this.group.add(im);
      this._gatherMesh.set(type, im);
    }
    const idx = im.count++;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(0.8 + (idx % 3) * 0.25, 0.8 + (idx % 3) * 0.25, 0.8 + (idx % 3) * 0.25);
    q.setFromEuler(new THREE.Euler(0, idx * 2.4, 0));
    m4.compose(new THREE.Vector3(x, y + 0.2, z), q, s);
    im.setMatrixAt(idx, m4); im.instanceMatrix.needsUpdate = true;
    const g = { id, type, pos: new THREE.Vector3(x, y, z), idx, im, collected: false, handle: null };
    g.handle = this.registrar.register({
      pos: g.pos, radius: 1.8, label: '采集 ' + GATHER[type].label, icon: 'pickup', once: true,
      onInteract: () => this.collect(g),
    });
    this.gathering.push(g);
    return g;
  }
  collect(g) {
    if (g.collected) return;
    g.collected = true; g.handle?.remove?.();
    const m4 = new THREE.Matrix4().makeTranslation(0, -2000, 0);
    g.im.setMatrixAt(g.idx, m4); g.im.instanceMatrix.needsUpdate = true;
    this.ctx.audio?.sfx?.('ui_confirm', { pos: g.pos });
    this.ctx.ui?.toast?.('获得 ' + GATHER[g.type].label + ' ×1');
    this.ctx.events?.emit('gather', { type: g.type, pos: g.pos });
  }

  addBreakable(x, y, z, kind, id) {
    const ctx = this.ctx;
    const m = buildBreakable(ctx, kind);
    m.position.set(x, y + 0.4, z);
    m.userData.id = id;
    this.group.add(m);
    this.breakables.push(m);
    return m;
  }

  addCamp(x, y, z) {
    const g = buildCamp(this.ctx);
    g.position.set(x, y, z);
    this.group.add(g);
    this.camps.push(g);
    return g;
  }

  addWindField(x, y, z, radius, heightH, strength = 13.5) {
    const g = buildWindField(this.ctx, radius, heightH);
    g.position.set(x, y, z);
    this.group.add(g);
    // 供集成者滑翔上升气流读取：{x, z, radius, strength, top}；作用高度 = baseY + heightH
    const wf = { x, z, baseY: y, radius, heightH, strength, top: y + heightH, group: g, points: g.userData.points, arr: g.userData.arr };
    this.windFields.push(wf);
    return wf;
  }

  // ---------- 交互 / 破坏 ----------
  openChest(c) {
    if (c.opened) return;
    c.opened = true; c.handle?.remove?.();
    const ctx = this.ctx;
    ctx.audio?.sfx?.('chest_open', { pos: c.pos });
    ctx.fx3d?.burst?.(c.pos, 'geo', 1);
    ctx.events?.emit('chest:opened', { id: c.id, tier: c.tier });
    ctx.ui?.toast?.('获得 ' + CHEST_REWARDS[c.tier], { icon: 'chest' });
    this._spawnChestEffect(c);
  }

  _spawnChestEffect(c) {
    const ctx = this.ctx;
    // 金光柱
    const pillar = new THREE.Mesh(geo('gold_pillar', () => new THREE.CylinderGeometry(0.5, 0.7, 3, 16, 1, true)),
      new THREE.MeshBasicMaterial({ color: 0xffd060, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    pillar.position.copy(c.pos).add(new THREE.Vector3(0, 1.5, 0));
    this.group.add(pillar);
    // 飞出的物品（摩拉）
    const itemGeo = geo('mora', () => new THREE.CylinderGeometry(0.09, 0.09, 0.03, 8));
    const items = [];
    for (let i = 0; i < 3; i++) {
      const it = new THREE.Mesh(itemGeo, new THREE.MeshBasicMaterial({ color: 0xffd060 }));
      it.position.copy(c.pos).add(new THREE.Vector3(0, 0.6, 0));
      this.group.add(it);
      items.push({ m: it, v: new THREE.Vector3((Math.random() - 0.5) * 2, 3 + Math.random() * 2, (Math.random() - 0.5) * 2) });
    }
    const e = { t: 0, life: 1.4, pillar, items, update(dt, self) { self.t += dt; const k = self.t / self.life;
      self.pillar.scale.y = 0.3 + k * 2.2; self.pillar.material.opacity = Math.max(0, 0.85 * (1 - k));
      for (const it of self.items) { it.v.y -= 9 * dt; it.m.position.addScaledVector(it.v, dt); }
      if (self.t >= self.life) { self.pillar.material.dispose(); return false; } return true; } };
    this.effects.push(e);
  }

  _onHit(p) {
    const origin = p?.info?.origin;
    if (!origin) return;
    for (const m of this.breakables) {
      if (m.userData.dead) continue;
      if (m.position.distanceTo(origin) < 1.4) this.shatter(m);
    }
  }
  shatter(m) {
    m.userData.dead = true;
    m.visible = false;
    const ctx = this.ctx;
    ctx.audio?.sfx?.('hit_metal', { pos: m.position });
    ctx.fx3d?.dust?.(m.position, 8);
    ctx.events?.emit('breakable:broken', { id: m.userData.id, kind: m.userData.kind, pos: m.position });
    ctx.ui?.toast?.('掉落 木材 ×1');
    const fragGeo = geo('frag', () => new THREE.BoxGeometry(0.18, 0.18, 0.18));
    const fragMat = new THREE.MeshStandardMaterial({ color: m.material?.color?.getHex?.() ?? 0x8a6a3a });
    for (let i = 0; i < 7; i++) {
      const f = new THREE.Mesh(fragGeo, fragMat);
      f.position.copy(m.position);
      this.group.add(f);
      this.fragments.push({ m: f, v: new THREE.Vector3((Math.random() - 0.5) * 4, 2 + Math.random() * 3, (Math.random() - 0.5) * 4), life: 0.9 });
    }
  }

  // ---------- 每帧 ----------
  update(dt) {
    const ctx = this.ctx;
    this.registrar.flush();
    const t = ctx.time?.elapsed ?? 0;

    // 宝箱开盖动画 + 悬浮
    for (const c of this.chests) {
      if (c.opened) c.lid.rotation.x = Math.max(-Math.PI * 0.72, c.lid.rotation.x - 2.4 * dt);
      c.group.position.y = c.pos.y + Math.sin(t * 1.6 + c.pos.x) * 0.04;
    }
    // 锚点旋转
    for (const w of this.waypoints) {
      const u = w.group.userData;
      u.ring.rotation.z += dt * 0.8;
      u.orb.position.y = 2.3 + Math.sin(t * 2 + w.pos.x) * 0.08;
    }
    // 风场：粒子上升动画（实际抬升由集成者 environment 读 ctx.windFields / worldObjects.windFields 处理）
    for (const wf of this.windFields) {
      const pa = wf.points.geometry.attributes.position;
      for (let i = 0; i < wf.arr.length; i++) {
        const pr = wf.arr[i]; pr.y += pr.speed * dt;
        if (pr.y > wf.heightH) pr.y = 0;
        pa.array[i * 3 + 1] = pr.y;
      }
      pa.needsUpdate = true;
    }
    // 特效
    for (let i = this.effects.length - 1; i >= 0; i--) { const e = this.effects[i]; let alive = true; try { alive = e.update(dt, e); } catch { alive = false; } if (!alive) { this.group.remove(e.pillar); for (const it of e.items) this.group.remove(it.m); this.effects.splice(i, 1); } }
    // 碎片
    for (let i = this.fragments.length - 1; i >= 0; i--) { const f = this.fragments[i]; f.life -= dt; f.v.y -= 12 * dt; f.m.position.addScaledVector(f.v, dt); if (f.life <= 0) { this.group.remove(f.m); this.fragments.splice(i, 1); } }
  }

  dispose() {
    for (const un of this._listeners) try { un(); } catch {}
    this.registrar.clear();
    this.ctx.scene.remove(this.group);
  }
}
