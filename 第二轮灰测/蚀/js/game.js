/* ===================================================================
   game.js — 主循环 / 状态机 / 输入 / Roguelite 流程
   流程：标题 → 层间简报 → 战斗 → (烙印/清场/Boss) → 传送门 → 遗物选择
        → … → 深度 XII Boss → 胜利 ／ 死亡 → 重开
   =================================================================== */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const U = G.U, M4 = G.M4;

  const MAX_DEPTH = 12;
  const SAVE_KEY = 'eclipse_blade_meta_v1';
  const OPT_KEY = 'eclipse_blade_opts_v1';

  const Game = {
    state: 'boot',          // boot|title|help|creed|brief|playing|upgrade|dead|win|pause
    prevState: null,
    map: null, levelMesh: null,
    depth: 1, seed: 0,
    time: 0, runTime: 0,
    last: 0, raf: 0,
    timeScale: 1, hitStopT: 0, flash: 0,
    shakeAmp: 0, shakeT: 0, shakeX: 0, shakeY: 0, shakeR: 0,
    objectiveText: '', themeName: '', marker: null,
    brandTaken: false, portalOpened: false,
    rerollCost: 15, cards: [],
    rng: new U.Rng(Date.now()),
    meta: { bestDepth: 0, totalKills: 0, wins: 0, runs: 0, totalGibs: 0 },
    opts: { shake: true, blood: true, hitstop: true, sens: 100, pix: 3 },
    input: {
      fwd: 0, back: 0, left: 0, right: 0, jump: false, dash: false,
      attack: false, heavy: false, berserk: false, use: false,
      mdx: 0, mdy: 0, _mdx: 0, _mdy: 0, locked: false,
    },
    keys: {},
    fps: 60, _fpsT: 0, _fpsN: 0,
    aimHot: false,
    shrineNear: null, portalNear: false,
    pendingShrineRelic: false,
  };

  /* =============================== 启动 =============================== */
  Game.boot = function () {
    const glCanvas = document.getElementById('glcanvas');
    const fxCanvas = document.getElementById('fxcanvas');

    Game.loadOpts();
    Game.loadMeta();

    G.UI.init(Game);
    G.UI.applyOpts(Game.opts);
    G.UI.setLoading('正在锻造巨剑…');

    // 纹理图集
    const atlas = G.Art.buildAtlas();

    if (!G.GL.init(glCanvas)) {
      G.UI.setLoading('你的浏览器不支持 WebGL —— 无法进入日蚀。请更换现代浏览器。');
      return;
    }
    G.GL.uploadAtlas(atlas);
    G.GL.setDitherTile(G.Art.ditherUV[0], G.Art.ditherUV[1]);
    G.GL.setPixelScale(Game.opts.pix);

    G.Render.init(fxCanvas);
    G.Player.init(Game);

    Game.bindInput(glCanvas, fxCanvas);

    window.addEventListener('resize', () => {
      G.GL.resize();
      G.Render.resizeFx();
    });

    G.UI.hideLoading();
    G.UI.updateMeta(Game.meta);
    Game.setState('title');

    Game.last = U.now();
    Game.raf = requestAnimationFrame(Game.loop);
    Game.devSetup();
  };

  /* =============================== 开发/截图钩子 =============================== */
  // 用 ?dev=1 直接进入战斗（跳过标题与简报）；?dev=2 额外在面前刷一群怪并预热血肉
  Game.dev = (function () {
    try {
      const q = new URLSearchParams(window.location.search);
      const lvl = parseInt(q.get('dev') || '0', 10) || 0;
      return {
        level: lvl,
        depth: U.clamp(parseInt(q.get('depth') || '1', 10) || 1, 1, MAX_DEPTH),
        pix: q.get('pix') ? parseInt(q.get('pix'), 10) : null,
        nohud: q.get('nohud') === '1',
        yaw: q.get('yaw') !== null ? parseFloat(q.get('yaw')) : null,
        pose: q.get('pose'),
      };
    } catch (e) { return { level: 0, depth: 1, pix: null }; }
  })();

  Game.devSetup = function () {
    const d = Game.dev;
    if (!d.level) return;
    if (d.pix) { Game.opts.pix = d.pix; G.GL.setPixelScale(d.pix); }
    Game.startRun(d.depth);
    Game.setState('playing');
    G.UI.showClickLock(false);
    if (d.nohud) G.UI.setHud(false);
    if (d.yaw !== null && isFinite(d.yaw)) G.Player.yaw = d.yaw;
    if (d.pose) {
      const P = G.Player;
      const map = { idle: ['idle', 0], wind: ['wind', 0.5], swing: ['swing', 0.42], hv: ['hvWind', 0.9], slam: ['slam', 0.45] };
      const m = map[d.pose];
      if (m) { P.wState = m[0]; P.wDur = 0.2; P.wT = 0.2 * m[1]; P.charge = 0.9; }
    }
    if (d.level >= 2) {
      const P = G.Player, map = Game.map;
      // 面前刷一圈怪
      const types = ['ghoul', 'ghoul', 'hound', 'brute', 'cultist', 'wraith'];
      let placed = 0;
      for (let i = 0; i < 30 && placed < 6; i++) {
        const a = P.yaw + (Math.random() - 0.5) * 1.5;
        const r = 3.2 + Math.random() * 4;
        const x = P.x + U.fwdX(a) * r, z = P.z + U.fwdZ(a) * r;
        if (map.isSolidAt(x, z)) continue;
        const e = G.Entities.spawn(types[placed], x, z, { depth: Game.depth, elite: placed === 3 });
        e.seen = true; e.state = 'chase';
        placed++;
      }
      // 预热血肉：撒一些血迹与肢块，方便截图确认
      for (let i = 0; i < 26; i++) {
        const a = Math.random() * U.TAU, r = Math.random() * 5;
        const x = P.x + Math.cos(a) * r, z = P.z + Math.sin(a) * r;
        if (map.isSolidAt(x, z)) continue;
        G.Gore.addDecal(x, z, 0.7 + Math.random() * 1.4, 0.9);
      }
      for (let i = 0; i < 40; i++) {
        const a = Math.random() * U.TAU, r = 1 + Math.random() * 3;
        G.Gore.chunk(P.x + Math.cos(a) * r, 0.2 + Math.random() * 1.2, P.z + Math.sin(a) * r,
          0.05 + Math.random() * 0.07, 0.05 + Math.random() * 0.07, 0.05 + Math.random() * 0.07,
          [0.45 + Math.random() * 0.3, 0.06, 0.07], (Math.random() - 0.5) * 3, Math.random() * 3, (Math.random() - 0.5) * 3, 'flesh');
      }
      G.Gore.spray(P.x + U.fwdX(P.yaw) * 2.4, 1.2, P.z + U.fwdZ(P.yaw) * 2.4, U.fwdX(P.yaw), 0.6, U.fwdZ(P.yaw), 40, 3);
      G.Gore.screenSplat(8, 1);
      // 让巨剑停在挥砍中段
      G.Player.wState = 'swing'; G.Player.wT = 0.055; G.Player.wDur = 0.135;
      G.Player.swingKind = 'R'; G.Player.combo = 7; G.Player.comboT = 3;
      G.Player.bladeBlood = 0.85;
      for (let i = 0; i < 8; i++) {
        G.Player.trail.push({
          x: G.Player.tipX, y: G.Player.tipY, z: G.Player.tipZ,
          x2: G.Player.midX, y2: G.Player.midY, z2: G.Player.midZ, t: 0.16, t0: 0.16,
        });
      }
    }
  };

  /* =============================== 存档 =============================== */
  Game.loadMeta = function () {
    try {
      const s = localStorage.getItem(SAVE_KEY);
      if (s) Object.assign(Game.meta, JSON.parse(s));
    } catch (e) { }
  };
  Game.saveMeta = function () {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(Game.meta)); } catch (e) { }
  };
  Game.loadOpts = function () {
    try {
      const s = localStorage.getItem(OPT_KEY);
      if (s) Object.assign(Game.opts, JSON.parse(s));
    } catch (e) { }
  };
  Game.saveOpts = function () {
    try { localStorage.setItem(OPT_KEY, JSON.stringify(Game.opts)); } catch (e) { }
  };

  /* =============================== 输入 =============================== */
  Game.bindInput = function (glCanvas, fxCanvas) {
    const I = Game.input;

    const KEYMAP = {
      KeyW: 'fwd', ArrowUp: 'fwd', KeyS: 'back', ArrowDown: 'back',
      KeyA: 'left', KeyD: 'right',
    };

    window.addEventListener('keydown', ev => {
      if (ev.code === 'F5' || ev.code === 'F11' || ev.code === 'F12') return;
      Game.keys[ev.code] = true;
      if (KEYMAP[ev.code]) { I[KEYMAP[ev.code]] = 1; ev.preventDefault(); }
      switch (ev.code) {
        case 'Space': I.jump = true; ev.preventDefault(); break;
        case 'ShiftLeft': case 'ShiftRight': I.dash = true; break;
        case 'KeyF': I.berserk = true; break;
        case 'KeyE': I.use = true; break;
        case 'Escape':
          if (Game.state === 'playing') Game.pause();
          else if (Game.state === 'pause') Game.act('resume');
          break;
        case 'KeyR':
          if (Game.state === 'dead') Game.act('restart');
          break;
        case 'Enter':
          if (Game.state === 'brief') Game.act('descend');
          else if (Game.state === 'title') Game.act('start');
          break;
      }
    });
    window.addEventListener('keyup', ev => {
      Game.keys[ev.code] = false;
      if (KEYMAP[ev.code]) I[KEYMAP[ev.code]] = 0;
      switch (ev.code) {
        case 'Space': I.jump = false; break;
        case 'ShiftLeft': case 'ShiftRight': I.dash = false; break;
        case 'KeyF': I.berserk = false; break;
        case 'KeyE': I.use = false; break;
      }
    });

    // 鼠标
    const onMove = ev => {
      if (!I.locked || Game.state !== 'playing') return;
      const s = (Game.opts.sens / 100) * 0.0022;
      // 单次事件与单帧累计都设上限：某些驱动/切换焦点时会给出离谱的 movement 值
      const mx = U.clamp(ev.movementX || 0, -350, 350);
      const my = U.clamp(ev.movementY || 0, -350, 350);
      I._mdx = U.clamp(I._mdx + mx * s, -1.2, 1.2);
      I._mdy = U.clamp(I._mdy + my * s, -1.2, 1.2);
    };
    document.addEventListener('mousemove', onMove);

    const lockTarget = document.getElementById('app');
    const requestLock = () => {
      if (Game.state !== 'playing') return;
      const el = glCanvas;
      if (el.requestPointerLock) el.requestPointerLock();
    };
    document.addEventListener('pointerlockchange', () => {
      const wasLocked = I.locked;
      I.locked = (document.pointerLockElement === glCanvas);
      // 刚锁定时清零：浏览器可能给出一个巨大的首帧 movement 值
      if (I.locked && !wasLocked) { I._mdx = 0; I._mdy = 0; I.mdx = 0; I.mdy = 0; }
      G.UI.showClickLock(Game.state === 'playing' && !I.locked);
      if (!I.locked && Game.state === 'playing') Game.pause();
    });

    const clickLock = document.getElementById('click-lock');
    if (clickLock) clickLock.addEventListener('click', () => { requestLock(); });

    glCanvas.addEventListener('mousedown', ev => {
      G.Audio.init(); G.Audio.resume();
      if (Game.state === 'playing' && !I.locked) { requestLock(); return; }
      if (Game.state !== 'playing') return;
      if (ev.button === 0) I.attack = true;
      if (ev.button === 2) I.heavy = true;
      ev.preventDefault();
    });
    window.addEventListener('mouseup', ev => {
      if (ev.button === 0) I.attack = false;
      if (ev.button === 2) I.heavy = false;
    });
    window.addEventListener('contextmenu', ev => {
      if (Game.state === 'playing') ev.preventDefault();
    });
    window.addEventListener('blur', () => {
      I.fwd = I.back = I.left = I.right = 0;
      I.attack = I.heavy = I.jump = I.dash = false;
      if (Game.state === 'playing') Game.pause();
    });
    Game.requestLock = requestLock;
  };

  /* =============================== 状态 =============================== */
  Game.setState = function (s) {
    Game.prevState = Game.state;
    Game.state = s;
    switch (s) {
      case 'title':
        G.UI.show('title'); G.UI.updateMeta(Game.meta);
        G.UI.bossBar(null); G.UI.hint(null);
        G.Audio.stopAmbience();
        break;
      case 'help': G.UI.show('help'); break;
      case 'creed': G.UI.show('creed'); break;
      case 'brief': G.UI.show('brief'); break;
      case 'upgrade': G.UI.show('upgrade'); break;
      case 'dead': G.UI.show('dead'); break;
      case 'win': G.UI.show('win'); break;
      case 'pause': G.UI.showPause(); break;
      case 'playing':
        G.UI.show(null);
        G.UI.showClickLock(!Game.input.locked);
        // 丢掉在菜单/暂停期间积累的鼠标位移，否则回到战斗的第一帧会被
        // 一次性巨量 delta 甩到最大俯角（看起来就是视角卡在脚下）
        Game.input._mdx = 0; Game.input._mdy = 0;
        Game.input.mdx = 0; Game.input.mdy = 0;
        break;
    }
    if (s !== 'playing' && document.pointerLockElement) {
      if (document.exitPointerLock) document.exitPointerLock();
    }
  };

  Game.pause = function () {
    if (Game.state !== 'playing') return;
    Game.setState('pause');
  };

  /* =============================== 按钮动作 =============================== */
  Game.act = function (name) {
    switch (name) {
      case 'start':
        G.Audio.init(); G.Audio.resume();
        Game.startRun();
        break;
      case 'help':
        Game._helpFrom = Game.state;
        Game.setState('help');
        break;
      case 'creed': Game.setState('creed'); break;
      case 'back':
        if (Game._helpFrom === 'pause') Game.setState('pause');
        else Game.setState('title');
        break;
      case 'descend':
        Game.setState('playing');
        Game.requestLock();
        break;
      case 'resume':
        Game.setState('playing');
        Game.requestLock();
        break;
      case 'abandon':
        Game.endRun(false, true);
        break;
      case 'restart':
        Game.startRun();
        break;
      case 'title':
        Game.setState('title');
        break;
      case 'reroll': {
        if (G.Player.souls < Game.rerollCost) return;
        G.Player.souls -= Game.rerollCost;
        Game.rerollCost = Math.round(Game.rerollCost * 1.6);
        Game.rollCards();
        break;
      }
    }
  };

  /* =============================== 跑关流程 =============================== */
  Game.startRun = function (depthOverride) {
    Game.seed = (Math.random() * 1e9) | 0;
    Game.rng = new U.Rng(Game.seed);
    Game.depth = 1;
    Game.runTime = 0;
    Game.rerollCost = 15;
    G.Player.newRun();
    G.Gore.totalGibs = 0;
    Game.meta.runs = (Game.meta.runs || 0) + 1;
    Game.saveMeta();
    Game.enterDepth(depthOverride || 1);
  };

  Game.enterDepth = function (d) {
    Game.depth = d;
    G.UI.setLoading('深度 ' + U.roman(d) + ' —— 正在挖开血肉…');

    const map = G.Mapgen.generate(d, Game.seed + d * 977);
    Game.map = map;
    Game.themeName = map.theme.name;

    // 静态几何
    if (Game.levelMesh) G.GL.free(Game.levelMesh);
    Game.levelMesh = G.GL.mesh(map.meshB);
    map.meshB = null;

    // 系统绑定
    G.Gore.bind(map);
    G.Entities.reset();
    G.Entities.ctx = { map: map, player: G.Player, game: Game };
    G.Render.pops.length = 0;

    // 敌人
    for (const s of map.enemySpawns) {
      G.Entities.spawn(s.type, s.x + 0.0, s.z, {
        depth: d, elite: s.elite, carriesBrand: s.carriesBrand,
      });
    }
    if (map.bossSpawn) {
      const b = G.Entities.spawn(map.bossSpawn.type, map.bossSpawn.x, map.bossSpawn.z, { depth: d });
      b.seen = false;
    }
    for (const it of map.itemSpawns) {
      G.Entities.spawnItem(it.kind, it.x, it.z, { value: it.value });
    }

    // 玩家
    G.Player.placeOn(map);
    Game.brandTaken = false;
    Game.portalOpened = false;
    map.exit.open = false;
    Game.updateObjective();

    G.Audio.startAmbience(d);
    G.UI.hideLoading();
    G.UI.updateRelics();
    G.UI.bossBar(null);
    G.UI.showBrief(d, map.theme, Game.objectiveText, !!map.isBoss);
    Game.setState('brief');
  };

  Game.updateObjective = function () {
    const map = Game.map;
    if (!map) return;
    const o = map.objective;
    if (o.type === 'boss') {
      const b = G.Entities.boss();
      Game.objectiveText = b ? ('杀死 ' + b.name) : '踏入传送门';
      Game.marker = b ? { x: b.x, y: b.y + b.height * 0.8, z: b.z } : portalMarker();
    } else if (o.type === 'clear') {
      const n = G.Entities.aliveCount();
      if (n > 0) {
        Game.objectiveText = '肃清此层 —— 剩余 ' + n + ' 个';
        Game.marker = null;
      } else {
        Game.objectiveText = '踏入传送门';
        Game.marker = portalMarker();
      }
    } else {
      if (!Game.brandTaken) {
        let carrier = null;
        for (const e of G.Entities.list) if (e.carriesBrand && e.alive && !e.removeMe) carrier = e;
        let brandItem = null;
        for (const it of G.Entities.items) if (it.kind === 'brand' && it.alive) brandItem = it;
        if (carrier) {
          Game.objectiveText = '夺取猩红烙印 —— 它在一个精英身上';
          Game.marker = { x: carrier.x, y: carrier.y + carrier.height, z: carrier.z };
        } else if (brandItem) {
          Game.objectiveText = '拾取掉落的猩红烙印';
          Game.marker = { x: brandItem.x, y: brandItem.y + 0.4, z: brandItem.z };
        } else {
          Game.objectiveText = '踏入传送门';
          Game.marker = portalMarker();
        }
      } else {
        Game.objectiveText = '踏入传送门';
        Game.marker = portalMarker();
      }
    }
  };
  function portalMarker() {
    const map = Game.map;
    if (!map) return null;
    return { x: map.exit.x, y: map.floorAt(map.exit.x, map.exit.z) + 1.3, z: map.exit.z };
  }

  Game.openPortal = function () {
    if (Game.portalOpened) return;
    Game.portalOpened = true;
    Game.map.exit.open = true;
    G.Audio.play('portal');
    Game.toast('传 送 门 已 开', 'gold');
    Game.flash = 0.5;
    Game.updateObjective();
  };

  Game.descend = function () {
    const next = Game.depth + 1;
    if (Game.depth >= MAX_DEPTH) { Game.endRun(true); return; }
    // 先给遗物，再进下一层
    Game.pendingDepth = next;
    Game.rollCards();
    Game.setState('upgrade');
  };

  Game.rollCards = function () {
    const P = G.Player;
    Game.cards = G.Relics.roll(3, Game.rng, P.relics, Game.depth, P.stats.luck);
    G.UI.showUpgrade(Game.cards, P.souls, Game.rerollCost, (r) => {
      P.addRelic(r);
      G.UI.updateRelics();
      Game.toast('获得遗物：' + r.name, 'gold');
      if (Game.pendingShrineRelic) {
        Game.pendingShrineRelic = false;
        Game.setState('playing');
        Game.requestLock();
      } else {
        Game.enterDepth(Game.pendingDepth);
      }
    });
  };

  Game.endRun = function (won, abandoned) {
    const P = G.Player;
    Game.meta.bestDepth = Math.max(Game.meta.bestDepth || 0, Game.depth);
    Game.meta.totalKills = (Game.meta.totalKills || 0) + P.kills;
    Game.meta.totalGibs = (Game.meta.totalGibs || 0) + G.Gore.totalGibs;
    if (won) Game.meta.wins = (Game.meta.wins || 0) + 1;
    Game.saveMeta();
    G.Audio.stopAmbience();
    G.Audio.setBerserk(false);

    const info = {
      depth: Game.depth, themeName: Game.themeName,
      kills: P.kills, bestCombo: P.bestCombo, damage: P.totalDamage,
      gibs: G.Gore.totalGibs, relics: P.relics.length,
      time: fmtTime(Game.runTime),
    };
    if (won) { G.Audio.play('victory'); G.UI.showWin(info); Game.setState('win'); }
    else if (abandoned) { Game.setState('title'); }
    else { G.Audio.play('death'); G.UI.showDead(info); Game.setState('dead'); }
  };

  function fmtTime(s) {
    const m = (s / 60) | 0, ss = (s % 60) | 0;
    return m + ':' + U.pad(ss, 2);
  }

  /* =============================== 回调 =============================== */
  Game.toast = function (t, kind) { G.UI.toast(t, kind); };

  Game.shake = function (amp, time) {
    if (!Game.opts.shake) return;
    Game.shakeAmp = Math.max(Game.shakeAmp, amp);
    Game.shakeT = Math.max(Game.shakeT, time);
  };
  Game.hitStop = function (t) {
    if (!Game.opts.hitstop) return;
    // 硬上限：任何单次顿帧都不能超过 0.16s，避免被反复续期后卡成慢动作
    Game.hitStopT = Math.min(0.16, Math.max(Game.hitStopT, t));
  };
  Game.slowmo = function (scale, time) {
    Game.timeScale = Math.min(Game.timeScale, scale);
    Game.slowT = Math.max(Game.slowT || 0, time);
  };

  Game.onHit = function (e, dmg, crit, heavy, killed) {
    const P = G.Player;
    G.UI.hitmark();
    Game.flash = Math.max(Game.flash, heavy ? 0.12 : 0.06);
    const hy = e.y + e.height * 0.75;
    if (!killed) {
      G.Render.pop(e.x, hy, e.z, (crit ? '✹' : '') + Math.round(dmg), crit ? 'crit' : 'dmg');
    }
    // 命中时敌人短暂静止 → 打击感
    e.hitStop = heavy ? 0.10 : 0.05;
  };

  Game.onDismember = function (e, part) {
    Game.shake(0.3, 0.16);
    if (part === 'head') {
      Game.toast('斩 首', 'big');
      Game.slowmo(0.35, 0.22);
    }
  };

  Game.onEnemyKilled = function (e, overkill) {
    const P = G.Player;
    P.kills++;
    const st = P.stats;

    if (st.killHeal > 0) P.heal(st.killHeal, true);
    if (st.gibHeal > 0) P.heal(P.maxHp * st.gibHeal, true);
    P.rage = Math.min(P.maxRage, P.rage + 12 * st.rageGain);
    if (P.berserk > 0) P.berserk = Math.min(P.berserkMax, P.berserk + 0.7);

    Game.shake(e.boss ? 1.2 : (overkill ? 0.6 : 0.36), e.boss ? 0.6 : 0.2);
    Game.hitStop(e.boss ? 0.22 : (overkill ? 0.13 : 0.08));
    const dist = U.dist(P.x, P.z, e.x, e.z);
    if (dist < 4.5 && Game.opts.blood) G.Gore.screenSplat(4 + (6 - dist | 0) * 2, 1.2);

    // 高连斩 / 处刑：短暂慢放
    if (overkill || P.combo >= 8 || e.boss) Game.slowmo(e.boss ? 0.25 : 0.42, e.boss ? 0.8 : 0.2);

    const words = ['撕 碎', '碎 肉', '断 骨', '爆 开', '开 膛'];
    G.Render.pop(e.x, e.y + e.height * 0.8, e.z,
      P.combo >= 6 ? (P.combo + ' 连 · ' + U.pick(words, Game.rng)) : U.pick(words, Game.rng), 'kill');

    // 血肉炸弹
    if (st.explodeOnKill > 0) {
      const r = 3.2 + st.explodeOnKill * 0.7;
      G.Gore.spray(e.x, e.y + e.height * 0.5, e.z, 0, 1, 0, 30, 3.6);
      for (let i = 0; i < 20; i++) {
        const a = Math.random() * U.TAU;
        G.Gore.drop(e.x, e.y + 0.6, e.z, Math.cos(a) * 9, 3 + Math.random() * 4, Math.sin(a) * 9, 0.06);
      }
      G.Audio.play('gib', { x: e.x, z: e.z });
      Game.shake(0.5, 0.25);
      for (const o of G.Entities.list) {
        if (o.removeMe || !o.alive || o === e) continue;
        const d = U.dist(o.x, o.z, e.x, e.z);
        if (d > r) continue;
        const dx = (o.x - e.x) / (d || 1), dz = (o.z - e.z) / (d || 1);
        G.Entities.hurt(o, 26 * st.explodeOnKill * st.dmg, {
          dirX: dx, dirZ: dz, heavy: true, hitId: -Math.random(),
        });
      }
    }

    // 目标推进
    if (e.boss) {
      Game.toast(e.name + ' 已 死', 'big');
      Game.openPortal();
      G.UI.bossBar(null);
      if (Game.depth >= MAX_DEPTH) {
        setTimeout(() => { if (Game.state === 'playing') Game.endRun(true); }, 2600);
      }
    }
    Game.updateObjective();
    if (Game.map && Game.map.objective.type === 'clear' && G.Entities.aliveCount() === 0) Game.openPortal();
  };

  Game.onBossPhase = function (e) {
    Game.toast(e.name + ' —— 第 ' + U.roman(e.phase) + ' 相', 'big');
    Game.shake(1.0, 0.5);
    Game.flash = 0.4;
    Game.slowmo(0.5, 0.5);
  };

  Game.onPickup = function (it) {
    const P = G.Player;
    if (it.kind === 'soul') {
      const n = Math.max(1, Math.round(it.value * P.stats.soulMul));
      P.souls += n;
      G.Audio.play('soul');
    } else if (it.kind === 'heart') {
      P.heal(26);
      G.Audio.play('pickup');
    } else if (it.kind === 'brand') {
      Game.brandTaken = true;
      G.Audio.play('pickup');
      Game.toast('取 得 猩 红 烙 印', 'gold');
      Game.openPortal();
    }
    Game.updateObjective();
  };

  Game.onPlayerHurt = function (d, kind) {
    Game.flash = Math.max(Game.flash, 0.1);
  };

  Game.onPlayerDeath = function () {
    G.Audio.play('death');
    Game.slowmo(0.18, 2.2);
    Game.shake(1.4, 0.9);
    G.Gore.screenSplat(26, 2.2);
    setTimeout(() => { if (Game.state === 'playing') Game.endRun(false); }, 1900);
  };

  /* =============================== 交互 =============================== */
  function updateInteract() {
    const P = G.Player, map = Game.map;
    if (!map) return;
    let hint = null;
    Game.portalNear = false;
    Game.shrineNear = null;

    // 传送门
    const dP = U.dist(P.x, P.z, map.exit.x, map.exit.z);
    if (dP < 1.9) {
      if (map.exit.open) {
        Game.portalNear = true;
        hint = 'E — 前往深度 ' + U.roman(Game.depth + 1) + (Game.depth >= MAX_DEPTH ? '（最终）' : '');
        if (Game.depth >= MAX_DEPTH) hint = 'E — 结束这一切';
      } else {
        hint = '传送门尚未开启 —— ' + Game.objectiveText;
      }
    }

    // 血祭坛
    for (const s of map.shrines) {
      if (s.used) continue;
      if (U.dist(P.x, P.z, s.x, s.z) < 1.7) {
        Game.shrineNear = s;
        const offer = G.Relics.shrineOffer(s.shrineType, Game.rng, P);
        s._offer = offer;
        hint = 'E — ' + offer.title + '：' + offer.text;
        break;
      }
    }

    G.UI.hint(hint);

    if (Game.input.use) {
      Game.input.use = false;
      if (Game.portalNear && map.exit.open) {
        G.Audio.play('portal');
        Game.flash = 0.7;
        if (Game.depth >= MAX_DEPTH) Game.endRun(true);
        else Game.descend();
        return;
      }
      const s = Game.shrineNear;
      if (s && s._offer) {
        const o = s._offer;
        if (!o.can(P)) { Game.toast('祭坛没有回应', 'normal'); return; }
        s.used = true;
        G.Audio.play('relic');
        Game.flash = 0.35;
        if (o.type === 'heal') { P.souls -= o.cost; P.heal(P.maxHp * 0.45); }
        else if (o.type === 'souls') { P.hp = Math.max(1, P.hp * 0.75); P.souls += 60; Game.toast('+60 魂', 'gold'); }
        else {
          P.stats.maxHp *= 0.7; P.maxHp = Math.round(P.maxHp * 0.7);
          P.hp = Math.min(P.hp, P.maxHp);
          Game.pendingShrineRelic = true;
          Game.rollCards();
          Game.setState('upgrade');
        }
      }
    }
  }

  /* =============================== 主循环 =============================== */
  Game.loop = function (ts) {
    Game.raf = requestAnimationFrame(Game.loop);
    const now = ts || U.now();
    let dtReal = (now - Game.last) / 1000;
    Game.last = now;
    if (!(dtReal > 0)) dtReal = 0.016;
    dtReal = Math.min(dtReal, 0.05);

    Game._fpsN++; Game._fpsT += dtReal;
    if (Game._fpsT > 0.5) { Game.fps = Game._fpsN / Game._fpsT; Game._fpsT = 0; Game._fpsN = 0; }

    // 时间缩放：顿帧 / 慢放
    let dt = dtReal;
    if (Game.hitStopT > 0) {
      Game.hitStopT -= dtReal;
      dt = dtReal * 0.055;
    } else {
      if (Game.slowT > 0) { Game.slowT -= dtReal; }
      else Game.timeScale = U.damp(Game.timeScale, 1, 6, dtReal);
      dt = dtReal * Game.timeScale;
    }
    Game.time += dtReal;

    if (Game.state === 'playing') {
      Game.runTime += dtReal;
      Game.step(dt, dtReal);
    } else if (Game.state === 'pause' || Game.state === 'brief' || Game.state === 'upgrade' ||
      Game.state === 'dead' || Game.state === 'win') {
      // 暂停时仍然渲染世界作为背景
      if (Game.map) {
        G.Render.frame(Game.viewState());
      }
    }

    // 衰减
    Game.flash = Math.max(0, Game.flash - dtReal * 3.2);
  };

  Game.step = function (dt, dtReal) {
    const I = Game.input, P = G.Player;
    const map = Game.map;
    if (!map) return;

    // 鼠标增量（每帧消费一次）
    I.mdx = I._mdx; I.mdy = I._mdy;
    I._mdx = 0; I._mdy = 0;

    const ctx = { map: map, player: P, game: Game, dtReal: dtReal };
    G.Entities.ctx = ctx;

    P.update(dt, I, ctx);
    I.jump = false;          // 跳跃为按下触发
    I.berserk = false;

    G.Entities.update(dt, ctx);
    G.Gore.update(dt, map);
    G.Render.updatePops(dt);

    // 摄像机震动
    if (Game.shakeT > 0) {
      Game.shakeT -= dtReal;
      const a = Game.shakeAmp * U.clamp01(Game.shakeT / 0.25);
      const t = Game.time * 47;
      Game.shakeX = Math.sin(t) * a + Math.sin(t * 2.7) * a * 0.5;
      Game.shakeY = Math.cos(t * 1.3) * a + Math.sin(t * 3.1) * a * 0.4;
      Game.shakeR = Math.sin(t * 0.9) * a * 0.02;
      if (Game.shakeT <= 0) { Game.shakeAmp = 0; Game.shakeX = Game.shakeY = Game.shakeR = 0; }
    }

    // 听者
    G.Audio.setListener(P.x, P.z, P.yaw);

    // 心跳
    if (P.hp / P.maxHp < 0.3) {
      Game._heartT = (Game._heartT || 0) - dtReal;
      if (Game._heartT <= 0) { Game._heartT = 1.1; G.Audio.play('heart', { vol: 0.6 }); }
    }

    // 目标 / 交互
    Game._objT = (Game._objT || 0) - dtReal;
    if (Game._objT <= 0) { Game._objT = 0.25; Game.updateObjective(); }
    updateInteract();

    // 准星高亮：前方是否有敌人
    const arc = [];
    G.Entities.inArc(P.x, P.z, P.eyeY() - 0.4, P.yaw, 3.0 * P.stats.range, 0.9 * P.stats.arc, arc);
    Game.aimHot = arc.length > 0;

    // Boss 血条
    const boss = G.Entities.boss();
    if (boss && boss.seen) G.UI.bossBar(boss); else G.UI.bossBar(null);

    // HUD
    G.UI.updateHud(Game.viewState());
    G.UI.updateRelics();

    // 渲染
    G.Render.frame(Game.viewState());
  };

  Game.viewState = function () {
    return {
      map: Game.map, levelMesh: Game.levelMesh, time: Game.time,
      depth: Game.depth, themeName: Game.themeName,
      objectiveText: Game.objectiveText, marker: Game.marker,
      shakeX: Game.shakeX, shakeY: Game.shakeY, shakeR: Game.shakeR,
      flash: Game.flash, optBlood: Game.opts.blood, aimHot: Game.aimHot,
    };
  };

  U.pick = function (arr, rng) {
    return arr[(((rng ? rng.next() : Math.random()) * arr.length) | 0)];
  };

  /* =============================== 启动入口 =============================== */
  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }
  ready(() => {
    try { Game.boot(); }
    catch (err) {
      console.error(err);
      const l = document.getElementById('loading');
      if (l) { l.style.display = 'flex'; l.textContent = '启动失败：' + err.message; }
    }
  });

  G.Game = Game;
})();
