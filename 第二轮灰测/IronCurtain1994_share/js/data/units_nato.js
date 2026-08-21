/* 铁幕1994 — 北约单位卡数据库 */
(function () {
  window.DATA_UNITS_NATO = [

    /* =========================================================
     * TR 运输载具（只作步兵 transport 引用，不出现在卡组面板）
     * ========================================================= */
    {
      id: 'nato_usa_m2a2_tr', name: 'M2A2 布雷德利步战车(运输)', short: 'M2A2',
      faction: 'NATO', country: 'USA', category: 'TR', role: '步兵运输车', era: 1991,
      cost: 30, slots: 1, avail: 6, strength: 6, vet: 'trained',
      stats: { move: 8, armorF: 5, armorS: 2, armorT: 1, optics: 5, stealth: 3, morale: 8, ecm: 0, fuel: 8, supply: 0 },
      weapons: [
        { name: 'M242 25mm 机关炮', kind: 'AT', pen: 6, he: 4, acc: 0.6, rmin: 0, rmax: 4, rof: 3, ammo: 40, air: false },
        { name: 'BGM-71 TOW-2', kind: 'ATGM', pen: 20, he: 6, acc: 0.62, rmin: 1, rmax: 7, rof: 1, ammo: 6, air: false }
      ],
      traits: ['thermal'], mods: ['upg_tow2b', 'upg_thermal_2gen', 'upg_tusk_bar'], transport: null,
      desc: '履带化步兵的标准座驾，边运兵边反装甲。'
    },
    {
      id: 'nato_usa_m113a3_tr', name: 'M113A3 装甲输送车(运输)', short: 'M113A3',
      faction: 'NATO', country: 'USA', category: 'TR', role: '步兵运输车', era: 1991,
      cost: 20, slots: 1, avail: 7, strength: 6, vet: 'trained',
      stats: { move: 8, armorF: 3, armorS: 1, armorT: 1, optics: 4, stealth: 3, morale: 8, ecm: 0, fuel: 8, supply: 0 },
      weapons: [
        { name: 'M2HB 12.7mm', kind: 'SMALL', pen: 3, he: 3, acc: 0.55, rmin: 0, rmax: 3, rof: 2, ammo: 60, air: false }
      ],
      traits: [], mods: ['upg_tusk_bar', 'upg_nbc_kit', 'upg_extra_ammo'], transport: null,
      desc: '冷战老兵，皮薄但便宜，装满欧洲每一条公路。'
    },
    {
      id: 'nato_usa_hmmwv_tr', name: 'M998 悍马运输车(运输)', short: '悍马',
      faction: 'NATO', country: 'USA', category: 'TR', role: '轻型运输车', era: 1991,
      cost: 10, slots: 1, avail: 8, strength: 4, vet: 'trained',
      stats: { move: 12, armorF: 1, armorS: 1, armorT: 0, optics: 4, stealth: 4, morale: 8, ecm: 0, fuel: 9, supply: 0 },
      weapons: [
        { name: 'M2HB 12.7mm', kind: 'SMALL', pen: 3, he: 3, acc: 0.55, rmin: 0, rmax: 3, rof: 2, ammo: 50, air: false }
      ],
      traits: [], mods: ['upg_mk19', 'upg_extra_ammo', 'upg_dug_in'], transport: null,
      desc: '四处漏风却无处不在的轻骑兵座驾。'
    },
    {
      id: 'nato_usa_uh60_tr', name: 'UH-60 黑鹰机降运输(运输)', short: 'UH-60',
      faction: 'NATO', country: 'USA', category: 'TR', role: '直升机机降', era: 1991,
      cost: 45, slots: 1, avail: 4, strength: 3, vet: 'trained',
      stats: { move: 16, armorF: 1, armorS: 1, armorT: 1, optics: 6, stealth: 3, morale: 8, ecm: 1, fuel: 11, supply: 0 },
      weapons: [
        { name: 'M240 舱门机枪', kind: 'SMALL', pen: 3, he: 3, acc: 0.55, rmin: 0, rmax: 2, rof: 2, ammo: 40, air: false }
      ],
      traits: ['heliborne'], mods: ['ld_rocket_pods', 'ld_fuel_tanks', 'upg_dug_in'], transport: null,
      desc: '把空降兵送进核污染区后方的唯一办法。'
    },
    {
      id: 'nato_frg_marder_tr', name: '黄鼠狼1A3 步战车(运输)', short: '黄鼠狼',
      faction: 'NATO', country: 'FRG', category: 'TR', role: '步兵运输车', era: 1991,
      cost: 25, slots: 1, avail: 6, strength: 6, vet: 'trained',
      stats: { move: 8, armorF: 4, armorS: 2, armorT: 1, optics: 5, stealth: 3, morale: 8, ecm: 0, fuel: 8, supply: 0 },
      weapons: [
        { name: 'Rh-202 20mm', kind: 'AT', pen: 5, he: 4, acc: 0.6, rmin: 0, rmax: 4, rof: 3, ammo: 60, air: false },
        { name: 'MILAN 反坦克导弹', kind: 'ATGM', pen: 16, he: 5, acc: 0.6, rmin: 1, rmax: 6, rof: 1, ammo: 4, air: false }
      ],
      traits: [], mods: ['upg_thermal_2gen', 'upg_tusk_bar', 'upg_extra_ammo'], transport: null,
      desc: '西德钢铁洪流的第一道防线载具。'
    },
    {
      id: 'nato_frg_fuchs_tr', name: '狐式6x6 装甲车(运输)', short: '狐式',
      faction: 'NATO', country: 'FRG', category: 'TR', role: '装甲运输车', era: 1991,
      cost: 15, slots: 1, avail: 7, strength: 5, vet: 'trained',
      stats: { move: 11, armorF: 2, armorS: 1, armorT: 1, optics: 4, stealth: 3, morale: 8, ecm: 0, fuel: 9, supply: 0 },
      weapons: [
        { name: 'MG3 7.62mm', kind: 'SMALL', pen: 3, he: 3, acc: 0.55, rmin: 0, rmax: 3, rof: 3, ammo: 60, air: false }
      ],
      traits: ['amphibious', 'nbc'], mods: ['upg_nbc_kit', 'upg_extra_ammo', 'upg_dug_in'], transport: null,
      desc: '三防轮式车，核生化侦察与运兵两不误。'
    },
    {
      id: 'nato_uk_warrior_tr', name: 'FV510 武士步战车(运输)', short: '武士',
      faction: 'NATO', country: 'UK', category: 'TR', role: '步兵运输车', era: 1991,
      cost: 25, slots: 1, avail: 6, strength: 6, vet: 'trained',
      stats: { move: 8, armorF: 4, armorS: 2, armorT: 1, optics: 5, stealth: 3, morale: 8, ecm: 0, fuel: 8, supply: 0 },
      weapons: [
        { name: 'RARDEN 30mm', kind: 'AT', pen: 6, he: 4, acc: 0.6, rmin: 0, rmax: 4, rof: 3, ammo: 50, air: false }
      ],
      traits: [], mods: ['upg_thermal_2gen', 'upg_tusk_bar', 'upg_extra_ammo'], transport: null,
      desc: '莱茵军团步兵的装甲客车，能顶轻武器火力。'
    },
    {
      id: 'nato_fra_vab_tr', name: 'VAB 装甲运输车(运输)', short: 'VAB',
      faction: 'NATO', country: 'FRA', category: 'TR', role: '轮式运输车', era: 1991,
      cost: 15, slots: 1, avail: 7, strength: 5, vet: 'trained',
      stats: { move: 11, armorF: 3, armorS: 1, armorT: 1, optics: 4, stealth: 3, morale: 8, ecm: 0, fuel: 9, supply: 0 },
      weapons: [
        { name: 'M2HB 12.7mm', kind: 'SMALL', pen: 3, he: 3, acc: 0.55, rmin: 0, rmax: 3, rof: 2, ammo: 60, air: false }
      ],
      traits: ['amphibious'], mods: ['upg_mk19', 'upg_nbc_kit', 'upg_extra_ammo'], transport: null,
      desc: '法国外籍军团与轻步兵的轮式巴士。'
    },

    /* =========================================================
     * 1991 组 — 美国（USA）
     * ========================================================= */
    {
      id: 'nato_usa_mech_inf', name: '机械化步兵连', short: '机步连',
      faction: 'NATO', country: 'USA', category: 'INF', role: '机械化步兵', era: 1991,
      cost: 45, slots: 1, avail: 6, strength: 12, vet: 'trained',
      stats: { move: 4, armorF: 1, armorS: 1, armorT: 0, optics: 4, stealth: 6, morale: 8, ecm: 0, fuel: 0, supply: 0 },
      weapons: [
        { name: 'M16A2 步枪', kind: 'SMALL', pen: 3, he: 4, acc: 0.6, rmin: 0, rmax: 2, rof: 2, ammo: 80, air: false },
        { name: 'M249 班用机枪', kind: 'SMALL', pen: 3, he: 4, acc: 0.6, rmin: 0, rmax: 3, rof: 3, ammo: 60, air: false },
        { name: 'M136 AT4', kind: 'AT', pen: 13, he: 4, acc: 0.55, rmin: 0, rmax: 2, rof: 1, ammo: 6, air: false }
      ],
      traits: [], mods: ['upg_dragon', 'upg_mk19', 'upg_stinger_team'], transport: 'nato_usa_m2a2_tr',
      desc: '跨大西洋增援船团卸下的第一个整编营。'
    },
    {
      id: 'nato_usa_82nd', name: '第82空降师伞兵连', short: '第82空降',
      faction: 'NATO', country: 'USA', category: 'INF', role: '空降步兵', era: 1991,
      cost: 50, slots: 1, avail: 5, strength: 10, vet: 'veteran',
      stats: { move: 4, armorF: 1, armorS: 1, armorT: 0, optics: 5, stealth: 7, morale: 9, ecm: 0, fuel: 0, supply: 0 },
      weapons: [
        { name: 'M16A2 步枪', kind: 'SMALL', pen: 3, he: 4, acc: 0.62, rmin: 0, rmax: 2, rof: 2, ammo: 80, air: false },
        { name: 'M249 班用机枪', kind: 'SMALL', pen: 3, he: 4, acc: 0.62, rmin: 0, rmax: 3, rof: 3, ammo: 60, air: false },
        { name: 'M136 AT4', kind: 'AT', pen: 13, he: 4, acc: 0.55, rmin: 0, rmax: 2, rof: 1, ammo: 6, air: false }
      ],
      traits: ['airborne'], mods: ['upg_dragon', 'upg_gps_nav', 'upg_vet_up'], transport: 'nato_usa_uh60_tr',
      desc: '美军最后一张战略机动王牌，随时伞降苏军后方。'
    },
    {
      id: 'nato_usa_101st', name: '第101空中突击连', short: '第101',
      faction: 'NATO', country: 'USA', category: 'INF', role: '空中突击', era: 1991,
      cost: 50, slots: 1, avail: 5, strength: 10, vet: 'veteran',
      stats: { move: 4, armorF: 1, armorS: 1, armorT: 0, optics: 5, stealth: 6, morale: 9, ecm: 0, fuel: 0, supply: 0 },
      weapons: [
        { name: 'M16A2 步枪', kind: 'SMALL', pen: 3, he: 4, acc: 0.62, rmin: 0, rmax: 2, rof: 2, ammo: 80, air: false },
        { name: 'M249 班用机枪', kind: 'SMALL', pen: 3, he: 4, acc: 0.62, rmin: 0, rmax: 3, rof: 3, ammo: 60, air: false },
        { name: 'M47 龙式导弹', kind: 'ATGM', pen: 16, he: 4, acc: 0.5, rmin: 1, rmax: 4, rof: 1, ammo: 5, air: false }
      ],
      traits: ['heliborne'], mods: ['upg_dragon', 'upg_stinger_team', 'upg_gps_nav'], transport: 'nato_usa_uh60_tr',
      desc: '直升机机降穿插，绕开核污染区直插补给线。'
    },
    {
      id: 'nato_usa_ranger', name: '游骑兵连', short: '游骑兵',
      faction: 'NATO', country: 'USA', category: 'INF', role: '突击步兵', era: 1991,
      cost: 55, slots: 1, avail: 4, strength: 10, vet: 'veteran',
      stats: { move: 4, armorF: 1, armorS: 1, armorT: 0, optics: 5, stealth: 7, morale: 10, ecm: 0, fuel: 0, supply: 0 },
      weapons: [
        { name: 'M16A2 步枪', kind: 'SMALL', pen: 3, he: 4, acc: 0.65, rmin: 0, rmax: 2, rof: 2, ammo: 80, air: false },
        { name: 'M249 班用机枪', kind: 'SMALL', pen: 3, he: 4, acc: 0.65, rmin: 0, rmax: 3, rof: 3, ammo: 60, air: false },
        { name: 'M203 40mm', kind: 'HE', pen: 3, he: 8, acc: 0.55, rmin: 0, rmax: 2, rof: 1, ammo: 20, air: false }
      ],
      traits: ['shock'], mods: ['upg_mk19', 'upg_dragon', 'upg_vet_up'], transport: 'nato_usa_hmmwv_tr',
      desc: '先头夜袭斩首目标的老兵突击队。'
    },
    {
      id: 'nato_usa_marines', name: '海军陆战队步兵连', short: '陆战队',
      faction: 'NATO', country: 'USA', category: 'INF', role: '两栖步兵', era: 1991,
      cost: 45, slots: 1, avail: 5, strength: 12, vet: 'trained',
      stats: { move: 4, armorF: 1, armorS: 1, armorT: 0, optics: 4, stealth: 6, morale: 9, ecm: 0, fuel: 0, supply: 0 },
      weapons: [
        { name: 'M16A2 步枪', kind: 'SMALL', pen: 3, he: 4, acc: 0.6, rmin: 0, rmax: 2, rof: 2, ammo: 80, air: false },
        { name: 'M249 班用机枪', kind: 'SMALL', pen: 3, he: 4, acc: 0.6, rmin: 0, rmax: 3, rof: 3, ammo: 60, air: false },
        { name: 'SMAW 火箭筒', kind: 'AT', pen: 14, he: 5, acc: 0.55, rmin: 0, rmax: 2, rof: 1, ammo: 6, air: false }
      ],
      traits: ['marine'], mods: ['upg_mk19', 'upg_dragon', 'upg_nbc_kit'], transport: 'nato_usa_m113a3_tr',
      desc: '从登陆舰抢滩的两栖矛头，为第二波部队开路。'
    },
    {
      id: 'nato_usa_green_berets', name: '绿色贝雷帽特战分队', short: '绿贝雷',
      faction: 'NATO', country: 'USA', category: 'REC', role: '特种侦察', era: 1991,
      cost: 60, slots: 1, avail: 2, strength: 8, vet: 'elite',
      stats: { move: 4, armorF: 1, armorS: 1, armorT: 0, optics: 8, stealth: 9, morale: 10, ecm: 0, fuel: 0, supply: 0 },
      weapons: [
        { name: 'M16A2 步枪', kind: 'SMALL', pen: 3, he: 4, acc: 0.72, rmin: 0, rmax: 2, rof: 2, ammo: 60, air: false },
        { name: '狙击步枪', kind: 'SMALL', pen: 4, he: 2, acc: 0.85, rmin: 0, rmax: 3, rof: 1, ammo: 20, air: false },
        { name: 'M136 AT4', kind: 'AT', pen: 13, he: 4, acc: 0.6, rmin: 0, rmax: 2, rof: 1, ammo: 4, air: false }
      ],
      traits: ['spec_ops', 'sniper', 'recon'], mods: ['upg_gaz_recon', 'upg_vet_up', 'upg_gps_nav'], transport: 'nato_usa_hmmwv_tr',
      desc: '渗透敌后训练抵抗组织，引导空袭的幽灵。'
    },
    {
      id: 'nato_usa_engineer', name: '战斗工程兵连', short: '工程连',
      faction: 'NATO', country: 'USA', category: 'INF', role: '工程兵', era: 1991,
      cost: 40, slots: 1, avail: 5, strength: 10, vet: 'trained',
      stats: { move: 4, armorF: 1, armorS: 1, armorT: 0, optics: 4, stealth: 6, morale: 8, ecm: 0, fuel: 0, supply: 0 },
      weapons: [
        { name: 'M16A2 步枪', kind: 'SMALL', pen: 3, he: 4, acc: 0.6, rmin: 0, rmax: 2, rof: 2, ammo: 60, air: false },
        { name: 'M202 爆破装药', kind: 'HE', pen: 6, he: 12, acc: 0.5, rmin: 0, rmax: 2, rof: 1, ammo: 10, air: false }
      ],
      traits: ['engineer', 'mine_plow'], mods: ['upg_nbc_kit', 'upg_extra_ammo', 'upg_dug_in'], transport: 'nato_usa_m113a3_tr',
      desc: '布雷、破障、架桥，在核污染区外围清出通道。'
    },
    {
      id: 'nato_usa_m1a1', name: 'M1A1 艾布拉姆斯坦克连', short: 'M1A1',
      faction: 'NATO', country: 'USA', category: 'ARM', role: '主战坦克', era: 1991,
      cost: 160, slots: 1, avail: 4, strength: 12, vet: 'trained',
      stats: { move: 8, armorF: 22, armorS: 9, armorT: 4, optics: 5, stealth: 3, morale: 8, ecm: 0, fuel: 8, supply: 0 },
      weapons: [
        { name: 'M256 120mm (M829)', kind: 'AT', pen: 25, he: 5, acc: 0.68, rmin: 0, rmax: 5, rof: 2, ammo: 40, air: false },
        { name: 'M2HB 12.7mm', kind: 'SMALL', pen: 3, he: 3, acc: 0.5, rmin: 0, rmax: 3, rof: 2, ammo: 60, air: false }
      ],
      traits: ['smoke', 'gas_turbine'], mods: ['upg_dep_uranium', 'upg_thermal_2gen', 'upg_extra_ammo'], transport: null,
      desc: '北约装甲矛头，燃气轮机轰鸣声响彻北德平原。'
    },
    {
      id: 'nato_usa_m1a1ha', name: 'M1A1HA 重装甲坦克连', short: 'M1A1HA',
      faction: 'NATO', country: 'USA', category: 'ARM', role: '主战坦克', era: 1991,
      cost: 185, slots: 1, avail: 3, strength: 12, vet: 'veteran',
      stats: { move: 8, armorF: 26, armorS: 10, armorT: 5, optics: 6, stealth: 3, morale: 9, ecm: 0, fuel: 8, supply: 0 },
      weapons: [
        { name: 'M256 120mm (M829A1)', kind: 'AT', pen: 26, he: 5, acc: 0.7, rmin: 0, rmax: 5, rof: 2, ammo: 40, air: false },
        { name: 'M2HB 12.7mm', kind: 'SMALL', pen: 3, he: 3, acc: 0.5, rmin: 0, rmax: 3, rof: 2, ammo: 60, air: false }
      ],
      traits: ['smoke', 'gas_turbine'], mods: ['upg_dep_uranium', 'upg_thermal_2gen', 'upg_tusk_bar'], transport: null,
      desc: '加挂贫铀装甲，硬抗苏制125mm正面打击。'
    },
    {
      id: 'nato_usa_m60a3', name: 'M60A3 巴顿坦克连', short: 'M60A3',
      faction: 'NATO', country: 'USA', category: 'ARM', role: '主战坦克', era: 1991,
      cost: 120, slots: 1, avail: 5, strength: 10, vet: 'trained',
      stats: { move: 7, armorF: 13, armorS: 6, armorT: 3, optics: 5, stealth: 3, morale: 8, ecm: 0, fuel: 9, supply: 0 },
      weapons: [
        { name: 'M68 105mm (M833)', kind: 'AT', pen: 17, he: 5, acc: 0.62, rmin: 0, rmax: 5, rof: 2, ammo: 63, air: false },
        { name: 'M240 7.62mm', kind: 'SMALL', pen: 3, he: 3, acc: 0.5, rmin: 0, rmax: 3, rof: 2, ammo: 60, air: false }
      ],
      traits: ['smoke'], mods: ['upg_thermal_2gen', 'upg_tusk_bar', 'upg_extra_ammo'], transport: null,
      desc: '国民警卫队的主力，欧洲盟军兵力枯竭时顶上去。'
    },
    {
      id: 'nato_usa_m2a2', name: 'M2A2 布雷德利步兵战车连', short: '布雷德利',
      faction: 'NATO', country: 'USA', category: 'REC', role: '步兵战车', era: 1991,
      cost: 90, slots: 1, avail: 5, strength: 8, vet: 'trained',
      stats: { move: 8, armorF: 5, armorS: 2, armorT: 1, optics: 6, stealth: 3, morale: 8, ecm: 0, fuel: 8, supply: 0 },
      weapons: [
        { name: 'M242 25mm', kind: 'AT', pen: 6, he: 4, acc: 0.6, rmin: 0, rmax: 4, rof: 3, ammo: 40, air: false },
        { name: 'BGM-71 TOW-2', kind: 'ATGM', pen: 20, he: 6, acc: 0.62, rmin: 1, rmax: 7, rof: 1, ammo: 6, air: false }
      ],
      traits: ['thermal', 'recon'], mods: ['upg_tow2b', 'upg_thermal_2gen', 'upg_mk19'], transport: null,
      desc: '能打坦克的装甲侦察兵，热像夜里看得更远。'
    },
    {
      id: 'nato_usa_m113a3', name: 'M113A3 装甲侦察排', short: 'M113A3',
      faction: 'NATO', country: 'USA', category: 'REC', role: '装甲输送', era: 1991,
      cost: 45, slots: 1, avail: 6, strength: 6, vet: 'trained',
      stats: { move: 8, armorF: 3, armorS: 1, armorT: 1, optics: 4, stealth: 3, morale: 8, ecm: 0, fuel: 8, supply: 0 },
      weapons: [
        { name: 'M2HB 12.7mm', kind: 'SMALL', pen: 3, he: 3, acc: 0.55, rmin: 0, rmax: 3, rof: 2, ammo: 60, air: false }
      ],
      traits: [], mods: ['upg_tusk_bar', 'upg_nbc_kit', 'upg_extra_ammo'], transport: null,
      desc: '铝壳运输车，便宜皮实，随叫随到。'
    },
    {
      id: 'nato_usa_m109a3', name: 'M109A3 155mm自行榴弹炮连', short: 'M109A3',
      faction: 'NATO', country: 'USA', category: 'SUP', role: '自行火炮', era: 1991,
      cost: 120, slots: 1, avail: 3, strength: 6, vet: 'trained',
      stats: { move: 7, armorF: 2, armorS: 1, armorT: 1, optics: 4, stealth: 2, morale: 8, ecm: 0, fuel: 7, supply: 4 },
      weapons: [
        { name: 'M185 155mm', kind: 'ARTY', pen: 8, he: 15, acc: 0.5, rmin: 6, rmax: 30, rof: 2, ammo: 36, air: false }
      ],
      traits: ['counter_battery'], mods: ['upg_gps_nav', 'upg_gaz_recon', 'upg_extra_ammo'], transport: null,
      desc: '师属炮兵支柱，GPS定位下弹如雨下。'
    },
    {
      id: 'nato_usa_m110a2', name: 'M110A2 203mm自行榴弹炮连', short: 'M110A2',
      faction: 'NATO', country: 'USA', category: 'SUP', role: '重型火炮', era: 1991,
      cost: 130, slots: 1, avail: 2, strength: 5, vet: 'trained',
      stats: { move: 6, armorF: 2, armorS: 1, armorT: 1, optics: 4, stealth: 2, morale: 8, ecm: 0, fuel: 7, supply: 4 },
      weapons: [
        { name: 'M201 203mm', kind: 'ARTY', pen: 10, he: 18, acc: 0.45, rmin: 6, rmax: 34, rof: 1, ammo: 24, air: false }
      ],
      traits: ['counter_battery'], mods: ['upg_gps_nav', 'upg_extra_ammo', 'upg_nbc_kit'], transport: null,
      desc: '一发掀翻混凝土工事的重锤，缓慢而致命。'
    },
    {
      id: 'nato_usa_m270', name: 'M270 MLRS 火箭炮连', short: 'M270',
      faction: 'NATO', country: 'USA', category: 'SUP', role: '多管火箭炮', era: 1991,
      cost: 190, slots: 1, avail: 2, strength: 4, vet: 'trained',
      stats: { move: 7, armorF: 2, armorS: 1, armorT: 1, optics: 4, stealth: 2, morale: 8, ecm: 0, fuel: 7, supply: 4 },
      weapons: [
        { name: 'M26 火箭弹 (DPICM)', kind: 'ARTY', pen: 10, he: 18, acc: 0.4, rmin: 8, rmax: 40, rof: 1, ammo: 12, air: false }
      ],
      traits: ['cluster', 'counter_battery'], mods: ['upg_gps_nav', 'upg_extra_ammo', 'upg_gaz_recon'], transport: null,
      desc: '“钢雨”落处，苏军进攻梯队整片蒸发。'
    },
    {
      id: 'nato_usa_m163', name: 'M163 火神自行高炮排', short: 'M163',
      faction: 'NATO', country: 'USA', category: 'AA', role: '自行高炮', era: 1991,
      cost: 70, slots: 1, avail: 4, strength: 5, vet: 'trained',
      stats: { move: 8, armorF: 3, armorS: 1, armorT: 1, optics: 6, stealth: 3, morale: 8, ecm: 0, fuel: 8, supply: 0 },
      weapons: [
        { name: 'M168 20mm 六管', kind: 'AA', pen: 6, he: 5, acc: 0.45, rmin: 0, rmax: 3, rof: 4, ammo: 80, air: true }
      ],
      traits: ['radar'], mods: ['upg_extra_ammo', 'upg_nbc_kit', 'upg_dug_in'], transport: null,
      desc: '近距离喷吐曳光弹雨，追着苏-25扫射。'
    },
    {
      id: 'nato_usa_m247', name: 'M247 约克军士自行高炮排', short: 'M247',
      faction: 'NATO', country: 'USA', category: 'AA', role: '自行高炮', era: 1991,
      cost: 90, slots: 1, avail: 3, strength: 5, vet: 'trained',
      stats: { move: 8, armorF: 4, armorS: 2, armorT: 1, optics: 7, stealth: 3, morale: 8, ecm: 1, fuel: 8, supply: 0 },
      weapons: [
        { name: 'L/70 40mm 双管', kind: 'AA', pen: 7, he: 6, acc: 0.5, rmin: 0, rmax: 4, rof: 3, ammo: 60, air: true }
      ],
      traits: ['radar'], mods: ['upg_gps_nav', 'upg_extra_ammo', 'upg_dug_in'], transport: null,
      desc: '雷达制导双管40mm，专治低空突防的米-24。'
    },
    {
      id: 'nato_usa_avenger', name: 'M1097 复仇者防空排', short: '复仇者',
      faction: 'NATO', country: 'USA', category: 'AA', role: '便携防空车', era: 1991,
      cost: 90, slots: 1, avail: 4, strength: 4, vet: 'trained',
      stats: { move: 12, armorF: 1, armorS: 1, armorT: 0, optics: 6, stealth: 4, morale: 8, ecm: 1, fuel: 9, supply: 0 },
      weapons: [
        { name: 'FIM-92 毒刺', kind: 'AA', pen: 8, he: 9, acc: 0.66, rmin: 1, rmax: 5, rof: 2, ammo: 8, air: true },
        { name: 'M3P 12.7mm', kind: 'SMALL', pen: 3, he: 3, acc: 0.5, rmin: 0, rmax: 3, rof: 2, ammo: 60, air: false }
      ],
      traits: ['manpads'], mods: ['upg_stinger_team', 'upg_gps_nav', 'upg_dug_in'], transport: null,
      desc: '悍马背上的毒刺，伴随装甲纵队机动防空。'
    },
    {
      id: 'nato_usa_ihawk', name: '改进霍克防空导弹连', short: '改进霍克',
      faction: 'NATO', country: 'USA', category: 'AA', role: '中程防空', era: 1991,
      cost: 120, slots: 1, avail: 3, strength: 4, vet: 'trained',
      stats: { move: 7, armorF: 1, armorS: 1, armorT: 0, optics: 7, stealth: 2, morale: 8, ecm: 1, fuel: 7, supply: 0 },
      weapons: [
        { name: 'MIM-23B 改进霍克', kind: 'AA', pen: 10, he: 12, acc: 0.55, rmin: 2, rmax: 12, rof: 1, ammo: 6, air: true }
      ],
      traits: ['radar'], mods: ['upg_gps_nav', 'upg_extra_ammo', 'upg_nbc_kit'], transport: null,
      desc: '保卫机场与桥梁的中程防空伞。'
    },
    {
      id: 'nato_usa_patriot_pac1', name: '爱国者 PAC-1 防空导弹连', short: '爱国者',
      faction: 'NATO', country: 'USA', category: 'AA', role: '远程防空', era: 1991,
      cost: 190, slots: 1, avail: 2, strength: 4, vet: 'trained',
      stats: { move: 7, armorF: 1, armorS: 1, armorT: 0, optics: 8, stealth: 2, morale: 8, ecm: 2, fuel: 7, supply: 0 },
      weapons: [
        { name: 'MIM-104A PAC-1', kind: 'AA', pen: 12, he: 14, acc: 0.72, rmin: 3, rmax: 24, rof: 1, ammo: 4, air: true }
      ],
      traits: ['radar'], mods: ['upg_gps_nav', 'upg_extra_ammo', 'upg_nbc_kit'], transport: null,
      desc: '拦截飞毛腿的远程防空网核心节点。'
    },
    {
      id: 'nato_usa_ah64a', name: 'AH-64A 阿帕奇攻击直升机中队', short: 'AH-64A',
      faction: 'NATO', country: 'USA', category: 'HEL', role: '攻击直升机', era: 1991,
      cost: 200, slots: 1, avail: 2, strength: 2, vet: 'veteran',
      stats: { move: 16, armorF: 2, armorS: 1, armorT: 1, optics: 10, stealth: 4, morale: 9, ecm: 2, fuel: 11, supply: 0 },
      weapons: [
        { name: 'M230 30mm', kind: 'AT', pen: 6, he: 5, acc: 0.62, rmin: 0, rmax: 4, rof: 3, ammo: 60, air: false },
        { name: 'AGM-114 地狱火', kind: 'ATGM', pen: 24, he: 7, acc: 0.72, rmin: 1, rmax: 8, rof: 2, ammo: 8, air: false },
        { name: '海蛇怪-70 火箭', kind: 'BOMB', pen: 9, he: 13, acc: 0.42, rmin: 0, rmax: 3, rof: 2, ammo: 4, air: false }
      ],
      traits: ['thermal'], mods: ['ld_atgm_heavy', 'ld_rocket_pods', 'ld_aam_extra'], transport: null,
      desc: '树梢高度的坦克杀手，苏军车组听到旋翼就胆寒。'
    },
    {
      id: 'nato_usa_ah1f', name: 'AH-1F 眼镜蛇攻击直升机中队', short: 'AH-1F',
      faction: 'NATO', country: 'USA', category: 'HEL', role: '攻击直升机', era: 1991,
      cost: 150, slots: 1, avail: 3, strength: 2, vet: 'trained',
      stats: { move: 17, armorF: 1, armorS: 1, armorT: 1, optics: 8, stealth: 4, morale: 8, ecm: 1, fuel: 10, supply: 0 },
      weapons: [
        { name: 'M197 20mm 三管', kind: 'AT', pen: 5, he: 5, acc: 0.6, rmin: 0, rmax: 4, rof: 3, ammo: 60, air: false },
        { name: 'BGM-71 TOW', kind: 'ATGM', pen: 20, he: 6, acc: 0.62, rmin: 1, rmax: 7, rof: 1, ammo: 8, air: false },
        { name: '70mm 火箭', kind: 'BOMB', pen: 9, he: 13, acc: 0.42, rmin: 0, rmax: 3, rof: 2, ammo: 4, air: false }
      ],
      traits: [], mods: ['ld_rocket_pods', 'ld_atgm_heavy', 'ld_fuel_tanks'], transport: null,
      desc: '越战老兵，灵活便宜，仍能撕碎装甲车队。'
    },
    {
      id: 'nato_usa_a10a', name: 'A-10A 雷电II 攻击机架次', short: 'A-10A',
      faction: 'NATO', country: 'USA', category: 'AIR', role: '近距攻击机', era: 1991,
      cost: 180, slots: 1, avail: 2, strength: 2, vet: 'veteran',
      stats: { move: 26, armorF: 2, armorS: 2, armorT: 2, optics: 9, stealth: 3, morale: 9, ecm: 2, fuel: 11, supply: 0 },
      weapons: [
        { name: 'GAU-8/A 30mm 加特林', kind: 'AT', pen: 14, he: 8, acc: 0.62, rmin: 0, rmax: 2, rof: 4, ammo: 20, air: false },
        { name: 'AGM-65 小牛', kind: 'ATGM', pen: 22, he: 8, acc: 0.7, rmin: 1, rmax: 6, rof: 2, ammo: 6, air: false },
        { name: 'Mk.82 航弹', kind: 'BOMB', pen: 12, he: 20, acc: 0.5, rmin: 0, rmax: 1, rof: 1, ammo: 4, air: false }
      ],
      traits: ['shock'], mods: ['ld_atgm_heavy', 'ld_rocket_pods', 'ld_laser_gbu'], transport: null,
      desc: '为屠戮苏军坦克而生的“疣猪”，炮声即是判决。'
    },
    {
      id: 'nato_usa_f16c', name: 'F-16C 战隼战斗机架次', short: 'F-16C',
      faction: 'NATO', country: 'USA', category: 'AIR', role: '多用途战斗机', era: 1991,
      cost: 220, slots: 1, avail: 2, strength: 2, vet: 'trained',
      stats: { move: 28, armorF: 1, armorS: 1, armorT: 1, optics: 9, stealth: 3, morale: 8, ecm: 2, fuel: 11, supply: 0 },
      weapons: [
        { name: 'M61 20mm', kind: 'SMALL', pen: 4, he: 4, acc: 0.6, rmin: 0, rmax: 2, rof: 3, ammo: 20, air: false },
        { name: 'AIM-9L 响尾蛇', kind: 'AA', pen: 9, he: 8, acc: 0.72, rmin: 1, rmax: 5, rof: 1, ammo: 4, air: true },
        { name: 'AIM-120 AMRAAM', kind: 'AA', pen: 10, he: 9, acc: 0.78, rmin: 2, rmax: 8, rof: 1, ammo: 4, air: true },
        { name: 'Mk.84 航弹', kind: 'BOMB', pen: 13, he: 22, acc: 0.5, rmin: 0, rmax: 1, rof: 1, ammo: 2, air: false }
      ],
      traits: [], mods: ['ld_aam_extra', 'ld_iron_bombs', 'ld_fuel_tanks'], transport: null,
      desc: '中欧制空权的基石，也能俯冲扫射地面目标。'
    },
    {
      id: 'nato_usa_f15e', name: 'F-15E 攻击鹰战斗轰炸机架次', short: 'F-15E',
      faction: 'NATO', country: 'USA', category: 'AIR', role: '战斗轰炸机', era: 1991,
      cost: 280, slots: 1, avail: 1, strength: 2, vet: 'veteran',
      stats: { move: 28, armorF: 1, armorS: 1, armorT: 1, optics: 10, stealth: 3, morale: 9, ecm: 3, fuel: 12, supply: 0 },
      weapons: [
        { name: 'M61 20mm', kind: 'SMALL', pen: 4, he: 4, acc: 0.6, rmin: 0, rmax: 2, rof: 3, ammo: 20, air: false },
        { name: 'AIM-120 AMRAAM', kind: 'AA', pen: 10, he: 9, acc: 0.78, rmin: 2, rmax: 8, rof: 1, ammo: 4, air: true },
        { name: 'GBU-15 激光制导', kind: 'BOMB', pen: 22, he: 18, acc: 0.78, rmin: 0, rmax: 2, rof: 1, ammo: 4, air: false }
      ],
      traits: ['laser_guided'], mods: ['ld_laser_gbu', 'ld_iron_bombs', 'ld_fuel_tanks'], transport: null,
      desc: '纵深精确打击，摧毁苏军指挥所与桥梁节点。'
    },
    {
      id: 'nato_usa_f111f', name: 'F-111F 土豚战斗轰炸机架次', short: 'F-111F',
      faction: 'NATO', country: 'USA', category: 'AIR', role: '战斗轰炸机', era: 1991,
      cost: 260, slots: 1, avail: 1, strength: 2, vet: 'veteran',
      stats: { move: 28, armorF: 1, armorS: 1, armorT: 1, optics: 10, stealth: 3, morale: 9, ecm: 3, fuel: 12, supply: 0 },
      weapons: [
        { name: 'GBU-15 激光制导', kind: 'BOMB', pen: 22, he: 18, acc: 0.76, rmin: 0, rmax: 2, rof: 1, ammo: 6, air: false },
        { name: 'Mk.84 航弹', kind: 'BOMB', pen: 13, he: 22, acc: 0.5, rmin: 0, rmax: 1, rof: 1, ammo: 2, air: false }
      ],
      traits: ['laser_guided'], mods: ['ld_laser_gbu', 'ld_iron_bombs', 'ld_fuel_tanks'], transport: null,
      desc: '低空高速突防，把苏军后勤枢纽化为火海。'
    },
    {
      id: 'nato_usa_log_cmd', name: '后勤/指挥连', short: '指挥连',
      faction: 'NATO', country: 'USA', category: 'LOG', role: '后勤指挥', era: 1991,
      cost: 80, slots: 1, avail: 3, strength: 6, vet: 'trained',
      stats: { move: 8, armorF: 1, armorS: 1, armorT: 0, optics: 5, stealth: 3, morale: 9, ecm: 0, fuel: 8, supply: 8 },
      weapons: [
        { name: 'M2HB 12.7mm', kind: 'SMALL', pen: 3, he: 3, acc: 0.5, rmin: 0, rmax: 3, rof: 2, ammo: 40, air: false }
      ],
      traits: ['command', 'supply'], mods: ['upg_gps_nav', 'upg_nbc_kit', 'upg_vet_up'], transport: null,
      desc: '把弹药与士气送上前线，维系整条战线不崩。'
    },

    /* =========================================================
     * 1991 组 — 西德（FRG）
     * ========================================================= */
    {
      id: 'nato_frg_leopard2a4', name: '豹2A4 主战坦克连', short: '豹2A4',
      faction: 'NATO', country: 'FRG', category: 'ARM', role: '主战坦克', era: 1991,
      cost: 165, slots: 1, avail: 4, strength: 12, vet: 'veteran',
      stats: { move: 8, armorF: 24, armorS: 9, armorT: 4, optics: 6, stealth: 3, morale: 9, ecm: 0, fuel: 8, supply: 0 },
      weapons: [
        { name: 'Rh-120 L/44 120mm', kind: 'AT', pen: 23, he: 5, acc: 0.68, rmin: 0, rmax: 5, rof: 2, ammo: 42, air: false },
        { name: 'MG3 7.62mm', kind: 'SMALL', pen: 3, he: 3, acc: 0.5, rmin: 0, rmax: 3, rof: 2, ammo: 60, air: false }
      ],
      traits: ['smoke', 'thermal'], mods: ['upg_thermal_2gen', 'upg_tusk_bar', 'upg_gps_nav'], transport: null,
      desc: '北德平原的钢铁壁垒，猎-歼式火控先敌开火。'
    },
    {
      id: 'nato_frg_leopard1a5', name: '豹1A5 主战坦克连', short: '豹1A5',
      faction: 'NATO', country: 'FRG', category: 'ARM', role: '主战坦克', era: 1991,
      cost: 120, slots: 1, avail: 5, strength: 10, vet: 'trained',
      stats: { move: 9, armorF: 12, armorS: 5, armorT: 2, optics: 6, stealth: 3, morale: 8, ecm: 0, fuel: 8, supply: 0 },
      weapons: [
        { name: 'L7A3 105mm', kind: 'AT', pen: 17, he: 5, acc: 0.64, rmin: 0, rmax: 5, rof: 2, ammo: 60, air: false },
        { name: 'MG3 7.62mm', kind: 'SMALL', pen: 3, he: 3, acc: 0.5, rmin: 0, rmax: 3, rof: 2, ammo: 60, air: false }
      ],
      traits: ['smoke', 'thermal'], mods: ['upg_thermal_2gen', 'upg_tusk_bar', 'upg_extra_ammo'], transport: null,
      desc: '轻甲快炮，靠机动与观瞄弥补装甲短板。'
    },
    {
      id: 'nato_frg_marder', name: '黄鼠狼1A3 步兵战车连', short: '黄鼠狼',
      faction: 'NATO', country: 'FRG', category: 'REC', role: '步兵战车', era: 1991,
      cost: 85, slots: 1, avail: 5, strength: 8, vet: 'trained',
      stats: { move: 8, armorF: 4, armorS: 2, armorT: 1, optics: 6, stealth: 3, morale: 8, ecm: 0, fuel: 8, supply: 0 },
      weapons: [
        { name: 'Rh-202 20mm', kind: 'AT', pen: 5, he: 4, acc: 0.6, rmin: 0, rmax: 4, rof: 3, ammo: 60, air: false },
        { name: 'MILAN 反坦克导弹', kind: 'ATGM', pen: 16, he: 5, acc: 0.6, rmin: 1, rmax: 6, rof: 1, ammo: 4, air: false }
      ],
      traits: ['recon'], mods: ['upg_thermal_2gen', 'upg_tusk_bar', 'upg_extra_ammo'], transport: null,
      desc: '伴随豹式坦克推进的联邦国防军铁拳。'
    },
    {
      id: 'nato_frg_luchs', name: '鲁赫斯装甲侦察车排', short: '鲁赫斯',
      faction: 'NATO', country: 'FRG', category: 'REC', role: '装甲侦察', era: 1991,
      cost: 70, slots: 1, avail: 4, strength: 4, vet: 'trained',
      stats: { move: 11, armorF: 3, armorS: 1, armorT: 1, optics: 9, stealth: 4, morale: 8, ecm: 0, fuel: 9, supply: 0 },
      weapons: [
        { name: 'Rh-202 20mm', kind: 'AT', pen: 5, he: 4, acc: 0.6, rmin: 0, rmax: 4, rof: 3, ammo: 50, air: false },
        { name: 'MG3 7.62mm', kind: 'SMALL', pen: 3, he: 3, acc: 0.55, rmin: 0, rmax: 3, rof: 2, ammo: 50, air: false }
      ],
      traits: ['recon', 'amphibious'], mods: ['upg_thermal_2gen', 'upg_gaz_recon', 'upg_gps_nav'], transport: null,
      desc: '静音八轮侦察兵，提前标定苏军集结区。'
    },
    {
      id: 'nato_frg_roland', name: '罗兰2 防空导弹连', short: '罗兰',
      faction: 'NATO', country: 'FRG', category: 'AA', role: '近程防空', era: 1991,
      cost: 100, slots: 1, avail: 3, strength: 4, vet: 'trained',
      stats: { move: 7, armorF: 2, armorS: 1, armorT: 1, optics: 7, stealth: 2, morale: 8, ecm: 1, fuel: 7, supply: 0 },
      weapons: [
        { name: '罗兰2 导弹', kind: 'AA', pen: 9, he: 10, acc: 0.6, rmin: 1, rmax: 8, rof: 2, ammo: 10, air: true }
      ],
      traits: ['radar'], mods: ['upg_gps_nav', 'upg_extra_ammo', 'upg_nbc_kit'], transport: null,
      desc: '晴天条件下全天候拦截低空突防的敌机。'
    },
    {
      id: 'nato_frg_fh70', name: 'FH-70 155mm牵引榴弹炮连', short: 'FH-70',
      faction: 'NATO', country: 'FRG', category: 'SUP', role: '牵引火炮', era: 1991,
      cost: 90, slots: 1, avail: 3, strength: 6, vet: 'trained',
      stats: { move: 8, armorF: 1, armorS: 1, armorT: 0, optics: 4, stealth: 2, morale: 8, ecm: 0, fuel: 7, supply: 4 },
      weapons: [
        { name: 'FH-70 155mm', kind: 'ARTY', pen: 8, he: 15, acc: 0.5, rmin: 6, rmax: 36, rof: 2, ammo: 30, air: false }
      ],
      traits: ['counter_battery'], mods: ['upg_gps_nav', 'upg_gaz_recon', 'upg_extra_ammo'], transport: null,
      desc: '联合研制的身管炮，射程远、展开快。'
    },
    {
      id: 'nato_frg_m109g', name: 'PzH-155 (M109G) 自行榴弹炮连', short: 'PzH-155',
      faction: 'NATO', country: 'FRG', category: 'SUP', role: '自行火炮', era: 1991,
      cost: 120, slots: 1, avail: 3, strength: 6, vet: 'trained',
      stats: { move: 7, armorF: 2, armorS: 1, armorT: 1, optics: 4, stealth: 2, morale: 8, ecm: 0, fuel: 7, supply: 4 },
      weapons: [
        { name: 'M109A3G 155mm', kind: 'ARTY', pen: 8, he: 15, acc: 0.5, rmin: 6, rmax: 30, rof: 2, ammo: 34, air: false }
      ],
      traits: ['counter_battery'], mods: ['upg_gps_nav', 'upg_extra_ammo', 'upg_gaz_recon'], transport: null,
      desc: '改良型美制底盘，德式火控精度一流。'
    },
    {
      id: 'nato_frg_tornado_ids', name: '狂风 IDS 战斗轰炸机架次', short: '狂风',
      faction: 'NATO', country: 'FRG', category: 'AIR', role: '战斗轰炸机', era: 1991,
      cost: 230, slots: 1, avail: 2, strength: 2, vet: 'trained',
      stats: { move: 28, armorF: 1, armorS: 1, armorT: 1, optics: 9, stealth: 3, morale: 8, ecm: 3, fuel: 11, supply: 0 },
      weapons: [
        { name: 'MW-1 子母弹', kind: 'BOMB', pen: 10, he: 20, acc: 0.5, rmin: 0, rmax: 2, rof: 1, ammo: 3, air: false },
        { name: 'Mk.83 航弹', kind: 'BOMB', pen: 12, he: 20, acc: 0.5, rmin: 0, rmax: 1, rof: 1, ammo: 4, air: false }
      ],
      traits: ['cluster'], mods: ['ld_iron_bombs', 'ld_cluster', 'ld_laser_gbu'], transport: null,
      desc: '低空突防抛撒子母弹，覆盖苏军机场跑道。'
    },
    {
      id: 'nato_frg_gsg9', name: 'GSG-9式边境特战分队', short: 'GSG-9',
      faction: 'NATO', country: 'FRG', category: 'REC', role: '特种突击', era: 1991,
      cost: 55, slots: 1, avail: 2, strength: 8, vet: 'elite',
      stats: { move: 4, armorF: 1, armorS: 1, armorT: 0, optics: 7, stealth: 9, morale: 10, ecm: 0, fuel: 0, supply: 0 },
      weapons: [
        { name: 'MP5 冲锋枪', kind: 'SMALL', pen: 3, he: 4, acc: 0.72, rmin: 0, rmax: 2, rof: 3, ammo: 60, air: false },
        { name: '狙击步枪', kind: 'SMALL', pen: 4, he: 2, acc: 0.85, rmin: 0, rmax: 3, rof: 1, ammo: 20, air: false }
      ],
      traits: ['spec_ops', 'sniper'], mods: ['upg_vet_up', 'upg_dug_in', 'upg_nbc_kit'], transport: 'nato_frg_fuchs_tr',
      desc: '反破坏与要员安保的专家，城市巷战尖刀。'
    },

    /* =========================================================
     * 1991 组 — 英国（UK）
     * ========================================================= */
    {
      id: 'nato_uk_challenger1', name: '挑战者1 主战坦克连', short: '挑战者1',
      faction: 'NATO', country: 'UK', category: 'ARM', role: '主战坦克', era: 1991,
      cost: 170, slots: 1, avail: 3, strength: 12, vet: 'veteran',
      stats: { move: 7, armorF: 24, armorS: 10, armorT: 5, optics: 5, stealth: 3, morale: 9, ecm: 0, fuel: 8, supply: 0 },
      weapons: [
        { name: 'L11A5 120mm', kind: 'AT', pen: 21, he: 6, acc: 0.66, rmin: 0, rmax: 5, rof: 2, ammo: 64, air: false },
        { name: 'L8A2 7.62mm', kind: 'SMALL', pen: 3, he: 3, acc: 0.5, rmin: 0, rmax: 3, rof: 2, ammo: 60, air: false }
      ],
      traits: ['smoke'], mods: ['upg_thermal_2gen', 'upg_tusk_bar', 'upg_extra_ammo'], transport: null,
      desc: '乔巴姆装甲的移动堡垒，莱茵军团的中坚。'
    },
    {
      id: 'nato_uk_warrior', name: 'FV510 武士步兵战车连', short: '武士',
      faction: 'NATO', country: 'UK', category: 'REC', role: '步兵战车', era: 1991,
      cost: 85, slots: 1, avail: 5, strength: 8, vet: 'trained',
      stats: { move: 8, armorF: 4, armorS: 2, armorT: 1, optics: 6, stealth: 3, morale: 8, ecm: 0, fuel: 8, supply: 0 },
      weapons: [
        { name: 'RARDEN 30mm', kind: 'AT', pen: 6, he: 4, acc: 0.62, rmin: 0, rmax: 4, rof: 3, ammo: 50, air: false },
        { name: 'L7 7.62mm', kind: 'SMALL', pen: 3, he: 3, acc: 0.55, rmin: 0, rmax: 3, rof: 2, ammo: 60, air: false }
      ],
      traits: ['recon'], mods: ['upg_thermal_2gen', 'upg_tusk_bar', 'upg_extra_ammo'], transport: null,
      desc: '英军机械化步兵的作战室与突击车。'
    },
    {
      id: 'nato_uk_sas', name: 'SAS 特种空勤团分队', short: 'SAS',
      faction: 'NATO', country: 'UK', category: 'REC', role: '特种侦察', era: 1991,
      cost: 60, slots: 1, avail: 2, strength: 8, vet: 'elite',
      stats: { move: 4, armorF: 1, armorS: 1, armorT: 0, optics: 8, stealth: 9, morale: 10, ecm: 0, fuel: 0, supply: 0 },
      weapons: [
        { name: 'L85A1 步枪', kind: 'SMALL', pen: 3, he: 4, acc: 0.72, rmin: 0, rmax: 2, rof: 2, ammo: 60, air: false },
        { name: '狙击步枪', kind: 'SMALL', pen: 4, he: 2, acc: 0.85, rmin: 0, rmax: 3, rof: 1, ammo: 20, air: false },
        { name: 'LAW 80 火箭筒', kind: 'AT', pen: 14, he: 5, acc: 0.6, rmin: 0, rmax: 2, rof: 1, ammo: 4, air: false }
      ],
      traits: ['spec_ops', 'sniper', 'recon'], mods: ['upg_gaz_recon', 'upg_vet_up', 'upg_dug_in'], transport: 'nato_usa_hmmwv_tr',
      desc: '敌后纵深的幽灵，为战略轰炸机标定目标。'
    },
    {
      id: 'nato_uk_lynx_hot', name: '山猫 AH.7 反坦克直升机中队', short: '山猫',
      faction: 'NATO', country: 'UK', category: 'HEL', role: '反坦克直升机', era: 1991,
      cost: 160, slots: 1, avail: 3, strength: 2, vet: 'trained',
      stats: { move: 17, armorF: 1, armorS: 1, armorT: 1, optics: 8, stealth: 4, morale: 8, ecm: 1, fuel: 10, supply: 0 },
      weapons: [
        { name: 'HOT-2 导弹', kind: 'ATGM', pen: 22, he: 6, acc: 0.68, rmin: 1, rmax: 7, rof: 1, ammo: 8, air: false },
        { name: '20mm 机炮', kind: 'AT', pen: 5, he: 4, acc: 0.6, rmin: 0, rmax: 4, rof: 3, ammo: 50, air: false }
      ],
      traits: [], mods: ['ld_atgm_heavy', 'ld_rocket_pods', 'ld_aam_extra'], transport: null,
      desc: '快速灵活，绕到苏军坦克侧后发射HOT导弹。'
    },
    {
      id: 'nato_uk_tornado_gr1', name: '狂风 GR.1 攻击机架次', short: '狂风GR1',
      faction: 'NATO', country: 'UK', category: 'AIR', role: '攻击机', era: 1991,
      cost: 230, slots: 1, avail: 2, strength: 2, vet: 'trained',
      stats: { move: 28, armorF: 1, armorS: 1, armorT: 1, optics: 9, stealth: 3, morale: 8, ecm: 3, fuel: 11, supply: 0 },
      weapons: [
        { name: 'JP233 跑道破坏弹', kind: 'BOMB', pen: 12, he: 18, acc: 0.5, rmin: 0, rmax: 2, rof: 1, ammo: 3, air: false },
        { name: 'Mk.13 航弹', kind: 'BOMB', pen: 12, he: 20, acc: 0.5, rmin: 0, rmax: 1, rof: 1, ammo: 4, air: false }
      ],
      traits: ['cluster'], mods: ['ld_iron_bombs', 'ld_cluster', 'ld_fuel_tanks'], transport: null,
      desc: '超低空撒布跑道破坏弹，瘫痪华约前线机场。'
    },

    /* =========================================================
     * 1991 组 — 法国（FRA）
     * ========================================================= */
    {
      id: 'nato_fra_amx30b2', name: 'AMX-30B2 主战坦克连', short: 'AMX-30B2',
      faction: 'NATO', country: 'FRA', category: 'ARM', role: '主战坦克', era: 1991,
      cost: 115, slots: 1, avail: 4, strength: 10, vet: 'trained',
      stats: { move: 8, armorF: 11, armorS: 5, armorT: 2, optics: 6, stealth: 3, morale: 8, ecm: 0, fuel: 8, supply: 0 },
      weapons: [
        { name: 'CN-105-F1 105mm', kind: 'AT', pen: 16, he: 6, acc: 0.62, rmin: 0, rmax: 5, rof: 2, ammo: 47, air: false },
        { name: 'NF1 7.62mm', kind: 'SMALL', pen: 3, he: 3, acc: 0.5, rmin: 0, rmax: 3, rof: 2, ammo: 60, air: false }
      ],
      traits: ['smoke'], mods: ['upg_gps_nav', 'upg_extra_ammo', 'upg_vet_up'], transport: null,
      desc: '法军装甲兵主力，强调机动与射速。'
    },
    {
      id: 'nato_fra_amx10p', name: 'AMX-10P 步兵战车连', short: 'AMX-10P',
      faction: 'NATO', country: 'FRA', category: 'REC', role: '步兵战车', era: 1991,
      cost: 80, slots: 1, avail: 5, strength: 8, vet: 'trained',
      stats: { move: 8, armorF: 4, armorS: 2, armorT: 1, optics: 6, stealth: 3, morale: 8, ecm: 0, fuel: 8, supply: 0 },
      weapons: [
        { name: '20mm 机关炮', kind: 'AT', pen: 5, he: 4, acc: 0.6, rmin: 0, rmax: 4, rof: 3, ammo: 50, air: false },
        { name: 'MILAN 反坦克导弹', kind: 'ATGM', pen: 16, he: 5, acc: 0.6, rmin: 1, rmax: 6, rof: 1, ammo: 4, air: false }
      ],
      traits: ['amphibious', 'recon'], mods: ['upg_thermal_2gen', 'upg_tusk_bar', 'upg_extra_ammo'], transport: null,
      desc: '两栖步兵战车，跟随快速部队穿插纵深。'
    },
    {
      id: 'nato_fra_vab', name: 'VAB 轮式装甲侦察排', short: 'VAB',
      faction: 'NATO', country: 'FRA', category: 'REC', role: '轮式装甲车', era: 1991,
      cost: 50, slots: 1, avail: 5, strength: 5, vet: 'trained',
      stats: { move: 11, armorF: 3, armorS: 1, armorT: 1, optics: 5, stealth: 3, morale: 8, ecm: 0, fuel: 9, supply: 0 },
      weapons: [
        { name: 'M2HB 12.7mm', kind: 'SMALL', pen: 3, he: 3, acc: 0.55, rmin: 0, rmax: 3, rof: 2, ammo: 60, air: false }
      ],
      traits: ['amphibious', 'recon'], mods: ['upg_mk19', 'upg_nbc_kit', 'upg_extra_ammo'], transport: null,
      desc: '轮式机动，为法军快反部队遮风挡雨。'
    },
    {
      id: 'nato_fra_jaguar', name: '美洲虎 A 攻击机架次', short: '美洲虎',
      faction: 'NATO', country: 'FRA', category: 'AIR', role: '近距攻击机', era: 1991,
      cost: 160, slots: 1, avail: 2, strength: 2, vet: 'trained',
      stats: { move: 27, armorF: 1, armorS: 1, armorT: 1, optics: 8, stealth: 3, morale: 8, ecm: 2, fuel: 10, supply: 0 },
      weapons: [
        { name: '30mm DEFA 双管', kind: 'AT', pen: 6, he: 5, acc: 0.6, rmin: 0, rmax: 2, rof: 3, ammo: 18, air: false },
        { name: '火箭巢', kind: 'BOMB', pen: 9, he: 13, acc: 0.42, rmin: 0, rmax: 3, rof: 2, ammo: 4, air: false },
        { name: 'Mk.82 航弹', kind: 'BOMB', pen: 12, he: 20, acc: 0.5, rmin: 0, rmax: 1, rof: 1, ammo: 4, air: false }
      ],
      traits: [], mods: ['ld_rocket_pods', 'ld_iron_bombs', 'ld_fuel_tanks'], transport: null,
      desc: '英法合研的对地攻击老兵，仍在掩护滩头。'
    },
    {
      id: 'nato_fra_crotale', name: '响尾蛇 Crotale 防空导弹连', short: '响尾蛇',
      faction: 'NATO', country: 'FRA', category: 'AA', role: '近程防空', era: 1991,
      cost: 100, slots: 1, avail: 3, strength: 4, vet: 'trained',
      stats: { move: 10, armorF: 2, armorS: 1, armorT: 1, optics: 7, stealth: 2, morale: 8, ecm: 1, fuel: 8, supply: 0 },
      weapons: [
        { name: 'R.440 响尾蛇', kind: 'AA', pen: 9, he: 10, acc: 0.62, rmin: 1, rmax: 8, rof: 2, ammo: 8, air: true }
      ],
      traits: ['radar'], mods: ['upg_gps_nav', 'upg_extra_ammo', 'upg_nbc_kit'], transport: null,
      desc: '全天候点防空，守卫法军要地与指挥所。'
    },

    /* =========================================================
     * 1991 组 — 加拿大（CAN）
     * ========================================================= */
    {
      id: 'nato_can_leopard1', name: '豹C1 主战坦克连', short: '豹C1',
      faction: 'NATO', country: 'CAN', category: 'ARM', role: '主战坦克', era: 1991,
      cost: 120, slots: 1, avail: 4, strength: 10, vet: 'trained',
      stats: { move: 9, armorF: 12, armorS: 5, armorT: 2, optics: 6, stealth: 3, morale: 8, ecm: 0, fuel: 8, supply: 0 },
      weapons: [
        { name: 'L7A3 105mm', kind: 'AT', pen: 17, he: 5, acc: 0.64, rmin: 0, rmax: 5, rof: 2, ammo: 55, air: false },
        { name: 'C6 7.62mm', kind: 'SMALL', pen: 3, he: 3, acc: 0.5, rmin: 0, rmax: 3, rof: 2, ammo: 60, air: false }
      ],
      traits: ['smoke', 'thermal'], mods: ['upg_thermal_2gen', 'upg_tusk_bar', 'upg_extra_ammo'], transport: null,
      desc: '加拿大装甲团，远渡重洋驰援欧洲战事。'
    },
    {
      id: 'nato_can_inf', name: '加拿大机械化步兵连', short: '加机步连',
      faction: 'NATO', country: 'CAN', category: 'INF', role: '机械化步兵', era: 1991,
      cost: 45, slots: 1, avail: 5, strength: 12, vet: 'trained',
      stats: { move: 4, armorF: 1, armorS: 1, armorT: 0, optics: 4, stealth: 6, morale: 8, ecm: 0, fuel: 0, supply: 0 },
      weapons: [
        { name: 'C7 步枪', kind: 'SMALL', pen: 3, he: 4, acc: 0.6, rmin: 0, rmax: 2, rof: 2, ammo: 80, air: false },
        { name: 'C9 班用机枪', kind: 'SMALL', pen: 3, he: 4, acc: 0.6, rmin: 0, rmax: 3, rof: 3, ammo: 60, air: false },
        { name: 'M72 火箭筒', kind: 'AT', pen: 13, he: 4, acc: 0.5, rmin: 0, rmax: 2, rof: 1, ammo: 6, air: false }
      ],
      traits: [], mods: ['upg_dragon', 'upg_mk19', 'upg_nbc_kit'], transport: 'nato_usa_m113a3_tr',
      desc: '跨海而来的加军，填补北欧防线的缺口。'
    },

    /* =========================================================
     * 1991 组 — 荷兰（NLD）
     * ========================================================= */
    {
      id: 'nato_nld_leopard2a4', name: '豹2A4 主战坦克连(荷)', short: '豹2A4',
      faction: 'NATO', country: 'NLD', category: 'ARM', role: '主战坦克', era: 1991,
      cost: 165, slots: 1, avail: 3, strength: 12, vet: 'veteran',
      stats: { move: 8, armorF: 24, armorS: 9, armorT: 4, optics: 6, stealth: 3, morale: 9, ecm: 0, fuel: 8, supply: 0 },
      weapons: [
        { name: 'Rh-120 L/44 120mm', kind: 'AT', pen: 23, he: 5, acc: 0.68, rmin: 0, rmax: 5, rof: 2, ammo: 42, air: false },
        { name: 'FN MAG 7.62mm', kind: 'SMALL', pen: 3, he: 3, acc: 0.5, rmin: 0, rmax: 3, rof: 2, ammo: 60, air: false }
      ],
      traits: ['smoke', 'thermal'], mods: ['upg_thermal_2gen', 'upg_tusk_bar', 'upg_gps_nav'], transport: null,
      desc: '荷兰皇家陆军的精锐铁骑，守住低地咽喉。'
    },
    {
      id: 'nato_nld_ypr', name: 'YPR-765 装甲步兵排', short: 'YPR-765',
      faction: 'NATO', country: 'NLD', category: 'REC', role: '装甲输送', era: 1991,
      cost: 55, slots: 1, avail: 5, strength: 6, vet: 'trained',
      stats: { move: 8, armorF: 3, armorS: 2, armorT: 1, optics: 5, stealth: 3, morale: 8, ecm: 0, fuel: 8, supply: 0 },
      weapons: [
        { name: '25mm Oerlikon', kind: 'AT', pen: 6, he: 4, acc: 0.6, rmin: 0, rmax: 4, rof: 3, ammo: 50, air: false },
        { name: 'FN MAG 7.62mm', kind: 'SMALL', pen: 3, he: 3, acc: 0.55, rmin: 0, rmax: 3, rof: 2, ammo: 60, air: false }
      ],
      traits: [], mods: ['upg_tusk_bar', 'upg_nbc_kit', 'upg_extra_ammo'], transport: null,
      desc: '荷兰造步兵战车，水网密布地形上的好手。'
    },

    /* =========================================================
     * 1991 组 — 比利时（BEL）
     * ========================================================= */
    {
      id: 'nato_bel_leopard1', name: '豹1A5 主战坦克连(比)', short: '豹1A5',
      faction: 'NATO', country: 'BEL', category: 'ARM', role: '主战坦克', era: 1991,
      cost: 120, slots: 1, avail: 3, strength: 10, vet: 'trained',
      stats: { move: 9, armorF: 12, armorS: 5, armorT: 2, optics: 6, stealth: 3, morale: 8, ecm: 0, fuel: 8, supply: 0 },
      weapons: [
        { name: 'L7A3 105mm', kind: 'AT', pen: 17, he: 5, acc: 0.64, rmin: 0, rmax: 5, rof: 2, ammo: 60, air: false },
        { name: 'FN MAG 7.62mm', kind: 'SMALL', pen: 3, he: 3, acc: 0.5, rmin: 0, rmax: 3, rof: 2, ammo: 60, air: false }
      ],
      traits: ['smoke', 'thermal'], mods: ['upg_thermal_2gen', 'upg_tusk_bar', 'upg_extra_ammo'], transport: null,
      desc: '比利时装甲旅，拱卫易北河到安特卫普的走廊。'
    },
    {
      id: 'nato_bel_inf', name: '比利时机械化步兵连', short: '比机步连',
      faction: 'NATO', country: 'BEL', category: 'INF', role: '机械化步兵', era: 1991,
      cost: 45, slots: 1, avail: 5, strength: 12, vet: 'trained',
      stats: { move: 4, armorF: 1, armorS: 1, armorT: 0, optics: 4, stealth: 6, morale: 8, ecm: 0, fuel: 0, supply: 0 },
      weapons: [
        { name: 'FNC 步枪', kind: 'SMALL', pen: 3, he: 4, acc: 0.6, rmin: 0, rmax: 2, rof: 2, ammo: 80, air: false },
        { name: 'FN MAG 班用机枪', kind: 'SMALL', pen: 3, he: 4, acc: 0.6, rmin: 0, rmax: 3, rof: 3, ammo: 60, air: false },
        { name: 'M72 火箭筒', kind: 'AT', pen: 13, he: 4, acc: 0.5, rmin: 0, rmax: 2, rof: 1, ammo: 6, air: false }
      ],
      traits: [], mods: ['upg_dragon', 'upg_mk19', 'upg_nbc_kit'], transport: 'nato_usa_m113a3_tr',
      desc: '盟军兵力枯竭之际，比利时步兵也钉死在阵地上。'
    },

    /* =========================================================
     * EW 超限战单位（1991）
     * ========================================================= */
    {
      id: 'nato_usa_ef111a', name: 'EF-111A 乌鸦电子战机', short: 'EF-111A',
      faction: 'NATO', country: 'USA', category: 'EW', role: '电子干扰机', era: 1991,
      cost: 200, slots: 1, avail: 2, strength: 2, vet: 'veteran',
      stats: { move: 28, armorF: 1, armorS: 1, armorT: 1, optics: 8, stealth: 3, morale: 9, ecm: 8, fuel: 12, supply: 0 },
      weapons: [
        { name: 'ALQ-99E 电子压制', kind: 'AA', pen: 2, he: 1, acc: 0.4, rmin: 0, rmax: 2, rof: 1, ammo: 4, air: true }
      ],
      traits: ['jammer', 'sead'], mods: ['upg_gps_nav', 'upg_vet_up', 'upg_extra_ammo'], transport: null,
      desc: '伴随攻击机群突防，致盲整个苏军防空网。'
    },
    {
      id: 'nato_usa_ea6b', name: 'EA-6B 徘徊者电子战机', short: 'EA-6B',
      faction: 'NATO', country: 'USA', category: 'EW', role: '电子攻击机', era: 1991,
      cost: 210, slots: 1, avail: 2, strength: 2, vet: 'veteran',
      stats: { move: 28, armorF: 1, armorS: 1, armorT: 1, optics: 8, stealth: 3, morale: 9, ecm: 8, fuel: 12, supply: 0 },
      weapons: [
        { name: 'AGM-88 哈姆', kind: 'BOMB', pen: 16, he: 14, acc: 0.7, rmin: 1, rmax: 6, rof: 1, ammo: 2, air: false }
      ],
      traits: ['jammer', 'sead'], mods: ['upg_gps_nav', 'upg_vet_up', 'upg_extra_ammo'], transport: null,
      desc: '软硬兼施，干扰之余用反辐射导弹点名雷达。'
    },
    {
      id: 'nato_usa_tlq17', name: 'AN/TLQ-17 地面干扰组', short: 'TLQ-17',
      faction: 'NATO', country: 'USA', category: 'EW', role: '通信干扰', era: 1991,
      cost: 90, slots: 1, avail: 3, strength: 4, vet: 'trained',
      stats: { move: 10, armorF: 2, armorS: 1, armorT: 1, optics: 5, stealth: 4, morale: 8, ecm: 6, fuel: 8, supply: 0 },
      weapons: [
        { name: 'M249 自卫', kind: 'SMALL', pen: 3, he: 3, acc: 0.55, rmin: 0, rmax: 2, rof: 2, ammo: 40, air: false }
      ],
      traits: ['jammer'], mods: ['upg_gps_nav', 'upg_nbc_kit', 'upg_dug_in'], transport: null,
      desc: '车载大功率干扰机，掐断华约指挥网。'
    },
    {
      id: 'nato_usa_trailblazer', name: 'Trailblazer 电子侦察连', short: '破路者',
      faction: 'NATO', country: 'USA', category: 'EW', role: '信号侦察', era: 1991,
      cost: 100, slots: 1, avail: 2, strength: 4, vet: 'trained',
      stats: { move: 10, armorF: 2, armorS: 1, armorT: 1, optics: 8, stealth: 4, morale: 8, ecm: 4, fuel: 8, supply: 0 },
      weapons: [
        { name: 'M249 自卫', kind: 'SMALL', pen: 3, he: 3, acc: 0.55, rmin: 0, rmax: 2, rof: 2, ammo: 40, air: false }
      ],
      traits: ['sigint', 'recon'], mods: ['upg_gps_nav', 'upg_gaz_recon', 'upg_dug_in'], transport: null,
      desc: '截获苏军无线电，揭示敌方卡组与预备队位置。'
    },
    {
      id: 'nato_usa_psyops', name: '心理战广播分队', short: '心战广播',
      faction: 'NATO', country: 'USA', category: 'EW', role: '心理战', era: 1991,
      cost: 70, slots: 1, avail: 2, strength: 4, vet: 'trained',
      stats: { move: 10, armorF: 1, armorS: 1, armorT: 0, optics: 5, stealth: 4, morale: 9, ecm: 2, fuel: 8, supply: 0 },
      weapons: [
        { name: 'M16A2 自卫', kind: 'SMALL', pen: 3, he: 3, acc: 0.55, rmin: 0, rmax: 2, rof: 2, ammo: 40, air: false }
      ],
      traits: ['psyops'], mods: ['upg_gps_nav', 'upg_vet_up', 'upg_dug_in'], transport: null,
      desc: '“自由欧洲电台”风格的广播车，瓦解敌军士气。'
    },
    {
      id: 'nato_usa_decoy', name: '诱饵/假目标分队', short: '假目标',
      faction: 'NATO', country: 'USA', category: 'EW', role: '欺骗诱饵', era: 1991,
      cost: 60, slots: 1, avail: 3, strength: 4, vet: 'trained',
      stats: { move: 9, armorF: 1, armorS: 1, armorT: 0, optics: 5, stealth: 5, morale: 8, ecm: 3, fuel: 8, supply: 0 },
      weapons: [
        { name: 'M16A2 自卫', kind: 'SMALL', pen: 3, he: 3, acc: 0.55, rmin: 0, rmax: 2, rof: 2, ammo: 40, air: false }
      ],
      traits: ['decoy'], mods: ['upg_gps_nav', 'upg_dug_in', 'upg_extra_ammo'], transport: null,
      desc: '充气坦克与角反射器，骗走苏军侦察与火力。'
    },

    /* =========================================================
     * 1994 推演组
     * ========================================================= */
    {
      id: 'nato_usa_m1a2', name: 'M1A2 艾布拉姆斯早期批次坦克连', short: 'M1A2',
      faction: 'NATO', country: 'USA', category: 'ARM', role: '主战坦克', era: 1994,
      cost: 205, slots: 1, avail: 2, strength: 12, vet: 'veteran',
      stats: { move: 8, armorF: 28, armorS: 11, armorT: 5, optics: 7, stealth: 3, morale: 9, ecm: 1, fuel: 8, supply: 0 },
      weapons: [
        { name: 'M256 120mm (M829A1)', kind: 'AT', pen: 27, he: 5, acc: 0.72, rmin: 0, rmax: 5, rof: 2, ammo: 42, air: false },
        { name: 'M2HB 12.7mm', kind: 'SMALL', pen: 3, he: 3, acc: 0.5, rmin: 0, rmax: 3, rof: 2, ammo: 60, air: false }
      ],
      traits: ['smoke', 'gas_turbine', 'thermal'], mods: ['upg_m829a2', 'upg_thermal_2gen', 'upg_gps_nav'], transport: null,
      desc: '冷战多续命几年才赶上的量产批次，数字化车际网络。'
    },
    {
      id: 'nato_usa_block3', name: 'Block III 试验坦克排', short: 'BlockIII',
      faction: 'NATO', country: 'USA', category: 'ARM', role: '试验主战坦克', era: 1994,
      cost: 220, slots: 1, avail: 1, strength: 8, vet: 'elite',
      stats: { move: 8, armorF: 30, armorS: 12, armorT: 6, optics: 8, stealth: 3, morale: 10, ecm: 1, fuel: 8, supply: 0 },
      weapons: [
        { name: 'XM291 140mm', kind: 'AT', pen: 28, he: 6, acc: 0.74, rmin: 0, rmax: 5, rof: 2, ammo: 32, air: false },
        { name: 'M2HB 12.7mm', kind: 'SMALL', pen: 3, he: 3, acc: 0.5, rmin: 0, rmax: 3, rof: 2, ammo: 60, air: false }
      ],
      traits: ['smoke', 'thermal', 'command'], mods: ['upg_m829a2', 'upg_thermal_2gen', 'upg_gps_nav'], transport: null,
      desc: '无人炮塔原型车，冷战若持续本该量产的王牌。'
    },
    {
      id: 'nato_usa_m8_ags', name: 'M8 AGS 装甲炮车连', short: 'M8 AGS',
      faction: 'NATO', country: 'USA', category: 'ARM', role: '轻型坦克', era: 1994,
      cost: 130, slots: 1, avail: 2, strength: 8, vet: 'trained',
      stats: { move: 9, armorF: 5, armorS: 3, armorT: 2, optics: 7, stealth: 4, morale: 8, ecm: 0, fuel: 8, supply: 0 },
      weapons: [
        { name: 'M35 105mm', kind: 'AT', pen: 20, he: 5, acc: 0.68, rmin: 0, rmax: 5, rof: 2, ammo: 30, air: false },
        { name: 'M2HB 12.7mm', kind: 'SMALL', pen: 3, he: 3, acc: 0.5, rmin: 0, rmax: 3, rof: 2, ammo: 50, air: false }
      ],
      traits: ['smoke', 'thermal'], mods: ['upg_thermal_2gen', 'upg_tusk_bar', 'upg_gps_nav'], transport: null,
      desc: '可空投的轻型坦克，为快反师补上直射火力。'
    },
    {
      id: 'nato_usa_losat', name: 'LOSAT 高超音速反坦克导弹车', short: 'LOSAT',
      faction: 'NATO', country: 'USA', category: 'REC', role: '反坦克导弹车', era: 1994,
      cost: 150, slots: 1, avail: 1, strength: 4, vet: 'veteran',
      stats: { move: 8, armorF: 5, armorS: 2, armorT: 1, optics: 7, stealth: 3, morale: 9, ecm: 0, fuel: 8, supply: 0 },
      weapons: [
        { name: 'MGM-166A KEM', kind: 'ATGM', pen: 34, he: 8, acc: 0.8, rmin: 2, rmax: 8, rof: 1, ammo: 6, air: false }
      ],
      traits: ['thermal'], mods: ['upg_thermal_2gen', 'upg_gps_nav', 'upg_extra_ammo'], transport: null,
      desc: '动能导弹撕碎一切现役坦克，苏军车长的噩梦。'
    },
    {
      id: 'nato_usa_m2a3', name: 'M2A3 布雷德利步兵战车连', short: 'M2A3',
      faction: 'NATO', country: 'USA', category: 'REC', role: '步兵战车', era: 1994,
      cost: 110, slots: 1, avail: 2, strength: 8, vet: 'veteran',
      stats: { move: 8, armorF: 6, armorS: 3, armorT: 1, optics: 7, stealth: 3, morale: 9, ecm: 0, fuel: 8, supply: 0 },
      weapons: [
        { name: 'M242 25mm', kind: 'AT', pen: 6, he: 4, acc: 0.62, rmin: 0, rmax: 4, rof: 3, ammo: 40, air: false },
        { name: 'BGM-71F TOW-2B', kind: 'ATGM', pen: 24, he: 6, acc: 0.66, rmin: 1, rmax: 7, rof: 1, ammo: 6, air: false }
      ],
      traits: ['thermal', 'recon'], mods: ['upg_tow2b', 'upg_thermal_2gen', 'upg_mk19'], transport: null,
      desc: '全数字化观瞄与攻顶导弹，1994年的步兵战车标杆。'
    },
    {
      id: 'nato_usa_m6_linebacker', name: 'M6 后卫防空战车排', short: 'M6后卫',
      faction: 'NATO', country: 'USA', category: 'AA', role: '自行防空', era: 1994,
      cost: 110, slots: 1, avail: 2, strength: 4, vet: 'trained',
      stats: { move: 8, armorF: 5, armorS: 2, armorT: 1, optics: 7, stealth: 3, morale: 8, ecm: 1, fuel: 8, supply: 0 },
      weapons: [
        { name: 'FIM-92 毒刺', kind: 'AA', pen: 8, he: 9, acc: 0.68, rmin: 1, rmax: 5, rof: 2, ammo: 12, air: true },
        { name: 'M242 25mm', kind: 'AT', pen: 6, he: 4, acc: 0.6, rmin: 0, rmax: 4, rof: 3, ammo: 40, air: false }
      ],
      traits: ['radar'], mods: ['upg_stinger_team', 'upg_thermal_2gen', 'upg_gps_nav'], transport: null,
      desc: '布雷德利底盘扛毒刺，伴随装甲纵队寸步不离。'
    },
    {
      id: 'nato_usa_mlrs_atacms', name: 'MLRS+ATACMS 战役导弹连', short: 'ATACMS',
      faction: 'NATO', country: 'USA', category: 'SUP', role: '战役战术导弹', era: 1994,
      cost: 210, slots: 1, avail: 1, strength: 4, vet: 'veteran',
      stats: { move: 7, armorF: 2, armorS: 1, armorT: 1, optics: 5, stealth: 2, morale: 9, ecm: 0, fuel: 7, supply: 4 },
      weapons: [
        { name: 'MGM-140 ATACMS', kind: 'ARTY', pen: 14, he: 26, acc: 0.55, rmin: 10, rmax: 46, rof: 1, ammo: 4, air: false }
      ],
      traits: ['cluster', 'gps', 'counter_battery'], mods: ['upg_gps_nav', 'upg_extra_ammo', 'upg_vet_up'], transport: null,
      desc: 'GPS制导战役导弹，隔着半个战区点名苏军纵深。'
    },
    {
      id: 'nato_usa_patriot_pac2', name: '爱国者 PAC-2 防空导弹连', short: 'PAC-2',
      faction: 'NATO', country: 'USA', category: 'AA', role: '远程防空', era: 1994,
      cost: 210, slots: 1, avail: 2, strength: 4, vet: 'veteran',
      stats: { move: 7, armorF: 1, armorS: 1, armorT: 0, optics: 8, stealth: 2, morale: 9, ecm: 3, fuel: 7, supply: 0 },
      weapons: [
        { name: 'MIM-104C PAC-2', kind: 'AA', pen: 13, he: 15, acc: 0.78, rmin: 3, rmax: 24, rof: 1, ammo: 5, air: true }
      ],
      traits: ['radar'], mods: ['upg_gps_nav', 'upg_extra_ammo', 'upg_nbc_kit'], transport: null,
      desc: '升级引信与弹头，对飞毛腿弹道导弹的拦截率大增。'
    },
    {
      id: 'nato_usa_adats', name: 'ADATS 防空反坦克系统排', short: 'ADATS',
      faction: 'NATO', country: 'USA', category: 'AA', role: '防空反坦克', era: 1994,
      cost: 150, slots: 1, avail: 1, strength: 4, vet: 'veteran',
      stats: { move: 8, armorF: 3, armorS: 1, armorT: 1, optics: 8, stealth: 2, morale: 9, ecm: 2, fuel: 8, supply: 0 },
      weapons: [
        { name: 'ADATS 防空导弹', kind: 'AA', pen: 12, he: 12, acc: 0.75, rmin: 1, rmax: 8, rof: 2, ammo: 8, air: true },
        { name: 'ADATS 反坦克弹', kind: 'ATGM', pen: 24, he: 6, acc: 0.72, rmin: 1, rmax: 7, rof: 1, ammo: 8, air: false }
      ],
      traits: ['radar'], mods: ['upg_gps_nav', 'upg_thermal_2gen', 'upg_extra_ammo'], transport: null,
      desc: '一弹两用，激光驾束既打飞机又穿坦克。'
    },
    {
      id: 'nato_usa_sgtyork2', name: '约克军士改进型自行高炮排', short: '约克II',
      faction: 'NATO', country: 'USA', category: 'AA', role: '自行高炮', era: 1994,
      cost: 95, slots: 1, avail: 2, strength: 5, vet: 'trained',
      stats: { move: 8, armorF: 4, armorS: 2, armorT: 1, optics: 7, stealth: 3, morale: 8, ecm: 1, fuel: 8, supply: 0 },
      weapons: [
        { name: 'L/70 40mm 双管(改进)', kind: 'AA', pen: 7, he: 6, acc: 0.55, rmin: 0, rmax: 4, rof: 3, ammo: 60, air: true }
      ],
      traits: ['radar'], mods: ['upg_gps_nav', 'upg_thermal_2gen', 'upg_extra_ammo'], transport: null,
      desc: '换了可靠雷达的约克，低空苏-25的克星终于合格。'
    },
    {
      id: 'nato_usa_ah64d', name: 'AH-64D 长弓阿帕奇攻击直升机中队', short: '长弓阿帕奇',
      faction: 'NATO', country: 'USA', category: 'HEL', role: '攻击直升机', era: 1994,
      cost: 240, slots: 1, avail: 1, strength: 2, vet: 'elite',
      stats: { move: 16, armorF: 2, armorS: 1, armorT: 1, optics: 11, stealth: 4, morale: 10, ecm: 3, fuel: 11, supply: 0 },
      weapons: [
        { name: 'M230 30mm', kind: 'AT', pen: 6, he: 5, acc: 0.65, rmin: 0, rmax: 4, rof: 3, ammo: 60, air: false },
        { name: 'AGM-114L 长弓地狱火', kind: 'ATGM', pen: 26, he: 7, acc: 0.8, rmin: 1, rmax: 8, rof: 2, ammo: 8, air: false },
        { name: '海蛇怪-70 火箭', kind: 'BOMB', pen: 9, he: 13, acc: 0.42, rmin: 0, rmax: 3, rof: 2, ammo: 4, air: false }
      ],
      traits: ['thermal', 'radar'], mods: ['ld_atgm_heavy', 'ld_rocket_pods', 'ld_aam_extra'], transport: null,
      desc: '毫米波雷达+射后不理，树梢之上单方面屠杀。'
    },
    {
      id: 'nato_usa_rah66', name: 'RAH-66 科曼奇侦察攻击直升机中队', short: '科曼奇',
      faction: 'NATO', country: 'USA', category: 'HEL', role: '侦察直升机', era: 1994,
      cost: 260, slots: 1, avail: 1, strength: 2, vet: 'elite',
      stats: { move: 18, armorF: 1, armorS: 1, armorT: 1, optics: 11, stealth: 5, morale: 10, ecm: 3, fuel: 11, supply: 0 },
      weapons: [
        { name: 'XM301 20mm', kind: 'AT', pen: 5, he: 4, acc: 0.62, rmin: 0, rmax: 4, rof: 3, ammo: 40, air: false },
        { name: 'AGM-114 地狱火', kind: 'ATGM', pen: 24, he: 7, acc: 0.74, rmin: 1, rmax: 8, rof: 2, ammo: 6, air: false }
      ],
      traits: ['thermal', 'recon'], mods: ['ld_atgm_heavy', 'ld_rocket_pods', 'ld_fuel_tanks'], transport: null,
      desc: '隐身侦察杀手，先于苏军防空发现一切。'
    },
    {
      id: 'nato_usa_f22', name: 'F-22 猛禽早期中队', short: 'F-22',
      faction: 'NATO', country: 'USA', category: 'AIR', role: '空优战斗机', era: 1994,
      cost: 340, slots: 1, avail: 1, strength: 2, vet: 'elite',
      stats: { move: 30, armorF: 1, armorS: 1, armorT: 1, optics: 10, stealth: 6, morale: 10, ecm: 4, fuel: 12, supply: 0 },
      weapons: [
        { name: 'M61 20mm', kind: 'SMALL', pen: 4, he: 4, acc: 0.62, rmin: 0, rmax: 2, rof: 3, ammo: 20, air: false },
        { name: 'AIM-120C AMRAAM', kind: 'AA', pen: 11, he: 9, acc: 0.85, rmin: 2, rmax: 9, rof: 1, ammo: 6, air: true }
      ],
      traits: ['stealth_air'], mods: ['ld_aam_extra', 'ld_fuel_tanks', 'ld_iron_bombs'], transport: null,
      desc: '冷战若再拖五年才升空，隐身空优碾压苏-27机群。'
    },
    {
      id: 'nato_usa_a12', name: 'A-12 复仇者II 隐身攻击机架次', short: 'A-12',
      faction: 'NATO', country: 'USA', category: 'AIR', role: '隐身攻击机', era: 1994,
      cost: 320, slots: 1, avail: 1, strength: 2, vet: 'elite',
      stats: { move: 28, armorF: 1, armorS: 1, armorT: 1, optics: 10, stealth: 6, morale: 10, ecm: 4, fuel: 12, supply: 0 },
      weapons: [
        { name: '内部弹舱航弹', kind: 'BOMB', pen: 13, he: 22, acc: 0.72, rmin: 0, rmax: 2, rof: 1, ammo: 4, air: false },
        { name: 'AGM-88 哈姆', kind: 'BOMB', pen: 16, he: 14, acc: 0.72, rmin: 1, rmax: 6, rof: 1, ammo: 2, air: false }
      ],
      traits: ['stealth_air', 'sead'], mods: ['ld_laser_gbu', 'ld_iron_bombs', 'ld_cluster'], transport: null,
      desc: '飞翼隐身舰载攻击机，突入核污染区纵深轰炸。'
    },
    {
      id: 'nato_usa_f117', name: 'F-117 夜鹰增编中队', short: 'F-117',
      faction: 'NATO', country: 'USA', category: 'AIR', role: '隐身攻击机', era: 1994,
      cost: 300, slots: 1, avail: 1, strength: 2, vet: 'elite',
      stats: { move: 27, armorF: 1, armorS: 1, armorT: 1, optics: 9, stealth: 6, morale: 10, ecm: 4, fuel: 11, supply: 0 },
      weapons: [
        { name: 'GBU-27 激光制导', kind: 'BOMB', pen: 24, he: 18, acc: 0.8, rmin: 0, rmax: 2, rof: 1, ammo: 2, air: false }
      ],
      traits: ['stealth_air', 'laser_guided'], mods: ['ld_laser_gbu', 'ld_iron_bombs', 'ld_fuel_tanks'], transport: null,
      desc: '冷战延长让夜鹰扩编，专炸苏军指挥所与核设施。'
    },
    {
      id: 'nato_usa_javelin_team', name: '标枪反坦克小组', short: '标枪组',
      faction: 'NATO', country: 'USA', category: 'INF', role: '反坦克步兵', era: 1994,
      cost: 60, slots: 1, avail: 3, strength: 8, vet: 'trained',
      stats: { move: 4, armorF: 1, armorS: 1, armorT: 0, optics: 5, stealth: 7, morale: 9, ecm: 0, fuel: 0, supply: 0 },
      weapons: [
        { name: 'FGM-148 标枪', kind: 'ATGM', pen: 26, he: 6, acc: 0.8, rmin: 1, rmax: 5, rof: 1, ammo: 5, air: false },
        { name: 'M4 卡宾枪', kind: 'SMALL', pen: 3, he: 4, acc: 0.62, rmin: 0, rmax: 2, rof: 2, ammo: 40, air: false }
      ],
      traits: ['at_team'], mods: ['upg_gps_nav', 'upg_extra_ammo', 'upg_vet_up'], transport: 'nato_usa_hmmwv_tr',
      desc: '射后不理的攻顶导弹，1994年才姗姗来迟的新玩具。'
    },
    {
      id: 'nato_usa_digital_bn', name: '"数字化师"试验营', short: '数字化营',
      faction: 'NATO', country: 'USA', category: 'LOG', role: '数字化指挥', era: 1994,
      cost: 120, slots: 1, avail: 1, strength: 6, vet: 'veteran',
      stats: { move: 8, armorF: 1, armorS: 1, armorT: 0, optics: 6, stealth: 3, morale: 10, ecm: 2, fuel: 8, supply: 10 },
      weapons: [
        { name: 'M2HB 12.7mm', kind: 'SMALL', pen: 3, he: 3, acc: 0.5, rmin: 0, rmax: 3, rof: 2, ammo: 40, air: false }
      ],
      traits: ['command', 'supply', 'gps'], mods: ['upg_gps_nav', 'upg_extra_ammo', 'upg_vet_up'], transport: null,
      desc: '试验性数字化营，数据链让整师共享同一张战场图。'
    },
    {
      id: 'nato_frg_leopard2a5', name: '豹2A5 主战坦克连', short: '豹2A5',
      faction: 'NATO', country: 'FRG', category: 'ARM', role: '主战坦克', era: 1994,
      cost: 200, slots: 1, avail: 2, strength: 12, vet: 'veteran',
      stats: { move: 8, armorF: 27, armorS: 11, armorT: 5, optics: 7, stealth: 3, morale: 9, ecm: 1, fuel: 8, supply: 0 },
      weapons: [
        { name: 'Rh-120 L/44 120mm (DM43)', kind: 'AT', pen: 24, he: 5, acc: 0.7, rmin: 0, rmax: 5, rof: 2, ammo: 42, air: false },
        { name: 'MG3 7.62mm', kind: 'SMALL', pen: 3, he: 3, acc: 0.5, rmin: 0, rmax: 3, rof: 2, ammo: 60, air: false }
      ],
      traits: ['smoke', 'thermal'], mods: ['upg_thermal_2gen', 'upg_tusk_bar', 'upg_gps_nav'], transport: null,
      desc: '楔形附加装甲，冷战延续才催生的豹式终极形态。'
    },
    {
      id: 'nato_uk_challenger2', name: '挑战者2 主战坦克连', short: '挑战者2',
      faction: 'NATO', country: 'UK', category: 'ARM', role: '主战坦克', era: 1994,
      cost: 210, slots: 1, avail: 1, strength: 12, vet: 'veteran',
      stats: { move: 7, armorF: 28, armorS: 11, armorT: 5, optics: 7, stealth: 3, morale: 9, ecm: 1, fuel: 8, supply: 0 },
      weapons: [
        { name: 'L30A1 120mm', kind: 'AT', pen: 26, he: 6, acc: 0.7, rmin: 0, rmax: 5, rof: 2, ammo: 50, air: false },
        { name: 'L8A2 7.62mm', kind: 'SMALL', pen: 3, he: 3, acc: 0.5, rmin: 0, rmax: 3, rof: 2, ammo: 60, air: false }
      ],
      traits: ['smoke', 'thermal'], mods: ['upg_thermal_2gen', 'upg_tusk_bar', 'upg_gps_nav'], transport: null,
      desc: '二代乔巴姆+射后猎歼火控，几乎不可击穿。'
    },
    {
      id: 'nato_frg_pzh2000', name: 'PzH 2000 自行榴弹炮连', short: 'PzH2000',
      faction: 'NATO', country: 'FRG', category: 'SUP', role: '自行火炮', era: 1994,
      cost: 185, slots: 1, avail: 2, strength: 6, vet: 'veteran',
      stats: { move: 7, armorF: 3, armorS: 2, armorT: 1, optics: 5, stealth: 2, morale: 9, ecm: 0, fuel: 7, supply: 5 },
      weapons: [
        { name: '155mm L/52', kind: 'ARTY', pen: 9, he: 16, acc: 0.6, rmin: 6, rmax: 36, rof: 3, ammo: 60, air: false }
      ],
      traits: ['counter_battery'], mods: ['upg_gps_nav', 'upg_extra_ammo', 'upg_vet_up'], transport: null,
      desc: '高射速与全自动装填，把苏联炮兵连成建制抹掉。'
    },
    {
      id: 'nato_fra_leclerc', name: '勒克莱尔主战坦克连', short: '勒克莱尔',
      faction: 'NATO', country: 'FRA', category: 'ARM', role: '主战坦克', era: 1994,
      cost: 210, slots: 1, avail: 1, strength: 12, vet: 'veteran',
      stats: { move: 9, armorF: 27, armorS: 10, armorT: 5, optics: 7, stealth: 3, morale: 9, ecm: 1, fuel: 8, supply: 0 },
      weapons: [
        { name: 'CN-120-26 120mm', kind: 'AT', pen: 26, he: 5, acc: 0.72, rmin: 0, rmax: 5, rof: 2, ammo: 40, air: false },
        { name: 'NF1 7.62mm', kind: 'SMALL', pen: 3, he: 3, acc: 0.5, rmin: 0, rmax: 3, rof: 2, ammo: 60, air: false }
      ],
      traits: ['smoke', 'thermal'], mods: ['upg_thermal_2gen', 'upg_tusk_bar', 'upg_gps_nav'], transport: null,
      desc: '冷战若续命到90年代中期，法军终于等到它量产。'
    },

    /* =========================================================
     * EW 超限战单位（1994）
     * ========================================================= */
    {
      id: 'nato_usa_cyber', name: '赛博/密码破译分队', short: '密码破译',
      faction: 'NATO', country: 'USA', category: 'EW', role: '数据链攻击', era: 1994,
      cost: 110, slots: 1, avail: 1, strength: 4, vet: 'elite',
      stats: { move: 8, armorF: 1, armorS: 1, armorT: 0, optics: 6, stealth: 5, morale: 10, ecm: 4, fuel: 7, supply: 0 },
      weapons: [
        { name: 'M16A2 自卫', kind: 'SMALL', pen: 3, he: 3, acc: 0.55, rmin: 0, rmax: 2, rof: 2, ammo: 40, air: false }
      ],
      traits: ['cyber', 'sigint'], mods: ['upg_gps_nav', 'upg_vet_up', 'upg_dug_in'], transport: null,
      desc: '1994年推演的密码战力量，破译并扰乱苏军数据链。'
    }
  ];
})();
