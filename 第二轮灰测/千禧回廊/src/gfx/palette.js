// ============================================================================
//  palette.js —— 千禧年中式色板
//  取色思路：偏暖、偏旧、饱和度中等偏低，像被 2000 年的白炽灯和夕阳晒过一遍
// ============================================================================

export const P = {
  // —— 楼道 / 单元门（90 末～2000 初城市住宅公共部位）——
  wallCream: '#d9c8a2',      // 米黄涂料墙面
  wallCream2: '#e4d5b2',
  dadoGreen: '#3c5a4b',      // 墨绿墙裙（最经典）
  dadoGreen2: '#2e463b',
  dadoBlue: '#3f5a6b',       // 少数楼道的蓝灰墙裙
  dadoLine: '#f0e6cd',       // 墙裙上沿的白线
  terrazzoBase: '#8d8f84',   // 水磨石地面
  terrazzoChip: ['#e8e6dc', '#5c6157', '#b9b3a2', '#3f4a42', '#d9cdb4'],
  ironRail: '#4a4a46',       // 楼梯铁栏杆
  meterGrey: '#9a9c93',      // 电表箱铁皮

  // —— 家（中式梦核核心）——
  homeWall: '#e7d8bb',       // 暖白 / 米白涂料
  homeWall2: '#eee2c6',
  cabYellow: '#d9a441',      // 黄柜子（漆面）
  cabYellowLit: '#efc367',
  cabYellowDark: '#a9762a',
  woodBase: '#c69963',       // 原木色板材（三聚氰胺贴面）
  woodDark: '#8a5f33',
  woodLight: '#e0bd8b',
  redwood: '#7a3b28',        // 红木家具 / 门套
  redwoodDark: '#54281c',
  floorWood: '#b4854f',      // 木地板
  floorWoodDark: '#8a6034',
  tileWhite: '#e9e6dc',      // 厨卫白瓷砖
  tileGrout: '#b4ae9d',
  tileFlower: '#7ba39a',     // 腰线花砖
  glassFrost: '#cfd8d2',     // 磨砂玻璃
  lace: '#f6f1e2',           // 沙发蕾丝布 / 桌布

  // —— 千禧年公共建筑（后现代 + 中华复兴式）——
  glassTeal: '#2e6f78',      // 蓝绿玻璃幕墙
  glassTealLit: '#8ecfd6',
  glassGreen: '#20504a',     // 墨绿玻璃
  glassBlue: '#27527f',      // 蓝玻璃
  mullion: '#98a1a4',        // 铝合金框
  marbleBase: '#e7dcc6',     // 大理石
  marbleVein: '#ab9576',
  marbleDark: '#9d8b6e',
  steel: '#b6bec2',          // 不锈钢
  steelDark: '#7e868a',
  bannerRed: '#b0231c',      // 红横幅
  bannerGold: '#eccb72',
  roofTile: '#586a72',       // 大屋檐琉璃瓦（青灰）
  roofTileWarm: '#8a5f45',   // 檐口木构
  dougongRed: '#8e3a2c',     // 斗拱朱红
  dougongGold: '#c9a24a',    // 斗拱金线

  // —— 天光 / 雾 / 环境 ——
  skyTop: '#7c6d8e',         // 黄昏顶部（微紫）
  skyMid: '#e39a5d',
  skyLow: '#f7d29a',
  skyHaze: '#f2c78e',
  fogWarm: '#c1904f',        // 暖雾（主）
  fogIndoor: '#6b4f33',      // 室内暖暗雾
  fogNight: '#2a2118',
  lampWarm: '#ffe6b0',       // 白炽灯
  lampFluor: '#e8f2e6',      // 日光灯（略偏青绿）
  crtGlow: '#8fb6c9',        // CRT 冷光
};

/** 每个区域的环境参数（雾色、亮度、天空） */
export const AMBIENCE = {
  stair: {
    fog: P.fogIndoor, fogStart: 1.2, fogEnd: 15, light: 0.42, sky: null,
  },
  home: {
    fog: '#5a3f27', fogStart: 1.0, fogEnd: 13, light: 0.56, sky: null,
  },
  lobby: {
    fog: '#7d6642', fogStart: 2.0, fogEnd: 28, light: 0.6, sky: null,
  },
  tower: {
    fog: '#6a5236', fogStart: 1.2, fogEnd: 17, light: 0.54, sky: null,
  },
  roof: {
    fog: P.fogWarm, fogStart: 3, fogEnd: 34, light: 0.86,
    sky: { top: P.skyTop, mid: P.skyMid, low: P.skyLow },
  },
};
