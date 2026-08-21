/* =============================================================================
   cockpit.js - the fighting compartment: hull interior, turret interior, and
   every interactive control (switches, levers, pedals, handwheels, breech,
   ready rack, radio, periscopes, gauges with live needles).

   Authoring conventions
   ---------------------
   * Two spaces: 'hull' (fixed to the hull) and 'turret' (rotates with it).
   * A "board" is a small local frame placed with its +Z pointing at the crew
     member who uses it. Inside a board frame, +X is always "right as seen",
     +Y is "up as seen" and +Z is "out of the panel", so textured plates and
     dial faces are never mirrored.
   * Every control carries an oriented hit box (matrix + half extents) used by
     the mouse picker in main.js.
   ========================================================================== */
(function (global) {
  'use strict';
  var TS = global.TS = global.TS || {};
  var G = TS.G, M4 = TS.M4, V3 = TS.V3, MU = TS.MU;
  var D = TS.TankDef;

  /* palette */
  var CREAM = [0.80, 0.79, 0.72];
  var OLIVE = [0.40, 0.44, 0.35];
  var DARK = [0.24, 0.25, 0.23];
  var STEEL = [0.55, 0.56, 0.54];
  var GUNMETAL = [0.32, 0.33, 0.33];
  var BLACK = [0.13, 0.13, 0.13];
  var BRASS = [0.72, 0.56, 0.22];
  var LEATHER = [0.30, 0.22, 0.16];
  var RED = [0.52, 0.12, 0.09];
  var CANVAS = [0.44, 0.41, 0.31];
  var COPPER = [0.55, 0.35, 0.18];

  /* flip a geometry inside out (used for shells we view from within) */
  function invert(g) {
    for (var i = 0; i < g.i.length; i += 3) {
      var t = g.i[i + 1]; g.i[i + 1] = g.i[i + 2]; g.i[i + 2] = t;
    }
    for (var n = 0; n < g.n.length; n++) g.n[n] = -g.n[n];
    return g;
  }

  function Cockpit(R, A, sim) {
    this.R = R; this.A = A; this.sim = sim;
    this.groups = {};      /* key "space/mat" -> {space, mat, geoms:[], verts} */
    this.static = [];      /* uploaded {mesh, space, matKey}                   */
    this.dyn = [];         /* {mesh, space, xf, mat, ctl, vis}                 */
    this.controls = [];
    this.byId = {};
    this.hover = null;
    this.W = {};           /* shared widget meshes                            */
  }

  /* ------------------------------------------------------------ plumbing --- */
  Cockpit.prototype.add = function (space, matKey, geom) {
    var key = space + '/' + matKey;
    var grp = this.groups[key];
    if (!grp) grp = this.groups[key] = { space: space, matKey: matKey, batches: [[]], verts: 0 };
    var vc = geom.p.length / 3;
    if (grp.verts + vc > 60000) { grp.batches.push([]); grp.verts = 0; }
    grp.batches[grp.batches.length - 1].push(geom);
    grp.verts += vc;
  };

  Cockpit.prototype.addDyn = function (space, mesh, xf, mat, ctlId, vis) {
    var p = { mesh: mesh, space: space, xf: xf, mat: mat, ctl: ctlId || null, vis: vis || null };
    this.dyn.push(p);
    return p;
  };

  Cockpit.prototype.ctl = function (def) {
    def.hitInv = M4.inverse(def.hit.m);
    this.controls.push(def);
    this.byId[def.id] = def;
    return def;
  };

  /* material table for the static batches */
  Cockpit.prototype.material = function (matKey) {
    var A = this.A;
    switch (matKey) {
      case 'plain': return { color: [1, 1, 1], spec: 0.06, shine: 12 };
      case 'metal': return { color: [1, 1, 1], tex: A.get('metal'), uvScale: [1.4, 1.4], spec: 0.22, shine: 34 };
      case 'panel': return { color: [1, 1, 1], tex: A.get('panelDark'), uvScale: [1, 1], spec: 0.12, shine: 20 };
      case 'rivet': return { color: [1, 1, 1], tex: A.get('rivet'), uvScale: [1, 1], spec: 0.16, shine: 26 };
      case 'wood': return { color: [1, 1, 1], tex: A.get('wood'), uvScale: [1, 1], spec: 0.05 };
      case 'fabric': return { color: [1, 1, 1], tex: A.get('fabric'), uvScale: [1, 1], spec: 0.03 };
      default: return { color: [1, 1, 1] };
    }
  };

  /* --------------------------------------------------------- board frames --- */
  function board(x, y, z, yaw, tilt) {
    var m = M4.multiply(M4.translation(x, y, z), M4.rotationY(yaw));
    if (tilt) m = M4.multiply(m, M4.rotationX(tilt));
    return m;
  }
  /* place something on a board: u right, v up, out towards the viewer */
  function on(b, u, v, out, rot) {
    var m = M4.multiply(b, M4.translation(u, v, out || 0));
    if (rot) m = M4.multiply(m, rot);
    return m;
  }

  /* =========================================================== widgets ==== */
  Cockpit.prototype.buildWidgets = function () {
    var R = this.R, W = this.W;
    /* toggle switch lever: pivots at its base, tilts about X */
    W.swLever = R.mesh(G.merge([
      G.at(G.cyl(0.006, 0.005, 0.042, 7, { col: [0.86, 0.86, 0.84] }), 0, 0.021, 0),
      G.at(G.sphere(0.010, 8, 6, { col: [0.90, 0.90, 0.88] }), 0, 0.044, 0)
    ]));
    /* momentary button body */
    W.button = R.mesh(G.merge([
      G.at(G.cyl(0.019, 0.019, 0.016, 12, { col: [0.55, 0.14, 0.11] }), 0, 0.008, 0),
      G.at(G.dome(0.019, 12, 4, { col: [0.62, 0.17, 0.13] }), 0, 0.016, 0)
    ]));
    W.buttonBlack = R.mesh(G.merge([
      G.at(G.cyl(0.017, 0.017, 0.014, 12, { col: [0.16, 0.16, 0.16] }), 0, 0.007, 0),
      G.at(G.dome(0.017, 12, 4, { col: [0.20, 0.20, 0.20] }), 0, 0.014, 0)
    ]));
    /* rotary knob with an index mark */
    W.knob = R.mesh(G.merge([
      G.at(G.cyl(0.024, 0.021, 0.026, 14, { col: [0.14, 0.14, 0.14] }), 0, 0.013, 0),
      G.at(G.box(0.005, 0.028, 0.020, { col: [0.85, 0.83, 0.76] }), 0, 0.014, 0.012),
      G.at(G.disc(0.021, 14, { col: [0.20, 0.20, 0.20] }), 0, 0.026, 0)
    ]));
    /* gauge needle: pivot at the origin, points along +X */
    W.needle = R.mesh(G.merge([
      G.at(G.box(0.062, 0.0055, 0.004, { col: [0.92, 0.90, 0.84] }), 0.026, 0, 0),
      G.at(G.box(0.016, 0.0075, 0.004, { col: [0.80, 0.16, 0.12] }), -0.008, 0, 0),
      G.at(G.cyl(0.008, 0.008, 0.008, 10, { col: [0.18, 0.18, 0.18] }), 0, 0, 0.002)
    ]));
    /* long control lever with a ball grip (steering) */
    W.lever = R.mesh(G.merge([
      G.at(G.cyl(0.020, 0.016, 0.60, 10, { col: [0.34, 0.35, 0.33] }), 0, 0.30, 0),
      G.at(G.sphere(0.036, 10, 8, { col: [0.12, 0.12, 0.12] }), 0, 0.62, 0),
      G.at(G.torus(0.024, 0.008, 10, 6, { col: [0.5, 0.5, 0.48] }), 0, 0.50, 0)
    ]));
    /* gear lever */
    W.gearLever = R.mesh(G.merge([
      G.at(G.cyl(0.016, 0.013, 0.40, 10, { col: [0.36, 0.37, 0.35] }), 0, 0.20, 0),
      G.at(G.sphere(0.032, 10, 8, { col: [0.10, 0.10, 0.10] }), 0, 0.41, 0)
    ]));
    /* handwheel: rim in the YZ plane (axis along X) with three spokes */
    var hw = [G.xf(G.torus(0.105, 0.013, 18, 7, { col: [0.16, 0.16, 0.16] }), M4.rotationZ(Math.PI / 2))];
    for (var s = 0; s < 3; s++) {
      var a = s / 3 * Math.PI * 2;
      hw.push(G.xf(G.box(0.014, 0.10, 0.012, { col: [0.30, 0.31, 0.30] }),
        M4.mulAll(M4.rotationX(a), M4.translation(0, 0.052, 0))));
    }
    hw.push(G.xf(G.cyl(0.022, 0.022, 0.05, 10, { col: [0.34, 0.35, 0.33] }), M4.rotationZ(Math.PI / 2)));
    hw.push(G.at(G.cyl(0.010, 0.010, 0.05, 8, { col: [0.12, 0.12, 0.12] }), 0, 0.105, 0.03));
    W.handwheel = R.mesh(G.merge(hw));
    /* crank handle (traverse) */
    W.crank = R.mesh(G.merge([
      G.xf(G.cyl(0.020, 0.020, 0.05, 10, { col: [0.34, 0.35, 0.33] }), M4.rotationZ(Math.PI / 2)),
      G.at(G.box(0.016, 0.13, 0.016, { col: [0.32, 0.33, 0.31] }), 0, 0.055, 0),
      G.xf(G.cyl(0.017, 0.017, 0.075, 10, { col: [0.10, 0.10, 0.10] }), M4.mulAll(M4.translation(0, 0.11, 0.045), M4.rotationZ(Math.PI / 2)))
    ]));
    /* foot pedal, hinged at its bottom edge */
    W.pedal = R.mesh(G.merge([
      G.at(G.box(0.10, 0.20, 0.018, { col: [0.22, 0.22, 0.21] }), 0, 0.10, 0),
      G.at(G.box(0.085, 0.03, 0.010, { col: [0.10, 0.10, 0.10] }), 0, 0.055, 0.014),
      G.at(G.box(0.085, 0.03, 0.010, { col: [0.10, 0.10, 0.10] }), 0, 0.135, 0.014)
    ]));
    /* breech operating lever */
    W.breechLever = R.mesh(G.merge([
      G.at(G.box(0.030, 0.19, 0.030, { col: [0.30, 0.31, 0.31] }), 0, 0.095, 0),
      G.at(G.cyl(0.022, 0.022, 0.10, 10, { col: [0.10, 0.10, 0.10] }), 0, 0.20, 0)
    ]));
    /* a complete round: brass case + projectile, nose along +Y */
    var rnd = [
      G.at(G.cyl(0.043, 0.043, 0.30, 14, { col: BRASS }), 0, 0.15, 0),
      G.at(G.cyl(0.043, 0.038, 0.05, 14, { col: BRASS }), 0, 0.325, 0),
      G.at(G.torus(0.0435, 0.004, 14, 5, { col: [0.62, 0.48, 0.18] }), 0, 0.02, 0),
      G.at(G.cyl(0.038, 0.038, 0.14, 14, { col: [0.34, 0.36, 0.30] }), 0, 0.42, 0),
      G.at(G.lathe([[0.038, 0], [0.034, 0.05], [0.024, 0.10], [0.010, 0.15], [0.0, 0.17]], 14, { col: [0.32, 0.34, 0.28] }), 0, 0.49, 0)
    ];
    W.round = R.mesh(G.merge(rnd));
    W.roundHE = R.mesh(G.paint(G.merge(rnd), [1, 1, 1]));
    /* dome light lens */
    W.lamp = R.mesh(G.merge([
      G.at(G.cyl(0.055, 0.045, 0.02, 12, { col: [0.4, 0.4, 0.38] }), 0, 0.01, 0),
      G.at(G.dome(0.045, 12, 5, { col: [1, 0.95, 0.82] }), 0, 0.012, 0)
    ]));
    /* small warning lamp lens */
    W.warnLamp = R.mesh(G.at(G.quad(0.055, 0.022), 0, 0, 0));
    /* ventilator fan blades */
    var fan = [];
    for (var f = 0; f < 5; f++) {
      fan.push(G.xf(G.box(0.075, 0.006, 0.030, { col: [0.5, 0.5, 0.48] }),
        M4.mulAll(M4.rotationY(f / 5 * Math.PI * 2), M4.translation(0.05, 0, 0), M4.rotationZ(0.5))));
    }
    fan.push(G.at(G.cyl(0.018, 0.018, 0.02, 10, { col: [0.3, 0.3, 0.29] }), 0, 0, 0));
    W.fan = R.mesh(G.merge(fan));
    /* hatch lid (used for both hatches) */
    W.hatchLid = R.mesh(G.merge([
      G.at(G.cyl(0.30, 0.30, 0.05, 16, { col: [0.62, 0.63, 0.58] }), 0, 0, 0.30),
      G.at(G.box(0.16, 0.04, 0.09, { col: [0.4, 0.4, 0.38] }), 0.12, -0.035, 0.30)
    ]));
    /* generic small plate for switch bases */
    W.dial = R.mesh(G.quad(0.13, 0.13));
  };

  /* ================================================== control factories === */
  /* a toggle switch: static base plate + animated lever */
  Cockpit.prototype.mkToggle = function (space, matKey, bm, def) {
    this.add(space, matKey, G.xf(G.merge([
      G.at(G.box(0.048, 0.036, 0.010, { col: [0.20, 0.21, 0.20] }), 0, 0, 0.005),
      G.at(G.cyl(0.011, 0.011, 0.014, 10, { col: [0.42, 0.43, 0.41] }), 0, 0, 0.014)
    ]), M4.multiply(bm, M4.rotationX(-Math.PI / 2))));
    var ctl = this.ctl({
      id: def.id, label: def.label, space: space, kind: 'toggle', tip: def.tip, keys: def.keys,
      hit: { m: M4.multiply(bm, M4.translation(0, 0.012, 0.03)), h: [0.042, 0.042, 0.045] },
      read: def.read, act: def.act
    });
    this.addDyn(space, this.W.swLever, function (S) {
      return M4.mulAll(bm, M4.translation(0, 0, 0.016), M4.rotationX(def.state(S) ? -0.5 : 0.5));
    }, { color: [1, 1, 1], spec: 0.45, shine: 50 }, def.id);
    return ctl;
  };

  /* a momentary push button */
  Cockpit.prototype.mkButton = function (space, matKey, bm, def) {
    this.add(space, matKey, G.xf(G.merge([
      G.at(G.cyl(0.028, 0.026, 0.010, 14, { col: [0.20, 0.21, 0.20] }), 0, 0, 0.005),
      G.at(G.ring(0.026, 0.030, 14, { col: [0.34, 0.35, 0.33] }), 0, 0.010, 0)
    ]), M4.multiply(bm, M4.rotationX(-Math.PI / 2))));
    var mesh = def.black ? this.W.buttonBlack : this.W.button;
    var ctl = this.ctl({
      id: def.id, label: def.label, space: space, kind: 'button', tip: def.tip, keys: def.keys,
      hit: { m: M4.multiply(bm, M4.translation(0, 0, 0.022)), h: [0.036, 0.036, 0.032] },
      read: def.read, act: def.act, down: def.down, up: def.up
    });
    var self = this;
    this.addDyn(space, mesh, function (S) {
      var pressed = self.pressed === def.id ? 0.008 : 0;
      return M4.mulAll(bm, M4.translation(0, 0, 0.008 - pressed), M4.rotationX(-Math.PI / 2));
    }, def.mat || { color: [1, 1, 1], spec: 0.3, shine: 30 }, def.id);
    return ctl;
  };

  /* a rotary knob (drag to change a 0..1 value) */
  Cockpit.prototype.mkKnob = function (space, matKey, bm, def) {
    this.add(space, matKey, G.xf(G.merge([
      G.at(G.cyl(0.030, 0.030, 0.008, 14, { col: [0.20, 0.21, 0.20] }), 0, 0, 0.004),
      G.at(G.ring(0.030, 0.034, 16, { col: [0.30, 0.31, 0.29] }), 0, 0.008, 0)
    ]), M4.multiply(bm, M4.rotationX(-Math.PI / 2))));
    var ctl = this.ctl({
      id: def.id, label: def.label, space: space, kind: 'drag', tip: def.tip, keys: def.keys,
      hit: { m: M4.multiply(bm, M4.translation(0, 0, 0.022)), h: [0.038, 0.038, 0.030] },
      read: def.read, act: def.act, drag: def.drag
    });
    this.addDyn(space, this.W.knob, function (S) {
      var v = def.value(S);
      return M4.mulAll(bm, M4.translation(0, 0, 0.008), M4.rotationX(-Math.PI / 2), M4.rotationY(-(v * 4.6 - 2.3)));
    }, { color: [1, 1, 1], spec: 0.35, shine: 40 }, def.id);
    return ctl;
  };

  /* an instrument: bezel + illuminated dial face + live needle */
  Cockpit.prototype.mkGauge = function (space, bm, def) {
    var r = def.r || 0.075;
    this.add(space, 'plain', G.xf(G.merge([
      G.at(G.cyl(r + 0.012, r + 0.012, 0.030, 18, { col: [0.16, 0.16, 0.15] }), 0, 0, 0.015),
      G.at(G.ring(r + 0.002, r + 0.014, 18, { col: [0.42, 0.43, 0.41] }), 0, 0.030, 0)
    ]), M4.multiply(bm, M4.rotationX(-Math.PI / 2))));
    var tex = this.A.gauge(def.face);
    var faceMesh = this.faceMeshFor(r);
    var lit = def.lit !== false;
    this.addDyn(space, faceMesh, function () {
      return M4.multiply(bm, M4.translation(0, 0, 0.028));
    }, function (S) {
      var on = lit && S.master;
      return {
        color: on ? [1, 1, 1] : [0.42, 0.44, 0.42], tex: tex,
        emissive: on ? [0.30, 0.26, 0.12] : [0, 0, 0], spec: 0.1, shine: 20
      };
    }, def.id);
    this.addDyn(space, this.W.needle, function (S) {
      var t = MU.clamp(def.value(S), 0, 1);
      var a = MU.rad(def.a0 === undefined ? 225 : def.a0) + MU.rad((def.a1 === undefined ? -45 : def.a1) - (def.a0 === undefined ? 225 : def.a0)) * t;
      return M4.mulAll(bm, M4.translation(0, 0, 0.032), M4.rotationZ(a), M4.scaling(r / 0.075, r / 0.075, 1));
    }, { color: [1, 1, 1], spec: 0.3, shine: 30, lightMul: 1.6 }, def.id);
    /* glass */
    this.addDyn(space, faceMesh, function () {
      return M4.multiply(bm, M4.translation(0, 0, 0.036));
    }, { color: [0.5, 0.55, 0.6], alpha: 0.10, spec: 0.9, shine: 90, unlit: false }, null);
    if (def.id) {
      this.ctl({
        id: def.id, label: def.label, space: space, kind: 'info', tip: def.tip,
        hit: { m: M4.multiply(bm, M4.translation(0, 0, 0.02)), h: [r + 0.014, r + 0.014, 0.03] },
        read: def.read
      });
    }
  };

  Cockpit.prototype.faceMeshFor = function (r) {
    this._faceMeshes = this._faceMeshes || {};
    var k = r.toFixed(3);
    if (!this._faceMeshes[k]) this._faceMeshes[k] = this.R.mesh(G.quad(r * 2, r * 2));
    return this._faceMeshes[k];
  };

  /* an engraved data plate */
  Cockpit.prototype.plate = function (space, bm, text, w, h, opt) {
    var tex = this.A.label(text, { w: 256, h: 64, bg: (opt && opt.bg) || '#2f342c', color: (opt && opt.color) || '#cfcaba' });
    if (!this._plateMeshes) this._plateMeshes = {};
    var key = w.toFixed(3) + 'x' + h.toFixed(3);
    if (!this._plateMeshes[key]) this._plateMeshes[key] = this.R.mesh(G.quad(w, h));
    this.addDyn(space, this._plateMeshes[key], function () { return bm; },
      { color: [1, 1, 1], tex: tex, spec: 0.14, shine: 24 }, null);
  };

  /* ==================================================== hull structure ==== */
  Cockpit.prototype.buildHullShell = function () {
    var I = D.interior;
    var x = I.wallX, fy = I.floorY, cy = I.ceilY;
    var zr = -1.40, zf = 2.36;

    /* floor pan + ribs + hatch */
    this.add('hull', 'metal', G.boxSpan(-x, fy - 0.10, zr, x, fy, zf, { col: DARK, uvWorld: true }));
    var ribs = [];
    for (var z = zr + 0.45; z < zf - 0.2; z += 0.62) {
      ribs.push(G.boxAt(0, fy + 0.012, z, 2 * x - 0.02, 0.024, 0.07, { col: [0.30, 0.31, 0.28] }));
    }
    ribs.push(G.at(G.ring(0.17, 0.22, 14, { col: [0.34, 0.35, 0.32] }), 0.0, fy + 0.008, 0.55));
    ribs.push(G.at(G.torus(0.05, 0.012, 10, 6, { col: [0.4, 0.4, 0.38] }), 0.0, fy + 0.03, 0.55));
    this.add('hull', 'plain', G.merge(ribs));

    /* side walls: olive below the shoulder line, cream above */
    this.add('hull', 'rivet', G.boxSpan(x, fy, zr, x + 0.07, 1.24, zf, { col: OLIVE, uvWorld: true }));
    this.add('hull', 'rivet', G.boxSpan(x, 1.24, zr, x + 0.07, cy + 0.02, zf, { col: CREAM, uvWorld: true }));
    this.add('hull', 'rivet', G.boxSpan(-x - 0.07, fy, zr, -x, 1.24, zf, { col: OLIVE, uvWorld: true }));
    this.add('hull', 'rivet', G.boxSpan(-x - 0.07, 1.24, zr, -x, cy + 0.02, zf, { col: CREAM, uvWorld: true }));

    /* engine firewall */
    this.add('hull', 'panel', G.boxSpan(-x, fy, zr - 0.07, x, cy + 0.02, zr, { col: OLIVE, uvWorld: true }));
    var fw = [];
    /* louvred inspection grille */
    for (var l = 0; l < 7; l++) {
      fw.push(G.xf(G.box(0.78, 0.045, 0.02, { col: [0.18, 0.19, 0.17] }),
        M4.mulAll(M4.translation(0, 0.92 + l * 0.058, zr + 0.02), M4.rotationX(-0.5))));
    }
    fw.push(G.boxAt(0, 1.10, zr + 0.035, 0.86, 0.46, 0.03, { col: [0.30, 0.32, 0.28] }));
    /* hot exhaust manifold pipe across the firewall */
    fw.push(G.xf(G.cyl(0.055, 0.055, 1.7, 12, { col: [0.26, 0.22, 0.19] }),
      M4.mulAll(M4.translation(0, 0.74, zr + 0.09), M4.rotationZ(Math.PI / 2))));
    /* oil and fuel lines */
    fw.push(G.pipe([[-0.9, 0.66, zr + 0.05], [-0.5, 0.70, zr + 0.05], [-0.5, 1.42, zr + 0.05], [0.2, 1.46, zr + 0.05]], 0.016, 7, { col: COPPER }));
    fw.push(G.pipe([[0.85, 0.64, zr + 0.05], [0.85, 1.30, zr + 0.05], [0.45, 1.36, zr + 0.05]], 0.013, 7, { col: [0.30, 0.30, 0.28] }));
    /* tool clips: crowbar and sledgehammer */
    fw.push(G.xf(G.cyl(0.016, 0.016, 0.95, 8, { col: [0.30, 0.30, 0.29] }),
      M4.mulAll(M4.translation(-0.35, 1.62, zr + 0.06), M4.rotationZ(Math.PI / 2))));
    fw.push(G.xf(G.cyl(0.018, 0.018, 0.7, 8, { col: [0.40, 0.30, 0.20] }),
      M4.mulAll(M4.translation(0.45, 1.62, zr + 0.10), M4.rotationZ(Math.PI / 2))));
    fw.push(G.boxAt(0.80, 1.62, zr + 0.10, 0.16, 0.09, 0.09, { col: [0.35, 0.35, 0.33] }));
    this.add('hull', 'plain', G.merge(fw));

    /* ceiling with the turret ring opening and the driver's hatch opening */
    var czc = (zr + zf) / 2, clen = zf - zr;
    var ceil = G.wall(2 * x, clen, 0.06, [
      { x: 0, y: D.turret.cz - czc, w: 1.38, h: 1.38 },
      { x: 0.60, y: 1.62 - czc, w: 0.62, h: 0.62 }
    ], { col: CREAM, uvWorld: true });
    this.add('hull', 'rivet', G.xf(ceil, M4.multiply(M4.translation(0, cy + 0.03, czc), M4.rotationX(Math.PI / 2))));

    /* front lower plate and the sloped glacis plate with vision openings */
    this.add('hull', 'rivet', G.boxSpan(-x, fy, zf - 0.06, x, 0.98, zf, { col: OLIVE, uvWorld: true }));
    var gl = board(0, 1.365, 2.035, Math.PI, 0.649);
    this.glacisBoard = gl;
    var glW = G.wall(2 * x, 1.10, 0.05, [
      { x: -0.60, y: 0.235, w: 0.46, h: 0.17 },     /* driver's vision slit  */
      { x: 0.62, y: -0.10, w: 0.30, h: 0.30 }      /* bow MG ball opening   */
    ], { col: CREAM, uvWorld: true });
    this.add('hull', 'rivet', G.xf(glW, gl));
    /* slit surround + armoured shutter */
    this.add('hull', 'plain', G.xf(G.merge([
      G.at(G.box(0.54, 0.05, 0.05, { col: STEEL }), 0, 0.335, 0.02),
      G.at(G.box(0.54, 0.05, 0.05, { col: STEEL }), 0, 0.135, 0.02),
      G.at(G.box(0.05, 0.22, 0.05, { col: STEEL }), -0.255, 0.235, 0.02),
      G.at(G.box(0.05, 0.22, 0.05, { col: STEEL }), 0.255, 0.235, 0.02)
    ]), on(gl, -0.60, 0, 0)));

    /* turret ring collar seen from inside the hull */
    this.add('hull', 'metal', G.xf(invert(G.cyl(1.00, 1.00, 0.20, 24, { caps: false, col: [0.46, 0.47, 0.44] })),
      M4.translation(0, cy - 0.08, D.turret.cz)));
    this.add('hull', 'plain', G.at(G.torus(1.005, 0.022, 26, 6, { col: [0.52, 0.53, 0.50] }), 0, cy - 0.18, D.turret.cz));

    /* wall furniture ---------------------------------------------------- */
    var stuff = [];
    /* left wall (driver side): batteries, first-aid box, canvas bag */
    stuff.push(G.boxAt(x - 0.14, fy + 0.16, 0.62, 0.26, 0.32, 0.52, { col: [0.22, 0.23, 0.22] }));
    stuff.push(G.boxAt(x - 0.10, 1.46, 0.30, 0.16, 0.20, 0.26, { col: [0.86, 0.86, 0.84] }));
    stuff.push(G.xf(G.quad(0.14, 0.14), M4.multiply(M4.translation(x - 0.19, 1.46, 0.30), M4.rotationY(-Math.PI / 2))));
    /* right wall: ammunition stowage, water can, MG boxes */
    stuff.push(G.boxAt(-x + 0.16, fy + 0.20, 1.30, 0.30, 0.40, 0.80, { col: [0.30, 0.32, 0.28] }));
    stuff.push(G.boxAt(-x + 0.13, fy + 0.22, 0.10, 0.24, 0.44, 0.30, { col: [0.34, 0.36, 0.30] }));
    stuff.push(G.boxAt(-x + 0.12, 1.34, -0.55, 0.22, 0.30, 0.36, { col: [0.30, 0.32, 0.28] }));
    /* electrical conduit along the wall/ceiling junction */
    stuff.push(G.pipe([[x - 0.05, 1.70, zr + 0.1], [x - 0.05, 1.70, 1.9], [0.7, 1.72, 2.2]], 0.018, 6, { col: [0.16, 0.16, 0.16] }));
    stuff.push(G.pipe([[-x + 0.05, 1.70, zr + 0.1], [-x + 0.05, 1.70, 2.1]], 0.018, 6, { col: [0.16, 0.16, 0.16] }));
    /* hull ammunition: four ready rounds clipped to the right wall */
    for (var r4 = 0; r4 < 4; r4++) {
      stuff.push(G.xf(G.cyl(0.052, 0.052, 0.60, 12, { col: [0.30, 0.32, 0.28] }),
        M4.mulAll(M4.translation(-x + 0.10, fy + 0.52, -0.10 + r4 * 0.135), M4.rotationZ(0))));
    }
    this.add('hull', 'plain', G.merge(stuff));
    this.add('hull', 'fabric', G.merge([
      G.boxAt(x - 0.13, 1.10, -0.95, 0.20, 0.34, 0.28, { col: CANVAS }),
      G.boxAt(-x + 0.13, 1.06, 1.95, 0.18, 0.26, 0.22, { col: CANVAS })
    ]));
  };

  /* ================================================== driver's station ==== */
  Cockpit.prototype.buildDriver = function () {
    var self = this, sim = this.sim, W = this.W;
    var I = D.interior, fy = I.floorY;

    /* --- seat ---------------------------------------------------------- */
    this.add('hull', 'plain', G.merge([
      G.at(G.box(0.44, 0.07, 0.42, { col: LEATHER }), 0.60, 1.00, 1.30),
      G.xf(G.box(0.44, 0.40, 0.07, { col: LEATHER }), M4.mulAll(M4.translation(0.60, 1.20, 1.10), M4.rotationX(0.22))),
      G.at(G.cyl(0.05, 0.05, 0.42, 10, { col: [0.36, 0.37, 0.35] }), 0.60, fy + 0.21, 1.30),
      G.at(G.box(0.50, 0.04, 0.34, { col: [0.34, 0.35, 0.33] }), 0.60, fy + 0.02, 1.30)
    ]));

    /* --- instrument board (kept low so it never blocks the vision slit) -- */
    var bd = board(0.58, 1.22, 2.02, Math.PI, 0.50);
    this.add('hull', 'panel', G.xf(G.box(0.94, 0.34, 0.03, { col: [0.28, 0.30, 0.27] }), M4.multiply(bd, M4.translation(0, 0, -0.015))));
    this.add('hull', 'plain', G.xf(G.merge([
      G.at(G.box(0.96, 0.03, 0.05, { col: [0.34, 0.36, 0.32] }), 0, 0.175, 0),
      G.at(G.box(0.96, 0.03, 0.05, { col: [0.34, 0.36, 0.32] }), 0, -0.175, 0)
    ]), bd));

    this.mkGauge('hull', on(bd, -0.30, 0.01, 0.0), {
      id: 'gaugeSpeed', label: 'SPEEDOMETER', r: 0.072,
      face: { title: 'KM/H', unit: 'speed', min: 0, max: 50, ticks: 5, redFrom: 44, startAngle: 225, endAngle: -45 },
      value: function (S) { return MU.clamp(Math.abs(S.speed) * 3.6 / 50, 0, 1); },
      read: function (S) { return (Math.abs(S.speed) * 3.6).toFixed(1) + ' km/h'; },
      a0: 225, a1: -45
    });
    this.mkGauge('hull', on(bd, -0.10, 0.01, 0.0), {
      id: 'gaugeRpm', label: 'TACHOMETER', r: 0.072,
      face: { title: 'RPM', unit: 'x100', min: 0, max: 30, ticks: 6, redFrom: 24, startAngle: 225, endAngle: -45 },
      value: function (S) { return MU.clamp(S.engine.rpm / 3000, 0, 1); },
      read: function (S) { return Math.round(S.engine.rpm) + ' rpm'; },
      a0: 225, a1: -45
    });
    this.mkGauge('hull', on(bd, 0.10, 0.01, 0.0), {
      id: 'gaugeOil', label: 'OIL PRESSURE', r: 0.072,
      face: { title: 'OIL', unit: 'psi', min: 0, max: 100, ticks: 5, redFrom: 92, startAngle: 225, endAngle: -45 },
      value: function (S) { return MU.clamp(S.engine.oil / 100, 0, 1); },
      read: function (S) { return Math.round(S.engine.oil) + ' psi'; },
      a0: 225, a1: -45
    });
    this.mkGauge('hull', on(bd, 0.30, 0.01, 0.0), {
      id: 'gaugeTemp', label: 'COOLANT TEMP', r: 0.072,
      face: { title: 'TEMP', unit: 'deg C', min: 20, max: 140, ticks: 6, redFrom: 115, startAngle: 225, endAngle: -45 },
      value: function (S) { return MU.clamp((S.engine.temp - 20) / 120, 0, 1); },
      read: function (S) { return Math.round(S.engine.temp) + ' \u00b0C'; },
      a0: 225, a1: -45
    });
    this.plate('hull', on(bd, -0.30, -0.145, 0.017), 'ROAD SPEED', 0.15, 0.036);
    this.plate('hull', on(bd, -0.10, -0.145, 0.017), 'ENGINE', 0.15, 0.036);
    this.plate('hull', on(bd, 0.10, -0.145, 0.017), 'LUBRICANT', 0.15, 0.036);
    this.plate('hull', on(bd, 0.30, -0.145, 0.017), 'COOLANT', 0.15, 0.036);

    /* warning lamps on a strip above the gauges */
    var lampDefs = [
      { id: 'lampOil', t: 'OIL', c: '#c02020', on: function (S) { return S.master && S.engine.oil < 15; } },
      { id: 'lampGen', t: 'GEN', c: '#c07a10', on: function (S) { return S.master && !S.engine.running; } },
      { id: 'lampTemp', t: 'TEMP', c: '#c02020', on: function (S) { return S.master && S.engine.temp > 112; } },
      { id: 'lampFire', t: 'FIRE', c: '#e03010', on: function (S) { return S.fire > 0; } }
    ];
    for (var li = 0; li < lampDefs.length; li++) {
      (function (d, i) {
        var pos = on(bd, -0.33 + i * 0.14, 0.145, 0.016);
        var tex = self.A.warn(d.t, d.c);
        self.add('hull', 'plain', G.xf(G.box(0.062, 0.028, 0.014, { col: [0.16, 0.16, 0.15] }), M4.multiply(pos, M4.translation(0, 0, -0.008))));
        self.addDyn('hull', W.warnLamp, function () { return pos; }, function (S) {
          var lit = d.on(S);
          return {
            color: lit ? [1, 1, 1] : [0.30, 0.30, 0.29], tex: tex, unlit: lit,
            emissive: lit ? [0.9, 0.5, 0.2] : [0, 0, 0]
          };
        }, null);
      })(lampDefs[li], li);
    }
    /* fuel gauge on its own little bracket to the right of the board */
    this.mkGauge('hull', on(board(0.09, 1.20, 2.04, Math.PI, 0.50), 0, 0, 0), {
      id: 'gaugeFuel', label: 'FUEL CONTENTS', r: 0.058,
      face: { title: 'FUEL', unit: 'percent', min: 0, max: 100, ticks: 4, redFrom: 200, startAngle: 200, endAngle: -20 },
      value: function (S) { return MU.clamp(S.fuel, 0, 1); },
      read: function (S) { return Math.round(S.fuel * 100) + ' %  (' + Math.round(S.fuel * 450) + ' L)'; },
      a0: 200, a1: -20
    });

    /* --- electrical switch box on the left wall ------------------------ */
    /* placed slightly aft of the steering levers so nothing overlaps it */
    var bs = board(I.wallX - 0.02, 1.26, 1.10, -Math.PI / 2, 0);
    this.add('hull', 'panel', G.xf(G.box(0.52, 0.30, 0.05, { col: [0.26, 0.28, 0.25] }), M4.multiply(bs, M4.translation(0, 0, -0.025))));
    this.mkToggle('hull', 'plain', on(bs, -0.18, 0.08, 0.0), {
      id: 'master', label: 'MASTER BATTERY SWITCH', keys: 'M',
      tip: 'Main electrical bus. Nothing works without it.',
      state: function (S) { return S.master; },
      read: function (S) { return S.master ? 'ON' : 'OFF'; },
      act: function () { sim.toggle('master'); }
    });
    this.mkToggle('hull', 'plain', on(bs, -0.06, 0.08, 0.0), {
      id: 'fuelPump', label: 'FUEL PUMP', keys: 'F',
      tip: 'Pressurises the fuel line. Required before starting.',
      state: function (S) { return S.fuelPump; },
      read: function (S) { return S.fuelPump ? 'ON' : 'OFF'; },
      act: function () { sim.toggle('fuelPump'); }
    });
    this.mkToggle('hull', 'plain', on(bs, 0.06, 0.08, 0.0), {
      id: 'magneto', label: 'IGNITION / MAGNETO', keys: 'I',
      tip: 'Ignition circuit. Switch off to shut the engine down.',
      state: function (S) { return S.magneto; },
      read: function (S) { return S.magneto ? 'ON' : 'OFF'; },
      act: function () { sim.toggle('magneto'); }
    });
    this.mkToggle('hull', 'plain', on(bs, 0.18, 0.08, 0.0), {
      id: 'lights', label: 'HEAD LAMPS', keys: 'L',
      state: function (S) { return S.lights; },
      read: function (S) { return S.lights ? 'ON' : 'OFF'; },
      act: function () { sim.toggle('lights'); }
    });
    this.mkToggle('hull', 'plain', on(bs, -0.18, -0.06, 0.0), {
      id: 'domeLight', label: 'COMPARTMENT LAMP', keys: 'K',
      state: function (S) { return S.domeLight; },
      read: function (S) { return S.domeLight ? 'ON' : 'OFF'; },
      act: function () { sim.toggle('domeLight'); }
    });
    this.mkToggle('hull', 'plain', on(bs, -0.06, -0.06, 0.0), {
      id: 'ventilator', label: 'VENTILATOR BLOWER', keys: 'V',
      tip: 'Clears propellant fumes after firing.',
      state: function (S) { return S.ventilator; },
      read: function (S) { return S.ventilator ? 'ON' : 'OFF'; },
      act: function () { sim.toggle('ventilator'); }
    });
    this.mkButton('hull', 'plain', on(bs, 0.10, -0.06, 0.0), {
      id: 'starter', label: 'STARTER BUTTON', keys: 'G  (hold)',
      tip: 'Hold to crank the engine. Needs master + fuel pump + ignition.',
      read: function (S) { return S.engine.starting ? 'CRANKING' : (S.engine.running ? 'ENGINE RUNNING' : 'READY'); },
      down: function () { sim.starterDown(); },
      up: function () { sim.starterUp(); }
    });
    this.plate('hull', on(bs, 0.10, -0.135, 0.028), 'START', 0.10, 0.030, { bg: '#3c2018', color: '#e8d8c0' });
    this.plate('hull', on(bs, 0, 0.16, 0.028), 'ELECTRICAL DISTRIBUTION', 0.34, 0.042);

    /* --- steering levers ---------------------------------------------- */
    var levers = [
      { id: 'steerL', x: 0.96, label: 'LEFT STEERING LEVER', key: 'A', side: 'L' },
      { id: 'steerR', x: 0.28, label: 'RIGHT STEERING LEVER', key: 'D', side: 'R' }
    ];
    for (var lv = 0; lv < 2; lv++) {
      (function (d) {
        var piv = [d.x, 0.78, 1.96];
        self.add('hull', 'plain', G.merge([
          G.at(G.box(0.10, 0.10, 0.16, { col: [0.34, 0.35, 0.33] }), piv[0], piv[1] - 0.06, piv[2]),
          G.at(G.cyl(0.03, 0.03, 0.14, 10, { col: [0.4, 0.4, 0.38] }), piv[0], piv[1] - 0.14, piv[2])
        ]));
        self.ctl({
          id: d.id, label: d.label, space: 'hull', kind: 'hold', keys: d.key,
          tip: 'Pull to brake that track: the tank pivots towards it.',
          hit: { m: M4.translation(piv[0], piv[1] + 0.44, piv[2] - 0.22), h: [0.10, 0.26, 0.17] },
          read: function (S) { return Math.round((d.side === 'L' ? S.brakeL : S.brakeR) * 100) + ' %'; },
          down: function () { sim.leverDown(d.side); },
          up: function () { sim.leverUp(d.side); }
        });
        self.addDyn('hull', W.lever, function (S) {
          var pull = d.side === 'L' ? S.brakeL : S.brakeR;
          return M4.mulAll(M4.translation(piv[0], piv[1], piv[2]), M4.rotationX(-0.42 - pull * 0.55));
        }, { color: [1, 1, 1], spec: 0.25, shine: 28 }, d.id);
      })(levers[lv]);
    }

    /* --- pedals -------------------------------------------------------- */
    var pedals = [
      { id: 'pedalThrottle', x: 0.40, label: 'ACCELERATOR PEDAL', keys: 'W', v: function (S) { return S.throttle; } },
      { id: 'pedalBrake', x: 0.82, label: 'FOOT BRAKE', keys: 'S', v: function (S) { return S.footBrake; } }
    ];
    for (var pi = 0; pi < 2; pi++) {
      (function (d) {
        var base = M4.mulAll(M4.translation(d.x, fy + 0.02, 2.24), M4.rotationX(-0.62));
        self.add('hull', 'plain', G.xf(G.box(0.13, 0.04, 0.05, { col: [0.3, 0.3, 0.29] }), M4.translation(d.x, fy + 0.02, 2.28)));
        self.ctl({
          id: d.id, label: d.label, space: 'hull', kind: 'hold', keys: d.keys,
          tip: 'Hold to press the pedal.',
          hit: { m: M4.multiply(base, M4.translation(0, 0.10, 0.02)), h: [0.09, 0.13, 0.07] },
          read: function (S) { return Math.round(d.v(S) * 100) + ' %'; },
          down: function () { sim.pedalDown(d.id); },
          up: function () { sim.pedalUp(d.id); }
        });
        self.addDyn('hull', W.pedal, function (S) {
          return M4.multiply(base, M4.rotationX(-d.v(S) * 0.42));
        }, { color: [1, 1, 1], spec: 0.2 }, d.id);
      })(pedals[pi]);
    }

    /* --- gear lever with its gate plate -------------------------------- */
    var gbase = [0.34, 0.72, 1.72];
    this.add('hull', 'plain', G.merge([
      G.at(G.cyl(0.07, 0.06, 0.10, 12, { col: [0.32, 0.33, 0.31] }), gbase[0], gbase[1], gbase[2]),
      G.at(G.box(0.20, 0.02, 0.26, { col: [0.26, 0.27, 0.25] }), gbase[0], gbase[1] + 0.05, gbase[2])
    ]));
    this.ctl({
      id: 'gear', label: 'GEAR SELECTOR', space: 'hull', kind: 'drag', keys: '1-4 / 0 / R',
      tip: 'Drag up or down (or use the number keys) to select a gear.',
      hit: { m: M4.translation(gbase[0], gbase[1] + 0.34, gbase[2] - 0.04), h: [0.11, 0.22, 0.16] },
      read: function (S) { return sim.gearName(); },
      act: function () { sim.shift(1); },
      drag: function (S, dx, dy) { sim.dragGear(dy); }
    });
    this.addDyn('hull', W.gearLever, function (S) {
      var g = S.gear;             /* -1 = reverse, 0 = neutral, 1..4 */
      var tilt = g === 0 ? 0 : (g === -1 ? 0.30 : -0.10 - g * 0.05);
      var lean = g === 0 ? 0 : ((g === -1 || g === 1 || g === 3) ? 0.16 : -0.16);
      return M4.mulAll(M4.translation(gbase[0], gbase[1] + 0.04, gbase[2]), M4.rotationX(tilt), M4.rotationZ(lean));
    }, { color: [1, 1, 1], spec: 0.3, shine: 30 }, 'gear');
    this.plate('hull', M4.mulAll(M4.translation(gbase[0], gbase[1] + 0.061, gbase[2]), M4.rotationX(-Math.PI / 2)), 'R  N  1  2  3  4', 0.19, 0.06);

    /* --- parking brake ratchet ---------------------------------------- */
    var pb = [0.98, 0.74, 1.42];
    this.add('hull', 'plain', G.merge([
      G.at(G.box(0.07, 0.09, 0.22, { col: [0.32, 0.33, 0.31] }), pb[0], pb[1] - 0.05, pb[2]),
      G.at(G.box(0.02, 0.10, 0.20, { col: [0.5, 0.5, 0.48] }), pb[0] - 0.05, pb[1] + 0.04, pb[2])
    ]));
    this.ctl({
      id: 'parkBrake', label: 'PARKING BRAKE', space: 'hull', kind: 'toggle', keys: 'P',
      tip: 'Release before driving; set it before leaving the controls.',
      hit: { m: M4.translation(pb[0], pb[1] + 0.20, pb[2] - 0.10), h: [0.09, 0.20, 0.18] },
      read: function (S) { return S.parkBrake ? 'SET' : 'RELEASED'; },
      act: function () { sim.toggle('parkBrake'); }
    });
    this.addDyn('hull', W.lever, function (S) {
      return M4.mulAll(M4.translation(pb[0], pb[1], pb[2]), M4.rotationX(S.parkBrake ? -0.15 : -1.15), M4.scaling(1, 0.62, 1));
    }, { color: [1, 1, 1], spec: 0.3 }, 'parkBrake');

    /* --- driver's periscope + hatch handle -----------------------------
       mounted off to the driver's left so the vision slit stays clear     */
    var per = [0.98, 1.62, 1.76];
    this.add('hull', 'plain', G.merge([
      G.at(G.box(0.16, 0.22, 0.30, { col: [0.30, 0.32, 0.29] }), per[0], per[1], per[2]),
      G.at(G.box(0.05, 0.05, 0.26, { col: [0.10, 0.10, 0.10] }), per[0] - 0.10, per[1] - 0.10, per[2]),
      G.at(G.box(0.03, 0.10, 0.28, { col: [0.08, 0.08, 0.08] }), per[0] - 0.09, per[1] - 0.02, per[2])
    ]));
    this.ctl({
      id: 'periscopeDrv', label: "DRIVER'S PERISCOPE", space: 'hull', kind: 'view', keys: '2',
      tip: 'Look through the periscope for a protected view forward.',
      hit: { m: M4.translation(per[0] - 0.06, per[1] - 0.04, per[2]), h: [0.13, 0.14, 0.18] },
      read: function (S) { return S.view === 'periscope' ? 'IN USE' : 'STOWED'; },
      act: function () { sim.useView('periscope', 'driver'); }
    });
    this.ctl({
      id: 'hatchDrv', label: "DRIVER'S HATCH", space: 'hull', kind: 'toggle', keys: 'H',
      tip: 'Open for air and a wider view; close before shooting starts.',
      hit: { m: M4.translation(0.60, 1.70, 1.62), h: [0.16, 0.10, 0.16] },
      read: function (S) { return S.hatchDrv > 0.5 ? 'OPEN' : 'CLOSED'; },
      act: function () { sim.toggle('hatchDrv'); }
    });
    this.addDyn('hull', W.lever, function (S) {
      return M4.mulAll(M4.translation(0.86, 1.66, 1.62), M4.rotationZ(-1.2 + (S.hatchDrv > 0.5 ? 1.0 : 0)), M4.scaling(1, 0.34, 1));
    }, { color: [1, 1, 1], spec: 0.3 }, 'hatchDrv');
    /* the hatch lid itself, hinged at its rear edge */
    this.addDyn('hull', W.hatchLid, function (S) {
      return M4.mulAll(M4.translation(0.60, D.hull.roof + 0.01, 1.62 - 0.30), M4.rotationX(-S.hatchDrv * 1.9));
    }, { color: [1, 1, 1], tex: this.A.get('metal'), uvScale: [2, 2], spec: 0.2 }, 'hatchDrv');

    /* --- bow machine gun ---------------------------------------------- */
    var mg = [-0.62, 1.36, 2.10];
    this.add('hull', 'plain', G.merge([
      G.at(G.box(0.16, 0.17, 0.44, { col: GUNMETAL }), mg[0], mg[1], mg[2] + 0.10),
      G.at(G.cyl(0.10, 0.10, 0.24, 12, { col: [0.36, 0.37, 0.36] }), mg[0], mg[1], mg[2] + 0.34),
      G.xf(G.box(0.05, 0.16, 0.07, { col: [0.16, 0.14, 0.12] }), M4.mulAll(M4.translation(mg[0], mg[1] - 0.14, mg[2] - 0.10), M4.rotationX(0.3))),
      G.at(G.box(0.20, 0.16, 0.26, { col: [0.30, 0.32, 0.28] }), mg[0] - 0.16, mg[1] - 0.24, mg[2] - 0.10),
      G.at(G.box(0.10, 0.06, 0.30, { col: [0.5, 0.45, 0.2] }), mg[0] - 0.04, mg[1] + 0.02, mg[2] - 0.02)
    ]));
    this.ctl({
      id: 'bowMg', label: 'BOW MACHINE GUN', space: 'hull', kind: 'button', keys: 'X',
      tip: 'Hull machine gun. Hold to fire.',
      hit: { m: M4.translation(mg[0], mg[1] - 0.13, mg[2] - 0.10), h: [0.09, 0.12, 0.12] },
      read: function (S) { return S.mgAmmo + ' rounds'; },
      down: function () { sim.mgDown('bow'); },
      up: function () { sim.mgUp('bow'); }
    });

    /* --- fire extinguisher -------------------------------------------- */
    var ex = [-I.wallX + 0.10, 1.02, 1.70];
    this.add('hull', 'plain', G.merge([
      G.at(G.box(0.04, 0.10, 0.10, { col: [0.4, 0.4, 0.38] }), ex[0] - 0.06, ex[1], ex[2])
    ]));
    this.addDyn('hull', this.R.mesh(G.merge([
      G.at(G.cyl(0.062, 0.062, 0.34, 14, { col: RED }), 0, 0, 0),
      G.at(G.dome(0.062, 14, 5, { col: RED }), 0, 0.17, 0),
      G.at(G.cyl(0.018, 0.018, 0.08, 8, { col: [0.5, 0.5, 0.48] }), 0, 0.23, 0),
      G.at(G.box(0.02, 0.03, 0.10, { col: [0.6, 0.6, 0.58] }), 0, 0.26, 0.05)
    ])), function (S) {
      return M4.translation(ex[0], ex[1] + (S.extinguisherUsed ? -0.02 : 0), ex[2]);
    }, { color: [1, 1, 1], spec: 0.3, shine: 30 }, 'extinguisher');
    this.ctl({
      id: 'extinguisher', label: 'FIRE EXTINGUISHER', space: 'hull', kind: 'button', keys: 'F9',
      tip: 'Discharge into the engine bay to kill a fire and drop temperature.',
      hit: { m: M4.translation(ex[0], ex[1], ex[2]), h: [0.09, 0.22, 0.09] },
      read: function (S) { return S.extinguisherUsed ? 'DISCHARGED' : 'CHARGED'; },
      act: function () { sim.useExtinguisher(); }
    });

    /* --- compass with a live rotating card ----------------------------- */
    var cp = [0.60, 1.52, 1.80];
    this.add('hull', 'plain', G.merge([
      G.at(G.cyl(0.058, 0.058, 0.05, 14, { col: [0.22, 0.23, 0.22] }), cp[0], cp[1], cp[2])
    ]));
    var compassTex = this.A.custom('compassCard', 256, 256, function (c, w, h) {
      c.fillStyle = '#15171a'; c.fillRect(0, 0, w, h);
      c.translate(w / 2, h / 2);
      c.strokeStyle = '#cfcaba'; c.fillStyle = '#cfcaba';
      c.font = 'bold 30px Arial'; c.textAlign = 'center'; c.textBaseline = 'middle';
      var labels = ['N', 'E', 'S', 'W'];
      for (var i = 0; i < 4; i++) {
        c.save(); c.rotate(i * Math.PI / 2);
        c.fillStyle = i === 0 ? '#d04030' : '#cfcaba';
        c.fillText(labels[i], 0, -w * 0.34);
        c.restore();
      }
      for (var k = 0; k < 36; k++) {
        c.save(); c.rotate(k * Math.PI / 18);
        c.lineWidth = (k % 9 === 0) ? 3 : 1;
        c.beginPath(); c.moveTo(0, -w * 0.44); c.lineTo(0, -w * (k % 3 === 0 ? 0.40 : 0.42)); c.stroke();
        c.restore();
      }
    }, { wrap: 'clamp' });
    this.addDyn('hull', this.faceMeshFor(0.05), function (S) {
      return M4.mulAll(M4.translation(cp[0], cp[1] + 0.026, cp[2]), M4.rotationX(-Math.PI / 2), M4.rotationZ(S.hullYaw));
    }, function (S) {
      return { color: S.master ? [1, 1, 1] : [0.5, 0.5, 0.5], tex: compassTex, emissive: S.master ? [0.12, 0.10, 0.05] : [0, 0, 0] };
    }, 'compass');
    this.ctl({
      id: 'compass', label: 'COMPASS', space: 'hull', kind: 'info',
      hit: { m: M4.translation(cp[0], cp[1] + 0.03, cp[2]), h: [0.065, 0.04, 0.065] },
      read: function (S) {
        var deg = (MU.deg(-S.hullYaw) + 360) % 360;
        return Math.round(deg) + '\u00b0';
      }
    });

    /* --- ceiling lamp + ventilator ------------------------------------- */
    this.addDyn('hull', W.lamp, function () { return M4.translation(-0.55, D.interior.ceilY - 0.04, 0.85); },
      function (S) {
        return {
          color: [1, 1, 1], unlit: S.domeLight && S.master,
          emissive: (S.domeLight && S.master) ? [1.0, 0.86, 0.6] : [0, 0, 0], spec: 0.2
        };
      }, 'domeLight');
    this.add('hull', 'plain', G.merge([
      G.at(G.cyl(0.10, 0.10, 0.05, 14, { col: [0.36, 0.37, 0.35] }), 0.0, D.interior.ceilY - 0.05, 1.05),
      G.at(G.ring(0.10, 0.13, 14, { col: [0.32, 0.33, 0.31] }), 0.0, D.interior.ceilY - 0.075, 1.05)
    ]));
    this.addDyn('hull', W.fan, function (S) {
      return M4.mulAll(M4.translation(0.0, D.interior.ceilY - 0.065, 1.05), M4.rotationY(S.fanAngle));
    }, { color: [1, 1, 1], spec: 0.3, doubleSided: true }, 'ventilator');
  };

  /* ================================================== turret structure ==== */
  Cockpit.prototype.buildTurretShell = function () {
    var tu = D.turret;
    var wallR = 1.02, wallTop = tu.h - 0.02;

    /* turret wall, seen from inside */
    this.add('turret', 'rivet', G.at(invert(G.cyl(wallR, wallR, wallTop + 0.10, 26, { caps: false, col: CREAM, uvScale: [6, 1] })), 0, (wallTop - 0.10) / 2, 0));
    /* lower band in olive */
    this.add('turret', 'plain', G.at(invert(G.cyl(wallR - 0.001, wallR - 0.001, 0.26, 26, { caps: false, col: OLIVE })), 0, -0.06, 0));
    /* roof with the two hatch openings */
    var roof = G.wall(2.10, 2.10, 0.05, [
      { x: -0.30, y: -0.60, w: 0.58, h: 0.58 },
      { x: 0.46, y: -0.16, w: 0.56, h: 0.56 }
    ], { col: CREAM, uvWorld: true });
    this.add('turret', 'rivet', G.xf(roof, M4.multiply(M4.translation(0, wallTop + 0.03, 0), M4.rotationX(Math.PI / 2))));
    /* rear bustle wall (radio shelf) */
    this.add('turret', 'panel', G.merge([
      G.boxAt(0, 0.30, -0.98, 1.30, 0.62, 0.06, { col: OLIVE, uvWorld: true }),
      G.boxAt(0, -0.02, -0.80, 1.30, 0.06, 0.40, { col: [0.34, 0.36, 0.32], uvWorld: true })
    ]));
    /* commander's cupola: six wall segments leaving six vision slots */
    var cup = [];
    var cx = -0.30, cz = -0.60, cr = 0.30, cy0 = wallTop, ch = 0.24;
    for (var v = 0; v < 6; v++) {
      var a0 = v / 6 * Math.PI * 2 + 0.16;
      cup.push(G.at(invert(G.cyl(cr, cr, ch, 6, { caps: false, phi0: a0, phiLen: Math.PI * 2 / 6 - 0.32, col: CREAM })), cx, cy0 + ch / 2, cz));
    }
    /* cupola roof ring with the hatch opening */
    cup.push(G.xf(G.wall(0.68, 0.68, 0.04, [{ x: 0, y: 0, w: 0.42, h: 0.42 }], { col: CREAM }),
      M4.multiply(M4.translation(cx, cy0 + ch, cz), M4.rotationX(Math.PI / 2))));
    cup.push(G.at(G.torus(cr, 0.018, 16, 6, { col: [0.5, 0.5, 0.48] }), cx, cy0 + 0.01, cz));
    this.add('turret', 'plain', G.merge(cup));

    /* ring gear at the bottom of the turret */
    this.add('turret', 'metal', G.at(invert(G.cyl(1.00, 1.00, 0.16, 24, { caps: false, col: [0.44, 0.45, 0.42] })), 0, -0.10, 0));
    var teeth = [];
    for (var t = 0; t < 40; t++) {
      var ta = t / 40 * Math.PI * 2;
      teeth.push(G.xf(G.box(0.035, 0.05, 0.03, { col: [0.40, 0.41, 0.38] }),
        M4.mulAll(M4.rotationY(ta), M4.translation(0, -0.16, 0.985))));
    }
    this.add('turret', 'plain', G.merge(teeth));

    /* crew seats hanging from the ring */
    var seats = [
      [-0.52, -0.28, 0.02], [0.56, -0.26, -0.12], [-0.30, -0.14, -0.62]
    ];
    var seatG = [];
    for (var s = 0; s < seats.length; s++) {
      var p = seats[s];
      seatG.push(G.at(G.box(0.36, 0.06, 0.34, { col: LEATHER }), p[0], p[1], p[2]));
      seatG.push(G.xf(G.box(0.34, 0.32, 0.06, { col: LEATHER }), M4.mulAll(M4.translation(p[0], p[1] + 0.18, p[2] - 0.16), M4.rotationX(0.20))));
      seatG.push(G.at(G.cyl(0.035, 0.035, 0.30, 8, { col: [0.36, 0.37, 0.35] }), p[0], p[1] - 0.16, p[2]));
    }
    this.add('turret', 'plain', G.merge(seatG));

    /* wall furniture: fuse box, canvas bag, water bottle, first-aid tin */
    this.add('turret', 'plain', G.merge([
      G.boxAt(-0.92, 0.52, -0.30, 0.10, 0.18, 0.24, { col: [0.26, 0.28, 0.25] }),
      G.at(G.cyl(0.05, 0.05, 0.18, 10, { col: [0.32, 0.34, 0.30] }), 0.88, 0.56, -0.55),
      G.boxAt(0.80, 0.60, 0.30, 0.16, 0.14, 0.20, { col: [0.86, 0.86, 0.84] })
    ]));
    this.add('turret', 'fabric', G.merge([
      G.boxAt(-0.86, 0.10, -0.62, 0.14, 0.30, 0.24, { col: CANVAS })
    ]));
  };

  /* ======================================================= the gun ======= */
  Cockpit.prototype.buildGun = function () {
    var R = this.R, W = this.W, sim = this.sim, self = this;
    var gu = D.gun;
    var gy = gu.trunY, gz = gu.trunZ;

    /* recoil guard cage (static, does not recoil) */
    var cage = [];
    cage.push(G.boxAt(0, gy + 0.30, 0.10, 0.62, 0.03, 0.03, { col: [0.80, 0.80, 0.76] }));
    cage.push(G.boxAt(0, gy - 0.24, 0.10, 0.62, 0.03, 0.03, { col: [0.80, 0.80, 0.76] }));
    cage.push(G.boxAt(-0.31, gy + 0.03, 0.10, 0.03, 0.58, 0.03, { col: [0.80, 0.80, 0.76] }));
    cage.push(G.boxAt(0.31, gy + 0.03, 0.10, 0.03, 0.58, 0.03, { col: [0.80, 0.80, 0.76] }));
    cage.push(G.boxAt(-0.31, gy + 0.03, -0.40, 0.03, 0.58, 0.03, { col: [0.80, 0.80, 0.76] }));
    cage.push(G.boxAt(0.31, gy + 0.03, -0.40, 0.03, 0.58, 0.03, { col: [0.80, 0.80, 0.76] }));
    cage.push(G.boxAt(0, gy + 0.30, -0.40, 0.62, 0.03, 0.03, { col: [0.80, 0.80, 0.76] }));
    cage.push(G.boxAt(-0.31, gy + 0.03, -0.15, 0.03, 0.03, 0.53, { col: [0.80, 0.80, 0.76] }));
    cage.push(G.boxAt(0.31, gy + 0.03, -0.15, 0.03, 0.03, 0.53, { col: [0.80, 0.80, 0.76] }));
    /* trunnion bearings */
    cage.push(G.xf(G.cyl(0.09, 0.09, 0.10, 12, { col: [0.42, 0.43, 0.41] }), M4.mulAll(M4.translation(-0.34, gy, gz), M4.rotationZ(Math.PI / 2))));
    cage.push(G.xf(G.cyl(0.09, 0.09, 0.10, 12, { col: [0.42, 0.43, 0.41] }), M4.mulAll(M4.translation(0.34, gy, gz), M4.rotationZ(Math.PI / 2))));
    this.add('turret', 'plain', G.merge(cage));

    /* the recoiling group: breech ring, block, cradle, coax MG */
    var breech = [];
    breech.push(G.xf(G.cyl(0.185, 0.185, 0.40, 16, { col: GUNMETAL }), M4.mulAll(M4.translation(0, gy, gz - 0.22), M4.rotationX(Math.PI / 2))));
    breech.push(G.xf(G.cyl(0.15, 0.15, 0.22, 16, { col: [0.28, 0.29, 0.29] }), M4.mulAll(M4.translation(0, gy, gz - 0.50), M4.rotationX(Math.PI / 2))));
    breech.push(G.boxAt(0, gy, gz - 0.30, 0.34, 0.34, 0.10, { col: [0.30, 0.31, 0.31] }));
    /* recoil cylinders above the tube */
    breech.push(G.xf(G.cyl(0.05, 0.05, 0.66, 10, { col: [0.34, 0.35, 0.34] }), M4.mulAll(M4.translation(-0.13, gy + 0.19, gz - 0.16), M4.rotationX(Math.PI / 2))));
    breech.push(G.xf(G.cyl(0.05, 0.05, 0.66, 10, { col: [0.34, 0.35, 0.34] }), M4.mulAll(M4.translation(0.13, gy + 0.19, gz - 0.16), M4.rotationX(Math.PI / 2))));
    /* coaxial machine gun */
    breech.push(G.boxAt(0.30, gy - 0.02, gz - 0.20, 0.13, 0.13, 0.52, { col: [0.22, 0.22, 0.21] }));
    breech.push(G.boxAt(0.30, gy + 0.10, gz - 0.36, 0.16, 0.10, 0.18, { col: [0.30, 0.32, 0.28] }));
    /* elevation quadrant on the left cheek */
    breech.push(G.at(G.cyl(0.08, 0.08, 0.02, 14, { col: [0.5, 0.5, 0.48] }), -0.20, gy + 0.16, gz - 0.42));
    var breechMesh = R.mesh(G.merge(breech));
    this.addDyn('turret', breechMesh, function (S) {
      return M4.translation(0, 0, -S.gun.recoil);
    }, { color: [1, 1, 1], spec: 0.28, shine: 34 }, null);

    /* breech block: slides down when open */
    var blockMesh = R.mesh(G.at(G.box(0.30, 0.28, 0.08, { col: [0.36, 0.37, 0.37] }), 0, 0, 0));
    this.addDyn('turret', blockMesh, function (S) {
      return M4.translation(0, gy - S.gun.breech * 0.26, gz - 0.36 - S.gun.recoil);
    }, { color: [1, 1, 1], spec: 0.4, shine: 46 }, 'breechLever');
    /* open chamber mouth */
    this.addDyn('turret', R.mesh(G.xf(G.disc(0.11, 14), M4.rotationX(Math.PI / 2))), function (S) {
      return M4.translation(0, gy, gz - 0.40 - S.gun.recoil);
    }, { color: [0.05, 0.05, 0.05], unlit: true }, null);

    /* the loaded round visible in the chamber */
    this.addDyn('turret', W.round, function (S) {
      return M4.mulAll(M4.translation(0, gy, gz - 0.42 - S.gun.recoil), M4.rotationX(Math.PI / 2), M4.translation(0, -0.10, 0));
    }, { color: [1, 1, 1], spec: 0.45, shine: 50 }, null,
      function (S) { return !!S.gun.loaded && S.gun.breech > 0.5; });

    /* breech operating lever */
    var lv = [0.235, gy + 0.02, gz - 0.34];
    this.ctl({
      id: 'breechLever', label: 'BREECH OPERATING LEVER', space: 'turret', kind: 'toggle', keys: 'B',
      tip: 'Open the breech to load, close it to fire.',
      hit: { m: M4.translation(lv[0] + 0.02, lv[1] + 0.14, lv[2]), h: [0.09, 0.15, 0.10] },
      read: function (S) { return S.gun.breech > 0.5 ? 'OPEN' : 'CLOSED'; },
      act: function () { sim.toggleBreech(); }
    });
    this.addDyn('turret', W.breechLever, function (S) {
      return M4.mulAll(M4.translation(lv[0], lv[1], lv[2] - S.gun.recoil), M4.rotationZ(-0.2 - S.gun.breech * 1.25));
    }, { color: [1, 1, 1], spec: 0.35, shine: 40 }, 'breechLever');

    /* spent case canvas bag under the breech */
    var bagMesh = R.mesh(G.merge([
      G.at(G.box(0.30, 0.26, 0.30, { col: CANVAS }), 0, 0, 0),
      G.at(G.torus(0.15, 0.014, 12, 5, { col: [0.4, 0.4, 0.38] }), 0, 0.13, 0)
    ]));
    this.addDyn('turret', bagMesh, function (S) {
      var f = 1 + MU.clamp(S.spentCases / 8, 0, 1) * 0.28;
      return M4.multiply(M4.translation(0.06, gy - 0.44, gz - 0.44), M4.scaling(f, f, f));
    }, { color: [1, 1, 1], tex: this.A.get('fabric'), uvScale: [2, 2], spec: 0.05 }, 'caseBag');
    this.ctl({
      id: 'caseBag', label: 'SPENT CASE BAG', space: 'turret', kind: 'button', keys: 'J',
      tip: 'Dump the brass overboard when it starts filling the floor.',
      hit: { m: M4.translation(0.06, gy - 0.44, gz - 0.44), h: [0.20, 0.18, 0.20] },
      read: function (S) { return S.spentCases + ' cases'; },
      act: function () { sim.emptyBag(); }
    });
  };

  /* ==================================================== gunner station ==== */
  Cockpit.prototype.buildGunner = function () {
    var R = this.R, W = this.W, sim = this.sim, self = this;
    var gu = D.gun;

    /* telescopic sight: tube from the wall port back to the eyepiece */
    var sightY = gu.trunY - 0.06;
    this.add('turret', 'plain', G.merge([
      G.xf(G.cyl(0.055, 0.055, 0.72, 14, { col: [0.24, 0.25, 0.24] }), M4.mulAll(M4.translation(-0.52, sightY, 0.52), M4.rotationX(Math.PI / 2))),
      G.xf(G.cyl(0.075, 0.075, 0.10, 14, { col: [0.20, 0.21, 0.20] }), M4.mulAll(M4.translation(-0.52, sightY, 0.20), M4.rotationX(Math.PI / 2))),
      G.xf(G.cyl(0.052, 0.052, 0.06, 14, { col: [0.10, 0.10, 0.10] }), M4.mulAll(M4.translation(-0.52, sightY, 0.15), M4.rotationX(Math.PI / 2))),
      /* rubber brow pad */
      G.at(G.box(0.14, 0.10, 0.05, { col: [0.10, 0.09, 0.09] }), -0.52, sightY + 0.07, 0.14),
      /* mount bracket to the gun cradle */
      G.at(G.box(0.10, 0.06, 0.16, { col: [0.34, 0.35, 0.33] }), -0.42, sightY - 0.04, 0.40)
    ]));
    this.ctl({
      id: 'sight', label: 'GUNNER TELESCOPIC SIGHT', space: 'turret', kind: 'view', keys: '3',
      tip: 'Put your eye to the sight for a magnified, ranged view.',
      hit: { m: M4.translation(-0.52, sightY + 0.02, 0.14), h: [0.10, 0.10, 0.09] },
      read: function (S) { return S.view === 'sight' ? 'IN USE' : 'STOWED'; },
      act: function () { sim.useView('sight', 'gunner'); }
    });

    /* elevation handwheel (right hand) */
    var ew = [-0.70, gu.trunY - 0.30, 0.30];
    this.add('turret', 'plain', G.merge([
      G.xf(G.cyl(0.035, 0.035, 0.10, 10, { col: [0.34, 0.35, 0.33] }), M4.mulAll(M4.translation(ew[0] - 0.06, ew[1], ew[2]), M4.rotationZ(Math.PI / 2))),
      G.boxAt(ew[0] - 0.14, ew[1], ew[2], 0.10, 0.16, 0.16, { col: [0.30, 0.32, 0.29] })
    ]));
    this.ctl({
      id: 'elevWheel', label: 'ELEVATION HANDWHEEL', space: 'turret', kind: 'drag', keys: 'Mouse / \u2191\u2193',
      tip: 'Drag up and down to elevate or depress the gun.',
      hit: { m: M4.translation(ew[0], ew[1], ew[2]), h: [0.09, 0.13, 0.13] },
      read: function (S) { return MU.deg(S.gun.pitch).toFixed(1) + '\u00b0'; },
      drag: function (S, dx, dy) { sim.dragElevation(dy); }
    });
    this.addDyn('turret', W.handwheel, function (S) {
      return M4.multiply(M4.translation(ew[0], ew[1], ew[2]), M4.rotationX(S.gun.wheelAngle));
    }, { color: [1, 1, 1], spec: 0.3, shine: 34 }, 'elevWheel');
    /* firing trigger on the elevation wheel hub */
    this.mkButton('turret', 'plain', M4.mulAll(M4.translation(ew[0] + 0.03, ew[1] + 0.15, ew[2]), M4.rotationY(Math.PI / 2), M4.rotationX(0)), {
      id: 'fire', label: 'MAIN GUN FIRING SWITCH', keys: 'SPACE',
      tip: 'Fires the main armament when the breech is closed and loaded.',
      read: function (S) {
        return S.gun.loaded ? (S.gun.breech < 0.5 ? 'READY (' + S.gun.loaded + ')' : 'BREECH OPEN') : 'NOT LOADED';
      },
      down: function () { sim.fireMain(); }
    });

    /* traverse crank (left hand) */
    var tw = [-0.76, gu.trunY - 0.44, 0.04];
    this.add('turret', 'plain', G.merge([
      G.xf(G.cyl(0.04, 0.04, 0.12, 10, { col: [0.34, 0.35, 0.33] }), M4.mulAll(M4.translation(tw[0] - 0.07, tw[1], tw[2]), M4.rotationZ(Math.PI / 2))),
      G.boxAt(tw[0] - 0.15, tw[1], tw[2], 0.12, 0.18, 0.18, { col: [0.30, 0.32, 0.29] })
    ]));
    this.ctl({
      id: 'traverse', label: 'TURRET TRAVERSE CRANK', space: 'turret', kind: 'drag', keys: 'Mouse / \u2190\u2192',
      tip: 'Drag left and right to rotate the turret.',
      hit: { m: M4.translation(tw[0], tw[1] + 0.04, tw[2]), h: [0.10, 0.16, 0.14] },
      read: function (S) { return MU.deg(MU.wrapAngle(S.turret.yaw)).toFixed(0) + '\u00b0 from bore sight'; },
      drag: function (S, dx, dy) { sim.dragTraverse(dx); }
    });
    this.addDyn('turret', W.crank, function (S) {
      return M4.multiply(M4.translation(tw[0], tw[1], tw[2]), M4.rotationX(S.turret.crankAngle));
    }, { color: [1, 1, 1], spec: 0.3, shine: 34 }, 'traverse');

    /* gunner's control box on the turret wall */
    var bg = board(-0.94, gu.trunY + 0.10, 0.10, Math.PI / 2, 0);
    this.add('turret', 'panel', G.xf(G.box(0.42, 0.34, 0.05, { col: [0.26, 0.28, 0.25] }), M4.multiply(bg, M4.translation(0, 0, -0.025))));
    this.mkToggle('turret', 'plain', on(bg, -0.14, -0.11, 0), {
      id: 'turretPower', label: 'TURRET POWER TRAVERSE', keys: 'T',
      tip: 'Powered traverse is much faster than the hand crank, but needs the engine running.',
      state: function (S) { return S.turretPower; },
      read: function (S) { return S.turretPower ? (S.engine.running ? 'ON' : 'ON (no hydraulics)') : 'OFF'; },
      act: function () { sim.toggle('turretPower'); }
    });
    this.mkKnob('turret', 'plain', on(bg, 0.02, -0.11, 0), {
      id: 'sightLamp', label: 'RETICLE ILLUMINATION', keys: null,
      tip: 'Brightens the reticle for shooting into shadow.',
      value: function (S) { return S.sightLamp; },
      read: function (S) { return Math.round(S.sightLamp * 100) + ' %'; },
      drag: function (S, dx, dy) { sim.dragValue('sightLamp', (dx - dy) * 0.004); }
    });
    this.plate('turret', on(bg, -0.14, -0.155, 0.028), 'POWER', 0.11, 0.032);
    this.plate('turret', on(bg, 0.02, -0.155, 0.028), 'LAMP', 0.11, 0.032);

    /* azimuth indicator: the needle shows the turret angle relative to the hull */
    this.mkGauge('turret', on(bg, -0.02, 0.09, 0), {
      id: 'azimuth', label: 'AZIMUTH INDICATOR', r: 0.070,
      face: { title: 'AZIMUTH', unit: 'mils', min: 0, max: 360, ticks: 8, redFrom: 400, startAngle: 90, endAngle: -270 },
      value: function (S) { return ((MU.deg(S.turret.yaw) % 360) + 360) % 360 / 360; },
      read: function (S) { return (((MU.deg(S.turret.yaw) % 360) + 360) % 360).toFixed(0) + '\u00b0'; },
      a0: 90, a1: -270
    });

    /* coaxial machine gun trigger (foot pedal on the turret floor) */
    var cp = [-0.52, -0.72, 0.42];
    this.add('turret', 'plain', G.at(G.box(0.16, 0.03, 0.20, { col: [0.28, 0.29, 0.27] }), cp[0], cp[1], cp[2]));
    this.ctl({
      id: 'coax', label: 'COAXIAL MG FOOT TRIGGER', space: 'turret', kind: 'button', keys: 'C',
      tip: 'Machine gun mounted beside the main armament.',
      hit: { m: M4.translation(cp[0], cp[1] + 0.05, cp[2]), h: [0.12, 0.08, 0.14] },
      read: function (S) { return S.mgAmmo + ' rounds'; },
      down: function () { sim.mgDown('coax'); },
      up: function () { sim.mgUp('coax'); }
    });
  };

  /* ==================================================== loader station ==== */
  Cockpit.prototype.buildLoader = function () {
    var R = this.R, W = this.W, sim = this.sim, self = this;

    /* vertical ready rack on the right-hand turret wall */
    var rackX = 0.86, rackY = 0.12;
    var rackG = [];
    for (var i = 0; i < 8; i++) {
      var z = -0.42 + i * 0.135;
      rackG.push(G.xf(G.cyl(0.058, 0.058, 0.14, 12, { caps: false, col: [0.30, 0.32, 0.28] }),
        M4.translation(rackX, rackY - 0.24, z)));
      rackG.push(G.at(G.ring(0.048, 0.062, 12, { col: [0.34, 0.36, 0.32] }), rackX, rackY - 0.17, z));
    }
    rackG.push(G.boxAt(rackX, rackY - 0.33, 0.03, 0.14, 0.04, 1.12, { col: [0.30, 0.32, 0.28] }));
    rackG.push(G.boxAt(rackX + 0.05, rackY + 0.30, 0.03, 0.04, 0.05, 1.12, { col: [0.30, 0.32, 0.28] }));
    this.add('turret', 'plain', G.merge(rackG));

    for (var k = 0; k < 8; k++) {
      (function (idx) {
        var z = -0.42 + idx * 0.135;
        var pos = [rackX, rackY - 0.30, z];
        self.ctl({
          id: 'shell' + idx, label: 'READY ROUND ' + (idx + 1), space: 'turret', kind: 'shell', keys: idx < 4 ? null : null,
          tip: 'Click to lift the round into the breech.',
          hit: { m: M4.translation(pos[0], pos[1] + 0.30, pos[2]), h: [0.075, 0.32, 0.075] },
          read: function (S) {
            var r = S.rack[idx];
            return r ? r + ' round' : 'empty tube';
          },
          act: function () { sim.loadFromRack(idx); }
        });
        self.addDyn('turret', W.round, function (S) {
          var lift = S.rackLift[idx] || 0;
          return M4.multiply(M4.translation(pos[0] - lift * 0.10, pos[1] + lift * 0.34, pos[2] - lift * 0.30), M4.rotationX(-lift * 1.2));
        }, function (S) {
          var t = S.rack[idx];
          return {
            color: t === 'HE' ? [1, 0.95, 0.85] : [1, 1, 1], spec: 0.45, shine: 50
          };
        }, 'shell' + idx, function (S) { return !!S.rack[idx]; });
        /* painted tip band tells AP from HE */
        self.plate('turret', M4.mulAll(M4.translation(pos[0] - 0.07, pos[1] + 0.30, pos[2]), M4.rotationY(-Math.PI / 2)), (idx + 1) + '', 0.05, 0.05);
      })(k);
    }
    this.plate('turret', M4.mulAll(M4.translation(rackX - 0.02, rackY + 0.34, 0.03), M4.rotationY(-Math.PI / 2)), 'READY ROUNDS - AP / HE', 0.44, 0.05);

    /* loader's hatch handle */
    this.ctl({
      id: 'hatchCmd', label: "COMMANDER'S HATCH", space: 'turret', kind: 'toggle', keys: 'H',
      tip: 'Open up to put your head out for a full field of view.',
      hit: { m: M4.translation(-0.30, D.turret.h + 0.20, -0.60), h: [0.22, 0.12, 0.22] },
      read: function (S) { return S.hatchCmd > 0.5 ? 'OPEN' : 'CLOSED'; },
      act: function () { sim.toggle('hatchCmd'); }
    });
    this.addDyn('turret', W.hatchLid, function (S) {
      return M4.mulAll(M4.translation(-0.30, D.turret.h + 0.29, -0.60 - 0.30), M4.rotationX(-S.hatchCmd * 1.9), M4.scaling(0.9, 1, 0.9));
    }, { color: [1, 1, 1], tex: this.A.get('metal'), uvScale: [2, 2], spec: 0.2 }, 'hatchCmd');

    /* ammunition placard on the wall */
    this.plate('turret', M4.mulAll(M4.translation(0.60, 0.60, 0.62), M4.rotationY(-0.9)), 'DANGER  HANDLE WITH CARE', 0.30, 0.07, { bg: '#5a3a12', color: '#f0e0b0' });
  };

  /* ================================================= commander station ==== */
  Cockpit.prototype.buildCommander = function () {
    var R = this.R, W = this.W, sim = this.sim, self = this;

    /* commander's periscope under the cupola */
    var per = [-0.30, D.turret.h - 0.16, -0.42];
    this.add('turret', 'plain', G.merge([
      G.at(G.box(0.24, 0.18, 0.14, { col: [0.28, 0.30, 0.27] }), per[0], per[1], per[2]),
      G.at(G.box(0.20, 0.05, 0.05, { col: [0.09, 0.09, 0.09] }), per[0], per[1] - 0.08, per[2] - 0.06),
      G.at(G.cyl(0.02, 0.02, 0.10, 8, { col: [0.4, 0.4, 0.38] }), per[0] + 0.14, per[1] - 0.02, per[2])
    ]));
    this.ctl({
      id: 'periscopeCmd', label: "COMMANDER'S PERISCOPE", space: 'turret', kind: 'view', keys: '4',
      tip: 'Rotating periscope in the cupola.',
      hit: { m: M4.translation(per[0], per[1] - 0.04, per[2] - 0.06), h: [0.15, 0.11, 0.10] },
      read: function (S) { return S.view === 'cupola' ? 'IN USE' : 'STOWED'; },
      act: function () { sim.useView('cupola', 'commander'); }
    });

    /* radio set on the bustle wall */
    var br = board(0.14, 0.34, -0.94, 0, 0);
    this.add('turret', 'panel', G.xf(G.box(0.52, 0.34, 0.10, { col: [0.24, 0.26, 0.23] }), M4.multiply(br, M4.translation(0, 0, 0.05))));
    /* dial face */
    var dialTex = this.A.get('screen');
    this.addDyn('turret', this.faceMeshFor(0.075), function () { return on(br, -0.11, 0.05, 0.101); },
      function (S) {
        var on2 = S.radio && S.master;
        return { color: on2 ? [1, 1, 1] : [0.35, 0.34, 0.30], tex: dialTex, emissive: on2 ? [0.55, 0.34, 0.08] : [0, 0, 0], unlit: on2 };
      }, 'radio');
    /* dial needle */
    this.addDyn('turret', W.needle, function (S) {
      var a = MU.rad(200 - S.radioFreq * 220);
      return M4.mulAll(on(br, -0.11, 0.05, 0.104), M4.rotationZ(a), M4.scaling(0.8, 0.8, 1));
    }, { color: [0.9, 0.3, 0.2], spec: 0.2, lightMul: 1.8 }, 'radio', function (S) { return S.radio && S.master; });
    /* speaker grille */
    var grill = [];
    for (var gi = 0; gi < 7; gi++) {
      grill.push(G.xf(G.box(0.14, 0.008, 0.006, { col: [0.16, 0.17, 0.16] }), on(br, 0.13, -0.06 + gi * 0.022, 0.101)));
    }
    this.add('turret', 'plain', G.merge(grill));
    this.mkToggle('turret', 'plain', on(br, 0.09, 0.11, 0.10), {
      id: 'radio', label: 'RADIO SET', keys: 'R',
      tip: 'Company net. Gives you range calls from the observer.',
      state: function (S) { return S.radio; },
      read: function (S) { return S.radio ? 'ON  ' + (1.5 + S.radioFreq * 10.5).toFixed(2) + ' MHz' : 'OFF'; },
      act: function () { sim.toggle('radio'); }
    });
    this.mkKnob('turret', 'plain', on(br, 0.18, -0.10, 0.10), {
      id: 'radioVol', label: 'RADIO VOLUME', value: function (S) { return S.radioVol; },
      read: function (S) { return Math.round(S.radioVol * 100) + ' %'; },
      drag: function (S, dx, dy) { sim.dragValue('radioVol', (dx - dy) * 0.004); }
    });
    this.mkKnob('turret', 'plain', on(br, 0.02, -0.10, 0.10), {
      id: 'radioFreq', label: 'RADIO FREQUENCY', value: function (S) { return S.radioFreq; },
      read: function (S) { return (1.5 + S.radioFreq * 10.5).toFixed(2) + ' MHz'; },
      drag: function (S, dx, dy) { sim.dragValue('radioFreq', (dx - dy) * 0.003); }
    });
    this.plate('turret', on(br, 0.10, 0.155, 0.102), 'WIRELESS SET No.19', 0.26, 0.04);
    this.plate('turret', on(br, 0.02, -0.155, 0.102), 'TUNE', 0.09, 0.03);
    this.plate('turret', on(br, 0.18, -0.155, 0.102), 'VOL', 0.09, 0.03);

    /* intercom box */
    var bi = board(-0.72, 0.36, -0.72, 0.9, 0);
    this.add('turret', 'panel', G.xf(G.box(0.20, 0.16, 0.08, { col: [0.26, 0.28, 0.25] }), M4.multiply(bi, M4.translation(0, 0, 0.04))));
    this.mkToggle('turret', 'plain', on(bi, -0.04, -0.03, 0.08), {
      id: 'intercom', label: 'CREW INTERCOM', keys: 'N',
      state: function (S) { return S.intercom; },
      read: function (S) { return S.intercom ? 'LIVE' : 'MUTED'; },
      act: function () { sim.toggle('intercom'); }
    });
    this.plate('turret', on(bi, 0.045, 0.04, 0.082), 'I/C', 0.07, 0.035);

    /* smoke discharger buttons */
    var bsm = board(0.70, 0.46, 0.30, -0.9, 0);
    this.add('turret', 'panel', G.xf(G.box(0.20, 0.12, 0.06, { col: [0.26, 0.28, 0.25] }), M4.multiply(bsm, M4.translation(0, 0, 0.03))));
    this.mkButton('turret', 'plain', on(bsm, 0, 0, 0.06), {
      id: 'smoke', label: 'SMOKE DISCHARGERS', keys: 'F',
      tip: 'Fires a smoke grenade to break contact.',
      read: function (S) { return S.smoke + ' left'; },
      down: function () { sim.fireSmoke(); }
    });
    this.plate('turret', on(bsm, 0, 0.075, 0.032), 'SMOKE', 0.14, 0.035);

    /* turret dome lamp */
    this.addDyn('turret', W.lamp, function () { return M4.translation(0.22, D.turret.h - 0.06, -0.34); },
      function (S) {
        var on2 = S.domeLight && S.master;
        return { color: [1, 1, 1], unlit: on2, emissive: on2 ? [1.0, 0.86, 0.6] : [0, 0, 0], spec: 0.2 };
      }, 'domeLight');

    /* map board and binoculars */
    this.add('turret', 'wood', G.xf(G.box(0.30, 0.22, 0.02, { col: [0.75, 0.70, 0.55] }), M4.mulAll(M4.translation(-0.68, 0.12, -0.86), M4.rotationY(0.5), M4.rotationX(-0.6))));
    this.add('turret', 'plain', G.merge([
      G.xf(G.cyl(0.035, 0.035, 0.14, 10, { col: [0.14, 0.14, 0.14] }), M4.translation(-0.50, 0.56, -0.90)),
      G.xf(G.cyl(0.035, 0.035, 0.14, 10, { col: [0.14, 0.14, 0.14] }), M4.translation(-0.42, 0.56, -0.90)),
      G.at(G.box(0.14, 0.05, 0.05, { col: [0.16, 0.16, 0.16] }), -0.46, 0.62, -0.90)
    ]));

    /* clinometer / gun elevation quadrant readout */
    this.mkGauge('turret', on(board(-0.16, D.gun.trunY + 0.30, -0.30, 0.35, -0.5), 0, 0, 0), {
      id: 'clinometer', label: 'GUN QUADRANT', r: 0.055,
      face: { title: 'ELEV', unit: 'degrees', min: -10, max: 20, ticks: 6, redFrom: 30, startAngle: 200, endAngle: -20 },
      value: function (S) { return MU.clamp((MU.deg(S.gun.pitch) + 10) / 30, 0, 1); },
      read: function (S) { return MU.deg(S.gun.pitch).toFixed(1) + '\u00b0'; },
      a0: 200, a1: -20
    });
  };

  /* ============================================================ build ==== */
  Cockpit.prototype.build = function () {
    this.buildWidgets();
    this.buildHullShell();
    this.buildDriver();
    this.buildTurretShell();
    this.buildGun();
    this.buildGunner();
    this.buildLoader();
    this.buildCommander();
    /* upload static batches */
    for (var key in this.groups) {
      if (!Object.prototype.hasOwnProperty.call(this.groups, key)) continue;
      var grp = this.groups[key];
      for (var b = 0; b < grp.batches.length; b++) {
        if (!grp.batches[b].length) continue;
        var g = G.merge(grp.batches[b]);
        /* bake a little ambient occlusion: darker low down and in corners */
        G.shade(g, function (x, y) {
          return 0.72 + MU.clamp((y - 0.5) / 1.6, 0, 1) * 0.40;
        });
        this.static.push({ mesh: this.R.mesh(g), space: grp.space, mat: this.material(grp.matKey) });
      }
    }
    this.groups = null;
  };

  /* ============================================================= draw ==== */
  Cockpit.prototype.draw = function (R, hullMat, turretMat, S) {
    var i, m, mat;
    for (i = 0; i < this.static.length; i++) {
      var st = this.static[i];
      R.draw(st.mesh, st.space === 'hull' ? hullMat : turretMat, st.mat);
    }
    for (i = 0; i < this.dyn.length; i++) {
      var d = this.dyn[i];
      if (d.vis && !d.vis(S)) continue;
      m = M4.multiply(d.space === 'hull' ? hullMat : turretMat, d.xf(S));
      mat = typeof d.mat === 'function' ? d.mat(S) : d.mat;
      if (d.ctl && d.ctl === this.hover) {
        mat = shallow(mat);
        var e = mat.emissive || [0, 0, 0];
        mat.emissive = [e[0] + 0.22, e[1] + 0.19, e[2] + 0.06];
      }
      R.draw(d.mesh, m, mat);
    }
  };

  function shallow(o) {
    var r = {};
    for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) r[k] = o[k];
    return r;
  }

  /* ============================================================= pick ==== */
  /* ray is in world space; returns the nearest control hit */
  Cockpit.prototype.pick = function (ro, rd, hullMat, turretMat) {
    var best = null, bestT = 1e9;
    var lo = [0, 0, 0], ld = [0, 0, 0];
    for (var i = 0; i < this.controls.length; i++) {
      var c = this.controls[i];
      var base = c.space === 'hull' ? hullMat : turretMat;
      var world = M4.multiply(base, c.hit.m);
      var inv = M4.inverse(world);
      M4.transformPoint(inv, ro, lo);
      M4.transformDir(inv, rd, ld);
      var h = c.hit.h;
      var t = MU.rayAABB(lo, ld, [-h[0], -h[1], -h[2]], [h[0], h[1], h[2]]);
      if (t > 0.03 && t < bestT) { bestT = t; best = c; }
    }
    return best ? { ctl: best, t: bestT } : null;
  };

  TS.Cockpit = Cockpit;
})(typeof window !== 'undefined' ? window : this);
