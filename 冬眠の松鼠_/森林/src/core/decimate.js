import * as THREE from 'three';

// 顶点聚类简化：将顶点吸附到空间网格，合并同格顶点，剔除退化三角形。
// 适合岩石/树干等实体网格的快速减面（保留 UV/法线近似）。
export function decimate(geometry, targetTris) {
  let geo = geometry.index ? geometry : mergeVerticesSimple(geometry);
  if (!geo.index) return geometry;

  const srcTris = geo.index.count / 3;
  if (srcTris <= targetTris) return geometry;

  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const diag = bb.min.distanceTo(bb.max);

  // 二分搜索合适的网格尺寸
  let lo = diag / 800, hi = diag / 8, best = null;
  for (let iter = 0; iter < 9; iter++) {
    const cell = (lo + hi) / 2;
    const result = cluster(geo, cell);
    const tris = result.index.count / 3;
    if (tris > targetTris) lo = cell;
    else { hi = cell; best = result; }
    if (Math.abs(tris - targetTris) < targetTris * 0.15) { best = result; break; }
  }
  return best || cluster(geo, (lo + hi) / 2);
}

function cluster(geo, cellSize) {
  const pos = geo.attributes.position;
  const cellOf = new Int32Array(pos.count); // 顶点 -> 代表顶点
  const map = new Map();
  const repr = [];

  for (let i = 0; i < pos.count; i++) {
    const kx = Math.round(pos.getX(i) / cellSize);
    const ky = Math.round(pos.getY(i) / cellSize);
    const kz = Math.round(pos.getZ(i) / cellSize);
    const key = `${kx},${ky},${kz}`;
    let r = map.get(key);
    if (r === undefined) {
      r = repr.length;
      map.set(key, r);
      repr.push(i);
    }
    cellOf[i] = r;
  }

  // 重建索引，剔除退化三角形
  const srcIdx = geo.index.array;
  const newIdx = [];
  for (let i = 0; i < srcIdx.length; i += 3) {
    const a = cellOf[srcIdx[i]], b = cellOf[srcIdx[i + 1]], c = cellOf[srcIdx[i + 2]];
    if (a !== b && b !== c && a !== c) newIdx.push(a, b, c);
  }

  // 重建属性（取代表顶点值）
  const out = new THREE.BufferGeometry();
  for (const name of Object.keys(geo.attributes)) {
    const src = geo.attributes[name];
    const itemSize = src.itemSize;
    const arr = new Float32Array(repr.length * itemSize);
    for (let r = 0; r < repr.length; r++) {
      for (let k = 0; k < itemSize; k++) {
        arr[r * itemSize + k] = src.array[repr[r] * itemSize + k];
      }
    }
    out.setAttribute(name, new THREE.BufferAttribute(arr, itemSize));
  }
  out.setIndex(newIdx);
  out.computeVertexNormals();
  return out;
}

// 非索引几何 -> 简易焊接（位置量化）
function mergeVerticesSimple(geometry) {
  const pos = geometry.attributes.position;
  const map = new Map();
  const remap = new Int32Array(pos.count);
  const keep = [];
  for (let i = 0; i < pos.count; i++) {
    const key = `${pos.getX(i).toFixed(4)},${pos.getY(i).toFixed(4)},${pos.getZ(i).toFixed(4)}`;
    let r = map.get(key);
    if (r === undefined) {
      r = keep.length;
      map.set(key, r);
      keep.push(i);
    }
    remap[i] = r;
  }
  const out = new THREE.BufferGeometry();
  for (const name of Object.keys(geometry.attributes)) {
    const src = geometry.attributes[name];
    const arr = new Float32Array(keep.length * src.itemSize);
    for (let r = 0; r < keep.length; r++) {
      for (let k = 0; k < src.itemSize; k++) {
        arr[r * src.itemSize + k] = src.array[keep[r] * src.itemSize + k];
      }
    }
    out.setAttribute(name, new THREE.BufferAttribute(arr, src.itemSize));
  }
  const idx = [];
  for (let i = 0; i < pos.count; i += 3) idx.push(remap[i], remap[i + 1], remap[i + 2]);
  out.setIndex(idx);
  return out;
}
