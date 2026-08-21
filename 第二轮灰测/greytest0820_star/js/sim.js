/* ==========================================================================
 * sim.js — vehicle systems, ballistics and effects.
 *
 * TankSim owns everything that can be switched, driven, loaded or broken.
 * Interior hotspots call the methods at the bottom of the class and get a
 * short human readable message back, which the HUD logs.
 * ==========================================================================*/
(function (global) {
  'use strict';
  const M = global.M, C = global.C;
  const L = global.L || { m: (en) => en, s: (s) => s, shell: (s) => s };

  const G = 9.81;

  /* ====================================================== projectiles == */
  class Projectiles {
    constructor() { this.list = []; }
    spawn(o) {
      this.list.push({
        p: M.copy(o.pos), v: M.copy(o.vel), prev: M.copy(o.pos),
        shell: o.shell, type: o.type, life: o.life || 12, owner: o.owner,
        tracer: o.tracer !== false, dist: 0, mg: !!o.mg
      });
    }
    update(dt, world, hitCb) {
      for (let i = this.list.length - 1; i >= 0; i--) {
        const s = this.list[i];
        s.prev = M.copy(s.p);
        // gravity + a crude quadratic drag
        const sp = M.len(s.v);
        const k = s.mg ? 0.00016 : 0.000045;
        s.v[1] -= G * dt;
        const d = k * sp * dt;
        s.v[0] -= s.v[0] * d; s.v[1] -= s.v[1] * d; s.v[2] -= s.v[2] * d;
        s.p = M.addScaled(s.p, s.v, dt);
        s.dist += sp * dt;
        s.life -= dt;
        let hit = null;
        // vehicles / targets first
        for (const tgt of world.targets) {
          if (tgt.dead && tgt.hp <= -999) continue;
          const r = tgt.radius;
          const c = [tgt.pos[0], tgt.pos[1] + 1.2, tgt.pos[2]];
          if (segSphere(s.prev, s.p, c, r)) { hit = { kind: 'target', target: tgt }; break; }
        }
        if (!hit) {
          const gh = world.terrain.height(s.p[0], s.p[2]);
          if (s.p[1] <= gh) hit = { kind: 'ground', y: gh };
        }
        if (hit) {
          hitCb(s, hit);
          this.list.splice(i, 1);
        } else if (s.life <= 0 || Math.abs(s.p[0]) > 1200 || Math.abs(s.p[2]) > 1200) {
          this.list.splice(i, 1);
        }
      }
    }
    draw(r) {
      for (const s of this.list) {
        const back = M.addScaled(s.p, M.norm(s.v), s.mg ? -6 : -14);
        if (s.tracer) {
          r.line(back, s.p, s.mg ? [255, 210, 120] : [255, 190, 110], s.mg ? 1.6 : 2.6, true);
          r.billboard(s.p, s.mg ? 0.12 : 0.22, [255, 220, 150], 0.85, true);
        }
      }
    }
  }

  function segSphere(a, b, c, r) {
    const ab = M.sub(b, a), ac = M.sub(c, a);
    const len2 = M.dot(ab, ab);
    if (len2 < 1e-9) return M.dist2(a, c) < r * r;
    let t = M.dot(ac, ab) / len2;
    t = M.clamp(t, 0, 1);
    const p = M.addScaled(a, ab, t);
    return M.dist2(p, c) < r * r;
  }

  /* ======================================================== particles == */
  class Particles {
    constructor(max) { this.list = []; this.max = max || 900; }
    spawn(o) {
      if (this.list.length > this.max) this.list.shift();
      this.list.push({
        p: M.copy(o.pos), v: o.vel ? M.copy(o.vel) : [0, 0, 0],
        size: o.size || 0.6, grow: o.grow === undefined ? 1.4 : o.grow,
        life: o.life || 1.2, t: 0, col: o.col || [190, 190, 185],
        col2: o.col2 || null, alpha: o.alpha === undefined ? 0.55 : o.alpha,
        glow: !!o.glow, drag: o.drag === undefined ? 1.2 : o.drag,
        gravity: o.gravity === undefined ? -0.6 : o.gravity
      });
    }
    burst(kind, pos, n, opts) {
      opts = opts || {};
      const rnd = Math.random;
      for (let i = 0; i < n; i++) {
        const a = rnd() * M.TAU, e = rnd();
        const spd = (opts.speed || 4) * (0.3 + rnd());
        const v = [Math.cos(a) * spd * (1 - e * 0.6), (opts.up || 1) * spd * e, Math.sin(a) * spd * (1 - e * 0.6)];
        if (opts.dir) {
          v[0] += opts.dir[0] * (opts.dirSpeed || 6) * rnd();
          v[1] += opts.dir[1] * (opts.dirSpeed || 6) * rnd();
          v[2] += opts.dir[2] * (opts.dirSpeed || 6) * rnd();
        }
        this.spawn({
          pos: [pos[0] + (rnd() - 0.5) * 0.4, pos[1] + (rnd() - 0.5) * 0.4, pos[2] + (rnd() - 0.5) * 0.4],
          vel: v, size: (opts.size || 0.5) * (0.6 + rnd()), life: (opts.life || 1.4) * (0.6 + rnd() * 0.8),
          col: opts.col, col2: opts.col2, alpha: opts.alpha, glow: opts.glow,
          grow: opts.grow, gravity: opts.gravity, drag: opts.drag
        });
      }
    }
    update(dt) {
      for (let i = this.list.length - 1; i >= 0; i--) {
        const q = this.list[i];
        q.t += dt;
        if (q.t >= q.life) { this.list.splice(i, 1); continue; }
        q.v[1] += q.gravity * dt;
        const dmp = Math.pow(0.5, dt * q.drag);
        q.v[0] *= dmp; q.v[2] *= dmp;
        q.p = M.addScaled(q.p, q.v, dt);
      }
    }
    draw(r) {
      for (const q of this.list) {
        const u = q.t / q.life;
        const size = q.size * (1 + q.grow * u);
        const a = q.alpha * (1 - u) * (1 - u);
        const col = q.col2 ? C.mixc(q.col, q.col2, u) : q.col;
        r.billboard(q.p, size, col, a, q.glow && u < 0.4);
      }
    }
  }

  /* ========================================================== TankSim == */
  class TankSim {
    constructor(spec, world, opts) {
      opts = opts || {};
      this.spec = spec;
      this.world = world;
      this.model = global.getTankModel(spec);
      this.interior = global.Interiors.get(spec);
      this.pos = opts.pos ? M.copy(opts.pos) : [0, 0, 0];
      this.yaw = opts.yaw || 0;
      this.pitch = 0; this.roll = 0;
      this.speed = 0;
      this.trackDist = 0;
      this.ctrl = { throttle: 0, brake: 0, steer: 0, traverse: 0, elevate: 0 };
      const shells = Object.keys(spec.shells);
      const ammo = {};
      for (const k of shells) ammo[k] = spec.shells[k].n;
      this.sys = {
        master: false, fuelCock: false, starting: 0, engineOn: false, rpm: 0,
        gear: 0, gears: spec.id === 't34' ? 4 : spec.id === 'abrams' ? 4 : spec.id === 't72' ? 7 : 5,
        parkBrake: true, fuel: 1, coolant: 0.12, oil: 0.1,
        turretPower: true, traverseMode: 'power', turretYaw: 0, gunPitch: 0,
        stab: spec.optics.fcs, fcs: spec.optics.fcs, citv: false, apu: false,
        snorkel: false, blastDoor: false,
        breechOpen: false, loaded: null, shell: shells[0], loadT: 0, safety: true,
        fireHold: 0, recoil: 0, cases: 0, ammo: ammo, spentTotal: 0,
        mgAmmo: 1400, mgFlash: 0,
        hatches: { driver: 0, loader: 0, commander: 0, gunner: 0 },
        lights: { interior: false, exterior: false },
        sight: { mode: 'day', zoomIdx: spec.optics.zoom.length > 1 ? 1 : 0, range: 800, lased: false, laseFlash: 0 },
        radio: { on: false, chan: 3, vol: 0.6 },
        intercom: true, fires: 0, extUsed: false, smokeLeft: 4,
        override: false, hp: spec.hp, maxHp: spec.hp,
        damage: { engine: false, gun: false, tracks: false, optics: false },
        carousel: 0, slewTo: null, shots: 0, hits: 0, kills: 0
      };
      this.snapToGround();
    }

    /* ---------------------------------------------------- transforms --- */
    hullMatrix() { return M.body(this.pos, this.yaw, this.pitch, this.roll); }
    turretMatrix() {
      return M.mulAll(this.hullMatrix(), M.translateV(this.model.turretPivot), M.rotY(this.sys.turretYaw));
    }
    gunMatrix() {
      return M.mulAll(this.turretMatrix(), M.translateV(this.model.trunnion),
        M.rotX(-this.sys.gunPitch), M.translate(0, 0, -this.sys.recoil));
    }
    parentMatrix(which) { return which === 'turret' ? this.turretMatrix() : this.hullMatrix(); }
    muzzle() { return M.xformPoint(this.gunMatrix(), [0, 0, this.model.muzzleZ]); }
    gunDir() { return M.norm(M.xformDir(this.gunMatrix(), [0, 0, 1])); }
    stationEye(id) {
      const st = this.interior.stations[id];
      if (!st) return M.add(this.pos, [0, 2, 0]);
      return M.xformPoint(this.parentMatrix(st.parent), st.eye);
    }
    /** world yaw the station faces at rest (turret stations rotate) */
    stationYaw(id) {
      const st = this.interior.stations[id];
      if (!st) return this.yaw;
      return this.yaw + (st.parent === 'turret' ? this.sys.turretYaw : 0) + (st.yaw || 0);
    }

    /* --------------------------------------------------------- physics - */
    snapToGround() {
      this.pos[1] = this.world.terrain.height(this.pos[0], this.pos[2]);
      this.sampleAttitude(1);
    }
    sampleAttitude(k) {
      const t = this.world.terrain;
      const hit = this.model.hit;
      const f = M.dirYawPitch(this.yaw, 0);
      const rgt = [Math.cos(this.yaw), 0, -Math.sin(this.yaw)];
      const L = hit.halfL * 0.8, W = hit.halfW * 0.85;
      const hF = t.height(this.pos[0] + f[0] * L, this.pos[2] + f[2] * L);
      const hB = t.height(this.pos[0] - f[0] * L, this.pos[2] - f[2] * L);
      const hR = t.height(this.pos[0] + rgt[0] * W, this.pos[2] + rgt[2] * W);
      const hL = t.height(this.pos[0] - rgt[0] * W, this.pos[2] - rgt[2] * W);
      const targetPitch = Math.atan2(hF - hB, L * 2);
      const targetRoll = Math.atan2(hR - hL, W * 2);
      const centre = (hF + hB + hR + hL) / 4;
      this.pitch = M.lerp(this.pitch, targetPitch, k);
      this.roll = M.lerp(this.roll, targetRoll, k);
      this.pos[1] = M.lerp(this.pos[1], centre, k);
    }

    update(dt, input) {
      const s = this.sys, spec = this.spec, c = this.ctrl;
      // ---- driver inputs (only if the driver station is manned by the player
      //      or the crew is on autopilot: we always accept them) ----
      c.throttle = M.damp(c.throttle, input.throttle || 0, 0.10, dt);
      c.brake = M.damp(c.brake, input.brakePedal || 0, 0.08, dt);
      c.steer = M.damp(c.steer, input.steer || 0, 0.12, dt);
      c.traverse = input.traverse || 0;
      c.elevate = input.elevate || 0;

      // ---- engine ----
      if (s.starting > 0) {
        s.starting -= dt;
        if (s.master && s.fuelCock && s.fuel > 0.01 && !s.damage.engine) {
          s.rpm = M.damp(s.rpm, 420, 0.25, dt);
          if (s.starting <= 0.05) {
            s.engineOn = true;
            s.rpm = 700;
          }
        }
      }
      if (s.engineOn) {
        if (!s.master || !s.fuelCock || s.fuel <= 0 || s.damage.engine) {
          s.engineOn = false;
        }
      }
      const idle = spec.id === 'abrams' ? 1100 : 650;
      const redline = spec.id === 'abrams' ? 3000 : spec.id === 't72' ? 2300 : 2600;
      if (s.engineOn) {
        const load = Math.abs(this.speed) / Math.max(1, spec.maxSpeed / 3.6);
        const target = idle + (redline - idle) * M.clamp01(c.throttle * 0.75 + load * 0.5);
        s.rpm = M.damp(s.rpm, target, 0.18, dt);
        s.fuel = Math.max(0, s.fuel - dt * (0.00035 + 0.0022 * c.throttle) * (spec.id === 'abrams' ? 2.4 : 1));
        s.coolant = M.clamp01(M.damp(s.coolant, 0.35 + 0.5 * c.throttle, 6, dt));
        s.oil = M.damp(s.oil, 0.55 + 0.35 * (s.rpm / redline), 0.6, dt);
      } else {
        s.rpm = M.damp(s.rpm, 0, 0.35, dt);
        s.coolant = M.damp(s.coolant, 0.1, 20, dt);
        s.oil = M.damp(s.oil, 0.02, 1.2, dt);
      }

      // ---- drivetrain ----
      const gearRatio = s.gear === 0 ? 0 : s.gear < 0 ? -0.7 : (0.35 + 0.65 * (s.gear / s.gears));
      const maxV = s.gear < 0 ? -spec.revSpeed / 3.6 : (spec.maxSpeed / 3.6) * (s.gear === 0 ? 0 : (0.28 + 0.72 * s.gear / s.gears));
      let accel = 0;
      if (s.engineOn && s.gear !== 0 && !s.parkBrake && !s.damage.tracks) {
        const powerFrac = M.clamp01(0.35 + 0.65 * (s.rpm / redline));
        const want = maxV * c.throttle;
        if (Math.abs(want) > Math.abs(this.speed) || M.sign(want) !== M.sign(this.speed)) {
          accel = spec.accel * powerFrac * Math.abs(gearRatio) * M.sign(want - this.speed);
        }
      }
      const rolling = 0.55 + (s.parkBrake ? 6 : 0) + c.brake * 7;
      accel -= M.sign(this.speed) * Math.min(Math.abs(this.speed) * 0.22 + rolling * 0.28, Math.abs(this.speed) * 4 + 0.4);
      accel -= Math.sin(this.pitch) * G * 0.55;
      this.speed += accel * dt;
      if (Math.abs(this.speed) < 0.05 && c.throttle < 0.05) this.speed *= 0.5;
      const vlim = spec.maxSpeed / 3.6 * 1.02;
      this.speed = M.clamp(this.speed, -spec.revSpeed / 3.6 * 1.05, vlim);

      // ---- steering ----
      let yawRate = 0;
      const pivoting = spec.pivot && s.engineOn && Math.abs(this.speed) < 0.6 && Math.abs(c.steer) > 0.1 && s.gear !== 0 && !s.parkBrake;
      if (pivoting) {
        yawRate = M.rad(spec.turnRate * 0.55) * c.steer;
      } else if (Math.abs(this.speed) > 0.15) {
        const vFrac = M.clamp01(Math.abs(this.speed) / (spec.maxSpeed / 3.6));
        yawRate = M.rad(spec.turnRate) * c.steer * (0.35 + 0.65 * (1 - vFrac * 0.55)) * M.sign(this.speed);
        this.speed *= (1 - 0.25 * Math.abs(c.steer) * dt);
      }
      this.yaw = M.wrapPi(this.yaw + yawRate * dt);

      // ---- position / attitude ----
      const f = M.dirYawPitch(this.yaw, 0);
      this.pos[0] += f[0] * this.speed * dt;
      this.pos[2] += f[2] * this.speed * dt;
      const lim = this.world.bound - 12;
      this.pos[0] = M.clamp(this.pos[0], -lim, lim);
      this.pos[2] = M.clamp(this.pos[2], -lim, lim);
      this.trackDist += this.speed * dt;
      this.sampleAttitude(M.clamp01(dt * 6));

      // dust from the tracks
      if (Math.abs(this.speed) > 1.2 && Math.random() < dt * 22) {
        const rgt = [Math.cos(this.yaw), 0, -Math.sin(this.yaw)];
        const side = Math.random() < 0.5 ? -1 : 1;
        const p = [
          this.pos[0] - f[0] * 2.4 + rgt[0] * side * this.model.hit.halfW * 0.8,
          this.pos[1] + 0.25,
          this.pos[2] - f[2] * 2.4 + rgt[2] * side * this.model.hit.halfW * 0.8
        ];
        this.world.fx.spawn({
          pos: p, vel: [(Math.random() - 0.5) * 1.2, 0.5 + Math.random(), (Math.random() - 0.5) * 1.2],
          size: 0.5, life: 1.6, col: this.world.dustColor, alpha: 0.3, grow: 2.2, gravity: -0.2
        });
      }

      // ---- turret & gun ----
      let travRate = 0;
      const powered = s.turretPower && s.master && (s.engineOn || s.apu) && s.traverseMode === 'power' && !s.damage.gun;
      const rate = M.rad(powered ? spec.gun.traverse : spec.gun.manualTraverse);
      if (s.slewTo !== null) {
        const d = M.angleDelta(s.turretYaw, s.slewTo.yaw);
        const step = rate * dt;
        if (Math.abs(d) <= step) { s.turretYaw = s.slewTo.yaw; }
        else s.turretYaw += M.sign(d) * step;
        const dp = s.slewTo.pitch - s.gunPitch;
        s.gunPitch += M.clamp(dp, -M.rad(12) * dt, M.rad(12) * dt);
        if (Math.abs(d) < 0.01) s.slewTo = null;
      } else if (c.traverse) {
        travRate = rate * c.traverse;
        s.turretYaw = M.wrapPi(s.turretYaw + travRate * dt);
      }
      if (c.elevate) {
        s.gunPitch += M.rad(spec.id === 'abrams' || spec.id === 't72' ? 8 : 5.5) * c.elevate * dt;
      }
      s.gunPitch = M.clamp(s.gunPitch, M.rad(spec.gun.elevMin), M.rad(spec.gun.elevMax));
      s.turretYaw = M.wrapPi(s.turretYaw);
      s.recoil = M.damp(s.recoil, 0, 0.09, dt);
      if (s.recoil < 0.004) s.recoil = 0;
      s.carousel = M.damp(s.carousel, s.loadT > 0 ? s.carousel + 3 * dt : s.carousel, 0.4, dt);

      // ---- loading ----
      if (s.loadT > 0) {
        s.loadT -= dt;
        if (s.loadT <= 0) {
          s.loadT = 0;
          const type = s.pendingShell || s.shell;
          if (s.ammo[type] > 0) {
            s.ammo[type]--;
            s.loaded = type;
            s.breechOpen = false;
            if (this.onEvent) this.onEvent('loaded', type);
          }
          s.pendingShell = null;
        }
      }
      // ---- hatches / flashes / fires ----
      for (const k in s.hatches) {
        const tgt = s.hatchTarget && s.hatchTarget[k] !== undefined ? s.hatchTarget[k] : s.hatches[k];
        s.hatches[k] = M.approach(s.hatches[k], tgt, 1.1, dt);
      }
      s.mgFlash = Math.max(0, s.mgFlash - dt);
      s.fireHold = Math.max(0, s.fireHold - dt);
      s.sight.laseFlash = Math.max(0, s.sight.laseFlash - dt);
      if (s.fires > 0) {
        s.fires = Math.max(0, s.fires - dt * 0.02);
        s.hp -= dt * 18;
        const p = M.add(this.pos, [0, 1.6, 0]);
        this.world.fx.spawn({
          pos: p, vel: [0, 2.4, 0], size: 0.7, life: 1.5, col: [70, 66, 62], col2: [30, 30, 30],
          alpha: 0.5, grow: 2.6, gravity: 0.4
        });
        if (Math.random() < dt * 8) {
          this.world.fx.spawn({ pos: p, vel: [0, 3, 0], size: 0.5, life: 0.5, col: [255, 170, 60], alpha: 0.8, glow: true, grow: 1.2 });
        }
      }
    }

    /* --------------------------------------------------- info helpers -- */
    speedKmh() { return this.speed * 3.6; }
    rpmFrac() { return M.clamp01(this.sys.rpm / (this.spec.id === 'abrams' ? 3000 : 2600)); }
    gearName() {
      const g = this.sys.gear;
      if (g === 0) return 'N';
      if (g < 0) return 'R';
      return String(g);
    }
    zoomText() { return String(this.spec.optics.zoom[this.sys.sight.zoomIdx] || 1); }
    zoom() { return this.spec.optics.zoom[this.sys.sight.zoomIdx] || 1; }
    ammoTotal() { let n = 0; for (const k in this.sys.ammo) n += this.sys.ammo[k]; return n; }
    /** super elevation (rad) needed to hit at the sight's set range */
    superElevation(range) {
      const v = this.spec.gun.mv;
      return G * (range || this.sys.sight.range) / (2 * v * v);
    }

    /* ------------------------------------------------------- controls -- */
    toggleMaster() {
      this.sys.master = !this.sys.master;
      if (!this.sys.master) { this.sys.engineOn = false; this.sys.lights.interior = false; }
      return this.sys.master
        ? L.m('Master battery switch ON — buses live.', '主蓄电池开关已合上，全车母线带电。')
        : L.m('Master battery switch OFF — everything dead.', '主蓄电池开关已断开，全车断电。');
    }
    toggleFuel() {
      this.sys.fuelCock = !this.sys.fuelCock;
      return this.sys.fuelCock
        ? L.m('Fuel cock OPEN.', '燃油阀已打开。')
        : L.m('Fuel cock CLOSED — engine will die.', '燃油阀已关闭，发动机即将停车。');
    }
    pressStarter() {
      const s = this.sys;
      if (s.engineOn) return L.m('Engine is already running.', '发动机已经在运转了。');
      if (!s.master) return L.m('Nothing happens: master battery switch is OFF.', '毫无反应：主蓄电池开关还没合上。');
      if (!s.fuelCock) return L.m('It cranks and coughs — the fuel cock is CLOSED.', '只是空转干咳——燃油阀关着。');
      if (s.fuel <= 0.01) return L.m('Dry tanks. No start.', '油箱见底，打不着。');
      if (s.damage.engine) return L.m('The engine is wrecked.', '发动机已经报废。');
      s.starting = 1.6;
      if (this.onEvent) this.onEvent('starter');
      return L.m('Cranking…', '起动机转动中…');
    }
    stopEngine() {
      if (!this.sys.engineOn) return L.m('Engine already stopped.', '发动机已经停了。');
      this.sys.engineOn = false;
      return L.m('Engine shut down.', '发动机已关闭。');
    }
    shiftUp() {
      const s = this.sys;
      if (s.gear < s.gears) { s.gear++; return L.m('Gear: ', '档位：') + this.gearName(); }
      return L.m('Top gear already.', '已经是最高档了。');
    }
    shiftDown() {
      const s = this.sys;
      if (s.gear > -1) { s.gear--; return L.m('Gear: ', '档位：') + this.gearName(); }
      return L.m('Reverse already engaged.', '已经在倒档了。');
    }
    setGear(g) {
      this.sys.gear = M.clamp(g, -1, this.sys.gears);
      return L.m('Gear: ', '档位：') + this.gearName();
    }
    toggleBrake() {
      this.sys.parkBrake = !this.sys.parkBrake;
      return this.sys.parkBrake
        ? L.m('Parking brake SET.', '驻车制动已拉起。')
        : L.m('Parking brake released.', '驻车制动已松开。');
    }
    toggleHatch(id) {
      const s = this.sys;
      if (!s.hatchTarget) s.hatchTarget = {};
      const now = s.hatchTarget[id] === undefined ? s.hatches[id] : s.hatchTarget[id];
      s.hatchTarget[id] = now > 0.5 ? 0 : 1;
      const who = L.s(id[0].toUpperCase() + id.slice(1));
      return s.hatchTarget[id]
        ? L.m(who + ' hatch unbuttoned.', who + '舱盖已打开。')
        : L.m(who + ' hatch buttoned up.', who + '舱盖已关闭。');
    }
    toggleLight(which) {
      if (which === 'interior' && !this.sys.master) {
        return L.m('No power — master switch is off.', '没有电——总电源还没合上。');
      }
      this.sys.lights[which] = !this.sys.lights[which];
      const on = this.sys.lights[which];
      if (which === 'interior') {
        return on ? L.m('Compartment lamp on.', '舱内照明灯已打开。') : L.m('Compartment lamp off.', '舱内照明灯已关闭。');
      }
      return on ? L.m('Driving lamps on.', '行车灯已打开。') : L.m('Driving lamps off.', '行车灯已关闭。');
    }
    toggleIntercom() {
      this.sys.intercom = !this.sys.intercom;
      return this.sys.intercom
        ? L.m('Intercom live.', '车内通话器已接通。')
        : L.m('Intercom off — shout instead.', '车内通话器已关闭——只能靠喊了。');
    }
    pumpBilge() { return L.m('Bilge pump run for a few strokes.', '舱底泵抽了几下。'); }
    toggleTurretPower() {
      this.sys.turretPower = !this.sys.turretPower;
      return this.sys.turretPower
        ? L.m('Turret power ON.', '炮塔电源已接通。')
        : L.m('Turret power OFF — handwheels only.', '炮塔电源已断开——只能摇手轮。');
    }
    toggleTraverseMode() {
      const s = this.sys;
      s.traverseMode = s.traverseMode === 'power' ? 'manual' : 'power';
      return s.traverseMode === 'power'
        ? L.m('Traverse: POWER (' + this.spec.gun.traverse + ' deg/s)',
          '方向机：电动（' + this.spec.gun.traverse + ' 度/秒）')
        : L.m('Traverse: MANUAL handwheel (' + this.spec.gun.manualTraverse + ' deg/s)',
          '方向机：手摇手轮（' + this.spec.gun.manualTraverse + ' 度/秒）');
    }
    toggleSafety() {
      this.sys.safety = !this.sys.safety;
      return this.sys.safety
        ? L.m('Firing circuit SAFE.', '击发电路已置于保险。')
        : L.m('Firing circuit ARMED.', '击发电路已解除保险。');
    }
    toggleStab() {
      if (!this.spec.optics.fcs) return L.m('This tank has no stabiliser.', '这辆坦克没有火炮稳定器。');
      this.sys.stab = !this.sys.stab;
      return this.sys.stab ? L.m('Stabiliser ON.', '稳定器已开启。') : L.m('Stabiliser OFF.', '稳定器已关闭。');
    }
    toggleFcs() {
      if (!this.spec.optics.fcs) {
        return L.m('No fire control computer in this vehicle — use the range drum.',
          '这辆车没有火控计算机——请使用表尺鼓轮。');
      }
      this.sys.fcs = !this.sys.fcs;
      return this.sys.fcs
        ? L.m('Fire control computer ONLINE — ballistic solution live.', '火控计算机已在线——弹道解算生效。')
        : L.m('Fire control computer OFFLINE.', '火控计算机已离线。');
    }
    toggleOverride() {
      this.sys.override = !this.sys.override;
      return this.sys.override
        ? L.m("Commander's override ENGAGED.", '车长超越操纵已接通。')
        : L.m("Commander's override released.", '车长超越操纵已松开。');
    }
    adjustRange(d) {
      const s = this.sys.sight;
      s.range = M.clamp(s.range + d, 200, 4000);
      s.lased = false;
      return L.m('Sight range set to ' + s.range + ' m.', '表尺距离设为 ' + s.range + ' 米。');
    }
    cycleZoom() {
      const z = this.spec.optics.zoom;
      this.sys.sight.zoomIdx = (this.sys.sight.zoomIdx + 1) % z.length;
      return L.m('Magnification x' + this.zoomText(), '倍率 x' + this.zoomText());
    }
    cycleVision() {
      const s = this.sys.sight;
      const modes = ['day'];
      if (this.spec.optics.night) modes.push('night');
      if (this.spec.optics.thermal) modes.push('thermal');
      if (modes.length === 1) return L.m('Only a daylight optic here.', '这里只有白光镜。');
      s.mode = modes[(modes.indexOf(s.mode) + 1) % modes.length];
      return L.m('Sight channel: ' + s.mode.toUpperCase(), '瞄准镜通道：' + L.s(s.mode.toUpperCase()));
    }
    lase() {
      if (!this.spec.optics.lrf) {
        return L.m('No laser rangefinder — estimate the range and set the drum.',
          '没有激光测距仪——请目测距离并转动表尺鼓轮。');
      }
      const hit = this.rayRange();
      const s = this.sys.sight;
      s.laseFlash = 0.4;
      if (hit === null) { s.lased = false; return L.m('Laser return: nothing. Try again.', '激光无回波，再试一次。'); }
      s.range = Math.round(hit / 10) * 10;
      s.lased = true;
      return L.m('LRF: ' + s.range + ' m.', '激光测距：' + s.range + ' 米。');
    }
    /** distance along the gun line to terrain or a target */
    rayRange() {
      const o = this.muzzle(), d = this.gunDir();
      let best = null;
      for (const t of this.world.targets) {
        const c = [t.pos[0], t.pos[1] + 1.2, t.pos[2]];
        const oc = M.sub(c, o);
        const proj = M.dot(oc, d);
        if (proj < 5) continue;
        const perp = Math.sqrt(Math.max(0, M.dot(oc, oc) - proj * proj));
        if (perp < t.radius && (best === null || proj < best)) best = proj;
      }
      let step = 4, dist = 6;
      while (dist < 4000) {
        const p = M.addScaled(o, d, dist);
        if (p[1] < this.world.terrain.height(p[0], p[2])) {
          if (best === null || dist < best) best = dist;
          break;
        }
        dist += step;
        step = Math.min(12, step * 1.04);
      }
      return best;
    }
    selectShell(type) {
      if (!this.sys.ammo[type] && this.sys.ammo[type] !== 0) {
        return L.m('No such round aboard.', '车上没有这种弹。');
      }
      this.sys.shell = type;
      return L.m('Selected ' + type + ' — ' + this.spec.shells[type].name + ' (' + this.sys.ammo[type] + ' left)',
        '已选择' + L.shell(type) + ' — ' + this.spec.shells[type].name + '（剩 ' + this.sys.ammo[type] + ' 发）');
    }
    cycleShell() {
      const keys = Object.keys(this.spec.shells);
      const i = keys.indexOf(this.sys.shell);
      return this.selectShell(keys[(i + 1) % keys.length]);
    }
    toggleBreech() {
      const s = this.sys;
      if (s.loaded) {
        return L.m('Breech is closed on a live round — do not touch it.', '炮闩已闭锁在实弹上——别乱动。');
      }
      s.breechOpen = !s.breechOpen;
      if (this.onEvent) this.onEvent('breech');
      return s.breechOpen ? L.m('Breech OPEN.', '炮闩已打开。') : L.m('Breech closed.', '炮闩已关闭。');
    }
    loadRound() {
      const s = this.sys, spec = this.spec;
      if (s.loaded) return L.m('Gun is already loaded with ' + s.loaded + '.', '炮膛里已经装着' + L.shell(s.loaded) + '了。');
      if (s.loadT > 0) return L.m('Already loading…', '正在装填…');
      if (!s.ammo[s.shell]) {
        return L.m('Out of ' + s.shell + '! Select another round.', L.shell(s.shell) + '打光了！换一种弹。');
      }
      if (spec.autoloader) {
        if (!s.master) return L.m('Autoloader has no power.', '自动装弹机没有电。');
        s.loadT = spec.gun.reload;
        s.pendingShell = s.shell;
        if (this.onEvent) this.onEvent('autoload');
        return L.m('Autoloader cycling a ' + s.shell + ' round…', '自动装弹机正在上一发' + L.shell(s.shell) + '…');
      }
      if (!s.breechOpen) return L.m('Breech is shut — open it first (B).', '炮闩关着——先打开它（B）。');
      s.loadT = spec.gun.reload;
      s.pendingShell = s.shell;
      if (this.onEvent) this.onEvent('ram');
      return L.m('Ramming a ' + s.shell + ' round…', '正在推入一发' + L.shell(s.shell) + '…');
    }
    dumpCases() {
      if (!this.sys.cases) return L.m('No spent cases in the bag.', '收集袋里没有弹壳。');
      const n = this.sys.cases;
      this.sys.cases = 0;
      return L.m(n + ' spent cases dumped out of the hatch.', '把 ' + n + ' 个弹壳从舱口扔了出去。');
    }
    fire() {
      const s = this.sys, spec = this.spec;
      if (!s.loaded) {
        return s.loadT > 0 ? L.m('Still loading!', '还在装填！')
          : L.m('Empty gun — load a round first.', '空膛——先装填一发。');
      }
      if (s.safety) return L.m('Firing circuit is SAFE — arm it first (K).', '击发电路在保险位——先解除保险（K）。');
      if (s.damage.gun) return L.m('The gun is out of action.', '火炮已失去战斗力。');
      const shell = spec.shells[s.loaded];
      const type = s.loaded;
      const mz = this.muzzle();
      let dir = this.gunDir();
      // dispersion + super elevation is the gunner's problem unless the FCS helps
      const disp = M.rad(spec.gun.disp) * (s.stab && Math.abs(this.speed) > 1 ? 1.4 : 1) *
        (Math.abs(this.speed) > 1 && !s.stab ? 3.2 : 1);
      const a = Math.random() * M.TAU, r = Math.random() * disp;
      const rgt = [Math.cos(this.yaw + s.turretYaw), 0, -Math.sin(this.yaw + s.turretYaw)];
      const up = M.norm(M.cross(rgt, dir));
      dir = M.norm(M.add(dir, M.add(M.mulv(rgt, Math.cos(a) * r), M.mulv(up, Math.sin(a) * r))));
      this.world.shells.spawn({
        pos: M.addScaled(mz, dir, 0.4), vel: M.mulv(dir, spec.gun.mv * 0.55),
        shell: shell, type: type, owner: this
      });
      s.loaded = null;
      s.breechOpen = true;
      s.cases++;
      s.spentTotal++;
      s.shots++;
      s.recoil = spec.gun.cal / 380;
      this.speed -= (spec.gun.cal / spec.mass) * 0.012;
      // muzzle blast
      const fx = this.world.fx;
      fx.burst('flash', M.addScaled(mz, dir, 0.8), 10, {
        speed: 9, dir: dir, dirSpeed: 22, col: [255, 214, 120], col2: [120, 110, 100],
        size: 0.9, life: 0.5, alpha: 0.9, glow: true, grow: 2.4, gravity: 0.2
      });
      fx.burst('smoke', M.addScaled(mz, dir, 1.6), 14, {
        speed: 4, dir: dir, dirSpeed: 12, col: [176, 172, 162], col2: [120, 118, 112],
        size: 1.1, life: 2.4, alpha: 0.42, grow: 3, gravity: 0.1
      });
      // dust kicked off the ground by the blast
      const gh = this.world.terrain.height(mz[0], mz[2]);
      if (mz[1] - gh < 3.2) {
        fx.burst('dust', [mz[0] + dir[0] * 2, gh + 0.2, mz[2] + dir[2] * 2], 16, {
          speed: 7, col: this.world.dustColor, size: 1.2, life: 2.6, alpha: 0.4, grow: 3.4, up: 0.6
        });
      }
      if (this.onEvent) this.onEvent('fire', type);
      return L.m('FIRE! ' + shell.name + ' away.', '放！' + shell.name + ' 已出膛。');
    }
    fireCoax() {
      const s = this.sys;
      if (s.mgAmmo <= 0) return L.m('Machine gun belt is empty.', '机枪弹链打空了。');
      if (s.safety) return L.m('Safety is on.', '保险还在。');
      s.mgAmmo -= 8;
      s.mgFlash = 0.12;
      const m = this.gunMatrix();
      const o = M.xformPoint(m, [0.35, 0.05, 1.2]);
      const d = M.norm(M.add(this.gunDir(), [(Math.random() - 0.5) * 0.01, (Math.random() - 0.5) * 0.01, 0]));
      for (let i = 0; i < 3; i++) {
        this.world.shells.spawn({
          pos: o, vel: M.mulv(M.norm(M.add(d, [(Math.random() - 0.5) * 0.012, (Math.random() - 0.5) * 0.012, (Math.random() - 0.5) * 0.012])), 860 * 0.5),
          shell: { pen: 12, dmg: 6, name: 'MG' }, type: 'MG', owner: this, mg: true, life: 4
        });
      }
      this.world.fx.burst('mg', o, 3, { speed: 3, col: [255, 220, 150], size: 0.2, life: 0.2, alpha: 0.8, glow: true });
      if (this.onEvent) this.onEvent('mg');
      return null;
    }
    fireCupolaMG() {
      if (this.sys.hatches.commander < 0.5 && this.sys.hatches.loader < 0.5) {
        return L.m('You have to open a hatch to reach the pintle gun.', '得先打开舱盖才能摸到枪架上的机枪。');
      }
      return this.fireCoax();
    }
    fireSmoke() {
      const s = this.sys;
      if (s.smokeLeft <= 0) return L.m('No smoke salvos left.', '烟幕弹已用完。');
      s.smokeLeft--;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8 - 0.5) * 1.5;
        const d = M.dirYawPitch(this.yaw + s.turretYaw + a, 0.25);
        const p = M.addScaled(M.add(this.pos, [0, 2, 0]), d, 12 + Math.random() * 8);
        p[1] = this.world.terrain.height(p[0], p[2]) + 0.4;
        this.world.fx.burst('smoke', p, 16, {
          speed: 2.4, col: [206, 206, 200], col2: [170, 170, 168], size: 1.6, life: 9,
          alpha: 0.55, grow: 4, gravity: 0.05, up: 0.8
        });
      }
      if (this.onEvent) this.onEvent('smoke');
      return L.m('Smoke away — screen building to the front.', '烟幕已发射——前方正在形成烟障。');
    }
    useExtinguisher() {
      const s = this.sys;
      if (s.fires <= 0) {
        s.extUsed = true;
        return L.m('You dump the bottle into the compartment. No fire, but plenty of dust.',
          '你把整瓶灭火剂喷进了舱里。没有火，只有满舱粉尘。');
      }
      s.fires = 0; s.extUsed = true;
      return L.m('Fire out. Ventilate and check the crew.', '火已扑灭。通风换气，清点乘员。');
    }
    toggleRadio() {
      const s = this.sys;
      if (!s.master) return L.m('The set is dead — master switch is off.', '电台没反应——总电源没合上。');
      s.radio.on = !s.radio.on;
      return s.radio.on
        ? L.m('Radio on, net alive on channel ' + s.radio.chan + '.', '电台已开机，' + s.radio.chan + ' 频道通信正常。')
        : L.m('Radio off.', '电台已关机。');
    }
    radioChannel(d) {
      const s = this.sys;
      s.radio.chan = ((s.radio.chan - 1 + d + 12) % 12) + 1;
      return L.m('Radio channel ' + s.radio.chan + '.', '电台频道 ' + s.radio.chan + '。');
    }
    designate(g) {
      const yaw = (g && g.viewYaw !== undefined ? g.viewYaw : this.yaw + this.sys.turretYaw);
      const pitch = (g && g.viewPitch !== undefined ? g.viewPitch : 0);
      this.sys.slewTo = {
        yaw: M.wrapPi(yaw - this.yaw),
        pitch: M.clamp(pitch, M.rad(this.spec.gun.elevMin), M.rad(this.spec.gun.elevMax))
      };
      if (this.onEvent) this.onEvent('slew');
      return L.m('Gunner — target! Slewing the turret onto my line of sight.',
        '炮长——目标！炮塔正转向我的视线方向。');
    }
    takeHit(dmg, from) {
      const s = this.sys;
      s.hp -= dmg;
      if (Math.random() < 0.25) s.fires = 1;
      if (Math.random() < 0.2) s.damage.tracks = true;
      return s.hp <= 0;
    }
  }

  global.Sim = { TankSim, Projectiles, Particles, segSphere };
  if (typeof module !== 'undefined' && module.exports) module.exports = { TankSim, Projectiles, Particles };
})(typeof window !== 'undefined' ? window : globalThis);
