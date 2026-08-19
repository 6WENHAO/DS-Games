/**
 * lube.js —— 润滑系统（Lubrication System）
 * ------------------------------------------------------------------
 * 全流程：油底壳 → 集滤器 → 吸油管 → 外啮合齿轮式机油泵（含限压阀）
 *        → 机油冷却器（机油-冷却液）→ 机油滤清器（纸质滤芯 + 旁通阀）
 *        → 主油道 φ16（Y=118 / Z=72 沿 X 贯通）
 *        → ①5 条斜油道 → 5 道主轴承 → 曲轴内部斜油道 → 连杆轴承
 *          ②竖直油道 → 缸盖 → 摇臂轴内部油道 → 8 个摇臂
 *          ③凸轮轴轴承 / 挺柱供油支路
 *
 * 单位 1 unit = 1 mm；坐标 +X 后端(飞轮) / −X 前端(正时齿轮室) / +Y 上 / +Z 排气侧
 * 只使用 three.js 内置几何 + core/util.js，不修改任何 core 文件。
 */
import * as THREE from 'three';
import * as U from '../core/util.js';

const D2R = Math.PI / 180;

/* ================= 本模块设计常量 ================= */

/** 泵轴转速 / 曲轴转速：曲轴前端齿轮 z=22 → 机油泵驱动齿轮 z=18（22/18 ≈ 1.2） */
const RATIO = 1.2;
/** 限压（旁通）阀开启压力 MPa */
const RELIEF_SET = 0.45;
/** 滤清器旁通阀开启压差 MPa */
const BYPASS_SET = 0.15;
/** 限压阀钢球最大升程 mm */
const BALL_LIFT = 3.5;
/** 限压阀弹簧自由长（示意）mm */
const RELIEF_SPRING_LEN = 22;
/** 旁通阀阀片最大升程 mm / 弹簧长 */
const BYPASS_LIFT = 3.0;
const BYPASS_SPRING_LEN = 14;

/** 泵内啮合齿轮：模数 3 × 12 齿 → 分度圆 φ36、齿顶圆 φ42、齿宽 26 */
const PG = { m: 3, z: 12, w: 26, od: 42 };
/** 理论排量 q = 2π·m²·z·b  (cm³/r) ≈ 17.6 */
const DISP = (2 * Math.PI * PG.m * PG.m * PG.z * PG.w) / 1000;
/** 容积效率 / 机械效率 */
const VOL_EFF = 0.90;
const MECH_EFF = 0.85;

/** 机油泵空间（油底壳内，X ≈ −283 / Y ≈ −118；避开油底壳前端壁 X = −317±3） */
const PUMP = {
  driveY: -100,      // 主动轴中心（与曲轴齿轮啮合：中心距 100 = 55 + 45）
  idleY: -136,       // 从动齿轮中心（齿轮中心距 36 = 18 + 18）
  bodyR: 32,         // 泵体两个凸台外半径
  cavityR: 21.2,     // 齿轮腔半径（齿顶 21 + 0.2 径向间隙）
  gearX: -283,       // 齿轮宽度中心
  bodyX: -283,       // 齿轮腔（沿 X 厚 30：−298…−268）
  backX: -264,       // 泵体后壁（−268…−260）
  coverX: -302,      // 泵盖（−306…−298）
  shaftDia: 20,
  driveGearX: -372,  // = P.timing.gearPlaneX：与曲轴正时齿轮同一 X 平面
  driveGearZ: 18, driveGearM: 5, driveGearW: 20,
};

/** 限压阀（装在泵体 +Z 侧凸台内，阀轴线沿 Z） */
const RV = { x: PUMP.gearX, y: -118, ballZ: 26, ballR: 6, plugZ: 54 };

/** 集滤器（网式，悬于油底壳前部加深集油坑上方 Y ≈ −180） */
const STRAINER = { x: -240, y: -178, od: 112 };

/** 机油冷却器（板翅式，X ≈ −60 / Z ≈ +160 / Y 0…100） */
const COOLER = {
  x: -60, y: 50, z: 162,
  lenX: 220, hY: 100, depZ: 66,
  plates: 8, plateGap: 11, plateY0: 12,
};

/** 机油滤清器（竖置，X ≈ 150 / Z ≈ +190 / Y 60…270） */
const FLT = {
  x: 150, z: 190,
  baseY: 60, len: 210, od: 108,
  elemY0: 86, elemLen: 160,
  tubeY0: 62, tubeLen: 190,
};

/** 主油道（与 params 一致：Y=118 / Z=72 / φ16 沿 X 贯通） */
const MAIN_X = [-260, -130, 0, 130, 260];          // 5 道主轴承 X
const CAM_X = [-260, 0, 260];                      // 凸轮轴轴承供油位置（缸间隔壁）

/* ================= 局部几何小工具 ================= */

/** 混合索引/非索引几何的安全合并（ExtrudeGeometry 无 index，Cylinder/Lathe 有） */
function mg(list) {
  return U.merge(list.filter(Boolean).map((g) => (g.index ? g.toNonIndexed() : g)));
}

/** 由 a→b 生成一段圆柱（用于斜油道 / 短接管） */
function linkGeo(a, b, dia, seg = 12) {
  const va = new THREE.Vector3(a[0], a[1], a[2]);
  const vb = new THREE.Vector3(b[0], b[1], b[2]);
  const d = new THREE.Vector3().subVectors(vb, va);
  const len = Math.max(0.01, d.length());
  const g = new THREE.CylinderGeometry(dia / 2, dia / 2, len, seg, 1);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0), d.clone().normalize()));
  g.translate((va.x + vb.x) / 2, (va.y + vb.y) / 2, (va.z + vb.z) / 2);
  return g;
}

