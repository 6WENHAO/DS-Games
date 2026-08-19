/**
 * PlainProps.js — 大平原场景的散落道具库（中西部农业带风格）。
 *
 * 每个 build* 函数接收一个可复现的 Rng 实例，返回 PropSpec：
 *   { obj, radius, height, label, mass?, breakWind?, size? }
 * 全部使用程序化几何（无纹理、无外部资源），材质通过缓存复用。
 * 风摆动信息放在 obj.userData.windSway，旋转部件放在 obj.userData.spin。
 */
import * as THREE from 'three';
import { Rng } from '../../core/Random.js';

export const PLAIN_PROP_KINDS = [
  'tree', 'deadTree', 'bush', 'hayBale', 'tractor', 'pickup', 'waterTrough',
  'mailbox', 'tire', 'cropRow', 'windPump', 'gravestone', 'picnicTable',
  'oilDrum', 'birdhouse', 'signpost', 'cornStack', 'wagon',
];

/* ============================================================
 * 通用工具：材质缓存 / 网格 / 包围盒 / 几何合并
 * ============================================================ */

/** 模块级默认 rng（惰性创建，避免 import 期副作用） */
let _defaultRng = null;
function useRng(rng) {
  if (rng) return rng;
  if (!_defaultRng) _defaultRng = new Rng(1);
  return _defaultRng;
}

const _matCache = new Map();
/** 按 key 缓存材质，避免成百上千个材质实例 */
function mat(key, params) {
  let m = _matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial(params);
    m.userData.keep = false; // 随场景一起释放
    _matCache.set(key, m);
  }
  return m;
}

/** 平原材质调色板（惰性构建一次） */
const _PM = {};
function plainMaterials() {
  if (_PM.bark) return _PM;
  const common = { roughness: 0.9, metalness: 0.0 };
  _PM.bark = mat('plain:bark', { color: 0x5a4632, roughness: 0.95, flatShading: true });
  _PM.barkGray = mat('plain:barkGray', { color: 0x6e5a42, roughness: 0.95, flatShading: true });
  _PM.leaf = mat('plain:leaf', { color: 0x4a6b2f, roughness: 0.85, flatShading: true });
  _PM.leafLight = mat('plain:leafLight', { color: 0x6b8a3a, roughness: 0.85, flatShading: true });
  _PM.hay = mat('plain:hay', { color: 0xc9a54a, roughness: 0.95, flatShading: true });
  _PM.metalRed = mat('plain:metalRed', { color: 0x8a2f22, roughness: 0.55, metalness: 0.45 });
  _PM.metalGray = mat('plain:metalGray', { color: 0x6b7072, roughness: 0.5, metalness: 0.6 });
  _PM.metalDark = mat('plain:metalDark', { color: 0x3a3d3e, roughness: 0.6, metalness: 0.6 });
  _PM.tireBlack = mat('plain:tireBlack', { color: 0x1c1e1f, roughness: 0.95, metalness: 0.0 });
  _PM.glassDark = mat('plain:glassDark', { color: 0x22303c, roughness: 0.2, metalness: 0.35 });
  _PM.woodPlank = mat('plain:woodPlank', { color: 0x8a6f4a, roughness: 0.9, flatShading: true });
  _PM.woodLight = mat('plain:woodLight', { color: 0xa8875a, roughness: 0.9, flatShading: true });
  _PM.stoneGray = mat('plain:stoneGray', { color: 0x77766e, roughness: 0.9, flatShading: true });
  _PM.greenMetal = mat('plain:greenMetal', { color: 0x4a5d3f, roughness: 0.55, metalness: 0.5 });
  _PM.rustOrange = mat('plain:rustOrange', { color: 0x9a5a2e, roughness: 0.75, metalness: 0.5 });
  _PM.cornGold = mat('plain:cornGold', { color: 0xc9a13a, roughness: 0.9, flatShading: true });
  _PM.cornGreen = mat('plain:cornGreen', { color: 0x5a6b2f, roughness: 0.85, flatShading: true, side: THREE.DoubleSide });
  _PM.mailboxBlue = mat('plain:mailboxBlue', { color: 0x3f5a72, roughness: 0.5, metalness: 0.4 });
  _PM.whitePaint = mat('plain:whitePaint', { color: 0xc6c0a8, roughness: 0.7, metalness: 0.1 });
  _PM.metalSilver = mat('plain:metalSilver', { color: 0x9aa0a0, roughness: 0.4, metalness: 0.7 });
  _PM.waterDark = mat('plain:waterDark', { color: 0x2a3a44, roughness: 0.25, metalness: 0.4 });
  _PM.pickupRed = mat('plain:pickupRed', { color: 0x7a3b2a, roughness: 0.55, metalness: 0.4 });
  _PM.pickupBlue = mat('plain:pickupBlue', { color: 0x4a6b8a, roughness: 0.55, metalness: 0.4 });
  return _PM;
}

