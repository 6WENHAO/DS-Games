/* ============================================================
   data-enemies.js —— 敌人、招式、AI、遭遇组合
   ============================================================ */
'use strict';

/* AI 辅助：判断历史招式 */
function was(e, key, n) { return e.history[e.history.length - (n || 1)] === key; }
function wasN(e, key, times) {
  for (let i = 1; i <= times; i++) if (!was(e, key, i)) return false;
  return true;
}

const ENEMIES = {

  /* ============ 普通敌人 ============ */
  jaw_worm: {
    name: '颚虫', art: 'jaw_worm', w: 200, h: 165, hp: [40, 44],
    moves: {
      chomp: { name: '撕咬', intent: 'attack', dmg: 11, act: async (e) => { await E.attack(e, 11); } },
      thrash: { name: '鞭打', intent: 'attackDefend', dmg: 7, act: async (e) => { await E.attack(e, 7); E.block(e, 5); } },
      bellow: { name: '咆哮', intent: 'buff', act: async (e) => { E.power(e, 'strength', 3); E.block(e, 6); } }
    },
    ai: (e) => {
      if (!e.history.length) return 'chomp';
      const r = rnd();
      if (r < 0.25) return was(e, 'chomp') ? (chance(0.5) ? 'bellow' : 'thrash') : 'chomp';
      if (r < 0.55) return was(e, 'bellow') ? (chance(0.4) ? 'chomp' : 'thrash') : 'bellow';
      return wasN(e, 'thrash', 2) ? (chance(0.5) ? 'chomp' : 'bellow') : 'thrash';
    }
  },

  cultist: {
    name: '邪教徒', art: 'cultist', w: 165, h: 250, hp: [48, 54],
    moves: {
      incantation: { name: '咒言', intent: 'buff', act: async (e) => { E.power(e, 'ritual', 3); } },
      dark_strike: { name: '黑暗打击', intent: 'attack', dmg: 6, act: async (e) => { await E.attack(e, 6); } }
    },
    ai: (e) => (e.history.length ? 'dark_strike' : 'incantation')
  },

  louse_red: {
    name: '红虱', art: 'louse', artParam: 'red', w: 155, h: 122, hp: [10, 15],
    init: (e) => { e.bite = ri(5, 7); e.powers.curlUp = ri(3, 7); },
    moves: {
      bite: { name: '啃咬', intent: 'attack', dmgFn: (e) => e.bite, act: async (e) => { await E.attack(e, e.bite); } },
      grow: { name: '成长', intent: 'buff', act: async (e) => { E.power(e, 'strength', 3); } }
    },
    ai: (e) => {
      if (rnd() < 0.25) return was(e, 'grow') ? 'bite' : 'grow';
      return wasN(e, 'bite', 2) ? 'grow' : 'bite';
    }
  },
  louse_green: {
    name: '绿虱', art: 'louse', artParam: 'green', w: 155, h: 122, hp: [11, 17],
    init: (e) => { e.bite = ri(5, 7); e.powers.curlUp = ri(3, 7); },
    moves: {
      bite: { name: '啃咬', intent: 'attack', dmgFn: (e) => e.bite, act: async (e) => { await E.attack(e, e.bite); } },
      spit_web: { name: '吐丝', intent: 'debuff', act: async () => { E.playerPower('weak', 2); } }
    },
    ai: (e) => {
      if (rnd() < 0.25) return was(e, 'spit_web') ? 'bite' : 'spit_web';
      return wasN(e, 'bite', 2) ? 'spit_web' : 'bite';
    }
  },

  acid_slime_L: {
    name: '酸性史莱姆（大）', art: 'slime', artParam: 'acid', w: 215, h: 180, hp: [65, 69],
    splitInto: ['acid_slime_M', 'acid_slime_M'],
    moves: {
      corrosive_spit: {
        name: '腐蚀喷吐', intent: 'attackDebuff', dmg: 11,
        act: async (e) => { await E.attack(e, 11); E.addCard('discard', 'slimed', 2); }
      },
      lick: { name: '舔舐', intent: 'debuff', act: async () => { E.playerPower('weak', 2); } },
      tongue_lash: { name: '巨舌鞭击', intent: 'attack', dmg: 16, act: async (e) => { await E.attack(e, 16); } },
      split: { name: '分裂', intent: 'unknown', act: async (e) => { await E.split(e); } }
    },
    ai: (e) => {
      if (e.hp <= e.maxHp / 2 && !e.hasSplit) return 'split';
      const r = rnd();
      if (r < 0.3) return wasN(e, 'corrosive_spit', 2) ? (chance(0.5) ? 'tongue_lash' : 'lick') : 'corrosive_spit';
      if (r < 0.7) return wasN(e, 'tongue_lash', 2) ? (chance(0.5) ? 'corrosive_spit' : 'lick') : 'tongue_lash';
      return was(e, 'lick') ? (chance(0.5) ? 'corrosive_spit' : 'tongue_lash') : 'lick';
    }
  },
  acid_slime_M: {
    name: '酸性史莱姆（中）', art: 'slime', artParam: 'acid', w: 165, h: 138, hp: [28, 32],
    moves: {
      corrosive_spit: {
        name: '腐蚀喷吐', intent: 'attackDebuff', dmg: 7,
        act: async (e) => { await E.attack(e, 7); E.addCard('discard', 'slimed', 1); }
      },
      lick: { name: '舔舐', intent: 'debuff', act: async () => { E.playerPower('weak', 1); } },
      tongue_lash: { name: '巨舌鞭击', intent: 'attack', dmg: 10, act: async (e) => { await E.attack(e, 10); } }
    },
    ai: (e) => {
      const r = rnd();
      if (r < 0.3) return wasN(e, 'corrosive_spit', 2) ? (chance(0.5) ? 'tongue_lash' : 'lick') : 'corrosive_spit';
      if (r < 0.7) return wasN(e, 'tongue_lash', 2) ? (chance(0.5) ? 'corrosive_spit' : 'lick') : 'tongue_lash';
      return was(e, 'lick') ? (chance(0.5) ? 'corrosive_spit' : 'tongue_lash') : 'lick';
    }
  },
  acid_slime_S: {
    name: '酸性史莱姆（小）', art: 'slime', artParam: 'acid', w: 120, h: 100, hp: [8, 12],
    moves: {
      lick: { name: '舔舐', intent: 'debuff', act: async () => { E.playerPower('weak', 1); } },
      tongue_lash: { name: '巨舌鞭击', intent: 'attack', dmg: 3, act: async (e) => { await E.attack(e, 3); } }
    },
    ai: (e) => (!e.history.length ? (chance(0.5) ? 'lick' : 'tongue_lash')
      : (was(e, 'lick') ? 'tongue_lash' : 'lick'))
  },
  spike_slime_L: {
    name: '尖刺史莱姆（大）', art: 'slime', artParam: 'spike', w: 215, h: 180, hp: [64, 70],
    splitInto: ['spike_slime_M', 'spike_slime_M'],
    moves: {
      flame_tackle: {
        name: '烈焰冲撞', intent: 'attackDebuff', dmg: 16,
        act: async (e) => { await E.attack(e, 16); E.addCard('discard', 'slimed', 2); }
      },
      lick: { name: '舔舐', intent: 'debuff', act: async () => { E.playerPower('frail', 2); } },
      split: { name: '分裂', intent: 'unknown', act: async (e) => { await E.split(e); } }
    },
    ai: (e) => {
      if (e.hp <= e.maxHp / 2 && !e.hasSplit) return 'split';
      if (rnd() < 0.3) return was(e, 'lick') ? 'flame_tackle' : 'lick';
      return wasN(e, 'flame_tackle', 2) ? 'lick' : 'flame_tackle';
    }
  },
  spike_slime_M: {
    name: '尖刺史莱姆（中）', art: 'slime', artParam: 'spike', w: 165, h: 138, hp: [28, 32],
    moves: {
      flame_tackle: {
        name: '烈焰冲撞', intent: 'attackDebuff', dmg: 8,
        act: async (e) => { await E.attack(e, 8); E.addCard('discard', 'slimed', 1); }
      },
      lick: { name: '舔舐', intent: 'debuff', act: async () => { E.playerPower('frail', 1); } }
    },
    ai: (e) => {
      if (rnd() < 0.3) return was(e, 'lick') ? 'flame_tackle' : 'lick';
      return wasN(e, 'flame_tackle', 2) ? 'lick' : 'flame_tackle';
    }
  },
  spike_slime_S: {
    name: '尖刺史莱姆（小）', art: 'slime', artParam: 'spike', w: 120, h: 100, hp: [10, 14],
    moves: { tackle: { name: '冲撞', intent: 'attack', dmg: 5, act: async (e) => { await E.attack(e, 5); } } },
    ai: () => 'tackle'
  },

  fungi_beast: {
    name: '真菌兽', art: 'fungi', w: 165, h: 186, hp: [22, 28],
    init: (e) => { e.powers.sporeCloud = 2; },
    moves: {
      bite: { name: '啃咬', intent: 'attack', dmg: 6, act: async (e) => { await E.attack(e, 6); } },
      grow: { name: '孢子成长', intent: 'buff', act: async (e) => { E.power(e, 'strength', 3); } }
    },
    ai: (e) => {
      if (rnd() < 0.6) return wasN(e, 'bite', 2) ? 'grow' : 'bite';
      return was(e, 'grow') ? 'bite' : 'grow';
    }
  },

  slaver_blue: {
    name: '蓝奴隶主', art: 'slaver', artParam: 'blue', w: 175, h: 250, hp: [46, 50],
    moves: {
      stab: { name: '穿刺', intent: 'attack', dmg: 12, act: async (e) => { await E.attack(e, 12); } },
      rake: { name: '横扫', intent: 'attackDebuff', dmg: 7, act: async (e) => { await E.attack(e, 7); E.playerPower('weak', 1); } }
    },
    ai: (e) => {
      if (rnd() < 0.4) return wasN(e, 'rake', 2) ? 'stab' : 'rake';
      return wasN(e, 'stab', 2) ? 'rake' : 'stab';
    }
  },
  slaver_red: {
    name: '红奴隶主', art: 'slaver', artParam: 'red', w: 175, h: 250, hp: [46, 50],
    moves: {
      stab: { name: '穿刺', intent: 'attack', dmg: 13, act: async (e) => { await E.attack(e, 13); } },
      scrape: { name: '刮擦', intent: 'attackDebuff', dmg: 8, act: async (e) => { await E.attack(e, 8); E.playerPower('vulnerable', 1); } },
      entangle: { name: '缠绕', intent: 'debuff', act: async () => { E.playerPower('entangled', 1); } }
    },
    ai: (e) => {
      if (!e.usedEntangle && e.history.length >= 1 && rnd() < 0.45) { e.usedEntangle = true; return 'entangle'; }
      if (rnd() < 0.45) return wasN(e, 'scrape', 2) ? 'stab' : 'scrape';
      return wasN(e, 'stab', 2) ? 'scrape' : 'stab';
    }
  },

  looter: {
    name: '强盗', art: 'looter', w: 165, h: 240, hp: [44, 48],
    init: (e) => { e.stolen = 0; },
    moves: {
      mug: {
        name: '抢夺', intent: 'attack', dmg: 10,
        act: async (e) => { const d = await E.attack(e, 10); if (d > 0) E.stealGold(e, 15); }
      },
      lunge: {
        name: '突刺', intent: 'attack', dmg: 12,
        act: async (e) => { const d = await E.attack(e, 12); if (d > 0) E.stealGold(e, 15); }
      },
      smoke_bomb: { name: '烟雾弹', intent: 'defend', act: async (e) => { E.block(e, 6); e.willEscape = true; } },
      escape: { name: '逃跑', intent: 'escape', act: async (e) => { await E.escape(e); } }
    },
    ai: (e) => {
      const n = e.history.length;
      if (e.willEscape) return 'escape';
      if (n < 2) return 'mug';
      if (n === 2) return 'lunge';
      return 'smoke_bomb';
    }
  },

  gremlin_mad: {
    name: '疯狂小鬼', art: 'gremlin', artParam: 'mad', w: 130, h: 150, hp: [20, 24],
    init: (e) => { e.powers.angry = 1; },
    moves: { scratch: { name: '抓挠', intent: 'attack', dmg: 4, act: async (e) => { await E.attack(e, 4); } } },
    ai: () => 'scratch'
  },
  gremlin_sneaky: {
    name: '鬼祟小鬼', art: 'gremlin', artParam: 'sneaky', w: 122, h: 142, hp: [10, 14],
    moves: { puncture: { name: '穿孔', intent: 'attack', dmg: 9, act: async (e) => { await E.attack(e, 9); } } },
    ai: () => 'puncture'
  },
  gremlin_fat: {
    name: '肥胖小鬼', art: 'gremlin', artParam: 'fat', w: 140, h: 155, hp: [13, 17],
    moves: {
      smash: { name: '重砸', intent: 'attackDebuff', dmg: 4, act: async (e) => { await E.attack(e, 4); E.playerPower('weak', 1); } }
    },
    ai: () => 'smash'
  },
  gremlin_shield: {
    name: '盾牌小鬼', art: 'gremlin', artParam: 'shield', w: 130, h: 150, hp: [12, 15],
    moves: {
      protect: {
        name: '保护', intent: 'defend',
        act: async (e) => {
          const others = CB.enemies.filter(x => x.hp > 0 && x !== e);
          const t = others.length ? pick(others) : e;
          E.block(t, 7);
        }
      },
      shield_bash: { name: '盾击', intent: 'attack', dmg: 6, act: async (e) => { await E.attack(e, 6); } }
    },
    ai: (e) => {
      const others = CB.enemies.filter(x => x.hp > 0 && x !== e);
      if (!others.length) return 'shield_bash';
      return was(e, 'protect') ? 'shield_bash' : 'protect';
    }
  },
  gremlin_wizard: {
    name: '小鬼巫师', art: 'gremlin', artParam: 'wizard', w: 132, h: 155, hp: [21, 25],
    init: (e) => { e.charge = 0; },
    moves: {
      charging: { name: '充能', intent: 'unknown', act: async (e) => { e.charge++; } },
      ultimate_blast: {
        name: '终极冲击', intent: 'attack', dmg: 25,
        act: async (e) => { await E.attack(e, 25); e.charge = 0; }
      }
    },
    ai: (e) => (e.charge >= 3 ? 'ultimate_blast' : 'charging')
  },

  /* ============ 精英 ============ */
  gremlin_nob: {
    name: '小鬼头目', art: 'gremlin_nob', w: 240, h: 285, hp: [82, 86], elite: true,
    moves: {
      bellow: { name: '怒吼', intent: 'buff', act: async (e) => { E.power(e, 'enrage', 2); } },
      rush: { name: '猛冲', intent: 'attack', dmg: 14, act: async (e) => { await E.attack(e, 14); } },
      skull_bash: {
        name: '碎颅击', intent: 'attackDebuff', dmg: 6,
        act: async (e) => { await E.attack(e, 6); E.playerPower('vulnerable', 2); }
      }
    },
    ai: (e) => {
      if (!e.history.length) return 'bellow';
      if (rnd() < 0.33) return 'skull_bash';
      return wasN(e, 'rush', 2) ? 'skull_bash' : 'rush';
    }
  },
  lagavulin: {
    name: '拉加维林', art: 'lagavulin', w: 255, h: 205, hp: [109, 111], elite: true,
    init: (e) => { e.powers.asleep = 1; e.powers.metallicize = 8; e.sleepTurns = 0; e.artParam = 'sleep'; },
    moves: {
      sleep: { name: '沉睡', intent: 'sleep', act: async (e) => { e.sleepTurns++; } },
      wake: { name: '苏醒', intent: 'unknown', act: async (e) => { E.wake(e); } },
      attack: { name: '猛击', intent: 'attack', dmg: 18, act: async (e) => { await E.attack(e, 18); } },
      siphon_soul: {
        name: '吸取灵魂', intent: 'debuff',
        act: async () => { E.playerPower('strength', -1); E.playerPower('dexterity', -1); }
      }
    },
    ai: (e) => {
      if (e.powers.asleep) {
        if (e.sleepTurns >= 3) return 'wake';
        return 'sleep';
      }
      const atkCount = e.history.filter(h => h === 'attack').length;
      if (was(e, 'attack') && was(e, 'attack', 2)) return 'siphon_soul';
      return 'attack';
    }
  },
  sentry: {
    name: '哨卫', art: 'sentry', w: 145, h: 250, hp: [38, 42], elite: true,
    init: (e) => { e.powers.artifact = 1; },
    moves: {
      beam: { name: '光束', intent: 'attack', dmg: 9, act: async (e) => { await E.attack(e, 9); } },
      bolt: { name: '螺钉', intent: 'debuff', act: async () => { E.addCard('discard', 'dazed', 2); } }
    },
    ai: (e) => {
      if (!e.history.length) return e.slotIndex % 2 === 1 ? 'beam' : 'bolt';
      return was(e, 'beam') ? 'bolt' : 'beam';
    }
  },

  /* ============ BOSS ============ */
  guardian: {
    name: '守卫者', art: 'guardian', w: 320, h: 285, hp: [240, 240], boss: true,
    init: (e) => {
      e.powers.modeShift = 30; e.shiftThreshold = 30; e.defensive = false;
      e.offIndex = 0; e.defIndex = 0; e.damageTakenThisMode = 0;
    },
    moves: {
      charging_up: { name: '蓄力', intent: 'defend', act: async (e) => { E.block(e, 9); } },
      fierce_bash: { name: '猛烈重击', intent: 'attack', dmg: 32, act: async (e) => { await E.attack(e, 32); } },
      vent_steam: {
        name: '排放蒸汽', intent: 'debuff',
        act: async () => { E.playerPower('weak', 2); E.playerPower('vulnerable', 2); }
      },
      whirlwind: { name: '旋风', intent: 'attack', dmg: 5, hits: 4, act: async (e) => { await E.attackMulti(e, 5, 4); } },
      defensive_mode: {
        name: '防御模式', intent: 'buff',
        act: async (e) => { E.power(e, 'sharpHide', 3); e.defensive = true; e.artParam = 'def'; renderCombat(); }
      },
      roll_attack: { name: '滚动碾压', intent: 'attack', dmg: 9, act: async (e) => { await E.attack(e, 9); } },
      twin_slam: {
        name: '双重猛击', intent: 'attack', dmg: 8, hits: 2,
        act: async (e) => {
          await E.attackMulti(e, 8, 2);
          e.defensive = false; e.artParam = null;
          delete e.powers.sharpHide;
          e.shiftThreshold += 10;
          e.powers.modeShift = e.shiftThreshold;
          e.offIndex = 0;
          renderCombat();
        }
      }
    },
    ai: (e) => {
      if (e.pendingShift) { e.pendingShift = false; return 'defensive_mode'; }
      if (e.defensive) {
        const seq = ['roll_attack', 'twin_slam'];
        const m = seq[e.defIndex % seq.length]; e.defIndex++;
        return m;
      }
      const seq = ['charging_up', 'fierce_bash', 'vent_steam', 'whirlwind'];
      const m = seq[e.offIndex % seq.length]; e.offIndex++;
      return m;
    }
  },

  slime_boss: {
    name: '史莱姆之王', art: 'slime_boss', w: 380, h: 315, hp: [140, 140], boss: true,
    init: (e) => { e.idx = 0; },
    splitInto: ['acid_slime_L', 'spike_slime_L'],
    moves: {
      goop_spray: { name: '黏液喷射', intent: 'debuff', act: async () => { E.addCard('discard', 'slimed', 5); } },
      preparing: { name: '准备', intent: 'unknown', act: async () => { } },
      slam: { name: '猛砸', intent: 'attack', dmg: 35, act: async (e) => { await E.attack(e, 35); } },
      split: { name: '分裂', intent: 'unknown', act: async (e) => { await E.split(e); } }
    },
    ai: (e) => {
      if (e.hp <= e.maxHp / 2 && !e.hasSplit) return 'split';
      const seq = ['goop_spray', 'preparing', 'slam'];
      const m = seq[e.idx % seq.length]; e.idx++;
      return m;
    }
  },

  hexaghost: {
    name: '六火幽魂', art: 'hexaghost', w: 320, h: 330, hp: [250, 250], boss: true,
    init: (e) => { e.idx = 0; e.activated = false; e.burnUp = 0; },
    moves: {
      activate: { name: '激活', intent: 'unknown', act: async (e) => { e.activated = true; } },
      divider: {
        name: '均分', intent: 'attack', hits: 6,
        dmgFn: () => Math.floor(CB.player.hp / 12) + 1,
        act: async (e) => { await E.attackMulti(e, Math.floor(CB.player.hp / 12) + 1, 6); }
      },
      sear: {
        name: '烧灼', intent: 'attackDebuff', dmg: 6,
        act: async (e) => { await E.attack(e, 6); E.addCard('discard', 'burn', 1, e.burnUp); }
      },
      tackle: { name: '猛扑', intent: 'attack', dmg: 5, hits: 2, act: async (e) => { await E.attackMulti(e, 5, 2); } },
      inflame: { name: '炙热', intent: 'attackBuff', act: async (e) => { E.power(e, 'strength', 2); E.block(e, 12); } },
      inferno: {
        name: '烈焰地狱', intent: 'attack', dmg: 2, hits: 6,
        act: async (e) => {
          await E.attackMulti(e, 2, 6);
          E.addCard('discard', 'burn', 3, 1);
          e.burnUp = 1;
        }
      }
    },
    ai: (e) => {
      if (!e.activated) return 'activate';
      if (e.idx === 0) { e.idx++; return 'divider'; }
      const seq = ['sear', 'tackle', 'sear', 'inflame', 'tackle', 'sear', 'inferno'];
      const m = seq[(e.idx - 1) % seq.length]; e.idx++;
      return m;
    }
  }
};

