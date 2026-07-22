import * as THREE from 'three';
import { makeRNG, segmentBoxIntersect } from '../core/utils.js';
import { prepareModel } from './materials.js';

/**
 * 地图布局 & 静态物件（建筑/树木/掩体） & 碰撞/视线查询
 */

export function createLayout() {
  return {
    seed: 20260718,
    worldSize: 1400,
    playableHalf: 620,
    roads: [
      // 南北主路（穿过村庄）
      [[0, 620], [8, 420], [-14, 240], [-6, 90], [0, 0], [6, -110], [-4, -260], [10, -430], [0, -620]],
      // 东西路
      [[-620, 30], [-430, 18], [-260, 26], [-90, 6], [0, 0], [130, -12], [300, 8], [470, -6], [620, 0]],
      // 通往农场的岔路
      [[130, -12], [210, -90], [300, -170], [390, -210]],
    ],
    flatAreas: [
      { x: 0, z: 0, r: 120 },          // 村庄中心
      { x: 350, z: -230, r: 90 },      // 农场
      { x: 0, z: 540, r: 80 },         // A 出生点
      { x: 0, z: -540, r: 80 },        // B 出生点
      { x: -380, z: -300, r: 70 },     // 西北高地缓坡
    ],
    dirtPatches: [
      { x: 0, z: 0, r: 60 },
      { x: 350, z: -230, r: 55 },
      { x: 0, z: 540, r: 55 },
      { x: 0, z: -540, r: 55 },
    ],
    cap: { x: 0, z: 0, r: 30 },
    spawns: {
      A: [[-40, 545], [40, 550], [0, 585], [-80, 570], [80, 575]],
      B: [[40, -545], [-40, -550], [0, -585], [80, -570], [-80, -575]],
    },
  };
}

const TARGET_SIZE = {
  pine_a: { h: 14 }, pine_b: { h: 13 }, pine_c: { h: 15 },
  rock_b: { h: 2.2 }, rock_large: { h: 3.4 }, rocks_a: { h: 1.1 },
  bush: { h: 1.5 }, hedge: { h: 1.6 },
  barrel_a: { h: 1.1 }, barrel_explode: { h: 1.1 },
  sack_trench: { h: 1.2 }, bags: { h: 1.0 },
  guard_tower: { h: 10 }, watch_tower: { h: 9 },
  barn: { h: 7.5 }, big_barn: { h: 9 }, windmill: { h: 17 },
  fence_a: { h: 1.3 }, wooden_wall: { h: 1.6 },
  house_a: { h: 6 }, house_b: { h: 6.5 }, house_long: { h: 6 }, big_building: { h: 11 },
  wreck_tank: { h: 2.6 },
};

export class World {
  constructor(scene, assets, terrain, layout) {
    this.scene = scene;
    this.assets = assets;
    this.terrain = terrain;
    this.layout = layout;
    this.group = new THREE.Group();
    this.group.name = 'world-props';
    scene.add(this.group);

    this.solidBoxes = [];   // {box, blockShell, name, mesh}
    this.treeCircles = [];  // {x,z,r}
    this.crushables = [];   // {object,x,z,r,alive,kind}
    this.rng = makeRNG(layout.seed + 7);

    this._protoCache = {};
    this._build();
  }

  /* ------------ 模型实例化 ------------ */
  _proto(key) {
    if (this._protoCache[key]) return this._protoCache[key];
    const src = this.assets.models[key].scene;
    const target = TARGET_SIZE[key] || { h: 3 };
    const box = new THREE.Box3().setFromObject(src);
    const size = box.getSize(new THREE.Vector3());
    const scale = target.h / (size.y || 1);
    this._protoCache[key] = { src, scale, size };
    return this._protoCache[key];
  }

  place(key, x, z, { rotY = 0, scaleMul = 1, collide = 'box', blockShell = true, crush = null, sink = 0 } = {}) {
    const proto = this._proto(key);
    const obj = proto.src.clone(true);
    const s = proto.scale * scaleMul;
    obj.scale.setScalar(s);
    obj.rotation.y = rotY;
    const y = this.terrain.heightAt(x, z) - sink;
    obj.position.set(x, y, z);
    prepareModel(obj, { detailScale: 0.5, strength: 0.3 });
    this.group.add(obj);
    obj.updateMatrixWorld(true);

    const bbox = new THREE.Box3().setFromObject(obj);
    if (crush) {
      const r = Math.max(bbox.max.x - bbox.min.x, bbox.max.z - bbox.min.z) * 0.5;
      this.crushables.push({
        object: obj, x, z, r: Math.min(r, 2.6), alive: true, kind: crush,
        explosive: key === 'barrel_explode',
      });
    } else if (collide === 'box') {
      bbox.min.y -= 2;
      this.solidBoxes.push({ box: bbox, blockShell, name: key, mesh: obj });
    } else if (collide === 'tree') {
      this.treeCircles.push({ x, z, r: 0.9 * scaleMul });
    } else if (collide === 'circle') {
      const r = Math.max(bbox.max.x - bbox.min.x, bbox.max.z - bbox.min.z) * 0.42;
      this.treeCircles.push({ x, z, r });
    }
    return obj;
  }

