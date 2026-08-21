/* ===================================================================
   relics.js — Roguelite 遗物池
   每件遗物只做两件事：改数值（apply）或打开某个开关（stats 字段）
   稀有度：common(常见) / rare(稀有) / curse(诅咒 —— 强但有代价)
   =================================================================== */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const U = G.U;

  const R = (id, name, tier, sigil, desc, apply, opt) => Object.assign({
    id: id, name: name, tier: tier, sigil: sigil, desc: desc, apply: apply,
    stackable: true, weight: tier === 'common' ? 10 : (tier === 'rare' ? 4.2 : 2.6),
  }, opt || {});

  const ALL = [
    /* ---------------- 常见 ---------------- */
    R('whetstone', '磨刃石', 'common', '✦',
      '巨剑伤害 +20%。铁块磨得再利，也还是块铁。',
      (s, k) => { s.dmg *= 1 + 0.20 * k; }),

    R('ironArm', '铁腕', 'common', '⚔',
      '挥砍速度 +15%。手臂的肌肉早已不属于人类。',
      (s, k) => { s.swingSpeed *= 1 + 0.15 * k; }),

    R('longHaft', '延柄改造', 'common', '⌁',
      '攻击距离 +20%，扇形 +8%。',
      (s, k) => { s.range *= 1 + 0.20 * k; s.arc *= 1 + 0.08 * k; }),

    R('butcher', '屠夫之扇', 'common', '◈',
      '挥砍扇形 +32%，更容易一刀多杀。',
      (s, k) => { s.arc *= 1 + 0.32 * k; }),

    R('bloodDrink', '血饮', 'common', '✚',
      '造成伤害的 5% 转化为生命。',
      (s, k) => { s.lifesteal += 0.05 * k; }),

    R('heartEater', '食心者', 'common', '❂',
      '每次击杀回复 5 点生命。',
      (s, k) => { s.killHeal += 5 * k; }),

    R('hidePlate', '兽皮护胸', 'common', '⛨',
      '生命上限 +28。',
      (s, k) => { s.maxHp += 28 * k; }),

    R('swiftBoots', '疾行靴', 'common', '▲',
      '移动速度 +13%。',
      (s, k) => { s.moveSpeed *= 1 + 0.13 * k; }),

    R('lightFeet', '轻身', 'common', '✧',
      '冲刺消耗 -40%，体力回复 +30%。',
      (s, k) => { s.dashCost *= Math.pow(0.6, k); s.staminaRegen *= 1 + 0.3 * k; }),

    R('keenEdge', '锐利', 'common', '✹',
      '暴击率 +9%。',
      (s, k) => { s.crit += 0.09 * k; }),

    R('boneBreaker', '碎骨', 'common', '☠',
      '暴击伤害 +0.7 倍。',
      (s, k) => { s.critMul += 0.7 * k; }),

    R('brutalForce', '蛮力', 'common', '●',
      '击退 +70%，重斩冲击波范围 +25%。',
      (s, k) => { s.knock *= 1 + 0.7 * k; s.heavyShock *= 1 + 0.25 * k; }),

    R('boneArmor', '骨甲', 'common', '⛨',
      '受到伤害减少 13%。',
      (s, k) => { s.armor += 0.13 * k; }),

    R('slowMend', '缓愈', 'common', '✚',
      '每秒回复 0.9 点生命。',
      (s, k) => { s.regen += 0.9 * k; }),

    R('poolDrinker', '血泊之饮', 'common', '◈',
      '踩过地面血泊时回复生命（3 点 / 次）。血是自己人的也一样。',
      (s, k) => { s.bloodHeal += 3 * k; }),

    R('madnessAmp', '狂气增幅', 'common', '✠',
      '狂气积累 +45%。',
      (s, k) => { s.rageGain *= 1 + 0.45 * k; }),

    R('abyssEye', '深渊之瞳', 'common', '✧',
      '获得的魂 +45%，吸取范围提升。',
      (s, k) => { s.soulMul *= 1 + 0.45 * k; s.magnet += 1.2 * k; }),

    R('heavyPress', '重压', 'common', '⚔',
      '重斩伤害 +0.7 倍。',
      (s, k) => { s.heavyMul += 0.7 * k; }),

    /* ---------------- 稀有 ---------------- */
    R('executioner', '处刑人', 'rare', '☠',
      '对生命低于 25% 的敌人造成 3 倍伤害。',
      (s, k) => { s.executeThreshold = Math.max(s.executeThreshold, 0.25 + 0.08 * (k - 1)); },
      { stackable: false }),

    R('fleshBomb', '血肉炸弹', 'rare', '❂',
      '击杀时尸体爆开，对周围造成伤害并炸出更多血肉。',
      (s, k) => { s.explodeOnKill += k; }),

    R('comboFervor', '连斩狂热', 'rare', '✹',
      '每层连斩额外 +5% 伤害（原为 3.5%）。',
      (s, k) => { s.comboDmg += 0.05 * k; }),

    R('apostleHeart', '使徒之心', 'rare', '✚',
      '生命上限 +45，每秒回复 0.6。',
      (s, k) => { s.maxHp += 45 * k; s.regen += 0.6 * k; }),

    R('thornMail', '反刺之棘', 'rare', '◈',
      '受伤时对周围敌人反弹 70% 伤害。',
      (s, k) => { s.thorns += 0.7 * k; }),

    R('undyingBrand', '不死之烙', 'rare', '✠',
      '致死伤害触发一次复活（45% 生命）。每轮一次。',
      (s, k) => { s.revive += 1; }, { stackable: false }),

    R('bloodCrown', '血之王冠', 'rare', '⚔',
      '伤害 +35%，但生命上限 -22。',
      (s, k) => { s.dmg *= 1 + 0.35 * k; s.maxHp -= 22 * k; }),

    R('endlessRage', '无尽狂气', 'rare', '✠',
      '狂气持续 +7 秒，狂气期间伤害加成 +30%。',
      (s, k) => { s.berserkTime += 7 * k; s.berserkDmg += 0.30 * k; }),

    R('thousandEdge', '千刃', 'rare', '⌁',
      '挥砍速度 +34%，伤害 -12%。',
      (s, k) => { s.swingSpeed *= 1 + 0.34 * k; s.dmg *= Math.pow(0.88, k); }),

    R('giantGrip', '巨人之握', 'rare', '●',
      '攻击距离 +40%、击退 +120%，但挥砍速度 -14%。',
      (s, k) => { s.range *= 1 + 0.40 * k; s.knock *= 1 + 1.2 * k; s.swingSpeed *= Math.pow(0.86, k); }),

    R('purge', '净血', 'rare', '❂',
      '每次击杀回复 8% 最大生命。',
      (s, k) => { s.gibHeal += 0.08 * k; }),

    R('soulMagnet', '灵魂磁石', 'rare', '✧',
      '魂获取 +30%，吸取范围大幅提升，重斩冲击波 +20%。',
      (s, k) => { s.soulMul *= 1 + 0.3 * k; s.magnet += 2.5 * k; s.heavyShock *= 1 + 0.2 * k; }),

    /* ---------------- 诅咒 ---------------- */
    R('berserkerArmor', '狂战士盔甲', 'curse', '⛧',
      '伤害 +50%、挥砍速度 +28%。但你会持续失血，且更容易受伤。',
      (s, k) => {
        s.dmg *= 1 + 0.50 * k; s.swingSpeed *= 1 + 0.28 * k;
        s.curseDrain += 1.0 * k; s.armor -= 0.12 * k;
        s.regen -= 0.6 * k;
      }, { stackable: false }),

    R('sacrifice', '献祭', 'curse', '⛧',
      '伤害 +40%，生命上限 -32。',
      (s, k) => { s.dmg *= 1 + 0.40 * k; s.maxHp -= 32 * k; }),

    R('eclipsePact', '蚀之契约', 'curse', '⛧',
      '伤害 +55%，生命上限 -25%。日蚀不会白给东西。',
      (s, k) => { s.dmg *= 1 + 0.55 * k; s.maxHp *= Math.pow(0.75, k); }),

    R('serpentEye', '蛇眼', 'curse', '⛧',
      '暴击率 +28%、暴击伤害 +1.2 倍，受到伤害 +22%。',
      (s, k) => { s.crit += 0.28 * k; s.critMul += 1.2 * k; s.armor -= 0.22 * k; }),

    R('numbFlesh', '无痛之躯', 'curse', '⛧',
      '受到伤害减少 26%，但移动速度 -12%、挥砍速度 -8%。',
      (s, k) => { s.armor += 0.26 * k; s.moveSpeed *= Math.pow(0.88, k); s.swingSpeed *= Math.pow(0.92, k); }),

    R('crimsonThirst', '猩红渴望', 'curse', '⛧',
      '吸血 +12%，但每秒流失 0.8 生命。',
      (s, k) => { s.lifesteal += 0.12 * k; s.regen -= 0.8 * k; }),
  ];

  const byId = {};
  ALL.forEach(r => byId[r.id] = r);

  const Relics = {
    ALL: ALL,
    byId(id) { return byId[id]; },

    /* 抽取 n 张候选卡
       depth 越深越容易出稀有 / 诅咒；luck 提升稀有权重 */
    roll(n, rng, owned, depth, luck) {
      rng = rng || U.rng;
      owned = owned || [];
      const ownedCount = {};
      owned.forEach(r => ownedCount[r.id] = (ownedCount[r.id] || 0) + (r.stacks || 1));

      const pool = ALL.filter(r => {
        if (!r.stackable && ownedCount[r.id]) return false;
        if ((ownedCount[r.id] || 0) >= 4) return false;
        return true;
      });

      const depthF = U.clamp((depth || 1) / 12, 0, 1);
      const out = [];
      const used = {};
      let guard = 0;
      while (out.length < n && guard++ < 400) {
        // 稀有度权重
        const items = pool.filter(r => !used[r.id]).map(r => {
          let w = r.weight;
          if (r.tier === 'rare') w *= 0.65 + depthF * 1.6 + (luck || 0) * 0.5;
          if (r.tier === 'curse') w *= 0.35 + depthF * 1.9;
          return { r: r, weight: w };
        });
        if (!items.length) break;
        const pick = rng.weighted(items).r;
        used[pick.id] = true;
        const inst = Object.assign({}, pick);
        inst.owned = ownedCount[pick.id] || 0;
        out.push(inst);
      }
      return out;
    },

    /* 血祭坛的交易 */
    shrineOffer(type, rng, player) {
      if (type === 'heal') {
        return {
          type: 'heal',
          title: '枯萎的血祭坛',
          text: '献上 15 魂，换回 45% 生命。',
          cost: 15,
          can: (p) => p.souls >= 15 && p.hp < p.maxHp,
        };
      }
      if (type === 'souls') {
        return {
          type: 'souls',
          title: '贪食的血祭坛',
          text: '献上 25% 当前生命，换取 60 魂。',
          cost: 0,
          can: (p) => p.hp > p.maxHp * 0.3,
        };
      }
      return {
        type: 'relicForHp',
        title: '低语的血祭坛',
        text: '献上 30% 生命上限，换取一件遗物。',
        cost: 0,
        can: (p) => p.maxHp > 45,
      };
    },
  };

  G.Relics = Relics;
})();
