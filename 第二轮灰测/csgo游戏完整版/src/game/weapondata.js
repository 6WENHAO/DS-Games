/**
 * weapondata.js —— CS:GO / CS2 风格武器数值总表（纯数据 + 纯函数，无副作用）
 *
 * ============================ 单位约定 ============================
 * price          美元整数（购买菜单价格）
 * damage         基础伤害（未计护甲、未计距离衰减、未计命中部位倍率）
 * armorPen       护甲穿透率 0..1。等于 CS 武器脚本里的 armor_ratio / 2
 *                （例：AK-47 armor_ratio 1.55 -> armorPen 0.775）
 * rpm            每分钟射速；射击间隔 = 60 / rpm 秒
 * magSize        弹匣容量；reserveAmmo 备弹总数
 * reloadTime     换弹总时长（秒）；drawTime 切枪到可开火时长（秒）
 * range          最大有效距离（米）。由 CS 单位换算：units * 0.01905
 *                （8192 units ≈ 156.06 米，3000 units ≈ 57.15 米）
 * rangeMod       每 500 CS 单位（≈9.525 米）的伤害衰减系数（CS range_modifier）
 * penetration    穿墙能力 0..2（手枪 0.5~1.0，AK 约 1.0，AWP 约 1.95）
 * inacc 系列       精度族，单位是 CS 的 inaccuracy 原始值，
 *                调用方自行 * 0.0002 转成弧度（CS 引擎的换算常数）
 *                inaccStand 站立 / inaccMove 移动 / inaccCrouch 下蹲 /
 *                inaccJump 跳跃 / spread 固定散布
 * recoilMag      后坐力幅度（度/发，第一发量级；与 pattern 配合使用）
 * pattern        长度 30 的喷射轨迹：每项 [dx, dy]，归一化到大约 -1..1，
 *                dy 为正表示准心往上抬，dx 为正表示往右偏。
 *                注意它描述的是"第 N 发时准心相对原点的偏移位置"，
 *                不是逐发增量，方便直接画喷射弹道图。
 * recoveryTime   后坐力恢复时间常数（秒）
 * moveSpeed      持枪最大移动速度（CS 单位/秒，如 AK 215、AWP 200、刀 250）
 * zoomMoveSpeed  开镜后的最大移动速度（CS 单位/秒，可选字段）
 * killAward      击杀奖励（美元）
 * pellets        弹丸数（霰弹枪 8/9，其余 1）
 * auto           是否全自动；burst 是否具备连发模式（Glock/FAMAS）
 * zoom           null 或 [fov1] / [fov1, fov2]，开镜后的垂直 FOV（度）
 * team           't' / 'ct' / 'both'
 * slot           'primary' | 'secondary' | 'melee' | 'grenade' | 'gear'
 * class          'rifle'|'sniper'|'smg'|'shotgun'|'mg'|'pistol'|'knife'|'taser'|'grenade'|'gear'
 * sound          必须等于 'fire_' + 武器 id；刀 / 装备为 null
 * viewmodel      第一人称方块模型描述（相机空间，米；X 右、Y 上、Z 向前为负）
 *
 * ============================ 公式来源 ============================
 * 1) 距离衰减：damage_at_dist = damage * rangeMod ^ (dist_units / 500)
 *    与 CS:GO 的 CBaseEntity::TraceAttack 中 flRangeModifier 迭代一致。
 * 2) 护甲：CS 的 ScaleDamageArmor 近似为
 *      newDamage = damage * armorPen
 *      armorLoss = (damage - newDamage) * 0.5     // ArmorBonusRatio = 0.5
 *    只有"命中部位实际被护甲覆盖"才减免：头部必须戴头盔，
 *    胸/腹/手臂算防弹衣覆盖，腿部 CS 里永远不受护甲保护。
 * 3) 近似之处：护甲耗尽时 CS 会走 "flArmor = armor / 0.5; newDamage = damage - flArmor"
 *    的分支，本文件的 armorPenetratedDamage 只收到 hasArmor 布尔值，
 *    因此不模拟"半甲穿透"的退化分支，由调用方在扣甲后自行判断。
 * 4) 精度族与 recoil/pattern 的具体数字来自公开的 CS:GO 武器脚本量级，
 *    部分武器（见各条目 "// 近似" 标记）为合理近似，不保证逐帧一致。
 */

/** 喷射弹道固定长度（发） */
const PATTERN_LENGTH = 30;

/** CS 单位 -> 米 的换算常数 */
const UNIT_TO_METER = 0.01905;

/** 每 500 CS 单位对应的米数，用于距离衰减 */
const METERS_PER_STEP = 500 * UNIT_TO_METER; // ≈ 9.525 米

/** 护甲吸收系数（CS 的 ArmorBonusRatio） */
const ARMOR_BONUS_RATIO = 0.5;

/**
 * 确定性伪随机（纯函数，无 Math.random），给弹道加"手抖"扰动。
 * 同样的 (i, seed) 永远得到同样的结果，保证数据表可复现。
 */
function noise(i, seed) {
  const x = Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1; // -1..1
}

/** 夹取到 -1..1 并保留 4 位小数，避免浮点噪声 */
function clampUnit(v) {
  const c = v < -1 ? -1 : v > 1 ? 1 : v;
  return Math.round(c * 10000) / 10000;
}

/**
 * 由关键帧生成长度 30 的喷射轨迹。
 * keys: [[shotIndex, dx, dy], ...]，shotIndex 递增，首尾自动补齐；
 * jitter: 横向抖动幅度（纵向抖动取其一半）；seed: 抖动种子。
 */
function buildPattern(keys, jitter = 0, seed = 1) {
  const out = [];
  for (let i = 0; i < PATTERN_LENGTH; i++) {
    let k1 = keys[0];
    let k2 = keys[keys.length - 1];
    for (let k = 0; k < keys.length - 1; k++) {
      if (i >= keys[k][0] && i <= keys[k + 1][0]) {
        k1 = keys[k];
        k2 = keys[k + 1];
        break;
      }
    }
    const span = k2[0] - k1[0];
    const t = span === 0 ? 0 : (i - k1[0]) / span;
    const dx = k1[1] + (k2[1] - k1[1]) * t + noise(i, seed) * jitter;
    const dy = k1[2] + (k2[2] - k1[2]) * t + noise(i + 97, seed) * jitter * 0.5;
    out.push([clampUnit(dx), clampUnit(dy)]);
  }
  return out;
}

/**
 * 生成"画圈"型弹道（P90 / Negev 这类高射速武器的典型形态）。
 */
function buildSpiralPattern(opts) {
  const radius = opts.radius === undefined ? 0.4 : opts.radius;
  const turns = opts.turns === undefined ? 2 : opts.turns;
  const rise = opts.rise === undefined ? 0.8 : opts.rise;
  const phase = opts.phase === undefined ? 0 : opts.phase;
  const jitter = opts.jitter === undefined ? 0 : opts.jitter;
  const seed = opts.seed === undefined ? 5 : opts.seed;
  const out = [];
  for (let i = 0; i < PATTERN_LENGTH; i++) {
    const t = i / (PATTERN_LENGTH - 1);
    const ang = phase + t * turns * Math.PI * 2;
    const r = radius * Math.min(1, t * 2.5);
    const dx = Math.sin(ang) * r + noise(i, seed) * jitter;
    const dy = rise * Math.min(1, t * 2.2) + Math.cos(ang) * r * 0.45 + noise(i + 41, seed) * jitter * 0.5;
    out.push([clampUnit(dx), clampUnit(dy)]);
  }
  return out;
}

/** 全 0 弹道（栓动狙击枪 / 刀 / 电枪：每发都从零开始） */
function zeroPattern() {
  const out = [];
  for (let i = 0; i < PATTERN_LENGTH; i++) out.push([0, 0]);
  return out;
}

/* ================================================================
 * WEAPONS：全部枪械 / 近战 / 电枪
 * ================================================================ */
