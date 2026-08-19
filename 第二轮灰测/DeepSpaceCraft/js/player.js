/* DEEP SPACE CRAFT · player.js —— 玩家物理 / 采矿放置 / 生存数值 / 背包 / 扫描 */
(function () {
  'use strict';
  var DSC = (window.DSC = window.DSC || {});
  var W = function () { return DSC.World; }, B = DSC.Blocks, U = DSC.Util, A = function () { return DSC.Audio; };

  var WIDTH = 0.32, HEIGHT = 1.8, EYE = 1.62;
  var GRAV = -27, JUMP = 9.1;
  var SLOTS = 24;

  var P = {
    pos: new Float32Array([0, 60, 0]),
    vel: new Float32Array([0, 0, 0]),
    yaw: 0, pitch: 0,
    onGround: false, inWater: false, headInWater: false, sprint: false, sneak: false,
    thirdPerson: false,
    /* 生存数值（NMS 四表） */
    health: 100, healthMax: 100,
    shield: 100, shieldMax: 100,
    oxygen: 100, oxygenMax: 100,
    protection: 100, protectionMax: 100,
    units: 0, nanites: 0,
    /* 背包：0-8 快捷栏，9-23 背包 */
    slots: null, sel: 0,
    mine: { active: false, x: 0, y: 0, z: 0, id: 0, progress: 0, valid: false, dist: 0 },
    place: { cd: 0 },
    walkAcc: 0, bob: 0, fallFrom: null, hurtT: 0, healT: 0,
    scanT: 0, scanCd: 0, scanHits: null,
    dead: false, deadCause: '',
    stepT: 0,

    init: function (spawn, keepInventory) {
      P.pos[0] = spawn[0]; P.pos[1] = spawn[1]; P.pos[2] = spawn[2];
      P.vel[0] = P.vel[1] = P.vel[2] = 0;
      P.onGround = false; P.dead = false; P.fallFrom = null;
      if (!P.slots || !keepInventory) {
        P.slots = new Array(SLOTS);
        for (var i = 0; i < SLOTS; i++) P.slots[i] = null;
        /* 开局补给（NMS 味：一点碳、铁氧、钠 + 建造方块） */
        P.addItem('carbon', 40); P.addItem('ferrite', 30); P.addItem('sodium', 12);
        P.slots[6] = { k: 'metal_plate', n: 64 };
        P.slots[7] = { k: 'glow_panel', n: 32 };
        P.slots[8] = { k: 'planks', n: 64 };
      }
      if (!keepInventory) { P.health = P.healthMax; P.shield = P.shieldMax; P.oxygen = P.oxygenMax; P.protection = P.protectionMax; }
      return P;
    },

    /* ---------------------------------------------------------- 背包 */
    addItem: function (k, n) {
      if (!k || n <= 0) return 0;
      var it = B.item(k), max = it ? it.stack : 999, i;
      for (i = 0; i < SLOTS; i++) {
        var s = P.slots[i];
        if (s && s.k === k && s.n < max) {
          var add = Math.min(n, max - s.n);
          s.n += add; n -= add;
          if (n <= 0) return 0;
        }
      }
      for (i = 0; i < SLOTS; i++) {
        if (!P.slots[i]) {
          P.slots[i] = { k: k, n: Math.min(n, max) };
          n -= P.slots[i].n;
          if (n <= 0) return 0;
        }
      }
      return n; /* 溢出（背包满） */
    },
    count: function (k) {
      var t = 0;
      for (var i = 0; i < SLOTS; i++) if (P.slots[i] && P.slots[i].k === k) t += P.slots[i].n;
      return t;
    },
    removeItem: function (k, n) {
      if (P.count(k) < n) return false;
      for (var i = 0; i < SLOTS && n > 0; i++) {
        var s = P.slots[i];
        if (s && s.k === k) {
          var take = Math.min(n, s.n);
          s.n -= take; n -= take;
          if (s.n <= 0) P.slots[i] = null;
        }
      }
      return true;
    },
    selected: function () { return P.slots[P.sel]; },
    eye: function (out) {
      out = out || new Float32Array(3);
      out[0] = P.pos[0]; out[1] = P.pos[1] + EYE - (P.sneak ? 0.22 : 0); out[2] = P.pos[2];
      return out;
    },

    /* ---------------------------------------------------------- 伤害 / 治疗 */
    damage: function (n, cause) {
      if (P.dead || n <= 0) return;
      /* 护盾先扛 */
      if (P.shield > 0) {
        var absorbed = Math.min(P.shield, n * 0.75);
        P.shield -= absorbed; n -= absorbed;
      }
      P.health -= n;
      P.hurtT = 0.45;
      A() && A().play('hurt', { volume: 0.75 });
      if (P.health <= 0) { P.health = 0; P.dead = true; P.deadCause = cause || '未知'; }
    },
    heal: function (n) { P.health = Math.min(P.healthMax, P.health + n); P.healT = 0.5; },

    /* ---------------------------------------------------------- 主更新 */
    update: function (dt, input, planet, allowControl) {
      var Wd = W();
      if (P.dead) return;
      var i;
      P.hurtT = Math.max(0, P.hurtT - dt);
      P.healT = Math.max(0, P.healT - dt);
      P.scanT = Math.max(0, P.scanT - dt);
      P.scanCd = Math.max(0, P.scanCd - dt);
      P.place.cd = Math.max(0, P.place.cd - dt);

      /* --- 环境探测 --- */
      var feetId = Wd.blockAt(Math.floor(P.pos[0]), Math.floor(P.pos[1] + 0.1), Math.floor(P.pos[2]));
      var bodyId = Wd.blockAt(Math.floor(P.pos[0]), Math.floor(P.pos[1] + 0.9), Math.floor(P.pos[2]));
      var headId = Wd.blockAt(Math.floor(P.pos[0]), Math.floor(P.pos[1] + EYE), Math.floor(P.pos[2]));
      P.inWater = B.isLiquid(feetId) || B.isLiquid(bodyId);
      P.headInWater = B.isLiquid(headId);
      var damBlock = Math.max(B.damage(feetId), B.damage(bodyId));

      /* --- 输入 → 期望速度 --- */
      var mvx = 0, mvz = 0;
      if (allowControl) {
        var f = (input.key('w') ? 1 : 0) - (input.key('s') ? 1 : 0);
        var r = (input.key('d') ? 1 : 0) - (input.key('a') ? 1 : 0);
        P.sprint = input.key('shift') && f > 0 && !P.sneak;
        P.sneak = input.key('control');
        if (f || r) {
          var sy = Math.sin(P.yaw), cy = Math.cos(P.yaw);
          /* yaw=0 面向 -Z */
          mvx = (-sy * f + cy * r);
          mvz = (-cy * f - sy * r);
          var ln = Math.sqrt(mvx * mvx + mvz * mvz);
          mvx /= ln; mvz /= ln;
        }
      }
      var speed = P.sneak ? 1.65 : (P.sprint ? 6.3 : 4.35);
      if (P.inWater) speed *= 0.62;
      var tvx = mvx * speed, tvz = mvz * speed;
      var accel = P.onGround ? 16 : (P.inWater ? 6 : 3.2);
      P.vel[0] = U.approach(P.vel[0], tvx, accel, dt);
      P.vel[2] = U.approach(P.vel[2], tvz, accel, dt);

      /* --- 跳跃 / 浮水 --- */
      if (allowControl && input.key(' ')) {
        if (P.inWater) { P.vel[1] = U.approach(P.vel[1], 3.6, 8, dt); if (Math.random() < dt * 3) A() && A().play('swim', { volume: 0.35 }); }
        else if (P.onGround) {
          P.vel[1] = JUMP; P.onGround = false;
          A() && A().play('jump', { volume: 0.5 });
        }
      }
      /* --- 重力 --- */
      if (P.inWater) {
        P.vel[1] += GRAV * 0.22 * dt;
        P.vel[1] *= Math.exp(-3.2 * dt);
      } else {
        P.vel[1] += GRAV * dt;
        if (P.vel[1] < -58) P.vel[1] = -58;
      }

      /* --- 碰撞推进（逐轴） --- */
      var wasGround = P.onGround;
      P.onGround = false;
      P._move(P.vel[0] * dt, 0, 0);
      P._move(0, P.vel[1] * dt, 0);
      P._move(0, 0, P.vel[2] * dt);

      /* --- 坠落伤害 --- */
      if (!P.onGround && P.vel[1] < -0.1) { if (P.fallFrom === null) P.fallFrom = P.pos[1]; else P.fallFrom = Math.max(P.fallFrom, P.pos[1]); }
      if (P.onGround && !wasGround) {
        var fell = P.fallFrom === null ? 0 : (P.fallFrom - P.pos[1]);
        if (fell > 4.2 && !P.inWater) P.damage((fell - 4.2) * 5.2, '坠落创伤');
        if (fell > 1.2) A() && A().play('land', { volume: Math.min(1, 0.25 + fell * 0.06) });
        P.fallFrom = null;
      }
      if (P.onGround) P.fallFrom = null;

      /* --- 脚步声 + 视角摇晃 --- */
      var hs = Math.sqrt(P.vel[0] * P.vel[0] + P.vel[2] * P.vel[2]);
      if (P.onGround && hs > 0.6) {
        P.walkAcc += hs * dt;
        P.bob += dt * hs * 1.5;
        var stride = P.sprint ? 1.85 : 2.35;
        if (P.walkAcc > stride) {
          P.walkAcc = 0;
          var gid = Wd.blockAt(Math.floor(P.pos[0]), Math.floor(P.pos[1] - 0.3), Math.floor(P.pos[2]));
          var mat = gid ? B.material(gid) : 'dirt';
          A() && A().play('step_' + mat, { volume: P.sneak ? 0.22 : 0.5, rate: 0.94 + Math.random() * 0.14 });
          /* 走路扬尘 */
          if (Math.random() < 0.5 && DSC.Particles) {
            var c = B.color(gid);
            DSC.Particles.spawn(P.pos[0] + (Math.random() - .5) * .4, P.pos[1] + 0.06, P.pos[2] + (Math.random() - .5) * .4,
              (Math.random() - .5) * .5, 0.5 + Math.random(), (Math.random() - .5) * .5,
              [c[0], c[1], c[2]], 0.07 + Math.random() * 0.05, 0.4, { grav: -3, drag: 2 });
          }
        }
      } else P.bob = U.approach(P.bob, 0, 6, dt);
      if (P.inWater && Math.random() < dt * 1.5) A() && A().play('swim', { volume: 0.2 });

      /* --- 生存数值 --- */
      var haz = planet.hazard;
      var hazardActive = haz.type !== 'none';
      if (hazardActive) {
        P.protection = Math.max(0, P.protection - haz.dps * dt * 0.42);
        if (P.protection <= 0) P.damage(haz.dps * dt * 1.6, DSC.Lore && DSC.Lore.biomeLabel ? (haz.type === 'heat' ? '高温灼伤' : haz.type === 'cold' ? '极寒冻伤' : haz.type === 'toxic' ? '毒性侵蚀' : '辐射侵袭') : '环境危害');
      } else if (P.protection < P.protectionMax) {
        P.protection = Math.min(P.protectionMax, P.protection + 3.5 * dt);
      }
      if (P.headInWater) {
        P.oxygen = Math.max(0, P.oxygen - 6.5 * dt);
        if (P.oxygen <= 0) { P.damage(9 * dt, '缺氧'); if (Math.random() < dt * 1.2) A() && A().play('drown', { volume: 0.6 }); }
      } else {
        P.oxygen = Math.min(P.oxygenMax, P.oxygen + 12 * dt);
      }
      if (damBlock > 0) P.damage(damBlock * dt, '接触高温物质');
      /* 护盾缓慢再生 */
      if (P.shield < P.shieldMax && P.hurtT <= 0) P.shield = Math.min(P.shieldMax, P.shield + 2.2 * dt);

      /* --- 采矿 / 放置 --- */
      P._tools(dt, input, allowControl);
    },

    _move: function (dx, dy, dz) {
      var Wd = W();
      var nx = P.pos[0] + dx, ny = P.pos[1] + dy, nz = P.pos[2] + dz;
      var hw = WIDTH, h = HEIGHT;
      if (dx !== 0) {
        if (Wd.boxSolid(nx - hw, P.pos[1] + 0.02, P.pos[2] - hw, nx + hw, P.pos[1] + h, P.pos[2] + hw)) {
          P.vel[0] = 0;
        } else P.pos[0] = nx;
      }
      if (dz !== 0) {
        if (Wd.boxSolid(P.pos[0] - hw, P.pos[1] + 0.02, nz - hw, P.pos[0] + hw, P.pos[1] + h, nz + hw)) {
          P.vel[2] = 0;
        } else P.pos[2] = nz;
      }
      if (dy !== 0) {
        if (Wd.boxSolid(P.pos[0] - hw, ny, P.pos[2] - hw, P.pos[0] + hw, ny + h, P.pos[2] + hw)) {
          if (dy < 0) { P.onGround = true; P.pos[1] = Math.floor(ny) + 1.0001; }
          P.vel[1] = 0;
        } else P.pos[1] = ny;
      }
    },

    /* 多功能工具：采矿激光 + 放置 */
    _tools: function (dt, input, allow) {
      var Wd = W(), m = P.mine;
      var eye = P.eye(), dir = DSC.Cam.fwd;
      var hit = Wd.raycast(eye, dir, 5.6);
      m.valid = !!hit.hit;
      if (hit.hit) { m.dist = hit.dist; }

      var mining = allow && input.mouse(0) && hit.hit;
      if (mining) {
        if (m.x !== hit.x || m.y !== hit.y || m.z !== hit.z) {
          m.x = hit.x; m.y = hit.y; m.z = hit.z; m.id = hit.id; m.progress = 0;
        }
        var hard = B.hardness(m.id);
        if (!isFinite(hard)) {
          if (DSC.UI) DSC.UI.toast('无法破坏 · INDESTRUCTIBLE');
          m.progress = 0;
        } else {
          var rate = 1 / (0.28 + hard * 0.42);
          m.progress += rate * dt;
          if (!m.active) { m.active = true; A() && A().mining(true, B.material(m.id)); }
          /* 多功能工具激光束（NMS 招牌）：从"枪口"到命中点撒发光颗粒，配合泛光即成光束 */
          if (DSC.Particles) {
            var Cm = DSC.Cam;
            var eye2 = P.eye();
            var mzx = eye2[0] + Cm.right[0] * 0.30 - Cm.up[0] * 0.20 + Cm.fwd[0] * 0.45;
            var mzy = eye2[1] + Cm.right[1] * 0.30 - Cm.up[1] * 0.20 + Cm.fwd[1] * 0.45;
            var mzz = eye2[2] + Cm.right[2] * 0.30 - Cm.up[2] * 0.20 + Cm.fwd[2] * 0.45;
            var hx = hit.x + 0.5 + hit.normal[0] * 0.5, hy = hit.y + 0.5 + hit.normal[1] * 0.5, hz = hit.z + 0.5 + hit.normal[2] * 0.5;
            for (var bi = 0; bi < 7; bi++) {
              var tt = (bi + Math.random() * 0.7) / 7;
              DSC.Particles.spawn(
                mzx + (hx - mzx) * tt, mzy + (hy - mzy) * tt, mzz + (hz - mzz) * tt,
                0, 0, 0,
                [1.0, 0.45 + 0.3 * tt, 0.14], 0.035 + 0.02 * (1 - tt), 0.05,
                { grav: 0, drag: 0, glow: 1 });
            }
            /* 命中点火花 */
            if (Math.random() < 0.6) {
              DSC.Particles.spawn(hx, hy, hz,
                (Math.random() - .5) * 3.2 + hit.normal[0] * 2, Math.random() * 2.4 + hit.normal[1] * 2, (Math.random() - .5) * 3.2 + hit.normal[2] * 2,
                [1.0, 0.8, 0.35], 0.06 + Math.random() * 0.05, 0.22, { grav: -7, drag: 1.1, glow: 1 });
            }
          }
          /* 挖掘音 + 碎屑 */
          P.stepT += dt;
          if (P.stepT > 0.2) {
            P.stepT = 0;
            A() && A().play('dig_' + B.material(m.id), { volume: 0.42, rate: 0.9 + Math.random() * 0.25 });
            if (DSC.Particles) {
              var c = B.color(m.id);
              DSC.Particles.burst(m.x + 0.5 + hit.normal[0] * 0.5, m.y + 0.5 + hit.normal[1] * 0.5, m.z + 0.5 + hit.normal[2] * 0.5,
                c, 3, { speed: 1.6, up: 1.4, size: 0.06, life: 0.4, glow: B.emissive(m.id) > 0.3 });
            }
          }
          if (m.progress >= 1) {
            P._breakBlock(m.x, m.y, m.z, m.id);
            m.progress = 0;
          }
        }
      } else {
        if (m.active) { m.active = false; A() && A().mining(false); }
        m.progress = Math.max(0, m.progress - dt * 2.4);
      }

      /* 放置 */
      if (allow && input.mouse(2) && P.place.cd <= 0 && hit.hit) {
        var s = P.selected();
        if (s && B.placeable(s.k)) {
          var bx = hit.x + hit.normal[0], by = hit.y + hit.normal[1], bz = hit.z + hit.normal[2];
          /* 不能放在玩家体内 */
          var inside = (bx + 1 > P.pos[0] - WIDTH && bx < P.pos[0] + WIDTH &&
            by + 1 > P.pos[1] && by < P.pos[1] + HEIGHT &&
            bz + 1 > P.pos[2] - WIDTH && bz < P.pos[2] + WIDTH);
          var cur = Wd.blockAt(bx, by, bz);
          if (!inside && (!cur || B.isLiquid(cur))) {
            var id = B.idOf(s.k);
            if (Wd.setBlock(bx, by, bz, id)) {
              s.n--; if (s.n <= 0) P.slots[P.sel] = null;
              P.place.cd = 0.17;
              A() && A().play(B.sfx(id, 'place'), { volume: 0.55, rate: 0.95 + Math.random() * 0.12 });
            }
          }
        } else if (s) {
          if (DSC.UI) DSC.UI.toast('该物品无法放置 · NOT PLACEABLE');
          P.place.cd = 0.4;
          A() && A().play('ui_error', { volume: 0.4 });
        }
        if (!s) P.place.cd = 0.2;
      }

      /* 中键取样 */
      if (allow && input.mouse(1) && hit.hit) {
        var key = B.keyOf(hit.id);
        for (var i = 0; i < 9; i++) {
          if (P.slots[i] && P.slots[i].k === key) { P.sel = i; break; }
        }
        input.clearMouse(1);
      }
    },

    _breakBlock: function (x, y, z, id) {
      var Wd = W();
      var c = B.color(id);
      Wd.setBlock(x, y, z, 0);
      A() && A().play(B.sfx(id, 'break'), { volume: 0.8, rate: 0.92 + Math.random() * 0.18 });
      if (DSC.Particles) DSC.Particles.burst(x + 0.5, y + 0.5, z + 0.5, c, 14, { glow: B.emissive(id) > 0.3 });
      var d = B.drops(id);
      if (d) {
        var left = P.addItem(d.k, d.n);
        if (left > 0) { if (DSC.UI) DSC.UI.toast('背包已满 · INVENTORY FULL'); }
        else {
          A() && A().play('item_pickup', { volume: 0.4, rate: 1 + Math.random() * 0.1 });
          if (DSC.UI) DSC.UI.resourceGain(d.k, d.n);
        }
      }
    },

    /* ---------------------------------------------------------- 扫描脉冲 */
    scan: function (planet) {
      if (P.scanCd > 0) { A() && A().play('ui_error', { volume: 0.35 }); return false; }
      P.scanCd = 3.2; P.scanT = 1.25;
      A() && A().play('scan_ping', { volume: 0.8 });
      A() && A().play('scan_sweep', { volume: 0.55, delay: 0.12 });
      var Wd = W(), hits = [], px = Math.floor(P.pos[0]), py = Math.floor(P.pos[1]), pz = Math.floor(P.pos[2]);
      var R = 26, seen = {};
      for (var dy = -12; dy <= 12; dy += 2) for (var dz = -R; dz <= R; dz += 3) for (var dx = -R; dx <= R; dx += 3) {
        var id = Wd.blockAt(px + dx, py + dy, pz + dz);
        if (!id) continue;
        var def = DSC.Blocks.LIST[id];
        var k = def.drop;
        var it = DSC.Blocks.item(k);
        if (!it || it.type !== 'resource' || it.value < 40) continue;
        if (seen[k] && seen[k] > 2) continue;
        seen[k] = (seen[k] || 0) + 1;
        hits.push({ x: px + dx + 0.5, y: py + dy + 0.5, z: pz + dz + 0.5, k: k, id: id });
        if (hits.length > 22) break;
      }
      P.scanHits = hits;
      if (DSC.UI) DSC.UI.onScan(hits, planet);
      setTimeout(function () { if (A()) A().play('scan_return', { volume: 0.5 }); }, 900);
      return true;
    },

    /* 消耗品使用 */
    consume: function (k) {
      if (k === 'med_kit' && P.removeItem('med_kit', 1)) { P.heal(45); A() && A().play('heal', { volume: 0.7 }); return true; }
      if (k === 'o2_canister' && P.removeItem('o2_canister', 1)) { P.oxygen = P.oxygenMax; A() && A().play('heal', { volume: 0.6 }); return true; }
      if (k === 'sodium' && P.removeItem('sodium', 2)) { P.shield = Math.min(P.shieldMax, P.shield + 40); P.protection = P.protectionMax; A() && A().play('item_craft', { volume: 0.6 }); return true; }
      if (k === 'oxygen' && P.removeItem('oxygen', 2)) { P.oxygen = P.oxygenMax; A() && A().play('heal', { volume: 0.6 }); return true; }
      return false;
    },

    /* 摄像机跟随（第一/第三人称 + 走路摇晃） */
    applyCamera: function (dt) {
      var Cam = DSC.Cam;
      Cam.yaw = P.yaw; Cam.pitch = P.pitch; Cam.roll = 0;
      var e = P.eye();
      var bobA = Math.sin(P.bob * 6.0) * 0.045, bobB = Math.abs(Math.cos(P.bob * 6.0)) * 0.03;
      if (!P.thirdPerson) {
        Cam.pos[0] = e[0] + Cam.right[0] * bobA;
        Cam.pos[1] = e[1] - bobB;
        Cam.pos[2] = e[2] + Cam.right[2] * bobA;
      } else {
        var back = 4.2, up = 1.2;
        Cam.pos[0] = e[0] - Cam.fwd[0] * back;
        Cam.pos[1] = e[1] - Cam.fwd[1] * back + up;
        Cam.pos[2] = e[2] - Cam.fwd[2] * back;
      }
    },

    serialize: function () {
      return {
        pos: [P.pos[0], P.pos[1], P.pos[2]], yaw: P.yaw, pitch: P.pitch,
        health: P.health, shield: P.shield, oxygen: P.oxygen, protection: P.protection,
        units: P.units, nanites: P.nanites, sel: P.sel,
        slots: P.slots.map(function (s) { return s ? [s.k, s.n] : null; })
      };
    },
    restore: function (d) {
      if (!d) return;
      P.pos[0] = d.pos[0]; P.pos[1] = d.pos[1]; P.pos[2] = d.pos[2];
      P.yaw = d.yaw || 0; P.pitch = d.pitch || 0;
      P.health = d.health; P.shield = d.shield; P.oxygen = d.oxygen; P.protection = d.protection;
      P.units = d.units || 0; P.nanites = d.nanites || 0; P.sel = d.sel || 0;
      P.slots = new Array(SLOTS);
      for (var i = 0; i < SLOTS; i++) {
        var s = d.slots && d.slots[i];
        P.slots[i] = s ? { k: s[0], n: s[1] } : null;
      }
      P.dead = false;
    }
  };

  P.WIDTH = WIDTH; P.HEIGHT = HEIGHT; P.EYE = EYE; P.SLOTS = SLOTS;
  DSC.Player = P;
})();
