/* =========================================================================
 * GREENFALL · blocks.js —— 方块注册表
 *
 * 设计要点（比 MC 更贴近现实）：
 *   · tool = null 才能徒手采集（草、蕨、浆果、垃圾堆之类的松散物）
 *   · 木头必须用斧、石头必须用镐、泥沙用铲、金属要撬棍/切割
 *   · tier: 0 徒手 / 1 石器 / 2 铁器 / 3 钢与动力工具
 *   · hard = 用「刚好合格的工具」挖掘所需秒数
 * ======================================================================= */
(function (GF) {
  'use strict';

  const list = [];          // 按 id 索引
  const byKey = Object.create(null);
  const ID = Object.create(null);

  const DEF = {
    name: '?', tex: 'stone', cls: 'opaque', render: 'cube',
    solid: true, opaque: true, hard: 1, tool: null, tier: 0,
    drops: null, light: 0, station: null, loot: null,
    support: false, climb: false, liquid: false, flammable: false,
    step: 'stone', tint: null, noise: 0.35, hp: null, blast: 1,
    grow: null, seat: false, bed: false, door: null, desc: '',
  };

  function B(key, o) {
    const b = Object.assign({}, DEF, o, { key, id: list.length });
    if (typeof b.tex === 'string') b.tex = { all: b.tex };
    if (b.cls !== 'opaque') b.opaque = o.opaque === true;
    if (b.render === 'cross') { b.solid = false; b.opaque = false; b.cls = 'alpha'; }
    if (b.drops === null) b.drops = [{ item: key, min: 1, max: 1 }];
    list.push(b); byKey[key] = b; ID[key] = b.id;
    return b;
  }
  const drop = (item, min = 1, max = min, chance = 1) => ({ item, min, max, chance });

  /* ==================================================== 0. 空气与基岩 */
  B('air', { name: '空气', tex: 'air', cls: 'none', render: 'none', solid: false, opaque: false, drops: [] });
  B('bedrock', { name: '基岩', tex: 'bedrock', hard: 1e9, tool: 'pick', tier: 9, drops: [] });

  /* ======================================================== 1. 土石类 */
  B('stone', { name: '石头', tex: 'stone', hard: 3.4, tool: 'pick', tier: 1, drops: [drop('cobblestone')], step: 'stone' });
  B('granite', { name: '花岗岩', tex: 'granite', hard: 4.6, tool: 'pick', tier: 1, drops: [drop('cobblestone', 1, 2)] });
  B('limestone', { name: '石灰岩', tex: 'limestone', hard: 2.8, tool: 'pick', tier: 1, drops: [drop('limestone_chunk', 1, 2)] });
  B('cobblestone', { name: '碎石', tex: 'cobblestone', hard: 2.6, tool: 'pick', tier: 1 });
  B('moss_stone', { name: '苔石', tex: 'moss_stone', hard: 2.8, tool: 'pick', tier: 1, drops: [drop('cobblestone'), drop('moss', 1, 1, 0.6)] });
  B('gravel', { name: '砂砾', tex: 'gravel', hard: 1.6, tool: null, drops: [drop('gravel'), drop('flint', 0, 1, 0.35)], step: 'gravel', desc: '松散的碎石，徒手也能刨开' });
  B('dirt', { name: '泥土', tex: 'dirt', hard: 1.0, tool: 'shovel', tier: 1, step: 'dirt' });
  B('grass', { name: '草地', tex: { top: 'grass_top', bottom: 'dirt', side: 'grass_side' }, hard: 1.0, tool: 'shovel', tier: 1, drops: [drop('dirt')], step: 'grass', grow: 'grass' });
  B('moss_ground', { name: '厚苔地', tex: { top: 'moss_top', bottom: 'dirt', side: 'moss_side' }, hard: 0.9, tool: 'shovel', tier: 1, drops: [drop('dirt'), drop('moss', 1, 2)], step: 'grass' });
  B('rich_soil', { name: '腐殖土', tex: 'rich_soil', hard: 0.9, tool: 'shovel', tier: 1, drops: [drop('rich_soil')], step: 'dirt' });
  B('farmland', { name: '耕地', tex: { top: 'farmland', bottom: 'dirt', side: 'dirt' }, hard: 0.8, tool: 'shovel', tier: 1, drops: [drop('dirt')], step: 'dirt' });
  B('farmland_wet', { name: '湿耕地', tex: { top: 'farmland_wet', bottom: 'dirt', side: 'dirt' }, hard: 0.8, tool: 'shovel', tier: 1, drops: [drop('dirt')], step: 'dirt' });
  B('sand', { name: '沙子', tex: 'sand', hard: 0.9, tool: 'shovel', tier: 1, step: 'sand' });
  B('clay', { name: '黏土', tex: 'clay', hard: 1.1, tool: 'shovel', tier: 1, drops: [drop('clay_lump', 3, 4)], step: 'dirt' });
  B('mud', { name: '淤泥', tex: 'mud', hard: 1.0, tool: 'shovel', tier: 1, drops: [drop('mud_clump', 1, 2)], step: 'mud' });
  B('peat', { name: '泥炭', tex: 'peat', hard: 1.2, tool: 'shovel', tier: 1, drops: [drop('peat_brick', 1, 2)], step: 'dirt', flammable: true });
  B('ash', { name: '灰土', tex: 'ash', hard: 0.7, tool: 'shovel', tier: 1, drops: [drop('ash_pile')], step: 'sand' });
  B('blight_soil', { name: '孢化土', tex: 'blight_soil', hard: 1.0, tool: 'shovel', tier: 1, drops: [drop('spore_sample', 1, 1, 0.5)], step: 'dirt' });

  /* ========================================================= 2. 矿脉 */
  B('coal_ore', { name: '煤矿', tex: 'coal_ore', hard: 5.2, tool: 'pick', tier: 1, drops: [drop('coal', 1, 3)] });
  B('iron_ore', { name: '铁矿', tex: 'iron_ore', hard: 7.0, tool: 'pick', tier: 1, drops: [drop('iron_ore_chunk', 1, 2)] });
  B('copper_ore', { name: '铜矿', tex: 'copper_ore', hard: 6.4, tool: 'pick', tier: 1, drops: [drop('copper_ore_chunk', 1, 2)] });
  B('lead_ore', { name: '铅矿', tex: 'lead_ore', hard: 6.8, tool: 'pick', tier: 2, drops: [drop('lead_ore_chunk', 1, 2)] });
  B('sulfur_ore', { name: '硫矿', tex: 'sulfur_ore', hard: 4.4, tool: 'pick', tier: 1, drops: [drop('sulfur', 2, 4)] });
  B('niter_ore', { name: '硝石矿', tex: 'niter_ore', hard: 4.0, tool: 'pick', tier: 1, drops: [drop('niter', 2, 4)] });
  B('quartz_vein', { name: '石英脉', tex: 'quartz_vein', hard: 5.6, tool: 'pick', tier: 2, drops: [drop('quartz', 2, 3)] });

  /* ======================================================= 3. 树与植被 */
  B('log_oak', { name: '橡木原木', tex: { top: 'log_top', bottom: 'log_top', side: 'log_oak' }, hard: 5.5, tool: 'axe', tier: 1, drops: [drop('log', 1, 1)], flammable: true, step: 'wood' });
  B('log_pine', { name: '松木原木', tex: { top: 'log_top', bottom: 'log_top', side: 'log_pine' }, hard: 5.0, tool: 'axe', tier: 1, drops: [drop('log'), drop('resin', 0, 1, 0.4)], flammable: true, step: 'wood' });
  B('log_birch', { name: '白桦原木', tex: { top: 'log_top', bottom: 'log_top', side: 'log_birch' }, hard: 4.8, tool: 'axe', tier: 1, drops: [drop('log'), drop('bark', 1, 2)], flammable: true, step: 'wood' });
  B('log_giant', { name: '巨木木芯', tex: { top: 'log_giant_top', bottom: 'log_giant_top', side: 'log_giant' }, hard: 11, tool: 'axe', tier: 2, drops: [drop('log', 2, 3)], flammable: true, step: 'wood' });
  B('log_dead', { name: '枯木', tex: 'log_dead', hard: 3.2, tool: 'axe', tier: 1, drops: [drop('log'), drop('branch', 1, 2)], flammable: true, step: 'wood' });
  B('leaves_oak', { name: '橡树叶', tex: 'leaves_oak', cls: 'alpha', hard: 0.4, tool: null, drops: [drop('leaf_litter'), drop('branch', 0, 1, 0.25), drop('sapling_oak', 0, 1, 0.1)], flammable: true, step: 'grass', solid: true, opaque: false });
  B('leaves_pine', { name: '松针叶', tex: 'leaves_pine', cls: 'alpha', hard: 0.4, tool: null, drops: [drop('leaf_litter'), drop('resin', 0, 1, 0.15), drop('sapling_pine', 0, 1, 0.1)], flammable: true, step: 'grass', solid: true, opaque: false });
  B('leaves_birch', { name: '桦树叶', tex: 'leaves_birch', cls: 'alpha', hard: 0.4, tool: null, drops: [drop('leaf_litter'), drop('sapling_birch', 0, 1, 0.1)], flammable: true, step: 'grass', solid: true, opaque: false });
  B('leaves_giant', { name: '巨木冠层', tex: 'leaves_giant', cls: 'alpha', hard: 0.6, tool: null, drops: [drop('leaf_litter', 1, 2), drop('branch', 0, 1, 0.4)], flammable: true, step: 'grass', solid: true, opaque: false });
  B('leaves_dead', { name: '枯叶层', tex: 'leaves_dead', cls: 'alpha', hard: 0.3, tool: null, drops: [drop('leaf_litter'), drop('branch', 0, 2, 0.5)], flammable: true, solid: true, opaque: false });

  B('vine', { name: '藤蔓', tex: 'vine', render: 'cross', hard: 0.35, tool: null, drops: [drop('fiber', 1, 2)], flammable: true, support: true, climb: true, step: 'grass' });
  B('thick_vine', { name: '巨藤', tex: 'thick_vine', render: 'cross', hard: 1.0, tool: 'cut', tier: 1, drops: [drop('fiber', 2, 4), drop('vine_rope_raw', 0, 1, 0.3)], climb: true, support: true, step: 'grass' });
  B('moss_carpet', { name: '苔毯', tex: 'moss_carpet', render: 'cross', hard: 0.2, tool: null, drops: [drop('moss', 1, 2)], support: true, step: 'grass' });
  B('grass_tall', { name: '高草', tex: 'grass_tall', render: 'cross', hard: 0.2, tool: null, drops: [drop('fiber', 1, 2), drop('seed_wheat', 0, 1, 0.12)], flammable: true, support: true, step: 'grass' });
  B('fern', { name: '蕨类', tex: 'fern', render: 'cross', hard: 0.2, tool: null, drops: [drop('fiber'), drop('fern_shoot', 1, 1, 0.5)], support: true, step: 'grass' });
  B('reeds', { name: '芦苇', tex: 'reeds', render: 'cross', hard: 0.25, tool: null, drops: [drop('reed_stalk', 1, 2)], support: true, step: 'grass' });
  B('cattail', { name: '香蒲', tex: 'cattail', render: 'cross', hard: 0.25, tool: null, drops: [drop('reed_stalk'), drop('cattail_root', 1, 1, 0.6)], support: true, step: 'grass' });
  B('bush_berry', { name: '浆果丛', tex: 'bush_berry', render: 'cross', hard: 0.4, tool: null, drops: [drop('berries', 1, 3), drop('fiber', 0, 1, 0.5)], support: true, step: 'grass' });
  B('bush_dead', { name: '枯灌木', tex: 'bush_dead', render: 'cross', hard: 0.3, tool: null, drops: [drop('branch', 1, 2)], flammable: true, support: true });
  B('flower_white', { name: '白花', tex: 'flower_white', render: 'cross', hard: 0.15, tool: null, drops: [drop('flower_white')], support: true });
  B('flower_red', { name: '红花', tex: 'flower_red', render: 'cross', hard: 0.15, tool: null, drops: [drop('flower_red')], support: true });
  B('herb_yarrow', { name: '蓍草', tex: 'herb_yarrow', render: 'cross', hard: 0.2, tool: null, drops: [drop('herb_yarrow', 1, 2)], support: true });
  B('herb_mint', { name: '野薄荷', tex: 'herb_mint', render: 'cross', hard: 0.2, tool: null, drops: [drop('herb_mint', 1, 2)], support: true });
  B('herb_willow', { name: '柳枝', tex: 'herb_willow', render: 'cross', hard: 0.25, tool: null, drops: [drop('willow_bark', 1, 2)], support: true });
  B('mushroom_brown', { name: '褐菇', tex: 'mushroom_brown', render: 'cross', hard: 0.15, tool: null, drops: [drop('mushroom_brown')], support: true });
  B('mushroom_toxic', { name: '斑伞菇', tex: 'mushroom_toxic', render: 'cross', hard: 0.15, tool: null, drops: [drop('mushroom_toxic')], support: true });
  B('spore_stalk', { name: '孢囊柱', tex: 'spore_stalk', render: 'cross', hard: 0.6, tool: 'cut', tier: 1, drops: [drop('spore_sample', 1, 2)], support: true, light: 4 });
  B('glow_moss', { name: '荧光苔', tex: 'glow_moss', render: 'cross', hard: 0.2, tool: null, drops: [drop('glow_moss_clump', 1, 2)], support: true, light: 7 });
  B('sapling_oak_b', { name: '橡树苗', tex: 'sapling_oak', render: 'cross', hard: 0.1, tool: null, drops: [drop('sapling_oak')], support: true, grow: 'tree_oak' });
  B('sapling_pine_b', { name: '松树苗', tex: 'sapling_pine', render: 'cross', hard: 0.1, tool: null, drops: [drop('sapling_pine')], support: true, grow: 'tree_pine' });

  /* --------- 作物（4 段生长；成熟才有收成） --------- */
  const crop = (key, name, tex, seed, yieldItem, extra) => {
    for (let s = 0; s < 4; s++) {
      B(key + '_' + s, {
        name: name + ['·幼苗', '·生长', '·抽穗', '·成熟'][s], tex: tex + '_' + s, render: 'cross',
        hard: 0.15, tool: null, support: true, grow: s < 3 ? key : null,
        drops: s === 3 ? [drop(yieldItem, 1, 3), drop(seed, 1, 2)] : [drop(seed)],
        desc: extra || '',
      });
    }
  };
  crop('crop_wheat', '小麦', 'crop_wheat', 'seed_wheat', 'wheat');
  crop('crop_corn', '玉米', 'crop_corn', 'seed_corn', 'corn');
  crop('crop_potato', '马铃薯', 'crop_potato', 'seed_potato', 'potato');
  crop('crop_carrot', '胡萝卜', 'crop_carrot', 'seed_carrot', 'carrot');
  crop('crop_tomato', '番茄', 'crop_tomato', 'seed_tomato', 'tomato');
  crop('crop_pumpkin', '南瓜', 'crop_pumpkin', 'seed_pumpkin', 'pumpkin');
  crop('crop_bean', '豆角', 'crop_bean', 'seed_bean', 'beans');
  crop('crop_cabbage', '甘蓝', 'crop_cabbage', 'seed_cabbage', 'cabbage');

  /* ======================================================== 4. 液体 */
  B('water', { name: '水', tex: 'water', cls: 'water', render: 'water', solid: false, opaque: false, liquid: true, hard: 1e9, tool: 'pick', tier: 9, drops: [] });
  B('water_dirty', { name: '污水', tex: 'water_dirty', cls: 'water', render: 'water', solid: false, opaque: false, liquid: true, hard: 1e9, tool: 'pick', tier: 9, drops: [] });

  /* ================================================== 5. 城市与人造物 */
  B('planks', { name: '木板块', tex: 'planks', hard: 3.0, tool: 'axe', tier: 1, drops: [drop('plank', 2, 2)], flammable: true, step: 'wood' });
  B('plank_floor', { name: '木地板', tex: 'plank_floor', hard: 2.4, tool: 'axe', tier: 1, drops: [drop('plank', 1, 2)], flammable: true, step: 'wood' });
  B('beam', { name: '承重木梁', tex: { top: 'beam_top', bottom: 'beam_top', side: 'beam' }, hard: 4.2, tool: 'saw', tier: 1, drops: [drop('beam_item')], flammable: true, step: 'wood' });
  B('asphalt', { name: '沥青路', tex: 'asphalt', hard: 4.0, tool: 'pick', tier: 2, drops: [drop('gravel', 1, 2), drop('tar', 0, 1, 0.3)], step: 'stone' });
  B('road_line', { name: '路面标线', tex: 'road_line', hard: 4.0, tool: 'pick', tier: 2, drops: [drop('gravel', 1, 2)], step: 'stone' });
  B('concrete', { name: '混凝土', tex: 'concrete', hard: 6.5, tool: 'pick', tier: 2, drops: [drop('concrete_rubble', 1, 2)], step: 'stone' });
  B('concrete_cracked', { name: '裂纹混凝土', tex: 'concrete_cracked', hard: 5.0, tool: 'pick', tier: 1, drops: [drop('concrete_rubble', 1, 2)], step: 'stone' });
  B('concrete_mossy', { name: '苔化混凝土', tex: 'concrete_mossy', hard: 4.6, tool: 'pick', tier: 1, drops: [drop('concrete_rubble'), drop('moss', 1, 2)], step: 'stone' });
  B('rebar_concrete', { name: '钢筋混凝土', tex: 'rebar_concrete', hard: 12, tool: 'pick', tier: 3, drops: [drop('concrete_rubble', 2, 3), drop('rebar', 1, 1, 0.5)], step: 'stone' });
  B('brick', { name: '红砖墙', tex: 'brick', hard: 5.0, tool: 'pick', tier: 1, drops: [drop('brick_item', 2, 3)], step: 'stone' });
  B('brick_mossy', { name: '苔砖墙', tex: 'brick_mossy', hard: 4.2, tool: 'pick', tier: 1, drops: [drop('brick_item', 1, 3), drop('moss')], step: 'stone' });
  B('cinderblock', { name: '空心砖', tex: 'cinderblock', hard: 4.4, tool: 'pick', tier: 1, drops: [drop('cinder_item', 1, 2)], step: 'stone' });
  B('plaster', { name: '石膏隔墙', tex: 'plaster', hard: 1.6, tool: 'hammer', tier: 1, drops: [drop('plaster_dust', 1, 2)], step: 'stone' });
  B('plaster_broken', { name: '破损隔墙', tex: 'plaster_broken', hard: 1.1, tool: null, drops: [drop('plaster_dust'), drop('scrap_wood', 0, 1, 0.4)], step: 'stone' });
  B('wallpaper', { name: '旧壁纸墙', tex: 'wallpaper', hard: 1.6, tool: 'hammer', tier: 1, drops: [drop('plaster_dust'), drop('cloth_scrap', 0, 1, 0.3)], step: 'stone' });
  B('tile_white', { name: '白瓷砖', tex: 'tile_white', hard: 3.0, tool: 'pick', tier: 1, drops: [drop('tile_shard', 1, 3)], step: 'stone' });
  B('tile_dirty', { name: '污渍瓷砖', tex: 'tile_dirty', hard: 2.8, tool: 'pick', tier: 1, drops: [drop('tile_shard', 1, 2)], step: 'stone' });
  B('carpet_old', { name: '腐旧地毯', tex: 'carpet_old', hard: 0.6, tool: null, drops: [drop('cloth_scrap', 1, 2)], flammable: true, step: 'soft' });
  B('shingles', { name: '沥青瓦', tex: 'shingles', hard: 2.2, tool: 'pry', tier: 1, drops: [drop('tar', 1, 1), drop('scrap_wood', 0, 1, 0.4)], step: 'stone' });
  B('sheet_roof', { name: '铁皮屋面', tex: 'sheet_roof', hard: 3.4, tool: 'pry', tier: 1, drops: [drop('sheet_metal', 1, 2)], step: 'metal' });
  B('metal_panel', { name: '金属板墙', tex: 'metal_panel', hard: 6.0, tool: 'pry', tier: 2, drops: [drop('sheet_metal', 2, 3)], step: 'metal' });
  B('rusty_metal', { name: '锈蚀铁板', tex: 'rusty_metal', hard: 4.0, tool: 'pry', tier: 1, drops: [drop('scrap_metal', 1, 3)], step: 'metal' });
  B('metal_grate', { name: '格栅板', tex: 'metal_grate', cls: 'alpha', opaque: false, hard: 4.0, tool: 'pry', tier: 2, drops: [drop('scrap_metal', 1, 2)], step: 'metal' });
  B('chainlink', { name: '铁丝网', tex: 'chainlink', cls: 'alpha', opaque: false, hard: 2.6, tool: 'cut', tier: 2, drops: [drop('wire', 2, 3)], step: 'metal' });
  B('barbed_wire', { name: '铁蒺藜', tex: 'barbed_wire', render: 'cross', hard: 2.0, tool: 'cut', tier: 2, drops: [drop('wire', 1, 2)], hp: 4, desc: '踩上去会流血' });
  B('glass', { name: '玻璃窗', tex: 'glass', cls: 'alpha', opaque: false, hard: 0.6, tool: null, drops: [drop('glass_shard', 1, 2)], step: 'glass' });
  B('glass_dirty', { name: '污浊玻璃', tex: 'glass_dirty', cls: 'alpha', opaque: false, hard: 0.6, tool: null, drops: [drop('glass_shard', 1, 2)], step: 'glass' });
  B('glass_broken', { name: '碎玻璃窗', tex: 'glass_broken', cls: 'alpha', opaque: false, solid: false, hard: 0.3, tool: null, drops: [drop('glass_shard')], step: 'glass', desc: '穿过会划伤' });
  B('glass_pane_green', { name: '温室玻璃', tex: 'glass_green', cls: 'alpha', opaque: false, hard: 0.8, tool: null, drops: [drop('glass_shard', 1, 2)], step: 'glass' });
  B('rubble', { name: '瓦砾堆', tex: 'rubble', hard: 1.4, tool: 'shovel', tier: 1, drops: [drop('concrete_rubble', 1, 2), drop('scrap_metal', 0, 1, 0.3)], step: 'gravel' });
  B('trash_pile', { name: '垃圾堆', tex: 'trash_pile', hard: 0.8, tool: null, drops: [drop('cloth_scrap', 0, 2, 0.6), drop('plastic', 0, 2, 0.6), drop('scrap_metal', 0, 1, 0.3)], step: 'soft' });
  B('wreck_metal', { name: '车骸', tex: 'wreck_metal', hard: 7.0, tool: 'pry', tier: 2, drops: [drop('scrap_metal', 2, 4), drop('car_part', 0, 1, 0.25)], step: 'metal' });
  B('tire_stack', { name: '轮胎堆', tex: 'tire_stack', hard: 2.0, tool: 'cut', tier: 1, drops: [drop('rubber', 2, 3)], flammable: true, step: 'soft' });
  B('tarp', { name: '防水布', tex: 'tarp', cls: 'alpha', opaque: false, hard: 0.5, tool: null, drops: [drop('tarp_item')], flammable: true, step: 'soft' });
  B('sandbag', { name: '沙袋', tex: 'sandbag', hard: 1.6, tool: 'shovel', tier: 1, drops: [drop('sandbag_item')], step: 'sand' });
  B('bookshelf', { name: '书架', tex: 'bookshelf', hard: 2.4, tool: 'axe', tier: 1, drops: [drop('plank', 1, 2), drop('paper', 1, 3), drop('book', 0, 1, 0.35)], flammable: true, step: 'wood' });
  B('hay_bale', { name: '干草垛', tex: 'hay_bale', hard: 1.2, tool: 'cut', tier: 1, drops: [drop('straw', 3, 4)], flammable: true, step: 'soft' });
  B('bone_pile', { name: '骨堆', tex: 'bone_pile', hard: 1.0, tool: 'shovel', tier: 1, drops: [drop('bone', 2, 4)], step: 'gravel' });
  B('fungal_wall', { name: '菌毯壁', tex: 'fungal_wall', hard: 1.6, tool: 'cut', tier: 1, drops: [drop('spore_sample', 1, 2), drop('fungal_fiber', 1, 2)], light: 2, step: 'soft' });

  /* ================================================ 6. 门窗与功能方块 */
  B('door_wood', { name: '木门', tex: 'door_wood', hard: 2.4, tool: 'axe', tier: 1, drops: [drop('door_wood_item')], flammable: true, door: 'door_wood_open', step: 'wood' });
  B('door_wood_open', { name: '木门(开)', tex: 'door_wood', cls: 'alpha', opaque: false, solid: false, hard: 2.4, tool: 'axe', tier: 1, drops: [drop('door_wood_item')], door: 'door_wood', step: 'wood' });
  B('door_metal', { name: '铁门', tex: 'door_metal', hard: 8.0, tool: 'pry', tier: 2, drops: [drop('door_metal_item')], door: 'door_metal_open', step: 'metal' });
  B('door_metal_open', { name: '铁门(开)', tex: 'door_metal', cls: 'alpha', opaque: false, solid: false, hard: 8.0, tool: 'pry', tier: 2, drops: [drop('door_metal_item')], door: 'door_metal', step: 'metal' });
  B('door_locked', { name: '上锁的门', tex: 'door_locked', hard: 9.0, tool: 'pry', tier: 2, drops: [drop('scrap_metal', 1, 2)], desc: '需要对应钥匙卡，或强行破拆' });
  B('fence_wood', { name: '木栅栏', tex: 'fence_wood', cls: 'alpha', opaque: false, hard: 1.8, tool: 'axe', tier: 1, drops: [drop('fence_item')], flammable: true, step: 'wood' });
  B('ladder', { name: '梯子', tex: 'ladder', render: 'cross', hard: 1.2, tool: 'axe', tier: 1, drops: [drop('ladder_item')], climb: true, support: true, step: 'wood' });
  B('workbench', { name: '工作台', tex: { top: 'workbench_top', bottom: 'planks', side: 'workbench_side' }, hard: 2.8, tool: 'axe', tier: 1, drops: [drop('workbench_item')], station: 'workbench', step: 'wood' });
  B('furnace', { name: '土窑', tex: { top: 'furnace_top', bottom: 'stone', side: 'furnace_side' }, hard: 4.0, tool: 'pick', tier: 1, drops: [drop('furnace_item')], station: 'furnace', step: 'stone' });
  B('forge', { name: '锻炉', tex: { top: 'forge_top', bottom: 'stone', side: 'forge_side' }, hard: 5.5, tool: 'pick', tier: 2, drops: [drop('forge_item')], station: 'forge', light: 6, step: 'metal' });
  B('chem_bench', { name: '化学台', tex: { top: 'chem_top', bottom: 'metal_panel', side: 'chem_side' }, hard: 4.0, tool: 'pry', tier: 2, drops: [drop('chem_bench_item')], station: 'chem', step: 'metal' });
  B('campfire', { name: '篝火', tex: { top: 'campfire_top', bottom: 'dirt', side: 'campfire_side' }, cls: 'alpha', opaque: false, solid: false, hard: 0.8, tool: null, drops: [drop('branch', 1, 2)], station: 'fire', light: 13, step: 'soft', desc: '取暖、烧烤、煮水；吸引僵尸' });
  B('stove', { name: '燃气灶台', tex: { top: 'stove_top', bottom: 'metal_panel', side: 'stove_side' }, hard: 4.0, tool: 'pry', tier: 2, drops: [drop('stove_item')], station: 'fire', step: 'metal' });
  B('drying_rack', { name: '晾晒架', tex: 'drying_rack', cls: 'alpha', opaque: false, hard: 1.4, tool: 'axe', tier: 1, drops: [drop('drying_rack_item')], station: 'dry', step: 'wood' });
  B('water_collector', { name: '集雨器', tex: { top: 'collector_top', bottom: 'planks', side: 'collector_side' }, hard: 1.6, tool: 'pry', tier: 1, drops: [drop('water_collector_item')], station: 'water', step: 'metal' });
  B('planter', { name: '育苗箱', tex: { top: 'planter_top', bottom: 'planks', side: 'planter_side' }, hard: 1.8, tool: 'axe', tier: 1, drops: [drop('planter_item')], step: 'wood' });
  B('bed_old', { name: '旧床铺', tex: { top: 'bed_top', bottom: 'planks', side: 'bed_side' }, hard: 1.4, tool: null, drops: [drop('bed_item')], bed: true, solid: true, opaque: false, cls: 'alpha', step: 'soft' });
  B('chest', { name: '储物箱', tex: { top: 'chest_top', bottom: 'planks', side: 'chest_side' }, hard: 2.6, tool: 'axe', tier: 1, drops: [drop('chest_item')], loot: 'PLAYER', step: 'wood' });
  B('lamp_off', { name: '熄灭的灯', tex: 'lamp_off', cls: 'alpha', opaque: false, hard: 1.0, tool: null, drops: [drop('lamp_item')], step: 'glass' });
  B('lamp_on', { name: '电灯', tex: 'lamp_on', cls: 'alpha', opaque: false, hard: 1.0, tool: null, drops: [drop('lamp_item')], light: 15, step: 'glass' });
  B('solar_panel', { name: '太阳能板', tex: { top: 'solar_top', bottom: 'metal_panel', side: 'metal_panel' }, hard: 3.0, tool: 'pry', tier: 2, drops: [drop('solar_panel_item')], step: 'metal' });
  B('generator', { name: '柴油发电机', tex: { top: 'gen_top', bottom: 'metal_panel', side: 'gen_side' }, hard: 5.0, tool: 'pry', tier: 2, drops: [drop('generator_item')], station: 'power', step: 'metal' });
  B('radio_console', { name: '无线电台', tex: { top: 'radio_top', bottom: 'metal_panel', side: 'radio_side' }, hard: 6.0, tool: 'pry', tier: 2, drops: [], station: 'radio', light: 5, step: 'metal', desc: '主线：修复后可联络幸存者' });
  B('sign_post', { name: '路牌', tex: 'sign_post', cls: 'alpha', opaque: false, solid: false, hard: 1.2, tool: null, drops: [drop('plank')], step: 'wood' });
  B('torch', { name: '火把', tex: 'torch', render: 'cross', hard: 0.1, tool: null, drops: [drop('torch_item')], light: 12, support: true });

  /* ------------------------------------------------ 7. 战利品容器方块 */
  const LOOT = (key, name, tex, table, o) => B(key, Object.assign({
    name, tex, hard: 2.2, tool: null, loot: table, step: 'metal', drops: [],
  }, o || {}));
  LOOT('crate_supply', '补给木箱', { top: 'crate_top', bottom: 'crate_top', side: 'crate_side' }, 'supply', { tool: 'pry', tier: 1, step: 'wood' });
  LOOT('locker', '储物柜', { top: 'locker_top', bottom: 'locker_top', side: 'locker_side' }, 'locker', { hard: 3.0, tool: 'pry', tier: 1 });
  LOOT('cabinet', '文件柜', { top: 'cabinet_top', bottom: 'cabinet_top', side: 'cabinet_side' }, 'office', { hard: 2.4, tool: 'pry', tier: 1 });
  LOOT('fridge', '废弃冰箱', { top: 'fridge_top', bottom: 'fridge_top', side: 'fridge_side' }, 'fridge', { hard: 3.4, tool: 'pry', tier: 1 });
  LOOT('vending', '自动售货机', { top: 'vending_top', bottom: 'metal_panel', side: 'vending_side' }, 'vending', { hard: 4.6, tool: 'pry', tier: 2 });
  LOOT('shelf_store', '货架', { top: 'shelf_top', bottom: 'planks', side: 'shelf_side' }, 'store', { hard: 1.8, tool: null, cls: 'alpha', opaque: false });
  LOOT('medbox', '急救箱柜', { top: 'medbox_top', bottom: 'metal_panel', side: 'medbox_side' }, 'medical', { hard: 2.6, tool: 'pry', tier: 1 });
  LOOT('ammo_case', '弹药箱', { top: 'ammo_top', bottom: 'metal_panel', side: 'ammo_side' }, 'ammo', { hard: 4.0, tool: 'pry', tier: 2 });
  LOOT('toolbox', '工具箱', { top: 'toolbox_top', bottom: 'metal_panel', side: 'toolbox_side' }, 'tools', { hard: 2.6, tool: 'pry', tier: 1 });
  LOOT('safe', '保险柜', { top: 'safe_top', bottom: 'metal_panel', side: 'safe_side' }, 'safe', { hard: 14, tool: 'pry', tier: 3 });
  LOOT('suitcase', '旧行李箱', { top: 'suitcase_top', bottom: 'suitcase_top', side: 'suitcase_side' }, 'civilian', { hard: 1.2, tool: null, cls: 'alpha', opaque: false });
  LOOT('backpack_drop', '遗弃背包', { top: 'pack_top', bottom: 'pack_top', side: 'pack_side' }, 'survivor', { hard: 0.8, tool: null, cls: 'alpha', opaque: false });
  LOOT('cash_register', '收银机', { top: 'register_top', bottom: 'metal_panel', side: 'register_side' }, 'register', { hard: 2.8, tool: 'pry', tier: 1 });
  LOOT('crate_seed', '种子柜', { top: 'seedbox_top', bottom: 'planks', side: 'seedbox_side' }, 'seeds', { hard: 2.0, tool: null, step: 'wood' });

  /* ==================================================== 查询辅助函数 */
  const NEED_TOOL_NAME = {
    axe: '斧', pick: '镐', shovel: '铲', saw: '锯', cut: '刃具', pry: '撬棍', hammer: '锤',
  };
  const TIER_NAME = ['徒手', '石器', '铁器', '钢/动力'];

  function get(idOrKey) {
    return typeof idOrKey === 'number' ? list[idOrKey] : byKey[idOrKey];
  }
  function isSolid(id) { return list[id].solid; }
  function isOpaque(id) { return list[id].opaque; }
  function isLiquid(id) { return list[id].liquid; }

  GF.Blocks = {
    list, byKey, ID, get, isSolid, isOpaque, isLiquid,
    NEED_TOOL_NAME, TIER_NAME,
    count: () => list.length,
    /** MOD 接口：注册新方块（必须在 GF.boot() 之前调用） */
    define: B,
    drop,
    DEFAULTS: DEF,
    /** 该方块能否被这套工具破坏 —— 返回 {ok, why, seconds} */
    breakInfo(block, tool) {
      const need = block.tool, tier = block.tier || 0;
      const tt = tool ? tool.type : null, tl = tool ? (tool.tier || 0) : 0;
      const spd = tool ? (tool.speed || 1) : 1;
      if (block.hard >= 1e8) return { ok: false, why: '无法破坏', seconds: Infinity };
      if (!need) {                              // 徒手可采
        const bonus = (tt && tl > 0) ? 1 + tl * 0.25 : 1;
        return { ok: true, why: '', seconds: block.hard / bonus };
      }
      if (tt !== need) return { ok: false, why: `需要${NEED_TOOL_NAME[need] || need}`, seconds: Infinity };
      if (tl < tier) return { ok: false, why: `需要${TIER_NAME[tier] || '更好'}${NEED_TOOL_NAME[need] || ''}`, seconds: Infinity };
      return { ok: true, why: '', seconds: block.hard / (spd * (1 + (tl - tier) * 0.45)) };
    },
  };
})(globalThis.GF = globalThis.GF || {});
