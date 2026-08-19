/**
 * Destructible.js — 建筑破坏系统。
 *
 * BuildingKit 输出的是"零件表"（box / cyl / wedge + 材质 + 强度）。本模块：
 *   · 把所有建筑的所有零件按 (形状, 材质) 合并成少量 InstancedMesh —— 上千个零件也只有十几个 draw call
 *   · 每个零件在 InstancedMesh 里占一个固定槽位；LOD 隐藏时把矩阵缩到 0
 *   · 每隔一小段时间用龙卷风风场算动压 q = ½ρv²，超过零件强度就"脱落"：
 *     交给 MiniPhysics 变成刚体，被切向风甩出去、被上升气流抬起、落地休眠
 *   · 脱落会削弱其上方零件的强度 → 结构连锁倒塌
 */
import * as THREE from 'three';
import { Body } from '../core/MiniPhysics.js';
import { P } from '../core/Params.js';
import { clamp } from '../core/Random.js';

const _m = new THREE.Matrix4();
const _mz = new THREE.Matrix4().makeScale(0, 0, 0);
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _s = new THREE.Vector3();

/** 材质密度（kg/m³），决定零件质量与被吹走的难易 */
const DENSITY = {
  wood: 520, woodPale: 480, paint: 500, paintRed: 500, plaster: 900,
  adobe: 1600, brick: 1900, concrete: 2300, roofShin: 700, roofTile: 1500,
  metal: 2700, metalRust: 2700, glass: 2500, dark: 700,
};

/** 单位楔形：XY 截面是直角三角形（直角在 -X,-Y），沿 Z 挤出 */
function wedgeGeometry() {
  const g = new THREE.BufferGeometry();
  const v = [
    // 前后两个三角面
    -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, -0.5, 0.5, 0.5,
    -0.5, -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, -0.5, -0.5,
    // 底面
    -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, -0.5, 0.5,
    -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, -0.5, -0.5, 0.5,
    // 竖直面
    -0.5, -0.5, -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, 0.5,
    -0.5, -0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, -0.5,
    // 斜面
    0.5, -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5,
    0.5, -0.5, -0.5, -0.5, 0.5, 0.5, 0.5, -0.5, 0.5,
  ];
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.computeVertexNormals();
  return g;
}