/* ============================================================
   遭遇组合（第一层 · 遗迹）
   ============================================================ */
const ENCOUNTERS = {
  weak: [
    () => ['cultist'],
    () => ['jaw_worm'],
    () => [chance(0.5) ? 'louse_red' : 'louse_green', chance(0.5) ? 'louse_red' : 'louse_green'],
    () => (chance(0.5) ? ['spike_slime_M', 'acid_slime_S'] : ['acid_slime_M', 'spike_slime_S'])
  ],
  strong: [
    () => sample(['gremlin_mad', 'gremlin_sneaky', 'gremlin_fat', 'gremlin_shield', 'gremlin_wizard'], 4),
    () => (chance(0.5) ? ['acid_slime_L'] : ['spike_slime_L']),
    () => ['spike_slime_S', 'spike_slime_S', 'acid_slime_S', 'acid_slime_S', 'spike_slime_S'],
    () => [chance(0.5) ? 'slaver_blue' : 'slaver_red'],
    () => [chance(0.5) ? 'louse_red' : 'louse_green', chance(0.5) ? 'louse_red' : 'louse_green',
    chance(0.5) ? 'louse_red' : 'louse_green'],
    () => ['fungi_beast', 'fungi_beast'],
    () => ['looter'],
    () => [pick(['louse_red', 'louse_green', 'slaver_blue']), pick(['cultist', 'fungi_beast'])],
    () => [pick(['fungi_beast', 'jaw_worm']), pick(['louse_red', 'louse_green'])]
  ],
  elite: [
    () => ['gremlin_nob'],
    () => ['lagavulin'],
    () => ['sentry', 'sentry', 'sentry']
  ],
  boss: [
    () => ['guardian'],
    () => ['slime_boss'],
    () => ['hexaghost']
  ]
};

const BOSS_NAMES = { guardian: '守卫者', slime_boss: '史莱姆之王', hexaghost: '六火幽魂' };

function rollEncounter(kind, avoidLast) {
  const list = ENCOUNTERS[kind];
  let tries = 0, ids;
  do {
    ids = pick(list)();
    tries++;
  } while (tries < 12 && avoidLast && ids.join(',') === avoidLast);
  return ids;
}
