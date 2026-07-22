// ============================================================
// fleet.js - 舰队与舰船管理
// ============================================================

function newShip(shipClass, empire, game) {
  const def = SHIP_CLASSES[shipClass];
  // 应用科技加成
  let shield = 0, armor = def.armor;
  for (const tid of empire.techs) {
    const t = findTech(tid);
    if (!t) continue;
    if (t.effect.shipShield) shield += t.effect.shipShield;
    if (t.effect.shipArmor) armor += t.effect.shipArmor;
  }
  return {
    id: uid(),
    class: shipClass,
    name: def.name,
    hull: def.hull, maxHull: def.hull,
    armor, maxArmor: armor,
    shield, maxShield: shield,
    weapon: pick(["laser", "kinetic", "missile"]),
  };
}

function newFleet(empire, systemId, game, opts = {}) {
  const fleet = {
    id: uid(),
    empireId: empire.id,
    name: opts.name || (empire.speciesName + " 舰队"),
    ships: [],
    systemId,
    x: 0, y: 0, // 系统内坐标 (galaxy view use system coords)
    path: null,       // 系统id路径
    pathIndex: 0,
    moveProgress: 0,  // 0..1 沿当前跳跃段
    destSystemId: null,
    civilian: opts.civilian || null, // 'science' | 'construction' | 'colony'
    order: null,      // { type: 'survey'|'build'|'colonize'|'move', ... }
    autoExplore: false,
  };
  empire.fleets.push(fleet.id);
  game.fleetsById[fleet.id] = fleet;
  const sys = game.systemsById[systemId];
  if (sys && !sys.fleets.includes(fleet.id)) sys.fleets.push(fleet.id);
  return fleet;
}

function fleetPower(fleet, empire, game) {
  let power = 0;
  const fireBonus = empire ? getModifier(empire, "shipFire") : 0;
  for (const ship of fleet.ships) {
    const def = SHIP_CLASSES[ship.class];
    if (!def) continue;
    power += (def.baseFire * (1 + fireBonus)) + (ship.hull + ship.armor + ship.shield) * 0.05;
  }
  return Math.round(power);
}

function fleetNavalUse(fleet) {
  let n = 0;
  for (const ship of fleet.ships) {
    const def = SHIP_CLASSES[ship.class];
    if (def) n += def.navalCap;
  }
  return n;
}

// 下达移动指令
function orderFleetMove(fleet, destSystemId, game) {
  if (fleet.systemId === destSystemId) {
    fleet.path = null;
    fleet.destSystemId = null;
    return true;
  }
  const path = findPath(game.systems, fleet.systemId, destSystemId);
  if (!path) return false;
  fleet.path = path;
  fleet.pathIndex = 0;
  fleet.moveProgress = 0;
  fleet.destSystemId = destSystemId;
  return true;
}

// 每 tick 更新舰队移动
function updateFleetMovement(fleet, game, daysElapsed) {
  if (!fleet.path || fleet.pathIndex >= fleet.path.length - 1) {
    fleet.path = null;
    return;
  }
  const empire = game.empiresById[fleet.empireId];
  const speedMod = empire ? getModifier(empire, "shipSpeed") : 0;
  // 每段跳跃基础速度
  const segSpeed = 0.35 * (1 + speedMod) * daysElapsed;
  fleet.moveProgress += segSpeed;

  if (fleet.moveProgress >= 1) {
    fleet.moveProgress = 0;
    // 离开当前系统
    const curSys = game.systemsById[fleet.systemId];
    if (curSys) curSys.fleets = curSys.fleets.filter(f => f !== fleet.id);
    fleet.pathIndex++;
    fleet.systemId = fleet.path[fleet.pathIndex];
    const newSys = game.systemsById[fleet.systemId];
    if (newSys && !newSys.fleets.includes(fleet.id)) newSys.fleets.push(fleet.id);

    // 到达新系统: 探索
    onFleetEnterSystem(fleet, newSys, game);

    if (fleet.pathIndex >= fleet.path.length - 1) {
      fleet.path = null;
      onFleetArrive(fleet, game);
    }
  }
}

function onFleetEnterSystem(fleet, sys, game) {
  if (!sys) return;
  const empire = game.empiresById[fleet.empireId];
  if (empire && empire.isPlayer) {
    if (!sys.explored) {
      sys.explored = true;
    }
  }
  // 遭遇敌对舰队 -> 触发战斗 (在 game loop 中检测)
}

function onFleetArrive(fleet, game) {
  const empire = game.empiresById[fleet.empireId];
  const sys = game.systemsById[fleet.systemId];
  if (!fleet.order) return;
  const o = fleet.order;
  if (o.type === "survey" && fleet.civilian === "science") {
    // 到达后开始勘测(在tick处理)
  } else if (o.type === "colonize" && fleet.civilian === "colony") {
    // 到达后殖民
    const planet = game.planetsById[o.planetId];
    if (planet && sys.owner === empire.id && !planet.colonized) {
      colonizePlanet(planet, empire, game);
      if (!empire.ownedPlanets.includes(planet.id)) empire.ownedPlanets.push(planet.id);
      game.notify(empire, `殖民地已建立: ${planet.name}`, "good");
      // 消耗殖民船
      removeFleet(fleet, game);
    }
  }
}

function removeFleet(fleet, game) {
  const empire = game.empiresById[fleet.empireId];
  if (empire) empire.fleets = empire.fleets.filter(f => f !== fleet.id);
  const sys = game.systemsById[fleet.systemId];
  if (sys) sys.fleets = sys.fleets.filter(f => f !== fleet.id);
  delete game.fleetsById[fleet.id];
}

// 星基建造前哨站 (宣称系统)
function claimSystem(sys, empire, game) {
  if (sys.owner) return false;
  sys.owner = empire.id;
  sys.starbase = { level: "outpost", modules: [], anchorages: 0, tradeHubs: 0, shipyards: 0, shipyardQueue: [] };
  if (!empire.ownedSystems.includes(sys.id)) empire.ownedSystems.push(sys.id);
  return true;
}

// 星基升级
function upgradeStarbase(sys, empire, game) {
  if (!sys.starbase) return false;
  const idx = STARBASE_ORDER.indexOf(sys.starbase.level);
  if (idx >= STARBASE_ORDER.length - 1) return false;
  const nextLevel = STARBASE_ORDER[idx + 1];
  // 检查科技解锁
  const maxIdx = STARBASE_ORDER.indexOf(empire.maxStarbaseLevel);
  if (idx + 1 > maxIdx) return { error: "需要科技解锁" };
  const cost = STARBASE_LEVELS[nextLevel].cost;
  if (!canAfford(empire, cost)) return { error: "资源不足" };
  spend(empire, cost);
  sys.starbase.level = nextLevel;
  sys.starbase.shipyards = STARBASE_LEVELS[nextLevel].shipyards;
  return true;
}

function canAfford(empire, cost) {
  for (const r in cost) if (empire.resources[r] < cost[r]) return false;
  return true;
}
function spend(empire, cost) {
  for (const r in cost) empire.resources[r] -= cost[r];
}
