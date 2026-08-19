/* =============================================================
   roads.js — streets, the square, rails, bridges and piers.

   Roads are ribbons that follow the island's height model, so they
   run flat across the plateaux and climb the graded ramp corridors
   between terraces. Each road carries curbs and pavements, which is
   what makes the town read as built rather than painted on.

   Also publishes TOWN.Roads.routes — the closed paths that the
   dynamics module drives cars, the tram, boats and crowds along.
   ============================================================= */
(function (global) {
  'use strict';
  const T = global.THREE;
  const TOWN = global.TOWN;
  const U = TOWN.U, Geo = TOWN.Geo, Mat = TOWN.Mat, P = TOWN.Palette, Tex = TOWN.Tex;
  const Island = TOWN.Island;

  const Roads = TOWN.Roads = {};
  const rng = U.rng(90210);

  /* ============================================================
     Procedural surface textures (cheap, tileable, big visual win)
     ============================================================ */
  function cobbleTex() {
    return Tex.canvas('cobble', 256, 256, (g, w, h) => {
      g.fillStyle = '#8d867c';
      g.fillRect(0, 0, w, h);
      const r = U.rng(7);
      // irregular setts laid in gentle arcs
      for (let row = 0; row < 16; row++) {
        const y = (row + 0.5) * (h / 16);
        const off = (row % 2) * 8 + r() * 4;
        for (let col = -1; col < 17; col++) {
          const x = off + col * (w / 16) + r.range(-1.6, 1.6);
          const sw = w / 16 - r.range(1.5, 3.2);
          const sh = h / 16 - r.range(1.8, 3.4);
          const l = 118 + r.range(-26, 30);
          g.fillStyle = 'rgb(' + Math.round(l * 1.06) + ',' + Math.round(l * 1.01) + ',' + Math.round(l * 0.93) + ')';
          g.beginPath();
          const yy = y + Math.sin(col * 0.5 + row) * 1.2;
          if (g.roundRect) { g.roundRect(x, yy - sh / 2, sw, sh, 2.5); g.fill(); }
          else { g.fillRect(x, yy - sh / 2, sw, sh); }
        }
      }
      // grime in the joints
      g.globalAlpha = 0.18;
      g.fillStyle = '#5d574f';
      for (let i = 0; i < 900; i++) {
        g.fillRect(r() * w, r() * h, r.range(1, 3), r.range(1, 3));
      }
      g.globalAlpha = 1;
    }, { wrap: true });
  }

  function asphaltTex() {
    return Tex.canvas('asphalt', 256, 256, (g, w, h) => {
      g.fillStyle = '#5f5f65';
      g.fillRect(0, 0, w, h);
      const r = U.rng(31);
      for (let i = 0; i < 5200; i++) {
        const l = 88 + r.range(-26, 34);
        g.fillStyle = 'rgba(' + Math.round(l) + ',' + Math.round(l) + ',' + Math.round(l * 1.06) + ',0.5)';
        g.fillRect(r() * w, r() * h, r.range(1, 3.4), r.range(1, 3.4));
      }
      // dashed centre line running along V
      g.fillStyle = 'rgba(232,226,196,0.82)';
      for (let i = 0; i < 4; i++) g.fillRect(w / 2 - 3, i * 64 + 12, 6, 40);
    }, { wrap: true });
  }

  function dirtTex() {
    return Tex.canvas('dirt', 256, 256, (g, w, h) => {
      g.fillStyle = '#9d8460';
      g.fillRect(0, 0, w, h);
      const r = U.rng(53);
      for (let i = 0; i < 4200; i++) {
        const l = 150 + r.range(-40, 30);
        g.fillStyle = 'rgba(' + Math.round(l) + ',' + Math.round(l * 0.86) + ',' + Math.round(l * 0.64) + ',0.55)';
        g.fillRect(r() * w, r() * h, r.range(1, 4), r.range(1, 4));
      }
      // wheel ruts along V
      g.fillStyle = 'rgba(120,98,70,0.30)';
      g.fillRect(w * 0.28, 0, 16, h);
      g.fillRect(w * 0.62, 0, 16, h);
    }, { wrap: true });
  }

  function plazaTex() {
    return Tex.canvas('plaza', 512, 512, (g, w, h) => {
      const cx = w / 2, cy = h / 2;
      g.fillStyle = '#b3aa9a';
      g.fillRect(0, 0, w, h);
      const r = U.rng(11);
      // concentric fan of setts
      for (let ring = 22; ring > 0; ring--) {
        const rad = (ring / 22) * w * 0.72;
        const seg = Math.max(8, Math.round(ring * 4.2));
        for (let i = 0; i < seg; i++) {
          const a0 = (i / seg) * Math.PI * 2 + ring * 0.11;
          const a1 = ((i + 0.86) / seg) * Math.PI * 2 + ring * 0.11;
          const rin = rad - w * 0.030;
          const l = 176 + r.range(-30, 24) + (ring % 3) * 5;
          g.fillStyle = 'rgb(' + Math.round(l) + ',' + Math.round(l * 0.965) + ',' + Math.round(l * 0.885) + ')';
          g.beginPath();
          g.arc(cx, cy, rad, a0, a1);
          g.arc(cx, cy, rin, a1, a0, true);
          g.closePath();
          g.fill();
        }
      }
      // pale banding + a compass rose at the centre
      g.strokeStyle = 'rgba(238,231,212,0.85)';
      g.lineWidth = 5;
      for (const rr of [0.30, 0.50, 0.71]) {
        g.beginPath(); g.arc(cx, cy, w * rr, 0, Math.PI * 2); g.stroke();
      }
      g.fillStyle = 'rgba(226,216,192,0.95)';
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const long = i % 2 === 0 ? w * 0.20 : w * 0.115;
        g.beginPath();
        g.moveTo(cx + Math.cos(a) * long, cy + Math.sin(a) * long);
        g.lineTo(cx + Math.cos(a + 0.20) * w * 0.035, cy + Math.sin(a + 0.20) * w * 0.035);
        g.lineTo(cx + Math.cos(a - 0.20) * w * 0.035, cy + Math.sin(a - 0.20) * w * 0.035);
        g.closePath(); g.fill();
      }
      g.fillStyle = '#9a9080';
      g.beginPath(); g.arc(cx, cy, w * 0.028, 0, Math.PI * 2); g.fill();
      // scattered wear
      g.globalAlpha = 0.10;
      g.fillStyle = '#6f665a';
      for (let i = 0; i < 700; i++) g.fillRect(r() * w, r() * h, r.range(2, 6), r.range(2, 6));
      g.globalAlpha = 1;
    });
  }

  /* ============================================================
     Road ribbon with proper UVs (u across, v along in metres)
     ============================================================ */
  function roadRibbon(pts3, width, opts) {
    opts = opts || {};
    const n = pts3.length;
    const left = [], right = [], along = [0];
    for (let i = 0; i < n; i++) {
      const p = pts3[i];
      const a = pts3[Math.max(0, i - 1)], b = pts3[Math.min(n - 1, i + 1)];
      let dx = b[0] - a[0], dz = b[2] - a[2];
      const l = Math.hypot(dx, dz) || 1;
      dx /= l; dz /= l;
      const w = (opts.widthFn ? opts.widthFn(i / (n - 1)) : width) / 2;
      left.push([p[0] - dz * w, p[1], p[2] + dx * w]);
      right.push([p[0] + dz * w, p[1], p[2] - dx * w]);
      if (i > 0) {
        along.push(along[i - 1] + Math.hypot(p[0] - pts3[i - 1][0], p[2] - pts3[i - 1][2]));
      }
    }
    const pos = [], uv = [], push = (v, u, vv) => { pos.push(v[0], v[1], v[2]); uv.push(u, vv); };
    const tile = opts.tile || 4;
    for (let i = 0; i < n - 1; i++) {
      const v0 = along[i] / tile, v1 = along[i + 1] / tile;
      push(left[i], 0, v0); push(right[i], 1, v0); push(right[i + 1], 1, v1);
      push(left[i], 0, v0); push(right[i + 1], 1, v1); push(left[i + 1], 0, v1);
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    g.userData = { left, right, along, total: along[n - 1] };
    return g;
  }

  /** densify a control polyline and drop it onto the terrain */
  function groundPath(pts, opts) {
    opts = opts || {};
    const closed = !!opts.closed;
    const lift = opts.lift === undefined ? 0.07 : opts.lift;
    const hasY = pts[0].length === 3;
    const ctrl = pts.map((p) => (hasY ? [p[0], p[1], p[2]] : [p[0], 0, p[1]]));
    const samples = opts.samples || Math.max(24, Math.round(pathLength(ctrl) / 1.4));
    const { curve, poly } = Geo.catmullPath(ctrl, closed, samples);
    const out = poly.map((p) => {
      if (hasY) {
        // explicit-height control points (bridge decks): keep the spline's y
        return [p[0], p[1] + lift, p[2]];
      }
      return [p[0], Island.heightAt(p[0], p[2]) + lift, p[2]];
    });
    return { pts: out, curve };
  }

  function pathLength(pts) {
    let s = 0;
    for (let i = 1; i < pts.length; i++) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][2] - pts[i - 1][2]);
    return s;
  }

  /** offsetLoop(pts, d) — shrink/expand a closed loop toward its centroid */
  function offsetLoop(pts, d) {
    let cx = 0, cz = 0;
    for (const p of pts) { cx += p[0]; cz += p[p.length - 1]; }
    cx /= pts.length; cz /= pts.length;
    return pts.map((p) => {
      const x = p[0], z = p[p.length - 1];
      const dx = x - cx, dz = z - cz;
      const l = Math.hypot(dx, dz) || 1;
      return [x - (dx / l) * d, z - (dz / l) * d];
    });
  }
  Roads.offsetLoop = offsetLoop;

  /* ============================================================
     THE NETWORK
     ============================================================ */
  const BRIDGE_DECK = 3.5;

  const NET = [
    // --- main town plateau: a seafront promenade street and an inland street
    { name: 'mainSt', w: 5.1, kind: 'cobble', walk: 1.1,
      pts: [[-14, 7.0], [-6, 6.9], [2, 6.6], [10, 5.6], [17, 3.4], [22, -0.5]] },
    { name: 'midSt', w: 4.3, kind: 'cobble', walk: 0.85,
      pts: [[-14, -16.0], [-6, -16.6], [2, -16.4], [10, -16.0], [18, -15.4], [23, -14.6]] },
    { name: 'crossW', w: 3.5, kind: 'cobble', walk: 0.6,
      pts: [[-14.8, 6.8], [-15.2, -2], [-14.8, -9], [-15.2, -15.8]] },
    { name: 'crossB', w: 3.7, kind: 'cobble', walk: 0.7,
      pts: [[22.5, 0.5], [23.2, -6], [23.4, -11], [23.0, -15.0]] },

    // --- harbour ring (crosses the bay mouth on the trestle bridge)
    { name: 'quayRing', w: 4.8, kind: 'stone', walk: 1.0, closed: true,
      pts: [
        [3.5, 16], [4.6, 23], [5.6, 31],
        [7.6, 36, 2.1], [12, 37.6, 3.1], [18, 38.2, BRIDGE_DECK],
        [24, 38.2, BRIDGE_DECK], [29, 37.4, 3.1], [31.8, 36, 2.1],
        [34.4, 31], [34.4, 23], [32, 17.6], [24, 16.8], [14, 16.4], [7, 16.2],
      ] },

    // --- fairground shelf
    { name: 'fairSt', w: 4.5, kind: 'asphalt', walk: 0.95, closed: true,
      pts: [[31, -15], [38, -13], [44.5, -7], [44.5, 1], [40, 6], [32, 5], [29, -2], [30, -9]] },

    // --- upper terrace: a loop lane through the residential quarter
    { name: 'terraceSt', w: 4.0, kind: 'cobble', walk: 0.75, closed: true,
      pts: [[-20, -2], [-21, 6], [-26, 12], [-34, 13.5], [-41, 9],
        [-42, 1], [-38, -4], [-30, -6]] },

    // --- windmill track on the knoll
    { name: 'knollTrack', w: 3.2, kind: 'dirt', walk: 0,
      pts: [[7, -36], [13, -34.5], [19, -36], [22, -40]] },

    // --- beach track along the west shore
    { name: 'beachTrack', w: 3.0, kind: 'dirt', walk: 0,
      pts: [[-34, 19], [-38, 25], [-34, 31], [-26, 35]] },
  ];

  // the graded ramp corridors become real streets
  const RAMP_ROADS = {
    toQuay: { w: 4.8, kind: 'stone', walk: 0.95 },
    toFair: { w: 4.5, kind: 'asphalt', walk: 0.85 },
    toTerrace: { w: 4.6, kind: 'cobble', walk: 0.95 },
  };

  /** the main square */
  const PLAZA = { x: 15.0, z: -5.5, w: 9.6, d: 7.6, rot: 0.03 };
  Roads.PLAZA = PLAZA;

  /* ============================================================
     Build
     ============================================================ */
  const surfaces = {};
  function surfaceMat(kind) {
    if (surfaces[kind]) return surfaces[kind];
    let m;
    if (kind === 'cobble') m = Mat.std(0xd8d2c6, { map: cobbleTex(), rough: 0.88, name: 'roadCobble' });
    else if (kind === 'asphalt') m = Mat.std(0xc9c9d2, { map: asphaltTex(), rough: 0.82, name: 'roadAsphalt' });
    else if (kind === 'dirt') m = Mat.std(0xd6c3a2, { map: dirtTex(), rough: 0.95, name: 'roadDirt' });
    else m = Mat.std(P.stone, { map: cobbleTex(), rough: 0.86, name: 'roadStone' });
    surfaces[kind] = m;
    return m;
  }

  Roads.corridors = [];   // {pts, halfW} — layout uses these to keep clear

  function buildRoad(spec, grp) {
    const gp = groundPath(spec.pts, { closed: spec.closed, lift: 0.075 });
    const geo = roadRibbon(gp.pts, spec.w, { tile: spec.kind === 'asphalt' ? 6 : 3.2 });
    const m = new T.Mesh(geo, surfaceMat(spec.kind));
    m.receiveShadow = true;
    m.name = 'road_' + spec.name;
    grp.add(m);

    // curbs + pavement
    if (spec.walk > 0) {
      const kerbMat = Mat.std(P.concrete, { rough: 0.8, name: 'kerb' });
      const walkMat = Mat.std(P.stoneWarm, { rough: 0.85, name: 'pavement' });
      for (const side of [-1, 1]) {
        const inner = [], outer = [];
        const n = gp.pts.length;
        for (let i = 0; i < n; i++) {
          const p = gp.pts[i];
          const a = gp.pts[Math.max(0, i - 1)], b = gp.pts[Math.min(n - 1, i + 1)];
          let dx = b[0] - a[0], dz = b[2] - a[2];
          const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
          const nx = -dz * side, nz = dx * side;
          inner.push([p[0] + nx * (spec.w / 2 - 0.05), p[1] + 0.14, p[2] + nz * (spec.w / 2 - 0.05)]);
          outer.push([p[0] + nx * (spec.w / 2 + spec.walk), p[1] + 0.15, p[2] + nz * (spec.w / 2 + spec.walk)]);
        }
        // pavement slab
        const pv = [];
        for (let i = 0; i < inner.length; i++) { pv.push(inner[i]); pv.push(outer[i]); }
        const pg = [];
        for (let i = 0; i < inner.length - 1; i++) {
          const a = i * 2, b = a + 1, c = a + 3, d = a + 2;
          pg.push([a, b, c, d]);
        }
        const pgeo = Geo.fromQuads(pv, pg);
        const pm = new T.Mesh(pgeo, walkMat);
        pm.receiveShadow = true;
        grp.add(pm);
        // kerb face
        const kv = [], kf = [];
        for (let i = 0; i < inner.length; i++) {
          kv.push([inner[i][0], inner[i][1], inner[i][2]]);
          kv.push([inner[i][0], inner[i][1] - 0.17, inner[i][2]]);
        }
        for (let i = 0; i < inner.length - 1; i++) {
          const a = i * 2, b = a + 1, c = a + 3, d = a + 2;
          kf.push(side > 0 ? [a, b, c, d] : [d, c, b, a]);
        }
        const km = new T.Mesh(Geo.fromQuads(kv, kf), kerbMat);
        km.receiveShadow = true;
        grp.add(km);
      }
    }
    Roads.corridors.push({ pts: gp.pts, halfW: spec.w / 2 + spec.walk + 0.4, roadHalf: spec.w / 2 + spec.walk, name: spec.name, tier: gp.pts[0][1] });
    return gp;
  }

  /* ---- the square ------------------------------------------- */
  function buildPlaza(grp) {
    const y = Island.heightAt(PLAZA.x, PLAZA.z);
    const plan = Geo.roundRectPlan(PLAZA.w, PLAZA.d, 3.2, 5);
    const geo = Geo.prism(plan, 0.16, { y0: -0.16 });
    // planar UVs so the fan-pattern texture maps across the square
    const pos = geo.attributes.position, uvA = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      uvA.setXY(i, (pos.getX(i) / PLAZA.w) + 0.5, (pos.getZ(i) / PLAZA.d) + 0.5);
    }
    uvA.needsUpdate = true;
    const m = new T.Mesh(geo, Mat.std(0xffffff, { map: plazaTex(), rough: 0.86, name: 'plaza' }));
    m.position.set(PLAZA.x, y + 0.14, PLAZA.z);
    m.rotation.y = PLAZA.rot;
    m.receiveShadow = true;
    grp.add(m);

    // a raised kerb ring around it
    const ringPlan = Geo.roundRectPlan(PLAZA.w + 0.5, PLAZA.d + 0.5, 3.4, 5);
    const ring = new T.Mesh(Geo.prism(ringPlan, 0.2, { y0: -0.2 }), Mat.std(P.stoneWarm, { rough: 0.84, name: 'plazaKerb' }));
    ring.position.set(PLAZA.x, y + 0.1, PLAZA.z);
    ring.rotation.y = PLAZA.rot;
    ring.receiveShadow = true;
    grp.add(ring);

    Roads.plazaY = y + 0.16;
    Roads.corridors.push({ pts: [[PLAZA.x, y, PLAZA.z]], halfW: 0 });
    return { x: PLAZA.x, z: PLAZA.z, y: y + 0.16 };
  }

  /* ---- tram rails ------------------------------------------- */
  function buildRails(grp, loopPts) {
    const gp = groundPath(loopPts, { closed: true, lift: 0.10 });
    const railMat = Mat.std(P.metalDark, { rough: 0.45, metal: 0.65, name: 'rail' });
    const sleeperMat = Mat.std(P.woodDark, { rough: 0.9, name: 'sleeper' });
    const gauge = 1.22;

    for (const side of [-1, 1]) {
      const line = [];
      const n = gp.pts.length;
      for (let i = 0; i < n; i++) {
        const p = gp.pts[i];
        const a = gp.pts[(i - 1 + n) % n], b = gp.pts[(i + 1) % n];
        let dx = b[0] - a[0], dz = b[2] - a[2];
        const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
        line.push([p[0] - dz * (gauge / 2) * side, p[1] + 0.055, p[2] + dx * (gauge / 2) * side]);
      }
      line.push(line[0]);
      const rg = roadRibbon(line, 0.13, { tile: 4 });
      const rm = new T.Mesh(rg, railMat);
      rm.receiveShadow = true; rm.castShadow = true;
      grp.add(rm);
    }
    // sleepers (instanced)
    const trs = [];
    for (let i = 0; i < gp.pts.length; i += 3) {
      const p = gp.pts[i];
      const b = gp.pts[(i + 1) % gp.pts.length];
      trs.push({ p: [p[0], p[1] - 0.01, p[2]], r: Math.atan2(b[0] - p[0], b[2] - p[2]), s: 1 });
    }
    const sg = Geo.box(2.2, 0.11, 0.3);
    grp.add(Geo.instanced(sg, sleeperMat, trs, { castShadow: false }));

    Roads.tramPath = gp.pts;
    return gp;
  }

  /* ---- bridges ---------------------------------------------- */
  /**
   * archBridge — stone piers + arched spans + parapet.
   * Returns a group with origin at the deck centre, spanning along X.
   */
  function archBridge(opts) {
    opts = opts || {};
    const span = opts.span || 10, width = opts.width || 6;
    const arches = opts.arches || 1, rise = opts.rise || 1.5;
    const deckT = 0.42, pierW = span / arches * 0.16;
    const g = TOWN.group('bridge');
    const stone = Mat.std(opts.color || P.stone, { rough: 0.87, flat: true, name: 'bridgeStone' });
    const cope = Mat.std(P.stoneWarm, { rough: 0.82, name: 'bridgeCope' });

    const aw = span / arches;
    for (let i = 0; i < arches; i++) {
      const cx = -span / 2 + aw * (i + 0.5);
      // spandrel wall with an arched opening, one per side
      const wall = Geo.archWall(aw, rise + deckT + 0.7, 0.34,
        [{ x: 0, y: -0.2, w: aw - pierW * 2, h: rise + 0.55, arc: (aw - pierW * 2) * 0.5 }]);
      for (const side of [-1, 1]) {
        const m = new T.Mesh(wall, stone);
        m.position.set(cx, -rise - 0.1, side * (width / 2 - 0.17));
        m.castShadow = true; m.receiveShadow = true;
        g.add(m);
      }
      // barrel vault under the deck
      const vault = Geo.barrelRoof(width - 0.4, aw - pierW * 2, (aw - pierW * 2) * 0.5, 9, { over: 0, thick: 0.18 });
      const vm = new T.Mesh(vault, stone);
      vm.rotation.y = Math.PI / 2;
      vm.position.set(cx, -rise - 0.3, 0);
      vm.castShadow = true; vm.receiveShadow = true;
      g.add(vm);
    }
    // piers down to the water
    for (let i = 0; i <= arches; i++) {
      const cx = -span / 2 + aw * i;
      const ph = (opts.pierDrop || 3.2);
      const pier = Geo.taperBox(pierW * 1.7, ph, width + 0.2, 1.25, 1.0);
      const pm = new T.Mesh(pier, stone);
      pm.position.set(cx, -rise - 0.4 - ph, 0);
      pm.castShadow = true; pm.receiveShadow = true;
      g.add(pm);
    }
    // deck
    const deck = new T.Mesh(Geo.chamferBox(span + 0.6, deckT, width, 0.1), cope);
    deck.position.y = -deckT / 2;
    deck.receiveShadow = true; deck.castShadow = true;
    g.add(deck);
    // parapets
    for (const side of [-1, 1]) {
      const par = new T.Mesh(Geo.chamferBox(span + 0.6, 0.72, 0.36, 0.07), stone);
      par.position.set(0, 0.36, side * (width / 2 - 0.18));
      par.castShadow = true; par.receiveShadow = true;
      g.add(par);
      const cap = new T.Mesh(Geo.box(span + 0.8, 0.13, 0.5), cope);
      cap.position.set(0, 0.78, side * (width / 2 - 0.18));
      cap.castShadow = true;
      g.add(cap);
    }
    Geo.mergeStatic(g);
    return g;
  }
  Roads.archBridge = archBridge;

  /** timberBridge — trestle bridge for the long harbour crossing */
  function timberBridge(opts) {
    opts = opts || {};
    const span = opts.span || 24, width = opts.width || 6.4, drop = opts.drop || 4.2;
    const g = TOWN.group('trestle');
    const wood = Mat.std(P.woodDark, { rough: 0.9, flat: true, name: 'trestleWood' });
    const wood2 = Mat.std(P.wood, { rough: 0.88, name: 'trestleDeck' });
    const stone = Mat.std(P.stoneDark, { rough: 0.88, flat: true, name: 'trestlePier' });

    const bays = Math.max(3, Math.round(span / 5));
    for (let i = 0; i <= bays; i++) {
      const t = i / bays;
      const cx = -span / 2 + span * t;
      const hump = Math.sin(t * Math.PI) * (opts.rise || 0.9);
      // trestle frame: two splayed legs + cross brace
      for (const side of [-1, 1]) {
        const legTop = -0.35 + hump;
        const leg = Geo.taperBox(0.42, drop + hump, 0.42, 0.7, 0.7);
        const lm = new T.Mesh(leg, wood);
        lm.position.set(cx, legTop - (drop + hump), side * (width / 2 - 0.55));
        lm.rotation.z = side * 0.055;
        lm.castShadow = true; lm.receiveShadow = true;
        g.add(lm);
      }
      const brace = new T.Mesh(Geo.box(width - 0.7, 0.22, 0.22), wood);
      brace.position.set(cx, -1.7 + hump, 0);
      brace.castShadow = true;
      g.add(brace);
      const brace2 = new T.Mesh(Geo.box(width - 0.7, 0.2, 0.2), wood);
      brace2.position.set(cx, -3.1 + hump, 0);
      brace2.castShadow = true;
      g.add(brace2);
      if (i === 0 || i === bays) {
        const pier = new T.Mesh(Geo.taperBox(1.5, drop + 1.2, width + 0.5, 1.2, 1.0), stone);
        pier.position.set(cx, -0.4 - (drop + 1.2) + hump, 0);
        pier.castShadow = true; pier.receiveShadow = true;
        g.add(pier);
      }
    }
    // deck planks (instanced), following the hump
    const planks = [];
    const nP = Math.round(span / 0.46);
    for (let i = 0; i < nP; i++) {
      const t = (i + 0.5) / nP;
      const cx = -span / 2 + span * t;
      planks.push({ p: [cx, Math.sin(t * Math.PI) * (opts.rise || 0.9) - 0.09, 0], r: 0, s: [1, 1, 1] });
    }
    g.add(Geo.instanced(Geo.box(0.4, 0.18, width), wood2, planks));
    // stringers
    for (const side of [-1, 1]) {
      const str = new T.Mesh(Geo.box(span, 0.3, 0.3), wood);
      str.position.set(0, -0.34, side * (width / 2 - 0.4));
      str.castShadow = true;
      g.add(str);
    }
    // railings following the hump
    for (const side of [-1, 1]) {
      const posts = [];
      const nR = Math.round(span / 1.7);
      for (let i = 0; i <= nR; i++) {
        const t = i / nR;
        posts.push({ p: [-span / 2 + span * t, Math.sin(t * Math.PI) * (opts.rise || 0.9), side * (width / 2 - 0.22)], r: 0 });
      }
      const postGeo = Geo.lathe([[0.075, 0], [0.09, 0.1], [0.07, 0.95], [0.1, 1.05], [0.05, 1.15]], 6);
      g.add(Geo.instanced(postGeo, wood, posts));
      // handrail as a slightly humped ribbon
      const rail = [];
      for (let i = 0; i <= 24; i++) {
        const t = i / 24;
        rail.push([-span / 2 + span * t, Math.sin(t * Math.PI) * (opts.rise || 0.9) + 1.02, side * (width / 2 - 0.22)]);
      }
      const rm = new T.Mesh(Geo.tube(rail, 0.07, 5), wood2);
      rm.castShadow = true;
      g.add(rm);
    }
    Geo.mergeStatic(g);
    return g;
  }
  Roads.timberBridge = timberBridge;

  /* ---- piers / docks ---------------------------------------- */
  function pier(opts) {
    opts = opts || {};
    const len = opts.len || 11, width = opts.width || 3.2;
    const g = TOWN.group('pier');
    const wood = Mat.std(P.wood, { rough: 0.9, name: 'pierDeck' });
    const post = Mat.std(P.woodDark, { rough: 0.92, flat: true, name: 'pierPost' });
    // deck planks running across
    const planks = [];
    const n = Math.round(len / 0.44);
    for (let i = 0; i < n; i++) {
      planks.push({ p: [0, 0, -len / 2 + (i + 0.5) * (len / n)], r: 0, s: [1, 1, 0.92 + (i % 3) * 0.04] });
    }
    g.add(Geo.instanced(Geo.box(width, 0.16, 0.4), wood, planks));
    // bearers
    for (const side of [-1, 1]) {
      const b = new T.Mesh(Geo.box(0.24, 0.26, len), post);
      b.position.set(side * (width / 2 - 0.25), -0.2, 0);
      b.castShadow = true;
      g.add(b);
    }
    // piles down into the water
    const piles = [];
    const rows = Math.max(2, Math.round(len / 2.6));
    for (let i = 0; i <= rows; i++) {
      const z = -len / 2 + (len * i) / rows;
      for (const side of [-1, 1]) {
        piles.push({ p: [side * (width / 2 - 0.2), -1.9, z], r: [0.03 * side, 0, 0.04], s: [1, 1 + (i % 2) * 0.12, 1] });
      }
    }
    g.add(Geo.instanced(Geo.lathe([[0.16, 0], [0.19, 0.4], [0.17, 3.6], [0.2, 3.9]], 6), post, piles));
    Geo.mergeStatic(g);
    return g;
  }
  Roads.pier = pier;

  /* ============================================================
     Assemble
     ============================================================ */
  Roads.build = function (scene) {
    const root = TOWN.group('roads');
    const t0 = performance.now();

    for (const spec of NET) buildRoad(spec, root);
    for (const r of Island.RAMPS) {
      const cfg = RAMP_ROADS[r.name];
      if (!cfg) continue;
      buildRoad({ name: 'ramp_' + r.name, w: cfg.w, kind: cfg.kind, walk: cfg.walk, pts: r.pts }, root);
    }
    const plaza = buildPlaza(root);

    // ---- tram loop: the town circuit, offset inboard of the traffic lane
    const townLoopCtrl = [
      [-14.8, 6.8], [-6, 6.9], [2, 6.6], [10, 5.6], [17, 3.4], [22.3, 0.2],
      [23.2, -6], [23.0, -14.6], [18, -15.4], [10, -16.0], [2, -16.4],
      [-6, -16.6], [-15.0, -15.8], [-15.2, -2],
    ];
    const railLoop = offsetLoop(townLoopCtrl, 1.55);
    buildRails(root, railLoop);

    // ---- bridges
    const bridges = [];
    // harbour mouth trestle
    {
      const b = timberBridge({ span: 24.5, width: 6.4, drop: 4.6, rise: 1.05 });
      b.position.set(19.7, BRIDGE_DECK + 0.07, 37.7);
      b.rotation.y = -0.045;
      root.add(b);
      bridges.push({ kind: 'trestle', at: [19.7, BRIDGE_DECK, 37.7] });
    }
    // brook crossing on the main street
    {
      const y = Island.heightAt(-28.0, 6.5);
      const b = archBridge({ span: 6.4, width: 7.4, arches: 1, rise: 1.05, pierDrop: 1.9 });
      b.position.set(-28.0, y + 0.28, 6.5);
      b.rotation.y = 0.9;
      root.add(b);
      bridges.push({ kind: 'arch', at: [-28.0, y, 6.5] });
    }
    // brook crossing on the back lane
    {
      const y = Island.heightAt(-24.2, 10.6);
      const b = archBridge({ span: 5.6, width: 6.4, arches: 1, rise: 0.95, pierDrop: 1.7 });
      b.position.set(-24.2, y + 0.26, 10.6);
      b.rotation.y = 0.35;
      root.add(b);
      bridges.push({ kind: 'arch', at: [-24.2, y, 10.6] });
    }
    // terrace footbridge over the stream
    {
      const y = Island.heightAt(-30.5, -3.0);
      const b = archBridge({ span: 4.6, width: 3.0, arches: 1, rise: 0.8, pierDrop: 1.4, color: P.stoneWarm });
      b.position.set(-30.5, y + 0.5, -3.0);
      b.rotation.y = 0.55;
      root.add(b);
      bridges.push({ kind: 'foot', at: [-30.5, y, -3.0] });
    }
    Roads.bridges = bridges;

    // ---- piers in the harbour
    const piers = [];
    {
      const p1 = pier({ len: 12, width: 3.4 });
      p1.position.set(11.5, 1.35, 27); p1.rotation.y = Math.PI / 2 + 0.05;
      root.add(p1); piers.push([11.5, 1.35, 27]);

      const p2 = pier({ len: 9, width: 3.0 });
      p2.position.set(17.5, 1.35, 21.5); p2.rotation.y = 0.03;
      root.add(p2); piers.push([17.5, 1.35, 21.5]);

      const p3 = pier({ len: 10, width: 2.8 });
      p3.position.set(28.5, 1.35, 28); p3.rotation.y = Math.PI / 2 - 0.06;
      root.add(p3); piers.push([28.5, 1.35, 28]);

      // beach jetty on the west cove
      const yb = Island.heightAt(-46, 20);
      const p4 = pier({ len: 8, width: 2.4 });
      p4.position.set(-47.5, Math.max(0.9, yb + 0.9), 20); p4.rotation.y = Math.PI / 2;
      root.add(p4); piers.push([-47.5, 1.0, 20]);
    }
    Roads.piers = piers;

    /* ---- routes published for the dynamics module ---- */
    const lift = (pts, dy) => pts.map((p) => [p[0], (p.length === 3 ? p[1] : Island.heightAt(p[0], p[p.length - 1])) + (dy || 0), p[p.length - 1]]);

    const carLoop = offsetLoop(townLoopCtrl, -1.5);
    Roads.routes = {
      // vehicles keep to the outer lane, the tram to the inner rails
      townLoop: lift(carLoop, 0.16),
      tramLoop: lift(railLoop, 0.20),
      quayLoop: groundPath(NET.find((n) => n.name === 'quayRing').pts, { closed: true, lift: 0.16 }).pts,
      fairLoop: groundPath(NET.find((n) => n.name === 'fairSt').pts, { closed: true, lift: 0.16 }).pts,
      terraceLoop: groundPath(NET.find((n) => n.name === 'terraceSt').pts, { closed: true, lift: 0.16 }).pts,

      // pedestrian circuits
      plazaWalk: (function () {
        const pts = [];
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * U.TAU;
          pts.push([PLAZA.x + Math.cos(a) * 7.4, plaza.y + 0.06, PLAZA.z + Math.sin(a) * 4.6]);
        }
        return pts;
      })(),
      mainWalk: (function () {
        const gp = groundPath(NET[0].pts, { lift: 0.24 });
        const out = [];
        const n = gp.pts.length;
        for (let i = 0; i < n; i++) {
          const p = gp.pts[i];
          const a = gp.pts[Math.max(0, i - 1)], b = gp.pts[Math.min(n - 1, i + 1)];
          let dx = b[0] - a[0], dz = b[2] - a[2];
          const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
          out.push([p[0] - dz * 4.1, p[1], p[2] + dx * 4.1]);
        }
        // walk back along the other pavement to close the loop
        for (let i = n - 1; i >= 0; i--) {
          const p = gp.pts[i];
          const a = gp.pts[Math.max(0, i - 1)], b = gp.pts[Math.min(n - 1, i + 1)];
          let dx = b[0] - a[0], dz = b[2] - a[2];
          const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
          out.push([p[0] + dz * 4.1, p[1], p[2] - dx * 4.1]);
        }
        return out;
      })(),
      quayWalk: groundPath(offsetLoop(NET.find((n) => n.name === 'quayRing').pts, 4.2), { closed: true, lift: 0.24 }).pts,
      terraceWalk: groundPath(offsetLoop(NET.find((n) => n.name === 'terraceSt').pts, 3.6), { closed: true, lift: 0.24 }).pts,

      // water
      bayBoats: [[17, 0, 45], [24, 0, 43], [27.5, 0, 34], [22, 0, 28], [14.5, 0, 30], [11, 0, 40]],
      openSea: [[62, 0, 38], [70, 0, 4], [58, 0, -32], [22, 0, -56], [-26, 0, -58],
        [-62, 0, -26], [-68, 0, 16], [-44, 0, 50], [4, 0, 62], [40, 0, 56]],
    };

    // collapse the street surfaces, kerbs, pavements, rails and structures
    Geo.mergeStatic(root);

    if (scene) scene.add(root);
    Roads.root = root;
    Roads.buildMs = performance.now() - t0;
    console.log('[TOWN] roads built in ' + Roads.buildMs.toFixed(0) + 'ms');
    return root;
  };

  console.log('[TOWN] roads ready');
})(window);
