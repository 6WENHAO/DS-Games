/* ===================================================================
   entities.js — 敌人、AI、受击反馈、肢解、Boss 多阶段、投射物
   =================================================================== */
(function () {
  'use strict';
  const G = (window.G = window.G || {});
  const U = G.U, M4 = G.M4, Gore = G.Gore;

  /* --------------------------- 数值表 --------------------------- */
  const TYPES = {
    ghoul: {
      name: '蚀之尸', hp: 32, spd: 2.15, dmg: 9, range: 1.75, wind: 0.44, rec: 0.62,
      mass: 1.0, souls: 3, sight: 17, model: 'ghoul', scale: 1, gib: 1.0, pitch: 1.0,
    },
    hound: {
      name: '腐肉猎犬', hp: 24, spd: 4.5, dmg: 11, range: 1.85, wind: 0.30, rec: 0.55,
      mass: 0.7, souls: 4, sight: 21, model: 'hound', scale: 1, gib: 1.1, pitch: 1.35, leap: true,
    },
    cultist: {
      name: '蚀之信徒', hp: 28, spd: 1.95, dmg: 9, range: 12, wind: 0.8, rec: 1.15,
      mass: 0.9, souls: 5, sight: 20, model: 'cultist', scale: 1, gib: 1.0, pitch: 0.9, ranged: true, keepDist: 7,
    },
    brute: {
      name: '腐铁重兵', hp: 108, spd: 1.9, dmg: 24, range: 2.55, wind: 0.78, rec: 1.0,
      mass: 2.8, souls: 10, sight: 18, model: 'brute', scale: 1, gib: 1.6, pitch: 0.62, shock: true,
    },
    wraith: {
      name: '亡魂', hp: 42, spd: 3.1, dmg: 13, range: 2.0, wind: 0.52, rec: 0.72,
      mass: 0.55, souls: 7, sight: 23, model: 'wraith', scale: 1, gib: 0.9, pitch: 1.15,
      float: true, blink: true,
    },
    /* --------- Boss --------- */
    apostle: {
      name: '使徒 · 食人巨躯', hp: 760, spd: 2.35, dmg: 30, range: 3.4, wind: 0.72, rec: 0.85,
      mass: 12, souls: 60, sight: 40, model: 'apostle', scale: 1, gib: 2.6, pitch: 0.5,
      boss: true, shock: true, phases: 3,
    },
    bishop: {
      name: '使徒 · 蛆虫主教', hp: 1150, spd: 2.5, dmg: 26, range: 3.0, wind: 0.6, rec: 0.8,
      mass: 10, souls: 90, sight: 40, model: 'bishop', scale: 1, gib: 2.4, pitch: 0.7,
      boss: true, float: true, ranged: true, summon: true, phases: 3,
    },
    lord: {
      name: '使徒之王 · 蛇眼', hp: 1850, spd: 2.7, dmg: 34, range: 3.8, wind: 0.62, rec: 0.7,
      mass: 16, souls: 160, sight: 50, model: 'lord', scale: 1, gib: 3.2, pitch: 0.42,
      boss: true, shock: true, ranged: true, summon: true, phases: 4,
    },
  };

  /* --------------------------- 模块 --------------------------- */
  const Ent = {
    list: [],
    bolts: [],
    items: [],
    ctx: null,
    TYPES: TYPES,
    _mats: [],
    _pose: {},
  };

  // 复用矩阵
  const mEnt = M4.create(), mLocal = M4.create(), mWorld = M4.create();

  Ent.reset = function () { Ent.list.length = 0; Ent.bolts.length = 0; Ent.items.length = 0; };

  /* --------------------------- 生成 --------------------------- */
  Ent.spawn = function (type, x, z, opts) {
    opts = opts || {};
    const t = TYPES[type] || TYPES.ghoul;
    const model = G.Art.getModel(t.model);
    const depth = opts.depth || 1;
    const hpScale = 1 + (depth - 1) * 0.17;
    const dmgScale = 1 + (depth - 1) * 0.11;

    const e = {
      type: type, def: t, model: model,
      name: t.name,
      x: x, y: opts.y === undefined ? 0 : opts.y, z: z,
      yaw: Math.random() * U.TAU,
      vx: 0, vy: 0, vz: 0,
      scale: (t.scale || 1) * (opts.elite ? 1.22 : 1) * (opts.scale || 1),
      height: model.height * (t.scale || 1) * (opts.elite ? 1.22 : 1) * (opts.scale || 1),
      radius: Math.max(0.3, model.radius * (opts.elite ? 1.22 : 1)) + (t.boss ? 0.55 : 0.06),
      maxHp: Math.round(t.hp * hpScale * (opts.elite ? 2.3 : 1) * (opts.hpMul || 1)),
      dmg: t.dmg * dmgScale,
      spd: t.spd * (opts.elite ? 0.92 : 1),
      state: 'idle', stateT: 0,
      animT: Math.random() * 10,
      flash: 0, stagger: 0, hitStop: 0,
      alive: true, dead: false,
      elite: !!opts.elite, boss: !!t.boss,
      carriesBrand: !!opts.carriesBrand,
      lost: {},                       // 已被砍掉的部件
      target: null, seen: false, alertT: 0,
      atkCd: 0, cd: 0, blinkCd: 2 + Math.random() * 3,
      float: !!t.float, floatPhase: Math.random() * 6,
      phase: 1, summonCd: 4, patternCd: 1.5, pattern: null,
      knock: 0, lastHitId: -1, comboMark: 0,
      soulValue: t.souls * (opts.elite ? 3 : 1),
      depth: depth,
      groundY: 0,
      spawnAnim: opts.spawnAnim ? 0.6 : 0,
    };
    e.hp = e.maxHp;
    if (t.float) e.y = 0.5 + Math.random() * 0.3;
    Ent.list.push(e);
    return e;
  };

  Ent.spawnItem = function (kind, x, z, opts) {
    opts = opts || {};
    const map = Ent.ctx && Ent.ctx.map;
    const it = {
      kind: kind, x: x, z: z,
      y: (map ? map.floorAt(x, z) : 0) + 0.5,
      vy: opts.vy === undefined ? 0 : opts.vy,
      vx: opts.vx || 0, vz: opts.vz || 0,
      value: opts.value || 1, alive: true, t: Math.random() * 6,
      model: G.Art.buildItem(kind === 'soul' ? 'soul' : (kind === 'heart' ? 'heart' : (kind === 'brand' ? 'brand' : 'relic'))),
      grounded: false, life: kind === 'soul' ? 26 : 999,
      magnet: kind === 'soul',
    };
    Ent.items.push(it);
    return it;
  };

  Ent.spawnBolt = function (x, y, z, dx, dy, dz, spd, dmg, opts) {
    opts = opts || {};
    Ent.bolts.push({
      x: x, y: y, z: z,
      vx: dx * spd, vy: dy * spd, vz: dz * spd,
      dmg: dmg, life: opts.life || 4.5, alive: true,
      col: opts.col || [0.75, 0.25, 1.0],
      size: opts.size || 0.11, homing: opts.homing || 0,
      spin: Math.random() * 6,
    });
  };

  /* --------------------------- 受伤 / 死亡 --------------------------- */
  // opts: {dirX,dirZ,crit,heavy,hitId,knock,py(命中高度)}
  Ent.hurt = function (e, dmg, opts) {
    if (!e.alive || e.dead) return 0;
    opts = opts || {};
    if (opts.hitId !== undefined && e.lastHitId === opts.hitId) return 0;   // 同一次挥砍只判定一次
    if (opts.hitId !== undefined) e.lastHitId = opts.hitId;

    const dirX = opts.dirX || 0, dirZ = opts.dirZ || 0;
    e.hp -= dmg;
    e.flash = 0.14;
    e.seen = true;
    if (!e.boss) e.stagger = Math.max(e.stagger, opts.heavy ? 0.42 : 0.2);
    const kb = (opts.knock || 1) * (opts.heavy ? 5.4 : 2.3) / e.def.mass;
    e.vx += dirX * kb; e.vz += dirZ * kb;
    if (opts.heavy && !e.boss) e.vy += 2.2;

    const hy = opts.py === undefined ? (e.y + e.height * 0.62) : opts.py;

    // 喷血
    const amount = U.clamp(dmg * 0.55, 6, 34) * (opts.heavy ? 1.6 : 1);
    Gore.spray(e.x - dirX * e.radius * 0.5, hy, e.z - dirZ * e.radius * 0.5,
      -dirX, 0.35, -dirZ, amount, opts.heavy ? 3.0 : 2.1);
    Gore.addDecal(e.x, e.z, 0.4 + Math.random() * 0.5, 0.85);

    G.Audio.play(opts.crit ? 'hitCrit' : 'hitFlesh', { x: e.x, z: e.z, pitch: e.def.pitch });
    if (Math.random() < 0.4) G.Audio.play('bone', { x: e.x, z: e.z });
    if (Math.random() < 0.55) G.Audio.play('hurtEnemy', { x: e.x, z: e.z, pitch: e.def.pitch });

    // 断肢：非致命也可能砍飞手臂
    if (!e.boss && e.hp > 0 && (opts.heavy || Math.random() < 0.24)) {
      const cands = ['armL', 'armR', 'head'].filter(p => e.model.parts[p] && !e.lost[p]);
      if (cands.length && (opts.heavy ? Math.random() < 0.7 : Math.random() < 0.4)) {
        const p = cands[(Math.random() * cands.length) | 0];
        if (!(p === 'head' && e.hp > e.maxHp * 0.35)) {   // 砍头基本等于处刑
          Ent.dismember(e, p, dirX, dirZ, opts.heavy ? 2.4 : 1.5);
          if (p === 'head') { e.hp = Math.min(e.hp, 1); e.headless = true; }
        }
      }
    }

    if (e.hp <= 0) {
      Ent.kill(e, dirX, dirZ, opts.heavy ? 2.4 : 1.5, hy, opts);
      return 1;
    }
    // Boss 阶段推进
    if (e.boss) {
      const frac = e.hp / e.maxHp;
      const want = e.def.phases - Math.floor(frac * e.def.phases);
      if (want > e.phase) { e.phase = want; onBossPhase(e); }
    }
    return 0;
  };

  Ent.dismember = function (e, partName, dirX, dirZ, power) {
    const part = e.model.parts[partName];
    if (!part || e.lost[partName]) return;
    e.lost[partName] = true;
    // 该部件的每个盒子 → 肢块（用与渲染完全一致的矩阵，避免朝向不一致）
    const s = e.scale;
    M4.compose(mEnt, e.x, e.y, e.z, -e.yaw, 0, 0, s, s, s);
    const pv = part.pivot;
    let px = 0, py = 0, pz = 0;
    for (const b of part.boxes) {
      const lx = pv[0] + b[0], ly = pv[1] + b[1], lz = pv[2] + b[2];
      const wx = mEnt[0] * lx + mEnt[4] * ly + mEnt[8] * lz + mEnt[12];
      const wy = mEnt[1] * lx + mEnt[5] * ly + mEnt[9] * lz + mEnt[13];
      const wz = mEnt[2] * lx + mEnt[6] * ly + mEnt[10] * lz + mEnt[14];
      px = wx; py = wy; pz = wz;
      Gore.chunk(wx, wy, wz, b[3] * s, b[4] * s, b[5] * s, b[6],
        dirX * 3.5 * power + (Math.random() - 0.5) * 4,
        2.5 + Math.random() * 3.5,
        dirZ * 3.5 * power + (Math.random() - 0.5) * 4,
        b[7] > 0 ? 'glow' : 'flesh');
    }
    Gore.spray(px, py, pz, dirX, 0.8, dirZ, 26, 3.4);
    G.Audio.play('gib', { x: e.x, z: e.z, vol: 0.7 });
    if (Ent.ctx && Ent.ctx.game) Ent.ctx.game.onDismember(e, partName);
  };

  Ent.kill = function (e, dirX, dirZ, power, hy, opts) {
    if (e.dead) return;
    e.dead = true; e.alive = false;
    const g = Ent.ctx && Ent.ctx.game;
    const overkill = (opts && opts.heavy) || (e.hp < -e.maxHp * 0.35);

    // 完全爆碎
    Gore.gibEntity(e, dirX, dirZ, (e.def.gib || 1) * power * (overkill ? 1.5 : 1), hy);
    G.Audio.play('gib', { x: e.x, z: e.z });
    G.Audio.play('scream', { x: e.x, z: e.z, pitch: e.def.pitch });

    // 掉落
    const n = 1 + ((e.soulValue / 3) | 0);
    for (let i = 0; i < Math.min(n, 8); i++) {
      const a = Math.random() * U.TAU;
      Ent.spawnItem('soul', e.x + Math.cos(a) * 0.3, e.z + Math.sin(a) * 0.3, {
        value: Math.max(1, Math.round(e.soulValue / Math.min(n, 8))),
        vy: 2.5 + Math.random() * 2, vx: Math.cos(a) * 1.4, vz: Math.sin(a) * 1.4,
      });
    }
    if (e.carriesBrand) Ent.spawnItem('brand', e.x, e.z, { vy: 3.2 });
    if (!e.boss && Math.random() < 0.14) Ent.spawnItem('heart', e.x + 0.2, e.z, { vy: 2.4 });

    if (g) g.onEnemyKilled(e, overkill);

    // 从列表移除（延迟到 update 末尾统一清理）
    e.removeMe = true;
  };

  function onBossPhase(e) {
    G.Audio.play('bossRoar', { x: e.x, z: e.z });
    e.stagger = 0;
    e.spd *= 1.12;
    e.patternCd = 0.4;
    Gore.spray(e.x, e.y + e.height * 0.5, e.z, 0, 1, 0, 40, 3.4);
    for (let i = 0; i < 26; i++) {
      const a = i / 26 * U.TAU;
      Gore.drop(e.x, e.y + e.height * 0.4, e.z, Math.cos(a) * 7, 3 + Math.random() * 3, Math.sin(a) * 7, 0.07);
    }
    if (Ent.ctx && Ent.ctx.game) Ent.ctx.game.onBossPhase(e);
  }

  /* --------------------------- 更新 --------------------------- */
  Ent.update = function (dt, ctx) {
    Ent.ctx = ctx;
    const map = ctx.map, P = ctx.player;
    const list = Ent.list;

    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (e.removeMe) continue;
      e.animT += dt;
      if (e.flash > 0) e.flash -= dt;
      if (e.spawnAnim > 0) e.spawnAnim -= dt;

      // 顿帧：命中瞬间敌人静止一小会儿 → 打击感
      if (e.hitStop > 0) { e.hitStop -= dt; continue; }

      const dxp = P.x - e.x, dzp = P.z - e.z;
      const distP = Math.sqrt(dxp * dxp + dzp * dzp);
      const dirPX = distP > 0.001 ? dxp / distP : 0;
      const dirPZ = distP > 0.001 ? dzp / distP : 0;

      // 感知
      if (!e.seen) {
        if (distP < e.def.sight && map.los(e.x, e.z, P.x, P.z)) {
          e.seen = true; e.state = 'alert'; e.stateT = 0;
          G.Audio.play('growl', { x: e.x, z: e.z, pitch: e.def.pitch });
        }
      }

      if (e.stagger > 0) {
        e.stagger -= dt;
        e.state = 'stagger';
      } else if (e.state === 'stagger') {
        e.state = 'chase';
      }

      e.stateT += dt;
      e.atkCd -= dt; e.cd -= dt; e.blinkCd -= dt;
      if (e.boss) { e.patternCd -= dt; e.summonCd -= dt; }

      // ---- 状态机 ----
      if (e.seen && e.state !== 'stagger') {
        // 面向玩家
        const wantYaw = U.yawOf(dirPX, dirPZ);
        const turn = (e.state === 'attack' ? 2.2 : 6.5) * dt;
        e.yaw = U.turnToward(e.yaw, wantYaw, turn);

        switch (e.state) {
          case 'alert':
            if (e.stateT > 0.35) { e.state = 'chase'; e.stateT = 0; }
            break;

          case 'chase': {
            const def = e.def;
            let moveDir = 1;
            let targetDist = def.ranged ? (def.keepDist || 7) : def.range * 0.8;
            if (e.boss) targetDist = def.range * 0.85;
            if (distP > targetDist) moveDir = 1;
            else if (distP < targetDist * 0.6) moveDir = -0.6;
            else moveDir = 0;

            const spd = e.spd * (e.boss ? 1 : (1 + (e.depth - 1) * 0.012));
            if (moveDir !== 0) {
              // 环绕一点，避免所有怪挤成一条线
              const strafe = Math.sin(e.animT * 0.8 + e.floatPhase) * (def.ranged ? 0.8 : 0.35);
              const mx = (dirPX * moveDir - dirPZ * strafe);
              const mz = (dirPZ * moveDir + dirPX * strafe);
              const ml = Math.sqrt(mx * mx + mz * mz) || 1;
              e.vx += (mx / ml) * spd * 9 * dt;
              e.vz += (mz / ml) * spd * 9 * dt;
            }
            // 攻击时机
            const canSee = map.los(e.x, e.z, P.x, P.z);
            if (e.atkCd <= 0 && canSee) {
              if (e.boss) {
                if (e.patternCd <= 0) { startBossPattern(e, ctx, distP); }
              } else if (def.ranged && distP < def.range && distP > 2.2) {
                e.state = 'attack'; e.stateT = 0; e.atkType = 'cast';
              } else if (!def.ranged && distP < def.range + 0.35) {
                e.state = 'attack'; e.stateT = 0; e.atkType = def.leap && distP > 2.6 ? 'leap' : 'melee';
              } else if (def.leap && distP < 7 && distP > 3 && Math.random() < 0.02) {
                e.state = 'attack'; e.stateT = 0; e.atkType = 'leap';
              }
            }
            // 亡魂闪现
            if (def.blink && e.blinkCd <= 0 && distP > 5 && distP < 16) {
              e.blinkCd = 4 + Math.random() * 4;
              const tx = P.x - dirPX * 2.2, tz = P.z - dirPZ * 2.2;
              if (!map.isSolidAt(tx, tz)) {
                Gore.mist(e.x, e.y + e.height * 0.5, e.z, 1.1, 0.4, 'dust', 0.4);
                e.x = tx; e.z = tz;
                Gore.mist(e.x, e.y + e.height * 0.5, e.z, 1.1, 0.4, 'dust', 0.4);
                G.Audio.play('dash', { x: e.x, z: e.z });
              }
            }
            break;
          }

          case 'attack': {
            const def = e.def;
            const wind = e.atkType === 'leap' ? 0.28 : (e.atkPattern ? e.atkWind : def.wind);
            if (!e.struck && e.stateT >= wind) {
              e.struck = true;
              doAttack(e, ctx, distP, dirPX, dirPZ);
            }
            if (e.stateT >= wind + (e.atkPattern ? e.atkRec : def.rec)) {
              e.state = 'chase'; e.stateT = 0; e.struck = false;
              e.atkCd = (e.boss ? 0.25 : 0.35) + Math.random() * 0.4;
              e.atkPattern = null;
              if (e.boss) e.patternCd = 1.0 + Math.random() * 1.4;
            }
            break;
          }
        }
      } else if (!e.seen) {
        // 待机：缓慢晃动 / 偶尔挪动
        if (e.cd <= 0) {
          e.cd = 2 + Math.random() * 3;
          e.idleYaw = e.yaw + (Math.random() - 0.5) * 2.2;
        }
        e.yaw = U.turnToward(e.yaw, e.idleYaw === undefined ? e.yaw : e.idleYaw, 1.2 * dt);
      }

      // 敌人之间互相分离
      for (let j = i + 1; j < list.length; j++) {
        const o = list[j];
        if (o.removeMe || !o.alive) continue;
        const ddx = o.x - e.x, ddz = o.z - e.z;
        const d2 = ddx * ddx + ddz * ddz;
        const minD = e.radius + o.radius;
        if (d2 < minD * minD && d2 > 0.0001) {
          const d = Math.sqrt(d2);
          const push = (minD - d) * 3.4;
          const nx = ddx / d, nz = ddz / d;
          const em = e.def.mass, om = o.def.mass, tm = em + om;
          e.vx -= nx * push * (om / tm); e.vz -= nz * push * (om / tm);
          o.vx += nx * push * (em / tm); o.vz += nz * push * (em / tm);
        }
      }

      // ---- 物理 ----
      const fric = e.float ? 3.0 : 7.5;
      e.vx -= e.vx * Math.min(1, fric * dt);
      e.vz -= e.vz * Math.min(1, fric * dt);
      moveEntity(e, map, e.vx * dt, e.vz * dt);

      // 垂直
      const gnd = map.floorAt(e.x, e.z);
      e.groundY = gnd;
      if (e.float) {
        e.floatPhase += dt * 1.6;
        const want = gnd + 0.55 + Math.sin(e.floatPhase) * 0.16;
        e.y = U.damp(e.y, want, 4, dt);
        e.vy = 0;
      } else {
        e.vy -= 22 * dt;
        e.y += e.vy * dt;
        if (e.y <= gnd) {
          if (e.vy < -6) {
            Gore.dust(e.x, gnd, e.z, 3, 0.5);
            G.Audio.play('land', { x: e.x, z: e.z });
          }
          e.y = gnd; e.vy = 0;
        }
        const ceilY = map.ceilAt(e.x, e.z);
        if (e.y + e.height > ceilY) e.y = Math.max(gnd, ceilY - e.height);
      }
    }

    // ---- 投射物 ----
    for (let i = 0; i < Ent.bolts.length; i++) {
      const b = Ent.bolts[i];
      if (!b.alive) continue;
      b.life -= dt; b.spin += dt * 9;
      if (b.life <= 0) { b.alive = false; continue; }
      if (b.homing > 0) {
        const dx = P.x - b.x, dy = (P.y + 1.0) - b.y, dz = P.z - b.z;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
        const sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy + b.vz * b.vz);
        b.vx = U.lerp(b.vx, dx / d * sp, b.homing * dt);
        b.vy = U.lerp(b.vy, dy / d * sp, b.homing * dt);
        b.vz = U.lerp(b.vz, dz / d * sp, b.homing * dt);
      }
      b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
      if (Math.random() < 0.6) Gore.mist(b.x, b.y, b.z, 0.22, 0.22, 'ember', 0.1);
      // 撞墙
      if (map.isSolidAt(b.x, b.z) || b.y < map.floorAt(b.x, b.z) || b.y > map.ceilAt(b.x, b.z)) {
        b.alive = false;
        Gore.sparks(b.x, b.y, b.z, 0, 0.4, 0, 7);
        G.Audio.play('hitWall', { x: b.x, z: b.z, vol: 0.6 });
        continue;
      }
      // 命中玩家
      const dpx = P.x - b.x, dpz = P.z - b.z, dpy = (P.y + 0.9) - b.y;
      if (dpx * dpx + dpz * dpz < 0.32 && Math.abs(dpy) < 1.15) {
        b.alive = false;
        P.hurt(b.dmg, b.x, b.z, 'bolt');
        Gore.sparks(b.x, b.y, b.z, 0, 0.4, 0, 10);
      }
    }

    /* ---- 道具 ---- */
    for (let i = 0; i < Ent.items.length; i++) {
      const it = Ent.items[i];
      if (!it.alive) continue;
      it.t += dt;
      it.life -= dt;
      if (it.life <= 0) { it.alive = false; continue; }
      if (!it.grounded) {
        it.vy -= 16 * dt;
        it.x += it.vx * dt; it.z += it.vz * dt;
        it.vx *= 0.96; it.vz *= 0.96;
        it.y += it.vy * dt;
        const gy = map.floorAt(it.x, it.z) + 0.28;
        if (map.isSolidAt(it.x, it.z)) { it.x -= it.vx * dt; it.z -= it.vz * dt; it.vx = it.vz = 0; }
        if (it.y <= gy) { it.y = gy; it.grounded = true; it.vy = 0; }
      } else {
        it.y = map.floorAt(it.x, it.z) + 0.28 + Math.sin(it.t * 2.4) * 0.055;
      }
      // 魂会被吸过来
      const dx = P.x - it.x, dz = P.z - it.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (it.magnet && d < 4.5) {
        const pull = (1 - d / 4.5) * 9 * dt;
        it.x += dx / (d || 1) * pull; it.z += dz / (d || 1) * pull;
      }
      const pickR = it.kind === 'soul' ? 0.85 : 0.95;
      if (d < pickR && Math.abs(P.y + 0.5 - it.y) < 1.8) {
        it.alive = false;
        if (Ent.ctx.game) Ent.ctx.game.onPickup(it);
      }
    }

    // 清理
    for (let i = Ent.list.length - 1; i >= 0; i--) if (Ent.list[i].removeMe) Ent.list.splice(i, 1);
    for (let i = Ent.bolts.length - 1; i >= 0; i--) if (!Ent.bolts[i].alive) Ent.bolts.splice(i, 1);
    for (let i = Ent.items.length - 1; i >= 0; i--) if (!Ent.items[i].alive) Ent.items.splice(i, 1);
  };

  // 圆形 vs 栅格 滑动碰撞
  function moveEntity(e, map, dx, dz) {
    const r = e.radius;
    let nx = e.x + dx;
    if (!blocked(map, nx, e.z, r)) e.x = nx; else e.vx *= -0.15;
    let nz = e.z + dz;
    if (!blocked(map, e.x, nz, r)) e.z = nz; else e.vz *= -0.15;
  }
  function blocked(map, x, z, r) {
    if (map.isSolidAt(x, z)) return true;
    // 检查四个方向的贴边
    if (map.isSolidAt(x + r, z) || map.isSolidAt(x - r, z) ||
      map.isSolidAt(x, z + r) || map.isSolidAt(x, z - r)) return true;
    const c = r * 0.72;
    if (map.isSolidAt(x + c, z + c) || map.isSolidAt(x - c, z + c) ||
      map.isSolidAt(x + c, z - c) || map.isSolidAt(x - c, z - c)) return true;
    return false;
  }
  Ent.blocked = blocked;

  /* --------------------------- 攻击执行 --------------------------- */
  function doAttack(e, ctx, distP, dirPX, dirPZ) {
    const P = ctx.player, def = e.def;
    const hy = e.y + e.height * 0.6;

    if (e.atkPattern === 'ring') {
      const n = 12 + e.phase * 4;
      for (let i = 0; i < n; i++) {
        const a = i / n * U.TAU + e.animT;
        Ent.spawnBolt(e.x, hy, e.z, Math.cos(a), -0.02, Math.sin(a), 7.5, e.dmg * 0.55,
          { col: [1, 0.3, 0.15], size: 0.14 });
      }
      G.Audio.play('doorSeal', { x: e.x, z: e.z });
      return;
    }
    if (e.atkPattern === 'summon') {
      const n = 2 + e.phase;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * U.TAU, r = 3 + Math.random() * 3;
        const sx = e.x + Math.cos(a) * r, sz = e.z + Math.sin(a) * r;
        if (ctx.map.isSolidAt(sx, sz)) continue;
        const t = Math.random() < 0.5 ? 'ghoul' : 'hound';
        const m = Ent.spawn(t, sx, sz, { depth: e.depth, spawnAnim: true });
        m.seen = true; m.state = 'chase';
        Gore.mist(sx, m.y + 0.6, sz, 1.4, 0.6, 'dust', 0.5);
        Gore.spray(sx, m.y + 0.4, sz, 0, 1, 0, 12, 2);
      }
      G.Audio.play('bossRoar', { x: e.x, z: e.z, vol: 0.6 });
      return;
    }
    if (e.atkPattern === 'charge') {
      e.vx += dirPX * 26; e.vz += dirPZ * 26;
      e.chargeT = 0.55;
      G.Audio.play('swingHeavy', { x: e.x, z: e.z });
      return;
    }

    if (e.atkType === 'leap') {
      e.vx += dirPX * 12; e.vz += dirPZ * 12; e.vy = 6.2;
      G.Audio.play('swing', { x: e.x, z: e.z, pitch: 1.4 });
      e.leaping = true;
      return;
    }
    if (e.atkType === 'cast' || (def.ranged && distP > def.range * 0.4)) {
      const dy = ((P.y + 1.05) - hy) / Math.max(1, distP);
      const spread = 0.06;
      Ent.spawnBolt(e.x + dirPX * 0.5, hy, e.z + dirPZ * 0.5,
        dirPX + (Math.random() - 0.5) * spread, dy, dirPZ + (Math.random() - 0.5) * spread,
        e.boss ? 11 : 8.5, e.dmg, {
          col: e.type === 'cultist' ? [0.72, 0.3, 1] : [1, 0.35, 0.15],
          size: e.boss ? 0.17 : 0.11, homing: e.boss ? 0.6 : 0,
        });
      G.Audio.play('growl', { x: e.x, z: e.z, pitch: def.pitch * 1.4 });
      return;
    }

    // 近战
    G.Audio.play('swing', { x: e.x, z: e.z, pitch: def.pitch * 1.15 });
    const reach = def.range + 0.4;
    if (distP < reach) {
      const facing = Math.cos(U.angleDiff(e.yaw, U.yawOf(dirPX, dirPZ)));
      if (facing > 0.35) P.hurt(e.dmg, e.x, e.z, e.type);
    }
    if (def.shock) {
      // 冲击波：着地范围伤害
      Gore.dust(e.x + dirPX * 1.4, e.groundY, e.z + dirPZ * 1.4, 10, 0.9);
      const d2 = U.dist2(P.x, P.z, e.x + dirPX * 1.4, e.z + dirPZ * 1.4);
      if (d2 < 6.5) P.hurt(e.dmg * 0.45, e.x, e.z, 'shock');
      if (ctx.game) ctx.game.shake(0.35, 0.22);
      G.Audio.play('land', { x: e.x, z: e.z, vol: 1.2 });
    }
  }

  function startBossPattern(e, ctx, distP) {
    const r = Math.random();
    e.state = 'attack'; e.stateT = 0; e.struck = false;
    e.atkWind = 0.6; e.atkRec = 0.8;
    if (e.def.summon && e.summonCd <= 0 && r < 0.3) {
      e.atkPattern = 'summon'; e.summonCd = 12 - e.phase * 2;
      e.atkWind = 0.9; e.atkRec = 0.9;
    } else if (e.def.ranged && r < 0.55 && e.phase >= 2) {
      e.atkPattern = 'ring'; e.atkWind = 0.85; e.atkRec = 0.7;
    } else if (distP > 5 && r < 0.8) {
      e.atkPattern = 'charge'; e.atkWind = 0.45; e.atkRec = 0.75;
    } else {
      e.atkPattern = null; e.atkType = 'melee';
      e.atkWind = e.def.wind; e.atkRec = e.def.rec;
    }
  }

  /* --------------------------- 姿态（程序化动画） --------------------------- */
  const POSE = {};
  function pose(name, rx, ry, rz, ox, oy, oz) {
    POSE[name] = POSE[name] || {};
    const p = POSE[name];
    p.rx = rx || 0; p.ry = ry || 0; p.rz = rz || 0;
    p.ox = ox || 0; p.oy = oy || 0; p.oz = oz || 0;
    return p;
  }

  function buildPose(e, t) {
    const model = e.model;
    const moving = (Math.abs(e.vx) + Math.abs(e.vz)) > 0.5;
    const gait = model.gait;
    const spd = Math.min(2.2, Math.sqrt(e.vx * e.vx + e.vz * e.vz) * 0.5);
    const ph = e.animT * (4 + spd * 3);
    const atk = e.state === 'attack';
    const stag = e.state === 'stagger';
    let atkT = 0, wind = 0;
    if (atk) {
      wind = e.atkPattern ? e.atkWind : e.def.wind;
      atkT = e.stateT < wind ? -(e.stateT / wind) : U.clamp((e.stateT - wind) / 0.18, 0, 1);
    }

    for (const pn of model.order) POSE[pn] = pose(pn, 0, 0, 0, 0, 0, 0);

    if (gait === 'quad') {
      const s = moving ? Math.sin(ph) : Math.sin(e.animT * 1.4) * 0.15;
      const c = moving ? Math.cos(ph) : 0;
      pose('legL', s * 0.9);
      pose('legR', -s * 0.9);
      pose('legL2', -s * 0.9);
      pose('legR2', s * 0.9);
      pose('torso', moving ? Math.sin(ph * 2) * 0.06 : 0, 0, c * 0.05, 0, moving ? Math.abs(Math.sin(ph)) * 0.05 : 0, 0);
      pose('head', atk ? (atkT < 0 ? -0.5 : 0.6) : Math.sin(e.animT * 1.1) * 0.12);
      pose('tail', Math.sin(e.animT * 3) * 0.3, Math.sin(e.animT * 2.2) * 0.4);
      if (e.leaping) { pose('legL', -1.1); pose('legR', -1.1); pose('legL2', 0.9); pose('legR2', 0.9); }
    } else if (gait === 'float') {
      const bob = Math.sin(e.animT * 1.7) * 0.08;
      pose('torso', bob * 0.5, 0, Math.sin(e.animT * 1.1) * 0.09);
      pose('head', Math.sin(e.animT * 0.9) * 0.1);
      const swing = Math.sin(e.animT * 1.5) * 0.35;
      if (atk) {
        const a = atkT < 0 ? U.lerp(0, -1.5, -atkT) : U.lerp(-1.5, 1.1, atkT);
        pose('armL', a); pose('armR', a * 0.85);
      } else { pose('armL', swing - 0.3); pose('armR', -swing - 0.3); }
      pose('tatter', Math.sin(e.animT * 2.1) * 0.12, Math.sin(e.animT * 1.3) * 0.2);
    } else {
      // 人形步态
      const s = moving ? Math.sin(ph) : Math.sin(e.animT * 1.2) * 0.08;
      pose('legL', s * 0.85);
      pose('legR', -s * 0.85);
      const bob = moving ? Math.abs(Math.cos(ph)) * 0.055 : Math.sin(e.animT * 1.3) * 0.012;
      pose('torso', moving ? -0.14 - Math.sin(ph * 2) * 0.04 : -0.06, 0, moving ? Math.sin(ph) * 0.05 : 0, 0, bob, 0);
      pose('head', moving ? Math.sin(ph * 2) * 0.06 + 0.1 : 0.08 + Math.sin(e.animT * 0.8) * 0.1, Math.sin(e.animT * 0.6) * 0.15);
      if (atk) {
        // 抬手 → 挥落
        const a = atkT < 0 ? U.lerp(-0.2, -2.5, -atkT) : U.lerp(-2.5, 1.35, U.easeOut(atkT));
        pose('armR', a, 0, -0.2);
        pose('armL', a * 0.7, 0, 0.2);
        pose('torso', atkT < 0 ? -0.3 : 0.35, 0, 0, 0, 0, 0);
      } else {
        pose('armL', -s * 0.7 - 0.25, 0, 0.12);
        pose('armR', s * 0.7 - 0.25, 0, -0.12);
      }
    }
    if (stag) {
      const k = U.clamp(e.stagger * 3, 0, 1);
      pose('torso', 0.5 * k, 0, (e.animT * 30 % 2 < 1 ? 0.2 : -0.2) * k, 0, 0, -0.08 * k);
      pose('head', 0.7 * k);
    }
    if (e.spawnAnim > 0) {
      const k = U.clamp(e.spawnAnim / 0.6, 0, 1);
      for (const pn of model.order) { POSE[pn].oy = -k * 1.4; }
    }
    return POSE;
  }
  Ent.buildPose = buildPose;

  /* --------------------------- 渲染 --------------------------- */
  Ent.emit = function (mb, T, lightFn, camX, camZ, maxDist) {
    const list = Ent.list;
    const d2max = maxDist * maxDist;
    const white = T.white, gore = T.gore;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (e.removeMe) continue;
      if (U.dist2(e.x, e.z, camX, camZ) > d2max) continue;
      const p = buildPose(e, 0);
      const s = e.scale;
      M4.compose(mEnt, e.x, e.y, e.z, -e.yaw, 0, 0, s, s, s);

      let l = U.clamp(lightFn(e.x, e.z) * 1.05, 0.16, 1.5);
      let cm = null, emis = 0;
      if (e.flash > 0) { const f = e.flash / 0.14; cm = [1 + f * 3.5, 1 + f * 1.2, 1 + f * 1.2]; emis = f * 0.55; }
      if (e.elite) { cm = cm || [1.25, 0.72, 0.72]; emis = Math.max(emis, 0.12); }
      if (e.boss) emis = Math.max(emis, 0.06);

      for (const pn of e.model.order) {
        if (e.lost[pn]) continue;
        const part = e.model.parts[pn];
        const ps = p[pn] || { rx: 0, ry: 0, rz: 0, ox: 0, oy: 0, oz: 0 };
        M4.compose(mLocal,
          part.pivot[0] + ps.ox, part.pivot[1] + ps.oy, part.pivot[2] + ps.oz,
          ps.ry, ps.rx, ps.rz, 1, 1, 1);
        M4.mul(mWorld, mEnt, mLocal);
        G.Art.emitPart(mb, part, mWorld, white, l, cm, emis);
      }
      // 断肢处的血口
      for (const pn in e.lost) {
        const part = e.model.parts[pn];
        if (!part) continue;
        const pv = part.pivot;
        M4.compose(mLocal, pv[0], pv[1], pv[2], 0, 0, 0, 1, 1, 1);
        M4.mul(mWorld, mEnt, mLocal);
        mb.boxM(mWorld, 0, 0, 0, 0.075, 0.06, 0.075, gore, [0.55, 0.06, 0.07], l * 1.2, 0.15);
      }
    }
  };

  Ent.emitBolts = function (mb, T, rx, ry, rz, ux, uy, uz) {
    const white = T.white, glow = T.glow;
    for (const b of Ent.bolts) {
      if (!b.alive) continue;
      mb.billboard(b.x, b.y, b.z, b.size * 6, b.size * 6, rx, ry, rz, ux, uy, uz, glow, b.col, 1.6, 1);
      M4.compose(mEnt, b.x, b.y, b.z, b.spin, b.spin * 0.7, 0, 1, 1, 1);
      mb.boxM(mEnt, 0, 0, 0, b.size, b.size, b.size, white, b.col, 1.5, 1);
    }
  };

  Ent.emitItems = function (mb, T, lightFn) {
    const white = T.white;
    for (const it of Ent.items) {
      if (!it.alive) continue;
      const l = it.kind === 'soul' ? 1.6 : U.clamp(lightFn(it.x, it.z) * 1.3, 0.3, 1.6);
      M4.compose(mEnt, it.x, it.y, it.z, it.t * 1.6, 0, 0, 1, 1, 1);
      const part = it.model.parts.body;
      G.Art.emitPart(mb, part, mEnt, white, l, null, it.kind === 'soul' ? 0.9 : 0.25);
    }
  };
  Ent.emitItemGlow = function (mb, T, rx, ry, rz, ux, uy, uz) {
    for (const it of Ent.items) {
      if (!it.alive) continue;
      const col = it.kind === 'soul' ? [1, 0.82, 0.4] : (it.kind === 'heart' ? [1, 0.2, 0.2] : [1, 0.35, 0.2]);
      const sz = it.kind === 'soul' ? 0.5 : 0.75;
      mb.billboard(it.x, it.y, it.z, sz, sz, rx, ry, rz, ux, uy, uz, T.glow, col, 1.4, 1);
    }
  };

  /* --------------------------- 查询 --------------------------- */
  Ent.aliveCount = function () {
    let n = 0;
    for (const e of Ent.list) if (!e.removeMe && e.alive) n++;
    return n;
  };
  Ent.boss = function () {
    for (const e of Ent.list) if (e.boss && !e.removeMe) return e;
    return null;
  };
  // 扇形范围内的敌人（巨剑挥砍判定）
  Ent.inArc = function (x, z, y, yaw, range, halfAngle, out) {
    out.length = 0;
    for (const e of Ent.list) {
      if (e.removeMe || !e.alive) continue;
      const dx = e.x - x, dz = e.z - z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d > range + e.radius) continue;
      // 高度检查
      if (y < e.y - 0.9 || y > e.y + e.height + 0.7) continue;
      if (d > 0.35) {
        const a = Math.abs(U.angleDiff(yaw, U.yawOf(dx / d, dz / d)));
        // 距离越近角度容忍越大
        const allow = halfAngle + Math.atan2(e.radius, Math.max(0.3, d));
        if (a > allow) continue;
      }
      out.push({ e: e, d: d, dx: d > 0.001 ? dx / d : 0, dz: d > 0.001 ? dz / d : 0 });
    }
    out.sort((a, b) => a.d - b.d);
    return out;
  };

  G.Entities = Ent;
})();
