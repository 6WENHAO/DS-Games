// ============================================================
// economy.js - 经济系统 (资源产出/消耗, 人口, 工作分配)
// ============================================================

function newEmpire(opts) {
  return {
    id: opts.id,
    name: opts.name,
    speciesName: opts.speciesName,
    color: opts.color,
    isPlayer: !!opts.isPlayer,
    isAI: !opts.isPlayer,
    authority: opts.authority || "dictatorial",
    ethics: opts.ethics || [],
    homeSystemId: null,
    capitalPlanetId: null,
    resources: {
      energy: 300, minerals: 300, food: 200, alloys: 100, consumer: 200,
      influence: 100, unity: 0, physics: 0, society: 0, engineering: 0,
    },
    storage: {}, // computed
    income: {},  // computed monthly
    // 科技
    research: { physics: null, society: null, engineering: null }, // 当前研究中的 tech id
    researchProgress: { physics: 0, society: 0, engineering: 0 },
    researchOptions: { physics: [], society: [], engineering: [] },
    techs: [],   // 已完成 tech id
    // 传统
    traditions: [],
    // 舰船解锁
    unlockedShips: ["corvette"],
    maxStarbaseLevel: "starport",
    // 领土
    ownedSystems: [],
    ownedPlanets: [],
    // 舰队
    fleets: [],
    navalCap: 20,
    // 外交
    relations: {}, // empireId -> { attitude, atWar, truce }
    known: [],     // 已知帝国 ids
    // AI 状态
    aiState: { expandTarget: null, buildTimer: 0 },
    // 累计统计
    surveyedSystems: [],
  };
}

// 计算某个已殖民行星的产出/消耗与就业
function computePlanetEconomy(planet, empire, game) {
  const out = {}; // resource -> amount
  const add = (r, v) => { out[r] = (out[r] || 0) + v; };

  // 组装所有工作岗位
  const jobSlots = {}; // jobId -> count
  const addJobs = (jobs) => {
    for (const j in jobs) jobSlots[j] = (jobSlots[j] || 0) + jobs[j];
  };
  // 区划提供岗位
  for (const d in planet.districts) {
    const cnt = planet.districts[d];
    const def = DISTRICTS[d];
    if (def.jobs) for (let i = 0; i < cnt; i++) addJobs(def.jobs);
    // 区划维护
    if (def.upkeep) for (const r in def.upkeep) add(r, -def.upkeep[r] * cnt);
  }
  // 建筑提供岗位
  for (const b of planet.buildings) {
    const def = BUILDINGS[b];
    if (def.jobs) addJobs(def.jobs);
    if (def.upkeep) for (const r in def.upkeep) add(r, -def.upkeep[r]);
  }

  // 计算就业 (pop 数量限制)
  const numPops = planet.pops.length;
  // 就业优先级: 统治者 > 基础生产工人(技术员/矿工/农民) > 专家 > 职员
  // 这样保证基础资源(能量/矿物/食物)先被生产, 避免赤字
  const jobPriority = {
    administrator: 0,
    technician: 1, miner: 1, farmer: 1,
    metallurgist: 2, artisan: 2, researcher: 2, bureaucrat: 2, entertainer: 2,
    clerk: 3,
  };
  const jobList = [];
  for (const j in jobSlots) {
    for (let i = 0; i < jobSlots[j]; i++) jobList.push(j);
  }
  jobList.sort((a, b) => (jobPriority[a] ?? 5) - (jobPriority[b] ?? 5));

  const employed = jobList.slice(0, numPops);
  const unemployed = Math.max(0, numPops - employed.length);
  planet._employed = {};
  planet._jobsAvailable = jobList.length;

  // 加成
  const workerBonus = getModifier(empire, "workerBonus");
  const specBonus = getModifier(empire, "specialistBonus");
  const jobBonuses = empire._jobBonuses || {};

  let amenities = 0;
  for (const j of employed) {
    const def = JOBS[j];
    planet._employed[j] = (planet._employed[j] || 0) + 1;
    let mult = 1;
    if (def.stratum === "worker") mult += workerBonus;
    if (def.stratum === "specialist") mult += specBonus;
    if (def.produces) {
      for (const r in def.produces) {
        let v = def.produces[r];
        if (jobBonuses[j]) v += jobBonuses[j];
        // 研究加成
        if (RESOURCES[r] && RESOURCES[r].research) v *= (1 + getModifier(empire, "researchBonus"));
        add(r, v * mult);
      }
    }
    if (def.consumes) for (const r in def.consumes) add(r, -def.consumes[r]);
    if (def.amenities) amenities += def.amenities;
  }
  // 建筑便利设施
  for (const b of planet.buildings) {
    if (BUILDINGS[b].amenities) amenities += BUILDINGS[b].amenities;
  }

  // 星球特色建筑加成 (energy_nexus 等)
  for (const b of planet.buildings) {
    const def = BUILDINGS[b];
    if (def.bonus) {
      const distCnt = planet.districts[def.bonus] || 0;
      const jobDef = DISTRICTS[def.bonus].jobs;
      // 每区划 +1 对应资源
      if (def.bonus === "generator") add("energy", distCnt);
      if (def.bonus === "mining") add("minerals", distCnt);
      if (def.bonus === "agriculture") add("food", distCnt);
    }
  }

  // 人口食物消耗
  add("food", -numPops * POP_FOOD_UPKEEP);

  // 便利度: 影响稳定度(简化, 不足则减产)
  planet._amenities = amenities;
  planet._amenityNeed = numPops;
  planet._unemployed = unemployed;
  let stability = 50 + Math.min(20, (amenities - numPops)) - unemployed * 2;
  stability = Math.max(0, Math.min(100, stability));
  planet._stability = stability;

  // 稳定度低于50减产
  if (stability < 50) {
    const penalty = (50 - stability) / 100;
    for (const r in out) if (out[r] > 0) out[r] *= (1 - penalty);
  }

  return out;
}

