/**
 * DesertProps.js — 沙漠场景的散落道具库（索诺兰/莫哈维风格）。
 *
 * 每个 build* 函数接收一个可复现的 Rng 实例，返回 PropSpec：
 *   { obj, radius, height, label, mass?, breakWind?, size? }
 * 全部使用程序化几何（无纹理、无外部资源），材质通过缓存复用。
 * 风摆动信息放在 obj.userData.windSway，旋转/摇动部件放在 obj.userData.spin / .rock。
 */
import * as THREE from 'three';
import { Rng } from '../../core/Random.js';

export const DESERT_PROP_KINDS = [
  'saguaro', 'barrelCactus', 'prickly', 'deadBush', 'tumbleweed', 'rockSmall',
  'rockLarge', 'mesa', 'joshuaTree', 'oilDerrick', 'windmillMetal', 'cattleSkull',
  'cactusFence', 'waterTank', 'abandonedCar', 'fuelPump', 'crate', 'satelliteDish',
  'yucca', 'sandRipplePatch',
];

/* ============================================================
 * 通用工具：材质缓存 / 网格 / 包围盒 / 几何变形
 * ============================================================ */

let _defaultRng = null;
function useRng(rng) {
  if (rng) return rng;
  if (!_defaultRng) _defaultRng = new Rng(1);
  return _defaultRng;
}

const _matCache = new Map();
function mat(key, params) {
  let m = _matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial(params);
    m.userData.keep = false;
    _matCache.set(key, m);
  }
  return m;
}

const _DM = {};
function desertMaterials() {
  if (_DM.cactusGreen) return _DM;
  _DM.cactusGreen = mat('desert:cactusGreen', { color: 0x3f6b3a, roughness: 0.85, flatShading: true });
  _DM.cactusLight = mat('desert:cactusLight', { color: 0x5a7d45, roughness: 0.85, flatShading: true });
  _DM.rockSand = mat('desert:rockSand', { color: 0x9a7a55, roughness: 0.95, flatShading: true });
  _DM.rockRed = mat('desert:rockRed', { color: 0x8a5a3a, roughness: 0.95, flatShading: true });
  _DM.rockDark = mat('desert:rockDark', { color: 0x5f4a3a, roughness: 0.95, flatShading: true });
  _DM.mesaRock = mat('desert:mesaRock', { color: 0x9c6b45, roughness: 0.95, flatShading: true });
  _DM.deadWood = mat('desert:deadWood', { color: 0x7a654a, roughness: 0.95, flatShading: true });
  _DM.tumbleweed = mat('desert:tumbleweed', { color: 0x8a7a5a, roughness: 0.95, flatShading: true });
  _DM.rustMetal = mat('desert:rustMetal', { color: 0x8a4a2a, roughness: 0.7, metalness: 0.5 });
  _DM.steelGray = mat('desert:steelGray', { color: 0x6a6e70, roughness: 0.5, metalness: 0.6 });
  _DM.steelDark = mat('desert:steelDark', { color: 0x3c4042, roughness: 0.6, metalness: 0.6 });
  _DM.bone = mat('desert:bone', { color: 0xd8d0b8, roughness: 0.85, flatShading: true });
  _DM.fenceWood = mat('desert:fenceWood', { color: 0x6a5238, roughness: 0.95, flatShading: true });
  _DM.tankRust = mat('desert:tankRust', { color: 0x7a5a40, roughness: 0.75, metalness: 0.45 });
  _DM.carRust = mat('desert:carRust', { color: 0x7a4a30, roughness: 0.7, metalness: 0.45 });
  _DM.glassDark = mat('desert:glassDark', { color: 0x1c1f22, roughness: 0.25, metalness: 0.3 });
  _DM.fuelRed = mat('desert:fuelRed', { color: 0x8a2f22, roughness: 0.55, metalness: 0.45 });
  _DM.crateWood = mat('desert:crateWood', { color: 0x9a7a4a, roughness: 0.9, flatShading: true });
  _DM.dishWhite = mat('desert:dishWhite', { color: 0xcfd2cc, roughness: 0.45, metalness: 0.4 });
  _DM.sandRipple = mat('desert:sandRipple', { color: 0xc9b98a, roughness: 0.98, flatShading: true });
  _DM.yuccaGreen = mat('desert:yuccaGreen', { color: 0x6a7d45, roughness: 0.85, flatShading: true });
  _DM.oilGray = mat('desert:oilGray', { color: 0x7a7d78, roughness: 0.55, metalness: 0.55 });
  return _DM;
}

function group(name) {
  const g = new THREE.Group();
  g.name = name;
  return g;
}

