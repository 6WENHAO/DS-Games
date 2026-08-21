/**
 * 内部结构 (Internals)
 *
 * 包含四部分，分别挂在不同父节点上以保证运动关系正确：
 *   buildAutoloader → 挂炮塔（转盘随炮塔回转，与真车一致）
 *   buildPowerpack  → 挂车体（后置动力舱：横置 V12 + 侧传动 + 散热）
 *   buildFightingCompartment → 挂炮塔（炮长/车长工位、显控、备弹）
 *   buildDriver / buildGunner / buildCommander → 驾驶员挂车体，炮长/车长挂炮塔
 *
 * 说明：动力舱内部布局按"横置动力包 + 两侧减速器"这一同源方案还原；
 * 1500 马力级涡轮增压柴油机（公开资料常称 150HB 系列）取自公开资料，
 * 细部管路、线束与附件位置为工程合理化推演，仅作结构示意。
 */
import * as THREE from 'three';
import { D } from './dims.js';
import { DEG, box, boltRing, chamfer, cyl, latheX, mergeAll, pipe, T, tubeFrom } from '../util/geom.js';

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

/* ================================================================== *
 * 1. 转盘式自动装弹机（22 发待发弹）
 * ================================================================== */
export function buildAutoloader(M) {
  const g = new THREE.Group();
  g.name = 'autoloader';
  const refs = {};
  g.userData.refs = refs;

  const floorY = -0.55; // 炮塔局部：转盘平面（世界 y ≈ 0.83）
  const SLOTS = 22;

  // 转盘（可旋转）
  const carousel = new THREE.Group();
  carousel.position.set(0, floorY, 0);
  g.add(carousel);
  refs.carousel = carousel;

  // 转盘底盘 + 中央立轴
  add(carousel, T(cyl(1.02, 1.02, 0.04, 44, 'y'), {}), M.interiorMetal, 'loader.carousel', '装弹机转盘底盘');
  add(carousel, T(pipe(0.16, 0.1, 0.5, 20, 'y'), { pos: [0, 0.25, 0] }), M.steelDark, 'loader.carousel', '转盘中央立轴');
  add(carousel, T(boltRing(0.9, 22, 0.014, 0.02, 0.03), {}), M.steel, 'loader.carousel', '转盘定位螺栓');

  // 22 个弹仓：弹丸在内、药筒在外，径向水平放置
  const shells = [];
  const charges = [];
  const trays = [];
  for (let i = 0; i < SLOTS; i++) {
    const a = (i / SLOTS) * Math.PI * 2;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const place = (geo, r, extraY = 0) => {
      T(geo, { rot: [0, a + Math.PI / 2, 0] });
      T(geo, { pos: [ca * r, 0.14 + extraY, sa * r] });
      return geo;
    };
    // 弹丸（含风帽，尾翼稳定脱壳穿甲弹示意）
    shells.push(
      place(
        mergeAll([
          cyl(0.0625, 0.0625, 0.34, 14, 'z'),
          T(cyl(0.045, 0.0625, 0.14, 14, 'z'), { pos: [0, 0, 0.24] }),
          T(cyl(0.012, 0.03, 0.06, 8, 'z'), { pos: [0, 0, 0.34] }),
        ]),
        0.44,
      ),
    );
    // 半可燃药筒
    charges.push(place(cyl(0.0625, 0.0625, 0.38, 14, 'z'), 0.86));
    // 弹仓托架
    trays.push(place(box(0.16, 0.05, 0.84), 0.66, -0.09));
  }
  add(carousel, mergeAll(shells), M.ammoShell, 'loader.ammo', '待发弹丸（22 发）');
  add(carousel, mergeAll(charges), M.ammoCharge, 'loader.ammo', '半可燃药筒（22 发）');
  add(carousel, mergeAll(trays), M.interiorMetal, 'loader.carousel', '弹仓托架');

  // 转盘驱动电机 + 减速器
  add(g, T(cyl(0.1, 0.1, 0.24, 16, 'z'), { pos: [-0.55, floorY + 0.3, -0.72] }), M.blackMetal, 'loader.drive', '转盘驱动电机');
  add(g, T(chamfer(0.2, 0.2, 0.18, 0.02), { pos: [-0.55, floorY + 0.3, -0.5] }), M.interiorMetal, 'loader.drive', '转盘减速器');

  // 推弹机 —— 位于炮尾正后方，与炮膛轴线同高（炮塔局部 y = 0.60）
  const rammer = new THREE.Group();
  rammer.position.set(0, 0.6, -1.45);
  g.add(rammer);
  refs.rammer = rammer;
  add(rammer, T(box(0.26, 0.16, 0.62), {}), M.interiorMetal, 'loader.rammer', '推弹机机体');
  const ramArm = new THREE.Group();
  rammer.add(ramArm);
  refs.ramArm = ramArm;
  add(ramArm, T(cyl(0.035, 0.035, 0.7, 12, 'z'), { pos: [0, 0, 0.42] }), M.steel, 'loader.rammer', '推弹杆');
  add(ramArm, T(cyl(0.06, 0.06, 0.06, 14, 'z'), { pos: [0, 0, 0.76] }), M.steelDark, 'loader.rammer', '推弹头');
  add(rammer, T(box(0.06, 0.06, 0.5), { pos: [-0.16, -0.12, 0.5] }), M.interiorMetal, 'loader.rammer', '推弹导轨');
  add(rammer, T(box(0.06, 0.06, 0.5), { pos: [0.16, -0.12, 0.5] }), M.interiorMetal, 'loader.rammer', '推弹导轨');

  // 提弹机（把弹从转盘提升到炮尾轴线：行程 1.05 m）
  const lifter = new THREE.Group();
  lifter.position.set(0, -0.45, -0.62);
  g.add(lifter);
  refs.lifter = lifter;
  refs.lifterLow = -0.45;
  refs.lifterHigh = 0.6;
  add(lifter, T(box(0.3, 0.06, 0.9), {}), M.interiorMetal, 'loader.lifter', '提弹机托盘');
  add(lifter, T(box(0.04, 0.3, 0.9), { pos: [-0.16, 0.16, 0] }), M.interiorMetal, 'loader.lifter', '托盘侧板');
  add(lifter, T(box(0.04, 0.3, 0.9), { pos: [0.16, 0.16, 0] }), M.interiorMetal, 'loader.lifter', '托盘侧板');
  add(g, T(cyl(0.05, 0.05, 1.32, 12, 'y'), { pos: [-0.24, 0.02, -0.62] }), M.steel, 'loader.lifter', '提弹机导轨');
  add(g, T(cyl(0.05, 0.05, 1.32, 12, 'y'), { pos: [0.24, 0.02, -0.62] }), M.steel, 'loader.lifter', '提弹机导轨');

  // 抛壳口（炮塔后顶部）+ 抛壳导槽
  add(g, T(box(0.3, 0.04, 0.34), { rot: [-20 * DEG, 0, 0], pos: [0, 0.9, -1.3] }), M.armorDark, 'loader.eject', '抛壳窗盖');
  add(g, T(box(0.26, 0.24, 0.5), { rot: [18 * DEG, 0, 0], pos: [0, 0.45, -1.2] }), M.interiorMetal, 'loader.eject', '抛壳导槽');

  return g;
}

