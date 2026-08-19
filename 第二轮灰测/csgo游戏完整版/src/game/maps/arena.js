/*
 * aim_arena / 竞技场 —— 中小型左右+前后严格对称竞技场（死斗、枪法练习 mode:'dm'）
 * 风格参考 aim_map / awp_lego：中央一排掩体箱、两侧对称通道、两端出生区、少量高台。
 *
 * 坐标：右手系，Y 向上，单位米。主地面 y = 0（地板 brush y -1..0）。全部坐标为 0.5m 整数倍。
 * 范围：X [-22,22]  Z [-22,22]  Y [-1,10]；外墙 x/z = ±20..±20.5，高 8m，整图封闭。
 * 对称：几何相对 x=0 与 z=0 双向镜像（T 侧 <-> CT 侧完全一致）。
 * 高度：主通路全部平地 y=0（高差 0，满足"仅走路即可全图连通"）。
 *       高台顶面 1.5m，用 0.5m/1.0m 两级方块靠外墙上台（需轻跳，非连通性必需）。
 *       掩体高度 1.0m（蹲身/跳蹲可上）、1.5m、2.0m（硬掩体），立柱 4.0m。
 *
 *            X=-20        X=-13.5   X=0    X=+13.5        X=+20
 *   Z=+20   +==============================================+   北外墙
 *           |  CT 出生区 / 购买区   z +14 .. +19.5         |
 *   Z=+13.5 |  ---- 低墙 z=+13.5..+14 (1m) ----            |
 *           | 西 |  角掩体          中路北           | 东  |
 *   Z=+8    | 通 |==隔墙 z +8..+13==|      |==隔墙==| 通    |
 *           | 道 |                                  | 道   |
 *   Z=+3    |[高 |==隔墙 z +3..+6.5=|      |==隔墙==| 高]  |
 *   Z=0     |台] |  箱 箱 [中央 2m 大箱] 箱 箱      |台]   |   <- 中央掩体排
 *   Z=-3    |[高 |==隔墙 z -6.5..-3=|      |==隔墙==| 高]  |
 *   Z=-8    | 道 |==隔墙 z -13..-8==|      |==隔墙==| 道   |
 *           | 西 |  立柱 / 木箱     中路南           | 东   |
 *   Z=-13.5 |  ---- 低墙 z=-14..-13.5 (1m) ----           |
 *           |  T 出生区 / 购买区    z -19.5 .. -14        |
 *   Z=-20   +==============================================+   南外墙
 *
 * 主通路（全平地，无高差）：
 *   1) T(0,-17.5) -> 低墙中央 8m 缺口(x -4..4, z -13.5) -> 中路南 -> 中央大箱两侧(x ±2.5..±5) -> CT 侧同构。
 *   2) T -> x -13.5..-10 缺口 -> 西通道(净宽 3.5~6.5m, x -20..-13.5) -> 隔墙 1.5m 门缝(z -8..-6.5 / -6.5..-3 之间)
 *      或中央 6m 开口(z -3..+3) 回到中路；东侧完全镜像。
 */

