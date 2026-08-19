// ---------------------------------------------------------------------------
// de_dust2（简化重制版）
// 坐标：X 向东，Z 向北。T 出生点在南（Z 小），CT 出生点在北（Z 大）。
// 用 buildFloorplan 声明式生成，保证封闭无漏洞。
//
//                        Z=+34  ┌──────── CT 出生点 ────────┐
//   CT→B 通道 ┌───────────┘                                └────┐ CT→A
//   Z=+26     │                  中路上段                        │
//   B 门 ┌────┘                    │                            │ A 斜坡
//   Z=+14 ┌───────┐               中路                          │
//         │ B 点  │  (B 平台)      │                     ┌──────┘
//   Z=0   └───────┘ ←─ 下水道 ──   │      猫道 ──→ ┌─── A 点 ───┐ (A 平台)
//   Z=-6                          │              └──┬──────────┘
//   Z=-19                        中门                │ 长 A 走廊
//   Z=-21                       T 中路               │
//   Z=-28  ┌──── 管道口 ────┬──── T 出生点 ────┬─────┘ 长 A 门
//   Z=-36  └────────────────┴──────────────────┴──────
//          X=-32          X=-14      X=0     X=10    X=27
// ---------------------------------------------------------------------------

import { buildFloorplan } from './build.js';

const SKY = {
  top: [0.34, 0.55, 0.86],
  bottom: [0.92, 0.86, 0.72],
  sunDir: [-0.42, -0.76, -0.50],
  sunColor: [1.30, 1.16, 0.92],
  ambient: [0.30, 0.31, 0.36],
  fog: { color: [0.82, 0.78, 0.66], start: 55, end: 230 },
};

