/* 铁幕1994 — 战斗引擎（无 DOM 依赖，可在 node 中做无头模拟）
 * 回合结构：部署 → 玩家行动 → 敌方行动 → 回合结算
 */
(function () {
  'use strict';
  var IC = window.IC;
  var U = IC.Util, Hex = IC.Hex, R = IC.Rules;
  var B = IC.Battle = {};

  /* ================= 建立战斗 ================= */
  B.create = function (cfg) {
    var mode = R.MODES[cfg.mode] || R.MODES.standard91;
    var st = {
      cfg: cfg,
      mode: mode,
      modeId: mode.id,
      playerSide: cfg.playerSide,
      enemySide: cfg.playerSide === 'NATO' ? 'WP' : 'NATO',
      mission: cfg.mission || {},
      map: cfg.map || IC.MapGen.generate(cfg.mapDef || { profile: 'skirmish_plain', seed: 1234 }),
      turn: 1,
      maxTurns: (cfg.mission && cfg.mission.turns) || 16,
      phase: 'deploy',
      active: cfg.playerSide,
      units: [],
      nextUnitId: 1,
      pending: [],
      effects: [],
      log: [],
      escalation: (cfg.mission && cfg.mission.specials && cfg.mission.specials.escalationStart) || 0,
      doomsday: cfg.doomsday || 0,
      over: false,
      result: null,
      rng: new IC.RNG((cfg.seed || 8675309) ^ 0x5f3a),
      sides: {}
    };

    /* 作战态势加成：进攻方需要兵力优势（3:1 法则的简化体现） */
    var _role = (cfg.mission && cfg.mission.role) || 'meeting';
    var posture = { player: 1, enemy: 1 };
    if (_role === 'attack' || _role === 'finale') { posture.player = 1.22; posture.enemy = 0.98; }
    else if (_role === 'defend') { posture.player = 1.0; posture.enemy = 1.2; }
    st.posture = posture;

    ['NATO', 'WP'].forEach(function (side) {
      var isPlayer = side === cfg.playerSide;
      var deck = (isPlayer ? cfg.playerDeck : cfg.enemyDeck) || { cards: [], support: [], ops: [] };
      var strat = (isPlayer ? cfg.strategic : cfg.enemyStrategic) || {};
      var pm = isPlayer ? posture.player : posture.enemy;
      var budget = isPlayer ? (cfg.mission && cfg.mission.budget) : (cfg.mission && cfg.mission.enemyBudget);
      var income = isPlayer ? (cfg.mission && cfg.mission.income) : (cfg.mission && cfg.mission.enemyIncome);
      var s = {
        side: side,
        isPlayer: isPlayer,
        points: Math.round(((budget || 1000) * pm + (strat.deployBonus || 0)) * mode.deployMult),
        incomeBase: Math.round((income || R.C.incomeBase) * pm * mode.incomeMult * (strat.incomeMult || 1)),
        cp: R.C.cpPerTurn,
        vp: 0,
        deck: [],
        support: [],
        ops: [],
        nukeAuth: mode.nuke === 'free' || !!strat.nukePreAuth || !!(cfg.mission && cfg.mission.specials && cfg.mission.specials.bothNukeAuth),
        chemAuth: mode.chem === 'free' || !!strat.chemAuth,
        authCooldown: 0,
        authTried: 0,
        nukesUsed: 0,
        chemUsed: 0,
        killed: 0, lost: 0,
        strengthCommitted: 0, strengthLost: 0,
        reserveDelay: 0,
        strat: strat,
        modifiers: { incomeMult: 1, opsCostMult: strat.opsCostMult || 1 },
        deployedCount: 0
      };
      /* 卡组 */
      (deck.cards || []).forEach(function (e, i) {
        var raw = B.findCard(e.cardId);
        if (!raw) return;
        var built = R.buildCard(raw, e.mods, e.vet);
        var avail = built.avail + (strat.availMod || 0);
        if (mode.endless) avail = 999;
        s.deck.push({
          idx: i, cardId: e.cardId, card: built, avail: Math.max(1, avail), used: 0,
          mods: (e.mods || []).slice(), vet: built.vet,
          transportId: e.transport !== undefined ? e.transport : raw.transport
        });
      });
      /* 支援 */
      var supIds = deck.support || [];
      supIds.forEach(function (id) {
        var sup = (window.DATA_SUPPORT || []).filter(function (x) { return x.id === id; })[0];
        if (!sup) return;
        if (mode.era.indexOf(sup.era) < 0) return;
        s.support.push({ id: id, def: sup, used: 0, max: mode.endless ? 99 : 3 });
      });
      /* 超限战指令 */
      var opIds = (deck.ops || []).slice();
      (strat.unlockOps || []).forEach(function (o) { if (opIds.indexOf(o) < 0) opIds.push(o); });
      if (opIds.indexOf('op_resolve') < 0) opIds.push('op_resolve');
      if (opIds.indexOf('op_sigint') < 0 && side === cfg.playerSide) opIds.push('op_sigint');
      opIds.forEach(function (id) {
        var op = (window.DATA_HYBRID.battleOps || []).filter(function (x) { return x.id === id; })[0];
        if (op) s.ops.push({ id: id, def: op, used: 0 });
      });
      st.sides[side] = s;
    });

    /* 敌方战略层削弱效果作用到本方 */
    ['NATO', 'WP'].forEach(function (side) {
      var foe = st.sides[side === 'NATO' ? 'WP' : 'NATO'];
      var strat = foe.strat || {};
      var s = st.sides[side];
      if (strat.enemyIncomeMult) s.modifiers.incomeMult *= strat.enemyIncomeMult;
      if (strat.enemyAvailMod) s.deck.forEach(function (d) { if (!st.mode.endless) d.avail = Math.max(1, d.avail + strat.enemyAvailMod); });
      s.startCohesionMod = (strat.enemyCohesion || 0);
      s.aaAccMod = (strat.enemyAaAcc || 0);
      s.opticsMod = (strat.enemyOpticsMod || 0);
      s.apMod = (strat.enemyApMod || 0);
      s.reserveDelay = (strat.enemyReserveDelay || 0);
      s.nukeResist = (strat.enemyNukeResist || 0);
      s.artyScatter = (strat.enemyArtyScatter || 0);
      s.fuelMod = (strat.enemyFuelMod || 0);
    });

    /* 目标点初始归属 */
    var role = (cfg.mission && cfg.mission.role) || 'meeting';
    var pSide = cfg.playerSide, eSide = st.enemySide;
    st.map.objectives.forEach(function (o, i) {
      if (role === 'defend') o.owner = pSide;
      else if (role === 'attack' || role === 'finale') {
        var col = st.map.at(o.q, o.r) ? st.map.at(o.q, o.r).col : 0;
        var half = st.map.w / 2;
        var westIsPlayer = st.map.sides.west === pSide;
        var playerNear = westIsPlayer ? col < half * 0.55 : col > st.map.w - half * 0.55;
        o.owner = playerNear ? pSide : eSide;
      } else o.owner = i % 2 === 0 ? pSide : eSide;
      o.origin = o.owner;
    });

    /* 开局情报/破袭 */
    var pstrat = st.sides[pSide].strat || {};
    if (pstrat.initialIntel) B.addEffect(st, { kind: 'sigint', side: pSide, q: 0, r: 0, radius: 99, until: st.turn + 1 });
    st.targets = B.computeTargets(st);

    B.log(st, 'system', '战斗开始 · ' + st.map.name + ' · ' + mode.name);
    if (st.sides[pSide].nukeAuth) B.log(st, 'nuke', '⚠ 本方开局已持有战区核释放权限。');
    return st;
  };

  B.findCard = function (id) {
    var pools = [window.DATA_UNITS_WP || [], window.DATA_UNITS_NATO || []];
    for (var i = 0; i < pools.length; i++) {
      for (var j = 0; j < pools[i].length; j++) if (pools[i][j].id === id) return pools[i][j];
    }
    return null;
  };

  B.allCards = function () { return (window.DATA_UNITS_WP || []).concat(window.DATA_UNITS_NATO || []); };

  B.log = function (st, kind, text) {
    st.log.push({ turn: st.turn, kind: kind, text: text });
    if (st.log.length > 400) st.log.shift();
    if (st.onLog) st.onLog(st.log[st.log.length - 1]);
  };

  /* ================= 单位 ================= */
  B.spawnUnit = function (st, side, deckEntry, q, r, opts) {
    opts = opts || {};
    var card = deckEntry.card;
    var mountCard = null;
    if (card.category === 'INF' && deckEntry.transportId && !opts.foot) {
      var raw = B.findCard(deckEntry.transportId);
      if (raw) mountCard = R.buildCard(raw, [], raw.vet);
    }
    var vd = R.vet(card.vet);
    var faceDir = st.map.sides.west === side ? 0 : 3;
    var u = {
      id: 'u' + (st.nextUnitId++),
      side: side,
      cardId: card.id,
      card: card,
      name: card.name,
      short: card.short || card.name,
      q: q, r: r,
      facing: faceDir,
      maxStr: card.strength || 10,
      str: card.strength || 10,
      cohesion: U.clamp(60 + (card.stats.morale || 8) * 4 + vd.cohesion + (st.sides[side].startCohesionMod || 0), 20, 100),
      ap: 0, maxAp: R.C.baseAP,
      ammo: (card.weapons || []).map(function (w) { return w.ammo || 10; }),
      mountCard: mountCard,
      mounted: !!mountCard,
      entrench: (R.hasTrait(card, 'dug_in') ? 2 : 0),
      state: 'ok',
      fuel: card.stats.fuel || (card.category === 'AIR' ? 3 : (card.category === 'HEL' ? 6 : 99)),
      firedThisTurn: false, reacted: false, movedThisTurn: 0,
      spotted: { NATO: false, WP: false },
      arriving: true,
      kills: 0
    };
    if (card.category === 'AIR') u.sortie = 3;
    u.maxAp = B.unitMaxAP(st, u);
    u.ap = opts.freshAp ? u.maxAp : Math.floor(u.maxAp / 2);
    st.units.push(u);
    st.sides[side].deployedCount++;
    st.sides[side].strengthCommitted += u.maxStr;
    return u;
  };

  B.unitMaxAP = function (st, u) {
    var ap = R.C.baseAP;
    if (u.card.category === 'AIR') ap = 8;
    if (u.card.category === 'HEL') ap = 7;
    ap += (st.sides[u.side].apMod || 0);
    if (B.hasEffectAt(st, u.q, u.r, 'jam', u.side)) ap -= 1;
    if (u.state === 'pinned') ap -= 2;
    if (u.state === 'routed') ap = Math.max(2, ap - 3);
    return U.clamp(ap, 1, 12);
  };

  /* 当前有效卡（乘车时用载具属性做机动/装甲） */
  B.eff = function (u) {
    if (u.mounted && u.mountCard) {
      return {
        stats: u.mountCard.stats, weapons: u.mountCard.weapons, traits: (u.mountCard.traits || []).concat(u.card.traits || []),
        category: 'TR', name: u.card.name + '（乘车）', mountedInf: u.card
      };
    }
    return u.card;
  };

  B.moveAllowance = function (st, u) {
    var e = B.eff(u);
    var mv = (e.stats.move || 5);
    if (u.side && st.sides[u.side].fuelMod) mv += st.sides[u.side].fuelMod;
    if (u.state === 'pinned') mv = Math.floor(mv * 0.6);
    if (u.state === 'routed') mv = Math.floor(mv * 0.8);
    if (u.cohesion < 55) mv = Math.floor(mv * 0.85);
    return Math.max(1, mv);
  };

  B.unitAt = function (st, q, r) {
    for (var i = 0; i < st.units.length; i++) {
      var u = st.units[i];
      if (!u.dead && u.q === q && u.r === r) return u;
    }
    return null;
  };
  B.unitsAt = function (st, q, r) {
    return st.units.filter(function (u) { return !u.dead && u.q === q && u.r === r; });
  };
  B.living = function (st, side) {
    return st.units.filter(function (u) { return !u.dead && (!side || u.side === side); });
  };

  /* ================= 视野 ================= */
  B.terrainAt = function (st, q, r) {
    var h = st.map.at(q, r);
    return h ? R.terrain(h.t) : R.TERRAIN.plain;
  };

  B.losBlocked = function (st, a, b) {
    var line = Hex.line(a, b);
    var block = 0;
    var startElev = B.terrainAt(st, a.q, a.r).elev + (B.eff({ card: {}, mounted: false }) ? 0 : 0);
    for (var i = 1; i < line.length - 1; i++) {
      var h = st.map.at(line[i].q, line[i].r);
      if (!h) continue;
      var t = R.terrain(h.t);
      block += t.block;
      if (t.elev > startElev + 1) block += 2;
      if (h.smoke > 0) block += 2;
    }
    return block >= 3;
  };

  B.spotRange = function (st, u, target) {
    var e = B.eff(u);
    var optics = (e.stats.optics || 4) + (st.sides[u.side].opticsMod || 0);
    if (R.hasTrait(e, 'radar')) optics += 2;
    if (R.hasTrait(e, 'sigint')) optics += 3;
    var th = st.map.at(target.q, target.r);
    var terr = th ? R.terrain(th.t) : R.TERRAIN.plain;
    var te = B.eff(target);
    var stealth = (te.stats.stealth || 2) + terr.stealth + (target.entrench || 0);
    if (target.firedThisTurn) stealth -= 3;
    if (target.movedThisTurn > 0) stealth -= 2;
    if (target.card.category === 'AIR') stealth -= 4;
    if (R.hasTrait(te, 'stealth_air')) stealth += 5;
    if (th && th.smoke > 0) stealth += 3;
    var range = optics - Math.max(0, stealth) + 6;
    if (terr.elev) range -= terr.elev;
    return Math.max(1, range);
  };

  B.recomputeVisibility = function (st) {
    var i, u;
    for (i = 0; i < st.units.length; i++) {
      st.units[i].spotted.NATO = false;
      st.units[i].spotted.WP = false;
    }
    /* SIGINT 全场揭示 */
    var fullSight = { NATO: false, WP: false };
    st.effects.forEach(function (ef) {
      if (ef.kind === 'sigint' && ef.until >= st.turn) fullSight[ef.side] = true;
    });
    for (i = 0; i < st.units.length; i++) {
      u = st.units[i];
      if (u.dead) continue;
      u.spotted[u.side] = true;
      var foe = u.side === 'NATO' ? 'WP' : 'NATO';
      if (fullSight[foe]) { u.spotted[foe] = true; u.lastSeenTurn = st.turn; continue; }
      var observers = B.living(st, foe);
      for (var j = 0; j < observers.length; j++) {
        var o = observers[j];
        var d = Hex.dist(o, u);
        if (d > B.spotRange(st, o, u)) continue;
        if (u.card.category !== 'AIR' && B.losBlocked(st, o, u)) continue;
        u.spotted[foe] = true;
        u.lastSeenTurn = st.turn;   // 供渲染层绘制「最后已知位置」
        break;
      }
    }
  };

  B.visibleTo = function (st, u, side) { return u.side === side || u.spotted[side]; };

  /* ================= 效果 ================= */
  B.addEffect = function (st, ef) { st.effects.push(ef); return ef; };
  B.hasEffectAt = function (st, q, r, kind, targetSide) {
    for (var i = 0; i < st.effects.length; i++) {
      var ef = st.effects[i];
      if (ef.kind !== kind || ef.until < st.turn) continue;
      if (targetSide && ef.side === targetSide) continue; // 只作用于敌方
      if (ef.radius >= 99) return ef;
      if (Hex.dist({ q: q, r: r }, { q: ef.q, r: ef.r }) <= ef.radius) return ef;
    }
    return null;
  };
  B.cleanEffects = function (st) {
    st.effects = st.effects.filter(function (ef) { return ef.until >= st.turn; });
  };

  /* ================= 移动 ================= */
  B.moveCost = function (st, u, from, to) {
    var h = st.map.at(to.q, to.r);
    if (!h) return Infinity;
    var e = B.eff(u);
    var terr = R.terrain(h.t);
    if (e.category === 'AIR' || u.card.category === 'AIR' || u.card.category === 'HEL') return 1;
    if (terr.water) {
      if (h.t === 'sea') return Infinity;
      if (!R.hasTrait(e, 'amphibious')) return Infinity;
      return 3;
    }
    var cost = terr.move;
    if (terr.wet && R.isArmored(e)) cost += 1;
    var fh = st.map.at(from.q, from.r);
    if (h.road && fh && fh.road) cost = Math.max(0.5, cost * 0.5);
    if (R.hasTrait(e, 'mine_plow')) cost = Math.max(0.5, cost - 0.5);
    var occupant = B.unitAt(st, to.q, to.r);
    if (occupant && !occupant.dead) {
      if (occupant.side !== u.side) return Infinity;
      return Infinity; // 一格一单位
    }
    return cost;
  };

  B.reachable = function (st, u) {
    var budget = B.moveAllowance(st, u);
    var start = Hex.key(u.q, u.r);
    var dist = {}; dist[start] = 0;
    var prev = {};
    var frontier = [{ q: u.q, r: u.r, c: 0 }];
    var out = {};
    while (frontier.length) {
      frontier.sort(function (a, b) { return a.c - b.c; });
      var cur = frontier.shift();
      var ck = Hex.key(cur.q, cur.r);
      if (dist[ck] < cur.c) continue;
      Hex.neighbors(cur.q, cur.r).forEach(function (n) {
        var cost = B.moveCost(st, u, cur, n);
        if (!isFinite(cost)) return;
        /* 敌军接触摩擦 */
        var friction = 0;
        var foe = u.side === 'NATO' ? 'WP' : 'NATO';
        Hex.neighbors(n.q, n.r).forEach(function (nn) {
          var e2 = B.unitAt(st, nn.q, nn.r);
          if (e2 && e2.side === foe && B.visibleTo(st, e2, u.side)) friction = 1;
        });
        var nc = cur.c + cost + friction;
        var nk = Hex.key(n.q, n.r);
        if (nc <= budget && (dist[nk] === undefined || nc < dist[nk])) {
          dist[nk] = nc; prev[nk] = ck;
          out[nk] = { q: n.q, r: n.r, cost: nc };
          frontier.push({ q: n.q, r: n.r, c: nc });
        }
      });
    }
    return { cells: out, prev: prev, start: start };
  };

  B.pathTo = function (reach, key) {
    var path = [], cur = key;
    var guard = 0;
    while (cur && cur !== reach.start && guard++ < 200) {
      path.unshift(Hex.parse(cur));
      cur = reach.prev[cur];
    }
    return path;
  };

  B.moveUnit = function (st, u, targetKey) {
    if (u.dead || u.ap <= 0) return { ok: false, msg: '该单位已无行动点' };
    if (u.state === 'routed') return { ok: false, msg: '部队已溃散，只能整顿或撤退' };
    var reach = B.reachable(st, u);
    if (!reach.cells[targetKey]) return { ok: false, msg: '超出机动范围' };
    var path = B.pathTo(reach, targetKey);
    var events = [];
    for (var i = 0; i < path.length; i++) {
      var step = path[i];
      var prev = { q: u.q, r: u.r };
      u.facing = Hex.dirTo(prev, step);
      u.q = step.q; u.r = step.r;
      u.movedThisTurn++;
      B.recomputeVisibility(st);
      /* 警戒射击 */
      var react = B.opportunityFire(st, u);
      events = events.concat(react);
      if (u.dead || u.state === 'routed') break;
    }
    var used = reach.cells[targetKey] ? reach.cells[targetKey].cost : 0;
    u.ap = Math.max(0, u.ap - Math.max(1, Math.round(used / Math.max(1, B.moveAllowance(st, u)) * 3)));
    var h = st.map.at(u.q, u.r);
    if (h && h.rad > 0) B.log(st, 'warn', u.short + ' 进入 ' + h.rad + ' 级污染区。');
    u.entrench = 0;
    B.recomputeVisibility(st);
    B.checkObjectives(st);
    return { ok: true, events: events, path: path };
  };

  /* 警戒射击：敌方单位在移动中被有余力的单位反应射击 */
  B.opportunityFire = function (st, mover) {
    var foe = mover.side === 'NATO' ? 'WP' : 'NATO';
    var res = [];
    var defenders = B.living(st, foe);
    for (var i = 0; i < defenders.length; i++) {
      var d = defenders[i];
      if (d.reacted || d.ap < 1 || d.state === 'routed') continue;
      if (!B.visibleTo(st, mover, foe)) continue;
      var best = B.bestWeapon(st, d, mover);
      if (!best) continue;
      d.reacted = true;
      var rep = B.attack(st, d, mover, best.index, { opportunity: true });
      if (rep && rep.ok) {
        res.push(rep);
        B.log(st, 'combat', '⚡ 警戒射击：' + d.short + ' → ' + mover.short +
          '（命中 ' + rep.hits + '，毁伤 ' + rep.kills + '）');
      }
      if (mover.dead) break;
    }
    return res;
  };

  /* ================= 射击 ================= */
  B.weaponUsable = function (st, u, w, wi, target) {
    var e = B.eff(u);
    var ammo = u.ammo[wi];
    if (u.mounted && u.mountCard) ammo = u.ammo[wi] === undefined ? 10 : u.ammo[wi];
    if (ammo !== undefined && ammo <= 0) return false;
    var d = Hex.dist(u, target);
    if (d < (w.rmin || 0) || d > w.rmax) return false;
    var tAir = target.card.category === 'AIR' || target.card.category === 'HEL';
    if (tAir && !w.air) return false;
    if (!tAir && w.kind === 'AA' && !w.ground) return false;
    if (w.kind === 'NUKE' && !st.sides[u.side].nukeAuth) return false;
    if (w.kind === 'ARTY' && B.hasEffectAt(st, u.q, u.r, 'jam', u.side)) return false;
    if (B.hasEffectAt(st, u.q, u.r, 'radar', u.side) && (w.kind === 'AA' || R.hasTrait(e, 'radar'))) return false;
    if (w.kind !== 'ARTY' && target.card.category !== 'AIR' && B.losBlocked(st, u, target)) return false;
    return true;
  };

  B.weaponList = function (st, u) {
    var e = B.eff(u);
    return (e.weapons || []).map(function (w, i) { return { w: w, index: i }; });
  };

  B.bestWeapon = function (st, u, target) {
    var list = B.weaponList(st, u), best = null, bestScore = -1;
    var te = B.eff(target);
    var armored = R.isArmored(te);
    for (var i = 0; i < list.length; i++) {
      var w = list[i].w;
      if (!B.weaponUsable(st, u, w, list[i].index, target)) continue;
      var score;
      if (armored) score = (w.pen || 0) * 2 + (w.he || 0) * 0.2;
      else score = (w.he || 0) * 2 + (w.pen || 0) * 0.2;
      score *= (w.acc || 0.5) * (w.rof || 1);
      if (w.kind === 'NUKE') score *= 0.2; // 只有明确指定才用核
      if (score > bestScore) { bestScore = score; best = list[i]; }
    }
    return best;
  };

  B.fireCost = function (w) {
    if (w.kind === 'ATGM') return R.C.fireCostATGM;
    if (w.kind === 'ARTY') return R.C.fireCostArty;
    if (w.kind === 'NUKE') return 4;
    return R.C.fireCostDirect;
  };

  B.hitChance = function (st, u, target, w, opts) {
    var e = B.eff(u), te = B.eff(target);
    var d = Hex.dist(u, target);
    var acc = w.acc || 0.5;
    acc += R.vet(u.card.vet).acc;
    /* 距离 */
    if (w.kind === 'ATGM') acc *= 1 - 0.025 * Math.max(0, d - (w.rmin || 1));
    else if (w.kind === 'ARTY' || w.kind === 'BOMB') acc *= 1 - 0.01 * d;
    else acc *= 1 - 0.075 * Math.max(0, d - 1);
    /* 观瞄 vs 隐蔽 */
    var th = st.map.at(target.q, target.r);
    var terr = th ? R.terrain(th.t) : R.TERRAIN.plain;
    var optics = (e.stats.optics || 4) + (st.sides[u.side].opticsMod || 0);
    var stealth = (te.stats.stealth || 2) + terr.stealth;
    acc += U.clamp((optics - stealth) * 0.022, -0.28, 0.16);
    /* 掩体与构筑 */
    var cover = terr.cover + R.C.coverEntrench[U.clamp(target.entrench, 0, 3)];
    acc *= (1 - cover * 0.85);
    if (th && th.smoke > 0) acc *= 0.55;
    /* 目标运动 / 压制状态 */
    if (target.movedThisTurn > 2) acc *= 0.9;
    if (target.state === 'pinned') acc *= 1.15;
    if (u.state === 'pinned') acc *= 0.65;
    if (u.movedThisTurn > 0 && w.kind !== 'ARTY') acc *= 0.85;
    /* 电子战 */
    if (B.hasEffectAt(st, u.q, u.r, 'jam', u.side)) acc *= 0.85;
    if (w.air) acc += (st.sides[u.side].aaAccMod || 0);
    if (R.hasTrait(te, 'era') && w.kind === 'ATGM') acc *= 0.94;
    if ((te.stats.ecm || 0) > 0 && (w.kind === 'ATGM')) acc *= (1 - U.clamp((te.stats.ecm || 0) * 0.05, 0, 0.45));
    if (opts && opts.opportunity) acc *= R.C.opportunityPenalty;
    if (target.card.category === 'AIR' && w.kind === 'AA') acc *= 1.0;
    /* 士气/凝聚力 */
    acc *= U.lerp(0.6, 1.05, U.clamp(u.cohesion / 100, 0, 1));
    return U.clamp(acc, 0.02, 0.95);
  };

  B.killChance = function (st, u, target, w, arcOverride) {
    var te = B.eff(target);
    var armored = R.isArmored(te);
    if (!armored) {
      var th = st.map.at(target.q, target.r);
      var terr = th ? R.terrain(th.t) : R.TERRAIN.plain;
      var cover = terr.cover + R.C.coverEntrench[U.clamp(target.entrench, 0, 3)];
      var p = R.C.softKillBase + R.C.softKillPerHE * (w.he || 2) + (w.pen || 0) * 0.006;
      if (terr.urban && !R.hasTrait(te, 'engineer')) p *= 0.8;
      p *= (1 - cover * 0.75);
      if (w.kind === 'AT' && (te.stats.armorF || 0) <= 1) p *= 0.55; // 穿甲弹打步兵效率低
      return { p: U.clamp(p, 0.02, 0.85), arc: 'soft', armor: 0, pen: w.pen || 0 };
    }
    var arc = arcOverride || R.armorFacing(target, { q: u.q, r: u.r }).arc;
    if (w.kind === 'ARTY' || w.kind === 'BOMB' || w.kind === 'NUKE' || R.hasTrait(B.eff(u), 'cluster')) arc = 'top';
    if (w.kind === 'ATGM' && R.hasTrait(B.eff(u), 'laser_guided')) arc = 'top';
    var armor = R.armorValue(te, arc);
    if (R.hasTrait(te, 'era') && (w.kind === 'ATGM' || w.kind === 'BOMB')) armor += 2;
    var pen = (w.pen || 0);
    var d = Hex.dist(u, target);
    if (w.kind === 'AT') pen *= Math.max(R.C.penDecayMin, 1 - R.C.penDecayPerHex * Math.max(0, d - 1));
    var pp = R.C.killBase + R.C.killPerPen * (pen - armor);
    if (w.he >= 16) pp += 0.06;
    return { p: U.clamp(pp, R.C.killMin, R.C.killMax), arc: arc, armor: armor, pen: Math.round(pen) };
  };

  B.attack = function (st, u, target, weaponIdx, opts) {
    opts = opts || {};
    if (u.dead || target.dead) return { ok: false, msg: '目标无效' };
    var e = B.eff(u);
    var w = (e.weapons || [])[weaponIdx];
    if (!w) return { ok: false, msg: '没有该武器' };
    if (!B.weaponUsable(st, u, w, weaponIdx, target)) return { ok: false, msg: '该武器无法射击此目标' };
    var cost = opts.opportunity ? 1 : B.fireCost(w);
    if (!opts.free && u.ap < cost) return { ok: false, msg: '行动点不足' };
    if (!opts.free) u.ap -= cost;
    u.firedThisTurn = true;
    if (u.mounted && u.card.category === 'INF' && !opts.opportunity) { /* 车载射击允许 */ }

    var shots = Math.max(1, opts.opportunity ? Math.ceil((w.rof || 1) / 2) : (w.rof || 1));
    if (u.ammo[weaponIdx] !== undefined) shots = Math.min(shots, u.ammo[weaponIdx]);
    var hits = 0, kills = 0, supp = 0;
    var hc = B.hitChance(st, u, target, w, opts);
    var kcInfo = B.killChance(st, u, target, w);
    /* 核武器：区域效果 */
    if (w.kind === 'NUKE') {
      var rep0 = B.detonateNuke(st, u.side, { q: target.q, r: target.r }, { radius: 2, power: w.he || 60, source: u.short });
      if (u.ammo[weaponIdx] !== undefined) u.ammo[weaponIdx] -= 1;
      return { ok: true, nuke: true, hits: 1, kills: rep0.kills, text: rep0.text };
    }
    for (var s = 0; s < shots; s++) {
      if (target.dead) break;
      if (st.rng.chance(hc)) {
        hits++;
        supp += R.C.suppressBase + R.C.suppressPerHE * (w.he || 2);
        if (st.rng.chance(kcInfo.p)) { kills++; B.damage(st, target, 1, u); }
      } else {
        supp += 0.6;
      }
    }
    if (u.ammo[weaponIdx] !== undefined) u.ammo[weaponIdx] = Math.max(0, u.ammo[weaponIdx] - shots);
    /* 压制 */
    B.suppress(st, target, supp * (1 + (R.hasTrait(e, 'shock') ? 0.15 : 0)));
    if (kills > 0) u.kills += kills;
    if (st.onFx) st.onFx(kills > 0 ? 'kill' : (hits > 0 ? 'hit' : 'spot'), target.q, target.r, w.name);
    /* 反击（同格相邻的直射对抗）：被攻击方若有余力则还击一次 */
    if (!opts.opportunity && !opts.noReturn && !target.dead && target.state !== 'routed' && Hex.dist(u, target) <= 2) {
      var rw = B.bestWeapon(st, target, u);
      if (rw && target.ap >= 1 && st.rng.chance(0.55)) {
        target.ap = Math.max(0, target.ap - 1);
        B.attack(st, target, u, rw.index, { opportunity: true, noReturn: true });
      }
    }
    return {
      ok: true, shots: shots, hits: hits, kills: kills, hitChance: hc, killChance: kcInfo.p,
      arc: kcInfo.arc, armor: kcInfo.armor, pen: kcInfo.pen, weapon: w.name,
      attacker: u.short, target: target.short
    };
  };

  B.damage = function (st, target, amount, source) {
    target.str -= amount;
    st.sides[target.side].strengthLost += amount;
    var src = (source && st.sides[source.side]) ? st.sides[source.side] : null;
    if (target.str <= 0) {
      target.dead = true;
      target.str = 0;
      st.sides[target.side].lost++;
      if (src) {
        src.killed++;
        src.vp += 0.6 + (target.card.cost || 100) / 300;   // 歼敌胜利分
      }
      B.log(st, target.side === st.playerSide ? 'bad' : 'good',
        '💀 ' + target.short + '（' + (target.side === 'NATO' ? '北约' : '华约') + '）被歼灭。');
      B.checkObjectives(st);
    }
  };

  B.suppress = function (st, target, amount) {
    if (!amount) return;
    var e = B.eff(target);
    var res = 1 - U.clamp(((e.stats.morale || 8) - 6) * 0.06, 0, 0.35);
    if (R.hasTrait(e, 'shock')) res *= 0.85;
    target.cohesion = U.clamp(target.cohesion - amount * res, 0, R.C.cohesionMax);
    B.updateState(st, target);
  };

  B.updateState = function (st, u) {
    var old = u.state;
    if (u.cohesion <= R.C.routAt) u.state = 'routed';
    else if (u.cohesion <= R.C.pinnedAt) u.state = 'pinned';
    else u.state = 'ok';
    if (old !== u.state && u.state !== 'ok') {
      B.log(st, u.side === st.playerSide ? 'bad' : 'good',
        (u.state === 'routed' ? '🏳 ' + u.short + ' 部队溃散，脱离接触！' : '⚠ ' + u.short + ' 被压制。'));
    }
  };

  /* ================= 支援打击 ================= */
  B.supportAvailable = function (st, side, sup) {
    var s = st.sides[side];
    if (sup.def.restricted === 'nuke' && !s.nukeAuth) return false;
    if (sup.def.restricted === 'chem' && !s.chemAuth) return false;
    if (!st.mode.endless && sup.used >= sup.max) return false;
    return true;
  };

  B.callSupport = function (st, side, supId, q, r) {
    var s = st.sides[side];
    var sup = s.support.filter(function (x) { return x.id === supId; })[0];
    if (!sup) return { ok: false, msg: '没有该支援手段' };
    if (!B.supportAvailable(st, side, sup)) return { ok: false, msg: '该支援不可用（需授权或已用尽）' };
    var cost = Math.round(sup.def.cost * (st.mode.endless ? 0.6 : 1));
    if (s.points < cost) return { ok: false, msg: '分值不足（需要 ' + cost + '）' };
    if (B.hasEffectAt(st, q, r, 'cyber', side)) return { ok: false, msg: '火力指挥系统遭数据链攻击，无法呼叫支援' };
    s.points -= cost;
    sup.used++;
    var scatter = (s.artyScatter || 0);
    st.pending.push({
      side: side, kind: 'support', id: supId, def: sup.def,
      q: q, r: r, arriveTurn: st.turn + (sup.def.delay || 0) + (sup.def.delay ? 0 : 0),
      scatter: scatter, immediate: !sup.def.delay
    });
    B.log(st, side === st.playerSide ? 'good' : 'warn',
      '📞 ' + (side === 'NATO' ? '北约' : '华约') + ' 呼叫「' + sup.def.name + '」，坐标 ' +
      B.hexName(st, q, r) + (sup.def.delay ? '，' + sup.def.delay + ' 回合后弹着。' : '，立即弹着。'));
    if (!sup.def.delay) B.resolvePending(st, side, true);
    return { ok: true, cost: cost };
  };

  B.hexName = function (st, q, r) {
    var h = st.map.at(q, r);
    if (!h) return '(' + q + ',' + r + ')';
    var obj = st.map.objectives.filter(function (o) { return o.q === q && o.r === r; })[0];
    if (obj) return obj.label + '「' + obj.name + '」';
    return String.fromCharCode(65 + (h.col % 26)) + '-' + (h.row + 1);
  };

  B.resolvePending = function (st, side, onlyImmediate) {
    var keep = [];
    st.pending.forEach(function (p) {
      if (p.side !== side) { keep.push(p); return; }
      if (onlyImmediate && !p.immediate) { keep.push(p); return; }
      if (!onlyImmediate && p.arriveTurn > st.turn) { keep.push(p); return; }
      B.executeStrike(st, p);
    });
    st.pending = keep;
  };

  B.executeStrike = function (st, p) {
    var def = p.def;
    var center = { q: p.q, r: p.r };
    /* 散布 */
    if (p.scatter) {
      var ring = Hex.ring(p.q, p.r, p.scatter);
      center = st.rng.pick(ring) || center;
    }
    if (def.kind === 'smoke') {
      Hex.spiral(center.q, center.r, def.radius).forEach(function (h) {
        var hx = st.map.at(h.q, h.r); if (hx) hx.smoke = 2;
      });
      B.log(st, 'system', '🌫 ' + B.hexName(st, center.q, center.r) + ' 区域被烟幕覆盖。');
      B.recomputeVisibility(st);
      return;
    }
    if (def.kind === 'recon') {
      B.addEffect(st, { kind: 'sigint', side: p.side, q: center.q, r: center.r, radius: 99, until: st.turn + 1 });
      B.log(st, 'system', '🛩 侦察通场完成：敌军位置暴露。');
      B.recomputeVisibility(st);
      return;
    }
    if (def.kind === 'nuke') {
      B.detonateNuke(st, p.side, center, { radius: def.radius, power: def.he, source: def.name, yieldKt: def.yieldKt });
      return;
    }
    /* 空袭需要突破防空 */
    var shots = def.shots || 4;
    if (def.kind === 'airstrike') {
      var intercept = B.airDefenceCheck(st, p.side, center);
      if (intercept.aborted) {
        B.log(st, p.side === st.playerSide ? 'bad' : 'good',
          '✈ 空中支援被防空火力逼退（' + intercept.text + '）。');
        return;
      }
      shots = Math.max(1, Math.round(shots * intercept.mult));
    }
    var targets = [];
    Hex.spiral(center.q, center.r, def.radius).forEach(function (h) {
      B.unitsAt(st, h.q, h.r).forEach(function (u) { targets.push(u); });
    });
    if (!targets.length) {
      B.log(st, 'system', '💥 ' + def.name + ' 弹着 ' + B.hexName(st, center.q, center.r) + '，未命中任何部队。');
      B.markStrikeHexes(st, center, def);
      return;
    }
    var killTotal = 0;
    var w = {
      name: def.name, kind: def.chem ? 'HE' : 'ARTY', pen: def.pen || 6, he: def.he || 12,
      acc: 0.72, rmin: 0, rmax: 99, rof: 1
    };
    var virtualAttacker = {
      q: center.q, r: center.r, side: p.side, cohesion: 100, movedThisTurn: 0,
      card: { vet: 'trained', category: 'SUP', stats: { optics: 8, stealth: 0 }, traits: def.cluster ? ['cluster'] : [] },
      ammo: [], short: def.name
    };
    targets.forEach(function (t) {
      var perTarget = Math.max(1, Math.round(shots / Math.max(1, targets.length * 0.6)));
      for (var i = 0; i < perTarget; i++) {
        if (t.dead) break;
        var hc = 0.55 + (def.cluster ? 0.1 : 0);
        var te = B.eff(t);
        var th = st.map.at(t.q, t.r);
        var terr = th ? R.terrain(th.t) : R.TERRAIN.plain;
        hc *= (1 - (terr.cover + R.C.coverEntrench[U.clamp(t.entrench, 0, 3)]) * 0.7);
        if (def.chem && R.hasTrait(te, 'nbc')) hc *= (1 - R.C.nbcMitigation);
        if (st.rng.chance(hc)) {
          var kc = B.killChance(st, virtualAttacker, t, w);
          if (st.rng.chance(kc.p)) { B.damage(st, t, 1, virtualAttacker); killTotal++; }
        }
        B.suppress(st, t, (def.thermobaric ? 9 : 5) + (def.he || 12) * 0.35);
      }
      if (def.chem && !R.hasTrait(B.eff(t), 'nbc')) B.suppress(st, t, 12);
    });
    B.markStrikeHexes(st, center, def);
    B.log(st, p.side === st.playerSide ? 'good' : 'bad',
      '💥 ' + def.name + ' 覆盖 ' + B.hexName(st, center.q, center.r) +
      '：命中 ' + targets.length + ' 支部队，毁伤 ' + killTotal + ' 个编制单位。');
    if (def.chem) {
      st.sides[p.side].chemUsed++;
      st.escalation = Math.min(window.DATA_HYBRID.escalation.max, st.escalation + 1);
      B.log(st, 'nuke', '☣ 化学武器已被使用：战区升级阶梯上升至 ' + st.escalation + ' 级。');
      B.enemyMayEscalate(st, p.side);
    }
  };

  B.markStrikeHexes = function (st, center, def) {
    if (st.onFx) st.onFx(def.chem ? 'smoke' : 'arty', center.q, center.r, def.name);
    Hex.spiral(center.q, center.r, def.radius).forEach(function (h) {
      var hx = st.map.at(h.q, h.r);
      if (!hx) return;
      hx.fire = 2;
      if (def.chem) hx.chem = 3;
      if ((hx.t === 'town' || hx.t === 'city') && (def.he || 0) >= 18 && st.rng.chance(0.35)) hx.t = 'ruins';
    });
  };

  B.airDefenceCheck = function (st, side, center) {
    var foe = side === 'NATO' ? 'WP' : 'NATO';
    var mult = 1, texts = [], aborted = false;
    B.living(st, foe).forEach(function (u) {
      if (u.card.category !== 'AA' && !R.hasTrait(B.eff(u), 'manpads')) return;
      var d = Hex.dist(u, center);
      var aa = (B.eff(u).weapons || []).filter(function (w) { return w.air; })[0];
      if (!aa || d > aa.rmax) return;
      if (B.hasEffectAt(st, u.q, u.r, 'radar', foe)) return;
      var p = U.clamp((aa.acc || 0.5) * 0.55 + (st.sides[foe].aaAccMod || 0), 0.05, 0.85);
      if (st.rng.chance(p)) {
        mult *= 0.45;
        texts.push(u.short);
        if (st.rng.chance(0.35)) aborted = true;
      }
    });
    return { mult: mult, aborted: aborted, text: texts.length ? texts.join('、') + ' 开火' : '弹幕拦阻' };
  };

  /* ================= 核打击 ================= */
  B.detonateNuke = function (st, side, center, opts) {
    var radius = opts.radius || 2;
    var power = opts.power || 60;
    var kills = 0, hitUnits = 0;
    if (st.onFx) st.onFx('nuke', center.q, center.r, opts.source || '核打击');
    Hex.spiral(center.q, center.r, radius + 1).forEach(function (h) {
      var hx = st.map.at(h.q, h.r);
      if (!hx) return;
      var d = Hex.dist(h, center);
      var lvl = U.clamp(3 - d, 1, 3);
      hx.rad = Math.max(hx.rad || 0, lvl);
      hx.fire = 3;
      if (d <= 1 && (hx.t === 'city' || hx.t === 'town' || hx.t === 'forest')) hx.t = 'ruins';
      else if (d <= radius && hx.t === 'forest') hx.t = 'grove';
      B.unitsAt(st, h.q, h.r).forEach(function (t) {
        hitUnits++;
        var e = B.eff(t);
        var protect = R.hasTrait(e, 'nbc') ? 0.55 : 1;
        var lethality = U.clamp((power / 60) * (1 - d / (radius + 1.5)), 0.05, 0.98) * protect;
        var losses = Math.ceil(t.maxStr * lethality);
        losses = Math.min(losses, t.str);
        for (var i = 0; i < losses; i++) B.damage(st, t, 1, { side: side, short: opts.source || '核打击' });
        kills += losses;
        B.suppress(st, t, 60 * lethality);
      });
    });
    var s = st.sides[side];
    s.nukesUsed++;
    var cons = window.DATA_HYBRID.escalation.consequences;
    st.escalation = Math.min(window.DATA_HYBRID.escalation.max, st.escalation + cons.escalationPerNuke);
    st.doomsday += cons.doomsdayPerNuke;
    s.vp = Math.max(0, s.vp - cons.vpPenalty * 0.5);
    var text = '☢ ' + (opts.yieldKt ? opts.yieldKt + '千吨级' : '战术') + '核弹在 ' + B.hexName(st, center.q, center.r) +
      ' 上空引爆：' + hitUnits + ' 支部队被卷入，' + kills + ' 个编制单位蒸发。战区升级阶梯 → ' + st.escalation + ' 级。';
    B.log(st, 'nuke', text);
    B.enemyMayEscalate(st, side);
    B.recomputeVisibility(st);
    B.checkObjectives(st);
    return { kills: kills, text: text };
  };

  B.enemyMayEscalate = function (st, byside) {
    var foe = byside === 'NATO' ? 'WP' : 'NATO';
    var fs = st.sides[foe];
    if (fs.nukeAuth) return;
    var cons = window.DATA_HYBRID.escalation.consequences;
    var p = cons.enemyAuthChance - (fs.nukeResist || 0) * 0.08;
    if (st.rng.chance(p)) {
      fs.nukeAuth = true;
      var L = window.DATA_LORE.escalation.enemyRetaliation;
      B.log(st, 'nuke', '☢ ' + (L && L.length ? st.rng.pick(L) : '对方获得了核报复授权。'));
    }
  };

  /* ================= 作战决心 / 核授权 ================= */
  B.authConditions = function (st, side) {
    var s = st.sides[side], foe = st.sides[side === 'NATO' ? 'WP' : 'NATO'];
    var out = [];
    var E = window.DATA_HYBRID.escalation;
    E.conditions.forEach(function (c) {
      var met = false;
      if (c.id === 'turn') met = st.turn >= 6;
      else if (c.id === 'losses') met = s.strengthCommitted > 0 && s.strengthLost / s.strengthCommitted >= 0.4;
      else if (c.id === 'objlost') met = st.map.objectives.some(function (o) {
        return (st.mission.holdObjectives || []).indexOf(o.id) >= 0 && o.owner !== side;
      });
      else if (c.id === 'enemy_nbc') met = foe.nukesUsed > 0 || foe.chemUsed > 0;
      else if (c.id === 'escalation') met = st.escalation >= 2;
      else if (c.id === 'breakthrough') met = B.living(st, side === 'NATO' ? 'WP' : 'NATO').some(function (u) {
        return (st.map.deploy[side] || []).indexOf(Hex.key(u.q, u.r)) >= 0;
      });
      out.push({ id: c.id, text: c.text, met: met, weight: c.weight });
    });
    return out;
  };

  B.authChance = function (st, side) {
    var E = window.DATA_HYBRID.escalation;
    var s = st.sides[side];
    var conds = B.authConditions(st, side);
    var chance = E.baseChance;
    conds.forEach(function (c) { if (c.met) chance += c.weight; });
    chance += (s.strat && s.strat.nukeAuthBonus) || 0;
    chance += st.escalation * 0.04;
    chance -= (s.nukeResist || 0) * 0.07;
    return { chance: U.clamp(chance, 0.03, 0.96), conds: conds, anyMet: conds.some(function (c) { return c.met; }) };
  };

  B.requestAuthorization = function (st, side) {
    var s = st.sides[side];
    if (s.nukeAuth) return { ok: false, msg: '本方已持有核释放权限。' };
    if (st.mode.nuke === 'free') { s.nukeAuth = true; return { ok: true, granted: true, msg: '无尽模式：核使用无需授权。' }; }
    if (s.authCooldown > 0) return { ok: false, msg: '战区司令部要求 ' + s.authCooldown + ' 个回合后再议。' };
    if (s.cp < 2) return { ok: false, msg: '指挥点不足（下达作战决心需要 2 点）。' };
    var info = B.authChance(st, side);
    if (!info.anyMet) return { ok: false, msg: '尚不满足任何升级条件，司令部拒绝受理核释放申请。', conds: info.conds };
    s.cp -= 2;
    s.authTried++;
    var L = window.DATA_LORE.escalation;
    if (st.rng.chance(info.chance)) {
      s.nukeAuth = true;
      st.escalation = Math.min(window.DATA_HYBRID.escalation.max, st.escalation + 1);
      st.doomsday += 1;
      var t = L && L.requestGranted ? st.rng.pick(L.requestGranted) : '核释放权限已下达。';
      B.log(st, 'nuke', '☢ ' + t);
      return { ok: true, granted: true, msg: t, chance: info.chance };
    }
    s.authCooldown = window.DATA_HYBRID.escalation.cooldown;
    var t2 = L && L.requestDenied ? st.rng.pick(L.requestDenied) : '申请被驳回。';
    B.log(st, 'warn', '✖ ' + t2);
    return { ok: true, granted: false, msg: t2, chance: info.chance };
  };

  /* ================= 超限战战场指令 ================= */
  B.useOp = function (st, side, opId, q, r) {
    var s = st.sides[side];
    var entry = s.ops.filter(function (o) { return o.id === opId; })[0];
    if (!entry) return { ok: false, msg: '未解锁该指令' };
    var def = entry.def;
    if (def.effect === 'resolve') return B.requestAuthorization(st, side);
    var cost = Math.round(def.cost * (s.modifiers.opsCostMult || 1));
    if (s.points < cost) return { ok: false, msg: '分值不足（需要 ' + cost + '）' };
    if (s.cp < (def.cp || 1)) return { ok: false, msg: '指挥点不足（需要 ' + (def.cp || 1) + ' 点）' };
    s.points -= cost; s.cp -= (def.cp || 1); entry.used++;
    var foe = side === 'NATO' ? 'WP' : 'NATO';
    var fs = st.sides[foe];
    var flavor = window.DATA_LORE.hybridFlavor || {};
    var msg = '';
    switch (def.effect) {
      case 'jam':
        B.addEffect(st, { kind: 'jam', side: side, q: q, r: r, radius: def.radius, until: st.turn + def.duration });
        msg = '⚡ 通信干扰已在 ' + B.hexName(st, q, r) + ' 区域展开：敌军行动点 -1，间瞄呼叫中断。';
        break;
      case 'radar':
        B.addEffect(st, { kind: 'radar', side: side, q: q, r: r, radius: def.radius, until: st.turn + def.duration });
        msg = '⚡ 雷达压制生效：' + B.hexName(st, q, r) + ' 周边敌方防空与雷达暂时失效。';
        break;
      case 'cyber':
        B.addEffect(st, { kind: 'cyber', side: side, q: 0, r: 0, radius: 99, until: st.turn + def.duration });
        st.pending.forEach(function (p) { if (p.side === foe) p.arriveTurn += 1; });
        msg = '💻 数据链攻击成功：敌方火力指挥系统瘫痪，已呼叫的支援被延迟。';
        break;
      case 'psyops':
        var n = 0;
        Hex.spiral(q, r, def.radius).forEach(function (h) {
          B.unitsAt(st, h.q, h.r).forEach(function (u) {
            if (u.side !== foe) return;
            n++;
            B.suppress(st, u, 22);
            if (R.hasTrait(B.eff(u), 'cheap_conscript') && st.rng.chance(0.3)) {
              u.cohesion = Math.min(u.cohesion, R.C.routAt);
              B.updateState(st, u);
            }
          });
        });
        msg = '📡 心理战广播覆盖 ' + B.hexName(st, q, r) + '：' + n + ' 支敌军凝聚力下降。';
        break;
      case 'maskirovka':
        B.addEffect(st, { kind: 'maskirovka', side: side, q: 0, r: 0, radius: 99, until: st.turn + def.duration });
        fs.reserveDelay = (fs.reserveDelay || 0) + 1;
        s.deployDiscount = 0.65;
        msg = '📻 无线电欺骗奏效：本回合部署费用 -35%，敌军增援判断错误。';
        break;
      case 'sigint':
        B.addEffect(st, { kind: 'sigint', side: side, q: 0, r: 0, radius: 99, until: st.turn + def.duration });
        B.recomputeVisibility(st);
        msg = '🛰 电子侦察截获：全场敌军位置暴露，敌方预备队规模已知（剩余分值 ' + Math.round(fs.points) + '）。';
        break;
      case 'decoy':
        B.addEffect(st, { kind: 'decoy', side: side, q: q, r: r, radius: def.radius, until: st.turn + def.duration });
        msg = '🎭 假目标阵地已在 ' + B.hexName(st, q, r) + ' 布设，敌方侦察与炮火将被吸引。';
        break;
      case 'sabotage':
        fs.sabotaged = 2;
        var victim = st.rng.pick(B.living(st, foe));
        if (victim) victim.ammo = victim.ammo.map(function (a) { return Math.floor(a * 0.15); });
        msg = '🔻 敌后破袭成功：敌方下一回合收入减半' + (victim ? '，' + victim.short + ' 弹药告急' : '') + '。';
        break;
      case 'decap':
        var hitn = 0;
        Hex.spiral(q, r, def.radius).forEach(function (h) {
          B.unitsAt(st, h.q, h.r).forEach(function (u) {
            if (u.side !== foe) return;
            if (u.card.category === 'LOG' || R.hasTrait(B.eff(u), 'command')) {
              for (var i = 0; i < Math.ceil(u.str / 2); i++) B.damage(st, u, 1, { side: side, short: '斩首行动' });
              hitn++;
            }
          });
        });
        B.living(st, foe).forEach(function (u) { B.suppress(st, u, 12); });
        msg = '🔻 斩首打击完成：' + hitn + ' 个敌方指挥/后勤节点被清除，敌军全线凝聚力下降。';
        break;
      case 'finance':
        fs.financeHit = 2;
        s.points += 60;
        msg = '💱 战时金融突袭：敌方两回合收入 -40%，本方获得 60 分值战争公债。';
        break;
      case 'truce':
        fs.truceBlock = 1;
        st.escalation = Math.max(0, st.escalation - 1);
        msg = '🕊 停火试探：敌方本回合不会动用核化武器，战区升级阶梯下降至 ' + st.escalation + ' 级。';
        break;
      default:
        msg = def.name + ' 已执行。';
    }
    var fl = flavor[({ jam: 'jamming', radar: 'jamming', cyber: 'cyber', psyops: 'psyops', maskirovka: 'deepfake', sigint: 'sigint', sabotage: 'sabotage', decap: 'decapitation', finance: 'currency', truce: 'diplomacy', decoy: 'deepfake' })[def.effect]];
    if (fl && fl.length) msg += '\n' + st.rng.pick(fl);
    B.log(st, side === st.playerSide ? 'good' : 'warn', msg);
    B.recomputeVisibility(st);
    return { ok: true, msg: msg, cost: cost };
  };

  /* ================= 部署 ================= */
  B.deployCost = function (st, side, entry) {
    var s = st.sides[side];
    var c = entry.card.cost;
    if (s.deployDiscount) c = Math.round(c * s.deployDiscount);
    return c;
  };

  B.canDeployAt = function (st, side, q, r) {
    var k = Hex.key(q, r);
    if ((st.map.deploy[side] || []).indexOf(k) < 0) return false;
    if (B.unitAt(st, q, r)) return false;
    var h = st.map.at(q, r);
    if (!h || R.terrain(h.t).water) return false;
    return true;
  };

  B.deploy = function (st, side, deckIdx, q, r) {
    var s = st.sides[side];
    var entry = s.deck[deckIdx];
    if (!entry) return { ok: false, msg: '卡组中没有该单位' };
    if (!st.mode.endless && entry.used >= entry.avail) return { ok: false, msg: '该卡可用数量已耗尽' };
    if (st.mode.era.indexOf(entry.card.era) < 0) return { ok: false, msg: '该装备在本模式中尚未列装' };
    var cost = B.deployCost(st, side, entry);
    if (s.points < cost) return { ok: false, msg: '分值不足（需要 ' + cost + '）' };
    if (!B.canDeployAt(st, side, q, r)) return { ok: false, msg: '该格不在可部署区域或已被占据' };
    if (s.reserveDelay > 0 && st.turn <= s.reserveDelay) return { ok: false, msg: '增援受阻，第 ' + (s.reserveDelay + 1) + ' 回合起才能投入预备队' };
    s.points -= cost;
    entry.used++;
    var u = B.spawnUnit(st, side, entry, q, r, { freshAp: false });
    B.log(st, side === st.playerSide ? 'good' : 'warn',
      '🚚 ' + (side === 'NATO' ? '北约' : '华约') + ' 从场外投入 ' + u.short + '（' + cost + ' 分）于 ' + B.hexName(st, q, r) + '。');
    B.recomputeVisibility(st);
    return { ok: true, unit: u, cost: cost };
  };

  /* ================= 其它行动 ================= */
  B.dismount = function (st, u) {
    if (!u.mounted) return { ok: false, msg: '该单位未乘车' };
    if (u.ap < R.C.dismountCost) return { ok: false, msg: '行动点不足' };
    u.ap -= R.C.dismountCost;
    u.mounted = false;
    u.ammo = (u.card.weapons || []).map(function (w) { return w.ammo || 10; });
    B.log(st, 'system', u.short + ' 下车展开，载具退往后方。');
    return { ok: true };
  };
  B.mount = function (st, u) {
    if (u.mounted || !u.mountCard) return { ok: false, msg: '无可用载具' };
    if (u.ap < R.C.dismountCost) return { ok: false, msg: '行动点不足' };
    u.ap -= R.C.dismountCost;
    u.mounted = true;
    u.ammo = (u.mountCard.weapons || []).map(function (w) { return w.ammo || 10; });
    return { ok: true };
  };
  B.digIn = function (st, u) {
    if (u.ap < R.C.digCost) return { ok: false, msg: '行动点不足（需要 ' + R.C.digCost + '）' };
    u.ap -= R.C.digCost;
    u.entrench = U.clamp(u.entrench + 1, 0, 3);
    B.log(st, 'system', u.short + ' 构筑阵地（构筑度 ' + u.entrench + '/3）。');
    return { ok: true };
  };
  B.rally = function (st, u) {
    if (u.ap <= 0) return { ok: false, msg: '行动点不足' };
    u.ap = 0;
    var gain = R.C.rallyRecover + (R.hasTrait(B.eff(u), 'command') ? 8 : 0);
    u.cohesion = U.clamp(u.cohesion + gain, 0, 100);
    B.updateState(st, u);
    B.log(st, 'system', u.short + ' 就地整顿，凝聚力恢复至 ' + Math.round(u.cohesion) + '。');
    return { ok: true };
  };

  /* ================= 目标点 / 胜负 ================= */
  B.checkObjectives = function (st) {
    st.map.objectives.forEach(function (o) {
      var units = B.unitsAt(st, o.q, o.r);
      if (units.length) {
        var side = units[0].side;
        if (o.owner !== side) {
          o.owner = side;
          st.sides[side].vp += 4;   // 夺取奖励
          B.log(st, side === st.playerSide ? 'good' : 'bad',
            '🚩 ' + o.label + '「' + o.name + '」被' + (side === 'NATO' ? '北约' : '华约') + '控制（+4 胜利分）。');
        }
      }
    });
  };

  B.tickVP = function (st) {
    st.map.objectives.forEach(function (o) {
      if (!o.owner) return;
      /* 从敌方手中夺取的目标产满额胜利分；守着自己原有的目标只有三分之一 */
      var rate = (o.origin && o.origin === o.owner) ? 0.34 : 1;
      st.sides[o.owner].vp += o.vp * R.C.vpPerObjectivePerTurn * rate;
    });
  };

  /* 攻守双方的胜利分门槛 */
  B.computeTargets = function (st) {
    var base = st.mission.vpTarget || 70;
    var role = st.mission.role || 'meeting';
    if (role === 'defend') return { player: Math.round(base * 0.9), enemy: base };
    return { player: base, enemy: base };
  };

  B.victoryCheck = function (st) {
    if (st.over) return st.result;
    var p = st.sides[st.playerSide], e = st.sides[st.enemySide];
    var tg = st.targets || B.computeTargets(st);
    var maxDoom = 6;
    if (!st.mode.endless && st.doomsday >= maxDoom) {
      return B.finish(st, 'doomsday', '战区升级失控，战略核交换已经开始。');
    }
    var pAlive = B.living(st, st.playerSide).length, eAlive = B.living(st, st.enemySide).length;
    var pCan = p.points >= 60 || st.mode.endless;
    var eCan = e.points >= 60 || st.mode.endless;
    if (eAlive === 0 && !eCan) return B.finish(st, 'win', '敌军在本战场已无可用兵力。');
    if (pAlive === 0 && !pCan) return B.finish(st, 'lose', '本方在本战场已无可用兵力。');
    if (p.vp >= tg.player) return B.finish(st, 'win', '胜利分达成（' + Math.round(p.vp) + '/' + tg.player + '）。');
    if (e.vp >= tg.enemy) return B.finish(st, 'lose', '敌方胜利分达成（' + Math.round(e.vp) + '/' + tg.enemy + '）。');
    if (st.turn > st.maxTurns) {
      var hold = (st.mission.holdObjectives || []);
      var holdOk = hold.every(function (id) {
        var o = st.map.objectives.filter(function (x) { return x.id === id; })[0];
        return o && o.owner === st.playerSide;
      });
      if (st.mission.role === 'defend') {
        return holdOk && p.vp >= e.vp * 0.75
          ? B.finish(st, 'win', '防御任务达成：阵地在时限内未被突破。')
          : B.finish(st, 'lose', '时限结束，防线已被撕开。');
      }
      var pShare = p.vp / Math.max(1, tg.player), eShare = e.vp / Math.max(1, tg.enemy);
      if (pShare > eShare * 1.08) return B.finish(st, 'win', '时限结束，本方在积分上占优。');
      if (eShare > pShare * 1.08) return B.finish(st, 'lose', '时限结束，敌方在积分上占优。');
      return B.finish(st, 'draw', '时限结束，双方均未达成决定性结果。');
    }
    return null;
  };

  B.finish = function (st, kind, why) {
    st.over = true;
    var p = st.sides[st.playerSide];
    st.result = {
      kind: kind, why: why,
      vp: Math.round(p.vp), enemyVp: Math.round(st.sides[st.enemySide].vp),
      turns: st.turn, nukesUsed: p.nukesUsed, enemyNukes: st.sides[st.enemySide].nukesUsed,
      escalation: st.escalation, doomsday: st.doomsday,
      killed: p.killed, lost: p.lost,
      strengthLost: p.strengthLost
    };
    B.log(st, kind === 'win' ? 'good' : (kind === 'lose' ? 'bad' : 'nuke'), '■ 战斗结束：' + why);
    return st.result;
  };

  /* ================= 回合流程 ================= */
  B.startTurnFor = function (st, side) {
    var s = st.sides[side];
    st.active = side;
    B.cleanEffects(st);
    /* 收入 */
    var objCount = st.map.objectives.filter(function (o) { return o.owner === side; }).length;
    var income = s.incomeBase + objCount * R.C.incomePerObjective;
    income *= s.modifiers.incomeMult;
    if (s.sabotaged > 0) { income *= 0.5; s.sabotaged--; }
    if (s.financeHit > 0) { income *= 0.6; s.financeHit--; }
    s.points += Math.round(income);
    s.lastIncome = Math.round(income);
    s.cp = Math.min(R.C.cpMax, s.cp + R.C.cpPerTurn);
    if (s.authCooldown > 0) s.authCooldown--;
    s.deployDiscount = 0;
    if (s.truceBlock > 0) s.truceBlock--;

    /* 支援弹着 */
    B.resolvePending(st, side, false);

    /* 单位刷新 */
    B.living(st, side).forEach(function (u) {
      u.maxAp = B.unitMaxAP(st, u);
      u.ap = u.maxAp;
      u.firedThisTurn = false;
      u.reacted = false;
      u.movedThisTurn = 0;
      u.arriving = false;
      /* 凝聚力恢复 */
      var rec = R.C.cohesionRecover;
      var near = B.living(st, side).some(function (o) {
        return o !== u && Hex.dist(o, u) <= 2 && (R.hasTrait(B.eff(o), 'command') || R.hasTrait(B.eff(o), 'supply'));
      });
      if (near) rec += 8;
      if (u.entrench > 0) rec += 3;
      u.cohesion = U.clamp(u.cohesion + rec, 0, 100);
      B.updateState(st, u);
      /* 补给 */
      if (near) {
        var e = B.eff(u);
        u.ammo = u.ammo.map(function (a, i) {
          var mx = ((e.weapons || [])[i] || {}).ammo || 10;
          return Math.min(mx, a + Math.ceil(mx * 0.25));
        });
      }
      /* 辐射与化学污染 */
      var h = st.map.at(u.q, u.r);
      if (h) {
        if (h.rad > 0) {
          var nbc = R.hasTrait(B.eff(u), 'nbc') || (s.strat && s.strat.nbcTraining);
          var dmgP = R.C.radiationDamage[U.clamp(h.rad, 0, 3)] * (nbc ? (1 - R.C.nbcMitigation) : 1);
          if (st.rng.chance(dmgP)) B.damage(st, u, 1, { side: 'none', short: '辐射' });
          B.suppress(st, u, R.C.radiationCohesion[U.clamp(h.rad, 0, 3)] * (nbc ? 0.5 : 1));
        }
        if (h.chem > 0) {
          var nbc2 = R.hasTrait(B.eff(u), 'nbc');
          if (!nbc2 && st.rng.chance(0.18)) B.damage(st, u, 1, { side: 'none', short: '毒剂' });
        }
        if (h.smoke > 0) h.smoke--;
        if (h.fire > 0) h.fire--;
        if (h.chem > 0) h.chem--;
      }
      /* 航空燃油 / 出击轮次 */
      if (u.card.category === 'AIR') {
        u.sortie = (u.sortie || 1) - 1;
        if (u.sortie <= 0 && !u.dead) {
          u.dead = true; u.returned = true;
          B.log(st, 'system', '✈ ' + u.short + ' 燃油耗尽，脱离战场返航。');
        }
      } else if (u.card.category === 'HEL') {
        u.fuel = (u.fuel || 6) - 1;
        if (u.fuel <= 0 && !u.dead) {
          u.dead = true; u.returned = true;
          B.log(st, 'system', '🚁 ' + u.short + ' 返航加油。');
        }
      }
      /* 溃散部队自动后撤 */
      if (u.state === 'routed' && !u.dead) B.autoRetreat(st, u);
    });
    B.recomputeVisibility(st);
    B.checkObjectives(st);
  };

  B.autoRetreat = function (st, u) {
    var dir = st.map.sides.west === u.side ? 3 : 0;
    for (var i = 0; i < 2; i++) {
      var n = Hex.neighbor(u.q, u.r, dir);
      if (B.moveCost(st, u, u, n) < 99 && !B.unitAt(st, n.q, n.r)) { u.q = n.q; u.r = n.r; }
    }
    u.ap = Math.max(0, u.ap - 2);
  };

  B.endTurnFor = function (st, side) {
    var res = B.victoryCheck(st);
    if (res) return res;
    return null;
  };

  B.nextTurn = function (st) {
    /* 玩家 → 敌方 → 回合 +1（胜利分每整回合结算一次） */
    if (st.active === st.playerSide) {
      var r1 = B.endTurnFor(st, st.playerSide);
      if (r1) return r1;
      B.startTurnFor(st, st.enemySide);
      return { aiTurn: true };
    }
    B.tickVP(st);
    var r2 = B.endTurnFor(st, st.enemySide);
    if (r2) return r2;
    st.turn++;
    var r3 = B.victoryCheck(st);
    if (r3) return r3;
    B.startTurnFor(st, st.playerSide);
    return { playerTurn: true };
  };

  B.beginBattle = function (st) {
    st.phase = 'play';
    B.startTurnFor(st, st.playerSide);
    /* 敌方开局部署 */
    if (IC.AI) IC.AI.initialDeploy(st, st.enemySide);
    var strat = st.sides[st.playerSide].strat || {};
    if (strat.enemyStartLoss) {
      for (var i = 0; i < strat.enemyStartLoss; i++) {
        var victim = st.rng.pick(B.living(st, st.enemySide));
        if (victim) {
          for (var j = 0; j < victim.str; j++) B.damage(st, victim, 1, { side: st.playerSide, short: '开战前破袭' });
          B.log(st, 'good', '🔻 战前破袭：敌方 ' + victim.short + ' 在集结地被摧毁。');
        }
      }
    }
    B.recomputeVisibility(st);
    return st;
  };

  /* 统计面板用 */
  B.sideSummary = function (st, side) {
    var units = B.living(st, side);
    return {
      units: units.length,
      strength: U.sum(units, function (u) { return u.str; }),
      points: Math.round(st.sides[side].points),
      vp: Math.round(st.sides[side].vp),
      cp: st.sides[side].cp,
      objectives: st.map.objectives.filter(function (o) { return o.owner === side; }).length,
      nukeAuth: st.sides[side].nukeAuth,
      lost: st.sides[side].lost
    };
  };
})();