export const WEAPONS = {
  /* ---------------- 近战：默认武器，移速最快，背刺 1500 奖励 ---------------- */
  knife: {
    // 刀：砍 40 / 背刺秒杀。这里只给"正面挥砍"的基础伤害；背刺倍率由引擎处理。// 近似
    name: 'Knife', nameCN: '匕首', team: 'both', slot: 'melee', class: 'knife',
    price: 0, killAward: 1500,
    damage: 40, armorPen: 0.85, pellets: 1,
    rpm: 150, auto: false, burst: false,
    magSize: 0, reserveAmmo: 0, reloadTime: 0, drawTime: 0.4,
    range: 1.5, rangeMod: 1.0, penetration: 0,
    inaccStand: 0, inaccMove: 0, inaccCrouch: 0, inaccJump: 0, spread: 0,
    recoilMag: 0, recoveryTime: 0.1, moveSpeed: 250, zoom: null,
    sound: null,
    pattern: zeroPattern(),
    viewmodel: {
      origin: [0.17, -0.15, -0.28],
      parts: [
        { name: 'blade', pos: [0, 0.02, -0.16], size: [0.008, 0.032, 0.22], color: '#c8ccd4' },
        { name: 'edge', pos: [0, -0.005, -0.18], size: [0.009, 0.010, 0.19], color: '#e8ecf2' },
        { name: 'guard', pos: [0, 0.0, -0.03], size: [0.05, 0.014, 0.02], color: '#3a3a3f' },
        { name: 'grip', pos: [0, -0.01, 0.06], size: [0.026, 0.030, 0.13], color: '#1c1c1e' },
        { name: 'pommel', pos: [0, -0.01, 0.13], size: [0.03, 0.034, 0.02], color: '#2b2b2f' }
      ],
      muzzle: [0, 0.02, -0.28],
      shellEject: [0, 0, 0]
    }
  },

  /* ================================================================
   * 手枪（secondary）：击杀奖励 300，唯一例外是 CZ75-Auto 的 100
   * 首回合默认：T 用 Glock-18，CT 用 USP-S / P2000
   * ================================================================ */

  glock18: {
    // Glock-18：T 默认手枪，20 发弹匣，右键 3 连发
    name: 'Glock-18', nameCN: 'Glock', team: 't', slot: 'secondary', class: 'pistol',
    price: 200, killAward: 300,
    damage: 30, armorPen: 0.47, pellets: 1,
    rpm: 400, auto: false, burst: true,
    magSize: 20, reserveAmmo: 120, reloadTime: 2.2, drawTime: 0.7,
    range: 156.06, rangeMod: 0.99, penetration: 0.6,
    inaccStand: 8.2, inaccMove: 100.0, inaccCrouch: 6.4, inaccJump: 130.0, spread: 0.5,
    recoilMag: 1.5, recoveryTime: 0.28, moveSpeed: 240, zoom: null,
    sound: 'fire_glock18',
    pattern: buildPattern([[0, 0, 0], [4, 0.04, 0.30], [10, -0.10, 0.48], [18, 0.14, 0.58], [29, -0.08, 0.62]], 0.14, 21),
    viewmodel: {
      origin: [0.14, -0.14, -0.26],
      parts: [
        { name: 'slide', pos: [0, 0.02, -0.06], size: [0.030, 0.030, 0.17], color: '#2b2b2f' },
        { name: 'barrel', pos: [0, 0.02, -0.16], size: [0.014, 0.014, 0.03], color: '#141416' },
        { name: 'frame', pos: [0, -0.02, 0.01], size: [0.028, 0.042, 0.10], color: '#1c1c1e' },
        { name: 'grip', pos: [0, -0.08, 0.02], size: [0.026, 0.085, 0.038], color: '#26262a', rot: [0.18, 0, 0] },
        { name: 'trigger', pos: [0, -0.035, -0.02], size: [0.010, 0.022, 0.012], color: '#141416' }
      ],
      muzzle: [0, 0.022, -0.19],
      shellEject: [0.025, 0.03, -0.03]
    }
  },

  usp_s: {
    // USP-S：CT 默认手枪，消音、精度高，35 伤害头部一枪（无盔）
    name: 'USP-S', nameCN: '消音手枪', team: 'ct', slot: 'secondary', class: 'pistol',
    price: 200, killAward: 300,
    damage: 35, armorPen: 0.505, pellets: 1,
    rpm: 352, auto: false, burst: false,
    magSize: 12, reserveAmmo: 24, reloadTime: 2.2, drawTime: 0.7,
    range: 156.06, rangeMod: 0.79, penetration: 0.7,
    inaccStand: 6.0, inaccMove: 95.0, inaccCrouch: 4.6, inaccJump: 125.0, spread: 0.42,
    recoilMag: 1.6, recoveryTime: 0.30, moveSpeed: 240, zoom: null,
    sound: 'fire_usp_s',
    pattern: buildPattern([[0, 0, 0], [4, -0.05, 0.32], [10, 0.09, 0.50], [18, -0.12, 0.58], [29, 0.10, 0.62]], 0.10, 22),
    viewmodel: {
      origin: [0.14, -0.14, -0.27],
      parts: [
        { name: 'slide', pos: [0, 0.02, -0.06], size: [0.030, 0.030, 0.16], color: '#2b2b2f' },
        { name: 'suppressor', pos: [0, 0.02, -0.21], size: [0.026, 0.026, 0.14], color: '#1a1a1c' },
        { name: 'frame', pos: [0, -0.02, 0.01], size: [0.028, 0.040, 0.10], color: '#1c1c1e' },
        { name: 'grip', pos: [0, -0.08, 0.02], size: [0.026, 0.085, 0.038], color: '#33302b', rot: [0.18, 0, 0] },
        { name: 'sight', pos: [0, 0.038, -0.12], size: [0.012, 0.010, 0.014], color: '#141416' }
      ],
      muzzle: [0, 0.022, -0.29],
      shellEject: [0.025, 0.03, -0.03]
    }
  },

  p2000: {
    // P2000：CT 另一把默认手枪，弹匣 13、备弹更多，无消音
    name: 'P2000', nameCN: 'P2000', team: 'ct', slot: 'secondary', class: 'pistol',
    price: 200, killAward: 300,
    damage: 35, armorPen: 0.505, pellets: 1,
    rpm: 352, auto: false, burst: false,
    magSize: 13, reserveAmmo: 52, reloadTime: 2.2, drawTime: 0.7,
    range: 156.06, rangeMod: 0.79, penetration: 0.7,
    inaccStand: 6.4, inaccMove: 98.0, inaccCrouch: 4.9, inaccJump: 128.0, spread: 0.44,
    recoilMag: 1.6, recoveryTime: 0.30, moveSpeed: 240, zoom: null,
    sound: 'fire_p2000',
    pattern: buildPattern([[0, 0, 0], [4, 0.05, 0.32], [10, -0.09, 0.50], [18, 0.12, 0.58], [29, -0.10, 0.62]], 0.11, 23),
    viewmodel: {
      origin: [0.14, -0.14, -0.26],
      parts: [
        { name: 'slide', pos: [0, 0.02, -0.06], size: [0.031, 0.030, 0.17], color: '#31313a' },
        { name: 'barrel', pos: [0, 0.02, -0.16], size: [0.014, 0.014, 0.03], color: '#141416' },
        { name: 'frame', pos: [0, -0.02, 0.01], size: [0.029, 0.042, 0.10], color: '#1c1c1e' },
        { name: 'grip', pos: [0, -0.08, 0.02], size: [0.027, 0.086, 0.040], color: '#26262a', rot: [0.18, 0, 0] },
        { name: 'rail', pos: [0, -0.035, -0.09], size: [0.016, 0.012, 0.05], color: '#141416' }
      ],
      muzzle: [0, 0.022, -0.19],
      shellEject: [0.025, 0.03, -0.03]
    }
  },

  p250: {
    // P250：性价比手枪，38 伤害 + 64.5% 穿甲，300 块的爆头利器
    name: 'P250', nameCN: 'P250', team: 'both', slot: 'secondary', class: 'pistol',
    price: 300, killAward: 300,
    damage: 38, armorPen: 0.645, pellets: 1,
    rpm: 400, auto: false, burst: false,
    magSize: 13, reserveAmmo: 26, reloadTime: 2.3, drawTime: 0.7,
    range: 156.06, rangeMod: 0.90, penetration: 0.7,
    inaccStand: 7.0, inaccMove: 102.0, inaccCrouch: 5.4, inaccJump: 132.0, spread: 0.5,
    recoilMag: 1.8, recoveryTime: 0.30, moveSpeed: 240, zoom: null,
    sound: 'fire_p250',
    pattern: buildPattern([[0, 0, 0], [4, 0.06, 0.36], [10, -0.12, 0.54], [18, 0.15, 0.62], [29, -0.10, 0.66]], 0.13, 24),
    viewmodel: {
      origin: [0.14, -0.14, -0.26],
      parts: [
        { name: 'slide', pos: [0, 0.02, -0.05], size: [0.032, 0.032, 0.16], color: '#2f2f34' },
        { name: 'barrel', pos: [0, 0.02, -0.15], size: [0.015, 0.015, 0.04], color: '#141416' },
        { name: 'frame', pos: [0, -0.02, 0.01], size: [0.030, 0.042, 0.10], color: '#1c1c1e' },
        { name: 'grip', pos: [0, -0.08, 0.02], size: [0.028, 0.084, 0.042], color: '#3a3226', rot: [0.18, 0, 0] },
        { name: 'hammer', pos: [0, 0.03, 0.05], size: [0.012, 0.018, 0.014], color: '#9aa0a6' }
      ],
      muzzle: [0, 0.022, -0.18],
      shellEject: [0.026, 0.03, -0.02]
    }
  },

  deagle: {
    // 沙漠之鹰：63 伤害 / 93% 穿甲，远距离一枪爆头，7 发弹匣
    name: 'Desert Eagle', nameCN: '沙鹰', team: 'both', slot: 'secondary', class: 'pistol',
    price: 700, killAward: 300,
    damage: 63, armorPen: 0.93, pellets: 1,
    rpm: 267, auto: false, burst: false,
    magSize: 7, reserveAmmo: 35, reloadTime: 2.2, drawTime: 0.8,
    range: 156.06, rangeMod: 0.81, penetration: 0.95,
    inaccStand: 8.8, inaccMove: 130.0, inaccCrouch: 6.6, inaccJump: 170.0, spread: 0.4,
    recoilMag: 3.6, recoveryTime: 0.44, moveSpeed: 230, zoom: null,
    sound: 'fire_deagle',
    pattern: buildPattern([[0, 0, 0], [3, 0.08, 0.44], [8, -0.16, 0.66], [16, 0.20, 0.78], [29, -0.14, 0.84]], 0.16, 25),
    viewmodel: {
      origin: [0.15, -0.14, -0.28],
      parts: [
        { name: 'slide', pos: [0, 0.025, -0.07], size: [0.040, 0.042, 0.20], color: '#9aa0a6' },
        { name: 'barrel', pos: [0, 0.025, -0.19], size: [0.024, 0.026, 0.06], color: '#7d838a' },
        { name: 'frame', pos: [0, -0.02, 0.01], size: [0.034, 0.044, 0.11], color: '#8b9096' },
        { name: 'grip', pos: [0, -0.085, 0.03], size: [0.030, 0.090, 0.046], color: '#26262a', rot: [0.2, 0, 0] },
        { name: 'sight', pos: [0, 0.05, -0.16], size: [0.014, 0.012, 0.016], color: '#141416' },
        { name: 'trigger', pos: [0, -0.035, -0.01], size: [0.012, 0.024, 0.014], color: '#141416' }
      ],
      muzzle: [0, 0.026, -0.23],
      shellEject: [0.032, 0.035, -0.03]
    }
  },

  r8: {
    // R8 左轮：86 伤害 / 93% 穿甲，右键快速击发。射速与开火延迟为近似值 // 近似
    name: 'R8 Revolver', nameCN: 'R8 左轮', team: 'both', slot: 'secondary', class: 'pistol',
    price: 600, killAward: 300,
    damage: 86, armorPen: 0.93, pellets: 1,
    rpm: 116, auto: false, burst: false,
    magSize: 8, reserveAmmo: 8, reloadTime: 2.6, drawTime: 1.0,
    range: 156.06, rangeMod: 0.87, penetration: 1.0,
    inaccStand: 9.0, inaccMove: 145.0, inaccCrouch: 6.8, inaccJump: 185.0, spread: 0.35,
    recoilMag: 4.2, recoveryTime: 0.52, moveSpeed: 220, zoom: null,
    sound: 'fire_r8',
    pattern: buildPattern([[0, 0, 0], [3, 0.10, 0.50], [8, -0.20, 0.72], [16, 0.22, 0.84], [29, -0.18, 0.90]], 0.18, 26),
    viewmodel: {
      origin: [0.15, -0.14, -0.29],
      parts: [
        { name: 'barrel', pos: [0, 0.02, -0.20], size: [0.026, 0.030, 0.20], color: '#2b2b2f' },
        { name: 'cylinder', pos: [0, 0.015, -0.05], size: [0.046, 0.048, 0.07], color: '#3a3a3f' },
        { name: 'frame', pos: [0, -0.01, 0.03], size: [0.026, 0.050, 0.10], color: '#26262a' },
        { name: 'grip', pos: [0, -0.09, 0.06], size: [0.030, 0.095, 0.048], color: '#4a3a28', rot: [0.22, 0, 0] },
        { name: 'sight', pos: [0, 0.045, -0.24], size: [0.012, 0.012, 0.016], color: '#141416' }
      ],
      muzzle: [0, 0.022, -0.31],
      shellEject: [0.03, 0.02, -0.05]
    }
  },

  dualberettas: {
    // 双持贝瑞塔：30 发（两把各 15）、扫射压制。价格 300 为 CS2 版本 // 近似
    name: 'Dual Berettas', nameCN: '双枪', team: 'both', slot: 'secondary', class: 'pistol',
    price: 300, killAward: 300,
    damage: 38, armorPen: 0.575, pellets: 1,
    rpm: 500, auto: false, burst: false,
    magSize: 30, reserveAmmo: 120, reloadTime: 4.6, drawTime: 1.2,
    range: 156.06, rangeMod: 0.86, penetration: 0.6,
    inaccStand: 9.5, inaccMove: 115.0, inaccCrouch: 7.6, inaccJump: 150.0, spread: 0.6,
    recoilMag: 2.0, recoveryTime: 0.32, moveSpeed: 240, zoom: null,
    sound: 'fire_dualberettas',
    pattern: buildPattern([[0, 0, 0], [4, -0.18, 0.34], [10, 0.22, 0.52], [18, -0.26, 0.62], [29, 0.24, 0.66]], 0.2, 27),
    viewmodel: {
      origin: [0.0, -0.15, -0.28],
      parts: [
        { name: 'slideR', pos: [0.13, 0.02, -0.05], size: [0.030, 0.030, 0.16], color: '#31313a' },
        { name: 'gripR', pos: [0.13, -0.07, 0.02], size: [0.026, 0.082, 0.040], color: '#1c1c1e', rot: [0.18, 0, 0] },
        { name: 'slideL', pos: [-0.13, 0.02, -0.05], size: [0.030, 0.030, 0.16], color: '#31313a' },
        { name: 'gripL', pos: [-0.13, -0.07, 0.02], size: [0.026, 0.082, 0.040], color: '#1c1c1e', rot: [0.18, 0, 0] },
        { name: 'barrelR', pos: [0.13, 0.02, -0.15], size: [0.014, 0.014, 0.04], color: '#141416' },
        { name: 'barrelL', pos: [-0.13, 0.02, -0.15], size: [0.014, 0.014, 0.04], color: '#141416' }
      ],
      muzzle: [0.13, 0.022, -0.19],
      shellEject: [0.16, 0.03, -0.02]
    }
  },

  fiveseven: {
    // Five-SeveN：CT 高穿甲手枪，20 发弹匣，中距离稳定
    name: 'Five-SeveN', nameCN: 'FN57', team: 'ct', slot: 'secondary', class: 'pistol',
    price: 500, killAward: 300,
    damage: 32, armorPen: 0.685, pellets: 1,
    rpm: 400, auto: false, burst: false,
    magSize: 20, reserveAmmo: 100, reloadTime: 2.7, drawTime: 0.8,
    range: 156.06, rangeMod: 0.96, penetration: 0.75,
    inaccStand: 7.2, inaccMove: 105.0, inaccCrouch: 5.6, inaccJump: 135.0, spread: 0.5,
    recoilMag: 1.7, recoveryTime: 0.29, moveSpeed: 240, zoom: null,
    sound: 'fire_fiveseven',
    pattern: buildPattern([[0, 0, 0], [4, 0.05, 0.32], [10, -0.10, 0.48], [18, 0.14, 0.58], [29, -0.12, 0.62]], 0.12, 28),
    viewmodel: {
      origin: [0.14, -0.14, -0.26],
      parts: [
        { name: 'slide', pos: [0, 0.02, -0.06], size: [0.031, 0.031, 0.17], color: '#3a3a3f' },
        { name: 'barrel', pos: [0, 0.02, -0.16], size: [0.014, 0.014, 0.03], color: '#141416' },
        { name: 'frame', pos: [0, -0.02, 0.01], size: [0.030, 0.044, 0.11], color: '#4a4a50' },
        { name: 'grip', pos: [0, -0.085, 0.02], size: [0.028, 0.090, 0.042], color: '#26262a', rot: [0.18, 0, 0] },
        { name: 'sight', pos: [0, 0.04, -0.13], size: [0.012, 0.010, 0.014], color: '#141416' }
      ],
      muzzle: [0, 0.022, -0.19],
      shellEject: [0.026, 0.03, -0.03]
    }
  },

  tec9: {
    // Tec-9：T 高穿甲快速点射手枪，跑打强。弹匣 / 穿甲为近似值 // 近似
    name: 'Tec-9', nameCN: 'Tec9', team: 't', slot: 'secondary', class: 'pistol',
    price: 500, killAward: 300,
    damage: 33, armorPen: 0.9075, pellets: 1,
    rpm: 500, auto: false, burst: false,
    magSize: 18, reserveAmmo: 90, reloadTime: 2.4, drawTime: 0.8,
    range: 156.06, rangeMod: 0.90, penetration: 0.75,
    inaccStand: 9.0, inaccMove: 112.0, inaccCrouch: 7.2, inaccJump: 145.0, spread: 0.6,
    recoilMag: 1.9, recoveryTime: 0.28, moveSpeed: 240, zoom: null,
    sound: 'fire_tec9',
    pattern: buildPattern([[0, 0, 0], [4, 0.08, 0.34], [10, -0.16, 0.50], [18, 0.20, 0.60], [29, -0.18, 0.64]], 0.18, 29),
    viewmodel: {
      origin: [0.14, -0.14, -0.27],
      parts: [
        { name: 'body', pos: [0, 0.015, -0.07], size: [0.030, 0.046, 0.20], color: '#2b2b2f' },
        { name: 'shroud', pos: [0, 0.03, -0.18], size: [0.022, 0.022, 0.08], color: '#1a1a1c' },
        { name: 'mag', pos: [0, -0.08, -0.02], size: [0.024, 0.10, 0.036], color: '#26262a' },
        { name: 'grip', pos: [0, -0.06, 0.05], size: [0.026, 0.070, 0.040], color: '#1c1c1e', rot: [0.16, 0, 0] },
        { name: 'sight', pos: [0, 0.045, -0.14], size: [0.012, 0.012, 0.014], color: '#141416' }
      ],
      muzzle: [0, 0.03, -0.23],
      shellEject: [0.026, 0.03, -0.04]
    }
  },

  cz75: {
    // CZ75-Auto：全自动手枪，12 发打完就得换弹，击杀奖励只有 100 // 近似
    name: 'CZ75-Auto', nameCN: 'CZ75', team: 'both', slot: 'secondary', class: 'pistol',
    price: 500, killAward: 100,
    damage: 33, armorPen: 0.79, pellets: 1,
    rpm: 1100, auto: true, burst: false,
    magSize: 12, reserveAmmo: 12, reloadTime: 2.7, drawTime: 0.8,
    range: 156.06, rangeMod: 0.81, penetration: 0.6,
    inaccStand: 8.4, inaccMove: 110.0, inaccCrouch: 6.6, inaccJump: 142.0, spread: 0.55,
    recoilMag: 2.1, recoveryTime: 0.34, moveSpeed: 240, zoom: null,
    sound: 'fire_cz75',
    pattern: buildPattern([[0, 0, 0], [3, 0.03, 0.42], [7, 0.10, 0.66], [12, 0.28, 0.78], [20, -0.24, 0.84], [29, 0.26, 0.88]], 0.14, 30),
    viewmodel: {
      origin: [0.14, -0.14, -0.26],
      parts: [
        { name: 'slide', pos: [0, 0.02, -0.06], size: [0.030, 0.032, 0.16], color: '#26262a' },
        { name: 'barrel', pos: [0, 0.02, -0.15], size: [0.014, 0.014, 0.04], color: '#141416' },
        { name: 'frame', pos: [0, -0.02, 0.01], size: [0.028, 0.042, 0.10], color: '#1c1c1e' },
        { name: 'grip', pos: [0, -0.08, 0.02], size: [0.027, 0.086, 0.040], color: '#3a3226', rot: [0.18, 0, 0] },
        { name: 'selector', pos: [0.018, 0.0, 0.0], size: [0.008, 0.012, 0.016], color: '#9aa0a6' }
      ],
      muzzle: [0, 0.022, -0.18],
      shellEject: [0.025, 0.03, -0.03]
    }
  },
  /* ================================================================
   * 微型冲锋枪（SMG）：击杀奖励 600（P90 例外，只有 300）
   * 特点：移速快、跑打精度好、远距离衰减明显（rangeMod 低）
   * ================================================================ */

  mp9: {
    // MP9：CT 便宜快枪，857 RPM，起手/残局神器
    name: 'MP9', nameCN: 'MP9', team: 'ct', slot: 'primary', class: 'smg',
    price: 1250, killAward: 600,
    damage: 26, armorPen: 0.605, pellets: 1,
    rpm: 857, auto: true, burst: false,
    magSize: 30, reserveAmmo: 120, reloadTime: 2.1, drawTime: 0.9,
    range: 156.06, rangeMod: 0.75, penetration: 0.65,
    inaccStand: 6.6, inaccMove: 54.0, inaccCrouch: 5.3, inaccJump: 120.0, spread: 0.75,
    recoilMag: 1.2, recoveryTime: 0.26, moveSpeed: 240, zoom: null,
    sound: 'fire_mp9',
    pattern: buildPattern([[0, 0, 0], [3, 0.02, 0.34], [7, 0.10, 0.56], [12, 0.26, 0.68], [18, -0.14, 0.74], [24, -0.30, 0.76], [29, 0.18, 0.78]], 0.16, 41),
    viewmodel: {
      origin: [0.16, -0.15, -0.30],
      parts: [
        { name: 'body', pos: [0, 0, -0.04], size: [0.042, 0.062, 0.26], color: '#2b2b2f' },
        { name: 'barrel', pos: [0, 0.012, -0.20], size: [0.018, 0.018, 0.08], color: '#141416' },
        { name: 'mag', pos: [0, -0.08, -0.02], size: [0.030, 0.10, 0.040], color: '#26262a' },
        { name: 'grip', pos: [0, -0.06, 0.08], size: [0.032, 0.075, 0.042], color: '#1c1c1e' },
        { name: 'stock', pos: [0, 0.0, 0.16], size: [0.026, 0.038, 0.10], color: '#26262a' },
        { name: 'sight', pos: [0, 0.045, -0.06], size: [0.016, 0.020, 0.05], color: '#141416' }
      ],
      muzzle: [0, 0.012, -0.26],
      shellEject: [0.035, 0.012, -0.06]
    }
  },

  mac10: {
    // MAC-10：T 版廉价快枪，1050 块，扫射后坐力散但近距离极凶 // 近似
    name: 'MAC-10', nameCN: 'MAC10', team: 't', slot: 'primary', class: 'smg',
    price: 1050, killAward: 600,
    damage: 29, armorPen: 0.475, pellets: 1,
    rpm: 800, auto: true, burst: false,
    magSize: 30, reserveAmmo: 100, reloadTime: 2.7, drawTime: 0.9,
    range: 156.06, rangeMod: 0.82, penetration: 0.6,
    inaccStand: 7.4, inaccMove: 58.0, inaccCrouch: 6.0, inaccJump: 128.0, spread: 0.85,
    recoilMag: 1.35, recoveryTime: 0.27, moveSpeed: 240, zoom: null,
    sound: 'fire_mac10',
    pattern: buildPattern([[0, 0, 0], [3, -0.04, 0.34], [7, -0.14, 0.56], [12, -0.30, 0.70], [18, 0.16, 0.76], [24, 0.34, 0.78], [29, -0.20, 0.80]], 0.2, 42),
    viewmodel: {
      origin: [0.16, -0.15, -0.28],
      parts: [
        { name: 'body', pos: [0, 0.01, -0.02], size: [0.046, 0.070, 0.20], color: '#1f1f22' },
        { name: 'barrel', pos: [0, 0.02, -0.15], size: [0.016, 0.016, 0.07], color: '#141416' },
        { name: 'mag', pos: [0, -0.09, -0.03], size: [0.028, 0.11, 0.036], color: '#26262a' },
        { name: 'grip', pos: [0, -0.055, 0.08], size: [0.030, 0.070, 0.040], color: '#1c1c1e' },
        { name: 'stock', pos: [0, 0.005, 0.14], size: [0.020, 0.030, 0.10], color: '#3a3a3f' }
      ],
      muzzle: [0, 0.02, -0.20],
      shellEject: [0.038, 0.02, -0.04]
    }
  },

  mp7: {
    // MP7：稳定的中价 SMG，伤害与穿甲为近似值 // 近似
    name: 'MP7', nameCN: 'MP7', team: 'both', slot: 'primary', class: 'smg',
    price: 1500, killAward: 600,
    damage: 29, armorPen: 0.625, pellets: 1,
    rpm: 750, auto: true, burst: false,
    magSize: 30, reserveAmmo: 120, reloadTime: 3.4, drawTime: 1.0,
    range: 156.06, rangeMod: 0.86, penetration: 0.7,
    inaccStand: 6.2, inaccMove: 52.0, inaccCrouch: 5.0, inaccJump: 118.0, spread: 0.7,
    recoilMag: 1.25, recoveryTime: 0.28, moveSpeed: 220, zoom: null,
    sound: 'fire_mp7',
    pattern: buildPattern([[0, 0, 0], [4, 0.02, 0.38], [8, 0.08, 0.60], [13, 0.22, 0.72], [19, -0.10, 0.78], [25, -0.24, 0.80], [29, 0.14, 0.82]], 0.13, 43),
    viewmodel: {
      origin: [0.16, -0.15, -0.30],
      parts: [
        { name: 'body', pos: [0, 0, -0.04], size: [0.044, 0.066, 0.26], color: '#26262a' },
        { name: 'barrel', pos: [0, 0.012, -0.21], size: [0.018, 0.018, 0.09], color: '#141416' },
        { name: 'mag', pos: [0, -0.075, 0.0], size: [0.028, 0.095, 0.038], color: '#1c1c1e' },
        { name: 'grip', pos: [0, -0.055, 0.09], size: [0.032, 0.070, 0.044], color: '#1f1f22' },
        { name: 'stock', pos: [0, 0.005, 0.17], size: [0.024, 0.034, 0.09], color: '#2b2b2f' },
        { name: 'rail', pos: [0, 0.042, -0.08], size: [0.020, 0.012, 0.14], color: '#141416' }
      ],
      muzzle: [0, 0.012, -0.28],
      shellEject: [0.036, 0.012, -0.06]
    }
  },

  mp5sd: {
    // MP5-SD：消音版 MP7，弹道更稳、声音更小（数值贴近 MP7）// 近似
    name: 'MP5-SD', nameCN: 'MP5', team: 'both', slot: 'primary', class: 'smg',
    price: 1500, killAward: 600,
    damage: 27, armorPen: 0.625, pellets: 1,
    rpm: 750, auto: true, burst: false,
    magSize: 30, reserveAmmo: 120, reloadTime: 2.7, drawTime: 1.0,
    range: 156.06, rangeMod: 0.85, penetration: 0.7,
    inaccStand: 5.9, inaccMove: 50.0, inaccCrouch: 4.7, inaccJump: 115.0, spread: 0.68,
    recoilMag: 1.15, recoveryTime: 0.27, moveSpeed: 235, zoom: null,
    sound: 'fire_mp5sd',
    pattern: buildPattern([[0, 0, 0], [4, -0.02, 0.36], [8, -0.08, 0.58], [13, -0.20, 0.70], [19, 0.10, 0.76], [25, 0.22, 0.78], [29, -0.12, 0.80]], 0.11, 44),
    viewmodel: {
      origin: [0.16, -0.15, -0.31],
      parts: [
        { name: 'body', pos: [0, 0, -0.02], size: [0.042, 0.064, 0.24], color: '#1f1f22' },
        { name: 'suppressor', pos: [0, 0.012, -0.22], size: [0.026, 0.026, 0.16], color: '#141416' },
        { name: 'mag', pos: [0, -0.085, -0.01], size: [0.028, 0.105, 0.038], color: '#26262a', rot: [0.12, 0, 0] },
        { name: 'grip', pos: [0, -0.055, 0.09], size: [0.030, 0.070, 0.042], color: '#1c1c1e' },
        { name: 'stock', pos: [0, 0.0, 0.16], size: [0.024, 0.036, 0.10], color: '#2b2b2f' },
        { name: 'sight', pos: [0, 0.048, -0.10], size: [0.018, 0.024, 0.04], color: '#141416' }
      ],
      muzzle: [0, 0.012, -0.32],
      shellEject: [0.034, 0.012, -0.04]
    }
  },

  ump45: {
    // UMP-45：35 伤害的高性价比 SMG，近中距离两枪身体带走残血
    name: 'UMP-45', nameCN: 'UMP', team: 'both', slot: 'primary', class: 'smg',
    price: 1200, killAward: 600,
    damage: 35, armorPen: 0.65, pellets: 1,
    rpm: 666, auto: true, burst: false,
    magSize: 25, reserveAmmo: 100, reloadTime: 3.5, drawTime: 1.0,
    range: 156.06, rangeMod: 0.82, penetration: 0.7,
    inaccStand: 6.8, inaccMove: 56.0, inaccCrouch: 5.4, inaccJump: 122.0, spread: 0.72,
    recoilMag: 1.5, recoveryTime: 0.30, moveSpeed: 230, zoom: null,
    sound: 'fire_ump45',
    pattern: buildPattern([[0, 0, 0], [4, 0.03, 0.40], [8, 0.12, 0.62], [13, 0.26, 0.74], [19, -0.12, 0.80], [25, -0.28, 0.82], [29, 0.16, 0.84]], 0.15, 45),
    viewmodel: {
      origin: [0.16, -0.15, -0.30],
      parts: [
        { name: 'body', pos: [0, 0, -0.03], size: [0.044, 0.068, 0.25], color: '#2f2f34' },
        { name: 'barrel', pos: [0, 0.012, -0.20], size: [0.020, 0.020, 0.08], color: '#141416' },
        { name: 'mag', pos: [0, -0.085, -0.01], size: [0.030, 0.105, 0.042], color: '#1c1c1e' },
        { name: 'grip', pos: [0, -0.06, 0.09], size: [0.032, 0.075, 0.044], color: '#26262a' },
        { name: 'stock', pos: [0, 0.0, 0.17], size: [0.026, 0.040, 0.10], color: '#2b2b2f' },
        { name: 'handguard', pos: [0, -0.02, -0.13], size: [0.036, 0.040, 0.10], color: '#26262a' }
      ],
      muzzle: [0, 0.012, -0.26],
      shellEject: [0.036, 0.012, -0.05]
    }
  },

  p90: {
    // P90：50 发大弹匣 + 857 RPM，跑打压制流；击杀奖励只有 300
    name: 'P90', nameCN: 'P90', team: 'both', slot: 'primary', class: 'smg',
    price: 2350, killAward: 300,
    damage: 26, armorPen: 0.69, pellets: 1,
    rpm: 857, auto: true, burst: false,
    magSize: 50, reserveAmmo: 100, reloadTime: 3.4, drawTime: 1.1,
    range: 156.06, rangeMod: 0.84, penetration: 0.75,
    inaccStand: 6.9, inaccMove: 57.0, inaccCrouch: 5.5, inaccJump: 124.0, spread: 0.78,
    recoilMag: 1.3, recoveryTime: 0.29, moveSpeed: 230, zoom: null,
    sound: 'fire_p90',
    // P90 的喷射轨迹是典型的"画圈"形态
    pattern: buildSpiralPattern({ radius: 0.46, turns: 2.2, rise: 0.72, phase: 0.3, jitter: 0.06, seed: 46 }),
    viewmodel: {
      origin: [0.16, -0.15, -0.32],
      parts: [
        { name: 'shell', pos: [0, -0.01, -0.02], size: [0.055, 0.075, 0.34], color: '#c9ccd1' },
        { name: 'magtop', pos: [0, 0.045, 0.02], size: [0.050, 0.028, 0.22], color: '#b3b7bd' },
        { name: 'barrel', pos: [0, -0.01, -0.22], size: [0.018, 0.018, 0.08], color: '#141416' },
        { name: 'grip', pos: [0, -0.065, 0.02], size: [0.034, 0.070, 0.048], color: '#8a8e94' },
        { name: 'sight', pos: [0, 0.075, -0.02], size: [0.024, 0.026, 0.08], color: '#26262a' },
        { name: 'foregrip', pos: [0, -0.05, -0.14], size: [0.030, 0.045, 0.05], color: '#8a8e94' }
      ],
      muzzle: [0, -0.01, -0.28],
      shellEject: [0.02, -0.05, -0.06]
    }
  },

  bizon: {
    // PP-Bizon：64 发弹鼓、换弹快，穿甲低所以打甲吃亏 // 近似
    name: 'PP-Bizon', nameCN: '野牛', team: 'both', slot: 'primary', class: 'smg',
    price: 1400, killAward: 600,
    damage: 27, armorPen: 0.60, pellets: 1,
    rpm: 750, auto: true, burst: false,
    magSize: 64, reserveAmmo: 120, reloadTime: 2.4, drawTime: 1.0,
    range: 156.06, rangeMod: 0.79, penetration: 0.6,
    inaccStand: 7.0, inaccMove: 55.0, inaccCrouch: 5.6, inaccJump: 126.0, spread: 0.8,
    recoilMag: 1.2, recoveryTime: 0.27, moveSpeed: 240, zoom: null,
    sound: 'fire_bizon',
    pattern: buildPattern([[0, 0, 0], [4, 0.02, 0.32], [9, 0.06, 0.54], [15, -0.18, 0.66], [22, -0.34, 0.72], [29, 0.20, 0.74]], 0.14, 47),
    viewmodel: {
      origin: [0.16, -0.15, -0.30],
      parts: [
        { name: 'body', pos: [0, 0, -0.04], size: [0.042, 0.062, 0.26], color: '#26262a' },
        { name: 'drum', pos: [0, -0.055, -0.10], size: [0.048, 0.055, 0.18], color: '#1f1f22', rot: [0, 0, 0] },
        { name: 'barrel', pos: [0, 0.012, -0.21], size: [0.016, 0.016, 0.07], color: '#141416' },
        { name: 'grip', pos: [0, -0.06, 0.08], size: [0.032, 0.075, 0.044], color: '#1c1c1e' },
        { name: 'stock', pos: [0, 0.0, 0.16], size: [0.024, 0.038, 0.10], color: '#2b2b2f' }
      ],
      muzzle: [0, 0.012, -0.27],
      shellEject: [0.034, 0.012, -0.06]
    }
  },

  /* ================================================================
   * 步枪（rifle）：击杀奖励 300，比赛的核心武器
   * AK-47 一枪爆头（含头盔），M4 系列需要 CT 更好的控枪
   * ================================================================ */

  ak47: {
    // AK-47：T 主力，36 伤害 + 77.5% 穿甲，任何距离爆头即杀（含头盔）
    name: 'AK-47', nameCN: 'AK47', team: 't', slot: 'primary', class: 'rifle',
    price: 2700, killAward: 300,
    damage: 36, armorPen: 0.775, pellets: 1,
    rpm: 600, auto: true, burst: false,
    magSize: 30, reserveAmmo: 90, reloadTime: 2.5, drawTime: 1.0,
    range: 156.06, rangeMod: 0.98, penetration: 1.0,
    inaccStand: 6.4, inaccMove: 141.0, inaccCrouch: 4.81, inaccJump: 168.0, spread: 0.44,
    recoilMag: 2.2, recoveryTime: 0.36, moveSpeed: 215, zoom: null,
    sound: 'fire_ak47',
    // 经典"7 字"喷射：前 7~9 发几乎垂直上抬，随后拉右、回左、再往右
    pattern: buildPattern([
      [0, 0.00, 0.00], [1, 0.02, 0.28], [2, -0.01, 0.50], [3, 0.03, 0.66], [4, 0.01, 0.78],
      [5, 0.05, 0.86], [6, 0.10, 0.92], [7, 0.22, 0.96], [8, 0.38, 1.00], [9, 0.52, 0.98],
      [10, 0.62, 0.95], [11, 0.58, 0.93], [12, 0.44, 0.91], [13, 0.24, 0.90], [14, 0.02, 0.91],
      [15, -0.20, 0.92], [16, -0.42, 0.93], [17, -0.60, 0.94], [18, -0.72, 0.93], [19, -0.66, 0.91],
      [20, -0.48, 0.90], [21, -0.26, 0.90], [22, -0.02, 0.91], [23, 0.20, 0.92], [24, 0.40, 0.93],
      [25, 0.54, 0.92], [26, 0.44, 0.90], [27, 0.22, 0.89], [28, -0.04, 0.90], [29, -0.28, 0.91]
    ], 0.05, 11),
    viewmodel: {
      origin: [0.16, -0.16, -0.32],
      parts: [
        { name: 'body', pos: [0, 0, 0], size: [0.05, 0.07, 0.36], color: '#6b4a2b' },
        { name: 'barrel', pos: [0, 0.012, -0.26], size: [0.022, 0.022, 0.20], color: '#1c1c1e' },
        { name: 'mag', pos: [0, -0.09, -0.02], size: [0.04, 0.13, 0.06], color: '#4a3520', rot: [0.28, 0, 0] },
        { name: 'stock', pos: [0, -0.01, 0.22], size: [0.04, 0.06, 0.14], color: '#6b4a2b' },
        { name: 'grip', pos: [0, -0.07, 0.10], size: [0.035, 0.10, 0.045], color: '#4a3520' },
        { name: 'gasblock', pos: [0, 0.045, -0.14], size: [0.026, 0.026, 0.10], color: '#26262a' },
        { name: 'sight', pos: [0, 0.055, -0.30], size: [0.014, 0.020, 0.02], color: '#141416' }
      ],
      muzzle: [0, 0.015, -0.46],
      shellEject: [0.04, 0.01, -0.05]
    }
  },

  m4a4: {
    // M4A4：CT 主力，33 伤害、666 RPM，弹道抖但可控
    name: 'M4A4', nameCN: 'M4A4', team: 'ct', slot: 'primary', class: 'rifle',
    price: 2900, killAward: 300,
    damage: 33, armorPen: 0.70, pellets: 1,
    rpm: 666, auto: true, burst: false,
    magSize: 30, reserveAmmo: 90, reloadTime: 3.1, drawTime: 1.0,
    range: 156.06, rangeMod: 0.97, penetration: 1.0,
    inaccStand: 6.0, inaccMove: 132.0, inaccCrouch: 4.57, inaccJump: 160.0, spread: 0.4,
    recoilMag: 1.9, recoveryTime: 0.34, moveSpeed: 225, zoom: null,
    sound: 'fire_m4a4',
    // M4A4：抬升比 AK 小，但左右抖动更碎
    pattern: buildPattern([
      [0, 0.00, 0.00], [2, 0.02, 0.42], [4, -0.03, 0.62], [6, 0.06, 0.76], [8, 0.14, 0.85],
      [10, 0.30, 0.90], [12, 0.16, 0.88], [14, -0.08, 0.86], [16, -0.28, 0.87], [18, -0.36, 0.88],
      [20, -0.14, 0.86], [22, 0.12, 0.85], [24, 0.28, 0.86], [26, 0.12, 0.85], [28, -0.14, 0.86],
      [29, -0.24, 0.86]
    ], 0.1, 12),
    viewmodel: {
      origin: [0.16, -0.16, -0.32],
      parts: [
        { name: 'body', pos: [0, 0, 0], size: [0.048, 0.068, 0.34], color: '#2b2b2f' },
        { name: 'barrel', pos: [0, 0.01, -0.26], size: [0.020, 0.020, 0.22], color: '#1c1c1e' },
        { name: 'handguard', pos: [0, 0.008, -0.20], size: [0.038, 0.040, 0.14], color: '#26262a' },
        { name: 'mag', pos: [0, -0.09, -0.01], size: [0.036, 0.12, 0.05], color: '#1f1f22' },
        { name: 'stock', pos: [0, -0.005, 0.22], size: [0.038, 0.058, 0.15], color: '#2b2b2f' },
        { name: 'grip', pos: [0, -0.07, 0.10], size: [0.034, 0.095, 0.044], color: '#1f1f22' },
        { name: 'carryhandle', pos: [0, 0.055, 0.02], size: [0.022, 0.024, 0.16], color: '#141416' }
      ],
      muzzle: [0, 0.012, -0.46],
      shellEject: [0.038, 0.008, -0.04]
    }
  },

  m4a1s: {
    // M4A1-S：消音、38 伤害、600 RPM，20 发弹匣，前 10 发极稳
    name: 'M4A1-S', nameCN: '消音M4', team: 'ct', slot: 'primary', class: 'rifle',
    price: 2900, killAward: 300,
    damage: 38, armorPen: 0.70, pellets: 1,
    rpm: 600, auto: true, burst: false,
    magSize: 20, reserveAmmo: 80, reloadTime: 3.1, drawTime: 1.0,
    range: 156.06, rangeMod: 0.99, penetration: 1.0,
    inaccStand: 5.4, inaccMove: 126.0, inaccCrouch: 4.11, inaccJump: 155.0, spread: 0.35,
    recoilMag: 1.7, recoveryTime: 0.33, moveSpeed: 225, zoom: null,
    sound: 'fire_m4a1s',
    pattern: buildPattern([
      [0, 0.00, 0.00], [2, 0.01, 0.38], [4, -0.02, 0.56], [6, 0.04, 0.70], [8, 0.10, 0.80],
      [10, 0.22, 0.85], [12, 0.10, 0.84], [14, -0.06, 0.82], [16, -0.22, 0.83], [18, -0.30, 0.84],
      [21, -0.10, 0.82], [24, 0.20, 0.83], [27, 0.08, 0.82], [29, -0.16, 0.83]
    ], 0.06, 13),
    viewmodel: {
      origin: [0.16, -0.16, -0.33],
      parts: [
        { name: 'body', pos: [0, 0, 0], size: [0.048, 0.068, 0.34], color: '#26262a' },
        { name: 'suppressor', pos: [0, 0.01, -0.30], size: [0.030, 0.030, 0.20], color: '#141416' },
        { name: 'handguard', pos: [0, 0.008, -0.18], size: [0.038, 0.040, 0.14], color: '#2b2b2f' },
        { name: 'mag', pos: [0, -0.085, -0.01], size: [0.036, 0.11, 0.05], color: '#1f1f22' },
        { name: 'stock', pos: [0, -0.005, 0.22], size: [0.038, 0.058, 0.15], color: '#26262a' },
        { name: 'grip', pos: [0, -0.07, 0.10], size: [0.034, 0.095, 0.044], color: '#1f1f22' },
        { name: 'rail', pos: [0, 0.05, -0.04], size: [0.020, 0.014, 0.20], color: '#141416' }
      ],
      muzzle: [0, 0.012, -0.50],
      shellEject: [0.038, 0.008, -0.04]
    }
  },

  galil: {
    // Galil AR：T 廉价步枪，30 伤害 + 77.5% 穿甲，35 发弹匣，弹道较散
    name: 'Galil AR', nameCN: '加利尔', team: 't', slot: 'primary', class: 'rifle',
    price: 1800, killAward: 300,
    damage: 30, armorPen: 0.775, pellets: 1,
    rpm: 666, auto: true, burst: false,
    magSize: 35, reserveAmmo: 90, reloadTime: 3.0, drawTime: 1.1,
    range: 156.06, rangeMod: 0.98, penetration: 1.0,
    inaccStand: 7.2, inaccMove: 145.0, inaccCrouch: 5.4, inaccJump: 175.0, spread: 0.55,
    recoilMag: 2.0, recoveryTime: 0.37, moveSpeed: 215, zoom: null,
    sound: 'fire_galil',
    pattern: buildPattern([
      [0, 0.00, 0.00], [3, 0.03, 0.48], [6, 0.08, 0.72], [9, 0.28, 0.86], [12, 0.50, 0.90],
      [15, 0.22, 0.88], [18, -0.30, 0.87], [21, -0.58, 0.88], [24, -0.24, 0.87], [27, 0.34, 0.88],
      [29, 0.52, 0.88]
    ], 0.14, 14),
    viewmodel: {
      origin: [0.16, -0.16, -0.32],
      parts: [
        { name: 'body', pos: [0, 0, 0], size: [0.048, 0.070, 0.32], color: '#3a3226' },
        { name: 'barrel', pos: [0, 0.012, -0.24], size: [0.020, 0.020, 0.18], color: '#1c1c1e' },
        { name: 'mag', pos: [0, -0.095, -0.02], size: [0.038, 0.135, 0.055], color: '#2b2b2f', rot: [0.2, 0, 0] },
        { name: 'stock', pos: [0, -0.005, 0.20], size: [0.034, 0.050, 0.13], color: '#26262a' },
        { name: 'grip', pos: [0, -0.07, 0.09], size: [0.034, 0.095, 0.044], color: '#26262a' },
        { name: 'handle', pos: [0, 0.05, -0.06], size: [0.020, 0.020, 0.10], color: '#141416' }
      ],
      muzzle: [0, 0.014, -0.42],
      shellEject: [0.038, 0.01, -0.05]
    }
  },

  famas: {
    // FAMAS：CT 廉价步枪，右键 3 连发（burst），弹道抖
    name: 'FAMAS', nameCN: '法玛斯', team: 'ct', slot: 'primary', class: 'rifle',
    price: 2050, killAward: 300,
    damage: 30, armorPen: 0.70, pellets: 1,
    rpm: 666, auto: true, burst: true,
    magSize: 25, reserveAmmo: 90, reloadTime: 3.3, drawTime: 1.1,
    range: 156.06, rangeMod: 0.97, penetration: 1.0,
    inaccStand: 7.0, inaccMove: 140.0, inaccCrouch: 5.3, inaccJump: 172.0, spread: 0.5,
    recoilMag: 1.95, recoveryTime: 0.36, moveSpeed: 220, zoom: null,
    sound: 'fire_famas',
    pattern: buildPattern([
      [0, 0.00, 0.00], [3, -0.03, 0.46], [6, -0.10, 0.70], [9, -0.30, 0.84], [12, -0.48, 0.88],
      [15, -0.18, 0.86], [18, 0.28, 0.85], [21, 0.54, 0.86], [24, 0.22, 0.85], [27, -0.30, 0.86],
      [29, -0.48, 0.86]
    ], 0.12, 15),
    viewmodel: {
      origin: [0.16, -0.16, -0.31],
      parts: [
        { name: 'body', pos: [0, 0, 0.02], size: [0.046, 0.075, 0.34], color: '#2f2f34' },
        { name: 'barrel', pos: [0, 0.015, -0.24], size: [0.018, 0.018, 0.16], color: '#1c1c1e' },
        { name: 'carryhandle', pos: [0, 0.06, -0.04], size: [0.020, 0.030, 0.20], color: '#26262a' },
        { name: 'mag', pos: [0, -0.085, 0.06], size: [0.034, 0.105, 0.05], color: '#1f1f22' },
        { name: 'grip', pos: [0, -0.065, -0.04], size: [0.032, 0.085, 0.042], color: '#1f1f22' },
        { name: 'stock', pos: [0, -0.005, 0.20], size: [0.036, 0.060, 0.10], color: '#2f2f34' }
      ],
      muzzle: [0, 0.016, -0.40],
      shellEject: [0.036, 0.01, -0.02]
    }
  },

  aug: {
    // AUG：CT 带镜步枪，90% 穿甲、开镜精准，开镜后移速大幅下降
    name: 'AUG', nameCN: 'AUG', team: 'ct', slot: 'primary', class: 'rifle',
    price: 3300, killAward: 300,
    damage: 28, armorPen: 0.90, pellets: 1,
    rpm: 666, auto: true, burst: false,
    magSize: 30, reserveAmmo: 90, reloadTime: 3.8, drawTime: 1.2,
    range: 156.06, rangeMod: 0.90, penetration: 1.05,
    inaccStand: 5.8, inaccMove: 130.0, inaccCrouch: 4.4, inaccJump: 158.0, spread: 0.38,
    recoilMag: 1.85, recoveryTime: 0.35, moveSpeed: 220, zoom: [40], zoomMoveSpeed: 145,
    sound: 'fire_aug',
    pattern: buildPattern([
      [0, 0.00, 0.00], [3, 0.02, 0.44], [6, 0.06, 0.66], [9, 0.20, 0.80], [12, 0.34, 0.84],
      [15, 0.14, 0.83], [18, -0.22, 0.82], [21, -0.40, 0.83], [24, -0.16, 0.82], [27, 0.24, 0.83],
      [29, 0.36, 0.83]
    ], 0.07, 16),
    viewmodel: {
      origin: [0.16, -0.16, -0.31],
      parts: [
        { name: 'body', pos: [0, 0, 0.02], size: [0.050, 0.078, 0.32], color: '#3f4238' },
        { name: 'barrel', pos: [0, 0.012, -0.24], size: [0.020, 0.020, 0.18], color: '#1c1c1e' },
        { name: 'scope', pos: [0, 0.065, -0.02], size: [0.032, 0.032, 0.16], color: '#141416' },
        { name: 'mag', pos: [0, -0.085, 0.08], size: [0.036, 0.105, 0.05], color: '#2b2b2f' },
        { name: 'grip', pos: [0, -0.065, -0.04], size: [0.032, 0.085, 0.044], color: '#26262a' },
        { name: 'foregrip', pos: [0, -0.05, -0.16], size: [0.030, 0.055, 0.05], color: '#3f4238', rot: [0.3, 0, 0] }
      ],
      muzzle: [0, 0.014, -0.42],
      shellEject: [0.04, 0.01, -0.02]
    }
  },

  sg553: {
    // SG 553：T 带镜步枪，开镜后精度极高。穿甲值为近似 // 近似
    name: 'SG 553', nameCN: '鸟狙', team: 't', slot: 'primary', class: 'rifle',
    price: 3000, killAward: 300,
    damage: 30, armorPen: 0.70, pellets: 1,
    rpm: 545, auto: true, burst: false,
    magSize: 30, reserveAmmo: 90, reloadTime: 3.3, drawTime: 1.2,
    range: 156.06, rangeMod: 0.98, penetration: 1.05,
    inaccStand: 6.2, inaccMove: 138.0, inaccCrouch: 4.7, inaccJump: 165.0, spread: 0.4,
    recoilMag: 2.05, recoveryTime: 0.36, moveSpeed: 210, zoom: [40], zoomMoveSpeed: 150,
    sound: 'fire_sg553',
    pattern: buildPattern([
      [0, 0.00, 0.00], [3, -0.02, 0.46], [6, -0.06, 0.70], [9, -0.22, 0.84], [12, -0.38, 0.88],
      [15, -0.14, 0.87], [18, 0.26, 0.86], [21, 0.46, 0.87], [24, 0.18, 0.86], [27, -0.26, 0.87],
      [29, -0.40, 0.87]
    ], 0.08, 17),
    viewmodel: {
      origin: [0.16, -0.16, -0.32],
      parts: [
        { name: 'body', pos: [0, 0, 0], size: [0.048, 0.072, 0.34], color: '#2b2b2f' },
        { name: 'barrel', pos: [0, 0.012, -0.26], size: [0.020, 0.020, 0.18], color: '#1c1c1e' },
        { name: 'scope', pos: [0, 0.062, -0.02], size: [0.030, 0.030, 0.15], color: '#141416' },
        { name: 'mag', pos: [0, -0.09, -0.01], size: [0.036, 0.115, 0.05], color: '#1f1f22', rot: [0.14, 0, 0] },
        { name: 'stock', pos: [0, -0.005, 0.21], size: [0.036, 0.056, 0.13], color: '#2b2b2f' },
        { name: 'grip', pos: [0, -0.07, 0.09], size: [0.034, 0.092, 0.044], color: '#1f1f22' }
      ],
      muzzle: [0, 0.014, -0.44],
      shellEject: [0.038, 0.01, -0.05]
    }
  },
  /* ================================================================
   * 狙击枪（sniper）：AWP 击杀奖励只有 100，其余 300
   * 精度族给的是"未开镜"的值；开镜后引擎应把 inaccuracy 视为 ≈ 0
   * ================================================================ */

  awp: {
    // AWP：大狙，115 伤害，胸口一枪带走满血满甲；开镜两级 FOV
    name: 'AWP', nameCN: '大狙', team: 'both', slot: 'primary', class: 'sniper',
    price: 4750, killAward: 100,
    damage: 115, armorPen: 0.975, pellets: 1,
    rpm: 41, auto: false, burst: false,
    magSize: 10, reserveAmmo: 30, reloadTime: 3.7, drawTime: 1.36,
    range: 156.06, rangeMod: 0.99, penetration: 1.95,
    inaccStand: 200.0, inaccMove: 380.0, inaccCrouch: 190.0, inaccJump: 800.0, spread: 0,
    recoilMag: 6.0, recoveryTime: 0.9, moveSpeed: 200, zoom: [40, 10], zoomMoveSpeed: 150,
    sound: 'fire_awp',
    // 栓动枪每发之间都会完全复位，所以 pattern 全 0
    pattern: zeroPattern(),
    viewmodel: {
      origin: [0.15, -0.15, -0.34],
      parts: [
        { name: 'body', pos: [0, 0, 0.02], size: [0.048, 0.072, 0.40], color: '#3b4a35' },
        { name: 'barrel', pos: [0, 0.01, -0.34], size: [0.022, 0.022, 0.34], color: '#1c1c1e' },
        { name: 'scope', pos: [0, 0.072, -0.04], size: [0.040, 0.040, 0.24], color: '#141416' },
        { name: 'scopelens', pos: [0, 0.072, -0.17], size: [0.036, 0.036, 0.02], color: '#3aa0ff' },
        { name: 'bolt', pos: [0.03, 0.03, 0.10], size: [0.026, 0.016, 0.05], color: '#9aa0a6' },
        { name: 'mag', pos: [0, -0.07, 0.02], size: [0.032, 0.07, 0.07], color: '#26262a' },
        { name: 'stock', pos: [0, -0.01, 0.26], size: [0.040, 0.075, 0.16], color: '#3b4a35' },
        { name: 'grip', pos: [0, -0.075, 0.12], size: [0.034, 0.095, 0.046], color: '#2c3729' }
      ],
      muzzle: [0, 0.012, -0.54],
      shellEject: [0.04, 0.02, 0.06]
    }
  },

  ssg08: {
    // SSG-08（鸟狙/警枪）：1700 块的跳狙神器，88 伤害，腿部也能重创
    name: 'SSG 08', nameCN: '鸟狙', team: 'both', slot: 'primary', class: 'sniper',
    price: 1700, killAward: 300,
    damage: 88, armorPen: 0.85, pellets: 1,
    rpm: 48, auto: false, burst: false,
    magSize: 10, reserveAmmo: 90, reloadTime: 3.7, drawTime: 1.25,
    range: 156.06, rangeMod: 0.98, penetration: 1.75,
    inaccStand: 160.0, inaccMove: 300.0, inaccCrouch: 150.0, inaccJump: 640.0, spread: 0,
    recoilMag: 4.4, recoveryTime: 0.75, moveSpeed: 230, zoom: [40, 15], zoomMoveSpeed: 120,
    sound: 'fire_ssg08',
    pattern: zeroPattern(),
    viewmodel: {
      origin: [0.15, -0.15, -0.33],
      parts: [
        { name: 'body', pos: [0, 0, 0.02], size: [0.044, 0.066, 0.36], color: '#2b2b2f' },
        { name: 'barrel', pos: [0, 0.01, -0.30], size: [0.018, 0.018, 0.26], color: '#1c1c1e' },
        { name: 'scope', pos: [0, 0.066, -0.02], size: [0.032, 0.032, 0.20], color: '#141416' },
        { name: 'scopelens', pos: [0, 0.066, -0.13], size: [0.028, 0.028, 0.02], color: '#3aa0ff' },
        { name: 'mag', pos: [0, -0.065, 0.02], size: [0.030, 0.065, 0.06], color: '#26262a' },
        { name: 'stock', pos: [0, -0.01, 0.24], size: [0.036, 0.068, 0.15], color: '#33333a' }
      ],
      muzzle: [0, 0.012, -0.46],
      shellEject: [0.036, 0.02, 0.06]
    }
  },

  scar20: {
    // SCAR-20：CT 自动狙，80 伤害；射速与穿甲为近似值 // 近似
    name: 'SCAR-20', nameCN: '自动狙', team: 'ct', slot: 'primary', class: 'sniper',
    price: 5000, killAward: 300,
    damage: 80, armorPen: 0.80, pellets: 1,
    rpm: 240, auto: true, burst: false,
    magSize: 20, reserveAmmo: 90, reloadTime: 3.9, drawTime: 1.4,
    range: 156.06, rangeMod: 0.99, penetration: 1.8,
    inaccStand: 150.0, inaccMove: 290.0, inaccCrouch: 140.0, inaccJump: 620.0, spread: 0,
    recoilMag: 3.2, recoveryTime: 0.6, moveSpeed: 215, zoom: [40, 15], zoomMoveSpeed: 120,
    sound: 'fire_scar20',
    pattern: buildPattern([[0, 0, 0], [4, 0.04, 0.30], [10, 0.12, 0.50], [18, -0.14, 0.58], [29, 0.16, 0.62]], 0.06, 51),
    viewmodel: {
      origin: [0.15, -0.15, -0.33],
      parts: [
        { name: 'body', pos: [0, 0, 0.02], size: [0.050, 0.074, 0.38], color: '#3a3a3f' },
        { name: 'barrel', pos: [0, 0.01, -0.30], size: [0.022, 0.022, 0.26], color: '#1c1c1e' },
        { name: 'scope', pos: [0, 0.070, -0.02], size: [0.034, 0.034, 0.22], color: '#141416' },
        { name: 'mag', pos: [0, -0.085, 0.0], size: [0.034, 0.10, 0.055], color: '#26262a' },
        { name: 'stock', pos: [0, -0.005, 0.24], size: [0.038, 0.070, 0.15], color: '#3a3a3f' },
        { name: 'grip', pos: [0, -0.07, 0.12], size: [0.034, 0.092, 0.046], color: '#26262a' }
      ],
      muzzle: [0, 0.012, -0.48],
      shellEject: [0.04, 0.012, -0.02]
    }
  },

  g3sg1: {
    // G3SG1：T 自动狙，与 SCAR-20 同级，换弹更慢 // 近似
    name: 'G3SG1', nameCN: 'T自动狙', team: 't', slot: 'primary', class: 'sniper',
    price: 5000, killAward: 300,
    damage: 80, armorPen: 0.80, pellets: 1,
    rpm: 240, auto: true, burst: false,
    magSize: 20, reserveAmmo: 90, reloadTime: 4.7, drawTime: 1.4,
    range: 156.06, rangeMod: 0.98, penetration: 1.8,
    inaccStand: 155.0, inaccMove: 295.0, inaccCrouch: 145.0, inaccJump: 630.0, spread: 0,
    recoilMag: 3.3, recoveryTime: 0.62, moveSpeed: 215, zoom: [40, 15], zoomMoveSpeed: 120,
    sound: 'fire_g3sg1',
    pattern: buildPattern([[0, 0, 0], [4, -0.04, 0.30], [10, -0.12, 0.50], [18, 0.14, 0.58], [29, -0.16, 0.62]], 0.06, 52),
    viewmodel: {
      origin: [0.15, -0.15, -0.33],
      parts: [
        { name: 'body', pos: [0, 0, 0.02], size: [0.050, 0.076, 0.38], color: '#26262a' },
        { name: 'barrel', pos: [0, 0.01, -0.30], size: [0.022, 0.022, 0.26], color: '#1c1c1e' },
        { name: 'scope', pos: [0, 0.070, -0.02], size: [0.034, 0.034, 0.22], color: '#141416' },
        { name: 'mag', pos: [0, -0.09, 0.0], size: [0.034, 0.105, 0.055], color: '#1f1f22', rot: [0.1, 0, 0] },
        { name: 'stock', pos: [0, -0.005, 0.24], size: [0.040, 0.072, 0.16], color: '#3a3226' },
        { name: 'handguard', pos: [0, -0.01, -0.18], size: [0.040, 0.045, 0.14], color: '#3a3226' }
      ],
      muzzle: [0, 0.012, -0.48],
      shellEject: [0.04, 0.012, -0.02]
    }
  },

  /* ================================================================
   * 霰弹枪（shotgun）：击杀奖励 900，多弹丸、超短射程、剧烈衰减
   * damage 是"单颗弹丸"的伤害，实际伤害 = 命中弹丸数 * 单发伤害
   * spread 是弹丸锥形散布（CS inaccuracy 单位）
   * ================================================================ */

  nova: {
    // Nova：最便宜的霰弹枪，9 颗弹丸，贴身一枪 // 近似
    name: 'Nova', nameCN: '喷子', team: 'both', slot: 'primary', class: 'shotgun',
    price: 1050, killAward: 900,
    damage: 26, armorPen: 0.50, pellets: 9,
    rpm: 68, auto: false, burst: false,
    magSize: 8, reserveAmmo: 32, reloadTime: 3.3, drawTime: 1.0,
    range: 57.15, rangeMod: 0.70, penetration: 0.4,
    inaccStand: 8.0, inaccMove: 70.0, inaccCrouch: 6.4, inaccJump: 130.0, spread: 12.0,
    recoilMag: 4.0, recoveryTime: 0.55, moveSpeed: 220, zoom: null,
    sound: 'fire_nova',
    pattern: buildPattern([[0, 0, 0], [3, 0.06, 0.55], [8, -0.16, 0.78], [16, 0.20, 0.86], [29, -0.18, 0.9]], 0.22, 61),
    viewmodel: {
      origin: [0.16, -0.16, -0.33],
      parts: [
        { name: 'body', pos: [0, 0, 0.02], size: [0.048, 0.070, 0.32], color: '#3a3226' },
        { name: 'barrel', pos: [0, 0.015, -0.28], size: [0.026, 0.026, 0.28], color: '#1c1c1e' },
        { name: 'pump', pos: [0, -0.03, -0.22], size: [0.042, 0.045, 0.12], color: '#4a3520' },
        { name: 'stock', pos: [0, -0.02, 0.22], size: [0.038, 0.075, 0.16], color: '#4a3520' },
        { name: 'receiver', pos: [0, 0.0, -0.02], size: [0.044, 0.055, 0.12], color: '#2b2b2f' }
      ],
      muzzle: [0, 0.016, -0.44],
      shellEject: [0.038, 0.01, -0.04]
    }
  },

  xm1014: {
    // XM1014：半自动霰弹枪，171 RPM 连喷，8 颗弹丸 // 近似
    name: 'XM1014', nameCN: '连喷', team: 'both', slot: 'primary', class: 'shotgun',
    price: 2000, killAward: 900,
    damage: 20, armorPen: 0.80, pellets: 8,
    rpm: 171, auto: false, burst: false,
    magSize: 8, reserveAmmo: 32, reloadTime: 4.0, drawTime: 1.1,
    range: 57.15, rangeMod: 0.70, penetration: 0.45,
    inaccStand: 9.0, inaccMove: 74.0, inaccCrouch: 7.2, inaccJump: 135.0, spread: 13.0,
    recoilMag: 3.6, recoveryTime: 0.5, moveSpeed: 215, zoom: null,
    sound: 'fire_xm1014',
    pattern: buildPattern([[0, 0, 0], [3, -0.08, 0.5], [8, 0.20, 0.72], [16, -0.24, 0.82], [29, 0.22, 0.86]], 0.24, 62),
    viewmodel: {
      origin: [0.16, -0.16, -0.33],
      parts: [
        { name: 'body', pos: [0, 0, 0.02], size: [0.050, 0.072, 0.34], color: '#26262a' },
        { name: 'barrel', pos: [0, 0.015, -0.28], size: [0.028, 0.028, 0.26], color: '#1c1c1e' },
        { name: 'tube', pos: [0, -0.028, -0.26], size: [0.024, 0.024, 0.22], color: '#2b2b2f' },
        { name: 'stock', pos: [0, -0.02, 0.24], size: [0.038, 0.078, 0.15], color: '#1f1f22' },
        { name: 'grip', pos: [0, -0.07, 0.10], size: [0.034, 0.090, 0.046], color: '#1f1f22' }
      ],
      muzzle: [0, 0.016, -0.44],
      shellEject: [0.04, 0.012, -0.02]
    }
  },

  mag7: {
    // MAG-7：CT 泵动霰弹，弹匣式 5 发，贴脸伤害极高但射程最短 // 近似
    name: 'MAG-7', nameCN: 'MAG7', team: 'ct', slot: 'primary', class: 'shotgun',
    price: 1300, killAward: 900,
    damage: 30, armorPen: 0.75, pellets: 8,
    rpm: 80, auto: false, burst: false,
    magSize: 5, reserveAmmo: 32, reloadTime: 3.2, drawTime: 1.0,
    range: 45.72, rangeMod: 0.68, penetration: 0.4,
    inaccStand: 8.4, inaccMove: 72.0, inaccCrouch: 6.7, inaccJump: 132.0, spread: 11.5,
    recoilMag: 4.2, recoveryTime: 0.55, moveSpeed: 225, zoom: null,
    sound: 'fire_mag7',
    pattern: buildPattern([[0, 0, 0], [3, 0.08, 0.58], [8, -0.20, 0.80], [16, 0.24, 0.88], [29, -0.22, 0.92]], 0.24, 63),
    viewmodel: {
      origin: [0.16, -0.16, -0.30],
      parts: [
        { name: 'body', pos: [0, 0, 0.02], size: [0.056, 0.080, 0.28], color: '#2f2f34' },
        { name: 'barrel', pos: [0, 0.02, -0.22], size: [0.030, 0.030, 0.18], color: '#1c1c1e' },
        { name: 'mag', pos: [0, -0.08, -0.06], size: [0.046, 0.100, 0.07], color: '#1f1f22' },
        { name: 'grip', pos: [0, -0.065, 0.10], size: [0.036, 0.085, 0.048], color: '#26262a' },
        { name: 'stock', pos: [0, 0.0, 0.20], size: [0.040, 0.060, 0.10], color: '#2f2f34' }
      ],
      muzzle: [0, 0.02, -0.34],
      shellEject: [0.042, 0.014, -0.02]
    }
  },

  sawedoff: {
    // 截短霰弹枪：T 版贴脸怪，7 发、射程最短、移速最慢的霰弹 // 近似
    name: 'Sawed-Off', nameCN: '截短霰弹枪', team: 't', slot: 'primary', class: 'shotgun',
    price: 1100, killAward: 900,
    damage: 32, armorPen: 0.75, pellets: 8,
    rpm: 84, auto: false, burst: false,
    magSize: 7, reserveAmmo: 32, reloadTime: 3.4, drawTime: 1.0,
    range: 41.91, rangeMod: 0.65, penetration: 0.35,
    inaccStand: 9.5, inaccMove: 78.0, inaccCrouch: 7.6, inaccJump: 140.0, spread: 14.0,
    recoilMag: 4.5, recoveryTime: 0.58, moveSpeed: 210, zoom: null,
    sound: 'fire_sawedoff',
    pattern: buildPattern([[0, 0, 0], [3, -0.10, 0.60], [8, 0.24, 0.82], [16, -0.26, 0.90], [29, 0.24, 0.94]], 0.26, 64),
    viewmodel: {
      origin: [0.16, -0.16, -0.28],
      parts: [
        { name: 'body', pos: [0, 0, 0.02], size: [0.052, 0.075, 0.24], color: '#3a3226' },
        { name: 'barrel', pos: [0, 0.02, -0.16], size: [0.032, 0.032, 0.14], color: '#1c1c1e' },
        { name: 'pump', pos: [0, -0.035, -0.12], size: [0.044, 0.045, 0.08], color: '#4a3520' },
        { name: 'grip', pos: [0, -0.075, 0.10], size: [0.036, 0.095, 0.050], color: '#4a3520', rot: [0.2, 0, 0] },
        { name: 'receiver', pos: [0, 0.005, 0.06], size: [0.046, 0.058, 0.10], color: '#2b2b2f' }
      ],
      muzzle: [0, 0.02, -0.25],
      shellEject: [0.04, 0.012, 0.0]
    }
  },

  /* ================================================================
   * 机枪（mg）：击杀奖励 300，超大弹链、移速最慢、换弹最久
   * ================================================================ */

  m249: {
    // M249：5200 块的重机枪，100 发弹链；数值为近似 // 近似
    name: 'M249', nameCN: '大机枪', team: 'both', slot: 'primary', class: 'mg',
    price: 5200, killAward: 300,
    damage: 32, armorPen: 0.80, pellets: 1,
    rpm: 750, auto: true, burst: false,
    magSize: 100, reserveAmmo: 200, reloadTime: 5.7, drawTime: 1.5,
    range: 156.06, rangeMod: 0.97, penetration: 1.1,
    inaccStand: 9.0, inaccMove: 180.0, inaccCrouch: 6.8, inaccJump: 220.0, spread: 0.6,
    recoilMag: 2.4, recoveryTime: 0.4, moveSpeed: 195, zoom: null,
    sound: 'fire_m249',
    pattern: buildPattern([
      [0, 0.00, 0.00], [3, 0.04, 0.50], [6, 0.14, 0.74], [10, 0.42, 0.88], [14, 0.60, 0.92],
      [18, 0.20, 0.90], [22, -0.40, 0.89], [26, -0.66, 0.90], [29, -0.30, 0.90]
    ], 0.16, 71),
    viewmodel: {
      origin: [0.17, -0.17, -0.34],
      parts: [
        { name: 'body', pos: [0, 0, 0.02], size: [0.060, 0.085, 0.40], color: '#2b2b2f' },
        { name: 'barrel', pos: [0, 0.02, -0.32], size: [0.026, 0.026, 0.30], color: '#1c1c1e' },
        { name: 'ammobox', pos: [0, -0.09, 0.02], size: [0.075, 0.100, 0.14], color: '#26262a' },
        { name: 'bipod', pos: [0, -0.06, -0.26], size: [0.055, 0.030, 0.05], color: '#1f1f22' },
        { name: 'stock', pos: [0, -0.005, 0.26], size: [0.042, 0.070, 0.14], color: '#2b2b2f' },
        { name: 'grip', pos: [0, -0.075, 0.14], size: [0.036, 0.095, 0.048], color: '#1f1f22' },
        { name: 'carryhandle', pos: [0, 0.062, -0.06], size: [0.024, 0.026, 0.14], color: '#141416' }
      ],
      muzzle: [0, 0.02, -0.52],
      shellEject: [0.048, 0.012, -0.04]
    }
  },

  negev: {
    // Negev：1700 块的压制机枪，前几发极散、扫久了反而变准 // 近似
    name: 'Negev', nameCN: '内格夫', team: 'both', slot: 'primary', class: 'mg',
    price: 1700, killAward: 300,
    damage: 35, armorPen: 0.75, pellets: 1,
    rpm: 800, auto: true, burst: false,
    magSize: 150, reserveAmmo: 200, reloadTime: 5.7, drawTime: 1.7,
    range: 156.06, rangeMod: 0.98, penetration: 1.05,
    inaccStand: 22.0, inaccMove: 200.0, inaccCrouch: 18.0, inaccJump: 260.0, spread: 0.8,
    recoilMag: 3.0, recoveryTime: 0.45, moveSpeed: 195, zoom: null,
    sound: 'fire_negev',
    // 前 10 发乱飞，之后收束成小圈（CS:GO 的 recoil recovery 机制）
    pattern: buildSpiralPattern({ radius: 0.55, turns: 1.6, rise: 0.85, phase: 1.1, jitter: 0.18, seed: 72 }),
    viewmodel: {
      origin: [0.17, -0.17, -0.34],
      parts: [
        { name: 'body', pos: [0, 0, 0.02], size: [0.065, 0.090, 0.42], color: '#26262a' },
        { name: 'barrel', pos: [0, 0.02, -0.34], size: [0.028, 0.028, 0.32], color: '#1c1c1e' },
        { name: 'ammobox', pos: [0, -0.10, 0.0], size: [0.085, 0.110, 0.16], color: '#1f1f22' },
        { name: 'belt', pos: [0.045, -0.05, 0.0], size: [0.02, 0.045, 0.05], color: '#8a6a2b' },
        { name: 'bipod', pos: [0, -0.065, -0.28], size: [0.060, 0.032, 0.05], color: '#1f1f22' },
        { name: 'stock', pos: [0, -0.005, 0.28], size: [0.044, 0.072, 0.14], color: '#26262a' },
        { name: 'grip', pos: [0, -0.08, 0.14], size: [0.038, 0.100, 0.050], color: '#1f1f22' },
        { name: 'rail', pos: [0, 0.062, -0.06], size: [0.026, 0.016, 0.20], color: '#141416' }
      ],
      muzzle: [0, 0.02, -0.54],
      shellEject: [0.052, 0.012, -0.04]
    }
  },

  /* ================================================================
   * 电枪（taser）：Zeus x27，一次一发、无击杀奖励，命中即杀
   * 它在购买菜单里属于"装备"页，所以 slot 记为 gear
   * ================================================================ */

  zeus: {
    // Zeus x27：200 块，射程约 3.4 米（CS 里约 180 units），打完必须重新购买 // 近似
    name: 'Zeus x27', nameCN: '电枪', team: 'both', slot: 'gear', class: 'taser',
    price: 200, killAward: 0,
    damage: 500, armorPen: 1.0, pellets: 1,
    rpm: 60, auto: false, burst: false,
    magSize: 1, reserveAmmo: 0, reloadTime: 0, drawTime: 0.5,
    range: 3.4, rangeMod: 1.0, penetration: 0,
    inaccStand: 0, inaccMove: 0, inaccCrouch: 0, inaccJump: 0, spread: 0,
    recoilMag: 0, recoveryTime: 0.1, moveSpeed: 220, zoom: null,
    sound: 'fire_zeus',
    pattern: zeroPattern(),
    viewmodel: {
      origin: [0.14, -0.14, -0.26],
      parts: [
        { name: 'body', pos: [0, 0.01, -0.04], size: [0.040, 0.050, 0.16], color: '#1a2a5a' },
        { name: 'electrodeA', pos: [0.012, 0.02, -0.15], size: [0.006, 0.006, 0.07], color: '#4aa8ff' },
        { name: 'electrodeB', pos: [-0.012, 0.02, -0.15], size: [0.006, 0.006, 0.07], color: '#4aa8ff' },
        { name: 'grip', pos: [0, -0.06, 0.03], size: [0.030, 0.080, 0.042], color: '#141a2e', rot: [0.18, 0, 0] },
        { name: 'lamp', pos: [0, 0.04, -0.06], size: [0.014, 0.012, 0.02], color: '#7fd4ff' }
      ],
      muzzle: [0, 0.02, -0.20],
      shellEject: [0, 0, 0]
    }
  }
};

