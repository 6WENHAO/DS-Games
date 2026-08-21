/* =========================================================
   game.js — 关卡构建、瓦片查询、相机、渲染管线、HUD、状态机
   渲染顺序：天空 → 视差层 → 背景装饰 → 瓦片 → 实体 → 粒子/特效
             → 光照(暗场挖洞) → 暗角 → HUD(DOM)
   ========================================================= */
(function () {
  'use strict';
  var G = (window.G = window.G || {});
  var PX = G.PX;
  var T = 16;

  var Game = G.Game = {};
  var cv, ctx, cw = 1280, chh = 720, dpr = 1, zoom = 3;
  var dom = {};
  var lastTs = 0, fpsAcc = 0, fpsN = 0, fps = 60;
  var lightCv = null, vigCv = null;

  /* ================= 瓦片查询 ================= */
  G.tileAt = function (tx, ty) {
    var S = G.S;
    if (!S || tx < 0 || ty < 0 || tx >= S.W || ty >= S.H) return null;
    return S.grid[ty][tx];
  };
  G.tileDefAt = function (tx, ty) {
    var k = G.tileAt(tx, ty);
    return k ? PX.tileDef(k) : null;
  };
  G.solidAt = function (tx, ty) {
    var S = G.S;
    if (!S) return false;
    if (tx < 0 || tx >= S.W) return true;            // 左右边界当墙
    if (ty < 0) return false;
    if (ty >= S.H) return false;
    var k = S.grid[ty][tx];
    if (!k) return false;
    var d = PX.tileDef(k);
    return !!(d && d.solid);
  };
  G.oneWayAt = function (tx, ty) {
    var d = G.tileDefAt(tx, ty);
    return !!(d && d.oneWay);
  };
  G.isLadder = function (tx, ty) {
    var d = G.tileDefAt(tx, ty);
    return !!(d && d.climb);
  };
  G.liquidAt = function (tx, ty) {
    var d = G.tileDefAt(tx, ty);
    return d && d.liquid ? d.liquid : null;
  };

  function computeMask(tx, ty) {
    var m = 0;
    if (G.solidAt(tx, ty - 1)) m |= 1;
    if (G.solidAt(tx, ty + 1)) m |= 2;
    if (G.solidAt(tx - 1, ty)) m |= 4;
    if (G.solidAt(tx + 1, ty)) m |= 8;
    return m;
  }
  function refreshMask(tx, ty) {
    var S = G.S;
    if (tx < 0 || ty < 0 || tx >= S.W || ty >= S.H) return;
    S.mask[ty][tx] = computeMask(tx, ty);
  }
  function refreshAround(tx, ty) {
    refreshMask(tx, ty); refreshMask(tx - 1, ty); refreshMask(tx + 1, ty);
    refreshMask(tx, ty - 1); refreshMask(tx, ty + 1);
  }

  G.breakTile = function (tx, ty) {
    var S = G.S, k = G.tileAt(tx, ty);
    if (!k || k === 'bedrock' || k === 'portal') return;
    S.grid[ty][tx] = null;
    refreshAround(tx, ty);
    var col = { dirt: '#8a6242', grass: '#6aa544', leaves: '#4c7f2b', sand: '#dcd0a0', stone: '#8d8d8d', cobble: '#7d7d7d' }[k] || '#8d8d8d';
    G.burst(tx * T + 8, ty * T + 8, 10, col, 130, 0.5);
    G.SFX.play('break');
  };

  // 顶头顶到方块：奖励块出物品
  G.headBump = function (tx, ty) {
    var S = G.S, k = G.tileAt(tx, ty);
    if (k === 'bonus') {
      S.grid[ty][tx] = 'used';
      refreshAround(tx, ty);
      S.bumps.push({ x: tx, y: ty, t: 0 });
      var n = (S.bonusCount = (S.bonusCount || 0) + 1);
      var kind = (n % 5 === 0) ? 'apple' : (n % 3 === 0 ? 'diamond' : 'emerald');
      G.spawnItem(kind, tx * T + 2, ty * T - 6, true);
      G.SFX.play('break');
      G.burst(tx * T + 8, ty * T, 8, '#ffe066', 110, 0.4);
    } else if (k === 'leaves') {
      G.breakTile(tx, ty);
    }
  };

  /* ================= 关卡构建 ================= */
  Game.startLevel = function (idx) {
    var def = G.LEVELS[idx];
    var rows = def.rows;
    var H = rows.length, W = rows[0].length;
    var grid = [], mask = [], varTab = [];
    var y, x, ch;
    var S = G.S = {
      mode: 'play', levelIdx: idx, level: def, theme: def.theme,
      W: W, H: H, grid: grid, mask: mask, vari: varTab,
      player: null, mobs: [], items: [], parts: [], texts: [], bullets: [], fx: [], bumps: [], deco: [],
      cam: { x: 0, y: 0 }, shake: 0, time: 0, real: 0,
      score: (G.S && G.S.keepScore) ? G.S.score : 0,
      gems: (G.S && G.S.keepScore) ? G.S.gems : 0,
      keepScore: true,
      lives: (G.S && G.S.lives !== undefined) ? G.S.lives : 3,
      goal: null, checkpoint: null, clearT: 0, hintT: 3.2, lights: []
    };
    for (y = 0; y < H; y++) {
      grid.push(new Array(W));
      mask.push(new Array(W));
      varTab.push(new Array(W));
      for (x = 0; x < W; x++) {
        ch = rows[y][x] || '.';
        var tk = G.TILE_CHARS[ch];
        grid[y][x] = tk || null;
        varTab[y][x] = (G.hash2(x, y, 7) * 4) | 0;
        if (ch === 'F') S.goal = { kind: 'flag', x: x * T, y: y * T };
      }
    }
    // 掩码 + 光源
    for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
      mask[y][x] = computeMask(x, y);
      var d = grid[y][x] ? PX.tileDef(grid[y][x]) : null;
      if (d && d.light) S.lights.push({ x: x * T + 8, y: y * T + 8, r: 70 * d.light, i: d.light });
      if (grid[y][x] === 'portal' && !S.goal) S.goal = { kind: 'portal', x: x * T, y: y * T };
    }
    // 实体
    for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
      ch = rows[y][x];
      if (G.ITEM_CHARS[ch]) G.spawnItem(G.ITEM_CHARS[ch], x * T + 2, y * T + 2, false);
      else if (G.MOB_CHARS[ch]) G.spawnMob(G.MOB_CHARS[ch], x, y);
    }
    S.player = G.makePlayer(def.spawn.x, def.spawn.y);
    buildDeco();
    S.cam.x = S.player.x - viewW() / 2;
    S.cam.y = 0;
    clampCam();
    hideEl(dom.menu); hideEl(dom.overlay); showEl(dom.hud);
    setHint(def.name + ' — ' + def.hint);
    invalidateLight();
  };

  // 程序化装饰：草地上长树/花/草丛，洞穴挂钟乳石
  function buildDeco() {
    var S = G.S;
    var deco = S.deco = [];
    for (var x = 1; x < S.W - 1; x++) {
      for (var y = 1; y < S.H; y++) {
        var k = S.grid[y][x];
        if (!k) continue;
        var above = S.grid[y - 1][x];
        if (k === 'grass' && !above) {
          var h = G.hash2(x, y, 21);
          if (h < 0.10 && x % 3 === 0) deco.push({ n: h < 0.05 ? 'tree_big' : 'tree_small', x: x * T + 8, y: y * T, back: true });
          else if (h < 0.24) deco.push({ n: 'bush', x: x * T + 8, y: y * T + 2, back: true });
          else if (h < 0.44) deco.push({ n: h < 0.34 ? 'flower_red' : 'flower_yellow', x: x * T + 8, y: y * T + 1 });
          else if (h < 0.72) deco.push({ n: 'tuft', x: x * T + 8, y: y * T + 1 });
        } else if ((k === 'stone' || k === 'cobble') && !S.grid[y + 1] ) {
          // 忽略
        }
        break;                                   // 每列只装饰最上面一格
      }
    }
    // 洞穴：从天花板挂钟乳石
    if (S.theme === 'cave') {
      for (var cx = 2; cx < S.W - 2; cx += 3) {
        for (var cy = 1; cy < S.H - 4; cy++) {
          if (S.grid[cy][cx] && !S.grid[cy + 1][cx] && G.hash2(cx, cy, 33) < 0.35) {
            deco.push({ n: 'stalactite', x: cx * T + 8, y: cy * T + T, top: true, back: true });
            break;
          }
        }
      }
    }
    // 云：只在有天空的主题
    if (S.theme === 'plains') {
      for (var i = 0; i < Math.ceil(S.W / 14); i++) {
        var hx = G.hash2(i, 3, 41);
        deco.push({
          n: hx < 0.33 ? 'cloud_s' : (hx < 0.7 ? 'cloud_m' : 'cloud_l'),
          x: i * 14 * T + hx * 120, y: 8 + G.hash2(i, 7, 43) * 40, cloud: true
        });
      }
    }
  }

  /* ================= 初始化 ================= */
  Game.init = function (canvas) {
    cv = canvas || document.getElementById('game');
    ctx = cv.getContext('2d');
    ['hud', 'hearts', 'scoreText', 'gemText', 'lvlText', 'timeText', 'fps', 'hint',
      'menu', 'levelList', 'overlay', 'ovTitle', 'ovBody', 'ovBtn', 'pauseBox'].forEach(function (id) {
        dom[id] = document.getElementById(id);
      });
    Game.resize();
    window.addEventListener('resize', Game.resize);
    window.addEventListener('blur', function () { if (G.S && G.S.mode === 'play') { G.S.mode = 'pause'; showEl(dom.pauseBox); } });
    G.Input.attach();
    attachTouch();
    buildMenu();
    Game.loop(0);
  };

  Game.resize = function () {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    cw = window.innerWidth; chh = window.innerHeight;
    if (!cv) return;
    cv.width = Math.floor(cw * dpr); cv.height = Math.floor(chh * dpr);
    cv.style.width = cw + 'px'; cv.style.height = chh + 'px';
    if (ctx) ctx.imageSmoothingEnabled = false;
    zoom = G.clamp(Math.round((chh / 250) * 2) / 2, 2, 4);
    lightCv = null; vigCv = null;
  };
  function viewW() { return cw / zoom; }
  function viewH() { return chh / zoom; }
  function invalidateLight() { lightCv = null; }

  function attachTouch() {
    if (!cv || !cv.addEventListener) return;
    var I = G.Input;
    cv.addEventListener('touchstart', function (e) {
      G.SFX.unlock();
      handleTouch(e); e.preventDefault();
    }, { passive: false });
    cv.addEventListener('touchmove', function (e) { handleTouch(e); e.preventDefault(); }, { passive: false });
    cv.addEventListener('touchend', function () { I.touch = 0; I.touchJump = false; });
    function handleTouch(e) {
      I.touch = 0; I.touchJump = false;
      for (var i = 0; i < e.touches.length; i++) {
        var t = e.touches[i];
        if (t.clientX > cw * 0.55) { I.touchJump = true; if (!I.jumpWasDown) { I.jumpBuffer = 0.13; } }
        else I.touch = t.clientX < cw * 0.27 ? -1 : 1;
      }
      I.jumpWasDown = I.touchJump;
    }
  }

  function buildMenu() {
    if (!dom.levelList) return;
    dom.levelList.innerHTML = '';
    G.LEVELS.forEach(function (L, i) {
      var d = document.createElement('div');
      d.className = 'lvCard';
      var art = PX.mk(120, 68), ax = art.getContext('2d');
      if (ax) {
        ax.imageSmoothingEnabled = false;
        ax.drawImage(PX.sky(L.theme, 60, 34), 0, 0, 120, 68);
        var g = PX.tile(L.theme === 'nether' ? 'netherrack' : (L.theme === 'end' ? 'endstone' : (L.theme === 'cave' ? 'cobble' : 'grass')), 0, 0);
        for (var k = 0; k < 8; k++) ax.drawImage(g, k * 16, 52, 16, 16);
        var mob = ['zombie', 'skeleton', 'creeper', 'slime'][i % 4];
        var mi = PX.mob(mob, 0);
        ax.drawImage(mi, 76, 52 - mi.height * 1.1, mi.width * 1.1, mi.height * 1.1);
        var pi = PX.player('idle', 0);
        ax.drawImage(pi, 14, 52 - pi.height * 1.1, pi.width * 1.1, pi.height * 1.1);
      }
      d.appendChild(art);
      var t = document.createElement('div');
      t.innerHTML = '<div class="lvName">' + L.name + '</div><div class="lvHint">' + L.hint + '</div>' +
        '<div class="lvKey">按 ' + (i + 1) + ' 键 / 点击进入</div>';
      d.appendChild(t);
      d.onclick = function () { G.SFX.unlock(); Game.newGame(i); };
      dom.levelList.appendChild(d);
    });
  }

  Game.newGame = function (idx) {
    G.S = null;
    Game.startLevel(idx || 0);
    G.S.lives = 3;
    G.S.score = 0; G.S.gems = 0;
  };

  /* ================= 主循环 ================= */
  Game.loop = function (ts) {
    requestAnimationFrame(Game.loop);
    var dt = (ts - lastTs) / 1000;
    lastTs = ts;
    if (!(dt > 0)) dt = 0.016;
    dt = Math.min(dt, 0.05);
    fpsAcc += dt; fpsN++;
    if (fpsAcc > 0.5) { fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; if (dom.fps) dom.fps.textContent = 'FPS ' + Math.round(fps); }
    Game.tick(dt);
    Game.render();
    G.Input.endFrame(dt);
  };

  Game.tick = function (dt) {
    var I = G.Input, S = G.S;
    if (I.pressed('KeyM')) { G.SFX.muted = !G.SFX.muted; setHint(G.SFX.muted ? '静音：开' : '静音：关'); }
    if (!S) {
      for (var i = 0; i < G.LEVELS.length; i++) if (I.pressed('Digit' + (i + 1))) Game.newGame(i);
      if (I.pressed('Space') || I.pressed('Enter')) Game.newGame(0);
      return;
    }
    if (I.pressed('Escape') || I.pressed('KeyP')) {
      if (S.mode === 'play') { S.mode = 'pause'; showEl(dom.pauseBox); }
      else if (S.mode === 'pause') { S.mode = 'play'; hideEl(dom.pauseBox); }
    }
    if (S.mode === 'pause') return;
    if (S.mode === 'dead' || S.mode === 'gameover' || S.mode === 'win') {
      if (I.pressed('KeyR') || I.pressed('Space') || I.pressed('Enter')) {
        if (S.mode === 'win' || S.mode === 'gameover') Game.toMenu();
        else Game.retry();
      }
    }

    S.real += dt;
    if (S.shake > 0) S.shake = Math.max(0, S.shake - dt * 26);
    if (S.hintT > 0) { S.hintT -= dt; if (S.hintT <= 0) setHint(''); }

    if (S.mode === 'play') S.time += dt;
    if (S.mode === 'play' || S.mode === 'clear' || S.mode === 'dead') {
      G.updatePlayer(dt);
      if (S.mode !== 'dead') {
        G.updateMobs(dt);
        G.updateBullets(dt);
        G.updateItems(dt);
      }
      G.updateParts(dt);
      G.updateTexts(dt);
      G.updateFx(dt);
      for (var b = S.bumps.length - 1; b >= 0; b--) { S.bumps[b].t += dt; if (S.bumps[b].t > 0.22) S.bumps.splice(b, 1); }
    }

    // 终点判定
    if (S.mode === 'play' && S.goal) {
      var p = S.player;
      if (p.x + p.w > S.goal.x - 6 && p.x < S.goal.x + 22 && p.y + p.h > S.goal.y - 60 && p.y < S.goal.y + 20) {
        S.mode = 'clear'; S.clearT = 0;
        S.score += 500 + Math.max(0, Math.round((120 - S.time) * 5));
        G.SFX.play('clear');
        for (var k = 0; k < 40; k++) G.burst(S.goal.x + 8, S.goal.y - G.rand(0, 60), 1, G.pick(['#ffe066', '#3fd97a', '#4fd9d0', '#ff8a94']), 200, 0.9, 260);
      }
    }
    if (S.mode === 'clear') {
      S.clearT += dt;
      if (S.clearT > 2.2) {
        if (S.levelIdx + 1 < G.LEVELS.length) {
          var keep = { score: S.score, gems: S.gems, lives: S.lives };
          Game.startLevel(S.levelIdx + 1);
          G.S.score = keep.score; G.S.gems = keep.gems; G.S.lives = keep.lives;
        } else {
          S.mode = 'win';
          showOverlay('<span class="win">全部通关！</span>',
            '你穿越了平原、洞穴、下界与末地。<br>总分 <b>' + S.score + '</b> · 绿宝石 <b>' + S.gems + '</b> · 用时 <b>' + G.fmtTime(S.time) + '</b>',
            '返回菜单 (R)');
          G.SFX.play('win');
        }
      }
    }
    if (S.mode === 'dead' && S.player.deadT > 1.4) {
      S.lives--;
      if (S.lives <= 0) {
        S.mode = 'gameover';
        showOverlay('<span class="lose">游戏结束</span>', '得分 <b>' + S.score + '</b><br>再试一次？', '返回菜单 (R)');
      } else {
        Game.retry();
      }
    }

    // 相机
    var pl = S.player;
    var tx2 = pl.x + pl.w / 2 - viewW() / 2 + pl.face * 20;
    var ty2 = pl.y + pl.h / 2 - viewH() / 2;
    S.cam.x = G.lerp(S.cam.x, tx2, Math.min(1, dt * 7));
    S.cam.y = G.lerp(S.cam.y, ty2, Math.min(1, dt * 5));
    clampCam();
    updateHud();
  };

  function clampCam() {
    var S = G.S;
    S.cam.x = G.clamp(S.cam.x, 0, Math.max(0, S.W * T - viewW()));
    S.cam.y = G.clamp(S.cam.y, -20, Math.max(-20, S.H * T - viewH() + 8));
  }

  Game.retry = function () {
    var S = G.S;
    var keep = { score: S.score, gems: S.gems, lives: S.lives, idx: S.levelIdx, cp: S.checkpoint };
    Game.startLevel(keep.idx);
    G.S.score = keep.score; G.S.gems = keep.gems; G.S.lives = keep.lives;
    if (keep.cp) { G.S.player.x = keep.cp.x; G.S.player.y = keep.cp.y - 10; G.S.checkpoint = keep.cp; }
    hideEl(dom.overlay);
  };
  Game.toMenu = function () {
    G.S = null;
    hideEl(dom.hud); hideEl(dom.overlay); hideEl(dom.pauseBox);
    showEl(dom.menu);
  };

  /* ================= HUD ================= */
  function showEl(e) { if (e) e.classList.remove('hide'); }
  function hideEl(e) { if (e) e.classList.add('hide'); }
  function setHint(t) { if (dom.hint) { dom.hint.innerHTML = t || ''; if (t) showEl(dom.hint); else hideEl(dom.hint); } }
  function showOverlay(title, body, btn) {
    if (!dom.overlay) return;
    dom.ovTitle.innerHTML = title;
    dom.ovBody.innerHTML = body;
    dom.ovBtn.textContent = btn;
    dom.ovBtn.onclick = Game.toMenu;
    showEl(dom.overlay);
  }
  var lastHearts = -1, lastMax = -1;
  function updateHud() {
    var S = G.S, p = S.player;
    if (dom.scoreText) dom.scoreText.textContent = S.score;
    if (dom.gemText) dom.gemText.textContent = S.gems;
    if (dom.lvlText) dom.lvlText.textContent = S.level.name + '   ×' + S.lives;
    if (dom.timeText) dom.timeText.textContent = G.fmtTime(S.time);
    if (dom.hearts && (p.hearts !== lastHearts || p.maxHearts !== lastMax)) {
      lastHearts = p.hearts; lastMax = p.maxHearts;
      dom.hearts.innerHTML = '';
      for (var i = 0; i < p.maxHearts; i++) {
        var c = PX.mk(16 * 2, 18 * 2), x = c.getContext('2d');
        if (x) {
          x.imageSmoothingEnabled = false;
          x.globalAlpha = i < p.hearts ? 1 : 0.25;
          x.drawImage(PX.item('heart', 0), 0, 0, 32, 36);
        }
        c.className = 'heart';
        dom.hearts.appendChild(c);
      }
    }
  }

  /* ================= 渲染 ================= */
  Game.render = function () {
    if (!ctx) return;
    var S = G.S;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!S) {
      var sky = PX.sky('plains', 160, 90);
      ctx.drawImage(sky, 0, 0, cw, chh);
      return;
    }
    var vw = viewW(), vh = viewH();
    var sx = 0, sy = 0;
    if (S.shake > 0) { sx = G.rand(-S.shake, S.shake); sy = G.rand(-S.shake, S.shake); }

    /* ---- 天空 ---- */
    ctx.drawImage(PX.sky(S.theme, 160, 90), 0, 0, cw, chh);

    /* ---- 视差层 ---- */
    drawLayer(0, 0.22, 0.62);
    drawLayer(1, 0.45, 0.78);

    /* ---- 世界坐标系 ---- */
    ctx.setTransform(zoom * dpr, 0, 0, zoom * dpr,
      Math.round(-S.cam.x * zoom + sx) * dpr, Math.round(-S.cam.y * zoom + sy) * dpr);

    /* ---- 背景装饰（云、树、钟乳石） ---- */
    var i, d, img;
    for (i = 0; i < S.deco.length; i++) {
      d = S.deco[i];
      if (!d.back && !d.cloud) continue;
      img = PX.deco(d.n);
      if (!img) continue;
      var dx = d.cloud ? d.x - S.cam.x * 0.35 + S.cam.x : d.x;
      if (dx - S.cam.x < -140 || dx - S.cam.x > vw + 140) continue;
      if (d.cloud) { ctx.globalAlpha = 0.9; ctx.drawImage(img, Math.round(dx - img.width / 2), Math.round(d.y)); ctx.globalAlpha = 1; }
      else if (d.top) ctx.drawImage(img, Math.round(dx - img.width / 2), Math.round(d.y));
      else ctx.drawImage(img, Math.round(dx - img.width / 2), Math.round(d.y - img.height + 2));
    }

    /* ---- 瓦片 ---- */
    var x0 = Math.max(0, Math.floor(S.cam.x / T) - 1), x1 = Math.min(S.W - 1, Math.ceil((S.cam.x + vw) / T));
    var y0 = Math.max(0, Math.floor(S.cam.y / T) - 1), y1 = Math.min(S.H - 1, Math.ceil((S.cam.y + vh) / T));
    var anim = (S.real * 4) | 0;
    for (var ty = y0; ty <= y1; ty++) {
      for (var tx = x0; tx <= x1; tx++) {
        var k = S.grid[ty][tx];
        if (!k) continue;
        var v = S.vari[ty][tx];
        if (k === 'water' || k === 'lava' || k === 'portal') v = anim & 3;
        else if (k === 'bonus') v = (S.real * 2 | 0) & 1;
        var timg = PX.tile(k, S.mask[ty][tx], v);
        if (!timg) continue;
        var oy = 0;
        for (var bi = 0; bi < S.bumps.length; bi++) {
          if (S.bumps[bi].x === tx && S.bumps[bi].y === ty) oy = -Math.sin(S.bumps[bi].t / 0.22 * Math.PI) * 5;
        }
        ctx.drawImage(timg, tx * T, ty * T + oy);
      }
    }

    /* ---- 前景装饰（花草） ---- */
    for (i = 0; i < S.deco.length; i++) {
      d = S.deco[i];
      if (d.back || d.cloud) continue;
      if (d.x - S.cam.x < -40 || d.x - S.cam.x > vw + 40) continue;
      img = PX.deco(d.n);
      if (img) ctx.drawImage(img, Math.round(d.x - img.width / 2), Math.round(d.y - img.height));
    }

    /* ---- 终点旗 / 传送门光柱 ---- */
    if (S.goal && S.goal.kind === 'flag') {
      var fimg = PX.deco('flag');
      ctx.drawImage(fimg, S.goal.x - 2, S.goal.y - fimg.height + 2);
    }

    /* ---- 道具 ---- */
    for (i = 0; i < S.items.length; i++) {
      var it = S.items[i];
      var fr = ((S.real * 6 + it.t * 3) | 0) % PX.itemFrames(it.kind);
      var iimg = PX.item(it.kind, fr);
      var bob = it.pop ? 0 : Math.sin(S.real * 3 + it.t * 2) * 1.5;
      shadow(it.x + 6, it.y + 14, 5);
      ctx.drawImage(iimg, snap(it.x - 2), snap(it.y - 2 + bob));
    }

    /* ---- 怪物 ---- */
    for (i = 0; i < S.mobs.length; i++) {
      var m = S.mobs[i];
      if (m.x - S.cam.x < -80 || m.x - S.cam.x > vw + 80) continue;
      var mimg = PX.mob(m.kind, m.frame);
      var scale = m.small ? 0.6 : 1;
      var mw = mimg.width * scale, mh = mimg.height * scale;
      if (m.fuseT > 0 && ((m.fuseT * 12) | 0) % 2 === 0) mimg = PX.flash(mimg, '#ffffff', 0.7);
      ctx.save();
      if (!m.dead) shadow(m.x + m.w / 2, m.y + m.h, m.w * 0.5);
      ctx.translate(snap(m.x + m.w / 2), snap(m.y + m.h));
      if (m.dead) { ctx.globalAlpha = Math.max(0, 1 - m.deadT * 2); ctx.scale(1, Math.max(0.15, 1 - m.deadT * 2.4)); }
      if (m.face > 0) ctx.scale(-1, 1);
      ctx.drawImage(mimg, -mw / 2, -mh + 2 * scale, mw, mh);
      ctx.restore();
      // 骷髅/烈焰人的瞄准提示
      if (m.aim > 0 && !m.dead) {
        ctx.globalAlpha = 0.5 + Math.sin(S.real * 24) * 0.4;
        ctx.fillStyle = '#ff8a3b';
        ctx.fillRect(m.x + m.w / 2 - 1, m.y - 8, 2, 5);
        ctx.fillRect(m.x + m.w / 2 - 1, m.y - 2, 2, 2);
        ctx.globalAlpha = 1;
      }
    }

    /* ---- 怪物子弹 ---- */
    for (i = 0; i < S.bullets.length; i++) {
      var bl = S.bullets[i];
      var bimg = PX.item(bl.kind === 'fire' ? 'torch' : 'arrow', 0);
      ctx.save();
      ctx.translate(bl.x, bl.y);
      ctx.rotate(bl.kind === 'arrow' ? bl.rot : 0);
      ctx.drawImage(bimg, -8, -8);
      ctx.restore();
    }

    /* ---- 玩家 ---- */
    var p = S.player;
    var pimg = PX.player(p.pose, p.frame);
    var blink = p.iframe > 0 && ((S.real * 16) | 0) % 2 === 0;
    if (!p.dead) shadow(p.x + p.w / 2, p.y + p.h, 7);
    ctx.save();
    if (blink) ctx.globalAlpha = 0.5;
    ctx.translate(snap(p.x + p.w / 2), snap(p.y + p.h));
    if (p.dead) ctx.rotate(Math.min(1.6, p.deadT * 3));
    if (p.face < 0) ctx.scale(-1, 1);
    ctx.drawImage(p.hurtT > 0 ? PX.flash(pimg, '#ff6b6b', 0.55) : pimg, -pimg.width / 2, -pimg.height + 3);
    ctx.restore();
    ctx.globalAlpha = 1;

    /* ---- 粒子 / 特效 / 飘字 ---- */
    for (i = 0; i < S.parts.length; i++) {
      var q = S.parts[i];
      ctx.globalAlpha = Math.min(1, q.life / q.max * 1.5);
      ctx.fillStyle = q.col;
      ctx.fillRect(q.x | 0, q.y | 0, q.size, q.size);
    }
    ctx.globalAlpha = 1;
    for (i = 0; i < S.fx.length; i++) {
      var f = S.fx[i];
      if (f.kind === 'boom') {
        var kk = f.t / f.life;
        ctx.globalAlpha = 0.8 * (1 - kk);
        ctx.fillStyle = kk < 0.4 ? '#fff3c0' : '#ff9a3b';
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (0.4 + kk), 0, 6.2832); ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
    ctx.textAlign = 'center';
    for (i = 0; i < S.texts.length; i++) {
      var tt = S.texts[i];
      ctx.globalAlpha = Math.min(1, tt.life * 2);
      ctx.font = 'bold 9px monospace';
      ctx.fillStyle = '#000';
      ctx.fillText(tt.text, tt.x + 1, tt.y + 1);
      ctx.fillStyle = tt.col;
      ctx.fillText(tt.text, tt.x, tt.y);
    }
    ctx.globalAlpha = 1;

    /* ---- 光照与暗角 ---- */
    drawLighting();
  };

  function shadow(x, y, w) {
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(x, y, w, w * 0.35, 0, 0, 6.2832);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  // 按「屏幕像素」对齐：相机也是屏幕像素取整，两者一致才不会抖动
  // （若按世界像素取整，缩放 3 倍后会变成 3 像素一跳的抽搐感）
  function snap(v) { return Math.round(v * zoom) / zoom; }

  function drawLayer(idx, factor, yRatio) {
    var S = G.S;
    var lw = 512, lh = Math.round(chh / zoom * 0.55);
    var img = PX.layer(S.theme, idx, lw, lh);
    var scale = (chh * 0.55) / lh;
    var w = lw * scale;
    var ox = -((S.cam.x * factor * zoom) % w);
    var y = chh * yRatio - lh * scale;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (var i = -1; i * w + ox < cw + w; i++) {
      ctx.drawImage(img, Math.round(i * w + ox), Math.round(y), Math.round(w) + 1, Math.round(lh * scale));
    }
  }

  function drawLighting() {
    var S = G.S;
    var C = G.THEMES[S.theme] || G.THEMES.plains;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (C.tint) {
      if (!lightCv || lightCv.width !== Math.floor(cw) || lightCv.height !== Math.floor(chh)) {
        lightCv = PX.mk(Math.max(1, Math.floor(cw)), Math.max(1, Math.floor(chh)));
      }
      var lx = lightCv.getContext('2d');
      if (lx) {
        lx.setTransform(1, 0, 0, 1, 0, 0);
        lx.clearRect(0, 0, lightCv.width, lightCv.height);
        lx.fillStyle = C.tint;
        lx.fillRect(0, 0, lightCv.width, lightCv.height);
        lx.globalCompositeOperation = 'destination-out';
        // 玩家自带光（半径按世界坐标换算，保证覆盖足够格数）
        var p = S.player;
        punch(lx, (p.x + p.w / 2 - S.cam.x) * zoom, (p.y + p.h / 2 - S.cam.y) * zoom, 170 * zoom);
        for (var i = 0; i < S.lights.length; i++) {
          var L = S.lights[i];
          var sx2 = (L.x - S.cam.x) * zoom, sy2 = (L.y - S.cam.y) * zoom;
          if (sx2 < -400 || sx2 > cw + 400) continue;
          punch(lx, sx2, sy2, L.r * zoom);
        }
        lx.globalCompositeOperation = 'source-over';
      }
      ctx.drawImage(lightCv, 0, 0, cw, chh);
    }
    // 暗角
    if (!vigCv || vigCv.width !== Math.floor(cw)) {
      vigCv = PX.mk(Math.max(1, Math.floor(cw)), Math.max(1, Math.floor(chh)));
      var vx = vigCv.getContext('2d');
      if (vx && vx.createRadialGradient) {
        var g = vx.createRadialGradient(cw / 2, chh / 2, Math.min(cw, chh) * 0.35, cw / 2, chh / 2, Math.max(cw, chh) * 0.72);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(1, 'rgba(0,0,0,0.28)');
        vx.fillStyle = g;
        vx.fillRect(0, 0, cw, chh);
      }
    }
    ctx.drawImage(vigCv, 0, 0);
  }
  function punch(lx, x, y, r) {
    if (!lx.createRadialGradient) { return; }
    var g = lx.createRadialGradient(x, y, r * 0.15, x, y, r);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(0.55, 'rgba(0,0,0,0.75)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    lx.fillStyle = g;
    lx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  /* 供无头测试使用 */
  Game.headlessInit = function (canvas) {
    cv = canvas; ctx = cv.getContext('2d');
    dpr = 1; cw = 1280; chh = 720; zoom = 3;
    dom = {};
  };
  Game.viewSize = function () { return { w: viewW(), h: viewH(), zoom: zoom }; };
})();
