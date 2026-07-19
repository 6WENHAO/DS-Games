import * as THREE from 'three';
import { Assets } from '../core/assets.js';
import { getHeight } from '../world/heightfield.js';
import { Campfire } from '../entities/fire.js';
import { BUILDINGS } from './items.js';
import { Audio } from '../core/audio.js';

// 建造系统：蓝图幽灵预览 -> 放置 -> 实体结构（含碰撞）
let matBark = null, matLeaf = null, matPlanks = null;

function ensureMats() {
  if (matBark) return;
  matBark = new THREE.MeshStandardMaterial({
    map: Assets.tex('bark_col'), normalMap: Assets.tex('bark_nrm'), roughness: 1,
  });
  matPlanks = new THREE.MeshStandardMaterial({
    map: Assets.tex('planks_col'), normalMap: Assets.tex('planks_nrm'), roughness: 0.9,
  });
  matLeaf = new THREE.MeshStandardMaterial({
    map: Assets.tex('leaf_col'), alphaMap: Assets.tex('leaf_opa'), alphaTest: 0.3,
    side: THREE.DoubleSide, roughness: 1,
  });
}

function logMesh(r1, r2, len, horizontal = false) {
  const geo = new THREE.CylinderGeometry(r1, r2, len, 7);
  if (horizontal) geo.rotateZ(Math.PI / 2);
  const m = new THREE.Mesh(geo, matBark);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

// ---- 各类建筑网格 ----
function buildCampfireMesh() {
  const g = new THREE.Group();
  const pit = Assets.cloneModelScene('fire_pit');
  if (pit) g.add(pit);
  return g;
}

function buildShelterMesh() {
  ensureMats();
  const g = new THREE.Group();
  // 两根立柱 + 横梁
  const postL = logMesh(0.09, 0.11, 1.8); postL.position.set(-1.2, 0.9, 0);
  const postR = logMesh(0.09, 0.11, 1.8); postR.position.set(1.2, 0.9, 0);
  const ridge = logMesh(0.08, 0.08, 2.6, true); ridge.position.set(0, 1.75, 0);
  g.add(postL, postR, ridge);
  // 斜靠原木排
  for (let i = 0; i < 7; i++) {
    const lean = logMesh(0.06, 0.08, 2.6);
    lean.position.set(-1.15 + i * 0.38, 0.82, 0.8);
    lean.rotation.x = -0.72;
    g.add(lean);
  }
  // 树叶铺盖
  const roof = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 2.6), matLeaf);
  roof.position.set(0, 0.95, 0.85);
  roof.rotation.x = -0.72 - Math.PI / 2;
  roof.castShadow = true;
  g.add(roof);
  const roof2 = roof.clone();
  roof2.position.z += 0.12; roof2.position.y += 0.06;
  roof2.rotation.z = 0.15;
  g.add(roof2);
  // 铺地
  const bed = Assets.cloneModelScene('k_bedroll');
  if (bed) { bed.position.set(0, 0.05, 0.35); bed.scale.setScalar(1.1); g.add(bed); }
  return g;
}

function buildWallMesh() {
  ensureMats();
  const g = new THREE.Group();
  // 两端立柱
  const postL = logMesh(0.1, 0.12, 2.4); postL.position.set(-1.5, 1.2, 0);
  const postR = logMesh(0.1, 0.12, 2.4); postR.position.set(1.5, 1.2, 0);
  g.add(postL, postR);
  // 横向原木堆叠
  for (let i = 0; i < 6; i++) {
    const l = logMesh(0.14, 0.16, 3.0, true);
    l.position.set(0, 0.18 + i * 0.34, (i % 2) * 0.05);
    l.rotation.y = (i % 2) * 0.02;
    g.add(l);
  }
  return g;
}

function buildRackMesh() {
  ensureMats();
  const g = new THREE.Group();
  const p1 = logMesh(0.05, 0.06, 1.6); p1.position.set(-0.8, 0.8, 0);
  const p2 = logMesh(0.05, 0.06, 1.6); p2.position.set(0.8, 0.8, 0);
  const bar = logMesh(0.04, 0.04, 1.8, true); bar.position.set(0, 1.45, 0);
  const bar2 = logMesh(0.04, 0.04, 1.8, true); bar2.position.set(0, 1.0, 0);
  g.add(p1, p2, bar, bar2);
  return g;
}

const BUILDERS = {
  campfire: buildCampfireMesh,
  shelter: buildShelterMesh,
  wall: buildWallMesh,
  rack: buildRackMesh,
};

// 碰撞体（OBB 近似）：半宽/半深；campfire/rack 无碰撞
const COLLIDERS = {
  shelter: { hw: 1.4, hd: 1.2 },
  wall: { hw: 1.6, hd: 0.25 },
};