/* ================================================================
 * GRENADES：投掷物单独一张表（不进 WEAPONS）
 * throwSpeed 米/秒：CS 满力投掷约 750 units/s ≈ 14.3 m/s
 * bounce 0..1 弹性；weight 千克（给物理积分用）
 * maxCarry：单种携带上限；CS 里全部投掷物合计上限为 4
 * damage 为爆心最大伤害，radius 为米，fuse 为引信秒数
 * ================================================================ */
export const GRENADES = {
  // 高爆手雷：爆心 98 伤害，半径内线性衰减，可穿墙削血
  he: {
    name: 'HE Grenade', nameCN: '高爆手雷', team: 'both', slot: 'grenade', class: 'grenade',
    price: 300, killAward: 300,
    damage: 98, radius: 5.9, fuse: 1.6,
    armorPen: 0.5, // 手雷对护甲的削减近似值 // 近似
    throwSpeed: 14.3, bounce: 0.45, weight: 0.6, maxCarry: 1,
    duration: 0, dps: 0, blindMax: 0,
    sound: null,
    viewmodel: {
      origin: [0.15, -0.15, -0.28],
      parts: [
        { name: 'body', pos: [0, 0, 0], size: [0.07, 0.10, 0.07], color: '#3d4a2e' },
        { name: 'top', pos: [0, 0.06, 0], size: [0.03, 0.02, 0.03], color: '#26262a' },
        { name: 'pin', pos: [0.025, 0.06, 0], size: [0.02, 0.008, 0.02], color: '#9aa0a6' }
      ],
      muzzle: [0, 0, -0.10],
      shellEject: [0, 0, 0]
    }
  },

  // 闪光弹：最长致盲 4.9 秒（正对爆心），背对只有约 1 秒
  flash: {
    name: 'Flashbang', nameCN: '闪光弹', team: 'both', slot: 'grenade', class: 'grenade',
    price: 200, killAward: 300,
    damage: 0, radius: 8, fuse: 1.6,
    armorPen: 0,
    throwSpeed: 14.3, bounce: 0.5, weight: 0.55, maxCarry: 2,
    duration: 0, dps: 0, blindMax: 4.9,
    sound: null,
    viewmodel: {
      origin: [0.15, -0.15, -0.28],
      parts: [
        { name: 'body', pos: [0, 0, 0], size: [0.06, 0.11, 0.06], color: '#6b6f76' },
        { name: 'band', pos: [0, 0.0, 0], size: [0.065, 0.02, 0.065], color: '#c9ccd1' },
        { name: 'top', pos: [0, 0.065, 0], size: [0.028, 0.02, 0.028], color: '#26262a' }
      ],
      muzzle: [0, 0, -0.10],
      shellEject: [0, 0, 0]
    }
  },

  // 烟雾弹：18 秒烟幕，半径约 3.6 米（CS 里约 144 units 的球）
  smoke: {
    name: 'Smoke Grenade', nameCN: '烟雾弹', team: 'both', slot: 'grenade', class: 'grenade',
    price: 300, killAward: 300,
    damage: 0, radius: 3.6, fuse: 1.6,
    armorPen: 0,
    throwSpeed: 14.3, bounce: 0.35, weight: 0.65, maxCarry: 1,
    duration: 18, dps: 0, blindMax: 0,
    sound: null,
    viewmodel: {
      origin: [0.15, -0.15, -0.28],
      parts: [
        { name: 'body', pos: [0, 0, 0], size: [0.065, 0.11, 0.065], color: '#4a5a6a' },
        { name: 'stripe', pos: [0, 0.02, 0], size: [0.07, 0.015, 0.07], color: '#d8dde3' },
        { name: 'top', pos: [0, 0.065, 0], size: [0.028, 0.02, 0.028], color: '#26262a' }
      ],
      muzzle: [0, 0, -0.10],
      shellEject: [0, 0, 0]
    }
  },

  // 燃烧瓶（T）：落地碎裂即燃，不会弹跳；每秒约 22 点持续伤害
  molotov: {
    name: 'Molotov', nameCN: '燃烧瓶', team: 't', slot: 'grenade', class: 'grenade',
    price: 400, killAward: 300,
    damage: 0, radius: 2.6, fuse: 2.0,
    armorPen: 0, // 火焰伤害不受护甲影响
    throwSpeed: 13.5, bounce: 0.0, weight: 0.7, maxCarry: 1,
    duration: 7, dps: 22, blindMax: 0,
    sound: null,
    viewmodel: {
      origin: [0.15, -0.15, -0.28],
      parts: [
        { name: 'bottle', pos: [0, 0, 0], size: [0.06, 0.14, 0.06], color: '#8a6a2b' },
        { name: 'neck', pos: [0, 0.085, 0], size: [0.025, 0.04, 0.025], color: '#6b5220' },
        { name: 'rag', pos: [0, 0.115, 0], size: [0.02, 0.03, 0.02], color: '#d8d2c0' }
      ],
      muzzle: [0, 0, -0.10],
      shellEject: [0, 0, 0]
    }
  },

  // 燃烧弹（CT）：效果与燃烧瓶相同，价格 600，会先弹一下再引燃
  incgrenade: {
    name: 'Incendiary Grenade', nameCN: '燃烧弹', team: 'ct', slot: 'grenade', class: 'grenade',
    price: 600, killAward: 300,
    damage: 0, radius: 2.6, fuse: 2.0,
    armorPen: 0,
    throwSpeed: 14.0, bounce: 0.2, weight: 0.7, maxCarry: 1,
    duration: 7, dps: 22, blindMax: 0,
    sound: null,
    viewmodel: {
      origin: [0.15, -0.15, -0.28],
      parts: [
        { name: 'body', pos: [0, 0, 0], size: [0.065, 0.11, 0.065], color: '#7a3a20' },
        { name: 'stripe', pos: [0, 0.01, 0], size: [0.07, 0.015, 0.07], color: '#e8a03a' },
        { name: 'top', pos: [0, 0.065, 0], size: [0.028, 0.02, 0.028], color: '#26262a' }
      ],
      muzzle: [0, 0, -0.10],
      shellEject: [0, 0, 0]
    }
  },

  // 诱饵弹：15 秒假枪声，结束时小爆炸（伤害为近似值）// 近似
  decoy: {
    name: 'Decoy Grenade', nameCN: '诱饵弹', team: 'both', slot: 'grenade', class: 'grenade',
    price: 50, killAward: 300,
    damage: 25, radius: 2.0, fuse: 1.6,
    armorPen: 0.5,
    throwSpeed: 14.3, bounce: 0.45, weight: 0.6, maxCarry: 1,
    duration: 15, dps: 0, blindMax: 0,
    sound: null,
    viewmodel: {
      origin: [0.15, -0.15, -0.28],
      parts: [
        { name: 'body', pos: [0, 0, 0], size: [0.065, 0.11, 0.065], color: '#2f4a2f' },
        { name: 'stripe', pos: [0, 0.015, 0], size: [0.07, 0.015, 0.07], color: '#8ad46a' },
        { name: 'top', pos: [0, 0.065, 0], size: [0.028, 0.02, 0.028], color: '#26262a' }
      ],
      muzzle: [0, 0, -0.10],
      shellEject: [0, 0, 0]
    }
  }
};

