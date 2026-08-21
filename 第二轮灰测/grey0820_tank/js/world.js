/* =============================================================================
   world.js - procedural terrain, sky, scenery props and gunnery targets.
   Deterministic (seeded) so the range always looks the same.
   ========================================================================== */
(function (global) {
  'use strict';
  var TS = global.TS = global.TS || {};
  var G = TS.G, M4 = TS.M4, V3 = TS.V3, MU = TS.MU;

  var SIZE = 1024;          /* terrain is SIZE x SIZE metres, centred on origin */
  var CHUNKS = 8;           /* CHUNKS x CHUNKS mesh chunks                      */
  var SEGS = 20;            /* quads per chunk edge                             */

  /* --------------------------------------------------------------- noise --- */
  function hash2(ix, iz, seed) {
    var h = ix * 374761393 + iz * 668265263 + seed * 1274126177;
    h = (h ^ (h >> 13)) * 1274126177;
    h = h ^ (h >> 16);
    return ((h >>> 0) % 100000) / 100000;
  }
  function vnoise(x, z, seed) {
    var xi = Math.floor(x), zi = Math.floor(z);
    var xf = x - xi, zf = z - zi;
    var sx = xf * xf * (3 - 2 * xf), sz = zf * zf * (3 - 2 * zf);
    var a = hash2(xi, zi, seed), b = hash2(xi + 1, zi, seed);
    var c = hash2(xi, zi + 1, seed), d = hash2(xi + 1, zi + 1, seed);
    return (a + (b - a) * sx) * (1 - sz) + (c + (d - c) * sx) * sz;
  }

  function World(R, A) {
    this.R = R;
    this.A = A;
    this.rng = MU.rng(20250820);
    this.chunks = [];
    this.props = [];        /* static merged batches                */
    this.trees = [];        /* individually transformed, knockable  */
    this.targets = [];
    this.time = 0;
    this.sunDir = V3.normalize([-0.38, 0.62, 0.68]);
  }

  /* ------------------------------------------------------------- terrain --- */
  World.prototype.heightAt = function (x, z) {
    /* large rolling hills + medium dunes + fine bumps */
    var h = 0;
    h += (vnoise(x * 0.0042, z * 0.0042, 7) - 0.5) * 46;
    h += (vnoise(x * 0.011, z * 0.011, 13) - 0.5) * 15;
    h += (vnoise(x * 0.031, z * 0.031, 29) - 0.5) * 4.2;
    h += (vnoise(x * 0.09, z * 0.09, 41) - 0.5) * 0.9;
    /* ridge line to the east makes a natural backstop */
    var ridge = Math.exp(-Math.pow((x - 330) / 150, 2)) * 22;
    h += ridge * (0.6 + 0.4 * vnoise(z * 0.01, 5, 3));
    /* flatten the firing range: a wide lane from the start point to +Z */
    var laneW = MU.smoothstep(70, 190, Math.abs(x));
    var laneL = MU.smoothstep(-120, -260, -z);
    var lane = Math.max(laneW, Math.min(1, laneL));
    var flatH = -1.5 + (vnoise(x * 0.02, z * 0.02, 61) - 0.5) * 1.2;
    h = flatH + (h - flatH) * lane;
    /* absolutely flat pad under the spawn point */
    var pad = MU.smoothstep(14, 34, Math.sqrt(x * x + (z + 6) * (z + 6)));
    h = (-1.5) + (h + 1.5) * pad;
    return h;
  };

  World.prototype.normalAt = function (x, z) {
    var e = 1.2;
    var hl = this.heightAt(x - e, z), hr = this.heightAt(x + e, z);
    var hd = this.heightAt(x, z - e), hu = this.heightAt(x, z + e);
    return V3.normalize([hl - hr, 2 * e, hd - hu]);
  };

  World.prototype._terrainColor = function (x, y, z, n) {
    var slope = 1 - n[1];
    var v = vnoise(x * 0.07, z * 0.07, 91);
    var v2 = vnoise(x * 0.013, z * 0.013, 17);
    /* dry steppe grass -> dirt -> rock by slope */
    var grass = [0.34 + v * 0.10, 0.36 + v2 * 0.13, 0.19 + v * 0.06];
    var dirt = [0.42 + v * 0.08, 0.34 + v * 0.05, 0.22];
    var rock = [0.36, 0.34, 0.31];
    var t = MU.clamp((slope - 0.045) / 0.22, 0, 1);
    var c = V3.lerp(grass, dirt, MU.clamp(t * 1.4, 0, 1));
    c = V3.lerp(c, rock, MU.clamp((slope - 0.20) / 0.25, 0, 1));
    /* worn tracks on the flat range area */
    if (Math.abs(x) < 60 && z > -40) {
      var wear = MU.smoothstep(60, 20, Math.abs(x)) * 0.5;
      c = V3.lerp(c, [0.45, 0.38, 0.26], wear * (0.4 + 0.6 * v));
    }
    /* darken low ground slightly */
    var lo = MU.smoothstep(6, -8, y) * 0.12;
    return [c[0] * (1 - lo), c[1] * (1 - lo * 0.8), c[2] * (1 - lo * 0.6)];
  };

  World.prototype.buildTerrain = function () {
    var self = this;
    var cs = SIZE / CHUNKS;
    for (var cz = 0; cz < CHUNKS; cz++) {
      for (var cx = 0; cx < CHUNKS; cx++) {
        var ox = -SIZE / 2 + cs * (cx + 0.5);
        var oz = -SIZE / 2 + cs * (cz + 0.5);
        /* finer tessellation in the middle chunks where the player drives */
        var near = (Math.abs(ox) < cs * 1.6 && Math.abs(oz) < cs * 2.6);
        var segs = near ? SEGS * 2 : SEGS;
        var g = G.heightGrid(cs, cs, segs, segs,
          function (lx, lz) { return self.heightAt(ox + lx, oz + lz); },
          function (lx, ly, lz, n) { return self._terrainColor(ox + lx, ly, oz + lz, n); });
        this.chunks.push({
          mesh: this.R.mesh(g),
          xf: M4.translation(ox, 0, oz),
          c: [ox, 0, oz],
          r: cs * 0.75
        });
      }
    }
    /* distant haze ring so the terrain edge is never visible */
    this.hazeRing = this.R.mesh(G.paint(G.ring(SIZE * 0.47, SIZE * 1.9, 40), [0.62, 0.66, 0.70]));
  };

  /* ----------------------------------------------------------------- sky --- */
  World.prototype.buildSky = function () {
    var R = this.R;
    var sky = G.dome(1500, 28, 12, { flip: false });
    /* gradient by height + slight sun-side warmth */
    var sd = this.sunDir;
    for (var i = 0; i < sky.p.length / 3; i++) {
      var y = sky.p[i * 3 + 1] / 1500;
      var dx = sky.p[i * 3] / 1500, dz = sky.p[i * 3 + 2] / 1500;
      var t = MU.clamp(y, 0, 1);
      var horizon = [0.74, 0.78, 0.80];
      var zenith = [0.20, 0.38, 0.66];
      var c = V3.lerp(horizon, zenith, Math.pow(t, 0.62));
      var sunAmt = Math.max(0, dx * sd[0] + dz * sd[2]) * (1 - t) * 0.35;
      c[0] += sunAmt * 0.5; c[1] += sunAmt * 0.38; c[2] += sunAmt * 0.16;
      sky.c[i * 3] = c[0]; sky.c[i * 3 + 1] = c[1]; sky.c[i * 3 + 2] = c[2];
      sky.n[i * 3] *= -1; sky.n[i * 3 + 1] *= -1; sky.n[i * 3 + 2] *= -1;
    }
    /* flip winding so we see the inside */
    for (var k = 0; k < sky.i.length; k += 3) {
      var tmp = sky.i[k + 1]; sky.i[k + 1] = sky.i[k + 2]; sky.i[k + 2] = tmp;
    }
    this.skyMesh = R.mesh(sky);
    this.sunMesh = R.mesh(G.quad(150, 150));
    this.cloudMesh = R.mesh(G.quad(1, 1));
    this.clouds = [];
    for (var c2 = 0; c2 < 26; c2++) {
      this.clouds.push({
        p: [(this.rng() - 0.5) * 2400, 210 + this.rng() * 260, (this.rng() - 0.5) * 2400],
        s: 180 + this.rng() * 420,
        a: 0.18 + this.rng() * 0.30,
        v: 0.6 + this.rng() * 1.4
      });
    }
  };

  /* --------------------------------------------------------------- props --- */
  function jitterGeom(g, amt, seed) {
    /* displace along the normal using a position hash so seams stay welded */
    for (var i = 0; i < g.p.length / 3; i++) {
      var x = g.p[i * 3], y = g.p[i * 3 + 1], z = g.p[i * 3 + 2];
      var q = 0.35;
      var d = (vnoise(x / q, z / q + y * 3.1, seed) - 0.5) * amt;
      g.p[i * 3] += g.n[i * 3] * d;
      g.p[i * 3 + 1] += g.n[i * 3 + 1] * d;
      g.p[i * 3 + 2] += g.n[i * 3 + 2] * d;
    }
    return g;
  }

  World.prototype._rockGeom = function (r, seed) {
    var g = G.sphere(r, 10, 7, { col: [0.40, 0.385, 0.36] });
    jitterGeom(g, r * 0.7, seed);
    G.shade(g, function (x, y) { return 0.75 + MU.clamp(y / r, -0.4, 1) * 0.3; });
    return g;
  };

  World.prototype._treeGeom = function (seed) {
    var rng = MU.rng(seed);
    var h = 5 + rng() * 6;
    var trunkCol = [0.26, 0.20, 0.14];
    var leafCol = [0.17 + rng() * 0.07, 0.27 + rng() * 0.10, 0.13];
    var parts = [G.at(G.cyl(0.28, 0.17, h * 0.55, 7, { col: trunkCol }), 0, h * 0.275, 0)];
    var layers = 3 + Math.floor(rng() * 2);
    for (var i = 0; i < layers; i++) {
      var t = i / layers;
      var y = h * (0.42 + t * 0.5);
      var r = (2.6 - t * 1.5) * (0.8 + rng() * 0.4);
      var blob = G.sphere(r, 9, 6, { col: [leafCol[0] * (1 - t * 0.15), leafCol[1] * (1 - t * 0.1), leafCol[2]] });
      jitterGeom(blob, r * 0.55, seed + i * 7);
      parts.push(G.at(blob, (rng() - 0.5) * 0.7, y, (rng() - 0.5) * 0.7));
    }
    var g = G.merge(parts);
    G.shade(g, function (x, y) { return 0.62 + MU.clamp(y / h, 0, 1) * 0.5; });
    return g;
  };

  World.prototype.buildProps = function () {
    var R = this.R, rng = this.rng, i;
    var batches = [[]], vcount = 0;
    var self = this;
    function push(g) {
      var vc = g.p.length / 3;
      if (vcount + vc > 60000) { batches.push([]); vcount = 0; }
      batches[batches.length - 1].push(g);
      vcount += vc;
    }

    /* rocks ---------------------------------------------------------------- */
    var rockGeoms = [this._rockGeom(1.0, 3), this._rockGeom(1.9, 11), this._rockGeom(3.4, 23)];
    for (i = 0; i < 130; i++) {
      var rx = (rng() - 0.5) * SIZE * 0.92, rz = (rng() - 0.5) * SIZE * 0.92;
      if (Math.abs(rx) < 26 && rz > -40 && rz < 760) continue; /* keep the lane clear */
      var rg = rockGeoms[Math.floor(rng() * rockGeoms.length)];
      var s = 0.6 + rng() * 1.3;
      var m = M4.multiply(
        M4.multiply(M4.translation(rx, this.heightAt(rx, rz) - 0.25 * s, rz), M4.rotationY(rng() * 6.28)),
        M4.scaling(s, s * (0.6 + rng() * 0.5), s));
      push(G.xf(rg, m));
    }

    /* grass tufts / bushes -------------------------------------------------- */
    var bush = G.merge([
      G.at(G.sphere(0.75, 7, 5, { col: [0.24, 0.29, 0.15] }), 0, 0.35, 0)
    ]);
    jitterGeom(bush, 0.5, 77);
    for (i = 0; i < 420; i++) {
      var bx = (rng() - 0.5) * SIZE * 0.9, bz = (rng() - 0.5) * SIZE * 0.9;
      var bs = 0.5 + rng() * 1.1;
      push(G.xf(bush, M4.multiply(
        M4.translation(bx, this.heightAt(bx, bz), bz),
        M4.scaling(bs, bs * (0.5 + rng() * 0.6), bs))));
    }

    /* range markers with distance signs (separate: textured) ---------------- */
    this.signs = [];
    var dists = [100, 200, 300, 400, 600, 800];
    for (i = 0; i < dists.length; i++) {
      var d = dists[i];
      var sx = -34, sz = d;
      var sy = this.heightAt(sx, sz);
      var post = G.merge([
        G.at(G.cyl(0.09, 0.09, 2.4, 8, { col: [0.42, 0.40, 0.34] }), 0, 1.2, 0)
      ]);
      push(G.at(post, sx, sy, sz));
      this.signs.push({
        mesh: R.mesh(G.quad(1.5, 0.62)),
        tex: this.A.label(d + ' M', { w: 256, h: 128, bg: '#c9c2a8', color: '#20241c' }),
        xf: M4.multiply(M4.translation(sx, sy + 2.15, sz), M4.rotationY(Math.PI / 2))
      });
    }

    /* sandbag emplacement -------------------------------------------------- */
    var bagCol = [0.52, 0.47, 0.34];
    var emp = [];
    for (var row = 0; row < 4; row++) {
      var n = 13 - row;
      for (var b = 0; b < n; b++) {
        var ang = -0.6 + (b / (n - 1)) * 1.2;
        var rr = 5.2;
        emp.push(G.xf(G.box(0.62, 0.30, 0.42, { col: [bagCol[0] * (0.85 + rng() * 0.3), bagCol[1] * (0.85 + rng() * 0.3), bagCol[2]] }),
          M4.multiply(M4.multiply(
            M4.translation(Math.sin(ang) * rr, 0.16 + row * 0.28, Math.cos(ang) * rr),
            M4.rotationY(ang)), M4.rotationZ((rng() - 0.5) * 0.2))));
      }
    }
    var empG = G.merge(emp);
    push(G.at(empG, 70, this.heightAt(70, 240) + 0, 240));

    /* trees (individually drawn so they can be flattened) ------------------ */
    var treeGeoms = [];
    for (i = 0; i < 5; i++) treeGeoms.push(R.mesh(this._treeGeom(100 + i * 13)));
    for (i = 0; i < 150; i++) {
      var tx = (rng() - 0.5) * SIZE * 0.95, tz = (rng() - 0.5) * SIZE * 0.95;
      var dd = Math.sqrt(tx * tx + tz * tz);
      if (dd < 55) continue;
      if (Math.abs(tx) < 45 && tz > -60 && tz < 820) continue;
      var cluster = vnoise(tx * 0.006, tz * 0.006, 5);
      if (cluster < 0.42) continue;
      this.trees.push({
        mesh: treeGeoms[Math.floor(rng() * treeGeoms.length)],
        p: [tx, this.heightAt(tx, tz), tz],
        rot: rng() * 6.28,
        s: 0.75 + rng() * 0.7,
        fall: 0, fallDir: rng() * 6.28, falling: false
      });
    }

    /* upload static batches ------------------------------------------------ */
    for (i = 0; i < batches.length; i++) {
      if (!batches[i].length) continue;
      this.props.push(R.mesh(G.merge(batches[i])));
    }
  };

  /* ------------------------------------------------------------- targets --- */
  World.prototype._targetFaceTex = function () {
    return this.A.custom('targetFace', 256, 256, function (c, w, h) {
      c.fillStyle = '#cfc6a8'; c.fillRect(0, 0, w, h);
      /* weathered plywood */
      var rnd = TS.MU.rng(4242);
      c.fillStyle = '#a99c78';
      for (var i = 0; i < 500; i++) {
        c.globalAlpha = 0.05 + rnd() * 0.08;
        c.fillRect(rnd() * w, rnd() * h, 6 + rnd() * 30, 1.5);
      }
      c.globalAlpha = 1;
      /* concentric scoring rings */
      var rings = [0.46, 0.38, 0.30, 0.22, 0.14, 0.07];
      for (var r = 0; r < rings.length; r++) {
        c.beginPath();
        c.arc(w / 2, h / 2, rings[r] * w, 0, Math.PI * 2);
        c.strokeStyle = r % 2 ? '#1c1c1c' : '#8f1a12';
        c.lineWidth = 3;
        c.stroke();
      }
      c.beginPath(); c.arc(w / 2, h / 2, 0.035 * w, 0, Math.PI * 2);
      c.fillStyle = '#8f1a12'; c.fill();
      /* stencilled tank silhouette hint */
      c.strokeStyle = 'rgba(20,20,20,0.55)'; c.lineWidth = 2;
      c.strokeRect(w * 0.18, h * 0.34, w * 0.64, h * 0.30);
      c.font = 'bold 20px monospace'; c.fillStyle = '#20241c';
      c.fillText('TARGET', w * 0.38, h * 0.94);
    }, { wrap: 'clamp' });
  };

  World.prototype.buildTargets = function () {
    var R = this.R, A = this.A, rng = this.rng;
    var faceTex = this._targetFaceTex();

    /* --- panel target ---------------------------------------------------- */
    var frameCol = [0.44, 0.34, 0.22];
    var panelGeom = G.merge([
      G.at(G.box(0.14, 2.4, 0.14, { col: frameCol }), -1.35, 1.2, 0),
      G.at(G.box(0.14, 2.4, 0.14, { col: frameCol }), 1.35, 1.2, 0),
      G.at(G.box(2.9, 0.14, 0.14, { col: frameCol }), 0, 2.32, 0),
      G.at(G.box(0.12, 1.8, 0.12, { col: frameCol }), -1.05, 0.9, 0.6),
      G.at(G.box(0.12, 1.8, 0.12, { col: frameCol }), 1.05, 0.9, 0.6)
    ]);
    var panelMesh = R.mesh(panelGeom);
    var faceMesh = R.mesh(G.at(G.quad(2.5, 1.9), 0, 1.35, 0.09));

    /* --- oil drum -------------------------------------------------------- */
    var drumMesh = R.mesh(G.merge([
      G.at(G.cyl(0.31, 0.31, 0.88, 14, { col: [0.42, 0.33, 0.20] }), 0, 0.44, 0),
      G.at(G.torus(0.315, 0.035, 14, 6, { col: [0.34, 0.26, 0.16] }), 0, 0.30, 0),
      G.at(G.torus(0.315, 0.035, 14, 6, { col: [0.34, 0.26, 0.16] }), 0, 0.58, 0)
    ]));

    /* --- derelict hulk --------------------------------------------------- */
    var rust = [0.40, 0.30, 0.22];
    var hulkGeom = G.merge([
      G.at(G.box(2.9, 0.85, 5.6, { col: rust }), 0, 0.75, 0),
      G.at(G.prism([[-1.45, -0.42], [1.45, -0.42], [1.45, 0.10], [-1.45, 0.10]], 5.6, { col: rust }), 0, 1.55, 0),
      G.at(G.cyl(1.05, 0.92, 0.62, 12, { col: rust }), 0, 1.62, -0.4),
      G.xf(G.cyl(0.11, 0.10, 3.0, 10, { col: [0.33, 0.26, 0.20] }),
        M4.multiply(M4.translation(0, 1.66, 1.2), M4.rotationX(Math.PI / 2))),
      G.at(G.box(0.7, 0.55, 5.8, { col: [0.30, 0.24, 0.19] }), -1.55, 0.42, 0),
      G.at(G.box(0.7, 0.55, 5.8, { col: [0.30, 0.24, 0.19] }), 1.55, 0.42, 0)
    ]);
    G.shade(hulkGeom, function (x, y, z) { return 0.7 + vnoise(x * 3, z * 3 + y, 9) * 0.55; });
    var hulkMesh = R.mesh(hulkGeom);

    /* --- bunker ---------------------------------------------------------- */
    var bunkerMesh = R.mesh(G.merge([
      G.at(G.box(5.0, 1.7, 3.2, { col: [0.52, 0.50, 0.45] }), 0, 0.85, 0),
      G.at(G.box(5.4, 0.35, 3.6, { col: [0.46, 0.45, 0.41] }), 0, 1.85, 0),
      G.at(G.box(3.0, 0.42, 0.3, { col: [0.10, 0.10, 0.10] }), 0, 1.1, -1.65)
    ]));

    var defs = [
      { kind: 'panel', x: -18, z: 150 }, { kind: 'panel', x: 12, z: 152 },
      { kind: 'drum', x: -4, z: 148 }, { kind: 'drum', x: -2.2, z: 149.4 },
      { kind: 'panel', x: 26, z: 205 }, { kind: 'hulk', x: -30, z: 262, rot: 0.5 },
      { kind: 'bunker', x: 70, z: 246, rot: -0.25 },
      { kind: 'panel', x: 4, z: 300 }, { kind: 'panel', x: -46, z: 312 },
      { kind: 'hulk', x: 36, z: 355, rot: -1.1 },
      { kind: 'drum', x: 0, z: 402 }, { kind: 'drum', x: 1.6, z: 403.6 }, { kind: 'drum', x: -1.5, z: 404.2 },
      { kind: 'panel', x: -62, z: 415 }, { kind: 'hulk', x: 22, z: 520, rot: 2.4 },
      { kind: 'panel', x: -12, z: 610 }, { kind: 'hulk', x: 58, z: 705, rot: 0.9 },
      { kind: 'panel', x: 96, z: 640, rot: -0.6 }
    ];

    for (var i = 0; i < defs.length; i++) {
      var d = defs[i];
      var y = this.heightAt(d.x, d.z);
      var t = {
        kind: d.kind, p: [d.x, y, d.z], rot: (d.rot || 0) + Math.PI,
        alive: true, hp: 1, radius: 2.0, height: 2.2,
        burn: 0, fallen: 0, score: 100
      };
      if (d.kind === 'panel') { t.mesh = panelMesh; t.face = faceMesh; t.faceTex = faceTex; t.radius = 1.6; t.height = 2.4; t.score = 100; }
      if (d.kind === 'drum') { t.mesh = drumMesh; t.radius = 0.55; t.height = 0.9; t.score = 60; t.explosive = true; }
      if (d.kind === 'hulk') { t.mesh = hulkMesh; t.radius = 2.6; t.height = 2.2; t.hp = 2; t.score = 300; }
      if (d.kind === 'bunker') { t.mesh = bunkerMesh; t.radius = 3.0; t.height = 2.2; t.hp = 3; t.score = 250; }
      t.dist = Math.round(Math.sqrt(d.x * d.x + d.z * d.z));
      this.targets.push(t);
    }
  };

  World.prototype.build = function () {
    this.buildTerrain();
    this.buildSky();
    this.buildProps();
    this.buildTargets();
    this.texCamo = this.A.get('camo');
    this.texRadial = this.A.get('radialSoft');
  };

  /* ------------------------------------------------------------- queries --- */
  /* returns the nearest target hit by a sphere of the given radius */
  World.prototype.impactTargets = function (pos, radius) {
    var out = [];
    for (var i = 0; i < this.targets.length; i++) {
      var t = this.targets[i];
      if (!t.alive) continue;
      var dx = pos[0] - t.p[0], dz = pos[2] - t.p[2];
      var dy = pos[1] - (t.p[1] + t.height * 0.5);
      var rr = t.radius + radius;
      if (dx * dx + dz * dz < rr * rr && Math.abs(dy) < t.height * 0.5 + radius + 0.6) out.push(t);
    }
    return out;
  };

  /* ray vs target proxy volumes (used for direct hits) */
  World.prototype.rayTargets = function (ro, rd, maxT) {
    var best = null, bestT = maxT || 1e9;
    for (var i = 0; i < this.targets.length; i++) {
      var t = this.targets[i];
      if (!t.alive) continue;
      var c = [t.p[0], t.p[1] + t.height * 0.5, t.p[2]];
      var hit = MU.raySphere(ro, rd, c, Math.max(t.radius, t.height * 0.5));
      if (hit > 0 && hit < bestT) { bestT = hit; best = t; }
    }
    return best ? { t: bestT, target: best } : null;
  };

  World.prototype.knockTrees = function (pos, radius) {
    for (var i = 0; i < this.trees.length; i++) {
      var tr = this.trees[i];
      if (tr.falling || tr.fall > 0.9) continue;
      var dx = tr.p[0] - pos[0], dz = tr.p[2] - pos[2];
      if (dx * dx + dz * dz < radius * radius) {
        tr.falling = true;
        tr.fallDir = Math.atan2(dz, dx);
        return tr;
      }
    }
    return null;
  };

  World.prototype.update = function (dt) {
    this.time += dt;
    for (var i = 0; i < this.trees.length; i++) {
      var tr = this.trees[i];
      if (tr.falling && tr.fall < 1) {
        tr.fall = Math.min(1, tr.fall + dt * (0.6 + tr.fall * 2.2));
      }
    }
    for (var j = 0; j < this.targets.length; j++) {
      var t = this.targets[j];
      if (!t.alive) {
        if (t.kind === 'panel' && t.fallen < 1) t.fallen = Math.min(1, t.fallen + dt * (1.1 + t.fallen * 2.4));
        if (t.burn > 0) t.burn = Math.max(0, t.burn - dt * 0.006);
      }
    }
    for (var c = 0; c < this.clouds.length; c++) {
      this.clouds[c].p[0] += this.clouds[c].v * dt;
      if (this.clouds[c].p[0] > 1300) this.clouds[c].p[0] = -1300;
    }
  };

  /* ---------------------------------------------------------------- draw --- */
  World.prototype.draw = function (R, camPos) {
    var i;
    /* sky dome follows the camera */
    R.draw(this.skyMesh, M4.translation(camPos[0], camPos[1] - 30, camPos[2]),
      { unlit: true, color: [1, 1, 1] });
    /* sun glow billboard */
    var sd = this.sunDir;
    var sunPos = [camPos[0] + sd[0] * 1200, camPos[1] + sd[1] * 1200, camPos[2] + sd[2] * 1200];
    var up = [0, 1, 0];
    var right = V3.normalize(V3.cross(up, sd));
    var up2 = V3.cross(sd, right);
    R.draw(this.sunMesh, M4.fromBasis(right, up2, sd, sunPos),
      { unlit: true, color: [1, 0.96, 0.82], tex: this.A.get('radial'), additive: true, alpha: 0.85, depthWrite: false });
    /* clouds: flat quads high above, facing down */
    var cq = M4.rotationX(-Math.PI / 2);
    for (i = 0; i < this.clouds.length; i++) {
      var cl = this.clouds[i];
      var m = M4.multiply(M4.multiply(M4.translation(cl.p[0], cl.p[1], cl.p[2]), cq), M4.scaling(cl.s, cl.s, 1));
      R.draw(this.cloudMesh, m, {
        unlit: true, color: [1, 1, 1], tex: this.texRadial, alpha: cl.a,
        depthWrite: false, doubleSided: true
      });
    }
    /* haze ring at the horizon */
    R.draw(this.hazeRing, M4.translation(camPos[0], -4, camPos[2]),
      { unlit: true, color: [1, 1, 1], doubleSided: true });

    /* terrain chunks (cheap distance cull) */
    for (i = 0; i < this.chunks.length; i++) {
      var ch = this.chunks[i];
      var dx = ch.c[0] - camPos[0], dz = ch.c[2] - camPos[2];
      if (dx * dx + dz * dz > 1500 * 1500) continue;
      R.draw(ch.mesh, ch.xf, { color: [1, 1, 1], tex: this.texCamo, uvScale: [1.6, 1.6], spec: 0.03, shine: 8, lightMul: 1.0 });
    }
    /* static prop batches */
    for (i = 0; i < this.props.length; i++) {
      R.draw(this.props[i], IDENT, { color: [1, 1, 1], spec: 0.05 });
    }
    /* signs */
    for (i = 0; i < this.signs.length; i++) {
      R.draw(this.signs[i].mesh, this.signs[i].xf, { color: [1, 1, 1], tex: this.signs[i].tex, doubleSided: true });
    }
    /* trees */
    for (i = 0; i < this.trees.length; i++) {
      var tr = this.trees[i];
      var ddx = tr.p[0] - camPos[0], ddz = tr.p[2] - camPos[2];
      if (ddx * ddx + ddz * ddz > 900 * 900) continue;
      var m2 = M4.multiply(M4.translation(tr.p[0], tr.p[1], tr.p[2]), M4.rotationY(tr.rot));
      if (tr.fall > 0) {
        var ang = tr.fall * Math.PI * 0.48;
        m2 = M4.mulAll(M4.translation(tr.p[0], tr.p[1], tr.p[2]),
          M4.rotationY(tr.fallDir), M4.rotationZ(-ang), M4.rotationY(tr.rot));
      }
      if (tr.s !== 1) m2 = M4.multiply(m2, M4.scaling(tr.s, tr.s, tr.s));
      R.draw(tr.mesh, m2, { color: [1, 1, 1], spec: 0.04, doubleSided: true });
    }
    /* targets */
    for (i = 0; i < this.targets.length; i++) {
      var t = this.targets[i];
      var tdx = t.p[0] - camPos[0], tdz = t.p[2] - camPos[2];
      if (tdx * tdx + tdz * tdz > 1300 * 1300) continue;
      var base = M4.multiply(M4.translation(t.p[0], t.p[1], t.p[2]), M4.rotationY(t.rot));
      if (t.fallen > 0) base = M4.multiply(base, M4.rotationX(t.fallen * Math.PI * 0.47));
      var dark = t.alive ? 1 : 0.45;
      if (t.kind === 'drum' && !t.alive) continue; /* drums are consumed */
      R.draw(t.mesh, base, { color: [dark, dark, dark], spec: 0.08 });
      if (t.face) {
        R.draw(t.face, base, { color: [dark, dark, dark], tex: t.faceTex, doubleSided: true });
      }
    }
  };

  var IDENT = M4.create();

  TS.World = World;
})(typeof window !== 'undefined' ? window : this);
