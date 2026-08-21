/* ============================================================================
 * equipment.js — 装备参数数据库 (Equipment Parameter Database)
 * ----------------------------------------------------------------------------
 * 数据基线: 公开来源综合估算 (US DoD China Military Power Report 2024,
 *   IISS Military Balance 2025, Jane's, 台湾《国防报告书》, SIPRI, CSIS,
 *   Naval News, Janes Defence Weekly 等公开报道)。
 *   部分参数(RCS、Pk、探测距离)为工程估算值，用于兵推平衡，非情报数据。
 *
 * 单位约定:
 *   距离/射程 : km          速度 : km/h        高度 : m
 *   排水量    : t (满载)     战斗半径 : km      RCS : m²
 *   pk        : 单发命中概率(理想条件, 引擎会按电抗/机动/多层拦截修正)
 * ==========================================================================*/
(function (root) {
  'use strict';
  var TWG = root.TWG = root.TWG || {};

  var KN = 1.852;                 // 1 节 = 1.852 km/h
  var kn = function (v) { return v * KN; };

  /* ======================= 武 器 =========================================*/
  var W = {};
  function defW(id, o) { o.id = id; W[id] = o; return o; }

  /* ---- 空空导弹 ---- */
  defW('PL-15', { name: '霹雳-15', cn: 'PL-15', type: 'aam', side: 'PLA', range: 200, ner: 75, spd: 4900, seeker: 'AESA主动雷达', pk: 0.52, warhead: 20, eccm: 0.75, note: '双脉冲发动机，射程超越AIM-120C' });
  defW('PL-15E', { name: '霹雳-15E', type: 'aam', side: 'PLA', range: 145, ner: 60, spd: 4900, seeker: 'ARH', pk: 0.48, warhead: 20, eccm: 0.7 });
  defW('PL-17', { name: '霹雳-17', type: 'aam', side: 'PLA', range: 400, ner: 140, spd: 5500, seeker: 'ARH+双模', pk: 0.42, warhead: 40, eccm: 0.7, note: '反预警机/加油机远程弹' });
  defW('PL-10', { name: '霹雳-10', type: 'aam', side: 'PLA', range: 25, ner: 18, spd: 3100, seeker: '红外成像', pk: 0.72, warhead: 12, eccm: 0.85, hobs: 90 });
  defW('PL-12', { name: '霹雳-12', type: 'aam', side: 'PLA', range: 90, ner: 35, spd: 4400, seeker: 'ARH', pk: 0.4, warhead: 21, eccm: 0.6 });
  defW('R-77', { name: 'R-77(RVV-AE)', type: 'aam', side: 'PLA', range: 80, ner: 30, spd: 4400, seeker: 'ARH', pk: 0.35, warhead: 22, eccm: 0.5 });
  defW('AIM-120C7', { name: 'AIM-120C-7', type: 'aam', side: 'ROC', range: 105, ner: 42, spd: 4900, seeker: 'ARH', pk: 0.5, warhead: 20, eccm: 0.78 });
  defW('AIM-120D', { name: 'AIM-120D', type: 'aam', side: 'US', range: 160, ner: 65, spd: 4900, seeker: 'ARH', pk: 0.58, warhead: 20, eccm: 0.85 });
  defW('AIM-9X', { name: 'AIM-9X Block II', type: 'aam', side: 'ROC', range: 35, ner: 20, spd: 3000, seeker: '红外成像', pk: 0.7, warhead: 9.4, eccm: 0.85, hobs: 90 });
  defW('MICA-EM', { name: 'MICA-EM', type: 'aam', side: 'ROC', range: 60, ner: 25, spd: 4400, seeker: 'ARH', pk: 0.42, warhead: 12, eccm: 0.62 });
  defW('MICA-IR', { name: 'MICA-IR', type: 'aam', side: 'ROC', range: 50, ner: 22, spd: 4400, seeker: '红外成像', pk: 0.5, warhead: 12, eccm: 0.8 });
  defW('Magic-2', { name: 'R550 Magic II', type: 'aam', side: 'ROC', range: 15, ner: 10, spd: 3100, seeker: '红外', pk: 0.45, warhead: 13, eccm: 0.6 });
  defW('TC-2', { name: '天剑二 TC-2', type: 'aam', side: 'ROC', range: 60, ner: 25, spd: 4400, seeker: 'ARH', pk: 0.42, warhead: 22, eccm: 0.6, note: '中科院自制中程弹' });
  defW('TC-1', { name: '天剑一 TC-1', type: 'aam', side: 'ROC', range: 8, ner: 6, spd: 2900, seeker: '红外', pk: 0.5, warhead: 10, eccm: 0.55 });

  /* ---- 反舰导弹 ---- */
  defW('YJ-18A', { name: '鹰击-18A', type: 'ashm', side: 'PLA', range: 540, spd: 1000, spdTerm: 3600, seeker: 'ARH+被动', pk: 0.62, warhead: 300, skim: 8, eccm: 0.72, note: '亚超结合，末端2.5-3马赫掠海' });
  defW('YJ-21', { name: '鹰击-21', type: 'ashm', side: 'PLA', range: 1500, spd: 7400, seeker: '雷达/红外复合', pk: 0.35, warhead: 500, ballistic: true, eccm: 0.8, note: '舰载高超音速反舰弹道弹' });
  defW('YJ-12', { name: '鹰击-12', type: 'ashm', side: 'PLA', range: 400, spd: 3100, seeker: 'ARH', pk: 0.55, warhead: 300, skim: 15, eccm: 0.6, note: '空射超音速反舰弹' });
  defW('YJ-83K', { name: '鹰击-83K', type: 'ashm', side: 'PLA', range: 230, spd: 1050, seeker: 'ARH', pk: 0.5, warhead: 165, skim: 6, eccm: 0.55 });
  defW('YJ-83', { name: '鹰击-83', type: 'ashm', side: 'PLA', range: 180, spd: 1050, seeker: 'ARH', pk: 0.48, warhead: 165, skim: 5, eccm: 0.55 });
  defW('YJ-62', { name: '鹰击-62', type: 'ashm', side: 'PLA', range: 400, spd: 950, seeker: 'ARH', pk: 0.45, warhead: 300, skim: 20, eccm: 0.45 });
  defW('YJ-91', { name: '鹰击-91', type: 'arm', side: 'PLA', range: 120, spd: 3400, seeker: '被动雷达导引', pk: 0.6, warhead: 165, eccm: 0.9, note: '反辐射，专打防空雷达' });
  defW('CM-401', { name: 'CM-401', type: 'ashm', side: 'PLA', range: 290, spd: 6200, seeker: '雷达', pk: 0.4, warhead: 200, ballistic: true, eccm: 0.75 });
  defW('YU-6', { name: '鱼-6 重型鱼雷', type: 'torp', side: 'PLA', range: 45, spd: 120, seeker: '线导+主被动声呐', pk: 0.65, warhead: 300, eccm: 0.7 });
  defW('YU-7', { name: '鱼-7 轻型鱼雷', type: 'torp', side: 'PLA', range: 14, spd: 83, seeker: '主动声呐', pk: 0.45, warhead: 45, eccm: 0.6 });

  defW('HF-2', { name: '雄风二型 HF-2', type: 'ashm', side: 'ROC', range: 160, spd: 1000, seeker: 'ARH+红外双模', pk: 0.5, warhead: 190, skim: 6, eccm: 0.6 });
  defW('HF-3', { name: '雄风三型 HF-3', type: 'ashm', side: 'ROC', range: 200, spd: 2600, seeker: 'ARH', pk: 0.55, warhead: 225, skim: 12, eccm: 0.62, note: '超音速掠海，增程型400km' });
  defW('HF-3ER', { name: '雄风三型增程 HF-3ER', type: 'ashm', side: 'ROC', range: 400, spd: 2600, seeker: 'ARH', pk: 0.52, warhead: 225, skim: 12, eccm: 0.62 });
  defW('HF-2E', { name: '雄风二E HF-2E', type: 'lacm', side: 'ROC', range: 650, spd: 850, seeker: 'INS/GPS+地形匹配', pk: 0.55, warhead: 450, eccm: 0.5, note: '对陆攻击巡航弹' });
  defW('YunFeng', { name: '云峰 高空高速巡航弹', type: 'lacm', side: 'ROC', range: 1200, spd: 3700, seeker: 'INS/GPS', pk: 0.4, warhead: 225, eccm: 0.7, note: '打击纵深指挥/机场节点' });
  defW('Harpoon', { name: 'RGM-84L-4 Harpoon Blk II', type: 'ashm', side: 'ROC', range: 140, spd: 860, seeker: 'ARH', pk: 0.48, warhead: 221, skim: 5, eccm: 0.6 });
  defW('SM-1', { name: 'RIM-66 SM-1MR', type: 'sam_ashm', side: 'ROC', range: 40, spd: 3100, seeker: '半主动', pk: 0.35, warhead: 62, eccm: 0.4 });
  defW('SUT', { name: 'SUT Mod.4 重型鱼雷', type: 'torp', side: 'ROC', range: 28, spd: 65, seeker: '线导', pk: 0.55, warhead: 260, eccm: 0.6 });
  defW('Mk48', { name: 'Mk-48 Mod6AT', type: 'torp', side: 'ROC', range: 50, spd: 102, seeker: '线导+主被动', pk: 0.7, warhead: 295, eccm: 0.8 });
  defW('WanChien', { name: '万剑弹 (联合遥攻)', type: 'sow', side: 'ROC', range: 240, spd: 800, seeker: 'INS/GPS+子母弹', pk: 0.6, warhead: 350, eccm: 0.5, note: '专打机场跑道/停机坪' });
  defW('AGM-84H', { name: 'AGM-84H SLAM-ER', type: 'lacm', side: 'ROC', range: 270, spd: 855, seeker: 'IIR+GPS', pk: 0.6, warhead: 360, eccm: 0.65 });
  defW('AGM-88', { name: 'AGM-88B HARM', type: 'arm', side: 'ROC', range: 106, spd: 2280, seeker: '被动雷达', pk: 0.55, warhead: 66, eccm: 0.9 });

  /* ---- 弹道导弹 / 火箭炮 ---- */
  defW('DF-11A', { name: '东风-11A (CSS-7)', type: 'srbm', side: 'PLA', range: 600, spd: 6500, cep: 100, warhead: 500, pk: 0.55, sub: '子母/整体', eccm: 0.5 });
  defW('DF-15B', { name: '东风-15B (CSS-6)', type: 'srbm', side: 'PLA', range: 800, spd: 7200, cep: 35, warhead: 600, pk: 0.7, sub: '末制导+机动弹头', eccm: 0.6 });
  defW('DF-16A', { name: '东风-16A (CSS-11)', type: 'srbm', side: 'PLA', range: 1000, spd: 8000, cep: 20, warhead: 800, pk: 0.75, sub: '穿甲/子母', eccm: 0.65 });
  defW('DF-17', { name: '东风-17 高超音速', type: 'hgv', side: 'PLA', range: 1900, spd: 9000, cep: 15, warhead: 500, pk: 0.72, sub: 'DF-ZF滑翔器', eccm: 0.88, note: '滑翔机动，极难拦截' });
  defW('DF-21C', { name: '东风-21C', type: 'mrbm', side: 'PLA', range: 1700, spd: 9500, cep: 30, warhead: 2000, pk: 0.6, eccm: 0.6 });
  defW('DF-21D', { name: '东风-21D 反舰弹道弹', type: 'asbm', side: 'PLA', range: 1550, spd: 9500, cep: 30, warhead: 600, pk: 0.3, eccm: 0.7, note: '需海上目标指示链路' });
  defW('DF-26', { name: '东风-26 "关岛快递"', type: 'irbm', side: 'PLA', range: 4000, spd: 10000, cep: 100, warhead: 1500, pk: 0.45, eccm: 0.7, asbm: true });
  defW('CJ-10A', { name: '长剑-10A 巡航弹', type: 'lacm', side: 'PLA', range: 1700, spd: 880, cep: 8, warhead: 500, pk: 0.72, eccm: 0.4, note: '低空亚音速，易被拦但量大' });
  defW('KD-20', { name: '空地-20 (空射巡航弹)', type: 'lacm', side: 'PLA', range: 1600, spd: 880, cep: 10, warhead: 500, pk: 0.7, eccm: 0.4 });
  defW('KD-63', { name: '空地-63', type: 'lacm', side: 'PLA', range: 200, spd: 700, cep: 15, warhead: 500, pk: 0.6, eccm: 0.3 });
  defW('PHL16-370', { name: 'PHL-16 370mm制导火箭', type: 'mlrs', side: 'PLA', range: 300, spd: 4200, cep: 30, warhead: 200, pk: 0.6, eccm: 0.5 });
  defW('PHL16-750', { name: '火龙-480 750mm战术弹', type: 'mlrs', side: 'PLA', range: 500, spd: 5000, cep: 20, warhead: 480, pk: 0.68, eccm: 0.55 });
  defW('PHL03-300', { name: 'PHL-03 300mm火箭', type: 'mlrs', side: 'PLA', range: 130, spd: 3800, cep: 200, warhead: 200, pk: 0.35, eccm: 0.4 });
  defW('ATACMS', { name: 'MGM-140 ATACMS', type: 'srbm', side: 'ROC', range: 300, spd: 3700, cep: 10, warhead: 230, pk: 0.7, eccm: 0.6 });
  defW('GMLRS-ER', { name: 'M31A2 GMLRS-ER', type: 'mlrs', side: 'ROC', range: 84, spd: 2900, cep: 5, warhead: 90, pk: 0.65, eccm: 0.6 });
  defW('M109-155', { name: '155mm榴弹(M109A6)', type: 'arty', side: 'ROC', range: 30, spd: 2500, cep: 60, warhead: 43, pk: 0.4 });
  defW('PLZ05-155', { name: '155mm榴弹(PLZ-05)', type: 'arty', side: 'PLA', range: 53, spd: 2900, cep: 50, warhead: 45, pk: 0.42 });
  defW('LoiterAlt', { name: 'Altius-600M 巡飞弹', type: 'loiter', side: 'ROC', range: 440, spd: 190, endur: 4, warhead: 15, pk: 0.6, eccm: 0.5 });
  defW('CH-901', { name: 'CH-901 巡飞弹', type: 'loiter', side: 'PLA', range: 200, spd: 150, endur: 2, warhead: 10, pk: 0.55, eccm: 0.4 });
  defW('WS-43', { name: 'WS-43 巡飞弹', type: 'loiter', side: 'PLA', range: 60, spd: 200, endur: 0.5, warhead: 20, pk: 0.5 });
  defW('LS-6', { name: '雷石-6 滑翔制导炸弹', type: 'sow', side: 'PLA', range: 60, spd: 850, cep: 5, warhead: 250, pk: 0.72, eccm: 0.4, note: '低成本对地精确打击主力，压制守军机动与集结' });
  defW('AKD-10', { name: '空地-10 反坦克导弹', type: 'sow', side: 'PLA', range: 10, spd: 1100, cep: 1, warhead: 10, pk: 0.78, eccm: 0.5 });
  defW('AGM-114', { name: 'AGM-114 地狱火', type: 'sow', side: 'ROC', range: 8, spd: 1600, cep: 1, warhead: 9, pk: 0.8, eccm: 0.6 });

  /* ---- 防空导弹 ---- */
  defW('HHQ-9B', { name: '海红旗-9B', type: 'sam', side: 'PLA', range: 200, rangeMin: 6, altMax: 30000, spd: 5000, pk: 0.68, seeker: '主动/半主动', warhead: 180, abm: 0.35, eccm: 0.75 });
  defW('HHQ-16B', { name: '海红旗-16B', type: 'sam', side: 'PLA', range: 70, rangeMin: 3, altMax: 25000, spd: 3600, pk: 0.62, warhead: 70, abm: 0.2, eccm: 0.65 });
  defW('HHQ-10', { name: '海红旗-10 近防', type: 'sam', side: 'PLA', range: 9, altMax: 6000, spd: 2400, pk: 0.7, warhead: 12, eccm: 0.7, ciws: true });
  defW('Type1130', { name: 'H/PJ-11 11管30mm近防炮', type: 'ciws', side: 'PLA', range: 3.5, spd: 4000, pk: 0.55, rof: 10000, eccm: 0.6 });
  defW('HQ-9B', { name: '红旗-9B (陆基)', type: 'sam', side: 'PLA', range: 250, rangeMin: 7, altMax: 30000, spd: 5000, pk: 0.7, abm: 0.4, eccm: 0.78 });
  defW('HQ-22', { name: '红旗-22', type: 'sam', side: 'PLA', range: 150, altMax: 27000, spd: 4300, pk: 0.62, abm: 0.25, eccm: 0.6 });
  defW('HQ-16A', { name: '红旗-16A', type: 'sam', side: 'PLA', range: 70, altMax: 20000, spd: 3600, pk: 0.6, eccm: 0.6 });
  defW('HQ-17A', { name: '红旗-17A 野战近防', type: 'sam', side: 'PLA', range: 15, altMax: 10000, spd: 3000, pk: 0.68, eccm: 0.62 });
  defW('S-400', { name: 'S-400 (48N6E3/40N6)', type: 'sam', side: 'PLA', range: 380, altMax: 30000, spd: 6100, pk: 0.68, abm: 0.35, eccm: 0.72 });
  defW('PGZ-95', { name: 'PGZ-95 弹炮合一', type: 'ciws', side: 'PLA', range: 4, spd: 3400, pk: 0.4, rof: 4200 });

  defW('PAC3-MSE', { name: 'MIM-104F PAC-3 MSE', type: 'sam', side: 'ROC', range: 120, altMax: 36000, spd: 5800, pk: 0.65, abm: 0.72, eccm: 0.85, note: '主要反弹道，单发对TBM Pk约0.7，双发齐射' });
  defW('PAC2-GEM', { name: 'MIM-104E PAC-2/GEM-T', type: 'sam', side: 'ROC', range: 160, altMax: 24000, spd: 5300, pk: 0.68, abm: 0.5, eccm: 0.78 });
  defW('TK-3', { name: '天弓三型 TK-3', type: 'sam', side: 'ROC', range: 200, altMax: 45000, spd: 5500, pk: 0.62, abm: 0.6, eccm: 0.7, note: '中科院自研反导型' });
  defW('TK-2', { name: '天弓二型 TK-2', type: 'sam', side: 'ROC', range: 150, altMax: 30000, spd: 4600, pk: 0.6, abm: 0.25, eccm: 0.6 });
  defW('TK-1', { name: '天弓一型 TK-1', type: 'sam', side: 'ROC', range: 70, altMax: 20000, spd: 4000, pk: 0.55, eccm: 0.5 });
  defW('SM-2', { name: 'RIM-66M SM-2 Blk IIIA', type: 'sam', side: 'ROC', range: 167, altMax: 24000, spd: 4300, pk: 0.6, abm: 0.15, eccm: 0.7 });
  defW('SeaOryx', { name: '海剑羚 近程防空', type: 'sam', side: 'ROC', range: 9, altMax: 5000, spd: 2200, pk: 0.62, eccm: 0.6, ciws: true });
  defW('LandSword2', { name: '陆剑二 (TC-2N)', type: 'sam', side: 'ROC', range: 30, altMax: 12000, spd: 4400, pk: 0.6, eccm: 0.6 });
  defW('Phalanx', { name: 'Mk-15 Phalanx Blk1B', type: 'ciws', side: 'ROC', range: 2.2, spd: 3600, pk: 0.45, rof: 4500 });
  defW('Stinger', { name: 'FIM-92 Stinger', type: 'sam', side: 'ROC', range: 8, altMax: 3800, spd: 2500, pk: 0.5, eccm: 0.55 });
  defW('Skyguard', { name: '35mm 天兵防砲系统', type: 'ciws', side: 'ROC', range: 4, spd: 3400, pk: 0.35, rof: 1100 });
  defW('NASAMS', { name: 'NASAMS(AMRAAM-ER)', type: 'sam', side: 'ROC', range: 50, altMax: 16000, spd: 4900, pk: 0.62, eccm: 0.8 });

  /* ======================= 平 台 =========================================*/
  var P = {};
  function defP(id, o) { o.id = id; P[id] = o; return o; }

  /* --------------------------- 解放军 空中 --------------------------------*/
  defP('J-20A', {
    name: '歼-20A 威龙', cls: '五代隐身重型制空战斗机', side: 'PLA', domain: 'air', role: 'fighter', gen: 5,
    crew: 1, spd: 1000, spdMax: 2100, ceiling: 18000, radius: 1200, rcs: 0.05,
    radar: { name: 'KLJ-5 AESA', range: 230, tracks: 24 }, irst: 1, eodas: 1,
    ew: { jam: 0.55, rwr: 0.95 }, skill: 0.78, hp: 22,
    load: { 'PL-15': 4, 'PL-10': 2 }, sorties: 1.4, turn: 3.5, unitCost: 1.1
  });
  defP('J-16', {
    name: '歼-16', cls: '四代半双座多用途战斗机', side: 'PLA', domain: 'air', role: 'multirole', gen: 4.5,
    crew: 2, spd: 950, spdMax: 2100, ceiling: 17000, radius: 1500, rcs: 6,
    radar: { name: '有源相控阵', range: 200, tracks: 20 }, irst: 1,
    ew: { jam: 0.5, rwr: 0.85 }, skill: 0.72, hp: 26,
    load: { 'PL-15': 4, 'PL-10': 2, 'YJ-83K': 2, 'LS-6': 4 }, sorties: 1.6, turn: 3, unitCost: 0.55
  });
  defP('J-16D', {
    name: '歼-16D 电子战型', cls: '专用电子攻击机', side: 'PLA', domain: 'air', role: 'ew', gen: 4.5,
    crew: 2, spd: 900, spdMax: 1900, ceiling: 16000, radius: 1400, rcs: 7,
    radar: { name: 'AESA+电子侦察', range: 180, tracks: 12 }, esm: 450,
    ew: { jam: 0.95, rwr: 1, standoffJam: 1 }, skill: 0.74, hp: 24,
    load: { 'YJ-91': 4, 'PL-15': 2 }, sorties: 1.2, turn: 4, unitCost: 0.6
  });
  defP('J-10C', {
    name: '歼-10C', cls: '四代半中型多用途战斗机', side: 'PLA', domain: 'air', role: 'multirole', gen: 4.5,
    crew: 1, spd: 950, spdMax: 2000, ceiling: 18000, radius: 850, rcs: 3,
    radar: { name: 'AESA', range: 170, tracks: 15 }, irst: 1,
    ew: { jam: 0.45, rwr: 0.85 }, skill: 0.7, hp: 18,
    load: { 'PL-15': 4, 'PL-10': 2, 'LS-6': 2 }, sorties: 1.8, turn: 2.5, unitCost: 0.4
  });
  defP('J-11B', {
    name: '歼-11B', cls: '四代重型制空战斗机', side: 'PLA', domain: 'air', role: 'fighter', gen: 4,
    crew: 1, spd: 950, spdMax: 2100, ceiling: 18000, radius: 1500, rcs: 10,
    radar: { name: '机扫脉冲多普勒', range: 150, tracks: 8 }, irst: 1,
    ew: { jam: 0.3, rwr: 0.7 }, skill: 0.66, hp: 25,
    load: { 'PL-12': 4, 'PL-10': 2 }, sorties: 1.4, turn: 3, unitCost: 0.35
  });
  defP('Su-35S', {
    name: '苏-35S', cls: '四代半超机动重型战斗机', side: 'PLA', domain: 'air', role: 'fighter', gen: 4.5,
    crew: 1, spd: 950, spdMax: 2400, ceiling: 18000, radius: 1600, rcs: 8,
    radar: { name: 'Irbis-E', range: 250, tracks: 8 }, irst: 1,
    ew: { jam: 0.55, rwr: 0.8 }, skill: 0.72, hp: 27,
    load: { 'R-77': 6, 'PL-10': 2 }, sorties: 1.3, turn: 3.5, unitCost: 0.7
  });
  defP('Su-30MKK', {
    name: '苏-30MKK', cls: '四代双座多用途战斗机', side: 'PLA', domain: 'air', role: 'multirole', gen: 4,
    crew: 2, spd: 930, spdMax: 2100, ceiling: 17000, radius: 1500, rcs: 12,
    radar: { name: 'N001VE', range: 140, tracks: 4 },
    ew: { jam: 0.3, rwr: 0.65 }, skill: 0.66, hp: 26,
    load: { 'R-77': 4, 'YJ-83K': 2 }, sorties: 1.2, turn: 3.5, unitCost: 0.35
  });
  defP('JH-7A', {
    name: '歼轰-7A 飞豹', cls: '双座战斗轰炸机', side: 'PLA', domain: 'air', role: 'strike', gen: 3.5,
    crew: 2, spd: 900, spdMax: 1800, ceiling: 15000, radius: 1650, rcs: 14,
    radar: { name: 'JL-10A', range: 100, tracks: 4 },
    ew: { jam: 0.25, rwr: 0.6 }, skill: 0.62, hp: 22,
    load: { 'YJ-83K': 4, 'YJ-91': 2, 'LS-6': 6 }, sorties: 1.2, turn: 4, unitCost: 0.2
  });
  defP('J-15', {
    name: '歼-15 飞鲨', cls: '舰载重型战斗机', side: 'PLA', domain: 'air', role: 'multirole', gen: 4, carrier: 1,
    crew: 1, spd: 950, spdMax: 2100, ceiling: 18000, radius: 1000, rcs: 10,
    radar: { name: 'AESA(改)', range: 170, tracks: 12 }, irst: 1,
    ew: { jam: 0.4, rwr: 0.8 }, skill: 0.68, hp: 25,
    load: { 'PL-15': 4, 'PL-10': 2, 'YJ-83K': 2 }, sorties: 1.1, turn: 4, unitCost: 0.5
  });
  defP('J-35', {
    name: '歼-35 (舰载隐身)', cls: '五代舰载隐身战斗机', side: 'PLA', domain: 'air', role: 'fighter', gen: 5, carrier: 1,
    crew: 1, spd: 980, spdMax: 1900, ceiling: 17500, radius: 1000, rcs: 0.08,
    radar: { name: 'AESA', range: 200, tracks: 20 }, irst: 1,
    ew: { jam: 0.55, rwr: 0.95 }, skill: 0.74, hp: 20,
    load: { 'PL-15': 4, 'PL-10': 2 }, sorties: 1.2, turn: 4, unitCost: 0.9
  });
  defP('H-6K', {
    name: '轰-6K 战神', cls: '远程巡航导弹载机', side: 'PLA', domain: 'air', role: 'bomber',
    crew: 4, spd: 780, spdMax: 990, ceiling: 12000, radius: 3500, rcs: 60,
    radar: { name: '对海搜索雷达', range: 300, tracks: 6 },
    ew: { jam: 0.35, rwr: 0.6 }, skill: 0.66, hp: 55,
    load: { 'KD-20': 6 }, sorties: 0.5, turn: 12, unitCost: 0.6
  });
  defP('H-6J', {
    name: '轰-6J', cls: '海航反舰轰炸机', side: 'PLA', domain: 'air', role: 'bomber',
    crew: 4, spd: 780, spdMax: 990, ceiling: 12000, radius: 3000, rcs: 60,
    radar: { name: '对海雷达', range: 320, tracks: 8 },
    ew: { jam: 0.35, rwr: 0.6 }, skill: 0.68, hp: 55,
    load: { 'YJ-12': 6 }, sorties: 0.5, turn: 12, unitCost: 0.6
  });
  defP('KJ-500A', {
    name: '空警-500A', cls: '预警指挥机', side: 'PLA', domain: 'air', role: 'aew',
    crew: 12, spd: 550, spdMax: 660, ceiling: 10000, radius: 2000, endur: 11, rcs: 90,
    radar: { name: '三面有源相控阵', range: 470, tracks: 100, aew: 1 }, esm: 600,
    ew: { rwr: 0.9 }, skill: 0.8, hp: 40, c2: 0.9,
    load: {}, sorties: 0.4, turn: 10, unitCost: 2.5
  });
  defP('KJ-2000', {
    name: '空警-2000', cls: '大型预警机', side: 'PLA', domain: 'air', role: 'aew',
    crew: 15, spd: 600, spdMax: 780, ceiling: 11000, radius: 2500, endur: 8, rcs: 120,
    radar: { name: '圆盘相控阵', range: 500, tracks: 120, aew: 1 }, esm: 650,
    ew: { rwr: 0.9 }, skill: 0.8, hp: 50, c2: 0.95, load: {}, sorties: 0.35, turn: 12, unitCost: 3.5
  });
  defP('Y-8Q', {
    name: '运-8Q 高新6号', cls: '反潜巡逻机', side: 'PLA', domain: 'air', role: 'asw',
    crew: 10, spd: 500, spdMax: 660, ceiling: 8000, radius: 1800, endur: 10, rcs: 80,
    radar: { name: '对海搜索', range: 250, tracks: 20 }, sonobuoy: 1, mad: 1,
    skill: 0.7, hp: 35, load: { 'YU-7': 6 }, sorties: 0.4, turn: 10, unitCost: 1.2
  });
  defP('Y-9JB', {
    name: '运-9JB 高新8号', cls: '电子情报侦察机', side: 'PLA', domain: 'air', role: 'elint',
    crew: 12, spd: 500, ceiling: 9000, radius: 2000, endur: 10, rcs: 80,
    esm: 700, ew: { jam: 0.5 }, skill: 0.72, hp: 35, load: {}, sorties: 0.4, turn: 10, unitCost: 1.1
  });
  defP('WZ-7', {
    name: '无侦-7 翔龙', cls: '高空长航时侦察无人机', side: 'PLA', domain: 'air', role: 'isr', uav: 1,
    crew: 0, spd: 620, ceiling: 20000, radius: 2400, endur: 10, rcs: 1.5,
    radar: { name: '合成孔径雷达', range: 300, tracks: 40 }, esm: 450,
    skill: 0.7, hp: 12, load: {}, sorties: 0.5, turn: 8, unitCost: 0.3
  });
  defP('GJ-2', {
    name: '攻击-2 (翼龙II)', cls: '察打一体无人机', side: 'PLA', domain: 'air', role: 'ucav', uav: 1,
    crew: 0, spd: 280, ceiling: 9000, radius: 1500, endur: 20, rcs: 0.8,
    radar: { name: '光电/SAR', range: 120, tracks: 8 },
    skill: 0.62, hp: 8, load: { 'CH-901': 6, 'LS-6': 2 }, sorties: 0.7, turn: 6, unitCost: 0.05
  });
  defP('GJ-11', {
    name: '攻击-11 利剑', cls: '隐身攻击无人机', side: 'PLA', domain: 'air', role: 'ucav', uav: 1,
    crew: 0, spd: 900, ceiling: 12000, radius: 1200, endur: 6, rcs: 0.03,
    radar: { name: '光电/被动', range: 90, tracks: 6 },
    skill: 0.66, hp: 10, load: { 'KD-63': 2, 'LS-6': 4 }, sorties: 0.8, turn: 5, unitCost: 0.25
  });
  defP('Y-20A', {
    name: '运-20A 鲲鹏', cls: '大型战略运输机', side: 'PLA', domain: 'air', role: 'transport',
    crew: 5, spd: 750, ceiling: 13000, radius: 4500, rcs: 100, lift: 66, para: 300,
    skill: 0.7, hp: 60, load: {}, sorties: 0.6, turn: 8, unitCost: 1.5
  });
  defP('Y-9', {
    name: '运-9', cls: '中型战术运输机', side: 'PLA', domain: 'air', role: 'transport',
    crew: 4, spd: 550, ceiling: 10000, radius: 2200, rcs: 70, lift: 20, para: 98,
    skill: 0.68, hp: 35, load: {}, sorties: 0.9, turn: 5, unitCost: 0.3
  });
  defP('Z-20', {
    name: '直-20', cls: '通用战术直升机', side: 'PLA', domain: 'air', role: 'helo', helo: 1,
    crew: 4, spd: 250, ceiling: 6000, radius: 450, rcs: 15, lift: 4, para: 12,
    skill: 0.68, hp: 14, load: {}, sorties: 2, turn: 2, unitCost: 0.1
  });
  defP('Z-10ME', {
    name: '直-10ME', cls: '专用武装直升机', side: 'PLA', domain: 'air', role: 'attack_helo', helo: 1,
    crew: 2, spd: 250, spdMax: 300, ceiling: 6400, radius: 400, rcs: 8,
    radar: { name: '毫米波/光电', range: 20, tracks: 8 },
    skill: 0.68, hp: 12, load: { 'WS-43': 8, 'AKD-10': 8 }, sorties: 2.5, turn: 1.5, unitCost: 0.15
  });
  defP('Z-8L', {
    name: '直-8L', cls: '重型运输直升机', side: 'PLA', domain: 'air', role: 'helo', helo: 1,
    crew: 4, spd: 240, ceiling: 4700, radius: 400, rcs: 20, lift: 5, para: 30,
    skill: 0.65, hp: 18, load: {}, sorties: 1.6, turn: 2.5, unitCost: 0.12
  });

  /* --------------------------- 解放军 海上 --------------------------------*/
  defP('CV-Fujian', {
    name: '003型 福建舰', cls: '弹射型航空母舰', side: 'PLA', domain: 'surface', role: 'cv',
    disp: 80000, len: 316, spd: kn(30), crew: 3000, rcs: 55000, hp: 900,
    radar: { name: '双波段有源相控阵', range: 420, tracks: 200, aew: 0 }, esm: 550,
    sonar: { range: 25 }, ew: { jam: 0.7, decoy: 0.7 },
    airWing: { 'J-35': 24, 'J-15': 16, 'KJ-600': 4, 'Z-20': 6 },
    vls: 0, sam: { 'HHQ-10': 24 }, ciws: { 'Type1130': 3 }, unitCost: 90
  });
  defP('CV-Shandong', {
    name: '002型 山东舰', cls: '滑跃型航空母舰', side: 'PLA', domain: 'surface', role: 'cv',
    disp: 70000, len: 315, spd: kn(31), crew: 2800, rcs: 50000, hp: 820,
    radar: { name: '346A相控阵', range: 380, tracks: 150 }, esm: 500,
    sonar: { range: 20 }, ew: { jam: 0.6, decoy: 0.65 },
    airWing: { 'J-15': 32, 'Z-20': 6, 'Z-8L': 6 },
    sam: { 'HHQ-10': 24 }, ciws: { 'Type1130': 3 }, unitCost: 70
  });
  defP('CV-Liaoning', {
    name: '001型 辽宁舰', cls: '滑跃型航空母舰', side: 'PLA', domain: 'surface', role: 'cv',
    disp: 66000, len: 305, spd: kn(31), crew: 2600, rcs: 48000, hp: 780,
    radar: { name: '346相控阵', range: 350, tracks: 140 }, esm: 480,
    sonar: { range: 20 }, ew: { jam: 0.55, decoy: 0.6 },
    airWing: { 'J-15': 24, 'Z-20': 6, 'Z-8L': 6 },
    sam: { 'HHQ-10': 24 }, ciws: { 'Type1130': 3 }, unitCost: 60
  });
  defP('DDG-055', {
    name: '055型 大型驱逐舰(刃海级)', cls: '万吨级防空/反舰多用途驱逐舰', side: 'PLA', domain: 'surface', role: 'ddg',
    disp: 13000, len: 180, spd: kn(30), crew: 320, rcs: 9000, hp: 260,
    radar: { name: '346B双波段AESA', range: 400, tracks: 120, abmCue: 1 }, esm: 520,
    sonar: { range: 35, towed: 1 }, ew: { jam: 0.72, decoy: 0.72 },
    vlsTotal: 112, cells: { 'HHQ-9B': 48, 'YJ-18A': 32, 'YJ-21': 8, 'YU-7': 16, 'CJ-10A': 8 },
    ciws: { 'HHQ-10': 24, 'Type1130': 1 }, helo: { 'Z-20': 2 }, unitCost: 12
  });
  defP('DDG-052D', {
    name: '052D/DL型 驱逐舰(旅洋III)', cls: '中华神盾防空驱逐舰', side: 'PLA', domain: 'surface', role: 'ddg',
    disp: 7500, len: 157, spd: kn(30), crew: 280, rcs: 6000, hp: 175,
    radar: { name: '346A AESA', range: 320, tracks: 100 }, esm: 480,
    sonar: { range: 30, towed: 1 }, ew: { jam: 0.65, decoy: 0.68 },
    vlsTotal: 64, cells: { 'HHQ-9B': 32, 'YJ-18A': 24, 'YU-7': 8 },
    ciws: { 'HHQ-10': 24, 'Type1130': 1 }, helo: { 'Z-20': 1 }, unitCost: 8
  });
  defP('DDG-052C', {
    name: '052C型 驱逐舰', cls: '早期相控阵防空驱逐舰', side: 'PLA', domain: 'surface', role: 'ddg',
    disp: 7000, len: 155, spd: kn(29), crew: 280, rcs: 5800, hp: 165,
    radar: { name: '346 AESA', range: 280, tracks: 80 }, esm: 420,
    sonar: { range: 25 }, ew: { jam: 0.55, decoy: 0.6 },
    vlsTotal: 48, cells: { 'HHQ-9B': 48 }, launcher: { 'YJ-62': 8 },
    ciws: { 'Type1130': 2 }, helo: { 'Z-20': 1 }, unitCost: 6
  });
  defP('DDG-051C', {
    name: '051C型 驱逐舰', cls: 'S-300F区域防空驱逐舰', side: 'PLA', domain: 'surface', role: 'ddg',
    disp: 7100, len: 155, spd: kn(29), crew: 300, rcs: 6200, hp: 160,
    radar: { name: '顶板+墓碑', range: 250, tracks: 40 }, esm: 350,
    ew: { jam: 0.45, decoy: 0.5 }, launcher: { 'HHQ-9B': 48, 'YJ-83': 8 },
    ciws: { 'Type1130': 2 }, unitCost: 5
  });
  defP('FFG-054A', {
    name: '054A型 护卫舰(江凯II)', cls: '通用护卫舰', side: 'PLA', domain: 'surface', role: 'ffg',
    disp: 4050, len: 134, spd: kn(27), crew: 190, rcs: 3500, hp: 105,
    radar: { name: '382三坐标+364', range: 200, tracks: 40 }, esm: 380,
    sonar: { range: 28, towed: 1 }, ew: { jam: 0.5, decoy: 0.6 },
    vlsTotal: 32, cells: { 'HHQ-16B': 24, 'YU-7': 8 }, launcher: { 'YJ-83K': 8 },
    ciws: { 'Type1130': 2 }, helo: { 'Z-20': 1 }, unitCost: 4
  });
  defP('FFG-054B', {
    name: '054B型 护卫舰', cls: '新一代隐身护卫舰', side: 'PLA', domain: 'surface', role: 'ffg',
    disp: 6000, len: 147, spd: kn(28), crew: 165, rcs: 1800, hp: 140,
    radar: { name: '综合射频AESA', range: 260, tracks: 70 }, esm: 450,
    sonar: { range: 34, towed: 1 }, ew: { jam: 0.6, decoy: 0.68 },
    vlsTotal: 32, cells: { 'HHQ-16B': 24, 'YJ-18A': 8 },
    ciws: { 'HHQ-10': 24, 'Type1130': 1 }, helo: { 'Z-20': 1 }, unitCost: 5
  });
  defP('FFL-056A', {
    name: '056A型 轻护卫舰(江岛级)', cls: '近海反潜护卫舰', side: 'PLA', domain: 'surface', role: 'corvette',
    disp: 1500, len: 89, spd: kn(28), crew: 78, rcs: 1200, hp: 45,
    radar: { name: '364雷达', range: 120, tracks: 16 }, esm: 220,
    sonar: { range: 22, towed: 1 }, ew: { jam: 0.35, decoy: 0.45 },
    launcher: { 'YJ-83': 4, 'HHQ-10': 8, 'YU-7': 6 }, unitCost: 1.2
  });
  defP('PGG-022', {
    name: '022型 导弹艇(红稗级)', cls: '隐身穿浪双体导弹艇', side: 'PLA', domain: 'surface', role: 'fac',
    disp: 220, len: 42.6, spd: kn(38), crew: 12, rcs: 250, hp: 12,
    radar: { name: '对海雷达', range: 60, tracks: 8 }, esm: 120,
    ew: { jam: 0.15, decoy: 0.25 }, launcher: { 'YJ-83': 8 }, unitCost: 0.15
  });
  defP('LHA-076', {
    name: '076型 四川舰', cls: '电磁弹射两栖攻击舰(无人机母舰)', side: 'PLA', domain: 'surface', role: 'lha',
    disp: 45000, len: 260, spd: kn(24), crew: 1200, rcs: 30000, hp: 480,
    radar: { name: '双波段AESA', range: 320, tracks: 100 }, esm: 480,
    ew: { jam: 0.6, decoy: 0.6 },
    airWing: { 'GJ-11': 20, 'Z-20': 12, 'Z-8L': 8 },
    lift: { bn: 1.5, aav: 20, troops: 1200 },
    sam: { 'HHQ-10': 24 }, ciws: { 'Type1130': 2 }, unitCost: 45
  });
  defP('LHD-075', {
    name: '075型 两栖攻击舰(海南级)', cls: '直通甲板两栖攻击舰', side: 'PLA', domain: 'surface', role: 'lhd',
    disp: 40000, len: 237, spd: kn(23), crew: 1100, rcs: 28000, hp: 430,
    radar: { name: '346A简化型', range: 260, tracks: 60 }, esm: 400,
    ew: { jam: 0.5, decoy: 0.55 },
    airWing: { 'Z-20': 14, 'Z-8L': 10, 'Z-10ME': 6 },
    lift: { bn: 2, aav: 30, troops: 1600, lcac: 3 },
    sam: { 'HHQ-10': 24 }, ciws: { 'Type1130': 2 }, unitCost: 40
  });
  defP('LPD-071', {
    name: '071型 船坞登陆舰(玉昭级)', cls: '综合登陆舰', side: 'PLA', domain: 'surface', role: 'lpd',
    disp: 25000, len: 210, spd: kn(22), crew: 700, rcs: 18000, hp: 280,
    radar: { name: '对海/对空搜索', range: 180, tracks: 30 }, esm: 300,
    ew: { jam: 0.35, decoy: 0.45 },
    airWing: { 'Z-8L': 4 },
    lift: { bn: 1.5, aav: 20, troops: 800, lcac: 4, veh: 60 },
    ciws: { 'Type1130': 4 }, unitCost: 15
  });
  defP('LST-072A', {
    name: '072A型 坦克登陆舰(玉亭II)', cls: '坦克登陆舰', side: 'PLA', domain: 'surface', role: 'lst',
    disp: 5000, len: 120, spd: kn(18), crew: 120, rcs: 4200, hp: 90,
    radar: { name: '导航/对海', range: 90, tracks: 8 },
    ew: { jam: 0.15, decoy: 0.25 },
    lift: { bn: 0.6, tank: 10, troops: 250, veh: 20 },
    ciws: { 'PGZ-95': 2 }, unitCost: 1.5
  });
  defP('LSM-073A', {
    name: '073A型 中型登陆舰', cls: '中型登陆舰', side: 'PLA', domain: 'surface', role: 'lsm',
    disp: 2000, len: 87, spd: kn(17), crew: 70, rcs: 2000, hp: 45,
    lift: { bn: 0.3, tank: 6, troops: 180 }, ew: { decoy: 0.15 }, unitCost: 0.6
  });
  defP('Shuiqiao', {
    name: '"水桥"特种登陆驳船(T-LPT)', cls: '自升式栈桥登陆驳船', side: 'PLA', domain: 'surface', role: 'barge',
    disp: 22000, len: 185, spd: kn(12), crew: 60, rcs: 12000, hp: 120,
    lift: { bn: 1.2, tank: 30, troops: 800, veh: 120, causeway: 1 },
    ew: { decoy: 0.1 }, unitCost: 2,
    note: '2025年新型自升式登陆栈桥，可直接向岸卸载重装，但极脆弱'
  });
  defP('RoRo-Civ', {
    name: '民船动员滚装船(渤海系列)', cls: '国防动员滚装运输船', side: 'PLA', domain: 'surface', role: 'sealift',
    disp: 36000, len: 180, spd: kn(20), crew: 90, rcs: 16000, hp: 130,
    lift: { bn: 2.5, tank: 40, troops: 2000, veh: 300 }, ew: { decoy: 0.05 }, unitCost: 1,
    note: '需港口或栈桥卸载，无自卫能力'
  });
  defP('SS-039C', {
    name: '039C型 常规潜艇(元级改)', cls: 'AIP静音攻击潜艇', side: 'PLA', domain: 'sub', role: 'ssk',
    disp: 3600, len: 77, spd: kn(20), spdSilent: kn(6), depth: 300, crew: 65, rcs: 0, acoustic: 0.28,
    sonar: { range: 60, passive: 90 }, esm: 150,
    load: { 'YU-6': 12, 'YJ-18A': 6 }, endur: 30, hp: 60, unitCost: 3
  });
  defP('SS-039B', {
    name: '039B型 常规潜艇(元级)', cls: 'AIP攻击潜艇', side: 'PLA', domain: 'sub', role: 'ssk',
    disp: 3600, len: 77, spd: kn(20), spdSilent: kn(6), depth: 300, crew: 65, acoustic: 0.35,
    sonar: { range: 55, passive: 80 }, load: { 'YU-6': 14, 'YJ-83': 4 }, endur: 30, hp: 58, unitCost: 2.5
  });
  defP('SS-Kilo', {
    name: '基洛级 636M', cls: '常规攻击潜艇', side: 'PLA', domain: 'sub', role: 'ssk',
    disp: 3100, len: 74, spd: kn(19), spdSilent: kn(5), depth: 300, crew: 52, acoustic: 0.3,
    sonar: { range: 50, passive: 75 }, load: { 'YU-6': 18 }, endur: 25, hp: 52, unitCost: 2
  });
  defP('SSN-093B', {
    name: '093B型 攻击核潜艇(商级改)', cls: '巡航导弹核潜艇', side: 'PLA', domain: 'sub', role: 'ssn',
    disp: 7000, len: 110, spd: kn(30), spdSilent: kn(12), depth: 400, crew: 100, acoustic: 0.5,
    sonar: { range: 75, passive: 110 }, esm: 180,
    load: { 'YU-6': 16, 'YJ-18A': 12, 'CJ-10A': 8 }, endur: 70, hp: 110, unitCost: 15
  });
  defP('CCG-Zhaotou', {
    name: '海警2901 昭头级', cls: '万吨级海警巡逻船', side: 'PLA', domain: 'surface', role: 'ccg',
    disp: 12000, len: 165, spd: kn(25), crew: 120, rcs: 9000, hp: 150,
    radar: { name: '航海/搜索雷达', range: 110, tracks: 20 },
    launcher: {}, gun: '76mm', ew: { decoy: 0.1 }, unitCost: 2,
    note: '灰色地带行动主力，可执行登检/拦截/封锁'
  });
  defP('Militia-Boat', {
    name: '海上民兵渔船队', cls: '武装渔船/民兵船队', side: 'PLA', domain: 'surface', role: 'militia',
    disp: 500, len: 55, spd: kn(12), crew: 25, rcs: 400, hp: 14,
    lift: { bn: 0.15, troops: 120 }, unitCost: 0.02
  });

  /* --------------------------- 解放军 陆上/火箭军 --------------------------*/
  defP('BDE-Amph', {
    name: '两栖合成旅', cls: '陆军两栖合成旅', side: 'PLA', domain: 'ground', role: 'amph_bde',
    troops: 5000, cp: 100, aav: 120, tank: 30, arty: 36, sam: 'HQ-17A', mobility: 0.75,
    kit: 'ZBD-05/ZTD-05两栖战车、PLZ-07B自行炮、Type-15轻坦', unitCost: 1
  });
  defP('BDE-Marine', {
    name: '海军陆战旅', cls: '海军陆战队合成旅', side: 'PLA', domain: 'ground', role: 'marine_bde',
    troops: 4500, cp: 105, aav: 100, tank: 24, arty: 30, sam: 'HQ-17A', mobility: 0.8,
    kit: 'ZBD-05、05式两栖突击车、轻型高机动车族', unitCost: 1
  });
  defP('BDE-Airborne', {
    name: '空降兵旅', cls: '空降合成旅', side: 'PLA', domain: 'ground', role: 'airborne_bde',
    troops: 4000, cp: 78, aav: 30, tank: 0, arty: 18, mobility: 0.6,
    kit: 'ZBD-03空降战车、车载122火箭炮、便携防空', airlift: 1, unitCost: 0.8
  });
  defP('BDE-Heavy', {
    name: '重型合成旅', cls: '陆军重型合成旅', side: 'PLA', domain: 'ground', role: 'heavy_bde',
    troops: 5500, cp: 130, tank: 84, arty: 54, sam: 'HQ-17A', mobility: 0.7,
    kit: 'ZTZ-99A主战坦克、ZBD-04A、PLZ-05 155自行炮', unitCost: 1.4
  });
  defP('BDE-SOF', {
    name: '特战旅', cls: '特种作战旅', side: 'PLA', domain: 'ground', role: 'sof',
    troops: 2000, cp: 55, mobility: 0.9, kit: '直升机/伞降/舟波渗透，斩首与要点夺控', unitCost: 0.6
  });
  defP('BEACHHEAD', {
    name: '登陆场 (上陸集群)', cls: '滩头登陆集群', side: 'PLA', domain: 'ground', role: 'beachhead',
    troops: 0, cp: 0, mobility: 0.4, hp: 420, rcs: 400,
    kit: '已上陸的两栖装备、火炮与后勤节点集群', unitCost: 0
  });
  defP('BDE-PHL16', {
    name: 'PHL-16 远火旅', cls: '陆军远程火箭炮旅', side: 'PLA', domain: 'ground', role: 'mlrs_bde',
    troops: 1200, launchers: 36, cp: 20, mobility: 0.65,
    load: { 'PHL16-370': 288, 'PHL16-750': 72 }, rangeMax: 500, reload: 0.4,
    kit: 'PCH-191箱式火箭炮，370mm/750mm两种口径', unitCost: 0.9
  });
  defP('BDE-PHL03', {
    name: 'PHL-03 火箭炮旅', cls: '300mm远程火箭炮旅', side: 'PLA', domain: 'ground', role: 'mlrs_bde',
    troops: 1100, launchers: 36, cp: 16, mobility: 0.6,
    load: { 'PHL03-300': 432 }, rangeMax: 130, reload: 0.5, unitCost: 0.5
  });
  defP('BDE-SRBM', {
    name: '火箭军短程弹道导弹旅', cls: '常规导弹旅(SRBM)', side: 'PLA', domain: 'ground', role: 'srbm_bde',
    troops: 1500, launchers: 24, cp: 8, mobility: 0.5,
    load: { 'DF-15B': 96, 'DF-11A': 72 }, reload: 1.5, camo: 0.75, unitCost: 1.2
  });
  defP('BDE-SRBM16', {
    name: '火箭军东风-16旅', cls: '常规导弹旅(DF-16A)', side: 'PLA', domain: 'ground', role: 'srbm_bde',
    troops: 1600, launchers: 18, cp: 8, mobility: 0.5,
    load: { 'DF-16A': 54 }, reload: 2, camo: 0.75, unitCost: 1.6
  });
  defP('BDE-DF17', {
    name: '火箭军东风-17旅', cls: '高超音速导弹旅', side: 'PLA', domain: 'ground', role: 'hgv_bde',
    troops: 1500, launchers: 18, cp: 8, mobility: 0.5,
    load: { 'DF-17': 36 }, reload: 3, camo: 0.8, unitCost: 3
  });
  defP('BDE-LACM', {
    name: '火箭军长剑-10旅', cls: '对陆巡航导弹旅', side: 'PLA', domain: 'ground', role: 'lacm_bde',
    troops: 1400, launchers: 18, cp: 8, mobility: 0.55,
    load: { 'CJ-10A': 108 }, reload: 1.2, camo: 0.78, unitCost: 1.4
  });
  defP('BDE-ASBM', {
    name: '火箭军反舰弹道导弹旅', cls: 'DF-21D/DF-26 反介入旅', side: 'PLA', domain: 'ground', role: 'asbm_bde',
    troops: 1800, launchers: 18, cp: 8, mobility: 0.45,
    load: { 'DF-21D': 36, 'DF-26': 24 }, reload: 3, camo: 0.8, unitCost: 4
  });
  defP('SAM-HQ9B', {
    name: '红旗-9B 防空营', cls: '远程防空导弹营', side: 'PLA', domain: 'sam', role: 'sam_bn',
    troops: 400, launchers: 8, cp: 6, mobility: 0.5,
    radar: { name: 'HT-233相控阵', range: 300, tracks: 100 },
    load: { 'HQ-9B': 64 }, reload: 0.8, unitCost: 1.5
  });
  defP('SAM-S400', {
    name: 'S-400 防空营', cls: '超远程防空导弹营', side: 'PLA', domain: 'sam', role: 'sam_bn',
    troops: 450, launchers: 8, cp: 6, mobility: 0.45,
    radar: { name: '92N6E', range: 400, tracks: 100 },
    load: { 'S-400': 64 }, reload: 0.8, unitCost: 2.5
  });
  defP('RADAR-PLA', {
    name: '战略预警雷达站', cls: '远程对空/反导预警雷达', side: 'PLA', domain: 'radar', role: 'radar',
    radar: { name: '大型相控阵', range: 550, tracks: 300 }, hp: 20, cp: 2
  });
  defP('EW-Station', {
    name: '电子对抗营', cls: '战役级电子干扰阵地', side: 'PLA', domain: 'radar', role: 'ew',
    ew: { jam: 0.85, radius: 250 }, hp: 14, cp: 2
  });

  /* --------------------------- 台军 空中 ----------------------------------*/
  defP('F-16V', {
    name: 'F-16AM/BM Block 20 (F-16V)', cls: '性能提升型多用途战斗机', side: 'ROC', domain: 'air', role: 'multirole', gen: 4.5,
    crew: 1, spd: 950, spdMax: 2100, ceiling: 15000, radius: 850, rcs: 4,
    radar: { name: 'AN/APG-83 SABR AESA', range: 170, tracks: 20 },
    ew: { jam: 0.5, rwr: 0.9 }, skill: 0.8, hp: 18,
    load: { 'AIM-120C7': 4, 'AIM-9X': 2, 'Harpoon': 2, 'WanChien': 2, 'AGM-88': 2 },
    sorties: 2.2, turn: 2, unitCost: 0.5, note: '141架升级，台空军主力' 
  });
  defP('F-16C70', {
    name: 'F-16C/D Block 70', cls: '新造四代半战斗机', side: 'ROC', domain: 'air', role: 'multirole', gen: 4.5,
    crew: 1, spd: 950, spdMax: 2100, ceiling: 15200, radius: 1000, rcs: 3.5,
    radar: { name: 'AN/APG-83 AESA', range: 180, tracks: 20 },
    ew: { jam: 0.58, rwr: 0.92 }, skill: 0.78, hp: 19,
    load: { 'AIM-120C7': 6, 'AIM-9X': 2, 'AGM-84H': 2 }, sorties: 2.2, turn: 2, unitCost: 0.7,
    note: '66架采购，2024年起交付'
  });
  defP('Mirage-2000', {
    name: '幻象2000-5Ei/Di', cls: '截击型战斗机', side: 'ROC', domain: 'air', role: 'interceptor', gen: 4,
    crew: 1, spd: 950, spdMax: 2500, ceiling: 17000, radius: 700, rcs: 5,
    radar: { name: 'RDY', range: 140, tracks: 8 },
    ew: { jam: 0.4, rwr: 0.8 }, skill: 0.76, hp: 15,
    load: { 'MICA-EM': 4, 'MICA-IR': 2 }, sorties: 1.3, turn: 4, unitCost: 0.4,
    note: '妥善率偏低、维护成本高，主责北部高速截击'
  });
  defP('IDF', {
    name: 'F-CK-1C/D 经国号', cls: '自制轻型战斗机', side: 'ROC', domain: 'air', role: 'multirole', gen: 4,
    crew: 1, spd: 900, spdMax: 1900, ceiling: 16800, radius: 550, rcs: 3,
    radar: { name: 'GD-53改', range: 110, tracks: 10 },
    ew: { jam: 0.4, rwr: 0.82 }, skill: 0.76, hp: 14,
    load: { 'TC-2': 4, 'TC-1': 2, 'WanChien': 2, 'HF-2': 2 }, sorties: 2.4, turn: 1.8, unitCost: 0.25
  });
  defP('E-2K', {
    name: 'E-2K 鹰眼2000', cls: '空中预警机', side: 'ROC', domain: 'air', role: 'aew',
    crew: 5, spd: 480, ceiling: 9000, radius: 1500, endur: 6, rcs: 60,
    radar: { name: 'AN/APS-145', range: 450, tracks: 2000, aew: 1 }, esm: 500,
    ew: { rwr: 0.85 }, skill: 0.82, hp: 25, c2: 0.85, load: {}, sorties: 0.5, turn: 8, unitCost: 2,
    note: '仅6架，为PL-17/远程弹优先猎杀目标'
  });
  defP('P-3C', {
    name: 'P-3C 猎户座', cls: '反潜巡逻机', side: 'ROC', domain: 'air', role: 'asw',
    crew: 11, spd: 460, ceiling: 8600, radius: 2400, endur: 12, rcs: 70,
    radar: { name: 'AN/APS-137', range: 250, tracks: 30 }, sonobuoy: 1, mad: 1,
    skill: 0.78, hp: 30, load: { 'Mk48': 4, 'Harpoon': 4 }, sorties: 0.4, turn: 10, unitCost: 1
  });
  defP('AH-64E', {
    name: 'AH-64E 阿帕契', cls: '重型攻击直升机', side: 'ROC', domain: 'air', role: 'attack_helo', helo: 1,
    crew: 2, spd: 265, ceiling: 6400, radius: 480, rcs: 7,
    radar: { name: 'AN/APG-78 长弓', range: 12, tracks: 128 },
    skill: 0.78, hp: 13, load: { 'Stinger': 2, 'AGM-114': 16 }, atgm: 16, sorties: 2.2, turn: 1.5, unitCost: 0.3,
    note: '29架，反登陆滩头打击核心'
  });
  defP('AH-1W', {
    name: 'AH-1W 超级眼镜蛇', cls: '攻击直升机', side: 'ROC', domain: 'air', role: 'attack_helo', helo: 1,
    crew: 2, spd: 250, ceiling: 3700, radius: 300, rcs: 6,
    skill: 0.74, hp: 10, atgm: 8, load: { 'AGM-114': 8 }, sorties: 2, turn: 1.5, unitCost: 0.1
  });
  defP('UAV-Teng', {
    name: '腾云二型 无人机', cls: '中高空长航时侦察无人机', side: 'ROC', domain: 'air', role: 'isr', uav: 1,
    crew: 0, spd: 300, ceiling: 8000, radius: 900, endur: 16, rcs: 1.2,
    radar: { name: '光电/SAR', range: 150, tracks: 20 }, skill: 0.7, hp: 8, load: {}, sorties: 0.6, turn: 6, unitCost: 0.1
  });
  defP('UAV-Albat', {
    name: '锐鸢II 战术无人机', cls: '战术侦察无人机', side: 'ROC', domain: 'air', role: 'isr', uav: 1,
    crew: 0, spd: 180, ceiling: 5000, radius: 300, endur: 10, rcs: 0.6,
    radar: { name: '光电吊舱', range: 60, tracks: 6 }, skill: 0.66, hp: 5, load: {}, sorties: 1.2, turn: 3, unitCost: 0.02
  });

  /* --------------------------- 台军 海上 ----------------------------------*/
  defP('DDG-KeeLung', {
    name: '基隆级 (纪德级) 驱逐舰', cls: '区域防空驱逐舰', side: 'ROC', domain: 'surface', role: 'ddg',
    disp: 9800, len: 172, spd: kn(30), crew: 360, rcs: 7500, hp: 195,
    radar: { name: 'AN/SPS-48E', range: 300, tracks: 60 }, esm: 420,
    sonar: { range: 28 }, ew: { jam: 0.5, decoy: 0.6 },
    launcher: { 'SM-2': 52, 'Harpoon': 8, 'Mk48': 6 },
    ciws: { 'Phalanx': 2 }, helo: { 'S-70C': 2 }, unitCost: 3,
    note: '4艘，台海军唯一区域防空舰，舰龄超40年'
  });
  defP('FFG-ChengKung', {
    name: '成功级 (派里级) 巡防舰', cls: '通用巡防舰', side: 'ROC', domain: 'surface', role: 'ffg',
    disp: 4100, len: 138, spd: kn(29), crew: 210, rcs: 3600, hp: 100,
    radar: { name: 'AN/SPS-49', range: 250, tracks: 20 }, esm: 350,
    sonar: { range: 26, towed: 1 }, ew: { jam: 0.4, decoy: 0.55 },
    launcher: { 'SM-1': 32, 'HF-2': 4, 'HF-3': 4, 'Mk48': 6 },
    ciws: { 'Phalanx': 1 }, helo: { 'S-70C': 2 }, unitCost: 1.5
  });
  defP('FFG-KangDing', {
    name: '康定级 (拉法叶级) 巡防舰', cls: '隐身巡防舰', side: 'ROC', domain: 'surface', role: 'ffg',
    disp: 3600, len: 125, spd: kn(25), crew: 160, rcs: 1400, hp: 92,
    radar: { name: 'DRBV-26D改', range: 200, tracks: 18 }, esm: 340,
    sonar: { range: 24, towed: 1 }, ew: { jam: 0.45, decoy: 0.6 },
    launcher: { 'HF-2': 8, 'HF-3': 4, 'LandSword2': 16, 'Mk48': 6 },
    ciws: { 'Phalanx': 1 }, helo: { 'S-70C': 1 }, unitCost: 1.6
  });
  defP('PGG-TuoChiang', {
    name: '沱江级 飞弹巡逻舰', cls: '高速隐身双体飞弹舰', side: 'ROC', domain: 'surface', role: 'corvette',
    disp: 685, len: 65, spd: kn(43), crew: 41, rcs: 320, hp: 26,
    radar: { name: '相控阵/CS-MMR', range: 100, tracks: 20 }, esm: 200,
    ew: { jam: 0.3, decoy: 0.45 },
    launcher: { 'HF-2': 8, 'HF-3': 8, 'SeaOryx': 12 }, unitCost: 0.9,
    note: '"航母杀手"，高航速+隐身+16枚反舰弹'
  });
  defP('PGG-KuangHua6', {
    name: '光华六号 飞弹快艇', cls: '近岸导弹快艇', side: 'ROC', domain: 'surface', role: 'fac',
    disp: 186, len: 34.2, spd: kn(30), crew: 19, rcs: 200, hp: 10,
    radar: { name: '航海雷达', range: 45, tracks: 6 },
    ew: { decoy: 0.2 }, launcher: { 'HF-2': 4 }, unitCost: 0.1
  });
  defP('PC-ChingChiang', {
    name: '锦江级 巡逻舰', cls: '近海巡逻舰', side: 'ROC', domain: 'surface', role: 'patrol',
    disp: 680, len: 61, spd: kn(25), crew: 50, rcs: 500, hp: 22,
    radar: { name: '航海/搜索', range: 60, tracks: 8 }, launcher: { 'HF-2': 4 }, unitCost: 0.15
  });
  defP('SS-HaiKun', {
    name: '海鲲级 SS-711', cls: '自制柴电攻击潜艇', side: 'ROC', domain: 'sub', role: 'ssk',
    disp: 2500, len: 70, spd: kn(20), spdSilent: kn(5), depth: 300, crew: 60, acoustic: 0.32,
    sonar: { range: 55, passive: 85 }, load: { 'Mk48': 18 }, endur: 25, hp: 48, unitCost: 1.7,
    note: '国造潜艇原型舰，2025年海测/交艇阶段'
  });
  defP('SS-HaiLung', {
    name: '海龙级 (剑龙级)', cls: '柴电攻击潜艇', side: 'ROC', domain: 'sub', role: 'ssk',
    disp: 2660, len: 66, spd: kn(20), spdSilent: kn(5), depth: 240, crew: 67, acoustic: 0.4,
    sonar: { range: 45, passive: 70 }, load: { 'SUT': 20, 'Harpoon': 4 }, endur: 20, hp: 44, unitCost: 0.6,
    note: '1980年代荷制，2艘，仍是唯一可用作战潜艇'
  });
  defP('MineLayer-Min', {
    name: '敏捷级 快速布雷艇', cls: '快速布雷艇', side: 'ROC', domain: 'surface', role: 'minelayer',
    disp: 347, len: 41, spd: kn(14), crew: 41, rcs: 300, hp: 12,
    mines: 20, unitCost: 0.08, note: '战时封锁登陆航道核心装备'
  });
  defP('LPD-YuShan', {
    name: '玉山级 船坞运输舰', cls: '两栖船坞运输舰', side: 'ROC', domain: 'surface', role: 'lpd',
    disp: 10600, len: 153, spd: kn(21.5), crew: 190, rcs: 7000, hp: 130,
    radar: { name: '搜索雷达', range: 120, tracks: 16 },
    launcher: { 'SeaOryx': 12 }, ciws: { 'Phalanx': 1 }, lift: { bn: 0.7, troops: 673 }, unitCost: 1.2
  });

  /* --------------------------- 台军 陆上/防空 ------------------------------*/
  defP('BDE-ROC-Armor', {
    name: '装甲旅', cls: '陆军装甲旅', side: 'ROC', domain: 'ground', role: 'armor_bde',
    troops: 3600, cp: 105, tank: 100, arty: 24, mobility: 0.7,
    kit: 'M1A2T/CM-11勇虎、CM-32云豹、M109A6', unitCost: 1.1
  });
  defP('BDE-ROC-Mech', {
    name: '机械化步兵旅', cls: '陆军机步旅', side: 'ROC', domain: 'ground', role: 'mech_bde',
    troops: 3800, cp: 88, tank: 40, arty: 24, mobility: 0.68,
    kit: 'CM-32/CM-34云豹装步战车、拖式2B、标枪', unitCost: 0.8
  });
  defP('BDE-ROC-Inf', {
    name: '守备旅', cls: '陆军地区守备旅', side: 'ROC', domain: 'ground', role: 'inf_bde',
    troops: 3000, cp: 62, arty: 18, mobility: 0.45, fortify: 1.4,
    kit: '红隼火箭弹、标枪、拖式2B、迫击炮、工事化阵地', unitCost: 0.4
  });
  defP('BDE-ROC-Marine', {
    name: '海军陆战旅', cls: '海军陆战队旅', side: 'ROC', domain: 'ground', role: 'marine_bde',
    troops: 4000, cp: 80, tank: 20, arty: 24, mobility: 0.62,
    kit: 'AAV-7两栖突击车、拖式、迫砲', unitCost: 0.7
  });
  defP('BDE-ROC-Reserve', {
    name: '后备旅 (动员)', cls: '后备动员步兵旅', side: 'ROC', domain: 'ground', role: 'reserve_bde',
    troops: 3200, cp: 32, mobility: 0.35, fortify: 1.3,
    kit: 'T91步枪、红隼、66火箭弹，训练与装备水平有限', unitCost: 0.15
  });
  defP('BN-ROC-SOF', {
    name: '特种作战部队', cls: '陆军航特部/两栖侦搜', side: 'ROC', domain: 'ground', role: 'sof',
    troops: 1500, cp: 45, mobility: 0.85, kit: '滨海侦搜、纵深破袭、要点固守', unitCost: 0.4
  });
  defP('BN-HIMARS', {
    name: 'M142 HIMARS 营', cls: '高机动火箭炮营', side: 'ROC', domain: 'ground', role: 'mlrs_bn',
    troops: 400, launchers: 11, cp: 12, mobility: 0.9,
    load: { 'GMLRS-ER': 132, 'ATACMS': 44 }, reload: 0.3, camo: 0.8,
    kit: '打了就跑，反登陆/反机场首选', unitCost: 0.6
  });
  defP('BN-Harpoon-CDS', {
    name: '岸置鱼叉飞弹连', cls: '岸基反舰导弹连(HCDS)', side: 'ROC', domain: 'ground', role: 'ashm_bn',
    troops: 220, launchers: 8, cp: 8, mobility: 0.85,
    load: { 'Harpoon': 32 }, reload: 0.5, camo: 0.82, unitCost: 0.5
  });
  defP('BN-HF-Coastal', {
    name: '岸置雄风飞弹连', cls: '岸基反舰导弹连(雄二/雄三)', side: 'ROC', domain: 'ground', role: 'ashm_bn',
    troops: 240, launchers: 8, cp: 8, mobility: 0.8,
    load: { 'HF-2': 24, 'HF-3': 24 }, reload: 0.5, camo: 0.8, unitCost: 0.5
  });
  defP('BN-HF3ER', {
    name: '增程雄三机动连', cls: '增程型岸基超音速反舰连', side: 'ROC', domain: 'ground', role: 'ashm_bn',
    troops: 240, launchers: 6, cp: 8, mobility: 0.8,
    load: { 'HF-3ER': 24 }, reload: 0.6, camo: 0.82, unitCost: 0.7
  });
  defP('BN-HF2E', {
    name: '雄二E 巡航导弹营', cls: '对陆纵深打击营', side: 'ROC', domain: 'ground', role: 'lacm_bn',
    troops: 350, launchers: 8, cp: 8, mobility: 0.7,
    load: { 'HF-2E': 32 }, reload: 1, camo: 0.85, unitCost: 1
  });
  defP('BN-YunFeng', {
    name: '云峰导弹营', cls: '远程高速对陆打击营', side: 'ROC', domain: 'ground', role: 'lacm_bn',
    troops: 320, launchers: 6, cp: 8, mobility: 0.6,
    load: { 'YunFeng': 18 }, reload: 1.5, camo: 0.88, unitCost: 1.5
  });
  defP('BN-M109', {
    name: '155mm 自行炮营', cls: '野战炮兵营', side: 'ROC', domain: 'ground', role: 'arty_bn',
    troops: 500, launchers: 18, cp: 14, mobility: 0.6,
    load: { 'M109-155': 900 }, reload: 0.15, unitCost: 0.3
  });
  defP('SAM-PAC3', {
    name: '爱国者三型 飞弹连', cls: 'PAC-3 MSE 反导连', side: 'ROC', domain: 'sam', role: 'sam_bn',
    troops: 200, launchers: 6, cp: 6, mobility: 0.35,
    radar: { name: 'AN/MPQ-65', range: 180, tracks: 100, abmCue: 1 },
    load: { 'PAC3-MSE': 72, 'PAC2-GEM': 24 }, reload: 0.8, unitCost: 2.5
  });
  defP('SAM-TK3', {
    name: '天弓三型 飞弹连', cls: '国造中远程反导连', side: 'ROC', domain: 'sam', role: 'sam_bn',
    troops: 190, launchers: 6, cp: 6, mobility: 0.4,
    radar: { name: '长白相控阵', range: 250, tracks: 100, abmCue: 1 },
    load: { 'TK-3': 72, 'TK-2': 24 }, reload: 0.8, unitCost: 1.6
  });
  defP('SAM-TK2', {
    name: '天弓二型 飞弹连', cls: '国造中程防空连', side: 'ROC', domain: 'sam', role: 'sam_bn',
    troops: 180, launchers: 6, cp: 5, mobility: 0.4,
    radar: { name: '长白雷达', range: 200, tracks: 60 },
    load: { 'TK-2': 60 }, reload: 0.8, unitCost: 1
  });
  defP('SAM-Land', {
    name: '陆基防空连 (陆剑二/复仇者)', cls: '野战近程防空连', side: 'ROC', domain: 'sam', role: 'sam_bn',
    troops: 150, launchers: 8, cp: 4, mobility: 0.75,
    radar: { name: '蜂眼相列雷达', range: 60, tracks: 40 },
    load: { 'LandSword2': 48, 'Stinger': 60 }, reload: 0.4, unitCost: 0.4
  });
  defP('SAM-Skyguard', {
    name: '天兵防砲连', cls: '35mm防砲/短程防空连', side: 'ROC', domain: 'sam', role: 'aaa_bn',
    troops: 130, launchers: 8, cp: 3, mobility: 0.55,
    radar: { name: '天兵射控雷达', range: 20, tracks: 12 },
    load: { 'Skyguard': 9999, 'TK-1': 24 }, reload: 0.2, unitCost: 0.2
  });
  defP('RADAR-ROC', {
    name: '长程预警雷达站 (乐山)', cls: 'AN/FPS-115 铺路爪相控阵', side: 'ROC', domain: 'radar', role: 'radar',
    radar: { name: 'PAVE PAWS', range: 2000, tracks: 1000, abmCue: 1 }, hp: 26, cp: 3,
    note: '乐山基地，对大陆纵深弹道导弹发射6分钟预警'
  });
  defP('RADAR-ROC-Mobile', {
    name: '机动战管雷达', cls: '机动三坐标警戒雷达', side: 'ROC', domain: 'radar', role: 'radar',
    radar: { name: 'GE-592/机动雷达', range: 320, tracks: 200 }, hp: 12, cp: 2, mobility: 0.7
  });

  /* --------------------------- 美日干预兵力 ------------------------------*/
  defP('F-35A', {
    name: 'F-35A 闪电II', cls: '五代隐身多用途战斗机', side: 'US', domain: 'air', role: 'multirole', gen: 5,
    crew: 1, spd: 900, spdMax: 1930, ceiling: 15000, radius: 1200, rcs: 0.005,
    radar: { name: 'AN/APG-81 AESA', range: 200, tracks: 30 }, irst: 1, eodas: 1,
    ew: { jam: 0.8, rwr: 1 }, skill: 0.86, hp: 18,
    load: { 'AIM-120D': 4, 'AIM-9X': 2 }, sorties: 1.4, turn: 3, unitCost: 0.9
  });
  defP('F-22A', {
    name: 'F-22A 猛禽', cls: '五代隐身制空战斗机', side: 'US', domain: 'air', role: 'fighter', gen: 5,
    crew: 1, spd: 1050, spdMax: 2410, ceiling: 19800, radius: 850, rcs: 0.0001,
    radar: { name: 'AN/APG-77', range: 240, tracks: 30 },
    ew: { jam: 0.75, rwr: 1 }, skill: 0.9, hp: 20,
    load: { 'AIM-120D': 6, 'AIM-9X': 2 }, sorties: 1.3, turn: 3.5, unitCost: 1.5
  });
  defP('B-1B', {
    name: 'B-1B 枪骑兵', cls: '超音速战略轰炸机', side: 'US', domain: 'air', role: 'bomber',
    crew: 4, spd: 900, spdMax: 1450, ceiling: 15000, radius: 5500, rcs: 12,
    radar: { name: 'AN/APQ-164', range: 250, tracks: 20 },
    ew: { jam: 0.6, rwr: 0.85 }, skill: 0.85, hp: 60,
    load: { 'LRASM': 24 }, sorties: 0.3, turn: 24, unitCost: 3
  });
  defW('LRASM', { name: 'AGM-158C LRASM', type: 'ashm', side: 'US', range: 560, spd: 900, seeker: '被动RF+IIR自主', pk: 0.72, warhead: 450, skim: 5, eccm: 0.9, lowObs: 1 });
  defW('JASSM-ER', { name: 'AGM-158B JASSM-ER', type: 'lacm', side: 'US', range: 900, spd: 900, seeker: 'IIR+GPS', pk: 0.78, warhead: 450, eccm: 0.88, lowObs: 1 });
  defW('Tomahawk', { name: 'BGM-109 战斧 Blk V', type: 'lacm', side: 'US', range: 1600, spd: 880, seeker: 'GPS/DSMAC', pk: 0.75, warhead: 450, eccm: 0.5 });
  defW('SM-6', { name: 'RIM-174 SM-6 Blk IA', type: 'sam', side: 'US', range: 370, altMax: 34000, spd: 4300, pk: 0.7, abm: 0.5, eccm: 0.88 });
  defW('Mk48Mod7', { name: 'Mk-48 Mod7 CBASS', type: 'torp', side: 'US', range: 50, spd: 102, seeker: '线导+主被动', pk: 0.78, warhead: 295, eccm: 0.9 });
  defP('CVN-Nimitz', {
    name: '尼米兹级 核动力航母', cls: '核动力航空母舰', side: 'US', domain: 'surface', role: 'cv',
    disp: 104000, len: 333, spd: kn(31), crew: 5000, rcs: 60000, hp: 1100,
    radar: { name: 'AN/SPY-1D(V)编队', range: 400, tracks: 300 }, esm: 600,
    ew: { jam: 0.8, decoy: 0.8 },
    airWing: { 'F-35C': 20, 'F/A-18E': 24, 'E-2D': 5, 'EA-18G': 6 },
    ciws: { 'Phalanx': 3 }, unitCost: 130
  });
  defP('DDG-Burke', {
    name: '阿利·伯克级 Flight IIA/III', cls: '宙斯盾驱逐舰', side: 'US', domain: 'surface', role: 'ddg',
    disp: 9700, len: 155, spd: kn(30), crew: 320, rcs: 6500, hp: 210,
    radar: { name: 'AN/SPY-1D/SPY-6', range: 400, tracks: 200, abmCue: 1 }, esm: 550,
    sonar: { range: 40, towed: 1 }, ew: { jam: 0.78, decoy: 0.8 },
    vlsTotal: 96, cells: { 'SM-6': 32, 'SM-2': 24, 'Tomahawk': 24, 'Mk48': 16 },
    ciws: { 'Phalanx': 1 }, helo: { 'MH-60R': 2 }, unitCost: 20
  });
  defP('SSN-Virginia', {
    name: '弗吉尼亚级 攻击核潜艇', cls: '攻击核潜艇', side: 'US', domain: 'sub', role: 'ssn',
    disp: 7900, len: 115, spd: kn(32), spdSilent: kn(20), depth: 490, crew: 132, acoustic: 0.12,
    sonar: { range: 110, passive: 180 }, esm: 250,
    load: { 'Mk48Mod7': 26, 'Tomahawk': 12 }, endur: 90, hp: 120, unitCost: 35,
    note: '静音性远超解放军反潜能力，是战役最大变量之一'
  });
  defP('JMSDF-DDG', {
    name: '日本 摩耶级/爱宕级 DDG', cls: '宙斯盾驱逐舰', side: 'JP', domain: 'surface', role: 'ddg',
    disp: 10250, len: 170, spd: kn(30), crew: 300, rcs: 6800, hp: 205,
    radar: { name: 'AN/SPY-1D(V)', range: 380, tracks: 180, abmCue: 1 }, esm: 500,
    sonar: { range: 38, towed: 1 }, ew: { jam: 0.7, decoy: 0.75 },
    vlsTotal: 96, cells: { 'SM-6': 24, 'SM-2': 32, 'Mk48': 16 },
    ciws: { 'Phalanx': 2 }, unitCost: 18
  });

  /* ====================== 派生/工具 =====================================*/
  // 舰船 HP 若未给出按排水量估算
  Object.keys(P).forEach(function (k) {
    var p = P[k];
    if (p.hp == null) {
      if (p.disp) p.hp = Math.round(Math.pow(p.disp, 0.62) / 2.2);
      else p.hp = 20;
    }
    if (p.rcs == null) p.rcs = p.disp ? p.disp * 0.7 : 5;
    // 汇总全部武器挂载 (cells/launcher/load/sam/ciws)
    p.allWeapons = {};
    ['load', 'cells', 'launcher', 'sam', 'ciws'].forEach(function (grp) {
      if (p[grp]) Object.keys(p[grp]).forEach(function (w) {
        if (W[w]) p.allWeapons[w] = (p.allWeapons[w] || 0) + p[grp][w];
      });
    });
  });

  TWG.WEAPONS = W;
  TWG.PLATFORMS = P;
  TWG.KN = KN;
  TWG.toKn = function (kmh) { return kmh / KN; };

  /* ====================== 外形尺寸表 (用于二维矢量与三维建模) ============
   * 机长/翼展 = 真实数据 (m)；舰船取 P.len 与按舰型估算的舰宽
   * ==================================================================*/
  var AC_DIM = {
    'J-20A': [21.2, 13.0], 'J-16': [21.9, 14.7], 'J-16D': [21.9, 14.7], 'J-10C': [16.4, 9.75],
    'J-11B': [21.9, 14.7], 'Su-35S': [21.9, 15.3], 'Su-30MKK': [21.9, 14.7], 'JH-7A': [22.3, 12.7],
    'J-15': [22.3, 14.7], 'J-35': [17.5, 11.5], 'H-6K': [34.8, 33.0], 'H-6J': [34.8, 33.0],
    'KJ-500A': [34.0, 38.0], 'KJ-2000': [46.6, 50.5], 'Y-8Q': [34.0, 38.0], 'Y-9JB': [36.0, 38.0],
    'WZ-7': [14.3, 24.9], 'GJ-2': [11.0, 20.5], 'GJ-11': [12.3, 14.0], 'Y-20A': [47.0, 50.0],
    'Y-9': [36.0, 38.0], 'Z-20': [19.8, 16.4], 'Z-10ME': [14.2, 12.0], 'Z-8L': [23.0, 18.9],
    'F-16V': [15.0, 9.96], 'F-16C70': [15.0, 10.0], 'Mirage-2000': [14.4, 9.13], 'IDF': [14.2, 8.53],
    'E-2K': [17.6, 24.6], 'P-3C': [35.6, 30.4], 'AH-64E': [17.7, 14.6], 'AH-1W': [17.7, 14.6],
    'UAV-Teng': [14.0, 18.0], 'UAV-Albat': [6.2, 8.7],
    'F-35A': [15.7, 10.7], 'F-22A': [18.9, 13.6], 'B-1B': [44.5, 41.8]
  };
  TWG.AC_DIM = AC_DIM;
  TWG.platformLen = function (cls) {
    var p = P[cls]; if (!p) return 18;
    if (p.len) return p.len;
    if (AC_DIM[cls]) return AC_DIM[cls][0];
    if (p.domain === 'air') return 18;
    if (p.domain === 'ground') return 8;
    if (p.domain === 'sam') return 14;
    if (p.domain === 'radar') return 14;
    return 60;
  };
  TWG.platformSpan = function (cls) {
    var p = P[cls]; if (!p) return 11;
    if (AC_DIM[cls]) return AC_DIM[cls][1];
    if (p.domain === 'surface' || p.domain === 'sub') {
      var L = TWG.platformLen(cls);
      return L * (p.role === 'cv' ? 0.24 : p.role === 'barge' ? 0.26 : p.role === 'sealift' ? 0.17
        : p.domain === 'sub' ? 0.13 : 0.14);
    }
    if (p.domain === 'air') return 11;
    return TWG.platformLen(cls) * 0.4;
  };

  /* 按类型索引，便于 AI 选弹 */
  TWG.weaponsByType = function (side, type) {
    return Object.keys(W).filter(function (k) { return W[k].type === type && (!side || W[k].side === side); });
  };
})(typeof window !== 'undefined' ? window : globalThis);
