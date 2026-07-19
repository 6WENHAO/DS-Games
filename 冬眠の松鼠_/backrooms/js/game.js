/* ============================================================
   game.js — Backrooms main engine
   Rendering, controls, levels, player systems, sanity,
   lighting, items, entities, HUD & menus.
   ============================================================ */
(function () {
  const BR = window.BR;
  const T = BR.Textures;

  // ---- tunables ----
  const EYE = 1.7, CROUCH_EYE = 1.05, PLAYER_R = 0.35;
  const WALL_H = 3.2;
  const WALK = 3.3, RUN = 5.9, CROUCH_SPEED = 1.7;
  const ACCEL = 13, FRICTION = 11;
  const STAMINA_MAX = 100, STAM_DRAIN = 20, STAM_REGEN = 13;
  const BATT_MAX = 100, BATT_DRAIN = 1.5;
  const SAN_MAX = 100;

  // ---- level definitions ----
  const LEVELS = [
    {
      name: 'LEVEL 0 — "大堂 The Lobby"', palette: "yellow",
      cols: 22, rows: 22, ambient: 0.34,
      fog: 0x18160a, fogNear: 3, fogFar: 33, lightColor: 0xfff4c0, lightInt: 1.5,
      hunters: 1, hunterSpeed: 2.4, smilers: 2, waters: 7, batteries: 3,
      deadLamp: 0.14, drain: 1.0,
      intro: "无尽发黄的房间。潮湿地毯的恶臭。荧光灯永不停歇地嗡鸣。",
    },
    {
      name: 'LEVEL 1 — "机房 Habitable Zone"', palette: "concrete",
      cols: 24, rows: 24, ambient: 0.16,
      fog: 0x0a0a0c, fogNear: 2, fogFar: 24, lightColor: 0xcfe0ff, lightInt: 1.3,
      hunters: 2, hunterSpeed: 2.9, smilers: 1, waters: 6, batteries: 4,
      deadLamp: 0.3, drain: 1.4,
      intro: "巨大的混凝土仓库。管道在头顶延伸。这里的东西更多，也更近。",
    },
    {
      name: 'LEVEL 2 — "会跑吗？ Run For Your Life"', palette: "dark",
      cols: 26, rows: 26, ambient: 0.05,
      fog: 0x050505, fogNear: 1, fogFar: 17, lightColor: 0xffd0a0, lightInt: 1.1,
      hunters: 3, hunterSpeed: 3.6, smilers: 0, waters: 4, batteries: 4,
      deadLamp: 0.5, drain: 2.0,
      intro: "灯几乎全灭了。你能听见它们在奔跑。别回头，快找到出口。",
    },
  ];

  class BackroomsGame {
    constructor() {
      this.state = "menu";
      this.sens = 1;
      this.fov = 75;
      this.quality = "med";
      this.audio = new BR.AudioEngine();

      this._tmp = new THREE.Vector3();
      this._dir = new THREE.Vector3();

      this.keys = {};
      this.yaw = 0; this.pitch = 0;
      this._entityThreat = 0;

      this.player = {
        x: 0, z: 0, vx: 0, vz: 0,
        sprinting: false, stamina: STAMINA_MAX,
        sanity: SAN_MAX, battery: BATT_MAX,
        water: 0, batt: 0,
        bob: 0, exhausted: false,
      };

      this._initThree();
      this._initDOM();
      this._bindInput();
      this._loop = this._loop.bind(this);
      this.clock = new THREE.Clock();
      requestAnimationFrame(this._loop);
    }

    // ---------------------------------------------------- THREE setup
    _initThree() {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.renderer.outputEncoding = THREE.sRGBEncoding;
      document.getElementById("app").prepend(this.renderer.domElement);

      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(this.fov, window.innerWidth / window.innerHeight, 0.05, 200);
      this.scene.add(this.camera);

      this.hemi = new THREE.HemisphereLight(0xffffff, 0x444422, 0.34);
      this.scene.add(this.hemi);

      // flashlight
      this.flash = new THREE.SpotLight(0xfff0d0, 0, 24, 0.5, 0.45, 1.2);
      this.flash.position.set(0, 0, 0.1);
      this.flashTarget = new THREE.Object3D();
      this.flashTarget.position.set(0, -0.05, -1);
      this.camera.add(this.flash);
      this.camera.add(this.flashTarget);
      this.flash.target = this.flashTarget;
      // faint self-illumination so immediate area isn't pure black
      this.selfLight = new THREE.PointLight(0xfff2cc, 0.25, 6, 2);
      this.camera.add(this.selfLight);
      this.flashlightOn = false;

      // dynamic ceiling-light pool
      this.lightPool = [];
      for (let i = 0; i < 12; i++) {
        const pl = new THREE.PointLight(0xfff4c0, 0, 12, 1.6);
        pl.visible = false;
        this.scene.add(pl);
        this.lightPool.push(pl);
      }

      this.levelGroup = new THREE.Group();
      this.scene.add(this.levelGroup);

      window.addEventListener("resize", () => {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
      });
    }

    // ---------------------------------------------------- DOM/menu wiring
    _initDOM() {
      const $ = (id) => document.getElementById(id);
      this.el = {
        hud: $("hud"), menu: $("menu"), pause: $("pause"), death: $("death"),
        transition: $("transition"), loading: $("loading"), clickHint: $("click-hint"),
        levelName: $("level-name"), objective: $("objective"),
        sanity: $("sanity-fill"), stamina: $("stamina-fill"), battery: $("battery-fill"),
        invWater: $("inv-water"), invBattery: $("inv-battery"),
        prompt: $("prompt"), subtitle: $("subtitle"), log: $("log"),
        vignette: $("vignette"), staticO: $("static-overlay"), damage: $("damage-flash"),
        deathReason: $("death-reason"), deathStats: $("death-stats"),
        transText: $("trans-text"), compassStrip: $("compass-strip"),
      };

      $("btn-start").onclick = () => this.startGame();
      $("btn-howto").onclick = () => this._togglePanel("howto");
      $("btn-settings").onclick = () => this._togglePanel("settings");
      $("btn-resume").onclick = () => this.resume();
      $("btn-quit").onclick = () => this.toMenu();
      $("btn-retry").onclick = () => this.startGame();
      $("btn-death-menu").onclick = () => this.toMenu();

      $("set-sens").oninput = (e) => (this.sens = parseFloat(e.target.value));
      $("set-vol").oninput = (e) => this.audio.setVolume(parseFloat(e.target.value));
      $("set-quality").onchange = (e) => this._setQuality(e.target.value);
      $("set-fov").oninput = (e) => { this.fov = parseInt(e.target.value); this.camera.fov = this.fov; this.camera.updateProjectionMatrix(); };

      this._buildCompass();
    }

    _togglePanel(id) {
      const p = document.getElementById(id);
      const other = document.getElementById(id === "howto" ? "settings" : "howto");
      other.classList.add("hidden");
      p.classList.toggle("hidden");
    }

    _setQuality(q) {
      this.quality = q;
      const pr = q === "high" ? Math.min(window.devicePixelRatio, 2) : q === "med" ? 1.25 : 0.85;
      this.renderer.setPixelRatio(pr);
    }

    _buildCompass() {
      let html = "";
      const labels = { 0: "N", 45: "NE", 90: "E", 135: "SE", 180: "S", 225: "SW", 270: "W", 315: "NW" };
      for (let d = 0; d <= 720; d += 15) {
        const dd = d % 360;
        const lab = labels[dd] || "·";
        html += `<span class="compass-tick" style="width:20px">${lab}</span>`;
      }
      html += `<span id="compass-goal" class="compass-tick compass-goal" style="position:absolute;top:0">◆</span>`;
      this.el.compassStrip.innerHTML = html;
      this.pxPerDeg = 20 / 15;
    }

    // ---------------------------------------------------- input
    _bindInput() {
      const canvas = this.renderer.domElement;
      canvas.addEventListener("click", () => {
        if (this.state === "playing" && document.pointerLockElement !== canvas) canvas.requestPointerLock();
      });

      document.addEventListener("pointerlockchange", () => {
        const locked = document.pointerLockElement === canvas;
        this.el.clickHint.classList.toggle("hidden", locked || this.state !== "playing");
        if (!locked && this.state === "playing") this.pause();
      });

      document.addEventListener("mousemove", (e) => {
        if (document.pointerLockElement !== canvas || this.state !== "playing") return;
        this.yaw -= e.movementX * 0.0022 * this.sens;
        this.pitch -= e.movementY * 0.0022 * this.sens;
        const lim = Math.PI / 2 - 0.05;
        this.pitch = Math.max(-lim, Math.min(lim, this.pitch));
      });

      document.addEventListener("keydown", (e) => {
        const k = e.key.toLowerCase();
        this.keys[k] = true;
        if (k === "escape") { if (this.state === "playing") this.pause(); else if (this.state === "paused") this.resume(); }
        if (this.state !== "playing") return;
        if (k === "f") this.toggleFlashlight();
        if (k === "q") this.drinkWater();
        if (k === "e") this.interact();
        if (k === "c") this.pingObjective();
      });
      document.addEventListener("keyup", (e) => { this.keys[e.key.toLowerCase()] = false; });
    }

    // ---------------------------------------------------- game flow
    startGame() {
      this.audio.init(); this.audio.resume();
      this.el.menu.classList.add("hidden");
      this.el.death.classList.add("hidden");
      this.el.pause.classList.add("hidden");
      this.el.hud.classList.remove("hidden");
      this.stats = { start: performance.now(), waterDrunk: 0, level: 0 };
      this.player.sanity = SAN_MAX; this.player.stamina = STAMINA_MAX;
      this.player.battery = BATT_MAX; this.player.water = 0; this.player.batt = 0;
      this.buildLevel(0);
      this.state = "playing";
      this._lockPointer();
    }

    toMenu() {
      this.state = "menu";
      if (document.pointerLockElement) document.exitPointerLock();
      this.el.hud.classList.add("hidden");
      this.el.pause.classList.add("hidden");
      this.el.death.classList.add("hidden");
      this.el.menu.classList.remove("hidden");
      this.audio.setHeartRate(0); this.audio.setTension(0);
    }

    pause() {
      if (this.state !== "playing") return;
      this.state = "paused";
      if (document.pointerLockElement) document.exitPointerLock();
      this.el.pause.classList.remove("hidden");
      this.el.clickHint.classList.add("hidden");
    }
    resume() {
      if (this.state !== "paused") return;
      this.state = "playing";
      this.el.pause.classList.add("hidden");
      this.audio.resume();
      this._lockPointer();
    }

    _lockPointer() {
      try {
        const r = this.renderer.domElement.requestPointerLock();
        if (r && r.catch) r.catch(() => {});
      } catch (e) {}
    }

    // ---------------------------------------------------- level building
    _clearLevel() {
      const g = this.levelGroup;
      while (g.children.length) {
        const c = g.children.pop();
        c.traverse && c.traverse(o => {
          if (o.geometry) o.geometry.dispose();
          if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (m.map) m.map.dispose(); m.dispose && m.dispose(); }); }
        });
      }
      this.lightPool.forEach(l => { l.visible = false; l.intensity = 0; });
      (this.entities || []).forEach(e => e.dispose && e.dispose());
      this.entities = [];
      this.items = [];
      this.lamps = [];
      this.lampGrid = new Map();
    }

    _paletteMaterials(cfg) {
      let wallTex, floorTex, ceilTex;
      if (cfg.palette === "yellow") { wallTex = T.wallpaper(); floorTex = T.carpet(); ceilTex = T.ceiling(); }
      else if (cfg.palette === "concrete") { wallTex = T.concrete(); floorTex = T.concrete(); ceilTex = T.concrete(); }
      else { wallTex = T.concrete(); floorTex = T.carpet(); ceilTex = T.concrete(); }
      [wallTex, floorTex, ceilTex].forEach(t => { t.encoding = THREE.sRGBEncoding; });
      return { wallTex, floorTex, ceilTex };
    }

    buildLevel(index) {
      this._clearLevel();
      const cfg = LEVELS[index];
      this.levelIndex = index;
      this.cfg = cfg;

      this.scene.fog = new THREE.Fog(cfg.fog, cfg.fogNear, cfg.fogFar);
      this.scene.background = new THREE.Color(cfg.fog);
      this.hemi.intensity = cfg.ambient;
      this.lightPool.forEach(l => l.color.setHex(cfg.lightColor));

      const maze = BR.generateMaze(cfg.cols, cfg.rows, { cellSize: 7, wallThickness: 0.4, openness: cfg.palette === "dark" ? 0.28 : 0.34 });
      this.maze = maze;
      const C = maze.C;
      const { wallTex, floorTex, ceilTex } = this._paletteMaterials(cfg);

      const sizeX = cfg.cols * C, sizeZ = cfg.rows * C;
      const cx = (cfg.cols - 1) * C / 2, cz = (cfg.rows - 1) * C / 2;

      // floor
      floorTex.repeat.set(sizeX / 3.5, sizeZ / 3.5);
      const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 1 });
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(sizeX, sizeZ), floorMat);
      floor.rotation.x = -Math.PI / 2; floor.position.set(cx, 0, cz);
      this.levelGroup.add(floor);

      // ceiling
      ceilTex.repeat.set(sizeX / 3.5, sizeZ / 3.5);
      const ceilMat = new THREE.MeshStandardMaterial({ map: ceilTex, roughness: 1 });
      const ceil = new THREE.Mesh(new THREE.PlaneGeometry(sizeX, sizeZ), ceilMat);
      ceil.rotation.x = Math.PI / 2; ceil.position.set(cx, WALL_H, cz);
      this.levelGroup.add(ceil);

      // merged walls
      const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 1 });
      const geos = [];
      for (const w of maze.walls) {
        const gw = Math.max(w.maxX - w.minX, 0.02), gd = Math.max(w.maxZ - w.minZ, 0.02);
        const h = w.pillar ? WALL_H : WALL_H;
        const g = new THREE.BoxGeometry(gw, h, gd);
        g.translate((w.minX + w.maxX) / 2, h / 2, (w.minZ + w.maxZ) / 2);
        this._worldUV(g, 2.6);
        geos.push(g);
      }
      if (geos.length) {
        const merged = THREE.BufferGeometryUtils.mergeBufferGeometries(geos, false);
        geos.forEach(g => g.dispose());
        const wallMesh = new THREE.Mesh(merged, wallMat);
        this.levelGroup.add(wallMesh);
      }

      // lamps (emissive panels) — every other cell. Each gets its own
      // material clone so flicker is per-lamp (shared map is fine).
      const lampMap = T.lightPanel();
      const deadMat = new THREE.MeshBasicMaterial({ color: 0x2a2a26, fog: true });
      const lampGeo = new THREE.PlaneGeometry(2.4, 2.4);
      for (let i = 0; i < cfg.cols; i++)
        for (let j = 0; j < cfg.rows; j++) {
          if ((i + j) % 2 !== 0) continue;
          const dead = Math.random() < cfg.deadLamp;
          const p = maze.cellToWorld(i, j);
          const mat = dead ? deadMat : new THREE.MeshBasicMaterial({ map: lampMap, fog: true });
          const panel = new THREE.Mesh(lampGeo, mat);
          panel.rotation.x = Math.PI / 2;
          panel.position.set(p.x, WALL_H - 0.02, p.z);
          this.levelGroup.add(panel);
          const lamp = { x: p.x, z: p.z, on: !dead, dead, flickerCd: 3 + Math.random() * 8, panel, i, j };
          this.lamps.push(lamp);
          this.lampGrid.set(maze.keyOf(i, j), lamp);
        }

      // player spawn
      const sp = maze.cellToWorld(1, 1);
      this.player.x = sp.x; this.player.z = sp.z;
      this.player.vx = this.player.vz = 0;
      this.yaw = 0; this.pitch = 0;

      // exit portal
      const exitCell = maze.randomCellFar(1, 1, Math.floor((cfg.cols + cfg.rows) * 0.5));
      const ep = maze.cellToWorld(exitCell[0], exitCell[1]);
      this.exit = { x: ep.x, z: ep.z, i: exitCell[0], j: exitCell[1] };
      this._buildExit(ep);

      // items
      this._spawnItems(cfg, maze, exitCell);

      // entities (spawn far from player)
      for (let n = 0; n < cfg.smilers; n++) {
        const c = maze.randomCellFar(1, 1, 8);
        this.entities.push(new BR.Smiler(this.scene, maze, { i: c[0], j: c[1] }, T.smilerFace()));
      }
      for (let n = 0; n < cfg.hunters; n++) {
        const c = maze.randomCellFar(1, 1, Math.floor(cfg.cols * 0.6));
        this.entities.push(new BR.Hunter(this.scene, maze, { i: c[0], j: c[1] }, {
          speed: cfg.hunterSpeed, chaseSpeed: cfg.hunterSpeed + 1.9,
        }));
      }

      // HUD
      this.el.levelName.textContent = cfg.name;
      this.el.objective.textContent = "目标：找到闪烁的出口降入更深层级 · 收集杏仁水维持理智";
      this.showSubtitle(cfg.intro, 6000);
      this.log("进入 " + cfg.name);
    }

    _worldUV(geo, tile) {
      const pos = geo.attributes.position, nor = geo.attributes.normal;
      const uv = new Float32Array(pos.count * 2);
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i)), nz = Math.abs(nor.getZ(i));
        let u, v;
        if (ny > nx && ny > nz) { u = x / tile; v = z / tile; }
        else if (nx >= nz) { u = z / tile; v = y / tile; }
        else { u = x / tile; v = y / tile; }
        uv[i * 2] = u; uv[i * 2 + 1] = v;
      }
      geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    }

    _buildExit(p) {
      const g = new THREE.Group();
      const disc = new THREE.Mesh(
        new THREE.CircleGeometry(1.5, 32),
        new THREE.MeshBasicMaterial({ color: 0x000000, fog: false })
      );
      disc.rotation.x = -Math.PI / 2; disc.position.y = 0.02;
      g.add(disc);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(1.5, 0.12, 12, 40),
        new THREE.MeshBasicMaterial({ color: 0x66e0ff, fog: false })
      );
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05;
      g.add(ring);
      // a beam of light so it's visible in fog
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(1.3, 0.2, WALL_H, 16, 1, true),
        new THREE.MeshBasicMaterial({ color: 0x2299cc, transparent: true, opacity: 0.12, side: THREE.DoubleSide, fog: false, depthWrite: false })
      );
      beam.position.y = WALL_H / 2;
      g.add(beam);
      g.position.set(p.x, 0, p.z);
      this.levelGroup.add(g);
      this.exitMesh = g; this.exitRing = ring; this.exitBeam = beam;
    }

    _spawnItems(cfg, maze, exitCell) {
      const used = new Set([maze.keyOf(1, 1), maze.keyOf(exitCell[0], exitCell[1])]);
      const place = (type) => {
        for (let t = 0; t < 40; t++) {
          const i = 1 + ((Math.random() * (cfg.cols - 2)) | 0);
          const j = 1 + ((Math.random() * (cfg.rows - 2)) | 0);
          const k = maze.keyOf(i, j);
          if (used.has(k)) continue;
          used.add(k);
          const p = maze.cellToWorld(i, j);
          this._makeItem(type, p.x, p.z);
          return;
        }
      };
      for (let n = 0; n < cfg.waters; n++) place("water");
      for (let n = 0; n < cfg.batteries; n++) place("battery");
    }

    _makeItem(type, x, z) {
      const g = new THREE.Group();
      let mesh, glowTex;
      if (type === "water") {
        mesh = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.42, 0.28),
          new THREE.MeshStandardMaterial({ color: 0xeef2ff, emissive: 0x334455, emissiveIntensity: 0.5, roughness: 0.6 }));
        glowTex = T.glow("rgba(220,240,255,0.9)", "rgba(120,180,255,0.3)");
      } else {
        mesh = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.16, 0.18),
          new THREE.MeshStandardMaterial({ color: 0x3a7a3a, emissive: 0x225522, emissiveIntensity: 0.6, roughness: 0.5 }));
        glowTex = T.glow("rgba(200,255,200,0.9)", "rgba(90,220,90,0.3)");
      }
      mesh.position.y = 0.5; g.add(mesh);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.75,
      }));
      glow.scale.set(1.4, 1.4, 1); glow.position.y = 0.55; g.add(glow);
      g.position.set(x, 0, z);
      this.levelGroup.add(g);
      this.items.push({ type, x, z, group: g, mesh, taken: false });
    }

    // ---------------------------------------------------- interactions
    toggleFlashlight() {
      if (this.player.battery <= 0) { this.log("手电筒没电了"); return; }
      this.flashlightOn = !this.flashlightOn;
      this.flash.intensity = this.flashlightOn ? 2.0 : 0;
      this.audio.flicker();
    }

    drinkWater() {
      if (this.player.water <= 0) { this.log("没有杏仁水"); return; }
      this.player.water--;
      this.player.sanity = Math.min(SAN_MAX, this.player.sanity + 45);
      this.stats.waterDrunk++;
      this.audio.drink();
      this.showSubtitle("你喝下了杏仁水。理智回归了一些…… (味道正确)", 3000);
    }

    interact() {
      // pick up nearest item
      let best = null, bd = 2.0;
      for (const it of this.items) {
        if (it.taken) continue;
        const d = Math.hypot(it.x - this.player.x, it.z - this.player.z);
        if (d < bd) { bd = d; best = it; }
      }
      if (best) {
        best.taken = true; best.group.visible = false;
        if (best.type === "water") { this.player.water++; this.log("拾取：杏仁水 🥛"); }
        else { this.player.batt++; this.log("拾取：电池 🔋"); }
        this.audio.pickup();
        return;
      }
      // exit?
      const de = Math.hypot(this.exit.x - this.player.x, this.exit.z - this.player.z);
      if (de < 2.2) this.descend();
    }

    pingObjective() {
      const dx = this.exit.x - this.player.x, dz = this.exit.z - this.player.z;
      const dist = Math.hypot(dx, dz);
      const dir = this._dirWord(dx, dz);
      this.showSubtitle(`出口方位：${dir} · 约 ${Math.round(dist)} 米`, 3500);
      // also reveal nearest water direction
    }

    _dirWord(dx, dz) {
      const a = (Math.atan2(dx, -dz) * 180 / Math.PI + 360) % 360;
      const words = ["正北", "东北", "正东", "东南", "正南", "西南", "正西", "西北"];
      return words[Math.round(a / 45) % 8];
    }

    // battery use for battery item
    _useBatteryItem() {
      if (this.player.batt > 0 && this.player.battery < BATT_MAX - 5) {
        this.player.batt--;
        this.player.battery = Math.min(BATT_MAX, this.player.battery + 60);
        this.log("更换电池，电量恢复");
        this.audio.pickup();
      }
    }

    descend() {
      if (this.state !== "playing") return;
      this.state = "transition";
      if (document.pointerLockElement) document.exitPointerLock();
      this.audio.noclipWhoosh();
      this.flashlightOn = false; this.flash.intensity = 0;
      const next = this.levelIndex + 1;
      this.el.transition.classList.remove("hidden");
      this.el.transition.style.opacity = "0";
      requestAnimationFrame(() => { this.el.transition.style.opacity = "1"; });

      if (next >= LEVELS.length) {
        this.el.transText.innerHTML = "你坠入无尽的黑暗……<br>然后，一扇门。你逃出了后室。<br><br>——也许。";
        setTimeout(() => this.win(), 3500);
        return;
      }
      this.el.transText.textContent = "正在坠入更深的层级……";
      setTimeout(() => {
        this.buildLevel(next);
        this.stats.level = next;
        this.el.transition.style.opacity = "0";
        setTimeout(() => {
          this.el.transition.classList.add("hidden");
          this.state = "playing";
          this._lockPointer();
        }, 900);
      }, 1600);
    }

    noclip(reason) {
      if (this.state !== "playing") return;
      this.log("⟪ no-clip：你穿过了墙壁 ⟫");
      this.descend();
    }

    // ---------------------------------------------------- sanity / threat / death
    damageSanity(amount) {
      this.player.sanity = Math.max(0, this.player.sanity - amount);
      if (amount > 3) this._flashDamage(Math.min(0.5, amount / 40));
    }
    threatFromEntity(v) { this._entityThreat = Math.max(this._entityThreat, v); }

    _flashDamage(a) {
      this.el.damage.style.opacity = String(a);
      clearTimeout(this._dmgT);
      this._dmgT = setTimeout(() => (this.el.damage.style.opacity = "0"), 180);
    }

    onCaught(entity) {
      if (this.state !== "playing") return;
      this.die("你被 " + (entity.type === "hunter" ? "追猎者" : "实体") + " 抓住了。它把你拖入了黑暗。");
    }

    die(reason) {
      this.state = "dead";
      if (document.pointerLockElement) document.exitPointerLock();
      this.audio.screech();
      this.audio.setHeartRate(0); this.audio.setTension(0);
      const secs = ((performance.now() - this.stats.start) / 1000) | 0;
      this.el.deathReason.textContent = reason;
      this.el.deathStats.innerHTML =
        `生存时间：${Math.floor(secs / 60)}分${secs % 60}秒　·　抵达层级：Level ${this.levelIndex}<br>饮用杏仁水：${this.stats.waterDrunk} 罐`;
      this.el.death.classList.remove("hidden");
    }

    win() {
      this.state = "win";
      const secs = ((performance.now() - this.stats.start) / 1000) | 0;
      this.el.transText.innerHTML =
        `<span style="color:#8fe08f">你逃出去了。</span><br><br>` +
        `生存 ${Math.floor(secs / 60)}分${secs % 60}秒　·　穿越 ${LEVELS.length} 个层级<br>` +
        `饮用杏仁水 ${this.stats.waterDrunk} 罐<br><br>` +
        `<span style="font-size:14px;color:#8a8050">刷新页面重新进入后室</span>`;
    }

    // ---------------------------------------------------- helpers used by entities
    lightLevelAt(x, z) {
      let L = this.cfg.ambient * 0.7;
      const mi = Math.round(x / this.maze.C), mj = Math.round(z / this.maze.C);
      const R = this.maze.C * 1.7;
      for (let di = -2; di <= 2; di++)
        for (let dj = -2; dj <= 2; dj++) {
          const lamp = this.lampGrid.get(this.maze.keyOf(mi + di, mj + dj));
          if (!lamp || !lamp.on) continue;
          const d = Math.hypot(lamp.x - x, lamp.z - z);
          if (d < R) L += (1 - d / R) * 0.8;
        }
      // flashlight contribution
      if (this.flashlightOn && this.player.battery > 0) {
        this._dir.set(0, 0, -1).applyEuler(this.camera.rotation); this._dir.y = 0; this._dir.normalize();
        const tx = x - this.player.x, tz = z - this.player.z;
        const dist = Math.hypot(tx, tz);
        if (dist < 22 && dist > 0.01) {
          const dot = (tx / dist) * this._dir.x + (tz / dist) * this._dir.z;
          if (dot > 0.7) L += (1 - dist / 22) * 0.9 * (dot - 0.7) / 0.3;
        }
      }
      return Math.min(1, L);
    }

    isInView(x, z) {
      this._dir.set(0, 0, -1).applyEuler(this.camera.rotation); this._dir.y = 0; this._dir.normalize();
      const tx = x - this.player.x, tz = z - this.player.z;
      const d = Math.hypot(tx, tz) || 1;
      const dot = (tx / d) * this._dir.x + (tz / d) * this._dir.z;
      return dot > 0.5;
    }

    log(msg) {
      const line = document.createElement("div");
      line.className = "log-line"; line.textContent = msg;
      this.el.log.appendChild(line);
      setTimeout(() => line.remove(), 5000);
      while (this.el.log.children.length > 5) this.el.log.removeChild(this.el.log.firstChild);
    }

    showSubtitle(text, dur) {
      this.el.subtitle.textContent = text;
      this.el.subtitle.style.opacity = "1";
      clearTimeout(this._subT);
      this._subT = setTimeout(() => (this.el.subtitle.style.opacity = "0"), dur || 3000);
    }

    // ---------------------------------------------------- update loop
    _loop() {
      requestAnimationFrame(this._loop);
      let dt = this.clock.getDelta();
      if (dt > 0.06) dt = 0.06;
      if (this.state === "playing") this._update(dt);
      this.audio.update(dt);
      this.renderer.render(this.scene, this.camera);
    }

    _update(dt) {
      this._entityThreat = 0;
      const p = this.player, k = this.keys;

      // show "click to continue" hint whenever pointer is unlocked mid-game
      const locked = document.pointerLockElement === this.renderer.domElement;
      this.el.clickHint.classList.toggle("hidden", locked);

      // ---- movement input ----
      this.crouching = !!(k["control"] || k["ctrl"]);
      let ix = 0, iz = 0;
      if (k["w"] || k["arrowup"]) iz -= 1;
      if (k["s"] || k["arrowdown"]) iz += 1;
      if (k["a"] || k["arrowleft"]) ix -= 1;
      if (k["d"] || k["arrowright"]) ix += 1;
      const moving = ix !== 0 || iz !== 0;
      const l = Math.hypot(ix, iz) || 1; ix /= l; iz /= l;

      // rotate input by yaw
      const sinY = Math.sin(this.yaw), cosY = Math.cos(this.yaw);
      const wx = ix * cosY + iz * sinY;
      const wz = -ix * sinY + iz * cosY;

      // sprint & stamina
      const wantSprint = (k["shift"]) && moving && !this.crouching && p.stamina > 1 && !p.exhausted;
      p.sprinting = wantSprint;
      let speed = this.crouching ? CROUCH_SPEED : wantSprint ? RUN : WALK;
      if (wantSprint) { p.stamina -= STAM_DRAIN * dt; if (p.stamina <= 0) { p.stamina = 0; p.exhausted = true; } }
      else { p.stamina = Math.min(STAMINA_MAX, p.stamina + STAM_REGEN * dt); if (p.exhausted && p.stamina > 25) p.exhausted = false; }

      // accel / friction
      const targetVx = wx * speed, targetVz = wz * speed;
      p.vx += (targetVx - p.vx) * Math.min(1, ACCEL * dt);
      p.vz += (targetVz - p.vz) * Math.min(1, ACCEL * dt);
      if (!moving) { p.vx -= p.vx * Math.min(1, FRICTION * dt); p.vz -= p.vz * Math.min(1, FRICTION * dt); }

      const oldx = p.x, oldz = p.z;
      p.x += p.vx * dt; p.z += p.vz * dt;
      const [nx, nz] = BR.resolveCollision(p.x, p.z, PLAYER_R, this.maze);

      // detect being blocked (for no-clip flavor)
      const blocked = Math.hypot(nx - p.x, nz - p.z) > 0.001;
      p.x = nx; p.z = nz;
      // recompute actual velocity for bob/footsteps
      const actualSpeed = Math.hypot(p.x - oldx, p.z - oldz) / dt;

      // ---- no-clip event when panicking against a wall ----
      if (blocked && moving && p.sanity < 26) {
        this._noclipMeter = (this._noclipMeter || 0) + dt;
        if (this._noclipMeter > 1.6 && Math.random() < dt * 0.6) { this._noclipMeter = 0; this.noclip(); return; }
      } else this._noclipMeter = 0;

      // ---- camera & head bob ----
      const eye = this.crouching ? CROUCH_EYE : EYE;
      this._eyeY = this._eyeY == null ? eye : this._eyeY + (eye - this._eyeY) * Math.min(1, dt * 10);
      if (actualSpeed > 0.3) {
        p.bob += dt * actualSpeed * 1.9;
      }
      const bobAmt = (this.crouching ? 0.02 : 0.045) * Math.min(1, actualSpeed / WALK);
      const bobY = Math.sin(p.bob * 2) * bobAmt;
      const bobX = Math.cos(p.bob) * bobAmt * 0.6;

      this.camera.position.set(p.x, this._eyeY + bobY, p.z);
      this.camera.rotation.order = "YXZ";
      // sanity-based view sway
      const sanFrac = 1 - p.sanity / SAN_MAX;
      const sway = sanFrac * 0.03 * Math.sin(performance.now() * 0.003);
      this.camera.rotation.y = this.yaw;
      this.camera.rotation.x = this.pitch + sway * 0.4;
      this.camera.rotation.z = bobX * 0.5 + sway;

      // slight FOV kick when sprinting
      const targetFov = this.fov + (p.sprinting ? 6 : 0) + sanFrac * 4 * Math.sin(performance.now() * 0.002);
      this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 6);
      this.camera.updateProjectionMatrix();

      // ---- footsteps ----
      if (actualSpeed > 0.4) {
        const stepPhase = Math.sin(p.bob * 2);
        if (this._lastStep === undefined) this._lastStep = 0;
        if (stepPhase < 0 && this._lastStep >= 0) this.audio.footstep(p.sprinting, this.crouching);
        this._lastStep = stepPhase;
      }

      // ---- flashlight battery ----
      if (this.flashlightOn) {
        p.battery -= BATT_DRAIN * dt;
        if (p.battery <= 0) { p.battery = 0; this.flashlightOn = false; this.flash.intensity = 0; this.log("手电筒耗尽电量"); }
      }
      // auto-use battery item when empty & held? use on pickup key already; here allow using stored battery when low via item? Keep manual: pressing E near nothing? We'll auto-consume when battery critically low.
      if (p.battery < 15 && p.batt > 0 && this.flashlightOn) this._useBatteryItem();

      // ---- lamps flicker ----
      this._updateLamps(dt);
      // ---- dynamic light pool follows nearest ON lamps ----
      this._updateLightPool();

      // ---- sanity from light/darkness ----
      const lit = this.lightLevelAt(p.x, p.z);
      const drain = this.cfg.drain;
      if (lit < 0.35) this.damageSanity((0.35 - lit) * 9 * drain * dt);
      else if (lit > 0.6 && this._entityThreat < 0.1) p.sanity = Math.min(SAN_MAX, p.sanity + 2.2 * dt);

      // ---- entities ----
      for (const e of this.entities) if (e.alive) e.update(dt, p, this);

      // ---- exit visuals & proximity ----
      if (this.exitRing) {
        this.exitRing.rotation.z += dt * 1.2;
        const pulse = 0.5 + 0.5 * Math.sin(performance.now() * 0.004);
        this.exitRing.material.color.setRGB(0.2 + pulse * 0.3, 0.7, 1);
        this.exitBeam.material.opacity = 0.08 + pulse * 0.06;
      }

      // ---- item glow bob ----
      for (const it of this.items) if (!it.taken) it.mesh.rotation.y += dt * 1.5, it.mesh.position.y = 0.5 + Math.sin(performance.now() * 0.003 + it.x) * 0.06;

      // ---- prompts ----
      this._updatePrompt();

      // ---- ambient dread events ----
      this._ambientEvents(dt);

      // ---- audio tension & heartbeat ----
      const dread = Math.max(this._entityThreat, sanFrac * 0.7);
      this.audio.setTension(dread);
      const bpm = (this._entityThreat > 0.05 || sanFrac > 0.4) ? 55 + this._entityThreat * 85 + sanFrac * 45 : 0;
      this.audio.setHeartRate(bpm);

      // ---- sanity death ----
      if (p.sanity <= 0) { this.die("你的理智彻底崩溃。后室成了你永远的家。"); return; }

      // ---- HUD ----
      this._updateHUD(sanFrac, dread);
      this._updateCompass();
    }

    _updateLamps(dt) {
      for (const lamp of this.lamps) {
        if (lamp.dead) continue;
        lamp.flickerCd -= dt;
        if (lamp.flickerCd <= 0) {
          lamp.on = !lamp.on;
          lamp.flickerCd = lamp.on ? 4 + Math.random() * 12 : 0.05 + Math.random() * 0.35;
          lamp.panel.material.color.setScalar(lamp.on ? 1 : 0.1);
          if (!lamp.on && Math.random() < 0.4 && this._nearLamp(lamp)) this.audio.flicker();
        }
      }
    }
    _nearLamp(lamp) { return Math.hypot(lamp.x - this.player.x, lamp.z - this.player.z) < 12; }

    _updateLightPool() {
      const px = this.player.x, pz = this.player.z;
      const near = [];
      const mi = Math.round(px / this.maze.C), mj = Math.round(pz / this.maze.C);
      for (let di = -3; di <= 3; di++)
        for (let dj = -3; dj <= 3; dj++) {
          const lamp = this.lampGrid.get(this.maze.keyOf(mi + di, mj + dj));
          if (lamp && lamp.on) { lamp._d = Math.hypot(lamp.x - px, lamp.z - pz); near.push(lamp); }
        }
      near.sort((a, b) => a._d - b._d);
      for (let i = 0; i < this.lightPool.length; i++) {
        const pl = this.lightPool[i], lamp = near[i];
        if (lamp) {
          pl.visible = true;
          pl.position.set(lamp.x, WALL_H - 0.3, lamp.z);
          pl.intensity = this.cfg.lightInt;
          pl.distance = this.maze.C * 2.2;
        } else { pl.visible = false; pl.intensity = 0; }
      }
    }

    _updatePrompt() {
      let text = null;
      let best = null, bd = 2.0;
      for (const it of this.items) {
        if (it.taken) continue;
        const d = Math.hypot(it.x - this.player.x, it.z - this.player.z);
        if (d < bd) { bd = d; best = it; }
      }
      if (best) text = `[E] 拾取 ${best.type === "water" ? "杏仁水 🥛" : "电池 🔋"}`;
      const de = Math.hypot(this.exit.x - this.player.x, this.exit.z - this.player.z);
      if (de < 2.2) text = "[E] 进入更深的层级 ▽";
      if (text) { this.el.prompt.classList.remove("hidden"); this.el.prompt.innerHTML = text.replace(/\[(.*?)\]/, "<b>[$1]</b>"); }
      else this.el.prompt.classList.add("hidden");
    }

    _ambientEvents(dt) {
      this._ambT = (this._ambT || 4) - dt;
      if (this._ambT > 0) return;
      this._ambT = 6 + Math.random() * 12;
      const sanFrac = 1 - this.player.sanity / SAN_MAX;
      if (Math.random() < 0.3 + sanFrac * 0.4) {
        if (sanFrac > 0.4 && Math.random() < 0.5) this.audio.whisper();
        else this.audio.footstep(false, true);
      }
    }

    _updateHUD(sanFrac, dread) {
      const p = this.player;
      this.el.sanity.style.width = (p.sanity / SAN_MAX * 100) + "%";
      this.el.stamina.style.width = (p.stamina / STAMINA_MAX * 100) + "%";
      this.el.battery.style.width = (p.battery / BATT_MAX * 100) + "%";
      this.el.invWater.textContent = p.water;
      this.el.invBattery.textContent = p.batt;
      // vignette
      const dark = 40 + sanFrac * 120 + dread * 60;
      const red = Math.floor(sanFrac * 40 + dread * 30);
      this.el.vignette.style.boxShadow = `inset 0 0 ${120 + dark}px ${20 + dark * 0.4}px rgba(${red},0,0,${0.7 + sanFrac * 0.25})`;
      // static
      this.el.staticO.style.opacity = String(Math.min(0.5, sanFrac * 0.5 + dread * 0.35));
    }

    _updateCompass() {
      this._dir.set(0, 0, -1).applyEuler(this.camera.rotation);
      let heading = (Math.atan2(this._dir.x, -this._dir.z) * 180 / Math.PI + 360) % 360;
      const half = 130;
      this.el.compassStrip.style.transform = `translateX(${half - heading * this.pxPerDeg}px)`;
      // goal marker
      const dx = this.exit.x - this.player.x, dz = this.exit.z - this.player.z;
      let bearing = (Math.atan2(dx, -dz) * 180 / Math.PI + 360) % 360;
      let rel = bearing - heading;
      while (rel > 180) rel -= 360; while (rel < -180) rel += 360;
      const goal = document.getElementById("compass-goal");
      if (goal) {
        if (Math.abs(rel) < 65) { goal.style.opacity = "1"; goal.style.left = (130 + rel * this.pxPerDeg - 10) + "px"; goal.style.transform = "none"; }
        else goal.style.opacity = "0.2", goal.style.left = (rel > 0 ? 250 : 10) + "px";
      }
    }
  }

  window.addEventListener("load", () => {
    if (!window.THREE) { alert("无法加载 Three.js（需要联网加载 CDN）。请检查网络连接后刷新。"); return; }
    window.__game = new BackroomsGame();
  });
})();
