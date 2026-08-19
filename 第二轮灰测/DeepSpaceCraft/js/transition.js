/* DEEP SPACE CRAFT · transition.js —— 大气层进入 / 起飞离场 的电影化过渡序列
   进入：俯冲 → 等离子燃烧 → 冲破云层 → 降落着陆（世界在此期间流式生成，不卡帧）
   离开：点火 → 爬升 → 冲出大气（天空渐变为星空） */
(function () {
  'use strict';
  var DSC = (window.DSC = window.DSC || {});
  var U = DSC.Util, V3 = DSC.V3, A = function () { return DSC.Audio; };

  var T = {
    cur: null,

    isActive: function () { return !!T.cur; },
    progress: function () { return T.cur ? T.cur.total : 0; },

    /* ============================================================ 进入大气层 */
    beginEntry: function (planet, onDone) {
      if (T.cur) return false;
      var G = DSC.Game, sh = DSC.Space.ship;
      /* 依据飞船当前位置在星球表面选一个落点（用经纬度哈希成体素坐标） */
      var d = V3.sub(sh.pos, planet.pos);
      V3.norm(d, d);
      var lon = Math.atan2(d[2], d[0]), lat = Math.asin(U.clamp(d[1], -1, 1));
      var wx = Math.round(lon * 2600 + planet.seed % 997);
      var wz = Math.round(lat * 2600 + (planet.seed >> 7) % 991);

      T.cur = {
        kind: 'entry', phase: 'dive', t: 0, total: 0, planet: planet, onDone: onDone,
        landX: wx, landZ: wz, spot: null, streamT: 0, ready: false,
        shake: 0, heat: 0, plasma: 0, starFade: 1, skyBlend: 1,
        shipY: 0, shipStartY: 0, descT: 0, boomed: false
      };
      /* 立即开始世界流式生成（不阻塞） */
      DSC.Game.prepareWorld(planet, wx, wz);
      T.cur.spot = DSC.World.findLandingSpot(wx, wz);

      A() && A().play('ship_alarm', { volume: 0.7 });
      A() && A().loop('atmos_burn', { volume: 0.0 });
      A() && A().setMusic('none');
      if (DSC.UI) DSC.UI.entryWarning(true, 0);
      return true;
    },

    /* ============================================================ 起飞离场 */
    beginExit: function (planet, onDone) {
      if (T.cur) return false;
      var G = DSC.Game;
      T.cur = {
        kind: 'exit', phase: 'ignite', t: 0, total: 0, planet: planet, onDone: onDone,
        shake: 0, heat: 0, plasma: 0, starFade: 0, skyBlend: 0, y0: G.shipLocal.pos[1]
      };
      A() && A().play('ship_start', { volume: 0.9 });
      A() && A().play('ship_takeoff', { volume: 0.85, delay: 0.55 });
      A() && A().setMusic('none');
      A() && A().wind(0.2);
      return true;
    },

    /* ============================================================ 更新 */
    update: function (dt) {
      var c = T.cur;
      if (!c) return;
      c.t += dt; c.total += dt;
      if (c.kind === 'entry') T._entry(dt, c); else T._exit(dt, c);
    },

    _entry: function (dt, c) {
      var G = DSC.Game, sh = DSC.Space.ship, P = c.planet;
      /* 每帧继续流式生成落点周围 */
      G.streamWorld(c.landX, c.landZ, dt);

      if (c.phase === 'dive') {
        /* 1.5s：俯冲、警报、等离子起燃 */
        var k = U.clamp(c.t / 1.5, 0, 1);
        c.shake = k * 0.055; c.heat = k * 0.5; c.plasma = k * 0.5;
        c.starFade = 1 - k * 0.35;
        /* 飞船继续朝星球前进 */
        var toP = V3.norm(V3.sub(P.pos, sh.pos));
        for (var i = 0; i < 3; i++) {
          sh.fwd[i] = sh.fwd[i] + (toP[i] - sh.fwd[i]) * Math.min(1, dt * 1.5);
          sh.pos[i] += sh.fwd[i] * (900 + 2600 * k) * dt;
        }
        V3.norm(sh.fwd, sh.fwd);
        sh.yaw = Math.atan2(-sh.fwd[0], -sh.fwd[2]);
        sh.pitch = Math.asin(U.clamp(sh.fwd[1], -1, 1));
        DSC.Space.syncCam(false, dt);
        if (A()) { A().engine(1, 0.35); var lp = A().loop('atmos_burn'); if (lp) lp.gain(k * 0.55); }
        if (DSC.UI) DSC.UI.entryWarning(true, k * 0.45);
        if (c.t >= 1.7) { c.phase = 'burn'; c.t = 0; }
      }
      else if (c.phase === 'burn') {
        /* 2.3s：剧烈燃烧、屏幕橙红、抖动最大 */
        var k2 = U.clamp(c.t / 2.0, 0, 1);
        c.shake = 0.055 + k2 * 0.075;
        c.heat = 0.5 + k2 * 0.8;
        c.plasma = 0.5 + k2 * 0.5;
        c.starFade = 0.65 - k2 * 0.65;
        var toP2 = V3.norm(V3.sub(P.pos, sh.pos));
        for (var j = 0; j < 3; j++) sh.pos[j] += toP2[j] * 3200 * dt;
        DSC.Space.syncCam(false, dt);
        if (A()) { var lp2 = A().loop('atmos_burn'); if (lp2) lp2.gain(0.55 + k2 * 0.45); A().engine(1, 0.5); }
        if (DSC.UI) DSC.UI.entryWarning(true, 0.45 + k2 * 0.55);
        /* 等离子碎片 */
        if (DSC.Particles) {
          for (var p = 0; p < 4; p++) {
            var ang = Math.random() * Math.PI * 2, rr = 2 + Math.random() * 4;
            DSC.Particles.spawn(
              sh.pos[0] + Math.cos(ang) * rr, sh.pos[1] + Math.sin(ang) * rr * 0.6, sh.pos[2] + Math.sin(ang) * rr,
              -sh.fwd[0] * 40, -sh.fwd[1] * 40, -sh.fwd[2] * 40,
              [1, 0.45 + Math.random() * 0.3, 0.12], 1.4 + Math.random() * 1.6, 0.35, { grav: 0, drag: 0.8, glow: 1 });
          }
        }
        if (c.t >= 2.0) {
          c.phase = 'flash'; c.t = 0;
          A() && A().play('atmos_boom', { volume: 0.95 });
          if (DSC.UI) { DSC.UI.fx('flash', 1); DSC.UI.entryWarning(false); }
          /* 切换到星球场景：飞船从高空降落 */
          var spot = c.spot;
          G.shipLocal.pos[0] = spot[0] + 0.5;
          G.shipLocal.pos[1] = spot[1] + 72;
          G.shipLocal.pos[2] = spot[2] + 0.5;
          G.shipLocal.yaw = Math.random() * Math.PI * 2;
          G.shipLocal.pitch = -0.22; G.shipLocal.roll = 0;
          G.shipLocal.visible = true; G.shipLocal.gear = 0;
          c.shipStartY = G.shipLocal.pos[1];
          G.enterPlanetScene(P, spot);
          A() && A().wind(0.85);
        }
      }
      else if (c.phase === 'flash') {
        /* 0.45s：白光过渡 —— 已经在星球场景里，云层掠过 */
        var k3 = U.clamp(c.t / 0.4, 0, 1);
        c.shake = 0.11 * (1 - k3 * 0.4);
        c.heat = 1.3 * (1 - k3 * 0.35);
        c.plasma = 1 - k3 * 0.55;
        c.skyBlend = 1 - k3 * 0.45;
        if (DSC.UI) DSC.UI.fx('flash', 1 - k3);
        T._descend(dt, c, 34);
        if (c.t >= 0.4) { c.phase = 'clouds'; c.t = 0; }
      }
      else if (c.phase === 'clouds') {
        /* 1.5s：穿云 —— 白色云絮飞掠 + 天空色渐入 */
        var k4 = U.clamp(c.t / 1.2, 0, 1);
        c.shake = 0.06 * (1 - k4);
        c.heat = 0.85 * (1 - k4);
        c.plasma = 0.45 * (1 - k4);
        c.skyBlend = 0.55 * (1 - k4);
        c.starFade = 0;
        T._descend(dt, c, 30 - k4 * 8);
        if (DSC.Particles && Math.random() < dt * 40) {
          var sp = DSC.Game.shipLocal.pos;
          DSC.Particles.spawn(sp[0] + (Math.random() - .5) * 30, sp[1] + 6 + Math.random() * 12, sp[2] + (Math.random() - .5) * 30,
            0, -34, 0, [1, 1, 1], 3.5 + Math.random() * 4, 0.75, { grav: 0, drag: 0.4 });
        }
        if (A()) { var lp3 = A().loop('atmos_burn'); if (lp3) lp3.gain(0.5 * (1 - k4)); }
        if (c.t >= 1.2) {
          c.phase = 'descent'; c.t = 0;
          if (A()) A().stopLoop('atmos_burn', 0.8);
        }
      }
      else if (c.phase === 'descent') {
        /* 落地：减速 + 放起落架 + 尘土 */
        var G2 = DSC.Game, sl = G2.shipLocal;
        var groundY = c.spot[1];
        var alt = sl.pos[1] - groundY;
        var rate = U.clamp(alt * 2.2, 10, 40);
        sl.pos[1] -= rate * dt;
        sl.pitch = U.approach(sl.pitch, 0, 3, dt);
        sl.gear = U.clamp(1 - alt / 12, 0, 1);
        c.shake = 0.012 + 0.02 * U.clamp(1 - alt / 20, 0, 1);
        c.skyBlend = 0;
        if (A()) A().engine(U.clamp(alt / 40, 0.15, 0.8), 0);
        /* 着陆扬尘 */
        if (DSC.Particles && alt < 14) {
          var col = DSC.Blocks.color(DSC.World.blockAt(Math.floor(sl.pos[0]), groundY - 1, Math.floor(sl.pos[2])) || 1);
          for (var q = 0; q < 3; q++) {
            var a2 = Math.random() * Math.PI * 2, r2 = 1 + Math.random() * 5;
            DSC.Particles.spawn(sl.pos[0] + Math.cos(a2) * r2, groundY + 0.2, sl.pos[2] + Math.sin(a2) * r2,
              Math.cos(a2) * 3.5, 1.2 + Math.random() * 1.5, Math.sin(a2) * 3.5,
              col, 0.35 + Math.random() * 0.4, 0.9, { grav: -2.2, drag: 1.6 });
          }
        }
        if (alt <= 0.6) {
          sl.pos[1] = groundY;
          sl.gear = 1;
          c.phase = 'settle'; c.t = 0;
          A() && A().play('ship_land', { volume: 0.95 });
          if (DSC.Particles) {
            var col2 = DSC.Blocks.color(DSC.World.blockAt(Math.floor(sl.pos[0]), groundY - 1, Math.floor(sl.pos[2])) || 1);
            DSC.Particles.burst(sl.pos[0], groundY + 0.3, sl.pos[2], col2, 46, { speed: 7.5, up: 3.2, size: 0.4, life: 1.5, grav: -6 });
          }
        }
      }
      else if (c.phase === 'settle') {
        /* 0.9s：引擎停转，镜头稳定，行星信息卡打字机展开 */
        var k5 = U.clamp(c.t / 0.9, 0, 1);
        c.shake = 0.012 * (1 - k5);
        c.heat = 0;
        if (A()) A().engine(0.15 * (1 - k5), 0);
        if (!c.carded) {
          c.carded = true;
          if (DSC.UI) DSC.UI.planetCard(c.planet, true);
          A() && A().setMusic('planet');
        }
        if (c.t >= 0.9) {
          if (A()) A().engine(0, 0);
          var done = c.onDone;
          T.cur = null;
          if (DSC.UI) { DSC.UI.entryWarning(false); DSC.UI.fx('entry', 0); DSC.UI.fx('flash', 0); }
          if (done) done();
        }
      }
      T._pushFx(c);
    },

    _descend: function (dt, c, speed) {
      var sl = DSC.Game.shipLocal;
      sl.pos[1] = Math.max(c.spot[1], sl.pos[1] - speed * dt);
      sl.pitch = U.approach(sl.pitch, -0.05, 1.6, dt);
    },

    _exit: function (dt, c) {
      var G = DSC.Game, sl = G.shipLocal;
      if (c.phase === 'ignite') {
        var k = U.clamp(c.t / 1.3, 0, 1);
        c.shake = k * 0.03;
        sl.engineGlow = k;
        if (A()) A().engine(k * 0.6, 0);
        if (DSC.Particles && Math.random() < dt * 60) {
          var col = DSC.Blocks.color(DSC.World.blockAt(Math.floor(sl.pos[0]), Math.floor(sl.pos[1]) - 1, Math.floor(sl.pos[2])) || 1);
          var a = Math.random() * Math.PI * 2, r = 1 + Math.random() * 4;
          DSC.Particles.spawn(sl.pos[0] + Math.cos(a) * r, sl.pos[1] + 0.2, sl.pos[2] + Math.sin(a) * r,
            Math.cos(a) * 5, 2 + Math.random() * 2, Math.sin(a) * 5, col, 0.4, 1.1, { grav: -3, drag: 1.4 });
        }
        if (c.t >= 1.3) { c.phase = 'ascend'; c.t = 0; }
      }
      else if (c.phase === 'ascend') {
        var k2 = U.clamp(c.t / 2.8, 0, 1);
        var v = 6 + k2 * k2 * 130;
        sl.pos[1] += v * dt;
        sl.gear = U.clamp(1 - k2 * 3, 0, 1);
        sl.pitch = U.approach(sl.pitch, 0.42, 1.2, dt);
        c.shake = 0.02 + k2 * 0.05;
        c.heat = k2 * 0.55;
        c.plasma = k2 * 0.45;
        c.skyBlend = k2;         /* 天空 → 星空 */
        c.starFade = k2;
        if (A()) { A().engine(0.6 + k2 * 0.4, k2 * 0.6); A().wind(0.85 * (1 - k2)); }
        if (DSC.Particles) {
          for (var i = 0; i < 2; i++)
            DSC.Particles.spawn(sl.pos[0] + (Math.random() - .5) * 1.6, sl.pos[1] - 2.6, sl.pos[2] + (Math.random() - .5) * 1.6,
              (Math.random() - .5) * 2, -14 - Math.random() * 10, (Math.random() - .5) * 2,
              [1, 0.6, 0.25], 0.55, 0.4, { grav: 0, drag: 1.2, glow: 1 });
        }
        if (c.t >= 2.8) {
          c.phase = 'break'; c.t = 0;
          A() && A().play('atmos_boom', { volume: 0.55 });
          if (DSC.UI) DSC.UI.fx('flash', 0.7);
          G.exitToSpace(c.planet);
        }
      }
      else if (c.phase === 'break') {
        var k3 = U.clamp(c.t / 1.2, 0, 1);
        c.shake = 0.05 * (1 - k3);
        c.heat = 0.55 * (1 - k3);
        c.plasma = 0.45 * (1 - k3);
        c.starFade = 1;
        if (DSC.UI) DSC.UI.fx('flash', 0.7 * (1 - k3));
        if (A()) { A().engine(0.85, 0.2); A().wind(0); }
        if (!c.musicked && k3 > 0.35) { c.musicked = true; A() && A().setMusic('space'); }
        if (c.t >= 1.2) {
          var done = c.onDone;
          T.cur = null;
          if (DSC.UI) { DSC.UI.fx('flash', 0); DSC.UI.fx('entry', 0); }
          if (done) done();
        }
      }
      T._pushFx(c);
    },

    _pushFx: function (c) {
      if (!DSC.UI) return;
      DSC.UI.fx('entry', U.clamp(c.plasma, 0, 1));
      DSC.UI.fx('warp', 0);
    },

    /* 供 main 渲染时读取的视觉参数 */
    visual: function () {
      var c = T.cur;
      if (!c) return null;
      return {
        kind: c.kind, phase: c.phase, shake: c.shake, heat: c.heat,
        starFade: c.starFade, skyBlend: c.skyBlend, plasma: c.plasma,
        /* 太空侧场景 or 星球侧场景 */
        inSpace: (c.kind === 'entry') ? (c.phase === 'dive' || c.phase === 'burn')
          : (c.phase === 'break')
      };
    }
  };

  DSC.Transition = T;
})();
