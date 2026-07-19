import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { CONFIG } from '../core/config.js';
import { Assets } from '../core/assets.js';
import { makeRng, randRange } from '../core/rng.js';
import { getHeight, getSlope } from './heightfield.js';
import { decimate } from '../core/decimate.js';

// 从 glTF 模型提取（几何+材质）对，烘焙原始变换，按材质合并
function extractParts(gltf, opts = {}) {
  const { solidTris = 0, foliageTris = 0 } = opts;
  const byMat = new Map();
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse((o) => {
    if (o.isMesh) {
      const geo = o.geometry.clone();
      geo.applyMatrix4(o.matrixWorld);
      // 统一属性集，便于合并
      for (const name of Object.keys(geo.attributes)) {
        if (!['position', 'normal', 'uv'].includes(name)) geo.deleteAttribute(name);
      }
      if (!byMat.has(o.material)) byMat.set(o.material, []);
      byMat.get(o.material).push(geo);
    }
  });

  const parts = [];
  for (const [mat, geos] of byMat) {
    let geo = geos.length > 1 ? BufferGeometryUtils.mergeGeometries(geos) : geos[0];
    if (!geo) continue;
    const tris = (geo.index ? geo.index.count : geo.attributes.position.count) / 3;
    if (foliageTris > 0 && tris > foliageTris * 1.2) {
      geo = foliageReduce(geo, foliageTris);
    } else if (solidTris > 0 && tris > solidTris * 1.3) {
      geo = decimate(geo, solidTris);
    }
    parts.push({ geo, mat });
  }
  return parts;
}

// 叶片抽稀：按四边形对（连续两个三角形）随机丢弃，保持剩余叶片完整
function foliageReduce(geometry, targetTris) {
  const geo = geometry.index ? geometry.toNonIndexed() : geometry;
  const pos = geo.attributes.position;
  const srcTris = pos.count / 3;
  const keepRatio = targetTris / srcTris;
  const quads = Math.floor(srcTris / 2);

  const keptQuads = [];
  let rngState = 12345;
  const rnd = () => {
    rngState = (rngState * 1103515245 + 12345) & 0x7fffffff;
    return rngState / 0x7fffffff;
  };
  for (let q = 0; q < quads; q++) if (rnd() < keepRatio) keptQuads.push(q);

  const out = new THREE.BufferGeometry();
  for (const name of Object.keys(geo.attributes)) {
    const src = geo.attributes[name];
    const itemSize = src.itemSize;
    const arr = new Float32Array(keptQuads.length * 6 * itemSize);
    let w = 0;
    for (const q of keptQuads) {
      const start = q * 6 * itemSize;
      for (let k = 0; k < 6 * itemSize; k++) arr[w++] = src.array[start + k];
    }
    out.setAttribute(name, new THREE.BufferAttribute(arr, itemSize));
  }
  return out;
}

// 分块实例化散布器：按网格分块创建 InstancedMesh，支持视锥剔除
const CHUNKS = 5; // 5x5 分块

function scatter(scene, parts, count, rng, opts) {
  const {
    minH = CONFIG.world.beachLevel + 0.5, maxH = 32,
    maxSlope = 0.45,
    minScale = 0.8, maxScale = 1.3,
    sink = 0.05,
    castShadow = true,
    alignToGround = false,
  } = opts;

  const half = CONFIG.world.size / 2 - 15;
  const chunkSize = (half * 2) / CHUNKS;

  // 先生成位置
  const positions = [];
  let guard = 0;
  while (positions.length < count && guard++ < count * 40) {
    const x = randRange(rng, -half, half);
    const z = randRange(rng, -half, half);
    const y = getHeight(x, z);
    if (y < minH || y > maxH) continue;
    if (getSlope(x, z) > maxSlope) continue;
    positions.push({
      x, y, z,
      s: randRange(rng, minScale, maxScale),
      ry: rng() * Math.PI * 2,
      rx: alignToGround ? randRange(rng, -0.08, 0.08) : 0,
      rz: alignToGround ? randRange(rng, -0.08, 0.08) : 0,
    });
  }

  // 按块分组
  const chunkMap = new Map();
  for (const p of positions) {
    const cx = Math.min(CHUNKS - 1, Math.floor((p.x + half) / chunkSize));
    const cz = Math.min(CHUNKS - 1, Math.floor((p.z + half) / chunkSize));
    const key = cx * CHUNKS + cz;
    if (!chunkMap.has(key)) chunkMap.set(key, []);
    chunkMap.get(key).push(p);
  }

  const dummy = new THREE.Object3D();
  for (const list of chunkMap.values()) {
    for (const { geo, mat } of parts) {
      const m = new THREE.InstancedMesh(geo, mat, list.length);
      m.castShadow = castShadow;
      m.receiveShadow = true;
      for (let i = 0; i < list.length; i++) {
        const p = list[i];
        dummy.position.set(p.x, p.y - sink, p.z);
        dummy.rotation.set(p.rx, p.ry, p.rz);
        dummy.scale.setScalar(p.s);
        dummy.updateMatrix();
        m.setMatrixAt(i, dummy.matrix);
      }
      m.instanceMatrix.needsUpdate = true;
      m.computeBoundingSphere();
      scene.add(m);
    }
  }
  return positions;
}

