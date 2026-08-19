/* =============================================================================
 * sph.js - 3D fluid solver: smoothed particle hydrodynamics, solved with
 *          position based density constraints (PBF, Macklin & Mueller style).
 *          Written from scratch: no physics engine, no external library.
 *
 * Per substep:
 *   1. semi-implicit gravity integration + CFL speed clamp
 *   2. position prediction, hard container clamp
 *   3. uniform spatial hash (counting sort) + memory reorder for locality
 *   4. fixed-radius neighbour lists (27-cell scan, merged along x)
 *   5. K Jacobi iterations of the density constraint
 *          C_i = rho_i / rho_0 - 1 >= 0   (compression only)
 *          lambda_i = -C_i / (sum_k |grad_k C_i|^2 + eps)
 *          dp_i     = sum_j (lambda_i + lambda_j) g_ij + lambda_i g_wall
 *      Kernels: poly6 for density, spiky gradient for the constraint gradient.
 *      Walls contribute an analytic half-space density completion (kernel cap
 *      integral) plus its consistent gradient, so wall contact carries pressure
 *      instead of sucking particles into the boundary.
 *   6. velocity from position difference, XSPH viscosity
 *   7. wall collision response: normal restitution + tangential friction
 *
 * Determinism: fixed seed, fixed container, fixed timestep, fixed evaluation
 * order. Two runs on the same build produce the same trajectory.
 * ========================================================================== */
