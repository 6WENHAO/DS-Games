// ============================================================
// ui.js - 用户交互 (输入, 面板, HUD)
// ============================================================

// =============== 输入处理 ===============
function setupInput(game) {
  const c = View.canvas;

  c.addEventListener("mousedown", (e) => {
    if (e.button === 0) {
      View.dragging = true;
      View.dragMoved = false;
      View.lastMouse = { x: e.clientX, y: e.clientY };
    }
  });

  window.addEventListener("mouseup", (e) => {
    if (e.button === 0) {
      if (!View.dragMoved) handleLeftClick(game, e);
      View.dragging = false;
    }
  });

  c.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    handleRightClick(game, e);
  });

  c.addEventListener("mousemove", (e) => {
    const rect = c.getBoundingClientRect();
    View.mouse = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    if (View.dragging) {
      const dx = e.clientX - View.lastMouse.x;
      const dy = e.clientY - View.lastMouse.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) View.dragMoved = true;
      View.cam.x -= dx / View.cam.zoom;
      View.cam.y -= dy / View.cam.zoom;
      View.lastMouse = { x: e.clientX, y: e.clientY };
    } else {
      updateHover(game);
    }
  });

  c.addEventListener("wheel", (e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 0.87;
    const before = screenToWorld(View.mouse.x, View.mouse.y);
    View.cam.zoom = Math.max(0.3, Math.min(6, View.cam.zoom * factor));
    const after = screenToWorld(View.mouse.x, View.mouse.y);
    View.cam.x += before.x - after.x;
    View.cam.y += before.y - after.y;
  }, { passive: false });

  // 返回银河按钮
  document.getElementById("back-to-galaxy").addEventListener("click", () => {
    enterGalaxyView(game);
  });

  // 关闭详情面板
  document.getElementById("detail-close").addEventListener("click", () => {
    document.getElementById("detail-panel").classList.add("hidden");
  });

  // 底部工具栏
  document.querySelectorAll(".tool-btn").forEach(btn => {
    btn.addEventListener("click", () => openPanel(game, btn.dataset.panel));
  });

  // 时间控制
  document.querySelectorAll(".speed-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      game.speed = parseInt(btn.dataset.speed);
      document.querySelectorAll(".speed-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });

  // 键盘
  window.addEventListener("keydown", (e) => {
    if (e.code === "Space") { e.preventDefault(); togglePause(game); }
    if (e.key === "Escape") { enterGalaxyView(game); document.getElementById("detail-panel").classList.add("hidden"); }
  });
}

function togglePause(game) {
  if (game.speed === 0) {
    game.speed = game._lastSpeed || 1;
  } else {
    game._lastSpeed = game.speed;
    game.speed = 0;
  }
  document.querySelectorAll(".speed-btn").forEach(b => b.classList.toggle("active", parseInt(b.dataset.speed) === game.speed));
}

function updateHover(game) {
  View.hover = null;
  const wp = screenToWorld(View.mouse.x, View.mouse.y);
  if (View.mode === "galaxy") {
    let best = null, bestD = 18 / View.cam.zoom;
    // 舰队优先
    for (const fid in game.fleetsById) {
      const f = game.fleetsById[fid];
      const sys = game.systemsById[f.systemId];
      if (!sys) continue;
      if (!(sys.explored || game.empiresById[f.empireId].isPlayer || game.debugReveal)) continue;
    }
    for (const sysId in game.systemsById) {
      const sys = game.systemsById[sysId];
      const d = Math.hypot(sys.x - wp.x, sys.y - wp.y);
      if (d < bestD) { bestD = d; best = { type: "system", id: sys.id }; }
    }
    View.hover = best;
  } else {
    const sys = game.systemsById[View.currentSystemId];
    if (!sys) return;
    for (const p of sys.planets) {
      if (p._screenX == null) continue;
      const d = Math.hypot(p._screenX - View.mouse.x, p._screenY - View.mouse.y);
      if (d < (p._screenR || 8) + 6) { View.hover = { type: "planet", id: p.id }; return; }
    }
  }
}

function handleLeftClick(game, e) {
  updateHover(game);
  if (View.mode === "galaxy") {
    if (View.hover && View.hover.type === "system") {
      const sys = game.systemsById[View.hover.id];
      // 检查是否点到舰队
      const clickedFleet = findClickedFleetGalaxy(game);
      if (clickedFleet) {
        View.selected = { type: "fleet", id: clickedFleet.id };
        showFleetDetail(game, clickedFleet);
        return;
      }
      // 进入星系视图 (需已探索)
      if (sys.explored || game.debugReveal) {
        enterSystemView(game, sys.id);
      } else {
        View.selected = null;
      }
    } else {
      const clickedFleet = findClickedFleetGalaxy(game);
      if (clickedFleet) { View.selected = { type: "fleet", id: clickedFleet.id }; showFleetDetail(game, clickedFleet); }
      else View.selected = null;
    }
  } else {
    // 系统视图: 点击行星显示详情, 点击舰队选中
    const sys = game.systemsById[View.currentSystemId];
    for (const fid of sys.fleets) {
      const f = game.fleetsById[fid];
      if (f && f._screenX != null) {
        const d = Math.hypot(f._screenX - View.mouse.x, f._screenY - View.mouse.y);
        if (d < 12) { View.selected = { type: "fleet", id: f.id }; showFleetDetail(game, f); return; }
      }
    }
    if (View.hover && View.hover.type === "planet") {
      const p = game.planetsById[View.hover.id];
      showPlanetDetail(game, p);
    }
    // 点击矿点
    for (const dep of sys.deposits) {
      if (dep._screenX == null) continue;
      const d = Math.hypot(dep._screenX - View.mouse.x, dep._screenY - View.mouse.y);
      if (d < 14) { showDepositDetail(game, sys, dep); return; }
    }
  }
}

function findClickedFleetGalaxy(game) {
  for (const fid in game.fleetsById) {
    const f = game.fleetsById[fid];
    const emp = game.empiresById[f.empireId];
    if (!emp.isPlayer && !game.debugReveal) continue;
    let px, py;
    const sys = game.systemsById[f.systemId];
    if (!sys) continue;
    if (f.path && f.pathIndex < f.path.length - 1) {
      const a = game.systemsById[f.path[f.pathIndex]];
      const b = game.systemsById[f.path[f.pathIndex + 1]];
      const sp = worldToScreen(a.x + (b.x - a.x) * f.moveProgress, a.y + (b.y - a.y) * f.moveProgress);
      px = sp.x; py = sp.y;
    } else {
      const sp = worldToScreen(sys.x, sys.y);
      px = sp.x + 12; py = sp.y - 12;
    }
    const d = Math.hypot(px - View.mouse.x, py - View.mouse.y);
    if (d < 12) return f;
  }
  return null;
}

// 右键: 移动选中舰队
function handleRightClick(game, e) {
  if (!View.selected || View.selected.type !== "fleet") return;
  const fleet = game.fleetsById[View.selected.id];
  if (!fleet || fleet.empireId !== game.player.id) return;

  let targetSysId = null;
  if (View.mode === "galaxy") {
    updateHover(game);
    if (View.hover && View.hover.type === "system") targetSysId = View.hover.id;
  } else {
    targetSysId = View.currentSystemId; // 系统内暂不移动
  }
  if (targetSysId) {
    const ok = orderFleetMove(fleet, targetSysId, game);
    if (ok) {
      fleet.order = null;
      const sys = game.systemsById[targetSysId];
      game.notify(game.player, `${fleet.name} 前往 ${sys.name}`, "");
    }
  }
}

// =============== 视图切换 ===============
function enterSystemView(game, sysId) {
  View.mode = "system";
  View.currentSystemId = sysId;
  View.cam.zoom = 1.4;
  document.getElementById("back-to-galaxy").classList.remove("hidden");
  const sys = game.systemsById[sysId];
  document.getElementById("view-label").textContent = "星系: " + sys.name;
}

function enterGalaxyView(game) {
  View.mode = "galaxy";
  document.getElementById("back-to-galaxy").classList.add("hidden");
  document.getElementById("view-label").textContent = "";
  View.cam.zoom = 1.2;
}

// =============== HUD 资源栏 ===============
function renderResourceBar(game) {
  const bar = document.getElementById("resource-bar");
  const p = game.player;
  let html = "";
  for (const r of RESOURCE_ORDER) {
    const def = RESOURCES[r];
    const val = Math.floor(p.resources[r]);
    const flow = p.income[r] || 0;
    const flowStr = flow >= 0 ? `+${flow.toFixed(1)}` : flow.toFixed(1);
    const flowClass = flow >= 0 ? "flow-pos" : "flow-neg";
    html += `<div class="res-item" title="${def.name}">
      <span class="res-icon">${def.icon}</span>
      <span class="res-val" style="color:${def.color}">${val}</span>
      <span class="res-flow ${flowClass}">${flowStr}</span>
    </div>`;
  }
  bar.innerHTML = html;
}

// =============== 概览 Outliner ===============
function renderOutliner(game) {
  const el = document.getElementById("outliner-content");
  const p = game.player;
  let html = "";

  // 行星
  html += `<div class="outliner-group-title">殖民地 (${p.ownedPlanets.length})</div>`;
  for (const pid of p.ownedPlanets) {
    const planet = game.planetsById[pid];
    if (!planet) continue;
    html += `<div class="outliner-item" data-type="planet" data-id="${pid}">
      <span>${PLANET_CLASSES[planet.class].icon} ${planet.name}</span>
      <span class="sub">👥${planet.pops.length}</span>
    </div>`;
  }

  // 舰队
  const fleets = p.fleets.map(f => game.fleetsById[f]).filter(f => f);
  html += `<div class="outliner-group-title">舰队 (${fleets.length})</div>`;
  for (const f of fleets) {
    const sys = game.systemsById[f.systemId];
    const label = f.civilian ? CIVILIAN_SHIPS[f.civilian].icon + f.name : `🚀${f.name}(${f.ships.length})`;
    html += `<div class="outliner-item" data-type="fleet" data-id="${f.id}">
      <span>${label}</span>
      <span class="sub">${f.path ? "移动中" : (sys ? sys.name : "")}</span>
    </div>`;
  }

  // 海军容量
  html += `<div class="outliner-group-title">海军容量</div>`;
  html += `<div class="outliner-item"><span>已用/上限</span><span class="sub">${totalNavalUse(p, game)}/${p.navalCap}</span></div>`;

  el.innerHTML = html;
  el.querySelectorAll(".outliner-item[data-type]").forEach(item => {
    item.addEventListener("click", () => {
      const type = item.dataset.type;
      const id = parseInt(item.dataset.id);
      if (type === "planet") {
        const planet = game.planetsById[id];
        enterSystemView(game, planet.systemId);
        const sys = game.systemsById[planet.systemId];
        View.cam.x = sys.x; View.cam.y = sys.y;
        showPlanetDetail(game, planet);
      } else if (type === "fleet") {
        const f = game.fleetsById[id];
        View.selected = { type: "fleet", id };
        const sys = game.systemsById[f.systemId];
        if (sys) { View.cam.x = sys.x; View.cam.y = sys.y; }
        showFleetDetail(game, f);
      }
    });
  });
}

// =============== 通知 ===============
function showNotification(text, kind) {
  const el = document.getElementById("notifications");
  const div = document.createElement("div");
  div.className = "notification " + (kind || "");
  div.textContent = text;
  el.appendChild(div);
  setTimeout(() => { div.style.transition = "opacity 0.5s"; div.style.opacity = "0"; setTimeout(() => div.remove(), 500); }, 5000);
  // 限制数量
  while (el.children.length > 6) el.removeChild(el.firstChild);
}

// =============== 日期显示 ===============
function renderDate(game) {
  const y = 2200 + Math.floor(game.day / 360);
  const m = Math.floor((game.day % 360) / 30) + 1;
  const d = (game.day % 30) + 1;
  document.getElementById("game-date").textContent =
    `${y}.${String(m).padStart(2, "0")}.${String(d).padStart(2, "0")}`;
}

// =============== 详情面板辅助 ===============
function openDetail(html) {
  const panel = document.getElementById("detail-panel");
  document.getElementById("detail-content").innerHTML = html;
  panel.classList.remove("hidden");
  return document.getElementById("detail-content");
}

function costStr(cost) {
  let s = "";
  for (const r in cost) s += `<span class="res-cost" style="color:${RESOURCES[r].color}">${RESOURCES[r].icon}${cost[r]}</span>`;
  return s;
}

// =============== 行星详情 ===============
function showPlanetDetail(game, planet) {
  const el = openDetail("");
  renderPlanetDetail(game, planet, el);
}

function renderPlanetDetail(game, planet, el) {
  const player = game.player;
  const isMine = planet.owner === player.id;
  const info = PLANET_CLASSES[planet.class];

  let html = `<div class="panel-title">${info.icon} ${planet.name}</div>`;
  html += `<div class="panel-subtitle">${info.name} · 规模 ${planet.size} · 宜居度 ${planet.habitability}%</div>`;

  if (!planet.colonized) {
    if (info.type === "habitable") {
      const sys = game.systemsById[planet.systemId];
      const canColonize = sys.owner === player.id;
      html += `<div class="card"><div class="card-desc">未殖民的宜居行星。派遣殖民船以建立殖民地。</div></div>`;
      if (canColonize) {
        html += `<div class="card-desc">该系统在你的控制下，可派殖民船前来殖民。</div>`;
      } else {
        html += `<div class="card-desc" style="color:var(--warn)">需先用前哨站宣称该系统。</div>`;
      }
    } else {
      html += `<div class="card"><div class="card-desc">不可居住的天体。</div></div>`;
    }
    el.innerHTML = html;
    return;
  }

  if (!isMine) {
    const owner = game.empiresById[planet.owner];
    html += `<div class="card"><div class="card-desc">所属帝国: <span style="color:${owner.color}">${owner.name}</span></div></div>`;
    el.innerHTML = html;
    return;
  }

  // 统计
  const eco = computePlanetEconomy(planet, player, game);
  html += `<div class="card">
    <div class="stat-line"><span>👥 人口</span><span class="val">${planet.pops.length}</span></div>
    <div class="stat-line"><span>😊 稳定度</span><span class="val">${Math.round(planet._stability||50)}%</span></div>
    <div class="stat-line"><span>🎭 便利设施</span><span class="val">${planet._amenities||0}/${planet._amenityNeed||0}</span></div>
    <div class="stat-line"><span>💼 失业</span><span class="val">${planet._unemployed||0}</span></div>
  </div>`;

  // 区划
  const totalDist = planet.districts.city + planet.districts.generator + planet.districts.mining + planet.districts.agriculture;
  html += `<div class="section-title">区划 (${totalDist}/${planet.districtCap})</div>`;
  for (const d in DISTRICTS) {
    const def = DISTRICTS[d];
    const cnt = planet.districts[d];
    const canBuild = totalDist < planet.districtCap && canAfford(player, def.cost);
    html += `<div class="district-row">
      <span>${def.icon} ${def.name} <b>${cnt}</b></span>
      <span class="district-controls">
        <span style="font-size:11px;color:var(--text-dim)">${costStr(def.cost)}</span>
        <button class="mini-btn" data-act="dist-add" data-key="${d}" ${canBuild?"":"disabled"}>+</button>
      </span>
    </div>`;
  }

  // 建造队列
  if (planet.buildQueue.length) {
    html += `<div class="section-title">建造队列</div>`;
    for (const q of planet.buildQueue) {
      const name = q.type === "district" ? DISTRICTS[q.key].name : BUILDINGS[q.key].name;
      const pct = Math.round(q.progress / q.time * 100);
      html += `<div class="card"><div class="flex-between"><span>${name}</span><span class="sub">${pct}%</span></div>
        <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div></div>`;
    }
  }

  // 建筑
  html += `<div class="section-title">建筑 (${planet.buildings.length})</div>`;
  html += `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px">`;
  for (const b of planet.buildings) {
    html += `<span class="tag">${BUILDINGS[b].icon} ${BUILDINGS[b].name}</span>`;
  }
  html += `</div>`;
  const maxBuildings = 4 + Math.floor(totalDist / 3);
  if (planet.buildings.length < maxBuildings) {
    html += `<div class="section-title">建造新建筑</div>`;
    for (const b in BUILDINGS) {
      const def = BUILDINGS[b];
      if (def.unique && planet.buildings.includes(b)) continue;
      if (b === "capital") continue;
      const canBuild = canAfford(player, def.cost);
      html += `<div class="building-row">
        <span>${def.icon} ${def.name}</span>
        <span class="district-controls">${costStr(def.cost)}
        <button class="btn small" data-act="build-add" data-key="${b}" ${canBuild?"":"disabled"}>建造</button></span>
      </div>`;
    }
  }

  el.innerHTML = html;

  el.querySelectorAll("[data-act='dist-add']").forEach(btn => btn.addEventListener("click", () => {
    const d = btn.dataset.key;
    if (canAfford(player, DISTRICTS[d].cost)) {
      spend(player, DISTRICTS[d].cost);
      planet.buildQueue.push({ type: "district", key: d, progress: 0, time: 90 });
      renderPlanetDetail(game, planet, el);
    }
  }));
  el.querySelectorAll("[data-act='build-add']").forEach(btn => btn.addEventListener("click", () => {
    const b = btn.dataset.key;
    if (canAfford(player, BUILDINGS[b].cost)) {
      spend(player, BUILDINGS[b].cost);
      planet.buildQueue.push({ type: "building", key: b, progress: 0, time: 120 });
      renderPlanetDetail(game, planet, el);
    }
  }));
}

// =============== 舰队详情 ===============
function showFleetDetail(game, fleet) {
  const el = openDetail("");
  renderFleetDetail(game, fleet, el);
}

function renderFleetDetail(game, fleet, el) {
  const player = game.player;
  const emp = game.empiresById[fleet.empireId];
  const isMine = fleet.empireId === player.id;
  const sys = game.systemsById[fleet.systemId];

  let html = `<div class="panel-title">${fleet.civilian?CIVILIAN_SHIPS[fleet.civilian].icon:"🚀"} ${fleet.name}</div>`;
  html += `<div class="panel-subtitle" style="color:${emp.color}">${emp.name} · 位于 ${sys?sys.name:"?"}</div>`;

  if (fleet.civilian) {
    const c = CIVILIAN_SHIPS[fleet.civilian];
    html += `<div class="card"><div class="card-desc">${c.name}</div></div>`;
    if (isMine) {
      if (fleet.civilian === "science") {
        html += `<div class="card-desc">右键点击星系移动。到达未勘测系统会自动勘测。</div>`;
        const surveyable = sys && !sys.surveyed && sys.owner !== null || (sys && !sys.surveyed);
        if (sys && !sys.surveyed && !sys.hostile) {
          html += `<button class="btn" data-act="survey">勘测当前系统</button>`;
        } else if (sys && sys.surveyed) {
          html += `<div class="card-desc" style="color:var(--good)">该系统已勘测。</div>`;
        }
        html += `<button class="btn" data-act="auto-explore">${fleet.autoExplore?"停止自动探索":"自动探索"}</button>`;
      }
      if (fleet.civilian === "construction") {
        html += `<div class="card-desc">右键移动。可在系统建前哨站(宣称)或在矿点建太空站。</div>`;
        if (sys && !sys.owner && sys.surveyed && !sys.hostile) {
          const cost = { alloys: 100, influence: 75 };
          const can = canAfford(player, cost);
          html += `<div class="building-row"><span>建立前哨站(宣称系统)</span><span>${costStr(cost)}<button class="btn small" data-act="outpost" ${can?"":"disabled"}>建造</button></span></div>`;
        }
        if (sys && sys.owner === player.id) {
          for (const dep of sys.deposits) {
            if (!dep.station) {
              const icon = dep.type==="minerals"?"⛏️":dep.type==="energy"?"⚡":"🔬";
              const can = canAfford(player, { minerals: 100 });
              html += `<div class="building-row"><span>${icon} ${dep.type} 太空站 (+${dep.amount})</span><span>${costStr({minerals:100})}<button class="btn small" data-act="station" data-dep="${dep.id}" ${can?"":"disabled"}>建造</button></span></div>`;
            }
          }
        }
      }
      if (fleet.civilian === "colony") {
        html += `<div class="card-desc">移动到你控制的系统中的宜居行星进行殖民。</div>`;
        if (sys && sys.owner === player.id) {
          for (const p of sys.planets) {
            if (PLANET_CLASSES[p.class].type === "habitable" && !p.colonized) {
              html += `<div class="building-row"><span>${PLANET_CLASSES[p.class].icon} ${p.name}</span><button class="btn small" data-act="colonize" data-planet="${p.id}">殖民</button></div>`;
            }
          }
        }
      }
    }
  } else {
    // 军用舰队
    html += `<div class="card">
      <div class="stat-line"><span>⚔️ 舰队战力</span><span class="val">${fleetPower(fleet, emp, game)}</span></div>
      <div class="stat-line"><span>🚀 舰船数</span><span class="val">${fleet.ships.length}</span></div>
    </div>`;
    html += `<div class="section-title">舰船</div>`;
    const counts = {};
    for (const s of fleet.ships) counts[s.class] = (counts[s.class]||0)+1;
    for (const c in counts) {
      html += `<div class="stat-line"><span>${SHIP_CLASSES[c].name}</span><span class="val">×${counts[c]}</span></div>`;
    }
    if (isMine) {
      html += `<div class="card-desc" style="margin-top:8px">右键点击星系移动舰队。移动到敌方系统可发动攻击。</div>`;
      // 合并舰队
      const otherFleets = sys.fleets.map(f=>game.fleetsById[f]).filter(f=>f && f.id!==fleet.id && !f.civilian && f.empireId===player.id);
      if (otherFleets.length) {
        html += `<button class="btn" data-act="merge">合并本系统舰队</button>`;
      }
    }
  }

  el.innerHTML = html;

  const rerender = () => renderFleetDetail(game, fleet, el);
  const bind = (act, fn) => el.querySelectorAll(`[data-act='${act}']`).forEach(b => b.addEventListener("click", () => fn(b)));

  bind("survey", () => { fleet.order = { type: "survey" }; game.notify(player, `${fleet.name} 开始勘测 ${sys.name}`, ""); rerender(); });
  bind("auto-explore", () => { fleet.autoExplore = !fleet.autoExplore; if (fleet.autoExplore) aiSendScienceToExplore(fleet, player, game); rerender(); });
  bind("outpost", () => {
    spend(player, { alloys: 100, influence: 75 });
    claimSystem(sys, player, game);
    game.notify(player, `建立前哨站，宣称 ${sys.name}`, "good");
    rerender();
  });
  bind("station", (b) => {
    const dep = sys.deposits.find(d => d.id === parseInt(b.dataset.dep));
    if (dep && canAfford(player, { minerals: 100 })) {
      spend(player, { minerals: 100 });
      dep.station = true;
      game.notify(player, `在 ${sys.name} 建造了太空站`, "good");
      rerender();
    }
  });
  bind("colonize", (b) => {
    const p = game.planetsById[parseInt(b.dataset.planet)];
    if (p && !p.colonized) {
      colonizePlanet(p, player, game);
      game.notify(player, `殖民地已建立: ${p.name}`, "good");
      removeFleet(fleet, game);
      document.getElementById("detail-panel").classList.add("hidden");
    }
  });
  bind("merge", () => {
    const others = sys.fleets.map(f=>game.fleetsById[f]).filter(f=>f && f.id!==fleet.id && !f.civilian && f.empireId===player.id);
    for (const o of others) {
      fleet.ships.push(...o.ships);
      removeFleet(o, game);
    }
    game.notify(player, `舰队已合并`, "");
    rerender();
  });
}

// =============== 矿点详情 ===============
function showDepositDetail(game, sys, dep) {
  const icon = dep.type==="minerals"?"⛏️":dep.type==="energy"?"⚡":"🔬";
  let html = `<div class="panel-title">${icon} 太空资源</div>`;
  html += `<div class="panel-subtitle">${sys.name}</div>`;
  html += `<div class="card"><div class="stat-line"><span>类型</span><span class="val">${dep.type}</span></div>
    <div class="stat-line"><span>产量</span><span class="val">+${dep.amount}/月</span></div>
    <div class="stat-line"><span>状态</span><span class="val">${dep.station?"已建太空站":"未开发"}</span></div></div>`;
  if (!dep.station && sys.owner === game.player.id) {
    html += `<div class="card-desc">派遣工程船到此系统建造太空站以开采。</div>`;
  }
  openDetail(html);
}

// =============== 底部大面板 ===============
function openPanel(game, type) {
  if (type === "research") renderResearchPanel(game);
  else if (type === "empire") renderEmpirePanel(game);
  else if (type === "fleets") renderFleetsPanel(game);
  else if (type === "diplomacy") renderDiplomacyPanel(game);
  else if (type === "market") renderMarketPanel(game);
}

// ---------- 科技面板 ----------
function renderResearchPanel(game) {
  const p = game.player;
  const el = openDetail("");
  let html = `<div class="panel-title">🔬 科技研究</div>`;

  for (const area of ["physics", "society", "engineering"]) {
    const def = RESOURCES[area];
    html += `<div class="section-title">${def.icon} ${def.name} (+${(p.income[area]||0).toFixed(1)}/月)</div>`;
    const cur = p.research[area];
    if (cur) {
      const tech = findTech(cur);
      const prog = p.researchProgress[area];
      const pct = Math.min(100, Math.round(prog / tech.cost * 100));
      const eta = p.income[area] > 0 ? Math.ceil((tech.cost - prog) / p.income[area]) : "∞";
      html += `<div class="card">
        <div class="card-title">${tech.name} <span class="tech-tier">T${tech.tier}</span></div>
        <div class="card-desc">${tech.desc}</div>
        <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
        <div class="sub" style="font-size:11px;color:var(--text-dim)">${Math.round(prog)}/${tech.cost} · 约 ${eta} 月</div>
      </div>`;
    } else {
      // 显示可选科技
      if (!p.researchOptions[area] || p.researchOptions[area].length === 0) {
        drawResearchOptions(p, area, game);
      }
      html += `<div class="card-desc" style="margin-bottom:6px">选择研究项目:</div>`;
      for (const tid of p.researchOptions[area]) {
        const tech = findTech(tid);
        html += `<div class="card clickable" data-tech="${tid}" data-area="${area}">
          <div class="card-title">${tech.name} <span class="tech-tier">T${tech.tier} · ${tech.cost}</span></div>
          <div class="card-desc">${tech.desc}</div>
        </div>`;
      }
    }
  }

  // 已完成
  html += `<div class="section-title">已完成 (${p.techs.length})</div>`;
  html += `<div style="display:flex;flex-wrap:wrap;gap:4px">`;
  for (const tid of p.techs) {
    const t = findTech(tid);
    if (t) html += `<span class="tag" title="${t.desc}">${t.name}</span>`;
  }
  html += `</div>`;

  el.innerHTML = html;
  el.querySelectorAll("[data-tech]").forEach(card => card.addEventListener("click", () => {
    const area = card.dataset.area;
    p.research[area] = card.dataset.tech;
    renderResearchPanel(game);
  }));
}

// ---------- 帝国面板 ----------
function renderEmpirePanel(game) {
  const p = game.player;
  let html = `<div class="panel-title">🏛️ ${p.name}</div>`;
  html += `<div class="panel-subtitle">${p.speciesName} · ${AUTHORITIES[p.authority].name}</div>`;

  html += `<div class="section-title">理念</div><div style="display:flex;flex-wrap:wrap;gap:4px">`;
  for (const e of p.ethics) {
    const fanatic = e.startsWith("fanatic_");
    const base = fanatic ? e.slice(8) : e;
    html += `<span class="tag">${fanatic?"狂热":""}${ETHICS[base].name}</span>`;
  }
  html += `</div>`;

  html += `<div class="section-title">帝国统计</div><div class="card">
    <div class="stat-line"><span>🌍 殖民地</span><span class="val">${p.ownedPlanets.length}</span></div>
    <div class="stat-line"><span>⭐ 控制系统</span><span class="val">${p.ownedSystems.length}</span></div>
    <div class="stat-line"><span>👥 总人口</span><span class="val">${p.ownedPlanets.reduce((s,pid)=>s+(game.planetsById[pid]?game.planetsById[pid].pops.length:0),0)}</span></div>
    <div class="stat-line"><span>🚀 舰队</span><span class="val">${p.fleets.length}</span></div>
    <div class="stat-line"><span>⚔️ 海军容量</span><span class="val">${totalNavalUse(p,game)}/${p.navalCap}</span></div>
  </div>`;

  // 传统
  html += `<div class="section-title">传统 (凝聚力: ${Math.floor(p.resources.unity)})</div>`;
  for (const tr in TRADITIONS) {
    const def = TRADITIONS[tr];
    const owned = p.traditions.includes(tr);
    const canAdopt = !owned && p.resources.unity >= def.cost;
    html += `<div class="building-row">
      <span>${def.name} <span class="sub" style="font-size:11px;color:var(--text-dim)">${def.desc}</span></span>
      ${owned ? '<span class="tag" style="background:var(--good);color:#000">已采纳</span>' :
        `<button class="btn small" data-tr="${tr}" ${canAdopt?"":"disabled"}>☯️${def.cost}</button>`}
    </div>`;
  }

  const el = openDetail(html);
  el.querySelectorAll("[data-tr]").forEach(btn => btn.addEventListener("click", () => {
    const tr = btn.dataset.tr;
    if (p.resources.unity >= TRADITIONS[tr].cost && !p.traditions.includes(tr)) {
      p.resources.unity -= TRADITIONS[tr].cost;
      p.traditions.push(tr);
      recalcModifiers(p, game);
      game.notify(p, `采纳传统: ${TRADITIONS[tr].name}`, "good");
      renderEmpirePanel(game);
    }
  }));
}

// ---------- 舰队/造船面板 ----------
function renderFleetsPanel(game) {
  const p = game.player;
  let html = `<div class="panel-title">🚀 舰队与造船</div>`;

  // 造船厂
  const shipyards = p.ownedSystems.map(s=>game.systemsById[s]).filter(s=>s.starbase && s.starbase.shipyards>0);
  html += `<div class="section-title">造船厂</div>`;
  if (shipyards.length === 0) {
    html += `<div class="card-desc" style="color:var(--warn)">没有可用造船厂。将首都星基升级到星港以建造舰船。</div>`;
  }
  for (const sys of shipyards) {
    html += `<div class="card"><div class="card-title">${sys.name} (${STARBASE_LEVELS[sys.starbase.level].name})</div>`;
    // 队列
    if (sys.starbase.shipyardQueue.length) {
      for (const q of sys.starbase.shipyardQueue) {
        const name = q.civilian ? CIVILIAN_SHIPS[q.ship].name : SHIP_CLASSES[q.ship].name;
        const pct = Math.round(q.progress/q.time*100);
        html += `<div class="flex-between" style="font-size:12px"><span>${name}</span><span>${pct}%</span></div>
          <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>`;
      }
    }
    html += `<div style="margin-top:6px">造军舰:</div>`;
    for (const sc of p.unlockedShips) {
      const def = SHIP_CLASSES[sc];
      const can = canAfford(p, def.cost);
      html += `<div class="building-row"><span>${def.name}</span><span>${costStr(def.cost)}<button class="btn small" data-ship="${sc}" data-sys="${sys.id}" ${can?"":"disabled"}>建造</button></span></div>`;
    }
    html += `<div style="margin-top:6px">造民用船:</div>`;
    for (const cs in CIVILIAN_SHIPS) {
      if (cs === "colony" && !p.techs.includes("colony_1")) continue;
      const def = CIVILIAN_SHIPS[cs];
      const can = canAfford(p, def.cost);
      html += `<div class="building-row"><span>${def.icon} ${def.name}</span><span>${costStr(def.cost)}<button class="btn small" data-civ="${cs}" data-sys="${sys.id}" ${can?"":"disabled"}>建造</button></span></div>`;
    }
    // 星基升级
    const idx = STARBASE_ORDER.indexOf(sys.starbase.level);
    if (idx < STARBASE_ORDER.length-1) {
      const next = STARBASE_ORDER[idx+1];
      const maxIdx = STARBASE_ORDER.indexOf(p.maxStarbaseLevel);
      const locked = idx+1 > maxIdx;
      const can = canAfford(p, STARBASE_LEVELS[next].cost) && !locked;
      html += `<div class="building-row" style="margin-top:6px"><span>升级至 ${STARBASE_LEVELS[next].name}</span><span>${costStr(STARBASE_LEVELS[next].cost)}<button class="btn small" data-upg="${sys.id}" ${can?"":"disabled"}>${locked?"需科技":"升级"}</button></span></div>`;
    }
    html += `</div>`;
  }

  // 其它星基升级 (前哨->星港)
  const outposts = p.ownedSystems.map(s=>game.systemsById[s]).filter(s=>s.starbase && s.starbase.level==="outpost");
  if (outposts.length) {
    html += `<div class="section-title">前哨站升级</div>`;
    for (const sys of outposts) {
      const can = canAfford(p, STARBASE_LEVELS.starport.cost);
      html += `<div class="building-row"><span>${sys.name}</span><span>${costStr(STARBASE_LEVELS.starport.cost)}<button class="btn small" data-upg="${sys.id}" ${can?"":"disabled"}>升级星港</button></span></div>`;
    }
  }

  const el = openDetail(html);
  el.querySelectorAll("[data-ship]").forEach(btn => btn.addEventListener("click", () => {
    const sc = btn.dataset.ship; const sys = game.systemsById[parseInt(btn.dataset.sys)];
    if (canAfford(p, SHIP_CLASSES[sc].cost)) {
      spend(p, SHIP_CLASSES[sc].cost);
      sys.starbase.shipyardQueue.push({ ship: sc, progress: 0, time: SHIP_CLASSES[sc].buildTime });
      renderFleetsPanel(game);
    }
  }));
  el.querySelectorAll("[data-civ]").forEach(btn => btn.addEventListener("click", () => {
    const cs = btn.dataset.civ; const sys = game.systemsById[parseInt(btn.dataset.sys)];
    if (canAfford(p, CIVILIAN_SHIPS[cs].cost)) {
      spend(p, CIVILIAN_SHIPS[cs].cost);
      sys.starbase.shipyardQueue.push({ ship: cs, civilian: true, progress: 0, time: CIVILIAN_SHIPS[cs].buildTime });
      renderFleetsPanel(game);
    }
  }));
  el.querySelectorAll("[data-upg]").forEach(btn => btn.addEventListener("click", () => {
    const sys = game.systemsById[parseInt(btn.dataset.upg)];
    const res = upgradeStarbase(sys, p, game);
    if (res === true) { game.notify(p, `${sys.name} 星基已升级`, "good"); }
    else if (res && res.error) game.notify(p, res.error, "bad");
    renderFleetsPanel(game);
  }));
}

// ---------- 外交面板 ----------
function renderDiplomacyPanel(game) {
  const p = game.player;
  let html = `<div class="panel-title">🤝 外交</div>`;
  const known = game.empires.filter(e => e.id !== p.id && p.known.includes(e.id));
  if (known.length === 0) {
    html += `<div class="card-desc">尚未接触其他帝国。派遣科研船探索星系以发现邻居。</div>`;
  }
  for (const e of known) {
    const rel = p.relations[e.id] || { atWar: false, attitude: 0 };
    const status = rel.atWar ? '<span style="color:var(--bad)">⚔️ 战争中</span>' : rel.truce>0 ? '<span style="color:var(--warn)">停战</span>' : '<span style="color:var(--good)">和平</span>';
    html += `<div class="card">
      <div class="card-title"><span style="color:${e.color}">${e.name}</span> ${status}</div>
      <div class="card-desc">${e.speciesName} · ${AUTHORITIES[e.authority].name} · 系统 ${e.ownedSystems.length} · 战力 ${estimateEmpirePower(e, game)}</div>
      <div style="margin-top:6px">`;
    if (rel.atWar) {
      html += `<button class="btn small" data-peace="${e.id}">求和</button>`;
    } else if (rel.truce <= 0) {
      html += `<button class="btn small danger" data-war="${e.id}">宣战</button>`;
    }
    html += `</div></div>`;
  }
  const el = openDetail(html);
  el.querySelectorAll("[data-war]").forEach(btn => btn.addEventListener("click", () => {
    const e = game.empiresById[parseInt(btn.dataset.war)];
    declareWar(p, e, game);
    renderDiplomacyPanel(game);
  }));
  el.querySelectorAll("[data-peace]").forEach(btn => btn.addEventListener("click", () => {
    const e = game.empiresById[parseInt(btn.dataset.peace)];
    makePeace(p, e, game);
    renderDiplomacyPanel(game);
  }));
}

// ---------- 市场面板 ----------
function renderMarketPanel(game) {
  const p = game.player;
  let html = `<div class="panel-title">💱 银河市场</div>`;
  html += `<div class="card-desc">用能量币买卖资源。买入价 2:1，卖出价 1:0.5。</div>`;
  const tradeable = ["minerals", "food", "alloys", "consumer"];
  for (const r of tradeable) {
    const def = RESOURCES[r];
    html += `<div class="building-row">
      <span>${def.icon} ${def.name}: ${Math.floor(p.resources[r])}</span>
      <span>
        <button class="btn small" data-buy="${r}">买100 (⚡200)</button>
        <button class="btn small" data-sell="${r}">卖100 (+⚡50)</button>
      </span>
    </div>`;
  }
  const el = openDetail(html);
  el.querySelectorAll("[data-buy]").forEach(btn => btn.addEventListener("click", () => {
    const r = btn.dataset.buy;
    if (p.resources.energy >= 200) { p.resources.energy -= 200; p.resources[r] += 100; renderMarketPanel(game); }
  }));
  el.querySelectorAll("[data-sell]").forEach(btn => btn.addEventListener("click", () => {
    const r = btn.dataset.sell;
    if (p.resources[r] >= 100) { p.resources[r] -= 100; p.resources.energy += 50; renderMarketPanel(game); }
  }));
}
