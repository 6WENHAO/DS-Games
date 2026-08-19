/* =====================================================================
 * textures.js — 全部方块贴图的"画法"（16×16 像素画，运行时生成）
 * 每个条目: 名称 -> (tile) => void
 * ===================================================================== */
import { shade, mixc, C } from '../render/TexturePainter.js';

/** 主色板 */
export const PAL = {
  stone: '#7e7e7e', stoneD: '#6a6a6a', stoneL: '#909090',
  dirt: '#87643f', dirtD: '#6f5133', dirtL: '#9a7752',
  grass: '#5d9c3c', grassD: '#4b8130', grassL: '#72b34c',
  sand: '#dbcfa0', sandD: '#c6b988', sandL: '#efe4b8',
  wood: '#9c7f4e', woodD: '#6f5734', woodL: '#b59a68',
  bark: '#6b4f2a', barkD: '#4f3a1e', barkL: '#82613a',
  leaf: '#3f6f28', leafD: '#2f5a1c', leafL: '#4d8632',
  water: '#3a5fd0', waterD: '#2c49a8', waterL: '#5c7fe8',
  lava: '#e8720c', lavaD: '#a33a05', lavaL: '#ffc21f',
  iron: '#d8d8d8', gold: '#fcee4b', diamond: '#5decd5',
  emerald: '#3fd463', lapis: '#2f52c0', redstone: '#c81f16', coal: '#232323',
  snow: '#f4fbfb', ice: '#9ecdf5', obsidian: '#1a1024',
  brickRed: '#96594a', mortar: '#a8a8a8',
  netherrack: '#6f2020', glow: '#f7d26b', clay: '#a3a8b5',
};

/** 16 种羊毛/染料颜色（与原版接近） */
export const DYE_COLORS = {
  white: '#e9ecec', orange: '#f07613', magenta: '#bd44b3', light_blue: '#3aafd9',
  yellow: '#f8c627', lime: '#70b919', pink: '#ed8dac', gray: '#3e4447',
  light_gray: '#8e8e86', cyan: '#158991', purple: '#792ab0', blue: '#35399d',
  brown: '#724728', green: '#546d1b', red: '#a12722', black: '#141519',
};

/* ------------------------------------------------------------------ *
 * 通用画法工具
 * ------------------------------------------------------------------ */
function oreTile(t, oreColor, count = 5, radius = 1.7) {
  stoneBase(t);
  const dark = shade(oreColor, 0.55);
  for (let n = 0; n < count; n++) {
    const cx = t.rng.range(2, 14), cy = t.rng.range(2, 14);
    const r = radius * t.rng.range(0.8, 1.25);
    for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++) {
      for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        if (d <= r) t.set(x, y, t.rng.float() < 0.3 ? shade(oreColor, 1.18) : oreColor);
        else if (d <= r + 0.9 && t.rng.float() < 0.55) t.set(x, y, dark);
      }
    }
  }
  t.grain(0.05);
}

function stoneBase(t) {
  t.noiseFill([PAL.stone, PAL.stoneD, PAL.stoneL, '#757575', '#888888'], [4, 2, 2, 3, 2]);
  t.grain(0.05);
  // 少量暗斑，避免过于均匀
  for (let n = 0; n < 3; n++) {
    const cx = t.rng.int(0, 15), cy = t.rng.int(0, 15);
    for (let y = cy - 1; y <= cy + 1; y++) for (let x = cx - 1; x <= cx + 1; x++) {
      if (t.rng.float() < 0.5) t.set(x, y, PAL.stoneD);
    }
  }
}

function logTop(t, ringColor, coreColor) {
  t.fill(shade(ringColor, 0.86));
  const cx = 7.5, cy = 7.5;
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const d = Math.hypot(x - cx, y - cy);
      const ring = Math.sin(d * 1.65) * 0.5 + 0.5;
      let c = mixc(shade(ringColor, 0.8), shade(ringColor, 1.12), ring);
      if (d < 1.8) c = coreColor;
      if (d > 7.2) c = shade(ringColor, 0.6);
      t.set(x, y, c);
    }
  }
  t.grain(0.07);
}

function barkTile(t, base, d, l) {
  t.vstripes([base, d, l, shade(base, 0.9), shade(base, 1.08)], 1, 3);
  // 横向裂纹
  for (let n = 0; n < 10; n++) {
    const y = t.rng.int(0, 15), x = t.rng.int(0, 14);
    t.set(x, y, shade(d, 0.8));
    if (t.rng.bool()) t.set(x + 1, y, shade(d, 0.85));
  }
  t.grain(0.08);
}

