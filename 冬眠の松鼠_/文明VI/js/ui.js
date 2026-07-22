/* ui.js — HUD panels, city screen, tech/civic trees */
(function (global) {
  "use strict";
  const D = global.DATA;

  const UI = {
    treeTab: "tech",

    init() {
      document.getElementById("nextTurnBtn").onclick = () => Main.nextTurn();
      document.getElementById("upClose").onclick = () => Main.deselect();
      document.getElementById("cwClose").onclick = () => this.closeCity();
      document.getElementById("treeClose").onclick = () => this.closeTree();
      document.getElementById("tabTech").onclick = () => { this.treeTab = "tech"; this.renderTree(); };
      document.getElementById("tabCivic").onclick = () => { this.treeTab = "civic"; this.renderTree(); };
      document.getElementById("techTray").onclick = () => this.openTree("tech");
      document.getElementById("civicTray").onclick = () => this.openTree("civic");

      Game.on("log", msg => this.pushLog(msg));
      Game.on("changed", () => this.refreshHUD());
      Game.on("turn", () => this.refreshHUD());
      Game.on("needTech", () => this.openTree("tech"));
      Game.on("needCivic", () => this.openTree("civic"));
      Game.on("gameover", d => this.gameOver(d));
    },

    // ---------------- TOP BAR / TRAYS ----------------
    refreshHUD() {
      if (!Game.map) return;
      const p = Game.human();
      const y = Game.aggregateYields(p);
      document.getElementById("civEmblem").textContent = p.data.civ[0];
      document.getElementById("civEmblem").style.background = p.color;
      document.querySelector("#yScience b").textContent = "+" + fmt(y.sci);
      document.querySelector("#yCulture b").textContent = "+" + fmt(y.cul);
      document.querySelector("#yGold b").textContent = Math.floor(p.gold);
      document.getElementById("goldRate").textContent = `(${y.gold>=0?"+":""}${fmt(y.gold)})`;
      document.querySelector("#yFaith b").textContent = Math.floor(p.faith);
      document.getElementById("faithRate").textContent = `(+${fmt(y.faith)})`;
      document.getElementById("eraLabel").textContent = (D.ERA_NAMES[p.era] || p.era) + "时代";
      document.getElementById("turnNum").textContent = Game.turn;
      document.getElementById("yearLabel").textContent = yearFor(Game.turn);

      // research trays
      this.updateTray("tech", p, y.sci);
      this.updateTray("civic", p, y.cul);

      if (document.getElementById("cityPanel").classList.contains("hidden") === false && this.openCityId)
        this.renderCity(Game.cities[this.openCityId]);
      if (document.getElementById("treePanel").classList.contains("hidden") === false)
        this.renderTree();
      if (this.selUnit && Game.units[this.selUnit.id]) this.renderUnitPanel(this.selUnit);
    },

    updateTray(kind, p, rate) {
      const isTech = kind === "tech";
      const key = isTech ? p.researchTech : p.researchCivic;
      const data = isTech ? D.TECH : D.CIVIC;
      const prog = isTech ? p.techProgress : p.civicProgress;
      const nameEl = document.getElementById(isTech ? "techName" : "civicName");
      const barEl = document.getElementById(isTech ? "techBar" : "civicBar");
      const turnsEl = document.getElementById(isTech ? "techTurns" : "civicTurns");
      if (!key) { nameEl.textContent = isTech ? "选择研究 ▸" : "选择市政 ▸"; barEl.style.width = "0%"; turnsEl.textContent = ""; return; }
      const d = data[key];
      nameEl.textContent = d.name;
      const pct = Math.min(100, prog / d.cost * 100);
      barEl.style.width = pct + "%";
      const remain = Math.max(0, d.cost - prog);
      const turns = rate > 0 ? Math.ceil(remain / rate) : "—";
      turnsEl.textContent = `${Math.floor(prog)}/${d.cost}  ·  ${turns} 回合`;
    },

    // ---------------- LOG ----------------
    pushLog(msg) {
      const log = document.getElementById("log");
      const el = document.createElement("div");
      el.className = "log-item"; el.textContent = msg;
      log.appendChild(el);
      setTimeout(() => el.remove(), 6000);
      while (log.children.length > 6) log.firstChild.remove();
    },

    // ---------------- UNIT PANEL ----------------
    selUnit: null,
    showUnitPanel(u) {
      this.selUnit = u;
      document.getElementById("unitPanel").classList.remove("hidden");
      this.renderUnitPanel(u);
    },
    hideUnitPanel() { this.selUnit = null; document.getElementById("unitPanel").classList.add("hidden"); },

    renderUnitPanel(u) {
      const def = Game.unitDef(u);
      document.getElementById("upName").textContent = def.name;
      const stats = document.getElementById("upStats");
      const parts = [`<span>生命 ${u.hp}</span>`, `<span>◈ 移动 ${u.moves}/${def.maxMoves||def.move}</span>`];
      if (def.atk) parts.push(`<span>⚔ ${Game.combatStrength(u,true)}</span>`);
      if (def.rangedAtk) parts.push(`<span>➶ ${def.rangedAtk}（射程 ${def.range}）</span>`);
      if (def.charges) parts.push(`<span>🔨 ${u.charges} 次充能</span>`);
      stats.innerHTML = parts.join("");

      const actions = document.getElementById("upActions");
      actions.innerHTML = "";
      const t = Game.map.get(u.col, u.row);
      const mkBtn = (label, fn, disabled) => {
        const b = document.createElement("button"); b.className = "act-btn"; b.innerHTML = label;
        b.disabled = !!disabled; b.onclick = fn; actions.appendChild(b);
      };
      if (def.founds) mkBtn("🏛 建立城市", () => Main.foundCity(u), t.cityId || Game.tooCloseToCity(u.col,u.row,u.owner) || u.moves<=0 || MapGen.isWater(t));
      if (def.builds) {
        const can = Game.canImprove(Game.human(), t) && u.moves > 0;
        const imp = Game.improvementFor(Game.human(), t);
        mkBtn(`🔨 建造${imp?D.IMPROVEMENT[imp].name:"改良设施"}`, () => Main.buildImprovement(u), !can);
      }
      if (def.cls !== "civilian") {
        mkBtn(u.fortified ? "🛡 已驻守" : "🛡 驻守", () => { u.fortified = true; u.moves = 0; Main.refresh(); }, u.moves<=0);
        if (def.rangedAtk) mkBtn("➶ 远程攻击", () => Main.beginRanged(u), u.moves<=0);
      }
      mkBtn("💤 跳过", () => { u.moves = 0; Main.nextUnitOrDeselect(); });
      mkBtn("✖ 休眠", () => { u.sleeping = true; u.moves = 0; Main.nextUnitOrDeselect(); });
    },

    // ---------------- TILE INFO ----------------
    showTileInfo(t) {
      const el = document.getElementById("tileInfo");
      if (!t || !t.explored[Game.human().id]) { el.classList.add("hidden"); return; }
      el.classList.remove("hidden");
      const parts = [];
      let terr = D.TERRAIN[t.terrain].name;
      if (t.elevation === "hills") terr = "丘陵" + terr;
      if (t.elevation === "mountain") terr = "山脉";
      parts.push(`<b>${terr}</b>`);
      if (t.feature) parts.push(D.FEATURE[t.feature].name);
      if (t.river) parts.push("河流");
      if (t.resource) parts.push(`◆ ${D.RES[t.resource].name}`);
      if (t.improvement) parts.push(D.IMPROVEMENT[t.improvement].name);
      if (t.districtKey && D.DISTRICT[t.districtKey]) parts.push(D.DISTRICT[t.districtKey].name);
      if (t.wonder) parts.push("★ " + D.WONDER[t.wonder].name);
      // yields
      const y = Game.tileYield(t);
      const yp = [];
      for (const k of ["food","prod","gold","sci","cul","faith"]) if (y[k]) yp.push(`${D.YIELD_ICONS[k]}${y[k]}`);
      if (yp.length) parts.push(yp.join(" "));
      if (t.appeal) parts.push(`宜居度 ${t.appeal>0?"+":""}${t.appeal}`);
      el.innerHTML = parts.join(" &nbsp;·&nbsp; ");
    },

    // ---------------- CITY SCREEN ----------------
    openCityId: null,
    openCity(city) {
      this.openCityId = city.id;
      document.getElementById("cityPanel").classList.remove("hidden");
      Render.centerOn(city.col, city.row);
      this.renderCity(city);
    },
    closeCity() { this.openCityId = null; document.getElementById("cityPanel").classList.add("hidden"); },

    renderCity(city) {
      if (!city) return;
      document.getElementById("cwName").textContent = city.name + (city.isCapital ? " ★" : "");
      document.getElementById("cwPop").textContent = city.pop;
      const cy = Game.cityYields(city);
      const housing = Game.cityHousing(city);
      const thresh = Game.growthThreshold(city.pop);
      const surplus = cy.food - city.pop * 2;
      const growEl = document.getElementById("cwGrowth");
      const gt = surplus > 0 ? Math.ceil((thresh - city.foodStore) / surplus) : "∞";
      growEl.innerHTML = `粮食 ${Math.floor(city.foodStore)}/${thresh} · ${gt} 回合后增长 · 🏠${housing}`;

      // yields
      const yEl = document.getElementById("cwYields");
      yEl.innerHTML = "";
      for (const k of ["food","prod","gold","sci","cul","faith"]) {
        const d = document.createElement("div");
        d.innerHTML = `<span>${D.YIELD_ICONS[k]} ${cap(k)}</span><b>${fmt(cy[k])}</b>`;
        yEl.appendChild(d);
      }

      // districts
      const dEl = document.getElementById("cwDistricts");
      dEl.innerHTML = "";
      for (const dk in city.districts) {
        const dist = D.DISTRICT[dk]; const inst = city.districts[dk];
        const div = document.createElement("div"); div.className = "dist";
        let html = `<b>${dist.name}</b>`;
        if (inst.buildings.length) html += inst.buildings.map(b => `<div class="bld">• ${D.BUILDING[b].name}</div>`).join("");
        else html += `<div class="bld">— 暂无建筑 —</div>`;
        div.innerHTML = html; dEl.appendChild(div);
      }

      // production
      const cur = document.getElementById("cwCurrent");
      if (city.buildQueue) {
        const turns = cy.prod > 0 ? Math.ceil((city.buildQueue.cost - city.buildProgress)/cy.prod) : "—";
        cur.textContent = `— ${city.buildQueue.name}（${Math.floor(city.buildProgress)}/${city.buildQueue.cost}，${turns}回合）`;
      } else cur.textContent = "—（请选择生产项）";

      const pEl = document.getElementById("cwProduce");
      pEl.innerHTML = "";
      const opts = Game.productionOptions(city);
      const cats = ["Units","Districts","Buildings","Wonders"];
      const catNames = { Units:"单位", Districts:"区域", Buildings:"建筑", Wonders:"奇观" };
      for (const cat of cats) {
        const items = opts.filter(o => o.cat === cat);
        if (!items.length) continue;
        const t = document.createElement("div"); t.className = "prod-cat"; t.textContent = catNames[cat]; pEl.appendChild(t);
        for (const it of items) {
          const turns = cy.prod > 0 ? Math.ceil(it.cost / cy.prod) : "—";
          const row = document.createElement("div");
          row.className = "prod-item" + (city.buildQueue && city.buildQueue.key === it.key && city.buildQueue.kind===it.kind ? " active" : "");
          row.innerHTML = `<span class="pi-name">${it.name}</span><span class="pi-cost">⚙${it.cost}</span><span class="pi-turns">${turns} 回合</span>`;
          row.onclick = () => { Game.setProduction(city, it); this.renderCity(city); Render.draw(); };
          pEl.appendChild(row);
        }
      }
    },

    // ---------------- TECH / CIVIC TREE ----------------
    openTree(tab) {
      this.treeTab = tab;
      document.getElementById("treePanel").classList.remove("hidden");
      this.renderTree();
    },
    closeTree() { document.getElementById("treePanel").classList.add("hidden"); },

    renderTree() {
      const isTech = this.treeTab === "tech";
      document.getElementById("tabTech").classList.toggle("active", isTech);
      document.getElementById("tabCivic").classList.toggle("active", !isTech);
      const p = Game.human();
      const data = isTech ? D.TECH : D.CIVIC;
      const done = isTech ? p.techsDone : p.civicsDone;
      const boosts = isTech ? p.boostsTech : p.boostsCivic;
      const current = isTech ? p.researchTech : p.researchCivic;
      const canRes = k => (isTech ? Game.techUnlocked(p, k) : Game.civicUnlocked(p, k));

      const canvas = document.getElementById("treeCanvas");
      canvas.innerHTML = "";
      const COLW = 210, ROWH = 96, PADX = 24, PADY = 20;
      let maxX = 0, maxY = 0;
      const pos = {};
      for (const k in data) {
        const [gx, gy] = data[k].pos;
        pos[k] = { x: PADX + gx * COLW, y: PADY + gy * ROWH };
        maxX = Math.max(maxX, pos[k].x + 150); maxY = Math.max(maxY, pos[k].y + 80);
      }
      canvas.style.width = (maxX + PADX) + "px";
      canvas.style.height = (maxY + PADY) + "px";

      // SVG lines
      const NS = "http://www.w3.org/2000/svg";
      const svg = document.createElementNS(NS, "svg");
      svg.setAttribute("class", "tree-lines");
      svg.setAttribute("width", maxX + PADX); svg.setAttribute("height", maxY + PADY);
      for (const k in data) {
        for (const pre of data[k].pre) {
          if (!pos[pre]) continue;
          const line = document.createElementNS(NS, "path");
          const x1 = pos[pre].x + 150, y1 = pos[pre].y + 30;
          const x2 = pos[k].x, y2 = pos[k].y + 30;
          const mx = (x1 + x2) / 2;
          line.setAttribute("d", `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`);
          line.setAttribute("fill", "none");
          line.setAttribute("stroke", done[pre] ? "#3fae5a" : "#3a5570");
          line.setAttribute("stroke-width", "2");
          svg.appendChild(line);
        }
      }
      canvas.appendChild(svg);

      for (const k in data) {
        const d = data[k];
        const node = document.createElement("div");
        node.className = "node";
        if (done[k]) node.classList.add("done");
        else if (current === k) node.classList.add("active");
        else if (canRes(k)) node.classList.add("avail");
        else node.classList.add("locked");
        node.style.left = pos[k].x + "px"; node.style.top = pos[k].y + "px";

        const rate = isTech ? Game.aggregateYields(p).sci : Game.aggregateYields(p).cul;
        const prog = current === k ? (isTech ? p.techProgress : p.civicProgress) : (done[k] ? d.cost : 0);
        const turns = rate > 0 ? Math.ceil((d.cost - prog) / rate) : "—";
        let html = `<div class="n-name">${d.name}</div><div class="n-cost">${isTech?"⚗":"♫"} ${d.cost}${done[k]?" ✓":` · ${turns}回合`}</div>`;
        if (d.boost) html += `<div class="n-boost${boosts[k]?" got":""}">${boosts[k]?"✓ ":"◔ "}${d.boost}</div>`;
        const unlocks = this.unlockText(k, isTech);
        if (unlocks) html += `<div class="n-unlocks">${unlocks}</div>`;
        node.innerHTML = html;

        if (!done[k] && canRes(k)) node.onclick = () => {
          if (isTech) Game.setResearchTech(p, k); else Game.setResearchCivic(p, k);
          this.closeTree(); this.refreshHUD();
        };
        canvas.appendChild(node);
      }
    },

    unlockText(key, isTech) {
      const icons = [];
      for (const uk in D.UNIT) { const u = D.UNIT[uk]; if ((isTech && u.tech === key) || (!isTech && u.civic === key)) icons.push(u.icon); }
      for (const dk in D.DISTRICT) { const d = D.DISTRICT[dk]; if ((isTech && d.tech === key) || (!isTech && d.civic === key)) icons.push(d.icon||"▣"); }
      for (const bk in D.BUILDING) { const b = D.BUILDING[bk]; if (isTech && b.tech === key) icons.push("🏠"); }
      for (const wk in D.WONDER) { const w = D.WONDER[wk]; if ((isTech && w.tech === key) || (!isTech && w.civic === key)) icons.push("★"); }
      return icons.slice(0, 6).join(" ");
    },

    gameOver(d) {
      const el = document.getElementById("startScreen");
      el.classList.remove("hidden");
      el.querySelector(".start-window").innerHTML =
        `<h1>${d.won ? "胜利" : "失败"}</h1><p class="tag">${d.msg}</p>
         <p style="margin:16px 0; opacity:.8;">第 ${Game.turn} 回合 · ${yearFor(Game.turn)}</p>
         <button class="start-btn" onclick="location.reload()">再玩一局</button>`;
    }
  };

  function fmt(n) { return (Math.round(n * 10) / 10).toString(); }
  function cap(s) { return D.YIELD_NAMES[s] || s; }
  function yearFor(turn) {
    // Civ-like: slows down over time
    let year;
    if (turn <= 50) year = -4000 + turn * 60;
    else if (turn <= 100) year = -1000 + (turn - 50) * 20;
    else if (turn <= 150) year = 0 + (turn - 100) * 10;
    else year = 500 + (turn - 150) * 5;
    year = Math.round(year);
    return year < 0 ? `公元前${-year}年` : `公元${year}年`;
  }

  global.UI = UI;
})(window);