/* ================================================================== *
 * 2. 动力传动（后置横置 V12 + 两侧传动 + 散热）
 * ================================================================== */
export function buildPowerpack(M) {
  const g = new THREE.Group();
  g.name = 'powerpack';
  const [ex, ey, ez] = D.engineCenter;

  /* --- 隔板（战斗舱/动力舱防火隔断）--- */
  add(
    g,
    T(box(D.tubHalfWidth * 2 - 0.04, 0.85, 0.05), { pos: [0, 0.92, -1.72] }),
    M.interiorMetal,
    'power.bulkhead',
    '动力舱防火隔板',
  );

  /* --- V12 缸体：曲轴横置（沿 X），两列缸 60° 夹角 --- */
  add(g, T(chamfer(1.32, 0.42, 0.62, 0.04), { pos: [ex, ey - 0.24, ez] }), M.engineBlock, 'power.engine', '曲轴箱');
  for (const side of [-1, 1]) {
    const bank = new THREE.Group();
    bank.position.set(ex, ey, ez);
    bank.rotation.x = side * 30 * DEG;
    g.add(bank);
    add(bank, T(chamfer(1.26, 0.34, 0.3, 0.03), { pos: [0, 0.26, 0] }), M.engineBlock, 'power.engine', '气缸体');
    // 6 个缸盖
    const heads = [];
    for (let i = 0; i < 6; i++) heads.push(T(chamfer(0.17, 0.14, 0.26, 0.02), { pos: [-0.525 + i * 0.21, 0.48, 0] }));
    add(bank, mergeAll(heads), M.engineBlock, 'power.engine', '气缸盖 ×6');
    // 排气歧管
    const manifold = [];
    for (let i = 0; i < 6; i++) manifold.push(T(cyl(0.045, 0.045, 0.16, 10, 'z'), { pos: [-0.525 + i * 0.21, 0.44, 0.2] }));
    manifold.push(T(cyl(0.06, 0.06, 1.2, 14, 'x'), { pos: [0, 0.44, 0.3] }));
    add(bank, mergeAll(manifold), M.engineHot, 'power.exhaustManifold', '排气歧管');
  }
  // 进气总管（V 形夹角内）
  add(g, T(cyl(0.09, 0.09, 1.2, 16, 'x'), { pos: [ex, ey + 0.5, ez] }), M.engineBlock, 'power.intake', '进气总管');

  /* --- 涡轮增压器 ×2（两端）--- */
  for (const side of [-1, 1]) {
    const tx = ex + side * 0.72;
    add(g, T(cyl(0.13, 0.16, 0.18, 18, 'x'), { pos: [tx, ey + 0.34, ez + 0.26] }), M.alu, 'power.turbo', '涡轮增压器蜗壳');
    add(g, T(cyl(0.09, 0.09, 0.14, 16, 'x'), { pos: [tx + side * 0.16, ey + 0.34, ez + 0.26] }), M.steel, 'power.turbo', '压气机端');
    add(
      g,
      tubeFrom(
        [
          [tx, ey + 0.34, ez + 0.34],
          [tx, ey + 0.52, ez + 0.5],
          [ex + side * 0.4, ey + 0.55, ez + 0.2],
        ],
        0.055,
        16,
        8,
      ),
      M.alu,
      'power.turbo',
      '增压空气管',
    );
  }

  /* --- 空气滤清器 --- */
  for (const side of [-1, 1]) {
    add(
      g,
      T(cyl(0.17, 0.17, 0.5, 18, 'x'), { pos: [ex + side * 0.62, ey + 0.62, ez - 0.5] }),
      M.interiorMetal,
      'power.airFilter',
      '空气滤清器',
    );
  }

  /* --- 散热器 + 风扇（两侧，对应顶甲板百叶）--- */
  for (const side of [-1, 1]) {
    const rx = side * 0.72;
    add(g, T(box(0.42, 0.5, 0.9), { pos: [rx, 1.0, -2.6] }), M.copper, 'power.radiator', '水散热器芯');
    const fins = [];
    for (let i = 0; i < 14; i++) fins.push(T(box(0.44, 0.006, 0.88), { pos: [rx, 0.78 + i * 0.034, -2.6] }));
    add(g, mergeAll(fins), M.copper, 'power.radiator', '散热片');
    // 冷却风扇（立轴）
    const fanHub = new THREE.Group();
    fanHub.position.set(rx, 1.28, -2.6);
    g.add(fanHub);
    const blades = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const b = box(0.3, 0.02, 0.09);
      T(b, { rot: [0, 0, 22 * DEG] });
      T(b, { rot: [0, a, 0] });
      T(b, { pos: [Math.cos(a) * 0.2, 0, Math.sin(a) * 0.2] });
      blades.push(b);
    }
    add(fanHub, mergeAll(blades), M.alu, 'power.fan', '冷却风扇叶轮');
    add(fanHub, T(cyl(0.08, 0.08, 0.1, 14, 'y'), {}), M.steelDark, 'power.fan', '风扇轮毂');
    // 冷却水管
    add(
      g,
      tubeFrom(
        [
          [rx, 0.8, -2.15],
          [rx * 0.7, 0.9, -1.95],
          [ex + rx * 0.4, ey - 0.1, ez + 0.35],
        ],
        0.05,
        18,
        8,
      ),
      M.rubber,
      'power.coolant',
      '冷却水管',
    );
  }

  /* --- 传动：液力机械综合传动装置（两侧）--- */
  for (const side of [-1, 1]) {
    add(
      g,
      T(chamfer(0.46, 0.5, 0.8, 0.04), { pos: [side * 0.66, 0.85, -3.32] }),
      M.engineBlock,
      'power.transmission',
      side > 0 ? '右侧液力机械传动箱' : '左侧液力机械传动箱',
    );
    // 与发动机相连的传动轴
    add(g, T(cyl(0.06, 0.06, 0.6, 12, 'x'), { pos: [side * 0.35, 0.85, -3.05] }), M.steel, 'power.transmission', '传动轴');
    add(
      g,
      T(cyl(0.075, 0.075, 0.5, 14, 'z'), { pos: [side * 0.66, 0.85, -2.9] }),
      M.steel,
      'power.transmission',
      '输入轴/联轴器',
    );
    // 液力变矩器
    add(
      g,
      T(
        latheX(
          [
            [0, -0.1],
            [0.16, -0.1],
            [0.2, -0.04],
            [0.2, 0.04],
            [0.16, 0.1],
            [0, 0.1],
          ],
          18,
        ),
        { pos: [side * 0.66, 0.85, -3.32] },
      ),
      M.alu,
      'power.torqueConv',
      '液力变矩器',
    );
  }

  /* --- 辅助动力装置 APU（左后角）--- */
  add(g, T(chamfer(0.44, 0.34, 0.5, 0.03), { pos: [-1.05, 0.75, -3.4] }), M.interiorMetal, 'power.apu', '辅助动力装置 APU');
  add(g, T(cyl(0.07, 0.07, 0.2, 12, 'y'), { pos: [-1.05, 1.02, -3.4] }), M.exhaust, 'power.apu', 'APU 排气管');

  /* --- 燃油箱：车体两侧翼舱 + 前部 --- */
  for (const side of [-1, 1]) {
    add(
      g,
      T(chamfer(0.5, 0.2, 2.6, 0.03), { pos: [side * 1.4, 1.24, -0.4] }),
      M.interiorMetal,
      'power.fuelTank',
      side > 0 ? '右翼舱燃油箱' : '左翼舱燃油箱',
    );
  }
  add(g, T(chamfer(0.5, 0.5, 0.7, 0.03), { pos: [0.55, 0.8, 2.2] }), M.interiorMetal, 'power.fuelTank', '前部燃油箱');
  // 燃油管路
  add(
    g,
    tubeFrom(
      [
        [0.55, 0.9, 1.85],
        [0.9, 0.85, 0.5],
        [0.9, 0.85, -1.6],
        [0.4, 0.9, -2.3],
      ],
      0.028,
      36,
      7,
    ),
    M.steelDark,
    'power.fuelTank',
    '燃油管路',
  );

  /* --- 蓄电池组 + 电气箱 --- */
  const batts = [];
  for (let i = 0; i < 4; i++)
    batts.push(
      T(chamfer(0.24, 0.22, 0.34, 0.02), { pos: [-0.85 + (i % 2) * 0.26, 0.62, 1.5 - Math.floor(i / 2) * 0.36] }),
    );
  add(g, mergeAll(batts), M.blackMetal, 'power.battery', '蓄电池组（24 V）');
  add(g, T(chamfer(0.36, 0.3, 0.24, 0.02), { pos: [-0.85, 0.95, 1.1] }), M.interiorMetal, 'power.electric', '配电箱');

  /* --- 三防装置 / 灭火抑爆 --- */
  add(g, T(cyl(0.14, 0.14, 0.44, 16, 'z'), { pos: [0.85, 0.72, -1.35] }), M.interiorMetal, 'aux.nbc', '三防（超压/滤毒）装置');
  add(g, T(cyl(0.09, 0.09, 0.36, 14, 'y'), { pos: [-0.9, 0.7, -1.45] }), M.copper, 'aux.fireSupp', '灭火抑爆瓶');
  add(g, T(cyl(0.09, 0.09, 0.36, 14, 'y'), { pos: [0.95, 0.7, 1.9] }), M.copper, 'aux.fireSupp', '灭火抑爆瓶');

  return g;
}

