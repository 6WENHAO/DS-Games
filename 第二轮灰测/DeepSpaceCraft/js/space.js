/* DEEP SPACE CRAFT · space.js —— 星系场景 / 飞船飞行 / 目标锁定 / 曲速跳跃 */
(function () {
  'use strict';
  var DSC = (window.DSC = window.DSC || {});
  var GL = DSC.GL, M4 = DSC.M4, V3 = DSC.V3, U = DSC.Util;
  /* 相机惰性解析：标题界面会在未调用 Space.init 的情况下直接渲染太空背景，
     若只在 init 里赋值，冷启动首帧就会 Cam 为 null 而崩溃（务必保持这个兜底） */
  var Cam = null;
  function cam() { return Cam || (Cam = DSC.Cam); }
  var A = function () { return DSC.Audio; };

  var MAX_SPEED = 1500, PULSE_SPEED = 16000, ACCEL = 2.6;

  var Space = {
    system: null, galaxy: null,
    ship: {
      pos: new Float32Array([0, 0, 0]),
      vel: new Float32Array([0, 0, 0]),
      yaw: 0, pitch: 0, roll: 0,
      throttle: 0.35, pulse: 0, pulseHeld: 0,
      hull: 100, shield: 100,
      fwd: new Float32Array([0, 0, -1])
    },
    camPos: new Float32Array([0, 0, 0]), camLook: new Float32Array([0, 0, 0]),
    target: null, targetLock: 0,
    speed: 0,
    time: 0, warp: null, entryReq: null,
    hint: '',

    init: function (galaxy, system, fromPlanet) {
      cam();
      Space.galaxy = galaxy;
      Space.system = system;
      Space.entryReq = null;
      Space.warp = null;
      var sh = Space.ship;
      Space.updateOrbits(0);
      if (fromPlanet) {
        /* 从星球起飞：出现在该星球上方 */
        var p = fromPlanet;
        var d = p.radius * 1.9;
        sh.pos[0] = p.pos[0] + d * 0.35; sh.pos[1] = p.pos[1] + d * 0.55; sh.pos[2] = p.pos[2] + d * 0.72;
        Space.lookAtPoint([0, 0, 0]);
      } else {
        var p0 = system.planets[0];
        sh.pos[0] = p0.pos[0] * 0.72; sh.pos[1] = 2600; sh.pos[2] = p0.pos[2] * 0.72 + 5200;
        Space.lookAtPoint(p0.pos);
      }
      sh.vel[0] = sh.vel[1] = sh.vel[2] = 0;
      sh.throttle = 0.3; sh.pulse = 0;
      Space.syncCam(true);
      return Space;
    },

    lookAtPoint: function (p) {
      var sh = Space.ship;
      var dx = p[0] - sh.pos[0], dy = p[1] - sh.pos[1], dz = p[2] - sh.pos[2];
      var len = Math.sqrt(dx * dx + dz * dz);
      sh.yaw = Math.atan2(-dx, -dz);
      sh.pitch = Math.atan2(dy, len);
      sh.roll = 0;
    },

    /* ---------------------------------------------------------- 轨道 */
    updateOrbits: function (dt) {
      var S = Space.system;
      if (!S) return;
      for (var i = 0; i < S.planets.length; i++) {
        var p = S.planets[i];
        p.orbitAngle += p.orbitSpeed * dt;
        p.spinAngle = (p.spinAngle || 0) + p.spin * dt;
        var r = p.orbitRadius;
        if (!p.pos) p.pos = new Float32Array(3);
        p.pos[0] = Math.cos(p.orbitAngle) * r;
        p.pos[1] = Math.sin(p.orbitAngle * 0.7) * r * p.orbitTilt * 0.25;
        p.pos[2] = Math.sin(p.orbitAngle) * r;
      }
      var st = S.station;
      st.angle += 0.00035 * dt * 60;
      if (!st.pos) st.pos = new Float32Array(3);
      st.pos[0] = Math.cos(st.angle) * st.dist;
      st.pos[1] = st.y;
      st.pos[2] = Math.sin(st.angle) * st.dist;
      st.spinAngle = (st.spinAngle || 0) + dt * 0.12;
    },

    /* ---------------------------------------------------------- 飞行更新 */
    update: function (dt, input, allowControl) {
      cam();
      Space.time += dt;
      Space.updateOrbits(dt * 60);
      var sh = Space.ship;

      /* 转向 */
      if (allowControl) {
        var sens = (input.sens || 1) * 0.0016;
        sh.yaw -= input.mdx * sens;
        sh.pitch -= input.mdy * sens;
        sh.pitch = U.clamp(sh.pitch, -1.45, 1.45);
        var rollIn = (input.key('a') ? 1 : 0) - (input.key('d') ? 1 : 0);
        sh.roll = U.approach(sh.roll, rollIn * 0.75 - input.mdx * 0.0025, 4, dt);
        /* 油门 */
        if (input.key('w')) sh.throttle = U.clamp(sh.throttle + dt * 0.85, 0, 1);
        if (input.key('s')) sh.throttle = U.clamp(sh.throttle - dt * 0.85, 0, 1);
        if (input.key('x')) sh.throttle = U.approach(sh.throttle, 0, 6, dt);
        /* 脉冲引擎（Shift 按住 0.35s 后启动） */
        if (input.key('shift') && sh.throttle > 0.25) {
          sh.pulseHeld += dt;
          if (sh.pulseHeld > 0.3) {
            if (sh.pulse < 0.02) A() && A().play('ship_pulse', { volume: 0.9 });
            sh.pulse = U.approach(sh.pulse, 1, 1.1, dt);
          }
        } else {
          sh.pulseHeld = 0;
          sh.pulse = U.approach(sh.pulse, 0, 2.2, dt);
        }
      } else {
        sh.pulse = U.approach(sh.pulse, 0, 2.5, dt);
      }

      /* 姿态 → 前向 */
      var cp = Math.cos(sh.pitch), sp = Math.sin(sh.pitch), cy = Math.cos(sh.yaw), sy = Math.sin(sh.yaw);
      sh.fwd[0] = -sy * cp; sh.fwd[1] = sp; sh.fwd[2] = -cy * cp;

      /* 速度 */
      var maxS = MAX_SPEED + (PULSE_SPEED - MAX_SPEED) * U.smoothstep(0, 1, sh.pulse);
      var target = sh.throttle * maxS;
      var accel = ACCEL * (1 + sh.pulse * 2.6);
      for (var i = 0; i < 3; i++) {
        sh.vel[i] = U.approach(sh.vel[i], sh.fwd[i] * target, accel, dt);
        sh.pos[i] += sh.vel[i] * dt;
      }
      Space.speed = V3.len(sh.vel);

      /* 引擎音 */
      if (A()) A().engine(sh.throttle * (0.5 + 0.5 * Math.min(1, Space.speed / MAX_SPEED)), sh.pulse);

      /* 目标锁定：视线最近星球/空间站 */
      Space.pickTarget();

      /* 大气层接近检测 */
      Space.entryReq = null;
      Space.hint = '';
      var S = Space.system;
      for (i = 0; i < S.planets.length; i++) {
        var p = S.planets[i];
        var d = V3.dist(sh.pos, p.pos);
        var alt = d - p.radius;
        var entryAlt = p.radius * 0.42;
        if (alt < entryAlt) {
          /* 是否朝向星球俯冲 */
          var toP = [(p.pos[0] - sh.pos[0]) / d, (p.pos[1] - sh.pos[1]) / d, (p.pos[2] - sh.pos[2]) / d];
          var dot = toP[0] * sh.fwd[0] + toP[1] * sh.fwd[1] + toP[2] * sh.fwd[2];
          if (alt < entryAlt * 0.55 && dot > 0.55 && sh.throttle > 0.15) {
            Space.entryReq = p;
          } else {
            Space.hint = '对准 ' + (p.customName || p.name) + ' 并保持推力以进入大气层';
          }
          Space.nearPlanet = p; Space.nearAlt = alt;
          break;
        }
        Space.nearPlanet = null;
      }

      /* 引擎尾焰粒子 */
      if (DSC.Particles && Space.speed > 30) {
        var back = [sh.pos[0] - sh.fwd[0] * 3.4, sh.pos[1] - sh.fwd[1] * 3.4, sh.pos[2] - sh.fwd[2] * 3.4];
        var col = sh.pulse > 0.2 ? [0.45, 0.85, 1.0] : [1.0, 0.55, 0.2];
        for (i = 0; i < 2; i++) {
          DSC.Particles.spawn(
            back[0] + (Math.random() - .5) * 1.6, back[1] + (Math.random() - .5) * 1.0, back[2] + (Math.random() - .5) * 1.6,
            -sh.fwd[0] * 12, -sh.fwd[1] * 12, -sh.fwd[2] * 12,
            col, 0.9 + Math.random() * 0.9, 0.22 + Math.random() * 0.2, { grav: 0, drag: 1.4, glow: 1 });
        }
      }
      Space.syncCam(false, dt);
    },

    pickTarget: function () {
      var sh = Space.ship, S = Space.system, best = null, bestScore = -1;
      var i, cand = [];
      for (i = 0; i < S.planets.length; i++) cand.push({ kind: 'planet', obj: S.planets[i], pos: S.planets[i].pos });
      cand.push({ kind: 'station', obj: S.station, pos: S.station.pos });
      for (i = 0; i < cand.length; i++) {
        var c = cand[i];
        var dx = c.pos[0] - sh.pos[0], dy = c.pos[1] - sh.pos[1], dz = c.pos[2] - sh.pos[2];
        var d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
        var dot = (dx * sh.fwd[0] + dy * sh.fwd[1] + dz * sh.fwd[2]) / d;
        if (dot < 0.55) continue;
        var score = dot - d / 200000;
        if (score > bestScore) { bestScore = score; best = { kind: c.kind, obj: c.obj, dist: d, dot: dot }; }
      }
      Space.target = best;
    },

    syncCam: function (snap, dt) {
      var Cam = cam();
      var sh = Space.ship;
      /* 追尾机位：船后上方，带速度拉远与惯性 */
      var spd = isFinite(Space.speed) ? Space.speed : 0;
      var back = 19 + Math.min(9, spd / 900) + sh.pulse * 8;
      var up = 5.2;
      var cp = Math.cos(sh.pitch), sp = Math.sin(sh.pitch), cy = Math.cos(sh.yaw), sy = Math.sin(sh.yaw);
      var f = [-sy * cp, sp, -cy * cp];
      var r = [cy, 0, -sy];
      var u = [-r[1] * f[2] + r[2] * f[1], -r[2] * f[0] + r[0] * f[2], -r[0] * f[1] + r[1] * f[0]];
      var want = [
        sh.pos[0] - f[0] * back + u[0] * up,
        sh.pos[1] - f[1] * back + u[1] * up,
        sh.pos[2] - f[2] * back + u[2] * up
      ];
      var k = snap ? 1 : 1 - Math.exp(-9 * (dt || 0.016));
      /* 任一分量非法（NaN/Inf）时直接赋值，避免 NaN 传染整个相机链 */
      if (snap || !isFinite(Cam.pos[0]) || !isFinite(Cam.pos[1]) || !isFinite(Cam.pos[2])) {
        Cam.pos[0] = want[0]; Cam.pos[1] = want[1]; Cam.pos[2] = want[2];
      } else {
        Cam.pos[0] += (want[0] - Cam.pos[0]) * k;
        Cam.pos[1] += (want[1] - Cam.pos[1]) * k;
        Cam.pos[2] += (want[2] - Cam.pos[2]) * k;
      }
      Cam.yaw = sh.yaw; Cam.pitch = sh.pitch - 0.055; Cam.roll = -sh.roll * 0.55;
    },

    shipMatrix: function (extraRoll) {
      var sh = Space.ship;
      var m = M4.identity();
      M4.translate(m, sh.pos, m);
      M4.rotateY(m, sh.yaw, m);
      M4.rotateX(m, sh.pitch, m);
      M4.rotateZ(m, -(sh.roll + (extraRoll || 0)), m);
      return m;
    },

    /* ---------------------------------------------------------- 渲染 */
    render: function (dt, opts) {
      opts = opts || {};
      var Cam = cam();
      if (!Cam || !Space.system) return;
      var R = DSC.Render, SFX = DSC.SpaceFX, S = Space.system, sh = Space.ship;
      var aspect = GL.W / GL.H;
      var i;

      /* ---- 远景：星空 + 恒星 + 星球 ---- */
      Cam.near = 40; Cam.far = 4.0e6;
      Cam.fov = (opts.fov || 78) + sh.pulse * 16;
      Cam.update(aspect);
      R.setSpaceEnv();

      if (SFX && SFX.drawBackground) {
        SFX.drawBackground({
          viewProj: Cam.viewProj, invViewProj: Cam.invViewProj, camPos: Cam.pos,
          time: Space.time, seed: (S.seed % 4096) / 4096,
          nebulaA: S.nebulaA, nebulaB: S.nebulaB, starDensity: S.starDensity,
          /* 深空要"暗底亮点"：压低星云强度与曝光，让星点/星球/恒星跳出来 */
          nebulaIntensity: 0.42, exposure: 0.62,
          fade: opts.starFade === undefined ? 1 : opts.starFade
        });
      }
      /* 恒星在原点 */
      var ctx = { viewProj: Cam.viewProj, invViewProj: Cam.invViewProj, camPos: Cam.pos, time: Space.time };
      var order = [];
      for (i = 0; i < S.planets.length; i++) {
        var p = S.planets[i];
        order.push({ d: V3.dist(Cam.pos, p.pos), p: p });
      }
      order.sort(function (a, b) { return b.d - a.d; });
      if (SFX && SFX.drawStar) {
        SFX.drawStar(ctx, { pos: [0, 0, 0], radius: 5200, color: S.starColor, coronaScale: 2.6 });
      }
      var sunDirFor = function (pos) {
        var l = Math.sqrt(pos[0] * pos[0] + pos[1] * pos[1] + pos[2] * pos[2]) || 1;
        return [-pos[0] / l, -pos[1] / l, -pos[2] / l];
      };
      for (i = 0; i < order.length; i++) {
        var pp = order[i].p;
        if (SFX && SFX.drawPlanet) {
          SFX.drawPlanet(ctx, {
            pos: pp.pos, radius: pp.radius, spin: pp.spinAngle || 0, seed: (pp.seed % 8192) / 8192,
            sunDir: sunDirFor(pp.pos), palette: pp.palette, atmoColor: pp.atmoColor,
            atmoStrength: pp.atmoStrength, hasWater: pp.hasWater, hasClouds: pp.hasClouds,
            hasRings: pp.hasRings, ringColor: pp.ringColor, cityLights: pp.cityLights,
            axialTilt: pp.axialTilt
          });
        }
      }
      /* 曲速隧道 */
      if (Space.warp && SFX && SFX.drawWarp) {
        SFX.drawWarp(ctx, { progress01: Space.warp.p, dir: sh.fwd, tint: [0.55, 0.8, 1.0] });
      }

      /* ---- 近景：空间站 / 飞船 / 尘埃 / 粒子 ---- */
      GL.gl.clear(GL.gl.DEPTH_BUFFER_BIT);
      Cam.near = 0.5; Cam.far = 60000;
      Cam.update(aspect);
      var starDir = sunDirFor(sh.pos);
      var env = { sunDir: [-starDir[0], -starDir[1], -starDir[2]], sunColor: S.starColor, ambient: [0.16, 0.19, 0.26], fogDensity: 0, day: 1 };

      /* 空间站 */
      var stD = V3.dist(sh.pos, S.station.pos);
      if (stD < 55000) {
        var sm = M4.identity();
        M4.translate(sm, S.station.pos, sm);
        M4.rotateY(sm, S.station.spinAngle || 0, sm);
        var sc = 26;
        M4.scale(sm, [sc, sc, sc], sm);
        R.drawModel(DSC.Models.get('station'), sm, env);
      }
      /* 飞船 */
      if (!opts.hideShip) {
        var m = Space.shipMatrix(0);
        M4.scale(m, [1.35, 1.35, 1.35], m);
        R.drawModel(DSC.Models.get('ship'), m, {
          sunDir: env.sunDir, sunColor: S.starColor, ambient: [0.2, 0.24, 0.32],
          fogDensity: 0, day: 1, glow: sh.pulse
        });
      }
      /* 太空尘埃速度线 */
      if (SFX && SFX.drawDust) {
        SFX.drawDust({ viewProj: Cam.viewProj, camPos: Cam.pos, time: Space.time },
          { camPos: Cam.pos, velocity: sh.vel, throttle01: sh.throttle * (0.35 + sh.pulse) });
      }
      DSC.Render.drawParticles();
    },

    /* ---------------------------------------------------------- 曲速 */
    canWarp: function (target) {
      var cost = DSC.Universe.warpCost(Space.system, target);
      return { ok: DSC.Player.count('warp_cell') >= 1, cost: cost, cells: DSC.Player.count('warp_cell') };
    },
    beginWarp: function (targetSystem, onDone) {
      if (Space.warp) return false;
      if (!DSC.Player.removeItem('warp_cell', 1)) {
        A() && A().play('ui_error', { volume: 0.6 });
        if (DSC.UI) DSC.UI.toast('缺少曲速电池 · WARP CELL REQUIRED');
        return false;
      }
      Space.warp = { p: 0, t: 0, target: targetSystem, done: onDone, phase: 'charge' };
      A() && A().play('warp_charge', { volume: 0.9 });
      A() && A().setMusic('warp');
      return true;
    },
    updateWarp: function (dt) {
      var w = Space.warp;
      if (!w) return;
      w.t += dt;
      if (w.phase === 'charge') {
        w.p = U.clamp(w.t / 1.6, 0, 1) * 0.35;
        if (w.t > 1.6) {
          w.phase = 'jump'; w.t = 0;
          A() && A().play('warp_jump', { volume: 1 });
        }
      } else if (w.phase === 'jump') {
        w.p = 0.35 + U.smoothstep(0, 1, U.clamp(w.t / 2.1, 0, 1)) * 0.65;
        if (w.t > 2.1) {
          w.phase = 'arrive'; w.t = 0;
          Space.galaxy.current = w.target.index;
          w.target.visited = true;
          Space.system = w.target;
          Space.init(Space.galaxy, w.target, null);
          if (DSC.Game) DSC.Game.system = w.target;
          A() && A().play('warp_arrive', { volume: 0.9 });
          A() && A().setMusic('space');
          if (DSC.UI) DSC.UI.systemArrival(w.target);
        }
      } else {
        w.p = U.clamp(1 - w.t / 0.9, 0, 1) * 0.4;
        if (w.t > 0.9) { var d = w.done; Space.warp = null; if (d) d(); }
      }
    },

    serialize: function () {
      var sh = Space.ship;
      return { pos: [sh.pos[0], sh.pos[1], sh.pos[2]], yaw: sh.yaw, pitch: sh.pitch, throttle: sh.throttle, hull: sh.hull, shield: sh.shield };
    },
    restore: function (d) {
      if (!d) return;
      var sh = Space.ship;
      sh.pos[0] = d.pos[0]; sh.pos[1] = d.pos[1]; sh.pos[2] = d.pos[2];
      sh.yaw = d.yaw; sh.pitch = d.pitch; sh.throttle = d.throttle;
      sh.hull = d.hull === undefined ? 100 : d.hull;
      sh.shield = d.shield === undefined ? 100 : d.shield;
    }
  };

  Space.MAX_SPEED = MAX_SPEED; Space.PULSE_SPEED = PULSE_SPEED;
  DSC.Space = Space;
})();
