export const CONFIG = {
  seed: 20140530,

  world: {
    size: 900,            // 岛屿直径（米）
    maxHeight: 46,        // 山峰最大高度
    waterLevel: 0,        // 海平面
    beachLevel: 2.2,      // 沙滩高度上限
    rockSlope: 0.55,      // 岩石坡度阈值
    fogDay: 0x9db4c0,
    fogNight: 0x060a12,
  },

  time: {
    dayLength: 600,       // 一个昼夜的真实秒数（10分钟）
    startHour: 8,
  },

  player: {
    height: 1.7,
    radius: 0.45,
    walkSpeed: 4.6,
    runSpeed: 8.2,
    swimSpeed: 3.0,
    jumpSpeed: 6.5,
    gravity: 18,
    attackRange: 2.6,
    attackCooldown: 0.55,
  },

  survival: {
    hungerPerHour: 3.4,     // 每游戏小时消耗
    thirstPerHour: 5.2,
    energyPerHour: 2.6,
    starveDps: 1.2,         // 饥饿/口渴归零后的每秒伤害
    staminaRegen: 14,
    staminaRun: 9,
    staminaAttack: 12,
    healthRegen: 0.6,       // 吃饱喝足时每秒回血
  },

  trees: {
    count: 950,
    chopHp: 4,              // 砍几下倒
    logsPerTree: 3,
    respawnDays: 3,
  },

  vegetation: {
    ferns: 550,
    shrubs: 240,
    grassPatches: 1600,
    boulders: 130,
    mossRocks: 220,
    stumps: 45,
    deadTrunks: 35,
    berryBushes: 90,
  },

  enemies: {
    maxNight: 6,
    maxDay: 2,
    speed: 3.4,
    runSpeed: 6.4,
    hp: 60,
    damage: 12,
    attackRange: 1.9,
    aggroRange: 46,
    nightAggroRange: 70,
  },

  animals: {
    rabbits: 26,
  },

  graphics: {
    shadowMapSize: 2048,
    shadowRadius: 60,
    viewDistance: 520,
  },
};
