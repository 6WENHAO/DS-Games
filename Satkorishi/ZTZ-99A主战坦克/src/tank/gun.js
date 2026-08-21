/**
 * 火炮 (125 mm 滑膛炮 + 防盾 + 后坐装置 + 并列机枪)
 *
 * 原型：ZPT-98 型 125 mm 滑膛炮（98 式），配自动装弹机，
 * 身管中部带抽气装置（fume extractor），全长带热护套分段。
 *
 * 局部坐标：原点 = 耳轴中心，+Z = 炮口方向。
 * 层级：gunPivot(俯仰) → [防盾/摇架/后坐机 静止] + recoil(后坐平移) → [身管/炮闩]
 */
import * as THREE from 'three';
import { D } from './dims.js';
import { DEG, box, chamfer, cyl, mergeAll, pipe, T, tubeFrom, boltRing } from '../util/geom.js';

function add(parent, geo, mat, pid, name) {
  if (!geo) return null;
  const m = new THREE.Mesh(geo, mat);
  m.userData.pid = pid;
  m.name = name || pid;
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

export function buildGun(M) {
  const pivot = new THREE.Group();
  pivot.name = 'gunPivot';
  const refs = {};
  pivot.userData.refs = refs;

  const L = D.muzzleZ - D.trunnionZ; // 炮口到耳轴 5.88 m
  const rBase = 0.098;
  const rTip = 0.072;
  const rAt = (z) => rBase + (rTip - rBase) * Math.min(1, Math.max(0, z / L));

  /* ================================================================
   * 1. 防盾（随火炮俯仰，但不随身管后坐）
   * ============================================================== */
  const mantlet = mergeAll([
    T(chamfer(0.86, 0.74, 0.34, 0.05), { pos: [0, 0, 0.04] }),
    // 前部收窄的铸造过渡段
    T(chamfer(0.6, 0.56, 0.2, 0.06), { pos: [0, 0, 0.25] }),
  ]);
  add(pivot, mantlet, M.armor, 'gun.mantlet', '火炮防盾');
  add(pivot, T(pipe(0.175, 0.108, 0.16, 26, 'z'), { pos: [0, 0, 0.4] }), M.armorDark, 'gun.mantlet', '防盾炮口套环');
  // 防盾防尘罩（帆布）
  add(pivot, T(cyl(0.19, 0.16, 0.18, 20, 'z'), { pos: [0, 0, 0.5] }), M.tarp, 'gun.mantlet', '炮口防尘罩');
  // 耳轴
  for (const side of [-1, 1]) {
    add(pivot, T(cyl(0.075, 0.075, 0.2, 16, 'x'), { pos: [side * 0.44, 0, 0] }), M.steel, 'gun.trunnion', '耳轴');
  }

  /* ================================================================
   * 2. 摇架 / 后坐装置（制退机 + 复进机）
   * ============================================================== */
  add(
    pivot,
    mergeAll([
      T(box(0.5, 0.1, 0.9), { pos: [0, -0.2, -0.35] }),
      T(box(0.1, 0.34, 0.9), { pos: [-0.24, -0.05, -0.35] }),
      T(box(0.1, 0.34, 0.9), { pos: [0.24, -0.05, -0.35] }),
    ]),
    M.steelDark,
    'gun.cradle',
    '火炮摇架',
  );
  // 制退机（左）/ 复进机（右）
  for (const [side, name, pid] of [
    [-1, '液压制退机', 'gun.recoilBrake'],
    [1, '复进机（气液式）', 'gun.recuperator'],
  ]) {
    add(
      pivot,
      T(cyl(0.075, 0.075, 0.86, 16, 'z'), { pos: [side * 0.19, 0.16, -0.3] }),
      M.steel,
      pid,
      name,
    );
    add(
      pivot,
      T(cyl(0.042, 0.042, 0.42, 12, 'z'), { pos: [side * 0.19, 0.16, 0.3] }),
      M.steelDark,
      pid,
      name + '活塞杆',
    );
  }
  // 高低机（电液俯仰作动筒）
  add(
    pivot,
    T(cyl(0.06, 0.06, 0.5, 14, 'y'), { rot: [0.35, 0, 0], pos: [0.36, -0.38, -0.55] }),
    M.steel,
    'gun.elevActuator',
    '高低机作动筒',
  );

  /* ================================================================
   * 3. 后坐组件：身管 + 炮闩
   * ============================================================== */
  const recoil = new THREE.Group();
  recoil.name = 'recoilGroup';
  pivot.add(recoil);
  refs.recoil = recoil;

  // --- 身管本体（分段锥度）---
  const tube = [];
  const segs = [
    [0.0, 0.62],
    [0.62, 1.3],
    [1.3, 2.18],
    [2.5, 3.4],
    [3.4, 4.4],
    [4.4, L - 0.14],
  ];
  for (const [z0, z1] of segs) {
    tube.push(T(cyl(rAt(z1), rAt(z0), z1 - z0, 22, 'z'), { pos: [0, 0, (z0 + z1) / 2] }));
  }
  add(recoil, mergeAll(tube), M.gunSteel, 'gun.barrel', '125 mm 滑膛炮身管');

  // --- 热护套（分两段，中间让出抽气装置）---
  const sleeveSegs = [
    [0.66, 2.16],
    [2.54, 4.62],
  ];
  const sleeves = [];
  for (const [z0, z1] of sleeveSegs) {
    sleeves.push(T(pipe(rAt((z0 + z1) / 2) + 0.032, rAt((z0 + z1) / 2) + 0.012, z1 - z0, 24, 'z'), { pos: [0, 0, (z0 + z1) / 2] }));
    // 护套箍带
    const n = Math.round((z1 - z0) / 0.42);
    for (let i = 0; i <= n; i++) {
      const z = z0 + ((z1 - z0) * i) / n;
      sleeves.push(T(pipe(rAt(z) + 0.04, rAt(z) + 0.03, 0.03, 20, 'z'), { pos: [0, 0, z] }));
    }
  }
  add(recoil, mergeAll(sleeves), M.armorDark, 'gun.thermalSleeve', '身管热护套');

  // --- 抽气装置（fume extractor）---
  add(
    recoil,
    mergeAll([
      T(cyl(0.148, 0.148, 0.34, 24, 'z'), { pos: [0, 0, 2.35] }),
      T(cyl(0.148, rAt(2.18) + 0.03, 0.08, 24, 'z'), { pos: [0, 0, 2.14] }),
      T(cyl(rAt(2.52) + 0.03, 0.148, 0.08, 24, 'z'), { pos: [0, 0, 2.56] }),
    ]),
    M.gunSteel,
    'gun.fumeExtractor',
    '抽气装置',
  );

  // --- 炮口段 + 膛口（可见炮膛）---
  add(recoil, T(cyl(rTip + 0.012, rTip + 0.004, 0.16, 22, 'z'), { pos: [0, 0, L - 0.07] }), M.gunSteel, 'gun.muzzle', '炮口段');
  add(recoil, T(pipe(rTip + 0.012, D.caliber / 2, 0.05, 22, 'z'), { pos: [0, 0, L - 0.02] }), M.blackMetal, 'gun.muzzle', '膛口');
  add(recoil, T(cyl(D.caliber / 2, D.caliber / 2, 1.2, 20, 'z'), { pos: [0, 0, L - 0.65] }), M.blackMetal, 'gun.bore', '炮膛（内壁示意）');

  // 炮口基准 —— 供开火特效定位（随后坐移动）
  const muzzleAnchor = new THREE.Object3D();
  muzzleAnchor.position.set(0, 0, L + 0.02);
  muzzleAnchor.name = 'muzzleAnchor';
  recoil.add(muzzleAnchor);
  refs.muzzle = muzzleAnchor;

  // --- 炮闩（半自动横楔式）+ 炮尾 ---
  const breechRing = mergeAll([
    T(chamfer(0.44, 0.46, 0.5, 0.03), { pos: [0, 0, -0.5] }),
    T(cyl(0.16, 0.16, 0.3, 20, 'z'), { pos: [0, 0, -0.16] }),
  ]);
  add(recoil, breechRing, M.steelDark, 'gun.breech', '炮尾（炮闩体）');
  // 横楔式闩体（可下落，供装填动画）
  const wedgeGroup = new THREE.Group();
  wedgeGroup.position.set(0, 0, -0.62);
  recoil.add(wedgeGroup);
  refs.breechWedge = wedgeGroup;
  add(wedgeGroup, T(chamfer(0.34, 0.36, 0.1, 0.015), {}), M.steel, 'gun.breech', '炮闩闩体');
  add(wedgeGroup, T(cyl(0.075, 0.075, 0.05, 18, 'z'), { pos: [0, 0, 0.06] }), M.steelDark, 'gun.breech', '闩体药室封口');
  add(wedgeGroup, T(box(0.08, 0.14, 0.06), { pos: [0.2, -0.02, 0] }), M.steelDark, 'gun.breech', '开闩手柄');
  // 击发机构 + 抽筒机
  add(recoil, T(box(0.1, 0.12, 0.14), { pos: [0.24, 0.16, -0.66] }), M.blackMetal, 'gun.breech', '电击发机构');
  add(recoil, T(box(0.05, 0.2, 0.06), { pos: [-0.2, -0.1, -0.66] }), M.steelDark, 'gun.breech', '抽筒机');

  /* ================================================================
   * 4. 并列机枪 7.62 mm（与火炮同轴，随俯仰）
   * ============================================================== */
  add(pivot, T(box(0.16, 0.16, 0.5), { pos: [0.34, -0.02, -0.1] }), M.blackMetal, 'weapon.coax', '7.62 mm 并列机枪机匣');
  add(pivot, T(cyl(0.022, 0.026, 0.7, 12, 'z'), { pos: [0.34, -0.02, 0.44] }), M.blackMetal, 'weapon.coax', '并列机枪枪管');
  add(pivot, T(pipe(0.05, 0.03, 0.1, 14, 'z'), { pos: [0.34, -0.02, 0.36] }), M.armorDark, 'weapon.coax', '并列机枪口套');
  add(pivot, T(chamfer(0.2, 0.22, 0.24, 0.02), { pos: [0.42, -0.14, -0.34] }), M.armorDark, 'weapon.coax', '并列机枪弹箱（250 发）');
  add(
    pivot,
    tubeFrom(
      [
        [0.42, -0.06, -0.3],
        [0.38, -0.02, -0.2],
        [0.34, -0.02, -0.14],
      ],
      0.02,
      12,
      6,
    ),
    M.brass,
    'weapon.coax',
    '并列机枪供弹机',
  );

  /* ================================================================
   * 5. 炮塔内火控/操纵（随火炮的部分）
   * ============================================================== */
  add(pivot, T(box(0.26, 0.2, 0.2), { pos: [-0.36, 0.2, -0.5] }), M.interiorMetal, 'fcs.stabilizer', '双向稳定器执行元件');
  add(pivot, T(boltRing(0.2, 14, 0.012, 0.014, 0), { rot: [Math.PI / 2, 0, 0], pos: [0, 0, -0.76] }), M.steel, 'gun.breech', '炮尾螺栓');

  return pivot;
}
