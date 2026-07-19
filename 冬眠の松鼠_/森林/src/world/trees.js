import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { CONFIG } from '../core/config.js';
import { Assets } from '../core/assets.js';
import { makeRng, randRange } from '../core/rng.js';
import { getHeight, getSlope, isInIsland } from './heightfield.js';
import { Audio } from '../core/audio.js';

// 程序化树木：树干（树皮 PBR）+ 树冠（树叶图集交叉面片），实例化渲染
// 支持砍伐：树干实例射线检测 -> 掉落原木 -> 留下树桩 -> 若干天后重生
export class TreeSystem {
  constructor(scene) {
    this.scene = scene;
    this.trees = [];        // {x,y,z, scale, rotY, type, hp, alive, felledDay}
    this.fallingTrees = []; // 动画中
    this.dummy = new THREE.Object3D();

    const rng = makeRng(CONFIG.seed + 101);

    // ---- 材质 ----
    this.barkMat = new THREE.MeshStandardMaterial({
      map: Assets.tex('bark_col'),
      normalMap: Assets.tex('bark_nrm'),
      roughnessMap: Assets.tex('bark_rgh'),
      roughness: 1,
    });
    this.leafMat = new THREE.MeshStandardMaterial({
      map: Assets.tex('leaf_col'),
      alphaMap: Assets.tex('leaf_opa'),
      normalMap: Assets.tex('leaf_nrm'),
      alphaTest: 0.35,
      side: THREE.DoubleSide,
      roughness: 0.9,
    });

    // ---- 几何模板 ----
    this.trunkGeo = this._makeTrunkGeo();
    this.canopyGeo = this._makeCanopyGeo(rng);

    // ---- 放置 ----
    const count = CONFIG.trees.count;
    let placed = 0, guard = 0;
    while (placed < count && guard++ < count * 30) {
      const x = randRange(rng, -CONFIG.world.size / 2 + 20, CONFIG.world.size / 2 - 20);
      const z = randRange(rng, -CONFIG.world.size / 2 + 20, CONFIG.world.size / 2 - 20);
      const y = getHeight(x, z);
      if (y < CONFIG.world.beachLevel + 0.8 || y > 30) continue;
      if (getSlope(x, z) > 0.42) continue;
      this.trees.push({
        x, y, z,
        scale: randRange(rng, 0.75, 1.45),
        rotY: rng() * Math.PI * 2,
        hp: CONFIG.trees.chopHp,
        alive: true,
        felledDay: -99,
      });
      placed++;
    }

    // ---- 实例化网格 ----
    this.trunkMesh = new THREE.InstancedMesh(this.trunkGeo, this.barkMat, this.trees.length);
    this.canopyMesh = new THREE.InstancedMesh(this.canopyGeo, this.leafMat, this.trees.length);
    this.trunkMesh.castShadow = true;
    this.trunkMesh.receiveShadow = true;
    this.canopyMesh.castShadow = true;
    this.trunkMesh.name = 'trees';

    const color = new THREE.Color();
    for (let i = 0; i < this.trees.length; i++) {
      this._applyTransform(i);
      // 树冠颜色变化
      color.setHSL(0.28 + rng() * 0.08, 0.5 + rng() * 0.2, 0.38 + rng() * 0.15);
      this.canopyMesh.setColorAt(i, color);
    }
    this.canopyMesh.instanceColor.needsUpdate = true;

    scene.add(this.trunkMesh);
    scene.add(this.canopyMesh);

    // 树桩(被砍后)
    this.stumpGeo = new THREE.CylinderGeometry(0.32, 0.42, 0.7, 8);
    this.stumpGeo.translate(0, 0.35, 0);
    this.stumps = new Map(); // treeIndex -> mesh

    this.raycaster = new THREE.Raycaster();
  }