function group(name) {
  const g = new THREE.Group();
  g.name = name;
  return g;
}

/** 创建带阴影的网格 */
function mesh(geo, material, name) {
  const m = new THREE.Mesh(geo, material);
  m.name = name || 'mesh';
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** 创建带阴影的 InstancedMesh */
function instanced(geo, material, count, name) {
  const im = new THREE.InstancedMesh(geo, material, count);
  im.name = name || 'instanced';
  im.castShadow = true;
  im.receiveShadow = true;
  return im;
}

/** 计算占地半径与高度，返回 PropSpec（可被后续覆盖 radius/height） */
function finalize(obj, label, overrides = {}) {
  obj.traverse((o) => { if (o.isMesh || o.isInstancedMesh) o.geometry?.computeBoundingBox?.(); });
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj);
  const size = new THREE.Vector3();
  box.getSize(size);
  let radius = overrides.radius != null ? overrides.radius : Math.hypot(size.x, size.z) * 0.5;
  let height = overrides.height != null ? overrides.height : box.max.y;
  if (!Number.isFinite(radius) || radius < 0.05) radius = 0.05;
  if (!Number.isFinite(height) || height < 0.05) height = 0.05;
  return { obj, radius, height, label };
}

/** 标记为可被龙卷风吹走的动态物 */
function movable(spec, mass, breakWind, sizeXYZ) {
  spec.mass = mass;
  spec.breakWind = breakWind;
  spec.size = new THREE.Vector3(sizeXYZ[0], sizeXYZ[1], sizeXYZ[2]);
  spec.obj.userData.mass = mass;
  spec.obj.userData.breakWind = breakWind;
  spec.obj.userData.size = spec.size;
  return spec;
}

/** 合并多个（已变换）几何为一个非索引 BufferGeometry，并重算法线 */
function mergeGeometries(geos) {
  const positions = [];
  const index = [];
  let vcount = 0;
  for (const g of geos) {
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
    const idx = g.index;
    if (idx) { for (let i = 0; i < idx.count; i++) index.push(vcount + idx.getX(i)); }
    else { for (let i = 0; i < pos.count; i++) index.push(vcount + i); }
    vcount += pos.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  out.setIndex(index);
  out.computeVertexNormals();
  return out;
}

/** 对几何应用（平移+旋转）变换，便于合并 */
function transformGeo(geo, x, y, z, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz));
  const p = new THREE.Vector3(x, y, z);
  const s = new THREE.Vector3(1, 1, 1);
  m.compose(p, q, s);
  geo.applyMatrix4(m);
  return geo;
}

