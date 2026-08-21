/**
 * poses.js —— 姿势数据（唯一数据源）
 *
 *  r = 旋转（度）, p = 位置（覆盖结构基准）, s = 缩放, g = 握拳量(0~1)
 *  phase = 该关节在整条变形时间轴 [0,1] 上的运动窗口 —— 错峰是"机械感"的关键
 *
 *  载具态几何自洽性校验（见 robot.js 的 D）：
 *    髋 r.x=90 + 膝 0  → 大腿/小腿水平朝 −Z，成为车架纵梁
 *    踝 r.x=90         → 合计 180°，脚掌翻转成尾部平台
 *    肩 r.x=92 + 肩甲 r.x=−92 → 手臂后折成侧裙板，排气管保持竖直立于驾驶室后方
 *    车顶板 r.x=−90    → 背包翻上去成为驾驶室顶
 */

/* ---------------- 机器人态：自然站姿 ---------------- */
export const ROBOT_POSE = {
  chest: { r: [0, 0, 0] },
  shoulderL: { r: [3, 0, -7] }, shoulderR: { r: [3, 0, 7] },
  elbowL: { r: [-13, 0, 0] }, elbowR: { r: [-13, 0, 0] },
  wristL: { r: [0, 0, 0] }, wristR: { r: [0, 0, 0] },
  handL: { g: 0.18 }, handR: { g: 0.18 },
  stackL: { r: [-6, 0, 5] }, stackR: { r: [-6, 0, -5] },
  hipL: { r: [-2, 0, -2] }, hipR: { r: [-2, 0, 2] },
  kneeL: { r: [5, 0, 0] }, kneeR: { r: [5, 0, 0] },
  ankleL: { r: [-3, 0, 2] }, ankleR: { r: [-3, 0, -2] },
};

/* ---------------- 载具态：驾驶室 + 车架 ---------------- */
export const VEHICLE_POSE = {
  /* 底盘下沉：3.10 → 0.56（轮心正好落在半径 0.42 处） */
  core: { p: [0, 0.56, 0], phase: [0.20, 0.78] },
  waist: { r: [0, 0, 0], phase: [0.2, 0.6] },
  chest: { r: [-1.5, 0, 0], phase: [0.30, 0.72] },

  /* 头颈：缩进驾驶室（z 略前移，避免头冠从驾驶室后壁穿出） */
  neck: { p: [0, 0.44, 0.02], phase: [0.04, 0.36] },
  head: { r: [-88, 0, 0], s: 0.92, phase: [0.02, 0.34] },

  /* 手臂：向后折成侧裙 / 后翼板；肩甲反向补偿使排气管保持竖直 */
  shoulderL: { p: [-0.90, 0.06, -0.02], r: [92, 0, 0], phase: [0.06, 0.48] },
  shoulderR: { p: [0.90, 0.06, -0.02], r: [92, 0, 0], phase: [0.06, 0.48] },
  pauldronL: { p: [0.16, 0, 0], r: [-92, 0, 0], phase: [0.06, 0.48] },
  pauldronR: { p: [-0.16, 0, 0], r: [-92, 0, 0], phase: [0.06, 0.48] },
  stackL: { r: [0, 0, 2], phase: [0.30, 0.66] },
  stackR: { r: [0, 0, -2], phase: [0.30, 0.66] },
  elbowL: { r: [0, 0, 0], phase: [0.06, 0.46] },
  elbowR: { r: [0, 0, 0], phase: [0.06, 0.46] },
  /* 拳头上折，避让后轮，成为尾灯座 */
  wristL: { r: [55, 0, 0], phase: [0.1, 0.5] },
  wristR: { r: [55, 0, 0], phase: [0.1, 0.5] },
  handL: { g: 1, phase: [0.0, 0.3] }, handR: { g: 1, phase: [0.0, 0.3] },

  /* 腿：折成车架纵梁 + 中/后桥 */
  hipL: { r: [90, 0, 0], phase: [0.16, 0.64] },
  hipR: { r: [90, 0, 0], phase: [0.16, 0.64] },
  kneeL: { r: [0, 0, 0], phase: [0.16, 0.64] },
  kneeR: { r: [0, 0, 0], phase: [0.16, 0.64] },
  /* 踝：翻转 180° 成尾部平台，并沿车架后移/抬起，让开后桥轮 */
  ankleL: { p: [0, -1.58, -0.08], r: [90, 0, 0], phase: [0.42, 0.86] },
  ankleR: { p: [0, -1.58, -0.08], r: [90, 0, 0], phase: [0.42, 0.86] },
  toeL: { r: [-10, 0, 0], phase: [0.42, 0.86] },
  toeR: { r: [-10, 0, 0], phase: [0.42, 0.86] },

  /* 车身覆盖件 */
  windshield: { p: [0, 0.66, 0.45], r: [-13, 0, 0], phase: [0.46, 0.88] },
  roof: { r: [-90, 0, 0], phase: [0.50, 0.92] },
  grille: { p: [0, -0.16, 0.62], r: [0, 0, 0], phase: [0.56, 0.96] },
};

