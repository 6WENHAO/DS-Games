/*
 * cs_office / 办公楼 —— 室内办公楼炸弹拆除图（mode:'bomb'）
 * 参考 cs_office 布局改为炸弹模式：门厅 -> 走廊 -> 开放式办公区(A 包点) -> 北走廊 -> 车库(B 包点)。
 *
 * 坐标：右手系，Y 向上，单位米。主地面 y = 0（地板 y -1..0，6 块拼接、边界完全对齐无缝）。
 * 范围：X [-34,34]  Z [-34,34]  Y [-1,12]；外墙 x/z = ±32..±32.5 高 7m，整图封闭。
 * 高度：室内隔墙 0..4.5m，吊顶 y 4.0..4.5（室内净高 4.0m ≥ 3.0m）；后巷露天。
 *       吊顶用 noclip（只渲染不碰撞）：玩家跳不到 4m 高，且能避免"屋顶"生成出一片
 *       比室内更大的可站立导航区域（见 navmesh.js 的 _prune 说明）。
 *       门洞净宽 ≥ 2.0m、门楣底 2.5m（净高 2.5m ≥ 2.3m）；车库卷帘门净宽 4m、净高 3.5m。
 *       走廊净宽 3.5m；窗：下墙 0..1.0 + 玻璃 1.0..2.0 + 上墙 2.0..2.5 + 门楣 2.5..4.5。
 *       全部主通路平地 y=0（高差 0），仅靠走路即可从任一出生点到达两个包点。
 *
 *          X=-32      -24.5  -20.5   -12   0   +12   +20.5  +24.5     X=+32
 *  Z=+32  +=========================================================+  北外墙
 *         |            后巷 BACK ALLEY (露天)  z +24.5..+32          |
 *         |            CT 出生区 / 购买区      z +28.5..+31.5        |
 *  Z=+24  +===[卷帘门 x -24..-20]======[后门 x 4..6]===[门 22..24]===+
 *         |      车库 / 装卸区        | 厨房/休息室 |  会议室        |
 *         |   x -32..-6.5  z 8.5..24  | x -6..12    |  x 12.5..32    |
 *         |   ** B 包点 x -24..-16 z 12..20 **      |  (玻璃窗带)    |
 *  Z=+8   +==[门 -28..-26]==[口 -16..-13]==[门 1..3]==[门 18..20]====+
 *         |              北走廊 NORTH CORR  z +4.5..+8               |
 *  Z=+4   +==[西走廊口]==[门 -14..-12]=[门 -2..2]=[门 12..14]==[东]==+
 *         | 服务 | 西  |        开放式办公区 OPEN OFFICE      | 东 | 资 |
 *         | 器间 | 走  |        x -20..20  z -12..4           | 走 | 料 |
 *         |      | 廊  |   ** A 包点 x -5..5  z -7..-1 **     | 廊 | 室 |
 *  Z=-12  +==[门 -30..-28]==[口 -23..-21]==[主入口 -3..3]==[21..23]==+
 *         |              南走廊 SOUTH CORR  z -16..-12.5             |
 *  Z=-16  +===[门 -28..-26]========[大门 -4..4]========[门 24..26]===+
 *         |   西储藏间     |       门厅 LOBBY        |  东侧办公室   |
 *         |  x -32..-12.5  |     x -12..12           |  x 12.5..32   |
 *  Z=-28.5+===[门 -26..-24]========[大门 -3..3]=======[门 24..26]====+
 *         |        入口前厅 / T 出生区 + 购买区  z -32..-28.5        |
 *  Z=-32  +=========================================================+  南外墙
 *
 * 主通路（全平地 y=0，逐段净宽已核对）：
 *   T: (0,-30.5) -> 前厅 -> 大门 x -3..3 (6m) -> 门厅 -> 大门 x -4..4 (8m) -> 南走廊(3.5m)
 *      -> 主入口 x -3..3 -> 开放办公区 -> ** A 包点 (0,-4) **。
 *   T->B: 办公区 -> 门 x -2..2 (z=4) -> 北走廊(3.5m) -> 车库口 x -16..-13 (3m) -> 西行 -> ** B 包点 (-20,16) **。
 *   CT: (0,29.5) -> 后巷 -> 卷帘门 x -24..-20 -> 车库 -> ** B **；或后门 x 4..6 -> 厨房 -> 门 x 1..3 -> 北走廊 -> A。
 *   侧路：南走廊 <-> 西/东走廊(x ∓23..∓21) <-> 办公区侧门(z -8..-6 / 0..2) <-> 北走廊，服务器间/资料室各 2 门。
 */