/** 扭曲的枯树干：径向扰动 + 高度抖动 */
function gnarledTrunk(rng, h, rBase) {
  const geo = new THREE.CylinderGeometry(rBase * 0.28, rBase, h, 6, 6, false);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const rad = Math.hypot(v.x, v.z);
    if (rad > 1e-4) {
      const k = 1 + (rng.next() - 0.5) * 0.55;
      const nr = Math.max(0.01, rad * k);
      v.x = nr * v.x / rad;
      v.z = nr * v.z / rad;
      v.y += (rng.next() - 0.5) * h * 0.05;
    }
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

/* ============================================================
 * 各个散落道具
 * ============================================================ */

/** 阔叶树：分叉树干 + 3~6 团低模树冠 */
export function buildTree(rng, opts = {}) {
  rng = useRng(rng);
  const M = plainMaterials();
  const g = group('plain/tree');
  const height = rng.range(4.5, 9);
  const trunkH = height * rng.range(0.42, 0.55);
  const trunkR = rng.range(0.12, 0.2);

  const trunk = mesh(new THREE.CylinderGeometry(trunkR * 0.5, trunkR, trunkH, 6, 2, false), M.bark, 'tree.trunk');
  trunk.position.y = trunkH / 2;
  g.add(trunk);

  const nBranches = rng.int(2, 3);
  for (let i = 0; i < nBranches; i++) {
    const bl = rng.range(0.5, 1.4);
    const br = trunkR * rng.range(0.4, 0.6);
    const b = mesh(new THREE.CylinderGeometry(br * 0.5, br, bl, 5, 1, false), M.bark, 'tree.branch');
    b.position.y = trunkH * rng.range(0.6, 0.95);
    b.rotation.z = rng.range(0.25, 0.7) * rng.sign();
    b.rotation.y = rng.range(0, Math.PI * 2);
    g.add(b);
  }

  const nBlobs = rng.int(3, 6);
  const canopyY = trunkH * 0.9;
  for (let i = 0; i < nBlobs; i++) {
    const r = rng.range(0.7, 1.5);
    const blob = mesh(new THREE.IcosahedronGeometry(r, rng.bool(0.3) ? 1 : 0), rng.bool(0.5) ? M.leaf : M.leafLight, 'tree.canopy');
    blob.position.set(rng.range(-1.2, 1.2), canopyY + rng.range(-0.3, 1.2), rng.range(-1.2, 1.2));
    blob.scale.y = rng.range(0.8, 1.1);
    g.add(blob);
  }

  const spec = finalize(g, '阔叶树');
  spec.obj.userData.windSway = opts.windSway ?? 0.85;
  return spec;
}

/** 枯树：只有扭曲枝干 */
export function buildDeadTree(rng, opts = {}) {
  rng = useRng(rng);
  const M = plainMaterials();
  const g = group('plain/deadTree');
  const height = rng.range(2.5, 5);
  const rBase = rng.range(0.09, 0.16);

  const trunk = mesh(gnarledTrunk(rng, height, rBase), M.barkGray, 'deadTree.trunk');
  trunk.position.y = height / 2;
  g.add(trunk);

  const nB = rng.int(2, 4);
  for (let i = 0; i < nB; i++) {
    const bl = rng.range(0.6, 1.6);
    const b = mesh(new THREE.CylinderGeometry(0.012, 0.04, bl, 4, 1, false), M.barkGray, 'deadTree.branch');
    b.position.y = height * rng.range(0.4, 0.85);
    b.rotation.z = rng.range(0.3, 1.0) * rng.sign();
    b.rotation.y = rng.range(0, Math.PI * 2);
    g.add(b);
  }

  const spec = finalize(g, '枯树');
  spec.obj.userData.windSway = opts.windSway ?? 0.45;
  return spec;
}

/** 灌木丛 */
export function buildBush(rng, opts = {}) {
  rng = useRng(rng);
  const M = plainMaterials();
  const g = group('plain/bush');
  const n = rng.int(3, 6);
  for (let i = 0; i < n; i++) {
    const r = rng.range(0.3, 0.65);
    const b = mesh(new THREE.IcosahedronGeometry(r, 0), rng.bool(0.5) ? M.leaf : M.leafLight, 'bush.clump');
    b.position.set(rng.range(-0.25, 0.25), r * 0.5, rng.range(-0.25, 0.25));
    b.scale.set(rng.range(0.8, 1.2), rng.range(0.6, 0.95), rng.range(0.8, 1.2));
    g.add(b);
  }
  const spec = finalize(g, '灌木丛');
  spec.obj.userData.windSway = opts.windSway ?? 0.5;
  return spec;
}

/** 圆柱干草卷（横躺，可被吹走） */
export function buildHayBale(rng, opts = {}) {
  rng = useRng(rng);
  const M = plainMaterials();
  const g = group('plain/hayBale');
  const r = rng.range(0.65, 0.8);
  const w = rng.range(1.3, 1.6);
  const roll = mesh(new THREE.CylinderGeometry(r, r, w, 14, 1, false), M.hay, 'hayBale.roll');
  roll.rotation.x = Math.PI / 2; // 轴沿 Z 横躺
  roll.position.y = r;
  roll.scale.y = rng.range(0.9, 1.0); // 略扁
  g.add(roll);

  const spec = finalize(g, '干草卷');
  return movable(spec, 280, 350, [0.8, 0.8, 0.8]);
}

/** 老式拖拉机：大后轮/小前轮、引擎罩、排气管、座椅、方向盘 */
export function buildTractor(rng, opts = {}) {
  rng = useRng(rng);
  const M = plainMaterials();
  const g = group('plain/tractor');
  const body = mesh(new THREE.BoxGeometry(2.0, 0.5, 0.9), M.metalRed, 'tractor.body');
  body.position.set(0.2, 1.0, 0);
  g.add(body);

  const hood = mesh(new THREE.BoxGeometry(1.1, 0.45, 0.5), M.metalRed, 'tractor.hood');
  hood.position.set(1.35, 1.05, 0);
  g.add(hood);

  const nose = mesh(new THREE.BoxGeometry(0.2, 0.5, 0.6), M.metalDark, 'tractor.nose');
  nose.position.set(1.95, 0.85, 0);
  g.add(nose);

  for (const z of [-1, 1]) {
    const rw = mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.45, 14, 1, false), M.tireBlack, 'tractor.rearWheel');
    rw.rotation.x = Math.PI / 2;
    rw.position.set(-0.7, 0.85, z * 0.62);
    g.add(rw);

    const fw = mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.3, 10, 1, false), M.tireBlack, 'tractor.frontWheel');
    fw.rotation.x = Math.PI / 2;
    fw.position.set(1.55, 0.35, z * 0.4);
    g.add(fw);

    const fender = mesh(new THREE.BoxGeometry(0.9, 0.12, 0.7), M.metalRed, 'tractor.fender');
    fender.position.set(-0.7, 1.7, z * 0.62);
    g.add(fender);
  }

  const exhaust = mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.1, 8, 1, false), M.metalDark, 'tractor.exhaust');
  exhaust.position.set(0.55, 1.75, 0.3);
  g.add(exhaust);

  const seat = mesh(new THREE.BoxGeometry(0.5, 0.08, 0.5), M.tireBlack, 'tractor.seat');
  seat.position.set(-0.9, 1.35, 0);
  g.add(seat);
  const back = mesh(new THREE.BoxGeometry(0.08, 0.5, 0.5), M.tireBlack, 'tractor.seatBack');
  back.position.set(-1.15, 1.6, 0);
  g.add(back);

  const wheel = mesh(new THREE.TorusGeometry(0.18, 0.025, 6, 12), M.metalGray, 'tractor.steeringWheel');
  wheel.position.set(1.55, 1.45, 0.32);
  wheel.rotation.x = Math.PI / 2 - 0.5;
  g.add(wheel);
  const column = mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.4, 6, 1, false), M.metalDark, 'tractor.column');
  column.position.set(1.55, 1.2, 0.32);
  g.add(column);

  const spec = finalize(g, '拖拉机');
  return movable(spec, 3200, 1400, [1.1, 1.0, 2.1]);
}

