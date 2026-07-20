// game.js - 主循环 / 玩家 / 摄像机 / 状态机 / HUD
(function () {
  "use strict";

  var canvas = document.getElementById("game");
  var g = canvas.getContext("2d");
  g.imageSmoothingEnabled = false;

  var S = window.MarioSprites.S;
  var drawText = window.MarioSprites.drawText;
  var AUD = window.MarioAudio;
  var LV = window.MarioLevels;
  var EN = window.MarioEntities;
  var T = LV.T;

  var W = 256, H = 240;

  // ---------------- 输入 ----------------
  var keys = { left: false, right: false, down: false, run: false, jump: false, jumpPressed: false, firePressed: false, start: false };
  var keyMap = {
    ArrowLeft: "left", KeyA: "left",
    ArrowRight: "right", KeyD: "right",
    ArrowDown: "down", KeyS: "down",
    KeyZ: "jump", Space: "jump", KeyW: "jump", ArrowUp: "jump",
    KeyX: "run", ShiftLeft: "run", ShiftRight: "run", KeyJ: "run"
  };
  document.addEventListener("keydown", function (e) {
    AUD.unlock();
    if (e.code === "Enter" && !e.repeat) { keys.start = true; e.preventDefault(); }
    if (e.code === "KeyM" && !e.repeat) { AUD.toggleMute(); }
    var k = keyMap[e.code];
    if (k) {
      e.preventDefault();
      if (k === "jump" && !keys.jump) keys.jumpPressed = true;
      if (k === "run" && !keys.run) keys.firePressed = true;
      keys[k] = true;
    }
  });
  document.addEventListener("keyup", function (e) {
    var k = keyMap[e.code];
    if (k) keys[k] = false;
    if (e.code === "Enter") keys.start = false;
  });

  // ---------------- 游戏状态 ----------------
  var game = {
    state: "title", // title | intro | play | dying | gameover | clear | pipe
    level: null,
    bonus: null,
    inBonus: false,
    entities: [],
    particles: [],
    camX: 0,
    score: 0,
    coins: 0,
    lives: 3,
    world: "1-1",
    time: 400,
    timeTick: 0,
    introTimer: 0,
    stateTimer: 0,
    qAnim: 0,
    bumps: [],           // {tx, ty, t}
    reachedCheckpoint: false,
    flagSlide: null,
    pipeAnim: null,
    hurried: false
  };

  // ---------------- 玩家 ----------------
  var player = {
    x: 40, y: 192, vx: 0, vy: 0,
    w: 12, h: 14,
    big: false, fire: false,
    facing: 1,
    onGround: false,
    crouch: false,
    anim: 0,
    invincible: 0,   // 受伤闪烁
    starTime: 0,     // 无敌星
    dieTimer: 0,
    growTimer: 0,
    fireCooldown: 0,
    skid: false
  };

  function playerRect() {
    return { x: player.x, y: player.y, w: player.w, h: player.h };
  }

  function setBig(b) {
    if (b && !player.big) {
      player.big = true;
      player.h = 24;
      player.y -= 10;
    } else if (!b && player.big) {
      player.big = false;
      player.fire = false;
      player.h = 14;
      player.y += 10;
    }
  }

  function resetPlayer(spawn) {
    player.x = spawn.x; player.y = spawn.y;
    player.vx = 0; player.vy = 0;
    player.big = false; player.fire = false;
    player.h = 14;
    player.invincible = 0; player.starTime = 0;
    player.crouch = false;
    player.dieTimer = 0;
  }

  // ---------------- 关卡加载 ----------------
  function startLevel(fromCheckpoint) {
    game.level = LV.buildMain();
    game.bonus = LV.buildBonus();
    game.inBonus = false;
    game.entities = [];
    game.particles = [];
    game.bumps = [];
    game.time = game.level.timeLimit;
    game.timeTick = 0;
    game.hurried = false;
    game.camX = 0;
    game.flagSlide = null;
    game.pipeAnim = null;
    var spawn = (fromCheckpoint && game.reachedCheckpoint) ? game.level.checkpoint : game.level.spawn;
    resetPlayer(spawn);
    game.camX = Math.max(0, player.x - 100);
    spawnEnemies(game.level);
  }

  function spawnEnemies(lv) {
    lv.enemies.forEach(function (e) {
      var ent = e.type === "goomba" ? new EN.Goomba(e.x, e.y) : new EN.Koopa(e.x, e.y);
      ent.spawned = false;
      game.entities.push(ent);
    });
  }

  function currentLevel() { return game.inBonus ? game.bonus : game.level; }

  // ---------------- 分数与音效 ----------------
  function addScore(n, x, y) {
    game.score += n;
    if (x !== undefined) game.particles.push(new EN.ScorePop(x, y, String(n)));
  }
  function addCoin() {
    game.coins++;
    addScore(200);
    AUD.sfx.coin();
    if (game.coins >= 100) {
      game.coins -= 100;
      game.lives++;
      AUD.sfx.oneUp();
    }
  }

  // ---------------- 方块互动 ----------------
  function hitBlock(tx, ty) {
    var lv = currentLevel();
    var t = lv.get(tx, ty);
    var key = tx + "," + ty;
    var content = lv.contents[key];

    if (t === T.QUESTION || t === T.HIDDEN) {
      game.bumps.push({ tx: tx, ty: ty, t: 8 });
      dispense(lv, tx, ty, content);
      lv.set(tx, ty, T.USED);
      delete lv.contents[key];
      bumpEnemiesAbove(tx, ty);
      return true;
    }
    if (t === T.BRICK) {
      if (content) {
        game.bumps.push({ tx: tx, ty: ty, t: 8 });
        if (content.type === "multi") {
          dispense(lv, tx, ty, { type: "coin" });
          content.count--;
          if (content.count <= 0) { lv.set(tx, ty, T.USED); delete lv.contents[key]; }
        } else {
          dispense(lv, tx, ty, content);
          lv.set(tx, ty, T.USED);
          delete lv.contents[key];
        }
        bumpEnemiesAbove(tx, ty);
        return true;
      }
      if (player.big) {
        lv.set(tx, ty, T.EMPTY);
        AUD.sfx.breakBlock();
        addScore(50);
        var px = tx * 16, py = ty * 16;
        game.particles.push(new EN.BrickBit(px + 1, py + 1, -1.2, -5));
        game.particles.push(new EN.BrickBit(px + 8, py + 1, 1.2, -5));
        game.particles.push(new EN.BrickBit(px + 1, py + 8, -1.2, -3));
        game.particles.push(new EN.BrickBit(px + 8, py + 8, 1.2, -3));
        bumpEnemiesAbove(tx, ty);
      } else {
        game.bumps.push({ tx: tx, ty: ty, t: 8 });
        AUD.sfx.bump();
        bumpEnemiesAbove(tx, ty);
      }
      return true;
    }
    if (LV.SOLID[t]) AUD.sfx.bump();
    return false;
  }

  function dispense(lv, tx, ty, content) {
    var px = tx * 16, py = ty * 16;
    if (!content || content.type === "coin") {
      game.particles.push(new EN.CoinPop(px, py - 16));
      addCoin();
      return;
    }
    AUD.sfx.powerupAppear();
    if (content.type === "power") {
      if (player.big) game.entities.push(new EN.Flower(px + 1, py + 1));
      else game.entities.push(new EN.Mushroom(px + 1, py + 1));
    } else if (content.type === "oneup") {
      game.entities.push(new EN.Mushroom(px + 1, py + 1, true));
    } else if (content.type === "star") {
      game.entities.push(new EN.Star(px + 1, py + 1));
    }
  }

  function bumpEnemiesAbove(tx, ty) {
    game.entities.forEach(function (e) {
      if (e.dead || !e.spawnedOk) return;
      var ex = Math.floor((e.x + e.w / 2) / 16);
      var ey = Math.floor((e.y + e.h) / 16);
      if (ex === tx && ey === ty) {
        e.dead = true;
        e.vy = -6;
        e.flipped = true;
        addScore(100, e.x, e.y);
        AUD.sfx.kick();
      }
    });
  }

  // ---------------- 玩家物理 ----------------
  var WALK_MAX = 1.6, RUN_MAX = 2.7, ACCEL = 0.08, FRICTION = 0.9, AIR_ACCEL = 0.06;
  var JUMP_V = -5.0, JUMP_HOLD_GRAV = 0.18, FALL_GRAV = 0.5, MAX_FALL = 7;

  function updatePlayer() {
    var lv = currentLevel();
    var wasCrouch = player.crouch;
    player.crouch = player.big && keys.down && player.onGround;
    if (player.crouch && !wasCrouch) { player.h = 14; player.y += 10; }
    if (!player.crouch && wasCrouch) { player.h = 24; player.y -= 10; }

    var max = keys.run ? RUN_MAX : WALK_MAX;
    var ax = player.onGround ? ACCEL : AIR_ACCEL;

    player.skid = false;
    if (!player.crouch && keys.left && !keys.right) {
      player.vx -= ax * (player.vx > 0 ? 2.5 : 1);
      if (player.vx > 0.5 && player.onGround) player.skid = true;
      player.facing = -1;
    } else if (!player.crouch && keys.right && !keys.left) {
      player.vx += ax * (player.vx < 0 ? 2.5 : 1);
      if (player.vx < -0.5 && player.onGround) player.skid = true;
      player.facing = 1;
    } else if (player.onGround) {
      player.vx *= FRICTION;
      if (Math.abs(player.vx) < 0.05) player.vx = 0;
    }
    player.vx = Math.max(-max, Math.min(max, player.vx));

    // 跳跃
    if (keys.jumpPressed && player.onGround) {
      player.vy = JUMP_V - Math.abs(player.vx) * 0.25;
      player.onGround = false;
      if (player.big) AUD.sfx.jumpBig(); else AUD.sfx.jumpSmall();
    }
    keys.jumpPressed = false;

    // 重力（按住跳跃上升时更缓）
    var grav = (player.vy < 0 && keys.jump) ? JUMP_HOLD_GRAV : FALL_GRAV;
    player.vy = Math.min(player.vy + grav, MAX_FALL);

    // 发射火球
    if (player.fireCooldown > 0) player.fireCooldown--;
    if (keys.firePressed && player.fire && player.fireCooldown === 0) {
      var count = game.entities.filter(function (e) { return e.type === "fireball"; }).length;
      if (count < 2) {
        game.entities.push(new EN.Fireball(player.x + (player.facing > 0 ? player.w : -8), player.y + 4, player.facing));
        AUD.sfx.fireball();
        player.fireCooldown = 12;
      }
    }
    keys.firePressed = false;

    // ---- 移动与碰撞 ----
    // 水平
    player.x += player.vx;
    if (player.x < game.camX) { player.x = game.camX; player.vx = 0; }
    var ty1 = Math.floor(player.y / 16);
    var ty2 = Math.floor((player.y + player.h - 1) / 16);
    if (player.vx > 0) {
      var tx = Math.floor((player.x + player.w) / 16);
      for (var ty = ty1; ty <= ty2; ty++) {
        if (lv.isSolid(tx, ty)) { player.x = tx * 16 - player.w - 0.01; player.vx = 0; break; }
      }
    } else if (player.vx < 0) {
      tx = Math.floor(player.x / 16);
      for (ty = ty1; ty <= ty2; ty++) {
        if (lv.isSolid(tx, ty)) { player.x = (tx + 1) * 16 + 0.01; player.vx = 0; break; }
      }
    }

    // 垂直
    player.y += player.vy;
    player.onGround = false;
    var bx1 = Math.floor((player.x + 2) / 16);
    var bx2 = Math.floor((player.x + player.w - 2) / 16);
    if (player.vy >= 0) {
      var by = Math.floor((player.y + player.h) / 16);
      for (var bx = bx1; bx <= bx2; bx++) {
        if (lv.isSolid(bx, by)) {
          player.y = by * 16 - player.h;
          player.vy = 0;
          player.onGround = true;
          break;
        }
      }
    } else {
      var hy = Math.floor(player.y / 16);
      var best = -1, bestDist = 99;
      for (bx = bx1; bx <= bx2; bx++) {
        var t = lv.get(bx, hy);
        if (LV.SOLID[t] || t === T.HIDDEN) {
          var d = Math.abs((bx * 16 + 8) - (player.x + player.w / 2));
          if (d < bestDist) { bestDist = d; best = bx; }
        }
      }
      if (best >= 0) {
        player.y = (hy + 1) * 16;
        player.vy = 0;
        hitBlock(best, hy);
      }
    }

    // 场景金币
    for (var cy = Math.floor(player.y / 16); cy <= Math.floor((player.y + player.h - 1) / 16); cy++) {
      for (var cx = Math.floor(player.x / 16); cx <= Math.floor((player.x + player.w - 1) / 16); cx++) {
        if (lv.get(cx, cy) === T.COIN) { lv.set(cx, cy, T.EMPTY); addCoin(); }
      }
    }

    // 计时器类
    if (player.invincible > 0) player.invincible--;
    if (player.starTime > 0) player.starTime--;
    player.anim += Math.abs(player.vx) * 0.7 + 0.1;

    // 掉坑
    if (player.y > H + 16) killPlayer(true);

    // 旗杆判定
    if (!game.inBonus && player.x + player.w >= game.level.flagX * 16 + 6 && game.state === "play") {
      startFlagSequence();
    }

    // 进水管（站在可传送水管顶按下）
    if (keys.down && player.onGround && game.state === "play") checkPipeEnter();
  }

  function checkPipeEnter() {
    var lv = currentLevel();
    var footY = Math.floor((player.y + player.h + 1) / 16);
    var cx = player.x + player.w / 2;
    for (var i = 0; i < lv.pipes.length; i++) {
      var p = lv.pipes[i];
      if (!p.warp) continue;
      if (footY === p.ty && cx >= p.tx * 16 + 2 && cx <= p.tx * 16 + 30) {
        game.state = "pipe";
        game.pipeAnim = { mode: p.warp.to, timer: player.h + 4, dir: "down", clipY: p.ty * 16 };
        player.x = p.tx * 16 + 16 - player.w / 2;
        player.vx = 0;
        AUD.sfx.pipe();
        return;
      }
    }
  }

  // ---------------- 死亡 / 受伤 ----------------
  function hurtPlayer() {
    if (player.starTime > 0 || player.invincible > 0) return;
    if (player.big) {
      setBig(false);
      player.invincible = 120;
      AUD.sfx.pipe();
    } else {
      killPlayer(false);
    }
  }

  function killPlayer(fell) {
    if (game.state === "dying") return;
    game.state = "dying";
    game.stateTimer = 0;
    player.dieTimer = 1;
    player.vy = fell ? 0 : -7;
    AUD.sfx.die();
  }

  // ---------------- 旗杆与通关 ----------------
  function startFlagSequence() {
    game.state = "clear";
    game.stateTimer = 0;
    var poleX = game.level.flagX * 16;
    player.x = poleX - player.w - 1;
    player.vx = 0; player.vy = 0;
    var relY = Math.max(0, 176 - (player.y + player.h));
    var pts = relY > 120 ? 5000 : relY > 90 ? 2000 : relY > 60 ? 800 : relY > 30 ? 400 : 100;
    addScore(pts, poleX - 8, player.y);
    game.flagSlide = { flagY: 48, phase: "slide" };
    AUD.sfx.flagpole();
    AUD.stopMusic();
  }

  function updateClear() {
    game.stateTimer++;
    var fs = game.flagSlide;
    var lv = game.level;
    if (fs.phase === "slide") {
      if (player.y + player.h < 192) player.y += 2;
      if (fs.flagY < 160) fs.flagY += 2;
      if (player.y + player.h >= 192 && fs.flagY >= 160) {
        fs.phase = "walk";
        AUD.sfx.clear();
      }
    } else if (fs.phase === "walk") {
      player.facing = 1;
      player.anim += 0.4;
      player.x += 1.2;
      player.vy = Math.min(player.vy + 0.5, 7);
      player.y += player.vy;
      var by = Math.floor((player.y + player.h) / 16);
      var bx = Math.floor((player.x + player.w / 2) / 16);
      if (lv.isSolid(bx, by)) { player.y = by * 16 - player.h; player.vy = 0; }
      if (player.x >= game.level.castleX + 42) {
        fs.phase = "count";
      }
    } else if (fs.phase === "count") {
      if (game.time > 0) {
        var step = Math.min(game.time, 4);
        game.time -= step;
        game.score += 50 * step;
        if (game.stateTimer % 4 === 0) AUD.sfx.coin();
      } else if (game.stateTimer > 0 && fs.done !== true) {
        fs.done = true;
        fs.doneTimer = 0;
      }
      if (fs.done) {
        fs.doneTimer++;
        if (fs.doneTimer > 150) {
          game.state = "title";
          game.reachedCheckpoint = false;
          saveTop();
        }
      }
    }
  }

  // ---------------- 水管传送 ----------------
  function updatePipe() {
    var pa = game.pipeAnim;
    pa.timer--;
    if (pa.dir === "down") player.y += 1;
    else player.y -= 1;
    if (pa.timer > 0) return;

    if (pa.mode === "bonus") {
      game.savedEntities = game.entities;
      game.entities = [];
      game.inBonus = true;
      var sp = game.bonus.spawn;
      player.x = sp.x; player.y = sp.y;
      player.vx = 0; player.vy = 0;
      game.camX = 0;
      game.pipeAnim = null;
      game.state = "play";
    } else if (pa.mode === "main-exit") {
      game.inBonus = false;
      game.entities = game.savedEntities || [];
      game.savedEntities = null;
      player.x = game.bonus.exit.toX;
      player.vx = 0; player.vy = 0;
      var topY = 176;
      player.y = topY - player.h + 30;
      game.camX = Math.max(0, Math.min(player.x - 100, game.level.w * 16 - W));
      game.pipeAnim = { mode: "rise", timer: 30, dir: "up", clipY: topY };
      AUD.sfx.pipe();
    } else {
      game.pipeAnim = null;
      game.state = "play";
    }
  }

  // ---------------- 敌人与实体交互 ----------------
  function updateEntities() {
    var lv = currentLevel();
    for (var i = 0; i < game.entities.length; i++) {
      var e = game.entities[i];

      // 视野激活
      if (e.spawned === false) {
        if (e.x < game.camX + W + 32) { e.spawned = true; e.spawnedOk = true; }
        else continue;
      } else e.spawnedOk = true;

      if (e.flipped) {
        // 被顶翻，抛物线坠落
        e.vy += 0.35;
        e.y += e.vy;
        e.x += e.vx;
        if (e.y > 260) e.remove = true;
        continue;
      }

      e.update(lv);

      if (e.remove || e.dead) continue;

      var pr = playerRect();
      var er = e.rect();
      if (!EN.overlap(pr, er)) continue;

      // 道具类
      if (e.type === "mushroom") {
        e.remove = true;
        addScore(1000, e.x, e.y);
        AUD.sfx.powerup();
        setBig(true);
        continue;
      }
      if (e.type === "oneup") {
        e.remove = true;
        game.lives++;
        AUD.sfx.oneUp();
        game.particles.push(new EN.ScorePop(e.x, e.y, "1UP"));
        continue;
      }
      if (e.type === "flower") {
        e.remove = true;
        addScore(1000, e.x, e.y);
        AUD.sfx.powerup();
        if (!player.big) setBig(true);
        else player.fire = true;
        continue;
      }
      if (e.type === "star") {
        e.remove = true;
        addScore(1000, e.x, e.y);
        AUD.sfx.powerup();
        player.starTime = 600;
        continue;
      }
      if (e.type === "fireball" || e.type === "coinpop") continue;

      // 敌人
      if (player.starTime > 0) {
        e.dead = true; e.flipped = true; e.vy = -6; e.vx = player.facing;
        addScore(200, e.x, e.y);
        AUD.sfx.kick();
        continue;
      }

      var falling = player.vy > 0.5;
      var above = (player.y + player.h) - er.y < 10;

      if (e.type === "goomba") {
        if (falling && above) {
          e.stomp();
          player.vy = keys.jump ? -6 : -4;
          addScore(100, e.x, e.y);
          AUD.sfx.stomp();
        } else hurtPlayer();
      } else if (e.type === "koopa") {
        if (e.mode === "slide") {
          if (e.kickGrace > 0) continue;
          if (falling && above) {
            e.stomp(player);
            player.vy = keys.jump ? -6 : -4;
            addScore(100, e.x, e.y);
            AUD.sfx.stomp();
          } else hurtPlayer();
        } else if (e.mode === "shell") {
          var dir = (player.x + player.w / 2) < (e.x + e.w / 2) ? 1 : -1;
          e.kick(dir);
          addScore(400, e.x, e.y);
          AUD.sfx.kick();
          if (falling && above) player.vy = -4;
        } else {
          if (falling && above) {
            e.stomp(player);
            player.vy = keys.jump ? -6 : -4;
            addScore(100, e.x, e.y);
            AUD.sfx.stomp();
          } else hurtPlayer();
        }
      }
    }

    // 火球/滑壳 与敌人
    for (i = 0; i < game.entities.length; i++) {
      var a = game.entities[i];
      if (a.remove || a.dead) continue;
      var isBall = a.type === "fireball";
      var isSlide = a.type === "koopa" && a.mode === "slide";
      if (!isBall && !isSlide) continue;
      for (var j = 0; j < game.entities.length; j++) {
        if (i === j) continue;
        var b = game.entities[j];
        if (b.remove || b.dead || b.flipped || b.spawned === false) continue;
        if (b.type !== "goomba" && b.type !== "koopa") continue;
        if (isSlide && b === a) continue;
        if (EN.overlap(a.rect(), b.rect())) {
          b.dead = true; b.flipped = true; b.vy = -6; b.vx = isBall ? (a.vx > 0 ? 1 : -1) : (a.vx > 0 ? 1.5 : -1.5);
          addScore(isBall ? 200 : 500, b.x, b.y);
          AUD.sfx.kick();
          if (isBall) a.remove = true;
        }
      }
    }

    game.entities = game.entities.filter(function (e) { return !e.remove; });

    // 粒子
    game.particles.forEach(function (p) { p.update(lv); });
    game.particles = game.particles.filter(function (p) { return !p.remove; });
  }

  // ---------------- 计时与摄像机 ----------------
  function updateTimeAndCam() {
    // 计时
    game.timeTick++;
    if (game.timeTick >= 24) {
      game.timeTick = 0;
      if (game.time > 0) game.time--;
      if (game.time === 100 && !game.hurried) { game.hurried = true; AUD.sfx.timeWarn(); }
      if (game.time <= 0) killPlayer(false);
    }
    // 摄像机只前进
    var target = player.x - 100;
    if (target > game.camX) game.camX = target;
    var lv = currentLevel();
    game.camX = Math.max(0, Math.min(game.camX, lv.w * 16 - W));

    // 顶砖动画
    game.bumps.forEach(function (b) { b.t--; });
    game.bumps = game.bumps.filter(function (b) { return b.t > 0; });

    game.qAnim++;
  }

  // ---------------- 绘制 ----------------
  function drawLevel() {
    var lv = currentLevel();
    g.fillStyle = lv.bg;
    g.fillRect(0, 0, W, H);

    // 背景装饰
    if (!lv.underground) {
      lv.decor.forEach(function (d) {
        var x = Math.round(d.x - game.camX);
        if (x < -96 || x > W + 96) return;
        if (d.type === "hill") g.drawImage(S.hill, x, d.y);
        else if (d.type === "cloud") g.drawImage(S.cloud, x, d.y);
        else if (d.type === "bush") g.drawImage(S.bush, x, d.y);
        else if (d.type === "castle") g.drawImage(S.castle, x, d.y);
      });
    }

    // 图块
    var tx0 = Math.floor(game.camX / 16), tx1 = tx0 + 17;
    for (var tx = tx0; tx <= tx1; tx++) {
      for (var ty = 0; ty < lv.h; ty++) {
        var t = lv.get(tx, ty);
        if (t === T.EMPTY || t === T.HIDDEN) continue;
        var x = tx * 16 - Math.round(game.camX);
        var y = ty * 16;

        // 顶砖弹跳位移
        for (var bi = 0; bi < game.bumps.length; bi++) {
          if (game.bumps[bi].tx === tx && game.bumps[bi].ty === ty) {
            y -= Math.round(Math.sin((8 - game.bumps[bi].t) / 8 * Math.PI) * 5);
          }
        }

        switch (t) {
          case T.GROUND: g.drawImage(S.ground, x, y); break;
          case T.BRICK: g.drawImage(S.brick, x, y); break;
          case T.QUESTION:
            var qf = [0, 0, 0, 1, 2, 1][Math.floor(game.qAnim / 9) % 6];
            g.drawImage(S.qBlock[qf], x, y);
            break;
          case T.USED: g.drawImage(S.usedBlock, x, y); break;
          case T.STAIR: g.drawImage(S.stair, x, y); break;
          case T.PIPE_TL: g.drawImage(S.pipeTop, 0, 0, 16, 16, x, y, 16, 16); break;
          case T.PIPE_TR: g.drawImage(S.pipeTop, 16, 0, 16, 16, x, y, 16, 16); break;
          case T.PIPE_BL: g.drawImage(S.pipeBody, 0, 0, 16, 16, x, y, 16, 16); break;
          case T.PIPE_BR: g.drawImage(S.pipeBody, 16, 0, 16, 16, x, y, 16, 16); break;
          case T.COIN:
            g.drawImage(S.coin[Math.floor(game.qAnim / 8) % 4], x, y);
            break;
          case T.POLE:
            g.fillStyle = "#80d010";
            g.fillRect(x + 7, y, 2, 16);
            break;
          case T.POLE_TOP:
            g.fillStyle = "#80d010";
            g.fillRect(x + 7, y + 8, 2, 8);
            g.drawImage(S.flagBall, x + 4, y);
            break;
        }
      }
    }

    // 旗
    if (!game.inBonus) {
      var fx = game.level.flagX * 16 - Math.round(game.camX);
      var fy = game.flagSlide ? game.flagSlide.flagY : 48;
      if (fx > -32 && fx < W + 32) g.drawImage(S.flag, fx - 15, fy);
    }
  }

  function drawPlayer() {
    if (player.invincible > 0 && Math.floor(player.invincible / 4) % 2 === 0 && game.state === "play") return;

    var clip = game.state === "pipe" && game.pipeAnim && game.pipeAnim.clipY;
    if (clip) {
      g.save();
      g.beginPath();
      g.rect(0, 0, W, game.pipeAnim.clipY);
      g.clip();
    }

    var set;
    if (player.big) set = player.fire ? S.heroFire : S.heroBig;
    else set = player.fire ? S.heroSmallFire : S.heroSmall;
    if (player.starTime > 0 && Math.floor(player.starTime / 4) % 2 === 0) {
      set = player.big ? S.heroFire : S.heroSmallFire;
    }

    var dirIdx = player.facing > 0 ? 0 : 1;
    var img;
    if (game.state === "dying") img = S.heroSmall.die;
    else if (player.big && player.crouch) img = set.crouch[dirIdx];
    else if (!player.onGround && game.state === "play") img = set.jump[dirIdx];
    else if (Math.abs(player.vx) > 0.2 || (game.state === "clear" && game.flagSlide.phase === "walk"))
      img = set.walk[dirIdx][Math.floor(player.anim / 5) % 3];
    else img = set.stand[dirIdx];

    var drawH = img.height;
    var x = Math.round(player.x - game.camX - 2);
    var y = Math.round(player.y + player.h - drawH + 1);
    g.drawImage(img, x, y);
    if (clip) g.restore();
  }

  function drawEntities() {
    game.entities.forEach(function (e) {
      if (e.spawned === false) return;
      if (e.flipped) {
        // 翻转坠落
        var img = e.type === "goomba" ? S.goomba[0] : S.shell;
        g.save();
        g.translate(Math.round(e.x - game.camX + 8), Math.round(e.y + 8));
        g.scale(1, -1);
        g.drawImage(img, -8, -8);
        g.restore();
        return;
      }
      e.draw(g, S, game.camX);
    });
    game.particles.forEach(function (p) {
      if (p.type === "scorepop") p.draw(g, S, game.camX, drawText);
      else p.draw(g, S, game.camX);
    });
  }

  function drawHUD() {
    drawText(g, "MARIO", 24, 8);
    drawText(g, pad(game.score, 6), 24, 16);
    g.drawImage(S.coin[0], 84, 12, 8, 8);
    drawText(g, "x" + pad(game.coins, 2), 94, 16);
    drawText(g, "WORLD", 144, 8);
    drawText(g, game.world, 150, 16);
    drawText(g, "TIME", 200, 8);
    if (game.state !== "title") drawText(g, pad(game.time, 3), 202, 16);
  }

  function pad(n, len) {
    var s = String(Math.max(0, Math.floor(n)));
    while (s.length < len) s = "0" + s;
    return s;
  }

  // ---------------- 标题 / 过场 ----------------
  var topScore = 0;
  try { topScore = parseInt(localStorage.getItem("mario_top") || "0", 10); } catch (e) { }
  function saveTop() {
    if (game.score > topScore) {
      topScore = game.score;
      try { localStorage.setItem("mario_top", String(topScore)); } catch (e) { }
    }
  }

  function drawTitle() {
    g.fillStyle = "#5c94fc";
    g.fillRect(0, 0, W, H);
    // 地面装饰
    for (var x = 0; x < W; x += 16) { g.drawImage(S.ground, x, 208); g.drawImage(S.ground, x, 224); }
    g.drawImage(S.hill, 8, 172);
    g.drawImage(S.bush, 168, 192);
    g.drawImage(S.heroSmall.stand[0], 40, 192);

    // 标题牌
    g.fillStyle = "#c84c0c";
    g.fillRect(40, 40, 176, 72);
    g.fillStyle = "#fc9838";
    g.fillRect(44, 44, 168, 64);
    g.fillStyle = "#c84c0c";
    g.fillRect(48, 48, 160, 56);
    drawText(g, "SUPER", 106, 58, "#fff");
    drawText(g, "MARIO STYLE", 94, 70, "#fff");
    drawText(g, "WEB TRIBUTE", 94, 82, "#fce0a8");

    drawText(g, "PRESS ENTER", 106, 140, Math.floor(game.qAnim / 20) % 2 ? "#fff" : "#fce0a8");
    drawText(g, "TOP-" + pad(topScore, 6), 104, 160);
    drawHUD();
  }

  function drawIntro() {
    g.fillStyle = "#000";
    g.fillRect(0, 0, W, H);
    drawHUD();
    drawText(g, "WORLD " + game.world, 104, 96);
    g.drawImage(S.heroSmall.stand[0], 108, 112);
    drawText(g, "x " + game.lives, 128, 118);
  }

  function drawGameOver() {
    g.fillStyle = "#000";
    g.fillRect(0, 0, W, H);
    drawHUD();
    drawText(g, "GAME OVER", 110, 112);
  }

  // ---------------- 主循环 ----------------
  function update() {
    game.qAnim++;

    switch (game.state) {
      case "title":
        if (keys.start) {
          keys.start = false;
          game.score = 0; game.coins = 0; game.lives = 3;
          game.reachedCheckpoint = false;
          game.state = "intro";
          game.introTimer = 0;
        }
        break;

      case "intro":
        game.introTimer++;
        if (game.introTimer > 90) {
          startLevel(game.reachedCheckpoint);
          game.state = "play";
          AUD.startMusic();
        }
        break;

      case "play":
        if (keys.start) {
          keys.start = false;
          game.state = "pause";
          AUD.sfx.pause();
          AUD.stopMusic();
          break;
        }
        updatePlayer();
        if (game.state !== "play" && game.state !== "pipe") break;
        updateEntities();
        updateTimeAndCam();
        if (!game.reachedCheckpoint && !game.inBonus && game.level.checkpoint && player.x >= game.level.checkpoint.x) {
          game.reachedCheckpoint = true;
        }
        break;

      case "pause":
        if (keys.start) {
          keys.start = false;
          game.state = "play";
          AUD.sfx.pause();
          AUD.startMusic();
        }
        break;

      case "pipe":
        updatePipe();
        break;

      case "dying":
        game.stateTimer++;
        if (game.stateTimer > 30) {
          player.vy = Math.min(player.vy + 0.4, 7);
          player.y += player.vy;
        }
        if (game.stateTimer > 180) {
          game.lives--;
          saveTop();
          if (game.lives <= 0) {
            game.state = "gameover";
            game.stateTimer = 0;
          } else {
            game.state = "intro";
            game.introTimer = 0;
          }
        }
        break;

      case "clear":
        updateClear();
        break;

      case "gameover":
        game.stateTimer++;
        if (game.stateTimer > 240 || keys.start) {
          keys.start = false;
          game.state = "title";
        }
        break;
    }
  }

  function render() {
    switch (game.state) {
      case "title": drawTitle(); break;
      case "intro": drawIntro(); break;
      case "gameover": drawGameOver(); break;
      case "play":
      case "pause":
      case "pipe":
      case "dying":
      case "clear":
        drawLevel();
        drawEntities();
        drawPlayer();
        drawHUD();
        if (game.state === "pause") drawText(g, "PAUSED", 116, 112);
        if (game.state === "clear" && game.flagSlide && game.flagSlide.done) {
          drawText(g, "COURSE CLEAR!", 102, 96);
        }
        break;
    }
  }

  var last = 0, acc = 0, STEP = 1000 / 60;
  function loop(ts) {
    requestAnimationFrame(loop);
    if (!last) last = ts;
    acc += Math.min(ts - last, 100);
    last = ts;
    while (acc >= STEP) {
      update();
      acc -= STEP;
    }
    render();
  }
  requestAnimationFrame(loop);
})();
