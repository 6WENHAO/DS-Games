/* ============ 物种数据表（恐龙 / 人类部落 / 魔幻生物） ============ */
(function (D) {
  "use strict";

  // size 碰撞半径(体型系数1) / speed px每秒 / reach 额外攻击距离
  // diet: carn 肉食 / herb 植食 / omni 杂食 ; kind: 无=恐龙 / human / struct
  var S = {
    /* ---------------- 可玩恐龙 ---------------- */
    raptor: {
      key: "raptor", name: "迅猛龙", latin: "Velociraptor", diet: "carn", playable: true,
      size: 19, speed: 182, hp: 82, dmg: 15, atkRate: 0.46, reach: 20,
      appetite: 0.95, thirsty: 1.0, aggro: 440, brave: 0.85, herd: 3, pack: true,
      breath: "bolt",
      colors: { body: "#c9803c", belly: "#e8cba1", accent: "#7d3f19", eye: "#ffe08a" },
      art: { legs: 2, feathers: true, stripes: true, teeth: true, arms: "raptor", headLong: 1.0, tail: 1.35 },
      difficulty: "普通",
      desc: "速度与耐力兼备的群猎者，血脉里流着雷霆。成群时连霸王龙也敢骚扰。",
      tips: "用雷霆吐息隔空点杀，冲刺追击落单猎物。"
    },
    rex: {
      key: "rex", name: "霸王龙", latin: "T-Rex", diet: "carn", playable: true,
      size: 33, speed: 140, hp: 300, dmg: 40, atkRate: 0.86, reach: 30,
      appetite: 1.55, thirsty: 1.15, aggro: 540, brave: 1.7, herd: 0,
      breath: "fire",
      colors: { body: "#6c7d4a", belly: "#c8c39a", accent: "#3d4a28", eye: "#ff7a4a" },
      art: { legs: 2, bigHead: 1.35, teeth: true, arms: "tiny", scutes: true, headLong: 1.1, tail: 1.25 },
      difficulty: "困难",
      desc: "陆地霸主，喉咙深处燃着地火。一口下去几乎没有生物能撑住，但胃口极大。",
      tips: "烈焰吐息能点燃一整片猎物与地面，别停下来捕猎。"
    },
    trike: {
      key: "trike", name: "三角龙", latin: "Triceratops", diet: "herb", playable: true,
      size: 29, speed: 122, hp: 265, dmg: 27, atkRate: 0.8, reach: 24,
      appetite: 1.15, thirsty: 1.1, aggro: 320, brave: 1.25, herd: 4,
      breath: "quake",
      colors: { body: "#8a7a5e", belly: "#cfc0a0", accent: "#5b4c34", eye: "#f2d98a" },
      art: { legs: 4, frill: true, horns: true, scutes: true, tail: 0.8, headLong: 0.85 },
      difficulty: "简单",
      desc: "披甲的植食战车，一踏地便掀起石浪。头盾能挡下大部分攻击。",
      tips: "被围攻时用大地震荡把敌人震退并眩晕。"
    },
    para: {
      key: "para", name: "副栉龙", latin: "Parasaurolophus", diet: "herb", playable: true,
      size: 26, speed: 164, hp: 175, dmg: 13, atkRate: 0.9, reach: 16,
      appetite: 1.0, thirsty: 1.05, aggro: 300, brave: 0.4, herd: 6,
      breath: "frost",
      colors: { body: "#5f9bb5", belly: "#d5e5ea", accent: "#37647a", eye: "#ffe6a0" },
      art: { legs: 4, crest: true, neckLong: 1.2, tail: 1.0, headLong: 1.0 },
      difficulty: "简单",
      desc: "长跑健将，头冠能吹出寒霜。打不过就跑，跑得比谁都久。",
      tips: "霜冻吐息减速追兵，还能扑灭身上的火。"
    },

    /* ---------------- 野生恐龙 ---------------- */
    stego: {
      key: "stego", name: "剑龙", latin: "Stegosaurus", diet: "herb",
      size: 29, speed: 106, hp: 250, dmg: 22, atkRate: 0.9, reach: 22, thorns: 16,
      appetite: 1.0, thirsty: 1.0, aggro: 280, brave: 1.0, herd: 3,
      colors: { body: "#7d8b52", belly: "#c3c68e", accent: "#4d5a2c", eye: "#f5e3a0" },
      art: { legs: 4, plates: true, spikeTail: true, tail: 1.05, headLong: 0.8 },
      desc: "背板与尾刺让它成为最难啃的植食恐龙。"
    },
    anky: {
      key: "anky", name: "甲龙", latin: "Ankylosaurus", diet: "herb",
      size: 25, speed: 98, hp: 285, dmg: 24, atkRate: 1.0, reach: 20, thorns: 20,
      appetite: 0.95, thirsty: 0.95, aggro: 260, brave: 1.1, herd: 2,
      colors: { body: "#6f6a52", belly: "#b3ab86", accent: "#443f2c", eye: "#ffd98a" },
      art: { legs: 4, armor: true, clubTail: true, tail: 0.95, headLong: 0.7 },
      desc: "活体坦克，尾锤一击能让掠食者骨折。"
    },
    compy: {
      key: "compy", name: "美颌龙", latin: "Compsognathus", diet: "omni",
      size: 10, speed: 148, hp: 28, dmg: 5, atkRate: 0.5, reach: 8,
      appetite: 0.8, thirsty: 0.9, aggro: 240, brave: 0.2, herd: 7,
      colors: { body: "#cfa85c", belly: "#f0e0b8", accent: "#8a6a2c", eye: "#3b2b12" },
      art: { legs: 2, feathers: true, teeth: true, arms: "raptor", tail: 1.5, headLong: 0.9 },
      desc: "小型群居恐龙，几乎人人都能吃它。"
    },
    spino: {
      key: "spino", name: "棘龙", latin: "Spinosaurus", diet: "carn",
      size: 35, speed: 150, hp: 330, dmg: 42, atkRate: 0.72, reach: 32,
      appetite: 1.4, thirsty: 0.8, aggro: 560, brave: 1.8, herd: 0, waterLover: true, apex: true,
      colors: { body: "#4a5a76", belly: "#c0c7d6", accent: "#28324a", eye: "#ff5a3a" },
      art: { legs: 2, sail: true, teeth: true, arms: "raptor", headLong: 1.45, tail: 1.3 },
      desc: "河岸边的死神，比霸王龙更快更长。"
    },

    /* ---------------- 人类部落（独立阵营，主动围猎恐龙） ---------------- */
    hunter: {
      key: "hunter", name: "部落猎人", latin: "Homo venator", diet: "omni", kind: "human",
      size: 9, speed: 154, hp: 58, dmg: 10, atkRate: 0.7, reach: 12,
      appetite: 0.8, thirsty: 0.9, aggro: 520, brave: 1.6, herd: 4, hunter: true,
      ranged: { kind: "spear", dmg: 15, cd: 2.3, range: 350 },
      colors: { body: "#c98f5f", belly: "#e6c9a4", accent: "#7a4a26", eye: "#2a1a0e" },
      art: { human: true, role: "hunter" },
      desc: "投掷长矛的部落猎手，从不单独出现。"
    },
    spearman: {
      key: "spearman", name: "长矛战士", latin: "Homo bellator", diet: "omni", kind: "human",
      size: 10, speed: 142, hp: 98, dmg: 23, atkRate: 0.66, reach: 34,
      appetite: 0.8, thirsty: 0.9, aggro: 500, brave: 2.0, herd: 3, hunter: true,
      colors: { body: "#bf7f52", belly: "#e3c39c", accent: "#8c3a2a", eye: "#2a1a0e" },
      art: { human: true, role: "spear" },
      desc: "举矛冲锋的战士，会挡在族人前面。"
    },
    shaman: {
      key: "shaman", name: "部落萨满", latin: "Homo magus", diet: "omni", kind: "human",
      size: 9, speed: 124, hp: 76, dmg: 8, atkRate: 0.9, reach: 12,
      appetite: 0.8, thirsty: 0.9, aggro: 560, brave: 1.2, herd: 2, hunter: true, magic: true,
      ranged: { kind: "fireball", dmg: 17, cd: 3.2, range: 400, burn: 4, burnDmg: 5 },
      colors: { body: "#a97ab8", belly: "#e0cfe8", accent: "#4d2a5c", eye: "#ffe066" },
      art: { human: true, role: "shaman" },
      desc: "会扔火球、也会治疗与庇护族人的施法者。优先干掉他。"
    },
    chief: {
      key: "chief", name: "部落酋长", latin: "Homo rex", diet: "omni", kind: "human",
      size: 12, speed: 148, hp: 220, dmg: 34, atkRate: 0.6, reach: 36,
      appetite: 0.8, thirsty: 0.9, aggro: 620, brave: 2.6, herd: 1, hunter: true, elite: true,
      ranged: { kind: "spear", dmg: 24, cd: 2.0, range: 380 },
      colors: { body: "#cf8c4e", belly: "#f0d3a6", accent: "#b03a2a", eye: "#ffd257" },
      art: { human: true, role: "chief" },
      desc: "戴着恐龙头骨的战争领袖，图腾被袭时会亲自出面。"
    },
    totem: {
      key: "totem", name: "部落图腾", latin: "Totem", diet: "herb", kind: "struct",
      size: 17, speed: 0, hp: 340, dmg: 0, atkRate: 9, reach: 0,
      appetite: 0, thirsty: 0, aggro: 0, brave: 0,
      "static": true, ignoreAI: true,
      colors: { body: "#8a6a42", belly: "#c8a878", accent: "#4a3520", eye: "#ffd257" },
      art: { totem: true },
      desc: "维系部落魔法的图腾柱，摧毁它能让营地停止派兵。"
    },

    /* ---------------- 魔幻生物 ---------------- */
    wraith: {
      key: "wraith", name: "幽影龙", latin: "Umbra raptor", diet: "carn",
      size: 19, speed: 198, hp: 132, dmg: 25, atkRate: 0.5, reach: 22,
      appetite: 0.9, thirsty: 0.0, aggro: 620, brave: 1.6, herd: 0,
      spectral: true, nightOnly: true, blink: true, manaDrop: 45,
      colors: { body: "#6f7bd8", belly: "#c9d2ff", accent: "#343a78", eye: "#b6f0ff" },
      art: { legs: 2, feathers: true, teeth: true, arms: "raptor", tail: 1.4, headLong: 1.0, ghost: true },
      desc: "夜里从魔法裂隙钻出的幽影，会瞬移到你背后。"
    },
    lavarex: {
      key: "lavarex", name: "熔岩暴龙", latin: "Ignis rex", diet: "carn",
      size: 40, speed: 152, hp: 920, dmg: 56, atkRate: 0.9, reach: 38,
      appetite: 1.2, thirsty: 0.4, aggro: 720, brave: 3, herd: 0,
      apex: true, boss: true, fireproof: true, fireTrail: true, breath: "fire", manaDrop: 60,
      colors: { body: "#3d2422", belly: "#ff7a2a", accent: "#1b100f", eye: "#ffd257" },
      art: { legs: 2, bigHead: 1.4, teeth: true, arms: "tiny", scutes: true, headLong: 1.15, tail: 1.3, lava: true },
      desc: "地火中苏醒的龙王，脚下留下燃烧的裂痕。"
    }
  };

  var STAGES = ["幼年", "亚成年", "成年", "霸主"];

  function stageOf(level) {
    if (level >= 10) return 3;
    if (level >= 6) return 2;
    if (level >= 3) return 1;
    return 0;
  }
  function stageScale(level) {
    var s = stageOf(level);
    var base = [0.6, 0.79, 1.0, 1.18][s];
    var start = [1, 3, 6, 10][s];
    return base + (level - start) * 0.013;
  }
  function expNeed(level) { return Math.round(52 * Math.pow(level, 1.42)); }

  D.SPECIES = S;
  D.STAGES = STAGES;
  D.stageOf = stageOf;
  D.stageScale = stageScale;
  D.expNeed = expNeed;
  D.PLAYABLE = ["raptor", "para", "trike", "rex"];
  D.HUMANS = ["hunter", "spearman", "shaman", "chief"];
})(window.DINO);
