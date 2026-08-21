/**
 * 炮塔 (Turret)
 *
 * 99A 的外形特征：焊接楔形炮塔 + 前部两块大倾角模块化复合装甲（"楔形附加装甲"），
 * 车长独立周视镜（右顶，猎-歼式火控的核心）、炮长主瞄准镜（左顶前），
 * 顶置 12.7 mm 高射机枪、两侧 76 mm 烟幕弹发射器、后部大尾栏筐。
 *
 * 局部坐标：原点 = 炮塔座圈中心，y=0 位于车体顶甲板平面，+Z 为炮口方向。
 * 炮塔组由 index.js 放到 (0, hullRoofY, turretZ) 并绕 Y 旋转实现方位机动。
 */
import * as THREE from 'three';
import { D } from './dims.js';
import {
  DEG,
  box,
  boltRing,
  boltRow,
  chamfer,
  cyl,
  loft,
  louvers,
  meshGrid,
  mergeAll,
  pipe,
  T,
  tubeFrom,
} from '../util/geom.js';

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

/** 炮塔壳体分层轮廓（俯视半轮廓 → 镜像成闭合轮廓） */
function shellSection(y, nose, c1, c2, c3, rear) {
  const half = [
    [nose[0], nose[1]],
    [c1[0], c1[1]],
    [c2[0], c2[1]],
    [c3[0], c3[1]],
    [rear[0], rear[1]],
  ];
  const pts = [];
  for (const p of half) pts.push([p[0], p[1]]);
  for (let i = half.length - 1; i >= 0; i--) pts.push([-half[i][0], half[i][1]]);
  return { y, pts };
}

