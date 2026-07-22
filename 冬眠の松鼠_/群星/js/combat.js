// ============================================================
// combat.js - 战斗系统 (回合制简化战斗)
// ============================================================

// 检测同一系统内的敌对舰队, 触发战斗
function checkCombat(game) {
  for (const sysId in game.systemsById) {
    const sys = game.systemsById[sysId];
    if (sys.fleets.length < 1) continue;

    // 按帝国分组
    const byEmpire = {};
    for (const fid of sys.fleets) {
      const fleet = game.fleetsById[fid];
      if (!fleet || fleet.ships.length === 0) continue;
      (byEmpire[fleet.empireId] = byEmpire[fleet.empireId] || []).push(fleet);
    }
    const empireIds = Object.keys(byEmpire);

    // 敌对生物 (海盗)
    if (sys.hostile && empireIds.length > 0) {
      // 玩家/AI vs 海盗
      for (const eid of empireIds) {
        resolveVsHostile(byEmpire[eid], sys, game);
        if (!sys.hostile) break;
      }
      continue;
    }

    if (empireIds.length < 2) continue;

    // 找出互相敌对的两方
    for (let i = 0; i < empireIds.length; i++) {
      for (let j = i + 1; j < empireIds.length; j++) {
        const a = game.empiresById[empireIds[i]];
        const b = game.empiresById[empireIds[j]];
        if (!a || !b) continue;
        if (areAtWar(a, b)) {
          resolveBattle(byEmpire[empireIds[i]], byEmpire[empireIds[j]], a, b, sys, game);
        }
      }
    }
  }
}

function areAtWar(a, b) {
  return a.relations[b.id] && a.relations[b.id].atWar;
}

// 一场战斗 (逐轮消耗)
function resolveBattle(fleetsA, fleetsB, empA, empB, sys, game) {
  const shipsA = fleetsA.flatMap(f => f.ships);
  const shipsB = fleetsB.flatMap(f => f.ships);
  if (shipsA.length === 0 || shipsB.length === 0) return;

  // 单轮伤害 (每次tick打一轮)
  const dmgToB = totalDamage(shipsA, empA);
  const dmgToA = totalDamage(shipsB, empB);

  applyDamage(shipsB, dmgToB);
  applyDamage(shipsA, dmgToA);

  cleanupFleets(fleetsA, empA, game);
  cleanupFleets(fleetsB, empB, game);

  const aAlive = fleetsA.some(f => f.ships.length > 0);
  const bAlive = fleetsB.some(f => f.ships.length > 0);

  if (!aAlive || !bAlive) {
    const winner = aAlive ? empA : empB;
    const loser = aAlive ? empB : empA;
    game.notify(winner, `在 ${sys.name} 的战斗中获胜!`, "good");
    game.notify(loser, `在 ${sys.name} 的舰队被消灭!`, "bad");
    // 若失败方星基还在且胜方有战力, 攻击星基
  }

  // 攻击星基
  if (sys.starbase && sys.starbase.level) {
    const sbOwner = sys.owner;
    let attackers = null, attEmp = null;
    if (aAlive && empB.id === sbOwner) { attackers = shipsA.filter(s => s.hull > 0); attEmp = empA; }
    else if (bAlive && empA.id === sbOwner) { attackers = shipsB.filter(s => s.hull > 0); attEmp = empB; }
    if (attackers && attackers.length) {
      sys.starbase.hp = sys.starbase.hp ?? STARBASE_LEVELS[sys.starbase.level].hull;
      sys.starbase.hp -= totalDamage(attackers, attEmp);
      // 星基反击
      const sbFire = STARBASE_LEVELS[sys.starbase.level].fire;
      applyDamage(attackers, sbFire);
      if (sys.starbase.hp <= 0) {
        conquerSystem(sys, attEmp, game);
      }
    }
  }
}

function resolveVsHostile(fleets, sys, game) {
  const empire = game.empiresById[fleets[0].empireId];
  const ships = fleets.flatMap(f => f.ships);
  if (ships.length === 0) return;
  const dmgToEnemy = totalDamage(ships, empire);
  sys.hostile.hp -= dmgToEnemy;
  applyDamage(ships, sys.hostile.power * 0.8);
  cleanupFleets(fleets, empire, game);
  if (sys.hostile.hp <= 0) {
    game.notify(empire, `清除了 ${sys.name} 的太空威胁!`, "good");
    sys.hostile = null;
  }
}

function totalDamage(ships, empire) {
  let d = 0;
  const fireBonus = empire ? getModifier(empire, "shipFire") : 0;
  for (const s of ships) {
    if (s.hull <= 0) continue;
    const def = SHIP_CLASSES[s.class];
    d += def.baseFire * (1 + fireBonus);
  }
  return d;
}

// 分配伤害: 先打护盾, 再装甲, 再船体; 应用武器倍率(简化取平均)
function applyDamage(ships, totalDmg) {
  const alive = ships.filter(s => s.hull > 0);
  if (alive.length === 0) return;
  let remaining = totalDmg;
  // 集火: 逐个摧毁
  for (const s of alive) {
    if (remaining <= 0) break;
    // 护盾
    if (s.shield > 0) {
      const d = Math.min(s.shield, remaining);
      s.shield -= d; remaining -= d;
    }
    if (remaining <= 0) break;
    if (s.armor > 0) {
      const d = Math.min(s.armor, remaining);
      s.armor -= d; remaining -= d;
    }
    if (remaining <= 0) break;
    const d = Math.min(s.hull, remaining);
    s.hull -= d; remaining -= d;
  }
}

function cleanupFleets(fleets, empire, game) {
  for (const fleet of fleets) {
    fleet.ships = fleet.ships.filter(s => s.hull > 0);
    // 恢复护盾(战斗后每轮部分)
    for (const s of fleet.ships) {
      s.shield = Math.min(s.maxShield, s.shield + s.maxShield * 0.1);
    }
    if (fleet.ships.length === 0) {
      removeFleet(fleet, game);
    }
  }
}

// 征服系统
function conquerSystem(sys, empire, game) {
  const oldOwner = game.empiresById[sys.owner];
  if (oldOwner) {
    oldOwner.ownedSystems = oldOwner.ownedSystems.filter(s => s !== sys.id);
    // 行星易主
    for (const p of sys.planets) {
      if (p.colonized && p.owner === oldOwner.id) {
        oldOwner.ownedPlanets = oldOwner.ownedPlanets.filter(pp => pp !== p.id);
        p.owner = empire.id;
        empire.ownedPlanets.push(p.id);
      }
    }
  }
  sys.owner = empire.id;
  sys.starbase = { level: "outpost", modules: [], anchorages: 0, tradeHubs: 0, shipyards: 0, shipyardQueue: [], hp: STARBASE_LEVELS.outpost.hull };
  if (!empire.ownedSystems.includes(sys.id)) empire.ownedSystems.push(sys.id);
  game.notify(empire, `占领了系统 ${sys.name}!`, "good");
  if (oldOwner) game.notify(oldOwner, `失去了系统 ${sys.name}!`, "bad");
}

// 生成太空海盗/生物
function spawnHostiles(game) {
  for (const sysId in game.systemsById) {
    const sys = game.systemsById[sysId];
    if (sys.owner || sys.hostile) continue;
    if (Math.random() < 0.12) {
      sys.hostile = {
        name: pick(["太空阿米巴", "晶体实体", "虚空云", "掠夺者巢穴"]),
        hp: randInt(400, 1200),
        maxHp: 1200,
        power: randInt(15, 45),
      };
    }
  }
}
