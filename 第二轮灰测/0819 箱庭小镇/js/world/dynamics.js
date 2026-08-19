/* =============================================================
   js/world/dynamics.js — TOWN.Dynamics
   "everything that moves": road & rail traffic, water traffic, the
   fairground rides, machines, and the town's living population.

   ── CONVENTIONS (read before using) ──────────────────────────
   A · SINGLE-ENTITY factories are LOCAL, per docs/CONTRACT.md §2:
       origin = centre of footprint, sitting on y = 0, facing +Z.
         car boat pedestrian tram-section trafficLight ferrisWheel
         carousel swingRide playground swan dog cat windVane
       The layout positions / rotates these groups.

   B · ROUTE + WORLD factories are ABSOLUTE. They take
       `opts.points = [[x,y,z], ...]` (or `a`/`b`/`center`/`positions`)
       already expressed in **world coordinates**, build a
       THREE.CatmullRomCurve3 through them (Geo.catmullPath) and return
       a group that sits at the world origin — the followers themselves
       carry the absolute coordinates.  ADD THESE GROUPS AT (0,0,0) AND
       DO NOT ROTATE THEM.  They are tagged `userData.absolute = true`.
         traffic({points, closed=true})     tram({points, closed=true})
         bicycleRider({points, closed})     boats({points, closed=true})
         ducks({points, closed=true})       crowd({points, closed=true})
         mooredBoats({positions:[[x,y,z,ry],...]})
         cableCar({a:[x,y,z], b:[x,y,z]})   balloon({center:[x,y,z]})
         birds({center:[x,y,z]})            gulls({center:[x,y,z]})
         pigeons({center:[x,y,z]})
       Motion along a route is arc-length uniform: the curve is sampled
       with curve.getPointAt(t) / curve.getTangentAt(t) at BUILD time
       into a baked table (positions, unwrapped yaw, signed curvature),
       and the per-frame loop only interpolates that table — so a frame
       costs a few multiplies per entity and allocates nothing.
       Vehicles yaw to the tangent, bank into curvature and slow down
       slightly where the curve is tight.

   C · ANIMATION.  Everything animates itself.  There is exactly ONE
       ticker per system (never one per entity):
         dyn.traffic  cars, trams, cyclists, traffic signals
         dyn.water    boats, moored boats, swans, ducks
         dyn.rides    ferris wheels, carousels, swing rides, cable cars,
                      balloons, playgrounds
         dyn.life     pedestrians/crowds, dogs, cats, pigeons, birds
         dyn.wind     sway() clients (trees, flags…) + weather vanes
       Every animated group is wrapped in TOWN.markDynamic().
       All scratch vectors/quaternions/matrices live at module scope;
       nothing is allocated inside a per-frame loop and no geometry is
       ever rebuilt per frame — transforms only.

   D · NIGHT.  Head/tail lamps, ride bulbs, lit windows and lanterns use
       Mat.lamp / Mat.window / TOWN.halo, so they come up on their own at
       dusk.  Env.lampF additionally drives the fairground chase lights.
       Exactly ONE real PointLight in the whole module (the first ferris
       wheel hub), pushed to TOWN.Stage.nightLights.

   E · Wind: D.windDir(t) → radians, D.windStrength(t) → 0..1, slowly
       varying and shared by flags, vanes, smoke, sails and sway().
   ============================================================= */
