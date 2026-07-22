// ============================================================
// ai.js - AI 帝国行为
// ============================================================

function runAI(empire, game) {
  if (!empire.isAI) return;
  empire.aiState.buildTimer = (empire.aiState.buildTimer || 0);

  aiManageResearch(empire, game);
  aiManageEconomy(empire, game);
  aiManageExpansion(empire, game);
  aiManageFleets(empire, game);
  aiManageDiplomacy(empire, game);
}

// AI 选研究
function aiManageResearch(empire, game) {
  for (const area of ["physics", "society", "engineering"]) {
    if (!empire.research[area]) {
      const opts = empire.researchOptions[area];
      if (opts && opts.length) {
        // AI 偏好: 军事和经济
        empire.research[area] = opts[0];
      } else {
        drawResearchOptions(empire, area, game);
        if (empire.researchOptions[area].length) empire.research[area] = empire.researchOptions[area][0];
      }
    }
  }
}

// AI 经济: 建造区划/建筑
function aiManageEconomy(empire, game) {
  for (const pid of empire.ownedPlanets) {
    const planet = game.planetsById[pid];
    if (!planet || !planet.colonized) continue;
    if (planet.buildQueue.length > 0) continue;

    const totalDist = planet.districts.city + planet.districts.generator + planet.districts.mining + planet.districts.agriculture;
    // 优先补足就业
    if (planet._unemployed > 0 || (planet._jobsAvailable || 0) <= planet.pops.length) {
      // 根据缺口建区划
      let choice = "generator";
      const inc = empire.income;
      if (inc.minerals < 5) choice = "mining";
      else if (inc.food < 3) choice = "agriculture";
      else if (inc.energy < 5) choice = "generator";
      else choice = pick(["generator", "mining", "city"]);

      if (totalDist < planet.districtCap && canAfford(empire, DISTRICTS[choice].cost)) {
        spend(empire, DISTRICTS[choice].cost);
        planet.buildQueue.push({ type: "district", key: choice, progress: 0, time: 90 });
      } else if (planet.buildings.length < 6 + totalDist / 4) {
        // 建建筑
        const b = pick(["research_lab", "foundry", "industries", "admin"]);
        const cost = BUILDINGS[b].cost;
        if (canAfford(empire, cost)) {
          spend(empire, cost);
          planet.buildQueue.push({ type: "building", key: b, progress: 0, time: 120 });
        }
      }
    }
  }
}

// AI 扩张: 派科研船勘探, 工程船建前哨
function aiManageExpansion(empire, game) {
  // 确保有科研船在探索
  let hasScience = false, hasConstruction = false;
  for (const fid of empire.fleets) {
    const f = game.fleetsById[fid];
    if (!f) continue;
    if (f.civilian === "science") { hasScience = true; if (!f.path && !f.order) aiSendScienceToExplore(f, empire, game); }
    if (f.civilian === "construction") { hasConstruction = true; if (!f.path && !f.order) aiSendConstruction(f, empire, game); }
  }

  // 造更多殖民船占领已勘测宜居星
  aiTryColonize(empire, game);
}

function aiSendScienceToExplore(fleet, empire, game) {
  // 找最近未勘测系统
  const cur = game.systemsById[fleet.systemId];
  let best = null, bestD = Infinity;
  for (const sysId in game.systemsById) {
    const sys = game.systemsById[sysId];
    if (sys.surveyed) continue;
    if (sys.hostile) continue;
    const d = dist(cur, sys);
    if (d < bestD) { bestD = d; best = sys; }
  }
  if (best) {
    orderFleetMove(fleet, best.id, game);
    fleet.order = { type: "survey" };
  }
}