export default {
  id: 'cs_office',
  name: 'Office',
  nameCN: '办公楼',
  mode: 'bomb',
  sky: {
    top: [0.34, 0.46, 0.62], bottom: [0.76, 0.78, 0.80],
    sunDir: [-0.38, -0.86, 0.34],
    sunColor: [1.10, 1.05, 0.98],
    ambient: [0.32, 0.34, 0.40],
    fog: { color: [0.70, 0.72, 0.75], start: 40, end: 180 }
  },
  bounds: { min: [-34, -1, -34], max: [34, 12, 34] },
  brushes: [
    // --- 地板（6 块，边界完全对齐，无缝） (6) ---
    { min: [-32.5, -1, -32.5], max: [32.5, 0, -12], mat: 'tile', tile: 0.5, nodraw: ['bottom'] },
    { min: [-32.5, -1, -12], max: [32.5, 0, 8], mat: 'cloth', nodraw: ['bottom'] },
    { min: [-32.5, -1, 8], max: [-6, 0, 24], mat: 'concrete_dark', nodraw: ['bottom'] },
    { min: [-6, -1, 8], max: [12, 0, 24], mat: 'tile', tile: 0.5, nodraw: ['bottom'] },
    { min: [12, -1, 8], max: [32.5, 0, 24], mat: 'wood', nodraw: ['bottom'] },
    { min: [-32.5, -1, 24], max: [32.5, 0, 32.5], mat: 'gravel', nodraw: ['bottom'] },

    // --- 外墙（7m 高，整图封闭）+ 吊顶（y 4.0..4.5，装饰用 noclip，后巷露天） (7) ---
    { min: [-32.5, -1, -32.5], max: [32.5, 7, -32], mat: 'brick' },
    { min: [-32.5, -1, 32], max: [32.5, 7, 32.5], mat: 'brick' },
    { min: [-32.5, -1, -32.5], max: [-32, 7, 32.5], mat: 'brick' },
    { min: [32, -1, -32.5], max: [32.5, 7, 32.5], mat: 'brick' },
    { min: [-32, 4, -32], max: [32, 4.5, -12.5], mat: 'plaster', nodraw: ['top'], noclip: true },
    { min: [-32, 4, -12.5], max: [32, 4.5, 8.5], mat: 'plaster', nodraw: ['top'], noclip: true },
    { min: [-32, 4, 8.5], max: [32, 4.5, 24.5], mat: 'plaster', nodraw: ['top'], noclip: true },

    // --- 南侧：入口前厅 -> 门厅/西储藏间/东侧办公室（隔墙 z = -28.5..-28） (7) ---
    { min: [-32, 0, -28.5], max: [-26, 4.5, -28], mat: 'plaster' },
    { min: [-26, 2.5, -28.5], max: [-24, 4.5, -28], mat: 'plaster' },
    { min: [-24, 0, -28.5], max: [-3, 4.5, -28], mat: 'plaster' },
    { min: [-3, 2.5, -28.5], max: [3, 4.5, -28], mat: 'plaster' },
    { min: [3, 0, -28.5], max: [24, 4.5, -28], mat: 'plaster' },
    { min: [24, 2.5, -28.5], max: [26, 4.5, -28], mat: 'plaster' },
    { min: [26, 0, -28.5], max: [32, 4.5, -28], mat: 'plaster' },

    // --- 门厅两侧隔墙（x = -12.5..-12 与 12..12.5） (6) ---
    { min: [-12.5, 0, -28.5], max: [-12, 4.5, -24], mat: 'plaster' },
    { min: [-12.5, 2.5, -24], max: [-12, 4.5, -22], mat: 'plaster' },
    { min: [-12.5, 0, -22], max: [-12, 4.5, -16.5], mat: 'plaster' },
    { min: [12, 0, -28.5], max: [12.5, 4.5, -24], mat: 'plaster' },
    { min: [12, 2.5, -24], max: [12.5, 4.5, -22], mat: 'plaster' },
    { min: [12, 0, -22], max: [12.5, 4.5, -16.5], mat: 'plaster' },

    // --- 南走廊北/南隔墙：z = -16.5..-16（门厅侧） (7) ---
    { min: [-32, 0, -16.5], max: [-28, 4.5, -16], mat: 'plaster' },
    { min: [-28, 2.5, -16.5], max: [-26, 4.5, -16], mat: 'plaster' },
    { min: [-26, 0, -16.5], max: [-4, 4.5, -16], mat: 'plaster' },
    { min: [-4, 2.5, -16.5], max: [4, 4.5, -16], mat: 'plaster' },
    { min: [4, 0, -16.5], max: [24, 4.5, -16], mat: 'plaster' },
    { min: [24, 2.5, -16.5], max: [26, 4.5, -16], mat: 'plaster' },
    { min: [26, 0, -16.5], max: [32, 4.5, -16], mat: 'plaster' },

    // --- 办公区南墙 z = -12.5..-12（5 个门洞：服务器间/西走廊/主入口/东走廊/资料室） (11) ---
    { min: [-32, 0, -12.5], max: [-30, 4.5, -12], mat: 'plaster' },
    { min: [-30, 2.5, -12.5], max: [-28, 4.5, -12], mat: 'plaster' },
    { min: [-28, 0, -12.5], max: [-23, 4.5, -12], mat: 'plaster' },
    { min: [-23, 2.5, -12.5], max: [-21, 4.5, -12], mat: 'plaster' },
    { min: [-21, 0, -12.5], max: [-3, 4.5, -12], mat: 'plaster' },
    { min: [-3, 2.5, -12.5], max: [3, 4.5, -12], mat: 'plaster' },
    { min: [3, 0, -12.5], max: [21, 4.5, -12], mat: 'plaster' },
    { min: [21, 2.5, -12.5], max: [23, 4.5, -12], mat: 'plaster' },
    { min: [23, 0, -12.5], max: [28, 4.5, -12], mat: 'plaster' },
    { min: [28, 2.5, -12.5], max: [30, 4.5, -12], mat: 'plaster' },
    { min: [30, 0, -12.5], max: [32, 4.5, -12], mat: 'plaster' },

    // --- 办公区东西墙（x = ±20 一线，各 2 个门洞） (10) ---
    { min: [-20.5, 0, -12], max: [-20, 4.5, -8], mat: 'plaster' },
    { min: [-20.5, 2.5, -8], max: [-20, 4.5, -6], mat: 'plaster' },
    { min: [-20.5, 0, -6], max: [-20, 4.5, 0], mat: 'plaster' },
    { min: [-20.5, 2.5, 0], max: [-20, 4.5, 2], mat: 'plaster' },
    { min: [-20.5, 0, 2], max: [-20, 4.5, 4], mat: 'plaster' },
    { min: [20, 0, -12], max: [20.5, 4.5, -8], mat: 'plaster' },
    { min: [20, 2.5, -8], max: [20.5, 4.5, -6], mat: 'plaster' },
    { min: [20, 0, -6], max: [20.5, 4.5, 0], mat: 'plaster' },
    { min: [20, 2.5, 0], max: [20.5, 4.5, 2], mat: 'plaster' },
    { min: [20, 0, 2], max: [20.5, 4.5, 4], mat: 'plaster' },

    // --- 侧走廊与侧房隔墙（x = -24.5..-24 服务器间 / 24..24.5 资料室） (6) ---
    { min: [-24.5, 0, -12], max: [-24, 4.5, -4], mat: 'plaster' },
    { min: [-24.5, 2.5, -4], max: [-24, 4.5, -2], mat: 'plaster' },
    { min: [-24.5, 0, -2], max: [-24, 4.5, 4.5], mat: 'plaster' },
    { min: [24, 0, -12], max: [24.5, 4.5, -4], mat: 'plaster' },
    { min: [24, 2.5, -4], max: [24.5, 4.5, -2], mat: 'plaster' },
    { min: [24, 0, -2], max: [24.5, 4.5, 4.5], mat: 'plaster' },

    // --- 北走廊南墙 z = 4..4.5（两侧走廊贯通口 + 办公区 3 个门洞） (11) ---
    { min: [-32, 0, 4], max: [-24, 4.5, 4.5], mat: 'plaster' },
    { min: [-24, 2.5, 4], max: [-20.5, 4.5, 4.5], mat: 'plaster' },
    { min: [-20.5, 0, 4], max: [-14, 4.5, 4.5], mat: 'plaster' },
    { min: [-14, 2.5, 4], max: [-12, 4.5, 4.5], mat: 'plaster' },
    { min: [-12, 0, 4], max: [-2, 4.5, 4.5], mat: 'plaster' },
    { min: [-2, 2.5, 4], max: [2, 4.5, 4.5], mat: 'plaster' },
    { min: [2, 0, 4], max: [12, 4.5, 4.5], mat: 'plaster' },
    { min: [12, 2.5, 4], max: [14, 4.5, 4.5], mat: 'plaster' },
    { min: [14, 0, 4], max: [20.5, 4.5, 4.5], mat: 'plaster' },
    { min: [20.5, 2.5, 4], max: [24, 4.5, 4.5], mat: 'plaster' },
    { min: [24, 0, 4], max: [32, 4.5, 4.5], mat: 'plaster' },

    // --- 北走廊北墙 z = 8..8.5（车库 2 口 / 厨房门 / 会议室门 / 会议室玻璃窗带） (14) ---
    { min: [-32, 0, 8], max: [-28, 4.5, 8.5], mat: 'plaster' },
    { min: [-28, 2.5, 8], max: [-26, 4.5, 8.5], mat: 'plaster' },
    { min: [-26, 0, 8], max: [-16, 4.5, 8.5], mat: 'plaster' },
    { min: [-16, 2.5, 8], max: [-13, 4.5, 8.5], mat: 'plaster' },
    { min: [-13, 0, 8], max: [1, 4.5, 8.5], mat: 'plaster' },
    { min: [1, 2.5, 8], max: [3, 4.5, 8.5], mat: 'plaster' },
    { min: [3, 0, 8], max: [18, 4.5, 8.5], mat: 'plaster' },
    { min: [18, 2.5, 8], max: [20, 4.5, 8.5], mat: 'plaster' },
    { min: [20, 0, 8], max: [22, 4.5, 8.5], mat: 'plaster' },
    { min: [22, 2.5, 8], max: [28, 4.5, 8.5], mat: 'plaster' },
    { min: [28, 0, 8], max: [32, 4.5, 8.5], mat: 'plaster' },
    { min: [22, 0, 8], max: [28, 1, 8.5], mat: 'plaster' },
    { min: [22, 1, 8], max: [28, 2, 8.5], mat: 'glass' },
    { min: [22, 2, 8], max: [28, 2.5, 8.5], mat: 'plaster' },

    // --- 北区分隔：车库|厨房（x = -6.5..-6）、厨房|会议室（x = 12..12.5，带玻璃窗带） (11) ---
    { min: [-6.5, 0, 8.5], max: [-6, 4.5, 14], mat: 'plaster' },
    { min: [-6.5, 2.5, 14], max: [-6, 4.5, 16], mat: 'plaster' },
    { min: [-6.5, 0, 16], max: [-6, 4.5, 24], mat: 'plaster' },
    { min: [12, 0, 8.5], max: [12.5, 4.5, 12], mat: 'plaster' },
    { min: [12, 2.5, 12], max: [12.5, 4.5, 16], mat: 'plaster' },
    { min: [12, 0, 16], max: [12.5, 4.5, 18], mat: 'plaster' },
    { min: [12, 2.5, 18], max: [12.5, 4.5, 20], mat: 'plaster' },
    { min: [12, 0, 20], max: [12.5, 4.5, 24], mat: 'plaster' },
    { min: [12, 0, 12], max: [12.5, 1, 16], mat: 'plaster' },
    { min: [12, 1, 12], max: [12.5, 2, 16], mat: 'glass' },
    { min: [12, 2, 12], max: [12.5, 2.5, 16], mat: 'plaster' },

    // --- 后巷墙 z = 24..24.5（车库卷帘门净高 3.5m / 厨房后门 / 会议室后门） (7) ---
    { min: [-32, 0, 24], max: [-24, 4.5, 24.5], mat: 'plaster' },
    { min: [-24, 3.5, 24], max: [-20, 4.5, 24.5], mat: 'plaster' },
    { min: [-20, 0, 24], max: [4, 4.5, 24.5], mat: 'plaster' },
    { min: [4, 2.5, 24], max: [6, 4.5, 24.5], mat: 'plaster' },
    { min: [6, 0, 24], max: [22, 4.5, 24.5], mat: 'plaster' },
    { min: [22, 2.5, 24], max: [24, 4.5, 24.5], mat: 'plaster' },
    { min: [24, 0, 24], max: [32, 4.5, 24.5], mat: 'plaster' },

    // --- 入口前厅细节 (4) ---
    { min: [-16, 0, -31], max: [-14, 1, -29.5], mat: 'concrete' },
    { min: [14, 0, -31], max: [16, 1, -29.5], mat: 'concrete' },
    { min: [-20, 0, -31], max: [-19, 4.5, -30], mat: 'plaster' },
    { min: [19, 0, -31], max: [20, 4.5, -30], mat: 'plaster' },

    // --- 门厅：前台、绿化池、方柱 (6) ---
    { min: [-4, 0, -20], max: [4, 1, -19], mat: 'wood' },
    { min: [3.5, 0, -24], max: [4.5, 1, -19.5], mat: 'wood' },
    { min: [-11, 0, -27], max: [-9, 0.5, -25], mat: 'concrete' },
    { min: [9, 0, -27], max: [11, 0.5, -25], mat: 'concrete' },
    { min: [-6, 0, -26], max: [-5, 4.5, -25], mat: 'plaster' },
    { min: [5, 0, -26], max: [6, 4.5, -25], mat: 'plaster' },

    // --- 西储藏间货架 / 东侧办公室隔间 (7) ---
    { min: [-31, 0, -27], max: [-30, 2, -19], mat: 'wood' },
    { min: [-28, 0, -27], max: [-27, 2, -19], mat: 'wood' },
    { min: [-25, 0, -26], max: [-20, 1.5, -25], mat: 'wood' },
    { min: [-18, 0, -27], max: [-16, 2, -25], mat: 'crate' },
    { min: [14, 0, -26], max: [24, 1.5, -25.5], mat: 'wood' },
    { min: [19, 0, -25.5], max: [19.5, 1.5, -19], mat: 'wood' },
    { min: [26, 0, -27], max: [26.5, 1.5, -19], mat: 'glass' },

    // --- 南走廊柱垛 (2) ---
    { min: [-8, 0, -16], max: [-7.5, 4.5, -14.5], mat: 'plaster' },
    { min: [7.5, 0, -16], max: [8, 4.5, -14.5], mat: 'plaster' },

    // --- 开放式办公区：隔间矮墙（1.5m）+ 玻璃隔断 + 方柱（A 包点周围留空） (22) ---
    { min: [-16, 0, -1], max: [-6, 1.5, -0.5], mat: 'wood' },
    { min: [6, 0, -1], max: [16, 1.5, -0.5], mat: 'wood' },
    { min: [-11.5, 0, -0.5], max: [-11, 1.5, 3], mat: 'wood' },
    { min: [11, 0, -0.5], max: [11.5, 1.5, 3], mat: 'wood' },
    { min: [-16, 0, 1.5], max: [-11.5, 1.5, 2], mat: 'wood' },
    { min: [11.5, 0, 1.5], max: [16, 1.5, 2], mat: 'wood' },
    { min: [-16, 0, -8.5], max: [-6, 1.5, -8], mat: 'wood' },
    { min: [6, 0, -8.5], max: [16, 1.5, -8], mat: 'wood' },
    { min: [-11.5, 0, -11.5], max: [-11, 1.5, -8.5], mat: 'wood' },
    { min: [11, 0, -11.5], max: [11.5, 1.5, -8.5], mat: 'wood' },
    { min: [-16, 0, -10.5], max: [-11.5, 1.5, -10], mat: 'wood' },
    { min: [11.5, 0, -10.5], max: [16, 1.5, -10], mat: 'wood' },
    { min: [-6, 0, -9], max: [-5.5, 1.5, -5], mat: 'glass' },
    { min: [5.5, 0, -9], max: [6, 1.5, -5], mat: 'glass' },
    { min: [-11, 0, -6], max: [-10, 4.5, -5], mat: 'concrete' },
    { min: [10, 0, -6], max: [11, 4.5, -5], mat: 'concrete' },
    { min: [-11, 0, 0], max: [-10, 4.5, 1], mat: 'concrete' },
    { min: [10, 0, 0], max: [11, 4.5, 1], mat: 'concrete' },
    { min: [-17, 0, -6], max: [-16, 4.5, -5], mat: 'concrete' },
    { min: [16, 0, -6], max: [17, 4.5, -5], mat: 'concrete' },
    { min: [-17, 0, 0], max: [-16, 4.5, 1], mat: 'concrete' },
    { min: [16, 0, 0], max: [17, 4.5, 1], mat: 'concrete' },

    // --- 服务器间 / 资料室内部 (6) ---
    { min: [-31, 0, -10], max: [-30, 2, -2], mat: 'metal_plate' },
    { min: [-28, 0, -10], max: [-27, 2, -2], mat: 'metal_plate' },
    { min: [-31, 0, 0], max: [-26, 1, 2], mat: 'metal_plate' },
    { min: [26, 0, -10], max: [27, 2, -2], mat: 'wood' },
    { min: [29.5, 0, -10], max: [30.5, 2, -2], mat: 'wood' },
    { min: [26, 0, 0], max: [31, 1, 2], mat: 'wood' },

    // --- 厨房 / 休息室：操作台与玻璃隔断 (4) ---
    { min: [-5.5, 0, 22], max: [4, 1, 23], mat: 'metal_plate' },
    { min: [-5.5, 0, 12], max: [-4.5, 1, 20], mat: 'metal_plate' },
    { min: [0, 0, 14], max: [4, 1, 17], mat: 'tile' },
    { min: [6, 0, 9], max: [6.5, 1.5, 14], mat: 'glass' },

    // --- 会议室：边柜、玻璃隔断、白板矮台 (3) ---
    { min: [30, 0, 10], max: [31, 1, 20], mat: 'wood' },
    { min: [16, 0, 21], max: [16.5, 1.5, 23.5], mat: 'glass' },
    { min: [20, 0, 23.5], max: [26, 1.5, 24], mat: 'plaster' },

    // --- 车库 / 装卸区（B 包点在 x -24..-16, z 12..20，中心留空） (11) ---
    { min: [-12, 0, 10], max: [-8, 2.5, 17], mat: 'metal_plate' },
    { min: [-12, 0, 17], max: [-9, 1.5, 20], mat: 'metal_plate' },
    { min: [-32, 0, 20], max: [-26, 1, 24], mat: 'concrete' },
    { min: [-26, 0, 20.5], max: [-25, 0.5, 23.5], mat: 'concrete' },
    { min: [-20, 0, 10], max: [-19, 4.5, 11], mat: 'concrete' },
    { min: [-20, 0, 21], max: [-19, 4.5, 22], mat: 'concrete' },
    { min: [-27, 0, 10], max: [-26, 4.5, 11], mat: 'concrete' },
    { min: [-27, 0, 21], max: [-26, 4.5, 22], mat: 'concrete' },
    { min: [-31, 0, 10], max: [-28, 2, 14], mat: 'crate' },
    { min: [-31, 0, 16], max: [-29, 1.5, 18], mat: 'crate' },
    { min: [-25, 0, 21], max: [-23, 1, 23], mat: 'crate' },

    // --- 后巷：垃圾箱、矮墙（中央留 4m 通道）、花池 (5) ---
    { min: [-30, 0, 26], max: [-27, 1.5, 28], mat: 'metal_plate' },
    { min: [-20, 0, 25], max: [-17, 2, 27], mat: 'metal_plate' },
    { min: [-8, 0, 26], max: [-2, 1, 26.5], mat: 'concrete_dark' },
    { min: [2, 0, 26], max: [8, 1, 26.5], mat: 'concrete_dark' },
    { min: [12, 0, 26], max: [16, 1, 28], mat: 'concrete' },
  ],
  props: [
    { type: 'desk', pos: [-14, 0, 1], size: [2, 1, 1], mat: 'wood' },
    { type: 'desk', pos: [14, 0, 1], size: [2, 1, 1], mat: 'wood' },
    { type: 'desk', pos: [-8.5, 0, 1], size: [2, 1, 1], mat: 'wood' },
    { type: 'desk', pos: [8.5, 0, 1], size: [2, 1, 1], mat: 'wood' },
    { type: 'desk', pos: [-14, 0, -10], size: [2, 1, 1], mat: 'wood' },
    { type: 'desk', pos: [14, 0, -10], size: [2, 1, 1], mat: 'wood' },
    { type: 'desk', pos: [-8.5, 0, -10], size: [2, 1, 1], mat: 'wood' },
    { type: 'desk', pos: [8.5, 0, -10], size: [2, 1, 1], mat: 'wood' },
    { type: 'desk', pos: [-18, 0, -3], size: [1, 1, 2], mat: 'wood' },
    { type: 'desk', pos: [18, 0, -3], size: [1, 1, 2], mat: 'wood' },
    { type: 'plant', pos: [-19, 0, 3], size: [1, 2, 1], mat: 'grass' },
    { type: 'plant', pos: [19, 0, 3], size: [1, 2, 1], mat: 'grass' },
    { type: 'locker', pos: [-19, 0, -11], size: [1.5, 2, 1], mat: 'metal' },
    { type: 'locker', pos: [19, 0, -11], size: [1.5, 2, 1], mat: 'metal' },
    { type: 'table', pos: [0, 0, 19.5], size: [2, 1, 2], mat: 'wood' },
    { type: 'table', pos: [8, 0, 12], size: [2, 1, 2], mat: 'wood' },
    { type: 'sofa', pos: [9, 0, 21], size: [3, 1, 1.5], mat: 'cloth' },
    { type: 'locker', pos: [-5, 0, 10.5], size: [1.5, 2, 1], mat: 'metal' },
    { type: 'locker', pos: [-5, 0, 21.5], size: [1.5, 2, 1], mat: 'metal_plate' },
    { type: 'plant', pos: [10, 0, 10], size: [1, 2, 1], mat: 'grass' },
    { type: 'table', pos: [22, 0, 16], size: [8, 1, 3], mat: 'wood' },
    { type: 'sofa', pos: [14.5, 0, 10], size: [3, 1, 1.5], mat: 'cloth' },
    { type: 'plant', pos: [30, 0, 22.5], size: [1, 2, 1], mat: 'grass' },
    { type: 'plant', pos: [13.5, 0, 23], size: [1, 2, 1], mat: 'grass' },
    { type: 'crate', pos: [-29, 1, 22], size: [2, 1, 2], mat: 'crate' },
    { type: 'barrel', pos: [-24.5, 0, 10.5], size: [1, 1.5, 1], mat: 'metal' },
    { type: 'barrel', pos: [-23, 0, 10.5], size: [1, 1.5, 1], mat: 'rubber' },
    { type: 'crate', pos: [-15, 0, 11], size: [2, 1, 2], mat: 'crate' },
    { type: 'crate', pos: [-15, 0, 21], size: [2, 1, 2], mat: 'crate' },
    { type: 'box', pos: [-10, 2.5, 13], size: [1.5, 1, 1.5], mat: 'wood' },
    { type: 'sandbag', pos: [-19, 0, 22.5], size: [2, 1, 1], mat: 'sandbag' },
    { type: 'barrel', pos: [-30, 0, 15], size: [1, 1.5, 1], mat: 'metal' },
    { type: 'sofa', pos: [-7, 0, -24], size: [3, 1, 1.5], mat: 'cloth' },
    { type: 'sofa', pos: [7, 0, -24], size: [3, 1, 1.5], mat: 'cloth' },
    { type: 'plant', pos: [-10, 0, -18], size: [1, 2, 1], mat: 'grass' },
    { type: 'plant', pos: [10, 0, -18], size: [1, 2, 1], mat: 'grass' },
    { type: 'desk', pos: [0, 0, -22.5], size: [3, 1, 1.5], mat: 'wood' },
    { type: 'plant', pos: [-6, 0, -30.5], size: [1, 2, 1], mat: 'grass' },
    { type: 'plant', pos: [6, 0, -30.5], size: [1, 2, 1], mat: 'grass' },
    { type: 'crate', pos: [-24, 0, -30.5], size: [2, 1, 2], mat: 'crate' },
    { type: 'crate', pos: [-21, 0, -20], size: [2, 1, 2], mat: 'crate' },
    { type: 'crate', pos: [-21, 1, -20], size: [1.5, 1, 1.5], mat: 'crate' },
    { type: 'locker', pos: [-14, 0, -26], size: [1.5, 2, 1], mat: 'metal' },
    { type: 'desk', pos: [16, 0, -22], size: [2, 1, 1], mat: 'wood' },
    { type: 'desk', pos: [22, 0, -22], size: [2, 1, 1], mat: 'wood' },
    { type: 'locker', pos: [30, 0, -19], size: [1.5, 2, 1], mat: 'metal' },
    { type: 'barrel', pos: [-12, 0, 27], size: [1, 1.5, 1], mat: 'metal' },
    { type: 'barrel', pos: [-10.5, 0, 27], size: [1, 1.5, 1], mat: 'rubber' },
    { type: 'crate', pos: [20, 0, 29], size: [2, 1, 2], mat: 'crate' },
    { type: 'crate', pos: [24, 0, 26], size: [2, 1, 2], mat: 'crate' },
    { type: 'sandbag', pos: [0, 0, 31], size: [2, 1, 1], mat: 'sandbag' },
    { type: 'locker', pos: [-26, 0, -11], size: [1.5, 2, 1], mat: 'metal' },
    { type: 'locker', pos: [26.5, 0, -11], size: [1.5, 2, 1], mat: 'metal' },
  ],
  spawns: {
    t: [
      { pos: [-8, 0, -30.5], yaw: 90 },
      { pos: [-4, 0, -30.5], yaw: 90 },
      { pos: [0, 0, -30.5], yaw: 90 },
      { pos: [4, 0, -30.5], yaw: 90 },
      { pos: [8, 0, -30.5], yaw: 90 },
    ],
    ct: [
      { pos: [-8, 0, 29.5], yaw: 270 },
      { pos: [-4, 0, 29.5], yaw: 270 },
      { pos: [0, 0, 29.5], yaw: 270 },
      { pos: [4, 0, 29.5], yaw: 270 },
      { pos: [8, 0, 29.5], yaw: 270 },
    ]
  },
  bombsites: [
    { name: 'A', min: [-5, 0, -7], max: [5, 3, -1] },
    { name: 'B', min: [-24, 0, 12], max: [-16, 3, 20] },
  ],
  buyzones: {
    t: { min: [-12, 0, -32], max: [12, 4, -28.5] },
    ct: { min: [-12, 0, 26], max: [12, 4, 31.5] }
  },
  areas: [
    { name: 'T 出生区 / 入口前厅', min: [-32, 0, -32], max: [32, 6, -28.5] },
    { name: '门厅', min: [-12, 0, -28.5], max: [12, 6, -16] },
    { name: '西储藏间', min: [-32, 0, -28.5], max: [-12, 6, -16] },
    { name: '东侧办公室', min: [12, 0, -28.5], max: [32, 6, -16] },
    { name: '南走廊', min: [-32, 0, -16], max: [32, 6, -12] },
    { name: '办公区南', min: [-20, 0, -12], max: [20, 6, -7] },
    { name: 'A 包点（办公区中央）', min: [-20, 0, -7], max: [20, 6, -1] },
    { name: '办公区北', min: [-20, 0, -1], max: [20, 6, 4] },
    { name: '西走廊', min: [-24, 0, -12], max: [-20, 6, 4] },
    { name: '服务器间', min: [-32, 0, -12], max: [-24, 6, 4] },
    { name: '东走廊', min: [20, 0, -12], max: [24, 6, 4] },
    { name: '资料室', min: [24, 0, -12], max: [32, 6, 4] },
    { name: '北走廊', min: [-32, 0, 4], max: [32, 6, 8] },
    { name: 'B 包点（车库）', min: [-32, 0, 8], max: [-6, 6, 24] },
    { name: '厨房 / 休息室', min: [-6, 0, 8], max: [12, 6, 24] },
    { name: '会议室', min: [12, 0, 8], max: [32, 6, 24] },
    { name: '后巷', min: [-32, 0, 24], max: [32, 6, 28.5] },
    { name: 'CT 出生区', min: [-32, 0, 28.5], max: [32, 6, 32] },
  ]
};