(function (global) {
  'use strict';

  const T = global.THREE;
  const TOWN = global.TOWN;
  const U = TOWN.U, Geo = TOWN.Geo, Mat = TOWN.Mat, P = TOWN.Palette, Tex = TOWN.Tex;
  const D = TOWN.Dynamics = {};
  const TAU = U.TAU, PI = Math.PI;

  /* ============================================================
     0 · module-scope scratch  (never allocate in a frame loop)
     ============================================================ */
  const _v1 = new T.Vector3(), _v2 = new T.Vector3(), _v3 = new T.Vector3();
  const _v4 = new T.Vector3(), _v5 = new T.Vector3();
  const _q1 = new T.Quaternion(), _q2 = new T.Quaternion();
  const _e1 = new T.Euler(), _m1 = new T.Matrix4();
  const _sc1 = new T.Vector3(1, 1, 1);
  const _col = new T.Color();

  /* ============================================================
     1 · materials — 21 shared materials for the whole module.
     Everything that needs a colour uses ONE vertex-coloured material
     (M.paint / M.paintD) with the colour baked into cached geometry,
     which keeps 40 cars + 60 pedestrians inside the material budget.
     ============================================================ */
  const M = {
    paint: Mat.std(0xffffff, { vertexColors: true, flat: true, rough: 0.55, name: 'dyn_paint' }),
    paintD: Mat.std(0xffffff, { vertexColors: true, flat: true, rough: 0.7, side: T.DoubleSide, name: 'dyn_paintD' }),
    metal: Mat.std(P.metal, { rough: 0.36, metal: 0.55, flat: true, name: 'dyn_metal' }),
    dark: Mat.std(P.metalDark, { rough: 0.55, metal: 0.3, flat: true, name: 'dyn_dark' }),
    wood: Mat.std(P.wood, { rough: 0.78, flat: true, name: 'dyn_wood' }),
    woodDark: Mat.std(P.woodDark, { rough: 0.8, flat: true, name: 'dyn_woodDark' }),
    brass: Mat.std(P.brass, { rough: 0.3, metal: 0.7, flat: true, name: 'dyn_brass' }),
    glassCar: Mat.window(2),
    glassTram: Mat.window(3),
    glassCab: Mat.window(5),
    lamp: Mat.lamp(P.lampWarm, { max: 2.4 }),
    head: Mat.lamp(P.headlight, { max: 2.2 }),
    tail: Mat.lamp(P.taillight, { max: 1.4 }),
    fire: Mat.glow(P.fire, 1.15),
  };

  /* traffic-signal lenses: two groups so a junction can be complementary */
  const SIGM = [];
  function sigMats(grp) {
    grp = grp ? 1 : 0;
    if (SIGM[grp]) return SIGM[grp];
    const mk = (c, tag) => Mat.std(c, {
      emissive: c, emissiveIntensity: 0, rough: 0.34, flat: true, name: 'dyn_sig' + tag + grp,
    });
    SIGM[grp] = { red: mk(P.taillight, 'R'), amber: mk(P.flowerYellow, 'A'), green: mk(P.leafLime, 'G') };
    return SIGM[grp];
  }

  /* destination-board material (Tex.canvas), lights up at night */
  let _board = null;
  function boardMat() {
    if (_board) return _board;
    const tex = Tex.canvas('dyn_dest', 128, 32, (g, w, h) => {
      g.fillStyle = '#1b1f26'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#ffd9a0';
      g.font = 'bold 15px sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('2  HARBOUR', w / 2, h / 2 + 1);
      g.fillRect(4, 3, w - 8, 1.5); g.fillRect(4, h - 5, w - 8, 1.5);
    });
    const m = Mat.std(P.black, { rough: 0.5, flat: true, name: 'dyn_board' });
    if (!m.map) {
      m.map = tex; m.needsUpdate = true;
      m.emissive.set(P.windowWarm);
      Mat.registerNight(m, { on: 0.12, max: 0.85, flick: 0 }, 5);
    }
    _board = m; return m;
  }

  /* ============================================================
     2 · geometry helpers
     ------------------------------------------------------------
     NOTE Geo.fromQuads-based helpers (prism / chamferBox / taperBox /
     pyramid / hip / barrel / ribbon) wind their quads so that the
     computed normals point INWARD.  flip() reverses the winding and
     recomputes flat normals, so every volume in this module is a
     properly closed, outward-facing, flat-shaded solid.
     ============================================================ */
  function flip(geo) {
    // Ensure an OUTWARD-facing solid. (Historically Geo.fromQuads wound its
    // quads inward and this reversed them unconditionally; the core helper is
    // now correct, so reverse only when the signed volume says we must.)
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (Geo.signedVolume(g) < 0) {
      Geo.reverseWinding(g);
    } else {
      g.deleteAttribute('normal');
      g.computeVertexNormals();
    }
    return Geo.fixNormals(g);
  }

  /** loft(rings, capBottom, capTop) — the anti-cube workhorse.
   *  rings: [{plan:[[x,z]|[x,z,dy], ...], y}]  (equal point counts).
   *  Ring order sets the facing: bottom→top gives outward-facing sides (the
   *  usual case), top→bottom gives inward-facing sides — which is what an
   *  inner surface such as a boat's bulwark needs (verified in the probe).
   *  Gives tapered car bodies, boat hulls with a real sheer line,
   *  rounded tram shells, gondolas — all as one closed solid. */
  function loft(rings, capBot, capTop) {
    const n = rings[0].plan.length;
    const verts = [], faces = [];
    for (let k = 0; k < rings.length; k++) {
      const rg = rings[k], y = rg.y || 0, pl = rg.plan;
      for (let i = 0; i < n; i++) {
        const p = pl[i % pl.length];
        verts.push([p[0], y + (p[2] || 0), p[1]]);
      }
    }
    for (let k = 0; k < rings.length - 1; k++) {
      const o = k * n, o2 = o + n;
      for (let i = 0; i < n; i++) { const j = (i + 1) % n; faces.push([o + i, o + j, o2 + j, o2 + i]); }
    }
    if (capTop !== false) {
      const o = (rings.length - 1) * n;
      let cx = 0, cy = 0, cz = 0;
      for (let i = 0; i < n; i++) { cx += verts[o + i][0]; cy += verts[o + i][1]; cz += verts[o + i][2]; }
      verts.push([cx / n, cy / n, cz / n]);
      const c = verts.length - 1;
      for (let i = 0; i < n; i++) { const j = (i + 1) % n; faces.push([o + i, o + j, c]); }
    }
    if (capBot !== false) {
      let cx = 0, cy = 0, cz = 0;
      for (let i = 0; i < n; i++) { cx += verts[i][0]; cy += verts[i][1]; cz += verts[i][2]; }
      verts.push([cx / n, cy / n, cz / n]);
      const c = verts.length - 1;
      for (let i = 0; i < n; i++) { const j = (i + 1) % n; faces.push([j, i, c]); }
    }
    return flip(Geo.fromQuads(verts, faces));
  }

  /* plans (same winding convention as Geo.chamferBox) */
  function chamPlan(w, d, c) {
    const hw = w / 2, hd = d / 2;
    c = Math.min(c === undefined ? 0.1 : c, Math.min(w, d) * 0.4);
    return [[-hw + c, -hd], [hw - c, -hd], [hw, -hd + c], [hw, hd - c],
      [hw - c, hd], [-hw + c, hd], [-hw, hd - c], [-hw, -hd + c]];
  }
  function scaleP(plan, sx, sz) {
    const out = [];
    for (let i = 0; i < plan.length; i++) {
      const p = plan[i];
      out.push(p.length > 2 ? [p[0] * sx, p[1] * sz, p[2]] : [p[0] * sx, p[1] * sz]);
    }
    return out;
  }
  function insetP(plan, k) { return scaleP(plan, k, k); }
  function liftP(plan, fn) {
    const out = [];
    for (let i = 0; i < plan.length; i++) { const p = plan[i]; out.push([p[0], p[1], fn(p[0], p[1], i)]); }
    return out;
  }

  /** vehicle body plan: pointed-ish nose (+Z), slightly narrower tail */
  function carPlan(w, l, nose, tail) {
    const hw = w / 2, hl = l / 2;
    return [
      [-hw * tail, -hl], [hw * tail, -hl],
      [hw, -hl + l * 0.15], [hw, hl - l * 0.24],
      [hw * nose, hl], [-hw * nose, hl],
      [-hw, hl - l * 0.24], [-hw, -hl + l * 0.15],
    ];
  }

  /** boat plan: transom stern (−Z) → pointed bow (+Z), 16 points */
  const HULL_SHAPE = [
    [-1.00, 0.55], [-0.74, 0.86], [-0.40, 1.00], [-0.02, 0.99],
    [0.34, 0.90], [0.64, 0.70], [0.86, 0.42], [1.00, 0.07],
  ];
  function hullPlan(w, l, k) {
    const hw = (w / 2) * k, hl = l / 2, pts = [];
    for (let i = 0; i < HULL_SHAPE.length; i++) pts.push([HULL_SHAPE[i][1] * hw, HULL_SHAPE[i][0] * hl]);
    for (let i = HULL_SHAPE.length - 1; i >= 0; i--) pts.push([-HULL_SHAPE[i][1] * hw, HULL_SHAPE[i][0] * hl]);
    return pts;
  }

  function cyl(rTop, rBot, h, seg, open) {
    return new T.CylinderGeometry(rTop, rBot, h, seg || 6, 1, !!open);
  }
  /** a strut between two 3-D points (legs, spokes, chains, rigging) */
  function strut(a, b, r0, r1, seg) {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
    const len = Math.hypot(dx, dy, dz) || 0.001;
    const g = cyl(r1 === undefined ? r0 : r1, r0, len, seg || 4, false);
    _v1.set(dx / len, dy / len, dz / len); _v2.set(0, 1, 0);
    _q1.setFromUnitVectors(_v2, _v1);
    g.applyMatrix4(_m1.makeRotationFromQuaternion(_q1));
    g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
    return g;
  }
  function plane(w, h) { return new T.PlaneGeometry(w, h); }

  /* ---- vertex colour baking (one material, endless colours) ---- */
  function paintAll(geo, hex) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    const p = g.attributes.position, n = p.count;
    _col.set(hex);
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = _col.r; arr[i * 3 + 1] = _col.g; arr[i * 3 + 2] = _col.b; }
    g.setAttribute('color', new T.Float32BufferAttribute(arr, 3));
    return g;
  }
  /** per-triangle colours (crisp stripes / gores, no gradient bleed) */
  function paintFaces(geo, fn) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    const p = g.attributes.position, n = Math.floor(p.count / 3);
    const arr = new Float32Array(p.count * 3);
    for (let t = 0; t < n; t++) {
      const i0 = t * 3;
      let cx = 0, cy = 0, cz = 0;
      for (let k = 0; k < 3; k++) { cx += p.getX(i0 + k); cy += p.getY(i0 + k); cz += p.getZ(i0 + k); }
      _col.set(fn(cx / 3, cy / 3, cz / 3, t));
      for (let k = 0; k < 3; k++) {
        const q = (i0 + k) * 3;
        arr[q] = _col.r; arr[q + 1] = _col.g; arr[q + 2] = _col.b;
      }
    }
    g.setAttribute('color', new T.Float32BufferAttribute(arr, 3));
    return g;
  }
  /** merge [[geo,hex],...] into one vertex-coloured geometry */
  function tintMerge(parts) {
    const list = [];
    for (let i = 0; i < parts.length; i++) {
      const pr = parts[i];
      if (!pr || !pr[0]) continue;
      list.push(pr.length > 1 && pr[1] !== undefined ? paintAll(pr[0], pr[1]) : pr[0]);
    }
    return Geo.mergeGeometries(list);
  }

  /* ---- module-level geometry cache: 40 cars & 60 people are cheap ---- */
  const GEO = new Map();
  function G(key, build) {
    let g = GEO.get(key);
    if (!g) { g = build(); GEO.set(key, g); }
    return g;
  }
  D._geoCache = GEO;

  function finish(g, kind, w, d, h, extra) {
    g.userData.kind = kind;
    g.userData.footprint = { w: +w.toFixed(3), d: +d.toFixed(3) };
    g.userData.height = +h.toFixed(3);
    if (extra) for (const k in extra) g.userData[k] = extra[k];
    TOWN.markDynamic(g);
    return g;
  }
  function mesh(geo, mat, x, y, z) { return TOWN.mesh(geo, mat, x, y, z); }
  /** add a mesh only if the merged geometry actually has triangles */
  function addMesh(parent, geo, mat, x, y, z) {
    if (!geo || !geo.attributes || !geo.attributes.position || geo.attributes.position.count < 3) return null;
    const m = mesh(geo, mat, x, y, z);
    parent.add(m);
    return m;
  }

  /* ============================================================
     3 · wind — one shared, slowly varying field
     ============================================================ */
  D.windDir = function (t) {
    t = t || 0;
    return 0.55 + 0.85 * Math.sin(t * 0.037) + 0.34 * Math.sin(t * 0.0113 + 1.7)
      + 0.10 * Math.sin(t * 0.21 + 0.4);
  };
  D.windStrength = function (t) {
    t = t || 0;
    return U.saturate(0.42 + 0.30 * Math.sin(t * 0.047 + 0.5) + 0.17 * Math.sin(t * 0.019 + 2.2)
      + 0.08 * Math.sin(t * 0.31 + 1.1));
  };

  /* ============================================================
     4 · routes — absolute world points → baked, uniform-speed table
     ============================================================ */
  function makeRoute(points, closed) {
    let pts = [];
    if (points && points.length) {
      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        if (!p) continue;
        const x = +p[0], y = +(p[1] || 0), z = +(p[2] || 0);
        if (!isFinite(x) || !isFinite(y) || !isFinite(z)) continue;
        if (pts.length) {
          const q = pts[pts.length - 1];
          if (Math.abs(q[0] - x) < 0.02 && Math.abs(q[1] - y) < 0.02 && Math.abs(q[2] - z) < 0.02) continue;
        }
        pts.push([x, y, z]);
      }
    }
    if (pts.length < 2) {
      const b = pts[0] || [0, 0, 0];
      pts = [[b[0] - 5, b[1], b[2] - 5], [b[0] + 5, b[1], b[2] - 5],
        [b[0] + 5, b[1], b[2] + 5], [b[0] - 5, b[1], b[2] + 5]];
    }
    let cl = closed === undefined ? true : !!closed;
    if (pts.length < 3) cl = false;

    const curve = Geo.catmullPath(pts, cl, 16).curve;
    let len = curve.getLength();
    if (!isFinite(len) || len < 0.5) len = 0.5;
    const N = U.clamp(Math.round(len / 1.1), 24, 256) | 0;

    const pos = new Float32Array((N + 1) * 3);
    const yaw = new Float32Array(N + 1);
    const crv = new Float32Array(N + 1);
    let prev = 0;
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i <= N; i++) {
      const u = Math.min(1, i / N);
      curve.getPointAt(u, _v1);
      curve.getTangentAt(u, _v2);
      if (!isFinite(_v1.x) || !isFinite(_v1.y) || !isFinite(_v1.z)) _v1.set(0, 0, 0);
      pos[i * 3] = _v1.x; pos[i * 3 + 1] = _v1.y; pos[i * 3 + 2] = _v1.z;
      let raw = Math.atan2(_v2.x, _v2.z);
      if (!isFinite(raw)) raw = prev;
      prev = (i === 0) ? raw : prev + U.angleDelta(prev, raw);
      yaw[i] = prev;
      if (_v1.x < x0) x0 = _v1.x; if (_v1.x > x1) x1 = _v1.x;
      if (_v1.z < z0) z0 = _v1.z; if (_v1.z > z1) z1 = _v1.z;
      if (_v1.y > y1) y1 = _v1.y;
    }
    const ds = len / N;
    for (let i = 0; i < N; i++) crv[i] = (yaw[i + 1] - yaw[i]) / ds;
    crv[N] = cl ? crv[0] : crv[N - 1];

    return {
      curve, len, N, closed: cl, p: pos, y: yaw, c: crv, ds,
      box: { x0, x1, z0, z1, yMax: y1 },
      cx: (x0 + x1) / 2, cz: (z0 + z1) / 2,
      w: Math.max(1, x1 - x0), d: Math.max(1, z1 - z0),
    };
  }
  D.route = makeRoute;

  /* sample outputs land in these module scalars — zero allocation */
  let _sy = 0, _sc = 0;
  function sampleRoute(rt, s, out) {
    const len = rt.len, N = rt.N;
    if (rt.closed) { s = s % len; if (s < 0) s += len; }
    else { if (s < 0) s = 0; else if (s > len) s = len; }
    const u = (s / len) * N;
    let i = u | 0;
    if (i >= N) i = N - 1;
    if (i < 0) i = 0;
    const f = u - i, p = rt.p, a = i * 3, b = a + 3;
    out.set(p[a] + (p[b] - p[a]) * f,
      p[a + 1] + (p[b + 1] - p[a + 1]) * f,
      p[a + 2] + (p[b + 2] - p[a + 2]) * f);
    _sy = rt.y[i] + (rt.y[i + 1] - rt.y[i]) * f;
    _sc = rt.c[i];
    return out;
  }

  function routeInfo(rt, extra) {
    const o = { absolute: true, route: rt, samples: rt.N, length: +rt.len.toFixed(2) };
    if (extra) for (const k in extra) o[k] = extra[k];
    return o;
  }

  /* ============================================================
     5 · systems + the five shared tickers
     ============================================================ */
  const VEH = [];    // cars / trams / cyclists on routes
  const SIGS = [];   // traffic lights
  const WATER = [];  // boats, moored boats, waterfowl
  const RIDES = [];  // wheels, carousels, swings, cable cars, balloons, playgrounds
  const WALK = [];   // pedestrians
  const FLY = [];    // birds, gulls
  const PECK = [];   // instanced pigeon flocks
  const SWAY = [];   // sway() clients
  const VANES = [];  // weather vanes

  D._systems = { VEH, SIGS, WATER, RIDES, WALK, FLY, PECK, SWAY, VANES };

  /* ---- traffic ---------------------------------------------- */
  /* while true the step functions write the neutral (un-oscillated) pose,
     which is what a freshly built group should be measured/culled with */
  let _priming = false;

  function placePart(pt, m, s, dt, et) {
    const rt = m.rt;
    sampleRoute(rt, s, _v1);
    const base = _sy, crv = _sc;
    const lat = (m.lane + pt.lane) * m.dir;
    const o = pt.o;
    const bob = _priming ? 0 : Math.sin(et * pt.bf + pt.ph) * pt.ba;
    o.position.set(_v1.x + Math.cos(base) * lat,
      _v1.y + m.y0 + bob * 0.35,
      _v1.z - Math.sin(base) * lat);
    o.rotation.y = base + (m.dir < 0 ? PI : 0);
    let roll = -U.clamp(crv * m.vel * 0.6, -0.14, 0.14) * m.dir;
    o.rotation.z = U.damp(o.rotation.z, roll, 4.5, dt);
    o.rotation.x = _priming ? 0 : Math.sin(et * pt.bf * 1.63 + pt.ph) * (pt.pa === undefined ? 0.014 : pt.pa);
    if (pt.body) pt.body.position.y = pt.by + bob;
    const ws = pt.wheels;
    if (ws) {
      const spin = m.vel * m.dir * dt;
      for (let i = 0; i < ws.length; i++) {
        const w = ws[i];
        w.rotation.x = (w.rotation.x - spin / (w.userData.wr || 0.34)) % TAU;
      }
    }
    if (pt.pedal) {
      pt.crank = (pt.crank || 0) + m.vel * m.dir * dt * 1.9;
      const c = pt.crank;
      pt.pedal[0].rotation.x = 0.42 * Math.sin(c) - 0.34;
      pt.pedal[1].rotation.x = 0.42 * Math.sin(c + PI) - 0.34;
    }
    m.curv = crv;
  }

  function stepVeh(m, dt, et, advance) {
    if (advance) {
      m.cs = U.damp(m.cs, Math.min(1, Math.abs(m.curv) * 3.4), 3.2, dt);
      m.vel = m.spd * (1 - 0.34 * m.cs);
      m.s += m.vel * m.dir * dt;
      if (!m.rt.closed) {
        if (m.s >= m.rt.len) { m.s = m.rt.len; m.dir = -1; }
        else if (m.s <= 0) { m.s = 0; m.dir = 1; }
      } else if (m.s > 1e7 || m.s < -1e7) { m.s = m.s % m.rt.len; }
    } else { m.vel = m.spd; }
    const parts = m.parts;
    for (let k = 0; k < parts.length; k++) {
      const pt = parts[k];
      if (pt.joint) continue;
      placePart(pt, m, m.s + pt.off * m.dir, dt, et);
    }
    for (let k = 0; k < parts.length; k++) {
      const pt = parts[k];
      if (!pt.joint) continue;
      const a = parts[pt.a].o.position, b = parts[pt.b].o.position;
      pt.o.position.set((a.x + b.x) * 0.5, (a.y + b.y) * 0.5 + pt.y, (a.z + b.z) * 0.5);
      pt.o.rotation.y = Math.atan2(a.x - b.x, a.z - b.z);
    }
  }
  /** put a freshly built follower on its route straight away, so bounds,
   *  shadows and culling are right before the first frame ever runs */
  function primeVeh(m) { _priming = true; stepVeh(m, 0, 0, false); _priming = false; return m; }

  TOWN.Ticker.add(function (dt, et, Env) {
    /* ---- vehicles ---- */
    for (let i = 0; i < VEH.length; i++) stepVeh(VEH[i], dt, et, true);
    /* ---- signals: one shared cycle, two complementary groups ---- */
    if (SIGS.length) {
      const period = 13.0;
      for (let grp = 0; grp < 2; grp++) {
        const mm = SIGM[grp];
        if (!mm) continue;
        const t = U.mod(et + grp * period * 0.5, period);
        const red = t < 6.2 ? 1 : 0;
        const green = (t >= 6.4 && t < 11.4) ? 1 : 0;
        const amber = (t >= 11.4) ? 1 : 0;
        mm.red.emissiveIntensity = red * 1.7;
        mm.green.emissiveIntensity = green * 1.6;
        mm.amber.emissiveIntensity = amber * 1.8;
        mm._st = red ? 0 : (green ? 1 : 2);
      }
      const boost = 0.55 + 0.45 * (Env ? Env.lampF : 0);
      for (let i = 0; i < SIGS.length; i++) {
        const s = SIGS[i], st = SIGM[s.grp]._st;
        for (let k = 0; k < 3; k++) {
          const on = (k === st) ? 1 : 0;
          s.halo[k].material.opacity = on * boost * 0.9;
          s.halo[k].visible = on > 0;
          s.lens[k].scale.setScalar(1 + on * 0.08);
        }
      }
    }
  }, 'dyn.traffic');

  /* ---- water ------------------------------------------------- */
  function stepWater(b, dt, et) {
    {
      const o = b.o;
      let crv = 0;
      if (b.rt) {
        b.cs = U.damp(b.cs, Math.min(1, Math.abs(b.curv) * 3.0), 2.2, dt);
        const vel = b.spd * (1 - 0.28 * b.cs);
        b.s += vel * b.dir * dt;
        if (!b.rt.closed) {
          if (b.s >= b.rt.len) { b.s = b.rt.len; b.dir = -1; }
          else if (b.s <= 0) { b.s = 0; b.dir = 1; }
        }
        sampleRoute(b.rt, b.s, _v1);
        crv = _sc; b.curv = crv;
        b.px = _v1.x; b.py = _v1.y; b.pz = _v1.z;
        b.yaw = _sy + (b.dir < 0 ? PI : 0);
        o.position.x = b.px; o.position.z = b.pz;
      } else if (b.baseY === undefined) {
        /* moored / idle: remember wherever the layout parked us */
        b.baseY = o.position.y + b.hv; b.yaw = o.rotation.y;
      }
      const t = et * b.f + b.ph;
      const heave = _priming ? 0 : Math.sin(t) * b.hv + Math.sin(t * 0.63 + 1.3) * b.hv * 0.45;
      /* +hv so the heave swings about the waterline, never below the keel */
      o.position.y = (b.rt ? b.py + b.y0 + b.hv : b.baseY) + heave;
      o.rotation.y = b.yaw + (_priming ? 0 : Math.sin(t * 0.31) * 0.02);
      o.rotation.x = _priming ? 0 : Math.sin(t * 0.83 + 0.6) * b.pt;
      o.rotation.z = U.damp(o.rotation.z,
        Math.sin(t * 0.57) * b.rl - U.clamp(crv * b.spd * 0.8, -0.12, 0.12) * b.dir, 2.6, dt);
      if (b.sail) {
        const fl = 1 + 0.06 * Math.sin(et * 1.9 + b.ph) + 0.03 * Math.sin(et * 4.3 + b.ph);
        b.sail.scale.x = fl;
        b.sail.rotation.y = Math.sin(et * 1.3 + b.ph) * 0.05;
      }
      if (b.flag) {
        b.flag.rotation.y = D.windDir(et) - o.rotation.y + Math.sin(et * 3.1 + b.ph) * 0.18;
        b.flag.scale.z = 0.9 + 0.14 * Math.sin(et * 4.1 + b.ph);
      }
      if (b.neck) {
        b.neck.rotation.x = b.nb + Math.sin(et * 0.9 + b.ph) * 0.16 + Math.sin(et * 2.7 + b.ph) * 0.05;
        b.neck.rotation.y = Math.sin(et * 0.53 + b.ph * 1.7) * 0.28;
      }
      if (b.oars) {
        const a = Math.sin(et * 1.6 + b.ph) * 0.32;
        b.oars[0].rotation.x = a; b.oars[1].rotation.x = a;
        b.oars[0].rotation.z = 0.34 + a * 0.3; b.oars[1].rotation.z = -0.34 - a * 0.3;
      }
    }
  }
  function primeWater(b) { _priming = true; stepWater(b, 0, 0); _priming = false; return b; }

  TOWN.Ticker.add(function (dt, et) {
    for (let i = 0; i < WATER.length; i++) stepWater(WATER[i], dt, et);
  }, 'dyn.water');

  /* ---- rides ------------------------------------------------- */
  function stepCable(r, dt, et, advance) {
    for (let k = 0; k < r.cabs.length; k++) {
      const c = r.cabs[k];
      if (advance) { c.t += dt / r.travel; if (c.t > 2) c.t -= 2; }
      const tri = c.t < 1 ? c.t : 2 - c.t;
      const e = U.smootherstep(0, 1, tri);        /* decelerate at both ends */
      const pts = r.pts, n = pts.length - 1;
      const u = e * n;
      let j = u | 0; if (j >= n) j = n - 1;
      const f = u - j, a = pts[j], b = pts[j + 1];
      c.o.position.set(a[0] + (b[0] - a[0]) * f,
        a[1] + (b[1] - a[1]) * f - r.drop,
        a[2] + (b[2] - a[2]) * f);
      c.o.rotation.y = r.yaw;
      const sp = (tri > 0.02 && tri < 0.98) ? 1 : 0.2;
      c.o.rotation.z = U.damp(c.o.rotation.z, Math.sin(et * 1.4 + c.ph) * 0.05 * sp, 2, dt);
      c.o.rotation.x = U.damp(c.o.rotation.x, Math.sin(et * 1.05 + c.ph) * 0.04 * sp, 2, dt);
    }
  }

  TOWN.Ticker.add(function (dt, et, Env) {
    const lampF = Env ? Env.lampF : 0;
    for (let i = 0; i < RIDES.length; i++) {
      const r = RIDES[i];

      if (r.kind === 'wheel') {
        r.hub.rotation.z += r.spd * dt;
        if (r.hub.rotation.z > TAU) r.hub.rotation.z -= TAU;
        const cabs = r.cabs;
        for (let k = 0; k < cabs.length; k++) {
          const c = cabs[k];
          const target = -0.05 * Math.sin(r.hub.rotation.z + c.ph);
          c.sw = U.damp(c.sw, target, 2.4, dt);
          c.o.rotation.z = -r.hub.rotation.z + c.sw;
        }
        if (r.bulbs && lampF > 0.02) {
          const im = r.bulbs, ang = r.bAng, n = ang.length;
          for (let k = 0; k < n; k++) {
            const chase = 0.62 + 0.38 * Math.sin(et * 3.4 - k * 0.9);
            _v1.set(Math.cos(ang[k]) * r.bR, Math.sin(ang[k]) * r.bR, 0);
            _sc1.setScalar(0.7 + chase * 0.7);
            _m1.compose(_v1, _q1.identity(), _sc1);
            im.setMatrixAt(k, _m1);
          }
          im.instanceMatrix.needsUpdate = true;
        }
        if (r.light) r.light.intensity = lampF * 2.6;

      } else if (r.kind === 'carousel') {
        r.spin.rotation.y += r.spd * dt;
        if (r.spin.rotation.y > TAU) r.spin.rotation.y -= TAU;
        const h = r.horses;
        for (let k = 0; k < h.length; k++) {
          h[k].o.position.y = h[k].y + Math.sin(r.spin.rotation.y * 2.4 + h[k].ph) * 0.20;
          h[k].o.rotation.x = Math.sin(r.spin.rotation.y * 2.4 + h[k].ph) * 0.05;
        }

      } else if (r.kind === 'swing') {
        const w = r.spd * (0.55 + 0.45 * Math.sin(et * 0.09 + r.ph));
        r.hub.rotation.y += w * dt;
        if (r.hub.rotation.y > TAU) r.hub.rotation.y -= TAU;
        const lean = U.clamp(w * w * 0.55, 0, 1.05);
        for (let k = 0; k < r.arms.length; k++) {
          const a = r.arms[k];
          a.o.rotation.z = U.damp(a.o.rotation.z, -lean - 0.05 * Math.sin(et * 1.7 + a.ph), 1.8, dt);
          a.o.rotation.x = Math.sin(et * 1.3 + a.ph) * 0.06;
        }

      } else if (r.kind === 'cable') {
        stepCable(r, dt, et, true);

      } else if (r.kind === 'balloon') {
        r.a += r.spd * dt;
        if (r.a > TAU) r.a -= TAU;
        const bob = Math.sin(et * 0.31 + r.ph) * 0.9 + Math.sin(et * 0.13) * 0.5;
        r.o.position.set(r.cx + Math.cos(r.a) * r.rad, r.alt + bob, r.cz + Math.sin(r.a) * r.rad);
        r.o.rotation.y = -r.a * 0.6 + Math.sin(et * 0.17 + r.ph) * 0.25;
        r.o.rotation.z = Math.sin(et * 0.23 + r.ph) * 0.035;
        const pulse = 1 + 0.18 * Math.sin(et * 7.3 + r.ph) + 0.08 * Math.sin(et * 13.1);
        r.burner.scale.setScalar(pulse);
        if (r.halo) r.halo.scale.setScalar(r.hs * pulse);

      } else if (r.kind === 'play') {
        for (let k = 0; k < r.swings.length; k++) {
          const s = r.swings[k];
          s.o.rotation.x = Math.sin(et * s.f + s.ph) * s.a;
        }
        if (r.seesaw) r.seesaw.rotation.x = Math.sin(et * 0.62 + r.ph) * 0.19;
        if (r.round) {
          r.round.rotation.y += (0.5 + 0.4 * Math.sin(et * 0.21 + r.ph)) * dt;
          if (r.round.rotation.y > TAU) r.round.rotation.y -= TAU;
        }
      }
    }
  }, 'dyn.rides');

  /* ---- life -------------------------------------------------- */
  function stepWalk(w, dt, et) {
    {
      const o = w.o;
      let moving = 1;
      if (w.chat) moving = 0;
      else {
        const idle = Math.sin(et * 0.17 + w.ph * 3.3) * Math.sin(et * 0.11 + w.ph * 7.1);
        if (idle > 0.66) moving = 0;
      }
      w.amp = U.damp(w.amp, moving, 3.4, dt);
      if (w.rt && w.amp > 0.002) {
        w.s += w.spd * w.amp * w.dir * dt;
        if (!w.rt.closed) {
          if (w.s >= w.rt.len) { w.s = w.rt.len; w.dir = -1; }
          else if (w.s <= 0) { w.s = 0; w.dir = 1; }
        }
        sampleRoute(w.rt, w.s, _v1);
        const yaw = _sy + (w.dir < 0 ? PI : 0);
        o.position.set(_v1.x + Math.cos(_sy) * w.lane * w.dir, _v1.y,
          _v1.z - Math.sin(_sy) * w.lane * w.dir);
        o.rotation.y = yaw;
      }
      w.ph2 += w.spd * w.amp * dt * (2.9 / Math.max(0.4, w.sc));
      const st = w.ph2;
      const sw = w.amp;
      const L = w.limbs;
      L[0].rotation.x = Math.sin(st) * 0.52 * sw;
      L[1].rotation.x = -Math.sin(st) * 0.52 * sw;
      L[2].rotation.x = -Math.sin(st) * 0.40 * sw - 0.06;
      L[3].rotation.x = Math.sin(st) * 0.40 * sw - 0.06;
      w.torso.position.y = w.ty + Math.abs(Math.sin(st)) * 0.030 * sw;
      w.torso.rotation.y = Math.sin(et * 0.63 + w.ph * 5.1) * (0.16 + 0.2 * (1 - sw))
        + (w.chat ? Math.sin(et * 1.7 + w.ph) * 0.05 : 0);
      w.torso.rotation.z = Math.sin(st) * 0.030 * sw;
      if (w.chat) {
        L[2].rotation.x += Math.sin(et * 2.3 + w.ph * 2) * 0.22 * (0.5 + 0.5 * Math.sin(et * 0.7 + w.ph));
        if (w.bob) o.position.y = w.by + Math.abs(Math.sin(et * 0.9 + w.ph)) * 0.012;
      }
      if (w.tail) w.tail.rotation.y = Math.sin(et * (w.tf || 6) + w.ph) * (w.ta || 0.5);
    }
  }
  function stepFly(f, dt, et) {
    {
      const o = f.o;
      f.a += f.spd * dt;
      if (f.a > TAU) f.a -= TAU;
      const y = f.y + Math.sin(f.a * 2 + f.ph) * f.yv;
      o.position.set(f.cx + Math.cos(f.a) * f.r, y, f.cz + Math.sin(f.a) * f.r);
      o.rotation.y = -f.a + PI * 0.5;
      o.rotation.z = U.clamp(f.spd * 2.4, -0.5, 0.5) * f.sgn;
      o.rotation.x = Math.sin(f.a * 2 + f.ph) * 0.08;
      const fl = Math.sin(et * f.wf + f.ph);
      const amp = f.glide > 0 ? 0.16 : 0.62;
      const base = f.glide > 0 ? -0.12 : -0.18;
      f.wl.rotation.z = -(base + fl * amp);
      f.wr.rotation.z = base + fl * amp;
    }
  }
  function primeWalk(w) { stepWalk(w, 0.5, 0); return w; }
  function primeFly(f) { _priming = true; stepFly(f, 0, 0); _priming = false; return f; }

  TOWN.Ticker.add(function (dt, et) {
    for (let i = 0; i < WALK.length; i++) stepWalk(WALK[i], dt, et);
    for (let i = 0; i < FLY.length; i++) stepFly(FLY[i], dt, et);
    /* pigeon flocks (instanced: pecking + the odd hop) */
    for (let i = 0; i < PECK.length; i++) {
      const fl = PECK[i], st = fl.st, im = fl.im;
      for (let k = 0; k < st.length; k++) {
        const b = st[k];
        const cyc = Math.sin(et * 0.9 + b.ph * 6.2) * Math.sin(et * 0.37 + b.ph * 2.1);
        const peck = U.saturate(Math.sin(et * 5.4 + b.ph * 9)) * (cyc > -0.2 ? 1 : 0);
        const hopW = Math.sin(et * 0.53 + b.ph * 11);
        const hop = hopW > 0.93 ? Math.sin((hopW - 0.93) / 0.07 * PI) : 0;
        _e1.set(peck * 0.55, b.ry + hop * 0.9, 0);
        _q1.setFromEuler(_e1);
        _v1.set(b.x + hop * 0.12 * Math.sin(b.ry), b.y + hop * 0.16, b.z + hop * 0.12 * Math.cos(b.ry));
        _sc1.setScalar(b.s);
        _m1.compose(_v1, _q1, _sc1);
        im.setMatrixAt(k, _m1);
      }
      im.instanceMatrix.needsUpdate = true;
    }
  }, 'dyn.life');

  /* ---- wind: sway clients + vanes ---------------------------- */
  TOWN.Ticker.add(function (dt, et) {
    const ws = D.windStrength(et), wd = D.windDir(et);
    const cx = Math.cos(wd), cz = Math.sin(wd);
    for (let i = 0; i < SWAY.length; i++) {
      const e = SWAY[i], o = e.o;
      const s = Math.sin(et * 1.55 * e.sp + e.ph) + 0.45 * Math.sin(et * 2.87 * e.sp + e.ph * 1.7);
      const amp = e.a * (0.40 + 0.80 * ws);
      if (e.ax !== 'x') o.rotation.z = e.bz + s * amp * cx;
      if (e.ax !== 'z') o.rotation.x = e.bx - s * amp * cz;
    }
    for (let i = 0; i < VANES.length; i++) {
      const v = VANES[i];
      v.cur += U.angleDelta(v.cur, wd + v.off) * (1 - Math.exp(-1.6 * dt));
      v.o.rotation.y = v.cur;
      if (v.cups) v.cups.rotation.y = (v.cups.rotation.y + (0.6 + 5.5 * ws) * dt) % TAU;
    }
  }, 'dyn.wind');

  /* ============================================================
     6 · sway() — register anything for shared wind sway
     ============================================================ */
  D.sway = function (obj, opts) {
    if (!obj) return obj;
    opts = opts || {};
    const r = U.rng(opts.seed || (SWAY.length * 7 + 3));
    SWAY.push({
      o: obj,
      a: opts.amount === undefined ? 0.04 : opts.amount,
      sp: opts.speed === undefined ? 1 : opts.speed,
      ph: r() * TAU,
      bx: obj.rotation.x, bz: obj.rotation.z,
      ax: opts.axis || 'both',
    });
    TOWN.markDynamic(obj);
    return obj;
  };

  /* ============================================================
     7 · ROAD — cars
     ============================================================ */
  const CAR = {
    kei: { w: 1.52, l: 3.20, wr: 0.30, bh: 0.50, ch: 0.62, cabZ: -0.02, cabL: 0.58, axF: 0.32, axR: -0.32, glass: 1 },
    sedan: { w: 1.80, l: 4.20, wr: 0.34, bh: 0.56, ch: 0.56, cabZ: -0.14, cabL: 0.50, axF: 0.33, axR: -0.32, glass: 1 },
    van: { w: 1.92, l: 4.90, wr: 0.36, bh: 0.66, ch: 0.86, cabZ: -0.04, cabL: 0.70, axF: 0.32, axR: -0.32, glass: 2 },
    truck: { w: 2.05, l: 5.60, wr: 0.40, bh: 0.70, ch: 0.80, cabZ: 0.24, cabL: 0.32, axF: 0.32, axR: -0.28, glass: 1, cargo: 1 },
    bus: { w: 2.40, l: 8.00, wr: 0.44, bh: 0.98, ch: 1.42, cabZ: 0.00, cabL: 0.88, axF: 0.33, axR: -0.30, glass: 3, axM: -0.02 },
  };
  const CAR_PAINT = [P.roofRed, P.wallSky, P.wallCream, P.roofTeal, P.wallOchre, P.offWhite, P.roofBlue, P.wallMint];

  function carShell(type, bodyHex, roofHex) {
    return G('car:' + type + ':' + bodyHex.toString(16) + ':' + roofHex.toString(16), function () {
      const S = CAR[type];
      const plan = carPlan(S.w, S.l, 0.80, 0.87);
      const y0 = S.wr * 0.46, yb = y0 + 0.10, belt = yb + S.bh;
      const parts = [];
      /* lower body: 4 rings → tapered plan, shoulder crease, deck cap */
      parts.push([loft([
        { plan: insetP(plan, 0.84), y: y0 },
        { plan: plan, y: yb + S.bh * 0.30 },
        { plan: plan, y: yb + S.bh * 0.80 },
        { plan: insetP(plan, 0.94), y: belt },
      ], true, true), bodyHex]);
      /* greenhouse / cabin */
      const cw = S.w * 0.90, cl = S.l * S.cabL;
      const cp = carPlan(cw, cl, 0.86, 0.90);
      const cab = loft([
        { plan: cp, y: belt - 0.03 },
        { plan: insetP(cp, 0.97), y: belt + S.ch * 0.60 },
        { plan: insetP(cp, type === 'bus' || type === 'van' ? 0.90 : 0.80), y: belt + S.ch },
      ], false, true);
      cab.translate(0, 0, S.cabZ * S.l);
      parts.push([cab, roofHex]);
      /* wheel-arch eyebrows */
      for (let sx = -1; sx <= 1; sx += 2) {
        const zs = [S.axF * S.l, S.axR * S.l];
        if (S.axM !== undefined) zs.push(S.axM * S.l);
        for (let k = 0; k < zs.length; k++) {
          const a = new T.CylinderGeometry(S.wr + 0.11, S.wr + 0.11, 0.07, 7, 1, true, PI * 0.06, PI * 0.88);
          a.rotateZ(PI / 2);
          a.translate(sx * (S.w / 2 - 0.02), S.wr * 0.98, zs[k]);
          parts.push([a, P.black]);
        }
      }
      /* bumpers, plate, sills */
      const bf = flip(Geo.taperBox(S.w * 0.86, 0.19, 0.26, 0.92));
      bf.translate(0, y0 + 0.02, S.l / 2 - 0.10);
      parts.push([bf, P.metalDark]);
      const br = flip(Geo.taperBox(S.w * 0.84, 0.17, 0.24, 0.92));
      br.translate(0, y0 + 0.02, -S.l / 2 + 0.09);
      parts.push([br, P.metalDark]);
      const pl = new T.BoxGeometry(0.34, 0.12, 0.04);
      pl.translate(0, y0 + 0.10, S.l / 2 + 0.01);
      parts.push([pl, P.offWhite]);
      /* mirrors */
      for (let sx = -1; sx <= 1; sx += 2) {
        const mg = flip(Geo.taperBox(0.20, 0.10, 0.07, 0.7));
        mg.translate(sx * (S.w / 2 + 0.06), belt + S.ch * 0.35, S.cabZ * S.l + cl * 0.42);
        parts.push([mg, roofHex]);
      }
      /* cargo box (truck) */
      if (S.cargo) {
        const bx = flip(Geo.prism(chamPlan(S.w * 0.98, S.l * 0.50, 0.12), 1.35, { y0: belt - 0.10 }));
        bx.translate(0, 0, -S.l * 0.22);
        parts.push([bx, roofHex]);
        const rail = new T.BoxGeometry(S.w * 1.0, 0.07, S.l * 0.52);
        rail.translate(0, belt + 1.28, -S.l * 0.22);
        parts.push([rail, P.metalDark]);
      }
      return tintMerge(parts);
    });
  }

  function carGlass(type) {
    return G('carglass:' + type, function () {
      const S = CAR[type];
      const y0 = S.wr * 0.46, belt = y0 + 0.10 + S.bh;
      const cw = S.w * 0.90, cl = S.l * S.cabL, cz = S.cabZ * S.l;
      const parts = [];
      const gy = belt + S.ch * 0.52;
      /* windscreen + rear glass, raked */
      const wsg = plane(cw * 0.80, S.ch * 0.74);
      wsg.rotateX(-0.42); wsg.translate(0, gy, cz + cl * 0.47);
      parts.push(wsg);
      const rg = plane(cw * 0.76, S.ch * 0.68);
      rg.rotateX(PI + 0.40); rg.translate(0, gy, cz - cl * 0.47);
      parts.push(rg);
      /* side windows */
      const n = S.glass;
      for (let sx = -1; sx <= 1; sx += 2) {
        for (let k = 0; k < n; k++) {
          const t = n === 1 ? 0 : (k / (n - 1) - 0.5);
          const sg = plane(cl / n * 0.74, S.ch * 0.60);
          sg.rotateY(sx * PI / 2);
          sg.translate(sx * cw * 0.455, gy, cz + t * cl * 0.62);
          parts.push(sg);
        }
      }
      return Geo.mergeGeometries(parts);
    });
  }

  /** one mesh per axle (both wheels), spun about its own X axis.
   *  The disc faces are painted as a hubcap, which saves a whole
   *  second cylinder per wheel. */
  function carAxle(type) {
    return G('caraxle:' + type, function () {
      const S = CAR[type];
      const track = S.w / 2 - 0.09;
      const parts = [];
      for (let sx = -1; sx <= 1; sx += 2) {
        const w = cyl(S.wr, S.wr, 0.23, 7);
        w.rotateZ(PI / 2); w.translate(sx * track, 0, 0);
        parts.push(w);
      }
      const lim = S.wr * 0.8;
      return paintFaces(Geo.mergeGeometries(parts), function (cx, cy, cz) {
        return Math.hypot(cy, cz) > lim ? P.black : P.metal;
      });
    });
  }

  function carLamps(type, front) {
    return G('carlamp:' + type + (front ? 'F' : 'R'), function () {
      const S = CAR[type];
      const y = S.wr * 0.46 + 0.10 + S.bh * 0.62;
      const parts = [];
      for (let sx = -1; sx <= 1; sx += 2) {
        if (front) {
          const l = Geo.lathe([[0.001, 0], [0.105, 0.015], [0.10, 0.055], [0.001, 0.075]], 6);
          l.rotateX(PI / 2);
          l.translate(sx * (S.w / 2 - 0.24), y, S.l / 2 - 0.03);
          parts.push(l);
        } else {
          const l = new T.BoxGeometry(0.20, 0.11, 0.05);
          l.translate(sx * (S.w / 2 - 0.24), y, -S.l / 2 + 0.03);
          parts.push(l);
        }
      }
      return Geo.mergeGeometries(parts);
    });
  }

  /**
   * car({seed, color, type}) — LOCAL, faces +Z, wheels on y=0.
   * userData: {kind:'car', type, wheels:[axleF,axleR(,axleM)], body, footprint, height}
   */
  D.car = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 1);
    const type = CAR[opts.type] ? opts.type : r.pickW([['sedan', 4], ['kei', 2], ['van', 2], ['truck', 1.2], ['bus', 0.8]]);
    const S = CAR[type];
    const bodyHex = opts.color === undefined ? r.pick(CAR_PAINT) : opts.color;
    const roofHex = r.chance(0.34) ? (r.chance(0.5) ? P.offWhite : P.roofCharcoal) : bodyHex;

    const g = TOWN.group('car');
    g.rotation.order = 'YXZ';
    const shell = TOWN.group('shell');
    g.add(shell);

    shell.add(mesh(carShell(type, bodyHex, roofHex), M.paint));
    shell.add(mesh(carGlass(type), M.glassCar));
    shell.add(mesh(carLamps(type, true), M.head));
    shell.add(mesh(carLamps(type, false), M.tail));

    const y = S.wr * 0.46 + 0.10 + S.bh * 0.62;
    const hf = TOWN.halo(P.headlight, 1.15, { max: 0.9 });
    hf.position.set(0, Math.max(0.62, y), S.l / 2 - 0.30);
    shell.add(hf);
    const hr = TOWN.halo(P.taillight, 0.85, { max: 0.62 });
    hr.position.set(0, Math.max(0.46, y), -S.l / 2 + 0.24);
    shell.add(hr);

    const wheels = [];
    const zs = [S.axF * S.l, S.axR * S.l];
    if (S.axM !== undefined) zs.push(S.axM * S.l);
    for (let k = 0; k < zs.length; k++) {
      const ax = mesh(carAxle(type), M.paint, 0, S.wr, zs[k]);
      ax.userData.wr = S.wr;
      g.add(ax);
      wheels.push(ax);
    }
    /* roof rack — sometimes */
    if (r.chance(0.28) && !S.cargo) {
      const belt = S.wr * 0.46 + 0.10 + S.bh, top = belt + S.ch;
      const rk = [];
      for (let sx = -1; sx <= 1; sx += 2) {
        const b = new T.BoxGeometry(0.06, 0.05, S.l * S.cabL * 0.66);
        b.translate(sx * S.w * 0.26, top + 0.05, S.cabZ * S.l);
        rk.push([b, P.metalDark]);
      }
      for (let k = 0; k < 2; k++) {
        const b = new T.BoxGeometry(S.w * 0.56, 0.04, 0.06);
        b.translate(0, top + 0.05, S.cabZ * S.l + (k ? 0.5 : -0.5) * S.l * S.cabL * 0.5);
        rk.push([b, P.metalDark]);
      }
      shell.add(mesh(tintMerge(rk), M.paint));
    }

    const h = S.wr * 0.46 + 0.10 + S.bh + S.ch + (S.cargo ? 0.5 : 0);
    return finish(g, 'car', S.w * 1.08, S.l, h, {
      type: type, wheels: wheels, body: shell, color: bodyHex, wheelR: S.wr,
    });
  };

  /**
   * traffic({points, count=6, speed=2.4, seed, types, closed=true, lane})
   * ABSOLUTE route.  userData.cars[] holds the car groups.
   */
  D.traffic = function (opts) {
    opts = opts || {};
    const seed = opts.seed || 1;
    const r = U.rng(seed);
    const rt = makeRoute(opts.points, opts.closed);
    const count = Math.max(1, opts.count === undefined ? 6 : opts.count | 0);
    const base = opts.speed === undefined ? 2.4 : opts.speed;
    const types = opts.types || null;
    const lane = opts.lane === undefined ? 0 : opts.lane;
    const g = TOWN.group('traffic');
    const cars = [];
    let hMax = 1.4;
    for (let i = 0; i < count; i++) {
      const type = types ? r.pick(types)
        : r.pickW([['sedan', 4], ['kei', 2.2], ['van', 1.6], ['truck', 1], ['bus', 0.7]]);
      const c = D.car({ seed: seed * 131 + i * 37 + 5, type: type });
      g.add(c);
      cars.push(c);
      if (c.userData.height > hMax) hMax = c.userData.height;
      const gap = rt.len / count;
      primeVeh(VEH[VEH.push({
        rt: rt, s: U.mod(gap * i + r.bell() * gap * 0.24, rt.len), dir: 1,
        spd: base * r.range(0.76, 1.24), vel: base, cs: 0, curv: 0,
        lane: lane, y0: 0,
        parts: [{
          o: c, off: 0, lane: r.bell() * 0.14, wheels: c.userData.wheels,
          body: c.userData.body, by: 0, bf: r.range(1.6, 2.6), ba: r.range(0.010, 0.026), ph: r() * TAU,
        }],
      }) - 1]);
    }
    return finish(g, 'traffic', rt.w, rt.d, hMax, routeInfo(rt, { cars: cars }));
  };

  /* ============================================================
     8 · RAIL — articulated tram
     ============================================================ */
  function tramSection(idx, bodyHex, trimHex, len) {
    const w = 2.35, floor = 0.46, roof = 3.02;
    const key = 'tram:' + bodyHex.toString(16) + ':' + trimHex.toString(16) + ':' + len.toFixed(1);
    const shellGeo = G(key, function () {
      const plan = Geo.roundRectPlan(w, len, 0.80, 2);
      const parts = [];
      parts.push([loft([
        { plan: insetP(plan, 0.90), y: 0.30 },
        { plan: plan, y: floor + 0.10 },
        { plan: plan, y: 2.34 },
        { plan: insetP(plan, 0.955), y: 2.72 },
        { plan: insetP(plan, 0.80), y: roof },
      ], true, true), bodyHex]);
      /* skirt + waist band in the trim colour */
      const skirt = loft([
        { plan: insetP(plan, 0.965), y: 0.30 },
        { plan: insetP(plan, 0.99), y: 0.92 },
      ], false, false);
      parts.push([skirt, trimHex]);
      const band = loft([
        { plan: insetP(plan, 1.004), y: 1.62 },
        { plan: insetP(plan, 1.004), y: 1.86 },
      ], false, false);
      parts.push([band, trimHex]);
      return tintMerge(parts);
    });
    const glassGeo = G('tramglass:' + len.toFixed(1), function () {
      const parts = [];
      const nw = Math.max(2, Math.round(len / 2.4));
      for (let sx = -1; sx <= 1; sx += 2) {
        for (let k = 0; k < nw; k++) {
          const t = (k + 0.5) / nw - 0.5;
          const p = plane(len / nw * 0.80, 1.02);
          p.rotateY(sx * PI / 2);
          p.translate(sx * (w / 2 - 0.035), 2.00, t * len * 0.90);
          parts.push(p);
        }
      }
      const f = plane(w * 0.74, 1.10); f.rotateX(-0.10); f.translate(0, 2.02, len / 2 - 0.045); parts.push(f);
      const b = plane(w * 0.74, 1.10); b.rotateX(PI + 0.10); b.translate(0, 2.02, -len / 2 + 0.045); parts.push(b);
      return Geo.mergeGeometries(parts);
    });
    const trimGeo = G('tramtrim:' + len.toFixed(1), function () {
      const parts = [];
      /* bogie frames */
      for (let k = -1; k <= 1; k += 2) {
        const f = new T.BoxGeometry(w * 0.74, 0.16, 1.5);
        f.translate(0, 0.42, k * len * 0.28);
        parts.push(f);
      }
      /* roof AC pod + pantograph base */
      const pod = flip(Geo.prism(chamPlan(1.05, 2.0, 0.16), 0.20, { y0: roof - 0.02 }));
      parts.push(pod);
      /* pantograph */
      parts.push(strut([-0.35, roof + 0.16, -0.4], [0, roof + 0.92, 0.35], 0.045, 0.035, 4));
      parts.push(strut([0.35, roof + 0.16, -0.4], [0, roof + 0.92, 0.35], 0.045, 0.035, 4));
      const bar = new T.BoxGeometry(1.5, 0.05, 0.09);
      bar.translate(0, roof + 0.96, 0.35);
      parts.push(bar);
      /* couplers */
      for (let k = -1; k <= 1; k += 2) {
        const c = cyl(0.09, 0.09, 0.5, 4);
        c.rotateX(PI / 2); c.translate(0, 0.52, k * (len / 2 + 0.2));
        parts.push(c);
      }
      return Geo.mergeGeometries(parts);
    });
    const bogieGeo = G('trambogie', function () {
      const parts = [];
      for (let sx = -1; sx <= 1; sx += 2) {
        const wl = cyl(0.34, 0.34, 0.16, 6);
        wl.rotateZ(PI / 2); wl.translate(sx * (w / 2 - 0.22), 0, 0);
        parts.push(wl);
      }
      return paintFaces(Geo.mergeGeometries(parts), function (cx, cy, cz) {
        return Math.hypot(cy, cz) > 0.27 ? P.metalDark : P.metal;
      });
    });

    const sec = TOWN.group('tramSection' + idx);
    sec.rotation.order = 'YXZ';
    sec.add(mesh(shellGeo, M.paint));
    sec.add(mesh(glassGeo, M.glassTram));
    sec.add(mesh(trimGeo, M.dark));
    const wheels = [];
    for (let k = -1; k <= 1; k += 2) {
      const bg = mesh(bogieGeo, M.paint, 0, 0.375, k * len * 0.28);
      bg.userData.wr = 0.34;
      sec.add(bg);
      wheels.push(bg);
    }
    /* lit interior floor + warm glow */
    const fl = plane(w * 0.82, len * 0.88);
    fl.rotateX(-PI / 2);
    sec.add(mesh(fl, M.lamp, 0, 1.55, 0));
    const gl = TOWN.halo(P.windowWarm, 3.0, { max: 0.30, on: 0.16 });
    gl.position.set(0, 2.0, 0);
    sec.add(gl);
    sec.userData.wheels = wheels;
    return sec;
  }

  /**
   * tram({points, seed, speed=3, cars=2, closed=true}) — ABSOLUTE route.
   * Articulated: N rounded sections joined by concertinas, leaning into
   * curves.  userData.sections[] / userData.joints[].
   */
  D.tram = function (opts) {
    opts = opts || {};
    const seed = opts.seed || 1;
    const r = U.rng(seed);
    const rt = makeRoute(opts.points, opts.closed);
    const n = U.clamp(opts.cars === undefined ? 2 : opts.cars | 0, 1, 4);
    const len = 7.0;
    const bodyHex = r.pick([P.roofRed, P.roofTeal, P.wallCream, P.roofBlue, P.roofCopper]);
    const trimHex = r.chance(0.5) ? P.offWhite : P.roofCharcoal;
    const g = TOWN.group('tram');
    const parts = [], sections = [], joints = [];
    const pitch = len + 0.95;
    for (let i = 0; i < n; i++) {
      const sec = tramSection(i, bodyHex, trimHex, len);
      g.add(sec); sections.push(sec);
      parts.push({
        o: sec, off: ((n - 1) / 2 - i) * pitch, lane: 0, wheels: sec.userData.wheels,
        bf: 1.5, ba: 0.008, pa: 0.005, ph: i * 1.7,
      });
      /* front section: headlight cluster + destination board */
      if (i === 0) {
        for (let sx = -1; sx <= 1; sx += 2) {
          const hl = Geo.lathe([[0.001, 0], [0.13, 0.02], [0.12, 0.07], [0.001, 0.09]], 5);
          hl.rotateX(PI / 2);
          hl.translate(sx * 0.72, 0.95, len / 2 - 0.02);
          sec.add(mesh(hl, M.head));
        }
        const hh = TOWN.halo(P.headlight, 1.5, { max: 0.95 });
        hh.position.set(0, 0.95, len / 2 - 0.35);
        sec.add(hh);
        const bd = plane(1.5, 0.36);
        sec.add(mesh(bd, boardMat(), 0, 2.78, len / 2 - 0.16));
      }
      if (i === n - 1) {
        const tl = new T.BoxGeometry(1.7, 0.10, 0.05);
        tl.translate(0, 0.95, -len / 2 + 0.02);
        sec.add(mesh(tl, M.tail));
      }
    }
    for (let i = 0; i < n - 1; i++) {
      const jg = TOWN.group('joint');
      const bel = G('trambellows', function () {
        const list = [];
        for (let k = 0; k < 4; k++) {
          const s = k % 2 ? 0.86 : 0.94;
          const pl = Geo.roundRectPlan(2.1 * s, 0.20, 0.24, 2);
          list.push([loft([{ plan: pl, y: 0.55 }, { plan: pl, y: 2.62 }], false, false), P.roofCharcoal]);
          list[list.length - 1][0].translate(0, 0, (k - 1.5) * 0.24);
        }
        return tintMerge(list);
      });
      jg.add(mesh(bel, M.paint));
      g.add(jg);
      parts.push({ joint: true, o: jg, a: i, b: i + 1, y: 0 });
      joints.push(jg);
    }
    primeVeh(VEH[VEH.push({
      rt: rt, s: r() * rt.len, dir: 1,
      spd: (opts.speed === undefined ? 3 : opts.speed), vel: 3, cs: 0, curv: 0,
      lane: opts.lane === undefined ? 0 : opts.lane, y0: 0, parts: parts,
    }) - 1]);
    return finish(g, 'tram', rt.w, rt.d, 3.98, routeInfo(rt, { sections: sections, joints: joints }));
  };

  /**
   * trafficLight({seed, group}) — LOCAL, h ≈ 3.4, faces +Z.
   * All signals run one shared town cycle (red→green→amber); `group`
   * 0/1 selects the complementary phase for the opposite approach.
   */
  D.trafficLight = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 1);
    const grp = opts.group === undefined ? (r.chance(0.5) ? 1 : 0) : (opts.group ? 1 : 0);
    const mm = sigMats(grp);
    const g = TOWN.group('trafficLight');
    const postGeo = G('sigpost', function () {
      const parts = [];
      parts.push(Geo.lathe([[0.30, 0], [0.28, 0.10], [0.13, 0.16], [0.11, 0.30]], 8));
      parts.push(Geo.taperTower(0.085, 0.062, 3.0, 7, { steps: 2 }).translate(0, 0.28, 0));
      const arm = cyl(0.05, 0.05, 0.42, 5);
      arm.rotateX(PI / 2); arm.translate(0, 3.16, 0.20);
      parts.push(arm);
      return Geo.mergeGeometries(parts);
    });
    g.add(mesh(postGeo, M.dark));
    const boxGeo = G('sigbox', function () {
      const parts = [];
      parts.push(flip(Geo.prism(chamPlan(0.44, 0.34, 0.08), 1.16, { y0: 2.18 })));
      const cap = flip(Geo.pyramidRoof(0.46, 0.36, 0.14, { over: 0.04 }));
      cap.translate(0, 3.34, 0);
      parts.push(cap);
      /* visors */
      for (let k = 0; k < 3; k++) {
        const v = new T.CylinderGeometry(0.135, 0.155, 0.12, 7, 1, true, PI * 0.02, PI * 0.96);
        v.rotateX(-PI / 2 - 0.25);
        v.translate(0, 2.42 + k * 0.36 + 0.10, 0.20);
        parts.push(v);
      }
      return Geo.mergeGeometries(parts);
    });
    g.add(mesh(boxGeo, M.dark));

    const lensGeo = G('siglens', function () {
      const l = Geo.lathe([[0.001, 0], [0.115, 0.012], [0.11, 0.055], [0.001, 0.08]], 8);
      l.rotateX(PI / 2);
      return l;
    });
    const lens = [], halo = [];
    const mats = [mm.red, mm.amber, mm.green];
    for (let k = 0; k < 3; k++) {
      const ly = 2.90 - k * 0.36;
      const lm = mesh(lensGeo, mats[k], 0, ly, 0.16);
      g.add(lm); lens.push(lm);
      const hl = TOWN.halo(k === 0 ? P.taillight : (k === 1 ? P.flowerYellow : P.leafLime), 0.9,
        { always: true, max: 0.85 });
      hl.position.set(0, ly, 0.30);
      hl.material.opacity = 0;
      g.add(hl); halo.push(hl);
    }
    SIGS.push({ grp: grp, lens: lens, halo: halo });
    return finish(g, 'trafficLight', 0.62, 0.62, 3.48, { group: grp });
  };

  /* ============================================================
     9 · bicycles
     ============================================================ */
  function bikeGeo(frameHex) {
    return G('bike:' + frameHex.toString(16), function () {
      const parts = [];
      const R = 0.33;
      for (let k = -1; k <= 1; k += 2) {
        const rim = Geo.torus(R, 0.035, 11, 3);
        rim.rotateY(PI / 2); rim.translate(0, R + 0.04, k * 0.55);
        parts.push([rim, P.metalDark]);
        for (let s = 0; s < 3; s++) {
          const sp = cyl(0.012, 0.012, R * 2, 3, true);
          sp.rotateZ(s * PI / 3); sp.rotateY(PI / 2);
          sp.translate(0, R + 0.04, k * 0.55);
          parts.push([sp, P.offWhite]);
        }
      }
      parts.push([strut([0, 0.34, 0.52], [0, 0.72, -0.10], 0.03, 0.03, 4), frameHex]);
      parts.push([strut([0, 0.34, -0.52], [0, 0.72, -0.10], 0.03, 0.03, 4), frameHex]);
      parts.push([strut([0, 0.34, -0.52], [0, 0.40, 0.10], 0.028, 0.028, 4), frameHex]);
      parts.push([strut([0, 0.40, 0.10], [0, 0.95, 0.45], 0.028, 0.028, 4), frameHex]);
      const hb = cyl(0.022, 0.022, 0.44, 4);
      hb.rotateZ(PI / 2); hb.translate(0, 0.98, 0.44);
      parts.push([hb, P.metalDark]);
      const seat = flip(Geo.taperBox(0.14, 0.07, 0.30, 0.5));
      seat.translate(0, 0.74, -0.12);
      parts.push([seat, P.black]);
      const crank = cyl(0.05, 0.05, 0.12, 5);
      crank.rotateZ(PI / 2); crank.translate(0, 0.40, 0.06);
      parts.push([crank, P.metal]);
      return tintMerge(parts);
    });
  }

  /**
   * bicycleRider({points, seed, count=1, speed=3.4, closed=true}) — ABSOLUTE.
   */
  D.bicycleRider = function (opts) {
    opts = opts || {};
    const seed = opts.seed || 1;
    const r = U.rng(seed);
    const rt = makeRoute(opts.points, opts.closed);
    const count = Math.max(1, opts.count === undefined ? 1 : opts.count | 0);
    const g = TOWN.group('bicycles');
    const riders = [];
    for (let i = 0; i < count; i++) {
      const bg = TOWN.group('cyclist');
      bg.rotation.order = 'YXZ';
      const frameHex = r.pick([P.roofRed, P.roofBlue, P.metalDark, P.roofTeal, P.brass]);
      bg.add(mesh(bikeGeo(frameHex), M.paint));
      const ped = buildPerson(U.rng(seed * 17 + i * 13 + 3), 0.95, true);
      ped.o.position.set(0, 0.30, -0.02);
      ped.o.rotation.x = -0.16;
      bg.add(ped.o);
      g.add(bg);
      riders.push(bg);
      const gap = rt.len / count;
      primeVeh(VEH[VEH.push({
        rt: rt, s: U.mod(gap * i + r.bell() * 2, rt.len), dir: 1,
        spd: (opts.speed === undefined ? 3.4 : opts.speed) * r.range(0.85, 1.15),
        vel: 3, cs: 0, curv: 0, lane: opts.lane === undefined ? 0 : opts.lane, y0: 0,
        parts: [{
          o: bg, off: 0, lane: r.bell() * 0.2, wheels: null, bf: 2.2, ba: 0.012, ph: r() * TAU,
          pedal: [ped.limbs[0], ped.limbs[1]],
        }],
      }) - 1]);
    }
    return finish(g, 'bicycleRider', rt.w, rt.d, 1.85, routeInfo(rt, { riders: riders }));
  };

  /* ============================================================
     10 · WATER — boats
     ============================================================ */
  const BOAT = {
    fishing: { w: 2.8, l: 8.0, free: 0.86, house: 1, mast: 3.4, net: 1, lantern: 1 },
    sail: { w: 2.4, l: 6.6, free: 0.72, sail: 1, mast: 6.4, lantern: 1, cockpit: 1 },
    rowboat: { w: 2.0, l: 5.0, free: 0.56, oars: 1, cockpit: 1 },
    ferry: { w: 3.4, l: 11.0, free: 1.05, house: 2, funnel: 1, mast: 2.6, lantern: 1 },
    tug: { w: 3.0, l: 7.0, free: 1.00, house: 1, funnel: 1, mast: 2.8, fender: 1, lantern: 1 },
  };
  const HULL_PAINT = [P.roofRed, P.roofBlue, P.offWhite, P.roofTeal, P.wallCream, P.roofRust];

  function hullGeo(type, hullHex, deckHex, stripeHex) {
    return G('hull:' + type + ':' + hullHex.toString(16) + ':' + deckHex.toString(16) + ':' + stripeHex.toString(16),
      function () {
        const S = BOAT[type];
        const fr = S.free;
        const sheer = (x, z) => {
          const t = z / (S.l / 2);
          return 0.30 * Math.max(0, t) * Math.max(0, t) + 0.10 * Math.max(0, -t) * Math.max(0, -t);
        };
        const parts = [];
        const deck = liftP(hullPlan(S.w, S.l, 1.0), sheer);
        parts.push([loft([
          { plan: hullPlan(S.w, S.l, 0.26), y: 0.02 },
          { plan: hullPlan(S.w, S.l, 0.72), y: fr * 0.34 },
          { plan: hullPlan(S.w, S.l, 0.97), y: fr * 0.74 },
          { plan: deck, y: fr },
        ], true, false), hullHex]);
        /* boot-top stripe */
        parts.push([loft([
          { plan: hullPlan(S.w * 1.008, S.l * 1.004, 0.80), y: fr * 0.42 },
          { plan: hullPlan(S.w * 1.008, S.l * 1.004, 0.90), y: fr * 0.56 },
        ], false, false), stripeHex]);
        /* inner face of the bulwark — rings run top→bottom so it faces the
           deck, and its top edge meets the sheer, leaving no open slot */
        parts.push([loft([
          { plan: liftP(hullPlan(S.w, S.l, 0.99), sheer), y: fr },
          { plan: liftP(hullPlan(S.w, S.l, 0.86), sheer), y: fr - 0.07 },
        ], false, false), deckHex]);
        /* planked deck: the flat lid that closes the hull */
        parts.push([loft([
          { plan: liftP(hullPlan(S.w, S.l, 0.87), sheer), y: fr - 0.10 },
          { plan: liftP(hullPlan(S.w, S.l, 0.86), sheer), y: fr - 0.06 },
        ], false, true), deckHex]);
        return tintMerge(parts);
      });
  }

  function boatTop(type, houseHex, roofHex) {
    return G('boattop:' + type + ':' + houseHex.toString(16) + ':' + roofHex.toString(16), function () {
      const S = BOAT[type], fr = S.free, parts = [];
      if (S.house) {
        const hw = S.w * 0.62, hl = S.l * (type === 'ferry' ? 0.30 : 0.24);
        const hz = type === 'sail' ? 0 : -S.l * 0.16;
        const hh = type === 'tug' ? 1.5 : 1.15;
        const plan = Geo.roundRectPlan(hw, hl, 0.26, 2);
        const b = loft([
          { plan: plan, y: fr + 0.08 },
          { plan: plan, y: fr + hh * 0.86 },
          { plan: insetP(plan, 0.94), y: fr + hh },
        ], false, true);
        b.translate(0, 0, hz);
        parts.push([b, houseHex]);
        const rf = flip(Geo.hipRoof(hw + 0.1, hl + 0.1, 0.24, { over: 0.13, ridge: 0.4 }));
        rf.translate(0, fr + hh + 0.02, hz);
        parts.push([rf, roofHex]);
        if (S.house > 1) {
          const up = Geo.roundRectPlan(hw * 0.7, hl * 0.62, 0.2, 2);
          const b2 = loft([{ plan: up, y: fr + hh + 0.22 }, { plan: insetP(up, 0.95), y: fr + hh + 1.05 }], false, true);
          b2.translate(0, 0, hz + 0.1);
          parts.push([b2, houseHex]);
          const rf2 = flip(Geo.hipRoof(hw * 0.7 + 0.1, hl * 0.62 + 0.1, 0.2, { over: 0.12 }));
          rf2.translate(0, fr + hh + 1.05, hz + 0.1);
          parts.push([rf2, roofHex]);
        }
      }
      if (S.funnel) {
        const fn = Geo.lathe([[0.001, 0], [0.30, 0], [0.28, 0.75], [0.30, 0.86], [0.24, 0.88], [0.24, 0.02], [0.001, 0.02]], 9);
        fn.translate(0, fr + (S.house > 1 ? 2.1 : 1.30), -S.l * (type === 'tug' ? 0.02 : 0.24));
        parts.push([fn, roofHex]);
      }
      if (S.fender) {
        for (let sx = -1; sx <= 1; sx += 2) {
          for (let k = 0; k < 3; k++) {
            const f = Geo.torus(0.20, 0.075, 7, 3);
            f.rotateY(PI / 2);
            f.translate(sx * (S.w * 0.44), fr - 0.14, (k - 1) * S.l * 0.24);
            parts.push([f, P.black]);
          }
        }
      }
      if (S.net) {
        const dr = cyl(0.34, 0.34, 0.9, 8);
        dr.rotateZ(PI / 2); dr.translate(0, fr + 0.5, S.l * 0.22);
        parts.push([dr, P.leafOlive]);
        const fr2 = new T.BoxGeometry(1.1, 0.08, 0.08);
        fr2.translate(0, fr + 0.95, S.l * 0.22);
        parts.push([fr2, P.woodDark]);
      }
      if (S.cockpit) {
        const cw = S.w * 0.56, cl = S.l * 0.30;
        const cp = Geo.roundRectPlan(cw, cl, 0.24, 2);
        const coam = loft([{ plan: insetP(cp, 1.02), y: fr + 0.16 }, { plan: cp, y: fr - 0.16 }], false, false);
        coam.translate(0, 0, -S.l * 0.16);
        parts.push([coam, houseHex]);
        const sole = loft([{ plan: insetP(cp, 0.9), y: fr - 0.16 }, { plan: insetP(cp, 0.9), y: fr - 0.12 }], false, true);
        sole.translate(0, 0, -S.l * 0.16);
        parts.push([sole, P.woodLight]);
        const trunk = flip(Geo.prism(chamPlan(S.w * 0.5, S.l * 0.20, 0.16), 0.34, { y0: fr - 0.02 }));
        trunk.translate(0, 0, S.l * 0.06);
        parts.push([trunk, houseHex]);
        const tiller = cyl(0.026, 0.034, 0.9, 4);
        tiller.rotateX(PI / 2 - 0.22);
        tiller.translate(0, fr + 0.16, -S.l * 0.36);
        parts.push([tiller, P.woodDark]);
      }
      /* thwarts / benches */
      if (S.oars) {
        for (let k = -1; k <= 1; k++) {
          const th = new T.BoxGeometry(S.w * 0.74, 0.07, 0.26);
          th.translate(0, fr - 0.02, k * S.l * 0.20);
          parts.push([th, P.woodLight]);
        }
      }
      return tintMerge(parts);
    });
  }

  /** curved, bellied sail: a few-segment strip with parabolic camber */
  function sailGeo(H, L, camber, sign) {
    return G('sail:' + H.toFixed(1) + ':' + L.toFixed(1) + ':' + camber.toFixed(2) + ':' + sign, function () {
      const NY = 3, NZ = 4, verts = [], faces = [];
      for (let i = 0; i <= NY; i++) {
        const v = i / NY, y = v * H;
        const chord = L * (1 - 0.72 * v);
        for (let j = 0; j <= NZ; j++) {
          const u = j / NZ;
          const x = sign * camber * Math.sin(PI * u) * (1 - 0.45 * v);
          verts.push([x, y, -u * chord]);
        }
      }
      for (let i = 0; i < NY; i++) {
        for (let j = 0; j < NZ; j++) {
          const a = i * (NZ + 1) + j;
          faces.push([a, a + NZ + 1, a + NZ + 2, a + 1]);
        }
      }
      return Geo.fromQuads(verts, faces);
    });
  }

  /**
   * boat({seed, type}) — LOCAL, keel on y=0, bow toward +Z.
   * userData: {kind:'boat', type, sail, flag, oars, lantern}
   */
  D.boat = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 1);
    const type = BOAT[opts.type] ? opts.type : r.pick(['fishing', 'sail', 'rowboat', 'ferry', 'tug']);
    const S = BOAT[type], fr = S.free;
    const hullHex = opts.color === undefined ? r.pick(HULL_PAINT) : opts.color;
    const deckHex = r.pick([P.woodLight, P.wood, P.offWhite]);
    const stripeHex = r.pick([P.offWhite, P.roofCharcoal, P.brass]);
    const houseHex = r.chance(0.6) ? P.offWhite : r.pick([P.wallCream, P.wallSky]);
    const roofHex = r.pick([P.roofCharcoal, P.roofBlue, P.roofRust]);

    const g = TOWN.group('boat');
    g.rotation.order = 'YXZ';
    g.add(mesh(hullGeo(type, hullHex, deckHex, stripeHex), M.paint));
    addMesh(g, boatTop(type, houseHex, roofHex), M.paint);

    let h = fr + 0.4;
    let sailG = null, flagG = null, oars = null;

    if (S.house) {
      /* wheelhouse windows */
      const hw = S.w * 0.62, hl = S.l * (type === 'ferry' ? 0.30 : 0.24);
      const hz = -S.l * 0.16, hh = type === 'tug' ? 1.5 : 1.15;
      const parts = [];
      for (let sx = -1; sx <= 1; sx += 2) {
        const p = plane(hl * 0.68, 0.44); p.rotateY(sx * PI / 2);
        p.translate(sx * (hw / 2 - 0.03), fr + hh * 0.62, hz);
        parts.push(p);
      }
      const pf = plane(hw * 0.74, 0.46); pf.translate(0, fr + hh * 0.62, hz + hl / 2 - 0.03); parts.push(pf);
      g.add(mesh(Geo.mergeGeometries(parts), M.glassCab));
      h = fr + hh + 0.3 + (S.house > 1 ? 1.05 : 0);
    }

    if (S.mast) {
      const mh = S.mast;
      const mastZ = type === 'sail' ? S.l * 0.14 : -S.l * 0.02;
      const mast = cyl(0.055, 0.085, mh, 6);
      mast.translate(0, fr + mh / 2, mastZ);
      g.add(mesh(mast, M.woodDark));
      h = Math.max(h, fr + mh + 0.2);
      /* rigging via Geo.tube */
      const rig = [];
      rig.push(Geo.tube([[0, fr + mh * 0.96, mastZ], [0.18, fr + mh * 0.5, mastZ + S.l * 0.16], [0, fr + 0.1, S.l * 0.44]], 0.022, 3));
      rig.push(Geo.tube([[0, fr + mh * 0.96, mastZ], [-0.18, fr + mh * 0.5, mastZ - S.l * 0.16], [0, fr + 0.1, -S.l * 0.42]], 0.022, 3));
      g.add(mesh(Geo.mergeGeometries(rig), M.dark));
      /* lantern at the masthead */
      if (S.lantern) {
        const lg = Geo.lathe([[0.001, 0], [0.075, 0.03], [0.07, 0.16], [0.001, 0.19]], 6);
        g.add(mesh(lg, M.lamp, 0, fr + mh * 0.99, mastZ));
        const hl = TOWN.halo(P.lampWarm, 1.5, { max: 0.85 });
        hl.position.set(0, fr + mh * 0.99 + 0.08, mastZ);
        g.add(hl);
      }
      if (S.sail) {
        /* boom + bellied main + jib */
        sailG = TOWN.group('sail');
        const boom = cyl(0.04, 0.05, S.l * 0.52, 5);
        boom.rotateX(PI / 2); boom.translate(0, fr + 0.9, mastZ - S.l * 0.26);
        sailG.add(mesh(boom, M.woodDark));
        const main = mesh(paintAll(sailG_clone(sailGeo(mh * 0.78, S.l * 0.50, 0.42, 1)), P.fabricWhite), M.paintD);
        main.position.set(0, fr + 0.95, mastZ);
        sailG.add(main);
        const jib = mesh(paintAll(sailG_clone(sailGeo(mh * 0.52, S.l * 0.26, 0.26, -1)), P.offWhite), M.paintD);
        jib.position.set(0, fr + 0.9, mastZ + 0.05);
        jib.rotation.y = PI;
        sailG.add(jib);
        g.add(sailG);
      }
      /* pennant */
      flagG = TOWN.group('flag');
      flagG.position.set(0, fr + mh * 0.92, mastZ);
      const pen = G('pennant', function () {
        const v = [[0, 0.14, 0], [0, -0.14, 0], [0, -0.05, -0.85], [0, 0.05, -0.85]];
        return Geo.fromQuads(v, [[0, 1, 2, 3]]);
      });
      flagG.add(mesh(paintAll(pen.clone(), r.pick([P.fabricRed, P.flowerYellow, P.wallSky])), M.paintD));
      g.add(flagG);
    }

    if (S.oars) {
      oars = [];
      for (let sx = -1; sx <= 1; sx += 2) {
        const og = TOWN.group('oar');
        og.position.set(sx * S.w * 0.42, fr + 0.12, 0);
        const shaft = cyl(0.03, 0.035, 1.9, 4);
        shaft.rotateX(PI / 2);
        shaft.translate(sx * 0.55, 0, 0.1);
        og.add(mesh(shaft, M.wood));
        const blade = flip(Geo.taperBox(0.10, 0.02, 0.44, 1.6));
        blade.translate(sx * 1.05, -0.02, 0.1);
        og.add(mesh(blade, M.wood));
        og.rotation.z = sx * 0.34;
        g.add(og);
        oars.push(og);
      }
    }
    /* fenders on the working boats */
    if (type === 'fishing' || type === 'ferry') {
      const fg = [];
      for (let sx = -1; sx <= 1; sx += 2) {
        for (let k = 0; k < 2; k++) {
          const f = Geo.torus(0.16, 0.06, 6, 3);
          f.rotateY(PI / 2);
          f.translate(sx * S.w * 0.45, fr - 0.10, (k ? 1 : -1) * S.l * 0.26);
          fg.push([f, P.black]);
        }
      }
      addMesh(g, tintMerge(fg), M.paint);
    }

    /* declare the real plan extent (shipped oars reach past the hull) */
    const bs = Geo.sizeOf(g).size;
    return finish(g, 'boat', Math.max(S.w, bs.x), Math.max(S.l, bs.z), h, {
      type: type, sail: sailG, flag: flagG, oars: oars, freeboard: fr, hullW: S.w, hullL: S.l,
    });
  };
  /* small helper: sail geometry is cached, so clone before painting */
  function sailG_clone(g) { return g.clone(); }

  function pushWater(o, r, extra) {
    const e = {
      o: o, rt: null, s: 0, dir: 1, spd: 0, cs: 0, curv: 0, yaw: o.rotation.y, y0: 0,
      baseY: undefined,
      f: r.range(0.55, 0.95), ph: r() * TAU,
      hv: r.range(0.035, 0.075), pt: r.range(0.018, 0.036), rl: r.range(0.028, 0.055),
      px: 0, py: 0, pz: 0,
    };
    if (extra) for (const k in extra) e[k] = extra[k];
    WATER.push(e);
    primeWater(e);
    return e;
  }

  /**
   * boats({points, count=3, seed, closed=true, speed=1.4, types}) — ABSOLUTE.
   */
  D.boats = function (opts) {
    opts = opts || {};
    const seed = opts.seed || 1;
    const r = U.rng(seed);
    const rt = makeRoute(opts.points, opts.closed);
    const count = Math.max(1, opts.count === undefined ? 3 : opts.count | 0);
    const g = TOWN.group('boats');
    const list = [];
    let hMax = 2;
    for (let i = 0; i < count; i++) {
      const type = opts.types ? r.pick(opts.types) : r.pickW([['fishing', 3], ['sail', 3], ['rowboat', 1.6], ['tug', 1.2], ['ferry', 1]]);
      const b = D.boat({ seed: seed * 197 + i * 41 + 7, type: type });
      g.add(b);
      list.push(b);
      hMax = Math.max(hMax, b.userData.height);
      const gap = rt.len / count;
      pushWater(b, r, {
        rt: rt, s: U.mod(gap * i + r.bell() * gap * 0.3, rt.len),
        spd: (opts.speed === undefined ? 1.4 : opts.speed) * r.range(0.7, 1.3),
        sail: b.userData.sail, flag: b.userData.flag, oars: b.userData.oars, y0: 0,
      });
    }
    return finish(g, 'boats', rt.w, rt.d, hMax, routeInfo(rt, { boats: list }));
  };

  /**
   * mooredBoats({positions:[[x,y,z,ry],...], seed, types}) — ABSOLUTE.
   * Tied up: they only heave/pitch/roll gently in place.
   */
  D.mooredBoats = function (opts) {
    opts = opts || {};
    const seed = opts.seed || 1;
    const r = U.rng(seed);
    const pos = opts.positions && opts.positions.length ? opts.positions : [[0, 0, 0, 0], [4, 0, 2, 0.3]];
    const g = TOWN.group('mooredBoats');
    const list = [];
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, hMax = 2;
    for (let i = 0; i < pos.length; i++) {
      const p = pos[i];
      const type = opts.types ? r.pick(opts.types) : r.pickW([['fishing', 3], ['rowboat', 3], ['sail', 2], ['tug', 1]]);
      const b = D.boat({ seed: seed * 89 + i * 29 + 11, type: type });
      b.position.set(+p[0] || 0, +(p[1] || 0), +(p[2] || 0));
      b.rotation.y = +(p[3] || 0);
      g.add(b); list.push(b);
      hMax = Math.max(hMax, b.userData.height);
      x0 = Math.min(x0, b.position.x - 4); x1 = Math.max(x1, b.position.x + 4);
      z0 = Math.min(z0, b.position.z - 5); z1 = Math.max(z1, b.position.z + 5);
      pushWater(b, r, {
        y0: b.position.y, yaw: b.rotation.y,
        f: r.range(0.4, 0.7), hv: r.range(0.020, 0.045), pt: r.range(0.010, 0.022), rl: r.range(0.020, 0.040),
        sail: b.userData.sail, flag: b.userData.flag, oars: null,
      });
    }
    return finish(g, 'mooredBoats', Math.max(1, x1 - x0), Math.max(1, z1 - z0), hMax,
      { absolute: true, boats: list });
  };

  /* ---- waterfowl -------------------------------------------- */
  function fowlGeo(bodyHex, wingHex) {
    return G('fowl:' + bodyHex.toString(16) + ':' + wingHex.toString(16), function () {
      const parts = [];
      const body = Geo.lathe([[0.001, 0], [0.13, 0.06], [0.16, 0.22], [0.13, 0.42], [0.001, 0.52]], 6);
      body.rotateX(PI / 2); body.translate(0, 0.14, -0.16);
      parts.push([body, bodyHex]);
      const tail = flip(Geo.taperBox(0.14, 0.05, 0.22, 0.3));
      tail.rotateX(0.4); tail.translate(0, 0.20, -0.42);
      parts.push([tail, wingHex]);
      return tintMerge(parts);
    });
  }
  function fowlHead(bodyHex, beakHex, longNeck) {
    return G('fowlhead:' + bodyHex.toString(16) + ':' + beakHex.toString(16) + ':' + (longNeck ? 1 : 0), function () {
      const parts = [];
      const h = longNeck ? 0.46 : 0.20;
      const neck = cyl(0.045, 0.065, h, 5);
      neck.translate(0, h / 2, 0);
      parts.push([neck, bodyHex]);
      const head = Geo.lathe([[0.001, 0], [0.065, 0.03], [0.07, 0.10], [0.03, 0.14]], 6);
      head.translate(0, h, 0.02);
      parts.push([head, bodyHex]);
      const beak = cyl(0.015, 0.04, 0.14, 4);
      beak.rotateX(PI / 2 + 0.25); beak.translate(0, h + 0.07, 0.10);
      parts.push([beak, beakHex]);
      return tintMerge(parts);
    });
  }

  /** swan({seed}) — LOCAL, gliding waterfowl with a gentle head bob */
  D.swan = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 1);
    const g = TOWN.group('swan');
    g.rotation.order = 'YXZ';
    g.add(mesh(fowlGeo(P.white, P.offWhite), M.paint));
    const neck = TOWN.group('neck');
    neck.position.set(0, 0.22, 0.22);
    neck.rotation.x = -0.22;
    neck.add(mesh(fowlHead(P.white, P.flowerOrange, true), M.paint));
    g.add(neck);
    pushWater(g, r, { neck: neck, nb: -0.22, y0: 0.02, f: r.range(0.5, 0.8), hv: 0.022, pt: 0.014, rl: 0.02 });
    return finish(g, 'swan', 0.5, 1.15, 0.86, { neck: neck });
  };

  /** ducks({points, count=4, seed, closed=true}) — ABSOLUTE route */
  D.ducks = function (opts) {
    opts = opts || {};
    const seed = opts.seed || 1;
    const r = U.rng(seed);
    const rt = makeRoute(opts.points, opts.closed);
    const count = Math.max(1, opts.count === undefined ? 4 : opts.count | 0);
    const g = TOWN.group('ducks');
    for (let i = 0; i < count; i++) {
      const dk = TOWN.group('duck');
      dk.rotation.order = 'YXZ';
      const bodyHex = r.pick([P.woodDark, P.leafOlive, P.offWhite, P.soilDark]);
      dk.add(mesh(fowlGeo(bodyHex, P.woodGrey), M.paint));
      const neck = TOWN.group('neck');
      neck.position.set(0, 0.24, 0.16);
      neck.add(mesh(fowlHead(r.chance(0.5) ? P.leafPine : bodyHex, P.flowerYellow, false), M.paint));
      dk.add(neck);
      dk.scale.setScalar(r.range(0.62, 0.8));
      g.add(dk);
      const gap = rt.len / count;
      pushWater(dk, r, {
        rt: rt, s: U.mod(gap * i + r.bell() * 1.5, rt.len), spd: r.range(0.25, 0.5),
        neck: neck, nb: 0, y0: 0.01, f: r.range(0.7, 1.1), hv: 0.018, pt: 0.02, rl: 0.03,
      });
    }
    return finish(g, 'ducks', rt.w, rt.d, 0.6, routeInfo(rt));
  };

  /* ============================================================
     11 · RIDES — ferris wheel
     ============================================================ */
  let _pointLights = 0;

  D.ferrisWheel = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 1);
    const R = opts.radius === undefined ? 7.5 : opts.radius;
    const nCab = U.clamp(opts.cabins === undefined ? 10 : opts.cabins | 0, 4, 16);
    const hubY = R + 1.9;
    const g = TOWN.group('ferrisWheel');

    /* ---- A-frame supports (static) ---- */
    const supGeo = G('fwsup:' + R.toFixed(2), function () {
      const parts = [];
      for (let sz = -1; sz <= 1; sz += 2) {
        for (let sx = -1; sx <= 1; sx += 2) {
          parts.push(strut([sx * R * 0.44, 0.05, sz * 1.5], [sx * 0.34, hubY, sz * 0.95], 0.20, 0.11, 5));
        }
        for (let k = 1; k <= 2; k++) {
          const t = k / 3;
          parts.push(strut([-U.lerp(R * 0.44, 0.34, t), U.lerp(0.05, hubY, t), sz * U.lerp(1.5, 0.95, t)],
            [U.lerp(R * 0.44, 0.34, t), U.lerp(0.05, hubY, t), sz * U.lerp(1.5, 0.95, t)], 0.06, 0.06, 4));
        }
        for (let sx = -1; sx <= 1; sx += 2) {
          const pad = Geo.lathe([[0.55, 0], [0.5, 0.16], [0.2, 0.24]], 7);
          pad.translate(sx * R * 0.44, 0, sz * 1.5);
          parts.push(pad);
        }
      }
      parts.push(strut([-0.34, hubY, -0.95], [0.34, hubY, 0.95], 0.09, 0.09, 4));
      const axle = cyl(0.22, 0.22, 2.4, 8);
      axle.rotateX(PI / 2); axle.translate(0, hubY, 0);
      parts.push(axle);
      return Geo.mergeGeometries(parts);
    });
    g.add(mesh(supGeo, M.dark));

    /* ---- rotating wheel ---- */
    const hub = TOWN.group('fwHub');
    hub.position.set(0, hubY, 0);
    g.add(hub);

    const wheelGeo = G('fwwheel:' + R.toFixed(2), function () {
      const parts = [];
      for (let sz = -1; sz <= 1; sz += 2) {
        const rim = Geo.torus(R, 0.13, 22, 4);
        rim.translate(0, 0, sz * 0.9);
        parts.push(rim);
        const inner = Geo.torus(R * 0.30, 0.09, 10, 3);
        inner.translate(0, 0, sz * 0.9);
        parts.push(inner);
        for (let k = 0; k < 5; k++) {
          const sp = cyl(0.045, 0.045, R * 2, 4);
          sp.rotateZ(k * PI / 5); sp.translate(0, 0, sz * 0.9);
          parts.push(sp);
        }
      }
      const hubDrum = cyl(0.55, 0.55, 2.0, 10);
      hubDrum.rotateX(PI / 2);
      parts.push(hubDrum);
      for (let k = 0; k < 6; k++) {
        const br = strut([Math.cos(k * PI / 3) * R * 0.98, Math.sin(k * PI / 3) * R * 0.98, -0.9],
          [Math.cos(k * PI / 3) * R * 0.98, Math.sin(k * PI / 3) * R * 0.98, 0.9], 0.05, 0.05, 4);
        parts.push(br);
      }
      return Geo.mergeGeometries(parts);
    });
    hub.add(mesh(wheelGeo, M.metal));

    /* ---- gondolas: hung on pivots, counter-rotated to stay upright ---- */
    const cabColors = [P.roofRed, P.wallSky, P.flowerYellow, P.roofTeal, P.offWhite];
    const cabOff = r.int(0, cabColors.length - 1);
    const cabs = [];
    for (let i = 0; i < nCab; i++) {
      const a = (i / nCab) * TAU;
      const piv = TOWN.group('pivot');
      piv.position.set(Math.cos(a) * (R - 0.45), Math.sin(a) * (R - 0.45), 0);
      hub.add(piv);
      const cab = TOWN.group('cabin');
      piv.add(cab);
      const hex = cabColors[(i + cabOff) % cabColors.length];
      const cabGeo = G('fwcab:' + hex.toString(16), function () {
        const parts = [];
        const plan = Geo.roundRectPlan(1.5, 1.5, 0.42, 3);
        parts.push([loft([
          { plan: insetP(plan, 0.72), y: -1.62 },
          { plan: plan, y: -1.42 },
          { plan: plan, y: -0.62 },
          { plan: insetP(plan, 0.86), y: -0.44 },
        ], true, true), hex]);
        const rf = Geo.coneRoof(1.08, 0.42, 8);   /* ConeGeometry: already outward */
        rf.translate(0, -0.44, 0);
        parts.push([rf, P.offWhite]);
        parts.push([strut([-0.42, -0.02, 0], [-0.42, -0.5, 0], 0.045, 0.045, 3), P.metalDark]);
        parts.push([strut([0.42, -0.02, 0], [0.42, -0.5, 0], 0.045, 0.045, 3), P.metalDark]);
        parts.push([strut([-0.42, -0.05, 0], [0.42, -0.05, 0], 0.05, 0.05, 3), P.metalDark]);
        return tintMerge(parts);
      });
      cab.add(mesh(cabGeo, M.paint));
      const gw = G('fwcabglass', function () {
        const parts = [];
        for (let sx = -1; sx <= 1; sx += 2) {
          const p = plane(1.05, 0.52); p.rotateY(sx * PI / 2); p.translate(sx * 0.735, -1.02, 0);
          parts.push(p);
        }
        for (let sz = -1; sz <= 1; sz += 2) {
          const p = plane(1.05, 0.52); if (sz < 0) p.rotateY(PI); p.translate(0, -1.02, sz * 0.735);
          parts.push(p);
        }
        return Geo.mergeGeometries(parts);
      });
      cab.add(mesh(gw, M.glassCab));
      cabs.push({ o: cab, ph: a, sw: 0 });
    }

    /* ---- rim bulbs (instanced) + halos ---- */
    const bulbGeo = G('bulb', function () {
      return Geo.lathe([[0.001, 0], [0.075, 0.05], [0.001, 0.13]], 4);
    });
    const nB = 20, bAng = [], tr = [];
    for (let i = 0; i < nB; i++) {
      const a = (i / nB) * TAU;
      bAng.push(a);
      tr.push({ p: [Math.cos(a) * R, Math.sin(a) * R, 0], r: 0, s: 1 });
    }
    const bulbs = Geo.instanced(bulbGeo, M.lamp, tr, { castShadow: false, frustumCulled: false });
    hub.add(bulbs);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      const hl = TOWN.halo(P.lampWarm, 3.0, { max: 0.5, on: 0.06 });
      hl.position.set(Math.cos(a) * R, Math.sin(a) * R, 0);
      hub.add(hl);
    }
    const cHalo = TOWN.halo(P.lampWarm, 5.0, { max: 0.45, on: 0.05 });
    hub.add(cHalo);

    /* one real PointLight for the whole module, on the first wheel */
    let light = null;
    if (_pointLights < 1) {
      light = new T.PointLight(P.lampWarm, 0, 26, 2);
      light.position.set(0, hubY, 0);
      g.add(light);
      TOWN.Stage.nightLights.push(light);
      _pointLights++;
    }

    RIDES.push({
      kind: 'wheel', hub: hub, spd: opts.speed === undefined ? 0.12 : opts.speed,
      cabs: cabs, bulbs: bulbs, bAng: bAng, bR: R, light: light,
    });
    /* quarter-turn start phase: keeps the built bounding box tight */
    hub.rotation.z = r.int(0, 3) * PI / 2;
    for (let i = 0; i < cabs.length; i++) cabs[i].o.rotation.z = -hub.rotation.z;
    return finish(g, 'ferrisWheel', R * 2 + 1.2, 4.4, hubY + R + 0.5, { cabins: cabs.length, radius: R });
  };

  /* ---- carousel ---------------------------------------------- */
  function horseGeo(bodyHex, maneHex, tackHex) {
    return G('horse:' + bodyHex.toString(16) + ':' + maneHex.toString(16) + ':' + tackHex.toString(16), function () {
      const parts = [];
      const body = Geo.lathe([[0.03, 0], [0.16, 0.10], [0.19, 0.42], [0.145, 0.84], [0.05, 0.96]], 5);
      body.rotateX(PI / 2); body.translate(0, 0, -0.44);
      parts.push([body, bodyHex]);
      parts.push([strut([0, 0.02, 0.34], [0, 0.36, 0.52], 0.10, 0.07, 4), bodyHex]);
      const head = Geo.lathe([[0.001, 0], [0.065, 0.03], [0.05, 0.22]], 4);
      head.rotateX(1.2); head.translate(0, 0.40, 0.56);
      parts.push([head, bodyHex]);
      for (let sx = -1; sx <= 1; sx += 2) {
        parts.push([strut([sx * 0.10, 0.0, 0.30], [sx * 0.13, -0.52, 0.36], 0.05, 0.032, 3), bodyHex]);
        parts.push([strut([sx * 0.10, 0.0, -0.28], [sx * 0.13, -0.52, -0.34], 0.05, 0.032, 3), bodyHex]);
      }
      const tail = cyl(0.02, 0.075, 0.34, 4);
      tail.rotateX(-0.9); tail.translate(0, 0.06, -0.52);
      parts.push([tail, maneHex]);
      const mane = new T.BoxGeometry(0.035, 0.16, 0.34);
      mane.rotateX(0.35); mane.translate(0, 0.36, 0.44);
      parts.push([mane, maneHex]);
      const saddle = new T.BoxGeometry(0.27, 0.09, 0.34);
      saddle.translate(0, 0.185, 0);
      parts.push([saddle, tackHex]);
      return tintMerge(parts);
    });
  }

  D.carousel = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 1);
    const R = opts.radius === undefined ? 3.6 : opts.radius;
    const nH = U.clamp(opts.horses === undefined ? 8 : opts.horses | 0, 4, 12);
    const g = TOWN.group('carousel');
    const cA = r.pick([P.roofRed, P.roofBlue, P.roofPlum, P.roofTeal]);
    const cB = r.chance(0.6) ? P.offWhite : P.flowerYellow;

    /* base (static) */
    const baseGeo = G('crbase:' + R.toFixed(2), function () {
      const parts = [];
      parts.push(flip(Geo.prism(Geo.polyPlan(12, R + 0.55), 0.26, { y0: 0 })));
      parts.push(flip(Geo.prism(Geo.polyPlan(10, R + 0.30), 0.10, { y0: 0.26 })));
      parts.push(flip(Geo.prism(Geo.polyPlan(12, R + 0.85), 0.13, { y0: 0 })));
      return Geo.mergeGeometries(parts);
    });
    g.add(mesh(baseGeo, M.dark));

    const spin = TOWN.group('crSpin');
    spin.position.y = 0.36;
    g.add(spin);

    const deckGeo = G('crdeck:' + R.toFixed(2), function () {
      const parts = [];
      parts.push([flip(Geo.prism(Geo.polyPlan(14, R + 0.18), 0.16, { y0: 0 })), P.woodLight]);
      parts.push([flip(Geo.prism(Geo.polyPlan(12, R + 0.22), 0.05, { y0: 0.16 })), P.brass]);
      return tintMerge(parts);
    });
    spin.add(mesh(deckGeo, M.paint));

    /* mirrored central column */
    const colGeo = G('crcol', function () {
      return Geo.lathe([[0.55, 0.2], [0.42, 0.5], [0.34, 1.1], [0.40, 2.4], [0.30, 2.9], [0.42, 3.1], [0.28, 3.25]], 8);
    });
    spin.add(mesh(colGeo, M.metal));

    /* striped ogee canopy + valance */
    const canGeo = G('crcan:' + R.toFixed(2) + ':' + cA.toString(16) + ':' + cB.toString(16), function () {
      const dome = Geo.domeRoof(R + 0.45, 1.5, 10, true);
      const nSect = 10;
      return paintFaces(dome, function (x, y, z) {
        let a = Math.atan2(z, x);
        if (a < 0) a += TAU;
        const k = Math.floor((a / TAU) * nSect + 0.0001) % nSect;
        return (k % 2) ? cA : cB;
      });
    });
    spin.add(mesh(canGeo, M.paintD, 0, 3.02, 0));
    const valGeo = G('crval:' + R.toFixed(2) + ':' + cA.toString(16), function () {
      const v = Geo.lathe([[R + 0.30, -0.40], [R + 0.46, -0.16], [R + 0.44, 0]], 16);
      return paintFaces(v, function (x, y, z) {
        let a = Math.atan2(z, x); if (a < 0) a += TAU;
        return (Math.floor((a / TAU) * 16) % 2) ? cA : P.offWhite;
      });
    });
    spin.add(mesh(valGeo, M.paintD, 0, 3.02, 0));
    const finGeo = G('crfin', function () {
      return Geo.lathe([[0.001, 0], [0.16, 0.1], [0.10, 0.3], [0.18, 0.42], [0.001, 0.62]], 6);
    });
    spin.add(mesh(finGeo, M.brass, 0, 4.5, 0));
    const fHalo = TOWN.halo(P.lampWarm, 2.6, { max: 0.55 });
    fHalo.position.set(0, 4.8, 0);
    spin.add(fHalo);

    /* valance bulbs (instanced) + a few halos */
    const bulbGeo = G('bulb', function () {
      return Geo.lathe([[0.001, 0], [0.075, 0.05], [0.001, 0.13]], 4);
    });
    const tr = [];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      tr.push({ p: [Math.cos(a) * (R + 0.38), 2.66, Math.sin(a) * (R + 0.38)], r: 0, s: 1 });
    }
    spin.add(Geo.instanced(bulbGeo, M.lamp, tr, { castShadow: false, frustumCulled: false }));
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + 0.4;
      const hl = TOWN.halo(P.lampWarm, 2.0, { max: 0.5 });
      hl.position.set(Math.cos(a) * (R + 0.38), 2.7, Math.sin(a) * (R + 0.38));
      spin.add(hl);
    }

    /* horses on brass poles, bobbing out of phase */
    const horses = [];
    const hCols = [P.offWhite, P.wallCream, P.woodDark, P.wallRose, P.roofCharcoal];
    for (let i = 0; i < nH; i++) {
      const a = (i / nH) * TAU;
      const rr = R * 0.72;
      const px = Math.cos(a) * rr, pz = Math.sin(a) * rr;
      const pole = cyl(0.035, 0.035, 2.6, 4);
      pole.translate(0, 1.5, 0);
      const pm = mesh(pole, M.brass, px, 0, pz);
      spin.add(pm);
      const hg = TOWN.group('horse');
      hg.position.set(px, 1.25, pz);
      hg.rotation.y = -a + PI / 2;
      hg.add(mesh(horseGeo(hCols[i % hCols.length], r.pick([P.woodDark, P.roofCharcoal, P.brass]),
        r.pick([P.fabricRed, P.roofBlue, P.roofPlum])), M.paint));
      spin.add(hg);
      horses.push({ o: hg, y: 1.25, ph: (i / nH) * TAU * 1.5 + r() });
    }

    RIDES.push({
      kind: 'carousel', spin: spin, spd: opts.speed === undefined ? 0.35 : opts.speed, horses: horses,
    });
    spin.rotation.y = r.int(0, 3) * PI / 2;
    return finish(g, 'carousel', (R + 0.9) * 2, (R + 0.9) * 2, 5.15, { horses: nH, radius: R });
  };

  /* ---- swing ride -------------------------------------------- */
  D.swingRide = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 1);
    const g = TOWN.group('swingRide');
    const topY = 5.4, armR = 2.15;
    const towerGeo = G('swtower', function () {
      const parts = [];
      parts.push(flip(Geo.prism(Geo.polyPlan(10, 1.5), 0.24, { y0: 0 })));
      parts.push(Geo.taperTower(0.52, 0.30, topY, 8, { steps: 3 }).translate(0, 0.24, 0));
      return Geo.mergeGeometries(parts);
    });
    g.add(mesh(towerGeo, M.dark));
    const capA = r.pick([P.roofRed, P.roofBlue, P.roofPlum]);
    const capGeo = G('swcap:' + capA.toString(16), function () {
      const dome = Geo.coneRoof(2.5, 1.05, 10);   /* ConeGeometry: already outward */
      return paintFaces(dome, function (x, y, z) {
        let a = Math.atan2(z, x); if (a < 0) a += TAU;
        return (Math.floor((a / TAU) * 10) % 2) ? capA : P.offWhite;
      });
    });
    g.add(mesh(capGeo, M.paintD, 0, topY + 0.34, 0));

    const hub = TOWN.group('swHub');
    hub.position.y = topY;
    g.add(hub);
    const ringGeo = G('swring', function () {
      const parts = [];
      parts.push(Geo.torus(armR, 0.08, 18, 4).rotateX(PI / 2));
      for (let k = 0; k < 8; k++) {
        const a = k * TAU / 8;
        parts.push(strut([0, 0.16, 0], [Math.cos(a) * armR, 0.02, Math.sin(a) * armR], 0.05, 0.04, 4));
      }
      return Geo.mergeGeometries(parts);
    });
    hub.add(mesh(ringGeo, M.metal));

    const chairGeo = G('swchair', function () {
      const parts = [];
      parts.push([strut([-0.16, 0, 0], [-0.13, -1.5, 0.02], 0.016, 0.016, 3), P.metalDark]);
      parts.push([strut([0.16, 0, 0], [0.13, -1.5, 0.02], 0.016, 0.016, 3), P.metalDark]);
      const seat = flip(Geo.prism(chamPlan(0.46, 0.42, 0.07), 0.08, { y0: -1.58 }));
      parts.push([seat, P.roofRed]);
      const back = flip(Geo.taperBox(0.44, 0.42, 0.07, 0.9));
      back.translate(0, -1.5, -0.19);
      parts.push([back, P.roofRed]);
      return tintMerge(parts);
    });
    const arms = [];
    for (let k = 0; k < 8; k++) {
      const a = k * TAU / 8;
      const arm = TOWN.group('swArm');
      arm.rotation.y = a;
      hub.add(arm);
      const hang = TOWN.group('hang');
      hang.position.set(armR, 0, 0);
      arm.add(hang);
      hang.add(mesh(chairGeo, M.paint));
      arms.push({ o: hang, ph: k * 0.8 });
    }
    RIDES.push({ kind: 'swing', hub: hub, arms: arms, spd: 1.25, ph: r() * TAU });
    hub.rotation.y = r.int(0, 3) * PI / 2;
    return finish(g, 'swingRide', (armR + 1.0) * 2, (armR + 1.0) * 2, topY + 1.4, { arms: arms.length });
  };

  /* ---- cable car --------------------------------------------- */
  D.cableCar = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 1);
    const a = opts.a || [0, 4, 0], b = opts.b || [40, 16, 8];
    const nCab = U.clamp(opts.cabins === undefined ? 2 : opts.cabins | 0, 1, 4);
    const g = TOWN.group('cableCar');
    const pylonH = 7.0;
    const A = [+a[0], +(a[1] || 0), +(a[2] || 0)];
    const B = [+b[0], +(b[1] || 0), +(b[2] || 0)];
    const yaw = Math.atan2(B[0] - A[0], B[2] - A[2]);

    const pylonGeo = G('ccpylon', function () {
      const parts = [];
      for (let sx = -1; sx <= 1; sx += 2) {
        for (let sz = -1; sz <= 1; sz += 2) {
          parts.push(strut([sx * 0.72, 0, sz * 0.72], [sx * 0.26, pylonH, sz * 0.26], 0.12, 0.07, 4));
        }
      }
      for (let k = 1; k <= 4; k++) {
        const t = k / 5, y = t * pylonH, s = U.lerp(0.72, 0.26, t);
        for (let e = 0; e < 4; e++) {
          const a0 = e * PI / 2 + PI / 4, a1 = a0 + PI / 2;
          parts.push(strut([Math.cos(a0) * s * 1.414, y, Math.sin(a0) * s * 1.414],
            [Math.cos(a1) * s * 1.414, y, Math.sin(a1) * s * 1.414], 0.04, 0.04, 3));
        }
      }
      const head = new T.BoxGeometry(1.5, 0.20, 0.5);
      head.translate(0, pylonH + 0.1, 0);
      parts.push(head);
      const sheave = Geo.torus(0.34, 0.07, 10, 3);
      sheave.rotateY(PI / 2); sheave.translate(0, pylonH + 0.32, 0);
      parts.push(sheave);
      const base = flip(Geo.prism(Geo.polyPlan(8, 1.15), 0.3, { y0: -0.02 }));
      parts.push(base);
      return Geo.mergeGeometries(parts);
    });
    for (let k = 0; k < 2; k++) {
      const p = k ? B : A;
      const pm = mesh(pylonGeo, M.dark, p[0], p[1], p[2]);
      pm.rotation.y = yaw;
      g.add(pm);
    }

    const topA = [A[0], A[1] + pylonH + 0.3, A[2]];
    const topB = [B[0], B[1] + pylonH + 0.3, B[2]];
    const span = Math.hypot(topB[0] - topA[0], topB[2] - topA[2]);
    const cat = Geo.catenary(topA, topB, Math.max(0.6, span * 0.045), 0.05, 9);
    g.add(mesh(cat.geo, M.dark));
    const cat2 = Geo.catenary([topA[0], topA[1] + 0.55, topA[2]], [topB[0], topB[1] + 0.55, topB[2]],
      Math.max(0.4, span * 0.03), 0.035, 7);
    g.add(mesh(cat2.geo, M.dark));

    const cabHex = r.pick([P.roofRed, P.roofTeal, P.flowerYellow, P.wallSky, P.roofBlue]);
    const cabGeo = G('cccab:' + cabHex.toString(16), function () {
      const parts = [];
      const plan = Geo.roundRectPlan(1.7, 2.0, 0.5, 3);
      parts.push([loft([
        { plan: insetP(plan, 0.7), y: 0.0 },
        { plan: plan, y: 0.22 },
        { plan: plan, y: 1.72 },
        { plan: insetP(plan, 0.84), y: 1.95 },
      ], true, true), cabHex]);
      const rf = Geo.domeRoof(1.0, 0.34, 8);     /* lathe: already outward */
      rf.translate(0, 1.95, 0);
      parts.push([rf, P.offWhite]);
      parts.push([strut([0, 1.95, 0], [0, 2.9, 0], 0.05, 0.05, 4), P.metalDark]);
      const clamp = new T.BoxGeometry(0.5, 0.18, 0.26);
      clamp.translate(0, 2.95, 0);
      parts.push([clamp, P.metalDark]);
      return tintMerge(parts);
    });
    const cabGlass = G('cccabg', function () {
      const parts = [];
      for (let sx = -1; sx <= 1; sx += 2) {
        const p = plane(1.35, 0.86); p.rotateY(sx * PI / 2); p.translate(sx * 0.835, 1.15, 0);
        parts.push(p);
      }
      for (let sz = -1; sz <= 1; sz += 2) {
        const p = plane(1.05, 0.86); if (sz < 0) p.rotateY(PI); p.translate(0, 1.15, sz * 0.985);
        parts.push(p);
      }
      return Geo.mergeGeometries(parts);
    });
    const cabs = [];
    for (let i = 0; i < nCab; i++) {
      const c = TOWN.group('ccCab');
      c.rotation.order = 'YXZ';
      c.add(mesh(cabGeo, M.paint));
      c.add(mesh(cabGlass, M.glassCab));
      const hl = TOWN.halo(P.windowWarm, 2.2, { max: 0.45, on: 0.14 });
      hl.position.set(0, 1.2, 0);
      c.add(hl);
      g.add(c);
      cabs.push({ o: c, t: (i / nCab) * 2, ph: r() * TAU });
    }
    const ride = {
      kind: 'cable', pts: cat.pts, cabs: cabs, drop: 3.0, yaw: yaw,
      travel: Math.max(6, span / 2.2),
    };
    RIDES.push(ride);
    stepCable(ride, 0, 0, false);
    const w = Math.max(2, Math.abs(B[0] - A[0]) + 3), d = Math.max(2, Math.abs(B[2] - A[2]) + 3);
    return finish(g, 'cableCar', w, d, Math.max(A[1], B[1]) + pylonH + 1, { absolute: true, cabins: cabs.length });
  };

  /* ---- hot-air balloon --------------------------------------- */
  D.balloon = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 1);
    const ctr = opts.center || [0, 0, 0];
    let R = opts.radius === undefined ? 9 : opts.radius;
    let H = opts.height === undefined ? 22 : opts.height;
    let drift = opts.driftRadius;
    let alt = opts.altitude;
    /* `radius`/`height` describe the ENVELOPE (9 m x 22 m by default).  No
       diorama balloon is 30 m across, so an oversized radius is read as the
       drift-circle radius instead — and then an oversized height as the flight
       altitude — which is how the layout module calls this. */
    if (R > 16) {
      if (drift === undefined) drift = R;
      R = 9;
      if (alt === undefined && H > 16) { alt = H; H = 22; }
    }
    if (alt === undefined) alt = Math.max(+(ctr[1] || 0), 26);
    const g = TOWN.group('balloon');
    const craft = TOWN.group('craft');
    craft.rotation.order = 'YXZ';
    g.add(craft);

    const cA = r.pick([P.roofRed, P.roofBlue, P.roofPlum, P.roofTeal]);
    const cB = r.pick([P.flowerYellow, P.offWhite, P.wallCream]);
    const cC = r.pick([P.roofTerracotta, P.flowerOrange, P.wallSky]);
    const envGeo = G('balenv:' + R.toFixed(1) + ':' + H.toFixed(1) + ':' + cA.toString(16) + ':' + cB.toString(16) + ':' + cC.toString(16),
      function () {
        const prof = [];
        const st = 9, envH = H * 0.78;
        for (let i = 0; i <= st; i++) {
          const t = i / st;
          const rr = R * Math.sin(PI * (0.14 + 0.80 * t)) * (1 - 0.10 * t) * (t < 0.12 ? 0.55 + t * 3.7 : 1);
          prof.push([Math.max(0.05, rr), H * 0.22 + t * envH]);
        }
        prof.unshift([0.6, H * 0.19]);
        const lat = Geo.lathe(prof, 16);
        return paintFaces(lat, function (x, y, z) {
          let a = Math.atan2(z, x); if (a < 0) a += TAU;
          const k = Math.floor((a / TAU) * 16) % 3;
          return k === 0 ? cA : (k === 1 ? cB : cC);
        });
      });
    craft.add(mesh(envGeo, M.paint));

    const bskGeo = G('balbasket', function () {
      const parts = [];
      const plan = chamPlan(1.5, 1.5, 0.3);
      parts.push([loft([{ plan: insetP(plan, 0.86), y: 0 }, { plan: plan, y: 1.0 }], true, false), P.woodLight]);
      parts.push([loft([{ plan: insetP(plan, 1.02), y: 0.94 }, { plan: insetP(plan, 1.02), y: 1.08 }], false, false), P.woodDark]);
      return tintMerge(parts);
    });
    craft.add(mesh(bskGeo, M.paint, 0, 0, 0));
    const rigGeo = G('balrig:' + H.toFixed(1), function () {
      const parts = [];
      const plan = chamPlan(1.5, 1.5, 0.3);
      for (let k = 0; k < 8; k += 2) {
        const p = plan[k];
        parts.push(strut([p[0], 1.05, p[1]], [p[0] * 0.5, H * 0.22, p[1] * 0.5], 0.03, 0.03, 3));
      }
      return Geo.mergeGeometries(parts);
    });
    craft.add(mesh(rigGeo, M.dark));

    const burner = TOWN.group('burner');
    burner.position.set(0, 1.5, 0);
    const bGeo = G('balburner', function () {
      return Geo.lathe([[0.001, 0], [0.22, 0.04], [0.18, 0.30], [0.001, 0.42]], 7);
    });
    burner.add(mesh(bGeo, M.fire));
    craft.add(burner);
    const bHalo = TOWN.halo(P.fire, 3.4, { always: true, max: 0.55 });
    bHalo.position.set(0, 1.9, 0);
    craft.add(bHalo);

    const cx = +(ctr[0] || 0), cz = +(ctr[2] || 0);
    const rad = drift === undefined ? 24 : drift;
    craft.position.set(cx + rad, alt, cz);
    RIDES.push({
      kind: 'balloon', o: craft, cx: cx, cz: cz, rad: rad, alt: alt,
      a: r() * TAU, spd: opts.speed === undefined ? 0.035 : opts.speed,
      ph: r() * TAU, burner: burner, halo: bHalo, hs: 3.4,
    });
    return finish(g, 'balloon', rad * 2 + R, rad * 2 + R, alt + H, {
      absolute: true, craft: craft, altitude: alt, radius: R,
    });
  };

  /* ---- weather vane ------------------------------------------ */
  D.windVane = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 1);
    const g = TOWN.group('windVane');
    const postGeo = G('vanepost', function () {
      const parts = [];
      parts.push(Geo.lathe([[0.16, 0], [0.13, 0.06], [0.05, 0.10], [0.035, 1.0], [0.06, 1.05]], 6));
      const bar1 = cyl(0.018, 0.018, 0.52, 3);
      bar1.rotateZ(PI / 2); bar1.translate(0, 0.78, 0);
      parts.push(bar1);
      const bar2 = cyl(0.018, 0.018, 0.52, 3);
      bar2.rotateX(PI / 2); bar2.translate(0, 0.78, 0);
      parts.push(bar2);
      return Geo.mergeGeometries(parts);
    });
    g.add(mesh(postGeo, M.dark));
    const arrow = TOWN.group('vane');
    arrow.position.y = 1.06;
    const arrGeo = G('vanearrow:' + r.int(0, 2), function () {
      const parts = [];
      const shaft = cyl(0.014, 0.014, 0.64, 3);
      shaft.rotateX(PI / 2);
      parts.push([shaft, P.metalDark]);
      const tip = [[0, 0.10, 0.30], [0, -0.10, 0.30], [0, 0, 0.52]];
      parts.push([Geo.fromQuads(tip, [[0, 1, 2]]), P.brass]);
      const finV = [[0, 0.15, -0.14], [0, 0.02, -0.14], [0, 0.02, -0.36], [0, 0.19, -0.34]];
      parts.push([Geo.fromQuads(finV, [[0, 1, 2, 3]]), P.brass]);
      const finV2 = [[0, -0.02, -0.14], [0, -0.15, -0.14], [0, -0.19, -0.34], [0, -0.02, -0.36]];
      parts.push([Geo.fromQuads(finV2, [[0, 1, 2, 3]]), P.brass]);
      return tintMerge(parts);
    });
    arrow.add(mesh(arrGeo, M.paintD));
    g.add(arrow);
    const cups = TOWN.group('cups');
    cups.position.y = 1.16;
    if (r.chance(0.5)) {
      const cupGeo = G('vanecups', function () {
        const parts = [];
        for (let k = 0; k < 3; k++) {
          const a = k * TAU / 3;
          const c = Geo.lathe([[0.001, 0], [0.055, 0.03], [0.05, 0.07]], 5);
          c.translate(Math.cos(a) * 0.16, 0, Math.sin(a) * 0.16);
          parts.push(c);
        }
        return Geo.mergeGeometries(parts);
      });
      cups.add(mesh(cupGeo, M.metal));
      g.add(cups);
    }
    VANES.push({ o: arrow, cur: r() * TAU, off: PI, cups: cups.children.length ? cups : null });
    return finish(g, 'windVane', 0.6, 0.7, 1.3, {});
  };

  /* ============================================================
     12 · LIFE — pedestrians
     ============================================================ */
  const COAT = [P.roofBlue, P.roofRust, P.wallMint, P.roofPlum, P.wallLilac, P.offWhite,
    P.roofCharcoal, P.wallOchre, P.fabricRed, P.roofGreen, P.wallSky, P.leafOlive];
  const TROUSER = [P.roofSlate, P.metalDark, P.woodDark, P.roofCharcoal, P.wallGrey, P.timber];
  const SKIN = [P.wallPeach, P.wallSand, P.woodLight, P.wallTerra];
  const HAIR = [P.black, P.woodDark, P.soilDark, P.brass, P.roofBrown];

  function personGeo(cw, key) {
    return G('ped:' + key, function () {
      const parts = [];
      /* lathed torso with a coat flare */
      const torso = Geo.lathe([[0.03, 0], [0.16, 0.05], [0.185, 0.17], [0.155, 0.38],
        [0.165, 0.52], [0.075, 0.58]], 5);
      parts.push([torso, cw.coat]);
      /* collar + head + hair/cap */
      const collar = Geo.lathe([[0.075, 0], [0.062, 0.07]], 5);
      collar.translate(0, 0.57, 0);
      parts.push([collar, cw.scarf]);
      const head = new T.SphereGeometry(0.115, 5, 4);
      head.scale(1, 1.12, 0.95); head.translate(0, 0.75, 0);
      parts.push([head, cw.skin]);
      if (cw.cap) {
        const cap = Geo.lathe([[0.001, 0.10], [0.09, 0.06], [0.126, 0.0]], 5);
        cap.translate(0, 0.80, 0);
        parts.push([cap, cw.hair]);
        const brim = new T.BoxGeometry(0.19, 0.025, 0.13);
        brim.translate(0, 0.79, 0.10);
        parts.push([brim, cw.hair]);
      } else {
        const hair = Geo.lathe([[0.001, 0.12], [0.10, 0.07], [0.117, -0.06]], 5);
        hair.translate(0, 0.79, 0);
        parts.push([hair, cw.hair]);
      }
      if (cw.bag) {
        const bag = flip(Geo.prism([[-0.10, -0.05], [0.10, -0.05], [0.10, 0.05], [-0.10, 0.05]], 0.24, { y0: 0.20 }));
        bag.translate(0.20, 0, 0.02);
        parts.push([bag, cw.bagHex]);
      }
      return tintMerge(parts);
    });
  }
  function limbGeo(kind, cw, key) {
    return G('limb:' + kind + ':' + key, function () {
      const parts = [];
      if (kind === 'leg') {
        const th = cyl(0.062, 0.048, 0.80, 4);
        th.translate(0, -0.40, 0);
        parts.push([th, cw.trouser]);
        const shoe = flip(Geo.taperBox(0.10, 0.06, 0.22, 0.7));
        shoe.translate(0, -0.79, 0.04);
        parts.push([shoe, cw.shoe]);
      } else {
        /* tapered sleeve whose end cap reads as a mitten — no extra sphere */
        const ar = cyl(0.048, 0.042, 0.50, 4);
        ar.translate(0, -0.25, 0);
        const hand = cyl(0.043, 0.030, 0.09, 4);
        hand.translate(0, -0.545, 0);
        parts.push([ar, cw.coat]);
        parts.push([hand, cw.skin]);
      }
      return tintMerge(parts);
    });
  }

  /** build a person; returns {o, limbs:[legL,legR,armL,armR], torso, height} */
  function buildPerson(r, scale, seated) {
    const cw = {
      coat: r.pick(COAT), trouser: r.pick(TROUSER), skin: r.pick(SKIN), hair: r.pick(HAIR),
      scarf: r.chance(0.4) ? r.pick(COAT) : r.pick(SKIN),
      shoe: r.pick([P.black, P.woodDark, P.roofCharcoal]),
      cap: r.chance(0.45), bag: r.chance(0.35), bagHex: r.pick([P.woodDark, P.fabricRed, P.leafOlive]),
    };
    const key = [cw.coat, cw.trouser, cw.skin, cw.hair, cw.scarf, cw.shoe, cw.cap ? 1 : 0, cw.bag ? 1 : 0, cw.bagHex]
      .map((v) => (typeof v === 'number' ? v.toString(16) : v)).join('_');
    const g = TOWN.group('person');
    const hip = 0.80;
    const torso = TOWN.group('torso');
    torso.position.y = hip;
    g.add(torso);
    torso.add(mesh(personGeo(cw, key), M.paint));
    const limbs = [];
    for (let sx = -1; sx <= 1; sx += 2) {
      const leg = mesh(limbGeo('leg', cw, key), M.paint, sx * 0.085, hip, 0);
      g.add(leg); limbs.push(leg);
    }
    for (let sx = -1; sx <= 1; sx += 2) {
      const arm = mesh(limbGeo('arm', cw, key), M.paint, sx * 0.185, 0.50, 0);
      torso.add(arm); limbs.push(arm);
    }
    if (seated) {
      limbs[0].rotation.x = -0.9; limbs[1].rotation.x = -0.9;
      limbs[2].rotation.x = -0.55; limbs[3].rotation.x = -0.55;
    }
    g.scale.setScalar(scale);
    return { o: g, limbs: limbs, torso: torso, cw: cw, hip: hip };
  }

  /** pedestrian({seed, scale=1}) — LOCAL, h 1.6–1.8 × scale */
  D.pedestrian = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 1);
    const sc = (opts.scale === undefined ? 1 : opts.scale) * r.range(0.94, 1.05);
    const p = buildPerson(r, sc, false);
    const g = p.o;
    g.userData.limbs = p.limbs;
    g.userData.torso = p.torso;
    if (opts.walk !== false) {
      /* a lone pedestrian idles on the spot (weight shift, head turn, a
         gesture now and then) and never writes its own world position, so
         the layout can park it on any tier. */
      WALK.push({
        o: g, rt: null, s: 0, dir: 1, spd: 0, lane: 0, amp: 0, ph: r() * TAU, ph2: r() * TAU,
        limbs: p.limbs, torso: p.torso, ty: p.hip, by: 0, bob: false, sc: sc, chat: true,
      });
    }
    return finish(g, 'pedestrian', 0.5 * sc, 0.45 * sc, 1.72 * sc, {
      limbs: p.limbs, torso: p.torso, scale: sc,
    });
  };

  /**
   * crowd({points, count=10, seed, spread=0.8, speed=0.9, closed=true}) — ABSOLUTE.
   * Walkers with leg swing, counter-swinging arms, a torso bob at 2× stride,
   * head turns, random pauses and a few pairs standing still to chat.
   */
  D.crowd = function (opts) {
    opts = opts || {};
    const seed = opts.seed || 1;
    const r = U.rng(seed);
    const rt = makeRoute(opts.points, opts.closed);
    const count = Math.max(1, opts.count === undefined ? 10 : opts.count | 0);
    const spread = opts.spread === undefined ? 0.8 : opts.spread;
    const base = opts.speed === undefined ? 0.9 : opts.speed;
    const g = TOWN.group('crowd');
    const people = [];
    let i = 0;
    while (i < count) {
      const chatPair = (count - i >= 2) && r.chance(0.22);
      if (chatPair) {
        const s = r() * rt.len;
        sampleRoute(rt, s, _v1);
        /* copy out of the shared scratch vector — the builders below use it */
        const px = _v1.x, py = _v1.y, pz = _v1.z, yaw = _sy;
        const cx = Math.cos(yaw), cz = -Math.sin(yaw);
        for (let k = 0; k < 2; k++) {
          const sc = r.range(0.9, 1.06);
          const p = buildPerson(U.rng(seed * 311 + i * 53 + 17), sc, false);
          const off = (k ? 1 : -1) * (spread * 0.55 + 0.32);
          p.o.position.set(px + cx * off, py, pz + cz * off);
          p.o.rotation.y = yaw + (k ? -PI / 2 : PI / 2);
          g.add(p.o);
          people.push(p.o);
          WALK.push({
            o: p.o, rt: null, s: s, dir: 1, spd: 0, lane: off, amp: 0,
            ph: r() * TAU, ph2: r() * TAU, limbs: p.limbs, torso: p.torso,
            ty: p.hip * sc, by: py, bob: true, sc: sc, chat: true,
          });
          i++;
        }
      } else {
        const sc = r.chance(0.18) ? r.range(0.68, 0.8) : r.range(0.92, 1.06);
        const p = buildPerson(U.rng(seed * 311 + i * 53 + 17), sc, false);
        g.add(p.o);
        people.push(p.o);
        const gap = rt.len / count;
        primeWalk(WALK[WALK.push({
          o: p.o, rt: rt, s: U.mod(gap * i + r.bell() * gap * 0.4, rt.len),
          dir: r.chance(0.35) ? -1 : 1,
          spd: base * r.range(0.75, 1.3) * (sc < 0.85 ? 1.1 : 1),
          lane: r.bell() * spread, amp: 1, ph: r() * TAU, ph2: r() * TAU,
          limbs: p.limbs, torso: p.torso, ty: p.hip * sc, by: 0, sc: sc, chat: false,
        }) - 1]);
        i++;
      }
    }
    return finish(g, 'crowd', rt.w, rt.d, 1.8, routeInfo(rt, { people: people }));
  };

  /* ---- pets -------------------------------------------------- */
  function quadGeo(key, spec) {
    return G('quad:' + key, function () {
      const parts = [];
      const body = Geo.lathe([[0.02, 0], [spec.br * 0.7, 0.05], [spec.br, 0.22],
        [spec.br * 0.95, spec.bl * 0.72], [spec.br * 0.7, spec.bl * 0.94], [0.03, spec.bl]], 5);
      body.rotateX(PI / 2); body.translate(0, spec.legH + spec.br * 0.85, -spec.bl * 0.5);
      parts.push([body, spec.fur]);
      const head = Geo.lathe([[0.001, 0], [spec.hr * 0.8, 0.03], [spec.hr, 0.10], [spec.hr * 0.75, 0.19], [spec.hr * 0.35, 0.22]], 5);
      head.rotateX(1.35);
      head.translate(0, spec.legH + spec.br * 1.1 + spec.headUp, spec.bl * 0.46);
      parts.push([head, spec.fur]);
      const snout = cyl(spec.hr * 0.32, spec.hr * 0.5, spec.hr * 0.7, 4);
      snout.rotateX(PI / 2 + 0.2);
      snout.translate(0, spec.legH + spec.br * 1.05 + spec.headUp, spec.bl * 0.46 + spec.hr * 0.75);
      parts.push([snout, spec.snout]);
      for (let sx = -1; sx <= 1; sx += 2) {
        const ear = Geo.fromQuads([[0, 0, 0], [sx * spec.hr * 0.55, spec.hr * 0.1, -0.01],
          [sx * spec.hr * 0.30, spec.hr * 0.95, 0]], [[0, 1, 2]]);
        ear.translate(sx * spec.hr * 0.45, spec.legH + spec.br * 1.1 + spec.headUp + spec.hr * 0.75, spec.bl * 0.42);
        parts.push([ear, spec.fur]);
        parts.push([strut([sx * spec.br * 0.6, spec.legH + spec.br * 0.7, spec.bl * 0.28],
          [sx * spec.br * 0.62, 0.02, spec.bl * 0.3], spec.legR, spec.legR * 0.8, 4), spec.fur]);
        parts.push([strut([sx * spec.br * 0.6, spec.legH + spec.br * 0.7, -spec.bl * 0.3],
          [sx * spec.br * 0.62, 0.02, -spec.bl * 0.32], spec.legR, spec.legR * 0.8, 4), spec.fur]);
      }
      return tintMerge(parts);
    });
  }
  function tailGeo(key, spec) {
    return G('tail:' + key, function () {
      const t = cyl(spec.tr * 0.4, spec.tr, spec.tl, 4);
      t.translate(0, spec.tl / 2, 0);
      return paintAll(t, spec.fur);
    });
  }

  D.dog = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 1);
    const fur = r.pick([P.woodLight, P.offWhite, P.soilDark, P.woodDark, P.brass]);
    const spec = {
      br: 0.14, bl: 0.62, hr: 0.115, legH: 0.26, legR: 0.035, headUp: 0.10,
      fur: fur, snout: r.chance(0.5) ? P.black : fur, tr: 0.035, tl: 0.30,
    };
    const key = 'dog' + fur.toString(16) + spec.snout.toString(16);
    const g = TOWN.group('dog');
    g.add(mesh(quadGeo(key, spec), M.paint));
    const tail = TOWN.group('tail');
    tail.position.set(0, spec.legH + spec.br * 1.0, -spec.bl * 0.52);
    tail.rotation.x = -0.7;
    tail.add(mesh(tailGeo(key, spec), M.paint));
    g.add(tail);
    const sc = r.range(0.85, 1.15);
    g.scale.setScalar(sc);
    /* the legs are baked into the body mesh; the shared walker code only
       drives the tail here (limb writes land on a throw-away node) */
    WALK.push({
      o: g, rt: null, s: 0, dir: 1, spd: 0, lane: 0, amp: 0, ph: r() * TAU, ph2: 0,
      limbs: [nullObj(), nullObj(), nullObj(), nullObj()], torso: nullObj(),
      ty: 0, by: 0, bob: false, sc: 1, chat: false, tail: tail, tf: 7.5, ta: 0.55,
    });
    return finish(g, 'dog', 0.42 * sc, 0.95 * sc, 0.62 * sc, { tail: tail });
  };

  D.cat = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 1);
    const fur = r.pick([P.roofCharcoal, P.offWhite, P.brass, P.woodDark, P.wallGrey]);
    const spec = {
      br: 0.095, bl: 0.44, hr: 0.085, legH: 0.17, legR: 0.024, headUp: 0.06,
      fur: fur, snout: fur, tr: 0.028, tl: 0.34,
    };
    const key = 'cat' + fur.toString(16);
    const g = TOWN.group('cat');
    g.add(mesh(quadGeo(key, spec), M.paint));
    const tail = TOWN.group('tail');
    tail.position.set(0, spec.legH + spec.br * 1.0, -spec.bl * 0.5);
    tail.rotation.x = -1.35;
    tail.add(mesh(tailGeo(key, spec), M.paint));
    g.add(tail);
    const sc = r.range(0.9, 1.1);
    g.scale.setScalar(sc);
    WALK.push({
      o: g, rt: null, s: 0, dir: 1, spd: 0, lane: 0, amp: 0, ph: r() * TAU, ph2: 0,
      limbs: [nullObj(), nullObj(), nullObj(), nullObj()], torso: nullObj(),
      ty: 0, by: 0, bob: false, sc: 1, chat: false, tail: tail, tf: 2.1, ta: 0.30,
    });
    return finish(g, 'cat', 0.26 * sc, 0.66 * sc, 0.42 * sc, { tail: tail });
  };
  /* a throw-away object3D so shared limb code can write somewhere harmless */
  let _nullPool = null;
  function nullObj() {
    if (!_nullPool) _nullPool = new T.Object3D();
    return _nullPool;
  }

  /* ---- pigeons (instanced) ----------------------------------- */
  D.pigeons = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 1);
    const ctr = opts.center || [0, 0, 0];
    const count = U.clamp(opts.count === undefined ? 8 : opts.count | 0, 1, 40);
    const rad = opts.radius === undefined ? 2.4 : opts.radius;
    const g = TOWN.group('pigeons');
    const geo = G('pigeon', function () {
      const parts = [];
      const body = Geo.lathe([[0.02, 0], [0.055, 0.03], [0.075, 0.11], [0.05, 0.20], [0.02, 0.23]], 5);
      body.rotateX(PI / 2 - 0.25); body.translate(0, 0.13, -0.06);
      parts.push([body, P.rockDark]);
      const head = Geo.lathe([[0.001, 0], [0.038, 0.02], [0.032, 0.06]], 5);
      head.translate(0, 0.20, 0.07);
      parts.push([head, P.roofSlate]);
      const beak = cyl(0.004, 0.014, 0.05, 3);
      beak.rotateX(PI / 2); beak.translate(0, 0.215, 0.115);
      parts.push([beak, P.flowerOrange]);
      const tail = Geo.fromQuads([[-0.05, 0.14, -0.16], [0.05, 0.14, -0.16],
        [0.055, 0.17, -0.30], [-0.055, 0.17, -0.30]], [[0, 1, 2, 3]]);
      parts.push([tail, P.rock]);
      return tintMerge(parts);
    });
    const st = [], tr = [];
    const cx = +(ctr[0] || 0), cy = +(ctr[1] || 0), cz = +(ctr[2] || 0);
    for (let i = 0; i < count; i++) {
      const a = r() * TAU, rr = Math.sqrt(r()) * rad;
      const x = cx + Math.cos(a) * rr, z = cz + Math.sin(a) * rr;
      st.push({ x: x, y: cy, z: z, ry: r() * TAU, ph: r(), s: r.range(0.85, 1.15) });
      tr.push({ p: [x, cy, z], r: st[i].ry, s: st[i].s });
    }
    const im = Geo.instanced(geo, M.paint, tr, { frustumCulled: false });
    g.add(im);
    PECK.push({ im: im, st: st });
    return finish(g, 'pigeons', rad * 2, rad * 2, 0.35, { absolute: true, count: count });
  };

  /* ---- flocking birds ---------------------------------------- */
  function birdParts(bodyHex, wingHex, sz) {
    const key = 'bird:' + bodyHex.toString(16) + ':' + wingHex.toString(16) + ':' + sz.toFixed(2);
    return {
      body: G(key + ':b', function () {
        const parts = [];
        const b = Geo.lathe([[0.02, 0], [0.075, 0.05], [0.06, 0.26], [0.02, 0.34]], 4);
        b.rotateX(PI / 2); b.scale(sz, sz, sz); b.translate(0, 0, -0.1 * sz);
        parts.push([b, bodyHex]);
        const tail = Geo.fromQuads([[-0.05 * sz, 0, -0.20 * sz], [0.05 * sz, 0, -0.20 * sz],
          [0.07 * sz, 0.01 * sz, -0.40 * sz], [-0.07 * sz, 0.01 * sz, -0.40 * sz]], [[0, 1, 2, 3]]);
        parts.push([tail, wingHex]);
        return tintMerge(parts);
      }),
      wing: G(key + ':w', function () {
        const v = [
          [0.02 * sz, 0, 0.07 * sz], [0.02 * sz, 0, -0.09 * sz],
          [0.30 * sz, 0.01 * sz, -0.10 * sz], [0.30 * sz, 0.01 * sz, 0.05 * sz],
          [0.62 * sz, 0.02 * sz, -0.05 * sz], [0.62 * sz, 0.02 * sz, 0.02 * sz],
        ];
        const g2 = Geo.fromQuads(v, [[0, 1, 2, 3], [3, 2, 4, 5]]);
        return paintAll(g2, wingHex);
      }),
    };
  }

  function makeFlock(opts, isGull) {
    opts = opts || {};
    const r = U.rng(opts.seed || 1);
    const ctr = opts.center || [0, 20, 0];
    const R = opts.radius === undefined ? (isGull ? 22 : 18) : opts.radius;
    const H = opts.height === undefined ? (isGull ? 16 : 26) : opts.height;
    const count = U.clamp(opts.count === undefined ? 9 : opts.count | 0, 1, 30);
    const g = TOWN.group(isGull ? 'gulls' : 'birds');
    const cx = +(ctr[0] || 0), cz = +(ctr[2] || 0);
    const baseY = (ctr[1] === undefined || ctr[1] === 0) ? H : +ctr[1];
    for (let i = 0; i < count; i++) {
      const bodyHex = isGull ? P.white : r.pick([P.roofCharcoal, P.black, P.soilDark, P.rockDark]);
      const wingHex = isGull ? r.pick([P.wallGrey, P.offWhite]) : r.pick([P.roofSlate, P.rockDark]);
      const sz = (isGull ? 1.25 : 1.0) * r.range(0.85, 1.2);
      const pr = birdParts(bodyHex, wingHex, sz);
      const b = TOWN.group('bird');
      b.rotation.order = 'YXZ';
      b.add(mesh(pr.body, M.paint));
      const wl = mesh(pr.wing, M.paintD, 0, 0.02 * sz, 0);
      wl.scale.x = -1;
      const wr = mesh(pr.wing, M.paintD, 0, 0.02 * sz, 0);
      b.add(wl); b.add(wr);
      g.add(b);
      const sgn = r.chance(0.5) ? 1 : -1;
      primeFly(FLY[FLY.push({
        o: b, wl: wl, wr: wr, cx: cx, cz: cz,
        r: R * r.range(0.72, 1.18), y: baseY + r.bell() * H * 0.14,
        yv: r.range(0.5, 1.6), a: r() * TAU,
        spd: (isGull ? 0.10 : 0.17) * r.range(0.8, 1.25) * sgn, sgn: sgn,
        ph: r() * TAU, wf: (isGull ? 5.2 : 8.6) * r.range(0.85, 1.15),
        glide: isGull ? (r.chance(0.6) ? 1 : 0) : (r.chance(0.25) ? 1 : 0),
      }) - 1]);
    }
    return finish(g, isGull ? 'gulls' : 'birds', R * 2, R * 2, baseY + 2,
      { absolute: true, count: count, radius: R });
  }
  D.birds = function (opts) { return makeFlock(opts, false); };
  D.gulls = function (opts) { return makeFlock(opts, true); };

  /* ============================================================
     13 · playground
     ============================================================ */
  D.playground = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 1);
    const g = TOWN.group('playground');
    const frameHex = r.pick([P.roofRed, P.roofBlue, P.roofTeal]);

    /* ---- swing set (x ≈ -2.2) ---- */
    const swx = -2.2, barY = 2.35;
    const swGeo = G('pgswing:' + frameHex.toString(16), function () {
      const parts = [];
      for (let sz = -1; sz <= 1; sz += 2) {
        parts.push([strut([swx - 1.05, 0.02, sz * 1.0], [swx, barY, 0], 0.075, 0.055, 5), frameHex]);
        parts.push([strut([swx + 1.05, 0.02, sz * 1.0], [swx, barY, 0], 0.075, 0.055, 5), frameHex]);
      }
      const bar = cyl(0.06, 0.06, 2.3, 6);
      bar.rotateZ(PI / 2); bar.translate(swx, barY, 0);
      parts.push([bar, frameHex]);
      return tintMerge(parts);
    });
    g.add(mesh(swGeo, M.paint));
    const seatGeo = G('pgseat', function () {
      const parts = [];
      parts.push([strut([-0.22, 0, 0], [-0.20, -1.45, 0], 0.014, 0.014, 3), P.metalDark]);
      parts.push([strut([0.22, 0, 0], [0.20, -1.45, 0], 0.014, 0.014, 3), P.metalDark]);
      const s = flip(Geo.prism(chamPlan(0.46, 0.24, 0.05), 0.06, { y0: -1.51 }));
      parts.push([s, P.woodDark]);
      return tintMerge(parts);
    });
    const swings = [];
    for (let k = 0; k < 2; k++) {
      const piv = TOWN.group('swing');
      piv.position.set(swx + (k ? 0.55 : -0.55), barY, 0);
      piv.add(mesh(seatGeo, M.paint));
      g.add(piv);
      swings.push({ o: piv, f: 1.15 + k * 0.22, ph: k * 2.1 + r() * 2, a: 0.42 - k * 0.09 });
    }

    /* ---- seesaw (x ≈ 0.7) ---- */
    const seeX = 0.75;
    const fulGeo = G('pgful', function () {
      const parts = [];
      parts.push([flip(Geo.prism([[-0.28, -0.16], [0.28, -0.16], [0.20, 0.16], [-0.20, 0.16]], 0.62, { y0: 0 })), P.metalDark]);
      return tintMerge(parts);
    });
    g.add(mesh(fulGeo, M.paint, seeX, 0, 0));
    const seesaw = TOWN.group('seesaw');
    seesaw.position.set(seeX, 0.68, 0);
    const plankGeo = G('pgplank:' + frameHex.toString(16), function () {
      const parts = [];
      const pl = flip(Geo.prism(chamPlan(0.34, 3.4, 0.08), 0.10, { y0: -0.05 }));
      parts.push([pl, frameHex]);
      for (let k = -1; k <= 1; k += 2) {
        const hb = cyl(0.035, 0.035, 0.34, 4);
        hb.rotateZ(PI / 2); hb.translate(0, 0.30, k * 1.35);
        parts.push([hb, P.metalDark]);
        parts.push([strut([0, 0.05, k * 1.35], [0, 0.30, k * 1.35], 0.03, 0.03, 4), P.metalDark]);
        const st = flip(Geo.taperBox(0.3, 0.07, 0.3, 0.9));
        st.translate(0, 0.10, k * 1.55);
        parts.push([st, P.woodDark]);
      }
      return tintMerge(parts);
    });
    seesaw.add(mesh(plankGeo, M.paint));
    g.add(seesaw);

    /* ---- roundabout (x ≈ 2.6) ---- */
    const rx = 2.6;
    g.add(mesh(G('pgrbase', function () {
      return Geo.lathe([[0.34, 0], [0.30, 0.14], [0.14, 0.22]], 8);
    }), M.dark, rx, 0, 0));
    const round = TOWN.group('roundabout');
    round.position.set(rx, 0.22, 0);
    const rndGeo = G('pground:' + frameHex.toString(16), function () {
      const parts = [];
      const disc = flip(Geo.prism(Geo.polyPlan(12, 1.05), 0.10, { y0: 0 }));
      parts.push([disc, frameHex]);
      const rim = Geo.torus(1.02, 0.05, 14, 3);
      rim.rotateX(PI / 2); rim.translate(0, 0.12, 0);
      parts.push([rim, P.metalDark]);
      for (let k = 0; k < 4; k++) {
        const a = k * PI / 2;
        const h1 = [Math.cos(a) * 0.9, 0.08, Math.sin(a) * 0.9];
        const h2 = [Math.cos(a) * 0.2, 0.56, Math.sin(a) * 0.2];
        parts.push([strut(h1, h2, 0.032, 0.032, 4), P.metalDark]);
      }
      const hubc = cyl(0.10, 0.12, 0.62, 6);
      hubc.translate(0, 0.3, 0);
      parts.push([hubc, P.metalDark]);
      return tintMerge(parts);
    });
    round.add(mesh(rndGeo, M.paint));
    g.add(round);

    /* ---- slide (z ≈ -1.6) ---- */
    const slGeo = G('pgslide:' + frameHex.toString(16), function () {
      const parts = [];
      const px = 1.9, pz = -1.7, topY = 1.55;
      for (let sx = -1; sx <= 1; sx += 2) {
        parts.push([strut([px + sx * 0.36, 0.02, pz - 0.34], [px + sx * 0.34, topY + 0.5, pz - 0.32], 0.055, 0.045, 4), frameHex]);
        parts.push([strut([px + sx * 0.36, 0.02, pz + 0.34], [px + sx * 0.34, topY + 0.5, pz + 0.32], 0.055, 0.045, 4), frameHex]);
      }
      const deck = flip(Geo.prism(chamPlan(0.86, 0.86, 0.08), 0.10, { y0: topY }));
      deck.translate(px, 0, pz);
      parts.push([deck, P.woodDark]);
      /* ladder */
      for (let k = 0; k < 4; k++) {
        const rung = cyl(0.026, 0.026, 0.7, 4);
        rung.rotateZ(PI / 2);
        rung.translate(px, 0.32 + k * 0.38, pz - 0.33);
        parts.push([rung, P.metalDark]);
      }
      /* chute: a curved ribbon */
      const pts = [];
      for (let k = 0; k <= 6; k++) {
        const t = k / 6;
        pts.push([px, topY + 0.06 - U.smoothstep(0, 1, t) * (topY - 0.06), pz + 0.4 + t * 2.5]);
      }
      const chute = flip(Geo.ribbon(pts, 0.62));
      parts.push([chute, P.wallSky]);
      for (let sx = -1; sx <= 1; sx += 2) {
        for (let k = 0; k < 6; k += 2) {
          const p0 = pts[k], p1 = pts[k + 2];
          parts.push([strut([p0[0] + sx * 0.33, p0[1] + 0.13, p0[2]],
            [p1[0] + sx * 0.33, p1[1] + 0.13, p1[2]], 0.035, 0.035, 3), frameHex]);
        }
      }
      return tintMerge(parts);
    });
    g.add(mesh(slGeo, M.paint));

    RIDES.push({
      kind: 'play', swings: swings, seesaw: seesaw, round: round, ph: r() * TAU,
    });
    return finish(g, 'playground', 7.0, 5.0, 2.6, { swings: swings.length });
  };

  /* ============================================================
     14 · demo() — one of everything, laid out along +X
     ============================================================ */
  D.demo = function (opts) {
    opts = opts || {};
    const seed = opts.seed || 20250819;
    const r = U.rng(seed);
    const g = TOWN.group('dynamicsDemo');
    const put = (o, x, z) => { o.position.x = x; if (z) o.position.z = z; g.add(o); return o; };
    const loop = (x, rad, y) => [[x - rad, y || 0, -rad], [x + rad, y || 0, -rad], [x + rad, y || 0, rad], [x - rad, y || 0, rad]];

    /* cars */
    put(D.car({ seed: seed + 1, type: 'sedan' }), 0);
    put(D.car({ seed: seed + 2, type: 'kei' }), 4);
    put(D.car({ seed: seed + 3, type: 'van' }), 8);
    put(D.car({ seed: seed + 4, type: 'truck' }), 13);
    put(D.car({ seed: seed + 5, type: 'bus' }), 19);
    /* traffic loop + signal */
    g.add(D.traffic({ points: loop(38, 9), count: 5, seed: seed + 6, speed: 2.6 }));
    put(D.trafficLight({ seed: seed + 7, group: 0 }), 27, 0);
    put(D.trafficLight({ seed: seed + 8, group: 1 }), 27, 4);
    /* tram loop */
    g.add(D.tram({ points: loop(68, 12), seed: seed + 9, cars: 2 }));
    /* cyclists */
    g.add(D.bicycleRider({ points: loop(92, 6), seed: seed + 10, count: 2 }));
    /* boats */
    put(D.boat({ seed: seed + 11, type: 'sail' }), 104);
    put(D.boat({ seed: seed + 12, type: 'fishing' }), 110);
    put(D.boat({ seed: seed + 13, type: 'tug' }), 116);
    put(D.boat({ seed: seed + 14, type: 'rowboat' }), 121);
    put(D.boat({ seed: seed + 15, type: 'ferry' }), 127);
    g.add(D.boats({ points: loop(146, 10), count: 3, seed: seed + 16 }));
    g.add(D.mooredBoats({ positions: [[164, 0, -4, 0.2], [164, 0, 2, -0.15], [170, 0, -1, 1.5]], seed: seed + 17 }));
    put(D.swan({ seed: seed + 18 }), 176);
    g.add(D.ducks({ points: loop(184, 5), count: 4, seed: seed + 19 }));
    /* rides */
    put(D.ferrisWheel({ seed: seed + 20 }), 202);
    put(D.carousel({ seed: seed + 21 }), 220);
    put(D.swingRide({ seed: seed + 22 }), 232);
    g.add(D.cableCar({ a: [244, 2, 0], b: [274, 14, 8], seed: seed + 23 }));
    g.add(D.balloon({ seed: seed + 24, center: [286, 0, 0], driftRadius: 14 }));
    /* life */
    put(D.pedestrian({ seed: seed + 25 }), 306);
    put(D.pedestrian({ seed: seed + 26, scale: 0.78 }), 307.5);
    g.add(D.crowd({ points: loop(316, 7), count: 8, seed: seed + 27 }));
    put(D.dog({ seed: seed + 28 }), 328);
    put(D.cat({ seed: seed + 29 }), 330);
    g.add(D.pigeons({ center: [334, 0, 0], count: 7, seed: seed + 30 }));
    g.add(D.birds({ center: [344, 16, 0], radius: 9, count: 6, seed: seed + 31 }));
    g.add(D.gulls({ center: [344, 11, 0], radius: 13, count: 4, seed: seed + 32 }));
    put(D.playground({ seed: seed + 33 }), 360);
    put(D.windVane({ seed: seed + 34 }), 370);
    /* a swaying test flag, to exercise sway() */
    const flag = TOWN.group('demoFlag');
    const pole = cyl(0.05, 0.06, 3.2, 5);
    pole.translate(0, 1.6, 0);
    flag.add(mesh(pole, M.dark));
    const cloth = plane(1.2, 0.7);
    flag.add(mesh(paintAll(cloth, P.fabricRed), M.paintD, 0.62, 2.7, 0));
    put(flag, 376);
    D.sway(flag, { amount: 0.05, speed: 1.2, seed: seed + 35 });

    return finish(g, 'dynamicsDemo', 386, 40, 40, { absolute: true });
  };

  console.log('[TOWN] dynamics ready · ' + Object.keys(D).length + ' exports');
})(window);

