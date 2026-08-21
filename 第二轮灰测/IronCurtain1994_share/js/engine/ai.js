/* 铁幕1994 — AI 指挥官（自动构筑卡组 + 战场决策 + 超限战/核决心） */
(function () {
  'use strict';
  var IC = window.IC;
  var U = IC.Util, Hex = IC.Hex, R = IC.Rules, B = IC.Battle;
  var AI = IC.AI = {};

  IC.DeckRules = {
    maxSlots: 20,
    maxSupport: 4,
    maxOps: 3,
    minCategories: { REC: 1, LOG: 1 }
  };

  AI.pool = function (side, mode) {
    var all = side === 'WP' ? (window.DATA_UNITS_WP || []) : (window.DATA_UNITS_NATO || []);
    var eras = R.MODES[mode] ? R.MODES[mode].era : [1991];
    return all.filter(function (c) { return c.category !== 'TR' && eras.indexOf(c.era) >= 0; });
  };

  /* ---------- 自动构筑卡组 ---------- */
  AI.buildDeck = function (side, mode, doctrine, rng, opts) {
    opts = opts || {};
    rng = rng || new IC.RNG(777);
    var pool = AI.pool(side, mode);
    var slots = (opts.slots || IC.DeckRules.maxSlots);
    doctrine = doctrine || { ARM: 0.28, INF: 0.28, SUP: 0.15, REC: 0.08, AA: 0.11, HEL: 0.06, AIR: 0.02, EW: 0.02 };
    var byCat = {};
    pool.forEach(function (c) { (byCat[c.category] = byCat[c.category] || []).push(c); });
    var cards = [];
    /* 必备 */
    ['LOG', 'REC'].forEach(function (cat) {
      if (byCat[cat] && byCat[cat].length) cards.push({ cardId: rng.pick(byCat[cat]).id, mods: [] });
    });
    var guard = 0;
    while (cards.length < slots && guard++ < 400) {
      var roll = rng.next(), acc = 0, chosenCat = 'INF';
      for (var cat in doctrine) {
        acc += doctrine[cat];
        if (roll <= acc) { chosenCat = cat; break; }
      }
      var listing = byCat[chosenCat];
      if (!listing || !listing.length) continue;
      var c = rng.pick(listing);
      if (cards.filter(function (x) { return x.cardId === c.id; }).length >= 2) continue;
      /* 随机挂 0-2 项改装 */
      var mods = [];
      var avail = (c.mods || []).filter(function (m) {
        var def = window.DATA_MODS[m];
        return def && (!def.era || R.MODES[mode].era.indexOf(def.era) >= 0);
      });
      var nMods = rng.int(0, Math.min(2, avail.length));
      for (var i = 0; i < nMods; i++) {
        var m = rng.pick(avail);
        if (m && mods.indexOf(m) < 0) mods.push(m);
      }
      var vet = null;
      if (rng.chance(0.18)) vet = 'veteran';
      else if (rng.chance(0.16)) vet = 'recruit';
      cards.push({ cardId: c.id, mods: mods, vet: vet });
    }
    /* 支援与超限战 */
    var sups = (window.DATA_SUPPORT || []).filter(function (s) {
      return (s.side === 'ANY' || s.side === side) && R.MODES[mode].era.indexOf(s.era) >= 0;
    });
    var support = [];
    var prefer = ['sup_arty_152', 'sup_arty_155', 'sup_mlrs_wp', 'sup_mlrs_nato', 'sup_arty_120', 'sup_recon_flight', 'sup_smoke', 'sup_air_cas', 'sup_smerch', 'sup_atacms', 'sup_tos1'];
    prefer.forEach(function (id) {
      if (support.length >= IC.DeckRules.maxSupport) return;
      if (sups.some(function (s) { return s.id === id; })) support.push(id);
    });
    if (R.MODES[mode].nuke === 'free' || opts.nukeDeck) {
      support = support.slice(0, 3);
      support.push(rng.chance(0.5) ? 'sup_nuke_arty' : 'sup_nuke_missile');
    }
    var ops = [];
    var opPool = (window.DATA_HYBRID.battleOps || []).filter(function (o) { return o.effect !== 'resolve'; });
    while (ops.length < IC.DeckRules.maxOps && opPool.length) {
      var o = rng.pick(opPool);
      if (ops.indexOf(o.id) < 0) ops.push(o.id);
    }
    return { cards: cards, support: support, ops: ops };
  };

  /* ---------- 部署 ---------- */
  AI.deployHexes = function (st, side) {
    return (st.map.deploy[side] || []).filter(function (k) {
      var p = Hex.parse(k);
      return !B.unitAt(st, p.q, p.r);
    });
  };

  AI.frontValue = function (st, side, key) {
    var p = Hex.parse(key);
    var objs = st.map.objectives.filter(function (o) { return o.owner !== side; });
    if (!objs.length) objs = st.map.objectives;
    var best = 99;
    objs.forEach(function (o) { best = Math.min(best, Hex.dist(p, o)); });
    return best;
  };

  AI.pickDeployHex = function (st, side, preferFront) {
    var hexes = AI.deployHexes(st, side);
    if (!hexes.length) return null;
    hexes.sort(function (a, b) { return AI.frontValue(st, side, a) - AI.frontValue(st, side, b); });
    if (preferFront) return Hex.parse(hexes[0]);
    var idx = Math.floor(st.rng.next() * Math.min(hexes.length, 6));
    return Hex.parse(hexes[idx]);
  };

  AI.needs = function (st, side) {
    var mine = B.living(st, side);
    var foe = side === 'NATO' ? 'WP' : 'NATO';
    var seen = B.living(st, foe).filter(function (u) { return u.spotted[side]; });
    var need = {};
    var enemyArmor = seen.filter(function (u) { return R.isArmored(B.eff(u)); }).length;
    var enemyAir = seen.filter(function (u) { return u.card.category === 'AIR' || u.card.category === 'HEL'; }).length;
    var myAT = mine.filter(function (u) {
      return (B.eff(u).weapons || []).some(function (w) { return (w.kind === 'AT' || w.kind === 'ATGM') && w.pen >= 12; });
    }).length;
    var myAA = mine.filter(function (u) { return u.card.category === 'AA'; }).length;
    var myArty = mine.filter(function (u) {
      return (B.eff(u).weapons || []).some(function (w) { return w.kind === 'ARTY'; });
    }).length;
    var myRec = mine.filter(function (u) { return u.card.category === 'REC'; }).length;
    need.ARM = 1.0 + (enemyArmor > myAT ? 0.5 : 0);
    need.INF = 1.0;
    need.SUP = myArty < 2 ? 1.4 : 0.5;
    need.AA = (enemyAir > 0 && myAA < 2) ? 1.8 : (myAA < 1 ? 0.9 : 0.3);
    need.REC = myRec < 2 ? 1.3 : 0.3;
    need.HEL = 0.7; need.AIR = 0.5; need.EW = 0.4; need.LOG = mine.some(function (u) { return u.card.category === 'LOG'; }) ? 0.15 : 0.9;
    return need;
  };

  AI.deployWave = function (st, side, reserveRatio) {
    var s = st.sides[side];
    var need = AI.needs(st, side);
    var budget = s.points * (1 - (reserveRatio == null ? 0.25 : reserveRatio));
    var placed = [];
    var guard = 0;
    while (budget > 60 && guard++ < 30) {
      var candidates = s.deck.filter(function (d) {
        if (!st.mode.endless && d.used >= d.avail) return false;
        if (st.mode.era.indexOf(d.card.era) < 0) return false;
        return d.card.cost <= budget;
      });
      if (!candidates.length) break;
      candidates.sort(function (a, b) {
        var av = (need[a.card.category] || 0.5) * (1 + (a.card.cost / 400)) * (0.75 + st.rng.next() * 0.5);
        var bv = (need[b.card.category] || 0.5) * (1 + (b.card.cost / 400)) * (0.75 + st.rng.next() * 0.5);
        return bv - av;
      });
      var pick = candidates[0];
      var hex = AI.pickDeployHex(st, side, pick.card.category === 'ARM' || pick.card.category === 'REC');
      if (!hex) break;
      var res = B.deploy(st, side, s.deck.indexOf(pick), hex.q, hex.r);
      if (!res.ok) { guard += 3; continue; }
      budget -= res.cost;
      placed.push(res.unit);
    }
    return placed;
  };

  AI.initialDeploy = function (st, side) {
    AI.deployWave(st, side, 0.35);
    B.living(st, side).forEach(function (u) { u.ap = u.maxAp; });
    B.recomputeVisibility(st);
  };

  /* ---------- 目标评估 ---------- */
  AI.targetValue = function (st, u, t) {
    var w = B.bestWeapon(st, u, t);
    if (!w) return -1;
    var hc = B.hitChance(st, u, t, w.w, {});
    var kc = B.killChance(st, u, t, w.w);
    var expect = hc * kc.p * (w.w.rof || 1);
    var val = 1;
    var cat = t.card.category;
    if (cat === 'SUP' || cat === 'LOG' || cat === 'EW') val = 1.8;
    if (cat === 'AA') val = 1.5;
    if (cat === 'ARM') val = 1.3;
    if (cat === 'REC') val = 1.1;
    if (t.str <= 2) val *= 1.5;
    val *= (t.card.cost || 100) / 130;
    return expect * val;
  };

  AI.bestTarget = function (st, u) {
    var foe = u.side === 'NATO' ? 'WP' : 'NATO';
    var best = null, bestV = 0;
    B.living(st, foe).forEach(function (t) {
      if (!t.spotted[u.side]) return;
      var v = AI.targetValue(st, u, t);
      if (v > bestV) { bestV = v; best = t; }
    });
    return best ? { unit: best, value: bestV } : null;
  };

  AI.objectiveFor = function (st, u, side) {
    var objs = st.map.objectives.slice();
    var wanted = objs.filter(function (o) { return o.owner !== side; });
    if (!wanted.length) wanted = objs;
    wanted.sort(function (a, b) {
      return (Hex.dist(u, a) - a.vp * 1.5) - (Hex.dist(u, b) - b.vp * 1.5);
    });
    return wanted[0];
  };

  /* ---------- 单位行动 ---------- */
  AI.actUnit = function (st, u, skill) {
    if (u.dead) return;
    var eff = B.eff(u);
    var isArty = (eff.weapons || []).some(function (w) { return w.kind === 'ARTY'; });
    var isAA = u.card.category === 'AA';
    var isRec = u.card.category === 'REC';
    var isAir = u.card.category === 'AIR' || u.card.category === 'HEL';

    /* 溃散/低凝聚力：整顿 */
    if (u.state === 'routed' || (u.cohesion < 45 && st.rng.chance(0.6))) {
      B.rally(st, u);
      return;
    }
    var guard = 0;
    while (u.ap > 0 && guard++ < 6 && !u.dead) {
      var tgt = AI.bestTarget(st, u);
      /* 火力优先 */
      if (tgt && tgt.value > 0.05) {
        var w = B.bestWeapon(st, u, tgt.unit);
        if (w && u.ap >= B.fireCost(w.w)) {
          var rep = B.attack(st, u, tgt.unit, w.index, {});
          if (rep.ok) {
            if (rep.kills > 0) {
              B.log(st, u.side === st.playerSide ? 'good' : 'bad',
                '🎯 ' + u.short + ' → ' + tgt.unit.short + '：' + rep.hits + ' 发命中，' + rep.kills + ' 个编制被毁（' +
                (rep.arc === 'soft' ? '软目标' : rep.arc === 'front' ? '正面' : rep.arc === 'side' ? '侧面' : rep.arc === 'rear' ? '后方' : '顶部') + '）。');
            }
            continue;
          }
        }
      }
      /* 炮兵/防空：原地待机或构筑 */
      if ((isArty || isAA) && !tgt) {
        if (u.entrench < 2 && u.ap >= R.C.digCost) { B.digIn(st, u); continue; }
        break;
      }
      /* 机动 */
      var obj = AI.objectiveFor(st, u, u.side);
      if (!obj) break;
      var reach = B.reachable(st, u);
      var keys = Object.keys(reach.cells);
      if (!keys.length) break;
      var bestKey = null, bestScore = -Infinity;
      var defensive = st.mission && st.mission.role === 'defend' && u.side === st.playerSide;
      keys.forEach(function (k) {
        var cell = reach.cells[k];
        var h = st.map.at(cell.q, cell.r);
        if (!h) return;
        var terr = R.terrain(h.t);
        var d = Hex.dist(cell, obj);
        var score = -d * (isRec ? 0.8 : 1.4);
        score += terr.cover * (isRec ? 4 : 6);
        score -= (h.rad || 0) * 2.2;
        if (h.road) score += 0.4;
        if (isAir) score += 0;
        /* 侦察兵不冲锋 */
        var foe = u.side === 'NATO' ? 'WP' : 'NATO';
        var threat = 0;
        B.living(st, foe).forEach(function (t) {
          if (!t.spotted[u.side]) return;
          var td = Hex.dist(cell, t);
          if (td <= 2) threat += 3;
          else if (td <= 4) threat += 1.2;
        });
        score -= threat * (isRec || isArty ? 2.2 : (u.cohesion < 60 ? 1.4 : 0.6));
        if (h.rad >= 2 && !R.hasTrait(eff, 'nbc')) score -= 4;
        score += st.rng.next() * (3 - skill * 0.3);
        if (bestScore < score) { bestScore = score; bestKey = k; }
      });
      if (!bestKey) break;
      var cur = Hex.key(u.q, u.r);
      if (bestKey === cur) {
        if (u.entrench < (defensive ? 3 : 1) && u.ap >= R.C.digCost) { B.digIn(st, u); continue; }
        break;
      }
      var mv = B.moveUnit(st, u, bestKey);
      if (!mv.ok) break;
    }
  };

  /* ---------- 支援与超限战 ---------- */
  AI.findCluster = function (st, side, radius, friendlyWeight) {
    var foe = side === 'NATO' ? 'WP' : 'NATO';
    var seen = B.living(st, foe).filter(function (u) { return u.spotted[side]; });
    if (!seen.length) return null;
    var fw = friendlyWeight == null ? 2.5 : friendlyWeight;
    var best = null, bestN = 0;
    seen.forEach(function (c) {
      var n = 0, value = 0;
      seen.forEach(function (o) {
        if (Hex.dist(c, o) <= radius) { n++; value += (o.card.cost || 100) / 100; }
      });
      /* 避免砸到自己人 */
      var friendly = 0;
      B.living(st, side).forEach(function (f) { if (Hex.dist(c, f) <= radius) friendly++; });
      var score = value - friendly * fw;
      if (score > bestN) { bestN = score; best = { q: c.q, r: c.r, n: n, score: score, friendly: friendly }; }
    });
    return best;
  };

  AI.doSupport = function (st, side, skill) {
    var s = st.sides[side];
    var spec = (st.mission && st.mission.specials) || {};
    /* 核打击决策 */
    if (s.nukeAuth && !s.truceBlock) {
      var nukeSup = s.support.filter(function (x) {
        return x.def.kind === 'nuke' && B.supportAvailable(st, side, x) && s.points >= x.def.cost;
      })[0];
      if (nukeSup) {
        /* 无尽模式下双方对附带损伤毫不在意 */
        var fw = st.mode.endless ? 0.4 : (st.escalation >= 4 ? 1.2 : 2.5);
        var cl = AI.findCluster(st, side, nukeSup.def.radius, fw);
        var desperate = s.vp + 8 < st.sides[side === 'NATO' ? 'WP' : 'NATO'].vp || st.turn > st.maxTurns * 0.6;
        var threshold = st.mode.endless ? 1.4 : (st.escalation >= 3 ? 2.4 : 3.2);
        var willing = st.mode.endless ? st.rng.chance(0.65)
          : (desperate ? st.rng.chance(0.5 + (spec.enemyNukeChance || 0.15)) : st.rng.chance(spec.enemyNukeChance || 0.15));
        if (cl && cl.score >= threshold && willing) {
          B.callSupport(st, side, nukeSup.id, cl.q, cl.r);
        }
      }
    } else if (!s.nukeAuth && st.mode.nuke !== 'free') {
      /* 敌方 AI 也会下达作战决心 */
      var info = B.authChance(st, side);
      if (info.anyMet && s.cp >= 2 && st.rng.chance((spec.enemyNukeChance || 0.1) * 0.8 + st.escalation * 0.03)) {
        B.requestAuthorization(st, side);
      }
    }
    /* 常规火力 */
    var tries = skill >= 4 ? 2 : 1;
    for (var i = 0; i < tries; i++) {
      var options = s.support.filter(function (x) {
        return x.def.kind !== 'nuke' && x.def.kind !== 'smoke' && x.def.kind !== 'recon' &&
          B.supportAvailable(st, side, x) && s.points >= x.def.cost * 1.2;
      });
      if (!options.length) break;
      options.sort(function (a, b) { return (b.def.he || 0) * (b.def.radius || 1) - (a.def.he || 0) * (a.def.radius || 1); });
      var sup = options[0];
      if (sup.def.restricted === 'chem' && !s.chemAuth) continue;
      var cluster = AI.findCluster(st, side, sup.def.radius);
      if (cluster && cluster.score >= 1.6) B.callSupport(st, side, sup.id, cluster.q, cluster.r);
      else break;
    }
    /* 侦察通场 */
    var recon = s.support.filter(function (x) { return x.def.kind === 'recon' && B.supportAvailable(st, side, x); })[0];
    var foe = side === 'NATO' ? 'WP' : 'NATO';
    var visible = B.living(st, foe).filter(function (u) { return u.spotted[side]; }).length;
    if (recon && visible < 3 && s.points > recon.def.cost * 2) {
      var obj = st.map.objectives.filter(function (o) { return o.owner !== side; })[0] || st.map.objectives[0];
      if (obj) B.callSupport(st, side, recon.id, obj.q, obj.r);
    }
  };

  AI.doOps = function (st, side, skill) {
    var s = st.sides[side];
    if (s.cp < 1) return;
    var cluster = AI.findCluster(st, side, 2);
    var pool = s.ops.filter(function (o) {
      return o.def.effect !== 'resolve' && s.points >= Math.round(o.def.cost * (s.modifiers.opsCostMult || 1)) && s.cp >= (o.def.cp || 1);
    });
    if (!pool.length) return;
    /* 优先级：情报 → 压制 → 破袭 */
    var foe = side === 'NATO' ? 'WP' : 'NATO';
    var visible = B.living(st, foe).filter(function (u) { return u.spotted[side]; }).length;
    var order = visible < 2 ? ['sigint', 'maskirovka', 'jam', 'psyops', 'sabotage', 'finance', 'cyber', 'radar', 'decap', 'decoy']
      : ['jam', 'psyops', 'radar', 'cyber', 'decap', 'sabotage', 'finance', 'sigint', 'decoy', 'maskirovka'];
    for (var i = 0; i < order.length; i++) {
      var candidate = pool.filter(function (o) { return o.def.effect === order[i]; })[0];
      if (!candidate) continue;
      var needsTarget = (candidate.def.radius || 0) > 0;
      if (needsTarget && !cluster) continue;
      var q = needsTarget ? cluster.q : 0, r = needsTarget ? cluster.r : 0;
      if (candidate.def.effect === 'decoy') {
        var hexP = AI.pickDeployHex(st, side, true);
        if (!hexP) continue;
        q = hexP.q; r = hexP.r;
      }
      var res = B.useOp(st, side, candidate.id, q, r);
      if (res && res.ok) return;
    }
  };

  /* ---------- 完整 AI 回合 ---------- */
  AI.takeTurn = function (st, side) {
    var skill = (st.mission && st.mission.aiSkill) || 2;
    var s = st.sides[side];
    /* 先火力准备与超限战，再投入预备队（否则分值会被部署吃光） */
    AI.doOps(st, side, skill);
    AI.doSupport(st, side, skill);
    var reserve = st.mode.endless ? 0.05 : U.clamp(0.45 - skill * 0.06, 0.1, 0.45);
    AI.deployWave(st, side, reserve);
    /* 单位行动：炮兵/防空先打，装甲后动 */
    var units = B.living(st, side).slice();
    units.sort(function (a, b) {
      var oa = (R.CATEGORY[a.card.category] || {}).order || 5;
      var ob = (R.CATEGORY[b.card.category] || {}).order || 5;
      return (ob >= 3 ? -1 : 1) - (oa >= 3 ? -1 : 1) || oa - ob;
    });
    units.forEach(function (u) {
      if (u.dead) return;
      try { AI.actUnit(st, u, skill); } catch (e) { /* 保底：单个单位出错不中断回合 */ }
    });
    B.recomputeVisibility(st);
    B.checkObjectives(st);
  };
})();