/* ================================================================
 * GEAR：护甲与拆弹器
 * armor 为购买后获得的护甲值；helmet 表示是否附带头盔
 * ================================================================ */
export const GEAR = {
  kevlar: {
    name: 'Kevlar Vest', nameCN: '防弹衣', team: 'both', slot: 'gear', class: 'gear',
    price: 650, armor: 100, helmet: false, sound: null
  },
  kevlarhelm: {
    name: 'Kevlar + Helmet', nameCN: '头盔+防弹衣', team: 'both', slot: 'gear', class: 'gear',
    price: 1000, armor: 100, helmet: true, sound: null
  },
  defusekit: {
    name: 'Defuse Kit', nameCN: '拆弹器', team: 'ct', slot: 'gear', class: 'gear',
    price: 400, armor: 0, helmet: false, sound: null,
    defuseTime: 5 // 有包 5 秒、无包 10 秒
  }
};

/* ================================================================
 * ECONOMY：经济常数
 *
 * 连败奖励（loss bonus）规则说明（CS:GO / CS2）：
 *   1. 每支队伍有一个"连败计数器"，取值 0..4，对应 lossBonusTiers 的下标。
 *   2. 输掉一回合，计数器 +1（上限 4）；赢下一回合，计数器 -1（下限 0），
 *      注意是"递减"而不是清零，这是 CS:GO 2019 之后的规则。
 *   3. 计数器决定失败方每人能拿到的钱：1400 / 1900 / 2400 / 2900 / 3400。
 *   4. T 方即使输了回合，只要炸弹已经安放，全队额外拿 bombPlantTeamReward(800)。
 *   5. CS 没有"存活奖励"，所以 survivalReward = 0，保留字段方便自定义模式。
 * ================================================================ */