  _clearOf(x, z, list, minDist) {
    for (const p of list) {
      if (Math.hypot(x - p.x, z - p.z) < minDist) return false;
    }
    return true;
  }

  _build() {
    const L = this.layout;
    const rng = this.rng;
    const placedSites = [];

    const site = (x, z) => { placedSites.push({ x, z }); };

    /* --- 村庄（中央据点） --- */
    const village = [
      ['house_a', -34, 26, Math.PI / 2],
      ['house_b', 30, 34, Math.PI],
      ['house_long', -40, -30, 0],
      ['house_a', 38, -32, -Math.PI / 2],
      ['big_building', -78, 52, Math.PI / 2],
      ['house_b', 66, 66, Math.PI],
      ['barn', 80, -70, Math.PI / 4],
    ];
    for (const [k, x, z, r] of village) { this.place(k, x, z, { rotY: r }); site(x, z); }

    // 据点掩体
    this.place('sack_trench', 0, 18, { rotY: 0, crush: null, collide: 'box', blockShell: true });
    this.place('sack_trench', 16, -14, { rotY: Math.PI / 2 });
    this.place('sack_trench', -18, -10, { rotY: -Math.PI / 3 });
    for (let i = 0; i < 7; i++) {
      const a = rng() * Math.PI * 2;
      const d = 20 + rng() * 26;
      this.place(rng() < 0.6 ? 'barrel_a' : 'barrel_explode', Math.cos(a) * d, Math.sin(a) * d, { crush: 'barrel', rotY: rng() * 6.28 });
    }
    // 村庄围栏
    for (let i = -3; i <= 3; i++) {
      this.place('fence_a', i * 5.2, 96, { crush: 'fence', rotY: 0 });
      this.place('fence_a', i * 5.2, -96, { crush: 'fence', rotY: 0 });
    }

    /* --- 农场 --- */
    this.place('big_barn', 350, -258, { rotY: Math.PI / 6 }); site(350, -258);
    this.place('barn', 396, -196, { rotY: -Math.PI / 2 }); site(396, -196);
    this.place('windmill', 300, -280, { rotY: 0 }); site(300, -280);
    for (let i = 0; i < 6; i++) {
      this.place('fence_a', 320 + i * 5.2, -160, { crush: 'fence' });
    }
    for (let i = 0; i < 5; i++) {
      const a = rng() * 6.28, d = 12 + rng() * 30;
      this.place('bags', 350 + Math.cos(a) * d, -230 + Math.sin(a) * d, { crush: 'bags', rotY: rng() * 6.28 });
    }

    /* --- 西北高地哨塔 --- */
    this.place('guard_tower', -380, -300, {}); site(-380, -300);
    this.place('rock_large', -352, -282, { rotY: 1.2 });
    this.place('rock_large', -404, -330, { rotY: 2.6, scaleMul: 1.4 });

    /* --- 出生点瞭望塔 --- */
    this.place('watch_tower', -60, 520, { rotY: Math.PI }); site(-60, 520);
    this.place('watch_tower', 60, -520, { rotY: 0 }); site(60, -520);

    /* --- 战场残骸（中线掩体） --- */
    this.place('wreck_tank', -120, -60, { rotY: 0.7 }); site(-120, -60);
    this.place('wreck_tank', 150, 90, { rotY: -1.9, scaleMul: 1.05 }); site(150, 90);
    this.place('rock_large', -200, 150, { rotY: 0.5, scaleMul: 1.5 });
    this.place('rock_large', 210, -160, { rotY: 2.2, scaleMul: 1.3 });

    /* --- 森林群落 --- */
    const forests = [
      { x: -320, z: 180, r: 110, n: 16 },
      { x: 300, z: 260, r: 100, n: 14 },
      { x: -260, z: -420, r: 100, n: 13 },
      { x: 420, z: 40, r: 90, n: 12 },
      { x: -460, z: -60, r: 90, n: 12 },
      { x: 160, z: -420, r: 90, n: 11 },
      { x: -140, z: 400, r: 90, n: 10 },
      { x: 180, z: 420, r: 80, n: 9 },
    ];
    const pines = ['pine_a', 'pine_b', 'pine_c'];
    for (const f of forests) {
      for (let i = 0; i < f.n; i++) {
        const a = rng() * Math.PI * 2;
        const d = Math.sqrt(rng()) * f.r;
        const x = f.x + Math.cos(a) * d;
        const z = f.z + Math.sin(a) * d;
        if (this.terrain.roadMaskAt(x, z)) continue;
        if (!this._clearOf(x, z, placedSites, 26)) continue;
        if (Math.hypot(x - L.cap.x, z - L.cap.z) < 70) continue;
        const key = pines[(rng() * pines.length) | 0];
        this.place(key, x, z, { rotY: rng() * 6.28, scaleMul: 0.85 + rng() * 0.45, collide: 'tree' });
      }
      // 林间灌木
      for (let i = 0; i < 5; i++) {
        const a = rng() * Math.PI * 2;
        const d = Math.sqrt(rng()) * f.r * 1.1;
        const x = f.x + Math.cos(a) * d, z = f.z + Math.sin(a) * d;
        if (this.terrain.roadMaskAt(x, z)) continue;
        this.place(rng() < 0.5 ? 'bush' : 'hedge', x, z, { crush: 'bush', rotY: rng() * 6.28, scaleMul: 0.9 + rng() * 0.5 });
      }
    }

    /* --- 零散岩石与灌木 --- */
    for (let i = 0; i < 40; i++) {
      const x = (rng() * 2 - 1) * 580;
      const z = (rng() * 2 - 1) * 580;
      if (this.terrain.roadMaskAt(x, z)) continue;
      if (!this._clearOf(x, z, placedSites, 30)) continue;
      if (Math.hypot(x, z) < 120) continue;
      const pick = rng();
      if (pick < 0.4) this.place('rock_b', x, z, { rotY: rng() * 6.28, scaleMul: 0.8 + rng() * 1.2, collide: 'circle' });
      else if (pick < 0.75) this.place('bush', x, z, { crush: 'bush', rotY: rng() * 6.28 });
      else this.place('rocks_a', x, z, { rotY: rng() * 6.28, scaleMul: 1.2, collide: 'none' });
    }
  }

