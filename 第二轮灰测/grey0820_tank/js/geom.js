/* =============================================================================
   geom.js - procedural geometry builders. Everything returns a plain object
   {p:[],n:[],t:[],c:[],i:[]} (positions, normals, uvs, vertex colours, indices)
   which gl.js uploads. Y is up. Boxes/cylinders are centred on the origin,
   cylinders run along +Y. All builders accept an optional opt.col tint.
   ========================================================================== */
(function (global) {
  'use strict';
  var TS = global.TS = global.TS || {};
  var M4 = TS.M4, V3 = TS.V3;

  function empty() { return { p: [], n: [], t: [], c: [], i: [] }; }

  function pushVert(g, x, y, z, nx, ny, nz, u, v, col) {
    g.p.push(x, y, z);
    g.n.push(nx, ny, nz);
    g.t.push(u, v);
    g.c.push(col[0], col[1], col[2]);
    return (g.p.length / 3) - 1;
  }

  var WHITE = [1, 1, 1];

  /* append src into dst, optionally transformed by 4x4 m */
  function add(dst, src, m) {
    var base = dst.p.length / 3, i;
    if (m) {
      var nm = M4.normalMatrix(m);
      var tmp = [0, 0, 0];
      for (i = 0; i < src.p.length; i += 3) {
        tmp[0] = src.p[i]; tmp[1] = src.p[i + 1]; tmp[2] = src.p[i + 2];
        M4.transformPoint(m, tmp, tmp);
        dst.p.push(tmp[0], tmp[1], tmp[2]);
        var nx = src.n[i], ny = src.n[i + 1], nz = src.n[i + 2];
        var rx = nm[0] * nx + nm[3] * ny + nm[6] * nz;
        var ry = nm[1] * nx + nm[4] * ny + nm[7] * nz;
        var rz = nm[2] * nx + nm[5] * ny + nm[8] * nz;
        var l = Math.sqrt(rx * rx + ry * ry + rz * rz) || 1;
        dst.n.push(rx / l, ry / l, rz / l);
      }
    } else {
      for (i = 0; i < src.p.length; i++) dst.p.push(src.p[i]);
      for (i = 0; i < src.n.length; i++) dst.n.push(src.n[i]);
    }
    for (i = 0; i < src.t.length; i++) dst.t.push(src.t[i]);
    for (i = 0; i < src.c.length; i++) dst.c.push(src.c[i]);
    for (i = 0; i < src.i.length; i++) dst.i.push(src.i[i] + base);
    return dst;
  }

  function merge(list) {
    var g = empty();
    for (var i = 0; i < list.length; i++) if (list[i]) add(g, list[i]);
    return g;
  }

  function xf(g, m) { return add(empty(), g, m); }
  function at(g, x, y, z) { return xf(g, M4.translation(x, y, z)); }

  function paint(g, col) {
    for (var i = 0; i < g.p.length / 3; i++) {
      g.c[i * 3] = col[0]; g.c[i * 3 + 1] = col[1]; g.c[i * 3 + 2] = col[2];
    }
    return g;
  }

  /* multiply existing vertex colours (for baked shading / dirt) */
  function shade(g, fn) {
    for (var i = 0; i < g.p.length / 3; i++) {
      var s = fn(g.p[i * 3], g.p[i * 3 + 1], g.p[i * 3 + 2], g.n[i * 3], g.n[i * 3 + 1], g.n[i * 3 + 2]);
      if (typeof s === 'number') {
        g.c[i * 3] *= s; g.c[i * 3 + 1] *= s; g.c[i * 3 + 2] *= s;
      } else if (s) {
        g.c[i * 3] *= s[0]; g.c[i * 3 + 1] *= s[1]; g.c[i * 3 + 2] *= s[2];
      }
    }
    return g;
  }

  function scaleUV(g, su, sv) {
    for (var i = 0; i < g.t.length; i += 2) { g.t[i] *= su; g.t[i + 1] *= sv; }
    return g;
  }

  /* ----------------------------------------------------------------- box --- */
  /* opt: {col, uvScale:[u,v], uvWorld:true (uv in metres), skip:{px,nx,py,ny,pz,nz}} */
  function box(w, h, d, opt) {
    opt = opt || {};
    var col = opt.col || WHITE;
    var g = empty();
    var hw = w / 2, hh = h / 2, hd = d / 2;
    var skip = opt.skip || {};
    var uw = opt.uvWorld ? 1 : 0;
    var us = opt.uvScale ? opt.uvScale[0] : 1;
    var vs = opt.uvScale ? opt.uvScale[1] : 1;

    function face(name, a, b, c, dd, nx, ny, nz, uSize, vSize) {
      if (skip[name]) return;
      var base = g.p.length / 3;
      var quads = [a, b, c, dd];
      var uvs = uw
        ? [[0, 0], [uSize, 0], [uSize, vSize], [0, vSize]]
        : [[0, 0], [1, 0], [1, 1], [0, 1]];
      for (var k = 0; k < 4; k++) {
        pushVert(g, quads[k][0], quads[k][1], quads[k][2], nx, ny, nz, uvs[k][0] * us, uvs[k][1] * vs, col);
      }
      g.i.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    /* +Z */ face('pz', [-hw, -hh, hd], [hw, -hh, hd], [hw, hh, hd], [-hw, hh, hd], 0, 0, 1, w, h);
    /* -Z */ face('nz', [hw, -hh, -hd], [-hw, -hh, -hd], [-hw, hh, -hd], [hw, hh, -hd], 0, 0, -1, w, h);
    /* +X */ face('px', [hw, -hh, hd], [hw, -hh, -hd], [hw, hh, -hd], [hw, hh, hd], 1, 0, 0, d, h);
    /* -X */ face('nx', [-hw, -hh, -hd], [-hw, -hh, hd], [-hw, hh, hd], [-hw, hh, -hd], -1, 0, 0, d, h);
    /* +Y */ face('py', [-hw, hh, hd], [hw, hh, hd], [hw, hh, -hd], [-hw, hh, -hd], 0, 1, 0, w, d);
    /* -Y */ face('ny', [-hw, -hh, -hd], [hw, -hh, -hd], [hw, -hh, hd], [-hw, -hh, hd], 0, -1, 0, w, d);
    return g;
  }

  function boxAt(cx, cy, cz, w, h, d, opt) {
    return at(box(w, h, d, opt), cx, cy, cz);
  }

  /* box spanning two corners */
  function boxSpan(x0, y0, z0, x1, y1, z1, opt) {
    return boxAt((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2,
      Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0), opt);
  }

  /* ------------------------------------------------------------ cylinder --- */
  /* opt: {col, caps:true, seg, phi0, phiLen, uvScale} along +Y, centred */
  function cyl(rb, rt, h, seg, opt) {
    opt = opt || {};
    seg = Math.max(3, seg || 16);
    var col = opt.col || WHITE;
    var caps = opt.caps !== false;
    var phi0 = opt.phi0 || 0;
    var phiLen = opt.phiLen === undefined ? Math.PI * 2 : opt.phiLen;
    var closed = Math.abs(phiLen - Math.PI * 2) < 1e-6;
    var g = empty();
    var hh = h / 2, k, a, ca, sa;
    var slope = (rb - rt) / h;
    var nl = Math.sqrt(1 + slope * slope);
    var count = closed ? seg : seg + 1;
    var ring0 = [], ring1 = [];
    for (k = 0; k < count; k++) {
      a = phi0 + phiLen * (k / seg);
      ca = Math.cos(a); sa = Math.sin(a);
      var u = k / seg;
      ring0.push(pushVert(g, ca * rb, -hh, sa * rb, ca / nl, slope / nl, sa / nl, u * (opt.uvScale ? opt.uvScale[0] : 1), 0, col));
      ring1.push(pushVert(g, ca * rt, hh, sa * rt, ca / nl, slope / nl, sa / nl, u * (opt.uvScale ? opt.uvScale[0] : 1), (opt.uvScale ? opt.uvScale[1] : 1), col));
    }
    for (k = 0; k < seg; k++) {
      var k2 = (k + 1) % count;
      if (!closed && k + 1 >= count) break;
      g.i.push(ring0[k], ring0[k2], ring1[k2], ring0[k], ring1[k2], ring1[k]);
    }
    if (caps) {
      if (rt > 1e-6) {
        var ct = pushVert(g, 0, hh, 0, 0, 1, 0, 0.5, 0.5, col);
        var top = [];
        for (k = 0; k < count; k++) {
          a = phi0 + phiLen * (k / seg); ca = Math.cos(a); sa = Math.sin(a);
          top.push(pushVert(g, ca * rt, hh, sa * rt, 0, 1, 0, 0.5 + ca * 0.5, 0.5 + sa * 0.5, col));
        }
        for (k = 0; k < (closed ? seg : seg); k++) {
          var t2 = (k + 1) % count;
          if (!closed && k + 1 >= count) break;
          g.i.push(ct, top[k], top[t2]);
        }
      }
      if (rb > 1e-6) {
        var cb = pushVert(g, 0, -hh, 0, 0, -1, 0, 0.5, 0.5, col);
        var bot = [];
        for (k = 0; k < count; k++) {
          a = phi0 + phiLen * (k / seg); ca = Math.cos(a); sa = Math.sin(a);
          bot.push(pushVert(g, ca * rb, -hh, sa * rb, 0, -1, 0, 0.5 + ca * 0.5, 0.5 + sa * 0.5, col));
        }
        for (k = 0; k < seg; k++) {
          var b2 = (k + 1) % count;
          if (!closed && k + 1 >= count) break;
          g.i.push(cb, bot[b2], bot[k]);
        }
      }
    }
    return g;
  }

  /* cylinder from point a to point b */
  function tube(a, b, r, seg, opt) {
    var d = V3.sub(b, a);
    var len = V3.len(d);
    if (len < 1e-6) return empty();
    var g = cyl(r, r, len, seg || 10, opt);
    var up = V3.normalize(d);
    var ref = Math.abs(up[1]) > 0.99 ? [1, 0, 0] : [0, 1, 0];
    var right = V3.normalize(V3.cross(ref, up));
    var fwd = V3.cross(right, up);
    var mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
    return xf(g, M4.fromBasis(right, up, fwd, mid));
  }

  /* polyline pipe with ball joints */
  function pipe(points, r, seg, opt) {
    var parts = [];
    for (var i = 0; i + 1 < points.length; i++) parts.push(tube(points[i], points[i + 1], r, seg || 8, opt));
    for (var j = 1; j + 1 < points.length; j++) parts.push(at(sphere(r * 1.02, seg || 8, 6, opt), points[j][0], points[j][1], points[j][2]));
    return merge(parts);
  }

  /* -------------------------------------------------------------- sphere --- */
  function sphere(r, su, sv, opt) {
    opt = opt || {};
    su = Math.max(3, su || 16); sv = Math.max(2, sv || 10);
    var col = opt.col || WHITE;
    var g = empty();
    var grid = [];
    for (var y = 0; y <= sv; y++) {
      var row = [];
      var v = y / sv, theta = v * Math.PI;
      for (var x = 0; x <= su; x++) {
        var u = x / su, phi = u * Math.PI * 2;
        var nx = Math.sin(theta) * Math.cos(phi);
        var ny = Math.cos(theta);
        var nz = Math.sin(theta) * Math.sin(phi);
        row.push(pushVert(g, nx * r, ny * r, nz * r, nx, ny, nz, u, 1 - v, col));
      }
      grid.push(row);
    }
    for (var yy = 0; yy < sv; yy++) {
      for (var xx = 0; xx < su; xx++) {
        var a = grid[yy][xx + 1], b = grid[yy][xx], c = grid[yy + 1][xx], d = grid[yy + 1][xx + 1];
        if (yy !== 0) g.i.push(a, b, d);
        if (yy !== sv - 1) g.i.push(b, c, d);
      }
    }
    return g;
  }

  /* dome: half sphere, opt.flip for downward */
  function dome(r, su, sv, opt) {
    opt = opt || {};
    su = Math.max(3, su || 16); sv = Math.max(1, sv || 6);
    var col = opt.col || WHITE;
    var g = empty(), grid = [];
    for (var y = 0; y <= sv; y++) {
      var row = [], v = y / sv, theta = v * Math.PI * 0.5;
      for (var x = 0; x <= su; x++) {
        var u = x / su, phi = u * Math.PI * 2;
        var ny = Math.cos(theta) * (opt.flip ? -1 : 1);
        var nx = Math.sin(theta) * Math.cos(phi);
        var nz = Math.sin(theta) * Math.sin(phi);
        row.push(pushVert(g, nx * r, ny * r, nz * r, nx, ny, nz, u, 1 - v, col));
      }
      grid.push(row);
    }
    for (var yy = 0; yy < sv; yy++) for (var xx = 0; xx < su; xx++) {
      var a = grid[yy][xx + 1], b = grid[yy][xx], c = grid[yy + 1][xx], d = grid[yy + 1][xx + 1];
      if (opt.flip) { g.i.push(a, d, b); g.i.push(b, d, c); }
      else { g.i.push(a, b, d); g.i.push(b, c, d); }
    }
    return g;
  }

  /* --------------------------------------------------------------- torus --- */
  function torus(R, r, su, sv, opt) {
    opt = opt || {};
    su = Math.max(3, su || 24); sv = Math.max(3, sv || 10);
    var col = opt.col || WHITE;
    var g = empty(), grid = [];
    for (var i = 0; i <= su; i++) {
      var row = [], u = i / su, phi = u * Math.PI * 2;
      var cx = Math.cos(phi) * R, cz = Math.sin(phi) * R;
      for (var j = 0; j <= sv; j++) {
        var v = j / sv, th = v * Math.PI * 2;
        var nr = Math.cos(th), ny = Math.sin(th);
        var nx = nr * Math.cos(phi), nz = nr * Math.sin(phi);
        row.push(pushVert(g, cx + nx * r, ny * r, cz + nz * r, nx, ny, nz, u * (su / 8), v, col));
      }
      grid.push(row);
    }
    for (var ii = 0; ii < su; ii++) for (var jj = 0; jj < sv; jj++) {
      var a = grid[ii][jj], b = grid[ii + 1][jj], c = grid[ii + 1][jj + 1], d = grid[ii][jj + 1];
      g.i.push(a, b, c, a, c, d);
    }
    return g;
  }

  /* ---------------------------------------------------------------- quad --- */
  /* XY plane, facing +Z, centred */
  function quad(w, h, opt) {
    opt = opt || {};
    var col = opt.col || WHITE;
    var g = empty(), hw = w / 2, hh = h / 2;
    var fu = opt.flipU ? -1 : 1;
    pushVert(g, -hw, -hh, 0, 0, 0, 1, fu < 0 ? 1 : 0, 0, col);
    pushVert(g, hw, -hh, 0, 0, 0, 1, fu < 0 ? 0 : 1, 0, col);
    pushVert(g, hw, hh, 0, 0, 0, 1, fu < 0 ? 0 : 1, 1, col);
    pushVert(g, -hw, hh, 0, 0, 0, 1, fu < 0 ? 1 : 0, 1, col);
    g.i.push(0, 1, 2, 0, 2, 3);
    return g;
  }

  /* horizontal disc facing +Y */
  function disc(r, seg, opt) {
    opt = opt || {};
    var col = opt.col || WHITE;
    seg = Math.max(3, seg || 20);
    var g = empty();
    var c = pushVert(g, 0, 0, 0, 0, 1, 0, 0.5, 0.5, col);
    var ring = [];
    for (var i = 0; i < seg; i++) {
      var a = i / seg * Math.PI * 2;
      ring.push(pushVert(g, Math.cos(a) * r, 0, Math.sin(a) * r, 0, 1, 0,
        0.5 + Math.cos(a) * 0.5, 0.5 + Math.sin(a) * 0.5, col));
    }
    for (var k = 0; k < seg; k++) g.i.push(c, ring[k], ring[(k + 1) % seg]);
    return g;
  }

  /* ---------------------------------------------------------------- wall --- */
  /* A wall in the XY plane (thickness t along Z, centred) with rectangular
     holes cut out. holes: [{x,y,w,h}] with x,y the hole centre in wall space.
     Implemented by slicing the wall into a grid of cells and emitting a box
     for every cell that is not inside a hole. */
  function wall(w, h, t, holes, opt) {
    holes = holes || [];
    var xs = [-w / 2, w / 2], ys = [-h / 2, h / 2], i;
    for (i = 0; i < holes.length; i++) {
      xs.push(holes[i].x - holes[i].w / 2, holes[i].x + holes[i].w / 2);
      ys.push(holes[i].y - holes[i].h / 2, holes[i].y + holes[i].h / 2);
    }
    function uniqSorted(arr, lo, hi) {
      arr = arr.filter(function (v) { return v > lo + 1e-6 && v < hi - 1e-6; });
      arr.push(lo, hi);
      arr.sort(function (a, b) { return a - b; });
      var out = [arr[0]];
      for (var k = 1; k < arr.length; k++) if (arr[k] - out[out.length - 1] > 1e-6) out.push(arr[k]);
      return out;
    }
    xs = uniqSorted(xs, -w / 2, w / 2);
    ys = uniqSorted(ys, -h / 2, h / 2);
    var parts = [];
    for (i = 0; i + 1 < xs.length; i++) {
      for (var j = 0; j + 1 < ys.length; j++) {
        var cx = (xs[i] + xs[i + 1]) / 2, cy = (ys[j] + ys[j + 1]) / 2;
        var inHole = false;
        for (var k2 = 0; k2 < holes.length; k2++) {
          var ho = holes[k2];
          if (cx > ho.x - ho.w / 2 && cx < ho.x + ho.w / 2 && cy > ho.y - ho.h / 2 && cy < ho.y + ho.h / 2) { inHole = true; break; }
        }
        if (inHole) continue;
        parts.push(boxAt(cx, cy, 0, xs[i + 1] - xs[i], ys[j + 1] - ys[j], t, opt));
      }
    }
    return merge(parts);
  }

  /* --------------------------------------------------------------- prism --- */
  /* extrude a convex 2D polygon (array of [x,y], CCW) along Z, centred */
  function prism(pts, depth, opt) {
    opt = opt || {};
    var col = opt.col || WHITE;
    var g = empty(), hd = depth / 2, i;
    var n = pts.length;
    /* front (+Z) */
    var f = [], b = [];
    for (i = 0; i < n; i++) f.push(pushVert(g, pts[i][0], pts[i][1], hd, 0, 0, 1, pts[i][0], pts[i][1], col));
    for (i = 1; i + 1 < n; i++) g.i.push(f[0], f[i], f[i + 1]);
    /* back (-Z) */
    for (i = 0; i < n; i++) b.push(pushVert(g, pts[i][0], pts[i][1], -hd, 0, 0, -1, pts[i][0], pts[i][1], col));
    for (i = 1; i + 1 < n; i++) g.i.push(b[0], b[i + 1], b[i]);
    /* sides */
    for (i = 0; i < n; i++) {
      var a = pts[i], c = pts[(i + 1) % n];
      var ex = c[0] - a[0], ey = c[1] - a[1];
      var l = Math.sqrt(ex * ex + ey * ey) || 1;
      var nx = ey / l, ny = -ex / l;
      var base = g.p.length / 3;
      pushVert(g, a[0], a[1], -hd, nx, ny, 0, 0, 0, col);
      pushVert(g, c[0], c[1], -hd, nx, ny, 0, l, 0, col);
      pushVert(g, c[0], c[1], hd, nx, ny, 0, l, depth, col);
      pushVert(g, a[0], a[1], hd, nx, ny, 0, 0, depth, col);
      g.i.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    return g;
  }

  /* --------------------------------------------------------------- lathe --- */
  /* revolve a profile [[r,y],...] (bottom to top) around the Y axis */
  function lathe(profile, seg, opt) {
    opt = opt || {};
    var col = opt.col || WHITE;
    seg = Math.max(3, seg || 20);
    var g = empty(), rings = [], i, j;
    for (i = 0; i < profile.length; i++) {
      var r = profile[i][0], y = profile[i][1];
      /* profile tangent for normals */
      var pi = profile[Math.max(0, i - 1)], ni = profile[Math.min(profile.length - 1, i + 1)];
      var dr = ni[0] - pi[0], dy = ni[1] - pi[1];
      var nl = Math.sqrt(dr * dr + dy * dy) || 1;
      var nr = dy / nl, nyy = -dr / nl;
      var ring = [];
      for (j = 0; j <= seg; j++) {
        var a = j / seg * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
        ring.push(pushVert(g, ca * r, y, sa * r, ca * nr, nyy, sa * nr, j / seg, i / (profile.length - 1), col));
      }
      rings.push(ring);
    }
    for (i = 0; i + 1 < rings.length; i++) {
      for (j = 0; j < seg; j++) {
        var A = rings[i][j], B = rings[i][j + 1], C = rings[i + 1][j + 1], D = rings[i + 1][j];
        g.i.push(A, B, C, A, C, D);
      }
    }
    return g;
  }

  /* ---------------------------------------------------------- height grid --- */
  /* plane in XZ, size w x d, nx*nz quads, y = fn(x,z), colour = colFn(x,y,z,slope) */
  function heightGrid(w, d, nx, nz, fn, colFn) {
    var g = empty(), grid = [], i, j;
    for (i = 0; i <= nz; i++) {
      var row = [];
      for (j = 0; j <= nx; j++) {
        var x = -w / 2 + w * (j / nx);
        var z = -d / 2 + d * (i / nz);
        var y = fn ? fn(x, z) : 0;
        row.push([x, y, z]);
      }
      grid.push(row);
    }
    var ids = [];
    var eps = Math.min(w / nx, d / nz) * 0.5;
    for (i = 0; i <= nz; i++) {
      var idrow = [];
      for (j = 0; j <= nx; j++) {
        var p = grid[i][j];
        /* central-difference normal */
        var hl = fn ? fn(p[0] - eps, p[2]) : 0, hr = fn ? fn(p[0] + eps, p[2]) : 0;
        var hd = fn ? fn(p[0], p[2] - eps) : 0, hu = fn ? fn(p[0], p[2] + eps) : 0;
        var nrm = V3.normalize([hl - hr, 2 * eps, hd - hu]);
        var col = colFn ? colFn(p[0], p[1], p[2], nrm) : WHITE;
        idrow.push(pushVert(g, p[0], p[1], p[2], nrm[0], nrm[1], nrm[2], j / nx * (nx / 4), i / nz * (nz / 4), col));
      }
      ids.push(idrow);
    }
    for (i = 0; i < nz; i++) for (j = 0; j < nx; j++) {
      var a = ids[i][j], b = ids[i][j + 1], c = ids[i + 1][j + 1], dd = ids[i + 1][j];
      g.i.push(a, c, b, a, dd, c);
    }
    return g;
  }

  /* --------------------------------------------------------------- misc ---- */
  /* rounded plate: a box with chamfered vertical edges, cheap via prism */
  function chamferPlate(w, h, t, cham, opt) {
    var c = Math.min(cham, Math.min(w, h) / 2.5);
    var pts = [
      [-w / 2 + c, -h / 2], [w / 2 - c, -h / 2], [w / 2, -h / 2 + c],
      [w / 2, h / 2 - c], [w / 2 - c, h / 2], [-w / 2 + c, h / 2],
      [-w / 2, h / 2 - c], [-w / 2, -h / 2 + c]
    ];
    return prism(pts, t, opt);
  }

  /* grid of rivet hemispheres along a line */
  function rivetRow(from, to, count, r, opt) {
    var parts = [];
    for (var i = 0; i < count; i++) {
      var t = count === 1 ? 0.5 : i / (count - 1);
      parts.push(at(dome(r, 7, 3, opt),
        from[0] + (to[0] - from[0]) * t,
        from[1] + (to[1] - from[1]) * t,
        from[2] + (to[2] - from[2]) * t));
    }
    return merge(parts);
  }

  /* a bolt: hex head approximation */
  function bolt(r, h, opt) {
    return merge([
      cyl(r, r, h, 6, opt),
      at(cyl(r * 0.5, r * 0.5, h * 0.4, 8, opt), 0, h * 0.6, 0)
    ]);
  }

  /* flat ring (washer) in XZ */
  function ring(r0, r1, seg, opt) {
    opt = opt || {};
    var col = opt.col || WHITE;
    seg = Math.max(3, seg || 24);
    var g = empty(), inner = [], outer = [];
    for (var i = 0; i <= seg; i++) {
      var a = i / seg * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      inner.push(pushVert(g, ca * r0, 0, sa * r0, 0, 1, 0, i / seg, 0, col));
      outer.push(pushVert(g, ca * r1, 0, sa * r1, 0, 1, 0, i / seg, 1, col));
    }
    for (var k = 0; k < seg; k++) {
      g.i.push(inner[k], outer[k], outer[k + 1], inner[k], outer[k + 1], inner[k + 1]);
    }
    return g;
  }

  function bbox(g) {
    var mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
    for (var i = 0; i < g.p.length; i += 3) {
      for (var k = 0; k < 3; k++) {
        if (g.p[i + k] < mn[k]) mn[k] = g.p[i + k];
        if (g.p[i + k] > mx[k]) mx[k] = g.p[i + k];
      }
    }
    return { min: mn, max: mx };
  }

  TS.G = {
    empty: empty, add: add, merge: merge, xf: xf, at: at, paint: paint, shade: shade,
    scaleUV: scaleUV, box: box, boxAt: boxAt, boxSpan: boxSpan, cyl: cyl, tube: tube,
    pipe: pipe, sphere: sphere, dome: dome, torus: torus, quad: quad, disc: disc,
    wall: wall, prism: prism, lathe: lathe, heightGrid: heightGrid,
    chamferPlate: chamferPlate, rivetRow: rivetRow, bolt: bolt, ring: ring, bbox: bbox
  };
})(typeof window !== 'undefined' ? window : this);
