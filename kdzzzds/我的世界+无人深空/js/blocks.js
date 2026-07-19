// ============ 方块定义 ============
// tex: [top, side, bottom] 图集索引
const BLOCKS = {
  0:  { name: '空气', solid: false },
  1:  { name: '草方块', tex: [0, 1, 2], hard: 0.7, drop: { id: 'ferrite', n: 2 }, tintTop: true },
  2:  { name: '泥土', tex: [2, 2, 2], hard: 0.6, drop: { id: 'ferrite', n: 2 } },
  3:  { name: '岩石', tex: [3, 3, 3], hard: 1.4, drop: { id: 'ferrite', n: 3 } },
  4:  { name: '磁化矿脉', tex: [4, 4, 4], hard: 2.0, drop: { id: 'magferrite', n: 2 } },
  5:  { name: '铜矿脉', tex: [5, 5, 5], hard: 1.8, drop: { id: 'copper', n: 2 } },
  6:  { name: '碳质木干', tex: [7, 6, 7], hard: 1.0, drop: { id: 'carbon', n: 3 } },
  7:  { name: '枝叶', tex: [8, 8, 8], hard: 0.25, drop: { id: 'carbon', n: 1 }, tint: true, translucent: true },
  8:  { name: '砂砾', tex: [9, 9, 9], hard: 0.5, drop: { id: 'ferrite', n: 2 } },
  9:  { name: '钠花', tex: [10, 10, 10], hard: 0.2, drop: { id: 'sodium', n: 8 }, cross: true, light: 0.4 },
  10: { name: '二氢晶体', tex: [11, 11, 11], hard: 1.2, drop: { id: 'dihydrogen', n: 12 }, translucent: true, light: 0.5 },
  11: { name: '产氧红花', tex: [12, 12, 12], hard: 0.2, drop: { id: 'oxygen', n: 8 }, cross: true },
  12: { name: '风化石', tex: [13, 13, 13], hard: 1.4, drop: { id: 'ferrite', n: 3 } },
  13: { name: '地形方块', tex: [14, 14, 14], hard: 0.5, drop: { id: 'ferrite', n: 1 } },
  14: { name: '钴蓝晶簇', tex: [15, 15, 15], hard: 1.5, drop: { id: 'cobalt', n: 4 }, translucent: true, light: 0.4 },
};
const BLOCK_AIR = 0;
