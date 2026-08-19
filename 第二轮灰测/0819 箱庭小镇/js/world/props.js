/* =============================================================
   箱庭小镇 · props.js — TOWN.Props
   Street furniture & "the thousand small delights":
   lighting, seating, commerce & signage, harbour kit, garden kit,
   monuments, rooftop dressing, small vehicles.

   CONVENTIONS (see docs/CONTRACT.md)
   * every factory: f(opts) -> THREE.Group, opts always defaulted,
     opts.seed drives ALL randomness (U.rng), origin = footprint centre
     on y = 0, front face toward +Z.
   * userData.footprint {w,d}, userData.height, userData.kind are set.
   * ZERO real lights. Lamps = Mat.lamp() + TOWN.halo() sprites only.
   * fabric always sags / curves (grid() helper), never a flat quad.
   * ONE shared ticker each for flags, laundry, hanging signs, crane
     hooks and flames — never one ticker per instance.
   * geometry is cached at module level (gc), so bench() x40 is cheap.

   WALL-MOUNTED factories (origin on the WALL FACE, projecting +Z):
     awning, shopSign, flowerBox, streetLamp({style:'wall'})
   ABSOLUTE-POINT factories (a / b are world points measured from the
   group origin — add the group at 0,0,0 or pass absolute coordinates):
     lanternString, bunting, washingLine, wires
   ============================================================= */
