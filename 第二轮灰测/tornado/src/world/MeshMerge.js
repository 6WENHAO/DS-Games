/**
 * MeshMerge.js — 把一个多网格对象压成 1~2 个网格。
 *
 * 做法：材质颜色烘进顶点色，只按 matte / metal 两桶各用一个共享材质。
 * 如果源几何本身带顶点色（例如船体吃水线条纹），会被保留并与材质色相乘。
 * 需要独立运动的节点（螺旋桨、风轮）可通过 keepNode 排除在合并之外。
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const _c = new THREE.Color();

/** 创建（并缓存）两个分桶材质 */
export function bucketMaterials(lighting, opts = {}) {
  const mk = (metal) => {
    const m = new THREE.MeshStandardMaterial(metal
      ? { color: 0xffffff, roughness: opts.metalRough ?? 0.45, metalness: 0.8, vertexColors: true, flatShading: !!opts.flat }
      : { color: 0xffffff, roughness: opts.matteRough ?? 0.78, metalness: 0.0, vertexColors: true, flatShading: !!opts.flat });
    lighting.patchFog(m);
    return m;
  };
  return { matte: mk(false), metal: mk(true) };
}

/**
 * @param {THREE.Object3D} obj
 * @param {{matte: THREE.Material, metal: THREE.Material}} mats
 * @param {THREE.Object3D|null} keepNode 该节点子树不参与合并（保留为独立子节点）
 * @returns {THREE.Group|null}
 */
export function collapseObject(obj, mats, keepNode = null) {
  obj.updateMatrixWorld(true);
  const skip = new Set();
  if (keepNode) keepNode.traverse((o) => skip.add(o));
  const objInv = new THREE.Matrix4().copy(obj.matrixWorld).invert();
  const buckets = { matte: [], metal: [] };
  const kept = [];
  let n = 0;
  obj.traverse((o) => {
    if (!o.isMesh || !o.geometry || o.isInstancedMesh) return;
    n++;
    if (skip.has(o)) { kept.push(o); return; }
    const mat = Array.isArray(o.material) ? o.material[0] : o.material;
    if (!mat) return;
    let g;
    try {
      g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    } catch { return; }
    const hadColor = !!g.attributes.color;
    const srcCol = hadColor ? g.attributes.color.array : null;
    const itemSize = hadColor ? g.attributes.color.itemSize : 3;
    for (const name of Object.keys(g.attributes)) {
      if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
    }
    if (!g.attributes.normal) g.computeVertexNormals();
    g.morphAttributes = {};
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(objInv, o.matrixWorld));
    const count = g.attributes.position.count;
    _c.copy(mat.color || { r: 1, g: 1, b: 1 });
    const col = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      if (srcCol) {
        col[i * 3] = _c.r * (srcCol[i * itemSize] ?? 1);
        col[i * 3 + 1] = _c.g * (srcCol[i * itemSize + 1] ?? 1);
        col[i * 3 + 2] = _c.b * (srcCol[i * itemSize + 2] ?? 1);
      } else {
        col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b;
      }
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const b = (mat.metalness ?? 0) > 0.35 ? 'metal' : 'matte';
    /* 双面材质（帆布）单独留出，避免整船变双面 */
    g.userData.doubleSide = mat.side === THREE.DoubleSide;
    buckets[b].push(g);
  });
  if (n < 3) return null;

  const out = new THREE.Group();
  out.name = (obj.name || 'obj') + '/merged';
  for (const key of ['matte', 'metal']) {
    const list = buckets[key];
    if (!list.length) continue;
    const single = list.filter((g) => !g.userData.doubleSide);
    const dbl = list.filter((g) => g.userData.doubleSide);
    for (const [geos, isDouble] of [[single, false], [dbl, true]]) {
      if (!geos.length) continue;
      let merged = null;
      try { merged = mergeGeometries(geos, false); } catch { merged = null; }
      for (const g of geos) g.dispose();
      if (!merged) continue;
      let mat = mats[key];
      if (isDouble) {
        if (!mats['_' + key + 'Double']) {
          const d = mat.clone();
          d.side = THREE.DoubleSide;
          d.onBeforeCompile = mat.onBeforeCompile;
          d.userData.__fogPatched = true;
          mats['_' + key + 'Double'] = d;
        }
        mat = mats['_' + key + 'Double'];
      }
      const mesh = new THREE.Mesh(merged, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      out.add(mesh);
    }
  }
  /* 保留的动态子节点：重建相对位姿后挂到新对象 */
  for (const k of kept) {
    const rel = new THREE.Matrix4().multiplyMatrices(objInv, k.matrixWorld);
    rel.decompose(k.position, k.quaternion, k.scale);
    out.add(k);
  }
  if (!out.children.length) return null;
  out.position.copy(obj.position);
  out.quaternion.copy(obj.quaternion);
  out.scale.copy(obj.scale);
  out.userData = obj.userData;
  /* 释放原几何 */
  obj.traverse((o) => { if (o.isMesh && !skip.has(o)) o.geometry?.dispose?.(); });
  return out;
}