/** 机油泵体截面（截面点为 [z, y]，配合 rotateY(-90°) 后厚度沿 X） */
function pumpSection(R) {
  const p = [];
  const n = 16;
  for (let i = 0; i <= n; i++) {          // 主动侧上半圆
    const a = (i / n) * Math.PI;
    p.push([Math.cos(a) * R, PUMP.driveY + Math.sin(a) * R]);
  }
  for (let i = 0; i <= n; i++) {          // 从动侧下半圆
    const a = Math.PI + (i / n) * Math.PI;
    p.push([Math.cos(a) * R, PUMP.idleY + Math.sin(a) * R]);
  }
  return p;
}

/** 波纹散热带（截面在 XY，厚度沿 Z） */
function finSheet(len, amp, pitch, thick, depth) {
  const n = Math.max(4, Math.round(len / pitch));
  const up = [];
  const dn = [];
  for (let i = 0; i <= n; i++) {
    const x = -len / 2 + (i * len) / n;
    const y = (i % 2 === 0 ? -1 : 1) * amp * 0.5;
    up.push([x, y + thick * 0.5]);
    dn.push([x, y - thick * 0.5]);
  }
  return U.extrudePoly(up.concat(dn.reverse()), depth, { curveSegments: 1 });
}

/** 褶皱纸滤芯（星形环，厚度沿 Y） */
function pleatGeo(rMid, amp, pleats, id, h) {
  const steps = pleats * 8;
  const pts = [];
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const r = rMid + amp * Math.cos(pleats * a);
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  const g = U.extrudePoly(pts, h, { holes: [U.circlePts(id / 2, 24)], curveSegments: 1 });
  g.rotateX(Math.PI / 2);
  return g;
}

/* ================= 工况换算（供 state 文字 + 动画共用） ================= */
function compute(st) {
  const rpm = st.running ? st.rpm : 0;
  const pumpRpm = rpm * RATIO;
  const p = st.op.oilPressure;                       // MPa
  const oilT = st.op.oilTemp;
  const flow = (DISP * pumpRpm * VOL_EFF) / 1000;    // L/min
  // 运动粘度修正因子（冷油阻力大）
  const visc = U.clamp(Math.exp((70 - oilT) / 30), 0.35, 4);
  const dp = 0.008 + 0.0012 * flow * visc;           // 滤清器压差 MPa
  const relief = U.clamp((p - RELIEF_SET) / 0.03, 0, 1);        // 限压阀开度 0..1
  const bypass = U.clamp((dp - BYPASS_SET) / 0.08, 0, 1);       // 旁通阀开度 0..1
  const dT = U.clamp(0.38 * (oilT - st.op.coolantTemp), 0, 16); // 冷却器油温降 ℃
  const heat = 0.0272 * flow * dT;                   // 换热量 kW（c≈1.9 kJ/kg·K, ρ≈0.86）
  const torque = p * DISP / (2 * Math.PI * MECH_EFF); // 泵驱动扭矩 N·m
  const powerW = (torque * pumpRpm * 2 * Math.PI) / 60;
  return { rpm, pumpRpm, p, oilT, flow, visc, dp, relief, bypass, dT, heat, torque, powerW };
}

const f1 = (v) => v.toFixed(1);
const f2 = (v) => v.toFixed(2);
const f0 = (v) => v.toFixed(0);

