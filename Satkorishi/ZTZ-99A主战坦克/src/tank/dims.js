/**
 * 全车尺寸基准（单位：米，1:1 实尺）
 *
 * 坐标系：X = 车体右侧(+) / 左侧(-)，Y = 上，Z = 车头方向(+)。原点在车体中心、地面高度 0。
 *
 * 数据取自公开资料的 ZTZ-99A（99A 式主战坦克）主要外形参数，
 * 并按"外形自洽"原则做了工程化取整：全宽 3.4 m、履带宽 0.578 m、
 * 车体顶甲板高 1.38 m、炮塔顶高约 2.33 m、含炮全长约 11 m。
 * 涉及装甲厚度/防护当量等未公开数据，模型只做外形示意，不作数值声明。
 */
export const D = {
  /* ---- 总体 ---- */
  overallWidth: 3.4,
  hullLength: 7.5,
  groundClearance: 0.47,
  hullRoofY: 1.38,
  sponsonBottomY: 1.12,
  tubHalfWidth: 1.12, // 主舱半宽（履带内侧）
  halfWidth: 1.7,

  /* ---- 车体关键点 (z, y) ---- */
  glacisTip: [3.58, 0.74], // 首上甲板前缘（车体最前点）
  frontLowerBottom: [3.26, 0.47],
  glacisTop: [1.6, 1.38], // 首上甲板与顶甲板交线
  tailTopZ: -3.84,
  tailBottomZ: -3.7,
  tailZ: -3.92, // 尾部最后点（尾甲板中部）

  /* ---- 炮塔 ---- */
  turretZ: 0.05, // 炮塔座圈中心 Z
  turretRingR: 1.06, // 座圈半径（Φ2.12 m，容纳 125 mm 转盘式自动装弹机）
  turretHeight: 0.95, // 座圈到炮塔顶甲板
  turretRoofY: 2.33,

  /* ---- 火炮 ---- */
  trunnionZ: 1.2, // 耳轴（世界 Z）
  trunnionY: 1.98,
  muzzleZ: 7.08, // 0 方位/0 俯仰时炮口位置 → 含炮全长约 11.0 m
  caliber: 0.125,
  barrelBase: 0.115, // 炮尾侧管径（含热护套外径）
  barrelTip: 0.082,
  recoilStroke: 0.3,
  elevMax: 14, // 度
  elevMin: -6,

  /* ---- 行动装置 ---- */
  trackWidth: 0.578,
  trackThickness: 0.06,
  trackPitch: 0.164,
  roadWheelR: 0.375,
  roadWheelY: 0.435,
  roadWheelZ: [2.6, 1.62, 0.64, -0.34, -1.32, -2.3],
  idler: { z: 3.34, y: 0.52, r: 0.28 },
  sprocket: { z: -3.34, y: 0.74, r: 0.31, teeth: 14 },
  rollerR: 0.12,
  rollerY: 0.98,
  rollerZ: [2.1, 0.3, -1.55],

  /* ---- 动力舱 ---- */
  engineBayZ: [-3.8, -1.7], // 动力舱纵向范围
  engineCenter: [0, 0.95, -2.72],

  /* ---- 乘员位置（3 人：车长 / 炮长 / 驾驶员）----
   * driver 为世界坐标（座椅面高度）；gunner / commander 为炮塔局部坐标（随炮塔回转）。 */
  crew: {
    driver: [-0.42, 0.56, 2.36],
    gunner: [-0.62, -0.33, -0.1],
    commander: [0.66, -0.33, -0.38],
  },
};

/** 履带横向中心 */
export const TRACK_X = D.tubHalfWidth + D.trackWidth / 2;

/** 首上甲板（斜面）的参数化：s∈[0,1] 从前缘到后缘 */
export const GLACIS = (() => {
  const [z0, y0] = D.glacisTip;
  const [z1, y1] = D.glacisTop;
  const dz = z1 - z0;
  const dy = y1 - y0;
  const len = Math.hypot(dz, dy);
  return {
    z0,
    y0,
    z1,
    y1,
    len,
    dir: [dz / len, dy / len], // 沿斜面向后上
    normal: [dy / len, -dz / len], // 朝前上的法线 (z,y) → (0.307, 0.951)
    tilt: Math.atan2(dy, -dz), // 与水平面夹角（弧度）
    /** 斜面上一点（含沿法线的抬升） */
    at(s, lift = 0) {
      const z = z0 + (z1 - z0) * s + (dy / len) * lift;
      const y = y0 + (y1 - y0) * s + (-dz / len) * lift;
      return [z, y];
    },
  };
})();
