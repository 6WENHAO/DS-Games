/* ==========================================================================
   RAFT SURVIVAL · data.js
   物品表 / 合成表 / 建造目录 / 研究表 / 鱼类表 / 任务链
   ========================================================================== */
RS.DB = (function () {

  /* ---------------------------------------------------------------- 物品 */
  const ITEMS = {};
  function I(id, o) { o.id = id; ITEMS[id] = o; return o; }

  // —— 原材料 ——
  I('plank', { name: '木板', ico: '🪵', cat: 'res', stack: 40, fuel: 24, desc: '漂流物中最常见的材料，木筏一切的开始。' });
  I('palm_leaf', { name: '棕榈叶', ico: '🌿', cat: 'res', stack: 40, fuel: 10, desc: '柔韧的大叶片，可以搓成绳索，也能铺屋顶。' });
  I('rope', { name: '绳索', ico: '🧵', cat: 'res', stack: 40, desc: '两片棕榈叶搓成，几乎所有结构都靠它捆住。' });
  I('plastic', { name: '塑料', ico: '🧴', cat: 'res', stack: 40, desc: '海上永不腐烂的垃圾，正好用来做容器和管道。' });
  I('scrap', { name: '废金属', ico: '🔩', cat: 'res', stack: 40, desc: '沉船的残骸。能熔成钉子和螺栓。' });
  I('stone', { name: '石头', ico: '🪨', cat: 'res', stack: 40, desc: '岛屿岩石上敲下来的，锋利且耐用。' });
  I('clay', { name: '黏土', ico: '🟤', cat: 'res', stack: 40, desc: '浅滩海床里挖出的湿泥，烧制后可制砖与容器。' });
  I('sand', { name: '沙子', ico: '⌛', cat: 'res', stack: 40, desc: '细沙，高温可烧成玻璃。' });
  I('seaweed', { name: '海草', ico: '🍃', cat: 'res', stack: 40, food: 4, desc: '海床上摇曳的绿带。可入药，也能勉强吃。' });
  I('vine_goo', { name: '藤蔓胶', ico: '🍯', cat: 'res', stack: 30, desc: '黏稠的植物胶，药膏与防水层的关键。' });
  I('copper', { name: '铜矿石', ico: '🟠', cat: 'res', stack: 30, desc: '海底矿脉上的橙色结晶，需熔炼。' });
  I('copper_ingot', { name: '铜锭', ico: '🥉', cat: 'res', stack: 20, desc: '熔炼后的纯铜，用于电路与精密件。' });
  I('nail', { name: '钉子', ico: '📌', cat: 'res', stack: 60, desc: '一把小钉，让木头真正咬在一起。' });
  I('bolt', { name: '螺栓', ico: '🔧', cat: 'res', stack: 40, desc: '承重结构与机械的连接件。' });
  I('hinge', { name: '铰链', ico: '⚙️', cat: 'res', stack: 30, desc: '能转动的关节，舵和门都需要它。' });
  I('glass', { name: '玻璃', ico: '🔹', cat: 'res', stack: 30, desc: '沙子的重生。用于瓶子和窗户。' });
  I('bottle', { name: '空瓶', ico: '🍾', cat: 'res', stack: 10, desc: '可以随身携带一份淡水。' });
  I('feather', { name: '羽毛', ico: '🪶', cat: 'res', stack: 30, desc: '海鸥掉落的，做箭羽和枕头。' });
  I('shark_head', { name: '鲨鱼头', ico: '🦈', cat: 'res', stack: 4, desc: '布鲁斯的战利品，挂在墙上宣示主权。' });

  // —— 水 ——
  I('salt_water', { name: '一杯咸水', ico: '🌊', cat: 'drink', stack: 8, desc: '直接喝会加剧脱水，请先净化。', badWater: true });
  I('fresh_water', { name: '一杯淡水', ico: '💧', cat: 'drink', stack: 8, water: 32, desc: '甘甜。生存的第一条防线。' });
  I('bottle_water', { name: '一瓶淡水', ico: '🍾', cat: 'drink', stack: 6, water: 55, desc: '一整瓶，够跑一趟远岛。' });

  // —— 生鱼与肉 ——
  const FISH = [
    ['herring', '鲱鱼', '🐟', 8, 12, 1.0],
    ['tilapia', '罗非鱼', '🐠', 10, 16, .8],
    ['pomfret', '鲳鱼', '🐡', 12, 20, .55],
    ['salmon', '三文鱼', '🐟', 15, 26, .35],
    ['catfish', '鲶鱼', '🐟', 18, 30, .18]
  ];
  FISH.forEach(f => {
    I('raw_' + f[0], { name: '生' + f[1], ico: f[2], cat: 'food', stack: 20, food: f[3], desc: '生食风险高，最好先烤熟。', cookTo: 'cooked_' + f[0], cookTime: 10 });
    I('cooked_' + f[0], { name: '烤' + f[1], ico: '🍢', cat: 'food', stack: 20, food: f[4], water: 2, desc: '外皮焦香，海上难得的美味。' });
  });
  I('raw_shark', { name: '生鲨鱼肉', ico: '🦈', cat: 'food', stack: 10, food: 12, desc: '厚实的白肉，务必烤熟。', cookTo: 'cooked_shark', cookTime: 16 });
  I('cooked_shark', { name: '烤鲨鱼肉', ico: '🍖', cat: 'food', stack: 10, food: 40, water: 4, desc: '复仇的滋味，饱腹感极强。' });
  I('raw_meat', { name: '生肉', ico: '🥩', cat: 'food', stack: 10, food: 10, desc: '岛上野味。', cookTo: 'cooked_meat', cookTime: 12 });
  I('cooked_meat', { name: '烤肉', ico: '🍖', cat: 'food', stack: 10, food: 30, desc: '油脂滴在炭火上的声音。' });

  // —— 果实与作物 ——
  I('coconut', { name: '椰子', ico: '🥥', cat: 'food', stack: 20, food: 8, water: 14, desc: '砸开就有清甜的椰汁。', seedOf: 'palm' });
  I('mango', { name: '芒果', ico: '🥭', cat: 'food', stack: 20, food: 16, water: 6, desc: '熟透的芒果，甜到发腻。', seedOf: 'mango' });
  I('pineapple', { name: '菠萝', ico: '🍍', cat: 'food', stack: 20, food: 18, water: 8, desc: '带刺的甜，纤维很足。', seedOf: 'pineapple' });
  I('watermelon', { name: '西瓜', ico: '🍉', cat: 'food', stack: 12, food: 14, water: 26, desc: '海上最好的解渴品。', seedOf: 'watermelon' });
  I('potato', { name: '土豆', ico: '🥔', cat: 'food', stack: 20, food: 10, desc: '生吃寡淡，烤后极佳。', cookTo: 'cooked_potato', cookTime: 12, seedOf: 'potato' });
  I('cooked_potato', { name: '烤土豆', ico: '🥘', cat: 'food', stack: 20, food: 24, desc: '外焦里糯。' });
  I('beet', { name: '甜菜', ico: '🥕', cat: 'food', stack: 20, food: 12, water: 4, desc: '根茎作物，糖分很高。', seedOf: 'beet' });
  I('berries', { name: '红果', ico: '🍒', cat: 'food', stack: 30, food: 6, water: 4, desc: '灌木上摘的，酸甜开胃。' });
  I('mushroom', { name: '洞穴菇', ico: '🍄', cat: 'food', stack: 20, food: 9, desc: '阴暗处生长，味道意外地好。' });

  // —— 药品 ——
  I('salve', { name: '治疗药膏', ico: '🩹', cat: 'food', stack: 10, heal: 30, desc: '海草与藤蔓胶熬成，能立刻止血。' });
  I('good_salve', { name: '优质药膏', ico: '💊', cat: 'food', stack: 10, heal: 70, desc: '加了蜂胶与铜粉，效果翻倍。' });

  // —— 工具 ——
  I('hammer', { name: '建造锤', ico: '🔨', cat: 'tool', stack: 1, tool: 'hammer', dur: 999999, desc: '左键敲击建造 / 修复地基。按 B 打开建造目录。' });
  I('hook', { name: '打捞钩', ico: '🧲', cat: 'tool', stack: 1, tool: 'hook', dur: 400, desc: '按住左键蓄力，松手抛出，把海面上的漂流物拉回来。' });
  I('axe', { name: '石斧', ico: '🪓', cat: 'tool', stack: 1, tool: 'axe', dmg: 14, dur: 260, desc: '砍树、敲岩石、必要时砍鲨鱼。' });
  I('spear', { name: '木矛', ico: '🔱', cat: 'tool', stack: 1, tool: 'spear', dmg: 18, dur: 200, desc: '布鲁斯啃木筏时，就靠它把它捅走。' });
  I('stone_spear', { name: '石矛', ico: '🗡️', cat: 'tool', stack: 1, tool: 'spear', dmg: 32, dur: 380, desc: '石制矛头，三下就能赶走鲨鱼。' });
  I('rod', { name: '钓竿', ico: '🎣', cat: 'tool', stack: 1, tool: 'rod', dur: 500, desc: '左键抛竿，鱼咬钩时按住左键收线并稳住指针。' });
  I('cup', { name: '杯子', ico: '🥛', cat: 'tool', stack: 1, tool: 'cup', dur: 999999, desc: '对着海面左键可舀一杯咸水。' });
  I('bucket', { name: '木桶', ico: '🧺', cat: 'tool', stack: 1, tool: 'bucket', dur: 999999, desc: '一次装 3 份水，也能给作物浇水。' });
  I('torch', { name: '火把', ico: '🔥', cat: 'tool', stack: 1, tool: 'torch', dur: 900, desc: '夜里和洞穴中的唯一光源。' });
  I('bait', { name: '鲨鱼诱饵', ico: '🩸', cat: 'tool', stack: 10, desc: '扔进海里，布鲁斯会去追它而不是你。' });

  /* ------------------------------------------------------------ 建造目录 */
  // kind: base(地基) / edge(墙类，贴在格子边) / roof / object(家具机械) / upper(上层地板)
  const BUILD = [
    { id: 'foundation', name: '地基', ico: '🟫', kind: 'base', cost: { plank: 2 }, hp: 100, desc: '木筏的骨架。所有东西都必须建在地基上。' },
    { id: 'foundation_armored', name: '加固地基', ico: '🛡️', kind: 'base', cost: { plank: 2, scrap: 2, bolt: 1 }, hp: 320, lock: 'armor', desc: '包了铁皮，鲨鱼要咬很久。' },
    { id: 'pillar', name: '支柱', ico: '🪵', kind: 'object', cost: { plank: 1 }, h: 2.4, desc: '撑起上层与屋顶。' },
    { id: 'wall', name: '木墙', ico: '🧱', kind: 'edge', cost: { plank: 3 }, desc: '挡风、挡雨、挡视线。' },
    { id: 'wall_half', name: '栏杆', ico: '🚧', kind: 'edge', cost: { plank: 2 }, half: true, desc: '半高护栏，防止走神时掉海里。' },
    { id: 'wall_window', name: '窗墙', ico: '🪟', kind: 'edge', cost: { plank: 3, glass: 1 }, lock: 'glasswork', desc: '有玻璃的墙，看得见海。' },
    { id: 'roof', name: '棕榈屋顶', ico: '🏠', kind: 'roof', cost: { plank: 1, palm_leaf: 2 }, desc: '遮阳挡雨，还能收集雨水。' },
    { id: 'upper_floor', name: '上层地板', ico: '⬜', kind: 'upper', cost: { plank: 3, rope: 1 }, lock: 'carpentry', desc: '二层平台，视野更好。' },

    { id: 'simple_purifier', name: '简易净水器', ico: '🚰', kind: 'object', cost: { plank: 6, palm_leaf: 6, rope: 2 }, station: 'purifier', desc: '放一杯咸水 + 一块木板当燃料，蒸馏出淡水。' },
    { id: 'simple_grill', name: '简易烤架', ico: '♨️', kind: 'object', cost: { plank: 6, rope: 2, stone: 3 }, station: 'grill', desc: '烤鱼、烤肉、烧玻璃、熔铜。' },
    { id: 'collection_net', name: '收集网', ico: '🕸️', kind: 'object', cost: { plank: 8, rope: 8 }, station: 'net', desc: '自动捕获从前方漂来的物资，省下大量抛钩时间。' },
    { id: 'water_collector', name: '集水器', ico: '☔', kind: 'object', cost: { plank: 10, palm_leaf: 6, plastic: 4 }, station: 'collector', lock: 'plastics', desc: '下雨时自动积攒淡水。' },
    { id: 'storage_box', name: '储物箱', ico: '📦', kind: 'object', cost: { plank: 10, rope: 4 }, station: 'storage', slots: 24, desc: '把背包塞不下的东西堆在这里。' },
    { id: 'research_table', name: '研究台', ico: '🔬', kind: 'object', cost: { plank: 20, palm_leaf: 10, rope: 4 }, station: 'research', desc: '把材料放上去研究，解锁新配方。' },
    { id: 'sail', name: '船帆', ico: '⛵', kind: 'object', cost: { plank: 10, palm_leaf: 20, rope: 6 }, station: 'sail', h: 5, desc: '升起帆，木筏就顺风漂向新的海域。' },
    { id: 'steering_wheel', name: '舵轮', ico: '🎡', kind: 'object', cost: { plank: 12, rope: 4, plastic: 6, hinge: 1 }, station: 'wheel', lock: 'navigation', desc: '掌握航向，主动开向岛屿。' },
    { id: 'anchor', name: '锚', ico: '⚓', kind: 'object', cost: { scrap: 12, rope: 8 }, station: 'anchor', lock: 'metalwork', desc: '抛下锚，木筏停在岛边不再漂走。' },
    { id: 'crop_plot', name: '种植槽', ico: '🌱', kind: 'object', cost: { plank: 8, rope: 4 }, station: 'crop', desc: '种下种子，浇水，等待收获。' },
    { id: 'bed', name: '吊床', ico: '🛏️', kind: 'object', cost: { plank: 10, palm_leaf: 8, rope: 4 }, station: 'bed', desc: '设为重生点，也可以睡到天亮。' },
    { id: 'lamp', name: '油灯', ico: '🏮', kind: 'object', cost: { plank: 4, rope: 2, plastic: 1 }, station: 'lamp', desc: '夜里给木筏一点暖光。' },
    { id: 'shark_trophy', name: '鲨鱼头颅', ico: '🦈', kind: 'object', cost: { shark_head: 1, plank: 4 }, station: 'trophy', desc: '把布鲁斯挂起来。纯粹的炫耀。' }
  ];
  const BUILD_MAP = {};
  BUILD.forEach(b => BUILD_MAP[b.id] = b);

  /* ---------------------------------------------------------------- 合成 */
  // cat: 资源 / 工具 / 食物 / 装备
  const RECIPES = [
    { id: 'rope', out: 'rope', n: 1, cat: 'res', cost: { palm_leaf: 2 } },
    { id: 'nail', out: 'nail', n: 4, cat: 'res', cost: { scrap: 1 }, lock: 'metalwork' },
    { id: 'bolt', out: 'bolt', n: 1, cat: 'res', cost: { scrap: 2, copper_ingot: 1 }, lock: 'metalwork' },
    { id: 'hinge', out: 'hinge', n: 1, cat: 'res', cost: { scrap: 3, bolt: 1 }, lock: 'metalwork' },
    { id: 'bottle', out: 'bottle', n: 1, cat: 'res', cost: { glass: 2, plastic: 1 }, lock: 'glasswork' },
    { id: 'bait', out: 'bait', n: 2, cat: 'res', cost: { raw_herring: 1, seaweed: 2 } },

    { id: 'hammer', out: 'hammer', n: 1, cat: 'tool', cost: { plank: 4, rope: 2 } },
    { id: 'hook', out: 'hook', n: 1, cat: 'tool', cost: { plank: 6, rope: 4 } },
    { id: 'cup', out: 'cup', n: 1, cat: 'tool', cost: { plank: 2, palm_leaf: 1 } },
    { id: 'axe', out: 'axe', n: 1, cat: 'tool', cost: { plank: 6, rope: 4, stone: 2 } },
    { id: 'spear', out: 'spear', n: 1, cat: 'tool', cost: { plank: 6, rope: 2 } },
    { id: 'stone_spear', out: 'stone_spear', n: 1, cat: 'tool', cost: { plank: 6, rope: 3, stone: 4 }, lock: 'stonework' },
    { id: 'rod', out: 'rod', n: 1, cat: 'tool', cost: { plank: 8, rope: 6 } },
    { id: 'bucket', out: 'bucket', n: 1, cat: 'tool', cost: { plank: 6, rope: 2, plastic: 4 }, lock: 'plastics' },
    { id: 'torch', out: 'torch', n: 1, cat: 'tool', cost: { plank: 2, rope: 1, palm_leaf: 1 } },

    { id: 'salve', out: 'salve', n: 1, cat: 'food', cost: { seaweed: 2, vine_goo: 1 }, lock: 'medicine' },
    { id: 'good_salve', out: 'good_salve', n: 1, cat: 'food', cost: { seaweed: 4, vine_goo: 2, copper_ingot: 1 }, lock: 'medicine' },
    { id: 'bottle_water', out: 'bottle_water', n: 1, cat: 'food', cost: { bottle: 1, fresh_water: 2 }, lock: 'glasswork' }
  ];

  /* -------------------------------------------------------------- 熔炼/烤 */
  // 烤架除了熟食，还能烧玻璃和熔铜
  const SMELT = {
    sand: { out: 'glass', n: 1, time: 14 },
    copper: { out: 'copper_ingot', n: 1, time: 20 },
    clay: { out: 'bolt', n: 1, time: 18, lock: 'metalwork' }
  };

  /* ---------------------------------------------------------------- 研究 */
  const RESEARCH = [
    { id: 'ropecraft', name: '编织学', ico: '🧵', need: { palm_leaf: 4 }, unlocks: [], desc: '掌握绳索与茅草结构。' },
    { id: 'stonework', name: '石器工艺', ico: '🪨', need: { stone: 4 }, unlocks: ['stone_spear'], desc: '石制矛头与磨刃。' },
    { id: 'metalwork', name: '金属加工', ico: '🔩', need: { scrap: 4, stone: 2 }, unlocks: ['nail', 'bolt', 'hinge', 'anchor'], desc: '钉子、螺栓、铰链与锚。' },
    { id: 'plastics', name: '塑料回收', ico: '🧴', need: { plastic: 4 }, unlocks: ['bucket', 'water_collector'], desc: '木桶与集水器。' },
    { id: 'navigation', name: '航海术', ico: '🧭', need: { plank: 10, rope: 4 }, unlocks: ['steering_wheel'], desc: '让木筏听话地转向。' },
    { id: 'glasswork', name: '玻璃烧制', ico: '🔹', need: { sand: 4, glass: 1 }, unlocks: ['bottle', 'wall_window', 'bottle_water'], desc: '窗户与玻璃瓶。' },
    { id: 'medicine', name: '海洋药理', ico: '🩹', need: { seaweed: 4, vine_goo: 2 }, unlocks: ['salve', 'good_salve'], desc: '药膏配方。' },
    { id: 'armor', name: '结构加固', ico: '🛡️', need: { scrap: 6, bolt: 2 }, unlocks: ['foundation_armored'], desc: '让鲨鱼咬不穿的地基。' },
    { id: 'carpentry', name: '高级木工', ico: '🪚', need: { plank: 16, nail: 4 }, unlocks: ['upper_floor'], desc: '搭建二层平台。' }
  ];
  const RESEARCH_MAP = {};
  RESEARCH.forEach(r => RESEARCH_MAP[r.id] = r);

  /* -------------------------------------------------------------- 作物 */
  const CROPS = {
    palm: { name: '棕榈苗', grow: 120, yield: { palm_leaf: 3, coconut: 1 }, ico: '🌴' },
    mango: { name: '芒果树', grow: 150, yield: { mango: 2 }, ico: '🥭' },
    pineapple: { name: '菠萝', grow: 110, yield: { pineapple: 2 }, ico: '🍍' },
    watermelon: { name: '西瓜', grow: 130, yield: { watermelon: 1 }, ico: '🍉' },
    potato: { name: '土豆', grow: 90, yield: { potato: 3 }, ico: '🥔' },
    beet: { name: '甜菜', grow: 95, yield: { beet: 3 }, ico: '🥕' }
  };

  /* -------------------------------------------------------------- 漂流物 */
  // 海面漂来的东西
  const DEBRIS = [
    { type: 'plank_pile', ico: '🪵', mesh: 'planks', loot: { plank: [1, 3] }, w: 30 },
    { type: 'palm_pile', ico: '🌿', mesh: 'leaves', loot: { palm_leaf: [1, 3] }, w: 26 },
    { type: 'barrel', ico: '🛢️', mesh: 'barrel', loot: { plastic: [1, 2], plank: [0, 2], scrap: [0, 1] }, w: 18 },
    { type: 'plastic_bag', ico: '🧴', mesh: 'plastic', loot: { plastic: [1, 3] }, w: 20 },
    { type: 'crate', ico: '📦', mesh: 'crate', loot: { plank: [2, 4], rope: [0, 2], scrap: [0, 2] }, w: 10 },
    { type: 'seaweed_clump', ico: '🍃', mesh: 'leaves', loot: { seaweed: [1, 3] }, w: 14 },
    { type: 'scrap_pile', ico: '🔩', mesh: 'scrap', loot: { scrap: [1, 3] }, w: 12 },
    { type: 'lost_chest', ico: '🧰', mesh: 'crate', loot: { plank: [3, 6], scrap: [1, 3], plastic: [1, 3], copper: [0, 2], vine_goo: [0, 1] }, w: 3, rare: true }
  ];

  /* -------------------------------------------------------------- 岛屿资源 */
  const NODES = {
    palm: { name: '棕榈树', hits: 4, tool: 'axe', loot: { plank: [2, 4], palm_leaf: [2, 4] }, extra: { coconut: [1, 2] }, respawn: 240 },
    rock: { name: '岩石', hits: 5, tool: 'axe', loot: { stone: [2, 4] }, respawn: 300 },
    clay_bank: { name: '黏土滩', hits: 3, tool: 'any', loot: { clay: [2, 3], sand: [1, 2] }, respawn: 200 },
    copper_vein: { name: '铜矿脉', hits: 6, tool: 'axe', loot: { copper: [2, 3] }, respawn: 420 },
    berry_bush: { name: '红果灌木', hits: 2, tool: 'any', loot: { berries: [2, 4] }, respawn: 180 },
    vine: { name: '藤蔓', hits: 2, tool: 'any', loot: { vine_goo: [1, 2], rope: [0, 1] }, respawn: 220 },
    seaweed_bed: { name: '海草床', hits: 1, tool: 'any', loot: { seaweed: [1, 3] }, respawn: 160 },
    sand_pile: { name: '沙堆', hits: 2, tool: 'any', loot: { sand: [2, 4] }, respawn: 150 },
    mango_tree: { name: '芒果树', hits: 4, tool: 'axe', loot: { plank: [2, 3] }, extra: { mango: [1, 3] }, respawn: 260 },
    pineapple_plant: { name: '菠萝丛', hits: 1, tool: 'any', loot: { pineapple: [1, 2] }, respawn: 220 },
    watermelon_patch: { name: '西瓜地', hits: 1, tool: 'any', loot: { watermelon: [1, 1] }, respawn: 240 },
    wreck_crate: { name: '沉船木箱', hits: 2, tool: 'any', loot: { plank: [2, 4], scrap: [1, 3], plastic: [1, 2] }, respawn: -1 }
  };

  /* -------------------------------------------------------------- 任务链 */
  const QUESTS = [
    { id: 'q_hook', text: '用打捞钩收集 5 块木板', goal: 5, track: 'collect:plank' },
    { id: 'q_found', text: '扩建木筏至 9 块地基', goal: 9, track: 'foundations' },
    { id: 'q_water', text: '建造净水器并喝下淡水', goal: 1, track: 'drink_fresh' },
    { id: 'q_food', text: '建造烤架并吃一份熟食', goal: 1, track: 'eat_cooked' },
    { id: 'q_net', text: '建造收集网自动打捞', goal: 1, track: 'built:collection_net' },
    { id: 'q_spear', text: '造一把矛并击退布鲁斯', goal: 1, track: 'shark_repel' },
    { id: 'q_research', text: '建造研究台并完成 3 项研究', goal: 3, track: 'research' },
    { id: 'q_sail', text: '升起船帆，让木筏动起来', goal: 1, track: 'sail_up' },
    { id: 'q_island', text: '抵达第一座岛屿', goal: 1, track: 'island_visit' },
    { id: 'q_gather', text: '在岛上采集 10 石头', goal: 10, track: 'collect:stone' },
    { id: 'q_dive', text: '潜水采集 4 铜矿石', goal: 4, track: 'collect:copper' },
    { id: 'q_bed', text: '搭一张吊床作为重生点', goal: 1, track: 'built:bed' },
    { id: 'q_survive', text: '在海上存活 5 天', goal: 5, track: 'days' }
  ];

  /* ------------------------------------------------------------ 图鉴条目 */
  const NOTES = [
    { t: '生存三角', p: '饥饿与口渴会持续下降；口渴归零掉血更快。淡水只能靠净水器、集水器或椰子/西瓜。生鱼能顶饿但有几率轻微中毒。' },
    { t: '布鲁斯（鲨鱼）', p: '每隔一段时间它会啃咬随机一块地基，被咬穿的地基会消失并带走上面的东西。用矛攻击 2~3 次可以把它赶走；它在水里会优先攻击你。丢出诱饵能换来约 40 秒安全时间。' },
    { t: '打捞与收集网', p: '海面漂流物会从木筏前方经过。手动抛钩命中即拉回；建造收集网后会自动收集经过的物资。' },
    { t: '航行', p: '升起船帆即顺风漂流；配合舵轮可以主动转向。抛锚可以停在岛边。地图上的岛屿只有停船才能安心探索。' },
    { t: '岛屿', p: '岛上有棕榈树、岩石、黏土滩、灌木和沉船箱。浅滩下方有海草与铜矿脉，需要潜水，注意氧气。' },
    { t: '研究台', p: '把材料放进研究台可以解锁新的配方与建筑，例如金属加工解锁钉子、螺栓与锚。' },
    { t: '天气', p: '夜晚气温下降视野变差；暴风雨会让海浪变大、木筏摇晃更剧烈，并带来雨水（集水器会自动装满）。' },
    { t: '种植', p: '种植槽可以种下椰子/芒果/菠萝/西瓜/土豆/甜菜，浇水后等待成熟，可无限循环收获。' }
  ];

  function item(id) { return ITEMS[id]; }
  function name(id) { return ITEMS[id] ? ITEMS[id].name : id; }
  function ico(id) { return ITEMS[id] ? ITEMS[id].ico : '❓'; }

  return { ITEMS, item, name, ico, BUILD, BUILD_MAP, RECIPES, SMELT, RESEARCH, RESEARCH_MAP, CROPS, DEBRIS, NODES, QUESTS, NOTES, FISH };
})();
