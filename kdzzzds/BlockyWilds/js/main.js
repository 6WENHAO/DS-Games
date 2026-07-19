/* =========================================================
   main.js — 游戏主控：场景/循环/超新星/交互/结局
   ========================================================= */
(() => {
  const LOOP = 22 * 60; // 22 分钟循环
  const el = id => document.getElementById(id);

  const Game = {
    mode: 'menu', // menu | surface | space | ending
    creative: false,
    paused: false,
    loopTime: 0,
    loopCount: 1,
    novaT: -1, // 超新星演出进度秒
    knowledge: new Set(),
    flags: { talkedElder: false, elderApproved: false, talkedCurator: false, gotGear: false, gotCodes: false, launched: false, craftedPlanks: false, craftedPick: false, logsUsed: 0 },
    world: null,
    planetWorlds: new Map(),
    curPlanet: 'home',
    pointerWanted: false,
  };
  window.Game = Game;

  let renderer, camera, surfaceScene, spaceScene;
  let atlasTex, sunTex, starTex;
  let sunSprite, surfaceStars;
  let crackMesh, crackGeos = [], selMesh;
  let shipGroup = null, npcGroup = null, flameMeshes = [];
  let npcTextures = {};
  let lookedNPC = null;

  /* ============ 启动 ============ */
  async function boot() {
    el('menusky').innerHTML = Assets.ui.menuSky();
    el('logo').innerHTML = Assets.ui.logo();
    UI.initHUD();
    UI.initScope();

    renderer = new THREE.WebGLRenderer({ canvas: el('gl'), antialias: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    camera = new THREE.PerspectiveCamera(75, 1, 0.08, 20000);
    camera.rotation.order = 'YXZ';
    resize();
    window.addEventListener('resize', resize);

    await Assets.buildAtlas();
    atlasTex = new THREE.CanvasTexture(Assets.atlasCanvas);
    atlasTex.magFilter = THREE.NearestFilter;
    atlasTex.minFilter = THREE.NearestFilter;
    atlasTex.generateMipmaps = false;
    atlasTex.flipY = false;
    atlasTex.needsUpdate = true;

    sunTex = await makeTex(Assets.ui.sunTex(0), 128);
    starTex = await makeTex(Assets.ui.starDot, 16);
    Game.sunTex = sunTex; Game.starTex = starTex;

    for (const id of Object.keys(Assets.NPCS)) {
      npcTextures[id] = {
        face: await makeTex(Assets.pixToSVG(Assets.npcFacePix(id), 64), 64),
        cloth: await makeTex(Assets.pixToSVG(Assets.npcClothPix(id), 64), 64),
        hair: await makeTex(Assets.pixToSVG(Assets.makePix(Assets.NPCS[id].hair, 0.25, 5), 64), 64),
      };
    }

    bindMenu();
    bindInput();
    requestAnimationFrame(frame);
  }
  async function makeTex(svg, size) {
    const img = await Assets.svgToImage(svg);
    const c = document.createElement('canvas'); c.width = c.height = size;
    const ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0, size, size);
    const t = new THREE.CanvasTexture(c);
    t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
    return t;
  }
  function resize() {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  }

  /* ============ 菜单 ============ */
  function bindMenu() {
    el('btn-survival').onclick = () => { Audio2.init(); Audio2.SFX.click(); startGame(false); };
    el('btn-creative').onclick = () => { Audio2.init(); Audio2.SFX.click(); startGame(true); };
    el('btn-help').onclick = () => { Audio2.init(); Audio2.SFX.click(); el('help').classList.remove('hidden'); };
    el('btn-reset').onclick = () => {
      Audio2.init(); Audio2.SFX.click();
      localStorage.removeItem('bw_save');
      localStorage.removeItem('bw_done');
      Game.knowledge = new Set();
      Game.loopCount = 1;
      for (const k of Object.keys(Game.flags)) Game.flags[k] = (k === 'logsUsed' ? 0 : false);
      el('btn-reset').textContent = '已清除 ✓';
      setTimeout(() => { el('btn-reset').textContent = '清除存档进度'; }, 2000);
    };
    el('btn-help-back').onclick = () => { Audio2.SFX.click(); el('help').classList.add('hidden'); };
    el('btn-resume').onclick = () => { Audio2.SFX.click(); togglePause(false); };
    el('btn-pause-help').onclick = () => { Audio2.SFX.click(); el('help').classList.remove('hidden'); };
    el('btn-tomenu').onclick = () => { Audio2.SFX.click(); location.reload(); };
    el('btn-inv-close').onclick = () => UI.toggleInv(Game);
    el('btn-tr-close').onclick = () => UI.closeTablet();
    el('btn-log-close').onclick = () => UI.toggleLog(Game.knowledge);
    el('btn-end-menu').onclick = () => location.reload();
    el('dialog').onclick = () => UI.nextLine();
  }

  function loadSave() {
    try {
      const s = JSON.parse(localStorage.getItem('bw_save'));
      if (s) {
        Game.knowledge = new Set(s.knowledge || []);
        Object.assign(Game.flags, s.flags || {});
        Game.loopCount = s.loopCount || 1;
      }
    } catch (e) {}
  }
  function save() {
    if (Game.creative) return;
    localStorage.setItem('bw_save', JSON.stringify({
      knowledge: [...Game.knowledge], flags: Game.flags, loopCount: Game.loopCount,
    }));
  }

  function startGame(creative) {
    Game.creative = creative;
    Player.P.creative = creative;
    if (!creative) loadSave();
    UI.reset(creative);
    el('menu').classList.add('hidden');
    el('hud').classList.remove('hidden');
    Quests.reset();
    applyKnowledge();
    enterSurface('home', true);
    capturePointer();
    if (creative) { Player.P.flying = true; Player.P.hasSuit = true; Player.P.hasScope = true; Player.P.hasTranslator = true; Player.P.hasCodes = true; }
  }

  function applyKnowledge() {
    const K = Game.knowledge, P = Player.P, F = Game.flags;
    if (K.has('gear') || F.gotGear) {
      P.hasSuit = P.hasScope = P.hasTranslator = true;
      F.gotGear = true;
      UI.give('suit'); UI.give('scope'); UI.give('translator');
    }
    if (K.has('codes') || F.gotCodes) { P.hasCodes = true; F.gotCodes = true; UI.give('codes'); }
    if (F.craftedPick && !Game.creative) UI.give('pickaxe_wood');
  }

  /* ============ 星球表面 ============ */
  function getPlanetWorld(id) {
    if (!Game.planetWorlds.has(id)) {
      Game.planetWorlds.set(id, new World.PlanetWorld(World.PLANETS[id], atlasTex));
    }
    return Game.planetWorlds.get(id);
  }

  function enterSurface(planetId, first) {
    Game.curPlanet = planetId;
    const w = getPlanetWorld(planetId);
    Game.world = w;
    w.ensureAll();
    Player.setWorld(w);
    const sp = w.spawn || { x: 8, y: w.surfaceY(8, 8) + 2, z: 8 };
    Player.teleport(sp.x, sp.y, sp.z);
    Player.P.yaw = 2.4; Player.P.pitch = 0;

    surfaceScene = new THREE.Scene();
    surfaceScene.add(w.group);
    buildSky(w);
    buildShipOnSurface(w);
    buildNPCs(w);
    buildFlames(w);
    buildCrack(w);

    Game.mode = 'surface';
    el('shiphud').classList.add('hidden');
    UI.toggleScope(false);
    UI.planetTitle(w.def.name);
    Audio2.stopLoops();
    if (planetId === 'home') Audio2.playMusic('camp');
    else { Audio2.playMusic(null); Audio2.wind(true, 1); }
    if (first && !Game.creative && !Game.flags.gotCodes) {
      setTimeout(() => UI.subtitle('循环 #' + Game.loopCount + ' · 你在篝火旁醒来', 4000), 800);
    }
  }

  function buildSky(w) {
    surfaceScene.background = new THREE.Color(w.def.sky);
    // 星空
    const g = new THREE.BufferGeometry();
    const pts = [];
    for (let i = 0; i < 700; i++) {
      const t = Math.random() * Math.PI * 2, p = Math.acos(Math.random() * 2 - 1);
      pts.push(600 * Math.sin(p) * Math.cos(t), 600 * Math.cos(p), 600 * Math.sin(p) * Math.sin(t));
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const starO = w.def.id === 'home' ? 0.35 : 0.9;
    surfaceStars = new THREE.Points(g, new THREE.PointsMaterial({
      map: starTex, size: 5, transparent: true, opacity: starO, depthWrite: false, sizeAttenuation: true,
    }));
    surfaceStars.renderOrder = -2;
    surfaceScene.add(surfaceStars);
    // 方形太阳
    sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    sunSprite.scale.set(60, 60, 1);
    sunSprite.renderOrder = -1;
    surfaceScene.add(sunSprite);
  }

  function buildShipOnSurface(w) {
    shipGroup = Ship.buildSurfaceShip(w, atlasTex);
    surfaceScene.add(shipGroup);
  }

  function makeBoxGeoFull(wd, h, d, shadeMul) {
    const geo = new THREE.BoxGeometry(wd, h, d);
    const cols = [];
    const shades = [0.62, 0.62, 1.0, 0.5, 0.8, 0.8];
    for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) {
      const s = shades[f] * (shadeMul || 1);
      cols.push(s, s, s);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    return geo;
  }

  function buildNPCs(w) {
    npcGroup = new THREE.Group();
    surfaceScene.add(npcGroup);
    w.npcMeshes = [];
    for (const npc of w.npcs) {
      const t = npcTextures[npc.id];
      const matHair = World.makeCurvedMaterial(t.hair, w.uniforms, {});
      const matCloth = World.makeCurvedMaterial(t.cloth, w.uniforms, {});
      const matFace = World.makeCurvedMaterial(t.face, w.uniforms, {});
      const grp = new THREE.Group();
      const y = npc.y !== undefined ? npc.y : w.surfaceY(npc.x, npc.z) + 1;
      // 头
      const head = new THREE.Mesh(makeBoxGeoFull(0.55, 0.55, 0.55), matHair);
      head.position.set(0, 1.45, 0); head.frustumCulled = false; grp.add(head);
      const face = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.55), matFace);
      const fc = []; for (let i = 0; i < 4; i++) fc.push(1, 1, 1);
      face.geometry.setAttribute('color', new THREE.Float32BufferAttribute(fc, 3));
      face.position.set(0, 1.45, -0.281); face.rotation.y = Math.PI;
      face.frustumCulled = false; grp.add(face);
      // 身体 & 腿
      const body = new THREE.Mesh(makeBoxGeoFull(0.55, 0.7, 0.32), matCloth);
      body.position.set(0, 0.85, 0); body.frustumCulled = false; grp.add(body);
      const legs = new THREE.Mesh(makeBoxGeoFull(0.5, 0.5, 0.3, 0.55), matCloth);
      legs.position.set(0, 0.25, 0); legs.frustumCulled = false; grp.add(legs);
      const arms = new THREE.Mesh(makeBoxGeoFull(0.95, 0.55, 0.28, 0.8), matCloth);
      arms.position.set(0, 1.0, 0); arms.frustumCulled = false; grp.add(arms);
      grp.position.set(npc.x, y, npc.z);
      grp.rotation.y = npc.yaw || 0;
      npcGroup.add(grp);
      w.npcMeshes.push({ id: npc.id, x: npc.x, z: npc.z, y, grp });
    }
  }

  function makePlaneTile(tile) {
    const geo = new THREE.PlaneGeometry(1, 1);
    const [u0, v0, uw, vh] = Assets.tileUV(tile);
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i, u0 + uv.getX(i) * uw, v0 + (1 - uv.getY(i)) * vh);
    }
    const cols = []; for (let i = 0; i < uv.count; i++) cols.push(1.3, 1.3, 1.3);
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    return geo;
  }

  function buildFlames(w) {
    flameMeshes = [];
    const mat = World.makeCurvedMaterial(atlasTex, w.uniforms, { cutoff: 0.4 });
    mat.side = THREE.DoubleSide;
    for (const [key, sp] of w.specials) {
      if (sp.type !== 'campfire') continue;
      const [x, y, z] = key.split(',').map(Number);
      for (let r = 0; r < 2; r++) {
        const m = new THREE.Mesh(makePlaneTile('flame'), mat);
        m.position.set(x + 0.5, y + 1.45, z + 0.5);
        m.rotation.y = r * Math.PI / 2;
        m.frustumCulled = false;
        surfaceScene.add(m);
        flameMeshes.push(m);
      }
    }
  }

  function buildCrack(w) {
    crackGeos = [
      World.makeBoxGeo(1.01, 1.01, 1.01, 'crack1'),
      World.makeBoxGeo(1.01, 1.01, 1.01, 'crack2'),
      World.makeBoxGeo(1.01, 1.01, 1.01, 'crack3'),
    ];
    const mat = World.makeCurvedMaterial(atlasTex, w.uniforms, { cutoff: 0.1, transparent: true });
    crackMesh = new THREE.Mesh(crackGeos[0], mat);
    crackMesh.visible = false; crackMesh.frustumCulled = false;
    surfaceScene.add(crackMesh);
    // 选中框（玻璃边框贴图）
    const smat = World.makeCurvedMaterial(atlasTex, w.uniforms, { cutoff: 0.3, alpha: 0.45, transparent: true, depthWrite: false });
    selMesh = new THREE.Mesh(World.makeBoxGeo(1.005, 1.005, 1.005, 'glass'), smat);
    selMesh.visible = false; selMesh.frustumCulled = false;
    surfaceScene.add(selMesh);
  }

  Game.setCrack = (hit, prog) => {
    if (!crackMesh) return;
    if (!hit || prog <= 0) { crackMesh.visible = false; return; }
    crackMesh.visible = true;
    crackMesh.geometry = crackGeos[Math.min(2, Math.floor(prog * 3))];
    crackMesh.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
  };

  /* ============ 太空 ============ */
  function enterSpace() {
    if (!spaceScene) spaceScene = Ship.buildScene(Game);
    const def = World.PLANETS[Game.curPlanet];
    Ship.launch(def, Game.loopTime);
    Game.mode = 'space';
    Player.P.oxygen = 100; Player.P.fuel = 100; // 飞船补给
    el('shiphud').classList.remove('hidden');
    UI.toggleScope(false);
    Audio2.stopLoops();
    Audio2.playMusic('space');
    Audio2.SFX.warp();
    if (!Game.flags.launched) { Game.flags.launched = true; Quests.completeStep(); save(); }
    UI.subtitle('已进入太空 · W 加速 / X 刹车 / 靠近星球按 E 着陆', 5000);
  }

  function landOnPlanet(def) {
    fadeDo(() => {
      Audio2.engine(false, 0);
      enterSurface(def.id);
      capturePointer();
    });
  }

  function fadeDo(fn) {
    const f = el('fade');
    f.style.opacity = 1;
    setTimeout(() => { fn(); setTimeout(() => { f.style.opacity = 0; }, 300); }, 700);
  }

  /* ============ 输入 ============ */
  function bindInput() {
    const canvas = el('gl');
    canvas.addEventListener('click', () => {
      if (Game.mode !== 'menu' && !uiOpen() && document.pointerLockElement !== canvas) capturePointer();
    });
    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement !== canvas && Game.pointerWanted && !uiOpen() && (Game.mode === 'surface' || Game.mode === 'space')) {
        togglePause(true);
      }
    });
    document.addEventListener('mousemove', e => {
      if (document.pointerLockElement !== canvas) return;
      if (Game.mode === 'surface') Player.onMouseMove(e.movementX, e.movementY);
      else if (Game.mode === 'space') Ship.onMouseMove(e.movementX, e.movementY);
    });
    document.addEventListener('mousedown', e => {
      if (document.pointerLockElement !== canvas || Game.mode !== 'surface') return;
      if (e.button === 0) Player.setMouse(0, true, Game);
      if (e.button === 2) {
        const item = UI.selectedItem();
        if (item === 'marshmallow_r' || item === 'marshmallow') eat(item);
        else Player.setMouse(2, true, Game);
      }
    });
    document.addEventListener('mouseup', e => {
      if (e.button === 0) Player.setMouse(0, false, Game);
      if (e.button === 2) Player.setMouse(2, false, Game);
    });
    document.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('wheel', e => {
      if (Game.mode !== 'surface' || uiOpen()) return;
      const cur = getSelected();
      UI.selectSlot((cur + (e.deltaY > 0 ? 1 : 8)) % 9);
    });

    document.addEventListener('keydown', e => {
      if (Game.mode === 'menu' || Game.mode === 'ending') return;
      if (e.code === 'Escape') { return; } // 浏览器自动解锁指针 → pause
      // 对话优先
      if (UI.dlgActive) {
        if (e.code === 'KeyE' || e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); UI.nextLine(); }
        return;
      }
      if (UI.translatorOpen) { if (e.code === 'KeyE') UI.closeTablet(); return; }
      if (UI.logOpen) { if (e.code === 'KeyL') UI.toggleLog(Game.knowledge); return; }
      if (UI.invOpen) { if (e.code === 'Tab' || e.code === 'KeyI' || e.code === 'KeyE') { e.preventDefault(); UI.toggleInv(Game); } return; }
      if (Game.paused) return;

      if (e.code === 'Tab' || e.code === 'KeyI') { e.preventDefault(); if (Game.mode === 'surface') UI.toggleInv(Game); return; }
      if (e.code === 'KeyL') { UI.toggleLog(Game.knowledge); return; }
      if (e.code === 'KeyQ' && Game.mode === 'surface' && (Player.P.hasScope || Game.creative)) { UI.toggleScope(!UI.scopeOn); return; }
      if (e.code === 'KeyE') { interact(); return; }
      if (e.code.startsWith('Digit')) {
        const n = +e.code.slice(5);
        if (n >= 1 && n <= 9) { UI.selectSlot(n - 1); Audio2.SFX.click(); }
        return;
      }
      Player.onKey(e, true);
    });
    document.addEventListener('keyup', e => Player.onKey(e, false));
  }

  function getSelected() {
    let s = 0;
    document.querySelectorAll('#hotbar .slot').forEach((sl, i) => { if (sl.classList.contains('sel')) s = i; });
    return s;
  }

  function eat(item) {
    if (item === 'marshmallow_r') {
      UI.take(item, 1);
      Player.P.hp = Math.min(Player.P.maxHp, Player.P.hp + 4);
      Audio2.SFX.pickup();
      UI.subtitle('烤棉花糖真好吃 · 生命恢复', 2000);
    } else {
      UI.take(item, 1);
      Player.P.hp = Math.min(Player.P.maxHp, Player.P.hp + 1);
      Audio2.SFX.pickup();
      UI.subtitle('生的也不是不能吃……（在篝火旁可以烤制）', 2500);
    }
  }

  function capturePointer() {
    Game.pointerWanted = true;
    try {
      const p = el('gl').requestPointerLock();
      if (p && p.catch) p.catch(() => {});
    } catch (e) {}
  }
  function releasePointer() {
    Game.pointerWanted = false;
    Player.setMouse(0, false, Game);
    document.exitPointerLock();
  }
  Game.capturePointer = capturePointer;
  Game.releasePointer = releasePointer;

  function togglePause(on) {
    Game.paused = on;
    el('pause').classList.toggle('hidden', !on);
    if (!on) capturePointer();
  }

  function uiOpen() {
    return UI.invOpen || UI.dlgActive || UI.translatorOpen || UI.logOpen || Game.paused || Game.mode === 'ending';
  }
  Game.uiOpen = uiOpen;

  /* ============ 互动 ============ */
  function interact() {
    if (Game.mode === 'space') {
      if (Ship.S.nearPlanet) landOnPlanet(Ship.S.nearPlanet);
      return;
    }
    if (Game.mode !== 'surface') return;
    const w = Game.world;
    // 1. NPC
    if (lookedNPC) { talkTo(lookedNPC); return; }
    // 2. 飞船
    const sp = w.shipPos;
    if (sp) {
      const dx = w.wrapD(sp.x + 0.5 - Player.P.x), dz = w.wrapD(sp.z + 0.5 - Player.P.z);
      if (Math.hypot(dx, dz) < 4 && Math.abs(sp.y - Player.P.y) < 4) {
        if (Player.P.hasCodes || Game.creative) enterSpace();
        else UI.hint('飞船已锁定 —— 需要发射密码（去天文台找霍恩）', 3000);
        return;
      }
    }
    // 3. 特殊方块
    const hit = Player.getRayHit();
    if (hit) {
      const spec = w.getSpecial(hit.x, hit.y, hit.z);
      const block = World.BLOCKS[hit.id];
      if (spec) { handleSpecial(spec, hit); return; }
      if (block.interact === 'table') { UI.toggleInv(Game); return; }
    }
  }

  function handleSpecial(spec, hit) {
    const F = Game.flags;
    if (spec.type === 'chest') {
      if (spec.opened) { UI.hint('箱子空了', 1500); return; }
      Audio2.SFX.open();
      if (spec.loot === 'museum_gear') {
        spec.opened = true;
        if (Player.P.hasSuit) { UI.subtitle('装备已经穿在身上了。', 2500); return; }
        Player.P.hasSuit = Player.P.hasScope = Player.P.hasTranslator = true;
        UI.give('suit'); UI.give('scope'); UI.give('translator');
        F.gotGear = true; Game.knowledge.add('gear');
        Quests.completeStep(); save();
        UI.subtitle('获得：宇航服 · 信号镜 · 翻译器 —— 空中按住空格喷气，Q 打开信号镜', 6000);
      } else if (spec.loot === 'museum_food') {
        spec.opened = true;
        UI.give('marshmallow', 3);
        UI.subtitle('获得：棉花糖 ×3（篝火旁可烤制）', 3500);
        Audio2.SFX.pickup();
      }
    } else if (spec.type === 'tablet') {
      if (!Player.P.hasTranslator && !Game.creative) { UI.hint('石板上刻着发光的古族文字……需要翻译器', 3000); return; }
      UI.showTablet(spec.tid, clue => {
        if (clue === 'eye') { beginEnding(); return; }
        if (!Game.knowledge.has(clue)) {
          Game.knowledge.add(clue);
          Quests.completeStep();
          if (['alpha', 'beta', 'gamma'].every(c => Game.knowledge.has(c)) && !Game.knowledge.has('eye_unlock')) {
            Game.knowledge.add('eye_unlock');
            setTimeout(() => { UI.subtitle('三段坐标合一 —— 深空之眼已出现在星图上！', 6000); Audio2.SFX.codes(); }, 1200);
          }
          save();
        }
      });
    } else if (spec.type === 'telescope') {
      Audio2.SFX.open();
      const red = Game.loopTime > LOOP - 240;
      UI.subtitle(red ? '太阳涨得吓人，表面翻涌着红色的浪…… 快没时间了。' : '透过望远镜：太阳比昨天大了一圈。它正在死去。', 4500);
    } else if (spec.type === 'campfire') {
      if (Game.creative) { UI.subtitle('篝火噼啪作响。', 2000); return; }
      if (Player.P.hasCodes) {
        UI.hint('冥想中……时间飞逝', 2200);
        Game.loopTime = Math.max(Game.loopTime, LOOP - 12);
      } else {
        UI.subtitle('篝火噼啪作响。棉花糖可以在这里烤。', 2500);
      }
    }
  }

  function talkTo(npcId) {
    const F = Game.flags, D = Quests.DIALOGS;
    releasePointer();
    if (npcId === 'elder') {
      if (!F.talkedElder) UI.talk('elder', D.elder_intro, () => { F.talkedElder = true; Quests.completeStep(); save(); capturePointer(); });
      else if (F.craftedPick && !F.elderApproved) UI.talk('elder', D.elder_after_pick, () => { F.elderApproved = true; Quests.completeStep(); save(); capturePointer(); });
      else UI.talk('elder', [D.elder_idle[Math.floor(Math.random() * D.elder_idle.length)]], capturePointer);
    } else if (npcId === 'curator') {
      if (!F.talkedCurator) UI.talk('curator', D.curator_intro, () => { F.talkedCurator = true; Quests.completeStep(); save(); capturePointer(); });
      else UI.talk('curator', [D.curator_idle[Math.floor(Math.random() * D.curator_idle.length)]], capturePointer);
    } else if (npcId === 'astronomer') {
      if (!F.gotGear) UI.talk('astronomer', ['先去博物馆领装备吧，没有宇航服可上不了天。'], capturePointer);
      else if (!F.gotCodes) UI.talk('astronomer', D.astronomer_intro, () => {
        F.gotCodes = true; Player.P.hasCodes = true;
        Game.knowledge.add('codes'); Game.knowledge.add('loop');
        UI.give('codes');
        Audio2.SFX.codes(); Quests.completeStep(); save(); capturePointer();
      });
      else UI.talk('astronomer', [D.astronomer_idle[Math.floor(Math.random() * D.astronomer_idle.length)]], capturePointer);
    }
  }

  /* ============ Game 回调 ============ */
  Game.giveItem = (id, n) => { UI.give(id, n); Audio2.SFX.pickup(); };
  Game.takeItem = (id, n) => UI.take(id, n);
  Game.selectedItem = () => UI.selectedItem();
  Game.onCraft = out => {
    const F = Game.flags;
    if (out === 'planks') F.logsUsed++;
    if (out === 'stick') F.craftedPlanks = true;
    if (out === 'pickaxe_wood' && !F.craftedPick) { F.craftedPick = true; Quests.completeStep(); }
    save();
  };
  Game.onBlockMined = id => {};
  Game.onBlockPlaced = () => {};
  Game.onHurt = () => {
    el('flash').style.background = '#f00';
    el('flash').style.opacity = 0.25;
    setTimeout(() => { el('flash').style.opacity = 0; el('flash').style.background = '#fff'; }, 120);
  };
  Game.nearTable = () => {
    const w = Game.world, P = Player.P;
    if (!w) return false;
    for (let dy = -1; dy <= 2; dy++) for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++)
      if (w.get(P.x + dx, P.y + dy, P.z + dz) === World.BID.table) return true;
    return false;
  };
  Game.nearFire = () => {
    const w = Game.world, P = Player.P;
    if (!w) return false;
    for (let dy = -1; dy <= 2; dy++) for (let dz = -4; dz <= 4; dz++) for (let dx = -4; dx <= 4; dx++)
      if (w.get(P.x + dx, P.y + dy, P.z + dz) === World.BID.campfire) return true;
    return false;
  };
  Game.eyeUnlocked = () => Game.creative || Game.knowledge.has('eye_unlock');
  Game.novaRadius = () => Game.novaT > 0 ? 30 + Game.novaT / 7 * 6000 : 30;
  Game.onDeath = reason => {
    if (Game.creative || Game._resetting) return;
    loopReset(reason || '你失去了意识……');
  };

  /* ============ 时间循环 / 超新星 ============ */
  function loopReset(reason) {
    Game._resetting = true;
    Player.P.dead = true;
    Audio2.SFX.death();
    Audio2.stopLoops(); Audio2.stopMusic();
    Game.loopCount++;
    save();
    const ls = el('loopscreen');
    el('looptext').textContent = reason;
    el('loopcount').textContent = '';
    ls.classList.remove('hidden');
    ls.style.opacity = 1;
    setTimeout(() => {
      el('looptext').textContent = '「记忆穿越了时间」';
      el('loopcount').textContent = '循环 #' + Game.loopCount;
    }, 2200);
    setTimeout(() => {
      // 世界重置
      for (const w of Game.planetWorlds.values()) w.dispose();
      Game.planetWorlds.clear();
      Game.loopTime = 0; Game.novaT = -1;
      el('flash').style.opacity = 0;
      const P = Player.P;
      P.hp = P.maxHp; P.oxygen = 100; P.fuel = 100; P.dead = false;
      UI.reset(false);
      applyKnowledge();
      enterSurface('home', true);
      Game._resetting = false;
      ls.classList.add('hidden');
      capturePointer();
    }, 4600);
  }

  function updateLoop(dt) {
    if (Game.creative || Game._resetting || Game.mode === 'ending') return;
    Game.loopTime += dt;
    const remain = LOOP - Game.loopTime;
    // 红巨星化
    const redness = Math.max(0, Math.min(1, (Game.loopTime - (LOOP - 180)) / 180));
    Game.redness = redness;
    if (remain < 150 && remain > 0 && Game.mode === 'surface' && Game.curPlanet === 'home') Audio2.playMusic('danger');
    // 超新星
    if (Game.loopTime >= LOOP && Game.novaT < 0) {
      Game.novaT = 0;
      Audio2.supernova();
      UI.subtitle('太阳……爆发了。', 3000);
    }
    if (Game.novaT >= 0) {
      Game.novaT += dt;
      const p = Math.min(1, Game.novaT / 6);
      el('flash').style.opacity = p * p;
      if (Game.novaT > 6.2) loopReset('超新星吞没了一切');
    }
  }

  /* ============ 结局 ============ */
  function beginEnding() {
    Game.mode = 'ending';
    UI.closeTablet();
    releasePointer();
    Audio2.stopLoops(); Audio2.stopMusic();
    Audio2.SFX.warp();
    localStorage.setItem('bw_done', '1');
    const f = el('flash');
    f.style.transition = 'opacity 4s';
    f.style.opacity = 1;
    setTimeout(() => {
      el('hud').classList.add('hidden');
      el('ending').classList.remove('hidden');
      el('endsky').innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 960 640" preserveAspectRatio="xMidYMid slice"><rect width="960" height="640" fill="#02030a"/>${Assets.ui.stars(960, 640, 300, 42)}</svg>`;
      el('endfire').innerHTML = Assets.ui.campfire();
      f.style.transition = 'opacity 2s';
      f.style.opacity = 0;
      Audio2.playMusic('camp');
      Audio2.fire(true, 1);
      const lines = '旧的太阳熄灭了。\n你带着二十二分钟又二十二分钟的记忆，\n穿过了深空之眼。\n\n篝火重新点燃。\n群星围拢过来，听你讲那个\n关于方块、飞船与循环的故事。\n\n—— 新的宇宙，正在加载 ——';
      let i = 0;
      const et = el('endtext');
      et.textContent = '';
      const timer = setInterval(() => {
        i++;
        et.textContent = lines.slice(0, i);
        if (i >= lines.length) {
          clearInterval(timer);
          el('btn-end-menu').classList.remove('hidden');
        }
      }, 90);
    }, 4200);
  }

  /* ============ 帧循环 ============ */
  let lastT = 0;
  function frame(t) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (t - lastT) / 1000 || 0.016);
    lastT = t;
    if (Game.mode === 'menu' || Game.mode === 'ending') { return; }
    if (Game.paused) { render(); return; }

    updateLoop(dt);

    if (Game.mode === 'surface') {
      if (!uiOpen()) Player.update(dt, Game);
      else Game.setCrack(null, 0);
      updateSurface(dt);
    } else if (Game.mode === 'space') {
      Ship.update(dt, Game, Game.loopTime);
      Ship.updateSun(Game.novaT >= 0 ? Math.min(1, Game.novaT / 6) : 0, Game.redness || 0);
      updateSpaceHUD();
      Ship.applyCamera(camera);
    }

    UI.updateHUD(Player.P, Game.world, Game.creative ? null : Math.max(0, LOOP - Game.loopTime), Game.creative);
    Quests.render(Game);
    render();
  }

  function updateSurface(dt) {
    const w = Game.world, P = Player.P;
    w.uniforms.uPlayer.value.set(P.x, P.z);
    w.updateVisibility(P.x, P.z, 100);

    // 相机
    camera.position.set(0, P.y + P.eye, 0);
    camera.rotation.set(P.pitch, P.yaw, 0);

    // 天空与太阳
    const red = Game.redness || 0;
    const def = w.def;
    const sky = new THREE.Color(def.sky).lerp(new THREE.Color(0x3a0d08), red * 0.85);
    surfaceScene.background = sky;
    w.uniforms.uFogColor.value.set(def.fog).lerp(new THREE.Color(0x4a1008), red * 0.85);
    w.uniforms.uLight.value.set(
      def.light[0] * (1 + red * 0.2),
      def.light[1] * (1 - red * 0.35),
      def.light[2] * (1 - red * 0.5)
    );
    if (Game.novaT >= 0) {
      const p = Math.min(1, Game.novaT / 6);
      w.uniforms.uLight.value.set(1 + p * 2, 1 + p * 1.6, 1 + p * 1.4);
    }
    const sunAng = 0.9 + Game.loopTime * 0.0006;
    const sunEl = 0.55;
    sunSprite.position.set(
      camera.position.x + Math.cos(sunAng) * Math.cos(sunEl) * 480,
      camera.position.y + Math.sin(sunEl) * 480,
      camera.position.z + Math.sin(sunAng) * Math.cos(sunEl) * 480
    );
    const ss = 60 * (1 + red * 2.6);
    sunSprite.scale.set(ss, ss, 1);
    sunSprite.material.color.setRGB(1, 1 - red * 0.45, 1 - red * 0.6);
    surfaceStars.position.copy(camera.position);

    // 火焰动画
    const ft = t => 0.9 + 0.2 * Math.sin(t * 13) + 0.08 * Math.sin(t * 31);
    for (const m of flameMeshes) m.scale.y = ft(performance.now() / 1000 + m.rotation.y);

    // 选中框
    const hit = uiOpen() ? null : Player.getRayHit();
    if (selMesh) {
      if (hit) { selMesh.visible = true; selMesh.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5); }
      else selMesh.visible = false;
    }

    // NPC 注视检测 + 提示
    lookedNPC = null;
    let hintText = null;
    if (w.npcMeshes) {
      for (const n of w.npcMeshes) {
        const dx = w.wrapD(n.x - P.x), dz = w.wrapD(n.z - P.z);
        const d = Math.hypot(dx, dz);
        if (d < 2.8 && Math.abs(n.y - P.y) < 3) {
          lookedNPC = n.id;
          hintText = '按 E 与 ' + Assets.NPCS[n.id].name + ' 对话';
        }
      }
    }
    if (!hintText && w.shipPos) {
      const dx = w.wrapD(w.shipPos.x + 0.5 - P.x), dz = w.wrapD(w.shipPos.z + 0.5 - P.z);
      if (Math.hypot(dx, dz) < 4 && Math.abs(w.shipPos.y - P.y) < 4) {
        hintText = (P.hasCodes || Game.creative) ? '按 E 登船起飞' : '飞船已锁定（需要发射密码）';
      }
    }
    if (!hintText && hit) {
      const spec = w.getSpecial(hit.x, hit.y, hit.z);
      if (spec) {
        if (spec.type === 'chest') hintText = '按 E 打开' + (spec.name || '箱子');
        else if (spec.type === 'tablet') hintText = '按 E 使用翻译器阅读石板';
        else if (spec.type === 'telescope') hintText = '按 E 使用望远镜';
        else if (spec.type === 'campfire') hintText = P.hasCodes ? '按 E 在篝火旁冥想（跳到循环终点）' : '篝火';
      } else if (World.BLOCKS[hit.id].interact === 'table') hintText = '按 E 使用工作台';
    }
    UI.hint(hintText);

    // 篝火声/风声
    Audio2.fire(Game.nearFire(), 1);
    if (def.id !== 'home') Audio2.wind(true, def.id === 'deep' ? 1.4 : 0.8);

    // 信号镜
    UI.updateScope(P, w, w.signals, Game.eyeUnlocked());
  }

  function updateSpaceHUD() {
    const S = Ship.S;
    const spd = Math.round(Math.hypot(S.vx, S.vy, S.vz));
    el('shipspeed').textContent = '速度 ' + spd + ' m/s';
    let tgt = '';
    if (S.nearPlanet) tgt = '【按 E 在 ' + S.nearPlanet.name + ' 着陆】';
    else if (S.nearestInfo) {
      tgt = S.nearestInfo.def.name + ' · ' + Math.round(S.nearestInfo.dist) + 'm';
      if (Game.eyeUnlocked() && S.nearestInfo.def.id !== 'eye') {
        const [ex, ey, ez] = Ship.planetPos(World.PLANETS.eye, Game.loopTime);
        tgt += '　｜　深空之眼 · ' + Math.round(Math.hypot(S.x - ex, S.y - ey, S.z - ez)) + 'm';
      }
    }
    el('shiptarget').textContent = tgt;
  }

  function render() {
    if (Game.mode === 'surface' && surfaceScene) renderer.render(surfaceScene, camera);
    else if (Game.mode === 'space' && spaceScene) renderer.render(spaceScene, camera);
  }

  /* ============ 无头自检（#autotest） ============ */
  async function autotest() {
    const log = m => console.log('[AUTOTEST] ' + m);
    const wait = ms => new Promise(r => setTimeout(r, ms));
    try {
      await wait(500);
      el('btn-survival').click();
      await wait(2500);
      log('mode=' + Game.mode + ' planet=' + Game.curPlanet + ' chunks=' + Game.world.chunks.size);
      log('player=(' + Player.P.x.toFixed(1) + ',' + Player.P.y.toFixed(1) + ',' + Player.P.z.toFixed(1) + ')');
      renderer.render(surfaceScene, camera);
      log('surface render ok, drawcalls=' + renderer.info.render.calls + ' tris=' + renderer.info.render.triangles);
      // 模拟挖掘：直接 set
      Game.world.set(Math.floor(Player.P.x), Math.floor(Player.P.y) - 1, Math.floor(Player.P.z) + 2, 0, true);
      log('block edit ok');
      // 进入太空
      Player.P.hasCodes = true;
      enterSpace();
      await wait(800);
      renderer.render(spaceScene, camera);
      log('space render ok, mode=' + Game.mode + ' shipPos=(' + Ship.S.x.toFixed(0) + ',' + Ship.S.y.toFixed(0) + ',' + Ship.S.z.toFixed(0) + ')');
      // 着陆燧沙星
      landOnPlanet(World.PLANETS.ember);
      await wait(2500);
      renderer.render(surfaceScene, camera);
      log('landed=' + Game.curPlanet + ' render ok, tris=' + renderer.info.render.triangles);
      // 石板界面
      UI.showTablet('ember_tablet', c => log('tablet clue=' + c));
      await wait(500);
      UI.closeTablet();
      // 超新星逻辑（直接驱动，不依赖 RAF 节奏）
      Game.loopTime = LOOP - 0.5;
      for (let i = 0; i < 400 && Game.novaT < 6.3; i++) updateLoop(0.02);
      log('novaT=' + Game.novaT.toFixed(1) + ' resetting=' + !!Game._resetting);
      await wait(5200);
      log('after nova: mode=' + Game.mode + ' planet=' + Game.curPlanet + ' loop#' + Game.loopCount);
      log('ALL PASS');
    } catch (e) {
      console.log('[AUTOTEST-FAIL] ' + e.message + '\n' + e.stack);
    }
  }

  boot().then(() => { if (location.hash === '#autotest') autotest(); });
})();
