import * as THREE from 'three';
import { CONFIG } from '../core/config.js';
import { Assets } from '../core/assets.js';
import { makeRng, randRange, pick } from '../core/rng.js';
import { getHeight, getSlope } from '../world/heightfield.js';

// 世界拾取物：树枝/石头/原木/苹果 等，E 键拾取
let nextId = 1;

export class WorldItems {
  constructor(scene) {
    this.scene = scene;
    this.items = []; // {id, type, obj, x, y, z}

    // 共享几何/材质
    this.barkMat = new THREE.MeshStandardMaterial({
      map: Assets.tex('bark_col'),
      normalMap: Assets.tex('bark_nrm'),
      roughness: 1,
    });
    this.logGeo = new THREE.CylinderGeometry(0.16, 0.19, 2.2, 7);
    this.logGeo.rotateZ(Math.PI / 2);
    this.stickGeo = new THREE.CylinderGeometry(0.035, 0.05, 1.1, 5);
    this.stickGeo.rotateZ(Math.PI / 2);

    const rockParts = [];
    Assets.model('boulder').scene.traverse((o) => { if (o.isMesh) rockParts.push(o); });
    this.stoneGeo = rockParts[0].geometry;
    this.stoneMat = rockParts[0].material;
  }

  _buildVisual(type) {
    let obj;
    switch (type) {
      case 'log': {
        obj = new THREE.Mesh(this.logGeo, this.barkMat);
        break;
      }
      case 'stick': {
        obj = new THREE.Mesh(this.stickGeo, this.barkMat);
        break;
      }
      case 'stone': {
        obj = new THREE.Mesh(this.stoneGeo, this.stoneMat);
        obj.scale.setScalar(0.14);
        break;
      }
      case 'apple': {
        obj = Assets.cloneModelScene('apple');
        obj.scale.setScalar(1.4);
        break;
      }
      case 'medkit': {
        obj = Assets.cloneModelScene('medkit');
        break;
      }
      case 'machete': {
        obj = Assets.cloneModelScene('machete');
        obj.rotation.z = Math.PI / 2.3;
        break;
      }
      default:
        obj = new THREE.Mesh(this.stickGeo, this.barkMat);
    }
    obj.traverse ? obj.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }) : null;
    return obj;
  }

  spawn(type, x, z, { y = null, rotY = null } = {}) {
    const obj = this._buildVisual(type);
    const gy = y !== null ? y : getHeight(x, z);
    obj.position.set(x, gy + 0.08, z);
    obj.rotation.y = rotY !== null ? rotY : Math.random() * Math.PI * 2;
    this.scene.add(obj);
    const item = { id: nextId++, type, obj, x, y: gy, z };
    this.items.push(item);
    return item;
  }

  // 初始世界散布
  scatterInitial() {
    const rng = makeRng(CONFIG.seed + 303);
    const half = CONFIG.world.size / 2 - 20;
    const put = (type, count, minH, maxH) => {
      let placed = 0, guard = 0;
      while (placed < count && guard++ < count * 40) {
        const x = randRange(rng, -half, half);
        const z = randRange(rng, -half, half);
        const y = getHeight(x, z);
        if (y < minH || y > maxH || getSlope(x, z) > 0.4) continue;
        this.spawn(type, x, z, { y });
        placed++;
      }
    };
    put('stick', 130, CONFIG.world.beachLevel + 0.5, 28);
    put('stone', 90, CONFIG.world.beachLevel - 0.5, 30);
  }

  findNearest(pos, range, types = null) {
    let best = null, bestD = range * range;
    for (const it of this.items) {
      if (types && !types.includes(it.type)) continue;
      const dx = it.x - pos.x, dy = it.y - pos.y, dz = it.z - pos.z;
      const d = dx * dx + dy * dy * 0.5 + dz * dz;
      if (d < bestD) { bestD = d; best = it; }
    }
    return best;
  }

  removeItem(item) {
    const i = this.items.indexOf(item);
    if (i >= 0) {
      this.items.splice(i, 1);
      this.scene.remove(item.obj);
    }
  }

  // 树倒后掉落原木
  dropLogsAt(x, z, count) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 1 + Math.random() * 2.5;
      const lx = x + Math.cos(a) * r;
      const lz = z + Math.sin(a) * r;
      this.spawn('log', lx, lz);
    }
  }
}