/** 皮卡：驾驶室 + 货厢 + 四轮 + 车窗 */
export function buildPickup(rng, opts = {}) {
  rng = useRng(rng);
  const M = plainMaterials();
  const bodyColor = rng.bool(0.5) ? M.pickupRed : M.pickupBlue;
  const g = group('plain/pickup');

  const chassis = mesh(new THREE.BoxGeometry(5.4, 0.6, 1.8), bodyColor, 'pickup.chassis');
  chassis.position.y = 0.8;
  g.add(chassis);

  const cab = mesh(new THREE.BoxGeometry(1.7, 0.7, 1.7), bodyColor, 'pickup.cab');
  cab.position.set(-1.6, 1.45, 0);
  g.add(cab);

  const windshield = mesh(new THREE.BoxGeometry(0.1, 0.5, 1.5), M.glassDark, 'pickup.windshield');
  windshield.position.set(-0.7, 1.55, 0);
  windshield.rotation.z = -0.5;
  g.add(windshield);

  const bed = mesh(new THREE.BoxGeometry(2.6, 0.5, 1.75), bodyColor, 'pickup.bed');
  bed.position.set(1.2, 1.15, 0);
  g.add(bed);
  const bedInner = mesh(new THREE.BoxGeometry(2.5, 0.1, 1.6), M.metalDark, 'pickup.bedInner');
  bedInner.position.set(1.2, 1.32, 0);
  g.add(bedInner);

  for (const x of [-2.1, 1.7]) {
    for (const z of [-0.85, 0.85]) {
      const w = mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 12, 1, false), M.tireBlack, 'pickup.wheel');
      w.rotation.x = Math.PI / 2;
      w.position.set(x, 0.42, z);
      g.add(w);
    }
  }

  for (const z of [-0.75, 0.75]) {
    const win = mesh(new THREE.BoxGeometry(0.06, 0.4, 0.9), M.glassDark, 'pickup.window');
    win.position.set(-1.6, 1.5, z);
    g.add(win);
  }

  const spec = finalize(g, '皮卡');
  return movable(spec, 1800, 1200, [1.4, 0.9, 2.7]);
}

/** 饮马水槽 */
export function buildWaterTrough(rng, opts = {}) {
  rng = useRng(rng);
  const M = plainMaterials();
  const g = group('plain/waterTrough');
  const outer = mesh(new THREE.BoxGeometry(1.5, 0.55, 0.6), M.metalGray, 'trough.outer');
  outer.position.y = 0.275;
  g.add(outer);
  const inner = mesh(new THREE.BoxGeometry(1.38, 0.06, 0.48), M.metalDark, 'trough.inner');
  inner.position.y = 0.52;
  g.add(inner);
  const water = mesh(new THREE.BoxGeometry(1.34, 0.02, 0.44), M.waterDark, 'trough.water');
  water.position.y = 0.55;
  g.add(water);
  for (const x of [-0.6, 0.6]) {
    const leg = mesh(new THREE.BoxGeometry(0.08, 0.25, 0.5), M.metalDark, 'trough.leg');
    leg.position.set(x, 0.12, 0);
    g.add(leg);
  }

  const spec = finalize(g, '饮马水槽');
  return movable(spec, 80, 500, [0.75, 0.3, 0.3]);
}

