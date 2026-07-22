/* ============ 全局配置 ============ */
COC.CFG = {
  /* 等距瓦片（世界单位） */
  TILE_W: 64,
  TILE_H: 32,

  /* 地图 */
  MAP: 44,          // 总格数（含边缘不可建区）
  BORDER: 2,        // 边缘不可建圈数
  HOME_SPAWN_TREES: 14,

  /* 相机 */
  ZOOM_MIN: 0.5,
  ZOOM_MAX: 2.2,

  /* 经济 */
  START_GOLD: 1500,
  START_ELIXIR: 1500,
  START_GEMS: 250,
  BUILDERS_START: 2,
  BUILDER_HUT_GEM_COST: [0, 0, 250, 500],  // 第3、4个工人小屋用宝石
  GEM_PER_MIN_SKIP: 1,                     // 每分钟剩余时间=1宝石
  OBSTACLE_GEM_CHANCE: 0.28,

  /* 战斗 */
  BATTLE_TIME: 180,
  SCOUT_COST: 50,
  LOOT_STORAGE_PCT: 0.2,
  LOOT_COLLECTOR_PCT: 0.5,
  LOOT_TH_GOLD: 500,
  LOOT_TH_ELIXIR: 500,
  TROPHY_WIN: [10, 14, 20],   // 按星数
  TROPHY_LOSE: 8,

  /* 保存 */
  SAVE_KEY: 'coc_village_save_v1',
  SAVE_INTERVAL: 5000
};
