/* =====================================================================
 * MobModels — 生物的盒子模型定义（纯色 + 走路动画）
 * 尺寸单位为方块（1 = 16 像素）
 * part: { name, size:[w,h,d], pos:[x,y,z] 中心相对脚底中心, color, anim }
 * anim: 'legFL' | 'legFR' | 'legBL' | 'legBR' | 'head' | 'armL' | 'armR' | null
 * ===================================================================== */

const P = (name, size, pos, color, anim = null, pivot = null) => ({ name, size, pos, color, anim, pivot });

/** 四足动物（猪/牛/羊） */
function quadruped(bodyColor, headColor, legColor, opts = {}) {
  const bodyY = opts.bodyY ?? 0.72;
  const legH = opts.legH ?? 0.375;
  const bodyW = opts.bodyW ?? 0.625;
  const bodyH = opts.bodyH ?? 0.5;
  const bodyD = opts.bodyD ?? 1.0;
  const headS = opts.headS ?? 0.5;
  const parts = [
    P('body', [bodyW, bodyH, bodyD], [0, bodyY, 0], bodyColor),
    P('head', [headS, headS, headS], [0, bodyY + 0.16, -bodyD / 2 - headS / 2 + 0.06], headColor, 'head'),
    P('legFL', [0.25, legH, 0.25], [bodyW / 2 - 0.13, legH / 2, -bodyD / 2 + 0.2], legColor, 'legFL'),
    P('legFR', [0.25, legH, 0.25], [-bodyW / 2 + 0.13, legH / 2, -bodyD / 2 + 0.2], legColor, 'legFR'),
    P('legBL', [0.25, legH, 0.25], [bodyW / 2 - 0.13, legH / 2, bodyD / 2 - 0.2], legColor, 'legBL'),
    P('legBR', [0.25, legH, 0.25], [-bodyW / 2 + 0.13, legH / 2, bodyD / 2 - 0.2], legColor, 'legBR'),
  ];
  if (opts.snout) {
    parts.push(P('snout', [0.25, 0.19, 0.13], [0, bodyY + 0.1, -bodyD / 2 - headS - 0.02], opts.snout, 'head'));
  }
  if (opts.horns) {
    parts.push(P('hornL', [0.09, 0.09, 0.09], [0.19, bodyY + 0.38, -bodyD / 2 - 0.3], opts.horns, 'head'));
    parts.push(P('hornR', [0.09, 0.09, 0.09], [-0.19, bodyY + 0.38, -bodyD / 2 - 0.3], opts.horns, 'head'));
  }
  // 眼睛
  parts.push(P('eyeL', [0.08, 0.09, 0.02], [0.14, bodyY + 0.24, -bodyD / 2 - headS - 0.01], '#1a1a1a', 'head'));
  parts.push(P('eyeR', [0.08, 0.09, 0.02], [-0.14, bodyY + 0.24, -bodyD / 2 - headS - 0.01], '#1a1a1a', 'head'));
  return parts;
}

/** 人形（僵尸/骷髅/苦力怕变体） */
function biped(skin, shirt, pants, opts = {}) {
  const legH = 0.75, bodyH = 0.75, headS = 0.5;
  const y0 = legH;
  return [
    P('legL', [0.25, legH, 0.25], [0.125, legH / 2, 0], pants, 'legFL'),
    P('legR', [0.25, legH, 0.25], [-0.125, legH / 2, 0], pants, 'legFR'),
    P('body', [0.5, bodyH, 0.25], [0, y0 + bodyH / 2, 0], shirt),
    P('head', [headS, headS, headS], [0, y0 + bodyH + headS / 2, 0], skin, 'head'),
    P('armL', [0.25, 0.75, 0.25], [0.375, y0 + bodyH - 0.375, opts.armsOut ? -0.14 : 0], skin, 'armL'),
    P('armR', [0.25, 0.75, 0.25], [-0.375, y0 + bodyH - 0.375, opts.armsOut ? -0.14 : 0], skin, 'armR'),
    P('eyeL', [0.1, 0.1, 0.02], [0.12, y0 + bodyH + 0.3, -headS / 2 - 0.01], opts.eye || '#1a1a1a', 'head'),
    P('eyeR', [0.1, 0.1, 0.02], [-0.12, y0 + bodyH + 0.3, -headS / 2 - 0.01], opts.eye || '#1a1a1a', 'head'),
  ];
}

