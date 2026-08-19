/* ==========================================================================
   RAFT SURVIVAL · game.js
   引擎装配 / 载入流程 / 主循环 / 任务系统 / 存档 / 暂停与睡眠
   ========================================================================== */
(function () {
  const U = RS.U, DB = RS.DB;
  const SAVE_KEY = 'raft_survival_save_v1';

  const game = {
    state: 'loading',      // loading | menu | play
    paused: false,
    time: 0,
    bus: U.Bus(),
    unlocked: {},
    quests: [],
    spawnBed: null,
    steering: false,
    settings: { vol: .7, sens: 1.0, fov: 76, quality: 'mid' }
  };
  RS.game = game;
  window.RAFT = game;

  if (THREE.ColorManagement) THREE.ColorManagement.legacyMode = false;

  /* ------------------------------------------------------------ 渲染器 */
  const canvas = document.getElementById('scene');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  if (THREE.sRGBEncoding !== undefined) renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  game.renderer = renderer;

  const scene = new THREE.Scene();
  game.scene = scene;
  const camera = new THREE.PerspectiveCamera(76, window.innerWidth / window.innerHeight, .08, 6000);
  scene.add(camera);
  game.camera = camera;

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  /* ------------------------------------------------------------ 载入流程 */
  const ui = new RS.UI(game);
  game.ui = ui;

  const STEPS = [
    ['正在生成程序化贴图…', () => { RS.Tex.plank(1, 1); RS.Tex.plankDark(1, 1); RS.Tex.plankLight(1, 1); RS.Tex.thatch(2, 2); RS.Tex.sail(1, 1); }],
    ['正在铺开海面…', () => { RS.Tex.sand(4, 4); RS.Tex.rock(1, 1); RS.Tex.bark(1, 3); RS.Tex.metal(1, 1); RS.Tex.barrel(1, 1); RS.Tex.waterDetail(9, 9); RS.Tex.leaf(); RS.Tex.cloud(); }],
    ['正在合成海浪与风声…', () => { RS.Audio.init(); }],
    ['正在升起太阳…', () => { game.world = new RS.World(game); }],
    ['正在捆扎木筏…', () => {
      game.inv = new RS.Inventory(game, 8, 24);
      game.raft = new RS.Raft(game);
      game.player = new RS.Player(game);
    }],
    ['正在放生鱼群…', () => {
      game.debris = new RS.Debris(game);
      game.sealife = new RS.SeaLife(game);
      game.islands = new RS.Islands(game);
    }],
    ['准备就绪。', () => {
      game.quests = DB.QUESTS.map(def => ({ def, prog: 0, done: false }));
      bindEvents();
      bindMenu();
    }]
  ];
  let step = 0;
  function nextStep() {
    if (step >= STEPS.length) {
      ui.setLoading(100, '准备就绪。');
      setTimeout(() => {
        ui.hideLoader();
        game.state = 'menu';
        ui.showMenu(true);
        const has = !!U.store.get(SAVE_KEY);
        const b = document.getElementById('btn-continue');
        if (!has) { b.disabled = true; b.title = '还没有存档'; }
        loop();
      }, 420);
      return;
    }
    const s = STEPS[step];
    ui.setLoading(step / STEPS.length * 100, s[0]);
    setTimeout(() => {
      try { s[1](); } catch (e) { console.error('载入步骤失败：' + s[0], e); }
      step++;
      nextStep();
    }, 40);
  }
  setTimeout(nextStep, 120);

  /* ------------------------------------------------------------ 任务系统 */
  function bump(track, n, absolute) {
    game.quests.forEach(q => {
      if (q.done || q.def.track !== track) return;
      q.prog = absolute ? n : q.prog + n;
      if (q.prog >= q.def.goal) {
        q.done = true;
        RS.Audio.play('unlock');
        ui.toast('✅ 目标完成：' + q.def.text, 'good');
      }
    });
  }
  function bindEvents() {
    game.bus.on('collect', (id, n) => bump('collect:' + id, n));
    game.bus.on('built', (id) => {
      bump('built:' + id, 1);
      bump('foundations', game.raft.countFoundations(), true);
    });
    game.bus.on('drink_fresh', () => bump('drink_fresh', 1));
    game.bus.on('eat_cooked', () => bump('eat_cooked', 1));
    game.bus.on('shark_repel', () => bump('shark_repel', 1));
    game.bus.on('research', () => bump('research', 1));
    game.bus.on('sail_up', () => bump('sail_up', 1));
    game.bus.on('island_visit', () => bump('island_visit', 1));
    game.bus.on('newday', (d) => {
      bump('days', d - 1, true);
      ui.toast('🌅 新的一天开始了（第 ' + d + ' 天）', '');
      autoSave();
    });
  }

  /* ------------------------------------------------------------ 菜单绑定 */
  function bindMenu() {
    document.getElementById('btn-new').addEventListener('click', () => { RS.Audio.play('ui_click'); startGame(false); });
    document.getElementById('btn-continue').addEventListener('click', () => { RS.Audio.play('ui_click'); startGame(true); });
    document.getElementById('btn-howto').addEventListener('click', () => {
      document.getElementById('howto').classList.toggle('hidden');
      RS.Audio.play('ui_open');
    });
    document.getElementById('btn-howto-close').addEventListener('click', () => {
      document.getElementById('howto').classList.add('hidden');
      RS.Audio.play('ui_close');
    });
    document.getElementById('btn-resume').addEventListener('click', () => { RS.Audio.play('ui_click'); game.pause(false); });
    document.getElementById('btn-save').addEventListener('click', () => { RS.Audio.play('ui_click'); game.save(); });
    document.getElementById('btn-quit').addEventListener('click', () => {
      RS.Audio.play('ui_click');
      game.save();
      location.reload();
    });
    document.getElementById('btn-respawn').addEventListener('click', () => {
      RS.Audio.play('ui_click');
      ui.hideDeath();
      game.player.respawn();
    });
    const vol = document.getElementById('vol'), fov = document.getElementById('fov'), sens = document.getElementById('sens');
    vol.addEventListener('input', () => { game.settings.vol = vol.value / 100; RS.Audio.setVolume(game.settings.vol); });
    fov.addEventListener('input', () => { game.settings.fov = +fov.value; camera.fov = +fov.value; camera.updateProjectionMatrix(); });
    sens.addEventListener('input', () => { game.settings.sens = sens.value / 100; });
    RS.Audio.setVolume(game.settings.vol);
    document.addEventListener('mousedown', () => RS.Audio.resume(), { once: true });
    document.addEventListener('keydown', () => RS.Audio.resume(), { once: true });
  }

  /* ------------------------------------------------------------ 开局 */
  function giveStarterKit() {
    // silent=true：初始物资不计入「打捞 N 木板」这类收集目标
    game.inv.add('hammer', 1, true);
    game.inv.add('hook', 1, true);
    game.inv.add('cup', 1, true);
    game.inv.add('plank', 6, true);
    game.inv.add('palm_leaf', 4, true);
    game.inv.add('fresh_water', 1, true);
    game.inv.add('cooked_herring', 1, true);
  }
  function startGame(load) {
    ui.showMenu(false);
    ui.showHud(true);
    game.state = 'play';
    RS.Audio.startAmbient();
    RS.Audio.resume();
    let ok = false;
    if (load) ok = doLoad();
    if (!ok) {
      game.raft.buildStarter();
      giveStarterKit();
      const sp = game.raft.spawnPoint();
      game.player.pos.set(sp.x, sp.y - 1.4, sp.z);   // spawnPoint 是视高，减去身高得到脚底
      game.player.vel.set(0, 0, 0);
      game.world.timeOfDay = 7.2; game.world.day = 1;
      ui.toast('🛶 你在一小块木筏上醒来。先用打捞钩捞点木板吧。', 'warn');
    }
    game.player.setActive(true);
    game.bus.emit('inv');
    ui.refreshStatus();
  }

  /* ------------------------------------------------------------ 暂停 / 睡眠 */
  game.pause = function (on) {
    if (game.state !== 'play') return;
    game.paused = on;
    ui.showPause(on);
    if (on) { game.player.setActive(false); ui.closeAll(true); }
    else if (!game.player.dead) game.player.setActive(true);
  };
  game.sleep = function (bed) {
    const p = game.player, W = game.world;
    const target = W.timeOfDay > 6 ? 24 + 6 : 6;
    const hours = target - W.timeOfDay;
    W.timeOfDay += hours;
    if (W.timeOfDay >= 24) { W.timeOfDay -= 24; W.day++; game.bus.emit('newday', W.day); }
    p.v.hunger = U.clamp(p.v.hunger - hours * 2.6, 0, 100);
    p.v.thirst = U.clamp(p.v.thirst - hours * 3.4, 0, 100);
    p.heal(hours * 3.5);
    p.effects.poison = 0;
    game.spawnBed = bed;
    ui.toast('🌅 你睡到了清晨（重生点已设在这张吊床）', 'good');
    RS.Audio.play('heal');
  };

  /* ------------------------------------------------------------ 存档 */
  game.save = function () {
    if (game.state !== 'play') return;
    try {
      const data = {
        v: 1, t: Date.now(),
        world: { tod: game.world.timeOfDay, day: game.world.day, weather: game.world.weather, wind: game.world.windDir },
        raft: game.raft.serialize(),
        player: game.player.serialize(),
        inv: game.inv.serialize(),
        unlocked: game.unlocked,
        quests: game.quests.map(q => ({ id: q.def.id, p: q.prog, d: q.done })),
        sea: game.sealife.serialize(),
        islands: game.islands.serialize(),
        debris: game.debris.serialize(),
        bed: game.spawnBed ? [game.spawnBed.cell.i, game.spawnBed.cell.j] : null
      };
      U.store.set(SAVE_KEY, JSON.stringify(data));
      ui.toast('💾 进度已保存', 'good');
      RS.Audio.play('ui_click');
    } catch (e) {
      console.error(e);
      ui.toast('保存失败：' + e.message, 'bad');
    }
  };
  let autoT = 0;
  function autoSave() { if (game.state === 'play' && !game.player.dead) game.save(); }

  function doLoad() {
    const raw = U.store.get(SAVE_KEY);
    if (!raw) return false;
    try {
      const d = JSON.parse(raw);
      game.world.timeOfDay = d.world.tod; game.world.day = d.world.day;
      game.world.weather = d.world.weather; game.world.windDir = d.world.wind;
      game.unlocked = d.unlocked || {};
      game.raft.deserialize(d.raft);
      game.inv.deserialize(d.inv);
      game.player.deserialize(d.player);
      game.sealife.deserialize(d.sea);
      game.debris.deserialize(d.debris || {});
      game.islands.update(0.001);
      game.islands.deserialize(d.islands);
      (d.quests || []).forEach(q => {
        const t = game.quests.find(x => x.def.id === q.id);
        if (t) { t.prog = q.p; t.done = q.d; }
      });
      if (d.bed) {
        const c = game.raft.get(d.bed[0], d.bed[1]);
        if (c && c.obj && c.obj.station === 'bed') game.spawnBed = c.obj;
      }
      ui.toast('💾 已读取上次的漂流进度', 'good');
      return true;
    } catch (e) {
      console.error('读档失败', e);
      ui.toast('存档损坏，开始新游戏', 'bad');
      return false;
    }
  }

  /* ------------------------------------------------------------ 主循环 */
  const clock = new THREE.Clock();
  let statusT = 0;
  function loop() {
    requestAnimationFrame(loop);
    let dt = clock.getDelta();
    if (dt > .1) dt = .1;

    if (game.state !== 'play' || game.paused) {
      // 菜单里也让海面动起来，作为背景
      if (game.world) {
        game.time += dt;
        game.world.update(dt, camera.position);
        if (game.state === 'menu') {
          camera.position.set(Math.sin(game.time * .06) * 14, 3.2 + Math.sin(game.time * .5) * .25, Math.cos(game.time * .06) * 14);
          camera.lookAt(0, 1.4, 0);
        }
      }
      renderer.render(scene, camera);
      return;
    }

    game.time += dt;
    autoT += dt;
    if (autoT > 180) { autoT = 0; autoSave(); }

    game.world.update(dt, camera.position);
    game.raft.update(dt);
    game.player.update(dt);
    game.debris.update(dt);
    game.sealife.update(dt);
    game.islands.update(dt);
    ui.updateBuildGhost();
    ui.update(dt);

    statusT += dt;
    if (statusT > 1) { statusT = 0; ui.refreshStatus(); }

    /* 镜头震动 */
    if (ui.shake > 0.001) {
      const s = ui.shake;
      camera.position.x += U.rand(-1, 1) * s * .10;
      camera.position.y += U.rand(-1, 1) * s * .10;
      camera.rotation.z += U.rand(-1, 1) * s * .022;
      ui.shake = Math.max(0, s - dt * 2.2);
    }

    renderer.render(scene, camera);
  }

  /* 让 world.js 在天气切换时能安全调用 ui */
  if (!game.ui) game.ui = ui;
})();