function aiSendConstruction(fleet, empire, game) {
  // 找已勘测且未占领的相邻系统建前哨, 或建太空站
  const cur = game.systemsById[fleet.systemId];
  // 当前系统有未开发矿点?
  if (cur.owner === empire.id) {
    for (const dep of cur.deposits) {
      if (!dep.station) {
        fleet.order = { type: "build_station", depId: dep.id, sysId: cur.id, progress: 0 };
        return;
      }
    }
  }
  // 找可宣称的相邻已勘测系统
  let best = null, bestD = Infinity;
  for (const sysId of empire.ownedSystems) {
    const owned = game.systemsById[sysId];
    for (const nId of owned.hyperlanes) {
      const n = game.systemsById[nId];
      if (n.owner || !n.surveyed) continue;
      if (n.hostile) continue;
      const d = dist(cur, n);
      if (d < bestD && empire.resources.influence >= 75) { bestD = d; best = n; }
    }
  }
  if (best) {
    orderFleetMove(fleet, best.id, game);
    fleet.order = { type: "build_outpost", sysId: best.id, progress: 0 };
  }
}

function aiTryColonize(empire, game) {
  // 是否有空闲殖民船
  for (const fid of empire.fleets) {
    const f = game.fleetsById[fid];
    if (f && f.civilian === "colony" && !f.path && !f.order) {
      // 找自己领土内宜居星
      const target = findColonizable(empire, game);
      if (target) {
        orderFleetMove(f, target.systemId, game);
        f.order = { type: "colonize", planetId: target.id };
        return;
      }
    }
  }
  // 建殖民船 (若有未殖民宜居星 & 资源充足)
  if (empire.techs.includes("colony_1") || true) {
    const target = findColonizable(empire, game);
    if (target && canAfford(empire, CIVILIAN_SHIPS.colony.cost)) {
      const shipyard = findShipyard(empire, game);
      if (shipyard && !hasColonyInQueue(shipyard)) {
        spend(empire, CIVILIAN_SHIPS.colony.cost);
        shipyard.starbase.shipyardQueue.push({ ship: "colony", civilian: true, progress: 0, time: CIVILIAN_SHIPS.colony.buildTime });
      }
    }
  }
}

function findColonizable(empire, game) {
  for (const sysId of empire.ownedSystems) {
    const sys = game.systemsById[sysId];
    for (const p of sys.planets) {
      if (PLANET_CLASSES[p.class].type === "habitable" && !p.colonized && p.habitability >= 40) {
        // 确认没有已派殖民船
        let claimed = false;
        for (const fid of empire.fleets) {
          const f = game.fleetsById[fid];
          if (f && f.order && f.order.type === "colonize" && f.order.planetId === p.id) claimed = true;
        }
        if (!claimed) return p;
      }
    }
  }
  return null;
}

function findShipyard(empire, game) {
  for (const sysId of empire.ownedSystems) {
    const sys = game.systemsById[sysId];
    if (sys.starbase && sys.starbase.shipyards > 0) return sys;
  }
  return null;
}
function hasColonyInQueue(sys) {
  return sys.starbase.shipyardQueue.some(q => q.ship === "colony");
}