export const MOB_TYPES = {
  pig: {
    display: '猪', width: 0.9, height: 0.9, health: 10, speed: 1.5, hostile: false,
    drops: [['porkchop', 1, 2]], xp: 1,
    parts: quadruped('#f0a5a2', '#f0a5a2', '#e08f8c', { snout: '#d98a87' }),
  },
  cow: {
    display: '牛', width: 0.9, height: 1.3, health: 10, speed: 1.3, hostile: false,
    drops: [['beef', 1, 3], ['leather', 0, 2]], xp: 1,
    parts: quadruped('#4a3524', '#3f2c1c', '#3a2a1a', { bodyY: 0.95, bodyH: 0.6, horns: '#d8d0b0' }),
  },
  sheep: {
    display: '羊', width: 0.9, height: 1.3, health: 8, speed: 1.4, hostile: false,
    drops: [['white_wool', 1, 1], ['mutton', 1, 2]], xp: 1,
    parts: quadruped('#efefef', '#e8d5c0', '#d8d8d8', { bodyY: 0.95, bodyH: 0.62 }),
  },
  chicken: {
    display: '鸡', width: 0.5, height: 0.7, health: 4, speed: 1.1, hostile: false,
    drops: [['chicken', 1, 1], ['feather', 0, 2]], xp: 1,
    parts: [
      P('body', [0.375, 0.4, 0.5], [0, 0.42, 0], '#e8e8e8'),
      P('head', [0.25, 0.3, 0.25], [0, 0.72, -0.2], '#e8e8e8', 'head'),
      P('beak', [0.12, 0.09, 0.14], [0, 0.7, -0.36], '#f0b429', 'head'),
      P('wattle', [0.08, 0.11, 0.06], [0, 0.62, -0.34], '#c42a1e', 'head'),
      P('legL', [0.09, 0.22, 0.09], [0.1, 0.11, 0], '#f0b429', 'legFL'),
      P('legR', [0.09, 0.22, 0.09], [-0.1, 0.11, 0], '#f0b429', 'legFR'),
      P('wingL', [0.06, 0.28, 0.35], [0.21, 0.45, 0], '#dcdcdc', 'armL'),
      P('wingR', [0.06, 0.28, 0.35], [-0.21, 0.45, 0], '#dcdcdc', 'armR'),
      P('eyeL', [0.06, 0.07, 0.02], [0.08, 0.76, -0.33], '#1a1a1a', 'head'),
      P('eyeR', [0.06, 0.07, 0.02], [-0.08, 0.76, -0.33], '#1a1a1a', 'head'),
    ],
  },
  rabbit: {
    display: '兔子', width: 0.4, height: 0.5, health: 3, speed: 1.8, hostile: false,
    drops: [], xp: 1,
    parts: [
      P('body', [0.3, 0.28, 0.44], [0, 0.24, 0], '#a89078'),
      P('head', [0.26, 0.26, 0.26], [0, 0.44, -0.2], '#b89c82', 'head'),
      P('earL', [0.06, 0.24, 0.03], [0.08, 0.66, -0.16], '#b89c82', 'head'),
      P('earR', [0.06, 0.24, 0.03], [-0.08, 0.66, -0.16], '#b89c82', 'head'),
      P('legBL', [0.1, 0.16, 0.2], [0.11, 0.08, 0.14], '#a89078', 'legBL'),
      P('legBR', [0.1, 0.16, 0.2], [-0.11, 0.08, 0.14], '#a89078', 'legBR'),
      P('legFL', [0.08, 0.14, 0.1], [0.09, 0.07, -0.14], '#a89078', 'legFL'),
      P('legFR', [0.08, 0.14, 0.1], [-0.09, 0.07, -0.14], '#a89078', 'legFR'),
      P('tail', [0.1, 0.1, 0.06], [0, 0.3, 0.24], '#e8e0d8'),
    ],
  },
  zombie: {
    display: '僵尸', width: 0.6, height: 1.95, health: 20, speed: 1.15, hostile: true,
    attack: 3, drops: [['iron_ingot', 0, 1]], xp: 5, burnsInDay: true,
    parts: biped('#3f7f5f', '#2a4f6f', '#2a3a5f', { armsOut: true }),
  },
  skeleton: {
    display: '骷髅', width: 0.6, height: 1.95, health: 20, speed: 1.2, hostile: true,
    attack: 2, drops: [['bone', 1, 2]], xp: 5, burnsInDay: true,
    parts: biped('#c8c8c8', '#b8b8b8', '#a8a8a8', { armsOut: true, eye: '#000000' }),
  },
  creeper: {
    display: '苦力怕', width: 0.6, height: 1.7, health: 20, speed: 1.05, hostile: true,
    attack: 0, explode: true, drops: [['gunpowder', 1, 2]], xp: 5,
    parts: [
      P('legFL', [0.25, 0.35, 0.25], [0.12, 0.17, -0.14], '#4a8f3c', 'legFL'),
      P('legFR', [0.25, 0.35, 0.25], [-0.12, 0.17, -0.14], '#4a8f3c', 'legFR'),
      P('legBL', [0.25, 0.35, 0.25], [0.12, 0.17, 0.14], '#4a8f3c', 'legBL'),
      P('legBR', [0.25, 0.35, 0.25], [-0.12, 0.17, 0.14], '#4a8f3c', 'legBR'),
      P('body', [0.5, 0.75, 0.25], [0, 0.72, 0], '#5aa84a'),
      P('head', [0.5, 0.5, 0.5], [0, 1.35, 0], '#62b552', 'head'),
      P('eyeL', [0.13, 0.13, 0.02], [0.13, 1.45, -0.26], '#101010', 'head'),
      P('eyeR', [0.13, 0.13, 0.02], [-0.13, 1.45, -0.26], '#101010', 'head'),
      P('mouth', [0.13, 0.19, 0.02], [0, 1.28, -0.26], '#101010', 'head'),
    ],
  },
  spider: {
    display: '蜘蛛', width: 1.4, height: 0.9, health: 16, speed: 1.6, hostile: true,
    attack: 2, drops: [['string', 1, 2]], xp: 5,
    parts: [
      P('body', [0.6, 0.5, 0.75], [0, 0.5, 0.15], '#38281f'),
      P('head', [0.5, 0.4, 0.4], [0, 0.5, -0.45], '#453026', 'head'),
      P('eyeL', [0.09, 0.09, 0.02], [0.13, 0.6, -0.66], '#c42a1e', 'head'),
      P('eyeR', [0.09, 0.09, 0.02], [-0.13, 0.6, -0.66], '#c42a1e', 'head'),
      P('legFL', [0.7, 0.09, 0.09], [0.42, 0.36, -0.2], '#2a1c14', 'legFL'),
      P('legFR', [0.7, 0.09, 0.09], [-0.42, 0.36, -0.2], '#2a1c14', 'legFR'),
      P('legBL', [0.7, 0.09, 0.09], [0.42, 0.36, 0.3], '#2a1c14', 'legBL'),
      P('legBR', [0.7, 0.09, 0.09], [-0.42, 0.36, 0.3], '#2a1c14', 'legBR'),
    ],
  },
};

export const PASSIVE_MOBS = ['pig', 'cow', 'sheep', 'chicken', 'rabbit'];
export const HOSTILE_MOBS = ['zombie', 'skeleton', 'creeper', 'spider'];