function mesh(geo, material, name) {
  const m = new THREE.Mesh(geo, material);
  m.name = name || 'mesh';
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

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

function movable(spec, mass, breakWind, sizeXYZ) {
  spec.mass = mass;
  spec.breakWind = breakWind;
  spec.size = new THREE.Vector3(sizeXYZ[0], sizeXYZ[1], sizeXYZ[2]);
  spec.obj.userData.mass = mass;
  spec.obj.userData.breakWind = breakWind;
  spec.obj.userData.size = spec.size;
  return spec;
}

/** 在 a、b 两点间放置一根细方梁（桁架/栅栏通用） */
function barBetween(parent, a, b, thickness, material, name) {
  const mm = mesh(new THREE.BoxGeometry(thickness, thickness, thickness), material, name);
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  if (len > 1e-5) {
    mm.scale.set(1, len / thickness, 1);
    mm.position.copy(a).add(b).multiplyScalar(0.5);
    mm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  }
  parent.add(mm);
  return mm;
}

/** 桁架塔：四根立柱 + 逐层水平梁与对角斜撑 */
function latticeTower(baseHalf, topHalf, height, levels, material) {
  const grp = group('lattice');
  const c = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  const levelPts = (l) => {
    const y = height * l / levels;
    const r = baseHalf + (topHalf - baseHalf) * l / levels;
    return c.map(([cx, cz]) => new THREE.Vector3(cx * r, y, cz * r));
  };
  const bot = levelPts(0);
  const top = levelPts(levels);
  for (let i = 0; i < 4; i++) barBetween(grp, bot[i], top[i], 0.14, material, 'tower.leg');
  let prev = bot;
  for (let l = 1; l <= levels; l++) {
    const cur = levelPts(l);
    for (let i = 0; i < 4; i++) {
      barBetween(grp, cur[i], cur[(i + 1) % 4], 0.08, material, 'tower.beam');
      barBetween(grp, prev[i], cur[(i + 1) % 4], 0.08, material, 'tower.diag');
    }
    prev = cur;
  }
  return grp;
}

/** 带纵向棱的仙人掌柱身（开顶，另加圆帽） */
function ribbedCylinder(rng, rBottom, rTop, height, radialSegs, heightSegs, ribs, ribDepth) {
  const geo = new THREE.CylinderGeometry(rTop, rBottom, height, radialSegs, heightSegs, true);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const rad = Math.hypot(v.x, v.z);
    if (rad < 1e-5) continue;
    const ang = Math.atan2(v.z, v.x);
    const t = v.y / height + 0.5;
    const wobble = Math.sin(ang * ribs) * ribDepth * (0.5 + t * 0.5);
    const jitter = (rng.next() - 0.5) * ribDepth * 0.5;
    const nr = Math.max(0.01, rad + wobble + jitter);
    v.x = nr * v.x / rad;
    v.z = nr * v.z / rad;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

/** 不规则岩石几何（二十面体 + 顶点扰动 + 逐轴缩放） */
function rockGeometry(rng, detail, r, irregularity, sx, sy, sz) {
  const geo = new THREE.IcosahedronGeometry(r, detail);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    const rr = r * (1 + (rng.next() * 2 - 1) * irregularity);
    pos.setXYZ(i, v.x * rr * sx, v.y * rr * sy, v.z * rr * sz);
  }
  geo.computeVertexNormals();
  return geo;
}

/* ============================================================
 * 各个散落道具
 * ============================================================ */

/** 巨柱仙人掌：主干 + 1~4 条上弯手臂 + 纵向棱 */
export function buildSaguaro(rng, opts = {}) {
  rng = useRng(rng);
  const M = desertMaterials();
  const g = group('desert/saguaro');
  const h = rng.range(5, 12);
  const trunkR = rng.range(0.25, 0.45);

  const trunk = mesh(ribbedCylinder(rng, trunkR * 0.85, trunkR, h, 12, 4, 10, trunkR * 0.18), M.cactusGreen, 'saguaro.trunk');
  trunk.position.y = h / 2;
  g.add(trunk);

  const cap = mesh(new THREE.SphereGeometry(trunkR, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), M.cactusGreen, 'saguaro.cap');
  cap.position.y = h;
  g.add(cap);

  const nArms = rng.int(1, 4);
  for (let i = 0; i < nArms; i++) {
    const armY = h * rng.range(0.35, 0.7);
    const armR = trunkR * rng.range(0.35, 0.55);
    const armGroup = group('saguaro.arm');
    armGroup.position.y = armY;
    armGroup.rotation.y = rng.range(0, Math.PI * 2);

    const stubLen = trunkR * 0.7 + armR;
    const stub = mesh(ribbedCylinder(rng, armR, armR, stubLen, 8, 1, 8, armR * 0.2), M.cactusGreen, 'saguaro.arm.stub');
    stub.rotation.z = Math.PI / 2; // 水平伸出
    stub.position.x = trunkR + stubLen / 2;
    armGroup.add(stub);

    const upLen = h * rng.range(0.2, 0.45);
    const up = mesh(ribbedCylinder(rng, armR * 0.7, armR, upLen, 8, 2, 8, armR * 0.2), M.cactusGreen, 'saguaro.arm.up');
    up.position.set(trunkR + stubLen, upLen / 2, 0);
    armGroup.add(up);

    const armCap = mesh(new THREE.SphereGeometry(armR * 0.8, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), M.cactusGreen, 'saguaro.arm.cap');
    armCap.position.set(trunkR + stubLen, upLen, 0);
    armGroup.add(armCap);

    g.add(armGroup);
  }

  const spec = finalize(g, '巨柱仙人掌');
  spec.obj.userData.windSway = opts.windSway ?? 0.12;
  return spec;
}

/** 桶形仙人掌 */
export function buildBarrelCactus(rng, opts = {}) {
  rng = useRng(rng);
  const M = desertMaterials();
  const g = group('desert/barrelCactus');
  const r = rng.range(0.3, 0.6);
  const h = rng.range(0.4, 0.8);

  const body = mesh(ribbedCylinder(rng, r, r * 0.92, h, 12, 3, 12, r * 0.14), M.cactusLight, 'barrelCactus.body');
  body.position.y = h / 2;
  g.add(body);

  const dome = mesh(new THREE.SphereGeometry(r * 0.95, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), M.cactusLight, 'barrelCactus.dome');
  dome.position.y = h;
  dome.scale.y = 0.55;
  g.add(dome);

  const spec = finalize(g, '桶形仙人掌');
  spec.obj.userData.windSway = opts.windSway ?? 0.05;
  return spec;
}

/** 团扇仙人掌（片状） */
export function buildPrickly(rng, opts = {}) {
  rng = useRng(rng);
  const M = desertMaterials();
  const g = group('desert/prickly');
  const nPads = rng.int(3, 5);
  let y = 0.18;
  let x = 0;
  let z = 0;
  for (let i = 0; i < nPads; i++) {
    const pad = mesh(new THREE.SphereGeometry(0.3, 8, 5), rng.bool(0.4) ? M.cactusLight : M.cactusGreen, 'prickly.pad');
    pad.scale.set(1, 0.55, 0.35);
    pad.position.set(x, y, z);
    pad.rotation.y = rng.range(0, Math.PI * 2);
    pad.rotation.z = rng.range(-0.25, 0.25);
    g.add(pad);
    // 下一片向上/侧向生长
    x += rng.range(-0.12, 0.12);
    z += rng.range(-0.12, 0.12);
    y += rng.range(0.22, 0.32);
  }

  const spec = finalize(g, '团扇仙人掌');
  spec.obj.userData.windSway = opts.windSway ?? 0.15;
  return spec;
}

/** 沙漠枯灌木 */
export function buildDeadBush(rng, opts = {}) {
  rng = useRng(rng);
  const M = desertMaterials();
  const g = group('desert/deadBush');
  const h = rng.range(0.5, 1.1);
  const n = rng.int(4, 8);
  for (let i = 0; i < n; i++) {
    const len = h * rng.range(0.6, 1.0);
    const b = mesh(new THREE.CylinderGeometry(0.012, 0.03, len, 4, 1, false), M.deadWood, 'deadBush.branch');
    b.position.y = len * 0.3;
    b.rotation.z = rng.range(0.3, 1.1) * rng.sign();
    b.rotation.y = rng.range(0, Math.PI * 2);
    g.add(b);
  }

  const spec = finalize(g, '枯灌木');
  spec.obj.userData.windSway = opts.windSway ?? 0.4;
  return spec;
}

/** 风滚草：球形枝条团，质量小、极易被吹走 */
export function buildTumbleweed(rng, opts = {}) {
  rng = useRng(rng);
  const M = desertMaterials();
  const g = group('desert/tumbleweed');
  const r = rng.range(0.3, 0.45);
  const n = rng.int(9, 12);
  for (let i = 0; i < n; i++) {
    const twig = mesh(new THREE.CylinderGeometry(0.015, 0.02, r * 2, 4, 1, false), M.tumbleweed, 'tumbleweed.twig');
    twig.rotation.set(rng.range(0, Math.PI * 2), rng.range(0, Math.PI * 2), rng.range(0, Math.PI * 2));
    twig.position.y = r;
    g.add(twig);
  }

  const spec = finalize(g, '风滚草');
  spec.obj.userData.windSway = opts.windSway ?? 0.7;
  return movable(spec, 1.2, 40, [0.4, 0.4, 0.4]);
}

/** 小岩石 */
export function buildRockSmall(rng, opts = {}) {
  rng = useRng(rng);
  const M = desertMaterials();
  const g = group('desert/rockSmall');
  const r = rng.range(0.25, 0.55);
  const geo = rockGeometry(rng, 1, r, 0.4, rng.range(0.7, 1.2), rng.range(0.5, 0.9), rng.range(0.7, 1.2));
  const rock = mesh(geo, rng.bool(0.5) ? M.rockSand : M.rockRed, 'rockSmall.mesh');
  rock.rotation.y = rng.range(0, Math.PI * 2);
  rock.position.y = r * 0.2;
  g.add(rock);

  return finalize(g, '岩石');
}

/** 大岩石 */
export function buildRockLarge(rng, opts = {}) {
  rng = useRng(rng);
  const M = desertMaterials();
  const g = group('desert/rockLarge');
  const r = rng.range(1.0, 1.8);
  const geo = rockGeometry(rng, 2, r, 0.45, rng.range(0.8, 1.2), rng.range(0.6, 0.95), rng.range(0.8, 1.2));
  const rock = mesh(geo, rng.pick([M.rockSand, M.rockRed, M.rockDark]), 'rockLarge.mesh');
  rock.rotation.y = rng.range(0, Math.PI * 2);
  rock.position.y = r * 0.15;
  g.add(rock);

  return finalize(g, '大岩石');
}

/** 小型平顶台地 / 岩柱（远景地标，30~90 m） */
export function buildMesa(rng, opts = {}) {
  rng = useRng(rng);
  const M = desertMaterials();
  const g = group('desert/mesa');
  const h = rng.range(30, 90);
  const topR = rng.range(8, 20);
  const baseR = topR * rng.range(1.6, 2.4);
  const talusH = h * rng.range(0.55, 0.75);
  const wallR = topR * 1.15;

  // Lathe 轮廓（x=半径, y=高度），自底向上
  const pts = [new THREE.Vector2(0, 0), new THREE.Vector2(baseR, 0)];
  const talusN = 3;
  for (let i = 1; i <= talusN; i++) {
    const u = i / talusN;
    const x = baseR + (wallR - baseR) * (u * u);
    pts.push(new THREE.Vector2(x, talusH * u));
  }
  pts.push(new THREE.Vector2(wallR, talusH));
  pts.push(new THREE.Vector2(topR * 1.02, h * 0.9));
  pts.push(new THREE.Vector2(topR, h));
  pts.push(new THREE.Vector2(0, h));

  const geo = new THREE.LatheGeometry(pts, 40);
  // 沿径向扰动崖壁/坡面，制造嶙峋感（顶部与轴心不动）
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const rad = Math.hypot(v.x, v.z);
    if (rad < 0.5 || v.y >= h - 0.5) continue;
    const k = 1 + (rng.next() - 0.5) * 0.16;
    pos.setXYZ(i, v.x * k, v.y, v.z * k);
  }
  geo.computeVertexNormals();

  const mesa = mesh(geo, M.mesaRock, 'mesa.mesh');
  g.add(mesa);

  // 底座碎石
  const nRocks = rng.int(2, 4);
  for (let i = 0; i < nRocks; i++) {
    const rr = rng.range(1.5, 4);
    const rg = rockGeometry(rng, 1, rr, 0.4, 1, 0.6, 1);
    const rk = mesh(rg, M.rockDark, 'mesa.rubble');
    const az = rng.range(0, Math.PI * 2);
    rk.position.set(Math.cos(az) * baseR * 0.9, rr * 0.12, Math.sin(az) * baseR * 0.9);
    rk.rotation.y = rng.range(0, Math.PI * 2);
    g.add(rk);
  }

  return finalize(g, '平顶台地');
}

