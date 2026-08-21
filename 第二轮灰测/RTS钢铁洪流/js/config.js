/* ===================================================================
   config.js — 全部游戏数值：阵营 / 护甲 / 武器 / 建筑 / 单位 / 科技树
   改数值只需改这里，逻辑代码不含硬编码平衡数字。

   长度单位说明：
     range / sight / minRange 在表里用 **格** 表示，读取时用 R.px() 转像素。
     size 是建筑占地格数 {w,h}；单位用 rad（像素半径）做碰撞。
   =================================================================== */
(function () {
  'use strict';
  const R = window.R;
  const T = R.TILE;

  /** 格 → 像素 */
  R.px = function (tiles) { return tiles * T; };

  /* ========================= 阵营 ========================= */
  R.FACTIONS = {
    guard: {
      name: '共和国卫队', short: '卫队',
      color: '#3f8ce0', color2: '#9fd0ff', dark: '#17324f',
      desc: '装甲精良、火力均衡，拥有狙击手与高精度火炮。',
      unique: ['sniper', 'grizzly'],
      tint: '#3f8ce0',
    },
    steel: {
      name: '赤色铁流', short: '铁流',
      color: '#e04b3a', color2: '#ffb3a0', dark: '#4d1a14',
      desc: '皮厚量大、近战凶悍，喷火兵与犀牛坦克成群推进。',
      unique: ['flamer', 'rhino'],
      tint: '#e04b3a',
    },
  };
  /** 中立/第三方颜色 */
  R.NEUTRAL_COLOR = '#9aa4ae';

  /* ========================= 护甲类型 =========================
     武器对不同护甲的倍率写在武器的 vs 表里；缺项按 1.0 处理。
     ========================================================== */
  R.ARMOR = {
    infantry: '步兵',
    light: '轻甲',
    heavy: '重甲',
    building: '建筑',
    air: '空中',
  };

  /* ========================= 投射物 ========================= */
  /* kind:
       bullet  直线高速弹（近乎瞬时，画曳光）
       shell   炮弹，直线中速，命中爆炸
       rocket  火箭，带初始散布 + 追踪
       arc     抛物线榴弹（火炮），落点固定，可越过单位
       flame   喷射火焰（短程锥形，多段判定）
       beam    瞬时光束（狙击 / 离子炮）
  */
  R.PROJ = {
    bullet: { speed: 1500, trail: 'tracer', life: 0.8 },
    shell: { speed: 620, trail: 'none', life: 3, boom: 'small' },
    rocket: { speed: 380, accel: 620, maxSpeed: 700, trail: 'smoke', life: 5, boom: 'medium', homing: 3.2 },
    arc: { speed: 300, trail: 'none', life: 6, boom: 'large', arc: true },
    flame: { speed: 260, trail: 'fire', life: 0.42, boom: 'fire' },
    beam: { speed: 0, trail: 'beam', life: 0.12 },
  };

  /* ========================= 武器 =========================
     ── 关于"对建筑倍率"的设计意图 ──────────────────────────────
     坦克炮对建筑只有 0.5 左右，火炮/喷火/火箭才是攻城主力。
     这样做的原因：早期把坦克炮设成 0.7 后实测 6 局里 5 局在 3~4 分钟
     就被一波流拆完基地，完全没有 RTS 的攻防节奏。压低通用直射武器的
     拆建筑效率，才能逼出"先清防御、再上攻城单位"的正常打法。
     ========================================================== */
  R.WEAPONS = {
    /* --- 轻武器 --- */
    mg: {
      name: '机枪', dmg: 11, cd: 0.25, range: 4.4, proj: 'bullet', burst: 2, burstGap: 0.07,
      vs: { infantry: 1.0, light: 0.20, heavy: 0.04, building: 0.06, air: 0 }, air: false,
      sfx: 'mg',
    },
    pillboxMg: {
      name: '重机枪', dmg: 16, cd: 0.22, range: 5.4, proj: 'bullet', burst: 3, burstGap: 0.06,
      vs: { infantry: 1.1, light: 0.22, heavy: 0.05, building: 0.06, air: 0 }, air: false,
      sfx: 'mg',
    },
    sniperRifle: {
      name: '狙击枪', dmg: 70, cd: 1.7, range: 7.6, proj: 'beam',
      vs: { infantry: 1.6, light: 0.12, heavy: 0.04, building: 0.04, air: 0 }, air: false,
      sfx: 'sniper',
    },
    flamethrower: {
      name: '喷火器', dmg: 17, cd: 0.34, range: 2.9, proj: 'flame', splash: 22,
      vs: { infantry: 1.45, light: 0.6, heavy: 0.28, building: 1.0, air: 0 }, air: false,
      sfx: 'flame',
    },
    rocketAT: {
      name: '反装甲火箭', dmg: 44, cd: 1.55, range: 6.4, proj: 'rocket', splash: 26,
      vs: { infantry: 0.45, light: 1.25, heavy: 1.0, building: 0.9, air: 1.1 }, air: true,
      sfx: 'rocket',
    },

    /* --- 车载 --- */
    lightCannon: {
      name: '轻型炮', dmg: 21, cd: 0.75, range: 5.0, proj: 'shell', splash: 12,
      vs: { infantry: 0.6, light: 1.0, heavy: 0.6, building: 0.3, air: 0 }, air: false,
      sfx: 'cannonLight',
    },
    tankCannon: {
      name: '105mm 坦克炮', dmg: 42, cd: 1.25, range: 5.6, proj: 'shell', splash: 18,
      vs: { infantry: 0.5, light: 1.0, heavy: 0.9, building: 0.42, air: 0 }, air: false,
      sfx: 'cannon',
    },
    heavyCannon: {
      name: '双联重炮', dmg: 55, cd: 1.7, range: 6.0, proj: 'shell', splash: 24, burst: 2, burstGap: 0.16,
      vs: { infantry: 0.55, light: 1.0, heavy: 1.05, building: 0.6, air: 0 }, air: false,
      sfx: 'cannonHeavy',
    },
    artilleryGun: {
      name: '203mm 榴弹炮', dmg: 72, cd: 3.3, range: 11.0, minRange: 3.2, proj: 'arc', splash: 52,
      vs: { infantry: 1.25, light: 0.9, heavy: 0.55, building: 1.5, air: 0 }, air: false,
      needStop: true, sfx: 'artillery',
    },
    flak: {
      name: '双联高炮', dmg: 19, cd: 0.42, range: 6.2, proj: 'bullet', burst: 2, burstGap: 0.08, splash: 10,
      vs: { infantry: 0.45, light: 0.3, heavy: 0.08, building: 0.1, air: 1.5 }, air: true,
      sfx: 'flak',
    },
    gunshipRocket: {
      name: '空射火箭', dmg: 34, cd: 0.95, range: 5.2, proj: 'rocket', splash: 24,
      vs: { infantry: 0.7, light: 1.15, heavy: 0.95, building: 1, air: 0.6 }, air: false,
      sfx: 'rocket',
    },

    /* --- 防御建筑 --- */
    turretGun: {
      name: '要塞炮', dmg: 50, cd: 1.15, range: 6.2, proj: 'shell', splash: 20,
      vs: { infantry: 0.55, light: 1.1, heavy: 1.0, building: 0.28, air: 0 }, air: false,
      sfx: 'cannon',
    },
    aaGun: {
      name: '防空炮', dmg: 26, cd: 0.36, range: 7.4, proj: 'bullet', burst: 2, burstGap: 0.07, splash: 12,
      vs: { infantry: 0.3, light: 0.15, heavy: 0.05, building: 0.05, air: 1.8 }, air: true, airOnly: true,
      sfx: 'flak',
    },
    ionBeam: {
      name: '离子炮', dmg: 900, cd: 0, range: 999, proj: 'beam', splash: 96,
      vs: { infantry: 1.0, light: 1.0, heavy: 1.0, building: 1.4, air: 0 }, air: false,
      sfx: 'ion',
    },
  };

  /* ========================= 建筑 =========================
     size    占地格数
     power   正=发电，负=耗电
     build   建造耗时（秒，满电情况）
     req     前置建筑 id 数组（需全部拥有）
     tab     侧边栏分类
     ========================================================== */
  R.BUILDINGS = {
    conyard: {
      id: 'conyard', name: '建造厂', desc: '基地核心。提供建造区域，可展开/重新打包为基地车。',
      size: { w: 3, h: 3 }, hp: 3000, armor: 'building', cost: 2500, build: 20,
      power: 0, sight: 7, req: [], tab: 'base', art: 'conyard', key: 'Q',
      isBase: true, undeploy: 'mcv',
    },
    power: {
      id: 'power', name: '发电厂', desc: '提供 100 电力。电力不足会拖慢一切生产与防御射速。',
      size: { w: 2, h: 2 }, hp: 1200, armor: 'building', cost: 400, build: 7,
      power: 100, sight: 5, req: [], tab: 'base', art: 'power', key: 'W',
      explodePower: true,
    },
    refinery: {
      id: 'refinery', name: '矿石精炼厂', desc: '采矿车卸矿点，落成时附赠一辆采矿车。',
      size: { w: 3, h: 2 }, hp: 1800, armor: 'building', cost: 1500, build: 14,
      power: -30, sight: 6, req: ['power'], tab: 'base', art: 'refinery', key: 'E',
      freeUnit: 'harvester', dock: { x: 1.5, y: 2.1 },
    },
    barracks: {
      id: 'barracks', name: '兵营', desc: '训练步兵。',
      size: { w: 2, h: 2 }, hp: 1200, armor: 'building', cost: 400, build: 8,
      power: -20, sight: 5, req: ['power'], tab: 'base', art: 'barracks', key: 'R',
      produces: 'infantry', exit: { x: 1.0, y: 2.3 },
    },
    factory: {
      id: 'factory', name: '战车工厂', desc: '生产载具与采矿车。',
      size: { w: 3, h: 3 }, hp: 2000, armor: 'building', cost: 1700, build: 16,
      power: -50, sight: 5, req: ['refinery'], tab: 'base', art: 'factory', key: 'T',
      produces: 'vehicle', exit: { x: 1.5, y: 3.4 },
    },
    radar: {
      id: 'radar', name: '雷达站', desc: '启用小地图全貌，并解锁二级科技。断电则雷达失效。',
      size: { w: 2, h: 2 }, hp: 1300, armor: 'building', cost: 900, build: 11,
      power: -40, sight: 11, req: ['refinery'], tab: 'base', art: 'radar', key: 'A',
      givesRadar: true,
    },
    repair: {
      id: 'repair', name: '维修厂', desc: '停在平台上的载具会被持续修复。',
      size: { w: 3, h: 3 }, hp: 1400, armor: 'building', cost: 800, build: 10,
      power: -30, sight: 5, req: ['factory'], tab: 'base', art: 'repair', key: 'S',
      repairPad: true,
    },
    helipad: {
      id: 'helipad', name: '直升机坪', desc: '生产并补给武装直升机。',
      size: { w: 2, h: 2 }, hp: 1200, armor: 'building', cost: 900, build: 10,
      power: -20, sight: 5, req: ['radar'], tab: 'base', art: 'helipad', key: 'D',
      produces: 'air', exit: { x: 1.0, y: 1.0 },
    },
    tech: {
      id: 'tech', name: '科技中心', desc: '解锁三级科技：重型坦克、离子炮。',
      size: { w: 3, h: 3 }, hp: 1800, armor: 'building', cost: 2000, build: 20,
      power: -100, sight: 7, req: ['radar', 'factory'], tab: 'base', art: 'tech', key: 'F',
    },

    /* --- 防御 --- */
    wall: {
      id: 'wall', name: '混凝土墙', desc: '廉价路障，挡住地面部队与直射火力。',
      size: { w: 1, h: 1 }, hp: 700, armor: 'building', cost: 50, build: 0.6,
      power: 0, sight: 2, req: [], tab: 'def', art: 'wall', key: 'Z',
      isWall: true, noBar: true,
    },
    pillbox: {
      id: 'pillbox', name: '机枪碉堡', desc: '对步兵极为有效的廉价前哨。',
      size: { w: 1, h: 1 }, hp: 900, armor: 'building', cost: 400, build: 6,
      power: -10, sight: 6, req: ['barracks'], tab: 'def', art: 'pillbox', key: 'X',
      weapon: 'pillboxMg', turret: true,
    },
    turret: {
      id: 'turret', name: '要塞炮塔', desc: '反装甲固定炮台。',
      size: { w: 1, h: 1 }, hp: 1300, armor: 'building', cost: 700, build: 9,
      power: -20, sight: 7, req: ['factory'], tab: 'def', art: 'turret', key: 'C',
      weapon: 'turretGun', turret: true,
    },
    aa: {
      id: 'aa', name: '防空阵地', desc: '只打空中目标，射程极远。',
      size: { w: 1, h: 1 }, hp: 1000, armor: 'building', cost: 800, build: 9,
      power: -30, sight: 8, req: ['radar'], tab: 'def', art: 'aa', key: 'V',
      weapon: 'aaGun', turret: true,
    },
    ion: {
      id: 'ion', name: '离子炮', desc: '超级武器：充能完毕后可指定地点发动毁灭打击。',
      size: { w: 2, h: 2 }, hp: 1800, armor: 'building', cost: 2500, build: 30,
      power: -150, sight: 6, req: ['tech'], tab: 'def', art: 'ion', key: 'B',
      superWeapon: { charge: 150, weapon: 'ionBeam' }, limit: 1,
    },
  };

  /* ========================= 单位 =========================
     kind    infantry | vehicle | air
     speed   像素/秒
     rad     碰撞半径（像素）
     turn    转向速率（弧度/秒）；建筑炮塔用 turretTurn
     ========================================================== */
  R.UNITS = {
    /* --- 步兵 --- */
    rifleman: {
      id: 'rifleman', name: '步枪兵', desc: '便宜好用的基础步兵，克制其它步兵。',
      kind: 'infantry', hp: 110, armor: 'infantry', cost: 100, build: 3.5,
      speed: 52, rad: 5, sight: 6, turn: 12, weapon: 'mg',
      from: 'barracks', req: [], tab: 'inf', art: 'rifleman', key: '1', crush: true,
    },
    rocketeer: {
      id: 'rocketeer', name: '火箭兵', desc: '反装甲与防空兼备，怕机枪。',
      kind: 'infantry', hp: 95, armor: 'infantry', cost: 300, build: 6,
      speed: 46, rad: 5, sight: 7, turn: 10, weapon: 'rocketAT',
      from: 'barracks', req: [], tab: 'inf', art: 'rocketeer', key: '2', crush: true,
    },
    engineer: {
      id: 'engineer', name: '工程师', desc: '无武装。进入敌方建筑可直接占领；修复己方建筑。',
      kind: 'infantry', hp: 70, armor: 'infantry', cost: 500, build: 6,
      speed: 58, rad: 5, sight: 5, turn: 12, weapon: null,
      from: 'barracks', req: [], tab: 'inf', art: 'engineer', key: '3', crush: true,
      engineer: true,
    },
    sniper: {
      id: 'sniper', name: '狙击手', desc: '卫队专属。超远射程一击必杀步兵，对载具几乎无用。',
      kind: 'infantry', hp: 90, armor: 'infantry', cost: 600, build: 8,
      speed: 44, rad: 5, sight: 9, turn: 10, weapon: 'sniperRifle',
      from: 'barracks', req: ['radar'], tab: 'inf', art: 'sniper', key: '4', crush: true,
      faction: 'guard',
    },
    flamer: {
      id: 'flamer', name: '喷火兵', desc: '铁流专属。近身烧步兵与建筑，射程极短。',
      kind: 'infantry', hp: 130, armor: 'infantry', cost: 350, build: 5,
      speed: 50, rad: 5, sight: 5, turn: 12, weapon: 'flamethrower',
      from: 'barracks', req: ['radar'], tab: 'inf', art: 'flamer', key: '4', crush: true,
      faction: 'steel',
    },

    /* --- 载具 --- */
    harvester: {
      id: 'harvester', name: '采矿车', desc: '自动往返矿脉与精炼厂。装满 700 信用点。',
      kind: 'vehicle', hp: 650, armor: 'heavy', cost: 1000, build: 11,
      speed: 44, rad: 11, sight: 5, turn: 2.6, weapon: null,
      from: 'factory', req: [], tab: 'veh', art: 'harvester', key: '1',
      harvester: { capacity: 700, rate: 210, unload: 3.2 },
    },
    scout: {
      id: 'scout', name: '侦察车', desc: '极快、视野大，适合探路与骚扰采矿车。',
      kind: 'vehicle', hp: 260, armor: 'light', cost: 500, build: 5,
      speed: 116, rad: 9, sight: 10, turn: 4.2, weapon: 'mg',
      from: 'factory', req: [], tab: 'veh', art: 'scout', key: '2',
    },
    lightTank: {
      id: 'lightTank', name: '轻型坦克', desc: '造价低、机动好，成群使用性价比高。',
      kind: 'vehicle', hp: 400, armor: 'light', cost: 600, build: 6,
      speed: 76, rad: 10, sight: 6, turn: 3.0, turretTurn: 3.6, weapon: 'lightCannon',
      from: 'factory', req: [], tab: 'veh', art: 'lightTank', key: '3', crush: true,
    },
    grizzly: {
      id: 'grizzly', name: '灰熊坦克', desc: '卫队主战坦克，均衡且转向灵活。',
      kind: 'vehicle', hp: 720, armor: 'heavy', cost: 900, build: 8,
      speed: 62, rad: 12, sight: 6, turn: 2.6, turretTurn: 3.0, weapon: 'tankCannon',
      from: 'factory', req: ['refinery'], tab: 'veh', art: 'grizzly', key: '4', crush: true,
      faction: 'guard',
    },
    rhino: {
      id: 'rhino', name: '犀牛坦克', desc: '铁流主战坦克，装甲更厚但转向迟钝。',
      kind: 'vehicle', hp: 840, armor: 'heavy', cost: 950, build: 8.5,
      speed: 56, rad: 12, sight: 6, turn: 2.0, turretTurn: 2.4, weapon: 'tankCannon',
      from: 'factory', req: ['refinery'], tab: 'veh', art: 'rhino', key: '4', crush: true,
      faction: 'steel',
    },
    flakTrack: {
      id: 'flakTrack', name: '防空车', desc: '主要对空，也能扫步兵。',
      kind: 'vehicle', hp: 340, armor: 'light', cost: 700, build: 6.5,
      speed: 82, rad: 10, sight: 8, turn: 3.4, turretTurn: 4.5, weapon: 'flak',
      from: 'factory', req: ['radar'], tab: 'veh', art: 'flakTrack', key: '5', crush: true,
    },
    artillery: {
      id: 'artillery', name: '自行火炮', desc: '射程 11 格，可越过部队轰击；近身无法开火，纸装甲。',
      kind: 'vehicle', hp: 240, armor: 'light', cost: 850, build: 8,
      speed: 50, rad: 11, sight: 6, turn: 2.2, turretTurn: 1.8, weapon: 'artilleryGun',
      from: 'factory', req: ['radar'], tab: 'veh', art: 'artillery', key: '6',
    },
    apoc: {
      id: 'apoc', name: '重装坦克', desc: '三级科技。双联重炮 + 厚甲，缓慢但正面无敌。',
      kind: 'vehicle', hp: 1250, armor: 'heavy', cost: 1750, build: 15,
      speed: 42, rad: 14, sight: 7, turn: 1.6, turretTurn: 2.0, weapon: 'heavyCannon',
      from: 'factory', req: ['tech'], tab: 'veh', art: 'apoc', key: '7', crush: true,
      crushHeavy: true,
    },
    mcv: {
      id: 'mcv', name: '基地车', desc: '开到空地按 D 展开成新的建造厂，用于扩张分基地。',
      kind: 'vehicle', hp: 900, armor: 'heavy', cost: 2500, build: 20,
      speed: 46, rad: 14, sight: 6, turn: 1.8, weapon: null,
      from: 'factory', req: ['radar'], tab: 'veh', art: 'mcv', key: '8',
      deploysTo: 'conyard',
    },

    /* --- 空中 --- */
    gunship: {
      id: 'gunship', name: '武装直升机', desc: '无视地形，火箭对地强力；需回机坪补弹。',
      kind: 'air', hp: 400, armor: 'air', cost: 1200, build: 11,
      speed: 132, rad: 12, sight: 9, turn: 3.2, weapon: 'gunshipRocket',
      from: 'helipad', req: [], tab: 'air', art: 'gunship', key: '1',
      ammo: 14, rearm: 9, alt: 30,
    },
  };

  /* ========================= 侧边栏分类 ========================= */
  R.TABS = [
    { id: 'base', name: '建筑', from: null },
    { id: 'def', name: '防御', from: null },
    { id: 'inf', name: '步兵', from: 'barracks' },
    { id: 'veh', name: '载具', from: 'factory' },
    { id: 'air', name: '空军', from: 'helipad' },
  ];

  /* ========================= 全局规则 ========================= */
  R.RULES = {
    startCredits: 5000,
    /** 建造范围：距离己方建筑边缘多少格内可以放置 */
    buildRadius: 6,
    /** 电力不足时的最低效率 */
    minPowerEff: 0.28,
    /** 矿脉再生：每秒每个"矿心"格恢复的储量 */
    oreRegen: 0.55,
    /** 单格矿量上限。数值越大，矿车换格越少、往返越有效率 */
    oreMax: 150,
    /** 建筑落成瞬间的血量比例（之后自愈到满） */
    // 建筑直接满血落成，保持节奏明快
    /** 单位卖出返还比例 */
    sellRefund: 0.5,
    /** 维修厂每秒修复量与花费 */
    repairRate: 55, repairCostPerHp: 0.28,
    /** 工程师修复建筑量 */
    engineerHeal: 400,
    /** 被履带碾压的伤害 */
    crushDamage: 9999,
    /** 视野：迷雾格边长（= 1 格） */
    fogEnabled: true,
    /** 部队上限（每方） */
    unitCap: 200,
    /** 撤退/警戒判定 */
    guardRange: 4.5,
    /** 攻击移动时脱离路线追击的最大距离（格） */
    chaseRange: 7,
  };

  /* ========================= 查表工具 ========================= */
  /** 依 id 取定义（先建筑后单位） */
  R.def = function (id) { return R.BUILDINGS[id] || R.UNITS[id] || null; };
  R.isBuilding = function (id) { return !!R.BUILDINGS[id]; };

  /** 武器对某护甲的最终倍率 */
  R.armorMul = function (weapon, armor) {
    if (!weapon) return 0;
    const v = weapon.vs;
    if (!v) return 1;
    const m = v[armor];
    return m === undefined ? 1 : m;
  };

  /** 武器能否打这个目标（空中/地面 + 只打空中） */
  R.canTarget = function (weapon, target) {
    if (!weapon || !target) return false;
    const isAir = target.kind === 'air';
    if (isAir && !weapon.air) return false;
    if (!isAir && weapon.airOnly) return false;
    return R.armorMul(weapon, target.armor) > 0.02;
  };

  /** 某阵营可用的全部可造项（含派系专属过滤） */
  R.buildableFor = function (faction) {
    const out = [];
    for (const k in R.BUILDINGS) {
      const d = R.BUILDINGS[k];
      if (d.faction && d.faction !== faction) continue;
      out.push(d);
    }
    for (const k in R.UNITS) {
      const d = R.UNITS[k];
      if (d.faction && d.faction !== faction) continue;
      out.push(d);
    }
    return out;
  };

  /** 建筑占地中心偏移（像素）：把格坐标左上角换成中心 */
  R.buildingCenter = function (def, cx, cy) {
    return { x: (cx + def.size.w / 2) * T, y: (cy + def.size.h / 2) * T };
  };

  /* 反查：某产线建筑能造哪些单位 */
  R.unitsFrom = function (buildingId, faction) {
    const out = [];
    for (const k in R.UNITS) {
      const d = R.UNITS[k];
      if (d.from !== buildingId) continue;
      if (d.faction && d.faction !== faction) continue;
      out.push(d);
    }
    return out;
  };

})();
