// ============================================================
//  hud.js  -  all DOM/2D-canvas UI: vitals, ammo, money,
//  killfeed, radar, round timer, buy menu, scoreboard.
// ============================================================
import { WEAPONS, GRENADES, GEAR, BUY_CATEGORIES, TEAM } from "./config.js";

export class HUD {
  constructor() {
    this.$ = (id) => document.getElementById(id);
    this.healthEl = this.$("health-value");
    this.armorEl = this.$("armor-value");
    this.ammoClip = this.$("ammo-clip");
    this.ammoReserve = this.$("ammo-reserve");
    this.ammoSep = this.$("ammo-sep");
    this.weaponName = this.$("weapon-name");
    this.moneyBox = this.$("money-box");
    this.moneyValue = this.$("money-value");
    this.roundTimer = this.$("round-timer");
    this.scoreCT = this.$("score-ct");
    this.scoreT = this.$("score-t");
    this.roundPhase = this.$("round-phase");
    this.killfeed = this.$("killfeed");
    this.centerMsg = this.$("center-msg");
    this.hitmarkerEl = this.$("hitmarker");
    this.hurtEl = this.$("hurt-overlay");
    this.scopeEl = this.$("scope-overlay");
    this.crosshair = this.$("crosshair");
    this.bombStatus = this.$("bomb-status");
    this.weaponSlots = this.$("weapon-slots");
    this.radarCanvas = this.$("radar-canvas");
    this.radarCtx = this.radarCanvas.getContext("2d");

    this.buyMenu = this.$("buy-menu");
    this.buyMoney = this.$("buy-money-value");
    this.buyCats = this.$("buy-categories");
    this.buyItems = this.$("buy-items");
    this.scoreboard = this.$("scoreboard");

    this._hmTimer = null;
    this._centerTimer = null;
    this._buyCat = "rifles";
    this._radarBg = null;
  }

  setHealth(h) {
    this.healthEl.textContent = Math.max(0, Math.round(h));
    this.healthEl.classList.toggle("low", h <= 25 && h > 0);
  }
  setArmor(a) { this.armorEl.textContent = Math.max(0, Math.round(a)); }

  setAmmo(clip, reserve, isGun) {
    if (!isGun || clip === Infinity) {
      this.ammoClip.textContent = "";
      this.ammoSep.style.display = "none";
      this.ammoReserve.textContent = "";
    } else {
      this.ammoClip.textContent = clip;
      this.ammoSep.style.display = "";
      this.ammoReserve.textContent = reserve;
    }
  }
  setWeaponName(n) { this.weaponName.textContent = n; }

  setMoney(m, animate) {
    this.moneyValue.textContent = m;
    if (this.buyMoney) this.buyMoney.textContent = m;
    if (animate) {
      this.moneyBox.classList.remove("flash");
      void this.moneyBox.offsetWidth;
      this.moneyBox.classList.add("flash");
    }
  }

  setRoundTimer(sec) {
    sec = Math.max(0, Math.ceil(sec));
    const m = Math.floor(sec / 60), s = sec % 60;
    this.roundTimer.textContent = `${m}:${s.toString().padStart(2, "0")}`;
    this.roundTimer.style.color = sec <= 10 ? "#ff5555" : "#fff";
  }
  setScore(ct, t) { this.scoreCT.textContent = ct; this.scoreT.textContent = t; }
  setPhase(text) { this.roundPhase.textContent = text || ""; }

  showCenter(msg, sub = "", dur = 2.5, color = "#fff") {
    this.centerMsg.innerHTML = msg + (sub ? `<span class="sub">${sub}</span>` : "");
    this.centerMsg.style.color = color;
    this.centerMsg.classList.add("show");
    clearTimeout(this._centerTimer);
    if (dur > 0) this._centerTimer = setTimeout(() => this.centerMsg.classList.remove("show"), dur * 1000);
  }
  hideCenter() { this.centerMsg.classList.remove("show"); }

  hitmarker(kill) {
    this.hitmarkerEl.classList.remove("show", "kill");
    void this.hitmarkerEl.offsetWidth;
    this.hitmarkerEl.classList.add("show");
    if (kill) this.hitmarkerEl.classList.add("kill");
  }
  hurt() {
    this.hurtEl.classList.add("hit");
    setTimeout(() => this.hurtEl.classList.remove("hit"), 30);
  }