export const ECONOMY = {
  startMoney: 800, maxMoney: 16000,
  winReward: 3250,               // 回合胜利（默认）
  bombPlantReward: 300,          // 个人下包奖励
  bombPlantTeamReward: 800,      // T 下包但输了的团队奖励
  defuseReward: 300,             // 个人拆包奖励
  lossBonusTiers: [1400, 1900, 2400, 2900, 3400],
  winByTimeCT: 3250,             // CT 靠时间耗尽守下
  winByDefuse: 3500,             // CT 拆包获胜
  winByEliminationT: 3250,       // T 全歼 CT
  winByBombCT: 3500,             // 炸弹爆炸，T 获胜（对 T 的奖励）
  winByEliminationCT: 3250,      // CT 全歼 T
  hostageRescueReward: 1000,     // 每名人质被救出（人质图）// 近似
  killAwardDefault: 300,         // 未标注 killAward 时的兜底值
  grenadeKillAward: 300,         // 手雷 / 火焰击杀
  survivalReward: 0,             // CS 没有存活奖励，保留给自定义模式
  teamKillPenalty: -300,         // 击杀队友
  suicidePenalty: -300,          // 自杀
  lossBonusMaxTier: 4,           // 连败计数器上限（下标）
  lossBonusWinDecrement: 1,      // 获胜时连败计数器递减量
  bombTimer: 40,                 // 炸弹倒计时（秒），经济结算需要用到
  defuseTimeWithKit: 5, defuseTimeNoKit: 10
};

