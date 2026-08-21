/* ============================================================================
 * scenarios.js — 兵推剧本 (Wargame Scenarios)
 * ----------------------------------------------------------------------------
 * 每个剧本给出：战役目标、阶段划分(小时)、季节窗口、干预时点、登陆计划、
 *   首波火力打击目标序列。剧本仅设定"条件"，结果完全由引擎推演产生。
 * ==========================================================================*/
(function (root) {
  'use strict';
  var TWG = root.TWG = root.TWG || {};

  /* 首波弹道/巡航导弹打击目标优先序 (火箭军"联合火力突击") */
  var STRIKE_PRIORITY_1 = [
    'KS-LESHAN', 'KS-HENGSHAN', 'KS-CHIAYI-C2', 'KS-MND',           // 预警与指挥
    'AB-HUALIEN', 'AB-ZHIHANG', 'AB-CHIAYI', 'AB-TAINAN', 'AB-CCK', // 主战机场
    'AB-HSINCHU', 'AB-TAOYUAN', 'AB-MAKUNG', 'AB-PINGTUNG', 'AB-GANGSHAN',
    'NB-ZUOYING', 'NB-SUAO', 'NB-KEELUNG', 'NB-MAGONG'              // 军港
  ];
  var STRIKE_PRIORITY_2 = [
    'KS-TAICHUNGPP', 'KS-HSINTA', 'KS-DALIN', 'KS-FANGSHAN', 'KS-TOUCHENG',
    'PT-TAICHUNG', 'PT-KAOHSIUNG', 'PT-TAIPEI', 'PT-HUALIEN',
    'HW-MINSYONG', 'HW-HUATAN', 'HW-MADOU', 'HW-RENDE', 'HW-JIADONG'
  ];

  function ph(at, name, desc) { return { at: at, name: name, desc: desc }; }

  var SCENARIOS = {

    /* =================================================================== */
    'firepower': {
      id: 'firepower',
      name: '联合火力打击战役 (Joint Firepower Strike)',
      short: '火力打击',
      season: '9-10月 (秋季窗口)',
      maxDays: 7,
      needAmphib: false,
      amphibHour: null,
      usIntervention: null,
      brief:
        '不实施登陆。以火箭军 + 航空兵 + 海军的联合火力突击瘫痪台军指挥、预警、机场、' +
        '防空与港口，迫使台方在政治上屈服。台军以「战力保存 + 存活反击」应对：' +
        '飞机进洞库/疏散战备道，防空机动转移，以雄二E/云峰对大陆沿海机场与雷达反击。',
      objectives: {
        PLA: ['瘫痪台军战管与预警体系', '压制机场起降能力至 30% 以下', '摧毁台海军主力水面舰艇', '避免升级为地面战'],
        ROC: ['保存 60% 以上作战飞机', '维持至少 4 座机场可用', '完成对大陆沿海目标的可信反击', '争取国际介入']
      },
      phases: [
        ph(0, '第一波火力突击', 'DF-15B/DF-16A/DF-17 + CJ-10A 齐射，首打乐山雷达、衡山指挥所、各主战机场跑道与防空阵地'),
        ph(2, '压制防空 (SEAD/DEAD)', 'J-16D 电子攻击 + YJ-91 反辐射，猎杀爱国者/天弓阵地雷达'),
        ph(8, '夺取制空权', '大规模战斗机扫荡与机场再压制，KJ-500 全时预警指挥'),
        ph(30, '海上封控与打击', 'H-6J/052D/055 对台海军残余兵力实施反舰打击'),
        ph(72, '持续压制与心理攻势', '周期性再打击，破坏抢修，打击电力与通信节点'),
        ph(120, '战果固化', '维持压制态势，等待政治结果')
      ],
      strike1: STRIKE_PRIORITY_1, strike2: STRIKE_PRIORITY_2,
      landingPlan: [],
      apply: function (E) {
        E.alive('PLA', 'surface').forEach(function (u) {
          if (u.P.lift) { u.state = 'inport'; u.reserved = 1; }
        });
      }
    },

    /* =================================================================== */
    'blockade': {
      id: 'blockade',
      name: '联合封锁作战 (Joint Blockade / Quarantine)',
      short: '联合封锁',
      season: '3月下-4月 (春季窗口)',
      maxDays: 21,
      needAmphib: false,
      amphibHour: null,
      usIntervention: 6,
      brief:
        '以海警「登临检查」+ 海军封控区 + 潜艇布势 + 空中巡逻，切断台湾能源与粮食输入。' +
        '不主动全面开火，但对突破封锁的舰船实施拦截；台方与美日尝试护航破封，摩擦逐步升级为交战。' +
        '台湾能源库存(天然气约 8-11 天、煤约 30 天)是核心时间变量。',
      objectives: {
        PLA: ['建立并维持 6 个封控区', '击沉/驱离一切突破封锁船只', '不给美军直接介入的政治口实', '在 21 日内压垮台湾能源与经济'],
        ROC: ['维持至少一条对外海上通道', '保存海空军战力', '促成美日护航行动', '撑过封锁窗口']
      },
      phases: [
        ph(0, '宣布封控区', '公告 6 个封控区与「临检制度」，海警 + 民兵船队前置，海军编队外围警戒'),
        ph(12, '海空封控', '022 艇群 + 056A 巡逻线，039C/093B 于巴士海峡与花东深水区布势'),
        ph(48, '强制拦截升级', '对拒检船只实施火力警告与瘫痪射击，双方擦枪走火'),
        ph(144, '护航对抗', '美日护航编队进入，双方进入高强度海空对抗'),
        ph(288, '封锁效果评估', '台湾能源库存告急，双方在政治与军事上同时施压'),
        ph(432, '决断窗口', '封锁成效不足则被迫升级为火力打击/登陆')
      ],
      strike1: ['KS-FANGSHAN', 'KS-TOUCHENG', 'NB-MAGONG'], strike2: STRIKE_PRIORITY_1,
      landingPlan: [],
      apply: function (E) {
        E.alive('PLA', 'surface').forEach(function (u) { if (u.P.lift) { u.state = 'inport'; u.reserved = 1; } });
        E.blockade = true;
        E.rulesOfEngagement = { strikeLand: 48 * 3600, noShipStrike: 48 * 3600 };
      }
    },

    /* =================================================================== */
    'outer-island': {
      id: 'outer-island',
      name: '外岛夺取作战 (金门·马祖·澎湖)',
      short: '外岛夺取',
      season: '9-10月 (秋季窗口)',
      maxDays: 6,
      needAmphib: true,
      amphibHour: 3,
      usIntervention: null,
      brief:
        '以有限战争夺取金门(距厦门约 10km)、马祖，视情夺取澎湖，制造「既成事实」以摧毁台湾抵抗意志，' +
        '同时把冲突控制在美军难以介入的门槛之下。金马守军无战略纵深、无制空权掩护，' +
        '但澎湖有天弓三型与马公基地，将成为真正的硬仗。',
      objectives: {
        PLA: ['48 小时内拿下金门与马祖', '视情况夺取澎湖并转为前进基地', '避免打击台湾本岛以控制升级', '把战损压到最低'],
        ROC: ['守住澎湖', '以本岛岸置反舰与空军支援外岛', '避免主力被诱歼于外岛', '维持本岛完整战力']
      },
      phases: [
        ph(0, '外岛火力压制', 'PHL-16/PHL-03 远火 + 无人机对金马守备阵地实施地毯式压制'),
        ph(3, '金马两栖突击', '陆战旅 + 两栖旅短距突击，直升机垂直包围，特战夺控要点'),
        ph(20, '澎湖预备打击', '对马公基地、天弓阵地实施弹道导弹与巡航导弹打击'),
        ph(40, '澎湖登陆', '两栖第一梯队在澎湖本岛西岸登陆'),
        ph(90, '外岛肃清与固化', '清剿残余，转用马公基地，进入战略对峙')
      ],
      strike1: ['AB-KINMEN', 'AB-MAKUNG', 'NB-MAGONG', 'NB-LIAOLUO'], strike2: ['KS-LESHAN'],
      landingPlan: [
        { beach: 'KINMEN', lat: 24.44, lon: 118.40, name: '金门料罗湾—后浦', echelon: 1, weight: 1.0, grade: 0.72, flat: 0.4, width: 6, obj: '金门守备旅指挥部', region: '外岛' },
        { beach: 'MATSU', lat: 26.15, lon: 119.94, name: '马祖南竿—福澳', echelon: 1, weight: 0.5, grade: 0.55, flat: 0.2, width: 2, obj: '马祖防卫部', region: '外岛' },
        { beach: 'PENGHU', lat: 23.57, lon: 119.55, name: '澎湖本岛西岸 (讲美—西屿)', echelon: 2, weight: 0.9, grade: 0.7, flat: 0.6, width: 7, obj: '马公基地/澎防部', region: '外岛' }
      ],
      apply: function (E) {
        E.limitedWar = true;
        E.rulesOfEngagement = { noMainIsland: 20 * 3600 };
        E.alive('PLA', 'surface').forEach(function (u) {
          if (u.role === 'sealift' || u.role === 'barge' || u.role === 'militia') { u.state = 'inport'; u.reserved = 1; }
        });
      }
    },

    /* =================================================================== */
    'invasion': {
      id: 'invasion',
      name: '联合登陆战役 (Joint Island Landing Campaign)',
      short: '全面登陆',
      season: '9-10月 (秋季窗口)',
      maxDays: 30,
      needAmphib: true,
      amphibHour: 30,
      usIntervention: 5,
      brief:
        '解放军战役全流程：火力突击 → 夺取制空制海 → 扫雷破障 → 多方向两栖 + 垂直登陆 → ' +
        '夺取港口与机场 → 向台北盆地纵深进攻。主登陆方向选在台中大甲—清水 (临台中港)，' +
        '辅助方向桃园观音、台南将军、屏东枋寮，并以空降兵夺取桃园机场。' +
        '胜负关键：72 小时内能否夺取一座大型港口、美军介入时点、台军岸置反舰弹药存量。',
      objectives: {
        PLA: ['D+3 前建立 2 个稳固登陆场', 'D+7 前夺取台中港或高雄港', 'D+14 前进抵台北盆地', '在美军形成有效干预前完成夺台'],
        ROC: ['滩头歼敌：把登陆部队消灭在水际', '保存反舰火力与后备动员', '守住台北与主要港口', '撑到美日介入']
      },
      phases: [
        ph(0, '第一波联合火力突击', '大规模弹道/巡航导弹齐射，首打预警雷达、指挥所、机场跑道、防空阵地、军港'),
        ph(3, '压制防空与夺取制空权', 'J-16D 电子攻击、YJ-91 反辐射、歼-20 前置扫荡，摧毁爱国者与天弓阵地'),
        ph(14, '夺取制海权与破障', '反舰打击台海军残余，扫雷舰艇开辟航道，特战/蛙人破除水下障碍'),
        ph(30, '两栖航渡与垂直登陆', '第一梯队 4 个方向同时上陸，空降兵夺取桃园机场，直升机机降切断南北交通'),
        ph(54, '滩头扩张与夺港', '第二梯队 (民船/水桥驳船) 投送重装，强攻台中港'),
        ph(120, '纵深进攻', '向台北盆地与高雄推进，进入城市攻防'),
        ph(240, '全岛作战', '肃清残余抵抗与后备部队')
      ],
      strike1: STRIKE_PRIORITY_1, strike2: STRIKE_PRIORITY_2,
      landingPlan: [
        { beach: 'BH-DAJIA', echelon: 1, weight: 1.0, main: 1 },
        { beach: 'BH-GUANYIN', echelon: 1, weight: 0.6 },
        { beach: 'BH-JIANGJUN', echelon: 2, weight: 0.6 },
        { beach: 'BH-FANGLIAO', echelon: 2, weight: 0.4 },
        { beach: 'BH-XIANXI', echelon: 2, weight: 0.5 },
        { beach: 'BH-BUDAI', echelon: 2, weight: 0.4 },
        { beach: 'BH-TAIXI', echelon: 2, weight: 0.35 }
      ],
      airborne: [
        { target: 'AB-TAOYUAN', at: 30, name: '空降夺取桃园机场' },
        { target: 'AB-CCK', at: 58, name: '空降夺取清泉岗基地' }
      ],
      apply: function (E) { E.fullInvasion = true; }
    },

    /* =================================================================== */
    'shortwarning': {
      id: 'shortwarning',
      name: '短预警突袭 (2027 快速夺台推演)',
      short: '短预警突袭',
      season: '3月下-4月 (春季窗口)',
      maxDays: 21,
      needAmphib: true,
      amphibHour: 24,
      usIntervention: 2,
      brief:
        '以年度「联合利剑」演习为掩护，无预警转入实战：D 日前台军未完成动员与疏散，' +
        '解放军以斩首打击 + 特战渗透 + 全线火力突击开局，力求 14 日内解决。' +
        '代价是美军介入极早(D+2)，且民船动员不充分导致第二梯队投送能力下降。',
      objectives: {
        PLA: ['以突然性瘫痪台军指挥体系', 'D+2 前上陸并夺取一处港口', '在美军全面到位前形成不可逆态势'],
        ROC: ['在混乱中恢复指挥与动员', '以岸置反舰火力打击第一梯队船团', '死守台北与台中港']
      },
      phases: [
        ph(0, '演习转实战 / 斩首突击', '特战与渗透分队攻击衡山指挥所、战管中心、要人官邸；导弹突击同步展开'),
        ph(1.5, '全线火力压制', '弹道导弹 + 远火 + 巡航导弹压制机场与防空，台军未及疏散损失惨重'),
        ph(10, '强夺制空制海', '不等完全压制即抢时间窗口，损失较高'),
        ph(24, '两栖抢滩', '仓促航渡，掩护不足但守军亦未展开'),
        ph(48, '夺港与突破', '强攻台中港与台北港'),
        ph(120, '纵深与美军对抗', '同时应对台军反击与美军介入')
      ],
      strike1: ['KS-HENGSHAN', 'KS-MND', 'KS-CHIAYI-C2', 'KS-LESHAN'].concat(STRIKE_PRIORITY_1),
      strike2: STRIKE_PRIORITY_2,
      landingPlan: [
        { beach: 'BH-DAJIA', echelon: 1, weight: 1.0, main: 1 },
        { beach: 'BH-LINKOU', echelon: 1, weight: 0.6 },
        { beach: 'BH-ANPING', echelon: 1, weight: 0.6 },
        { beach: 'BH-WAIAO', echelon: 2, weight: 0.4 }
      ],
      airborne: [{ target: 'AB-TAOYUAN', at: 20, name: '空降突袭桃园机场' }],
      apply: function (E) {
        E.surprise = true;
        Object.keys(E.bases).forEach(function (k) {
          var b = E.bases[k];
          if (b.side === 'ROC') { b.has = Math.round(b.has * 0.35); b.cave = Math.round(b.cave * 0.5); }
        });
        E.alive('ROC', 'sam').forEach(function (u) { u.sens *= 0.7; u.fire *= 0.85; });
        E.alive('ROC', 'ground').forEach(function (u) { if (u.role === 'reserve_bde') u.mobilizeAt += 36 * 3600; });
        var kill = 0;
        E.alive('PLA', 'surface').forEach(function (u) {
          if (u.role === 'sealift' && kill < 16) { u.state = 'inport'; u.reserved = 1; kill++; }
        });
      }
    },

    /* =================================================================== */
    'us-intervene': {
      id: 'us-intervene',
      name: '大国对抗剧本 (美日全面介入)',
      short: '美日介入',
      season: '9-10月 (秋季窗口)',
      maxDays: 24,
      needAmphib: true,
      amphibHour: 40,
      usIntervention: 0.5,
      brief:
        '美军在战前即已前沿部署：航母打击群、5 艘弗吉尼亚级、嘉手纳/关岛 F-35/F-22/B-1B，' +
        '日本自卫队参与情报与海上护卫。解放军须同时实施登陆与反介入(A2/AD)：' +
        'DF-21D/DF-26 对航母，DF-17 对嘉手纳，YJ-21 对水面编队。' +
        '这是全剧本中最接近「大国战争」的推演。',
      objectives: {
        PLA: ['以反介入火力迫使美军航母退至 1500km 外', '同时维持登陆战役势头', '压制嘉手纳/那霸出动能力'],
        ROC: ['与美日联合作战体系融合', '以岸基火力配合美军潜艇封锁海峡', '守住台北与东岸港口']
      },
      phases: [
        ph(0, '反介入首轮齐射', 'DF-26/DF-21D 对航母打击群、DF-17 对嘉手纳跑道，同步对台火力突击'),
        ph(4, '双线夺权', '同时争夺台海制空与第一岛链外围制海'),
        ph(20, '潜艇战', '美军核潜艇进入海峡东口猎杀两栖船团，PLA 全力反潜'),
        ph(40, '两栖强渡', '在美军干预下强行航渡，损失显著上升'),
        ph(96, '消耗与再补给', '双方弹药消耗接近极限，作战节奏转为消耗战'),
        ph(240, '战略僵局', '战线固化，进入政治谈判压力期')
      ],
      strike1: STRIKE_PRIORITY_1, strike2: STRIKE_PRIORITY_2,
      landingPlan: [
        { beach: 'BH-DAJIA', echelon: 1, weight: 1.0, main: 1 },
        { beach: 'BH-GUANYIN', echelon: 1, weight: 0.7 },
        { beach: 'BH-JIANGJUN', echelon: 2, weight: 0.6 }
      ],
      airborne: [{ target: 'AB-TAOYUAN', at: 36, name: '空降夺取桃园机场' }],
      apply: function (E) { E.greatPower = true; }
    }
  };

  TWG.SCENARIOS = SCENARIOS;
  TWG.scenarioList = function () {
    return Object.keys(SCENARIOS).map(function (k) { return SCENARIOS[k]; });
  };
})(typeof window !== 'undefined' ? window : globalThis);