  setScope(level) {
    if (level > 0) { this.scopeEl.classList.add("active"); this.crosshair.style.display = "none"; }
    else { this.scopeEl.classList.remove("active"); this.crosshair.style.display = ""; }
  }
  setCrosshairGap(px) { this.crosshair.style.setProperty("--ch-gap", px + "px"); }

  setBombStatus(text, planted) {
    this.bombStatus.textContent = text || "";
    this.bombStatus.classList.toggle("planted", !!planted);
  }

  addKill(killer, killerTeam, victim, victimTeam, weaponName, headshot) {
    const row = document.createElement("div");
    row.className = "kf-row";
    row.innerHTML =
      `<span class="kf-name ${killerTeam.toLowerCase()}">${killer}</span>` +
      `<span class="kf-weapon">${weaponName}${headshot ? ' <span class="kf-hs">&#9733;</span>' : ""}</span>` +
      `<span class="kf-name ${victimTeam.toLowerCase()}">${victim}</span>`;
    this.killfeed.appendChild(row);
    while (this.killfeed.children.length > 6) this.killfeed.removeChild(this.killfeed.firstChild);
    setTimeout(() => row.remove(), 6000);
  }

  setWeaponSlots(inv) {
    const slots = [];
    if (inv.primary) slots.push({ key: "1", name: WEAPONS[inv.primary.key].name, active: inv.current === "primary" });
    slots.push({ key: "2", name: WEAPONS[inv.pistol.key].name, active: inv.current === "pistol" });
    slots.push({ key: "3", name: "Knife", active: inv.current === "knife" });
    if (inv.grenades.length) {
      const names = inv.grenades.map((g) => GRENADES[g].name.split(" ")[0]).join(",");
      slots.push({ key: "4", name: names, active: inv.current === "grenade" });
    }
    if (inv.c4) slots.push({ key: "5", name: "C4", active: inv.current === "c4" });
    this.weaponSlots.innerHTML = slots.map((s) =>
      `<div class="wslot ${s.active ? "active" : ""}"><span class="wslot-key">${s.key}</span>${s.name}</div>`
    ).join("");
  }

  // ---------------- Radar ----------------
  _drawRadarBg(map) {
    const size = 220;
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const g = c.getContext("2d");
    const b = map.bounds;
    const span = b.maxX - b.minX;
    const scale = size / span;
    g.fillStyle = "rgba(30,40,30,0.6)";
    g.fillRect(0, 0, size, size);
    // walls
    g.fillStyle = "rgba(180,160,120,0.7)";
    for (const col of map.colliders) {
      if (!col.nav || col.maxY < 3) continue;
      const x = (col.minX - b.minX) * scale;
      const y = (col.minZ - b.minZ) * scale;
      const w = (col.maxX - col.minX) * scale;
      const h = (col.maxZ - col.minZ) * scale;
      g.fillRect(x, y, w, h);
    }
    // site labels
    g.fillStyle = "rgba(255,220,80,0.9)"; g.font = "bold 16px Arial"; g.textAlign = "center";
    const toRadar = (wx, wz) => [(wx - b.minX) * scale, (wz - b.minZ) * scale];
    let [ax, ay] = toRadar(map.bombsites.A.center.x, map.bombsites.A.center.z);
    g.fillText("A", ax, ay);
    g.fillStyle = "rgba(255,120,60,0.9)";
    let [bx, by] = toRadar(map.bombsites.B.center.x, map.bombsites.B.center.z);
    g.fillText("B", bx, by);
    this._radarBg = c;
    this._radarScale = scale;
    this._radarBounds = b;
  }

  renderRadar(map, player, bots, bomb, visibleEnemies) {
    if (!this._radarBg) this._drawRadarBg(map);
    const g = this.radarCtx;
    const size = 220;
    g.clearRect(0, 0, size, size);
    const b = this._radarBounds, scale = this._radarScale;

    // rotate around player so player faces up
    g.save();
    g.translate(size / 2, size / 2);
    g.rotate(player.yaw); // world -> screen rotation
    const px = (player.pos.x - b.minX) * scale;
    const pz = (player.pos.z - b.minZ) * scale;
    g.translate(-px, -pz);
    g.drawImage(this._radarBg, 0, 0);

    const dot = (wx, wz, color, r = 4) => {
      g.fillStyle = color;
      g.beginPath();
      g.arc((wx - b.minX) * scale, (wz - b.minZ) * scale, r, 0, Math.PI * 2);
      g.fill();
    };
    // teammates
    for (const bot of bots) {
      if (!bot.alive) continue;
      if (bot.team === player.team) dot(bot.pos.x, bot.pos.z, "#4fa3ff", 3.2);
    }
    // visible enemies
    for (const e of visibleEnemies) {
      dot(e.pos.x, e.pos.z, "#ff4444", 3.5);
    }
    // bomb
    if (bomb && (bomb.planted || bomb.dropped)) dot(bomb.pos.x, bomb.pos.z, "#ffcc00", 3);

    g.restore();

    // player arrow (always centered, pointing up)
    g.fillStyle = "#ffffff";
    g.save();
    g.translate(size / 2, size / 2);
    g.beginPath();
    g.moveTo(0, -6); g.lineTo(4, 5); g.lineTo(0, 2); g.lineTo(-4, 5); g.closePath();
    g.fill();
    g.restore();
  }