// 获取帝国修正值 (来自理念/科技/传统)
function getModifier(empire, key) {
  let v = 0;
  // 理念
  for (const e of empire.ethics) {
    const fanatic = e.startsWith("fanatic_");
    const base = fanatic ? e.slice(8) : e;
    const mult = fanatic ? 2 : 1;
    if (base === "authoritarian" && key === "workerBonus") v += 0.1 * mult;
    if (base === "egalitarian" && key === "specialistBonus") v += 0.1 * mult;
    if (base === "materialist" && key === "researchBonus") v += 0.05 * mult;
    if (base === "spiritualist" && key === "unityBonus") v += 0.15 * mult;
    if (base === "militarist" && key === "shipFire") v += 0.15 * mult;
    if (base === "xenophobe" && key === "popGrowth") v += 0.15 * mult;
  }
  // 科技/传统累积修正
  if (empire._mods && empire._mods[key]) v += empire._mods[key];
  return v;
}

// 重新计算帝国所有修正 (科技+传统效果)
function recalcModifiers(empire, game) {
  const mods = {};
  const jobBonuses = {};
  const addMod = (k, v) => mods[k] = (mods[k] || 0) + v;

  const applyEffect = (eff) => {
    if (!eff) return;
    if (eff.researchBonus) addMod("researchBonus", eff.researchBonus);
    if (eff.workerBonus) addMod("workerBonus", eff.workerBonus);
    if (eff.popGrowth) addMod("popGrowth", eff.popGrowth);
    if (eff.shipFire) addMod("shipFire", eff.shipFire);
    if (eff.shipSpeed) addMod("shipSpeed", eff.shipSpeed);
    if (eff.habitability) addMod("habitability", eff.habitability);
    if (eff.navalCap) addMod("navalCapBonus", eff.navalCap);
    if (eff.influence) addMod("influenceBonus", eff.influence);
    if (eff.jobBonus) for (const j in eff.jobBonus) jobBonuses[j] = (jobBonuses[j] || 0) + eff.jobBonus[j];
  };

  for (const tid of empire.techs) {
    const tech = findTech(tid);
    if (tech) applyEffect(tech.effect);
  }
  for (const tr of empire.traditions) {
    applyEffect(TRADITIONS[tr].effect);
  }
  empire._mods = mods;
  empire._jobBonuses = jobBonuses;

  // 海军容量
  empire.navalCap = 20 + (mods.navalCapBonus || 0);
  // 星基锚地
  for (const sid of empire.ownedSystems) {
    const sys = game.systemsById[sid];
    if (sys && sys.starbase) empire.navalCap += (sys.starbase.anchorages || 0) * 5;
  }
}

function findTech(id) {
  for (const area in TECH_TREE) {
    const t = TECH_TREE[area].find(x => x.id === id);
    if (t) return { ...t, area };
  }
  return null;
}

