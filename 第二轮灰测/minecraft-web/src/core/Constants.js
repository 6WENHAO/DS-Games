/* =====================================================================
 * Constants — 全局常量、面表、枚举
 * 世界尺寸: 区块 16×16，高度 128，纵向切成 8 个 16³ 的 section
 * 体素索引: idx = (y << 8) | (z << 4) | x      (0 .. 32767)
 * ===================================================================== */

export const CHUNK_SIZE = 16;
export const CHUNK_SIZE_MASK = CHUNK_SIZE - 1;
export const CHUNK_SHIFT = 4;
export const CHUNK_HEIGHT = 128;
export const SECTION_HEIGHT = 16;
export const SECTION_COUNT = CHUNK_HEIGHT / SECTION_HEIGHT; // 8
export const CHUNK_VOLUME = CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT; // 32768
export const CHUNK_AREA = CHUNK_SIZE * CHUNK_SIZE; // 256

export const SEA_LEVEL = 46;
export const BEDROCK_LEVEL = 0;
export const MAX_LIGHT = 15;

export const TICK_RATE = 20;                 // 每秒逻辑刻
export const TICK_MS = 1000 / TICK_RATE;
export const DAY_LENGTH_TICKS = 24000;       // 一个完整昼夜（与原版一致）
export const GRAVITY = 32;                   // 方块/秒²（原版约 32）
export const TERMINAL_VELOCITY = 78;

/** 体素索引helper */
export const vIndex = (x, y, z) => (y << 8) | (z << 4) | x;

/** 渲染层 */
export const LAYER = Object.freeze({
  OPAQUE: 0,       // 石头、泥土……不透明，深度写入
  CUTOUT: 1,       // 树叶、玻璃、植物：alpha 剪裁，不排序
  TRANSLUCENT: 2,  // 水、冰：混合，最后绘制
  COUNT: 3,
});

/** 方块渲染形状 */
export const SHAPE = Object.freeze({
  CUBE: 0,      // 标准立方体
  CROSS: 1,     // 十字交叉（花草）
  LIQUID: 2,    // 液体（顶面略低）
  SLAB: 3,      // 半砖
  TORCH: 4,     // 火把（细柱）
  PANE: 5,      // 玻璃板 / 栅栏
  CACTUS: 6,    // 仙人掌（内缩 1px）
  FARMLAND: 7,  // 略低的方块
});

/** 游戏模式 */
export const GAMEMODE = Object.freeze({ SURVIVAL: 'survival', CREATIVE: 'creative', SPECTATOR: 'spectator' });

/** 工具类型 */
export const TOOL = Object.freeze({
  NONE: 'none', PICKAXE: 'pickaxe', AXE: 'axe', SHOVEL: 'shovel',
  SWORD: 'sword', SHEARS: 'shears', HOE: 'hoe',
});

/** 材质分组（决定音效与挖掘手感） */
export const MATERIAL = Object.freeze({
  STONE: 'stone', DIRT: 'dirt', GRASS: 'grass', WOOD: 'wood', SAND: 'sand',
  GLASS: 'glass', WOOL: 'cloth', PLANT: 'plant', METAL: 'metal',
  LIQUID: 'liquid', SNOW: 'snow', GRAVEL: 'gravel',
});

/**
 * 六个面。face 索引固定为:
 *   0: +X  1: -X  2: +Y(顶)  3: -Y(底)  4: +Z  5: -Z
 * 顶点顺序 (u,v) = (0,0),(1,0),(1,1),(0,1)，逆时针（从面外侧看）
 * 位置 = voxel + origin + du*u + dv*v，纹理坐标 = (u, 1-v)
 * shade 为经典 MC 方向明暗系数。
 */
export const FACES = [
  { // 0: +X (东)
    name: '+X', normal: [1, 0, 0], origin: [1, 0, 1], du: [0, 0, -1], dv: [0, 1, 0], shade: 0.60,
  },
  { // 1: -X (西)
    name: '-X', normal: [-1, 0, 0], origin: [0, 0, 0], du: [0, 0, 1], dv: [0, 1, 0], shade: 0.60,
  },
  { // 2: +Y (上)
    name: '+Y', normal: [0, 1, 0], origin: [0, 1, 1], du: [1, 0, 0], dv: [0, 0, -1], shade: 1.00,
  },
  { // 3: -Y (下)
    name: '-Y', normal: [0, -1, 0], origin: [0, 0, 0], du: [1, 0, 0], dv: [0, 0, 1], shade: 0.50,
  },
  { // 4: +Z (南)
    name: '+Z', normal: [0, 0, 1], origin: [0, 0, 1], du: [1, 0, 0], dv: [0, 1, 0], shade: 0.80,
  },
  { // 5: -Z (北)
    name: '-Z', normal: [0, 0, -1], origin: [1, 0, 0], du: [-1, 0, 0], dv: [0, 1, 0], shade: 0.80,
  },
];

/** 面索引的反向面 */
export const OPPOSITE_FACE = [1, 0, 3, 2, 5, 4];

/** 六邻居方向（与 FACES 顺序一致） */
export const NEIGHBOR_DIRS = FACES.map(f => f.normal);

/** 水平四方向（用于洪水填充、朝向） */
export const HORIZONTAL_DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** 方向名（F3 面板） */
export const DIRECTION_NAMES = ['南 (Z+)', '西 (X-)', '北 (Z-)', '东 (X+)'];

export function facingFromYaw(yaw) {
  // yaw: 0=-Z(北)、-π/2=+X(东)、+π/2=-X(西)、±π=+Z(南)
  const d = ((Math.round(yaw / (Math.PI / 2)) % 4) + 4) % 4;
  return ['北 (Z-)', '西 (X-)', '南 (Z+)', '东 (X+)'][d];
}

/** 生物群系 ID */
export const BIOME = Object.freeze({
  OCEAN: 0, BEACH: 1, PLAINS: 2, FOREST: 3, TAIGA: 4, DESERT: 5,
  SAVANNA: 6, MOUNTAINS: 7, SNOWY: 8, SWAMP: 9, JUNGLE: 10, MESA: 11,
  RIVER: 12, SNOWY_MOUNTAINS: 13, FLOWER_FOREST: 14, BIRCH_FOREST: 15,
});

export const BIOME_NAMES = {
  0: '海洋', 1: '沙滩', 2: '平原', 3: '森林', 4: '针叶林', 5: '沙漠',
  6: '热带草原', 7: '山地', 8: '雪原', 9: '沼泽', 10: '丛林', 11: '恶地',
  12: '河流', 13: '雪山', 14: '繁花森林', 15: '白桦森林',
};

/** 本地存储键 */
export const STORAGE = Object.freeze({
  SETTINGS: 'mineweb.settings.v1',
  WORLD_PREFIX: 'mineweb.world.',
  LAST_WORLD: 'mineweb.lastworld',
});
