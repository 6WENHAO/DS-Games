/* =============================================================================
   sim.js - the actual simulation: electrical system, engine start sequence,
   transmission and differential steering over terrain, turret and gun laying,
   loading cycle, ballistics, machine guns, damage/fire, fumes, scoring and
   the training checklist. All state lives in sim.state (S).
   ========================================================================== */
(function (global) {
  'use strict';
  var TS = global.TS = global.TS || {};
  var M4 = TS.M4, V3 = TS.V3, MU = TS.MU;
  var D = TS.TankDef;

  var GEAR_MAX = { '-1': -3.2, '0': 0, '1': 3.4, '2': 6.2, '3': 9.0, '4': 12.2 };
  var GEAR_PULL = { '-1': 2.4, '0': 0, '1': 3.0, '2': 2.0, '3': 1.35, '4': 0.85 };
  var TRACK_SEP = D.track.x * 2;
  var IDLE = 620, MAXRPM = 2600;

  function Sim(world, tank, fx, audio) {
    this.world = world; this.tank = tank; this.fx = fx; this.audio = audio;
    this.rng = MU.rng(31337);
    var S = this.state = {
      /* electrics & systems */
      master: false, fuelPump: false, magneto: false, lights: false,
      domeLight: true, ventilator: false, parkBrake: true, turretPower: false,
      radio: false, intercom: true, radioVol: 0.55, radioFreq: 0.42, sightLamp: 0.4,
      /* engine */
      engine: { running: false, starting: false, rpm: 0, temp: 22, oil: 0, damaged: false, crank: 0 },
      fuel: 0.92, fire: 0, extinguisherUsed: false,
      /* driving */
      throttle: 0, footBrake: 0, brakeL: 0, brakeR: 0, gear: 0,
      speed: 0, trackL: 0, trackR: 0, trackVL: 0, trackVR: 0,
      pos: [0, 0, -8], hullYaw: 0, pitch: 0, roll: 0, bounce: 0, vBounce: 0,
      /* turret & gun */
      turret: { yaw: 0, crankAngle: 0, rate: 0 },
      gun: { pitch: 0, wheelAngle: 0, breech: 0, breechTarget: 0, loaded: null, spent: false, recoil: 0, cool: 0 },
      rack: ['AP', 'AP', 'AP', 'HE', 'HE', 'AP', 'HE', 'AP'],
      rackLift: [0, 0, 0, 0, 0, 0, 0, 0],
      rackReload: 0,
      spentCases: 0, mgAmmo: 1800, smoke: 4, fumes: 0,
      /* crew / camera */
      station: 'driver', view: 'interior',
      /* bookkeeping */
      fanAngle: 0, time: 0, score: 0, hits: 0, shots: 0, mgShots: 0, kills: 0,
      shake: 0, messages: [], flags: {}, hatchDrv: 0, hatchCmd: 0,
      hatchDrvT: 0, hatchCmdT: 0
    };
    this.projectiles = [];
    this.mgTimer = 0;
    this.mgFiring = null;
    this.starterHeld = false;
    this.pendingLoad = -1;
    this.tasks = [
      { id: 'master', text: 'Switch the MASTER BATTERY on', done: false },
      { id: 'pump', text: 'Switch the FUEL PUMP on', done: false },
      { id: 'ign', text: 'Switch the IGNITION on', done: false },
      { id: 'start', text: 'Hold the STARTER until the engine catches', done: false },
      { id: 'brake', text: 'Release the PARKING BRAKE', done: false },
      { id: 'gear', text: 'Select 1st gear and drive 15 m', done: false },
      { id: 'station', text: 'Move to the GUNNER station (key 3 or click the sight)', done: false },
      { id: 'breech', text: 'Open the BREECH', done: false },
      { id: 'load', text: 'Load a round from the READY RACK', done: false },
      { id: 'close', text: 'Close the BREECH', done: false },
      { id: 'lay', text: 'Lay the gun on a target', done: false },
      { id: 'fire', text: 'FIRE the main gun', done: false },
      { id: 'kill', text: 'Destroy a target', done: false }
    ];
    this.log('Crew aboard. Follow the checklist on the left to start up.');
  }

  Sim.prototype.log = function (text, kind) {
    var S = this.state;
    S.messages.push({ t: S.time, text: text, kind: kind || 'info' });
    if (S.messages.length > 40) S.messages.shift();
  };

  Sim.prototype.task = function (id) {
    for (var i = 0; i < this.tasks.length; i++) {
      if (this.tasks[i].id === id && !this.tasks[i].done) {
        this.tasks[i].done = true;
        this.log('Checklist: ' + this.tasks[i].text, 'ok');
        return;
      }
    }
  };

  Sim.prototype.snd = function (name, opt) {
    if (this.audio && this.audio.play) this.audio.play(name, opt);
  };

  /* =========================================================== controls === */
  Sim.prototype.toggle = function (key) {
    var S = this.state;
    switch (key) {
      case 'master':
        S.master = !S.master;
        this.snd('switch');
        this.log('Master battery ' + (S.master ? 'ON' : 'OFF'));
        if (S.master) this.task('master');
        if (!S.master && S.engine.running) { this.stallEngine('electrical power lost'); }
        break;
      case 'fuelPump':
        S.fuelPump = !S.fuelPump; this.snd('switch');
        this.log('Fuel pump ' + (S.fuelPump ? 'ON' : 'OFF'));
        if (S.fuelPump && S.master) this.task('pump');
        break;
      case 'magneto':
        S.magneto = !S.magneto; this.snd('switch');
        this.log('Ignition ' + (S.magneto ? 'ON' : 'OFF'));
        if (S.magneto && S.master) this.task('ign');
        if (!S.magneto && S.engine.running) this.stallEngine('ignition switched off');
        break;
      case 'lights': S.lights = !S.lights; this.snd('switch'); break;
      case 'domeLight': S.domeLight = !S.domeLight; this.snd('switch'); break;
      case 'ventilator':
        S.ventilator = !S.ventilator; this.snd('switch');
        this.log('Ventilator ' + (S.ventilator ? 'ON' : 'OFF'));
        break;
      case 'parkBrake':
        S.parkBrake = !S.parkBrake; this.snd('lever');
        this.log('Parking brake ' + (S.parkBrake ? 'SET' : 'RELEASED'));
        if (!S.parkBrake) this.task('brake');
        break;
      case 'turretPower':
        S.turretPower = !S.turretPower; this.snd('switch');
        this.log('Power traverse ' + (S.turretPower ? 'ON' : 'OFF'));
        break;
      case 'radio':
        S.radio = !S.radio; this.snd('switch');
        if (this.audio && this.audio.setRadio) this.audio.setRadio(S.radio && S.master);
        if (S.radio && S.master) { this.snd('radioBeep'); this.log('Wireless set on net.', 'radio'); }
        break;
      case 'intercom': S.intercom = !S.intercom; this.snd('switch'); break;
      case 'hatchDrv':
        S.hatchDrvT = S.hatchDrvT > 0.5 ? 0 : 1; this.snd('hatch');
        this.log("Driver's hatch " + (S.hatchDrvT ? 'open' : 'closed'));
        break;
      case 'hatchCmd':
        S.hatchCmdT = S.hatchCmdT > 0.5 ? 0 : 1; this.snd('hatch');
        this.log("Commander's hatch " + (S.hatchCmdT ? 'open' : 'closed'));
        if (!S.hatchCmdT && S.view === 'unbuttoned') this.useView('interior', 'commander');
        break;
    }
  };

  Sim.prototype.starterDown = function () {
    var S = this.state;
    this.starterHeld = true;
    if (!S.master) { this.log('No power: master battery is off.', 'warn'); this.snd('button'); return; }
    if (S.engine.running) { this.log('Engine is already running.', 'warn'); return; }
    S.engine.starting = true;
    S.engine.crank = 0;
    this.snd('button');
  };
  Sim.prototype.starterUp = function () {
    var S = this.state;
    this.starterHeld = false;
    if (S.engine.starting) {
      S.engine.starting = false;
      if (!S.engine.running) this.snd('starterFail');
    }
  };

  Sim.prototype.stallEngine = function (why) {
    var S = this.state;
    if (!S.engine.running) return;
    S.engine.running = false;
    S.engine.starting = false;
    this.snd('stall');
    this.log('Engine stopped: ' + why + '.', 'warn');
  };

  Sim.prototype.leverDown = function (side) {
    if (side === 'L') this.brakeLHeld = true; else this.brakeRHeld = true;
    this.snd('lever', { gain: 0.5 });
  };
  Sim.prototype.leverUp = function (side) {
    if (side === 'L') this.brakeLHeld = false; else this.brakeRHeld = false;
  };
  Sim.prototype.pedalDown = function (id) {
    if (id === 'pedalThrottle') this.throttleHeld = true; else this.brakeHeld = true;
  };
  Sim.prototype.pedalUp = function (id) {
    if (id === 'pedalThrottle') this.throttleHeld = false; else this.brakeHeld = false;
  };

  Sim.prototype.gearName = function () {
    var g = this.state.gear;
    return g === 0 ? 'NEUTRAL' : (g === -1 ? 'REVERSE' : g + ((g === 1) ? 'st' : (g === 2 ? 'nd' : (g === 3 ? 'rd' : 'th'))));
  };
  Sim.prototype.setGear = function (g) {
    var S = this.state;
    g = Math.round(MU.clamp(g, -1, 4));
    if (g === S.gear) return;
    if (Math.abs(S.speed) > 2.5 && g !== 0 && (g === -1 || S.gear === -1)) {
      this.log('Too fast to select that gear.', 'warn');
      return;
    }
    S.gear = g;
    this.snd('gear');
    this.log('Gear: ' + this.gearName());
    if (g === 1) this.gearTaskArmed = true;
  };
  Sim.prototype.shift = function (dir) { this.setGear(this.state.gear + dir); };
  Sim.prototype.dragGear = function (dy) {
    this.gearDrag = (this.gearDrag || 0) - dy;
    if (Math.abs(this.gearDrag) > 26) {
      this.shift(this.gearDrag > 0 ? 1 : -1);
      this.gearDrag = 0;
    }
  };

  Sim.prototype.dragTraverse = function (dx) {
    var S = this.state;
    S.turret.yaw += dx * 0.0042;
    S.turret.crankAngle += dx * 0.05;
    this.turretMoved = true;
  };
  Sim.prototype.dragElevation = function (dy) {
    var S = this.state;
    this.setElevation(S.gun.pitch - dy * 0.0022);
    S.gun.wheelAngle -= dy * 0.06;
  };
  Sim.prototype.setElevation = function (p) {
    var S = this.state;
    S.gun.pitch = MU.clamp(p, MU.rad(-9), MU.rad(19));
  };
  Sim.prototype.dragValue = function (key, delta) {
    var S = this.state;
    S[key] = MU.clamp(S[key] + delta, 0, 1);
    if (!this._knobT || this.state.time - this._knobT > 0.08) {
      this._knobT = this.state.time;
      this.snd('knob', { gain: 0.5 });
    }
    if (key === 'radioVol' && this.audio && this.audio.setMaster) { /* radio volume is cosmetic */ }
  };

  /* traverse / elevate at a rate (keyboard and sight-view mouse) */
  Sim.prototype.traverseRate = function (r) { this.travCmd = r; };
  Sim.prototype.elevateRate = function (r) { this.elevCmd = r; };

  /* =========================================================== gunnery === */
  Sim.prototype.toggleBreech = function () {
    var S = this.state;
    if (S.gun.recoil > 0.02) { this.log('Wait for the gun to run out.', 'warn'); return; }
    var opening = S.gun.breechTarget < 0.5;
    S.gun.breechTarget = opening ? 1 : 0;
    if (opening) {
      this.snd('breechOpen');
      this.task('breech');
      if (S.gun.spent) {
        S.gun.spent = false;
        S.spentCases++;
        this.snd('shellDrop', { delay: 0.25 });
        this.log('Spent case ejected.');
      }
    } else {
      this.snd('breechClose');
      if (S.gun.loaded) this.task('close');
    }
  };

  Sim.prototype.loadFromRack = function (idx) {
    var S = this.state;
    if (!S.rack[idx]) { this.log('That tube is empty.', 'warn'); return; }
    if (S.gun.breechTarget < 0.5 || S.gun.breech < 0.5) { this.log('Open the breech before loading.', 'warn'); return; }
    if (S.gun.loaded) { this.log('A round is already in the chamber.', 'warn'); return; }
    if (S.rackReload > 0) return;
    this.pendingLoad = idx;
    S.rackReload = 0.85;
    this.snd('load');
  };

  Sim.prototype.fireMain = function () {
    var S = this.state;
    if (!S.gun.loaded) { this.log('Nothing in the chamber.', 'warn'); this.snd('button'); return; }
    if (S.gun.breech > 0.4) { this.log('Close the breech before firing!', 'warn'); this.snd('button'); return; }
    if (S.gun.cool > 0) return;
    var type = S.gun.loaded;
    S.gun.loaded = null;
    S.gun.spent = true;
    S.gun.recoil = D.gun.recoilMax;
    S.gun.cool = 0.35;
    S.shots++;
    S.shake = 1.0;
    S.fumes = Math.min(1.4, S.fumes + 0.55);
    /* the hull rocks back on its suspension */
    S.vBounce += 1.6;
    S.speed -= 0.35;
    this.snd('fire');
    var mz = this.tank.muzzle(this.hullMatrix(), S.turret.yaw, S.gun.pitch, S.gun.recoil);
    this.fx.muzzle(mz.pos, mz.dir, 1.0);
    var v0 = type === 'AP' ? 790 : 640;
    this.projectiles.push({
      p: [mz.pos[0], mz.pos[1], mz.pos[2]],
      v: V3.scale(mz.dir, v0),
      type: type, life: 0, trail: 0, alive: true
    });
    this.task('fire');
    this.log('Main gun fired: ' + type + '.');
  };

  Sim.prototype.mgDown = function (which) { this.mgFiring = which; };
  Sim.prototype.mgUp = function () { this.mgFiring = null; };

  Sim.prototype.fireSmoke = function () {
    var S = this.state;
    if (S.smoke <= 0) { this.log('No smoke grenades left.', 'warn'); return; }
    S.smoke--;
    this.snd('clunk');
    var hm = this.hullMatrix();
    var p = M4.transformPoint(hm, [0, 2.4, 6]);
    var self = this;
    this.smokeClouds = this.smokeClouds || [];
    this.smokeClouds.push({ p: [p[0], this.world.heightAt(p[0], p[2]) + 0.4, p[2]], t: 0, life: 26 });
    this.log('Smoke away.');
  };

  Sim.prototype.emptyBag = function () {
    var S = this.state;
    if (S.spentCases === 0) { this.log('The bag is already empty.'); return; }
    this.log(S.spentCases + ' cases dumped overboard.');
    S.spentCases = 0;
    this.snd('shellDrop');
  };

  Sim.prototype.useExtinguisher = function () {
    var S = this.state;
    if (S.extinguisherUsed) { this.log('Extinguisher is spent.', 'warn'); return; }
    S.extinguisherUsed = true;
    S.fire = 0;
    S.engine.temp = Math.min(S.engine.temp, 78);
    this.snd('dust');
    this.log('Extinguisher discharged into the engine bay.', 'ok');
  };

  Sim.prototype.useView = function (view, station) {
    var S = this.state;
    if (station) S.station = station;
    S.view = view;
    this.snd('reticleClick', { gain: 0.5 });
    if (view === 'sight') this.task('station');
    if (station === 'gunner') this.task('station');
  };
  Sim.prototype.setStation = function (name) {
    var S = this.state;
    if (!D.stations[name]) return;
    S.station = name;
    S.view = 'interior';
    if (name === 'gunner') this.task('station');
    this.log('Moved to the ' + D.stations[name].name.toLowerCase() + "'s station.");
  };

  /* ======================================================== transforms === */
  Sim.prototype.hullMatrix = function () {
    var S = this.state;
    var m = M4.mulAll(
      M4.translation(S.pos[0], S.pos[1] + S.bounce, S.pos[2]),
      M4.rotationY(S.hullYaw),
      M4.rotationX(S.pitch),
      M4.rotationZ(S.roll));
    return m;
  };
  Sim.prototype.turretMatrix = function () {
    return this.tank.turretMatrix(this.hullMatrix(), this.state.turret.yaw);
  };

  /* ============================================================ update === */
  Sim.prototype.update = function (dt, input) {
    var S = this.state, E = S.engine, W = this.world;
    S.time += dt;

    /* ---- inputs ---------------------------------------------------- */
    var thr = (this.throttleHeld || (input && input.throttle) ? 1 : 0);
    S.throttle = MU.damp(S.throttle, thr, 6, dt);
    var fb = (this.brakeHeld || (input && input.brake) ? 1 : 0);
    S.footBrake = MU.damp(S.footBrake, fb, 8, dt);
    var bl = (this.brakeLHeld || (input && input.steerL) ? 1 : 0);
    var br = (this.brakeRHeld || (input && input.steerR) ? 1 : 0);
    S.brakeL = MU.damp(S.brakeL, bl, 9, dt);
    S.brakeR = MU.damp(S.brakeR, br, 9, dt);

    /* ---- engine ---------------------------------------------------- */
    if (E.starting) {
      if (!S.master || S.fuel <= 0.001) {
        E.starting = false;
      } else {
        E.crank += dt;
        E.rpm = MU.damp(E.rpm, 240 + Math.sin(S.time * 22) * 30, 5, dt);
        var ready = S.fuelPump && S.magneto && S.fuel > 0.001;
        if (ready && E.crank > 0.9 + this.rng() * 0.5) {
          E.running = true; E.starting = false;
          E.rpm = 900;
          this.snd('ignite');
          this.log('Engine running.', 'ok');
          this.task('start');
          this.starterHeld = false;
        } else if (E.crank > 3.2) {
          E.starting = false;
          this.snd('starterFail');
          if (!S.fuelPump) this.log('It will not catch: the fuel pump is off.', 'warn');
          else if (!S.magneto) this.log('It will not catch: the ignition is off.', 'warn');
          else this.log('Failed to catch. Try again.', 'warn');
        }
      }
    }

    var drive = 0;
    if (E.running) {
      if (S.fuel <= 0.0005) this.stallEngine('out of fuel');
      var gmax = GEAR_MAX[String(S.gear)] || 0;
      var loadFactor = 0;
      if (S.gear !== 0) {
        /* rpm follows road speed in gear, with a torque-converter-ish slip */
        var ratio = Math.abs(gmax) > 0.01 ? Math.abs(S.speed / gmax) : 0;
        var rpmFromRoad = IDLE + ratio * (MAXRPM - IDLE);
        var rpmFromThrottle = IDLE + S.throttle * (MAXRPM - IDLE);
        var target = Math.max(rpmFromRoad * 0.75, rpmFromThrottle * (0.45 + 0.55 * ratio));
        E.rpm = MU.damp(E.rpm, MU.clamp(target, IDLE, MAXRPM), 2.6, dt);
        loadFactor = S.throttle * (1 - MU.clamp(ratio, 0, 1) * 0.55);
        /* tractive effort */
        var pull = GEAR_PULL[String(S.gear)] * (E.damaged ? 0.55 : 1);
        var want = gmax * S.throttle;
        drive = (want - S.speed) * pull * 0.55;
        if (S.parkBrake) drive = 0;
      } else {
        E.rpm = MU.damp(E.rpm, IDLE + S.throttle * 900, 3.2, dt);
        loadFactor = S.throttle * 0.4;
      }
      E.oil = MU.damp(E.oil, MU.clamp(18 + (E.rpm - IDLE) / (MAXRPM - IDLE) * 62, 0, 100) * (E.damaged ? 0.45 : 1), 1.5, dt);
      S.fuel = Math.max(0, S.fuel - dt * (0.00028 + (E.rpm / MAXRPM) * 0.0016 + loadFactor * 0.0011));
      var heat = 0.55 + (E.rpm / MAXRPM) * 5.2 + loadFactor * 4.0 + (S.parkBrake && S.gear !== 0 ? 3 : 0);
      var cool = (S.engine.temp - 22) * 0.055 + (Math.abs(S.speed) * 0.09);
      E.temp += (heat - cool) * dt;
    } else {
      E.rpm = MU.damp(E.rpm, E.starting ? E.rpm : 0, 3, dt);
      E.oil = MU.damp(E.oil, 0, 2.5, dt);
      E.temp += (-(E.temp - 22) * 0.05) * dt;
    }
    E.temp = MU.clamp(E.temp, 18, 190);
    /* overheating leads to damage and then to a fire */
    if (E.temp > 128) {
      if (!E.damaged) { E.damaged = true; this.log('Engine overheating - power reduced!', 'warn'); this.snd('buzzer', { duration: 1.2 }); }
      if (E.temp > 145 && S.fire <= 0 && this.rng() < dt * 0.25) {
        S.fire = 0.4;
        this.log('FIRE in the engine compartment! Use the extinguisher (F9).', 'warn');
        this.snd('buzzer', { duration: 2.5 });
      }
    }
    if (S.fire > 0) {
      S.fire = Math.min(1, S.fire + dt * 0.06);
      E.temp = Math.min(190, E.temp + dt * 9);
      if (S.fire > 0.9 && E.running) this.stallEngine('fire damage');
      var hm0 = this.hullMatrix();
      var ep = M4.transformPoint(hm0, [0, 1.9, -2.2]);
      this.fx.fire(ep, 2, 0.7);
      this.fx.smoke(ep, 1, { s0: 0.6, s1: 4, rise: 3, max: 3.4, a0: 0.5 });
    }

    /* ---- driving --------------------------------------------------- */
    /* slope resistance */
    var slopeAccel = -Math.sin(S.pitch) * 9.81 * 0.55;
    var rolling = -S.speed * (0.55 + (S.parkBrake ? 6 : 0) + S.footBrake * 4.5);
    var brakeBoth = Math.min(S.brakeL, S.brakeR);
    rolling -= S.speed * brakeBoth * 5.0;
    S.speed += (drive + slopeAccel + rolling) * dt;
    if (Math.abs(S.speed) < 0.02 && Math.abs(drive) < 0.05) S.speed = 0;
    S.speed = MU.clamp(S.speed, -5, 14);

    /* differential steering: pulling a lever slows that track */
    var vL = S.speed * (1 - S.brakeL * 0.98);
    var vR = S.speed * (1 - S.brakeR * 0.98);
    S.trackVL = vL; S.trackVR = vR;
    S.trackL += vL * dt; S.trackR += vR * dt;
    var yawRate = (vR - vL) / TRACK_SEP * 1.35;
    /* neutral-steer trickle when standing still with one lever pulled */
    if (Math.abs(S.speed) < 0.15 && E.running && S.gear !== 0 && S.throttle > 0.2) {
      if (S.brakeL > 0.6 && S.brakeR < 0.3) yawRate += 0.30 * S.throttle;
      if (S.brakeR > 0.6 && S.brakeL < 0.3) yawRate -= 0.30 * S.throttle;
    }
    S.hullYaw += yawRate * dt;
    var speedAvg = (vL + vR) / 2;

    var fwd = [Math.sin(S.hullYaw), 0, Math.cos(S.hullYaw)];
    S.pos[0] += fwd[0] * speedAvg * dt;
    S.pos[2] += fwd[2] * speedAvg * dt;
    /* keep the tank on the map */
    var lim = 505;
    S.pos[0] = MU.clamp(S.pos[0], -lim, lim);
    S.pos[2] = MU.clamp(S.pos[2], -lim, lim);

    /* terrain following: sample under the four corners of the track base */
    var hl = D.hull, tq = D.track;
    var pts = [[tq.x, tq.frontZ], [-tq.x, tq.frontZ], [tq.x, tq.rearZ], [-tq.x, tq.rearZ]];
    var sum = 0, hs = [];
    for (var i = 0; i < 4; i++) {
      var wx = S.pos[0] + fwd[0] * pts[i][1] + fwd[2] * pts[i][0];
      var wz = S.pos[2] + fwd[2] * pts[i][1] - fwd[0] * pts[i][0];
      var hh = W.heightAt(wx, wz);
      hs.push(hh); sum += hh;
    }
    var groundY = sum / 4;
    S.pos[1] = MU.damp(S.pos[1], groundY, 12, dt);
    var pitchTarget = Math.atan2(((hs[0] + hs[1]) / 2 - (hs[2] + hs[3]) / 2), tq.frontZ - tq.rearZ);
    var rollTarget = Math.atan2(((hs[1] + hs[3]) / 2 - (hs[0] + hs[2]) / 2), tq.x * 2);
    S.pitch = MU.damp(S.pitch, pitchTarget, 7, dt);
    S.roll = MU.damp(S.roll, rollTarget, 7, dt);
    /* suspension bounce */
    var rough = Math.abs(speedAvg) * 0.5;
    S.vBounce += (-S.bounce * 62 - S.vBounce * 7.5) * dt;
    if (rough > 0.2 && this.rng() < dt * rough * 6) S.vBounce += (this.rng() - 0.5) * rough * 0.5;
    S.bounce += S.vBounce * dt;
    S.bounce = MU.clamp(S.bounce, -0.09, 0.09);

    /* dust and track squeal */
    if (Math.abs(speedAvg) > 0.6 && this.rng() < dt * Math.abs(speedAvg) * 2.2) {
      var back = [S.pos[0] - fwd[0] * 2.6, S.pos[1] + 0.15, S.pos[2] - fwd[2] * 2.6];
      this.fx.dust(back, 1, [-fwd[0] * speedAvg * 0.3, 0, -fwd[2] * speedAvg * 0.3]);
    }
    /* flatten anything we drive over */
    if (Math.abs(speedAvg) > 0.5) {
      var hitTree = W.knockTrees(S.pos, 2.6);
      if (hitTree) { this.snd('clunk', { gain: 0.8 }); S.shake = Math.max(S.shake, 0.5); }
    }

    /* ---- turret and gun ------------------------------------------- */
    var T = S.turret, GU = S.gun;
    var powered = S.turretPower && E.running && S.master;
    var travSpeed = powered ? 0.85 : 0.30;
    if (this.travCmd) {
      T.yaw += this.travCmd * travSpeed * dt;
      T.crankAngle += this.travCmd * travSpeed * dt * 12;
      this.turretMoved = true;
      if (powered) this.snd('hydraulic', { duration: 0.12, gain: 0.35 });
    }
    if (this.elevCmd) {
      this.setElevation(GU.pitch + this.elevCmd * 0.18 * dt);
      GU.wheelAngle += this.elevCmd * 2.2 * dt;
    }
    this.travCmd = 0; this.elevCmd = 0;
    T.yaw = MU.wrapAngle(T.yaw);

    /* breech animation */
    GU.breech = MU.damp(GU.breech, GU.breechTarget, 9, dt);
    /* recoil recovery */
    if (GU.recoil > 0) GU.recoil = Math.max(0, GU.recoil - dt * 0.75);
    if (GU.cool > 0) GU.cool = Math.max(0, GU.cool - dt);

    /* loading animation */
    if (S.rackReload > 0) {
      S.rackReload = Math.max(0, S.rackReload - dt);
      var idx = this.pendingLoad;
      if (idx >= 0) {
        S.rackLift[idx] = MU.clamp(1 - S.rackReload / 0.85, 0, 1);
        if (S.rackReload === 0) {
          GU.loaded = S.rack[idx];
          S.rack[idx] = null;
          S.rackLift[idx] = 0;
          this.pendingLoad = -1;
          this.snd('clunk');
          this.log(GU.loaded + ' round loaded. Close the breech.');
          this.task('load');
        }
      }
    }

    /* ---- machine guns --------------------------------------------- */
    this.mgTimer -= dt;
    if (this.mgFiring && this.mgTimer <= 0 && S.mgAmmo > 0) {
      this.mgTimer = 0.085;
      S.mgAmmo--;
      S.mgShots++;
      this.snd('clunk', { gain: 0.35, rate: 2.4 });
      this.fireMG(this.mgFiring);
    }

    /* ---- projectiles ---------------------------------------------- */
    this.updateProjectiles(dt);

    /* ---- smoke clouds --------------------------------------------- */
    if (this.smokeClouds) {
      for (var sc = this.smokeClouds.length - 1; sc >= 0; sc--) {
        var c = this.smokeClouds[sc];
        c.t += dt;
        if (c.t > c.life) { this.smokeClouds.splice(sc, 1); continue; }
        if (this.rng() < dt * 12) this.fx.smoke(c.p, 1, { s0: 1.4, s1: 9, rise: 1.1, max: 7, a0: 0.42, spread: 2.2, c0: [0.55, 0.55, 0.54], c1: [0.65, 0.65, 0.64] });
      }
    }

    /* ---- burning wrecks ------------------------------------------- */
    for (var t2 = 0; t2 < W.targets.length; t2++) {
      var tg = W.targets[t2];
      if (!tg.alive && tg.burn > 0 && this.rng() < dt * 9) {
        var bp = [tg.p[0], tg.p[1] + 1.0, tg.p[2]];
        this.fx.fire(bp, 1, 1.4);
        this.fx.smoke(bp, 1, { s0: 1.6, s1: 10, rise: 4.2, max: 6.5, a0: 0.4 });
      }
    }

    /* ---- fumes, hatches, misc ------------------------------------- */
    S.fumes = Math.max(0, S.fumes - dt * (S.ventilator && S.master ? 0.42 : 0.09));
    S.hatchDrv = MU.damp(S.hatchDrv, S.hatchDrvT, 5, dt);
    S.hatchCmd = MU.damp(S.hatchCmd, S.hatchCmdT, 5, dt);
    if (S.ventilator && S.master) S.fanAngle += dt * 26;
    S.shake = Math.max(0, S.shake - dt * 2.6);

    /* ---- checklist evaluation ------------------------------------- */
    if (this.gearTaskArmed && !this.driveStart) this.driveStart = [S.pos[0], S.pos[2]];
    if (this.driveStart) {
      var dd = Math.sqrt(Math.pow(S.pos[0] - this.driveStart[0], 2) + Math.pow(S.pos[2] - this.driveStart[2], 2));
      if (dd > 15) this.task('gear');
    }
    if (this.turretMoved) {
      /* is any live target within a degree or two of the bore? */
      var mz2 = this.tank.muzzle(this.hullMatrix(), T.yaw, GU.pitch, GU.recoil);
      var hit = W.rayTargets(mz2.pos, mz2.dir, 1200);
      if (hit) this.task('lay');
    }

    /* ---- audio ---------------------------------------------------- */
    if (this.audio && this.audio.setEngine) {
      this.audio.setEngine({
        running: E.running, starting: E.starting, rpm: E.rpm,
        throttle: S.throttle, load: MU.clamp(Math.abs(S.speed) / 12, 0, 1),
        speed: S.speed, tracks: MU.clamp(Math.abs(speedAvg) / 8, 0, 1), damaged: E.damaged
      });
    }
  };

  /* ==================================================== machine gun ===== */
  Sim.prototype.fireMG = function (which) {
    var S = this.state, W = this.world;
    var origin, dir;
    var hm = this.hullMatrix();
    if (which === 'coax') {
      var mz = this.tank.muzzle(hm, S.turret.yaw, S.gun.pitch, S.gun.recoil);
      origin = mz.pos; dir = mz.dir;
    } else {
      origin = M4.transformPoint(hm, [-0.62, 1.44, 3.0]);
      dir = V3.normalize(M4.transformDir(hm, [0, 0.02, 1]));
    }
    /* cone of fire */
    var spread = 0.006;
    dir = V3.normalize([
      dir[0] + (this.rng() - 0.5) * spread * 2,
      dir[1] + (this.rng() - 0.5) * spread * 2,
      dir[2] + (this.rng() - 0.5) * spread * 2
    ]);
    /* tracer */
    if (S.mgShots % 4 === 0) {
      for (var s = 1; s <= 6; s++) {
        this.fx.spawn({
          kind: 'spark', additive: true, p: V3.addScaled(origin, dir, s * 6),
          v: V3.scale(dir, 120), max: 0.09, s0: 0.16, s1: 0.05,
          c0: [1.9, 1.1, 0.4], c1: [1.2, 0.4, 0.1], a0: 1, drag: 0
        });
      }
    }
    /* find the impact */
    var hitT = null, tHit = 900;
    var th = W.rayTargets(origin, dir, 900);
    if (th) { hitT = th.target; tHit = th.t; }
    /* terrain march */
    var step = 4, p = [origin[0], origin[1], origin[2]];
    for (var d = 0; d < Math.min(tHit, 900); d += step) {
      p = V3.addScaled(origin, dir, d);
      if (p[1] <= W.heightAt(p[0], p[2])) {
        this.fx.dust(p, 1, [0, 0, 0]);
        this.fx.sparks(p, 2, 3);
        return;
      }
    }
    if (hitT) {
      var ip = V3.addScaled(origin, dir, tHit);
      this.fx.sparks(ip, 4, 5);
      this.snd('hit', { gain: 0.3, rate: 1.6 });
      this.damageTarget(hitT, hitT.kind === 'panel' || hitT.kind === 'drum' ? 0.34 : 0.04, ip);
    }
  };

  /* ==================================================== projectiles ===== */
  Sim.prototype.updateProjectiles = function (dt) {
    var S = this.state, W = this.world;
    for (var i = this.projectiles.length - 1; i >= 0; i--) {
      var pr = this.projectiles[i];
      var steps = 5;
      var h = dt / steps;
      for (var s = 0; s < steps && pr.alive; s++) {
        var prev = [pr.p[0], pr.p[1], pr.p[2]];
        pr.v[1] -= 9.81 * h;
        /* light air drag */
        var dragK = pr.type === 'AP' ? 0.00012 : 0.00022;
        var sp = V3.len(pr.v);
        var f = 1 - dragK * sp * h;
        pr.v[0] *= f; pr.v[1] *= f; pr.v[2] *= f;
        pr.p[0] += pr.v[0] * h; pr.p[1] += pr.v[1] * h; pr.p[2] += pr.v[2] * h;
        pr.life += h;
        /* target intersection along this segment */
        var seg = V3.sub(pr.p, prev);
        var segLen = V3.len(seg);
        if (segLen > 0.001) {
          var dir = V3.scale(seg, 1 / segLen);
          var th = W.rayTargets(prev, dir, segLen);
          if (th) { this.impact(th.target, V3.addScaled(prev, dir, th.t), pr); pr.alive = false; break; }
        }
        /* ground */
        var gy = W.heightAt(pr.p[0], pr.p[2]);
        if (pr.p[1] <= gy) {
          pr.p[1] = gy;
          this.impact(null, pr.p, pr);
          pr.alive = false;
          break;
        }
        if (pr.life > 14 || Math.abs(pr.p[0]) > 900 || Math.abs(pr.p[2]) > 900) pr.alive = false;
      }
      /* tracer trail */
      pr.trail += dt;
      if (pr.alive && pr.trail > 0.012) {
        pr.trail = 0;
        this.fx.spawn({
          kind: 'spark', additive: true, p: pr.p, v: [0, 0, 0],
          max: 0.22, s0: 0.30, s1: 0.06, c0: [1.7, 1.0, 0.35], c1: [0.8, 0.25, 0.05], a0: 0.9, drag: 0
        });
      }
      if (!pr.alive) this.projectiles.splice(i, 1);
    }
  };

  Sim.prototype.impact = function (target, pos, pr) {
    var S = this.state, W = this.world;
    var he = pr.type === 'HE';
    this.fx.fireball(pos, he ? 1.5 : 0.9);
    this.fx.scorch(pos, W.normalAt(pos[0], pos[2]), he ? 5.5 : 3.4);
    var dist = V3.dist(pos, S.pos);
    var delay = MU.clamp(dist / 340, 0, 2.6);
    this.snd(he ? 'explosion' : 'explosion', { delay: delay, gain: MU.clamp(1.2 - dist / 900, 0.15, 1) });
    /* splash damage */
    var splash = he ? 6.5 : 1.6;
    var hits = W.impactTargets(pos, splash);
    var direct = false;
    for (var i = 0; i < hits.length; i++) {
      var t = hits[i];
      var dmg = (t === target) ? (he ? 2.2 : 2.6) : (he ? 1.1 : 0.4);
      if (t === target) direct = true;
      this.damageTarget(t, dmg, pos);
    }
    if (target && !direct) this.damageTarget(target, he ? 2.2 : 2.6, pos);
    if (!target && !hits.length) {
      this.log('Round impacted at ' + Math.round(dist) + ' m - miss.', 'warn');
    }
    W.knockTrees(pos, he ? 7 : 3.5);
  };

  Sim.prototype.damageTarget = function (t, dmg, pos) {
    var S = this.state;
    if (!t.alive) return;
    t.hp -= dmg;
    if (t.hp <= 0) {
      t.alive = false;
      t.burn = t.kind === 'panel' ? 0 : 1;
      S.score += t.score;
      S.kills++;
      S.hits++;
      this.log('TARGET DESTROYED at ' + t.dist + ' m  (+' + t.score + ')', 'ok');
      this.task('kill');
      if (t.explosive) this.fx.fireball([t.p[0], t.p[1] + 0.5, t.p[2]], 2.6);
      if (S.radio && S.master) {
        var self = this;
        setTimeout(function () {
          self.snd('radioBeep', { gain: 0.5 });
          self.log('"Good shooting, target destroyed. Next target, out."', 'radio');
        }, 900);
      }
    } else {
      S.hits++;
      this.log('Hit ' + t.kind + ' at ' + t.dist + ' m - still standing.', 'ok');
    }
  };

  /* ============================================================ views === */
  Sim.prototype.cycleStation = function (dir) {
    var order = ['driver', 'gunner', 'loader', 'commander'];
    var i = order.indexOf(this.state.station);
    i = (i + (dir || 1) + order.length) % order.length;
    this.setStation(order[i]);
  };

  TS.Sim = Sim;
})(typeof window !== 'undefined' ? window : this);