(function (global) {
  'use strict';

  const T = global.THREE;
  const TOWN = global.TOWN;
  const U = TOWN.U, Geo = TOWN.Geo, Mat = TOWN.Mat, Tex = TOWN.Tex, P = TOWN.Palette;
  const mesh = TOWN.mesh;
  const Props = TOWN.Props = {};
  const DEG = Math.PI / 180;

  /* ============================================================
     0 · materials — 21 shared base materials (+ per-sign map mats)
     ============================================================ */
  const M = {
    wood:      Mat.std(P.wood,        { rough: 0.82, flat: true, name: 'p_wood' }),
    woodDark:  Mat.std(P.woodDark,    { rough: 0.86, flat: true, name: 'p_woodDark' }),
    timber:    Mat.std(P.timber,      { rough: 0.9,  flat: true, name: 'p_timber' }),
    iron:      Mat.std(P.iron,        { rough: 0.55, metal: 0.45, flat: true, name: 'p_iron' }),
    metal:     Mat.std(P.metal,       { rough: 0.42, metal: 0.55, flat: true, name: 'p_metal' }),
    brass:     Mat.std(P.brass,       { rough: 0.34, metal: 0.7,  name: 'p_brass' }),
    stone:     Mat.std(P.stone,       { rough: 0.93, flat: true, name: 'p_stone' }),
    stoneDark: Mat.std(P.stoneDark,   { rough: 0.93, flat: true, name: 'p_stoneDark' }),
    white:     Mat.std(P.offWhite,    { rough: 0.8,  flat: true, name: 'p_offWhite' }),
    glass:     Mat.std(P.glass,       { rough: 0.12, metal: 0.1, transparent: true, opacity: 0.34, name: 'p_glass' }),
    lamp:      Mat.lamp(P.lampWarm),
    fire:      Mat.glow(P.fire, 1.4),
    water:     Mat.std(P.waterShallow,{ rough: 0.22, transparent: true, opacity: 0.75, name: 'p_water' }),
    /** vertex-coloured, double sided: every painted / fabric surface */
    vc:        Mat.std(0xffffff, { rough: 0.86, flat: true, vertexColors: true, side: T.DoubleSide, name: 'p_vc' }),
    /** white base for InstancedMesh instanceColor (opaque small parts) */
    tint:      Mat.std(0xffffff, { rough: 0.74, flat: true, name: 'p_tint' }),
    /** white base for InstancedMesh instanceColor (cloth, two-sided) */
    clothTint: Mat.std(0xffffff, { rough: 0.9,  flat: true, side: T.DoubleSide, name: 'p_clothTint' }),
  };

  /* ============================================================
     1 · textures (all cached in Tex, one material each)
     ============================================================ */
  function texClock() {
    return Tex.canvas('props.clockface', 128, 128, (c, w, h) => {
      c.fillStyle = '#f6efe0'; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#3c4046'; c.lineWidth = 6;
      c.beginPath(); c.arc(w / 2, h / 2, w / 2 - 6, 0, Math.PI * 2); c.stroke();
      c.fillStyle = '#3c4046';
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const r0 = w / 2 - 16, big = i % 3 === 0;
        c.beginPath();
        c.arc(w / 2 + Math.sin(a) * r0, h / 2 - Math.cos(a) * r0, big ? 5 : 2.6, 0, Math.PI * 2);
        c.fill();
      }
      c.lineCap = 'round';
      c.strokeStyle = '#23262b'; c.lineWidth = 7;
      c.beginPath(); c.moveTo(w / 2, h / 2); c.lineTo(w / 2 - 24, h / 2 - 18); c.stroke();
      c.lineWidth = 4.5;
      c.beginPath(); c.moveTo(w / 2, h / 2); c.lineTo(w / 2 + 16, h / 2 - 38); c.stroke();
      c.fillStyle = '#b85c42';
      c.beginPath(); c.arc(w / 2, h / 2, 5, 0, Math.PI * 2); c.fill();
    });
  }
  function texChalk() {
    return Tex.canvas('props.chalk', 128, 96, (c, w, h) => {
      c.fillStyle = '#2b3330'; c.fillRect(0, 0, w, h);
      c.strokeStyle = 'rgba(240,240,225,0.85)'; c.lineWidth = 2;
      c.strokeRect(7, 7, w - 14, h - 14);
      c.fillStyle = 'rgba(245,244,230,0.92)';
      c.font = 'bold 20px sans-serif'; c.textAlign = 'center';
      c.fillText('TODAY', w / 2, 38);
      c.font = '15px sans-serif';
      c.fillText('soup  ·  bread', w / 2, 60);
      c.fillText('2 coins', w / 2, 78);
    });
  }
  function texPaper() {
    return Tex.canvas('props.paper', 128, 128, (c, w, h) => {
      c.fillStyle = '#efe6d2'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#d8cdb4'; c.fillRect(0, 0, w, 22);
      c.fillStyle = '#5b5346'; c.font = 'bold 15px sans-serif'; c.textAlign = 'center';
      c.fillText('NOTICE', w / 2, 16);
      c.strokeStyle = 'rgba(90,84,70,0.5)'; c.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        const y = 40 + i * 13;
        c.beginPath(); c.moveTo(14, y); c.lineTo(w - 14 - (i % 3) * 18, y); c.stroke();
      }
      c.strokeStyle = 'rgba(60,64,70,0.35)'; c.lineWidth = 3; c.strokeRect(3, 3, w - 6, h - 6);
    });
  }
  function texNet() {
    return Tex.canvas('props.net', 64, 64, (c, w, h) => {
      c.clearRect(0, 0, w, h);
      c.strokeStyle = 'rgba(226,220,201,0.95)'; c.lineWidth = 4; c.lineCap = 'round';
      for (let i = -2; i <= 4; i++) {
        c.beginPath(); c.moveTo(i * 22, 0); c.lineTo(i * 22 + h, h); c.stroke();
        c.beginPath(); c.moveTo(i * 22, h); c.lineTo(i * 22 + h, 0); c.stroke();
      }
    }, { repeat: [3, 2] });
  }
  /**
   * ONE shared little-signs atlas (2 cols x 3 rows) so that every
   * standard street sign costs a single material.  Cells:
   * 0 TRAM · 1 PHONE · 2 NEWS · 3 OPEN · 4 CAFE · 5 HOTEL
   */
  const ATLAS_WORDS = [
    ['TRAM', '#3f7d78'], ['PHONE', '#f1e2c6'], ['NEWS', '#4b6b8a'],
    ['OPEN', '#c4544c'], ['CAFE', '#dcae4e'], ['HOTEL', '#7a4f5e'],
  ];
  function texAtlas() {
    return Tex.canvas('props.atlas', 256, 255, (c, w, h) => {
      const cw = 128, ch = 85;
      for (let i = 0; i < 6; i++) {
        const col = i % 2, row = (i / 2) | 0;
        const x = col * cw, y = row * ch;
        c.fillStyle = ATLAS_WORDS[i][1];
        c.fillRect(x, y, cw, ch);
        const dark = i === 1 || i === 4;
        c.strokeStyle = dark ? '#3c4046' : '#f6efe0';
        c.lineWidth = 4; c.strokeRect(x + 6, y + 6, cw - 12, ch - 12);
        c.fillStyle = dark ? '#3c4046' : '#f6efe0';
        c.textAlign = 'center'; c.textBaseline = 'middle';
        let size = 40;
        c.font = 'bold ' + size + 'px sans-serif';
        while (c.measureText(ATLAS_WORDS[i][0]).width > cw - 26 && size > 12) {
          size -= 2; c.font = 'bold ' + size + 'px sans-serif';
        }
        c.fillText(ATLAS_WORDS[i][0], x + cw / 2, y + ch / 2 + 1);
      }
    });
  }
  /** a plane showing one atlas cell (shared material, cached geometry) */
  function atlasPlane(w, h, idx) {
    const k = 'atlasPlane|' + w.toFixed(2) + '|' + h.toFixed(2) + '|' + idx;
    return gc(k, function () {
      const g = new T.PlaneGeometry(w, h);
      const col = idx % 2, row = (idx / 2) | 0;
      const uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) {
        uv.setXY(i, (col + uv.getX(i)) / 2, (2 - row + uv.getY(i)) / 3);
      }
      return g;
    });
  }
  function texSign(text, bg, fg) {
    const key = 'props.sign|' + text + '|' + bg + '|' + fg;
    return Tex.canvas(key, 256, 128, (c, w, h) => {
      c.fillStyle = '#' + ('000000' + bg.toString(16)).slice(-6); c.fillRect(0, 0, w, h);
      const f = '#' + ('000000' + fg.toString(16)).slice(-6);
      c.strokeStyle = f; c.lineWidth = 5; c.strokeRect(9, 9, w - 18, h - 18);
      c.fillStyle = f; c.textAlign = 'center'; c.textBaseline = 'middle';
      let size = 54;
      c.font = 'bold ' + size + 'px sans-serif';
      while (c.measureText(text).width > w - 44 && size > 14) {
        size -= 3; c.font = 'bold ' + size + 'px sans-serif';
      }
      c.fillText(text, w / 2, h / 2 + 2);
      c.beginPath(); c.arc(24, h / 2, 4, 0, Math.PI * 2); c.arc(w - 24, h / 2, 4, 0, Math.PI * 2); c.fill();
    });
  }

  const mapMats = new Map();
  /** a unique mapped material per texture key (safe to own & mutate) */
  function mapMat(key, tex, opts) {
    opts = opts || {};
    let m = mapMats.get(key);
    if (m) return m;
    m = Mat.std(0xffffff, {
      rough: opts.rough === undefined ? 0.72 : opts.rough,
      map: tex,
      transparent: !!opts.transparent,
      opacity: opts.opacity === undefined ? 1 : opts.opacity,
      alphaTest: opts.alphaTest || 0,
      side: opts.side || T.FrontSide,
      name: 'p_map_' + key,
    });
    if (opts.night) Mat.registerNight(m, { on: 0.14, max: opts.night, flick: opts.flick || 0 }, U.hash(key.length * 3.1, 5.5) * 40);
    mapMats.set(key, m);
    return m;
  }
  const matClock = () => mapMat('clock', texClock(), { rough: 0.5, night: 0.9 });
  const matChalk = () => mapMat('chalk', texChalk(), { rough: 0.9 });
  const matPaper = () => mapMat('paper', texPaper(), { rough: 0.85 });
  const matNet = () => mapMat('net', texNet(), { rough: 0.9, transparent: true, alphaTest: 0.35, side: T.DoubleSide });
  const matAtlas = () => mapMat('atlas', texAtlas(), { rough: 0.66, night: 1.15, flick: 0.03 });
  function matSign(text, bg, fg, glow) {
    const k = 'sign|' + text + '|' + bg;
    return mapMat(k, texSign(text, bg, fg), { rough: 0.66, night: glow ? 1.3 : 0, flick: glow ? 0.04 : 0 });
  }

  /* ============================================================
     2 · geometry helpers
     ============================================================ */
  const GC = new Map();
  function gc(key, build) { let g = GC.get(key); if (!g) { g = build(); GC.set(key, g); } return g; }

  /** cylindrical rod along +Y, base at y=0 (bars, poles, ropes) */
  function rod(r, h, sides, open) {
    const k = 'rod|' + r.toFixed(3) + '|' + h.toFixed(3) + '|' + (sides || 5) + (open ? 'o' : '');
    return gc(k, function () {
      const g = new T.CylinderGeometry(r, r, h, sides || 5, 1, !!open);
      g.translate(0, h / 2, 0);
      return g;
    });
  }
  /** tapered rod, base at y=0 */
  function taper(r0, r1, h, sides, open) {
    const k = 'tap|' + r0.toFixed(3) + '|' + r1.toFixed(3) + '|' + h.toFixed(3) + '|' + (sides || 5) + (open ? 'o' : '');
    return gc(k, function () {
      const g = new T.CylinderGeometry(r1, r0, h, sides || 5, 1, !!open);
      g.translate(0, h / 2, 0);
      return g;
    });
  }
  /** plank / slat / board (bare boxes are only allowed for these) */
  function board(w, h, d) { return Geo.box(w, h, d); }
  /**
   * boardUp / geoUp — InstancedMesh geometry MUST sit at y >= 0 in its
   * own local space: Box3 (and the probe) measures instanced meshes from
   * the un-transformed geometry, so a centred box would report minY < 0.
   */
  function boardUp(w, h, d) {
    return gc('bup|' + w.toFixed(3) + '|' + h.toFixed(3) + '|' + d.toFixed(3), function () {
      const g = board(w, h, d).clone();
      g.translate(0, h / 2, 0);
      return g;
    });
  }
  function geoUp(key, geo, dy) {
    return gc('up|' + key + '|' + dy.toFixed(3), function () {
      const g = geo.clone();
      g.translate(0, dy, 0);
      return g;
    });
  }

  /** 8-triangle "round" primitive — fruit, coals, stones, pigeons */
  function octa(rx, ry, rz) {
    const k = 'oct|' + rx.toFixed(3) + '|' + ry.toFixed(3) + '|' + rz.toFixed(3);
    return gc(k, function () {
      const v = [[0, -ry, 0], [rx, 0, 0], [0, 0, rz], [-rx, 0, 0], [0, 0, -rz], [0, ry, 0]];
      return Geo.fromQuads(v, [
        [0, 2, 1], [0, 3, 2], [0, 4, 3], [0, 1, 4],
        [5, 1, 2], [5, 2, 3], [5, 3, 4], [5, 4, 1],
      ]);
    });
  }
  /** 4-triangle dome — cobbles, rivets, bread rolls */
  function dome4(rx, ry, rz) {
    const k = 'dm4|' + rx.toFixed(3) + '|' + ry.toFixed(3) + '|' + rz.toFixed(3);
    return gc(k, function () {
      const v = [[rx, 0, 0], [0, 0, rz], [-rx, 0, 0], [0, 0, -rz], [0, ry, 0]];
      return Geo.fromQuads(v, [[4, 0, 1], [4, 1, 2], [4, 2, 3], [4, 3, 0]]);
    });
  }

  /**
   * lathe(profile, sides) — Geo.lathe with automatic orientation.
   * three's LatheGeometry winds so that a profile walked with INCREASING y
   * faces +r (outward); a purely descending profile therefore comes out
   * inside-out, and a disc walked outward faces down.  For monotonic
   * profiles we pick the orientation that faces outward (walls) or upward
   * (discs, caps, water surfaces).  Folded profiles — a basin walked up the
   * outside, over the lip and down the inside — are left exactly as
   * authored, because their normals must flip at the fold.
   */
  function lathe(prof, sides) {
    let up = 0, dn = 0;
    for (let i = 1; i < prof.length; i++) {
      const dy = prof[i][1] - prof[i - 1][1];
      if (dy > 1e-9) up++; else if (dy < -1e-9) dn++;
    }
    if (!(up && dn) && prof.length > 1) {
      const dY = prof[prof.length - 1][1] - prof[0][1];
      const dR = prof[prof.length - 1][0] - prof[0][0];
      if (Math.abs(dY) >= Math.abs(dR) ? dY < 0 : dR > 0) prof = prof.slice().reverse();
    }
    return Geo.lathe(prof, sides);
  }

  /**
   * plateX(profile, thickness) — a shaped flat plate, thickness along X,
   * silhouette in the ZY plane. profile: [[z,y],...] CCW (z right, y up).
   * This is the anti-cube tool for bench ends, brackets, jibs, A-frames.
   */
  function plateX(prof, th) {
    const g = Geo.prism(prof.map((p) => [p[0], p[1]]), th, { y0: -th / 2 });
    // cyclic permutation (x,y,z) -> (y,z,x): keeps winding, det = +1
    g.applyMatrix4(new T.Matrix4().set(0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 1));
    return g;
  }

  /** loft(rings) — stack of horizontal rings -> hull/vase/trough shells */
  function loft(rings, opts) {
    opts = opts || {};
    const n = rings[0].pts.length, verts = [], faces = [];
    for (let k = 0; k < rings.length; k++) {
      const R = rings[k];
      for (let i = 0; i < n; i++) verts.push([R.pts[i][0], R.y, R.pts[i][1]]);
    }
    for (let k = 0; k < rings.length - 1; k++) {
      const a = k * n, b = (k + 1) * n;
      for (let i = 0; i < n; i++) { const j = (i + 1) % n; faces.push([a + i, a + j, b + j, b + i]); }
    }
    const centre = (R) => {
      let cx = 0, cz = 0;
      for (let i = 0; i < n; i++) { cx += R.pts[i][0]; cz += R.pts[i][1]; }
      return [cx / n, cz / n];
    };
    if (opts.capTop !== false) {
      const R = rings[rings.length - 1], b = (rings.length - 1) * n, c = centre(R);
      verts.push([c[0], R.y, c[1]]); const ci = verts.length - 1;
      for (let i = 0; i < n; i++) faces.push([b + i, b + (i + 1) % n, ci]);
    }
    if (opts.capBottom !== false) {
      const R = rings[0], c = centre(R);
      verts.push([c[0], R.y, c[1]]); const ci = verts.length - 1;
      for (let i = 0; i < n; i++) faces.push([(i + 1) % n, i, ci]);
    }
    return Geo.fromQuads(verts, faces);
  }
  function ellipsePlan(rx, rz, n, rot) {
    const p = [];
    for (let i = 0; i < n; i++) {
      const a = (rot || 0) + (i / n) * Math.PI * 2;
      p.push([Math.cos(a) * rx, Math.sin(a) * rz]);
    }
    return p;
  }

  /**
   * grid(nu, nv, ptFn, colFn) — the FABRIC tool.  A quad sheet whose
   * vertices come from ptFn(u,v) so every cloth can sag, curve or wave.
   * colFn is passed to Geo.paint for stripes (material M.vc).
   */
  function grid(nu, nv, ptFn, colFn) {
    const verts = [], faces = [];
    for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) verts.push(ptFn(i / nu, j / nv));
    const id = (i, j) => i * (nv + 1) + j;
    for (let i = 0; i < nu; i++) {
      for (let j = 0; j < nv; j++) faces.push([id(i, j), id(i + 1, j), id(i + 1, j + 1), id(i, j + 1)]);
    }
    const g = Geo.fromQuads(verts, faces);
    if (colFn) Geo.paint(g, colFn);
    else Geo.paint(g, (c) => c.set(0xffffff));
    return g;
  }
  /** flat colour for a vertex-coloured geometry */
  function tinted(geo, hex) { return Geo.paint(geo.clone(), (c) => c.set(hex)); }
  /** stripe painter across X */
  function stripes(w, bands, a, b) {
    return function (c, x) {
      const t = U.clamp((x + w / 2) / w, 0, 0.99999);
      c.set(Math.floor(t * bands) % 2 ? b : a);
    };
  }
  /** scalloped valance: hanging strip with a wavy bottom edge */
  function valance(w, drop, scallops, colFn) {
    const nu = Math.max(6, scallops * 3);
    return grid(nu, 1, (u, v) => {
      const x = -w / 2 + w * u;
      const wave = 0.5 - 0.5 * Math.cos(u * scallops * Math.PI * 2);
      return [x, -v * drop * (0.45 + 0.55 * wave), 0];
    }, colFn);
  }

  /**
   * meshBox(obj) — bounds of the plain meshes only.  InstancedMesh is
   * skipped on purpose: its geometry bounding box is NOT the instance
   * cloud, so including it would mis-ground a prop.  Pass explicit
   * footprint/height to finish() for instance-dominated factories.
   */
  function meshBox(obj) {
    const b = new T.Box3(), bb = new T.Box3();
    obj.updateMatrixWorld(true);
    obj.traverse(function (o) {
      if (!o.isMesh || o.isInstancedMesh) return;
      const g = o.geometry;
      if (!g.boundingBox) g.computeBoundingBox();
      if (!g.boundingBox) return;
      bb.copy(g.boundingBox).applyMatrix4(o.matrixWorld);
      b.union(bb);
    });
    return b;
  }
  /** drop an object so its lowest mesh vertex rests on y=0 */
  function ground(obj) {
    const b = meshBox(obj);
    if (isFinite(b.min.y)) obj.position.y -= b.min.y;
    return obj;
  }
  /**
   * jitter(g, r, lo, hi) — small per-seed size variation so a row of the
   * same prop never reads as identical stamps.  finish() multiplies the
   * declared footprint/height by it.
   */
  function jitter(g, r, lo, hi) {
    g.scale.setScalar(r.range(lo === undefined ? 0.94 : lo, hi === undefined ? 1.07 : hi));
    return g;
  }
  /** set the contract userData (mesh-only bounds, sprites never inflate) */
  function finish(g, kind, w, d, h) {
    const b = meshBox(g);                 // already includes g.scale
    const sc = g.scale.x || 1;
    const fw = w !== undefined ? w * sc : Math.max(0.05, b.max.x - b.min.x);
    const fd = d !== undefined ? d * sc : Math.max(0.05, b.max.z - b.min.z);
    const fh = h !== undefined ? h * sc : Math.max(0.05, b.max.y);
    g.userData.footprint = { w: +fw.toFixed(3), d: +fd.toFixed(3) };
    g.userData.height = +fh.toFixed(3);
    g.userData.kind = kind;
    return g;
  }
  function add(parent, geo, mat, x, y, z, ry) {
    const m = mesh(geo, mat, x, y, z);
    if (ry) m.rotation.y = ry;
    parent.add(m);
    return m;
  }

  /* ============================================================
     3 · the five shared tickers (flags, laundry, signs, hooks, flame)
     ============================================================ */
  const anim = { flags: [], lines: [], swings: [], hooks: [], flames: [] };
  let tickersReady = false;

  function ensureTickers() {
    if (tickersReady) return;
    tickersReady = true;

    TOWN.Ticker.add(function (dt, el) {           // 1 · every flag & sail
      const list = anim.flags;
      for (let k = 0; k < list.length; k++) {
        const f = list[k], p = f.p, b = f.base, n = p.count;
        for (let i = 0; i < n; i++) {
          const x = b[i * 3], y = b[i * 3 + 1], z = b[i * 3 + 2];
          const t = U.saturate(Math.abs(x - f.x0) / f.w);
          const s = Math.sin(x * 3.6 - el * f.sp + f.ph) * f.amp * t * t;
          const s2 = Math.cos(x * 2.2 - el * f.sp * 0.7 + f.ph * 1.7) * f.amp * 0.35 * t;
          p.setXYZ(i, x, y + s2, z + s);
        }
        p.needsUpdate = true;
      }
    }, 'props.flags');

    TOWN.Ticker.add(function (dt, el) {           // 2 · laundry & hanging cloth
      const list = anim.lines;
      for (let k = 0; k < list.length; k++) {
        const e = list[k];
        e.o.rotation.z = Math.sin(el * e.sp + e.ph) * e.amp;
        e.o.rotation.x = Math.cos(el * e.sp * 0.83 + e.ph) * e.amp * 0.5;
      }
    }, 'props.laundry');

    TOWN.Ticker.add(function (dt, el) {           // 3 · hanging signs & lanterns
      const list = anim.swings;
      for (let k = 0; k < list.length; k++) {
        const e = list[k];
        e.o.rotation.z = Math.sin(el * e.sp + e.ph) * e.amp;
      }
    }, 'props.swing');

    TOWN.Ticker.add(function (dt, el) {           // 4 · crane hooks
      const list = anim.hooks;
      for (let k = 0; k < list.length; k++) {
        const e = list[k];
        e.o.rotation.z = Math.sin(el * 0.62 + e.ph) * e.amp;
        e.o.rotation.x = Math.sin(el * 0.44 + e.ph * 1.6) * e.amp * 0.7;
      }
    }, 'props.hooks');

    TOWN.Ticker.add(function (dt, el) {           // 5 · flames (always on)
      const list = anim.flames;
      for (let k = 0; k < list.length; k++) {
        const e = list[k];
        const f = 1 + Math.sin(el * 9.3 + e.ph) * 0.12 + Math.sin(el * 21.7 + e.ph * 2.1) * 0.05;
        e.o.scale.set(1 / Math.sqrt(f), f, 1 / Math.sqrt(f));
        e.o.rotation.y = el * 1.7 + e.ph;
      }
    }, 'props.flame', { always: true });
  }

  function addFlag(m, width, x0, amp, seed, speed) {
    ensureTickers();
    const p = m.geometry.attributes.position;
    const base = new Float32Array(p.array.length);
    base.set(p.array);
    m.geometry.computeBoundingSphere();
    m.geometry.boundingSphere.radius *= 2;
    m.frustumCulled = false;
    anim.flags.push({ p, base, w: Math.max(0.2, width), x0: x0 || 0, amp: amp, ph: seed * 1.7, sp: speed || 4.6 });
    TOWN.markDynamic(m);
    return m;
  }
  function addSway(o, amp, sp, seed) {
    ensureTickers();
    anim.lines.push({ o, amp, sp: sp || 1.5, ph: seed * 2.3 });
    TOWN.markDynamic(o);
    return o;
  }
  function addSwing(o, amp, sp, seed) {
    ensureTickers();
    anim.swings.push({ o, amp, sp: sp || 1.1, ph: seed * 1.3 });
    TOWN.markDynamic(o);
    return o;
  }
  function addHook(o, amp, seed) {
    ensureTickers();
    anim.hooks.push({ o, amp: amp === undefined ? 0.07 : amp, ph: seed * 0.9 });
    TOWN.markDynamic(o);
    return o;
  }
  function addFlame(o, seed) {
    ensureTickers();
    anim.flames.push({ o, ph: seed * 3.1 });
    TOWN.markDynamic(o);
    return o;
  }

  /* ============================================================
     4 · shared sub-assemblies
     ============================================================ */

  /** fluted cast-iron column: base swell, entasis shaft, collar */
  function columnGeo(h, r, sides) {
    const k = 'col|' + h.toFixed(2) + '|' + r.toFixed(3) + '|' + (sides || 6);
    return gc(k, function () {
      const prof = [
        [r * 2.1, 0], [r * 2.2, h * 0.018], [r * 1.55, h * 0.05], [r * 1.7, h * 0.075],
        [r * 1.15, h * 0.11], [r * 1.02, h * 0.42],                      // entasis belly
        [r * 0.86, h * 0.78], [r * 1.12, h * 0.83], [r * 0.86, h * 0.87], // collar
        [r * 0.72, h],
      ];
      return lathe(prof, sides || 6);
    });
  }
  /** cheap turned post (fences, shelters, pergolas) */
  function postGeo(h, r, sides) {
    const k = 'post|' + h.toFixed(2) + '|' + r.toFixed(3) + '|' + (sides || 5);
    return gc(k, function () {
      return lathe([[r * 1.4, 0], [r * 1.1, h * 0.06], [r, h * 0.18], [r * 0.86, h * 0.94], [r * 0.55, h]], sides || 5);
    });
  }
  /** moulded stone plinth (statues, monuments, fountains) */
  function plinthGeo(w, h, sides) {
    const k = 'pl|' + w.toFixed(2) + '|' + h.toFixed(2) + '|' + (sides || 8);
    return gc(k, function () {
      const r = w / 2;
      return lathe([
        [r, 0], [r, h * 0.14], [r * 0.9, h * 0.2], [r * 0.84, h * 0.78],
        [r * 0.96, h * 0.86], [r * 1.02, h * 0.94], [r * 0.9, h],
      ], sides || 8);
    });
  }

  /**
   * lantern(seed, opts) -> Group  (iron cage + glass + Mat.lamp globe
   * + TOWN.halo x2).  Origin at the lantern's hanging point (top).
   */
  function lantern(seed, opts) {
    opts = opts || {};
    const s = opts.scale || 1;
    const slim = !!opts.slim;
    const g = TOWN.group('lantern');
    // one merged iron geometry: crown cap + finial + base plate (+ glazing bars)
    const iron = gc('lanternIron' + (slim ? 'S' : ''), function () {
      const parts = [
        lathe([[0.001, 0.2], [0.06, 0.15], [0.15, 0.05], [0.105, 0.028]], 6),
        Geo.at(lathe([[0.001, 0.1], [0.032, 0.045], [0.013, 0]], 5), 0, 0.19, 0),
        Geo.at(Geo.prism(Geo.polyPlan(6, 0.118, 0.26), 0.04, { y0: 0 }), 0, -0.3, 0),
      ];
      if (!slim) {
        for (let i = 0; i < 2; i++) {
          const a = i * Math.PI / 2 + 0.26;
          parts.push(Geo.at(board(0.018, 0.245, 0.018), Math.cos(a) * 0.09, -0.145, Math.sin(a) * 0.09));
        }
      }
      return Geo.mergeGeometries(parts);
    });
    const housing = gc('lanternGlass', () => Geo.prism(Geo.polyPlan(6, 0.1, 0.26), 0.245, { y0: -0.27 }));
    const globe = gc('lanternGlobe', () => lathe([[0.001, -0.075], [0.055, -0.03], [0.072, 0.005], [0.001, 0.06]], 5));
    add(g, iron, M.iron, 0, 0, 0);
    add(g, housing, M.glass, 0, 0, 0);
    const gl = add(g, globe, M.lamp, 0, -0.14, 0);
    const halo = TOWN.halo(P.lampWarm, 2.4 * s, { max: 0.8 });
    halo.position.copy(gl.position);
    g.add(halo);
    const pool = TOWN.halo(P.lampWarm, 5 * s, { max: 0.25 });   // wide light pool
    pool.position.copy(gl.position);
    g.add(pool);
    g.scale.setScalar(s);
    return g;
  }

  /** a small hanging bulb with halo (festoons, kiosks, market stalls) */
  function bulbGeo() {
    return gc('bulb', () => lathe([[0.001, 0.025], [0.036, -0.012], [0.001, -0.068]], 5));
  }

  /* ============================================================
     5 · LIGHTING
     ============================================================ */

  /**
   * streetLamp({seed, style:'classic'|'twin'|'wall'|'modern'|'festoon', h})
   * 'wall': origin ON THE WALL FACE (z = wall plane, y = ground); the
   * bracket sits at opts.mountH (default 2.95) and the arm projects +Z.
   */
  Props.streetLamp = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 1);
    const style = opts.style || r.pickW([['classic', 5], ['twin', 2], ['modern', 2], ['festoon', 1]]);
    const h = opts.h !== undefined ? opts.h : r.range(3.2, 4.5);
    const g = TOWN.group('streetLamp');
    let fw = 0.7, fd = 0.7, fh = h + 0.45;

    if (style === 'wall') {
      const mountH = opts.mountH === undefined ? 2.95 : opts.mountH;
      // back plate on the wall face + scrolled arm projecting +Z
      add(g, plateX([[0.0, -0.24], [0.07, -0.3], [0.07, 0.3], [0.0, 0.24]], 0.34), M.iron, 0, mountH, 0.02);
      const armPts = [];
      for (let i = 0; i <= 4; i++) {
        const t = i / 4;
        armPts.push([0, mountH + 0.12 + Math.sin(t * 1.5) * 0.16 - t * t * 0.1, 0.06 + t * 0.52]);
      }
      const arm = Geo.tube(armPts, 0.032, 4);
      g.add(mesh(arm, M.iron));
      add(g, plateX([[0.06, -0.02], [0.3, -0.02], [0.3, 0.02], [0.06, 0.02]], 0.03), M.iron, 0, mountH + 0.02, 0.32);
      const L = lantern(opts.seed || 1, { scale: 0.95 });
      L.position.set(0, mountH + 0.16, 0.62);
      g.add(L);
      fw = 0.4; fd = 0.86; fh = mountH + 0.35;
    } else if (style === 'modern') {
      add(g, gc('modBase', () => lathe([[0.2, 0], [0.21, 0.05], [0.14, 0.1], [0.11, 0.16]], 8)), M.metal, 0, 0, 0);
      add(g, taper(0.075, 0.045, h, 8), M.metal, 0, 0.14, 0);
      const head = add(g, gc('modHead', () => lathe([[0.05, 0], [0.16, 0.03], [0.17, 0.1], [0.05, 0.13]], 8)), M.metal, 0, h + 0.1, 0.16);
      head.rotation.x = 6 * DEG;
      const disc = add(g, gc('modDisc', () => lathe([[0.001, 0], [0.145, 0.012]], 8)), M.lamp, 0, h + 0.1, 0.16);
      const ha = TOWN.halo(P.lampWarm, 2.2, { max: 0.75 });
      ha.position.set(0, h + 0.06, 0.16); g.add(ha);
      const pool = TOWN.halo(P.lampWarm, 5, { max: 0.25 });
      pool.position.set(0, h - 0.4, 0.16); g.add(pool);
      void disc;
      fw = 0.45; fd = 0.62; fh = h + 0.25;
    } else if (style === 'festoon') {
      const hh = Math.min(h, 3.6);
      add(g, plinthGeo(0.5, 0.2, 6), M.stoneDark, 0, 0, 0);
      add(g, columnGeo(hh, 0.062, 6), M.iron, 0, 0.19, 0);
      add(g, gc('festHook', () => plateX([[0.0, 0.0], [0.44, -0.12], [0.46, -0.04], [0.12, 0.14], [0.0, 0.16]], 0.05)), M.iron, 0, hh + 0.12, 0);
      // a short festoon of bulbs sagging from the hook
      const a = [0, hh + 0.22, 0.44], b = [0, hh - 0.35, 1.5];
      const cat = Geo.catenary(a, b, 0.22, 0.018, 4);
      g.add(mesh(cat.geo, M.iron));
      const tr = [];
      for (let i = 1; i < 5; i++) {
        const t = i / 5;
        tr.push({
          p: [0, U.lerp(a[1], b[1], t) - Math.sin(t * Math.PI) * 0.22 - 0.05, U.lerp(a[2], b[2], t)],
          s: 0.9 + r.range(-0.1, 0.15),
        });
      }
      g.add(Geo.instanced(bulbGeo(), M.lamp, tr));
      for (let i = 0; i < 2; i++) {
        const ha = TOWN.halo(P.lampWarm, 1.5, { max: 0.55 });
        ha.position.set(0, tr[i * 2].p[1], tr[i * 2].p[2]); g.add(ha);
      }
      const pool = TOWN.halo(P.lampWarm, 5, { max: 0.25 });
      pool.position.set(0, hh - 0.6, 0.8); g.add(pool);
      fw = 0.5; fd = 1.7; fh = hh + 0.4;
    } else {
      // classic / twin — fluted column, scrolled arms, lantern(s)
      add(g, plinthGeo(0.56, 0.24, 6), M.stoneDark, 0, 0, 0);
      add(g, columnGeo(h, 0.07, 6), M.iron, 0, 0.22, 0);
      const top = h + 0.22;
      if (style === 'twin') {
        const armLen = 0.52;
        g.children[0].geometry = gc('twinBase', () => Geo.prism(Geo.polyPlan(6, 0.28), 0.24, { y0: 0 }));
        add(g, plateX([[-armLen, -0.02], [armLen, -0.02], [armLen, 0.035], [-armLen, 0.035]], 0.05), M.iron, 0, top + 0.06, 0).rotation.y = Math.PI / 2;
        for (let i = -1; i <= 1; i += 2) {
          const sc = add(g, gc('twinScroll', () => plateX([[0.06, 0.0], [0.5, 0.08], [0.5, 0.14], [0.06, 0.2]], 0.035)), M.iron, 0, top - 0.16, 0);
          sc.rotation.y = i > 0 ? Math.PI / 2 : -Math.PI / 2;
          const L = lantern((opts.seed || 1) + i, { scale: 0.88, slim: true });
          L.position.set(i * armLen, top + 0.38, 0);
          g.add(L);
        }
        fw = 1.35; fd = 0.6; fh = top + 0.58;
      } else {
        for (let i = -1; i <= 1; i += 2) {          // decorative scroll brackets
          const br = add(g, plateX([[0.02, 0], [0.16, 0], [0.2, 0.05], [0.06, 0.2], [0.02, 0.2]], 0.035), M.iron, i * 0.05, top - 0.34, 0);
          br.rotation.y = i > 0 ? 0 : Math.PI;
        }
        const L = lantern(opts.seed || 1, { scale: 1.05 });
        L.position.set(0, top + 0.5, 0);
        g.add(L);
        fw = 0.62; fd = 0.62; fh = top + 0.72;
      }
    }
    return finish(g, 'streetLamp', fw, fd, fh);
  };

  /**
   * lanternString({a,b,seed,count,sag}) — festoon lights on a catenary.
   * a / b are measured FROM THE GROUP ORIGIN: add the group at
   * (0,0,0) and pass absolute world points, or keep them local and
   * position the group yourself.
   */
  Props.lanternString = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 12);
    const a = opts.a || [-4, 3.5, 0], b = opts.b || [4, 3.6, 0];
    const len = Math.hypot(b[0] - a[0], b[2] - a[2], b[1] - a[1]);
    const count = opts.count || U.clamp(Math.round(len / 0.95), 3, 14);
    const sag = opts.sag === undefined ? Math.max(0.3, len * 0.1) : opts.sag;
    const g = TOWN.group('lanternString');
    const cat = Geo.catenary(a, b, sag, 0.02, 6);
    g.add(mesh(cat.geo, M.iron));
    const tr = [];
    for (let i = 0; i < count; i++) {
      const t = (i + 0.5) / count;
      tr.push({
        p: [U.lerp(a[0], b[0], t),
            U.lerp(a[1], b[1], t) - Math.sin(t * Math.PI) * sag - 0.055,
            U.lerp(a[2], b[2], t)],
        s: r.range(0.85, 1.15),
      });
    }
    g.add(Geo.instanced(bulbGeo(), M.lamp, tr));
    const hn = Math.min(4, count);
    for (let i = 0; i < hn; i++) {
      const t = tr[Math.floor((i + 0.5) / hn * count)];
      const ha = TOWN.halo(P.lampWarm, 1.9, { max: 0.6, flick: 0.05 });
      ha.position.set(t.p[0], t.p[1], t.p[2]);
      g.add(ha);
    }
    g.userData.absolutePoints = true;
    g.userData.a = a; g.userData.b = b;
    return finish(g, 'lanternString',
      Math.abs(b[0] - a[0]) + 0.4, Math.abs(b[2] - a[2]) + 0.4, Math.max(a[1], b[1]));
  };

  /** torch({seed, h}) — pitch torch on a stake, flickering flame */
  Props.torch = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 3);
    const h = opts.h === undefined ? r.range(1.5, 1.9) : opts.h;
    const g = TOWN.group('torch');
    add(g, taper(0.05, 0.032, h, 5), M.woodDark, 0, 0, 0);
    add(g, gc('torchBowl', () => lathe([[0.04, 0], [0.115, 0.1], [0.125, 0.17], [0.075, 0.19], [0.05, 0.13]], 6)), M.iron, 0, h - 0.16, 0);
    const flame = TOWN.group('flame');
    flame.position.set(0, h + 0.04, 0);
    flame.add(mesh(gc('flameA', () => lathe([[0.001, 0], [0.075, 0.06], [0.058, 0.18], [0.001, 0.33]], 5)), M.fire));
    g.add(addFlame(flame, opts.seed || 3));
    const ha = TOWN.halo(P.fire, Math.min(2.4, (h + 0.1) * 1.4), { max: 0.85, flick: 0.35 });
    ha.position.set(0, h + 0.14, 0); g.add(ha);
    return finish(g, 'torch', 0.3, 0.3, h + 0.4);
  };

  /** braziers({seed, count}) — iron fire basket(s) with coals + flame */
  Props.braziers = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 4);
    const count = opts.count || 1;
    const g = TOWN.group('braziers');
    const bowl = gc('brazBowl', () => lathe([[0.06, 0], [0.3, 0.26], [0.33, 0.34], [0.3, 0.31], [0.05, 0.07]], 8));
    const legs = gc('brazLeg', () => plateX([[-0.04, 0], [0.04, 0], [0.03, 0.42], [-0.03, 0.42]], 0.05));
    for (let c = 0; c < count; c++) {
      const sub = TOWN.group('brazier');
      sub.position.set(c === 0 ? 0 : r.range(-0.9, 0.9) + c * 0.85, 0, c === 0 ? 0 : r.range(-0.4, 0.4));
      sub.rotation.y = r.range(0, Math.PI);
      for (let i = 0; i < 3; i++) {
        const l = add(sub, legs, M.iron, 0, 0, 0);
        l.rotation.y = (i / 3) * Math.PI * 2 + 0.3;
        l.position.set(Math.sin(l.rotation.y) * 0.17, 0, Math.cos(l.rotation.y) * 0.17);
        l.rotation.z = 0;
      }
      add(sub, bowl, M.iron, 0, 0.42, 0);
      const coals = [];
      for (let i = 0; i < 6; i++) {
        const a = r.range(0, 6.28), rr = r.range(0, 0.16);
        coals.push({ p: [Math.cos(a) * rr, 0.6 + r.range(0, 0.04), Math.sin(a) * rr], s: r.range(0.7, 1.2), c: r.pick([0x50302a, 0x6b3a26, P.fire]) });
      }
      sub.add(Geo.instanced(dome4(0.075, 0.06, 0.075), M.tint, coals));
      const flame = TOWN.group('flame');
      flame.position.set(0, 0.62, 0);
      flame.add(mesh(gc('flameB', () => lathe([[0.001, 0], [0.13, 0.07], [0.09, 0.24], [0.001, 0.44]], 5)), M.fire));
      sub.add(addFlame(flame, (opts.seed || 4) + c));
      const ha = TOWN.halo(P.fire, 1.85, { max: 0.9, flick: 0.32 });
      ha.position.set(0, 0.95, 0); sub.add(ha);
      const ha2 = TOWN.halo(P.fire, 1.1, { max: 0.5, flick: 0.4 });
      ha2.position.set(0, 0.7, 0); sub.add(ha2);
      g.add(sub);
    }
    const w = count > 1 ? 0.9 + count * 0.85 : 0.75;
    jitter(g, r, 0.9, 1.12);
    return finish(g, 'braziers', w, 0.9, 1.1);
  };
  /* ============================================================
     6 · SITTING, STANDING, WAITING
     ============================================================ */

  /** merge a list of convex plateX profiles into one cast-iron end frame */
  function frameEnd(key, list, th) {
    return gc(key, function () {
      return Geo.mergeGeometries(list.map((p) => plateX(p, th)));
    });
  }

  /** bench({seed, style:'park'|'stone'|'log', len}) */
  Props.bench = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 21);
    const style = opts.style || r.pickW([['park', 5], ['stone', 2], ['log', 2]]);
    const len = opts.len === undefined ? r.range(1.6, 2.1) : opts.len;
    const g = TOWN.group('bench');
    jitter(g, r, 0.95, 1.06);
    const hx = len / 2 - 0.12;

    if (style === 'stone') {
      for (let i = -1; i <= 1; i += 2) {
        add(g, gc('benchStoneLeg', () => loft([
          { pts: Geo.polyPlan(6, 0.19, 0.3), y: 0 },
          { pts: Geo.polyPlan(6, 0.15, 0.3), y: 0.3 },
          { pts: Geo.polyPlan(6, 0.17, 0.3), y: 0.4 },
        ])), M.stone, i * hx, 0, 0);
      }
      add(g, Geo.chamferBox(len, 0.13, 0.44, 0.035), M.stone, 0, 0.465, 0);
      add(g, gc('benchStoneLip', () => Geo.chamferBox(len * 1.02, 0.04, 0.5, 0.02)), M.stoneDark, 0, 0.4, 0);
      return finish(g, 'bench', len, 0.5, 0.53);
    }
    if (style === 'log') {
      const seat = add(g, gc('benchLog', () => lathe([[0.001, -0.5], [0.19, -0.46], [0.21, 0], [0.19, 0.46], [0.001, 0.5]], 6)), M.wood, 0, 0.42, 0);
      seat.rotation.z = Math.PI / 2;
      seat.scale.set(1, len / 1.0, 1);
      for (let i = -1; i <= 1; i += 2) {
        const st = add(g, gc('benchStump', () => lathe([[0.16, 0], [0.14, 0.3], [0.15, 0.42]], 6)), M.woodDark, i * hx, 0, 0);
        st.rotation.y = r.range(0, 1);
      }
      return finish(g, 'bench', len, 0.44, 0.62);
    }
    // park: cast-iron shaped ends + slatted seat & back
    const end = frameEnd('benchEnd', [
      [[-0.25, 0], [-0.16, 0], [-0.13, 0.42], [-0.22, 0.42]],            // front leg
      [[0.15, 0], [0.24, 0], [0.31, 0.9], [0.23, 0.9]],                  // rear stay
      [[-0.25, 0.4], [0.23, 0.42], [0.23, 0.5], [-0.25, 0.48]],          // seat rail
      [[-0.24, 0.66], [0.2, 0.7], [0.2, 0.77], [-0.26, 0.73]],           // armrest
    ], 0.055);
    for (let i = -1; i <= 1; i += 2) add(g, end, M.iron, i * hx, 0, 0);
    for (let i = 0; i < 4; i++) {
      add(g, board(len, 0.035, 0.1), M.wood, 0, 0.5 + i * 0.004, -0.19 + i * 0.125);
    }
    for (let i = 0; i < 3; i++) {
      const s = add(g, board(len, 0.09, 0.032), M.wood, 0, 0.6 + i * 0.14, 0.25 + i * 0.036);
      s.rotation.x = -9 * DEG;
    }
    add(g, gc('benchScroll', () => dome4(0.05, 0.04, 0.05)), M.brass, -hx, 0.775, -0.24);
    add(g, gc('benchScroll', () => dome4(0.05, 0.04, 0.05)), M.brass, hx, 0.775, -0.24);
    return finish(g, 'bench', len, 0.62, 0.92);
  };

  /** picnicTable({seed, len}) */
  Props.picnicTable = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 22);
    const len = opts.len === undefined ? r.range(1.8, 2.3) : opts.len;
    const g = TOWN.group('picnicTable');
    const frame = frameEnd('picnicFrame', [
      [[-0.62, 0], [-0.5, 0], [-0.06, 0.72], [-0.18, 0.72]],
      [[0.5, 0], [0.62, 0], [0.18, 0.72], [0.06, 0.72]],
      [[-0.46, 0.4], [0.46, 0.4], [0.46, 0.47], [-0.46, 0.47]],
    ], 0.07);
    for (let i = -1; i <= 1; i += 2) add(g, frame, M.timber, i * (len / 2 - 0.25), 0, 0);
    for (let i = 0; i < 4; i++) add(g, board(len, 0.045, 0.19), M.wood, 0, 0.74 + (i % 2) * 0.003, -0.3 + i * 0.2);
    for (let i = -1; i <= 1; i += 2) {
      add(g, board(len, 0.045, 0.28), M.wood, 0, 0.48, i * 0.53);
      add(g, board(len, 0.04, 0.05), M.timber, 0, 0.44, i * 0.53);
    }
    jitter(g, r, 0.95, 1.06);
    return finish(g, 'picnicTable', len, 1.34, 0.78);
  };

  /** chairSet({seed}) — bistro table + 2 chairs on thin turned legs */
  Props.chairSet = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 23);
    const g = TOWN.group('chairSet');
    const tableTop = gc('bistroTop', () => lathe([[0.34, 0], [0.36, 0.02], [0.34, 0.045], [0.001, 0.045]], 8));
    const stem = gc('bistroStem', () => lathe([[0.28, 0], [0.24, 0.02], [0.05, 0.09], [0.035, 0.5], [0.06, 0.66]], 6));
    add(g, stem, M.iron, 0, 0, 0);
    add(g, tableTop, M.wood, 0, 0.66, 0);
    const chairLeg = gc('chairLeg', () => lathe([[0.022, 0], [0.017, 0.16], [0.014, 0.44]], 4));
    const chairSeat = gc('chairSeat', () => Geo.prism(Geo.polyPlan(6, 0.2, 0.3), 0.035, { y0: 0 }));
    for (let c = 0; c < 2; c++) {
      const ch = TOWN.group('chair');
      const ang = c === 0 ? r.range(-0.4, 0.4) : Math.PI + r.range(-0.4, 0.4);
      ch.position.set(Math.sin(ang) * 0.68, 0, Math.cos(ang) * 0.68);
      ch.rotation.y = ang + Math.PI + r.range(-0.15, 0.15);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        add(ch, chairLeg, M.iron, Math.cos(a) * 0.14, 0, Math.sin(a) * 0.14);
      }
      add(ch, chairSeat, M.wood, 0, 0.44, 0);
      for (let i = -1; i <= 1; i += 2) {
        const up = add(ch, gc('chairBack', () => lathe([[0.018, 0], [0.02, 0.34], [0.012, 0.46]], 4)), M.iron, i * 0.15, 0.47, -0.14);
        up.rotation.x = -10 * DEG;
      }
      for (let i = 0; i < 2; i++) {
        const sl = add(ch, board(0.32, 0.055, 0.022), M.wood, 0, 0.66 + i * 0.16, -0.17 - i * 0.03);
        sl.rotation.x = -10 * DEG;
      }
      g.add(ch);
    }
    jitter(g, r, 0.95, 1.06);
    return finish(g, 'chairSet', 1.55, 1.55, 0.93);
  };

  /** parasol({seed, color, h, r}) — scalloped 8-segment canopy, slight tilt */
  Props.parasol = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 24);
    const col = opts.color || r.pick([P.awningRed, P.awningGreen, P.awningBlue, P.awningYellow, P.awningCream]);
    const rad = opts.r === undefined ? r.range(1.1, 1.45) : opts.r;
    const h = opts.h === undefined ? r.range(2.1, 2.4) : opts.h;
    const g = TOWN.group('parasol');
    const tilt = TOWN.group('tilt');
    tilt.rotation.set(r.range(2, 5) * DEG, r.range(0, 6.28), r.range(-4, 4) * DEG);
    add(tilt, rod(0.032, h, 5), M.wood, 0, 0, 0);
    const key = 'parasolTop|' + rad.toFixed(2) + '|' + col;
    const canopy = gc(key, function () {
      const drop = rad * 0.36;
      return grid(16, 2, function (u, v) {
        const a = u * Math.PI * 2;
        const sc = 0.5 - 0.5 * Math.cos(u * Math.PI * 16);
        const rr = rad * (0.09 + 0.91 * v) * (1 + 0.035 * sc);
        const y = -drop * Math.pow(v, 1.8) - sc * 0.07 * v * v;
        return [Math.cos(a) * rr, y, Math.sin(a) * rr];
      }, function (c, x, y, z) {
        const a = Math.atan2(z, x);
        const seg = Math.floor(U.mod(a, Math.PI * 2) / (Math.PI * 2) * 8);
        c.set(seg % 2 ? col : P.fabricWhite);
      });
    });
    add(tilt, canopy, M.vc, 0, h, 0);
    add(tilt, gc('parasolHub', () => lathe([[0.001, 0.14], [0.035, 0.06], [0.05, 0.0], [0.03, -0.02]], 5)), M.wood, 0, h, 0);
    g.add(tilt);
    add(g, gc('parasolFoot', () => lathe([[0.3, 0], [0.28, 0.06], [0.1, 0.1], [0.06, 0.12]], 8)), M.stoneDark, 0, 0, 0);
    return finish(g, 'parasol', undefined, undefined, h + 0.15);
  };

  /** cafeTerrace({seed, w, d, count}) — chairSets + parasols + enclosure */
  Props.cafeTerrace = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 25);
    const w = opts.w === undefined ? 6 : opts.w;
    const d = opts.d === undefined ? 4 : opts.d;
    const count = opts.count === undefined ? 2 : opts.count;
    const g = TOWN.group('cafeTerrace');
    // deck edge: low planter + rail enclosure on three sides
    const planter = gc('terracePlanter', () => loft([
      { pts: ellipsePlan(0.28, 0.28, 6), y: 0 },
      { pts: ellipsePlan(0.34, 0.34, 6), y: 0.46 },
    ], { capTop: false }));
    const rail = gc('terraceRail', () => Geo.mergeGeometries([
      Geo.at(rod(0.028, 0.5, 4), -0.75, 0, 0), Geo.at(rod(0.028, 0.5, 4), 0, 0, 0), Geo.at(rod(0.028, 0.5, 4), 0.75, 0, 0),
      Geo.at(board(1.5, 0.05, 0.06), 0, 0.48, 0), Geo.at(board(1.5, 0.035, 0.05), 0, 0.26, 0),
    ]));
    const flowers = [];
    const posts = [[-w / 2, d / 2], [w / 2, d / 2], [-w / 2, -d / 2], [w / 2, -d / 2]];
    for (let i = 0; i < posts.length; i++) {
      add(g, planter, M.stone, posts[i][0], 0, posts[i][1]);
      for (let k = 0; k < 4; k++) {
        flowers.push({
          p: [posts[i][0] + r.range(-0.2, 0.2), 0.5, posts[i][1] + r.range(-0.2, 0.2)],
          s: r.range(0.7, 1.2), c: r.pick([P.flowerRed, P.flowerPink, P.flowerWhite, P.flowerYellow]),
        });
      }
    }
    g.add(Geo.instanced(dome4(0.08, 0.09, 0.08), M.tint, flowers));
    for (let i = -1; i <= 1; i += 2) add(g, rail, M.iron, i * (w / 2 - 0.75), 0.05, d / 2);
    for (let c = 0; c < count; c++) {
      const cs = Props.chairSet({ seed: (opts.seed || 25) + c * 7 });
      cs.position.set(U.lerp(-w / 2 + 1.1, w / 2 - 1.1, count === 1 ? 0.5 : c / (count - 1)), 0, r.range(-0.3, 0.3));
      cs.rotation.y = r.range(-0.3, 0.3);
      g.add(cs);
      if (c % 2 === 0) {
        const ps = Props.parasol({ seed: (opts.seed || 25) + c * 13, r: 1.2 });
        ps.position.set(cs.position.x + r.range(-0.15, 0.15), 0, cs.position.z + r.range(-0.2, 0.2));
        g.add(ps);
      }
    }
    return finish(g, 'cafeTerrace', w + 0.7, d + 0.7, 2.5);
  };

  /** busStop({seed, w}) — glass + iron shelter, curved roof, timetable */
  Props.busStop = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 26);
    const w = opts.w === undefined ? r.range(2.3, 2.9) : opts.w;
    const d = 1.35, h = 2.4;
    const g = TOWN.group('busStop');
    const post = gc('shelterPost', () => lathe([[0.07, 0], [0.055, 0.05], [0.045, 0.2], [0.04, h - 0.2], [0.055, h]], 4));
    for (let sx = -1; sx <= 1; sx += 2) {
      for (let sz = -1; sz <= 1; sz += 2) add(g, post, M.iron, sx * (w / 2 - 0.09), 0, sz * (d / 2 - 0.09));
    }
    // curved roof with an eaves fascia
    const roof = add(g, gc('shelterRoof|' + w.toFixed(2), () => Geo.barrelRoof(w + 0.24, d + 0.3, 0.3, 6, { over: 0.06, thick: 0.06 })), M.metal, 0, h, 0);
    roof.rotation.y = 0;
    add(g, board(w + 0.3, 0.07, 0.05), M.iron, 0, h - 0.02, d / 2 + 0.16);
    // back + side glazing
    add(g, board(w - 0.2, h - 0.5, 0.03), M.glass, 0, (h - 0.5) / 2 + 0.28, -d / 2 + 0.07);
    add(g, board(0.03, h - 0.6, d - 0.3), M.glass, -w / 2 + 0.08, (h - 0.6) / 2 + 0.3, 0);
    add(g, board(w - 0.2, 0.05, 0.05), M.iron, 0, 0.3, -d / 2 + 0.07);
    add(g, board(w - 0.2, 0.05, 0.05), M.iron, 0, h - 0.24, -d / 2 + 0.07);
    // bench
    for (let i = 0; i < 3; i++) add(g, board(w - 0.5, 0.04, 0.11), M.wood, 0, 0.46, -d / 2 + 0.26 + i * 0.13);
    for (let i = -1; i <= 1; i += 2) {
      add(g, gc('stopBenchBr', () => plateX([[-0.18, 0], [0.18, 0], [0.18, 0.06], [-0.18, 0.06]], 0.06)), M.iron, i * (w / 2 - 0.34), 0.42, -d / 2 + 0.4);
      add(g, rod(0.025, 0.42, 4), M.iron, i * (w / 2 - 0.34), 0, -d / 2 + 0.4);
    }
    // timetable board
    add(g, Geo.chamferBox(0.5, 0.66, 0.05, 0.02), M.iron, w / 2 - 0.42, 1.45, -d / 2 + 0.11);
    add(g, gc('plane5', () => new T.PlaneGeometry(0.42, 0.56)), matPaper(), w / 2 - 0.42, 1.45, -d / 2 + 0.14);
    add(g, board(0.1, 0.5, 0.1), M.iron, -w / 2 - 0.02, h + 0.3, 0);
    add(g, gc('stopFlag', () => lathe([[0.001, 0], [0.19, 0.02], [0.19, 0.3], [0.001, 0.32]], 8)), M.white, -w / 2 - 0.02, h + 0.5, 0);
    jitter(g, r, 0.96, 1.05);
    return finish(g, 'busStop', w + 0.35, d + 0.35, h + 0.85);
  };

  /** tramShelter({seed, w}) — larger cast-iron & glass shelter */
  Props.tramShelter = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 27);
    const w = opts.w === undefined ? r.range(3.4, 4.2) : opts.w;
    const d = 1.8, h = 2.7;
    const g = TOWN.group('tramShelter');
    const col = gc('tramCol', () => lathe([
      [0.13, 0], [0.085, 0.14], [0.075, h - 0.2], [0.1, h],
    ], 5));
    const brk = gc('tramBrk', () => plateX([[0.0, 0.0], [0.34, 0.0], [0.34, 0.06], [0.0, 0.3]], 0.04));
    for (let sx = -1; sx <= 1; sx += 2) {
      for (let sz = -1; sz <= 1; sz += 2) {
        add(g, col, M.iron, sx * (w / 2 - 0.14), 0, sz * (d / 2 - 0.14));
        const b = add(g, brk, M.iron, sx * (w / 2 - 0.14), h - 0.34, sz * (d / 2 - 0.14));
        b.rotation.y = sz > 0 ? 0 : Math.PI;
        b.scale.z = 1;
      }
    }
    add(g, gc('tramRoof|' + w.toFixed(2), () => Geo.barrelRoof(w + 0.4, d + 0.5, 0.42, 6, { over: 0.1, thick: 0.07 })), M.metal, 0, h, 0);
    // scalloped valance along the front eaves
    add(g, gc('tramValance|' + w.toFixed(2), () => valance(w + 0.5, 0.2, Math.round(w * 2), (c) => c.set(P.roofGreen))), M.vc, 0, h + 0.02, d / 2 + 0.24);
    add(g, board(w - 0.3, h - 0.9, 0.04), M.glass, 0, (h - 0.9) / 2 + 0.4, -d / 2 + 0.1);
    add(g, board(0.04, h - 1.0, d - 0.4), M.glass, -w / 2 + 0.12, (h - 1) / 2 + 0.45, 0);
    for (let i = 0; i < 3; i++) add(g, board(w * 0.6, 0.045, 0.12), M.wood, 0, 0.5, -d / 2 + 0.3 + i * 0.14);
    for (let i = -1; i <= 1; i += 2) {
      add(g, gc('tramBenchEnd', () => plateX([[-0.22, 0], [0.22, 0], [0.2, 0.5], [-0.2, 0.5]], 0.05)), M.iron, i * (w * 0.3 - 0.1), 0, -d / 2 + 0.44);
    }
    // name board
    add(g, board(w * 0.55, 0.32, 0.06), M.iron, 0, h + 0.42, -d / 2 + 0.14);
    add(g, atlasPlane(w * 0.5, 0.24, 0), matAtlas(), 0, h + 0.42, -d / 2 + 0.19);
    const ha = TOWN.halo(P.lampWarm, 2.2, { max: 0.4 });
    ha.position.set(0, h - 0.2, 0); g.add(ha);
    add(g, rod(0.018, 0.2, 4), M.iron, 0, h - 0.14, 0);
    add(g, gc('tramLamp', () => lathe([[0.001, 0.1], [0.09, 0.03], [0.07, 0], [0.001, -0.02]], 6)), M.lamp, 0, h - 0.18, 0);
    jitter(g, r, 0.96, 1.05);
    return finish(g, 'tramShelter', w + 0.5, d + 0.6, h + 0.7);
  };

  /** phoneBooth({seed, color}) */
  Props.phoneBooth = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 28);
    const col = opts.color || r.pick([P.fabricRed, P.roofGreen, P.roofBlue]);
    const g = TOWN.group('phoneBooth');
    const h = 2.5, s = 0.48;
    add(g, gc('boothBase', () => Geo.prism(Geo.roundRectPlan(1.02, 1.02, 0.1, 2), 0.12, { y0: 0 })), M.stoneDark, 0, 0, 0);
    const body = gc('boothBody|' + col, () => tinted(loft([
      { pts: Geo.roundRectPlan(s * 2, s * 2, 0.09, 2), y: 0 },
      { pts: Geo.roundRectPlan(s * 1.94, s * 1.94, 0.09, 2), y: h - 0.3 },
    ], { capTop: false, capBottom: false }), col));
    add(g, body, M.vc, 0, 0.12, 0);
    // glazing on three sides, muntin bars
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const pane = add(g, board(0.66, h - 0.85, 0.03), M.glass, Math.sin(a) * (s - 0.02), 1.22, Math.cos(a) * (s - 0.02));
      pane.rotation.y = a;
      for (let k = 0; k < 2; k++) {
        const bar = add(g, board(0.7, 0.04, 0.045), i === 2 ? M.vc : M.vc, Math.sin(a) * (s - 0.01), 0.95 + k * 0.55, Math.cos(a) * (s - 0.01));
        bar.rotation.y = a;
        bar.geometry = gc('boothBar|' + col, () => tinted(board(0.7, 0.04, 0.045), col));
      }
    }
    // cornice + ogee roof + finial
    add(g, gc('boothCornice|' + col, () => tinted(Geo.ring(0.4, s + 0.09, 0.13, 4), col)), M.vc, 0, h - 0.2, 0);
    add(g, gc('boothRoof|' + col, () => tinted(lathe([[s + 0.06, 0], [s - 0.05, 0.1], [s * 0.55, 0.16], [0.12, 0.22], [0.001, 0.24]], 8), col)), M.vc, 0, h - 0.08, 0);
    add(g, gc('boothFinial', () => lathe([[0.001, 0.16], [0.045, 0.09], [0.03, 0.05], [0.055, 0.02], [0.02, 0]], 5)), M.brass, 0, h + 0.14, 0);
    add(g, atlasPlane(0.4, 0.12, 1), matAtlas(), 0, h - 0.19, s + 0.1);
    const ha = TOWN.halo(P.lampWarm, 1.9, { max: 0.5 });
    ha.position.set(0, h - 0.35, 0); g.add(ha);
    add(g, gc('boothLamp', () => lathe([[0.001, 0.06], [0.1, 0.02], [0.001, 0]], 6)), M.lamp, 0, h - 0.32, 0);
    jitter(g, r, 0.95, 1.07);
    return finish(g, 'phoneBooth', 1.05, 1.05, h + 0.3);
  };

  /** kiosk({seed}) — newspaper kiosk: awning, racks, glow inside */
  Props.kiosk = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 29);
    const g = TOWN.group('kiosk');
    const R = 1.05, h = 2.25;
    add(g, gc('kioskPlinth', () => Geo.prism(Geo.polyPlan(8, R + 0.09, Math.PI / 8), 0.14, { y0: 0 })), M.stoneDark, 0, 0, 0);
    add(g, gc('kioskBody', () => loft([
      { pts: Geo.polyPlan(8, R, Math.PI / 8), y: 0 },
      { pts: Geo.polyPlan(8, R * 0.97, Math.PI / 8), y: 1.02 },
    ], { capTop: false, capBottom: false })), M.woodDark, 0, 0.14, 0);
    add(g, gc('kioskUpper', () => loft([
      { pts: Geo.polyPlan(8, R * 0.97, Math.PI / 8), y: 0 },
      { pts: Geo.polyPlan(8, R * 0.94, Math.PI / 8), y: h - 1.2 },
    ], { capTop: false, capBottom: false })), M.wood, 0, 1.16, 0);
    // glazed serving front (+Z) with a glowing interior panel
    add(g, board(1.18, 0.95, 0.04), M.glass, 0, 1.66, R * 0.9);
    add(g, board(1.1, 0.8, 0.03), M.lamp, 0, 1.66, R * 0.9 - 0.06);
    add(g, gc('kioskCounter', () => Geo.chamferBox(1.5, 0.1, 0.44, 0.03)), M.wood, 0, 1.1, R * 0.92);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      add(g, rod(0.045, h - 0.14, 4), M.timber, Math.cos(a) * R * 0.99, 0.14, Math.sin(a) * R * 0.99);
    }
    // sagging awning over the counter
    add(g, gc('kioskAwn', () => grid(8, 2, function (u, v) {
      const x = -0.95 + 1.9 * u;
      const sag = Math.sin(u * Math.PI) * 0.07;
      return [x, -v * 0.3 - sag * v, v * 0.85];
    }, stripes(1.9, 6, P.awningRed, P.awningCream))), M.vc, 0, 2.16, R * 0.86);
    add(g, gc('kioskVal', () => valance(1.92, 0.17, 6, stripes(1.92, 6, P.awningRed, P.awningCream))), M.vc, 0, 1.86, R * 0.86 + 0.85);
    // roof + finial
    add(g, gc('kioskRoof', () => Geo.coneRoof(R + 0.28, 0.6, 8)), M.metal, 0, h - 0.02, 0);
    add(g, gc('kioskFin', () => lathe([[0.001, 0.3], [0.05, 0.18], [0.03, 0.12], [0.07, 0.05], [0.025, 0]], 5)), M.brass, 0, h + 0.56, 0);
    // magazine racks + newspaper stacks
    const mags = [];
    for (let i = 0; i < 10; i++) {
      mags.push({
        p: [-0.5 + (i % 5) * 0.25, 0.62 + Math.floor(i / 5) * 0.34, R + 0.2],
        r: [-0.5, r.range(-0.1, 0.1), 0], s: [1, 1, 1],
        c: r.pick([P.wallCream, P.awningBlue, P.flowerYellow, P.wallRose]),
      });
    }
    g.add(Geo.instanced(boardUp(0.2, 0.26, 0.02), M.tint, mags));
    for (let i = -1; i <= 1; i += 2) {
      add(g, gc('rackShelf', () => board(1.3, 0.03, 0.24)), M.timber, 0, 0.56 + (i + 1) * 0.17, R + 0.14);
      add(g, gc('rackStile', () => board(0.055, 0.95, 0.055)), M.timber, i * 0.62, 0.62, R + 0.12);
    }
    add(g, gc('newsStack', () => board(0.34, 0.14, 0.26)), M.white, 0.75, 1.17, R * 0.9);
    const ha = TOWN.halo(P.lampWarm, 3.4, { max: 0.6 });
    ha.position.set(0, 1.7, R * 0.6); g.add(ha);
    const ha2 = TOWN.halo(P.lampWarm, 4.6, { max: 0.25 });
    ha2.position.set(0, 2.35, R * 0.6); g.add(ha2);
    add(g, atlasPlane(0.95, 0.28, 2), matAtlas(), 0, 2.06, R * 0.95);
    jitter(g, r, 0.95, 1.06);
    return finish(g, 'kiosk', 2.6, 2.6, h + 0.9);
  };

  /** postbox({seed, color}) — cast-iron pillar box */
  Props.postbox = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 30);
    const col = opts.color || r.pick([P.fabricRed, P.roofBlue, P.roofGreen]);
    const g = TOWN.group('postbox');
    add(g, gc('pboxBody|' + col, () => tinted(lathe([
      [0.3, 0], [0.31, 0.06], [0.27, 0.12], [0.26, 0.95], [0.28, 1.0], [0.29, 1.08], [0.26, 1.12],
    ], 8), col)), M.vc, 0, 0, 0);
    add(g, gc('pboxCap|' + col, () => tinted(lathe([[0.28, 0], [0.26, 0.06], [0.17, 0.14], [0.06, 0.18], [0.001, 0.19]], 8), col)), M.vc, 0, 1.12, 0);
    add(g, board(0.3, 0.05, 0.06), M.iron, 0, 0.92, 0.25);
    add(g, gc('pboxPlate', () => Geo.chamferBox(0.34, 0.2, 0.04, 0.02)), M.iron, 0, 0.62, 0.26);
    add(g, gc('pboxKnob', () => dome4(0.05, 0.05, 0.05)), M.brass, 0, 1.31, 0);
    jitter(g, r, 0.93, 1.08);
    return finish(g, 'postbox', 0.62, 0.62, 1.33);
  };

  /** trashBin({seed, style}) */
  Props.trashBin = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 31);
    const g = TOWN.group('trashBin');
    const onPost = r.chance(0.4);
    const y0 = onPost ? 0.42 : 0;
    if (onPost) {
      add(g, rod(0.045, 0.6, 5), M.iron, 0, 0, 0);
      add(g, gc('binFoot', () => lathe([[0.12, 0], [0.1, 0.04], [0.05, 0.06]], 6)), M.iron, 0, 0, 0);
    }
    add(g, gc('binBody', () => lathe([
      [0.16, 0], [0.19, 0.05], [0.21, 0.5], [0.235, 0.56], [0.21, 0.58], [0.2, 0.55],
    ], 7)), M.iron, 0, y0, 0);
    add(g, gc('binLid', () => lathe([[0.24, 0], [0.22, 0.04], [0.14, 0.1], [0.05, 0.12], [0.001, 0.11]], 7)), M.metal, 0, y0 + 0.58, 0);
    const ribs = [];
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      ribs.push({ p: [Math.cos(a) * 0.2, y0 + 0.05, Math.sin(a) * 0.2], r: a, s: [1, 1, 1] });
    }
    g.add(Geo.instanced(boardUp(0.02, 0.46, 0.03), M.iron, ribs));
    jitter(g, r, 0.94, 1.07);
    return finish(g, 'trashBin', 0.5, 0.5, y0 + 0.72);
  };

  /** hydrant({seed}) */
  Props.hydrant = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 32);
    const col = opts.color || r.pick([P.fabricRed, P.flowerYellow, P.roofGreen]);
    const g = TOWN.group('hydrant');
    add(g, gc('hydBase', () => lathe([[0.19, 0], [0.2, 0.04], [0.13, 0.08], [0.12, 0.1]], 6)), M.iron, 0, 0, 0);
    add(g, gc('hydBody|' + col, () => tinted(lathe([
      [0.12, 0], [0.115, 0.36], [0.14, 0.4], [0.13, 0.46], [0.1, 0.5], [0.105, 0.62], [0.075, 0.66],
    ], 6), col)), M.vc, 0, 0.1, 0);
    add(g, gc('hydCap|' + col, () => tinted(lathe([[0.09, 0], [0.11, 0.03], [0.07, 0.1], [0.03, 0.13]], 6), col)), M.vc, 0, 0.76, 0);
    for (let i = -1; i <= 1; i += 2) {
      const n = add(g, gc('hydNozzle', () => lathe([[0.055, 0], [0.06, 0.05], [0.045, 0.07]], 5)), M.brass, i * 0.11, 0.42, 0);
      n.rotation.z = i * Math.PI / 2;
    }
    add(g, gc('hydNozzle', () => lathe([[0.055, 0], [0.06, 0.05], [0.045, 0.07]], 5)), M.brass, 0, 0.42, 0.13).rotation.x = Math.PI / 2;
    jitter(g, r, 0.9, 1.1);
    return finish(g, 'hydrant', 0.4, 0.4, 0.9);
  };

  /** bollard({seed, style:'stone'|'iron'|'timber'}) */
  Props.bollard = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 33);
    const style = opts.style || r.pick(['stone', 'iron', 'timber']);
    const g = TOWN.group('bollard');
    const h = r.range(0.62, 0.85);
    if (style === 'iron') {
      add(g, gc('bolIron|' + h.toFixed(2), () => lathe([
        [0.13, 0], [0.14, 0.04], [0.1, 0.09], [0.085, h * 0.75], [0.105, h * 0.82], [0.08, h * 0.88], [0.05, h],
      ], 6)), M.iron, 0, 0, 0);
      add(g, gc('bolBand', () => Geo.ring(0.085, 0.1, 0.05, 6)), M.white, 0, h * 0.55, 0);
    } else if (style === 'timber') {
      add(g, gc('bolTimber|' + h.toFixed(2), () => lathe([[0.11, 0], [0.1, h * 0.9], [0.11, h * 0.94], [0.06, h]], 5)), M.timber, 0, 0, 0);
    } else {
      add(g, gc('bolStone|' + h.toFixed(2), () => lathe([
        [0.15, 0], [0.14, h * 0.6], [0.12, h * 0.86], [0.09, h],
      ], 6)), M.stone, 0, 0, 0);
    }
    add(g, gc('bolCap', () => dome4(0.06, 0.05, 0.06)), style === 'stone' ? M.stone : M.brass, 0, h, 0);
    return finish(g, 'bollard', 0.32, 0.32, h + 0.06);
  };

  /** clockPost({seed, h}) — two-faced street clock on an ornate column */
  Props.clockPost = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 34);
    const h = opts.h === undefined ? r.range(2.9, 3.4) : opts.h;
    const g = TOWN.group('clockPost');
    add(g, plinthGeo(0.68, 0.34, 6), M.stoneDark, 0, 0, 0);
    add(g, columnGeo(h, 0.085, 6), M.iron, 0, 0.32, 0);
    const drum = add(g, gc('clockDrum', () => lathe([
      [0.001, -0.16], [0.31, -0.17], [0.34, -0.09], [0.34, 0.09], [0.31, 0.17], [0.001, 0.16],
    ], 8)), M.iron, 0, h + 0.66, 0);
    drum.rotation.x = Math.PI / 2;
    const face = gc('clockFace', () => new T.CircleGeometry(0.28, 12));
    add(g, face, matClock(), 0, h + 0.66, 0.175);
    add(g, face, matClock(), 0, h + 0.66, -0.175).rotation.y = Math.PI;
    for (let i = -1; i <= 1; i += 2) {
      const br = add(g, gc('clockBracket', () => plateX([[0.0, 0.0], [0.26, 0.0], [0.26, 0.05], [0.06, 0.26], [0.0, 0.26]], 0.04)), M.iron, 0, h + 0.2, i * 0.06);
      br.rotation.y = i > 0 ? 0 : Math.PI;
    }
    add(g, gc('clockCrown', () => lathe([[0.2, 0], [0.14, 0.1], [0.16, 0.14], [0.05, 0.28], [0.001, 0.34]], 6)), M.iron, 0, h + 0.86, 0);
    add(g, gc('clockFin', () => lathe([[0.001, 0.22], [0.045, 0.12], [0.03, 0.07], [0.06, 0.03], [0.02, 0]], 5)), M.brass, 0, h + 1.18, 0);
    const ha = TOWN.halo(P.lampWarm, 2.0, { max: 0.42 });
    ha.position.set(0, h + 0.66, 0); g.add(ha);
    return finish(g, 'clockPost', 0.7, 0.7, h + 1.4);
  };
  /* ============================================================
     7 · COMMERCE & SIGNAGE
     ============================================================ */

  const GOODS = {
    fruit:   { cols: [P.flowerRed, P.flowerOrange, P.flowerYellow, 0xcfe07a], r: 0.075, form: 'ball' },
    fish:    { cols: [0x9fb3bd, 0x8195a2, 0xc3ced4], r: 0.085, form: 'fish' },
    flowers: { cols: [P.flowerPink, P.flowerWhite, P.flowerBlue, P.flowerYellow], r: 0.06, form: 'bloom' },
    bread:   { cols: [0xd9a761, 0xc08c4e, 0xe3c188], r: 0.08, form: 'loaf' },
    pottery: { cols: [P.wallTerra, P.roofTerracotta, P.stoneWarm], r: 0.085, form: 'pot' },
  };
  function goodsGeo(form, r) {
    const k = 'goods|' + form + '|' + r.toFixed(3);
    return gc(k, function () {
      if (form === 'fish') return geoUp('fish' + r.toFixed(3), octa(r * 1.7, r * 0.55, r * 0.75), r * 0.55);
      if (form === 'loaf') return geoUp('loaf' + r.toFixed(3), octa(r * 1.5, r * 0.8, r * 0.8), r * 0.8);
      if (form === 'bloom') return dome4(r, r * 1.5, r);
      if (form === 'pot') return lathe([[0.001, 0], [r * 0.85, r * 0.5], [r * 0.5, r * 1.45], [r * 0.72, r * 1.7]], 5);
      return geoUp('ball' + r.toFixed(3), octa(r, r * 0.9, r), r * 0.9);
    });
  }

  /** marketStall({seed, w, d, goods}) — striped sagging canopy, produce */
  Props.marketStall = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 41);
    const w = opts.w === undefined ? 2.6 : opts.w;
    const d = opts.d === undefined ? 2.2 : opts.d;
    const kind = opts.goods || r.pick(['fruit', 'fish', 'flowers', 'bread', 'pottery']);
    const G = GOODS[kind] || GOODS.fruit;
    const colA = opts.color || r.pick([P.awningRed, P.awningGreen, P.awningBlue, P.awningYellow]);
    const h = 2.3;
    const g = TOWN.group('marketStall');
    // four turned posts
    const post = gc('stallPost', () => lathe([[0.06, 0], [0.05, 0.1], [0.045, h - 0.15], [0.06, h]], 5));
    for (let sx = -1; sx <= 1; sx += 2) {
      for (let sz = -1; sz <= 1; sz += 2) add(g, post, M.timber, sx * (w / 2 - 0.07), 0, sz * (d / 2 - 0.07));
    }
    // striped canopy: sags between the posts, slopes down toward +Z
    const canopyKey = 'stallCanopy|' + w.toFixed(2) + '|' + d.toFixed(2) + '|' + colA;
    add(g, gc(canopyKey, () => grid(8, 3, function (u, v) {
      const x = -w / 2 - 0.12 + (w + 0.24) * u;
      const sagX = Math.sin(u * Math.PI) * 0.1;
      const z = -d / 2 - 0.1 + (d + 0.35) * v;
      const y = -v * 0.3 - sagX * (0.35 + 0.65 * Math.sin(v * Math.PI));
      return [x, y, z];
    }, stripes(w + 0.24, 8, colA, P.awningCream))), M.vc, 0, h + 0.16, 0);
    // sagging valance along the front edge
    add(g, gc('stallVal|' + w.toFixed(2) + '|' + colA, () => valance(w + 0.24, 0.24, 7, stripes(w + 0.24, 8, colA, P.awningCream))), M.vc, 0, h - 0.15, d / 2 + 0.25);
    add(g, board(w + 0.2, 0.05, 0.05), M.timber, 0, h + 0.16, d / 2 + 0.25);
    // counter on trestles, with a sloping display board
    add(g, Geo.chamferBox(w, 0.09, d * 0.55, 0.025), M.wood, 0, 0.92, -0.1);
    const disp = add(g, board(w * 0.94, 0.05, d * 0.4), M.wood, 0, 1.03, d / 2 - 0.5);
    disp.rotation.x = -14 * DEG;
    for (let i = -1; i <= 1; i += 2) {
      add(g, gc('stallTrestle', () => plateX([[-0.32, 0], [0.32, 0], [0.22, 0.88], [-0.22, 0.88]], 0.06)), M.timber, i * (w / 2 - 0.3), 0, -0.1);
    }
    add(g, board(w, 0.5, 0.04), M.timber, 0, 0.62, -d * 0.27);
    // produce: instanced small forms on the display + in a crate
    const items = [];
    const geoP = goodsGeo(G.form, G.r);
    for (let i = 0; i < 14; i++) {
      const row = i % 7;
      items.push({
        p: [-w * 0.42 + row * (w * 0.84 / 6) + r.range(-0.03, 0.03),
            1.09 + (i > 6 ? G.r * 1.6 : 0),
            d / 2 - 0.66 + (i > 6 ? 0.16 : 0) + r.range(-0.05, 0.05)],
        r: [0, r.range(0, 6.28), 0], s: r.range(0.8, 1.25), c: r.pick(G.cols),
      });
    }
    for (let i = 0; i < 5; i++) {
      items.push({
        p: [w * 0.24 + r.range(-0.18, 0.18), 0.32, -d * 0.1 + r.range(-0.14, 0.14)],
        r: [0, r.range(0, 6.28), 0], s: r.range(0.85, 1.1), c: r.pick(G.cols),
      });
    }
    g.add(Geo.instanced(geoP, M.tint, items));
    add(g, gc('stallCrate', () => Geo.chamferBox(0.5, 0.32, 0.42, 0.03)), M.woodDark, w * 0.24, 0.16, -d * 0.1);
    // hanging scales (shared swing ticker)
    const sc = TOWN.group('scales');
    sc.position.set(-w / 2 + 0.28, h - 0.02, 0.1);
    add(sc, board(0.34, 0.03, 0.03), M.brass, 0, -0.3, 0);
    add(sc, rod(0.008, 0.3, 4), M.iron, 0, -0.3, 0);
    for (let i = -1; i <= 1; i += 2) {
      add(sc, rod(0.006, 0.14, 4), M.iron, i * 0.16, -0.44, 0);
      add(sc, gc('scalePan', () => lathe([[0.001, 0.03], [0.09, 0.045], [0.085, 0.0]], 6)), M.brass, i * 0.16, -0.47, 0);
    }
    g.add(addSwing(sc, 0.05, 0.9, opts.seed || 41));
    // a single bulb over the counter: Mat.lamp + halo, so the stall reads at night
    add(g, rod(0.008, 0.16, 4), M.iron, 0.15, h - 0.02, d / 2 + 0.06);
    add(g, bulbGeo(), M.lamp, 0.15, h - 0.02, d / 2 + 0.06);
    const bha = TOWN.halo(P.lampWarm, 2.2, { max: 0.6 });
    bha.position.set(0.15, h - 0.09, d / 2 + 0.06);
    g.add(bha);
    const bpool = TOWN.halo(P.lampWarm, 4.2, { max: 0.22 });
    bpool.position.set(0.15, h - 0.05, d / 2 - 0.1);
    g.add(bpool);
    // chalk price boards
    add(g, board(0.42, 0.3, 0.03), M.woodDark, w * 0.3, 1.42, d / 2 - 0.3);
    add(g, gc('priceP', () => new T.PlaneGeometry(0.36, 0.24)), matChalk(), w * 0.3, 1.42, d / 2 - 0.28);
    add(g, board(0.3, 0.22, 0.025), M.woodDark, -w * 0.32, 1.2, d / 2 - 0.42).rotation.z = r.range(-0.1, 0.1);
    g.userData.goods = kind;
    jitter(g, r, 0.95, 1.06);
    return finish(g, 'marketStall', w + 0.3, d + 0.45, h + 0.2);
  };

  /**
   * shopSign({seed, text, color, style:'hanging'|'projecting'|'board', y})
   * ORIGIN ON THE WALL FACE (z = 0 is the wall plane), projecting +Z.
   * opts.atlas (0..5) uses the shared sign atlas instead of custom text
   * (cheaper: no extra material).  opts.glow adds Mat.neon + a halo.
   */
  Props.shopSign = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 42);
    const style = opts.style || r.pick(['hanging', 'projecting', 'board']);
    const text = opts.text === undefined ? null : opts.text;
    const col = opts.color || r.pick([P.roofBlue, P.roofPlum, P.roofGreen, P.wallBrick]);
    const glow = opts.glow === undefined ? r.chance(0.5) : !!opts.glow;
    const y = opts.y === undefined ? 2.7 : opts.y;
    const bw = opts.w === undefined ? r.range(0.95, 1.3) : opts.w;
    const bh = opts.h === undefined ? r.range(0.42, 0.58) : opts.h;
    const g = TOWN.group('shopSign');
    const idx = opts.atlas === undefined ? r.int(0, 5) : opts.atlas;
    const face = {
      geo: text === null
        ? (w2, h2) => atlasPlane(w2, h2, idx)
        : (w2, h2) => gc('signPlane|' + w2.toFixed(2) + '|' + h2.toFixed(2), () => new T.PlaneGeometry(w2, h2)),
      mat: text === null ? matAtlas() : matSign(text, col, P.wallCream, glow),
    };

    if (style === 'board') {
      add(g, Geo.chamferBox(bw, bh, 0.07, 0.025), M.woodDark, 0, y, 0.04);
      add(g, face.geo(bw - 0.12, bh - 0.1), face.mat, 0, y, 0.085);
      for (let i = -1; i <= 1; i += 2) {
        add(g, gc('signBrkS', () => plateX([[0.0, 0.0], [0.09, 0.0], [0.09, 0.05], [0.0, 0.05]], 0.05)), M.iron, i * (bw / 2 - 0.1), y - bh / 2 - 0.03, 0.04);
      }
      if (glow) {
        for (let i = -1; i <= 1; i += 2) add(g, board(bw, 0.035, 0.035), Mat.neon(P.neonPink), 0, y + i * (bh / 2 - 0.02), 0.09);
        const ha = TOWN.halo(P.neonPink, 2.6, { max: 0.5, flick: 0.08 });
        ha.position.set(0, y, 0.3); g.add(ha);
      }
      return finish(g, 'shopSign', bw, 0.14, y + bh / 2);
    }
    // bracket arm projecting +Z from the wall face
    add(g, gc('signArm', () => Geo.mergeGeometries([
      plateX([[0.0, 0.0], [0.86, 0.0], [0.86, 0.07], [0.0, 0.07]], 0.05),
      plateX([[0.06, -0.5], [0.14, -0.5], [0.8, 0.0], [0.06, 0.0]], 0.035),
    ])), M.iron, 0, y + 0.28, 0.04);
    add(g, gc('signPlate', () => plateX([[0.0, -0.3], [0.05, -0.34], [0.05, 0.34], [0.0, 0.3]], 0.3)), M.iron, 0, y + 0.16, 0.01);
    const swing = TOWN.group('signSwing');
    if (style === 'hanging') {
      swing.position.set(0, y + 0.26, 0.62);
      for (let i = -1; i <= 1; i += 2) add(swing, rod(0.012, 0.16, 4), M.iron, 0, -0.16, i * (bw / 2 - 0.08));
      add(swing, Geo.chamferBox(0.07, bh, bw, 0.02), M.woodDark, 0, -0.16 - bh / 2, 0);
      for (let i = -1; i <= 1; i += 2) {
        const pl = add(swing, face.geo(bw - 0.1, bh - 0.08), face.mat, i * 0.04, -0.16 - bh / 2, 0);
        pl.rotation.y = i * Math.PI / 2;
      }
      add(swing, gc('signFinial', () => dome4(0.045, 0.05, 0.045)), M.brass, 0, -0.14, 0);
      g.add(addSwing(swing, 0.045, 1.05, opts.seed || 42));
    } else {
      swing.position.set(0, y, 0.5);
      add(swing, Geo.chamferBox(0.07, bh, bw, 0.02), M.woodDark, 0, 0, 0);
      for (let i = -1; i <= 1; i += 2) {
        const pl = add(swing, face.geo(bw - 0.1, bh - 0.08), face.mat, i * 0.04, 0, 0);
        pl.rotation.y = i * Math.PI / 2;
      }
      g.add(swing);
    }
    if (glow) {
      const ha = TOWN.halo(P.lampWarm, 2.4, { max: 0.55, flick: 0.06 });
      ha.position.set(0, y - 0.1, 0.62); g.add(ha);
      add(swing, rod(0.02, bw * 0.9, 4), Mat.neon(P.neonPink), 0, style === 'hanging' ? -0.1 : 0.08, -bw * 0.45).rotation.x = Math.PI / 2;
    }
    return finish(g, 'shopSign', 0.32, bw + 0.7, y + 0.45);
  };

  /**
   * awning({seed, w, color, style:'straight'|'scallop'|'dutch', y})
   * ORIGIN ON THE WALL FACE, fabric projecting +Z, with a valance and
   * thin brackets.  The cloth always sags — never a flat quad.
   */
  Props.awning = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 43);
    const w = opts.w === undefined ? r.range(1.6, 2.6) : opts.w;
    const style = opts.style || r.pick(['straight', 'scallop', 'dutch']);
    const col = opts.color || r.pick([P.awningRed, P.awningGreen, P.awningBlue, P.awningYellow, P.awningCream]);
    const y = opts.y === undefined ? 2.5 : opts.y;
    const proj = opts.proj === undefined ? r.range(0.85, 1.15) : opts.proj;
    const g = TOWN.group('awning');
    const bands = Math.max(4, Math.round(w / 0.32));
    const key = 'awnCloth|' + style + '|' + w.toFixed(2) + '|' + proj.toFixed(2) + '|' + col + '|' + bands;
    add(g, gc(key, () => grid(bands, 3, function (u, v) {
      const x = -w / 2 + w * u;
      const sagX = Math.sin(u * Math.PI) * 0.07;
      let yy, zz;
      if (style === 'dutch') {                     // quarter-round hood
        yy = -proj * (1 - Math.cos(v * Math.PI * 0.5)) * 0.85;
        zz = proj * Math.sin(v * Math.PI * 0.5);
      } else {
        yy = -v * proj * 0.42;
        zz = v * proj;
      }
      return [x, yy - sagX * (0.3 + 0.7 * v), zz];
    }, stripes(w, bands, col, P.awningCream))), M.vc, 0, y, 0.03);
    const drop = style === 'scallop' ? 0.26 : 0.18;
    add(g, gc('awnVal|' + style + '|' + w.toFixed(2) + '|' + col + '|' + bands,
      () => valance(w, drop, style === 'scallop' ? Math.max(4, Math.round(w / 0.3)) : 2, stripes(w, bands, col, P.awningCream))),
      M.vc, 0, y - (style === 'dutch' ? proj * 0.6 : proj * 0.42) - 0.01, 0.03 + (style === 'dutch' ? proj * 0.98 : proj));
    // roller bar at the wall + thin iron brackets
    add(g, rod(0.035, w + 0.08, 5), M.iron, -(w + 0.08) / 2, y + 0.02, 0.05).rotation.z = -Math.PI / 2;
    for (let i = -1; i <= 1; i += 2) {
      add(g, gc('awnBrk|' + proj.toFixed(2), () => plateX([[0.02, 0.02], [proj, -proj * 0.4], [proj, -proj * 0.32], [0.02, 0.12]], 0.03)), M.iron, i * (w / 2 - 0.06), y, 0.03);
    }
    return finish(g, 'awning', w + 0.1, proj + 0.1, y + 0.06);
  };

  /** blackboard({seed}) — A-frame chalk menu board */
  Props.blackboard = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 44);
    const g = TOWN.group('blackboard');
    const inner = TOWN.group('bbInner');
    const lean = 9 * DEG;
    for (let i = -1; i <= 1; i += 2) {
      const leaf = TOWN.group('leaf');
      leaf.rotation.x = i * lean;
      add(leaf, board(0.66, 0.9, 0.035), M.woodDark, 0, 0.52, 0);
      add(leaf, gc('bbPlane', () => new T.PlaneGeometry(0.58, 0.8)), matChalk(), 0, 0.52, i * 0.024);
      for (let k = -1; k <= 1; k += 2) {
        add(leaf, gc('bbLeg', () => plateX([[-0.03, 0], [0.03, 0], [0.025, 1.0], [-0.025, 1.0]], 0.05)), M.wood, k * 0.32, 0.05, 0);
      }
      leaf.position.z = i * 0.05;
      if (i < 0) leaf.rotation.y = Math.PI;
      inner.add(leaf);
    }
    add(inner, rod(0.02, 0.6, 4), M.iron, -0.3, 0.98, 0).rotation.z = -Math.PI / 2;
    inner.rotation.y = r.range(-0.25, 0.25);
    g.add(ground(inner));
    jitter(g, r, 0.93, 1.09);
    return finish(g, 'blackboard', 0.72, 0.5, 1.0);
  };

  /** banner({seed, w, h, color, y}) — hanging vertical banner, slight curve */
  Props.banner = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 45);
    const w = opts.w === undefined ? r.range(0.5, 0.75) : opts.w;
    const h = opts.h === undefined ? r.range(1.6, 2.4) : opts.h;
    const col = opts.color || r.pick([P.fabricRed, P.roofBlue, P.roofPlum, P.awningGreen]);
    const y = opts.y === undefined ? 3.4 : opts.y;
    const g = TOWN.group('banner');
    const key = 'bannerCloth|' + w.toFixed(2) + '|' + h.toFixed(2) + '|' + col;
    add(g, gc(key, () => grid(3, 5, function (u, v) {
      const x = -w / 2 + w * u;
      const curve = Math.sin(u * Math.PI) * 0.07 * (0.3 + 0.7 * v);
      const flare = 1 + 0.06 * v;
      return [x * flare, -v * h, curve + Math.sin(v * 2.4) * 0.03];
    }, function (c, x, yy) {
      const t = U.saturate(-yy / h);
      c.set(t > 0.78 || t < 0.12 ? P.fabricWhite : col);
    })), M.vc, 0, y, 0.06);
    add(g, rod(0.022, w + 0.22, 5), M.brass, -(w + 0.22) / 2, y + 0.02, 0.04).rotation.z = -Math.PI / 2;
    for (let i = -1; i <= 1; i += 2) {
      add(g, gc('bannerBall', () => dome4(0.04, 0.05, 0.04)), M.brass, i * (w / 2 + 0.11), y + 0.02, 0.04);
    }
    // tassels along the bottom edge
    const tas = [];
    for (let i = 0; i < 5; i++) tas.push({ p: [-w / 2 + w * (i / 4) * 1.06, y - h - 0.09, 0.06], s: [1, r.range(0.8, 1.3), 1], c: P.brass });
    g.add(Geo.instanced(dome4(0.022, 0.09, 0.022), M.tint, tas));
    return finish(g, 'banner', w + 0.3, 0.2, y + 0.08);
  };

  /**
   * bunting({a, b, count, seed}) — triangular flags on a catenary.
   * a / b are measured FROM THE GROUP ORIGIN (absolute-point factory).
   */
  Props.bunting = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 46);
    const a = opts.a || [-3.5, 3.2, 0], b = opts.b || [3.5, 3.4, 0];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const count = opts.count || U.clamp(Math.round(len / 0.42), 4, 26);
    const sag = opts.sag === undefined ? Math.max(0.25, len * 0.08) : opts.sag;
    const cols = opts.colors || [P.fabricRed, P.awningYellow, P.awningBlue, P.fabricWhite, P.awningGreen];
    const g = TOWN.group('bunting');
    const cat = Geo.catenary(a, b, sag, 0.016, 6);
    g.add(mesh(cat.geo, M.iron));
    const flagGeo = gc('buntingFlag', () => Geo.fromQuads(
      [[-0.11, 0, 0], [0.11, 0, 0], [0, -0.26, 0.02]], [[0, 1, 2]]));
    const tr = [];
    const yaw = Math.atan2(b[2] - a[2], b[0] - a[0]);
    for (let i = 0; i < count; i++) {
      const t = (i + 0.5) / count;
      const yy = U.lerp(a[1], b[1], t) - Math.sin(t * Math.PI) * sag;
      const slope = -Math.atan2(Math.cos(t * Math.PI) * sag * Math.PI - (b[1] - a[1]), len);
      tr.push({
        p: [U.lerp(a[0], b[0], t), yy, U.lerp(a[2], b[2], t)],
        r: [r.range(-0.15, 0.15), yaw, slope],
        s: r.range(0.9, 1.15), c: cols[i % cols.length],
      });
    }
    g.add(Geo.instanced(flagGeo, M.clothTint, tr));
    g.userData.absolutePoints = true;
    g.userData.a = a; g.userData.b = b;
    return finish(g, 'bunting', Math.abs(b[0] - a[0]) + 0.3, Math.abs(b[2] - a[2]) + 0.3, Math.max(a[1], b[1]));
  };

  /** flagPole({seed, h, color}) — the flag WAVES (shared flag ticker) */
  Props.flagPole = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 47);
    const h = opts.h === undefined ? r.range(5, 6.5) : opts.h;
    const col = opts.color || r.pick([P.fabricRed, P.roofBlue, P.awningGreen, P.roofPlum]);
    const g = TOWN.group('flagPole');
    add(g, plinthGeo(0.62, 0.26, 6), M.stone, 0, 0, 0);
    add(g, gc('flagPole|' + h.toFixed(2), () => lathe([
      [0.075, 0], [0.06, 0.1], [0.05, h * 0.6], [0.038, h],
    ], 6)), M.white, 0, 0.24, 0);
    add(g, gc('flagFin', () => lathe([[0.001, 0.14], [0.05, 0.07], [0.055, 0.03], [0.02, 0]], 5)), M.brass, 0, h + 0.24, 0);
    add(g, board(0.05, 0.16, 0.05), M.iron, 0.07, 1.1, 0);   // cleat
    const fw = h * 0.3, fh = h * 0.19;
    const flag = mesh(grid(6, 3, function (u, v) {
      return [0.04 + fw * u, -v * fh, 0];
    }, function (c, x, yy) {
      const t = U.saturate(-yy / fh);
      c.set(t < 0.34 ? col : (t < 0.67 ? P.fabricWhite : col));
    }), M.vc);
    flag.position.set(0, h + 0.18, 0);
    addFlag(flag, fw, 0.04, 0.1 + fw * 0.06, opts.seed || 47, 4.4);
    g.add(flag);
    return finish(g, 'flagPole', 0.62, 0.62, h + 0.4);
  };
  /* ============================================================
     8 · WATER & HARBOUR
     ============================================================ */

  /**
   * fountain({seed, r, tiers}) — tiered stone fountain.
   * userData.jetAnchors = [[x,y,z],...] (where the FX module should put
   * water jets) and userData.basinTop = y of the lower water surface.
   * No particles here.
   */
  Props.fountain = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 51);
    const R = opts.r === undefined ? 2.2 : opts.r;
    const tiers = opts.tiers === undefined ? 2 : U.clamp(opts.tiers | 0, 1, 3);
    const g = TOWN.group('fountain');
    const sides = 8;
    // octagonal kerb / step
    add(g, gc('fntStep|' + R.toFixed(2), () => Geo.prism(Geo.polyPlan(sides, R * 1.16, Math.PI / sides), 0.14, { y0: 0 })), M.stoneDark, 0, 0, 0);
    // basin: floor -> inner wall -> carved lip -> outer wall (single lathe)
    const basinTop = 0.62;
    add(g, gc('fntBasin|' + R.toFixed(2), () => lathe([
      [R * 0.94, 0.12], [R * 0.97, 0.2], [R * 1.03, basinTop - 0.06], [R * 0.99, basinTop + 0.04],
      [R * 0.86, basinTop - 0.06], [R * 0.86, 0.18], [0.06, 0.16],
    ], sides)), M.stone, 0, 0, 0);
    // lower water surface
    add(g, gc('fntWater|' + R.toFixed(2), () => lathe([[0.001, 0], [R * 0.85, 0]], 12)), M.water, 0, basinTop - 0.12, 0);
    // moulded baluster stem
    const stemTop = basinTop + 0.58;
    add(g, gc('fntStem|' + R.toFixed(2), () => lathe([
      [R * 0.3, 0], [R * 0.3, 0.08], [R * 0.2, 0.16], [R * 0.13, 0.4],
      [R * 0.19, 0.56], [R * 0.11, 0.64], [R * 0.16, 0.72],
    ], sides)), M.stone, 0, basinTop - 0.14, 0);
    const anchors = [];
    let topY = stemTop;
    // upper bowl(s)
    for (let t = 1; t < tiers; t++) {
      const br = R * (0.52 - (t - 1) * 0.16);
      const by = stemTop + (t - 1) * 0.8;
      add(g, gc('fntBowl|' + br.toFixed(2), () => lathe([
        [0.05, 0], [br * 0.9, 0.02], [br * 0.95, 0.2], [br, 0.26], [br * 0.86, 0.2], [br * 0.5, 0.06], [0.06, 0.04],
      ], sides)), M.stone, 0, by, 0);
      add(g, gc('fntBowlWater|' + br.toFixed(2), () => lathe([[0.001, 0], [br * 0.86, 0]], 10)), M.water, 0, by + 0.19, 0);
      topY = by + 0.26;
      if (t < tiers - 1) {
        add(g, gc('fntStem2|' + br.toFixed(2), () => lathe([[br * 0.2, 0], [br * 0.14, 0.3], [br * 0.2, 0.5], [br * 0.3, 0.54]], 6)), M.stone, 0, by + 0.2, 0);
      }
      anchors.push([0, +(by + 0.2).toFixed(3), 0]);
    }
    // crowning finial / spout
    add(g, gc('fntFinial', () => lathe([[0.16, 0], [0.1, 0.12], [0.14, 0.2], [0.07, 0.32], [0.001, 0.4]], 6)), M.stone, 0, topY, 0);
    anchors.unshift([0, +(topY + 0.4).toFixed(3), 0]);
    // carved rosettes around the basin + four rim spouts
    const ros = [], spouts = [];
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2 + Math.PI / sides;
      ros.push({ p: [Math.cos(a) * R * 1.0, basinTop - 0.22, Math.sin(a) * R * 1.0], r: [Math.PI / 2, -a, 0], s: 1 });
      if (i % 2 === 0) {
        spouts.push([Math.cos(a) * R * 0.8, basinTop + 0.02, Math.sin(a) * R * 0.8]);
        anchors.push([+(Math.cos(a) * R * 0.74).toFixed(3), +(basinTop + 0.1).toFixed(3), +(Math.sin(a) * R * 0.74).toFixed(3)]);
      }
    }
    g.add(Geo.instanced(dome4(0.1, 0.07, 0.1), M.stoneDark, ros));
    for (let i = 0; i < spouts.length; i++) {
      add(g, gc('fntSpout', () => lathe([[0.06, 0], [0.075, 0.05], [0.05, 0.12]], 5)), M.brass, spouts[i][0], spouts[i][1], spouts[i][2]);
    }
    g.userData.jetAnchors = anchors;
    g.userData.basinTop = +(basinTop - 0.12).toFixed(3);
    g.userData.waterR = +(R * 0.85).toFixed(3);
    jitter(g, r, 0.94, 1.07);
    return finish(g, 'fountain', R * 2.32, R * 2.32, topY + 0.4);
  };

  /** well({seed}) — stone kerb, timber frame, tiled roof, bucket on a rope */
  Props.well = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 52);
    const g = TOWN.group('well');
    const R = 0.62;
    add(g, gc('wellKerb', () => lathe([
      [R * 0.72, 0], [R, 0.06], [R * 1.02, 0.62], [R * 0.94, 0.7], [R * 0.78, 0.66], [R * 0.76, 0.1],
    ], 8)), M.stone, 0, 0, 0);
    add(g, gc('wellWater', () => lathe([[0.001, 0], [R * 0.74, 0]], 10)), M.water, 0, 0.34, 0);
    const H = 1.75;
    for (let i = -1; i <= 1; i += 2) {
      add(g, gc('wellPost', () => plateX([[-0.07, 0], [0.07, 0], [0.05, H], [-0.05, H]], 0.1)), M.timber, i * (R * 0.86), 0.5, 0);
      const br = add(g, gc('wellBrace', () => plateX([[0.0, 0.0], [0.34, 0.0], [0.3, 0.06], [0.0, 0.34]], 0.06)), M.timber, i * (R * 0.86), 1.62, 0);
      br.rotation.y = i > 0 ? Math.PI : 0;
    }
    add(g, rod(0.05, R * 1.9, 6), M.wood, -R * 0.95, 2.14, 0).rotation.z = -Math.PI / 2;
    add(g, gc('wellRoof', () => Geo.gableRoof(1.5, 1.15, 0.44, { over: 0.16, thick: 0.07 })), M.woodDark, 0, 2.25, 0);
    add(g, rod(0.055, 1.5, 5), M.wood, -0.75, 2.69, 0).rotation.z = -Math.PI / 2;
    // winding handle + rope + bucket
    add(g, gc('wellCrank', () => plateX([[0.0, -0.03], [0.22, -0.03], [0.22, 0.03], [0.0, 0.03]], 0.04)), M.iron, R * 0.95 + 0.05, 2.14, 0);
    add(g, rod(0.02, 0.14, 4), M.woodDark, R * 0.95 + 0.24, 2.14, 0).rotation.x = Math.PI / 2;
    add(g, rod(0.012, 1.0, 4), M.woodDark, 0.1, 1.14, 0);
    add(g, gc('wellBucket', () => lathe([[0.001, 0], [0.11, 0.02], [0.13, 0.22], [0.115, 0.24]], 6)), M.woodDark, 0.1, 0.9, 0);
    add(g, gc('wellHoop', () => Geo.ring(0.115, 0.135, 0.022, 6)), M.iron, 0.1, 1.05, 0);
    g.rotation.y = r.range(-0.2, 0.2);
    jitter(g, r, 0.95, 1.06);
    return finish(g, 'well', 1.7, 1.4, 2.78);
  };

  /** mooringPost({seed}) — quayside bollard with a rope coil */
  Props.mooringPost = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 53);
    const g = TOWN.group('mooringPost');
    const h = r.range(0.55, 0.78);
    add(g, gc('moorBase', () => Geo.prism(Geo.polyPlan(6, 0.26), 0.08, { y0: 0 })), M.stoneDark, 0, 0, 0);
    add(g, gc('moorPost|' + h.toFixed(2), () => lathe([
      [0.17, 0], [0.18, 0.05], [0.14, 0.1], [0.13, h * 0.72], [0.19, h * 0.86], [0.16, h * 0.94], [0.1, h],
    ], 7)), M.iron, 0, 0.07, 0);
    const coil = add(g, Geo.torus(0.19, 0.035, 10, 4), M.wood, 0, h * 0.34, 0);
    coil.rotation.x = Math.PI / 2;
    coil.rotation.z = r.range(0, 1);
    return finish(g, 'mooringPost', 0.52, 0.52, h + 0.1);
  };

  /** cleat({seed}) — small iron mooring cleat */
  Props.cleat = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 54);
    const g = TOWN.group('cleat');
    add(g, gc('cleatBase', () => Geo.prism(Geo.roundRectPlan(0.42, 0.18, 0.05, 2), 0.05, { y0: 0 })), M.iron, 0, 0, 0);
    for (let i = -1; i <= 1; i += 2) add(g, rod(0.035, 0.15, 5), M.iron, i * 0.11, 0.04, 0);
    const horn = add(g, gc('cleatHorn', () => lathe([
      [0.001, -0.22], [0.035, -0.19], [0.045, -0.1], [0.045, 0.1], [0.035, 0.19], [0.001, 0.22],
    ], 5)), M.iron, 0, 0.19, 0);
    horn.rotation.z = Math.PI / 2;
    jitter(g, r, 0.9, 1.12);
    return finish(g, 'cleat', 0.46, 0.2, 0.24);
  };

  /** buoy({seed, color}) — moored float with a tiny top light */
  Props.buoy = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 55);
    const col = opts.color || r.pick([P.fabricRed, P.flowerYellow, P.awningGreen]);
    const g = TOWN.group('buoy');
    add(g, gc('buoyBody|' + col, () => tinted(lathe([
      [0.001, 0], [0.24, 0.14], [0.3, 0.34], [0.26, 0.56], [0.16, 0.68], [0.09, 0.72],
    ], 7), col)), M.vc, 0, 0, 0);
    add(g, gc('buoyBand', () => Geo.ring(0.265, 0.29, 0.07, 7)), M.white, 0, 0.42, 0);
    for (let i = -1; i <= 1; i += 2) add(g, rod(0.016, 0.26, 4), M.iron, i * 0.06, 0.7, 0);
    add(g, gc('buoyLamp', () => lathe([[0.001, 0], [0.06, 0.03], [0.05, 0.1], [0.001, 0.13]], 5)), M.lamp, 0, 0.96, 0);
    const ha = TOWN.halo(P.lampWarm, 1.4, { max: 0.7, flick: 0.25 });
    ha.position.set(0, 1.02, 0); g.add(ha);
    jitter(g, r, 0.92, 1.1);
    return finish(g, 'buoy', 0.6, 0.6, 1.1);
  };

  /** lifeRing({seed}) — ring on a small quayside board */
  Props.lifeRing = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 56);
    const g = TOWN.group('lifeRing');
    add(g, gc('lifePost', () => plateX([[-0.06, 0], [0.06, 0], [0.05, 1.05], [-0.05, 1.05]], 0.09)), M.timber, 0, 0, 0);
    add(g, board(0.5, 0.34, 0.03), M.white, 0, 0.86, 0.055);
    const ring = add(g, Geo.torus(0.21, 0.055, 12, 5), M.white, 0, 0.86, 0.11);
    ring.rotation.z = r.range(0, 1);
    const marks = [];
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + 0.4 + ring.rotation.z;
      marks.push({ p: [Math.cos(a) * 0.21, 0.86 + Math.sin(a) * 0.21 - 0.055, 0.11], r: [0, 0, a], s: 1, c: P.fabricRed });
    }
    g.add(Geo.instanced(boardUp(0.1, 0.11, 0.1), M.tint, marks));
    jitter(g, r, 0.94, 1.07);
    return finish(g, 'lifeRing', 0.52, 0.26, 1.12);
  };

  /** fishingNet({seed}) — draped, sagging net on stakes */
  Props.fishingNet = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 57);
    const w = opts.w === undefined ? r.range(1.6, 2.4) : opts.w;
    const g = TOWN.group('fishingNet');
    const hA = r.range(1.0, 1.35), hB = r.range(0.7, 1.05);
    add(g, taper(0.05, 0.035, hA, 5), M.woodDark, -w / 2, 0, 0);
    add(g, taper(0.05, 0.035, hB, 5), M.woodDark, w / 2, 0, 0.1);
    const net = gc('netCloth|' + w.toFixed(2) + '|' + hA.toFixed(2) + '|' + hB.toFixed(2), () => grid(6, 4, function (u, v) {
      const top = U.lerp(hA, hB, u);
      const sag = Math.sin(u * Math.PI) * 0.3;
      const y = top - v * (top - 0.02) - sag * Math.sin(v * Math.PI) * 1.2;
      return [-w / 2 + w * u, Math.max(0.01, y), u * 0.1 + Math.sin(v * 3.1) * 0.12 + v * 0.25];
    }));
    g.add(mesh(net, matNet()));
    const floats = [];
    for (let i = 0; i < 5; i++) {
      floats.push({ p: [-w / 2 + w * (i + 0.5) / 5, 0.02, 0.42 + r.range(-0.1, 0.1)], s: r.range(0.8, 1.2), c: r.pick([P.fabricRed, P.wood, P.flowerYellow]) });
    }
    g.add(Geo.instanced(dome4(0.07, 0.09, 0.07), M.tint, floats));
    return finish(g, 'fishingNet', w + 0.3, 0.95, Math.max(hA, hB));
  };

  /** lobsterTrap({seed}) — hooped withy trap */
  Props.lobsterTrap = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 58);
    const g = TOWN.group('lobsterTrap');
    const w = 0.8, d = 1.0;
    add(g, gc('trapBody', () => Geo.barrelRoof(w, d, 0.36, 5, { over: 0.02, thick: 0.05 })), M.wood, 0, 0.06, 0);
    add(g, board(w + 0.06, 0.06, d + 0.06), M.woodDark, 0, 0.03, 0);
    const slats = [];
    for (let i = 0; i < 6; i++) {
      const t = (i + 0.5) / 6, a = t * Math.PI;
      slats.push({ p: [0, 0.06 + Math.sin(a) * 0.34, -Math.cos(a) * (d / 2)], r: [-a + Math.PI / 2, 0, 0], s: 1 });
    }
    g.add(Geo.instanced(boardUp(w + 0.04, 0.02, 0.05), M.woodDark, slats));
    add(g, Geo.torus(0.06, 0.018, 8, 4), M.woodDark, w / 2 - 0.06, 0.1, d / 2 - 0.06);
    g.rotation.y = r.range(-0.3, 0.3);
    jitter(g, r, 0.9, 1.1);
    return finish(g, 'lobsterTrap', w + 0.12, d + 0.12, 0.48);
  };

  /** fishCrate({seed}) — open crate of fish on ice */
  Props.fishCrate = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 59);
    const g = TOWN.group('fishCrate');
    const w = 0.66, d = 0.44, h = 0.24;
    add(g, board(w, 0.04, d), M.woodDark, 0, 0.02, 0);
    for (let i = -1; i <= 1; i += 2) {
      add(g, board(w, h, 0.035), M.woodDark, 0, h / 2, i * (d / 2 - 0.02));
      add(g, board(0.035, h, d), M.woodDark, i * (w / 2 - 0.02), h / 2, 0);
    }
    const fish = [];
    for (let i = 0; i < 6; i++) {
      fish.push({
        p: [-w * 0.32 + (i % 3) * w * 0.32, h * 0.8 + (i > 2 ? 0.05 : 0), -d * 0.16 + (i > 2 ? d * 0.3 : 0) + r.range(-0.03, 0.03)],
        r: [0, r.range(-0.4, 0.4) + (i > 2 ? 0.2 : 0), r.range(-0.1, 0.1)], s: r.range(0.85, 1.15),
        c: r.pick([0x9fb3bd, 0x8195a2, 0xc3ced4]),
      });
    }
    g.add(Geo.instanced(goodsGeo('fish', 0.09), M.tint, fish));
    jitter(g, r, 0.9, 1.1);
    return finish(g, 'fishCrate', w, d, h + 0.18);
  };

  /** barrel({seed}) — staved, bulging barrel with iron hoops */
  Props.barrel = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 60);
    const g = TOWN.group('barrel');
    const h = opts.h === undefined ? r.range(0.78, 0.95) : opts.h;
    const R = h * 0.34;
    add(g, gc('barBody|' + h.toFixed(2), () => lathe([
      [R * 0.84, 0], [R, h * 0.28], [R, h * 0.72], [R * 0.84, h],
    ], 8)), M.wood, 0, 0, 0);
    add(g, gc('barTop|' + h.toFixed(2), () => lathe([[0.001, 0], [R * 0.8, 0.01]], 8)), M.woodDark, 0, h, 0);
    for (let i = 0; i < 2; i++) {
      add(g, gc('barHoop|' + h.toFixed(2), () => Geo.ring(R * 0.98, R * 1.05, 0.045, 8)), M.iron, 0, h * (0.18 + i * 0.58), 0);
    }
    g.rotation.y = r.range(0, 1);
    return finish(g, 'barrel', R * 2.15, R * 2.15, h + 0.02);
  };

  /** crate({seed, s}) */
  Props.crate = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 61);
    const s = opts.s === undefined ? r.range(0.5, 0.66) : opts.s;
    const g = TOWN.group('crate');
    add(g, gc('crateBody|' + s.toFixed(2), () => Geo.chamferBox(s, s * 0.82, s * 0.88, 0.03)), M.wood, 0, s * 0.41, 0);
    for (let i = -1; i <= 1; i += 2) {
      add(g, board(s * 1.02, 0.045, 0.03), M.woodDark, 0, s * 0.41 + i * s * 0.3, s * 0.45);
    }
    add(g, board(0.04, s * 0.8, 0.03), M.woodDark, 0, s * 0.41, s * 0.45);
    g.rotation.y = r.range(-0.25, 0.25);
    return finish(g, 'crate', s * 1.06, s * 0.94, s * 0.83);
  };

  /** crateStack({seed, count}) */
  Props.crateStack = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 62);
    const count = opts.count === undefined ? r.int(3, 5) : opts.count;
    const g = TOWN.group('crateStack');
    let y = 0, maxS = 0;
    for (let i = 0; i < count; i++) {
      const s = r.range(0.46, 0.62) * (i > 1 ? 0.92 : 1);
      const c = Props.crate({ seed: (opts.seed || 62) + i * 5, s: s });
      c.position.set(r.range(-0.12, 0.12) * (i ? 1 : 0.2), y, r.range(-0.1, 0.1) * (i ? 1 : 0.2));
      c.rotation.y = r.range(-0.3, 0.3);
      g.add(c);
      y += s * 0.83;
      maxS = Math.max(maxS, s);
    }
    return finish(g, 'crateStack', maxS * 1.45, maxS * 1.35, y);
  };

  /** sackPile({seed, count}) — lumpy grain sacks */
  Props.sackPile = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 63);
    const count = opts.count === undefined ? r.int(3, 5) : opts.count;
    const g = TOWN.group('sackPile');
    const sack = gc('sack', () => lathe([
      [0.001, 0], [0.2, 0.03], [0.24, 0.2], [0.19, 0.42], [0.1, 0.5], [0.12, 0.54], [0.06, 0.56],
    ], 6));
    const tr = [];
    let top = 0;
    for (let i = 0; i < count; i++) {
      const lay = i < 3 ? 0 : 1;
      const a = (i % 3) / 3 * Math.PI * 2 + lay * 0.9;
      const rr = i < 3 ? 0.26 : 0.14;
      const s = r.range(0.85, 1.1);
      tr.push({
        p: [Math.cos(a) * rr, lay * 0.4 + 0.02, Math.sin(a) * rr],
        r: [r.range(-0.07, 0.07), r.range(0, 6.28), r.range(-0.07, 0.07)], s: [s, s * r.range(0.85, 1.05), s],
      });
      top = Math.max(top, lay * 0.4 + 0.56 * s);
    }
    g.add(Geo.instanced(sack, M.white, tr));
    return finish(g, 'sackPile', 1.0, 1.0, top);
  };

  /** anchorProp({seed}) — old anchor leaning on the quay */
  Props.anchorProp = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 64);
    const g = TOWN.group('anchorProp');
    const inner = TOWN.group('anchorInner');
    add(inner, gc('ancShank', () => lathe([[0.055, 0], [0.045, 0.9], [0.06, 1.05], [0.04, 1.12]], 5)), M.iron, 0, 0, 0);
    add(inner, Geo.torus(0.1, 0.028, 8, 4), M.iron, 0, 1.2, 0).rotation.y = Math.PI / 2;
    add(inner, gc('ancArms', () => plateX([
      [-0.52, 0.36], [-0.34, 0.08], [0.0, -0.02], [0.34, 0.08], [0.52, 0.36], [0.0, 0.2],
    ], 0.07)), M.iron, 0, 0.06, 0).rotation.y = Math.PI / 2;
    add(inner, rod(0.032, 0.66, 4), M.woodDark, 0, 1.05, -0.33).rotation.x = Math.PI / 2;
    inner.rotation.set(-15 * DEG, r.range(0, 6.28), 12 * DEG);
    g.add(ground(inner));
    return finish(g, 'anchorProp');
  };

  /** rowboatProp({seed}) — beached dinghy (static; moving boats live in fx) */
  Props.rowboatProp = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 65);
    const L = opts.len === undefined ? r.range(2.6, 3.4) : opts.len;
    const W = L * 0.34;
    const col = opts.color || r.pick([P.fabricWhite, P.awningBlue, P.wallCream, P.awningGreen]);
    const g = TOWN.group('rowboatProp');
    const inner = TOWN.group('boatInner');
    const hullPlan = function (sx, sz) {
      const p = [], n = 10;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        p.push([Math.cos(a) * (W / 2) * sx * (0.55 + 0.45 * Math.abs(Math.sin(a))), Math.sin(a) * (L / 2) * sz]);
      }
      return p;
    };
    add(inner, gc('boatHull|' + L.toFixed(2) + '|' + col, () => tinted(loft([
      { pts: hullPlan(0.42, 0.86), y: 0 },
      { pts: hullPlan(0.86, 0.97), y: 0.22 },
      { pts: hullPlan(1.0, 1.0), y: 0.46 },
    ], { capTop: false }), col)), M.vc, 0, 0, 0);
    add(inner, gc('boatFloor|' + L.toFixed(2), () => Geo.prism(hullPlan(0.6, 0.9), 0.03, { y0: 0 })), M.wood, 0, 0.14, 0);
    for (let i = -1; i <= 1; i += 2) add(inner, board(W * 0.92, 0.05, 0.16), M.wood, 0, 0.42, i * L * 0.16);
    add(inner, gc('boatGun|' + L.toFixed(2), () => loft([
      { pts: hullPlan(1.0, 1.0), y: 0 },
      { pts: hullPlan(1.05, 1.02), y: 0.055 },
    ], { capTop: false, capBottom: false })), M.woodDark, 0, 0.44, 0);
    for (let i = -1; i <= 1; i += 2) {
      const oar = add(inner, gc('oar', () => Geo.mergeGeometries([
        rod(0.022, 1.5, 4),
        Geo.at(plateX([[-0.05, 0], [0.05, 0], [0.04, 0.34], [-0.04, 0.34]], 0.03), 0, 1.5, 0),
      ])), M.wood, i * W * 0.2, 0.4, 0);
      oar.rotation.set(80 * DEG, 0, i * 0.16);
    }
    inner.rotation.set(r.range(3, 7) * DEG, r.range(0, 6.28), r.range(4, 9) * DEG);
    g.add(ground(inner));
    return finish(g, 'rowboatProp');
  };

  /** dockLadder({seed, h}) — iron ladder at the quay edge */
  Props.dockLadder = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 66);
    const h = opts.h === undefined ? r.range(1.6, 2.4) : opts.h;
    const g = TOWN.group('dockLadder');
    for (let i = -1; i <= 1; i += 2) {
      add(g, gc('ladderRail|' + h.toFixed(2), () => plateX([[-0.03, 0], [0.03, 0], [0.03, h], [-0.03, h]], 0.05)), M.iron, i * 0.19, 0, 0);
    }
    const rungs = [];
    const n = Math.max(3, Math.round(h / 0.3));
    for (let i = 0; i < n; i++) rungs.push({ p: [-0.19, 0.16 + i * (h - 0.2) / n, 0], r: [0, 0, -Math.PI / 2], s: 1 });
    g.add(Geo.instanced(rod(0.022, 0.38, 4), M.iron, rungs));
    add(g, gc('ladderHook', () => plateX([[0.0, -0.06], [0.14, -0.06], [0.14, 0.06], [0.0, 0.06]], 0.04)), M.iron, 0.19, h - 0.06, 0);
    return finish(g, 'dockLadder', 0.44, 0.18, h);
  };

  /** capstan({seed}) — hand capstan on the quay */
  Props.capstan = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 67);
    const g = TOWN.group('capstan');
    add(g, gc('capBase', () => Geo.prism(Geo.polyPlan(8, 0.42), 0.09, { y0: 0 })), M.stoneDark, 0, 0, 0);
    add(g, gc('capDrum', () => lathe([
      [0.3, 0], [0.26, 0.1], [0.2, 0.34], [0.22, 0.52], [0.3, 0.6], [0.28, 0.66],
    ], 8)), M.iron, 0, 0.08, 0);
    add(g, gc('capTop', () => lathe([[0.28, 0], [0.24, 0.05], [0.1, 0.09], [0.001, 0.1]], 8)), M.brass, 0, 0.74, 0);
    const bars = [];
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + r.range(0, 0.4);
      bars.push({ p: [Math.cos(a) * 0.2, 0.62, Math.sin(a) * 0.2], r: [Math.PI / 2, -a + Math.PI / 2, 0], s: 1 });
    }
    g.add(Geo.instanced(rod(0.032, 0.34, 4), M.wood, bars));
    const coil = add(g, Geo.torus(0.27, 0.045, 10, 4), M.wood, 0, 0.24, 0);
    coil.rotation.x = Math.PI / 2;
    jitter(g, r, 0.94, 1.07);
    return finish(g, 'capstan', 0.9, 0.9, 0.86);
  };

  /** harbourCrane({seed, h}) — timber jib crane; hook sways (shared ticker) */
  Props.harbourCrane = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 68);
    const h = opts.h === undefined ? r.range(6.3, 7.8) : opts.h;
    const g = TOWN.group('harbourCrane');
    const reach = h * 0.6;
    add(g, gc('craneBase|' + h.toFixed(1), () => Geo.prism(Geo.roundRectPlan(1.9, 1.9, 0.25, 2), 0.3, { y0: 0 })), M.timber, 0, 0, 0);
    add(g, gc('craneKing|' + h.toFixed(1), () => lathe([
      [0.26, 0], [0.22, 0.2], [0.19, h * 0.72], [0.24, h * 0.78], [0.16, h * 0.8],
    ], 6)), M.timber, 0, 0.3, 0);
    // four raking legs + horizontal braces
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const leg = add(g, gc('craneLeg|' + h.toFixed(1), () => plateX([[-0.1, 0], [0.1, 0], [0.07, h * 0.52], [-0.07, h * 0.52]], 0.14)), M.timber, Math.cos(a) * 0.7, 0.28, Math.sin(a) * 0.7);
      leg.rotation.y = -a + Math.PI / 2;
      leg.rotation.x = 9 * DEG * Math.sin(a);
      leg.rotation.z = -9 * DEG * Math.cos(a);
      const brace = add(g, board(0.1, 0.1, 1.25), M.timber, Math.cos(a) * 0.46, h * 0.36, Math.sin(a) * 0.46);
      brace.rotation.y = -a + Math.PI / 4;
    }
    // jib: two tapered side plates + cross bracing, raked toward +Z
    const jib = TOWN.group('jib');
    jib.position.set(0, h * 0.76, 0);
    jib.rotation.x = -26 * DEG;
    for (let i = -1; i <= 1; i += 2) {
      add(jib, gc('craneJib|' + reach.toFixed(2), () => plateX([[0.0, -0.22], [reach, -0.06], [reach, 0.07], [0.0, 0.26]], 0.09)), M.timber, i * 0.16, 0, 0);
    }
    for (let i = 1; i < 4; i++) add(jib, board(0.34, 0.06, 0.06), M.timber, 0, 0.02, reach * (i / 4));
    add(jib, gc('cranePulley', () => lathe([[0.001, 0], [0.11, 0.02], [0.11, 0.06], [0.001, 0.08]], 6)), M.iron, 0, 0, reach - 0.04);
    // hook block on a rope — ONE shared ticker for every crane hook
    const hook = TOWN.group('craneHook');
    hook.position.set(0, -0.02, reach - 0.04);
    const drop = h * 0.4;
    add(hook, rod(0.02, drop, 4), M.iron, 0, -drop, 0);
    add(hook, gc('hookBlock', () => Geo.chamferBox(0.16, 0.24, 0.12, 0.03)), M.woodDark, 0, -drop - 0.12, 0);
    add(hook, gc('hookIron', () => plateX([[-0.1, -0.26], [0.0, -0.32], [0.1, -0.24], [0.05, -0.16], [0.06, 0.0], [-0.05, 0.0]], 0.05)), M.iron, 0, -drop - 0.22, 0);
    jib.add(addHook(hook, 0.07, opts.seed || 68));
    g.add(jib);
    // winch house + drum + crank
    add(g, gc('craneWinch', () => Geo.chamferBox(1.1, 0.5, 0.8, 0.05)), M.timber, 0, 0.55, -0.62);
    add(g, gc('craneRoof', () => Geo.gableRoof(1.25, 0.95, 0.3, { over: 0.12, thick: 0.06 })), M.woodDark, 0, 0.8, -0.62);
    add(g, rod(0.13, 0.9, 6), M.wood, -0.45, 0.5, -0.62).rotation.z = -Math.PI / 2;
    add(g, gc('craneCrank', () => plateX([[0.0, -0.04], [0.3, -0.04], [0.3, 0.04], [0.0, 0.04]], 0.05)), M.iron, 0.5, 0.5, -0.62);
    g.rotation.y = r.range(-0.3, 0.3);
    return finish(g, 'harbourCrane', 2.2, 2.2 + reach, h * 0.92);
  };
  /* ============================================================
     9 · GARDEN, FENCE, WALL
     ============================================================ */

  /** pointed picket board (12 tris, no hidden bottom face) */
  function picketGeo(w, h, t) {
    return gc('picket|' + w.toFixed(3) + '|' + h.toFixed(2) + '|' + t.toFixed(3), function () {
      const hw = w / 2, ht = t / 2, sh = h - w * 0.75;
      const v = [
        [-hw, 0, -ht], [hw, 0, -ht], [hw, 0, ht], [-hw, 0, ht],
        [-hw, sh, -ht], [hw, sh, -ht], [hw, sh, ht], [-hw, sh, ht],
        [0, h, 0],
      ];
      return Geo.fromQuads(v, [
        [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7],
        [4, 5, 8], [5, 6, 8], [6, 7, 8], [7, 4, 8],
      ]);
    });
  }

  /**
   * fence({seed, len, style:'picket'|'iron'|'rail'|'stone'|'wattle', h})
   * runs along X, centred on the origin.  Pickets / bars / stakes are
   * instanced with per-item height & lean jitter so it reads hand-built.
   */
  Props.fence = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 71);
    const len = opts.len === undefined ? 6 : opts.len;
    const style = opts.style || r.pickW([['picket', 4], ['iron', 3], ['rail', 2], ['stone', 2], ['wattle', 1]]);
    const g = TOWN.group('fence');
    const half = len / 2;
    let h = opts.h === undefined ? (style === 'stone' ? 0.85 : (style === 'rail' ? 1.0 : 1.05)) : opts.h;

    if (style === 'stone') {
      const poly = [];
      const n = Math.max(2, Math.round(len / 1.6));
      for (let i = 0; i <= n; i++) poly.push([-half + (len * i) / n, r.range(-0.06, 0.06)]);
      add(g, gc('fenceStone|' + len.toFixed(1) + '|' + h.toFixed(2) + '|' + (opts.seed || 71), () => Geo.retainingWall(poly, h, { thick: 0.42, batter: 0.16 })), M.stone, 0, 0, 0);
      const caps = [];
      for (let i = 0; i < Math.round(len / 0.55); i++) {
        caps.push({ p: [-half + 0.28 + i * 0.55, h + 0.14, r.range(-0.05, 0.05)], r: r.range(0, 6.28), s: r.range(0.8, 1.2) });
      }
      g.add(Geo.instanced(dome4(0.16, 0.08, 0.13), M.stoneDark, caps));
      return finish(g, 'fence', len + 0.3, 0.55, h + 0.22);
    }

    // posts every ~3 m for every timber/iron style
    const nPost = Math.max(2, Math.round(len / 3.1));
    const post = gc('fencePost|' + h.toFixed(2), () => lathe([
      [0.075, 0], [0.062, 0.1], [0.055, h + 0.12], [0.03, h + 0.2],
    ], 4));
    const postTr = [];
    for (let i = 0; i <= nPost; i++) {
      postTr.push({
        p: [-half + (len * i) / nPost, 0, 0],
        r: [r.range(-0.02, 0.02), r.range(0, 1), r.range(-0.025, 0.025)],
        s: [1, r.range(0.94, 1.08), 1],
      });
    }
    g.add(Geo.instanced(post, style === 'iron' ? M.iron : M.timber, postTr));

    if (style === 'rail') {
      for (let k = 0; k < 3; k++) {
        const b = add(g, board(len, 0.075, 0.035), M.timber, 0, 0.28 + k * (h - 0.34) / 2, 0);
        b.rotation.z = r.range(-0.008, 0.008);
      }
      return finish(g, 'fence', len, 0.2, h + 0.2);
    }
    if (style === 'wattle') {
      const stakes = [];
      const ns = Math.max(4, Math.round(len / 0.65));
      for (let i = 0; i < ns; i++) {
        stakes.push({
          p: [-half + 0.25 + i * (len - 0.5) / (ns - 1), 0, 0],
          r: [r.range(-0.04, 0.04), 0, r.range(-0.05, 0.05)], s: [1, r.range(0.9, 1.1), 1],
        });
      }
      g.add(Geo.instanced(taper(0.035, 0.022, h, 4), M.woodDark, stakes));
      for (let k = 0; k < 4; k++) {
        const yy = 0.16 + k * (h - 0.24) / 3;
        add(g, gc('wattleWeave|' + len.toFixed(1) + '|' + k, () => grid(Math.max(8, Math.round(len * 1.5)), 1, function (u, v) {
          const x = -half + len * u;
          return [x, v * 0.09, Math.sin(u * len * 3.1 + k * 1.7) * 0.07];
        }, (c) => c.set(k % 2 ? P.wood : P.woodDark))), M.vc, 0, yy, 0);
      }
      return finish(g, 'fence', len, 0.25, h + 0.2);
    }
    if (style === 'iron') {
      // two rails + instanced bars with spear tips
      for (let k = 0; k < 2; k++) add(g, board(len, 0.05, 0.05), M.iron, 0, 0.16 + k * (h - 0.3), 0);
      const bars = [], tips = [];
      const nb = Math.max(4, Math.round(len / 0.36));
      for (let i = 0; i < nb; i++) {
        const x = -half + 0.12 + i * (len - 0.24) / (nb - 1);
        const hh = h * r.range(0.98, 1.03);
        bars.push({ p: [x, 0.04, 0], s: [1, hh / h, 1], r: [0, 0, r.range(-0.012, 0.012)] });
        tips.push({ p: [x, 0.04 + hh, 0], s: r.range(0.9, 1.1) });
      }
      g.add(Geo.instanced(rod(0.018, h, 4, true), M.iron, bars));
      g.add(Geo.instanced(dome4(0.035, 0.1, 0.035), M.iron, tips));
      return finish(g, 'fence', len, 0.16, h + 0.3);
    }
    // picket
    for (let k = 0; k < 2; k++) add(g, board(len, 0.06, 0.032), M.timber, 0, 0.24 + k * (h - 0.48), 0.055);
    const pk = [], pitch = 0.4;
    const np = Math.max(3, Math.round(len / pitch));
    for (let i = 0; i < np; i++) {
      pk.push({
        p: [-half + 0.1 + i * (len - 0.2) / (np - 1), 0, 0],
        r: [0, 0, r.range(-0.03, 0.03)],
        s: [1, r.range(0.93, 1.07), 1],
      });
    }
    g.add(Geo.instanced(picketGeo(0.11, h, 0.028), M.white, pk));
    return finish(g, 'fence', len, 0.2, h * 1.07 + 0.05);
  };

  /** gate({seed, w, style}) — matching gate leaf between two posts */
  Props.gate = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 72);
    const w = opts.w === undefined ? 1.3 : opts.w;
    const style = opts.style || r.pick(['picket', 'iron']);
    const h = opts.h === undefined ? 1.15 : opts.h;
    const g = TOWN.group('gate');
    for (let i = -1; i <= 1; i += 2) {
      add(g, gc('gatePost|' + h.toFixed(2), () => lathe([
        [0.1, 0], [0.085, 0.12], [0.075, h + 0.25], [0.09, h + 0.32], [0.04, h + 0.42],
      ], 6)), M.timber, i * (w / 2 + 0.1), 0, 0);
    }
    const leaf = TOWN.group('leaf');
    leaf.position.set(-w / 2, 0, 0);
    leaf.rotation.y = r.range(-0.5, 0.15);
    const inner = TOWN.group('leafInner');
    inner.position.x = w / 2;
    for (let k = 0; k < 2; k++) add(inner, board(w - 0.05, 0.07, 0.035), M.timber, 0, 0.22 + k * (h - 0.5), 0);
    const dia = add(inner, board(Math.hypot(w, h - 0.5) * 0.98, 0.06, 0.03), M.timber, 0, (h - 0.28) / 2 + 0.1, 0.02);
    dia.rotation.z = Math.atan2(h - 0.5, w);
    if (style === 'iron') {
      const bars = [], tips = [];
      const nb = Math.max(4, Math.round(w / 0.2));
      for (let i = 0; i < nb; i++) {
        const x = -w / 2 + 0.06 + i * (w - 0.12) / (nb - 1);
        const hh = h * (0.86 + 0.14 * Math.cos((i / (nb - 1) - 0.5) * Math.PI));
        bars.push({ p: [x, 0.06, 0], s: [1, hh / h, 1] });
        tips.push({ p: [x, 0.06 + hh, 0], s: 0.95 });
      }
      inner.add(Geo.instanced(rod(0.016, h, 4, true), M.iron, bars));
      inner.add(Geo.instanced(dome4(0.032, 0.09, 0.032), M.iron, tips));
    } else {
      const pk = [];
      const np = Math.max(3, Math.round(w / 0.24));
      for (let i = 0; i < np; i++) {
        const t = i / (np - 1);
        pk.push({ p: [-w / 2 + 0.07 + t * (w - 0.14), 0.05, 0], s: [1, 0.9 + 0.1 * Math.cos((t - 0.5) * Math.PI), 1] });
      }
      inner.add(Geo.instanced(picketGeo(0.1, h, 0.026), M.white, pk));
    }
    for (let i = -1; i <= 1; i += 2) add(inner, board(0.16, 0.05, 0.05), M.iron, -w / 2 + 0.06, h * 0.5 + i * (h * 0.35), 0.045);
    leaf.add(inner);
    g.add(leaf);
    jitter(g, r, 0.95, 1.06);
    return finish(g, 'gate', w + 0.4, 0.3, h + 0.45);
  };

  /** archTrellis({seed}) — slatted arch with vine hints */
  Props.archTrellis = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 73);
    const w = opts.w === undefined ? 1.5 : opts.w;
    const h = opts.h === undefined ? 2.4 : opts.h;
    const g = TOWN.group('archTrellis');
    const legH = h - w / 2;
    for (let sx = -1; sx <= 1; sx += 2) {
      for (let sz = -1; sz <= 1; sz += 2) {
        add(g, taper(0.045, 0.035, legH, 4), M.timber, sx * (w / 2), 0, sz * 0.22);
      }
      const lat = [];
      for (let i = 0; i < 5; i++) lat.push({ p: [sx * (w / 2), 0.25 + i * (legH - 0.4) / 4, -0.22], r: [0, 0, 0], s: 1 });
      g.add(Geo.instanced(boardUp(0.03, 0.03, 0.44), M.timber, lat));
    }
    // arch: slats following a semicircle
    const slats = [], vines = [];
    const ns = 7;
    for (let i = 0; i < ns; i++) {
      const a = (i / (ns - 1)) * Math.PI;
      slats.push({ p: [-Math.cos(a) * (w / 2), legH + Math.sin(a) * (w / 2) * 0.92, 0], r: [0, 0, a + Math.PI / 2], s: 1 });
      for (let k = 0; k < 2; k++) {
        vines.push({
          p: [-Math.cos(a) * (w / 2 + 0.03), legH + Math.sin(a) * (w / 2) * 0.92 + r.range(-0.06, 0.06), (k ? 0.22 : -0.22) + r.range(-0.05, 0.05)],
          r: [r.range(0, 3), r.range(0, 6.28), 0], s: r.range(0.8, 1.3), c: r.pick([P.leafDeep, P.leafSpring, P.hedge]),
        });
      }
    }
    g.add(Geo.instanced(boardUp(0.05, 0.05, 0.5), M.timber, slats));
    for (let i = 0; i < 8; i++) {
      vines.push({
        p: [r.pick([-1, 1]) * (w / 2 + 0.02), r.range(0.4, legH), r.range(-0.24, 0.24)],
        r: [r.range(0, 3), r.range(0, 6.28), 0], s: r.range(0.8, 1.4), c: r.pick([P.leafDeep, P.leafSpring]),
      });
    }
    g.add(Geo.instanced(dome4(0.09, 0.05, 0.07), M.tint, vines));
    jitter(g, r, 0.94, 1.08);
    return finish(g, 'archTrellis', w + 0.2, 0.6, h);
  };

  /** pergola({seed, len}) — posts, beams, rafters, vine hints */
  Props.pergola = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 74);
    const len = opts.len === undefined ? 4 : opts.len;
    const d = opts.d === undefined ? 2.2 : opts.d;
    const h = opts.h === undefined ? 2.45 : opts.h;
    const g = TOWN.group('pergola');
    const bays = Math.max(1, Math.round(len / 2));
    for (let i = 0; i <= bays; i++) {
      const x = -len / 2 + (len * i) / bays;
      for (let sz = -1; sz <= 1; sz += 2) {
        add(g, gc('pergPost|' + h.toFixed(2), () => lathe([
          [0.1, 0], [0.085, 0.14], [0.075, h - 0.1], [0.085, h],
        ], 5)), M.timber, x, 0, sz * (d / 2));
        add(g, gc('pergBrace', () => plateX([[0.0, 0.0], [0.3, 0.0], [0.26, 0.06], [0.0, 0.3]], 0.06)), M.timber, x, h - 0.34, sz * (d / 2)).rotation.y = sz > 0 ? Math.PI : 0;
      }
    }
    for (let sz = -1; sz <= 1; sz += 2) add(g, board(len + 0.3, 0.14, 0.1), M.timber, 0, h + 0.06, sz * (d / 2));
    const rafters = [], leaves = [];
    const nr = Math.max(3, Math.round(len / 0.55));
    for (let i = 0; i < nr; i++) {
      const x = -len / 2 + i * len / (nr - 1);
      rafters.push({ p: [x, h + 0.13, 0], s: 1 });
      for (let k = 0; k < 2; k++) {
        leaves.push({
          p: [x + r.range(-0.1, 0.1), h + 0.16 + r.range(-0.05, 0.02), r.range(-d / 2, d / 2)],
          r: [r.range(0, 3), r.range(0, 6.28), 0], s: r.range(0.7, 1.4), c: r.pick([P.leafDeep, P.leafSpring, P.hedge, P.leafOlive]),
        });
      }
    }
    g.add(Geo.instanced(boardUp(0.07, 0.09, d + 0.5), M.wood, rafters));
    g.add(Geo.instanced(dome4(0.12, 0.06, 0.1), M.tint, leaves));
    jitter(g, r, 0.96, 1.05);
    return finish(g, 'pergola', len + 0.4, d + 0.5, h + 0.3);
  };

  /** planter({seed, w}) — tapered stone/timber trough with plants */
  Props.planter = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 75);
    const w = opts.w === undefined ? r.range(0.8, 1.3) : opts.w;
    const d = opts.d === undefined ? w * 0.6 : opts.d;
    const h = opts.h === undefined ? 0.55 : opts.h;
    const stone = r.chance(0.55);
    const g = TOWN.group('planter');
    const key = 'planterBody|' + w.toFixed(2) + '|' + d.toFixed(2) + '|' + h.toFixed(2);
    add(g, gc(key, () => loft([
      { pts: Geo.roundRectPlan(w * 0.86, d * 0.86, Math.min(w, d) * 0.16, 2), y: 0 },
      { pts: Geo.roundRectPlan(w, d, Math.min(w, d) * 0.18, 2), y: h },
    ], { capTop: false })), stone ? M.stone : M.timber, 0, 0, 0);
    add(g, gc('planterRim|' + w.toFixed(2), () => loft([
      { pts: Geo.roundRectPlan(w * 1.02, d * 1.02, Math.min(w, d) * 0.18, 2), y: 0 },
      { pts: Geo.roundRectPlan(w * 0.96, d * 0.96, Math.min(w, d) * 0.16, 2), y: 0.06 },
    ], { capTop: true, capBottom: false })), stone ? M.stoneDark : M.woodDark, 0, h - 0.03, 0);
    const pl = [];
    for (let i = 0; i < 9; i++) {
      pl.push({
        p: [r.range(-w * 0.38, w * 0.38), h - 0.02, r.range(-d * 0.34, d * 0.34)],
        r: [r.range(-0.2, 0.2), r.range(0, 6.28), 0], s: r.range(0.8, 1.5),
        c: r.pick([P.leafDeep, P.hedge, P.leafSpring, P.flowerRed, P.flowerYellow, P.flowerWhite]),
      });
    }
    g.add(Geo.instanced(dome4(0.11, 0.16, 0.11), M.tint, pl));
    jitter(g, r, 0.94, 1.08);
    return finish(g, 'planter', w * 1.04, d * 1.04, h + 0.22);
  };

  /** flowerBox({seed, w}) — window-sill box: sits on y=0, lift to the sill */
  Props.flowerBox = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 76);
    const w = opts.w === undefined ? 0.9 : opts.w;
    const g = TOWN.group('flowerBox');
    const h = 0.2;
    add(g, gc('fbBody|' + w.toFixed(2), () => loft([
      { pts: Geo.roundRectPlan(w * 0.9, 0.2, 0.04, 1), y: 0 },
      { pts: Geo.roundRectPlan(w, 0.24, 0.05, 1), y: h },
    ], { capTop: false })), M.woodDark, 0, 0, 0);
    const fl = [];
    for (let i = 0; i < 10; i++) {
      fl.push({
        p: [-w * 0.42 + (i / 9) * w * 0.84 + r.range(-0.02, 0.02), h - 0.02, r.range(-0.07, 0.07)],
        r: [r.range(-0.3, 0.3), r.range(0, 6.28), 0], s: r.range(0.7, 1.3),
        c: r.pick([P.flowerRed, P.flowerPink, P.flowerWhite, P.flowerYellow, P.leafDeep, P.hedge]),
      });
    }
    g.add(Geo.instanced(dome4(0.075, 0.12, 0.075), M.tint, fl));
    jitter(g, r, 0.94, 1.08);
    return finish(g, 'flowerBox', w, 0.26, h + 0.16);
  };

  /** treeGuard({seed}) — iron guard hoop around a street tree */
  Props.treeGuard = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 77);
    const R = opts.r === undefined ? 0.44 : opts.r;
    const h = opts.h === undefined ? 0.85 : opts.h;
    const g = TOWN.group('treeGuard');
    const posts = [];
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      posts.push({ p: [Math.cos(a) * R, 0, Math.sin(a) * R], r: [0, a, 0], s: [1, r.range(0.96, 1.04), 1] });
    }
    g.add(Geo.instanced(gc('guardPost|' + h.toFixed(2), () => lathe([[0.03, 0], [0.026, h], [0.038, h + 0.05], [0.02, h + 0.09]], 4)), M.iron, posts));
    for (let k = 0; k < 2; k++) {
      add(g, gc('guardHoop|' + R.toFixed(2), () => Geo.ring(R - 0.02, R + 0.02, 0.035, 10)), M.iron, 0, 0.3 + k * (h - 0.42), 0);
    }
    add(g, gc('guardGrate|' + R.toFixed(2), () => lathe([[R * 0.5, 0], [R * 1.15, 0.02]], 10)), M.stoneDark, 0, 0, 0);
    jitter(g, r, 0.93, 1.08);
    return finish(g, 'treeGuard', R * 2.2, R * 2.2, h + 0.1);
  };

  /** birdhouse({seed}) — little house on a pole */
  Props.birdhouse = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 78);
    const g = TOWN.group('birdhouse');
    const h = opts.h === undefined ? r.range(1.5, 2.0) : opts.h;
    add(g, taper(0.055, 0.04, h, 5), M.woodDark, 0, 0, 0);
    add(g, gc('bhBody', () => Geo.chamferBox(0.3, 0.3, 0.26, 0.02)), M.wood, 0, h + 0.15, 0);
    add(g, gc('bhRoof', () => Geo.gableRoof(0.34, 0.3, 0.16, { over: 0.06, thick: 0.03 })), M.roofRust ? M.woodDark : M.woodDark, 0, h + 0.3, 0);
    add(g, gc('bhHole', () => Geo.ring(0.045, 0.062, 0.02, 8)), M.woodDark, 0, h + 0.2, 0.13).rotation.x = Math.PI / 2;
    add(g, rod(0.012, 0.09, 4), M.woodDark, 0, h + 0.11, 0.15).rotation.x = Math.PI / 2;
    if (r.chance(0.6)) {
      add(g, gc('bird', () => geoUp('bird', octa(0.055, 0.05, 0.085), 0.05)), M.white, 0.04, h + 0.47, 0.02);
    }
    return finish(g, 'birdhouse', 0.36, 0.34, h + 0.5);
  };

  /** beehive({seed}) — stacked supers or a straw skep */
  Props.beehive = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 79);
    const g = TOWN.group('beehive');
    const skep = r.chance(0.4);
    add(g, gc('hiveStand', () => Geo.prism(Geo.roundRectPlan(0.62, 0.62, 0.06, 1), 0.14, { y0: 0 })), M.timber, 0, 0, 0);
    if (skep) {
      add(g, gc('skep', () => lathe([
        [0.34, 0], [0.36, 0.1], [0.32, 0.34], [0.24, 0.5], [0.12, 0.6], [0.04, 0.62],
      ], 8)), M.white, 0, 0.14, 0);
      add(g, gc('skepCap', () => dome4(0.07, 0.06, 0.07)), M.woodDark, 0, 0.75, 0);
    } else {
      let y = 0.14;
      const n = r.int(2, 3);
      for (let i = 0; i < n; i++) {
        const s = 0.52 - i * 0.02;
        add(g, gc('hiveBox|' + s.toFixed(2), () => Geo.chamferBox(s, 0.24, s * 0.86, 0.02)), M.white, 0, y + 0.12, 0);
        y += 0.25;
      }
      add(g, gc('hiveRoof', () => Geo.gableRoof(0.6, 0.52, 0.16, { over: 0.06, thick: 0.04 })), M.metal, 0, y, 0);
    }
    const bees = [];
    for (let i = 0; i < 3; i++) bees.push({ p: [r.range(-0.3, 0.3), r.range(0.5, 0.9), r.range(0.2, 0.45)], s: r.range(0.8, 1.2), c: P.flowerYellow });
    g.add(Geo.instanced(dome4(0.02, 0.025, 0.02), M.tint, bees));
    jitter(g, r, 0.95, 1.06);
    return finish(g, 'beehive', 0.66, 0.66, skep ? 0.82 : 1.1);
  };

  /** scarecrow({seed}) — cross frame, straw head, sagging shirt */
  Props.scarecrow = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 80);
    const g = TOWN.group('scarecrow');
    const inner = TOWN.group('scInner');
    const h = opts.h === undefined ? r.range(1.7, 2.0) : opts.h;
    add(inner, taper(0.05, 0.038, h, 4), M.woodDark, 0, 0, 0);
    add(inner, rod(0.032, 1.0, 4), M.woodDark, -0.5, h * 0.72, 0).rotation.z = -Math.PI / 2;
    // shirt: a sagging cloth over the cross
    add(inner, gc('scShirt|' + h.toFixed(2), () => grid(5, 3, function (u, v) {
      const x = -0.42 + 0.84 * u;
      const sag = Math.sin(u * Math.PI) * 0.06;
      return [x, -v * 0.55 - sag * v, Math.sin(u * Math.PI) * 0.1 * (1 - v * 0.4)];
    }, (c) => c.set(r.pick([P.fabricRed, P.awningBlue, P.wallOchre])))), M.vc, 0, h * 0.72, 0);
    add(inner, gc('scHead', () => lathe([[0.001, 0], [0.11, 0.05], [0.13, 0.14], [0.1, 0.22], [0.001, 0.25]], 6)), M.white, 0, h * 0.76, 0);
    add(inner, gc('scHat', () => lathe([[0.24, 0], [0.2, 0.02], [0.11, 0.04], [0.12, 0.16], [0.001, 0.18]], 7)), M.wood, 0, h * 0.98, 0);
    const straw = [];
    for (let i = 0; i < 8; i++) {
      const a = r.range(0, 6.28);
      straw.push({
        p: [Math.cos(a) * 0.42 * (i < 4 ? 1 : 0.2), h * (i < 4 ? 0.71 : 0.5) + r.range(-0.02, 0.02), Math.sin(a) * 0.05],
        r: [r.range(-0.6, 0.6), a, r.range(-0.5, 0.5)], s: r.range(0.7, 1.3), c: r.pick([P.grassDry, P.wallOchre]),
      });
    }
    g.add(Geo.instanced(dome4(0.03, 0.15, 0.03), M.tint, straw));
    inner.rotation.set(r.range(-3, 3) * DEG, r.range(0, 6.28), r.range(-4, 4) * DEG);
    g.add(ground(inner));
    return finish(g, 'scarecrow', 1.05, 0.4, h + 0.2);
  };

  /** wheelbarrow({seed}) */
  Props.wheelbarrow = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 81);
    const g = TOWN.group('wheelbarrow');
    const inner = TOWN.group('wbInner');
    const trayPlan = (s) => Geo.roundRectPlan(0.6 * s, 0.9 * s, 0.12 * s, 1);
    add(inner, gc('wbTray', () => tinted(loft([
      { pts: trayPlan(0.62), y: 0 },
      { pts: trayPlan(1.0), y: 0.26 },
    ], { capTop: false }), P.metal)), M.vc, 0, 0.34, 0.05);
    const wheel = add(inner, Geo.torus(0.19, 0.045, 10, 4), M.woodDark, 0, 0.19, -0.62);
    wheel.rotation.y = Math.PI / 2;
    add(inner, rod(0.02, 0.16, 4), M.iron, 0, 0.19, -0.62).rotation.z = Math.PI / 2;
    for (let i = -1; i <= 1; i += 2) {
      const hd = add(inner, gc('wbHandle', () => Geo.mergeGeometries([
        rod(0.028, 1.5, 4), Geo.at(dome4(0.04, 0.06, 0.04), 0, 1.5, 0),
      ])), M.wood, i * 0.24, 0.3, -0.5);
      hd.rotation.x = 96 * DEG;
      add(inner, gc('wbLeg', () => plateX([[-0.03, 0], [0.03, 0], [0.025, 0.32], [-0.025, 0.32]], 0.05)), M.wood, i * 0.24, 0, 0.5);
    }
    if (r.chance(0.6)) {
      const load = [];
      for (let i = 0; i < 5; i++) {
        load.push({ p: [r.range(-0.2, 0.2), 0.56, r.range(-0.3, 0.35)], s: r.range(0.8, 1.3), r: r.range(0, 6.28), c: r.pick([P.soil, P.soilDark, P.grassDry]) });
      }
      inner.add(Geo.instanced(dome4(0.14, 0.1, 0.14), M.tint, load));
    }
    inner.rotation.y = r.range(0, 6.28);
    g.add(ground(inner));
    jitter(g, r, 0.94, 1.07);
    return finish(g, 'wheelbarrow');
  };

  /** waterTrough({seed}) — stone trough with a water surface */
  Props.waterTrough = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 82);
    const w = opts.w === undefined ? r.range(1.2, 1.8) : opts.w;
    const d = 0.62, h = 0.5;
    const g = TOWN.group('waterTrough');
    add(g, gc('troughBody|' + w.toFixed(2), () => loft([
      { pts: Geo.roundRectPlan(w * 0.94, d * 0.9, 0.1, 1), y: 0 },
      { pts: Geo.roundRectPlan(w, d, 0.11, 1), y: h },
    ], { capTop: false })), M.stone, 0, 0, 0);
    add(g, gc('troughRim|' + w.toFixed(2), () => loft([
      { pts: Geo.roundRectPlan(w * 1.03, d * 1.03, 0.12, 1), y: 0 },
      { pts: Geo.roundRectPlan(w * 0.9, d * 0.86, 0.1, 1), y: 0.07 },
    ], { capTop: true, capBottom: false })), M.stoneDark, 0, h - 0.04, 0);
    add(g, gc('troughWater|' + w.toFixed(2), () => Geo.prism(Geo.roundRectPlan(w * 0.9, d * 0.86, 0.1, 1), 0.01, { y0: 0 })), M.water, 0, h - 0.12, 0);
    add(g, gc('troughSpout', () => lathe([[0.05, 0], [0.055, 0.3], [0.04, 0.34], [0.05, 0.4]], 5)), M.brass, -w * 0.36, h - 0.06, -d * 0.3);
    g.rotation.y = r.range(-0.1, 0.1);
    jitter(g, r, 0.95, 1.06);
    return finish(g, 'waterTrough', w * 1.05, d * 1.05, h + 0.32);
  };

  /** haystack({seed}) — lumpy conical stack */
  Props.haystack = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 83);
    const R = opts.r === undefined ? r.range(0.9, 1.4) : opts.r;
    const h = opts.h === undefined ? R * r.range(1.5, 1.9) : opts.h;
    const g = TOWN.group('haystack');
    const key = 'hay|' + R.toFixed(2) + '|' + h.toFixed(2) + '|' + (opts.seed || 83);
    add(g, gc(key, () => Geo.applyVertexNoise(lathe([
      [R * 0.9, 0], [R, h * 0.24], [R * 0.92, h * 0.5], [R * 0.66, h * 0.74], [R * 0.3, h * 0.93], [0.04, h],
    ], 8), 0.06, 1.6), 0, 0, 0), M.white, 0, 0, 0);
    add(g, taper(0.04, 0.03, h + 0.3, 4), M.woodDark, 0, 0, 0);
    const tufts = [];
    for (let i = 0; i < 7; i++) {
      const a = r.range(0, 6.28), rr = r.range(R * 0.5, R * 0.95);
      tufts.push({ p: [Math.cos(a) * rr, r.range(0.02, h * 0.3), Math.sin(a) * rr], r: [r.range(-0.4, 0.4), a, r.range(-0.4, 0.4)], s: r.range(0.7, 1.4), c: r.pick([P.grassDry, P.wallOchre]) });
    }
    g.add(Geo.instanced(dome4(0.05, 0.2, 0.05), M.tint, tufts));
    return finish(g, 'haystack', R * 2.1, R * 2.1, h + 0.3);
  };

  /**
   * washingLine({a, b, seed, count}) — clothes on a sagging line that
   * sway gently (ONE shared laundry ticker for every garment).
   * a / b are measured FROM THE GROUP ORIGIN (absolute-point factory).
   */
  Props.washingLine = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 84);
    const a = opts.a || [-2.2, 2.6, 0], b = opts.b || [2.2, 2.4, 0];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const count = opts.count === undefined ? U.clamp(Math.round(len / 0.75), 2, 8) : opts.count;
    const sag = opts.sag === undefined ? Math.max(0.16, len * 0.06) : opts.sag;
    const g = TOWN.group('washingLine');
    const cat = Geo.catenary(a, b, sag, 0.014, 6);
    g.add(mesh(cat.geo, M.woodDark));
    const pegs = [];
    for (let i = 0; i < count; i++) {
      const t = (i + 0.6) / (count + 0.2);
      const px = U.lerp(a[0], b[0], t), pz = U.lerp(a[2], b[2], t);
      const py = U.lerp(a[1], b[1], t) - Math.sin(t * Math.PI) * sag;
      const cw = r.range(0.34, 0.5), ch = r.range(0.36, 0.68);
      const col = r.pick([P.fabricWhite, P.wallSky, P.fabricRed, P.wallRose, P.awningCream, P.wallMint]);
      const pivot = TOWN.group('garment');
      pivot.position.set(px, py - 0.03, pz);
      const cloth = mesh(gc('laundry|' + cw.toFixed(2) + '|' + ch.toFixed(2) + '|' + col, () => grid(3, 3, function (u, v) {
        const x = -cw / 2 + cw * u;
        const flare = 1 + 0.12 * v;
        return [x * flare, -v * ch, Math.sin(u * Math.PI) * 0.06 + Math.sin(v * 3) * 0.04];
      }, (c) => c.set(col))), M.vc);
      pivot.add(cloth);
      pegs.push({ p: [px - cw * 0.4, py - 0.02, pz], s: 1, c: P.woodLight || P.wood });
      pegs.push({ p: [px + cw * 0.4, py - 0.02, pz], s: 1, c: P.wood });
      g.add(addSway(pivot, r.range(0.03, 0.07), r.range(1.1, 1.7), (opts.seed || 84) + i));
    }
    g.add(Geo.instanced(boardUp(0.03, 0.09, 0.02), M.tint, pegs));
    g.userData.absolutePoints = true;
    g.userData.a = a; g.userData.b = b;
    return finish(g, 'washingLine', Math.abs(b[0] - a[0]) + 0.5, Math.abs(b[2] - a[2]) + 0.5, Math.max(a[1], b[1]));
  };
  /* ============================================================
     10 · MONUMENTS
     ============================================================ */

  /** statue({seed, kind:'figure'|'obelisk'|'urn'|'lion', h}) */
  Props.statue = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 91);
    const kind = opts.kind || r.pick(['figure', 'obelisk', 'urn', 'lion']);
    const H = opts.h === undefined ? r.range(2.6, 4.6) : opts.h;
    const g = TOWN.group('statue');
    const pw = U.clamp(H * 0.3, 0.7, 1.3);
    const ph = H * (kind === 'obelisk' ? 0.28 : 0.42);
    add(g, gc('stBase|' + pw.toFixed(2), () => Geo.prism(Geo.polyPlan(8, pw * 0.78, Math.PI / 8), 0.16, { y0: 0 })), M.stoneDark, 0, 0, 0);
    add(g, plinthGeo(pw, ph, 6), M.stone, 0, 0.15, 0);
    const top = 0.15 + ph;
    const fh = H - top;

    if (kind === 'obelisk') {
      add(g, gc('obl|' + fh.toFixed(2), () => Geo.taperTower(pw * 0.3, pw * 0.09, fh * 0.86, 4, { steps: 3 })), M.stone, 0, top, 0);
      add(g, gc('oblCap|' + fh.toFixed(2), () => Geo.pyramidRoof(pw * 0.19, pw * 0.19, fh * 0.16, { over: 0 })), M.stoneDark, 0, top + fh * 0.86, 0);
    } else if (kind === 'urn') {
      add(g, gc('urn|' + fh.toFixed(2), () => lathe([
        [pw * 0.3, 0], [pw * 0.22, fh * 0.08], [pw * 0.34, fh * 0.24], [pw * 0.42, fh * 0.5],
        [pw * 0.34, fh * 0.72], [pw * 0.42, fh * 0.8], [pw * 0.36, fh * 0.88], [pw * 0.16, fh],
      ], 8)), M.stone, 0, top, 0);
      for (let i = -1; i <= 1; i += 2) {
        const hd = add(g, gc('urnHandle|' + fh.toFixed(2), () => plateX([
          [0.0, 0.0], [pw * 0.24, fh * 0.05], [pw * 0.22, fh * 0.2], [0.0, fh * 0.24],
        ], 0.05)), M.stone, i * pw * 0.32, top + fh * 0.58, 0);
        hd.rotation.y = i > 0 ? 0 : Math.PI;
      }
      add(g, gc('urnFin', () => dome4(pw * 0.1, pw * 0.12, pw * 0.1)), M.stone, 0, top + fh, 0);
    } else if (kind === 'lion') {
      const bl = fh * 1.5, bw = fh * 0.5;
      const plan = function (s) { return ellipsePlan(bw * 0.5 * s, bl * 0.5 * s, 6); };
      add(g, gc('lionBody|' + fh.toFixed(2), () => loft([
        { pts: plan(0.8), y: 0 }, { pts: plan(1.0), y: fh * 0.34 }, { pts: plan(0.72), y: fh * 0.58 },
      ])), M.stone, 0, top, 0);
      add(g, gc('lionHead|' + fh.toFixed(2), () => lathe([
        [0.001, 0], [fh * 0.2, fh * 0.06], [fh * 0.24, fh * 0.2], [fh * 0.14, fh * 0.32], [0.001, fh * 0.34],
      ], 6)), M.stone, 0, top + fh * 0.5, bl * 0.34);
      const mane = [];
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        mane.push({ p: [Math.cos(a) * fh * 0.2, top + fh * 0.62 + Math.sin(a) * fh * 0.16, bl * 0.3], r: [Math.PI / 2, 0, a], s: 1 });
      }
      g.add(Geo.instanced(dome4(fh * 0.08, fh * 0.1, fh * 0.08), M.stoneDark, mane));
      for (let i = -1; i <= 1; i += 2) {
        add(g, gc('lionPaw|' + fh.toFixed(2), () => lathe([[fh * 0.12, 0], [fh * 0.13, fh * 0.06], [fh * 0.08, fh * 0.1]], 5)), M.stone, i * bw * 0.28, top, bl * 0.42);
      }
      add(g, rod(fh * 0.05, bl * 0.4, 4), M.stone, 0, top + fh * 0.3, -bl * 0.44).rotation.x = -0.7;
    } else {
      // stylised cloaked figure
      add(g, gc('figBody|' + fh.toFixed(2), () => lathe([
        [fh * 0.24, 0], [fh * 0.26, fh * 0.04], [fh * 0.2, fh * 0.3], [fh * 0.16, fh * 0.62],
        [fh * 0.19, fh * 0.72], [fh * 0.12, fh * 0.8],
      ], 7)), M.stone, 0, top, 0);
      add(g, gc('figCloak|' + fh.toFixed(2), () => grid(5, 3, function (u, v) {
        const a = -Math.PI * 0.62 + u * Math.PI * 1.24;
        const rr = fh * (0.17 + 0.09 * v) * (1 + 0.1 * Math.sin(u * Math.PI * 3));
        return [Math.cos(a) * rr, -v * fh * 0.62, Math.sin(a) * rr - fh * 0.03];
      }, (c) => c.set(P.stoneDark))), M.vc, 0, top + fh * 0.76, 0);
      add(g, gc('figHead|' + fh.toFixed(2), () => lathe([
        [0.001, 0], [fh * 0.09, fh * 0.03], [fh * 0.1, fh * 0.1], [fh * 0.07, fh * 0.15], [0.001, fh * 0.17],
      ], 6)), M.stone, 0, top + fh * 0.8, 0);
      const arm = add(g, rod(fh * 0.045, fh * 0.4, 4), M.stone, fh * 0.13, top + fh * 0.6, 0.02);
      arm.rotation.z = -0.5; arm.rotation.x = -0.35;
      add(g, gc('figScroll', () => dome4(fh * 0.06, fh * 0.05, fh * 0.06)), M.stoneDark, fh * 0.3, top + fh * 0.92, 0.1);
    }
    g.userData.statueKind = kind;
    // a couchant lion is long in Z: declare the real depth so the layout spaces it
    return finish(g, 'statue', pw * 1.6, kind === 'lion' ? Math.max(pw * 1.6, fh * 1.9) : pw * 1.6, undefined);
  };

  /** monumentPlaque({seed}) — angled bronze plaque on a stone block */
  Props.monumentPlaque = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 92);
    const g = TOWN.group('monumentPlaque');
    add(g, gc('plqBase', () => loft([
      { pts: Geo.roundRectPlan(1.0, 0.5, 0.07, 1), y: 0 },
      { pts: Geo.roundRectPlan(0.88, 0.42, 0.06, 1), y: 0.62 },
    ])), M.stone, 0, 0, 0);
    const pl = add(g, board(0.62, 0.42, 0.05), M.brass, 0, 0.62, 0.03);
    pl.rotation.x = -32 * DEG;
    const face = add(g, gc('plqFace', () => new T.PlaneGeometry(0.54, 0.34)), matPaper(), 0, 0.638, 0.062);
    face.rotation.x = -32 * DEG;
    g.rotation.y = r.range(-0.1, 0.1);
    jitter(g, r, 0.94, 1.08);
    return finish(g, 'monumentPlaque', 1.04, 0.58, 0.78);
  };

  /** noticeBoard({seed}) — village notice board with a little roof */
  Props.noticeBoard = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 93);
    const g = TOWN.group('noticeBoard');
    const w = 1.1, h = 1.75;
    for (let i = -1; i <= 1; i += 2) {
      add(g, gc('nbPost', () => lathe([[0.07, 0], [0.055, 0.1], [0.05, h], [0.03, h + 0.06]], 4)), M.timber, i * (w / 2 - 0.06), 0, 0);
    }
    add(g, Geo.chamferBox(w, 0.72, 0.07, 0.02), M.woodDark, 0, 1.16, 0.02);
    add(g, gc('nbPaper', () => new T.PlaneGeometry(0.44, 0.6)), matPaper(), -0.22, 1.16, 0.07);
    add(g, gc('nbPaper2', () => new T.PlaneGeometry(0.4, 0.5)), matPaper(), 0.24, 1.2, 0.07).rotation.z = r.range(-0.06, 0.06);
    add(g, gc('nbRoof', () => Geo.gableRoof(w + 0.2, 0.34, 0.16, { over: 0.08, thick: 0.04 })), M.woodDark, 0, h - 0.06, 0.02);
    jitter(g, r, 0.95, 1.06);
    return finish(g, 'noticeBoard', w + 0.3, 0.42, h + 0.14);
  };

  /** milestone({seed}) — painted way-stone */
  Props.milestone = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 94);
    const g = TOWN.group('milestone');
    add(g, gc('mileStone', () => lathe([
      [0.2, 0], [0.21, 0.06], [0.19, 0.42], [0.17, 0.5], [0.1, 0.56], [0.001, 0.57],
    ], 6)), M.stone, 0, 0, 0);
    add(g, gc('mileFace', () => new T.PlaneGeometry(0.24, 0.18)), matPaper(), 0, 0.34, 0.178);
    add(g, gc('mileCap', () => lathe([[0.19, 0], [0.16, 0.03], [0.001, 0.05]], 6)), M.white, 0, 0.5, 0);
    g.rotation.y = r.range(-0.15, 0.15);
    jitter(g, r, 0.9, 1.12);
    return finish(g, 'milestone', 0.42, 0.42, 0.6);
  };

  /** sundial({seed}) — dial plate on a turned pedestal */
  Props.sundial = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 95);
    const g = TOWN.group('sundial');
    add(g, gc('sdBase', () => Geo.prism(Geo.polyPlan(8, 0.36, Math.PI / 8), 0.1, { y0: 0 })), M.stoneDark, 0, 0, 0);
    add(g, gc('sdStem', () => lathe([
      [0.24, 0], [0.2, 0.06], [0.11, 0.16], [0.09, 0.62], [0.13, 0.74], [0.2, 0.82], [0.22, 0.86],
    ], 8)), M.stone, 0, 0.09, 0);
    add(g, gc('sdPlate', () => lathe([[0.001, 0], [0.26, 0], [0.26, 0.035], [0.001, 0.035]], 10)), M.brass, 0, 0.95, 0);
    add(g, gc('sdFace', () => new T.CircleGeometry(0.24, 12)), matClock(), 0, 0.988, 0).rotation.x = -Math.PI / 2;
    const gn = add(g, gc('sdGnomon', () => plateX([[-0.16, 0.0], [0.14, 0.0], [-0.16, 0.2]], 0.02)), M.brass, 0, 0.99, 0);
    gn.rotation.y = r.range(-0.05, 0.05);
    jitter(g, r, 0.94, 1.07);
    return finish(g, 'sundial', 0.72, 0.72, 1.2);
  };

  /* ============================================================
     11 · ROOFTOP & UTILITY
     ============================================================ */

  /**
   * rooftopKit({seed, w, d, count}) — dressing for flat / mansard roofs.
   * ORIGIN AT THE ROOF-PLATE CENTRE; every item sits on y = 0, so just
   * place the group at the roof deck height.
   */
  Props.rooftopKit = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 101);
    const w = opts.w === undefined ? 6 : opts.w;
    const d = opts.d === undefined ? 6 : opts.d;
    const count = opts.count === undefined ? U.clamp(Math.round(w * d / 8), 3, 8) : opts.count;
    const g = TOWN.group('rooftopKit');
    const kinds = r.shuffle(['tank', 'ac', 'vent', 'chimney', 'antenna', 'ac', 'vent', 'laundry', 'crate']);
    const used = [];
    const spot = function (rad) {
      for (let t = 0; t < 12; t++) {
        const x = r.range(-w / 2 + rad, w / 2 - rad), z = r.range(-d / 2 + rad, d / 2 - rad);
        let ok = true;
        for (let i = 0; i < used.length; i++) {
          if (Math.hypot(used[i][0] - x, used[i][1] - z) < used[i][2] + rad) { ok = false; break; }
        }
        if (ok) { used.push([x, z, rad]); return [x, z]; }
      }
      const fx = r.range(-w / 2 + rad, w / 2 - rad), fz = r.range(-d / 2 + rad, d / 2 - rad);
      used.push([fx, fz, rad]);
      return [fx, fz];
    };
    let maxH = 0.3;
    for (let i = 0; i < count; i++) {
      const kind = kinds[i % kinds.length];
      if (kind === 'tank') {
        const p = spot(0.72);
        const t = TOWN.group('tank');
        t.position.set(p[0], 0, p[1]);
        t.rotation.y = r.range(0, 6.28);
        for (let k = 0; k < 4; k++) {
          const a = (k / 4) * Math.PI * 2 + 0.4;
          add(t, rod(0.045, 0.62, 4), M.iron, Math.cos(a) * 0.34, 0, Math.sin(a) * 0.34);
        }
        add(t, gc('rkTank', () => lathe([
          [0.001, 0], [0.44, 0.03], [0.46, 0.08], [0.46, 0.86], [0.4, 0.94], [0.24, 1.0], [0.001, 0.98],
        ], 8)), M.metal, 0, 0.6, 0);
        add(t, gc('rkTankBand', () => Geo.ring(0.46, 0.49, 0.05, 8)), M.iron, 0, 1.05, 0);
        g.add(t);
        maxH = Math.max(maxH, 1.62);
      } else if (kind === 'ac') {
        const p = spot(0.45);
        const t = TOWN.group('ac');
        t.position.set(p[0], 0, p[1]);
        t.rotation.y = r.range(0, 6.28);
        add(t, gc('rkAc', () => Geo.chamferBox(0.72, 0.5, 0.56, 0.04)), M.metal, 0, 0.27, 0);
        add(t, gc('rkAcFan', () => Geo.ring(0.1, 0.22, 0.03, 8)), M.iron, 0, 0.53, 0);
        add(t, board(0.8, 0.05, 0.12), M.iron, 0, 0.02, 0);
        for (let k = 0; k < 4; k++) add(t, board(0.62, 0.02, 0.03), M.iron, 0, 0.12 + k * 0.09, 0.29);
        g.add(t);
        maxH = Math.max(maxH, 0.6);
      } else if (kind === 'vent') {
        const p = spot(0.3);
        add(g, gc('rkVent', () => lathe([
          [0.16, 0], [0.17, 0.04], [0.11, 0.08], [0.1, 0.36], [0.16, 0.42], [0.14, 0.48], [0.06, 0.5],
        ], 6)), M.metal, p[0], 0, p[1]);
        maxH = Math.max(maxH, 0.5);
      } else if (kind === 'chimney') {
        const p = spot(0.42);
        add(g, gc('rkStack', () => Geo.prism(Geo.polyPlan(6, 0.28, 0.2), 1.1, { y0: 0 })), M.stoneDark, p[0], 0, p[1]);
        add(g, gc('rkStackCap', () => lathe([[0.3, 0], [0.28, 0.06], [0.2, 0.1], [0.22, 0.16], [0.14, 0.34], [0.09, 0.34]], 6)), M.stone, p[0], 1.06, p[1]);
        maxH = Math.max(maxH, 1.45);
      } else if (kind === 'antenna') {
        const p = spot(0.25);
        const t = TOWN.group('antenna');
        t.position.set(p[0], 0, p[1]);
        add(t, gc('rkAntBase', () => Geo.prism(Geo.polyPlan(4, 0.16), 0.08, { y0: 0 })), M.iron, 0, 0, 0);
        add(t, taper(0.028, 0.012, 1.9, 4), M.iron, 0, 0.06, 0);
        const bars = [];
        for (let k = 0; k < 4; k++) bars.push({ p: [0, 0.9 + k * 0.28, 0], r: [0, r.range(0, 1), 0], s: 1 - k * 0.16 });
        t.add(Geo.instanced(boardUp(0.5, 0.018, 0.018), M.iron, bars));
        t.rotation.z = r.range(-0.03, 0.03);
        g.add(t);
        maxH = Math.max(maxH, 2.0);
      } else if (kind === 'laundry') {
        const p = spot(0.9);
        g.add(Props.washingLine({
          seed: (opts.seed || 101) + i * 3,
          a: [p[0] - 0.9, 1.25, p[1]], b: [p[0] + 0.9, 1.15, p[1] + r.range(-0.3, 0.3)], count: 3,
        }));
        for (let k = -1; k <= 1; k += 2) add(g, taper(0.04, 0.028, 1.3, 4), M.iron, p[0] + k * 0.9, 0, p[1]);
        maxH = Math.max(maxH, 1.35);
      } else {
        const p = spot(0.35);
        const c = Props.crate({ seed: (opts.seed || 101) + i * 7, s: r.range(0.42, 0.58) });
        c.position.set(p[0], 0, p[1]);
        g.add(c);
        maxH = Math.max(maxH, 0.6);
      }
    }
    // a pigeon or two on the parapet
    const birds = [];
    for (let i = 0; i < 2; i++) {
      birds.push({
        p: [r.range(-w / 2 + 0.2, w / 2 - 0.2), 0.02, r.pick([-1, 1]) * (d / 2 - 0.15)],
        r: [0, r.range(0, 6.28), 0], s: r.range(0.9, 1.2), c: r.pick([P.stone, P.metal, P.white]),
      });
    }
    g.add(Geo.instanced(geoUp('pigeon', octa(0.07, 0.06, 0.11), 0.06), M.tint, birds));
    return finish(g, 'rooftopKit', w, d, maxH);
  };

  /** powerPole({seed, h}) — timber pole, crossarms, insulators */
  Props.powerPole = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 102);
    const h = opts.h === undefined ? r.range(5.5, 7.5) : opts.h;
    const g = TOWN.group('powerPole');
    add(g, gc('ppPole|' + h.toFixed(2), () => lathe([
      [0.16, 0], [0.14, 0.3], [0.11, h * 0.7], [0.095, h], [0.06, h + 0.08],
    ], 6)), M.timber, 0, 0, 0);
    const arms = [[h - 0.35, 1.7], [h - 0.95, 1.25]];
    const ins = [];
    for (let k = 0; k < arms.length; k++) {
      const ay = arms[k][0], aw = arms[k][1];
      add(g, board(aw, 0.12, 0.11), M.timber, 0, ay, 0);
      for (let i = -1; i <= 1; i++) {
        if (i === 0 && k === 1) continue;
        ins.push({ p: [i * aw * 0.42, ay + 0.06, 0], s: 1, c: P.glass });
      }
      for (let i = -1; i <= 1; i += 2) {
        const br = add(g, gc('ppBrace', () => plateX([[0.0, 0.0], [0.4, 0.0], [0.36, 0.05], [0.0, 0.4]], 0.05)), M.timber, i * 0.1, ay - 0.42, 0);
        br.rotation.y = i > 0 ? Math.PI / 2 : -Math.PI / 2;
      }
    }
    g.add(Geo.instanced(gc('ppIns', () => lathe([[0.055, 0], [0.04, 0.07], [0.03, 0.13]], 5)), M.tint, ins));
    add(g, gc('ppCan', () => lathe([[0.001, 0], [0.16, 0.03], [0.17, 0.42], [0.13, 0.46], [0.001, 0.44]], 6)), M.metal, 0.24, h - 2.1, 0);
    const steps = [];
    for (let i = 0; i < 5; i++) steps.push({ p: [i % 2 ? 0.1 : -0.1, 1.2 + i * 0.42, 0], r: [0, 0, Math.PI / 2], s: 1 });
    g.add(Geo.instanced(rod(0.016, 0.24, 4), M.iron, steps));
    return finish(g, 'powerPole', 1.8, 0.42, h + 0.1);
  };

  /**
   * wires({a, b, count, sag}) — catenary cables.
   * a / b are measured FROM THE GROUP ORIGIN (absolute-point factory).
   */
  Props.wires = function (opts) {
    opts = opts || {};
    const a = opts.a || [0, 6.2, 0], b = opts.b || [12, 6.0, 0];
    const count = opts.count === undefined ? 2 : U.clamp(opts.count | 0, 1, 4);
    const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const sag = opts.sag === undefined ? Math.max(0.25, len * 0.05) : opts.sag;
    const g = TOWN.group('wires');
    const dx = b[0] - a[0], dz = b[2] - a[2];
    const nl = Math.hypot(dx, dz) || 1;
    const px = -dz / nl, pz = dx / nl;               // perpendicular offset
    for (let i = 0; i < count; i++) {
      const o = (i - (count - 1) / 2) * 0.7;
      const dy = i === 2 ? -0.55 : 0;
      const cat = Geo.catenary(
        [a[0] + px * o, a[1] + dy, a[2] + pz * o],
        [b[0] + px * o, b[1] + dy, b[2] + pz * o], sag, 0.018, 4);
      g.add(mesh(cat.geo, M.iron));
    }
    g.userData.absolutePoints = true;
    g.userData.a = a; g.userData.b = b;
    return finish(g, 'wires', Math.abs(dx) + 0.4, Math.abs(dz) + 0.4, Math.max(a[1], b[1]));
  };

  /** streetDrain({seed}) — kerb gully with an iron grate */
  Props.streetDrain = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 103);
    const g = TOWN.group('streetDrain');
    add(g, gc('drainSurround', () => Geo.prism(Geo.roundRectPlan(0.66, 0.44, 0.05, 1), 0.06, { y0: -0.03 })), M.stoneDark, 0, 0, 0);
    add(g, gc('drainFrame', () => Geo.chamferBox(0.5, 0.05, 0.32, 0.015)), M.iron, 0, 0.02, 0);
    const bars = [];
    for (let i = 0; i < 5; i++) bars.push({ p: [-0.18 + i * 0.09, 0.02, 0], s: 1 });
    g.add(Geo.instanced(boardUp(0.045, 0.035, 0.28), M.iron, bars));
    g.rotation.y = r.range(-0.05, 0.05);
    jitter(g, r, 0.95, 1.06);
    return finish(g, 'streetDrain', 0.68, 0.46, 0.06);
  };

  /** manhole({seed}) — cast-iron cover */
  Props.manhole = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 104);
    const g = TOWN.group('manhole');
    add(g, gc('mhRim', () => lathe([[0.001, 0], [0.34, 0], [0.35, 0.03], [0.3, 0.045], [0.001, 0.04]], 12)), M.iron, 0, 0, 0);
    const studs = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + r.range(0, 0.2);
      studs.push({ p: [Math.cos(a) * 0.19, 0.04, Math.sin(a) * 0.19], s: 1 });
    }
    g.add(Geo.instanced(dome4(0.035, 0.018, 0.035), M.metal, studs));
    jitter(g, r, 0.94, 1.08);
    return finish(g, 'manhole', 0.7, 0.7, 0.06);
  };

  /** cobbleAccent({seed, w, d, count}) — a patch of setts (instanced) */
  Props.cobbleAccent = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 105);
    const w = opts.w === undefined ? 1.6 : opts.w;
    const d = opts.d === undefined ? 1.2 : opts.d;
    const count = opts.count === undefined ? 24 : opts.count;
    const g = TOWN.group('cobbleAccent');
    const tr = [];
    const cols = [P.cobble, P.stone, P.stoneDark, P.rock, P.stoneWarm];
    for (let i = 0; i < count; i++) {
      tr.push({
        p: [r.range(-w / 2, w / 2), 0, r.range(-d / 2, d / 2)],
        r: [0, r.range(0, 6.28), 0],
        s: [r.range(0.85, 1.25), r.range(0.6, 1.1), r.range(0.85, 1.25)],
        c: r.pick(cols),
      });
    }
    g.add(Geo.instanced(dome4(0.12, 0.05, 0.1), M.tint, tr, { castShadow: false }));
    return finish(g, 'cobbleAccent', w + 0.24, d + 0.24, 0.06);
  };

  /** stackedTiles({seed, count}) — a pile of roof tiles by a building */
  Props.stackedTiles = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 106);
    const count = opts.count === undefined ? 12 : opts.count;
    const g = TOWN.group('stackedTiles');
    add(g, board(0.62, 0.05, 0.42), M.timber, 0, 0.025, 0);
    const tile = gc('tile', () => grid(3, 1, function (u, v) {
      return [-0.18 + 0.36 * u, Math.sin(u * Math.PI) * 0.055, -0.14 + 0.28 * v];
    }, (c) => c.set(0xffffff)));
    const tr = [];
    for (let i = 0; i < count; i++) {
      const lay = (i / 6) | 0;
      tr.push({
        p: [r.range(-0.05, 0.05) + lay * 0.04, 0.06 + (i % 6) * 0.055, r.range(-0.04, 0.04)],
        r: [0, r.range(-0.1, 0.1), 0], s: 1, c: r.pick([P.roofTerracotta, P.roofRust, P.roofRed]),
      });
    }
    g.add(Geo.instanced(tile, M.tint, tr));
    g.rotation.y = r.range(-0.3, 0.3);
    jitter(g, r, 0.94, 1.08);
    return finish(g, 'stackedTiles', 0.68, 0.48, 0.1 + Math.min(6, count) * 0.055);
  };

  /* ============================================================
     12 · SMALL VEHICLES
     ============================================================ */

  function wheelAt(parent, R, tube, x, y, z, spokes, mat) {
    const w = add(parent, gc('wheel|' + R.toFixed(3) + '|' + tube.toFixed(3), () => Geo.torus(R, tube, 10, 4)), mat, x, y, z);
    w.rotation.y = Math.PI / 2;
    if (spokes) {
      const tr = [];
      for (let i = 0; i < spokes; i++) tr.push({ p: [x, y, z], r: [0, Math.PI / 2, (i / spokes) * Math.PI], s: 1 });
      parent.add(Geo.instanced(gc('spoke|' + R.toFixed(3), () => board(0.016, (R - tube) * 2, 0.016)), M.metal, tr));
    }
    return w;
  }

  /** bicycle({seed}) — leans at ~8°, wheels from Geo.torus */
  Props.bicycle = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 111);
    const g = TOWN.group('bicycle');
    const inner = TOWN.group('bikeInner');
    const R = 0.33;
    wheelAt(inner, R, 0.026, 0, R, -0.52, 3, M.iron);
    wheelAt(inner, R, 0.026, 0, R, 0.52, 3, M.iron);
    const col = opts.color || r.pick([P.roofBlue, P.fabricRed, P.roofGreen, P.roofPlum]);
    const frame = gc('bikeFrame|' + col, function () {
      const parts = [];
      const bar = function (p0, p1, rr) {
        const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]);
        const gg = rod(rr, len, 4, true).clone();
        const q = new T.Quaternion().setFromUnitVectors(
          new T.Vector3(0, 1, 0),
          new T.Vector3(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]).normalize());
        gg.applyMatrix4(new T.Matrix4().makeRotationFromQuaternion(q));
        gg.translate(p0[0], p0[1], p0[2]);
        return gg;
      };
      parts.push(bar([0, R, 0.52], [0, 0.74, 0.12], 0.022));
      parts.push(bar([0, 0.74, 0.12], [0, 0.64, -0.4], 0.02));
      parts.push(bar([0, 0.64, -0.4], [0, R, -0.52], 0.02));
      parts.push(bar([0, R, 0.52], [0, 0.42, 0.02], 0.02));
      parts.push(bar([0, 0.42, 0.02], [0, 0.64, -0.4], 0.02));
      return tinted(Geo.mergeGeometries(parts), col);
    });
    inner.add(mesh(frame, M.vc));
    add(inner, gc('bikeSaddle', () => dome4(0.06, 0.05, 0.14)), M.woodDark, 0, 0.76, 0.11);
    add(inner, rod(0.016, 0.42, 4, true), M.metal, -0.21, 0.68, -0.42).rotation.z = -Math.PI / 2;
    for (let i = -1; i <= 1; i += 2) {
      add(inner, gc('bikeGrip', () => dome4(0.024, 0.07, 0.024)), M.woodDark, i * 0.19, 0.68, -0.42).rotation.z = i * Math.PI / 2;
    }
    add(inner, gc('bikeBasket', () => Geo.prism(Geo.polyPlan(6, 0.14), 0.16, { y0: 0, cap: false })), M.wood, 0, 0.5, -0.5);
    add(inner, gc('bikeChain', () => Geo.ring(0.05, 0.075, 0.014, 8)), M.metal, 0.03, 0.42, 0.02).rotation.x = Math.PI / 2;
    inner.rotation.z = r.range(6, 10) * DEG * r.sign();
    inner.rotation.y = r.range(0, 6.28);
    g.add(ground(inner));
    jitter(g, r, 0.96, 1.04);
    return finish(g, 'bicycle');
  };

  /** scooter({seed}) — little scooter, headlight halo */
  Props.scooter = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 112);
    const col = opts.color || r.pick([P.awningBlue, P.fabricRed, P.awningYellow, P.wallMint]);
    const g = TOWN.group('scooter');
    const inner = TOWN.group('scootInner');
    const R = 0.16;
    wheelAt(inner, R, 0.045, 0, R, -0.42, 0, M.iron);
    wheelAt(inner, R, 0.045, 0, R, 0.42, 0, M.iron);
    add(inner, gc('scDeck|' + col, () => tinted(Geo.chamferBox(0.24, 0.08, 1.0, 0.03), col)), M.vc, 0, 0.19, 0);
    add(inner, gc('scBody|' + col, () => tinted(loft([
      { pts: ellipsePlan(0.12, 0.26, 6), y: 0 },
      { pts: ellipsePlan(0.14, 0.3, 6), y: 0.3 },
      { pts: ellipsePlan(0.09, 0.2, 6), y: 0.44 },
    ]), col)), M.vc, 0, 0.22, 0.3);
    add(inner, rod(0.026, 0.66, 4), M.metal, 0, 0.2, -0.42).rotation.x = -0.22;
    add(inner, rod(0.016, 0.44, 4, true), M.metal, -0.22, 0.82, -0.5).rotation.z = -Math.PI / 2;
    add(inner, gc('scSeat', () => dome4(0.11, 0.09, 0.2)), M.woodDark, 0, 0.66, 0.26);
    add(inner, gc('scLamp', () => lathe([[0.001, 0], [0.055, 0.02], [0.05, 0.07], [0.001, 0.08]], 6)), M.lamp, 0, 0.74, -0.52).rotation.x = -Math.PI / 2;
    const ha = TOWN.halo(P.headlight, 1.4, { max: 0.5 });
    ha.position.set(0, 0.74, -0.6); inner.add(ha);
    inner.rotation.y = r.range(0, 6.28);
    inner.rotation.z = r.range(-4, 4) * DEG;
    g.add(ground(inner));
    jitter(g, r, 0.95, 1.05);
    return finish(g, 'scooter');
  };

  /** cart({seed}) — two-wheeled hand cart */
  Props.cart = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 113);
    const g = TOWN.group('cart');
    const inner = TOWN.group('cartInner');
    const R = 0.34;
    for (let i = -1; i <= 1; i += 2) wheelAt(inner, R, 0.04, i * 0.52, R, 0, 3, M.woodDark);
    add(inner, rod(0.03, 1.04, 4), M.iron, -0.52, R, 0).rotation.z = -Math.PI / 2;
    for (let i = 0; i < 4; i++) add(inner, board(0.94, 0.045, 0.19), M.wood, 0, 0.5, -0.3 + i * 0.2);
    for (let i = -1; i <= 1; i += 2) add(inner, board(0.94, 0.24, 0.04), M.woodDark, 0, 0.62, i * 0.4);
    add(inner, board(0.06, 0.24, 0.84), M.woodDark, -0.46, 0.62, 0);
    for (let i = -1; i <= 1; i += 2) {
      const hd = add(inner, gc('cartHandle', () => Geo.mergeGeometries([
        rod(0.03, 1.1, 4), Geo.at(dome4(0.045, 0.06, 0.045), 0, 1.1, 0),
      ])), M.wood, i * 0.34, 0.48, 0.42);
      hd.rotation.x = 82 * DEG;
    }
    add(inner, gc('cartLeg', () => plateX([[-0.035, 0], [0.035, 0], [0.03, 0.46], [-0.03, 0.46]], 0.06)), M.wood, 0, 0, -0.42);
    if (r.chance(0.7)) {
      const load = [];
      for (let i = 0; i < 4; i++) {
        load.push({ p: [r.range(-0.3, 0.3), 0.54, r.range(-0.25, 0.25)], r: [0, r.range(0, 6.28), 0], s: r.range(0.8, 1.1), c: r.pick([P.grassDry, P.wood, P.flowerOrange, P.leafDeep]) });
      }
      inner.add(Geo.instanced(dome4(0.16, 0.14, 0.16), M.tint, load));
    }
    inner.rotation.y = r.range(0, 6.28);
    g.add(ground(inner));
    jitter(g, r, 0.95, 1.05);
    return finish(g, 'cart');
  };

  /** luggage({seed, count}) — a little stack of cases & trunks */
  Props.luggage = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 114);
    const count = opts.count === undefined ? r.int(2, 3) : opts.count;
    const g = TOWN.group('luggage');
    let y = 0, maxW = 0;
    for (let i = 0; i < count; i++) {
      const w = r.range(0.42, 0.62) * (1 - i * 0.1), h = r.range(0.16, 0.24), d = r.range(0.28, 0.4);
      const col = r.pick([P.woodDark, P.wallBrick, P.timber, P.roofPlum]);
      const cs = TOWN.group('case');
      cs.position.set(r.range(-0.05, 0.05), y, r.range(-0.04, 0.04));
      cs.rotation.y = r.range(-0.3, 0.3);
      add(cs, gc('caseBody|' + w.toFixed(2) + '|' + h.toFixed(2) + '|' + d.toFixed(2) + '|' + col, () => tinted(Geo.chamferBox(w, h, d, 0.035), col)), M.vc, 0, h / 2, 0);
      for (let k = -1; k <= 1; k += 2) add(cs, board(0.05, h + 0.01, d + 0.01), M.brass, k * w * 0.28, h / 2, 0);
      add(cs, gc('caseHandle|' + h.toFixed(2), () => Geo.ring(0.045, 0.062, 0.02, 6)), M.brass, 0, h + 0.005, 0).rotation.x = Math.PI / 2;
      g.add(cs);
      y += h;
      maxW = Math.max(maxW, w);
    }
    return finish(g, 'luggage', maxW * 1.15, maxW * 0.85, y + 0.05);
  };

  /* ============================================================
     13 · demo() — every factory in a row along X
     ============================================================ */
  const DEMO = [
    ['streetLamp', { style: 'classic' }], ['streetLamp', { style: 'twin' }],
    ['streetLamp', { style: 'wall' }], ['streetLamp', { style: 'modern' }],
    ['streetLamp', { style: 'festoon' }],
    ['lanternString', { a: [-3, 3.4, 0], b: [3, 3.5, 0] }],
    ['torch', {}], ['braziers', {}],
    ['bench', { style: 'park' }], ['bench', { style: 'stone' }], ['bench', { style: 'log' }],
    ['picnicTable', {}], ['chairSet', {}], ['cafeTerrace', { w: 6, d: 4 }], ['parasol', {}],
    ['busStop', {}], ['tramShelter', {}], ['phoneBooth', {}], ['kiosk', {}],
    ['postbox', {}], ['trashBin', {}], ['hydrant', {}], ['bollard', {}], ['clockPost', {}],
    ['marketStall', { goods: 'fruit' }], ['marketStall', { goods: 'fish' }],
    ['shopSign', { style: 'hanging', text: 'BAKERY', glow: true }],
    ['shopSign', { style: 'board', atlas: 3 }], ['shopSign', { style: 'projecting', atlas: 4 }],
    ['awning', { style: 'straight' }], ['awning', { style: 'scallop' }], ['awning', { style: 'dutch' }],
    ['blackboard', {}], ['banner', {}],
    ['bunting', { a: [-3, 3.1, 0], b: [3, 3.3, 0] }], ['flagPole', {}],
    ['fountain', {}], ['well', {}],
    ['mooringPost', {}], ['cleat', {}], ['buoy', {}], ['lifeRing', {}], ['fishingNet', {}],
    ['lobsterTrap', {}], ['fishCrate', {}], ['barrel', {}], ['crate', {}], ['crateStack', {}],
    ['sackPile', {}], ['anchorProp', {}], ['rowboatProp', {}], ['dockLadder', {}],
    ['capstan', {}], ['harbourCrane', {}],
    ['fence', { len: 6, style: 'picket' }], ['fence', { len: 6, style: 'iron' }],
    ['fence', { len: 6, style: 'rail' }], ['fence', { len: 6, style: 'stone' }],
    ['fence', { len: 6, style: 'wattle' }],
    ['gate', {}], ['archTrellis', {}], ['pergola', {}], ['planter', {}], ['flowerBox', {}],
    ['treeGuard', {}], ['birdhouse', {}], ['beehive', {}], ['scarecrow', {}], ['wheelbarrow', {}],
    ['waterTrough', {}], ['haystack', {}],
    ['washingLine', { a: [-2, 2.6, 0], b: [2, 2.5, 0] }],
    ['statue', { kind: 'figure' }], ['statue', { kind: 'obelisk' }],
    ['statue', { kind: 'urn' }], ['statue', { kind: 'lion' }],
    ['monumentPlaque', {}], ['noticeBoard', {}], ['milestone', {}], ['sundial', {}],
    ['rooftopKit', { w: 6, d: 5 }], ['powerPole', {}],
    ['wires', { a: [-5, 6, 0], b: [5, 6.2, 0] }],
    ['streetDrain', {}], ['manhole', {}], ['cobbleAccent', {}], ['stackedTiles', {}],
    ['bicycle', {}], ['scooter', {}], ['cart', {}], ['luggage', {}],
  ];

  /** demo({seed}) — every factory laid out along X, spaced footprint + 1.5 */
  Props.demo = function (opts) {
    opts = opts || {};
    const g = TOWN.group('propsDemo');
    let x = 0, maxD = 1, maxH = 1;
    for (let i = 0; i < DEMO.length; i++) {
      const name = DEMO[i][0], o = DEMO[i][1] || {};
      const f = Props[name];
      if (typeof f !== 'function') continue;
      const p = f(Object.assign({ seed: (opts.seed || 1) + i * 3 + 1 }, o));
      const fp = p.userData.footprint || { w: 1, d: 1 };
      x += fp.w / 2;
      p.position.x = x;
      g.add(p);
      x += fp.w / 2 + 1.5;
      maxD = Math.max(maxD, fp.d);
      maxH = Math.max(maxH, p.userData.height || 1);
    }
    return finish(g, 'demo', x, maxD, maxH);
  };

  /** the factory catalogue, for tooling / layout code */
  Props.catalogue = DEMO.map(function (e) { return e[0]; })
    .filter(function (v, i, a) { return a.indexOf(v) === i; });

  console.log('[TOWN] props ready · ' + Props.catalogue.length + ' factories');
  /* ============================================================
     ---- probe results ----  (tools/probe.sh, headless Chromium/WebGL,
     three r152, measured on the final version of this file)

     ./tools/probe.sh --files js/world/props.js --eval "return Object.keys(TOWN.Props)"
       -> 75 exports (73 factories + demo + catalogue), errors: []

     mandated expression set — every one ok:true, errors: [], no nan, 0 lights
     expr                                tri    mat spr inst  minY    footprint
     streetLamp({seed:1})                378     4   2    0   0.000   0.62x0.62 h4.24
     streetLamp({seed:2,style:'twin'})   448     4   4    0   0.000   1.35x0.60 h4.64
     bench({seed:3})                     136     2   0    0   0.000   1.92x0.52 h0.55
     marketStall({seed:4})               588     9   2   19   0.000   2.91x2.66 h2.51
     fountain({seed:5})                  524     4   0    8   0.000   5.10x5.10 h1.86
     well({seed:6})                      344     6   0    0   0.000   1.73x1.43 h2.67
     fence({seed:7,len:10})              456     3   0   19  -0.003  10.00x0.20 h1.35
     flagPole({seed:8})                  186     5   0    0   0.000   0.62x0.62 h6.75
     statue({seed:9})                    134     2   0    0   0.000   1.34x1.34 h3.15
     rooftopKit({seed:10,w:8,d:8})      1066     8   0   12  -0.005   8.00x8.00 h1.97
     bicycle({seed:11})                  352     5   0    6   0.000   1.37x1.21 h0.79
     harbourCrane({seed:12})             472     4   0    0   0.000   2.15x6.69 h7.55
     cafeTerrace({seed:13,w:6,d:4})     1210     6   0   16  -0.004   6.70x4.70 h2.32
     demo()                            22380    23  33  455  -0.03    315.9 x 7.8, h7.47
     (the probe `size` of a lamp-bearing prop is inflated by its additive
      halo sprites; userData.footprint always carries the true mesh extent)

     sweep: 73 factories x 5..7 seeds = 511 checks -> 0 NaN, 0 missing
     userData, every minY >= -0.032, every small prop <= 460 tris, every
     "big" prop (fountain / crane / kiosk / marketStall) <= 1210 tris.
     per-factory tri ranges (5 seeds): streetLamp 144-448 · lanternString 328
     · torch 98 · braziers 166 · bench 96-220 · picnicTable 192 · chairSet 384
     · parasol 162 · cafeTerrace 1210 · busStop 430 · tramShelter 432-438
     · phoneBooth 370 · kiosk 562 · postbox 208 · trashBin 210-254 · hydrant 204
     · bollard 34-112 · clockPost 412 · marketStall 588-1082 · shopSign 90-136
     · awning 94-154 · blackboard 108 · banner 78 · bunting 185 · flagPole 186
     · fountain 524 (tiers:3 = 676) · well 344 · mooringPost 188 · cleat 138
     · buoy 174 · lifeRing 196 · fishingNet 108 · lobsterTrap 188 · fishCrate 108
     · barrel 160 · crate 68 · crateStack 272-340 · sackPile 216-432
     · anchorProp 134 · rowboatProp 198 · dockLadder 128-176 · capstan 304
     · harbourCrane 472 · fence(len 10) 140-456 (~45 tris/m) · gate 216-240
     · archTrellis 356 · pergola(len 4) 440 · planter 108 · flowerBox 64
     · treeGuard 236 · birdhouse 132-140 · beehive 124-156 · scarecrow 198
     · wheelbarrow 192-212 · waterTrough 110 · haystack 124 · washingLine 420
     · statue 134-272 · monumentPlaque 46 · noticeBoard 100 · milestone 86
     · sundial 212 · rooftopKit 508-1066 · powerPole 364 · wires 240
     · streetDrain 124 · manhole 128 · cobbleAccent 96 · stackedTiles 84
     · bicycle 352 · scooter 292 · cart 388-404 · luggage 184-276
     (fence / pergola / cafeTerrace / rooftopKit are linear or composite
      assets: their cost scales with len / count, quoted at the defaults.)

     materials: demo() = 23 distinct (<= 25).  17 shared base materials +
     5 Tex.canvas-mapped ones (clock, chalk, paper, net, sign atlas) + 1
     Mat.neon; a custom shopSign({text}) adds one mapped material per text.
     lights: 0 in every factory (halos only).  demo(): 33 halo sprites.

     halos: streetLamp({seed:1}) -> sprites: 2, TOWN.halos registered: 2
     (globe halo 2.4 + wide light pool size 5 @ max 0.25).  TOWN.updateHalos(1,t)
     makes 100% of registered halos visible; Mat.lamp emissiveIntensity 2.4.

     tickers: exactly 5, shared by every instance —
     props.flags · props.laundry · props.swing · props.hooks · props.flame
     ({always:true}).  TOWN.Ticker.update(0.016, t, true) x5..8 and x5 with
     allowDynamic = false: no console error, none auto-disabled.  Verified the
     flag tip moves (dz 0.18), laundry sways, hanging signs swing and crane
     hooks sway — and all of it still animates after Geo.mergeStatic()
     (94 meshes -> 34, sprites + InstancedMeshes preserved).

     winding audit (signed volume for closed meshes + radial-outward test for
     surfaces of revolution; controls: box / prism / lathe / torus / barrel):
     0 inside-out solids.  The 7 remaining "REVOLVE" hits are the interior
     faces of folded bowl profiles (brazier basket, scale pans) — correct by
     construction.

     assembly audit (a mesh whose grown bbox touches no sibling = a part that
     flew off; mesh bounds far outside userData.footprint = a part rotated or
     placed wrongly).  Found and fixed: the twin lamp's crossarm + scrolls
     (plateX puts its profile in Z, so the ironwork had to be turned 90 deg to
     meet the lanterns on X), the power-pole crossarm braces (same cause), the
     kiosk magazine racks (pulled in and carried on two timber stiles), the
     tram-shelter lamp (now hung off the roof on a stem) and the couchant
     lion's declared depth.  Remaining hits are by design: separate wires,
     scattered rooftop items, terrace planters, fence rails that only touch
     instanced pickets, and the flag / open gate leaf reaching past the base
     footprint.

     renders: 8 offscreen renders (6 daylight sets + 2 night sets) with
     shadows on -> errors: [].  Night frames: mean luminance 70/255 with
     warm 255-luminance cores at every lamp, so the lamps do bloom on.

     NOTE: js/core/geo.js changed mid-session (fromQuads now emits every face
     reversed).  All geometry here is authored for THAT convention and was
     re-audited against it; if fromQuads flips again, re-run the audit.
     ============================================================ */

})(window);
