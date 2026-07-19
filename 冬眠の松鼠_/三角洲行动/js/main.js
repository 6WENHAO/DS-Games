/* ===== 主循环 / 状态机 ===== */
"use strict";

const App = {
  state: "menu",   // menu / raid / settle
  settings: null,
  input: { fwd: false, back: false, left: false, right: false, run: false,
           crouch: false, jump: false, fire: false, ads: false },
  pointerLocked: false,
  raidTime: 0, raidLimit: 25 * 60,
  extractTimer: 0, activeExtract: null,
  searching: null, searchTimer: 0,
  lastFrame: 0,
  bossKilled: false,

  init() {
    Profile.load();
    this.settings = Profile.data.settings;
    if (!this.settings) {
      this.settings = { sens: 1.0, fov: 75, volume: 0.8, shadows: true };
      Profile.data.settings = this.settings;
    }
    AudioSys.volume = this.settings.volume;
    World.initRenderer();
    ModelLib.init();
    this.bindInput();
    UI.showMainMenu();
    requestAnimationFrame((t) => this.loop(t));
  },

  saveSettings() {
    Profile.data.settings = this.settings;
    Profile.save();
  },

  /* ---------- 输入 ---------- */
  bindInput() {
    document.addEventListener("keydown", (e) => this.onKey(e, true));
    document.addEventListener("keyup", (e) => this.onKey(e, false));
    document.addEventListener("mousedown", (e) => {
      if (this.state !== "raid") return;
      if (!this.pointerLocked) { this.lockPointer(); return; }
      if (e.button === 0) this.input.fire = true;
      if (e.button === 2) this.input.ads = true;
    });
    document.addEventListener("mouseup", (e) => {
      if (e.button === 0) this.input.fire = false;
      if (e.button === 2) this.input.ads = false;
    });
    document.addEventListener("contextmenu", (e) => e.preventDefault());
    document.addEventListener("mousemove", (e) => {
      if (!this.pointerLocked || this.state !== "raid") return;
      const sens = 0.0022 * this.settings.sens * (Player.adsTarget > 0.5 ? 0.6 : 1);
      Player.yaw -= e.movementX * sens;
      Player.pitch -= e.movementY * sens;
    });
    document.addEventListener("pointerlockchange", () => {
      this.pointerLocked = document.pointerLockElement === World.renderer.domElement;
      if (!this.pointerLocked) { this.input.fire = false; this.input.ads = false; }
    });
  },

  onKey(e, down) {
    if (this.state !== "raid") return;
    const k = e.code;
    if (k === "Tab") {
      e.preventDefault();
      if (down) this.toggleInventory();
      return;
    }
    if (down && k === "KeyM") { this.toggleMap(); return; }
    if (down && k === "Escape") return;
    switch (k) {
      case "KeyW": this.input.fwd = down; break;
      case "KeyS": this.input.back = down; break;
      case "KeyA": this.input.left = down; break;
      case "KeyD": this.input.right = down; break;
      case "ShiftLeft": case "ShiftRight": this.input.run = down; break;
      case "ControlLeft": case "KeyC": this.input.crouch = down; e.preventDefault(); break;
      case "Space": this.input.jump = down; e.preventDefault(); break;
    }
    if (!down) return;
    switch (k) {
      case "KeyR": Player.startReload(); break;
      case "Digit1": Player.switchWeapon(0); break;
      case "Digit2": Player.switchWeapon(1); break;
      case "Digit4": Player.useMed(); break;
      case "KeyQ": Player.useAbility(); break;
      case "KeyF": this.tryInteract(); break;
    }
  },

  lockPointer() {
    if (World.renderer && this.state === "raid" &&
        !Inventory.open && !this.mapOpen) {
      World.renderer.domElement.requestPointerLock();
    }
  },

  toggleInventory() {
    if (Inventory.open) {
      Inventory.hide();
      this.lockPointer();
    } else {
      if (this.mapOpen) this.toggleMap();
      document.exitPointerLock();
      document.getElementById("inv-title").firstChild.textContent = "装备 ";
      Inventory.show(null);
    }
  },

  mapOpen: false,
  toggleMap() {
    this.mapOpen = !this.mapOpen;
    document.getElementById("map-overlay").classList.toggle("hidden", !this.mapOpen);
    if (this.mapOpen) {
      if (Inventory.open) Inventory.hide();
      document.exitPointerLock();
      UI.drawMap();
    } else this.lockPointer();
  },

  /* ---------- 开局 ---------- */
  startRaid() {
    AudioSys.init(); AudioSys.resume();
    const snapshot = Profile.deploySnapshot();
    World.build(this.settings);
    const spawn = World.spawns[Math.floor(Math.random() * World.spawns.length)];
    Player.init(snapshot, spawn);
    AI.spawnAll();
    this.state = "raid";
    this.raidTime = 0;
    this.extractTimer = 0;
    this.activeExtract = null;
    this.searching = null;
    this.bossKilled = false;
    this.mapOpen = false;
    document.getElementById("map-overlay").classList.add("hidden");
    Inventory.hide();
    UI.menuLayer().innerHTML = "";
    UI.showHud(true);
    UI.el("objective-tip").textContent = "搜集物资，前往绿色撤离点撤离";
    AudioSys.startAmbient();
    this.lockPointer();
    UI.toast("行动开始：" + MAPS[0].name, 2500);
  },

  /* ---------- 交互 ---------- */
  nearestContainer() {
    let best = null, bestD = 2.6;
    const eye = new THREE.Vector3(Player.pos.x, Player.eyeY(), Player.pos.z);
    for (const c of World.containers) {
      if (c.searched && c.loot && c.loot.length === 0) continue;
      const dx = c.x - Player.pos.x, dz = c.z - Player.pos.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < bestD) {
        const cpos = new THREE.Vector3(c.x, c.y + 0.2, c.z);
        if (World.hasLOS(eye, cpos) || d < 1.6) { best = c; bestD = d; }
      }
    }
    return best;
  },

  tryInteract() {
    if (Inventory.open || this.searching) return;
    const c = this.nearestContainer();
    if (!c) return;
    if (c.searched) {
      document.exitPointerLock();
      document.getElementById("inv-title").firstChild.textContent = "搜索 ";
      Inventory.show(c);
    } else {
      this.searching = c;
      this.searchTimer = c.searchTime;
      AudioSys.lootOpen();
    }
  },

  updateInteraction(dt) {
    /* 搜索进行中 */
    if (this.searching) {
      const c = this.searching;
      const dx = c.x - Player.pos.x, dz = c.z - Player.pos.z;
      if (Math.sqrt(dx * dx + dz * dz) > 3 || Player.moving) {
        this.searching = null;
        UI.hideProgress();
      } else {
        this.searchTimer -= dt;
        UI.showProgress("正在搜索 " + c.name, 1 - this.searchTimer / c.searchTime);
        if (this.searchTimer <= 0) {
          c.searched = true;
          Inventory.generateLoot(c);
          if (c.marker) c.marker.material = World.mat(0x565c62, "plates");
          this.searching = null;
          UI.hideProgress();
          document.exitPointerLock();
          document.getElementById("inv-title").firstChild.textContent = "搜索 ";
          Inventory.show(c);
        }
      }
      UI.showInteract(null);
      return;
    }
    if (Player.usingMed) { UI.showInteract(null); return; }
    const c = this.nearestContainer();
    if (c) {
      UI.showInteract(`<b>[F]</b> ${c.searched ? "查看" : "搜索"} ${c.name}`);
    } else UI.showInteract(null);
  },

  /* ---------- 撤离 ---------- */
  updateExtraction(dt) {
    let inZone = null;
    for (const e of World.extracts) {
      const dx = Player.pos.x - e.x, dz = Player.pos.z - e.z;
      if (dx * dx + dz * dz < e.r * e.r && Player.pos.y < 25) { inZone = e; break; }
    }
    if (inZone) {
      if (this.activeExtract !== inZone) {
        this.activeExtract = inZone;
        this.extractTimer = 0;
      }
      this.extractTimer += dt;
      const remain = inZone.holdTime - this.extractTimer;
      UI.showExtractBanner(`正在撤离 · ${inZone.name} · ${remain.toFixed(1)}s`);
      if (Math.floor(this.extractTimer * 2) !== Math.floor((this.extractTimer - dt) * 2)) {
        AudioSys.beep(false);
      }
      if (remain <= 0) this.endRaid(true, "extract");
    } else {
      if (this.activeExtract) UI.showExtractBanner(null);
      this.activeExtract = null;
      this.extractTimer = 0;
    }
  },

  checkBossKilled(enemy) {
    if (enemy.tier === 2 && !this.bossKilled) {
      this.bossKilled = true;
      UI.toast("已击杀游荡者头目！搜刮他的遗物", 3000);
    }
  },

  onPlayerDeath() {
    if (this.state !== "raid") return;
    AudioSys.deathSting();
    this.endRaid(false, "death");
  },

  /* ---------- 结算 ---------- */
  endRaid(success, reason) {
    if (this.state !== "raid") return;
    this.state = "settle";
    document.exitPointerLock();
    AudioSys.stopAmbient();
    if (success) AudioSys.extractDone();

    const p = Profile.data;
    p.kills += Player.kills;
    let lootIds = [];
    if (success) {
      p.extracts++;
      /* 带出：胸挂+背包+安全箱 全部物品 + 装备与武器 */
      lootIds = Inventory.allCarried().map(i => i.id);
      Profile.returnLoot(lootIds);
      const gear = [];
      for (const w of Player.weapons) if (w) gear.push(w.defId);
      if (Player.armor && Player.armor.dur > 0) gear.push(Player.armor.defId);
      if (Player.helmet && Player.helmet.dur > 0) gear.push(Player.helmet.defId);
      if (Inventory.bagDef) gear.push(Inventory.bagDef.id);
      if (Inventory.rigDef) gear.push(Inventory.rigDef.id);
      /* 剩余弹药折算回弹药盒 */
      for (const [aid, n] of Object.entries(Player.reserve)) {
        const packs = Math.floor(n / AMMO_TYPES[aid].pack);
        for (let i = 0; i < packs; i++) gear.push("ammo_" + aid);
      }
      Profile.returnLoot(gear);
    } else {
      p.deaths += reason === "death" ? 1 : 0;
      /* 仅安全箱保留 */
      lootIds = Inventory.safe.map(i => i.id);
      Profile.returnLoot(lootIds);
    }
    Profile.save();

    UI.showHud(false);
    UI.showExtractBanner(null);
    UI.hideProgress();
    Inventory.hide();
    this.mapOpen = false;
    document.getElementById("map-overlay").classList.add("hidden");

    const result = {
      success, reason,
      time: this.raidTime,
      kills: Player.kills,
      loot: lootIds,
      extractName: this.activeExtract ? this.activeExtract.name : "",
      killer: "游荡者"
    };
    setTimeout(() => UI.showSettlement(result), success ? 400 : 1200);
  },

  /* ---------- 主循环 ---------- */
  loop(t) {
    requestAnimationFrame((tt) => this.loop(tt));
    const dt = Math.min(0.05, (t - this.lastFrame) / 1000 || 0.016);
    this.lastFrame = t;

    if (this.state === "raid") {
      this.raidTime += dt;
      const remain = this.raidLimit - this.raidTime;
      if (remain <= 0) { this.endRaid(false, "timeout"); return; }

      const frozen = Inventory.open || this.mapOpen;
      if (!frozen) {
        Player.update(dt, this.input);
        this.input.jump = false;
      } else {
        Player.updateCamera(dt);
      }
      AI.update(dt);
      World.update(dt);

      UI.updateTimerHud(remain);
      UI.updateCrosshair(dt);
      UI.updateDamageNumbers(dt);
      UI.updateAbilityHud();
      UI.drawCompass();
      if (!frozen) this.updateInteraction(dt);
      this.updateExtraction(dt);
      if (this.mapOpen) UI.drawMap();
    }

    if (World.renderer && World.scene && World.camera) {
      World.syncSize();
      World.renderer.render(World.scene, World.camera);
    }
  }
};

window.addEventListener("DOMContentLoaded", () => {
  if (typeof THREE === "undefined") {
    document.body.innerHTML = '<div style="color:#fff;padding:40px;font-size:18px">three.js 加载失败：请确认 lib/three.min.js 存在。</div>';
    return;
  }
  App.init();
});
