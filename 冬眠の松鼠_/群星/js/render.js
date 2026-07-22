// ============================================================
// render.js - Canvas 渲染 (银河视图 & 星系视图)
// ============================================================

const View = {
  canvas: null,
  ctx: null,
  mode: "galaxy",       // 'galaxy' | 'system'
  currentSystemId: null,
  cam: { x: 0, y: 0, zoom: 1 },
  dragging: false,
  lastMouse: { x: 0, y: 0 },
  hover: null,          // {type, id}
  selected: null,       // {type:'fleet', id} 已选中舰队
  mouse: { x: 0, y: 0 },
  stars: [],            // 背景星
};

function initView(game) {
  const c = document.getElementById("galaxy-canvas");
  View.canvas = c;
  View.ctx = c.getContext("2d");
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  // 背景星
  View.stars = [];
  for (let i = 0; i < 300; i++) {
    View.stars.push({ x: Math.random(), y: Math.random(), s: Math.random() * 1.5, a: Math.random() * 0.6 + 0.2 });
  }

  setupInput(game);
  // 初始镜头对准玩家母星
  const home = game.systemsById[game.player.homeSystemId];
  if (home) { View.cam.x = home.x; View.cam.y = home.y; View.cam.zoom = 1.2; }
}

function resizeCanvas() {
  const c = View.canvas;
  const rect = c.getBoundingClientRect();
  c.width = rect.width;
  c.height = rect.height;
}

function worldToScreen(x, y) {
  return {
    x: (x - View.cam.x) * View.cam.zoom + View.canvas.width / 2,
    y: (y - View.cam.y) * View.cam.zoom + View.canvas.height / 2,
  };
}
function screenToWorld(sx, sy) {
  return {
    x: (sx - View.canvas.width / 2) / View.cam.zoom + View.cam.x,
    y: (sy - View.canvas.height / 2) / View.cam.zoom + View.cam.y,
  };
}

// =============== 主渲染循环 ===============
function render(game) {
  const ctx = View.ctx;
  const w = View.canvas.width, h = View.canvas.height;
  ctx.clearRect(0, 0, w, h);

  // 背景
  ctx.fillStyle = "#05070f";
  ctx.fillRect(0, 0, w, h);
  drawBackgroundStars(ctx, w, h);

  if (View.mode === "galaxy") {
    drawGalaxy(game, ctx);
  } else {
    drawSystem(game, ctx);
  }
}

function drawBackgroundStars(ctx, w, h) {
  for (const s of View.stars) {
    ctx.globalAlpha = s.a;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(s.x * w, s.y * h, s.s, s.s);
  }
  ctx.globalAlpha = 1;
}

