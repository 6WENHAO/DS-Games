/* ==========================================================================
   SPORE · data.js
   阶段元数据 / 细胞阶段与生物阶段的数据表 / 通用常量
   ========================================================================== */
SP.DB = (function () {

  /* ---------------------------------------------------- 五阶段元数据 */
  const STAGES = {
    cell: {
      ico: '🦠', name: '细胞阶段', music: 'cell',
      desc: '你的孢子坠入了一片温暖的潮池。<b>吃</b>比自己小的东西，<b>躲开</b>比自己大的东西。' +
        '绿色碎块是植物，红色是肉 —— 你的嘴决定了你能吃什么。攒够 <b>DNA</b> 后按 <b>E</b> 打开编辑器加装部件。' +
        '长到足够大，你会长出大脑和四肢，爬上陆地。'
    },
    creature: {
      ico: '🦎', name: '生物阶段', music: 'creature',
      desc: '你爬上了陆地。用 <b>攻击技能</b>猎杀其他物种，或用 <b>社交技能</b>模仿它们的表演来结盟 —— 两条路都能推进演化。' +
        '挖掘<b>骨骸</b>能解锁新部件，回到<b>巢穴</b>可以交配并进入编辑器。填满演化条，你的族群将建立起第一个部落。'
    },
    tribal: {
      ico: '🔥', name: '部落阶段', music: 'tribal',
      desc: '你的物种学会了用火。<b>食物是唯一的货币</b> —— 采集、捕鱼、狩猎、驯养。' +
        '买来石斧与长矛可以开战，买来乐器可以表演结盟。让全部 <b>5 个敌对部落</b>臣服或结盟，文明就此诞生。'
    },
    civ: {
      ico: '🏙️', name: '文明阶段', music: 'civ',
      desc: '城市拔地而起。占领<b>香料喷口</b>获得金钱，生产陆行车、舰船与飞行器。' +
        '走<b>军事</b>征服、<b>经济</b>收购还是<b>宗教</b>转化，由你决定。掌控全部 <b>10 座城市</b>，你就能造出第一艘星舰。'
    },
    space: {
      ico: '🚀', name: '星际阶段', music: 'space',
      desc: '整个银河向你敞开。<b>扫描</b>行星、<b>绑架</b>生物、<b>地球化</b>改造、建立<b>殖民地</b>、经营<b>香料贸易</b>。' +
        '与外星帝国外交或开战，最终穿越 <b>Grox</b> 的封锁，抵达<b>银河中心</b>，找到宇宙的答案。'
    }
  };
  const ORDER = ['cell', 'creature', 'tribal', 'civ', 'space'];

  /* ---------------------------------------------------- 细胞阶段 */
  const CELL = {
    poolRadius: 46,          // 潮池半径
    startSize: .55,
    maxSize: 2.6,            // 达到此体型可进化
    dnaPerFood: 2,
    foods: {
      plant: { color: 0x6ee85a, nutrition: 1.0, size: .17, count: 130 },
      meat: { color: 0xff5a5a, nutrition: 1.35, size: .19, count: 70 }
    },
    // 敌对/中立细胞原型（size 相对玩家起始体型）
    npcs: [
      { id: 'nibbler', name: '小啄虫', size: .45, speed: 2.6, hp: 6, diet: 'plant', aggro: 0, w: 30 },
      { id: 'grazer', name: '滤食者', size: .85, speed: 1.9, hp: 12, diet: 'plant', aggro: 0, w: 24 },
      { id: 'stinger', name: '刺客虫', size: .8, speed: 3.2, hp: 14, diet: 'meat', aggro: 1, w: 20, part: 'spike_cell' },
      { id: 'chomper', name: '巨颚虫', size: 1.4, speed: 2.2, hp: 26, diet: 'meat', aggro: 1, w: 14, part: 'mouth_carn' },
      { id: 'zapper', name: '电鞭虫', size: 1.15, speed: 2.4, hp: 20, diet: 'both', aggro: 1, w: 8, part: 'electric' },
      { id: 'leviath', name: '深渊巨虫', size: 3.4, speed: 1.7, hp: 90, diet: 'meat', aggro: 2, w: 4, part: 'tusks' }
    ],
    meteorParts: ['cilia', 'flagella', 'spike_cell', 'poison_cell', 'electric', 'jet', 'mouth_omni', 'mouth_carn', 'mouth_herb']
  };

  /* ---------------------------------------------------- 生物阶段 */
  const CREATURE = {
    worldSize: 320,
    nests: 7,                 // 其他物种巢穴数量
    packMax: 3,
    evolveGoal: 300,          // 演化条总量（DNA 计）
    markers: [100, 200, 300], // 三个刻度 → 大脑变大
    rogueHp: 250, rogueDna: 100,
    epicHp: 1000, epicDna: 200,
    /* 攻击 / 社交技能定义（等级由部件决定） */
    combat: {
      bite: { name: '撕咬', ico: '🦷', cd: .9, range: 2.6, dmg: [6, 11, 17, 24, 33], desc: '近身撕咬，最基础可靠的伤害。' },
      charge: { name: '冲撞', ico: '💥', cd: 3.4, range: 9, dmg: [8, 14, 21, 30, 40], desc: '向前猛冲，撞飞目标。' },
      strike: { name: '打击', ico: '✊', cd: 1.6, range: 3.0, dmg: [7, 13, 19, 27, 36], desc: '用前肢重击，能打断对方动作。' },
      spit: { name: '吐射', ico: '💧', cd: 2.2, range: 18, dmg: [5, 9, 14, 20, 28], desc: '远距离吐出腐蚀性液体。' }
    },
    social: {
      sing: { name: '歌唱', ico: '🎵', cd: 1.2, range: 12, pow: [6, 10, 15, 21, 28], desc: '用鸣声打动对方。' },
      dance: { name: '舞蹈', ico: '💃', cd: 1.4, range: 10, pow: [6, 10, 15, 21, 28], desc: '摆动身体与四肢起舞。' },
      charm: { name: '魅惑', ico: '💗', cd: 1.6, range: 9, pow: [7, 11, 16, 22, 30], desc: '凝视对方，散发亲和力。' },
      pose: { name: '摆姿', ico: '🦚', cd: 1.8, range: 9, pow: [7, 12, 17, 23, 31], desc: '张开装饰器官炫耀自己。' }
    },
    /* 骨骸可解锁的部件池 */
    bonePool: ['jaw', 'beak', 'proboscis', 'sucker', 'tusks', 'eye_stalk', 'eye_compound',
      'foot_hoof', 'foot_claw', 'foot_fin', 'hand_claw', 'hand_palm', 'hand_pincer', 'hand_frond',
      'tail_whip', 'tail_club', 'tail_fan', 'wing_bat', 'wing_feather',
      'spike_back', 'horn', 'plate', 'frill', 'fin_dorsal', 'gland_poison', 'sac_song'],
    /* 起始就有的部件 */
    starterParts: ['jaw', 'beak', 'sucker', 'eye_ball', 'foot_paw', 'hand_palm', 'tail_whip']
  };

  /* ---------------------------------------------------- 通用：食性说明 */
  const DIET_NAME = { plant: '草食', meat: '肉食', both: '杂食' };

  /* ---------------------------------------------------- 徽章（跨阶段） */
  const BADGES = [
    { id: 'first_meal', name: '第一口', ico: '🍽️', desc: '在细胞阶段吃下第一份食物。' },
    { id: 'cell_master', name: '潮池霸主', ico: '🦠', desc: '在细胞阶段吃掉 30 个细胞。' },
    { id: 'land_fall', name: '登陆', ico: '🦎', desc: '进入生物阶段。' },
    { id: 'first_ally', name: '第一个朋友', ico: '🤝', desc: '首次与其他物种结盟。' },
    { id: 'first_kill', name: '猎手', ico: '🩸', desc: '首次杀死其他生物。' },
    { id: 'epic_slayer', name: '巨兽杀手', ico: '🦖', desc: '击杀一只 Epic 巨兽。' },
    { id: 'tribe_born', name: '部落诞生', ico: '🔥', desc: '进入部落阶段。' },
    { id: 'chief', name: '大酋长', ico: '🪶', desc: '解决全部 5 个敌对部落。' },
    { id: 'city_born', name: '城市之光', ico: '🏙️', desc: '进入文明阶段。' },
    { id: 'world_ruler', name: '世界统一', ico: '👑', desc: '掌控全部城市。' },
    { id: 'space_born', name: '飞向太空', ico: '🚀', desc: '进入星际阶段。' },
    { id: 'colonist', name: '殖民者', ico: '🏗️', desc: '建立第一个殖民地。' },
    { id: 'terraformer', name: '造世者', ico: '🌍', desc: '把一颗行星改造到 T3。' },
    { id: 'trader', name: '香料大亨', ico: '💰', desc: '香料贸易累计赚取 50000 星币。' },
    { id: 'grox_slayer', name: '格罗克斯之敌', ico: '🛸', desc: '击落 10 艘 Grox 飞船。' },
    { id: 'center', name: '宇宙的答案', ico: '🌌', desc: '抵达银河中心。' }
  ];

  return { STAGES, ORDER, CELL, CREATURE, DIET_NAME, BADGES };
})();
