/* =============================================================================
   tank.js - exterior of the vehicle: welded hull, cast turret, recoiling gun,
   running gear with scrolling tracks and spinning road wheels, hatches,
   stowage and lights. Also the shared dimension table (TS.TankDef) that the
   cockpit and the simulation both build against.

   Spaces:
     hull space   : origin on the ground plane under the hull centre,
                    +X right, +Y up, +Z forward.
     turret space : origin at the turret ring centre, on the hull roof plane.
   ========================================================================== */
(function (global) {
  'use strict';
  var TS = global.TS = global.TS || {};
  var G = TS.G, M4 = TS.M4, V3 = TS.V3, MU = TS.MU;

  var D = TS.TankDef = {
    hull: { len: 6.4, wid: 2.72, bottom: 0.42, roof: 1.78, noseZ: 3.2, tailZ: -3.2, sideX: 1.36 },
    track: { x: 1.42, w: 0.56, r: 0.43, bottomY: 0.20, topY: 1.06, frontZ: 2.86, rearZ: -2.86 },
    turret: { cy: 1.78, cz: -0.25, r: 1.06, h: 0.74, roofY: 2.52 },
    gun: { trunY: 0.40, trunZ: 0.62, len: 4.05, r: 0.105, recoilMax: 0.34 },
    interior: { floorY: 0.58, ceilY: 1.78, wallX: 1.07, frontZ: 2.22, rearZ: -1.38 },
    /* Crew eye points. 'space' selects the parent transform.
       NOTE ON HANDEDNESS: hull +Z is forward and +Y is up, so in this
       right-handed frame the vehicle's LEFT side is +X and its RIGHT is -X.
       Driver sits front-left (+X), bow gunner front-right (-X), turret
       gunner right (-X), loader left (+X), commander right-rear (-X).        */
    stations: {
      driver: { space: 'hull', eye: [0.60, 1.55, 1.36], yaw: 0, name: 'DRIVER' },
      gunner: { space: 'turret', eye: [-0.52, 0.30, 0.05], yaw: 0, name: 'GUNNER' },
      loader: { space: 'turret', eye: [0.56, 0.28, -0.10], yaw: 0, name: 'LOADER' },
      commander: { space: 'turret', eye: [-0.30, 0.44, -0.62], yaw: 0, name: 'COMMANDER' }
    }
  };

  var OLIVE = [1, 1, 1];

  function Tank(R, A) {
    this.R = R; this.A = A;
    this.rng = MU.rng(555);
    this.parts = {};
  }

  /* ------------------------------------------------------------ helpers --- */
  function grille(w, d, bars, col) {
    var parts = [G.box(w, 0.06, d, { col: [col[0] * 0.5, col[1] * 0.5, col[2] * 0.5] })];
    for (var i = 0; i < bars; i++) {
      var z = -d / 2 + d * ((i + 0.5) / bars);
      parts.push(G.at(G.box(w * 0.96, 0.05, d / bars * 0.45, { col: col }), 0, 0.05, z));
    }
    return G.merge(parts);
  }

  /* ---------------------------------------------------------- exterior ----- */
  Tank.prototype.build = function () {
    var R = this.R, A = this.A, rng = this.rng;
    var h = D.hull, tr = D.track, tu = D.turret, gu = D.gun;
    var camo = A.get('camo');
    var metal = A.get('metal');
    var rivet = A.get('rivet');
    var tread = A.get('tread');

    /* ================= HULL ================= */
    var hull = [];
    var bodyCol = [0.86, 0.88, 0.84];
    /* lower hull box */
    hull.push(G.boxSpan(-h.sideX, h.bottom, h.tailZ + 0.35, h.sideX, 1.06, h.noseZ - 0.75, { col: bodyCol, uvWorld: true }));
    /* Plates authored as 2D polygons in (y,z) and cycled into place by AXIS:
       local X -> world Y, local Y -> world Z, local Z (extrusion) -> world X.
       Polygons must be listed counter-clockwise in (y,z).                    */
    var AXIS = M4.multiply(M4.rotationY(Math.PI / 2), M4.rotationZ(Math.PI / 2));
    /* sloped glacis (front upper plate) */
    hull.push(G.xf(G.prism([
      [h.roof, 1.70], [h.roof, 1.85], [1.06, 3.18], [1.06, 2.45]
    ], h.sideX * 2, { col: bodyCol, uvWorld: true }), AXIS));
    /* lower nose bevel */
    hull.push(G.xf(G.prism([
      [1.06, 2.45], [1.06, 3.18], [0.62, 3.05], [h.bottom, 2.45]
    ], h.sideX * 2, { col: bodyCol, uvWorld: true }), AXIS));
    /* upper hull sides + roof + rear */
    hull.push(G.boxSpan(-h.sideX, 1.06, h.tailZ + 0.35, h.sideX, h.roof, h.noseZ - 1.42, { col: bodyCol, uvWorld: true }));
    /* rear plate, slightly sloped */
    hull.push(G.xf(G.prism([
      [h.bottom, h.tailZ + 0.1], [1.0, h.tailZ - 0.2], [h.roof, h.tailZ - 0.05],
      [h.roof, h.tailZ + 0.4], [h.bottom, h.tailZ + 0.4]
    ], h.sideX * 2, { col: bodyCol, uvWorld: true }), AXIS));
    /* engine deck: grilles + hatch */
    hull.push(G.at(grille(1.5, 1.05, 7, [0.55, 0.57, 0.52]), 0, h.roof + 0.01, -1.95));
    hull.push(G.at(G.box(1.9, 0.09, 0.5, { col: bodyCol }), 0, h.roof + 0.04, -1.15));
    hull.push(G.at(G.box(0.55, 0.10, 0.55, { col: [0.7, 0.72, 0.68] }), -0.95, h.roof + 0.05, -2.75));
    /* exhaust pipes at the rear */
    hull.push(G.xf(G.cyl(0.13, 0.13, 0.5, 10, { col: [0.30, 0.24, 0.20] }),
      M4.mulAll(M4.translation(-0.85, h.roof - 0.28, h.tailZ - 0.05), M4.rotationX(Math.PI / 2))));
    hull.push(G.xf(G.cyl(0.13, 0.13, 0.5, 10, { col: [0.30, 0.24, 0.20] }),
      M4.mulAll(M4.translation(0.85, h.roof - 0.28, h.tailZ - 0.05), M4.rotationX(Math.PI / 2))));
    /* fenders over the tracks */
    hull.push(G.boxSpan(-tr.x - tr.w / 2 - 0.06, tr.topY + 0.10, h.tailZ - 0.1, -h.sideX + 0.02, tr.topY + 0.17, h.noseZ - 0.5, { col: [0.72, 0.74, 0.70] }));
    hull.push(G.boxSpan(h.sideX - 0.02, tr.topY + 0.10, h.tailZ - 0.1, tr.x + tr.w / 2 + 0.06, tr.topY + 0.17, h.noseZ - 0.5, { col: [0.72, 0.74, 0.70] }));
    /* stowage boxes on the fenders */
    hull.push(G.boxAt(-tr.x, tr.topY + 0.42, -1.55, 0.62, 0.45, 1.5, { col: [0.78, 0.80, 0.74] }));
    hull.push(G.boxAt(tr.x, tr.topY + 0.36, -1.9, 0.62, 0.34, 0.9, { col: [0.78, 0.80, 0.74] }));
    hull.push(G.boxAt(tr.x, tr.topY + 0.40, -0.45, 0.60, 0.42, 1.1, { col: [0.76, 0.78, 0.73] }));
    /* spare track links on the glacis */
    for (var s = 0; s < 5; s++) {
      hull.push(G.xf(G.box(0.5, 0.07, 0.17, { col: [0.42, 0.40, 0.36] }),
        M4.mulAll(M4.translation(-0.55 + (s % 2) * 0.02, 1.30 + s * 0.005, 2.28 - s * 0.19), M4.rotationX(-0.62))));
    }
    /* tow hooks + shackles */
    hull.push(G.boxAt(-0.9, 0.62, h.noseZ - 0.1, 0.14, 0.3, 0.3, { col: [0.5, 0.5, 0.46] }));
    hull.push(G.boxAt(0.9, 0.62, h.noseZ - 0.1, 0.14, 0.3, 0.3, { col: [0.5, 0.5, 0.46] }));
    /* headlights + guards */
    hull.push(G.xf(G.cyl(0.15, 0.16, 0.14, 12, { col: [0.55, 0.56, 0.52] }),
      M4.mulAll(M4.translation(-1.0, 1.52, 2.32), M4.rotationX(Math.PI / 2))));
    hull.push(G.xf(G.cyl(0.15, 0.16, 0.14, 12, { col: [0.55, 0.56, 0.52] }),
      M4.mulAll(M4.translation(1.0, 1.52, 2.32), M4.rotationX(Math.PI / 2))));
    /* hull machine-gun ball mount (right of the driver, i.e. -X) */
    hull.push(G.at(G.sphere(0.24, 12, 8, { col: [0.62, 0.63, 0.58] }), -0.62, 1.42, 2.42));
    hull.push(G.xf(G.cyl(0.045, 0.04, 0.75, 8, { col: [0.20, 0.19, 0.18] }),
      M4.mulAll(M4.translation(-0.62, 1.44, 2.72), M4.rotationX(Math.PI / 2))));
    /* driver's hatch ring on the roof (left side, +X) */
    hull.push(G.at(G.ring(0.30, 0.40, 16, { col: [0.66, 0.67, 0.62] }), 0.60, h.roof + 0.02, 1.62));
    /* periscope housing in front of the driver's hatch */
    hull.push(G.boxAt(0.60, h.roof + 0.09, 1.98, 0.34, 0.14, 0.18, { col: [0.60, 0.62, 0.57] }));
    /* grab handles */
    hull.push(G.xf(G.torus(0.10, 0.018, 10, 5, { col: [0.5, 0.5, 0.47] }), M4.mulAll(M4.translation(-1.15, h.roof + 0.03, 0.4), M4.rotationX(Math.PI / 2))));
    hull.push(G.xf(G.torus(0.10, 0.018, 10, 5, { col: [0.5, 0.5, 0.47] }), M4.mulAll(M4.translation(1.15, h.roof + 0.03, 0.4), M4.rotationX(Math.PI / 2))));
    /* weld beads down the hull sides */
    hull.push(G.rivetRow([-h.sideX - 0.01, 1.06, h.tailZ + 0.4], [-h.sideX - 0.01, 1.06, h.noseZ - 1.5], 14, 0.035, { col: [0.6, 0.6, 0.56] }));
    hull.push(G.rivetRow([h.sideX + 0.01, 1.06, h.tailZ + 0.4], [h.sideX + 0.01, 1.06, h.noseZ - 1.5], 14, 0.035, { col: [0.6, 0.6, 0.56] }));

    var hullG = G.merge(hull);
    /* bake a little dirt: darker low down */
    G.shade(hullG, function (x, y) { return 0.80 + MU.clamp((y - 0.3) / 1.6, 0, 1) * 0.32; });
    this.parts.hull = R.mesh(hullG);
    this.texHull = camo;

    /* headlight lenses (emissive, drawn separately) */
    this.parts.lens = R.mesh(G.merge([
      G.xf(G.disc(0.13, 12, { col: [1, 1, 1] }), M4.mulAll(M4.translation(-1.0, 1.52, 2.40), M4.rotationX(-Math.PI / 2))),
      G.xf(G.disc(0.13, 12, { col: [1, 1, 1] }), M4.mulAll(M4.translation(1.0, 1.52, 2.40), M4.rotationX(-Math.PI / 2)))
    ]));

    /* ================= HATCHES ================= */
    /* driver hatch: hinged at its rear edge, opens up and back */
    this.parts.driverHatch = R.mesh(G.merge([
      G.at(G.cyl(0.34, 0.34, 0.07, 16, { col: [0.80, 0.82, 0.78] }), 0, 0, 0.34),
      G.at(G.box(0.18, 0.05, 0.10, { col: [0.5, 0.5, 0.47] }), 0.20, 0.06, 0.34)
    ]));
    this.parts.cmdHatch = R.mesh(G.merge([
      G.at(G.cyl(0.30, 0.30, 0.07, 16, { col: [0.80, 0.82, 0.78] }), 0, 0, 0.30),
      G.at(G.box(0.16, 0.05, 0.10, { col: [0.5, 0.5, 0.47] }), 0.16, 0.06, 0.30)
    ]));

    /* ================= TURRET ================= */
    var t = [];
    var tc = [0.86, 0.88, 0.84];
    /* main body: slightly tapered cast shape */
    t.push(G.at(G.cyl(tu.r, tu.r * 0.93, tu.h, 22, { col: tc, uvScale: [3, 1] }), 0, tu.h / 2, 0));
    /* roof plate */
    t.push(G.at(G.disc(tu.r * 0.94, 22, { col: tc }), 0, tu.h, 0));
    /* front cheeks / mantlet housing */
    t.push(G.at(G.box(0.92, 0.62, 0.5, { col: tc }), 0, gu.trunY, gu.trunZ + 0.18));
    /* rear bustle for the radio */
    t.push(G.at(G.cyl(0.62, 0.58, tu.h * 0.92, 14, { col: tc }), 0, tu.h * 0.46, -0.82));
    /* commander's cupola */
    t.push(G.at(G.cyl(0.34, 0.33, 0.24, 14, { col: tc }), -0.30, tu.h + 0.12, -0.60));
    t.push(G.at(G.ring(0.24, 0.34, 14, { col: [0.7, 0.72, 0.67] }), -0.30, tu.h + 0.24, -0.60));
    /* loader's hatch rim */
    t.push(G.at(G.ring(0.26, 0.34, 14, { col: [0.7, 0.72, 0.67] }), 0.46, tu.h + 0.01, -0.16));
    /* vision blocks around the cupola */
    for (var v = 0; v < 6; v++) {
      var a = v / 6 * Math.PI * 2;
      t.push(G.xf(G.box(0.16, 0.09, 0.04, { col: [0.12, 0.14, 0.15] }),
        M4.mulAll(M4.translation(-0.30 + Math.sin(a) * 0.335, tu.h + 0.13, -0.60 + Math.cos(a) * 0.335), M4.rotationY(a))));
    }
    /* AA machine gun on the cupola */
    t.push(G.at(G.box(0.10, 0.10, 0.5, { col: [0.22, 0.21, 0.20] }), -0.30, tu.h + 0.42, -0.42));
    t.push(G.xf(G.cyl(0.03, 0.028, 0.7, 8, { col: [0.18, 0.17, 0.16] }),
      M4.mulAll(M4.translation(-0.30, tu.h + 0.44, -0.05), M4.rotationX(Math.PI / 2))));
    /* gunner's sight port */
    t.push(G.at(G.box(0.13, 0.10, 0.10, { col: [0.14, 0.15, 0.16] }), -0.52, gu.trunY + 0.14, tu.r * 0.86));
    /* stowage basket at the rear */
    var basket = [];
    for (var b = 0; b < 9; b++) {
      var ba = -1.4 + b / 8 * 2.8;
      basket.push(G.xf(G.box(0.03, 0.34, 0.03, { col: [0.45, 0.46, 0.42] }),
        M4.translation(Math.sin(ba) * 0.95, 0.18, -0.9 + Math.cos(ba) * 0.35)));
    }
    basket.push(G.at(G.torus(0.62, 0.022, 16, 5, { col: [0.45, 0.46, 0.42] }), 0, 0.34, -1.05));
    t.push(G.merge(basket));
    /* tarpaulin roll in the basket */
    t.push(G.xf(G.cyl(0.16, 0.16, 0.9, 10, { col: [0.42, 0.40, 0.33] }),
      M4.mulAll(M4.translation(0, 0.30, -1.12), M4.rotationZ(Math.PI / 2))));
    /* smoke grenade launchers */
    for (var sg = 0; sg < 3; sg++) {
      t.push(G.xf(G.cyl(0.05, 0.05, 0.2, 8, { col: [0.4, 0.42, 0.38] }),
        M4.mulAll(M4.translation(0.72 + sg * 0.09, tu.h * 0.72, 0.42 - sg * 0.12), M4.rotationX(-0.5))));
    }
    /* antenna base */
    t.push(G.at(G.cyl(0.05, 0.045, 0.12, 8, { col: [0.35, 0.36, 0.33] }), 0.62, tu.h + 0.06, -0.72));
    /* grab rails */
    t.push(G.xf(G.torus(0.13, 0.02, 10, 5, { col: [0.5, 0.5, 0.47] }), M4.mulAll(M4.translation(0.9, tu.h * 0.5, -0.3), M4.rotationZ(Math.PI / 2))));
    t.push(G.xf(G.torus(0.13, 0.02, 10, 5, { col: [0.5, 0.5, 0.47] }), M4.mulAll(M4.translation(-0.9, tu.h * 0.5, -0.3), M4.rotationZ(Math.PI / 2))));
    /* turret number stencil plate */
    var turretG = G.merge(t);
    G.shade(turretG, function (x, y) { return 0.86 + MU.clamp(y / tu.h, 0, 1) * 0.24; });
    this.parts.turret = R.mesh(turretG);

    this.parts.turretNumber = R.mesh(G.xf(G.quad(0.55, 0.30), M4.mulAll(M4.translation(-tu.r * 0.99, tu.h * 0.55, -0.25), M4.rotationY(-Math.PI / 2))));
    this.texNumber = A.label('7', { w: 128, h: 128, transparent: true, color: '#e7e2d0' });

    /* antenna whip (drawn separately so it can sway) */
    this.parts.antenna = R.mesh(G.at(G.cyl(0.012, 0.006, 2.1, 6, { col: [0.15, 0.15, 0.14] }), 0, 1.05, 0));

    /* ================= GUN ================= */
    var gunParts = [];
    /* mantlet */
    gunParts.push(G.at(G.sphere(0.34, 14, 9, { col: [0.84, 0.86, 0.82] }), 0, 0, 0.1));
    gunParts.push(G.xf(G.cyl(0.30, 0.26, 0.3, 14, { col: [0.84, 0.86, 0.82] }),
      M4.mulAll(M4.translation(0, 0, 0.3), M4.rotationX(Math.PI / 2))));
    /* barrel */
    gunParts.push(G.xf(G.cyl(gu.r * 1.35, gu.r, gu.len * 0.45, 14, { col: [0.60, 0.62, 0.58] }),
      M4.mulAll(M4.translation(0, 0, 0.42 + gu.len * 0.225), M4.rotationX(Math.PI / 2))));
    gunParts.push(G.xf(G.cyl(gu.r, gu.r * 0.94, gu.len * 0.58, 14, { col: [0.58, 0.60, 0.56] }),
      M4.mulAll(M4.translation(0, 0, 0.42 + gu.len * 0.45 + gu.len * 0.29 - 0.1), M4.rotationX(Math.PI / 2))));
    /* muzzle brake */
    var mz = 0.42 + gu.len * 0.98 - 0.1;
    gunParts.push(G.xf(G.cyl(gu.r * 1.45, gu.r * 1.45, 0.38, 14, { col: [0.5, 0.52, 0.48] }),
      M4.mulAll(M4.translation(0, 0, mz), M4.rotationX(Math.PI / 2))));
    gunParts.push(G.xf(G.box(0.09, 0.34, 0.16, { col: [0.42, 0.44, 0.40] }), M4.translation(0, 0, mz)));
    gunParts.push(G.xf(G.cyl(gu.r * 1.5, gu.r * 1.2, 0.06, 14, { col: [0.30, 0.30, 0.28] }),
      M4.mulAll(M4.translation(0, 0, mz + 0.22), M4.rotationX(Math.PI / 2))));
    /* coaxial machine gun barrel next to the main gun */
    gunParts.push(G.xf(G.cyl(0.035, 0.03, 0.8, 8, { col: [0.2, 0.19, 0.18] }),
      M4.mulAll(M4.translation(0.26, -0.02, 0.75), M4.rotationX(Math.PI / 2))));
    var gunG = G.merge(gunParts);
    this.parts.gun = R.mesh(gunG);
    this.muzzleLocal = mz + 0.26;   /* along +Z in gun space */

    /* ================= RUNNING GEAR ================= */
    /* Closed track belt path in the (z,y) plane: bottom run, front arc,
       top run, rear arc. Traversed clockwise, so the outward normal of a
       tangent (dz,dy) is (0, -dz, dy).                                       */
    var i;
    var by = tr.bottomY, ty = tr.topY, fz = tr.frontZ, rz = tr.rearZ, rr = tr.r;
    var cy = (by + ty) / 2;
    function belt() {
      var pts = [], k, ang;
      for (k = 0; k <= 14; k++) pts.push([rz + (fz - rz) * (k / 14), by]);
      for (k = 1; k <= 9; k++) { ang = -Math.PI / 2 + (k / 9) * Math.PI; pts.push([fz + Math.cos(ang) * rr, cy + Math.sin(ang) * rr]); }
      for (k = 1; k <= 14; k++) pts.push([fz - (fz - rz) * (k / 14), ty]);
      for (k = 1; k <= 9; k++) { ang = Math.PI / 2 + (k / 9) * Math.PI; pts.push([rz + Math.cos(ang) * rr, cy + Math.sin(ang) * rr]); }
      return pts;
    }
    var bp = belt();
    /* extrude the belt across X, with uv V running along the loop so the
       whole band can be scrolled by animating uvOffset[1] */
    function beltGeom(width) {
      var g = G.empty();
      var total = 0, lens = [0], k;
      for (k = 1; k < bp.length; k++) {
        total += Math.sqrt(Math.pow(bp[k][0] - bp[k - 1][0], 2) + Math.pow(bp[k][1] - bp[k - 1][1], 2));
        lens.push(total);
      }
      var col = [0.34, 0.33, 0.31];
      var linkLen = 0.30;
      var hw = width / 2;
      for (var s2 = 0; s2 + 1 < bp.length; s2++) {
        var p0 = bp[s2], p1 = bp[s2 + 1];
        var dz = p1[0] - p0[0], dy = p1[1] - p0[1];
        var l = Math.sqrt(dz * dz + dy * dy) || 1;
        var ny = -dz / l, nz = dy / l;
        var v0 = lens[s2] / linkLen, v1 = lens[s2 + 1] / linkLen;
        var base = g.p.length / 3;
        g.p.push(-hw, p0[1], p0[0], hw, p0[1], p0[0], hw, p1[1], p1[0], -hw, p1[1], p1[0]);
        for (var q = 0; q < 4; q++) { g.n.push(0, ny, nz); g.c.push(col[0], col[1], col[2]); }
        g.t.push(0, v0, 1, v0, 1, v1, 0, v1);
        g.i.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }
      return g;
    }
    var beltG = beltGeom(tr.w);
    this.parts.belt = R.mesh(beltG);
    this.texTread = tread;

    /* road wheels, sprocket, idler, return rollers (one side, mirrored) */
    var wheelCol = [0.42, 0.43, 0.40];
    var wheelG = G.merge([
      G.xf(G.cyl(tr.r, tr.r, tr.w * 0.42, 16, { col: wheelCol }), M4.rotationZ(Math.PI / 2)),
      G.xf(G.cyl(tr.r * 0.55, tr.r * 0.55, tr.w * 0.5, 12, { col: [0.5, 0.51, 0.48] }), M4.rotationZ(Math.PI / 2)),
      G.xf(G.cyl(tr.r * 0.14, tr.r * 0.14, tr.w * 0.62, 8, { col: [0.55, 0.56, 0.52] }), M4.rotationZ(Math.PI / 2))
    ]);
    /* bolt circle so rotation is visible */
    for (var bw = 0; bw < 6; bw++) {
      var bwa = bw / 6 * Math.PI * 2;
      wheelG = G.merge([wheelG, G.at(G.cyl(0.035, 0.035, tr.w * 0.46, 6, { col: [0.3, 0.3, 0.28] }),
        Math.cos(bwa) * 0, tr.r * 0.34 * Math.sin(bwa), tr.r * 0.34 * Math.cos(bwa))]);
    }
    this.parts.wheel = R.mesh(wheelG);
    var sprocketG = [G.xf(G.cyl(tr.r * 0.78, tr.r * 0.78, tr.w * 0.4, 14, { col: [0.46, 0.47, 0.44] }), M4.rotationZ(Math.PI / 2))];
    for (var te = 0; te < 12; te++) {
      var ta = te / 12 * Math.PI * 2;
      sprocketG.push(G.xf(G.box(tr.w * 0.42, 0.11, 0.09, { col: [0.40, 0.41, 0.38] }),
        M4.mulAll(M4.rotationX(-ta), M4.translation(0, tr.r * 0.86, 0))));
    }
    this.parts.sprocket = R.mesh(G.merge(sprocketG));
    this.parts.roller = R.mesh(G.xf(G.cyl(0.13, 0.13, tr.w * 0.4, 10, { col: [0.44, 0.45, 0.42] }), M4.rotationZ(Math.PI / 2)));
    /* suspension bogie arms */
    var susp = [];
    this.wheelZ = [-2.16, -1.30, -0.44, 0.44, 1.30, 2.16];
    for (i = 0; i < this.wheelZ.length; i++) {
      susp.push(G.boxAt(0, 0.86, this.wheelZ[i], tr.w * 0.5, 0.34, 0.26, { col: [0.5, 0.51, 0.48] }));
    }
    susp.push(G.boxSpan(-tr.w * 0.3, 0.95, tr.rearZ, tr.w * 0.3, 1.06, tr.frontZ, { col: [0.55, 0.56, 0.52] }));
    this.parts.susp = R.mesh(G.merge(susp));
    this.rollerZ = [-1.7, -0.6, 0.6, 1.7];
  };

  /* --------------------------------------------------------- transforms --- */
  /* world matrix of the turret, given the hull matrix */
  Tank.prototype.turretMatrix = function (hullMat, turretYaw) {
    return M4.mulAll(hullMat, M4.translation(0, D.turret.cy, D.turret.cz), M4.rotationY(turretYaw));
  };
  /* world matrix of the gun (origin at the trunnion, +Z down the bore) */
  Tank.prototype.gunMatrix = function (turretMat, gunPitch, recoil) {
    var m = M4.mulAll(turretMat, M4.translation(0, D.gun.trunY, D.gun.trunZ), M4.rotationX(-(gunPitch || 0)));
    if (recoil) m = M4.multiply(m, M4.translation(0, 0, -recoil));
    return m;
  };
  Tank.prototype.muzzle = function (hullMat, turretYaw, gunPitch, recoil) {
    var gm = this.gunMatrix(this.turretMatrix(hullMat, turretYaw), gunPitch, recoil);
    return {
      pos: M4.transformPoint(gm, [0, 0, this.muzzleLocal]),
      dir: V3.normalize(M4.transformDir(gm, [0, 0, 1])),
      up: V3.normalize(M4.transformDir(gm, [0, 1, 0]))
    };
  };

  /* --------------------------------------------------------------- draw --- */
  /* S: {hullMat, turretYaw, gunPitch, recoil, trackL, trackR, wheelSpin,
         driverHatch, cmdHatch, lights, interiorView, dead}                  */
  Tank.prototype.draw = function (R, S) {
    var tr = D.track, h = D.hull;
    var hullMat = S.hullMat;
    var turretMat = this.turretMatrix(hullMat, S.turretYaw);
    var gunMat = this.gunMatrix(turretMat, S.gunPitch, S.recoil);
    var matHull = { color: [1, 1, 1], tex: this.texHull, uvScale: [0.45, 0.45], spec: 0.10, shine: 18 };

    if (!S.interiorView) {
      R.draw(this.parts.hull, hullMat, matHull);
      R.draw(this.parts.turret, turretMat, matHull);
      R.draw(this.parts.turretNumber, turretMat, { color: [1, 1, 1], tex: this.texNumber, alpha: 0.999 });
      /* hatches */
      R.draw(this.parts.driverHatch,
        M4.mulAll(hullMat, M4.translation(0.60, h.roof + 0.05, 1.62 - 0.34), M4.rotationX(-(S.driverHatch || 0) * 1.9)),
        matHull);
      R.draw(this.parts.cmdHatch,
        M4.mulAll(turretMat, M4.translation(-0.30, D.turret.h + 0.26, -0.60 - 0.30), M4.rotationX(-(S.cmdHatch || 0) * 1.9)),
        matHull);
      /* antenna with a slow sway */
      var sway = Math.sin(S.time * 1.7) * 0.06 + (S.lateralG || 0) * 0.1;
      R.draw(this.parts.antenna,
        M4.mulAll(turretMat, M4.translation(0.62, D.turret.h + 0.1, -0.72), M4.rotationZ(sway), M4.rotationX(sway * 0.6)),
        { color: [0.2, 0.2, 0.19] });
      /* head- and tail-lights */
      R.draw(this.parts.lens, hullMat, {
        color: S.lights ? [1, 0.97, 0.85] : [0.35, 0.36, 0.34],
        emissive: S.lights ? [0.9, 0.85, 0.6] : [0, 0, 0], unlit: !!S.lights
      });
    }
    /* the gun is always drawn: the crew can see it through the ports */
    R.draw(this.parts.gun, gunMat, matHull);

    /* running gear: side 0 is the vehicle's LEFT (+X) */
    var sides = [1, -1];
    for (var s = 0; s < 2; s++) {
      var sx = sides[s] * tr.x;
      var dist = s === 0 ? S.trackL : S.trackR;
      var side = M4.multiply(hullMat, M4.translation(sx, 0, 0));
      R.draw(this.parts.belt, side, {
        color: [1, 1, 1], tex: this.texTread, uvScale: [1, 1],
        uvOffset: [0, -(dist || 0) / 0.30 % 1], spec: 0.22, shine: 30, doubleSided: true
      });
      R.draw(this.parts.susp, side, { color: [1, 1, 1], tex: this.texHull, uvScale: [0.5, 0.5] });
      var spin = -(dist || 0) / tr.r;
      for (var w = 0; w < this.wheelZ.length; w++) {
        R.draw(this.parts.wheel,
          M4.mulAll(side, M4.translation(0, tr.r + tr.bottomY - 0.02, this.wheelZ[w]), M4.rotationX(spin)),
          { color: [1, 1, 1], spec: 0.12 });
      }
      R.draw(this.parts.sprocket,
        M4.mulAll(side, M4.translation(0, (tr.bottomY + tr.topY) / 2, tr.rearZ), M4.rotationX(spin * (tr.r / (tr.r * 0.78)))),
        { color: [1, 1, 1], spec: 0.15 });
      R.draw(this.parts.sprocket,
        M4.mulAll(side, M4.translation(0, (tr.bottomY + tr.topY) / 2, tr.frontZ), M4.rotationX(spin * (tr.r / (tr.r * 0.78)))),
        { color: [1, 1, 1], spec: 0.15 });
      for (var rl = 0; rl < this.rollerZ.length; rl++) {
        R.draw(this.parts.roller,
          M4.mulAll(side, M4.translation(0, tr.topY - 0.14, this.rollerZ[rl]), M4.rotationX(spin * 3.3)),
          { color: [1, 1, 1] });
      }
    }
  };

  TS.Tank = Tank;
})(typeof window !== 'undefined' ? window : this);
