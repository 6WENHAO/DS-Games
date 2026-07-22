// ============================================================
// data.js - 游戏静态数据定义 (Stellaris Web)
// ============================================================

const RESOURCES = {
  energy:      { icon: "⚡", name: "能量币",   color: "#ffd24a", stored: true },
  minerals:    { icon: "⛏️", name: "矿物",     color: "#ff9b4a", stored: true },
  food:        { icon: "🌾", name: "食物",     color: "#5bff8a", stored: true },
  alloys:      { icon: "🔩", name: "合金",     color: "#b0b8c8", stored: true },
  consumer:    { icon: "📦", name: "消费品",   color: "#4ad6ff", stored: true },
  influence:   { icon: "✴️", name: "影响力",   color: "#c86bff", stored: true, cap: 1000 },
  unity:       { icon: "☯️", name: "凝聚力",   color: "#ff6bd6", stored: true },
  physics:     { icon: "🔵", name: "物理学",   color: "#4a9eff", stored: false, research: true },
  society:     { icon: "🟢", name: "社会学",   color: "#5bff8a", stored: false, research: true },
  engineering: { icon: "🟠", name: "工程学",   color: "#ff9b4a", stored: false, research: true },
};

const RESOURCE_ORDER = ["energy","minerals","food","alloys","consumer","influence","unity","physics","society","engineering"];
const DEFAULT_STORAGE = 5000;

// ---------------- 理念 Ethics ----------------
const ETHICS = {
  authoritarian: { name: "威权主义", opp: "egalitarian", desc: "+10% 工人产出，+1 影响力" },
  egalitarian:   { name: "平等主义", opp: "authoritarian", desc: "+10% 专家产出" },
  xenophobe:     { name: "排外主义", opp: "xenophile", desc: "+15% 人口增长" },
  xenophile:     { name: "亲外主义", opp: "xenophobe", desc: "+15% 贸易，+外交" },
  militarist:    { name: "军国主义", opp: "pacifist", desc: "+15% 舰船射速" },
  pacifist:      { name: "和平主义", opp: "militarist", desc: "+10 稳定度，+人口" },
  spiritualist:  { name: "唯心主义", opp: "materialist", desc: "+15% 凝聚力" },
  materialist:   { name: "唯物主义", opp: "spiritualist", desc: "+10% 研究速度" },
};

const AUTHORITIES = {
  democratic:  { name: "民主制", desc: "领袖选举，+10% 派系支持" },
  oligarchic:  { name: "寡头制", desc: "+2 议员技能" },
  dictatorial: { name: "独裁制", desc: "+25% 领袖经验" },
  imperial:    { name: "帝制",   desc: "首都系统 +10% 产出" },
};

// ---------------- 行星类别 Planet Classes ----------------
const PLANET_CLASSES = {
  continental: { name: "大陆世界", type: "habitable", color: "#4a9e5a", icon: "🌍" },
  ocean:       { name: "海洋世界", type: "habitable", color: "#3a7ab5", icon: "🌊" },
  tropical:    { name: "热带世界", type: "habitable", color: "#5aae4a", icon: "🌴" },
  arid:        { name: "干旱世界", type: "habitable", color: "#c8a04a", icon: "🏜️" },
  desert:      { name: "沙漠世界", type: "habitable", color: "#d8b45a", icon: "🏜️" },
  tundra:      { name: "苔原世界", type: "habitable", color: "#7a9ab5", icon: "🏔️" },
  arctic:      { name: "极地世界", type: "habitable", color: "#c8dae8", icon: "❄️" },
  savanna:     { name: "热带草原", type: "habitable", color: "#b5a04a", icon: "🌾" },
  gaia:        { name: "盖亚世界", type: "habitable", color: "#5affaa", icon: "✨" },
  barren:      { name: "贫瘠行星", type: "barren", color: "#8a7a6a", icon: "🪨" },
  toxic:       { name: "剧毒世界", type: "barren", color: "#8aae3a", icon: "☢️" },
  frozen:      { name: "冰冻世界", type: "barren", color: "#aaccdd", icon: "🧊" },
  molten:      { name: "熔岩世界", type: "barren", color: "#d8542a", icon: "🌋" },
  gas_giant:   { name: "气态巨行星", type: "barren", color: "#d8a86a", icon: "🪐" },
  asteroid:    { name: "小行星",   type: "asteroid", color: "#9a8a7a", icon: "☄️" },
};