  /* ------------ 查询接口 ------------ */

  /** 射线检测（地形+建筑），返回 {point,dist,type} 或 null */
  raycast(origin, dir, maxDist = 3000) {
    let best = null;
    const g = this.terrain.raycast(origin, dir, maxDist);
    if (g) best = { point: g.point, dist: g.dist, type: 'terrain' };

    const end = origin.clone().addScaledVector(dir, best ? best.dist : maxDist);
    const tmp = new THREE.Vector3();
    for (const sb of this.solidBoxes) {
      if (!sb.blockShell) continue;
      const t = segmentBoxIntersect(origin, end, sb.box, tmp);
      if (t !== null) {
        const d = t * origin.distanceTo(end);
        if (!best || d < best.dist) {
          best = { point: tmp.clone(), dist: d, type: 'building', name: sb.name };
        }
      }
    }
    return best;
  }

  /** 两点间视线是否通畅（用于AI/标记/穿透判断） */
  lineOfSight(a, b) {
    const dir = new THREE.Vector3().subVectors(b, a);
    const dist = dir.length();
    if (dist < 1) return true;
    dir.divideScalar(dist);
    // 地形采样
    const steps = Math.ceil(dist / 18);
    const p = new THREE.Vector3();
    for (let i = 1; i < steps; i++) {
      const t = (i / steps) * dist;
      p.copy(a).addScaledVector(dir, t);
      if (this.terrain.heightAt(p.x, p.z) > p.y + 0.4) return false;
    }
    // 建筑
    const tmp = new THREE.Vector3();
    for (const sb of this.solidBoxes) {
      if (!sb.blockShell) continue;
      if (segmentBoxIntersect(a, b, sb.box, tmp) !== null) return false;
    }
    return true;
  }

  /** 坦克碰撞解算：返回修正后的位置 */
  resolveTankCollision(tank, pos, radius, onCrush) {
    // 建筑盒
    for (const sb of this.solidBoxes) {
      const b = sb.box;
      if (pos.y > b.max.y) continue;
      const cx = Math.max(b.min.x, Math.min(pos.x, b.max.x));
      const cz = Math.max(b.min.z, Math.min(pos.z, b.max.z));
      const dx = pos.x - cx, dz = pos.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < radius * radius) {
        if (d2 > 1e-6) {
          const d = Math.sqrt(d2);
          pos.x = cx + (dx / d) * radius;
          pos.z = cz + (dz / d) * radius;
        } else {
          // 在盒内：往最近边推出
          const pushx1 = b.max.x - pos.x + radius, pushx2 = pos.x - b.min.x + radius;
          const pushz1 = b.max.z - pos.z + radius, pushz2 = pos.z - b.min.z + radius;
          const m = Math.min(pushx1, pushx2, pushz1, pushz2);
          if (m === pushx1) pos.x = b.max.x + radius;
          else if (m === pushx2) pos.x = b.min.x - radius;
          else if (m === pushz1) pos.z = b.max.z + radius;
          else pos.z = b.min.z - radius;
        }
      }
    }
    // 树木
    for (const c of this.treeCircles) {
      const dx = pos.x - c.x, dz = pos.z - c.z;
      const rr = radius + c.r;
      const d2 = dx * dx + dz * dz;
      if (d2 < rr * rr && d2 > 1e-6) {
        const d = Math.sqrt(d2);
        pos.x = c.x + (dx / d) * rr;
        pos.z = c.z + (dz / d) * rr;
      }
    }
    // 可碾压物
    for (const c of this.crushables) {
      if (!c.alive) continue;
      const dx = pos.x - c.x, dz = pos.z - c.z;
      const rr = radius + c.r;
      if (dx * dx + dz * dz < rr * rr) {
        c.alive = false;
        c.object.visible = false;
        if (onCrush) onCrush(c);
      }
    }
    return pos;
  }
}