export class Vegetation {
  constructor(scene) {
    this.scene = scene;
    const rng = makeRng(CONFIG.seed + 202);
    const V = CONFIG.vegetation;

    // 蕨类（叶片抽稀）
    const fern = extractParts(Assets.model('fern'), { foliageTris: 700 });
    for (const p of fern) { p.mat = p.mat.clone(); p.mat.side = THREE.DoubleSide; p.mat.alphaTest = Math.max(p.mat.alphaTest, 0.4); }
    scatter(scene, fern, V.ferns, rng, { minScale: 0.7, maxScale: 1.6, castShadow: false });

    // 灌木（叶片抽稀）
    const shrub = extractParts(Assets.model('shrub'), { foliageTris: 1600 });
    for (const p of shrub) { p.mat = p.mat.clone(); p.mat.side = THREE.DoubleSide; }
    scatter(scene, shrub, V.shrubs, rng, { minScale: 0.6, maxScale: 1.4, castShadow: false });

    // 草丛（叶片抽稀）
    const grass = extractParts(Assets.model('grass_tuft'), { foliageTris: 350 });
    for (const p of grass) { p.mat = p.mat.clone(); p.mat.side = THREE.DoubleSide; p.mat.alphaTest = Math.max(p.mat.alphaTest || 0, 0.35); }
    scatter(scene, grass, V.grassPatches, rng, { minScale: 0.8, maxScale: 1.7, castShadow: false, sink: 0.02 });

    // 大石
    const boulder = extractParts(Assets.model('boulder'), { solidTris: 1400 });
    scatter(scene, boulder, V.boulders, rng, {
      minH: CONFIG.world.beachLevel - 1.5, maxH: 42, maxSlope: 0.8,
      minScale: 0.4, maxScale: 2.2, sink: 0.25, alignToGround: true,
    });

    // 苔藓石组
    const moss = extractParts(Assets.model('moss_rocks'), { solidTris: 1200 });
    scatter(scene, moss, V.mossRocks, rng, {
      minScale: 0.6, maxScale: 1.5, sink: 0.12, alignToGround: true,
    });

    // 老树桩
    const stump = extractParts(Assets.model('stump'), { solidTris: 1600 });
    scatter(scene, stump, V.stumps, rng, { minScale: 0.7, maxScale: 1.3, sink: 0.1 });

    // 枯树干
    const dead = extractParts(Assets.model('dead_trunk'), { solidTris: 2200 });
    scatter(scene, dead, V.deadTrunks, rng, { minScale: 0.8, maxScale: 1.5, sink: 0.1, alignToGround: true });

    // 浆果丛（灌木染红，可交互采集）
    const berryParts = extractParts(Assets.model('shrub'), { foliageTris: 1200 }).map((p) => {
      const mat = p.mat.clone();
      mat.color = new THREE.Color(0.9, 0.52, 0.45);
      mat.side = THREE.DoubleSide;
      return { geo: p.geo, mat };
    });
    this.berryBushes = scatter(scene, berryParts, V.berryBushes, rng, {
      minScale: 0.5, maxScale: 0.9, castShadow: false,
    });
    for (const b of this.berryBushes) b.lastPicked = -999;
  }

  // 查找附近可采集的浆果丛
  findBerryBush(pos, range, gameHours) {
    for (const b of this.berryBushes) {
      const dx = b.x - pos.x, dz = b.z - pos.z;
      if (dx * dx + dz * dz < range * range && gameHours - b.lastPicked > 24) {
        return b;
      }
    }
    return null;
  }
}