export function buildTurret(M) {
  const g = new THREE.Group();
  g.name = 'turret';
  const refs = {};
  g.userData.refs = refs;

  const trunZ = D.trunnionZ - D.turretZ; // 1.15
  const trunY = D.trunnionY - D.hullRoofY; // 0.60

  /* ================================================================
   * 1. 炮塔壳体（分层放样：近垂直侧甲 + 前部楔形收缩 + 顶甲板内收）
   * ============================================================== */
  const sections = [
    shellSection(0.0, [0.42, 1.18], [1.12, 0.52], [1.24, -0.1], [1.2, -1.1], [0.95, -1.52]),
    shellSection(0.5, [0.42, 1.14], [1.14, 0.5], [1.26, -0.1], [1.22, -1.1], [0.97, -1.52]),
    shellSection(0.8, [0.4, 1.02], [1.1, 0.42], [1.22, -0.12], [1.18, -1.1], [0.95, -1.5]),
    shellSection(D.turretHeight, [0.34, 0.86], [1.0, 0.3], [1.12, -0.16], [1.08, -1.06], [0.88, -1.44]),
  ];
  add(g, loft(sections, { capBottom: true, capTop: true }), M.armor, 'turret.shell', '炮塔壳体（焊接）');

  // 座圈防护裙（炮塔底与车体之间的挡弹环）
  add(
    g,
    T(pipe(D.turretRingR + 0.03, D.turretRingR - 0.08, 0.1, 44, 'y'), { pos: [0, -0.05, 0] }),
    M.steelDark,
    'turret.ring',
    '炮塔座圈防护环',
  );

  /* ================================================================
   * 2. 前部楔形模块化复合装甲（99A 外形标志）
   * ============================================================== */
  for (const side of [-1, 1]) {
    // 颊甲外表面：从炮座开口边到侧面外角
    const a = [side * 0.42, 1.16];
    const b = [side * 1.13, 0.5];
    const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const len = Math.hypot(dx, dz);
    const nx = -dz / len;
    const nz = dx / len;
    const outX = side > 0 ? Math.abs(nx) : -Math.abs(nx);
    const outZ = Math.abs(nz);
    const yaw = Math.atan2(outX, outZ);
    const thick = 0.3;
    const cx = mid[0] + outX * (thick / 2);
    const cz = mid[1] + outZ * (thick / 2);

    // 主模块（上大块）
    const mod = chamfer(len * 1.02, 0.62, thick, 0.022);
    T(mod, { rot: [0, yaw, 0] });
    T(mod, { pos: [cx, 0.58, cz] });
    add(g, mod, M.armor, 'turret.armor.wedge', side > 0 ? '右前楔形复合装甲模块' : '左前楔形复合装甲模块');

    // 下块
    const mod2 = chamfer(len * 0.98, 0.3, thick * 0.86, 0.02);
    T(mod2, { rot: [0, yaw, 0] });
    T(mod2, { pos: [cx - outX * 0.02, 0.19, cz - outZ * 0.02] });
    add(g, mod2, M.armor, 'turret.armor.wedge', '前装甲下模块');

    // 模块固定螺栓（沿模块四边）
    const bolts = [];
    for (let i = 0; i < 6; i++) {
      const t = -0.44 + (i / 5) * 0.88;
      for (const yy of [0.86, 0.3]) {
        const px = cx + Math.cos(yaw) * t * len;
        const pz = cz - Math.sin(yaw) * t * len;
        bolts.push(T(cyl(0.017, 0.017, 0.02, 6, 'z'), { rot: [0, yaw, 0], pos: [px + outX * 0.16, yy, pz + outZ * 0.16] }));
      }
    }
    add(g, mergeAll(bolts), M.steelDark, 'turret.armor.wedge', '装甲模块固定螺栓');

    // 炮塔侧面附加间隔装甲板 + 储物箱
    add(
      g,
      T(chamfer(0.1, 0.52, 1.0, 0.02), { pos: [side * 1.3, 0.5, -0.45] }),
      M.armorDark,
      'turret.armor.side',
      side > 0 ? '右侧间隔装甲/储物箱' : '左侧间隔装甲/储物箱',
    );
    add(
      g,
      T(box(0.02, 0.44, 0.06), { pos: [side * 1.36, 0.5, -0.1] }),
      M.steelDark,
      'turret.armor.side',
      '箱体锁扣',
    );
    // 八一军徽贴花
    const emblem = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), M.emblem);
    emblem.position.set(side * 1.363, 0.56, -0.72);
    emblem.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
    emblem.userData.pid = 'turret.markings';
    emblem.name = '八一军徽';
    g.add(emblem);
    // 战术编号
    const num = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.24), M.number);
    num.position.set(side * 1.363, 0.24, -0.5);
    num.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
    num.userData.pid = 'turret.markings';
    num.name = '战术编号';
    g.add(num);
  }

  /* ================================================================
   * 3. 火炮开口 / 防盾框（防盾本体随火炮俯仰，见 gun.js）
   * ============================================================== */
  add(
    g,
    mergeAll([
      T(box(0.1, 0.86, 0.16), { pos: [-0.45, trunY, 1.12] }),
      T(box(0.1, 0.86, 0.16), { pos: [0.45, trunY, 1.12] }),
      T(box(1.0, 0.1, 0.16), { pos: [0, trunY + 0.42, 1.12] }),
      T(box(1.0, 0.1, 0.16), { pos: [0, trunY - 0.42, 1.12] }),
    ]),
    M.armorDark,
    'turret.aperture',
    '火炮开口装甲框',
  );
  // 耳轴座
  for (const side of [-1, 1]) {
    add(
      g,
      T(cyl(0.1, 0.1, 0.14, 16, 'x'), { pos: [side * 0.42, trunY, trunZ] }),
      M.steelDark,
      'gun.trunnion',
      '火炮耳轴座',
    );
  }

  /* ================================================================
   * 4. 顶甲板设备：车长周视镜 / 炮长主瞄 / 舱盖 / 激光告警
   * ============================================================== */
  const roofY = D.turretHeight;

  // --- 炮长主瞄准镜（左前顶，大型装甲外罩 + 前窗 + 上翻护盖）---
  const gs = new THREE.Group();
  gs.position.set(-0.56, roofY, 0.44);
  gs.name = 'gunnerSight';
  g.add(gs);
  add(gs, T(chamfer(0.52, 0.34, 0.62, 0.025), { pos: [0, 0.16, 0] }), M.armorDark, 'fcs.gunnerSight', '炮长主瞄准镜外罩');
  add(gs, T(box(0.4, 0.19, 0.02), { pos: [0, 0.19, 0.315] }), M.glass, 'fcs.gunnerSight', '主瞄准镜前窗（昼/热像）');
  add(gs, T(box(0.13, 0.15, 0.02), { pos: [0.2, 0.19, 0.315] }), M.optic, 'fcs.gunnerSight', '激光测距通道窗');
  add(gs, T(box(0.44, 0.02, 0.2), { rot: [-55 * DEG, 0, 0], pos: [0, 0.38, 0.28] }), M.armorDark, 'fcs.gunnerSight', '瞄准镜上翻护盖');
  add(gs, T(boltRow([-0.24, 0.02, 0.3], [0.24, 0.02, 0.3], 7, 0.012, 0.012, 'z'), {}), M.steelDark, 'fcs.gunnerSight', '外罩螺栓');

  // --- 车长独立周视镜（右顶，可旋转头部）---
  const pano = new THREE.Group();
  pano.position.set(0.62, roofY, 0.3);
  pano.name = 'panoSight';
  g.add(pano);
  refs.pano = pano;
  add(pano, T(cyl(0.2, 0.22, 0.18, 20, 'y'), { pos: [0, 0.09, 0] }), M.armorDark, 'fcs.panoSight', '周视镜基座');
  const panoHead = new THREE.Group();
  panoHead.position.y = 0.18;
  pano.add(panoHead);
  refs.panoHead = panoHead;
  add(panoHead, T(chamfer(0.34, 0.26, 0.3, 0.02), { pos: [0, 0.13, 0] }), M.armorDark, 'fcs.panoSight', '周视镜头部');
  add(panoHead, T(box(0.24, 0.13, 0.02), { pos: [0, 0.16, 0.15] }), M.glass, 'fcs.panoSight', '周视镜昼间窗');
  add(panoHead, T(box(0.1, 0.1, 0.02), { pos: [0.12, 0.06, 0.15] }), M.optic, 'fcs.panoSight', '周视镜热像窗');
  add(panoHead, T(cyl(0.03, 0.03, 0.08, 8, 'y'), { pos: [0, 0.3, 0] }), M.steelDark, 'fcs.panoSight', '周视镜顶罩');

  // --- 激光压制/告警组件（JD 系列，右前顶）---
  add(
    g,
    T(cyl(0.13, 0.14, 0.2, 18, 'y'), { pos: [0.66, roofY + 0.1, 0.78] }),
    M.armorDark,
    'fcs.laser',
    '激光压制装置基座',
  );
  add(
    g,
    T(chamfer(0.24, 0.18, 0.2, 0.02), { pos: [0.66, roofY + 0.28, 0.78] }),
    M.blackMetal,
    'fcs.laser',
    '激光发射头',
  );
  add(
    g,
    T(cyl(0.06, 0.06, 0.02, 14, 'z'), { pos: [0.66, roofY + 0.3, 0.885] }),
    M.optic,
    'fcs.laser',
    '激光出射窗',
  );
  // 激光告警接收器（四角）
  for (const [lx, lz] of [
    [1.0, 0.32],
    [-1.02, -0.72],
    [1.0, -0.96],
    [-1.04, 0.62],
  ]) {
    add(
      g,
      T(chamfer(0.11, 0.12, 0.11, 0.012), { pos: [lx, roofY + 0.05, lz] }),
      M.blackMetal,
      'fcs.lwr',
      '激光告警接收器',
    );
    add(
      g,
      T(cyl(0.038, 0.038, 0.02, 12, 'y'), { pos: [lx, roofY + 0.12, lz] }),
      M.optic,
      'fcs.lwr',
      '告警受光窗',
    );
  }

  // --- 车长舱盖（右）/ 炮长舱盖（左），带铰链枢轴以便开启动画 ---
  const makeHatch = (name, pid, x, z, r, side) => {
    const pivot = new THREE.Group();
    pivot.position.set(x + side * r, roofY + 0.06, z);
    g.add(pivot);
    const lid = new THREE.Group();
    lid.position.set(-side * r, 0, 0);
    pivot.add(lid);
    add(lid, T(cyl(r, r * 1.02, 0.07, 26, 'y'), { pos: [0, 0.035, 0] }), M.armor, pid, name);
    add(lid, T(boltRing(r * 0.7, 12, 0.013, 0.014, 0.075), {}), M.steelDark, pid, '舱盖加强螺栓');
    add(lid, T(box(0.16, 0.05, 0.05), { pos: [-side * (r * 0.55), 0.09, 0] }), M.steelDark, pid, '舱盖把手');
    // 围圈
    add(g, T(pipe(r + 0.055, r + 0.005, 0.1, 26, 'y'), { pos: [x, roofY + 0.02, z] }), M.armorDark, pid, '舱口围圈');
    return { pivot, lid, closed: 0, open: -side * 105 * DEG, side };
  };
  refs.hatches = [
    makeHatch('车长舱盖', 'crew.commander.hatch', 0.62, -0.38, 0.31, 1),
    makeHatch('炮长舱盖', 'crew.gunner.hatch', -0.58, -0.28, 0.29, -1),
  ];

  /* ================================================================
   * 5. 12.7 mm 高射机枪（车长舱口枪架）
   * ============================================================== */
  const mgMount = new THREE.Group();
  mgMount.position.set(0.62, roofY + 0.1, -0.38);
  g.add(mgMount);
  refs.mgMount = mgMount;
  add(mgMount, T(pipe(0.34, 0.31, 0.06, 26, 'y'), {}), M.steelDark, 'weapon.aamg', '高机环形枪架');
  const mgYaw = new THREE.Group();
  mgMount.add(mgYaw);
  refs.mgYaw = mgYaw;
  add(mgYaw, T(box(0.1, 0.26, 0.12), { pos: [0, 0.15, 0.3] }), M.steelDark, 'weapon.aamg', '枪架立柱');
  const mgPitch = new THREE.Group();
  mgPitch.position.set(0, 0.28, 0.3);
  mgYaw.add(mgPitch);
  refs.mgPitch = mgPitch;
  // 机枪本体：QJC-88 12.7 mm
  add(mgPitch, T(chamfer(0.11, 0.14, 0.62, 0.015), { pos: [0, 0, 0.05] }), M.blackMetal, 'weapon.aamg', '12.7 mm 高机机匣');
  add(mgPitch, T(cyl(0.026, 0.03, 0.92, 14, 'z'), { pos: [0, 0.01, 0.78] }), M.blackMetal, 'weapon.aamg', '高机枪管');
  const mgHoles = [];
  for (let i = 0; i < 10; i++) mgHoles.push(T(cyl(0.034, 0.034, 0.012, 10, 'z'), { pos: [0, 0.01, 0.45 + i * 0.055] }));
  add(mgPitch, mergeAll(mgHoles), M.blackMetal, 'weapon.aamg', '枪管散热套环');
  add(mgPitch, T(cyl(0.045, 0.038, 0.1, 12, 'z'), { pos: [0, 0.01, 1.28] }), M.blackMetal, 'weapon.aamg', '高机消焰器');
  add(mgPitch, T(chamfer(0.18, 0.2, 0.3, 0.02), { pos: [0.16, -0.02, -0.02] }), M.armorDark, 'weapon.aamg', '弹箱（50 发）');
  add(mgPitch, T(box(0.05, 0.16, 0.06), { rot: [-0.4, 0, 0], pos: [0, -0.12, -0.22] }), M.blackMetal, 'weapon.aamg', '握把');
  add(mgPitch, T(box(0.02, 0.09, 0.16), { pos: [0, 0.11, -0.1] }), M.blackMetal, 'weapon.aamg', '照门/瞄准具');
  // 高机护盾
  add(mgYaw, T(chamfer(0.5, 0.34, 0.03, 0.01), { rot: [10 * DEG, 0, 0], pos: [0, 0.3, 0.48] }), M.armorDark, 'weapon.aamg', '高机防护板');

  /* ================================================================
   * 6. 76 mm 烟幕弹发射器（两侧各 6 管，前上方发射）
   * ============================================================== */
  for (const side of [-1, 1]) {
    const bank = new THREE.Group();
    bank.position.set(side * 1.18, 0.66, -0.95);
    bank.rotation.y = side * -22 * DEG;
    bank.rotation.x = -18 * DEG;
    g.add(bank);
    const tubes = [];
    for (let row = 0; row < 2; row++) {
      for (let i = 0; i < 3; i++) {
        tubes.push(
          T(pipe(0.048, 0.038, 0.34, 14, 'z'), {
            pos: [(i - 1) * 0.115, row * 0.11, 0],
          }),
        );
      }
    }
    add(bank, mergeAll(tubes), M.steelDark, 'weapon.smoke', side > 0 ? '右烟幕弹发射器（6 管 76 mm）' : '左烟幕弹发射器（6 管 76 mm）');
    add(bank, T(box(0.4, 0.05, 0.1), { pos: [0, -0.08, -0.06] }), M.armorDark, 'weapon.smoke', '发射器底座');
    // 电缆
    add(
      bank,
      tubeFrom(
        [
          [-0.2, -0.06, -0.12],
          [-0.3, -0.14, -0.2],
          [-0.34, -0.3, -0.3],
        ],
        0.014,
        12,
        6,
      ),
      M.rubber,
      'weapon.smoke',
      '点火电缆',
    );
  }

  /* ================================================================
   * 7. 后部尾栏筐 / 附加储物
   * ============================================================== */
  const basket = new THREE.Group();
  basket.position.set(0, 0.28, -1.92);
  g.add(basket);
  const frame = [];
  // 底框
  frame.push(
    tubeFrom(
      [
        [-1.0, 0, 0.42],
        [-1.0, 0, -0.42],
        [1.0, 0, -0.42],
        [1.0, 0, 0.42],
      ],
      0.022,
      40,
      7,
    ),
  );
  // 顶框
  frame.push(
    tubeFrom(
      [
        [-1.0, 0.5, 0.42],
        [-1.0, 0.5, -0.42],
        [1.0, 0.5, -0.42],
        [1.0, 0.5, 0.42],
      ],
      0.022,
      40,
      7,
    ),
  );
  // 立柱
  for (const bx of [-1.0, -0.34, 0.34, 1.0]) {
    for (const bz of [0.42, -0.42]) frame.push(T(cyl(0.02, 0.02, 0.5, 8, 'y'), { pos: [bx, 0.25, bz] }));
  }
  // 与炮塔连接支臂
  for (const bx of [-0.8, 0, 0.8]) frame.push(T(cyl(0.024, 0.024, 0.5, 8, 'z'), { pos: [bx, 0.06, 0.62] }));
  add(basket, mergeAll(frame), M.steelDark, 'turret.basket', '尾栏筐框架');
  // 栅网侧壁
  const netBack = meshGrid(2.0, 0.48, 0.1, 0.008);
  T(netBack, { pos: [0, 0.25, -0.42] });
  add(basket, netBack, M.steelDark, 'turret.basket', '尾栏筐栅网（后）');
  for (const side of [-1, 1]) {
    const netSide = meshGrid(0.84, 0.48, 0.1, 0.008);
    netSide.rotateY(Math.PI / 2);
    T(netSide, { pos: [side * 1.0, 0.25, 0] });
    add(basket, netSide, M.steelDark, 'turret.basket', '尾栏筐栅网（侧）');
  }
  const netFloor = meshGrid(2.0, 0.84, 0.1, 0.008);
  netFloor.rotateX(-Math.PI / 2);
  T(netFloor, { pos: [0, 0.01, 0] });
  add(basket, netFloor, M.steelDark, 'turret.basket', '尾栏筐底网');
  // 筐内器材：帆布卷 + 弹药箱 + 油桶
  add(basket, T(cyl(0.16, 0.16, 0.9, 14, 'x'), { pos: [-0.42, 0.2, -0.12] }), M.tarp, 'turret.stowage', '帆布卷/伪装网');
  add(basket, T(chamfer(0.52, 0.32, 0.36, 0.02), { pos: [0.56, 0.18, -0.08] }), M.armorDark, 'turret.stowage', '器材箱');
  add(basket, T(cyl(0.14, 0.14, 0.42, 14, 'y'), { pos: [0.34, 0.22, 0.22] }), M.armorDark, 'turret.stowage', '润滑油桶');

  /* ================================================================
   * 8. 天线 / 传感器 / 吊耳
   * ============================================================== */
  // 两根鞭状电台天线
  for (const side of [-1, 1]) {
    add(
      g,
      T(cyl(0.008, 0.014, 1.85, 6, 'y'), { rot: [0, 0, side * 4 * DEG], pos: [side * 0.92, roofY + 0.95, -1.1] }),
      M.blackMetal,
      'fcs.antenna',
      '短波/超短波电台天线',
    );
    add(
      g,
      T(cyl(0.045, 0.05, 0.1, 12, 'y'), { pos: [side * 0.92, roofY + 0.05, -1.1] }),
      M.blackMetal,
      'fcs.antenna',
      '天线绝缘底座',
    );
  }
  // 卫星导航（北斗）天线
  add(g, T(cyl(0.1, 0.11, 0.06, 18, 'y'), { pos: [-0.2, roofY + 0.05, -1.24] }), M.blackMetal, 'fcs.antenna', '卫星导航天线');
  add(g, T(cyl(0.085, 0.085, 0.02, 18, 'y'), { pos: [-0.2, roofY + 0.09, -1.24] }), M.alu, 'fcs.antenna', '导航天线罩');
  // 气象/横风传感器（火控解算输入）
  add(g, T(cyl(0.016, 0.016, 0.52, 8, 'y'), { pos: [-0.86, roofY + 0.28, -1.3] }), M.steelDark, 'fcs.wind', '横风传感器立杆');
  add(g, T(cyl(0.05, 0.05, 0.1, 14, 'y'), { pos: [-0.86, roofY + 0.58, -1.3] }), M.blackMetal, 'fcs.wind', '横风传感器');
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    add(
      g,
      T(cyl(0.01, 0.01, 0.12, 6, 'x'), { rot: [0, a, 0], pos: [-0.86 + Math.cos(a) * 0.06, roofY + 0.62, -1.3 + Math.sin(a) * 0.06] }),
      M.blackMetal,
      'fcs.wind',
      '风杯支臂',
    );
  }
  // 吊装耳
  for (const [ex, ez] of [
    [0.86, 0.72],
    [-0.9, 0.66],
    [0.9, -1.2],
    [-0.9, -1.2],
  ]) {
    add(
      g,
      tubeFrom(
        [
          [ex - 0.07, roofY + 0.01, ez],
          [ex - 0.05, roofY + 0.11, ez],
          [ex + 0.05, roofY + 0.11, ez],
          [ex + 0.07, roofY + 0.01, ez],
        ],
        0.018,
        14,
        6,
      ),
      M.steel,
      'turret.shell',
      '吊装耳',
    );
  }
  // 顶甲板通风器
  add(g, T(cyl(0.13, 0.14, 0.09, 18, 'y'), { pos: [0.06, roofY + 0.045, -1.0] }), M.armorDark, 'turret.vent', '战斗舱通风器');
  const ventFins = louvers(0.2, 0.06, 0.2, 4, 0);
  T(ventFins, { pos: [0.06, roofY + 0.1, -1.0] });
  add(g, ventFins, M.steelDark, 'turret.vent', '通风器百叶');

  return g;
}