const spec = {
  id: 'de_dust2',
  name: 'Dust II',
  nameCN: '炙热沙城 II',
  mode: 'bomb',
  sky: SKY,
  bounds: { min: [-38, -1, -38], max: [38, 14, 38] },

  rooms: [
    // ---------------- T 侧 ----------------
    { name: 'T 出生点', x0: -14, z0: -36, x1: 10, z1: -28, y: 0, h: 8, floor: 'sand', wall: 'sandbrick', floorTile: 0.5 },
    { name: '长 A 出口', x0: 10, z0: -34, x1: 17, z1: -28, y: 0, h: 6, floor: 'sand', wall: 'sandstone' },
    { name: '长 A 门', x0: 17, z0: -33, x1: 19, z1: -30, y: 0, h: 3.2, floor: 'sand', wall: 'wood' },
    { name: '长 A', x0: 19, z0: -34, x1: 27, z1: -6, y: 0, h: 7, floor: 'sand', wall: 'sandstone', floorTile: 0.5 },

    { name: 'T 中路', x0: -6, z0: -28, x1: 6, z1: -21, y: 0, h: 6, floor: 'sand', wall: 'sandbrick' },
    // 中门刻意偏西：避免出现 T 出生点直通 CT 出生点的一条 60m 长直线视野
    { name: '中门', x0: -5, z0: -21, x1: -2, z1: -19, y: 0, h: 3.2, floor: 'sand', wall: 'wood' },
    { name: '中路', x0: -8, z0: -19, x1: 8, z1: 4, y: 0, h: 8, floor: 'sand', wall: 'sandbrick', floorTile: 0.5 },

    { name: '管道口', x0: -22, z0: -34, x1: -14, z1: -29, y: 0, h: 3.6, floor: 'sand', wall: 'sandstone', ceil: 'sandstone' },
    { name: '上层管道', x0: -22, z0: -29, x1: -16, z1: -12, y: 0, h: 3.6, floor: 'sand', wall: 'sandstone', ceil: 'sandstone' },
    { name: '下水道', x0: -22, z0: -12, x1: -16, z1: 0, y: 0, h: 3.6, floor: 'gravel', wall: 'sandstone', ceil: 'sandstone' },

    // ---------------- 包点 ----------------
    { name: 'A 点', x0: 14, z0: -6, x1: 32, z1: 8, y: 0, h: 8, floor: 'sand', wall: 'sandbrick', floorTile: 0.5 },
    { name: 'A 平台', x0: 24, z0: 2, x1: 32, z1: 8, y: 1.4, h: 6.6, floor: 'sandstone', wall: 'sandbrick' },
    { name: '猫道', x0: 8, z0: -2, x1: 14, z1: 2, y: 0, h: 5, floor: 'concrete', wall: 'sandstone' },

    { name: 'B 点', x0: -32, z0: 0, x1: -14, z1: 14, y: 0, h: 8, floor: 'sand', wall: 'sandbrick', floorTile: 0.5 },
    { name: 'B 平台', x0: -32, z0: 8, x1: -26, z1: 14, y: 1.2, h: 6.8, floor: 'concrete', wall: 'sandbrick' },

    // ---------------- CT 侧 ----------------
    { name: 'CT 出生点', x0: -6, z0: 26, x1: 14, z1: 34, y: 0, h: 8, floor: 'sand', wall: 'sandbrick', floorTile: 0.5 },
    { name: 'A 斜坡', x0: 14, z0: 8, x1: 22, z1: 32, y: 0, h: 6.5, floor: 'sand', wall: 'sandbrick' },
    // 中路上段/CT 中路整体偏东，与中门错开，形成折线而不是长直线
    { name: '中路上段', x0: 2, z0: 4, x1: 10, z1: 14, y: 0, h: 6, floor: 'sand', wall: 'plaster' },
    { name: 'CT 中路', x0: 2, z0: 14, x1: 12, z1: 26, y: 0, h: 6, floor: 'sand', wall: 'plaster' },
    { name: 'CT→B 通道', x0: -16, z0: 26, x1: -6, z1: 32, y: 0, h: 3.6, floor: 'tile', wall: 'plaster', ceil: 'plaster' },
    { name: 'B 门', x0: -16, z0: 14, x1: -10, z1: 26, y: 0, h: 5, floor: 'sand', wall: 'sandbrick' },
  ],

  // dust2 不做窗口：所有开洞都会在墙外露出天空，观感差
  holes: [],

  stairs: [
    // 上 A 平台
    { x0: 22, z0: 2, x1: 24, z1: 8, from: 0, to: 1.4, dir: '+x', steps: 4, mat: 'sandstone' },
    // 上 B 平台
    { x0: -26, z0: 8, x1: -24, z1: 14, from: 0, to: 1.2, dir: '-x', steps: 4, mat: 'concrete' },
  ],

  extra: [
    // ---- 打断"出生点对穿"的错位掩体墙 ----
    // 中路：两道错开的墙让中路变成 Z 字形，既提供掩体，也让任何直线都无法
    // 从 T 出生点一路看到 CT 出生点（validate_map 的最长通视审计会检查这点）
    { min: [-8, 0, -8.5], max: [3, 4, -8], mat: 'sandbrick' },
    { min: [-3, 0, -3], max: [8, 4, -2.5], mat: 'sandbrick' },
    // A 斜坡：同样错开两道墙，避免长 A -> A 点 -> 斜坡 -> CT 出生点的一条长直线
    { min: [14, 0, 18], max: [19, 4, 18.5], mat: 'sandbrick' },
    { min: [17, 0, 23], max: [22, 4, 23.5], mat: 'sandbrick' },

    // A 平台护栏（0.9m，可跳过去但形成掩体）
    { min: [24, 1.4, 1.6], max: [32, 2.3, 2.0], mat: 'metal', tile: 1 },
    // B 平台护栏
    { min: [-32, 1.2, 7.6], max: [-26.5, 2.1, 8.0], mat: 'metal', tile: 1 },
    // 猫道两侧矮墙
    { min: [8, 0, -2.5], max: [14, 0.9, -2.0], mat: 'sandstone' },
    { min: [8, 0, 2.0], max: [14, 0.9, 2.5], mat: 'sandstone' },
    // 长 A 的掩体矮墙（"坑"边）
    { min: [19, 0, -10], max: [22.5, 1.0, -9.5], mat: 'sandstone' },
    // 中路的"暗门"矮墙
    { min: [-8, 0, -14], max: [-5, 1.0, -13.5], mat: 'sandbrick' },
    { min: [5, 0, -14], max: [8, 1.0, -13.5], mat: 'sandbrick' },
  ],

  props: [
    // ------- A 点：经典箱子群 -------
    { type: 'crate', pos: [17.5, 0, 1.0], size: [1.3, 1.3, 1.3], mat: 'crate' },
    { type: 'crate', pos: [18.8, 0, 1.6], size: [1.3, 1.3, 1.3], mat: 'crate' },
    { type: 'crate', pos: [18.1, 1.3, 1.3], size: [1.2, 1.2, 1.2], mat: 'crate' },
    { type: 'crate', pos: [22.0, 0, -3.5], size: [1.5, 1.0, 1.5], mat: 'crate' },
    { type: 'crate', pos: [26.0, 0, -1.0], size: [1.2, 1.2, 1.2], mat: 'crate' },
    { type: 'box', pos: [29.5, 0, -4.0], size: [2.0, 1.1, 2.0], mat: 'concrete' },
    { type: 'barrel', pos: [15.5, 0, 6.0], size: [0.7, 1.0, 0.7], mat: 'metal' },
    { type: 'barrel', pos: [16.4, 0, 6.6], size: [0.7, 1.0, 0.7], mat: 'metal' },
    { type: 'crate', pos: [25.0, 1.4, 5.0], size: [1.2, 1.2, 1.2], mat: 'crate' },

    // ------- B 点 -------
    { type: 'crate', pos: [-22.0, 0, 4.0], size: [1.4, 1.4, 1.4], mat: 'crate' },
    { type: 'crate', pos: [-23.4, 0, 4.6], size: [1.4, 1.4, 1.4], mat: 'crate' },
    { type: 'crate', pos: [-22.7, 1.4, 4.3], size: [1.2, 1.2, 1.2], mat: 'crate' },
    { type: 'box', pos: [-17.5, 0, 10.0], size: [2.2, 1.1, 1.6], mat: 'concrete' },
    { type: 'sandbag', pos: [-28.0, 0, 3.0], size: [2.4, 0.95, 1.0], mat: 'sandbag' },
    { type: 'barrel', pos: [-16.0, 0, 2.0], size: [0.7, 1.0, 0.7], mat: 'metal' },
    { type: 'crate', pos: [-29.0, 1.2, 11.0], size: [1.2, 1.2, 1.2], mat: 'crate' },

    // ------- 中路 -------
    { type: 'crate', pos: [0, 0, -12.0], size: [1.6, 1.1, 1.6], mat: 'crate' },   // 经典 xbox
    { type: 'crate', pos: [-5.0, 0, -2.0], size: [1.2, 1.2, 1.2], mat: 'crate' },
    { type: 'crate', pos: [5.5, 0, 1.0], size: [1.2, 1.2, 1.2], mat: 'crate' },

    // ------- 长 A -------
    { type: 'box', pos: [25.0, 0, -22.0], size: [2.4, 1.2, 4.0], mat: 'concrete_dark' },  // 蓝色集装箱位
    { type: 'crate', pos: [20.5, 0, -16.0], size: [1.3, 1.3, 1.3], mat: 'crate' },
    { type: 'barrel', pos: [21.5, 0, -28.0], size: [0.7, 1.0, 0.7], mat: 'metal' },

    // ------- 管道 / 出生点 -------
    { type: 'barrel', pos: [-20.0, 0, -20.0], size: [0.7, 1.0, 0.7], mat: 'metal' },
    { type: 'crate', pos: [-18.0, 0, -6.0], size: [1.1, 1.1, 1.1], mat: 'crate' },
    { type: 'crate', pos: [-12.0, 0, -33.0], size: [1.2, 1.2, 1.2], mat: 'crate' },
    { type: 'crate', pos: [6.0, 0, -33.0], size: [1.2, 1.2, 1.2], mat: 'crate' },
    { type: 'crate', pos: [10.0, 0, 30.0], size: [1.2, 1.2, 1.2], mat: 'crate' },
    { type: 'sandbag', pos: [-2.0, 0, 27.5], size: [3.0, 0.95, 1.0], mat: 'sandbag' },

    // ------- A 斜坡 / B 门 -------
    { type: 'box', pos: [16.0, 0, 20.0], size: [1.8, 1.1, 1.8], mat: 'concrete' },
    { type: 'crate', pos: [-14.0, 0, 20.0], size: [1.3, 1.3, 1.3], mat: 'crate' },
  ],

  lights: [
    { pos: [-19, 2.8, -20], color: [1.0, 0.86, 0.62], radius: 11, intensity: 0.85 },
    { pos: [-19, 2.8, -6], color: [1.0, 0.86, 0.62], radius: 11, intensity: 0.85 },
    { pos: [-11, 2.8, 29], color: [0.9, 0.94, 1.0], radius: 10, intensity: 0.8 },
    { pos: [18, 2.4, -31.5], color: [1.0, 0.9, 0.7], radius: 8, intensity: 0.7 },
    { pos: [0, 2.4, -20], color: [1.0, 0.9, 0.7], radius: 8, intensity: 0.7 },
  ],

  spawns: {
    t: [
      { pos: [-8, 0, -33], yaw: 90 },
      { pos: [-4, 0, -34], yaw: 90 },
      { pos: [0, 0, -33], yaw: 90 },
      { pos: [4, 0, -34], yaw: 90 },
      { pos: [8, 0, -33], yaw: 90 },
    ],
    ct: [
      { pos: [-2, 0, 32], yaw: -90 },
      { pos: [2, 0, 31], yaw: -90 },
      { pos: [6, 0, 32], yaw: -90 },
      { pos: [10, 0, 31], yaw: -90 },
      { pos: [12, 0, 32.5], yaw: -90 },
    ],
  },

  bombsites: [
    { name: 'A', min: [15, 0, -5], max: [29, 3, 7] },
    { name: 'B', min: [-30, 0, 1], max: [-16, 3, 13] },
  ],

  buyzones: {
    t: { min: [-14, 0, -36], max: [10, 4, -28] },
    ct: { min: [-6, 0, 26], max: [14, 4, 34] },
  },
};

export default buildFloorplan(spec);