export default {
  id: 'aim_arena',
  name: 'Arena',
  nameCN: '竞技场',
  mode: 'dm',
  sky: {
    top: [0.40, 0.58, 0.84], bottom: [0.82, 0.84, 0.82],
    sunDir: [-0.42, -0.80, -0.43],
    sunColor: [1.15, 1.08, 0.95],
    ambient: [0.35, 0.37, 0.43],
    fog: { color: [0.74, 0.76, 0.78], start: 60, end: 220 }
  },
  bounds: { min: [-22, -1, -22], max: [22, 10, 22] },
  brushes: [
    // --- 外壳：连续地板（y -1..0）+ 8m 高外墙，整图封闭 (7) ---
    { min: [-20.5, -1, -20.5], max: [20.5, 0, -8], mat: 'gravel', nodraw: ['bottom'] },
    { min: [-20.5, -1, 8], max: [20.5, 0, 20.5], mat: 'gravel', nodraw: ['bottom'] },
    { min: [-20.5, -1, -8], max: [20.5, 0, 8], mat: 'concrete', tile: 0.5, nodraw: ['bottom'] },
    { min: [-20.5, -1, -20.5], max: [-20, 8, 20.5], mat: 'concrete_dark' },
    { min: [20, -1, -20.5], max: [20.5, 8, 20.5], mat: 'concrete_dark' },
    { min: [-20.5, -1, -20.5], max: [20.5, 8, -20], mat: 'concrete_dark' },
    { min: [-20.5, -1, 20], max: [20.5, 8, 20.5], mat: 'concrete_dark' },

    // --- 中路：中央掩体排（z 轴对称，x 轴对称） (7) ---
    { min: [-2.5, 0, -1.5], max: [2.5, 2, 1.5], mat: 'crate' },
    { min: [-8, 0, -1], max: [-5, 1.5, 1], mat: 'crate' },
    { min: [5, 0, -1], max: [8, 1.5, 1], mat: 'crate' },
    { min: [-11.5, 0, -1], max: [-9.5, 1, 1], mat: 'crate' },
    { min: [9.5, 0, -1], max: [11.5, 1, 1], mat: 'crate' },
    { min: [-1.5, 0, -6], max: [1.5, 1, -4], mat: 'crate' },
    { min: [-1.5, 0, 4], max: [1.5, 1, 6], mat: 'crate' },

    // --- 两侧通道隔墙（x = ±13..±13.5，留 1.5m 门缝 + 6m 中央开口） (16) ---
    { min: [-13.5, 0, -13], max: [-13, 3.5, -8], mat: 'brick' },
    { min: [13, 0, -13], max: [13.5, 3.5, -8], mat: 'brick' },
    { min: [-13.5, 0, 8], max: [-13, 3.5, 13], mat: 'brick' },
    { min: [13, 0, 8], max: [13.5, 3.5, 13], mat: 'brick' },
    { min: [-13.5, 0, -6.5], max: [-13, 3.5, -3], mat: 'brick' },
    { min: [13, 0, -6.5], max: [13.5, 3.5, -3], mat: 'brick' },
    { min: [-13.5, 0, 3], max: [-13, 3.5, 6.5], mat: 'brick' },
    { min: [13, 0, 3], max: [13.5, 3.5, 6.5], mat: 'brick' },
    { min: [-20.5, 0, -9], max: [-18, 3, -8.5], mat: 'brick' },
    { min: [18, 0, -9], max: [20.5, 3, -8.5], mat: 'brick' },
    { min: [-20.5, 0, 8.5], max: [-18, 3, 9], mat: 'brick' },
    { min: [18, 0, 8.5], max: [20.5, 3, 9], mat: 'brick' },
    { min: [-12, 0, -6.5], max: [-11.5, 2, -4.5], mat: 'metal_plate' },
    { min: [11.5, 0, -6.5], max: [12, 2, -4.5], mat: 'metal_plate' },
    { min: [-12, 0, 4.5], max: [-11.5, 2, 6.5], mat: 'metal_plate' },
    { min: [11.5, 0, 4.5], max: [12, 2, 6.5], mat: 'metal_plate' },

    // --- 两侧高台（顶面 y=1.5）+ 0.5m 台阶叠（轻跳上台，主通路不依赖它） (10) ---
    { min: [-20.5, 0, -5], max: [-17, 1.5, 5], mat: 'metal_plate' },
    { min: [17, 0, -5], max: [20.5, 1.5, 5], mat: 'metal_plate' },
    { min: [-20.5, 0, -6], max: [-17, 1, -5], mat: 'metal_plate' },
    { min: [17, 0, -6], max: [20.5, 1, -5], mat: 'metal_plate' },
    { min: [-20.5, 0, 5], max: [-17, 1, 6], mat: 'metal_plate' },
    { min: [17, 0, 5], max: [20.5, 1, 6], mat: 'metal_plate' },
    { min: [-20.5, 0, -7], max: [-17, 0.5, -6], mat: 'metal_plate' },
    { min: [17, 0, -7], max: [20.5, 0.5, -6], mat: 'metal_plate' },
    { min: [-20.5, 0, 6], max: [-17, 0.5, 7], mat: 'metal_plate' },
    { min: [17, 0, 6], max: [20.5, 0.5, 7], mat: 'metal_plate' },

    // --- 中场立柱与硬掩体 (24) ---
    { min: [-10, 0, -4], max: [-9, 4, -3], mat: 'concrete' },
    { min: [9, 0, -4], max: [10, 4, -3], mat: 'concrete' },
    { min: [-10, 0, 3], max: [-9, 4, 4], mat: 'concrete' },
    { min: [9, 0, 3], max: [10, 4, 4], mat: 'concrete' },
    { min: [-4.5, 0, -7.5], max: [-3.5, 4, -6.5], mat: 'concrete' },
    { min: [3.5, 0, -7.5], max: [4.5, 4, -6.5], mat: 'concrete' },
    { min: [-4.5, 0, 6.5], max: [-3.5, 4, 7.5], mat: 'concrete' },
    { min: [3.5, 0, 6.5], max: [4.5, 4, 7.5], mat: 'concrete' },
    { min: [-6, 0, -11], max: [-5, 4, -10], mat: 'concrete' },
    { min: [5, 0, -11], max: [6, 4, -10], mat: 'concrete' },
    { min: [-6, 0, 10], max: [-5, 4, 11], mat: 'concrete' },
    { min: [5, 0, 10], max: [6, 4, 11], mat: 'concrete' },
    { min: [-6, 0, -4], max: [-5, 2, -3], mat: 'brick' },
    { min: [5, 0, -4], max: [6, 2, -3], mat: 'brick' },
    { min: [-6, 0, 3], max: [-5, 2, 4], mat: 'brick' },
    { min: [5, 0, 3], max: [6, 2, 4], mat: 'brick' },
    { min: [-7, 0, -10], max: [-4, 1.5, -9], mat: 'crate' },
    { min: [4, 0, -10], max: [7, 1.5, -9], mat: 'crate' },
    { min: [-7, 0, 9], max: [-4, 1.5, 10], mat: 'crate' },
    { min: [4, 0, 9], max: [7, 1.5, 10], mat: 'crate' },
    { min: [-2.5, 0, -11.5], max: [-1, 1.5, -10], mat: 'crate' },
    { min: [1, 0, -11.5], max: [2.5, 1.5, -10], mat: 'crate' },
    { min: [-2.5, 0, 10], max: [-1, 1.5, 11.5], mat: 'crate' },
    { min: [1, 0, 10], max: [2.5, 1.5, 11.5], mat: 'crate' },

    // --- 出生区前掩体（低墙 1m + 木箱） (12) ---
    { min: [-10, 0, -14], max: [-4, 1, -13.5], mat: 'concrete' },
    { min: [4, 0, -14], max: [10, 1, -13.5], mat: 'concrete' },
    { min: [-10, 0, 13.5], max: [-4, 1, 14], mat: 'concrete' },
    { min: [4, 0, 13.5], max: [10, 1, 14], mat: 'concrete' },
    { min: [-3, 0, -16], max: [-1, 1, -15], mat: 'crate' },
    { min: [1, 0, -16], max: [3, 1, -15], mat: 'crate' },
    { min: [-3, 0, 15], max: [-1, 1, 16], mat: 'crate' },
    { min: [1, 0, 15], max: [3, 1, 16], mat: 'crate' },
    { min: [-16.5, 0, -11], max: [-15, 1, -10], mat: 'crate' },
    { min: [15, 0, -11], max: [16.5, 1, -10], mat: 'crate' },
    { min: [-16.5, 0, 10], max: [-15, 1, 11], mat: 'crate' },
    { min: [15, 0, 10], max: [16.5, 1, 11], mat: 'crate' },

    // --- 四角掩体 (8) ---
    { min: [-19, 0, -19], max: [-16, 1.5, -16], mat: 'concrete' },
    { min: [16, 0, -19], max: [19, 1.5, -16], mat: 'concrete' },
    { min: [-19, 0, 16], max: [-16, 1.5, 19], mat: 'concrete' },
    { min: [16, 0, 16], max: [19, 1.5, 19], mat: 'concrete' },
    { min: [-19.5, 0, -14], max: [-18, 1.5, -12.5], mat: 'crate' },
    { min: [18, 0, -14], max: [19.5, 1.5, -12.5], mat: 'crate' },
    { min: [-19.5, 0, 12.5], max: [-18, 1.5, 14], mat: 'crate' },
    { min: [18, 0, 12.5], max: [19.5, 1.5, 14], mat: 'crate' },
  ],
  props: [
    { type: 'crate', pos: [-10.5, 0, -14.5], size: [1.5, 1, 1.5], mat: 'crate' },
    { type: 'crate', pos: [10.5, 0, -14.5], size: [1.5, 1, 1.5], mat: 'crate' },
    { type: 'crate', pos: [-10.5, 0, 14.5], size: [1.5, 1, 1.5], mat: 'crate' },
    { type: 'crate', pos: [10.5, 0, 14.5], size: [1.5, 1, 1.5], mat: 'crate' },
    { type: 'barrel', pos: [-5.5, 0, -13], size: [1, 1.5, 1], mat: 'metal' },
    { type: 'barrel', pos: [5.5, 0, -13], size: [1, 1.5, 1], mat: 'metal' },
    { type: 'barrel', pos: [-5.5, 0, 13], size: [1, 1.5, 1], mat: 'metal' },
    { type: 'barrel', pos: [5.5, 0, 13], size: [1, 1.5, 1], mat: 'metal' },
    { type: 'sandbag', pos: [-18.5, 1.5, -3.5], size: [2, 1, 1], mat: 'sandbag' },
    { type: 'sandbag', pos: [18.5, 1.5, -3.5], size: [2, 1, 1], mat: 'sandbag' },
    { type: 'sandbag', pos: [-18.5, 1.5, 3.5], size: [2, 1, 1], mat: 'sandbag' },
    { type: 'sandbag', pos: [18.5, 1.5, 3.5], size: [2, 1, 1], mat: 'sandbag' },
    { type: 'box', pos: [-8.5, 0, -5], size: [1, 0.5, 1], mat: 'wood' },
    { type: 'box', pos: [8.5, 0, -5], size: [1, 0.5, 1], mat: 'wood' },
    { type: 'box', pos: [-8.5, 0, 5], size: [1, 0.5, 1], mat: 'wood' },
    { type: 'box', pos: [8.5, 0, 5], size: [1, 0.5, 1], mat: 'wood' },
    { type: 'crate', pos: [-17, 0, -8], size: [1.5, 1, 1.5], mat: 'crate' },
    { type: 'crate', pos: [17, 0, -8], size: [1.5, 1, 1.5], mat: 'crate' },
    { type: 'crate', pos: [-17, 0, 8], size: [1.5, 1, 1.5], mat: 'crate' },
    { type: 'crate', pos: [17, 0, 8], size: [1.5, 1, 1.5], mat: 'crate' },
    { type: 'pillar', pos: [-18.5, 1.5, 0], size: [1, 2, 1], mat: 'concrete' },
    { type: 'pillar', pos: [18.5, 1.5, 0], size: [1, 2, 1], mat: 'concrete' },
    { type: 'barrel', pos: [-14.5, 0, 0], size: [1, 1.5, 1], mat: 'rubber' },
    { type: 'barrel', pos: [14.5, 0, 0], size: [1, 1.5, 1], mat: 'rubber' },
  ],
  spawns: {
    t: [
      { pos: [-10.5, 0, -17.5], yaw: 90 },
      { pos: [-7.5, 0, -17.5], yaw: 90 },
      { pos: [-4.5, 0, -17.5], yaw: 90 },
      { pos: [-1.5, 0, -17.5], yaw: 90 },
      { pos: [1.5, 0, -17.5], yaw: 90 },
      { pos: [4.5, 0, -17.5], yaw: 90 },
      { pos: [7.5, 0, -17.5], yaw: 90 },
      { pos: [10.5, 0, -17.5], yaw: 90 },
    ],
    ct: [
      { pos: [-10.5, 0, 17.5], yaw: 270 },
      { pos: [-7.5, 0, 17.5], yaw: 270 },
      { pos: [-4.5, 0, 17.5], yaw: 270 },
      { pos: [-1.5, 0, 17.5], yaw: 270 },
      { pos: [1.5, 0, 17.5], yaw: 270 },
      { pos: [4.5, 0, 17.5], yaw: 270 },
      { pos: [7.5, 0, 17.5], yaw: 270 },
      { pos: [10.5, 0, 17.5], yaw: 270 },
    ]
  },
  bombsites: [],
  buyzones: {
    t: { min: [-13, 0, -19.5], max: [13, 4, -14] },
    ct: { min: [-13, 0, 14], max: [13, 4, 19.5] }
  },
  areas: [
    { name: 'T 出生区', min: [-20, 0, -20], max: [20, 6, -13.5] },
    { name: 'CT 出生区', min: [-20, 0, 13.5], max: [20, 6, 20] },
    { name: '中路南', min: [-13.5, 0, -13.5], max: [13.5, 6, -3] },
    { name: '中央', min: [-13.5, 0, -3], max: [13.5, 6, 3] },
    { name: '中路北', min: [-13.5, 0, 3], max: [13.5, 6, 13.5] },
    { name: '西通道南', min: [-20, 0, -13.5], max: [-13.5, 6, -3] },
    { name: '西高台', min: [-20, 0, -3], max: [-13.5, 6, 3] },
    { name: '西通道北', min: [-20, 0, 3], max: [-13.5, 6, 13.5] },
    { name: '东通道南', min: [13.5, 0, -13.5], max: [20, 6, -3] },
    { name: '东高台', min: [13.5, 0, -3], max: [20, 6, 3] },
    { name: '东通道北', min: [13.5, 0, 3], max: [20, 6, 13.5] },
  ]
};