/** 邮箱 */
export function buildMailbox(rng, opts = {}) {
  rng = useRng(rng);
  const M = plainMaterials();
  const g = group('plain/mailbox');
  const post = mesh(new THREE.BoxGeometry(0.09, 1.0, 0.09), M.woodLight, 'mailbox.post');
  post.position.y = 0.5;
  g.add(post);
  const box = mesh(new THREE.BoxGeometry(0.45, 0.3, 0.2), M.mailboxBlue, 'mailbox.box');
  box.position.y = 1.15;
  g.add(box);
  const cap = mesh(new THREE.CylinderGeometry(0.225, 0.225, 0.2, 10, 1, false, 0, Math.PI), M.mailboxBlue, 'mailbox.cap');
  cap.rotation.z = Math.PI / 2;
  cap.rotation.y = Math.PI / 2;
  cap.position.y = 1.3;
  g.add(cap);
  const flag = mesh(new THREE.BoxGeometry(0.04, 0.02, 0.12), M.metalRed, 'mailbox.flag');
  flag.position.set(-0.15, 1.25, 0.13);
  g.add(flag);

  const spec = finalize(g, '邮箱');
  return movable(spec, 8, 260, [0.25, 0.6, 0.15]);
}

/** 废旧轮胎 */
export function buildTire(rng, opts = {}) {
  rng = useRng(rng);
  const M = plainMaterials();
  const g = group('plain/tire');
  const t = mesh(new THREE.TorusGeometry(0.28, 0.11, 8, 16), M.tireBlack, 'tire.torus');
  if (rng.bool(0.5)) {
    t.rotation.x = Math.PI / 2; // 平躺
    t.position.y = 0.11;
  } else {
    t.rotation.y = rng.range(0, Math.PI); // 直立
    t.position.y = 0.39;
  }
  g.add(t);

  const spec = finalize(g, '轮胎');
  return movable(spec, 12, 180, [0.4, 0.4, 0.12]);
}

/** 一株玉米 / 小麦的合并几何（用于 InstancedMesh） */
function cornPlantGeometry(rng) {
  const h = rng.range(1.6, 2.1);
  const parts = [];
  const stalk = new THREE.CylinderGeometry(0.03, 0.045, h, 5, 1, true);
  parts.push(transformGeo(stalk, 0, h / 2, 0));
  // 两片剑叶（DoubleSide 平面，价廉且能双面看到）
  for (let i = 0; i < 2; i++) {
    const leaf = new THREE.PlaneGeometry(0.55, 0.16);
    leaf.translate(0.27, 0, 0);
    const az = rng.range(0, Math.PI * 2);
    const droop = rng.range(0.15, 0.9);
    parts.push(transformGeo(leaf, 0, h * rng.range(0.45, 0.65), 0, droop, az, 0));
  }
  // 玉米棒
  const cob = new THREE.CylinderGeometry(0.05, 0.06, 0.28, 5, 1, true);
  parts.push(transformGeo(cob, 0, h * 0.55, 0, Math.PI / 2, rng.range(0, Math.PI * 2), 0));
  return mergeGeometries(parts);
}

function wheatPlantGeometry(rng) {
  const h = rng.range(0.9, 1.25);
  const parts = [];
  const stalk = new THREE.CylinderGeometry(0.012, 0.02, h, 4, 1, true);
  parts.push(transformGeo(stalk, 0, h / 2, 0));
  const head = new THREE.CylinderGeometry(0.005, 0.04, 0.16, 5, 1, true);
  parts.push(transformGeo(head, 0, h + 0.06, 0));
  return mergeGeometries(parts);
}

