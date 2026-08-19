/* ==========================================================================
   SPORE · game.js
   引擎装配 / 输入 / 阶段管理器 / 存档 / 暂停与死亡 / 主循环
   ========================================================================== */
(function () {
  const U = SP.U, DB = SP.DB, G = SP.Genome;
  const SAVE_KEY = 'spore_save_v1';

  const game = {
    state: 'loading',           // loading | menu | play
    paused: false,
    stage: 'cell',
    time: 0, dt: 0,
    bus: U.Bus(),
    dna: 0,
    money: 0,
    genome: null,
    badges: {},
    unlockedParts: {},
    design: {},
    wantsPointer: false,
    settings: { vol: .7, sens: 1.0 }
  };
  window.SPORE = game;
  SP.game = game;

  if (THREE.ColorManagement) THREE.ColorManagement.legacyMode = false;

  /* ------------------------------------------------------------ 渲染器 */
  const canvas = document.getElementById('scene');
  const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  if (THREE.sRGBEncoding !== undefined) renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;
  renderer.setClearColor(0x05060f);
  game.renderer = renderer;

  const scene = new THREE.Scene();
  game.scene = scene;
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, .05, 20000);
  scene.add(camera);
  game.camera = camera;
  game.clock = new THREE.Clock();

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  /* ------------------------------------------------------------ 输入 */
  const keys = {};
  const mouse = { x: 0, y: 0, dx: 0, dy: 0, down0: false, down2: false, wheel: 0 };
  game.input = { keys: keys, mouse: mouse };
  let locked = false;

  function setKey(e, down) {
    keys[e.code] = down;
    // 兼容多种写法，方便各阶段模块
    if (e.code.indexOf('Key') === 0) {
      const c = e.code.slice(3);
      keys[c] = down; keys[c.toLowerCase()] = down;
    }
    if (e.code.indexOf('Digit') === 0) keys[e.code.slice(5)] = down;
  }
  window.addEventListener('keydown', e => {
    if (['Tab', 'Space', 'F5'].indexOf(e.code) >= 0) e.preventDefault();
    setKey(e, true);
    if (game.state !== 'play') return;
    if (e.code === 'Escape') {
      if (SP.Editor.isOpen()) return;                 // 编辑器自己处理
      if (game.ui.dialogOpen()) { game.ui.closeDialog(); return; }
      game.pause(!game.paused);
      return;
    }
    if (game.paused) return;
    if (e.code === 'F5') { game.save(); return; }
    if (e.code === 'KeyP') { game.ui.openEditor(game.stage === 'cell' ? 'cell' : 'creature'); return; }
  });
  window.addEventListener('keyup', e => setKey(e, false));
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

  canvas.addEventListener('mousedown', e => {
    if (e.button === 0) mouse.down0 = true;
    if (e.button === 2) mouse.down2 = true;
    SP.Audio.resume();
  });
  window.addEventListener('mouseup', e => {
    if (e.button === 0) mouse.down0 = false;
    if (e.button === 2) mouse.down2 = false;
  });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  window.addEventListener('mousemove', e => {
    if (locked) { mouse.dx += e.movementX || 0; mouse.dy += e.movementY || 0; }
    else {
      const nx = (e.clientX / window.innerWidth) * 2 - 1;
      const ny = -((e.clientY / window.innerHeight) * 2 - 1);
      mouse.dx += (nx - mouse.x) * window.innerWidth * .5;
      mouse.dy += -(ny - mouse.y) * window.innerHeight * .5;
      mouse.x = nx; mouse.y = ny;
      return;
    }
    mouse.x = 0; mouse.y = 0;
  });
  window.addEventListener('wheel', e => { mouse.wheel += e.deltaY; }, { passive: true });
  document.addEventListener('pointerlockchange', () => {
    locked = document.pointerLockElement === canvas;
    if (!locked && game.wantsPointer && game.state === 'play' && !game.paused && !SP.Editor.isOpen() && !game.ui.dialogOpen()) {
      game.pause(true);
    }
  });
  game.lockPointer = function (on) {
    if (on && canvas.requestPointerLock) { try { canvas.requestPointerLock(); } catch (e) { } }
    else if (!on && document.exitPointerLock) { try { document.exitPointerLock(); } catch (e) { } }
  };
  game.pointerLocked = function () { return locked; };

  /* ------------------------------------------------------------ 资源接口 */
  game.addDNA = function (n) {
    game.dna = Math.max(0, game.dna + n);
    game.ui.setDNA(game.dna);
    if (n > 0) { game.ui.flash('dna'); }
    return game.dna;
  };
  game.addMoney = function (n) {
    game.money = Math.max(0, game.money + n);
    game.ui.setMoney(game.money);
    return game.money;
  };
  game.unlockPart = function (id) {
    if (!G.PARTS[id] || game.unlockedParts[id]) return false;
    game.unlockedParts[id] = 1;
    SP.Audio.play('unlock');
    game.ui.toast('🧬 解锁新部件：<b>' + G.PARTS[id].ico + ' ' + G.PARTS[id].name + '</b>', 'good');
    return true;
  };

  /* ------------------------------------------------------------ UI / 编辑器 */
  const ui = new SP.UI(game);
  game.ui = ui;
  game.audio = SP.Audio;

  /* ------------------------------------------------------------ 阶段管理 */
  const stages = {};
  let cur = null;

  function clearScene() {
    for (let i = scene.children.length - 1; i >= 0; i--) {
      const o = scene.children[i];
      if (o === camera) continue;
      scene.remove(o);
      o.traverse && o.traverse(n => { if (n.geometry) n.geometry.dispose(); });
    }
    scene.fog = null;
    scene.background = null;
  }

  function switchStage(key, payload) {
    if (cur && cur.exit) { try { cur.exit(); } catch (e) { console.error('exit ' + game.stage, e); } }
    clearScene();
    /* 相机复位：阶段之间不能互相污染（例如某阶段把 far 调小会让下一阶段的远景被裁掉） */
    camera.fov = 60; camera.near = .05; camera.far = 20000;
    camera.up.set(0, 1, 0);
    camera.rotation.order = 'XYZ';
    camera.rotation.set(0, 0, 0);
    camera.position.set(0, 0, 0);
    camera.updateProjectionMatrix();
    renderer.setClearColor(0x05060f);
    renderer.toneMappingExposure = 1.06;
    cur = stages[key];
    game.stage = key;
    game.wantsPointer = false;
    ui.setStage(key);
    ui.setHud('');
    ui.refreshHud();
    ui.setActions([]);
    ui.setBars([]);
    ui.setCrosshair(false);
    SP.Audio.setMusic(DB.STAGES[key].music);
    if (!cur) { ui.toast('阶段模块缺失：' + key, 'bad'); return; }
    try { cur.enter(payload || {}); }
    catch (e) { console.error('enter ' + key, e); ui.toast('阶段初始化失败：' + e.message, 'bad'); }
  }
  game.switchStage = switchStage;

  game.advance = function (next, payload) {
    const badgeMap = { creature: 'land_fall', tribal: 'tribe_born', civ: 'city_born', space: 'space_born' };
    if (badgeMap[next]) ui.badge(badgeMap[next]);
    if (next === 'civ') ui.badge('chief');
    if (next === 'space') { ui.badge('world_ruler'); if (game.money < 100000) game.addMoney(100000 - game.money); }
    game.paused = true;
    game.lockPointer(false);
    ui.stageSplash(next, () => {
      game.paused = false;
      switchStage(next, payload || {});
      // 进入新阶段先给一次编辑器机会（细胞→生物 时把细胞基因转成生物）
      if (next === 'creature') {
        game.genome = G.newCreature(game.genome);
        DB.CREATURE.starterParts.forEach(p => game.unlockedParts[p] = 1);
        game.addDNA(60);
        ui.openEditor('creature', () => { });
      }
      game.save();
    });
  };
  game.win = function (payload) {
    ui.badge('center');
    game.paused = true;
    game.lockPointer(false);
    ui.dialog({
      title: '🌌 宇宙 的 答 案',
      body: '<p>你的飞船穿过了银河中心的重重封锁。黑洞的边缘，一个古老的存在向你递出了一件东西 —— ' +
        '<b>创生法杖（Staff of Life）</b>。</p><p>从一个漂浮在潮池里的单细胞，到掌握改造行星的力量，' +
        '你的物种 <b>' + (game.genome && game.genome.name || '无名') + '</b> 走完了整条演化之路。</p>' +
        '<p>徽章：<b>' + Object.keys(game.badges).length + ' / ' + DB.BADGES.length + '</b>　' +
        '游戏时长：<b>' + Math.floor(game.time / 60) + ' 分钟</b></p>' +
        '<p style="opacity:.75">你可以继续在银河中漫游，或回到主菜单开始一次全新的演化。</p>',
      buttons: [
        { label: '继续漫游', cb: () => { game.paused = false; } },
        { label: '回到主菜单', cb: () => location.reload() }
      ]
    });
  };
  game.die = function (title, body, reviveCb) {
    game.paused = true;
    game.lockPointer(false);
    ui.showDead(title, body, reviveCb);
  };

  /* ------------------------------------------------------------ 暂停 */
  game.pause = function (on) {
    if (game.state !== 'play') return;
    game.paused = on;
    ui.showPause(on);
    if (on) game.lockPointer(false);
    else if (game.wantsPointer) game.lockPointer(true);
  };

  /* ------------------------------------------------------------ 存档 */
  game.save = function () {
    if (game.state !== 'play') return;
    try {
      const d = {
        v: 1, t: Date.now(),
        stage: game.stage, dna: game.dna, money: game.money,
        genome: game.genome, badges: game.badges, unlockedParts: game.unlockedParts,
        design: game.design, time: game.time,
        data: (cur && cur.serialize) ? cur.serialize() : null
      };
      U.store.set(SAVE_KEY, JSON.stringify(d));
      ui.toast('💾 进度已保存', 'good');
    } catch (e) {
      console.error(e);
      ui.toast('保存失败：' + e.message, 'bad');
    }
  };
  function doLoad() {
    const raw = U.store.get(SAVE_KEY);
    if (!raw) return false;
    try {
      const d = JSON.parse(raw);
      game.dna = d.dna || 0;
      game.money = d.money || 0;
      game.genome = d.genome || G.newCell();
      game.badges = d.badges || {};
      game.unlockedParts = d.unlockedParts || {};
      game.design = d.design || {};
      game.time = d.time || 0;
      ui.setDNA(game.dna); ui.setMoney(game.money);
      switchStage(d.stage || 'cell', { loaded: true });
      if (d.data && cur && cur.deserialize) { try { cur.deserialize(d.data); } catch (e) { console.error('deserialize', e); } }
      ui.toast('💾 已读取存档（' + DB.STAGES[d.stage].name + '）', 'good');
      return true;
    } catch (e) {
      console.error('读档失败', e);
      ui.toast('存档损坏，开始新游戏', 'bad');
      return false;
    }
  }

  /* ------------------------------------------------------------ 载入流程 */
  const STEPS = [
    ['正在搅拌原始汤…', () => { SP.Tex.skin(30, 60, 50, 'spots'); SP.Tex.grass(1, 1); SP.Tex.dirt(1, 1); }],
    ['正在雕刻地貌…', () => { SP.Tex.sand(1, 1); SP.Tex.rock(1, 1); SP.Tex.snow(1, 1); SP.Tex.water(1, 1); SP.Tex.bark(1, 1); SP.Tex.wood(1, 1); }],
    ['正在锻造合金…', () => { SP.Tex.metal(1, 1); SP.Tex.hull(1, 1); SP.Tex.hologram(1, 1); SP.Tex.cloud(); SP.Tex.glow(); SP.Tex.star(); SP.Tex.nebula(); }],
    ['正在点亮恒星…', () => { ['lush', 'dry', 'ice', 'gas', 'rock'].forEach(k => SP.Tex.planet(k)); }],
    ['正在合成配乐…', () => { SP.Audio.init(); SP.Audio.startAmbient(); }],
    ['正在组装编辑器…', () => { SP.Editor.init(game); }],
    ['正在注册五个阶段…', () => {
      if (SP.StageCell) stages.cell = new SP.StageCell(game);
      if (SP.StageCreature) stages.creature = new SP.StageCreature(game);
      if (SP.StageTribal) stages.tribal = new SP.StageTribal(game);
      if (SP.StageCiv) stages.civ = new SP.StageCiv(game);
      if (SP.StageSpace) stages.space = new SP.StageSpace(game);
      const missing = DB.ORDER.filter(k => !stages[k]);
      if (missing.length) console.warn('缺失阶段模块：', missing.join(', '));
    }],
    ['演化即将开始。', () => { bindMenu(); }]
  ];
  let step = 0;
  function nextStep() {
    if (step >= STEPS.length) {
      ui.setLoading(100, '演化即将开始。');
      setTimeout(() => {
        ui.hideLoader();
        game.state = 'menu';
        ui.showMenu(true);
        const b = document.getElementById('btn-continue');
        if (!U.store.get(SAVE_KEY)) { b.disabled = true; b.title = '还没有存档'; }
        loop();
      }, 400);
      return;
    }
    const s = STEPS[step];
    ui.setLoading(step / STEPS.length * 100, s[0]);
    setTimeout(() => {
      try { s[1](); } catch (e) { console.error('载入步骤失败：' + s[0], e); }
      step++; nextStep();
    }, 40);
  }
  setTimeout(nextStep, 120);

  /* ------------------------------------------------------------ 菜单绑定 */
  function bindMenu() {
    const $ = (s) => document.getElementById(s);
    $('btn-new').addEventListener('click', () => { SP.Audio.play('ui_click'); startNew(); });
    $('btn-continue').addEventListener('click', () => {
      SP.Audio.play('ui_click');
      ui.showMenu(false); ui.showHud(true);
      game.state = 'play';
      SP.Audio.resume();
      if (!doLoad()) startNew();
    });
    $('btn-guide').addEventListener('click', () => { SP.Audio.play('ui_open'); $('guide').classList.toggle('hidden'); });
    $('btn-guide-close').addEventListener('click', () => { SP.Audio.play('ui_close'); $('guide').classList.add('hidden'); });
    $('btn-skip').addEventListener('click', () => { SP.Audio.play('ui_open'); $('skipbox').classList.toggle('hidden'); });
    $('btn-skip-close').addEventListener('click', () => { SP.Audio.play('ui_close'); $('skipbox').classList.add('hidden'); });
    document.querySelectorAll('#skipbox [data-stage]').forEach(b => b.addEventListener('click', () => {
      SP.Audio.play('ui_click');
      const k = b.dataset.stage;
      ui.showMenu(false); ui.showHud(true);
      game.state = 'play';
      SP.Audio.resume();
      game.genome = k === 'cell' ? G.newCell() : G.random('creature', 20260819);
      game.genome.name = G.randName(U.Rng(7));
      Object.keys(G.PARTS).forEach(p => game.unlockedParts[p] = 1);
      game.dna = 300;
      game.money = k === 'space' ? 100000 : k === 'civ' ? 4000 : 0;
      ui.setDNA(game.dna); ui.setMoney(game.money);
      switchStage(k, { debug: true });
    }));

    $('btn-resume').addEventListener('click', () => { SP.Audio.play('ui_click'); game.pause(false); });
    $('btn-save').addEventListener('click', () => { SP.Audio.play('ui_click'); game.save(); });
    $('btn-editor').addEventListener('click', () => {
      SP.Audio.play('ui_click');
      game.pause(false);
      ui.openEditor(game.stage === 'cell' ? 'cell' : 'creature', () => { });
    });
    $('btn-menu').addEventListener('click', () => { SP.Audio.play('ui_click'); game.save(); location.reload(); });
    $('btn-revive').addEventListener('click', () => {
      SP.Audio.play('ui_click');
      ui.hideDead();
      game.paused = false;
      if (ui._revive) ui._revive();
      if (game.wantsPointer) game.lockPointer(true);
    });

    const vol = $('opt-vol'), sens = $('opt-sens');
    vol.addEventListener('input', () => { game.settings.vol = vol.value / 100; SP.Audio.setVolume(game.settings.vol); });
    sens.addEventListener('input', () => { game.settings.sens = sens.value / 100; });
    SP.Audio.setVolume(game.settings.vol);
    document.addEventListener('mousedown', () => SP.Audio.resume(), { once: true });
    document.addEventListener('keydown', () => SP.Audio.resume(), { once: true });
  }

  function startNew() {
    ui.showMenu(false);
    ui.showHud(true);
    game.state = 'play';
    SP.Audio.resume();
    game.dna = 0; game.money = 0;
    game.badges = {}; game.unlockedParts = {}; game.design = {};
    game.genome = G.newCell();
    game.genome.name = G.randName(U.Rng(Math.floor(Math.random() * 1e6)));
    ui.setDNA(0); ui.setMoney(0);
    ui.stageSplash('cell', () => switchStage('cell', {}));
  }

  /* ------------------------------------------------------------ 主循环 */
  function loop() {
    requestAnimationFrame(loop);
    let dt = game.clock.getDelta();
    if (dt > .1) dt = .1;
    game.dt = dt;
    game.time += dt;

    SP.Audio.musicTick(dt);

    if (SP.Editor.isOpen()) {
      SP.Editor.update(dt);
      SP.Editor.render(renderer);
      mouse.dx = 0; mouse.dy = 0; mouse.wheel = 0;
      return;
    }

    if (game.state === 'play' && !game.paused && cur && cur.update) {
      try { cur.update(dt); }
      catch (e) {
        console.error('阶段 update 出错 [' + game.stage + ']', e);
        ui.toast('运行时错误：' + e.message, 'bad');
        game.paused = true;
      }
    }
    if (game.state === 'menu') {
      // 菜单背景：缓慢旋转的星空
      camera.position.set(Math.sin(game.time * .05) * 6, 2, Math.cos(game.time * .05) * 6);
      camera.lookAt(0, 0, 0);
    }
    renderer.render(scene, camera);
    mouse.dx = 0; mouse.dy = 0; mouse.wheel = 0;
  }
})();
