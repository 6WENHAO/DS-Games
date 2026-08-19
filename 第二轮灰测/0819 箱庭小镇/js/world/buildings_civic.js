/* =============================================================
   buildings_civic.js — TOWN.BuildingsCivic
   箱庭小镇 · THE LANDMARKS
   The tall, characterful silhouette-makers: town hall + clock tower,
   church, lighthouse, windmill, watermill, tram station, library,
   market hall, harbour warehouse, observatory, gazebo, city gate.

   Every factory:  f(opts) -> THREE.Group
     · origin at footprint centre, sitting on y = 0
     · faces +Z
     · userData.footprint {w,d} · userData.height · userData.kind
     · deterministic from opts.seed

   No bare BoxGeometry is used for a primary mass — only chamferBox /
   taperBox / prism / lathe / taperTower / archWall.  Bare boxes appear
   only as sills, bars, planks, rails, crates, hands and merlons.
   ============================================================= */
(function (global) {
  'use strict';

  const T = global.THREE;
  const TOWN = global.TOWN;
  const U = TOWN.U, Geo = TOWN.Geo, Mat = TOWN.Mat, Tex = TOWN.Tex;
  const P = TOWN.Palette;
  const Civic = TOWN.BuildingsCivic = {};

  const DEG = Math.PI / 180;
  const TAU = Math.PI * 2;

  let _uid = 0;
  function uid() { _uid += 1; return _uid; }

  /* ============================================================
     0 · textures + the module's shared material set (24 materials)
     ============================================================ */

  function drawDial(g, w, h) {
    g.fillStyle = '#9a9280';                 // stone panel behind the dial
    g.fillRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2, R = w * 0.45;
    g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.fillStyle = '#f6f0e2'; g.fill();
    g.lineWidth = w * 0.032; g.strokeStyle = '#c9a24a'; g.stroke();
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * TAU - Math.PI / 2;
      const big = (i % 5) === 0;
      const r0 = R * (big ? 0.76 : 0.87), r1 = R * 0.95;
      g.strokeStyle = '#2b2f36';
      g.lineWidth = big ? w * 0.022 : w * 0.008;
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
      g.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      g.stroke();
    }
    g.fillStyle = '#2b2f36';
    g.font = 'bold ' + Math.round(w * 0.115) + 'px serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const num = ['XII', 'III', 'VI', 'IX'];
    const ang = [-Math.PI / 2, 0, Math.PI / 2, Math.PI];
    for (let i = 0; i < 4; i++) {
      g.fillText(num[i], cx + Math.cos(ang[i]) * R * 0.68, cy + Math.sin(ang[i]) * R * 0.68);
    }
  }

  function drawStationBoard(g, w, h) {
    g.fillStyle = '#2f5a4c'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#e8e3d8'; g.lineWidth = h * 0.06;
    g.strokeRect(h * 0.09, h * 0.09, w - h * 0.18, h - h * 0.18);
    g.fillStyle = '#f6f2e6';
    g.font = 'bold ' + Math.round(h * 0.42) + 'px sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('HARBOUR HALT', w / 2, h * 0.52);
  }

  function drawWarehouseSign(g, w, h) {
    g.fillStyle = '#e6dcc6'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#8d5a3c'; g.fillRect(0, 0, w, h * 0.1);
    g.fillStyle = '#8d5a3c'; g.fillRect(0, h * 0.9, w, h * 0.1);
    g.fillStyle = '#5d4433';
    g.font = 'bold ' + Math.round(h * 0.3) + 'px serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('HARBOUR STORE', w / 2, h * 0.38);
    g.font = 'bold ' + Math.round(h * 0.22) + 'px serif';
    g.fillText('N\u00BA 4  \u00B7  GRAIN & SALT', w / 2, h * 0.68);
  }

  let _M = null;
  function mats() {
    if (_M) return _M;
    const texDial = Tex.canvas('civicDial', 256, 256, drawDial);
    const texBoard = Tex.canvas('civicStationBoard', 256, 64, drawStationBoard);
    const texSign = Tex.canvas('civicWareSign', 256, 96, drawWarehouseSign);
    _M = {
      /* masonry */
      stone: Mat.std(P.stone, { rough: 0.86, flat: true, name: 'civicStone' }),
      stoneD: Mat.std(P.stoneDark, { rough: 0.88, flat: true, name: 'civicStoneDark' }),
      stoneW: Mat.std(P.stoneWarm, { rough: 0.8, flat: true, name: 'civicStoneWarm' }),
      brick: Mat.std(P.wallBrick, { rough: 0.85, flat: true, name: 'civicBrick' }),
      plaster: Mat.std(P.wallCream, { rough: 0.8, flat: true, name: 'civicPlaster' }),
      /* timber + metal */
      wood: Mat.std(P.wood, { rough: 0.8, flat: true, name: 'civicWood' }),
      woodD: Mat.std(P.woodDark, { rough: 0.82, flat: true, name: 'civicWoodDark' }),
      iron: Mat.std(P.iron, { rough: 0.5, metal: 0.55, flat: true, name: 'civicIron' }),
      gold: Mat.std(P.gold, { rough: 0.3, metal: 0.85, flat: true, name: 'civicGold' }),
      /* roofs */
      copper: Mat.std(P.roofCopper, { rough: 0.55, metal: 0.28, flat: true, name: 'civicCopper' }),
      slate: Mat.std(P.roofSlate, { rough: 0.78, flat: true, name: 'civicSlate' }),
      tile: Mat.std(P.roofTerracotta, { rough: 0.8, flat: true, name: 'civicTile' }),
      red: Mat.std(P.roofRed, { rough: 0.72, flat: true, name: 'civicRed' }),
      /* glazing (staggered night groups) */
      // staggered night groups: 0 lights early & warm, 3 late & dim, 5 dimmer
      // still, 6 never lights at all (empty offices) — spread over the facades
      win: [Mat.window(0), Mat.window(3), Mat.window(5), Mat.window(6)],
      winRose: Mat.window(2, { tint: P.roofPlum }),
      winTeal: Mat.window(1, { tint: P.roofTeal }),
      /* light */
      lamp: Mat.lamp(P.lampWarm),
      lens: Mat.glow(P.lampWarm, 1.7),
      beam: Mat.basic(P.lampWarm, { transparent: true, opacity: 0.1, additive: true, depthWrite: false }),
      /* signage */
      dial: Mat.std(P.white, { rough: 0.6, map: texDial, name: 'civicDial' }),
      boardS: Mat.std(P.white, { rough: 0.7, map: texBoard, name: 'civicBoardStation' }),
      boardW: Mat.std(P.offWhite, { rough: 0.75, map: texSign, name: 'civicSignWare' }),
    };
    return _M;
  }

  /* ============================================================
     1 · tiny construction helpers
     ============================================================ */

  function grp(n) { return TOWN.group(n); }

  function mk(parent, geo, mat, x, y, z) {
    const m = TOWN.mesh(geo, mat, x, y, z);
    parent.add(m);
    return m;
  }

  /** a cornice / string course ring around a rectangular mass */
  function band(parent, w, d, y, h, mat, over) {
    over = over === undefined ? 0.24 : over;
    return mk(parent, Geo.chamferBox(w + over * 2, h, d + over * 2, 0.07), mat, 0, y + h / 2, 0);
  }

  /** classical pediment: triangle extruded along Z (8 tris) */
  function pedimentGeo(w, h, d) {
    const hw = w / 2, hd = d / 2;
    const v = [[-hw, 0, hd], [hw, 0, hd], [0, h, hd], [-hw, 0, -hd], [hw, 0, -hd], [0, h, -hd]];
    return Geo.fromQuads(v, [[0, 1, 2], [5, 4, 3], [3, 4, 1, 0], [1, 4, 5, 2], [0, 2, 5, 3]]);
  }

  /** cheap square-baluster parapet along X (16 tris per baluster) */
  function balustradeGeo(len, h, step) {
    step = step || 1.05;
    const parts = [];
    const n = Math.max(2, Math.round(len / step));
    const post = Geo.prism(Geo.polyPlan(4, 0.088, Math.PI / 4), h * 0.76);
    for (let i = 0; i <= n; i++) parts.push(Geo.at(post, -len / 2 + (len * i) / n, h * 0.12, 0));
    parts.push(Geo.at(Geo.box(len, h * 0.12, 0.34), 0, h * 0.06, 0));
    parts.push(Geo.at(Geo.box(len, h * 0.15, 0.42), 0, h * 0.925, 0));
    return Geo.mergeGeometries(parts);
  }

  /** alternating corner quoins (small boxes = detail, not mass) */
  function quoinsGeo(w, d, h, rows) {
    const parts = [];
    const bh = h / (rows * 2 + 1);
    const bw = 0.62, bt = 0.15;
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    for (let i = 0; i < rows; i++) {
      const y = bh * (i * 2 + 1) + bh * 0.5;
      for (let c = 0; c < 4; c++) {
        const s = corners[c];
        parts.push(Geo.at(Geo.box(bw, bh * 0.9, bt), s[0] * (w / 2 - bw / 2), y, s[1] * (d / 2 + bt * 0.4)));
        parts.push(Geo.at(Geo.box(bt, bh * 0.9, bw * 0.75), s[0] * (w / 2 + bt * 0.4), y, s[1] * (d / 2 - bw * 0.42)));
      }
    }
    return Geo.mergeGeometries(parts);
  }

  /**
   * pierce(w,h,d,holes,seg) — same construction as Geo.archWall but with a
   * tunable curve resolution.  Window surrounds are repeated 15+ times per
   * building, so dropping the arch head from 6 to 3 segments buys back ~25
   * triangles each while keeping a genuine reveal.  Arcades / belfries /
   * market trusses still use Geo.archWall at full resolution.
   */
  function pierce(w, h, d, holes, seg) {
    const shape = new T.Shape();
    shape.moveTo(-w / 2, 0); shape.lineTo(w / 2, 0);
    shape.lineTo(w / 2, h); shape.lineTo(-w / 2, h); shape.lineTo(-w / 2, 0);
    for (let i = 0; i < holes.length; i++) {
      const o = holes[i];
      const hw = o.w / 2, x = o.x || 0, y0 = o.y || 0, y1 = y0 + o.h;
      const p = new T.Path();
      if (o.arc) {
        const straight = y1 - Math.min(o.arc, o.h * 0.9);
        p.moveTo(x - hw, y0); p.lineTo(x - hw, straight);
        p.quadraticCurveTo(x - hw, y1, x, y1);
        p.quadraticCurveTo(x + hw, y1, x + hw, straight);
        p.lineTo(x + hw, y0);
      } else {
        p.moveTo(x - hw, y0); p.lineTo(x + hw, y0);
        p.lineTo(x + hw, y1); p.lineTo(x - hw, y1);
      }
      p.lineTo(x - hw, y0);
      shape.holes.push(p);
    }
    const g = new T.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false, curveSegments: seg || 3 });
    g.translate(0, 0, -d / 2);
    return g;
  }

  /** cheap hooped railing for round galleries: square balusters + 2 hoops */
  function hoopRailingGeo(r, h, n) {
    const parts = [];
    const post = Geo.prism(Geo.polyPlan(4, 0.055, Math.PI / 4), h);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      parts.push(Geo.at(post, Math.cos(a) * r, 0, Math.sin(a) * r));
    }
    const flat = new T.Matrix4().makeRotationX(Math.PI / 2);
    for (let k = 0; k < 2; k++) {
      const hoop = Geo.torus(r, 0.05, 12, 4);
      hoop.applyMatrix4(flat);
      hoop.translate(0, k === 0 ? h : h * 0.45, 0);
      parts.push(hoop);
    }
    return Geo.mergeGeometries(parts);
  }

  /** solid arch-shaped slab (glazing pane, door leaf, arch head) */
  function archPaneGeo(w, h, arc, d) {
    const s = Geo.archShape(w, h, arc === undefined ? w * 0.5 : arc);
    const g = new T.ExtrudeGeometry(s, { depth: d, bevelEnabled: false, curveSegments: 4 });
    g.translate(0, 0, -d / 2);
    return g;
  }

  /**
   * winUnit — a window with real facade depth: projecting stone surround
   * (a pierced plate, so the reveal is genuine), glazing recessed 0.06+
   * behind the wall face, a sill and optional muntins.
   * (x, ybase, z) = centre-bottom of the opening, on a wall facing +Z.
   */
  function winUnit(parent, ww, hh, x, ybase, z, winMat, opts) {
    opts = opts || {};
    const M = mats();
    const t = opts.t === undefined ? 0.24 : opts.t;
    const sur = opts.surround || M.stoneW;
    const arc = opts.arc || 0;
    mk(parent, pierce(ww + t * 2, hh + t * 2, 0.15,
      [{ x: 0, y: t, w: ww, h: hh, arc: arc || undefined }], 3), sur, x, ybase - t, z);
    if (arc) mk(parent, archPaneGeo(ww * 0.98, hh * 0.99, arc, 0.06), winMat, x, ybase, z - 0.07);
    else mk(parent, Geo.box(ww * 0.98, hh * 0.98, 0.06), winMat, x, ybase + hh / 2, z - 0.07);
    if (opts.sill !== false) {
      mk(parent, Geo.box(ww + t * 2 + 0.2, 0.13, 0.34), M.stoneW, x, ybase - t - 0.05, z + 0.09);
    }
    if (opts.muntins) {
      const mu = Geo.muntins(ww * 0.94, hh * 0.9, opts.muntins[0], opts.muntins[1], 0.05, 0.07);
      if (mu) mk(parent, mu, M.woodD, x, ybase + hh / 2, z - 0.03);
    }
  }

  /** simple plank door in an arched or square head */
  function doorUnit(parent, ww, hh, x, ybase, z, opts) {
    opts = opts || {};
    const M = mats();
    const t = opts.t === undefined ? 0.26 : opts.t;
    const arc = opts.arc || 0;
    mk(parent, pierce(ww + t * 2, hh + t * 2, 0.18,
      [{ x: 0, y: t, w: ww, h: hh, arc: arc || undefined }], 3), opts.surround || M.stoneW, x, ybase - t, z);
    const leaf = arc ? archPaneGeo(ww * 0.97, hh * 0.98, arc, 0.09) : Geo.box(ww * 0.97, hh * 0.98, 0.09);
    mk(parent, leaf, opts.mat || M.woodD, x, arc ? ybase : ybase + hh / 2, z - 0.06);
    // two ironwork straps
    for (let i = 0; i < 2; i++) {
      mk(parent, Geo.box(ww * 0.9, 0.08, 0.05), M.iron, x, ybase + hh * (0.25 + i * 0.42), z - 0.02);
    }
  }

  /** hanging / post lantern: globe + halo (no real light) */
  function lantern(parent, x, y, z, size, haloSize) {
    const M = mats();
    const s = size === undefined ? 0.17 : size;
    const g = mk(parent, Geo.prism(Geo.polyPlan(6, s), s * 2.1, { center: true }), M.lamp, x, y, z);
    mk(parent, Geo.prism(Geo.polyPlan(6, s * 1.15), s * 0.4), M.iron, x, y + s * 1.05, z);
    const h = TOWN.halo(P.lampWarm, haloSize === undefined ? 2.3 : haloSize, { max: 0.8 });
    h.position.set(x, y, z);
    parent.add(h);
    return g;
  }

  /** octagonal (or n-gon) gallery railing built from Geo.railing segments */
  function ringRailingGeo(r, h, sides, opts) {
    const parts = [];
    const side = 2 * r * Math.sin(Math.PI / sides);
    const apo = r * Math.cos(Math.PI / sides);
    const rail = Geo.railing(side * 1.04, h, opts || { style: 'bar', spacing: 1.1, postR: 0.04 });
    for (let i = 0; i < sides; i++) {
      const a = ((i + 0.5) / sides) * TAU;
      parts.push(Geo.at(rail, Math.cos(a) * apo, 0, Math.sin(a) * apo, -(a + Math.PI / 2)));
    }
    return Geo.mergeGeometries(parts);
  }

  /** a wavy flag (double sided by duplicating the winding) */
  function flagGeo(len, h, seg) {
    const v = [], f = [];
    for (let i = 0; i <= seg; i++) {
      const t = i / seg;
      const z = Math.sin(t * 5.0) * 0.18 * t;
      v.push([t * len, h / 2 - t * 0.05, z]);
      v.push([t * len, -h / 2 + t * 0.05, z]);
    }
    for (let i = 0; i < seg; i++) {
      const a = i * 2;
      f.push([a, a + 1, a + 3, a + 2]);
      f.push([a + 2, a + 3, a + 1, a]);
    }
    return Geo.fromQuads(v, f);
  }

  /** gilded finial (ball + spike) */
  function finialGeo(r, h) {
    return Geo.lathe([[0.02, 0], [r, r * 0.85], [r * 0.5, r * 1.5],
      [r * 0.11, h], [0.01, h + r * 0.5]], 6);
  }

  /** urn for parapets */
  function urnGeo(r, h) {
    return Geo.lathe([[r * 0.72, 0], [r * 0.42, h * 0.22],
      [r, h * 0.52], [r * 0.6, h * 0.84], [r * 0.86, h]], 6);
  }

  /** clock: dial panel + gold rim + (optionally live) hands */
  function clockAssembly(R, live, id) {
    const M = mats();
    const g = grp('clock');
    mk(g, Geo.box(R * 2, R * 2, 0.1), M.dial, 0, 0, 0);
    const rim = mk(g, Geo.ring(R * 0.96, R * 1.14, 0.12, 12), M.gold, 0, 0, 0.06);
    rim.rotation.x = Math.PI / 2;
    const hands = grp('hands');
    hands.position.z = 0.1;
    mk(hands, Geo.at(Geo.box(0.1 * R, R * 0.56, 0.045), 0, R * 0.24, 0), M.iron, 0, 0, 0);
    const min = mk(hands, Geo.at(Geo.box(0.07 * R, R * 0.84, 0.04), 0, R * 0.36, 0), M.iron, 0, 0, 0.05);
    min.name = 'minuteHand';
    hands.children[0].name = 'hourHand';
    mk(hands, Geo.lathe([[R * 0.1, 0], [R * 0.07, R * 0.09]], 7), M.gold, 0, 0, 0.09);
    g.add(hands);
    const hourH = hands.children[0], minH = hands.children[1];
    if (live) {
      TOWN.markDynamic(hands);
      TOWN.Ticker.add(function (dt, elapsed, Env) {
        const hrs = Env.hours;
        hourH.rotation.z = -((hrs % 12) / 12) * TAU;
        minH.rotation.z = -((hrs * 60) % 60 / 60) * TAU;
      }, 'civic.clock' + id, { always: true });
    } else {
      hourH.rotation.z = -(10.15 / 12) * TAU;
      minH.rotation.z = -(9 / 60) * TAU;
    }
    g.userData.hands = hands;
    return g;
  }

  /* one shared night PointLight budget for the whole module (max 2) */
  let _lightsUsed = 0;
  function nightLight(parent, color, peak, dist, x, y, z, id) {
    if (_lightsUsed >= 2) return null;
    _lightsUsed += 1;
    const l = new T.PointLight(color, 0, dist);
    l.position.set(x, y, z);
    l.userData.dynamic = true;
    parent.add(l);
    TOWN.Stage.nightLights.push(l);
    TOWN.Ticker.add(function (dt, elapsed, Env) {
      l.intensity = peak * U.smoothstep(0.1, 0.5, Env.lampF);
    }, 'civic.light' + id, { always: true });
    return l;
  }

  /**
   * solidExtents(g) — bounds of the built object only: billboard halos and
   * anything flagged userData.fx (the lighthouse light cones) are ignored so
   * the reported footprint is what the layout can actually collide with.
   */
  const _b3 = new T.Box3(), _b3t = new T.Box3();
  function solidExtents(g) {
    _b3.makeEmpty();
    g.updateMatrixWorld(true);
    g.traverse(function (o) {
      if (!o.isMesh || o.isSprite || o.userData.fx) return;
      const geo = o.geometry;
      if (!geo) return;
      if (!geo.boundingBox) geo.computeBoundingBox();
      _b3t.copy(geo.boundingBox).applyMatrix4(o.matrixWorld);
      _b3.union(_b3t);
    });
    return _b3;
  }

  /** finish: stamp the contract's userData from the real (solid) bounds */
  function finish(g, kind) {
    const box = solidExtents(g);
    g.userData.kind = kind;
    g.userData.footprint = {
      w: +(box.max.x - box.min.x).toFixed(2),
      d: +(box.max.z - box.min.z).toFixed(2),
    };
    g.userData.height = +Math.max(0, box.max.y).toFixed(2);
    return g;
  }

  /* ============================================================
     2 · TOWN HALL — arcade, pediment, balustrade, clock tower
     ============================================================ */
  Civic.townHall = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 1);
    const M = mats();
    const id = uid();
    const g = grp('townHall');

    const w = r.range(15, 18);
    const d = r.range(10, 13);
    const mainH = r.range(9, 11);
    const towerH = r.range(22, 25);
    const y0 = 1.05;                       // rusticated plinth top
    const arcH = 3.35;                     // arcade storey
    const arcTop = y0 + arcH;
    const upperH = mainH - arcTop;

    /* -- rusticated plinth + base moulding ------------------- */
    mk(g, Geo.taperBox(w + 0.6, y0, d + 0.6, 0.985), M.stoneD, 0, 0, 0);
    mk(g, Geo.chamferBox(w + 0.42, 0.2, d + 0.42, 0.06), M.stoneW, 0, y0 + 0.05, 0);
    mk(g, Geo.chamferBox(w + 0.52, 0.14, d + 0.52, 0.05), M.stoneD, 0, y0 * 0.55, 0);

    /* -- ground storey: solid core set back behind an open arcade */
    const coreD = d - 2.2;
    mk(g, Geo.chamferBox(w - 0.3, arcH, coreD, 0.16), M.stone, 0, y0 + arcH / 2, -1.1);
    const bays = 4, bw = (w - 1.1) / bays, holes = [];
    for (let i = 0; i < bays; i++) {
      holes.push({
        x: -w / 2 + 0.55 + bw * (i + 0.5), y: 0.12,
        w: bw * 0.7, h: arcH * 0.8, arc: bw * 0.35,
      });
    }
    mk(g, Geo.archWall(w, arcH, 1.15, holes), M.stoneW, 0, y0, d / 2 - 0.575);
    // loggia floor + soffit so the arcade reads as a real void
    mk(g, Geo.box(w - 1.3, 0.14, 1.25), M.stoneD, 0, y0 + 0.07, d / 2 - 1.45);
    mk(g, Geo.box(w - 1.3, 0.2, 1.25), M.stone, 0, arcTop - 0.1, d / 2 - 1.45);
    // arcade rear doors
    doorUnit(g, 1.5, 2.5, 0, y0 + 0.14, d / 2 - 2.18, { arc: 0.7, surround: M.stone });

    /* -- upper storey (overhangs the loggia) ------------------ */
    mk(g, Geo.chamferBox(w, upperH, d, 0.2), M.plaster, 0, arcTop + upperH / 2, 0);
    mk(g, quoinsGeo(w, d, upperH, 2), M.stoneW, 0, arcTop, 0);
    band(g, w, d, arcTop - 0.16, 0.32, M.stoneW, 0.3);      // string course
    band(g, w, d, mainH - 0.34, 0.34, M.stoneW, 0.34);      // main cornice
    mk(g, Geo.chamferBox(w + 0.5, 0.16, d + 0.5, 0.05), M.stoneD, 0, mainH - 0.42, 0);

    /* -- projecting central bay + pediment ------------------- */
    const cbW = w * 0.34;
    mk(g, Geo.chamferBox(cbW, upperH + 0.34, 0.62, 0.1), M.stoneW, 0, arcTop + (upperH + 0.34) / 2, d / 2 + 0.16);
    for (let i = 0; i < 4; i++) {
      const px = -cbW / 2 + 0.34 + (cbW - 0.68) * (i / 3);
      mk(g, Geo.taperTower(0.21, 0.18, upperH - 0.5, 6, { steps: 1 }), M.stoneW, px, arcTop + 0.25, d / 2 + 0.5);
      mk(g, Geo.prism(Geo.polyPlan(4, 0.28, Math.PI / 4), 0.2), M.stoneW, px, arcTop + upperH - 0.25, d / 2 + 0.5);
    }
    mk(g, pedimentGeo(cbW + 0.7, 1.5, 0.75), M.stoneW, 0, mainH, d / 2 + 0.14);
    mk(g, Geo.lathe([[0.34, 0], [0.3, 0.16], [0.12, 0.3]], 8), M.gold, 0, mainH + 0.55, d / 2 + 0.5);

    /* -- piano-nobile windows -------------------------------- */
    const wy = arcTop + 0.65, wh = upperH * 0.6;
    for (let i = 0; i < 6; i++) {
      const sx = i < 3 ? -1 : 1;
      const wx = sx * (cbW / 2 + 0.9 + (i % 3) * ((w / 2 - cbW / 2 - 1.5) / 2.4));
      winUnit(g, 1.05, wh, wx, wy, d / 2, M.win[r.int(0, 3)],
        (i % 3) === 0 ? { arc: 0.42, muntins: [2, 3] } : { arc: 0.42 });
    }
    winUnit(g, 1.5, wh + 0.3, 0, wy, d / 2 + 0.48, M.win[r.int(0, 3)], { arc: 0.6, muntins: [2, 3] });
    for (let s = -1; s <= 1; s += 2) {
      const side = grp('side');
      side.rotation.y = (s * Math.PI) / 2;
      side.position.x = (s * w) / 2;
      g.add(side);
      for (let i = 0; i < 2; i++) {
        winUnit(side, 1.0, wh, (i - 0.5) * (d * 0.42), wy, 0, M.win[r.int(0, 3)], { t: 0.2 });
      }
    }
    for (let i = 0; i < 3; i++) {
      winUnit(g, 1.0, wh * 0.85, (i - 1) * (w / 3.6), wy, -d / 2, M.win[r.int(0, 3)], { t: 0.2 });
    }

    /* -- balustraded parapet, urns, low hipped roof ----------- */
    const pY = mainH;
    mk(g, balustradeGeo(w - 1.9, 1.15, 1.4), M.stoneW, 0, pY, d / 2 + 0.1);
    mk(g, balustradeGeo(w - 1.9, 1.15, 1.4), M.stoneW, 0, pY, -d / 2 - 0.1);
    for (let s = -1; s <= 1; s += 2) {
      const b = mk(g, Geo.chamferBox(d - 1.9, 1.0, 0.42, 0.06), M.stoneW,
        (s * w) / 2 + s * 0.1, pY + 0.5, 0);
      b.rotation.y = Math.PI / 2;
      const c = mk(g, Geo.chamferBox(d - 1.7, 0.16, 0.56, 0.05), M.stoneD,
        (s * w) / 2 + s * 0.1, pY + 1.05, 0);
      c.rotation.y = Math.PI / 2;
    }
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    for (let c = 0; c < 4; c++) {
      const s = corners[c];
      const cx = (s[0] * w) / 2 + s[0] * 0.1, cz = (s[1] * d) / 2 + s[1] * 0.1;
      mk(g, Geo.chamferBox(0.72, 1.5, 0.72, 0.07), M.stoneW, cx, pY + 0.75, cz);
      mk(g, urnGeo(0.3, 0.85), M.stoneW, cx, pY + 1.5, cz);
    }
    mk(g, Geo.hipRoof(w - 1.4, d - 1.4, 1.5, { over: 0.1, ridge: 0.5 }), M.slate, 0, pY + 0.6, 0);

    /* -- clock tower (asymmetric, rear right) ----------------- */
    const tx = w / 2 - 2.5, tz = -d / 2 + 2.4;
    const s1 = mainH + 1.4, s2 = towerH - 5.9;
    mk(g, Geo.chamferBox(3.7, s1, 3.7, 0.2), M.stone, tx, s1 / 2, tz);
    band(g, 3.7, 3.7, s1 * 0.34, 0.24, M.stoneW, 0.2).position.set(tx, s1 * 0.34 + 0.12, tz);
    band(g, 3.7, 3.7, s1 * 0.67, 0.24, M.stoneW, 0.2).position.set(tx, s1 * 0.67 + 0.12, tz);
    band(g, 3.7, 3.7, s1 - 0.3, 0.3, M.stoneW, 0.26).position.set(tx, s1 - 0.15, tz);
    mk(g, Geo.chamferBox(3.15, s2 - s1, 3.15, 0.17), M.stone, tx, (s1 + s2) / 2, tz);
    band(g, 3.15, 3.15, s2 - 0.32, 0.32, M.stoneW, 0.3).position.set(tx, s2 - 0.16, tz);
    // tower windows
    for (let i = 0; i < 2; i++) {
      winUnit(g, 0.8, 1.5, tx, s1 + 0.6 + i * 2.6, tz + 1.86, M.win[r.int(0, 3)], { t: 0.18, arc: 0.34 });
    }
    // working clock face
    const clock = clockAssembly(1.05, true, id);
    clock.position.set(tx, s2 - 1.85, tz + 1.63);
    g.add(clock);

    /* belfry: four arched openings + bell */
    const belH = 2.6;
    for (let i = 0; i < 4; i++) {
      const bg = grp('belfry');
      bg.rotation.y = (i * Math.PI) / 2;
      bg.position.set(tx, s2, tz);
      g.add(bg);
      const bwall = mk(bg, Geo.archWall(3.0, belH, 0.34,
        [{ x: 0, y: 0.25, w: 1.5, h: belH * 0.72, arc: 0.75 }]), M.stoneW, 0, 0, 1.33);
      bwall.name = 'belfryWall';
    }
    mk(g, Geo.lathe([[0.44, 0], [0.5, 0.3], [0.34, 0.66], [0.12, 0.8]], 6), M.gold, tx, s2 + 0.5, tz);
    band(g, 3.0, 3.0, s2 + belH, 0.3, M.stoneW, 0.34).position.set(tx, s2 + belH + 0.15, tz);
    // verdigris dome + gilded finial
    mk(g, Geo.domeRoof(1.72, 2.05, 9), M.copper, tx, s2 + belH + 0.3, tz);
    mk(g, Geo.lathe([[0.34, 0], [0.26, 0.2]], 8), M.gold, tx, s2 + belH + 2.3, tz);
    mk(g, finialGeo(0.28, 1.0), M.gold, tx, s2 + belH + 2.4, tz);

    /* -- flagpole + flag (gentle flutter) -------------------- */
    const fx = -w / 2 + 1.4;
    mk(g, Geo.taperTower(0.075, 0.05, 4.6, 6, { steps: 1 }), M.stoneW, fx, pY + 1.15, d / 2 - 0.9);
    mk(g, Geo.lathe([[0.11, 0], [0.05, 0.16]], 7), M.gold, fx, pY + 5.75, d / 2 - 0.9);
    const flagG = grp('flag');
    flagG.position.set(fx + 0.06, pY + 4.9, d / 2 - 0.9);
    mk(flagG, flagGeo(1.5, 0.9, 5), M.red, 0, 0, 0);
    g.add(flagG);
    TOWN.markDynamic(flagG);
    TOWN.Ticker.add(function (dt, elapsed) {
      flagG.rotation.y = Math.sin(elapsed * 1.6) * 0.16;
      flagG.rotation.z = Math.sin(elapsed * 2.3 + 1.1) * 0.05;
    }, 'civic.flag' + id);

    /* -- entrance steps -------------------------------------- */
    const st = mk(g, Geo.stairs(cbW + 1.6, y0, 1.5, 3), M.stoneD, 0, 0, d / 2 + 0.75);
    st.rotation.y = Math.PI;

    g.userData.clock = clock;
    g.userData.hands = clock.userData.hands;
    g.userData.flag = flagG;
    g.userData.towerTop = +towerH.toFixed(2);
    g.userData.towerPos = [+tx.toFixed(2), 0, +tz.toFixed(2)];
    g.userData.entrance = [0, y0, +(d / 2 + 1.5).toFixed(2)];
    return finish(g, 'townHall');
  };

  /* ============================================================
     3 · CHURCH — nave, apse, buttresses, west tower + bell spire
     ============================================================ */
  Civic.church = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 2);
    const M = mats();
    const id = uid();
    const g = grp('church');

    const navW = r.range(8, 10);
    const navD = r.range(16, 18.4);
    const ridgeH = r.range(10, 12);
    const towerH = r.range(20, 24);
    const wallH = ridgeH - 3.5;
    const apseR = navW * 0.4;
    const apseZ = -navD / 2 + 1.5;

    /* -- plinth + nave --------------------------------------- */
    mk(g, Geo.taperBox(navW + 0.5, 0.55, navD + 0.5, 0.98), M.stoneD, 0, 0, 0);
    mk(g, Geo.taperBox(navW, wallH, navD, 0.985), M.stone, 0, 0.55, 0);
    band(g, navW, navD, wallH + 0.35, 0.26, M.stoneW, 0.22);
    mk(g, Geo.gableRoof(navW, navD, 3.5, { over: 0.42, thick: 0.2 }), M.slate, 0, wallH + 0.6, 0);
    // ridge cresting
    mk(g, Geo.box(0.16, 0.24, navD * 0.92), M.copper, 0, wallH + 4.2, 0);

    /* -- apse (半圆) at the far end --------------------------- */
    const apseProf = [
      [apseR, 0], [apseR + 0.16, 0.18], [apseR, 0.5],
      [apseR * 0.98, wallH * 0.82], [apseR * 1.1, wallH * 0.9], [apseR * 1.05, wallH * 0.96],
    ];
    mk(g, Geo.lathe(apseProf, 10), M.stone, 0, 0.35, apseZ);
    mk(g, Geo.coneRoof(apseR * 1.14, 2.1, 10), M.slate, 0, 0.35 + wallH * 0.96, apseZ);
    mk(g, finialGeo(0.2, 0.6), M.gold, 0, 0.35 + wallH * 0.96 + 2.1, apseZ);
    for (let i = 0; i < 3; i++) {
      const a = Math.PI + (i - 1) * 0.62;
      const wg = grp('apseWin');
      wg.rotation.y = -a - Math.PI / 2;
      wg.position.set(Math.cos(a) * apseR * 0.99, 0, apseZ + Math.sin(a) * apseR * 0.99);
      g.add(wg);
      winUnit(wg, 0.62, 2.1, 0, wallH * 0.28, 0, M.winRose, { t: 0.16, arc: 0.31, sill: false });
    }

    /* -- buttresses down both flanks ------------------------- */
    const nb = 4;
    for (let s = -1; s <= 1; s += 2) {
      for (let i = 0; i < nb; i++) {
        const bz = -navD * 0.32 + (navD * 0.64 * i) / (nb - 1);
        const bh = wallH * 0.86;
        mk(g, Geo.taperBox(0.52, bh, 0.78, 0.72), M.stoneW, (s * navW) / 2, 0.5, bz);
        const cap = mk(g, Geo.pyramidRoof(0.6, 0.86, 0.55, { over: 0.06 }), M.stoneD, (s * navW) / 2, 0.5 + bh, bz);
        cap.rotation.y = s > 0 ? 0 : Math.PI;
      }
    }

    /* -- tall arched windows with coloured glazing ----------- */
    for (let s = -1; s <= 1; s += 2) {
      const side = grp('navSide');
      side.rotation.y = (s * Math.PI) / 2;
      side.position.x = (s * navW) / 2;
      g.add(side);
      for (let i = 0; i < 3; i++) {
        const lz = (i - 1) * navD * 0.24;
        winUnit(side, 1.0, wallH * 0.56, lz, wallH * 0.3, 0,
          i === 1 ? M.winRose : M.winTeal, { t: 0.2, arc: 0.5, sill: false });
        // tracery bar
        mk(side, Geo.box(0.08, wallH * 0.5, 0.06), M.stoneW, lz, wallH * 0.55, -0.02);
      }
    }

    /* -- west tower (centred on the nave front) -------------- */
    const tz = navD / 2 - 1.5;
    const tW = 3.4, ts = towerH - 4.6;
    mk(g, Geo.taperBox(tW + 0.45, 0.6, tW + 0.45, 0.98), M.stoneD, 0, 0, tz);
    mk(g, Geo.taperBox(tW, ts, tW, 0.965), M.stone, 0, 0.6, tz);
    mk(g, quoinsGeo(tW * 0.98, tW * 0.98, ts, 4), M.stoneW, 0, 0.6, tz);
    band(g, tW * 0.94, tW * 0.94, ts * 0.42, 0.24, M.stoneW, 0.2).position.set(0, ts * 0.42 + 0.12, tz);
    band(g, tW * 0.9, tW * 0.9, ts + 0.3, 0.3, M.stoneW, 0.26).position.set(0, ts + 0.45, tz);

    /* rose window over the west door */
    const roseY = ts * 0.62;
    mk(g, Geo.ring(0.86, 1.14, 0.22, 12), M.stoneW, 0, roseY, tz + tW / 2 - 0.02).rotation.x = Math.PI / 2;
    mk(g, Geo.prism(Geo.polyPlan(12, 0.88), 0.07, { center: true }), M.winRose, 0, roseY, tz + tW / 2 - 0.16)
      .rotation.x = Math.PI / 2;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI;
      const sp = mk(g, Geo.box(0.09, 1.72, 0.07), M.stoneW, 0, roseY, tz + tW / 2 - 0.1);
      sp.rotation.z = a;
    }
    mk(g, Geo.lathe([[0.24, 0], [0.2, 0.1]], 8), M.stoneW, 0, roseY, tz + tW / 2 - 0.06).rotation.x = Math.PI / 2;

    /* belfry openings on all four faces */
    for (let i = 0; i < 4; i++) {
      const bg = grp('belfry');
      bg.rotation.y = (i * Math.PI) / 2;
      bg.position.set(0, ts * 0.72, tz);
      g.add(bg);
      mk(bg, Geo.archWall(tW * 0.86, 2.5, 0.3,
        [{ x: 0, y: 0.2, w: 0.92, h: 1.9, arc: 0.46 }]), M.stoneW, 0, 0, tW / 2 - 0.12);
    }
    mk(g, Geo.lathe([[0.4, 0], [0.46, 0.28], [0.3, 0.6], [0.1, 0.74]], 8), M.gold, 0, ts * 0.72 + 0.55, tz);

    /* bell spire + cross + weathercock */
    mk(g, Geo.bellSpire(tW * 0.62, 4.6, 8, 0.5), M.copper, 0, ts + 0.75, tz);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + Math.PI / 4;
      mk(g, Geo.coneRoof(0.34, 0.9, 6), M.copper, Math.cos(a) * tW * 0.42, ts + 0.75, tz + Math.sin(a) * tW * 0.42);
    }
    const crossY = ts + 5.35;
    mk(g, Geo.box(0.11, 1.25, 0.11), M.gold, 0, crossY + 0.6, tz);
    mk(g, Geo.box(0.62, 0.11, 0.1), M.gold, 0, crossY + 0.86, tz);
    const vane = grp('weathercock');
    vane.position.set(0, crossY + 1.32, tz);
    mk(vane, flagGeo(0.5, 0.36, 3), M.gold, 0.06, 0, 0);
    mk(vane, Geo.box(0.05, 0.05, 0.62), M.gold, 0, -0.04, -0.22);
    g.add(vane);
    TOWN.markDynamic(vane);
    TOWN.Ticker.add(function (dt, elapsed) {
      vane.rotation.y = 0.4 + Math.sin(elapsed * 0.23) * 0.5 + Math.sin(elapsed * 0.07) * 0.9;
    }, 'civic.vane' + id);

    /* -- west porch with steps ------------------------------- */
    const pz = tz + tW / 2 + 0.55;
    mk(g, Geo.taperBox(2.9, 3.1, 1.5, 0.96), M.stoneW, 0, 0.3, pz);
    mk(g, Geo.gableRoof(3.1, 1.7, 1.3, { over: 0.3, thick: 0.16 }), M.slate, 0, 3.4, pz);
    doorUnit(g, 1.55, 2.5, 0, 0.32, pz + 0.72, { arc: 0.72, surround: M.stoneW });
    const st = mk(g, Geo.stairs(3.0, 0.34, 0.7, 2), M.stoneD, 0, 0, pz + 1.05);
    st.rotation.y = Math.PI;

    g.userData.towerTop = +(ts + 5.35).toFixed(2);
    g.userData.spireTop = +(ts + 6.6).toFixed(2);
    g.userData.apseAnchor = [0, 0, +apseZ.toFixed(2)];
    g.userData.entrance = [0, 0, +(pz + 1.45).toFixed(2)];
    return finish(g, 'church');
  };

  /* ============================================================
     4 · LIGHTHOUSE — banded taper tower, gallery, rotating beam
     ============================================================ */
  Civic.lighthouse = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 3);
    const M = mats();
    const id = uid();
    const g = grp('lighthouse');

    const baseDia = r.range(4.5, 6);
    const baseR = baseDia / 2;
    const shaftH = r.range(15, 19);
    const rB = baseR * 0.76, rT = baseR * 0.44;
    const wantBeams = opts.beams !== false;

    /* -- rock plinth ----------------------------------------- */
    const rockPlan = Geo.polyPlan(7, baseR * 1.02, 0.3);
    for (let i = 0; i < rockPlan.length; i++) {
      const f = 1 + (U.hash(i * 3.1, (opts.seed || 3) * 1.7) - 0.5) * 0.18;
      rockPlan[i][0] *= f; rockPlan[i][1] *= f;
    }
    mk(g, Geo.prism(rockPlan, 0.75), M.stoneD, 0, 0, 0);
    mk(g, Geo.prism(Geo.polyPlan(9, baseR * 0.86, 0.2), 0.4), M.stoneW, 0, 0.72, 0);

    /* -- painted banded shaft (two colours, alternating) ----- */
    const bands = 6, bandH = shaftH / bands, yb = 1.1;
    for (let i = 0; i < bands; i++) {
      const t0 = i / bands, t1 = (i + 1) / bands;
      const r0 = U.lerp(rB, rT, Math.pow(t0, 0.85)), r1 = U.lerp(rB, rT, Math.pow(t1, 0.85));
      mk(g, Geo.lathe([[r0, 0], [r1, bandH]], 12), i % 2 === 0 ? M.plaster : M.red, 0, yb + bandH * i, 0);
      if (i > 0) {
        mk(g, Geo.ring(r0 * 0.99, r0 * 1.05, 0.12, 12), M.stoneW, 0, yb + bandH * i - 0.06, 0);
      }
    }
    const shaftTopY = yb + shaftH;

    /* -- keeper's door + shaft windows ----------------------- */
    doorUnit(g, 0.85, 1.75, 0, 1.15, rB * 0.99, { arc: 0.42, t: 0.16, surround: M.stoneW });
    for (let i = 0; i < 3; i++) {
      const a = 0.7 + i * 2.1;
      const t = (i + 1) / 4.4;
      const rr = U.lerp(rB, rT, t) * 0.99;
      const wg = grp('shaftWin');
      wg.rotation.y = a;
      wg.position.set(Math.sin(a) * rr, yb + shaftH * t, Math.cos(a) * rr);
      g.add(wg);
      winUnit(wg, 0.42, 0.62, 0, 0, 0, M.win[i % 3], { t: 0.12, arc: 0.2, sill: false });
    }

    /* -- projecting gallery ring + railing -------------------- */
    mk(g, Geo.ring(rT * 0.92, rT * 1.05, 0.5, 12), M.stoneW, 0, shaftTopY - 0.5, 0);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      const cb = mk(g, Geo.taperBox(0.16, 0.5, 0.42, 0.5), M.stoneW,
        Math.cos(a) * rT * 1.14, shaftTopY - 0.5, Math.sin(a) * rT * 1.14);
      cb.rotation.y = -a;
    }
    const galR = rT * 1.62;
    mk(g, Geo.ring(rT * 0.9, galR, 0.2, 12), M.stoneW, 0, shaftTopY, 0);
    mk(g, ringRailingGeo(galR * 0.94, 0.82, 8, { style: 'bar', spacing: 1.2, postR: 0.038 }),
      M.iron, 0, shaftTopY + 0.2, 0);

    /* -- lantern room ---------------------------------------- */
    const lanY = shaftTopY + 0.2, lanR = rT * 0.98, lanH = 1.9;
    mk(g, Geo.prism(Geo.polyPlan(8, lanR * 0.96), lanH), M.win[0], 0, lanY, 0);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + Math.PI / 8;
      const p = mk(g, Geo.taperBox(0.11, lanH, 0.14, 0.95), M.iron,
        Math.cos(a) * lanR, lanY, Math.sin(a) * lanR);
      p.rotation.y = -a;
    }
    mk(g, Geo.ring(lanR * 0.8, lanR * 1.1, 0.14, 8), M.iron, 0, lanY + lanH, 0);
    mk(g, Geo.coneRoof(lanR * 1.3, 1.25, 8), M.iron, 0, lanY + lanH + 0.14, 0);
    mk(g, finialGeo(0.2, 0.8), M.gold, 0, lanY + lanH + 1.35, 0);
    // vent ball
    mk(g, Geo.lathe([[0.16, 0], [0.22, 0.16], [0.14, 0.3]], 8), M.iron, 0, lanY + lanH + 1.3, 0);

    /* -- rotating beacon ------------------------------------- */
    const beacon = grp('beacon');
    beacon.position.set(0, lanY + lanH * 0.52, 0);
    g.add(beacon);
    mk(beacon, Geo.prism(Geo.polyPlan(8, lanR * 0.5), 0.85, { center: true }), M.lens, 0, 0, 0);
    mk(beacon, Geo.ring(lanR * 0.48, lanR * 0.56, 0.1, 8), M.gold, 0, -0.45, 0);
    const halo = TOWN.halo(P.lampWarm, 6, { max: 0.9 });
    beacon.add(halo);
    const beams = [];
    if (wantBeams) {
      for (let i = 0; i < 2; i++) {
        const bg = grp('beam');
        bg.rotation.y = i * Math.PI;
        const cone = Geo.at(Geo.coneRoof(1.45, 8.4, 6), 0, -8.4, 0);
        const bm = new T.Mesh(cone, M.beam);
        bm.rotation.x = -Math.PI / 2 + 0.07;
        bm.userData.dynamic = true;
        bm.userData.fx = true;
        bg.add(bm);
        beacon.add(bg);
        beams.push(bg);
        TOWN.Stage.nightOnly.push(bg);
      }
    }
    TOWN.markDynamic(beacon);
    TOWN.Ticker.add(function (dt) {
      beacon.rotation.y += (TAU / 4) * dt;          // ~4 s per turn
    }, 'civic.beacon' + id);
    const pl = nightLight(g, P.lampWarm, 1.7, 30, 0, lanY + lanH * 0.5, 0, id);

    g.userData.beacon = beacon;
    g.userData.beams = beams;
    g.userData.lanternY = +(lanY + lanH * 0.5).toFixed(2);
    g.userData.light = pl;
    g.userData.baseRadius = +baseR.toFixed(2);
    return finish(g, 'lighthouse');
  };

  /* ============================================================
     5 · WINDMILL — battered stone tower, gallery, 4 rotating sails
     ============================================================ */
  Civic.windmill = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 4);
    const M = mats();
    const id = uid();
    const g = grp('windmill');

    const h = r.range(11, 14);
    const rB = r.range(2.7, 3.2);
    const rT = rB * 0.62;

    /* -- battered stone tower -------------------------------- */
    mk(g, Geo.prism(Geo.polyPlan(12, rB * 1.1), 0.45), M.stoneD, 0, 0, 0);
    mk(g, Geo.taperTower(rB, rT, h, 12, { pow: 1.18, steps: 6 }), M.stone, 0, 0.42, 0);
    for (let i = 0; i < 2; i++) {
      const t = 0.28 + i * 0.36;
      const rr = U.lerp(rB, rT, Math.pow(t, 1.18));
      mk(g, Geo.ring(rr * 0.99, rr * 1.07, 0.16, 12), M.stoneW, 0, 0.42 + h * t, 0);
    }

    /* -- timber gallery balcony ------------------------------ */
    const galY = 0.42 + h * 0.44;
    const galR = U.lerp(rB, rT, Math.pow(0.44, 1.18)) * 1.5;
    mk(g, Geo.ring(galR * 0.62, galR, 0.16, 12), M.wood, 0, galY, 0);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      const br = mk(g, Geo.taperBox(0.13, 0.72, 0.5, 0.4), M.woodD,
        Math.cos(a) * galR * 0.82, galY - 0.66, Math.sin(a) * galR * 0.82);
      br.rotation.y = -a;
    }
    mk(g, hoopRailingGeo(galR * 0.9, 0.85, 10), M.wood, 0, galY + 0.16, 0);

    /* -- openings -------------------------------------------- */
    doorUnit(g, 1.0, 2.0, 0, 0.45, rB * 0.965, { arc: 0.4, t: 0.18, surround: M.stoneW });
    doorUnit(g, 0.9, 1.7, 0, galY + 0.16, U.lerp(rB, rT, Math.pow(0.46, 1.18)) * 0.95,
      { arc: 0.36, t: 0.16, surround: M.stoneW, mat: M.wood });
    for (let i = 0; i < 3; i++) {
      const a = 1.7 + i * 1.9, t = 0.2 + i * 0.24;
      const rr = U.lerp(rB, rT, Math.pow(t, 1.18)) * 0.96;
      const wg = grp('millWin');
      wg.rotation.y = a;
      wg.position.set(Math.sin(a) * rr, 0.42 + h * t, Math.cos(a) * rr);
      g.add(wg);
      winUnit(wg, 0.55, 0.8, 0, 0, 0, M.win[i % 3], { t: 0.14, sill: false });
    }

    /* -- boat-shaped cap + sack hoist ------------------------ */
    const capY = 0.42 + h;
    mk(g, Geo.ring(rT * 0.95, rT * 1.22, 0.22, 12), M.woodD, 0, capY, 0);
    mk(g, Geo.domeRoof(rT * 1.16, 2.15, 10), M.copper, 0, capY + 0.22, 0);
    mk(g, finialGeo(0.16, 0.5), M.gold, 0, capY + 2.3, 0);
    // hoist beam + wheel out of the back of the cap
    mk(g, Geo.box(0.16, 0.16, 2.3), M.woodD, 0, capY + 0.5, -rT * 1.5);
    mk(g, Geo.ring(0.28, 0.42, 0.12, 8), M.woodD, 0, capY + 0.45, -rT * 1.5 - 1.05)
      .rotation.x = Math.PI / 2;
    mk(g, Geo.box(0.06, 1.6, 0.06), M.woodD, 0, capY - 0.35, -rT * 1.5 - 1.05);

    /* -- windshaft + 4 lattice sails ------------------------- */
    const hubZ = rT * 1.35, hubY = capY + 0.95;
    mk(g, Geo.taperTower(0.2, 0.16, 1.1, 6, { steps: 1 }), M.woodD, 0, hubY - 0.1, hubZ * 0.6)
      .rotation.x = Math.PI / 2 - 6 * DEG;
    const sails = grp('sails');
    sails.position.set(0, hubY, hubZ);
    sails.rotation.x = 6 * DEG;
    g.add(sails);
    const sailR = h * 0.3 + 0.7;
    const parts = [];
    const spar = Geo.box(0.14, sailR, 0.1);
    const bar = Geo.box(0.9, 0.06, 0.07);
    const edge = Geo.box(0.07, sailR * 0.86, 0.07);
    for (let s = 0; s < 4; s++) {
      const rot = (s / 4) * TAU;
      const local = [];
      local.push(Geo.at(spar, 0, sailR * 0.5 + 0.35, 0));
      local.push(Geo.at(edge, 0.42, sailR * 0.5 + 0.4, 0.02));
      local.push(Geo.at(edge, -0.42, sailR * 0.5 + 0.4, 0.02));
      for (let k = 0; k < 6; k++) {
        local.push(Geo.at(bar, 0, 0.75 + (sailR * 0.82 * k) / 5, 0.02));
      }
      const merged = Geo.mergeGeometries(local);
      merged.applyMatrix4(new T.Matrix4().makeRotationZ(rot));
      parts.push(merged);
    }
    mk(sails, Geo.lathe([[0.3, 0], [0.34, 0.16], [0.24, 0.34]], 8), M.woodD, 0, 0, 0)
      .rotation.x = -Math.PI / 2;
    const sailMesh = mk(sails, Geo.mergeGeometries(parts), M.wood, 0, 0, 0.16);
    sailMesh.name = 'sailFrames';
    TOWN.markDynamic(sails);
    TOWN.Ticker.add(function (dt) {
      sails.rotation.z += 0.25 * dt;
    }, 'civic.sails' + id);

    g.userData.sails = sails;
    g.userData.sailRadius = +sailR.toFixed(2);
    g.userData.hub = [0, +hubY.toFixed(2), +hubZ.toFixed(2)];
    g.userData.galleryY = +galY.toFixed(2);
    g.userData.capTop = +(capY + 2.8).toFixed(2);
    g.userData.towerHeight = +(0.42 + h).toFixed(2);
    return finish(g, 'windmill');
  };

  /* ============================================================
     6 · WATERMILL — stone+timber house with a rotating waterwheel
     ============================================================ */
  Civic.watermill = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 5);
    const M = mats();
    const id = uid();
    const g = grp('watermill');

    const w = r.range(7, 8.2);
    const d = r.range(6, 8);
    const h = r.range(6, 7.4);             // eaves height (roof + chimney above)
    const side = r.chance(0.5) ? 1 : -1;
    const wheelR = r.range(2.0, 2.6);
    const stoneH = h * 0.55;

    /* -- stone ground floor + jettied timber upper floor ----- */
    mk(g, Geo.taperBox(w + 0.4, 0.4, d + 0.4, 0.97), M.stoneD, 0, 0, 0);
    mk(g, Geo.taperBox(w, stoneH, d, 0.985), M.stone, 0, 0.38, 0);
    band(g, w, d, stoneH + 0.3, 0.2, M.woodD, 0.18);
    mk(g, Geo.chamferBox(w + 0.3, h - stoneH - 0.5, d + 0.3, 0.12), M.plaster,
      0, stoneH + 0.5 + (h - stoneH - 0.5) / 2, 0);
    // exposed half-timbering (small boxes = detail)
    const tim = [];
    const upH = h - stoneH - 0.5, upY = stoneH + 0.5;
    for (let i = 0; i < 5; i++) {
      tim.push(Geo.at(Geo.box(0.15, upH, 0.1), -w / 2 + 0.4 + (w - 0.8) * (i / 4), upY + upH / 2, (d + 0.3) / 2));
      tim.push(Geo.at(Geo.box(0.15, upH, 0.1), -w / 2 + 0.4 + (w - 0.8) * (i / 4), upY + upH / 2, -(d + 0.3) / 2));
    }
    tim.push(Geo.at(Geo.box(w + 0.3, 0.16, 0.1), 0, upY + upH * 0.55, (d + 0.3) / 2));
    tim.push(Geo.at(Geo.box(w + 0.3, 0.16, 0.1), 0, upY + upH * 0.55, -(d + 0.3) / 2));
    mk(g, Geo.mergeGeometries(tim), M.woodD, 0, 0, 0);

    /* -- gable roof + chimney + dormer ----------------------- */
    const eaves = h;
    mk(g, Geo.gableRoof(w + 0.3, d + 0.3, 2.3, { over: 0.44, thick: 0.18, ridgeShift: 0 }), M.tile, 0, eaves, 0);
    const chX = -w / 2 + 1.1;
    mk(g, Geo.taperBox(0.8, 2.9, 0.8, 0.9), M.brick, chX, eaves - 0.6, -d * 0.2);
    mk(g, Geo.chamferBox(1.05, 0.22, 1.05, 0.05), M.stoneW, chX, eaves + 2.3, -d * 0.2);
    mk(g, Geo.lathe([[0.16, 0], [0.2, 0.1], [0.16, 0.4]], 6), M.stoneD, chX, eaves + 2.4, -d * 0.2);
    // dormer
    mk(g, Geo.chamferBox(1.2, 1.0, 0.9, 0.08), M.plaster, w * 0.2, eaves + 0.5, d * 0.16);
    mk(g, Geo.gableRoof(1.4, 1.1, 0.6, { over: 0.16, thick: 0.1 }), M.tile, w * 0.2, eaves + 1.5, d * 0.16);
    winUnit(g, 0.6, 0.7, w * 0.2, eaves + 0.7, d * 0.16 + 0.46, M.win[1], { t: 0.12, sill: false });

    /* -- openings -------------------------------------------- */
    doorUnit(g, 1.1, 2.1, -w * 0.22, 0.4, d / 2 + 0.02, { arc: 0, t: 0.2, surround: M.stoneW });
    winUnit(g, 1.0, 1.0, w * 0.2, 1.2, d / 2 + 0.02, M.win[0], { t: 0.18, muntins: [2, 2] });
    winUnit(g, 0.9, 1.1, -w * 0.24, upY + upH * 0.3, (d + 0.3) / 2, M.win[2], { t: 0.16, muntins: [2, 2] });
    winUnit(g, 0.9, 1.1, w * 0.24, upY + upH * 0.3, (d + 0.3) / 2, M.win[1], { t: 0.16, muntins: [2, 2] });
    const backSide = grp('back');
    backSide.rotation.y = Math.PI;
    g.add(backSide);
    winUnit(backSide, 0.9, 1.0, 0, 1.3, d / 2 + 0.02, M.win[2], { t: 0.16 });

    /* -- rotating waterwheel -------------------------------- */
    const wx = side * (w / 2 + 0.55);
    const wheelY = wheelR + 0.22;
    const wheel = grp('waterwheel');
    wheel.position.set(wx, wheelY, -d * 0.05);
    wheel.rotation.y = Math.PI / 2;
    g.add(wheel);
    for (let i = -1; i <= 1; i += 2) {
      const rim = mk(wheel, Geo.torus(wheelR, 0.085, 14, 4), M.woodD, 0, 0, i * 0.34);
      rim.name = 'rim';
      const inner = mk(wheel, Geo.torus(wheelR * 0.55, 0.06, 12, 4), M.woodD, 0, 0, i * 0.34);
      inner.name = 'innerRim';
    }
    const spokes = [], paddles = [];
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI;                 // 5 crossing bars = 10 arms
      const sp = Geo.box(0.09, wheelR * 1.94, 0.09);
      const m = new T.Matrix4().makeRotationZ(a);
      const gg = sp.clone(); gg.applyMatrix4(m);
      spokes.push(gg);
    }
    mk(wheel, Geo.mergeGeometries(spokes), M.woodD, 0, 0, 0);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU;
      const pd = Geo.box(0.55, 0.07, 0.82);
      const mm = new T.Matrix4().makeRotationZ(a + Math.PI / 2);
      const gg = pd.clone();
      gg.translate(wheelR * 0.86, 0, 0);
      gg.applyMatrix4(mm);
      paddles.push(gg);
    }
    mk(wheel, Geo.mergeGeometries(paddles), M.wood, 0, 0, 0);
    mk(wheel, Geo.lathe([[0.16, -0.55], [0.16, 0.55]], 8), M.iron, 0, 0, 0).rotation.x = Math.PI / 2;
    TOWN.markDynamic(wheel);
    TOWN.Ticker.add(function (dt) {
      wheel.rotation.z += 0.6 * dt;
    }, 'civic.wheel' + id);
    // axle bearing on the wall
    mk(g, Geo.prism(Geo.polyPlan(6, 0.3), 0.5), M.stoneW, side * (w / 2 - 0.1), wheelY - 0.25, -d * 0.05);

    /* -- flume / launder feeding the wheel ------------------- */
    const fz = -d * 0.05;
    const flume = grp('flume');
    g.add(flume);
    const fl = 1.5;
    const bed = mk(flume, Geo.taperBox(fl, 0.16, 0.9, 1), M.wood, wx + side * (fl / 2 + 0.1), wheelY + wheelR * 0.72, fz);
    bed.rotation.z = side * -7 * DEG;
    for (let i = -1; i <= 1; i += 2) {
      const sw = mk(flume, Geo.taperBox(fl, 0.34, 0.1, 1), M.woodD,
        wx + side * (fl / 2 + 0.1), wheelY + wheelR * 0.72 + 0.2, fz + i * 0.42);
      sw.rotation.z = side * -7 * DEG;
    }
    for (let i = 0; i < 2; i++) {
      const tx = wx + side * (0.75 + i * 1.15);
      mk(flume, Geo.taperBox(0.16, wheelY + wheelR * 0.6, 0.16, 0.8), M.woodD, tx, 0, fz + 0.42);
      mk(flume, Geo.taperBox(0.16, wheelY + wheelR * 0.6, 0.16, 0.8), M.woodD, tx, 0, fz - 0.42);
      mk(flume, Geo.box(0.12, 0.12, 1.0), M.woodD, tx, wheelY + wheelR * 0.62, fz);
    }

    g.userData.wheel = wheel;
    g.userData.wheelSide = side > 0 ? '+X' : '-X';
    g.userData.eavesHeight = +h.toFixed(2);
    g.userData.wheelRadius = +wheelR.toFixed(2);
    g.userData.wheelAnchor = [+wx.toFixed(2), +(wheelY - wheelR).toFixed(2), +fz.toFixed(2)];
    g.userData.flumeInlet = [+(wx + side * (fl + 0.2)).toFixed(2), +(wheelY + wheelR * 0.8).toFixed(2), +fz.toFixed(2)];
    return finish(g, 'watermill');
  };

  /* ============================================================
     7 · STATION — raised platform, iron columns, barrel canopy
     ============================================================ */
  Civic.station = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 6);
    const M = mats();
    const id = uid();
    const g = grp('station');

    const w = r.range(13, 16);
    const d = r.range(5, 7);
    const platformY = 0.35;
    const colH = r.range(3.0, 3.4);

    /* -- platform -------------------------------------------- */
    mk(g, Geo.chamferBox(w, platformY, d, 0.18), M.stone, 0, platformY / 2, 0);
    mk(g, Geo.box(w, 0.1, 0.34), M.stoneW, 0, platformY - 0.03, d / 2 - 0.17);
    mk(g, Geo.box(w, 0.1, 0.34), M.stoneW, 0, platformY - 0.03, -d / 2 + 0.17);
    mk(g, Geo.box(w, 0.06, 0.22), M.red, 0, platformY + 0.02, d / 2 - 0.5);
    // brick face + a couple of steps at the near end
    mk(g, Geo.taperBox(w + 0.16, platformY * 0.9, d + 0.16, 0.99), M.brick, 0, 0, 0);
    const st = mk(g, Geo.stairs(2.2, platformY, 0.8, 2), M.stoneD, -w / 2 + 2.0, 0, d / 2 + 0.4);
    st.rotation.y = Math.PI;

    /* -- cast-iron columns + spandrel brackets --------------- */
    const nCol = 6, colZ = 0;
    const colX = [];
    for (let i = 0; i < nCol; i++) {
      const x = -w / 2 + 1.4 + ((w - 2.8) * i) / (nCol - 1);
      colX.push(x);
      mk(g, Geo.prism(Geo.polyPlan(6, 0.22), 0.22), M.iron, x, platformY, colZ);
      mk(g, Geo.taperTower(0.13, 0.1, colH, 6, { steps: 2 }), M.iron, x, platformY + 0.22, colZ);
      mk(g, Geo.lathe([[0.1, 0], [0.2, 0.14], [0.15, 0.26], [0.24, 0.34]], 6), M.iron,
        x, platformY + 0.22 + colH, colZ);
      if (i > 0) {
        // openwork spandrel between columns
        const x0 = colX[i - 1], span = x - x0;
        const v = [
          [-span / 2 + 0.1, 0, 0], [span / 2 - 0.1, 0, 0], [span / 2 - 0.1, -0.5, 0], [-span / 2 + 0.1, -0.5, 0],
        ];
        mk(g, Geo.fromQuads(v, [[0, 1, 2], [0, 2, 3]]), M.iron, (x + x0) / 2, platformY + 0.22 + colH, colZ);
      }
    }
    // longitudinal beam
    mk(g, Geo.box(w - 2.0, 0.24, 0.36), M.iron, 0, platformY + colH + 0.5, colZ);

    /* -- barrel-vault canopy + valance ----------------------- */
    const canY = platformY + colH + 0.6;
    mk(g, Geo.barrelRoof(w - 1.0, d + 1.1, 1.55, 8, { over: 0.4, thick: 0.14 }), M.slate, 0, canY, 0);
    for (let s = -1; s <= 1; s += 2) {
      const zz = s * ((d + 1.1) / 2 + 0.4);
      const v = [], f = [];
      const teeth = 12, len = w - 0.2;
      for (let i = 0; i <= teeth; i++) {
        const x = -len / 2 + (len * i) / teeth;
        v.push([x, 0, 0]); v.push([x, -0.34, 0]);
      }
      for (let i = 0; i < teeth; i++) {
        const a = i * 2;
        f.push([a, a + 2, a + 1]);
        f.push([a + 1, a + 2, a]);
      }
      mk(g, Geo.fromQuads(v, f), M.woodD, 0, canY + 0.05, zz);
      mk(g, Geo.box(len, 0.14, 0.12), M.woodD, 0, canY + 0.06, zz);
    }

    /* -- ticket office --------------------------------------- */
    const ox = -w / 2 + 2.6, oW = 3.6, oD = d - 1.6, oH = 2.7;
    mk(g, Geo.chamferBox(oW, oH, oD, 0.14), M.brick, ox, platformY + oH / 2, -0.35);
    band(g, oW, oD, platformY + oH - 0.2, 0.22, M.stoneW, 0.16).position.set(ox, platformY + oH - 0.09, -0.35);
    mk(g, Geo.hipRoof(oW, oD, 0.85, { over: 0.28, ridge: 0.4 }), M.tile, ox, platformY + oH + 0.02, -0.35);
    mk(g, Geo.taperBox(0.5, 1.3, 0.5, 0.88), M.brick, ox - oW * 0.3, platformY + oH + 0.3, -0.35);
    mk(g, Geo.chamferBox(0.7, 0.16, 0.7, 0.04), M.stoneW, ox - oW * 0.3, platformY + oH + 1.65, -0.35);
    doorUnit(g, 1.0, 2.0, ox + 0.9, platformY + 0.02, -0.35 + oD / 2, { t: 0.16, surround: M.stoneW });
    winUnit(g, 1.1, 1.1, ox - 0.9, platformY + 0.9, -0.35 + oD / 2, M.win[0], { t: 0.16, muntins: [3, 2] });
    // station clock on a bracket
    const clock = clockAssembly(0.55, false, id);
    clock.position.set(ox + oW / 2 + 0.7, platformY + 2.5, -0.35 + oD / 2 - 0.1);
    g.add(clock);
    mk(g, Geo.box(0.1, 0.1, 0.5), M.iron, ox + oW / 2 + 0.7, platformY + 2.5, -0.35 + oD / 2 - 0.42);

    /* -- name board, benches, lamps -------------------------- */
    mk(g, Geo.box(3.2, 0.62, 0.1), M.boardS, w * 0.16, platformY + 2.35, -0.55);
    mk(g, Geo.chamferBox(3.4, 0.1, 0.16, 0.03), M.woodD, w * 0.16, platformY + 2.02, -0.55);
    for (let i = -1; i <= 1; i += 2) {
      mk(g, Geo.taperTower(0.07, 0.06, 2.05, 6, { steps: 1 }), M.iron, w * 0.16 + i * 1.4, platformY, -0.55);
    }
    const benchSockets = [];
    for (let i = 0; i < 2; i++) {
      const bx = w * 0.1 + i * 3.2;
      benchSockets.push([+bx.toFixed(2), platformY, 0.7]);
      mk(g, Geo.chamferBox(1.7, 0.1, 0.5, 0.04), M.wood, bx, platformY + 0.44, 0.7);
      mk(g, Geo.chamferBox(1.7, 0.5, 0.1, 0.04), M.wood, bx, platformY + 0.68, 0.52);
      for (let s = -1; s <= 1; s += 2) {
        mk(g, Geo.taperBox(0.12, 0.44, 0.46, 0.8), M.iron, bx + s * 0.7, platformY, 0.7);
      }
    }
    const lamps = [];
    for (let i = 0; i < 3; i++) {
      const lx = -w / 2 + 2.8 + ((w - 5.6) * i) / 2;
      mk(g, Geo.box(0.08, 0.5, 0.08), M.iron, lx, canY - 0.35, 0.1);
      lamps.push(lantern(g, lx, canY - 0.72, 0.1, 0.19, 2.6));
    }

    g.userData.platformY = platformY;
    g.userData.canopyY = +canY.toFixed(2);
    g.userData.benchSockets = benchSockets;
    g.userData.lamps = lamps;
    g.userData.trackSide = '+Z';
    g.userData.clock = clock;
    return finish(g, 'station');
  };

  /* ============================================================
     8 · LIBRARY — colonnaded portico, drum + dome, urns
     ============================================================ */
  Civic.library = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 7);
    const M = mats();
    const g = grp('library');

    const w = r.range(12, 15);
    const d = r.range(9, 11);
    const h = r.range(10.5, 12);           // overall height, dome finial included
    const y0 = 1.15;                       // podium
    const blockTop = h - 4.45;             // cornice level of the main block
    const bodyH = blockTop - y0 - 0.8;

    /* -- podium + body -------------------------------------- */
    mk(g, Geo.taperBox(w + 0.7, y0, d + 0.7, 0.99), M.stoneD, 0, 0, 0);
    mk(g, Geo.chamferBox(w + 0.36, 0.2, d + 0.36, 0.06), M.stoneW, 0, y0 + 0.06, 0);
    mk(g, Geo.chamferBox(w, bodyH, d, 0.2), M.stoneW, 0, y0 + bodyH / 2, 0);
    mk(g, quoinsGeo(w, d, bodyH, 2), M.stone, 0, y0, 0);
    band(g, w, d, y0 + bodyH * 0.62, 0.22, M.stone, 0.24);
    band(g, w, d, blockTop - 0.8, 0.44, M.stone, 0.4);    // entablature
    mk(g, Geo.chamferBox(w + 0.6, 0.2, d + 0.6, 0.05), M.stoneD, 0, blockTop - 0.9, 0);

    /* -- windows --------------------------------------------- */
    for (let i = 0; i < 4; i++) {
      const x = (i - 1.5) * (w / 4.6);
      winUnit(g, 1.05, bodyH * 0.5, x, y0 + 0.7, d / 2, M.win[r.int(0, 3)], { arc: 0.44 });
      winUnit(g, 0.9, bodyH * 0.22, x, y0 + bodyH * 0.74, d / 2, M.win[r.int(0, 3)], { t: 0.2, sill: false });
    }
    for (let s = -1; s <= 1; s += 2) {
      const side = grp('side');
      side.rotation.y = (s * Math.PI) / 2;
      side.position.x = (s * w) / 2;
      g.add(side);
      for (let i = 0; i < 2; i++) {
        winUnit(side, 1.0, bodyH * 0.48, (i - 0.5) * (d * 0.36), y0 + 0.7, 0,
          M.win[r.int(0, 3)], { t: 0.2 });
      }
    }
    for (let i = 0; i < 2; i++) {
      winUnit(g, 1.0, bodyH * 0.44, (i - 0.5) * (w / 2.6), y0 + 0.7, -d / 2, M.win[r.int(0, 3)], { t: 0.2 });
    }

    /* -- colonnaded portico (6 columns, entasis) ------------- */
    const pW = w * 0.72, colH = blockTop - y0 - 1.1, pz = d / 2 + 1.15;
    const colProf = [                                   // base, entasis, capital
      [0.42, 0], [0.33, 0.34], [0.3, colH * 0.62], [0.25, colH * 0.9], [0.35, colH],
    ];
    const colGeo = Geo.lathe(colProf, 8);
    for (let i = 0; i < 6; i++) {
      const cx = -pW / 2 + (pW * i) / 5;
      mk(g, colGeo.clone(), M.stoneW, cx, y0 + 0.02, pz);
      mk(g, Geo.prism(Geo.polyPlan(4, 0.42, Math.PI / 4), 0.2), M.stoneW, cx, y0 + 0.02 + colH, pz);
    }
    // portico entablature + pediment
    mk(g, Geo.chamferBox(pW + 1.3, 0.7, 2.4, 0.1), M.stoneW, 0, y0 + colH + 0.78, pz - 0.1);
    mk(g, Geo.chamferBox(pW + 1.6, 0.2, 2.7, 0.05), M.stoneD, 0, y0 + colH + 1.2, pz - 0.1);
    mk(g, pedimentGeo(pW + 1.6, 1.7, 2.2, 0), M.stoneW, 0, y0 + colH + 1.3, pz - 0.1);
    mk(g, Geo.lathe([[0.4, 0], [0.34, 0.2], [0.14, 0.4]], 8), M.gold, 0, y0 + colH + 3.0, pz - 0.1);
    // ceiling of the portico
    mk(g, Geo.box(pW + 0.9, 0.16, 2.2), M.stone, 0, y0 + colH + 0.35, pz - 0.1);
    doorUnit(g, 1.9, 3.0, 0, y0 + 0.02, d / 2 + 0.02, { arc: 0.8, t: 0.3, surround: M.stone });

    /* -- entrance stair -------------------------------------- */
    const st = mk(g, Geo.stairs(pW + 1.2, y0, 1.6, 4), M.stoneD, 0, 0, pz + 1.45);
    st.rotation.y = Math.PI;
    for (let s = -1; s <= 1; s += 2) {
      mk(g, Geo.taperBox(0.42, y0 + 0.3, 1.7, 0.9), M.stoneD, (s * (pW + 1.9)) / 2, 0, pz + 1.45);
      mk(g, Geo.lathe([[0.02, 0], [0.26, 0.2], [0.19, 0.4], [0.05, 0.48]], 6), M.stoneW,
        (s * (pW + 1.9)) / 2, y0 + 0.3, pz + 1.45);
    }

    /* -- parapet, urns, low dome on a drum ------------------- */
    const pyy = blockTop - 0.36;
    mk(g, balustradeGeo(w - 2.6, 1.0, 1.35), M.stoneW, 0, pyy, d / 2 + 0.16);
    mk(g, balustradeGeo(w - 2.6, 1.0, 1.35), M.stoneW, 0, pyy, -d / 2 - 0.16);
    for (let s = -1; s <= 1; s += 2) {
      const b = mk(g, Geo.chamferBox(d - 2.6, 0.86, 0.4, 0.05), M.stoneW, s * (w / 2 + 0.16), pyy + 0.43, 0);
      b.rotation.y = Math.PI / 2;
      const c2 = mk(g, Geo.chamferBox(d - 2.4, 0.14, 0.54, 0.04), M.stoneD, s * (w / 2 + 0.16), pyy + 0.93, 0);
      c2.rotation.y = Math.PI / 2;
    }
    const cs = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    for (let c = 0; c < 4; c++) {
      const s = cs[c];
      const cx = (s[0] * w) / 2 + s[0] * 0.18, cz = (s[1] * d) / 2 + s[1] * 0.18;
      mk(g, Geo.prism(Geo.polyPlan(4, 0.46, Math.PI / 4), 1.25), M.stoneW, cx, pyy, cz);
      if (s[1] > 0) mk(g, urnGeo(0.28, 0.8), M.stoneW, cx, pyy + 1.25, cz);
    }
    mk(g, Geo.hipRoof(w - 1.6, d - 1.6, 1.1, { over: 0.1, ridge: 0.5 }), M.slate, 0, pyy + 0.5, 0);
    const drumR = Math.min(w, d) * 0.24;
    mk(g, Geo.prism(Geo.polyPlan(10, drumR), 1.15), M.stoneW, 0, pyy + 0.5, -0.2);
    mk(g, Geo.ring(drumR * 0.96, drumR * 1.14, 0.2, 10), M.stone, 0, pyy + 1.65, -0.2);
    for (let i = 0; i < 2; i++) {
      const a = i * Math.PI + Math.PI / 4;
      const wg = grp('drumWin');
      wg.rotation.y = a;
      wg.position.set(Math.sin(a) * drumR * 0.98, pyy + 0.62, -0.2 + Math.cos(a) * drumR * 0.98);
      g.add(wg);
      winUnit(wg, 0.32, 0.6, 0, 0, 0, M.win[i % 3], { t: 0.1, sill: false });
    }
    const domeH = drumR * 0.78;
    mk(g, Geo.domeRoof(drumR * 1.12, domeH, 10), M.copper, 0, pyy + 1.85, -0.2);
    mk(g, Geo.prism(Geo.polyPlan(8, drumR * 0.26), 0.45), M.stoneW, 0, pyy + 1.85 + domeH * 0.97, -0.2);
    mk(g, Geo.coneRoof(drumR * 0.34, 0.45, 8), M.copper, 0, pyy + 2.3 + domeH * 0.97, -0.2);
    mk(g, finialGeo(0.18, 0.6), M.gold, 0, pyy + 2.75 + domeH * 0.97, -0.2);

    g.userData.porticoZ = +pz.toFixed(2);
    g.userData.stepsFront = +(pz + 2.25).toFixed(2);
    g.userData.domeTop = +(pyy + 3.35 + domeH * 0.97).toFixed(2);
    g.userData.bodyHeight = +blockTop.toFixed(2);
    g.userData.entrance = [0, y0, +(pz + 2.25).toFixed(2)];
    return finish(g, 'library');
  };

  /* ============================================================
     9 · MARKET — open arcaded hall, sawtooth glazed roof
     ============================================================ */
  Civic.market = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 8);
    const M = mats();
    const g = grp('market');

    const w = r.range(11, 14);
    const d = r.range(8, 10);
    const h = r.range(5, 7);
    const arcH = h - 1.1;

    /* -- stone floor slab ------------------------------------ */
    mk(g, Geo.prism(Geo.roundRectPlan(w + 0.8, d + 0.8, 0.5, 2), 0.26), M.stoneD, 0, 0, 0);
    mk(g, Geo.chamferBox(w - 0.4, 0.1, d - 0.4, 0.1), M.stone, 0, 0.28, 0);

    /* -- long sides: piers + arched trusses in one archWall --- */
    const bays = 4, holes = [];
    const bw = (w - 0.9) / bays;
    for (let i = 0; i < bays; i++) {
      holes.push({
        x: -w / 2 + 0.45 + bw * (i + 0.5), y: 0.1,
        w: bw * 0.76, h: arcH * 0.84, arc: bw * 0.38,
      });
    }
    for (let s = -1; s <= 1; s += 2) {
      mk(g, Geo.archWall(w, arcH, 0.42, holes), M.stoneW, 0, 0.26, (s * d) / 2);
    }
    // corner piers, ends left open
    const cs = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    for (let c = 0; c < 4; c++) {
      const s = cs[c];
      mk(g, Geo.chamferBox(0.62, arcH + 0.2, 0.62, 0.07), M.stone,
        (s[0] * (w - 0.1)) / 2, 0.26 + (arcH + 0.2) / 2, (s[1] * (d - 0.1)) / 2);
      mk(g, Geo.chamferBox(0.82, 0.18, 0.82, 0.05), M.stoneW,
        (s[0] * (w - 0.1)) / 2, 0.26 + arcH + 0.28, (s[1] * (d - 0.1)) / 2);
    }
    // one mid pier per short end + tie beams across
    for (let s = -1; s <= 1; s += 2) {
      mk(g, Geo.chamferBox(0.5, arcH, 0.5, 0.06), M.stone, 0, 0.26 + arcH / 2, (s * (d - 0.1)) / 2);
    }
    for (let i = 0; i < 4; i++) {
      const bz = -d / 2 + 0.9 + ((d - 1.8) * i) / 3;
      mk(g, Geo.box(w - 0.6, 0.16, 0.14), M.iron, 0, 0.26 + arcH - 0.12, bz);
      mk(g, Geo.box(w - 0.6, 0.1, 0.1), M.iron, 0, 0.26 + arcH - 0.55, bz);
    }

    /* -- eaves + sawtooth roof with glazing runs ------------- */
    const eaves = 0.26 + arcH;
    band(g, w, d, eaves, 0.26, M.stoneW, 0.3);
    const teeth = 3, toothH = 1.35;
    mk(g, Geo.sawtoothRoof(w + 0.55, d + 0.45, toothH, teeth), M.tile, 0, eaves + 0.26, 0);
    const step = (d + 0.45) / teeth;
    for (let i = 0; i < teeth; i++) {
      const z = -(d + 0.45) / 2 + step * (i + 1);
      mk(g, Geo.box(w + 0.3, toothH * 0.82, 0.07), M.win[1], 0, eaves + 0.26 + toothH * 0.46, z - 0.04);
      mk(g, Geo.box(w + 0.42, 0.1, 0.16), M.woodD, 0, eaves + 0.26 + toothH * 0.9, z + 0.02);
      const mu = Geo.muntins(w + 0.3, toothH * 0.8, 7, 1, 0.06, 0.1);
      if (mu) mk(g, mu, M.woodD, 0, eaves + 0.26 + toothH * 0.46, z - 0.1);
    }

    /* -- clock gable at the +Z end --------------------------- */
    mk(g, pedimentGeo(w * 0.4, 1.5, 0.5), M.stoneW, 0, eaves + 0.26, d / 2 + 0.28);
    mk(g, Geo.chamferBox(w * 0.42, 0.24, 0.62, 0.05), M.stoneD, 0, eaves + 0.14, d / 2 + 0.28);
    const clock = clockAssembly(0.5, false, uid());
    clock.position.set(0, eaves + 0.85, d / 2 + 0.56);
    g.add(clock);

    /* -- hanging lamps --------------------------------------- */
    const lamps = [];
    for (let i = 0; i < 4; i++) {
      const lx = -w / 2 + 1.8 + ((w - 3.6) * i) / 3;
      mk(g, Geo.box(0.06, 0.7, 0.06), M.iron, lx, eaves - 0.5, 0);
      lamps.push(lantern(g, lx, eaves - 0.95, 0, 0.2, 3.0));
    }

    /* -- produce crates hinted at the edges ------------------ */
    const slots = [];
    for (let i = 0; i < 4; i++) {
      const cx = -w / 2 + 1.6 + ((w - 3.2) * i) / 3;
      const cz = (i % 2 === 0 ? 1 : -1) * (d / 2 - 1.1);
      slots.push([+cx.toFixed(2), 0.28, +cz.toFixed(2)]);
      mk(g, Geo.chamferBox(0.78, 0.46, 0.62, 0.05), M.wood, cx, 0.51, cz);
      mk(g, Geo.chamferBox(0.66, 0.38, 0.52, 0.05), M.woodD, cx + 0.1, 0.93, cz - 0.06)
        .rotation.y = 0.22;
      mk(g, Geo.lathe([[0.24, 0], [0.3, 0.16], [0.2, 0.42]], 6), M.plaster, cx - 0.5, 0.28, cz + 0.5);
    }

    g.userData.lamps = lamps;
    g.userData.stallSlots = slots;
    g.userData.clock = clock;
    g.userData.openSides = ['-X', '+X'];
    return finish(g, 'market');
  };

  /* ============================================================
     10 · WAREHOUSE — brick, gambrel roof, swaying hoist block
     ============================================================ */
  Civic.warehouse = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 9);
    const M = mats();
    const id = uid();
    const g = grp('warehouse');

    const w = r.range(11, 14);
    const d = r.range(7, 10);
    const total = r.range(8.2, 10);        // overall height, ridge vent included
    const h = total - 3.05;                // eaves / cornice level

    /* -- brick mass with pilaster strips --------------------- */
    mk(g, Geo.taperBox(w + 0.5, 0.6, d + 0.5, 0.985), M.stoneD, 0, 0, 0);
    mk(g, Geo.chamferBox(w, h - 0.6, d, 0.16), M.brick, 0, 0.6 + (h - 0.6) / 2, 0);
    const nPil = 5;
    for (let i = 0; i < nPil; i++) {
      const x = -w / 2 + 0.75 + ((w - 1.5) * i) / (nPil - 1);
      for (let s = -1; s <= 1; s += 2) {
        mk(g, Geo.taperBox(0.5, h - 1.1, 0.2, 0.96), M.stoneW, x, 0.6, (s * d) / 2);
      }
    }
    for (let s = -1; s <= 1; s += 2) {
      for (let i = 0; i < 3; i++) {
        const z = (i - 1) * (d * 0.32);
        mk(g, Geo.taperBox(0.2, h - 1.1, 0.5, 0.96), M.stoneW, (s * w) / 2, 0.6, z);
      }
    }
    band(g, w, d, h - 0.5, 0.34, M.stoneW, 0.28);
    band(g, w, d, 0.6, 0.18, M.stoneW, 0.2);

    /* -- gambrel roof + ridge ventilators -------------------- */
    mk(g, Geo.mansardRoof(w, d, 2.35, { over: 0.4, knee: 0.55, inset: 0.32, cap: 0.8 }), M.slate, 0, h - 0.16, 0);
    for (let i = -1; i <= 1; i += 2) {
      const vx = i * w * 0.24;
      mk(g, Geo.prism(Geo.polyPlan(6, 0.32), 0.5), M.woodD, vx, h + 2.12, 0);
      mk(g, Geo.coneRoof(0.44, 0.34, 6), M.iron, vx, h + 2.62, 0);
      mk(g, Geo.lathe([[0.06, 0], [0.15, 0.12], [0.05, 0.26]], 6), M.iron, vx, h + 2.96, 0);
    }

    /* -- tall loading doors (three levels) ------------------- */
    const doorX = w * 0.02;
    for (let i = 0; i < 2; i++) {
      const dy = 0.65 + i * ((h - 1.4) / 2);
      doorUnit(g, 1.9, (h - 1.9) / 2 * 0.92, doorX, dy, d / 2 + 0.02,
        { t: 0.24, surround: M.stoneW, mat: i === 0 ? M.woodD : M.wood, arc: i === 1 ? 0.5 : 0 });
    }
    /* -- windows -------------------------------------------- */
    for (let i = 0; i < 2; i++) {
      const dy = 0.9 + i * ((h - 1.4) / 2);
      for (let s = -1; s <= 1; s += 2) {
        winUnit(g, 0.85, 1.0, doorX + s * (w * 0.28), dy, d / 2 + 0.02, M.win[(i + (s > 0 ? 1 : 2)) % 3],
          { t: 0.18, muntins: [2, 2] });
      }
    }
    const back = grp('back');
    back.rotation.y = Math.PI;
    g.add(back);
    for (let i = 0; i < 2; i++) {
      for (let s = -1; s <= 1; s += 2) {
        winUnit(back, 0.85, 1.0, s * (w * 0.24), 1.2 + i * (h * 0.42), d / 2 + 0.02, M.win[i % 3], { t: 0.18 });
      }
    }

    /* -- projecting hoist beam + swaying pulley block -------- */
    const beamY = h - 0.2, beamZ = d / 2 + 1.25;
    mk(g, Geo.chamferBox(1.5, 1.5, 1.0, 0.1), M.brick, doorX, beamY - 0.2, d / 2 + 0.25);
    mk(g, Geo.gableRoof(1.9, 1.5, 0.8, { over: 0.24, thick: 0.12 }), M.slate, doorX, beamY + 0.55, d / 2 + 0.25);
    mk(g, Geo.box(0.28, 0.3, 2.6), M.woodD, doorX, beamY, d / 2 + 0.55);
    for (let s = -1; s <= 1; s += 2) {
      const br = mk(g, Geo.box(0.18, 1.5, 0.18), M.woodD, doorX + s * 0.22, beamY - 0.9, d / 2 + 0.1);
      br.rotation.x = -0.5;
    }
    mk(g, Geo.ring(0.08, 0.24, 0.14, 8), M.iron, doorX, beamY - 0.22, beamZ).rotation.x = Math.PI / 2;
    const hoist = grp('hoist');
    hoist.position.set(doorX, beamY - 0.28, beamZ);
    g.add(hoist);
    mk(hoist, Geo.box(0.05, 2.0, 0.05), M.iron, 0, -1.0, 0);
    mk(hoist, Geo.chamferBox(0.34, 0.52, 0.24, 0.05), M.woodD, 0, -2.2, 0);
    mk(hoist, Geo.ring(0.05, 0.16, 0.1, 8), M.iron, 0, -2.2, 0.02).rotation.x = Math.PI / 2;
    mk(hoist, Geo.torus(0.13, 0.035, 8, 4), M.iron, 0, -2.62, 0);
    TOWN.markDynamic(hoist);
    TOWN.Ticker.add(function (dt, elapsed) {
      hoist.rotation.z = Math.sin(elapsed * 0.55) * 0.1;
      hoist.rotation.x = Math.sin(elapsed * 0.41 + 0.7) * 0.05;
    }, 'civic.hoist' + id);

    /* -- painted signage + a lamp over the doors ------------- */
    mk(g, Geo.box(w * 0.46, 0.86, 0.09), M.boardW, -w * 0.24, h - 1.55, d / 2 + 0.08);
    mk(g, Geo.chamferBox(w * 0.5, 0.12, 0.2, 0.04), M.woodD, -w * 0.24, h - 1.05, d / 2 + 0.12);
    mk(g, Geo.box(0.08, 0.34, 0.5), M.iron, doorX - 1.6, 3.2, d / 2 + 0.28);
    lantern(g, doorX - 1.6, 3.0, d / 2 + 0.52, 0.18, 2.6);
    // bollards on the quay side
    for (let i = -1; i <= 1; i += 2) {
      mk(g, Geo.lathe([[0.2, 0], [0.22, 0.34], [0.16, 0.42], [0.2, 0.5]], 7), M.iron,
        i * w * 0.36, 0, d / 2 + 0.9);
    }

    g.userData.beam = [+doorX.toFixed(2), +beamY.toFixed(2), +beamZ.toFixed(2)];
    g.userData.hoist = hoist;
    g.userData.doorFace = '+Z';
    g.userData.eavesHeight = +h.toFixed(2);
    g.userData.loadingDoor = [+doorX.toFixed(2), 0.65, +(d / 2).toFixed(2)];
    return finish(g, 'warehouse');
  };

  /* ============================================================
     11 · OBSERVATORY — octagon drum + rotating slit dome
     ============================================================ */
  Civic.observatory = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 10);
    const M = mats();
    const id = uid();
    const g = grp('observatory');

    const rad = r.range(3.0, 3.8);
    const drumH = r.range(5, 7);

    /* -- octagonal stone drum -------------------------------- */
    mk(g, Geo.prism(Geo.polyPlan(8, rad + 0.42, Math.PI / 8), 0.52), M.stoneD, 0, 0, 0);
    mk(g, Geo.prism(Geo.polyPlan(8, rad, Math.PI / 8), drumH), M.stone, 0, 0.5, 0);
    for (let i = 0; i < 2; i++) {
      mk(g, Geo.prism(Geo.polyPlan(8, rad + 0.1, Math.PI / 8), 0.22), M.stoneW, 0, 0.5 + drumH * (0.3 + i * 0.32), 0);
    }
    // corner pilasters on the octagon edges
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      const p = mk(g, Geo.taperBox(0.4, drumH - 0.4, 0.24, 0.94), M.stoneW,
        Math.cos(a) * rad * 0.995, 0.5, Math.sin(a) * rad * 0.995);
      p.rotation.y = -a + Math.PI / 2;
    }
    mk(g, Geo.ring(rad * 0.9, rad + 0.55, 0.3, 8), M.stoneW, 0, 0.5 + drumH, 0);
    mk(g, Geo.ring(rad + 0.2, rad + 0.5, 0.42, 8), M.stoneD, 0, 0.8 + drumH, 0);
    const domeY = 1.3 + drumH;

    /* -- openings -------------------------------------------- */
    doorUnit(g, 1.05, 2.1, 0, 0.5, rad * 0.99, { arc: 0.45, t: 0.2, surround: M.stoneW });
    for (let i = 0; i < 4; i++) {
      const a = Math.PI * 0.5 + i * 0.9;
      const wg = grp('obsWin');
      wg.rotation.y = a;
      wg.position.set(Math.sin(a) * rad * 0.99, 0, Math.cos(a) * rad * 0.99);
      g.add(wg);
      winUnit(wg, 0.6, 1.1, 0, 0.5 + drumH * (i % 2 === 0 ? 0.45 : 0.62), 0, M.win[i % 3],
        { t: 0.16, arc: 0.3, sill: false });
    }

    /* -- rotating hemispherical dome with an open slit ------- */
    const domeR = rad * 1.02, domeH = rad * 0.86;
    const dome = grp('dome');
    dome.position.set(0, domeY, 0);
    g.add(dome);
    mk(dome, Geo.domeRoof(domeR, domeH, 12), M.copper, 0, 0, 0);
    mk(dome, Geo.ring(domeR * 0.98, domeR * 1.04, 0.24, 12), M.iron, 0, -0.2, 0);
    // slit: dark opening strip + two raised ribs, on the dome's +Z meridian
    function meridianStrip(rr, hh, halfAng, steps) {
      const v = [], f = [];
      for (let i = 0; i <= steps; i++) {
        const t = i / steps, a = t * Math.PI * 0.5;
        const cr = Math.cos(a) * rr, yy = Math.sin(a) * hh;
        v.push([Math.sin(-halfAng) * cr, yy, Math.cos(-halfAng) * cr]);
        v.push([Math.sin(halfAng) * cr, yy, Math.cos(halfAng) * cr]);
      }
      for (let i = 0; i < steps; i++) { const a = i * 2; f.push([a, a + 1, a + 3, a + 2]); }
      return Geo.fromQuads(v, f);
    }
    mk(dome, meridianStrip(domeR * 1.004, domeH * 1.004, 0.2, 7), M.iron, 0, 0, 0);
    for (let s = -1; s <= 1; s += 2) {
      const rib = meridianStrip(domeR * 1.02, domeH * 1.02, 0.055, 7);
      const m = new T.Matrix4().makeRotationY(s * 0.235);
      rib.applyMatrix4(m);
      mk(dome, rib, M.stoneW, 0, 0, 0);
    }
    // telescope on an equatorial fork, poking through the slit
    const tel = grp('telescope');
    tel.position.set(0, 0.35, -0.2);
    dome.add(tel);
    for (let s = -1; s <= 1; s += 2) {
      mk(tel, Geo.taperBox(0.14, 1.0, 0.16, 0.8), M.iron, s * 0.5, -0.35, 0);
    }
    const barrel = grp('barrel');
    tel.add(barrel);
    const bar = mk(barrel, Geo.taperTower(0.3, 0.24, 3.0, 8, { steps: 1 }), M.woodD, 0, 0, 0);
    bar.rotation.x = -Math.PI / 2;
    mk(barrel, Geo.ring(0.3, 0.36, 0.14, 8), M.gold, 0, 0, 0.9).rotation.x = Math.PI / 2;
    mk(barrel, Geo.ring(0.26, 0.32, 0.12, 8), M.gold, 0, 0, 2.4).rotation.x = Math.PI / 2;
    mk(barrel, Geo.lathe([[0.1, 0], [0.14, 0.22], [0.08, 0.34]], 7), M.iron, 0, 0, -0.42)
      .rotation.x = -Math.PI / 2;
    barrel.rotation.x = -0.5;
    TOWN.markDynamic(dome);
    TOWN.Ticker.add(function (dt, elapsed) {
      dome.rotation.y += 0.085 * dt;
      barrel.rotation.x = -0.62 + Math.sin(elapsed * 0.16) * 0.3;
    }, 'civic.observatory' + id);

    /* -- external stair up to the drum door ------------------ */
    const steps = 6;
    const stairG = grp('stair');
    stairG.rotation.y = -0.55;
    g.add(stairG);
    mk(stairG, Geo.curvedStairs(rad + 0.5, rad + 2.0, 1.55, steps, 1.15), M.stoneD, 0, 0, 0);
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * 1.15;
      mk(stairG, Geo.taperTower(0.09, 0.07, 0.85, 5, { steps: 1 }), M.iron,
        Math.cos(a) * (rad + 1.9), 1.55 * (i / steps), Math.sin(a) * (rad + 1.9));
    }
    mk(g, Geo.prism(Geo.polyPlan(6, 0.9), 0.3), M.stoneD, Math.cos(-0.55) * (rad + 1.6), 0, Math.sin(-0.55) * (rad + 1.6));

    g.userData.dome = dome;
    g.userData.telescope = barrel;
    g.userData.domeY = +domeY.toFixed(2);
    g.userData.drumRadius = +rad.toFixed(2);
    g.userData.drumHeight = +drumH.toFixed(2);
    return finish(g, 'observatory');
  };

  /* ============================================================
     12 · GAZEBO — hexagonal lookout pavilion
     ============================================================ */
  Civic.gazebo = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 11);
    const M = mats();
    const g = grp('gazebo');

    const rad = r.range(2.4, 3.2);
    const h = r.range(3.5, 4.5);

    /* -- two steps + deck ----------------------------------- */
    mk(g, Geo.prism(Geo.polyPlan(6, rad + 0.62, Math.PI / 6), 0.17), M.stoneD, 0, 0, 0);
    mk(g, Geo.prism(Geo.polyPlan(6, rad + 0.34, Math.PI / 6), 0.17), M.stoneD, 0, 0.16, 0);
    mk(g, Geo.prism(Geo.polyPlan(6, rad, Math.PI / 6), 0.2), M.wood, 0, 0.32, 0);
    mk(g, Geo.ring(rad * 0.97, rad + 0.06, 0.14, 6), M.woodD, 0, 0.34, 0);

    /* -- six turned columns + frieze brackets ---------------- */
    const colH = h - 1.8;
    const colGeo = Geo.lathe([
      [0.15, 0], [0.19, 0.12], [0.13, 0.28], [0.115, colH * 0.5],
      [0.15, colH * 0.72], [0.1, colH * 0.86], [0.14, colH],
    ], 6);
    const deckY = 0.52;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + Math.PI / 6;
      const cx = Math.cos(a) * (rad - 0.28), cz = Math.sin(a) * (rad - 0.28);
      mk(g, Geo.prism(Geo.polyPlan(4, 0.24, Math.PI / 4), 0.14), M.woodD, cx, deckY - 0.14, cz);
      mk(g, colGeo.clone(), M.wood, cx, deckY, cz);
      // ornamental corner brackets both ways
      for (let k = -1; k <= 1; k += 2) {
        const a2 = a + k * (Math.PI / 6);
        const bx = Math.cos(a2) * (rad - 0.28) * 0.55, bz = Math.sin(a2) * (rad - 0.28) * 0.55;
        const v = [[0, 0, 0], [0.55, 0, 0], [0, -0.45, 0]];
        const br = mk(g, Geo.fromQuads(v, [[0, 1, 2], [2, 1, 0]]), M.woodD,
          cx + (bx - cx) * 0.12, deckY + colH - 0.06, cz + (bz - cz) * 0.12);
        br.rotation.y = -a2 + (k > 0 ? 0 : Math.PI);
      }
    }
    // lintel ring + frieze
    mk(g, Geo.ring((rad - 0.28) * 0.9, rad - 0.1, 0.26, 6), M.wood, 0, deckY + colH, 0);
    mk(g, Geo.ring((rad - 0.1) * 0.94, rad + 0.14, 0.16, 6), M.woodD, 0, deckY + colH + 0.26, 0);

    /* -- ogee dome + finial ---------------------------------- */
    const roofY = deckY + colH + 0.42;
    mk(g, Geo.domeRoof(rad + 0.3, h * 0.34, 6, true), M.copper, 0, roofY, 0);
    mk(g, Geo.lathe([[0.2, 0], [0.26, 0.14], [0.16, 0.3]], 6), M.gold, 0, roofY + h * 0.32, 0);
    mk(g, finialGeo(0.16, 0.5), M.gold, 0, roofY + h * 0.34, 0);

    /* -- bench ring ----------------------------------------- */
    for (let i = 0; i < 5; i++) {
      const a = (i / 6) * TAU + Math.PI / 6 + Math.PI / 6;
      const cx = Math.cos(a) * (rad - 0.5), cz = Math.sin(a) * (rad - 0.5);
      const seat = mk(g, Geo.chamferBox(rad * 0.86, 0.09, 0.42, 0.03), M.wood, cx, deckY + 0.42, cz);
      seat.rotation.y = -a + Math.PI / 2;
      const back = mk(g, Geo.chamferBox(rad * 0.82, 0.42, 0.07, 0.03), M.woodD, cx * 1.12, deckY + 0.66, cz * 1.12);
      back.rotation.y = -a + Math.PI / 2;
      for (let s = -1; s <= 1; s += 2) {
        const lg = mk(g, Geo.taperBox(0.1, 0.42, 0.34, 0.85), M.woodD,
          cx + Math.cos(a + Math.PI / 2) * rad * 0.33 * s, deckY, cz + Math.sin(a + Math.PI / 2) * rad * 0.33 * s);
        lg.rotation.y = -a + Math.PI / 2;
      }
    }

    g.userData.radius = +rad.toFixed(2);
    g.userData.deckY = deckY;
    g.userData.entrance = [0, 0, +(rad + 0.6).toFixed(2)];
    return finish(g, 'gazebo');
  };

  /* ============================================================
     13 · CITY GATE — arch, twin turrets, portcullis, torches
     ============================================================ */
  Civic.cityGate = function (opts) {
    opts = opts || {};
    const r = U.rng(opts.seed || 12);
    const M = mats();
    const g = grp('cityGate');

    const w = r.range(7, 8.6);
    const h = r.range(8, 9.6);
    const thick = 2.6;
    const openW = w * 0.4, openH = h * 0.58;

    /* -- central arch block --------------------------------- */
    mk(g, Geo.taperBox(w + 0.5, 0.7, thick + 0.5, 0.985), M.stoneD, 0, 0, 0);
    mk(g, Geo.archWall(w, h - 0.65, thick,
      [{ x: 0, y: 0, w: openW, h: openH, arc: openW * 0.52 }]), M.stone, 0, 0.65, 0);
    mk(g, quoinsGeo(w, thick, h - 0.65, 3), M.stoneW, 0, 0.65, 0);
    // arch voussoirs on both faces
    for (let s = -1; s <= 1; s += 2) {
      for (let i = 0; i < 7; i++) {
        const a = Math.PI * (0.08 + (i / 6) * 0.84);
        const rr = openW * 0.56;
        const vx = -Math.cos(a) * rr, vy = 0.65 + openH - openW * 0.52 + Math.sin(a) * rr * 0.92;
        const vs = mk(g, Geo.box(0.3, 0.46, 0.14), M.stoneW, vx, vy, (s * thick) / 2);
        vs.rotation.z = a - Math.PI / 2;
      }
    }
    // keystone
    mk(g, Geo.taperBox(0.42, 0.7, thick + 0.2, 0.8), M.stoneW, 0, 0.65 + openH - 0.15, 0);

    /* -- machicolation corbels + crenellated walkway --------- */
    const wallTop = h - 0.65 + 0.65;
    for (let s = -1; s <= 1; s += 2) {
      for (let i = 0; i < 5; i++) {
        const cx = -w / 2 + 0.9 + ((w - 1.8) * i) / 4;
        mk(g, Geo.taperBox(0.36, 0.5, 0.42, 0.7), M.stoneW, cx, wallTop - 0.6, (s * (thick + 0.3)) / 2);
      }
    }
    mk(g, Geo.chamferBox(w + 0.55, 0.34, thick + 0.55, 0.07), M.stoneW, 0, wallTop - 0.1, 0);
    mk(g, Geo.box(w - 0.6, 0.12, thick - 0.5), M.stoneD, 0, wallTop + 0.1, 0);
    const merlons = [];
    for (let s = -1; s <= 1; s += 2) {
      for (let i = 0; i < 5; i++) {
        const cx = -w / 2 + 0.75 + ((w - 1.5) * i) / 4;
        merlons.push(Geo.at(Geo.box(0.72, 0.62, 0.34), cx, wallTop + 0.38, (s * (thick + 0.3)) / 2));
      }
    }
    mk(g, Geo.mergeGeometries(merlons), M.stone, 0, 0, 0);

    /* -- twin round turrets --------------------------------- */
    const turretR = 0.95, turretH = h + 0.15;
    for (let s = -1; s <= 1; s += 2) {
      const tx = (s * (w + turretR * 0.24)) / 2;
      mk(g, Geo.taperTower(turretR + 0.22, turretR + 0.1, 0.7, 10, { steps: 1 }), M.stoneD, tx, 0, 0);
      mk(g, Geo.taperTower(turretR, turretR * 0.92, turretH, 10, { steps: 3 }), M.stone, tx, 0.68, 0);
      mk(g, Geo.ring(turretR * 0.9, turretR * 1.2, 0.26, 10), M.stoneW, tx, 0.68 + turretH * 0.52, 0);
      mk(g, Geo.ring(turretR * 0.92, turretR * 1.26, 0.3, 10), M.stoneW, tx, 0.68 + turretH, 0);
      mk(g, Geo.coneRoof(turretR * 1.24, 1.35, 10), M.slate, tx, 0.98 + turretH, 0);
      mk(g, Geo.lathe([[0.13, 0], [0.06, 0.18]], 6), M.gold, tx, 0.98 + turretH + 1.35, 0);
      mk(g, flagGeo(0.62, 0.36, 3), M.red, tx + 0.03, 0.98 + turretH + 1.62, 0).rotation.y = 0.5;
      // arrow slits
      for (let i = 0; i < 2; i++) {
        const ag = grp('slit');
        ag.rotation.y = s > 0 ? 0.4 : -0.4;
        ag.position.set(tx, 0, 0);
        g.add(ag);
        mk(ag, Geo.box(0.2, 0.9, 0.3), M.iron, 0, 2.2 + i * 2.6, turretR * 0.93);
        mk(ag, Geo.archWall(0.62, 1.3, 0.16, [{ x: 0, y: 0.2, w: 0.24, h: 0.9, arc: 0.12 }]),
          M.stoneW, 0, 1.75 + i * 2.6, turretR * 0.98);
      }
    }

    /* -- portcullis grille + gate leaves --------------------- */
    const bars = [];
    for (let i = 0; i < 6; i++) {
      bars.push(Geo.at(Geo.box(0.1, openH * 0.95, 0.1), -openW / 2 + 0.16 + ((openW - 0.32) * i) / 5,
        0.65 + openH * 0.475, thick / 2 - 0.28));
    }
    for (let i = 0; i < 3; i++) {
      bars.push(Geo.at(Geo.box(openW - 0.2, 0.1, 0.1), 0, 0.9 + (openH * 0.8 * i) / 2, thick / 2 - 0.28));
    }
    mk(g, Geo.mergeGeometries(bars), M.iron, 0, 0, 0);
    for (let s = -1; s <= 1; s += 2) {
      const leaf = mk(g, Geo.chamferBox(openW * 0.49, openH * 0.86, 0.14, 0.03), M.woodD,
        (s * openW) / 4, 0.65 + openH * 0.43, -thick / 2 + 0.22);
      leaf.rotation.y = s * 0.22;
      for (let i = 0; i < 2; i++) {
        mk(g, Geo.box(openW * 0.46, 0.1, 0.05), M.iron, (s * openW) / 4 + s * 0.02,
          0.65 + openH * (0.25 + i * 0.4), -thick / 2 + 0.14);
      }
    }

    /* -- torch brackets ------------------------------------- */
    for (let s = -1; s <= 1; s += 2) {
      const bx = (s * (openW + 1.1)) / 2;
      mk(g, Geo.box(0.12, 0.12, 0.6), M.iron, bx, 3.3, thick / 2 + 0.28);
      mk(g, Geo.box(0.12, 0.5, 0.12), M.iron, bx, 3.05, thick / 2 + 0.02);
      mk(g, Geo.lathe([[0.1, 0], [0.24, 0.3], [0.2, 0.42]], 6), M.iron, bx, 3.42, thick / 2 + 0.52);
      lantern(g, bx, 3.78, thick / 2 + 0.52, 0.16, 2.8);
    }

    g.userData.passage = { w: +openW.toFixed(2), h: +openH.toFixed(2), axis: 'z' };
    g.userData.walkwayY = +(wallTop + 0.16).toFixed(2);
    g.userData.turretX = +((w + turretR * 0.24) / 2).toFixed(2);
    return finish(g, 'cityGate');
  };

  /* ============================================================
     14 · DEMO — every landmark in a row along X
     ============================================================ */
  Civic.demo = function (opts) {
    opts = opts || {};
    const g = grp('civicDemo');
    const names = ['townHall', 'church', 'lighthouse', 'windmill', 'watermill', 'station',
      'library', 'market', 'warehouse', 'observatory', 'gazebo', 'cityGate'];
    const seed0 = opts.seed || 1;
    let x = 0, maxH = 0, maxD = 0;
    for (let i = 0; i < names.length; i++) {
      const b = Civic[names[i]]({ seed: seed0 + i * 7 });
      const fw = b.userData.footprint.w;
      x += fw / 2;
      b.position.x = x;
      g.add(b);
      maxH = Math.max(maxH, b.userData.height);
      maxD = Math.max(maxD, b.userData.footprint.d);
      x += fw / 2 + 3;
    }
    g.userData.kind = 'demo';
    g.userData.footprint = { w: +x.toFixed(2), d: +maxD.toFixed(2) };
    g.userData.height = +maxH.toFixed(2);
    g.userData.count = names.length;
    g.userData.names = names;
    return g;
  };

  console.log('[TOWN] buildings_civic ready (' + Object.keys(Civic).length + ' factories)');
})(window);