export class BuildingSystem {
  constructor(scene) {
    ensureMats();
    this.scene = scene;
    this.structures = []; // {type,x,y,z,rotY,obj,fire?}
    this.blueprint = null; // {type, obj, rotY, valid}
  }

  setBlueprint(type) {
    this.clearBlueprint();
    if (!type) return;
    const obj = BUILDERS[type]();
    obj.traverse((o) => {
      if (o.isMesh) {
        o.material = o.material.clone();
        o.material.transparent = true;
        o.material.opacity = 0.55;
        o.castShadow = false;
      }
    });
    this.scene.add(obj);
    this.blueprint = { type, obj, rotY: 0 };
  }

  clearBlueprint() {
    if (this.blueprint) {
      this.scene.remove(this.blueprint.obj);
      this.blueprint = null;
    }
  }

  rotateBlueprint() {
    if (this.blueprint) this.blueprint.rotY += Math.PI / 8;
  }

  // 将蓝图放在玩家前方地面
  updateBlueprint(playerPos, forward) {
    if (!this.blueprint) return;
    const dist = 3.6;
    const x = playerPos.x + forward.x * dist;
    const z = playerPos.z + forward.z * dist;
    const y = getHeight(x, z);
    this.blueprint.obj.position.set(x, y, z);
    this.blueprint.obj.rotation.y = this.blueprint.rotY;
    // 是否可放置（水上不可）
    this.blueprint.valid = y > 0.6;
    this.blueprint.obj.traverse((o) => {
      if (o.isMesh) o.material.color.setHex(this.blueprint.valid ? 0xffffff : 0xff4433);
    });
  }

  place(inventory) {
    if (!this.blueprint || !this.blueprint.valid) return false;
    const def = BUILDINGS.find((b) => b.id === this.blueprint.type);
    if (!inventory.pay(def.cost)) return false;
    const { type, rotY } = this.blueprint;
    const p = this.blueprint.obj.position.clone();
    this.clearBlueprint();
    this._create(type, p.x, p.y, p.z, rotY);
    Audio.play('impact_wood_2', { volume: 0.9 });
    return true;
  }

  _create(type, x, y, z, rotY) {
    let obj, fire = null;
    if (type === 'campfire') {
      fire = new Campfire(this.scene, x, y, z);
      obj = fire.group;
    } else {
      obj = BUILDERS[type]();
      obj.position.set(x, y, z);
      obj.rotation.y = rotY;
      this.scene.add(obj);
    }
    this.structures.push({ type, x, y, z, rotY, obj, fire });
  }

  update(dt) {
    for (const s of this.structures) {
      if (s.fire) s.fire.update(dt);
    }
  }

  findNear(pos, range, type) {
    for (const s of this.structures) {
      if (type && s.type !== type) continue;
      const dx = s.x - pos.x, dz = s.z - pos.z;
      if (dx * dx + dz * dz < range * range) return s;
    }
    return null;
  }

  // 圆形（玩家/敌人）与建筑碰撞推挤
  collide(pos, radius) {
    for (const s of this.structures) {
      const c = COLLIDERS[s.type];
      if (!c) continue;
      // 转到建筑本地坐标
      const cos = Math.cos(-s.rotY), sin = Math.sin(-s.rotY);
      const dx = pos.x - s.x, dz = pos.z - s.z;
      const lx = dx * cos - dz * sin;
      const lz = dx * sin + dz * cos;
      const px = Math.max(-c.hw, Math.min(c.hw, lx));
      const pz = Math.max(-c.hd, Math.min(c.hd, lz));
      const ddx = lx - px, ddz = lz - pz;
      const d2 = ddx * ddx + ddz * ddz;
      if (d2 < radius * radius && pos.y < s.y + 2.4) {
        const d = Math.sqrt(d2) || 0.001;
        const push = (radius - d) / d;
        // 回到世界坐标
        const wx = ddx * Math.cos(s.rotY) - ddz * Math.sin(s.rotY);
        const wz = ddx * Math.sin(s.rotY) + ddz * Math.cos(s.rotY);
        pos.x += wx * push;
        pos.z += wz * push;
      }
    }
  }

  serialize() {
    return this.structures.map((s) => ({ type: s.type, x: s.x, y: s.y, z: s.z, rotY: s.rotY }));
  }

  deserialize(list) {
    for (const s of this.structures) {
      if (s.fire) s.fire.dispose();
      else this.scene.remove(s.obj);
    }
    this.structures = [];
    for (const s of list || []) this._create(s.type, s.x, s.y, s.z, s.rotY);
  }
}
