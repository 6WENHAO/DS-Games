/* =========================================================================
 * GREENFALL · recipes.js —— 合成配方 + 知识/图纸解锁
 *
 * R(产物, 数量, [[材料,数量]...], 工作站, 耗时秒, {opt})
 *   station : hand 徒手 | workbench 工作台 | furnace 土窑 | forge 锻炉
 *             chem 化学台 | fire 火源(篝火/灶) | dry 晾晒架
 *   opt.need : 需要背包里持有某类工具（不消耗），如 'saw' / 'cut' / 'hammer'
 *   opt.needItem : 需要持有某件具体物品（不消耗），如 'pot'
 *   opt.unlock : 需要先获得对应图纸
 *   opt.fuel : 该配方需要燃料（furnace/forge/fire 会消耗）
 * ======================================================================= */
(function (GF) {
  'use strict';

  const all = [];
  const STATIONS = {
    hand: { name: '徒手制作', icon: '✋' },
    workbench: { name: '工作台', icon: '🛠' },
    furnace: { name: '土窑', icon: '🔥' },
    forge: { name: '锻炉', icon: '⚒' },
    chem: { name: '化学台', icon: '⚗' },
    fire: { name: '火源', icon: '🍲' },
    dry: { name: '晾晒架', icon: '🌬' },
  };
  const UNLOCKS = {
    steel: '炼钢', gunsmith: '枪械维护', power: '离网供电', chem: '野战制药',
    water: '净水工程', armor: '复合护甲', farm: '温室农业', radio: '长波通讯',
  };

  function R(out, n, ins, station, time, opt) {
    const r = Object.assign({
      id: all.length, out, n, ins, station, time: time || 1,
      need: null, needItem: null, unlock: null, fuel: 0, cat: null,
    }, opt || {});
    all.push(r);
    return r;
  }

  /* =================================================== 徒手（石器时代） */
  R('cord', 1, [['fiber', 3]], 'hand', 1.5);
  R('rope', 1, [['cord', 4]], 'hand', 4);
  R('rope', 1, [['vine_rope_raw', 3]], 'hand', 3);
  R('stick', 2, [['branch', 1]], 'hand', 1.2, { need: 'cut' });
  R('stick', 1, [['branch', 1]], 'hand', 3.5);              // 徒手掰断，效率减半
  R('stick', 1, [['plank', 1]], 'hand', 1, { need: 'cut' });
  R('pebble', 6, [['gravel', 1]], 'hand', 1);
  R('flint', 1, [['gravel', 2]], 'hand', 2);
  R('cobblestone', 1, [['gravel', 3]], 'hand', 3.5);        // 从砂砾里挑出大石块
  R('knife_flint', 1, [['flint', 2], ['stick', 1], ['cord', 1]], 'hand', 6);
  R('axe_stone', 1, [['flint', 3], ['stick', 2], ['cord', 2]], 'hand', 9);
  R('pick_stone', 1, [['cobblestone', 3], ['stick', 2], ['cord', 2]], 'hand', 9);
  R('hammer_stone', 1, [['cobblestone', 2], ['stick', 1], ['cord', 2]], 'hand', 7);
  R('shovel_wood', 1, [['plank', 2], ['stick', 1], ['cord', 1]], 'hand', 6);
  R('spear_wood', 1, [['stick', 3], ['cord', 2]], 'hand', 6, { need: 'cut' });
  R('club_wood', 1, [['branch', 2], ['cord', 1]], 'hand', 3);
  R('bow_drill', 1, [['stick', 2], ['cord', 1], ['plank', 1]], 'hand', 8);
  R('campfire_item', 1, [['branch', 4], ['cobblestone', 4], ['leaf_litter', 2]], 'hand', 6);
  R('torch_item', 3, [['stick', 3], ['cloth_scrap', 2], ['resin', 1]], 'hand', 4);
  R('rag_bandage', 2, [['cloth_scrap', 2]], 'hand', 2);
  R('moss_dressing', 2, [['moss', 3], ['cloth_scrap', 1]], 'hand', 2.5);
  R('trap_snare', 1, [['cord', 3], ['stick', 2]], 'hand', 5);
  R('workbench_item', 1, [['log', 2], ['plank', 4], ['cord', 3]], 'hand', 14);
  R('furnace_item', 1, [['cobblestone', 12], ['clay_lump', 6]], 'hand', 18);
  R('bottle_empty', 1, [['plastic', 3]], 'hand', 2);
  R('leaf_litter', 2, [['straw', 1]], 'hand', 1);
  R('cloth_scrap', 3, [['cloth', 1]], 'hand', 1.5, { need: 'cut' });
  R('plank', 2, [['scrap_wood', 3], ['nails', 2]], 'hand', 3, { need: 'hammer' });
  R('noise_maker', 1, [['can_empty', 2], ['pebble', 4], ['cord', 1]], 'hand', 3);

  /* ======================================================== 工作台：木作 */
  R('plank', 4, [['log', 1]], 'workbench', 5, { need: 'saw', cat: '木作' });
  R('plank', 2, [['log', 1]], 'hand', 9, { need: 'axe', cat: '木作' });
  R('beam_item', 1, [['log', 2], ['nails', 4]], 'workbench', 8, { need: 'saw' });
  R('plank_floor_item', 4, [['plank', 3], ['nails', 4]], 'workbench', 5, { need: 'hammer' });
  R('door_wood_item', 1, [['plank', 6], ['nails', 6]], 'workbench', 10, { need: 'hammer' });
  R('fence_item', 4, [['plank', 3], ['stick', 4], ['nails', 4]], 'workbench', 6, { need: 'hammer' });
  R('ladder_item', 3, [['stick', 8], ['nails', 6]], 'workbench', 6, { need: 'hammer' });
  R('chest_item', 1, [['plank', 8], ['nails', 8], ['scrap_metal', 1]], 'workbench', 12, { need: 'hammer' });
  R('bed_item', 1, [['plank', 6], ['cloth', 3], ['straw', 6]], 'workbench', 15);
  R('drying_rack_item', 1, [['stick', 8], ['cord', 6]], 'workbench', 8);
  R('planter_item', 2, [['plank', 4], ['rich_soil', 2], ['nails', 4]], 'workbench', 6);
  R('sign_item', 1, [['plank', 2], ['stick', 1]], 'workbench', 3);
  R('saw_hand', 1, [['sheet_metal', 1], ['stick', 1], ['screws', 2]], 'workbench', 8);

  /* ================================================== 工作台：狩猎/远程 */
  R('bow_wood', 1, [['stick', 4], ['cord', 3]], 'workbench', 10);
  R('bow_wood', 1, [['stick', 4], ['sinew', 2]], 'workbench', 9, { cat: '远程' });
  R('arrow', 6, [['stick', 2], ['flint', 2], ['feather', 3]], 'workbench', 6);
  R('arrow_bone', 6, [['reed_stalk', 3], ['bone', 2], ['feather', 3]], 'workbench', 6);
  R('bolt', 6, [['stick', 2], ['scrap_metal', 1], ['feather', 2]], 'workbench', 6);
  R('crossbow', 1, [['plank', 3], ['sheet_metal', 2], ['spring', 1], ['cord', 3]], 'workbench', 20);
  R('slingshot', 1, [['stick', 2], ['rubber', 2], ['leather', 1]], 'workbench', 5);
  R('fishing_rod', 1, [['stick', 3], ['cord', 3], ['bone', 1]], 'workbench', 8);
  R('bat_nailed', 1, [['club_wood', 1], ['nails', 12]], 'workbench', 6, { need: 'hammer' });
  R('spear_steel', 1, [['stick', 3], ['steel_ingot', 1], ['cord', 2]], 'workbench', 12, { unlock: 'steel' });
  R('beartrap', 1, [['scrap_metal', 6], ['spring', 2], ['gear', 1]], 'workbench', 15);

  /* =============================================== 工作台：容器与生活 */
  R('sewing_kit', 1, [['bone', 1], ['cord', 2], ['cloth_scrap', 2]], 'workbench', 5);
  R('cloth', 1, [['fiber', 12]], 'workbench', 6, { needItem: 'sewing_kit', cat: '缝制' });
  R('cloth', 1, [['cloth_scrap', 4]], 'workbench', 4, { needItem: 'sewing_kit' });
  R('backpack_small', 1, [['cloth', 4], ['cord', 4], ['leather', 1]], 'workbench', 14, { needItem: 'sewing_kit' });
  R('backpack_hiking', 1, [['cloth', 8], ['leather', 3], ['rope', 2], ['scrap_metal', 2]], 'workbench', 22, { needItem: 'sewing_kit' });
  R('backpack_military', 1, [['backpack_hiking', 1], ['leather', 4], ['sheet_metal', 2], ['cord', 6]], 'workbench', 30, { needItem: 'sewing_kit', unlock: 'armor' });
  R('shirt_worn', 1, [['cloth', 3]], 'workbench', 8, { needItem: 'sewing_kit' });
  R('jacket_canvas', 1, [['cloth', 6], ['cord', 2]], 'workbench', 14, { needItem: 'sewing_kit' });
  R('jacket_leather', 1, [['leather', 6], ['cord', 3]], 'workbench', 20, { needItem: 'sewing_kit' });
  R('pants_cargo', 1, [['cloth', 5], ['cord', 2]], 'workbench', 14, { needItem: 'sewing_kit' });
  R('raincoat', 1, [['tarp_item', 1], ['cord', 2]], 'workbench', 8, { needItem: 'sewing_kit' });
  R('cap_cloth', 1, [['cloth', 2]], 'workbench', 5, { needItem: 'sewing_kit' });
  R('gloves_work', 1, [['leather', 2], ['cloth', 1]], 'workbench', 8, { needItem: 'sewing_kit' });
  R('boots_work', 1, [['leather', 4], ['rubber', 2], ['sheet_metal', 1]], 'workbench', 16, { needItem: 'sewing_kit' });
  R('vest_stab', 1, [['leather', 5], ['cloth', 4], ['plastic', 6]], 'workbench', 24, { needItem: 'sewing_kit', unlock: 'armor' });
  R('vest_kevlar', 1, [['vest_stab', 1], ['sheet_metal', 4], ['cloth', 6], ['screws', 8]], 'workbench', 34, { unlock: 'armor' });
  R('helmet_steel', 1, [['sheet_metal', 3], ['leather', 2], ['screws', 4]], 'workbench', 18, { unlock: 'armor' });
  R('tarp_item', 1, [['plastic', 8], ['cord', 2]], 'workbench', 8);
  R('sandbag_item', 2, [['cloth', 2], ['sand', 4]], 'workbench', 5);
  R('whetstone', 1, [['quartz', 2], ['plank', 1]], 'workbench', 5);
  R('repair_kit', 1, [['scrap_metal', 3], ['cord', 2], ['resin', 1], ['cloth_scrap', 2]], 'workbench', 8);
  R('lantern_oil', 1, [['glass_item', 1], ['scrap_metal', 2], ['cord', 1]], 'workbench', 10);
  R('canteen', 1, [['sheet_metal', 2], ['rubber', 1], ['cloth', 1]], 'workbench', 10);
  R('pot', 1, [['sheet_metal', 3], ['scrap_metal', 1]], 'workbench', 12);
  R('pan', 1, [['sheet_metal', 2], ['stick', 1]], 'workbench', 9);
  R('bucket_empty', 1, [['sheet_metal', 3]], 'workbench', 8);
  R('water_collector_item', 1, [['tarp_item', 1], ['plank', 4], ['bucket_empty', 1]], 'workbench', 12, { unlock: 'water' });
  R('filter_pump', 1, [['plastic', 6], ['charcoal_filter', 1], ['rubber', 2], ['spring', 1]], 'workbench', 16, { unlock: 'water' });
  R('chainlink_item', 2, [['wire', 6]], 'workbench', 6);
  R('barbed_item', 2, [['wire', 4], ['scrap_metal', 1]], 'workbench', 6);
  R('sheet_metal_roof', 4, [['sheet_metal', 3], ['nails', 4]], 'workbench', 6);
  R('crank_charger', 1, [['gear', 2], ['wire', 4], ['electronics', 1], ['scrap_metal', 2]], 'workbench', 15, { unlock: 'power' });
  R('lamp_item', 2, [['glass_item', 1], ['wire', 2], ['electronics', 1]], 'workbench', 8, { unlock: 'power' });
  R('solar_panel_item', 1, [['glass_item', 2], ['copper_ingot', 2], ['electronics', 3], ['sheet_metal', 2]], 'workbench', 26, { unlock: 'power' });
  R('generator_item', 1, [['car_part', 2], ['sheet_metal', 6], ['copper_ingot', 3], ['electronics', 2], ['gear', 3]], 'workbench', 40, { unlock: 'power' });
  R('chem_bench_item', 1, [['sheet_metal', 4], ['glass_item', 4], ['plank', 4], ['screws', 8]], 'workbench', 25, { unlock: 'chem' });
  R('stove_item', 1, [['sheet_metal', 6], ['scrap_metal', 4], ['screws', 6]], 'workbench', 20);
  R('forge_item', 1, [['brick_item', 16], ['cobblestone', 10], ['clay_lump', 6], ['scrap_metal', 4]], 'workbench', 35);
  R('molotov', 2, [['bottle_empty', 2], ['fuel_can', 0.1], ['cloth_scrap', 2]], 'workbench', 5);
  R('smoke_bomb', 2, [['can_empty', 2], ['niter', 2], ['sulfur', 1], ['plastic', 2]], 'workbench', 8);
  R('firecracker', 4, [['paper', 4], ['gunpowder', 1], ['cord', 1]], 'workbench', 5);
  R('grenade_frag', 1, [['can_empty', 1], ['gunpowder', 4], ['nails', 12], ['cord', 1]], 'workbench', 12, { unlock: 'gunsmith' });
  R('suppressor', 1, [['scrap_metal', 3], ['rubber', 4], ['sheet_metal', 1]], 'workbench', 14, { unlock: 'gunsmith' });
  R('scope_optic', 1, [['lens', 2], ['scrap_metal', 2], ['rubber', 1]], 'workbench', 14, { unlock: 'gunsmith' });
  R('lens', 1, [['quartz', 3], ['glass_item', 1]], 'workbench', 10, { needItem: 'whetstone' });
  R('map_paper', 1, [['paper', 4], ['charcoal', 1]], 'workbench', 6);
  R('compass', 1, [['iron_ingot', 1], ['glass_item', 1], ['electronics', 1]], 'workbench', 12);

  /* ======================================================= 土窑（烧制） */
  R('charcoal', 4, [['log', 2]], 'furnace', 25, { fuel: 1, cat: '烧制' });
  R('charcoal', 1, [['branch', 4]], 'furnace', 10, { fuel: 1 });
  R('brick_item', 4, [['clay_lump', 4]], 'furnace', 20, { fuel: 1 });
  R('lime', 2, [['limestone_chunk', 2]], 'furnace', 18, { fuel: 1 });
  R('glass_item', 2, [['sand', 4]], 'furnace', 22, { fuel: 1 });
  R('cement_powder', 2, [['lime', 2], ['clay_lump', 2]], 'furnace', 20, { fuel: 1 });
  R('concrete_item', 2, [['cement_powder', 2], ['gravel', 3], ['sand', 2]], 'workbench', 12);
  R('cinder_item', 3, [['cement_powder', 1], ['gravel', 3]], 'workbench', 8);
  R('ash_pile', 2, [['leaf_litter', 6]], 'furnace', 8, { fuel: 1 });
  R('charcoal_filter', 1, [['charcoal', 3], ['sand', 2], ['cloth_scrap', 2]], 'workbench', 8);
  R('soap', 2, [['ash_pile', 3], ['leather_raw', 1], ['lime', 1]], 'furnace', 15, { fuel: 1 });

  /* ========================================================= 锻炉（金属） */
  R('iron_ingot', 1, [['iron_ore_chunk', 2], ['charcoal', 1]], 'forge', 20, { fuel: 1, cat: '冶炼' });
  R('copper_ingot', 1, [['copper_ore_chunk', 2], ['charcoal', 1]], 'forge', 18, { fuel: 1 });
  R('lead_ingot', 1, [['lead_ore_chunk', 2], ['charcoal', 1]], 'forge', 18, { fuel: 1 });
  R('iron_ingot', 1, [['scrap_metal', 4]], 'forge', 16, { fuel: 1 });
  R('steel_ingot', 1, [['iron_ingot', 2], ['charcoal', 3]], 'forge', 30, { fuel: 1, unlock: 'steel' });
  R('sheet_metal', 2, [['iron_ingot', 1]], 'forge', 10, { fuel: 1, need: 'hammer' });
  R('wire', 6, [['copper_ingot', 1]], 'forge', 10, { fuel: 1 });
  R('nails', 16, [['iron_ingot', 1]], 'forge', 8, { fuel: 1, need: 'hammer' });
  R('screws', 12, [['iron_ingot', 1]], 'forge', 10, { fuel: 1 });
  R('gear', 2, [['iron_ingot', 2]], 'forge', 14, { fuel: 1, need: 'hammer' });
  R('spring', 2, [['steel_ingot', 1]], 'forge', 12, { fuel: 1, unlock: 'steel' });
  R('rebar', 1, [['iron_ingot', 2]], 'forge', 10, { fuel: 1 });
  R('axe_iron', 1, [['iron_ingot', 3], ['stick', 2]], 'forge', 20, { fuel: 1, need: 'hammer' });
  R('pick_iron', 1, [['iron_ingot', 3], ['stick', 2]], 'forge', 20, { fuel: 1, need: 'hammer' });
  R('shovel_iron', 1, [['iron_ingot', 2], ['stick', 1]], 'forge', 16, { fuel: 1, need: 'hammer' });
  R('knife_hunting', 1, [['iron_ingot', 1], ['leather', 1]], 'forge', 14, { fuel: 1, need: 'hammer' });
  R('machete', 1, [['iron_ingot', 2], ['leather', 1], ['cord', 1]], 'forge', 18, { fuel: 1, need: 'hammer' });
  R('scythe', 1, [['iron_ingot', 2], ['stick', 2]], 'forge', 16, { fuel: 1, need: 'hammer' });
  R('crowbar', 1, [['iron_ingot', 3]], 'forge', 18, { fuel: 1, need: 'hammer' });
  R('hammer_claw', 1, [['iron_ingot', 2], ['stick', 1]], 'forge', 14, { fuel: 1 });
  R('saw_hack', 1, [['steel_ingot', 1], ['stick', 1], ['screws', 2]], 'forge', 16, { fuel: 1, unlock: 'steel' });
  R('wirecutter', 1, [['iron_ingot', 2], ['rubber', 1]], 'forge', 14, { fuel: 1 });
  R('pliers', 1, [['iron_ingot', 1], ['rubber', 1]], 'forge', 12, { fuel: 1 });
  R('axe_steel', 1, [['steel_ingot', 3], ['stick', 2], ['leather', 1]], 'forge', 28, { fuel: 1, unlock: 'steel', need: 'hammer' });
  R('pick_steel', 1, [['steel_ingot', 3], ['stick', 2], ['leather', 1]], 'forge', 28, { fuel: 1, unlock: 'steel', need: 'hammer' });
  R('sledge', 1, [['steel_ingot', 4], ['stick', 3]], 'forge', 26, { fuel: 1, unlock: 'steel' });
  R('crowbar_heavy', 1, [['steel_ingot', 4], ['gear', 2], ['spring', 2]], 'forge', 32, { fuel: 1, unlock: 'steel' });
  R('pipe_lead', 1, [['lead_ingot', 2]], 'forge', 12, { fuel: 1 });
  R('ammo_9mm', 12, [['lead_ingot', 1], ['gunpowder', 2], ['copper_ingot', 1]], 'forge', 20, { fuel: 1, unlock: 'gunsmith' });
  R('ammo_357', 8, [['lead_ingot', 1], ['gunpowder', 3], ['copper_ingot', 1]], 'forge', 22, { fuel: 1, unlock: 'gunsmith' });
  R('ammo_shell', 6, [['lead_ingot', 1], ['gunpowder', 2], ['plastic', 2]], 'forge', 20, { fuel: 1, unlock: 'gunsmith' });
  R('ammo_762', 6, [['lead_ingot', 1], ['gunpowder', 4], ['copper_ingot', 2]], 'forge', 26, { fuel: 1, unlock: 'gunsmith' });
  R('antenna_part', 1, [['rebar', 2], ['wire', 6], ['sheet_metal', 2]], 'forge', 24, { fuel: 1, unlock: 'radio' });

  /* ========================================================= 化学台 */
  R('gunpowder', 3, [['niter', 3], ['sulfur', 1], ['charcoal', 1]], 'chem', 14, { cat: '化学' });
  R('alcohol', 2, [['berries', 8], ['water_clean_bottle', 1]], 'chem', 30);
  R('alcohol', 2, [['potato', 6], ['water_clean_bottle', 1]], 'chem', 30);
  R('antiseptic', 2, [['alcohol', 1], ['herb_yarrow', 2], ['bottle_empty', 1]], 'chem', 12);
  R('painkiller', 3, [['willow_bark', 4], ['alcohol', 1]], 'chem', 12);
  R('antipyretic', 3, [['willow_bark', 3], ['herb_mint', 3]], 'chem', 12);
  R('charcoal_tablet', 4, [['charcoal', 2], ['flour', 1]], 'chem', 8);
  R('bandage_sterile', 4, [['cloth', 2], ['alcohol', 1]], 'chem', 8);
  R('suture_kit', 2, [['sinew', 2], ['bone', 1], ['alcohol', 1], ['cloth', 1]], 'chem', 14);
  R('tourniquet', 2, [['cloth', 2], ['stick', 1], ['rubber', 1]], 'chem', 8);
  R('splint', 2, [['plank', 2], ['cloth', 2], ['plaster_dust', 2]], 'chem', 10);
  R('vitamin', 6, [['herb_mint', 3], ['berries', 4], ['honey', 1]], 'chem', 12);
  R('antibiotics', 2, [['mushroom_brown', 6], ['alcohol', 1], ['lime', 1]], 'chem', 40, { unlock: 'chem' });
  R('serum_green', 1, [['spore_sample', 4], ['antibiotics', 1], ['alcohol', 1]], 'chem', 50, { unlock: 'chem' });
  R('adrenaline', 1, [['electronics', 1], ['alcohol', 1], ['spore_sample', 1], ['glass_shard', 2]], 'chem', 30, { unlock: 'chem' });
  R('vaccine_proto', 1, [['serum_green', 2], ['lab_sample', 1], ['research_notes', 1]], 'chem', 90, { unlock: 'chem' });
  R('fertilizer', 3, [['leaf_litter', 6], ['bone', 2], ['ash_pile', 2]], 'chem', 16);
  R('fertilizer', 4, [['straw', 4], ['mud_clump', 2], ['ash_pile', 1]], 'workbench', 14, { unlock: 'farm' });
  R('mask_filter', 2, [['charcoal', 3], ['cloth', 2], ['plastic', 2]], 'chem', 12);
  R('gasmask', 1, [['rubber', 4], ['glass_item', 1], ['mask_filter', 1], ['cord', 2]], 'workbench', 20, { unlock: 'chem' });
  R('tar', 2, [['coal', 3]], 'chem', 20);

  /* ====================================================== 火源（烹饪） */
  R('water_clean_bottle', 1, [['water_dirty_bottle', 1]], 'fire', 12, { needItem: 'pot', fuel: 1, cat: '烹饪' });
  R('water_clean_bottle', 1, [['water_dirty_bottle', 1]], 'fire', 20, { needItem: 'can_empty', fuel: 1, cat: '烹饪' });
  R('water_clean_bottle', 1, [['rain_water', 1]], 'fire', 10, { needItem: 'pot', fuel: 1 });
  R('meat_cooked', 1, [['meat_raw', 1]], 'fire', 10, { fuel: 1 });
  R('fish_cooked', 1, [['fish_raw', 1]], 'fire', 8, { fuel: 1 });
  R('egg_cooked', 1, [['egg', 1]], 'fire', 5, { needItem: 'pan', fuel: 1 });
  R('corn_roasted', 1, [['corn', 1]], 'fire', 7, { fuel: 1 });
  R('potato_baked', 1, [['potato', 1]], 'fire', 9, { fuel: 1 });
  R('flour', 2, [['wheat', 3]], 'hand', 6, { needItem: 'whetstone' });
  R('bread', 1, [['flour', 3], ['water_clean_bottle', 1]], 'fire', 18, { needItem: 'pan', fuel: 1 });
  R('stew_meat', 1, [['meat_raw', 2], ['potato', 1], ['carrot', 1], ['water_clean_bottle', 1]], 'fire', 30, { needItem: 'pot', fuel: 1 });
  R('stew_veg', 1, [['cabbage', 1], ['carrot', 2], ['potato', 1], ['water_clean_bottle', 1]], 'fire', 26, { needItem: 'pot', fuel: 1 });
  R('pumpkin_soup', 1, [['pumpkin', 1], ['water_clean_bottle', 1], ['salt', 1]], 'fire', 24, { needItem: 'pot', fuel: 1 });
  R('bone_broth', 1, [['bone', 3], ['water_clean_bottle', 1]], 'fire', 28, { needItem: 'pot', fuel: 1 });
  R('coffee', 1, [['water_clean_bottle', 1], ['berries', 2], ['honey', 1]], 'fire', 10, { needItem: 'pot', fuel: 1 });
  R('tea_herb', 1, [['water_clean_bottle', 1], ['herb_mint', 2], ['willow_bark', 1]], 'fire', 10, { needItem: 'pot', fuel: 1 });
  R('beans', 1, [['beans', 1]], 'fire', 8, { needItem: 'pot', fuel: 1, cat: '烹饪' });
  R('can_soup', 1, [['can_beans', 1], ['water_clean_bottle', 1], ['salt', 1]], 'fire', 12, { needItem: 'pot', fuel: 1 });

  /* ========================================================= 晾晒架 */
  R('jerky', 2, [['meat_raw', 2], ['salt', 1]], 'dry', 60, { cat: '保存' });
  R('leather', 1, [['leather_raw', 1], ['lime', 1]], 'dry', 90);
  R('leather', 1, [['leather_raw', 1], ['ash_pile', 2], ['water_clean_bottle', 1]], 'dry', 120);
  R('straw', 3, [['fiber', 6]], 'dry', 30);
  R('herb_yarrow', 2, [['herb_yarrow', 3]], 'dry', 40);
  R('salt', 2, [['water_dirty_bottle', 3]], 'dry', 80);
  R('vine_rope_raw', 2, [['fiber', 8]], 'dry', 30);
  R('sinew', 2, [['leather_raw', 1], ['bone', 1]], 'dry', 45);

  /* ==================================================== 索引与查询 */
  const byStation = {};
  for (const k of Object.keys(STATIONS)) byStation[k] = [];
  for (const r of all) (byStation[r.station] || (byStation[r.station] = [])).push(r);

  const byOut = {};
  for (const r of all) (byOut[r.out] || (byOut[r.out] = [])).push(r);

  GF.Recipes = {
    all, byStation, byOut, STATIONS, UNLOCKS,
    count: () => all.length,
    /** MOD 接口：注册新配方 */
    define(out, n, ins, station, time, opt) {
      const r = R(out, n, ins, station, time, opt);
      (byStation[r.station] || (byStation[r.station] = [])).push(r);
      (byOut[r.out] || (byOut[r.out] = [])).push(r);
      return r;
    },
    /** MOD 接口：注册新科技解锁项 */
    defineUnlock(key, name) { UNLOCKS[key] = name; return key; },
    /** 玩家是否解锁了这个配方 */
    known(r, unlocks) { return !r.unlock || !!(unlocks && unlocks[r.unlock]); },
    /** 列出某工作站下玩家已解锁的配方 */
    forStation(station, unlocks) {
      return (byStation[station] || []).filter((r) => GF.Recipes.known(r, unlocks));
    },
  };
})(globalThis.GF = globalThis.GF || {});
