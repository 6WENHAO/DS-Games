/* data.js — 文明VI 游戏数据（产出、单位、科技/市政树、区域、文明） */
(function (global) {
  "use strict";

  // ---- 产出键 ---- food食物, prod生产力, gold金币, sci科技, cul文化, faith信仰
  function Y(food = 0, prod = 0, gold = 0, sci = 0, cul = 0, faith = 0) {
    return { food, prod, gold, sci, cul, faith };
  }

  // ---------- 地形 ----------
  const TERRAIN = {
    ocean:     { name: "海洋",   color: "#12385f", water: true,  yield: Y(1),        move: 1 },
    coast:     { name: "海岸",   color: "#1f6ea3", water: true,  yield: Y(1,0,1),    move: 1 },
    grassland: { name: "草原",   color: "#5f9b3a", yield: Y(2),                       move: 1 },
    plains:    { name: "平原",   color: "#9caa4c", yield: Y(1,1),                      move: 1 },
    desert:    { name: "沙漠",   color: "#d9c27a", yield: Y(),                          move: 1 },
    tundra:    { name: "苔原",   color: "#9db09a", yield: Y(1),                         move: 1 },
    snow:      { name: "雪地",   color: "#e2eaef", yield: Y(),                          move: 1 }
  };

  // ---------- 地貌高度 ----------
  const ELEV = {
    flat:     { name: "平地",   yield: Y(),      move: 0, block: false },
    hills:    { name: "丘陵",   yield: Y(0,1),   move: 1, block: false, defense: 3 },
    mountain: { name: "山脉",   yield: Y(),      move: 0, block: true }
  };

  // ---------- 地形特征 ----------
  const FEATURE = {
    woods:      { name: "森林",       yield: Y(0,1),   move: 1, defense: 3, appeal: 1, on: ["grassland","plains","tundra"] },
    rainforest: { name: "雨林",       yield: Y(1),     move: 1, defense: 0, appeal: -1, on: ["grassland","plains"] },
    marsh:      { name: "沼泽",       yield: Y(1),     move: 1, appeal: -1, on: ["grassland"] },
    floodplains:{ name: "泛滥平原",   yield: Y(3),     move: 0, appeal: -1, on: ["desert","grassland","plains"] },
    oasis:      { name: "绿洲",       yield: Y(3,0,1), move: 0, appeal: 1, on: ["desert"] },
    reef:       { name: "礁石",       yield: Y(1,1),   move: 1, appeal: 1, on: ["coast"] }
  };

  // ---------- 资源 ----------
  const RES = {
    // 奖励资源
    wheat:   { name: "小麦",   cls: "bonus", yield: Y(1),     on: ["plains","floodplains"] },
    rice:    { name: "稻米",   cls: "bonus", yield: Y(1),     on: ["grassland","marsh"] },
    cattle:  { name: "牛",     cls: "bonus", yield: Y(0,1),   on: ["grassland"] },
    sheep:   { name: "绵羊",   cls: "bonus", yield: Y(0,1),   on: ["hills"] },
    deer:    { name: "鹿",     cls: "bonus", yield: Y(0,1),   on: ["woods","tundra"] },
    bananas: { name: "香蕉",   cls: "bonus", yield: Y(1),     on: ["rainforest"] },
    stone:   { name: "石料",   cls: "bonus", yield: Y(0,1),   on: ["grassland","plains"] },
    fish:    { name: "鱼",     cls: "bonus", yield: Y(1),     on: ["coast"] },
    crabs:   { name: "螃蟹",   cls: "bonus", yield: Y(0,0,2), on: ["coast"] },
    copper:  { name: "铜",     cls: "bonus", yield: Y(0,0,2), on: ["hills"] },
    // 奢侈资源
    wine:    { name: "葡萄酒", cls: "luxury", yield: Y(0,0,1), on: ["grassland","plains"] },
    furs:    { name: "毛皮",   cls: "luxury", yield: Y(0,0,1), on: ["woods","tundra"] },
    incense: { name: "香料",   cls: "luxury", yield: Y(0,0,1), on: ["desert","plains"] },
    silk:    { name: "丝绸",   cls: "luxury", yield: Y(0,0,0,0,1), on: ["woods"] },
    dyes:    { name: "染料",   cls: "luxury", yield: Y(0,0,0,0,0,1), on: ["rainforest"] },
    pearls:  { name: "珍珠",   cls: "luxury", yield: Y(0,0,0,0,0,1), on: ["coast"] },
    marble:  { name: "大理石", cls: "luxury", yield: Y(0,0,0,0,1), on: ["hills","grassland"] },
    // 战略资源
    horses:  { name: "马匹",   cls: "strategic", yield: Y(0,1), on: ["grassland","plains"], reveal: "animalHusbandry" },
    iron:    { name: "铁",     cls: "strategic", yield: Y(0,0,0,1), on: ["hills","grassland","tundra","desert"], reveal: "bronzeWorking" },
    niter:   { name: "硝石",   cls: "strategic", yield: Y(1),    on: ["plains","grassland","desert"], reveal: "militaryEngineering" }
  };

  // ---------- 单元改良设施（由建造者建造）----------
  const IMPROVEMENT = {
    farm:      { name: "农场",   yield: Y(1),      tech: "pottery",         on: ["grassland","plains","floodplains"], noFeature: true },
    mine:      { name: "矿场",   yield: Y(0,1),    tech: "mining",          onElev: ["hills"], onRes: ["iron","copper","sheep"] },
    pasture:   { name: "牧场",   yield: Y(0,1),    tech: "animalHusbandry", onRes: ["cattle","horses","sheep"] },
    plantation:{ name: "种植园", yield: Y(0,0,2),  tech: "irrigation",      onRes: ["wine","silk","dyes","incense","bananas"] },
    camp:      { name: "营地",   yield: Y(0,0,1),  tech: "animalHusbandry", onRes: ["deer","furs"] },
    quarry:    { name: "采石场", yield: Y(0,1,1),  tech: "mining",          onRes: ["stone","marble"] },
    fishingBoats:{name:"渔船",   yield: Y(1),      tech: "sailing",         onRes: ["fish","crabs","pearls"], water: true },
    lumberMill:{ name: "伐木场", yield: Y(0,1),    tech: "construction",    onFeature: ["woods"] }
  };

  // ---------- 单位 ----------
  const UNIT = {
    settler:  { name: "开拓者", cls: "civilian", move: 2, cost: 80,  founds: true, icon: "S", color: "#e8d9a0" },
    builder:  { name: "建造者", cls: "civilian", move: 2, cost: 50,  charges: 3, builds: true, icon: "B", color: "#c8a86a" },
    warrior:  { name: "勇士",   cls: "melee",    move: 2, cost: 40,  atk: 20, icon: "⚔", color: "#c96b4a" },
    scout:    { name: "侦察兵", cls: "recon",    move: 3, cost: 30,  atk: 10, icon: "◎", color: "#7aae6b" },
    slinger:  { name: "投石兵", cls: "ranged",   move: 2, cost: 35,  atk: 5,  rangedAtk: 15, range: 1, tech: null, icon: "⟡", color: "#b0894a" },
    archer:   { name: "弓箭手", cls: "ranged",   move: 2, cost: 60,  atk: 15, rangedAtk: 25, range: 2, tech: "archery", icon: "➶", color: "#8a7a3a" },
    spearman: { name: "长矛兵", cls: "melee",    move: 2, cost: 65,  atk: 25, tech: "bronzeWorking", antiCav: true, icon: "⛏", color: "#8a5a3a" },
    horseman: { name: "骑兵",   cls: "cavalry",  move: 4, cost: 80,  atk: 36, tech: null, civic: null, strat: "horses", icon: "♞", color: "#a06a3a" },
    swordsman:{ name: "剑士",   cls: "melee",    move: 2, cost: 90,  atk: 35, tech: "ironWorking", strat: "iron", icon: "🗡", color: "#9a4a3a" },
    catapult: { name: "弩炮",   cls: "siege",    move: 2, cost: 120, atk: 20, rangedAtk: 35, range: 2, tech: "engineering", icon: "⊕", color: "#7a5a3a" }
  };

  // ---------- 区域 ----------
  const DISTRICT = {
    cityCenter:    { name: "市中心", auto: true },
    campus:        { name: "学院",       cost: 54, tech: "writing",       yieldType: "sci",   adj: ["mountain","rainforest"], icon: "🔬" },
    holySite:      { name: "圣地",       cost: 54, tech: "astrology",     yieldType: "faith", adj: ["mountain","woods"], icon: "✝" },
    encampment:    { name: "军营",       cost: 54, tech: "bronzeWorking", military: true, icon: "🛡" },
    harbor:        { name: "港口",       cost: 54, tech: "celestial",     yieldType: "gold",  water: true, icon: "⚓" },
    commercialHub: { name: "商业中心",   cost: 54, civic: "foreignTrade", yieldType: "gold",  adj: ["river"], icon: "💰" },
    theaterSquare: { name: "剧院广场",   cost: 54, civic: "dramaPoetry",  yieldType: "cul",   adj: ["wonder"], icon: "🎭" },
    industrialZone:{ name: "工业区",     cost: 54, tech: "apprenticeship",yieldType: "prod", adj: ["mine","quarry"], icon: "⚙" },
    entertainment: { name: "娱乐中心",   cost: 54, civic: "gamesRecreation", amenity: true, icon: "🎡" }
  };

  // ---------- 建筑 ----------
  const BUILDING = {
    // 市中心
    monument:  { name: "纪念碑",   district: "cityCenter", cost: 60,  yield: Y(0,0,0,0,2),   civic: null },
    granary:   { name: "粮仓",     district: "cityCenter", cost: 65,  yield: Y(1),           tech: "pottery", housing: 2 },
    walls:     { name: "古代城墙", district: "cityCenter", cost: 80, tech: "masonry", defense: 50 },
    waterMill: { name: "水磨坊",   district: "cityCenter", cost: 80,  yield: Y(1,1),         tech: "wheel" },
    // 学院
    library:   { name: "图书馆",   district: "campus", cost: 90,  yield: Y(0,0,0,2) },
    university:{ name: "大学",     district: "campus", cost: 250, yield: Y(0,0,0,4), tech: "education" },
    // 圣地
    shrine:    { name: "神龛",     district: "holySite", cost: 70,  yield: Y(0,0,0,0,0,2) },
    temple:    { name: "神庙",     district: "holySite", cost: 120, yield: Y(0,0,0,0,0,4), tech: "astrology" },
    // 商业中心
    market:    { name: "市场",     district: "commercialHub", cost: 90,  yield: Y(0,0,3) },
    bank:      { name: "银行",     district: "commercialHub", cost: 220, yield: Y(0,0,5), tech: "banking" },
    // 剧院广场
    amphitheater:{ name:"露天剧场", district:"theaterSquare", cost: 150, yield: Y(0,0,0,0,2), tech: null },
    // 军营
    barracks:  { name: "兵营",     district: "encampment", cost: 90, yield: Y(0,1) },
    // 港口
    lighthouse:{ name: "灯塔",     district: "harbor", cost: 90, yield: Y(1,0,1) },
    // 工业区
    workshop:  { name: "作坊",     district: "industrialZone", cost: 195, yield: Y(0,3) }
  };

  // ---------- 奇观 ----------
  const WONDER = {
    pyramids:   { name: "金字塔",   cost: 220, tech: "masonry",    yield: Y(0,0,0,0,2), effect: "免费获得一个建造者；文化+1", terrain: "desert" },
    greatLibrary:{name: "大图书馆", cost: 400, tech: "recordedHistory", yield: Y(0,0,0,3), effect: "科技+2；获得免费的科技促发" },
    stonehenge: { name: "巨石阵",   cost: 180, tech: "astrology",  yield: Y(0,0,0,0,0,2), effect: "信仰+2" },
    hangingGardens:{name:"空中花园",cost:180,tech:"irrigation", yield: Y(2), effect: "所有城市增长+15%" },
    colosseum:  { name: "大竞技场", cost: 400, civic: "gamesRecreation", yield: Y(0,0,0,0,2), effect: "宜人度+2，附近文化+2" },
    greatBath:  { name: "大浴场",   cost: 180, tech: "pottery",    yield: Y(0,0,0,0,0,1), effect: "住房+1，防洪" }
  };

  // ---------- 科技树（远古 → 古典 → 中世纪）----------
  // pos: {x,y} 布局坐标格。boost = 尤里卡描述。
  const TECH = {
    pottery:        { name: "制陶术",     cost: 25,  era: "Ancient", pre: [],                pos:[0,0], boost:"建立一座城市" },
    animalHusbandry:{ name: "畜牧业",     cost: 25,  era: "Ancient", pre: [],                pos:[0,1], boost:"用牧场改良一处资源" },
    mining:         { name: "采矿业",     cost: 25,  era: "Ancient", pre: [],                pos:[0,2], boost:"" },
    sailing:        { name: "航海术",     cost: 50,  era: "Ancient", pre: ["pottery"],       pos:[1,0], boost:"建立一座沿海城市" },
    astrology:      { name: "占星术",     cost: 50,  era: "Ancient", pre: ["pottery"],       pos:[1,3], boost:"发现一处自然奇观" },
    irrigation:     { name: "灌溉",       cost: 50,  era: "Ancient", pre: ["pottery"],       pos:[1,1], boost:"用农场改良一处资源" },
    writing:        { name: "文字",       cost: 50,  era: "Ancient", pre: ["astrology"],     pos:[2,3], boost:"遇见另一个文明" },
    masonry:        { name: "砌砖术",     cost: 80,  era: "Ancient", pre: ["mining"],        pos:[1,2], boost:"建造一座采石场" },
    archery:        { name: "弓术",       cost: 50,  era: "Ancient", pre: ["animalHusbandry"],pos:[1,4], boost:"用投石兵消灭一个单位" },
    bronzeWorking:  { name: "青铜术",     cost: 80,  era: "Ancient", pre: ["mining"],        pos:[2,2], boost:"消灭3个蛮族" },
    wheel:          { name: "轮子",       cost: 80,  era: "Ancient", pre: ["mining"],        pos:[2,1], boost:"用远程单位消灭一个单位" },
    celestial:      { name: "天文导航",   cost: 80,  era: "Ancient", pre: ["sailing"],       pos:[2,0], boost:"改良2处海洋资源" },
    ironWorking:    { name: "铁器术",     cost: 120, era: "Classical", pre: ["bronzeWorking"],pos:[3,2], boost:"建造一座铁矿" },
    construction:   { name: "建筑学",     cost: 200, era: "Classical", pre: ["masonry","wheel"], pos:[3,1], boost:"建造一座水磨坊" },
    currency:       { name: "货币",       cost: 120, era: "Classical", pre: ["writing"],     pos:[3,3], boost:"拥有2种奢侈资源" },
    recordedHistory:{ name: "文字记录",   cost:120, era: "Classical", pre: ["writing"],      pos:[3,4], boost:"建造2个学院区域" },
    engineering:    { name: "工程学",     cost: 200, era: "Classical", pre: ["wheel"],       pos:[4,1], boost:"建造古代城墙" },
    militaryEngineering:{name:"军事工程", cost: 200, era: "Classical", pre: ["construction"],pos:[4,0], boost:"建造城墙" },
    apprenticeship: { name: "学徒制",     cost: 200, era: "Medieval", pre: ["currency"],     pos:[4,3], boost:"建造3座矿场" },
    education:      { name: "教育",       cost: 200, era: "Medieval", pre: ["recordedHistory"],pos:[4,4], boost:"建造一座大学" },
    banking:        { name: "银行业",     cost: 275, era: "Medieval", pre: ["currency","apprenticeship"], pos:[5,3], boost:"建造2座银行" }
  };

  // ---------- 市政树 ----------
  const CIVIC = {
    codeOfLaws:      { name: "法典",         cost: 20,  era: "Ancient", pre: [],           pos:[0,1], boost:"", govBonus:true },
    craftsmanship:   { name: "手工业",       cost: 40,  era: "Ancient", pre: ["codeOfLaws"],pos:[1,1], boost:"改良3块地块" },
    foreignTrade:    { name: "对外贸易",     cost: 40,  era: "Ancient", pre: ["codeOfLaws"],pos:[1,2], boost:"发现第二块大陆" },
    earlyEmpire:     { name: "早期帝国",     cost: 70,  era: "Ancient", pre: ["foreignTrade"],pos:[2,2], boost:"使一座城市人口达到6" },
    mysticism:       { name: "神秘主义",     cost: 50,  era: "Ancient", pre: ["foreignTrade"],pos:[2,3], boost:"建造一座圣地" },
    militaryTradition:{ name: "军事传统",    cost:50, era: "Ancient", pre: ["craftsmanship"],pos:[2,0], boost:"清除一个蛮族前哨" },
    stateWorkforce:  { name: "国家劳动力",   cost: 70,  era: "Ancient", pre: ["craftsmanship"],pos:[3,1], boost:"建造任意区域" },
    politicalPhilosophy:{name:"政治哲学",cost:110,era:"Classical",pre:["stateWorkforce","earlyEmpire"],pos:[4,1], boost:"拥有2座政府建筑", govBonus:true },
    dramaPoetry:     { name: "戏剧与诗歌",   cost: 110, era: "Classical", pre: ["earlyEmpire"],pos:[3,3], boost:"建造一座奇观" },
    militaryTraining:{ name: "军事训练",     cost: 120, era: "Classical", pre: ["militaryTradition"],pos:[3,0], boost:"建造一座军营" },
    gamesRecreation: { name: "竞技与娱乐",   cost:110, era: "Classical", pre: ["stateWorkforce"],pos:[4,2], boost:"建造一座娱乐中心" },
    theology:        { name: "神学",         cost: 120, era: "Classical", pre: ["mysticism","dramaPoetry"],pos:[4,3], boost:"建造2座神庙" },
    defensiveTactics:{ name: "防御战术",     cost: 175, era: "Medieval", pre: ["gamesRecreation","politicalPhilosophy"],pos:[5,2], boost:"" },
    feudalism:       { name: "封建制度",     cost: 275, era: "Medieval", pre: ["defensiveTactics"],pos:[6,2], boost:"拥有6个建造者" }
  };

  // ---------- 政体 ----------
  const GOVERNMENT = {
    chiefdom:  { name: "酋邦",     civic: null,             mil:1, eco:1, dip:0, wild:0, bonus:"" },
    autocracy: { name: "独裁制",   civic: "politicalPhilosophy", mil:2, eco:1, dip:0, wild:1, bonus:"首都所有产出+1；奇观生产+10%" },
    oligarchy: { name: "寡头制",   civic: "politicalPhilosophy", mil:1, eco:0, dip:0, wild:2, bonus:"近战/反骑兵单位战斗力+4；单位更快获得经验" },
    classical: { name: "古典共和制", civic: "politicalPhilosophy", mil:0, eco:2, dip:1, wild:1, bonus:"每座城市+1宜人度；伟人点数+15%" }
  };

  // ---------- 文明 / 领袖 ----------
  const CIVS = [
    { id:"rome",    civ:"罗马",       leader:"图拉真",       color:"#c0392b", accent:"#8e2018",
      ability:"图拉真柱：新城市建立时免费获得一座市中心建筑。所有城市领土范围+25%。",
      unit:"军团", start:["warrior","settler","builder","scout"] },
    { id:"egypt",   civ:"埃及",       leader:"克利奥帕特拉", color:"#e0b13c", accent:"#a8801c",
      ability:"尼罗河：河流沿岸建造奇观时生产力+15%。可在泛滥平原上建造区域。",
      unit:"马里亚努战车", start:["warrior","settler","builder","scout"] },
    { id:"greece",  civ:"希腊",       leader:"伯里克利",     color:"#3498db", accent:"#2471a3",
      ability:"荣耀环绕：每有一个你担任宗主的城邦，文化+5%。",
      unit:"重装步兵", start:["warrior","settler","builder","scout"] },
    { id:"china",   civ:"中国",       leader:"秦始皇",       color:"#27ae60", accent:"#1e8449",
      ability:"王朝更替：尤里卡与鼓舞提供50%（而非40%）的研究加成。",
      unit:"蹲踞之虎", start:["warrior","settler","builder","builder"] },
    { id:"aztec",   civ:"阿兹特克",   leader:"蒙特祖玛",     color:"#16a085", accent:"#0e6b58",
      ability:"五日传说：可用建造者完成区域建造。",
      unit:"雄鹰勇士", start:["warrior","settler","builder","scout"] },
    { id:"germany", civ:"德国",       leader:"巴巴罗萨",     color:"#7f8c8d", accent:"#566566",
      ability:"自由帝国城市：每座城市可额外建造一个区域。",
      unit:"潜艇", start:["warrior","settler","builder","warrior"] }
  ];

  global.DATA = {
    Y, TERRAIN, ELEV, FEATURE, RES, IMPROVEMENT, UNIT, DISTRICT, BUILDING,
    WONDER, TECH, CIVIC, GOVERNMENT, CIVS,
    ERAS: ["Ancient", "Classical", "Medieval", "Renaissance"],
    ERA_NAMES: { Ancient: "远古", Classical: "古典", Medieval: "中世纪", Renaissance: "文艺复兴" },
    YIELD_ICONS: { food:"🍞", prod:"⚙", gold:"¤", sci:"⚗", cul:"♫", faith:"✝" },
    YIELD_NAMES: { food:"食物", prod:"生产力", gold:"金币", sci:"科技", cul:"文化", faith:"信仰" }
  };
})(window);
