/**
 * params.js —— 四冲程直列四缸增压柴油机 全尺寸参数表
 * ------------------------------------------------------------------
 * 场景单位：1 three.js unit = 1 mm（毫米），所有零件按真实尺寸建模，
 * 保证 0.1mm 级视觉精度（运动间隙按真实值给出，不做夸张放大）。
 *
 * 坐标系约定：
 *   +X : 曲轴轴线方向（-X 为发动机前端/正时齿轮室端，+X 为后端/飞轮端）
 *   +Y : 竖直向上（Y=0 为曲轴回转中心线）
 *   +Z : 排气侧（-Z 为进气侧）
 */

export const P = {
  meta: {
    model: 'DSH-4105ZT',
    type: '四冲程 直列四缸 水冷 涡轮增压 中冷 直喷柴油机',
    typeEn: 'Inline-4 Four-Stroke Water-Cooled Turbocharged Intercooled DI Diesel',
    valvetrain: 'OHV 顶置气门 / 下置凸轮轴 + 挺柱 + 推杆 + 摇臂',
    firingOrder: [1, 3, 4, 2],
    displacementL: 4.4,
    ratedPowerKW: 105,
    ratedSpeed: 2200,
    peakTorqueNm: 550,
    peakTorqueSpeed: 1400,
    idleSpeed: 750,
    maxSpeed: 2600,
  },

  // ---------- 缸径行程 ----------
  bore: 105,             // 缸径 φ105 mm
  stroke: 127,           // 行程 127 mm
  crankR: 63.5,          // 曲柄半径 = 行程/2
  rodLength: 205,        // 连杆中心距 205 mm
  cylPitch: 130,         // 缸心距 130 mm
  nCyl: 4,
  compressionRatio: 17.5,
  deckHeight: 330,       // 曲轴中心线 → 缸体上平面
  clearanceVol: 66650,   // 燃烧室容积 mm^3

  // ---------- 缸体 / 缸盖 ----------
  block: {
    lenX: 700, halfWidthZ: 130, topY: 330, panFlangeY: -55,
    skirtWidthZ: 118, wallThk: 12,
    linerOD: 118, linerID: 105, linerFlangeOD: 126,
    jacketOD: 121.6, jacketOuter: 138,   // 水套内/外壁
    galleryY: 118, galleryZ: 72, galleryDia: 16, // 主油道 φ16
    camY: 172, camZ: -100,                       // 下置凸轮轴中心（缸体内）
    deckPlateY: 314,                             // 上平面板下沿
    crankcaseTopY: 138,                          // 缸筒下端 / 曲轴箱顶
  },
  head: {
    thickness: 104, topY: 434, halfWidthZ: 122,
    coverTopY: 486,
    portDia: 46,
    gasketThk: 1.5,
  },
  oilPan: { depth: 148, lenX: 640, halfWidthZ: 118, flangeThk: 8 },

  // ---------- 活塞组 ----------
  piston: {
    dia: 104.9,            // 活塞裙部外径（缸径 105 → 间隙 0.10mm）
    topLandDia: 104.4,     // 头部（第一环岸）直径，热膨胀预留 0.6mm
    height: 108,           // 活塞总高
    compHeight: 60,        // 压缩高（活塞销中心 → 活塞顶面）
    crownThk: 14,
    bowlDia: 72, bowlDepth: 16.5, bowlLipDia: 52, // ω 形燃烧室
    pinBoreDia: 40.0,
    ringGrooves: [         // 自上而下：两道气环 + 一道油环
      { name: 'ring1', y: 8.5, h: 3.0, depth: 4.2, type: '梯形桶面镀铬气环' },
      { name: 'ring2', y: 16.5, h: 2.5, depth: 4.0, type: '锥面扭曲气环' },
      { name: 'ring3', y: 25.5, h: 3.5, depth: 4.6, type: '螺旋撑簧组合油环' },
    ],
  },
  pin: { dia: 40.0, length: 88, boreDia: 22, type: '全浮式空心活塞销' },

  // ---------- 连杆 ----------
  rod: {
    length: 205,
    smallEndOD: 62, smallEndID: 40.06,   // 衬套内径（销间隙 0.06mm）
    bigEndOD: 96, bigEndID: 69.05,       // 大头瓦内径（油膜间隙 0.05mm）
    shankW: 30, shankT: 18,              // I 形杆身
    capThk: 24, boltDia: 12, boltSpacing: 82,
    bearingThk: 2.0,
  },

  // ---------- 曲轴 ----------
  crank: {
    mainDia: 82, mainWidth: 42, mainCount: 5,
    rodDia: 69, rodWidth: 46,
    webThk: 21, webR: 84,
    cwR: 118, cwThk: 34, cwAngle: 148,  // 平衡重（度）
    frontStubDia: 60, frontStubLen: 90,
    rearFlangeDia: 150, rearFlangeThk: 22,
    filletR: 3.5,
    mainClearance: 0.06, rodClearance: 0.05,
  },
  flywheel: { dia: 420, thk: 46, teeth: 128, ringThk: 22, boltCircle: 110 },
  flywheelHousing: { od: 500, len: 96, wallThk: 10 },

  // ---------- 配气机构（OHV：下置凸轮轴—挺柱—推杆—摇臂—气门）----------
  valvetrain: {
    camJournalDia: 54, camBaseR: 22, camLobeWidth: 20,
    camNoseSharp: 1.55,          // 凸轮桃尖丰满系数
    tappetDia: 25, tappetLen: 46, tappetBottomY: 194,  // = camY + camBaseR
    pushrodDia: 9.5, pushrodBallR: 6, pushrodZ: -100, pushrodOffsetX: 46,
    rockerRatio: 1.5,            // 摇臂杠杆比 = 气门侧臂长/推杆侧臂长
    rockerPivotY: 458, rockerPivotZ: -60,
    rockerArmPush: 40, rockerArmValve: 60,
    valveLift: 11.5,             // 气门最大升程
    intakeHeadDia: 44, exhaustHeadDia: 38,
    stemDia: 9.0, guideBore: 9.05, stemLen: 116,
    guideBottomY: 352, guideTopY: 414, springSeatY: 350,
    pushrodLen: 218,
    seatAngle: 45, seatWidth: 2.2,
    valveZ: -10,                 // 气门轴线所在 Z（同一直列布置）
    valveOffsetX: 23,            // 同缸进/排气门相对缸心 ∓X / ±X
    springOD: 40, springWire: 4.6, springCoils: 6.5,
    springFreeLen: 96, springInstalledLen: 85,
    lashIntake: 0.30, lashExhaust: 0.45,
    // 配气相位（曲轴转角）
    timing: { IVO: 14, IVC: 40, EVO: 48, EVC: 12 }, // IVO°BTDC, IVC°ABDC, EVO°BBDC, EVC°ATDC
  },

  // ---------- 正时齿轮室 ----------
  timing: {
    // 齿轮系（模数 5）：曲轴 22T → 惰轮 33T → 凸轮轴 44T（严格 2:1）
    // 喷油泵由凸轮轴上的辅助齿轮（模数 4，18T）1:1 驱动 → 0.5×曲轴转速
    gearPlaneX: -372, casePlaneX: -350, caseDepth: 50, coverX: -404,
    crankGear: { teeth: 22, module: 5, thk: 22, x: -372 },
    idlerGear: { teeth: 33, module: 5, thk: 26, y: -17.1, z: -136.5 },
    camGear: { teeth: 44, module: 5, thk: 22, y: 172, z: -100 },
    auxCamGear: { teeth: 18, module: 4, thk: 18, x: -338 },
    pumpGear: { teeth: 18, module: 4, thk: 18, x: -338, y: 196, z: -168 },
  },

  // ---------- 燃油系统 ----------
  fuel: {
    pumpZ: -168, pumpY: 196, pumpLen: 330,
    plungerDia: 10, maxInjPressure: 120,   // MPa
    injectorBodyDia: 26, injectorLen: 168, nozzleHoles: 7, nozzleHoleDia: 0.22,
    lineOD: 6.35, lineID: 2.0,
    filterDia: 96, filterLen: 190,
  },

  // ---------- 润滑系统 ----------
  lube: {
    pumpDia: 92, gearWidth: 26,
    filterDia: 108, filterLen: 210,
    coolerLen: 220, coolerDia: 96,
    ratedPressure: 0.42,   // MPa @额定
    galleryDia: 16,
    pickupDia: 26,
  },

  // ---------- 冷却系统 ----------
  cooling: {
    pumpDia: 118, impellerBlades: 7,
    thermostatDia: 74, openTemp: 82, fullOpenTemp: 95,
    radiator: { w: 34, h: 470, lenZ: 420, x: -640, fins: 46 },
    fanDia: 430, fanBlades: 8,
    pipeOD: 46,
    normalTemp: 88,
  },

  // ---------- 进排气 / 增压 ----------
  air: {
    intakeManifoldZ: -150, exhaustManifoldZ: 150,
    runnerDia: 46, plenumDia: 76,
    turbo: { x: 330, y: 300, z: 232, turbineDia: 78, compDia: 86, housingR: 96 },
    intercooler: { x: -560, y: 330, w: 62, h: 190, lenZ: 400 },
    maxBoost: 0.14,   // MPa (表压) @额定
  },

  // ---------- 关键装配间隙（真实值，mm）----------
  clearance: {
    pistonToBore: 0.10,
    topLandToBore: 0.60,
    ringSide: 0.05,
    ringEndGap: 0.35,
    mainBearing: 0.06,
    rodBearing: 0.05,
    pinToBush: 0.06,
    valveStemToGuide: 0.05,
    squish: 1.50,          // 活塞上止点到缸盖底平面
    camBearing: 0.07,
    gearBacklash: 0.15,
  },
};

