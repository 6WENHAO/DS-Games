// ============================================================
// game.js - 游戏核心 (状态, tick循环, 研究抽卡)
// ============================================================

function createGame() {
  return {
    systems: [],
    systemsById: {},
    planetsById: {},
    empires: [],
    empiresById: {},
    fleetsById: {},
    player: null,
    day: 0,
    speed: 1,
    _acc: 0,
    _lastSpeed: 1,
    debugReveal: false,
    gameOver: false,
    notify(empire, text, kind) {
      if (empire && empire.isPlayer) showNotification(text, kind);
    },
  };
}

// =============== 研究抽卡 ===============
function drawResearchOptions(empire, area, game) {
  const done = new Set(empire.techs);
  const available = TECH_TREE[area].filter(t => {
    if (done.has(t.id)) return false;
    if (t.req && !t.req.every(r => done.has(r))) return false;
    return true;
  });
  // 加权随机抽 3 个
  const options = [];
  const pool = [...available];
  for (let i = 0; i < 3 && pool.length; i++) {
    const totalW = pool.reduce((s, t) => s + t.weight, 0);
    let roll = Math.random() * totalW;
    let idx = 0;
    for (let j = 0; j < pool.length; j++) {
      roll -= pool[j].weight;
      if (roll <= 0) { idx = j; break; }
    }
    options.push(pool[idx].id);
    pool.splice(idx, 1);
  }
  empire.researchOptions[area] = options;
}

// 完成一项科技
function completeTech(empire, area, game) {
  const tid = empire.research[area];
  const tech = findTech(tid);
  if (!tech) return;
  empire.techs.push(tid);
  empire.research[area] = null;
  empire.researchProgress[area] = 0;
  empire.researchOptions[area] = [];

  // 应用即时解锁效果
  const eff = tech.effect || {};
  if (eff.unlockShip && !empire.unlockedShips.includes(eff.unlockShip)) empire.unlockedShips.push(eff.unlockShip);
  if (eff.starbaseLevel) {
    const newIdx = STARBASE_ORDER.indexOf(eff.starbaseLevel);
    const curIdx = STARBASE_ORDER.indexOf(empire.maxStarbaseLevel);
    if (newIdx > curIdx) empire.maxStarbaseLevel = eff.starbaseLevel;
  }
  recalcModifiers(empire, game);
  game.notify(empire, `研究完成: ${tech.name}`, "good");

  // 抽新选项
  drawResearchOptions(empire, area, game);
}

// =============== 主 tick (推进天数) ===============
function tickDay(game) {
  if (game.gameOver) return;
  game.day++;

  // 舰队移动
  for (const fid in game.fleetsById) {
    const fleet = game.fleetsById[fid];
    if (fleet.path) updateFleetMovement(fleet, game, 1);
  }

  // 勘测进行中
  processSurveying(game);
  // 建造进度 (行星 & 造船厂)
  processConstruction(game);

  // 每 30 天 = 1 月: 经济结算
  if (game.day % 30 === 0) {
    monthlyTick(game);
  }

  // 战斗检测 (每 5 天)
  if (game.day % 5 === 0) {
    checkCombat(game);
  }

  // 每年海盗刷新
  if (game.day % 360 === 0) {
    spawnHostiles(game);
    checkVictory(game);
  }
}

function monthlyTick(game) {
  for (const empire of game.empires) {
    // 经济
    applyIncome(empire, game);
    // 研究进度
    for (const area of ["physics", "society", "engineering"]) {
      if (empire.research[area]) {
        empire.researchProgress[area] += empire.income[area] || 0;
        const tech = findTech(empire.research[area]);
        if (tech && empire.researchProgress[area] >= tech.cost) {
          completeTech(empire, area, game);
        }
      } else if (empire.researchOptions[area].length === 0) {
        drawResearchOptions(empire, area, game);
      }
    }
    // 人口增长
    growPops(empire, game);
    // AI 决策 (每月)
    if (empire.isAI) runAI(empire, game);
  }
  // 发现邻居
  checkContact(game);
}

// 勘测处理
function processSurveying(game) {
  for (const fid in game.fleetsById) {
    const fleet = game.fleetsById[fid];
    if (fleet.civilian !== "science" || fleet.path) continue;
    if (fleet.order && fleet.order.type === "survey") {
      const sys = game.systemsById[fleet.systemId];
      if (sys.surveyed) {
        fleet.order = null;
        if (fleet.autoExplore) {
          const empire = game.empiresById[fleet.empireId];
          aiSendScienceToExplore(fleet, empire, game);
        }
        continue;
      }
      fleet.order.progress = (fleet.order.progress || 0) + 1;
      if (fleet.order.progress >= 20) {
        sys.surveyed = true;
        sys.explored = true;
        const empire = game.empiresById[fleet.empireId];
        game.notify(empire, `勘测完成: ${sys.name}`, "good");
        fleet.order = null;
        if (fleet.autoExplore) aiSendScienceToExplore(fleet, empire, game);
      }
    }
  }
  // 工程船建造 order
  for (const fid in game.fleetsById) {
    const fleet = game.fleetsById[fid];
    if (fleet.civilian !== "construction" || fleet.path) continue;
    if (!fleet.order) continue;
    const empire = game.empiresById[fleet.empireId];
    const sys = game.systemsById[fleet.systemId];
    if (fleet.order.type === "build_outpost" && fleet.order.sysId === fleet.systemId) {
      fleet.order.progress++;
      if (fleet.order.progress >= 15) {
        if (!sys.owner && empire.resources.influence >= 75) {
          empire.resources.influence -= 75;
          empire.resources.alloys = Math.max(0, empire.resources.alloys - 100);
          claimSystem(sys, empire, game);
          game.notify(empire, `宣称系统 ${sys.name}`, "good");
        }
        fleet.order = null;
      }
    } else if (fleet.order.type === "build_station") {
      fleet.order.progress++;
      if (fleet.order.progress >= 10) {
        const dep = sys.deposits.find(d => d.id === fleet.order.depId);
        if (dep && !dep.station && empire.resources.minerals >= 100) {
          empire.resources.minerals -= 100;
          dep.station = true;
        }
        fleet.order = null;
      }
    }
  }
}

