// ============================================================
// main.js - 入口 (setup 界面, 初始化, 主循环)
// ============================================================

let GAME = null;

// =============== Setup 界面 ===============
const selectedEthics = [];

function initSetup() {
  const list = document.getElementById("ethics-list");
  list.innerHTML = "";
  for (const key in ETHICS) {
    const e = ETHICS[key];
    const chip = document.createElement("div");
    chip.className = "ethic-chip";
    chip.textContent = e.name;
    chip.dataset.key = key;
    chip.title = e.desc;
    chip.addEventListener("click", () => toggleEthic(key, chip));
    list.appendChild(chip);
  }
  document.getElementById("start-game-btn").addEventListener("click", startGame);
}

function toggleEthic(key, chip) {
  const existing = selectedEthics.find(e => e.base === key);
  const points = selectedEthics.reduce((s, e) => s + (e.fanatic ? 2 : 1), 0);
  const opp = ETHICS[key].opp;

  if (!existing) {
    // 不能同时选对立理念
    if (selectedEthics.find(e => e.base === opp)) {
      showNotification(`不能同时选择对立理念`, "bad");
      return;
    }
    if (points >= 3) { showNotification("理念点数已用完", "bad"); return; }
    selectedEthics.push({ base: key, fanatic: false });
  } else if (!existing.fanatic) {
    // 升级为狂热 (需要有剩余点数)
    if (points + 1 > 3) { removeEthic(key); }
    else existing.fanatic = true;
  } else {
    removeEthic(key);
  }
  refreshEthicChips();
}

function removeEthic(key) {
  const idx = selectedEthics.findIndex(e => e.base === key);
  if (idx >= 0) selectedEthics.splice(idx, 1);
}

function refreshEthicChips() {
  const points = selectedEthics.reduce((s, e) => s + (e.fanatic ? 2 : 1), 0);
  document.getElementById("ethics-points").textContent = points;
  document.querySelectorAll(".ethic-chip").forEach(chip => {
    const e = selectedEthics.find(x => x.base === chip.dataset.key);
    chip.classList.toggle("selected", !!e);
    chip.classList.toggle("fanatic", !!(e && e.fanatic));
    chip.textContent = ETHICS[chip.dataset.key].name + (e && e.fanatic ? " (狂热)" : "");
  });
}

// =============== 开始游戏 ===============
function startGame() {
  const empireName = document.getElementById("s-empire-name").value || "人类联合帝国";
  const speciesName = document.getElementById("s-species-name").value || "人类";
  const homeworldName = document.getElementById("s-homeworld-name").value || "地球";
  const galaxySize = parseInt(document.getElementById("s-galaxy-size").value);
  const aiCount = parseInt(document.getElementById("s-ai-count").value);
  const authority = document.getElementById("s-authority").value;
  const color = document.getElementById("s-color").value;

  const game = createGame();
  GAME = game;

  // 生成银河
  game.systems = generateGalaxy(galaxySize);
  for (const sys of game.systems) {
    game.systemsById[sys.id] = sys;
    for (const p of sys.planets) game.planetsById[p.id] = p;
  }

  const homes = [];
  const minHomeDist = Math.max(120, 300 - galaxySize);

  // 玩家帝国
  const player = newEmpire({
    id: uid(), name: empireName, speciesName, color, isPlayer: true,
    authority, ethics: selectedEthics.map(e => e.fanatic ? "fanatic_" + e.base : e.base),
  });
  player._homeworldName = homeworldName;
  game.player = player;
  game.empires.push(player);

  setupHomeSystem(player, game, homes, minHomeDist);

  // AI 帝国
  const aiPool = [...AI_EMPIRE_NAMES].sort(() => Math.random() - 0.5);
  for (let i = 0; i < aiCount; i++) {
    const info = aiPool[i % aiPool.length];
    const ai = newEmpire({
      id: uid(), name: info.empire, speciesName: info.species, color: info.color,
      isPlayer: false, authority: pick(Object.keys(AUTHORITIES)),
      ethics: randomEthics(),
    });
    game.empires.push(ai);
    setupHomeSystem(ai, game, homes, minHomeDist);
  }

  for (const e of game.empires) game.empiresById[e.id] = e;

  // 初始化经济/研究
  for (const e of game.empires) {
    recalcModifiers(e, game);
    computeEmpireIncome(e, game);
    computeStorage(e, game);
    for (const area of ["physics", "society", "engineering"]) drawResearchOptions(e, area, game);
    // AI 立即选研究
    if (e.isAI) for (const area of ["physics", "society", "engineering"]) e.research[area] = e.researchOptions[area][0];
  }

  // 切换到游戏界面
  document.getElementById("setup-screen").classList.add("hidden");
  document.getElementById("game-screen").classList.remove("hidden");

  initView(game);
  showNotification(`欢迎，${empireName}！开始你的银河征程。`, "good");

  startLoop(game);
}

