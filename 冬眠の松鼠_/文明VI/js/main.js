/* main.js — input handling, start flow, game loop */
(function (global) {
  "use strict";
  const D = global.DATA;

  const Main = {
    selUnit: null,
    rangedMode: false,
    drag: null,
    keys: {},

    boot() {
      Render.init();
      UI.init();
      this.buildStartScreen();
      this.bindInput();
      requestAnimationFrame(() => this.loop());
    },

    buildStartScreen() {
      const grid = document.getElementById("leaderGrid");
      grid.innerHTML = "";
      let selected = D.CIVS[0].id;
      D.CIVS.forEach((c, i) => {
        const card = document.createElement("div");
        card.className = "leader-card" + (i === 0 ? " sel" : "");
        card.innerHTML = `<div class="lc-emb" style="background:${c.color}">${c.leader[0]}</div>
          <div class="lc-leader">${c.leader}</div><div class="lc-civ">${c.civ}</div>
          <div class="lc-uniq">${c.unit}</div>`;
        card.title = c.ability;
        card.onclick = () => {
          selected = c.id;
          grid.querySelectorAll(".leader-card").forEach(e => e.classList.remove("sel"));
          card.classList.add("sel");
        };
        grid.appendChild(card);
      });
      document.getElementById("startBtn").onclick = () => {
        const mapSize = document.getElementById("mapSize").value;
        const numCivs = parseInt(document.getElementById("numCivs").value);
        this.startGame({ civId: selected, mapSize, numCivs, seed: Math.floor(Math.random()*1e9) });
      };
    },

    startGame(opts) {
      Game.init(opts);
      document.getElementById("startScreen").classList.add("hidden");
      const cap = Game.human().startCol;
      Render.centerOn(Game.human().startCol, Game.human().startRow);
      UI.refreshHUD();
      // auto-pick first research
      const p = Game.human();
      Game.setResearchTech(p, "pottery");
      Game.setResearchCivic(p, "codeOfLaws");
      UI.pushLog(`欢迎，${p.data.civ} 的 ${p.data.leader}。建立你的第一座城市吧！`);
      UI.pushLog(p.data.ability);
      this.selectFirstUnit();
      Render.draw();
    },

    // ---------------- INPUT ----------------
    bindInput() {
      const cv = Render.canvas;
      cv.addEventListener("mousedown", e => this.onDown(e));
      window.addEventListener("mousemove", e => this.onMove(e));
      window.addEventListener("mouseup", e => this.onUp(e));
      cv.addEventListener("wheel", e => this.onWheel(e), { passive: false });
      cv.addEventListener("contextmenu", e => e.preventDefault());
      window.addEventListener("keydown", e => this.onKey(e));
      window.addEventListener("keyup", e => { this.keys[e.key] = false; });

      const mini = document.getElementById("minimap");
      mini.addEventListener("mousedown", e => {
        const rect = mini.getBoundingClientRect();
        const fx = (e.clientX - rect.left) / rect.width, fy = (e.clientY - rect.top) / rect.height;
        Render.centerOn(Math.floor(fx * Game.map.cols), Math.floor(fy * Game.map.rows));
        Render.draw();
      });
    },

    onDown(e) {
      if (e.button === 0) {
        this.drag = { x: e.clientX, y: e.clientY, camX: Render.cam.x, camY: Render.cam.y, moved: false };
      }
    },

    onMove(e) {
      if (this.drag) {
        const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y;
        if (Math.abs(dx) + Math.abs(dy) > 4) {
          this.drag.moved = true;
          Render.canvas.classList.add("dragging");
          Render.cam.x = this.drag.camX - dx;
          Render.cam.y = this.drag.camY - dy;
          Render.clampCam();
          Render.draw();
        }
      }
      // hover
      if (!Game.map) return;
      const tc = Render.screenToTile(e.clientX, e.clientY);
      const t = Game.map.get(tc.col, tc.row);
      Render.hoverTile = t;
      UI.showTileInfo(t);
      if (this.selUnit && t && !this.rangedMode) {
        // draw path preview to hovered reachable tile
        if (Render.moveOverlay && Render.moveOverlay.reachable) {
          const res = Game.pathfind(this.selUnit, tc.col, tc.row);
          Render.moveOverlay.path = res ? res.path : null;
        }
      }
    },

    onUp(e) {
      Render.canvas.classList.remove("dragging");
      if (this.drag && !this.drag.moved && e.button === 0) this.onClick(e);
      this.drag = null;
    },

    onClick(e) {
      if (!Game.map || Game.over) return;
      const tc = Render.screenToTile(e.clientX, e.clientY);
      const t = Game.map.get(tc.col, tc.row);
      if (!t) return;

      if (this.rangedMode && this.selUnit) {
        const def = Game.unitDef(this.selUnit);
        if (t.unitId) {
          const target = Game.units[t.unitId];
          if (target && Game.isEnemy(this.selUnit.owner, target.owner) &&
              Hex.distance(this.selUnit.col, this.selUnit.row, t.col, t.row) <= def.range) {
            Game.rangedAttack(this.selUnit, target);
            this.rangedMode = false; this.refresh();
            return;
          }
        }
        this.rangedMode = false; this.refresh(); return;
      }

      // clicking own city -> open city screen
      if (t.cityId) {
        const city = Game.cities[t.cityId];
        if (city.owner === 0 && (!t.unitId || (this.selUnit && this.selUnit.col===t.col && this.selUnit.row===t.row) || !this.selUnit)) {
          // if a unit sits on city and it's selected, allow move; else open
          if (!t.unitId || t.unitId === (this.selUnit && this.selUnit.id)) { UI.openCity(city); return; }
        }
      }

      // clicking a unit of ours -> select
      if (t.unitId) {
        const u = Game.units[t.unitId];
        if (u.owner === 0) {
          if (this.selUnit && this.selUnit.id === u.id) {
            if (t.cityId) UI.openCity(Game.cities[t.cityId]);
          } else this.selectUnit(u);
          return;
        }
        // enemy unit + we have selected melee adjacent -> attack via move
        if (this.selUnit && Game.isEnemy(0, u.owner)) {
          this.orderMove(tc.col, tc.row); return;
        }
      }

      // move selected unit
      if (this.selUnit) { this.orderMove(tc.col, tc.row); return; }

      // else deselect / open owned city
      if (t.cityId && Game.cities[t.cityId].owner === 0) UI.openCity(Game.cities[t.cityId]);
    },

    orderMove(col, row) {
      const u = this.selUnit;
      if (!u || u.moves <= 0) return;
      Game.moveUnitTo(u, col, row);
      if (Game.units[u.id]) {
        Render.computeMoveOverlay(u);
        if (u.moves <= 0) this.nextUnitOrDeselect();
      } else { this.deselect(); }
      this.refresh();
    },

    onWheel(e) {
      e.preventDefault();
      const old = Render.zoom;
      const factor = e.deltaY < 0 ? 1.12 : 0.89;
      Render.zoom = Math.max(0.4, Math.min(2.2, Render.zoom * factor));
      // zoom toward cursor
      const s = Render.zoom / old;
      Render.cam.x = (Render.cam.x + e.clientX) * s - e.clientX;
      Render.cam.y = (Render.cam.y + e.clientY) * s - e.clientY;
      Render.clampCam();
      Render.draw();
    },

    onKey(e) {
      if (!Game.map) return;
      this.keys[e.key] = true;
      if (e.key === "Enter") { this.nextTurn(); }
      else if (e.key === "Escape") { this.deselect(); UI.closeCity(); UI.closeTree(); this.rangedMode = false; }
      else if (e.key === " ") { e.preventDefault(); this.nextUnitOrDeselect(); }
      else if (e.key.toLowerCase() === "b" && this.selUnit && Game.unitDef(this.selUnit).builds) this.buildImprovement(this.selUnit);
      else if (e.key.toLowerCase() === "f" && this.selUnit && Game.unitDef(this.selUnit).founds) this.foundCity(this.selUnit);
      else if (e.key.toLowerCase() === "t") UI.openTree("tech");
      else if (e.key.toLowerCase() === "c") UI.openTree("civic");
    },

    // ---------------- SELECTION ----------------
    selectUnit(u) {
      this.selUnit = u; Render.selected = u; this.rangedMode = false;
      Render.computeMoveOverlay(u);
      UI.showUnitPanel(u);
      Render.draw();
    },
    deselect() { this.selUnit = null; Render.selected = null; Render.moveOverlay = null; UI.hideUnitPanel(); Render.draw(); },

    selectFirstUnit() {
      const settler = Game.unitsOf(0).find(u => Game.unitDef(u).founds);
      if (settler) this.selectUnit(settler);
      else this.selectFirstUnit2();
    },
    selectFirstUnit2() { const u = Game.unitsOf(0)[0]; if (u) this.selectUnit(u); },

    nextUnitOrDeselect() {
      const units = Game.unitsOf(0).filter(u => u.moves > 0 && !u.sleeping && !u.fortified);
      const idx = units.findIndex(u => this.selUnit && u.id === this.selUnit.id);
      const next = units[(idx + 1) % units.length];
      if (next && (!this.selUnit || next.id !== this.selUnit.id || units.length===1)) this.selectUnit(next);
      else this.deselect();
    },

    // ---------------- UNIT ACTIONS ----------------
    foundCity(u) {
      const city = Game.foundCity(u);
      if (city) { this.deselect(); UI.openCity(city); this.refresh(); }
    },
    buildImprovement(u) {
      const t = Game.map.get(u.col, u.row);
      if (Game.buildImprovement(u, t)) { if (Game.units[u.id]) { Render.computeMoveOverlay(u); this.refresh(); } else this.deselect(); }
    },
    beginRanged(u) { this.rangedMode = true; UI.pushLog("请选择射程内的目标。"); },

    // ---------------- TURN ----------------
    nextTurn() {
      if (Game.over) return;
      // if units still have moves, cycle to them first (one nudge)
      const pending = Game.unitsOf(0).filter(u => u.moves > 0 && !u.sleeping && !u.fortified && Game.unitDef(u).cls !== "civilian");
      const cityNeedsProd = Game.citiesOf(0).some(c => !c.buildQueue);
      Game.endTurn();
      // clear sleeping flags refreshed
      this.deselect();
      // select next actionable unit for new turn
      const act = Game.unitsOf(0).find(u => u.moves > 0);
      if (act) this.selectUnit(act);
      this.refresh();
    },

    refresh() { UI.refreshHUD(); Render.draw(); },

    loop() {
      // redraw for animations (selection pulse, path)
      if (Game.map && this.selUnit) Render.draw();
      requestAnimationFrame(() => this.loop());
    }
  };

  global.Main = Main;
  window.addEventListener("DOMContentLoaded", () => Main.boot());
})(window);