export class DestructionSystem {
  /**
   * @param {THREE.Scene} scene
   * @param {import('../core/Lighting.js').Lighting} lighting
   * @param {import('../core/MiniPhysics.js').PhysicsWorld} physics
   * @param {Record<string, object>} matTable BuildingKit.MAT
   */
  constructor(scene, lighting, physics, matTable) {
    this.scene = scene;
    this.lighting = lighting;
    this.physics = physics;
    this.MAT = matTable || {};
    this.geo = {
      box: new THREE.BoxGeometry(1, 1, 1),
      cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 14, 1),
      wedge: wedgeGeometry(),
    };
    /** @type {Map<string, {im: THREE.InstancedMesh, parts: any[], key: string}>} */
    this.batches = new Map();
    /** @type {any[]} */
    this.parts = [];
    /** @type {any[]} */
    this.buildings = [];
    this.group = new THREE.Group();
    this.group.name = 'buildings';
    this.scene.add(this.group);
    this._pending = [];
    this._checkT = 0;
    this._lodT = 0;
    this.destroyedCount = 0;
    this.onDestroy = null;    // (buildingRecord) => void
  }

  /** 登记一栋建筑（先收集，finalize 时统一建 InstancedMesh） */
  add(building, { x = 0, z = 0, y = 0, rotY = 0, scale = 1 } = {}) {
    const rec = {
      label: building.label || building.kind, kind: building.kind,
      pos: new THREE.Vector3(x, y, z), rotY, scale,
      parts: [], lost: 0, total: 0, notified: false,
      radius: Math.max(building.footprint?.[0] || 8, building.footprint?.[1] || 8) * 0.5 * scale,
      height: (building.height || 8) * scale,
    };
    const base = new THREE.Matrix4().makeRotationY(rotY);
    base.setPosition(x, y, z);
    for (const p of building.parts) {
      const shape = this.geo[p.shape] ? p.shape : 'box';
      const key = shape + '|' + (this.MAT[p.mat] ? p.mat : 'wood');
      _e.set(p.rot?.[0] || 0, p.rot?.[1] || 0, p.rot?.[2] || 0);
      _q.setFromEuler(_e);
      const local = new THREE.Matrix4().compose(
        _v.set((p.pos?.[0] || 0) * scale, (p.pos?.[1] || 0) * scale, (p.pos?.[2] || 0) * scale),
        _q,
        _s.set(Math.max(p.size?.[0] || 0.2, 0.01) * scale, Math.max(p.size?.[1] || 0.2, 0.01) * scale, Math.max(p.size?.[2] || 0.2, 0.01) * scale));
      const world = new THREE.Matrix4().multiplyMatrices(base, local);
      const wp = new THREE.Vector3(), wq = new THREE.Quaternion(), ws = new THREE.Vector3();
      world.decompose(wp, wq, ws);
      const part = {
        key, shape, mat: this.MAT[p.mat] ? p.mat : 'wood',
        pos: wp, quat: wq, size: ws,
        home: { pos: wp.clone(), quat: wq.clone() },
        strength: (p.strength || 2500) * (p.anchor ? 50 : 1),
        anchor: !!p.anchor, detail: p.detail | 0,
        state: 0,           // 0=附着 1=飞行 2=落定 3=隐藏
        body: null, slot: -1, batch: null, rec, visible: true,
      };
      rec.parts.push(part);
      rec.total++;
      this.parts.push(part);
      this._pending.push(part);
    }
    this.buildings.push(rec);
    return rec;
  }

  /** 建立 InstancedMesh 批次 */
  finalize() {
    const groups = new Map();
    for (const p of this._pending) {
      if (!groups.has(p.key)) groups.set(p.key, []);
      groups.get(p.key).push(p);
    }
    for (const [key, parts] of groups) {
      const [shape, matName] = key.split('|');
      const md = this.MAT[matName] || { color: 0x998877, roughness: 0.8, metalness: 0 };
      const mat = new THREE.MeshStandardMaterial({
        color: md.color, roughness: md.roughness ?? 0.8, metalness: md.metalness ?? 0,
        transparent: !!md.transparent, opacity: md.opacity ?? 1,
        flatShading: shape !== 'cyl',
      });
      this.lighting.patchFog(mat);
      let batch = this.batches.get(key);
      const need = (batch ? batch.parts.length : 0) + parts.length;
      if (!batch || batch.im.instanceMatrix.count < need) {
        /* 重建更大的批次 */
        const old = batch;
        const im = new THREE.InstancedMesh(this.geo[shape], mat, Math.ceil(need * 1.15) + 8);
        im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        im.castShadow = true;
        im.receiveShadow = true;
        im.frustumCulled = false;
        im.count = 0;
        batch = { im, parts: old ? old.parts.slice() : [], key };
        if (old) { this.group.remove(old.im); old.im.dispose(); }
        this.batches.set(key, batch);
        this.group.add(im);
      }
      for (const p of parts) {
        p.slot = batch.parts.length;
        p.batch = batch;
        batch.parts.push(p);
      }
      batch.im.count = batch.parts.length;
      for (const p of batch.parts) this._writeSlot(p);
      batch.im.instanceMatrix.needsUpdate = true;
    }
    this._pending.length = 0;
  }

  _writeSlot(p) {
    if (p.slot < 0 || !p.batch) return;
    if (!p.visible) { p.batch.im.setMatrixAt(p.slot, _mz); return; }
    _m.compose(p.pos, p.quat, p.size);
    p.batch.im.setMatrixAt(p.slot, _m);
  }

  /** 让一个零件脱落 */
  detach(p, wind) {
    if (p.state !== 0 || p.anchor) return false;
    p.state = 1;
    const half = _s.set(p.size.x * 0.5, p.size.y * 0.5, p.size.z * 0.5);
    const vol = 8 * half.x * half.y * half.z;
    const dens = DENSITY[p.mat] ?? 600;
    const body = new Body({
      pos: p.pos, size: half, quat: p.quat,
      mass: Math.max(vol * dens, 0.6),
      cd: p.shape === 'box' ? 1.5 : 1.0,
      density: dens,
    });
    body.external = true;        // 由本系统渲染，DebrisPool 不再重复画
    body.part = p;
    /* 初速度：随风起飞 + 一点爆散感 */
    body.vel.copy(wind).multiplyScalar(0.35);
    body.vel.x += (Math.random() - 0.5) * 6;
    body.vel.z += (Math.random() - 0.5) * 6;
    body.vel.y += Math.random() * 4 + 1.5;
    p.body = this.physics.add(body);

    /* 结构连锁：削弱上方与相邻的零件 */
    const rec = p.rec;
    for (const o of rec.parts) {
      if (o === p || o.state !== 0 || o.anchor) continue;
      const dy = o.pos.y - p.pos.y;
      const dh = Math.hypot(o.pos.x - p.pos.x, o.pos.z - p.pos.z);
      if (dy > -0.6 && dh < Math.max(p.size.x, p.size.z) * 1.6 + 1.5) {
        o.strength *= dy > 0.2 ? 0.55 : 0.82;
      }
    }
    rec.lost++;
    this.destroyedCount++;
    if (!rec.notified && rec.lost > Math.max(3, rec.total * 0.16)) {
      rec.notified = true;
      this.onDestroy?.(rec);
    }
    return true;
  }

  /** 全部复原 */
  rebuild() {
    for (const p of this.parts) {
      if (p.body) {
        const i = this.physics.bodies.indexOf(p.body);
        if (i >= 0) this.physics.bodies.splice(i, 1);
        p.body = null;
      }
      p.pos.copy(p.home.pos);
      p.quat.copy(p.home.quat);
      p.state = 0;
      p.visible = true;
      p.strength = p.strength0 ?? p.strength;
      this._writeSlot(p);
    }
    for (const b of this.batches.values()) b.im.instanceMatrix.needsUpdate = true;
    for (const r of this.buildings) { r.lost = 0; r.notified = false; }
    this.destroyedCount = 0;
  }

  /** 记录初始强度，便于 rebuild 还原 */
  snapshotStrength() { for (const p of this.parts) p.strength0 = p.strength; }

  /**
   * @param {number} dt
   * @param {import('../tornado/Tornado.js').Tornado} tornado
   * @param {THREE.Camera} camera
   */
  update(dt, tornado, camera) {
    const dirty = new Set();

    /* --- 飞行中的零件：跟随刚体 --- */
    for (const p of this.parts) {
      if (p.state !== 1 || !p.body) continue;
      p.pos.copy(p.body.pos);
      p.quat.copy(p.body.quat);
      if (!p.visible) { p.visible = true; }
      this._writeSlot(p);
      dirty.add(p.batch);
      if (p.body.sleep) p.state = 2;
    }

    /* --- 破坏判定（限流：每 0.08s 扫一批） --- */
    this._checkT -= dt;
    if (this._checkT <= 0 && tornado && tornado.strength > 0.02 && P.get('t_autoDamage')) {
      this._checkT = 0.08;
      const thr = P.get('t_damage');
      const reach = tornado.rc * 9 + tornado.dustHeight * 1.6 + 90;
      for (const rec of this.buildings) {
        const d = Math.hypot(rec.pos.x - tornado.position.x, rec.pos.z - tornado.position.z);
        if (d > reach + rec.radius) continue;
        for (const p of rec.parts) {
          if (p.state !== 0 || p.anchor) continue;
          const q = tornado.pressureAt(p.pos);
          if (q > p.strength * thr) {
            tornado.windAt(p.pos, _v2);
            if (this.detach(p, _v2)) dirty.add(p.batch);
          }
        }
      }
    }

    /* --- LOD：远处隐藏细节零件 --- */
    this._lodT -= dt;
    if (this._lodT <= 0) {
      this._lodT = 0.35;
      const bias = P.get('q_lodBias');
      const cx = camera.position.x, cy = camera.position.y, cz = camera.position.z;
      for (const rec of this.buildings) {
        const d = Math.hypot(rec.pos.x - cx, rec.pos.z - cz, (rec.pos.y - cy) * 0.5);
        for (const p of rec.parts) {
          if (p.state === 1) continue;                 // 飞行中永远可见
          const lim = p.detail === 0 ? 1e9 : p.detail === 1 ? 460 * bias : 190 * bias;
          const vis = d < lim;
          if (vis !== p.visible) {
            p.visible = vis;
            this._writeSlot(p);
            dirty.add(p.batch);
          }
        }
      }
    }

    for (const b of dirty) if (b) b.im.instanceMatrix.needsUpdate = true;
  }

  stats() {
    return { buildings: this.buildings.length, parts: this.parts.length, lost: this.destroyedCount, batches: this.batches.size };
  }

  dispose() {
    for (const b of this.batches.values()) { b.im.dispose(); b.im.material.dispose(); }
    for (const k in this.geo) this.geo[k].dispose();
    this.batches.clear();
    this.parts.length = 0;
  }
}
