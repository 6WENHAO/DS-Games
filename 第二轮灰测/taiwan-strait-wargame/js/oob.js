/* ============================================================================
 * oob.js — 战斗序列 / 兵力编成 (Order of Battle)
 * ----------------------------------------------------------------------------
 * 数量基线：IISS Military Balance 2025、US DoD CMPR 2024、台湾《113年国防报告书》
 *   PLA 侧为"投入台海方向的可用兵力"（非全军），台军侧为"妥善可用兵力"。
 *   航空兵按"基地库存 + 出动编队"建模：基地存放架数，作战时生成 2-4 机编队实体。
 * ==========================================================================*/
(function (root) {
  'use strict';
  var TWG = root.TWG = root.TWG || {};

  /* =====================================================================
   * 解放军 航空兵基地库存 (架)
   * ===================================================================*/
  var PLA_AIR = {
    'AB-WUHU': { 'J-20A': 28, 'J-16': 12 },
    'AB-QUZHOU': { 'J-20A': 12, 'J-10C': 24 },
    'AB-ANQING': { 'J-16': 24, 'J-16D': 6 },
    'AB-XIANGTANG': { 'J-16': 24, 'JH-7A': 12 },
    'AB-ZHANGSHU': { 'J-11B': 24, 'JH-7A': 12 },
    'AB-LIANCHENG': { 'J-10C': 24, 'J-11B': 12 },
    'AB-LONGTIAN': { 'J-10C': 24, 'J-16': 12 },
    'AB-HUIAN': { 'J-11B': 24, 'GJ-2': 8 },
    'AB-JINJIANG': { 'J-10C': 18, 'Z-10ME': 12 },
    'AB-ZHANGZHOU': { 'Su-30MKK': 24, 'J-16D': 6 },
    'AB-XIAMEN': { 'Z-20': 24, 'Z-8L': 12, 'Z-10ME': 18 },
    'AB-FUZHOU': { 'J-16': 24, 'KJ-500A': 4, 'Y-9JB': 3 },
    'AB-SHUIMEN': { 'J-11B': 12, 'GJ-2': 10, 'WZ-7': 4 },
    'AB-LUQIAO': { 'J-16': 24, 'J-16D': 4 },
    'AB-NINGBO': { 'JH-7A': 24, 'Y-8Q': 5, 'KJ-500A': 4 },
    'AB-DAISHAN': { 'J-11B': 12, 'Y-8Q': 3, 'GJ-11': 6 },
    'AB-SHANTOU': { 'J-10C': 18, 'Su-30MKK': 12 },
    'AB-XINGNING': { 'J-11B': 12, 'GJ-11': 6, 'Y-9': 12 },
    'AB-SUIXI': { 'Su-35S': 24, 'H-6J': 12 },
    'AB-LEIYANG': { 'H-6K': 24, 'KJ-2000': 3 },
    'AB-GUIPING': { 'H-6J': 12, 'Y-20A': 12 }
  };
  // 空降/空运兵力集结基地（战役发起前转场）
  var PLA_AIRLIFT = { 'AB-XIANGTANG': { 'Y-20A': 18, 'Y-9': 28 } };

  /* =====================================================================
   * 台军 航空兵基地库存 (架) —— 已计入妥善率
   * ===================================================================*/
  var ROC_AIR = {
    'AB-HUALIEN': { 'F-16V': 26, 'E-2K': 2 },
    'AB-ZHIHANG': { 'F-16V': 24 },
    'AB-CHIAYI': { 'F-16V': 30, 'F-16C70': 12 },
    'AB-HSINCHU': { 'Mirage-2000': 38, 'E-2K': 2 },
    'AB-CCK': { 'IDF': 34, 'F-16C70': 12, 'UAV-Teng': 3 },
    'AB-TAINAN': { 'IDF': 36, 'UAV-Albat': 12 },
    'AB-PINGTUNG': { 'P-3C': 9, 'AH-1W': 20 },
    'AB-GANGSHAN': { 'IDF': 14, 'AH-64E': 10 },
    'AB-TAOYUAN': { 'AH-64E': 19, 'AH-1W': 24, 'UAV-Albat': 10 },
    'AB-SONGSHAN': { 'AH-1W': 8 },
    'AB-MAKUNG': { 'F-16V': 6 }
  };

  /* =====================================================================
   * 解放军 水面舰艇编组
   *   group: 编组代号(用于AI集群机动)   home: 母港ID
   * ===================================================================*/
  var PLA_NAVAL = [
    /* 航母打击群 */
    { cls: 'CV-Fujian', n: 1, home: 'NB-NINGBO', group: 'CSG-1', name: '福建舰打击群' },
    { cls: 'DDG-055', n: 2, home: 'NB-NINGBO', group: 'CSG-1' },
    { cls: 'DDG-052D', n: 3, home: 'NB-NINGBO', group: 'CSG-1' },
    { cls: 'FFG-054A', n: 3, home: 'NB-NINGBO', group: 'CSG-1' },
    { cls: 'CV-Shandong', n: 1, home: 'NB-ZHOUSHAN', group: 'CSG-2', name: '山东舰打击群' },
    { cls: 'DDG-055', n: 2, home: 'NB-ZHOUSHAN', group: 'CSG-2' },
    { cls: 'DDG-052D', n: 3, home: 'NB-ZHOUSHAN', group: 'CSG-2' },
    { cls: 'FFG-054A', n: 3, home: 'NB-ZHOUSHAN', group: 'CSG-2' },
    /* 水面行动群 (反介入/夺取制海) */
    { cls: 'DDG-055', n: 2, home: 'NB-ZHOUSHAN', group: 'SAG-东', name: '东部反介入编队' },
    { cls: 'DDG-052D', n: 6, home: 'NB-NINGBO', group: 'SAG-东' },
    { cls: 'DDG-052C', n: 4, home: 'NB-ZHOUSHAN', group: 'SAG-东' },
    { cls: 'DDG-051C', n: 2, home: 'NB-NINGBO', group: 'SAG-东' },
    { cls: 'FFG-054B', n: 4, home: 'NB-XIANGSHAN', group: 'SAG-东' },
    /* 海峡封锁/护航编队 */
    { cls: 'DDG-052D', n: 6, home: 'NB-MAWEI', group: 'SAG-峡', name: '海峡封锁编队' },
    { cls: 'FFG-054A', n: 12, home: 'NB-MAWEI', group: 'SAG-峡' },
    { cls: 'FFL-056A', n: 24, home: 'NB-PINGTAN', group: 'SAG-峡' },
    { cls: 'PGG-022', n: 30, home: 'NB-WEITOU', group: 'SAG-峡' },
    /* 南翼编队 (巴士海峡封锁) */
    { cls: 'DDG-055', n: 2, home: 'NB-SHANTOU', group: 'SAG-南', name: '南部封锁编队' },
    { cls: 'DDG-052D', n: 3, home: 'NB-SHANTOU', group: 'SAG-南' },
    { cls: 'FFG-054A', n: 9, home: 'NB-DONGSHAN', group: 'SAG-南' },
    { cls: 'FFL-056A', n: 16, home: 'NB-DONGSHAN', group: 'SAG-南' },
    { cls: 'PGG-022', n: 15, home: 'NB-SHANTOU', group: 'SAG-南' },
    /* 两栖第一梯队 */
    { cls: 'LHA-076', n: 1, home: 'NB-WEITOU', group: 'ATF-1', name: '两栖第一梯队' },
    { cls: 'LHD-075', n: 3, home: 'NB-WEITOU', group: 'ATF-1' },
    { cls: 'LPD-071', n: 8, home: 'NB-XIAMEN', group: 'ATF-1' },
    { cls: 'LST-072A', n: 16, home: 'NB-PINGTAN', group: 'ATF-1' },
    { cls: 'LSM-073A', n: 8, home: 'NB-PINGTAN', group: 'ATF-1' },
    /* 两栖第二梯队 (民船动员 + 登陆驳船) */
    { cls: 'LST-072A', n: 16, home: 'NB-DONGSHAN', group: 'ATF-2', name: '两栖第二梯队' },
    { cls: 'LSM-073A', n: 4, home: 'NB-DONGSHAN', group: 'ATF-2' },
    { cls: 'Shuiqiao', n: 9, home: 'PT-MEIZHOUWAN', group: 'ATF-2' },
    { cls: 'RoRo-Civ', n: 26, home: 'PT-FUZHOU-C', group: 'ATF-2' },
    { cls: 'Militia-Boat', n: 40, home: 'PT-QUANZHOU', group: 'ATF-2' },
    /* 海警/灰色地带 */
    { cls: 'CCG-Zhaotou', n: 12, home: 'NB-XIAMEN', group: 'CCG', name: '海警封控支队' }
  ];

  var PLA_SUBS = [
    { cls: 'SSN-093B', n: 6, home: 'NB-XIANGSHAN', group: 'SUB-核' },
    { cls: 'SS-039C', n: 8, home: 'NB-SANDUAO', group: 'SUB-常' },
    { cls: 'SS-039B', n: 12, home: 'NB-SANDUAO', group: 'SUB-常' },
    { cls: 'SS-Kilo', n: 8, home: 'NB-XIANGSHAN', group: 'SUB-常' }
  ];

  /* =====================================================================
   * 台军 水面/水下兵力
   * ===================================================================*/
  var ROC_NAVAL = [
    { cls: 'DDG-KeeLung', n: 4, home: 'NB-ZUOYING', group: '124舰队', name: '基隆级驱逐舰' },
    { cls: 'FFG-ChengKung', n: 8, home: 'NB-ZUOYING', group: '146舰队' },
    { cls: 'FFG-KangDing', n: 6, home: 'NB-KEELUNG', group: '124舰队' },
    { cls: 'PGG-TuoChiang', n: 6, home: 'NB-SUAO', group: '131舰队', name: '沱江级飞弹舰' },
    { cls: 'PGG-KuangHua6', n: 28, home: 'NB-ANPING', group: '海锋大队' },
    { cls: 'PC-ChingChiang', n: 10, home: 'NB-MAGONG', group: '巡逻舰队' },
    { cls: 'MineLayer-Min', n: 4, home: 'NB-ZUOYING', group: '布雷队' },
    { cls: 'LPD-YuShan', n: 1, home: 'NB-ZUOYING', group: '两栖' }
  ];
  var ROC_SUBS = [
    { cls: 'SS-HaiKun', n: 1, home: 'NB-ZUOYING', group: '潜艇战队' },
    { cls: 'SS-HaiLung', n: 2, home: 'NB-ZUOYING', group: '潜艇战队' }
  ];

  /* =====================================================================
   * 解放军 火箭军/远火 (发射阵地 — 内陆机动区)
   * ===================================================================*/
  var PLA_MISSILE = [
    { cls: 'BDE-SRBM', n: 1, lat: 26.20, lon: 117.60, name: '火箭军611旅 (南平)' },
    { cls: 'BDE-SRBM', n: 1, lat: 25.97, lon: 117.36, name: '火箭军614旅 (永安)' },
    { cls: 'BDE-SRBM', n: 1, lat: 25.10, lon: 117.03, name: '火箭军615旅 (龙岩)' },
    { cls: 'BDE-SRBM', n: 1, lat: 27.33, lon: 117.47, name: '火箭军617旅 (南平北)' },
    { cls: 'BDE-SRBM', n: 1, lat: 28.45, lon: 117.97, name: '火箭军613旅 (上饶)' },
    { cls: 'BDE-SRBM', n: 1, lat: 25.83, lon: 114.93, name: '火箭军616旅 (赣州)' },
    { cls: 'BDE-SRBM16', n: 1, lat: 26.90, lon: 116.30, name: '东风-16旅 (建宁)' },
    { cls: 'BDE-SRBM16', n: 1, lat: 27.80, lon: 118.10, name: '东风-16旅 (浦城)' },
    { cls: 'BDE-SRBM16', n: 1, lat: 24.30, lon: 116.10, name: '东风-16旅 (梅州)' },
    { cls: 'BDE-DF17', n: 1, lat: 30.66, lon: 117.49, name: '东风-17旅 (池州)' },
    { cls: 'BDE-DF17', n: 1, lat: 28.10, lon: 116.60, name: '东风-17旅 (抚州)' },
    { cls: 'BDE-LACM', n: 1, lat: 29.30, lon: 118.20, name: '长剑-10旅 (黄山南)' },
    { cls: 'BDE-LACM', n: 1, lat: 27.00, lon: 115.00, name: '长剑-10旅 (吉安)' },
    { cls: 'BDE-LACM', n: 1, lat: 28.90, lon: 120.00, name: '长剑-10旅 (丽水)' },
    { cls: 'BDE-ASBM', n: 1, lat: 30.20, lon: 118.90, name: '反舰弹道旅 (宣城)' },
    { cls: 'BDE-ASBM', n: 1, lat: 26.60, lon: 113.60, name: '反舰弹道旅 (衡阳)' },
    /* 陆军远程火箭炮：沿海一线，可覆盖台湾本岛西部 */
    { cls: 'BDE-PHL16', n: 1, lat: 25.45, lon: 119.68, name: '远火旅 (平潭)' },
    { cls: 'BDE-PHL16', n: 1, lat: 24.95, lon: 118.70, name: '远火旅 (泉州)' },
    { cls: 'BDE-PHL16', n: 1, lat: 26.05, lon: 119.60, name: '远火旅 (长乐)' },
    { cls: 'BDE-PHL16', n: 1, lat: 23.75, lon: 117.55, name: '远火旅 (东山)' },
    { cls: 'BDE-PHL03', n: 1, lat: 24.55, lon: 118.20, name: '火箭炮旅 (厦门)' },
    { cls: 'BDE-PHL03', n: 1, lat: 24.40, lon: 118.05, name: '火箭炮旅 (翔安)' }
  ];

  var PLA_SAM = [
    { cls: 'SAM-S400', n: 1, lat: 26.05, lon: 119.35, name: 'S-400营 (福州)' },
    { cls: 'SAM-S400', n: 1, lat: 25.45, lon: 119.60, name: 'S-400营 (平潭)' },
    { cls: 'SAM-S400', n: 1, lat: 24.50, lon: 118.15, name: 'S-400营 (厦门)' },
    { cls: 'SAM-S400', n: 1, lat: 29.90, lon: 121.60, name: 'S-400营 (宁波)' },
    { cls: 'SAM-HQ9B', n: 1, lat: 26.70, lon: 119.80, name: '红旗-9B营 (宁德)' },
    { cls: 'SAM-HQ9B', n: 1, lat: 25.05, lon: 118.75, name: '红旗-9B营 (惠安)' },
    { cls: 'SAM-HQ9B', n: 1, lat: 23.72, lon: 117.50, name: '红旗-9B营 (东山)' },
    { cls: 'SAM-HQ9B', n: 1, lat: 23.40, lon: 116.70, name: '红旗-9B营 (汕头)' },
    { cls: 'SAM-HQ9B', n: 1, lat: 28.55, lon: 121.40, name: '红旗-9B营 (台州)' },
    { cls: 'SAM-HQ9B', n: 1, lat: 27.99, lon: 120.75, name: '红旗-9B营 (温州)' },
    { cls: 'SAM-HQ9B', n: 1, lat: 24.80, lon: 118.55, name: '红旗-9B营 (晋江)' },
    { cls: 'SAM-HQ9B', n: 1, lat: 25.62, lon: 119.55, name: '红旗-9B营 (龙田)' }
  ];

  /* 解放军地面部队 (集结区 = 上船港附近) */
  var PLA_GROUND = [
    { cls: 'BDE-Amph', n: 1, lat: 24.50, lon: 118.55, name: '陆军第14两栖合成旅', echelon: 1, port: 'NB-WEITOU' },
    { cls: 'BDE-Amph', n: 1, lat: 24.55, lon: 118.45, name: '陆军第91两栖合成旅', echelon: 1, port: 'NB-WEITOU' },
    { cls: 'BDE-Amph', n: 1, lat: 23.72, lon: 117.55, name: '陆军第1两栖合成旅', echelon: 1, port: 'NB-DONGSHAN' },
    { cls: 'BDE-Amph', n: 1, lat: 23.68, lon: 117.45, name: '陆军第124两栖合成旅', echelon: 1, port: 'NB-DONGSHAN' },
    { cls: 'BDE-Marine', n: 1, lat: 25.48, lon: 119.75, name: '海军陆战队第1旅', echelon: 1, port: 'NB-PINGTAN' },
    { cls: 'BDE-Marine', n: 1, lat: 25.52, lon: 119.72, name: '海军陆战队第2旅', echelon: 1, port: 'NB-PINGTAN' },
    { cls: 'BDE-Marine', n: 1, lat: 24.45, lon: 118.10, name: '海军陆战队第3旅', echelon: 1, port: 'NB-XIAMEN' },
    { cls: 'BDE-Marine', n: 1, lat: 24.42, lon: 118.05, name: '海军陆战队第4旅', echelon: 1, port: 'NB-XIAMEN' },
    { cls: 'BDE-SOF', n: 1, lat: 25.50, lon: 119.80, name: '东部战区特战旅', echelon: 0, port: 'NB-PINGTAN' },
    { cls: 'BDE-SOF', n: 1, lat: 24.48, lon: 118.08, name: '海军陆战队蛟龙突击队', echelon: 0, port: 'NB-XIAMEN' },
    { cls: 'BDE-Airborne', n: 1, lat: 28.50, lon: 115.93, name: '空降兵第127旅', echelon: 1, air: 'AB-XIANGTANG' },
    { cls: 'BDE-Airborne', n: 1, lat: 28.48, lon: 115.90, name: '空降兵第128旅', echelon: 1, air: 'AB-XIANGTANG' },
    { cls: 'BDE-Airborne', n: 1, lat: 28.06, lon: 115.55, name: '空降兵第130旅', echelon: 2, air: 'AB-ZHANGSHU' },
    { cls: 'BDE-Heavy', n: 1, lat: 25.90, lon: 119.45, name: '陆军第73集团军重型旅A', echelon: 2, port: 'PT-FUZHOU-C' },
    { cls: 'BDE-Heavy', n: 1, lat: 25.10, lon: 119.10, name: '陆军第73集团军重型旅B', echelon: 2, port: 'PT-MEIZHOUWAN' },
    { cls: 'BDE-Heavy', n: 1, lat: 24.87, lon: 118.65, name: '陆军第72集团军重型旅A', echelon: 2, port: 'PT-QUANZHOU' },
    { cls: 'BDE-Heavy', n: 1, lat: 24.90, lon: 118.60, name: '陆军第72集团军重型旅B', echelon: 2, port: 'PT-QUANZHOU' },
    { cls: 'BDE-Heavy', n: 1, lat: 23.35, lon: 116.70, name: '陆军第74集团军重型旅', echelon: 2, port: 'NB-SHANTOU' },
    { cls: 'BDE-Heavy', n: 1, lat: 27.98, lon: 120.78, name: '陆军第71集团军重型旅', echelon: 3, port: 'NB-WENZHOU' }
  ];

  /* =====================================================================
   * 台军 地面/防空/岸基导弹
   * ===================================================================*/
  var ROC_GROUND = [
    /* 北部 第六军团 */
    { cls: 'BDE-ROC-Armor', n: 1, lat: 24.95, lon: 121.22, name: '陆军542装甲旅 (湖口)' },
    { cls: 'BDE-ROC-Mech', n: 1, lat: 25.05, lon: 121.42, name: '陆军269机步旅 (中坜)' },
    { cls: 'BDE-ROC-Inf', n: 1, lat: 25.14, lon: 121.30, name: '陆军北部守备旅 (八里—淡水)' },
    { cls: 'BDE-ROC-Inf', n: 1, lat: 25.02, lon: 121.10, name: '陆军桃园守备旅 (观音)' },
    { cls: 'BDE-ROC-Marine', n: 1, lat: 25.10, lon: 121.50, name: '海军陆战队66旅 (台北卫戍)' },
    /* 中部 第十军团 */
    { cls: 'BDE-ROC-Armor', n: 1, lat: 24.20, lon: 120.68, name: '陆军586装甲旅 (台中)' },
    { cls: 'BDE-ROC-Mech', n: 1, lat: 24.10, lon: 120.58, name: '陆军234机步旅 (彰化)' },
    { cls: 'BDE-ROC-Inf', n: 1, lat: 24.33, lon: 120.58, name: '陆军中部守备旅 (大甲—清水)' },
    { cls: 'BDE-ROC-Inf', n: 1, lat: 23.72, lon: 120.25, name: '陆军云嘉守备旅 (台西)' },
    /* 南部 第八军团 */
    { cls: 'BDE-ROC-Armor', n: 1, lat: 22.78, lon: 120.45, name: '陆军564装甲旅 (屏东)' },
    { cls: 'BDE-ROC-Mech', n: 1, lat: 22.95, lon: 120.30, name: '陆军333机步旅 (台南)' },
    { cls: 'BDE-ROC-Inf', n: 1, lat: 23.20, lon: 120.12, name: '陆军台南守备旅 (七股—将军)' },
    { cls: 'BDE-ROC-Inf', n: 1, lat: 22.45, lon: 120.50, name: '陆军屏东守备旅 (枋寮)' },
    { cls: 'BDE-ROC-Marine', n: 1, lat: 22.62, lon: 120.28, name: '海军陆战队99旅 (左营)' },
    /* 东部 花东防卫部 */
    { cls: 'BDE-ROC-Inf', n: 1, lat: 23.98, lon: 121.58, name: '陆军花莲守备旅' },
    { cls: 'BDE-ROC-Inf', n: 1, lat: 22.80, lon: 121.10, name: '陆军台东守备旅' },
    { cls: 'BN-ROC-SOF', n: 1, lat: 24.90, lon: 121.20, name: '陆军航特部特战指挥部' },
    { cls: 'BN-ROC-SOF', n: 1, lat: 22.60, lon: 120.30, name: '海军陆战队两栖侦搜大队' },
    /* 外岛 */
    { cls: 'BDE-ROC-Inf', n: 1, lat: 23.57, lon: 119.60, name: '澎湖防卫部步兵旅' },
    { cls: 'BDE-ROC-Inf', n: 1, lat: 24.44, lon: 118.36, name: '金门防卫部守备旅' },
    { cls: 'BDE-ROC-Inf', n: 1, lat: 26.16, lon: 119.95, name: '马祖防卫部守备旅' },
    /* 后备动员 (D+1 起逐批投入) */
    { cls: 'BDE-ROC-Reserve', n: 1, lat: 24.99, lon: 121.35, name: '后备第1旅 (桃园)', mobilize: 24 },
    { cls: 'BDE-ROC-Reserve', n: 1, lat: 25.03, lon: 121.52, name: '后备第2旅 (台北)', mobilize: 24 },
    { cls: 'BDE-ROC-Reserve', n: 1, lat: 24.80, lon: 120.98, name: '后备第3旅 (新竹)', mobilize: 36 },
    { cls: 'BDE-ROC-Reserve', n: 1, lat: 24.15, lon: 120.65, name: '后备第4旅 (台中)', mobilize: 36 },
    { cls: 'BDE-ROC-Reserve', n: 1, lat: 23.48, lon: 120.45, name: '后备第5旅 (嘉义)', mobilize: 48 },
    { cls: 'BDE-ROC-Reserve', n: 1, lat: 23.00, lon: 120.23, name: '后备第6旅 (台南)', mobilize: 48 },
    { cls: 'BDE-ROC-Reserve', n: 1, lat: 22.63, lon: 120.30, name: '后备第7旅 (高雄)', mobilize: 60 },
    { cls: 'BDE-ROC-Reserve', n: 1, lat: 22.68, lon: 120.49, name: '后备第8旅 (屏东)', mobilize: 72 },
    /* 炮兵 */
    { cls: 'BN-M109', n: 1, lat: 25.08, lon: 121.25, name: '21炮指部155营 (北)' },
    { cls: 'BN-M109', n: 1, lat: 24.25, lon: 120.62, name: '58炮指部155营 (中)' },
    { cls: 'BN-M109', n: 1, lat: 22.90, lon: 120.30, name: '43炮指部155营 (南)' },
    { cls: 'BN-M109', n: 1, lat: 23.55, lon: 120.30, name: '炮兵155营 (云嘉)' },
    /* HIMARS */
    { cls: 'BN-HIMARS', n: 1, lat: 24.90, lon: 121.15, name: 'HIMARS第1营 (北部机动)' },
    { cls: 'BN-HIMARS', n: 1, lat: 24.05, lon: 120.62, name: 'HIMARS第2营 (中部机动)' },
    { cls: 'BN-HIMARS', n: 1, lat: 22.90, lon: 120.40, name: 'HIMARS第3营 (南部机动)' },
    /* 岸置反舰 */
    { cls: 'BN-Harpoon-CDS', n: 1, lat: 25.18, lon: 121.42, name: '岸置鱼叉连 (淡水—八里)' },
    { cls: 'BN-Harpoon-CDS', n: 1, lat: 24.83, lon: 120.90, name: '岸置鱼叉连 (新竹)' },
    { cls: 'BN-Harpoon-CDS', n: 1, lat: 24.30, lon: 120.52, name: '岸置鱼叉连 (台中港)' },
    { cls: 'BN-Harpoon-CDS', n: 1, lat: 23.70, lon: 120.16, name: '岸置鱼叉连 (云林)' },
    { cls: 'BN-Harpoon-CDS', n: 1, lat: 23.10, lon: 120.06, name: '岸置鱼叉连 (台南)' },
    { cls: 'BN-Harpoon-CDS', n: 1, lat: 22.42, lon: 120.52, name: '岸置鱼叉连 (枋寮)' },
    { cls: 'BN-HF-Coastal', n: 1, lat: 25.15, lon: 121.75, name: '海锋大队岸置连 (基隆)' },
    { cls: 'BN-HF-Coastal', n: 1, lat: 24.60, lon: 121.87, name: '海锋大队岸置连 (苏澳)' },
    { cls: 'BN-HF-Coastal', n: 1, lat: 24.12, lon: 120.42, name: '海锋大队岸置连 (彰化)' },
    { cls: 'BN-HF-Coastal', n: 1, lat: 23.40, lon: 120.13, name: '海锋大队岸置连 (布袋)' },
    { cls: 'BN-HF-Coastal', n: 1, lat: 22.60, lon: 120.26, name: '海锋大队岸置连 (左营)' },
    { cls: 'BN-HF-Coastal', n: 1, lat: 23.57, lon: 119.58, name: '海锋大队岸置连 (澎湖)' },
    { cls: 'BN-HF3ER', n: 1, lat: 24.00, lon: 121.60, name: '增程雄三连 (花莲)' },
    { cls: 'BN-HF3ER', n: 1, lat: 22.75, lon: 121.10, name: '增程雄三连 (台东)' },
    { cls: 'BN-HF3ER', n: 1, lat: 24.95, lon: 121.10, name: '增程雄三连 (桃园山区)' },
    /* 对陆纵深打击 */
    { cls: 'BN-HF2E', n: 1, lat: 24.60, lon: 121.20, name: '雄二E营 (北部山区)' },
    { cls: 'BN-HF2E', n: 1, lat: 23.40, lon: 120.90, name: '雄二E营 (阿里山区)' },
    { cls: 'BN-YunFeng', n: 1, lat: 24.20, lon: 121.20, name: '云峰营 (中央山脉)' }
  ];

  var ROC_SAM = [
    { cls: 'SAM-PAC3', n: 1, lat: 25.11, lon: 121.48, name: '爱国者连 (南港—汐止)' },
    { cls: 'SAM-PAC3', n: 1, lat: 25.02, lon: 121.24, name: '爱国者连 (桃园)' },
    { cls: 'SAM-PAC3', n: 1, lat: 24.87, lon: 121.03, name: '爱国者连 (新竹)' },
    { cls: 'SAM-PAC3', n: 1, lat: 24.28, lon: 120.66, name: '爱国者连 (台中)' },
    { cls: 'SAM-PAC3', n: 1, lat: 23.50, lon: 120.42, name: '爱国者连 (嘉义)' },
    { cls: 'SAM-PAC3', n: 1, lat: 22.72, lon: 120.32, name: '爱国者连 (高雄)' },
    { cls: 'SAM-PAC3', n: 1, lat: 25.05, lon: 121.60, name: '爱国者连 (台北东)' },
    { cls: 'SAM-TK3', n: 1, lat: 24.51, lon: 121.09, name: '天弓三连 (乐山)' },
    { cls: 'SAM-TK3', n: 1, lat: 24.02, lon: 121.60, name: '天弓三连 (花莲)' },
    { cls: 'SAM-TK3', n: 1, lat: 22.76, lon: 121.10, name: '天弓三连 (台东)' },
    { cls: 'SAM-TK3', n: 1, lat: 23.10, lon: 120.30, name: '天弓三连 (台南)' },
    { cls: 'SAM-TK3', n: 1, lat: 24.80, lon: 120.95, name: '天弓三连 (新竹基地)' },
    { cls: 'SAM-TK3', n: 1, lat: 23.57, lon: 119.62, name: '天弓三连 (澎湖)' },
    { cls: 'SAM-TK2', n: 1, lat: 25.16, lon: 121.72, name: '天弓二连 (基隆)' },
    { cls: 'SAM-TK2', n: 1, lat: 24.62, lon: 121.86, name: '天弓二连 (苏澳)' },
    { cls: 'SAM-TK2', n: 1, lat: 24.15, lon: 120.50, name: '天弓二连 (彰化)' },
    { cls: 'SAM-TK2', n: 1, lat: 23.46, lon: 120.40, name: '天弓二连 (嘉义基地)' },
    { cls: 'SAM-TK2', n: 1, lat: 22.95, lon: 120.21, name: '天弓二连 (台南基地)' },
    { cls: 'SAM-TK2', n: 1, lat: 22.62, lon: 120.27, name: '天弓二连 (左营)' },
    { cls: 'SAM-TK2', n: 1, lat: 22.70, lon: 120.46, name: '天弓二连 (屏东)' },
    { cls: 'SAM-TK2', n: 1, lat: 25.08, lon: 121.55, name: '天弓二连 (松山)' },
    { cls: 'SAM-Land', n: 1, lat: 25.16, lon: 121.32, name: '陆剑二连 (台北港)' },
    { cls: 'SAM-Land', n: 1, lat: 25.03, lon: 121.09, name: '陆剑二连 (观音)' },
    { cls: 'SAM-Land', n: 1, lat: 24.35, lon: 120.55, name: '陆剑二连 (大甲)' },
    { cls: 'SAM-Land', n: 1, lat: 23.70, lon: 120.18, name: '陆剑二连 (台西)' },
    { cls: 'SAM-Land', n: 1, lat: 23.19, lon: 120.08, name: '陆剑二连 (将军)' },
    { cls: 'SAM-Land', n: 1, lat: 22.50, lon: 120.42, name: '陆剑二连 (林园)' },
    { cls: 'SAM-Land', n: 1, lat: 24.88, lon: 121.85, name: '陆剑二连 (头城)' },
    { cls: 'SAM-Skyguard', n: 1, lat: 24.02, lon: 121.62, name: '天兵连 (花莲基地)' },
    { cls: 'SAM-Skyguard', n: 1, lat: 22.76, lon: 121.10, name: '天兵连 (志航基地)' },
    { cls: 'SAM-Skyguard', n: 1, lat: 24.26, lon: 120.62, name: '天兵连 (清泉岗)' },
    { cls: 'SAM-Skyguard', n: 1, lat: 24.82, lon: 120.94, name: '天兵连 (新竹基地)' },
    { cls: 'SAM-Skyguard', n: 1, lat: 23.46, lon: 120.39, name: '天兵连 (嘉义基地)' },
    { cls: 'SAM-Skyguard', n: 1, lat: 22.95, lon: 120.21, name: '天兵连 (台南基地)' },
    { cls: 'SAM-Skyguard', n: 1, lat: 25.08, lon: 121.55, name: '天兵连 (松山)' },
    { cls: 'SAM-Skyguard', n: 1, lat: 23.57, lon: 119.63, name: '天兵连 (马公基地)' }
  ];

  var ROC_RADAR = [
    { cls: 'RADAR-ROC', n: 1, lat: 24.503, lon: 121.083, name: '乐山铺路爪雷达站' },
    { cls: 'RADAR-ROC-Mobile', n: 1, lat: 25.20, lon: 121.60, name: '机动战管雷达 (北)' },
    { cls: 'RADAR-ROC-Mobile', n: 1, lat: 24.10, lon: 120.90, name: '机动战管雷达 (中)' },
    { cls: 'RADAR-ROC-Mobile', n: 1, lat: 22.90, lon: 120.60, name: '机动战管雷达 (南)' },
    { cls: 'RADAR-ROC-Mobile', n: 1, lat: 23.90, lon: 121.55, name: '机动战管雷达 (东)' },
    { cls: 'RADAR-ROC-Mobile', n: 1, lat: 23.58, lon: 119.60, name: '机动战管雷达 (澎湖)' }
  ];

  var PLA_RADAR = [
    { cls: 'RADAR-PLA', n: 1, lat: 25.90, lon: 119.40, name: '福建大型相控阵雷达' },
    { cls: 'RADAR-PLA', n: 1, lat: 23.72, lon: 117.48, name: '东山对海雷达站' },
    { cls: 'RADAR-PLA', n: 1, lat: 28.55, lon: 121.42, name: '台州对空雷达站' },
    { cls: 'EW-Station', n: 1, lat: 25.48, lon: 119.74, name: '平潭电子对抗营' },
    { cls: 'EW-Station', n: 1, lat: 23.43, lon: 117.10, name: '南澳电子对抗营' },
    { cls: 'EW-Station', n: 1, lat: 24.50, lon: 118.20, name: '厦门电子对抗营' }
  ];

  /* =====================================================================
   * 美日干预兵力 (触发后分批到位)
   * ===================================================================*/
  var US_FORCES = {
    air: {
      'AB-KADENA': { 'F-35A': 36, 'F-22A': 12 },
      'AB-ANDERSEN': { 'F-35A': 24, 'B-1B': 8 },
      'AB-IWAKUNI': { 'F-35A': 16 }
    },
    naval: [
      { cls: 'CVN-Nimitz', n: 1, lat: 20.5, lon: 128.5, group: 'CSG-US1', name: '美军航母打击群(菲律宾海)' },
      { cls: 'DDG-Burke', n: 5, lat: 20.6, lon: 128.4, group: 'CSG-US1' },
      { cls: 'DDG-Burke', n: 3, lat: 26.0, lon: 129.5, group: 'SAG-US2', name: '美军水面行动群(冲绳东)' }
    ],
    subs: [
      { cls: 'SSN-Virginia', n: 5, lat: 21.5, lon: 122.5, group: 'SUB-US', name: '美军攻击核潜艇' }
    ]
  };
  var JP_FORCES = {
    air: { 'AB-NAHA': { 'F-35A': 20 } },
    naval: [{ cls: 'JMSDF-DDG', n: 4, lat: 26.5, lon: 128.5, group: 'SAG-JP', name: '日本护卫舰队' }]
  };

  /* =====================================================================
   * 弹药基数与后勤 (战役级)
   * ===================================================================*/
  var LOGISTICS = {
    PLA: {
      pgmDays: 30,            // 精确制导弹药可支撑天数
      sealiftPerDay: 12,      // 跨海投送能力(等效营/日, 港口未夺取时)
      sealiftWithPort: 34,    // 夺取大型港口后
      fuelDays: 60,
      repairAirbasePerDay: 3, // 跑道抢修能力(条/日)
      note: '弹药与航渡吨位是战役持续力上限；夺港失败则登陆部队7-10日内失去进攻能力'
    },
    ROC: {
      pgmDays: 9,             // 公开评估：精确弹药仅可支撑约1-2周高强度
      ammoDays: 14,
      fuelDays: 30,
      repairAirbasePerDay: 2,
      reserveMobDays: 5,      // 后备动员完成时间
      note: '弹药存量是台军最大结构性弱点；美对台交付延迟直接压缩可持续作战天数'
    }
  };

  TWG.OOB = {
    PLA_AIR: PLA_AIR, PLA_AIRLIFT: PLA_AIRLIFT, ROC_AIR: ROC_AIR,
    PLA_NAVAL: PLA_NAVAL, PLA_SUBS: PLA_SUBS, ROC_NAVAL: ROC_NAVAL, ROC_SUBS: ROC_SUBS,
    PLA_MISSILE: PLA_MISSILE, PLA_SAM: PLA_SAM, PLA_GROUND: PLA_GROUND, PLA_RADAR: PLA_RADAR,
    ROC_GROUND: ROC_GROUND, ROC_SAM: ROC_SAM, ROC_RADAR: ROC_RADAR,
    US_FORCES: US_FORCES, JP_FORCES: JP_FORCES, LOGISTICS: LOGISTICS
  };
})(typeof window !== 'undefined' ? window : globalThis);