const HABITABLE_CLASSES = ["continental","ocean","tropical","arid","desert","tundra","arctic","savanna"];

// ---------------- 区划 Districts ----------------
const DISTRICTS = {
  city:      { name: "城市区划", icon: "🏙️", jobs: { clerk: 2 }, housing: 5, upkeep: { energy: 2 }, cost: { minerals: 100 } },
  generator: { name: "发电区划", icon: "⚡", jobs: { technician: 2 }, housing: 2, upkeep: { energy: 1 }, cost: { minerals: 100 } },
  mining:    { name: "采矿区划", icon: "⛏️", jobs: { miner: 2 }, housing: 2, upkeep: { energy: 1 }, cost: { minerals: 100 } },
  agriculture:{ name: "农业区划", icon: "🌾", jobs: { farmer: 2 }, housing: 2, upkeep: { energy: 1 }, cost: { minerals: 100 } },
};

// ---------------- 建筑 Buildings ----------------
const BUILDINGS = {
  capital:      { name: "行星首府", icon: "🏛️", jobs: { administrator: 2 }, upkeep: { energy: 2 }, cost: {}, unique: true, amenities: 10 },
  energy_nexus: { name: "能源枢纽", icon: "🔌", bonus: "generator", desc: "每个发电区划 +1 能量", upkeep: { energy: 2 }, cost: { minerals: 400 }, unique: true },
  mineral_hub:  { name: "矿物提纯中心", icon: "🏭", bonus: "mining", desc: "每个采矿区划 +1 矿物", upkeep: { energy: 2 }, cost: { minerals: 400 }, unique: true },
  food_center:  { name: "食品加工中心", icon: "🍱", bonus: "agriculture", desc: "每个农业区划 +1 食物", upkeep: { energy: 2 }, cost: { minerals: 400 }, unique: true },
  research_lab: { name: "研究实验室", icon: "🔬", jobs: { researcher: 2 }, upkeep: { energy: 2 }, cost: { minerals: 400 } },
  foundry:      { name: "合金铸造厂", icon: "🔩", jobs: { metallurgist: 2 }, upkeep: { energy: 2 }, cost: { minerals: 400 } },
  industries:   { name: "民用工业", icon: "🏢", jobs: { artisan: 2 }, upkeep: { energy: 2 }, cost: { minerals: 400 } },
  admin:        { name: "行政办公厅", icon: "📋", jobs: { bureaucrat: 2 }, upkeep: { energy: 2 }, cost: { minerals: 400 } },
  entertainment:{ name: "全息剧院", icon: "🎭", jobs: { entertainer: 2 }, upkeep: { energy: 2 }, cost: { minerals: 400 } },
};

// ---------------- 工作 Jobs ----------------
const JOBS = {
  administrator:{ name: "行政官", stratum: "ruler",      produces: { unity: 3 }, consumes: { consumer: 2 }, amenities: 4 },
  technician:   { name: "技术员", stratum: "worker",     produces: { energy: 6 } },
  miner:        { name: "矿工",   stratum: "worker",     produces: { minerals: 4 } },
  farmer:       { name: "农民",   stratum: "worker",     produces: { food: 6 } },
  clerk:        { name: "职员",   stratum: "worker",     produces: { energy: 2 }, amenities: 2 },
  metallurgist: { name: "冶金师", stratum: "specialist", produces: { alloys: 3 }, consumes: { minerals: 6 } },
  artisan:      { name: "工匠",   stratum: "specialist", produces: { consumer: 6 }, consumes: { minerals: 6 } },
  researcher:   { name: "研究员", stratum: "specialist", produces: { physics: 2, society: 2, engineering: 2 }, consumes: { consumer: 2 } },
  bureaucrat:   { name: "官僚",   stratum: "specialist", produces: { unity: 4 }, consumes: { consumer: 2 } },
  entertainer:  { name: "艺人",   stratum: "specialist", produces: { unity: 1 }, consumes: { consumer: 1 }, amenities: 10 },
};

