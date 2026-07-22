/* render.js — canvas map rendering with camera + fog of war */
(function (global) {
  "use strict";
  const D = global.DATA;

  const Render = {
    canvas: null, ctx: null, mini: null, mctx: null,
    size: 34,             // hex radius
    cam: { x: 0, y: 0 },  // top-left world offset
    zoom: 1,
    hoverTile: null,
    selected: null,       // selected unit
    moveOverlay: null,    // {reachable:Set idx, path:[]}
    W: 0, H: 0,

    init() {
      this.canvas = document.getElementById("map");
      this.ctx = this.canvas.getContext("2d");
      this.mini = document.getElementById("minimap");
      this.mctx = this.mini.getContext("2d");
      this.resize();
      window.addEventListener("resize", () => this.resize());
    },

    resize() {
      this.W = this.canvas.width = window.innerWidth;
      this.H = this.canvas.height = window.innerHeight;
      this.draw();
    },

    worldSize() {
      const m = Game.map;
      const s = this.size * this.zoom;
      return { w: m.cols * s * Hex.SQRT3 + s, h: m.rows * s * 1.5 + s };
    },

    centerOn(col, row) {
      const s = this.size * this.zoom;
      const p = Hex.toPixel(col, row, s);
      this.cam.x = p.x - this.W / 2;
      this.cam.y = p.y - this.H / 2;
      this.clampCam();
    },

    clampCam() {
      const ws = this.worldSize();
      this.cam.x = Math.max(-100, Math.min(ws.w - this.W + 100, this.cam.x));
      this.cam.y = Math.max(-100, Math.min(ws.h - this.H + 100, this.cam.y));
    },

    screenToTile(sx, sy) {
      const s = this.size * this.zoom;
      const wx = sx + this.cam.x, wy = sy + this.cam.y;
      return Hex.fromPixel(wx, wy, s);
    },

    tileCenter(col, row) {
      const s = this.size * this.zoom;
      const p = Hex.toPixel(col, row, s);
      return { x: p.x - this.cam.x, y: p.y - this.cam.y };
    },

    draw() {
      if (!Game.map) { this.ctx && this.ctx.clearRect(0, 0, this.W, this.H); return; }
      const ctx = this.ctx, m = Game.map, s = this.size * this.zoom;
      const human = Game.human();
      ctx.clearRect(0, 0, this.W, this.H);
      ctx.fillStyle = "#04070a"; ctx.fillRect(0, 0, this.W, this.H);

      // visible tile range
      const pad = 2;
      const c0 = Math.max(0, Math.floor((this.cam.x) / (s * Hex.SQRT3)) - pad);
      const c1 = Math.min(m.cols - 1, Math.ceil((this.cam.x + this.W) / (s * Hex.SQRT3)) + pad);
      const r0 = Math.max(0, Math.floor(this.cam.y / (s * 1.5)) - pad);
      const r1 = Math.min(m.rows - 1, Math.ceil((this.cam.y + this.H) / (s * 1.5)) + pad);

      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          const t = m.get(c, r);
          if (!t) continue;
          const explored = t.explored[human.id];
          if (!explored) continue;
          this.drawTile(ctx, t, s);
        }
      }
      // borders (territory)
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
        const t = m.get(c, r);
        if (t && t.explored[human.id] && t.owner !== null) this.drawBorder(ctx, t, s);
      }
      // move overlay
      if (this.moveOverlay) this.drawMoveOverlay(ctx, s);
      // cities & units & features text
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
        const t = m.get(c, r);
        if (!t || !t.explored[human.id]) continue;
        this.drawTileContent(ctx, t, s);
      }
      // fog overlay for explored-but-not-visible
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
        const t = m.get(c, r);
        if (!t) continue;
        if (t.explored[human.id] && !t.visible[human.id]) this.drawFog(ctx, t, s);
      }
      // selection ring + path
      if (this.selected && Game.units[this.selected.id]) this.drawSelection(ctx, s);

      this.drawMinimap();
    },

    hexPath(ctx, cx, cy, s) {
      const pts = Hex.corners(cx, cy, s);
      ctx.beginPath();
      pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
      ctx.closePath();
    },

    drawTile(ctx, t, s) {
      const { x, y } = this.tileCenter(t.col, t.row);
      let color = D.TERRAIN[t.terrain].color;
      if (t.elevation === "hills") color = shade(color, -18);
      this.hexPath(ctx, x, y, s);
      ctx.fillStyle = color; ctx.fill();

      // feature tint
      if (t.feature === "woods") { ctx.fillStyle = "rgba(30,70,25,0.55)"; ctx.fill(); }
      else if (t.feature === "rainforest") { ctx.fillStyle = "rgba(20,90,30,0.55)"; ctx.fill(); }
      else if (t.feature === "marsh") { ctx.fillStyle = "rgba(60,80,40,0.5)"; ctx.fill(); }
      else if (t.feature === "reef") { ctx.fillStyle = "rgba(40,180,160,0.35)"; ctx.fill(); }

      // mountain shading
      if (t.elevation === "mountain") {
        ctx.fillStyle = "#6b6f77"; ctx.fill();
        ctx.fillStyle = "#8a9099";
        ctx.beginPath();
        ctx.moveTo(x, y - s * 0.55); ctx.lineTo(x + s * 0.5, y + s * 0.35);
        ctx.lineTo(x - s * 0.5, y + s * 0.35); ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#eef"; ctx.beginPath();
        ctx.moveTo(x, y - s * 0.55); ctx.lineTo(x + s * 0.16, y - s * 0.1);
        ctx.lineTo(x - s * 0.16, y - s * 0.1); ctx.closePath(); ctx.fill();
      }

      ctx.strokeStyle = "rgba(0,0,0,0.28)"; ctx.lineWidth = 1;
      this.hexPath(ctx, x, y, s); ctx.stroke();

      // river edges
      if (t.river) {
        ctx.strokeStyle = "#3aa0e0"; ctx.lineWidth = Math.max(2, s * 0.09);
        this.hexPath(ctx, x, y, s * 0.86); ctx.stroke();
      }
    },

    drawTileContent(ctx, t, s) {
      const { x, y } = this.tileCenter(t.col, t.row);
      // woods / forest glyphs
      if (t.feature === "woods" && t.elevation !== "mountain") {
        ctx.fillStyle = "#123a12";
        for (const d of [[-0.3,0.1],[0.25,-0.15],[0.05,0.3]]) tree(ctx, x + d[0]*s, y + d[1]*s, s*0.3);
      } else if (t.feature === "rainforest") {
        ctx.fillStyle = "#0c4a1a";
        for (const d of [[-0.25,0.15],[0.28,0.0],[0.0,0.28]]) tree(ctx, x + d[0]*s, y + d[1]*s, s*0.34, true);
      } else if (t.feature === "oasis") {
        ctx.fillStyle = "#2a7fb0"; ctx.beginPath(); ctx.ellipse(x, y, s*0.35, s*0.24, 0, 0, 7); ctx.fill();
      }

      // improvement marker
      if (t.improvement) this.drawImprovement(ctx, x, y, s, t.improvement);

      // resource marker
      if (t.resource) {
        const res = D.RES[t.resource];
        const col = res.cls === "luxury" ? "#e8c04a" : res.cls === "strategic" ? "#d0603a" : "#cfe0a0";
        ctx.fillStyle = col; ctx.strokeStyle = "#000"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(x + s*0.42, y - s*0.42, s*0.16, 0, 7); ctx.fill(); ctx.stroke();
      }

      // barbarian camp
      if (t.barbCamp) { ctx.fillStyle = "#c0392b"; ctx.font = `${s*0.7}px serif`; ctx.textAlign="center"; ctx.textBaseline="middle"; ctx.fillText("☠", x, y); }

      // district marker
      if (t.districtKey && t.districtKey !== "wonder") {
        const d = D.DISTRICT[t.districtKey];
        ctx.fillStyle = "rgba(20,30,45,0.85)"; this.hexPath(ctx, x, y, s*0.82); ctx.fill();
        ctx.fillStyle = "#e9d9a0"; ctx.font = `${s*0.62}px serif`; ctx.textAlign="center"; ctx.textBaseline="middle";
        ctx.fillText(d && d.icon ? d.icon : "▣", x, y);
      }
      if (t.wonder) {
        ctx.fillStyle = "#d9b451"; ctx.font = `${s*0.7}px serif`; ctx.textAlign="center"; ctx.textBaseline="middle";
        ctx.fillText("★", x, y);
      }

      // city
      if (t.cityId) this.drawCity(ctx, t, s, x, y);
      // unit
      if (t.unitId) this.drawUnit(ctx, Game.units[t.unitId], s, x, y);
    },

    drawImprovement(ctx, x, y, s, key) {
      ctx.save();
      ctx.translate(x, y);
      ctx.lineWidth = Math.max(1, s*0.05);
      if (key === "farm") {
        ctx.strokeStyle = "#e0d060"; ctx.fillStyle="#b8a030";
        for (let i=-1;i<=1;i++){ ctx.fillRect(-s*0.4, i*s*0.18-s*0.05, s*0.8, s*0.1); }
      } else if (key === "mine") {
        ctx.fillStyle="#4a3a2a"; ctx.beginPath(); ctx.moveTo(-s*0.3,s*0.25); ctx.lineTo(0,-s*0.1); ctx.lineTo(s*0.3,s*0.25); ctx.fill();
      } else if (key === "pasture" || key === "camp") {
        ctx.strokeStyle="#8a6a3a"; ctx.strokeRect(-s*0.35,-s*0.2,s*0.7,s*0.4);
      } else if (key === "plantation" || key === "quarry") {
        ctx.strokeStyle="#9aa060"; ctx.strokeRect(-s*0.3,-s*0.3,s*0.6,s*0.6);
      } else if (key === "fishingBoats") {
        ctx.strokeStyle="#cde"; ctx.beginPath(); ctx.arc(0,0,s*0.25,0,7); ctx.stroke();
      } else {
        ctx.strokeStyle="#aaa"; ctx.strokeRect(-s*0.25,-s*0.25,s*0.5,s*0.5);
      }
      ctx.restore();
    },

    drawCity(ctx, t, s, x, y) {
      const city = Game.cities[t.cityId];
      const p = Game.player(city.owner);
      ctx.fillStyle = p.color; ctx.strokeStyle = "#0a141d"; ctx.lineWidth = 2;
      // walls / center building
      this.hexPath(ctx, x, y, s*0.9); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#0d1c2b"; ctx.beginPath();
      ctx.moveTo(x-s*0.45,y+s*0.35); ctx.lineTo(x-s*0.45,y-s*0.1); ctx.lineTo(x-s*0.2,y-s*0.35);
      ctx.lineTo(x+s*0.2,y-s*0.35); ctx.lineTo(x+s*0.45,y-s*0.1); ctx.lineTo(x+s*0.45,y+s*0.35); ctx.closePath(); ctx.fill();
      // name plate + pop
      ctx.fillStyle = "#0c1826ee"; roundRect(ctx, x - s*0.9, y - s*1.15, s*1.8, s*0.42, 4); ctx.fill();
      ctx.strokeStyle = p.color; ctx.lineWidth=1.5; roundRect(ctx, x - s*0.9, y - s*1.15, s*1.8, s*0.42, 4); ctx.stroke();
      ctx.fillStyle="#fff"; ctx.font=`bold ${Math.max(9,s*0.32)}px Segoe UI`; ctx.textAlign="left"; ctx.textBaseline="middle";
      ctx.fillText(city.name, x - s*0.62, y - s*0.94);
      ctx.fillStyle=p.color; ctx.beginPath(); ctx.arc(x - s*0.75, y - s*0.94, s*0.14, 0, 7); ctx.fill();
      ctx.fillStyle="#fff"; ctx.font=`bold ${Math.max(8,s*0.24)}px Segoe UI`; ctx.textAlign="center";
      ctx.fillText(city.pop, x - s*0.75, y - s*0.93);
      // health bar if damaged
      if (city.hp < city.maxHp) this.hpBar(ctx, x, y - s*1.28, s*1.6, city.hp/city.maxHp);
    },

    drawUnit(ctx, u, s, x, y) {
      if (!u) return;
      const p = Game.player(u.owner);
      const def = Game.unitDef(u);
      const col = u.owner === Game.barbId ? "#c0392b" : p.color;
      // civilian = rounded, military = shield
      ctx.save();
      ctx.strokeStyle = "#0a141d"; ctx.lineWidth = 2;
      ctx.fillStyle = col;
      if (def.cls === "civilian") {
        ctx.beginPath(); ctx.arc(x, y + s*0.05, s*0.32, 0, 7); ctx.fill(); ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(x, y - s*0.32); ctx.lineTo(x + s*0.3, y - s*0.15);
        ctx.lineTo(x + s*0.3, y + s*0.12); ctx.lineTo(x, y + s*0.38);
        ctx.lineTo(x - s*0.3, y + s*0.12); ctx.lineTo(x - s*0.3, y - s*0.15);
        ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      ctx.fillStyle = "#fff"; ctx.font = `${s*0.36}px serif`; ctx.textAlign="center"; ctx.textBaseline="middle";
      ctx.fillText(def.icon, x, y + s*0.05);
      ctx.restore();
      // hp bar
      if (u.hp < 100) this.hpBar(ctx, x, y + s*0.5, s*0.7, u.hp/100);
      // fortify / done indicator
      if (u.owner === 0 && u.moves <= 0 && def.cls !== "civilian") { ctx.fillStyle="#0008"; ctx.beginPath(); ctx.arc(x,y+s*0.05,s*0.33,0,7); ctx.fill(); }
    },

    hpBar(ctx, x, y, w, frac) {
      ctx.fillStyle = "#000a"; ctx.fillRect(x - w/2, y, w, 4);
      ctx.fillStyle = frac > 0.6 ? "#4caf50" : frac > 0.3 ? "#e6b422" : "#e04a3a";
      ctx.fillRect(x - w/2, y, w * frac, 4);
    },

    drawBorder(ctx, t, s) {
      const p = Game.player(t.owner);
      if (!p) return;
      const { x, y } = this.tileCenter(t.col, t.row);
      const nbs = Hex.neighbors(t.col, t.row);
      const pts = Hex.corners(x, y, s);
      ctx.strokeStyle = p.color; ctx.lineWidth = Math.max(2, s*0.09);
      for (let i = 0; i < 6; i++) {
        const n = Game.map.get(nbs[i].col, nbs[i].row);
        if (!n || n.owner !== t.owner) {
          const a = pts[i], b = pts[(i+1)%6];
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
      }
    },

    drawFog(ctx, t, s) {
      const { x, y } = this.tileCenter(t.col, t.row);
      this.hexPath(ctx, x, y, s);
      ctx.fillStyle = "rgba(4,8,12,0.5)"; ctx.fill();
    },

    drawMoveOverlay(ctx, s) {
      const m = Game.map;
      ctx.save();
      for (const idx of this.moveOverlay.reachable) {
        const r = Math.floor(idx / m.cols), c = idx - r * m.cols;
        const { x, y } = this.tileCenter(c, r);
        this.hexPath(ctx, x, y, s*0.92);
        ctx.fillStyle = "rgba(90,180,255,0.18)"; ctx.fill();
        ctx.strokeStyle = "rgba(120,200,255,0.4)"; ctx.lineWidth=1; ctx.stroke();
      }
      if (this.moveOverlay.path) {
        ctx.strokeStyle = "#e6d060"; ctx.lineWidth = Math.max(2,s*0.08); ctx.setLineDash([s*0.2, s*0.15]);
        ctx.beginPath();
        const start = this.selected;
        let prev = this.tileCenter(start.col, start.row);
        ctx.moveTo(prev.x, prev.y);
        for (const step of this.moveOverlay.path) { const pc = this.tileCenter(step.col, step.row); ctx.lineTo(pc.x, pc.y); }
        ctx.stroke(); ctx.setLineDash([]);
      }
      ctx.restore();
    },

    drawSelection(ctx, s) {
      const u = this.selected;
      const { x, y } = this.tileCenter(u.col, u.row);
      ctx.strokeStyle = "#f5e06a"; ctx.lineWidth = Math.max(2, s*0.09);
      const t = Date.now()/400;
      this.hexPath(ctx, x, y, s * (0.95 + Math.sin(t)*0.03)); ctx.stroke();
    },

    computeMoveOverlay(u) {
      const m = Game.map;
      const reachable = new Set();
      // BFS limited by moves (approx: show tiles within move points *this turn* and a bit beyond)
      const maxRange = (Game.unitDef(u).move || 2) + 1;
      for (const n of Hex.ring(u.col, u.row, maxRange + 2)) {
        const t = m.get(n.col, n.row);
        if (!t) continue;
        if (t.elevation === "mountain") continue;
        if (t.unitId && t.unitId !== u.id) { const o = Game.units[t.unitId]; if (o && o.owner === u.owner) continue; }
        const res = Game.pathfind(u, n.col, n.row);
        if (res && res.dist.get(m.idx(n.col, n.row)) <= u.moves) reachable.add(m.idx(n.col, n.row));
      }
      this.moveOverlay = { reachable, path: null };
    },

    drawMinimap() {
      const m = Game.map, mc = this.mctx, W = this.mini.width, H = this.mini.height;
      const sx = W / m.cols, sy = H / m.rows;
      mc.fillStyle = "#04070a"; mc.fillRect(0, 0, W, H);
      const human = Game.human();
      for (const t of m.tiles) {
        if (!t.explored[human.id]) continue;
        let col = D.TERRAIN[t.terrain].color;
        if (t.elevation === "mountain") col = "#777";
        if (t.owner !== null) { const p = Game.player(t.owner); if (p) col = p.color; }
        if (t.cityId) col = "#fff";
        mc.fillStyle = col;
        const px = (t.col + (t.row&1)*0.5) * sx;
        mc.fillRect(px, t.row * sy, Math.ceil(sx)+0.5, Math.ceil(sy)+0.5);
        if (!t.visible[human.id]) { mc.fillStyle = "rgba(4,8,12,0.45)"; mc.fillRect(px, t.row*sy, Math.ceil(sx)+0.5, Math.ceil(sy)+0.5); }
      }
      // viewport rect
      const s = this.size * this.zoom;
      const vc0 = this.cam.x / (s*Hex.SQRT3), vr0 = this.cam.y/(s*1.5);
      const vc1 = (this.cam.x+this.W)/(s*Hex.SQRT3), vr1=(this.cam.y+this.H)/(s*1.5);
      mc.strokeStyle = "#f5e06a"; mc.lineWidth = 1;
      mc.strokeRect(vc0*sx, vr0*sy, (vc1-vc0)*sx, (vr1-vr0)*sy);
    }
  };

  function tree(ctx, x, y, r, round) {
    ctx.beginPath();
    if (round) { ctx.arc(x, y - r*0.3, r*0.7, 0, 7); }
    else { ctx.moveTo(x, y - r); ctx.lineTo(x + r*0.7, y + r*0.6); ctx.lineTo(x - r*0.7, y + r*0.6); ctx.closePath(); }
    ctx.fill();
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r);
    ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath();
  }
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n>>16)&255, g=(n>>8)&255, b=n&255;
    r=Math.max(0,Math.min(255,r+amt)); g=Math.max(0,Math.min(255,g+amt)); b=Math.max(0,Math.min(255,b+amt));
    return `rgb(${r},${g},${b})`;
  }

  global.Render = Render;
})(window);