/* ---- probe results ----------------------------------------------------------
   tools/probe.sh --files js/world/dynamics.js   ·  headless Chromium/WebGL
   errors: []  ·  the only warning is the vendor bundle's own
   "build/three.min.js is deprecated" notice  ·  nan: false everywhere  ·  exit 0

   factory (seed)                 tris   mats  size [x,y,z]             minY
   car sedan(1)                    484    4    1.84 / 1.43 / 3.28      +0.008
   car bus(2)                      576    4    2.72 / 2.77 / 8.08      +0.011
   car truck/van/kei         480/440/436  4    2.37 / 2.24 / 1.84 wide +0.010
   car — worst of seeds 1..7       528              (budget 600)  OK
   traffic(count 5, seed 3)       2284    4    28.8 / 1.85 / 28.2      +0.008
   tram(2 sections, seed 4)        998    7    14.0 / 3.92 / 8.41      +0.081
   trafficLight(15)                320    4    0.90 / 3.48 / 0.71       0.000
   bicycleRider(2, seed 16)       1048    1    15.5 / 1.92 / 14.3      +0.009
   boat sail(5)                    570    5    2.40 / 7.87 / 6.63      +0.020
   boat fishing/ferry/tug     656/764/828 6    ≤3.40 wide, ≤11.0 long  +0.020
   boat rowboat (oars shipped)     424    2    3.82 / 1.04 / 5.02      +0.020
   boat — worst of seeds 1..7      828              (budget 900)  OK
   boats(3, open route)           1796    6    21.8 / 7.89 / 30.1      +0.065
   mooredBoats(3 berths)           848    2    8.85 / 1.05 / 8.21      +0.040
   swan(18) / ducks(4)         132 / 528  1    0.28x0.91 / route bbox  +0.002
   ferrisWheel(7) R=7.5           3352    5    16.0 / 18.4 / 4.05      -0.011
   carousel(8) R=3.6              2288    6    9.33 / 6.46 / 8.90       0.000
   swingRide(9)                    934    4    4.76 / 6.79 / 5.00       0.000
   cableCar([0,4,0]→[40,18,10])   1864    3    42.8 / 21.9 / 12.8      aloft
   balloon(10) R=9 H=22            450    3    17.2 / 22.0 / 17.2      aloft
   windVane(24)                    149    3    0.52 / 1.25 / 0.88       0.000
   pedestrian(11)                  242    1    0.46 / 1.67 / 0.33       0.000
   pedestrian — worst of 1..7      246              (budget 250)  OK
   crowd(8 walkers, seed 12)      1928    1    10.7 / 1.86 / 16.5      -0.014
   dog(20) / cat(21)           188 / 188  1    0.97 / 0.94 long        +0.017
   pigeons(8, instanced)           592    1    3.99 / 0.22 / 3.80      +0.072
   birds(9) / gulls(9)         306 / 306  2    34 / 48 wide circles    aloft
   playground(14)                  848    2    7.02 / 2.42 / 3.83      -0.019
   demo()                        28735   21    378 / 48.0 / 27.5       -0.019

   BUDGETS   car 528/600 · pedestrian 246/250 · bird 34/40 · boat 828/900 ·
             ferrisWheel 3352/3500 · carousel 2288/2500 · tram 998/1200 ·
             module materials 21–22 of 25 · real PointLights 1 of 2 (the first
             ferrisWheel hub only, pushed to TOWN.Stage.nightLights)
   SEED SPREAD  heights differ across 7 seeds for car (4 distinct), boat (4),
             pedestrian (7), dog (6), cat (5), traffic (3); machines keep a
             fixed frame height and vary livery/canopy/gondola colour instead.

   MOTION PROOF (the mandated test, verbatim)
     {moved: true, tickers: 5, disabled: []}
   600 ticks over demo():            {nan: 0, disabled: []}
   400 ticks at night (lampF 0.8) then Geo.mergeStatic(scene):
     {movedAfterMerge: true, nan: 0, disabled: []}   → markDynamic holds

   LAYOUT-SCALE LOAD  5 traffic routes = 40 cars, 3 crowds = 60 pedestrians,
   2 fleets = 10 boats, tram, ferris wheel, carousel, swing ride, playground,
   cable car, balloon, 12 birds, 8 gulls, 14 pigeons, 3 cyclists, 5 ducks,
   6 signals, 150 sway() clients:
     meshes 1011 · instanced 3 · triangles 59 844 · materials 22 ·
     cached geometries 360 · movers 44 veh / 60 walk / 19 water / 6 rides /
     20 fly / 150 sway · 0.137 ms per frame for ALL animation · nan 0

   GEOMETRY AUDIT (signed volume by the divergence theorem, plus a radial
   normal test for open surfaces): 182 of 182 closed solids wind outward (the
   only negative is the DoubleSide sail, an open cambered sheet), 0 missing or
   black vertex-colour attributes, 0 zero-length normals.
   SEE-THROUGH TEST  each factory rendered twice, once as authored and once with
   every material forced to DoubleSide: silhouette growth ≤1.6 % of object
   pixels everywhere (0.0 % for solids such as the tram, 1.2 % for boats whose
   rigging tubes are open by design), i.e. nothing is inside-out or hollow.
   NB Geo.prism / chamferBox / taperBox / hipRoof / pyramidRoof / barrelRoof /
   ribbon are inward-facing as shipped (a plain Geo.prism scores V < 0), which
   is why every fromQuads-based volume here goes through flip(); the
   three.js-native lathe / cone / dome / torus helpers are already outward and
   are used as-is.
   Offscreen render check (320x240 per factory): coverage 5–31 % of frame, mean
   luminance 0.15–0.93 tracking each palette colour, no black silhouettes.

   WHOLE-TOWN INTEGRATION  island.build + roads.build + layout.build with every
   world module loaded, driving the routes that roads.js publishes
   (townLoop / tramLoop / quayLoop / fairLoop / terraceLoop / plazaWalk /
   mainWalk / quayWalk / terraceWalk / bayBoats / openSea, y from 4.0 to 7.3):
     18 vehicle movers (17 cars + 1 articulated tram), 49 walkers, 20 water
     movers, 6 rides, 15 birds, 1 pigeon flock · 300 ticks → cars travelled
     7.8–12.7 m and sit 0.16–0.38 m above Island.heightAt (routes are lifted
     0.16) · 0.401 ms per frame for the animation of ALL modules together ·
     nan 0 · disabled [] · 126 materials across the whole app
   Note balloon(): `radius`/`height` are the envelope; layout.js passes
   radius 36 / height 32, which is read as drift radius 36 and altitude 32.
   ---------------------------------------------------------------------------- */