/* ================================================================
 * BUY_MENU：购买菜单（按键 1..6）
 * 狙击枪按 CS 的习惯归在"步枪"页里
 * ================================================================ */
export const BUY_MENU = [
  { key: '1', id: 'pistols', nameCN: '手枪', items: ['glock18', 'usp_s', 'p2000', 'p250', 'deagle', 'r8', 'dualberettas', 'fiveseven', 'tec9', 'cz75'] },
  { key: '2', id: 'smgs', nameCN: '微型冲锋枪', items: ['mp9', 'mac10', 'mp7', 'mp5sd', 'ump45', 'p90', 'bizon'] },
  { key: '3', id: 'rifles', nameCN: '步枪', items: ['ak47', 'm4a4', 'm4a1s', 'galil', 'famas', 'aug', 'sg553', 'awp', 'ssg08', 'scar20', 'g3sg1'] },
  { key: '4', id: 'heavy', nameCN: '重型武器', items: ['nova', 'xm1014', 'mag7', 'sawedoff', 'm249', 'negev'] },
  { key: '5', id: 'gear', nameCN: '装备', items: ['kevlar', 'kevlarhelm', 'defusekit', 'zeus'] },
  { key: '6', id: 'grenades', nameCN: '投掷物', items: ['he', 'flash', 'smoke', 'molotov', 'incgrenade', 'decoy'] }
];

