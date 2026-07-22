/* ============ 建筑数据定义 ============ */
COC.BuildingDefs = (function () {
  'use strict';

  /*
   * 每种建筑：
   * name/desc/cat: 名称、描述、商店分类 economy|defense|army|deco
   * size: 占地格数 (size x size)
   * maxByTH: [th1..th5] 数量上限
   * sprites: level -> {key, k(宽度相对占地倍率), oy(向上偏移，绘制高度的比例)}
   * levels: [{cost:{gold|elixir}, time, hp, thReq, ...专属}]
   */
  var D = {};

  /* ---------- 大本营 ---------- */
  D.townhall = {
    name: '大本营', desc: '村庄的核心。升级后可解锁更多建筑，被摧毁会让对手直接获得一星。', cat: 'none',
    size: 4, maxByTH: [1, 1, 1, 1, 1],
    sprites: [
      { lv: 1, key: 'townhall_1', k: 1.16, oy: 0.10 },
      { lv: 3, key: 'townhall_2', k: 1.18, oy: 0.10 }
    ],
    levels: [
      { cost: { gold: 0 }, time: 0, hp: 1500, thReq: 1 },
      { cost: { gold: 1000 }, time: 12, hp: 1900, thReq: 1 },
      { cost: { gold: 4000 }, time: 90, hp: 2400, thReq: 2 },
      { cost: { gold: 15000 }, time: 600, hp: 3000, thReq: 3 },
      { cost: { gold: 60000 }, time: 1800, hp: 3800, thReq: 4 }
    ],
    lootGold: true
  };

  /* ---------- 资源 ---------- */
  D.goldmine = {
    name: '金矿', desc: '从地下挖掘金子。点击收集，注意别被掠夺！', cat: 'economy',
    size: 3, maxByTH: [2, 3, 4, 5, 6],
    sprites: [{ lv: 1, key: 'goldmine_anim', k: 1.02, oy: 0.04, anim: { prefix: 'goldmine_', frames: 17, fps: 10 } }],
    levels: [
      { cost: { elixir: 150 }, time: 5, hp: 400, thReq: 1, prodHour: 400, cap: 500 },
      { cost: { elixir: 400 }, time: 20, hp: 450, thReq: 1, prodHour: 800, cap: 1200 },
      { cost: { elixir: 1500 }, time: 120, hp: 520, thReq: 2, prodHour: 1500, cap: 2800 },
      { cost: { elixir: 6000 }, time: 480, hp: 600, thReq: 3, prodHour: 2600, cap: 6000 },
      { cost: { elixir: 20000 }, time: 1200, hp: 700, thReq: 4, prodHour: 4200, cap: 12000 }
    ],
    produces: 'gold'
  };

  D.elixirpump = {
    name: '圣水泵', desc: '抽取地脉中的圣水，训练部队离不开它。', cat: 'economy',
    size: 3, maxByTH: [2, 3, 4, 5, 6],
    sprites: [{ lv: 1, key: 'elixirpump', k: 1.04, oy: 0.05 }],
    levels: [
      { cost: { gold: 150 }, time: 5, hp: 400, thReq: 1, prodHour: 400, cap: 500 },
      { cost: { gold: 400 }, time: 20, hp: 450, thReq: 1, prodHour: 800, cap: 1200 },
      { cost: { gold: 1500 }, time: 120, hp: 520, thReq: 2, prodHour: 1500, cap: 2800 },
      { cost: { gold: 6000 }, time: 480, hp: 600, thReq: 3, prodHour: 2600, cap: 6000 },
      { cost: { gold: 20000 }, time: 1200, hp: 700, thReq: 4, prodHour: 4200, cap: 12000 }
    ],
    produces: 'elixir'
  };

  D.goldstorage = {
    name: '储金罐', desc: '存放你的金子。升级提高容量，摧毁它的敌人能抢走部分金子。', cat: 'economy',
    size: 3, maxByTH: [1, 1, 2, 2, 3],
    sprites: [{ lv: 1, key: 'goldstorage', k: 1.02, oy: 0.05 }],
    levels: [
      { cost: { elixir: 300 }, time: 8, hp: 500, thReq: 1, store: 2500 },
      { cost: { elixir: 900 }, time: 40, hp: 600, thReq: 1, store: 6000 },
      { cost: { elixir: 3000 }, time: 200, hp: 800, thReq: 2, store: 15000 },
      { cost: { elixir: 9000 }, time: 700, hp: 1100, thReq: 3, store: 45000 },
      { cost: { elixir: 28000 }, time: 1600, hp: 1500, thReq: 4, store: 100000 }
    ],
    stores: 'gold'
  };

  D.elixirstorage = {
    name: '圣水瓶', desc: '巨大的魔法容器，存放宝贵的圣水。', cat: 'economy',
    size: 3, maxByTH: [1, 1, 2, 2, 3],
    sprites: [{ lv: 1, key: 'elixirstorage', k: 1.0, oy: 0.06 }],
    levels: [
      { cost: { gold: 300 }, time: 8, hp: 500, thReq: 1, store: 2500 },
      { cost: { gold: 900 }, time: 40, hp: 600, thReq: 1, store: 6000 },
      { cost: { gold: 3000 }, time: 200, hp: 800, thReq: 2, store: 15000 },
      { cost: { gold: 9000 }, time: 700, hp: 1100, thReq: 3, store: 45000 },
      { cost: { gold: 28000 }, time: 1600, hp: 1500, thReq: 4, store: 100000 }
    ],
    stores: 'elixir'
  };

  /* ---------- 军事 ---------- */
  D.barracks = {
    name: '兵营', desc: '训练勇猛的部队。升级解锁新兵种。', cat: 'army',
    size: 3, maxByTH: [1, 1, 2, 2, 2],
    sprites: [
      { lv: 1, key: 'barracks_1', k: 1.05, oy: 0.05 },
      { lv: 3, key: 'barracks_2', k: 1.05, oy: 0.05 }
    ],
    levels: [
      { cost: { elixir: 200 }, time: 6, hp: 450, thReq: 1, unlock: 'barbarian' },
      { cost: { elixir: 800 }, time: 60, hp: 500, thReq: 1, unlock: 'archer' },
      { cost: { elixir: 2500 }, time: 240, hp: 550, thReq: 2, unlock: 'goblin' },
      { cost: { elixir: 8000 }, time: 900, hp: 620, thReq: 3, unlock: 'giant' },
      { cost: { elixir: 25000 }, time: 2000, hp: 700, thReq: 4, unlock: 'wallbreaker' }
    ]
  };

  D.armycamp = {
    name: '兵营驻地', desc: '训练完成的部队在这里驻扎待命。', cat: 'army',
    size: 4, maxByTH: [1, 1, 2, 2, 2],
    sprites: [{ lv: 1, key: 'armycamp', k: 1.1, oy: 0.02 }],
    levels: [
      { cost: { elixir: 250 }, time: 8, hp: 300, thReq: 1, camp: 20 },
      { cost: { elixir: 2500 }, time: 300, hp: 350, thReq: 2, camp: 30 },
      { cost: { elixir: 10000 }, time: 900, hp: 400, thReq: 3, camp: 40 },
      { cost: { elixir: 30000 }, time: 2400, hp: 450, thReq: 4, camp: 50 },
      { cost: { elixir: 80000 }, time: 4800, hp: 500, thReq: 5, camp: 60 }
    ]
  };

  D.laboratory = {
    name: '实验室', desc: '研究部队科技，让你的军队更强大。', cat: 'army',
    size: 3, maxByTH: [0, 1, 1, 1, 1],
    sprites: [{ lv: 1, key: 'laboratory', k: 1.02, oy: 0.06 }],
    levels: [
      { cost: { elixir: 500 }, time: 30, hp: 500, thReq: 2, labLv: 1 },
      { cost: { elixir: 5000 }, time: 600, hp: 550, thReq: 3, labLv: 2 },
      { cost: { elixir: 20000 }, time: 1800, hp: 600, thReq: 4, labLv: 3 }
    ]
  };

  D.spellfactory = {
    name: '法术工厂', desc: '酿造强大的雷电法术，在战斗中释放毁灭。', cat: 'army',
    size: 3, maxByTH: [0, 0, 1, 1, 1],
    sprites: [{ lv: 1, key: 'spellfactory', k: 1.05, oy: -0.05 }],
    levels: [
      { cost: { gold: 2000 }, time: 120, hp: 425, thReq: 3, spellCap: 1 },
      { cost: { gold: 10000 }, time: 900, hp: 470, thReq: 4, spellCap: 2 },
      { cost: { gold: 30000 }, time: 2400, hp: 520, thReq: 5, spellCap: 3 }
    ]
  };

  D.clancastle = {
    name: '部落城堡', desc: '古老的维京要塞，可容纳额外的援军。', cat: 'army',
    size: 3, maxByTH: [0, 0, 1, 1, 1],
    sprites: [{ lv: 1, key: 'clancastle', k: 1.06, oy: 0.05 }],
    levels: [
      { cost: { gold: 5000 }, time: 300, hp: 1000, thReq: 3, camp: 10 },
      { cost: { gold: 20000 }, time: 1200, hp: 1200, thReq: 4, camp: 15 },
      { cost: { gold: 60000 }, time: 3000, hp: 1400, thReq: 5, camp: 20 }
    ]
  };

  D.builderhut = {
    name: '建筑工人小屋', desc: '每座小屋提供一名勤劳的工人。', cat: 'army',
    size: 2, maxByTH: [2, 3, 3, 4, 4],
    sprites: [{ lv: 1, key: 'builderhut', k: 1.05, oy: 0.04 }],
    levels: [
      { cost: { gold: 0 }, time: 0, hp: 250, thReq: 1 }
    ],
    gemCost: true
  };

  /* ---------- 防御 ---------- */
  D.cannon = {
    name: '加农炮塔', desc: '经典防御，对地面单位发射沉重的炮弹。', cat: 'defense',
    size: 3, maxByTH: [2, 2, 3, 4, 5],
    sprites: [{ lv: 1, key: 'cannon', k: 0.78, oy: 0.02 }],
    levels: [
      { cost: { gold: 250 }, time: 5, hp: 420, thReq: 1, dmg: 9, rate: 0.9, range: 9 },
      { cost: { gold: 1000 }, time: 60, hp: 470, thReq: 1, dmg: 11, rate: 0.9, range: 9 },
      { cost: { gold: 4000 }, time: 300, hp: 520, thReq: 2, dmg: 15, rate: 0.85, range: 9 },
      { cost: { gold: 12000 }, time: 1200, hp: 600, thReq: 3, dmg: 19, rate: 0.85, range: 9.5 },
      { cost: { gold: 35000 }, time: 2400, hp: 700, thReq: 4, dmg: 25, rate: 0.8, range: 10 }
    ],
    weapon: 'cannon'
  };

  D.archertower = {
    name: '箭塔', desc: '射程超远的弩炮塔，会转向瞄准目标。', cat: 'defense',
    size: 3, maxByTH: [0, 1, 2, 3, 4],
    sprites: [{ lv: 1, key: 'atower', k: 0.92, oy: 0.05, aim: true }],
    levels: [
      { cost: { gold: 1000 }, time: 30, hp: 380, thReq: 2, dmg: 11, rate: 0.6, range: 10 },
      { cost: { gold: 3000 }, time: 240, hp: 420, thReq: 2, dmg: 14, rate: 0.6, range: 10 },
      { cost: { gold: 9000 }, time: 900, hp: 460, thReq: 3, dmg: 17, rate: 0.55, range: 10.5 },
      { cost: { gold: 25000 }, time: 2000, hp: 510, thReq: 4, dmg: 21, rate: 0.55, range: 11 },
      { cost: { gold: 60000 }, time: 3600, hp: 560, thReq: 5, dmg: 26, rate: 0.5, range: 11 }
    ],
    weapon: 'arrow'
  };

  D.mortar = {
    name: '迫击炮', desc: '发射范围杀伤的炮弹，但无法攻击近处的敌人。', cat: 'defense',
    size: 3, maxByTH: [0, 0, 1, 1, 2],
    sprites: [{ lv: 1, key: 'mortar', k: 0.95, oy: 0.02 }],
    levels: [
      { cost: { gold: 5000 }, time: 300, hp: 400, thReq: 3, dmg: 20, rate: 5, range: 11, minRange: 3.5, splash: 1.5 },
      { cost: { gold: 15000 }, time: 1200, hp: 450, thReq: 4, dmg: 28, rate: 5, range: 11, minRange: 3.5, splash: 1.6 },
      { cost: { gold: 40000 }, time: 2600, hp: 500, thReq: 5, dmg: 38, rate: 5, range: 11.5, minRange: 3.5, splash: 1.7 }
    ],
    weapon: 'mortar'
  };

  D.wizardtower = {
    name: '法师塔', desc: '奥术能量球释放范围魔法伤害，克制人海战术。', cat: 'defense',
    size: 3, maxByTH: [0, 0, 0, 1, 2],
    sprites: [{ lv: 1, key: 'wizardtower', k: 0.94, oy: 0.05 }],
    levels: [
      { cost: { gold: 12000 }, time: 900, hp: 620, thReq: 4, dmg: 14, rate: 1.3, range: 7, splash: 1.1 },
      { cost: { gold: 32000 }, time: 2000, hp: 650, thReq: 4, dmg: 18, rate: 1.3, range: 7, splash: 1.15 },
      { cost: { gold: 70000 }, time: 3800, hp: 680, thReq: 5, dmg: 24, rate: 1.25, range: 7.5, splash: 1.2 }
    ],
    weapon: 'magic'
  };

  D.xbow = {
    name: '哨戒塔', desc: '古老的石制哨塔，以极快的速度倾泻箭雨。', cat: 'defense',
    size: 3, maxByTH: [0, 0, 0, 0, 1],
    sprites: [{ lv: 1, key: 'xbow', k: 0.85, oy: 0.05 }],
    levels: [
      { cost: { gold: 50000 }, time: 2400, hp: 900, thReq: 5, dmg: 7, rate: 0.25, range: 12 },
      { cost: { gold: 100000 }, time: 4800, hp: 1000, thReq: 5, dmg: 9, rate: 0.25, range: 12 }
    ],
    weapon: 'arrow'
  };

  D.wall = {
    name: '城墙', desc: '阻挡敌人的脚步，保护你的核心建筑。', cat: 'defense',
    size: 1, maxByTH: [0, 25, 50, 75, 100],
    sprites: [
      { lv: 1, key: 'wall_wood', k: 1.0, oy: 0 },
      { lv: 3, key: 'wall_stone', k: 1.0, oy: 0 },
      { lv: 5, key: 'wall_gold', k: 1.0, oy: 0 }
    ],
    levels: [
      { cost: { gold: 50 }, time: 0, hp: 300, thReq: 2 },
      { cost: { gold: 300 }, time: 0, hp: 500, thReq: 2 },
      { cost: { gold: 1000 }, time: 0, hp: 900, thReq: 3 },
      { cost: { gold: 4000 }, time: 0, hp: 1400, thReq: 4 },
      { cost: { gold: 10000 }, time: 0, hp: 2000, thReq: 5 }
    ]
  };

  /* ---------- 装饰 ---------- */
  function deco(id, name, desc, key, size, gold, k, oy) {
    D[id] = {
      name: name, desc: desc, cat: 'deco', size: size,
      maxByTH: [6, 6, 8, 8, 10],
      sprites: [{ lv: 1, key: key, k: k || 1.0, oy: oy || 0.03 }],
      levels: [{ cost: { gold: gold }, time: 0, hp: 100, thReq: 1 }],
      isDeco: true
    };
  }
  deco('house_a', '村民小屋', '温馨的小屋，让村庄更有生活气息。', 'house_a', 2, 400, 1.02);
  deco('house_c', '红顶小屋', '村民们最爱的红顶房子。', 'house_c', 2, 400, 1.02);
  deco('farmhouse', '农舍', '带菜园的农舍，丰收的象征。', 'farmhouse', 2, 800, 0.9, 0.02);
  deco('stable', '马厩', '饲养骏马的地方。', 'stable', 3, 1500, 1.02);
  deco('blacksmith', '铁匠铺', '叮叮当当，武器在这里锻造。', 'blacksmith', 3, 1500, 1.02);
  deco('windmill', '风车', '悠悠转动的风车。', 'windmill', 2, 600, 0.85, 0.06);

  /* ---------- 障碍物 ---------- */
  var OBSTACLES = {
    tree1: { name: '大树', key: 'tree1', size: 2, cost: { gold: 120 }, time: 10, k: 0.8, oy: 0.05 },
    tree2: { name: '松树', key: 'tree2', size: 2, cost: { gold: 120 }, time: 10, k: 0.72, oy: 0.05 },
    tree3: { name: '橡树', key: 'tree3', size: 2, cost: { elixir: 120 }, time: 10, k: 0.8, oy: 0.05 },
    tree4: { name: '古树', key: 'tree4', size: 2, cost: { elixir: 150 }, time: 12, k: 0.85, oy: 0.05 },
    rock1: { name: '碎石', key: 'rock1', size: 1, cost: { gold: 80 }, time: 6, k: 0.8, oy: 0 },
    rock2: { name: '岩石', key: 'rock2', size: 2, cost: { gold: 150 }, time: 12, k: 0.85, oy: 0 },
    rock3: { name: '巨岩', key: 'rock3', size: 2, cost: { elixir: 150 }, time: 12, k: 0.9, oy: 0 },
    bush1: { name: '灌木', key: 'bush1', size: 1, cost: { gold: 60 }, time: 4, k: 0.75, oy: 0 },
    bush2: { name: '花丛', key: 'bush2', size: 1, cost: { elixir: 60 }, time: 4, k: 0.75, oy: 0 },
    goldnugget: { name: '金块', key: 'goldnugget', size: 1, cost: { gold: 0 }, time: 3, k: 0.7, oy: 0, reward: { gold: 300 } }
  };

  /* ---------- 查询 ---------- */
  function get(type) { return D[type]; }
  function levels(type) { return D[type].levels; }
  function lvl(type, lv) { return D[type].levels[lv - 1]; }
  function maxLevel(type) { return D[type].levels.length; }

  function spriteFor(type, lv) {
    var arr = D[type].sprites, best = arr[0];
    for (var i = 0; i < arr.length; i++) if (lv >= arr[i].lv) best = arr[i];
    return best;
  }

  function maxCount(type, thLv) {
    var arr = D[type].maxByTH;
    return arr[Math.min(thLv, arr.length) - 1] || 0;
  }

  function shopList(cat) {
    var out = [];
    for (var k in D) if (D[k].cat === cat) out.push(k);
    return out;
  }

  return {
    DEFS: D, OBSTACLES: OBSTACLES,
    get: get, levels: levels, lvl: lvl, maxLevel: maxLevel,
    spriteFor: spriteFor, maxCount: maxCount, shopList: shopList
  };
})();
