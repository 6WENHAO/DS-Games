// ============================================================
// galaxy.js - 银河系生成 (星系、超空间通道、行星)
// ============================================================

function rand(min, max) { return Math.random() * (max - min) + min; }
function randInt(min, max) { return Math.floor(rand(min, max + 1)); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
let _idCounter = 1;
function uid() { return _idCounter++; }

function generateStarName() {
  return pick(STAR_NAMES) + (Math.random() < 0.5 ? "" : " " + pick(GREEK));
}

// 生成螺旋星系
function generateGalaxy(numStars) {
  const systems = [];
  const R = 480;
  const arms = 4;
  const usedNames = new Set();

  for (let i = 0; i < numStars; i++) {
    // 螺旋臂分布
    const arm = i % arms;
    const t = Math.pow(Math.random(), 0.6);
    const armAngle = (arm / arms) * Math.PI * 2;
    const spiral = t * 4.5;
    const angle = armAngle + spiral + rand(-0.35, 0.35);
    const radius = t * R + rand(-25, 25);
    let x = Math.cos(angle) * radius;
    let y = Math.sin(angle) * radius;

    // 避免过近
    let tooClose = false;
    for (const s of systems) {
      if (Math.hypot(s.x - x, s.y - y) < 34) { tooClose = true; break; }
    }
    if (tooClose) { i--; continue; }

    let name;
    do { name = generateStarName(); } while (usedNames.has(name));
    usedNames.add(name);

    const sys = {
      id: uid(),
      name,
      x, y,
      starColor: pick(["#ffd24a", "#ffaa44", "#ff6644", "#aaccff", "#ffffff", "#ffeeaa"]),
      starSize: rand(2.5, 5),
      planets: [],
      hyperlanes: [],
      owner: null,        // empire id
      starbase: null,     // { level, modules, shipyardQueue }
      explored: false,    // 玩家是否已探索
      surveyed: false,    // 是否已勘测(生成资源)
      fleets: [],         // fleet ids in system
      deposits: [],       // 太空资源矿点 { type, amount, station }
      hostile: null,      // 太空生物/海盗
    };
    generatePlanets(sys);
    systems.push(sys);
  }

  connectHyperlanes(systems);
  ensureConnected(systems);
  return systems;
}

function generatePlanets(sys) {
  const numBodies = randInt(2, 6);
  const orbits = [];
  for (let i = 0; i < numBodies; i++) {
    orbits.push(35 + i * 22 + rand(-4, 4));
  }
  for (let i = 0; i < numBodies; i++) {
    const roll = Math.random();
    let cls;
    if (roll < 0.28) cls = pick(HABITABLE_CLASSES);
    else if (roll < 0.4) cls = "asteroid";
    else cls = pick(["barren","toxic","frozen","molten","gas_giant","barren","frozen"]);

    const info = PLANET_CLASSES[cls];
    const planet = {
      id: uid(),
      name: sys.name + " " + toRoman(i + 1),
      class: cls,
      systemId: sys.id,
      orbit: orbits[i],
      orbitAngle: rand(0, Math.PI * 2),
      orbitSpeed: rand(0.0002, 0.0008) * (i % 2 ? 1 : -1),
      size: info.type === "habitable" ? randInt(12, 25) : randInt(0, 0),
      colonized: false,
      owner: null,
      // 殖民后属性
      pops: [],
      districts: { city: 0, generator: 0, mining: 0, agriculture: 0 },
      buildings: [],
      buildQueue: [],
      districtCap: 0,
      habitability: info.type === "habitable" ? randInt(40, 80) : 0,
    };
    if (info.type === "habitable") planet.districtCap = planet.size;
    sys.planets.push(planet);
  }

  // 太空资源矿点
  if (Math.random() < 0.7) {
    const n = randInt(1, 3);
    for (let i = 0; i < n; i++) {
      const t = pick(["minerals","minerals","energy","research"]);
      sys.deposits.push({
        id: uid(),
        type: t,
        amount: t === "research" ? randInt(2, 6) : randInt(3, 10),
        station: null,
      });
    }
  }
}

function toRoman(n) {
  const map = [["X",10],["IX",9],["V",5],["IV",4],["I",1]];
  let s = "";
  for (const [r, v] of map) { while (n >= v) { s += r; n -= v; } }
  return s;
}

// 连接超空间通道 - 近邻连接
function connectHyperlanes(systems) {
  for (const sys of systems) {
    const neighbors = systems
      .filter(s => s !== sys)
      .map(s => ({ s, d: dist(sys, s) }))
      .sort((a, b) => a.d - b.d);

    const connections = randInt(2, 4);
    let added = 0;
    for (const { s, d } of neighbors) {
      if (added >= connections) break;
      if (d > 140) break;
      if (!sys.hyperlanes.includes(s.id)) {
        sys.hyperlanes.push(s.id);
        s.hyperlanes.push(sys.id);
        added++;
      }
    }
  }
}

// 确保整个星系图连通
function ensureConnected(systems) {
  if (systems.length === 0) return;
  const visited = new Set();
  const stack = [systems[0].id];
  const byId = {};
  systems.forEach(s => byId[s.id] = s);

  while (stack.length) {
    const id = stack.pop();
    if (visited.has(id)) continue;
    visited.add(id);
    for (const n of byId[id].hyperlanes) stack.push(n);
  }

  // 连接未访问的孤岛
  while (visited.size < systems.length) {
    const unvisited = systems.filter(s => !visited.has(s.id));
    let best = null, bestD = Infinity, bestVisited = null;
    for (const u of unvisited) {
      for (const vid of visited) {
        const v = byId[vid];
        const d = dist(u, v);
        if (d < bestD) { bestD = d; best = u; bestVisited = v; }
      }
    }
    if (!best) break;
    best.hyperlanes.push(bestVisited.id);
    bestVisited.hyperlanes.push(best.id);
    // 重新遍历新连接的组件
    const stack2 = [best.id];
    while (stack2.length) {
      const id = stack2.pop();
      if (visited.has(id)) continue;
      visited.add(id);
      for (const n of byId[id].hyperlanes) stack2.push(n);
    }
  }
}

// BFS 寻路 (沿超空间通道)
function findPath(systems, startId, endId) {
  if (startId === endId) return [startId];
  const byId = {};
  systems.forEach(s => byId[s.id] = s);
  const queue = [[startId]];
  const visited = new Set([startId]);
  while (queue.length) {
    const path = queue.shift();
    const last = path[path.length - 1];
    for (const n of byId[last].hyperlanes) {
      if (n === endId) return [...path, n];
      if (!visited.has(n)) {
        visited.add(n);
        queue.push([...path, n]);
      }
    }
  }
  return null;
}

// 找一个远离已有帝国首都的起始系统
function pickHomeSystem(systems, existingHomes, minDist) {
  const candidates = systems.filter(sys => {
    if (sys.owner) return false;
    if (!sys.planets.some(p => PLANET_CLASSES[p.class].type === "habitable" && p.size >= 14)) return false;
    for (const h of existingHomes) {
      if (dist(sys, h) < minDist) return false;
    }
    return true;
  });
  if (candidates.length === 0) {
    // 放宽条件
    return systems.filter(s => !s.owner && s.planets.some(p => PLANET_CLASSES[p.class].type === "habitable"))[0];
  }
  return pick(candidates);
}
