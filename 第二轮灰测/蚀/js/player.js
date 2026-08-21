/* ===================================================================
   player.js — 玩家：移动 / 摄像机 / 巨剑挥砍状态机 / 狂气
   巨剑为第一人称视图模型：从摄像机基向量构造世界矩阵，
   挥砍时做大幅度扇形横扫，附带剑光拖尾、顿帧、镜头踢动。
   =================================================================== */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const U = G.U, M4 = G.M4;

  const GRAV = 21.5;
  const EYE = 1.16;
  const KICK_MAX = 0.20;      // 镜头踢动硬上限（弧度）—— 防止任何情况下视角被踢到天上/脚下

  // 统一的镜头踢动入口：永远夹在安全范围内
  function addKick(dx, dy) {
    P.camKickX = U.clamp(P.camKickX + dx, -KICK_MAX, KICK_MAX);
    P.camKickY = U.clamp(P.camKickY + dy, -KICK_MAX, KICK_MAX);
  }

  /* --------------------------- 剑姿（局部） --------------------------- */
  /* [px,py,pz, ry,rx,rz, scale]
     局部空间：剑柄在原点，剑身沿 -Z 前伸；rx>0 剑尖上扬，ry>0 剑尖向左，rz 为绕刃身滚转。
     数值经过截图迭代：既要"人类扛不动的大铁块"的压迫感，又不能糊住半个屏幕。 */
  const POSE = {
    idle: [0.46, -0.72, -0.52, 0.30, 0.56, -1.15, 1],
    walkA: [0.50, -0.79, -0.47, 0.36, 0.50, -1.05, 1],
    windR: [0.82, -0.56, -0.18, -0.72, 0.86, -1.50, 1.00],
    swingR: [-0.72, -0.52, -0.90, 1.42, -0.18, 1.35, 1.02],
    windL: [-0.66, -0.56, -0.18, 1.62, 0.84, 1.50, 1.00],
    swingL: [0.80, -0.52, -0.90, -0.66, -0.16, -1.35, 1.02],
    windUp: [0.24, 0.06, -0.05, 0.16, -1.18, -0.10, 1.00],
    chop: [0.06, -0.92, -0.98, 0.10, 1.26, 0.04, 1.04],
    hvWind: [0.14, 0.26, 0.10, 0.05, -1.42, -0.06, 1.06],
    hvSlam: [0.02, -1.02, -1.06, 0.06, 1.40, 0.02, 1.08],
    thrust: [0.26, -0.52, -1.10, 0.04, 0.10, -0.90, 1.00],
  };
  function mixPose(o, a, b, t) {
    for (let i = 0; i < 7; i++) o[i] = a[i] + (b[i] - a[i]) * t;
    return o;
  }

  const P = {
    x: 2, y: 0, z: 2, yaw: 0, pitch: 0, roll: 0,
    vx: 0, vy: 0, vz: 0,
    onGround: true, radius: 0.34,
    hp: 100, maxHp: 100,
    stamina: 100, maxStamina: 100, staminaDelay: 0,
    rage: 0, maxRage: 100, berserk: 0, berserkMax: 12,
    souls: 0,
    combo: 0, comboT: 0, bestCombo: 0,
    kills: 0, totalDamage: 0,
    iframe: 0, hurtFlash: 0, lastHurtT: -99,
    // 武器
    wState: 'idle', wT: 0, wDur: 0, swingKind: 'R', swingIndex: 0,
    hitId: 0, hitThisSwing: 0, charge: 0, charging: false,
    bladeBlood: 0, queued: false,
    // 摄像机
    bob: 0, bobAmp: 0, camKickX: 0, camKickY: 0, camRoll: 0, dip: 0,
    fov: 78, fovTarget: 78,
    // 冲刺
    dashT: 0, dashCd: 0, dashDirX: 0, dashDirZ: 0, dashCharges: 1,
    // 其它
    stepPhase: 0, lastFloorY: 0, footT: 0,
    trail: [], swordMat: M4.create(), tipX: 0, tipY: 0, tipZ: 0,
    stats: null, relics: [], game: null, map: null,
    dead: false, alive: true,
    _mLocal: M4.create(), _mCam: M4.create(), _pose: [0, 0, 0, 0, 0, 0, 1],
    _arc: [],
  };

  /* --------------------------- 基础属性 --------------------------- */
  P.baseStats = function () {
    return {
      maxHp: 100,
      dmg: 1.0, heavyMul: 2.55, swingSpeed: 1.0, arc: 1.0, range: 1.0,
      moveSpeed: 1.0, jump: 1.0,
      crit: 0.06, critMul: 2.3, knock: 1.0,
      lifesteal: 0, killHeal: 0, bloodHeal: 0,
      armor: 0, thorns: 0, regen: 0,
      dashCharges: 1, dashCost: 32,
      rageGain: 1.0, berserkDmg: 0.55, berserkTime: 12,
      soulMul: 1.0, luck: 0,
      explodeOnKill: 0, chainLightning: 0, gibHeal: 0,
      overkillArc: 0, executeThreshold: 0, comboDmg: 0.035,
      staminaRegen: 24, revive: 0, curseDrain: 0,
      projectileParry: 0, magnet: 1, heavyShock: 1.0,
    };
  };

  P.recomputeStats = function () {
    const s = P.baseStats();
    for (const r of P.relics) if (r.apply) r.apply(s, r.stacks || 1);
    const prevMax = P.maxHp;
    P.stats = s;
    P.maxHp = Math.round(s.maxHp);
    if (P.maxHp > prevMax) P.hp += (P.maxHp - prevMax);
    P.hp = Math.min(P.hp, P.maxHp);
    P.berserkMax = s.berserkTime;
    P.dashCharges = Math.max(P.dashCharges, s.dashCharges);
    return s;
  };

  P.init = function (game) {
    P.game = game;
    P.relics = [];
    P.stats = P.baseStats();
    P.maxHp = P.stats.maxHp; P.hp = P.maxHp;
  };

  P.newRun = function () {
    P.relics = [];
    P.recomputeStats();
    P.hp = P.maxHp;
    P.souls = 0; P.kills = 0; P.totalDamage = 0; P.bestCombo = 0;
    P.rage = 0; P.berserk = 0;
    P.dead = false; P.alive = true;
    P.bladeBlood = 0;
  };

  P.placeOn = function (map) {
    P.map = map;
    P.x = map.spawn.x; P.z = map.spawn.z;
    P.y = map.floorAt(P.x, P.z);
    P.yaw = map.spawn.yaw; P.pitch = 0;
    P.vx = P.vy = P.vz = 0;
    P.wState = 'idle'; P.wT = 0; P.combo = 0; P.comboT = 0;
    P.stamina = P.maxStamina; P.dashCharges = P.stats.dashCharges;
    P.trail.length = 0;
    P.iframe = 0.6;
  };

  P.eyeY = function () {
    return P.y + EYE + P.bob - P.dip;
  };

  /* --------------------------- 主更新 --------------------------- */
  P.update = function (dt, input, ctx) {
    const map = ctx.map;
    P.map = map;
    const st = P.stats;
    // 真实时间：镜头恢复不该受顿帧/慢放影响，否则冻结期间踢动几乎不衰减
    const dtR = (ctx && ctx.dtReal) || dt;

    /* ---- 视角 ---- */
    P.yaw = U.wrapAngle(P.yaw + input.mdx);
    // 垂直方向按玩家反馈反转为「上移低头、下移抬头」（Y 轴反转）
    P.pitch = U.clamp(P.pitch + input.mdy, -1.32, 1.32);

    /* ---- 狂气 ---- */
    if (P.berserk > 0) {
      P.berserk -= dt;
      const drain = 2.2 * dt * (1 + st.curseDrain);
      if (P.hp > 6) P.hp = Math.max(6, P.hp - drain);
      if (P.berserk <= 0) {
        P.berserk = 0;
        G.Audio.setBerserk(false);
        if (P.game) P.game.toast('狂气退去', 'normal');
      }
    } else if (input.berserk && P.rage >= P.maxRage) {
      P.rage = 0; P.berserk = P.berserkMax;
      G.Audio.play('berserk');
      G.Audio.setBerserk(true);
      if (P.game) { P.game.toast('狂 气 解 放', 'big'); P.game.shake(0.9, 0.5); }
    }
    if (P.comboT > 0) { P.comboT -= dt; if (P.comboT <= 0) P.combo = 0; }
    if (st.regen > 0 && P.hp < P.maxHp) P.hp = Math.min(P.maxHp, P.hp + st.regen * dt);
    if (P.iframe > 0) P.iframe -= dt;
    if (P.hurtFlash > 0) P.hurtFlash -= dt * 2.5;

    /* ---- 体力 ---- */
    if (P.staminaDelay > 0) P.staminaDelay -= dt;
    else P.stamina = Math.min(P.maxStamina, P.stamina + st.staminaRegen * dt);
    if (P.dashCd > 0) P.dashCd -= dt;

    /* ---- 移动输入 ---- */
    const berserkMul = P.berserk > 0 ? 1.20 : 1;
    const speed = 4.35 * st.moveSpeed * berserkMul * (P.wState === 'idle' ? 1 : 0.72);
    let ix = input.right - input.left;
    let iz = input.fwd - input.back;
    const il = Math.sqrt(ix * ix + iz * iz);
    if (il > 1) { ix /= il; iz /= il; }
    const fx = U.fwdX(P.yaw), fz = U.fwdZ(P.yaw);
    const rx = Math.cos(P.yaw), rz = Math.sin(P.yaw);
    let wishX = fx * iz + rx * ix;
    let wishZ = fz * iz + rz * ix;

    /* ---- 冲刺 ---- */
    if (P.dashT > 0) {
      P.dashT -= dt;
      P.vx = P.dashDirX * 15.5; P.vz = P.dashDirZ * 15.5;
      if (P.dashT <= 0) { P.vx *= 0.34; P.vz *= 0.34; }
      if (Math.random() < 0.6) {
        G.Gore.mist(P.x - P.dashDirX * 0.4, P.y + 0.5, P.z - P.dashDirZ * 0.4, 0.5, 0.28, 'dust', 0.2);
      }
    } else if (input.dash && P.dashCd <= 0 && P.stamina >= st.dashCost) {
      const dl = Math.sqrt(wishX * wishX + wishZ * wishZ);
      P.dashDirX = dl > 0.01 ? wishX / dl : fx;
      P.dashDirZ = dl > 0.01 ? wishZ / dl : fz;
      P.dashT = 0.17; P.dashCd = 0.42;
      P.stamina -= st.dashCost; P.staminaDelay = 0.45;
      P.iframe = Math.max(P.iframe, 0.20);
      P.fovTarget = 88;
      G.Audio.play('dash');
      if (P.game) P.game.shake(0.16, 0.12);
    }

    /* ---- 水平加速 ---- */
    if (P.dashT <= 0) {
      const accel = P.onGround ? 46 : 17;
      const wl = Math.sqrt(wishX * wishX + wishZ * wishZ);
      if (wl > 0.001) {
        const cur = P.vx * (wishX / wl) + P.vz * (wishZ / wl);
        const add = Math.max(0, speed - cur);
        const push = Math.min(accel * dt * speed / 4.35, add);
        P.vx += (wishX / wl) * push;
        P.vz += (wishZ / wl) * push;
      }
      const fr = P.onGround ? 11.5 : 1.4;
      const damp = Math.max(0, 1 - fr * dt);
      P.vx *= damp; P.vz *= damp;
    }

    /* ---- 跳跃 / 重力 ---- */
    if (input.jump && P.onGround && P.dashT <= 0) {
      P.vy = 7.0 * st.jump;
      P.onGround = false;
      G.Audio.play('jump');
    }
    P.vy -= GRAV * dt;

    /* ---- 位移 + 碰撞 ---- */
    moveHoriz(P, map, P.vx * dt, P.vz * dt);
    P.y += P.vy * dt;
    const gy = map.floorAt(P.x, P.z);
    if (P.y <= gy) {
      if (!P.onGround) {
        const impact = -P.vy;
        P.dip = Math.min(0.28, impact * 0.022);
        if (impact > 6) {
          G.Audio.play('land');
          G.Gore.dust(P.x, gy, P.z, 4, 0.45);
          if (P.game) P.game.shake(Math.min(0.4, impact * 0.03), 0.18);
        }
        // 落体斩
        if (P.wState === 'swing' || P.wState === 'slam') P.groundSlamBonus = true;
      }
      P.y = gy; P.vy = 0; P.onGround = true;
    } else {
      P.onGround = false;
      const cy = map.ceilAt(P.x, P.z);
      if (P.y + EYE + 0.25 > cy) { P.y = cy - EYE - 0.25; P.vy = Math.min(P.vy, 0); }
    }
    if (P.dip > 0) P.dip = Math.max(0, P.dip - dt * 1.1);

    /* ---- 头部起伏 / 脚步 ---- */
    const hspd = Math.sqrt(P.vx * P.vx + P.vz * P.vz);
    if (P.onGround && hspd > 0.6) {
      P.stepPhase += dt * (5.4 + hspd * 0.72);
      P.bobAmp = U.damp(P.bobAmp, Math.min(0.055, hspd * 0.014), 8, dt);
      P.footT -= dt * (hspd * 0.34);
      if (P.footT <= 0) {
        P.footT = 1;
        const blood = G.Gore.bloodAt(P.x, P.z);
        G.Audio.play(blood > 0.25 ? 'stepBlood' : 'step', { vol: 0.55 });
        // 血泊回复
        if (P.stats.bloodHeal > 0 && blood > 0.2) {
          const got = G.Gore.drainBlood(P.x, P.z, 0.5);
          if (got > 0.1) P.heal(P.stats.bloodHeal, true);
        }
      }
    } else {
      P.bobAmp = U.damp(P.bobAmp, 0, 6, dt);
    }
    P.bob = Math.sin(P.stepPhase * 2) * P.bobAmp + Math.sin(P.stepPhase) * P.bobAmp * 0.35;
    P.camRoll = U.damp(P.camRoll, -(input.right - input.left) * 0.028 + Math.sin(P.stepPhase) * P.bobAmp * 0.55, 7, dt);

    /* ---- 视场 ---- */
    if (P.dashT <= 0 && P.wState !== 'hvWind') P.fovTarget = 78 + (P.berserk > 0 ? 5 : 0);
    P.fov = U.damp(P.fov, P.fovTarget, 7, dt);

    /* ---- 镜头踢动衰减（按真实时间，且带硬上限） ---- */
    P.camKickX = U.clamp(U.damp(P.camKickX, 0, 9, dtR), -KICK_MAX, KICK_MAX);
    P.camKickY = U.clamp(U.damp(P.camKickY, 0, 9, dtR), -KICK_MAX, KICK_MAX);
    if (!isFinite(P.camKickX)) P.camKickX = 0;
    if (!isFinite(P.camKickY)) P.camKickY = 0;

    /* ---- 武器 ---- */
    updateWeapon(dt, input, ctx);
    updateSwordMatrix(dt);

    /* ---- 拖尾老化 ---- */
    for (let i = P.trail.length - 1; i >= 0; i--) {
      P.trail[i].t -= dt;
      if (P.trail[i].t <= 0) P.trail.splice(i, 1);
    }

    if (P.bladeBlood > 0) {
      P.bladeBlood = Math.max(0, P.bladeBlood - dt * 0.055);
      if (Math.random() < P.bladeBlood * dt * 9) {
        G.Gore.drop(P.tipX, P.tipY, P.tipZ, 0, -0.4, 0, 0.04);
      }
    }
  };

  /* --------------------------- 碰撞 --------------------------- */
  function moveHoriz(p, map, dx, dz) {
    const r = p.radius;
    const stepUp = 0.66;
    // X
    let nx = p.x + dx;
    if (!solidFor(map, nx, p.z, r, p.y, stepUp)) {
      const fh = highestFloor(map, nx, p.z, r);
      if (fh - p.y <= stepUp) { p.x = nx; if (fh > p.y && p.onGround) p.y = fh; }
      else p.vx = 0;
    } else p.vx *= -0.05;
    // Z
    let nz = p.z + dz;
    if (!solidFor(map, p.x, nz, r, p.y, stepUp)) {
      const fh = highestFloor(map, p.x, nz, r);
      if (fh - p.y <= stepUp) { p.z = nz; if (fh > p.y && p.onGround) p.y = fh; }
      else p.vz = 0;
    } else p.vz *= -0.05;
  }
  function solidFor(map, x, z, r, y, stepUp) {
    if (map.isSolidAt(x, z)) return true;
    const pts = [[r, 0], [-r, 0], [0, r], [0, -r], [r * 0.71, r * 0.71], [-r * 0.71, r * 0.71], [r * 0.71, -r * 0.71], [-r * 0.71, -r * 0.71]];
    for (const [ox, oz] of pts) {
      if (map.isSolidAt(x + ox, z + oz)) return true;
      const fh = map.floorAt(x + ox, z + oz);
      if (fh - y > stepUp) return true;
      if (map.ceilAt(x + ox, z + oz) - fh < 1.4) return true;
    }
    return false;
  }
  function highestFloor(map, x, z, r) {
    let m = map.floorAt(x, z);
    const pts = [[r * 0.7, 0], [-r * 0.7, 0], [0, r * 0.7], [0, -r * 0.7]];
    for (const [ox, oz] of pts) m = Math.max(m, map.floorAt(x + ox, z + oz));
    return m;
  }

  /* --------------------------- 巨剑状态机 --------------------------- */
  const TIMING = {
    windR: 0.085, swingR: 0.135, recR: 0.185,
    windUp: 0.13, chop: 0.155, recC: 0.235,
    hvWind: 0.34, hvSlam: 0.17, hvRec: 0.42,
  };

  function speedMul() {
    const st = P.stats;
    let m = st.swingSpeed * (1 + Math.min(P.combo, 12) * 0.022);
    if (P.berserk > 0) m *= 1.42;
    return m;
  }

  function updateWeapon(dt, input, ctx) {
    const st = P.stats;
    const sm = speedMul();
    /* 武器计时保底：即使全局处于顿帧（dt 只有真实时间的 5.5%），
       挥砍也至少按 25% 速度推进 —— 保证攻击窗口一定会关闭，
       不会出现"顿帧把自己锁死"的状态。 */
    const dtR = (ctx && ctx.dtReal) || dt;
    P.wT += Math.max(dt, dtR * 0.25);

    switch (P.wState) {
      case 'idle': {
        if (input.heavy) { startHeavy(); break; }
        if (input.attack) { startLight(); break; }
        break;
      }
      case 'wind': {
        if (P.wT >= P.wDur) {
          P.wState = 'swing'; P.wT = 0;
          P.wDur = (P.swingIndex % 3 === 2 ? TIMING.chop : TIMING.swingR) / sm;
          P.hitId++; P.hitThisSwing = 0;
          G.Audio.play(P.swingIndex % 3 === 2 ? 'swingHeavy' : 'swing', { pitch: 1 + (P.combo % 3) * 0.08 });
          addKick(0, 0.045);
        }
        break;
      }
      case 'swing': {
        // 攻击判定窗口
        const t = P.wT / P.wDur;
        if (t > 0.10 && t < 0.92) doSwingHit(ctx, false);
        sampleTrail();
        if (P.wT >= P.wDur) {
          P.wState = 'recover'; P.wT = 0;
          P.wDur = (P.swingIndex % 3 === 2 ? TIMING.recC : TIMING.recR) / sm;
          if (P.hitThisSwing === 0) checkWallHit(ctx);
          P.groundSlamBonus = false;
        }
        break;
      }
      case 'recover': {
        if (input.attack && P.wT > P.wDur * 0.32) P.queued = true;
        if (input.heavy && P.wT > P.wDur * 0.3) { startHeavy(); break; }
        if (P.wT >= P.wDur) {
          if (P.queued || input.attack) { P.queued = false; startLight(); }
          else { P.wState = 'idle'; P.wT = 0; }
        }
        break;
      }
      case 'hvWind': {
        P.charge = Math.min(1, P.charge + dt * 1.5);
        P.fovTarget = 70;
        if (P.wT >= P.wDur && !input.heavy) releaseHeavy();
        else if (P.wT >= P.wDur * 2.6) releaseHeavy();
        break;
      }
      case 'slam': {
        const t = P.wT / P.wDur;
        if (t > 0.16) doSwingHit(ctx, true);
        sampleTrail();
        if (P.wT >= P.wDur) {
          P.wState = 'hvRec'; P.wT = 0; P.wDur = TIMING.hvRec / sm;
          if (P.hitThisSwing === 0) checkWallHit(ctx);
          heavyShock(ctx);
          P.groundSlamBonus = false;
        }
        break;
      }
      case 'hvRec': {
        if (input.attack && P.wT > P.wDur * 0.45) { startLight(); break; }
        if (P.wT >= P.wDur) { P.wState = 'idle'; P.wT = 0; P.charge = 0; }
        break;
      }
    }
  }

  function startLight() {
    const sm = speedMul();
    P.swingIndex++;
    P.swingKind = (P.swingIndex % 3 === 2) ? 'C' : (P.swingIndex % 2 === 0 ? 'R' : 'L');
    P.wState = 'wind'; P.wT = 0;
    P.wDur = (P.swingKind === 'C' ? TIMING.windUp : TIMING.windR) / sm;
    P.queued = false;
  }
  function startHeavy() {
    P.wState = 'hvWind'; P.wT = 0; P.wDur = TIMING.hvWind;
    P.charge = 0;
    G.Audio.play('charge');
  }
  function releaseHeavy() {
    const sm = speedMul();
    P.wState = 'slam'; P.wT = 0; P.wDur = TIMING.hvSlam / sm;
    P.hitId++; P.hitThisSwing = 0;
    P.fovTarget = 84;
    G.Audio.play('swingHeavy');
    addKick(0, 0.10);
    if (P.game) P.game.shake(0.22, 0.12);
  }

  /* ---- 扇形命中 ---- */
  function doSwingHit(ctx, heavy) {
    const st = P.stats;
    const Ent = G.Entities;
    const range = (heavy ? 3.45 : 2.85) * st.range;
    const half = (heavy ? 1.28 : 1.00) * st.arc;
    const eyeY = P.eyeY();
    const list = Ent.inArc(P.x, P.z, eyeY - 0.45, P.yaw, range, half, P._arc);
    if (!list.length) return;

    let newHits = 0;                 // 本帧新砍到的目标数
    for (const h of list) {
      const e = h.e;
      if (e.lastHitId === P.hitId) continue;
      // 只打有视线的
      if (h.d > 1.2 && !ctx.map.los(P.x, P.z, e.x, e.z)) continue;

      const crit = Math.random() < st.crit + (heavy ? 0.12 : 0);
      let dmg = (heavy ? 78 * st.heavyMul / 2.55 : 30) * st.dmg;
      dmg *= (1 + Math.min(P.combo, 15) * st.comboDmg);
      if (P.berserk > 0) dmg *= (1 + st.berserkDmg);
      if (heavy) dmg *= (1 + P.charge * 0.85);
      if (P.groundSlamBonus) dmg *= 1.35;
      if (crit) dmg *= st.critMul;
      if (st.executeThreshold > 0 && e.hp / e.maxHp < st.executeThreshold) dmg *= 3;

      const before = e.hp;
      const killed = Ent.hurt(e, dmg, {
        dirX: h.dx, dirZ: h.dz, crit: crit, heavy: heavy,
        hitId: P.hitId, knock: st.knock, py: eyeY - 0.35,
      });
      P.totalDamage += Math.min(before, dmg);
      P.hitThisSwing++;
      newHits++;
      P.bladeBlood = Math.min(1, P.bladeBlood + 0.3);

      // 打击反馈
      P.combo++; P.comboT = 2.4;
      P.bestCombo = Math.max(P.bestCombo, P.combo);
      P.rage = Math.min(P.maxRage, P.rage + (heavy ? 9 : 5) * st.rageGain);
      if (st.lifesteal > 0) P.heal(dmg * st.lifesteal, true);

      if (P.game) {
        P.game.onHit(e, dmg, crit, heavy, killed);
      }
    }

    /* 打击反馈：只在「这一帧真的砍到了新目标」时触发。
       曾经这里用的是 P.hitThisSwing > 0 —— 那个标记在一次挥砍里命中后会
       一直为真，于是挥砍窗口内每一帧都重新触发顿帧和镜头踢动：
       顿帧让 dt 变成 5.5% → 挥砍推进变慢 → 窗口停留更久 → 继续顿帧，
       同时 camKickY 每帧 +0.03 而衰减几乎为零，最终被顶到最大俯角，
       表现就是「视角锁在脚下」。 */
    if (newHits > 0) {
      const stop = (heavy ? 0.10 : 0.055) + Math.min(0.035, newHits * 0.012);
      if (P.game) {
        P.game.hitStop(stop);
        P.game.shake(heavy ? 0.55 : 0.26, heavy ? 0.22 : 0.13);
      }
      addKick((P.swingKind === 'L' ? -1 : 1) * 0.02, 0.03);
      P.groundSlamBonus = false;     // 落体加成已被这次命中消耗
    }
  }

  // 砍到墙：火花 + 铁鸣
  function checkWallHit(ctx) {
    const fx = U.fwdX(P.yaw), fz = U.fwdZ(P.yaw);
    for (let d = 0.7; d < 2.2; d += 0.35) {
      const tx = P.x + fx * d, tz = P.z + fz * d;
      if (ctx.map.isSolidAt(tx, tz)) {
        G.Gore.sparks(P.x + fx * (d - 0.2), P.eyeY() - 0.35, P.z + fz * (d - 0.2), -fx, 0.35, -fz, 9);
        G.Audio.play('hitWall');
        if (P.game) { P.game.shake(0.2, 0.1); P.game.hitStop(0.035); }
        addKick(0, 0.05);
        return true;
      }
    }
    return false;
  }

  // 重斩落地冲击波
  function heavyShock(ctx) {
    const st = P.stats;
    const fx = U.fwdX(P.yaw), fz = U.fwdZ(P.yaw);
    const cx = P.x + fx * 1.7, cz = P.z + fz * 1.7;
    const gy = ctx.map.floorAt(cx, cz);
    const radius = 2.9 * st.heavyShock * (1 + P.charge * 0.4);
    G.Gore.dust(cx, gy, cz, 12, 0.9);
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * U.TAU;
      G.Gore.drop(cx, gy + 0.1, cz, Math.cos(a) * 6, 2 + Math.random() * 3, Math.sin(a) * 6, 0.05, 'spark');
    }
    G.Audio.play('land', { vol: 1.4 });
    if (P.game) P.game.shake(0.6, 0.3);
    // 范围伤害
    const Ent = G.Entities;
    for (const e of Ent.list) {
      if (e.removeMe || !e.alive) continue;
      const d = U.dist(e.x, e.z, cx, cz);
      if (d > radius + e.radius) continue;
      if (e.lastHitId === P.hitId) continue;
      const dx = (e.x - P.x), dz = (e.z - P.z);
      const dl = Math.sqrt(dx * dx + dz * dz) || 1;
      Ent.hurt(e, 34 * st.dmg * (1 + P.charge * 0.6), {
        dirX: dx / dl, dirZ: dz / dl, heavy: true, hitId: P.hitId,
        knock: st.knock * 1.4, py: e.y + e.height * 0.4,
      });
    }
  }

  /* --------------------------- 剑的世界矩阵 --------------------------- */
  function currentPose(out) {
    const t = P.wDur > 0 ? U.clamp01(P.wT / P.wDur) : 0;
    const hspd = Math.sqrt(P.vx * P.vx + P.vz * P.vz);
    const walkT = U.clamp01(hspd / 4.2);
    const idleA = mixPose([0, 0, 0, 0, 0, 0, 1], POSE.idle, POSE.walkA, walkT * (0.5 + 0.5 * Math.sin(P.stepPhase)));
    switch (P.wState) {
      case 'idle': return mixPose(out, idleA, idleA, 0);
      case 'wind':
        return mixPose(out, idleA,
          P.swingKind === 'C' ? POSE.windUp : (P.swingKind === 'L' ? POSE.windL : POSE.windR),
          U.easeOut(t));
      case 'swing': {
        const a = P.swingKind === 'C' ? POSE.windUp : (P.swingKind === 'L' ? POSE.windL : POSE.windR);
        const b = P.swingKind === 'C' ? POSE.chop : (P.swingKind === 'L' ? POSE.swingL : POSE.swingR);
        return mixPose(out, a, b, U.easeOutCubic(t));
      }
      case 'recover': {
        const b = P.swingKind === 'C' ? POSE.chop : (P.swingKind === 'L' ? POSE.swingL : POSE.swingR);
        return mixPose(out, b, idleA, U.smooth(t));
      }
      case 'hvWind': {
        const k = U.easeOut(Math.min(1, t));
        mixPose(out, idleA, POSE.hvWind, k);
        // 蓄力抖动
        const sh = P.charge * 0.035;
        out[0] += (Math.random() - 0.5) * sh;
        out[1] += (Math.random() - 0.5) * sh;
        out[4] += (Math.random() - 0.5) * sh * 2;
        return out;
      }
      case 'slam': return mixPose(out, POSE.hvWind, POSE.hvSlam, U.easeInCubic(t) * 0.35 + U.easeOutCubic(t) * 0.65);
      case 'hvRec': return mixPose(out, POSE.hvSlam, idleA, U.smooth(t));
    }
    return mixPose(out, idleA, idleA, 0);
  }

  function updateSwordMatrix(dt) {
    const pose = currentPose(P._pose);
    // 摄像机基向量
    const cp = Math.cos(P.pitch), sp = Math.sin(P.pitch);
    const fx = U.fwdX(P.yaw) * cp, fy = sp, fz = U.fwdZ(P.yaw) * cp;
    const rx = Math.cos(P.yaw), ry = 0, rz = Math.sin(P.yaw);
    // up = (-fwd) x right
    const ux = (-fy) * rz - (-fz) * ry;
    const uy = (-fz) * rx - (-fx) * rz;
    const uz = (-fx) * ry - (-fy) * rx;
    const ex = P.x, ey = P.eyeY(), ez = P.z;
    M4.basis(P._mCam, rx, ry, rz, ux, uy, uz, -fx, -fy, -fz, ex, ey, ez);
    // 局部：偏移 + 旋转 + 缩放
    M4.compose(P._mLocal, pose[0], pose[1], pose[2], pose[3], pose[4], pose[5], pose[6], pose[6], pose[6]);
    M4.mul(P.swordMat, P._mCam, P._mLocal);
    // 剑尖世界坐标（局部 (0,0,-L)）
    const m = P.swordMat, L = 2.18;
    P.tipX = m[8] * -L + m[12];
    P.tipY = m[9] * -L + m[13];
    P.tipZ = m[10] * -L + m[14];
    P.midX = m[8] * -L * 0.55 + m[12];
    P.midY = m[9] * -L * 0.55 + m[13];
    P.midZ = m[10] * -L * 0.55 + m[14];
  }

  function sampleTrail() {
    P.trail.push({
      x: P.tipX, y: P.tipY, z: P.tipZ,
      x2: P.midX, y2: P.midY, z2: P.midZ,
      t: 0.16, t0: 0.16,
    });
    if (P.trail.length > 16) P.trail.shift();
  }

  /* --------------------------- 伤害 / 治疗 --------------------------- */
  P.hurt = function (dmg, sx, sz, kind) {
    if (P.dead) return;
    if (P.iframe > 0) return;
    const st = P.stats;
    let d = dmg * (1 - U.clamp(st.armor, 0, 0.75));
    if (P.berserk > 0) d *= 0.72;                    // 狂气减伤（但会持续掉血）
    d = Math.max(1, d);
    P.hp -= d;
    P.iframe = 0.42;
    P.hurtFlash = 1;
    P.combo = 0;
    P.rage = Math.min(P.maxRage, P.rage + d * 0.55 * st.rageGain);

    // 击退 + 镜头
    if (sx !== undefined) {
      const dx = P.x - sx, dz = P.z - sz;
      const dl = Math.sqrt(dx * dx + dz * dz) || 1;
      P.vx += dx / dl * 3.4; P.vz += dz / dl * 3.4;
      addKick((Math.random() - 0.5) * 0.09, -0.06);
      // 反伤
      if (st.thorns > 0) {
        const Ent = G.Entities;
        for (const e of Ent.list) {
          if (e.removeMe || !e.alive) continue;
          if (U.dist2(e.x, e.z, P.x, P.z) < 6.5)
            Ent.hurt(e, d * st.thorns, { dirX: -dx / dl, dirZ: -dz / dl, hitId: -Math.random() });
        }
      }
    }
    G.Audio.play('hurt');
    G.Gore.screenSplat(3 + (d * 0.2 | 0), 1.1);
    if (P.game) {
      P.game.shake(0.4 + Math.min(0.5, d * 0.02), 0.26);
      P.game.onPlayerHurt(d, kind);
    }
    if (P.hp <= 0) {
      if (st.revive > 0 && !P.usedRevive) {
        P.usedRevive = true;
        P.hp = P.maxHp * 0.45;
        P.iframe = 2.0;
        if (P.game) { P.game.toast('烙印灼烧 —— 你拒绝死亡', 'big'); P.game.shake(1.1, 0.6); }
        G.Audio.play('berserk');
        return;
      }
      P.hp = 0; P.dead = true; P.alive = false;
      if (P.game) P.game.onPlayerDeath();
    }
  };

  P.heal = function (n, silent) {
    if (P.hp >= P.maxHp || P.dead) return;
    P.hp = Math.min(P.maxHp, P.hp + n);
    if (!silent) { G.Audio.play('heal'); if (P.game) P.game.toast('+' + Math.round(n) + ' 生命', 'gold'); }
  };
  P.addRelic = function (relic) {
    const found = P.relics.find(r => r.id === relic.id);
    if (found && relic.stackable) found.stacks = (found.stacks || 1) + 1;
    else P.relics.push(Object.assign({ stacks: 1 }, relic));
    P.recomputeStats();
  };

  /* --------------------------- 渲染 --------------------------- */
  P.swordModel = null;
  P.emitSword = function (mb, T) {
    if (!P.swordModel) P.swordModel = G.Art.buildSword();
    const bb = P.bladeBlood;
    const cm = [1 + bb * 0.55, 1 - bb * 0.62, 1 - bb * 0.62];
    let emis = 0;
    // 蓄力时剑身发红
    if (P.wState === 'hvWind') emis = P.charge * 0.35;
    if (P.berserk > 0) emis = Math.max(emis, 0.14);
    const light = 1.05 + (P.berserk > 0 ? 0.25 : 0);
    G.Art.emitPart(mb, P.swordModel.parts.blade, P.swordMat, T.white, light, cm, emis);
  };

  // 剑光拖尾（加色混合的带状面片）
  P.emitTrail = function (mb, T) {
    const tr = P.trail;
    if (tr.length < 2) return;
    const tile = T.glow;
    for (let i = 1; i < tr.length; i++) {
      const a = tr[i - 1], b = tr[i];
      const fa = a.t / a.t0, fb = b.t / b.t0;
      const alpha = (fa + fb) * 0.5;
      const c = P.berserk > 0 ? [1.0, 0.25, 0.14] : [0.86, 0.88, 1.0];
      const col = [c[0] * alpha, c[1] * alpha, c[2] * alpha];
      mb.quadRaw(
        a.x2, a.y2, a.z2,
        b.x2, b.y2, b.z2,
        b.x, b.y, b.z,
        a.x, a.y, a.z,
        tile, col[0], col[1], col[2], 1.6, 1);
      // 双面
      mb.quadRaw(
        a.x, a.y, a.z,
        b.x, b.y, b.z,
        b.x2, b.y2, b.z2,
        a.x2, a.y2, a.z2,
        tile, col[0], col[1], col[2], 1.6, 1);
    }
  };

  P.isSwinging = function () { return P.wState === 'swing' || P.wState === 'slam'; };
  G.Player = P;
})();
