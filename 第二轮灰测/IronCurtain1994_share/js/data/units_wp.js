/* 铁幕1994 — 华约单位卡数据库
 * 经典脚本，无模块，可被 <script src> 直接加载。
 * 契约见 docs/DATA_SCHEMA.md；mods 仅引用 js/data/loadouts.js 中 window.DATA_MODS 的合法 id。
 */
(function () {
  window.DATA_UNITS_WP = [
    /* ============================================================
     * 运输载具 (TR) —— 仅作为步兵卡 transport 引用，不出现在卡组面板
     * ============================================================ */
    {
      id: 'wp_ussr_bmp1_tr', name: 'БМП-1 步兵战车', short: 'БМП-1', faction: 'WP', country: 'USSR',
      category: 'TR', role: '运输载具', era: 1991, cost: 20, slots: 1, avail: 6, strength: 6, vet: 'trained',
      stats: { move: 8, armorF: 3, armorS: 1, armorT: 1, optics: 5, stealth: 3, morale: 8, ecm: 0, fuel: 9, supply: 0 },
      weapons: [
        { name: '2А28 73mm 雷', kind: 'HE', pen: 4, he: 8, acc: 0.4, rmin: 0, rmax: 2, rof: 2, ammo: 40, air: false },
        { name: 'ПКТ 7.62mm', kind: 'SMALL', pen: 2, he: 3, acc: 0.5, rmin: 0, rmax: 2, rof: 3, ammo: 40, air: false }
      ],
      traits: ['amphibious'],
      mods: ['upg_extra_ammo', 'upg_nbc_kit'],
      transport: null,
      desc: 'БМП-1运输车，73mm低压炮与一车9人，苏联摩步的标配坐骑。'
    },
    {
      id: 'wp_ussr_bmp2_tr', name: 'БМП-2 步兵战车', short: 'БМП-2', faction: 'WP', country: 'USSR',
      category: 'TR', role: '运输载具', era: 1991, cost: 26, slots: 1, avail: 6, strength: 6, vet: 'trained',
      stats: { move: 8, armorF: 3, armorS: 1, armorT: 1, optics: 5, stealth: 3, morale: 8, ecm: 0, fuel: 9, supply: 0 },
      weapons: [
        { name: '2А42 30mm', kind: 'HE', pen: 6, he: 5, acc: 0.55, rmin: 0, rmax: 3, rof: 3, ammo: 50, air: false },
        { name: 'ПКТ 7.62mm', kind: 'SMALL', pen: 2, he: 3, acc: 0.5, rmin: 0, rmax: 2, rof: 3, ammo: 40, air: false }
      ],
      traits: ['amphibious'],
      mods: ['upg_extra_ammo', 'upg_nbc_kit'],
      transport: null,
      desc: 'БМП-2运输车，30mm机炮可仰射打直升机，近卫与摩步的主力。'
    },
    {
      id: 'wp_ussr_bmp3_tr', name: 'БМП-3 步兵战车', short: 'БМП-3', faction: 'WP', country: 'USSR',
      category: 'TR', role: '运输载具', era: 1994, cost: 45, slots: 1, avail: 4, strength: 6, vet: 'trained',
      stats: { move: 8, armorF: 4, armorS: 2, armorT: 1, optics: 6, stealth: 3, morale: 8, ecm: 0, fuel: 9, supply: 0 },
      weapons: [
        { name: '2А70 100mm', kind: 'HE', pen: 8, he: 12, acc: 0.5, rmin: 0, rmax: 4, rof: 1, ammo: 22, air: false },
        { name: '9М117 堡垒', kind: 'ATGM', pen: 18, he: 6, acc: 0.62, rmin: 1, rmax: 7, rof: 1, ammo: 8, air: false }
      ],
      traits: ['amphibious'],
      mods: ['upg_extra_ammo', 'upg_nbc_kit', 'upg_thermal_agava'],
      transport: null,
      desc: '1994年推演：БМП-3运输车，100mm炮打炮射导弹，火力直逼坦克。'
    },
    {
      id: 'wp_ussr_btr70_tr', name: 'БТР-70 装甲输送车', short: 'БТР-70', faction: 'WP', country: 'USSR',
      category: 'TR', role: '运输载具', era: 1991, cost: 16, slots: 1, avail: 6, strength: 6, vet: 'trained',
      stats: { move: 11, armorF: 2, armorS: 1, armorT: 1, optics: 4, stealth: 3, morale: 8, ecm: 0, fuel: 12, supply: 0 },
      weapons: [
        { name: 'КПВТ 14.5mm', kind: 'SMALL', pen: 3, he: 2, acc: 0.5, rmin: 0, rmax: 2, rof: 3, ammo: 40, air: false },
        { name: 'ПКТ 7.62mm', kind: 'SMALL', pen: 2, he: 3, acc: 0.5, rmin: 0, rmax: 2, rof: 3, ammo: 40, air: false }
      ],
      traits: ['amphibious'],
      mods: ['upg_extra_ammo', 'upg_nbc_kit'],
      transport: null,
      desc: 'БТР-70八轮装甲车，汽油机嗓门大但跑得远，卫星国标配。'
    },
    {
      id: 'wp_ussr_btr80_tr', name: 'БТР-80 装甲输送车', short: 'БТР-80', faction: 'WP', country: 'USSR',
      category: 'TR', role: '运输载具', era: 1991, cost: 18, slots: 1, avail: 6, strength: 6, vet: 'trained',
      stats: { move: 12, armorF: 2, armorS: 1, armorT: 1, optics: 4, stealth: 3, morale: 8, ecm: 0, fuel: 12, supply: 0 },
      weapons: [
        { name: 'КПВТ 14.5mm', kind: 'SMALL', pen: 3, he: 2, acc: 0.5, rmin: 0, rmax: 2, rof: 3, ammo: 45, air: false },
        { name: 'ПКТ 7.62mm', kind: 'SMALL', pen: 2, he: 3, acc: 0.5, rmin: 0, rmax: 2, rof: 3, ammo: 40, air: false }
      ],
      traits: ['amphibious'],
      mods: ['upg_extra_ammo', 'upg_nbc_kit'],
      transport: null,
      desc: 'БТР-80换柴油机后更可靠，是陆战队与摩步的轮式坐骑。'
    },
    {
      id: 'wp_ussr_mtlb_tr', name: 'МТ-ЛБ 多用途牵引车', short: 'МТ-ЛБ', faction: 'WP', country: 'USSR',
      category: 'TR', role: '运输载具', era: 1991, cost: 12, slots: 1, avail: 7, strength: 6, vet: 'trained',
      stats: { move: 9, armorF: 1, armorS: 1, armorT: 1, optics: 4, stealth: 3, morale: 8, ecm: 0, fuel: 10, supply: 0 },
      weapons: [
        { name: 'ПКТ 7.62mm', kind: 'SMALL', pen: 2, he: 3, acc: 0.5, rmin: 0, rmax: 2, rof: 3, ammo: 40, air: false }
      ],
      traits: ['amphibious'],
      mods: ['upg_extra_ammo', 'upg_nbc_kit'],
      transport: null,
      desc: 'МТ-ЛБ雪地泥沼通吃的履带驴子，拉炮又拉人。'
    },
    {
      id: 'wp_ussr_ural_tr', name: '乌拉尔-4320 卡车', short: 'Урал-4320', faction: 'WP', country: 'USSR',
      category: 'TR', role: '运输载具', era: 1991, cost: 10, slots: 1, avail: 7, strength: 5, vet: 'trained',
      stats: { move: 11, armorF: 0, armorS: 0, armorT: 0, optics: 3, stealth: 3, morale: 8, ecm: 0, fuel: 13, supply: 0 },
      weapons: [
        { name: 'ПКМ 7.62mm', kind: 'SMALL', pen: 2, he: 3, acc: 0.5, rmin: 0, rmax: 2, rof: 2, ammo: 30, air: false }
      ],
      traits: [],
      mods: ['upg_extra_ammo', 'upg_cheap_down'],
      transport: null,
      desc: '乌拉尔卡车，泥泞公路与冻土上的后勤生命线。'
    },
    {
      id: 'wp_ussr_mi8_tr', name: 'Ми-8 运输直升机', short: 'Ми-8', faction: 'WP', country: 'USSR',
      category: 'TR', role: '运输载具', era: 1991, cost: 40, slots: 1, avail: 4, strength: 2, vet: 'trained',
      stats: { move: 16, armorF: 1, armorS: 1, armorT: 1, optics: 5, stealth: 3, morale: 8, ecm: 0, fuel: 8, supply: 0 },
      weapons: [
        { name: 'ПКТ 7.62mm 门枪', kind: 'SMALL', pen: 2, he: 3, acc: 0.45, rmin: 0, rmax: 2, rof: 3, ammo: 40, air: false }
      ],
      traits: ['heliborne'],
      mods: ['upg_extra_ammo', 'ld_fuel_tanks'],
      transport: null,
      desc: 'Ми-8机降突击的主力，尾舱一开，ВДВ 冲下战壕。'
    },

    /* ============================================================
     * 1991 —— 步兵 (INF)
     * ============================================================ */
    {
      id: 'wp_ussr_motrifle', name: '摩托化步兵班', short: 'МСВ', faction: 'WP', country: 'USSR',
      category: 'INF', role: '摩托化步兵', era: 1991, cost: 50, slots: 1, avail: 6, strength: 10, vet: 'trained',
      stats: { move: 4, armorF: 1, armorS: 1, armorT: 0, optics: 4, stealth: 7, morale: 7, ecm: 0, fuel: 8, supply: 0 },
      weapons: [
        { name: 'АК-74 突击步枪', kind: 'SMALL', pen: 2, he: 3, acc: 0.55, rmin: 0, rmax: 2, rof: 3, ammo: 40, air: false },
        { name: 'РПГ-7В', kind: 'AT', pen: 14, he: 4, acc: 0.4, rmin: 0, rmax: 2, rof: 1, ammo: 6, air: false },
        { name: 'РПК-74 轻机枪', kind: 'SMALL', pen: 2, he: 4, acc: 0.5, rmin: 0, rmax: 3, rof: 3, ammo: 30, air: false }
      ],
      traits: ['cheap_conscript'],
      mods: ['upg_rpo_a', 'upg_ags17', 'upg_igla_team', 'upg_cheap_down', 'upg_dug_in'],
      transport: 'wp_ussr_bmp1_tr',
      desc: '征召动员兵班组，靠数量与АК-74淹没西德防线。'
    },
    {
      id: 'wp_ussr_guards_motrifle', name: '近卫摩托化步兵班', short: 'ГвМСВ', faction: 'WP', country: 'USSR',
      category: 'INF', role: '近卫摩步', era: 1991, cost: 68, slots: 1, avail: 4, strength: 10, vet: 'veteran',
      stats: { move: 4, armorF: 1, armorS: 1, armorT: 0, optics: 5, stealth: 7, morale: 9, ecm: 0, fuel: 8, supply: 0 },
      weapons: [
        { name: 'АК-74 突击步枪', kind: 'SMALL', pen: 2, he: 3, acc: 0.6, rmin: 0, rmax: 2, rof: 3, ammo: 40, air: false },
        { name: 'РПГ-7В', kind: 'AT', pen: 14, he: 4, acc: 0.45, rmin: 0, rmax: 2, rof: 1, ammo: 8, air: false },
        { name: 'РПК-74 轻机枪', kind: 'SMALL', pen: 2, he: 4, acc: 0.55, rmin: 0, rmax: 3, rof: 3, ammo: 30, air: false }
      ],
      traits: ['shock'],
      mods: ['upg_rpo_a', 'upg_ags17', 'upg_igla_team', 'upg_vet_up'],
      transport: 'wp_ussr_bmp2_tr',
      desc: '近卫摩步，阿富汗老兵骨干，士气远胜普通动员兵。'
    },
    {
      id: 'wp_ussr_vdv', name: 'ВДВ 空降兵班', short: 'ВДВ', faction: 'WP', country: 'USSR',
      category: 'INF', role: '空降兵', era: 1991, cost: 70, slots: 1, avail: 3, strength: 9, vet: 'elite',
      stats: { move: 4, armorF: 0, armorS: 0, armorT: 0, optics: 5, stealth: 8, morale: 10, ecm: 0, fuel: 8, supply: 0 },
      weapons: [
        { name: 'АКС-74 短突击步枪', kind: 'SMALL', pen: 2, he: 3, acc: 0.6, rmin: 0, rmax: 2, rof: 3, ammo: 40, air: false },
        { name: 'РПГ-7В', kind: 'AT', pen: 14, he: 4, acc: 0.45, rmin: 0, rmax: 2, rof: 1, ammo: 8, air: false },
        { name: 'РПО-А 云爆弹', kind: 'HE', pen: 6, he: 18, acc: 0.55, rmin: 0, rmax: 2, rof: 1, ammo: 4, air: false }
      ],
      traits: ['airborne', 'heliborne', 'shock', 'thermobaric'],
      mods: ['upg_igla_team', 'upg_ags17', 'upg_vet_up', 'upg_nbc_kit'],
      transport: 'wp_ussr_mi8_tr',
      desc: '空降突击兵，乘米-8直插敌后，是总参谋部的拳头。'
    },
    {
      id: 'wp_ussr_naval_inf', name: '海军步兵班', short: 'Морпех', faction: 'WP', country: 'USSR',
      category: 'INF', role: '海军步兵', era: 1991, cost: 65, slots: 1, avail: 3, strength: 10, vet: 'veteran',
      stats: { move: 4, armorF: 1, armorS: 1, armorT: 0, optics: 4, stealth: 7, morale: 9, ecm: 0, fuel: 8, supply: 0 },
      weapons: [
        { name: 'АК-74 突击步枪', kind: 'SMALL', pen: 2, he: 3, acc: 0.58, rmin: 0, rmax: 2, rof: 3, ammo: 40, air: false },
        { name: 'РПГ-7В', kind: 'AT', pen: 14, he: 4, acc: 0.45, rmin: 0, rmax: 2, rof: 1, ammo: 8, air: false },
        { name: 'РПК-74 轻机枪', kind: 'SMALL', pen: 2, he: 4, acc: 0.52, rmin: 0, rmax: 3, rof: 3, ammo: 30, air: false }
      ],
      traits: ['marine', 'shock'],
      mods: ['upg_rpo_a', 'upg_igla_team', 'upg_vet_up'],
      transport: 'wp_ussr_btr80_tr',
      desc: '黑海舰队陆战队，两栖强袭夺占波罗的海出海口。'
    },
    {
      id: 'wp_ussr_spetsnaz', name: 'Спецназ 特种侦察组', short: 'Спецназ', faction: 'WP', country: 'USSR',
      category: 'INF', role: '特种侦察', era: 1991, cost: 70, slots: 1, avail: 2, strength: 8, vet: 'elite',
      stats: { move: 4, armorF: 0, armorS: 0, armorT: 0, optics: 8, stealth: 9, morale: 10, ecm: 0, fuel: 8, supply: 0 },
      weapons: [
        { name: 'АКС-74У 短突击步枪', kind: 'SMALL', pen: 2, he: 3, acc: 0.6, rmin: 0, rmax: 2, rof: 3, ammo: 35, air: false },
        { name: 'СВД 狙击步枪', kind: 'SMALL', pen: 3, he: 3, acc: 0.7, rmin: 0, rmax: 4, rof: 1, ammo: 12, air: false },
        { name: 'РПГ-22 单兵火箭', kind: 'AT', pen: 16, he: 4, acc: 0.5, rmin: 0, rmax: 2, rof: 1, ammo: 4, air: false }
      ],
      traits: ['spec_ops', 'recon', 'sniper', 'heliborne'],
      mods: ['upg_igla_team', 'upg_vet_up', 'upg_nbc_kit'],
      transport: 'wp_ussr_mi8_tr',
      desc: '格鲁乌特种侦察组，渗透敌后猎杀指挥所与核发射车。'
    },
    {
      id: 'wp_ussr_razvedka', name: '侦察兵分队', short: 'Разведка', faction: 'WP', country: 'USSR',
      category: 'INF', role: '侦察兵', era: 1991, cost: 55, slots: 1, avail: 4, strength: 8, vet: 'veteran',
      stats: { move: 4, armorF: 1, armorS: 1, armorT: 0, optics: 8, stealth: 8, morale: 9, ecm: 0, fuel: 8, supply: 0 },
      weapons: [
        { name: 'АК-74 突击步枪', kind: 'SMALL', pen: 2, he: 3, acc: 0.58, rmin: 0, rmax: 2, rof: 3, ammo: 40, air: false },
        { name: 'СВД 狙击步枪', kind: 'SMALL', pen: 3, he: 3, acc: 0.68, rmin: 0, rmax: 4, rof: 1, ammo: 10, air: false },
        { name: 'РПГ-7В', kind: 'AT', pen: 14, he: 4, acc: 0.45, rmin: 0, rmax: 2, rof: 1, ammo: 6, air: false }
      ],
      traits: ['recon', 'sniper'],
      mods: ['upg_gaz_recon', 'upg_igla_team', 'upg_vet_up'],
      transport: 'wp_ussr_bmp2_tr',
      desc: '师属侦察兵，前出标定北约装甲纵队的方位。'
    },
    {
      id: 'wp_ussr_igla_team', name: '9К38「针」防空小组', short: 'Игла', faction: 'WP', country: 'USSR',
      category: 'INF', role: '便携防空', era: 1991, cost: 45, slots: 1, avail: 5, strength: 7, vet: 'trained',
      stats: { move: 4, armorF: 0, armorS: 0, armorT: 0, optics: 4, stealth: 7, morale: 8, ecm: 0, fuel: 8, supply: 0 },
      weapons: [
        { name: '9М39 针-1', kind: 'AA', pen: 8, he: 9, acc: 0.62, rmin: 1, rmax: 5, rof: 1, ammo: 4, air: true },
        { name: 'АКС-74 短突击步枪', kind: 'SMALL', pen: 2, he: 3, acc: 0.55, rmin: 0, rmax: 2, rof: 3, ammo: 30, air: false }
      ],
      traits: ['manpads'],
      mods: ['upg_extra_ammo', 'upg_cheap_down', 'upg_dug_in'],
      transport: 'wp_ussr_btr80_tr',
      desc: '「针」式便携防空小组，让敌方直升机不敢低空盘旋。'
    },
    {
      id: 'wp_ussr_konkurs_team', name: '9К113「竞赛」反坦克组', short: 'Конкурс', faction: 'WP', country: 'USSR',
      category: 'INF', role: '反坦克小组', era: 1991, cost: 55, slots: 1, avail: 5, strength: 7, vet: 'trained',
      stats: { move: 4, armorF: 0, armorS: 0, armorT: 0, optics: 5, stealth: 7, morale: 8, ecm: 0, fuel: 8, supply: 0 },
      weapons: [
        { name: '9М113 竞赛', kind: 'ATGM', pen: 17, he: 5, acc: 0.6, rmin: 1, rmax: 7, rof: 1, ammo: 6, air: false },
        { name: 'АК-74 突击步枪', kind: 'SMALL', pen: 2, he: 3, acc: 0.55, rmin: 0, rmax: 2, rof: 3, ammo: 30, air: false }
      ],
      traits: ['at_team'],
      mods: ['upg_konkurs_m', 'upg_extra_ammo', 'upg_dug_in'],
      transport: 'wp_ussr_btr70_tr',
      desc: '「竞赛」反坦克小组，专打M1A1侧面与M2步战车。'
    },
    {
      id: 'wp_gdr_motrifle', name: '东德摩托化步兵班', short: 'NVA-МС', faction: 'WP', country: 'GDR',
      category: 'INF', role: '摩托化步兵', era: 1991, cost: 52, slots: 1, avail: 3, strength: 10, vet: 'trained',
      stats: { move: 4, armorF: 1, armorS: 1, armorT: 0, optics: 4, stealth: 7, morale: 8, ecm: 0, fuel: 8, supply: 0 },
      weapons: [
        { name: 'MPi-KM 突击步枪', kind: 'SMALL', pen: 2, he: 3, acc: 0.56, rmin: 0, rmax: 2, rof: 3, ammo: 40, air: false },
        { name: 'РПГ-7В', kind: 'AT', pen: 14, he: 4, acc: 0.42, rmin: 0, rmax: 2, rof: 1, ammo: 6, air: false },
        { name: 'РПК 轻机枪', kind: 'SMALL', pen: 2, he: 4, acc: 0.52, rmin: 0, rmax: 3, rof: 3, ammo: 30, air: false }
      ],
      traits: [],
      mods: ['upg_ags17', 'upg_igla_team', 'upg_dug_in'],
      transport: 'wp_ussr_bmp1_tr',
      desc: '东德人民军摩步，冷战时最忠诚的华约盟军之一。'
    },
    {
      id: 'wp_pol_motrifle', name: '波兰摩托化步兵班', short: 'LWP-МС', faction: 'WP', country: 'POL',
      category: 'INF', role: '摩托化步兵', era: 1991, cost: 50, slots: 1, avail: 3, strength: 10, vet: 'trained',
      stats: { move: 4, armorF: 1, armorS: 1, armorT: 0, optics: 4, stealth: 7, morale: 8, ecm: 0, fuel: 8, supply: 0 },
      weapons: [
        { name: 'kbk AK 突击步枪', kind: 'SMALL', pen: 2, he: 3, acc: 0.55, rmin: 0, rmax: 2, rof: 3, ammo: 40, air: false },
        { name: 'РПГ-7В', kind: 'AT', pen: 14, he: 4, acc: 0.42, rmin: 0, rmax: 2, rof: 1, ammo: 6, air: false },
        { name: 'РПК 轻机枪', kind: 'SMALL', pen: 2, he: 4, acc: 0.5, rmin: 0, rmax: 3, rof: 3, ammo: 30, air: false }
      ],
      traits: [],
      mods: ['upg_ags17', 'upg_igla_team', 'upg_dug_in'],
      transport: 'wp_ussr_btr70_tr',
      desc: '波兰人民军摩步，守住奥得河防线的炮灰与中坚。'
    },
    {
      id: 'wp_czs_motrifle', name: '捷克摩托化步兵班', short: 'ČSLA-МС', faction: 'WP', country: 'CZS',
      category: 'INF', role: '摩托化步兵', era: 1991, cost: 50, slots: 1, avail: 3, strength: 10, vet: 'trained',
      stats: { move: 4, armorF: 1, armorS: 1, armorT: 0, optics: 4, stealth: 7, morale: 8, ecm: 0, fuel: 8, supply: 0 },
      weapons: [
        { name: 'Sa vz.58 突击步枪', kind: 'SMALL', pen: 2, he: 3, acc: 0.56, rmin: 0, rmax: 2, rof: 3, ammo: 40, air: false },
        { name: 'РПГ-7В', kind: 'AT', pen: 14, he: 4, acc: 0.42, rmin: 0, rmax: 2, rof: 1, ammo: 6, air: false },
        { name: 'UK vz.59 机枪', kind: 'SMALL', pen: 2, he: 4, acc: 0.52, rmin: 0, rmax: 3, rof: 3, ammo: 30, air: false }
      ],
      traits: [],
      mods: ['upg_ags17', 'upg_igla_team', 'upg_dug_in'],
      transport: 'wp_ussr_btr80_tr',
      desc: '捷克斯洛伐克人民军摩步，苏台德山区迟滞北约。'
    },
    {
      id: 'wp_hun_motrifle', name: '匈牙利摩托化步兵班', short: 'MN-МС', faction: 'WP', country: 'HUN',
      category: 'INF', role: '摩托化步兵', era: 1991, cost: 48, slots: 1, avail: 3, strength: 10, vet: 'trained',
      stats: { move: 4, armorF: 1, armorS: 1, armorT: 0, optics: 4, stealth: 7, morale: 8, ecm: 0, fuel: 8, supply: 0 },
      weapons: [
        { name: 'AMD-65 突击步枪', kind: 'SMALL', pen: 2, he: 3, acc: 0.55, rmin: 0, rmax: 2, rof: 3, ammo: 40, air: false },
        { name: 'РПГ-7В', kind: 'AT', pen: 14, he: 4, acc: 0.42, rmin: 0, rmax: 2, rof: 1, ammo: 6, air: false },
        { name: 'РПК 轻机枪', kind: 'SMALL', pen: 2, he: 4, acc: 0.5, rmin: 0, rmax: 3, rof: 3, ammo: 30, air: false }
      ],
      traits: [],
      mods: ['upg_ags17', 'upg_igla_team', 'upg_dug_in'],
      transport: 'wp_ussr_mtlb_tr',
      desc: '匈牙利人民军摩步，多瑙河盆地与奥地利方向的守备力量。'
    },

    /* ============================================================
     * 1991 —— 装甲 (ARM)
     * ============================================================ */
    {
      id: 'wp_ussr_t64b', name: 'T-64Б 坦克连', short: 'T-64Б', faction: 'WP', country: 'USSR',
      category: 'ARM', role: '主战坦克', era: 1991, cost: 130, slots: 1, avail: 4, strength: 10, vet: 'trained',
      stats: { move: 7, armorF: 14, armorS: 7, armorT: 3, optics: 5, stealth: 3, morale: 8, ecm: 0, fuel: 9, supply: 0 },
      weapons: [
        { name: '2А46-2 125mm', kind: 'AT', pen: 19, he: 5, acc: 0.6, rmin: 0, rmax: 5, rof: 2, ammo: 36, air: false },
        { name: 'ПКТ 7.62mm', kind: 'SMALL', pen: 2, he: 3, acc: 0.5, rmin: 0, rmax: 2, rof: 3, ammo: 40, air: false }
      ],
      traits: ['smoke'],
      mods: ['upg_era_k1', 'upg_ammo_svinets', 'upg_mine_plow', 'upg_extra_ammo'],
      transport: null,
      desc: 'T-64Б坦克连，乌克兰老厂出品，火力凶猛但装甲偏薄。'
    },
    {
      id: 'wp_ussr_t72b', name: 'T-72Б 坦克连', short: 'T-72Б', faction: 'WP', country: 'USSR',
      category: 'ARM', role: '主战坦克', era: 1991, cost: 140, slots: 1, avail: 5, strength: 10, vet: 'trained',
      stats: { move: 8, armorF: 15, armorS: 7, armorT: 3, optics: 5, stealth: 3, morale: 8, ecm: 0, fuel: 9, supply: 0 },
      weapons: [
        { name: '2А46М 125mm', kind: 'AT', pen: 20, he: 5, acc: 0.6, rmin: 0, rmax: 5, rof: 2, ammo: 38, air: false },
        { name: 'ПКТ 7.62mm', kind: 'SMALL', pen: 2, he: 3, acc: 0.5, rmin: 0, rmax: 2, rof: 3, ammo: 40, air: false }
      ],
      traits: ['cheap_conscript', 'smoke'],
      mods: ['upg_era_k1', 'upg_ammo_svinets', 'upg_mine_plow', 'upg_extra_ammo', 'upg_cheap_down'],
      transport: null,
      desc: 'T-72Б坦克连，廉价耐造的钢铁洪流主力。'
    },
    {
      id: 'wp_ussr_t80b', name: 'T-80Б 坦克连', short: 'T-80Б', faction: 'WP', country: 'USSR',
      category: 'ARM', role: '主战坦克', era: 1991, cost: 150, slots: 1, avail: 4, strength: 10, vet: 'trained',
      stats: { move: 9, armorF: 16, armorS: 8, armorT: 3, optics: 5, stealth: 3, morale: 8, ecm: 0, fuel: 8, supply: 0 },
      weapons: [
        { name: '2А46М 125mm', kind: 'AT', pen: 20, he: 5, acc: 0.62, rmin: 0, rmax: 5, rof: 2, ammo: 38, air: false },
        { name: 'ПКТ 7.62mm', kind: 'SMALL', pen: 2, he: 3, acc: 0.5, rmin: 0, rmax: 2, rof: 3, ammo: 40, air: false }
      ],
      traits: ['gas_turbine', 'smoke'],
      mods: ['upg_era_k1', 'upg_ammo_svinets', 'upg_thermal_agava', 'upg_extra_ammo'],
      transport: null,
      desc: 'T-80Б坦克连，燃气轮机怒吼的高速突破矛头。'
    },
    {
      id: 'wp_ussr_t80u', name: 'T-80У 坦克连', short: 'T-80У', faction: 'WP', country: 'USSR',
      category: 'ARM', role: '主战坦克', era: 1991, cost: 170, slots: 1, avail: 3, strength: 10, vet: 'veteran',
      stats: { move: 9, armorF: 22, armorS: 11, armorT: 4, optics: 5, stealth: 3, morale: 9, ecm: 0, fuel: 8, supply: 0 },
      weapons: [
        { name: '2А46М-1 125mm', kind: 'AT', pen: 21, he: 5, acc: 0.63, rmin: 0, rmax: 5, rof: 2, ammo: 40, air: false },
        { name: 'ПКТ 7.62mm', kind: 'SMALL', pen: 2, he: 3, acc: 0.5, rmin: 0, rmax: 2, rof: 3, ammo: 40, air: false }
      ],
      traits: ['gas_turbine', 'smoke'],
      mods: ['upg_era_k5', 'upg_ammo_svinets', 'upg_thermal_agava', 'upg_shtora'],
      transport: null,
      desc: 'T-80У近卫坦克连，接触-5爆反与125mm的巅峰之作。'
    },
    {
      id: 'wp_gdr_t72m', name: '东德 T-72М 坦克连', short: 'T-72М', faction: 'WP', country: 'GDR',
      category: 'ARM', role: '主战坦克', era: 1991, cost: 125, slots: 1, avail: 3, strength: 10, vet: 'trained',
      stats: { move: 8, armorF: 13, armorS: 6, armorT: 3, optics: 5, stealth: 3, morale: 8, ecm: 0, fuel: 9, supply: 0 },
      weapons: [
        { name: '2А46 125mm', kind: 'AT', pen: 18, he: 5, acc: 0.6, rmin: 0, rmax: 5, rof: 2, ammo: 36, air: false },
        { name: 'ПКТ 7.62mm', kind: 'SMALL', pen: 2, he: 3, acc: 0.5, rmin: 0, rmax: 2, rof: 3, ammo: 40, air: false }
      ],
      traits: ['smoke'],
      mods: ['upg_era_k1', 'upg_extra_ammo', 'upg_cheap_down'],
      transport: null,
      desc: '东德T-72М，苏式坦克与德国车组纪律的结合。'
    },
    {
      id: 'wp_pol_t72m1', name: '波兰 T-72М1 坦克连', short: 'T-72М1', faction: 'WP', country: 'POL',
      category: 'ARM', role: '主战坦克', era: 1991, cost: 128, slots: 1, avail: 3, strength: 10, vet: 'trained',
      stats: { move: 8, armorF: 14, armorS: 6, armorT: 3, optics: 5, stealth: 3, morale: 8, ecm: 0, fuel: 9, supply: 0 },
      weapons: [
        { name: '2А46 125mm', kind: 'AT', pen: 18, he: 5, acc: 0.6, rmin: 0, rmax: 5, rof: 2, ammo: 36, air: false },
        { name: 'ПКТ 7.62mm', kind: 'SMALL', pen: 2, he: 3, acc: 0.5, rmin: 0, rmax: 2, rof: 3, ammo: 40, air: false }
      ],
      traits: ['smoke'],
      mods: ['upg_era_k1', 'upg_extra_ammo', 'upg_cheap_down'],
      transport: null,
      desc: '波兰T-72М1，华约西线可靠的装甲拳头。'
    },
    {
      id: 'wp_czs_t72m', name: '捷克 T-72М 坦克连', short: 'T-72М', faction: 'WP', country: 'CZS',
      category: 'ARM', role: '主战坦克', era: 1991, cost: 125, slots: 1, avail: 3, strength: 10, vet: 'trained',
      stats: { move: 8, armorF: 13, armorS: 6, armorT: 3, optics: 5, stealth: 3, morale: 8, ecm: 0, fuel: 9, supply: 0 },
      weapons: [
        { name: '2А46 125mm', kind: 'AT', pen: 18, he: 5, acc: 0.6, rmin: 0, rmax: 5, rof: 2, ammo: 36, air: false },
        { name: 'ПКТ 7.62mm', kind: 'SMALL', pen: 2, he: 3, acc: 0.5, rmin: 0, rmax: 2, rof: 3, ammo: 40, air: false }
      ],
      traits: ['smoke'],
      mods: ['upg_era_k1', 'upg_extra_ammo', 'upg_cheap_down'],
      transport: null,
      desc: '捷克T-72М，波希米亚森林里的钢铁巨兽。'
    },
    {
      id: 'wp_hun_t72m', name: '匈牙利 T-72М 坦克连', short: 'T-72М', faction: 'WP', country: 'HUN',
      category: 'ARM', role: '主战坦克', era: 1991, cost: 122, slots: 1, avail: 3, strength: 10, vet: 'trained',
      stats: { move: 8, armorF: 13, armorS: 6, armorT: 3, optics: 5, stealth: 3, morale: 8, ecm: 0, fuel: 9, supply: 0 },
      weapons: [
        { name: '2А46 125mm', kind: 'AT', pen: 18, he: 5, acc: 0.6, rmin: 0, rmax: 5, rof: 2, ammo: 36, air: false },
        { name: 'ПКТ 7.62mm', kind: 'SMALL', pen: 2, he: 3, acc: 0.5, rmin: 0, rmax: 2, rof: 3, ammo: 40, air: false }
      ],
      traits: ['smoke'],
      mods: ['upg_era_k1', 'upg_extra_ammo', 'upg_cheap_down'],
      transport: null,
      desc: '匈牙利T-72М，守卫维也纳方向的机动预备队。'
    },

    /* ============================================================
     * 1991 —— 侦察 (REC)
     * ============================================================ */
    {
      id: 'wp_ussr_brdm2', name: 'БРДМ-2 侦察分队', short: 'БРДМ-2', faction: 'WP', country: 'USSR',
      category: 'REC', role: '装甲侦察', era: 1991, cost: 55, slots: 1, avail: 4, strength: 6, vet: 'trained',
      stats: { move: 11, armorF: 2, armorS: 1, armorT: 1, optics: 9, stealth: 3, morale: 8, ecm: 0, fuel: 12, supply: 0 },
      weapons: [
        { name: 'КПВТ 14.5mm', kind: 'SMALL', pen: 3, he: 2, acc: 0.5, rmin: 0, rmax: 2, rof: 3, ammo: 45, air: false },
        { name: 'ПКТ 7.62mm', kind: 'SMALL', pen: 2, he: 3, acc: 0.5, rmin: 0, rmax: 2, rof: 3, ammo: 40, air: false }
      ],
      traits: ['recon', 'amphibious'],
      mods: ['upg_gaz_recon', 'upg_extra_ammo', 'upg_cheap_down'],
      transport: null,
      desc: 'БРДМ-2侦察分队，轻装甲四轮，钻林子探敌情。'
    },
    {
      id: 'wp_ussr_bmp2_rec', name: 'БМП-2 侦察连', short: 'БМП-2Р', faction: 'WP', country: 'USSR',
      category: 'REC', role: '装甲侦察', era: 1991, cost: 85, slots: 1, avail: 3, strength: 7, vet: 'veteran',
      stats: { move: 8, armorF: 3, armorS: 1, armorT: 1, optics: 8, stealth: 3, morale: 9, ecm: 0, fuel: 9, supply: 0 },
      weapons: [
        { name: '2А42 30mm', kind: 'HE', pen: 6, he: 5, acc: 0.55, rmin: 0, rmax: 3, rof: 3, ammo: 50, air: false },
        { name: '9М111 竞赛', kind: 'ATGM', pen: 17, he: 5, acc: 0.6, rmin: 1, rmax: 7, rof: 1, ammo: 6, air: false },
        { name: 'ПКТ 7.62mm', kind: 'SMALL', pen: 2, he: 3, acc: 0.5, rmin: 0, rmax: 2, rof: 3, ammo: 40, air: false }
      ],
      traits: ['recon', 'amphibious'],
      mods: ['upg_konkurs_m', 'upg_thermal_agava', 'upg_extra_ammo', 'upg_gaz_recon'],
      transport: null,
      desc: 'БМП-2侦察连，30mm机炮与反坦克导弹并用。'
    },

    /* ============================================================
     * 1991 —— 支援/炮兵 (SUP)
     * ============================================================ */
    {
      id: 'wp_ussr_2s1', name: '2С1「石竹」122mm 自行炮连', short: '2С1', faction: 'WP', country: 'USSR',
      category: 'SUP', role: '自行火炮', era: 1991, cost: 95, slots: 1, avail: 4, strength: 6, vet: 'trained',
      stats: { move: 8, armorF: 2, armorS: 1, armorT: 1, optics: 4, stealth: 3, morale: 8, ecm: 0, fuel: 9, supply: 0 },
      weapons: [
        { name: '2А31 122mm', kind: 'ARTY', pen: 4, he: 12, acc: 0.4, rmin: 6, rmax: 30, rof: 1, ammo: 40, air: false }
      ],
      traits: ['amphibious'],
      mods: ['upg_gaz_recon', 'upg_extra_ammo', 'upg_cheap_down', 'upg_dug_in'],
      transport: null,
      desc: '2С1「石竹」122mm自行炮连，随行火力紧跟摩步。'
    },
    {
      id: 'wp_ussr_2s3', name: '2С3「金合欢」152mm 自行炮连', short: '2С3', faction: 'WP', country: 'USSR',
      category: 'SUP', role: '自行火炮', era: 1991, cost: 125, slots: 1, avail: 4, strength: 6, vet: 'trained',
      stats: { move: 8, armorF: 2, armorS: 1, armorT: 1, optics: 4, stealth: 3, morale: 8, ecm: 0, fuel: 9, supply: 0 },
      weapons: [
        { name: '2А33 152mm', kind: 'ARTY', pen: 6, he: 14, acc: 0.4, rmin: 6, rmax: 36, rof: 1, ammo: 40, air: false }
      ],
      traits: [],
      mods: ['upg_gaz_recon', 'upg_extra_ammo', 'upg_dug_in'],
      transport: null,
      desc: '2С3「金合欢」152mm自行炮连，师属火力支柱。'
    },
    {
      id: 'wp_ussr_2s19', name: '2С19「姆斯塔」152mm 自行炮连', short: '2С19', faction: 'WP', country: 'USSR',
      category: 'SUP', role: '自行火炮', era: 1991, cost: 150, slots: 1, avail: 3, strength: 6, vet: 'trained',
      stats: { move: 8, armorF: 3, armorS: 2, armorT: 1, optics: 5, stealth: 3, morale: 8, ecm: 0, fuel: 9, supply: 0 },
      weapons: [
        { name: '2А64 152mm', kind: 'ARTY', pen: 6, he: 15, acc: 0.45, rmin: 6, rmax: 40, rof: 2, ammo: 40, air: false }
      ],
      traits: [],
      mods: ['upg_gaz_recon', 'upg_extra_ammo', 'upg_dug_in', 'upg_vet_up'],
      transport: null,
      desc: '2С19「姆斯塔」152mm自行炮连，射程与射速兼备。'
    },
    {
      id: 'wp_ussr_bm21', name: 'БМ-21「冰雹」火箭炮连', short: 'БМ-21', faction: 'WP', country: 'USSR',
      category: 'SUP', role: '多管火箭炮', era: 1991, cost: 105, slots: 1, avail: 4, strength: 6, vet: 'trained',
      stats: { move: 9, armorF: 1, armorS: 1, armorT: 1, optics: 4, stealth: 3, morale: 8, ecm: 0, fuel: 12, supply: 0 },
      weapons: [
        { name: '9М22У 122mm 火箭', kind: 'ARTY', pen: 4, he: 13, acc: 0.35, rmin: 6, rmax: 34, rof: 3, ammo: 40, air: false }
      ],
      traits: ['cluster'],
      mods: ['upg_extra_ammo', 'upg_dug_in', 'upg_cheap_down'],
      transport: null,
      desc: 'БМ-21「冰雹」火箭炮连，覆盖式齐射洗地。'
    },
    {
      id: 'wp_ussr_engineer', name: '工兵连', short: 'Сапёры', faction: 'WP', country: 'USSR',
      category: 'SUP', role: '战斗工兵', era: 1991, cost: 60, slots: 1, avail: 4, strength: 8, vet: 'trained',
      stats: { move: 4, armorF: 1, armorS: 1, armorT: 0, optics: 4, stealth: 7, morale: 8, ecm: 0, fuel: 8, supply: 0 },
      weapons: [
        { name: 'АК-74 突击步枪', kind: 'SMALL', pen: 2, he: 3, acc: 0.55, rmin: 0, rmax: 2, rof: 3, ammo: 40, air: false },
        { name: 'РПГ-7В', kind: 'AT', pen: 14, he: 4, acc: 0.42, rmin: 0, rmax: 2, rof: 1, ammo: 6, air: false }
      ],
      traits: ['engineer'],
      mods: ['upg_mine_plow', 'upg_nbc_kit', 'upg_dug_in', 'upg_rpo_a'],
      transport: null,
      desc: '工兵连，扫雷破障架桥，为坦克洪流开路。'
    },

    /* ============================================================
     * 1991 —— 防空 (AA)
     * ============================================================ */
    {
      id: 'wp_ussr_zsu234', name: 'ЗСУ-23-4「石勒喀」防空排', short: 'Шилка', faction: 'WP', country: 'USSR',
      category: 'AA', role: '自行高炮', era: 1991, cost: 75, slots: 1, avail: 4, strength: 6, vet: 'trained',
      stats: { move: 8, armorF: 2, armorS: 1, armorT: 1, optics: 5, stealth: 3, morale: 8, ecm: 0, fuel: 9, supply: 0 },
      weapons: [
        { name: '4×2А7 23mm', kind: 'AA', pen: 6, he: 4, acc: 0.55, rmin: 0, rmax: 4, rof: 4, ammo: 60, air: true }
      ],
      traits: ['radar'],
      mods: ['upg_extra_ammo', 'upg_vet_up', 'upg_cheap_down'],
      transport: null,
      desc: 'ЗСУ-23-4「石勒喀」防空排，四管23mm撕裂低空。'
    },
    {
      id: 'wp_ussr_strela10', name: '9К35「箭-10」防空排', short: 'Стрела-10', faction: 'WP', country: 'USSR',
      category: 'AA', role: '近程防空', era: 1991, cost: 80, slots: 1, avail: 4, strength: 5, vet: 'trained',
      stats: { move: 8, armorF: 2, armorS: 1, armorT: 1, optics: 5, stealth: 3, morale: 8, ecm: 0, fuel: 9, supply: 0 },
      weapons: [
        { name: '9М37 箭-10', kind: 'AA', pen: 8, he: 8, acc: 0.6, rmin: 1, rmax: 5, rof: 1, ammo: 8, air: true }
      ],
      traits: ['amphibious'],
      mods: ['upg_extra_ammo', 'upg_vet_up', 'upg_cheap_down'],
      transport: null,
      desc: '9К35「箭-10」防空排，红外导弹猎杀武装直升机。'
    },
    {
      id: 'wp_ussr_buk', name: '9К37「山毛榉」中程防空连', short: 'Бук', faction: 'WP', country: 'USSR',
      category: 'AA', role: '中程防空', era: 1991, cost: 160, slots: 1, avail: 3, strength: 5, vet: 'trained',
      stats: { move: 8, armorF: 2, armorS: 1, armorT: 1, optics: 6, stealth: 3, morale: 8, ecm: 0, fuel: 9, supply: 0 },
      weapons: [
        { name: '9М38 山毛榉', kind: 'AA', pen: 12, he: 12, acc: 0.7, rmin: 2, rmax: 12, rof: 1, ammo: 12, air: true }
      ],
      traits: ['radar'],
      mods: ['upg_extra_ammo', 'upg_vet_up', 'upg_dug_in'],
      transport: null,
      desc: '9К37「山毛榉」中程防空，撑起师级防空伞。'
    },
    {
      id: 'wp_ussr_tunguska', name: '2К22「通古斯卡」防空车', short: 'Тунгуска', faction: 'WP', country: 'USSR',
      category: 'AA', role: '弹炮合一', era: 1991, cost: 140, slots: 1, avail: 3, strength: 6, vet: 'trained',
      stats: { move: 8, armorF: 2, armorS: 1, armorT: 1, optics: 6, stealth: 3, morale: 8, ecm: 0, fuel: 9, supply: 0 },
      weapons: [
        { name: '9М311 通古斯卡', kind: 'AA', pen: 8, he: 8, acc: 0.68, rmin: 1, rmax: 6, rof: 2, ammo: 8, air: true },
        { name: '2×2А38 30mm', kind: 'AA', pen: 6, he: 5, acc: 0.6, rmin: 0, rmax: 3, rof: 3, ammo: 50, air: true }
      ],
      traits: ['radar'],
      mods: ['upg_extra_ammo', 'upg_vet_up', 'upg_dug_in'],
      transport: null,
      desc: '2К22「通古斯卡」弹炮合一，低空目标的噩梦。'
    },
    {
      id: 'wp_ussr_s300v', name: 'С-300В「安泰」远程防空连', short: 'С-300В', faction: 'WP', country: 'USSR',
      category: 'AA', role: '远程防空', era: 1991, cost: 220, slots: 1, avail: 2, strength: 4, vet: 'trained',
      stats: { move: 8, armorF: 2, armorS: 1, armorT: 1, optics: 7, stealth: 3, morale: 8, ecm: 0, fuel: 9, supply: 0 },
      weapons: [
        { name: '9М82 安泰', kind: 'AA', pen: 16, he: 16, acc: 0.75, rmin: 3, rmax: 24, rof: 1, ammo: 8, air: true }
      ],
      traits: ['radar'],
      mods: ['upg_extra_ammo', 'upg_vet_up', 'upg_dug_in'],
      transport: null,
      desc: 'С-300В「安泰」远程防空，封死北约纵深空袭。'
    },

    /* ============================================================
     * 1991 —— 直升机 (HEL)
     * ============================================================ */
    {
      id: 'wp_ussr_mi24v', name: 'Ми-24В 武装直升机', short: 'Ми-24В', faction: 'WP', country: 'USSR',
      category: 'HEL', role: '武装直升机', era: 1991, cost: 190, slots: 1, avail: 3, strength: 2, vet: 'trained',
      stats: { move: 16, armorF: 2, armorS: 1, armorT: 1, optics: 6, stealth: 3, morale: 8, ecm: 0, fuel: 8, supply: 0 },
      weapons: [
        { name: '9М114 突击', kind: 'ATGM', pen: 18, he: 6, acc: 0.65, rmin: 1, rmax: 7, rof: 2, ammo: 8, air: false },
        { name: 'УБ-32 С-5 火箭', kind: 'HE', pen: 4, he: 9, acc: 0.45, rmin: 0, rmax: 3, rof: 2, ammo: 12, air: false },
        { name: 'ЯкБ-12.7 机枪', kind: 'SMALL', pen: 3, he: 2, acc: 0.5, rmin: 0, rmax: 2, rof: 3, ammo: 40, air: false }
      ],
      traits: ['smoke'],
      mods: ['ld_atgm_heavy', 'ld_rocket_pods', 'ld_fuel_tanks'],
      transport: null,
      desc: 'Ми-24В武装直升机，飞行的步战车兼屠夫。'
    },
    {
      id: 'wp_ussr_mi24p', name: 'Ми-24П 武装直升机', short: 'Ми-24П', faction: 'WP', country: 'USSR',
      category: 'HEL', role: '武装直升机', era: 1991, cost: 205, slots: 1, avail: 3, strength: 2, vet: 'trained',
      stats: { move: 16, armorF: 2, armorS: 1, armorT: 1, optics: 6, stealth: 3, morale: 8, ecm: 0, fuel: 8, supply: 0 },
      weapons: [
        { name: 'ГШ-30-2 30mm', kind: 'HE', pen: 6, he: 5, acc: 0.55, rmin: 0, rmax: 3, rof: 3, ammo: 40, air: false },
        { name: '9М114 突击', kind: 'ATGM', pen: 18, he: 6, acc: 0.65, rmin: 1, rmax: 7, rof: 2, ammo: 8, air: false },
        { name: 'УБ-32 С-5 火箭', kind: 'HE', pen: 4, he: 9, acc: 0.45, rmin: 0, rmax: 3, rof: 2, ammo: 12, air: false }
      ],
      traits: ['smoke'],
      mods: ['ld_atgm_heavy', 'ld_rocket_pods', 'ld_fuel_tanks'],
      transport: null,
      desc: 'Ми-24П武装直升机，30mm机炮版，对地压制更强。'
    },
    {
      id: 'wp_ussr_mi28', name: 'Ми-28 早期武装直升机', short: 'Ми-28', faction: 'WP', country: 'USSR',
      category: 'HEL', role: '武装直升机', era: 1991, cost: 235, slots: 1, avail: 1, strength: 2, vet: 'veteran',
      stats: { move: 17, armorF: 3, armorS: 1, armorT: 1, optics: 7, stealth: 3, morale: 9, ecm: 1, fuel: 8, supply: 0 },
      weapons: [
        { name: '2А42 30mm', kind: 'HE', pen: 6, he: 5, acc: 0.58, rmin: 0, rmax: 3, rof: 3, ammo: 45, air: false },
        { name: '9М120 攻击-В', kind: 'ATGM', pen: 20, he: 6, acc: 0.68, rmin: 1, rmax: 7, rof: 2, ammo: 8, air: false },
        { name: 'С-8 火箭', kind: 'HE', pen: 5, he: 10, acc: 0.45, rmin: 0, rmax: 3, rof: 2, ammo: 10, air: false }
      ],
      traits: ['thermal', 'smoke'],
      mods: ['ld_atgm_heavy', 'ld_rocket_pods', 'ld_fuel_tanks'],
      transport: null,
      desc: 'Ми-28早期试验机，苏联自己的「阿帕奇」雏形。'
    },

    /* ============================================================
     * 1991 —— 固定翼 (AIR)
     * ============================================================ */
    {
      id: 'wp_ussr_su25', name: 'Су-25 攻击机架次', short: 'Су-25', faction: 'WP', country: 'USSR',
      category: 'AIR', role: '近距支援', era: 1991, cost: 170, slots: 1, avail: 3, strength: 2, vet: 'trained',
      stats: { move: 0, armorF: 2, armorS: 1, armorT: 1, optics: 5, stealth: 3, morale: 8, ecm: 1, fuel: 0, supply: 0 },
      weapons: [
        { name: '2А42 30mm', kind: 'HE', pen: 6, he: 5, acc: 0.5, rmin: 0, rmax: 3, rof: 3, ammo: 40, air: false },
        { name: 'РБК-500 集束', kind: 'BOMB', pen: 10, he: 18, acc: 0.45, rmin: 0, rmax: 2, rof: 1, ammo: 2, air: false },
        { name: 'С-8 火箭', kind: 'BOMB', pen: 6, he: 11, acc: 0.4, rmin: 0, rmax: 3, rof: 2, ammo: 4, air: false }
      ],
      traits: ['cluster'],
      mods: ['ld_rocket_pods', 'ld_cluster', 'ld_iron_bombs', 'ld_fuel_tanks'],
      transport: null,
      desc: 'Су-25攻击机架次，北约代号「蛙足」，皮糙肉厚。'
    },
    {
      id: 'wp_ussr_mig29', name: 'МиГ-29 制空机架次', short: 'МиГ-29', faction: 'WP', country: 'USSR',
      category: 'AIR', role: '制空战斗机', era: 1991, cost: 215, slots: 1, avail: 4, strength: 2, vet: 'trained',
      stats: { move: 0, armorF: 1, armorS: 1, armorT: 1, optics: 6, stealth: 3, morale: 8, ecm: 2, fuel: 0, supply: 0 },
      weapons: [
        { name: 'Р-27Р 白杨', kind: 'AA', pen: 10, he: 10, acc: 0.72, rmin: 2, rmax: 12, rof: 1, ammo: 2, air: true },
        { name: 'Р-73 箭手', kind: 'AA', pen: 8, he: 8, acc: 0.8, rmin: 1, rmax: 5, rof: 1, ammo: 2, air: true },
        { name: 'ГШ-301 30mm', kind: 'AT', pen: 6, he: 4, acc: 0.5, rmin: 0, rmax: 2, rof: 3, ammo: 30, air: false }
      ],
      traits: ['thermal'],
      mods: ['ld_aam_extra', 'ld_fuel_tanks'],
      transport: null,
      desc: 'МиГ-29制空机，中低空缠斗的利刃。'
    },
    {
      id: 'wp_ussr_su27', name: 'Су-27 制空机架次', short: 'Су-27', faction: 'WP', country: 'USSR',
      category: 'AIR', role: '制空战斗机', era: 1991, cost: 265, slots: 1, avail: 3, strength: 2, vet: 'veteran',
      stats: { move: 0, armorF: 1, armorS: 1, armorT: 1, optics: 6, stealth: 3, morale: 9, ecm: 2, fuel: 0, supply: 0 },
      weapons: [
        { name: 'Р-27ЭР 白杨', kind: 'AA', pen: 12, he: 12, acc: 0.75, rmin: 3, rmax: 14, rof: 1, ammo: 2, air: true },
        { name: 'Р-73 箭手', kind: 'AA', pen: 8, he: 8, acc: 0.8, rmin: 1, rmax: 5, rof: 1, ammo: 2, air: true },
        { name: 'ГШ-301 30mm', kind: 'AT', pen: 6, he: 4, acc: 0.5, rmin: 0, rmax: 2, rof: 3, ammo: 30, air: false }
      ],
      traits: ['thermal'],
      mods: ['ld_aam_extra', 'ld_fuel_tanks'],
      transport: null,
      desc: 'Су-27制空机，与F-15争锋的空优王牌。'
    },
    {
      id: 'wp_ussr_mig27', name: 'МиГ-27К 对地攻击机架次', short: 'МиГ-27К', faction: 'WP', country: 'USSR',
      category: 'AIR', role: '对地攻击', era: 1991, cost: 180, slots: 1, avail: 3, strength: 2, vet: 'trained',
      stats: { move: 0, armorF: 2, armorS: 1, armorT: 1, optics: 5, stealth: 3, morale: 8, ecm: 1, fuel: 0, supply: 0 },
      weapons: [
        { name: 'ГШ-6-30 30mm', kind: 'HE', pen: 6, he: 5, acc: 0.5, rmin: 0, rmax: 3, rof: 3, ammo: 35, air: false },
        { name: 'Х-25Л 激光导弹', kind: 'BOMB', pen: 18, he: 14, acc: 0.7, rmin: 1, rmax: 4, rof: 1, ammo: 2, air: false },
        { name: 'С-24 火箭', kind: 'BOMB', pen: 8, he: 12, acc: 0.4, rmin: 0, rmax: 3, rof: 1, ammo: 2, air: false }
      ],
      traits: ['laser_guided'],
      mods: ['ld_iron_bombs', 'ld_cluster', 'ld_sead_missiles', 'ld_fuel_tanks'],
      transport: null,
      desc: 'МиГ-27К对地攻击机，激光制导武器点杀堡垒。'
    },
    {
      id: 'wp_ussr_su24', name: 'Су-24 前线轰炸机架次', short: 'Су-24', faction: 'WP', country: 'USSR',
      category: 'AIR', role: '纵深打击', era: 1991, cost: 195, slots: 1, avail: 3, strength: 2, vet: 'trained',
      stats: { move: 0, armorF: 2, armorS: 1, armorT: 1, optics: 6, stealth: 3, morale: 8, ecm: 2, fuel: 0, supply: 0 },
      weapons: [
        { name: 'Х-29Л 激光导弹', kind: 'BOMB', pen: 18, he: 16, acc: 0.7, rmin: 1, rmax: 4, rof: 1, ammo: 2, air: false },
        { name: 'ФАБ-500 航弹', kind: 'BOMB', pen: 12, he: 22, acc: 0.4, rmin: 0, rmax: 1, rof: 1, ammo: 2, air: false },
        { name: 'ГШ-6-23 23mm', kind: 'HE', pen: 4, he: 4, acc: 0.5, rmin: 0, rmax: 3, rof: 3, ammo: 30, air: false }
      ],
      traits: ['laser_guided'],
      mods: ['ld_iron_bombs', 'ld_cluster', 'ld_sead_missiles', 'ld_fuel_tanks'],
      transport: null,
      desc: 'Су-24前线轰炸机，低空高速突防打击纵深。'
    },

    /* ============================================================
     * 1991 —— 后勤/指挥 (LOG)
     * ============================================================ */
    {
      id: 'wp_ussr_hq', name: '师指挥连', short: 'КП див.', faction: 'WP', country: 'USSR',
      category: 'LOG', role: '指挥', era: 1991, cost: 80, slots: 1, avail: 2, strength: 4, vet: 'veteran',
      stats: { move: 9, armorF: 2, armorS: 1, armorT: 1, optics: 5, stealth: 3, morale: 9, ecm: 0, fuel: 12, supply: 0 },
      weapons: [
        { name: 'ПКТ 7.62mm', kind: 'SMALL', pen: 2, he: 3, acc: 0.5, rmin: 0, rmax: 2, rof: 3, ammo: 30, air: false }
      ],
      traits: ['command'],
      mods: ['upg_nbc_kit', 'upg_gaz_recon', 'upg_dug_in'],
      transport: null,
      desc: '师指挥连，无线电里调度整条战线的神经中枢。'
    },
    {
      id: 'wp_ussr_supply', name: '后勤补给连', short: 'Тыл', faction: 'WP', country: 'USSR',
      category: 'LOG', role: '补给', era: 1991, cost: 45, slots: 1, avail: 3, strength: 4, vet: 'trained',
      stats: { move: 9, armorF: 1, armorS: 1, armorT: 1, optics: 3, stealth: 3, morale: 8, ecm: 0, fuel: 13, supply: 0 },
      weapons: [
        { name: 'ПКТ 7.62mm', kind: 'SMALL', pen: 2, he: 3, acc: 0.5, rmin: 0, rmax: 2, rof: 2, ammo: 30, air: false }
      ],
      traits: ['supply'],
      mods: ['upg_nbc_kit', 'upg_extra_ammo', 'upg_cheap_down'],
      transport: null,
      desc: '后勤补给连，油料与弹药沿着泥泞公路前送。'
    },

    /* ============================================================
     * 1991 —— 电子战/超限战 (EW)
     * ============================================================ */
    {
      id: 'wp_ussr_r330', name: 'Р-330「曼达特」通信干扰站', short: 'Р-330', faction: 'WP', country: 'USSR',
      category: 'EW', role: '通信干扰', era: 1991, cost: 90, slots: 1, avail: 2, strength: 4, vet: 'trained',
      stats: { move: 9, armorF: 1, armorS: 1, armorT: 1, optics: 5, stealth: 3, morale: 8, ecm: 3, fuel: 12, supply: 0 },
      weapons: [
        { name: 'ПКТ 7.62mm', kind: 'SMALL', pen: 2, he: 3, acc: 0.5, rmin: 0, rmax: 2, rof: 2, ammo: 30, air: false }
      ],
      traits: ['jammer'],
      mods: ['upg_nbc_kit', 'upg_dug_in', 'upg_extra_ammo'],
      transport: null,
      desc: 'Р-330「曼达特」通信干扰站，瘫痪北约无线电。'
    },
    {
      id: 'wp_ussr_r934', name: 'Р-934 雷达干扰站', short: 'Р-934', faction: 'WP', country: 'USSR',
      category: 'EW', role: '雷达干扰', era: 1991, cost: 95, slots: 1, avail: 2, strength: 4, vet: 'trained',
      stats: { move: 9, armorF: 1, armorS: 1, armorT: 1, optics: 6, stealth: 3, morale: 8, ecm: 3, fuel: 12, supply: 0 },
      weapons: [
        { name: 'ПКТ 7.62mm', kind: 'SMALL', pen: 2, he: 3, acc: 0.5, rmin: 0, rmax: 2, rof: 2, ammo: 30, air: false }
      ],
      traits: ['jammer', 'radar'],
      mods: ['upg_nbc_kit', 'upg_dug_in', 'upg_extra_ammo'],
      transport: null,
      desc: 'Р-934雷达干扰站，让北约火控雷达变瞎。'
    },
    {
      id: 'wp_ussr_osnova', name: '「奥斯诺瓦」电子侦察连', short: 'Основа', faction: 'WP', country: 'USSR',
      category: 'EW', role: '电子侦察', era: 1991, cost: 85, slots: 1, avail: 2, strength: 4, vet: 'veteran',
      stats: { move: 9, armorF: 1, armorS: 1, armorT: 1, optics: 8, stealth: 3, morale: 9, ecm: 2, fuel: 12, supply: 0 },
      weapons: [
        { name: 'ПКТ 7.62mm', kind: 'SMALL', pen: 2, he: 3, acc: 0.5, rmin: 0, rmax: 2, rof: 2, ammo: 30, air: false }
      ],
      traits: ['sigint', 'recon', 'radar'],
      mods: ['upg_nbc_kit', 'upg_dug_in', 'upg_gaz_recon'],
      transport: null,
      desc: '「奥斯诺瓦」电子侦察连，监听北约通信揭示敌情。'
    },
    {
      id: 'wp_ussr_psyops', name: '心理战广播连', short: 'Проп.', faction: 'WP', country: 'USSR',
      category: 'EW', role: '心理战', era: 1991, cost: 70, slots: 1, avail: 2, strength: 4, vet: 'trained',
      stats: { move: 9, armorF: 1, armorS: 1, armorT: 1, optics: 4, stealth: 3, morale: 8, ecm: 0, fuel: 12, supply: 0 },
      weapons: [
        { name: 'ПКТ 7.62mm', kind: 'SMALL', pen: 2, he: 3, acc: 0.5, rmin: 0, rmax: 2, rof: 2, ammo: 30, air: false }
      ],
      traits: ['psyops'],
      mods: ['upg_nbc_kit', 'upg_dug_in', 'upg_cheap_down'],
      transport: null,
      desc: '心理战广播连，扩音器里的劝降与恐慌。'
    },
    {
      id: 'wp_ussr_decoy', name: '充气假目标/欺骗分队', short: 'Муляж', faction: 'WP', country: 'USSR',
      category: 'EW', role: '欺骗', era: 1991, cost: 45, slots: 1, avail: 3, strength: 4, vet: 'trained',
      stats: { move: 9, armorF: 0, armorS: 0, armorT: 0, optics: 3, stealth: 4, morale: 8, ecm: 0, fuel: 12, supply: 0 },
      weapons: [
        { name: 'ПКМ 7.62mm', kind: 'SMALL', pen: 2, he: 3, acc: 0.45, rmin: 0, rmax: 2, rof: 2, ammo: 20, air: false }
      ],
      traits: ['decoy'],
      mods: ['upg_cheap_down', 'upg_dug_in', 'upg_nbc_kit'],
      transport: null,
      desc: '充气假坦克与伪装分队，诱骗北约火力与侦察。'
    },
    {
      id: 'wp_ussr_mi8ppa', name: 'Ми-8ППА 电子战直升机', short: 'Ми-8ППА', faction: 'WP', country: 'USSR',
      category: 'EW', role: '机载干扰', era: 1991, cost: 120, slots: 1, avail: 2, strength: 2, vet: 'trained',
      stats: { move: 15, armorF: 1, armorS: 1, armorT: 1, optics: 6, stealth: 3, morale: 8, ecm: 3, fuel: 8, supply: 0 },
      weapons: [
        { name: 'ПКТ 7.62mm 门枪', kind: 'SMALL', pen: 2, he: 3, acc: 0.45, rmin: 0, rmax: 2, rof: 2, ammo: 30, air: false }
      ],
      traits: ['jammer', 'radar'],
      mods: ['ld_fuel_tanks', 'upg_extra_ammo', 'upg_nbc_kit'],
      transport: null,
      desc: 'Ми-8ППА电子战直升机，机载干扰舱遮蔽编队。'
    },

    /* ============================================================
     * 1994 —— 推演组：冷战延续、苏联多活几年的量产装备
     * ============================================================ */
    {
      id: 'wp_ussr_t90', name: 'T-72БУ/早期 T-90 坦克连', short: 'T-72БУ', faction: 'WP', country: 'USSR',
      category: 'ARM', role: '主战坦克', era: 1994, cost: 175, slots: 1, avail: 2, strength: 10, vet: 'veteran',
      stats: { move: 8, armorF: 21, armorS: 11, armorT: 4, optics: 6, stealth: 3, morale: 9, ecm: 2, fuel: 9, supply: 0 },
      weapons: [
        { name: '2А46М-4 125mm', kind: 'AT', pen: 22, he: 5, acc: 0.65, rmin: 0, rmax: 5, rof: 2, ammo: 40, air: false },
        { name: 'ПКТ 7.62mm', kind: 'SMALL', pen: 2, he: 3, acc: 0.5, rmin: 0, rmax: 2, rof: 3, ammo: 40, air: false }
      ],
      traits: ['smoke'],
      mods: ['upg_era_k5', 'upg_ammo_svinets', 'upg_thermal_agava', 'upg_shtora', 'upg_arena'],
      transport: null,
      desc: 'T-72БУ/早期T-90，1994推演中换装新弹与Штора的量产型。'
    },
    {
      id: 'wp_ussr_t80um1', name: 'T-80УМ1「豹」坦克连', short: 'T-80УМ1', faction: 'WP', country: 'USSR',
      category: 'ARM', role: '主战坦克', era: 1994, cost: 200, slots: 1, avail: 1, strength: 10, vet: 'elite',
      stats: { move: 9, armorF: 24, armorS: 12, armorT: 4, optics: 7, stealth: 3, morale: 10, ecm: 3, fuel: 8, supply: 0 },
      weapons: [
        { name: '2А46М-1 125mm', kind: 'AT', pen: 23, he: 5, acc: 0.68, rmin: 0, rmax: 5, rof: 2, ammo: 40, air: false },
        { name: 'ПКТ 7.62mm', kind: 'SMALL', pen: 2, he: 3, acc: 0.5, rmin: 0, rmax: 2, rof: 3, ammo: 40, air: false }
      ],
      traits: ['gas_turbine', 'thermal', 'smoke'],
      mods: ['upg_era_k5', 'upg_ammo_svinets', 'upg_thermal_agava', 'upg_shtora', 'upg_arena'],
      transport: null,
      desc: 'T-80УМ1「豹」坦克连，主动防护与热像仪的终极T-80。'
    },
    {
      id: 'wp_ussr_obj187', name: 'Объект 187 原型坦克连', short: 'Объект 187', faction: 'WP', country: 'USSR',
      category: 'ARM', role: '主战坦克', era: 1994, cost: 190, slots: 1, avail: 1, strength: 10, vet: 'veteran',
      stats: { move: 8, armorF: 23, armorS: 11, armorT: 4, optics: 6, stealth: 3, morale: 9, ecm: 1, fuel: 9, supply: 0 },
      weapons: [
        { name: '2А66 125mm', kind: 'AT', pen: 23, he: 5, acc: 0.66, rmin: 0, rmax: 5, rof: 2, ammo: 38, air: false },
        { name: 'ПКТ 7.62mm', kind: 'SMALL', pen: 2, he: 3, acc: 0.5, rmin: 0, rmax: 2, rof: 3, ammo: 40, air: false }
      ],
      traits: ['smoke'],
      mods: ['upg_era_k5', 'upg_ammo_svinets', 'upg_thermal_agava', 'upg_arena'],
      transport: null,
      desc: 'Объект 187原型坦克，1994推演中小批量列装的试验品。'
    },
    {
      id: 'wp_ussr_bmpt', name: 'БМПТ 早期概念车', short: 'БМПТ', faction: 'WP', country: 'USSR',
      category: 'ARM', role: '坦克护卫车', era: 1994, cost: 180, slots: 1, avail: 1, strength: 8, vet: 'veteran',
      stats: { move: 8, armorF: 12, armorS: 8, armorT: 4, optics: 6, stealth: 3, morale: 9, ecm: 1, fuel: 9, supply: 0 },
      weapons: [
        { name: '2×2А42 30mm', kind: 'HE', pen: 6, he: 5, acc: 0.58, rmin: 0, rmax: 3, rof: 4, ammo: 60, air: false },
        { name: '9М120 攻击', kind: 'ATGM', pen: 20, he: 6, acc: 0.65, rmin: 1, rmax: 7, rof: 1, ammo: 8, air: false },
        { name: 'АГС-17 30mm', kind: 'HE', pen: 3, he: 10, acc: 0.5, rmin: 0, rmax: 3, rof: 3, ammo: 30, air: false }
      ],
      traits: ['thermal', 'smoke'],
      mods: ['upg_era_k5', 'upg_thermal_agava', 'upg_arena', 'upg_extra_ammo'],
      transport: null,
      desc: 'БМПТ早期概念车，双30mm炮与导弹的坦克护卫。'
    },

    {
      id: 'wp_ussr_motrifle_94', name: 'БМП-3 摩步连', short: 'БМП-3 МС', faction: 'WP', country: 'USSR',
      category: 'INF', role: '机械化步兵', era: 1994, cost: 62, slots: 1, avail: 4, strength: 10, vet: 'trained',
      stats: { move: 4, armorF: 1, armorS: 1, armorT: 0, optics: 5, stealth: 7, morale: 8, ecm: 0, fuel: 8, supply: 0 },
      weapons: [
        { name: 'АК-74М 突击步枪', kind: 'SMALL', pen: 2, he: 3, acc: 0.56, rmin: 0, rmax: 2, rof: 3, ammo: 40, air: false },
        { name: 'РПГ-7В', kind: 'AT', pen: 14, he: 4, acc: 0.45, rmin: 0, rmax: 2, rof: 1, ammo: 8, air: false },
        { name: 'РПК-74 轻机枪', kind: 'SMALL', pen: 2, he: 4, acc: 0.52, rmin: 0, rmax: 3, rof: 3, ammo: 30, air: false }
      ],
      traits: ['shock'],
      mods: ['upg_rpo_a', 'upg_ags17', 'upg_igla_team', 'upg_dug_in'],
      transport: 'wp_ussr_bmp3_tr',
      desc: 'БМП-3摩步连，100mm炮与炮射导弹让北约步战车胆寒。'
    },

    {
      id: 'wp_ussr_2s31', name: '2С31「维也纳」120mm 自行迫榴炮连', short: '2С31', faction: 'WP', country: 'USSR',
      category: 'SUP', role: '自行迫榴炮', era: 1994, cost: 140, slots: 1, avail: 2, strength: 6, vet: 'trained',
      stats: { move: 8, armorF: 3, armorS: 2, armorT: 1, optics: 5, stealth: 3, morale: 8, ecm: 0, fuel: 9, supply: 0 },
      weapons: [
        { name: '2А80 120mm', kind: 'ARTY', pen: 5, he: 13, acc: 0.45, rmin: 6, rmax: 28, rof: 2, ammo: 36, air: false }
      ],
      traits: ['amphibious'],
      mods: ['upg_gaz_recon', 'upg_extra_ammo', 'upg_dug_in'],
      transport: null,
      desc: '2С31「维也纳」120mm自行迫榴炮，快打快撤。'
    },
    {
      id: 'wp_ussr_tos1', name: 'ТОС-1 温压火箭连', short: 'ТОС-1', faction: 'WP', country: 'USSR',
      category: 'SUP', role: '温压火箭炮', era: 1994, cost: 190, slots: 1, avail: 1, strength: 5, vet: 'trained',
      stats: { move: 8, armorF: 3, armorS: 2, armorT: 1, optics: 4, stealth: 3, morale: 8, ecm: 0, fuel: 9, supply: 0 },
      weapons: [
        { name: 'МО.1.01.04 温压火箭', kind: 'ARTY', pen: 8, he: 20, acc: 0.4, rmin: 6, rmax: 8, rof: 1, ammo: 24, air: false }
      ],
      traits: ['thermobaric'],
      mods: ['upg_extra_ammo', 'upg_dug_in', 'upg_nbc_kit'],
      transport: null,
      desc: 'ТОС-1温压火箭连，把整个街区烧成白地。'
    },

    {
      id: 'wp_ussr_s300vm', name: 'С-300ВМ「安泰-2500」远程防空连', short: 'С-300ВМ', faction: 'WP', country: 'USSR',
      category: 'AA', role: '远程防空', era: 1994, cost: 220, slots: 1, avail: 1, strength: 4, vet: 'veteran',
      stats: { move: 8, armorF: 2, armorS: 1, armorT: 1, optics: 7, stealth: 3, morale: 9, ecm: 1, fuel: 9, supply: 0 },
      weapons: [
        { name: '9М82М 安泰', kind: 'AA', pen: 18, he: 18, acc: 0.78, rmin: 3, rmax: 24, rof: 1, ammo: 8, air: true }
      ],
      traits: ['radar'],
      mods: ['upg_extra_ammo', 'upg_vet_up', 'upg_dug_in'],
      transport: null,
      desc: 'С-300ВМ「安泰-2500」，1994推演中的弹道导弹克星。'
    },
    {
      id: 'wp_ussr_tunguska_m1', name: '通古斯卡-М1 防空车', short: 'Тунг-М1', faction: 'WP', country: 'USSR',
      category: 'AA', role: '弹炮合一', era: 1994, cost: 160, slots: 1, avail: 2, strength: 6, vet: 'veteran',
      stats: { move: 8, armorF: 2, armorS: 1, armorT: 1, optics: 7, stealth: 3, morale: 9, ecm: 1, fuel: 9, supply: 0 },
      weapons: [
        { name: '9М311-1М 通古斯卡', kind: 'AA', pen: 9, he: 9, acc: 0.72, rmin: 1, rmax: 6, rof: 2, ammo: 8, air: true },
        { name: '2×2А38М 30mm', kind: 'AA', pen: 6, he: 5, acc: 0.62, rmin: 0, rmax: 3, rof: 3, ammo: 50, air: true }
      ],
      traits: ['radar'],
      mods: ['upg_extra_ammo', 'upg_vet_up', 'upg_dug_in'],
      transport: null,
      desc: '通古斯卡-М1，升级火控后能拦超低空巡航导弹。'
    },

    {
      id: 'wp_ussr_ka50', name: 'Ка-50「黑鲨」量产型武直', short: 'Ка-50', faction: 'WP', country: 'USSR',
      category: 'HEL', role: '武装直升机', era: 1994, cost: 245, slots: 1, avail: 1, strength: 2, vet: 'elite',
      stats: { move: 17, armorF: 3, armorS: 1, armorT: 1, optics: 7, stealth: 3, morale: 10, ecm: 2, fuel: 8, supply: 0 },
      weapons: [
        { name: '9К121 旋风', kind: 'ATGM', pen: 22, he: 6, acc: 0.72, rmin: 1, rmax: 8, rof: 2, ammo: 12, air: false },
        { name: '2А42 30mm', kind: 'HE', pen: 6, he: 5, acc: 0.58, rmin: 0, rmax: 3, rof: 3, ammo: 45, air: false },
        { name: 'С-8 火箭', kind: 'HE', pen: 5, he: 10, acc: 0.45, rmin: 0, rmax: 3, rof: 2, ammo: 10, air: false }
      ],
      traits: ['thermal', 'smoke'],
      mods: ['ld_atgm_heavy', 'ld_rocket_pods', 'ld_fuel_tanks', 'ld_aam_extra'],
      transport: null,
      desc: 'Ка-50「黑鲨」量产型，单座共轴武直的惊世之作。'
    },
    {
      id: 'wp_ussr_mi28a', name: 'Ми-28А 量产型武直', short: 'Ми-28А', faction: 'WP', country: 'USSR',
      category: 'HEL', role: '武装直升机', era: 1994, cost: 250, slots: 1, avail: 2, strength: 2, vet: 'veteran',
      stats: { move: 17, armorF: 3, armorS: 1, armorT: 1, optics: 7, stealth: 3, morale: 9, ecm: 1, fuel: 8, supply: 0 },
      weapons: [
        { name: '9М120 攻击-В', kind: 'ATGM', pen: 20, he: 6, acc: 0.7, rmin: 1, rmax: 7, rof: 2, ammo: 10, air: false },
        { name: '2А42 30mm', kind: 'HE', pen: 6, he: 5, acc: 0.6, rmin: 0, rmax: 3, rof: 3, ammo: 45, air: false },
        { name: 'С-8 火箭', kind: 'HE', pen: 5, he: 10, acc: 0.48, rmin: 0, rmax: 3, rof: 2, ammo: 10, air: false }
      ],
      traits: ['thermal', 'smoke'],
      mods: ['ld_atgm_heavy', 'ld_rocket_pods', 'ld_fuel_tanks', 'ld_aam_extra'],
      transport: null,
      desc: 'Ми-28А量产型，米里设计局的「夜间猎手」。'
    },

    {
      id: 'wp_ussr_su27m', name: 'Су-27М 多用途制空机架次', short: 'Су-27М', faction: 'WP', country: 'USSR',
      category: 'AIR', role: '多用途战斗机', era: 1994, cost: 300, slots: 1, avail: 1, strength: 2, vet: 'elite',
      stats: { move: 0, armorF: 1, armorS: 1, armorT: 1, optics: 7, stealth: 3, morale: 10, ecm: 3, fuel: 0, supply: 0 },
      weapons: [
        { name: 'Р-27ЭМ 白杨', kind: 'AA', pen: 13, he: 13, acc: 0.78, rmin: 3, rmax: 14, rof: 1, ammo: 3, air: true },
        { name: 'Р-73 箭手', kind: 'AA', pen: 8, he: 8, acc: 0.82, rmin: 1, rmax: 5, rof: 1, ammo: 2, air: true },
        { name: 'Х-29Л 激光导弹', kind: 'BOMB', pen: 18, he: 16, acc: 0.72, rmin: 1, rmax: 4, rof: 1, ammo: 2, air: false }
      ],
      traits: ['thermal', 'laser_guided'],
      mods: ['ld_aam_extra', 'ld_fuel_tanks', 'ld_cluster'],
      transport: null,
      desc: 'Су-27М，Су-35前身，1994推演中的多用途空优机。'
    },
    {
      id: 'wp_ussr_mig31m', name: 'МиГ-31М 高空截击机架次', short: 'МиГ-31М', faction: 'WP', country: 'USSR',
      category: 'AIR', role: '高空截击', era: 1994, cost: 280, slots: 1, avail: 1, strength: 2, vet: 'elite',
      stats: { move: 0, armorF: 1, armorS: 1, armorT: 1, optics: 7, stealth: 3, morale: 10, ecm: 3, fuel: 0, supply: 0 },
      weapons: [
        { name: 'Р-37 远程空空导弹', kind: 'AA', pen: 16, he: 16, acc: 0.72, rmin: 4, rmax: 20, rof: 1, ammo: 2, air: true },
        { name: 'Р-73 箭手', kind: 'AA', pen: 8, he: 8, acc: 0.8, rmin: 1, rmax: 5, rof: 1, ammo: 2, air: true },
        { name: 'ГШ-6-23 23mm', kind: 'AT', pen: 4, he: 4, acc: 0.5, rmin: 0, rmax: 2, rof: 3, ammo: 30, air: false }
      ],
      traits: ['thermal', 'radar'],
      mods: ['ld_aam_extra', 'ld_fuel_tanks'],
      transport: null,
      desc: 'МиГ-31М高空截击机，猎杀北约侦察机与巡航导弹。'
    },
    {
      id: 'wp_ussr_mig29m', name: 'МиГ-29М 多用途机架次', short: 'МиГ-29М', faction: 'WP', country: 'USSR',
      category: 'AIR', role: '多用途战斗机', era: 1994, cost: 250, slots: 1, avail: 2, strength: 2, vet: 'veteran',
      stats: { move: 0, armorF: 1, armorS: 1, armorT: 1, optics: 6, stealth: 3, morale: 9, ecm: 2, fuel: 0, supply: 0 },
      weapons: [
        { name: 'Р-27Р 白杨', kind: 'AA', pen: 10, he: 10, acc: 0.74, rmin: 2, rmax: 12, rof: 1, ammo: 2, air: true },
        { name: 'Р-73 箭手', kind: 'AA', pen: 8, he: 8, acc: 0.8, rmin: 1, rmax: 5, rof: 1, ammo: 2, air: true },
        { name: 'Х-29Л 激光导弹', kind: 'BOMB', pen: 18, he: 16, acc: 0.7, rmin: 1, rmax: 4, rof: 1, ammo: 2, air: false }
      ],
      traits: ['thermal', 'laser_guided'],
      mods: ['ld_aam_extra', 'ld_fuel_tanks', 'ld_cluster'],
      transport: null,
      desc: 'МиГ-29М，全面升级的支点，多用途化改型。'
    },
    {
      id: 'wp_ussr_su39', name: 'Су-39/Су-25ТМ 攻击机架次', short: 'Су-39', faction: 'WP', country: 'USSR',
      category: 'AIR', role: '反装甲攻击', era: 1994, cost: 230, slots: 1, avail: 2, strength: 2, vet: 'veteran',
      stats: { move: 0, armorF: 2, armorS: 1, armorT: 1, optics: 6, stealth: 3, morale: 9, ecm: 2, fuel: 0, supply: 0 },
      weapons: [
        { name: '9К121 旋风', kind: 'ATGM', pen: 22, he: 6, acc: 0.72, rmin: 1, rmax: 8, rof: 2, ammo: 8, air: false },
        { name: 'КАБ-500Кр 电视制导', kind: 'BOMB', pen: 22, he: 18, acc: 0.75, rmin: 0, rmax: 2, rof: 1, ammo: 2, air: false },
        { name: '2А42 30mm', kind: 'HE', pen: 6, he: 5, acc: 0.52, rmin: 0, rmax: 3, rof: 3, ammo: 40, air: false }
      ],
      traits: ['laser_guided', 'thermal'],
      mods: ['ld_atgm_heavy', 'ld_cluster', 'ld_rocket_pods', 'ld_fuel_tanks'],
      transport: null,
      desc: 'Су-39/Су-25ТМ，挂КАБ-500Кр精确弹药的坦克杀手。'
    },

    {
      id: 'wp_ussr_su24mp', name: 'Су-24МП 电子战型架次', short: 'Су-24МП', faction: 'WP', country: 'USSR',
      category: 'EW', role: '电子战飞机', era: 1994, cost: 210, slots: 1, avail: 1, strength: 2, vet: 'veteran',
      stats: { move: 0, armorF: 2, armorS: 1, armorT: 1, optics: 6, stealth: 3, morale: 9, ecm: 4, fuel: 0, supply: 0 },
      weapons: [
        { name: 'Х-58 反辐射导弹', kind: 'BOMB', pen: 16, he: 14, acc: 0.72, rmin: 1, rmax: 6, rof: 1, ammo: 2, air: false },
        { name: 'ГШ-6-23 23mm', kind: 'HE', pen: 4, he: 4, acc: 0.5, rmin: 0, rmax: 3, rof: 3, ammo: 30, air: false }
      ],
      traits: ['sead', 'jammer', 'sigint'],
      mods: ['ld_sead_missiles', 'ld_fuel_tanks', 'ld_aam_extra'],
      transport: null,
      desc: 'Су-24МП电子战型，反辐射导弹压制北约防空。'
    },
    {
      id: 'wp_ussr_vympel', name: '「勇士」特战核破坏组', short: 'Вымпел', faction: 'WP', country: 'USSR',
      category: 'EW', role: '特种核破坏', era: 1994, cost: 140, slots: 1, avail: 1, strength: 8, vet: 'elite',
      stats: { move: 4, armorF: 0, armorS: 0, armorT: 0, optics: 8, stealth: 9, morale: 10, ecm: 0, fuel: 8, supply: 0 },
      weapons: [
        { name: 'АКС-74У 短突击步枪', kind: 'SMALL', pen: 2, he: 3, acc: 0.6, rmin: 0, rmax: 2, rof: 3, ammo: 35, air: false },
        { name: 'СВД 狙击步枪', kind: 'SMALL', pen: 3, he: 3, acc: 0.7, rmin: 0, rmax: 4, rof: 1, ammo: 12, air: false },
        { name: 'РПГ-22 单兵火箭', kind: 'AT', pen: 16, he: 4, acc: 0.5, rmin: 0, rmax: 2, rof: 1, ammo: 4, air: false }
      ],
      traits: ['spec_ops', 'recon', 'sniper', 'nuke_capable', 'airborne'],
      mods: ['upg_nbc_kit', 'upg_vet_up', 'upg_rpo_a', 'upg_igla_team'],
      transport: null,
      desc: '「勇士」特战核破坏组，渗透敌后执行核爆破任务。'
    }
  ];
})();