// pop 消耗: 每个 pop 每月 0.25 消费品(specialist及以上) + 食物由整体处理
const POP_FOOD_UPKEEP = 1; // 每 pop 每月食物

// ---------------- 舰船 Ships ----------------
const SHIP_CLASSES = {
  corvette:   { name: "护卫舰", hull: 200,  armor: 0,  cost: { alloys: 30 },  buildTime: 60,  evasion: 60, speed: 160, navalCap: 1, slots: { S: 3 }, baseFire: 12 },
  destroyer:  { name: "驱逐舰", hull: 500,  armor: 100,cost: { alloys: 60 },  buildTime: 90,  evasion: 35, speed: 140, navalCap: 2, slots: { S: 2, M: 1 }, baseFire: 28 },
  cruiser:    { name: "巡洋舰", hull: 1200, armor: 300,cost: { alloys: 120 }, buildTime: 120, evasion: 15, speed: 120, navalCap: 4, slots: { M: 2, L: 1 }, baseFire: 65 },
  battleship: { name: "战列舰", hull: 2400, armor: 800,cost: { alloys: 240 }, buildTime: 180, evasion: 5,  speed: 100, navalCap: 8, slots: { L: 2, X: 1 }, baseFire: 150 },
  titan:      { name: "泰坦",   hull: 8000, armor: 3000,cost: { alloys: 480 },buildTime: 360, evasion: 5,  speed: 90,  navalCap: 16, slots: { X: 2, T: 1 }, baseFire: 400 },
};

// civilian ships
const CIVILIAN_SHIPS = {
  science:      { name: "科研船",   cost: { alloys: 100 }, buildTime: 60, icon: "🔭" },
  construction: { name: "工程船",   cost: { alloys: 100 }, buildTime: 60, icon: "🔧" },
  colony:       { name: "殖民船",   cost: { alloys: 200, food: 100, consumer: 100 }, buildTime: 300, icon: "🚀" },
};

// ---------------- 武器 (影响战斗 RPS) ----------------
const WEAPONS = {
  laser:   { name: "激光", vs: { shield: 0.5, armor: 1.5, hull: 1.25 } },
  kinetic: { name: "动能", vs: { shield: 1.5, armor: 0.5, hull: 1.25 } },
  missile: { name: "导弹", vs: { shield: 1.5, armor: 1.0, hull: 1.0 } },
};

// ---------------- 星基 Starbases ----------------
const STARBASE_LEVELS = {
  outpost:      { name: "前哨站",   hull: 2000,  cost: { alloys: 100 },  upkeep: { energy: 1 }, modules: 0, shipyards: 0, fire: 0 },
  starport:     { name: "星港",     hull: 4000,  cost: { alloys: 200 },  upkeep: { energy: 2 }, modules: 2, shipyards: 1, fire: 200 },
  starhold:     { name: "恒星堡",   hull: 8000,  cost: { alloys: 500 },  upkeep: { energy: 3 }, modules: 4, shipyards: 1, fire: 500 },
  star_fortress:{ name: "恒星要塞", hull: 16000, cost: { alloys: 1250 }, upkeep: { energy: 4 }, modules: 6, shipyards: 2, fire: 1200 },
  citadel:      { name: "星界城塞", hull: 32000, cost: { alloys: 3500 }, upkeep: { energy: 5 }, modules: 6, shipyards: 2, fire: 2500 },
};
const STARBASE_ORDER = ["outpost","starport","starhold","star_fortress","citadel"];