/* ================================================================= */
export function build(world) {
  const { P, mats } = world;
  const gL = world.group('lube');
  const gV = world.group('fluidVol');
  const gF = world.group('fasteners');

  /* ---------- 动态材质（克隆，避免污染其它系统共用的库材质）---------- */
  const oilMat = mats.oilVol.clone();
  oilMat.name = '主油道（动态示意）';
  const oilColdC = oilMat.color.clone();
  const oilHotC = new THREE.Color(0xffd873);
  const ledMat = mats.paintedRed.clone();
  ledMat.name = '油压指示环';
  const ledLowC = new THREE.Color(0xc0392b);
  const ledOkC = new THREE.Color(0x2ecc71);

  /* ============================================================
   * 1. 机油泵（外啮合齿轮泵）
   * ==========================================================*/
  const bodySec = pumpSection(PUMP.bodyR);

  const bodyGeo = mg([
    // 齿轮腔（两个 φ42.4 腔 + 壁厚 10.8）
    U.extrudePoly(bodySec, 30, {
      holes: [U.circlePts(PUMP.cavityR, 26, 0, PUMP.driveY),
        U.circlePts(PUMP.cavityR, 26, 0, PUMP.idleY)],
      curveSegments: 1,
    }).rotateY(-Math.PI / 2).translate(PUMP.bodyX, 0, 0),
    // 泵体后壁（带主动轴通孔）
    U.extrudePoly(bodySec, 8, {
      holes: [U.circlePts(10.4, 20, 0, PUMP.driveY)], curveSegments: 1,
    }).rotateY(-Math.PI / 2).translate(PUMP.backX, 0, 0),
    // 安装法兰（向上贴合曲轴箱前主轴承壁；30 沿 X × 110 沿 Z）
    U.roundBox(30, 12, 110, 3).translate(PUMP.gearX, -72, 0),
    // 吸油口凸台（−Z）
    U.cylZ(30, 28, 20).translate(PUMP.gearX, PUMP.idleY, -34),
    // 压油口凸台（+Y）
    U.cyl(26, 26, 20).translate(PUMP.gearX, -76, 0),
    // 限压阀凸台（+Z，中空 φ22 阀腔）
    U.tubeShell(30, 22, 42, 20).rotateX(Math.PI / 2).translate(RV.x, RV.y, 34),
    // 从动齿轮轴销（固定于泵体）
    U.cylX(18, 42, 16).translate(PUMP.gearX, PUMP.idleY, 0),
  ]);
  const pumpBody = U.mesh(bodyGeo, mats.alumCast, [0, 0, 0], [0, 0, 0], 'lube.pumpBody');
  gL.add(pumpBody);
  world.reg(pumpBody, 'lube.pumpBody', {
    explode: [-40, -120, 0],
    state: (st) => {
      const c = compute(st);
      return c.rpm < 1
        ? '停机 · 泵内充满机油 · 出口压力 0.00 MPa'
        : `供油量 ${f1(c.flow)} L/min · 泵转速 ${f0(c.pumpRpm)} r/min · 出口 ${f2(c.p)} MPa`;
    },
  });

  // 泵盖
  const coverGeo = mg([
    U.extrudePoly(bodySec, 8, {
      holes: [U.circlePts(10.4, 20, 0, PUMP.driveY)], curveSegments: 1,
    }).rotateY(-Math.PI / 2).translate(PUMP.coverX, 0, 0),
  ]);
  const pumpCover = U.mesh(coverGeo, mats.alumCast, [0, 0, 0], [0, 0, 0], 'lube.pumpCover');
  gL.add(pumpCover);
  world.reg(pumpCover, 'lube.pumpCover', {
    explode: [-140, 0, 0],
    state: (st) => {
      const c = compute(st);
      return `端面间隙 0.05 mm · 承受出口压力 ${f2(c.p)} MPa · 内泄漏 ${f1((DISP * c.pumpRpm / 1000) * (1 - VOL_EFF))} L/min`;
    },
  });

  // 泵内主动 / 从动齿轮 φ42×26
  const pgGeo = () => U.gearGeometry(PG.z, PG.m, PG.w, 20).rotateY(-Math.PI / 2);
  const gearDrive = U.mesh(pgGeo(), mats.gearSteel, [PUMP.gearX, PUMP.driveY, 0], [0, 0, 0], 'lube.pumpDriveGear');
  const gearIdle = U.mesh(pgGeo(), mats.gearSteel, [PUMP.gearX, PUMP.idleY, 0], [0, 0, 0], 'lube.pumpIdleGear');
  gL.add(gearDrive, gearIdle);
  world.reg(gearDrive, 'lube.pumpDriveGear', {
    state: (st) => {
      const c = compute(st);
      return `主动齿轮 ${f0(c.pumpRpm)} r/min（曲轴 ×${RATIO}）· 齿间容积输油 ${f1(c.flow)} L/min`;
    },
  });
  world.reg(gearIdle, 'lube.pumpIdleGear', {
    state: (st) => {
      const c = compute(st);
      return `从动齿轮 ${f0(c.pumpRpm)} r/min · 与主动轮反向啮合 · 齿背密封压差 ${f2(c.p)} MPa`;
    },
  });

  // 驱动轴（前端伸入正时齿轮室，后端穿过泵体）
  const shaft = U.mesh(U.cylX(PUMP.shaftDia, 126, 20), mats.forgedSteel,
    [-321, PUMP.driveY, 0], [0, 0, 0], 'lube.pumpShaft');
  gL.add(shaft);
  world.reg(shaft, 'lube.pumpShaft', {
    state: (st) => {
      const c = compute(st);
      return `传递扭矩 ${f2(c.torque)} N·m · 消耗功率 ${f0(c.powerW)} W · ${f0(c.pumpRpm)} r/min`;
    },
  });

  // 驱动齿轮（与曲轴前端正时齿轮 z=22 啮合）
  const driveGear = U.mesh(
    U.gearGeometry(PUMP.driveGearZ, PUMP.driveGearM, PUMP.driveGearW, PUMP.shaftDia).rotateY(-Math.PI / 2),
    mats.gearSteel, [PUMP.driveGearX, PUMP.driveY, 0], [0, 0, 0], 'lube.driveGear');
  gL.add(driveGear);
  world.reg(driveGear, 'lube.driveGear', {
    state: (st) => {
      const c = compute(st);
      return `与曲轴齿轮啮合 · ${f0(c.pumpRpm)} r/min · 分度圆圆周力 ${f0(c.torque / 0.045)} N`;
    },
  });

  /* ---------- 限压 / 旁通阀（阀体 + 弹簧 + 钢球）---------- */
  const rvBodyGeo = mg([
    U.tubeShell(22, 13, 6, 18).rotateX(Math.PI / 2).translate(RV.x, RV.y, 17),   // 锥形阀座（φ13 节流孔）
    U.cyl(26, 12, 6).rotateX(Math.PI / 2).translate(RV.x, RV.y, RV.plugZ + 8),   // 调压螺塞六角头
    U.cylZ(21.6, 10, 16).translate(RV.x, RV.y, RV.plugZ + 1),                    // 螺塞体
  ]);
  const rvBody = U.mesh(rvBodyGeo, mats.alumMachined, [0, 0, 0], [0, 0, 0], 'lube.reliefBody');
  gL.add(rvBody);
  world.reg(rvBody, 'lube.reliefBody', {
    state: (st) => {
      const c = compute(st);
      return `调定开启压力 ${RELIEF_SET.toFixed(2)} MPa · 当前 ${f2(c.p)} MPa · ${c.relief > 0.02 ? '溢流回油底壳' : '关闭'}`;
    },
  });

  const rvSpring = U.mesh(
    U.coilSpring(17, 2.4, 5, RELIEF_SPRING_LEN, 6).rotateX(-Math.PI / 2),
    mats.springSteel, [RV.x, RV.y, RV.plugZ], [0, 0, 0], 'lube.reliefSpring');
  gL.add(rvSpring);
  world.reg(rvSpring, 'lube.reliefSpring', {
    state: (st) => {
      const c = compute(st);
      const F = 60 + c.relief * 22;   // F = p × 阀座 φ13 承压面积（132.7 mm²）
      return `预紧力 ${f0(F)} N · 压缩量 ${f1(c.relief * BALL_LIFT)} mm · 平衡压力 ${f2(Math.max(c.p, 0))} MPa`;
    },
  });

  const rvBall = U.mesh(new THREE.SphereGeometry(RV.ballR, 16, 12), mats.hardChrome,
    [RV.x, RV.y, RV.ballZ], [0, 0, 0], 'lube.reliefBall');
  gL.add(rvBall);
  world.reg(rvBall, 'lube.reliefBall', {
    state: (st) => {
      const c = compute(st);
      if (c.relief <= 0.02) return `钢球压紧阀座 · 油压 ${f2(c.p)} MPa < ${RELIEF_SET.toFixed(2)} MPa`;
      return `阀开启 · 球升程 ${f1(c.relief * BALL_LIFT)} mm · 溢流 ${f1(c.flow * c.relief * 0.42)} L/min`;
    },
  });

  /* ============================================================
   * 2. 集滤器 + 吸油管
   * ==========================================================*/
  const strFrame = mg([
    U.disc(STRAINER.od, 3, 0, 24).translate(STRAINER.x, STRAINER.y - 9, 0),      // 底板
    U.disc(STRAINER.od, 3, 30, 24).translate(STRAINER.x, STRAINER.y + 9, 0),     // 顶板
    U.cyl(28, 26, 18).translate(STRAINER.x, STRAINER.y + 22, 0),                 // 出油颈
    U.disc(STRAINER.od - 24, 2, 0, 20).translate(STRAINER.x, STRAINER.y - 12, 0), // 防吸空挡板
  ]);
  const strainerFrame = U.mesh(strFrame, mats.steelSheet, [0, 0, 0], [0, 0, 0], 'lube.strainer');
  const strainerMesh = U.mesh(U.tubeShell(STRAINER.od - 4, STRAINER.od - 10, 16, 26),
    mats.brass, [STRAINER.x, STRAINER.y, 0], [0, 0, 0], 'lube.strainerMesh');
  gL.add(strainerFrame, strainerMesh);
  world.reg([strainerFrame, strainerMesh], 'lube.strainer', {
    explode: [0, -70, 0],
    state: (st) => {
      const c = compute(st);
      const dz = 0.004 + 0.0006 * c.flow * c.visc;
      return `吸油 ${f1(c.flow)} L/min · 滤网 0.9 mm 方孔 · 吸入阻力 ${f2(dz * 100)} kPa`;
    },
  });

  const suction = U.pipeFromPoints([
    [STRAINER.x, STRAINER.y + 30, 0],
    [-252, -146, -12],
    [-270, -140, -26],
    [PUMP.gearX, PUMP.idleY, -36],
  ], P.lube.pickupDia, 12, 0.35).geo;
  const suctionPipe = U.mesh(suction, mats.steelSheet, [0, 0, 0], [0, 0, 0], 'lube.suctionPipe');
  gL.add(suctionPipe);
  world.reg(suctionPipe, 'lube.suctionPipe', {
    state: (st) => {
      const c = compute(st);
      const v = c.flow > 0 ? (c.flow * 1e6 / 60) / (Math.PI * 100) / 1000 : 0; // m/s（内径 φ20）
      return `φ${P.lube.pickupDia} 吸油管 · 流速 ${f1(v)} m/s · 真空度 ${f1(2 + c.visc * 3)} kPa`;
    },
  });

  /* ============================================================
   * 3. 机油冷却器（板翅式，机油—冷却液换热）
   * ==========================================================*/
  const cx0 = COOLER.x - COOLER.lenX / 2;   // −170
  const cx1 = COOLER.x + COOLER.lenX / 2;   // +50
  const coolerHouseGeo = mg([
    U.roundBox(20, COOLER.hY + 4, COOLER.depZ, 4).translate(cx0 + 10, COOLER.y, COOLER.z), // 前水室
    U.roundBox(20, COOLER.hY + 4, COOLER.depZ, 4).translate(cx1 - 10, COOLER.y, COOLER.z), // 后水室
    U.roundBox(COOLER.lenX, 6, COOLER.depZ, 2).translate(COOLER.x, COOLER.y + 50, COOLER.z),
    U.roundBox(COOLER.lenX, 6, COOLER.depZ, 2).translate(COOLER.x, COOLER.y - 50, COOLER.z),
    U.cylZ(34, 28, 18).translate(cx0 + 10, COOLER.y + 30, COOLER.z + 45),   // 冷却液进
    U.cylZ(34, 28, 18).translate(cx1 - 10, COOLER.y - 30, COOLER.z + 45),   // 冷却液出
  ]);
  const coolerHousing = U.mesh(coolerHouseGeo, mats.alumCast, [0, 0, 0], [0, 0, 0], 'lube.coolerHousing');
  gL.add(coolerHousing);
  world.reg(coolerHousing, 'lube.coolerHousing', {
    explode: [0, 0, 120],
    state: (st) => {
      const c = compute(st);
      return `冷却液侧 ${f0(st.op.coolantTemp)}℃ · 机油侧 ${f0(c.oilT)}℃ · 换热 ${f1(c.heat)} kW`;
    },
  });

  const plateList = [];
  const finList = [];
  for (let i = 0; i < COOLER.plates; i++) {
    const py = COOLER.plateY0 + i * COOLER.plateGap;
    plateList.push(U.roundBox(COOLER.lenX - 24, 5, COOLER.depZ - 8, 2).translate(COOLER.x, py, COOLER.z));
    if (i < COOLER.plates - 1) {
      finList.push(finSheet(COOLER.lenX - 26, COOLER.plateGap - 5.6, 8, 0.9, COOLER.depZ - 10)
        .translate(COOLER.x, py + COOLER.plateGap / 2, COOLER.z));
    }
  }
  const coolerCore = U.mesh(mg(plateList), mats.steelSheet, [0, 0, 0], [0, 0, 0], 'lube.coolerCore');
  const coolerFins = U.mesh(mg(finList), mats.copper, [0, 0, 0], [0, 0, 0], 'lube.coolerFins');
  gL.add(coolerCore, coolerFins);
  world.reg(coolerCore, 'lube.coolerCore', {
    state: (st) => {
      const c = compute(st);
      return `机油 ${f1(c.flow)} L/min 流过 ${COOLER.plates} 层板片 · 温降 ${f1(c.dT)}℃ · 出口 ${f0(c.oilT - c.dT)}℃`;
    },
  });
  world.reg(coolerFins, 'lube.coolerFins', {
    state: (st) => {
      const c = compute(st);
      return `散热带扰流 · 传热系数随流量上升 · 当前换热 ${f1(c.heat)} kW（Δt ${f0(Math.max(0, c.oilT - st.op.coolantTemp))}℃）`;
    },
  });

  /* ============================================================
   * 4. 机油滤清器（滤清器座 + 壳体 + 纸质滤芯 + 中心管 + 旁通阀）
   * ==========================================================*/
  const seatGeo = mg([
    U.roundBox(80, 52, 72, 6).translate(FLT.x, 30, 164),
    U.cyl(66, 8, 24).translate(FLT.x, 58, FLT.z),          // 密封面凸台
    U.cyl(24, 14, 18).translate(FLT.x, 64, FLT.z),         // 中心螺纹接管
    U.cylZ(26, 24, 16).translate(112, 40, 176),            // 进油口（来自冷却器）
  ]);
  const filterSeat = U.mesh(seatGeo, mats.alumCast, [0, 0, 0], [0, 0, 0], 'lube.filterSeat');
  gL.add(filterSeat);
  world.reg(filterSeat, 'lube.filterSeat', {
    explode: [0, 0, 90],
    state: (st) => {
      const c = compute(st);
      return `进油 ${f2(c.p + c.dp)} MPa → 出油 ${f2(c.p)} MPa · 通往主油道 ${f1(c.flow)} L/min`;
    },
  });

  const R = FLT.od / 2, H = FLT.len, tw = 1.8, ri = 22;
  const canGeo = U.lathe([
    [ri, 0], [R - 6, 0], [R, 5],
    [R, H - 26], [R - 7, H - 10], [R - 26, H], [ri + 8, H],
    [ri + 8, H - tw], [R - 27, H - tw], [R - 8, H - 11], [R - tw, H - 27],
    [R - tw, 6], [R - 7, tw], [ri, tw], [ri, 0],
  ], 32);
  const filterHousing = U.mesh(canGeo, mats.steelSheet, [FLT.x, FLT.baseY, FLT.z], [0, 0, 0], 'lube.filterHousing');
  gL.add(filterHousing);
  world.reg(filterHousing, 'lube.filterHousing', {
    explode: [0, 160, 60],
    state: (st) => {
      const c = compute(st);
      return `旋装壳体 φ${FLT.od} · 内压 ${f2(c.p + c.dp)} MPa · 耐压试验 1.5 MPa（安全余量 ${f1(1.5 / Math.max(0.05, c.p + c.dp))} 倍）`;
    },
  });

  const elemGeo = pleatGeo(41, 5, 26, 44, FLT.elemLen);
  const elemY = FLT.elemY0 + FLT.elemLen / 2;
  const filterElem = U.mesh(elemGeo, mats.filterPaper, [FLT.x, elemY, FLT.z], [0, 0, 0], 'lube.filterElement');
  const elemCaps = U.mesh(mg([
    U.disc(96, 4, 40, 24).translate(FLT.x, FLT.elemY0 - 2, FLT.z),
    U.disc(96, 4, 40, 24).translate(FLT.x, FLT.elemY0 + FLT.elemLen + 2, FLT.z),
  ]), mats.rubber, [0, 0, 0], [0, 0, 0], 'lube.filterElementCaps');
  gL.add(filterElem, elemCaps);
  world.reg([filterElem, elemCaps], 'lube.filterElement', {
    state: (st) => {
      const c = compute(st);
      const eff = U.clamp(96 - c.bypass * 40, 20, 99);
      return `压差 ${f2(c.dp)} MPa · ${c.bypass > 0.02 ? '压差过高·旁通开启' : '正常过滤'} · 20 μm 过滤效率 ${f0(eff)} %`;
    },
  });

  const centerTube = U.mesh(U.tubeShell(44, 38, FLT.tubeLen, 24), mats.chrome,
    [FLT.x, FLT.tubeY0 + FLT.tubeLen / 2, FLT.z], [0, 0, 0], 'lube.filterCenterTube');
  gL.add(centerTube);
  world.reg(centerTube, 'lube.filterCenterTube', {
    state: (st) => {
      const c = compute(st);
      const v = (c.flow * 1e6 / 60) / (Math.PI * 19 * 19) / 1000;
      return `冲孔中心管 · 汇集净油 ${f1(c.flow)} L/min · 管内流速 ${f1(v)} m/s · 支撑压差 ${f2(c.dp)} MPa`;
    },
  });

  const bpY = FLT.tubeY0 + FLT.tubeLen + 2;      // 阀片基准高度 254
  const bypassPlate = U.mesh(mg([
    U.disc(40, 3, 0, 20),
    U.cyl(12, 8, 12).translate(0, 5, 0),
  ]), mats.springSteel, [FLT.x, bpY, FLT.z], [0, 0, 0], 'lube.filterBypass');
  const bypassSpring = U.mesh(
    U.coilSpring(30, 2.2, 4, BYPASS_SPRING_LEN, 6).rotateX(Math.PI),
    mats.springSteel, [FLT.x, bpY + BYPASS_SPRING_LEN + 2, FLT.z]);
  gL.add(bypassPlate, bypassSpring);
  world.reg([bypassPlate, bypassSpring], 'lube.filterBypass', {
    state: (st) => {
      const c = compute(st);
      if (c.bypass <= 0.02) return `关闭 · 压差 ${f2(c.dp)} MPa < ${BYPASS_SET.toFixed(2)} MPa · 全量过滤`;
      return `开启 ${f0(c.bypass * 100)} % · 压差 ${f2(c.dp)} MPa · 未滤机油直供主油道（保润滑）`;
    },
  });

  /* ============================================================
   * 5. 压力油管：泵 → 冷却器 → 滤清器
   * ==========================================================*/
  const pipeA = U.pipeFromPoints([
    [PUMP.gearX, -64, 0], [PUMP.gearX, -50, 34], [-292, -34, 82],
    [-282, -18, 124], [-262, -6, 152], [-226, 2, 162], [cx0 + 4, 12, COOLER.z],
  ], 20, 12, 0.35).geo;
  const pipeB = U.pipeFromPoints([
    [cx1 - 4, 74, COOLER.z], [72, 66, 166], [98, 52, 172], [114, 42, 176],
  ], 20, 12, 0.35).geo;
  const delivery = U.mesh(mg([pipeA, pipeB]), mats.chrome, [0, 0, 0], [0, 0, 0], 'lube.deliveryPipe');
  gL.add(delivery);
  world.reg(delivery, 'lube.deliveryPipe', {
    state: (st) => {
      const c = compute(st);
      const v = (c.flow * 1e6 / 60) / (Math.PI * 8 * 8) / 1000;
      return `压力油管 φ20×2 · ${f2(c.p + c.dp)} MPa · 流速 ${f1(v)} m/s · ${f1(c.flow)} L/min`;
    },
  });

  /* ============================================================
   * 6. 油道示意腔（fluidVol 图层，半透明 oilVol 克隆材质）
   * ==========================================================*/
  // 6.1 主油道 φ16 沿 X 贯通 + 滤清器入口 + 传感器取压孔
  const galleryGeo = mg([
    U.cylX(P.lube.galleryDia, 660, 20).translate(0, P.block.galleryY, P.block.galleryZ),
    linkGeo([162, 32, 128], [168, 110, 78], 13, 12),
    linkGeo([280, 118, 72], [280, 124, 130], 8, 10),
  ]);
  const mainGallery = U.mesh(galleryGeo, oilMat, [0, 0, 0], [0, 0, 0], 'lube.mainGallery');
  gV.add(mainGallery);
  world.reg(mainGallery, 'lube.mainGallery', {
    state: (st) => {
      const c = compute(st);
      return `油压 ${f2(c.p)} MPa · 油温 ${f0(c.oilT)}℃ · 流量 ${f1(c.flow * (1 - c.relief * 0.42))} L/min`;
    },
  });

  // 6.2 5 条通向主轴承的斜油道
  const feedGeo = mg(MAIN_X.map((x) => linkGeo([x, P.block.galleryY, P.block.galleryZ], [x, 43, 0], 8, 12)));
  const mainFeeds = U.mesh(feedGeo, oilMat, [0, 0, 0], [0, 0, 0], 'lube.mainFeeds');
  gV.add(mainFeeds);
  world.reg(mainFeeds, 'lube.mainFeeds', {
    state: (st) => {
      const c = compute(st);
      const q = c.flow * 0.55 / 5;
      return `5 道主轴承各 ${f1(q)} L/min · 油膜压力峰值 ${f0(c.p * 45)} MPa · 间隙 ${P.clearance.mainBearing} mm`;
    },
  });

  // 6.3 主轴瓦周向油槽 + 瓦背油孔（曲轴侧的内部斜油道由曲轴模块建模，此处只做缸体侧）
  const grooveGeo = mg(MAIN_X.map((x) => new THREE.TorusGeometry(
    P.crank.mainDia / 2 + 0.5, 2.4, 6, 18, Math.PI).rotateY(Math.PI / 2).translate(x, 0, 0)));
  const mainGrooves = U.mesh(grooveGeo, oilMat, [0, 0, 0], [0, 0, 0], 'lube.mainGrooves');
  gV.add(mainGrooves);
  world.reg(mainGrooves, 'lube.mainGrooves', {
    state: (st) => {
      const c = compute(st);
      return `上瓦 180° 油槽充油 ${f2(c.p)} MPa · 经曲轴斜油道向连杆轴承输送 ${f2(c.p * 1.35)} MPa（含离心增压）`;
    },
  });

  // 6.4 通往缸盖的竖直油道（X = 300，与主开发者的油流线路一致）
  const HF_X = 300;
  const headFeedGeo = mg([
    linkGeo([HF_X, P.block.galleryY, P.block.galleryZ], [HF_X, 336, 72], 10, 12),
    linkGeo([HF_X, 336, 72], [HF_X, 424, -36], 10, 12),
    linkGeo([HF_X, 424, -36], [HF_X, P.valvetrain.rockerPivotY, P.valvetrain.rockerPivotZ], 9, 12),
  ]);
  const headFeed = U.mesh(headFeedGeo, oilMat, [0, 0, 0], [0, 0, 0], 'lube.headFeed');
  gV.add(headFeed);
  world.reg(headFeed, 'lube.headFeed', {
    state: (st) => {
      const c = compute(st);
      return `缸盖供油 ${f1(c.flow * 0.18)} L/min · 到达摇臂 ${f2(Math.max(0, c.p - 0.05))} MPa · 提升 ${(452 - 118)} mm`;
    },
  });

  // 6.5 摇臂轴径向出油孔（8 处；摇臂轴内部轴向油道由配气机构模块给出，此处不重复建模）
  const rockerX = [];
  for (const cx of [-195, -65, 65, 195]) {
    rockerX.push(cx - P.valvetrain.valveOffsetX, cx + P.valvetrain.valveOffsetX);
  }
  const RY = P.valvetrain.rockerPivotY;
  const RZ = P.valvetrain.rockerPivotZ;
  const rockerGeo = mg(rockerX.map((x) => linkGeo([x, RY - 5, RZ], [x, RY - 13, RZ], 3.6, 8)));
  const rockerFeed = U.mesh(rockerGeo, oilMat, [0, 0, 0], [0, 0, 0], 'lube.rockerFeed');
  gV.add(rockerFeed);
  world.reg(rockerFeed, 'lube.rockerFeed', {
    state: (st) => {
      const c = compute(st);
      return `8 个 φ3.6 径向出油孔 · 供油压力 ${f2(Math.max(0, c.p - 0.06))} MPa · 溢流润滑气门杆与推杆球窝`;
    },
  });

  // 6.6 凸轮轴轴承 / 挺柱供油支路
  const tappetX = [];
  for (const cx of [-195, -65, 65, 195]) {
    tappetX.push(cx - P.valvetrain.pushrodOffsetX, cx + P.valvetrain.pushrodOffsetX);
  }
  const camFeedGeo = mg([
    ...CAM_X.map((x) => linkGeo([x, P.block.galleryY, P.block.galleryZ], [x, P.block.camY, P.block.camZ], 8, 12)),
    ...CAM_X.map((x) => linkGeo([x, P.block.camY, P.block.camZ], [x, 205, -122], 6, 10)),
    U.cylX(7, 500, 12).translate(0, 205, -122),
    ...tappetX.map((x) => linkGeo([x, 205, -122], [x, 203, -110], 4, 8)),
  ]);
  const camFeed = U.mesh(camFeedGeo, oilMat, [0, 0, 0], [0, 0, 0], 'lube.camFeed');
  gV.add(camFeed);
  world.reg(camFeed, 'lube.camFeed', {
    state: (st) => {
      const c = compute(st);
      return `凸轮轴 ${f0(c.rpm / 2)} r/min 轴承供油 ${f1(c.flow * 0.12)} L/min · 挺柱油道 ${f2(Math.max(0, c.p - 0.03))} MPa`;
    },
  });

  /* ============================================================
   * 7. 附件小件：压力传感器 / 机油尺 / 加油口盖 / 放油螺塞
   * ==========================================================*/
  const sensorBody = U.mesh(mg([
    U.cyl(26, 16, 6).rotateX(Math.PI / 2).translate(280, 126, 138),   // 六角安装座
    U.cylZ(30, 26, 18).translate(280, 126, 159),
    U.cylZ(38, 4, 20).translate(280, 126, 173),                       // 表盘底
    U.cylZ(10, 12, 10).translate(280, 106, 168),                      // 出线接头
  ]), mats.brass, [0, 0, 0], [0, 0, 0], 'lube.pressureSensor');
  const sensorRing = U.mesh(U.tubeShell(42, 34, 5, 24).rotateX(Math.PI / 2),
    ledMat, [280, 126, 176], [0, 0, 0], 'lube.pressureSensorRing');
  const needleGeo = new THREE.BoxGeometry(2.6, 16, 1.2);
  needleGeo.translate(0, 7, 0);
  const sensorNeedle = U.mesh(needleGeo, mats.paintedBlack, [280, 126, 177], [0, 0, 0], 'lube.pressureSensorNeedle');
  gL.add(sensorBody, sensorRing, sensorNeedle);
  world.reg([sensorBody, sensorRing, sensorNeedle], 'lube.pressureSensor', {
    state: (st) => {
      const c = compute(st);
      if (c.p < 0.08) return `⚠ 油压过低 ${f2(c.p)} MPa · 报警触点闭合（指示灯红）`;
      return `主油道取压 ${f2(c.p)} MPa · 指针 ${f0(U.clamp(c.p / 0.6, 0, 1) * 100)} % 量程 · 油温 ${f0(c.oilT)}℃`;
    },
  });

  const dipTube = U.pipeFromPoints([
    [-250, -140, -56], [-252, -112, -98], [-252, -60, -132],
    [-250, 20, -146], [-250, 122, -148],
  ], 14, 10, 0.35).geo;
  const dipstick = U.mesh(mg([
    dipTube,
    U.oring(34, 8, 16).translate(-250, 138, -148),                   // 提环
  ]), mats.chrome, [0, 0, 0], [0, 0, 0], 'lube.dipstick');
  gL.add(dipstick);
  world.reg(dipstick, 'lube.dipstick', {
    explode: [0, 90, -40],
    state: (st) => {
      const c = compute(st);
      const level = U.clamp(1 - (c.oilT - 22) / 900, 0.9, 1) * 11.5;
      return `油面 ${f1(level)} L（H–L 区间 9.5~12 L）· 油温 ${f0(c.oilT)}℃ · 粘度系数 ${f2(c.visc)}`;
    },
  });

  // 缸体排气侧加油管口（气门室罩上的加注口由缸盖模块给出，此处为缸体侧加油管，避免重复）
  const FILL = { x: -280, y: 250, z: 150 };
  const fillerCap = U.mesh(mg([
    U.tubeShell(52, 44, 44, 20).rotateX(Math.PI / 2).translate(FILL.x, FILL.y, FILL.z - 4),  // 加油管颈
    U.lathe([[0, 0], [26, 0], [30, -4], [30, -12], [24, -15], [0, -15]], 22)
      .rotateX(-Math.PI / 2).translate(FILL.x, FILL.y, FILL.z + 18),                          // 旋盖
  ]), mats.paintedBlack, [0, 0, 0], [0, 0, 0], 'lube.fillerCap');
  gL.add(fillerCap);
  world.reg(fillerCap, 'lube.fillerCap', {
    explode: [0, 120, 0],
    state: (st) => {
      const c = compute(st);
      return `缸体侧加油管口 · 曲轴箱内 ${f0(c.oilT)}℃ · 加注量 12 L（换油含滤清器 12.5 L）`;
    },
  });

  const drainPlug = U.mesh(U.hexBolt(24, 12, 20, 18), mats.boltSteel,
    [250, -201, 50], [Math.PI, 0, 0], 'lube.drainPlug');
  gF.add(drainPlug);
  world.reg(drainPlug, 'lube.drainPlug', {
    state: (st) => {
      const c = compute(st);
      return `M20×1.5 放油螺塞（带磁芯）· 拧紧力矩 45 N·m · 当前油温 ${f0(c.oilT)}℃${c.oilT > 60 ? '（热态放油）' : ''}`;
    },
  });

  /* ---------- 紧固件（实例化） ---------- */
  const boltGeo = U.hexBolt(16, 8, 10, 24);
  const boltT = [
    // 泵盖 4 × M10（沿 −X，头部留在油底壳前壁内侧）
    { pos: [-306, PUMP.driveY, 28], rot: [0, 0, Math.PI / 2] },
    { pos: [-306, PUMP.driveY, -28], rot: [0, 0, Math.PI / 2] },
    { pos: [-306, PUMP.idleY, 28], rot: [0, 0, Math.PI / 2] },
    { pos: [-306, PUMP.idleY, -28], rot: [0, 0, Math.PI / 2] },
    // 泵体安装 2 × M10（沿 +Y）
    { pos: [PUMP.gearX, -80, 44], rot: [Math.PI, 0, 0] },
    { pos: [PUMP.gearX, -80, -44], rot: [Math.PI, 0, 0] },
    // 滤清器座 4 × M10（沿 −Z）
    { pos: [120, 14, 132], rot: [Math.PI / 2, 0, 0] },
    { pos: [180, 14, 132], rot: [Math.PI / 2, 0, 0] },
    { pos: [120, 48, 132], rot: [Math.PI / 2, 0, 0] },
    { pos: [180, 48, 132], rot: [Math.PI / 2, 0, 0] },
    // 冷却器 4 × M10（沿 −Z）
    { pos: [cx0 + 10, COOLER.y + 44, 132], rot: [Math.PI / 2, 0, 0] },
    { pos: [cx0 + 10, COOLER.y - 44, 132], rot: [Math.PI / 2, 0, 0] },
    { pos: [cx1 - 10, COOLER.y + 44, 132], rot: [Math.PI / 2, 0, 0] },
    { pos: [cx1 - 10, COOLER.y - 44, 132], rot: [Math.PI / 2, 0, 0] },
  ];
  const bolts = U.instances(boltGeo, mats.boltSteel, boltT, 'lube.mountBolts');
  gF.add(bolts);
  world.reg(bolts, 'lube.mountBolts', {
    state: (st) => {
      const c = compute(st);
      return `${boltT.length} 件 M10×8.8 级 · 力矩 45~55 N·m · 承受油压 ${f2(c.p + c.dp)} MPa 密封载荷`;
    },
  });

  /* ============================================================
   * 8. 每帧动画
   * ==========================================================*/
  world.addUpdater((st) => {
    const c = compute(st);

    // 8.1 齿轮泵：两齿轮反向旋转，转速 = 曲轴 × 1.2
    const ang = st.crankTotal * RATIO * D2R;
    driveGear.rotation.x = -ang;
    shaft.rotation.x = -ang;
    gearDrive.rotation.x = -ang;
    gearIdle.rotation.x = ang;

    // 8.2 限压阀：油压 ≥ 0.45 MPa 时钢球被顶开
    const lift = c.relief * BALL_LIFT;
    rvBall.position.z = RV.ballZ + lift;
    rvSpring.scale.z = (RELIEF_SPRING_LEN - lift) / RELIEF_SPRING_LEN;

    // 8.3 滤清器旁通阀：压差过高（冷启动/滤芯堵塞）时抬起
    const bl = c.bypass * BYPASS_LIFT;
    bypassPlate.position.y = bpY + bl;
    bypassSpring.scale.y = (BYPASS_SPRING_LEN - bl) / BYPASS_SPRING_LEN;

    // 8.4 油道示意腔：随油压平缓变化（同步库材质的全局显隐/透明度）
    const k = U.clamp(c.p / RELIEF_SET, 0, 1);
    oilMat.opacity = mats.oilVol.opacity * (0.70 + 0.55 * k);
    oilMat.visible = mats.oilVol.visible;
    oilMat.color.copy(oilColdC).lerp(oilHotC, k * 0.65);

    // 8.5 压力表指针 + 指示色
    sensorNeedle.rotation.z = (0.5 - U.clamp(c.p / 0.6, 0, 1)) * 240 * D2R;
    ledMat.color.copy(ledLowC).lerp(ledOkC, U.clamp((c.p - 0.06) / 0.16, 0, 1));
  });
}