function leafTile(t, base) {
  t.noiseFill([base, shade(base, 0.78), shade(base, 1.22), shade(base, 0.9), shade(base, 1.1)]);
  // 结构化空洞（比纯随机好看）
  const holes = [[1, 2], [4, 1], [7, 3], [11, 2], [14, 5], [2, 7], [5, 6], [9, 8],
    [13, 9], [0, 11], [3, 12], [6, 14], [10, 13], [14, 14], [8, 0], [12, 6]];
  for (const [hx, hy] of holes) {
    if (t.rng.float() < 0.85) { const i = t.idx(hx, hy); t.data[i + 3] = 0; }
  }
  t.punch(0.10);
  t.grain(0.1);
}

function woolTile(t, color) {
  t.fill(color);
  t.grain(0.055);
  for (let n = 0; n < 18; n++) {
    const x = t.rng.int(0, 15), y = t.rng.int(0, 15);
    t.set(x, y, shade(color, t.rng.bool() ? 0.9 : 1.09));
  }
  // 编织纹理
  for (let y = 0; y < 16; y += 4) t.hline(y, 0, 15, shade(color, 0.94));
  for (let x = 2; x < 16; x += 4) t.vline(x, 0, 15, shade(color, 1.05));
  return t;
}

function metalTile(t, color) {
  t.fill(color);
  t.grain(0.06);
  // 四个小格 + 高光
  for (const [ox, oy] of [[1, 1], [9, 1], [1, 9], [9, 9]]) {
    t.rect(ox, oy, 6, 6, shade(color, 1.06));
    t.hline(oy, ox, ox + 5, shade(color, 1.3));
    t.vline(ox, oy, oy + 5, shade(color, 1.22));
    t.hline(oy + 5, ox, ox + 5, shade(color, 0.72));
    t.vline(ox + 5, oy, oy + 5, shade(color, 0.78));
  }
  t.border(shade(color, 0.66));
}

function gemBlockTile(t, color) {
  t.fill(shade(color, 0.7));
  const pts = [[3, 3], [10, 3], [3, 10], [10, 10], [6, 6]];
  for (const [x, y] of pts) {
    t.rect(x, y, 3, 3, color);
    t.set(x, y, shade(color, 1.45));
    t.set(x + 2, y + 2, shade(color, 0.6));
  }
  t.grain(0.08);
  t.border(shade(color, 0.5));
}

/* ------------------------------------------------------------------ *
 * 贴图表
 * ------------------------------------------------------------------ */
