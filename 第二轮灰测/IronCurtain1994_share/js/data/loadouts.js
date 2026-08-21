/* 铁幕1994 — 改装 / 挂载数据表 (classic script, no modules)
 * 引擎按声明式规则套用：stats 加算, traits 追加, weaponPatch 按 kind 匹配修正,
 * addWeapons 追加武器, vetShift 调整老兵度, availShift 调整可用数, costMult 成本乘算.
 */
(function () {
  function M(o) { return o; }

  window.DATA_MODS = {
    /* ===================== 华约 陆战改装 ===================== */
    upg_era_k1: M({
      name: '接触-1 爆炸反应装甲', cost: 14, side: 'WP', tag: '装甲防护',
      stats: { armorF: 3, armorS: 2 }, traits: ['era'],
      desc: '正面/侧面抗破甲显著提升，对动能弹效果有限。'
    }),
    upg_era_k5: M({
      name: '接触-5 重型爆反', cost: 26, side: 'WP', tag: '装甲防护',
      stats: { armorF: 5, armorS: 3, armorT: 1 }, traits: ['era'],
      desc: '兼顾抗动能，代价是机动略降与后勤负担。'
    }),
    upg_shtora: M({
      name: 'Штора-1 光电对抗', cost: 22, side: 'WP', tag: '生存性',
      stats: { ecm: 3, stealth: 1 }, traits: ['smoke'],
      desc: '干扰半自动指令制导反坦克导弹，敌方 ATGM 命中率下降。'
    }),
    upg_arena: M({
      name: 'Арена-Э 主动防护', cost: 40, side: 'WP', tag: '生存性', era: 1994,
      stats: { ecm: 5, armorS: 2 }, traits: ['era'],
      desc: '1994年推演列装：拦截来袭破甲战斗部，对 ATGM 与火箭筒极为有效。'
    }),
    upg_ammo_svinets: M({
      name: '3БМ46「铅」尾翼稳定脱壳穿甲弹', cost: 24, side: 'WP', tag: '火力',
      weaponPatch: [{ match: 'AT', pen: 3, acc: 0.02 }],
      desc: '新一代长杆弹芯，对西方复合装甲穿深提升。'
    }),
    upg_thermal_agava: M({
      name: '「龙舌兰-2」热成像', cost: 30, side: 'WP', tag: '观瞄',
      stats: { optics: 2 }, traits: ['thermal'],
      weaponPatch: [{ match: 'AT', acc: 0.05 }, { match: 'ATGM', acc: 0.04 }],
      desc: '苏军稀缺的热像仪，夜间与烟幕条件下仍可交战。'
    }),
    upg_konkurs_m: M({
      name: '9М113М「短号-M」串联战斗部', cost: 26, side: 'WP', tag: '火力',
      weaponPatch: [{ match: 'ATGM', pen: 5, acc: 0.03 }],
      desc: '串联战斗部专治爆炸反应装甲。'
    }),
    upg_mine_plow: M({
      name: 'КМТ-6 扫雷犁', cost: 10, side: 'WP', tag: '工程',
      traits: ['mine_plow', 'engineer'], stats: { move: -1 },
      desc: '可清除地雷与障碍，通过工事地形消耗降低。'
    }),
    upg_rpo_a: M({
      name: 'РПО-А「大黄蜂」云爆火箭', cost: 20, side: 'WP', tag: '火力',
      traits: ['thermobaric'],
      addWeapons: [{ name: 'РПО-А 云爆弹', kind: 'HE', pen: 6, he: 18, acc: 0.55, rmin: 0, rmax: 2, rof: 1, ammo: 6, air: false }],
      desc: '清理建筑与堑壕的暴力手段，对掩体内步兵毁伤极高。'
    }),
    upg_igla_team: M({
      name: '9К38「针」防空小组', cost: 24, side: 'WP', tag: '防空',
      traits: ['manpads'],
      addWeapons: [{ name: '9М39 针-1', kind: 'AA', pen: 8, he: 9, acc: 0.62, rmin: 1, rmax: 5, rof: 1, ammo: 4, air: true }],
      desc: '随行便携防空，令敌方武装直升机不敢低空盘旋。'
    }),
    upg_ags17: M({
      name: 'АГС-17「火焰」自动榴弹发射器', cost: 16, side: 'WP', tag: '火力',
      addWeapons: [{ name: 'АГС-17 30mm', kind: 'HE', pen: 3, he: 10, acc: 0.5, rmin: 0, rmax: 3, rof: 3, ammo: 30, air: false }],
      desc: '压制敌方步兵的廉价高效手段。'
    }),
    upg_gaz_recon: M({
      name: '前进观察组', cost: 18, side: 'ANY', tag: '侦察',
      stats: { optics: 2 }, traits: ['recon', 'counter_battery'],
      desc: '为师属炮兵提供校射，可缩短己方间瞄火力散布。'
    }),

    /* ===================== 北约 陆战改装 ===================== */
    upg_dep_uranium: M({
      name: 'M829 贫铀穿甲弹', cost: 22, side: 'NATO', tag: '火力',
      weaponPatch: [{ match: 'AT', pen: 3, acc: 0.02 }],
      desc: '高密度弹芯，2000 米内可正面击穿绝大多数苏制车体。'
    }),
    upg_m829a2: M({
      name: 'M829A2 高级贫铀弹', cost: 34, side: 'NATO', tag: '火力', era: 1994,
      weaponPatch: [{ match: 'AT', pen: 6, acc: 0.03 }],
      desc: '1994年推演批次，专为对抗接触-5 与新型复合装甲研制。'
    }),
    upg_thermal_2gen: M({
      name: '二代热像仪 / 指挥官独立观瞄', cost: 30, side: 'NATO', tag: '观瞄',
      stats: { optics: 3 }, traits: ['thermal'],
      weaponPatch: [{ match: 'AT', acc: 0.06 }],
      desc: '猎-歼式射击，先发现先开火先命中。'
    }),
    upg_tusk_bar: M({
      name: '附加装甲组件 / 格栅装甲', cost: 18, side: 'NATO', tag: '装甲防护',
      stats: { armorS: 3, armorT: 1 }, traits: ['era'],
      desc: '城镇战中防护侧后，代价是机动性与运输负担。'
    }),
    upg_javelin: M({
      name: 'FGM-148「标枪」攻顶导弹', cost: 38, side: 'NATO', tag: '火力', era: 1994,
      addWeapons: [{ name: 'FGM-148 标枪', kind: 'ATGM', pen: 26, he: 6, acc: 0.8, rmin: 1, rmax: 5, rof: 1, ammo: 5, air: false }],
      desc: '射后不理、攻击顶装甲——苏军车长最恐惧的1994年新玩具。'
    }),
    upg_dragon: M({
      name: 'M47「龙」式反坦克导弹', cost: 14, side: 'NATO', tag: '火力',
      addWeapons: [{ name: 'M47 龙', kind: 'ATGM', pen: 16, he: 4, acc: 0.5, rmin: 1, rmax: 4, rof: 1, ammo: 5, air: false }],
      desc: '射手必须全程暴露跟踪，聊胜于无。'
    }),
    upg_tow2b: M({
      name: 'BGM-71F TOW-2B 攻顶型', cost: 32, side: 'NATO', tag: '火力',
      weaponPatch: [{ match: 'ATGM', pen: 6, acc: 0.02 }],
      desc: '飞越目标上方双向成型装药起爆，无视爆反。'
    }),
    upg_stinger_team: M({
      name: 'FIM-92「毒刺」防空小组', cost: 26, side: 'NATO', tag: '防空',
      traits: ['manpads'],
      addWeapons: [{ name: 'FIM-92C 毒刺', kind: 'AA', pen: 8, he: 9, acc: 0.66, rmin: 1, rmax: 5, rof: 1, ammo: 4, air: true }],
      desc: '抗干扰导引头，对米-24 与苏-25 威胁极大。'
    }),
    upg_mk19: M({
      name: 'Mk.19 自动榴弹发射器', cost: 16, side: 'NATO', tag: '火力',
      addWeapons: [{ name: 'Mk.19 40mm', kind: 'HE', pen: 3, he: 11, acc: 0.5, rmin: 0, rmax: 3, rof: 3, ammo: 32, air: false }],
      desc: '面杀伤压制，掩护班组机动。'
    }),
    upg_gps_nav: M({
      name: 'GPS 导航与数字火控', cost: 24, side: 'NATO', tag: '指挥',
      stats: { optics: 1, morale: 1 }, traits: ['command', 'gps'],
      desc: '1994年北约的隐形优势：知道自己在哪，也知道炮弹会落在哪。'
    }),

    /* ===================== 通用 ===================== */
    upg_nbc_kit: M({
      name: '三防超压与洗消组件', cost: 18, side: 'ANY', tag: '生存性',
      traits: ['nbc'], stats: { morale: 1 },
      desc: '核生化污染区内减少战力衰减——1994年的战场必需品。'
    }),
    upg_extra_ammo: M({
      name: '加倍弹药基数', cost: 14, side: 'ANY', tag: '后勤',
      ammoMult: 1.6, stats: { move: -1 },
      desc: '持久火力，代价是机动与被弹殉爆风险。'
    }),
    upg_vet_up: M({
      name: '抽调老兵骨干', cost: 30, side: 'ANY', tag: '人员',
      vetShift: 1, availShift: -1,
      desc: '提升一级老兵度，但可动用数量减少。'
    }),
    upg_cheap_down: M({
      name: '补充预备役新兵', cost: -18, side: 'ANY', tag: '人员',
      vetShift: -1, availShift: 2,
      desc: '降低一级老兵度换取更多可用数量与更低单价。'
    }),
    upg_dug_in: M({
      name: '预设阵地与伪装网', cost: 20, side: 'ANY', tag: '生存性',
      stats: { stealth: 2 }, traits: ['dug_in'],
      desc: '部署即获得额外构筑度，首回合起就享有掩体加成。'
    }),

    /* ===================== 航空挂载 ===================== */
    ld_atgm_heavy: M({
      name: '重型反坦克导弹挂载', cost: 40, side: 'ANY', tag: '挂载', air: true,
      weaponPatch: [{ match: 'ATGM', pen: 4, ammoMult: 1.5 }],
      desc: '满挂反装甲，牺牲对空自卫与滞空时间。'
    }),
    ld_rocket_pods: M({
      name: '火箭发射巢', cost: 22, side: 'ANY', tag: '挂载', air: true,
      addWeapons: [{ name: 'S-8 / Hydra 70 火箭', kind: 'BOMB', pen: 9, he: 13, acc: 0.42, rmin: 0, rmax: 3, rof: 2, ammo: 4, air: false }],
      desc: '覆盖式火箭齐射，对集结的软目标效果最好。'
    }),
    ld_cluster: M({
      name: '子母集束炸弹', cost: 46, side: 'ANY', tag: '挂载', air: true,
      traits: ['cluster'],
      addWeapons: [{ name: '集束炸弹', kind: 'BOMB', pen: 10, he: 20, acc: 0.5, rmin: 0, rmax: 2, rof: 1, ammo: 2, air: false }],
      desc: '一次投放覆盖整片格区，友军距离过近会被卷入。'
    }),
    ld_iron_bombs: M({
      name: '常规重型航弹', cost: 28, side: 'ANY', tag: '挂载', air: true,
      addWeapons: [{ name: '250/500kg 航弹', kind: 'BOMB', pen: 12, he: 22, acc: 0.4, rmin: 0, rmax: 1, rof: 1, ammo: 2, air: false }],
      desc: '摧毁建筑与桥梁的老办法，需要抵近投弹。'
    }),
    ld_laser_gbu: M({
      name: '激光制导炸弹', cost: 54, side: 'NATO', tag: '挂载', air: true,
      traits: ['laser_guided'],
      addWeapons: [{ name: 'GBU-12 铺路石', kind: 'BOMB', pen: 22, he: 18, acc: 0.78, rmin: 0, rmax: 2, rof: 1, ammo: 2, air: false }],
      desc: '精确点杀伤，需要地面侦察或前进观察组提供指示。'
    }),
    ld_aam_extra: M({
      name: '增挂空空导弹', cost: 30, side: 'ANY', tag: '挂载', air: true,
      weaponPatch: [{ match: 'AA', ammoMult: 2, acc: 0.04 }],
      desc: '为争夺制空权而生，对地打击能力下降。'
    }),
    ld_sead_missiles: M({
      name: '反辐射导弹', cost: 48, side: 'ANY', tag: '挂载', air: true,
      traits: ['sead'],
      addWeapons: [{ name: '反辐射导弹', kind: 'BOMB', pen: 16, he: 14, acc: 0.72, rmin: 1, rmax: 6, rof: 1, ammo: 2, air: false }],
      desc: '专猎开机的防空雷达，压制敌方防空网。'
    }),
    ld_fuel_tanks: M({
      name: '副油箱与增程', cost: 16, side: 'ANY', tag: '挂载', air: true,
      stats: { fuel: 4, move: 2 },
      desc: '延长滞空/出击轮次，机动性略降。'
    }),
    ld_nuke_tactical: M({
      name: '战术核航弹挂载', cost: 260, side: 'ANY', tag: '挂载', air: true, nuke: true,
      traits: ['nbc'],
      addWeapons: [{ name: '战术核装置 (低当量)', kind: 'NUKE', pen: 60, he: 60, acc: 0.9, rmin: 0, rmax: 2, rof: 1, ammo: 1, air: false }],
      desc: '需要战区核授权。半径两格内一切生物与钢铁化为焦土——包括你的。'
    })
  };

  /* 老兵度定义 */
  window.DATA_VET = {
    recruit: { name: '征召兵', acc: -0.08, morale: -2, cohesion: -15, costMult: 0.85, availMult: 1.35, xp: 0 },
    trained: { name: '训练兵', acc: 0, morale: 0, cohesion: 0, costMult: 1.0, availMult: 1.0, xp: 1 },
    veteran: { name: '老兵', acc: 0.07, morale: 1, cohesion: 12, costMult: 1.2, availMult: 0.7, xp: 2 },
    elite: { name: '精锐', acc: 0.13, morale: 2, cohesion: 22, costMult: 1.45, availMult: 0.45, xp: 3 }
  };
  window.DATA_VET_ORDER = ['recruit', 'trained', 'veteran', 'elite'];

  /* 场外支援卡（非部署单位，直接消耗分值打击）
   * 注：核炮弹与化学弹药在 1991 年即已实际服役，因此三种模式都存在，
   *     但必须通过「作战决心」取得战区授权；无尽模式无需授权。 */
  window.DATA_SUPPORT = [
    {
      id: 'sup_arty_120', name: '营属 120mm 迫击炮急促射', side: 'ANY', cost: 55, era: 1991,
      kind: 'barrage', radius: 1, he: 12, pen: 4, shots: 5, delay: 0, spot: false,
      desc: '一分钟内落下的压制火力，主要制造压制与轻伤。'
    },
    {
      id: 'sup_arty_152', name: '师属 152mm 榴弹炮群拦阻射击', side: 'WP', cost: 95, era: 1991,
      kind: 'barrage', radius: 2, he: 16, pen: 7, shots: 7, delay: 1,
      desc: '苏军的钢铁雨。延迟一回合抵达，覆盖半径两格。'
    },
    {
      id: 'sup_arty_155', name: '师属 155mm 榴弹炮营 TOT 射击', side: 'NATO', cost: 100, era: 1991,
      kind: 'barrage', radius: 2, he: 15, pen: 8, shots: 6, delay: 1,
      desc: '同时弹着射击，首群即达成最大杀伤。'
    },
    {
      id: 'sup_mlrs_wp', name: 'БМ-27「飓风」火箭炮齐射', side: 'WP', cost: 150, era: 1991,
      kind: 'barrage', radius: 3, he: 19, pen: 9, shots: 9, delay: 1, cluster: true,
      desc: '面覆盖齐射，能一次瓦解整条进攻出发阵地。'
    },
    {
      id: 'sup_mlrs_nato', name: 'M270 MLRS 子母弹齐射', side: 'NATO', cost: 155, era: 1991,
      kind: 'barrage', radius: 3, he: 18, pen: 10, shots: 9, delay: 1, cluster: true,
      desc: '“钢雨”。DPICM 子弹药对暴露车辆顶装甲同样致命。'
    },
    {
      id: 'sup_atacms', name: 'MGM-140 ATACMS 战役战术导弹', side: 'NATO', cost: 230, era: 1994,
      kind: 'barrage', radius: 2, he: 26, pen: 14, shots: 4, delay: 1, deep: true,
      desc: '1994年推演装备：可打击敌方纵深集结与防空阵地。'
    },
    {
      id: 'sup_smerch', name: 'БМ-30「龙卷风」远程齐射', side: 'WP', cost: 235, era: 1994,
      kind: 'barrage', radius: 3, he: 25, pen: 13, shots: 6, delay: 1, deep: true,
      desc: '1994年推演装备：射程与散布都令人绝望。'
    },
    {
      id: 'sup_tos1', name: 'ТОС-1「布拉季诺」温压齐射', side: 'WP', cost: 200, era: 1994,
      kind: 'barrage', radius: 2, he: 30, pen: 8, shots: 5, delay: 0, thermobaric: true,
      desc: '云爆弹药抹平城镇街区，对工事内步兵近乎必杀。'
    },
    {
      id: 'sup_recon_flight', name: '战术侦察机通场', side: 'ANY', cost: 60, era: 1991,
      kind: 'recon', radius: 4, delay: 0,
      desc: '揭示目标区域周围四格内的一切敌军，持续两回合。'
    },
    {
      id: 'sup_smoke', name: '发烟弹幕', side: 'ANY', cost: 40, era: 1991,
      kind: 'smoke', radius: 2, delay: 0,
      desc: '在指定区域构筑烟幕，双方观测与命中率大幅下降。'
    },
    {
      id: 'sup_air_cas', name: '紧急近距空中支援', side: 'ANY', cost: 175, era: 1991,
      kind: 'airstrike', radius: 1, he: 20, pen: 20, shots: 4, delay: 1,
      desc: '呼叫值班攻击机通场，会被敌方防空拦截。'
    },
    {
      id: 'sup_chem', name: '化学弹头炮击 (需战区授权)', side: 'ANY', cost: 190, era: 1991, restricted: 'chem',
      kind: 'barrage', radius: 3, he: 22, pen: 3, shots: 6, delay: 1, chem: true,
      desc: '持久性毒剂污染，未装备三防的部队将成片失去战力。'
    },
    {
      id: 'sup_nuke_arty', name: '核炮弹射击 (需战区核授权)', side: 'ANY', cost: 320, era: 1991, restricted: 'nuke',
      kind: 'nuke', radius: 2, he: 60, pen: 60, shots: 1, delay: 1, yieldKt: 2,
      desc: '2 千吨级战术核弹头。冲击波、辐射与残留污染，敌我不分。'
    },
    {
      id: 'sup_nuke_missile', name: '战役战术核导弹突击 (需战区核授权)', side: 'ANY', cost: 480, era: 1991, restricted: 'nuke',
      kind: 'nuke', radius: 3, he: 90, pen: 90, shots: 1, delay: 2, yieldKt: 20,
      desc: '20 千吨级。这一发落下之后，这片战场再无“战线”可言。'
    }
  ];
})();