/** 一段作物垄（玉米/小麦），用 InstancedMesh，opts.length 米 */
export function buildCropRow(rng, opts = {}) {
  rng = useRng(rng);
  const M = plainMaterials();
  const g = group('plain/cropRow');
  const length = opts.length ?? 10;
  const isCorn = rng.bool(0.6);
  const plantGeo = isCorn ? cornPlantGeometry(rng) : wheatPlantGeometry(rng);
  const spacing = isCorn ? 0.5 : 0.35;
  const count = Math.max(2, Math.floor(length / spacing));

  const im = instanced(plantGeo, isCorn ? M.cornGreen : M.cornGold, count, 'cropRow.instances');
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    p.set(-length / 2 + i * spacing + rng.range(-0.06, 0.06), 0, rng.range(-0.14, 0.14));
    e.set(0, rng.range(0, Math.PI * 2), rng.range(-0.08, 0.08));
    q.setFromEuler(e);
    const sc = rng.range(0.85, 1.15);
    s.set(sc, sc, sc);
    m4.compose(p, q, s);
    im.setMatrixAt(i, m4);
  }
  im.instanceMatrix.needsUpdate = true;
  g.add(im);

  const spec = finalize(g, isCorn ? '玉米垄' : '小麦垄', { radius: length / 2 + 0.5 });
  spec.obj.userData.windSway = opts.windSway ?? 0.9;
  return spec;
}

/** 小型风力抽水机（含可旋转风轮） */
export function buildWindPump(rng, opts = {}) {
  rng = useRng(rng);
  const M = plainMaterials();
  const g = group('plain/windPump');
  const h = rng.range(4, 6);
  const base = 0.5;
  const top = 0.18;

  const corners = [[-base, -base], [base, -base], [base, base], [-base, base]];
  const bar = (a, b, t, m, name) => {
    const geo = new THREE.BoxGeometry(t, t, t);
    const mm = mesh(geo, m, name);
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    if (len > 1e-5) {
      mm.scale.set(1, len / t, 1);
      mm.position.copy(a).add(b).multiplyScalar(0.5);
      mm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    }
    g.add(mm);
    return mm;
  };

  for (const [cx, cz] of corners) {
    bar(new THREE.Vector3(cx, 0, cz), new THREE.Vector3(cx * 0.36, h, cz * 0.36), 0.07, M.metalGray, 'windPump.leg');
  }
  for (let l = 1; l <= 2; l++) {
    const y = h * (l / 2.5);
    const r = base + (top - base) * (l / 2.5);
    const pts = corners.map(([cx, cz]) => new THREE.Vector3(cx * r, y, cz * r));
    for (let i = 0; i < 4; i++) bar(pts[i], pts[(i + 1) % 4], 0.05, M.metalGray, 'windPump.beam');
  }

  const plat = mesh(new THREE.BoxGeometry(0.7, 0.12, 0.7), M.metalDark, 'windPump.platform');
  plat.position.y = h;
  g.add(plat);

  const wheel = group('windPump.wheel');
  wheel.position.y = h + 0.25;
  const hub = mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.18, 8, 1, false), M.metalDark, 'windPump.hub');
  hub.rotation.x = Math.PI / 2;
  wheel.add(hub);
  const nBlades = rng.int(10, 12);
  for (let i = 0; i < nBlades; i++) {
    const blade = mesh(new THREE.BoxGeometry(0.85, 0.13, 0.02), M.metalGray, 'windPump.blade');
    blade.position.x = 0.42;
    blade.rotation.z = (i / nBlades) * Math.PI * 2 + rng.range(-0.1, 0.1);
    wheel.add(blade);
  }
  g.add(wheel);

  const boom = mesh(new THREE.BoxGeometry(0.05, 0.05, 1.0), M.metalGray, 'windPump.boom');
  boom.position.set(0, h + 0.25, -0.55);
  g.add(boom);
  const fin = mesh(new THREE.BoxGeometry(0.02, 0.5, 0.6), M.metalRed, 'windPump.fin');
  fin.position.set(0, h + 0.25, -1.0);
  g.add(fin);

  const spec = finalize(g, '风力抽水机');
  spec.obj.userData.spin = { node: wheel, axis: 'z', speed: 6 };
  return spec;
}

/** 墓碑 */
export function buildGravestone(rng, opts = {}) {
  rng = useRng(rng);
  const M = plainMaterials();
  const g = group('plain/gravestone');
  const h = rng.range(0.6, 1.1);

  const base = mesh(new THREE.BoxGeometry(0.5, 0.12, 0.28), M.stoneGray, 'gravestone.base');
  base.position.y = 0.06;
  g.add(base);

  const slab = mesh(new THREE.BoxGeometry(0.4, h, 0.12), M.stoneGray, 'gravestone.slab');
  slab.position.y = 0.12 + h / 2;
  slab.rotation.z = rng.range(-0.04, 0.04);
  g.add(slab);

  const dome = mesh(new THREE.SphereGeometry(0.2, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), M.stoneGray, 'gravestone.dome');
  dome.position.y = 0.12 + h;
  g.add(dome);

  const spec = finalize(g, '墓碑');
  return movable(spec, 130, 900, [0.22, 0.55, 0.1]);
}