// ---------------- 太空站 (工程船建造) ----------------
const STATION_TYPES = {
  mining:   { name: "采矿站",   cost: { minerals: 100 }, produces: { minerals: 0 }, forDeposit: "minerals" },
  research: { name: "研究站",   cost: { minerals: 100 }, produces: {}, forDeposit: "research" },
  power:    { name: "能量站",   cost: { minerals: 100 }, produces: { energy: 0 }, forDeposit: "energy" },
};

// ============================================================
// 科技树 Technologies
// ============================================================
const TECH_TREE = {
  physics: [
    { id: "physics_lab_1", tier: 1, name: "凝聚态物理学", cost: 200, weight: 100, effect: { researchBonus: 0.1 }, desc: "+10% 物理研究" },
    { id: "shields_1", tier: 1, name: "护盾", cost: 250, weight: 90, effect: { shipShield: 100 }, desc: "解锁护盾组件" },
    { id: "power_plant_1", tier: 1, name: "改良发电设施", cost: 220, weight: 90, effect: { jobBonus: { technician: 1 } }, desc: "技术员 +1 能量" },
    { id: "sensors_2", tier: 2, name: "亚原子扫描仪", cost: 500, weight: 70, req: ["physics_lab_1"], effect: { sensorRange: 1 }, desc: "+侦测范围" },
    { id: "shields_2", tier: 2, name: "改良护盾", cost: 600, weight: 60, req: ["shields_1"], effect: { shipShield: 200 }, desc: "护盾强度提升" },
    { id: "reactor_2", tier: 2, name: "反物质反应堆", cost: 650, weight: 55, req: ["power_plant_1"], effect: { shipFire: 0.1 }, desc: "+10% 舰船火力" },
    { id: "physics_lab_2", tier: 3, name: "自组织逻辑", cost: 1200, weight: 45, req: ["sensors_2"], effect: { researchBonus: 0.15 }, desc: "+15% 物理研究" },
    { id: "jump_drive", tier: 4, name: "跳跃引擎", cost: 3000, weight: 20, req: ["physics_lab_2"], effect: { jumpDrive: true }, desc: "解锁跳跃航行" },
  ],
  society: [
    { id: "colony_1", tier: 1, name: "殖民船", cost: 200, weight: 100, effect: { unlockColony: true }, desc: "解锁殖民船建造" },
    { id: "genome_1", tier: 1, name: "基因组图谱", cost: 220, weight: 90, effect: { popGrowth: 0.1 }, desc: "+10% 人口增长" },
    { id: "food_1", tier: 1, name: "基因作物", cost: 220, weight: 90, effect: { jobBonus: { farmer: 1 } }, desc: "农民 +1 食物" },
    { id: "admin_1", tier: 2, name: "银河行政", cost: 500, weight: 70, req: ["colony_1"], effect: { adminCap: 20 }, desc: "+行政容量" },
    { id: "unity_1", tier: 2, name: "神经统一", cost: 550, weight: 65, req: ["colony_1"], effect: { jobBonus: { bureaucrat: 1 } }, desc: "官僚 +1 凝聚力" },
    { id: "biology_2", tier: 2, name: "生态适应", cost: 600, weight: 60, req: ["genome_1"], effect: { habitability: 0.1 }, desc: "+10% 宜居度" },
    { id: "society_lab_2", tier: 3, name: "全息哲学", cost: 1200, weight: 45, req: ["admin_1"], effect: { researchBonus: 0.15 }, desc: "+15% 社会研究" },
    { id: "terraform", tier: 4, name: "行星改造", cost: 3000, weight: 20, req: ["biology_2"], effect: { terraform: true }, desc: "解锁行星改造" },
  ],
  engineering: [
    { id: "alloy_1", tier: 1, name: "强化外骨骼", cost: 200, weight: 100, effect: { jobBonus: { metallurgist: 1 } }, desc: "冶金师 +1 合金" },
    { id: "mining_1", tier: 1, name: "深层采矿", cost: 220, weight: 90, effect: { jobBonus: { miner: 1 } }, desc: "矿工 +1 矿物" },
    { id: "armor_1", tier: 1, name: "舰船装甲", cost: 250, weight: 90, effect: { shipArmor: 100 }, desc: "改良舰船装甲" },
    { id: "destroyer", tier: 2, name: "驱逐舰", cost: 500, weight: 75, req: ["armor_1"], effect: { unlockShip: "destroyer" }, desc: "解锁驱逐舰" },
    { id: "thrusters_2", tier: 2, name: "离子推进器", cost: 550, weight: 65, req: ["mining_1"], effect: { shipSpeed: 0.15 }, desc: "+15% 舰船速度" },
    { id: "alloy_2", tier: 2, name: "纳米机器人", cost: 600, weight: 60, req: ["alloy_1"], effect: { jobBonus: { metallurgist: 1 } }, desc: "冶金师 +1 合金" },
    { id: "cruiser", tier: 3, name: "巡洋舰", cost: 1200, weight: 50, req: ["destroyer"], effect: { unlockShip: "cruiser" }, desc: "解锁巡洋舰" },
    { id: "starhold_tech", tier: 3, name: "星基扩展", cost: 1100, weight: 45, req: ["destroyer"], effect: { starbaseLevel: "starhold" }, desc: "解锁恒星堡" },
    { id: "battleship", tier: 4, name: "战列舰", cost: 3000, weight: 25, req: ["cruiser"], effect: { unlockShip: "battleship" }, desc: "解锁战列舰" },
    { id: "star_fortress_tech", tier: 4, name: "堡垒工程", cost: 2800, weight: 25, req: ["starhold_tech"], effect: { starbaseLevel: "star_fortress" }, desc: "解锁恒星要塞" },
    { id: "titan", tier: 5, name: "泰坦", cost: 8000, weight: 10, req: ["battleship"], effect: { unlockShip: "titan" }, desc: "解锁泰坦" },
  ],
};

