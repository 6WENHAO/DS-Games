/* =============================================================
   buildings_home.js — 箱庭小镇 · residential & commercial buildings
   exposes TOWN.BuildingsHome

   cottage · townhouse · rowTerrace · villa · apartment · hotel
   greenhouse · shed · boathouse · cafe · tower_house · demo

   Design notes
   ------------
   * Every mass is a chamferBox / taperBox / prism — never a bare box.
     Bare boxes appear only as sills, bands, planks, bars, steps, signs.
   * Every roof comes from a Geo.*Roof helper with an eaves overhang and
     a roof-family colour, plus a gable tympanum where the helper leaves
     the end open.
   * Windows: pane recessed 0.06 behind the wall face inside a splayed
     reveal (or a full Geo.frame on hero openings) + sill (+ shutters,
     muntins, lintels).  Mat.window group is picked per opening so the
     night lighting staggers room by room; shop glazing uses group 0
     (the earliest-lit group).
   * Material budget: the module keeps a small pool of wall/roof colours
     and expresses variety through *construction* (half-timbering, brick
     banding, stone quoins, plinth material) instead of new materials.
     Flowers/foliage ride one InstancedMesh with per-instance colour.
   ============================================================= */
(function (global) {
  'use strict';

  const T = global.THREE;
  const TOWN = global.TOWN;
  const U = TOWN.U, Geo = TOWN.Geo, Mat = TOWN.Mat, P = TOWN.Palette, Tex = TOWN.Tex;
  const BH = TOWN.BuildingsHome = {};

  /* =========================================================
     0 · palette pools + material accessors   (≤ 25 materials)
     ========================================================= */
  const WALLS = [P.wallCream, P.wallSand, P.wallPeach, P.wallMint, P.wallSky];
  const ROOFS = [P.roofRust, P.roofSlate, P.roofBlue, P.roofGreen];
  const WIN_UP = [2, 4, 6, 7];   // staggered night groups (6 never lights)
  const WIN_LOW = 0;             // ground floor / shop glazing: lit earliest
  const LEAF = [P.leafDeep, P.hedge, P.leafOlive, P.leafSpring];
  const BLOOM = [P.flowerRed, P.flowerYellow, P.flowerWhite, P.flowerPink, P.flowerOrange];
  const CONSTR = ['plain', 'timber', 'brick', 'quoin'];

  function mWall(c) { return Mat.std(c, { rough: 0.88 }); }
  function mRoof(c) { return Mat.std(c, { rough: 0.8, flat: true }); }
  function mTrim() { return Mat.std(P.white, { rough: 0.7 }); }
  function mStone() { return Mat.std(P.stone, { rough: 0.9, flat: true }); }
  function mBrick() { return mWall(P.wallBrick); }
  function mWood() { return Mat.std(P.wood, { rough: 0.82 }); }
  function mTimber() { return Mat.std(P.timber, { rough: 0.85 }); }
  function mIron() { return Mat.std(P.metalDark, { rough: 0.5, metal: 0.5 }); }
  function mGlass() { return Mat.std(P.glass, { transparent: true, opacity: 0.4, rough: 0.15 }); }
  function mAwning() { return Mat.std(P.awningRed, { rough: 0.78 }); }
  function mGlobe() { return Mat.lamp(P.lampWarm); }
  function mWin(g) { return Mat.window(g); }

  /* =========================================================
     1 · one tiny canvas atlas: house numbers + shop signs
     ========================================================= */
  const CELL = {
    n0: 0, n1: 1, n2: 2, n3: 3, n4: 4, n5: 5, n6: 6, n7: 7,
    cafe: 8, hotel: 9, board: 10, bakery: 11, rooms: 12, fleurs: 13, no1: 14, year: 15,
  };
  let _atlasMat = null;
  function atlasMat() {
    if (_atlasMat) return _atlasMat;
    const tex = Tex.canvas('bh_atlas', 256, 256, function (g, w) {
      const c = w / 4;
      const num = ['3', '7', '11', '14', '21', '5', '9', '17'];
      const txt = ['CAFÉ', 'HOTEL', "SOUPE", 'BAKERY', 'ROOMS', 'FLEURS', 'No.1', '1897'];
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      for (let i = 0; i < 16; i++) {
        const x = (i % 4) * c, y = Math.floor(i / 4) * c;
        if (i < 8) {
          g.fillStyle = '#efe6d0'; g.fillRect(x, y, c, c);
          g.strokeStyle = '#33424d'; g.lineWidth = 3;
          g.strokeRect(x + 5, y + 5, c - 10, c - 10);
          g.fillStyle = '#33424d';
          g.font = 'bold ' + Math.round(c * 0.46) + 'px sans-serif';
          g.fillText(num[i], x + c * 0.5, y + c * 0.54);
        } else {
          const dark = (i === 10);
          g.fillStyle = dark ? '#2b2f2c' : '#f3ead6';
          g.fillRect(x, y, c, c);
          g.strokeStyle = dark ? '#cbc4ad' : '#7a5a3c';
          g.lineWidth = 2.5;
          g.strokeRect(x + 4, y + 4, c - 8, c - 8);
          g.fillStyle = dark ? '#e8e2cf' : '#6b4a2f';
          g.font = 'bold ' + Math.round(c * 0.2) + 'px serif';
          g.fillText(txt[i - 8], x + c * 0.5, y + c * 0.42);
          g.strokeStyle = dark ? '#9fb08f' : '#a98a63';
          g.lineWidth = 2;
          for (let k = 0; k < 3; k++) {
            g.beginPath();
            g.moveTo(x + c * 0.22, y + c * 0.58 + k * c * 0.11);
            g.lineTo(x + c * (0.62 + 0.06 * k), y + c * 0.58 + k * c * 0.11);
            g.stroke();
          }
        }
      }
    });
    _atlasMat = Mat.std(0xffffff, { map: tex, rough: 0.8, name: 'bh_atlas' });
    return _atlasMat;
  }

  /* =========================================================
     2 · geometry cache + micro builders
     ========================================================= */
  const GC = new Map();
  function gc(key, make) {
    let g = GC.get(key);
    if (g === undefined) { g = make(); GC.set(key, g); }
    return g;
  }
  const f2 = (n) => (Math.round(n * 100) / 100).toFixed(2);
  const key = function () {
    let s = '';
    for (let i = 0; i < arguments.length; i++) {
      const a = arguments[i];
      s += (typeof a === 'number' ? f2(a) : String(a)) + '_';
    }
    return s;
  };
  /** cached plain box — details only (sills, bands, planks, bars, steps) */
  const bx = (w, h, d) => Geo.box(w, h, d);

  function put(parent, geo, mat, x, y, z, ry) {
    if (!geo) return null;
    const m = TOWN.mesh(geo, mat, x || 0, y || 0, z || 0);
    if (ry) m.rotation.y = ry;
    parent.add(m);
    return m;
  }

  /** chamfered mass (cached) */
  function massG(w, h, d, c) {
    return gc(key('cb', w, h, d, c || 0.12), () => Geo.chamferBox(w, h, d, c || 0.12));
  }
  /** battered mass (cached) */
  function taperG(w, h, d, s) {
    return gc(key('tb', w, h, d, s), () => Geo.taperBox(w, h, d, s, s));
  }
  /** flat plane (cached) */
  function planeG(w, h) {
    return gc(key('pn', w, h), () => new T.PlaneGeometry(w, h));
  }
  /** open-ended cylinder standing on y=0 (cached) */
  function pipeG(r, h, sides) {
    return gc(key('cy', r, h, sides || 5), () => {
      const g = new T.CylinderGeometry(r, r, h, sides || 5, 1, true);
      g.translate(0, h / 2, 0);
      return g;
    });
  }

  /**
   * splayed window reveal (+ optional projecting sill) as ONE geometry:
   * outer rim on the wall face, inner rim `t` behind it.  8 triangles for
   * the reveal, 6 for the sill — every opening gets a real shadow line
   * for a fraction of the cost of four boxes.
   */
  function revealG(w, h, t, sill) {
    return gc(key('rv', w, h, t, sill ? 1 : 0), () => {
      const W = w / 2, H = h / 2, iw = Math.max(0.05, W - 0.06), ih = Math.max(0.05, H - 0.06);
      const v = [
        [-W, -H, 0], [W, -H, 0], [W, H, 0], [-W, H, 0],
        [-iw, -ih, -t], [iw, -ih, -t], [iw, ih, -t], [-iw, ih, -t],
      ];
      const f = [[0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]];
      if (sill) {
        const sw = W + 0.14, sy = -H - 0.015, sy2 = sy - 0.1, sz = 0.17, bz = -0.06;
        const b = v.length;
        v.push([-sw, sy, sz], [sw, sy, sz], [sw, sy, bz], [-sw, sy, bz],
          [-sw, sy2, sz], [sw, sy2, sz], [sw, sy2, bz], [-sw, sy2, bz]);
        f.push([b, b + 1, b + 2, b + 3]);             // weathered top
        f.push([b + 4, b + 5, b + 1, b]);             // drip face
        f.push([b + 7, b + 6, b + 5, b + 4]);         // underside
      }
      return Geo.fromQuads(v, f);
    });
  }

  /** atlas plate: a quad whose UVs pick one cell of the sign atlas */
  function plateG(w, h, cell) {
    return gc(key('pl', w, h, cell), () => {
      const g = new T.PlaneGeometry(w, h);
      const col = cell % 4, row = Math.floor(cell / 4);
      const u0 = col / 4, u1 = u0 + 0.25, v1 = 1 - row / 4, v0 = v1 - 0.25;
      const uv = g.attributes.uv;
      uv.setXY(0, u0, v1); uv.setXY(1, u1, v1);
      uv.setXY(2, u0, v0); uv.setXY(3, u1, v0);
      uv.needsUpdate = true;
      return g;
    });
  }

  /**
   * gable tympanum — the triangular wall the gableRoof helper leaves
   * open at its ±X ends.  `shift` moves the apex in Z (mono-pitch).
   */
  function gableWallG(d, h, t, shift) {
    return gc(key('gw', d, h, t, shift), () => {
      const D = d / 2, x0 = -t / 2, x1 = t / 2, s = shift || 0;
      const v = [
        [x0, 0, -D], [x1, 0, -D], [x1, 0, D], [x0, 0, D],
        [x0, h, s], [x1, h, s],
      ];
      return Geo.fromQuads(v, [
        [0, 3, 4], [1, 5, 2],           // ±X faces
        [1, 0, 4, 5], [3, 2, 5, 4],     // slopes
        [0, 1, 2, 3],                   // underside
      ]);
    });
  }

  /* =========================================================
     3 · detail kit — one instanced mesh per building for the
         greenery, one for repeated balcony balusters
     ========================================================= */
  function newKit() { return { plants: [], bars: [] }; }
  function buildKit(g, k) {
    if (k.plants.length) {
      g.add(Geo.instanced(gc('blob', () => new T.TetrahedronGeometry(0.16, 0)),
        mTrim(), k.plants, { castShadow: false }));
    }
    if (k.bars.length) {
      g.add(Geo.instanced(gc('bar', () => bx(0.05, 1, 0.05)), mIron(), k.bars));
    }
  }
  function leaf(k, x, y, z, s, col) {
    k.plants.push({ p: [x, y, z], s: [s, s * 1.15, s], r: (x + z) * 0.7, c: col });
  }

  /* =========================================================
     4 · facade parts
     ========================================================= */

  /**
   * addWindow(parent, o)
   * o: {x,y,z, w,h, ry, grp, rich, sill, shutters, muntin:[c,r], lintel, cool}
   * Built facing +Z then rotated about Y by o.ry.
   */
  function addWindow(parent, o) {
    const g = new T.Group();
    g.position.set(o.x || 0, o.y || 0, o.z || 0);
    if (o.ry) g.rotation.y = o.ry;
    const w = o.w, h = o.h, rec = 0.06, trim = mTrim();
    put(g, planeG(Math.max(0.2, w - 0.16), Math.max(0.2, h - 0.16)),
      mWin(o.grp === undefined ? 4 : o.grp), 0, 0, -rec);
    if (o.rich) {
      put(g, gc(key('fr', w, h), () => Geo.frame(w, h, 0.1, 0.13)), trim, 0, 0, 0.015);
      if (o.sill !== false) put(g, bx(w + 0.28, 0.1, 0.2), trim, 0, -h / 2 - 0.06, 0.055);
    } else {
      put(g, revealG(w, h, rec, o.sill !== false), trim, 0, 0, 0);
    }
    if (o.muntin) {
      put(g, gc(key('mu', w, h, o.muntin[0], o.muntin[1]),
        () => Geo.muntins(w - 0.2, h - 0.2, o.muntin[0], o.muntin[1], 0.045, 0.05)),
        trim, 0, 0, -rec + 0.03);
    }
    if (o.lintel) put(g, bx(w + 0.3, 0.11, 0.15), mStone(), 0, h / 2 + 0.07, 0.04);
    if (o.shutters) {
      const sg = bx(w * 0.5, h * 0.94, 0.05);
      put(g, sg, mTimber(), -(w * 0.76), 0, 0.055);
      put(g, sg, mTimber(), (w * 0.76), 0, 0.055);
    }
    parent.add(g);
    return g;
  }

  function addDoor(parent, o) {
    const g = new T.Group();
    g.position.set(o.x || 0, 0, o.z || 0);
    if (o.ry) g.rotation.y = o.ry;
    const w = o.w || 1.05, h = o.h || 2.15;
    put(g, revealG(w + 0.2, h + 0.16, 0.09, false), mTrim(), 0, (h + 0.16) / 2, 0);
    put(g, bx(w, h, 0.08), o.mat || mWood(), 0, h / 2, -0.05);
    put(g, bx(w * 0.58, h * 0.26, 0.03), mTrim(), 0, h * 0.7, -0.005);
    if (o.fanlight) put(g, planeG(w * 0.7, 0.3), mWin(WIN_LOW), 0, h - 0.22, -0.02);
    put(g, bx(0.09, 0.09, 0.09), mIron(), w * 0.3, h * 0.47, -0.02);
    if (o.step !== false) put(g, bx(w + 0.55, 0.14, 0.55), mStone(), 0, 0.07, 0.26);
    parent.add(g);
    return g;
  }

  /** projecting striped awning (tilts down toward +Z) */
  function addAwning(parent, o) {
    const g = new T.Group();
    g.position.set(o.x || 0, o.y, o.z);
    g.rotation.x = 0.3;
    if (o.ry) g.rotation.y = o.ry;
    const w = o.w, dp = o.d || 1.15;
    put(g, taperG(w, 0.07, dp, 1), mAwning(), 0, 0, dp / 2);
    const st = gc(key('stp', dp), () => {
      const p = new T.PlaneGeometry(0.17, dp);
      p.rotateX(-Math.PI / 2);
      return p;
    });
    for (let i = -1; i <= 1; i++) put(g, st, mTrim(), i * w * 0.28, 0.078, dp / 2);
    put(g, bx(w, 0.22, 0.05), mAwning(), 0, -0.09, dp);
    parent.add(g);
    return g;
  }

  /** hanging sign on a wrought bracket */
  function addSign(parent, o) {
    const g = new T.Group();
    g.position.set(o.x || 0, o.y, o.z);
    if (o.ry) g.rotation.y = o.ry;
    put(g, bx(0.06, 0.06, 0.62), mIron(), 0, 0.36, 0.31);
    put(g, bx(0.05, 0.34, 0.05), mIron(), 0, 0.19, 0.56);
    const w = o.w || 0.95, h = o.h || 0.5;
    put(g, bx(w, h, 0.07), mWood(), 0, -0.06, 0.56);
    put(g, plateG(w - 0.1, h - 0.09, o.cell === undefined ? CELL.no1 : o.cell),
      atlasMat(), 0, -0.06, 0.6);
    parent.add(g);
    return g;
  }

  function addNumber(parent, x, y, z, cell, ry) {
    const g = new T.Group();
    g.position.set(x, y, z);
    if (ry) g.rotation.y = ry;
    put(g, bx(0.32, 0.36, 0.04), mTrim(), 0, 0, 0);
    put(g, plateG(0.26, 0.3, cell), atlasMat(), 0, 0, 0.026);
    parent.add(g);
  }

  function addWallLamp(parent, x, y, z, ry) {
    const g = new T.Group();
    g.position.set(x, y, z);
    if (ry) g.rotation.y = ry;
    put(g, bx(0.07, 0.07, 0.3), mIron(), 0, 0.17, 0.15);
    put(g, bx(0.24, 0.05, 0.24), mIron(), 0, 0.13, 0.3);
    put(g, gc('globe', () => Geo.prism(Geo.polyPlan(6, 0.085), 0.2, { center: true })),
      mGlobe(), 0, 0.01, 0.3);
    const halo = TOWN.halo(P.lampWarm, 1.4);
    halo.position.set(0, 0.02, 0.32);
    g.add(halo);
    parent.add(g);
  }

  function addPipe(parent, x, z, h, ry) {
    put(parent, pipeG(0.055, h, 5), mIron(), x, 0, z);
    put(parent, bx(0.17, 0.2, 0.17), mIron(), x, h - 0.1, z);
    if (ry !== undefined) { /* orientation irrelevant for a round pipe */ }
  }

  function addWindowBox(parent, k, x, y, z, w, r) {
    put(parent, taperG(w, 0.22, 0.26, 1.1), mWood(), x, y, z + 0.13);
    const n = 4;
    for (let i = 0; i < n; i++) {
      const px = x - w * 0.36 + (w * 0.72 * i) / (n - 1);
      leaf(k, px, y + 0.2, z + 0.13, r.range(0.7, 1.0), r.pick(LEAF));
      if (r.chance(0.8)) leaf(k, px + r.range(-0.1, 0.1), y + 0.32, z + 0.16, r.range(0.35, 0.55), r.pick(BLOOM));
    }
  }

  function addClimber(parent, k, x0, z, h, r) {
    const n = r.int(7, 11);
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      leaf(k, x0 + r.bell() * 0.45, 0.25 + t * h, z + r.range(0.02, 0.14),
        r.range(0.75, 1.25), r.pick(LEAF));
    }
    if (r.chance(0.7)) leaf(k, x0 + r.bell() * 0.3, 0.2 + h * 0.6, z + 0.16, 0.5, r.pick(BLOOM));
  }

  /* --- spinning weather vanes: one shared cheap ticker ---------- */
  const vanes = [];
  let vaneTicker = false;
  function addVane(parent, x, y, z, r) {
    const g = new T.Group();
    g.position.set(x, y, z);
    put(g, pipeG(0.03, 0.62, 4), mIron(), 0, 0, 0);
    const spin = new T.Group();
    spin.position.y = 0.64;
    put(spin, bx(0.52, 0.15, 0.025), mIron(), 0.08, 0, 0);
    put(spin, bx(0.03, 0.16, 0.3), mIron(), -0.2, 0, 0);
    put(spin, bx(0.09, 0.09, 0.09), mIron(), 0, 0.1, 0);
    g.add(spin);
    parent.add(g);
    spin.userData.ph = r.range(0, 6.28);
    TOWN.markDynamic(spin);
    vanes.push(spin);
    if (!vaneTicker) {
      vaneTicker = true;
      TOWN.Ticker.add(function (dt, elapsed) {
        for (let i = 0; i < vanes.length; i++) {
          const v = vanes[i];
          v.rotation.y = v.userData.ph + Math.sin(elapsed * 0.27 + v.userData.ph) * 0.7;
        }
      }, 'bh_vanes');
    }
  }

  function addChimney(parent, o) {
    const w = o.w || 0.7, top = o.top, base = o.base || 0;
    const h = top - base;
    if (h <= 0.3) return;
    put(parent, taperG(w, h, w * 0.85, 0.9), o.mat || mBrick(), o.x, base, o.z);
    put(parent, bx(w * 1.3, 0.14, w * 1.15), mStone(), o.x, top, o.z);
    const pots = o.pots === undefined ? 1 : o.pots;
    for (let i = 0; i < pots; i++) {
      const px = o.x + (pots > 1 ? (i - (pots - 1) / 2) * w * 0.42 : 0);
      put(parent, gc(key('pot', w), () => Geo.lathe([[w * 0.17, 0], [w * 0.21, 0.06], [w * 0.17, 0.3]], 6)),
        mRoof(P.roofRust), px, top + 0.07, o.z);
    }
  }

  /** small hipped dormer, front face at +Z of its own frame */
  function addDormer(parent, o) {
    const g = new T.Group();
    g.position.set(o.x || 0, o.y, o.z);
    if (o.ry) g.rotation.y = o.ry;
    const w = o.w || 1.0, h = o.h || 0.9, dp = o.d || 0.95;
    put(g, taperG(w, h, dp, 0.97), o.wallMat, 0, 0, 0);
    put(g, gc(key('dmr', w, dp), () => Geo.pyramidRoof(w + 0.16, dp + 0.16, 0.42, { over: 0.13 })),
      o.roofMat, 0, h, 0);
    addWindow(g, {
      x: 0, y: h * 0.5, z: dp / 2, w: Math.min(0.72, w - 0.24), h: h * 0.6,
      grp: o.grp, sill: false,
    });
    parent.add(g);
  }

  /** balcony: slab + brackets + railing (instanced bars when a kit is given) */
  function addBalcony(parent, o, k) {
    const g = new T.Group();
    g.position.set(o.x || 0, o.y, o.z);
    if (o.ry) g.rotation.y = o.ry;
    const w = o.w, dp = o.d || 0.85;
    put(g, taperG(w, 0.14, dp, 0.97), mStone(), 0, 0, dp / 2);
    put(g, bx(0.13, 0.3, 0.3), mStone(), -w / 2 + 0.22, -0.24, dp * 0.35);
    put(g, bx(0.13, 0.3, 0.3), mStone(), w / 2 - 0.22, -0.24, dp * 0.35);
    if (k) {
      // repeated balustrades: instanced bars + boxed rails
      const nb = Math.max(3, Math.round(w / 0.42));
      for (let i = 0; i <= nb; i++) {
        k.bars.push({ p: [o.x - w / 2 + (w * i) / nb, o.y + 0.14 + 0.4, o.z + dp - 0.06], s: [1, 0.8, 1] });
      }
      put(g, bx(w, 0.07, 0.12), mIron(), 0, 0.94, dp - 0.06);
      put(g, bx(w, 0.05, 0.09), mIron(), 0, 0.54, dp - 0.06);
    } else {
      put(g, gc(key('rl', w), () => Geo.railing(w, 0.88, { style: 'bar', spacing: 0.95, postR: 0.035 })),
        mIron(), 0, 0.14, dp - 0.06);
      put(g, bx(0.06, 0.88, dp * 0.9), mIron(), -w / 2 + 0.04, 0.6, dp * 0.55);
      put(g, bx(0.06, 0.88, dp * 0.9), mIron(), w / 2 - 0.04, 0.6, dp * 0.55);
    }
    parent.add(g);
  }

  function addCornice(parent, w, d, y, mat) {
    put(parent, taperG(w + 0.1, 0.2, d + 0.1, 1.07), mat, 0, y, 0);
  }
  function addBand(parent, w, d, y, mat, t) {
    put(parent, bx(w + 0.14, t || 0.13, d + 0.14), mat, 0, y, 0);
  }
  function addPlinth(parent, w, d, h, mat) {
    put(parent, taperG(w + 0.18, h || 0.44, d + 0.18, 0.96), mat, 0, 0, 0);
  }
  /** corner pilaster strips reading as quoins (4 × 12 tris) */
  function addQuoins(parent, w, d, h, mat) {
    const g = taperG(0.44, h, 0.44, 0.99);
    put(parent, g, mat, -w / 2 + 0.1, 0, -d / 2 + 0.1);
    put(parent, g, mat, w / 2 - 0.1, 0, -d / 2 + 0.1);
    put(parent, g, mat, -w / 2 + 0.1, 0, d / 2 - 0.1);
    put(parent, g, mat, w / 2 - 0.1, 0, d / 2 - 0.1);
  }
  /** real alternating quoin blocks, instanced (big buildings only) */
  function addQuoinBlocks(parent, w, d, h, mat, r) {
    const list = [];
    const n = Math.min(6, Math.max(3, Math.floor(h / 1.5)));
    for (let c = 0; c < 4; c++) {
      const sx = (c % 2 ? 1 : -1), sz = (c < 2 ? 1 : -1);
      for (let i = 0; i < n; i++) {
        const y = 0.7 + i * (h - 1.2) / Math.max(1, n - 1);
        const long = (i % 2 === 0);
        list.push({
          p: [sx * (w / 2 - (long ? 0.28 : 0.16)), y, sz * (d / 2 - (long ? 0.16 : 0.28))],
          s: [long ? 0.62 : 0.36, 0.38, long ? 0.36 : 0.62],
        });
      }
    }
    parent.add(Geo.instanced(gc('qb', () => bx(1, 1, 1)), mat, list));
  }

  /* =========================================================
     5 · roofs (always via a Geo.*Roof helper, always overhung)
     ========================================================= */
  /**
   * addRoof(parent, o) -> {g, apex, slopeY(z), D, w, d}
   * o: {w,d,h,y, type:'gable'|'shed'|'hip'|'mansard'|'pyramid',
   *     col, wallMat, over, ridge:'x'|'z', shift, ends:'both'|'a'|'b'|'none',
   *     dormers, r}
   */
  function addRoof(parent, o) {
    const type = o.type || 'gable';
    const over = o.over === undefined ? 0.32 : o.over;
    const mr = mRoof(o.col);
    const wm = o.wallMat || mWall(P.wallCream);
    const r = o.r;
    const flip = o.ridge === 'z';
    const rg = new T.Group();
    rg.position.y = o.y;
    if (flip) rg.rotation.y = Math.PI / 2;
    parent.add(rg);
    const w = flip ? o.d : o.w;
    const d = flip ? o.w : o.d;
    const h = o.h;
    const D = d / 2 + over;
    const ends = o.ends === undefined ? 'both' : o.ends;
    const out = { g: rg, apex: o.y + h, type: type, D: D, w: w, d: d, over: over };

    if (type === 'gable' || type === 'shed') {
      const shift = type === 'shed' ? 1 : (o.shift || 0);
      put(rg, gc(key('gr', w, d, h, over, shift),
        () => Geo.gableRoof(w, d, h, { over: over, thick: 0.15, ridgeShift: shift })), mr);
      if (type === 'shed') {
        const az = d / 2 - 0.03;
        const hi = h * (az + D) / (2 * D);
        const gw = gableWallG(d - 0.05, hi, 0.2, az);
        if (ends === 'both' || ends === 'a') put(rg, gw, wm, -w / 2 + 0.1, 0, 0);
        if (ends === 'both' || ends === 'b') put(rg, gw, wm, w / 2 - 0.1, 0, 0);
        put(rg, bx(w + over, 0.14, 0.2), mr, 0, h - 0.07, D - 0.1);
        out.slopeY = (z) => h * (z + D) / (2 * D);
      } else {
        const az = U.clamp(shift * D, -d / 2 + 0.06, d / 2 - 0.06);
        const gw = gableWallG(d - 0.05, h - 0.03, 0.2, az);
        if (ends === 'both' || ends === 'a') put(rg, gw, wm, -w / 2 + 0.1, 0, 0);
        if (ends === 'both' || ends === 'b') put(rg, gw, wm, w / 2 - 0.1, 0, 0);
        put(rg, bx(w + over * 1.1, 0.13, 0.24), mr, 0, h - 0.06, az);
        out.slopeY = (z) => h * (D - z) / (D - shift * D);
      }
    } else if (type === 'hip') {
      put(rg, gc(key('hr', w, d, h, over),
        () => Geo.hipRoof(w, d, h, { over: over, ridge: 0.4 })), mr);
      put(rg, bx(w * 0.44, 0.12, 0.22), mr, 0, h - 0.05, 0);
      out.slopeY = (z) => h * (D - z) / D;
    } else if (type === 'mansard') {
      const knee = 0.6, inset = 0.3;
      put(rg, gc(key('mr', w, d, h, over),
        () => Geo.mansardRoof(w, d, h, { over: over, knee: knee, inset: inset, cap: 0.55 })), mr);
      out.slopeY = (z) => h * knee * U.clamp((D - z) / (D * inset), 0, 1);
      out.knee = h * knee;
    } else if (type === 'pyramid') {
      put(rg, gc(key('pr', w, d, h, over),
        () => Geo.pyramidRoof(w, d, h, { over: over })), mr);
      out.slopeY = (z) => h * (D - z) / D;
    }

    // dormers along the front slope
    const nd = o.dormers || 0;
    if (nd > 0 && out.slopeY) {
      const dw = 1.0, dd = 0.95;
      const zf = (type === 'mansard') ? D * 0.86 : d * 0.25 + dd * 0.5;
      const base = (type === 'mansard')
        ? 0.12
        : Math.max(0.1, out.slopeY(zf) - 0.22);
      const dh = (type === 'mansard') ? 0.95 : 0.85;
      const span = Math.max(0.1, w - 2.4);
      for (let i = 0; i < nd; i++) {
        const x = nd === 1 ? 0 : -span / 2 + (span * i) / (nd - 1);
        addDormer(rg, {
          x: x, y: base, z: zf - dd * 0.5, w: dw, h: dh, d: dd,
          wallMat: wm, roofMat: mr, grp: r ? r.pick(WIN_UP) : 4,
        });
      }
    }
    return out;
  }

  /* =========================================================
     6 · shopfront (recessed, glazed, stall riser, awning, sign)
     ========================================================= */
  function addShopfront(parent, o) {
    const r = o.r, w = o.w, h = o.h, zf = o.z, trim = mTrim();
    const dw = 1.0, dh = Math.min(2.2, h - 0.7);
    const doorSide = r.chance(0.5) ? 1 : -1;
    const doorX = doorSide * (w / 2 - dw / 2 - 0.55);
    const winW = U.clamp(w - dw - 2.0, 1.6, 3.6);
    const winX = -doorSide * (w / 2 - winW / 2 - 0.6);
    const riser = 0.72;
    const winH = U.clamp(h - riser - 0.95, 1.0, 2.2);

    // pierced screen wall -> genuine 0.26-thick reveal on both openings
    put(parent, gc(key('sf', w, h, winW, winH, winX, doorX, dw, dh),
      () => Geo.archWall(w, h, 0.26, [
        { x: winX, y: riser, w: winW, h: winH },
        { x: doorX, y: 0.02, w: dw, h: dh, arc: 0.4 },
      ])), o.wallMat, 0, 0, zf - 0.13);
    // stall riser + fascia
    put(parent, bx(winW + 0.34, riser, 0.13), o.riserMat || mBrick(), winX, riser / 2, zf + 0.04);
    put(parent, bx(w - 0.12, 0.24, 0.17), trim, 0, h - 0.12, zf + 0.03);
    // shopfront pilasters (also close the recess at both ends)
    put(parent, bx(0.26, h - 0.24, 0.62), o.wallMat, -w / 2 + 0.13, (h - 0.24) / 2, zf - 0.31);
    put(parent, bx(0.26, h - 0.24, 0.62), o.wallMat, w / 2 - 0.13, (h - 0.24) / 2, zf - 0.31);
    // glazing, recessed 0.3 behind the screen
    put(parent, planeG(winW - 0.06, winH - 0.06), mWin(WIN_LOW), winX, riser + winH / 2, zf - 0.32);
    put(parent, gc(key('sm', winW, winH), () => Geo.muntins(winW - 0.1, winH - 0.1, 3, 2, 0.055, 0.06)),
      trim, winX, riser + winH / 2, zf - 0.28);
    // door leaf + glazed upper panel + step
    put(parent, bx(dw - 0.08, dh - 0.1, 0.07), mWood(), doorX, (dh - 0.1) / 2, zf - 0.24);
    put(parent, planeG(dw - 0.34, dh * 0.36), mWin(WIN_LOW), doorX, dh * 0.68, zf - 0.2);
    put(parent, bx(dw + 0.55, 0.13, 0.6), mStone(), doorX, 0.065, zf + 0.2);
    put(parent, bx(0.09, 0.09, 0.09), mIron(), doorX + dw * 0.28, dh * 0.45, zf - 0.18);
    if (o.awning !== false) {
      addAwning(parent, { x: winX, y: h - 0.36, z: zf + 0.04, w: winW + 0.5, d: 1.15 });
    }
    if (o.sign !== false) {
      addSign(parent, { x: doorX + doorSide * -0.9, y: h - 0.75, z: zf + 0.02, cell: o.cell });
    }
    return { doorX: doorX, winX: winX, winW: winW, riser: riser, winH: winH };
  }

  /* =========================================================
     7 · finalise: honest footprint / height / kind
     ========================================================= */
  function meshBox(root) {
    root.updateMatrixWorld(true);
    const box = new T.Box3(), b = new T.Box3();
    root.traverse(function (o) {
      if (!o.isMesh || !o.geometry) return;
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      if (!o.geometry.boundingBox) return;
      b.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);
      box.union(b);
    });
    return box;
  }
  function finalize(g, kind) {
    const b = meshBox(g);
    const w = b.max.x - b.min.x, d = b.max.z - b.min.z, hh = b.max.y;
    g.userData.footprint = {
      w: +(isFinite(w) ? w : 1).toFixed(2),
      d: +(isFinite(d) ? d : 1).toFixed(2),
    };
    g.userData.height = +(isFinite(hh) ? hh : 1).toFixed(2);
    g.userData.kind = kind;
    g.userData.minY = +(isFinite(b.min.y) ? b.min.y : 0).toFixed(3);
    return g;
  }

  /* =========================================================
     8 · the shared row-house / townhouse body
     ========================================================= */
  /**
   * houseUnit(o) -> THREE.Group (origin = footprint centre, y = 0)
   * o: {r, w, d, wallH, floors, roofH, roofType, roofCol, wallCol,
   *     shop, constr, detail 0..2, open:{l,r}, ridge, cell}
   */
  function houseUnit(o) {
    const r = o.r;
    const w = o.w, d = o.d, zf = d / 2;
    const g = TOWN.group('house_unit');
    const k = newKit();
    const mw = mWall(o.wallCol), trim = mTrim();
    const detail = o.detail === undefined ? 2 : o.detail;
    const floors = o.floors;
    const shop = !!o.shop;
    const wallH = o.wallH;
    const gh = shop ? U.clamp(wallH * 0.34, 2.9, 4.0) : wallH / floors;
    const uh = wallH - gh;
    const fh = uh / Math.max(1, floors - 1);
    const open = o.open || { l: true, r: true };

    /* --- base + masses --- */
    addPlinth(g, w, d, 0.44, o.constr === 'brick' ? mBrick() : mStone());
    if (shop) {
      put(g, massG(w, gh + 0.12, d - 0.6, 0.1), mw, 0, (gh + 0.12) / 2, -0.3);
      put(g, massG(w, uh, d, 0.14), mw, 0, gh + uh / 2, 0);
    } else {
      put(g, massG(w, wallH, d, 0.14), mw, 0, wallH / 2, 0);
    }

    /* --- construction character --- */
    if (o.constr === 'brick') {
      for (let i = 1; i < floors; i++) addBand(g, w, d, gh + fh * (i - 1) - 0.08, mBrick(), 0.17);
      addBand(g, w, d, 0.5, mBrick(), 0.14);
    } else if (o.constr === 'timber' && floors >= 2) {
      const y0 = wallH - fh + 0.2, hh = fh - 0.55, tm = mTimber();
      put(g, bx(w - 0.24, 0.14, 0.09), tm, 0, y0, zf + 0.035);
      put(g, bx(w - 0.24, 0.14, 0.09), tm, 0, y0 + hh, zf + 0.035);
      for (let i = 0; i < 4; i++) {
        put(g, bx(0.13, hh, 0.08), tm, -w / 2 + 0.45 + i * ((w - 0.9) / 3), y0 + hh / 2, zf + 0.03);
      }
    } else if (o.constr === 'quoin') {
      addQuoins(g, w, d, wallH - 0.3, mStone());
      for (let i = 1; i < floors; i++) addBand(g, w, d, gh + fh * (i - 1) - 0.08, mStone(), 0.14);
    } else {
      for (let i = 1; i < floors; i++) addBand(g, w, d, gh + fh * (i - 1) - 0.08, trim, 0.13);
    }
    addCornice(g, w, d, wallH - 0.2, o.constr === 'brick' ? mStone() : trim);

    /* --- ground floor --- */
    const bays = U.clamp(Math.round(w / 1.95), 2, 3);
    const winW = U.clamp((w - 0.9) / bays - 0.42, 0.72, 1.18);
    const winH = U.clamp(fh - 1.15, 0.95, 1.6);
    let doorX = 0;
    if (shop) {
      const sf = addShopfront(g, {
        r: r, w: w, h: gh, z: zf, wallMat: mw,
        riserMat: o.constr === 'brick' ? mStone() : mBrick(), cell: o.cell,
      });
      doorX = sf.doorX;
    } else {
      doorX = (bays === 2 ? -1 : 1) * (w / 2 - 0.95) * (r.chance(0.5) ? 1 : -1);
      if (bays === 3) doorX = 0;
      addDoor(g, { x: doorX, z: zf, w: 1.05, h: Math.min(2.2, gh - 0.7), fanlight: r.chance(0.6) });
      for (let b = 0; b < bays; b++) {
        const x = -w / 2 + (w * (b + 0.5)) / bays;
        if (Math.abs(x - doorX) < winW * 0.75 + 0.5) continue;
        addWindow(g, {
          x: x, y: gh * 0.52, z: zf, w: winW + 0.1, h: winH + 0.1,
          grp: WIN_LOW, muntin: [2, 2], shutters: r.chance(0.4), rich: detail > 1 && r.chance(0.5),
        });
      }
    }

    /* --- upper floors --- */
    for (let f = 1; f < floors; f++) {
      const y = gh + fh * (f - 1) + fh * 0.54;
      for (let b = 0; b < bays; b++) {
        const x = -w / 2 + (w * (b + 0.5)) / bays;
        addWindow(g, {
          x: x, y: y, z: zf, w: winW, h: winH, grp: r.pick(WIN_UP),
          shutters: r.chance(0.45), muntin: r.chance(0.5) ? [2, 2] : null,
          lintel: o.constr === 'quoin',
        });
      }
      // back
      for (let b = 0; b < Math.max(1, bays - 1); b++) {
        const x = -w / 2 + (w * (b + 0.5)) / Math.max(1, bays - 1);
        addWindow(g, {
          x: x, y: y, z: -zf, ry: Math.PI, w: winW, h: winH, grp: r.pick(WIN_UP),
        });
      }
      // party-free flanks
      if (open.l && r.chance(0.65)) {
        addWindow(g, { x: -w / 2, y: y, z: r.range(-d * 0.2, d * 0.2), ry: -Math.PI / 2, w: winW * 0.8, h: winH * 0.9, grp: r.pick(WIN_UP) });
      }
      if (open.r && r.chance(0.65)) {
        addWindow(g, { x: w / 2, y: y, z: r.range(-d * 0.2, d * 0.2), ry: Math.PI / 2, w: winW * 0.8, h: winH * 0.9, grp: r.pick(WIN_UP) });
      }
    }
    if (!shop && floors >= 2) {
      for (let b = 0; b < Math.max(1, bays - 1); b++) {
        const x = -w / 2 + (w * (b + 0.5)) / Math.max(1, bays - 1);
        addWindow(g, { x: x, y: gh * 0.52, z: -zf, ry: Math.PI, w: winW, h: winH, grp: r.pick(WIN_UP) });
      }
    }

    /* --- roof --- */
    const rf = addRoof(g, {
      w: w, d: d, h: o.roofH, y: wallH, type: o.roofType, col: o.roofCol,
      wallMat: mw, over: 0.3, ridge: o.ridge || 'x', r: r,
      dormers: o.dormers === undefined ? (r.chance(0.55) ? r.int(1, 2) : 0) : o.dormers,
    });

    /* --- silhouette breakers + delights --- */
    addChimney(g, {
      x: (r.chance(0.5) ? 1 : -1) * (w / 2 - 0.55), z: r.range(-d * 0.18, d * 0.1),
      base: wallH - 0.6, top: rf.apex + r.range(0.45, 0.85), w: 0.68,
      mat: o.constr === 'brick' ? mBrick() : mStone(), pots: r.int(1, 2),
    });
    if (floors >= 2 && r.chance(detail > 1 ? 0.75 : 0.45)) {
      addBalcony(g, {
        x: 0, y: gh + fh * 0.06 + (floors > 2 && r.chance(0.4) ? fh : 0), z: zf,
        w: U.clamp(winW * 2.2, 1.4, w - 1.2), d: 0.8,
      });
    }
    addPipe(g, (w / 2 - 0.22) * (r.chance(0.5) ? 1 : -1), zf - 0.12, wallH - 0.3);
    if (detail > 0) {
      addWallLamp(g, doorX + (shop ? 1.1 : 0.85), Math.min(gh - 0.7, 2.5), zf + 0.05);
      addNumber(g, doorX + 0.75, 1.55, zf + 0.045, r.int(0, 7));
    }
    if (r.chance(0.55)) {
      addWindowBox(g, k, -w / 2 + (w * 0.5) / bays, gh + fh * 0.54 - winH / 2 - 0.16, zf + 0.02, winW * 0.95, r);
    }
    if (detail > 1 && open.l && r.chance(0.5)) addClimber(g, k, -w / 2 + 0.02, zf - 0.6, wallH * 0.7, r);
    buildKit(g, k);

    g.userData.unitH = rf.apex;
    g.userData.wallH = wallH;
    g.userData.roofType = o.roofType;
    return g;
  }

  /* =========================================================
     9 · FACTORIES
     ========================================================= */

  /* ---------- 1 · cottage --------------------------------- */
  BH.cottage = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 1);
    const floors = opts.floors || (r.chance(0.4) ? 2 : 1);
    const w = opts.w || r.range(6.1, 7.5);
    const d = opts.d || r.range(5.0, 6.3);
    const wallCol = opts.palette || r.pick(WALLS);
    const roofCol = r.pick(ROOFS);
    const mw = mWall(wallCol), trim = mTrim();
    const g = TOWN.group('cottage');
    const k = newKit();
    const wallH = floors === 2 ? r.range(4.7, 5.3) : r.range(2.7, 3.15);
    const roofH = r.range(1.55, 2.05);
    const roofType = r.pickW([['gable', 3], ['hip', 2]]);
    const constr = r.pickW([['plain', 3], ['timber', 2], ['brick', 1], ['quoin', 1]]);
    const zf = d / 2;

    addPlinth(g, w, d, 0.4, constr === 'brick' ? mBrick() : mStone());
    put(g, massG(w, wallH, d, 0.13), mw, 0, wallH / 2, 0);
    if (constr === 'timber' && floors === 2) {
      const y0 = wallH * 0.55, hh = wallH * 0.4, tm = mTimber();
      put(g, bx(w - 0.2, 0.13, 0.09), tm, 0, y0, zf + 0.03);
      for (let i = 0; i < 4; i++) put(g, bx(0.12, hh, 0.08), tm, -w / 2 + 0.5 + i * ((w - 1) / 3), y0 + hh / 2, zf + 0.03);
    } else if (constr === 'brick') {
      addBand(g, w, d, 0.55, mBrick(), 0.15);
    } else if (constr === 'quoin') {
      addQuoins(g, w, d, wallH - 0.15, mStone());
    }
    addCornice(g, w, d, wallH - 0.18, trim);

    const rf = addRoof(g, {
      w: w, d: d, h: roofH, y: wallH, type: roofType, col: roofCol, wallMat: mw,
      over: r.range(0.3, 0.42), r: r,
      dormers: floors === 2 || r.chance(0.4) ? r.int(1, 2) : 0,
    });

    // chimney with pot
    addChimney(g, {
      x: (r.chance(0.5) ? 1 : -1) * (w / 2 - r.range(0.5, 1.1)), z: r.range(-0.7, 0.4),
      base: wallH - 0.5, top: rf.apex + r.range(0.35, 0.7), w: 0.66,
      mat: constr === 'brick' ? mBrick() : mStone(), pots: r.int(1, 2),
    });

    // front porch over the door
    const doorX = r.range(-w * 0.18, w * 0.18);
    addDoor(g, { x: doorX, z: zf, w: 1.05, h: 2.1, fanlight: r.chance(0.5) });
    const pg = new T.Group();
    pg.position.set(doorX, 0, zf + 0.02);
    g.add(pg);
    put(pg, pipeG(0.075, 2.3, 5), mWood(), -0.78, 0, 0.85);
    put(pg, pipeG(0.075, 2.3, 5), mWood(), 0.78, 0, 0.85);
    const prg = new T.Group();
    prg.position.set(0, 2.3, 0.42);
    prg.rotation.y = Math.PI / 2;
    pg.add(prg);
    put(prg, gc(key('pcr'), () => Geo.gableRoof(1.15, 1.95, 0.36, { over: 0.15, thick: 0.09 })), mRoof(roofCol));
    put(prg, gableWallG(1.9, 0.33, 0.12, 0), mw, 0.5, 0, 0);

    // windows
    const wW = r.range(0.95, 1.15), wH = r.range(1.15, 1.4);
    const gy = Math.min(wallH * 0.5, 1.5);
    const sides = [-1, 1];
    for (let i = 0; i < 2; i++) {
      const x = sides[i] * (w / 2 - r.range(1.1, 1.5));
      addWindow(g, {
        x: x, y: gy, z: zf, w: wW, h: wH, grp: WIN_LOW, rich: r.chance(0.5),
        muntin: [2, 2], shutters: r.chance(0.7),
      });
      addWindowBox(g, k, x, gy - wH / 2 - 0.16, zf + 0.02, wW * 0.95, r);
    }
    addWindow(g, { x: -w / 2, y: gy, z: r.range(-1, 1), ry: -Math.PI / 2, w: wW * 0.85, h: wH * 0.9, grp: r.pick(WIN_UP), muntin: [2, 2] });
    addWindow(g, { x: w / 2, y: gy, z: r.range(-1, 1), ry: Math.PI / 2, w: wW * 0.85, h: wH * 0.9, grp: r.pick(WIN_UP) });
    addWindow(g, { x: r.range(-1.4, 1.4), y: gy, z: -zf, ry: Math.PI, w: wW, h: wH, grp: r.pick(WIN_UP) });
    if (floors === 2) {
      for (let i = 0; i < 2; i++) {
        addWindow(g, {
          x: sides[i] * (w / 2 - r.range(1.2, 1.6)), y: wallH - 1.1, z: zf,
          w: wW * 0.9, h: wH * 0.85, grp: r.pick(WIN_UP), shutters: r.chance(0.6),
        });
      }
      addWindow(g, { x: 0, y: wallH - 1.1, z: -zf, ry: Math.PI, w: wW * 0.9, h: wH * 0.85, grp: r.pick(WIN_UP) });
    }

    addWallLamp(g, doorX + 1.05, 2.25, zf + 0.04);
    addNumber(g, doorX + 0.72, 1.62, zf + 0.04, r.int(0, 7));
    addPipe(g, (w / 2 - 0.2) * r.sign(), zf - 0.15, wallH - 0.25);
    if (r.chance(0.6)) addClimber(g, k, -w / 2 + 0.05, zf - r.range(1.0, 2.2), wallH * 0.75, r);
    if (r.chance(0.45)) addVane(g, r.range(-0.6, 0.6), rf.apex + 0.1, r.range(-0.3, 0.3), r);
    buildKit(g, k);

    return finalize(g, 'cottage');
  };

  /* ---------- 2 · townhouse ------------------------------- */
  BH.townhouse = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 1);
    const floors = opts.floors || r.int(2, 4);
    const w = opts.w || r.range(5.0, 6.9);
    const d = opts.d || r.range(6.1, 7.8);
    const shop = opts.shop === undefined ? r.chance(0.45) : !!opts.shop;
    const roofType = opts.style || r.pickW([['gable', 3], ['mansard', 2], ['hip', 2]]);
    const fh = r.range(2.7, 3.1);
    const gh = shop ? r.range(3.1, 3.7) : fh;
    const wallH = gh + (floors - 1) * fh;
    const roofH = roofType === 'mansard' ? r.range(2.0, 2.6) : r.range(1.7, 2.3);
    const g = houseUnit({
      r: r, w: w, d: d, wallH: wallH, floors: floors, roofH: roofH,
      roofType: roofType, roofCol: r.pick(ROOFS), wallCol: opts.palette || r.pick(WALLS),
      shop: shop, constr: r.pick(CONSTR), detail: 2,
      open: { l: true, r: true }, cell: r.pick([CELL.bakery, CELL.fleurs, CELL.no1, CELL.cafe]),
    });
    g.name = 'townhouse';
    return finalize(g, 'townhouse');
  };

  /* ---------- 3 · rowTerrace ------------------------------ */
  /**
   * rowTerrace({seed, count, gapChance}) — a continuous street block of
   * party-wall units along X.  Adjacent ridge heights differ by ≥ 0.8 m,
   * roof type / roof colour / wall colour all change unit to unit.
   * userData.footprint covers the WHOLE row (origin = row centre).
   * userData.units[] reports each unit's local x, width and height.
   */
  BH.rowTerrace = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 1);
    const count = U.clamp(opts.count || r.int(3, 6), 2, 8);
    const gapChance = opts.gapChance === undefined ? 0.18 : opts.gapChance;
    const g = TOWN.group('rowTerrace');
    const inner = TOWN.group('units');
    g.add(inner);
    const baseD = r.range(6.4, 7.8);
    const roofTypes = ['gable', 'mansard', 'hip'];

    /* plan first so heights can be forced apart */
    const specs = [];
    let dir = r.chance(0.5) ? 1 : -1;
    let prevH = r.range(8.6, 10.4);
    for (let i = 0; i < count; i++) {
      const uw = r.range(4.7, 6.4);
      const floors = r.int(2, 4);
      const roofType = roofTypes[(i + r.int(0, 2)) % 3];
      const roofH = roofType === 'mansard' ? r.range(2.0, 2.5) : r.range(1.7, 2.25);
      let target;
      if (i === 0) target = prevH;
      else {
        target = prevH + dir * r.range(0.95, 1.9);
        if (target < 7.6 || target > 13.4) { dir = -dir; target = prevH + dir * r.range(0.95, 1.9); }
      }
      target = U.clamp(target, 7.5, 13.6);
      dir = -dir;
      const wallH = U.clamp(target - roofH, floors * 2.45, floors * 3.4);
      specs.push({
        w: uw, floors: floors, roofType: roofType, roofH: roofH, wallH: wallH,
        h: wallH + roofH,
        wallCol: WALLS[(i * 2 + r.int(0, 4)) % WALLS.length],
        roofCol: ROOFS[(i * 3 + r.int(0, 3)) % ROOFS.length],
        shop: i === 0 || i === count - 1 ? r.chance(0.8) : r.chance(0.45),
        constr: CONSTR[(i + r.int(0, 3)) % CONSTR.length],
        gap: i > 0 && r.chance(gapChance) ? r.range(0.35, 0.7) : 0,
      });
      prevH = specs[i].h;
    }
    /* guarantee the ≥0.8 m stagger and colour changes */
    for (let i = 1; i < count; i++) {
      const a = specs[i - 1], b = specs[i];
      if (Math.abs(b.h - a.h) < 0.85) {
        const s = b.h >= a.h ? 1 : -1;
        b.wallH = U.clamp(b.wallH + s * 1.05, 5.0, 12.0);
        if (Math.abs((b.wallH + b.roofH) - a.h) < 0.85) b.wallH = a.h - b.roofH - 1.05;
        b.h = b.wallH + b.roofH;
      }
      if (b.wallCol === a.wallCol) b.wallCol = WALLS[(WALLS.indexOf(a.wallCol) + 2) % WALLS.length];
      if (b.roofCol === a.roofCol) b.roofCol = ROOFS[(ROOFS.indexOf(a.roofCol) + 1) % ROOFS.length];
      if (b.roofType === a.roofType) b.roofType = roofTypes[(roofTypes.indexOf(a.roofType) + 1) % 3];
    }

    let x = 0;
    const units = [];
    for (let i = 0; i < count; i++) {
      const s = specs[i];
      x += s.gap;
      const u = houseUnit({
        r: r, w: s.w, d: baseD, wallH: s.wallH, floors: s.floors, roofH: s.roofH,
        roofType: s.roofType, roofCol: s.roofCol, wallCol: s.wallCol,
        shop: s.shop, constr: s.constr, detail: 1,
        open: { l: i === 0 || s.gap > 0, r: i === count - 1 || (specs[i + 1] && specs[i + 1].gap > 0) },
        dormers: s.roofType === 'gable' && r.chance(0.5) ? 1 : (s.roofType === 'mansard' ? r.int(1, 2) : 0),
        cell: r.pick([CELL.bakery, CELL.fleurs, CELL.no1, CELL.cafe, CELL.rooms]),
      });
      u.position.set(x + s.w / 2, 0, r.range(-0.05, 0.05));
      u.rotation.y = r.range(-1.5, 1.5) * U.DEG;
      inner.add(u);
      units.push({ x: +(x + s.w / 2).toFixed(2), w: +s.w.toFixed(2), h: +s.h.toFixed(2), roof: s.roofType });
      x += s.w;
    }
    inner.position.x = -x / 2;
    for (let i = 0; i < units.length; i++) units[i].x = +(units[i].x - x / 2).toFixed(2);

    finalize(g, 'rowTerrace');
    g.userData.units = units;
    g.userData.count = count;
    g.userData.rowHeights = units.map((u) => u.h);
    return g;
  };

  /* ---------- 4 · villa ---------------------------------- */
  BH.villa = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 1);
    const w = opts.w || r.range(9.2, 11.8);
    const d = opts.d || r.range(7.2, 9.6);
    const wallCol = opts.palette || r.pick(WALLS);
    const roofCol = r.pick(ROOFS);
    const mw = mWall(wallCol), trim = mTrim();
    const g = TOWN.group('villa');
    const k = newKit();
    const fh = r.range(3.05, 3.4);
    const wallH = fh * 2;
    const roofH = r.range(2.1, 2.7);
    const W = w / 2, D = d / 2;
    const dm = d * r.range(0.6, 0.68);            // depth of the main block
    const ww = w * r.range(0.34, 0.42);           // width of the projecting wing
    const side = r.chance(0.5) ? 1 : -1;
    const xw0 = side > 0 ? W - ww : -W;
    const xw1 = xw0 + ww;

    /* L-plan mass via Geo.prism (caps off: the roofs close the top) */
    const plan = [
      [-W, -D], [W, -D], [W, -D + dm], [xw1, -D + dm],
      [xw1, D], [xw0, D], [xw0, -D + dm], [-W, -D + dm],
    ];
    put(g, gc(key('vl', w, d, dm, ww, side, wallH),
      () => Geo.prism(plan, wallH, { y0: 0, cap: false })), mw, 0, 0, 0);
    addPlinth(g, w, dm, 0.46, mStone());
    put(g, taperG(ww + 0.18, 0.46, d - dm + 0.3, 0.96), mStone(), (xw0 + xw1) / 2, 0, (D + (-D + dm)) / 2 + 0.1);
    addQuoins(g, w, dm, wallH - 0.3, mStone());
    addBand(g, w, dm, fh - 0.1, trim, 0.15);
    addCornice(g, w, dm, wallH - 0.2, trim);

    /* hipped roof over the main block, gabled roof over the wing */
    const rf = addRoof(g, {
      w: w, d: dm, h: roofH, y: wallH, type: 'hip', col: roofCol, wallMat: mw,
      over: 0.36, r: r, dormers: r.int(1, 2),
    });
    rf.g.position.z = -D + dm / 2;
    const wrf = addRoof(g, {
      w: ww, d: d - dm + 0.6, h: roofH * 0.86, y: wallH, type: 'gable', col: roofCol,
      wallMat: mw, over: 0.34, ridge: 'z', ends: 'a', r: r,
    });
    wrf.g.position.set((xw0 + xw1) / 2, wallH, D - (d - dm) / 2 - 0.3);

    /* wing gable window + oriel bay on the main block */
    addWindow(g, {
      x: (xw0 + xw1) / 2, y: wallH + roofH * 0.32, z: D - 0.02, w: 0.9, h: 0.95,
      grp: r.pick(WIN_UP), muntin: [2, 2], sill: false,
    });
    const bayX = side > 0 ? -W + w * 0.24 : W - w * 0.24;
    const bayZ = -D + dm;
    const bayPlan = Geo.polyPlan(6, 1.05, Math.PI / 6);
    put(g, gc(key('bay', 1.05), () => Geo.prism(bayPlan, 2.5, { y0: 0, cap: false })), mw, bayX, 0.5, bayZ - 0.15);
    put(g, taperG(2.3, 0.5, 2.3, 0.9), mStone(), bayX, 0, bayZ - 0.15);
    put(g, gc(key('bayr'), () => Geo.pyramidRoof(2.0, 2.0, 0.55, { over: 0.2 })), mRoof(roofCol), bayX, 3.0, bayZ - 0.15);
    for (let i = -1; i <= 1; i++) {
      addWindow(g, {
        x: bayX + i * 0.72, y: 1.75, z: bayZ + 0.72 - Math.abs(i) * 0.36,
        ry: i * 0.9, w: 0.66, h: 1.25, grp: WIN_LOW, muntin: [2, 2],
      });
    }

    /* first-floor balcony with a proper railing */
    addBalcony(g, {
      x: side > 0 ? -W + w * 0.26 : W - w * 0.26, y: fh + 0.05, z: bayZ,
      w: r.range(2.6, 3.2), d: 0.95,
    });

    /* entrance: garden steps + door in the wing front */
    const doorX = (xw0 + xw1) / 2 + r.range(-0.3, 0.3);
    addDoor(g, { x: doorX, z: D, w: 1.15, h: 2.3, fanlight: true, step: false });
    put(g, gc(key('vst'), () => Geo.stairs(2.4, 0.52, 1.1, 3)), mStone(), doorX, 0, D + 0.55, Math.PI);
    addWallLamp(g, doorX + 1.05, 2.5, D + 0.04);
    addWallLamp(g, doorX - 1.05, 2.5, D + 0.04);
    addNumber(g, doorX + 0.78, 1.75, D + 0.045, r.int(0, 7));

    /* windows all round */
    const wW = r.range(0.95, 1.12), wH = r.range(1.35, 1.55);
    for (let f = 0; f < 2; f++) {
      const y = f * fh + fh * 0.52;
      for (let i = 0; i < 2; i++) {
        const x = (side > 0 ? -W + 0.9 : W - 0.9) + (side > 0 ? 1 : -1) * i * 1.9;
        if (f === 0 && Math.abs(x - bayX) < 1.5) continue;
        addWindow(g, {
          x: x, y: y, z: bayZ, w: wW, h: wH, grp: f === 0 ? WIN_LOW : r.pick(WIN_UP),
          shutters: r.chance(0.55), muntin: [2, 2],
        });
      }
      addWindow(g, { x: -W, y: y, z: -D + dm * 0.5, ry: -Math.PI / 2, w: wW, h: wH, grp: r.pick(WIN_UP), shutters: r.chance(0.4) });
      addWindow(g, { x: W, y: y, z: -D + dm * 0.5, ry: Math.PI / 2, w: wW, h: wH, grp: r.pick(WIN_UP), shutters: r.chance(0.4) });
      addWindow(g, { x: -w * 0.22, y: y, z: -D, ry: Math.PI, w: wW, h: wH, grp: r.pick(WIN_UP) });
      addWindow(g, { x: w * 0.22, y: y, z: -D, ry: Math.PI, w: wW, h: wH, grp: r.pick(WIN_UP) });
      addWindow(g, {
        x: side > 0 ? xw0 - 0.02 : xw1 + 0.02, y: y, z: D - (d - dm) * 0.45,
        ry: side > 0 ? -Math.PI / 2 : Math.PI / 2, w: wW * 0.85, h: wH * 0.9, grp: r.pick(WIN_UP),
      });
    }

    /* twin chimneys */
    for (let i = 0; i < 2; i++) {
      addChimney(g, {
        x: (i ? 1 : -1) * (W - r.range(0.9, 1.5)), z: -D + dm * r.range(0.35, 0.6),
        base: wallH - 0.5, top: rf.apex + r.range(0.5, 0.9), w: 0.72, mat: mStone(), pots: 2,
      });
    }
    addPipe(g, W - 0.22, bayZ - 0.2, wallH - 0.3);
    addPipe(g, -W + 0.22, bayZ - 0.2, wallH - 0.3);
    addClimber(g, k, side > 0 ? xw1 + 0.02 : xw0 - 0.02, D - (d - dm) * 0.7, wallH * 0.8, r);
    addWindowBox(g, k, bayX, 1.05, bayZ + 0.78, 1.5, r);
    buildKit(g, k);

    return finalize(g, 'villa');
  };

  /* ---------- 5 · apartment ------------------------------ */
  BH.apartment = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 1);
    const floors = U.clamp(opts.floors || r.int(4, 5), 3, 6);
    const w = opts.w || r.range(9.4, 12.8);
    const d = opts.d || r.range(9.2, 11.8);
    const wallCol = opts.palette || r.pick(WALLS);
    const roofCol = r.pick(ROOFS);
    const mw = mWall(wallCol), trim = mTrim(), stone = mStone();
    const g = TOWN.group('apartment');
    const k = newKit();
    const gh = r.range(3.4, 3.9);
    const fh = r.range(2.8, 3.0);
    const wallH = gh + (floors - 1) * fh;
    const roofH = r.range(2.3, 2.8);
    const W = w / 2, D = d / 2;
    const arcade = r.chance(0.55);

    addPlinth(g, w, d, 0.5, stone);
    put(g, massG(w, gh + 0.14, d - 1.0, 0.12), mw, 0, (gh + 0.14) / 2, -0.5);
    put(g, massG(w, wallH - gh, d, 0.18), mw, 0, gh + (wallH - gh) / 2, 0);
    addQuoinBlocks(g, w, d, wallH, stone, r);

    /* ground floor: arcade of arches, or a run of shopfronts */
    const nA = 3;
    const aw = (w - 1.6) / nA;
    if (arcade) {
      const holes = [];
      for (let i = 0; i < nA; i++) {
        holes.push({ x: -w / 2 + 0.8 + aw * (i + 0.5), y: 0.05, w: aw - 0.55, h: gh - 0.75, arc: 0.85 });
      }
      put(g, gc(key('arc', w, gh, nA, aw), () => Geo.archWall(w, gh, 0.5, holes)), mw, 0, 0, D - 0.25);
      for (let i = 0; i < nA; i++) {
        const x = -w / 2 + 0.8 + aw * (i + 0.5);
        put(g, planeG(aw - 0.7, gh - 1.5), mWin(WIN_LOW), x, (gh - 1.5) / 2 + 0.1, D - 0.95);
        put(g, bx(aw - 0.5, 0.14, 0.7), stone, x, 0.07, D - 0.6);
        put(g, bx(0.42, gh - 0.5, 0.42), stone, -w / 2 + 0.8 + aw * i, (gh - 0.5) / 2, D - 0.3);
      }
      put(g, bx(0.42, gh - 0.5, 0.42), stone, w / 2 - 0.8, (gh - 0.5) / 2, D - 0.3);
      put(g, bx(w, 0.26, 0.72), trim, 0, gh - 0.13, D - 0.28);
    } else {
      addShopfront(g, {
        r: r, w: w - 0.4, h: gh, z: D, wallMat: mw, riserMat: stone,
        cell: r.pick([CELL.bakery, CELL.fleurs, CELL.rooms]),
      });
    }
    // back door
    addDoor(g, { x: r.range(-2, 2), z: -D, ry: Math.PI, w: 1.1, h: 2.2 });

    /* string courses + cornice + parapet */
    for (let f = 1; f < floors; f++) addBand(g, w, d, gh + fh * (f - 1) - 0.1, trim, 0.16);
    addCornice(g, w, d, wallH - 0.24, trim);
    const pw = 0.24;
    put(g, taperG(w + 0.1, 0.5, pw, 0.98), stone, 0, wallH, D + 0.05 - pw / 2);
    put(g, taperG(w + 0.1, 0.5, pw, 0.98), stone, 0, wallH, -D - 0.05 + pw / 2);
    put(g, taperG(pw, 0.5, d + 0.1, 0.98), stone, W + 0.05 - pw / 2, wallH, 0);
    put(g, taperG(pw, 0.5, d + 0.1, 0.98), stone, -W - 0.05 + pw / 2, wallH, 0);

    /* windows + repeated balconies */
    const bays = U.clamp(Math.round(w / 2.3), 3, 4);
    const wW = U.clamp((w - 1.4) / bays - 0.75, 0.85, 1.15);
    const wH = U.clamp(fh - 1.25, 1.15, 1.6);
    for (let f = 1; f < floors; f++) {
      const y = gh + fh * (f - 1) + fh * 0.52;
      for (let b = 0; b < bays; b++) {
        const x = -w / 2 + (w * (b + 0.5)) / bays;
        addWindow(g, {
          x: x, y: y, z: D, w: wW, h: wH, grp: r.pick(WIN_UP),
          muntin: [2, 2], shutters: r.chance(0.3), lintel: r.chance(0.4),
        });
        if (f % 2 === 1 && b > 0 && b < bays - 1) {
          addBalcony(g, { x: x, y: y - wH / 2 - 0.2, z: D, w: wW + 0.7, d: 0.7 }, k);
        }
        addWindow(g, { x: x, y: y, z: -D, ry: Math.PI, w: wW, h: wH, grp: r.pick(WIN_UP) });
      }
      for (let s = -1; s <= 1; s += 2) {
        for (let i = 0; i < 2; i++) {
          addWindow(g, {
            x: s * W, y: y, z: (i ? 1 : -1) * d * 0.24, ry: s * Math.PI / 2,
            w: wW * 0.85, h: wH * 0.92, grp: r.pick(WIN_UP),
          });
        }
      }
    }

    /* mansard roof with dormers, vents and chimneys */
    const rf = addRoof(g, {
      w: w - 0.3, d: d - 0.3, h: roofH, y: wallH + 0.45, type: 'mansard',
      col: roofCol, wallMat: mw, over: 0.26, r: r, dormers: r.int(3, 4),
    });
    for (let i = 0; i < 2; i++) {
      addChimney(g, {
        x: (i ? 1 : -1) * (W - r.range(1.2, 2.0)), z: r.range(-d * 0.2, d * 0.2),
        base: wallH + 0.4, top: rf.apex + r.range(0.4, 0.8), w: 0.8, mat: mBrick(), pots: 2,
      });
    }
    put(g, pipeG(0.16, 0.5, 6), mIron(), r.range(-1.5, 1.5), rf.apex - 0.05, r.range(-1, 1));
    put(g, bx(0.42, 0.1, 0.42), mIron(), 0, rf.apex + 0.44, 0);

    addWallLamp(g, -w * 0.3, 2.7, D + 0.05);
    addWallLamp(g, w * 0.3, 2.7, D + 0.05);
    addNumber(g, 0, 2.9, D + 0.05, r.int(0, 7));
    addPipe(g, W - 0.25, D - 0.3, wallH - 0.3);
    addPipe(g, -W + 0.25, D - 0.3, wallH - 0.3);
    addClimber(g, k, -W + 0.05, D - 1.4, wallH * 0.45, r);
    buildKit(g, k);

    return finalize(g, 'apartment');
  };

  /* ---------- 6 · hotel ---------------------------------- */
  BH.hotel = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 1);
    const w = opts.w || r.range(13.2, 15.8);
    const d = opts.d || r.range(10.2, 12.6);
    const wallCol = opts.palette || r.pick(WALLS);
    const roofCol = r.pick(ROOFS);
    const mw = mWall(wallCol), trim = mTrim(), stone = mStone();
    const g = TOWN.group('hotel');
    const k = newKit();
    const floors = r.int(4, 5);
    const gh = r.range(3.7, 4.2);
    const fh = r.range(2.85, 3.1);
    const wallH = gh + (floors - 1) * fh;
    const roofH = r.range(2.4, 3.0);
    const W = w / 2, D = d / 2;

    addPlinth(g, w, d, 0.55, stone);
    put(g, massG(w, wallH, d, 0.2), mw, 0, wallH / 2, 0);
    // set-back attic storey behind the parapet
    put(g, gc(key('hsb', w, d), () => Geo.prism(Geo.roundRectPlan(w - 2.4, d - 2.2, 0.6, 2), 1.3, { y0: 0, cap: false })),
      mw, 0, wallH, -0.2);
    addQuoinBlocks(g, w, d, wallH, stone, r);
    for (let f = 1; f < floors; f++) addBand(g, w, d, gh + fh * (f - 1) - 0.12, trim, 0.17);
    addCornice(g, w, d, wallH - 0.26, trim);
    put(g, taperG(w + 0.12, 0.55, 0.26, 0.98), stone, 0, wallH, D - 0.02);
    put(g, taperG(w + 0.12, 0.55, 0.26, 0.98), stone, 0, wallH, -D + 0.02);

    /* main roof + dormers */
    const rf = addRoof(g, {
      w: w - 0.4, d: d - 0.4, h: roofH, y: wallH + 1.3, type: r.chance(0.5) ? 'mansard' : 'hip',
      col: roofCol, wallMat: mw, over: 0.3, r: r, dormers: r.int(2, 4),
    });

    /* corner turret — the silhouette breaker */
    const ts = r.chance(0.5) ? 1 : -1;
    const tr = r.range(1.5, 1.8);
    const tx = ts * (W - tr * 0.55);
    const tz = D - tr * 0.55;
    const th = wallH + r.range(1.4, 2.3);
    put(g, gc(key('tt', tr, th), () => Geo.prism(Geo.polyPlan(8, tr, Math.PI / 8), th, { y0: 0, cap: false })), mw, tx, 0, tz);
    put(g, gc(key('ttp', tr), () => Geo.prism(Geo.polyPlan(8, tr + 0.22, Math.PI / 8), 0.6, { y0: 0 })), stone, tx, 0, tz);
    put(g, gc(key('ttc', tr), () => Geo.ring(tr * 0.98, tr + 0.26, 0.26, 8)), stone, tx, th - 0.3, tz);
    const spire = r.chance(0.5);
    put(g, gc(key('ts', tr, spire), () => (spire
      ? Geo.bellSpire(tr + 0.26, r.range(3.0, 3.8), 8, 0.5)
      : Geo.coneRoof(tr + 0.3, 3.3, 8))), mRoof(roofCol), tx, th, tz);
    const spireTop = th + (spire ? 3.4 : 3.3);
    put(g, pipeG(0.05, 0.7, 4), mIron(), tx, spireTop, tz);
    put(g, bx(0.3, 0.3, 0.05), mIron(), tx, spireTop + 0.62, tz);
    for (let f = 1; f < floors; f++) {
      addWindow(g, {
        x: tx, y: gh + fh * (f - 1) + fh * 0.5, z: tz + tr * 0.94, w: 0.78, h: 1.35,
        grp: r.pick(WIN_UP), muntin: [2, 2],
      });
      addWindow(g, {
        x: tx + ts * tr * 0.94, y: gh + fh * (f - 1) + fh * 0.5, z: tz, ry: ts * Math.PI / 2,
        w: 0.78, h: 1.35, grp: r.pick(WIN_UP),
      });
    }

    /* grand entrance: canopy on columns + steps + sign */
    const ex = -ts * w * 0.12;
    put(g, taperG(4.6, 0.26, 2.1, 0.93), stone, ex, gh - 0.55, D + 0.75);
    put(g, bx(4.9, 0.16, 2.4), trim, ex, gh - 0.3, D + 0.75);
    for (let i = -1; i <= 1; i += 2) {
      put(g, gc(key('col'), () => Geo.taperTower(0.19, 0.16, 3.2, 6, { steps: 2 })), trim, ex + i * 2.0, 0, D + 1.55);
      put(g, bx(0.5, 0.2, 0.5), stone, ex + i * 2.0, 0.1, D + 1.55);
    }
    put(g, gc(key('hst'), () => Geo.stairs(4.2, 0.42, 1.0, 3)), stone, ex, 0, D + 1.95, Math.PI);
    addDoor(g, { x: ex, z: D, w: 1.7, h: 2.6, fanlight: true, step: false });
    put(g, plateG(2.6, 0.5, CELL.hotel), atlasMat(), ex, gh + 0.15, D + 0.06);
    addWallLamp(g, ex + 1.3, 2.7, D + 0.06);
    addWallLamp(g, ex - 1.3, 2.7, D + 0.06);

    /* flagpole sockets on the parapet */
    for (let i = -1; i <= 1; i++) {
      const fx = ex + i * 2.4;
      put(g, bx(0.3, 0.34, 0.3), stone, fx, wallH + 0.5, D - 0.12);
      put(g, pipeG(0.05, 1.9, 4), mIron(), fx, wallH + 0.8, D - 0.12);
      put(g, planeG(0.7, 0.42), mAwning(), fx + 0.36, wallH + 2.4, D - 0.1);
    }

    /* the many windows */
    const bays = 5;
    const wW = 1.05, wH = U.clamp(fh - 1.3, 1.2, 1.6);
    for (let f = 1; f < floors; f++) {
      const y = gh + fh * (f - 1) + fh * 0.52;
      for (let b = 0; b < bays; b++) {
        const x = -w / 2 + (w * (b + 0.5)) / bays;
        if (Math.abs(x - tx) < tr) continue;
        addWindow(g, {
          x: x, y: y, z: D, w: wW, h: wH, grp: r.pick(WIN_UP), muntin: [2, 2],
          lintel: r.chance(0.5), shutters: r.chance(0.25),
        });
        if (f === 1 && b % 2 === 1) addBalcony(g, { x: x, y: y - wH / 2 - 0.22, z: D, w: wW + 0.8, d: 0.72 }, k);
        addWindow(g, { x: x, y: y, z: -D, ry: Math.PI, w: wW, h: wH, grp: r.pick(WIN_UP) });
      }
      for (let s = -1; s <= 1; s += 2) {
        for (let i = -1; i <= 1; i++) {
          addWindow(g, {
            x: s * W, y: y, z: i * d * 0.28, ry: s * Math.PI / 2,
            w: wW * 0.86, h: wH * 0.92, grp: r.pick(WIN_UP),
          });
        }
      }
    }
    // ground floor: restaurant glazing either side of the entrance
    for (let i = -1; i <= 1; i += 2) {
      const x = ex + i * 4.4;
      addWindow(g, {
        x: x, y: gh * 0.52, z: D, w: 2.1, h: gh - 1.6, grp: WIN_LOW,
        rich: true, muntin: [3, 2],
      });
      if (i > 0) addAwning(g, { x: x, y: gh - 0.55, z: D + 0.05, w: 2.6, d: 1.2 });
    }
    for (let i = 0; i < 2; i++) {
      addChimney(g, {
        x: (i ? 1 : -1) * (W - r.range(1.8, 2.6)), z: -D + r.range(1.2, 2.6),
        base: wallH + 1.0, top: rf.apex + r.range(0.5, 0.9), w: 0.85, mat: mBrick(), pots: 2,
      });
    }
    addPipe(g, -W + 0.28, D - 0.4, wallH - 0.4);
    addPipe(g, W - 0.28, -D + 0.4, wallH - 0.4);
    addClimber(g, k, -W + 0.06, D - 2.0, wallH * 0.4, r);
    buildKit(g, k);

    return finalize(g, 'hotel');
  };

  /* ---------- 7 · greenhouse ----------------------------- */
  BH.greenhouse = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 1);
    const w = opts.w || r.range(5.1, 6.8);
    const d = opts.d || r.range(3.6, 4.8);
    const g = TOWN.group('greenhouse');
    const k = newKit();
    const glass = mGlass(), trim = mTrim(), brick = mBrick();
    const ph = r.range(0.5, 0.7);
    const gwH = r.range(1.7, 2.1);
    const roofH = r.range(0.85, 1.1);
    const W = w / 2, D = d / 2, top = ph + gwH;

    // brick plinth
    put(g, taperG(w + 0.12, ph, d + 0.12, 0.96), brick, 0, 0, 0);
    put(g, bx(w + 0.22, 0.1, d + 0.22), mStone(), 0, ph, 0);
    // timber/iron frame posts
    for (let sx = -1; sx <= 1; sx += 2) {
      for (let sz = -1; sz <= 1; sz += 2) {
        put(g, bx(0.11, gwH, 0.11), trim, sx * (W - 0.06), ph + gwH / 2, sz * (D - 0.06));
      }
    }
    // glazing + glazing bars
    put(g, planeG(w - 0.2, gwH - 0.1), glass, 0, ph + gwH / 2, D + 0.005);
    put(g, gc(key('ghm', w, gwH), () => Geo.muntins(w - 0.2, gwH - 0.1, 4, 2, 0.05, 0.06)), trim, 0, ph + gwH / 2, D - 0.02);
    put(g, planeG(w - 0.2, gwH - 0.1), glass, 0, ph + gwH / 2, -D - 0.005, Math.PI);
    put(g, gc(key('ghm2', w, gwH), () => Geo.muntins(w - 0.2, gwH - 0.1, 3, 2, 0.05, 0.06)), trim, 0, ph + gwH / 2, -D + 0.02);
    for (let s = -1; s <= 1; s += 2) {
      put(g, planeG(d - 0.2, gwH - 0.1), glass, s * (W + 0.005), ph + gwH / 2, 0, s * Math.PI / 2);
      put(g, gc(key('ghm3', d, gwH), () => Geo.muntins(d - 0.2, gwH - 0.1, 3, 2, 0.05, 0.06)), trim, s * (W - 0.02), ph + gwH / 2, 0, s * Math.PI / 2);
    }
    // barrel-vaulted glazed roof
    put(g, gc(key('ghr', w, d, roofH), () => Geo.barrelRoof(w, d, roofH, 5, { over: 0.22, thick: 0.1 })), glass, 0, top, 0);
    // ridge beam + ridge vent
    put(g, bx(w + 0.3, 0.09, 0.14), trim, 0, top + roofH - 0.02, 0);
    const vent = new T.Group();
    vent.position.set(r.range(-0.8, 0.8), top + roofH - 0.12, 0.12);
    vent.rotation.x = -0.5;
    g.add(vent);
    put(vent, bx(1.3, 0.05, 0.6), glass, 0, 0, 0.3);
    put(vent, bx(1.34, 0.07, 0.07), trim, 0, 0.02, 0.6);
    // door + step
    addDoor(g, { x: r.range(-w * 0.2, w * 0.2), z: D + 0.03, w: 0.9, h: 1.85, mat: trim, fanlight: true });
    // benches + pots + plants inside
    for (let s = -1; s <= 1; s += 2) {
      put(g, bx(w - 0.7, 0.09, 0.5), mWood(), 0, ph + 0.75, s * (D - 0.45));
      for (let i = 0; i < 4; i++) {
        const x = -w * 0.32 + (w * 0.64 * i) / 3;
        put(g, taperG(0.3, 0.26, 0.3, 0.78), mRoof(P.roofRust), x, ph + 0.8, s * (D - 0.45));
        leaf(k, x, ph + 1.12, s * (D - 0.45), r.range(0.85, 1.3), r.pick(LEAF));
        if (r.chance(0.5)) leaf(k, x + r.range(-0.1, 0.1), ph + 1.3, s * (D - 0.45), 0.45, r.pick(BLOOM));
      }
    }
    buildKit(g, k);
    return finalize(g, 'greenhouse');
  };

  /* ---------- 8 · shed ----------------------------------- */
  BH.shed = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 1);
    const w = opts.w || r.range(2.6, 3.9);
    const d = opts.d || r.range(2.1, 2.9);
    const lean = r.chance(0.5);
    const wallH = lean ? r.range(1.7, 2.1) : r.range(1.75, 2.25);
    const roofH = lean ? r.range(0.5, 0.7) : r.range(0.55, 0.8);
    const g = TOWN.group('shed');
    const k = newKit();
    const wood = mWood(), tim = mTimber(), roofCol = r.pick(ROOFS);
    const W = w / 2, D = d / 2;

    put(g, taperG(w, wallH, d, 0.975), wood, 0, 0, 0);
    put(g, bx(w + 0.14, 0.16, d + 0.14), mStone(), 0, 0.08, 0);
    // plank battens
    for (let i = 0; i < 4; i++) {
      put(g, bx(0.11, wallH - 0.3, 0.05), tim, -W + 0.28 + i * ((w - 0.56) / 3), wallH / 2, D + 0.03);
    }
    put(g, bx(w - 0.1, 0.11, 0.05), tim, 0, wallH - 0.22, D + 0.03);
    const rf = addRoof(g, {
      w: w, d: d, h: roofH, y: wallH, type: lean ? 'shed' : 'gable',
      col: roofCol, wallMat: wood, over: 0.26, r: r, ridge: lean ? 'x' : 'z',
    });
    // door with hinges
    addDoor(g, { x: -w * 0.12, z: D, w: 0.85, h: Math.min(1.7, wallH - 0.2), mat: tim, step: false });
    for (let i = -1; i <= 1; i += 2) {
      put(g, bx(0.34, 0.07, 0.04), mIron(), -w * 0.12 - 0.25, wallH * 0.5 + i * 0.45, D + 0.06);
    }
    // small window
    addWindow(g, {
      x: w * 0.26, y: wallH * 0.62, z: D, w: 0.55, h: 0.5,
      grp: r.pick(WIN_UP), muntin: [2, 2], sill: true,
    });
    // tools leaning on the wall + a crate
    const tg = new T.Group();
    tg.position.set(W - 0.25, 0, D + 0.3);
    tg.rotation.z = 0.22;
    g.add(tg);
    put(tg, pipeG(0.035, 1.5, 4), wood, 0, 0, 0);
    put(tg, bx(0.3, 0.07, 0.09), mIron(), 0, 1.5, 0);
    const tg2 = new T.Group();
    tg2.position.set(-W - 0.05, 0, D + 0.22);
    tg2.rotation.z = -0.16;
    g.add(tg2);
    put(tg2, pipeG(0.035, 1.35, 4), wood, 0, 0, 0);
    put(tg2, bx(0.16, 0.28, 0.05), mIron(), 0, 1.35, 0);
    put(g, taperG(0.5, 0.4, 0.42, 0.94), tim, W - 0.5, 0, D + 0.55);
    leaf(k, W - 0.5, 0.45, D + 0.55, 1.1, r.pick(LEAF));
    if (r.chance(0.6)) addClimber(g, k, -W + 0.04, D - d * 0.4, wallH * 0.8, r);
    buildKit(g, k);
    return finalize(g, 'shed');
  };

  /* ---------- 9 · boathouse ------------------------------ */
  BH.boathouse = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 1);
    const w = opts.w || r.range(6.1, 7.6);
    const d = opts.d || r.range(6.8, 8.0);
    const wallH = r.range(3.0, 3.6);
    const roofH = r.range(1.5, 1.9);
    const g = TOWN.group('boathouse');
    const k = newKit();
    const wood = mWood(), tim = mTimber(), stone = mStone();
    const roofCol = r.pick(ROOFS);
    const W = w / 2, D = d / 2;

    // stone quay base + side walls; the +Z (water) gable end stays open
    put(g, taperG(w + 0.2, 0.42, d + 0.2, 0.97), stone, 0, 0, -0.05);
    for (let s = -1; s <= 1; s += 2) {
      put(g, massG(0.26, wallH, d, 0.08), wood, s * (W - 0.13), wallH / 2, 0);
      for (let i = 0; i < 3; i++) {
        put(g, bx(0.06, 0.13, d - 0.4), tim, s * (W - 0.01), 0.7 + i * (wallH - 1.1) / 2, 0);
      }
    }
    put(g, massG(w - 0.3, wallH, 0.3, 0.1), wood, 0, wallH / 2, -D + 0.15);
    addWindow(g, { x: 0, y: wallH * 0.62, z: -D, ry: Math.PI, w: 1.2, h: 0.9, grp: r.pick(WIN_UP), muntin: [3, 2] });
    // header beam + timber posts framing the open end
    put(g, bx(w - 0.1, 0.36, 0.3), tim, 0, wallH - 0.18, D - 0.15);
    for (let s = -1; s <= 1; s += 2) {
      put(g, pipeG(0.14, wallH - 0.2, 6), tim, s * (W - 0.32), 0.2, D - 0.18);
      put(g, pipeG(0.16, 1.5, 6), tim, s * (W + 0.35), 0, D + 1.35);
      put(g, bx(0.16, 0.16, 1.1), tim, s * (W + 0.35), 1.45, D + 0.9);
    }
    // roof: gable end faces the water (+Z), so the ridge runs along Z
    const rf = addRoof(g, {
      w: w, d: d, h: roofH, y: wallH, type: 'gable', col: roofCol,
      wallMat: wood, over: 0.36, ridge: 'z', ends: 'b', r: r,
    });
    // slipway ramp sloping down into the water
    const ramp = new T.Group();
    ramp.position.set(0, 0.34, D + 0.95);
    ramp.rotation.x = 0.11;
    g.add(ramp);
    put(ramp, taperG(w - 1.2, 0.16, 1.9, 0.98), wood, 0, 0, 0);
    for (let i = 0; i < 4; i++) put(ramp, bx(w - 1.3, 0.07, 0.12), tim, 0, 0.1, -0.7 + i * 0.45);
    for (let s = -1; s <= 1; s += 2) put(ramp, bx(0.12, 0.2, 1.9), tim, s * (w / 2 - 0.6), 0.1, 0);
    // details: lamp on the beam, buoys, a bucket
    addWallLamp(g, 0, wallH - 0.75, D - 0.2);
    addSign(g, { x: -w * 0.22, y: wallH - 0.6, z: -D - 0.02, ry: Math.PI, cell: CELL.no1, w: 0.85, h: 0.45 });
    for (let i = 0; i < 3; i++) {
      leaf(k, -W - 0.1 + r.range(-0.1, 0.1), 0.5 + i * 0.42, D - 1.2 + i * 0.3, 1.5, r.pick([P.flowerRed, P.flowerWhite, P.awningRed]));
    }
    addClimber(g, k, -W - 0.02, -D + d * 0.3, wallH * 0.7, r);
    buildKit(g, k);
    return finalize(g, 'boathouse');
  };

  /* ---------- 10 · cafe ---------------------------------- */
  BH.cafe = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 1);
    const w = opts.w || r.range(7.1, 8.8);
    const d = opts.d || r.range(6.1, 7.8);
    const wallCol = opts.palette || r.pick(WALLS);
    const roofCol = r.pick(ROOFS);
    const mw = mWall(wallCol), trim = mTrim(), stone = mStone();
    const g = TOWN.group('cafe');
    const k = newKit();
    const gh = r.range(3.3, 3.7);
    const fh = r.range(2.8, 3.1);
    const wallH = gh + fh;
    const roofH = r.range(1.8, 2.3);
    const W = w / 2, D = d / 2;

    addPlinth(g, w, d, 0.44, stone);
    put(g, massG(w, gh + 0.12, d - 0.6, 0.1), mw, 0, (gh + 0.12) / 2, -0.3);
    put(g, massG(w, fh, d, 0.14), mw, 0, gh + fh / 2, 0);
    addBand(g, w, d, gh - 0.1, trim, 0.16);
    addCornice(g, w, d, wallH - 0.2, trim);

    /* big glazed front with a striped awning + chalkboard */
    const sf = addShopfront(g, {
      r: r, w: w, h: gh, z: D, wallMat: mw, riserMat: mBrick(), cell: CELL.cafe,
    });
    const cb = new T.Group();
    cb.position.set(sf.doorX > 0 ? -W + 0.9 : W - 0.9, 0, D + 0.75);
    cb.rotation.y = (sf.doorX > 0 ? 1 : -1) * 0.3;
    g.add(cb);
    put(cb, bx(0.9, 1.05, 0.07), mTimber(), 0, 0.85, 0);
    put(cb, plateG(0.78, 0.9, CELL.board), atlasMat(), 0, 0.85, 0.04);
    put(cb, bx(0.09, 0.8, 0.09), mTimber(), -0.3, 0.4, 0.12);
    put(cb, bx(0.09, 0.8, 0.09), mTimber(), 0.3, 0.4, 0.12);

    /* first floor French windows + small balcony */
    for (let i = -1; i <= 1; i += 2) {
      addWindow(g, {
        x: i * w * 0.22, y: gh + fh * 0.5, z: D, w: 1.0, h: fh * 0.72,
        grp: r.pick(WIN_UP), rich: true, muntin: [2, 3], sill: false,
      });
    }
    addBalcony(g, { x: 0, y: gh + 0.12, z: D, w: U.clamp(w * 0.62, 2.2, 4.2), d: 0.85 });

    /* roof + dormer + chimney flue */
    const rf = addRoof(g, {
      w: w, d: d, h: roofH, y: wallH, type: r.chance(0.5) ? 'hip' : 'gable',
      col: roofCol, wallMat: mw, over: 0.34, r: r, dormers: 1,
    });
    const fx = (r.chance(0.5) ? 1 : -1) * (W - 0.8);
    put(g, pipeG(0.24, rf.apex + 0.7 - (wallH - 0.8), 6), mIron(), fx, wallH - 0.8, -D + 1.2);
    put(g, gc(key('flc'), () => Geo.lathe([[0.3, 0], [0.34, 0.08], [0.2, 0.3]], 6)), mIron(), fx, rf.apex + 0.7, -D + 1.2);

    /* side + back windows */
    for (let s = -1; s <= 1; s += 2) {
      addWindow(g, { x: s * W, y: gh + fh * 0.5, z: 0.4, ry: s * Math.PI / 2, w: 0.95, h: 1.35, grp: r.pick(WIN_UP), shutters: r.chance(0.5) });
      addWindow(g, { x: s * W, y: gh * 0.55, z: -D + 1.4, ry: s * Math.PI / 2, w: 0.8, h: 1.1, grp: r.pick(WIN_UP) });
    }
    addWindow(g, { x: -w * 0.2, y: gh + fh * 0.5, z: -D, ry: Math.PI, w: 0.95, h: 1.35, grp: r.pick(WIN_UP) });
    addWindow(g, { x: w * 0.2, y: gh * 0.55, z: -D, ry: Math.PI, w: 0.95, h: 1.2, grp: r.pick(WIN_UP) });
    addDoor(g, { x: 0, z: -D, ry: Math.PI, w: 1.0, h: 2.1, mat: mTimber() });

    /* pavement table + chairs, lamp, planter */
    const tx = sf.doorX > 0 ? -W + 2.2 : W - 2.2;
    put(g, pipeG(0.07, 0.72, 5), mIron(), tx, 0, D + 1.5);
    put(g, gc(key('tbl'), () => Geo.prism(Geo.polyPlan(8, 0.42), 0.08, { y0: 0 })), trim, tx, 0.72, D + 1.5);
    for (let i = -1; i <= 1; i += 2) {
      put(g, taperG(0.34, 0.42, 0.34, 0.86), mWood(), tx + i * 0.85, 0, D + 1.5 + i * 0.2);
      put(g, bx(0.34, 0.4, 0.06), mWood(), tx + i * 0.85, 0.62, D + 1.5 + i * 0.2 - i * 0.14);
    }
    addWallLamp(g, sf.doorX + (sf.doorX > 0 ? -1.15 : 1.15), 2.7, D + 0.05);
    addNumber(g, sf.doorX + 0.8, gh - 0.55, D + 0.05, r.int(0, 7));
    addPipe(g, W - 0.22, D - 0.5, wallH - 0.3);
    addWindowBox(g, k, w * 0.22, gh + fh * 0.5 - fh * 0.36 - 0.16, D + 0.02, 1.0, r);
    addClimber(g, k, -W + 0.04, D - 1.6, wallH * 0.7, r);
    for (let i = 0; i < 3; i++) {
      put(g, taperG(0.42, 0.4, 0.42, 0.82), mRoof(P.roofRust), -W + 0.5 + i * 0.7, 0, D + 0.55);
      leaf(k, -W + 0.5 + i * 0.7, 0.5, D + 0.55, r.range(1.0, 1.4), r.pick(LEAF));
      leaf(k, -W + 0.5 + i * 0.7, 0.68, D + 0.6, 0.5, r.pick(BLOOM));
    }
    buildKit(g, k);
    return finalize(g, 'cafe');
  };

  /* ---------- 11 · tower_house --------------------------- */
  BH.tower_house = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 1);
    const w = opts.w || r.range(4.1, 4.9);
    const d = opts.d || r.range(4.1, 4.9);
    const wallCol = opts.palette || r.pick(WALLS);
    const roofCol = r.pick(ROOFS);
    const mw = mWall(wallCol), trim = mTrim(), stone = mStone();
    const g = TOWN.group('tower_house');
    const k = newKit();
    const floors = 4;
    const fh = r.range(2.5, 2.85);
    const wallH = fh * floors;
    const roofH = r.range(2.6, 3.4);
    const W = w / 2, D = d / 2;

    addPlinth(g, w, d, 0.5, stone);
    put(g, gc(key('th', w, wallH, d), () => Geo.taperBox(w, wallH, d, 0.955)), mw, 0, 0, 0);
    addQuoins(g, w * 0.985, d * 0.985, wallH - 0.4, stone);
    for (let f = 1; f < floors; f++) addBand(g, w * (1 - 0.045 * f / floors), d * (1 - 0.045 * f / floors), fh * f - 0.09, trim, 0.14);
    addCornice(g, w * 0.96, d * 0.96, wallH - 0.22, trim);

    const rf = addRoof(g, {
      w: w * 0.96, d: d * 0.96, h: roofH, y: wallH, type: 'pyramid',
      col: roofCol, wallMat: mw, over: 0.42, r: r,
    });
    put(g, gc(key('fin'), () => Geo.lathe([[0.001, 0], [0.14, 0.16], [0.09, 0.34], [0.001, 0.5]], 6)), mIron(), 0, rf.apex - 0.05, 0);
    addVane(g, 0, rf.apex + 0.4, 0, r);

    addDoor(g, { x: 0, z: D, w: 1.0, h: 2.05, fanlight: true });
    const wW = r.range(0.72, 0.86), wH = r.range(1.05, 1.25);
    for (let f = 0; f < floors; f++) {
      const y = fh * f + fh * 0.55;
      const shrink = 1 - 0.045 * (f + 0.5) / floors;
      if (f === 0) {
        addWindow(g, { x: -W * shrink + 0.75, y: y, z: D * shrink, w: wW, h: wH, grp: WIN_LOW, muntin: [2, 2] });
      } else {
        for (let i = -1; i <= 1; i += 2) {
          addWindow(g, {
            x: i * (W * shrink - 0.85), y: y, z: D * shrink, w: wW, h: wH,
            grp: r.pick(WIN_UP), shutters: r.chance(0.5), muntin: r.chance(0.5) ? [2, 2] : null,
          });
        }
      }
      addWindow(g, { x: W * shrink, y: y, z: r.range(-0.6, 0.6), ry: Math.PI / 2, w: wW * 0.9, h: wH, grp: r.pick(WIN_UP) });
      if (f % 2 === 0) addWindow(g, { x: -W * shrink, y: y, z: r.range(-0.6, 0.6), ry: -Math.PI / 2, w: wW * 0.9, h: wH, grp: r.pick(WIN_UP) });
      addWindow(g, { x: r.range(-0.5, 0.5), y: y, z: -D * shrink, ry: Math.PI, w: wW * 0.9, h: wH, grp: r.pick(WIN_UP) });
    }
    addBalcony(g, { x: 0, y: fh * 2 + 0.1, z: D * 0.98, w: w * 0.62, d: 0.75 });
    addChimney(g, {
      x: (r.chance(0.5) ? 1 : -1) * (W - 0.6), z: -D + 0.7,
      base: wallH - 0.4, top: rf.apex - roofH * 0.25 + r.range(0.3, 0.6), w: 0.6, mat: stone, pots: 1,
    });
    addWallLamp(g, 0.85, 2.4, D + 0.04);
    addNumber(g, -0.85, 1.7, D + 0.04, r.int(0, 7));
    addPipe(g, W - 0.24, D - 0.3, wallH - 0.4);
    addWindowBox(g, k, -W + 0.85, fh * 1.55 - wH / 2 - 0.16, D * 0.98 + 0.02, wW, r);
    addClimber(g, k, -W + 0.04, D - 1.2, wallH * 0.55, r);
    buildKit(g, k);
    return finalize(g, 'tower_house');
  };

  /* ---------- 12 · demo ---------------------------------- */
  BH.demo = function (opts) {
    opts = opts || {};
    const g = TOWN.group('buildings_home_demo');
    const inner = TOWN.group('row');
    g.add(inner);
    const items = [
      BH.cottage({ seed: 1 }),
      BH.cottage({ seed: 12, floors: 2 }),
      BH.townhouse({ seed: 2, shop: true }),
      BH.townhouse({ seed: 22, floors: 4 }),
      BH.rowTerrace({ seed: 3, count: 4 }),
      BH.villa({ seed: 4 }),
      BH.apartment({ seed: 5 }),
      BH.hotel({ seed: 6 }),
      BH.greenhouse({ seed: 7 }),
      BH.shed({ seed: 8 }),
      BH.boathouse({ seed: 9 }),
      BH.cafe({ seed: 10 }),
      BH.tower_house({ seed: 11 }),
    ];
    let x = 0;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const fw = it.userData.footprint.w;
      it.position.x = x + fw / 2;
      inner.add(it);
      x += fw + 2;
    }
    inner.position.x = -(x - 2) / 2;
    finalize(g, 'demo');
    g.userData.variants = items.map((it) => it.userData.kind);
    return g;
  };

})(window);

// ---- probe results ----
// (filled in after headless verification)