/** 约书亚树：分叉树干 + 针叶团 */
export function buildJoshuaTree(rng, opts = {}) {
  rng = useRng(rng);
  const M = desertMaterials();
  const g = group('desert/joshuaTree');
  const h = rng.range(3, 6);

  const trunk = mesh(new THREE.CylinderGeometry(0.09, 0.18, h * 0.6, 5, 1, true), M.deadWood, 'joshuaTree.trunk');
  trunk.position.y = h * 0.3;
  g.add(trunk);

  const nArms = rng.int(2, 3);
  for (let i = 0; i < nArms; i++) {
    const armGroup = group('joshuaTree.arm');
    armGroup.position.y = h * rng.range(0.45, 0.6);
    armGroup.rotation.y = (i / nArms) * Math.PI * 2 + rng.range(-0.4, 0.4);

    const len = h * rng.range(0.3, 0.45);
    const arm = mesh(new THREE.CylinderGeometry(0.05, 0.09, len, 5, 1, true), M.deadWood, 'joshuaTree.arm.branch');
    arm.position.y = len / 2;
    arm.rotation.z = rng.range(-0.5, 0.15);
    armGroup.add(arm);

    // 针叶团：一圈细长剑叶
    const nNeedles = rng.int(8, 12);
    for (let k = 0; k < nNeedles; k++) {
      const leaf = mesh(new THREE.BoxGeometry(0.02, 0.5, 0.03), M.yuccaGreen, 'joshuaTree.arm.needle');
      leaf.position.y = len * 0.85;
      const az = (k / nNeedles) * Math.PI * 2;
      leaf.rotation.y = az;
      leaf.rotation.z = rng.range(-0.5, 0.5);
      leaf.position.x = Math.cos(az) * 0.08;
      leaf.position.z = Math.sin(az) * 0.08;
      armGroup.add(leaf);
    }
    g.add(armGroup);
  }

  const spec = finalize(g, '约书亚树');
  spec.obj.userData.windSway = opts.windSway ?? 0.5;
  return spec;
}