// ---------------- 传统 (简化) ----------------
const TRADITIONS = {
  expansion:   { name: "扩张", cost: 100, effect: { popGrowth: 0.1 }, desc: "+10% 人口增长，殖民更快" },
  prosperity:  { name: "繁荣", cost: 100, effect: { workerBonus: 0.1 }, desc: "+10% 工人产出" },
  discovery:   { name: "探索", cost: 100, effect: { researchBonus: 0.1 }, desc: "+10% 研究速度" },
  supremacy:   { name: "霸权", cost: 100, effect: { shipFire: 0.1, navalCap: 20 }, desc: "+10% 火力，+海军容量" },
  domination:  { name: "统御", cost: 100, effect: { influence: 1, stability: 5 }, desc: "+影响力，+稳定度" },
};

// 星球名字库
const STAR_NAMES = ["天狼","南门","参宿","毕宿","河鼓","天津","轩辕","北落","娄宿","昴宿","心宿","角宿","氐宿","房宿","尾宿","箕宿","斗宿","牛宿","女宿","虚宿","危宿","室宿","壁宿","奎宿","胃宿","觜宿","井宿","鬼宿","柳宿","星宿","张宿","翼宿","轸宿","太微","紫微","天市","库楼","骑官","阵车","积卒","青丘","天狼","弧矢","老人","东瓯","阙丘"];
const GREEK = ["α","β","γ","δ","ε","ζ","η","θ","ι","κ","λ","μ","ν","ξ"];

const AI_EMPIRE_NAMES = [
  { empire: "布洛克林帝国", species: "布洛克林人", color: "#ff5b5b" },
  { empire: "赛斯提集合体", species: "赛斯提", color: "#5bff8a" },
  { empire: "沃鲁尔联邦", species: "沃鲁尔人", color: "#ffd24a" },
  { empire: "克萨里德神权国", species: "克萨里德", color: "#c86bff" },
  { empire: "提尔文共和国", species: "提尔文人", color: "#4ad6ff" },
  { empire: "莫拉格帝国", species: "莫拉格人", color: "#ff8a4a" },
];