// 气门升程曲线（含相位）——曲轴角 → 升程 mm
export const VALVE_EVENTS = (() => {
  const t = P.valvetrain.timing;
  // 循环角定义：0° = 压缩上止点（着火上止点）
  // 0-180 做功 / 180-360 排气 / 360-540 进气 / 540-720 压缩
  return {
    intake: { open: 360 - t.IVO, close: 540 + t.IVC },   // 346° → 580°（持续 234°CA）
    exhaust: { open: 180 - t.EVO, close: 360 + t.EVC },  // 132° → 372°（持续 240°CA）
  };
})();

export const STROKES = [
  { key: 'power', cn: '做功（膨胀）', en: 'Power / Expansion', from: 0, to: 180, color: '#ff6b4a' },
  { key: 'exhaust', cn: '排气', en: 'Exhaust', from: 180, to: 360, color: '#9aa4b2' },
  { key: 'intake', cn: '吸气', en: 'Intake', from: 360, to: 540, color: '#4ac3ff' },
  { key: 'compression', cn: '压缩', en: 'Compression', from: 540, to: 720, color: '#ffc94a' },
];

// 四缸相位：按点火顺序 1-3-4-2，每 180° 一次做功
export const CYL_PHASE = (() => {
  const order = P.meta.firingOrder;
  const phase = {};
  order.forEach((cyl, i) => { phase[cyl] = i * 180; });
  return phase; // {1:0, 3:180, 4:360, 2:540}
})();

// 各缸在 X 轴上的中心位置
export const CYL_X = Array.from({ length: P.nCyl }, (_, i) =>
  (i - (P.nCyl - 1) / 2) * P.cylPitch);

export default P;