  _makeTrunkGeo() {
    const geo = new THREE.CylinderGeometry(0.22, 0.42, 9, 8, 3);
    geo.translate(0, 4.5, 0);
    // 树皮 UV 平铺
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i, uv.getX(i) * 1.6, uv.getY(i) * 4);
    }
    return geo;
  }

  _makeCanopyGeo(rng) {
    // 多层交叉面片组成的树冠
    const parts = [];
    const clusterCount = 5;
    for (let c = 0; c < clusterCount; c++) {
      const cy = 5.4 + c * 1.15 + randRange(rng, -0.3, 0.3);
      const spread = 2.6 * (1 - c / clusterCount * 0.55);
      const cx = randRange(rng, -0.7, 0.7) * (c < clusterCount - 1 ? 1 : 0.2);
      const cz = randRange(rng, -0.7, 0.7) * (c < clusterCount - 1 ? 1 : 0.2);
      const planesPerCluster = 3;
      for (let p = 0; p < planesPerCluster; p++) {
        const size = randRange(rng, 2.4, 3.6) * (spread / 2.6);
        const plane = new THREE.PlaneGeometry(size * 2, size * 1.5);
        const rx = randRange(rng, -0.5, 0.5);
        const ry = (p / planesPerCluster) * Math.PI + randRange(rng, -0.3, 0.3);
        const rz = randRange(rng, -0.5, 0.5);
        plane.rotateX(rx); plane.rotateY(ry); plane.rotateZ(rz);
        plane.translate(cx + randRange(rng, -0.4, 0.4), cy, cz + randRange(rng, -0.4, 0.4));
        parts.push(plane);
      }
    }
    return BufferGeometryUtils.mergeGeometries(parts);
  }

  _applyTransform(i) {
    const t = this.trees[i];
    const d = this.dummy;
    d.position.set(t.x, t.y - 0.15, t.z);
    d.rotation.set(0, t.rotY, 0);
    const s = t.alive ? t.scale : 0.00001;
    d.scale.set(s, s, s);
    d.updateMatrix();
    this.trunkMesh.setMatrixAt(i, d.matrix);
    this.canopyMesh.setMatrixAt(i, d.matrix);
    this.trunkMesh.instanceMatrix.needsUpdate = true;
    this.canopyMesh.instanceMatrix.needsUpdate = true;
  }

  // 射线砍树：返回 {index, point} 或 null
  raycast(raycaster, maxDist) {
    const hits = raycaster.intersectObject(this.trunkMesh, false);
    for (const h of hits) {
      if (h.distance <= maxDist && this.trees[h.instanceId]?.alive) {
        return { index: h.instanceId, point: h.point, distance: h.distance };
      }
    }
    return null;
  }

  // 砍一下，返回 'hit' | 'felled'
  chop(index, hitPoint, currentDay, power = 1) {
    const t = this.trees[index];
    if (!t || !t.alive) return null;
    t.hp -= power;
    Audio.playAt('chop', hitPoint, { volume: 1.0, maxDist: 60 });
    if (t.hp <= 0) {
      t.alive = false;
      t.felledDay = currentDay;
      this._applyTransform(index);
      this._spawnStump(index);
      this._startFall(index);
      return 'felled';
    }
    return 'hit';
  }

  _spawnStump(index) {
    const t = this.trees[index];
    const stump = new THREE.Mesh(this.stumpGeo, this.barkMat);
    stump.position.set(t.x, t.y - 0.1, t.z);
    stump.scale.setScalar(t.scale);
    stump.castShadow = true;
    stump.receiveShadow = true;
    this.scene.add(stump);
    this.stumps.set(index, stump);
  }

  _startFall(index) {
    const t = this.trees[index];
    const group = new THREE.Group();
    const trunk = new THREE.Mesh(this.trunkGeo, this.barkMat);
    const canopy = new THREE.Mesh(this.canopyGeo, this.leafMat);
    trunk.castShadow = true;
    canopy.castShadow = true;
    group.add(trunk); group.add(canopy);
    group.position.set(t.x, t.y - 0.15, t.z);
    group.scale.setScalar(t.scale);
    group.rotation.y = t.rotY;
    this.scene.add(group);

    const dir = Math.random() * Math.PI * 2;
    this.fallingTrees.push({
      group, index,
      axis: new THREE.Vector3(Math.cos(dir), 0, Math.sin(dir)),
      angle: 0,
      speed: 0.15,
      done: false,
    });
  }

  // 每帧更新倒树动画；返回本帧倒地的树（供掉落原木）
  update(dt, currentDay, playerPos) {
    const landed = [];
    for (const f of this.fallingTrees) {
      if (f.done) continue;
      f.speed += dt * 1.6; // 加速倒下
      f.angle += f.speed * dt * 60 * 0.016;
      if (f.angle >= Math.PI / 2 - 0.06) {
        f.angle = Math.PI / 2 - 0.06;
        f.done = true;
        const t = this.trees[f.index];
        Audio.playAt('impact_wood', t, { volume: 1.0, maxDist: 80 });
        landed.push(f);
        // 落地后短暂保留再淡出
        setTimeout(() => { this.scene.remove(f.group); }, 1200);
      }
      f.group.setRotationFromAxisAngle(f.axis, f.angle);
      f.group.rotateY(this.trees[f.index].rotY);
    }
    this.fallingTrees = this.fallingTrees.filter((f) => !f.done || f.group.parent);

    // 树木重生（隔天且玩家不在附近）
    if (this._lastDay !== currentDay) {
      this._lastDay = currentDay;
      for (let i = 0; i < this.trees.length; i++) {
        const t = this.trees[i];
        if (!t.alive && currentDay - t.felledDay >= CONFIG.trees.respawnDays) {
          const dx = t.x - playerPos.x, dz = t.z - playerPos.z;
          if (dx * dx + dz * dz > 60 * 60) {
            t.alive = true;
            t.hp = CONFIG.trees.chopHp;
            this._applyTransform(i);
            const stump = this.stumps.get(i);
            if (stump) { this.scene.remove(stump); this.stumps.delete(i); }
          }
        }
      }
    }
    return landed;
  }

  // 序列化（存档）
  serialize() {
    return this.trees.map((t) => (t.alive ? 1 : 0)).join('');
  }

  deserialize(str, currentDay) {
    if (!str || str.length !== this.trees.length) return;
    for (let i = 0; i < this.trees.length; i++) {
      const alive = str[i] === '1';
      if (this.trees[i].alive !== alive) {
        this.trees[i].alive = alive;
        if (!alive) {
          this.trees[i].felledDay = currentDay;
          this._spawnStump(i);
        }
        this._applyTransform(i);
      }
    }
  }
}
