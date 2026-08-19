// ---------------------------------------------------------------------------
// 地图注册表
// ---------------------------------------------------------------------------

import dust2 from './dust2.js';
import mirage from './mirage.js';
import office from './office.js';
import arena from './arena.js';

export const MAPS = { dust2, mirage, office, arena };

export const MAP_LIST = [
  { id: 'dust2', map: dust2, desc: '经典沙漠双点，长 A / 中路 / 管道三线开花', bomb: true },
  { id: 'mirage', map: mirage, desc: '二楼、中路窗户、B 短公寓，站位讲究', bomb: true },
  { id: 'office', map: office, desc: '室内办公楼近距离缠斗，车库与办公区两个包点', bomb: true },
  { id: 'arena', map: arena, desc: '小型对称竞技场，适合死斗与枪法练习', bomb: false },
];

export function getMap(id) { return MAPS[id] || dust2; }
