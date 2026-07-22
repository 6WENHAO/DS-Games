/* game.js — core game state and rules */
(function (global) {
  "use strict";
  const D = global.DATA;

  const Game = {
    map: null,
    players: [],      // {id, civId, isHuman, color, ...}
    units: {},        // id -> unit
    cities: {},       // id -> city
    turn: 1,
    activePlayer: 0,
    nextUnitId: 1,
    nextCityId: 1,
    barbId: -1,
    over: false,
    listeners: {},

    on(ev, fn) { (this.listeners[ev] || (this.listeners[ev] = [])).push(fn); },
    emit(ev, data) { (this.listeners[ev] || []).forEach(fn => fn(data)); },

    // ---------------- SETUP ----------------
    init(opts) {
      this.map = MapGen.generate(opts.mapSize, opts.seed);
      this.players = [];
      this.units = {}; this.cities = {};
      this.turn = 1; this.activePlayer = 0; this.over = false;
      this.nextUnitId = 1; this.nextCityId = 1;

      const civPool = D.CIVS.slice();
      // human first
      const humanCiv = opts.civId;
      const humanData = civPool.find(c => c.id === humanCiv) || civPool[0];
      const others = civPool.filter(c => c.id !== humanData.id);
      shuffle(others);

      const chosen = [humanData, ...others.slice(0, opts.numCivs - 1)];
      chosen.forEach((cd, i) => {
        this.players.push({
          id: i, civId: cd.id, data: cd, isHuman: i === 0, alive: true,
          color: cd.color, accent: cd.accent,
          gold: 20, faith: 0, science: 0, culture: 0,
          researchTech: null, techProgress: 0, techsDone: {},
          researchCivic: null, civicProgress: 0, civicsDone: {},
          boostsTech: {}, boostsCivic: {},
          government: "chiefdom", era: "Ancient",
          met: {}, atWarWith: {}, barbKills: 0
        });
      });
      // barbarian pseudo-player
      this.barbPlayer = { id: this.barbId, civId: "barb", isHuman: false, color: "#c0392b",
        alive: true, isBarb: true };

      this.placeStarts();
      this.revealAround(this.players[0]);
      this.emit("init");
    },

    player(id) { return id === this.barbId ? this.barbPlayer : this.players[id]; },
    human() { return this.players[0]; },

    placeStarts() {
      const spots = this.findStartSpots(this.players.length);
      this.players.forEach((p, i) => {
        const s = spots[i];
        p.startCol = s.col; p.startRow = s.row;
        const order = p.data.start;
        let placed = 0;
        // settler on the spot
        this.spawnUnit("settler", s.col, s.row, p.id);
        for (const u of order) {
          if (u === "settler") continue;
          const nb = Hex.neighbors(s.col, s.row);
          for (const n of nb) {
            const t = this.map.get(n.col, n.row);
            if (t && !MapGen.isWater(t) && t.elevation !== "mountain" && !t.unitId) {
              this.spawnUnit(u, n.col, n.row, p.id); placed++; break;
            }
          }
        }
      });
      // scatter a few barbarian camps + units
      this.placeBarbarians();
    },

    findStartSpots(n) {
      const m = this.map, spots = [], tries = [];
      for (const t of m.tiles) {
        if (MapGen.isWater(t) || t.elevation === "mountain") continue;
        // score: prefer central-ish land with land neighbors
        let land = 0;
        Hex.ring(t.col, t.row, 2).forEach(r => { const o = m.get(r.col, r.row); if (o && !MapGen.isWater(o)) land++; });
        tries.push({ col: t.col, row: t.row, land });
      }
      tries.sort((a, b) => b.land - a.land);
      const minDist = Math.max(6, Math.floor(Math.min(m.cols, m.rows) / (n + 1)));
      for (const cand of tries) {
        if (spots.every(s => Hex.distance(s.col, s.row, cand.col, cand.row) >= minDist)) {
          spots.push(cand);
          if (spots.length === n) break;
        }
      }
      while (spots.length < n) spots.push(tries[spots.length] || tries[0]);
      return spots;
    },

    placeBarbarians() {
      const m = this.map;
      const count = Math.floor(m.cols * m.rows / 220);
      let placed = 0, guard = 0;
      while (placed < count && guard++ < 800) {
        const c = Math.floor(Math.random() * m.cols), r = Math.floor(Math.random() * m.rows);
        const t = m.get(c, r);
        if (!t || MapGen.isWater(t) || t.elevation === "mountain" || t.unitId) continue;
        // not too close to player starts
        if (this.players.some(p => Hex.distance(p.startCol, p.startRow, c, r) < 5)) continue;
        t.barbCamp = true;
        this.spawnUnit(Math.random() < 0.5 ? "warrior" : "scout", c, r, this.barbId);
        placed++;
      }
    },

    // ---------------- UNITS ----------------
    spawnUnit(type, col, row, owner) {
      const def = D.UNIT[type];
      const t = this.map.get(col, row);
      if (!t) return null;
      const u = {
        id: this.nextUnitId++, type, owner, col, row,
        hp: 100, moves: def.move, maxMoves: def.move,
        fortified: false, charges: def.charges || 0,
        exp: 0, level: 1, actedThisTurn: false, buildTask: null
      };
      this.units[u.id] = u;
      t.unitId = u.id;
      return u;
    },

    removeUnit(u) {
      const t = this.map.get(u.col, u.row);
      if (t && t.unitId === u.id) t.unitId = null;
      delete this.units[u.id];
      this.emit("unitRemoved", u);
    },

    unitDef(u) { return D.UNIT[u.type]; },

    unitsOf(playerId) { return Object.values(this.units).filter(u => u.owner === playerId); },

    // combat strength incl. terrain/fortify/hp
    combatStrength(u, attacking) {
      const def = this.unitDef(u);
      let s = def.atk || 0;
      const t = this.map.get(u.col, u.row);
      if (!attacking && t) {
        if (t.elevation === "hills") s += 3;
        if (t.feature === "woods" || t.feature === "rainforest") s += 3;
        if (t.river) s += 0;
        if (u.fortified) s += 6;
        const city = t.cityId ? this.cities[t.cityId] : null;
      }
      // damage penalty
      s += Math.floor((u.hp - 100) / 10);
      // government / civ bonuses
      const p = this.player(u.owner);
      if (p && p.government === "oligarchy" && (def.cls === "melee")) s += 4;
      return s;
    },

    // ---------------- MOVEMENT / PATHFINDING ----------------
    moveCost(from, to, u) {
      if (!to) return Infinity;
      if (to.elevation === "mountain") return Infinity;
      const def = this.unitDef(u);
      const water = MapGen.isWater(to);
      const land = !water;
      const embark = def.cls === "civilian" || def.cls === "recon" || true; // allow embark generally
      // civilians cannot enter enemy/barb-occupied tiles
      let cost = 1;
      if (to.elevation === "hills") cost += 1;
      if (to.feature === "woods" || to.feature === "rainforest" || to.feature === "marsh") cost += 1;
      return cost;
    },

    passable(t, u) {
      if (!t) return false;
      if (t.elevation === "mountain") return false;
      // occupied by another unit
      if (t.unitId && t.unitId !== u.id) {
        const other = this.units[t.unitId];
        if (other && other.owner === u.owner) return false; // no stacking same owner
      }
      return true;
    },

    // Dijkstra over move points; returns {dist, prev} maps keyed by idx
    pathfind(u, goalCol, goalRow) {
      const m = this.map, startIdx = m.idx(u.col, u.row);
      const dist = new Map(), prev = new Map();
      dist.set(startIdx, 0);
      const pq = [[0, u.col, u.row]];
      const goalIdx = m.idx(goalCol, goalRow);
      while (pq.length) {
        pq.sort((a, b) => a[0] - b[0]);
        const [d, c, r] = pq.shift();
        const ci = m.idx(c, r);
        if (d > (dist.get(ci) ?? Infinity)) continue;
        if (ci === goalIdx) break;
        for (const n of Hex.neighbors(c, r)) {
          const nt = m.get(n.col, n.row);
          if (!nt) continue;
          const ni = m.idx(n.col, n.row);
          if (nt.elevation === "mountain") continue;
          // block enemy-occupied for pathing (unless it's the goal for attack)
          if (nt.unitId && ni !== goalIdx) {
            const other = this.units[nt.unitId];
            if (other && other.owner !== u.owner) continue;
            if (other && other.owner === u.owner) continue;
          }
          const step = this.moveCost(m.get(c, r), nt, u);
          const nd = d + step;
          if (nd < (dist.get(ni) ?? Infinity)) {
            dist.set(ni, nd); prev.set(ni, ci);
            pq.push([nd, n.col, n.row]);
          }
        }
      }
      if (!prev.has(goalIdx) && goalIdx !== startIdx) return null;
      // reconstruct
      const path = [];
      let cur = goalIdx;
      while (cur !== startIdx && cur !== undefined) {
        const r = Math.floor(cur / m.cols), c = cur - r * m.cols;
        path.unshift({ col: c, row: r });
        cur = prev.get(cur);
        if (cur === undefined) return null;
      }
      return { path, dist };
    },

    // move a unit one step toward target using its remaining moves. returns tiles moved.
    moveUnitTo(u, col, row) {
      if (u.col === col && u.row === row) return false;
      const res = this.pathfind(u, col, row);
      if (!res || !res.path.length) return false;
      let moved = false;
      const m = this.map;
      for (const step of res.path) {
        const to = m.get(step.col, step.row);
        // attack if enemy on target
        if (to.unitId) {
          const other = this.units[to.unitId];
          if (other && this.isEnemy(u.owner, other.owner)) {
            if (this.unitDef(u).cls === "civilian") return moved;
            if (u.moves > 0) this.meleeAttack(u, other);
            return true;
          }
          if (other && other.owner === u.owner) return moved; // blocked
        }
        const cost = this.moveCost(m.get(u.col, u.row), to, u);
        if (u.moves <= 0) break;
        // spend at least allow entering if any moves left
        const from = m.get(u.col, u.row);
        from.unitId = null;
        u.col = step.col; u.row = step.row;
        to.unitId = u.id;
        u.moves = Math.max(0, u.moves - cost);
        u.fortified = false;
        moved = true;
        if (u.owner === 0) this.revealAround(this.human());
        // clear barb camp on entering
        if (to.barbCamp && u.owner === 0) { to.barbCamp = false; this.log("清除了一个蛮族前哨！"); this.giveBoostCivic(this.human(), "militaryTradition"); }
        if (u.moves <= 0) break;
      }
      this.emit("unitMoved", u);
      return moved;
    },

    isEnemy(a, b) {
      if (a === b) return false;
      if (a === this.barbId || b === this.barbId) return true;
      const pa = this.player(a);
      return pa && pa.atWarWith && pa.atWarWith[b];
    },

    // ---------------- COMBAT ----------------
    meleeAttack(attacker, defender) {
      const aStr = this.combatStrength(attacker, true);
      const dStr = this.combatStrength(defender, false);
      const diff = aStr - dStr;
      const rand = (Math.random() * 0.5 + 0.75);
      const dmgToDef = Math.round(30 * Math.pow(1.041, diff) * rand);
      const dmgToAtk = Math.round(30 * Math.pow(1.041, -diff) * rand);
      defender.hp -= dmgToDef;
      attacker.hp -= dmgToAtk;
      attacker.moves = 0; attacker.fortified = false;
      this.emit("combat", { attacker, defender, dmgToDef, dmgToAtk });

      if (defender.hp <= 0 && attacker.hp <= 0) { attacker.hp = 1; }
      let killedDef = false;
      if (defender.hp <= 0) {
        const dtile = this.map.get(defender.col, defender.row);
        this.onKill(attacker, defender);
        this.removeUnit(defender);
        killedDef = true;
        // move attacker into tile (melee)
        if (attacker.hp > 0 && this.unitDef(attacker).cls !== "ranged" && this.unitDef(attacker).cls !== "siege") {
          const from = this.map.get(attacker.col, attacker.row);
          from.unitId = null;
          attacker.col = dtile.col; attacker.row = dtile.row;
          dtile.unitId = attacker.id;
          if (attacker.owner === 0) this.revealAround(this.human());
        }
      }
      if (attacker.hp <= 0) { this.removeUnit(attacker); }
      else attacker.exp += killedDef ? 5 : 2;
      this.emit("changed");
    },

    rangedAttack(attacker, defender) {
      const def = this.unitDef(attacker);
      const aStr = def.rangedAtk;
      const dStr = this.combatStrength(defender, false);
      const diff = aStr - dStr;
      const dmg = Math.round(30 * Math.pow(1.041, diff) * (Math.random() * 0.5 + 0.75));
      defender.hp -= dmg;
      attacker.moves = 0; attacker.fortified = false;
      this.emit("combat", { attacker, defender, dmgToDef: dmg, dmgToAtk: 0, ranged: true });
      if (defender.hp <= 0) { this.onKill(attacker, defender); this.removeUnit(defender); }
      this.emit("changed");
    },

    onKill(attacker, defender) {
      const p = this.player(attacker.owner);
      if (!p || attacker.owner === this.barbId) return;
      if (defender.owner === this.barbId) {
        p.barbKills = (p.barbKills || 0) + 1;
        if (p.barbKills >= 3) this.giveBoostTech(p, "bronzeWorking");
      }
      const def = this.unitDef(attacker);
      if (def.cls === "ranged") this.giveBoostTech(p, "wheel");
      if (attacker.type === "slinger") this.giveBoostTech(p, "archery");
    },

    // ---------------- CITIES ----------------
    foundCity(settler) {
      const p = this.player(settler.owner);
      const t = this.map.get(settler.col, settler.row);
      if (t.cityId) return null;
      const id = this.nextCityId++;
      const name = this.cityName(p, id);
      const city = {
        id, name, owner: settler.owner, col: settler.col, row: settler.row,
        pop: 1, food: 0, foodStore: 0, production: 0,
        hp: 200, maxHp: 200, wallHp: 0,
        tiles: [], workedTiles: [], districts: { cityCenter: { col: settler.col, row: settler.row, buildings: [] } },
        buildQueue: null, buildProgress: 0,
        housingBonus: 0, amenities: 0, isCapital: this.citiesOf(settler.owner).length === 0,
        producedWonders: []
      };
      this.cities[id] = city;
      t.cityId = id; t.owner = settler.owner; t.improvement = null; t.feature = t.feature === "floodplains" ? t.feature : null;
      // claim tiles in radius 1 immediately, radius up to 3 as border
      Hex.ring(settler.col, settler.row, 1).forEach(n => this.claimTile(city, n.col, n.row));
      this.assignWorkedTiles(city);
      this.removeUnit(settler);
      if (settler.owner === 0) { this.revealAround(this.human()); this.giveBoostTech(p, "pottery"); }
      // Rome ability: free monument
      if (p.data && p.data.id === "rome") city.districts.cityCenter.buildings.push("monument");
      this.emit("cityFounded", city);
      this.emit("changed");
      return city;
    },

    cityName(p, id) {
      const names = {
        rome: ["罗马","奥斯提亚","安提乌姆","库迈","那不勒斯","拉文纳"],
        egypt: ["底比斯","孟菲斯","赫利奥波利斯","象岛","亚历山大"],
        greece: ["雅典","斯巴达","科林斯","阿尔戈斯","克诺索斯"],
        china: ["北京","上海","广州","成都","西安"],
        aztec: ["特诺奇提特兰","特奥蒂瓦坎","特拉特洛尔科","特斯科科"],
        germany: ["亚琛","科隆","法兰克福","汉堡","慕尼黑"]
      };
      const list = names[p.civId] || ["城市"];
      const n = this.citiesOf(p.id).length;
      return list[n % list.length] + (n >= list.length ? " " + (Math.floor(n / list.length) + 1) : "");
    },

    citiesOf(playerId) { return Object.values(this.cities).filter(c => c.owner === playerId); },

    claimTile(city, col, row) {
      const t = this.map.get(col, row);
      if (!t || t.owner !== null && t.owner !== city.owner) return;
      if (t.cityId && t.cityId !== city.id) return;
      if (MapGen.isWater(t) && Hex.distance(city.col, city.row, col, row) > 1) { /* still allow */ }
      if (t.owner === null) { t.owner = city.owner; t.cityId = city.id; city.tiles.push({ col, row }); }
    },

    expandBorder(city) {
      // claim nearest unowned tile within radius 3
      let best = null, bestD = 99;
      for (const n of Hex.ring(city.col, city.row, 3)) {
        const t = this.map.get(n.col, n.row);
        if (!t || t.owner !== null || t.elevation === "mountain") continue;
        const d = Hex.distance(city.col, city.row, n.col, n.row);
        const appeal = (t.resource ? 3 : 0) + (t.yield ? 0 : 0);
        const score = d - appeal * 0.3;
        if (score < bestD) { bestD = score; best = n; }
      }
      if (best) { this.claimTile(city, best.col, best.row); this.assignWorkedTiles(city); }
    },

    tileYield(t) {
      const y = { food: 0, prod: 0, gold: 0, sci: 0, cul: 0, faith: 0 };
      const add = o => { if (!o) return; for (const k in y) y[k] += o[k] || 0; };
      const terr = D.TERRAIN[t.terrain];
      add(terr && terr.yield);
      if (t.elevation && D.ELEV[t.elevation]) add(D.ELEV[t.elevation].yield);
      if (t.feature && D.FEATURE[t.feature]) add(D.FEATURE[t.feature].yield);
      if (t.resource && D.RES[t.resource]) add(D.RES[t.resource].yield);
      if (t.improvement && D.IMPROVEMENT[t.improvement]) add(D.IMPROVEMENT[t.improvement].yield);
      if (t.river) y.gold += 0;
      return y;
    },

    assignWorkedTiles(city) {
      // city center works itself + best (pop) tiles by yield value
      const owned = city.tiles.map(pt => this.map.get(pt.col, pt.row)).filter(Boolean)
        .filter(t => !(t.col === city.col && t.row === city.row));
      const scored = owned.map(t => {
        const y = this.tileYield(t);
        const val = y.food * 1.3 + y.prod * 1.2 + y.gold * 0.5 + (y.sci + y.cul + y.faith) * 0.9;
        return { t, val };
      }).sort((a, b) => b.val - a.val);
      city.workedTiles = scored.slice(0, city.pop).map(s => ({ col: s.t.col, row: s.t.row }));
    },

    cityYields(city) {
      const y = { food: 0, prod: 0, gold: 0, sci: 0, cul: 0, faith: 0 };
      // city center tile yields base + minimum 2/1
      const center = this.map.get(city.col, city.row);
      const cy = this.tileYield(center);
      y.food += Math.max(2, cy.food); y.prod += Math.max(1, cy.prod); y.gold += cy.gold + 1;
      // worked tiles
      for (const pt of city.workedTiles) {
        const yy = this.tileYield(this.map.get(pt.col, pt.row));
        for (const k in y) y[k] += yy[k];
      }
      // districts + buildings
      for (const dk in city.districts) {
        const dist = D.DISTRICT[dk];
        const inst = city.districts[dk];
        if (dist && dist.yieldType && !dist.auto) {
          y[dist.yieldType] += this.districtAdjacency(city, dk, inst);
        }
        for (const bk of inst.buildings) {
          const b = D.BUILDING[bk];
          if (b && b.yield) for (const k in y) y[k] += b.yield[k] || 0;
        }
      }
      // wonders
      for (const wk of city.producedWonders) {
        const w = D.WONDER[wk];
        if (w && w.yield) for (const k in y) y[k] += w.yield[k] || 0;
      }
      // population science/culture: each citizen +0.5 sci, +0.3 cul (Civ VI approx)
      y.sci += city.pop * 0.5;
      y.cul += city.pop * 0.3;
      // capital palace
      if (city.isCapital) { y.gold += 3; y.sci += 1; y.cul += 1; }
      for (const k in y) y[k] = Math.round(y[k] * 10) / 10;
      return y;
    },

    districtAdjacency(city, dk, inst) {
      const dist = D.DISTRICT[dk];
      let bonus = 1;
      if (!dist.adj) return bonus;
      for (const n of Hex.neighbors(inst.col, inst.row)) {
        const t = this.map.get(n.col, n.row);
        if (!t) continue;
        for (const a of dist.adj) {
          if (a === "mountain" && t.elevation === "mountain") bonus += 1;
          if (a === t.feature) bonus += 0.5;
          if (a === "river" && t.river) bonus += 2;
          if (a === "mine" && t.improvement === "mine") bonus += 0.5;
          if (a === "wonder" && t.wonder) bonus += 1;
        }
      }
      return Math.round(bonus);
    },

    cityHousing(city) {
      let h = 2; // base
      const center = this.map.get(city.col, city.row);
      // fresh water
      if (center.river) h += 3;
      else if (Hex.neighbors(city.col, city.row).some(n => { const t = this.map.get(n.col, n.row); return t && MapGen.isWater(t); })) h += 1;
      else h += 2;
      // farms/improvements
      for (const pt of city.tiles) {
        const t = this.map.get(pt.col, pt.row);
        if (t.improvement === "farm") h += 0.5;
      }
      for (const dk in city.districts) {
        for (const bk of city.districts[dk].buildings) {
          const b = D.BUILDING[bk]; if (b && b.housing) h += b.housing;
        }
      }
      return Math.floor(h);
    },

    // food needed to grow to next pop
    growthThreshold(pop) { return Math.floor(15 + 8 * (pop - 1) + Math.pow(pop - 1, 1.5)); },

    // ---------------- PRODUCTION ----------------
    productionOptions(city) {
      const p = this.player(city.owner);
      const opts = [];
      // units
      for (const key in D.UNIT) {
        const u = D.UNIT[key];
        if (!this.unlockedUnit(p, key)) continue;
        opts.push({ kind: "unit", key, name: u.name, cost: u.cost, cat: "Units" });
      }
      // districts
      for (const key in D.DISTRICT) {
        const dd = D.DISTRICT[key];
        if (dd.auto) continue;
        if (city.districts[key]) continue;
        if (!this.unlockedDistrict(p, key)) continue;
        if (!this.canPlaceDistrict(city, key)) continue;
        opts.push({ kind: "district", key, name: dd.name, cost: dd.cost, cat: "Districts" });
      }
      // buildings
      for (const key in D.BUILDING) {
        const b = D.BUILDING[key];
        if (!city.districts[b.district]) continue;
        if (city.districts[b.district].buildings.includes(key)) continue;
        if (b.tech && !p.techsDone[b.tech]) continue;
        if (b.civic && !p.civicsDone[b.civic]) continue;
        opts.push({ kind: "building", key, name: b.name, cost: b.cost, cat: "Buildings" });
      }
      // wonders
      for (const key in D.WONDER) {
        const w = D.WONDER[key];
        if (this.wonderBuilt(key)) continue;
        if (w.tech && !p.techsDone[w.tech]) continue;
        if (w.civic && !p.civicsDone[w.civic]) continue;
        opts.push({ kind: "wonder", key, name: w.name, cost: w.cost, cat: "Wonders" });
      }
      return opts;
    },

    unlockedUnit(p, key) {
      const u = D.UNIT[key];
      if (u.tech && !p.techsDone[u.tech]) return false;
      if (u.civic && !p.civicsDone[u.civic]) return false;
      if (u.strat) { /* need resource — simplified: need tech that reveals it */
        const res = D.RES[u.strat];
        if (res && res.reveal && !p.techsDone[res.reveal]) return false;
      }
      return true;
    },
    unlockedDistrict(p, key) {
      const d = D.DISTRICT[key];
      if (d.tech && !p.techsDone[d.tech]) return false;
      if (d.civic && !p.civicsDone[d.civic]) return false;
      return true;
    },
    wonderBuilt(key) { return Object.values(this.cities).some(c => c.producedWonders.includes(key)); },

    canPlaceDistrict(city, key) {
      return !!this.districtSpot(city, key);
    },
    districtSpot(city, key) {
      const d = D.DISTRICT[key];
      for (const n of Hex.neighbors(city.col, city.row)) {
        const t = this.map.get(n.col, n.row);
        if (!t) continue;
        if (t.owner !== city.owner) continue;
        if (t.cityId && t.districtOf) continue;
        if (t.districtKey) continue;
        if (t.elevation === "mountain") continue;
        if (d.water && !MapGen.isWater(t)) continue;
        if (!d.water && MapGen.isWater(t)) continue;
        return { col: n.col, row: n.row };
      }
      // radius 2 fallback
      for (const n of Hex.ring(city.col, city.row, 2)) {
        const t = this.map.get(n.col, n.row);
        if (!t || t.owner !== city.owner || t.districtKey || t.elevation === "mountain") continue;
        if (d.water && !MapGen.isWater(t)) continue;
        if (!d.water && MapGen.isWater(t)) continue;
        return { col: n.col, row: n.row };
      }
      return null;
    },

    setProduction(city, item) {
      city.buildQueue = item;
      // cost adjustment
      city._targetCost = item.cost;
    },

    completeProduction(city) {
      const item = city.buildQueue;
      if (!item) return;
      const p = this.player(city.owner);
      if (item.kind === "unit") {
        // place on city tile or adjacent
        let spot = { col: city.col, row: city.row };
        if (this.map.get(city.col, city.row).unitId) {
          const nb = Hex.neighbors(city.col, city.row).find(n => {
            const t = this.map.get(n.col, n.row);
            return t && !t.unitId && t.elevation !== "mountain" && !MapGen.isWater(t);
          });
          if (nb) spot = nb;
        }
        this.spawnUnit(item.key, spot.col, spot.row, city.owner);
        this.log(`${city.name} 生产了 ${item.name}。`, city.owner);
      } else if (item.kind === "district") {
        const spot = this.districtSpot(city, item.key);
        if (spot) {
          city.districts[item.key] = { col: spot.col, row: spot.row, buildings: [] };
          const t = this.map.get(spot.col, spot.row);
          t.districtKey = item.key; t.districtCity = city.id; t.owner = city.owner;
          this.log(`${city.name} 完成了 ${item.name} 区域。`, city.owner);
          this.giveBoostCivic(p, "stateWorkforce");
          if (item.key === "campus") this.checkCampusBoost(p);
          if (item.key === "holySite") this.giveBoostCivic(p, "mysticism");
          if (item.key === "encampment") this.giveBoostCivic(p, "militaryTraining");
          if (item.key === "entertainment") this.giveBoostCivic(p, "gamesRecreation");
        }
      } else if (item.kind === "building") {
        const b = D.BUILDING[item.key];
        if (city.districts[b.district]) city.districts[b.district].buildings.push(item.key);
        if (item.key === "walls") { city.wallHp = 100; city.maxHp += 100; this.giveBoostTech(p, "engineering"); }
        if (b.district === "campus") this.checkUniBoost(p, item.key);
        this.log(`${city.name} 建造了 ${item.name}。`, city.owner);
      } else if (item.kind === "wonder") {
        city.producedWonders.push(item.key);
        const spot = this.districtSpot(city, "wonderSpot") || Hex.neighbors(city.col, city.row).find(n => { const t = this.map.get(n.col, n.row); return t && t.owner === city.owner && !t.districtKey && !MapGen.isWater(t) && t.elevation !== "mountain"; });
        if (spot) { const t = this.map.get(spot.col, spot.row); if (t) { t.wonder = item.key; t.districtKey = "wonder"; } }
        this.log(`${city.name} 建成了 ${item.name}！`, city.owner);
        this.giveBoostCivic(p, "dramaPoetry");
        if (item.key === "pyramids") this.spawnUnit("builder", city.col, city.row, city.owner);
      }
      city.buildQueue = null; city.buildProgress = 0;
      this.assignWorkedTiles(city);
      this.emit("changed");
    },

    checkCampusBoost(p) {
      const n = this.citiesOf(p.id).filter(c => c.districts.campus).length;
      if (n >= 2) this.giveBoostTech(p, "recordedHistory");
    },
    checkUniBoost(p, key) { if (key === "university") this.giveBoostTech(p, "education"); },

    // ---------------- RESEARCH ----------------
    setResearchTech(p, key) { p.researchTech = key; },
    setResearchCivic(p, key) { p.researchCivic = key; },

    techUnlocked(p, key) {
      const t = D.TECH[key];
      return t.pre.every(pr => p.techsDone[pr]);
    },
    civicUnlocked(p, key) {
      const c = D.CIVIC[key];
      return c.pre.every(pr => p.civicsDone[pr]);
    },

    boostFactor(p) { return p.data && p.data.id === "china" ? 0.5 : 0.4; },

    giveBoostTech(p, key) {
      if (!p || !D.TECH[key] || p.techsDone[key] || p.boostsTech[key]) return;
      p.boostsTech[key] = true;
      const t = D.TECH[key];
      if (p.researchTech === key) p.techProgress += t.cost * this.boostFactor(p);
      if (p.isHuman) this.log(`尤里卡！${t.boost}（${t.name}）`);
      this.emit("changed");
    },
    giveBoostCivic(p, key) {
      if (!p || !D.CIVIC[key] || p.civicsDone[key] || p.boostsCivic[key]) return;
      p.boostsCivic[key] = true;
      const c = D.CIVIC[key];
      if (p.researchCivic === key) p.civicProgress += c.cost * this.boostFactor(p);
      if (p.isHuman) this.log(`鼓舞！${c.boost}（${c.name}）`);
      this.emit("changed");
    },

    // ---------------- TURN PROCESSING ----------------
    endTurn() {
      if (this.over) return;
      this.processPlayerEndTurn(this.human());
      // AI players
      for (let i = 1; i < this.players.length; i++) {
        if (this.players[i].alive) this.aiTurn(this.players[i]);
      }
      this.barbTurn();
      this.turn++;
      // reset all units
      for (const u of Object.values(this.units)) {
        u.moves = this.unitDef(u).maxMoves || this.unitDef(u).move;
        u.actedThisTurn = false;
        // heal fortified/garrisoned
        if (u.hp < 100 && (u.fortified || this.map.get(u.col, u.row).cityId)) u.hp = Math.min(100, u.hp + 10);
      }
      this.checkVictory();
      this.emit("turn");
      this.emit("changed");
    },

    processPlayerEndTurn(p) {
      const y = this.aggregateYields(p);
      // gold
      p.gold += y.gold;
      if (p.gold < 0) p.gold = Math.max(0, p.gold); // simplistic
      p.faith += y.faith;
      // research
      if (p.researchTech) {
        p.techProgress += y.sci;
        const t = D.TECH[p.researchTech];
        if (p.techProgress >= t.cost) { this.finishTech(p); }
      }
      if (p.researchCivic) {
        p.civicProgress += y.cul;
        const c = D.CIVIC[p.researchCivic];
        if (p.civicProgress >= c.cost) { this.finishCivic(p); }
      }
      // cities
      for (const city of this.citiesOf(p.id)) this.processCity(p, city);
    },

    aggregateYields(p) {
      const y = { food: 0, prod: 0, gold: 0, sci: 0, cul: 0, faith: 0 };
      for (const city of this.citiesOf(p.id)) {
        const cy = this.cityYields(city);
        for (const k in y) y[k] += cy[k];
      }
      // unit maintenance
      const units = this.unitsOf(p.id);
      const maint = Math.max(0, units.filter(u => this.unitDef(u).cls !== "civilian").length - 2);
      y.gold -= maint;
      return y;
    },

    processCity(p, city) {
      const cy = this.cityYields(city);
      const housing = this.cityHousing(city);
      // growth
      let foodSurplus = cy.food - city.pop * 2;
      if (city.pop >= housing) foodSurplus *= 0.25;
      if (city.pop >= housing + 5) foodSurplus = Math.min(0, foodSurplus);
      city.foodStore += foodSurplus;
      const thresh = this.growthThreshold(city.pop);
      if (city.foodStore >= thresh) {
        city.foodStore -= thresh; city.pop++;
        this.assignWorkedTiles(city);
        if (city.pop >= 6) this.giveBoostCivic(p, "earlyEmpire");
        if (p.isHuman) this.log(`${city.name} 人口增长到 ${city.pop}。`, p.id);
      } else if (city.foodStore < 0 && city.pop > 1) {
        city.foodStore = 0; // starvation guard (simplified)
      }
      // production
      if (city.buildQueue) {
        city.buildProgress += cy.prod;
        if (city.buildProgress >= city.buildQueue.cost) this.completeProduction(city);
      } else if (!p.isHuman) {
        this.aiChooseProduction(p, city);
      }
      // border growth via culture (every few turns)
      city._cultAccum = (city._cultAccum || 0) + cy.cul;
      const borderCost = 10 + city.tiles.length * 4;
      if (city._cultAccum >= borderCost) { city._cultAccum -= borderCost; this.expandBorder(city); }
    },

    finishTech(p) {
      const key = p.researchTech;
      p.techsDone[key] = true;
      const overflow = p.techProgress - D.TECH[key].cost;
      p.techProgress = 0;
      if (p.isHuman) this.log(`研究完成：${D.TECH[key].name}！`);
      this.updateEra(p);
      p.researchTech = null;
      if (!p.isHuman) this.aiChooseResearch(p);
      else this.emit("needTech");
      this.emit("changed");
    },
    finishCivic(p) {
      const key = p.researchCivic;
      p.civicsDone[key] = true;
      p.civicProgress = 0;
      if (p.isHuman) this.log(`采纳了市政：${D.CIVIC[key].name}！`);
      this.updateEra(p);
      p.researchCivic = null;
      // unlock government
      if (key === "codeOfLaws" && p.government === "chiefdom") { /* stays chiefdom until PP */ }
      if (key === "politicalPhilosophy" && !p.isHuman) p.government = "autocracy";
      if (!p.isHuman) this.aiChooseCivicResearch(p);
      else this.emit("needCivic");
      this.emit("changed");
    },

    updateEra(p) {
      const doneEras = {};
      for (const k in p.techsDone) doneEras[D.TECH[k].era] = (doneEras[D.TECH[k].era] || 0) + 1;
      for (const k in p.civicsDone) doneEras[D.CIVIC[k].era] = (doneEras[D.CIVIC[k].era] || 0) + 1;
      const order = D.ERAS;
      let era = "Ancient";
      const total = Object.keys(p.techsDone).length + Object.keys(p.civicsDone).length;
      if (total >= 20) era = "Medieval"; else if (total >= 10) era = "Classical";
      p.era = era;
    },

    // ---------------- AI ----------------
    aiTurn(p) {
      if (!p.researchTech) this.aiChooseResearch(p);
      if (!p.researchCivic) this.aiChooseCivicResearch(p);
      const units = this.unitsOf(p.id);
      for (const u of units) this.aiMoveUnit(p, u);
      for (const city of this.citiesOf(p.id)) if (!city.buildQueue) this.aiChooseProduction(p, city);
      this.processPlayerEndTurn(p);
    },

    aiMoveUnit(p, u) {
      const def = this.unitDef(u);
      if (def.founds) {
        // settle if decent spot and far from own cities
        const good = !this.tooCloseToCity(u.col, u.row, u.owner) && !MapGen.isWater(this.map.get(u.col, u.row));
        if (good && this.citiesOf(p.id).length < 6) { this.foundCity(u); return; }
        // wander
        this.aiWander(u); return;
      }
      if (def.builds) { this.aiBuilder(p, u); return; }
      // military: attack nearest enemy in range, else patrol near capital / hunt barbs
      const target = this.aiFindTarget(p, u);
      if (target) {
        if (def.cls === "ranged" || def.cls === "siege") {
          if (Hex.distance(u.col, u.row, target.col, target.row) <= def.range && u.moves > 0) { this.rangedAttack(u, target); return; }
        }
        this.moveUnitTo(u, target.col, target.row); return;
      }
      this.aiWander(u);
    },

    aiFindTarget(p, u) {
      let best = null, bd = 6;
      for (const o of Object.values(this.units)) {
        if (o.owner === u.owner) continue;
        if (!this.isEnemy(u.owner, o.owner) && o.owner !== this.barbId) continue;
        const d = Hex.distance(u.col, u.row, o.col, o.row);
        if (d < bd) { bd = d; best = o; }
      }
      return best;
    },

    aiWander(u) {
      const nb = Hex.neighbors(u.col, u.row).filter(n => {
        const t = this.map.get(n.col, n.row);
        return t && this.passable(t, u) && !MapGen.isWater(t) && t.elevation !== "mountain";
      });
      if (nb.length && u.moves > 0) { const n = nb[Math.floor(Math.random() * nb.length)]; this.moveUnitTo(u, n.col, n.row); }
    },

    aiBuilder(p, u) {
      const t = this.map.get(u.col, u.row);
      if (u.charges > 0 && this.canImprove(p, t)) { this.buildImprovement(u, t); return; }
      // move to nearest improvable owned tile
      let best = null, bd = 99;
      for (const city of this.citiesOf(p.id)) {
        for (const pt of city.tiles) {
          const tt = this.map.get(pt.col, pt.row);
          if (this.canImprove(p, tt) && !tt.improvement) {
            const d = Hex.distance(u.col, u.row, pt.col, pt.row);
            if (d < bd) { bd = d; best = tt; }
          }
        }
      }
      if (best) this.moveUnitTo(u, best.col, best.row);
      else this.aiWander(u);
    },

    tooCloseToCity(col, row, owner) {
      return Object.values(this.cities).some(c => Hex.distance(c.col, c.row, col, row) < 4);
    },

    aiChooseResearch(p) {
      const avail = Object.keys(D.TECH).filter(k => !p.techsDone[k] && this.techUnlocked(p, k));
      if (avail.length) { avail.sort((a, b) => D.TECH[a].cost - D.TECH[b].cost); p.researchTech = avail[0]; }
    },
    aiChooseCivicResearch(p) {
      const avail = Object.keys(D.CIVIC).filter(k => !p.civicsDone[k] && this.civicUnlocked(p, k));
      if (avail.length) { avail.sort((a, b) => D.CIVIC[a].cost - D.CIVIC[b].cost); p.researchCivic = avail[0]; }
    },
    aiChooseProduction(p, city) {
      const opts = this.productionOptions(city);
      if (!opts.length) return;
      const nCities = this.citiesOf(p.id).length;
      const nSettlers = this.unitsOf(p.id).filter(u => u.type === "settler").length;
      const nMil = this.unitsOf(p.id).filter(u => this.unitDef(u).cls !== "civilian").length;
      let pick = null;
      const byKey = k => opts.find(o => o.key === k);
      if (nMil < 1) pick = byKey("warrior");
      if (!pick && nCities < 4 && nSettlers === 0 && city.pop >= 2 && this.turn > 3) pick = byKey("settler");
      if (!pick && !city.districts.campus) pick = byKey("campus");
      if (!pick) pick = byKey("monument") || byKey("builder") || byKey("library");
      if (!pick) pick = opts.find(o => o.kind === "building") || opts.find(o => o.kind === "district") || opts[0];
      if (pick) this.setProduction(city, pick);
    },

    barbTurn() {
      for (const u of this.unitsOf(this.barbId)) {
        const target = this.aiFindTarget(this.barbPlayer, u);
        if (target && Hex.distance(u.col, u.row, target.col, target.row) <= 4) {
          this.moveUnitTo(u, target.col, target.row);
        } else this.aiWander(u);
      }
    },

    // ---------------- BUILDER / IMPROVEMENTS ----------------
    canImprove(p, t) {
      if (!t || MapGen.isWater(t) && !this.waterImprovable(p, t)) {}
      if (!t) return false;
      if (t.cityId) return false;
      if (t.districtKey) return false;
      const opt = this.improvementFor(p, t);
      return !!opt && t.improvement !== opt;
    },
    waterImprovable(p, t) { return t.resource && D.RES[t.resource]; },

    improvementFor(p, t) {
      for (const key in D.IMPROVEMENT) {
        const im = D.IMPROVEMENT[key];
        if (im.tech && !p.techsDone[im.tech]) continue;
        if (im.onRes && t.resource && im.onRes.includes(t.resource)) return key;
        if (im.onFeature && t.feature && im.onFeature.includes(t.feature)) return key;
        if (im.onElev && im.onElev.includes(t.elevation) && !t.resource) {
          if (key === "mine" && t.elevation === "hills") return key;
        }
        if (im.on && im.on.includes(t.terrain) && !t.feature && t.elevation === "flat" && !t.resource) {
          if (key === "farm") return key;
        }
      }
      return null;
    },

    buildImprovement(u, t) {
      const p = this.player(u.owner);
      const key = this.improvementFor(p, t);
      if (!key) return false;
      t.improvement = key;
      if (t.feature === "woods" || t.feature === "rainforest") { if (key === "farm" || key === "mine") t.feature = null; }
      u.charges--; u.moves = 0;
      const boostImpr = { farm: "irrigation", mine: "mining", quarry: "masonry" };
      // count for boosts
      p._imprCount = (p._imprCount || 0) + 1;
      if (p._imprCount >= 3) this.giveBoostCivic(p, "craftsmanship");
      if (key === "farm" && t.resource) this.giveBoostTech(p, "irrigation");
      if (key === "quarry") this.giveBoostTech(p, "masonry");
      if (key === "pasture") this.giveBoostTech(p, "animalHusbandry");
      if (key === "mine") { p._mineCount = (p._mineCount || 0) + 1; if (p._mineCount >= 3) this.giveBoostTech(p, "apprenticeship"); if (t.resource === "iron") this.giveBoostTech(p, "ironWorking"); }
      // recompute worked tiles for owning city
      if (t.cityId) { const c = this.cities[t.cityId]; if (c) this.assignWorkedTiles(c); }
      else { const c = this.cityOwningTile(t); if (c) this.assignWorkedTiles(c); }
      if (u.charges <= 0) this.removeUnit(u);
      this.emit("changed");
      return true;
    },
    cityOwningTile(t) { return t.cityId ? this.cities[t.cityId] : Object.values(this.cities).find(c => c.tiles.some(pt => pt.col === t.col && pt.row === t.row)); },

    // ---------------- FOG OF WAR ----------------
    revealAround(p) {
      if (!p) return;
      // reset visible
      for (const t of this.map.tiles) t.visible[p.id] = false;
      const reveal = (col, row, radius) => {
        for (const n of Hex.ring(col, row, radius)) {
          const t = this.map.get(n.col, n.row);
          if (!t) continue;
          t.explored[p.id] = true; t.visible[p.id] = true;
          // meet other civs / boosts
          if (t.unitId) { const o = this.units[t.unitId]; if (o && o.owner !== p.id && o.owner !== this.barbId) this.meet(p, this.player(o.owner)); }
          if (t.cityId) { const c = this.cities[t.cityId]; if (c && c.owner !== p.id && c.owner !== this.barbId) this.meet(p, this.player(c.owner)); }
        }
      };
      for (const u of this.unitsOf(p.id)) {
        let r = 2; const t = this.map.get(u.col, u.row);
        if (t && t.elevation === "hills") r = 3;
        if (this.unitDef(u).cls === "recon") r++;
        reveal(u.col, u.row, r);
      }
      for (const c of this.citiesOf(p.id)) reveal(c.col, c.row, 3);
    },

    meet(p, other) {
      if (!other || !p || p.id === other.id) return;
      if (!p.met[other.id]) {
        p.met[other.id] = true; other.met[p.id] = true;
        this.giveBoostTech(p, "writing");
        this.giveBoostCivic(p, "foreignTrade");
        if (p.isHuman) this.log(`你遇见了 ${other.data.civ} 的 ${other.data.leader}！`);
      }
    },

    // ---------------- VICTORY ----------------
    checkVictory() {
      const alivePlayers = this.players.filter(p => p.alive && (this.citiesOf(p.id).length > 0 || this.turn < 6));
      // domination: only one civ with cities
      const withCities = this.players.filter(p => this.citiesOf(p.id).length > 0);
      this.players.forEach(p => { if (p.alive && this.citiesOf(p.id).length === 0 && this.turn > 5) { p.alive = false; if (p.isHuman) this.endGame(false, "你的文明已经覆灭！"); } });
      if (withCities.length === 1 && this.players.length > 1) {
        const w = withCities[0];
        this.endGame(w.isHuman, `${w.data.civ} 取得了统治胜利！`);
      }
      // science victory (all techs)
      const human = this.human();
      if (Object.keys(human.techsDone).length >= Object.keys(D.TECH).length) {
        this.endGame(true, "科技胜利！你掌握了所有科技！");
      }
      // culture: all civics
      if (Object.keys(human.civicsDone).length >= Object.keys(D.CIVIC).length) {
        this.endGame(true, "文化胜利！你完成了整个市政树！");
      }
      if (this.turn > 250) this.endGame(true, "时间胜利——游戏已到达终点。");
    },

    endGame(won, msg) {
      if (this.over) return;
      this.over = true;
      this.emit("gameover", { won, msg });
    },

    log(msg, owner) {
      if (owner !== undefined && owner !== 0) return;
      this.emit("log", msg);
    }
  };

  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } }

  global.Game = Game;
})(window);
