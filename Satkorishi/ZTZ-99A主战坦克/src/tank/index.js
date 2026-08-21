/**
 * 整车装配
 *
 * 运动学层级（这是"符合客观规律"的关键——每一级的父子关系都对应真实约束）：
 *
 *   root(ZTZ-99A)
 *   ├── hull                车体（固定）
 *   │   ├── crewDriver      驾驶员（随车体）
 *   │   └── powerpack       动力包（随车体）
 *   ├── turretYaw           炮塔方向机回转轴（绕 Y，360°）
 *   │   ├── turret          炮塔壳体 / 观瞄 / 机枪 / 尾栏
 *   │   ├── autoloader      转盘装弹机（随炮塔回转 —— 真车如此）
 *   │   ├── fighting        战斗舱内部
 *   │   ├── crewGunner / crewCommander
 *   │   └── gunPivot        火炮耳轴（绕 X 俯仰 −6°～+14°）
 *   │       └── recoil      后坐部分（沿 −Z 平移，行程 0.3 m）
 *   └── runningGear         行动装置（履带/轮系/悬挂）
 */
import * as THREE from 'three';
import { D } from './dims.js';
import { buildHull } from './hull.js';
import { buildTurret } from './turret.js';
import { buildGun } from './gun.js';
import { buildRunningGear } from './running.js';
import {
  buildAutoloader,
  buildCommander,
  buildDriver,
  buildFightingCompartment,
  buildGunner,
  buildPowerpack,
} from './internals.js';

/** 这些零件即使不在"内部组"里，也属于车内不可见件 */
const INTERIOR_PIDS = new Set([
  'gun.breech',
  'gun.bore',
  'gun.cradle',
  'gun.recoilBrake',
  'gun.recuperator',
  'gun.elevActuator',
  'run.torsionBar',
]);

export function buildTank(M) {
  const root = new THREE.Group();
  root.name = 'ZTZ-99A';

  /* ---- 车体 ---- */
  const hull = buildHull(M);
  root.add(hull);

  /* ---- 动力包 + 驾驶员（挂车体）---- */
  const powerpack = buildPowerpack(M);
  powerpack.userData.interior = true;
  hull.add(powerpack);
  const driver = buildDriver(M);
  driver.userData.interior = true;
  hull.add(driver);

  /* ---- 炮塔回转轴 ---- */
  const turretYaw = new THREE.Group();
  turretYaw.name = 'turretYaw';
  turretYaw.position.set(0, D.hullRoofY, D.turretZ);
  root.add(turretYaw);

  const turret = buildTurret(M);
  turretYaw.add(turret);

  /* ---- 火炮（耳轴俯仰）---- */
  const gunPivot = buildGun(M);
  gunPivot.position.set(0, D.trunnionY - D.hullRoofY, D.trunnionZ - D.turretZ);
  turretYaw.add(gunPivot);

  /* ---- 炮塔内部 ---- */
  const autoloader = buildAutoloader(M);
  autoloader.userData.interior = true;
  turretYaw.add(autoloader);
  const fighting = buildFightingCompartment(M);
  fighting.userData.interior = true;
  turretYaw.add(fighting);
  const gunner = buildGunner(M);
  gunner.userData.interior = true;
  turretYaw.add(gunner);
  const commander = buildCommander(M);
  commander.userData.interior = true;
  turretYaw.add(commander);

  /* ---- 行动装置 ---- */
  const runningGear = buildRunningGear(M);
  root.add(runningGear);

  /* ---- 汇总运动引用 ---- */
  const refs = {
    root,
    hull,
    turretYaw,
    turret,
    gunPivot,
    runningGear,
    turretParts: turret.userData.refs || {},
    gunParts: gunPivot.userData.refs || {},
    loaderParts: autoloader.userData.refs || {},
    runParts: runningGear.userData.refs || {},
    groups: { hull, turret, gunPivot, runningGear, powerpack, autoloader, fighting },
    crew: { driver, gunner, commander },
  };

  /* ---- 建立零件索引 ---- */
  const byPid = new Map();
  const all = [];
  let interiorFlag = 0;
  root.traverse((o) => {
    if (!o.isMesh) return;
    // 继承祖先的 interior 标记
    let node = o;
    let interior = INTERIOR_PIDS.has(o.userData.pid);
    while (node && !interior) {
      if (node.userData && node.userData.interior) interior = true;
      node = node.parent;
    }
    o.userData.interior = interior;
    if (interior) interiorFlag++;
    const pid = o.userData.pid || 'misc';
    o.userData.pid = pid;
    if (!byPid.has(pid)) byPid.set(pid, []);
    byPid.get(pid).push(o);
    all.push(o);
  });

  /* ---- 统计（面数/零件数），用于 UI 显示 ---- */
  let tris = 0;
  for (const m of all) {
    const g = m.geometry;
    const n = g.index ? g.index.count : g.attributes.position.count;
    tris += n / 3;
  }

  const stats = {
    meshes: all.length,
    parts: byPid.size,
    triangles: Math.round(tris),
    interiorMeshes: interiorFlag,
  };

  return { root, refs, byPid, meshes: all, stats };
}

/** 按目录条目解析出对应零件 */
export function resolveItem(byPid, item) {
  const out = [];
  const seen = new Set();
  const push = (arr) => {
    for (const m of arr) if (!seen.has(m)) (seen.add(m), out.push(m));
  };
  if (item.pids) for (const p of item.pids) if (byPid.has(p)) push(byPid.get(p));
  if (item.prefix) {
    for (const [pid, arr] of byPid) {
      for (const pre of item.prefix) {
        if (pre === '' || pid.startsWith(pre)) {
          push(arr);
          break;
        }
      }
    }
  }
  return out;
}