export const TEXTURES = {
  // ---------------- 石头族 ----------------
  stone: (t) => stoneBase(t),
  smooth_stone: (t) => { t.fill('#9d9d9d'); t.grain(0.045); t.hline(0, 0, 15, '#adadad'); t.hline(15, 0, 15, '#8b8b8b'); },
  cobblestone: (t) => { t.cobble('#4d4d4d', ['#8f8f8f', '#7c7c7c', '#a2a2a2', '#6d6d6d']); t.grain(0.06); },
  mossy_cobblestone: (t) => {
    t.cobble('#3f4a3a', ['#7f8a72', '#6f7d64', '#94a086', '#61705a']);
    t.blobs(5, 2.1, '#4c7a35', 0.5); t.grain(0.09);
  },
  stone_bricks: (t) => {
    t.bricks(4, '#7b7b7b', '#5a5a5a'); t.grain(0.06);
  },
  bricks: (t) => { t.bricks(4, PAL.brickRed, PAL.mortar); t.grain(0.05); },
  granite: (t) => { t.noiseFill(['#9f6b5a', '#b07a67', '#8a5c4c', '#c08b76']); t.grain(0.07); t.blobs(3, 1.4, '#7d5245', 0.4); },
  diorite: (t) => { t.noiseFill(['#cfcfcf', '#bcbcbc', '#e0e0e0', '#a8a8a8']); t.grain(0.07); t.blobs(3, 1.4, '#9a9a9a', 0.4); },
  andesite: (t) => { t.noiseFill(['#8e8e8e', '#7f7f84', '#9c9ca0', '#727276']); t.grain(0.06); },
  bedrock: (t) => {
    for (let y = 0; y < 16; y += 2) for (let x = 0; x < 16; x += 2) {
      const c = t.rng.pick(['#5b5b5b', '#3d3d3d', '#787878', '#2b2b2b', '#666666']);
      t.rect(x, y, 2, 2, c);
    }
    t.grain(0.08);
  },
  obsidian: (t) => {
    t.noiseFill([PAL.obsidian, '#241735', '#120b1a', '#2e1e45']);
    for (let n = 0; n < 12; n++) t.set(t.rng.int(0, 15), t.rng.int(0, 15), '#4b3172');
    t.grain(0.1);
  },
  netherrack: (t) => { t.noiseFill([PAL.netherrack, '#5c1a1a', '#7f2626', '#4a1414']); t.grain(0.12); t.blobs(4, 1.6, '#8f3030', 0.5); },
  glowstone: (t) => {
    t.fill('#8a6b2f');
    t.blobs(9, 2.0, (x, y) => (((x + y) & 1) ? PAL.glow : '#ffe9a0'), 0.4);
    t.grain(0.09);
  },
  clay: (t) => { t.noiseFill([PAL.clay, '#9aa0ad', '#b0b5c1', '#8f95a2']); t.grain(0.05); },
  terracotta: (t) => { t.noiseFill(['#985f43', '#8a5539', '#a86b4d', '#7d4b32']); t.grain(0.07); t.hline(4, 0, 15, '#7d4b32'); t.hline(11, 0, 15, '#7d4b32'); },

  // ---------------- 土族 ----------------
  dirt: (t) => { t.noiseFill([PAL.dirt, PAL.dirtD, PAL.dirtL, '#7d5c39', '#916b46']); t.grain(0.07); },
  coarse_dirt: (t) => { t.noiseFill([PAL.dirtD, '#6a4d30', '#8a6742', '#5e442b']); t.grain(0.1); },
  grass_top: (t) => { t.noiseFill([PAL.grass, PAL.grassD, PAL.grassL, '#68a642', '#548f34']); t.grain(0.06); },
  grass_side: (t) => {
    t.noiseFill([PAL.dirt, PAL.dirtD, PAL.dirtL]); t.grain(0.07);
    t.overlayTop(3, PAL.grass, 3);
  },
  podzol_top: (t) => { t.noiseFill(['#6d4c25', '#5b3f1e', '#7f5a2d', '#8a6533']); t.grain(0.08); },
  podzol_side: (t) => { t.noiseFill([PAL.dirt, PAL.dirtD, PAL.dirtL]); t.grain(0.07); t.overlayTop(3, '#6d4c25', 3); },
  mycelium: (t) => { t.noiseFill(['#8b7a8b', '#7a6a7a', '#9d8b9d']); t.grain(0.08); t.speckle('#b9a7c4', 0.12); },
  farmland: (t) => {
    t.noiseFill([PAL.dirtD, '#6a4d30', '#7d5c39']); t.grain(0.06);
    for (let y = 1; y < 16; y += 4) t.hline(y, 0, 15, '#513a23');
  },
  farmland_wet: (t) => {
    t.noiseFill(['#5b4028', '#4c3520', '#6a4c2e']); t.grain(0.06);
    for (let y = 1; y < 16; y += 4) t.hline(y, 0, 15, '#332314');
  },
  sand: (t) => { t.noiseFill([PAL.sand, PAL.sandD, PAL.sandL, '#e2d6a8']); t.grain(0.05); },
  red_sand: (t) => { t.noiseFill(['#bf6b2c', '#a95c24', '#d07d3a']); t.grain(0.06); },
  gravel: (t) => {
    t.fill('#6e6e6e');
    t.blobs(14, 1.5, () => t.rng.pick(['#8b8b8b', '#a0a0a0', '#5f5f5f', '#7d7368', '#95908a']), 0.45);
    t.grain(0.09);
  },
  sandstone_top: (t) => { t.noiseFill([PAL.sandL, PAL.sand, '#e8dcae']); t.grain(0.04); },
  sandstone_side: (t) => {
    t.noiseFill([PAL.sand, PAL.sandD, PAL.sandL]); t.grain(0.04);
    t.rect(0, 0, 16, 4, PAL.sandL); t.hline(4, 0, 15, PAL.sandD);
    for (let y = 5; y < 16; y++) if ((y % 5) === 0) t.hline(y, 0, 15, shade(PAL.sandD, 0.94));
  },
  snow: (t) => { t.noiseFill([PAL.snow, '#e8f2f2', '#ffffff']); t.grain(0.03); },
  ice: (t) => {
    t.gradientV('#a8d8f8', '#7fb8e8');
    for (let n = 0; n < 10; n++) {
      const x = t.rng.int(0, 15), y = t.rng.int(0, 15);
      t.set(x, y, '#d6f0ff'); if (t.rng.bool()) t.set(x + 1, y, '#c4e6ff');
    }
    for (let i = 0; i < t.data.length; i += 4) t.data[i + 3] = 205;
  },
  packed_ice: (t) => { t.gradientV('#93c4ec', '#75a9d8'); t.grain(0.05); },

  // ---------------- 木族 ----------------
  oak_log: (t) => barkTile(t, PAL.bark, PAL.barkD, PAL.barkL),
  oak_log_top: (t) => logTop(t, '#a3824e', '#7d6039'),
  oak_planks: (t) => { t.planks(4, PAL.wood, PAL.woodD, PAL.woodL); t.grain(0.05); },
  birch_log: (t) => {
    t.noiseFill(['#d7d3c8', '#c8c4b8', '#e2ded2']);
    for (let n = 0; n < 7; n++) {
      const y = t.rng.int(0, 15), x = t.rng.int(0, 12), w = t.rng.int(2, 4);
      for (let i = 0; i < w; i++) t.set(x + i, y, '#4b4438');
    }
    t.grain(0.05);
  },
  birch_log_top: (t) => logTop(t, '#d7cfae', '#b3a884'),
  birch_planks: (t) => { t.planks(4, '#c8b581', '#a08f5f', '#dcca9a'); t.grain(0.05); },
  spruce_log: (t) => barkTile(t, '#4a3722', '#33260f', '#5e4a2e'),
  spruce_log_top: (t) => logTop(t, '#7a5f38', '#5c462a'),
  spruce_planks: (t) => { t.planks(4, '#735231', '#553c22', '#8a6540'); t.grain(0.05); },
  jungle_log: (t) => barkTile(t, '#5b4529', '#3f2f1a', '#6f5636'),
  jungle_planks: (t) => { t.planks(4, '#a8785a', '#855b41', '#bd8f70'); t.grain(0.05); },
  oak_leaves: (t) => leafTile(t, PAL.leaf),
  birch_leaves: (t) => leafTile(t, '#57853b'),
  spruce_leaves: (t) => leafTile(t, '#2c5230'),
  jungle_leaves: (t) => leafTile(t, '#2f7524'),
  bookshelf: (t) => {
    t.planks(4, PAL.wood, PAL.woodD, PAL.woodL);
    t.rect(0, 3, 16, 5, '#6b4f2a'); t.rect(0, 10, 16, 5, '#6b4f2a');
    const books = ['#a8322a', '#2a5aa8', '#2a8a4a', '#c9a227', '#8a2a8a', '#c46b1e'];
    for (const y0 of [3, 10]) {
      let x = 0;
      while (x < 16) {
        const w = t.rng.int(1, 3);
        const c = t.rng.pick(books);
        for (let i = 0; i < w && x + i < 16; i++) {
          for (let y = y0; y < y0 + 5; y++) t.set(x + i, y, y === y0 ? shade(c, 1.25) : c);
        }
        x += w + 1;
      }
    }
    t.grain(0.06);
  },
  crafting_table_top: (t) => {
    t.planks(4, PAL.wood, PAL.woodD, PAL.woodL);
    t.rect(1, 1, 14, 14, '#8a6b3e');
    for (let gx = 0; gx < 3; gx++) for (let gy = 0; gy < 3; gy++) {
      t.rect(2 + gx * 4, 2 + gy * 4, 4, 4, '#6b4f2a');
      t.rect(3 + gx * 4, 3 + gy * 4, 2, 2, '#9c7f4e');
    }
    t.border('#5c4423');
  },
  crafting_table_side: (t) => {
    t.planks(4, PAL.wood, PAL.woodD, PAL.woodL);
    t.rect(0, 0, 16, 4, '#7d6339');
    t.hline(4, 0, 15, '#5c4423');
    for (let n = 0; n < 6; n++) t.set(t.rng.int(1, 14), t.rng.int(6, 14), '#5c4423');
  },
  crafting_table_front: (t) => {
    t.planks(4, PAL.wood, PAL.woodD, PAL.woodL);
    t.rect(2, 5, 5, 4, '#8a8a8a');  // 锯
    t.rect(9, 4, 2, 7, '#6b4f2a');  // 锤柄
    t.rect(8, 3, 4, 3, '#4a4a4a');
    t.border('#5c4423');
  },
  furnace_side: (t) => { stoneBase(t); t.border('#5f5f5f'); },
  furnace_top: (t) => { stoneBase(t); t.rect(5, 5, 6, 6, '#5a5a5a'); t.rect(6, 6, 4, 4, '#3f3f3f'); },
  furnace_front: (t) => {
    stoneBase(t);
    t.rect(3, 6, 10, 8, '#3a3a3a');
    t.rect(4, 7, 8, 6, '#232323');
    t.hline(6, 4, 11, '#5a5a5a');
    t.border('#5f5f5f');
  },
  furnace_front_lit: (t) => {
    stoneBase(t);
    t.rect(3, 6, 10, 8, '#3a3a3a');
    t.rect(4, 7, 8, 6, '#2a1a0a');
    for (let x = 4; x < 12; x++) {
      const h = 2 + ((x * 7) % 3);
      for (let y = 12; y > 12 - h; y--) t.set(x, y, y > 11 ? '#ffcc33' : '#ff8811');
    }
    t.border('#5f5f5f');
  },
  chest_top: (t) => {
    t.planks(4, '#8a6b3e', '#5c4423', '#a3824e');
    t.border('#4a3519');
  },
  chest_front: (t) => {
    t.fill('#8a6b3e');
    t.rect(0, 0, 16, 5, '#9c7a48'); t.hline(5, 0, 15, '#4a3519');
    t.rect(0, 6, 16, 10, '#8a6b3e');
    t.rect(6, 4, 4, 5, '#6f6f6f'); t.rect(7, 6, 2, 2, '#3f3f3f');
    t.border('#4a3519'); t.grain(0.05);
  },
  chest_side: (t) => {
    t.fill('#8a6b3e'); t.rect(0, 0, 16, 5, '#9c7a48'); t.hline(5, 0, 15, '#4a3519');
    t.border('#4a3519'); t.grain(0.05);
  },
  jukebox_side: (t) => { t.planks(4, '#6b4f2a', '#4f3a1e', '#82613a'); t.border('#3f2d16'); },
  jukebox_top: (t) => {
    t.planks(4, '#6b4f2a', '#4f3a1e', '#82613a');
    t.rect(3, 3, 10, 10, '#2a2a2a'); t.rect(7, 7, 2, 2, '#c9a227');
  },
  tnt_side: (t) => {
    t.rect(0, 0, 16, 16, '#c43a2a');
    t.rect(0, 5, 16, 6, '#e8e8e8');
    // TNT 字样
    const letters = [[1, 6, 'T'], [6, 6, 'N'], [11, 6, 'T']];
    for (const [lx, ly, ch] of letters) drawLetter(t, lx, ly, ch, '#2a2a2a');
    t.rect(0, 0, 16, 2, '#a82a1c');
    t.rect(0, 14, 16, 2, '#a82a1c');
    t.grain(0.04);
  },
  tnt_top: (t) => {
    t.rect(0, 0, 16, 16, '#c43a2a');
    t.rect(5, 5, 6, 6, '#a82a1c');
    t.rect(7, 0, 2, 6, '#6b4f2a');
    t.grain(0.05);
  },
  tnt_bottom: (t) => { t.rect(0, 0, 16, 16, '#a82a1c'); t.grain(0.05); },
  cactus_side: (t) => {
    t.fill('#4d7f2f');
    t.rect(0, 0, 1, 16, '#3c6624'); t.rect(15, 0, 1, 16, '#3c6624');
    for (let y = 1; y < 16; y += 4) for (let x = 3; x < 15; x += 5) {
      t.set(x, y, '#d8e8b0'); t.set(x, y + 1, '#b0c888');
    }
    t.grain(0.07);
  },
  cactus_top: (t) => {
    t.fill('#4d7f2f'); t.rect(2, 2, 12, 12, '#5e9438');
    t.border('#3c6624'); t.grain(0.06);
  },
  pumpkin_side: (t) => {
    t.fill('#c47519');
    for (let x = 0; x < 16; x += 3) t.vline(x, 0, 15, '#a85f10');
    t.rect(0, 0, 16, 2, '#8a4c0c'); t.grain(0.05);
  },
  pumpkin_top: (t) => {
    t.fill('#c47519'); t.grain(0.06);
    t.rect(6, 6, 4, 4, '#6b8f2a'); t.rect(7, 7, 2, 2, '#84a83a');
  },
  pumpkin_face: (t) => {
    t.fill('#c47519');
    for (let x = 0; x < 16; x += 3) t.vline(x, 0, 15, '#a85f10');
    // 眼睛
    t.rect(2, 4, 4, 3, '#3a2408'); t.set(3, 7, '#3a2408');
    t.rect(10, 4, 4, 3, '#3a2408'); t.set(12, 7, '#3a2408');
    // 嘴
    t.rect(4, 10, 8, 2, '#3a2408');
    t.set(5, 12, '#3a2408'); t.set(8, 12, '#3a2408'); t.set(10, 12, '#3a2408');
    t.grain(0.04);
  },
  melon_side: (t) => {
    t.fill('#5b9c2f');
    for (let x = 0; x < 16; x++) {
      if ((x % 4) < 2) t.vline(x, 0, 15, '#4a8226');
    }
    t.grain(0.07);
  },
  melon_top: (t) => { t.fill('#4a8226'); t.grain(0.08); t.blobs(4, 2, '#5b9c2f', 0.4); },
  hay_side: (t) => {
    t.fill('#c9a227');
    for (let y = 0; y < 16; y++) if (y % 3 === 0) t.hline(y, 0, 15, '#a8821c');
    t.grain(0.09);
  },
  hay_top: (t) => { t.fill('#b8901f'); t.rect(2, 2, 12, 12, '#c9a227'); t.grain(0.08); },
  sponge: (t) => { t.fill('#c9c93f'); t.blobs(12, 1.3, '#a8a82a', 0.5); t.grain(0.08); },
  ladder: (t) => {
    t.clear();
    t.rect(2, 0, 2, 16, PAL.bark); t.rect(12, 0, 2, 16, PAL.bark);
    for (let y = 2; y < 16; y += 5) t.rect(3, y, 10, 2, PAL.barkL);
  },
  torch: (t) => {
    t.clear();
    t.rect(7, 8, 2, 8, PAL.bark);
    t.set(7, 9, PAL.barkD); t.set(8, 12, PAL.barkD);
    t.rect(6, 5, 4, 3, '#ffd94a');
    t.rect(7, 4, 2, 2, '#fff2a8');
    t.set(6, 7, '#e8a020'); t.set(9, 7, '#e8a020');
  },
  glass: (t) => {
    t.clear();
    t.border('#e8f4ff');
    for (const [x, y] of [[2, 2], [3, 2], [2, 3], [11, 4], [12, 4], [4, 11], [4, 12], [12, 11]]) {
      t.set(x, y, '#ffffff');
    }
    t.hline(1, 2, 6, '#cfe6f5'); t.vline(14, 3, 9, '#cfe6f5');
    for (let i = 0; i < t.data.length; i += 4) if (t.data[i + 3] > 0) t.data[i + 3] = 190;
  },
  glass_tinted: (t) => {
    TEXTURES.glass(t);
    for (let y = 1; y < 15; y++) for (let x = 1; x < 15; x++) t.blend(x, y, '#3a4a5a', 0.35);
  },

  // ---------------- 矿石与金属 ----------------
  coal_ore: (t) => oreTile(t, PAL.coal, 5, 1.8),
  iron_ore: (t) => oreTile(t, '#d8a082', 5, 1.7),
  gold_ore: (t) => oreTile(t, PAL.gold, 5, 1.7),
  diamond_ore: (t) => oreTile(t, PAL.diamond, 5, 1.7),
  emerald_ore: (t) => oreTile(t, PAL.emerald, 4, 1.6),
  lapis_ore: (t) => oreTile(t, PAL.lapis, 5, 1.7),
  redstone_ore: (t) => oreTile(t, PAL.redstone, 6, 1.6),
  copper_ore: (t) => oreTile(t, '#e07f4f', 5, 1.7),
  iron_block: (t) => metalTile(t, PAL.iron),
  gold_block: (t) => metalTile(t, PAL.gold),
  diamond_block: (t) => gemBlockTile(t, PAL.diamond),
  emerald_block: (t) => gemBlockTile(t, PAL.emerald),
  lapis_block: (t) => { t.noiseFill([PAL.lapis, '#26439f', '#3a63d8', '#1e3684']); t.grain(0.09); t.border('#1a2f75'); },
  redstone_block: (t) => { t.noiseFill([PAL.redstone, '#a81810', '#e02a20', '#8f1410']); t.grain(0.1); },
  coal_block: (t) => { t.noiseFill(['#1a1a1a', '#262626', '#0f0f0f', '#303030']); t.grain(0.12); },

  // ---------------- 植物 ----------------
  sapling_oak: (t) => {
    t.clear();
    t.vline(8, 9, 15, '#5c4423');
    for (const [x, y] of [[6, 8], [7, 7], [8, 6], [9, 7], [10, 8], [7, 9], [9, 9], [8, 8], [6, 10], [10, 10]]) {
      t.set(x, y, t.rng.bool() ? PAL.leaf : PAL.leafL);
    }
  },
  tall_grass: (t) => t.plant('#4d8a2f', '#5fa838', 13, 5),
  fern: (t) => t.plant('#3f7a28', '#57a03a', 11, 4),
  dead_bush: (t) => {
    t.clear();
    for (let n = 0; n < 6; n++) {
      let x = t.rng.int(3, 12), y = 15;
      const h = t.rng.int(6, 12);
      for (let k = 0; k < h; k++) {
        t.set(x, y - k, t.rng.bool() ? '#7a5c28' : '#94702f');
        if (t.rng.float() < 0.35) x += t.rng.bool() ? 1 : -1;
      }
    }
  },
  flower_poppy: (t) => {
    t.clear();
    t.vline(7, 8, 15, '#3f7a28'); t.set(6, 11, '#4d8a2f'); t.set(8, 13, '#4d8a2f');
    t.rect(5, 4, 5, 4, '#c42a1e'); t.set(7, 6, '#f0d02a');
    t.set(4, 5, '#a81810'); t.set(10, 5, '#a81810'); t.set(7, 3, '#e04030');
  },
  flower_dandelion: (t) => {
    t.clear();
    t.vline(8, 8, 15, '#3f7a28'); t.set(7, 11, '#4d8a2f'); t.set(9, 13, '#4d8a2f');
    t.rect(6, 4, 5, 4, '#f0d02a'); t.set(8, 6, '#fff2a8');
    t.set(5, 5, '#d8b81a'); t.set(11, 6, '#d8b81a');
  },
  flower_blue: (t) => {
    t.clear();
    t.vline(8, 8, 15, '#3f7a28'); t.set(7, 12, '#4d8a2f');
    t.rect(6, 4, 5, 4, '#4a7fd8'); t.set(8, 6, '#e8e8f8');
    t.set(5, 5, '#3560b8'); t.set(11, 6, '#3560b8');
  },
  mushroom_red: (t) => {
    t.clear();
    t.rect(7, 10, 3, 6, '#e8e0d0');
    t.rect(4, 5, 9, 6, '#c42a1e');
    t.set(6, 6, '#f0f0f0'); t.set(10, 7, '#f0f0f0'); t.set(8, 9, '#f0f0f0');
    t.hline(5, 5, 11, '#e04030');
  },
  mushroom_brown: (t) => {
    t.clear();
    t.rect(7, 10, 3, 6, '#e8e0d0');
    t.rect(4, 6, 9, 5, '#a8794f');
    t.hline(6, 5, 11, '#c49468');
  },
  sugar_cane: (t) => {
    t.clear();
    for (const x of [5, 9]) {
      for (let y = 0; y < 16; y++) t.set(x, y, y % 5 === 0 ? '#5b9c2f' : '#7ab84a');
      t.set(x + 1, 3, '#5b9c2f'); t.set(x - 1, 9, '#5b9c2f');
    }
  },
  wheat: (t) => {
    t.clear();
    for (const x of [3, 7, 11]) {
      for (let y = 4; y < 16; y++) t.set(x, y, '#8aa832');
      t.set(x - 1, 5, '#c9a227'); t.set(x + 1, 5, '#c9a227');
      t.set(x - 1, 8, '#c9a227'); t.set(x + 1, 8, '#c9a227');
      t.set(x, 3, '#d8b81a');
    }
  },
  lily_pad: (t) => {
    t.clear();
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const d = Math.hypot(x - 7.5, y - 7.5);
      if (d < 7.2) t.set(x, y, d > 6 ? '#2f6b22' : '#3f8a2c');
    }
    t.rect(7, 8, 2, 5, '#000000'); // 缺口
    for (let y = 8; y < 13; y++) for (let x = 7; x < 9; x++) { const i = t.idx(x, y); t.data[i + 3] = 0; }
  },
  vine: (t) => {
    t.clear();
    for (let n = 0; n < 5; n++) {
      let x = t.rng.int(1, 14);
      const h = t.rng.int(8, 16);
      for (let y = 0; y < h; y++) {
        t.set(x, y, t.rng.bool() ? '#2f6b22' : '#3f8a2c');
        if (t.rng.float() < 0.25) x += t.rng.bool() ? 1 : -1;
        if (t.rng.float() < 0.3) t.set(x + 1, y, '#357522');
      }
    }
  },

  // ---------------- 液体（动画基帧） ----------------
  water_still: (t) => {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const w = Math.sin((x * 0.7 + y * 1.3) * 0.9) * 0.5 + 0.5;
        const w2 = Math.sin((x * 1.9 - y * 0.6) * 0.5) * 0.5 + 0.5;
        const c = mixc(PAL.waterD, PAL.waterL, w * 0.6 + w2 * 0.4);
        t.set(x, y, c);
      }
    }
    t.grain(0.05);
    for (let i = 0; i < t.data.length; i += 4) t.data[i + 3] = 190;
  },
  lava_still: (t) => {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const w = Math.sin((x * 0.8 + y * 1.1) * 0.7) * 0.5 + 0.5;
        const w2 = Math.sin((x * 1.7 - y * 0.9) * 0.45) * 0.5 + 0.5;
        let c = mixc(PAL.lavaD, PAL.lavaL, w * 0.55 + w2 * 0.45);
        if (w * w2 > 0.72) c = '#fff0a0';
        t.set(x, y, c);
      }
    }
    t.grain(0.07);
  },

  // ---------------- 特殊 ----------------
  crack: (t) => { t.clear(); },   // 由 destroy_stage 覆盖
  particle_generic: (t) => { t.fill('#ffffff'); },
  sun: (t) => {
    t.clear();
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const d = Math.hypot(x - 7.5, y - 7.5);
      if (d < 7.6) t.set(x, y, d > 6.4 ? '#ffe89a' : '#fffbe0');
    }
  },
  moon: (t) => {
    t.clear();
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const d = Math.hypot(x - 7.5, y - 7.5);
      if (d < 7.2) t.set(x, y, d > 6 ? '#c8d0e0' : '#eef2fa');
    }
    for (const [x, y] of [[5, 5], [9, 6], [6, 10], [10, 10]]) t.set(x, y, '#aab4c8');
  },
};