/* ================================================================== *
 * 3. 战斗舱内部（炮塔内工位、显控、备弹）
 * ================================================================== */
export function buildFightingCompartment(M) {
  const g = new THREE.Group();
  g.name = 'fighting';

  // 炮塔吊篮地板
  add(g, T(cyl(1.0, 1.0, 0.03, 40, 'y'), { pos: [0, -0.62, 0] }), M.interiorMetal, 'crew.floor', '炮塔吊篮地板');
  add(g, T(pipe(1.0, 0.96, 0.6, 40, 'y'), { pos: [0, -0.32, 0] }), M.interiorMetal, 'crew.floor', '吊篮围壁');

  // --- 炮长工位（左）---
  add(g, T(chamfer(0.42, 0.08, 0.4, 0.02), { pos: [-0.62, -0.33, -0.1] }), M.interior, 'crew.gunner.station', '炮长座椅坐垫');
  add(g, T(chamfer(0.42, 0.44, 0.08, 0.02), { pos: [-0.62, -0.1, -0.3] }), M.interior, 'crew.gunner.station', '炮长座椅靠背');
  add(g, T(chamfer(0.34, 0.26, 0.16, 0.02), { pos: [-0.66, 0.16, 0.34] }), M.blackMetal, 'crew.gunner.station', '炮长显示器');
  add(g, T(box(0.3, 0.16, 0.02), { pos: [-0.66, 0.16, 0.42] }), M.optic, 'crew.gunner.station', '火控显示屏');
  // 双手操纵台
  for (const dx of [-0.16, 0.16]) {
    add(
      g,
      T(cyl(0.035, 0.035, 0.18, 10, 'y'), { rot: [0.2, 0, 0], pos: [-0.62 + dx, 0.02, 0.16] }),
      M.blackMetal,
      'crew.gunner.station',
      '操纵台握把',
    );
  }
  add(g, T(box(0.42, 0.06, 0.22), { pos: [-0.62, -0.08, 0.16] }), M.interiorMetal, 'crew.gunner.station', '炮长操纵台');

  // --- 车长工位（右）---
  add(g, T(chamfer(0.42, 0.08, 0.4, 0.02), { pos: [0.66, -0.33, -0.38] }), M.interior, 'crew.commander.station', '车长座椅坐垫');
  add(
    g,
    T(chamfer(0.42, 0.44, 0.08, 0.02), { pos: [0.66, -0.1, -0.58] }),
    M.interior,
    'crew.commander.station',
    '车长座椅靠背',
  );
  add(g, T(chamfer(0.36, 0.28, 0.16, 0.02), { pos: [0.7, 0.14, 0.06] }), M.blackMetal, 'crew.commander.station', '车长指挥终端');
  add(g, T(box(0.32, 0.18, 0.02), { pos: [0.7, 0.14, 0.14] }), M.optic, 'crew.commander.station', '战场态势屏');
  add(g, T(box(0.4, 0.06, 0.2), { pos: [0.66, -0.08, -0.02] }), M.interiorMetal, 'crew.commander.station', '车长操纵台');
  // 电台
  add(g, T(chamfer(0.3, 0.24, 0.22, 0.02), { pos: [0.86, 0.2, -0.9] }), M.blackMetal, 'fcs.radio', '车载电台主机');
  add(g, T(chamfer(0.24, 0.14, 0.18, 0.02), { pos: [0.86, 0.44, -0.9] }), M.blackMetal, 'fcs.radio', '数据链终端');

  // --- 火控计算机 / 稳定器电箱 ---
  add(g, T(chamfer(0.34, 0.3, 0.24, 0.02), { pos: [-0.92, 0.2, -0.7] }), M.interiorMetal, 'fcs.computer', '火控计算机');
  add(g, T(chamfer(0.26, 0.24, 0.2, 0.02), { pos: [-0.92, 0.2, -1.02] }), M.blackMetal, 'fcs.stabilizer', '稳定器控制盒');

  // --- 车体内备弹（非待发弹）---
  const rackShells = [];
  const rackCharges = [];
  for (let i = 0; i < 10; i++) {
    const zz = -0.2 + (i % 5) * 0.16;
    const yy = -0.5 + Math.floor(i / 5) * 0.16;
    rackShells.push(T(cyl(0.0625, 0.0625, 0.44, 12, 'z'), { pos: [0.9, yy, zz] }));
    rackCharges.push(T(cyl(0.0625, 0.0625, 0.38, 12, 'z'), { pos: [-0.9, yy, zz] }));
  }
  add(g, mergeAll(rackShells), M.ammoShell, 'loader.reserveAmmo', '车内备弹（弹丸）');
  add(g, mergeAll(rackCharges), M.ammoCharge, 'loader.reserveAmmo', '车内备弹（药筒）');
  add(g, T(box(0.16, 0.44, 0.9), { pos: [0.98, -0.42, 0.05] }), M.interiorMetal, 'loader.reserveAmmo', '弹药固定架');
  add(g, T(box(0.16, 0.44, 0.9), { pos: [-0.98, -0.42, 0.05] }), M.interiorMetal, 'loader.reserveAmmo', '弹药固定架');

  // --- 通风/滤毒进气 + 舱内照明 ---
  add(g, T(cyl(0.09, 0.09, 0.3, 12, 'z'), { pos: [0.5, 0.5, -1.2] }), M.interiorMetal, 'aux.nbc', '舱内送风管');
  for (const [lx, lz] of [
    [-0.4, 0.5],
    [0.4, -0.9],
  ]) {
    add(g, T(box(0.16, 0.05, 0.08), { pos: [lx, 0.86, lz] }), M.lamp, 'aux.light', '舱内照明灯');
  }

  return g;
}