(function (global) {
  'use strict';
  var NS = global.CFD = global.CFD || {};

  /* ---- immutable scene scale (reproducibility) --------------------------- */
  var CONTAINER = { hx: 0.50, hy: 1.00, hz: 0.50 };   // metres: [-hx,hx] x [0,hy] x [-hz,hz]
  var FLUID_VOLUME = 0.304;                            // m^3 of water, independent of count
  var BLOCK = { w: 0.40, d: 0.95 };                    // dam-break column footprint (m)
  var REST_DENSITY = 1000.0;                           // kg/m^3
  var DEFAULT_SEED = 20240517;
  var MAX_NEIGHBORS = 72;
  var CAP_N = 64;                                      // boundary cap-integral table resolution
  var CFL = 0.90;                                      // max displacement per substep, in units of h
  var DELTA_LIMIT = 0.40;                              // max |dp| per iteration, in units of spacing
  var BOUNDARY_CAP = 0.85;                             // clamp on summed wall density completion
  var RESTING_DRAG = 6.0;                              // 1/s tangential drag for resting contact

  function mulberry32(a) {
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* linear lookup in a table sampled on [0,h] with CAP_N intervals */
  function tlerp(tab, f) {
    var k = f | 0;
    var a = f - k;
    return tab[k] + (tab[k + 1] - tab[k]) * a;
  }

  function FluidSolver(opts) {
    opts = opts || {};
    this.rho0 = REST_DENSITY;
    this.gravity = opts.gravity !== undefined ? opts.gravity : 9.81;
    this.viscosity = opts.viscosity !== undefined ? opts.viscosity : 0.20;
    this.restitution = opts.restitution !== undefined ? opts.restitution : 0.25;
    this.friction = opts.friction !== undefined ? opts.friction : 0.08;
    this.iterations = opts.iterations !== undefined ? opts.iterations : 3;
    this.substeps = opts.substeps !== undefined ? opts.substeps : 1;
    this.seed = opts.seed !== undefined ? opts.seed : DEFAULT_SEED;
    this.colorMode = 0;            // 0 velocity, 1 density
    this.velocityScale = 3.0;      // m/s mapped to the top of the colour ramp
    this.maxNeighbors = MAX_NEIGHBORS;
    this.lastDt = 1 / 60;
    this.timing = { neighbor: 0, solve: 0, velocity: 0, total: 0 };
    this.stats = {
      maxSpeed: 0, densityError: 0, densityErrorMax: 0, avgNeighbors: 0,
      nan: 0, escaped: 0, overflow: 0, frameAnomalies: 0
    };
    this.allocate(opts.count !== undefined ? opts.count : 3000);
    this.reset();
  }

  FluidSolver.prototype.allocate = function (n) {
    n = Math.max(64, Math.min(40000, n | 0));
    this.n = n;

    /* ---- discretisation derived from the fixed fluid volume ------------- */
    var d = Math.cbrt(FLUID_VOLUME / n);
    this.spacing = d;
    this.rc = 0.5 * d;                     // particle radius used for wall offset
    var h = 2.0 * d;
    this.h = h;
    this.h2 = h * h;
    this.poly6 = 315.0 / (64.0 * Math.PI * Math.pow(h, 9));
    this.spiky = 45.0 / (Math.PI * Math.pow(h, 6));
    this.w0 = this.poly6 * Math.pow(h, 6); // W(0)

    /* particle mass calibrated so a perfect lattice reads exactly rho0 */
    var sum = 0, R = Math.ceil(h / d), i, j, k, r2, t;
    for (i = -R; i <= R; i++) {
      for (j = -R; j <= R; j++) {
        for (k = -R; k <= R; k++) {
          r2 = (i * i + j * j + k * k) * d * d;
          if (r2 < this.h2) { t = this.h2 - r2; sum += this.poly6 * t * t * t; }
        }
      }
    }
    this.mass = this.rho0 / sum;

    /* constraint-force-mixing epsilon, scaled to the typical gradient size */
    var gTyp = (this.mass / this.rho0) * this.spiky * (0.5 * h) * (0.5 * h);
    this.eps = 0.25 * gTyp * gTyp;

    var f32 = function (m) { return new Float32Array(m); };
    this.x = f32(n); this.y = f32(n); this.z = f32(n);
    this.vx = f32(n); this.vy = f32(n); this.vz = f32(n);
    this.qx = f32(n); this.qy = f32(n); this.qz = f32(n);
    this.tmp = [f32(n), f32(n), f32(n), f32(n), f32(n), f32(n), f32(n), f32(n), f32(n)];
    this.vpx = f32(n); this.vpy = f32(n); this.vpz = f32(n);
    this.tvx = f32(n); this.tvy = f32(n); this.tvz = f32(n);
    this.ddx = f32(n); this.ddy = f32(n); this.ddz = f32(n);
    this.wgx = f32(n); this.wgy = f32(n); this.wgz = f32(n);
    this.lam = f32(n); this.dens = f32(n); this.idens = f32(n); this.cval = f32(n);
    this.packed = f32(n * 4);
    this.nbr = new Int32Array(n * this.maxNeighbors);
    this.gco = f32(n * this.maxNeighbors);
    this.nbrCount = new Int32Array(n);
    this.pcell = new Int32Array(n);
    this.order = new Int32Array(n);

    this.buildCapTable();
    this.buildGrid_dims();
  };

  /* Fraction of the poly6 kernel mass located beyond a plane at distance dw.
     dw = 0 -> 0.5 (half space), dw >= h -> 0. Numerically integrated once. */
  FluidSolver.prototype.buildCapTable = function () {
    var h = this.h, h2 = this.h2, poly6 = this.poly6;
    var cap = new Float32Array(CAP_N + 1);
    var der = new Float32Array(CAP_N + 1);
    var NU = 48, NS = 48, s, a, b, u, rmax, inner, r2, t, acc, du, ds;
    for (var idx = 0; idx <= CAP_N; idx++) {
      var dw = h * idx / CAP_N;
      acc = 0;
      du = (h - dw) / NU;
      for (a = 0; a < NU; a++) {
        u = -h + (a + 0.5) * du;                    // axial coordinate of the cap slice
        rmax = Math.sqrt(Math.max(0, h2 - u * u));
        ds = rmax / NS;
        inner = 0;
        for (b = 0; b < NS; b++) {
          s = (b + 0.5) * ds;
          r2 = u * u + s * s;
          if (r2 < h2) { t = h2 - r2; inner += poly6 * t * t * t * 6.283185307179586 * s * ds; }
        }
        acc += inner * du;
      }
      cap[idx] = acc;
    }
    var step = h / CAP_N;
    for (idx = 0; idx < CAP_N; idx++) der[idx] = (cap[idx + 1] - cap[idx]) / step;
    der[CAP_N] = 0;
    this.capTab = cap;
    this.capDer = der;
    this.capInvStep = CAP_N / h;
  };

  FluidSolver.prototype.buildGrid_dims = function () {
    var cs = this.h;
    this.cellSize = cs;
    this.gminx = -CONTAINER.hx - cs;
    this.gminy = -cs;
    this.gminz = -CONTAINER.hz - cs;
    this.gnx = Math.ceil((2 * CONTAINER.hx + 2 * cs) / cs) + 1;
    this.gny = Math.ceil((CONTAINER.hy + 2 * cs) / cs) + 1;
    this.gnz = Math.ceil((2 * CONTAINER.hz + 2 * cs) / cs) + 1;
    this.ncell = this.gnx * this.gny * this.gnz;
    this.cellStart = new Int32Array(this.ncell + 1);
    this.cellCnt = new Int32Array(this.ncell);
    this.cursor = new Int32Array(this.ncell);
  };

  FluidSolver.prototype.setCount = function (n) {
    if ((n | 0) === this.n) return;
    this.allocate(n);
    this.reset();
  };

  /* ---- initial state: dam-break column against the -X wall -------------- */
  FluidSolver.prototype.reset = function () {
    var rnd = mulberry32(this.seed);
    var n = this.n, d = this.spacing, rc = this.rc;
    var nx = Math.max(1, Math.floor(BLOCK.w / d));
    var nz = Math.max(1, Math.floor(BLOCK.d / d));
    var x0 = -CONTAINER.hx + rc + 0.2 * d;
    var z0 = -(nz - 1) * d * 0.5;
    var y0 = rc + 0.2 * d;
    var jit = 0.14 * d;
    var p = 0, ly = 0, iz, ix;
    while (p < n) {
      for (iz = 0; iz < nz && p < n; iz++) {
        for (ix = 0; ix < nx && p < n; ix++) {
          this.x[p] = x0 + ix * d + (rnd() * 2 - 1) * jit;
          this.y[p] = y0 + ly * d + (rnd() * 2 - 1) * jit;
          this.z[p] = z0 + iz * d + (rnd() * 2 - 1) * jit;
          this.vx[p] = 0; this.vy[p] = 0; this.vz[p] = 0;
          p++;
        }
      }
      ly++;
      if (ly > 100000) break;
    }
    this.clampAll(this.x, this.y, this.z);
    this.dens.fill(this.rho0);
    this.lam.fill(0);
    this.cval.fill(0);
    this.stats.maxSpeed = 0; this.stats.densityError = 0; this.stats.densityErrorMax = 0;
    this.stats.avgNeighbors = 0; this.stats.nan = 0; this.stats.escaped = 0;
    this.stats.overflow = 0; this.stats.frameAnomalies = 0;
    this.timing.neighbor = 0; this.timing.solve = 0; this.timing.velocity = 0; this.timing.total = 0;
    this.simTime = 0;
    this.stepIndex = 0;
    this.pack();
  };

  FluidSolver.prototype.clampAll = function (X, Y, Z) {
    var lo_x = -CONTAINER.hx + this.rc, hi_x = CONTAINER.hx - this.rc;
    var lo_y = this.rc, hi_y = CONTAINER.hy - this.rc;
    var lo_z = -CONTAINER.hz + this.rc, hi_z = CONTAINER.hz - this.rc;
    for (var i = 0; i < this.n; i++) {
      if (X[i] < lo_x) X[i] = lo_x; else if (X[i] > hi_x) X[i] = hi_x;
      if (Y[i] < lo_y) Y[i] = lo_y; else if (Y[i] > hi_y) Y[i] = hi_y;
      if (Z[i] < lo_z) Z[i] = lo_z; else if (Z[i] > hi_z) Z[i] = hi_z;
    }
  };

  /* ======================================================================= */
  FluidSolver.prototype.step = function (dtFrame) {
    var t0 = (global.performance || Date).now();
    this.timing.neighbor = 0; this.timing.solve = 0; this.timing.velocity = 0;
    var sub = Math.max(1, this.substeps | 0);
    var dt = dtFrame / sub;
    for (var s = 0; s < sub; s++) this.substep(dt);
    this.finalize();
    this.simTime += dtFrame;
    this.stepIndex++;
    this.timing.total = (global.performance || Date).now() - t0;
  };

  FluidSolver.prototype.substep = function (dt) {
    var perf = global.performance || Date;
    this.lastDt = dt;
    var t0 = perf.now();
    this.predict(dt);
    this.hashGrid();
    this.reorder();
    this.neighbors();
    var t1 = perf.now();
    this.timing.neighbor += t1 - t0;
    var it = Math.max(1, this.iterations | 0);
    for (var k = 0; k < it; k++) { this.lambda(); this.delta(); }
    var t2 = perf.now();
    this.timing.solve += t2 - t1;
    this.vpx.set(this.vx); this.vpy.set(this.vy); this.vpz.set(this.vz);
    this.updateVelocity(dt);
    this.xsph();
    this.wallResponse();
    this.commit();
    this.timing.velocity += perf.now() - t2;
  };

  /* 1+2: gravity, CFL clamp, prediction, hard container clamp -------------- */
  FluidSolver.prototype.predict = function (dt) {
    var n = this.n, X = this.x, Y = this.y, Z = this.z;
    var VX = this.vx, VY = this.vy, VZ = this.vz;
    var QX = this.qx, QY = this.qy, QZ = this.qz;
    var g = this.gravity * dt;
    var vmax = CFL * this.h / dt, vmax2 = vmax * vmax;
    var lo_x = -CONTAINER.hx + this.rc, hi_x = CONTAINER.hx - this.rc;
    var lo_y = this.rc, hi_y = CONTAINER.hy - this.rc;
    var lo_z = -CONTAINER.hz + this.rc, hi_z = CONTAINER.hz - this.rc;
    for (var i = 0; i < n; i++) {
      var vx = VX[i], vy = VY[i] - g, vz = VZ[i];
      var s2 = vx * vx + vy * vy + vz * vz;
      if (s2 > vmax2) { var s = vmax / Math.sqrt(s2); vx *= s; vy *= s; vz *= s; }
      VX[i] = vx; VY[i] = vy; VZ[i] = vz;
      var px = X[i] + vx * dt, py = Y[i] + vy * dt, pz = Z[i] + vz * dt;
      if (px < lo_x) px = lo_x; else if (px > hi_x) px = hi_x;
      if (py < lo_y) py = lo_y; else if (py > hi_y) py = hi_y;
      if (pz < lo_z) pz = lo_z; else if (pz > hi_z) pz = hi_z;
      QX[i] = px; QY[i] = py; QZ[i] = pz;
    }
  };

  /* 3a: uniform grid via counting sort on predicted positions ------------- */
  FluidSolver.prototype.hashGrid = function () {
    var n = this.n, QX = this.qx, QY = this.qy, QZ = this.qz;
    var inv = 1 / this.cellSize, nx = this.gnx, ny = this.gny, nz = this.gnz;
    var nxy = nx * ny;
    var cnt = this.cellCnt, start = this.cellStart, cur = this.cursor;
    var pcell = this.pcell, order = this.order, ncell = this.ncell;
    cnt.fill(0);
    var i, cx, cy, cz, c;
    for (i = 0; i < n; i++) {
      cx = ((QX[i] - this.gminx) * inv) | 0;
      cy = ((QY[i] - this.gminy) * inv) | 0;
      cz = ((QZ[i] - this.gminz) * inv) | 0;
      if (cx < 0) cx = 0; else if (cx >= nx) cx = nx - 1;
      if (cy < 0) cy = 0; else if (cy >= ny) cy = ny - 1;
      if (cz < 0) cz = 0; else if (cz >= nz) cz = nz - 1;
      c = cx + cy * nx + cz * nxy;
      pcell[i] = c;
      cnt[c]++;
    }
    var acc = 0;
    for (c = 0; c < ncell; c++) { start[c] = acc; cur[c] = acc; acc += cnt[c]; }
    start[ncell] = acc;
    for (i = 0; i < n; i++) { c = pcell[i]; order[cur[c]++] = i; }
  };

  /* 3b: permute state into cell order so every later loop is cache-local -- */
  FluidSolver.prototype.reorder = function () {
    var n = this.n, ord = this.order, t = this.tmp;
    var src = [this.x, this.y, this.z, this.vx, this.vy, this.vz, this.qx, this.qy, this.qz];
    for (var a = 0; a < 9; a++) {
      var s = src[a], dst = t[a];
      for (var k = 0; k < n; k++) dst[k] = s[ord[k]];
    }
    this.x = t[0]; this.y = t[1]; this.z = t[2];
    this.vx = t[3]; this.vy = t[4]; this.vz = t[5];
    this.qx = t[6]; this.qy = t[7]; this.qz = t[8];
    this.tmp = src;
  };

  /* 4: fixed radius neighbour lists (27 cells, merged into 9 x-runs) ------ */
  FluidSolver.prototype.neighbors = function () {
    var X = this.qx, Y = this.qy, Z = this.qz;
    var nx = this.gnx, ny = this.gny, nz = this.gnz, nxy = nx * ny;
    var start = this.cellStart, nbr = this.nbr, ncnt = this.nbrCount;
    var maxN = this.maxNeighbors, h2 = this.h2;
    var runs = this._runs || (this._runs = new Int32Array(32));
    var cx, cy, cz, c, s0, s1, i, j, k, nr, t, dx, dy, dz, r2;
    var overflow = 0;
    for (cz = 0; cz < nz; cz++) {
      for (cy = 0; cy < ny; cy++) {
        for (cx = 0; cx < nx; cx++) {
          c = cx + cy * nx + cz * nxy;
          s0 = start[c]; s1 = start[c + 1];
          if (s1 === s0) continue;
          /* collect up to 9 contiguous index runs covering the 3x3x3 block */
          nr = 0;
          var x0 = cx > 0 ? cx - 1 : 0, x1 = cx < nx - 1 ? cx + 1 : nx - 1;
          for (var dzz = -1; dzz <= 1; dzz++) {
            var zz = cz + dzz; if (zz < 0 || zz >= nz) continue;
            for (var dyy = -1; dyy <= 1; dyy++) {
              var yy = cy + dyy; if (yy < 0 || yy >= ny) continue;
              var ca = x0 + yy * nx + zz * nxy;
              var cb = x1 + yy * nx + zz * nxy;
              var ra = start[ca], rb = start[cb + 1];
              if (rb > ra) { runs[nr++] = ra; runs[nr++] = rb; }
            }
          }
          for (i = s0; i < s1; i++) {
            var xi = X[i], yi = Y[i], zi = Z[i];
            var base = i * maxN, cnt = 0;
            for (t = 0; t < nr; t += 2) {
              var e = runs[t + 1];
              for (j = runs[t]; j < e; j++) {
                if (j === i) continue;
                dx = xi - X[j]; dy = yi - Y[j]; dz = zi - Z[j];
                r2 = dx * dx + dy * dy + dz * dz;
                if (r2 < h2) {
                  if (cnt < maxN) nbr[base + cnt++] = j;
                  else { overflow++; }
                }
              }
            }
            ncnt[i] = cnt;
          }
        }
      }
    }
    this.stats.overflow += overflow;
  };

  /* 5a: density, constraint value, lambda -------------------------------- */
  FluidSolver.prototype.lambda = function () {
    var n = this.n, X = this.qx, Y = this.qy, Z = this.qz;
    var nbr = this.nbr, ncnt = this.nbrCount, maxN = this.maxNeighbors, gco = this.gco;
    var h = this.h, h2 = this.h2, poly6 = this.poly6, mass = this.mass, rho0 = this.rho0;
    var gk = -(mass / rho0) * this.spiky;
    var eps = this.eps, selfRho = mass * this.w0;
    var lam = this.lam, dens = this.dens;
    var WGX = this.wgx, WGY = this.wgy, WGZ = this.wgz;
    var cap = this.capTab, capd = this.capDer, capInv = this.capInvStep;
    var hx = CONTAINER.hx, hy = CONTAINER.hy, hz = CONTAINER.hz;
    var mp = mass * poly6;

    for (var i = 0; i < n; i++) {
      var xi = X[i], yi = Y[i], zi = Z[i];
      var rho = selfRho, sx = 0, sy = 0, sz = 0, ss = 0;
      var base = i * maxN, cnt = ncnt[i];
      for (var k = 0; k < cnt; k++) {
        var j = nbr[base + k];
        var dx = xi - X[j], dy = yi - Y[j], dz = zi - Z[j];
        var r2 = dx * dx + dy * dy + dz * dz;
        if (r2 >= h2 || r2 < 1e-12) { gco[base + k] = 0; continue; }
        var t = h2 - r2;
        rho += mp * t * t * t;
        var r = Math.sqrt(r2), hr = h - r;
        var c = gk * hr * hr / r;
        gco[base + k] = c;
        var gx = c * dx, gy = c * dy, gz = c * dz;
        sx += gx; sy += gy; sz += gz;
        ss += gx * gx + gy * gy + gz * gz;
      }
      /* analytic wall completion: density + consistent gradient */
      var bd = 0, bx = 0, by = 0, bz = 0, dw, f;
      dw = xi + hx; if (dw < h) { f = (dw > 0 ? dw : 0) * capInv; bd += tlerp(cap, f); bx += tlerp(capd, f); }
      dw = hx - xi; if (dw < h) { f = (dw > 0 ? dw : 0) * capInv; bd += tlerp(cap, f); bx -= tlerp(capd, f); }
      dw = yi;      if (dw < h) { f = (dw > 0 ? dw : 0) * capInv; bd += tlerp(cap, f); by += tlerp(capd, f); }
      dw = hy - yi; if (dw < h) { f = (dw > 0 ? dw : 0) * capInv; bd += tlerp(cap, f); by -= tlerp(capd, f); }
      dw = zi + hz; if (dw < h) { f = (dw > 0 ? dw : 0) * capInv; bd += tlerp(cap, f); bz += tlerp(capd, f); }
      dw = hz - zi; if (dw < h) { f = (dw > 0 ? dw : 0) * capInv; bd += tlerp(cap, f); bz -= tlerp(capd, f); }
      if (bd > 0) {
        if (bd > BOUNDARY_CAP) { var sc = BOUNDARY_CAP / bd; bd = BOUNDARY_CAP; bx *= sc; by *= sc; bz *= sc; }
        rho += rho0 * bd;
        sx += bx; sy += by; sz += bz;
        ss += bx * bx + by * by + bz * bz;
        WGX[i] = bx; WGY[i] = by; WGZ[i] = bz;
      } else { WGX[i] = 0; WGY[i] = 0; WGZ[i] = 0; }

      dens[i] = rho;
      var C = rho / rho0 - 1;
      if (C < 0) C = 0;                                  // pressure under compression only
      lam[i] = -C / (ss + sx * sx + sy * sy + sz * sz + eps);
    }
  };

  /* 5b: Jacobi position correction + hard container clamp ---------------- */
  FluidSolver.prototype.delta = function () {
    var n = this.n, X = this.qx, Y = this.qy, Z = this.qz;
    var nbr = this.nbr, ncnt = this.nbrCount, maxN = this.maxNeighbors, gco = this.gco;
    var lam = this.lam, DX = this.ddx, DY = this.ddy, DZ = this.ddz;
    var WGX = this.wgx, WGY = this.wgy, WGZ = this.wgz;
    var lim = DELTA_LIMIT * this.spacing, lim2 = lim * lim;
    var i, k;
    for (i = 0; i < n; i++) {
      var li = lam[i];
      var ax = li * WGX[i], ay = li * WGY[i], az = li * WGZ[i];
      var base = i * maxN, cnt = ncnt[i];
      var xi = X[i], yi = Y[i], zi = Z[i];
      for (k = 0; k < cnt; k++) {
        var c = gco[base + k];
        if (c === 0) continue;
        var j = nbr[base + k];
        var s = (li + lam[j]) * c;
        ax += s * (xi - X[j]); ay += s * (yi - Y[j]); az += s * (zi - Z[j]);
      }
      var m2 = ax * ax + ay * ay + az * az;
      if (m2 > lim2) { var f = lim / Math.sqrt(m2); ax *= f; ay *= f; az *= f; }
      DX[i] = ax; DY[i] = ay; DZ[i] = az;
    }
    var lo_x = -CONTAINER.hx + this.rc, hi_x = CONTAINER.hx - this.rc;
    var lo_y = this.rc, hi_y = CONTAINER.hy - this.rc;
    var lo_z = -CONTAINER.hz + this.rc, hi_z = CONTAINER.hz - this.rc;
    for (i = 0; i < n; i++) {
      var px = X[i] + DX[i], py = Y[i] + DY[i], pz = Z[i] + DZ[i];
      if (px < lo_x) px = lo_x; else if (px > hi_x) px = hi_x;
      if (py < lo_y) py = lo_y; else if (py > hi_y) py = hi_y;
      if (pz < lo_z) pz = lo_z; else if (pz > hi_z) pz = hi_z;
      X[i] = px; Y[i] = py; Z[i] = pz;
    }
  };

  /* 6a: velocity from the solved positions ------------------------------- */
  FluidSolver.prototype.updateVelocity = function (dt) {
    var n = this.n, inv = 1 / dt;
    var X = this.x, Y = this.y, Z = this.z, QX = this.qx, QY = this.qy, QZ = this.qz;
    var VX = this.vx, VY = this.vy, VZ = this.vz;
    for (var i = 0; i < n; i++) {
      VX[i] = (QX[i] - X[i]) * inv;
      VY[i] = (QY[i] - Y[i]) * inv;
      VZ[i] = (QZ[i] - Z[i]) * inv;
    }
  };

  /* 6b: XSPH viscosity --------------------------------------------------- */
  FluidSolver.prototype.xsph = function () {
    var c = 0.5 * this.viscosity;
    if (c <= 0) return;
    var n = this.n, X = this.qx, Y = this.qy, Z = this.qz;
    var VX = this.vx, VY = this.vy, VZ = this.vz;
    var TX = this.tvx, TY = this.tvy, TZ = this.tvz;
    var nbr = this.nbr, ncnt = this.nbrCount, maxN = this.maxNeighbors;
    var h2 = this.h2, mp = this.mass * this.poly6, dens = this.dens, id = this.idens;
    var i, k;
    for (i = 0; i < n; i++) { var dj = dens[i]; id[i] = dj > 1e-6 ? mp / dj : 0; }
    for (i = 0; i < n; i++) {
      var xi = X[i], yi = Y[i], zi = Z[i];
      var vxi = VX[i], vyi = VY[i], vzi = VZ[i];
      var ax = 0, ay = 0, az = 0;
      var base = i * maxN, cnt = ncnt[i];
      for (k = 0; k < cnt; k++) {
        var j = nbr[base + k];
        var dx = xi - X[j], dy = yi - Y[j], dz = zi - Z[j];
        var r2 = dx * dx + dy * dy + dz * dz;
        if (r2 >= h2) continue;
        var t = h2 - r2;
        var w = id[j] * t * t * t;
        ax += (VX[j] - vxi) * w; ay += (VY[j] - vyi) * w; az += (VZ[j] - vzi) * w;
      }
      TX[i] = vxi + c * ax; TY[i] = vyi + c * ay; TZ[i] = vzi + c * az;
    }
    this.vx = TX; this.vy = TY; this.vz = TZ;
    this.tvx = VX; this.tvy = VY; this.tvz = VZ;
  };

  /* 7: wall collision response - restitution on the normal, friction on the
        tangent. The incoming normal speed is taken from the pre-solve
        velocity, because the constraint clamp has already removed it from the
        position difference. A threshold suppresses resting jitter. --------- */
  FluidSolver.prototype.wallResponse = function () {
    var n = this.n, QX = this.qx, QY = this.qy, QZ = this.qz;
    var VX = this.vx, VY = this.vy, VZ = this.vz;
    var PX = this.vpx, PY = this.vpy, PZ = this.vpz;
    var e = this.restitution;
    var kImp = 1 - this.friction;                                  /* per impact */
    var kRest = Math.exp(-this.friction * RESTING_DRAG * this.lastDt); /* per second */
    var tol = this.rc + 1e-4;
    var vth = 3 * this.gravity * this.lastDt;
    if (vth < 0.20) vth = 0.20;
    var hx = CONTAINER.hx, hy = CONTAINER.hy, hz = CONTAINER.hz;
    for (var i = 0; i < n; i++) {
      var vx = VX[i], vy = VY[i], vz = VZ[i];
      var px = QX[i], py = QY[i], pz = QZ[i], vin;
      /* floor, inward normal +Y */
      if (py <= tol) {
        vin = PY[i];
        if (vin < -vth) { vy = -e * vin; vx *= kImp; vz *= kImp; }
        else { if (vy < 0) vy = 0; vx *= kRest; vz *= kRest; }
      } else if (py >= hy - tol) {                 /* ceiling, inward normal -Y */
        vin = -PY[i];
        if (vin < -vth) { vy = e * vin; vx *= kImp; vz *= kImp; }
        else { if (vy > 0) vy = 0; vx *= kRest; vz *= kRest; }
      }
      /* -X wall, inward normal +X */
      if (px <= -hx + tol) {
        vin = PX[i];
        if (vin < -vth) { vx = -e * vin; vy *= kImp; vz *= kImp; }
        else { if (vx < 0) vx = 0; vy *= kRest; vz *= kRest; }
      } else if (px >= hx - tol) {                 /* +X wall, inward normal -X */
        vin = -PX[i];
        if (vin < -vth) { vx = e * vin; vy *= kImp; vz *= kImp; }
        else { if (vx > 0) vx = 0; vy *= kRest; vz *= kRest; }
      }
      /* -Z wall, inward normal +Z */
      if (pz <= -hz + tol) {
        vin = PZ[i];
        if (vin < -vth) { vz = -e * vin; vx *= kImp; vy *= kImp; }
        else { if (vz < 0) vz = 0; vx *= kRest; vy *= kRest; }
      } else if (pz >= hz - tol) {                 /* +Z wall, inward normal -Z */
        vin = -PZ[i];
        if (vin < -vth) { vz = e * vin; vx *= kImp; vy *= kImp; }
        else { if (vz > 0) vz = 0; vx *= kRest; vy *= kRest; }
      }
      VX[i] = vx; VY[i] = vy; VZ[i] = vz;
    }
  };

  FluidSolver.prototype.commit = function () {
    var t;
    t = this.x; this.x = this.qx; this.qx = t;
    t = this.y; this.y = this.qy; this.qy = t;
    t = this.z; this.z = this.qz; this.qz = t;
  };

  /* stats, integrity guard, colour attribute, GPU packing ---------------- */
  FluidSolver.prototype.finalize = function () {
    var n = this.n, X = this.x, Y = this.y, Z = this.z;
    var VX = this.vx, VY = this.vy, VZ = this.vz;
    var dens = this.dens, cval = this.cval, packed = this.packed, ncnt = this.nbrCount;
    var rho0 = this.rho0, mode = this.colorMode, invV = 1 / Math.max(1e-3, this.velocityScale);
    var lo_x = -CONTAINER.hx + this.rc, hi_x = CONTAINER.hx - this.rc;
    var lo_y = this.rc, hi_y = CONTAINER.hy - this.rc;
    var lo_z = -CONTAINER.hz + this.rc, hi_z = CONTAINER.hz - this.rc;
    var maxS2 = 0, derr = 0, dmax = 0, nan = 0, esc = 0, nsum = 0;
    for (var i = 0; i < n; i++) {
      var x = X[i], y = Y[i], z = Z[i], vx = VX[i], vy = VY[i], vz = VZ[i];
      var ok = (x - x === 0) && (y - y === 0) && (z - z === 0) &&
               (vx - vx === 0) && (vy - vy === 0) && (vz - vz === 0);
      if (!ok) {                                  /* deterministic respawn */
        nan++;
        x = 0; y = CONTAINER.hy * 0.5; z = 0; vx = 0; vy = 0; vz = 0;
        X[i] = x; Y[i] = y; Z[i] = z; VX[i] = 0; VY[i] = 0; VZ[i] = 0;
      }
      if (x < lo_x - 1e-4 || x > hi_x + 1e-4 || y < lo_y - 1e-4 ||
          y > hi_y + 1e-4 || z < lo_z - 1e-4 || z > hi_z + 1e-4) {
        esc++;
        if (x < lo_x) x = lo_x; else if (x > hi_x) x = hi_x;
        if (y < lo_y) y = lo_y; else if (y > hi_y) y = hi_y;
        if (z < lo_z) z = lo_z; else if (z > hi_z) z = hi_z;
        X[i] = x; Y[i] = y; Z[i] = z;
      }
      var s2 = vx * vx + vy * vy + vz * vz;
      if (s2 > maxS2) maxS2 = s2;
      var de = dens[i] / rho0 - 1;
      if (de > 0) { derr += de; if (de > dmax) dmax = de; }
      nsum += ncnt[i];
      var v;
      if (mode === 0) v = Math.sqrt(s2) * invV;
      else v = (dens[i] / rho0 - 0.60) * 1.8181818;    /* 0.60 .. 1.15 */
      if (v < 0) v = 0; else if (v > 1) v = 1;
      cval[i] = v;
      var o = i * 4;
      packed[o] = x; packed[o + 1] = y; packed[o + 2] = z; packed[o + 3] = v;
    }
    this.stats.maxSpeed = Math.sqrt(maxS2);
    this.stats.densityError = derr / n;
    this.stats.densityErrorMax = dmax;
    this.stats.avgNeighbors = nsum / n;
    this.stats.nan += nan;
    this.stats.escaped += esc;
    this.stats.frameAnomalies = nan + esc;
  };

  FluidSolver.prototype.pack = function () {
    var n = this.n, X = this.x, Y = this.y, Z = this.z, c = this.cval, p = this.packed;
    for (var i = 0; i < n; i++) {
      var o = i * 4;
      p[o] = X[i]; p[o + 1] = Y[i]; p[o + 2] = Z[i]; p[o + 3] = c[i];
    }
  };

  FluidSolver.prototype.anomalies = function () {
    return this.stats.nan + this.stats.escaped + this.stats.overflow;
  };

  NS.FluidSolver = FluidSolver;
  NS.CONTAINER = CONTAINER;
  NS.FLUID_VOLUME = FLUID_VOLUME;
  NS.BLOCK = BLOCK;
  NS.DEFAULT_SEED = DEFAULT_SEED;
})(typeof window !== 'undefined' ? window : globalThis);