/** 桁架采油塔 + 抽油机（游梁可摇动） */
export function buildOilDerrick(rng, opts = {}) {
  rng = useRng(rng);
  const M = desertMaterials();
  const g = group('desert/oilDerrick');
  const h = rng.range(18, 26);

  const tower = latticeTower(3.5, 1.2, h, 6, M.steelDark);
  g.add(tower);

  const plat = mesh(new THREE.BoxGeometry(3, 0.3, 3), M.steelGray, 'derrick.platform');
  plat.position.y = h;
  g.add(plat);

  // 游梁式抽油机
  const pump = group('derrick.pump');
  pump.position.set(3.5, 0, 2.5);
  const frameH = rng.range(2.5, 3.2);
  barBetween(pump, new THREE.Vector3(-0.8, 0, -0.2), new THREE.Vector3(0, frameH, 0), 0.12, M.steelDark, 'pump.legA');
  barBetween(pump, new THREE.Vector3(0.8, 0, -0.2), new THREE.Vector3(0, frameH, 0), 0.12, M.steelDark, 'pump.legB');

  const beamGroup = group('derrick.beam');
  beamGroup.position.set(0, frameH, 0);
  const beam = mesh(new THREE.BoxGeometry(5.2, 0.22, 0.22), M.oilGray, 'pump.walkingBeam');
  beam.position.x = -0.6;
  beamGroup.add(beam);
  const head = mesh(new THREE.TorusGeometry(0.55, 0.12, 6, 8, Math.PI), M.oilGray, 'pump.horsehead');
  head.position.set(-3.1, 0, 0);
  beamGroup.add(head);
  const cw = mesh(new THREE.BoxGeometry(0.6, 0.5, 0.3), M.steelDark, 'pump.counterweight');
  cw.position.set(1.8, -0.2, 0);
  beamGroup.add(cw);
  pump.add(beamGroup);
  g.add(pump);

  const spec = finalize(g, '采油塔');
  spec.obj.userData.rock = { node: beamGroup, axis: 'z', amplitude: 0.5, speed: 1.4 };
  return spec;
}