// AI 舰队: 建军舰, 防御, 进攻
function aiManageFleets(empire, game) {
  // 升级星基到有船坞
  const home = game.systemsById[empire.homeSystemId];
  if (home && home.starbase && home.starbase.level === "outpost" && canAfford(empire, STARBASE_LEVELS.starport.cost)) {
    upgradeStarbase(home, empire, game);
  }

  // 造军舰 (维持海军)
  const usedNaval = totalNavalUse(empire, game);
  if (usedNaval < empire.navalCap - 2 && empire.resources.alloys > 60) {
    const shipyard = findShipyard(empire, game);
    if (shipyard && shipyard.starbase.shipyardQueue.filter(q => !q.civilian).length < 2) {
      // 选最好的解锁舰船
      let best = "corvette";
      for (const s of ["destroyer", "cruiser", "battleship"]) {
        if (empire.unlockedShips.includes(s)) best = s;
      }
      const cost = SHIP_CLASSES[best].cost;
      if (canAfford(empire, cost)) {
        spend(empire, cost);
        shipyard.starbase.shipyardQueue.push({ ship: best, progress: 0, time: SHIP_CLASSES[best].buildTime });
      }
    }
  }

  // 合并军舰为主力舰队并防御/进攻
  const warFleets = [];
  for (const fid of empire.fleets) {
    const f = game.fleetsById[fid];
    if (f && !f.civilian && f.ships.length > 0) warFleets.push(f);
  }

  // 若在战争中, 集结进攻
  for (const eid in empire.relations) {
    if (empire.relations[eid].atWar) {
      const enemy = game.empiresById[eid];
      if (!enemy) continue;
      const myPower = warFleets.reduce((s, f) => s + fleetPower(f, empire, game), 0);
      const enemyPower = estimateEmpirePower(enemy, game);
      if (myPower > enemyPower * 1.2 && enemy.ownedSystems.length) {
        // 进攻最近敌方系统
        const target = game.systemsById[enemy.ownedSystems[0]];
        for (const f of warFleets) {
          if (!f.path) orderFleetMove(f, target.id, game);
        }
      }
      return;
    }
  }

  // 和平: 军舰回防首都, 清理本土海盗
  for (const f of warFleets) {
    if (f.path) continue;
    // 清理领土内海盗
    let hostileSys = null;
    for (const sid of empire.ownedSystems) {
      const s = game.systemsById[sid];
      if (s.hostile && fleetPower(f, empire, game) > s.hostile.power * 3) { hostileSys = s; break; }
    }
    if (hostileSys) { orderFleetMove(f, hostileSys.id, game); }
    else if (f.systemId !== empire.homeSystemId) { orderFleetMove(f, empire.homeSystemId, game); }
  }
}

function totalNavalUse(empire, game) {
  let n = 0;
  for (const fid of empire.fleets) {
    const f = game.fleetsById[fid];
    if (f && !f.civilian) n += fleetNavalUse(f);
  }
  return n;
}

function estimateEmpirePower(empire, game) {
  let p = 0;
  for (const fid of empire.fleets) {
    const f = game.fleetsById[fid];
    if (f && !f.civilian) p += fleetPower(f, empire, game);
  }
  return p;
}

// AI 外交
function aiManageDiplomacy(empire, game) {
  for (const other of game.empires) {
    if (other.id === empire.id) continue;
    if (!empire.known.includes(other.id)) continue;
    if (!empire.relations[other.id]) {
      empire.relations[other.id] = { attitude: 0, atWar: false, truce: 0 };
    }
    const rel = empire.relations[other.id];
    if (rel.truce > 0) { rel.truce--; continue; }

    // 理念冲突降低态度
    let attitude = rel.attitude;
    // 宣战判断: 军事优势 + 敌意
    if (!rel.atWar && Math.random() < 0.002) {
      const myP = estimateEmpirePower(empire, game);
      const theirP = estimateEmpirePower(other, game);
      if (myP > theirP * 1.5 && myP > 100) {
        declareWar(empire, other, game);
      }
    }
  }
}

function declareWar(a, b, game) {
  if (!a.relations[b.id]) a.relations[b.id] = { attitude: 0, atWar: false, truce: 0 };
  if (!b.relations[a.id]) b.relations[a.id] = { attitude: 0, atWar: false, truce: 0 };
  a.relations[b.id].atWar = true;
  b.relations[a.id].atWar = true;
  if (!a.known.includes(b.id)) a.known.push(b.id);
  if (!b.known.includes(a.id)) b.known.push(a.id);
  game.notify(a, `向 ${b.name} 宣战!`, "warn");
  game.notify(b, `${a.name} 向你宣战!`, "bad");
}

function makePeace(a, b, game) {
  if (a.relations[b.id]) { a.relations[b.id].atWar = false; a.relations[b.id].truce = 120; }
  if (b.relations[a.id]) { b.relations[a.id].atWar = false; b.relations[a.id].truce = 120; }
  game.notify(a, `与 ${b.name} 缔结和平`, "good");
  game.notify(b, `与 ${a.name} 缔结和平`, "good");
}
