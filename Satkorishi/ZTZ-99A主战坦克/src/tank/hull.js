/**
 * 车体 (Hull)
 *
 * 结构分块遵循真车工程分区：
 *   前部 = 驾驶舱（驾驶员居左前）
 *   中部 = 战斗舱（炮塔座圈 + 转盘式自动装弹机）
 *   后部 = 动力舱（横置柴油机 + 传动 + 散热）
 *
 * 首上甲板为全宽 3.4 m 斜甲板（外伸覆盖履带上方），
 * 其上按公开影像布置"箭簇/楔形"排列的附加/反应装甲块（公开资料常称 FY 系列，
 * 此处只还原外形与排布，不涉及任何防护数值）；
 * 侧面前三块裙甲为带反应装甲的重型裙板，后四块为轻型橡胶裙板。
 */
import * as THREE from 'three';
import { D, GLACIS, TRACK_X } from './dims.js';
import {
  DEG,
  box,
  chamfer,
  boltRow,
  boltRing,
  cyl,
  extrudeZY,
  louvers,
  meshGrid,
  mergeAll,
  pipe,
  T,
  tubeFrom,
  wedge,
  projectUV,
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

/** 在首上甲板上摆一块反应装甲：s 沿斜面、x 横向、yaw 绕斜面法线 */
function eraOnGlacis(len, wid, thick, s, x, yaw = 0) {
  const g = chamfer(wid, thick, len, 0.012);
  T(g, { rot: [0, yaw, 0] });
  T(g, { rot: [-GLACIS.tilt, 0, 0] });
  const [z, y] = GLACIS.at(s, thick / 2 + 0.004);
  T(g, { pos: [x, y, z] });
  return g;
}

export function buildHull(M) {
  const g = new THREE.Group();
  g.name = 'hull';

  /* ================================================================
   * 1. 主舱（下车体）—— 底甲板 / 侧甲板 / 首下甲板 / 尾甲板
   * ============================================================== */
  const lowerProfile = [
    [D.frontLowerBottom[0], D.frontLowerBottom[1]], // 3.26, 0.47 首下甲板下缘
    [3.44, 0.66], // 首下甲板上缘
    [2.55, D.hullRoofY], // 前隔板（被首上甲板覆盖）
    [D.tailTopZ, D.hullRoofY], // 顶甲板后缘
    [-3.86, 0.62], // 尾甲板
    [D.tailBottomZ, 0.47], // 底甲板后缘
  ];
  add(
    g,
    extrudeZY(lowerProfile, D.tubHalfWidth * 2, { name: 'hull.lower' }),
    M.armor,
    'hull.lower',
    '主舱装甲盒体',
  );

  // 底甲板加厚（防雷底板）与纵向加强筋
  add(g, T(box(D.tubHalfWidth * 2 - 0.06, 0.05, 6.6), { pos: [0, 0.455, -0.2] }), M.armorDark, 'hull.lower', '底甲板');
  const ribs = [];
  for (const x of [-0.75, -0.25, 0.25, 0.75]) ribs.push(T(box(0.07, 0.05, 6.4), { pos: [x, 0.5, -0.2] }));
  add(g, mergeAll(ribs), M.interiorMetal, 'hull.lower', '底甲板加强筋');

  /* ================================================================
   * 2. 首上甲板（全宽斜甲板）+ 箭簇形反应装甲阵列
   * ============================================================== */
  const nrmZ = GLACIS.normal[0];
  const nrmY = GLACIS.normal[1];
  const glacisPlate = [
    [GLACIS.z0, GLACIS.y0],
    [GLACIS.z1, GLACIS.y1],
    [GLACIS.z1 - nrmZ * 0.3, GLACIS.y1 - nrmY * 0.3],
    [GLACIS.z0 - nrmZ * 0.3, GLACIS.y0 - nrmY * 0.3],
  ];
  add(g, extrudeZY(glacisPlate, D.overallWidth, { name: 'hull.glacis' }), M.armor, 'hull.glacis', '首上甲板');

  // 箭簇形反应装甲：中央 V 形双臂 + 内侧填充块 + 外侧列
  const eraBlocks = [];
  const armCount = 5;
  for (const side of [-1, 1]) {
    // 外臂：从车体中线前端向后外张开约 34°
    for (let i = 0; i < armCount; i++) {
      const s = 0.1 + i * 0.15;
      const x = side * (0.2 + i * 0.29);
      eraBlocks.push(eraOnGlacis(0.44, 0.3, 0.115, s, x, side * 32 * DEG));
    }
    // 内臂：更陡的第二道 V
    for (let i = 0; i < 4; i++) {
      const s = 0.34 + i * 0.15;
      const x = side * (0.17 + i * 0.24);
      eraBlocks.push(eraOnGlacis(0.4, 0.27, 0.115, s, x, side * 24 * DEG));
    }
    // 最外侧（履带上方翼板段）纵向排布
    for (let i = 0; i < 3; i++) {
      eraBlocks.push(eraOnGlacis(0.4, 0.26, 0.1, 0.2 + i * 0.24, side * 1.44, side * 6 * DEG));
    }
  }
  // 顶端尖块（箭头顶点）
  eraBlocks.push(eraOnGlacis(0.34, 0.3, 0.12, 0.06, 0, 0));
  add(g, mergeAll(eraBlocks), M.era, 'hull.era.front', '首上附加/反应装甲块');

  // 首上甲板边缘防浪板/挡水沿
  add(
    g,
    T(box(D.overallWidth, 0.05, 0.16), {
      rot: [-GLACIS.tilt, 0, 0],
      pos: [0, GLACIS.at(0.02, 0.14)[1], GLACIS.at(0.02, 0.14)[0]],
    }),
    M.armorDark,
    'hull.glacis',
    '首部挡水沿',
  );

  /* ================================================================
   * 3. 侧翼舱（履带上方）+ 挡泥板
   * ============================================================== */
  for (const side of [-1, 1]) {
    const sponsonProfile = [
      [1.6, D.sponsonBottomY],
      [1.6, D.hullRoofY],
      [D.tailTopZ, D.hullRoofY],
      [-3.86, D.sponsonBottomY],
    ];
    const sp = extrudeZY(sponsonProfile, D.halfWidth - D.tubHalfWidth, { name: 'hull.sponson' });
    // extrudeZY 沿 X 居中，平移到履带正上方
    sp.translate(side * TRACK_X, 0, 0);
    add(g, sp, M.armor, 'hull.sponson', side > 0 ? '右侧翼舱' : '左侧翼舱');

    // 前挡泥板
    add(
      g,
      T(chamfer(D.trackWidth + 0.06, 0.04, 0.42, 0.02), { rot: [12 * DEG, 0, 0], pos: [side * TRACK_X, 1.14, 1.78] }),
      M.armorDark,
      'hull.fender',
      '前挡泥板',
    );
    add(
      g,
      T(box(D.trackWidth, 0.3, 0.03), { rot: [-8 * DEG, 0, 0], pos: [side * TRACK_X, 1.0, 1.96] }),
      M.rubber,
      'hull.fender',
      '前挡泥橡胶帘',
    );
    // 后挡泥板
    add(
      g,
      T(chamfer(D.trackWidth + 0.06, 0.04, 0.34, 0.02), { rot: [-10 * DEG, 0, 0], pos: [side * TRACK_X, 1.13, -3.98] }),
      M.armorDark,
      'hull.fender',
      '后挡泥板',
    );
    add(
      g,
      T(box(D.trackWidth, 0.34, 0.03), { pos: [side * TRACK_X, 0.95, -4.12] }),
      M.rubber,
      'hull.fender',
      '后挡泥橡胶帘',
    );
  }

  /* ================================================================
   * 4. 裙甲：前 3 块重型（含反应装甲），后 4 块轻型
   * ============================================================== */
  for (const side of [-1, 1]) {
    const x = side * (D.halfWidth - 0.03);
    const panelZ = [1.28, 0.52, -0.24, -1.0, -1.76, -2.52, -3.28];
    panelZ.forEach((z, i) => {
      const heavy = i < 3;
      const w = 0.72;
      const h = heavy ? 0.82 : 0.78;
      const th = heavy ? 0.1 : 0.045;
      const geo = chamfer(th, h, w, 0.012);
      T(geo, { pos: [x, D.sponsonBottomY - h / 2 - 0.02, z] });
      add(g, geo, heavy ? M.era : M.skirt, heavy ? 'hull.era.side' : 'hull.skirt', heavy ? `重型裙甲 ${i + 1}` : `轻型裙甲 ${i + 1}`);
      // 铰链
      add(
        g,
        T(cyl(0.028, 0.028, 0.2, 8, 'z'), { pos: [x - side * 0.02, D.sponsonBottomY - 0.03, z] }),
        M.steelDark,
        heavy ? 'hull.era.side' : 'hull.skirt',
        '裙甲铰链',
      );
      if (heavy) {
        // 重型裙板外侧的反应装甲盒面板分格
        const cells = [];
        for (let k = 0; k < 2; k++)
          cells.push(T(chamfer(0.03, h * 0.42, w * 0.9, 0.008), { pos: [x + side * 0.06, D.sponsonBottomY - h / 2 - 0.02 + (k ? 0.2 : -0.2), z] }));
        add(g, mergeAll(cells), M.era, 'hull.era.side', '裙甲反应装甲盒');
      }
    });
  }

  /* ================================================================
   * 5. 动力舱顶盖：进气/散热百叶、排气、检修口
   * ============================================================== */
  // 顶甲板上的动力舱盖板边框
  add(
    g,
    T(box(2.3, 0.04, 2.0), { pos: [0, D.hullRoofY + 0.02, -2.75] }),
    M.armorDark,
    'hull.deck',
    '动力舱顶盖',
  );
  // 两侧散热进气百叶
  for (const side of [-1, 1]) {
    const lv = louvers(1.0, 0.75, 0.06, 9, 38 * DEG);
    lv.rotateX(Math.PI / 2);
    T(lv, { pos: [side * 1.02, D.hullRoofY + 0.05, -2.6] });
    add(g, lv, M.steelDark, 'power.radiator', side > 0 ? '右侧散热进气百叶' : '左侧散热进气百叶');
    add(
      g,
      T(box(1.06, 0.03, 0.81), { pos: [side * 1.02, D.hullRoofY + 0.085, -2.6] }),
      M.blackMetal,
      'power.radiator',
      '进气防护网框',
    );
    const net = meshGrid(1.0, 0.78, 0.07, 0.006);
    net.rotateX(-Math.PI / 2);
    T(net, { pos: [side * 1.02, D.hullRoofY + 0.09, -2.6] });
    add(g, net, M.steelDark, 'power.radiator', '进气防护网');
  }
  // 中央动力舱检修口 + 提手
  add(g, T(chamfer(1.0, 0.05, 0.9, 0.02), { pos: [0, D.hullRoofY + 0.045, -2.2] }), M.armorDark, 'hull.deck', '动力舱检修口');
  add(g, T(boltRing(0.5, 18, 0.016, 0.02, D.hullRoofY + 0.07), { pos: [0, 0, -2.2] }), M.steelDark, 'hull.deck', '检修口螺栓');
  for (const dz of [-0.3, 0.3]) {
    add(
      g,
      tubeFrom(
        [
          [-0.14, D.hullRoofY + 0.07, -2.2 + dz],
          [-0.14, D.hullRoofY + 0.14, -2.2 + dz],
          [0.14, D.hullRoofY + 0.14, -2.2 + dz],
          [0.14, D.hullRoofY + 0.07, -2.2 + dz],
        ],
        0.016,
        16,
        6,
      ),
      M.steelDark,
      'hull.deck',
      '检修口提手',
    );
  }
  // 排气：左后侧百叶排气口（99 系列排气布置于车体左后）
  const ex = louvers(0.62, 0.5, 0.05, 6, 30 * DEG);
  T(ex, { rot: [0, Math.PI / 2, 0], pos: [-D.halfWidth + 0.01, 1.24, -2.62] });
  add(g, ex, M.exhaust, 'power.exhaust', '排气百叶（左后）');
  add(
    g,
    T(box(0.06, 0.56, 0.68), { pos: [-D.halfWidth + 0.03, 1.24, -2.62] }),
    M.exhaust,
    'power.exhaust',
    '排气口框',
  );
  // 尾部烟幕（热烟幕）喷管
  add(
    g,
    T(cyl(0.035, 0.035, 0.3, 10, 'z'), { pos: [-1.2, 0.72, -3.95] }),
    M.exhaust,
    'power.exhaust',
    '热烟幕喷管',
  );

  /* ================================================================
   * 6. 尾甲板：拖钩、尾灯、油桶架、自救木
   * ============================================================== */
  add(
    g,
    T(chamfer(2.2, 0.72, 0.06, 0.02), { rot: [-8 * DEG, 0, 0], pos: [0, 0.86, -3.9] }),
    M.armorDark,
    'hull.rear',
    '尾甲板',
  );
  for (const side of [-1, 1]) {
    add(
      g,
      T(box(0.12, 0.16, 0.2), { pos: [side * 0.9, 0.62, -3.98] }),
      M.steelDark,
      'hull.rear',
      '拖钩座',
    );
    add(
      g,
      T(pipe(0.055, 0.032, 0.14, 12, 'z'), { pos: [side * 0.9, 0.62, -4.06] }),
      M.steel,
      'hull.rear',
      '拖钩',
    );
    // 尾灯
    add(g, T(cyl(0.05, 0.05, 0.05, 10, 'z'), { pos: [side * 1.34, 1.14, -3.96] }), M.blackMetal, 'hull.lights', '尾灯座');
    add(g, T(cyl(0.04, 0.04, 0.02, 10, 'z'), { pos: [side * 1.34, 1.14, -4.0] }), M.lampIR, 'hull.lights', '尾灯');
  }
  // 200 L 外挂油桶 ×2（尾部油桶架）
  for (const side of [-1, 1]) {
    const drumZ = -4.22;
    const drum = mergeAll([
      cyl(0.29, 0.29, 0.86, 22, 'z'),
      T(cyl(0.3, 0.3, 0.03, 22, 'z'), { pos: [0, 0, 0.24] }),
      T(cyl(0.3, 0.3, 0.03, 22, 'z'), { pos: [0, 0, -0.24] }),
    ]);
    T(drum, { pos: [side * 0.62, 1.0, drumZ] });
    add(g, drum, M.armorDark, 'hull.fueldrum', side > 0 ? '右外挂油桶 200 L' : '左外挂油桶 200 L');
    // 油桶托架
    add(
      g,
      T(box(0.66, 0.05, 0.06), { pos: [side * 0.62, 0.66, drumZ] }),
      M.steelDark,
      'hull.fueldrum',
      '油桶托架',
    );
    add(
      g,
      tubeFrom(
        [
          [side * 0.62 - 0.32, 0.68, drumZ],
          [side * 0.62 - 0.32, 1.32, drumZ],
          [side * 0.62 + 0.32, 1.32, drumZ],
          [side * 0.62 + 0.32, 0.68, drumZ],
        ],
        0.014,
        20,
        6,
      ),
      M.steelDark,
      'hull.fueldrum',
      '油桶固定带',
    );
    // 输油软管
    add(
      g,
      tubeFrom(
        [
          [side * 0.62, 1.0, drumZ + 0.44],
          [side * 0.5, 1.16, -3.98],
          [side * 0.34, 1.3, -3.8],
        ],
        0.022,
        18,
        6,
      ),
      M.rubber,
      'hull.fueldrum',
      '输油软管',
    );
  }

  /* ================================================================
   * 7. 驾驶舱：舱盖 / 潜望镜 / 操纵装置
   * ============================================================== */
  const driverX = D.crew.driver[0];
  // 舱口围圈（开在首上甲板与顶甲板交界靠左）
  add(
    g,
    T(pipe(0.34, 0.28, 0.09, 22, 'y'), { pos: [driverX, D.hullRoofY + 0.02, 1.72] }),
    M.armorDark,
    'hull.driver',
    '驾驶员舱口围圈',
  );
  const hatch = mergeAll([
    cyl(0.3, 0.31, 0.07, 22, 'y'),
    T(cyl(0.06, 0.06, 0.05, 10, 'y'), { pos: [0.16, 0.05, 0] }),
  ]);
  T(hatch, { pos: [driverX, D.hullRoofY + 0.09, 1.72] });
  add(g, hatch, M.armor, 'hull.driver', '驾驶员舱盖');
  add(g, T(boltRing(0.24, 12, 0.012, 0.012, D.hullRoofY + 0.125), { pos: [driverX, 0, 1.72] }), M.steelDark, 'hull.driver', '舱盖螺栓');
  // 3 具潜望镜（前视 + 左右斜视）
  [-0.3, 0, 0.3].forEach((off, i) => {
    const yaw = off * 45 * DEG;
    const px = driverX + off * 0.62;
    const pz = 1.52 - Math.abs(off) * 0.06;
    add(
      g,
      T(chamfer(0.19, 0.1, 0.12, 0.012), { rot: [0, -yaw, 0], pos: [px, D.hullRoofY + 0.07, pz] }),
      M.armorDark,
      'hull.driver',
      `驾驶员潜望镜 ${i + 1} 壳`,
    );
    add(
      g,
      T(box(0.15, 0.055, 0.012), { rot: [0, -yaw, 0], pos: [px + Math.sin(-yaw) * 0.062, D.hullRoofY + 0.075, pz + Math.cos(yaw) * 0.062] }),
      M.glass,
      'hull.driver',
      `驾驶员潜望镜 ${i + 1} 窗`,
    );
  });
  // 舱内：操纵台、方向操纵杆（方向盘式）、仪表板、座椅
  add(g, T(chamfer(0.6, 0.1, 0.36, 0.02), { pos: [driverX, 1.06, 2.05] }), M.interiorMetal, 'hull.driver', '驾驶操纵台');
  add(g, T(cyl(0.14, 0.14, 0.035, 16, 'z'), { rot: [24 * DEG, 0, 0], pos: [driverX, 1.2, 2.16] }), M.blackMetal, 'hull.driver', '方向操纵盘');
  add(g, T(box(0.44, 0.2, 0.05), { rot: [-20 * DEG, 0, 0], pos: [driverX, 1.24, 1.94] }), M.blackMetal, 'hull.driver', '仪表板');
  const seat = mergeAll([
    T(chamfer(0.42, 0.08, 0.4, 0.03), { pos: [0, 0, 0] }),
    T(chamfer(0.42, 0.5, 0.08, 0.03), { pos: [0, 0.28, -0.2] }),
  ]);
  T(seat, { pos: [driverX, 0.72, 2.36] });
  add(g, seat, M.interior, 'hull.driver', '驾驶员座椅');
  // 操纵踏板
  add(g, T(box(0.12, 0.03, 0.18), { rot: [-16 * DEG, 0, 0], pos: [driverX - 0.14, 0.56, 2.72] }), M.blackMetal, 'hull.driver', '制动踏板');
  add(g, T(box(0.12, 0.03, 0.18), { rot: [-16 * DEG, 0, 0], pos: [driverX + 0.14, 0.56, 2.72] }), M.blackMetal, 'hull.driver', '油门踏板');

  /* ================================================================
   * 8. 车灯 / 号灯 / 观察镜（首部右侧）
   * ============================================================== */
  const lampZ = GLACIS.at(0.24, 0.12);
  for (const [lx, kind] of [
    [1.02, 'white'],
    [1.32, 'ir'],
  ]) {
    add(
      g,
      T(pipe(0.11, 0.095, 0.14, 16, 'z'), { rot: [-GLACIS.tilt, 0, 0], pos: [lx, lampZ[1] + 0.06, lampZ[0] + 0.02] }),
      M.blackMetal,
      'hull.lights',
      kind === 'white' ? '前大灯壳' : '红外/夜视灯壳',
    );
    add(
      g,
      T(cyl(0.095, 0.095, 0.02, 16, 'z'), { rot: [-GLACIS.tilt, 0, 0], pos: [lx, lampZ[1] + 0.065, lampZ[0] + 0.09] }),
      kind === 'white' ? M.lamp : M.lampIR,
      'hull.lights',
      kind === 'white' ? '前大灯' : '红外灯',
    );
    // 灯护罩
    add(
      g,
      T(box(0.24, 0.02, 0.1), { rot: [-GLACIS.tilt - 20 * DEG, 0, 0], pos: [lx, lampZ[1] + 0.19, lampZ[0] + 0.03] }),
      M.armorDark,
      'hull.lights',
      '灯护罩',
    );
  }
  // 喇叭
  add(
    g,
    T(cyl(0.05, 0.075, 0.1, 14, 'z'), { rot: [-GLACIS.tilt, 0, 0], pos: [0.62, lampZ[1] + 0.02, lampZ[0] + 0.04] }),
    M.blackMetal,
    'hull.lights',
    '电喇叭',
  );

  /* ================================================================
   * 9. 车外附件：拖车钢缆、备份履带板、工具箱、自救木
   * ============================================================== */
  for (const side of [-1, 1]) {
    // 侧翼舱工具箱
    add(
      g,
      T(chamfer(0.26, 0.24, 0.9, 0.02), { pos: [side * (D.halfWidth - 0.14), D.hullRoofY + 0.13, -0.5] }),
      M.armorDark,
      'hull.tools',
      '车外工具箱',
    );
    add(
      g,
      T(box(0.02, 0.06, 0.86), { pos: [side * (D.halfWidth - 0.02), D.hullRoofY + 0.16, -0.5] }),
      M.steelDark,
      'hull.tools',
      '工具箱锁扣',
    );
    // 拖车钢缆（沿侧翼舱盘放）
    const cable = tubeFrom(
      [
        [side * 1.5, D.hullRoofY + 0.06, 1.3],
        [side * 1.58, D.hullRoofY + 0.06, 0.4],
        [side * 1.5, D.hullRoofY + 0.06, -0.9],
        [side * 1.58, D.hullRoofY + 0.06, -1.9],
        [side * 1.5, D.hullRoofY + 0.06, -2.9],
      ],
      0.026,
      64,
      7,
    );
    add(g, cable, M.steel, 'hull.tools', '拖车钢缆');
    // 钢缆卡箍
    const clamps = [];
    for (const cz of [1.0, -0.4, -1.8, -2.8]) clamps.push(T(box(0.1, 0.06, 0.05), { pos: [side * 1.54, D.hullRoofY + 0.05, cz] }));
    add(g, mergeAll(clamps), M.steelDark, 'hull.tools', '钢缆卡箍');
  }
  // 首上甲板备份履带板（常见于实车）
  const spares = [];
  for (let i = 0; i < 4; i++) {
    const [sz, sy] = GLACIS.at(0.62 + i * 0.075, 0.07);
    spares.push(T(chamfer(0.5, 0.05, 0.13, 0.01), { rot: [-GLACIS.tilt, 0, 0], pos: [-1.12, sy, sz] }));
  }
  add(g, mergeAll(spares), M.track, 'hull.tools', '备份履带板');
  // 自救木（尾部）
  add(
    g,
    T(cyl(0.09, 0.09, 1.5, 12, 'x'), { pos: [0, 1.5, -3.62] }),
    M.tarp,
    'hull.tools',
    '自救木',
  );
  // 潜渡通气筒（尾部立放）
  add(
    g,
    T(cyl(0.075, 0.075, 1.1, 14, 'z'), { rot: [8 * DEG, 0, 0], pos: [0.95, 1.52, -3.3] }),
    M.armorDark,
    'hull.tools',
    '潜渡通气筒',
  );

  /* ================================================================
   * 10. 炮塔座圈 / 火炮行军固定器
   * ============================================================== */
  add(
    g,
    T(pipe(D.turretRingR + 0.06, D.turretRingR - 0.02, 0.08, 48, 'y'), { pos: [0, D.hullRoofY + 0.02, D.turretZ] }),
    M.steelDark,
    'hull.ring',
    '炮塔座圈',
  );
  add(
    g,
    T(boltRing(D.turretRingR + 0.02, 40, 0.014, 0.02, D.hullRoofY + 0.06), { pos: [0, 0, D.turretZ] }),
    M.steel,
    'hull.ring',
    '座圈螺栓',
  );
  // 行军炮身固定器（车体后部，炮塔转向后方时抱住炮身）
  add(
    g,
    T(box(0.16, 0.42, 0.16), { pos: [0, D.hullRoofY + 0.23, -1.55] }),
    M.steelDark,
    'hull.gunlock',
    '火炮行军固定器立柱',
  );
  add(
    g,
    mergeAll([
      T(box(0.05, 0.26, 0.16), { pos: [-0.15, D.hullRoofY + 0.55, -1.55] }),
      T(box(0.05, 0.26, 0.16), { pos: [0.15, D.hullRoofY + 0.55, -1.55] }),
      T(box(0.35, 0.06, 0.16), { pos: [0, D.hullRoofY + 0.44, -1.55] }),
    ]),
    M.steelDark,
    'hull.gunlock',
    '固定器抱箍',
  );

  return g;
}