/** 金属风车（含可旋转风轮） */
export function buildWindmillMetal(rng, opts = {}) {
  rng = useRng(rng);
  const M = desertMaterials();
  const g = group('desert/windmillMetal');
  const h = rng.range(8, 12);

  const tower = latticeTower(1.4, 0.4, h, 3, M.steelGray);
  g.add(tower);

  const plat = mesh(new THREE.BoxGeometry(1.2, 0.2, 1.2), M.steelDark, 'windmill.platform');
  plat.position.y = h;
  g.add(plat);

  const wheel = group('windmill.wheel');
  wheel.position.y = h + 0.25;
  const hub = mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.22, 8, 1, false), M.steelDark, 'windmill.hub');
  hub.rotation.x = Math.PI / 2;
  wheel.add(hub);
  const nBlades = rng.int(8, 10);
  for (let i = 0; i < nBlades; i++) {
    const blade = mesh(new THREE.BoxGeometry(1.4, 0.2, 0.03), M.steelGray, 'windmill.blade');
    blade.position.x = 0.7;
    blade.rotation.z = (i / nBlades) * Math.PI * 2 + rng.range(-0.08, 0.08);
    wheel.add(blade);
  }
  g.add(wheel);

  const boom = mesh(new THREE.BoxGeometry(0.06, 0.06, 1.3), M.steelGray, 'windmill.boom');
  boom.position.set(0, h + 0.25, -0.7);
  g.add(boom);
  const fin = mesh(new THREE.BoxGeometry(0.03, 0.7, 0.8), M.rustMetal, 'windmill.fin');
  fin.position.set(0, h + 0.25, -1.35);
  g.add(fin);

  const spec = finalize(g, '金属风车');
  spec.obj.userData.spin = { node: wheel, axis: 'z', speed: 4 };
  return spec;
}

/** 牛头骨 */
export function buildCattleSkull(rng, opts = {}) {
  rng = useRng(rng);
  const M = desertMaterials();
  const g = group('desert/cattleSkull');

  const cranium = mesh(new THREE.BoxGeometry(0.4, 0.22, 0.5), M.bone, 'skull.cranium');
  cranium.position.y = 0.12;
  g.add(cranium);

  const snout = mesh(new THREE.BoxGeometry(0.28, 0.16, 0.5), M.bone, 'skull.snout');
  snout.position.set(0.3, 0.1, 0);
  g.add(snout);

  for (const s of [-1, 1]) {
    const horn = mesh(new THREE.TorusGeometry(0.3, 0.045, 6, 10, Math.PI), M.bone, 'skull.horn');
    horn.position.set(0.05, 0.18, s * 0.18);
    horn.rotation.x = Math.PI / 2;
    horn.rotation.y = s * 0.9;
    g.add(horn);
  }

  const spec = finalize(g, '牛头骨');
  return movable(spec, 3, 150, [0.35, 0.3, 0.35]);
}