/* ================================================================== *
 * 4. 乘员（低模人形，用于展示人机尺度）
 * ================================================================== */
/**
 * @param recline 上体后倾角（度）—— 上体绕髋部真实转动，头部会随之下沉后移
 * @param shin    小腿相对水平的下折角（度）：炮塔内乘员脚踩地板 ≈ 72°，
 *                驾驶员半躺蹬踏板 ≈ 18°
 */
function crewFigure(M, recline = 12, shin = 72) {
  const g = new THREE.Group();
  const r = recline * DEG;
  const lower = [];
  const upper = [];
  const upperSkin = [];

  // 骨盆（不随上体转动）
  lower.push(T(chamfer(0.36, 0.18, 0.3, 0.06), { pos: [0, 0.04, 0.02] }));
  // 上体（躯干）—— 先竖直建好，最后整体绕髋部旋转
  upper.push(T(chamfer(0.4, 0.56, 0.24, 0.08), { pos: [0, 0.34, 0] }));

  const kneeZ = 0.26 + Math.cos(8 * DEG) * 0.22;
  const kneeY = 0.06 + Math.sin(8 * DEG) * 0.22;
  for (const side of [-1, 1]) {
    // 大腿（前伸）
    const thigh = cyl(0.085, 0.09, 0.44, 10, 'z');
    T(thigh, { rot: [-8 * DEG, 0, 0] });
    T(thigh, { pos: [side * 0.11, 0.06, 0.26] });
    lower.push(thigh);
    // 小腿（按 shin 角下折）
    const sh = shin * DEG;
    const shinGeo = cyl(0.07, 0.08, 0.44, 10, 'z');
    T(shinGeo, { rot: [-sh, 0, 0] });
    T(shinGeo, { pos: [side * 0.11, kneeY - Math.sin(sh) * 0.22, kneeZ + Math.cos(sh) * 0.22] });
    lower.push(shinGeo);
    // 靴
    lower.push(
      T(chamfer(0.12, 0.1, 0.24, 0.03), {
        pos: [side * 0.11, kneeY - Math.sin(sh) * 0.44 - 0.02, kneeZ + Math.cos(sh) * 0.44 + 0.06],
      }),
    );
    // 上臂 / 前臂 / 手（属于上体）
    const arm = cyl(0.06, 0.065, 0.3, 10, 'z');
    T(arm, { rot: [-40 * DEG, 0, 0] });
    T(arm, { pos: [side * 0.22, 0.46, 0.1] });
    upper.push(arm);
    const fore = cyl(0.05, 0.055, 0.28, 10, 'z');
    T(fore, { rot: [-72 * DEG, 0, 0] });
    T(fore, { pos: [side * 0.22, 0.34, 0.3] });
    upper.push(fore);
    upperSkin.push(T(chamfer(0.08, 0.07, 0.12, 0.03), { pos: [side * 0.22, 0.28, 0.44] }));
  }

  // 颈 + 头（上体）
  upperSkin.push(T(cyl(0.055, 0.06, 0.1, 10, 'y'), { pos: [0, 0.66, 0] }));
  const head = new THREE.SphereGeometry(0.105, 18, 14);
  head.scale(0.92, 1.1, 1);
  T(head, { pos: [0, 0.78, 0] });
  upperSkin.push(head);

  // 头盔 + 送受话器（上体）
  const helm = new THREE.SphereGeometry(0.125, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.62);
  T(helm, { pos: [0, 0.79, 0] });
  const gear = mergeAll([
    T(cyl(0.05, 0.05, 0.03, 12, 'x'), { pos: [0.11, 0.78, 0] }),
    T(cyl(0.05, 0.05, 0.03, 12, 'x'), { pos: [-0.11, 0.78, 0] }),
    T(cyl(0.012, 0.012, 0.12, 6, 'z'), { rot: [0.4, 0, 0], pos: [0.1, 0.72, 0.06] }),
  ]);

  // 上体整体绕髋部（原点）后倾
  const recl = (geo) => T(geo, { rot: [r, 0, 0] });
  const uniformGeo = mergeAll([...lower, ...upper.map(recl)]);
  const skinGeo = mergeAll(upperSkin.map(recl));
  add(g, uniformGeo, M.uniform, 'crew.body', '乘员（作训服）');
  add(g, skinGeo, M.skin, 'crew.body', '乘员（头/手）');
  add(g, recl(helm), M.helmet, 'crew.body', '坦克帽');
  add(g, recl(gear), M.blackMetal, 'crew.body', '送受话器');
  return g;
}

