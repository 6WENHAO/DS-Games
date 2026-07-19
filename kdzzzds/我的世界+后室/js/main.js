/* ============================================================
 * BLOCKROOMS - main.js
 * 游戏主循环 / 状态机 / 生存系统 / 任务链 / 关卡切换
 * ============================================================ */
(function () {
  'use strict';
  const B = window.BRBlocks;

  /* ================= 游戏状态 ================= */
  const G = {
    state: 'boot',    // boot/menu/intro/playing/transition/dead/win
    level: null,
    seed: (Math.random() * 1e9) | 0,
    hp: 20, sanity: 100,
    inv: new Array(36).fill(null),
    hotbarSel: 0,
    stats: { mined: 0, houndsKilled: 0, smilersRepelled: 0, almond: 0, minedWall: 0 },
    crafted: {},
    flashBattery: 180,
    playTime: 0,
    questIdx: 0,
    smilerGaze: 0,
    settings: { volume: 0.8, music: 0.6, sens: 1.0, fov: 75, dist: 3 }
  };
  window.BRGame = G;

  let renderer, scene, camera, ambientLight, flashlight, flashTarget;
  let lastT = 0, glitchAcc = 0;
  let flickerT = 0, flickerActive = 0, nextFlicker = 5;
  let heartbeatAcc = 0, sanityDmgAcc = 0, regenAcc = 0, whisperAcc = 0;
  let placeHold = 0, rightHeld = false;
  let menuYaw = 0;
  let settingsFrom = 'main';
  let audioStarted = false;

  /* ================= 任务链 ================= */
  const QUESTS = [
    { t: '拆墙！', d: '徒手破坏壁纸墙，收集 4 个壁纸块', check: () => G.stats.minedWall >= 4, done: '收集了壁纸块' },
    { t: '墙里的木头', d: '寻找破损露木的墙壁，获得旧木头', check: () => hasItem('old_wood') || G.crafted.planks, done: '获得了旧木头' },
    { t: '制作工作台', d: '合成木板（E 打开背包合成），再合成工作台', check: () => hasItem('craft') || G.crafted.craft, done: '制作了工作台' },
    { t: '第一件工具', d: '放置工作台，右键打开并制作木镐', check: () => G.crafted.wood_pick, done: '制作了木镐' },
    { t: '杏仁水', d: '在地毯上寻找杏仁水，喝下以恢复理智', check: () => G.stats.almond >= 1, done: '喝下了杏仁水' },
    { t: '现实故障', d: '循着电流噪声，寻找闪烁的墙壁并穿过它', check: () => G.level && G.level.id === 1, done: '穿过了现实故障' },
    { t: '照亮黑暗', d: '拆开板条箱寻找电池与灯管，在工作台合成手电筒', check: () => G.crafted.flashlight || hasItem('flashlight'), done: '制作了手电筒' },
    { t: '离开这里', d: '沿着柱子上的绿色指示牌，找到 EXIT 大门（右键推开）', check: () => false, done: '' }
  ];
  function hasItem(id) {
    for (const s of G.inv) if (s && s.id === id) return true;
    return false;
  }
  function updateQuests() {
    let advanced = false, guard = 0;
    while (G.questIdx < QUESTS.length && guard++ < 12) {
      const q = QUESTS[G.questIdx];
      if (!q.check()) break;
      BRUI.questComplete(q.done);
      G.questIdx++;
      advanced = true;
    }
    if (advanced) showCurrentQuest();
  }
  function showCurrentQuest() {
    if (G.questIdx < QUESTS.length) {
      const q = QUESTS[G.questIdx];
      BRUI.setObjective(q.t, q.d);
    } else BRUI.setObjective(null);
  }

  /* ================= 物品逻辑 ================= */
  G.giveItem = function (id, n) { // 返回剩余数量
    const it = B.items[id];
    const max = it.stack || 64;
    let left = n;
    for (let i = 0; i < 36 && left > 0; i++) {
      const s = G.inv[i];
      if (s && s.id === id && s.n < max) {
        const mv = Math.min(left, max - s.n);
        s.n += mv; left -= mv;
      }
    }
    for (let i = 0; i < 36 && left > 0; i++) {
      if (!G.inv[i]) {
        const mv = Math.min(left, max);
        G.inv[i] = { id, n: mv }; left -= mv;
      }
    }
    const added = n - left;
    if (added > 0) {
      BRUI.pickupToast(id, added);
      BRUI.updateHotbar();
      if (BRUI.invOpen) BRUI.renderInventory();
      updateQuests();
    }
    return left;
  };
  G.giveOrDrop = function (id, n) {
    const left = G.giveItem(id, n);
    if (left > 0) {
      const p = BRPlayer.pos;
      BREntities.spawnDrop(id, left, p.x, p.y + 1, p.z, true);
    }
  };
  G.heldItem = function () {
    const s = G.inv[G.hotbarSel];
    return s ? s.id : null;
  };
  function consumeHeld(n) {
    const s = G.inv[G.hotbarSel];
    if (!s) return;
    s.n -= n || 1;
    if (s.n <= 0) G.inv[G.hotbarSel] = null;
    BRUI.updateHotbar();
  }
  G.onCraft = function (rid) {
    G.crafted[rid] = true;
    updateQuests();
  };
  G.stat = function (k) { G.stats[k] = (G.stats[k] || 0) + 1; };

  /* ================= 挖掘 / 放置 ================= */
  G.getBreakTime = function (blockId) {
    return B.breakTime(blockId, G.heldItem());
  };
  G.spawnBlockParticles = function (hit, count) {
    const def = B.defs[hit.id];
    let tiles = def.tiles;
    if (typeof tiles === 'function') tiles = tiles(hit.x, hit.y, hit.z);
    const c = BRAssets.tileColor[tiles.side] || '#888888';
    BREntities.spawnParticles(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5, c, count);
  };
  G.breakBlock = function (t) {
    const id = BRWorld.getBlock(t.x, t.y, t.z);
    if (id === B.AIR) return;
    const def = B.defs[id];
    if (def.unbreakable) return;
    BRWorld.setBlock(t.x, t.y, t.z, B.AIR);
    G.spawnBlockParticles({ x: t.x, y: t.y, z: t.z, id }, 14);
    BRAudio.breakBlock(def.mat || 'stone');
    G.stats.mined++;
    if (id === B.WALL) G.stats.minedWall++;
    // 掉落
    if (def.drop === 'LOOT') {
      const loot = B.crateLoot(Math.random);
      for (const l of loot)
        BREntities.spawnDrop(l.id, l.n, t.x + 0.5, t.y + 0.5, t.z + 0.5, true);
    } else if (def.drop) {
      BREntities.spawnDrop(def.drop, 1, t.x + 0.5, t.y + 0.5, t.z + 0.5, true);
    }
    updateQuests();
  };
  function tryPlace() {
    const hit = BRPlayer.currentHit;
    if (!hit) return false;
    const held = G.heldItem();
    if (!held) return false;
    const it = B.items[held];
    if (it.block === undefined) return false;
    const px = hit.x + hit.face[0], py = hit.y + hit.face[1], pz = hit.z + hit.face[2];
    if (py < 0 || py >= BRWorld.level.H) return false;
    if (BRWorld.getBlock(px, py, pz) !== B.AIR) return false;
    // 不能放在玩家 / 实体身上
    const p = BRPlayer.pos;
    if (px + 1 > p.x - 0.3 && px < p.x + 0.3 && pz + 1 > p.z - 0.3 && pz < p.z + 0.3 &&
      py + 1 > p.y && py < p.y + 1.8) return false;
    for (const e of BREntities.list) {
      if (px + 1 > e.pos.x - e.half && px < e.pos.x + e.half &&
        pz + 1 > e.pos.z - e.half && pz < e.pos.z + e.half &&
        py + 1 > e.pos.y && py < e.pos.y + e.height) return false;
    }
    BRWorld.setBlock(px, py, pz, it.block);
    BRAudio.place(B.defs[it.block].mat || 'stone');
    consumeHeld(1);
    BRPlayer.swing();
    return true;
  }
  function tryUse() {
    const hit = BRPlayer.currentHit;
    // 交互方块优先
    if (hit) {
      const def = B.defs[hit.id];
      if (def.interact === 'craft') { BRUI.openInventory(true); return true; }
      if (def.interact === 'exit') { winGame(); return true; }
    }
    const held = G.heldItem();
    if (held) {
      const it = B.items[held];
      if (it.use === 'drink') {
        consumeHeld(1);
        BRAudio.drink();
        G.addSanity(40);
        G.stats.almond++;
        BRUI.toast('理智恢复了…… 后室的杏仁水有种奇怪的甜味', 'quest');
        BRPlayer.swing();
        updateQuests();
        return true;
      }
      if (it.use === 'heal') {
        if (G.hp >= 20) { BRUI.toast('生命值已满'); return true; }
        consumeHeld(1);
        BRAudio.bandage();
        G.hp = Math.min(20, G.hp + 6);
        BRPlayer.swing();
        return true;
      }
      if (it.use === 'flashlight') { toggleFlashlight(); return true; }
    }
    return tryPlace();
  }
  function toggleFlashlight() {
    if (!hasItem('flashlight')) return;
    if (!BRPlayer.flashlightOn && G.flashBattery <= 0) {
      if (autoBattery()) { } else { BRUI.toast('手电筒没电了…… 需要电池'); return; }
    }
    BRPlayer.flashlightOn = !BRPlayer.flashlightOn;
    BRAudio.flashlightClick(BRPlayer.flashlightOn);
  }
  function autoBattery() {
    for (let i = 0; i < 36; i++) {
      const s = G.inv[i];
      if (s && s.id === 'battery') {
        s.n--; if (s.n <= 0) G.inv[i] = null;
        G.flashBattery = 180;
        BRUI.toast('装入了新电池');
        BRUI.updateHotbar();
        return true;
      }
    }
    return false;
  }

  /* ================= 战斗 / 生存 ================= */
  G.attackEntity = function (e) {
    const dmg = B.attackDamage(G.heldItem());
    BREntities.hurt(e, dmg, G);
  };
  G.damage = function (n, source) {
    if (G.state !== 'playing' || n <= 0) return;
    G.hp -= n;
    BRUI.damageFlash();
    BRAudio.hurt();
    if (G.hp <= 0) {
      G.hp = 0;
      die(source);
    }
  };
  G.addSanity = function (d) {
    G.sanity = Math.max(0, Math.min(100, G.sanity + d));
  };
  G.jumpscare = function () {
    G.addSanity(-25);
    G.damage(2, 'smiler');
    BRUI.setGlitch(1);
    setTimeout(() => BRUI.setGlitch(0), 500);
  };
  const DEATH_REASON = {
    hound: '你被猎犬撕碎了', smiler: '它对你微笑了',
    fall: '你摔得太重了', sanity: '你的心智彻底崩溃了',
    void: '你坠入了更深的地方……'
  };
  function die(source) {
    G.state = 'dead';
    BRPlayer.frozen = true;
    BRPlayer.mouse.left = false;
    BRAudio.death();
    BRAudio.stopAmbient();
    document.exitPointerLock && document.exitPointerLock();
    setTimeout(() => BRUI.showDeath(DEATH_REASON[source] || '你死在了后室'), 700);
  }
  function respawn() {
    G.hp = 20;
    G.sanity = 60;
    BREntities.clear();
    const sp = BRWorld.level.spawn;
    BRPlayer.teleport(sp.x, sp.y, sp.z);
    BRPlayer.frozen = false;
    G.state = 'playing';
    BRUI.showScreen('hud');
    showCurrentQuest();
    BRAudio.startAmbient(BRWorld.level.id);
    BRUI.fade(true, 0);
    BRUI.fade(false, 800);
    lockPointer();
  }

  /* ================= 关卡 ================= */
  function setLevel(id) {
    const lv = BRGen.create(id, G.seed);
    G.level = lv;
    BRWorld.setLevel(lv);
    BREntities.clear();
    scene.fog = new THREE.FogExp2(lv.fogColor, lv.fogDensity);
    renderer.setClearColor(lv.fogColor);
    const sp = lv.spawn;
    BRPlayer.teleport(sp.x, sp.y, sp.z);
    // 预生成周围区块
    BRWorld.update(sp.x, sp.z, null);
    for (let i = 0; i < 60 && BRWorld.pendingDirty() > 0; i++) BRWorld.update(sp.x, sp.z, null);
  }
  function goToLevel1() {
    if (G.state !== 'playing') return;
    G.state = 'transition';
    BRPlayer.frozen = true;
    BRUI.noclipTransition(() => {
      setLevel(1);
      BRAudio.stopAmbient();
    }, () => {
      G.state = 'playing';
      BRPlayer.frozen = false;
      BRAudio.startAmbient(1);
      BRUI.showLevelTitle(G.level.name, G.level.sub);
      if (G.questIdx < 6) G.questIdx = 6; // 已进入 L1，跳过前置任务
      updateQuests();
      showCurrentQuest();
    });
  }
  function winGame() {
    if (G.state !== 'playing') return;
    G.state = 'win';
    BRPlayer.frozen = true;
    BRPlayer.mouse.left = false;
    BRAudio.doorOpen();
    BRAudio.stopAmbient();
    document.exitPointerLock && document.exitPointerLock();
    const m = Math.floor(G.playTime / 60), s = Math.floor(G.playTime % 60);
    BRUI.fade(true, 900, () => {
      BRAudio.win();
      BRUI.showWin({
        time: m + ':' + (s < 10 ? '0' : '') + s,
        mined: G.stats.mined,
        hounds: G.stats.houndsKilled || 0,
        smilers: G.stats.smilersRepelled || 0,
        almond: G.stats.almond
      });
      BRUI.fade(false, 600);
    });
  }

  /* ================= 开始游戏 ================= */
  function startGame() {
    startAudioOnce();
    BRAudio.stopMusic();
    BRUI.fade(true, 700, () => {
      BRUI.playIntro([
        '下班回家的路上，你在楼梯间踩空了一格……',
        '不是摔倒——是「穿了过去」。',
        '潮湿的地毯。发黄的壁纸。荧光灯的嗡鸣。',
        '这里是后室 (The Backrooms)。',
        '规则很简单：保持理智，活下去，然后——',
        '找到出口。'
      ], beginPlay);
      BRUI.fade(false, 400);
    });
  }
  function beginPlay() {
    BRUI.fade(true, 500, () => {
      G.state = 'playing';
      G.hp = 20; G.sanity = 100;
      G.inv = new Array(36).fill(null);
      G.hotbarSel = 0;
      G.stats = { mined: 0, houndsKilled: 0, smilersRepelled: 0, almond: 0, minedWall: 0 };
      G.crafted = {};
      G.questIdx = 0;
      G.playTime = 0;
      G.flashBattery = 180;
      G.smilerGaze = 0;
      G.seed = (Math.random() * 1e9) | 0;
      BRUI.setGlitch(0);
      BRUI.setSanityVignette(0);
      BRUI.setHealthVignette(0);
      BRPlayer.frozen = false;
      BRPlayer.flashlightOn = false;
      BRPlayer.yaw = Math.PI * 0.25; BRPlayer.pitch = 0;
      setLevel(0);
      BRUI.showScreen('hud');
      BRUI.updateHotbar();
      BRUI.updateStats();
      showCurrentQuest();
      BRAudio.startAmbient(0);
      BRAudio.impact();
      BRUI.showLevelTitle(G.level.name, G.level.sub);
      BRUI.fade(false, 1200);
      lockPointer();
    });
  }
  function quitToMenu() {
    G.state = 'menu';
    BRPlayer.frozen = true;
    BRUI.showPause(false);
    BRUI.setGlitch(0);
    BRUI.setSanityVignette(0);
    BRUI.setHealthVignette(0);
    BRUI.setObjective(null);
    BRUI.showScreen('menu-main');
    BRAudio.stopAmbient();
    BRAudio.startMusic();
    document.exitPointerLock && document.exitPointerLock();
    BREntities.clear();
  }

  /* ================= 输入 ================= */
  function lockPointer() {
    if (G.state === 'playing' && !BRUI.invOpen && !BRUI.paused)
      renderer.domElement.requestPointerLock && renderer.domElement.requestPointerLock();
  }
  function isLocked() { return document.pointerLockElement === renderer.domElement; }

  function bindInput() {
    const cv = renderer.domElement;
    document.addEventListener('pointerlockchange', () => {
      if (!isLocked() && G.state === 'playing' && !BRUI.invOpen) {
        BRUI.showPause(true);
        BRPlayer.mouse.left = false;
        rightHeld = false;
      }
    });
    document.addEventListener('mousemove', e => {
      if (isLocked() && G.state === 'playing')
        BRPlayer.onMouseMove(e.movementX, e.movementY);
    });
    cv.addEventListener('mousedown', e => {
      if (G.state !== 'playing') return;
      if (!isLocked()) { lockPointer(); return; }
      if (e.button === 0) {
        BRPlayer.mouse.left = true;
        BRPlayer.tryAttack(G);
      } else if (e.button === 2) {
        rightHeld = true;
        placeHold = 0;
        tryUse();
      }
    });
    window.addEventListener('mouseup', e => {
      if (e.button === 0) BRPlayer.mouse.left = false;
      if (e.button === 2) rightHeld = false;
    });
    cv.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('contextmenu', e => {
      if (G.state === 'playing' || G.state === 'transition') e.preventDefault();
    });
    window.addEventListener('wheel', e => {
      if (G.state !== 'playing' || BRUI.invOpen || BRUI.paused) return;
      G.hotbarSel = (G.hotbarSel + (e.deltaY > 0 ? 1 : -1) + 9) % 9;
      onHotbarChange();
    });
    window.addEventListener('keydown', e => {
      if (G.state !== 'playing' && G.state !== 'transition') return;
      BRPlayer.keys[e.code] = true;
      if (e.code.startsWith('Digit')) {
        const d = +e.code.slice(5);
        if (d >= 1 && d <= 9) { G.hotbarSel = d - 1; onHotbarChange(); }
      }
      if (e.code === 'KeyE') {
        if (BRUI.invOpen) { BRUI.closeInventory(); lockPointer(); }
        else if (!BRUI.paused) BRUI.openInventory(false);
      }
      if (e.code === 'KeyF') toggleFlashlight();
      if (e.code === 'KeyQ' && !BRUI.invOpen) dropHeld();
      if (e.code === 'Escape') {
        if (BRUI.invOpen) { BRUI.closeInventory(); lockPointer(); }
      }
      if (e.code === 'Space') e.preventDefault();
    });
    window.addEventListener('keyup', e => { BRPlayer.keys[e.code] = false; });
    window.addEventListener('blur', () => {
      BRPlayer.keys = {};
      BRPlayer.mouse.left = false;
      rightHeld = false;
    });
  }
  function onHotbarChange() {
    BRUI.updateHotbar();
    const s = G.inv[G.hotbarSel];
    if (s) BRUI.showItemName(B.items[s.id].name);
    BRPlayer.setHeld(s ? s.id : null);
  }
  function dropHeld() {
    const s = G.inv[G.hotbarSel];
    if (!s) return;
    const dir = BRPlayer.getDir();
    const p = BRPlayer.pos;
    const d = BREntities.spawnDrop(s.id, 1, p.x + dir.x * 0.6, p.y + 1.4, p.z + dir.z * 0.6, false);
    d.vel.x = dir.x * 4; d.vel.y = 1.5; d.vel.z = dir.z * 4;
    d.pickDelay = 1.2;
    consumeHeld(1);
  }

  /* ================= 菜单绑定 ================= */
  function bindMenus() {
    const on = (id, fn) => {
      const el = document.getElementById(id);
      el.addEventListener('click', () => { BRAudio.uiClick(); fn(); });
      el.addEventListener('mouseenter', () => BRAudio.uiHover());
    };
    on('btn-start', startGame);
    on('btn-settings', () => { settingsFrom = 'main'; openSettings(); });
    on('btn-fullscreen', () => {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen();
    });
    on('btn-settings-back', () => {
      saveSettings();
      if (settingsFrom === 'main') BRUI.showScreen('menu-main');
      else { BRUI.showScreen('hud'); BRUI.showPause(true); }
    });
    on('btn-resume', () => { BRUI.showPause(false); lockPointer(); });
    on('btn-pause-settings', () => { settingsFrom = 'pause'; BRUI.showPause(false); openSettings(); });
    on('btn-quit', quitToMenu);
    on('btn-respawn', respawn);
    on('btn-death-quit', quitToMenu);
    on('btn-continue', () => {
      G.state = 'playing';
      BRPlayer.frozen = false;
      BRUI.showScreen('hud');
      BRAudio.startAmbient(BRWorld.level.id);
      BRUI.toast('无尽探索模式 —— 这里没有真正的出口');
      lockPointer();
    });
    on('btn-win-quit', quitToMenu);

    // 设置滑块
    const bind = (id, key, fmt) => {
      const el = document.getElementById(id);
      const label = document.getElementById(id + '-v');
      el.value = G.settings[key];
      const update = () => {
        G.settings[key] = parseFloat(el.value);
        if (label) label.textContent = fmt ? fmt(G.settings[key]) : G.settings[key];
        applySettings();
      };
      el.addEventListener('input', update);
      update();
    };
    bind('set-volume', 'volume', v => Math.round(v * 100) + '%');
    bind('set-music', 'music', v => Math.round(v * 100) + '%');
    bind('set-sens', 'sens', v => v.toFixed(1) + 'x');
    bind('set-fov', 'fov', v => v + '°');
    bind('set-dist', 'dist', v => v + ' 区块');
  }
  function openSettings() {
    if (settingsFrom === 'main') BRUI.showScreen('menu-settings');
    else document.getElementById('menu-settings').classList.add('active');
  }
  function applySettings() {
    BRAudio.volumes.master = G.settings.volume;
    BRAudio.volumes.music = G.settings.music;
    BRAudio.applyVolumes();
    BRPlayer.sensitivity = G.settings.sens;
    if (camera) { camera.fov = G.settings.fov; camera.updateProjectionMatrix(); }
    BRWorld.viewDist = Math.round(G.settings.dist);
  }
  function saveSettings() {
    try { localStorage.setItem('blockrooms_settings', JSON.stringify(G.settings)); } catch (e) { }
  }
  function loadSettings() {
    try {
      const s = JSON.parse(localStorage.getItem('blockrooms_settings'));
      if (s) Object.assign(G.settings, s);
    } catch (e) { }
  }
  function startAudioOnce() {
    if (audioStarted) return;
    audioStarted = true;
    BRAudio.init();
    BRAudio.applyVolumes();
  }

  /* ================= 生存系统每帧 ================= */
  function updateSurvival(dt) {
    G.playTime += dt;
    const p = BRPlayer.pos;
    // 虚空
    if (p.y < -12) { G.damage(100, 'void'); return; }
    const light = BRWorld.lightAt(p.x, p.y + 1.2, p.z);
    const lv = G.level;
    // 理智
    if (light > 0.45) {
      if (G.sanity < 70) G.addSanity(dt * 0.4);
    } else {
      G.addSanity(-dt * lv.sanityDrainBase * (light < 0.2 ? 1.6 : 1));
    }
    G.smilerGaze = Math.max(0, G.smilerGaze - dt * 0.5);
    // 理智效果
    const s = G.sanity;
    BRPlayer.sanityWobble = s < 35 ? (1 - s / 35) : 0;
    BRUI.setSanityVignette(s < 60 ? (1 - s / 60) * 0.85 + G.smilerGaze * 0.3 : G.smilerGaze * 0.3);
    BRUI.setHealthVignette(G.hp <= 6 ? (1 - G.hp / 6) * 0.8 : 0);
    if (s < 35) {
      heartbeatAcc += dt;
      const period = 0.6 + (s / 35) * 0.7;
      if (heartbeatAcc > period) {
        heartbeatAcc = 0;
        BRAudio.heartbeat(1 - s / 35);
      }
      whisperAcc += dt;
      if (whisperAcc > 6 && Math.random() < dt * 0.5) {
        whisperAcc = 0;
        BRAudio.whisperHallucination();
      }
    }
    if (s <= 0) {
      sanityDmgAcc += dt;
      if (sanityDmgAcc > 2.5) { sanityDmgAcc = 0; G.damage(1, 'sanity'); }
    }
    // 生命恢复
    if (G.hp < 20 && G.sanity > 70) {
      regenAcc += dt;
      if (regenAcc > 4) { regenAcc = 0; G.hp = Math.min(20, G.hp + 1); }
    }
    // 手电筒电量
    if (BRPlayer.flashlightOn) {
      G.flashBattery -= dt;
      if (G.flashBattery <= 0) {
        if (!autoBattery()) {
          BRPlayer.flashlightOn = false;
          BRAudio.flashlightClick(false);
          BRUI.toast('手电筒熄灭了……');
        }
      }
    }
    // Level 0 靠近故障墙特效
    if (lv.id === 0 && lv.nearestGlitch) {
      const g = lv.nearestGlitch(p.x, p.z);
      if (g && g.dist < 22) {
        const prox = 1 - g.dist / 22;
        BRUI.setGlitch(prox * 0.35);
        if (Math.random() < dt * prox * 6)
          BRAudio.glitchNear(g.x, 2, g.z, prox);
      } else BRUI.setGlitch(G.smilerGaze * 0.2);
      // 触发 noclip
      const bx = Math.floor(p.x), bz = Math.floor(p.z);
      if (lv.isGlitch(bx, bz) || lv.isGlitch(Math.floor(p.x + 0.3), bz) || lv.isGlitch(Math.floor(p.x - 0.3), bz) ||
        lv.isGlitch(bx, Math.floor(p.z + 0.3)) || lv.isGlitch(bx, Math.floor(p.z - 0.3))) {
        goToLevel1();
      }
    } else {
      BRUI.setGlitch(G.smilerGaze * 0.2);
    }
    // 灯光闪烁事件
    flickerT += dt;
    if (flickerActive > 0) {
      flickerActive -= dt;
      ambientLight.intensity = 0.55 + Math.random() * 0.5;
      if (flickerActive <= 0) ambientLight.intensity = 1.0;
    } else if (flickerT > nextFlicker) {
      flickerT = 0;
      nextFlicker = 6 + Math.random() * 14;
      flickerActive = 0.3 + Math.random() * 0.4;
      BRAudio.humFlicker();
    }
  }

  /* ================= 提示文本 ================= */
  function updateHint() {
    if (BRUI.invOpen || BRUI.paused) { BRUI.setHint(''); return; }
    const hit = BRPlayer.currentHit;
    let text = '';
    if (hit) {
      const def = B.defs[hit.id];
      if (def.interact === 'craft') text = '右键 — 打开工作台';
      else if (def.interact === 'exit') text = '右键 — 推开大门';
      else if (!def.unbreakable) {
        text = '按住左键 — 破坏「' + def.name + '」';
        const held = G.heldItem();
        if (held && B.items[held].block !== undefined) text += '　·　右键 — 放置';
      }
    } else if (G.playTime < 30) {
      text = 'WASD 移动 · Shift 冲刺 · E 背包 · 鼠标滚轮切换物品';
    }
    const held = G.heldItem();
    if (held === 'almond') text = '右键 — 喝下杏仁水';
    if (held === 'bandage') text = '右键 — 使用绷带';
    if (held === 'flashlight') text = '右键 / F — 开关手电筒' + (G.flashBattery < 30 ? '（电量不足！）' : '');
    BRUI.setHint(text);
  }

  /* ================= 初始化 ================= */
  async function boot() {
    renderer = new THREE.WebGLRenderer({ antialias: false, canvas: document.getElementById('game-canvas') });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.autoClear = false;
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.05, 300);
    ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
    scene.add(ambientLight);
    flashlight = new THREE.SpotLight(0xfff0c8, 0, 26, 0.46, 0.55, 1.2);
    flashTarget = new THREE.Object3D();
    scene.add(flashTarget);
    flashlight.target = flashTarget;
    scene.add(flashlight);

    await BRAssets.load();
    BRWorld.init(scene);
    BREntities.init(scene);
    await BRPlayer.init(scene, camera, renderer);
    BRUI.init(G);
    loadSettings();
    bindMenus();
    bindInput();
    applySettings();

    window.addEventListener('resize', onResize);
    onResize();

    // 菜单背景世界
    G.seed = (Math.random() * 1e9) | 0;
    setLevel(0);
    BRPlayer.frozen = true;
    G.state = 'menu';
    BRUI.showScreen('menu-main');
    // 随机 splash 语
    const splashes = [
      '别眨眼。', '它在看着你。', '闻起来像旧地毯。', '嗡——嗡——嗡——',
      '出口是骗人的。', '理智是消耗品。', '9,223,372,036,854,775,807 间房。',
      '杏仁水，冰镇更佳！', '不要靠近微笑者。', 'noclip 生效中……', '也是一种方块游戏！'
    ];
    document.getElementById('splash').textContent = splashes[(Math.random() * splashes.length) | 0];
    document.getElementById('loading').classList.add('hidden');

    // 首次交互启动音频
    const first = () => {
      startAudioOnce();
      if (G.state === 'menu') BRAudio.startMusic();
      window.removeEventListener('pointerdown', first);
      window.removeEventListener('keydown', first);
    };
    window.addEventListener('pointerdown', first);
    window.addEventListener('keydown', first);

    lastT = performance.now();
    requestAnimationFrame(loop);
  }

  function onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    BRPlayer.resize(w / h);
  }

  /* ================= 主循环 ================= */
  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;

    // 故障方块动画
    glitchAcc += dt;
    if (glitchAcc > 0.12) { glitchAcc = 0; BRAssets.tickGlitch(); }

    const p = BRPlayer.pos;

    if (G.state === 'menu') {
      menuYaw += dt * 0.06;
      BRPlayer.yaw = menuYaw;
      BRPlayer.pitch = Math.sin(menuYaw * 0.5) * 0.05;
      camera.position.set(p.x, p.y + 1.62, p.z);
      camera.rotation.order = 'YXZ';
      camera.rotation.y = BRPlayer.yaw;
      camera.rotation.x = BRPlayer.pitch;
      camera.rotation.z = 0;
      BRWorld.update(p.x, p.z, null);
    } else if (G.state === 'playing' || G.state === 'transition' || G.state === 'dead' || G.state === 'win') {
      const playing = G.state === 'playing';
      if (playing) BRPlayer.setHeld(G.heldItem());
      if (playing && !BRUI.paused && !BRUI.invOpen) {
        BRPlayer.update(dt, G);
        // 持续右键放置
        if (rightHeld) {
          placeHold += dt;
          if (placeHold > 0.28) { placeHold = 0; tryPlace(); }
        }
        updateSurvival(dt);
        BREntities.update(dt, G);
        BREntities.trySpawn(dt, G);
        updateHint();
      } else if (playing) {
        BRPlayer.update(0, G); // 保持镜头，世界冻结
      } else {
        BRPlayer.update(0, G);
      }
      BRWorld.update(p.x, p.z, drops => {
        for (const d of drops) BREntities.spawnDrop(d.id, d.n, d.x, d.y, d.z, false);
      });
      // 音频监听者
      const dir = BRPlayer.getDir();
      BRAudio.setListener(p.x, p.y + 1.6, p.z, dir.x, dir.z);
      // 手电筒
      const wantFlash = BRPlayer.flashlightOn && playing ? 2.2 : 0;
      flashlight.intensity += (wantFlash - flashlight.intensity) * Math.min(1, dt * 10);
      flashlight.position.set(camera.position.x, camera.position.y - 0.1, camera.position.z);
      flashTarget.position.set(camera.position.x + dir.x * 10, camera.position.y + dir.y * 10, camera.position.z + dir.z * 10);
      // 冲刺 FOV
      const running = (BRPlayer.keys['ShiftLeft'] || BRPlayer.keys['ShiftRight']) &&
        (BRPlayer.keys['KeyW'] || BRPlayer.keys['ArrowUp']);
      const targetFov = G.settings.fov + (running && playing ? 7 : 0);
      if (Math.abs(camera.fov - targetFov) > 0.1) {
        camera.fov += (targetFov - camera.fov) * Math.min(1, dt * 8);
        camera.updateProjectionMatrix();
      }
      BRUI.updateStats();
    }

    renderer.clear();
    renderer.render(scene, camera);
    if (G.state !== 'menu') {
      renderer.clearDepth();
      // 手臂环境亮度
      const hl = BRWorld.level ? Math.min(1.15, BRWorld.lightAt(p.x, p.y + 1.4, p.z) + 0.25 + (BRPlayer.flashlightOn ? 0.3 : 0)) : 1;
      BRPlayer.handScene.children.forEach(c => { if (c.isAmbientLight) c.intensity = hl; });
      renderer.render(BRPlayer.handScene, BRPlayer.handCamera);
    }
  }

  window.addEventListener('DOMContentLoaded', boot);
})();