/** 简单 3×5 像素字母（TNT 用） */
function drawLetter(t, x, y, ch, color) {
  const F = {
    T: ['111', '010', '010', '010', '010'],
    N: ['101', '111', '111', '111', '101'],
  };
  const rows = F[ch]; if (!rows) return;
  for (let j = 0; j < rows.length; j++) {
    for (let i = 0; i < rows[j].length; i++) {
      if (rows[j][i] === '1') t.set(x + i, y + j, color);
    }
  }
}

/* ---------------- 羊毛 16 色 ---------------- */
for (const [name, color] of Object.entries(DYE_COLORS)) {
  TEXTURES['wool_' + name] = (t) => woolTile(t, color);
  TEXTURES['concrete_' + name] = (t) => { t.fill(color); t.grain(0.04); };
}

/* ---------------- 破坏进度（10 级裂纹） ---------------- */
const CRACK_SEED = [
  [8, 0], [8, 1], [7, 2], [8, 3], [9, 4], [8, 5], [8, 6], [7, 7], [8, 8], [8, 9], [9, 10], [8, 11], [8, 12], [7, 13], [8, 14], [8, 15],
  [7, 4], [6, 5], [5, 5], [4, 6], [3, 7], [2, 7], [10, 5], [11, 6], [12, 6], [13, 7], [14, 8],
  [6, 9], [5, 10], [4, 10], [3, 11], [10, 10], [11, 11], [12, 11], [13, 12],
  [6, 2], [5, 2], [4, 1], [10, 2], [11, 1], [12, 2], [6, 13], [5, 14], [10, 13], [11, 14],
  [2, 4], [1, 5], [14, 4], [13, 3], [2, 12], [1, 13], [14, 12], [13, 13],
];
for (let stage = 0; stage < 10; stage++) {
  const count = Math.round(((stage + 1) / 10) * CRACK_SEED.length);
  TEXTURES['destroy_stage_' + stage] = (t) => {
    t.clear();
    for (let i = 0; i < count; i++) {
      const [x, y] = CRACK_SEED[i];
      t.set(x, y, [0, 0, 0, 235]);
      // 裂纹加粗
      if (i % 3 === 0) t.set(x + 1, y, [0, 0, 0, 150]);
      if (i % 4 === 0) t.set(x, y + 1, [0, 0, 0, 130]);
    }
  };
}

/** 需要逐帧动画的贴图: name -> { frames, msPerFrame, generator } */
export const ANIMATED = {
  water_still: { frames: 16, ms: 90, scroll: 1 },
  lava_still: { frames: 16, ms: 160, scroll: 1 },
};

export const TEXTURE_NAMES = Object.keys(TEXTURES);