/** 野餐桌 */
export function buildPicnicTable(rng, opts = {}) {
  rng = useRng(rng);
  const M = plainMaterials();
  const g = group('plain/picnicTable');

  const top = mesh(new THREE.BoxGeometry(1.8, 0.06, 0.75), M.woodLight, 'picnicTable.top');
  top.position.y = 0.74;
  g.add(top);

  for (const z of [-0.55, 0.55]) {
    const bench = mesh(new THREE.BoxGeometry(1.8, 0.05, 0.32), M.woodPlank, 'picnicTable.bench');
    bench.position.set(0, 0.44, z);
    g.add(bench);
  }

  for (const x of [-0.6, 0.6]) {
    for (const z of [-1, 1]) {
      const leg = mesh(new THREE.BoxGeometry(0.08, 0.95, 0.5), M.woodPlank, 'picnicTable.leg');
      leg.position.set(x, 0.45, z * 0.42);
      leg.rotation.x = rng.range(0.25, 0.5) * z;
      g.add(leg);
    }
  }

  const spec = finalize(g, '野餐桌');
  return movable(spec, 140, 850, [0.9, 0.45, 0.6]);
}

/** 油桶 */
export function buildOilDrum(rng, opts = {}) {
  rng = useRng(rng);
  const M = plainMaterials();
  const g = group('plain/oilDrum');
  const drum = mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.9, 12, 2, false), M.rustOrange, 'oilDrum.body');
  drum.position.y = 0.45;
  drum.rotation.y = rng.range(0, Math.PI * 2);
  g.add(drum);
  for (const y of [0.25, 0.65]) {
    const rib = mesh(new THREE.TorusGeometry(0.29, 0.02, 5, 10), M.metalDark, 'oilDrum.rib');
    rib.rotation.x = Math.PI / 2;
    rib.position.y = y;
    g.add(rib);
  }

  const spec = finalize(g, '油桶');
  return movable(spec, 15, 250, [0.3, 0.45, 0.3]);
}

/** 鸟屋 */
export function buildBirdhouse(rng, opts = {}) {
  rng = useRng(rng);
  const M = plainMaterials();
  const g = group('plain/birdhouse');
  const post = mesh(new THREE.BoxGeometry(0.08, 1.6, 0.08), M.woodLight, 'birdhouse.post');
  post.position.y = 0.8;
  g.add(post);

  const house = mesh(new THREE.BoxGeometry(0.35, 0.3, 0.35), M.woodPlank, 'birdhouse.house');
  house.position.y = 1.75;
  g.add(house);

  for (const s of [-1, 1]) {
    const roof = mesh(new THREE.BoxGeometry(0.42, 0.03, 0.26), M.woodPlank, 'birdhouse.roof');
    roof.position.set(0, 1.95, 0);
    roof.rotation.z = 0.55 * s;
    roof.translateX(0.06 * s);
    g.add(roof);
  }

  const perch = mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.14, 6, 1, false), M.woodLight, 'birdhouse.perch');
  perch.rotation.x = Math.PI / 2;
  perch.position.set(0.17, 1.62, 0);
  g.add(perch);

  const spec = finalize(g, '鸟屋');
  return movable(spec, 6, 220, [0.2, 0.9, 0.2]);
}

/** 路牌（可弯折） */
export function buildSignpost(rng, opts = {}) {
  rng = useRng(rng);
  const M = plainMaterials();
  const g = group('plain/signpost');
  const post = mesh(new THREE.BoxGeometry(0.12, 2.2, 0.12), M.woodLight, 'signpost.post');
  post.position.y = 1.1;
  g.add(post);

  const b1 = mesh(new THREE.BoxGeometry(1.4, 0.5, 0.04), M.whitePaint, 'signpost.board1');
  b1.position.set(0.2, 1.85, 0);
  b1.rotation.z = rng.range(-0.12, 0.12);
  g.add(b1);

  const b2 = mesh(new THREE.BoxGeometry(0.9, 0.4, 0.04), M.whitePaint, 'signpost.board2');
  b2.position.set(-0.15, 1.25, 0);
  b2.rotation.z = rng.range(-0.5, -0.2); // 弯折的下牌
  g.add(b2);

  const spec = finalize(g, '路牌');
  return movable(spec, 40, 450, [0.7, 1.1, 0.1]);
}