// ---- probe results ----
// tools/probe.sh --files js/world/buildings_civic.js   ·   errors: []   ok: true
// on every factory, no NaN geometry, minY = 0.000 everywhere, tri counts are
// seed-invariant to within earcut's triangulation jitter (range over 10+ seeds).
//
// factory      tris (10 seeds)  budget  mats  dyn  bbox x        bbox y (height)  bbox z
// townHall     4316 - 4380      4500     15    6   16.0 - 18.7   22.4 - 25.2      12.0 - 14.4
// church       2786             4500     10    3    8.9 - 10.7   22.4 - 26.2      20.5 - 22.8
// lighthouse   2172             3500     12    9    6.0 - 6.3    20.5 - 23.7      17.0 (beams)
//                                                  masonry z = 4.4 - 5.9 with {beams:false}
// windmill     2128             3500     11    3    8.7 - 10.4   16.7 - 20.3 *     7.1 - 8.0
// watermill    1516             3500     12    8   10.1 - 11.2    8.9 - 10.2       7.2 - 8.8
// station      1600             3500     15    3   13.2 - 15.9    5.5 - 5.9        7.0 - 8.6
// library      3280 - 3344      3500     12    0   13.0 - 15.8   11.0 - 12.3      13.0 - 14.6
// market       2100             3500     12    4   11.8 - 14.6    6.1 - 7.9        9.2 - 10.8
// warehouse    1656             3500     12    6   11.8 - 14.6    8.5 - 10.1       9.3 - 11.7
// observatory  1656             3500     10   14    8.4 - 9.7     9.1 - 11.0 *    10.1 - 11.8
// gazebo       1388             3500      5    0    5.2 - 6.5     4.4 - 5.5        6.1 - 7.5
// cityGate     2108             3500      9    2    9.5 - 11.0   10.9 - 12.2       3.72
// demo()      26738 - 26834    45000     25   58  170.9          25.2             21.9
//
// * by design: the windmill bbox top is the sail tip (masonry cap = userData.capTop,
//   <= 16.6, inside the 11-14 tower spec plus its roof); the observatory bbox top is
//   the rotating dome (stone drum = userData.drumHeight, 5-7 as spec'd).  The
//   lighthouse bbox z is the night-only light cones - call with {beams:false} for the
//   masonry envelope.  userData.footprint/height always measure solid geometry only
//   (halo billboards and FX cones excluded), so demo() spacing never overlaps.
//
// module totals: 25 shared materials (budget 25; glazing groups 0/1/2/3/5/6, and
// group 6 never lights so no facade glows uniformly) · at most 2 real PointLights,
// hard-capped by an internal counter (1 per lighthouse, pushed to
// Stage.nightLights, intensity driven from Env.lampF: 0.00 by day, 1.70 at night).
// Geo.mergeStatic collapses each landmark to 12-19 draw calls (townHall 117 -> 17
// meshes) and every TOWN.markDynamic subtree survives - sails still turn after merging.
// Ticker check, 40 x Ticker.update(0.016, t, true): no ticker disabled, and
// sails 0 -> 0.160 rad, waterwheel 0 -> 0.384 rad, beacon 0 -> 1.005 rad (4 s/turn),
// obs. dome 0 -> 0.054 rad, telescope elevation + warehouse hoist sway both change;
// clock hands read Env.hours exactly (15.5 h -> hour -1.8326, minute -PI;
// 9.0 h -> hour -4.7124).
// Orthographic elevation render of demo(): silhouette peaks per 2 m slice run
// 4 -> 26 m with 18 distinct levels (no flat run of equal heights), and only
// 0.03 % of building pixels are near-black, i.e. no inverted-normal faces.