// 计算帝国全局月度收支
function computeEmpireIncome(empire, game) {
  recalcModifiers(empire, game);
  const income = {};
  for (const r in RESOURCES) income[r] = 0;

  // 行星产出
  for (const pid of empire.ownedPlanets) {
    const planet = game.planetsById[pid];
    if (!planet) continue;
    const eco = computePlanetEconomy(planet, empire, game);
    for (const r in eco) income[r] += eco[r];
  }

  // 太空站产出
  for (const sid of empire.ownedSystems) {
    const sys = game.systemsById[sid];
    if (!sys) continue;
    for (const dep of sys.deposits) {
      if (dep.station) {
        if (dep.type === "research") {
          income.physics += dep.amount / 3;
          income.society += dep.amount / 3;
          income.engineering += dep.amount / 3;
        } else {
          income[dep.type] += dep.amount;
        }
      }
    }
    // 星基维护
    if (sys.starbase) {
      const def = STARBASE_LEVELS[sys.starbase.level];
      if (def.upkeep) for (const r in def.upkeep) income[r] -= def.upkeep[r];
      // 贸易枢纽
      income.energy += (sys.starbase.tradeHubs || 0) * 4;
    }
  }

  // 舰船维护 (能量+合金)
  for (const fid of empire.fleets) {
    const fleet = game.fleetsById[fid];
    if (!fleet) continue;
    for (const ship of fleet.ships) {
      const def = SHIP_CLASSES[ship.class];
      if (def) {
        income.energy -= def.cost.alloys * 0.01;
        income.alloys -= def.cost.alloys * 0.005;
      }
    }
  }

  // 基础影响力
  income.influence += 3 + getModifier(empire, "influenceBonus");
  // 领土超出行政容量的凝聚力/影响力惩罚(简化省略)

  // 唯心凝聚力加成
  const unityBonus = getModifier(empire, "unityBonus");
  if (unityBonus > 0 && income.unity > 0) income.unity *= (1 + unityBonus);

  empire.income = income;
  return income;
}

// 应用月度收支
function applyIncome(empire, game) {
  computeEmpireIncome(empire, game);
  computeStorage(empire, game);
  for (const r in empire.income) {
    empire.resources[r] += empire.income[r];
    // 存储上限
    const cap = empire.storage[r] || Infinity;
    if (empire.resources[r] > cap) empire.resources[r] = cap;
    if (empire.resources[r] < 0) {
      // 赤字处理: 资源不能为负(除研究)
      empire.resources[r] = 0;
    }
  }
}

function computeStorage(empire, game) {
  const st = {};
  for (const r in RESOURCES) {
    if (RESOURCES[r].research) { st[r] = Infinity; continue; }
    if (RESOURCES[r].cap) { st[r] = RESOURCES[r].cap; continue; }
    st[r] = DEFAULT_STORAGE;
  }
  empire.storage = st;
}

// 人口增长: 每个殖民地缓慢增加pop直到满员
function growPops(empire, game) {
  for (const pid of empire.ownedPlanets) {
    const planet = game.planetsById[pid];
    if (!planet || !planet.colonized) continue;
    const maxPops = planet.districtCap * 2 + planet.buildings.length * 2 + 5;
    if (planet.pops.length < maxPops) {
      planet._growth = (planet._growth || 0) + 3 * (1 + getModifier(empire, "popGrowth"));
      if (planet._growth >= 100) {
        planet._growth -= 100;
        planet.pops.push({ id: uid(), species: empire.speciesName });
      }
    }
  }
}

// 殖民一个行星
function colonizePlanet(planet, empire, game) {
  planet.colonized = true;
  planet.owner = empire.id;
  planet.pops = [];
  for (let i = 0; i < 3; i++) planet.pops.push({ id: uid(), species: empire.speciesName });
  planet.buildings = ["capital"];
  // 初始区划
  planet.districts = { city: 1, generator: 1, mining: 1, agriculture: 1 };
  planet._growth = 0;
  if (!empire.ownedPlanets.includes(planet.id)) empire.ownedPlanets.push(planet.id);
}

// 设置首都行星 (更成熟)
function setupCapital(planet, empire, game) {
  planet.colonized = true;
  planet.owner = empire.id;
  planet.name = empire._homeworldName || planet.name;
  planet.pops = [];
  for (let i = 0; i < 28; i++) planet.pops.push({ id: uid(), species: empire.speciesName });
  planet.buildings = ["capital", "research_lab", "foundry", "industries"];
  planet.districts = { city: 1, generator: 3, mining: 4, agriculture: 3 };
  planet.habitability = 100;
  planet._growth = 0;
  empire.capitalPlanetId = planet.id;
  if (!empire.ownedPlanets.includes(planet.id)) empire.ownedPlanets.push(planet.id);
}
