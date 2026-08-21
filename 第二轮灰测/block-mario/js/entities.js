/* =========================================================
   entities.js — 玩家物理/动画、怪物 AI、道具、粒子
   物理手感：可变跳跃高度 + 土狼时间 + 跳跃缓冲 + 空中控制
   ========================================================= */
(function () {
  'use strict';
  var G = (window.G = window.G || {});
  var T = 16;

  /* ---------------- 物理常数 ---------------- */
  var PHYS = G.PHYS = {
    grav: 1500, maxFall: 620,
    walk: 142, sprint: 212,
    accelG: 2200, accelA: 1250,
    fricG: 2500, fricA: 260,
    jumpV: 400, jumpCut: 150,
    coyote: 0.09,
    stompBounce: 300,
    climbSpd: 90
  };

  /* ---------------- 通用 AABB 移动 ---------------- */
  // e 需要 x,y（左上角）,w,h,vx,vy；返回碰撞标记
  // 关键约定：向下/向右检测「即将进入的格子」而不是「身体内最后一格」，
  // 否则吸附到格边界后会被读成上一格空气 → 每帧「落地/离地」抖动。
  // 同时按位移大小拆分子步，避免高速或掉帧时穿透地面。
  G.moveBody = function (e, dt, opts) {
    var hit = { left: false, right: false, up: false, down: false, hazard: null, liquid: null, upTile: null };
    var mmax = Math.max(Math.abs(e.vx * dt), Math.abs(e.vy * dt));
    var steps = mmax > 7 ? Math.min(6, Math.ceil(mmax / 7)) : 1;
    for (var s = 0; s < steps; s++) moveStep(e, dt / steps, hit);

    // ---- 危险 / 液体检测（身体中心 + 脚底） ----
    var cx = Math.floor((e.x + e.w / 2) / T), cy = Math.floor((e.y + e.h * 0.6) / T);
    var d = G.tileDefAt(cx, cy);
    if (d) {
      if (d.hazard) hit.hazard = G.tileAt(cx, cy);
      if (d.liquid) hit.liquid = d.liquid;
    }
    var fy = Math.floor((e.y + e.h - 1) / T);
    var fd = G.tileDefAt(cx, fy);
    if (fd && fd.hazard) hit.hazard = G.tileAt(cx, fy);
    return hit;
  };

  function moveStep(e, dt, hit) {
    var ty, tx, y0, y1, x0, x1;

    // ---- X 轴 ----
    e.x += e.vx * dt;
    y0 = Math.floor(e.y / T); y1 = Math.floor((e.y + e.h - 1) / T);
    if (e.vx > 0) {
      var xr = Math.floor((e.x + e.w) / T);            // 右侧即将进入的格
      for (ty = y0; ty <= y1; ty++) {
        if (G.solidAt(xr, ty)) { e.x = xr * T - e.w; e.vx = 0; hit.right = true; break; }
      }
    } else if (e.vx < 0) {
      var xl = Math.floor(e.x / T);
      for (ty = y0; ty <= y1; ty++) {
        if (G.solidAt(xl, ty)) { e.x = (xl + 1) * T; e.vx = 0; hit.left = true; break; }
      }
    }

    // ---- Y 轴 ----
    var prevBottom = e.y + e.h;
    e.y += e.vy * dt;
    x0 = Math.floor(e.x / T); x1 = Math.floor((e.x + e.w - 1) / T);
    if (e.vy >= 0) {
      var yb = Math.floor((e.y + e.h) / T);            // 脚底所在/即将进入的格
      for (tx = x0; tx <= x1; tx++) {
        var solid = G.solidAt(tx, yb);
        // 单向平台：只有从上方落下才算实体
        if (!solid && G.oneWayAt(tx, yb) && prevBottom <= yb * T + 2) solid = true;
        if (solid) { e.y = yb * T - e.h; e.vy = 0; hit.down = true; break; }
      }
    } else {
      var yt = Math.floor(e.y / T);
      for (tx = x0; tx <= x1; tx++) {
        if (G.solidAt(tx, yt)) {
          e.y = (yt + 1) * T; e.vy = 0; hit.up = true;
          hit.upTile = { x: tx, y: yt };
          break;
        }
      }
    }
  }

  /* ---------------- 玩家 ---------------- */
  G.makePlayer = function (tx, ty) {
    return {
      x: tx * T + 1, y: ty * T - 13, w: 13, h: 29,
      vx: 0, vy: 0, face: 1,
      onGround: false, coyote: 0, jumping: false, climbing: false,
      pose: 'idle', lastPose: 'idle', animT: 0, frame: 0,
      hearts: 3, maxHearts: 3, iframe: 0, hurtT: 0,
      landT: 0, dust: 0, stepT: 0,
      dead: false, deadT: 0, cheerT: 0
    };
  };

  G.updatePlayer = function (dt) {
    var S = G.S, p = S.player, I = G.Input;
    if (p.dead) {                                  // 死亡动画：向上弹起再落下
      p.deadT += dt;
      p.vy = Math.min(PHYS.maxFall, p.vy + PHYS.grav * dt);
      p.y += p.vy * dt;
      return;
    }
    if (S.mode === 'clear') {                      // 通关欢呼
      p.cheerT += dt; p.pose = 'cheer';
      p.frame = ((p.cheerT * 4) | 0) % 2;
      p.vx = 0;
      p.vy = Math.min(PHYS.maxFall, p.vy + PHYS.grav * dt);
      G.moveBody(p, dt);
      return;
    }

    var ax = I.axisX();
    var sprint = I.runHeld();
    var maxSpd = sprint ? PHYS.sprint : PHYS.walk;
    if (p.hurtT > 0) { p.hurtT -= dt; ax = 0; }

    // ---- 梯子 ----
    var cx = Math.floor((p.x + p.w / 2) / T), cyT = Math.floor((p.y + p.h / 2) / T);
    var onLadder = G.isLadder(cx, cyT) || G.isLadder(cx, Math.floor((p.y + 2) / T));
    if (onLadder && (I.down('KeyW') || I.down('ArrowUp') || I.down('KeyS') || I.down('ArrowDown'))) {
      p.climbing = true;
    }
    if (p.climbing && !onLadder) p.climbing = false;

    if (p.climbing) {
      p.vy = 0;
      if (I.down('KeyW') || I.down('ArrowUp')) p.vy = -PHYS.climbSpd;
      if (I.down('KeyS') || I.down('ArrowDown')) p.vy = PHYS.climbSpd;
      p.vx = ax * PHYS.walk * 0.6;
      p.pose = 'run'; p.animT += dt * (Math.abs(p.vy) > 1 ? 6 : 0);
      if (I.consumeJump()) { p.climbing = false; p.vy = -PHYS.jumpV * 0.85; G.SFX.play('jump'); }
    } else {
      // ---- 水平加速/摩擦 ----
      var accel = p.onGround ? PHYS.accelG : PHYS.accelA;
      var fric = p.onGround ? PHYS.fricG : PHYS.fricA;
      if (ax !== 0) {
        p.vx = G.approach(p.vx, ax * maxSpd, accel * dt);
        p.face = ax > 0 ? 1 : -1;
      } else {
        p.vx = G.approach(p.vx, 0, fric * dt);
      }
      // ---- 重力 ----
      var liq = G.liquidAt(cx, cyT);
      var gmul = liq === 'water' ? 0.45 : 1;
      p.vy = Math.min(PHYS.maxFall * (liq === 'water' ? 0.4 : 1), p.vy + PHYS.grav * gmul * dt);

      // ---- 跳跃（土狼时间 + 缓冲 + 可变高度） ----
      if (p.onGround) p.coyote = PHYS.coyote; else p.coyote -= dt;
      if (p.coyote > 0 && I.consumeJump()) {
        p.vy = -PHYS.jumpV * (liq === 'water' ? 0.8 : 1);
        p.onGround = false; p.coyote = 0; p.jumping = true;
        G.burst(p.x + p.w / 2, p.y + p.h, 5, '#e8e0cc', 60, 0.3);
        G.SFX.play('jump');
      }
      if (p.jumping && !I.jumpHeld() && p.vy < -PHYS.jumpCut) { p.vy = -PHYS.jumpCut; p.jumping = false; }
      if (p.vy > 0) p.jumping = false;
    }

    var wasAir = !p.onGround;
    var impact = p.vy;                              // 撞击前的下落速度
    var hit = G.moveBody(p, dt);
    p.onGround = hit.down;
    // 只有真正的下落才播落地动作/音效（避免每帧微量下沉被判定为落地）
    if (hit.down && wasAir && impact > 130) {
      p.landT = 0.12;
      G.burst(p.x + p.w / 2, p.y + p.h, 8, '#d8cfb8', 90, 0.35);
      G.SFX.play('land');
    }
    if (hit.up && hit.upTile) G.headBump(hit.upTile.x, hit.upTile.y);

    // ---- 危险 / 掉出世界 ----
    if (hit.hazard) G.hurtPlayer(1, hit.hazard === 'lava' ? 99 : 1);
    if (p.y > S.H * T + 40) G.killPlayer();

    // ---- 姿态与动画 ----
    if (p.iframe > 0) p.iframe -= dt;
    if (p.landT > 0) p.landT -= dt;
    if (p.hurtT > 0) p.pose = 'hurt';
    else if (p.climbing) p.pose = 'run';
    // 用土狼时间做缓冲：短暂离地不会立刻切成下落姿态（防抖动）
    else if (!p.onGround && p.coyote <= 0) p.pose = p.vy < -20 ? 'jump' : 'fall';
    else if (p.landT > 0) p.pose = 'land';
    else if (Math.abs(p.vx) > 12) p.pose = 'run';
    else p.pose = 'idle';

    // 姿态切换时重置动画计时，保证从第 0 帧开始播
    if (p.pose !== p.lastPose) { p.animT = 0; p.lastPose = p.pose; }

    if (p.pose === 'run') {
      p.animT += dt * (Math.abs(p.vx) / PHYS.walk) * 9;
      p.frame = (p.animT | 0) % 6;
      // 跑动脚步声与尘土
      p.stepT -= dt;
      if (p.onGround && p.stepT <= 0) {
        p.stepT = 0.22 / Math.max(0.4, Math.abs(p.vx) / PHYS.walk);
        G.SFX.play('step');
        G.burst(p.x + p.w / 2 - p.face * 5, p.y + p.h, 2, '#cfc6ae', 40, 0.25);
      }
    } else if (p.pose === 'idle') {
      p.animT += dt * 2.2;
      p.frame = (p.animT | 0) % 2;
    } else p.frame = 0;
  };

  G.hurtPlayer = function (n, big) {
    var S = G.S, p = S.player;
    if (p.dead || p.iframe > 0 || S.mode !== 'play') return;
    p.hearts -= (big >= 99 ? p.hearts : n);
    p.iframe = 1.1; p.hurtT = 0.32;
    p.vy = -220; p.vx = -p.face * 130;
    S.shake = Math.max(S.shake, 6);
    G.SFX.play('hurt');
    G.burst(p.x + p.w / 2, p.y + p.h / 2, 10, '#e2384a', 110, 0.45);
    if (p.hearts <= 0) G.killPlayer();
  };
  G.killPlayer = function () {
    var S = G.S, p = S.player;
    if (p.dead) return;
    p.dead = true; p.deadT = 0; p.hearts = 0;
    p.vy = -320; p.vx = 0;
    S.mode = 'dead';
    G.SFX.play('die');
  };

  /* ---------------- 怪物 ---------------- */
  var MOBDEF = {
    zombie: { w: 14, h: 30, spd: 44, hp: 1, stomp: true, score: 100, gravity: true },
    skeleton: { w: 14, h: 30, spd: 30, hp: 1, stomp: true, score: 150, gravity: true, shoot: 2.4 },
    creeper: { w: 16, h: 30, spd: 66, hp: 1, stomp: true, score: 200, gravity: true, fuse: true },
    slime: { w: 20, h: 17, spd: 52, hp: 1, stomp: true, score: 120, gravity: true, hop: 1.05 },
    blaze: { w: 18, h: 25, spd: 34, hp: 1, stomp: true, score: 250, gravity: false, shoot: 2.0, hover: true }
  };
  G.MOBDEF = MOBDEF;

  G.spawnMob = function (kind, tx, ty, small) {
    var d = MOBDEF[kind] || MOBDEF.zombie;
    var s = small ? 0.6 : 1;
    var m = {
      kind: kind, def: d, small: !!small,
      w: Math.round(d.w * s), h: Math.round(d.h * s),
      x: tx * T + (T - d.w * s) / 2, y: ty * T + T - d.h * s,
      vx: -d.spd * (small ? 1.3 : 1), vy: 0, face: -1,
      animT: Math.random() * 2, frame: 0, hp: d.hp,
      cool: G.rand(0.5, 2), fuseT: 0, dead: false, deadT: 0,
      hoverT: Math.random() * 6, spawnY: ty * T + T - d.h * s
    };
    G.S.mobs.push(m);
    return m;
  };

  G.updateMobs = function (dt) {
    var S = G.S, p = S.player;
    for (var i = S.mobs.length - 1; i >= 0; i--) {
      var m = S.mobs[i];
      m.animT += dt;
      if (m.dead) {
        m.deadT += dt;
        m.y += 120 * dt;
        if (m.deadT > 0.5) S.mobs.splice(i, 1);
        continue;
      }
      // 屏幕外的怪物休眠（性能 + 行为稳定）
      if (Math.abs(m.x - p.x) > 520) continue;

      var d = m.def;
      if (d.hover) {
        m.hoverT += dt;
        m.y = m.spawnY + Math.sin(m.hoverT * 1.6) * 12;
        m.vx = m.face * d.spd;
        m.x += m.vx * dt;
        // 撞墙折返
        var tx0 = Math.floor(m.x / T), tx1 = Math.floor((m.x + m.w - 1) / T);
        var tyc = Math.floor((m.y + m.h / 2) / T);
        if (G.solidAt(m.face > 0 ? tx1 : tx0, tyc)) { m.face *= -1; m.x -= m.vx * dt; }
      } else {
        m.vy = Math.min(PHYS.maxFall, m.vy + PHYS.grav * dt);
        if (d.hop) {
          m.cool -= dt;
          if (m.cool <= 0 && m.onGround) {
            m.cool = d.hop * G.rand(0.85, 1.2);
            m.vy = -280;
            m.face = p.x > m.x ? 1 : -1;
            m.vx = m.face * d.spd;
          }
          if (m.onGround) m.vx = G.approach(m.vx, 0, 400 * dt);
        } else if (d.fuse) {
          var dist = Math.abs(p.x - m.x);
          if (dist < 150 && Math.abs(p.y - m.y) < 60) m.face = p.x > m.x ? 1 : -1;
          m.vx = m.face * d.spd * (dist < 150 ? 1 : 0.5);
          if (dist < 26 && Math.abs(p.y - m.y) < 30 && m.fuseT <= 0) { m.fuseT = 0.85; G.SFX.play('shoot'); }
          if (m.fuseT > 0) {
            m.fuseT -= dt; m.vx *= 0.3;
            if (m.fuseT <= 0) { G.explode(m.x + m.w / 2, m.y + m.h / 2); G.killMob(m, false); continue; }
          }
        } else {
          m.vx = m.face * d.spd;
        }
        var hitM = G.moveBody(m, dt);
        m.onGround = hitM.down;
        if (hitM.left || hitM.right) m.face *= -1;
        // 走到边缘折返（不会自己走下悬崖）
        if (m.onGround && !d.hop) {
          var ahead = Math.floor((m.x + (m.face > 0 ? m.w + 2 : -2)) / T);
          var below = Math.floor((m.y + m.h + 2) / T);
          if (!G.solidAt(ahead, below) && !G.oneWayAt(ahead, below)) m.face *= -1;
        }
        if (hitM.hazard === 'lava' || m.y > S.H * T + 30) { G.killMob(m, false); continue; }
      }

      // 远程攻击
      if (d.shoot) {
        m.cool -= dt;
        if (m.cool <= 0 && Math.abs(p.x - m.x) < 240 && Math.abs(p.y - m.y) < 90) {
          m.cool = d.shoot * G.rand(0.9, 1.2);
          m.aim = 0.45;
        }
        if (m.aim > 0) {
          m.aim -= dt;
          if (m.aim <= 0) {
            var dir = p.x > m.x ? 1 : -1;
            m.face = dir;
            S.bullets.push({
              x: m.x + m.w / 2, y: m.y + m.h * 0.35, w: 8, h: 6,
              vx: dir * (m.kind === 'blaze' ? 150 : 190), vy: m.kind === 'blaze' ? 0 : -30,
              kind: m.kind === 'blaze' ? 'fire' : 'arrow', life: 3, rot: 0
            });
            G.SFX.play('shoot');
          }
        }
      }
      m.frame = ((m.animT * (m.kind === 'slime' ? 5 : 6)) | 0) % G.PX.mobFrames(m.kind);

      // 与玩家交互：踩头 / 受伤
      if (!p.dead && S.mode === 'play' && rectHit(p, m)) {
        var stomping = p.vy > 40 && (p.y + p.h) - m.y < 14;
        if (stomping && d.stomp) {
          if (m.kind === 'slime' && !m.small) {          // 大史莱姆分裂
            G.spawnMob('slime', Math.floor(m.x / T), Math.floor(m.y / T), true).vx = -80;
            G.spawnMob('slime', Math.floor(m.x / T) + 1, Math.floor(m.y / T), true).vx = 80;
          }
          G.killMob(m, true);
          p.vy = -PHYS.stompBounce;
          p.jumping = true;
          S.score += d.score;
          S.shake = Math.max(S.shake, 3);
        } else {
          G.hurtPlayer(1);
        }
      }
    }
  };

  function rectHit(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }
  G.rectHit = rectHit;

  G.killMob = function (m, byStomp) {
    if (m.dead) return;
    m.dead = true; m.deadT = 0;
    var col = m.kind === 'skeleton' ? '#d9d6c6' : (m.kind === 'slime' ? '#68c468' : (m.kind === 'blaze' ? '#ffb43b' : '#5b8a45'));
    G.burst(m.x + m.w / 2, m.y + m.h / 2, 14, col, 130, 0.5);
    G.popText(m.x + m.w / 2, m.y, '+' + m.def.score, '#ffe066');
    if (byStomp) G.SFX.play('stomp');
  };

  G.explode = function (x, y) {
    var S = G.S;
    S.fx.push({ kind: 'boom', x: x, y: y, t: 0, life: 0.4, r: 34 });
    G.burst(x, y, 26, '#ffb43b', 190, 0.55);
    G.burst(x, y, 12, '#6b6b6b', 140, 0.7);
    G.SFX.play('boom');
    S.shake = Math.max(S.shake, 9);
    var p = S.player;
    if (Math.abs(p.x + p.w / 2 - x) < 46 && Math.abs(p.y + p.h / 2 - y) < 46) G.hurtPlayer(1);
    // 炸掉附近的泥土/沙子
    var tx = Math.floor(x / T), ty = Math.floor(y / T);
    for (var j = -1; j <= 1; j++) for (var i = -1; i <= 1; i++) {
      var k = G.tileAt(tx + i, ty + j);
      if (k === 'dirt' || k === 'sand' || k === 'leaves') G.breakTile(tx + i, ty + j);
    }
  };

  /* ---------------- 怪物子弹 ---------------- */
  G.updateBullets = function (dt) {
    var S = G.S, p = S.player;
    for (var i = S.bullets.length - 1; i >= 0; i--) {
      var b = S.bullets[i];
      b.life -= dt;
      if (b.kind === 'arrow') b.vy += 260 * dt;
      b.x += b.vx * dt; b.y += b.vy * dt;
      b.rot = Math.atan2(b.vy, b.vx);
      var tx = Math.floor((b.x + b.w / 2) / T), ty = Math.floor((b.y + b.h / 2) / T);
      if (G.solidAt(tx, ty) || b.life <= 0) {
        G.burst(b.x, b.y, 4, b.kind === 'fire' ? '#ffb43b' : '#c9c6b4', 60, 0.3);
        S.bullets.splice(i, 1);
        continue;
      }
      if (!p.dead && rectHit(p, b)) {
        G.hurtPlayer(1);
        S.bullets.splice(i, 1);
      }
    }
  };

  /* ---------------- 道具 ---------------- */
  G.spawnItem = function (kind, x, y, pop) {
    G.S.items.push({
      kind: kind, x: x, y: y, w: 12, h: 12,
      vx: pop ? G.rand(-30, 30) : 0, vy: pop ? -210 : 0,
      t: Math.random() * 3, taken: false, pop: !!pop, baseY: y
    });
  };
  G.updateItems = function (dt) {
    var S = G.S, p = S.player;
    for (var i = S.items.length - 1; i >= 0; i--) {
      var it = S.items[i];
      it.t += dt;
      if (it.pop) {
        it.vy += PHYS.grav * 0.6 * dt;
        it.x += it.vx * dt; it.y += it.vy * dt;
        var ty = Math.floor((it.y + it.h) / T), tx = Math.floor((it.x + it.w / 2) / T);
        if (G.solidAt(tx, ty) || G.oneWayAt(tx, ty)) { it.y = ty * T - it.h; it.vy = 0; it.vx *= 0.7; it.pop = false; it.baseY = it.y; }
      }
      if (rectHit(p, { x: it.x, y: it.y, w: it.w, h: it.h }) && !p.dead) {
        S.items.splice(i, 1);
        if (it.kind === 'emerald') { S.score += 50; S.gems++; G.SFX.play('coin'); G.popText(it.x, it.y, '+50', '#3fd97a'); }
        else if (it.kind === 'diamond') { S.score += 300; S.gems += 5; G.SFX.play('coin'); G.popText(it.x, it.y, '+300', '#4fd9d0'); }
        else if (it.kind === 'apple') {
          if (p.hearts < p.maxHearts) { p.hearts++; G.popText(it.x, it.y, '+1 ♥', '#e2384a'); }
          else { S.score += 100; G.popText(it.x, it.y, '+100', '#ffe066'); }
          G.SFX.play('heal');
        } else if (it.kind === 'heart') { p.maxHearts++; p.hearts = p.maxHearts; G.SFX.play('heal'); G.popText(it.x, it.y, '最大生命 +1', '#e2384a'); }
        else if (it.kind === 'torch') { S.checkpoint = { x: it.x, y: it.y }; G.SFX.play('check'); G.popText(it.x, it.y, '存档点！', '#ffb43b'); }
        G.burst(it.x + 6, it.y + 6, 8, '#ffe066', 90, 0.4);
      }
    }
  };

  /* ---------------- 粒子 / 飘字 ---------------- */
  G.burst = function (x, y, n, col, spd, life, gy) {
    var S = G.S;
    if (!S) return;
    if (S.parts.length > 700) n = Math.min(n, 3);
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2, s = G.rand(spd * 0.3, spd);
      S.parts.push({
        x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 30,
        life: life * G.rand(0.6, 1.25), max: life, col: col,
        size: G.randInt(1, 3), gy: gy === undefined ? 420 : gy
      });
    }
  };
  G.updateParts = function (dt) {
    var S = G.S;
    for (var i = S.parts.length - 1; i >= 0; i--) {
      var q = S.parts[i];
      q.life -= dt;
      if (q.life <= 0) { S.parts.splice(i, 1); continue; }
      q.x += q.vx * dt; q.y += q.vy * dt;
      q.vy += q.gy * dt;
      q.vx *= Math.pow(0.35, dt);
    }
  };
  G.popText = function (x, y, text, col) {
    var S = G.S;
    if (S.texts.length > 40) return;
    S.texts.push({ x: x, y: y, text: text, col: col || '#fff', life: 0.9, vy: -46 });
  };
  G.updateTexts = function (dt) {
    var S = G.S;
    for (var i = S.texts.length - 1; i >= 0; i--) {
      var t = S.texts[i];
      t.life -= dt; t.y += t.vy * dt; t.vy *= Math.pow(0.25, dt);
      if (t.life <= 0) S.texts.splice(i, 1);
    }
  };
  G.updateFx = function (dt) {
    var S = G.S;
    for (var i = S.fx.length - 1; i >= 0; i--) {
      S.fx[i].t += dt;
      if (S.fx[i].t >= S.fx[i].life) S.fx.splice(i, 1);
    }
  };
})();