/** 命中部位列表（引擎的 hitgroup 名称） */
export const HITGROUPS = ['head', 'chest', 'stomach', 'arm', 'leg'];

/* ================================================================
 * 纯函数区：不依赖引擎、不产生副作用
 * ================================================================ */

/**
 * 按 id 在三张表里查条目（内部用）。
 */
function lookupEntry(id) {
  if (Object.prototype.hasOwnProperty.call(WEAPONS, id)) return WEAPONS[id];
  if (Object.prototype.hasOwnProperty.call(GRENADES, id)) return GRENADES[id];
  if (Object.prototype.hasOwnProperty.call(GEAR, id)) return GEAR[id];
  return null;
}

/**
 * 返回某阵营可以购买的 id 列表（按购买菜单顺序，去重）。
 * team: 't' | 'ct'；传其它值时返回全部可购买 id。
 */
export function getBuyableFor(team) {
  const out = [];
  for (let c = 0; c < BUY_MENU.length; c++) {
    const items = BUY_MENU[c].items;
    for (let i = 0; i < items.length; i++) {
      const id = items[i];
      const entry = lookupEntry(id);
      if (!entry) continue;
      const t = entry.team === undefined ? 'both' : entry.team;
      if (team !== 't' && team !== 'ct') {
        if (out.indexOf(id) === -1) out.push(id);
      } else if (t === 'both' || t === team) {
        if (out.indexOf(id) === -1) out.push(id);
      }
    }
  }
  return out;
}