// =============== 银河视图 ===============
function drawGalaxy(game, ctx) {
  const player = game.player;

  // 超空间通道
  ctx.lineWidth = 1;
  const drawn = new Set();
  for (const sysId in game.systemsById) {
    const sys = game.systemsById[sysId];
    const a = worldToScreen(sys.x, sys.y);
    for (const nId of sys.hyperlanes) {
      const key = Math.min(sys.id, nId) + "-" + Math.max(sys.id, nId);
      if (drawn.has(key)) continue;
      drawn.add(key);
      const n = game.systemsById[nId];
      const b = worldToScreen(n.x, n.y);
      const seen = sys.explored || n.explored || game.debugReveal;
      ctx.strokeStyle = seen ? "rgba(74,158,255,0.28)" : "rgba(74,158,255,0.08)";
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }

  // 帝国领土 (以拥有系统连线着色圈)
  for (const sysId in game.systemsById) {
    const sys = game.systemsById[sysId];
    if (sys.owner) {
      const emp = game.empiresById[sys.owner];
      const p = worldToScreen(sys.x, sys.y);
      ctx.fillStyle = hexToRgba(emp.color, 0.10);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 28 * View.cam.zoom, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 星系节点
  for (const sysId in game.systemsById) {
    const sys = game.systemsById[sysId];
    const p = worldToScreen(sys.x, sys.y);
    if (p.x < -40 || p.x > View.canvas.width + 40 || p.y < -40 || p.y > View.canvas.height + 40) continue;

    const seen = sys.explored || game.debugReveal;
    const r = Math.max(2.5, sys.starSize * View.cam.zoom * 0.7);

    // 光晕
    if (seen) {
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 3);
      grad.addColorStop(0, hexToRgba(sys.starColor, 0.6));
      grad.addColorStop(1, hexToRgba(sys.starColor, 0));
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(p.x, p.y, r * 3, 0, Math.PI * 2); ctx.fill();
    }

    ctx.fillStyle = seen ? sys.starColor : "#3a4560";
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();

    // 拥有者边框
    if (sys.owner && seen) {
      const emp = game.empiresById[sys.owner];
      ctx.strokeStyle = emp.color;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x, p.y, r + 3, 0, Math.PI * 2); ctx.stroke();
    }

    // 星基图标
    if (sys.starbase && seen) {
      ctx.fillStyle = "#fff";
      ctx.font = `${8 * Math.min(2, View.cam.zoom)}px sans-serif`;
      ctx.fillText("⬢", p.x + r + 2, p.y - r);
    }

    // 敌对标记
    if (sys.hostile && seen) {
      ctx.fillStyle = "#ff5b5b";
      ctx.font = "10px sans-serif";
      ctx.fillText("☠", p.x - r - 10, p.y + 3);
    }

    // 名称
    if (View.cam.zoom > 0.8 && seen) {
      ctx.fillStyle = "rgba(207,224,245,0.85)";
      ctx.font = "10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(sys.name, p.x, p.y + r + 12);
      ctx.textAlign = "left";
    }

    // hover 高亮
    if (View.hover && View.hover.type === "system" && View.hover.id === sys.id) {
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(p.x, p.y, r + 6, 0, Math.PI * 2); ctx.stroke();
    }
  }

  // 舰队 (银河视图: 显示在系统上, 带偏移)
  drawFleetsGalaxy(game, ctx);

  // 选中舰队的移动路径
  drawSelectedPath(game, ctx);
}

function drawFleetsGalaxy(game, ctx) {
  for (const fid in game.fleetsById) {
    const fleet = game.fleetsById[fid];
    const emp = game.empiresById[fleet.empireId];
    if (!emp) continue;
    // 只显示玩家已探索区域的舰队
    const sys = game.systemsById[fleet.systemId];
    if (!sys) continue;
    const seen = sys.explored || emp.isPlayer || game.debugReveal;
    if (!seen) continue;

    let px, py;
    if (fleet.path && fleet.pathIndex < fleet.path.length - 1) {
      const a = game.systemsById[fleet.path[fleet.pathIndex]];
      const b = game.systemsById[fleet.path[fleet.pathIndex + 1]];
      const wx = a.x + (b.x - a.x) * fleet.moveProgress;
      const wy = a.y + (b.y - a.y) * fleet.moveProgress;
      const sp = worldToScreen(wx, wy);
      px = sp.x; py = sp.y;
    } else {
      const sp = worldToScreen(sys.x, sys.y);
      // 多舰队环绕偏移
      px = sp.x + 12; py = sp.y - 12;
    }

    ctx.save();
    ctx.fillStyle = emp.color;
    if (fleet.civilian) {
      // 民用船图标
      ctx.font = "12px sans-serif";
      ctx.fillText(CIVILIAN_SHIPS[fleet.civilian].icon, px - 6, py + 4);
    } else {
      // 军用: 三角形
      ctx.beginPath();
      ctx.moveTo(px, py - 5);
      ctx.lineTo(px - 4, py + 4);
      ctx.lineTo(px + 4, py + 4);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = "8px sans-serif";
      ctx.fillText(fleet.ships.length, px + 5, py + 2);
    }
    // 选中框
    if (View.selected && View.selected.id === fleet.id) {
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(px - 8, py - 8, 16, 16);
    }
    ctx.restore();
  }
}

function drawSelectedPath(game, ctx) {
  if (!View.selected || View.selected.type !== "fleet") return;
  const fleet = game.fleetsById[View.selected.id];
  if (!fleet || !fleet.path) return;
  ctx.strokeStyle = "rgba(91,255,138,0.7)";
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  for (let i = fleet.pathIndex; i < fleet.path.length; i++) {
    const s = game.systemsById[fleet.path[i]];
    const p = worldToScreen(s.x, s.y);
    if (i === fleet.pathIndex) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();
  ctx.setLineDash([]);
}

// =============== 星系视图 ===============
function drawSystem(game, ctx) {
  const sys = game.systemsById[View.currentSystemId];
  if (!sys) return;
  const w = View.canvas.width, h = View.canvas.height;
  const cx = w / 2, cy = h / 2;
  const zoom = View.cam.zoom;

  // 恒星
  const starR = sys.starSize * 4 * zoom;
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, starR * 2.5);
  grad.addColorStop(0, sys.starColor);
  grad.addColorStop(0.4, hexToRgba(sys.starColor, 0.5));
  grad.addColorStop(1, hexToRgba(sys.starColor, 0));
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(cx, cy, starR * 2.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = sys.starColor;
  ctx.beginPath(); ctx.arc(cx, cy, starR, 0, Math.PI * 2); ctx.fill();

  // 轨道 + 行星
  for (const planet of sys.planets) {
    const orbitR = planet.orbit * zoom;
    // 轨道线
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, orbitR, 0, Math.PI * 2); ctx.stroke();

    const px = cx + Math.cos(planet.orbitAngle) * orbitR;
    const py = cy + Math.sin(planet.orbitAngle) * orbitR;
    const info = PLANET_CLASSES[planet.class];
    const pr = Math.max(4, (planet.size ? planet.size * 0.5 + 4 : 5) * zoom * 0.5);

    // 行星
    ctx.fillStyle = info.color;
    ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.fill();
    // 殖民/拥有标记
    if (planet.colonized) {
      const emp = game.empiresById[planet.owner];
      ctx.strokeStyle = emp ? emp.color : "#fff";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(px, py, pr + 3, 0, Math.PI * 2); ctx.stroke();
    }
    // 名称
    if (zoom > 0.6) {
      ctx.fillStyle = "rgba(207,224,245,0.8)";
      ctx.font = "10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(info.icon + " " + planet.name, px, py + pr + 12);
      ctx.textAlign = "left";
    }
    planet._screenX = px; planet._screenY = py; planet._screenR = pr;

    // hover
    if (View.hover && View.hover.type === "planet" && View.hover.id === planet.id) {
      ctx.strokeStyle = "#fff";
      ctx.beginPath(); ctx.arc(px, py, pr + 6, 0, Math.PI * 2); ctx.stroke();
    }
  }

  // 星基 (恒星旁)
  if (sys.starbase) {
    const emp = game.empiresById[sys.owner];
    ctx.fillStyle = emp ? emp.color : "#aaa";
    ctx.font = `${16 * Math.min(1.5, zoom)}px sans-serif`;
    ctx.fillText("⬢", cx + starR + 10, cy - starR);
    ctx.fillStyle = "#fff";
    ctx.font = "10px sans-serif";
    ctx.fillText(STARBASE_LEVELS[sys.starbase.level].name, cx + starR + 10, cy - starR + 16);
  }

  // 资源矿点
  let depIdx = 0;
  for (const dep of sys.deposits) {
    const angle = (depIdx / sys.deposits.length) * Math.PI * 2 + 1;
    const dx = cx + Math.cos(angle) * (200 * zoom);
    const dy = cy + Math.sin(angle) * (200 * zoom);
    const icon = dep.type === "minerals" ? "⛏️" : dep.type === "energy" ? "⚡" : "🔬";
    ctx.font = "14px sans-serif";
    ctx.fillText(icon, dx, dy);
    if (dep.station) { ctx.font = "9px sans-serif"; ctx.fillStyle = "#5bff8a"; ctx.fillText("●", dx + 14, dy - 6); }
    dep._screenX = dx; dep._screenY = dy;
    depIdx++;
  }

  // 敌对生物
  if (sys.hostile) {
    ctx.fillStyle = "#ff5b5b";
    ctx.font = "20px sans-serif";
    ctx.fillText("☠", cx - 100 * zoom, cy - 100 * zoom);
    ctx.font = "10px sans-serif";
    ctx.fillText(`${sys.hostile.name} (${Math.max(0,Math.round(sys.hostile.hp))})`, cx - 100 * zoom, cy - 80 * zoom);
  }

  // 舰队 (系统内环绕)
  const fleetsHere = sys.fleets.map(fid => game.fleetsById[fid]).filter(f => f);
  fleetsHere.forEach((fleet, i) => {
    if (fleet.path) return; // 移动中的在galaxy层
    const emp = game.empiresById[fleet.empireId];
    const angle = (i / Math.max(1, fleetsHere.length)) * Math.PI * 2;
    const fx = cx + Math.cos(angle) * (60 * zoom);
    const fy = cy + Math.sin(angle) * (60 * zoom);
    ctx.fillStyle = emp ? emp.color : "#fff";
    if (fleet.civilian) {
      ctx.font = "14px sans-serif";
      ctx.fillText(CIVILIAN_SHIPS[fleet.civilian].icon, fx - 7, fy + 5);
    } else {
      ctx.beginPath();
      ctx.moveTo(fx, fy - 6); ctx.lineTo(fx - 5, fy + 5); ctx.lineTo(fx + 5, fy + 5);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.font = "9px sans-serif";
      ctx.fillText(fleet.ships.length, fx + 6, fy + 3);
    }
    fleet._screenX = fx; fleet._screenY = fy;
    if (View.selected && View.selected.id === fleet.id) {
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5;
      ctx.strokeRect(fx - 9, fy - 9, 18, 18);
    }
  });
}

function hexToRgba(hex, a) {
  hex = hex.replace("#", "");
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  return `rgba(${r},${g},${b},${a})`;
}
