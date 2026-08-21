/* 铁幕1994 — 规则常量 / 地形表 / 战斗数学
 * 1 格 = 500m，1 回合 ≈ 15 分钟，一张卡 = 营属分队（连级）
 */
(function () {
  'use strict';
  var IC = window.IC = window.IC || {};
  var U = IC.Util;

  var R = IC.Rules = {};

  /* ---------------- 地形 ---------------- */
  R.TERRAIN = {
    plain:  { name: '平原',   move: 1,   cover: 0.00, stealth: 0, block: 0, elev: 0, c1: '#8a9a6b', c2: '#7d8d5f' },
    field:  { name: '耕地',   move: 1,   cover: 0.04, stealth: 0, block: 0, elev: 0, c1: '#a8a25f', c2: '#9a9455' },
    steppe: { name: '草原',   move: 1,   cover: 0.02, stealth: 0, block: 0, elev: 0, c1: '#9c9c62', c2: '#8f8f58' },
    grove:  { name: '疏林',   move: 1.5, cover: 0.18, stealth: 2, block: 1, elev: 0, c1: '#5f7a4a', c2: '#547040' },
    forest: { name: '森林',   move: 2,   cover: 0.30, stealth: 3, block: 2, elev: 0, c1: '#3f5c37', c2: '#365130' },
    town:   { name: '城镇',   move: 1.5, cover: 0.40, stealth: 3, block: 2, elev: 0, c1: '#8b8378', c2: '#7d766c', urban: true },
    city:   { name: '城市',   move: 2,   cover: 0.50, stealth: 4, block: 3, elev: 0, c1: '#9a9288', c2: '#857e75', urban: true },
    ruins:  { name: '废墟',   move: 2,   cover: 0.45, stealth: 4, block: 2, elev: 0, c1: '#6f665c', c2: '#615952', urban: true },
    hill:   { name: '丘陵',   move: 2,   cover: 0.15, stealth: 1, block: 1, elev: 1, c1: '#94925e', c2: '#878554' },
    ridge:  { name: '山脊',   move: 3,   cover: 0.25, stealth: 2, block: 3, elev: 2, c1: '#7d7358', c2: '#6e654d' },
    marsh:  { name: '沼泽',   move: 3,   cover: 0.06, stealth: 2, block: 0, elev: 0, c1: '#5d7a6a', c2: '#527060', wet: true },
    river:  { name: '河流',   move: 99,  cover: 0.00, stealth: 0, block: 0, elev: 0, c1: '#3f6b8a', c2: '#37607d', water: true },
    bridge: { name: '桥梁',   move: 1,   cover: 0.05, stealth: 0, block: 0, elev: 0, c1: '#6b6357', c2: '#5e574c', bridge: true },
    ford:   { name: '浅滩',   move: 2,   cover: 0.00, stealth: 0, block: 0, elev: 0, c1: '#4d7b93', c2: '#446f86', wet: true },
    field2: { name: '果园',   move: 1.5, cover: 0.14, stealth: 2, block: 1, elev: 0, c1: '#6d8451', c2: '#617848' },
    airbase:{ name: '机场',   move: 1,   cover: 0.05, stealth: 0, block: 0, elev: 0, c1: '#7e7e78', c2: '#71716b' },
    coast:  { name: '海岸',   move: 1.5, cover: 0.05, stealth: 0, block: 0, elev: 0, c1: '#b8ae86', c2: '#a89f79' },
    sea:    { name: '海面',   move: 99,  cover: 0.00, stealth: 0, block: 0, elev: 0, c1: '#2f5a78', c2: '#28506c', water: true }
  };

  R.CATEGORY = {
    LOG: { name: '后勤指挥', symbol: 'log', order: 8 },
    INF: { name: '步兵',     symbol: 'inf', order: 1 },
    ARM: { name: '装甲',     symbol: 'arm', order: 2 },
    REC: { name: '侦察',     symbol: 'rec', order: 0 },
    SUP: { name: '支援炮兵', symbol: 'sup', order: 3 },
    AA:  { name: '防空',     symbol: 'aa',  order: 4 },
    HEL: { name: '直升机',   symbol: 'hel', order: 5 },
    AIR: { name: '固定翼',   symbol: 'air', order: 6 },
    EW:  { name: '电子战',   symbol: 'ew',  order: 7 },
    TR:  { name: '运输',     symbol: 'tr',  order: 9 }
  };

  R.COUNTRY = {
    USSR: '苏联', GDR: '民主德国', POL: '波兰', CZS: '捷克斯洛伐克', HUN: '匈牙利',
    ROM: '罗马尼亚', BUL: '保加利亚',
    USA: '美国', FRG: '西德', UK: '英国', FRA: '法国', CAN: '加拿大', NLD: '荷兰',
    BEL: '比利时', DEN: '丹麦', ITA: '意大利', ESP: '西班牙', TUR: '土耳其', NOR: '挪威'
  };

  R.MODES = {
    standard91: {
      id: 'standard91', name: '标准模式 · 1991 实编',
      short: '1991',
      era: [1991],
      incomeMult: 1.0, deployMult: 1.0, availMult: 1.0,
      nuke: 'restricted',      // 需要作战决心/授权
      chem: 'restricted',
      endless: false,
      desc: '1991 年双方实际装备与实际编制数量。核与化学武器需要战区授权，预备队有限。'
    },
    advanced94: {
      id: 'advanced94', name: '推演模式 · 1994 进阶装备',
      short: '1994',
      era: [1991, 1994],
      incomeMult: 1.15, deployMult: 1.1, availMult: 1.0,
      nuke: 'restricted',
      chem: 'restricted',
      endless: false,
      desc: '苏联多活数年的合理推演：双方列装了现实中因冷战结束而取消的进阶装备。核与化武仍需授权。'
    },
    endless94: {
      id: 'endless94', name: '无尽模式 · 无限制升级',
      short: '无尽',
      era: [1991, 1994],
      incomeMult: 1.9, deployMult: 1.5, availMult: 99,
      nuke: 'free',
      chem: 'free',
      endless: true,
      desc: '双方放开一切武器使用权限，预备队无穷无尽。核弹、化学弹、温压弹自由使用，直到战场只剩焦土。'
    }
  };

  /* ---------------- 战斗数学参数 ---------------- */
  R.C = {
    baseAP: 6,
    dismountCost: 2,
    fireCostDirect: 2,
    fireCostATGM: 3,
    fireCostArty: 3,
    digCost: 4,
    rallyCostAll: true,
    opportunityPenalty: 0.75,     // 警戒射击命中率乘数
    coverEntrench: [0, 0.10, 0.20, 0.30],
    penDecayPerHex: 0.055,        // AT 弹动能随距离衰减
    penDecayMin: 0.55,
    killBase: 0.07,
    killPerPen: 0.105,
    killMin: 0.02,
    killMax: 0.93,
    softKillBase: 0.10,
    softKillPerHE: 0.030,
    suppressBase: 2.5,
    suppressPerHE: 0.75,
    cohesionMax: 100,
    pinnedAt: 38,
    routAt: 14,
    cohesionRecover: 13,
    rallyRecover: 30,
    radiationDamage: [0, 0.06, 0.13, 0.22],   // 每回合按污染等级造成编制损耗概率
    radiationCohesion: [0, 5, 11, 18],
    nbcMitigation: 0.45,
    airDefenceInterceptBase: 0.30,
    vpPerObjectivePerTurn: 0.6,
    incomeBase: 55,
    incomePerObjective: 22,
    cpPerTurn: 2,
    cpMax: 6
  };

  /* 老兵度 */
  R.vet = function (v) { return window.DATA_VET[v] || window.DATA_VET.trained; };

  /* ---------------- 卡片实例化：套用改装 ---------------- */
  R.buildCard = function (card, modIds, vetOverride) {
    var c = U.deep(card);
    c.mods = [];
    c.stats = c.stats || {};
    var mods = window.DATA_MODS;
    var costAdd = 0, costMult = 1, availShift = 0, vetShift = 0, ammoMult = 1;
    (modIds || []).forEach(function (id) {
      var m = mods[id];
      if (!m) return;
      c.mods.push(id);
      costAdd += (m.cost || 0);
      if (m.costMult) costMult *= m.costMult;
      if (m.availShift) availShift += m.availShift;
      if (m.vetShift) vetShift += m.vetShift;
      if (m.ammoMult) ammoMult *= m.ammoMult;
      if (m.stats) for (var k in m.stats) c.stats[k] = (c.stats[k] || 0) + m.stats[k];
      if (m.traits) c.traits = (c.traits || []).concat(m.traits);
      if (m.addWeapons) c.weapons = (c.weapons || []).concat(U.deep(m.addWeapons));
      if (m.weaponPatch) {
        m.weaponPatch.forEach(function (p) {
          (c.weapons || []).forEach(function (w) {
            if (w.kind !== p.match) return;
            if (p.pen) w.pen += p.pen;
            if (p.he) w.he += p.he;
            if (p.acc) w.acc = Math.min(0.95, w.acc + p.acc);
            if (p.rmax) w.rmax += p.rmax;
            if (p.ammoMult) w.ammo = Math.round(w.ammo * p.ammoMult);
          });
        });
      }
      if (m.nuke) c.hasNukeLoadout = true;
    });
    if (ammoMult !== 1) (c.weapons || []).forEach(function (w) { w.ammo = Math.round(w.ammo * ammoMult); });

    /* 老兵度 */
    var order = window.DATA_VET_ORDER;
    var vi = order.indexOf(vetOverride || c.vet || 'trained');
    if (vi < 0) vi = 1;
    vi = U.clamp(vi + vetShift, 0, order.length - 1);
    c.vet = order[vi];
    var vd = R.vet(c.vet);

    c.baseCost = card.cost;
    c.cost = Math.max(10, Math.round((card.cost + costAdd) * costMult * vd.costMult));
    c.avail = Math.max(1, Math.round((card.avail || 2) * vd.availMult) + availShift);
    c.traits = (c.traits || []).filter(function (t, i, a) { return a.indexOf(t) === i; });
    return c;
  };

  R.hasTrait = function (u, t) { return !!(u && u.traits && u.traits.indexOf(t) >= 0); };

  /* ---------------- 装甲面 ---------------- */
  R.armorFacing = function (target, fromHex) {
    var facing = target.facing == null ? 0 : target.facing;
    var dirFromTarget = IC.Hex.dirTo({ q: target.q, r: target.r }, fromHex);
    var rel = ((dirFromTarget - facing) % 6 + 6) % 6;
    if (rel === 0 || rel === 1 || rel === 5) return { arc: 'front', label: '正面' };
    if (rel === 3) return { arc: 'rear', label: '后方' };
    return { arc: 'side', label: '侧面' };
  };

  R.armorValue = function (card, arc) {
    var s = card.stats || {};
    var f = s.armorF || 0, sd = s.armorS != null ? s.armorS : Math.max(0, f - 8);
    if (arc === 'front') return f;
    if (arc === 'side') return sd;
    if (arc === 'rear') return Math.max(0, Math.round(sd * 0.6));
    if (arc === 'top') return s.armorT != null ? s.armorT : Math.max(0, Math.round(sd * 0.45));
    return f;
  };

  R.isArmored = function (card) { return (card.stats && (card.stats.armorF || 0) >= 4); };
  R.isAir = function (card) { return card.category === 'AIR' || card.category === 'HEL'; };

  R.terrain = function (t) { return R.TERRAIN[t] || R.TERRAIN.plain; };

  return R;
})();
