import * as THREE from 'three';
import { CONFIG } from '../core/config.js';
import { Assets } from '../core/assets.js';
import { makeRng, randRange } from '../core/rng.js';
import { getHeight, getSlope } from './heightfield.js';

// 坠机营地：出生点周围的行李箱（可搜刮）、板条箱、医疗箱、砍刀
export class CrashSite {
  constructor(scene, worldItems) {
    this.scene = scene;
    const rng = makeRng(CONFIG.seed + 404);

    // 寻找海滩出生点：沿多个方向寻找合适的平缓海滩
    this.spawnPoint = this._findSpawn(rng);
    const { x: sx, z: sz } = this.spawnPoint;

    this.lootables = []; // {obj, x,z, looted, loot:[{id,n}], label}

    const place = (key, dx, dz, scale = 1, rotY = null) => {
      const obj = Assets.cloneModelScene(key, { receiveShadow: true });
      const x = sx + dx, z = sz + dz;
      obj.position.set(x, getHeight(x, z), z);
      obj.rotation.y = rotY !== null ? rotY : rng() * Math.PI * 2;
      obj.scale.setScalar(scale);
      scene.add(obj);
      return obj;
    };

    // 行李箱 ×3（可搜刮）
    const suitcaseLoot = [
      [{ id: 'cloth', n: 2 }, { id: 'apple', n: 2 }],
      [{ id: 'cloth', n: 3 }],
      [{ id: 'cloth', n: 1 }, { id: 'apple', n: 1 }, { id: 'bandage', n: 1 }],
    ];
    for (let i = 0; i < 3; i++) {
      const dx = randRange(rng, -6, 6), dz = randRange(rng, -6, 6);
      const obj = place('suitcase', dx, dz, 1.15);
      this.lootables.push({
        obj, x: sx + dx, z: sz + dz, looted: false,
        loot: suitcaseLoot[i], label: '搜刮行李箱',
      });
    }

    // 军用板条箱 ×2（可搜刮）
    for (let i = 0; i < 2; i++) {
      const dx = randRange(rng, -8, 8), dz = randRange(rng, 4, 10);
      const obj = place('crate', dx, dz, 1);
      this.lootables.push({
        obj, x: sx + dx, z: sz + dz, looted: false,
        loot: [{ id: 'cloth', n: 1 }, { id: 'stick', n: 3 }], label: '搜刮板条箱',
      });
    }

    // 可拾取：医疗箱 / 砍刀 / 苹果
    worldItems.spawn('medkit', sx + randRange(rng, -4, 4), sz + randRange(rng, -4, -2));
    worldItems.spawn('machete', sx + randRange(rng, 2, 5), sz + randRange(rng, 2, 5));
    for (let i = 0; i < 3; i++) {
      worldItems.spawn('apple', sx + randRange(rng, -7, 7), sz + randRange(rng, -7, 7));
    }

    // 装饰：石头火坑（未点燃的痕迹）
    place('fire_pit', 0, -3, 1);
  }

  _findSpawn(rng) {
    const half = CONFIG.world.size / 2;
    for (let attempt = 0; attempt < 400; attempt++) {
      const a = rng() * Math.PI * 2;
      const r = randRange(rng, half * 0.55, half * 0.92);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const y = getHeight(x, z);
      if (y > 1.0 && y < 2.4 && getSlope(x, z) < 0.25) {
        return { x, y, z };
      }
    }
    return { x: 0, y: getHeight(0, 0), z: half * 0.6 };
  }

  findLootable(pos, range) {
    for (const l of this.lootables) {
      if (l.looted) continue;
      const dx = l.x - pos.x, dz = l.z - pos.z;
      if (dx * dx + dz * dz < range * range) return l;
    }
    return null;
  }
}
