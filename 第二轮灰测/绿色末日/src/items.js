/* =========================================================================
 * GREENFALL · items.js —— 物品注册表（170+ 种）
 *
 * 字段速查：
 *   w      单件重量(kg)          stack  单格上限
 *   tool   {type,tier,speed,dmg,dur}      工具/近战
 *   gun    {ammo,dmg,mag,rpm,noise,spread}
 *   food   {cal,water,heal,infect,sick,spoil,warm}
 *   drink  {water,sick,infect,warm,buff}
 *   med    {heal,bleed,infect,sick,pain,stam}
 *   armor  {slot,def,warm,rain}
 *   place  放置成的方块 key
 *   fluid  {holds,cap} 容器      fuel 燃烧秒数     light 手持光照半径
 * ======================================================================= */
(function (GF) {
  'use strict';

  const items = Object.create(null);
  const order = [];

  const CATS = {
    res: '原料', part: '零件', tool: '工具', weap: '武器', ammo: '弹药',
    armor: '护具', food: '食物', drink: '饮品', med: '医疗', seed: '种子',
    build: '建材', key: '关键物', misc: '杂项',
  };

  function I(key, name, cat, w, stack, desc, extra) {
    const it = Object.assign({ key, name, cat, w, stack, desc: desc || '' }, extra || {});
    items[key] = it; order.push(key);
    return it;
  }

  /* ============================================================ 原料 */
  I('fiber', '植物纤维', 'res', 0.02, 60, '从草藤中撕下的韧皮，可搓绳。');
  I('cord', '纤维绳', 'res', 0.05, 40, '三股纤维搓成，捆扎万物之始。');
  I('rope', '麻绳', 'res', 0.4, 20, '结实的长绳，攀爬与搬运。');
  I('vine_rope_raw', '生藤条', 'res', 0.3, 20, '未处理的粗藤，泡水后更柔韧。');
  I('branch', '树枝', 'res', 0.3, 30, '随手可得的燃料与手柄。', { fuel: 25 });
  I('stick', '木棍', 'res', 0.15, 40, '削直的木棍，几乎所有工具的柄。', { fuel: 15 });
  I('log', '原木', 'res', 6.0, 8, '沉重的原木，需要锯或斧才能加工。', { fuel: 120, place: 'log_oak' });
  I('plank', '木板', 'res', 1.2, 24, '基础建材。', { fuel: 45, place: 'planks' });
  I('beam_item', '承重木梁', 'build', 3.5, 8, '结构强度高，可做长跨度支撑。', { place: 'beam' });
  I('scrap_wood', '碎木料', 'res', 0.4, 30, '拆家具得来的碎木。', { fuel: 30 });
  I('bark', '树皮', 'res', 0.1, 30, '可熬煮成柳皮类药汤，也能引火。', { fuel: 12 });
  I('resin', '树脂', 'res', 0.1, 20, '黏稠松脂，防水与助燃。', { fuel: 40 });
  I('leaf_litter', '落叶', 'res', 0.05, 60, '引火物，也可堆肥。', { fuel: 6 });
  I('moss', '苔藓', 'res', 0.05, 60, '这个世界最不缺的东西。可做止血敷料。');
  I('straw', '干草', 'res', 0.1, 40, '铺床、堆肥、引火。', { fuel: 10 });
  I('fungal_fiber', '菌丝纤维', 'res', 0.05, 40, '异常坚韧，带着淡淡的腥味。');
  I('flint', '燧石', 'res', 0.15, 30, '敲击可取火，可做原始刃口。');
  I('cobblestone', '碎石块', 'res', 2.0, 16, '石制工具的原料。', { place: 'cobblestone' });
  I('limestone_chunk', '石灰石', 'res', 2.2, 16, '烧制后得生石灰。');
  I('lime', '生石灰', 'res', 0.6, 20, '消毒、制混凝土、处理尸体。');
  I('gravel', '砂砾', 'res', 1.6, 16, '混凝土骨料。', { place: 'gravel' });
  I('sand', '沙子', 'res', 1.5, 16, '烧玻璃、混凝土。', { place: 'sand' });
  I('dirt', '泥土', 'res', 1.4, 16, '填坑、造田。', { place: 'dirt' });
  I('rich_soil', '腐殖土', 'res', 1.3, 16, '肥沃，作物长得快。', { place: 'rich_soil' });
  I('reed_stalk', '芦苇杆', 'res', 0.1, 30, '编席、做箭杆、搭屋顶。');
  I('flower_white', '白花', 'res', 0.02, 30, '好看。也能做染料。');
  I('flower_red', '红花', 'res', 0.02, 30, '红色染料，也是一点慰藉。');
  I('clay_lump', '黏土块', 'res', 0.5, 24, '烧成砖或陶器。');
  I('mud_clump', '淤泥', 'res', 0.6, 20, '涂抹伤口不明智，但能糊墙。');
  I('peat_brick', '泥炭砖', 'res', 0.8, 20, '慢燃燃料，烟很大。', { fuel: 90 });
  I('ash_pile', '灰烬', 'res', 0.2, 30, '制皂与肥料。');
  I('coal', '煤块', 'res', 0.8, 24, '高热值燃料。', { fuel: 220 });
  I('charcoal', '木炭', 'res', 0.4, 24, '干净的燃料，也能做滤芯。', { fuel: 160 });
  I('iron_ore_chunk', '铁矿石', 'res', 2.4, 12, '需要在锻炉冶炼。');
  I('copper_ore_chunk', '铜矿石', 'res', 2.2, 12, '导电性极佳。');
  I('lead_ore_chunk', '铅矿石', 'res', 3.0, 12, '铸弹头与配重。');
  I('iron_ingot', '铁锭', 'res', 1.6, 16, '文明的骨架。');
  I('steel_ingot', '钢锭', 'res', 1.7, 16, '铁 + 炭 + 高温 = 更好的工具。');
  I('copper_ingot', '铜锭', 'res', 1.5, 16, '拉丝做电线。');
  I('lead_ingot', '铅锭', 'res', 2.2, 16, '弹头原料。');
  I('sulfur', '硫粉', 'res', 0.2, 30, '火药三要素之一。');
  I('niter', '硝石', 'res', 0.2, 30, '火药三要素之一，也能腌肉。');
  I('gunpowder', '火药', 'res', 0.2, 30, '小心存放。');
  I('quartz', '石英', 'res', 0.4, 20, '做磨石与简易光学件。');
  I('glass_shard', '玻璃碎片', 'res', 0.1, 30, '划手，也能当刀片。');
  I('glass_item', '平板玻璃', 'build', 1.0, 16, '装窗。', { place: 'glass' });
  I('brick_item', '红砖', 'build', 2.2, 16, '砌墙。', { place: 'brick' });
  I('cinder_item', '空心砖', 'build', 3.0, 12, '快速砌墙。', { place: 'cinderblock' });
  I('plaster_dust', '石膏粉', 'res', 0.5, 24, '抹墙、做夹板。');
  I('cement_powder', '水泥粉', 'res', 1.0, 20, '加水加骨料得混凝土。');
  I('concrete_item', '混凝土块', 'build', 4.0, 8, '最坚固的常规建材。', { place: 'concrete' });
  I('concrete_rubble', '混凝土碎块', 'res', 1.8, 16, '回收骨料。');
  I('rebar', '钢筋', 'res', 2.0, 12, '加固结构，也能当长矛芯。');
  I('scrap_metal', '废金属', 'res', 0.7, 30, '万能修补材料。');
  I('sheet_metal', '铁皮', 'res', 1.4, 16, '做屋面、护甲插板。', { place: 'sheet_roof' });
  I('tile_shard', '瓷砖碎片', 'res', 0.2, 30, '锋利，可做刮削器。');
  I('wire', '电线', 'part', 0.1, 30, '电路与陷阱。');
  I('plastic', '塑料碎片', 'res', 0.1, 40, '熔化重塑，或做防水层。');
  I('rubber', '橡胶', 'res', 0.3, 24, '密封、绑扎、做弹索。');
  I('tar', '沥青', 'res', 0.5, 20, '防水与纵火。', { fuel: 100 });
  I('cloth_scrap', '布条', 'res', 0.08, 40, '绷带与引信的原料。');
  I('cloth', '整块布料', 'res', 0.3, 24, '缝制衣物。');
  I('leather_raw', '生皮', 'res', 1.2, 12, '需鞣制，否则会腐臭。', { spoilable: true });
  I('leather', '皮革', 'res', 0.8, 16, '耐磨护具材料。');
  I('bone', '骨头', 'res', 0.3, 24, '做针、鱼钩、肥料。');
  I('sinew', '筋腱', 'res', 0.05, 24, '最好的弓弦。');
  I('feather', '羽毛', 'res', 0.02, 40, '箭羽。');
  I('paper', '纸张', 'res', 0.02, 60, '记录、引火、过滤。', { fuel: 4 });
  I('book', '旧书', 'misc', 0.5, 10, '也许夹着有用的东西。');
  I('spore_sample', '孢囊样本', 'res', 0.1, 20, '绿蚀的源头之一。研究它或许有解。');
  I('glow_moss_clump', '荧光苔团', 'res', 0.05, 30, '微弱但持久的冷光。', { light: 3 });
  I('soap', '碱皂', 'res', 0.15, 20, '清洁能显著降低感染风险。');
  I('charcoal_filter', '活性炭滤芯', 'part', 0.2, 10, '净水器耗材。');
  I('car_part', '汽车零件', 'part', 3.0, 6, '发动机与发电机通用件。');
  I('gear', '齿轮', 'part', 0.4, 20, '机械传动。');
  I('spring', '弹簧', 'part', 0.2, 20, '弩机与陷阱。');
  I('nails', '铁钉', 'part', 0.02, 100, '木工必备。');
  I('screws', '螺钉', 'part', 0.02, 100, '精细装配。');
  I('electronics', '电子元件', 'part', 0.3, 16, '拆自收音机、电视与仪表。');
  I('battery', '电池', 'part', 0.4, 12, '有电才有光。', { charge: 100 });
  I('battery_dead', '废电池', 'part', 0.4, 12, '可用发电机充电。');
  I('fuel_can', '汽油桶', 'res', 8.0, 2, '20L 汽油，末世硬通货。', { fuel: 900, fluid: { holds: 'gas', cap: 20 } });
  I('diesel_jug', '柴油壶', 'res', 5.0, 3, '发电机口粮。', { fuel: 700 });
  I('alcohol', '工业酒精', 'res', 0.6, 12, '消毒、燃料、麻醉。', { fuel: 60 });
  I('lens', '透镜', 'part', 0.1, 12, '聚光取火，做瞄具。');
  I('antenna_part', '天线组件', 'part', 2.0, 4, '无线电修复件。');

  /* ============================================================ 工具 */
  const TOOL = (key, name, w, o, desc) => I(key, name, 'tool', w, 1, desc, { tool: o });
  TOOL('axe_stone', '石斧', 1.8, { type: 'axe', tier: 1, speed: 1.0, dmg: 5, dur: 90 }, '绑在木棍上的燧石片。伐木的起点。');
  TOOL('axe_iron', '铁斧', 2.2, { type: 'axe', tier: 2, speed: 1.9, dmg: 8, dur: 320 }, '效率翻倍，也是称手的凶器。');
  TOOL('axe_steel', '钢斧', 2.4, { type: 'axe', tier: 3, speed: 2.9, dmg: 11, dur: 700 }, '几下就能放倒一棵大树。');
  TOOL('pick_stone', '石镐', 2.2, { type: 'pick', tier: 1, speed: 1.0, dmg: 4, dur: 80 }, '能敲开石头，但敲不动钢筋。');
  TOOL('pick_iron', '铁镐', 2.6, { type: 'pick', tier: 2, speed: 1.9, dmg: 6, dur: 300 }, '矿业的分水岭。');
  TOOL('pick_steel', '钢镐', 2.8, { type: 'pick', tier: 3, speed: 3.0, dmg: 8, dur: 680 }, '连钢筋混凝土也怕它。');
  TOOL('shovel_wood', '木铲', 1.2, { type: 'shovel', tier: 1, speed: 0.8, dmg: 3, dur: 60 }, '将就用。');
  TOOL('shovel_iron', '铁铲', 2.0, { type: 'shovel', tier: 2, speed: 1.9, dmg: 5, dur: 300 }, '挖土掘坑一把好手。');
  TOOL('hammer_stone', '石锤', 2.0, { type: 'hammer', tier: 1, speed: 1.0, dmg: 6, dur: 90 }, '砸墙、砸头。');
  TOOL('hammer_claw', '羊角锤', 1.0, { type: 'hammer', tier: 2, speed: 1.8, dmg: 6, dur: 260 }, '拔钉、钉钉、拆隔墙。');
  TOOL('crowbar', '撬棍', 3.2, { type: 'pry', tier: 2, speed: 1.6, dmg: 9, dur: 480 }, '拆金属、开门、防身，末世最实用的一根铁。');
  TOOL('crowbar_heavy', '重型液压撬', 6.5, { type: 'pry', tier: 3, speed: 2.4, dmg: 12, dur: 700 }, '连保险柜都撬得开。');
  TOOL('saw_hand', '手锯', 1.2, { type: 'saw', tier: 1, speed: 1.4, dmg: 4, dur: 220 }, '把原木变成规整木料。');
  TOOL('saw_hack', '钢锯', 1.0, { type: 'saw', tier: 2, speed: 2.0, dmg: 4, dur: 280 }, '也能锯断铁栅。');
  TOOL('knife_flint', '燧石刀', 0.4, { type: 'cut', tier: 1, speed: 1.0, dmg: 5, dur: 70 }, '割绳、剥皮、削木。');
  TOOL('knife_hunting', '猎刀', 0.5, { type: 'cut', tier: 2, speed: 1.9, dmg: 9, dur: 320 }, '处理猎物又快又干净。');
  TOOL('machete', '砍刀', 1.1, { type: 'cut', tier: 2, speed: 2.4, dmg: 13, dur: 400 }, '开路清藤的王者，对付僵尸也顺手。');
  TOOL('scythe', '镰刀', 1.4, { type: 'cut', tier: 2, speed: 2.2, dmg: 8, dur: 300 }, '大面积收割作物与杂草。');
  TOOL('wirecutter', '断线钳', 0.6, { type: 'cut', tier: 2, speed: 2.0, dmg: 4, dur: 260 }, '专治铁丝网。');
  TOOL('pliers', '尖嘴钳', 0.4, { type: 'cut', tier: 2, speed: 1.2, dmg: 3, dur: 240 }, '装配电路。');
  I('screwdriver', '螺丝刀', 'tool', 0.2, 1, '拆机器、开面板。', { tool: { type: 'pry', tier: 1, speed: 0.6, dmg: 3, dur: 200 } });
  I('sewing_kit', '缝纫包', 'tool', 0.3, 1, '缝制与修补衣物护具。', { repairs: 'cloth' });
  I('whetstone', '磨石', 'tool', 0.6, 1, '给刃具回复耐久。', { repairs: 'blade' });
  I('repair_kit', '综合修理包', 'tool', 1.2, 4, '为任何工具/武器补 40% 耐久。', { repairs: 'any', amount: 0.4 });
  I('lighter', '打火机', 'tool', 0.05, 1, '最方便的火源，燃料有限。', { igniter: 40 });
  I('matches', '火柴盒', 'tool', 0.03, 5, '20 根，怕潮。', { igniter: 20 });
  I('firesteel', '打火镁棒', 'tool', 0.1, 1, '几乎用不完，需要引火物。', { igniter: 9999 });
  I('bow_drill', '钻木取火弓', 'tool', 0.5, 1, '慢，但不消耗。', { igniter: 9999, slow: true });
  I('flashlight', '手电筒', 'tool', 0.4, 1, '需要电池，光锥明亮。', { light: 11, needBattery: true });
  I('headlamp', '头灯', 'tool', 0.3, 1, '解放双手的光。', { light: 9, needBattery: true, wear: 'head_light' });
  I('lantern_oil', '油灯', 'tool', 0.8, 1, '烧油，暖光。', { light: 8, needFuel: true });
  I('compass', '指南针', 'tool', 0.1, 1, 'HUD 显示方位。', { grants: 'compass' });
  I('map_paper', '手绘地图', 'tool', 0.2, 1, '按 M 打开；探索过的区域会被绘上。', { grants: 'map' });
  I('binoculars', '望远镜', 'tool', 0.6, 1, '按住右键放大远眺。', { grants: 'zoom' });
  I('radio_hand', '手持收音机', 'tool', 0.5, 1, '偶尔能收到广播线索……也会吸引它们。', { grants: 'radio' });
  I('geiger', '孢子检测仪', 'tool', 0.7, 1, '靠近孢子区会滴答告警。', { grants: 'spore' });
  I('watch', '机械表', 'tool', 0.05, 1, 'HUD 显示精确时间。', { grants: 'clock' });
  I('canteen', '军用水壶', 'tool', 0.4, 1, '容量 1.5L。', { fluid: { holds: 'water', cap: 1500 } });
  I('bottle_plastic', '塑料水瓶', 'tool', 0.05, 4, '容量 0.6L，脆。', { fluid: { holds: 'water', cap: 600 } });
  I('bucket', '铁桶', 'tool', 1.5, 2, '容量 5L，可提水浇地。', { fluid: { holds: 'water', cap: 5000 } });
  I('pot', '铁锅', 'tool', 2.0, 1, '煮水、炖汤，必须放在火上。', { cook: 'pot' });
  I('pan', '平底锅', 'tool', 1.2, 1, '煎烤更快，也能当盾牌用。', { cook: 'pan', tool: { type: 'hammer', tier: 1, speed: 0.4, dmg: 5, dur: 150 } });
  I('filter_pump', '手压净水器', 'tool', 1.0, 1, '直接把污水变净水，消耗滤芯。', { purify: true });
  I('fishing_rod', '钓竿', 'tool', 0.8, 1, '对着水面右键。安静、稳定的食物来源。', { fish: true });
  I('trap_snare', '绳套陷阱', 'tool', 0.5, 8, '布在草地上，能抓到小动物。', { place: 'snare' });
  I('beartrap', '捕兽夹', 'tool', 4.0, 4, '锁住任何踩上来的东西。', { place: 'beartrap' });
  I('gps', '军用 GPS', 'tool', 0.4, 1, '显示精确坐标与所有地标。', { grants: 'gps', needBattery: true });
  I('crank_charger', '手摇充电器', 'tool', 1.0, 1, '摇一分钟，换一格电。', { charger: true });

  /* ============================================================ 武器 */
  const MELEE = (key, name, w, dmg, dur, desc, extra) =>
    I(key, name, 'weap', w, 1, desc, Object.assign({ tool: { type: 'blunt', tier: 1, speed: 1, dmg, dur } }, extra || {}));
  MELEE('club_wood', '木棒', 1.2, 6, 120, '一根趁手的硬木。');
  MELEE('bat_nailed', '狼牙棒球棍', 2.0, 14, 220, '钉子朝外，很不讲道理。', { bleedChance: 0.5 });
  MELEE('pipe_lead', '铅管', 2.6, 12, 400, '沉，但耐用。');
  MELEE('spear_wood', '削尖木矛', 1.6, 11, 150, '一寸长一寸强，可投掷。', { reach: 4.2, throwable: true });
  MELEE('spear_steel', '钢头长矛', 2.4, 18, 420, '安全距离外解决问题。', { reach: 4.6, throwable: true });
  MELEE('sledge', '大锤', 7.0, 24, 400, '慢得离谱，但一击定音，还能拆墙。',
    { slow: 1.9, tool: { type: 'hammer', tier: 2, speed: 2.4, dmg: 24, dur: 400 } });
  MELEE('fire_axe', '消防斧', 3.0, 19, 500, '红色的，医院和消防站常见。',
    { tool: { type: 'axe', tier: 2, speed: 2.2, dmg: 19, dur: 500 } });
  MELEE('katana_replica', '装饰武士刀', 1.1, 21, 160, '刀装是仿的，刃是真的。', { bleedChance: 0.7 });

  I('bow_wood', '自制木弓', 'weap', 1.0, 1, '安静。用筋腱做弦最好。', { gun: { ammo: 'arrow', dmg: 16, mag: 1, rpm: 45, noise: 4, spread: 0.02, draw: 0.9, kind: 'bow' } });
  I('crossbow', '十字弩', 'weap', 2.6, 1, '威力大、上弦慢、依然很安静。', { gun: { ammo: 'bolt', dmg: 26, mag: 1, rpm: 22, noise: 6, spread: 0.008, draw: 1.6, kind: 'bow' } });
  I('slingshot', '弹弓', 'weap', 0.3, 1, '打鸟够用了。', { gun: { ammo: 'pebble', dmg: 6, mag: 1, rpm: 60, noise: 2, spread: 0.05, draw: 0.4, kind: 'bow' } });
  I('pistol_9mm', '9mm 手枪', 'weap', 0.9, 1, '轻便可靠，声音会招来麻烦。', { gun: { ammo: 'ammo_9mm', dmg: 22, mag: 12, rpm: 260, noise: 34, spread: 0.02, kind: 'gun' } });
  I('revolver_357', '.357 左轮', 'weap', 1.2, 1, '六发，一发一个。', { gun: { ammo: 'ammo_357', dmg: 34, mag: 6, rpm: 110, noise: 40, spread: 0.018, kind: 'gun' } });
  I('shotgun_pump', '泵动霰弹枪', 'weap', 3.2, 1, '近距离绝对话事权。', { gun: { ammo: 'ammo_shell', dmg: 14, pellets: 6, mag: 5, rpm: 60, noise: 48, spread: 0.07, kind: 'gun' } });
  I('rifle_hunting', '猎用步枪', 'weap', 3.6, 1, '远距离、高伤害、巨响。', { gun: { ammo: 'ammo_762', dmg: 52, mag: 5, rpm: 45, noise: 52, spread: 0.006, kind: 'gun', scope: 1.8 } });
  I('smg_9mm', '9mm 冲锋枪', 'weap', 2.8, 1, '弹雨。别在城里用。', { gun: { ammo: 'ammo_9mm', dmg: 18, mag: 30, rpm: 720, noise: 40, spread: 0.035, kind: 'gun', auto: true } });
  I('suppressor', '消音器', 'part', 0.4, 1, '装在手枪/冲锋枪上，噪音减半。', { attach: 'muzzle' });
  I('scope_optic', '光学瞄具', 'part', 0.5, 1, '提升精度与放大。', { attach: 'optic' });
  I('molotov', '汽油弹', 'weap', 0.8, 6, '扔出去，烧一片。', { throwable: 'fire' });
  I('grenade_frag', '破片手雷', 'weap', 0.5, 4, '拉环、数三秒、扔远点。', { throwable: 'frag' });
  I('smoke_bomb', '烟雾弹', 'weap', 0.4, 6, '遮蔽视线，脱身用。', { throwable: 'smoke' });
  I('noise_maker', '响铃诱饵', 'weap', 0.6, 6, '把它们引到别处去。', { throwable: 'lure' });
  I('firecracker', '鞭炮', 'weap', 0.2, 10, '廉价的噪音诱饵。', { throwable: 'lure' });

  const AMMO = (key, name, w, desc) => I(key, name, 'ammo', w, 120, desc, { ammo: true });
  AMMO('arrow', '木箭', 0.06, '可回收。羽毛做尾翼。');
  AMMO('arrow_bone', '骨镞箭', 0.07, '穿透更好。');
  AMMO('bolt', '弩箭', 0.08, '短而重。');
  AMMO('pebble', '石弹', 0.03, '路上随手捡。');
  AMMO('ammo_9mm', '9mm 子弹', 0.012, '最常见的口径。');
  AMMO('ammo_357', '.357 弹', 0.02, '停止作用惊人。');
  AMMO('ammo_shell', '12 号霰弹', 0.05, '铅丸满膛。');
  AMMO('ammo_762', '7.62 步枪弹', 0.025, '猎大型目标。');

  /* ============================================================ 护具 */
  const ARM = (key, name, w, slot, def, warm, rain, desc, extra) =>
    I(key, name, 'armor', w, 1, desc, Object.assign({ armor: { slot, def, warm, rain }, dur: 100 + def * 30 }, extra || {}));
  ARM('cap_cloth', '布帽', 0.2, 'head', 1, 2, 0, '至少能挡雨滴。');
  ARM('helmet_bike', '自行车头盔', 0.5, 'head', 4, 1, 0, '轻，能挡一次咬击。');
  ARM('helmet_riot', '防暴头盔', 1.8, 'head', 9, 2, 1, '带面罩，视野略窄。');
  ARM('helmet_steel', '钢盔', 1.5, 'head', 11, 1, 1, '沉，但硬。');
  ARM('gasmask', '防毒面具', 1.0, 'face', 2, 1, 0, '孢子区的通行证，需滤罐。', { blocksSpore: true, needFilter: true });
  ARM('respirator', '半面呼吸器', 0.4, 'face', 1, 0, 0, '过滤大半孢子。', { blocksSpore: 0.6, needFilter: true });
  I('mask_filter', '滤罐', 'part', 0.2, 8, '防毒面具耗材，会逐渐堵塞。');
  ARM('shirt_worn', '旧衬衫', 0.3, 'chest', 1, 4, 0, '总比赤膊好。');
  ARM('jacket_canvas', '帆布夹克', 1.0, 'chest', 4, 10, 2, '耐磨，口袋多。', { slots: 2 });
  ARM('jacket_leather', '皮夹克', 1.8, 'chest', 7, 12, 4, '牙咬不透。', { slots: 2 });
  ARM('vest_stab', '防刺背心', 2.6, 'chest', 12, 4, 2, '专门针对撕咬与利器。', { biteResist: 0.6 });
  ARM('vest_kevlar', '凯夫拉战术背心', 4.2, 'chest', 18, 6, 3, '还带弹匣袋。', { slots: 4, biteResist: 0.5 });
  ARM('raincoat', '雨衣', 0.7, 'chest', 1, 6, 10, '暴雨天的救命装备。');
  ARM('pants_jeans', '牛仔裤', 0.7, 'legs', 3, 8, 1, '结实的日常。');
  ARM('pants_cargo', '工装裤', 0.9, 'legs', 4, 9, 2, '腿袋能塞东西。', { slots: 2 });
  ARM('pants_padded', '护垫防护裤', 1.6, 'legs', 9, 10, 2, '膝部有硬壳。');
  ARM('boots_sneaker', '运动鞋', 0.6, 'feet', 1, 3, 0, '安静，跑得快。', { quiet: 0.3, speed: 0.03 });
  ARM('boots_work', '工装靴', 1.3, 'feet', 5, 7, 5, '不怕钉子和碎玻璃。', { spikeImmune: true });
  ARM('boots_rubber', '雨靴', 1.0, 'feet', 3, 5, 9, '涉水不湿脚。', { waterproof: true });
  ARM('gloves_work', '劳保手套', 0.2, 'hands', 2, 3, 0, '徒手作业不再流血。', { noHandCut: true });
  ARM('gloves_tactical', '战术手套', 0.25, 'hands', 3, 4, 1, '握持更稳。', { noHandCut: true, aim: 0.15 });
  I('backpack_small', '小背包', 'armor', 0.8, 1, '+8 格容量。', { armor: { slot: 'back', def: 1, warm: 1, rain: 0 }, slots: 8 });
  I('backpack_hiking', '登山包', 'armor', 1.8, 1, '+16 格容量，负重上限 +12kg。', { armor: { slot: 'back', def: 2, warm: 2, rain: 1 }, slots: 16, carry: 12 });
  I('backpack_military', '军用背囊', 'armor', 2.6, 1, '+24 格容量，负重上限 +20kg。', { armor: { slot: 'back', def: 3, warm: 2, rain: 2 }, slots: 24, carry: 20 });

  /* ============================================================ 食物 */
  const FOOD = (key, name, w, stack, cal, water, desc, extra) =>
    I(key, name, 'food', w, stack, desc, Object.assign({ food: { cal, water, heal: 0, infect: 0, sick: 0, spoil: 0 } }, extra || {}));
  FOOD('berries', '野浆果', 0.05, 40, 6, 4, '酸甜，吃不饱。', { food: { cal: 6, water: 4, spoil: 30 } });
  FOOD('apple', '野苹果', 0.15, 20, 10, 6, '树上还能找到没烂的。', { food: { cal: 10, water: 6, spoil: 60 } });
  FOOD('fern_shoot', '蕨芽', 0.05, 30, 4, 2, '生吃发涩，煮过更好。', { food: { cal: 4, water: 2, sick: 0.06, spoil: 24 } });
  FOOD('cattail_root', '香蒲根', 0.1, 24, 8, 3, '富含淀粉，煮熟才顶饿。', { food: { cal: 8, water: 3, sick: 0.05, spoil: 40 } });
  FOOD('mushroom_brown', '褐菇', 0.05, 30, 5, 2, '常见食用菌。', { food: { cal: 5, water: 2, spoil: 20 } });
  FOOD('mushroom_toxic', '斑伞菇', 0.05, 30, 3, 1, '别吃。真的。', { food: { cal: 3, water: 1, sick: 0.85, spoil: 20 } });
  FOOD('wheat', '麦粒', 0.1, 40, 3, 0, '要磨粉才好用。', { food: { cal: 3, water: 0 } });
  FOOD('flour', '面粉', 0.1, 40, 4, 0, '面包的前身。');
  FOOD('bread', '烤面包', 0.4, 12, 32, 2, '扎实的主食。', { food: { cal: 32, water: 2, spoil: 120 } });
  FOOD('corn', '玉米', 0.2, 24, 12, 4, '烤着吃最香。', { food: { cal: 12, water: 4, spoil: 70 } });
  FOOD('corn_roasted', '烤玉米', 0.2, 24, 20, 3, '焦香。', { food: { cal: 20, water: 3, spoil: 40 } });
  FOOD('potato', '马铃薯', 0.2, 24, 8, 3, '生的不好消化。', { food: { cal: 8, water: 3, sick: 0.1, spoil: 200 } });
  FOOD('potato_baked', '烤马铃薯', 0.2, 24, 24, 3, '完美的碳水。', { food: { cal: 24, water: 3, spoil: 50 } });
  FOOD('carrot', '胡萝卜', 0.1, 30, 8, 5, '生吃也不错。', { food: { cal: 8, water: 5, spoil: 90 } });
  FOOD('tomato', '番茄', 0.15, 24, 7, 9, '水分很足。', { food: { cal: 7, water: 9, spoil: 40 } });
  FOOD('cabbage', '甘蓝', 0.5, 12, 10, 7, '能放很久。', { food: { cal: 10, water: 7, spoil: 150 } });
  FOOD('beans', '豆角', 0.2, 24, 9, 3, '生豆角有毒，务必煮熟。', { food: { cal: 9, water: 3, sick: 0.3, spoil: 60 } });
  FOOD('pumpkin', '南瓜', 1.5, 6, 16, 8, '沉，但顶饿。', { food: { cal: 16, water: 8, spoil: 240 } });
  FOOD('pumpkin_soup', '南瓜汤', 0.6, 6, 34, 26, '温暖从胃里升起来。', { food: { cal: 34, water: 26, warm: 6, spoil: 20 } });
  FOOD('meat_raw', '生肉', 0.6, 12, 12, 2, '别生吃。', { food: { cal: 12, water: 2, sick: 0.55, infect: 0.05, spoil: 14 } });
  FOOD('meat_cooked', '熟肉', 0.5, 12, 34, 2, '蛋白质到位。', { food: { cal: 34, water: 2, heal: 2, spoil: 36 } });
  FOOD('jerky', '肉干', 0.2, 24, 22, -4, '能存很久，但吃了口渴。', { food: { cal: 22, water: -4, spoil: 900 } });
  FOOD('fish_raw', '生鱼', 0.4, 12, 10, 4, '寄生虫风险。', { food: { cal: 10, water: 4, sick: 0.45, spoil: 10 } });
  FOOD('fish_cooked', '烤鱼', 0.35, 12, 26, 4, '河边的日常。', { food: { cal: 26, water: 4, heal: 1, spoil: 30 } });
  FOOD('egg', '鸟蛋', 0.06, 16, 7, 2, '生吃有风险。', { food: { cal: 7, water: 2, sick: 0.25, spoil: 60 } });
  FOOD('egg_cooked', '煎蛋', 0.06, 16, 15, 2, '简单的幸福。', { food: { cal: 15, water: 2, spoil: 24 } });
  FOOD('stew_meat', '炖肉', 0.8, 4, 52, 30, '一锅救三天。', { food: { cal: 52, water: 30, heal: 6, warm: 8, spoil: 24 } });
  FOOD('stew_veg', '杂菜汤', 0.8, 4, 38, 34, '素也能吃得很好。', { food: { cal: 38, water: 34, heal: 3, warm: 8, spoil: 20 } });
  FOOD('can_beans', '罐头豆子', 0.4, 12, 30, 12, '末世标配。永不过期。', { food: { cal: 30, water: 12 } });
  FOOD('can_meat', '午餐肉罐头', 0.4, 12, 38, 6, '油腻但管饱。', { food: { cal: 38, water: 6 } });
  FOOD('can_peach', '桃罐头', 0.45, 12, 24, 22, '甜到想哭。', { food: { cal: 24, water: 22 } });
  FOOD('can_soup', '浓汤罐头', 0.45, 12, 28, 20, '加热更好喝。', { food: { cal: 28, water: 20 } });
  FOOD('can_dogfood', '狗粮罐头', 0.4, 12, 22, 8, '人也能吃。就是心理上过不去。', { food: { cal: 22, water: 8, sick: 0.08 } });
  FOOD('chocolate', '巧克力', 0.1, 20, 18, -2, '高热量，还提神。', { food: { cal: 18, water: -2, stam: 15, spoil: 600 } });
  FOOD('energy_bar', '能量棒', 0.08, 20, 20, -1, '登山客的口粮。', { food: { cal: 20, water: -1, stam: 20 } });
  FOOD('chips', '薯片', 0.06, 16, 10, -5, '空热量，还很响。', { food: { cal: 10, water: -5, noise: 8 } });
  FOOD('crackers', '苏打饼干', 0.15, 16, 16, -3, '干得咬不下去。', { food: { cal: 16, water: -3 } });
  FOOD('honey', '野蜂蜜', 0.3, 8, 20, 2, '能量、抗菌、伤口敷料。', { food: { cal: 20, water: 2, heal: 3, infect: -0.05 } });
  FOOD('milk_powder', '奶粉', 0.3, 12, 18, 4, '冲水喝，营养均衡。', { food: { cal: 18, water: 4 } });
  FOOD('salt', '盐', 0.1, 30, 1, -6, '腌制保存的关键。', { food: { cal: 1, water: -6 } });
  FOOD('bone_broth', '骨汤', 0.7, 4, 26, 32, '把骨头煮出最后一点营养。', { food: { cal: 26, water: 32, heal: 4, warm: 9, spoil: 18 } });

  /* ============================================================ 饮品 */
  const DRINK = (key, name, w, stack, water, desc, extra) =>
    I(key, name, 'drink', w, stack, desc, Object.assign({ drink: { water, sick: 0, infect: 0, warm: 0 } }, extra || {}));
  DRINK('water_dirty_bottle', '一瓶污水', 0.65, 8, 30, '看得见的悬浮物。喝了大概会病。', { drink: { water: 30, sick: 0.6 } });
  DRINK('water_clean_bottle', '一瓶净水', 0.65, 8, 34, '过滤或煮沸过，安全。', { drink: { water: 34 } });
  DRINK('water_bottled', '瓶装矿泉水', 0.55, 8, 32, '灾前生产，仍然完好。', { drink: { water: 32 } });
  DRINK('soda', '碳酸饮料', 0.4, 12, 22, '糖分与气泡。', { drink: { water: 22 }, food: { cal: 10, water: 22 } });
  DRINK('coffee', '热咖啡', 0.4, 6, 24, '驱散疲劳的黑色魔法。', { drink: { water: 24, warm: 7, fatigue: -25, stam: 25 } });
  DRINK('tea_herb', '草药茶', 0.4, 6, 28, '薄荷与柳皮，退烧安神。', { drink: { water: 28, warm: 8, sickCure: 0.25, pain: 20 } });
  DRINK('booze', '烈酒', 0.5, 8, 8, '暖身是假的，麻醉是真的。', { drink: { water: 8, warm: 4, pain: 40, sick: 0.05, drunk: 40 } });
  DRINK('energy_drink', '能量饮料', 0.35, 12, 20, '心跳加速。', { drink: { water: 20, stam: 45, fatigue: -35 } });
  DRINK('rain_water', '接来的雨水', 0.6, 8, 30, '比河水干净，但仍建议煮沸。', { drink: { water: 30, sick: 0.15 } });

  /* ============================================================ 医疗 */
  const MED = (key, name, w, stack, desc, med) => I(key, name, 'med', w, stack, desc, { med });
  MED('rag_bandage', '布条绷带', 0.05, 20, '止住流血，但不干净。', { heal: 3, bleed: 1, infect: 0.12, time: 2.5 });
  MED('bandage_sterile', '无菌敷料', 0.05, 20, '干净地止血。', { heal: 6, bleed: 1, infect: -0.02, time: 2 });
  MED('moss_dressing', '苔藓敷料', 0.05, 20, '古法止血，意外地有效。', { heal: 4, bleed: 1, infect: 0.03, time: 3 });
  MED('tourniquet', '止血带', 0.15, 6, '大出血的最后手段。', { bleed: 2, heal: 0, time: 3 });
  MED('suture_kit', '缝合包', 0.3, 6, '处理深创口，痛。', { heal: 18, bleed: 2, pain: -20, time: 8 });
  MED('splint', '夹板', 0.5, 4, '固定骨折的腿。', { fracture: 1, time: 6 });
  MED('antiseptic', '碘伏', 0.2, 8, '大幅降低伤口感染。', { infect: -0.35, time: 3 });
  MED('antibiotics', '抗生素', 0.05, 12, '治疗细菌性疾病，抑制感染。', { sick: -0.8, infect: -0.25, time: 2 });
  MED('painkiller', '止痛药', 0.03, 16, '疼痛消失，问题还在。', { pain: 60, time: 1.5 });
  MED('antipyretic', '退烧药', 0.03, 16, '压下高烧。', { fever: -1, sick: -0.3, time: 1.5 });
  MED('vitamin', '维生素片', 0.02, 20, '缓慢改善整体状态。', { regen: 30, time: 1 });
  MED('adrenaline', '肾上腺素笔', 0.1, 6, '瞬间清醒，代价随后到来。', { stam: 100, pain: 80, boost: 25, time: 1 });
  MED('serum_green', '抗孢血清', 0.2, 6, '直接压制感染度。稀有。', { infect: -0.9, time: 4 });
  MED('vaccine_proto', '试验疫苗', 0.25, 4, '据说能获得抗性。主线关键。', { infect: -1, immune: 1, time: 6 });
  MED('herb_yarrow', '蓍草', 0.02, 30, '天然止血，可直接敷。', { bleed: 1, heal: 1, infect: 0.05, time: 3 });
  MED('herb_mint', '野薄荷', 0.02, 30, '缓解恶心，做草药茶。', { sick: -0.1, time: 2 });
  MED('willow_bark', '柳树皮', 0.03, 30, '天然阿司匹林。', { pain: 25, fever: -0.5, time: 2 });
  MED('charcoal_tablet', '活性炭片', 0.02, 20, '解食物中毒。', { sick: -0.5, time: 2 });

  /* ============================================================ 种子 */
  const SEED = (key, name, crop, desc) => I(key, name, 'seed', 0.02, 40, desc, { seed: crop });
  SEED('seed_wheat', '小麦种子', 'crop_wheat', '主食的来源。');
  SEED('seed_corn', '玉米种子', 'crop_corn', '高产。');
  SEED('seed_potato', '马铃薯种薯', 'crop_potato', '耐贫瘠。');
  SEED('seed_carrot', '胡萝卜种子', 'crop_carrot', '快熟。');
  SEED('seed_tomato', '番茄种子', 'crop_tomato', '需要多浇水。');
  SEED('seed_pumpkin', '南瓜种子', 'crop_pumpkin', '占地大，回报高。');
  SEED('seed_bean', '豆种', 'crop_bean', '固氮，改良土壤。');
  SEED('seed_cabbage', '甘蓝种子', 'crop_cabbage', '耐寒。');
  I('sapling_oak', '橡树苗', 'seed', 0.1, 16, '几天后长成可伐的树。', { place: 'sapling_oak_b' });
  I('sapling_pine', '松树苗', 'seed', 0.1, 16, '生长快，出松脂。', { place: 'sapling_pine_b' });
  I('sapling_birch', '桦树苗', 'seed', 0.1, 16, '树皮好用。', { place: 'sapling_oak_b' });
  I('fertilizer', '堆肥', 'seed', 0.5, 20, '作物生长速度 +60%。', { fertilizer: 0.6 });

  /* ========================================================== 建材/家具 */
  const PLACE = (key, name, w, stack, block, desc) => I(key, name, 'build', w, stack, desc, { place: block });
  PLACE('workbench_item', '工作台', 12, 1, 'workbench', '大部分配方的前提。');
  PLACE('furnace_item', '土窑', 20, 1, 'furnace', '烧木炭、烧砖、烧石灰。');
  PLACE('forge_item', '锻炉', 30, 1, 'forge', '冶炼金属、锻造钢件。');
  PLACE('chem_bench_item', '化学台', 18, 1, 'chem_bench', '药品、火药、血清。');
  PLACE('stove_item', '灶台', 22, 1, 'stove', '稳定的烹饪火源，不引僵尸。');
  PLACE('drying_rack_item', '晾晒架', 4, 1, 'drying_rack', '做肉干、晒草药、鞣皮。');
  PLACE('water_collector_item', '集雨器', 6, 1, 'water_collector', '下雨自动积水。');
  PLACE('planter_item', '育苗箱', 5, 4, 'planter', '室内也能种。');
  PLACE('chest_item', '储物箱', 8, 4, 'chest', '30 格储物。');
  PLACE('bed_item', '床铺', 15, 1, 'bed_old', '睡觉恢复疲劳，设为重生点。');
  PLACE('door_wood_item', '木门', 8, 4, 'door_wood', '挡视线也挡僵尸。');
  PLACE('door_metal_item', '铁门', 22, 2, 'door_metal', '很难被砸开。');
  PLACE('fence_item', '木栅栏', 3, 12, 'fence_wood', '划出地盘。');
  PLACE('ladder_item', '梯子', 2, 16, 'ladder', '垂直交通。');
  PLACE('torch_item', '火把', 0.3, 16, 'torch', '照明，会引来注意。');
  PLACE('lamp_item', '电灯', 1.2, 8, 'lamp_off', '需要通电。');
  PLACE('solar_panel_item', '太阳能板', 8, 4, 'solar_panel', '白天发电，安静。');
  PLACE('generator_item', '柴油发电机', 45, 1, 'generator', '强力但吵，会吸引僵尸。');
  PLACE('sandbag_item', '沙袋', 18, 8, 'sandbag', '快速筑掩体。');
  PLACE('tarp_item', '防水布', 1.5, 8, 'tarp', '简易屋顶与遮蔽。');
  PLACE('barbed_item', '铁蒺藜', 3, 8, 'barbed_wire', '拖慢并划伤靠近者。');
  PLACE('chainlink_item', '铁丝网', 4, 8, 'chainlink', '能看见外面的墙。');
  PLACE('sheet_metal_roof', '铁皮屋面', 2, 12, 'sheet_roof', '不漏雨。');
  PLACE('plank_floor_item', '木地板', 1, 24, 'plank_floor', '踩着不响（更安静）。');
  PLACE('campfire_item', '篝火堆', 3, 4, 'campfire', '取暖、烧水、烤肉。');
  PLACE('sign_item', '路牌', 2, 8, 'sign_post', '给自己留个记号。');
  PLACE('torch_wall', '壁挂火把', 0.3, 16, 'torch', '插在墙上。');

  /* ========================================================== 关键物品 */
  const KEY = (key, name, w, desc, extra) => I(key, name, 'key', w, 1, desc, Object.assign({ unique: true }, extra || {}));
  KEY('keycard_blue', '蓝色钥匙卡', 0.02, '打开民用/办公区域的锁门。', { unlocks: 'blue', stack: 4 });
  KEY('keycard_red', '红色钥匙卡', 0.02, '医院与实验区权限。', { unlocks: 'red', stack: 4 });
  KEY('keycard_yellow', '黄色钥匙卡', 0.02, '军事与地下掩体权限。', { unlocks: 'yellow', stack: 4 });
  KEY('radio_part_tube', '功放电子管', 1.0, '无线电修复件 1/4。', { radioPart: 1 });
  KEY('radio_part_board', '调谐主板', 0.8, '无线电修复件 2/4。', { radioPart: 2 });
  KEY('radio_part_ant', '定向天线', 3.0, '无线电修复件 3/4。', { radioPart: 3 });
  KEY('radio_part_gen', '稳压模块', 1.5, '无线电修复件 4/4。', { radioPart: 4 });
  KEY('lab_sample', '低温样本管', 0.4, '实验室里唯一还完好的东西。');
  KEY('research_notes', '研究笔记', 0.3, '关于绿蚀起源的记录。');
  KEY('map_fragment', '地图碎片', 0.05, '揭示一处未知地标。', { stack: 12 });

  /* ---- 图纸（解锁高级配方，实现"自由拓展"式进度） ---- */
  const SCHEM = (key, name, unlock, desc) => I(key, name, 'key', 0.05, 1, desc, { schematic: unlock });
  SCHEM('schem_steel', '图纸：炼钢', 'steel', '铁 + 木炭 + 持续高温。');
  SCHEM('schem_gun', '图纸：枪械维护', 'gunsmith', '自制弹药与枪械修复。');
  SCHEM('schem_power', '图纸：离网供电', 'power', '发电、蓄电与照明网络。');
  SCHEM('schem_chem', '图纸：野战制药', 'chem', '抗生素与血清合成。');
  SCHEM('schem_water', '图纸：净水工程', 'water', '大型滤水与集雨系统。');
  SCHEM('schem_armor', '图纸：复合护甲', 'armor', '把铁皮缝进背心里。');
  SCHEM('schem_farm', '图纸：温室农业', 'farm', '育苗、堆肥与高产种植。');
  SCHEM('schem_radio', '图纸：长波通讯', 'radio', '把废电台改造成求救信标。');

  /* --------- 笔记（世界叙事，捡到即入日志） --------- */
  for (let i = 1; i <= 14; i++) {
    I('note_' + i, '手写笔记 #' + i, 'key', 0.02, 1, '捡起后会自动收进日志。', { note: i });
  }

  /* ============================================================= 杂项 */
  I('scrap_leather_pouch', '皮质小包', 'misc', 0.3, 4, '装零碎的东西。');
  I('lighter_empty', '空打火机', 'misc', 0.04, 8, '加酒精可复用。');
  I('bottle_empty', '空瓶', 'misc', 0.05, 12, '装水或做汽油弹。', { fluid: { holds: 'water', cap: 600 } });
  I('can_empty', '空罐头', 'misc', 0.06, 16, '做警报绳、当锅用。');
  I('bucket_empty', '空铁桶', 'misc', 1.4, 2, '提水。', { fluid: { holds: 'water', cap: 5000 } });
  I('trinket_photo', '一张全家照', 'misc', 0.01, 8, '照片背面写着"别回来找我们"。');
  I('coin_stash', '一把硬币', 'misc', 0.2, 12, '现在只是金属。');
  I('watch_broken', '停摆的手表', 'misc', 0.05, 8, '指针停在 04:17。');
  I('dogtag', '身份识别牌', 'misc', 0.02, 12, '第 3 机步营。');

  /* ------------------------------------------------------------ 查询 */
  function get(key) { return items[key] || null; }
  function nameOf(key) { const it = items[key]; return it ? it.name : key; }
  function stackOf(key) { const it = items[key]; return it ? (it.stack || 1) : 1; }
  function weightOf(key) { const it = items[key]; return it ? (it.w || 0) : 0; }
  function isTool(key) { const it = items[key]; return !!(it && (it.tool || it.gun)); }
  function maxDur(key) {
    const it = items[key]; if (!it) return 0;
    if (it.tool && it.tool.dur) return it.tool.dur;
    if (it.gun) return 400;
    if (it.dur) return it.dur;
    return 0;
  }
  function byCat(cat) { return order.filter((k) => items[k].cat === cat); }

  GF.Items = {
    all: items, order, CATS, get, nameOf, stackOf, weightOf, isTool, maxDur, byCat,
    count: () => order.length,
    /** MOD 接口：注册新物品（必须在 GF.boot() 之前调用） */
    define: I,
  };
})(globalThis.GF = globalThis.GF || {});