/** 枯枝栅栏，opts.length 米 */
export function buildCactusFence(rng, opts = {}) {
  rng = useRng(rng);
  const M = desertMaterials();
  const g = group('desert/cactusFence');
  const length = opts.length ?? 8;
  const h = rng.range(1.1, 1.6);
  const postN = Math.max(2, Math.floor(length / 1.4) + 1);

  for (let i = 0; i < postN; i++) {
    const x = -length / 2 + i * (length / (postN - 1));
    const post = mesh(new THREE.CylinderGeometry(0.05, 0.07, h, 5, 1, false), M.fenceWood, 'fence.post');
    post.position.set(x, h / 2, rng.range(-0.05, 0.05));
    post.rotation.z = rng.range(-0.08, 0.08);
    g.add(post);
  }

  for (let r = 0; r < 2; r++) {
    const rail = mesh(new THREE.CylinderGeometry(0.035, 0.04, length, 5, 1, false), M.fenceWood, 'fence.rail');
    rail.rotation.z = Math.PI / 2; // 沿 X 横放
    rail.position.set(0, h * (0.35 + 0.4 * r), 0);
    g.add(rail);
  }

  const nDiag = rng.int(2, 4);
  for (let i = 0; i < nDiag; i++) {
    const d = mesh(new THREE.CylinderGeometry(0.03, 0.04, length * rng.range(0.5, 0.9), 5, 1, false), M.fenceWood, 'fence.diag');
    d.position.set(rng.range(-length / 4, length / 4), h * rng.range(0.3, 0.6), 0);
    d.rotation.z = Math.PI / 2;
    d.rotation.x = rng.range(0.2, 0.6) * rng.sign();
    g.add(d);
  }

  return finalize(g, '枯枝栅栏', { radius: length / 2 + 0.3 });
}

/** 锈蚀铁皮水箱 */
export function buildWaterTank(rng, opts = {}) {
  rng = useRng(rng);
  const M = desertMaterials();
  const g = group('desert/waterTank');
  const r = rng.range(1.5, 2.5);
  const h = rng.range(2.5, 4);
  const legsH = rng.range(0.4, 0.9);

  const body = mesh(new THREE.CylinderGeometry(r, r * 0.98, h, 14, 2, false), M.tankRust, 'waterTank.body');
  body.position.y = legsH + h / 2;
  g.add(body);

  const roof = mesh(new THREE.CylinderGeometry(r * 0.06, r, 0.8, 14, 1, false), M.tankRust, 'waterTank.roof');
  roof.position.y = legsH + h + 0.4;
  g.add(roof);

  for (const x of [-r * 0.7, r * 0.7]) {
    for (const z of [-r * 0.7, r * 0.7]) {
      const leg = mesh(new THREE.BoxGeometry(0.15, legsH, 0.15), M.steelDark, 'waterTank.leg');
      leg.position.set(x, legsH / 2, z);
      g.add(leg);
    }
  }

  return finalize(g, '铁皮水箱');
}

/** 废弃锈车（无轮胎、破窗） */
export function buildAbandonedCar(rng, opts = {}) {
  rng = useRng(rng);
  const M = desertMaterials();
  const g = group('desert/abandonedCar');

  const body = mesh(new THREE.BoxGeometry(3.6, 0.7, 1.7), M.carRust, 'car.body');
  body.position.y = 0.6;
  body.rotation.z = rng.range(-0.03, 0.03);
  g.add(body);

  const cabin = mesh(new THREE.BoxGeometry(1.6, 0.55, 1.6), M.carRust, 'car.cabin');
  cabin.position.set(-0.9, 1.25, 0);
  g.add(cabin);

  const hood = mesh(new THREE.BoxGeometry(1.2, 0.15, 1.6), M.carRust, 'car.hood');
  hood.position.set(1.4, 0.95, 0);
  hood.rotation.z = -0.12;
  g.add(hood);

  // 破碎车窗（几块歪斜的暗色玻璃片）
  for (const z of [-0.7, 0.7]) {
    const shard = mesh(new THREE.BoxGeometry(0.04, 0.35, 0.7), M.glassDark, 'car.windowShard');
    shard.position.set(-0.9, 1.35, z);
    shard.rotation.z = rng.range(-0.4, 0.4) * rng.sign();
    g.add(shard);
  }

  // 无轮胎：四根车轴桩
  for (const x of [-1.7, 1.5]) {
    for (const z of [-0.8, 0.8]) {
      const stub = mesh(new THREE.BoxGeometry(0.15, 0.3, 0.15), M.steelDark, 'car.axleStub');
      stub.position.set(x, 0.15, z);
      g.add(stub);
    }
  }

  const spec = finalize(g, '废弃锈车');
  return movable(spec, 1100, 1000, [1.8, 0.8, 0.9]);
}