// 建造 (行星区划/建筑 + 造船厂)
function processConstruction(game) {
  // 行星
  for (const pid in game.planetsById) {
    const planet = game.planetsById[pid];
    if (!planet.buildQueue || planet.buildQueue.length === 0) continue;
    const q = planet.buildQueue[0];
    q.progress++;
    if (q.progress >= q.time) {
      if (q.type === "district") planet.districts[q.key]++;
      else if (q.type === "building") planet.buildings.push(q.key);
      planet.buildQueue.shift();
    }
  }
  // 造船厂
  for (const sysId in game.systemsById) {
    const sys = game.systemsById[sysId];
    if (!sys.starbase || !sys.starbase.shipyardQueue || sys.starbase.shipyardQueue.length === 0) continue;
    const empire = game.empiresById[sys.owner];
    if (!empire) continue;
    // 并行建造 = 船坞数
    const parallel = Math.max(1, sys.starbase.shipyards);
    for (let i = 0; i < Math.min(parallel, sys.starbase.shipyardQueue.length); i++) {
      const q = sys.starbase.shipyardQueue[i];
      q.progress++;
      if (q.progress >= q.time) {
        finishShip(sys, empire, q, game);
        q._done = true;
      }
    }
    sys.starbase.shipyardQueue = sys.starbase.shipyardQueue.filter(q => !q._done);
  }
}

function finishShip(sys, empire, q, game) {
  if (q.civilian) {
    const fleet = newFleet(empire, sys.id, game, { civilian: q.ship, name: CIVILIAN_SHIPS[q.ship].name });
    game.notify(empire, `${CIVILIAN_SHIPS[q.ship].name} 建造完成`, "good");
  } else {
    // 加入本系统现有军用舰队, 或新建
    let fleet = sys.fleets.map(f => game.fleetsById[f]).find(f => f && f.empireId === empire.id && !f.civilian && !f.path);
    if (!fleet) fleet = newFleet(empire, sys.id, game, { name: empire.speciesName + " 舰队" });
    fleet.ships.push(newShip(q.ship, empire, game));
    game.notify(empire, `${SHIP_CLASSES[q.ship].name} 建造完成`, "good");
  }
}

// 帝国接触 (相邻系统)
function checkContact(game) {
  for (const empire of game.empires) {
    for (const sysId of empire.ownedSystems) {
      const sys = game.systemsById[sysId];
      for (const other of game.empires) {
        if (other.id === empire.id) continue;
        if (empire.known.includes(other.id)) continue;
        // 若相邻系统属于对方
        for (const nId of sys.hyperlanes) {
          const n = game.systemsById[nId];
          if (n.owner === other.id) {
            empire.known.push(other.id);
            other.known.push(empire.id);
            empire.relations[other.id] = { attitude: 0, atWar: false, truce: 0 };
            other.relations[empire.id] = { attitude: 0, atWar: false, truce: 0 };
            game.notify(empire, `发现新帝国: ${other.name}`, "warn");
            game.notify(other, `发现新帝国: ${empire.name}`, "warn");
          }
        }
      }
    }
  }
}

// 胜利检测
function checkVictory(game) {
  const alive = game.empires.filter(e => e.ownedPlanets.length > 0 || e.ownedSystems.length > 0);
  if (game.player.ownedPlanets.length === 0 && game.player.ownedSystems.length === 0) {
    game.gameOver = true;
    showGameOver(game, false);
    return;
  }
  const aliveAI = alive.filter(e => e.isAI);
  if (aliveAI.length === 0 && game.day > 30) {
    game.gameOver = true;
    showGameOver(game, true);
  }
}

function showGameOver(game, won) {
  game.speed = 0;
  const modal = document.getElementById("modal");
  document.getElementById("modal-content").innerHTML = `
    <div class="panel-title">${won ? "🏆 银河霸主!" : "💀 帝国陨落"}</div>
    <div class="card-desc" style="margin:12px 0">${won ? "你征服了所有对手，统治了整个银河系！" : "你的帝国已被消灭。"}</div>
    <button class="btn" onclick="location.reload()">重新开始</button>
  `;
  modal.classList.remove("hidden");
}