/* ---------------- 预设姿势（只作用于机器人态） ---------------- */
export const PRESETS = [
  { id: 'stand', name: '标准站姿', pose: {} },
  {
    id: 'hero', name: '英雄姿', pose: {
      waist: { r: [0, -9, 0] }, chest: { r: [-4, 0, 0] }, neck: { r: [0, 0, 0] }, head: { r: [-4, 10, 0] },
      shoulderR: { r: [-78, 6, 10] }, elbowR: { r: [-14, 0, 0] }, handR: { g: 0.85 },
      shoulderL: { r: [12, 0, -14] }, elbowL: { r: [-34, 0, 0] }, handL: { g: 0.7 },
      hipL: { r: [-4, 0, -7] }, hipR: { r: [4, 0, 7] }, kneeL: { r: [8, 0, 0] }, kneeR: { r: [10, 0, 0] },
      ankleL: { r: [-4, 0, 7] }, ankleR: { r: [-14, 0, -7] },
    },
  },
  {
    id: 'combat', name: '战斗架势', pose: {
      core: { p: [0, 2.88, 0.06] }, waist: { r: [0, 14, 0] }, chest: { r: [7, -6, 0] }, head: { r: [-6, -14, 0] },
      shoulderL: { r: [-52, 10, -16] }, elbowL: { r: [-96, 0, 0] }, wristL: { r: [-10, 0, 0] }, handL: { g: 1 },
      shoulderR: { r: [-44, -8, 14] }, elbowR: { r: [-104, 0, 0] }, wristR: { r: [-10, 0, 0] }, handR: { g: 1 },
      hipL: { r: [-26, 8, -9] }, kneeL: { r: [40, 0, 0] }, ankleL: { r: [-16, 0, 9] },
      hipR: { r: [16, -8, 9] }, kneeR: { r: [26, 0, 0] }, ankleR: { r: [-40, 0, -9] },
    },
  },
  {
    id: 'salute', name: '敬礼', pose: {
      chest: { r: [-2, 0, 0] }, head: { r: [-3, 0, 0] },
      shoulderR: { r: [-22, 0, -76] }, elbowR: { r: [-126, 0, 0] }, wristR: { r: [-18, 0, 20] }, handR: { g: 0.25 },
      shoulderL: { r: [2, 0, -3] }, elbowL: { r: [-6, 0, 0] }, handL: { g: 1 },
      hipL: { r: [0, 0, -2] }, hipR: { r: [0, 0, 2] }, kneeL: { r: [2, 0, 0] }, kneeR: { r: [2, 0, 0] },
    },
  },
  {
    id: 'wave', name: '挥手致意', pose: {
      chest: { r: [-2, 0, 6] }, head: { r: [-6, -8, 0] },
      shoulderR: { r: [-8, 0, -142] }, elbowR: { r: [-38, 0, 0] }, wristR: { r: [0, 0, 12] }, handR: { g: 0.05 },
      shoulderL: { r: [6, 0, -9] }, elbowL: { r: [-22, 0, 0] }, handL: { g: 0.5 },
      hipL: { r: [-2, 0, -3] }, hipR: { r: [-2, 0, 3] },
    },
  },
  {
    id: 'kneel', name: '单膝跪地', pose: {
      core: { p: [0, 1.85, 0.08] }, chest: { r: [9, 0, 0] }, head: { r: [-14, 0, 0] },
      hipL: { r: [-70, 2, -3] }, kneeL: { r: [113, 0, 0] }, ankleL: { r: [-43, 0, 3] }, toeL: { r: [6, 0, 0] },
      hipR: { r: [12, -2, 3] }, kneeR: { r: [84, 0, 0] }, ankleR: { r: [74, 0, 0] }, toeR: { r: [-16, 0, 0] },
      shoulderL: { r: [-30, 0, -10] }, elbowL: { r: [-46, 0, 0] }, handL: { g: 0.9 },
      shoulderR: { r: [-16, 0, 8] }, elbowR: { r: [-24, 0, 0] }, handR: { g: 0.9 },
    },
  },
  {
    id: 'point', name: '出发！(指向前方)', pose: {
      waist: { r: [0, -7, 0] }, chest: { r: [-5, 0, 0] }, head: { r: [-8, 8, 0] },
      shoulderR: { r: [-104, 4, 8] }, elbowR: { r: [-5, 0, 0] }, wristR: { r: [0, 0, 0] }, handR: { g: 0.08 },
      shoulderL: { r: [-16, 0, -22] }, elbowL: { r: [-58, 0, 0] }, handL: { g: 1 },
      hipL: { r: [-8, 0, -10] }, kneeL: { r: [12, 0, 0] }, ankleL: { r: [-6, 0, 10] },
      hipR: { r: [6, 0, 10] }, kneeR: { r: [8, 0, 0] }, ankleR: { r: [-16, 0, -10] },
    },
  },
  {
    id: 'tpose', name: 'T 字校准姿', pose: {
      shoulderL: { r: [0, 0, -90] }, shoulderR: { r: [0, 0, 90] },
      elbowL: { r: [0, 0, 0] }, elbowR: { r: [0, 0, 0] },
      wristL: { r: [0, 0, 0] }, wristR: { r: [0, 0, 0] }, handL: { g: 0 }, handR: { g: 0 },
      chest: { r: [0, 0, 0] }, head: { r: [0, 0, 0] },
      hipL: { r: [0, 0, 0] }, hipR: { r: [0, 0, 0] }, kneeL: { r: [0, 0, 0] }, kneeR: { r: [0, 0, 0] },
      ankleL: { r: [0, 0, 0] }, ankleR: { r: [0, 0, 0] }, stackL: { r: [0, 0, 0] }, stackR: { r: [0, 0, 0] },
    },
  },
];