/** 老式加油机 */
export function buildFuelPump(rng, opts = {}) {
  rng = useRng(rng);
  const M = desertMaterials();
  const g = group('desert/fuelPump');

  const base = mesh(new THREE.BoxGeometry(0.5, 0.1, 0.4), M.steelDark, 'fuelPump.base');
  base.position.y = 0.05;
  g.add(base);

  const body = mesh(new THREE.BoxGeometry(0.45, 1.3, 0.35), M.fuelRed, 'fuelPump.body');
  body.position.y = 0.75;
  g.add(body);

  const top = mesh(new THREE.BoxGeometry(0.5, 0.15, 0.4), M.fuelRed, 'fuelPump.top');
  top.position.y = 1.42;
  g.add(top);

  const gauge = mesh(new THREE.BoxGeometry(0.3, 0.2, 0.02), M.glassDark, 'fuelPump.gauge');
  gauge.position.set(0, 1.0, 0.18);
  g.add(gauge);

  const hose = mesh(new THREE.TorusGeometry(0.18, 0.02, 6, 12), M.steelDark, 'fuelPump.hose');
  hose.position.set(0.22, 0.5, 0);
  g.add(hose);

  const nozzle = mesh(new THREE.BoxGeometry(0.08, 0.1, 0.05), M.steelGray, 'fuelPump.nozzle');
  nozzle.position.set(0.4, 0.55, 0.1);
  g.add(nozzle);

  const spec = finalize(g, '加油机');
  return movable(spec, 70, 450, [0.3, 0.7, 0.25]);
}

/** 木箱 */
export function buildCrate(rng, opts = {}) {
  rng = useRng(rng);
  const M = desertMaterials();
  const g = group('desert/crate');

  const box = mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), M.crateWood, 'crate.box');
  box.position.y = 0.4;
  box.rotation.y = rng.range(0, Math.PI * 2);
  g.add(box);

  // 边框板条
  for (const s of [-1, 1]) {
    const strip = mesh(new THREE.BoxGeometry(0.82, 0.12, 0.82), M.crateWood, 'crate.strip');
    strip.position.y = 0.4 + s * 0.34;
    g.add(strip);
  }

  const spec = finalize(g, '木箱');
  return movable(spec, 25, 300, [0.4, 0.4, 0.4]);
}

/** 卫星天线（抛物面） */
export function buildSatelliteDish(rng, opts = {}) {
  rng = useRng(rng);
  const M = desertMaterials();
  const g = group('desert/satelliteDish');
  const R = rng.range(1.5, 2.2);
  const depth = R * 0.35;

  // Lathe 抛物面轮廓
  const pts = [];
  const N = 10;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    pts.push(new THREE.Vector2(R * t, depth * t * t));
  }
  const dishGeo = new THREE.LatheGeometry(pts, 20);

  const dishGroup = group('dish.assembly');
  dishGroup.position.y = rng.range(1.2, 1.8);
  dishGroup.rotation.z = rng.range(-0.7, -0.4); // 朝上倾斜

  const dish = mesh(dishGeo, M.dishWhite, 'dish.reflector');
  dishGroup.add(dish);

  // 馈源臂 + 馈源
  const arm = mesh(new THREE.BoxGeometry(0.04, 0.04, R * 0.9), M.steelGray, 'dish.arm');
  arm.position.set(0, R * 0.9, 0);
  arm.rotation.x = Math.PI / 2;
  dishGroup.add(arm);
  const feed = mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.3, 8, 1, false), M.steelDark, 'dish.feed');
  feed.position.set(0, depth * 0.9, R * 0.55);
  dishGroup.add(feed);
  g.add(dishGroup);

  // 立杆 + 三脚支腿
  const pole = mesh(new THREE.CylinderGeometry(0.06, 0.08, dishGroup.position.y, 8, 1, false), M.steelGray, 'dish.pole');
  pole.position.y = dishGroup.position.y / 2;
  g.add(pole);
  for (let i = 0; i < 3; i++) {
    const az = (i / 3) * Math.PI * 2 + rng.range(-0.3, 0.3);
    const leg = mesh(new THREE.BoxGeometry(0.05, 0.05, dishGroup.position.y * 0.7), M.steelGray, 'dish.leg');
    leg.position.set(Math.cos(az) * 0.3, dishGroup.position.y * 0.35, Math.sin(az) * 0.3);
    leg.rotation.z = Math.cos(az) * 0.6;
    leg.rotation.x = -Math.sin(az) * 0.6;
    g.add(leg);
  }

  return finalize(g, '卫星天线');
}