/**
 * 命中部位伤害倍率。
 * head 4.0 / chest 1.0 / stomach 1.25 / arm 1.0 / leg 0.75，未知部位按 1.0。
 */
export function hitgroupMultiplier(hitgroup) {
  switch (hitgroup) {
    case 'head': return 4.0;
    case 'chest': return 1.0;
    case 'stomach': return 1.25;
    case 'arm': return 1.0;
    case 'leg': return 0.75;
    default: return 1.0;
  }
}

/**
 * 护甲减免（CS 经典公式的近似实现）。
 *
 *   newDamage = damage * armorPen
 *   armorLoss = (damage - newDamage) * 0.5      // ArmorBonusRatio = 0.5
 *
 * 覆盖规则：头部只有"有甲且戴头盔"才减免；腿部在 CS 里永远不受护甲保护；
 * 胸 / 腹 / 手臂由防弹衣覆盖。
 *
 * 近似之处：真实引擎在护甲值不足时会走
 *   armorLoss = armor / 0.5; newDamage = damage - armorLoss
 * 的退化分支；本函数只拿到 hasArmor 布尔值，因此不模拟该分支，
 * 由调用方扣甲后自行判定（护甲归零后下一次调用传 hasArmor=false 即可）。
 *
 * 传入的 dmg 应当是"已乘过命中部位倍率、已做距离衰减"的伤害。
 * 返回 { damage, armorLoss }，两者都是未取整的浮点值。
 */
export function armorPenetratedDamage(dmg, armorPen, hasArmor, hasHelmet, hitgroup) {
  const group = hitgroup === undefined || hitgroup === null ? 'chest' : hitgroup;
  const pen = typeof armorPen === 'number' ? armorPen : 1;
  let covered;
  if (group === 'head') covered = !!hasArmor && !!hasHelmet;
  else if (group === 'leg') covered = false;
  else covered = !!hasArmor;
  if (!covered) return { damage: dmg, armorLoss: 0 };
  const newDamage = dmg * pen;
  const armorLoss = (dmg - newDamage) * ARMOR_BONUS_RATIO;
  return { damage: newDamage, armorLoss: armorLoss < 0 ? 0 : armorLoss };
}

/**
 * 距离衰减后的伤害（不含命中部位倍率、不含护甲）。
 *   damage * rangeMod ^ (距离 / 9.525 米)      // 9.525 米 = 500 CS 单位
 * 超出武器最大有效距离返回 0。
 */
export function damageAtDistance(weapon, meters) {
  if (!weapon || typeof weapon.damage !== 'number') return 0;
  const d = !(meters > 0) ? 0 : meters;
  if (typeof weapon.range === 'number' && d > weapon.range) return 0;
  const mod = typeof weapon.rangeMod === 'number' ? weapon.rangeMod : 1;
  return weapon.damage * Math.pow(mod, d / METERS_PER_STEP);
}

/** CS 单位 -> 米（1 unit = 0.01905 m，即 3/4 英寸） */
export function csUnitsToMeters(u) {
  return u * UNIT_TO_METER;
}

/**
 * 连败奖励：consecutiveLosses 为"含本回合的连败次数"。
 * 1 -> 1400，2 -> 1900，3 -> 2400，4 -> 2900，>=5 -> 3400；
 * 传 0 或负数按第一档处理。
 */
export function lossBonus(consecutiveLosses, economy = ECONOMY) {
  const eco = economy && economy.lossBonusTiers ? economy : ECONOMY;
  const tiers = eco.lossBonusTiers;
  let n = Math.floor(consecutiveLosses);
  if (!(n > 1)) n = 1;
  let idx = n - 1;
  if (idx > tiers.length - 1) idx = tiers.length - 1;
  return tiers[idx];
}