/** 驾驶员（挂车体）：大角度后倾半躺、双腿近水平蹬踏板 —— 与低矮车体相适应 */
export function buildDriver(M) {
  const g = crewFigure(M, 46, 18);
  g.name = 'crewDriver';
  g.position.set(D.crew.driver[0], D.crew.driver[1] + 0.06, D.crew.driver[2] - 0.1);
  g.traverse((o) => {
    if (o.isMesh) o.userData.pid = 'crew.driver.body';
  });
  return g;
}

/** 炮长（挂炮塔） */
export function buildGunner(M) {
  const g = crewFigure(M, 10, 72);
  g.name = 'crewGunner';
  g.position.set(D.crew.gunner[0], D.crew.gunner[1] + 0.04, D.crew.gunner[2]);
  g.rotation.y = 6 * DEG;
  g.traverse((o) => {
    if (o.isMesh) o.userData.pid = 'crew.gunner.body';
  });
  return g;
}

/** 车长（挂炮塔） */
export function buildCommander(M) {
  const g = crewFigure(M, 8, 72);
  g.name = 'crewCommander';
  g.position.set(D.crew.commander[0], D.crew.commander[1] + 0.04, D.crew.commander[2]);
  g.rotation.y = -6 * DEG;
  g.traverse((o) => {
    if (o.isMesh) o.userData.pid = 'crew.commander.body';
  });
  return g;
}