/** 丝兰：一簇细长剑叶 */
export function buildYucca(rng, opts = {}) {
  rng = useRng(rng);
  const M = desertMaterials();
  const g = group('desert/yucca');

  const stem = mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.3, 6, 1, true), M.yuccaGreen, 'yucca.stem');
  stem.position.y = 0.15;
  g.add(stem);

  const n = rng.int(15, 24);
  for (let i = 0; i < n; i++) {
    const len = rng.range(0.5, 0.9);
    const leaf = mesh(new THREE.BoxGeometry(0.03, len, 0.05), M.yuccaGreen, 'yucca.leaf');
    leaf.position.y = 0.3;
    const az = (i / n) * Math.PI * 2 + rng.range(-0.2, 0.2);
    const tilt = rng.range(0.35, 0.9);
    leaf.rotation.y = az;
    leaf.rotation.z = tilt;
    leaf.position.x = Math.cos(az) * 0.05;
    leaf.position.z = Math.sin(az) * 0.05;
    g.add(leaf);
  }

  const spec = finalize(g, '丝兰');
  spec.obj.userData.windSway = opts.windSway ?? 0.45;
  return spec;
}

/** 一片沙纹（贴地薄几何，用于近景细节） */
export function buildSandRipplePatch(rng, opts = {}) {
  rng = useRng(rng);
  const M = desertMaterials();
  const g = group('desert/sandRipplePatch');
  const size = opts.length ?? 3;
  const seg = 14;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);

  const amp = rng.range(0.03, 0.08);
  const freq = rng.range(2, 4) * (Math.PI * 2 / size);
  const phase = rng.range(0, Math.PI * 2);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    // 沿 X 的平行沙脊，带轻微横向起伏
    const ridge = 0.5 + 0.5 * Math.sin(v.x * freq + 0.3 * Math.sin(v.y * freq * 0.5) + phase);
    v.z = amp * ridge;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();

  const patch = mesh(geo, M.sandRipple, 'sandRipplePatch.mesh');
  patch.rotation.x = -Math.PI / 2; // 平铺地面
  patch.position.y = 0.02;
  patch.rotation.z = rng.range(0, Math.PI);
  g.add(patch);

  return finalize(g, '沙纹');
}

/* ============================================================
 * 分发器与加权随机
 * ============================================================ */

export function buildDesertProp(rng, kind, opts = {}) {
  rng = useRng(rng);
  switch (kind) {
    case 'saguaro': return buildSaguaro(rng, opts);
    case 'barrelCactus': return buildBarrelCactus(rng, opts);
    case 'prickly': return buildPrickly(rng, opts);
    case 'deadBush': return buildDeadBush(rng, opts);
    case 'tumbleweed': return buildTumbleweed(rng, opts);
    case 'rockSmall': return buildRockSmall(rng, opts);
    case 'rockLarge': return buildRockLarge(rng, opts);
    case 'mesa': return buildMesa(rng, opts);
    case 'joshuaTree': return buildJoshuaTree(rng, opts);
    case 'oilDerrick': return buildOilDerrick(rng, opts);
    case 'windmillMetal': return buildWindmillMetal(rng, opts);
    case 'cattleSkull': return buildCattleSkull(rng, opts);
    case 'cactusFence': return buildCactusFence(rng, opts);
    case 'waterTank': return buildWaterTank(rng, opts);
    case 'abandonedCar': return buildAbandonedCar(rng, opts);
    case 'fuelPump': return buildFuelPump(rng, opts);
    case 'crate': return buildCrate(rng, opts);
    case 'satelliteDish': return buildSatelliteDish(rng, opts);
    case 'yucca': return buildYucca(rng, opts);
    case 'sandRipplePatch': return buildSandRipplePatch(rng, opts);
    default: return buildRockSmall(rng, opts);
  }
}

const DESERT_WEIGHTS = {
  saguaro: 12, barrelCactus: 10, prickly: 9, deadBush: 8, tumbleweed: 7,
  rockSmall: 14, rockLarge: 8, mesa: 1, joshuaTree: 6, oilDerrick: 1,
  windmillMetal: 1, cattleSkull: 3, cactusFence: 4, waterTank: 2,
  abandonedCar: 2, fuelPump: 2, crate: 3, satelliteDish: 1, yucca: 7,
  sandRipplePatch: 10,
};

/** 按合理权重随机一种沙漠道具 */
export function randomDesertProp(rng, opts = {}) {
  rng = useRng(rng);
  const kinds = DESERT_PROP_KINDS;
  let total = 0;
  for (const k of kinds) total += DESERT_WEIGHTS[k] ?? 1;
  let r = rng.next() * total;
  for (const k of kinds) {
    r -= DESERT_WEIGHTS[k] ?? 1;
    if (r <= 0) return buildDesertProp(rng, k, opts);
  }
  return buildDesertProp(rng, kinds[0], opts);
}
