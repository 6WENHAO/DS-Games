// 物品定义表
export const ITEMS = {
  hatchet: {
    name: '手斧', icon: 'stone-axe.svg', equip: true,
    damage: 18, chopPower: 1, desc: '砍树与自卫的基本工具',
  },
  machete: {
    name: '砍刀', icon: 'machete.svg', equip: true,
    damage: 26, chopPower: 0.6, desc: '锋利的开山刀，战斗利器',
  },
  spear: {
    name: '简易长矛', icon: 'bone-knife.svg', equip: true,
    damage: 22, chopPower: 0.3, range: 3.4, desc: '合成武器，攻击距离更长',
  },
  log: { name: '原木', icon: 'log.svg', stack: 12, desc: '建造的主要材料' },
  stick: { name: '树枝', icon: 'wood-stick.svg', stack: 20, desc: '散落在林地，可合成与建造' },
  stone: { name: '石头', icon: 'rock.svg', stack: 20, desc: '溪边与岩石区常见' },
  cloth: { name: '布料', icon: 'bandaged.svg', stack: 10, desc: '从行李箱中获得' },
  apple: {
    name: '苹果', icon: 'shiny-apple.svg', stack: 10, use: 'eat',
    food: 22, water: 6, desc: '来自坠机残骸的补给',
  },
  berries: {
    name: '浆果', icon: 'raspberry.svg', stack: 20, use: 'eat',
    food: 8, water: 4, desc: '林中的红色灌木上采集',
  },
  meat_raw: {
    name: '生肉', icon: 'meat.svg', stack: 5, use: 'eat',
    food: 10, health: -6, desc: '生吃有害健康，最好用篝火烤熟',
  },
  meat_cooked: {
    name: '烤肉', icon: 'meat-cleaver.svg', stack: 5, use: 'eat',
    food: 40, health: 5, desc: '篝火烤制，恢复大量饥饿',
  },
  waterskin_empty: {
    name: '水袋（空）', icon: 'waterskin.svg', stack: 1, use: 'none',
    desc: '在水边装满它',
  },
  waterskin_full: {
    name: '水袋（满）', icon: 'water-flask.svg', stack: 1, use: 'drink',
    water: 55, desc: '随时补充水分',
  },
  bandage: {
    name: '绷带', icon: 'health-potion.svg', stack: 5, use: 'heal',
    health: 35, desc: '布料合成，恢复生命',
  },
};

// 合成配方
export const RECIPES = [
  { id: 'spear', out: 'spear', count: 1, cost: { stick: 2, stone: 1 }, icon: 'bone-knife.svg' },
  { id: 'bandage', out: 'bandage', count: 1, cost: { cloth: 2 }, icon: 'health-potion.svg' },
  { id: 'waterskin', out: 'waterskin_empty', count: 1, cost: { cloth: 3, stick: 1 }, icon: 'waterskin.svg' },
];

// 建筑蓝图
export const BUILDINGS = [
  {
    id: 'campfire', name: '篝火', icon: 'campfire.svg',
    cost: { stick: 5, stone: 3 },
    desc: '取暖、照明、烹饪生肉',
  },
  {
    id: 'shelter', name: '庇护所', icon: 'tipi.svg',
    cost: { log: 4, stick: 6 },
    desc: '睡觉度过黑夜，并可存档',
  },
  {
    id: 'wall', name: '原木墙', icon: 'wood-beam.svg',
    cost: { log: 2 },
    desc: '阻挡敌人的防御工事',
  },
  {
    id: 'rack', name: '晾晒架', icon: 'wood-pile.svg',
    cost: { stick: 6 },
    desc: '装饰性的营地设施',
  },
];