  // ---------------- Buy menu ----------------
  buildBuyMenu(onBuy, getState) {
    this.onBuy = onBuy;
    this.getState = getState;
    this.buyCats.innerHTML = "";
    for (const cat of BUY_CATEGORIES) {
      const el = document.createElement("div");
      el.className = "buy-cat" + (cat.id === this._buyCat ? " active" : "");
      el.innerHTML = `<span class="cat-key">${cat.key}</span>${cat.label}`;
      el.onclick = () => this.selectCategory(cat.id);
      el.dataset.cat = cat.id;
      this.buyCats.appendChild(el);
    }
    this.selectCategory(this._buyCat);
  }

  selectCategory(id) {
    this._buyCat = id;
    [...this.buyCats.children].forEach((c) => c.classList.toggle("active", c.dataset.cat === id));
    this.renderBuyItems();
  }
  selectCategoryByKey(key) {
    const cat = BUY_CATEGORIES.find((c) => c.key === key);
    if (cat) this.selectCategory(cat.id);
  }

  renderBuyItems() {
    const cat = BUY_CATEGORIES.find((c) => c.id === this._buyCat);
    if (!cat) return;
    const state = this.getState();
    this.buyItems.innerHTML = "";
    cat.items.forEach((key) => {
      let data, price, meta = "", type;
      if (WEAPONS[key]) { data = WEAPONS[key]; price = data.price; type = "weapon"; meta = `${data.mag !== undefined && data.mag !== Infinity ? data.mag + " rnds" : ""}`; }
      else if (GRENADES[key]) { data = GRENADES[key]; price = data.price; type = "grenade"; }
      else if (GEAR[key]) { data = GEAR[key]; price = data.price; type = "gear"; }
      if (!data) return;
      if (data.team && data.team !== state.team) return; // team-restricted
      const el = document.createElement("div");
      el.className = "buy-item";
      const owned = state.owned(key);
      const afford = state.money >= price;
      if (owned) el.classList.add("owned");
      if (!afford && !owned) el.classList.add("cant-afford");
      el.innerHTML =
        `<div class="bi-icon">${data.icon || ""}</div>` +
        `<div class="bi-name">${data.name}</div>` +
        `<div class="bi-price">$${price}</div>` +
        (meta ? `<div class="bi-meta">${meta}</div>` : "");
      el.onclick = () => { if (this.onBuy) this.onBuy(key, type, price); };
      this.buyItems.appendChild(el);
    });
  }

  showBuyMenu() { this.buyMenu.classList.remove("hidden"); this.renderBuyItems(); }
  hideBuyMenu() { this.buyMenu.classList.add("hidden"); }
  get buyOpen() { return !this.buyMenu.classList.contains("hidden"); }

  // ---------------- Scoreboard ----------------
  showScoreboard(players, scoreCT, scoreT) {
    document.getElementById("sb-ct-score").textContent = scoreCT;
    document.getElementById("sb-t-score").textContent = scoreT;
    const ctBody = document.getElementById("sb-ct-body");
    const tBody = document.getElementById("sb-t-body");
    const head = `<tr class="sb-head"><td>Name</td><td class="num">K</td><td class="num">D</td><td class="num">$</td></tr>`;
    ctBody.innerHTML = head; tBody.innerHTML = head;
    for (const p of players) {
      const row = document.createElement("tr");
      row.className = "sb-row" + (p.alive ? "" : " dead") + (p.you ? " you" : "");
      row.innerHTML = `<td>${p.name}</td><td class="num">${p.kills}</td><td class="num">${p.deaths}</td><td class="num">$${p.money}</td>`;
      (p.team === TEAM.CT ? ctBody : tBody).appendChild(row);
    }
    this.scoreboard.classList.remove("hidden");
  }
  hideScoreboard() { this.scoreboard.classList.add("hidden"); }
}
