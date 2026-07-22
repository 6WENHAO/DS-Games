/* ============ 部队 & 法术数据 ============ */
COC.TroopDefs = (function () {
  'use strict';

  /*
   * hp/dps: 基础值（随实验室等级成长 growth 倍率）
   * speed: 格/秒   range: 攻击距离(格)   housing: 人口
   * pref: 目标偏好 any|defense|resource|wall
   * splash: 溅射半径   suicide: 自爆
   */
  var T = {
    barbarian: {
      name: '野蛮人', icon: 'u_barbarian', housing: 1,
      hp: 45, dps: 8, speed: 1.35, range: 0.5, pref: 'any',
      cost: 25, trainTime: 5, barracksLv: 1,
      desc: '挥舞大剑的金发猛士，见什么砍什么。',
      upCost: [800, 6000], upTime: [60, 900]
    },
    archer: {
      name: '弓箭手', icon: 'u_archer', housing: 1,
      hp: 20, dps: 7, speed: 1.5, range: 3.5, pref: 'any',
      cost: 50, trainTime: 6, barracksLv: 2,
      desc: '远程输出，可以越过城墙射击。',
      upCost: [1200, 8000], upTime: [90, 1200]
    },
    goblin: {
      name: '哥布林', icon: 'u_goblin', housing: 1,
      hp: 25, dps: 10, speed: 2.2, range: 0.5, pref: 'resource', prefMul: 2,
      cost: 25, trainTime: 5, barracksLv: 3,
      desc: '见钱眼开的小绿人，对资源建筑造成双倍伤害。',
      upCost: [1500, 9000], upTime: [120, 1500]
    },
    giant: {
      name: '巨人', icon: 'u_giant', housing: 5,
      hp: 300, dps: 11, speed: 0.9, range: 0.6, pref: 'defense',
      cost: 250, trainTime: 25, barracksLv: 4,
      desc: '皮糙肉厚，优先攻击防御建筑，是完美的肉盾。',
      scale: 1.5,
      upCost: [3000, 15000], upTime: [300, 2400]
    },
    wallbreaker: {
      name: '炸弹人', icon: 'u_wallbreaker', housing: 2,
      hp: 20, dps: 12, speed: 2.4, range: 0.4, pref: 'wall', prefMul: 40,
      suicide: true, splash: 1.2,
      cost: 100, trainTime: 15, barracksLv: 5,
      desc: '抱着炸弹冲向城墙，与最坚固的墙同归于尽。',
      upCost: [3500, 16000], upTime: [300, 2400]
    },
    wizard: {
      name: '法师', icon: 'u_wizard', housing: 4,
      hp: 75, dps: 50, speed: 1.3, range: 3, pref: 'any', splash: 0.7,
      cost: 350, trainTime: 30, barracksLv: 5,
      desc: '投掷炽热火球，范围伤害极高。',
      upCost: [5000, 20000], upTime: [600, 3600]
    }
  };

  var SPELLS = {
    lightning: {
      name: '雷电法术', icon: 'p_spark_07', housing: 1,
      cost: 150, brewTime: 60,
      dmg: 300, radius: 2,
      desc: '从天而降的三道闪电，重创范围内的建筑。'
    }
  };

  var GROWTH = 1.22; // 每级成长

  function get(id) { return T[id]; }
  function list() { return Object.keys(T); }
  function statAt(id, stat, lv) {
    var base = T[id][stat];
    return Math.round(base * Math.pow(GROWTH, (lv || 1) - 1));
  }
  function spell(id) { return SPELLS[id]; }
  function spellList() { return Object.keys(SPELLS); }

  return { DEFS: T, SPELLS: SPELLS, get: get, list: list, statAt: statAt, spell: spell, spellList: spellList, GROWTH: GROWTH };
})();
