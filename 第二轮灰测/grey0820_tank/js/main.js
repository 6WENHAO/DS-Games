/* =============================================================================
   main.js - boots the simulator: builds the world and the vehicle, drives the
   camera stations, routes mouse/keyboard input to the cockpit controls, renders
   the two-pass frame (exterior world, then the close-range interior) and keeps
   the HTML HUD in sync.
   ========================================================================== */
(function (global) {
  'use strict';
  var TS = global.TS = global.TS || {};
  var M4 = TS.M4, V3 = TS.V3, MU = TS.MU, G = TS.G;
  var D;

  var App = {
    ready: false, started: false, paused: false,
    fov: 68, sightZoom: 0, dpr: 1,
    yaw: 0, pitch: 0,
    hover: null, drag: null, dragCtl: null, lastX: 0, lastY: 0,
    mouseX: 0, mouseY: 0, locked: false,
    keys: {}, frames: 0, fps: 0, fpsT: 0, time: 0,
    exteriorYaw: 2.4, exteriorPitch: 0.28, exteriorDist: 13
  };
  TS.App = App;

  /* ------------------------------------------------------------- helpers --- */
  function el(id) { return document.getElementById(id); }
  function show(id, on) { var e = el(id); if (e) e.style.display = on ? '' : 'none'; }

  function status(text) {
    var e = el('loadText');
    if (e) e.textContent = text;
  }

  /* ================================================================ boot === */
  function boot() {
    var canvas = el('gl');
    try {
      App.R = new TS.Renderer(canvas);
    } catch (e) {
      el('loader').innerHTML = '<div class="err"><h1>WebGL unavailable</h1><p>' +
        (e && e.message ? e.message : e) + '</p></div>';
      return;
    }
    D = TS.TankDef;
    App.A = new TS.Assets(App.R);
    /* build in stages so the loading text can update */
    var steps = [
      ['Generating terrain...', function () {
        App.world = new TS.World(App.R, App.A);
        App.world.buildTerrain();
      }],
      ['Painting the sky...', function () { App.world.buildSky(); }],
      ['Scattering scenery...', function () { App.world.buildProps(); }],
      ['Setting up the range...', function () {
        App.world.buildTargets();
        App.world.texCamo = App.A.get('camo');
        App.world.texRadial = App.A.get('radialSoft');
      }],
      ['Riveting the hull...', function () {
        App.tank = new TS.Tank(App.R, App.A);
        App.tank.build();
      }],
      ['Fitting the interior...', function () {
        App.fx = new TS.FX(App.R, App.A);
        App.sim = new TS.Sim(App.world, App.tank, App.fx, TS.Audio);
        App.cockpit = new TS.Cockpit(App.R, App.A, App.sim);
        App.cockpit.build();
      }],
      ['Loading ammunition...', function () {
        buildOverlays();
        wireInput();
        var S = App.sim.state;
        S.pos[1] = App.world.heightAt(S.pos[0], S.pos[2]);
      }]
    ];
    var i = 0;
    function next() {
      if (i >= steps.length) {
        App.ready = true;
        show('loader', false);
        App.params = urlParams();
        if (App.params.autostart) { begin(true); applyParams(App.params); }
        else show('splash', true);
        requestAnimationFrame(frame);
        return;
      }
      status(steps[i][0]);
      var fn = steps[i][1];
      i++;
      setTimeout(function () {
        try { fn(); } catch (e) {
          console.error(e);
          el('loader').innerHTML = '<div class="err"><h1>Startup failed</h1><pre>' +
            (e && e.stack ? e.stack : e) + '</pre></div>';
          return;
        }
        next();
      }, 16);
    }
    next();
  }

  /* ---------------------------------------------------------- overlays ---- */
  function buildOverlays() {
    /* gunner's reticle drawn by the texture library, dropped in as a canvas */
    try {
      if (TS.Tex && TS.Tex.reticle) {
        var cv = TS.Tex.reticle({});
        cv.id = 'reticleCanvas';
        el('reticle').appendChild(cv);
      }
    } catch (e) { /* non fatal */ }
    /* checklist */
    var box = el('checklist');
    var html = '<h3>START-UP &amp; GUNNERY DRILL</h3><ul>';
    for (var i = 0; i < App.sim.tasks.length; i++) {
      html += '<li id="task_' + App.sim.tasks[i].id + '"><span class="tick">\u2610</span>' +
        App.sim.tasks[i].text + '</li>';
    }
    html += '</ul>';
    box.innerHTML = html;
  }

  /* ============================================================== input === */
  function wireInput() {
    var canvas = el('gl');

    window.addEventListener('resize', function () { App.R.resize(App.dpr); });

    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    canvas.addEventListener('mousedown', function (e) {
      e.preventDefault();
      if (!App.started) return;
      App.lastX = e.clientX; App.lastY = e.clientY;
      if (e.button === 2 || e.button === 1) {
        App.drag = 'look';
        return;
      }
      /* left button */
      var S = App.sim.state;
      var hit = pickAt(e.clientX, e.clientY);
      if (hit) {
        var c = hit.ctl;
        App.cockpit.pressed = c.id;
        if (c.kind === 'drag') { App.drag = 'ctl'; App.dragCtl = c; }
        else if (c.kind === 'hold' || c.kind === 'button') {
          App.drag = 'hold'; App.dragCtl = c;
          if (c.down) c.down(S);
          else if (c.act) c.act(S);
        } else if (c.act) c.act(S);
        return;
      }
      if (S.view === 'sight') { App.sim.fireMain(); return; }
      App.drag = 'look';
    });

    window.addEventListener('mouseup', function (e) {
      if (App.drag === 'hold' && App.dragCtl && App.dragCtl.up) App.dragCtl.up(App.sim.state);
      App.drag = null; App.dragCtl = null;
      App.cockpit.pressed = null;
    });

    window.addEventListener('mousemove', function (e) {
      var dx, dy;
      if (App.locked) { dx = e.movementX || 0; dy = e.movementY || 0; }
      else { dx = e.clientX - App.lastX; dy = e.clientY - App.lastY; }
      App.lastX = e.clientX; App.lastY = e.clientY;
      App.mouseX = e.clientX; App.mouseY = e.clientY;
      if (!App.started) return;
      var S = App.sim.state;
      if (App.drag === 'ctl' && App.dragCtl && App.dragCtl.drag) {
        App.dragCtl.drag(S, dx, dy);
        return;
      }
      if (App.drag === 'look' || App.locked) {
        if (S.view === 'sight') {
          App.sim.dragTraverse(dx * 0.42);
          App.sim.dragElevation(dy * 0.42);
        } else if (isInteriorView(S.view)) {
          App.yaw -= dx * 0.0035;
          App.pitch = MU.clamp(App.pitch - dy * 0.0035, -1.25, 1.25);
          if (S.view === 'periscope') App.yaw = MU.clamp(App.yaw, -0.5, 0.5);
          if (S.view === 'cupola') App.yaw = MU.clamp(App.yaw, -Math.PI, Math.PI);
        } else {
          App.exteriorYaw -= dx * 0.006;
          App.exteriorPitch = MU.clamp(App.exteriorPitch - dy * 0.005, -0.3, 1.35);
        }
        return;
      }
      /* plain hover */
      if (!App.locked) {
        var hit = pickAt(e.clientX, e.clientY);
        App.cockpit.hover = hit ? hit.ctl.id : null;
        App.hover = hit ? hit.ctl : null;
      }
    });

    canvas.addEventListener('wheel', function (e) {
      e.preventDefault();
      var S = App.sim.state;
      if (S.view === 'sight') {
        App.sightZoom = MU.clamp(App.sightZoom + (e.deltaY > 0 ? -1 : 1), 0, 2);
        App.sim.snd('reticleClick', { gain: 0.4 });
      } else if (!isInteriorView(S.view)) {
        App.exteriorDist = MU.clamp(App.exteriorDist + (e.deltaY > 0 ? 1.4 : -1.4), 5, 40);
      } else {
        App.fov = MU.clamp(App.fov + (e.deltaY > 0 ? 3 : -3), 40, 88);
      }
    }, { passive: false });

    document.addEventListener('pointerlockchange', function () {
      App.locked = (document.pointerLockElement === el('gl'));
      show('crosshair', App.locked);
    });

    window.addEventListener('keydown', function (e) {
      var k = e.key.length === 1 ? e.key.toUpperCase() : e.key;
      if (App.keys[k]) return;   /* ignore auto-repeat for edge actions */
      App.keys[k] = true;
      if (!App.started) { begin(); return; }
      onKeyDown(k, e);
    });
    window.addEventListener('keyup', function (e) {
      var k = e.key.length === 1 ? e.key.toUpperCase() : e.key;
      App.keys[k] = false;
      onKeyUp(k);
    });

    el('splash').addEventListener('click', begin);
    el('helpClose').addEventListener('click', function () { show('help', false); });
  }

  function isInteriorView(v) {
    return v === 'interior' || v === 'periscope' || v === 'sight' || v === 'cupola';
  }

  function begin(quiet) {
    if (App.started) return;
    App.started = true;
    show('splash', false);
    if (!quiet) show('help', true);
    try { TS.Audio.init(); TS.Audio.resume(); TS.Audio.setMaster(0.85); } catch (e) { }
    try { TS.Audio.setInterior(true); } catch (e) { }
  }

  /* ---- optional URL parameters, handy for demos and screenshots ---------
     index.html?autostart=1&engine=1&view=sight&station=gunner&load=1&hatch=1
     &yaw=-0.4&pitch=-0.2&az=25&elev=3                                      */
  function urlParams() {
    var q = {};
    try {
      var s = String((global.location && global.location.search) || '').replace(/^\?/, '');
      var parts = s.split('&');
      for (var i = 0; i < parts.length; i++) {
        if (!parts[i]) continue;
        var kv = parts[i].split('=');
        q[decodeURIComponent(kv[0])] = kv.length > 1 ? decodeURIComponent(kv[1]) : '1';
      }
    } catch (e) { }
    return q;
  }

  function applyParams(p) {
    var sim = App.sim, S = sim.state;
    if (p.engine) {
      S.master = true; S.fuelPump = true; S.magneto = true;
      S.engine.running = true; S.engine.rpm = 900; S.engine.oil = 46; S.engine.temp = 74;
      S.parkBrake = false; S.turretPower = true; S.radio = true;
    }
    if (p.load) { S.gun.breechTarget = 0; S.gun.breech = 0; S.gun.loaded = S.rack[0] || 'AP'; S.rack[0] = null; }
    if (p.hatch) { S.hatchCmdT = 1; S.hatchDrvT = 1; S.hatchCmd = 1; S.hatchDrv = 1; }
    if (p.station) sim.setStation(p.station);
    if (p.az !== undefined) S.turret.yaw = MU.rad(parseFloat(p.az) || 0);
    if (p.elev !== undefined) sim.setElevation(MU.rad(parseFloat(p.elev) || 0));
    if (p.gear !== undefined) sim.setGear(parseInt(p.gear, 10) || 0);
    if (p.yaw !== undefined) App.yaw = parseFloat(p.yaw) || 0;
    if (p.pitch !== undefined) App.pitch = parseFloat(p.pitch) || 0;
    if (p.zoom !== undefined) App.sightZoom = MU.clamp(parseInt(p.zoom, 10) || 0, 0, 2);
    if (p.view) {
      var map = {
        interior: ['interior', p.station || 'driver'], driver: ['interior', 'driver'],
        periscope: ['periscope', 'driver'], sight: ['sight', 'gunner'],
        cupola: ['cupola', 'commander'], loader: ['interior', 'loader'],
        gunner: ['interior', 'gunner'], commander: ['interior', 'commander'],
        unbuttoned: ['unbuttoned', 'commander'], chase: ['chase', S.station], orbit: ['orbit', S.station]
      };
      var m = map[p.view];
      if (m) { if (m[1]) S.station = m[1]; S.view = m[0]; }
    }
    if (p.pos) {
      var xz = p.pos.split(',');
      S.pos[0] = parseFloat(xz[0]) || 0;
      S.pos[2] = parseFloat(xz[1]) || 0;
      S.pos[1] = App.world.heightAt(S.pos[0], S.pos[2]);
    }
  }

  function onKeyDown(k, e) {
    var sim = App.sim, S = sim.state;
    switch (k) {
      case 'M': sim.toggle('master'); break;
      case 'F': if (S.station === 'commander' || S.view === 'cupola') sim.fireSmoke(); else sim.toggle('fuelPump'); break;
      case 'I': sim.toggle('magneto'); break;
      case 'G': sim.starterDown(); break;
      case 'L': sim.toggle('lights'); break;
      case 'K': sim.toggle('domeLight'); break;
      case 'V': sim.toggle('ventilator'); break;
      case 'P': sim.toggle('parkBrake'); break;
      case 'T': sim.toggle('turretPower'); break;
      case 'R': sim.toggle('radio'); break;
      case 'N': sim.toggle('intercom'); break;
      case 'B': sim.toggleBreech(); break;
      case 'J': sim.emptyBag(); break;
      case 'H': (S.station === 'driver') ? sim.toggle('hatchDrv') : sim.toggle('hatchCmd'); break;
      case 'X': sim.mgDown('bow'); break;
      case 'C': sim.mgDown('coax'); break;
      case 'Z': autoLoad(); break;
      case ' ': sim.fireMain(); if (e) e.preventDefault(); break;
      case 'Enter': autoLoad(); break;
      case '0': sim.setGear(0); break;
      case '1': setView('interior', 'driver'); break;
      case '2': sim.useView('periscope', 'driver'); break;
      case '3': sim.useView('sight', 'gunner'); break;
      case '4': sim.useView('cupola', 'commander'); break;
      case '5': setView('interior', 'loader'); break;
      case '6': unbutton(); break;
      case '7': S.view = 'chase'; break;
      case '8': S.view = 'orbit'; break;
      case '9': sim.setGear(-1); break;
      case 'Tab': show('help', el('help').style.display === 'none'); if (e) e.preventDefault(); break;
      case 'F1': show('help', true); if (e) e.preventDefault(); break;
      case 'F9': sim.useExtinguisher(); break;
      case 'Q':
        if (!App.locked) el('gl').requestPointerLock && el('gl').requestPointerLock();
        else document.exitPointerLock && document.exitPointerLock();
        break;
      case 'Escape': show('help', false); break;
      case '[': sim.shift(-1); break;
      case ']': sim.shift(1); break;
      case 'Y': cycleStation(); break;
    }
    /* gear numbers with shift */
    if (k === '!' || k === '@' || k === '#' || k === '$') {
      var map = { '!': 1, '@': 2, '#': 3, '$': 4 };
      sim.setGear(map[k]);
    }
  }

  function onKeyUp(k) {
    var sim = App.sim;
    if (k === 'G') sim.starterUp();
    if (k === 'X' || k === 'C') sim.mgUp();
  }

  function autoLoad() {
    /* convenience: open breech -> load the first available round -> close */
    var sim = App.sim, S = sim.state;
    if (S.gun.loaded) { if (S.gun.breech > 0.5) sim.toggleBreech(); return; }
    if (S.gun.breech < 0.5) { sim.toggleBreech(); return; }
    for (var i = 0; i < S.rack.length; i++) {
      if (S.rack[i]) { sim.loadFromRack(i); return; }
    }
    sim.log('The ready rack is empty.', 'warn');
  }

  function setView(view, station) {
    var S = App.sim.state;
    if (station && station !== S.station) App.sim.setStation(station);
    S.view = view;
    App.yaw = 0; App.pitch = 0;
  }

  function unbutton() {
    var S = App.sim.state;
    if (S.hatchCmdT < 0.5) App.sim.toggle('hatchCmd');
    App.sim.setStation('commander');
    S.view = 'unbuttoned';
    App.yaw = 0; App.pitch = 0;
  }

  function cycleStation() {
    App.sim.cycleStation(1);
    App.yaw = 0; App.pitch = 0;
  }

  /* ============================================================= camera === */
  function cameraMatrix() {
    var S = App.sim.state;
    var hullMat = App.sim.hullMatrix();
    var turretMat = App.sim.turretMatrix();
    var st = D.stations[S.station] || D.stations.driver;
    var space = st.space === 'turret' ? turretMat : hullMat;
    var shake = S.shake * 0.02 + Math.abs(S.vBounce) * 0.004;
    var sx = (Math.random() - 0.5) * shake, sy = (Math.random() - 0.5) * shake;

    if (S.view === 'sight') {
      /* aligned with the bore, viewed from the eyepiece. The interior pass is
         skipped here: the reticle mask covers everything outside the optic. */
      var eye = M4.transformPoint(turretMat, [-0.52, D.gun.trunY - 0.04, 0.10]);
      var gm = App.tank.gunMatrix(turretMat, S.gun.pitch, 0);
      var bore = V3.normalize(M4.transformDir(gm, [0, 0, 1]));
      var up = V3.normalize(M4.transformDir(gm, [0, 1, 0]));
      var right = V3.normalize(V3.cross(bore, up));
      var back = V3.negate(bore);
      /* tiny wobble from the running engine */
      var w = (S.engine.running ? 0.0006 * (0.4 + S.engine.rpm / 2600) : 0) + shake * 0.02;
      eye = V3.addScaled(eye, right, (Math.random() - 0.5) * w * 8);
      var camM = M4.fromBasis(right, up, back, eye);
      return {
        m: camM, fov: [7.5, 4.2, 2.6][App.sightZoom], near: 0.35, far: 2400,
        hideShell: true, drawInterior: false
      };
    }
    if (S.view === 'chase' || S.view === 'orbit') {
      var tgt = M4.transformPoint(hullMat, [0, 1.6, 0]);
      var yaw = S.view === 'chase' ? S.hullYaw + Math.PI + App.exteriorYaw * 0.15 : App.exteriorYaw;
      var pitch = S.view === 'chase' ? 0.22 : App.exteriorPitch;
      var dist = App.exteriorDist;
      var dir = [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
      var eye2 = V3.addScaled(tgt, dir, dist);
      var gy = App.world.heightAt(eye2[0], eye2[2]) + 1.2;
      if (eye2[1] < gy) eye2[1] = gy;
      var f = V3.normalize(V3.sub(tgt, eye2));
      var r2 = V3.normalize(V3.cross(f, [0, 1, 0]));
      var u2 = V3.cross(r2, f);
      return {
        m: M4.fromBasis(r2, u2, V3.negate(f), eye2), fov: 58, near: 0.35, far: 2600,
        hideShell: false, drawInterior: false
      };
    }
    /* interior style views: eye point in its own space, free look */
    var eyeLocal = st.eye.slice();
    var fov = App.fov, hide = true, inside = true;
    if (S.view === 'periscope') { eyeLocal = [0.60, 1.99, 1.98]; fov = 44; }
    if (S.view === 'cupola') { eyeLocal = [-0.30, D.turret.h + 0.32, -0.60]; fov = 42; }
    if (S.view === 'unbuttoned') { eyeLocal = [-0.30, D.turret.h + 0.52, -0.60]; fov = 72; hide = false; inside = false; }
    var m = M4.mulAll(space,
      M4.translation(eyeLocal[0], eyeLocal[1] + sy, eyeLocal[2]),
      M4.rotationY(Math.PI + App.yaw + sx),
      M4.rotationX(App.pitch));
    return { m: m, fov: fov, near: inside ? 0.02 : 0.3, far: 2600, hideShell: hide, drawInterior: inside };
  }

  /* interior point lights: build every candidate, keep muzzle flashes, then
     take whichever remaining lamps are nearest the camera (only 4 slots). */
  function interiorLights(hullMat, turretMat, camPos) {
    var S = App.sim.state, cand = [];
    App.fx.lights(cand);
    var pinned = cand.length;
    function push(pos, col, rad) { cand.push({ pos: pos, col: col, rad: rad }); }

    if (S.hatchCmd > 0.12) {
      push(M4.transformPoint(turretMat, [-0.30, D.turret.h + 0.10, -0.60]),
        V3.scale([0.62, 0.68, 0.78], S.hatchCmd * 2.4), 4.4);
    }
    if (S.hatchDrv > 0.12) {
      push(M4.transformPoint(hullMat, [0.60, D.interior.ceilY + 0.02, 1.62]),
        V3.scale([0.62, 0.68, 0.78], S.hatchDrv * 2.2), 3.8);
    }
    if (S.domeLight && S.master) {
      push(M4.transformPoint(turretMat, [0.22, D.turret.h - 0.12, -0.34]), [1.35, 1.12, 0.72], 4.2);
      push(M4.transformPoint(hullMat, [-0.55, D.interior.ceilY - 0.12, 0.85]), [1.25, 1.04, 0.68], 4.0);
    }
    if (S.master) {
      push(M4.transformPoint(hullMat, [0.58, 1.30, 1.86]), [0.34, 0.44, 0.26], 1.5);
    }
    if (S.fire > 0) {
      push(M4.transformPoint(hullMat, [0, 1.2, -1.3]), V3.scale([1.7, 0.75, 0.28], S.fire), 3.6);
    }
    /* a weak fill light on the crew member's own position so that whatever
       you lean towards is always readable */
    push(camPos, [0.20, 0.20, 0.18], 2.6);

    var rest = cand.slice(pinned);
    rest.sort(function (a, b) {
      return (V3.dist2(a.pos, camPos) / (a.rad * a.rad)) - (V3.dist2(b.pos, camPos) / (b.rad * b.rad));
    });
    return cand.slice(0, pinned).concat(rest).slice(0, 4);
  }

  /* ============================================================== pick === */
  function pickAt(clientX, clientY) {
    var S = App.sim.state;
    /* the gun sight shows only the optic, so nothing is clickable there */
    if (!isInteriorView(S.view) || S.view === 'sight') return null;
    var canvas = el('gl');
    var rect = canvas.getBoundingClientRect();
    var nx, ny;
    if (App.locked) { nx = 0; ny = 0; }
    else {
      nx = ((clientX - rect.left) / rect.width) * 2 - 1;
      ny = 1 - ((clientY - rect.top) / rect.height) * 2;
    }
    var cam = App.camInfo;
    if (!cam) return null;
    var inv = M4.inverse(cam.vp);
    var p0 = M4.transformPoint(inv, [nx, ny, -1]);
    var p1 = M4.transformPoint(inv, [nx, ny, 1]);
    var dir = V3.normalize(V3.sub(p1, p0));
    var hit = App.cockpit.pick(p0, dir, App.sim.hullMatrix(), App.sim.turretMatrix());
    if (hit && hit.t < 2.4) return hit;
    return null;
  }

  /* ============================================================== frame === */
  var last = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    if (!App.ready) return;
    var dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
    last = now;
    App.time += dt;
    App.frames++;
    if (now - App.fpsT > 500) {
      App.fps = Math.round(App.frames * 1000 / (now - App.fpsT));
      App.frames = 0; App.fpsT = now;
    }
    if (!App.started) { render(dt); return; }

    /* keyboard driving inputs */
    var S = App.sim.state;
    var input = {
      throttle: !!App.keys['W'],
      brake: !!App.keys['S'],
      steerL: !!App.keys['A'],
      steerR: !!App.keys['D']
    };
    /* turret / gun keys */
    var trav = 0, elev = 0;
    if (App.keys['ArrowLeft']) trav += 1;
    if (App.keys['ArrowRight']) trav -= 1;
    if (App.keys['ArrowUp']) elev += 1;
    if (App.keys['ArrowDown']) elev -= 1;
    if (App.keys[',']) trav += 1;
    if (App.keys['.']) trav -= 1;
    if (trav) App.sim.traverseRate(trav);
    if (elev) App.sim.elevateRate(elev);

    App.sim.update(dt, input);
    App.world.update(dt);
    App.fx.update(dt, App.world);
    if (TS.Audio && TS.Audio.setInterior) {
      TS.Audio.setInterior(isInteriorView(S.view) && S.hatchCmd < 0.4 && S.hatchDrv < 0.4);
    }
    render(dt);
    updateHud();
  }

  /* ============================================================= render === */
  function render(dt) {
    var R = App.R, S = App.sim ? App.sim.state : null;
    var aspect = R.resize(App.dpr);
    if (!S) { R.clear([0.1, 0.12, 0.14]); return; }

    var cam = cameraMatrix();
    var view = M4.inverse(cam.m);
    var camPos = M4.getTranslation(cam.m);
    var camRight = M4.axis(cam.m, 0);
    var camUp = M4.axis(cam.m, 1);
    var hullMat = App.sim.hullMatrix();
    var turretMat = App.sim.turretMatrix();

    /* ---------- pass 1: the world ---------- */
    var proj1 = M4.perspective(MU.rad(cam.fov), aspect, cam.drawInterior ? 0.35 : cam.near, cam.far);
    var vp1 = M4.multiply(proj1, view);
    var sun = App.world.sunDir;
    R.setEnv({
      sunDir: sun, sunCol: [1.08, 1.00, 0.86],
      skyCol: [0.40, 0.46, 0.56], gndCol: [0.17, 0.16, 0.13],
      fogCol: [0.70, 0.74, 0.78], fogDens: 0.00085
    });
    R.setLights(App.fx.lights([]));
    R.setCamera(vp1, camPos);
    R.beginFrame();
    R.clear([0.70, 0.74, 0.78]);
    App.world.draw(R, camPos);
    App.tank.draw(R, {
      hullMat: hullMat, turretYaw: S.turret.yaw, gunPitch: S.gun.pitch, recoil: S.gun.recoil,
      trackL: S.trackL, trackR: S.trackR, driverHatch: S.hatchDrv, cmdHatch: S.hatchCmd,
      lights: S.lights && S.master, interiorView: cam.hideShell,
      time: S.time, lateralG: 0
    });
    App.fx.draw(R, camRight, camUp, camPos);
    R.flush();

    /* ---------- pass 2: the interior, with its own near plane ---------- */
    var vp2 = vp1;
    if (cam.drawInterior) {
      var proj2 = M4.perspective(MU.rad(cam.fov), aspect, 0.02, 40);
      vp2 = M4.multiply(proj2, view);
      R.clearDepth();
      var lightBoost = 1 + (S.hatchCmd + S.hatchDrv) * 0.30;
      R.setEnv({
        sunDir: sun, sunCol: [0.09, 0.09, 0.09],
        skyCol: V3.scale([0.27, 0.28, 0.30], lightBoost),
        gndCol: V3.scale([0.13, 0.13, 0.12], lightBoost),
        fogCol: [0.1, 0.1, 0.1], fogDens: 0.0
      });
      R.setLights(interiorLights(hullMat, turretMat, camPos));
      R.setCamera(vp2, camPos);
      App.cockpit.draw(R, hullMat, turretMat, S);
      R.flush();
    }
    App.camInfo = { vp: vp2, pos: camPos, cam: cam };
  }

  /* ================================================================ hud === */
  var hudT = 0;
  function updateHud() {
    var S = App.sim.state;
    hudT++;
    /* fast-changing overlays every frame */
    var fum = el('fumes');
    if (fum) fum.style.opacity = MU.clamp(S.fumes * 0.30, 0, 0.45);
    var fireOv = el('fireOverlay');
    if (fireOv) fireOv.style.opacity = MU.clamp(S.fire * 0.55, 0, 0.55);
    var fl = el('flash');
    if (fl) fl.style.opacity = MU.clamp(S.shake * 0.5 - 0.5, 0, 0.5);
    show('reticle', S.view === 'sight');
    show('maskPeri', S.view === 'periscope' || S.view === 'cupola');
    var zl = el('zoomLabel');
    if (zl) zl.textContent = ['x3', 'x5', 'x8'][App.sightZoom] || '';

    if (hudT % 3 !== 0) return;

    var E = S.engine;
    var kmh = Math.abs(S.speed) * 3.6;
    el('hudStation').textContent = (TS.TankDef.stations[S.station] || {}).name || '';
    el('hudView').textContent = viewName(S.view);
    el('hudGear').textContent = App.sim.gearName();
    el('hudSpeed').textContent = kmh.toFixed(0);
    el('hudRpm').textContent = Math.round(E.rpm);
    el('hudTemp').textContent = Math.round(E.temp) + '\u00b0';
    el('hudTemp').className = E.temp > 118 ? 'bad' : (E.temp > 100 ? 'warn' : '');
    el('hudFuel').textContent = Math.round(S.fuel * 100) + '%';
    el('hudFuel').className = S.fuel < 0.15 ? 'bad' : '';
    el('hudEngine').textContent = E.running ? (E.damaged ? 'RUNNING (DAMAGED)' : 'RUNNING') : (E.starting ? 'CRANKING' : 'STOPPED');
    el('hudEngine').className = E.running ? (E.damaged ? 'warn' : 'ok') : 'bad';
    el('hudBar').style.width = MU.clamp(E.rpm / 2600, 0, 1) * 100 + '%';
    el('hudPower').textContent = S.master ? 'ON' : 'OFF';
    el('hudPower').className = S.master ? 'ok' : 'bad';

    el('hudBreech').textContent = S.gun.breech > 0.5 ? 'OPEN' : 'CLOSED';
    el('hudLoaded').textContent = S.gun.loaded ? S.gun.loaded : (S.gun.spent ? 'SPENT CASE' : 'EMPTY');
    el('hudLoaded').className = S.gun.loaded ? 'ok' : 'warn';
    var ap = 0, he = 0;
    for (var i = 0; i < S.rack.length; i++) { if (S.rack[i] === 'AP') ap++; if (S.rack[i] === 'HE') he++; }
    el('hudRack').textContent = ap + ' AP / ' + he + ' HE';
    el('hudMg').textContent = S.mgAmmo;
    el('hudElev').textContent = MU.deg(S.gun.pitch).toFixed(1) + '\u00b0';
    el('hudAz').textContent = (((MU.deg(S.turret.yaw) % 360) + 360) % 360).toFixed(0) + '\u00b0';
    el('hudScore').textContent = S.score;
    el('hudKills').textContent = S.kills + ' / ' + App.world.targets.length;
    el('hudShots').textContent = S.shots;
    el('hudFps').textContent = App.fps + ' fps  \u00b7  ' + App.R.stats.draws + ' draws';

    /* hovered control tooltip */
    var tip = el('tip');
    if (App.hover) {
      var c = App.hover;
      var r = c.read ? c.read(S) : '';
      tip.innerHTML = '<b>' + c.label + '</b>' + (r ? '<span class="val">' + r + '</span>' : '') +
        (c.keys ? '<span class="key">' + c.keys + '</span>' : '') +
        (c.tip ? '<div class="sub">' + c.tip + '</div>' : '');
      tip.style.display = '';
    } else {
      tip.style.display = 'none';
    }

    /* checklist */
    for (var t = 0; t < App.sim.tasks.length; t++) {
      var task = App.sim.tasks[t];
      var li = el('task_' + task.id);
      if (!li) continue;
      var doneNow = task.done;
      if (doneNow && li.className !== 'done') {
        li.className = 'done';
        li.querySelector('.tick').textContent = '\u2611';
      }
    }

    /* message log */
    var log = el('log');
    var out = '';
    var n = Math.min(6, S.messages.length);
    for (var m = S.messages.length - n; m < S.messages.length; m++) {
      var msg = S.messages[m];
      out += '<div class="' + msg.kind + '">' + msg.text + '</div>';
    }
    log.innerHTML = out;
  }

  function viewName(v) {
    return {
      interior: 'FREE LOOK', periscope: 'PERISCOPE', sight: 'GUN SIGHT',
      cupola: 'CUPOLA', unbuttoned: 'HEAD OUT', chase: 'CHASE CAM', orbit: 'ORBIT CAM'
    }[v] || v;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : this);