function setupHomeSystem(empire, game, homes, minDist) {
  const sys = pickHomeSystem(game.systems, homes, minDist);
  if (!sys) return;
  homes.push(sys);
  empire.homeSystemId = sys.id;
  sys.explored = true;
  sys.surveyed = true;

  // 首都行星
  const homeworld = sys.planets.find(p => PLANET_CLASSES[p.class].type === "habitable" && p.size >= 14)
    || sys.planets.find(p => PLANET_CLASSES[p.class].type === "habitable");
  if (homeworld) setupCapital(homeworld, empire, game);

  // 星基
  claimSystem(sys, empire, game);
  sys.starbase.level = "starport";
  sys.starbase.shipyards = 1;

  // 起始舰队: 3 护卫舰
  const warFleet = newFleet(empire, sys.id, game, { name: empire.speciesName + " 母舰队" });
  for (let i = 0; i < 3; i++) warFleet.ships.push(newShip("corvette", empire, game));

  // 科研船 + 工程船
  newFleet(empire, sys.id, game, { civilian: "science", name: empire.speciesName + " 科研船" });
  newFleet(empire, sys.id, game, { civilian: "construction", name: empire.speciesName + " 工程船" });

  // 相邻系统标记为已探索(可见)
  for (const nId of sys.hyperlanes) {
    if (empire.isPlayer) game.systemsById[nId].explored = true;
  }
}

function randomEthics() {
  const keys = Object.keys(ETHICS);
  const result = [];
  let points = 0;
  const shuffled = keys.sort(() => Math.random() - 0.5);
  for (const k of shuffled) {
    if (points >= 3) break;
    if (result.find(e => ETHICS[e.replace("fanatic_", "")] && (e.replace("fanatic_","") === ETHICS[k].opp))) continue;
    if (result.find(e => e.replace("fanatic_", "") === ETHICS[k].opp)) continue;
    const fanatic = Math.random() < 0.3 && points <= 1;
    result.push(fanatic ? "fanatic_" + k : k);
    points += fanatic ? 2 : 1;
  }
  return result;
}

// =============== 主循环 ===============
function startLoop(game) {
  const speeds = { 0: 0, 1: 500, 2: 200, 3: 60 }; // ms per game-day
  let lastTime = performance.now();

  function loop(now) {
    const dt = now - lastTime;
    lastTime = now;

    if (game.speed > 0 && !game.gameOver) {
      game._acc += dt;
      const interval = speeds[game.speed];
      let steps = 0;
      while (game._acc >= interval && steps < 10) {
        game._acc -= interval;
        tickDay(game);
        steps++;
      }
    }

    // 渲染
    render(game);
    renderResourceBar(game);
    renderOutliner(game);
    renderDate(game);

    // 更新打开的详情面板 (刷新数据)
    refreshOpenPanel(game);

    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

// 定期刷新已打开的面板 (每 30 帧)
let _panelFrame = 0;
function refreshOpenPanel(game) {
  _panelFrame++;
}

// 启动
initSetup();