/** 玉米秸秆垛 */
export function buildCornStack(rng, opts = {}) {
  rng = useRng(rng);
  const M = plainMaterials();
  const g = group('plain/cornStack');
  const h = rng.range(1.8, 2.5);

  const cone = mesh(new THREE.CylinderGeometry(0.14, 0.8, h, 8, 2, false), M.cornGold, 'cornStack.cone');
  cone.position.y = h / 2;
  g.add(cone);

  const n = rng.int(7, 10);
  for (let i = 0; i < n; i++) {
    const az = (i / n) * Math.PI * 2 + rng.range(-0.2, 0.2);
    const stalk = mesh(new THREE.CylinderGeometry(0.03, 0.05, h * 0.85, 5, 1, false), M.cornGold, 'cornStack.stalk');
    stalk.position.set(Math.cos(az) * 0.7, h * 0.42, Math.sin(az) * 0.7);
    stalk.rotation.z = Math.cos(az) * 0.45;
    stalk.rotation.x = Math.sin(az) * 0.45;
    g.add(stalk);
  }

  const spec = finalize(g, '玉米垛');
  spec.obj.userData.windSway = opts.windSway ?? 0.15;
  return movable(spec, 60, 350, [0.6, 0.6, 0.6]);
}

/** 木板车 */
export function buildWagon(rng, opts = {}) {
  rng = useRng(rng);
  const M = plainMaterials();
  const g = group('plain/wagon');

  const bed = mesh(new THREE.BoxGeometry(2.0, 0.5, 1.2), M.woodLight, 'wagon.bed');
  bed.position.y = 0.9;
  g.add(bed);
  const bedInner = mesh(new THREE.BoxGeometry(1.9, 0.06, 1.1), M.woodPlank, 'wagon.bedInner');
  bedInner.position.y = 1.12;
  g.add(bedInner);

  for (const x of [-0.75, 0.75]) {
    for (const z of [-0.7, 0.7]) {
      const w = mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.12, 10, 1, false), M.woodPlank, 'wagon.wheel');
      w.rotation.x = Math.PI / 2;
      w.position.set(x, 0.4, z);
      g.add(w);
    }
  }

  for (const z of [-0.4, 0.4]) {
    const tongue = mesh(new THREE.BoxGeometry(2.2, 0.06, 0.06), M.woodLight, 'wagon.tongue');
    tongue.position.set(1.9, 0.55, z);
    tongue.rotation.z = -0.12;
    g.add(tongue);
  }

  const spec = finalize(g, '木板车');
  return movable(spec, 250, 400, [1.0, 0.6, 0.7]);
}

/* ============================================================
 * 分发器与加权随机
 * ============================================================ */

export function buildPlainProp(rng, kind, opts = {}) {
  rng = useRng(rng);
  switch (kind) {
    case 'tree': return buildTree(rng, opts);
    case 'deadTree': return buildDeadTree(rng, opts);
    case 'bush': return buildBush(rng, opts);
    case 'hayBale': return buildHayBale(rng, opts);
    case 'tractor': return buildTractor(rng, opts);
    case 'pickup': return buildPickup(rng, opts);
    case 'waterTrough': return buildWaterTrough(rng, opts);
    case 'mailbox': return buildMailbox(rng, opts);
    case 'tire': return buildTire(rng, opts);
    case 'cropRow': return buildCropRow(rng, opts);
    case 'windPump': return buildWindPump(rng, opts);
    case 'gravestone': return buildGravestone(rng, opts);
    case 'picnicTable': return buildPicnicTable(rng, opts);
    case 'oilDrum': return buildOilDrum(rng, opts);
    case 'birdhouse': return buildBirdhouse(rng, opts);
    case 'signpost': return buildSignpost(rng, opts);
    case 'cornStack': return buildCornStack(rng, opts);
    case 'wagon': return buildWagon(rng, opts);
    default: return buildTree(rng, opts);
  }
}

const PLAIN_WEIGHTS = {
  tree: 16, deadTree: 5, bush: 13, hayBale: 9, tractor: 2, pickup: 2,
  waterTrough: 3, mailbox: 4, tire: 4, cropRow: 10, windPump: 2,
  gravestone: 3, picnicTable: 2, oilDrum: 3, birdhouse: 3, signpost: 4,
  cornStack: 5, wagon: 2,
};

/** 按合理权重随机一种平原道具 */
export function randomPlainProp(rng, opts = {}) {
  rng = useRng(rng);
  const kinds = PLAIN_PROP_KINDS;
  let total = 0;
  for (const k of kinds) total += PLAIN_WEIGHTS[k] ?? 1;
  let r = rng.next() * total;
  for (const k of kinds) {
    r -= PLAIN_WEIGHTS[k] ?? 1;
    if (r <= 0) return buildPlainProp(rng, k, opts);
  }
  return buildPlainProp(rng, kinds[0], opts);
}
