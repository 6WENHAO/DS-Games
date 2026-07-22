/**
 * 载具数据表（数值以“游戏性近似”为准，非严格史实）
 */
export const TANKS = {
  t34: {
    id: 't34',
    model: 'tank_green',
    name: 'T-34-85',
    nation: '苏联',
    br: '5.7',
    hp: 100,
    length: 6.8,
    maxSpeed: 15.0,       // m/s ≈ 54 km/h
    reverseSpeed: 4.2,
    accel: 6.5,
    hullTurnRate: 0.72,   // rad/s
    turretRate: 0.42,     // rad/s ≈ 24°/s
    gunPitch: { min: -0.09, max: 0.38 },
    reload: 7.2,
    camo: 0x33502a,
    armor: {
      hull: { front: 75, side: 45, rear: 40, top: 20 },
      turret: { front: 90, side: 75, rear: 52, top: 20 },
    },
    shells: {
      AP: { name: 'BR-365 穿甲弹', pen: 148, vel: 260, dmg: [34, 48], count: 35 },
      HE: { name: 'O-365 榴弹', pen: 16, vel: 240, dmg: [14, 26], splash: 7, count: 20 },
    },
    stats: { fire: 72, armor: 58, mob: 82 },
    desc: '均衡的中型坦克，倾斜装甲与优秀机动的完美结合。',
  },
  sherman: {
    id: 'sherman',
    model: 'tank_olive',
    name: 'M4A2 谢尔曼',
    nation: '美国',
    br: '4.7',
    hp: 100,
    length: 6.3,
    maxSpeed: 13.0,
    reverseSpeed: 4.0,
    accel: 6.0,
    hullTurnRate: 0.66,
    turretRate: 0.52,
    gunPitch: { min: -0.17, max: 0.42 },
    reload: 5.6,
    camo: 0x3d4a2c,
    armor: {
      hull: { front: 63, side: 38, rear: 38, top: 19 },
      turret: { front: 76, side: 51, rear: 51, top: 19 },
    },
    shells: {
      AP: { name: 'M61 被帽穿甲弹', pen: 128, vel: 250, dmg: [30, 42], count: 40 },
      HE: { name: 'M48 榴弹', pen: 14, vel: 235, dmg: [12, 22], splash: 6, count: 20 },
    },
    stats: { fire: 64, armor: 50, mob: 74 },
    desc: '装填飞快的多面手，垂直稳定的炮塔转速冠绝群雄。',
  },
  tiger: {
    id: 'tiger',
    model: 'tank_desert',
    name: '虎式 H1',
    nation: '德国',
    br: '5.7',
    hp: 115,
    length: 7.2,
    maxSpeed: 11.5,
    reverseSpeed: 3.2,
    accel: 4.6,
    hullTurnRate: 0.5,
    turretRate: 0.28,
    gunPitch: { min: -0.14, max: 0.30 },
    reload: 8.6,
    camo: 0x6b5a34,
    armor: {
      hull: { front: 102, side: 82, rear: 82, top: 26 },
      turret: { front: 120, side: 82, rear: 82, top: 26 },
    },
    shells: {
      AP: { name: 'PzGr.39 穿甲弹', pen: 170, vel: 275, dmg: [40, 55], count: 34 },
      HE: { name: 'SprGr. 榴弹', pen: 15, vel: 255, dmg: [13, 24], splash: 7, count: 18 },
    },
    stats: { fire: 84, armor: 80, mob: 56 },
    desc: '丛林之王。88毫米炮与厚重方正的装甲让对手闻风丧胆。',
  },
  is2: {
    id: 'is2',
    model: 'tank_red',
    name: 'IS-2 1944型',
    nation: '苏联',
    br: '6.3',
    hp: 120,
    length: 7.0,
    maxSpeed: 10.5,
    reverseSpeed: 3.0,
    accel: 4.2,
    hullTurnRate: 0.46,
    turretRate: 0.24,
    gunPitch: { min: -0.05, max: 0.34 },
    reload: 11.5,
    camo: 0x4a2c22,
    armor: {
      hull: { front: 110, side: 95, rear: 60, top: 28 },
      turret: { front: 100, side: 90, rear: 60, top: 28 },
    },
    shells: {
      AP: { name: 'BR-471B 穿甲弹', pen: 192, vel: 265, dmg: [55, 75], count: 20 },
      HE: { name: 'OF-471 榴弹', pen: 20, vel: 250, dmg: [22, 40], splash: 9, count: 8 },
    },
    stats: { fire: 95, armor: 84, mob: 48 },
    desc: '122毫米重锤，一发定乾坤；漫长装填间请找好掩体。',
  },
};

export const TANK_LIST = ['t34', 'sherman', 'tiger', 'is2'];

export const AI_NAMES_A = ['雷雨', '白桦', '猎手07', '铁拳', '暴风雪', '红星', '闪电', '孤狼'];
export const AI_NAMES_B = ['毒蛇', '秃鹫', '黑豹指挥', '掷弹兵', '沙暴', '钢铁伯爵', '幽灵', '猎豹'];
